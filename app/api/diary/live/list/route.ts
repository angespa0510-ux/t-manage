import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://cbewozzdyjqmhzkxsjqo.supabase.co";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * 配信中ライブ一覧 (HP用)
 *
 * GET ?customerId=xx (会員限定も含める) [&limit=20]
 *  または旧パラメータ ?memberAuth=xx も後方互換で受け付ける
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const customerId = url.searchParams.get("customerId");
    const memberAuth = url.searchParams.get("memberAuth"); // 後方互換
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "20"), 50);
    const isMember = !!customerId || !!memberAuth;

    let query = supabase
      .from("live_streams")
      .select("id, therapist_id, room_name, title, description, thumbnail_url, status, visibility, viewer_count_current, started_at")
      .in("status", ["live", "preparing"])
      .order("started_at", { ascending: false, nullsFirst: false })
      .limit(limit);

    if (!isMember) {
      query = query.eq("visibility", "public");
    }

    const { data: streams, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    type StreamRow = {
      id: number;
      therapist_id: number;
      room_name: string;
      title: string;
      description: string | null;
      thumbnail_url: string | null;
      status: string;
      visibility: string;
      viewer_count_current: number;
      started_at: string | null;
    };

    const rows = (streams || []) as StreamRow[];

    // セラピスト情報
    type TherapistLite = { id: number; name: string; photo_url: string | null };
    const therapistIds = Array.from(new Set(rows.map((r) => r.therapist_id)));
    const therapistMap = new Map<number, TherapistLite>();
    if (therapistIds.length > 0) {
      const { data: therapists } = await supabase
        .from("therapists")
        .select("id, name, photo_url")
        .in("id", therapistIds);
      if (therapists) {
        for (const t of therapists as TherapistLite[]) therapistMap.set(t.id, t);
      }
    }

    return NextResponse.json({
      streams: rows.map((r) => {
        const t = therapistMap.get(r.therapist_id);
        return {
          id: r.id,
          therapist: t
            ? { id: t.id, name: t.name, photoUrl: t.photo_url }
            : { id: r.therapist_id, name: "(削除済み)", photoUrl: null },
          roomName: r.room_name,
          title: r.title,
          description: r.description,
          thumbnailUrl: r.thumbnail_url,
          status: r.status,
          visibility: r.visibility,
          viewerCount: r.viewer_count_current,
          startedAt: r.started_at,
        };
      }),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "不明なエラー";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
