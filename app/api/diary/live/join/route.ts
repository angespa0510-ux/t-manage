import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { AccessToken } from "livekit-server-sdk";
import crypto from "crypto";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://cbewozzdyjqmhzkxsjqo.supabase.co";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || "";
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || "";
const LIVEKIT_WS_URL = process.env.LIVEKIT_WS_URL || "";

/**
 * 視聴用トークン発行 (お客様用、canPublish=false)
 *
 * Body: { streamId, customerId? }
 *
 * 動作:
 *   1. ストリーム取得 + status=live 確認
 *   2. visibility=members_only なら customerId 必須
 *   3. LiveKit AccessToken 発行 (canSubscribe only)
 *   4. live_stream_views に視聴記録
 */
export async function POST(req: Request) {
  try {
    const { streamId, customerId } = await req.json();

    if (!streamId) {
      return NextResponse.json({ error: "streamId が必要です" }, { status: 400 });
    }

    if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET || !LIVEKIT_WS_URL) {
      return NextResponse.json({ error: "LiveKit が設定されていません" }, { status: 500 });
    }

    // 1. ストリーム取得
    const { data: stream } = await supabase
      .from("live_streams")
      .select("id, therapist_id, room_name, status, visibility, title")
      .eq("id", streamId)
      .maybeSingle();

    if (!stream) {
      return NextResponse.json({ error: "ストリームが見つかりません" }, { status: 404 });
    }
    if (stream.status !== "live" && stream.status !== "preparing") {
      return NextResponse.json({ error: "配信は終了しています" }, { status: 410 });
    }

    // セラピスト名取得 (UI表示用)
    const { data: therapist } = await supabase
      .from("therapists")
      .select("name")
      .eq("id", stream.therapist_id)
      .maybeSingle();
    const therapistName = therapist?.name || "セラピスト";

    // 2. 会員限定チェック
    if (stream.visibility === "members_only") {
      if (!customerId) {
        return NextResponse.json({ error: "会員ログインが必要です", requiresMembership: true }, { status: 401 });
      }
      const { data: customer } = await supabase
        .from("customers")
        .select("id")
        .eq("id", customerId)
        .maybeSingle();
      if (!customer) {
        return NextResponse.json({ error: "会員が見つかりません" }, { status: 401 });
      }
    }

    // 3. identity 生成 (匿名でも一意になるよう)
    let identity: string;
    let displayName: string;
    if (customerId) {
      const { data: c } = await supabase
        .from("customers")
        .select("self_name, name")
        .eq("id", customerId)
        .maybeSingle();
      identity = `customer_${customerId}`;
      displayName = c?.self_name || (c?.name ? `${c.name.charAt(0)}***` : "ゲストさん");
    } else {
      // 非会員: ランダムID
      identity = `guest_${crypto.randomBytes(6).toString("hex")}`;
      displayName = "ゲストさん";
    }

    // 4. LiveKit AccessToken 発行 (視聴専用)
    const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity,
      name: displayName,
      ttl: "2h",
    });
    at.addGrant({
      roomJoin: true,
      room: stream.room_name,
      canPublish: false,
      canSubscribe: true,
      canPublishData: true, // ハート/コメント送信用
    });

    const accessToken = await at.toJwt();

    // 5. 視聴記録
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "0.0.0.0";
    const ipHash = crypto.createHash("sha256").update(ip).digest("hex").slice(0, 32);

    await supabase.from("live_stream_views").insert({
      stream_id: streamId,
      customer_id: customerId || null,
      ip_hash: ipHash,
    });

    // 6. 視聴者数+1 (current/peak/total)
    const { data: cur } = await supabase
      .from("live_streams")
      .select("viewer_count_current, viewer_count_peak, viewer_count_total")
      .eq("id", streamId)
      .maybeSingle();

    if (cur) {
      const newCurrent = cur.viewer_count_current + 1;
      await supabase
        .from("live_streams")
        .update({
          viewer_count_current: newCurrent,
          viewer_count_peak: Math.max(cur.viewer_count_peak, newCurrent),
          viewer_count_total: cur.viewer_count_total + 1,
        })
        .eq("id", streamId);
    }

    return NextResponse.json({
      success: true,
      streamId,
      roomName: stream.room_name,
      title: stream.title,
      therapistName,
      accessToken,
      wsUrl: LIVEKIT_WS_URL,
      identity,
      displayName,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "不明なエラー";
    console.error("/api/diary/live/join error:", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * 視聴離脱 (視聴者数 -1)
 *
 * Body: { streamId }
 */
export async function DELETE(req: Request) {
  try {
    const { streamId } = await req.json();
    if (!streamId) {
      return NextResponse.json({ error: "streamId が必要です" }, { status: 400 });
    }

    const { data: cur } = await supabase
      .from("live_streams")
      .select("viewer_count_current")
      .eq("id", streamId)
      .maybeSingle();

    if (cur && cur.viewer_count_current > 0) {
      await supabase
        .from("live_streams")
        .update({ viewer_count_current: cur.viewer_count_current - 1 })
        .eq("id", streamId);
    }

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "不明なエラー";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
