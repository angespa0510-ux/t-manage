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

  const [dashTab, setDashTab] = useState<"summary" | "therapist_payroll" | "staff_payroll">("summary");
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
          </div>
        <div className="flex items-center gap-2">
          {[{k:"summary",l:"📊 経理サマリー"},{k:"therapist_payroll",l:"📑 セラピスト支払調書"},{k:"staff_payroll",l:"📑 スタッフ支払調書"}].map(t => (
            <button key={t.k} onClick={() => setDashTab(t.k as any)} className="px-3 py-1.5 text-[10px] rounded-lg cursor-pointer" style={{ backgroundColor: dashTab === t.k ? "#c3a78222" : "transparent", color: dashTab === t.k ? "#c3a782" : T.textMuted, fontWeight: dashTab === t.k ? 700 : 400, border: `1px solid ${dashTab === t.k ? "#c3a78244" : T.border}` }}>{t.l}</button>
          ))}
        </div>
        <div className="flex items-center gap-2">
        <span className="px-2 py-0.5 rounded text-[9px] font-medium" style={{ backgroundColor: "#c4555518", color: "#c45555" }}>🔒 オーナー専用</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={toggle} className="px-2.5 py-1.5 text-[10px] rounded-lg cursor-pointer border" style={{ borderColor: T.border, color: T.textSub }}>{dark ? "☀️ ライト" : "🌙 ダーク"}</button>
          <button onClick={exportCSV} className="px-3 py-1.5 text-[10px] rounded-lg cursor-pointer text-white" style={{ backgroundColor: "#22c55e" }}>📥 明細CSV</button>
          <button onClick={exportAccountCSV} className="px-3 py-1.5 text-[10px] rounded-lg cursor-pointer text-white" style={{ backgroundColor: "#3b82f6" }}>📥 科目別CSV</button>
        </div>
      </div>

      {/* Period Selector */}
      {dashTab === "summary" && (<>
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
</>)}
      {dashTab === "therapist_payroll" && (
        <div className="flex-1 overflow-y-auto p-4">
          <TherapistPayroll T={T} />
        </div>
      )}
      {dashTab === "staff_payroll" && (
        <div className="flex-1 overflow-y-auto p-4">
          <StaffPayroll T={T} />
        </div>
      )}
      <style jsx global>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  );
}

function TherapistPayroll({ T }: { T: any }) {
  const [year, setYear] = useState(new Date().getFullYear());
  const [therapists, setTherapists] = useState<any[]>([]);
  const [data, setData] = useState<{ id: number; name: string; gross: number; invoiceDed: number; tax: number; welfare: number; transport: number; total: number; days: number }[]>([]);
  const [loading, setLoading] = useState(false);
  const [storeInfo, setStoreInfo] = useState<any>(null);
  const fmt = (n: number) => "¥" + (n || 0).toLocaleString();

  useEffect(() => {
    const f = async () => {
      const { data: th } = await supabase.from("therapists").select("*"); if (th) setTherapists(th);
      const { data: st } = await supabase.from("stores").select("*"); if (st?.[0]) setStoreInfo(st[0]);
    }; f();
  }, []);

  const fetchPayroll = useCallback(async () => {
    if (therapists.length === 0) return;
    setLoading(true);
    const { data: settlements } = await supabase.from("therapist_daily_settlements").select("therapist_id, total_back, invoice_deduction, withholding_tax, adjustment, final_payment, transport_fee, welfare_fee").gte("date", `${year}-01-01`).lte("date", `${year}-12-31`).eq("is_settled", true);
    const thMap: Record<number, { name: string; gross: number; invoiceDed: number; tax: number; welfare: number; transport: number; final: number; days: number }> = {};
    (settlements || []).forEach(s => {
      if (!thMap[s.therapist_id]) {
        const th = therapists.find(t => t.id === s.therapist_id);
        thMap[s.therapist_id] = { name: th?.name || "不明", gross: 0, invoiceDed: 0, tax: 0, welfare: 0, transport: 0, final: 0, days: 0 };
      }
      const th = therapists.find(t => t.id === s.therapist_id);
      const backAmt = (s.total_back || 0) + (s.adjustment || 0);
      const transportFee = s.transport_fee || th?.transport_fee || 0;
      let dayWT = s.withholding_tax || 0;
      if (dayWT === 0 && th?.has_withholding) { dayWT = Math.floor(Math.max(backAmt - (s.invoice_deduction || 0) - 5000, 0) * 0.1021); }
      thMap[s.therapist_id].gross += backAmt;
      thMap[s.therapist_id].invoiceDed += (s.invoice_deduction || 0);
      thMap[s.therapist_id].tax += dayWT;
      thMap[s.therapist_id].welfare += (s.welfare_fee || 0);
      thMap[s.therapist_id].transport += transportFee;
      thMap[s.therapist_id].final += (s.final_payment || 0);
      thMap[s.therapist_id].days += 1;
    });
    const result = Object.entries(thMap).map(([id, d]) => ({ id: Number(id), name: d.name, gross: d.gross, invoiceDed: d.invoiceDed, tax: d.tax, welfare: d.welfare, transport: d.transport, total: d.final, days: d.days }));
    result.sort((a, b) => b.gross - a.gross);
    setData(result);
    setLoading(false);
  }, [year, therapists]);

  useEffect(() => { fetchPayroll(); }, [fetchPayroll]);

  const openPDF = (row: typeof data[0]) => {
    const store = storeInfo;
    const th = therapists.find(t => t.id === row.id);
    const realName = th?.real_name || row.name;
    const hasInvoice = th?.has_invoice || false;
    const invoiceNum = th?.therapist_invoice_number || "";
    const w = window.open("", "_blank"); if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>支払調書_${year}_${realName}</title>
    <style>body{font-family:'Hiragino Sans','Yu Gothic','Meiryo',sans-serif;max-width:750px;margin:40px auto;padding:30px;color:#333}h1{text-align:center;font-size:20px;border-bottom:3px double #333;padding-bottom:10px;margin-bottom:5px;letter-spacing:4px}h2{text-align:center;font-size:12px;color:#888;font-weight:normal;margin-bottom:25px}table{width:100%;border-collapse:collapse;margin:15px 0}td,th{border:1px solid #ccc;padding:9px 14px;font-size:12px}th{background:#f5f0e8;text-align:left;width:38%}.right{text-align:right}.total-row{background:#f9f6f0;font-weight:bold;font-size:14px}.section{margin-top:25px;padding-top:15px;border-top:1px solid #ddd}.company{font-size:11px;line-height:2;color:#555}.note{font-size:9px;color:#888;margin-top:4px;line-height:1.8}.doc-title{font-size:9px;color:#999;text-align:right;margin-bottom:20px}.stamp-area{display:flex;justify-content:space-between;margin-top:40px}.stamp-box{border-top:1px solid #333;width:180px;text-align:center;padding-top:5px;font-size:10px;color:#888}@media print{body{margin:0;padding:20px}}</style></head><body>
    <p class="doc-title">報酬、料金、契約金及び賞金の支払調書</p><h1>支　払　調　書</h1><h2>対象期間：${year}年1月1日 〜 ${year}年12月31日</h2>
    <table><tr><th>支払を受ける者（氏名）</th><td>${realName}</td></tr>${realName !== row.name ? `<tr><th>業務上の名称</th><td>${row.name}</td></tr>` : ""}<tr><th>支払を受ける者（住所）</th><td>${th?.address || '<span style="color:#c45555">※未登録</span>'}</td></tr>${th?.birth_date ? `<tr><th>生年月日</th><td>${th.birth_date}</td></tr>` : ""}<tr><th>区分</th><td>${th?.has_withholding ? "報酬（所得税法第204条第1項第6号）" : "報酬（所得税法第204条第1項第1号）"}</td></tr><tr><th>細目</th><td>${th?.has_withholding ? "ホステス等の業務に関する報酬" : "エステティック施術業務"}</td></tr><tr><th>適格請求書発行事業者</th><td>${hasInvoice ? `登録あり（登録番号：${invoiceNum}）` : "未登録"}</td></tr></table>
    <table><tr><th style="width:45%">項目</th><th class="right" style="width:20%">金額</th><th style="width:35%">摘要</th></tr>
    <tr><td>稼働日数</td><td class="right">${row.days}日</td><td style="font-size:10px;color:#888">年間清算回数</td></tr>
    <tr><td><strong>支払金額（税込）</strong></td><td class="right"><strong>&yen;${row.gross.toLocaleString()}</strong></td><td style="font-size:10px;color:#888">業務委託報酬の年間合計</td></tr>
    ${row.invoiceDed > 0 ? `<tr><td style="color:#c45555">仕入税額控除の経過措置</td><td class="right" style="color:#c45555">-&yen;${row.invoiceDed.toLocaleString()}</td><td style="font-size:10px;color:#888">報酬額の10%を控除</td></tr><tr style="background:#f9f6f0"><td>控除後の報酬額</td><td class="right">&yen;${(row.gross - row.invoiceDed).toLocaleString()}</td><td style="font-size:10px;color:#888">支払金額 − 仕入税額控除</td></tr>` : ""}
    ${row.tax > 0 ? `<tr><td style="color:#c45555">源泉徴収税額</td><td class="right" style="color:#c45555">-&yen;${row.tax.toLocaleString()}</td><td style="font-size:10px;color:#888">所得税及び復興特別所得税</td></tr>` : `<tr><td>源泉徴収税額</td><td class="right">&yen;0</td><td style="font-size:10px;color:#888">源泉徴収対象外</td></tr>`}
    ${row.welfare > 0 ? `<tr><td style="color:#c45555">福利厚生費</td><td class="right" style="color:#c45555">-&yen;${row.welfare.toLocaleString()}</td><td style="font-size:10px;color:#888">&yen;500/日 × ${row.days}日</td></tr>` : ""}
    ${row.transport > 0 ? `<tr><td>交通費（非課税）</td><td class="right">&yen;${row.transport.toLocaleString()}</td><td style="font-size:10px;color:#888">&yen;${Math.round(row.transport / row.days).toLocaleString()}/日 × ${row.days}日</td></tr>` : ""}
    <tr class="total-row"><td>差引支払額</td><td class="right">&yen;${row.total.toLocaleString()}</td><td style="font-size:10px;color:#888">年間支給額合計</td></tr></table>
    <div style="margin-top:15px"><p class="note">※ 支払金額は全て税込（内税方式）で記載。</p><p class="note">※ 源泉徴収税額は所得税法第204条第1項${th?.has_withholding ? "第6号" : "第1号"}に基づき日次清算時に控除済み。</p><p class="note">※ 本書は所得税法第225条第1項に基づく支払調書に準じて作成。</p></div>
    <div class="section"><p style="font-size:11px;color:#888;margin-bottom:8px">支払者</p><div class="company"><p><strong>${store?.company_name || ""}</strong></p><p>${store?.company_address || ""}</p><p>TEL: ${store?.company_phone || ""}</p>${store?.invoice_number ? `<p>適格請求書発行事業者登録番号: ${store.invoice_number}</p>` : ""}</div></div>
    <div class="stamp-area"><div class="stamp-box">支払者（${store?.company_name || ""}）</div><div class="stamp-box">支払を受ける者（${realName} 様）</div></div></body></html>`);
    w.document.close();
  };

  return (
    <div className="max-w-[900px] mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setYear(year - 1)} className="px-2 py-1 cursor-pointer" style={{ color: T.textSub }}>◀</button>
          <span className="text-[14px] font-medium">{year}年</span>
          <button onClick={() => setYear(year + 1)} className="px-2 py-1 cursor-pointer" style={{ color: T.textSub }}>▶</button>
        </div>
        {data.length > 0 && <button onClick={() => data.forEach(r => openPDF(r))} className="px-3 py-1.5 text-[10px] rounded-lg cursor-pointer text-white" style={{ backgroundColor: "#3b82f6" }}>📥 全員分表示</button>}
      </div>
      {loading ? <p className="text-center py-12 text-[12px]" style={{ color: T.textFaint }}>読み込み中...</p> : data.length === 0 ? <p className="text-center py-12 text-[12px]" style={{ color: T.textFaint }}>清算データがありません</p> : (
        <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: T.card, borderColor: T.border }}>
          <div className="px-5 py-3" style={{ borderBottom: `1px solid ${T.border}` }}><h2 className="text-[13px] font-medium">セラピスト支払調書 — {year}年</h2></div>
          <table className="w-full text-[11px]">
            <thead><tr style={{ borderBottom: `1px solid ${T.border}` }}>
              {["名前", "日数", "報酬（税込）", "インボイス控除", "源泉徴収", "厚生費", "交通費", "差引支払額", ""].map(h => <th key={h} className="py-2.5 px-3 text-left font-normal text-[10px]" style={{ color: T.textMuted }}>{h}</th>)}
            </tr></thead>
            <tbody>{data.map(row => (
              <tr key={row.id} style={{ borderBottom: `1px solid ${T.border}` }}>
                <td className="py-2.5 px-3 font-medium">{row.name}</td>
                <td className="py-2.5 px-3">{row.days}日</td>
                <td className="py-2.5 px-3">{fmt(row.gross)}</td>
                <td className="py-2.5 px-3" style={{ color: row.invoiceDed > 0 ? "#c45555" : T.textFaint }}>{row.invoiceDed > 0 ? `-${fmt(row.invoiceDed)}` : "-"}</td>
                <td className="py-2.5 px-3" style={{ color: row.tax > 0 ? "#c45555" : T.textFaint }}>{row.tax > 0 ? `-${fmt(row.tax)}` : "-"}</td>
                <td className="py-2.5 px-3" style={{ color: "#c45555" }}>{row.welfare > 0 ? `-${fmt(row.welfare)}` : "-"}</td>
                <td className="py-2.5 px-3">{row.transport > 0 ? fmt(row.transport) : "-"}</td>
                <td className="py-2.5 px-3 font-bold" style={{ color: "#c3a782" }}>{fmt(row.total)}</td>
                <td className="py-2.5 px-3"><button onClick={() => openPDF(row)} className="px-2 py-1 text-[9px] rounded cursor-pointer" style={{ color: "#85a8c4", backgroundColor: "#85a8c418" }}>📄 調書</button></td>
              </tr>
            ))}</tbody>
            <tfoot><tr style={{ borderTop: `2px solid ${T.border}` }}>
              <td className="py-2.5 px-3 font-bold">合計</td>
              <td className="py-2.5 px-3 font-bold">{data.reduce((s,r) => s + r.days, 0)}日</td>
              <td className="py-2.5 px-3 font-bold">{fmt(data.reduce((s,r) => s + r.gross, 0))}</td>
              <td className="py-2.5 px-3 font-bold" style={{ color: "#c45555" }}>{fmt(data.reduce((s,r) => s + r.invoiceDed, 0))}</td>
              <td className="py-2.5 px-3 font-bold" style={{ color: "#c45555" }}>{fmt(data.reduce((s,r) => s + r.tax, 0))}</td>
              <td className="py-2.5 px-3 font-bold" style={{ color: "#c45555" }}>{fmt(data.reduce((s,r) => s + r.welfare, 0))}</td>
              <td className="py-2.5 px-3 font-bold">{fmt(data.reduce((s,r) => s + r.transport, 0))}</td>
              <td className="py-2.5 px-3 font-bold" style={{ color: "#c3a782" }}>{fmt(data.reduce((s,r) => s + r.total, 0))}</td>
              <td></td>
            </tr></tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

function StaffPayroll({ T }: { T: any }) {
  const [year, setYear] = useState(new Date().getFullYear());
  const [staffList, setStaffList] = useState<any[]>([]);
  const [data, setData] = useState<{ id: number; name: string; gross: number; invoiceDed: number; tax: number; transport: number; total: number; days: number }[]>([]);
  const [loading, setLoading] = useState(false);
  const [storeInfo, setStoreInfo] = useState<any>(null);
  const fmt = (n: number) => "¥" + (n || 0).toLocaleString();

  useEffect(() => {
    const f = async () => {
      const { data: st } = await supabase.from("staff").select("*").in("company_position", ["業務委託"]); if (st) setStaffList(st);
      const { data: store } = await supabase.from("stores").select("*"); if (store?.[0]) setStoreInfo(store[0]);
    }; f();
  }, []);

  const fetchPayroll = useCallback(async () => {
    if (staffList.length === 0) return;
    setLoading(true);
    const { data: schedules } = await supabase.from("staff_schedules").select("*").gte("date", `${year}-01-01`).lte("date", `${year}-12-31`).eq("status", "completed");
    const sMap: Record<number, { name: string; gross: number; invoiceDed: number; tax: number; transport: number; total: number; days: number }> = {};
    (schedules || []).forEach(s => {
      const staff = staffList.find(st => st.id === s.staff_id);
      if (!staff) return;
      if (!sMap[s.staff_id]) sMap[s.staff_id] = { name: staff.name, gross: 0, invoiceDed: 0, tax: 0, transport: 0, total: 0, days: 0 };
      const subtotal = (s.commission_fee || 0) + (s.night_premium || 0) + (s.license_premium || 0);
      const invDed = staff.has_invoice ? 0 : Math.round(subtotal * 0.1);
      const adjusted = subtotal - invDed;
      const wtTax = staff.has_withholding ? Math.floor(adjusted * 0.1021) : 0;
      const transport = s.transport_fee || 0;
      const finalRaw = adjusted - wtTax + transport;
      const finalPay = Math.ceil(finalRaw / 100) * 100;
      sMap[s.staff_id].gross += subtotal;
      sMap[s.staff_id].invoiceDed += invDed;
      sMap[s.staff_id].tax += wtTax;
      sMap[s.staff_id].transport += transport;
      sMap[s.staff_id].total += finalPay;
      sMap[s.staff_id].days += 1;
    });
    const result = Object.entries(sMap).map(([id, d]) => ({ id: Number(id), ...d }));
    result.sort((a, b) => b.gross - a.gross);
    setData(result);
    setLoading(false);
  }, [year, staffList]);

  useEffect(() => { fetchPayroll(); }, [fetchPayroll]);

  const openPDF = (row: typeof data[0]) => {
    const store = storeInfo;
    const staff = staffList.find(s => s.id === row.id);
    const w = window.open("", "_blank"); if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>支払調書_${year}_${row.name}</title>
    <style>body{font-family:'Hiragino Sans','Yu Gothic','Meiryo',sans-serif;max-width:750px;margin:40px auto;padding:30px;color:#333}h1{text-align:center;font-size:20px;border-bottom:3px double #333;padding-bottom:10px;margin-bottom:5px;letter-spacing:4px}h2{text-align:center;font-size:12px;color:#888;font-weight:normal;margin-bottom:25px}table{width:100%;border-collapse:collapse;margin:15px 0}td,th{border:1px solid #ccc;padding:9px 14px;font-size:12px}th{background:#f5f0e8;text-align:left;width:38%}.right{text-align:right}.total-row{background:#f9f6f0;font-weight:bold;font-size:14px}.section{margin-top:25px;padding-top:15px;border-top:1px solid #ddd}.company{font-size:11px;line-height:2;color:#555}.note{font-size:9px;color:#888;margin-top:4px;line-height:1.8}.doc-title{font-size:9px;color:#999;text-align:right;margin-bottom:20px}.stamp-area{display:flex;justify-content:space-between;margin-top:40px}.stamp-box{border-top:1px solid #333;width:180px;text-align:center;padding-top:5px;font-size:10px;color:#888}@media print{body{margin:0;padding:20px}}</style></head><body>
    <p class="doc-title">報酬、料金、契約金及び賞金の支払調書</p><h1>支　払　調　書</h1><h2>対象期間：${year}年1月1日 〜 ${year}年12月31日</h2>
    <table><tr><th>支払を受ける者（氏名）</th><td>${row.name}</td></tr><tr><th>支払を受ける者（住所）</th><td>${staff?.address || '<span style="color:#c45555">※未登録</span>'}</td></tr><tr><th>区分</th><td>報酬（業務委託・店舗管理業務）</td></tr><tr><th>細目</th><td>店舗管理・受付業務一式</td></tr><tr><th>適格請求書発行事業者</th><td>${staff?.has_invoice ? `登録あり（${staff.invoice_number || ""})` : "未登録"}</td></tr></table>
    <table><tr><th style="width:45%">項目</th><th class="right" style="width:20%">金額</th><th style="width:35%">摘要</th></tr>
    <tr><td>稼働日数</td><td class="right">${row.days}日</td><td style="font-size:10px;color:#888">年間稼働回数</td></tr>
    <tr><td><strong>支払金額（税込）</strong></td><td class="right"><strong>&yen;${row.gross.toLocaleString()}</strong></td><td style="font-size:10px;color:#888">業務委託費の年間合計（税込）</td></tr>
    ${row.invoiceDed > 0 ? `<tr><td style="color:#c45555">仕入税額控除の経過措置</td><td class="right" style="color:#c45555">-&yen;${row.invoiceDed.toLocaleString()}</td><td style="font-size:10px;color:#888">報酬額の10%を控除</td></tr>` : ""}
    ${row.tax > 0 ? `<tr><td style="color:#c45555">源泉徴収税額</td><td class="right" style="color:#c45555">-&yen;${row.tax.toLocaleString()}</td><td style="font-size:10px;color:#888">所得税及び復興特別所得税（10.21%）</td></tr>` : ""}
    ${row.transport > 0 ? `<tr><td>交通費（非課税）</td><td class="right">&yen;${row.transport.toLocaleString()}</td><td style="font-size:10px;color:#888">実費精算・源泉対象外</td></tr>` : ""}
    <tr class="total-row"><td>差引支払額</td><td class="right">&yen;${row.total.toLocaleString()}</td><td style="font-size:10px;color:#888">年間支給額合計（100円切上後）</td></tr></table>
    <div style="margin-top:15px"><p class="note">※ 支払金額は全て税込（内税方式）で記載。</p><p class="note">※ 本書は所得税法第225条第1項に基づく支払調書に準じて作成。</p></div>
    <div class="section"><p style="font-size:11px;color:#888;margin-bottom:8px">支払者</p><div class="company"><p><strong>${store?.company_name || ""}</strong></p><p>${store?.company_address || ""}</p><p>TEL: ${store?.company_phone || ""}</p>${store?.invoice_number ? `<p>適格請求書発行事業者登録番号: ${store.invoice_number}</p>` : ""}</div></div>
    <div class="stamp-area"><div class="stamp-box">支払者（${store?.company_name || ""}）</div><div class="stamp-box">支払を受ける者（${row.name} 様）</div></div></body></html>`);
    w.document.close();
  };

  return (
    <div className="max-w-[900px] mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setYear(year - 1)} className="px-2 py-1 cursor-pointer" style={{ color: T.textSub }}>◀</button>
          <span className="text-[14px] font-medium">{year}年</span>
          <button onClick={() => setYear(year + 1)} className="px-2 py-1 cursor-pointer" style={{ color: T.textSub }}>▶</button>
        </div>
        {data.length > 0 && <button onClick={() => data.forEach(r => openPDF(r))} className="px-3 py-1.5 text-[10px] rounded-lg cursor-pointer text-white" style={{ backgroundColor: "#3b82f6" }}>📥 全員分表示</button>}
      </div>
      {loading ? <p className="text-center py-12 text-[12px]" style={{ color: T.textFaint }}>読み込み中...</p> : data.length === 0 ? <p className="text-center py-12 text-[12px]" style={{ color: T.textFaint }}>業務委託スタッフの稼働データがありません</p> : (
        <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: T.card, borderColor: T.border }}>
          <div className="px-5 py-3" style={{ borderBottom: `1px solid ${T.border}` }}><h2 className="text-[13px] font-medium">内勤スタッフ支払調書 — {year}年（業務委託のみ）</h2></div>
          <table className="w-full text-[11px]">
            <thead><tr style={{ borderBottom: `1px solid ${T.border}` }}>
              {["名前", "日数", "報酬（税込）", "インボイス控除", "源泉徴収", "交通費", "差引支払額", ""].map(h => <th key={h} className="py-2.5 px-3 text-left font-normal text-[10px]" style={{ color: T.textMuted }}>{h}</th>)}
            </tr></thead>
            <tbody>{data.map(row => (
              <tr key={row.id} style={{ borderBottom: `1px solid ${T.border}` }}>
                <td className="py-2.5 px-3 font-medium">{row.name}</td>
                <td className="py-2.5 px-3">{row.days}日</td>
                <td className="py-2.5 px-3">{fmt(row.gross)}</td>
                <td className="py-2.5 px-3" style={{ color: row.invoiceDed > 0 ? "#c45555" : T.textFaint }}>{row.invoiceDed > 0 ? `-${fmt(row.invoiceDed)}` : "-"}</td>
                <td className="py-2.5 px-3" style={{ color: row.tax > 0 ? "#c45555" : T.textFaint }}>{row.tax > 0 ? `-${fmt(row.tax)}` : "-"}</td>
                <td className="py-2.5 px-3">{row.transport > 0 ? fmt(row.transport) : "-"}</td>
                <td className="py-2.5 px-3 font-bold" style={{ color: "#c3a782" }}>{fmt(row.total)}</td>
                <td className="py-2.5 px-3"><button onClick={() => openPDF(row)} className="px-2 py-1 text-[9px] rounded cursor-pointer" style={{ color: "#85a8c4", backgroundColor: "#85a8c418" }}>📄 調書</button></td>
              </tr>
            ))}</tbody>
            <tfoot><tr style={{ borderTop: `2px solid ${T.border}` }}>
              <td className="py-2.5 px-3 font-bold">合計</td>
              <td className="py-2.5 px-3 font-bold">{data.reduce((s,r) => s + r.days, 0)}日</td>
              <td className="py-2.5 px-3 font-bold">{fmt(data.reduce((s,r) => s + r.gross, 0))}</td>
              <td className="py-2.5 px-3 font-bold" style={{ color: "#c45555" }}>{fmt(data.reduce((s,r) => s + r.invoiceDed, 0))}</td>
              <td className="py-2.5 px-3 font-bold" style={{ color: "#c45555" }}>{fmt(data.reduce((s,r) => s + r.tax, 0))}</td>
              <td className="py-2.5 px-3 font-bold">{fmt(data.reduce((s,r) => s + r.transport, 0))}</td>
              <td className="py-2.5 px-3 font-bold" style={{ color: "#c3a782" }}>{fmt(data.reduce((s,r) => s + r.total, 0))}</td>
              <td></td>
            </tr></tfoot>
          </table>
        </div>
      )}
    </div>
  );
}