import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://cbewozzdyjqmhzkxsjqo.supabase.co";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

const RAW_BUCKET = "therapist-videos-raw";
const MAX_VIDEO_BYTES = 100 * 1024 * 1024; // 100MB
const MAX_DURATION_SEC = 60; // 1分まで (将来日記用)
const ALLOWED_MIME = ["video/mp4", "video/quicktime", "video/x-m4v"];

/**
 * 動画アップロード + 処理ジョブ作成
 *
 * Body: {
 *   therapistId: number,
 *   authToken: string,
 *   sourceType: 'story' | 'diary' | 'mypage',
 *   sourceId?: number,            // ストーリー/日記の関連ID
 *   videoBase64: string,          // base64データURL
 *   videoMime: string,            // 'video/mp4' | 'video/quicktime' など
 *   targetAspect?: '9:16' | '16:9' | 'original',
 *   estimatedDurationSec?: number, // クライアント側で計測 (任意)
 * }
 *
 * Response: {
 *   success: true,
 *   jobId: number,
 *   rawUrl: string,
 *   message: '処理を開始しました' | '処理を開始しました(完了次第URLが利用可能になります)'
 * }
 *
 * 処理:
 *   1. セラピスト認証
 *   2. base64 をデコードしてサイズチェック
 *   3. Storage `therapist-videos-raw` に upload
 *   4. video_processing_jobs に insert (status='pending')
 *   5. /api/diary/video/process-job を fire-and-forget でキック
 */

async function verifyTherapist(therapistId: number, authToken: string): Promise<boolean> {
  const { data } = await supabase
    .from("therapists")
    .select("id, login_password, status")
    .eq("id", therapistId)
    .maybeSingle();
  return !!data && data.login_password === authToken && data.status === "active";
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      therapistId,
      authToken,
      sourceType,
      sourceId,
      videoBase64,
      videoMime,
      targetAspect = "original",
      estimatedDurationSec,
    } = body;

    // バリデーション
    if (!therapistId || !authToken) {
      return NextResponse.json({ error: "認証情報が必要です" }, { status: 401 });
    }
    if (!videoBase64 || typeof videoBase64 !== "string") {
      return NextResponse.json({ error: "動画データが必要です" }, { status: 400 });
    }
    if (!sourceType || !["story", "diary", "mypage"].includes(sourceType)) {
      return NextResponse.json({ error: "sourceType が不正です" }, { status: 400 });
    }
    if (!videoMime || !ALLOWED_MIME.includes(videoMime)) {
      return NextResponse.json({ error: "対応していない動画形式です。MP4 か MOV (QuickTime) のみ" }, { status: 400 });
    }
    if (estimatedDurationSec && estimatedDurationSec > MAX_DURATION_SEC) {
      return NextResponse.json({ error: `動画は${MAX_DURATION_SEC}秒以内にしてください` }, { status: 400 });
    }

    // 認証
    if (!(await verifyTherapist(therapistId, authToken))) {
      return NextResponse.json({ error: "認証に失敗しました" }, { status: 401 });
    }

    // base64 → Buffer (data URLプレフィックス除去)
    const cleanBase64 = videoBase64.replace(/^data:video\/[a-z0-9-]+;base64,/, "");
    const buffer = Buffer.from(cleanBase64, "base64");

    if (buffer.length > MAX_VIDEO_BYTES) {
      return NextResponse.json({
        error: `動画サイズが上限(${MAX_VIDEO_BYTES / 1024 / 1024}MB)を超えています`,
      }, { status: 413 });
    }

    // 拡張子決定
    const ext = videoMime === "video/mp4" ? "mp4" : "mov";
    const ts = Date.now();
    const rawPath = `${therapistId}/${sourceType}/${ts}_raw.${ext}`;

    // Storage にアップロード
    const upRes = await supabase.storage
      .from(RAW_BUCKET)
      .upload(rawPath, buffer, { contentType: videoMime, upsert: false });

    if (upRes.error) {
      console.error("raw video upload error:", upRes.error);
      return NextResponse.json({ error: `アップロード失敗: ${upRes.error.message}` }, { status: 500 });
    }

    // 生ファイルの公開URL (一時参照用、処理後に削除予定)
    const rawUrl = supabase.storage.from(RAW_BUCKET).getPublicUrl(rawPath).data.publicUrl;

    // ジョブ作成
    const { data: job, error: jobErr } = await supabase
      .from("video_processing_jobs")
      .insert({
        source_type: sourceType,
        source_id: sourceId || null,
        therapist_id: therapistId,
        raw_storage_bucket: RAW_BUCKET,
        raw_storage_path: rawPath,
        raw_url: rawUrl,
        raw_size_bytes: buffer.length,
        raw_mime_type: videoMime,
        status: "pending",
        target_aspect: targetAspect,
        target_max_height: targetAspect === "9:16" ? 1280 : 1080,
      })
      .select("id")
      .single();

    if (jobErr || !job) {
      // ジョブ作成失敗 → アップロード済みファイルを削除
      await supabase.storage.from(RAW_BUCKET).remove([rawPath]).catch(() => {});
      return NextResponse.json({ error: "処理ジョブの作成に失敗しました" }, { status: 500 });
    }

    // fire-and-forget で処理API呼び出し
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://ange-spa.jp";
    fetch(`${baseUrl}/api/diary/video/process-job`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId: job.id }),
    }).catch((e) => console.error("process-job trigger failed:", e));

    return NextResponse.json({
      success: true,
      jobId: job.id,
      rawUrl,
      message: "アップロード完了。処理中です(数十秒〜数分)",
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "不明なエラー";
    console.error("/api/diary/video/upload error:", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
