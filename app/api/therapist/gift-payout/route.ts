import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://cbewozzdyjqmhzkxsjqo.supabase.co";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

// ─── 設定値 ───────────────────────────────────────────
const STORE_FEE_RATE = 0.10;          // 店舗手数料 10%
const INVOICE_DEDUCTION_RATE = 0.10;  // インボイス未登録時の控除 10%
const WITHHOLDING_RATE = 0.1021;      // 源泉徴収 10.21%
const MIN_REQUEST_POINTS = 1000;      // 最低申請額
const REQUEST_UNIT = 100;             // 申請単位

// ─── 控除計算ヘルパー (申請API・UI で同じロジックを使うので export 可能な形に) ───
export type PayoutCalc = {
  requested: number;          // 申請額 (=ポイント、1pt=1円)
  storeFee: number;           // 店舗手数料
  invoiceDeduction: number;   // インボイス控除
  withholding: number;        // 源泉徴収
  netPayout: number;          // 手取り
};

function calcPayout(points: number, hasInvoice: boolean, hasWithholding: boolean): PayoutCalc {
  const requested = points;
  const storeFee = Math.floor(requested * STORE_FEE_RATE);
  const invoiceDeduction = hasInvoice ? 0 : Math.floor(requested * INVOICE_DEDUCTION_RATE);
  const withholding = hasWithholding ? Math.floor(requested * WITHHOLDING_RATE) : 0;
  const netPayout = requested - storeFee - invoiceDeduction - withholding;
  return { requested, storeFee, invoiceDeduction, withholding, netPayout };
}

/**
 * GET /api/therapist/gift-payout?therapistId=xx
 *  → 申請履歴を返す + 控除レート (UI シミュレーション用)
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

    const { data: payouts } = await supabase
      .from("gift_payouts")
      .select("*")
      .eq("therapist_id", tid)
      .order("requested_at", { ascending: false })
      .limit(50);

    return NextResponse.json({
      payouts: payouts || [],
      config: {
        storeFeeRate: STORE_FEE_RATE,
        invoiceDeductionRate: INVOICE_DEDUCTION_RATE,
        withholdingRate: WITHHOLDING_RATE,
        minRequestPoints: MIN_REQUEST_POINTS,
        requestUnit: REQUEST_UNIT,
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "不明なエラー";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * POST /api/therapist/gift-payout
 *  Body: { therapistId, points }
 *  → 換金申請を作成、therapist_gift_points.current_balance_points を減算
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { therapistId, points } = body;

    if (!therapistId || !points) {
      return NextResponse.json({ error: "therapistId と points が必要です" }, { status: 400 });
    }
    const tid = parseInt(String(therapistId));
    const pts = parseInt(String(points));
    if (!tid || isNaN(tid) || !pts || isNaN(pts)) {
      return NextResponse.json({ error: "パラメータが不正です" }, { status: 400 });
    }

    // バリデーション
    if (pts < MIN_REQUEST_POINTS) {
      return NextResponse.json({ error: `${MIN_REQUEST_POINTS}pt 以上で申請してください` }, { status: 400 });
    }
    if (pts % REQUEST_UNIT !== 0) {
      return NextResponse.json({ error: `${REQUEST_UNIT}pt 単位で申請してください` }, { status: 400 });
    }

    // セラピスト確認
    const { data: therapist } = await supabase
      .from("therapists")
      .select("id, name, has_invoice, has_withholding")
      .eq("id", tid)
      .maybeSingle();
    if (!therapist) {
      return NextResponse.json({ error: "セラピストが見つかりません" }, { status: 404 });
    }
    type TherapistRow = { id: number; name: string; has_invoice: boolean | null; has_withholding: boolean | null };
    const th = therapist as TherapistRow;

    // 残高確認
    const { data: pointsRow } = await supabase
      .from("therapist_gift_points")
      .select("current_balance_points")
      .eq("therapist_id", tid)
      .maybeSingle();
    const currentBalance = (pointsRow as { current_balance_points: number } | null)?.current_balance_points || 0;
    if (currentBalance < pts) {
      return NextResponse.json({
        error: `残高が足りません (現在: ${currentBalance}pt / 申請: ${pts}pt)`,
        currentBalance,
        requested: pts,
      }, { status: 402 });
    }

    // 控除計算 (申請時のステータスでスナップショット)
    const hasInvoice = !!th.has_invoice;
    const hasWithholding = !!th.has_withholding;
    const calc = calcPayout(pts, hasInvoice, hasWithholding);

    // 1. gift_payouts に挿入
    const { data: payout, error: payoutErr } = await supabase
      .from("gift_payouts")
      .insert({
        therapist_id: tid,
        requested_points: pts,
        requested_amount_yen: calc.requested,
        store_fee_amount: calc.storeFee,
        invoice_deduction: calc.invoiceDeduction,
        withholding_tax: calc.withholding,
        net_payout_amount: calc.netPayout,
        has_invoice_at_request: hasInvoice,
        has_withholding_at_request: hasWithholding,
        status: "pending",
      })
      .select("*")
      .single();
    if (payoutErr || !payout) {
      console.error("gift_payouts insert error:", payoutErr);
      return NextResponse.json({ error: "申請の保存に失敗しました" }, { status: 500 });
    }

    // 2. therapist_gift_points.current_balance_points を減算 (ダブル申請防止)
    await supabase
      .from("therapist_gift_points")
      .update({ current_balance_points: currentBalance - pts })
      .eq("therapist_id", tid);

    return NextResponse.json({
      success: true,
      payout,
      newBalance: currentBalance - pts,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "不明なエラー";
    console.error("/api/therapist/gift-payout POST error:", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * DELETE /api/therapist/gift-payout
 *  Body: { therapistId, payoutId, reason? }
 *  → pending 状態の申請をキャンセル、ポイントを返却
 */
export async function DELETE(req: Request) {
  try {
    const body = await req.json();
    const { therapistId, payoutId, reason } = body;
    if (!therapistId || !payoutId) {
      return NextResponse.json({ error: "therapistId と payoutId が必要です" }, { status: 400 });
    }
    const tid = parseInt(String(therapistId));
    const pid = parseInt(String(payoutId));
    if (!tid || !pid) {
      return NextResponse.json({ error: "パラメータが不正です" }, { status: 400 });
    }

    // 申請確認
    const { data: payout } = await supabase
      .from("gift_payouts")
      .select("*")
      .eq("id", pid)
      .eq("therapist_id", tid)
      .maybeSingle();
    if (!payout) {
      return NextResponse.json({ error: "申請が見つかりません" }, { status: 404 });
    }
    type PayoutRow = { id: number; therapist_id: number; requested_points: number; status: string };
    const p = payout as PayoutRow;
    if (p.status !== "pending") {
      return NextResponse.json({ error: `${p.status} 状態の申請はキャンセルできません` }, { status: 409 });
    }

    // 1. キャンセル
    await supabase
      .from("gift_payouts")
      .update({
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
        cancel_reason: reason ? String(reason).slice(0, 200) : null,
      })
      .eq("id", pid);

    // 2. ポイントを返却
    const { data: pointsRow } = await supabase
      .from("therapist_gift_points")
      .select("current_balance_points")
      .eq("therapist_id", tid)
      .maybeSingle();
    const currentBalance = (pointsRow as { current_balance_points: number } | null)?.current_balance_points || 0;
    await supabase
      .from("therapist_gift_points")
      .update({ current_balance_points: currentBalance + p.requested_points })
      .eq("therapist_id", tid);

    return NextResponse.json({
      success: true,
      newBalance: currentBalance + p.requested_points,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "不明なエラー";
    console.error("/api/therapist/gift-payout DELETE error:", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
