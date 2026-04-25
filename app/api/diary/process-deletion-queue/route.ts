import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://cbewozzdyjqmhzkxsjqo.supabase.co";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

const MAX_BATCH = 50;
const MAX_RETRY = 3;

/**
 * Storage削除キュー実行 (Vercel Cron で1日1回呼ぶ)
 *
 * scheduled_delete_at < now && status='pending' な対象を物理削除
 * 失敗したら attempted_count++ で再試行余地を残す
 */
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  const expectedSecret = process.env.CRON_SECRET;
  if (expectedSecret && authHeader !== `Bearer ${expectedSecret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    // 削除対象取得
    const { data: queue, error: qErr } = await supabase
      .from("storage_deletion_queue")
      .select("id, storage_bucket, storage_path, attempted_count, related_type, related_id")
      .eq("status", "pending")
      .lt("scheduled_delete_at", new Date().toISOString())
      .lt("attempted_count", MAX_RETRY)
      .order("scheduled_delete_at", { ascending: true })
      .limit(MAX_BATCH);

    if (qErr) {
      return NextResponse.json({ error: qErr.message }, { status: 500 });
    }

    type QueueRow = {
      id: number;
      storage_bucket: string;
      storage_path: string;
      attempted_count: number;
      related_type: string | null;
      related_id: number | null;
    };

    const items = (queue || []) as QueueRow[];

    if (items.length === 0) {
      return NextResponse.json({ success: true, processed: 0, message: "削除対象なし" });
    }

    let succeeded = 0;
    let failed = 0;

    for (const item of items) {
      try {
        // Storage から物理削除
        const { error: rmErr } = await supabase.storage
          .from(item.storage_bucket)
          .remove([item.storage_path]);

        if (rmErr && !rmErr.message?.includes("not found")) {
          // not found 以外のエラーはリトライ
          await supabase
            .from("storage_deletion_queue")
            .update({
              attempted_count: item.attempted_count + 1,
              last_error: rmErr.message,
              status: item.attempted_count + 1 >= MAX_RETRY ? "failed" : "pending",
            })
            .eq("id", item.id);
          failed++;
          continue;
        }

        // 成功
        await supabase
          .from("storage_deletion_queue")
          .update({
            status: "completed",
            completed_at: new Date().toISOString(),
          })
          .eq("id", item.id);

        // ストーリーの場合は storage_deleted_at をマーク
        if (item.related_type === "story" && item.related_id) {
          await supabase
            .from("therapist_diary_stories")
            .update({ storage_deleted_at: new Date().toISOString() })
            .eq("id", item.related_id);
        }

        succeeded++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "不明なエラー";
        await supabase
          .from("storage_deletion_queue")
          .update({
            attempted_count: item.attempted_count + 1,
            last_error: msg,
            status: item.attempted_count + 1 >= MAX_RETRY ? "failed" : "pending",
          })
          .eq("id", item.id);
        failed++;
      }
    }

    return NextResponse.json({
      success: true,
      processed: items.length,
      succeeded,
      failed,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "不明なエラー";
    console.error("/api/diary/process-deletion-queue error:", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export const POST = GET;
