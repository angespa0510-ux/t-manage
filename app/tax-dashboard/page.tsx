"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";
import { useTheme } from "../../lib/theme";
import { NavMenu } from "../../lib/nav-menu";
import { useRole } from "../../lib/use-role";
import { useToast } from "../../lib/toast";
import { generateContractCertificate, generatePaymentCertificate, generateTransactionCertificate } from "../../lib/certificate-pdf";

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
  const toast = useToast();
  const { dark, toggle, T } = useTheme();
  const { role, loading: roleLoading, isOwner } = useRole();

  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [stores, setStores] = useState<Store[]>([]);

  const [dashTab, setDashTab] = useState<"summary" | "therapist_payroll" | "staff_payroll" | "withholding" | "calendar" | "company" | "mynumber" | "certificate">("summary");
  const [mode, setMode] = useState<"monthly" | "yearly">("monthly");
  const [selectedMonth, setSelectedMonth] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; });
  const [companyName, setCompanyName] = useState(""); const [companyAddress, setCompanyAddress] = useState(""); const [companyPhone, setCompanyPhone] = useState(""); const [invoiceNumber, setInvoiceNumber] = useState(""); const [companyStoreId, setCompanyStoreId] = useState<number>(0);
  const [corporateNumber, setCorporateNumber] = useState(""); const [fiscalMonth, setFiscalMonth] = useState(3); const [representativeName, setRepresentativeName] = useState(""); const [entityType, setEntityType] = useState("llc"); const [taxOffice, setTaxOffice] = useState(""); const [taxAccountantName, setTaxAccountantName] = useState(""); const [taxAccountantPhone, setTaxAccountantPhone] = useState(""); const [taxAccountantAddress, setTaxAccountantAddress] = useState(""); const [laborConsultantName, setLaborConsultantName] = useState(""); const [laborConsultantPhone, setLaborConsultantPhone] = useState("");
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());

  const [smYear, smMonth] = selectedMonth.split("-").map(Number);

  const fetchData = useCallback(async () => {
    const { data: c } = await supabase.from("courses").select("*"); if (c) setCourses(c);
    const { data: s } = await supabase.from("stores").select("*"); if (s) { setStores(s); if (s[0]) { setCompanyName(s[0].company_name || ""); setCompanyAddress(s[0].company_address || ""); setCompanyPhone(s[0].company_phone || ""); setInvoiceNumber(s[0].invoice_number || ""); setCompanyStoreId(s[0].id); setCorporateNumber(s[0].corporate_number || ""); setFiscalMonth(s[0].fiscal_month || 3); setRepresentativeName(s[0].representative_name || ""); setEntityType(s[0].entity_type || "llc"); setTaxOffice(s[0].tax_office || ""); setTaxAccountantName(s[0].tax_accountant_name || ""); setTaxAccountantPhone(s[0].tax_accountant_phone || ""); setTaxAccountantAddress(s[0].tax_accountant_address || ""); setLaborConsultantName(s[0].labor_consultant_name || ""); setLaborConsultantPhone(s[0].labor_consultant_phone || ""); } }

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
          <h1 className="text-[14px] font-medium">バックオフィス</h1>
          </div>
        <div className="flex items-center gap-2">
          {[{k:"summary",l:"📊 経理サマリー"},{k:"therapist_payroll",l:"📑 セラピスト支払調書"},{k:"staff_payroll",l:"📑 スタッフ支払調書"},{k:"withholding",l:"💰 源泉徴収納付"},{k:"calendar",l:"📆 年間スケジュール"},{k:"certificate",l:"📄 証明書発行"},{k:"company",l:"🏢 会社情報"},{k:"mynumber",l:"🔒 マイナンバー"}].map(t => (
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
      {dashTab === "withholding" && (
        <div className="flex-1 overflow-y-auto p-4">
          <WithholdingTaxSummary T={T} />
        </div>
      )}
      {dashTab === "calendar" && (
        <div className="flex-1 overflow-y-auto p-4">
          <TaxCalendar T={T} onNavigate={(tab: string) => setDashTab(tab as any)} />
        </div>
      )}
      {dashTab === "company" && (
        <div className="flex-1 overflow-y-auto p-4">
          <div className="max-w-[700px] mx-auto space-y-6">
            {/* 法人形態の選択 */}
            <div className="rounded-2xl border p-6" style={{ backgroundColor: T.card, borderColor: T.border }}>
              <h2 className="text-[15px] font-medium mb-3">🏢 事業形態</h2>
              <div className="flex gap-2">
                {([["llc","合同会社"],["corp","株式会社"],["sole","個人事業主"]] as const).map(([k,l]) => (
                  <button key={k} onClick={() => setEntityType(k)} className="flex-1 py-3 rounded-xl text-[12px] cursor-pointer font-medium" style={{ backgroundColor: entityType === k ? "#c3a78222" : T.cardAlt, color: entityType === k ? "#c3a782" : T.textMuted, border: `1px solid ${entityType === k ? "#c3a782" : T.border}` }}>{l}</button>
                ))}
              </div>
            </div>

            {/* 基本情報 */}
            <div className="rounded-2xl border p-6 space-y-4" style={{ backgroundColor: T.card, borderColor: T.border }}>
              <h2 className="text-[15px] font-medium">📋 基本情報</h2>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>{entityType === "sole" ? "屋号" : "会社名"}</label><input type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={{ backgroundColor: T.cardAlt, border: `1px solid ${T.border}`, color: T.text }} /></div>
                <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>{entityType === "sole" ? "事業主名" : "代表者名"}</label><input type="text" value={representativeName} onChange={(e) => setRepresentativeName(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={{ backgroundColor: T.cardAlt, border: `1px solid ${T.border}`, color: T.text }} /></div>
              </div>
              <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>{entityType === "sole" ? "事業所住所" : "本店所在地"}</label><input type="text" value={companyAddress} onChange={(e) => setCompanyAddress(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={{ backgroundColor: T.cardAlt, border: `1px solid ${T.border}`, color: T.text }} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>電話番号</label><input type="text" value={companyPhone} onChange={(e) => setCompanyPhone(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={{ backgroundColor: T.cardAlt, border: `1px solid ${T.border}`, color: T.text }} /></div>
                <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>決算月</label>
                  <select value={fiscalMonth} onChange={(e) => setFiscalMonth(Number(e.target.value))} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none cursor-pointer" style={{ backgroundColor: T.cardAlt, border: `1px solid ${T.border}`, color: T.text }}>
                    {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => <option key={m} value={m}>{m}月</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* 法人番号・インボイス */}
            <div className="rounded-2xl border p-6 space-y-4" style={{ backgroundColor: T.card, borderColor: T.border }}>
              <h2 className="text-[15px] font-medium">🔢 番号・届出</h2>
              {entityType !== "sole" && (
                <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>法人番号（13桁・Tなし）</label><input type="text" value={corporateNumber} onChange={(e) => setCorporateNumber(e.target.value.replace(/[^0-9]/g, "").slice(0, 13))} placeholder="1234567890123" className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={{ backgroundColor: T.cardAlt, border: `1px solid ${T.border}`, color: T.text }} /><p className="text-[9px] mt-1" style={{ color: T.textFaint }}>法人税申告書・届出書に記載。国税庁の法人番号公表サイトで確認できます。</p></div>
              )}
              <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>適格請求書発行事業者番号（インボイス番号）</label><input type="text" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} placeholder="T1234567890123" className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={{ backgroundColor: T.cardAlt, border: `1px solid ${T.border}`, color: T.text }} /><p className="text-[9px] mt-1" style={{ color: T.textFaint }}>{entityType === "sole" ? "Tの後にマイナンバー13桁、または届出番号" : "T + 法人番号13桁"}</p></div>
              <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>管轄税務署</label><input type="text" value={taxOffice} onChange={(e) => setTaxOffice(e.target.value)} placeholder="名古屋中税務署" className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={{ backgroundColor: T.cardAlt, border: `1px solid ${T.border}`, color: T.text }} /></div>
            </div>

            {/* 税理士・社労士 */}
            <div className="rounded-2xl border p-6 space-y-4" style={{ backgroundColor: T.card, borderColor: T.border }}>
              <h2 className="text-[15px] font-medium">👥 顧問の先生</h2>
              <div className="rounded-xl p-4 space-y-3" style={{ backgroundColor: T.cardAlt }}>
                <p className="text-[11px] font-medium" style={{ color: "#85a8c4" }}>📝 税理士</p>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="block text-[9px] mb-1" style={{ color: T.textMuted }}>名前</label><input type="text" value={taxAccountantName} onChange={(e) => setTaxAccountantName(e.target.value)} placeholder="江坂留衣" className="w-full px-3 py-2 rounded-lg text-[12px] outline-none" style={{ backgroundColor: T.card, border: `1px solid ${T.border}`, color: T.text }} /></div>
                  <div><label className="block text-[9px] mb-1" style={{ color: T.textMuted }}>電話番号</label><input type="text" value={taxAccountantPhone} onChange={(e) => setTaxAccountantPhone(e.target.value)} placeholder="0564-83-5731" className="w-full px-3 py-2 rounded-lg text-[12px] outline-none" style={{ backgroundColor: T.card, border: `1px solid ${T.border}`, color: T.text }} /></div>
                </div>
                <div><label className="block text-[9px] mb-1" style={{ color: T.textMuted }}>事務所住所</label><input type="text" value={taxAccountantAddress} onChange={(e) => setTaxAccountantAddress(e.target.value)} placeholder="愛知県岡崎市藤川町一里山南13" className="w-full px-3 py-2 rounded-lg text-[12px] outline-none" style={{ backgroundColor: T.card, border: `1px solid ${T.border}`, color: T.text }} /></div>
              </div>
              <div className="rounded-xl p-4 space-y-3" style={{ backgroundColor: T.cardAlt }}>
                <p className="text-[11px] font-medium" style={{ color: "#22c55e" }}>🏥 社労士</p>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="block text-[9px] mb-1" style={{ color: T.textMuted }}>名前</label><input type="text" value={laborConsultantName} onChange={(e) => setLaborConsultantName(e.target.value)} placeholder="大石さん" className="w-full px-3 py-2 rounded-lg text-[12px] outline-none" style={{ backgroundColor: T.card, border: `1px solid ${T.border}`, color: T.text }} /></div>
                  <div><label className="block text-[9px] mb-1" style={{ color: T.textMuted }}>電話番号</label><input type="text" value={laborConsultantPhone} onChange={(e) => setLaborConsultantPhone(e.target.value)} className="w-full px-3 py-2 rounded-lg text-[12px] outline-none" style={{ backgroundColor: T.card, border: `1px solid ${T.border}`, color: T.text }} /></div>
                </div>
              </div>
            </div>

            {/* 保存ボタン */}
            <button onClick={async () => { if (!companyStoreId) return; await supabase.from("stores").update({ company_name: companyName.trim(), company_address: companyAddress.trim(), company_phone: companyPhone.trim(), invoice_number: invoiceNumber.trim(), corporate_number: corporateNumber.trim(), fiscal_month: fiscalMonth, representative_name: representativeName.trim(), entity_type: entityType, tax_office: taxOffice.trim(), tax_accountant_name: taxAccountantName.trim(), tax_accountant_phone: taxAccountantPhone.trim(), tax_accountant_address: taxAccountantAddress.trim(), labor_consultant_name: laborConsultantName.trim(), labor_consultant_phone: laborConsultantPhone.trim() }).eq("id", companyStoreId); toast.show("会社情報を保存しました", "success"); fetchData(); }} className="w-full py-3 bg-gradient-to-r from-[#c3a782] to-[#b09672] text-white text-[12px] rounded-xl cursor-pointer font-medium">💾 保存する</button>

            {/* 利用先の説明 */}
            <div className="rounded-2xl border p-5" style={{ backgroundColor: T.card, borderColor: T.border }}>
              <h3 className="text-[13px] font-medium mb-3" style={{ color: T.text }}>📋 この情報が使われる場所</h3>
              <div className="space-y-2 text-[11px]" style={{ color: T.textSub }}>
                <div className="flex items-start gap-2"><span style={{ color: "#c3a782" }}>📑</span><span>セラピスト・スタッフの<strong>支払調書PDF</strong>の支払者欄</span></div>
                <div className="flex items-start gap-2"><span style={{ color: "#c3a782" }}>💰</span><span><strong>源泉徴収納付集計表</strong>の事業者情報</span></div>
                <div className="flex items-start gap-2"><span style={{ color: "#c3a782" }}>🧾</span><span>セラピストへの<strong>日次清算の支払通知書</strong></span></div>
                <div className="flex items-start gap-2"><span style={{ color: "#c3a782" }}>📆</span><span><strong>年間スケジュール</strong>の決算月・顧問連絡先</span></div>
                <div className="flex items-start gap-2"><span style={{ color: "#c3a782" }}>📊</span><span>税理士さんへの<strong>各種報告書類</strong></span></div>
              </div>
            </div>
          </div>
        </div>
      )}
      {dashTab === "mynumber" && (
        <div className="flex-1 overflow-y-auto p-4">
          <MyNumberManager T={T} />
        </div>
      )}
      {dashTab === "certificate" && (
        <div className="flex-1 overflow-y-auto p-4">
          <CertificateManager T={T} />
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
    <table><tr><th>支払を受ける者（氏名）</th><td>${realName}</td></tr>${realName !== row.name ? `<tr><th>業務上の名称</th><td>${row.name}</td></tr>` : ""}<tr><th>支払を受ける者（住所）</th><td>${th?.address || '<span style="color:#c45555">※未登録</span>'}</td></tr>${th?.birth_date ? `<tr><th>生年月日</th><td>${th.birth_date}</td></tr>` : ""}<tr><th>区分</th><td>${th?.has_withholding ? "報酬（所得税法第204条第1項第6号）" : "報酬（所得税法第204条第1項第1号）"}</td></tr><tr><th>細目</th><td>${th?.has_withholding ? "ホステス等の業務に関する報酬" : "マッサージ施術業務"}</td></tr><tr><th>適格請求書発行事業者</th><td>${hasInvoice ? `登録あり（登録番号：${invoiceNum}）` : "未登録"}</td></tr></table>
    <table><tr><th style="width:45%">項目</th><th class="right" style="width:20%">金額</th><th style="width:35%">摘要</th></tr>
    <tr><td>稼働日数</td><td class="right">${row.days}日</td><td style="font-size:10px;color:#888">年間清算回数</td></tr>
    <tr><td><strong>支払金額（税込）</strong></td><td class="right"><strong>&yen;${row.gross.toLocaleString()}</strong></td><td style="font-size:10px;color:#888">業務委託報酬の年間合計</td></tr>
    ${row.invoiceDed > 0 ? `<tr><td style="color:#c45555">仕入税額控除の経過措置</td><td class="right" style="color:#c45555">-&yen;${row.invoiceDed.toLocaleString()}</td><td style="font-size:10px;color:#888">報酬額の10%を控除</td></tr><tr style="background:#f9f6f0"><td>控除後の報酬額</td><td class="right">&yen;${(row.gross - row.invoiceDed).toLocaleString()}</td><td style="font-size:10px;color:#888">支払金額 − 仕入税額控除</td></tr>` : ""}
    ${row.tax > 0 ? `<tr><td style="color:#c45555">源泉徴収税額</td><td class="right" style="color:#c45555">-&yen;${row.tax.toLocaleString()}</td><td style="font-size:10px;color:#888">所得税及び復興特別所得税</td></tr>` : `<tr><td>源泉徴収税額</td><td class="right">&yen;0</td><td style="font-size:10px;color:#888">源泉徴収対象外</td></tr>`}
    ${row.welfare > 0 ? `<tr><td style="color:#c45555">備品代・リネン代</td><td class="right" style="color:#c45555">-&yen;${row.welfare.toLocaleString()}</td><td style="font-size:10px;color:#888">&yen;500/日 × ${row.days}日</td></tr>` : ""}
    ${row.transport > 0 ? `<tr><td>交通費（実費精算分）</td><td class="right">&yen;${row.transport.toLocaleString()}</td><td style="font-size:10px;color:#888">&yen;${Math.round(row.transport / row.days).toLocaleString()}/日 × ${row.days}日</td></tr>` : ""}
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
    <table><tr><th>支払を受ける者（氏名）</th><td>${row.name}</td></tr><tr><th>支払を受ける者（住所）</th><td>${staff?.address || '<span style="color:#c45555">※未登録</span>'}</td></tr><tr><th>区分</th><td>${staff?.has_withholding ? "報酬（所得税法第204条第1項第1号）" : "報酬・受付・清掃業務委託料"}</td></tr><tr><th>細目</th><td>${staff?.has_withholding ? "店舗運営指導報酬" : "店舗管理・受付業務一式"}</td></tr><tr><th>適格請求書発行事業者</th><td>${staff?.has_invoice ? `登録あり（${staff.invoice_number || ""})` : "未登録"}</td></tr></table>
    <table><tr><th style="width:45%">項目</th><th class="right" style="width:20%">金額</th><th style="width:35%">摘要</th></tr>
    <tr><td>稼働日数</td><td class="right">${row.days}日</td><td style="font-size:10px;color:#888">年間稼働回数</td></tr>
    <tr><td><strong>支払金額（税込）</strong></td><td class="right"><strong>&yen;${row.gross.toLocaleString()}</strong></td><td style="font-size:10px;color:#888">業務委託費の年間合計（税込）</td></tr>
    ${row.invoiceDed > 0 ? `<tr><td style="color:#c45555">仕入税額控除の経過措置</td><td class="right" style="color:#c45555">-&yen;${row.invoiceDed.toLocaleString()}</td><td style="font-size:10px;color:#888">報酬額の10%を控除</td></tr>` : ""}
    ${row.tax > 0 ? `<tr><td style="color:#c45555">源泉徴収税額</td><td class="right" style="color:#c45555">-&yen;${row.tax.toLocaleString()}</td><td style="font-size:10px;color:#888">所得税及び復興特別所得税（10.21%）</td></tr>` : `<tr><td>源泉徴収税額</td><td class="right">&yen;0</td><td style="font-size:10px;color:#888">源泉徴収対象外</td></tr>`}
    ${row.transport > 0 ? `<tr><td>交通費（実費精算分）</td><td class="right">&yen;${row.transport.toLocaleString()}</td><td style="font-size:10px;color:#888">実費精算・源泉対象外</td></tr>` : ""}
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
function WithholdingTaxSummary({ T }: { T: any }) {
  const [year, setYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(false);
  const [therapistData, setTherapistData] = useState<{ month: number; name: string; tax: number; back: number }[]>([]);
  const [staffData, setStaffData] = useState<{ month: number; name: string; tax: number; gross: number }[]>([]);
  const [salaryData, setSalaryData] = useState<{ month: number; tax: number; gross: number }[]>([]);
  const [halfView, setHalfView] = useState<"first" | "second">("first");
  const fmt = (n: number) => "¥" + (n || 0).toLocaleString();

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      // セラピスト源泉（therapist_daily_settlements）
      const { data: settlements } = await supabase.from("therapist_daily_settlements").select("therapist_id, date, withholding_tax, total_back, adjustment").gte("date", `${year}-01-01`).lte("date", `${year}-12-31`).eq("is_settled", true);
      const { data: therapists } = await supabase.from("therapists").select("id, name");
      const thMap: Record<number, string> = {};
      (therapists || []).forEach(t => { thMap[t.id] = t.name; });
      const thRows: typeof therapistData = [];
      (settlements || []).forEach(s => {
        if ((s.withholding_tax || 0) > 0) {
          const m = parseInt(s.date.split("-")[1]);
          thRows.push({ month: m, name: thMap[s.therapist_id] || "不明", tax: s.withholding_tax || 0, back: (s.total_back || 0) + (s.adjustment || 0) });
        }
      });
      setTherapistData(thRows);

      // スタッフ源泉（staff_schedules）
      const { data: schedules } = await supabase.from("staff_schedules").select("staff_id, date, withholding_tax, commission_fee, night_premium, license_premium").gte("date", `${year}-01-01`).lte("date", `${year}-12-31`).eq("status", "completed");
      const { data: staffList } = await supabase.from("staff").select("id, name");
      const stMap: Record<number, string> = {};
      (staffList || []).forEach(s => { stMap[s.id] = s.name; });
      const stRows: typeof staffData = [];
      (schedules || []).forEach(s => {
        const wt = (s as any).withholding_tax || 0;
        if (wt > 0) {
          const m = parseInt(s.date.split("-")[1]);
          const gross = (s.commission_fee || 0) + (s.night_premium || 0) + (s.license_premium || 0);
          stRows.push({ month: m, name: stMap[s.staff_id] || "不明", tax: wt, gross });
        }
      });
      setStaffData(stRows);

      // 給与源泉（概算：預り金から）- 月別の給与源泉は別途管理が必要なので、ここでは空配列
      setSalaryData([]);
      setLoading(false);
    };
    fetch();
  }, [year]);

  const firstHalf = { start: 1, end: 6, label: "1月〜6月（7月10日納付期限）" };
  const secondHalf = { start: 7, end: 12, label: "7月〜12月（翌年1月20日納付期限）" };
  const current = halfView === "first" ? firstHalf : secondHalf;

  // 月別集計
  const monthlyTotals = (() => {
    const result: { month: number; therapistTax: number; therapistGross: number; staffTax: number; staffGross: number; salaryTax: number; salaryGross: number }[] = [];
    for (let m = current.start; m <= current.end; m++) {
      const thTax = therapistData.filter(r => r.month === m).reduce((s, r) => s + r.tax, 0);
      const thGross = therapistData.filter(r => r.month === m).reduce((s, r) => s + r.back, 0);
      const stTax = staffData.filter(r => r.month === m).reduce((s, r) => s + r.tax, 0);
      const stGross = staffData.filter(r => r.month === m).reduce((s, r) => s + r.gross, 0);
      const slTax = salaryData.filter(r => r.month === m).reduce((s, r) => s + r.tax, 0);
      const slGross = salaryData.filter(r => r.month === m).reduce((s, r) => s + r.gross, 0);
      result.push({ month: m, therapistTax: thTax, therapistGross: thGross, staffTax: stTax, staffGross: stGross, salaryTax: slTax, salaryGross: slGross });
    }
    return result;
  })();

  const totalThTax = monthlyTotals.reduce((s, r) => s + r.therapistTax, 0);
  const totalThGross = monthlyTotals.reduce((s, r) => s + r.therapistGross, 0);
  const totalStTax = monthlyTotals.reduce((s, r) => s + r.staffTax, 0);
  const totalStGross = monthlyTotals.reduce((s, r) => s + r.staffGross, 0);
  const totalSlTax = monthlyTotals.reduce((s, r) => s + r.salaryTax, 0);
  const totalSlGross = monthlyTotals.reduce((s, r) => s + r.salaryGross, 0);
  const grandTotalTax = totalThTax + totalStTax + totalSlTax;

  // セラピスト別集計（該当半期）
  const therapistSummary = (() => {
    const filtered = therapistData.filter(r => r.month >= current.start && r.month <= current.end);
    const map: Record<string, { tax: number; gross: number; count: number }> = {};
    filtered.forEach(r => {
      if (!map[r.name]) map[r.name] = { tax: 0, gross: 0, count: 0 };
      map[r.name].tax += r.tax;
      map[r.name].gross += r.back;
      map[r.name].count += 1;
    });
    return Object.entries(map).map(([name, d]) => ({ name, ...d })).sort((a, b) => b.tax - a.tax);
  })();

  // CSV出力
  const exportCSV = () => {
    const BOM = "\uFEFF";
    const lines = [
      `源泉徴収納付集計,${year}年,${current.label}`,
      "",
      "【月別集計】",
      "月,セラピスト報酬,セラピスト源泉,スタッフ報酬,スタッフ源泉,給与額,給与源泉,源泉合計",
      ...monthlyTotals.map(r => `${r.month}月,${r.therapistGross},${r.therapistTax},${r.staffGross},${r.staffTax},${r.salaryGross},${r.salaryTax},${r.therapistTax + r.staffTax + r.salaryTax}`),
      `合計,${totalThGross},${totalThTax},${totalStGross},${totalStTax},${totalSlGross},${totalSlTax},${grandTotalTax}`,
      "",
      "【セラピスト別内訳】",
      "名前,稼働日数,報酬額,源泉徴収額",
      ...therapistSummary.map(r => `"${r.name}",${r.count},${r.gross},${r.tax}`),
    ];
    const csv = BOM + lines.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `源泉徴収納付集計_${year}_${halfView === "first" ? "上半期" : "下半期"}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  // 納付書風PDF
  const openPaymentSlip = () => {
    const w = window.open("", "_blank"); if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>源泉徴収納付集計_${year}_${halfView === "first" ? "上半期" : "下半期"}</title>
<style>body{font-family:'Hiragino Sans','Yu Gothic','Meiryo',sans-serif;max-width:800px;margin:40px auto;padding:30px;color:#333}h1{text-align:center;font-size:18px;border-bottom:3px double #333;padding-bottom:10px;margin-bottom:5px;letter-spacing:3px}h2{text-align:center;font-size:12px;color:#888;font-weight:normal;margin-bottom:25px}h3{font-size:14px;margin:25px 0 10px;padding-bottom:5px;border-bottom:2px solid #c3a782}table{width:100%;border-collapse:collapse;margin:10px 0}td,th{border:1px solid #ccc;padding:8px 12px;font-size:12px}th{background:#f5f0e8;text-align:left}.right{text-align:right}.total-row{background:#f9f6f0;font-weight:bold}.note{font-size:9px;color:#888;margin-top:15px;line-height:1.8}.section{margin-top:30px}@media print{body{margin:0;padding:20px}}</style></head><body>
<h1>源泉徴収税額 納付集計表</h1>
<h2>${year}年 ${current.label}</h2>
<h3>📊 区分別集計</h3>
<table>
<tr><th style="width:35%">区分</th><th class="right" style="width:25%">支払金額</th><th class="right" style="width:20%">源泉徴収税額</th><th class="right" style="width:20%">人数</th></tr>
<tr><td>報酬・料金（セラピスト）</td><td class="right">&yen;${totalThGross.toLocaleString()}</td><td class="right">&yen;${totalThTax.toLocaleString()}</td><td class="right">${therapistSummary.length}名</td></tr>
${totalStTax > 0 ? `<tr><td>報酬・料金（スタッフ）</td><td class="right">&yen;${totalStGross.toLocaleString()}</td><td class="right">&yen;${totalStTax.toLocaleString()}</td><td class="right">-</td></tr>` : ""}
${totalSlTax > 0 ? `<tr><td>給与所得</td><td class="right">&yen;${totalSlGross.toLocaleString()}</td><td class="right">&yen;${totalSlTax.toLocaleString()}</td><td class="right">-</td></tr>` : ""}
<tr class="total-row"><td>合計納付税額</td><td class="right"></td><td class="right" style="font-size:16px;color:#c45555">&yen;${grandTotalTax.toLocaleString()}</td><td></td></tr>
</table>
<h3>📅 月別内訳</h3>
<table>
<tr><th>月</th><th class="right">セラピスト源泉</th><th class="right">スタッフ源泉</th><th class="right">給与源泉</th><th class="right">月合計</th></tr>
${monthlyTotals.map(r => `<tr><td>${r.month}月</td><td class="right">&yen;${r.therapistTax.toLocaleString()}</td><td class="right">&yen;${r.staffTax.toLocaleString()}</td><td class="right">&yen;${r.salaryTax.toLocaleString()}</td><td class="right" style="font-weight:bold">&yen;${(r.therapistTax + r.staffTax + r.salaryTax).toLocaleString()}</td></tr>`).join("")}
<tr class="total-row"><td>合計</td><td class="right">&yen;${totalThTax.toLocaleString()}</td><td class="right">&yen;${totalStTax.toLocaleString()}</td><td class="right">&yen;${totalSlTax.toLocaleString()}</td><td class="right" style="color:#c45555">&yen;${grandTotalTax.toLocaleString()}</td></tr>
</table>
<h3>👤 セラピスト別内訳（報酬・料金）</h3>
<table>
<tr><th>名前</th><th class="right">稼働日数</th><th class="right">報酬額（税込）</th><th class="right">源泉徴収税額</th></tr>
${therapistSummary.map(r => `<tr><td>${r.name}</td><td class="right">${r.count}日</td><td class="right">&yen;${r.gross.toLocaleString()}</td><td class="right">&yen;${r.tax.toLocaleString()}</td></tr>`).join("")}
<tr class="total-row"><td>合計</td><td class="right">${therapistSummary.reduce((s,r) => s + r.count, 0)}日</td><td class="right">&yen;${totalThGross.toLocaleString()}</td><td class="right">&yen;${totalThTax.toLocaleString()}</td></tr>
</table>
<div class="note">
<p>※ 本集計は「所得税徴収高計算書（納付書）」の記入に使用できます。</p>
<p>※ 納期の特例適用の場合：上半期（1〜6月分）→ 7月10日まで、下半期（7〜12月分）→ 翌年1月20日までに納付。</p>
<p>※ セラピストへの報酬は所得税法第204条第1項第6号（ホステス等）に該当し、1回5,000円の控除後に10.21%を適用。</p>
</div>
</body></html>`);
    w.document.close();
  };

  return (
    <div className="max-w-[900px] mx-auto">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setYear(year - 1)} className="px-2 py-1 cursor-pointer" style={{ color: T.textSub }}>◀</button>
          <span className="text-[14px] font-medium">{year}年</span>
          <button onClick={() => setYear(year + 1)} className="px-2 py-1 cursor-pointer" style={{ color: T.textSub }}>▶</button>
        </div>
        <div className="flex gap-1">
          {([["first", "📅 上半期（1〜6月）"], ["second", "📅 下半期（7〜12月）"]] as const).map(([k, l]) => (
            <button key={k} onClick={() => setHalfView(k)} className="px-3 py-1.5 text-[10px] rounded-lg cursor-pointer" style={{ backgroundColor: halfView === k ? "#c3a78222" : "transparent", color: halfView === k ? "#c3a782" : T.textMuted, fontWeight: halfView === k ? 700 : 400, border: `1px solid ${halfView === k ? "#c3a78244" : T.border}` }}>{l}</button>
          ))}
        </div>
      </div>

      {loading ? <p className="text-center py-12 text-[12px]" style={{ color: T.textFaint }}>読み込み中...</p> : (<>
        {/* 納付期限の注意 */}
        <div className="rounded-xl p-4 mb-4" style={{ backgroundColor: "#f59e0b12", border: "1px solid #f59e0b33" }}>
          <p className="text-[11px] font-medium" style={{ color: "#f59e0b" }}>⏰ {current.label}</p>
          <p className="text-[10px] mt-1" style={{ color: T.textSub }}>納期の特例を適用している場合、この期間の源泉徴収税額をまとめて納付します。</p>
        </div>

        {/* 合計カード */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: "納付税額合計", value: fmt(grandTotalTax), color: "#c45555" },
            { label: "セラピスト源泉", value: fmt(totalThTax), sub: `${therapistSummary.length}名`, color: "#c3a782" },
            { label: "対象報酬合計", value: fmt(totalThGross + totalStGross), color: T.text },
          ].map(s => (
            <div key={s.label} className="rounded-2xl border p-5" style={{ backgroundColor: T.card, borderColor: T.border }}>
              <p className="text-[10px] mb-2" style={{ color: T.textMuted }}>{s.label}</p>
              <p className="text-[22px] font-light mb-1" style={{ color: s.color }}>{s.value}</p>
              {(s as any).sub && <p className="text-[9px]" style={{ color: T.textFaint }}>{(s as any).sub}</p>}
            </div>
          ))}
        </div>

        {/* 月別内訳テーブル */}
        <div className="rounded-2xl border overflow-hidden mb-6" style={{ backgroundColor: T.card, borderColor: T.border }}>
          <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: `1px solid ${T.border}` }}>
            <h2 className="text-[13px] font-medium">📅 月別源泉徴収額</h2>
          </div>
          <table className="w-full text-[11px]">
            <thead><tr style={{ borderBottom: `1px solid ${T.border}` }}>
              {["月", "セラピスト報酬", "セラピスト源泉", "スタッフ源泉", "月合計"].map(h => <th key={h} className="py-2.5 px-3 text-left font-normal text-[10px]" style={{ color: T.textMuted }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {monthlyTotals.map(r => {
                const total = r.therapistTax + r.staffTax + r.salaryTax;
                return (
                  <tr key={r.month} style={{ borderBottom: `1px solid ${T.border}` }}>
                    <td className="py-2.5 px-3 font-medium">{r.month}月</td>
                    <td className="py-2.5 px-3">{r.therapistGross > 0 ? fmt(r.therapistGross) : "-"}</td>
                    <td className="py-2.5 px-3" style={{ color: r.therapistTax > 0 ? "#c45555" : T.textFaint }}>{r.therapistTax > 0 ? fmt(r.therapistTax) : "-"}</td>
                    <td className="py-2.5 px-3" style={{ color: r.staffTax > 0 ? "#c45555" : T.textFaint }}>{r.staffTax > 0 ? fmt(r.staffTax) : "-"}</td>
                    <td className="py-2.5 px-3 font-bold" style={{ color: total > 0 ? "#c45555" : T.textFaint }}>{total > 0 ? fmt(total) : "-"}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot><tr style={{ borderTop: `2px solid ${T.border}` }}>
              <td className="py-2.5 px-3 font-bold">合計</td>
              <td className="py-2.5 px-3 font-bold">{fmt(totalThGross)}</td>
              <td className="py-2.5 px-3 font-bold" style={{ color: "#c45555" }}>{fmt(totalThTax)}</td>
              <td className="py-2.5 px-3 font-bold" style={{ color: "#c45555" }}>{fmt(totalStTax)}</td>
              <td className="py-2.5 px-3 font-bold" style={{ color: "#c45555" }}>{fmt(grandTotalTax)}</td>
            </tr></tfoot>
          </table>
        </div>

        {/* セラピスト別内訳 */}
        {therapistSummary.length > 0 && (
          <div className="rounded-2xl border overflow-hidden mb-6" style={{ backgroundColor: T.card, borderColor: T.border }}>
            <div className="px-5 py-3" style={{ borderBottom: `1px solid ${T.border}` }}>
              <h2 className="text-[13px] font-medium">👤 セラピスト別内訳（{current.start}〜{current.end}月）</h2>
            </div>
            <table className="w-full text-[11px]">
              <thead><tr style={{ borderBottom: `1px solid ${T.border}` }}>
                {["名前", "稼働日数", "報酬額", "源泉徴収額"].map(h => <th key={h} className="py-2.5 px-3 text-left font-normal text-[10px]" style={{ color: T.textMuted }}>{h}</th>)}
              </tr></thead>
              <tbody>
                {therapistSummary.map(r => (
                  <tr key={r.name} style={{ borderBottom: `1px solid ${T.border}` }}>
                    <td className="py-2.5 px-3 font-medium">{r.name}</td>
                    <td className="py-2.5 px-3">{r.count}日</td>
                    <td className="py-2.5 px-3">{fmt(r.gross)}</td>
                    <td className="py-2.5 px-3" style={{ color: "#c45555" }}>{fmt(r.tax)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr style={{ borderTop: `2px solid ${T.border}` }}>
                <td className="py-2.5 px-3 font-bold">合計</td>
                <td className="py-2.5 px-3 font-bold">{therapistSummary.reduce((s,r) => s + r.count, 0)}日</td>
                <td className="py-2.5 px-3 font-bold">{fmt(totalThGross)}</td>
                <td className="py-2.5 px-3 font-bold" style={{ color: "#c45555" }}>{fmt(totalThTax)}</td>
              </tr></tfoot>
            </table>
          </div>
        )}

        {grandTotalTax === 0 && therapistSummary.length === 0 && (
          <p className="text-[12px] text-center py-8" style={{ color: T.textFaint }}>この期間の源泉徴収データがありません</p>
        )}

        {/* アクションボタン */}
        <div className="flex gap-3">
          <button onClick={openPaymentSlip} className="flex-1 px-4 py-3 text-[11px] rounded-xl cursor-pointer text-white font-medium" style={{ backgroundColor: "#c45555" }}>📄 納付集計表を表示</button>
          <button onClick={exportCSV} className="flex-1 px-4 py-3 text-[11px] rounded-xl cursor-pointer text-white font-medium" style={{ backgroundColor: "#3b82f6" }}>📥 CSV出力</button>
        </div>

        {/* 注意事項 */}
        <div className="rounded-xl p-4 mt-4" style={{ backgroundColor: T.cardAlt }}>
          <p className="text-[10px] font-medium mb-2" style={{ color: T.textMuted }}>📝 所得税徴収高計算書（納付書）の記入方法</p>
          <div className="space-y-1 text-[9px]" style={{ color: T.textFaint }}>
            <p>• 「報酬・料金等の所得税徴収高計算書」を使用（給与とは別の納付書）</p>
            <p>• 「区分」欄 →「ホステス等の報酬・料金」（所得税法204条1項6号）</p>
            <p>• 「支払年月日」→ 期間の最初と最後の日（例：1/1〜6/30）</p>
            <p>• 「人員」→ 延べ人数（日数の合計）</p>
            <p>• 「支払金額」→ 報酬額の合計</p>
            <p>• 「税額」→ 源泉徴収税額の合計</p>
            <p>• 納付先：管轄税務署（名古屋中税務署）</p>
          </div>
        </div>
      </>)}
    </div>
  );
}

function TaxCalendar({ T, onNavigate }: { T: any; onNavigate: (tab: string) => void }) {
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const [viewYear, setViewYear] = useState(currentYear);
  const fmt2 = (m: number) => `${viewYear}年${m}月`;

  type Task = {
    month: number;
    day: number;
    title: string;
    who: "オーナー" | "税理士" | "両方";
    urgency: "high" | "medium" | "low";
    what: string;
    detail: string;
    downloads?: { label: string; tab: string }[];
  };

  const tasks: Task[] = [
    // ── 1月 ──
    {
      month: 1, day: 20,
      title: "源泉徴収税の納付（7〜12月分）",
      who: "オーナー", urgency: "high",
      what: "前年7〜12月にセラピストから預かった源泉徴収税をまとめて税務署に納付する",
      detail: `【やること】
① T-MANAGEの「源泉徴収納付」タブを開く
② 前年の「下半期（7〜12月）」を選択
③ 「納付集計表を表示」で金額を確認
④ 「CSV出力」で税理士さんに送る
⑤ 税理士さんが作成した納付書で銀行 or e-Taxで納付

【注意】
• 納期の特例を適用している場合のスケジュールです
• 金額は「納付税額合計」の金額を納付します
• 期限は1月20日（土日の場合は翌営業日）`,
      downloads: [{ label: "源泉徴収 下半期CSV", tab: "withholding" }],
    },
    {
      month: 1, day: 31,
      title: "法定調書・支払調書の提出",
      who: "両方", urgency: "high",
      what: "前年1〜12月にセラピストに払った報酬の内訳を税務署に届け出る",
      detail: `【やること】
① T-MANAGEの「セラピスト支払調書」タブを開く
② 前年を選択し、「全員分表示」でPDFを確認
③ 各セラピストの支払調書PDFを保存 or 印刷
④ 税理士さんに渡す（CSVでもOK）
⑤ 税理士さんが「法定調書合計表」を作成して提出

【含まれる書類】
• 報酬、料金、契約金及び賞金の支払調書（セラピスト分）
• 給与所得の源泉徴収票（従業員分）← 税理士さんが作成
• 法定調書合計表 ← 税理士さんが作成

【ポイント】
• 年間5万円超のセラピストは全員提出義務あり
• マイナンバーがなくても提出可能（空欄でOK）
• セラピストの本名・住所が必要（源氏名ではなく）`,
      downloads: [{ label: "セラピスト支払調書", tab: "therapist_payroll" }, { label: "スタッフ支払調書", tab: "staff_payroll" }],
    },
    {
      month: 1, day: 31,
      title: "給与支払報告書の提出",
      who: "税理士", urgency: "medium",
      what: "社員（雇用契約）の給与情報を各市区町村に届け出る",
      detail: `【対象者】
• 雇用契約の社員のみ（社労士の大石さんが給与計算を担当）
• T-MANAGEのスタッフは全員「業務委託」なので対象外

【税理士さん・社労士さんがやること】
• 社員の給与支払報告書を安城市・豊橋市などに提出
• 住民税の特別徴収（給料天引き）の届出

【オーナーがやること】
• 特になし（税理士さん・社労士さんに任せてOK）
• 社員の住所変更があれば事前に伝える`,
    },
    // ── 3月 ──
    {
      month: 3, day: 31,
      title: "★ 決算日（事業年度の終了）",
      who: "オーナー", urgency: "high",
      what: "合同会社テラスライフの事業年度（4/1〜3/31）が終了する日",
      detail: `【やること】
① 3月末時点の現金・預金残高を確認する
② 在庫（貯蔵品：紙パンツ・オイル等）の棚卸しをする
③ 3月分の売上・経費をT-MANAGEで確認
④ 未払いの経費がないか確認する

【棚卸しのやり方】
• 全店舗の備品在庫を数える（紙パンツ○枚、オイル○本…）
• 仕入単価 × 数量 = 棚卸金額
• 写真を撮っておくと安心

【税理士さんに渡すもの】
• T-MANAGEの「経理サマリー」年次CSV
• 棚卸しの金額メモ
• 通帳のコピー or 残高のスクショ`,
      downloads: [{ label: "経理サマリー 年次CSV", tab: "summary" }],
    },
    // ── 4月〜5月 ──
    {
      month: 4, day: 30,
      title: "決算データを税理士さんに渡す",
      who: "オーナー", urgency: "high",
      what: "税理士さんが申告書を作るために必要なデータを全部渡す",
      detail: `【渡すもの一覧】
① T-MANAGEから出力
  • 年間売上データ（経理サマリーCSV）
  • セラピスト別外注費（支払調書CSV）
  • 源泉徴収集計（源泉CSV）

② 手元の書類
  • 銀行通帳のコピー（全口座の3月末残高）
  • 棚卸し結果（在庫の金額）
  • 保険証書、契約書などの新規分
  • 車検証、リース契約書（あれば）
  • 敷金・権利金の領収書（新規物件分）

【ポイント】
• 遅くとも4月中に渡せば、税理士さんが5月末の期限に間に合う
• 早めに渡すほど税理士さんも助かる`,
      downloads: [{ label: "経理サマリー CSV", tab: "summary" }, { label: "セラピスト支払調書", tab: "therapist_payroll" }, { label: "源泉徴収 年間CSV", tab: "withholding" }],
    },
    {
      month: 5, day: 31,
      title: "法人税・消費税の確定申告・納付",
      who: "税理士", urgency: "high",
      what: "法人税・消費税・地方税の申告書を提出し、税金を納付する",
      detail: `【税理士さんがやること】
• 法人税の確定申告書を作成・提出（e-Tax）
• 消費税の確定申告書を作成・提出
• 法人事業税・法人住民税の申告書を作成・提出

【オーナーがやること】
• 税理士さんから届く「納付額」を確認する
• 銀行振込 or e-Taxで納付する
• 納付期限は5月31日（2ヶ月以内）

【納付額の目安】
• 黒字の場合：法人税（所得の15〜23%）+ 地方法人税 + 消費税
• 均等割：約7万円（赤字でも必ず必要）

【複数拠点の注意】
テラスライフは安城市・豊橋市に事業所があるため：
• 法人住民税（均等割）→ 各市に納付が必要
• 法人事業税 → 愛知県に納付
• 法人税 → 国（名古屋中税務署）に納付

【注意】
• 赤字でも「均等割」（最低約7万円）は必ず納付が必要
• 申告期限の延長を届け出れば+1ヶ月の猶予が可能`,
    },
    {
      month: 5, day: 31,
      title: "自動車税の納付",
      who: "オーナー", urgency: "medium",
      what: "法人名義の車両にかかる自動車税を納付する",
      detail: `【届く書類】
• 5月上旬に本店所在地（栄2-1-12）に納付書が届く
• 法人名義の車両すべて分が届きます

【納付方法】
• コンビニ（バーコード付き用紙）
• 銀行窓口
• PayPay・LINE Pay等のスマホ決済
• クレジットカード（手数料あり）

【金額の目安】
• 普通車：排気量に応じて29,500円〜111,000円
• 軽自動車：10,800円

【注意】
• 期限は5月31日（遅れると延滞金がかかる）
• 届いたらすぐ払うのが安心
• 経費科目は「租税公課」で計上`,
    },
    // ── 6月 ──
    {
      month: 6, day: 30,
      title: "労働保険の年度更新",
      who: "税理士", urgency: "medium",
      what: "労災保険・雇用保険の保険料を年1回申告・納付する（社員対象）",
      detail: `【社労士の大石さんがやること】
• 前年度の賃金総額をもとに確定保険料を計算
• 今年度の概算保険料を計算
• 「労働保険 年度更新申告書」を労基署に提出・納付

【対象】
• 雇用契約の社員のみ
• 業務委託のセラピスト・スタッフは対象外

【オーナーがやること】
• 社労士の大石さんに任せてOK
• 社員の給与データを求められたら渡す
• 保険料の納付（大石さんから案内あり）

【時期】
• 6月1日〜7月10日が申告・納付期間
• 金額が大きい場合は3回分割も可能`,
    },
    {
      month: 9, day: 30,
      title: "従業員の健康診断",
      who: "オーナー", urgency: "medium",
      what: "社員（雇用契約）に年1回の健康診断を受けさせる（法的義務）",
      detail: `【法律上の義務】
• 労働安全衛生法により、事業者は常時雇用する労働者に対して年1回の健康診断が義務
• 受けさせないと50万円以下の罰金の対象

【対象者】
• 雇用契約の社員（週30時間以上勤務）
• 業務委託のセラピスト・スタッフは法的義務なし（ただし受けさせるのは良いこと）

【やること】
① 近くのクリニック or 健診センターに予約
② 社員に日時を伝える
③ 健診結果を会社で保管（5年間保存義務）

【費用】
• 1人あたり約5,000〜10,000円（会社負担が原則）
• 経費科目は「福利厚生費」で計上

【おすすめ時期】
• 年度の前半（4〜9月）に済ませておくと安心
• 全員同じ日に受けると管理が楽`,
    },
    // ── 7月 ──
    {
      month: 7, day: 10,
      title: "源泉徴収税の納付（1〜6月分）",
      who: "オーナー", urgency: "high",
      what: "1〜6月にセラピストから預かった源泉徴収税をまとめて税務署に納付する",
      detail: `【やること】
① T-MANAGEの「源泉徴収納付」タブを開く
② 今年の「上半期（1〜6月）」を選択
③ 「納付集計表を表示」で金額を確認
④ 「CSV出力」で税理士さんに送る
⑤ 税理士さんが作成した納付書で銀行 or e-Taxで納付

【注意】
• 1月の納付と同じ流れです
• 期限は7月10日（厳守！遅れると不納付加算税）`,
      downloads: [{ label: "源泉徴収 上半期CSV", tab: "withholding" }],
    },
    {
      month: 7, day: 10,
      title: "社会保険の算定基礎届",
      who: "税理士", urgency: "medium",
      what: "社員の社会保険料を見直すための届出（4〜6月の給与で計算）",
      detail: `【社労士の大石さんがやること】
• 4月・5月・6月の社員給与をもとに、新しい社会保険料を計算
• 算定基礎届を年金事務所に提出
• 9月から新しい保険料率が適用される

【対象】
• 雇用契約の社員のみ
• 業務委託のセラピスト・スタッフは対象外

【オーナーがやること】
• 社労士の大石さんに任せてOK
• 社員の給与変動があれば報告する`,
    },
    // ── 10月〜11月 ──
    {
      month: 10, day: 31,
      title: "中間申告・納付（法人税）",
      who: "税理士", urgency: "medium",
      what: "前期の税額が一定額を超えた場合、中間で仮の税金を納付する",
      detail: `【該当する場合のみ】
• 前期の法人税が20万円超 → 中間申告が必要
• 前期の消費税が48万円超 → 中間申告が必要
• 前期が赤字なら中間申告は不要

【オーナーがやること】
• 税理士さんから「中間納付が必要」と言われたら納付する
• 金額は前期の税額の半分（予定申告）か、仮決算による金額`,
    },
    // ── 12月 ──
    {
      month: 12, day: 31,
      title: "年末調整",
      who: "税理士", urgency: "medium",
      what: "社員（雇用契約）の1年間の所得税を精算する",
      detail: `【対象者】
• 雇用契約の社員のみ
• 業務委託のセラピスト・スタッフは対象外（自分で確定申告する）

【社労士の大石さん・税理士さんがやること】
• 社員の年末調整の計算
• 源泉徴収票の作成
• 過不足額の精算（12月 or 1月の給与で調整）

【11月中にオーナーがやること】
• 社員から以下の書類を集めて社労士・税理士に渡す：
  - 扶養控除等申告書
  - 保険料控除申告書（生命保険等の証明書も）
  - 住宅ローン控除の証明書（該当者のみ）`,
    },
  ];

  const monthNames = ["1月","2月","3月","4月","5月","6月","7月","8月","9月","10月","11月","12月"];
  const monthColors: Record<string, string> = { high: "#c45555", medium: "#f59e0b", low: "#22c55e" };
  const whoColors: Record<string, string> = { "オーナー": "#c3a782", "税理士": "#85a8c4", "両方": "#a78bc4" };

  const [expandedTask, setExpandedTask] = useState<number | null>(null);

  // 今月に近いタスクを強調
  const getMonthStatus = (month: number) => {
    if (viewYear < currentYear) return "past";
    if (viewYear > currentYear) return "future";
    if (month < currentMonth) return "past";
    if (month === currentMonth) return "current";
    return "future";
  };

  // 事業年度順に並べ替え（4月始まり）
  const fiscalOrder = [4,5,6,7,8,9,10,11,12,1,2,3];

  return (
    <div className="max-w-[900px] mx-auto pb-8">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setViewYear(viewYear - 1)} className="px-2 py-1 cursor-pointer" style={{ color: T.textSub }}>◀</button>
          <span className="text-[14px] font-medium">{viewYear}年度（{viewYear}年4月〜{viewYear + 1}年3月）</span>
          <button onClick={() => setViewYear(viewYear + 1)} className="px-2 py-1 cursor-pointer" style={{ color: T.textSub }}>▶</button>
        </div>
      </div>

      {/* 会社情報 */}
      <div className="rounded-xl p-4 mb-4" style={{ backgroundColor: T.cardAlt, border: `1px solid ${T.border}` }}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[13px] font-medium" style={{ color: T.text }}>合同会社テラスライフ</p>
            <p className="text-[10px]" style={{ color: T.textMuted }}>事業年度：4月1日〜3月31日（3月決算） ｜ 管轄：名古屋中税務署 ｜ 税理士：江坂留衣</p>
          </div>
          <div className="flex gap-2">
            {[{c:"#c3a782",l:"オーナー"},{c:"#85a8c4",l:"税理士"},{c:"#a78bc4",l:"両方"}].map(w => (
              <span key={w.l} className="text-[9px] px-2 py-1 rounded-full" style={{ backgroundColor: w.c + "18", color: w.c }}>{w.l}</span>
            ))}
          </div>
        </div>
      </div>

      {/* タイムライン */}
      {fiscalOrder.map(month => {
        const displayYear = month >= 4 ? viewYear : viewYear + 1;
        const monthTasks = tasks.filter(t => t.month === month);
        const status = getMonthStatus(month);
        const isCurrent = displayYear === currentYear && month === currentMonth;

        if (monthTasks.length === 0) {
          return (
            <div key={month} className="flex items-stretch mb-1">
              <div className="w-[60px] flex-shrink-0 text-right pr-3 pt-2">
                <span className="text-[12px] font-medium" style={{ color: isCurrent ? "#c3a782" : T.textFaint }}>{displayYear}/{month}月</span>
              </div>
              <div className="flex flex-col items-center" style={{ width: 20 }}>
                <div className="w-2 h-2 rounded-full flex-shrink-0 mt-3" style={{ backgroundColor: isCurrent ? "#c3a782" : T.border }} />
                <div className="flex-1 w-px" style={{ backgroundColor: T.border }} />
              </div>
              <div className="flex-1 pl-3 py-2">
                <p className="text-[10px]" style={{ color: T.textFaint }}>特になし {month === 3 ? "" : month >= 4 && month <= 8 ? "（通常業務）" : ""}</p>
              </div>
            </div>
          );
        }

        return (
          <div key={month}>
            {monthTasks.map((task, ti) => {
              const taskIdx = tasks.indexOf(task);
              const isExpanded = expandedTask === taskIdx;
              return (
                <div key={ti} className="flex items-stretch mb-1">
                  <div className="w-[60px] flex-shrink-0 text-right pr-3 pt-3">
                    {ti === 0 && <span className="text-[12px] font-medium" style={{ color: isCurrent ? "#c3a782" : status === "past" ? T.textFaint : T.text }}>{displayYear}/{month}月</span>}
                  </div>
                  <div className="flex flex-col items-center" style={{ width: 20 }}>
                    <div className="w-3 h-3 rounded-full flex-shrink-0 mt-3.5" style={{ backgroundColor: isCurrent ? "#c3a782" : monthColors[task.urgency] + (status === "past" ? "66" : ""), border: isCurrent ? "2px solid #c3a782" : "none" }} />
                    <div className="flex-1 w-px" style={{ backgroundColor: T.border }} />
                  </div>
                  <div className="flex-1 pl-3 py-1.5">
                    <div
                      className="rounded-xl border p-4 cursor-pointer transition-all"
                      style={{
                        backgroundColor: isExpanded ? T.card : (isCurrent ? "#c3a78208" : T.card),
                        borderColor: isCurrent ? "#c3a78244" : T.border,
                        opacity: status === "past" ? 0.6 : 1,
                      }}
                      onClick={() => setExpandedTask(isExpanded ? null : taskIdx)}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[9px] px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: monthColors[task.urgency] + "18", color: monthColors[task.urgency] }}>{task.urgency === "high" ? "⚠️ 重要" : task.urgency === "medium" ? "📋 通常" : "ℹ️ 参考"}</span>
                          <span className="text-[9px] px-2 py-0.5 rounded-full" style={{ backgroundColor: whoColors[task.who] + "18", color: whoColors[task.who] }}>{task.who === "オーナー" ? "👤 オーナーがやる" : task.who === "税理士" ? "📝 税理士さんがやる" : "🤝 両方でやる"}</span>
                          <span className="text-[9px]" style={{ color: T.textFaint }}>{displayYear}/{month}/{task.day}まで</span>
                        </div>
                        <span className="text-[10px]" style={{ color: T.textMuted }}>{isExpanded ? "▲" : "▼"}</span>
                      </div>
                      <p className="text-[12px] font-medium mb-1" style={{ color: T.text }}>{task.title}</p>
                      <p className="text-[10px]" style={{ color: T.textSub }}>{task.what}</p>

                      {isExpanded && (
                        <div className="mt-4 pt-3" style={{ borderTop: `1px solid ${T.border}` }}>
                          <pre className="text-[10px] whitespace-pre-wrap leading-relaxed mb-3" style={{ color: T.textSub, fontFamily: "inherit" }}>{task.detail}</pre>
                          {task.downloads && task.downloads.length > 0 && (
                            <div className="flex gap-2 flex-wrap">
                              {task.downloads.map((d, di) => (
                                <button key={di} onClick={(e) => { e.stopPropagation(); onNavigate(d.tab); }} className="px-3 py-2 text-[10px] rounded-lg cursor-pointer font-medium" style={{ backgroundColor: "#c3a78218", color: "#c3a782", border: "1px solid #c3a78233" }}>📥 {d.label} →</button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}

      {/* 年間フロー図 */}
      <div className="rounded-2xl border p-5 mt-6" style={{ backgroundColor: T.card, borderColor: T.border }}>
        <h3 className="text-[13px] font-medium mb-4" style={{ color: T.text }}>📋 1年間のまとめ</h3>
        <div className="space-y-3 text-[11px]">
          <div className="flex gap-3 items-start">
            <span className="flex-shrink-0 w-[60px] text-right font-medium" style={{ color: "#c3a782" }}>毎日</span>
            <span style={{ color: T.textSub }}>T-MANAGEで清算するだけでOK。源泉徴収も自動計算。社員の大入り発生時のみ社労士の大石さんに報告。</span>
          </div>
          <div className="flex gap-3 items-start">
            <span className="flex-shrink-0 w-[60px] text-right font-medium" style={{ color: "#f59e0b" }}>半年に1回</span>
            <span style={{ color: T.textSub }}>源泉徴収の納付。T-MANAGEからCSVを出して税理士さんに渡す → 納付書で納付（7月・1月）</span>
          </div>
          <div className="flex gap-3 items-start">
            <span className="flex-shrink-0 w-[60px] text-right font-medium" style={{ color: "#c45555" }}>年に1回</span>
            <span style={{ color: T.textSub }}>①支払調書の提出（1月） ②決算データを渡す（4月） ③税金の納付（5月） ④年末調整（12月）</span>
          </div>
        </div>
      </div>

      {/* 大入り・給与の報告フロー */}
      <div className="rounded-2xl border p-5 mt-4" style={{ backgroundColor: T.card, borderColor: T.border }}>
        <h3 className="text-[13px] font-medium mb-3" style={{ color: T.text }}>🔄 大入りの処理フロー</h3>
        <div className="space-y-3">
          {/* 社員の場合 */}
          <div className="rounded-xl p-3" style={{ backgroundColor: "#22c55e08", border: "1px solid #22c55e22" }}>
            <p className="text-[10px] font-medium mb-2" style={{ color: "#22c55e" }}>👤 社員（雇用契約）の大入り → 給与扱い</p>
            <div className="flex items-center gap-2 flex-wrap text-[10px]">
              <span className="px-2 py-1 rounded" style={{ backgroundColor: "#c3a78218", color: "#c3a782" }}>① 大入り発生</span>
              <span style={{ color: T.textFaint }}>→</span>
              <span className="px-2 py-1 rounded" style={{ backgroundColor: "#22c55e18", color: "#22c55e" }}>② 社労士 大石さんに報告</span>
              <span style={{ color: T.textFaint }}>→</span>
              <span className="px-2 py-1 rounded" style={{ backgroundColor: "#85a8c418", color: "#85a8c4" }}>③ 給与総額変更・源泉徴収</span>
              <span style={{ color: T.textFaint }}>→</span>
              <span className="px-2 py-1 rounded" style={{ backgroundColor: "#a78bc418", color: "#a78bc4" }}>④ 社労士↔税理士が連携</span>
            </div>
            <p className="text-[9px] mt-2" style={{ color: T.textFaint }}>給与総額が変わると源泉徴収額・社会保険料も変わるため、社労士と税理士が連携して処理します。</p>
          </div>
          {/* 業務委託スタッフの場合 */}
          <div className="rounded-xl p-3" style={{ backgroundColor: "#c3a78208", border: "1px solid #c3a78222" }}>
            <p className="text-[10px] font-medium mb-2" style={{ color: "#c3a782" }}>🏪 業務委託スタッフの大入り → 外注費扱い</p>
            <div className="flex items-center gap-2 flex-wrap text-[10px]">
              <span className="px-2 py-1 rounded" style={{ backgroundColor: "#c3a78218", color: "#c3a782" }}>① 大入り発生</span>
              <span style={{ color: T.textFaint }}>→</span>
              <span className="px-2 py-1 rounded" style={{ backgroundColor: "#f59e0b18", color: "#f59e0b" }}>② インボイス未登録なら10%控除</span>
              <span style={{ color: T.textFaint }}>→</span>
              <span className="px-2 py-1 rounded" style={{ backgroundColor: "#85a8c418", color: "#85a8c4" }}>③ 外注費として計上</span>
            </div>
            <p className="text-[9px] mt-2" style={{ color: T.textFaint }}>源泉徴収は不要。大石さんへの報告も不要。T-MANAGEの清算で自動処理されます。</p>
          </div>
        </div>
      </div>

      {/* 連絡先 */}
      <div className="rounded-2xl border p-5 mt-4" style={{ backgroundColor: T.card, borderColor: T.border }}>
        <h3 className="text-[13px] font-medium mb-3" style={{ color: T.text }}>💡 困ったときの連絡先</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-xl p-3" style={{ backgroundColor: T.cardAlt }}>
            <p className="text-[10px] font-medium mb-1" style={{ color: "#85a8c4" }}>📝 税理士</p>
            <p className="text-[11px] font-medium" style={{ color: T.text }}>江坂留衣</p>
            <p className="text-[9px]" style={{ color: T.textMuted }}>江坂留衣税理士事務所</p>
            <p className="text-[9px]" style={{ color: T.textMuted }}>岡崎市藤川町一里山南13</p>
            <p className="text-[9px]" style={{ color: T.textMuted }}>TEL: 0564-83-5731</p>
            <p className="text-[8px] mt-1" style={{ color: T.textFaint }}>担当：法人税・消費税・支払調書・源泉納付書</p>
          </div>
          <div className="rounded-xl p-3" style={{ backgroundColor: T.cardAlt }}>
            <p className="text-[10px] font-medium mb-1" style={{ color: "#22c55e" }}>🏥 社労士</p>
            <p className="text-[11px] font-medium" style={{ color: T.text }}>大石さん</p>
            <p className="text-[9px]" style={{ color: T.textMuted }}>（事務所名・電話番号は後日追加）</p>
            <p className="text-[8px] mt-1" style={{ color: T.textFaint }}>担当：社員の給与計算・社会保険・大入り報告・年末調整・算定基礎届</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function MyNumberManager({ T }: { T: any }) {
  const [therapists, setTherapists] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<number | null>(null);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from("therapists").select("id, name, real_name, entry_date, mynumber, mynumber_photo_url, mynumber_photo_url_back, status").order("sort_order");
      if (data) setTherapists(data);
      setLoading(false);
    };
    fetch();
  }, []);

  const submitted = therapists.filter(t => t.mynumber || t.mynumber_photo_url);
  const notSubmitted = therapists.filter(t => !t.mynumber && !t.mynumber_photo_url && t.status === "active");

  const openPDF = (t: any) => {
    const w = window.open("", "_blank"); if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>マイナンバー_${t.real_name || t.name}</title>
<style>body{font-family:'Hiragino Sans','Yu Gothic','Meiryo',sans-serif;max-width:700px;margin:40px auto;padding:30px;color:#333}h1{text-align:center;font-size:18px;border-bottom:2px solid #333;padding-bottom:8px;margin-bottom:20px}table{width:100%;border-collapse:collapse;margin:15px 0}td,th{border:1px solid #ccc;padding:10px 14px;font-size:13px}th{background:#f5f0e8;text-align:left;width:35%}.photos{display:flex;gap:20px;margin:20px 0}.photo-box{flex:1;text-align:center}.photo-box img{max-width:100%;max-height:300px;border:1px solid #ddd;border-radius:8px}.photo-label{font-size:11px;color:#888;margin-bottom:5px}.note{font-size:10px;color:#c45555;margin-top:20px;padding:10px;background:#fff5f5;border:1px solid #fecaca;border-radius:8px}@media print{body{margin:0;padding:15px}.note{break-inside:avoid}}</style></head><body>
<h1>マイナンバー管理台帳</h1>
<table>
<tr><th>源氏名</th><td>${t.name}</td></tr>
<tr><th>本名</th><td>${t.real_name || "未登録"}</td></tr>
<tr><th>入店日</th><td>${t.entry_date || "未登録"}</td></tr>
<tr><th>個人番号</th><td style="font-family:monospace;font-size:16px;letter-spacing:2px">${t.mynumber || "未登録"}</td></tr>
</table>
<div class="photos">
${t.mynumber_photo_url ? `<div class="photo-box"><p class="photo-label">表面</p><img src="${t.mynumber_photo_url}" /></div>` : '<div class="photo-box"><p class="photo-label">表面</p><p style="color:#c45555;padding:40px">未アップロード</p></div>'}
${t.mynumber_photo_url_back ? `<div class="photo-box"><p class="photo-label">裏面</p><img src="${t.mynumber_photo_url_back}" /></div>` : '<div class="photo-box"><p class="photo-label">裏面</p><p style="color:#c45555;padding:40px">未アップロード</p></div>'}
</div>
<div class="note">⚠️ この書類はマイナンバー法に基づき厳重に管理してください。目的外利用は禁止されています。不要になった場合は速やかに破棄してください。</div>
</body></html>`);
    w.document.close();
  };

  const openAllPDF = () => {
    const targets = submitted.filter(t => t.mynumber || t.mynumber_photo_url);
    if (targets.length === 0) return;
    const w = window.open("", "_blank"); if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>マイナンバー一括_${new Date().toISOString().split("T")[0]}</title>
<style>body{font-family:'Hiragino Sans','Yu Gothic','Meiryo',sans-serif;max-width:700px;margin:0 auto;padding:20px;color:#333}h1{text-align:center;font-size:16px;margin-bottom:5px}.date{text-align:center;font-size:11px;color:#888;margin-bottom:20px}.person{page-break-after:always;border:1px solid #ddd;border-radius:12px;padding:20px;margin-bottom:20px}table{width:100%;border-collapse:collapse;margin:10px 0}td,th{border:1px solid #ccc;padding:8px 12px;font-size:12px}th{background:#f5f0e8;text-align:left;width:35%}.photos{display:flex;gap:15px;margin:15px 0}.photo-box{flex:1;text-align:center}.photo-box img{max-width:100%;max-height:250px;border:1px solid #ddd;border-radius:6px}.photo-label{font-size:10px;color:#888;margin-bottom:4px}.note{font-size:9px;color:#c45555;margin-top:15px;padding:8px;background:#fff5f5;border:1px solid #fecaca;border-radius:6px}@media print{.person{break-after:page;border:none;padding:0}}</style></head><body>
<h1>マイナンバー管理台帳（一括）</h1>
<p class="date">出力日: ${new Date().toLocaleDateString("ja-JP")} ｜ ${targets.length}名</p>
${targets.map(t => `<div class="person">
<table>
<tr><th>源氏名</th><td>${t.name}</td></tr>
<tr><th>本名</th><td>${t.real_name || "未登録"}</td></tr>
<tr><th>入店日</th><td>${t.entry_date || "未登録"}</td></tr>
<tr><th>個人番号</th><td style="font-family:monospace;font-size:14px;letter-spacing:2px">${t.mynumber || "未登録"}</td></tr>
</table>
<div class="photos">
${t.mynumber_photo_url ? `<div class="photo-box"><p class="photo-label">表面</p><img src="${t.mynumber_photo_url}" /></div>` : ""}
${t.mynumber_photo_url_back ? `<div class="photo-box"><p class="photo-label">裏面</p><img src="${t.mynumber_photo_url_back}" /></div>` : ""}
</div>
</div>`).join("")}
<div class="note">⚠️ この書類はマイナンバー法に基づき厳重に管理してください。印刷後はローカルPCに保存し、クラウドからは削除を推奨します。</div>
</body></html>`);
    w.document.close();
  };

  const deleteFromCloud = async (t: any) => {
    if (!confirm(`${t.name}のマイナンバーデータをクラウドから削除しますか？\n\n削除されるもの：\n• 個人番号（数字）\n• カード写真（表面・裏面）\n\n⚠️ 事前にPDFをダウンロードしてローカルに保存してください。`)) return;
    setDeleting(t.id);
    const updates: any = { mynumber: "", mynumber_photo_url: "", mynumber_photo_url_back: "" };
    // Storage内の画像も削除
    try {
      await supabase.storage.from("therapist-photos").remove([`therapist_mynumber_${t.id}.jpg`, `therapist_mynumber_${t.id}.png`, `therapist_mynumber_${t.id}.jpeg`, `therapist_mynumber_back_${t.id}.jpg`, `therapist_mynumber_back_${t.id}.png`, `therapist_mynumber_back_${t.id}.jpeg`]);
    } catch { /* ファイルが存在しない場合は無視 */ }
    await supabase.from("therapists").update(updates).eq("id", t.id);
    setTherapists(prev => prev.map(p => p.id === t.id ? { ...p, ...updates } : p));
    setDeleting(null);
  };

  const fmt = (n: number) => "¥" + (n || 0).toLocaleString();

  return (
    <div className="max-w-[900px] mx-auto">
      {/* 注意事項 */}
      <div className="rounded-xl p-4 mb-4" style={{ backgroundColor: "#c4555512", border: "1px solid #c4555533" }}>
        <p className="text-[11px] font-medium" style={{ color: "#c45555" }}>🔒 マイナンバー管理について</p>
        <p className="text-[10px] mt-1" style={{ color: T.textSub }}>マイナンバーは番号法で厳格な管理が義務付けられています。PDFでダウンロードしたらローカルPCに保存し、クラウドからは削除することを推奨します。</p>
      </div>

      {/* サマリーカード */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="rounded-2xl border p-5 text-center" style={{ backgroundColor: T.card, borderColor: T.border }}>
          <p className="text-[10px] mb-1" style={{ color: T.textMuted }}>提出済み</p>
          <p className="text-[24px] font-light" style={{ color: "#22c55e" }}>{submitted.length}</p>
        </div>
        <div className="rounded-2xl border p-5 text-center" style={{ backgroundColor: T.card, borderColor: T.border }}>
          <p className="text-[10px] mb-1" style={{ color: T.textMuted }}>未提出</p>
          <p className="text-[24px] font-light" style={{ color: notSubmitted.length > 0 ? "#f59e0b" : T.textFaint }}>{notSubmitted.length}</p>
        </div>
        <div className="rounded-2xl border p-5 text-center" style={{ backgroundColor: T.card, borderColor: T.border }}>
          <p className="text-[10px] mb-1" style={{ color: T.textMuted }}>全セラピスト</p>
          <p className="text-[24px] font-light" style={{ color: T.text }}>{therapists.filter(t => t.status === "active").length}</p>
        </div>
      </div>

      {/* 一括操作 */}
      {submitted.length > 0 && (
        <div className="flex gap-3 mb-6">
          <button onClick={openAllPDF} className="flex-1 py-3 rounded-xl text-[11px] cursor-pointer font-medium text-white" style={{ backgroundColor: "#c45555" }}>📄 一括PDF表示（{submitted.length}名分）</button>
        </div>
      )}

      {loading ? <p className="text-center py-12 text-[12px]" style={{ color: T.textFaint }}>読み込み中...</p> : (<>
        {/* 提出済み */}
        {submitted.length > 0 && (
          <div className="rounded-2xl border overflow-hidden mb-6" style={{ backgroundColor: T.card, borderColor: T.border }}>
            <div className="px-5 py-3" style={{ borderBottom: `1px solid ${T.border}` }}>
              <h2 className="text-[13px] font-medium">✅ 提出済み（{submitted.length}名）</h2>
            </div>
            {submitted.map(t => (
              <div key={t.id} className="flex items-center justify-between px-5 py-3" style={{ borderBottom: `1px solid ${T.border}` }}>
                <div className="flex items-center gap-3">
                  <span className="text-[12px] font-medium">{t.name}</span>
                  {t.real_name && <span className="text-[10px]" style={{ color: T.textMuted }}>（{t.real_name}）</span>}
                  <div className="flex gap-1">
                    {t.mynumber && <span className="text-[8px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "#22c55e18", color: "#22c55e" }}>番号✓</span>}
                    {t.mynumber_photo_url && <span className="text-[8px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "#85a8c418", color: "#85a8c4" }}>表面✓</span>}
                    {t.mynumber_photo_url_back && <span className="text-[8px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "#85a8c418", color: "#85a8c4" }}>裏面✓</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => openPDF(t)} className="px-3 py-1.5 text-[9px] rounded-lg cursor-pointer" style={{ backgroundColor: "#85a8c418", color: "#85a8c4", border: "1px solid #85a8c433" }}>📄 PDF</button>
                  <button onClick={() => deleteFromCloud(t)} disabled={deleting === t.id} className="px-3 py-1.5 text-[9px] rounded-lg cursor-pointer" style={{ backgroundColor: "#c4555518", color: "#c45555", border: "1px solid #c4555533" }}>{deleting === t.id ? "削除中..." : "🗑 クラウド削除"}</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 未提出 */}
        {notSubmitted.length > 0 && (
          <div className="rounded-2xl border overflow-hidden mb-6" style={{ backgroundColor: T.card, borderColor: T.border }}>
            <div className="px-5 py-3" style={{ borderBottom: `1px solid ${T.border}` }}>
              <h2 className="text-[13px] font-medium" style={{ color: "#f59e0b" }}>⚠️ 未提出（{notSubmitted.length}名）</h2>
            </div>
            {notSubmitted.map(t => (
              <div key={t.id} className="flex items-center justify-between px-5 py-3" style={{ borderBottom: `1px solid ${T.border}` }}>
                <div className="flex items-center gap-3">
                  <span className="text-[12px] font-medium">{t.name}</span>
                  {t.real_name && <span className="text-[10px]" style={{ color: T.textMuted }}>（{t.real_name}）</span>}
                </div>
                <span className="text-[9px]" style={{ color: "#f59e0b" }}>セラピスト管理からアップロードしてください</span>
              </div>
            ))}
          </div>
        )}

        {submitted.length === 0 && notSubmitted.length === 0 && (
          <p className="text-center py-12 text-[12px]" style={{ color: T.textFaint }}>セラピストデータがありません</p>
        )}

        {/* 運用ガイド */}
        <div className="rounded-2xl border p-5" style={{ backgroundColor: T.card, borderColor: T.border }}>
          <h3 className="text-[13px] font-medium mb-3" style={{ color: T.text }}>📋 マイナンバー管理の流れ</h3>
          <div className="space-y-2 text-[10px]" style={{ color: T.textSub }}>
            <div className="flex items-start gap-2"><span className="flex-shrink-0" style={{ color: "#c3a782" }}>①</span><span>セラピストからLINEでマイナンバーカードの写真（表面・裏面）をもらう</span></div>
            <div className="flex items-start gap-2"><span className="flex-shrink-0" style={{ color: "#c3a782" }}>②</span><span><strong>セラピスト管理</strong>ページで各セラピストの編集画面からアップロード</span></div>
            <div className="flex items-start gap-2"><span className="flex-shrink-0" style={{ color: "#c3a782" }}>③</span><span>このページで<strong>PDF表示</strong> → ブラウザの印刷機能で<strong>「PDFとして保存」</strong></span></div>
            <div className="flex items-start gap-2"><span className="flex-shrink-0" style={{ color: "#c3a782" }}>④</span><span>ローカルPCに保存できたら<strong>「クラウド削除」</strong>で安全に消去</span></div>
          </div>
        </div>
      </>)}
    </div>
  );
}

function CertificateManager({ T }: { T: any }) {
  const [therapists, setTherapists] = useState<any[]>([]);
  const [storeInfo, setStoreInfo] = useState<any>(null);
  const [selectedId, setSelectedId] = useState<number>(0);
  const [certYear, setCertYear] = useState(new Date().getFullYear());
  const [search, setSearch] = useState("");
  const [issuing, setIssuing] = useState(false);
  const toast = useToast();
  const fmt = (n: number) => "¥" + (n || 0).toLocaleString();

  useEffect(() => {
    const f = async () => {
      const { data: th } = await supabase.from("therapists").select("id, name, real_name, address, entry_date, status, phone").neq("status", "trash").order("sort_order"); if (th) setTherapists(th);
      const { data: st } = await supabase.from("stores").select("company_name, company_address, company_phone"); if (st?.[0]) setStoreInfo(st[0]);
    }; f();
  }, []);

  const selected = therapists.find(t => t.id === selectedId);
  const filtered = therapists.filter(t => !search || t.name.includes(search) || (t.real_name || "").includes(search));

  const getStore = () => ({
    company_name: storeInfo?.company_name || "",
    company_address: storeInfo?.company_address || "",
    company_phone: storeInfo?.company_phone || "",
  });

  const getTh = (th: any) => ({
    real_name: th.real_name || th.name,
    name: th.name,
    address: th.address || "",
    entry_date: th.entry_date || "",
  });

  const fetchPayment = async (thId: number) => {
    const { data: sett } = await supabase.from("therapist_daily_settlements")
      .select("date, total_back").eq("therapist_id", thId)
      .gte("date", `${certYear}-01-01`).lte("date", `${certYear}-12-31`);
    const months: { month: number; amount: number; days: number }[] = [];
    for (let m = 1; m <= 12; m++) {
      const ms = (sett || []).filter((s: any) => new Date(s.date).getMonth() + 1 === m);
      months.push({ month: m, amount: ms.reduce((a: number, s: any) => a + (s.total_back || 0), 0), days: ms.length });
    }
    return { year: certYear, totalGross: months.reduce((a, m) => a + m.amount, 0), totalDays: months.reduce((a, m) => a + m.days, 0), months };
  };

  const issue = async (type: "contract" | "payment" | "transaction") => {
    if (!selected || !storeInfo) { toast.show("セラピストを選択してください", "error"); return; }
    setIssuing(true);
    try {
      if (type === "contract") {
        generateContractCertificate(getStore(), getTh(selected));
      } else {
        const payment = await fetchPayment(selected.id);
        if (type === "payment") generatePaymentCertificate(getStore(), getTh(selected), payment);
        else generateTransactionCertificate(getStore(), getTh(selected), payment);
      }
      toast.show("証明書を発行しました", "success");
    } catch { toast.show("発行に失敗しました", "error"); }
    setIssuing(false);
  };

  const statusMap: Record<string, { label: string; color: string }> = {
    active: { label: "稼働中", color: "#22c55e" },
    inactive: { label: "休止中", color: "#f59e0b" },
    retired: { label: "退職", color: "#888780" },
  };

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", animation: "fadeIn 0.3s" }}>
      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-[16px] font-medium">📄 証明書発行</h2>
        <span className="text-[10px] px-2 py-0.5 rounded" style={{ backgroundColor: "#c3a78218", color: "#c3a782" }}>会社印が必要な書類</span>
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: "320px 1fr" }}>
        {/* Left: Therapist selector */}
        <div className="rounded-xl border p-4" style={{ backgroundColor: T.card, borderColor: T.border }}>
          <p className="text-[11px] font-medium mb-3">セラピストを選択</p>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 名前で検索" className="w-full px-3 py-2 rounded-lg text-[11px] outline-none mb-3 border" style={{ backgroundColor: T.cardAlt, borderColor: T.border, color: T.text }} />
          <div className="space-y-1 overflow-y-auto" style={{ maxHeight: 400 }}>
            {filtered.map(th => {
              const st = statusMap[th.status] || statusMap.active;
              return (
                <button key={th.id} onClick={() => setSelectedId(th.id)} className="w-full text-left px-3 py-2.5 rounded-lg text-[11px] cursor-pointer flex items-center justify-between" style={{ backgroundColor: selectedId === th.id ? "#c3a78215" : "transparent", color: T.text, border: `1px solid ${selectedId === th.id ? "#c3a78244" : "transparent"}` }}>
                  <div>
                    <span className="font-medium">{th.name}</span>
                    {th.real_name && th.real_name !== th.name && <span className="ml-2 text-[9px]" style={{ color: T.textMuted }}>({th.real_name})</span>}
                  </div>
                  <span className="text-[8px] px-1.5 py-0.5 rounded" style={{ backgroundColor: st.color + "18", color: st.color }}>{st.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Certificate actions */}
        <div className="space-y-4">
          {selected ? (
            <>
              <div className="rounded-xl border p-4" style={{ backgroundColor: T.card, borderColor: T.border }}>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-[15px] font-medium">{selected.name}</p>
                    <p className="text-[11px]" style={{ color: T.textMuted }}>{selected.real_name || "本名未登録"} ・ {selected.address || "住所未登録"}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px]" style={{ color: T.textMuted }}>対象年度</span>
                    <select value={certYear} onChange={e => setCertYear(Number(e.target.value))} className="px-2 py-1 rounded-lg text-[11px] outline-none cursor-pointer border" style={{ backgroundColor: T.cardAlt, borderColor: T.border, color: T.text }}>
                      {[2026, 2025, 2024, 2023].map(y => <option key={y} value={y}>{y}年</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {/* 在籍証明 */}
                  <button onClick={() => issue("contract")} disabled={issuing} className="rounded-xl border p-4 text-left cursor-pointer" style={{ backgroundColor: "#2563eb08", borderColor: "#2563eb30" }}>
                    <div className="text-[20px] mb-2">📝</div>
                    <p className="text-[12px] font-medium" style={{ color: "#2563eb" }}>業務委託契約証明書</p>
                    <p className="text-[9px] mt-1" style={{ color: T.textMuted }}>在籍証明として使用。賃貸契約・保育園申請・就業証明に。</p>
                  </button>
                  {/* 報酬支払証明 */}
                  <button onClick={() => issue("payment")} disabled={issuing} className="rounded-xl border p-4 text-left cursor-pointer" style={{ backgroundColor: "#06b6d408", borderColor: "#06b6d430" }}>
                    <div className="text-[20px] mb-2">💰</div>
                    <p className="text-[12px] font-medium" style={{ color: "#06b6d4" }}>報酬支払証明書</p>
                    <p className="text-[9px] mt-1" style={{ color: T.textMuted }}>収入証明として使用。ローン審査・クレジットカード申込に。</p>
                    <p className="text-[8px] mt-2" style={{ color: T.textFaint }}>※ {certYear}年の報酬データを使用</p>
                  </button>
                  {/* 取引実績証明 */}
                  <button onClick={() => issue("transaction")} disabled={issuing} className="rounded-xl border p-4 text-left cursor-pointer" style={{ backgroundColor: "#7c3aed08", borderColor: "#7c3aed30" }}>
                    <div className="text-[20px] mb-2">📊</div>
                    <p className="text-[12px] font-medium" style={{ color: "#7c3aed" }}>取引実績証明書</p>
                    <p className="text-[9px] mt-1" style={{ color: T.textMuted }}>取引実績の証明。確定申告・融資申請・補助金申請に。</p>
                    <p className="text-[8px] mt-2" style={{ color: T.textFaint }}>※ {certYear}年の取引データを使用</p>
                  </button>
                </div>
              </div>

              {/* 注意事項 */}
              <div className="rounded-xl border p-4" style={{ backgroundColor: T.cardAlt, borderColor: T.border }}>
                <p className="text-[11px] font-medium mb-2">⚠️ 証明書発行時の注意</p>
                <div className="space-y-1">
                  {[
                    "発行した証明書には会社の代表印（実印）を押印してください",
                    "報酬支払証明書・取引実績証明書は清算済みデータを基に作成されます",
                    "証明書の有効期限は発行日から3ヶ月です",
                    "ブラウザの印刷機能（Ctrl+P）からPDFとして保存できます",
                    "本名・住所が未登録の場合は先にセラピスト管理で登録してください",
                  ].map((t, i) => (
                    <p key={i} className="text-[10px] flex gap-2" style={{ color: T.textMuted }}>
                      <span style={{ color: "#c3a782" }}>•</span>{t}
                    </p>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-xl border p-8 text-center" style={{ backgroundColor: T.card, borderColor: T.border }}>
              <p className="text-[32px] mb-3">📄</p>
              <p className="text-[14px] font-medium mb-2">セラピストを選択してください</p>
              <p className="text-[11px]" style={{ color: T.textMuted }}>左のリストから証明書を発行するセラピストを選択すると、発行できる証明書が表示されます。</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
