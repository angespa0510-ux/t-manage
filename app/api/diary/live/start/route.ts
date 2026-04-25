import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { AccessToken } from "livekit-server-sdk";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://cbewozzdyjqmhzkxsjqo.supabase.co";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || "";
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || "";
const LIVEKIT_WS_URL = process.env.LIVEKIT_WS_URL || "";

/**
 * LiveKit ルーム作成 + 配信用トークン発行
 *
 * Body: {
 *   therapistId, authToken,
 *   title?, description?,
 *   visibility?: 'public' | 'members_only' (default: 'members_only'),
 *   filterMode?: 'none' | 'beauty' | 'stamp' | 'mosaic',
 *   filterOptions?: object,
 * }
 *
 * 返り値: {
 *   streamId, roomName, accessToken, wsUrl, identity
 * }
 *
 * 動作:
 *   1. セラピスト認証 + live_streaming_enabled=true 確認
 *   2. 既にlive中のものがあれば停止して新規作成 (1セラピスト1配信)
 *   3. live_streams レコード作成 (status='preparing')
 *   4. LiveKit AccessToken 発行 (canPublish: true)
 *   5. wsUrl + token を返す
 */

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      therapistId,
      authToken,
      title = "",
      description = "",
      visibility = "members_only",
      filterMode = "none",
      filterOptions = {},
    } = body;

    if (!therapistId || !authToken) {
      return NextResponse.json({ error: "認証情報が必要です" }, { status: 401 });
    }

    if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET || !LIVEKIT_WS_URL) {
      return NextResponse.json({
        error: "LiveKit が設定されていません",
        hint: "Vercel環境変数 LIVEKIT_API_KEY, LIVEKIT_API_SECRET, LIVEKIT_WS_URL を設定してください",
      }, { status: 500 });
    }

    // 1. セラピスト認証 + 配信許可確認
    const { data: t } = await supabase
      .from("therapists")
      .select("id, name, login_password, status, live_streaming_enabled")
      .eq("id", therapistId)
      .maybeSingle();

    if (!t || t.login_password !== authToken || t.status !== "active") {
      return NextResponse.json({ error: "認証エラー" }, { status: 401 });
    }
    if (!t.live_streaming_enabled) {
      return NextResponse.json({
        error: "ライブ配信機能が許可されていません",
        hint: "管理者にお問い合わせください",
      }, { status: 403 });
    }

    // 2. 既にlive中のものがあれば終了
    await supabase
      .from("live_streams")
      .update({
        status: "ended",
        ended_at: new Date().toISOString(),
        end_reason: "self_end",
      })
      .eq("therapist_id", therapistId)
      .in("status", ["preparing", "live"]);

    // 3. ルーム名生成 (LiveKit 上で識別される)
    const ts = Date.now();
    const roomName = `live_t${therapistId}_${ts}`;

    // 4. live_streams レコード作成
    const { data: stream, error: insErr } = await supabase
      .from("live_streams")
      .insert({
        therapist_id: therapistId,
        room_name: roomName,
        title: title.trim() || `${t.name}のライブ配信`,
        description: description.trim(),
        visibility: visibility === "public" ? "public" : "members_only",
        filter_mode: filterMode,
        filter_options: filterOptions,
        status: "preparing",
      })
      .select("id, room_name")
      .single();

    if (insErr || !stream) {
      console.error("live_streams insert error:", insErr);
      return NextResponse.json({
        error: `ルーム作成に失敗しました: ${insErr?.message || "不明なエラー"}`,
        details: insErr ? { code: insErr.code, hint: insErr.hint, details: insErr.details } : null,
      }, { status: 500 });
    }

    // 5. LiveKit AccessToken 発行 (配信者用、canPublish=true)
    const identity = `therapist_${therapistId}`;
    const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity,
      name: t.name,
      ttl: "2h",  // 2時間
    });
    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    const accessToken = await at.toJwt();

    return NextResponse.json({
      success: true,
      streamId: stream.id,
      roomName: stream.room_name,
      accessToken,
      wsUrl: LIVEKIT_WS_URL,
      identity,
      therapistName: t.name,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "不明なエラー";
    console.error("/api/diary/live/start error:", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
