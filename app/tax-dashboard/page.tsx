"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";
import { useTheme } from "../../lib/theme";
import { NavMenu } from "../../lib/nav-menu";
import { useRole } from "../../lib/use-role";

type Reservation = { id: number; customer_name: string; therapist_id: number; date: string; start_time: string; end_time: string; course: string; notes: string };
type Course = { id: number; name: string; duration: number; price: number; therapist_back: number };
type Expense = { id: number; date: string; category: string; name: string; amount: number; store_id: number; is_recurring: boolean; notes: string; type: string };
type Store = { id: number; name: string };

const ACCOUNT_MAP: Record<string, string> = {
  rent: "地代家賃", utilities: "水道光熱費", supplies: "消耗品費",
  transport: "旅費交通費", advertising: "広告宣伝費", therapist_back: "外注費",
  income: "売上高（入金）", other: "雑費",
};

const fmt = (n: number) => "¥" + (n || 0).toLocaleString();

export default function TaxDashboard() {
  const router = useRouter();
  const { dark, toggle, T } = useTheme();
  const { role, loading: roleLoading, isOwner } = useRole();

  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [stores, setStores] = useState<Store[]>([]);

  const [mode, setMode] = useState<"monthly" | "yearly">("monthly");
  const [selectedMonth, setSelectedMonth] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; });
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());

  const [smYear, smMonth] = selectedMonth.split("-").map(Number);

  const fetchData = useCallback(async () => {
    const { data: c } = await supabase.from("courses").select("*"); if (c) setCourses(c);
    const { data: s } = await supabase.from("stores").select("*"); if (s) setStores(s);

    let startDate: string, endDate: string;
    if (mode === "monthly") {
      const dim = new Date(smYear, smMonth, 0).getDate();
      startDate = `${selectedMonth}-01`; endDate = `${selectedMonth}-${String(dim).padStart(2, "0")}`;
    } else {
      startDate = `${selectedYear}-01-01`; endDate = `${selectedYear}-12-31`;
    }

    const { data: r } = await supabase.from("reservations").select("*").gte("date", startDate).lte("date", endDate).order("date");
    if (r) setReservations(r);
    const { data: e } = await supabase.from("expenses").select("*").gte("date", startDate).lte("date", endDate).order("date");
    if (e) setExpenses(e);
  }, [mode, selectedMonth, selectedYear, smYear, smMonth]);

  useEffect(() => {
    const check = async () => { const { data: { user } } = await supabase.auth.getUser(); if (!user) router.push("/"); };
    check(); fetchData();
  }, [router, fetchData]);

  const getCourse = (name: string) => courses.find((c) => c.name === name);
  const getPrice = (r: Reservation) => getCourse(r.course)?.price || 0;
  const getBack = (r: Reservation) => getCourse(r.course)?.therapist_back || 0;

  // 集計
  const totalSales = reservations.reduce((s, r) => s + getPrice(r), 0);
  const totalBack = reservations.reduce((s, r) => s + getBack(r), 0);
  const totalExpenseOnly = expenses.filter((e) => e.type !== "income").reduce((s, e) => s + e.amount, 0);
  const totalIncomeExtra = expenses.filter((e) => e.type === "income").reduce((s, e) => s + e.amount, 0);
  const totalExpenseAll = totalExpenseOnly + totalBack;
  const grossRevenue = totalSales + totalIncomeExtra;
  const netProfit = grossRevenue - totalExpenseAll;

  // 勘定科目別集計
  const accountSummary = (() => {
    const map = new Map<string, number>();
    if (totalBack > 0) map.set("therapist_back", totalBack);
    for (const e of expenses) {
      if (e.type === "income") continue;
      const cat = e.category || "other";
      map.set(cat, (map.get(cat) || 0) + e.amount);
    }
    return Array.from(map.entries()).map(([cat, amount]) => ({
      category: cat, account: ACCOUNT_MAP[cat] || "雑費", amount,
    })).sort((a, b) => b.amount - a.amount);
  })();

  // 全取引明細
  const allTransactions = (() => {
    const items: { date: string; account: string; description: string; income: number; expense: number }[] = [];
    for (const r of reservations) {
      const price = getPrice(r);
      if (price > 0) items.push({ date: r.date, account: "売上高", description: `${r.customer_name} / ${r.course || "コースなし"}`, income: price, expense: 0 });
      const back = getBack(r);
      if (back > 0) items.push({ date: r.date, account: "外注費", description: `セラピストバック（${r.customer_name}）`, income: 0, expense: back });
    }
    for (const e of expenses) {
      const isIncome = e.type === "income";
      items.push({
        date: e.date,
        account: isIncome ? "売上高（入金）" : (ACCOUNT_MAP[e.category] || "雑費"),
        description: e.name + (e.notes ? ` / ${e.notes}` : ""),
        income: isIncome ? e.amount : 0,
        expense: isIncome ? 0 : e.amount,
      });
    }
    items.sort((a, b) => a.date.localeCompare(b.date));
    return items;
  })();

  // CSV エクスポート
  const exportCSV = () => {
    const BOM = "\uFEFF";
    const header = "日付,勘定科目,摘要,収入,支出\n";
    const rows = allTransactions.map((t) =>
      `${t.date},"${t.account}","${t.description.replace(/"/g, '""')}",${t.income || ""},${t.expense || ""}`
    ).join("\n");
    const csv = BOM + header + rows;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const period = mode === "monthly" ? selectedMonth : String(selectedYear);
    a.href = url; a.download = `税務報告_${period}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  // 勘定科目別CSV
  const exportAccountCSV = () => {
    const BOM = "\uFEFF";
    const header = "勘定科目,金額\n";
    const rows = accountSummary.map((a) => `"${a.account}",${a.amount}`).join("\n");
    const total = `\n"経費合計",${totalExpenseAll}\n"総売上",${grossRevenue}\n"純利益",${netProfit}`;
    const csv = BOM + header + rows + total;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const period = mode === "monthly" ? selectedMonth : String(selectedYear);
    a.href = url; a.download = `勘定科目別_${period}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const prevMonth = () => { const d = new Date(smYear, smMonth - 2, 1); setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`); };
  const nextMonth = () => { const d = new Date(smYear, smMonth, 1); setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`); };

  const periodLabel = mode === "monthly" ? `${smYear}年${smMonth}月` : `${selectedYear}年`;

  // 権限チェック
  if (roleLoading) return <div className="h-screen flex items-center justify-center" style={{ backgroundColor: T.bg, color: T.text }}><p className="text-[14px]" style={{ color: T.textMuted }}>読み込み中...</p></div>;
  if (!isOwner) return (
    <div className="h-screen flex flex-col items-center justify-center" style={{ backgroundColor: T.bg, color: T.text }}>
      <div className="text-[48px] mb-4">🔒</div>
      <h2 className="text-[18px] font-medium mb-2">アクセス権限がありません</h2>
      <p className="text-[13px] mb-6" style={{ color: T.textMuted }}>このページはオーナー権限が必要です</p>
      <button onClick={() => router.push("/dashboard")} className="px-6 py-3 bg-gradient-to-r from-[#c3a782] to-[#b09672] text-white text-[12px] rounded-xl cursor-pointer">ダッシュボードに戻る</button>
    </div>
  );

  return (
    <div className="h-screen flex flex-col" style={{ backgroundColor: T.bg, color: T.text }}>
      {/* Header */}
      <div className="h-[56px] flex items-center justify-between px-4 flex-shrink-0 border-b" style={{ backgroundColor: T.card, borderColor: T.border }}>
        <div className="flex items-center gap-3">
          <NavMenu T={T} dark={dark} />
          <h1 className="text-[14px] font-medium">税務報告用ダッシュボード</h1>
          <span className="px-2 py-0.5 rounded text-[9px] font-medium" style={{ backgroundColor: "#c4555518", color: "#c45555" }}>🔒 オーナー専用</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={toggle} className="px-2.5 py-1.5 text-[10px] rounded-lg cursor-pointer border" style={{ borderColor: T.border, color: T.textSub }}>{dark ? "☀️ ライト" : "🌙 ダーク"}</button>
          <button onClick={exportCSV} className="px-3 py-1.5 text-[10px] rounded-lg cursor-pointer text-white" style={{ backgroundColor: "#22c55e" }}>📥 明細CSV</button>
          <button onClick={exportAccountCSV} className="px-3 py-1.5 text-[10px] rounded-lg cursor-pointer text-white" style={{ backgroundColor: "#3b82f6" }}>📥 科目別CSV</button>
        </div>
      </div>

      {/* Period Selector */}
      <div className="h-[48px] flex items-center justify-center gap-4 flex-shrink-0 border-b" style={{ backgroundColor: T.card, borderColor: T.border }}>
        <div className="flex gap-1 mr-4">
          <button onClick={() => setMode("monthly")} className="px-3 py-1 text-[11px] rounded-lg cursor-pointer" style={{ backgroundColor: mode === "monthly" ? T.accent + "18" : "transparent", color: mode === "monthly" ? T.accent : T.textMuted, fontWeight: mode === "monthly" ? 600 : 400 }}>月次</button>
          <button onClick={() => setMode("yearly")} className="px-3 py-1 text-[11px] rounded-lg cursor-pointer" style={{ backgroundColor: mode === "yearly" ? T.accent + "18" : "transparent", color: mode === "yearly" ? T.accent : T.textMuted, fontWeight: mode === "yearly" ? 600 : 400 }}>年次</button>
        </div>
        {mode === "monthly" ? (<>
          <button onClick={prevMonth} className="p-1 cursor-pointer" style={{ color: T.textSub }}>◀</button>
          <span className="text-[14px] font-medium min-w-[120px] text-center">{smYear}年{smMonth}月</span>
          <button onClick={nextMonth} className="p-1 cursor-pointer" style={{ color: T.textSub }}>▶</button>
        </>) : (<>
          <button onClick={() => setSelectedYear(selectedYear - 1)} className="p-1 cursor-pointer" style={{ color: T.textSub }}>◀</button>
          <span className="text-[14px] font-medium min-w-[100px] text-center">{selectedYear}年</span>
          <button onClick={() => setSelectedYear(selectedYear + 1)} className="p-1 cursor-pointer" style={{ color: T.textSub }}>▶</button>
        </>)}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-[900px] mx-auto">

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[
              { label: "総売上", value: fmt(grossRevenue), sub: `予約売上 ${fmt(totalSales)}${totalIncomeExtra > 0 ? ` + 入金 ${fmt(totalIncomeExtra)}` : ""}`, color: "#22c55e" },
              { label: "総経費", value: fmt(totalExpenseAll), sub: `バック ${fmt(totalBack)} + 経費 ${fmt(totalExpenseOnly)}`, color: "#c45555" },
              { label: "純利益", value: fmt(netProfit), sub: `利益率 ${grossRevenue > 0 ? Math.round((netProfit / grossRevenue) * 100) : 0}%`, color: netProfit >= 0 ? "#22c55e" : "#c45555" },
              { label: "取引件数", value: `${allTransactions.length}件`, sub: `予約 ${reservations.length}件 / 経費 ${expenses.length}件`, color: "#85a8c4" },
            ].map((s) => (
              <div key={s.label} className="rounded-2xl border p-5" style={{ backgroundColor: T.card, borderColor: T.border }}>
                <p className="text-[10px] mb-2" style={{ color: T.textMuted }}>{s.label}</p>
                <p className="text-[22px] font-light mb-1" style={{ color: s.color }}>{s.value}</p>
                <p className="text-[9px]" style={{ color: T.textFaint }}>{s.sub}</p>
              </div>
            ))}
          </div>

          {/* 勘定科目別集計 */}
          <div className="rounded-2xl border p-5 mb-6" style={{ backgroundColor: T.card, borderColor: T.border }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[14px] font-medium">勘定科目別集計</h2>
              <span className="text-[11px]" style={{ color: T.textMuted }}>{periodLabel}</span>
            </div>
            {accountSummary.length === 0 ? (
              <p className="text-[12px] text-center py-6" style={{ color: T.textFaint }}>データがありません</p>
            ) : (
              <table className="w-full text-[12px]">
                <thead><tr style={{ borderBottom: `2px solid ${T.border}` }}>
                  {["勘定科目", "金額", "構成比"].map((h) => (<th key={h} className="py-2 px-3 text-left font-medium text-[11px]" style={{ color: T.textMuted }}>{h}</th>))}
                </tr></thead>
                <tbody>
                  {accountSummary.map((a) => (
                    <tr key={a.category} style={{ borderBottom: `1px solid ${T.border}` }}>
                      <td className="py-2.5 px-3 font-medium">{a.account}</td>
                      <td className="py-2.5 px-3" style={{ color: "#c45555" }}>{fmt(a.amount)}</td>
                      <td className="py-2.5 px-3" style={{ color: T.textSub }}>{totalExpenseAll > 0 ? Math.round((a.amount / totalExpenseAll) * 100) : 0}%</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: `2px solid ${T.border}` }}>
                    <td className="py-2.5 px-3 font-bold">経費合計</td>
                    <td className="py-2.5 px-3 font-bold" style={{ color: "#c45555" }}>{fmt(totalExpenseAll)}</td>
                    <td className="py-2.5 px-3 font-bold">100%</td>
                  </tr>
                  <tr><td className="py-2 px-3 font-bold" style={{ color: "#22c55e" }}>総売上</td><td className="py-2 px-3 font-bold" style={{ color: "#22c55e" }}>{fmt(grossRevenue)}</td><td /></tr>
                  <tr style={{ borderTop: `2px solid ${T.accent}` }}><td className="py-2.5 px-3 font-bold text-[13px]">純利益</td><td className="py-2.5 px-3 font-bold text-[13px]" style={{ color: netProfit >= 0 ? "#22c55e" : "#c45555" }}>{fmt(netProfit)}</td><td /></tr>
                </tfoot>
              </table>
            )}
          </div>

          {/* 取引明細 */}
          <div className="rounded-2xl border overflow-hidden mb-6" style={{ backgroundColor: T.card, borderColor: T.border }}>
            <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: `1px solid ${T.border}` }}>
              <h2 className="text-[14px] font-medium">全取引明細</h2>
              <span className="text-[11px]" style={{ color: T.textMuted }}>{allTransactions.length}件</span>
            </div>
            {allTransactions.length === 0 ? (
              <p className="text-[12px] text-center py-12" style={{ color: T.textFaint }}>データがありません</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[11px]">
                  <thead><tr style={{ borderBottom: `1px solid ${T.border}` }}>
                    {["日付", "勘定科目", "摘要", "収入", "支出"].map((h) => (
                      <th key={h} className="py-2.5 px-3 text-left font-normal text-[10px]" style={{ color: T.textMuted }}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {allTransactions.map((t, i) => (
                      <tr key={i} style={{ borderBottom: `1px solid ${T.border}` }}>
                        <td className="py-2 px-3 whitespace-nowrap">{t.date}</td>
                        <td className="py-2 px-3 whitespace-nowrap">{t.account}</td>
                        <td className="py-2 px-3 max-w-[300px] truncate">{t.description}</td>
                        <td className="py-2 px-3 whitespace-nowrap font-medium" style={{ color: t.income > 0 ? "#22c55e" : T.textFaint }}>{t.income > 0 ? fmt(t.income) : ""}</td>
                        <td className="py-2 px-3 whitespace-nowrap font-medium" style={{ color: t.expense > 0 ? "#c45555" : T.textFaint }}>{t.expense > 0 ? fmt(t.expense) : ""}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot><tr style={{ borderTop: `2px solid ${T.border}` }}>
                    <td colSpan={3} className="py-2.5 px-3 font-bold">合計</td>
                    <td className="py-2.5 px-3 font-bold" style={{ color: "#22c55e" }}>{fmt(allTransactions.reduce((s, t) => s + t.income, 0))}</td>
                    <td className="py-2.5 px-3 font-bold" style={{ color: "#c45555" }}>{fmt(allTransactions.reduce((s, t) => s + t.expense, 0))}</td>
                  </tr></tfoot>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      <style jsx global>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  );
}
