import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://cbewozzdyjqmhzkxsjqo.supabase.co";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * ライブ状態更新 (配信開始通知 / フィルター変更 / サムネ更新)
 *
 * PATCH { streamId, therapistId, authToken, status?, filterMode?, filterOptions?, thumbnailUrl?, title? }
 *
 * status の遷移:
 *   preparing → live (配信開始ボタン押下時)
 *   live → ended (終了時)
 */
export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { streamId, therapistId, authToken, status, filterMode, filterOptions, thumbnailUrl, title } = body;

    if (!streamId || !therapistId || !authToken) {
      return NextResponse.json({ error: "認証情報が必要です" }, { status: 401 });
    }

    // 認証
    const { data: t } = await supabase
      .from("therapists")
      .select("login_password, status")
      .eq("id", therapistId)
      .maybeSingle();
    if (!t || t.login_password !== authToken || t.status !== "active") {
      return NextResponse.json({ error: "認証エラー" }, { status: 401 });
    }

    // ストリーム所有者確認
    const { data: s } = await supabase
      .from("live_streams")
      .select("id, therapist_id, status, started_at")
      .eq("id", streamId)
      .maybeSingle();
    if (!s) {
      return NextResponse.json({ error: "ストリームが見つかりません" }, { status: 404 });
    }
    if (s.therapist_id !== therapistId) {
      return NextResponse.json({ error: "権限がありません" }, { status: 403 });
    }

    const updates: Record<string, unknown> = {};

    if (status === "live" && s.status === "preparing") {
      updates.status = "live";
      updates.started_at = new Date().toISOString();
    } else if (status === "ended" && (s.status === "live" || s.status === "preparing")) {
      updates.status = "ended";
      const endedAt = new Date().toISOString();
      updates.ended_at = endedAt;
      updates.end_reason = "self_end";
      if (s.started_at) {
        updates.duration_sec = Math.floor((new Date(endedAt).getTime() - new Date(s.started_at).getTime()) / 1000);
      }
    }

    if (typeof filterMode === "string") updates.filter_mode = filterMode;
    if (filterOptions && typeof filterOptions === "object") updates.filter_options = filterOptions;
    if (typeof thumbnailUrl === "string") updates.thumbnail_url = thumbnailUrl;
    if (typeof title === "string") updates.title = title.trim();

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ success: true, noChanges: true });
    }

    const { error } = await supabase.from("live_streams").update(updates).eq("id", streamId);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, updates });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "不明なエラー";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
