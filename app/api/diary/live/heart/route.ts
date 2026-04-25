import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://cbewozzdyjqmhzkxsjqo.supabase.co";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * ライブハート送信 (連打可、デバウンスはクライアント側)
 *
 * Body: { streamId, customerId?, count? }
 *
 * count: 1リクエストでまとめて送る数 (1〜20)
 */
export async function POST(req: Request) {
  try {
    const { streamId, customerId, count = 1 } = await req.json();
    if (!streamId) {
      return NextResponse.json({ error: "streamId が必要です" }, { status: 400 });
    }

    const validCount = Math.max(1, Math.min(20, parseInt(String(count)) || 1));

    // ストリーム確認
    const { data: stream } = await supabase
      .from("live_streams")
      .select("id, status, heart_count_total")
      .eq("id", streamId)
      .maybeSingle();

    if (!stream || stream.status !== "live") {
      return NextResponse.json({ error: "配信中ではありません" }, { status: 410 });
    }

    // ハート記録
    await supabase.from("live_stream_hearts").insert({
      stream_id: streamId,
      customer_id: customerId || null,
      count: validCount,
    });

    // 統計更新
    await supabase
      .from("live_streams")
      .update({ heart_count_total: stream.heart_count_total + validCount })
      .eq("id", streamId);

    return NextResponse.json({
      success: true,
      heartCountTotal: stream.heart_count_total + validCount,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "不明なエラー";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
