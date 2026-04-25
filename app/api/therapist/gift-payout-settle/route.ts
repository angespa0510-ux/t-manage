import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://cbewozzdyjqmhzkxsjqo.supabase.co";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * セラピスト精算時に pending な投げ銭換金申請を消化する
 *
 * Body: { therapistId, settlementId, settlementDate }
 *
 * 処理:
 *   1. therapist_id × status='pending' の gift_payouts を全件取得
 *   2. 全部を 'paid' に更新、settlement_id と settlement_date と paid_at を設定
 *   3. therapist_daily_settlements.gift_bonus_amount に手取り合計を加算
 *
 * 戻り値: { totalNetPayout, count, payouts }
 *   - totalNetPayout: 加算した手取り合計
 *   - count: 消化した申請件数
 *   - payouts: 消化した申請レコード一覧
 *
 * ※ このエンドポイントは精算確定処理のあとに呼び出されることを想定。
 * ※ 何度呼び出しても重複加算しないように、status='pending' のみを対象とする (冪等性)。
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { therapistId, settlementId, settlementDate } = body;

    if (!therapistId || !settlementId || !settlementDate) {
      return NextResponse.json({ error: "therapistId, settlementId, settlementDate が必要です" }, { status: 400 });
    }
    const tid = parseInt(String(therapistId));
    const sid = parseInt(String(settlementId));
    if (!tid || !sid) {
      return NextResponse.json({ error: "therapistId/settlementId が不正です" }, { status: 400 });
    }

    // 1. pending な申請を取得
    const { data: pendings } = await supabase
      .from("gift_payouts")
      .select("*")
      .eq("therapist_id", tid)
      .eq("status", "pending")
      .order("requested_at", { ascending: true });

    type PayoutRow = {
      id: number;
      therapist_id: number;
      requested_points: number;
      net_payout_amount: number;
      status: string;
    };
    const list = (pendings || []) as PayoutRow[];

    if (list.length === 0) {
      return NextResponse.json({
        success: true,
        totalNetPayout: 0,
        count: 0,
        payouts: [],
      });
    }

    const totalNetPayout = list.reduce((sum, p) => sum + (p.net_payout_amount || 0), 0);
    const ids = list.map((p) => p.id);
    const nowIso = new Date().toISOString();

    // 2. 一括で 'paid' に更新
    const { error: updateErr } = await supabase
      .from("gift_payouts")
      .update({
        status: "paid",
        settlement_id: sid,
        settlement_date: settlementDate,
        paid_at: nowIso,
      })
      .in("id", ids);
    if (updateErr) {
      console.error("gift_payouts update error:", updateErr);
      return NextResponse.json({ error: "申請の更新に失敗しました" }, { status: 500 });
    }

    // 3. therapist_daily_settlements.gift_bonus_amount に加算
    //    既存値を取得して加算する (再呼び出しでも上書きにならないよう SUM 取り直し)
    //    安全のため、その settlement に紐付くすべての paid を SUM し直して再設定する
    const { data: paidsForSettlement } = await supabase
      .from("gift_payouts")
      .select("net_payout_amount")
      .eq("settlement_id", sid)
      .eq("status", "paid");
    type PaidRow = { net_payout_amount: number };
    const settledTotal = ((paidsForSettlement || []) as PaidRow[]).reduce((s, p) => s + (p.net_payout_amount || 0), 0);

    await supabase
      .from("therapist_daily_settlements")
      .update({ gift_bonus_amount: settledTotal })
      .eq("id", sid);

    return NextResponse.json({
      success: true,
      totalNetPayout,
      count: list.length,
      settledTotal,
      payouts: list,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "不明なエラー";
    console.error("/api/therapist/gift-payout-settle error:", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
