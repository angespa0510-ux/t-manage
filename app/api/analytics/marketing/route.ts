import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://cbewozzdyjqmhzkxsjqo.supabase.co";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * 集客分析ダッシュボード API
 *
 * GET ?period=7d|30d|90d|month|year (デフォルト 30d)
 *
 * 返り値: 全部の集計を一括取得 (ページ内リクエスト数を減らすため)
 */

function getPeriodRange(period: string): { since: Date; label: string } {
  const now = new Date();
  const since = new Date();
  let label = "過去30日間";
  if (period === "7d") {
    since.setDate(since.getDate() - 7);
    label = "過去7日間";
  } else if (period === "90d") {
    since.setDate(since.getDate() - 90);
    label = "過去90日間";
  } else if (period === "month") {
    since.setMonth(since.getMonth() - 1);
    label = "今月";
  } else if (period === "year") {
    since.setFullYear(since.getFullYear() - 1);
    label = "過去1年";
  } else {
    since.setDate(since.getDate() - 30);
  }
  return { since, label };
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const period = url.searchParams.get("period") || "30d";
    const { since, label } = getPeriodRange(period);
    const sinceIso = since.toISOString();
    const sinceDate = since.toISOString().slice(0, 10);

    // ─────────────────────────────────────────────────────────
    // 1. 売上・予約サマリー
    // ─────────────────────────────────────────────────────────
    const { data: reservations } = await supabase
      .from("reservations")
      .select("id, total_price, status, customer_name, date, created_at")
      .gte("date", sinceDate)
      .order("date", { ascending: false });

    type Res = {
      id: number; total_price: number; status: string;
      customer_name: string; date: string; created_at: string;
    };
    const reList = (reservations || []) as Res[];
    const completedReservations = reList.filter((r) => r.status === "completed");
    const totalRevenue = completedReservations.reduce((s, r) => s + (r.total_price || 0), 0);

    // ─────────────────────────────────────────────────────────
    // 2. 顧客 (新規/リピート)
    // ─────────────────────────────────────────────────────────
    const { count: newCustomersCount } = await supabase
      .from("customers")
      .select("id", { count: "exact", head: true })
      .gte("created_at", sinceIso);

    const { data: activeCustomers } = await supabase
      .from("customers")
      .select("id, last_visit_at, created_at")
      .gte("last_visit_at", sinceIso);

    type ActiveCustomer = { id: number; last_visit_at: string; created_at: string };
    const activeList = (activeCustomers || []) as ActiveCustomer[];
    const repeatersCount = activeList.filter(
      (c) => new Date(c.created_at).getTime() < since.getTime()
    ).length;

    // ─────────────────────────────────────────────────────────
    // 3. 写メ日記統計
    // ─────────────────────────────────────────────────────────
    const { data: diaryEntries } = await supabase
      .from("therapist_diary_entries")
      .select("id, therapist_id, view_count, like_count, comment_count, gift_count, gift_points, published_at, ekichika_dispatch_status")
      .gte("published_at", sinceIso)
      .eq("status", "published")
      .is("deleted_at", null);

    type Diary = {
      id: number; therapist_id: number; view_count: number; like_count: number;
      comment_count: number; gift_count: number; gift_points: number;
      published_at: string; ekichika_dispatch_status: string;
    };
    const diaryList = (diaryEntries || []) as Diary[];
    const ekichikaSentCount = diaryList.filter((e) => e.ekichika_dispatch_status === "sent").length;
    const totalDiaryViews = diaryList.reduce((s, e) => s + (e.view_count || 0), 0);
    const totalDiaryLikes = diaryList.reduce((s, e) => s + (e.like_count || 0), 0);
    const totalDiaryComments = diaryList.reduce((s, e) => s + (e.comment_count || 0), 0);
    const totalDiaryGiftPoints = diaryList.reduce((s, e) => s + (e.gift_points || 0), 0);

    // ─────────────────────────────────────────────────────────
    // 4. ストーリー統計
    // ─────────────────────────────────────────────────────────
    const { data: stories } = await supabase
      .from("therapist_diary_stories")
      .select("id, therapist_id, view_count, gift_count, gift_points, published_at")
      .gte("published_at", sinceIso)
      .is("deleted_at", null);

    type Story = {
      id: number; therapist_id: number; view_count: number;
      gift_count: number; gift_points: number; published_at: string;
    };
    const storyList = (stories || []) as Story[];
    const totalStoryViews = storyList.reduce((s, e) => s + (e.view_count || 0), 0);

    // ─────────────────────────────────────────────────────────
    // 5. ライブ配信統計
    // ─────────────────────────────────────────────────────────
    const { data: streams } = await supabase
      .from("live_streams")
      .select("id, therapist_id, status, viewer_count_peak, viewer_count_total, heart_count_total, comment_count_total, gift_count_total, gift_points_total, duration_sec, started_at")
      .gte("created_at", sinceIso);

    type Stream = {
      id: number; therapist_id: number; status: string;
      viewer_count_peak: number; viewer_count_total: number;
      heart_count_total: number; comment_count_total: number;
      gift_count_total: number; gift_points_total: number;
      duration_sec: number | null; started_at: string | null;
    };
    const streamList = (streams || []) as Stream[];
    const completedStreams = streamList.filter((s) => s.status === "ended");
    const totalLiveViewers = completedStreams.reduce((s, st) => s + (st.viewer_count_total || 0), 0);
    const totalLiveHearts = completedStreams.reduce((s, st) => s + (st.heart_count_total || 0), 0);
    const totalLiveGiftPoints = completedStreams.reduce((s, st) => s + (st.gift_points_total || 0), 0);
    const totalLiveDurationSec = completedStreams.reduce((s, st) => s + (st.duration_sec || 0), 0);

    // ─────────────────────────────────────────────────────────
    // 6. 投げ銭ランキング (TOPセラピスト 5名)
    // ─────────────────────────────────────────────────────────
    const { data: gifts } = await supabase
      .from("gift_transactions")
      .select("therapist_id, gift_kind, point_amount, created_at, source_type")
      .gte("created_at", sinceIso)
      .eq("is_visible", true);

    type Gift = {
      therapist_id: number; gift_kind: string;
      point_amount: number; created_at: string; source_type: string;
    };
    const giftList = (gifts || []) as Gift[];
    const totalGiftCount = giftList.length;
    const totalGiftPoints = giftList.reduce((s, g) => s + g.point_amount, 0);

    // セラピスト別集計
    const therapistGiftMap = new Map<number, { count: number; points: number }>();
    for (const g of giftList) {
      const cur = therapistGiftMap.get(g.therapist_id) || { count: 0, points: 0 };
      cur.count++;
      cur.points += g.point_amount;
      therapistGiftMap.set(g.therapist_id, cur);
    }
    const therapistGiftRanking = Array.from(therapistGiftMap.entries())
      .map(([therapistId, stats]) => ({ therapistId, ...stats }))
      .sort((a, b) => b.points - a.points)
      .slice(0, 5);

    // ギフト種類別集計
    const giftKindMap = new Map<string, { count: number; points: number }>();
    for (const g of giftList) {
      const cur = giftKindMap.get(g.gift_kind) || { count: 0, points: 0 };
      cur.count++;
      cur.points += g.point_amount;
      giftKindMap.set(g.gift_kind, cur);
    }
    const popularGifts = Array.from(giftKindMap.entries())
      .map(([kind, stats]) => ({ kind, ...stats }))
      .sort((a, b) => b.count - a.count);

    // 投げ銭ソース別 (live/diary/story)
    const giftBySource = {
      live: giftList.filter((g) => g.source_type === "live").length,
      diary: giftList.filter((g) => g.source_type === "diary").length,
      story: giftList.filter((g) => g.source_type === "story").length,
    };

    // ─────────────────────────────────────────────────────────
    // 7. お気に入り (人気セラピスト TOP5)
    // ─────────────────────────────────────────────────────────
    const { data: favorites } = await supabase
      .from("customer_diary_favorites")
      .select("therapist_id, customer_id, created_at");

    type Favorite = { therapist_id: number; customer_id: number; created_at: string };
    const favList = (favorites || []) as Favorite[];
    const newFavoritesCount = favList.filter((f) => new Date(f.created_at) >= since).length;

    const favCountMap = new Map<number, number>();
    for (const f of favList) {
      favCountMap.set(f.therapist_id, (favCountMap.get(f.therapist_id) || 0) + 1);
    }
    const popularTherapists = Array.from(favCountMap.entries())
      .map(([therapistId, count]) => ({ therapistId, favoriteCount: count }))
      .sort((a, b) => b.favoriteCount - a.favoriteCount)
      .slice(0, 5);

    // ─────────────────────────────────────────────────────────
    // 8. セラピスト名解決 (ランキング用)
    // ─────────────────────────────────────────────────────────
    const allTherapistIds = Array.from(new Set([
      ...therapistGiftRanking.map((r) => r.therapistId),
      ...popularTherapists.map((r) => r.therapistId),
    ]));
    type TherapistLite = { id: number; name: string; photo_url: string | null };
    const therapistMap = new Map<number, TherapistLite>();
    if (allTherapistIds.length > 0) {
      const { data: ts } = await supabase
        .from("therapists")
        .select("id, name, photo_url")
        .in("id", allTherapistIds);
      if (ts) for (const t of ts as TherapistLite[]) therapistMap.set(t.id, t);
    }

    // ─────────────────────────────────────────────────────────
    // 9. 日別タイムライン (チャート用)
    // ─────────────────────────────────────────────────────────
    type DailyPoint = { date: string; reservations: number; revenue: number; diaryViews: number; giftPoints: number };
    const dailyMap = new Map<string, DailyPoint>();
    const initDay = (date: string) => {
      if (!dailyMap.has(date)) {
        dailyMap.set(date, { date, reservations: 0, revenue: 0, diaryViews: 0, giftPoints: 0 });
      }
      return dailyMap.get(date)!;
    };
    // 期間内の全日を初期化
    {
      const d = new Date(since);
      const end = new Date();
      while (d <= end) {
        initDay(d.toISOString().slice(0, 10));
        d.setDate(d.getDate() + 1);
      }
    }
    for (const r of reList) {
      const day = initDay(r.date);
      day.reservations++;
      if (r.status === "completed") day.revenue += r.total_price || 0;
    }
    for (const g of giftList) {
      const date = g.created_at.slice(0, 10);
      const day = initDay(date);
      day.giftPoints += g.point_amount;
    }
    // 日記/ストーリーは published_at ベース、view_countは累計なのでスキップ (将来的にviewログ作るなら正確)
    const dailyTimeline = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));

    // ─────────────────────────────────────────────────────────
    // 10. 最終レスポンス
    // ─────────────────────────────────────────────────────────
    return NextResponse.json({
      period,
      label,
      since: sinceIso,

      // KPI
      kpi: {
        totalReservations: reList.length,
        completedReservations: completedReservations.length,
        totalRevenue,
        avgPricePerReservation: completedReservations.length > 0
          ? Math.round(totalRevenue / completedReservations.length)
          : 0,
        newCustomers: newCustomersCount || 0,
        repeaters: repeatersCount,
        newFavorites: newFavoritesCount,
      },

      // コンテンツ
      diary: {
        publishedCount: diaryList.length,
        ekichikaSent: ekichikaSentCount,
        totalViews: totalDiaryViews,
        totalLikes: totalDiaryLikes,
        totalComments: totalDiaryComments,
        totalGiftPoints: totalDiaryGiftPoints,
      },
      story: {
        publishedCount: storyList.length,
        totalViews: totalStoryViews,
        totalGiftPoints: storyList.reduce((s, e) => s + (e.gift_points || 0), 0),
      },
      live: {
        totalStreams: streamList.length,
        completedStreams: completedStreams.length,
        totalDurationSec: totalLiveDurationSec,
        totalViewers: totalLiveViewers,
        totalHearts: totalLiveHearts,
        totalComments: completedStreams.reduce((s, st) => s + (st.comment_count_total || 0), 0),
        totalGiftPoints: totalLiveGiftPoints,
      },

      // 投げ銭
      gift: {
        totalCount: totalGiftCount,
        totalPoints: totalGiftPoints,
        bySource: giftBySource,
        therapistRanking: therapistGiftRanking.map((r) => ({
          ...r,
          therapistName: therapistMap.get(r.therapistId)?.name || "(削除済み)",
          photoUrl: therapistMap.get(r.therapistId)?.photo_url || null,
        })),
        popularGifts,
      },

      // 人気セラピスト
      popularTherapists: popularTherapists.map((r) => ({
        ...r,
        therapistName: therapistMap.get(r.therapistId)?.name || "(削除済み)",
        photoUrl: therapistMap.get(r.therapistId)?.photo_url || null,
      })),

      // タイムライン
      dailyTimeline,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "不明なエラー";
    console.error("/api/analytics/marketing error:", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
