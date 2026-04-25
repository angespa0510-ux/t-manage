import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://cbewozzdyjqmhzkxsjqo.supabase.co";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

const STORAGE_BUCKET = "therapist-diary";
const MAX_IMAGES = 10;
const MAX_TITLE_LEN = 80;
const MAX_BODY_LEN = 2000;
const MAX_TAGS = 10;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB
const RESIZE_MAX_WIDTH = 1920;
const THUMB_MAX_WIDTH = 600;

type ImageInput = {
  base64: string;
  mediaType?: string;
  caption?: string;
};

type PostInput = {
  therapistId: number;
  authToken?: string;
  title: string;
  body: string;
  visibility?: "public" | "members_only";
  images: ImageInput[];
  tags?: string[];
  sendToEkichika?: boolean;
};

/**
 * セラピスト認証(簡易)
 * - sessionStorageベースの auth ではサーバーサイドで検証できないので、
 *   ここでは login_email + login_password の DB 直接照合で簡易認証する。
 * - 本格認証は Phase 2 で JWT 化を検討。
 */
async function verifyTherapist(therapistId: number, authToken?: string): Promise<boolean> {
  const { data } = await supabase
    .from("therapists")
    .select("id, login_password, status")
    .eq("id", therapistId)
    .maybeSingle();
  if (!data) return false;
  if (data.status !== "active") return false;
  // authToken が login_password と一致すれば OK（簡易版）
  if (authToken && data.login_password === authToken) return true;
  return false;
}

/**
 * Base64画像をWebPに変換+リサイズしてアップロード
 */
async function processAndUploadImage(
  therapistId: number,
  entryId: number,
  base64: string,
  index: number
): Promise<{ image_url: string; thumbnail_url: string; width: number; height: number; size: number; sort_order: number; caption: string | null }> {
  // base64 から Buffer 化
  const cleanBase64 = base64.replace(/^data:image\/[a-z]+;base64,/, "");
  const inputBuffer = Buffer.from(cleanBase64, "base64");

  if (inputBuffer.length > MAX_IMAGE_BYTES) {
    throw new Error(`画像サイズが上限(${MAX_IMAGE_BYTES / 1024 / 1024}MB)を超えています`);
  }

  // 元画像のメタ取得
  const meta = await sharp(inputBuffer).metadata();

  // メイン画像: 最大1920px のWebP
  const mainBuffer = await sharp(inputBuffer)
    .rotate() // EXIF orientation 対応
    .resize({ width: RESIZE_MAX_WIDTH, withoutEnlargement: true })
    .webp({ quality: 85 })
    .toBuffer();

  // サムネイル: 最大600px
  const thumbBuffer = await sharp(inputBuffer)
    .rotate()
    .resize({ width: THUMB_MAX_WIDTH, withoutEnlargement: true })
    .webp({ quality: 75 })
    .toBuffer();

  const ts = Date.now();
  const mainPath = `${therapistId}/${entryId}/${ts}_${index}.webp`;
  const thumbPath = `${therapistId}/${entryId}/${ts}_${index}_thumb.webp`;

  // メイン画像アップロード
  const mainUp = await supabase.storage.from(STORAGE_BUCKET).upload(mainPath, mainBuffer, {
    contentType: "image/webp",
    upsert: false,
  });
  if (mainUp.error) throw new Error(`画像アップロード失敗: ${mainUp.error.message}`);

  // サムネイルアップロード
  const thumbUp = await supabase.storage.from(STORAGE_BUCKET).upload(thumbPath, thumbBuffer, {
    contentType: "image/webp",
    upsert: false,
  });
  if (thumbUp.error) throw new Error(`サムネイルアップロード失敗: ${thumbUp.error.message}`);

  const mainUrl = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(mainPath).data.publicUrl;
  const thumbUrl = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(thumbPath).data.publicUrl;

  return {
    image_url: mainUrl,
    thumbnail_url: thumbUrl,
    width: meta.width || 0,
    height: meta.height || 0,
    size: mainBuffer.length,
    sort_order: index,
    caption: null,
  };
}

/**
 * タグ処理: タグ名から id を取得 or 新規作成 + 中間レコード作成
 */
async function processTags(entryId: number, tagNames: string[]): Promise<void> {
  for (const rawName of tagNames) {
    const name = rawName.replace(/^#/, "").trim();
    if (!name) continue;

    // 既存タグ検索
    const { data: existing } = await supabase
      .from("therapist_diary_tags")
      .select("id, use_count, is_blocked")
      .eq("name", name)
      .maybeSingle();

    let tagId: number;
    if (existing) {
      if (existing.is_blocked) continue; // ブロック済みタグはスキップ
      tagId = existing.id;
      await supabase
        .from("therapist_diary_tags")
        .update({ use_count: existing.use_count + 1 })
        .eq("id", tagId);
    } else {
      const { data: created, error } = await supabase
        .from("therapist_diary_tags")
        .insert({
          name,
          display_name: `#${name}`,
          category: "other",
          use_count: 1,
        })
        .select("id")
        .single();
      if (error || !created) continue;
      tagId = created.id;
    }

    await supabase
      .from("therapist_diary_entry_tags")
      .insert({ entry_id: entryId, tag_id: tagId });
  }
}

export async function POST(req: Request) {
  try {
    const input = (await req.json()) as PostInput;

    // バリデーション
    if (!input.therapistId) {
      return NextResponse.json({ error: "therapistId が必要です" }, { status: 400 });
    }
    if (!input.title || input.title.trim().length === 0) {
      return NextResponse.json({ error: "タイトルを入力してください" }, { status: 400 });
    }
    if (input.title.length > MAX_TITLE_LEN) {
      return NextResponse.json({ error: `タイトルは${MAX_TITLE_LEN}文字以内で入力してください` }, { status: 400 });
    }
    if (!input.body || input.body.trim().length === 0) {
      return NextResponse.json({ error: "本文を入力してください" }, { status: 400 });
    }
    if (input.body.length > MAX_BODY_LEN) {
      return NextResponse.json({ error: `本文は${MAX_BODY_LEN}文字以内で入力してください` }, { status: 400 });
    }
    if (!input.images || input.images.length === 0) {
      return NextResponse.json({ error: "写真を1枚以上添付してください" }, { status: 400 });
    }
    if (input.images.length > MAX_IMAGES) {
      return NextResponse.json({ error: `写真は最大${MAX_IMAGES}枚までです` }, { status: 400 });
    }
    if (input.tags && input.tags.length > MAX_TAGS) {
      return NextResponse.json({ error: `タグは最大${MAX_TAGS}個までです` }, { status: 400 });
    }

    // 認証
    const ok = await verifyTherapist(input.therapistId, input.authToken);
    if (!ok) {
      return NextResponse.json({ error: "認証に失敗しました" }, { status: 401 });
    }

    const visibility = input.visibility === "members_only" ? "members_only" : "public";
    // 会員限定の場合は駅ちか送信を強制false
    const sendToEkichika = visibility === "public" && input.sendToEkichika !== false;

    // 1. エントリ INSERT (画像URLは後から更新)
    const { data: entry, error: insertErr } = await supabase
      .from("therapist_diary_entries")
      .insert({
        therapist_id: input.therapistId,
        title: input.title.trim(),
        body: input.body.trim(),
        visibility,
        status: "published",
        send_to_ekichika: sendToEkichika,
        ekichika_dispatch_status: sendToEkichika ? "pending" : "skipped",
        published_at: new Date().toISOString(),
        source: "mypage",
      })
      .select("id")
      .single();

    if (insertErr || !entry) {
      console.error("entry insert error:", insertErr);
      return NextResponse.json({ error: "投稿の保存に失敗しました" }, { status: 500 });
    }

    const entryId = entry.id;

    // 2. 画像処理 + アップロード + DB保存
    const imageRows: ReturnType<typeof Object>[] = [];
    let coverImageUrl: string | null = null;
    try {
      for (let i = 0; i < input.images.length; i++) {
        const img = input.images[i];
        const result = await processAndUploadImage(input.therapistId, entryId, img.base64, i);
        if (i === 0) coverImageUrl = result.image_url;
        imageRows.push({
          entry_id: entryId,
          image_url: result.image_url,
          thumbnail_url: result.thumbnail_url,
          sort_order: result.sort_order,
          width: result.width,
          height: result.height,
          file_size_bytes: result.size,
          caption: img.caption || null,
        });
      }
    } catch (imgErr: unknown) {
      // 画像処理失敗 → エントリも論理削除
      await supabase
        .from("therapist_diary_entries")
        .update({
          deleted_at: new Date().toISOString(),
          delete_reason: "画像処理エラー",
        })
        .eq("id", entryId);
      const msg = imgErr instanceof Error ? imgErr.message : "画像処理エラー";
      return NextResponse.json({ error: msg }, { status: 500 });
    }

    if (imageRows.length > 0) {
      await supabase.from("therapist_diary_images").insert(imageRows);
    }

    // 3. カバー画像URL更新
    if (coverImageUrl) {
      await supabase
        .from("therapist_diary_entries")
        .update({ cover_image_url: coverImageUrl })
        .eq("id", entryId);
    }

    // 4. タグ処理
    if (input.tags && input.tags.length > 0) {
      await processTags(entryId, input.tags);
    }

    // 5. 駅ちか送信は非同期 (fire-and-forget)
    let ekichikaScheduled = false;
    if (sendToEkichika) {
      const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://t-manage.vercel.app";
      // 投稿レスポンスを返した後に駅ちか送信を走らせる(awaitしない)
      fetch(`${baseUrl}/api/diary/dispatch-ekichika`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryId }),
      }).catch((e) => console.error("dispatch trigger failed:", e));
      ekichikaScheduled = true;
    }

    return NextResponse.json({
      success: true,
      entryId,
      coverImageUrl,
      visibility,
      ekichikaDispatchScheduled: ekichikaScheduled,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "不明なエラー";
    console.error("/api/diary/post error:", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
