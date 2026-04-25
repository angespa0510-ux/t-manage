import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://cbewozzdyjqmhzkxsjqo.supabase.co";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * 動画処理ジョブ状態確認
 *
 * GET ?jobId=xx  → 1ジョブ
 * GET ?therapistId=xx [&limit=20] → セラピストのジョブ一覧
 * GET ?staff=1 [&status=pending|processing|failed] → 管理画面用
 */

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const jobIdStr = url.searchParams.get("jobId");
    const therapistIdStr = url.searchParams.get("therapistId");
    const isStaff = url.searchParams.get("staff") === "1";
    const statusFilter = url.searchParams.get("status");
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "30"), 100);

    if (jobIdStr) {
      const { data, error } = await supabase
        .from("video_processing_jobs")
        .select("*")
        .eq("id", parseInt(jobIdStr))
        .maybeSingle();
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      if (!data) {
        return NextResponse.json({ error: "ジョブが見つかりません" }, { status: 404 });
      }
      return NextResponse.json({ job: formatJob(data) });
    }

    let query = supabase
      .from("video_processing_jobs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (therapistIdStr) {
      query = query.eq("therapist_id", parseInt(therapistIdStr));
    }
    if (statusFilter) {
      query = query.eq("status", statusFilter);
    }
    if (!therapistIdStr && !isStaff) {
      return NextResponse.json({ error: "therapistId か staff=1 が必要です" }, { status: 400 });
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      jobs: ((data || []) as unknown[]).map((j) => formatJob(j as Record<string, unknown>)),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "不明なエラー";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

function formatJob(j: Record<string, unknown>) {
  return {
    id: j.id,
    sourceType: j.source_type,
    sourceId: j.source_id,
    therapistId: j.therapist_id,
    status: j.status,
    rawUrl: j.raw_url,
    processedUrl: j.processed_url,
    thumbnailUrl: j.thumbnail_url,
    rawSizeBytes: j.raw_size_bytes,
    processedSizeBytes: j.processed_size_bytes,
    durationSec: j.duration_sec,
    width: j.width,
    height: j.height,
    codec: j.codec,
    targetAspect: j.target_aspect,
    attemptCount: j.attempt_count,
    maxAttempts: j.max_attempts,
    errorMessage: j.error_message,
    processingMs: j.processing_ms,
    processingStartedAt: j.processing_started_at,
    processingFinishedAt: j.processing_finished_at,
    createdAt: j.created_at,
  };
}
