"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../lib/supabase";
import { useStaffSession } from "../../lib/staff-session";
import { useTheme } from "../../lib/theme";

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
};

type Replenish = { id: number; room_id: number; date: string; amount: number };
type ExpenseRec = { id: number; date: string; amount: number; type: string; category: string };

const fmt = (n: number) => "¥" + (n || 0).toLocaleString();

export default function CashDashboard() {
  const router = useRouter();
  const { dark, toggle, T } = useTheme();
  const { activeStaff, canAccessCashDashboard } = useStaffSession();

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
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (canAccessCashDashboard) fetchData(); }, [canAccessCashDashboard, fetchData]);

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
    if (!confirm("このATM預入記録を削除しますか？")) return;
    await supabase.from("atm_deposits").delete().eq("id", id);
    fetchData();
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
  const safeUncollectedSettlements = settlements.filter(s => s.safe_deposited && !s.safe_collected_date);
  const safeUncollected = safeUncollectedSettlements.reduce((sum, s) => {
    const net = Math.max((s.total_cash || 0) - (s.final_payment || 0), 0);
    const rep = replenishAll.filter(r => r.room_id === s.room_id && r.date === s.date).reduce((a, b) => a + (b.amount || 0), 0);
    return sum + net + rep;
  }, 0);

  // 事務所残金（ATM預入を差し引いた後の理論値）
  // 累積の現金収入 = 精算済み（sales_collected=true）の net_cash_after_pay の合計
  // 経費 = expenses.type='expense' で現金払いの分（現状すべて経費を現金払いと仮定）
  // ATM預入 = すべての atm_deposits の合計
  // 事務所残金 = 累積現金収入 - 累積経費 + 累積収入 - 累積ATM預入
  const collectedSettlements = settlements.filter(s => s.sales_collected);
  const cumulativeCashIn = collectedSettlements.reduce((sum, s) => {
    const net = Math.max((s.total_cash || 0) - (s.final_payment || 0), 0);
    const rep = s.change_collected ? replenishAll.filter(r => r.room_id === s.room_id && r.date === s.date).reduce((a, b) => a + (b.amount || 0), 0) : 0;
    return sum + net + rep;
  }, 0);
  const totalReplenishAll = replenishAll.reduce((s, r) => s + (r.amount || 0), 0);
  const cumulativeExpense = expensesAll.filter(e => e.type === "expense").reduce((s, e) => s + (e.amount || 0), 0);
  const cumulativeIncome = expensesAll.filter(e => e.type === "income").reduce((s, e) => s + (e.amount || 0), 0);
  const cumulativeAtmDeposit = atmDeposits.reduce((s, a) => s + (a.amount || 0), 0);
  const officeCashBalance = cumulativeCashIn + cumulativeIncome - cumulativeExpense - totalReplenishAll - cumulativeAtmDeposit;

  // 検証済み/未検証のATM預入
  const verifiedAtms = atmDeposits.filter(a => a.bank_verified).length;
  const unverifiedAtms = atmDeposits.length - verifiedAtms;
  const totalAtmAmount = atmDeposits.reduce((s, a) => s + a.amount, 0);

  // 合計資産
  const totalAssets = bankBalance + officeCashBalance + safeUncollected + roomUncollected;

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
                PayPay銀行 + 事務所残金 + 金庫未回収 + ルーム未回収
              </p>
            </div>

            {/* 4つの財布 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* PayPay銀行 */}
              <div className="rounded-xl p-4" style={cardStyle}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px]" style={{ color: "#4a7ca0" }}>🏦 PayPay銀行</p>
                </div>
                <p className="text-[20px] font-medium" style={{ fontVariantNumeric: "tabular-nums" }}>{fmt(bankBalance)}</p>
                {latestBankTx ? (
                  <p className="text-[9px] mt-2" style={{ color: T.textFaint }}>
                    最新: {latestBankTx.transaction_date.slice(5)} / {latestBankTx.description.slice(0, 20)}
                  </p>
                ) : (
                  <p className="text-[9px] mt-2" style={{ color: T.textFaint }}>銀行取込データなし</p>
                )}
              </div>

              {/* 事務所残金（管理者金庫） */}
              <div className="rounded-xl p-4" style={cardStyle}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px]" style={{ color: "#f59e0b" }}>🗄 管理者金庫（事務所残金）</p>
                </div>
                <p className="text-[20px] font-medium" style={{ fontVariantNumeric: "tabular-nums" }}>{fmt(officeCashBalance)}</p>
                <p className="text-[9px] mt-2" style={{ color: T.textFaint }}>
                  累積収支 - ATM預入合計
                </p>
              </div>

              {/* 金庫未回収 */}
              <div className="rounded-xl p-4" style={cardStyle}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px]" style={{ color: "#a855f7" }}>🔐 金庫未回収</p>
                </div>
                <p className="text-[20px] font-medium" style={{ fontVariantNumeric: "tabular-nums" }}>{fmt(safeUncollected)}</p>
                <p className="text-[9px] mt-2" style={{ color: T.textFaint }}>
                  {safeUncollectedSettlements.length}件の未回収
                </p>
              </div>

              {/* ルーム未回収 */}
              <div className="rounded-xl p-4" style={cardStyle}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px]" style={{ color: "#22c55e" }}>🗄 ルーム未回収</p>
                </div>
                <p className="text-[20px] font-medium" style={{ fontVariantNumeric: "tabular-nums" }}>{fmt(roomUncollected)}</p>
                <p className="text-[9px] mt-2" style={{ color: T.textFaint }}>
                  {uncollectedSettlements.length}件の未回収
                </p>
              </div>
            </div>

            {/* アクションボタン */}
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setShowAtmModal(true)} className="px-4 py-2.5 rounded-xl text-[12px] font-medium cursor-pointer" style={{ backgroundColor: "#4a7ca0", color: "white", border: "none" }}>
                🏦 ATM預入を記録
              </button>
              <button onClick={reVerifyAll} className="px-4 py-2.5 rounded-xl text-[12px] cursor-pointer" style={{ backgroundColor: T.cardAlt, color: T.textSub, border: `1px solid ${T.border}` }}>
                🔄 銀行側との照合を再実行
              </button>
              <div className="flex-1"></div>
              <Link href="/dashboard" className="px-4 py-2.5 rounded-xl text-[12px] cursor-pointer inline-flex items-center gap-1" style={{ backgroundColor: T.cardAlt, color: T.textSub, border: `1px solid ${T.border}`, textDecoration: "none" }}>
                📋 日次集計画面を開く →
              </Link>
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
    </div>
  );
}
