import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://cbewozzdyjqmhzkxsjqo.supabase.co";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * セラピストの受領ポイントサマリー取得
 *
 * GET ?therapistId=xx
 *
 * Returns:
 *   - 累計受領 (total)
 *   - 換金可能残高 (currentBalance)
 *   - 今月受領 / 今年受領
 *   - 直近の投げ銭履歴 (最大 30件)
 *   - 種類別集計 (gift_kind ごとの累計)
 *   - 月別集計 (過去6ヶ月)
 *   - 申請履歴 (gift_payouts、後で実装)
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const therapistId = url.searchParams.get("therapistId");
    if (!therapistId) {
      return NextResponse.json({ error: "therapistId が必要です" }, { status: 400 });
    }
    const tid = parseInt(therapistId);
    if (!tid || isNaN(tid)) {
      return NextResponse.json({ error: "therapistId が不正です" }, { status: 400 });
    }

    // 1. サマリー (therapist_gift_points)
    const { data: summaryRow } = await supabase
      .from("therapist_gift_points")
      .select("*")
      .eq("therapist_id", tid)
      .maybeSingle();

    type SummaryRow = {
      total_received_points: number;
      total_received_count: number;
      current_balance_points: number;
      this_month_received: number;
      this_month_year: number | null;
      this_month_month: number | null;
      this_year_received: number;
      this_year_year: number | null;
      last_received_at: string | null;
      first_received_at: string | null;
    };
    const s = (summaryRow || null) as SummaryRow | null;

    // 月またぎ判定: this_month_year/month が今月でなければ今月分は 0 とみなす
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth() + 1;
    const thisMonthReceived = s && s.this_month_year === curYear && s.this_month_month === curMonth ? s.this_month_received : 0;
    const thisYearReceived = s && s.this_year_year === curYear ? s.this_year_received : 0;

    // 2. 直近の投げ銭履歴 (最新 30件)
    const { data: txRows } = await supabase
      .from("gift_transactions")
      .select("id, customer_id, source_type, source_id, gift_kind, gift_label, gift_emoji, point_amount, message, created_at")
      .eq("therapist_id", tid)
      .order("created_at", { ascending: false })
      .limit(30);

    type TxRow = {
      id: number;
      customer_id: number;
      source_type: string;
      source_id: number | null;
      gift_kind: string;
      gift_label: string | null;
      gift_emoji: string | null;
      point_amount: number;
      message: string | null;
      created_at: string;
    };
    const transactions = (txRows || []) as TxRow[];

    // 顧客名を取得 (プライバシー配慮: 「○○さん」形式で末尾を伏せる)
    const customerIds = Array.from(new Set(transactions.map((t) => t.customer_id)));
    const customerMap = new Map<number, string>();
    if (customerIds.length > 0) {
      const { data: customers } = await supabase
        .from("customers")
        .select("id, self_name, name")
        .in("id", customerIds);
      type CustomerLite = { id: number; self_name: string | null; name: string | null };
      for (const c of (customers || []) as CustomerLite[]) {
        const dn = (c.self_name || c.name || "").trim();
        // 1文字目を表示、残りを●で伏せる (例: "鈴木" → "鈴●")
        let masked = "お客様";
        if (dn.length === 1) masked = dn;
        else if (dn.length >= 2) masked = dn.charAt(0) + "●";
        customerMap.set(c.id, masked);
      }
    }

    // 3. 種類別集計 (gift_kind ごと)
    const kindCounts = new Map<string, { kind: string; emoji: string; label: string; count: number; points: number }>();
    // 期間別集計 (過去 6ヶ月) - 全件取得 (件数多くないはず)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0, 0, 0, 0);

    const { data: allRecentRows } = await supabase
      .from("gift_transactions")
      .select("gift_kind, gift_label, gift_emoji, point_amount, created_at")
      .eq("therapist_id", tid)
      .gte("created_at", sixMonthsAgo.toISOString());

    type AggRow = { gift_kind: string; gift_label: string | null; gift_emoji: string | null; point_amount: number; created_at: string };
    const aggRows = (allRecentRows || []) as AggRow[];

    // 種類別集計 (過去6ヶ月分から計算 - 全期間版が欲しければ別途集計が必要)
    for (const r of aggRows) {
      const k = r.gift_kind;
      const existing = kindCounts.get(k);
      if (existing) {
        existing.count += 1;
        existing.points += r.point_amount;
      } else {
        kindCounts.set(k, {
          kind: k,
          emoji: r.gift_emoji || "🎁",
          label: r.gift_label || k,
          count: 1,
          points: r.point_amount,
        });
      }
    }

    // 月別集計 (過去6ヶ月)
    const monthlyMap = new Map<string, { yearMonth: string; points: number; count: number }>();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(curYear, curMonth - 1 - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      monthlyMap.set(key, { yearMonth: key, points: 0, count: 0 });
    }
    for (const r of aggRows) {
      const d = new Date(r.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const m = monthlyMap.get(key);
      if (m) {
        m.points += r.point_amount;
        m.count += 1;
      }
    }

    // 4. レスポンス整形
    return NextResponse.json({
      summary: {
        totalReceivedPoints: s?.total_received_points || 0,
        totalReceivedCount: s?.total_received_count || 0,
        currentBalancePoints: s?.current_balance_points || 0,
        thisMonthReceived,
        thisYearReceived,
        lastReceivedAt: s?.last_received_at || null,
        firstReceivedAt: s?.first_received_at || null,
      },
      transactions: transactions.map((t) => ({
        id: t.id,
        senderName: customerMap.get(t.customer_id) || "お客様",
        sourceType: t.source_type,
        sourceId: t.source_id,
        giftKind: t.gift_kind,
        giftLabel: t.gift_label,
        giftEmoji: t.gift_emoji,
        pointAmount: t.point_amount,
        message: t.message,
        createdAt: t.created_at,
      })),
      kindBreakdown: Array.from(kindCounts.values()).sort((a, b) => b.points - a.points),
      monthlyBreakdown: Array.from(monthlyMap.values()),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "不明なエラー";
    console.error("/api/therapist/gift-summary error:", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
