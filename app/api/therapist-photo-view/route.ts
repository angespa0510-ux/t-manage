import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://cbewozzdyjqmhzkxsjqo.supabase.co",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
);

/**
 * セラピスト写真アクセスログAPI
 *
 * POST /api/therapist-photo-view
 * body: {
 *   therapist_id: number,
 *   photo_index: number (0..4),
 *   view_type?: 'view' | 'thumb_click' | 'cta_clicked',
 *   is_member?: boolean,
 *   customer_id?: number | null,
 *   session_id?: string,
 * }
 *
 * 失敗してもUI には影響させない（fire-and-forget で呼ばれる）。
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const therapistId = Number(body.therapist_id);
    const photoIndex = Number(body.photo_index);
    if (!therapistId || isNaN(photoIndex) || photoIndex < 0 || photoIndex > 9) {
      return NextResponse.json({ error: "invalid params" }, { status: 400 });
    }
    const viewType = (body.view_type || "view").toString();
    if (!["view", "thumb_click", "cta_clicked"].includes(viewType)) {
      return NextResponse.json({ error: "invalid view_type" }, { status: 400 });
    }
    const isMember = Boolean(body.is_member);
    const customerId = body.customer_id ? Number(body.customer_id) : null;
    const sessionId = (body.session_id || "").toString().slice(0, 80);
    const ua = (req.headers.get("user-agent") || "").slice(0, 200);
    const referer = (req.headers.get("referer") || "").slice(0, 300);

    await supabase.from("therapist_photo_views").insert({
      therapist_id: therapistId,
      photo_index: photoIndex,
      view_type: viewType,
      is_member: isMember,
      customer_id: customerId,
      session_id: sessionId,
      user_agent: ua,
      referer: referer,
    });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * 集計取得API
 *
 * GET /api/therapist-photo-view?therapist_id=ID
 * → { counts: [{ photo_index, view_count, ... }] }
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const therapistIdStr = url.searchParams.get("therapist_id");
    const therapistId = Number(therapistIdStr);
    if (!therapistId) {
      return NextResponse.json({ error: "therapist_id required" }, { status: 400 });
    }
    const { data, error } = await supabase
      .from("therapist_photo_view_counts")
      .select("photo_index, view_count, view_count_member, view_count_public, thumb_click_count, cta_click_count, last_viewed_at")
      .eq("therapist_id", therapistId)
      .order("photo_index", { ascending: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ counts: data || [] });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
