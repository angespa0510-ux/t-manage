import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { promises as fs } from "fs";
import {
  probeVideo,
  reencodeVideo,
  generateThumbnail,
  makeTmpPath,
  cleanupTmpFiles,
  downloadToTmp,
} from "../../../../../lib/video-processor";

// Vercel Pro での 5分制限を活用
export const maxDuration = 300;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://cbewozzdyjqmhzkxsjqo.supabase.co";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

const PROCESSED_BUCKET = "therapist-videos";

/**
 * 動画処理実行 API
 *
 * Body: { jobId }
 *
 * 処理:
 *   1. ジョブ取得 + status='processing' に更新
 *   2. raw を Storage からダウンロード
 *   3. ffprobe でメタデータ取得
 *   4. ffmpeg でリエンコード (MP4 + H.264 + AAC)
 *   5. サムネ生成
 *   6. processed と thumbnail を Storage にアップロード
 *   7. ジョブを status='completed' に更新
 *   8. ストーリー/日記の参照URL を更新
 *   9. raw ファイルを削除 (容量節約)
 *
 * エラー時:
 *   - attempt_count++ で最大2回までリトライ可
 *   - max_attempts を超えたら status='failed'
 */

type JobRow = {
  id: number;
  source_type: string;
  source_id: number | null;
  therapist_id: number;
  raw_storage_bucket: string;
  raw_storage_path: string;
  raw_url: string;
  raw_size_bytes: number;
  status: string;
  attempt_count: number;
  max_attempts: number;
  target_aspect: string | null;
  target_max_height: number;
  target_video_bitrate: string;
  target_audio_bitrate: string;
};

export async function POST(req: Request) {
  // CRON_SECRET 認証 (cron からの呼び出し時)
  const authHeader = req.headers.get("authorization");
  const expectedSecret = process.env.CRON_SECRET;
  if (expectedSecret && authHeader && authHeader !== `Bearer ${expectedSecret}`) {
    // 認証ヘッダーがあるが間違っている場合のみエラー
    // (fire-and-forget の通常呼び出しはヘッダー無し)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let jobId: number | null = null;
  let rawTmpPath: string | null = null;
  let processedTmpPath: string | null = null;
  let thumbnailTmpPath: string | null = null;

  try {
    const body = await req.json();
    jobId = body.jobId;
    if (!jobId) {
      return NextResponse.json({ error: "jobId が必要です" }, { status: 400 });
    }

    // 1. ジョブ取得
    const { data: jobRow } = await supabase
      .from("video_processing_jobs")
      .select("*")
      .eq("id", jobId)
      .maybeSingle();

    const job = jobRow as JobRow | null;
    if (!job) {
      return NextResponse.json({ error: "ジョブが見つかりません" }, { status: 404 });
    }

    if (job.status === "completed") {
      return NextResponse.json({ success: true, alreadyCompleted: true });
    }

    if (job.attempt_count >= job.max_attempts) {
      return NextResponse.json({ error: "リトライ上限に達しています" }, { status: 400 });
    }

    // 2. status='processing' に更新 + 競合制御 (status='pending' のもののみ更新)
    const { error: updErr, count } = await supabase
      .from("video_processing_jobs")
      .update({
        status: "processing",
        attempt_count: job.attempt_count + 1,
        processing_started_at: new Date().toISOString(),
      }, { count: "exact" })
      .eq("id", jobId)
      .in("status", ["pending", "failed"]);  // failed もリトライ可

    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 500 });
    }
    if (count === 0) {
      // 既に他プロセスが処理中
      return NextResponse.json({ success: true, alreadyProcessing: true });
    }

    const startMs = Date.now();

    // 3. raw を /tmp にダウンロード
    rawTmpPath = await downloadToTmp(job.raw_url, ".tmp");

    // 4. メタデータ取得
    const meta = await probeVideo(rawTmpPath);

    // 5. リエンコード
    processedTmpPath = makeTmpPath(".mp4");
    await reencodeVideo({
      inputPath: rawTmpPath,
      outputPath: processedTmpPath,
      aspect: (job.target_aspect as "9:16" | "16:9" | "original") || "original",
      maxHeight: job.target_max_height,
      videoBitrate: job.target_video_bitrate,
      audioBitrate: job.target_audio_bitrate,
    });

    // 6. サムネ生成 (1秒目のフレーム)
    thumbnailTmpPath = makeTmpPath(".jpg");
    await generateThumbnail(processedTmpPath, thumbnailTmpPath, {
      atSec: Math.min(1, Math.max(0, meta.durationSec - 0.5)),
      width: 720,
    });

    // 7. Storage にアップロード
    const ts = Date.now();
    const processedPath = `${job.therapist_id}/${job.source_type}/${ts}_processed.mp4`;
    const thumbnailPath = `${job.therapist_id}/${job.source_type}/${ts}_thumb.jpg`;

    const processedBuffer = await fs.readFile(processedTmpPath);
    const thumbnailBuffer = await fs.readFile(thumbnailTmpPath);

    const upMain = await supabase.storage
      .from(PROCESSED_BUCKET)
      .upload(processedPath, processedBuffer, { contentType: "video/mp4", upsert: false });
    if (upMain.error) {
      throw new Error(`動画アップロード失敗: ${upMain.error.message}`);
    }

    const upThumb = await supabase.storage
      .from(PROCESSED_BUCKET)
      .upload(thumbnailPath, thumbnailBuffer, { contentType: "image/jpeg", upsert: false });
    if (upThumb.error) {
      console.warn(`サムネアップロード失敗 (続行): ${upThumb.error.message}`);
    }

    const processedUrl = supabase.storage.from(PROCESSED_BUCKET).getPublicUrl(processedPath).data.publicUrl;
    const thumbnailUrl = upThumb.error
      ? null
      : supabase.storage.from(PROCESSED_BUCKET).getPublicUrl(thumbnailPath).data.publicUrl;

    const processingMs = Date.now() - startMs;

    // 8. ジョブ完了
    await supabase
      .from("video_processing_jobs")
      .update({
        status: "completed",
        processed_storage_bucket: PROCESSED_BUCKET,
        processed_storage_path: processedPath,
        processed_url: processedUrl,
        processed_size_bytes: processedBuffer.length,
        thumbnail_storage_path: thumbnailUrl ? thumbnailPath : null,
        thumbnail_url: thumbnailUrl,
        duration_sec: meta.durationSec,
        width: meta.width,
        height: meta.height,
        codec: meta.codec,
        framerate: meta.framerate,
        processing_finished_at: new Date().toISOString(),
        processing_ms: processingMs,
        error_message: null,
        error_code: null,
      })
      .eq("id", jobId);

    // 9. ソース別の参照URL更新
    if (job.source_type === "story" && job.source_id) {
      await supabase
        .from("therapist_diary_stories")
        .update({
          media_url: processedUrl,
          thumbnail_url: thumbnailUrl,
          video_processing_job_id: jobId,
          file_size_bytes: processedBuffer.length,
          video_duration_sec: meta.durationSec,
          video_width: meta.width,
          video_height: meta.height,
        })
        .eq("id", job.source_id);
    }
    // diary 用は将来追加

    // 10. raw ファイル削除 (容量節約)
    await supabase.storage
      .from(job.raw_storage_bucket)
      .remove([job.raw_storage_path])
      .catch(() => {});

    return NextResponse.json({
      success: true,
      jobId,
      processedUrl,
      thumbnailUrl,
      durationSec: meta.durationSec,
      processingMs,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "不明なエラー";
    console.error(`/api/diary/video/process-job (jobId=${jobId}) error:`, e);

    // ジョブを failed に
    if (jobId) {
      const { data: cur } = await supabase
        .from("video_processing_jobs")
        .select("attempt_count, max_attempts")
        .eq("id", jobId)
        .maybeSingle();

      const finalStatus = cur && cur.attempt_count >= cur.max_attempts ? "failed" : "pending";

      await supabase
        .from("video_processing_jobs")
        .update({
          status: finalStatus,
          error_message: msg,
          error_code: "process_error",
          processing_finished_at: new Date().toISOString(),
        })
        .eq("id", jobId);
    }

    return NextResponse.json({ error: msg }, { status: 500 });
  } finally {
    // 一時ファイルを必ず削除
    const cleanups: string[] = [];
    if (rawTmpPath) cleanups.push(rawTmpPath);
    if (processedTmpPath) cleanups.push(processedTmpPath);
    if (thumbnailTmpPath) cleanups.push(thumbnailTmpPath);
    if (cleanups.length > 0) {
      cleanupTmpFiles(...cleanups).catch(() => {});
    }
  }
}

// Cron からも呼べるよう GET 対応 (pending を1件処理)
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  const expectedSecret = process.env.CRON_SECRET;
  if (expectedSecret && authHeader !== `Bearer ${expectedSecret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // pending な最古のジョブを1件取得
  const { data: pending } = await supabase
    .from("video_processing_jobs")
    .select("id")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!pending) {
    return NextResponse.json({ success: true, message: "対象なし" });
  }

  // 処理 (POST と同じ処理を呼ぶ)
  const fakeReq = new Request(req.url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jobId: pending.id }),
  });
  return POST(fakeReq);
}
