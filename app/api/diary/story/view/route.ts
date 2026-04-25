import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://cbewozzdyjqmhzkxsjqo.supabase.co";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

function hashIp(ip: string): string {
  return crypto.createHash("sha256").update(ip).digest("hex").slice(0, 32);
}

/**
 * ストーリー閲覧記録 (会員のみカウント)
 *
 * Body: { storyId, customerId? }
 *
 * 1人1ストーリー1回まで (UNIQUE制約)
 * セラピスト側で「誰が見たか」を確認できるようにする
 */
export async function POST(req: Request) {
  try {
    const { storyId, customerId } = await req.json();
    if (!storyId) {
      return NextResponse.json({ error: "storyId が必要です" }, { status: 400 });
    }

    // story 取得 (期限切れ確認)
    const { data: story } = await supabase
      .from("therapist_diary_stories")
      .select("id, view_count, unique_viewer_count, expires_at, status, deleted_at")
      .eq("id", storyId)
      .maybeSingle();

    if (!story || story.deleted_at || story.status !== "active") {
      return NextResponse.json({ error: "ストーリーが見つかりません" }, { status: 404 });
    }

    if (new Date(story.expires_at) < new Date()) {
      return NextResponse.json({ error: "期限切れです" }, { status: 410 });
    }

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "0.0.0.0";
    const ipHash = hashIp(ip);

    // 重複チェック: 同じcustomer_idがある場合は何もしない
    let isNewView = true;
    if (customerId) {
      const { data: existing } = await supabase
        .from("therapist_diary_story_views")
        .select("id")
        .eq("story_id", storyId)
        .eq("customer_id", customerId)
        .maybeSingle();
      if (existing) {
        isNewView = false;
      }
    } else {
      // 非会員: ip_hash で重複判定 (10分以内)
      const { data: existing } = await supabase
        .from("therapist_diary_story_views")
        .select("id")
        .eq("story_id", storyId)
        .is("customer_id", null)
        .eq("ip_hash", ipHash)
        .gte("viewed_at", new Date(Date.now() - 10 * 60 * 1000).toISOString())
        .maybeSingle();
      if (existing) {
        isNewView = false;
      }
    }

    if (isNewView) {
      // viewログ追加 (UNIQUE制約があるので衝突時は無視)
      const { error: insertErr } = await supabase
        .from("therapist_diary_story_views")
        .insert({
          story_id: storyId,
          customer_id: customerId || null,
          ip_hash: ipHash,
        });

      // UNIQUE違反は無視 (race condition で1人2リクエスト同時発生時)
      if (!insertErr) {
        // unique_viewer_count++ (会員のみ)
        // view_count は常時インクリメント
        const updates: Record<string, number> = {
          view_count: story.view_count + 1,
        };
        if (customerId) {
          updates.unique_viewer_count = story.unique_viewer_count + 1;
        }
        await supabase
          .from("therapist_diary_stories")
          .update(updates)
          .eq("id", storyId);
      }
    } else {
      // 既存viewでも view_count はインクリメント (非会員の重複以外)
      if (customerId) {
        // 何もしない (UNIQUEに弾かれてカウントしない)
      } else {
        await supabase
          .from("therapist_diary_stories")
          .update({ view_count: story.view_count + 1 })
          .eq("id", storyId);
      }
    }

    return NextResponse.json({ success: true, isNewView });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "不明なエラー";
    console.error("/api/diary/story/[id]/view error:", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
