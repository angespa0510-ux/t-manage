/**
 * T-MANAGE DB から実績データ取得
 *
 * Insightsダッシュボード用に、予約・売上・新規顧客などの実績を集計する。
 * GA4 / Clarity と同じ日次粒度で揃える。
 */

import { createClient } from "@supabase/supabase-js";

// ───────── 型定義 ─────────

export type TmanageSummary = {
  date: string;                              // YYYY-MM-DD
  reservationCount: number;                  // 完了した予約数
  reservationCountPrevDay: number;           // 前日の予約数（比較用）
  totalSales: number;                        // 合計売上（円）
  newCustomerCount: number;                  // 新規顧客数
  averageUnitPrice: number;                  // 平均単価
  shopReceived: number;                      // 店取概算
  cardFee: number;                           // カード手数料
  topCourses: { name: string; count: number }[];   // 人気コースTOP5
  topTherapists: { name: string; count: number }[]; // 指名上位TOP5
};

// ───────── サーバーサイド Supabase クライアント ─────────

function getServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !serviceKey) {
    throw new Error("Supabase接続情報が未設定");
  }
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

// ───────── 公開関数: 1日分の実績取得 ─────────

/**
 * 指定日の T-MANAGE 実績サマリーを取得
 *
 * @param date YYYY-MM-DD 形式
 */
export async function fetchTmanageSummary(date: string): Promise<TmanageSummary> {
  const supabase = getServerClient();

  // 前日日付を計算
  const d = new Date(date);
  d.setDate(d.getDate() - 1);
  const prevDate = d.toISOString().slice(0, 10);

  // ── 並行取得 ──
  const [reservationsRes, prevReservationsRes, customersRes] = await Promise.all([
    supabase
      .from("reservations")
      .select("id, total_price, course, nomination, customer_name, status, total_back, welfare_fee")
      .eq("date", date)
      .eq("status", "completed"),
    supabase
      .from("reservations")
      .select("id")
      .eq("date", prevDate)
      .eq("status", "completed"),
    supabase
      .from("customers")
      .select("id, created_at")
      .gte("created_at", `${date}T00:00:00+09:00`)
      .lt("created_at", `${date}T23:59:59+09:00`),
  ]);

  const reservations = reservationsRes.data ?? [];
  const prevReservations = prevReservationsRes.data ?? [];
  const newCustomers = customersRes.data ?? [];

  // ── 集計 ──
  const reservationCount = reservations.length;
  const totalSales = reservations.reduce((sum, r) => sum + (Number(r.total_price) || 0), 0);
  const averageUnitPrice = reservationCount > 0 ? Math.round(totalSales / reservationCount) : 0;

  // 店取概算（簡易版: 売上 - セラピストバック - 備品リネン）
  const therapistBack = reservations.reduce((s, r) => s + (Number(r.total_back) || 0), 0);
  const welfareFee = reservations.reduce((s, r) => s + (Number(r.welfare_fee) || 0), 0);
  const shopReceived = totalSales - therapistBack - welfareFee;

  // コース集計
  const courseMap = new Map<string, number>();
  reservations.forEach((r) => {
    const c = r.course || "不明";
    courseMap.set(c, (courseMap.get(c) || 0) + 1);
  });
  const topCourses = Array.from(courseMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));

  // セラピスト指名集計
  const therapistMap = new Map<string, number>();
  reservations
    .filter((r) => r.nomination && r.nomination !== "フリー" && r.nomination !== "指名なし")
    .forEach((r) => {
      const t = r.nomination as string;
      therapistMap.set(t, (therapistMap.get(t) || 0) + 1);
    });
  const topTherapists = Array.from(therapistMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));

  return {
    date,
    reservationCount,
    reservationCountPrevDay: prevReservations.length,
    totalSales,
    newCustomerCount: newCustomers.length,
    averageUnitPrice,
    shopReceived,
    cardFee: 0, // 簡易版では省略（TODO: card_payments テーブルから集計）
    topCourses,
    topTherapists,
  };
}
