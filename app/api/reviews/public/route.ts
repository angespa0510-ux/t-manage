import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * ═══════════════════════════════════════════════════════════
 * HP公開「お客様の声」取得API（認証不要）
 *
 * GET /api/reviews/public?limit=20&offset=0
 *
 * 返却対象:
 *   hp_published = true のレビューのみ
 *
 * 返却フィールド（個人情報を含まない最小限）:
 *   - id (レビュー識別)
 *   - displayName (例: "30代男性 Aさん")
 *   - rating
 *   - reviewText (final_review_text or good_points)
 *   - highlights
 *   - publishedAt
 *   - therapistName (選択肢: 表示するか伏せるかは要件次第)
 *
 * 設計書の絶対原則:
 *   お客様の身バレリスクへの最大限の配慮
 * ═══════════════════════════════════════════════════════════
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://cbewozzdyjqmhzkxsjqo.supabase.co";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(Number(searchParams.get("limit") || "20"), 100);
    const offset = Math.max(Number(searchParams.get("offset") || "0"), 0);
    const therapistId = Number(searchParams.get("therapistId") || "0");

    let query = supabase
      .from("customer_surveys")
      .select(`
        id,
        customer_id,
        therapist_id,
        rating_overall,
        highlights,
        good_points,
        final_review_text,
        hp_display_name,
        hp_publish_approved_at,
        therapist_reply,
        therapist_reply_at
      `, { count: "exact" })
      .eq("hp_published", true)
      .order("hp_publish_approved_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (therapistId) {
      query = query.eq("therapist_id", therapistId);
    }

    const { data: reviews, count } = await query;

    if (!reviews) {
      return NextResponse.json({ reviews: [], total: 0 });
    }

    // セラピスト情報を補完（photo_url含む）
    const therapistIds = Array.from(
      new Set(reviews.map((r) => r.therapist_id).filter((id): id is number => Boolean(id)))
    );
    let therapistMap: Record<number, { name: string; photo_url: string | null }> = {};
    if (therapistIds.length > 0) {
      const { data: therapists } = await supabase
        .from("therapists")
        .select("id, name, photo_url")
        .in("id", therapistIds);
      if (therapists) {
        therapistMap = Object.fromEntries(
          therapists.map((t) => [t.id, { name: t.name, photo_url: t.photo_url }])
        );
      }
    }

    return NextResponse.json({
      total: count || 0,
      reviews: reviews.map((r) => {
        const th = r.therapist_id ? therapistMap[r.therapist_id] : null;
        return {
          id: r.id,
          displayName: r.hp_display_name || "Aさま",
          rating: r.rating_overall || 0,
          reviewText: r.final_review_text || r.good_points || "",
          highlights: Array.isArray(r.highlights) ? r.highlights : [],
          publishedAt: r.hp_publish_approved_at,
          therapistId: r.therapist_id,
          therapistName: th?.name || "",
          therapistPhotoUrl: th?.photo_url || null,
          therapistReply: r.therapist_reply || null,
          therapistReplyAt: r.therapist_reply_at || null,
        };
      }),
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "エラーが発生しました";
    console.error("[reviews/public] error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
