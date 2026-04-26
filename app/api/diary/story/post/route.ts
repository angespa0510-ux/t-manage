import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://cbewozzdyjqmhzkxsjqo.supabase.co";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

const STORAGE_BUCKET = "therapist-stories";
const STORY_LIFETIME_HOURS = 24;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_VIDEO_BYTES = 20 * 1024 * 1024;
const MAX_VIDEO_SECONDS = 15;
const RESIZE_MAX_WIDTH = 1280;
const THUMB_MAX_WIDTH = 100; // 50pxの2倍 (Retina)
const MAX_CAPTION = 200;

type PostInput = {
  therapistId: number;
  authToken: string;
  mediaType: "image" | "video";
  mediaBase64: string;
  mediaContentType: string;  // "image/jpeg" | "image/png" | "video/mp4" など
  caption?: string;
  visibility?: "public" | "members_only";
  videoDurationSec?: number; // クライアント側で計測した値
};

async function verifyTherapist(therapistId: number, authToken?: string): Promise<boolean> {
  const { data } = await supabase
    .from("therapists")
    .select("id, login_password, status")
    .eq("id", therapistId)
    .maybeSingle();
  if (!data) return false;
  if (data.status !== "active") return false;
  if (authToken && data.login_password === authToken) return true;
  return false;
}

/**
 * 画像処理: WebP変換+リサイズ+サムネ生成
 */
async function processImage(base64: string): Promise<{
  mainBuffer: Buffer;
  thumbBuffer: Buffer;
  width: number;
  height: number;
  size: number;
}> {
  const cleanBase64 = base64.replace(/^data:image\/[a-z]+;base64,/, "");
  const inputBuffer = Buffer.from(cleanBase64, "base64");
  if (inputBuffer.length > MAX_IMAGE_BYTES) {
    throw new Error(`画像サイズが上限(${MAX_IMAGE_BYTES / 1024 / 1024}MB)を超えています`);
  }
  const meta = await sharp(inputBuffer).metadata();
  const mainBuffer = await sharp(inputBuffer)
    .rotate()
    .resize({ width: RESIZE_MAX_WIDTH, withoutEnlargement: true })
    .webp({ quality: 85 })
    .toBuffer();
  const thumbBuffer = await sharp(inputBuffer)
    .rotate()
    .resize({ width: THUMB_MAX_WIDTH, withoutEnlargement: true })
    .webp({ quality: 70 })
    .toBuffer();
  return {
    mainBuffer,
    thumbBuffer,
    width: meta.width || 0,
    height: meta.height || 0,
    size: mainBuffer.length,
  };
}

/**
 * 動画処理: バリデーションのみ (実際のリエンコードは /api/diary/video/upload + process-job で実行)
 *
 * Phase 3 Step I で本格対応:
 *   - MP4 だけでなく MOV(QuickTime) も受付
 *   - サーバーサイド ffmpeg で H.264 + AAC に統一
 *   - 9:16 へのアスペクト変換
 */
async function processVideo(
  base64: string,
  contentType: string,
  durationSec?: number
): Promise<{ buffer: Buffer; size: number }> {
  const cleanBase64 = base64.replace(/^data:video\/[a-z0-9-]+;base64,/, "");
  const buffer = Buffer.from(cleanBase64, "base64");
  if (buffer.length > MAX_VIDEO_BYTES) {
    throw new Error(`動画サイズが上限(${MAX_VIDEO_BYTES / 1024 / 1024}MB)を超えています`);
  }
  if (!["video/mp4", "video/quicktime", "video/x-m4v"].includes(contentType)) {
    throw new Error("動画は MP4 か MOV(iPhone標準) のみ対応しています");
  }
  if (durationSec && durationSec > MAX_VIDEO_SECONDS) {
    throw new Error(`動画は${MAX_VIDEO_SECONDS}秒以内にしてください`);
  }
  return { buffer, size: buffer.length };
}

export async function POST(req: Request) {
  try {
    const input = (await req.json()) as PostInput;

    // バリデーション
    if (!input.therapistId) {
      return NextResponse.json({ error: "therapistId が必要です" }, { status: 400 });
    }
    if (!input.mediaType || !["image", "video"].includes(input.mediaType)) {
      return NextResponse.json({ error: "mediaType は image または video です" }, { status: 400 });
    }
    if (!input.mediaBase64) {
      return NextResponse.json({ error: "メディアが必要です" }, { status: 400 });
    }
    if (input.caption && input.caption.length > MAX_CAPTION) {
      return NextResponse.json({ error: `キャプションは${MAX_CAPTION}文字以内です` }, { status: 400 });
    }

    // 認証
    if (!(await verifyTherapist(input.therapistId, input.authToken))) {
      return NextResponse.json({ error: "認証に失敗しました" }, { status: 401 });
    }

    const visibility = input.visibility === "members_only" ? "members_only" : "public";
    const expiresAt = new Date(Date.now() + STORY_LIFETIME_HOURS * 3600 * 1000).toISOString();

    // 1. story レコードを先に作成 (storage path に story_id を使うため)
    const { data: story, error: insErr } = await supabase
      .from("therapist_diary_stories")
      .insert({
        therapist_id: input.therapistId,
        media_type: input.mediaType,
        visibility,
        status: "active",
        caption: input.caption?.trim() || null,
        published_at: new Date().toISOString(),
        expires_at: expiresAt,
        video_duration_sec: input.mediaType === "video" ? input.videoDurationSec || null : null,
      })
      .select("id")
      .single();

    if (insErr || !story) {
      console.error("story insert error:", insErr);
      return NextResponse.json({ error: "投稿の保存に失敗しました" }, { status: 500 });
    }

    const storyId = story.id;
    const ts = Date.now();

    try {
      let mainPath: string;
      let thumbPath: string | null = null;
      let mainContentType: string;
      let mainBuffer: Buffer;
      let thumbBuffer: Buffer | null = null;
      let width = 0;
      let height = 0;
      let fileSize = 0;
      let videoJobId: number | null = null;
      let isProcessingVideo = false;

      if (input.mediaType === "image") {
        const result = await processImage(input.mediaBase64);
        mainBuffer = result.mainBuffer;
        thumbBuffer = result.thumbBuffer;
        width = result.width;
        height = result.height;
        fileSize = result.size;
        mainPath = `${input.therapistId}/${storyId}/${ts}.webp`;
        thumbPath = `${input.therapistId}/${storyId}/${ts}_thumb.webp`;
        mainContentType = "image/webp";

        // メディア本体アップロード
        const upMain = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(mainPath, mainBuffer, { contentType: mainContentType, upsert: false });
        if (upMain.error) throw new Error(`メディアアップロード失敗: ${upMain.error.message}`);

        const mainUrl = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(mainPath).data.publicUrl;

        // サムネ
        let thumbUrl: string | null = null;
        if (thumbBuffer && thumbPath) {
          const upThumb = await supabase.storage
            .from(STORAGE_BUCKET)
            .upload(thumbPath, thumbBuffer, { contentType: "image/webp", upsert: false });
          if (!upThumb.error) {
            thumbUrl = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(thumbPath).data.publicUrl;
          }
        }

        await supabase
          .from("therapist_diary_stories")
          .update({
            media_url: mainUrl,
            thumbnail_url: thumbUrl,
            file_size_bytes: fileSize,
            image_width: width,
            image_height: height,
          })
          .eq("id", storyId);

        return NextResponse.json({
          success: true,
          storyId,
          mediaUrl: mainUrl,
          thumbnailUrl: thumbUrl,
          expiresAt,
          visibility,
        });
      } else {
        // 動画: video upload API に転送して処理ジョブを作成
        // バリデーション
        const cleanBase64 = input.mediaBase64.replace(/^data:video\/[a-z0-9-]+;base64,/, "");
        const buffer = Buffer.from(cleanBase64, "base64");
        if (buffer.length > MAX_VIDEO_BYTES) {
          throw new Error(`動画サイズが上限(${MAX_VIDEO_BYTES / 1024 / 1024}MB)を超えています`);
        }
        if (input.videoDurationSec && input.videoDurationSec > MAX_VIDEO_SECONDS) {
          throw new Error(`動画は${MAX_VIDEO_SECONDS}秒以内にしてください`);
        }

        // Storage(raw) にアップロード + ジョブ作成
        const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://ange-spa.jp";
        const uploadRes = await fetch(`${baseUrl}/api/diary/video/upload`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            therapistId: input.therapistId,
            authToken: input.authToken,
            sourceType: "story",
            sourceId: storyId,
            videoBase64: input.mediaBase64,
            videoMime: input.mediaContentType,
            targetAspect: "9:16",  // ストーリーは縦動画
            estimatedDurationSec: input.videoDurationSec,
          }),
        });
        const uploadData = await uploadRes.json();
        if (!uploadRes.ok) {
          throw new Error(uploadData.error || "動画アップロード失敗");
        }
        videoJobId = uploadData.jobId;
        isProcessingVideo = true;

        // 仮メディアURLとして raw URL を入れておく (処理完了後に上書きされる)
        await supabase
          .from("therapist_diary_stories")
          .update({
            media_url: uploadData.rawUrl,
            file_size_bytes: buffer.length,
            video_processing_job_id: videoJobId,
          })
          .eq("id", storyId);

        return NextResponse.json({
          success: true,
          storyId,
          mediaUrl: uploadData.rawUrl,
          thumbnailUrl: null,
          expiresAt,
          visibility,
          isProcessingVideo,
          videoJobId,
          processingMessage: "動画を処理中です(数十秒〜1分)。完了するとストーリーに反映されます。",
        });
      }
    } catch (mediaErr) {
      // 失敗したら story を削除
      await supabase.from("therapist_diary_stories").delete().eq("id", storyId);
      const msg = mediaErr instanceof Error ? mediaErr.message : "メディア処理エラー";
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "不明なエラー";
    console.error("/api/diary/story/post error:", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
