import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * GET /api/survey/therapist-list?therapistId=N
 *
 * セラピストマイページ用：自分宛のアンケート（HP掲載承認済み）を取得
 *
 * - HP掲載承認済み(hp_published=true)のもののみ
 * - 返信済みも含む（一覧）
 * - 個人情報を含まない（hp_display_name のみ）
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://cbewozzdyjqmhzkxsjqo.supabase.co";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const therapistId = Number(searchParams.get("therapistId") || "0");

    if (!therapistId) {
      return NextResponse.json({ error: "therapistId が必要です" }, { status: 400 });
    }

    const { data: surveys } = await supabase
      .from("customer_surveys")
      .select(`
        id,
        rating_overall,
        highlights,
        good_points,
        improvement_points,
        therapist_message,
        final_review_text,
        hp_display_name,
        hp_publish_approved_at,
        therapist_reply,
        therapist_reply_at,
        therapist_notified_at,
        submitted_at
      `)
      .eq("therapist_id", therapistId)
      .eq("hp_published", true)
      .order("hp_publish_approved_at", { ascending: false });

    return NextResponse.json({
      reviews: (surveys || []).map((s) => ({
        id: s.id,
        rating: s.rating_overall || 0,
        highlights: Array.isArray(s.highlights) ? s.highlights : [],
        goodPoints: s.good_points || "",
        improvementPoints: s.improvement_points || "",
        therapistMessage: s.therapist_message || "",
        finalReviewText: s.final_review_text || "",
        displayName: s.hp_display_name || "Aさま",
        approvedAt: s.hp_publish_approved_at,
        therapistReply: s.therapist_reply || null,
        therapistReplyAt: s.therapist_reply_at || null,
        notifiedAt: s.therapist_notified_at,
        submittedAt: s.submitted_at,
      })),
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "エラーが発生しました";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
