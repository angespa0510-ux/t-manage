import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * GET /api/reviews/therapists
 *
 * HP掲載中のレビューがあるセラピストの一覧を返す（絞り込みプルダウン用）
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://cbewozzdyjqmhzkxsjqo.supabase.co";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET() {
  try {
    // hp_published=true のレビューを持つ therapist_id を取得
    const { data: surveys } = await supabase
      .from("customer_surveys")
      .select("therapist_id, rating_overall")
      .eq("hp_published", true);

    if (!surveys || surveys.length === 0) {
      return NextResponse.json({ therapists: [] });
    }

    // セラピストごとに集計
    const map: Record<number, { count: number; sum: number }> = {};
    surveys.forEach((s) => {
      if (!s.therapist_id) return;
      if (!map[s.therapist_id]) map[s.therapist_id] = { count: 0, sum: 0 };
      map[s.therapist_id].count++;
      map[s.therapist_id].sum += s.rating_overall || 0;
    });

    const therapistIds = Object.keys(map).map(Number);
    if (therapistIds.length === 0) {
      return NextResponse.json({ therapists: [] });
    }

    const { data: therapists } = await supabase
      .from("therapists")
      .select("id, name, photo_url")
      .in("id", therapistIds)
      .order("sort_order");

    return NextResponse.json({
      therapists: (therapists || []).map((t) => ({
        id: t.id,
        name: t.name,
        photoUrl: t.photo_url,
        reviewCount: map[t.id]?.count || 0,
        avgRating: map[t.id]?.count ? map[t.id].sum / map[t.id].count : 0,
      })),
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "エラーが発生しました";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
