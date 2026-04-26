"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../lib/supabase";
import { useStaffSession } from "../../lib/staff-session";
import { useTheme } from "../../lib/theme";
import { useConfirm } from "../../components/useConfirm";
import { isSafeUncollected } from "../../lib/cash-aggregation";
import { runAutoSettlementIfDue } from "../../lib/staff-advances";

/* ─────────── 型定義 ─────────── */
type AtmDeposit = {
  id: number;
  deposit_date: string;
  amount: number;
  note: string;
  recorded_by_name: string;
  created_at: string;
  bank_verified: boolean;
  bank_verified_transaction_id: number | null;
  bank_verified_at: string | null;
};

type BankTx = {
  id: number;
  transaction_date: string;
  description: string;
  debit_amount: number;
  credit_amount: number;
  balance: number;
};

type Settlement = {
  id: number;
  therapist_id: number;
  date: string;
  total_cash: number;
  final_payment: number;
  room_id: number;
  sales_collected: boolean;
  change_collected: boolean;
  safe_deposited: boolean;
  safe_collected_date: string | null;
  reserve_used_amount?: number;  // 豊橋予備金からの立替額
};

type Replenish = { id: number; room_id: number; date: string; amount: number };
type ExpenseRec = { id: number; date: string; amount: number; type: string; category: string };

type ToyohashiMove = {
  id: number;
  movement_date: string;
  movement_type: "withdraw" | "refund" | "initial" | "adjustment";
  amount: number;
  therapist_id: number | null;
  recorded_by_name: string;
  note: string;
  created_at: string;
};

type BalanceCheck = {
  id: number;
  check_date: string;
  manager_safe_actual: number | null;
  staff_safe_actual: number | null;
  toyohashi_reserve_actual: number | null;
  checked_by_name: string;
  note: string;
  created_at: string;
};

type Therapist = { id: number; name: string };

const fmt = (n: number) => "¥" + (n || 0).toLocaleString();

export default function CashDashboard() {
  const router = useRouter();
  const { dark, toggle, T } = useTheme();
  const { activeStaff, canAccessCashDashboard } = useStaffSession();
  const { confirm, ConfirmModalNode } = useConfirm();

  const [atmDeposits, setAtmDeposits] = useState<AtmDeposit[]>([]);
  const [latestBankTx, setLatestBankTx] = useState<BankTx | null>(null);
  const [allBankTxs, setAllBankTxs] = useState<BankTx[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [replenishAll, setReplenishAll] = useState<Replenish[]>([]);
  const [expensesAll, setExpensesAll] = useState<ExpenseRec[]>([]);
  const [loading, setLoading] = useState(true);

  // ATM預入モーダル
  const [showAtmModal, setShowAtmModal] = useState(false);
  const [atmDate, setAtmDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [atmAmount, setAtmAmount] = useState("");
  const [atmNote, setAtmNote] = useState("");
  const [atmSaving, setAtmSaving] = useState(false);

  // 豊橋予備金データ
  const [toyohashiMoves, setToyohashiMoves] = useState<ToyohashiMove[]>([]);
  const [therapists, setTherapists] = useState<Therapist[]>([]);

  // スタッフ前借り
  const [pendingAdvances, setPendingAdvances] = useState<{ id: number; staff_id: number; advance_date: string; amount: number }[]>([]);
  const [settledAdvancesThisMonth, setSettledAdvancesThisMonth] = useState<{ amount: number }[]>([]);
  const [allStaff, setAllStaff] = useState<{ id: number; name: string }[]>([]);

  // 豊橋予備金モーダル
  const [showReserveModal, setShowReserveModal] = useState(false);
  const [reserveType, setReserveType] = useState<"withdraw" | "refund" | "initial" | "adjustment">("withdraw");
  const [reserveDate, setReserveDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [reserveAmount, setReserveAmount] = useState("");
  const [reserveTherapistId, setReserveTherapistId] = useState<number | null>(null);
  const [reserveNote, setReserveNote] = useState("");
  const [reserveSaving, setReserveSaving] = useState(false);

  // 金庫残高確認データ
  const [balanceChecks, setBalanceChecks] = useState<BalanceCheck[]>([]);

  // 金庫残高確認モーダル
  const [showCheckModal, setShowCheckModal] = useState(false);
  const [checkDate, setCheckDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [checkManagerSafe, setCheckManagerSafe] = useState("");
  const [checkStaffSafe, setCheckStaffSafe] = useState("");
  const [checkToyohashi, setCheckToyohashi] = useState("");
  const [checkNote, setCheckNote] = useState("");
  const [checkSaving, setCheckSaving] = useState(false);

  // 管理者金庫 計算内訳モーダル
  const [showBreakdownModal, setShowBreakdownModal] = useState(false);

  // 認証・権限チェック
  useEffect(() => {
    if (!activeStaff) { router.push("/dashboard"); return; }
    if (!canAccessCashDashboard) { router.push("/dashboard"); return; }
  }, [activeStaff, canAccessCashDashboard, router]);

  // データ取得
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // ATM預入履歴
      const { data: atms } = await supabase.from("atm_deposits").select("*").order("deposit_date", { ascending: false });
      if (atms) setAtmDeposits(atms as AtmDeposit[]);

      // 最新PayPay銀行残高（最新の銀行取引）
      const { data: latestTx } = await supabase.from("bank_transactions").select("id,transaction_date,description,debit_amount,credit_amount,balance").order("transaction_date", { ascending: false }).order("id", { ascending: false }).limit(1);
      if (latestTx && latestTx.length > 0) setLatestBankTx(latestTx[0] as BankTx);

      // 銀行取引全部（マッチング用）- 「三井住友ＡＴＭ」の入金のみ
      const { data: bankTxs } = await supabase.from("bank_transactions").select("id,transaction_date,description,debit_amount,credit_amount,balance").ilike("description", "%三井住友%").gt("credit_amount", 0).order("transaction_date", { ascending: false });
      if (bankTxs) setAllBankTxs(bankTxs as BankTx[]);

      // 精算データ全部
      const { data: sets } = await supabase.from("therapist_daily_settlements").select("*");
      if (sets) setSettlements(sets as Settlement[]);

      // 釣銭補充
      const { data: reps } = await supabase.from("room_cash_replenishments").select("*");
      if (reps) setReplenishAll(reps as Replenish[]);

      // 経費・収入
      const { data: exps } = await supabase.from("expenses").select("id,date,amount,type,category");
      if (exps) setExpensesAll(exps as ExpenseRec[]);

      // 豊橋予備金取引履歴
      const { data: toyos } = await supabase.from("toyohashi_reserve_movements").select("*").order("movement_date", { ascending: false });
      if (toyos) setToyohashiMoves(toyos as ToyohashiMove[]);

      // 金庫残高確認履歴
      const { data: checks } = await supabase.from("cash_balance_checks").select("*").order("check_date", { ascending: false });
      if (checks) setBalanceChecks(checks as BalanceCheck[]);

      // セラピスト一覧
      const { data: ths } = await supabase.from("therapists").select("id,name").order("name");
      if (ths) setTherapists(ths as Therapist[]);

      // スタッフ前借り（未精算・当月精算済）
      const { data: pendAdv } = await supabase.from("staff_advances")
        .select("id,staff_id,advance_date,amount")
        .eq("status", "pending");
      setPendingAdvances(pendAdv || []);

      const nowD = new Date();
      const thisMonthStr = `${nowD.getFullYear()}-${String(nowD.getMonth() + 1).padStart(2, "0")}`;
      const { data: settledThis } = await supabase.from("staff_advances")
        .select("amount")
        .eq("status", "settled")
        .eq("settled_month", thisMonthStr);
      setSettledAdvancesThisMonth(settledThis || []);

      const { data: stf } = await supabase.from("staff").select("id,name");
      setAllStaff(stf || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (canAccessCashDashboard) fetchData(); }, [canAccessCashDashboard, fetchData]);

  // 前借り月末自動精算チェック (cash-dashboard 初回ロード時に一度だけ実行)
  useEffect(() => {
    runAutoSettlementIfDue().catch(() => {});
  }, []);

  // ATM預入 → 銀行取引との自動マッチング
  const autoMatchBankTx = async (depositId: number, depositDate: string, amount: number) => {
    // 同日・同額の「三井住友ＡＴＭ」入金を探す（前後1日の幅）
    const dStart = new Date(depositDate); dStart.setDate(dStart.getDate() - 1);
    const dEnd = new Date(depositDate); dEnd.setDate(dEnd.getDate() + 1);
    const { data: match } = await supabase.from("bank_transactions")
      .select("id,transaction_date")
      .ilike("description", "%三井住友%")
      .eq("credit_amount", amount)
      .gte("transaction_date", dStart.toISOString().split("T")[0])
      .lte("transaction_date", dEnd.toISOString().split("T")[0])
      .limit(1);
    if (match && match.length > 0) {
      await supabase.from("atm_deposits").update({
        bank_verified: true,
        bank_verified_transaction_id: match[0].id,
        bank_verified_at: new Date().toISOString(),
      }).eq("id", depositId);
      return true;
    }
    return false;
  };

  // 全ATM預入の再照合
  const reVerifyAll = async () => {
    const unverified = atmDeposits.filter(a => !a.bank_verified);
    let matched = 0;
    for (const a of unverified) {
      const ok = await autoMatchBankTx(a.id, a.deposit_date, a.amount);
      if (ok) matched++;
    }
    alert(`照合完了: ${matched}件の新規マッチング / 残り未確認: ${unverified.length - matched}件`);
    fetchData();
  };

  // ATM預入保存
  const saveAtmDeposit = async () => {
    const amt = parseInt(atmAmount.replace(/,/g, ""));
    if (!amt || amt <= 0) { alert("金額を入力してください"); return; }
    setAtmSaving(true);
    try {
      const { data: inserted } = await supabase.from("atm_deposits").insert({
        deposit_date: atmDate,
        amount: amt,
        note: atmNote.trim(),
        recorded_by_name: activeStaff?.name || "",
      }).select().single();
      if (inserted) {
        // 自動マッチング試行
        await autoMatchBankTx(inserted.id, atmDate, amt);
      }
      setAtmAmount(""); setAtmNote(""); setShowAtmModal(false);
      fetchData();
    } finally {
      setAtmSaving(false);
    }
  };

  const deleteAtmDeposit = async (id: number) => {
    const ok = await confirm({
      title: "このATM預入記録を削除しますか？",
      message: "削除すると銀行取込との照合も失われます。",
      variant: "danger",
      confirmLabel: "削除する",
    });
    if (!ok) return;
    await supabase.from("atm_deposits").delete().eq("id", id);
    fetchData();
  };

  // 豊橋予備金の動き保存
  const saveReserveMovement = async () => {
    const amt = parseInt(reserveAmount.replace(/,/g, ""));
    if (!amt || amt <= 0) { alert("金額を入力してください"); return; }
    if (reserveType === "withdraw" && !reserveTherapistId) { alert("セラピストを選択してください"); return; }
    setReserveSaving(true);
    try {
      await supabase.from("toyohashi_reserve_movements").insert({
        movement_date: reserveDate,
        movement_type: reserveType,
        amount: amt,
        therapist_id: reserveType === "withdraw" ? reserveTherapistId : null,
        recorded_by_name: activeStaff?.name || "",
        note: reserveNote.trim(),
      });
      setReserveAmount(""); setReserveNote(""); setReserveTherapistId(null);
      setShowReserveModal(false);
      fetchData();
    } finally {
      setReserveSaving(false);
    }
  };

  const deleteReserveMovement = async (id: number) => {
    const ok = await confirm({
      title: "この予備金記録を削除しますか？",
      message: "削除すると豊橋予備金の残高計算に影響します。",
      variant: "danger",
      confirmLabel: "削除する",
    });
    if (!ok) return;
    await supabase.from("toyohashi_reserve_movements").delete().eq("id", id);
    fetchData();
  };

  // 金庫残高確認の保存
  const saveBalanceCheck = async () => {
    const mgr = checkManagerSafe.trim() ? parseInt(checkManagerSafe.replace(/,/g, "")) : null;
    const stf = checkStaffSafe.trim() ? parseInt(checkStaffSafe.replace(/,/g, "")) : null;
    const toy = checkToyohashi.trim() ? parseInt(checkToyohashi.replace(/,/g, "")) : null;
    if (mgr === null && stf === null && toy === null) { alert("少なくとも1つの金庫の実測値を入力してください"); return; }
    setCheckSaving(true);
    try {
      await supabase.from("cash_balance_checks").insert({
        check_date: checkDate,
        manager_safe_actual: mgr,
        staff_safe_actual: stf,
        toyohashi_reserve_actual: toy,
        checked_by_name: activeStaff?.name || "",
        note: checkNote.trim(),
      });
      setCheckManagerSafe(""); setCheckStaffSafe(""); setCheckToyohashi(""); setCheckNote("");
      setShowCheckModal(false);
      fetchData();
    } finally {
      setCheckSaving(false);
    }
  };

  const deleteBalanceCheck = async (id: number) => {
    const ok = await confirm({
      title: "この確認記録を削除しますか？",
      message: "金庫残高の実測履歴から削除されます。",
      variant: "danger",
      confirmLabel: "削除する",
    });
    if (!ok) return;
    await supabase.from("cash_balance_checks").delete().eq("id", id);
    fetchData();
  };

  // セラピスト名取得
  const getThName = (id: number | null) => {
    if (!id) return "";
    return therapists.find(t => t.id === id)?.name || `ID:${id}`;
  };

  // ─── 残高計算 ───
  // PayPay銀行残高（最新の銀行取引のbalance）
  const bankBalance = latestBankTx?.balance || 0;

  // ルーム未回収（まだ精算→ルームから現金を回収してない分）
  const uncollectedSettlements = settlements.filter(s => !s.sales_collected);
  const roomUncollected = uncollectedSettlements.reduce((sum, s) => {
    const net = Math.max((s.total_cash || 0) - (s.final_payment || 0), 0);
    // そのroom/dateの釣銭補充
    const rep = replenishAll.filter(r => r.room_id === s.room_id && r.date === s.date).reduce((a, b) => a + (b.amount || 0), 0);
    return sum + net + rep;
  }, 0);

  // 金庫未回収（金庫に投函済みだが、まだ回収していない分）
  // 健康診断レポート 2026-04-26 Fix #8: 述語を lib/cash-aggregation.ts の SSOT に統一
  const safeUncollectedSettlements = settlements.filter(isSafeUncollected);
  const safeUncollected = safeUncollectedSettlements.reduce((sum, s) => {
    const net = Math.max((s.total_cash || 0) - (s.final_payment || 0), 0);
    const rep = replenishAll.filter(r => r.room_id === s.room_id && r.date === s.date).reduce((a, b) => a + (b.amount || 0), 0);
    return sum + net + rep;
  }, 0);

  // 事務所残金（ATM預入を差し引いた後の理論値）
  // 累積の現金収入 = 精算済み（sales_collected=true）の net_cash_after_pay の合計
  // 経費 = expenses.type='expense' で現金払いの分（現状すべて経費を現金払いと仮定）
  // ATM預入 = すべての atm_deposits の合計
  // 事務所残金 = 累積現金収入 (予備金立替を加算)
  //          + 累積収入 - 累積経費 - 累積釣銭補充 - 累積ATM預入
  //          - 豊橋予備金への補充累計 (スタッフ金庫→予備金に出ていった分)
  const collectedSettlements = settlements.filter(s => s.sales_collected);
  const cumulativeCashIn = collectedSettlements.reduce((sum, s) => {
    // 予備金使用分も加算: (total_cash - final_payment + reserve_used) が正なら採用
    // 予備金で補完した場合、総和は 0 になる (Math.max により 0 以上を保証)
    const net = Math.max((s.total_cash || 0) - (s.final_payment || 0) + (s.reserve_used_amount || 0), 0);
    const rep = s.change_collected ? replenishAll.filter(r => r.room_id === s.room_id && r.date === s.date).reduce((a, b) => a + (b.amount || 0), 0) : 0;
    return sum + net + rep;
  }, 0);
  const totalReplenishAll = replenishAll.reduce((s, r) => s + (r.amount || 0), 0);
  const cumulativeExpense = expensesAll.filter(e => e.type === "expense").reduce((s, e) => s + (e.amount || 0), 0);
  const cumulativeIncome = expensesAll.filter(e => e.type === "income").reduce((s, e) => s + (e.amount || 0), 0);
  const cumulativeAtmDeposit = atmDeposits.reduce((s, a) => s + (a.amount || 0), 0);

  // 豊橋予備金への補充累計 (スタッフ金庫→予備金に現金が出ていった分)
  // 立替は管理者金庫には影響しない (予備金から直接セラピストへ)
  // 補充は管理者金庫 (スタッフ金庫) から予備金へ現金が移動するため、管理者金庫から減算
  const totalReserveWithdraw = toyohashiMoves.filter(m => m.movement_type === "withdraw").reduce((s, m) => s + m.amount, 0);
  const totalReserveRefund = toyohashiMoves.filter(m => m.movement_type === "refund").reduce((s, m) => s + m.amount, 0);

  // 未精算スタッフ前借り累計 (pending 分は管理者金庫から出ている状態)
  // settled 後は expenses に振替されるので、そちら経由で cumulativeExpense に含まれ、二重控除にならない
  const totalPendingAdvances = pendingAdvances.reduce((s, a) => s + (a.amount || 0), 0);

  const officeCashBalance = cumulativeCashIn + cumulativeIncome - cumulativeExpense - totalReplenishAll - cumulativeAtmDeposit - totalReserveRefund - totalPendingAdvances;

  // 検証済み/未検証のATM預入
  const verifiedAtms = atmDeposits.filter(a => a.bank_verified).length;
  const unverifiedAtms = atmDeposits.length - verifiedAtms;
  const totalAtmAmount = atmDeposits.reduce((s, a) => s + a.amount, 0);

  // 豊橋予備金残高計算
  // 残高 = initial + refund + adjustment(正数) - withdraw - adjustment(負数)
  // adjustment は正負どちらもありうるが、今回は正数で記録し、amount に符号を持たせない設計
  // 代わりに、typeで判定: initial/refund → 増、withdraw → 減、adjustment → note参照
  // シンプル化: adjustment は「実測値に合わせる」調整なので、数値としては増減どちらも可能にするため
  // 実際は note に方向を書く運用でOK。デフォルトは加算扱い。
  const toyohashiBalance = toyohashiMoves.reduce((sum, m) => {
    if (m.movement_type === "withdraw") return sum - m.amount;
    // initial, refund, adjustment は加算
    return sum + m.amount;
  }, 0);

  // 今月の立替・補充
  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const thisMonthMoves = toyohashiMoves.filter(m => m.movement_date.startsWith(thisMonth));
  const monthlyWithdraw = thisMonthMoves.filter(m => m.movement_type === "withdraw").reduce((s, m) => s + m.amount, 0);
  const monthlyRefund = thisMonthMoves.filter(m => m.movement_type === "refund").reduce((s, m) => s + m.amount, 0);

  // 最新の金庫残高確認（各金庫ごと最新）
  const latestManagerCheck = balanceChecks.find(c => c.manager_safe_actual !== null);
  const latestStaffCheck = balanceChecks.find(c => c.staff_safe_actual !== null);
  const latestToyohashiCheck = balanceChecks.find(c => c.toyohashi_reserve_actual !== null);

  // 実測値との差額
  const managerDiff = latestManagerCheck?.manager_safe_actual !== null && latestManagerCheck?.manager_safe_actual !== undefined
    ? latestManagerCheck.manager_safe_actual - officeCashBalance : null;
  const toyohashiDiff = latestToyohashiCheck?.toyohashi_reserve_actual !== null && latestToyohashiCheck?.toyohashi_reserve_actual !== undefined
    ? latestToyohashiCheck.toyohashi_reserve_actual - toyohashiBalance : null;

  // 合計資産（豊橋予備金を追加）
  const totalAssets = bankBalance + officeCashBalance + toyohashiBalance + safeUncollected + roomUncollected;

  if (!activeStaff || !canAccessCashDashboard) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: T.bg, color: T.text }}>
        <p className="text-[13px]" style={{ color: T.textMuted }}>認証中...</p>
      </div>
    );
  }

  const cardStyle = { backgroundColor: T.card, border: `1px solid ${T.border}` };

  return (
    <div className="min-h-screen" style={{ backgroundColor: T.bg, color: T.text }}>
      {ConfirmModalNode}
      {/* ヘッダー */}
      <div className="sticky top-0 z-10 px-6 py-3 flex items-center justify-between" style={{ backgroundColor: T.card, borderBottom: `1px solid ${T.border}` }}>
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="text-[12px]" style={{ color: T.textSub, textDecoration: "none" }}>← ダッシュボード</Link>
          <div>
            <p className="text-[14px] font-medium">💴 資金管理ダッシュボード</p>
            <p className="text-[10px]" style={{ color: T.textFaint }}>社長・経営責任者のみ閲覧可 / 入力は「日次集計」画面で</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] px-2 py-1 rounded" style={{ backgroundColor: T.cardAlt, color: T.textSub }}>{activeStaff.name} ({activeStaff.company_position || activeStaff.role})</span>
          <button onClick={toggle} className="px-2 py-1 rounded cursor-pointer text-[11px]" style={{ backgroundColor: T.cardAlt, color: T.textSub, border: "none" }}>{dark ? "☀︎" : "🌙"}</button>
        </div>
      </div>

      <div className="p-6 space-y-4 max-w-5xl mx-auto pb-20">

        {loading && (
          <div className="rounded-xl p-10 text-center" style={cardStyle}>
            <p className="text-[12px]" style={{ color: T.textSub }}>読込中...</p>
          </div>
        )}

        {!loading && (
          <>
            {/* 合計資産カード */}
            <div className="rounded-2xl p-6" style={{ backgroundColor: T.card, border: `2px solid #c3a782` }}>
              <p className="text-[11px] mb-1" style={{ color: T.textSub }}>💰 チョップの現在の全資産</p>
              <p className="text-[32px] font-medium" style={{ color: "#c3a782", fontVariantNumeric: "tabular-nums" }}>{fmt(totalAssets)}</p>
              <p className="text-[10px] mt-1" style={{ color: T.textFaint }}>
                PayPay銀行 + 管理者金庫 + 豊橋予備金 + 金庫未回収 + ルーム未回収
              </p>
            </div>

            {/* 5つの財布 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
              {/* PayPay銀行 */}
              <div className="rounded-xl p-4" style={cardStyle}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px]" style={{ color: "#4a7ca0" }}>🏦 PayPay銀行</p>
                </div>
                <p className="text-[18px] font-medium" style={{ fontVariantNumeric: "tabular-nums" }}>{fmt(bankBalance)}</p>
                {latestBankTx ? (
                  <p className="text-[9px] mt-2" style={{ color: T.textFaint }}>
                    最新: {latestBankTx.transaction_date.slice(5)}
                  </p>
                ) : (
                  <p className="text-[9px] mt-2" style={{ color: T.textFaint }}>銀行取込なし</p>
                )}
              </div>

              {/* 管理者金庫 */}
              <div className="rounded-xl p-4 cursor-pointer transition-all hover:shadow-md" style={cardStyle} onClick={() => setShowBreakdownModal(true)}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px]" style={{ color: "#f59e0b" }}>🗄 管理者金庫</p>
                  <span className="text-[9px]" style={{ color: T.textFaint }}>🔍 内訳</span>
                </div>
                <p className="text-[18px] font-medium" style={{ fontVariantNumeric: "tabular-nums" }}>{fmt(officeCashBalance)}</p>
                {latestManagerCheck ? (
                  <div className="text-[9px] mt-2">
                    <p style={{ color: T.textFaint }}>
                      実測: {fmt(latestManagerCheck.manager_safe_actual || 0)} ({latestManagerCheck.check_date.slice(5)})
                    </p>
                    {managerDiff !== null && Math.abs(managerDiff) > 0 && (
                      <p style={{ color: Math.abs(managerDiff) > 10000 ? "#c45555" : "#f59e0b" }}>
                        差額: {managerDiff > 0 ? "+" : ""}{fmt(managerDiff)}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-[9px] mt-2" style={{ color: T.textFaint }}>実測未確認</p>
                )}
              </div>

              {/* 豊橋予備金 */}
              <div className="rounded-xl p-4" style={cardStyle}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px]" style={{ color: "#d4687e" }}>🏛 豊橋予備金</p>
                </div>
                <p className="text-[18px] font-medium" style={{ fontVariantNumeric: "tabular-nums" }}>{fmt(toyohashiBalance)}</p>
                <div className="text-[9px] mt-2" style={{ color: T.textFaint }}>
                  {monthlyWithdraw > 0 && <p>今月立替: -{fmt(monthlyWithdraw)}</p>}
                  {monthlyRefund > 0 && <p>今月補充: +{fmt(monthlyRefund)}</p>}
                  {monthlyWithdraw === 0 && monthlyRefund === 0 && <p>今月の動きなし</p>}
                  {latestToyohashiCheck && (
                    <p className="mt-1">
                      実測: {fmt(latestToyohashiCheck.toyohashi_reserve_actual || 0)}
                      {toyohashiDiff !== null && Math.abs(toyohashiDiff) > 0 && (
                        <span style={{ color: Math.abs(toyohashiDiff) > 5000 ? "#c45555" : "#f59e0b", marginLeft: 4 }}>
                          ({toyohashiDiff > 0 ? "+" : ""}{fmt(toyohashiDiff)})
                        </span>
                      )}
                    </p>
                  )}
                </div>
              </div>

              {/* 金庫未回収 */}
              <div className="rounded-xl p-4" style={cardStyle}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px]" style={{ color: "#a855f7" }}>🔐 金庫未回収</p>
                </div>
                <p className="text-[18px] font-medium" style={{ fontVariantNumeric: "tabular-nums" }}>{fmt(safeUncollected)}</p>
                <p className="text-[9px] mt-2" style={{ color: T.textFaint }}>
                  {safeUncollectedSettlements.length}件の未回収
                </p>
              </div>

              {/* ルーム未回収 */}
              <div className="rounded-xl p-4" style={cardStyle}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px]" style={{ color: "#22c55e" }}>🗄 ルーム未回収</p>
                </div>
                <p className="text-[18px] font-medium" style={{ fontVariantNumeric: "tabular-nums" }}>{fmt(roomUncollected)}</p>
                <p className="text-[9px] mt-2" style={{ color: T.textFaint }}>
                  {uncollectedSettlements.length}件の未回収
                </p>
              </div>
            </div>

            {/* スタッフ前借り情報カード */}
            {(pendingAdvances.length > 0 || settledAdvancesThisMonth.length > 0) && (() => {
              const pendingByStaff: Record<number, number> = {};
              pendingAdvances.forEach(a => { pendingByStaff[a.staff_id] = (pendingByStaff[a.staff_id] || 0) + a.amount; });
              const pendingStaffCount = Object.keys(pendingByStaff).length;
              const settledTotalThisMonth = settledAdvancesThisMonth.reduce((s, a) => s + (a.amount || 0), 0);
              const pendingTotal = totalPendingAdvances;
              return (
                <div className="rounded-xl p-4" style={{ backgroundColor: "#d4687e10", border: "1px solid #d4687e33" }}>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[12px] font-medium" style={{ color: "#d4687e" }}>💸 スタッフ前借り</p>
                    <Link href="/staff?tab=advances" className="text-[10px] cursor-pointer" style={{ color: "#d4687e" }}>詳細 →</Link>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <div>
                      <p className="text-[10px]" style={{ color: T.textSub }}>未精算（管理者金庫から控除中）</p>
                      <p className="text-[16px] font-medium tabular-nums" style={{ color: "#d4687e" }}>-{fmt(pendingTotal)}</p>
                      <p className="text-[9px]" style={{ color: T.textFaint }}>{pendingStaffCount}名 / {pendingAdvances.length}件</p>
                    </div>
                    <div>
                      <p className="text-[10px]" style={{ color: T.textSub }}>今月精算済（外注費へ振替）</p>
                      <p className="text-[16px] font-medium tabular-nums" style={{ color: "#22c55e" }}>{fmt(settledTotalThisMonth)}</p>
                      <p className="text-[9px]" style={{ color: T.textFaint }}>{settledAdvancesThisMonth.length}件</p>
                    </div>
                    <div className="col-span-2 md:col-span-1">
                      <p className="text-[10px]" style={{ color: T.textSub }}>次回自動精算</p>
                      <p className="text-[11px] mt-1" style={{ color: T.textMuted }}>毎月 第1月曜 12:00 以降</p>
                      <p className="text-[9px]" style={{ color: T.textFaint }}>前月分を外注費へ自動振替</p>
                    </div>
                  </div>
                  {pendingStaffCount > 0 && (
                    <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${T.border}` }}>
                      <p className="text-[10px] mb-1.5" style={{ color: T.textSub }}>未精算内訳</p>
                      <div className="flex flex-wrap gap-1.5">
                        {Object.entries(pendingByStaff).map(([sid, amt]) => {
                          const stf = allStaff.find(s => s.id === parseInt(sid));
                          return (
                            <span key={sid} className="text-[10px] px-2 py-0.5 rounded" style={{ backgroundColor: "#d4687e18", color: "#d4687e" }}>
                              {stf?.name || `ID:${sid}`} -{fmt(amt as number)}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* アクションボタン */}
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setShowAtmModal(true)} className="px-4 py-2.5 rounded-xl text-[12px] font-medium cursor-pointer" style={{ backgroundColor: "#4a7ca0", color: "white", border: "none" }}>
                🏦 ATM預入を記録
              </button>
              <button onClick={() => setShowReserveModal(true)} className="px-4 py-2.5 rounded-xl text-[12px] font-medium cursor-pointer" style={{ backgroundColor: "#d4687e", color: "white", border: "none" }}>
                🏛 豊橋予備金の動きを記録
              </button>
              <button onClick={() => setShowCheckModal(true)} className="px-4 py-2.5 rounded-xl text-[12px] font-medium cursor-pointer" style={{ backgroundColor: "#f59e0b", color: "white", border: "none" }}>
                📋 金庫残高確認
              </button>
              <button onClick={reVerifyAll} className="px-4 py-2.5 rounded-xl text-[12px] cursor-pointer" style={{ backgroundColor: T.cardAlt, color: T.textSub, border: `1px solid ${T.border}` }}>
                🔄 銀行側との照合を再実行
              </button>
              <div className="flex-1"></div>
              <Link href="/dashboard" className="px-4 py-2.5 rounded-xl text-[12px] cursor-pointer inline-flex items-center gap-1" style={{ backgroundColor: T.cardAlt, color: T.textSub, border: `1px solid ${T.border}`, textDecoration: "none" }}>
                📋 日次集計画面を開く →
              </Link>
            </div>

            {/* 豊橋予備金 動き履歴 */}
            <div className="rounded-xl overflow-hidden" style={cardStyle}>
              <div className="px-4 py-2.5 flex items-center justify-between" style={{ backgroundColor: T.cardAlt, borderBottom: `1px solid ${T.border}` }}>
                <div>
                  <span className="text-[12px] font-medium" style={{ color: "#d4687e" }}>🏛 豊橋予備金 動き履歴</span>
                  <p className="text-[9px] mt-0.5" style={{ color: T.textFaint }}>
                    立替 {toyohashiMoves.filter(m => m.movement_type === "withdraw").length}件 / 補充 {toyohashiMoves.filter(m => m.movement_type === "refund").length}件 / 現在残高 {fmt(toyohashiBalance)}
                  </p>
                </div>
              </div>
              <div style={{ maxHeight: 400, overflowY: "auto" }}>
                <table className="w-full" style={{ fontSize: 11 }}>
                  <thead style={{ position: "sticky", top: 0, backgroundColor: T.cardAlt }}>
                    <tr style={{ color: T.textSub, fontSize: 10 }}>
                      <th style={{ padding: "6px 10px", textAlign: "left", borderBottom: `1px solid ${T.border}` }}>日付</th>
                      <th style={{ padding: "6px 10px", textAlign: "center", borderBottom: `1px solid ${T.border}`, width: 80 }}>種別</th>
                      <th style={{ padding: "6px 10px", textAlign: "right", borderBottom: `1px solid ${T.border}` }}>金額</th>
                      <th style={{ padding: "6px 10px", textAlign: "left", borderBottom: `1px solid ${T.border}` }}>セラピスト</th>
                      <th style={{ padding: "6px 10px", textAlign: "left", borderBottom: `1px solid ${T.border}` }}>記録者</th>
                      <th style={{ padding: "6px 10px", textAlign: "left", borderBottom: `1px solid ${T.border}` }}>メモ</th>
                      <th style={{ padding: "6px 10px", textAlign: "center", borderBottom: `1px solid ${T.border}`, width: 60 }}>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {toyohashiMoves.length === 0 && <tr><td colSpan={7} style={{ padding: "24px", textAlign: "center", color: T.textFaint, fontSize: 11 }}>豊橋予備金の動き記録がありません。「🏛 豊橋予備金の動きを記録」から初期残高を設定してください。</td></tr>}
                    {toyohashiMoves.map((m, i) => {
                      const typeLabel: Record<string, {label: string; color: string; sign: string}> = {
                        withdraw: { label: "立替", color: "#c45555", sign: "-" },
                        refund: { label: "補充", color: "#22c55e", sign: "+" },
                        initial: { label: "初期", color: "#4a7ca0", sign: "+" },
                        adjustment: { label: "調整", color: "#f59e0b", sign: "+" },
                      };
                      const t = typeLabel[m.movement_type] || typeLabel.withdraw;
                      return (
                        <tr key={m.id} style={{ borderTop: `1px solid ${T.border}`, backgroundColor: i % 2 === 0 ? "transparent" : T.cardAlt + "40" }}>
                          <td style={{ padding: "6px 10px", fontVariantNumeric: "tabular-nums" }}>{m.movement_date}</td>
                          <td style={{ padding: "6px 10px", textAlign: "center" }}>
                            <span className="text-[9px] px-2 py-0.5 rounded" style={{ backgroundColor: t.color + "18", color: t.color }}>{t.label}</span>
                          </td>
                          <td style={{ padding: "6px 10px", textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 500, color: t.color }}>{t.sign}{fmt(m.amount)}</td>
                          <td style={{ padding: "6px 10px", color: T.textMuted }}>{getThName(m.therapist_id) || "—"}</td>
                          <td style={{ padding: "6px 10px", color: T.textMuted }}>{m.recorded_by_name}</td>
                          <td style={{ padding: "6px 10px", color: T.textMuted, fontSize: 10 }}>{m.note || "—"}</td>
                          <td style={{ padding: "6px 10px", textAlign: "center" }}>
                            <button onClick={() => deleteReserveMovement(m.id)} className="text-[9px] px-2 py-0.5 rounded cursor-pointer" style={{ backgroundColor: "#c4555518", color: "#c45555", border: "none" }}>🗑</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 金庫残高確認履歴 */}
            <div className="rounded-xl overflow-hidden" style={cardStyle}>
              <div className="px-4 py-2.5 flex items-center justify-between" style={{ backgroundColor: T.cardAlt, borderBottom: `1px solid ${T.border}` }}>
                <div>
                  <span className="text-[12px] font-medium" style={{ color: "#f59e0b" }}>📋 金庫残高確認履歴</span>
                  <p className="text-[9px] mt-0.5" style={{ color: T.textFaint }}>
                    実測値と理論値のズレをチェックする記録 (全{balanceChecks.length}件)
                  </p>
                </div>
              </div>
              <div style={{ maxHeight: 400, overflowY: "auto" }}>
                <table className="w-full" style={{ fontSize: 11 }}>
                  <thead style={{ position: "sticky", top: 0, backgroundColor: T.cardAlt }}>
                    <tr style={{ color: T.textSub, fontSize: 10 }}>
                      <th style={{ padding: "6px 10px", textAlign: "left", borderBottom: `1px solid ${T.border}` }}>確認日</th>
                      <th style={{ padding: "6px 10px", textAlign: "right", borderBottom: `1px solid ${T.border}` }}>🗄 管理者金庫</th>
                      <th style={{ padding: "6px 10px", textAlign: "right", borderBottom: `1px solid ${T.border}` }}>🗄 スタッフ金庫</th>
                      <th style={{ padding: "6px 10px", textAlign: "right", borderBottom: `1px solid ${T.border}` }}>🏛 豊橋予備金</th>
                      <th style={{ padding: "6px 10px", textAlign: "left", borderBottom: `1px solid ${T.border}` }}>確認者</th>
                      <th style={{ padding: "6px 10px", textAlign: "left", borderBottom: `1px solid ${T.border}` }}>メモ</th>
                      <th style={{ padding: "6px 10px", textAlign: "center", borderBottom: `1px solid ${T.border}`, width: 60 }}>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {balanceChecks.length === 0 && <tr><td colSpan={7} style={{ padding: "24px", textAlign: "center", color: T.textFaint, fontSize: 11 }}>金庫残高確認の記録がありません。「📋 金庫残高確認」から実測値を入力してください。</td></tr>}
                    {balanceChecks.map((c, i) => (
                      <tr key={c.id} style={{ borderTop: `1px solid ${T.border}`, backgroundColor: i % 2 === 0 ? "transparent" : T.cardAlt + "40" }}>
                        <td style={{ padding: "6px 10px", fontVariantNumeric: "tabular-nums" }}>{c.check_date}</td>
                        <td style={{ padding: "6px 10px", textAlign: "right", fontVariantNumeric: "tabular-nums", color: c.manager_safe_actual !== null ? T.text : T.textFaint }}>
                          {c.manager_safe_actual !== null ? fmt(c.manager_safe_actual) : "—"}
                        </td>
                        <td style={{ padding: "6px 10px", textAlign: "right", fontVariantNumeric: "tabular-nums", color: c.staff_safe_actual !== null ? T.text : T.textFaint }}>
                          {c.staff_safe_actual !== null ? fmt(c.staff_safe_actual) : "—"}
                        </td>
                        <td style={{ padding: "6px 10px", textAlign: "right", fontVariantNumeric: "tabular-nums", color: c.toyohashi_reserve_actual !== null ? T.text : T.textFaint }}>
                          {c.toyohashi_reserve_actual !== null ? fmt(c.toyohashi_reserve_actual) : "—"}
                        </td>
                        <td style={{ padding: "6px 10px", color: T.textMuted }}>{c.checked_by_name}</td>
                        <td style={{ padding: "6px 10px", color: T.textMuted, fontSize: 10 }}>{c.note || "—"}</td>
                        <td style={{ padding: "6px 10px", textAlign: "center" }}>
                          <button onClick={() => deleteBalanceCheck(c.id)} className="text-[9px] px-2 py-0.5 rounded cursor-pointer" style={{ backgroundColor: "#c4555518", color: "#c45555", border: "none" }}>🗑</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ATM預入履歴 */}
            <div className="rounded-xl overflow-hidden" style={cardStyle}>
              <div className="px-4 py-2.5 flex items-center justify-between" style={{ backgroundColor: T.cardAlt, borderBottom: `1px solid ${T.border}` }}>
                <div>
                  <span className="text-[12px] font-medium">🏦 ATM預入履歴</span>
                  <p className="text-[9px] mt-0.5" style={{ color: T.textFaint }}>
                    記録 {atmDeposits.length}件 ({fmt(totalAtmAmount)}) / 検証済み {verifiedAtms}件 / 未検証 {unverifiedAtms}件
                  </p>
                </div>
              </div>
              <div style={{ maxHeight: 500, overflowY: "auto" }}>
                <table className="w-full" style={{ fontSize: 11 }}>
                  <thead style={{ position: "sticky", top: 0, backgroundColor: T.cardAlt }}>
                    <tr style={{ color: T.textSub, fontSize: 10 }}>
                      <th style={{ padding: "6px 10px", textAlign: "left", borderBottom: `1px solid ${T.border}` }}>日付</th>
                      <th style={{ padding: "6px 10px", textAlign: "right", borderBottom: `1px solid ${T.border}` }}>金額</th>
                      <th style={{ padding: "6px 10px", textAlign: "center", borderBottom: `1px solid ${T.border}`, width: 140 }}>検証状態</th>
                      <th style={{ padding: "6px 10px", textAlign: "left", borderBottom: `1px solid ${T.border}` }}>記録者</th>
                      <th style={{ padding: "6px 10px", textAlign: "left", borderBottom: `1px solid ${T.border}` }}>メモ</th>
                      <th style={{ padding: "6px 10px", textAlign: "center", borderBottom: `1px solid ${T.border}`, width: 60 }}>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {atmDeposits.length === 0 && <tr><td colSpan={6} style={{ padding: "24px", textAlign: "center", color: T.textFaint, fontSize: 11 }}>ATM預入の記録がありません。「🏦 ATM預入を記録」から追加してください。</td></tr>}
                    {atmDeposits.map((a, i) => (
                      <tr key={a.id} style={{ borderTop: `1px solid ${T.border}`, backgroundColor: i % 2 === 0 ? "transparent" : T.cardAlt + "40" }}>
                        <td style={{ padding: "6px 10px", fontVariantNumeric: "tabular-nums" }}>{a.deposit_date}</td>
                        <td style={{ padding: "6px 10px", textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 500 }}>{fmt(a.amount)}</td>
                        <td style={{ padding: "6px 10px", textAlign: "center" }}>
                          {a.bank_verified ? (
                            <span className="text-[9px] px-2 py-0.5 rounded" style={{ backgroundColor: "#22c55e18", color: "#22c55e" }}>✓ 銀行側で確認済み</span>
                          ) : (
                            <span className="text-[9px] px-2 py-0.5 rounded" style={{ backgroundColor: "#f59e0b18", color: "#f59e0b" }}>⏳ 未検証</span>
                          )}
                        </td>
                        <td style={{ padding: "6px 10px", color: T.textMuted }}>{a.recorded_by_name}</td>
                        <td style={{ padding: "6px 10px", color: T.textMuted, fontSize: 10 }}>{a.note || "—"}</td>
                        <td style={{ padding: "6px 10px", textAlign: "center" }}>
                          <button onClick={() => deleteAtmDeposit(a.id)} className="text-[9px] px-2 py-0.5 rounded cursor-pointer" style={{ backgroundColor: "#c4555518", color: "#c45555", border: "none" }}>🗑</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 銀行取込で検出された三井住友ATM入金履歴 */}
            <div className="rounded-xl overflow-hidden" style={cardStyle}>
              <div className="px-4 py-2.5" style={{ backgroundColor: T.cardAlt, borderBottom: `1px solid ${T.border}` }}>
                <span className="text-[12px] font-medium">🔍 PayPay銀行の三井住友ATM入金履歴（参考）</span>
                <p className="text-[9px] mt-0.5" style={{ color: T.textFaint }}>
                  銀行CSVに記録されている「三井住友ＡＴＭ」の入金取引。上のATM預入記録とマッチングに使用される。
                </p>
              </div>
              <div style={{ maxHeight: 300, overflowY: "auto" }}>
                <table className="w-full" style={{ fontSize: 11 }}>
                  <thead style={{ position: "sticky", top: 0, backgroundColor: T.cardAlt }}>
                    <tr style={{ color: T.textSub, fontSize: 10 }}>
                      <th style={{ padding: "6px 10px", textAlign: "left", borderBottom: `1px solid ${T.border}` }}>取引日</th>
                      <th style={{ padding: "6px 10px", textAlign: "left", borderBottom: `1px solid ${T.border}` }}>摘要</th>
                      <th style={{ padding: "6px 10px", textAlign: "right", borderBottom: `1px solid ${T.border}` }}>入金額</th>
                      <th style={{ padding: "6px 10px", textAlign: "right", borderBottom: `1px solid ${T.border}` }}>残高</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allBankTxs.length === 0 && <tr><td colSpan={4} style={{ padding: "24px", textAlign: "center", color: T.textFaint, fontSize: 11 }}>銀行取込データがありません</td></tr>}
                    {allBankTxs.slice(0, 50).map((t, i) => (
                      <tr key={t.id} style={{ borderTop: `1px solid ${T.border}`, backgroundColor: i % 2 === 0 ? "transparent" : T.cardAlt + "40" }}>
                        <td style={{ padding: "6px 10px", fontVariantNumeric: "tabular-nums" }}>{t.transaction_date}</td>
                        <td style={{ padding: "6px 10px", color: T.textMuted, fontSize: 10 }}>{t.description}</td>
                        <td style={{ padding: "6px 10px", textAlign: "right", fontVariantNumeric: "tabular-nums", color: "#22c55e" }}>+{fmt(t.credit_amount)}</td>
                        <td style={{ padding: "6px 10px", textAlign: "right", fontVariantNumeric: "tabular-nums", color: T.textSub }}>{fmt(t.balance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 使い方 */}
            <div className="rounded-xl p-4" style={{ backgroundColor: "#4a7ca010", border: "1px solid #4a7ca033" }}>
              <p className="text-[12px] font-medium mb-2" style={{ color: "#4a7ca0" }}>💡 このダッシュボードについて</p>
              <div className="text-[11px] leading-relaxed" style={{ color: T.textSub }}>
                <p className="mb-2"><strong>入力は「日次集計」画面で</strong>：このダッシュボードは参照専用です。日々の売上・セラピスト支払・経費・金庫回収などはすべて既存の日次集計画面から入力してください。二重管理にならないよう設計されています。</p>
                <p className="mb-2"><strong>ATM預入の記録</strong>：管理者金庫からPayPay銀行への入金は「🏦 ATM預入を記録」ボタンから入力してください。</p>
                <p className="mb-2"><strong>銀行側との自動照合</strong>：PayPay銀行のCSVを取込むと、自動的に同日・同額の「三井住友ＡＴＭ」入金とマッチングし、「✓ 銀行側で確認済み」マークが付きます。手動で再照合したい場合は「🔄 銀行側との照合を再実行」ボタンをクリック。</p>
                <p><strong>残高の時差</strong>：PayPay銀行残高は、銀行CSVを取込んだ最終取引時点のものです。最新にするには税理士ポータル → 🏦 銀行取込 から最新CSVを取込んでください。</p>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ATM預入モーダル */}
      {showAtmModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => !atmSaving && setShowAtmModal(false)}>
          <div className="rounded-2xl p-5 w-full max-w-md" style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }} onClick={(e) => e.stopPropagation()}>
            <p className="text-[14px] font-medium mb-1">🏦 ATM預入を記録</p>
            <p className="text-[10px] mb-4" style={{ color: T.textFaint }}>管理者金庫 → PayPay銀行 への現金入金</p>

            <div className="space-y-3">
              <div>
                <label className="block text-[10px] mb-1" style={{ color: T.textSub }}>預入日</label>
                <input type="date" value={atmDate} onChange={(e) => setAtmDate(e.target.value)} className="w-full px-3 py-2 rounded-lg text-[12px] outline-none" style={{ backgroundColor: T.cardAlt, color: T.text, border: `1px solid ${T.border}` }} />
              </div>
              <div>
                <label className="block text-[10px] mb-1" style={{ color: T.textSub }}>預入額（円）</label>
                <input type="text" inputMode="numeric" value={atmAmount} onChange={(e) => setAtmAmount(e.target.value.replace(/[^0-9]/g, ""))} placeholder="例: 200000" className="w-full px-3 py-2 rounded-lg text-[16px] outline-none font-medium" style={{ backgroundColor: T.cardAlt, color: T.text, border: `1px solid ${T.border}`, fontVariantNumeric: "tabular-nums" }} />
                {atmAmount && <p className="text-[10px] mt-1" style={{ color: T.textSub }}>{fmt(parseInt(atmAmount))}</p>}
              </div>
              <div>
                <label className="block text-[10px] mb-1" style={{ color: T.textSub }}>メモ（任意）</label>
                <input type="text" value={atmNote} onChange={(e) => setAtmNote(e.target.value)} placeholder="例: 月末まとめ預入" className="w-full px-3 py-2 rounded-lg text-[12px] outline-none" style={{ backgroundColor: T.cardAlt, color: T.text, border: `1px solid ${T.border}` }} />
              </div>

              <div className="rounded-lg p-3 text-[10px]" style={{ backgroundColor: "#4a7ca010", border: "1px solid #4a7ca033", color: T.textSub }}>
                💡 記録後、PayPay銀行CSVを取込むと自動で「三井住友ＡＴＭ」の入金と照合され、「✓ 銀行側で確認済み」マークが付きます。
              </div>
            </div>

            <div className="flex gap-2 mt-4 justify-end">
              <button onClick={() => setShowAtmModal(false)} disabled={atmSaving} className="px-4 py-2 rounded-xl text-[11px] cursor-pointer" style={{ backgroundColor: T.cardAlt, color: T.textSub, border: `1px solid ${T.border}` }}>キャンセル</button>
              <button onClick={saveAtmDeposit} disabled={atmSaving || !atmAmount} className="px-4 py-2 rounded-xl text-[11px] cursor-pointer font-medium disabled:opacity-50" style={{ backgroundColor: "#4a7ca0", color: "white", border: "none" }}>
                {atmSaving ? "保存中..." : "💾 保存"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 豊橋予備金モーダル */}
      {showReserveModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => !reserveSaving && setShowReserveModal(false)}>
          <div className="rounded-2xl p-5 w-full max-w-md" style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }} onClick={(e) => e.stopPropagation()}>
            <p className="text-[14px] font-medium mb-1">🏛 豊橋予備金の動きを記録</p>
            <p className="text-[10px] mb-4" style={{ color: T.textFaint }}>現在残高: {fmt(toyohashiBalance)}</p>

            <div className="space-y-3">
              <div>
                <label className="block text-[10px] mb-2" style={{ color: T.textSub }}>種別</label>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setReserveType("withdraw")} className="py-2 rounded-lg text-[11px] cursor-pointer" style={{ backgroundColor: reserveType === "withdraw" ? "#c4555518" : T.cardAlt, color: reserveType === "withdraw" ? "#c45555" : T.textSub, border: `1px solid ${reserveType === "withdraw" ? "#c45555" : T.border}`, fontWeight: reserveType === "withdraw" ? 500 : 400 }}>
                    📤 立替（予備金→セラピスト）
                  </button>
                  <button onClick={() => setReserveType("refund")} className="py-2 rounded-lg text-[11px] cursor-pointer" style={{ backgroundColor: reserveType === "refund" ? "#22c55e18" : T.cardAlt, color: reserveType === "refund" ? "#22c55e" : T.textSub, border: `1px solid ${reserveType === "refund" ? "#22c55e" : T.border}`, fontWeight: reserveType === "refund" ? 500 : 400 }}>
                    📥 補充（スタッフ金庫→予備金）
                  </button>
                  <button onClick={() => setReserveType("initial")} className="py-2 rounded-lg text-[11px] cursor-pointer" style={{ backgroundColor: reserveType === "initial" ? "#4a7ca018" : T.cardAlt, color: reserveType === "initial" ? "#4a7ca0" : T.textSub, border: `1px solid ${reserveType === "initial" ? "#4a7ca0" : T.border}`, fontWeight: reserveType === "initial" ? 500 : 400 }}>
                    🎯 初期残高設定
                  </button>
                  <button onClick={() => setReserveType("adjustment")} className="py-2 rounded-lg text-[11px] cursor-pointer" style={{ backgroundColor: reserveType === "adjustment" ? "#f59e0b18" : T.cardAlt, color: reserveType === "adjustment" ? "#f59e0b" : T.textSub, border: `1px solid ${reserveType === "adjustment" ? "#f59e0b" : T.border}`, fontWeight: reserveType === "adjustment" ? 500 : 400 }}>
                    📝 棚卸調整
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[10px] mb-1" style={{ color: T.textSub }}>日付</label>
                <input type="date" value={reserveDate} onChange={(e) => setReserveDate(e.target.value)} className="w-full px-3 py-2 rounded-lg text-[12px] outline-none" style={{ backgroundColor: T.cardAlt, color: T.text, border: `1px solid ${T.border}` }} />
              </div>

              <div>
                <label className="block text-[10px] mb-1" style={{ color: T.textSub }}>金額（円）</label>
                <input type="text" inputMode="numeric" value={reserveAmount} onChange={(e) => setReserveAmount(e.target.value.replace(/[^0-9]/g, ""))} placeholder="例: 60000" className="w-full px-3 py-2 rounded-lg text-[16px] outline-none font-medium" style={{ backgroundColor: T.cardAlt, color: T.text, border: `1px solid ${T.border}`, fontVariantNumeric: "tabular-nums" }} />
                {reserveAmount && <p className="text-[10px] mt-1" style={{ color: T.textSub }}>{fmt(parseInt(reserveAmount))}</p>}
              </div>

              {reserveType === "withdraw" && (
                <div>
                  <label className="block text-[10px] mb-1" style={{ color: T.textSub }}>セラピスト <span style={{ color: "#c45555" }}>*必須</span></label>
                  <select value={reserveTherapistId || ""} onChange={(e) => setReserveTherapistId(e.target.value ? parseInt(e.target.value) : null)} className="w-full px-3 py-2 rounded-lg text-[12px] outline-none cursor-pointer" style={{ backgroundColor: T.cardAlt, color: T.text, border: `1px solid ${T.border}` }}>
                    <option value="">— 選択してください —</option>
                    {therapists.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-[10px] mb-1" style={{ color: T.textSub }}>メモ（任意）</label>
                <input type="text" value={reserveNote} onChange={(e) => setReserveNote(e.target.value)} placeholder={reserveType === "withdraw" ? "例: カード売上のため立替" : reserveType === "refund" ? "例: まとめて補充" : ""} className="w-full px-3 py-2 rounded-lg text-[12px] outline-none" style={{ backgroundColor: T.cardAlt, color: T.text, border: `1px solid ${T.border}` }} />
              </div>

              <div className="rounded-lg p-3 text-[10px]" style={{ backgroundColor: "#d4687e10", border: "1px solid #d4687e33", color: T.textSub }}>
                💡 {reserveType === "withdraw" && "セラピストへカード/PayPay売上分を現金で立替た記録。後日スタッフ金庫から予備金に補充する時に「補充」で記録してください。"}
                {reserveType === "refund" && "スタッフ金庫から豊橋予備金へ補充した記録。立替と補充の金額が合えば予備金残高は元に戻ります。"}
                {reserveType === "initial" && "運用開始時の初期残高を設定。1回だけ記録すればOK。"}
                {reserveType === "adjustment" && "棚卸で実測値に合わせる調整。差額の原因をメモに記載してください。"}
              </div>
            </div>

            <div className="flex gap-2 mt-4 justify-end">
              <button onClick={() => setShowReserveModal(false)} disabled={reserveSaving} className="px-4 py-2 rounded-xl text-[11px] cursor-pointer" style={{ backgroundColor: T.cardAlt, color: T.textSub, border: `1px solid ${T.border}` }}>キャンセル</button>
              <button onClick={saveReserveMovement} disabled={reserveSaving || !reserveAmount || (reserveType === "withdraw" && !reserveTherapistId)} className="px-4 py-2 rounded-xl text-[11px] cursor-pointer font-medium disabled:opacity-50" style={{ backgroundColor: "#d4687e", color: "white", border: "none" }}>
                {reserveSaving ? "保存中..." : "💾 保存"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 金庫残高確認モーダル */}
      {showCheckModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => !checkSaving && setShowCheckModal(false)}>
          <div className="rounded-2xl p-5 w-full max-w-lg" style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }} onClick={(e) => e.stopPropagation()}>
            <p className="text-[14px] font-medium mb-1">📋 金庫残高確認</p>
            <p className="text-[10px] mb-4" style={{ color: T.textFaint }}>実測値を入力。確認した金庫だけ入力すればOK（空欄は記録されません）</p>

            <div className="space-y-3">
              <div>
                <label className="block text-[10px] mb-1" style={{ color: T.textSub }}>確認日</label>
                <input type="date" value={checkDate} onChange={(e) => setCheckDate(e.target.value)} className="w-full px-3 py-2 rounded-lg text-[12px] outline-none" style={{ backgroundColor: T.cardAlt, color: T.text, border: `1px solid ${T.border}` }} />
              </div>

              <div className="rounded-lg p-3" style={{ backgroundColor: T.cardAlt }}>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px]" style={{ color: "#f59e0b" }}>🗄 管理者金庫</label>
                  <span className="text-[9px]" style={{ color: T.textFaint }}>理論値: {fmt(officeCashBalance)}</span>
                </div>
                <input type="text" inputMode="numeric" value={checkManagerSafe} onChange={(e) => setCheckManagerSafe(e.target.value.replace(/[^0-9]/g, ""))} placeholder="実測値（入力不要ならスキップ）" className="w-full px-3 py-2 rounded-lg text-[14px] outline-none" style={{ backgroundColor: T.card, color: T.text, border: `1px solid ${T.border}`, fontVariantNumeric: "tabular-nums" }} />
                {checkManagerSafe && (
                  <p className="text-[10px] mt-1" style={{ color: T.textSub }}>
                    {fmt(parseInt(checkManagerSafe))} / 差額 {(parseInt(checkManagerSafe) - officeCashBalance) > 0 ? "+" : ""}{fmt(parseInt(checkManagerSafe) - officeCashBalance)}
                  </p>
                )}
              </div>

              <div className="rounded-lg p-3" style={{ backgroundColor: T.cardAlt }}>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px]" style={{ color: "#22c55e" }}>🗄 スタッフ金庫</label>
                </div>
                <input type="text" inputMode="numeric" value={checkStaffSafe} onChange={(e) => setCheckStaffSafe(e.target.value.replace(/[^0-9]/g, ""))} placeholder="実測値（入力不要ならスキップ）" className="w-full px-3 py-2 rounded-lg text-[14px] outline-none" style={{ backgroundColor: T.card, color: T.text, border: `1px solid ${T.border}`, fontVariantNumeric: "tabular-nums" }} />
                {checkStaffSafe && (
                  <p className="text-[10px] mt-1" style={{ color: T.textSub }}>{fmt(parseInt(checkStaffSafe))}</p>
                )}
              </div>

              <div className="rounded-lg p-3" style={{ backgroundColor: T.cardAlt }}>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px]" style={{ color: "#d4687e" }}>🏛 豊橋予備金</label>
                  <span className="text-[9px]" style={{ color: T.textFaint }}>理論値: {fmt(toyohashiBalance)}</span>
                </div>
                <input type="text" inputMode="numeric" value={checkToyohashi} onChange={(e) => setCheckToyohashi(e.target.value.replace(/[^0-9]/g, ""))} placeholder="実測値（入力不要ならスキップ）" className="w-full px-3 py-2 rounded-lg text-[14px] outline-none" style={{ backgroundColor: T.card, color: T.text, border: `1px solid ${T.border}`, fontVariantNumeric: "tabular-nums" }} />
                {checkToyohashi && (
                  <p className="text-[10px] mt-1" style={{ color: T.textSub }}>
                    {fmt(parseInt(checkToyohashi))} / 差額 {(parseInt(checkToyohashi) - toyohashiBalance) > 0 ? "+" : ""}{fmt(parseInt(checkToyohashi) - toyohashiBalance)}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-[10px] mb-1" style={{ color: T.textSub }}>メモ（任意）</label>
                <input type="text" value={checkNote} onChange={(e) => setCheckNote(e.target.value)} placeholder="例: 月末棚卸" className="w-full px-3 py-2 rounded-lg text-[12px] outline-none" style={{ backgroundColor: T.cardAlt, color: T.text, border: `1px solid ${T.border}` }} />
              </div>
            </div>

            <div className="flex gap-2 mt-4 justify-end">
              <button onClick={() => setShowCheckModal(false)} disabled={checkSaving} className="px-4 py-2 rounded-xl text-[11px] cursor-pointer" style={{ backgroundColor: T.cardAlt, color: T.textSub, border: `1px solid ${T.border}` }}>キャンセル</button>
              <button onClick={saveBalanceCheck} disabled={checkSaving || (!checkManagerSafe && !checkStaffSafe && !checkToyohashi)} className="px-4 py-2 rounded-xl text-[11px] cursor-pointer font-medium disabled:opacity-50" style={{ backgroundColor: "#f59e0b", color: "white", border: "none" }}>
                {checkSaving ? "保存中..." : "💾 保存"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 管理者金庫 計算内訳モーダル */}
      {showBreakdownModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowBreakdownModal(false)}>
          <div className="rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col" style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }} onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: `1px solid ${T.border}` }}>
              <div>
                <p className="text-[14px] font-medium" style={{ color: "#f59e0b" }}>🗄 管理者金庫 計算内訳</p>
                <p className="text-[10px]" style={{ color: T.textFaint }}>理論値 {fmt(officeCashBalance)} の計算元データ一覧</p>
              </div>
              <button onClick={() => setShowBreakdownModal(false)} className="text-[14px] cursor-pointer p-1" style={{ color: T.textSub, border: "none", backgroundColor: "transparent" }}>✕</button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {/* 計算式サマリー */}
              <div className="rounded-xl p-4" style={{ backgroundColor: "#f59e0b10", border: "1px solid #f59e0b33" }}>
                <p className="text-[11px] font-medium mb-2" style={{ color: "#f59e0b" }}>📊 計算式</p>
                <div className="text-[11px] space-y-1" style={{ color: T.textSub, fontVariantNumeric: "tabular-nums" }}>
                  <div className="flex justify-between"><span>＋ 累積現金収入（精算 sales_collected=true 全て）</span><span style={{ color: "#22c55e" }}>+{fmt(cumulativeCashIn)}</span></div>
                  <div className="flex justify-between"><span>＋ 累積その他収入（経費管理の収入登録）</span><span style={{ color: "#22c55e" }}>+{fmt(cumulativeIncome)}</span></div>
                  <div className="flex justify-between"><span>− 累積経費（経費管理の経費登録）</span><span style={{ color: "#c45555" }}>-{fmt(cumulativeExpense)}</span></div>
                  <div className="flex justify-between"><span>− 累積釣銭補充（ルームへの補充）</span><span style={{ color: "#c45555" }}>-{fmt(totalReplenishAll)}</span></div>
                  <div className="flex justify-between"><span>− 累積ATM預入（管理者金庫→PayPay銀行）</span><span style={{ color: "#c45555" }}>-{fmt(cumulativeAtmDeposit)}</span></div>
                  <div className="flex justify-between"><span>− 累積予備金補充（スタッフ金庫→豊橋予備金）</span><span style={{ color: "#c45555" }}>-{fmt(totalReserveRefund)}</span></div>
                  <div className="flex justify-between"><span>− 未精算スタッフ前借り（月末精算で外注費へ振替予定）</span><span style={{ color: "#d4687e" }}>-{fmt(totalPendingAdvances)}</span></div>
                  <div className="flex justify-between pt-2 font-medium text-[13px]" style={{ borderTop: `1px solid ${T.border}`, color: T.text }}>
                    <span>= 管理者金庫 理論値</span>
                    <span>{fmt(officeCashBalance)}</span>
                  </div>
                  {latestManagerCheck && (
                    <>
                      <div className="flex justify-between text-[10px]" style={{ color: T.textFaint }}>
                        <span>実測値 ({latestManagerCheck.check_date})</span>
                        <span>{fmt(latestManagerCheck.manager_safe_actual || 0)}</span>
                      </div>
                      <div className="flex justify-between font-medium text-[12px]" style={{ color: Math.abs(managerDiff || 0) > 10000 ? "#c45555" : "#f59e0b" }}>
                        <span>差額（実測 - 理論）</span>
                        <span>{managerDiff !== null ? (managerDiff > 0 ? "+" : "") + fmt(managerDiff) : "—"}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* 精算データ内訳 */}
              <div className="rounded-xl overflow-hidden" style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}>
                <div className="px-4 py-2.5" style={{ backgroundColor: T.cardAlt, borderBottom: `1px solid ${T.border}` }}>
                  <p className="text-[11px] font-medium">＋ 累積現金収入 の内訳（{collectedSettlements.length}件）</p>
                </div>
                <div style={{ maxHeight: 250, overflowY: "auto" }}>
                  <table className="w-full" style={{ fontSize: 10 }}>
                    <thead style={{ position: "sticky", top: 0, backgroundColor: T.cardAlt }}>
                      <tr style={{ color: T.textSub, fontSize: 9 }}>
                        <th style={{ padding: "4px 8px", textAlign: "left" }}>日付</th>
                        <th style={{ padding: "4px 8px", textAlign: "left" }}>セラピスト</th>
                        <th style={{ padding: "4px 8px", textAlign: "right" }}>現金受取</th>
                        <th style={{ padding: "4px 8px", textAlign: "right" }}>支払</th>
                        <th style={{ padding: "4px 8px", textAlign: "right" }}>予備金</th>
                        <th style={{ padding: "4px 8px", textAlign: "right" }}>金庫入金</th>
                      </tr>
                    </thead>
                    <tbody>
                      {collectedSettlements.length === 0 && <tr><td colSpan={6} style={{ padding: "16px", textAlign: "center", color: T.textFaint }}>精算データがありません</td></tr>}
                      {collectedSettlements
                        .sort((a, b) => b.date.localeCompare(a.date))
                        .map((s, i) => {
                          const ru = s.reserve_used_amount || 0;
                          const net = Math.max((s.total_cash || 0) - (s.final_payment || 0) + ru, 0);
                          const rep = s.change_collected ? replenishAll.filter(r => r.room_id === s.room_id && r.date === s.date).reduce((a, b) => a + (b.amount || 0), 0) : 0;
                          const total = net + rep;
                          return (
                            <tr key={s.id} style={{ borderTop: `1px solid ${T.border}`, backgroundColor: i % 2 === 0 ? "transparent" : T.cardAlt + "40" }}>
                              <td style={{ padding: "4px 8px", fontVariantNumeric: "tabular-nums" }}>{s.date}</td>
                              <td style={{ padding: "4px 8px", color: T.textMuted }}>{getThName(s.therapist_id)}</td>
                              <td style={{ padding: "4px 8px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmt(s.total_cash || 0)}</td>
                              <td style={{ padding: "4px 8px", textAlign: "right", fontVariantNumeric: "tabular-nums", color: "#c45555" }}>-{fmt(s.final_payment || 0)}</td>
                              <td style={{ padding: "4px 8px", textAlign: "right", fontVariantNumeric: "tabular-nums", color: ru > 0 ? "#d4687e" : T.textFaint }}>{ru > 0 ? "+" + fmt(ru) : "—"}</td>
                              <td style={{ padding: "4px 8px", textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 500, color: total > 0 ? "#22c55e" : T.textFaint }}>+{fmt(total)}</td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 経費・収入 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${T.border}` }}>
                  <div className="px-3 py-2" style={{ backgroundColor: T.cardAlt, borderBottom: `1px solid ${T.border}` }}>
                    <p className="text-[10px] font-medium" style={{ color: "#c45555" }}>− 経費 ({expensesAll.filter(e => e.type === "expense").length}件 / {fmt(cumulativeExpense)})</p>
                  </div>
                  <div style={{ maxHeight: 150, overflowY: "auto", fontSize: 9 }}>
                    {expensesAll.filter(e => e.type === "expense").sort((a, b) => b.date.localeCompare(a.date)).slice(0, 20).map((e, i) => (
                      <div key={e.id} className="flex justify-between px-3 py-1" style={{ borderTop: i > 0 ? `1px solid ${T.border}` : "none" }}>
                        <span style={{ color: T.textMuted }}>{e.date.slice(5)} {e.category}</span>
                        <span style={{ color: "#c45555", fontVariantNumeric: "tabular-nums" }}>-{fmt(e.amount)}</span>
                      </div>
                    ))}
                    {expensesAll.filter(e => e.type === "expense").length === 0 && <p className="px-3 py-2 text-center" style={{ color: T.textFaint }}>経費なし</p>}
                  </div>
                </div>
                <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${T.border}` }}>
                  <div className="px-3 py-2" style={{ backgroundColor: T.cardAlt, borderBottom: `1px solid ${T.border}` }}>
                    <p className="text-[10px] font-medium" style={{ color: "#22c55e" }}>＋ その他収入 ({expensesAll.filter(e => e.type === "income").length}件 / {fmt(cumulativeIncome)})</p>
                  </div>
                  <div style={{ maxHeight: 150, overflowY: "auto", fontSize: 9 }}>
                    {expensesAll.filter(e => e.type === "income").sort((a, b) => b.date.localeCompare(a.date)).slice(0, 20).map((e, i) => (
                      <div key={e.id} className="flex justify-between px-3 py-1" style={{ borderTop: i > 0 ? `1px solid ${T.border}` : "none" }}>
                        <span style={{ color: T.textMuted }}>{e.date.slice(5)} {e.category}</span>
                        <span style={{ color: "#22c55e", fontVariantNumeric: "tabular-nums" }}>+{fmt(e.amount)}</span>
                      </div>
                    ))}
                    {expensesAll.filter(e => e.type === "income").length === 0 && <p className="px-3 py-2 text-center" style={{ color: T.textFaint }}>その他収入なし</p>}
                  </div>
                </div>
              </div>

              {/* 釣銭補充 */}
              <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${T.border}` }}>
                <div className="px-3 py-2" style={{ backgroundColor: T.cardAlt, borderBottom: `1px solid ${T.border}` }}>
                  <p className="text-[10px] font-medium" style={{ color: "#c45555" }}>− 釣銭補充 ({replenishAll.length}件 / {fmt(totalReplenishAll)})</p>
                </div>
                <div style={{ maxHeight: 120, overflowY: "auto", fontSize: 9 }}>
                  {replenishAll.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 20).map((r, i) => (
                    <div key={r.id} className="flex justify-between px-3 py-1" style={{ borderTop: i > 0 ? `1px solid ${T.border}` : "none" }}>
                      <span style={{ color: T.textMuted }}>{r.date.slice(5)} / room_id:{r.room_id}</span>
                      <span style={{ color: "#c45555", fontVariantNumeric: "tabular-nums" }}>-{fmt(r.amount)}</span>
                    </div>
                  ))}
                  {replenishAll.length === 0 && <p className="px-3 py-2 text-center" style={{ color: T.textFaint }}>釣銭補充なし</p>}
                </div>
              </div>

              {/* 差額の可能性がある原因 */}
              {managerDiff !== null && Math.abs(managerDiff) > 1000 && (
                <div className="rounded-xl p-4" style={{ backgroundColor: "#c4555510", border: "1px solid #c4555533" }}>
                  <p className="text-[11px] font-medium mb-2" style={{ color: "#c45555" }}>⚠️ 差額 {fmt(managerDiff)} の原因として考えられること</p>
                  <ul className="text-[10px] space-y-1 list-disc pl-5" style={{ color: T.textSub }}>
                    <li>過去のATM預入が未登録（ダッシュボードの「🏦 ATM預入を記録」で追加）</li>
                    <li>過去の精算が手動で金庫から補充・持ち出しされていた（「📋 金庫残高確認」で実測値を記録）</li>
                    <li>テストデータが混ざっている（運用開始前の精算データ）</li>
                    <li>経費が現金払い以外（振込・カード）なのに expenses に記録されていない</li>
                  </ul>
                </div>
              )}
            </div>

            <div className="px-5 py-3 flex justify-end" style={{ borderTop: `1px solid ${T.border}` }}>
              <button onClick={() => setShowBreakdownModal(false)} className="px-4 py-2 rounded-xl text-[11px] cursor-pointer" style={{ backgroundColor: T.cardAlt, color: T.textSub, border: `1px solid ${T.border}` }}>閉じる</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
