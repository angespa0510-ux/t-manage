import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://cbewozzdyjqmhzkxsjqo.supabase.co";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * 期限切れストーリー自動処理 (Vercel Cron で15分ごと呼ぶ)
 *
 * 1. status='active' && expires_at < now のストーリーを 'expired' に更新
 * 2. メディアファイルを storage_deletion_queue に登録 (即時削除対象)
 *
 * SQL関数 expire_old_stories() を使用
 */
export async function GET(req: Request) {
  // Vercel Cron からのリクエスト確認 (任意)
  const authHeader = req.headers.get("authorization");
  const expectedSecret = process.env.CRON_SECRET;
  if (expectedSecret && authHeader !== `Bearer ${expectedSecret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    // 期限切れマーク
    const { data: expired, error: e1 } = await supabase
      .from("therapist_diary_stories")
      .update({ status: "expired" })
      .eq("status", "active")
      .lt("expires_at", new Date().toISOString())
      .select("id, media_url, therapist_id");

    if (e1) {
      return NextResponse.json({ error: e1.message }, { status: 500 });
    }

    type Row = { id: number; media_url: string | null; therapist_id: number };
    const expiredRows = (expired || []) as Row[];

    // 削除キューに登録 (重複防止のため、既存をチェック)
    let queuedCount = 0;
    for (const story of expiredRows) {
      if (!story.media_url) continue;
      const m = story.media_url.match(/\/therapist-stories\/(.+)$/);
      if (!m) continue;

      // 既に削除キューにある場合はスキップ
      const { data: existing } = await supabase
        .from("storage_deletion_queue")
        .select("id")
        .eq("related_type", "story")
        .eq("related_id", story.id)
        .eq("status", "pending")
        .maybeSingle();
      if (existing) continue;

      await supabase.from("storage_deletion_queue").insert({
        storage_bucket: "therapist-stories",
        storage_path: m[1],
        related_type: "story",
        related_id: story.id,
        therapist_id: story.therapist_id,
        scheduled_delete_at: new Date().toISOString(),
        reason: "story_expired",
      });
      queuedCount++;
    }

    return NextResponse.json({
      success: true,
      expiredCount: expiredRows.length,
      queuedCount,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "不明なエラー";
    console.error("/api/diary/cleanup-stories error:", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// POST も同じ処理 (手動実行用)
export const POST = GET;
