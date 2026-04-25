import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  createSession,
  uploadBlob,
  createPost,
  fetchImageAsBuffer,
} from "../../../../../lib/bluesky-client";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://cbewozzdyjqmhzkxsjqo.supabase.co";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

const SITE_BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://ange-spa.com";
const BLUESKY_MAX_TEXT = 300; // Blueskyの上限文字数

/**
 * Bluesky 自動投稿実行 (日記投稿後に fire-and-forget で呼ばれる)
 *
 * Body: { entryId }
 *
 * 処理:
 *   1. entry を取得
 *   2. visibility=public でなければスキップ (会員限定はBSにあげない)
 *   3. セラピストのBluesky設定を取得
 *      - 未設定 / inactive / autoPostEnabled=false → スキップ
 *   4. 当日投稿数チェック (limit到達ならスキップ)
 *   5. テキスト生成: 「{タイトル}\n\nつづきはHPで → {URL}」
 *   6. カバー画像があれば添付
 *   7. Blueskyに投稿 → diary_bluesky_posts に結果記録
 */

type EntryInfo = {
  id: number;
  therapist_id: number;
  title: string;
  cover_image_url: string | null;
  visibility: string;
  status: string;
  deleted_at: string | null;
};

type AccountInfo = {
  therapist_id: number;
  handle: string;
  app_password: string;
  active: boolean;
  auto_post_enabled: boolean;
  include_image: boolean;
  daily_post_limit: number;
  post_count_today: number;
  last_count_reset_date: string | null;
};

function todayJST(): string {
  // JST (UTC+9) の YYYY-MM-DD
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().slice(0, 10);
}

async function recordResult(
  entryId: number,
  therapistId: number,
  result: {
    status: "posted" | "failed" | "skipped";
    skipReason?: string;
    errorMessage?: string;
    errorCode?: string;
    blueskyPostUri?: string;
    blueskyPostUrl?: string;
    blueskyPostCid?: string;
    postedText?: string;
    postedImageUrl?: string;
    dailyPostIndex?: number;
  }
) {
  await supabase.from("diary_bluesky_posts").upsert(
    {
      entry_id: entryId,
      therapist_id: therapistId,
      status: result.status,
      skip_reason: result.skipReason || null,
      error_message: result.errorMessage || null,
      error_code: result.errorCode || null,
      bluesky_post_uri: result.blueskyPostUri || null,
      bluesky_post_url: result.blueskyPostUrl || null,
      bluesky_post_cid: result.blueskyPostCid || null,
      posted_text: result.postedText || null,
      posted_image_url: result.postedImageUrl || null,
      daily_post_index: result.dailyPostIndex || null,
      posted_at: result.status === "posted" ? new Date().toISOString() : null,
    },
    { onConflict: "entry_id" }
  );
}

export async function POST(req: Request) {
  try {
    const { entryId } = await req.json();
    if (!entryId) {
      return NextResponse.json({ error: "entryId が必要です" }, { status: 400 });
    }

    // 1. entry 取得
    const { data: entryRow } = await supabase
      .from("therapist_diary_entries")
      .select("id, therapist_id, title, cover_image_url, visibility, status, deleted_at")
      .eq("id", entryId)
      .maybeSingle();

    const entry = entryRow as EntryInfo | null;
    if (!entry || entry.deleted_at) {
      return NextResponse.json({ error: "記事が見つかりません" }, { status: 404 });
    }

    // 公開でなければスキップ
    if (entry.visibility !== "public" || entry.status !== "published") {
      await recordResult(entry.id, entry.therapist_id, {
        status: "skipped",
        skipReason: "not_public",
      });
      return NextResponse.json({ skipped: true, reason: "not_public" });
    }

    // 2. アカウント取得
    const { data: accountRow } = await supabase
      .from("therapist_bluesky_accounts")
      .select(
        "therapist_id, handle, app_password, active, auto_post_enabled, include_image, daily_post_limit, post_count_today, last_count_reset_date"
      )
      .eq("therapist_id", entry.therapist_id)
      .maybeSingle();

    const account = accountRow as AccountInfo | null;
    if (!account) {
      await recordResult(entry.id, entry.therapist_id, {
        status: "skipped",
        skipReason: "no_account",
      });
      return NextResponse.json({ skipped: true, reason: "no_account" });
    }

    if (!account.active || !account.auto_post_enabled) {
      await recordResult(entry.id, entry.therapist_id, {
        status: "skipped",
        skipReason: account.active ? "auto_disabled" : "account_inactive",
      });
      return NextResponse.json({ skipped: true, reason: "account_inactive" });
    }

    // 3. 当日投稿数チェック (JST基準)
    const today = todayJST();
    let postCountToday = account.post_count_today;
    let needCountReset = false;
    if (account.last_count_reset_date !== today) {
      needCountReset = true;
      postCountToday = 0;
    }

    if (postCountToday >= account.daily_post_limit) {
      await recordResult(entry.id, entry.therapist_id, {
        status: "skipped",
        skipReason: "daily_limit",
      });
      return NextResponse.json({
        skipped: true,
        reason: "daily_limit",
        postCountToday,
        dailyPostLimit: account.daily_post_limit,
      });
    }

    // 4. ログイン
    let session;
    try {
      session = await createSession(account.handle, account.app_password);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "認証エラー";
      // last_error 記録 + last_test_status=failed
      await supabase
        .from("therapist_bluesky_accounts")
        .update({
          last_test_status: "failed",
          last_test_at: new Date().toISOString(),
          last_error: msg,
        })
        .eq("therapist_id", entry.therapist_id);

      await recordResult(entry.id, entry.therapist_id, {
        status: "failed",
        errorMessage: msg,
        errorCode: "auth_error",
      });
      return NextResponse.json({ failed: true, error: msg }, { status: 500 });
    }

    // 5. テキスト生成
    const entryUrl = `${SITE_BASE_URL}/diary/${entry.id}`;
    let titleSnippet = entry.title.trim();

    // テキスト全体が300字以内になるよう調整
    // 構成: タイトル + "\n\nつづきはHPで → " + URL
    const tail = `\n\nつづきはHPで → ${entryUrl}`;
    const maxTitleLen = BLUESKY_MAX_TEXT - tail.length;
    if (titleSnippet.length > maxTitleLen) {
      titleSnippet = titleSnippet.slice(0, Math.max(0, maxTitleLen - 1)) + "…";
    }
    const text = `${titleSnippet}${tail}`;

    // 6. 画像添付 (任意)
    let imageEmbed: { alt: string; blob: Awaited<ReturnType<typeof uploadBlob>> } | undefined;
    let postedImageUrl: string | null = null;
    if (account.include_image && entry.cover_image_url) {
      try {
        const { buffer, mimeType } = await fetchImageAsBuffer(entry.cover_image_url, 950 * 1024);
        const blob = await uploadBlob(session, buffer, mimeType);
        imageEmbed = { alt: titleSnippet, blob };
        postedImageUrl = entry.cover_image_url;
      } catch (e) {
        // 画像アップロード失敗は致命的ではない、テキストのみで続行
        console.warn(`Bluesky image upload failed (entry ${entry.id}):`, e);
      }
    }

    // 7. 投稿
    let postResult;
    try {
      postResult = await createPost(session, text, imageEmbed);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "投稿エラー";
      await recordResult(entry.id, entry.therapist_id, {
        status: "failed",
        errorMessage: msg,
        errorCode: "post_error",
        postedText: text,
      });
      return NextResponse.json({ failed: true, error: msg }, { status: 500 });
    }

    // 8. アカウント側のカウンタ更新
    const dailyPostIndex = postCountToday + 1;
    await supabase
      .from("therapist_bluesky_accounts")
      .update({
        post_count_today: dailyPostIndex,
        last_count_reset_date: today,
        last_posted_at: new Date().toISOString(),
        last_test_status: "success",
        last_test_at: new Date().toISOString(),
        last_error: null,
      })
      .eq("therapist_id", entry.therapist_id);

    // 9. 結果記録
    await recordResult(entry.id, entry.therapist_id, {
      status: "posted",
      blueskyPostUri: postResult.uri,
      blueskyPostUrl: postResult.url,
      blueskyPostCid: postResult.cid,
      postedText: text,
      postedImageUrl: postedImageUrl || undefined,
      dailyPostIndex,
    });

    return NextResponse.json({
      success: true,
      postUrl: postResult.url,
      postUri: postResult.uri,
      dailyPostIndex,
      dailyPostLimit: account.daily_post_limit,
      countReset: needCountReset,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "不明なエラー";
    console.error("/api/diary/bluesky/post error:", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
