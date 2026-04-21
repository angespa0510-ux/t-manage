"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";
import { useTheme } from "../../lib/theme";
import { NavMenu } from "../../lib/nav-menu";
import { useStaffSession } from "../../lib/staff-session";
import { useToast } from "../../lib/toast";
import { generateContractCertificate, generatePaymentCertificate, generateTransactionCertificate } from "../../lib/certificate-pdf";
import JSZip from "jszip";
import { useConfirm } from "../../components/useConfirm";

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
  const { confirm, ConfirmModalNode } = useConfirm();
  const { activeStaff, canAccessCashDashboard } = useStaffSession();

  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [stores, setStores] = useState<Store[]>([]);

  const [dashTab, setDashTab] = useState<"summary" | "therapist_payroll" | "staff_payroll" | "withholding" | "company" | "mynumber" | "certificate">("summary");
  const [mode, setMode] = useState<"monthly" | "yearly">("monthly");
  const [selectedMonth, setSelectedMonth] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; });
  const [companyName, setCompanyName] = useState(""); const [companyAddress, setCompanyAddress] = useState(""); const [companyPhone, setCompanyPhone] = useState(""); const [invoiceNumber, setInvoiceNumber] = useState(""); const [companyStoreId, setCompanyStoreId] = useState<number>(0);
  const [corporateNumber, setCorporateNumber] = useState(""); const [fiscalMonth, setFiscalMonth] = useState(3); const [representativeName, setRepresentativeName] = useState(""); const [entityType, setEntityType] = useState("llc"); const [taxOffice, setTaxOffice] = useState(""); const [taxAccountantName, setTaxAccountantName] = useState(""); const [taxAccountantPhone, setTaxAccountantPhone] = useState(""); const [taxAccountantAddress, setTaxAccountantAddress] = useState(""); const [laborConsultantName, setLaborConsultantName] = useState(""); const [laborConsultantPhone, setLaborConsultantPhone] = useState("");
  // コーポレートサイト用
  const [companyNameEn, setCompanyNameEn] = useState("");
  const [companyEstablished, setCompanyEstablished] = useState("");
  const [companyCapital, setCompanyCapital] = useState("");
  const [companyFiscal, setCompanyFiscal] = useState("3月決算");
  const [companyEmail, setCompanyEmail] = useState("");
  const [companyBusiness, setCompanyBusiness] = useState("");
  const [companyTagline, setCompanyTagline] = useState("");
  const [companyEmployees, setCompanyEmployees] = useState("");
  const [companyMainBank, setCompanyMainBank] = useState("");
  const [companyWebsiteUrl, setCompanyWebsiteUrl] = useState("");
  const [companyMapEmbed, setCompanyMapEmbed] = useState("");
  const [representativeNameKana, setRepresentativeNameKana] = useState("");
  const [representativeTitle, setRepresentativeTitle] = useState("代表社員");
  const [representativeMessage, setRepresentativeMessage] = useState("");
  const [representativePhotoUrl, setRepresentativePhotoUrl] = useState("");
  const [representativePhotoFile, setRepresentativePhotoFile] = useState<File | null>(null);
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());

  const [smYear, smMonth] = selectedMonth.split("-").map(Number);

  const fetchData = useCallback(async () => {
    const { data: c } = await supabase.from("courses").select("*"); if (c) setCourses(c);
    const { data: s } = await supabase.from("stores").select("*"); if (s) { setStores(s); if (s[0]) { setCompanyName(s[0].company_name || ""); setCompanyAddress(s[0].company_address || ""); setCompanyPhone(s[0].company_phone || ""); setInvoiceNumber(s[0].invoice_number || ""); setCompanyStoreId(s[0].id); setCorporateNumber(s[0].corporate_number || ""); setFiscalMonth(s[0].fiscal_month || 3); setRepresentativeName(s[0].representative_name || ""); setEntityType(s[0].entity_type || "llc"); setTaxOffice(s[0].tax_office || ""); setTaxAccountantName(s[0].tax_accountant_name || ""); setTaxAccountantPhone(s[0].tax_accountant_phone || ""); setTaxAccountantAddress(s[0].tax_accountant_address || ""); setLaborConsultantName(s[0].labor_consultant_name || ""); setLaborConsultantPhone(s[0].labor_consultant_phone || ""); setCompanyNameEn(s[0].company_name_en || ""); setCompanyEstablished(s[0].company_established || ""); setCompanyCapital(s[0].company_capital || ""); setCompanyFiscal(s[0].company_fiscal || "3月決算"); setCompanyEmail(s[0].company_email || ""); setCompanyBusiness(s[0].company_business || ""); setCompanyTagline(s[0].company_tagline || ""); setCompanyEmployees(s[0].company_employees || ""); setCompanyMainBank(s[0].company_main_bank || ""); setCompanyWebsiteUrl(s[0].company_website_url || ""); setCompanyMapEmbed(s[0].company_map_embed || ""); setRepresentativeNameKana(s[0].representative_name_kana || ""); setRepresentativeTitle(s[0].representative_title || "代表社員"); setRepresentativeMessage(s[0].representative_message || ""); setRepresentativePhotoUrl(s[0].representative_photo_url || ""); } }

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

  // 権限チェック — 社長・経営責任者のみ（資金管理と同じ基準）
  if (!activeStaff) return <div className="h-screen flex items-center justify-center" style={{ backgroundColor: T.bg, color: T.text }}><p className="text-[14px]" style={{ color: T.textMuted }}>読み込み中...</p></div>;
  if (!canAccessCashDashboard) return (
    <div className="h-screen flex flex-col items-center justify-center" style={{ backgroundColor: T.bg, color: T.text }}>
      <div className="text-[48px] mb-4">🔒</div>
      <h2 className="text-[18px] font-medium mb-2">アクセス権限がありません</h2>
      <p className="text-[13px] mb-6" style={{ color: T.textMuted }}>このページは社長・経営責任者のみアクセスできます</p>
      <button onClick={() => router.push("/dashboard")} className="px-6 py-3 bg-gradient-to-r from-[#c3a782] to-[#b09672] text-white text-[12px] rounded-xl cursor-pointer">HOMEに戻る</button>
    </div>
  );

  return (
    <div className="h-screen flex flex-col" style={{ backgroundColor: T.bg, color: T.text }}>
      {ConfirmModalNode}
      {/* Header */}
      <div className="h-[56px] flex items-center justify-between px-4 flex-shrink-0 border-b" style={{ backgroundColor: T.card, borderColor: T.border }}>
        <div className="flex items-center gap-3">
          <NavMenu T={T} dark={dark} />
          <h1 className="text-[14px] font-medium">バックオフィス</h1>
          </div>
        <div className="flex items-center gap-2">
          {[{k:"summary",l:"📊 経理サマリー"},{k:"therapist_payroll",l:"📑 セラピスト支払調書"},{k:"staff_payroll",l:"📑 スタッフ支払調書"},{k:"withholding",l:"💰 源泉徴収納付"},{k:"certificate",l:"📄 証明書発行"},{k:"company",l:"🏢 会社情報"},{k:"mynumber",l:"🔒 マイナンバー"}].map(t => (
            <button key={t.k} onClick={() => setDashTab(t.k as any)} className="px-3 py-1.5 text-[10px] rounded-lg cursor-pointer" style={{ backgroundColor: dashTab === t.k ? "#c3a78222" : "transparent", color: dashTab === t.k ? "#c3a782" : T.textMuted, fontWeight: dashTab === t.k ? 700 : 400, border: `1px solid ${dashTab === t.k ? "#c3a78244" : T.border}` }}>{t.l}</button>
          ))}
        </div>
        <div className="flex items-center gap-2">
        <span className="px-2 py-0.5 rounded text-[9px] font-medium" style={{ backgroundColor: "#c4555518", color: "#c45555" }}>🔒 社長・経営責任者のみ</span>
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

            {/* 保存ボタン（税務用） */}
            <button onClick={async () => {
              if (!companyStoreId) return;
              let photoUrl = representativePhotoUrl;
              if (representativePhotoFile) {
                try {
                  const ext = representativePhotoFile.name.split('.').pop() || 'jpg';
                  const fileName = `representative_${Date.now()}.${ext}`;
                  const { error: upErr } = await supabase.storage.from("staff-docs").upload(fileName, representativePhotoFile, { contentType: representativePhotoFile.type, upsert: true });
                  if (!upErr) {
                    const { data } = supabase.storage.from("staff-docs").getPublicUrl(fileName);
                    photoUrl = data.publicUrl;
                  }
                } catch (e) { console.error("代表者写真アップロードエラー:", e); }
              }
              await supabase.from("stores").update({
                company_name: companyName.trim(), company_address: companyAddress.trim(), company_phone: companyPhone.trim(), invoice_number: invoiceNumber.trim(), corporate_number: corporateNumber.trim(), fiscal_month: fiscalMonth, representative_name: representativeName.trim(), entity_type: entityType, tax_office: taxOffice.trim(), tax_accountant_name: taxAccountantName.trim(), tax_accountant_phone: taxAccountantPhone.trim(), tax_accountant_address: taxAccountantAddress.trim(), labor_consultant_name: laborConsultantName.trim(), labor_consultant_phone: laborConsultantPhone.trim(),
                // コーポレートサイト用
                company_name_en: companyNameEn.trim(), company_established: companyEstablished.trim(), company_capital: companyCapital.trim(), company_fiscal: companyFiscal.trim(), company_email: companyEmail.trim(), company_business: companyBusiness.trim(), company_tagline: companyTagline.trim(), company_employees: companyEmployees.trim(), company_main_bank: companyMainBank.trim(), company_website_url: companyWebsiteUrl.trim(), company_map_embed: companyMapEmbed.trim(), representative_name_kana: representativeNameKana.trim(), representative_title: representativeTitle.trim(), representative_message: representativeMessage.trim(), representative_photo_url: photoUrl,
              }).eq("id", companyStoreId);
              toast.show("会社情報を保存しました", "success");
              setRepresentativePhotoFile(null);
              fetchData();
            }} className="w-full py-3 bg-gradient-to-r from-[#c3a782] to-[#b09672] text-white text-[12px] rounded-xl cursor-pointer font-medium">💾 保存する</button>

            {/* ══════════ コーポレートサイト用セクション ══════════ */}
            <div className="rounded-2xl border p-5" style={{ backgroundColor: "#2563eb11", borderColor: "#2563eb55" }}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[16px]">🌐</span>
                <h3 className="text-[13px] font-medium" style={{ color: "#60a5fa" }}>コーポレートサイト用設定</h3>
              </div>
              <p className="text-[10px] leading-relaxed" style={{ color: T.textSub }}>
                以下は <a href="/corporate" target="_blank" className="underline" style={{ color: "#60a5fa" }}>コーポレートサイト（/corporate）</a> に反映される情報です。代表挨拶・会社概要・地図などがここから動的表示されます。
              </p>
            </div>

            {/* コーポレート基本情報 */}
            <div className="rounded-2xl border p-6 space-y-4" style={{ backgroundColor: T.card, borderColor: T.border }}>
              <h2 className="text-[15px] font-medium">🌐 コーポレート基本情報</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>会社名（英語）</label>
                  <input type="text" value={companyNameEn} onChange={e => setCompanyNameEn(e.target.value)} placeholder="Terrace Life LLC" className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={{ backgroundColor: T.cardAlt, border: `1px solid ${T.border}`, color: T.text }}/>
                </div>
                <div>
                  <label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>設立</label>
                  <input type="text" value={companyEstablished} onChange={e => setCompanyEstablished(e.target.value)} placeholder="2020年4月" className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={{ backgroundColor: T.cardAlt, border: `1px solid ${T.border}`, color: T.text }}/>
                </div>
                <div>
                  <label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>資本金</label>
                  <input type="text" value={companyCapital} onChange={e => setCompanyCapital(e.target.value)} placeholder="100万円" className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={{ backgroundColor: T.cardAlt, border: `1px solid ${T.border}`, color: T.text }}/>
                </div>
                <div>
                  <label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>決算期（表示用）</label>
                  <input type="text" value={companyFiscal} onChange={e => setCompanyFiscal(e.target.value)} placeholder="3月決算" className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={{ backgroundColor: T.cardAlt, border: `1px solid ${T.border}`, color: T.text }}/>
                </div>
                <div>
                  <label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>従業員数</label>
                  <input type="text" value={companyEmployees} onChange={e => setCompanyEmployees(e.target.value)} placeholder="5名（2025年4月時点）" className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={{ backgroundColor: T.cardAlt, border: `1px solid ${T.border}`, color: T.text }}/>
                </div>
                <div>
                  <label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>メールアドレス</label>
                  <input type="email" value={companyEmail} onChange={e => setCompanyEmail(e.target.value)} placeholder="info@terrace-life.co.jp" className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={{ backgroundColor: T.cardAlt, border: `1px solid ${T.border}`, color: T.text }}/>
                </div>
              </div>
              <div>
                <label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>Webサイト</label>
                <input type="url" value={companyWebsiteUrl} onChange={e => setCompanyWebsiteUrl(e.target.value)} placeholder="https://ange-spa.com" className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={{ backgroundColor: T.cardAlt, border: `1px solid ${T.border}`, color: T.text }}/>
              </div>
              <div>
                <label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>取引銀行</label>
                <input type="text" value={companyMainBank} onChange={e => setCompanyMainBank(e.target.value)} placeholder="◯◯銀行 安城支店" className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={{ backgroundColor: T.cardAlt, border: `1px solid ${T.border}`, color: T.text }}/>
              </div>
              <div>
                <label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>事業内容</label>
                <textarea value={companyBusiness} onChange={e => setCompanyBusiness(e.target.value)} rows={2} placeholder="AIソリューション開発、Webデザイン・システム開発、DX推進支援" className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={{ backgroundColor: T.cardAlt, border: `1px solid ${T.border}`, color: T.text }}/>
              </div>
              <div>
                <label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>キャッチコピー</label>
                <input type="text" value={companyTagline} onChange={e => setCompanyTagline(e.target.value)} placeholder="テクノロジーで、ビジネスの未来をデザインする。" className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={{ backgroundColor: T.cardAlt, border: `1px solid ${T.border}`, color: T.text }}/>
              </div>
            </div>

            {/* 代表者情報 */}
            <div className="rounded-2xl border p-6 space-y-4" style={{ backgroundColor: T.card, borderColor: T.border }}>
              <h2 className="text-[15px] font-medium">👔 代表者情報（HP用）</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* 写真 */}
                <div className="md:col-span-1">
                  <label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>代表者写真</label>
                  <div className="flex flex-col items-center gap-3 p-4 rounded-xl" style={{ backgroundColor: T.cardAlt, border: `1px dashed ${T.border}` }}>
                    {(representativePhotoFile || representativePhotoUrl) ? (
                      <img src={representativePhotoFile ? URL.createObjectURL(representativePhotoFile) : representativePhotoUrl} alt="代表者" className="w-32 h-32 rounded-full object-cover" style={{ border: "3px solid #c3a782" }}/>
                    ) : (
                      <div className="w-32 h-32 rounded-full flex items-center justify-center text-[40px]" style={{ backgroundColor: T.card, border: `2px dashed ${T.border}`, color: T.textFaint }}>👤</div>
                    )}
                    <input type="file" accept="image/*" onChange={e => setRepresentativePhotoFile(e.target.files?.[0] || null)} className="text-[10px]" style={{ color: T.textSub }}/>
                    <p className="text-[9px] text-center" style={{ color: T.textFaint }}>正方形推奨（800×800px）<br/>保存時にアップロード</p>
                  </div>
                </div>
                {/* 代表者情報 */}
                <div className="md:col-span-2 space-y-3">
                  <div>
                    <label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>役職</label>
                    <input type="text" value={representativeTitle} onChange={e => setRepresentativeTitle(e.target.value)} placeholder="代表社員" className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={{ backgroundColor: T.cardAlt, border: `1px solid ${T.border}`, color: T.text }}/>
                  </div>
                  <div>
                    <label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>氏名カナ</label>
                    <input type="text" value={representativeNameKana} onChange={e => setRepresentativeNameKana(e.target.value)} placeholder="やまだ たろう" className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={{ backgroundColor: T.cardAlt, border: `1px solid ${T.border}`, color: T.text }}/>
                  </div>
                  <p className="text-[10px]" style={{ color: T.textFaint }}>※ 氏名は上の「基本情報」の代表者名が使用されます</p>
                </div>
              </div>
              <div>
                <label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>代表挨拶文</label>
                <textarea value={representativeMessage} onChange={e => setRepresentativeMessage(e.target.value)} rows={8} placeholder="テラスライフは「現場で役立つテクノロジー」を信条に..." className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={{ backgroundColor: T.cardAlt, border: `1px solid ${T.border}`, color: T.text }}/>
                <p className="text-[9px] mt-1" style={{ color: T.textFaint }}>改行も反映されます。200〜400字程度が適切です。</p>
              </div>
            </div>

            {/* Googleマップ */}
            <div className="rounded-2xl border p-6 space-y-4" style={{ backgroundColor: T.card, borderColor: T.border }}>
              <h2 className="text-[15px] font-medium">📍 Googleマップ埋込</h2>
              <div>
                <label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>Googleマップ埋込URL</label>
                <textarea value={companyMapEmbed} onChange={e => setCompanyMapEmbed(e.target.value)} rows={3} placeholder="https://www.google.com/maps/embed?pb=..." className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={{ backgroundColor: T.cardAlt, border: `1px solid ${T.border}`, color: T.text }}/>
                <div className="mt-2 p-3 rounded-xl text-[10px] leading-relaxed" style={{ backgroundColor: T.cardAlt, color: T.textSub }}>
                  <strong>埋込URL取得方法:</strong><br/>
                  1. <a href="https://www.google.com/maps" target="_blank" className="underline" style={{ color: "#c3a782" }}>Googleマップ</a>で所在地を検索<br/>
                  2. 「共有」→「地図を埋め込む」→「HTMLをコピー」<br/>
                  3. コピーしたHTMLの <code>src=&quot;...&quot;</code> の中身（https://〜 で始まる部分）だけを貼り付け
                </div>
              </div>
              {companyMapEmbed && (
                <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${T.border}` }}>
                  <div style={{ position: "relative", paddingBottom: "50%", height: 0 }}>
                    <iframe src={companyMapEmbed} style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: 0 }} loading="lazy" title="プレビュー"/>
                  </div>
                </div>
              )}
            </div>

            {/* もう一度保存ボタン（コーポレート設定直下） */}
            <button onClick={async () => {
              if (!companyStoreId) return;
              let photoUrl = representativePhotoUrl;
              if (representativePhotoFile) {
                try {
                  const ext = representativePhotoFile.name.split('.').pop() || 'jpg';
                  const fileName = `representative_${Date.now()}.${ext}`;
                  const { error: upErr } = await supabase.storage.from("staff-docs").upload(fileName, representativePhotoFile, { contentType: representativePhotoFile.type, upsert: true });
                  if (!upErr) {
                    const { data } = supabase.storage.from("staff-docs").getPublicUrl(fileName);
                    photoUrl = data.publicUrl;
                  }
                } catch (e) { console.error("代表者写真アップロードエラー:", e); }
              }
              await supabase.from("stores").update({
                company_name: companyName.trim(), company_address: companyAddress.trim(), company_phone: companyPhone.trim(), invoice_number: invoiceNumber.trim(), corporate_number: corporateNumber.trim(), fiscal_month: fiscalMonth, representative_name: representativeName.trim(), entity_type: entityType, tax_office: taxOffice.trim(), tax_accountant_name: taxAccountantName.trim(), tax_accountant_phone: taxAccountantPhone.trim(), tax_accountant_address: taxAccountantAddress.trim(), labor_consultant_name: laborConsultantName.trim(), labor_consultant_phone: laborConsultantPhone.trim(),
                company_name_en: companyNameEn.trim(), company_established: companyEstablished.trim(), company_capital: companyCapital.trim(), company_fiscal: companyFiscal.trim(), company_email: companyEmail.trim(), company_business: companyBusiness.trim(), company_tagline: companyTagline.trim(), company_employees: companyEmployees.trim(), company_main_bank: companyMainBank.trim(), company_website_url: companyWebsiteUrl.trim(), company_map_embed: companyMapEmbed.trim(), representative_name_kana: representativeNameKana.trim(), representative_title: representativeTitle.trim(), representative_message: representativeMessage.trim(), representative_photo_url: photoUrl,
              }).eq("id", companyStoreId);
              toast.show("会社情報を保存しました", "success");
              setRepresentativePhotoFile(null);
              fetchData();
            }} className="w-full py-3 bg-gradient-to-r from-[#2563eb] to-[#06b6d4] text-white text-[12px] rounded-xl cursor-pointer font-medium">🌐 コーポレート情報を含めて保存</button>

            {/* 利用先の説明 */}
            <div className="rounded-2xl border p-5" style={{ backgroundColor: T.card, borderColor: T.border }}>
              <h3 className="text-[13px] font-medium mb-3" style={{ color: T.text }}>📋 この情報が使われる場所</h3>
              <div className="space-y-2 text-[11px]" style={{ color: T.textSub }}>
                <div className="flex items-start gap-2"><span style={{ color: "#c3a782" }}>📑</span><span>セラピスト・スタッフの<strong>支払調書PDF</strong>の支払者欄</span></div>
                <div className="flex items-start gap-2"><span style={{ color: "#c3a782" }}>💰</span><span><strong>源泉徴収納付集計表</strong>の事業者情報</span></div>
                <div className="flex items-start gap-2"><span style={{ color: "#c3a782" }}>🧾</span><span>セラピストへの<strong>日次清算の支払通知書</strong></span></div>
                <div className="flex items-start gap-2"><span style={{ color: "#c3a782" }}>📆</span><span><strong>税理士ポータルの年間スケジュール</strong>の決算月・顧問連絡先</span></div>
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
              {["名前", "日数", "報酬（税込）", "インボイス控除", "源泉徴収", "備品・リネン代", "交通費(実費)", "差引支払額", ""].map(h => <th key={h} className="py-2.5 px-3 text-left font-normal text-[10px]" style={{ color: T.textMuted }}>{h}</th>)}
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


function MyNumberManager({ T }: { T: any }) {
  const { activeStaff } = useStaffSession();
  const toast = useToast();
  const { confirm, ConfirmModalNode } = useConfirm();
  const staffName = activeStaff?.name || "不明";
  const [therapists, setTherapists] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [saving, setSaving] = useState<number | null>(null);
  const [bulkSaving, setBulkSaving] = useState<string>("");
  const [saveMethod, setSaveMethod] = useState<"zip" | "folder">("zip");
  const [showLogs, setShowLogs] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);
  const folderHandleRef = useRef<any>(null);

  const fetchTherapists = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("therapists").select("id, name, real_name, entry_date, mynumber, mynumber_photo_url, mynumber_photo_url_back, status, mynumber_downloaded_at, mynumber_downloaded_by").order("sort_order");
    if (data) setTherapists(data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchTherapists(); }, [fetchTherapists]);

  const submitted = therapists.filter(t => t.mynumber || t.mynumber_photo_url);
  const notSubmitted = therapists.filter(t => !t.mynumber && !t.mynumber_photo_url && t.status === "active");
  const daysSince = (iso: string | null) => iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 86400000) : Infinity;
  const needsDL = submitted.filter(t => !t.mynumber_downloaded_at || daysSince(t.mynumber_downloaded_at) >= 30);

  // ====== ログ記録 ======
  const logAction = async (params: { action: string; therapistId?: number | null; targetNames?: string; targetCount?: number; method?: string; note?: string }) => {
    await supabase.from("mynumber_access_logs").insert({
      action: params.action,
      therapist_id: params.therapistId ?? null,
      target_names: params.targetNames || "",
      target_count: params.targetCount ?? 1,
      save_method: params.method || "",
      staff_name: staffName,
      note: params.note || "",
    });
  };

  // ====== ヘルパー ======
  const today = () => new Date().toISOString().split("T")[0].replace(/-/g, "");
  const escapeHTML = (s: string) => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] || c));
  const safeName = (s: string) => s.replace(/[\\/:*?"<>|]/g, "_").replace(/\s+/g, "_");

  const fetchImageBlob = async (url: string): Promise<{ blob: Blob; ext: string } | null> => {
    if (!url) return null;
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) return null;
      const blob = await res.blob();
      let ext = "jpg";
      const u = url.split("?")[0].toLowerCase();
      const m = u.match(/\.(jpg|jpeg|png|gif|webp|heic)$/);
      if (m) ext = m[1] === "jpeg" ? "jpg" : m[1];
      else if (blob.type === "image/png") ext = "png";
      else if (blob.type === "image/webp") ext = "webp";
      return { blob, ext };
    } catch {
      return null;
    }
  };

  const buildLedgerHTML = (t: any, frontFile: string | null, backFile: string | null): string => {
    return `<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8"><title>マイナンバー管理台帳_${escapeHTML(t.real_name || t.name)}</title>
<style>body{font-family:'Hiragino Sans','Yu Gothic','Meiryo',sans-serif;max-width:720px;margin:40px auto;padding:30px;color:#333}h1{text-align:center;font-size:20px;border-bottom:3px double #333;padding-bottom:10px;margin-bottom:25px}table{width:100%;border-collapse:collapse;margin:15px 0}td,th{border:1px solid #ccc;padding:10px 14px;font-size:13px}th{background:#f5f0e8;text-align:left;width:35%}.photos{display:flex;gap:20px;margin:25px 0}.photo-box{flex:1;text-align:center}.photo-box img{max-width:100%;max-height:400px;border:1px solid #ddd;border-radius:8px}.photo-label{font-size:11px;color:#888;margin-bottom:8px}.meta{font-size:10px;color:#888;margin-top:20px;padding-top:15px;border-top:1px solid #eee}.note{font-size:10px;color:#c45555;margin-top:15px;padding:12px;background:#fff5f5;border:1px solid #fecaca;border-radius:8px;line-height:1.7}@media print{body{margin:0;padding:15px}}</style>
</head><body>
<h1>マイナンバー管理台帳</h1>
<table>
<tr><th>源氏名</th><td>${escapeHTML(t.name)}</td></tr>
<tr><th>本名</th><td>${escapeHTML(t.real_name || "未登録")}</td></tr>
<tr><th>入店日</th><td>${t.entry_date || "未登録"}</td></tr>
<tr><th>個人番号</th><td style="font-family:monospace;font-size:16px;letter-spacing:3px">${escapeHTML(t.mynumber || "未登録（写真のみ）")}</td></tr>
</table>
<div class="photos">
${frontFile ? `<div class="photo-box"><p class="photo-label">表面</p><img src="${frontFile}" /></div>` : '<div class="photo-box"><p class="photo-label">表面</p><p style="color:#c45555;padding:60px">未アップロード</p></div>'}
${backFile ? `<div class="photo-box"><p class="photo-label">裏面</p><img src="${backFile}" /></div>` : '<div class="photo-box"><p class="photo-label">裏面</p><p style="color:#c45555;padding:60px">未アップロード</p></div>'}
</div>
<div class="meta">出力日時: ${new Date().toLocaleString("ja-JP")} ／ 出力担当: ${escapeHTML(staffName)}</div>
<div class="note">⚠️ この書類は番号法（行政手続における特定の個人を識別するための番号の利用等に関する法律）に基づき厳重に管理してください。目的外の利用、第三者への開示は固く禁じられています。不要になった場合は速やかに物理的破棄または完全消去してください。</div>
</body></html>`;
  };

  const buildFilesForTherapist = async (t: any): Promise<{ name: string; blob: Blob }[]> => {
    const files: { name: string; blob: Blob }[] = [];
    let frontName: string | null = null;
    let backName: string | null = null;
    if (t.mynumber_photo_url) {
      const f = await fetchImageBlob(t.mynumber_photo_url);
      if (f) { frontName = `表面.${f.ext}`; files.push({ name: frontName, blob: f.blob }); }
    }
    if (t.mynumber_photo_url_back) {
      const b = await fetchImageBlob(t.mynumber_photo_url_back);
      if (b) { backName = `裏面.${b.ext}`; files.push({ name: backName, blob: b.blob }); }
    }
    const html = buildLedgerHTML(t, frontName, backName);
    files.push({ name: "管理台帳.html", blob: new Blob([html], { type: "text/html;charset=utf-8" }) });
    return files;
  };

  const triggerDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
  };

  // ====== Directory Picker ======
  const pickOrReuseDirectory = async (): Promise<any> => {
    // @ts-ignore
    if (typeof window.showDirectoryPicker !== "function") {
      throw new Error("このブラウザはフォルダ保存に対応していません。「ZIP」方式を選んでください（Chrome/Edgeの最新版が必要です）");
    }
    if (folderHandleRef.current) {
      try {
        const perm = await folderHandleRef.current.queryPermission?.({ mode: "readwrite" });
        if (perm === "granted") return folderHandleRef.current;
        const req = await folderHandleRef.current.requestPermission?.({ mode: "readwrite" });
        if (req === "granted") return folderHandleRef.current;
      } catch { /* fallthrough */ }
    }
    // @ts-ignore
    const h = await window.showDirectoryPicker({ mode: "readwrite" });
    folderHandleRef.current = h;
    return h;
  };

  const writeFilesToDir = async (dirHandle: any, files: { name: string; blob: Blob }[]) => {
    for (const f of files) {
      const fh = await dirHandle.getFileHandle(f.name, { create: true });
      const w = await fh.createWritable();
      await w.write(f.blob);
      await w.close();
    }
  };

  // ====== 個別保存 ======
  const downloadOne = async (t: any) => {
    if (saving || bulkSaving) return;
    setSaving(t.id);
    try {
      const files = await buildFilesForTherapist(t);
      if (files.length <= 1) { toast.show("ダウンロードできる画像がありません", "error"); setSaving(null); return; }
      const baseName = `マイナンバー_${safeName(t.real_name || t.name)}_${today()}`;

      if (saveMethod === "folder") {
        const parent = await pickOrReuseDirectory();
        const dir = await parent.getDirectoryHandle(baseName, { create: true });
        await writeFilesToDir(dir, files);
      } else {
        const zip = new JSZip();
        const folder = zip.folder(baseName)!;
        for (const f of files) folder.file(f.name, f.blob);
        const zipBlob = await zip.generateAsync({ type: "blob" });
        triggerDownload(zipBlob, `${baseName}.zip`);
      }

      const now = new Date().toISOString();
      await supabase.from("therapists").update({ mynumber_downloaded_at: now, mynumber_downloaded_by: staffName }).eq("id", t.id);
      await logAction({ action: "download", therapistId: t.id, targetNames: t.real_name || t.name, method: saveMethod });
      toast.show(`${t.name} のマイナンバーを保存しました`, "success");
      fetchTherapists();
    } catch (err: any) {
      if (err?.name === "AbortError") return;
      console.error(err);
      toast.show(`保存に失敗: ${err?.message || err}`, "error");
    } finally {
      setSaving(null);
    }
  };

  // ====== 一括保存 ======
  const bulkDownload = async (targets: any[], label: string) => {
    if (saving || bulkSaving || targets.length === 0) return;
    const ok = await confirm({
      title: `${targets.length}名分のマイナンバーを保存しますか？`,
      message: `保存先: ${saveMethod === "folder" ? "指定フォルダ" : "ZIPファイル"}\n対象: ${targets.map(t => t.name).slice(0, 5).join("、")}${targets.length > 5 ? ` ほか${targets.length - 5}名` : ""}\n\n⚠️ 番号法遵守のため、保存後は暗号化USB等の安全な場所で管理してください。`,
      variant: "warning",
      confirmLabel: "保存する",
      icon: "🔢",
    });
    if (!ok) return;
    setBulkSaving(label);
    try {
      const rootName = `マイナンバー_${label}_${today()}_${safeName(staffName)}`;
      const csvHeader = "源氏名,本名,入店日,個人番号,表面写真,裏面写真,出力日時,出力担当\n";
      const csvRows = targets.map(t => `"${t.name}","${t.real_name || ""}","${t.entry_date || ""}","${t.mynumber ? "登録済" : "未登録"}","${t.mynumber_photo_url ? "あり" : "なし"}","${t.mynumber_photo_url_back ? "あり" : "なし"}","${new Date().toLocaleString("ja-JP")}","${staffName}"`).join("\n");
      const csv = "\uFEFF" + csvHeader + csvRows;

      if (saveMethod === "folder") {
        const parent = await pickOrReuseDirectory();
        const rootDir = await parent.getDirectoryHandle(rootName, { create: true });
        let idx = 0;
        for (const t of targets) {
          idx++;
          const sub = `${String(idx).padStart(2, "0")}_${safeName(t.real_name || t.name)}_${t.id}`;
          const subDir = await rootDir.getDirectoryHandle(sub, { create: true });
          const files = await buildFilesForTherapist(t);
          await writeFilesToDir(subDir, files);
        }
        const csvHandle = await rootDir.getFileHandle("_DL履歴.csv", { create: true });
        const w = await csvHandle.createWritable();
        await w.write(new Blob([csv], { type: "text/csv;charset=utf-8" }));
        await w.close();
      } else {
        const zip = new JSZip();
        const root = zip.folder(rootName)!;
        let idx = 0;
        for (const t of targets) {
          idx++;
          const sub = `${String(idx).padStart(2, "0")}_${safeName(t.real_name || t.name)}_${t.id}`;
          const subFolder = root.folder(sub)!;
          const files = await buildFilesForTherapist(t);
          for (const f of files) subFolder.file(f.name, f.blob);
        }
        root.file("_DL履歴.csv", csv);
        const blob = await zip.generateAsync({ type: "blob" });
        triggerDownload(blob, `${rootName}.zip`);
      }

      const now = new Date().toISOString();
      await supabase.from("therapists").update({ mynumber_downloaded_at: now, mynumber_downloaded_by: staffName }).in("id", targets.map(t => t.id));
      await logAction({
        action: "bulk_download",
        targetNames: targets.map(t => t.real_name || t.name).join("、"),
        targetCount: targets.length,
        method: saveMethod,
        note: label,
      });
      toast.show(`${targets.length}名分を一括保存しました`, "success");
      fetchTherapists();
    } catch (err: any) {
      if (err?.name === "AbortError") return;
      console.error(err);
      toast.show(`一括保存に失敗: ${err?.message || err}`, "error");
    } finally {
      setBulkSaving("");
    }
  };

  // ====== 既存: PDF表示（印刷プレビュー） ======
  const openPDF = async (t: any) => {
    const w = window.open("", "_blank"); if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>マイナンバー_${escapeHTML(t.real_name || t.name)}</title>
<style>body{font-family:'Hiragino Sans','Yu Gothic','Meiryo',sans-serif;max-width:700px;margin:40px auto;padding:30px;color:#333}h1{text-align:center;font-size:18px;border-bottom:2px solid #333;padding-bottom:8px;margin-bottom:20px}table{width:100%;border-collapse:collapse;margin:15px 0}td,th{border:1px solid #ccc;padding:10px 14px;font-size:13px}th{background:#f5f0e8;text-align:left;width:35%}.photos{display:flex;gap:20px;margin:20px 0}.photo-box{flex:1;text-align:center}.photo-box img{max-width:100%;max-height:300px;border:1px solid #ddd;border-radius:8px}.photo-label{font-size:11px;color:#888;margin-bottom:5px}.note{font-size:10px;color:#c45555;margin-top:20px;padding:10px;background:#fff5f5;border:1px solid #fecaca;border-radius:8px}@media print{body{margin:0;padding:15px}.note{break-inside:avoid}}</style></head><body>
<h1>マイナンバー管理台帳</h1>
<table>
<tr><th>源氏名</th><td>${escapeHTML(t.name)}</td></tr>
<tr><th>本名</th><td>${escapeHTML(t.real_name || "未登録")}</td></tr>
<tr><th>入店日</th><td>${t.entry_date || "未登録"}</td></tr>
<tr><th>個人番号</th><td style="font-family:monospace;font-size:16px;letter-spacing:2px">${escapeHTML(t.mynumber || "未登録")}</td></tr>
</table>
<div class="photos">
${t.mynumber_photo_url ? `<div class="photo-box"><p class="photo-label">表面</p><img src="${t.mynumber_photo_url}" /></div>` : '<div class="photo-box"><p class="photo-label">表面</p><p style="color:#c45555;padding:40px">未アップロード</p></div>'}
${t.mynumber_photo_url_back ? `<div class="photo-box"><p class="photo-label">裏面</p><img src="${t.mynumber_photo_url_back}" /></div>` : '<div class="photo-box"><p class="photo-label">裏面</p><p style="color:#c45555;padding:40px">未アップロード</p></div>'}
</div>
<div class="note">⚠️ この書類はマイナンバー法に基づき厳重に管理してください。目的外利用は禁止されています。不要になった場合は速やかに破棄してください。</div>
</body></html>`);
    w.document.close();
    await logAction({ action: "view", therapistId: t.id, targetNames: t.real_name || t.name });
  };

  // ====== 既存: クラウドから削除 ======
  const deleteFromCloud = async (t: any) => {
    const ok = await confirm({
      title: `${t.name} のマイナンバーデータをクラウドから削除しますか？`,
      message: "削除されるもの:\n• 個人番号（数字）\n• カード写真（表面・裏面）\n\n⚠️ 事前にローカルに保存しておくことを強く推奨します。",
      variant: "danger",
      confirmLabel: "クラウドから削除",
      icon: "🗑️",
    });
    if (!ok) return;
    setDeleting(t.id);
    const updates: any = { mynumber: "", mynumber_photo_url: "", mynumber_photo_url_back: "" };
    try {
      await supabase.storage.from("therapist-photos").remove([`therapist_mynumber_${t.id}.jpg`, `therapist_mynumber_${t.id}.png`, `therapist_mynumber_${t.id}.jpeg`, `therapist_mynumber_back_${t.id}.jpg`, `therapist_mynumber_back_${t.id}.png`, `therapist_mynumber_back_${t.id}.jpeg`]);
    } catch { /* ファイルが存在しない場合は無視 */ }
    await supabase.from("therapists").update(updates).eq("id", t.id);
    await logAction({ action: "delete", therapistId: t.id, targetNames: t.real_name || t.name });
    setTherapists(prev => prev.map(p => p.id === t.id ? { ...p, ...updates } : p));
    setDeleting(null);
    toast.show(`${t.name} のマイナンバーをクラウドから削除しました`, "success");
  };

  // ====== ログ閲覧 ======
  const loadLogs = async () => {
    const { data } = await supabase.from("mynumber_access_logs").select("*").order("created_at", { ascending: false }).limit(500);
    if (data) setLogs(data);
    setShowLogs(true);
  };
  const actionLabel: Record<string, string> = { download: "📥 個別保存", bulk_download: "📦 一括保存", view: "👁 表示", delete: "🗑 クラウド削除" };

  return (
    <div className="max-w-[960px] mx-auto">
      {ConfirmModalNode}
      {/* 注意事項 */}
      <div className="rounded-xl p-4 mb-4" style={{ backgroundColor: "#c4555512", border: "1px solid #c4555533" }}>
        <p className="text-[11px] font-medium" style={{ color: "#c45555" }}>🔒 マイナンバー管理について（番号法遵守）</p>
        <p className="text-[10px] mt-1" style={{ color: T.textSub }}>マイナンバーは番号法で厳格な管理が義務付けられています。<strong>必ずローカル保存</strong>して安全な場所で保管し、<strong>クラウドからは速やかに削除</strong>してください。全ての保存・閲覧・削除操作は自動的に記録されます。</p>
      </div>

      {/* サマリーカード */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        <div className="rounded-2xl border p-4 text-center" style={{ backgroundColor: T.card, borderColor: T.border }}>
          <p className="text-[10px] mb-1" style={{ color: T.textMuted }}>提出済</p>
          <p className="text-[22px] font-light" style={{ color: "#22c55e" }}>{submitted.length}</p>
        </div>
        <div className="rounded-2xl border p-4 text-center" style={{ backgroundColor: T.card, borderColor: T.border }}>
          <p className="text-[10px] mb-1" style={{ color: T.textMuted }}>未提出</p>
          <p className="text-[22px] font-light" style={{ color: notSubmitted.length > 0 ? "#f59e0b" : T.textFaint }}>{notSubmitted.length}</p>
        </div>
        <div className="rounded-2xl border p-4 text-center" style={{ backgroundColor: T.card, borderColor: T.border }}>
          <p className="text-[10px] mb-1" style={{ color: T.textMuted }}>要DL（未DL/30日超）</p>
          <p className="text-[22px] font-light" style={{ color: needsDL.length > 0 ? "#c45555" : "#22c55e" }}>{needsDL.length}</p>
        </div>
        <div className="rounded-2xl border p-4 text-center" style={{ backgroundColor: T.card, borderColor: T.border }}>
          <p className="text-[10px] mb-1" style={{ color: T.textMuted }}>稼働中セラピスト</p>
          <p className="text-[22px] font-light" style={{ color: T.text }}>{therapists.filter(t => t.status === "active").length}</p>
        </div>
      </div>

      {/* 保存方式選択 + ログボタン */}
      <div className="rounded-2xl border p-4 mb-5" style={{ backgroundColor: T.card, borderColor: T.border }}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-medium" style={{ color: T.textSub }}>💾 保存方式:</span>
            <label className="flex items-center gap-1.5 cursor-pointer text-[11px]" style={{ color: saveMethod === "zip" ? "#c3a782" : T.textMuted }}>
              <input type="radio" name="saveMethod" value="zip" checked={saveMethod === "zip"} onChange={() => setSaveMethod("zip")} className="cursor-pointer accent-[#c3a782]" />
              <span className="font-medium">📦 ZIPで保存</span>
              <span className="text-[9px]" style={{ color: T.textFaint }}>（ダウンロードフォルダに保存）</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer text-[11px]" style={{ color: saveMethod === "folder" ? "#c3a782" : T.textMuted }}>
              <input type="radio" name="saveMethod" value="folder" checked={saveMethod === "folder"} onChange={() => setSaveMethod("folder")} className="cursor-pointer accent-[#c3a782]" />
              <span className="font-medium">📁 フォルダ指定</span>
              <span className="text-[9px]" style={{ color: T.textFaint }}>（保存先フォルダを毎回選択）</span>
            </label>
          </div>
          <button onClick={loadLogs} className="px-3 py-1.5 text-[10px] rounded-lg cursor-pointer" style={{ backgroundColor: "#85a8c418", color: "#85a8c4", border: "1px solid #85a8c433" }}>📋 操作履歴を見る</button>
        </div>
        {saveMethod === "folder" && (
          <p className="text-[9px] mt-2 px-2" style={{ color: T.textFaint }}>※ Chrome / Edge の最新版でのみ対応。初回のみ保存先を選択、以降は同じフォルダに書き込みます。</p>
        )}
      </div>

      {/* 一括保存ボタン */}
      {submitted.length > 0 && (
        <div className="grid grid-cols-2 gap-3 mb-5">
          <button disabled={!!bulkSaving || !!saving || needsDL.length === 0} onClick={() => bulkDownload(needsDL, "未DL")} className="py-3 rounded-xl text-[11px] cursor-pointer font-medium text-white disabled:opacity-40" style={{ backgroundColor: "#c45555" }}>
            {bulkSaving === "未DL" ? "保存中..." : `📦 未DL・30日超を一括保存（${needsDL.length}名）`}
          </button>
          <button disabled={!!bulkSaving || !!saving} onClick={() => bulkDownload(submitted, "全員")} className="py-3 rounded-xl text-[11px] cursor-pointer font-medium text-white disabled:opacity-40" style={{ backgroundColor: "#c3a782" }}>
            {bulkSaving === "全員" ? "保存中..." : `📦 提出済み全員を一括保存（${submitted.length}名）`}
          </button>
        </div>
      )}

      {loading ? <p className="text-center py-12 text-[12px]" style={{ color: T.textFaint }}>読み込み中...</p> : (<>
        {/* 提出済み */}
        {submitted.length > 0 && (
          <div className="rounded-2xl border overflow-hidden mb-6" style={{ backgroundColor: T.card, borderColor: T.border }}>
            <div className="px-5 py-3" style={{ borderBottom: `1px solid ${T.border}` }}>
              <h2 className="text-[13px] font-medium">✅ 提出済み（{submitted.length}名）</h2>
            </div>
            {submitted.map(t => {
              const d = daysSince(t.mynumber_downloaded_at);
              const isOld = !t.mynumber_downloaded_at || d >= 30;
              return (
                <div key={t.id} className="flex items-center justify-between px-5 py-3 gap-3 flex-wrap" style={{ borderBottom: `1px solid ${T.border}` }}>
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-[12px] font-medium">{t.name}</span>
                    {t.real_name && <span className="text-[10px]" style={{ color: T.textMuted }}>（{t.real_name}）</span>}
                    <div className="flex gap-1">
                      {t.mynumber && <span className="text-[8px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "#22c55e18", color: "#22c55e" }}>番号✓</span>}
                      {t.mynumber_photo_url && <span className="text-[8px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "#85a8c418", color: "#85a8c4" }}>表面✓</span>}
                      {t.mynumber_photo_url_back && <span className="text-[8px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "#85a8c418", color: "#85a8c4" }}>裏面✓</span>}
                    </div>
                    {t.mynumber_downloaded_at ? (
                      <span className="text-[9px]" style={{ color: isOld ? "#c45555" : T.textMuted }}>
                        📥 最終DL: {new Date(t.mynumber_downloaded_at).toLocaleDateString("ja-JP")}（{t.mynumber_downloaded_by || "不明"}）{isOld && ` ・${d}日前`}
                      </span>
                    ) : (
                      <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "#c4555518", color: "#c45555" }}>🆕 未DL</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => openPDF(t)} className="px-3 py-1.5 text-[9px] rounded-lg cursor-pointer" style={{ backgroundColor: "#85a8c418", color: "#85a8c4", border: "1px solid #85a8c433" }}>👁 表示</button>
                    <button onClick={() => downloadOne(t)} disabled={saving === t.id || !!bulkSaving} className="px-3 py-1.5 text-[9px] rounded-lg cursor-pointer disabled:opacity-40" style={{ backgroundColor: "#c3a78218", color: "#c3a782", border: "1px solid #c3a78233" }}>{saving === t.id ? "保存中..." : "📥 ローカル保存"}</button>
                    <button onClick={() => deleteFromCloud(t)} disabled={deleting === t.id} className="px-3 py-1.5 text-[9px] rounded-lg cursor-pointer disabled:opacity-40" style={{ backgroundColor: "#c4555518", color: "#c45555", border: "1px solid #c4555533" }}>{deleting === t.id ? "削除中..." : "🗑 クラウド削除"}</button>
                  </div>
                </div>
              );
            })}
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
          <h3 className="text-[13px] font-medium mb-3" style={{ color: T.text }}>📋 マイナンバー管理の流れ（番号法遵守）</h3>
          <div className="space-y-2 text-[10px]" style={{ color: T.textSub }}>
            <div className="flex items-start gap-2"><span className="flex-shrink-0" style={{ color: "#c3a782" }}>①</span><span>セラピストからLINE等でマイナンバーカードの写真（表面・裏面）をもらう</span></div>
            <div className="flex items-start gap-2"><span className="flex-shrink-0" style={{ color: "#c3a782" }}>②</span><span><strong>セラピスト管理</strong>ページで各セラピストの編集画面からアップロード</span></div>
            <div className="flex items-start gap-2"><span className="flex-shrink-0" style={{ color: "#c3a782" }}>③</span><span>このページで<strong>「📥 ローカル保存」</strong>→ 暗号化USBや業務PC内の安全なフォルダに保管</span></div>
            <div className="flex items-start gap-2"><span className="flex-shrink-0" style={{ color: "#c3a782" }}>④</span><span>保存確認できたら<strong>「🗑 クラウド削除」</strong>で T-MANAGE 上のデータを速やかに消去</span></div>
            <div className="flex items-start gap-2"><span className="flex-shrink-0" style={{ color: "#c3a782" }}>⑤</span><span>退職・不要時はローカル側も<strong>物理的破棄または完全消去</strong>（番号法 第20条）</span></div>
          </div>
        </div>
      </>)}

      {/* 操作履歴モーダル */}
      {showLogs && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowLogs(false)}>
          <div className="rounded-2xl border p-5 w-full max-w-[760px] max-h-[85vh] overflow-y-auto" style={{ backgroundColor: T.card, borderColor: T.border }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[14px] font-medium">📋 操作履歴（直近500件）</h2>
              <button onClick={() => setShowLogs(false)} className="px-3 py-1.5 text-[10px] rounded-lg cursor-pointer border" style={{ borderColor: T.border, color: T.textSub }}>閉じる</button>
            </div>
            {logs.length === 0 ? (
              <p className="text-center py-10 text-[11px]" style={{ color: T.textFaint }}>履歴がありません</p>
            ) : (
              <div className="rounded-xl border overflow-hidden" style={{ borderColor: T.border }}>
                <table className="w-full text-[10px]" style={{ borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ backgroundColor: T.cardAlt }}>
                      <th className="text-left p-2" style={{ color: T.textSub, borderBottom: `1px solid ${T.border}` }}>日時</th>
                      <th className="text-left p-2" style={{ color: T.textSub, borderBottom: `1px solid ${T.border}` }}>操作</th>
                      <th className="text-left p-2" style={{ color: T.textSub, borderBottom: `1px solid ${T.border}` }}>担当</th>
                      <th className="text-left p-2" style={{ color: T.textSub, borderBottom: `1px solid ${T.border}` }}>対象</th>
                      <th className="text-left p-2" style={{ color: T.textSub, borderBottom: `1px solid ${T.border}` }}>方式</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map(l => (
                      <tr key={l.id}>
                        <td className="p-2" style={{ color: T.text, borderBottom: `1px solid ${T.border}`, whiteSpace: "nowrap" }}>{new Date(l.created_at).toLocaleString("ja-JP")}</td>
                        <td className="p-2" style={{ color: T.text, borderBottom: `1px solid ${T.border}`, whiteSpace: "nowrap" }}>{actionLabel[l.action] || l.action}</td>
                        <td className="p-2" style={{ color: T.text, borderBottom: `1px solid ${T.border}`, whiteSpace: "nowrap" }}>{l.staff_name || "不明"}</td>
                        <td className="p-2" style={{ color: T.text, borderBottom: `1px solid ${T.border}` }}>
                          {l.action === "bulk_download" ? (
                            <span>{l.target_count}名（{l.note}）<span className="block text-[8px]" style={{ color: T.textFaint }}>{l.target_names}</span></span>
                          ) : (l.target_names || "-")}
                        </td>
                        <td className="p-2" style={{ color: T.text, borderBottom: `1px solid ${T.border}` }}>{l.save_method === "zip" ? "ZIP" : l.save_method === "folder" ? "フォルダ" : "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


function CertificateManager({ T }: { T: any }) {
  const [therapists, setTherapists] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [storeInfo, setStoreInfo] = useState<any>(null);
  const [selectedId, setSelectedId] = useState<number>(0);
  const [certYear, setCertYear] = useState(new Date().getFullYear());
  const [search, setSearch] = useState("");
  const [issuing, setIssuing] = useState(false);
  const [totalDaysMap, setTotalDaysMap] = useState<Record<number, number>>({});
  const [recentMap, setRecentMap] = useState<Record<number, boolean>>({});
  const toast = useToast();

  useEffect(() => {
    const f = async () => {
      const { data: th } = await supabase.from("therapists").select("id, name, real_name, address, entry_date, status, phone, license_photo_url").neq("status", "trash").order("sort_order"); if (th) setTherapists(th);
      const { data: st } = await supabase.from("stores").select("company_name, company_address, company_phone"); if (st?.[0]) setStoreInfo(st[0]);
      const { data: ct } = await supabase.from("contracts").select("therapist_id, status"); if (ct) setContracts(ct);
      // Total days per therapist
      const { data: sett } = await supabase.from("therapist_daily_settlements").select("therapist_id, date").eq("is_settled", true);
      if (sett) {
        const dm: Record<number, number> = {};
        const rm: Record<number, boolean> = {};
        const now = new Date();
        const three = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate()).toISOString().slice(0, 10);
        sett.forEach((s: any) => { dm[s.therapist_id] = (dm[s.therapist_id] || 0) + 1; if (s.date >= three) rm[s.therapist_id] = true; });
        setTotalDaysMap(dm); setRecentMap(rm);
      }
    }; f();
  }, []);

  const selected = therapists.find(t => t.id === selectedId);
  const filtered = therapists.filter(t => !search || t.name.includes(search) || (t.real_name || "").includes(search));

  const getChecks = (th: any) => {
    const contract = contracts.find(c => c.therapist_id === th.id && c.status === "signed");
    const totalDays = totalDaysMap[th.id] || 0;
    const hasRecent = recentMap[th.id] || false;
    return [
      { label: "身分証提出済み", ok: !!th.license_photo_url, required: true },
      { label: "業務委託契約署名済み", ok: !!contract, required: true },
      { label: "本名登録済み", ok: !!(th.real_name && th.real_name.trim()), required: true },
      { label: "住所登録済み", ok: !!(th.address && th.address.trim()), required: true },
      { label: `総出勤30日以上（現在${totalDays}日）`, ok: totalDays >= 30, required: true },
      { label: "直近3ヶ月以内の出勤あり", ok: hasRecent, required: false },
      { label: "ステータスが稼働中", ok: th.status === "active", required: false },
    ];
  };

  const getStore = () => ({ company_name: storeInfo?.company_name || "", company_address: storeInfo?.company_address || "", company_phone: storeInfo?.company_phone || "" });
  const getTh = (th: any) => ({ real_name: th.real_name || th.name, name: th.name, address: th.address || "", entry_date: th.entry_date || "" });

  const fetchPayment = async (thId: number) => {
    const { data: sett } = await supabase.from("therapist_daily_settlements").select("date, total_back").eq("therapist_id", thId).gte("date", `${certYear}-01-01`).lte("date", `${certYear}-12-31`);
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
      if (type === "contract") { generateContractCertificate(getStore(), getTh(selected)); }
      else { const payment = await fetchPayment(selected.id); if (type === "payment") generatePaymentCertificate(getStore(), getTh(selected), payment); else generateTransactionCertificate(getStore(), getTh(selected), payment); }
      toast.show("証明書を発行しました", "success");
    } catch { toast.show("発行に失敗しました", "error"); }
    setIssuing(false);
  };

  const statusMap: Record<string, { label: string; color: string }> = { active: { label: "稼働中", color: "#22c55e" }, inactive: { label: "休止中", color: "#f59e0b" }, retired: { label: "退職", color: "#888780" } };
  const checks = selected ? getChecks(selected) : [];
  const warnings = checks.filter(c => !c.ok);
  const hasRequiredFail = checks.some(c => c.required && !c.ok);

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", animation: "fadeIn 0.3s" }}>
      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-[16px] font-medium">📄 証明書発行</h2>
        <span className="text-[10px] px-2 py-0.5 rounded" style={{ backgroundColor: "#c3a78218", color: "#c3a782" }}>会社印が必要な書類</span>
      </div>

      {/* 発行ポリシー説明 */}
      <div className="rounded-xl border p-4 mb-4" style={{ backgroundColor: T.cardAlt, borderColor: T.border }}>
        <p className="text-[11px] font-medium mb-2">📋 証明書発行ポリシー</p>
        <p className="text-[10px] mb-2" style={{ color: T.textMuted }}>証明書は会社の信用を担保に発行する公式書類です。以下の条件を確認してから発行してください。</p>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1">
          {[
            { label: "身分証が提出済みであること", tag: "必須" },
            { label: "業務委託契約書に署名済みであること", tag: "必須" },
            { label: "本名・住所が登録されていること", tag: "必須" },
            { label: "総出勤日数が30日以上であること", tag: "必須" },
            { label: "直近3ヶ月以内に出勤実績があること", tag: "推奨" },
            { label: "ステータスが「稼働中」であること", tag: "推奨" },
          ].map((r, i) => (
            <p key={i} className="text-[10px] flex items-center gap-2" style={{ color: T.textMuted }}>
              <span className="text-[8px] px-1.5 py-0.5 rounded" style={{ backgroundColor: r.tag === "必須" ? "#c4555518" : "#f59e0b18", color: r.tag === "必須" ? "#c45555" : "#f59e0b" }}>{r.tag}</span>
              {r.label}
            </p>
          ))}
        </div>
        <p className="text-[9px] mt-2" style={{ color: T.textFaint }}>※ バックオフィスでは警告表示の上で発行可能です。セラピストマイページでは必須条件を満たさない場合は発行できません。</p>
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: "320px 1fr" }}>
        {/* Left */}
        <div className="rounded-xl border p-4" style={{ backgroundColor: T.card, borderColor: T.border }}>
          <p className="text-[11px] font-medium mb-3">セラピストを選択</p>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 名前で検索" className="w-full px-3 py-2 rounded-lg text-[11px] outline-none mb-3 border" style={{ backgroundColor: T.cardAlt, borderColor: T.border, color: T.text }} />
          <div className="space-y-1 overflow-y-auto" style={{ maxHeight: 400 }}>
            {filtered.map(th => {
              const st = statusMap[th.status] || statusMap.active;
              const thChecks = getChecks(th);
              const thWarn = thChecks.filter(c => !c.ok && c.required).length;
              return (
                <button key={th.id} onClick={() => setSelectedId(th.id)} className="w-full text-left px-3 py-2.5 rounded-lg text-[11px] cursor-pointer flex items-center justify-between" style={{ backgroundColor: selectedId === th.id ? "#c3a78215" : "transparent", color: T.text, border: `1px solid ${selectedId === th.id ? "#c3a78244" : "transparent"}` }}>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{th.name}</span>
                    {thWarn > 0 && <span className="text-[8px] px-1 py-0.5 rounded" style={{ backgroundColor: "#c4555518", color: "#c45555" }}>⚠{thWarn}</span>}
                  </div>
                  <span className="text-[8px] px-1.5 py-0.5 rounded" style={{ backgroundColor: st.color + "18", color: st.color }}>{st.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right */}
        <div className="space-y-4">
          {selected ? (<>
            {/* Requirement checks */}
            <div className="rounded-xl border p-4" style={{ backgroundColor: T.card, borderColor: T.border }}>
              <p className="text-[11px] font-medium mb-3">{selected.name} の発行条件チェック</p>
              <div className="grid grid-cols-2 gap-2">
                {checks.map((c, i) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg text-[10px]" style={{ backgroundColor: c.ok ? "#22c55e08" : "#c4555508", border: `1px solid ${c.ok ? "#22c55e20" : "#c4555520"}` }}>
                    <span style={{ color: c.ok ? "#22c55e" : "#c45555" }}>{c.ok ? "✅" : "❌"}</span>
                    <span style={{ color: c.ok ? T.textMuted : "#c45555" }}>{c.label}</span>
                    {c.required && !c.ok && <span className="text-[8px] px-1 rounded" style={{ backgroundColor: "#c4555518", color: "#c45555", marginLeft: "auto" }}>必須</span>}
                  </div>
                ))}
              </div>
              {hasRequiredFail && (
                <div className="mt-3 px-3 py-2 rounded-lg" style={{ backgroundColor: "#f59e0b0c", border: "1px solid #f59e0b25" }}>
                  <p className="text-[10px]" style={{ color: "#f59e0b" }}>⚠️ 必須条件を満たしていませんが、バックオフィスでは発行可能です。発行する場合は内容を十分に確認してください。</p>
                </div>
              )}
            </div>

            {/* Certificate cards */}
            <div className="rounded-xl border p-4" style={{ backgroundColor: T.card, borderColor: T.border }}>
              <div className="flex items-center justify-between mb-4">
                <p className="text-[13px] font-medium">発行する証明書を選択</p>
                <div className="flex items-center gap-2">
                  <span className="text-[10px]" style={{ color: T.textMuted }}>対象年度</span>
                  <select value={certYear} onChange={e => setCertYear(Number(e.target.value))} className="px-2 py-1 rounded-lg text-[11px] outline-none cursor-pointer border" style={{ backgroundColor: T.cardAlt, borderColor: T.border, color: T.text }}>
                    {[2026, 2025, 2024, 2023].map(y => <option key={y} value={y}>{y}年</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <button onClick={() => issue("contract")} disabled={issuing} className="rounded-xl border p-4 text-left cursor-pointer" style={{ backgroundColor: "#2563eb08", borderColor: "#2563eb30" }}>
                  <div className="text-[20px] mb-2">📝</div>
                  <p className="text-[12px] font-medium" style={{ color: "#2563eb" }}>業務委託契約証明書</p>
                  <p className="text-[9px] mt-1" style={{ color: T.textMuted }}>在籍証明。賃貸契約・保育園申請に。</p>
                </button>
                <button onClick={() => issue("payment")} disabled={issuing} className="rounded-xl border p-4 text-left cursor-pointer" style={{ backgroundColor: "#06b6d408", borderColor: "#06b6d430" }}>
                  <div className="text-[20px] mb-2">💰</div>
                  <p className="text-[12px] font-medium" style={{ color: "#06b6d4" }}>報酬支払証明書</p>
                  <p className="text-[9px] mt-1" style={{ color: T.textMuted }}>収入証明。ローン・カード審査に。</p>
                </button>
                <button onClick={() => issue("transaction")} disabled={issuing} className="rounded-xl border p-4 text-left cursor-pointer" style={{ backgroundColor: "#7c3aed08", borderColor: "#7c3aed30" }}>
                  <div className="text-[20px] mb-2">📊</div>
                  <p className="text-[12px] font-medium" style={{ color: "#7c3aed" }}>取引実績証明書</p>
                  <p className="text-[9px] mt-1" style={{ color: T.textMuted }}>融資・補助金申請に。</p>
                </button>
              </div>
            </div>

            {/* 注意事項 */}
            <div className="rounded-xl border p-4" style={{ backgroundColor: T.cardAlt, borderColor: T.border }}>
              <p className="text-[11px] font-medium mb-2">⚠️ 発行後の手順</p>
              <div className="space-y-1">
                {["証明書を印刷（Ctrl+P → PDF保存も可）","代表印（実印）を押印","セラピストに手渡しまたはPDF送付","控えを会社で保管"].map((t, i) => (
                  <p key={i} className="text-[10px] flex gap-2" style={{ color: T.textMuted }}><span style={{ color: "#c3a782" }}>{i+1}.</span>{t}</p>
                ))}
              </div>
            </div>
          </>) : (
            <div className="rounded-xl border p-8 text-center" style={{ backgroundColor: T.card, borderColor: T.border }}>
              <p className="text-[32px] mb-3">📄</p>
              <p className="text-[14px] font-medium mb-2">セラピストを選択してください</p>
              <p className="text-[11px]" style={{ color: T.textMuted }}>左のリストから証明書を発行するセラピストを選択してください。</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
