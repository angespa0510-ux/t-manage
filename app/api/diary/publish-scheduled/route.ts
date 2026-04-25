import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://cbewozzdyjqmhzkxsjqo.supabase.co";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * 予約投稿の自動公開 (Vercel Cron で5分ごと呼ぶ)
 *
 * 処理:
 *   1. status='scheduled' && scheduled_at <= now() を取得
 *   2. status='published' に更新 + published_at = now()
 *   3. 駅ちか送信トリガー (sendToEkichika な場合のみ)
 *   4. お気に入り会員へ push 通知
 */
export async function GET(req: Request) {
  // Vercel Cron 認証 (任意)
  const authHeader = req.headers.get("authorization");
  const expectedSecret = process.env.CRON_SECRET;
  if (expectedSecret && authHeader !== `Bearer ${expectedSecret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();

    // 公開対象を取得
    const { data: due, error: e1 } = await supabase
      .from("therapist_diary_entries")
      .select("id, send_to_ekichika, visibility, scheduled_at")
      .eq("status", "scheduled")
      .lte("scheduled_at", now.toISOString())
      .is("deleted_at", null)
      .order("scheduled_at", { ascending: true })
      .limit(50);

    if (e1) {
      return NextResponse.json({ error: e1.message }, { status: 500 });
    }

    type DueRow = {
      id: number;
      send_to_ekichika: boolean;
      visibility: string;
      scheduled_at: string;
    };
    const rows = (due || []) as DueRow[];

    if (rows.length === 0) {
      return NextResponse.json({ success: true, publishedCount: 0, message: "対象なし" });
    }

    let publishedCount = 0;
    let ekichikaTriggered = 0;
    let notifyTriggered = 0;
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://t-manage.vercel.app";

    for (const entry of rows) {
      // ステータス更新 → published に
      const { error: updErr } = await supabase
        .from("therapist_diary_entries")
        .update({
          status: "published",
          published_at: now.toISOString(),
          // 駅ちか送信フラグも切り替え (scheduled → pending)
          ekichika_dispatch_status: entry.send_to_ekichika && entry.visibility === "public"
            ? "pending"
            : "skipped",
        })
        .eq("id", entry.id)
        .eq("status", "scheduled"); // 同時実行による二重公開防止

      if (updErr) {
        console.error(`publish update failed for entry ${entry.id}:`, updErr);
        continue;
      }
      publishedCount++;

      // 駅ちか送信トリガー (非同期、awaitしない)
      if (entry.send_to_ekichika && entry.visibility === "public") {
        fetch(`${baseUrl}/api/diary/dispatch-ekichika`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ entryId: entry.id }),
        }).catch((e) => console.error(`dispatch trigger ${entry.id}:`, e));
        ekichikaTriggered++;
      }

      // お気に入り会員へ push 通知 (非同期)
      fetch(`${baseUrl}/api/diary/notify-favorites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryId: entry.id }),
      }).catch((e) => console.error(`notify trigger ${entry.id}:`, e));
      notifyTriggered++;

      // Bluesky 自動投稿 (非同期、公開記事のみ)
      if (entry.visibility === "public") {
        fetch(`${baseUrl}/api/diary/bluesky/post`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ entryId: entry.id }),
        }).catch((e) => console.error(`bluesky trigger ${entry.id}:`, e));
      }
    }

    return NextResponse.json({
      success: true,
      foundCount: rows.length,
      publishedCount,
      ekichikaTriggered,
      notifyTriggered,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "不明なエラー";
    console.error("/api/diary/publish-scheduled error:", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export const POST = GET;
