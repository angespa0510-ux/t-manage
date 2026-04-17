"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";
import { useTheme } from "../../lib/theme";
import { NavMenu } from "../../lib/nav-menu";
import { useStaffSession } from "../../lib/staff-session";

type Reservation = { id: number; customer_name: string; therapist_id: number; date: string; start_time: string; end_time: string; course: string; notes: string };
type Course = { id: number; name: string; duration: number; price: number; therapist_back: number };
type Expense = { id: number; date: string; category: string; name: string; amount: number; store_id: number; is_recurring: boolean; notes: string; type: string };
type Store = { id: number; name: string; company_name?: string; fiscal_month?: number };
type Therapist = { id: number; name: string; real_name?: string; has_withholding?: boolean; has_invoice?: boolean; therapist_invoice_number?: string; transport_fee?: number; address?: string };
type Settlement = { therapist_id: number; date: string; total_back: number; invoice_deduction: number; withholding_tax: number; adjustment: number; final_payment: number; transport_fee: number; welfare_fee: number };
type TaxDoc = { id: number; category: string; file_name: string; file_url: string; file_path: string; file_size: number; fiscal_period: string; uploaded_by_name: string; notes: string; created_at: string };

const DOC_CATEGORIES = ["決算書", "申告書", "契約書", "固定資産", "支払調書", "その他"];

// Supabase Storageはパスに日本語が使えないため、英語キーにマッピング
const CATEGORY_PATH: Record<string, string> = {
  "決算書": "kessan",
  "申告書": "shinkoku",
  "契約書": "keiyaku",
  "固定資産": "kotei",
  "支払調書": "shiharai",
  "その他": "other",
};

const ACCOUNT_MAP: Record<string, string> = {
  rent: "地代家賃", utilities: "水道光熱費", supplies: "消耗品費",
  transport: "旅費交通費", advertising: "広告宣伝費", therapist_back: "外注費",
  income: "売上高（入金）", other: "雑費",
};

const fmt = (n: number) => "¥" + (n || 0).toLocaleString();

type SheetKey = "summary" | "sales" | "expense" | "therapist" | "invoice" | "schedule" | "docs";

export default function TaxPortal() {
  const router = useRouter();
  const { dark, toggle, T } = useTheme();
  const { activeStaff, canAccessTaxPortal } = useStaffSession();

  const [sheet, setSheet] = useState<SheetKey>("summary");
  const [selectedMonth, setSelectedMonth] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; });
  const [viewMode, setViewMode] = useState<"monthly" | "yearly">("monthly");
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());

  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [companyName, setCompanyName] = useState("合同会社テラスライフ");
  const [fiscalMonth, setFiscalMonth] = useState(3);

  // 書類庫
  const [taxDocs, setTaxDocs] = useState<TaxDoc[]>([]);
  const [docFilter, setDocFilter] = useState<string>("all");
  const [docPeriodFilter, setDocPeriodFilter] = useState<string>("all");
  const [uploadCategory, setUploadCategory] = useState<string>("決算書");
  const [uploadPeriod, setUploadPeriod] = useState<string>("");
  const [uploadNotes, setUploadNotes] = useState<string>("");
  const [uploading, setUploading] = useState(false);

  const [smYear, smMonth] = selectedMonth.split("-").map(Number);

  // 認証・権限チェック
  useEffect(() => {
    if (!activeStaff) { router.push("/dashboard"); return; }
    if (!canAccessTaxPortal) { router.push("/dashboard"); return; }
  }, [activeStaff, canAccessTaxPortal, router]);

  const fetchData = useCallback(async () => {
    const { data: c } = await supabase.from("courses").select("*"); if (c) setCourses(c);
    const { data: s } = await supabase.from("stores").select("*");
    if (s) {
      setStores(s);
      if (s[0]) {
        setCompanyName(s[0].company_name || "合同会社テラスライフ");
        setFiscalMonth(s[0].fiscal_month || 3);
      }
    }

    let startDate: string, endDate: string;
    if (viewMode === "monthly") {
      const dim = new Date(smYear, smMonth, 0).getDate();
      startDate = `${selectedMonth}-01`; endDate = `${selectedMonth}-${String(dim).padStart(2, "0")}`;
    } else {
      startDate = `${selectedYear}-01-01`; endDate = `${selectedYear}-12-31`;
    }

    const { data: r } = await supabase.from("reservations").select("*").gte("date", startDate).lte("date", endDate).order("date");
    if (r) setReservations(r);
    const { data: e } = await supabase.from("expenses").select("*").gte("date", startDate).lte("date", endDate).order("date");
    if (e) setExpenses(e);

    // セラピスト一覧
    const { data: th } = await supabase.from("therapists").select("id,name,real_name,has_withholding,has_invoice,therapist_invoice_number,transport_fee,address");
    if (th) setTherapists(th);

    // 期間内のセラピスト日次清算
    const { data: sts } = await supabase.from("therapist_daily_settlements")
      .select("therapist_id,date,total_back,invoice_deduction,withholding_tax,adjustment,final_payment,transport_fee,welfare_fee")
      .gte("date", startDate).lte("date", endDate).eq("is_settled", true);
    if (sts) setSettlements(sts);
  }, [viewMode, selectedMonth, selectedYear, smYear, smMonth]);

  useEffect(() => { if (canAccessTaxPortal) fetchData(); }, [fetchData, canAccessTaxPortal]);

  // 書類一覧のfetch（期間に依存しないため別で管理）
  const fetchDocs = useCallback(async () => {
    const { data } = await supabase.from("tax_documents").select("*").order("created_at", { ascending: false });
    if (data) setTaxDocs(data);
  }, []);
  useEffect(() => { if (canAccessTaxPortal) fetchDocs(); }, [fetchDocs, canAccessTaxPortal]);

  // 書類アップロード
  const uploadDoc = async (file: File) => {
    if (!file || !activeStaff) return;
    if (file.size > 20 * 1024 * 1024) { alert("ファイルサイズは20MB以下にしてください"); return; }
    setUploading(true);
    try {
      const ext = (file.name.split(".").pop() || "").replace(/[^a-zA-Z0-9]/g, "").toLowerCase() || "bin";
      const uuid = crypto.randomUUID();
      // Storageパスは英数字のみ（日本語NG）。カテゴリは英語キーに変換
      const pathCat = CATEGORY_PATH[uploadCategory] || "other";
      const path = `${pathCat}/${uuid}.${ext}`;
      const { error: upErr } = await supabase.storage.from("tax-documents").upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) { alert("アップロードに失敗しました: " + upErr.message); setUploading(false); return; }
      const { data: pu } = supabase.storage.from("tax-documents").getPublicUrl(path);
      await supabase.from("tax_documents").insert({
        category: uploadCategory,
        file_name: file.name,
        file_url: pu.publicUrl,
        file_path: path,
        file_size: file.size,
        fiscal_period: uploadPeriod.trim(),
        uploaded_by_id: activeStaff.id,
        uploaded_by_name: activeStaff.name,
        notes: uploadNotes.trim(),
      });
      setUploadPeriod(""); setUploadNotes("");
      fetchDocs();
    } catch (err) {
      alert("エラー: " + String(err));
    } finally {
      setUploading(false);
    }
  };

  // 書類削除
  const deleteDoc = async (doc: TaxDoc) => {
    if (!confirm(`「${doc.file_name}」を削除しますか？（元に戻せません）`)) return;
    if (doc.file_path) {
      await supabase.storage.from("tax-documents").remove([doc.file_path]);
    }
    await supabase.from("tax_documents").delete().eq("id", doc.id);
    fetchDocs();
  };

  const getCourse = (name: string) => courses.find((c) => c.name === name);
  const getPrice = (r: Reservation) => getCourse(r.course)?.price || 0;
  const getBack = (r: Reservation) => getCourse(r.course)?.therapist_back || 0;
  const getStoreName = (id: number) => stores.find(s => s.id === id)?.name || "";

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

  // セラピスト支払・源泉徴収集計（期間内）
  const therapistPayroll = (() => {
    const map: Record<number, { name: string; realName: string; hasWithholding: boolean; hasInvoice: boolean; invoiceNum: string; gross: number; invoiceDed: number; tax: number; welfare: number; transport: number; final: number; days: number }> = {};
    settlements.forEach(s => {
      const th = therapists.find(t => t.id === s.therapist_id);
      if (!map[s.therapist_id]) {
        map[s.therapist_id] = {
          name: th?.name || "不明",
          realName: th?.real_name || th?.name || "不明",
          hasWithholding: !!th?.has_withholding,
          hasInvoice: !!th?.has_invoice,
          invoiceNum: th?.therapist_invoice_number || "",
          gross: 0, invoiceDed: 0, tax: 0, welfare: 0, transport: 0, final: 0, days: 0,
        };
      }
      const backAmt = (s.total_back || 0) + (s.adjustment || 0);
      const transportFee = s.transport_fee || th?.transport_fee || 0;
      let dayWT = s.withholding_tax || 0;
      // 源泉徴収税額の自動計算（204条1項6号: (報酬 - インボイス控除 - 5000) * 10.21%）
      if (dayWT === 0 && th?.has_withholding) {
        dayWT = Math.floor(Math.max(backAmt - (s.invoice_deduction || 0) - 5000, 0) * 0.1021);
      }
      map[s.therapist_id].gross += backAmt;
      map[s.therapist_id].invoiceDed += (s.invoice_deduction || 0);
      map[s.therapist_id].tax += dayWT;
      map[s.therapist_id].welfare += (s.welfare_fee || 0);
      map[s.therapist_id].transport += transportFee;
      map[s.therapist_id].final += (s.final_payment || 0);
      map[s.therapist_id].days += 1;
    });
    return Object.entries(map).map(([id, d]) => ({ id: Number(id), ...d })).sort((a, b) => b.gross - a.gross);
  })();

  const totalTherapistGross = therapistPayroll.reduce((s, p) => s + p.gross, 0);
  const totalWithholding = therapistPayroll.reduce((s, p) => s + p.tax, 0);
  const totalInvoiceDed = therapistPayroll.reduce((s, p) => s + p.invoiceDed, 0);

  // 期の算出（3月決算 = 4月始まり）
  const getCurrentFiscalYear = () => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    return currentMonth > fiscalMonth ? currentYear + 1 : currentYear;
  };

  if (!activeStaff || !canAccessTaxPortal) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: T.bg, color: T.text }}>
        <p className="text-[13px]" style={{ color: T.textMuted }}>認証中...</p>
      </div>
    );
  }

  const inputStyle = { backgroundColor: T.cardAlt, color: T.text, border: `1px solid ${T.border}` };
  const gridBorder = `1px solid ${T.border}`;

  return (
    <div className="h-screen flex flex-col" style={{ backgroundColor: T.bg, color: T.text }}>
      {/* ── Header ── */}
      <div className="h-[64px] backdrop-blur-xl border-b flex items-center justify-between px-6 flex-shrink-0" style={{ backgroundColor: dark ? T.card + "cc" : "rgba(255,255,255,0.8)", borderColor: T.border }}>
        <div className="flex items-center gap-4">
          <NavMenu T={T} dark={dark} />
          <button onClick={() => router.push("/dashboard")} className="p-2 rounded-lg cursor-pointer" style={{ color: T.textSub }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <div>
            <h1 className="text-[15px] font-medium">📒 税理士ポータル</h1>
            <p className="text-[11px]" style={{ color: T.textMuted }}>{companyName} · 税務専用画面</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] px-2 py-1 rounded" style={{ backgroundColor: "#c3a78218", color: "#c3a782" }}>{activeStaff.name} ({activeStaff.company_position})</span>
          <button onClick={toggle} className="px-3 py-1.5 text-[10px] rounded-lg cursor-pointer border" style={{ borderColor: T.border, color: T.textSub }}>{dark ? "☀️ ライト" : "🌙 ダーク"}</button>
        </div>
      </div>

      {/* ── Top Bar: 会社情報・期間 ── */}
      <div className="flex items-center gap-3 px-6 py-2.5 border-b flex-wrap" style={{ borderColor: T.border, backgroundColor: T.card }}>
        <span className="text-[11px]" style={{ color: T.textSub }}>会社</span>
        <div className="px-3 py-1.5 rounded-lg text-[12px]" style={{ backgroundColor: T.cardAlt, color: T.text, border: `1px solid ${T.border}` }}>
          {companyName}（{fiscalMonth}月決算）
        </div>
        <span className="text-[11px] ml-3" style={{ color: T.textSub }}>表示</span>
        <div className="flex gap-1">
          <button onClick={() => setViewMode("monthly")} className="px-3 py-1.5 text-[11px] rounded-lg cursor-pointer" style={{ backgroundColor: viewMode === "monthly" ? "#c3a782" : T.cardAlt, color: viewMode === "monthly" ? "white" : T.textSub, border: `1px solid ${viewMode === "monthly" ? "#c3a782" : T.border}` }}>月次</button>
          <button onClick={() => setViewMode("yearly")} className="px-3 py-1.5 text-[11px] rounded-lg cursor-pointer" style={{ backgroundColor: viewMode === "yearly" ? "#c3a782" : T.cardAlt, color: viewMode === "yearly" ? "white" : T.textSub, border: `1px solid ${viewMode === "yearly" ? "#c3a782" : T.border}` }}>年次</button>
        </div>
        {viewMode === "monthly" ? (
          <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="px-3 py-1.5 rounded-lg text-[12px] outline-none" style={inputStyle} />
        ) : (
          <select value={selectedYear} onChange={(e) => setSelectedYear(parseInt(e.target.value))} className="px-3 py-1.5 rounded-lg text-[12px] outline-none cursor-pointer" style={inputStyle}>
            {[0,1,2].map(i => { const y = new Date().getFullYear() - i; return <option key={y} value={y}>{y}年</option>; })}
          </select>
        )}
        <div className="flex-1"></div>
        <span className="text-[10px]" style={{ color: T.textFaint }}>今期: 第{getCurrentFiscalYear() - 2023}期（会計ソフト出力はPhase 2）</span>
      </div>

      {/* ── Body: Sheet Content ── */}
      <div className="flex-1 overflow-y-auto" style={{ backgroundColor: T.bg }}>
        <div className="p-6">

          {/* ── Sheet: 月次サマリー ── */}
          {sheet === "summary" && (
            <div className="space-y-4 animate-[fadeIn_0.3s]">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { l: "総売上", v: fmt(grossRevenue), sub: `予約 ${fmt(totalSales)}${totalIncomeExtra > 0 ? ` + 入金 ${fmt(totalIncomeExtra)}` : ""}`, c: "#22c55e" },
                  { l: "経費合計", v: fmt(totalExpenseAll), sub: `うち外注費 ${fmt(totalBack)}`, c: "#c45555" },
                  { l: "業務委託費", v: fmt(totalBack), sub: `${reservations.length}件のバック`, c: "#e091a8" },
                  { l: "差引利益", v: fmt(netProfit), sub: netProfit >= 0 ? "黒字" : "赤字", c: netProfit >= 0 ? "#22c55e" : "#c45555" },
                ].map(s => (
                  <div key={s.l} className="rounded-xl p-4" style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}>
                    <p className="text-[10px] mb-1" style={{ color: T.textMuted }}>{s.l}</p>
                    <p className="text-[18px] font-medium" style={{ color: s.c }}>{s.v}</p>
                    <p className="text-[9px] mt-0.5" style={{ color: T.textFaint }}>{s.sub}</p>
                  </div>
                ))}
              </div>

              <div className="rounded-xl overflow-hidden" style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}>
                <div className="px-4 py-2.5 flex items-center justify-between" style={{ backgroundColor: T.cardAlt, borderBottom: gridBorder }}>
                  <span className="text-[12px] font-medium">📊 勘定科目別集計（{viewMode === "monthly" ? selectedMonth : `${selectedYear}年`}）</span>
                  <span className="text-[10px]" style={{ color: T.textFaint }}>{accountSummary.length}科目</span>
                </div>
                <table className="w-full" style={{ fontSize: 12 }}>
                  <thead>
                    <tr style={{ backgroundColor: T.cardAlt, color: T.textSub, fontSize: 11 }}>
                      <th style={{ padding: "6px 10px", textAlign: "center", width: 40, borderRight: gridBorder }}></th>
                      <th style={{ padding: "6px 10px", textAlign: "left", borderRight: gridBorder }}>勘定科目</th>
                      <th style={{ padding: "6px 10px", textAlign: "left", borderRight: gridBorder }}>種別</th>
                      <th style={{ padding: "6px 10px", textAlign: "right", borderRight: gridBorder }}>金額</th>
                      <th style={{ padding: "6px 10px", textAlign: "right" }}>構成比</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accountSummary.length === 0 && (
                      <tr><td colSpan={5} style={{ padding: "24px", textAlign: "center", color: T.textFaint, fontSize: 11 }}>データがありません</td></tr>
                    )}
                    {accountSummary.map((a, i) => (
                      <tr key={a.category} style={{ borderTop: gridBorder, backgroundColor: i % 2 === 0 ? "transparent" : T.cardAlt + "40" }}>
                        <td style={{ padding: "6px 10px", textAlign: "center", color: T.textFaint, fontSize: 10, borderRight: gridBorder }}>{i + 1}</td>
                        <td style={{ padding: "6px 10px", borderRight: gridBorder }}>{a.account}</td>
                        <td style={{ padding: "6px 10px", borderRight: gridBorder, color: T.textMuted, fontSize: 11 }}>{a.category === "therapist_back" ? "外注（セラピスト）" : a.category}</td>
                        <td style={{ padding: "6px 10px", textAlign: "right", fontVariantNumeric: "tabular-nums", borderRight: gridBorder }}>{fmt(a.amount)}</td>
                        <td style={{ padding: "6px 10px", textAlign: "right", fontVariantNumeric: "tabular-nums", color: T.textSub }}>{totalExpenseAll > 0 ? Math.round(a.amount / totalExpenseAll * 100) : 0}%</td>
                      </tr>
                    ))}
                    {accountSummary.length > 0 && (
                      <tr style={{ borderTop: `2px solid ${T.border}`, backgroundColor: "#22c55e10", fontWeight: 500 }}>
                        <td style={{ padding: "8px 10px", textAlign: "center", borderRight: gridBorder }}></td>
                        <td style={{ padding: "8px 10px", borderRight: gridBorder }}>経費合計</td>
                        <td style={{ padding: "8px 10px", borderRight: gridBorder }}></td>
                        <td style={{ padding: "8px 10px", textAlign: "right", fontVariantNumeric: "tabular-nums", borderRight: gridBorder, color: "#22c55e" }}>{fmt(totalExpenseAll)}</td>
                        <td style={{ padding: "8px 10px", textAlign: "right", fontVariantNumeric: "tabular-nums", color: "#22c55e" }}>100%</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="rounded-xl p-4" style={{ backgroundColor: "#c3a78210", border: "1px solid #c3a78233" }}>
                <p className="text-[11px] font-medium mb-1" style={{ color: "#c3a782" }}>💡 このページについて</p>
                <p className="text-[11px] leading-relaxed" style={{ color: T.textSub }}>
                  税理士ポータルは税務関連データの共有画面です。税理士の先生・社長・経営責任者のみアクセス可能です。<br/>
                  現在、月次サマリー・売上・経費・セラピスト支払/源泉徴収・インボイス・書類庫 の6シートが利用可能です。<br/>
                  Phase 2Cで年間スケジュール、Phase 3で会計ソフト5形式出力（弥生/freee/MFクラウド/汎用/e-Tax）を実装予定。
                </p>
              </div>
            </div>
          )}

          {/* ── Sheet: 売上 ── */}
          {sheet === "sales" && (
            <div className="space-y-4 animate-[fadeIn_0.3s]">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div className="rounded-xl p-4" style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}>
                  <p className="text-[10px] mb-1" style={{ color: T.textMuted }}>予約数</p>
                  <p className="text-[18px] font-medium">{reservations.length}件</p>
                </div>
                <div className="rounded-xl p-4" style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}>
                  <p className="text-[10px] mb-1" style={{ color: T.textMuted }}>売上合計</p>
                  <p className="text-[18px] font-medium" style={{ color: "#22c55e" }}>{fmt(totalSales)}</p>
                </div>
                <div className="rounded-xl p-4" style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}>
                  <p className="text-[10px] mb-1" style={{ color: T.textMuted }}>平均単価</p>
                  <p className="text-[18px] font-medium">{fmt(reservations.length > 0 ? Math.round(totalSales / reservations.length) : 0)}</p>
                </div>
              </div>

              <div className="rounded-xl overflow-hidden" style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}>
                <div className="px-4 py-2.5 flex items-center justify-between" style={{ backgroundColor: T.cardAlt, borderBottom: gridBorder }}>
                  <span className="text-[12px] font-medium">💰 売上明細（{viewMode === "monthly" ? selectedMonth : `${selectedYear}年`}）</span>
                  <span className="text-[10px]" style={{ color: T.textFaint }}>{reservations.length}件</span>
                </div>
                <div style={{ maxHeight: 500, overflowY: "auto" }}>
                  <table className="w-full" style={{ fontSize: 12 }}>
                    <thead style={{ position: "sticky", top: 0, backgroundColor: T.cardAlt }}>
                      <tr style={{ color: T.textSub, fontSize: 11 }}>
                        <th style={{ padding: "6px 10px", textAlign: "center", width: 40, borderRight: gridBorder, borderBottom: gridBorder }}></th>
                        <th style={{ padding: "6px 10px", textAlign: "left", borderRight: gridBorder, borderBottom: gridBorder }}>日付</th>
                        <th style={{ padding: "6px 10px", textAlign: "left", borderRight: gridBorder, borderBottom: gridBorder }}>時間</th>
                        <th style={{ padding: "6px 10px", textAlign: "left", borderRight: gridBorder, borderBottom: gridBorder }}>顧客名</th>
                        <th style={{ padding: "6px 10px", textAlign: "left", borderRight: gridBorder, borderBottom: gridBorder }}>コース</th>
                        <th style={{ padding: "6px 10px", textAlign: "right", borderRight: gridBorder, borderBottom: gridBorder }}>金額</th>
                        <th style={{ padding: "6px 10px", textAlign: "right", borderBottom: gridBorder }}>バック</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reservations.length === 0 && (
                        <tr><td colSpan={7} style={{ padding: "24px", textAlign: "center", color: T.textFaint, fontSize: 11 }}>予約データがありません</td></tr>
                      )}
                      {reservations.map((r, i) => (
                        <tr key={r.id} style={{ borderTop: gridBorder, backgroundColor: i % 2 === 0 ? "transparent" : T.cardAlt + "40" }}>
                          <td style={{ padding: "5px 10px", textAlign: "center", color: T.textFaint, fontSize: 10, borderRight: gridBorder }}>{i + 1}</td>
                          <td style={{ padding: "5px 10px", borderRight: gridBorder, fontVariantNumeric: "tabular-nums" }}>{r.date}</td>
                          <td style={{ padding: "5px 10px", borderRight: gridBorder, fontVariantNumeric: "tabular-nums", color: T.textSub }}>{r.start_time?.slice(0,5)}〜{r.end_time?.slice(0,5)}</td>
                          <td style={{ padding: "5px 10px", borderRight: gridBorder }}>{r.customer_name || "—"}</td>
                          <td style={{ padding: "5px 10px", borderRight: gridBorder, color: T.textSub, fontSize: 11 }}>{r.course || "—"}</td>
                          <td style={{ padding: "5px 10px", textAlign: "right", borderRight: gridBorder, fontVariantNumeric: "tabular-nums" }}>{fmt(getPrice(r))}</td>
                          <td style={{ padding: "5px 10px", textAlign: "right", fontVariantNumeric: "tabular-nums", color: "#e091a8" }}>{fmt(getBack(r))}</td>
                        </tr>
                      ))}
                      {reservations.length > 0 && (
                        <tr style={{ borderTop: `2px solid ${T.border}`, backgroundColor: "#22c55e10", fontWeight: 500, position: "sticky", bottom: 0 }}>
                          <td style={{ padding: "8px 10px", borderRight: gridBorder }}></td>
                          <td colSpan={4} style={{ padding: "8px 10px", borderRight: gridBorder }}>合計（{reservations.length}件）</td>
                          <td style={{ padding: "8px 10px", textAlign: "right", fontVariantNumeric: "tabular-nums", borderRight: gridBorder, color: "#22c55e" }}>{fmt(totalSales)}</td>
                          <td style={{ padding: "8px 10px", textAlign: "right", fontVariantNumeric: "tabular-nums", color: "#e091a8" }}>{fmt(totalBack)}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── Sheet: 経費 ── */}
          {sheet === "expense" && (
            <div className="space-y-4 animate-[fadeIn_0.3s]">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="rounded-xl p-4" style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}>
                  <p className="text-[10px] mb-1" style={{ color: T.textMuted }}>経費件数</p>
                  <p className="text-[18px] font-medium">{expenses.filter(e => e.type !== "income").length}件</p>
                </div>
                <div className="rounded-xl p-4" style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}>
                  <p className="text-[10px] mb-1" style={{ color: T.textMuted }}>経費合計（外注費除く）</p>
                  <p className="text-[18px] font-medium" style={{ color: "#c45555" }}>{fmt(totalExpenseOnly)}</p>
                </div>
                <div className="rounded-xl p-4" style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}>
                  <p className="text-[10px] mb-1" style={{ color: T.textMuted }}>外注費（セラピストバック）</p>
                  <p className="text-[18px] font-medium" style={{ color: "#e091a8" }}>{fmt(totalBack)}</p>
                </div>
                <div className="rounded-xl p-4" style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}>
                  <p className="text-[10px] mb-1" style={{ color: T.textMuted }}>経費総額</p>
                  <p className="text-[18px] font-medium">{fmt(totalExpenseAll)}</p>
                </div>
              </div>

              <div className="rounded-xl overflow-hidden" style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}>
                <div className="px-4 py-2.5 flex items-center justify-between" style={{ backgroundColor: T.cardAlt, borderBottom: gridBorder }}>
                  <span className="text-[12px] font-medium">💸 経費明細（{viewMode === "monthly" ? selectedMonth : `${selectedYear}年`}）</span>
                  <span className="text-[10px]" style={{ color: T.textFaint }}>{expenses.filter(e => e.type !== "income").length}件</span>
                </div>
                <div style={{ maxHeight: 500, overflowY: "auto" }}>
                  <table className="w-full" style={{ fontSize: 12 }}>
                    <thead style={{ position: "sticky", top: 0, backgroundColor: T.cardAlt }}>
                      <tr style={{ color: T.textSub, fontSize: 11 }}>
                        <th style={{ padding: "6px 10px", textAlign: "center", width: 40, borderRight: gridBorder, borderBottom: gridBorder }}></th>
                        <th style={{ padding: "6px 10px", textAlign: "left", borderRight: gridBorder, borderBottom: gridBorder }}>日付</th>
                        <th style={{ padding: "6px 10px", textAlign: "left", borderRight: gridBorder, borderBottom: gridBorder }}>勘定科目</th>
                        <th style={{ padding: "6px 10px", textAlign: "left", borderRight: gridBorder, borderBottom: gridBorder }}>項目</th>
                        <th style={{ padding: "6px 10px", textAlign: "left", borderRight: gridBorder, borderBottom: gridBorder }}>店舗</th>
                        <th style={{ padding: "6px 10px", textAlign: "left", borderRight: gridBorder, borderBottom: gridBorder }}>備考</th>
                        <th style={{ padding: "6px 10px", textAlign: "right", borderBottom: gridBorder }}>金額</th>
                      </tr>
                    </thead>
                    <tbody>
                      {expenses.filter(e => e.type !== "income").length === 0 && (
                        <tr><td colSpan={7} style={{ padding: "24px", textAlign: "center", color: T.textFaint, fontSize: 11 }}>経費データがありません</td></tr>
                      )}
                      {expenses.filter(e => e.type !== "income").map((e, i) => (
                        <tr key={e.id} style={{ borderTop: gridBorder, backgroundColor: i % 2 === 0 ? "transparent" : T.cardAlt + "40" }}>
                          <td style={{ padding: "5px 10px", textAlign: "center", color: T.textFaint, fontSize: 10, borderRight: gridBorder }}>{i + 1}</td>
                          <td style={{ padding: "5px 10px", borderRight: gridBorder, fontVariantNumeric: "tabular-nums" }}>{e.date}</td>
                          <td style={{ padding: "5px 10px", borderRight: gridBorder, color: T.textSub, fontSize: 11 }}>{ACCOUNT_MAP[e.category] || "雑費"}</td>
                          <td style={{ padding: "5px 10px", borderRight: gridBorder }}>{e.name || "—"}</td>
                          <td style={{ padding: "5px 10px", borderRight: gridBorder, color: T.textMuted, fontSize: 11 }}>{getStoreName(e.store_id) || "—"}</td>
                          <td style={{ padding: "5px 10px", borderRight: gridBorder, color: T.textMuted, fontSize: 10 }}>{e.notes || ""}</td>
                          <td style={{ padding: "5px 10px", textAlign: "right", fontVariantNumeric: "tabular-nums", color: "#c45555" }}>{fmt(e.amount)}</td>
                        </tr>
                      ))}
                      {expenses.filter(e => e.type !== "income").length > 0 && (
                        <tr style={{ borderTop: `2px solid ${T.border}`, backgroundColor: "#c4555510", fontWeight: 500 }}>
                          <td style={{ padding: "8px 10px", borderRight: gridBorder }}></td>
                          <td colSpan={5} style={{ padding: "8px 10px", borderRight: gridBorder }}>経費合計（外注費除く）</td>
                          <td style={{ padding: "8px 10px", textAlign: "right", fontVariantNumeric: "tabular-nums", color: "#c45555" }}>{fmt(totalExpenseOnly)}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── Sheet: セラピスト支払・源泉徴収 ── */}
          {sheet === "therapist" && (
            <div className="space-y-4 animate-[fadeIn_0.3s]">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="rounded-xl p-4" style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}>
                  <p className="text-[10px] mb-1" style={{ color: T.textMuted }}>対象セラピスト</p>
                  <p className="text-[18px] font-medium">{therapistPayroll.length}名</p>
                </div>
                <div className="rounded-xl p-4" style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}>
                  <p className="text-[10px] mb-1" style={{ color: T.textMuted }}>報酬総額（支払総額）</p>
                  <p className="text-[18px] font-medium" style={{ color: "#e091a8" }}>{fmt(totalTherapistGross)}</p>
                </div>
                <div className="rounded-xl p-4" style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}>
                  <p className="text-[10px] mb-1" style={{ color: T.textMuted }}>源泉徴収税額</p>
                  <p className="text-[18px] font-medium" style={{ color: "#f59e0b" }}>{fmt(totalWithholding)}</p>
                </div>
                <div className="rounded-xl p-4" style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}>
                  <p className="text-[10px] mb-1" style={{ color: T.textMuted }}>インボイス控除額</p>
                  <p className="text-[18px] font-medium" style={{ color: "#85a8c4" }}>{fmt(totalInvoiceDed)}</p>
                </div>
              </div>

              <div className="rounded-xl overflow-hidden" style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}>
                <div className="px-4 py-2.5 flex items-center justify-between" style={{ backgroundColor: T.cardAlt, borderBottom: gridBorder }}>
                  <div>
                    <span className="text-[12px] font-medium">👥 セラピスト支払・源泉徴収集計（{viewMode === "monthly" ? selectedMonth : `${selectedYear}年`}）</span>
                    <p className="text-[9px] mt-0.5" style={{ color: T.textFaint }}>根拠: 所得税法204条1項6号 / 月額5,000円控除 / 税率10.21%</p>
                  </div>
                  <span className="text-[10px]" style={{ color: T.textFaint }}>{therapistPayroll.length}名</span>
                </div>
                <div style={{ maxHeight: 500, overflowY: "auto" }}>
                  <table className="w-full" style={{ fontSize: 12 }}>
                    <thead style={{ position: "sticky", top: 0, backgroundColor: T.cardAlt }}>
                      <tr style={{ color: T.textSub, fontSize: 11 }}>
                        <th style={{ padding: "6px 10px", textAlign: "center", width: 40, borderRight: gridBorder, borderBottom: gridBorder }}></th>
                        <th style={{ padding: "6px 10px", textAlign: "left", borderRight: gridBorder, borderBottom: gridBorder }}>氏名</th>
                        <th style={{ padding: "6px 10px", textAlign: "center", borderRight: gridBorder, borderBottom: gridBorder }}>源泉</th>
                        <th style={{ padding: "6px 10px", textAlign: "center", borderRight: gridBorder, borderBottom: gridBorder }}>インボイス</th>
                        <th style={{ padding: "6px 10px", textAlign: "right", borderRight: gridBorder, borderBottom: gridBorder }}>出勤日数</th>
                        <th style={{ padding: "6px 10px", textAlign: "right", borderRight: gridBorder, borderBottom: gridBorder }}>報酬総額</th>
                        <th style={{ padding: "6px 10px", textAlign: "right", borderRight: gridBorder, borderBottom: gridBorder }}>インボイス控除</th>
                        <th style={{ padding: "6px 10px", textAlign: "right", borderRight: gridBorder, borderBottom: gridBorder }}>源泉徴収</th>
                        <th style={{ padding: "6px 10px", textAlign: "right", borderBottom: gridBorder }}>実支給額</th>
                      </tr>
                    </thead>
                    <tbody>
                      {therapistPayroll.length === 0 && (
                        <tr><td colSpan={9} style={{ padding: "24px", textAlign: "center", color: T.textFaint, fontSize: 11 }}>対象期間の清算データがありません</td></tr>
                      )}
                      {therapistPayroll.map((p, i) => (
                        <tr key={p.id} style={{ borderTop: gridBorder, backgroundColor: i % 2 === 0 ? "transparent" : T.cardAlt + "40" }}>
                          <td style={{ padding: "5px 10px", textAlign: "center", color: T.textFaint, fontSize: 10, borderRight: gridBorder }}>{i + 1}</td>
                          <td style={{ padding: "5px 10px", borderRight: gridBorder }}>
                            <div>{p.realName}</div>
                            {p.name !== p.realName && <div className="text-[9px]" style={{ color: T.textFaint }}>(源氏名: {p.name})</div>}
                          </td>
                          <td style={{ padding: "5px 10px", textAlign: "center", borderRight: gridBorder }}>
                            {p.hasWithholding ? <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "#f59e0b18", color: "#f59e0b" }}>対象</span> : <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ backgroundColor: T.cardAlt, color: T.textFaint }}>対象外</span>}
                          </td>
                          <td style={{ padding: "5px 10px", textAlign: "center", borderRight: gridBorder }}>
                            {p.hasInvoice ? <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "#22c55e18", color: "#22c55e" }} title={p.invoiceNum}>登録済</span> : <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "#c4555518", color: "#c45555" }}>未登録</span>}
                          </td>
                          <td style={{ padding: "5px 10px", textAlign: "right", fontVariantNumeric: "tabular-nums", borderRight: gridBorder, color: T.textSub }}>{p.days}日</td>
                          <td style={{ padding: "5px 10px", textAlign: "right", fontVariantNumeric: "tabular-nums", borderRight: gridBorder }}>{fmt(p.gross)}</td>
                          <td style={{ padding: "5px 10px", textAlign: "right", fontVariantNumeric: "tabular-nums", borderRight: gridBorder, color: "#85a8c4" }}>{fmt(p.invoiceDed)}</td>
                          <td style={{ padding: "5px 10px", textAlign: "right", fontVariantNumeric: "tabular-nums", borderRight: gridBorder, color: "#f59e0b" }}>{fmt(p.tax)}</td>
                          <td style={{ padding: "5px 10px", textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 500 }}>{fmt(p.final)}</td>
                        </tr>
                      ))}
                      {therapistPayroll.length > 0 && (
                        <tr style={{ borderTop: `2px solid ${T.border}`, backgroundColor: "#e091a810", fontWeight: 500 }}>
                          <td style={{ padding: "8px 10px", borderRight: gridBorder }}></td>
                          <td colSpan={4} style={{ padding: "8px 10px", borderRight: gridBorder }}>合計（{therapistPayroll.length}名）</td>
                          <td style={{ padding: "8px 10px", textAlign: "right", fontVariantNumeric: "tabular-nums", borderRight: gridBorder, color: "#e091a8" }}>{fmt(totalTherapistGross)}</td>
                          <td style={{ padding: "8px 10px", textAlign: "right", fontVariantNumeric: "tabular-nums", borderRight: gridBorder, color: "#85a8c4" }}>{fmt(totalInvoiceDed)}</td>
                          <td style={{ padding: "8px 10px", textAlign: "right", fontVariantNumeric: "tabular-nums", borderRight: gridBorder, color: "#f59e0b" }}>{fmt(totalWithholding)}</td>
                          <td style={{ padding: "8px 10px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmt(therapistPayroll.reduce((s, p) => s + p.final, 0))}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── Sheet: インボイス ── */}
          {sheet === "invoice" && (
            <div className="space-y-4 animate-[fadeIn_0.3s]">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="rounded-xl p-4" style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}>
                  <p className="text-[10px] mb-1" style={{ color: T.textMuted }}>登録済セラピスト</p>
                  <p className="text-[18px] font-medium" style={{ color: "#22c55e" }}>{therapistPayroll.filter(p => p.hasInvoice).length}名</p>
                </div>
                <div className="rounded-xl p-4" style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}>
                  <p className="text-[10px] mb-1" style={{ color: T.textMuted }}>未登録セラピスト</p>
                  <p className="text-[18px] font-medium" style={{ color: "#c45555" }}>{therapistPayroll.filter(p => !p.hasInvoice).length}名</p>
                </div>
                <div className="rounded-xl p-4" style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}>
                  <p className="text-[10px] mb-1" style={{ color: T.textMuted }}>登録済への支払</p>
                  <p className="text-[18px] font-medium" style={{ color: "#22c55e" }}>{fmt(therapistPayroll.filter(p => p.hasInvoice).reduce((s, p) => s + p.gross, 0))}</p>
                </div>
                <div className="rounded-xl p-4" style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}>
                  <p className="text-[10px] mb-1" style={{ color: T.textMuted }}>未登録への支払（2割特例対象）</p>
                  <p className="text-[18px] font-medium" style={{ color: "#f59e0b" }}>{fmt(therapistPayroll.filter(p => !p.hasInvoice).reduce((s, p) => s + p.gross, 0))}</p>
                </div>
              </div>

              <div className="rounded-xl overflow-hidden" style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}>
                <div className="px-4 py-2.5 flex items-center justify-between" style={{ backgroundColor: T.cardAlt, borderBottom: gridBorder }}>
                  <div>
                    <span className="text-[12px] font-medium">🧾 インボイス登録状況・2割特例控除（{viewMode === "monthly" ? selectedMonth : `${selectedYear}年`}）</span>
                    <p className="text-[9px] mt-0.5" style={{ color: T.textFaint }}>インボイス未登録のセラピストへの支払は、買手側で仕入税額控除が制限されます（経過措置: 2026年9月まで80%控除可）</p>
                  </div>
                  <span className="text-[10px]" style={{ color: T.textFaint }}>{therapistPayroll.length}名</span>
                </div>
                <div style={{ maxHeight: 500, overflowY: "auto" }}>
                  <table className="w-full" style={{ fontSize: 12 }}>
                    <thead style={{ position: "sticky", top: 0, backgroundColor: T.cardAlt }}>
                      <tr style={{ color: T.textSub, fontSize: 11 }}>
                        <th style={{ padding: "6px 10px", textAlign: "center", width: 40, borderRight: gridBorder, borderBottom: gridBorder }}></th>
                        <th style={{ padding: "6px 10px", textAlign: "left", borderRight: gridBorder, borderBottom: gridBorder }}>氏名</th>
                        <th style={{ padding: "6px 10px", textAlign: "center", borderRight: gridBorder, borderBottom: gridBorder }}>ステータス</th>
                        <th style={{ padding: "6px 10px", textAlign: "left", borderRight: gridBorder, borderBottom: gridBorder }}>登録番号</th>
                        <th style={{ padding: "6px 10px", textAlign: "right", borderRight: gridBorder, borderBottom: gridBorder }}>支払総額</th>
                        <th style={{ padding: "6px 10px", textAlign: "right", borderRight: gridBorder, borderBottom: gridBorder }}>内消費税(10/110)</th>
                        <th style={{ padding: "6px 10px", textAlign: "right", borderBottom: gridBorder }}>仕入控除可能額</th>
                      </tr>
                    </thead>
                    <tbody>
                      {therapistPayroll.length === 0 && (
                        <tr><td colSpan={7} style={{ padding: "24px", textAlign: "center", color: T.textFaint, fontSize: 11 }}>対象期間のデータがありません</td></tr>
                      )}
                      {therapistPayroll.map((p, i) => {
                        const includedTax = Math.floor(p.gross * 10 / 110);
                        const deductible = p.hasInvoice ? includedTax : Math.floor(includedTax * 0.8); // 経過措置80%
                        return (
                          <tr key={p.id} style={{ borderTop: gridBorder, backgroundColor: i % 2 === 0 ? "transparent" : T.cardAlt + "40" }}>
                            <td style={{ padding: "5px 10px", textAlign: "center", color: T.textFaint, fontSize: 10, borderRight: gridBorder }}>{i + 1}</td>
                            <td style={{ padding: "5px 10px", borderRight: gridBorder }}>{p.realName}</td>
                            <td style={{ padding: "5px 10px", textAlign: "center", borderRight: gridBorder }}>
                              {p.hasInvoice ? <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "#22c55e18", color: "#22c55e" }}>✓ 適格</span> : <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "#c4555518", color: "#c45555" }}>未登録</span>}
                            </td>
                            <td style={{ padding: "5px 10px", borderRight: gridBorder, fontFamily: "monospace", fontSize: 10, color: T.textMuted }}>{p.invoiceNum || "—"}</td>
                            <td style={{ padding: "5px 10px", textAlign: "right", fontVariantNumeric: "tabular-nums", borderRight: gridBorder }}>{fmt(p.gross)}</td>
                            <td style={{ padding: "5px 10px", textAlign: "right", fontVariantNumeric: "tabular-nums", borderRight: gridBorder, color: T.textSub }}>{fmt(includedTax)}</td>
                            <td style={{ padding: "5px 10px", textAlign: "right", fontVariantNumeric: "tabular-nums", color: p.hasInvoice ? "#22c55e" : "#f59e0b" }}>{fmt(deductible)}{!p.hasInvoice && <span className="text-[9px] ml-1" style={{ color: T.textFaint }}>(80%)</span>}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-xl p-4" style={{ backgroundColor: "#f59e0b10", border: "1px solid #f59e0b33" }}>
                <p className="text-[11px] font-medium mb-1" style={{ color: "#f59e0b" }}>💡 インボイス経過措置について</p>
                <p className="text-[11px] leading-relaxed" style={{ color: T.textSub }}>
                  2026年10月1日〜2029年9月30日は、未登録事業者からの仕入について<strong>50%控除</strong>の経過措置期間に入ります。<br/>
                  現在（2026年9月30日まで）は<strong>80%控除</strong>が適用可能です。未登録セラピストには早めの登録を案内することで、会社側の仕入控除を維持できます。
                </p>
              </div>
            </div>
          )}

          {/* ── Sheet: 書類庫 ── */}
          {sheet === "docs" && (
            <div className="space-y-4 animate-[fadeIn_0.3s]">
              {/* サマリーカード */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="rounded-xl p-4" style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}>
                  <p className="text-[10px] mb-1" style={{ color: T.textMuted }}>登録書類数</p>
                  <p className="text-[18px] font-medium">{taxDocs.length}件</p>
                </div>
                <div className="rounded-xl p-4" style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}>
                  <p className="text-[10px] mb-1" style={{ color: T.textMuted }}>決算書</p>
                  <p className="text-[18px] font-medium" style={{ color: "#c3a782" }}>{taxDocs.filter(d => d.category === "決算書").length}件</p>
                </div>
                <div className="rounded-xl p-4" style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}>
                  <p className="text-[10px] mb-1" style={{ color: T.textMuted }}>申告書</p>
                  <p className="text-[18px] font-medium" style={{ color: "#85a8c4" }}>{taxDocs.filter(d => d.category === "申告書").length}件</p>
                </div>
                <div className="rounded-xl p-4" style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}>
                  <p className="text-[10px] mb-1" style={{ color: T.textMuted }}>総容量</p>
                  <p className="text-[18px] font-medium">{(taxDocs.reduce((s, d) => s + (d.file_size || 0), 0) / 1024 / 1024).toFixed(1)}MB</p>
                </div>
              </div>

              {/* アップロードエリア */}
              <div className="rounded-xl p-5" style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}>
                <p className="text-[13px] font-medium mb-3">📤 書類アップロード</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                  <div>
                    <label className="block text-[10px] mb-1" style={{ color: T.textSub }}>カテゴリ</label>
                    <select value={uploadCategory} onChange={(e) => setUploadCategory(e.target.value)} className="w-full px-3 py-2 rounded-lg text-[12px] outline-none cursor-pointer" style={inputStyle}>
                      {DOC_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] mb-1" style={{ color: T.textSub }}>期（任意）</label>
                    <input type="text" value={uploadPeriod} onChange={(e) => setUploadPeriod(e.target.value)} placeholder="例: 第3期 / 2025年分" className="w-full px-3 py-2 rounded-lg text-[12px] outline-none" style={inputStyle} />
                  </div>
                  <div>
                    <label className="block text-[10px] mb-1" style={{ color: T.textSub }}>備考（任意）</label>
                    <input type="text" value={uploadNotes} onChange={(e) => setUploadNotes(e.target.value)} placeholder="メモ" className="w-full px-3 py-2 rounded-lg text-[12px] outline-none" style={inputStyle} />
                  </div>
                </div>
                <label className="block cursor-pointer">
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png,.csv,.xlsx,.xls,.docx,.doc" className="hidden" disabled={uploading} onChange={(e) => { const f = e.target.files?.[0]; if (f) { uploadDoc(f); e.target.value = ""; } }} />
                  <div className="rounded-lg py-8 text-center transition-colors" style={{ border: `2px dashed ${T.border}`, backgroundColor: uploading ? T.cardAlt : "transparent" }}>
                    {uploading ? (
                      <p className="text-[12px]" style={{ color: "#c3a782" }}>📤 アップロード中...</p>
                    ) : (
                      <>
                        <p className="text-[12px]" style={{ color: T.textSub }}>📎 クリックしてファイルを選択</p>
                        <p className="text-[10px] mt-1" style={{ color: T.textFaint }}>PDF・JPG・PNG・CSV・Excel・Word（最大20MB）</p>
                      </>
                    )}
                  </div>
                </label>
              </div>

              {/* フィルター */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px]" style={{ color: T.textSub }}>カテゴリ:</span>
                <button onClick={() => setDocFilter("all")} className="px-3 py-1 text-[10px] rounded-lg cursor-pointer" style={{ backgroundColor: docFilter === "all" ? "#c3a782" : T.cardAlt, color: docFilter === "all" ? "white" : T.textSub, border: `1px solid ${docFilter === "all" ? "#c3a782" : T.border}` }}>すべて ({taxDocs.length})</button>
                {DOC_CATEGORIES.map(c => {
                  const count = taxDocs.filter(d => d.category === c).length;
                  if (count === 0) return null;
                  return <button key={c} onClick={() => setDocFilter(c)} className="px-3 py-1 text-[10px] rounded-lg cursor-pointer" style={{ backgroundColor: docFilter === c ? "#c3a782" : T.cardAlt, color: docFilter === c ? "white" : T.textSub, border: `1px solid ${docFilter === c ? "#c3a782" : T.border}` }}>{c} ({count})</button>;
                })}
                {(() => {
                  const periods = Array.from(new Set(taxDocs.map(d => d.fiscal_period).filter(p => p)));
                  if (periods.length === 0) return null;
                  return (
                    <>
                      <span className="text-[11px] ml-3" style={{ color: T.textSub }}>期:</span>
                      <select value={docPeriodFilter} onChange={(e) => setDocPeriodFilter(e.target.value)} className="px-2 py-1 text-[10px] rounded-lg outline-none cursor-pointer" style={inputStyle}>
                        <option value="all">すべて</option>
                        {periods.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </>
                  );
                })()}
              </div>

              {/* 書類一覧 */}
              <div className="rounded-xl overflow-hidden" style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}>
                <div className="px-4 py-2.5 flex items-center justify-between" style={{ backgroundColor: T.cardAlt, borderBottom: gridBorder }}>
                  <span className="text-[12px] font-medium">📁 書類一覧</span>
                  <span className="text-[10px]" style={{ color: T.textFaint }}>
                    {(() => { const filtered = taxDocs.filter(d => (docFilter === "all" || d.category === docFilter) && (docPeriodFilter === "all" || d.fiscal_period === docPeriodFilter)); return `${filtered.length}件表示中`; })()}
                  </span>
                </div>
                <div style={{ maxHeight: 500, overflowY: "auto" }}>
                  <table className="w-full" style={{ fontSize: 12 }}>
                    <thead style={{ position: "sticky", top: 0, backgroundColor: T.cardAlt }}>
                      <tr style={{ color: T.textSub, fontSize: 11 }}>
                        <th style={{ padding: "6px 10px", textAlign: "center", width: 40, borderRight: gridBorder, borderBottom: gridBorder }}></th>
                        <th style={{ padding: "6px 10px", textAlign: "left", borderRight: gridBorder, borderBottom: gridBorder }}>カテゴリ</th>
                        <th style={{ padding: "6px 10px", textAlign: "left", borderRight: gridBorder, borderBottom: gridBorder }}>ファイル名</th>
                        <th style={{ padding: "6px 10px", textAlign: "left", borderRight: gridBorder, borderBottom: gridBorder }}>期</th>
                        <th style={{ padding: "6px 10px", textAlign: "left", borderRight: gridBorder, borderBottom: gridBorder }}>備考</th>
                        <th style={{ padding: "6px 10px", textAlign: "left", borderRight: gridBorder, borderBottom: gridBorder }}>アップ者</th>
                        <th style={{ padding: "6px 10px", textAlign: "left", borderRight: gridBorder, borderBottom: gridBorder }}>アップ日</th>
                        <th style={{ padding: "6px 10px", textAlign: "right", borderRight: gridBorder, borderBottom: gridBorder }}>サイズ</th>
                        <th style={{ padding: "6px 10px", textAlign: "center", borderBottom: gridBorder, width: 120 }}>操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const filtered = taxDocs.filter(d => (docFilter === "all" || d.category === docFilter) && (docPeriodFilter === "all" || d.fiscal_period === docPeriodFilter));
                        if (filtered.length === 0) return <tr><td colSpan={9} style={{ padding: "24px", textAlign: "center", color: T.textFaint, fontSize: 11 }}>書類が登録されていません</td></tr>;
                        const catColors: Record<string, string> = { "決算書": "#c3a782", "申告書": "#85a8c4", "契約書": "#7ab88f", "固定資産": "#a885c4", "支払調書": "#e091a8", "その他": "#888780" };
                        return filtered.map((d, i) => (
                          <tr key={d.id} style={{ borderTop: gridBorder, backgroundColor: i % 2 === 0 ? "transparent" : T.cardAlt + "40" }}>
                            <td style={{ padding: "5px 10px", textAlign: "center", color: T.textFaint, fontSize: 10, borderRight: gridBorder }}>{i + 1}</td>
                            <td style={{ padding: "5px 10px", borderRight: gridBorder }}>
                              <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ backgroundColor: (catColors[d.category] || "#888") + "22", color: catColors[d.category] || "#888" }}>{d.category}</span>
                            </td>
                            <td style={{ padding: "5px 10px", borderRight: gridBorder, maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={d.file_name}>{d.file_name}</td>
                            <td style={{ padding: "5px 10px", borderRight: gridBorder, color: T.textSub, fontSize: 11 }}>{d.fiscal_period || "—"}</td>
                            <td style={{ padding: "5px 10px", borderRight: gridBorder, color: T.textMuted, fontSize: 10, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={d.notes}>{d.notes || ""}</td>
                            <td style={{ padding: "5px 10px", borderRight: gridBorder, color: T.textMuted, fontSize: 11 }}>{d.uploaded_by_name || "—"}</td>
                            <td style={{ padding: "5px 10px", borderRight: gridBorder, color: T.textMuted, fontSize: 11, fontVariantNumeric: "tabular-nums" }}>{d.created_at?.slice(0, 10) || "—"}</td>
                            <td style={{ padding: "5px 10px", textAlign: "right", fontVariantNumeric: "tabular-nums", color: T.textSub, borderRight: gridBorder, fontSize: 11 }}>{((d.file_size || 0) / 1024).toFixed(0)}KB</td>
                            <td style={{ padding: "5px 10px", textAlign: "center" }}>
                              <a href={d.file_url} target="_blank" rel="noopener noreferrer" className="text-[10px] px-2 py-1 rounded cursor-pointer mr-1" style={{ backgroundColor: "#85a8c418", color: "#85a8c4", textDecoration: "none" }}>📄 開く</a>
                              <button onClick={() => deleteDoc(d)} className="text-[10px] px-2 py-1 rounded cursor-pointer" style={{ backgroundColor: "#c4555518", color: "#c45555", border: "none" }}>🗑</button>
                            </td>
                          </tr>
                        ));
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-xl p-4" style={{ backgroundColor: "#85a8c410", border: "1px solid #85a8c433" }}>
                <p className="text-[11px] font-medium mb-1" style={{ color: "#85a8c4" }}>💡 書類庫の使い方</p>
                <p className="text-[11px] leading-relaxed" style={{ color: T.textSub }}>
                  税理士・社長・経営責任者のみアップロード/閲覧/削除が可能です。<br/>
                  <strong>アップ時のコツ:</strong> カテゴリと「期（例：第3期）」を入れておくと、後で検索しやすくなります。<br/>
                  <strong>セキュリティ:</strong> ファイル名はUUIDでランダム化されて保存されます。書類庫画面にアクセスできない人はURLも推測できません。<br/>
                  <strong>保存容量:</strong> 1ファイル最大20MB。大きな書類はZIP圧縮してからアップしてください。
                </p>
              </div>
            </div>
          )}

          {/* ── Sheet: 年間スケジュール（Phase 2C） ── */}
          {sheet === "schedule" && (
            <div className="rounded-xl p-10 text-center animate-[fadeIn_0.3s]" style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}>
              <div className="text-[48px] mb-3">🚧</div>
              <p className="text-[14px] font-medium mb-2">Phase 2Cで実装予定</p>
              <p className="text-[11px]" style={{ color: T.textMuted }}>年間税務スケジュール（3月決算ベース）</p>
              <p className="text-[10px] mt-3" style={{ color: T.textFaint }}>
                現状の /tax-dashboard（バックオフィス）に類似機能があります。次のPhaseで統合予定です。
              </p>
            </div>
          )}

        </div>
      </div>

      {/* ── Bottom Sheet Tabs（エクセル風） ── */}
      <div className="flex-shrink-0 border-t flex items-stretch overflow-x-auto" style={{ borderColor: T.border, backgroundColor: T.cardAlt }}>
        {[
          { k: "summary" as SheetKey, l: "月次サマリー", icon: "📊", ready: true },
          { k: "sales" as SheetKey, l: "売上", icon: "💰", ready: true },
          { k: "expense" as SheetKey, l: "経費", icon: "💸", ready: true },
          { k: "therapist" as SheetKey, l: "セラピスト支払・源泉", icon: "👥", ready: true },
          { k: "invoice" as SheetKey, l: "インボイス", icon: "🧾", ready: true },
          { k: "schedule" as SheetKey, l: "年間スケジュール", icon: "📅", ready: false },
          { k: "docs" as SheetKey, l: "書類庫", icon: "📁", ready: true },
        ].map(t => {
          const active = sheet === t.k;
          return (
            <button
              key={t.k}
              onClick={() => setSheet(t.k)}
              className="px-5 py-2.5 text-[11px] cursor-pointer whitespace-nowrap transition-colors flex items-center gap-1.5"
              style={{
                backgroundColor: active ? T.card : "transparent",
                color: active ? T.text : t.ready ? T.textSub : T.textFaint,
                borderTop: active ? "2px solid #c3a782" : "2px solid transparent",
                borderRight: `1px solid ${T.border}`,
                fontWeight: active ? 500 : 400,
              }}
            >
              <span>{t.icon}</span>
              <span>{t.l}</span>
              {!t.ready && <span className="text-[8px] px-1 py-0.5 rounded" style={{ backgroundColor: T.cardAlt, color: T.textFaint }}>P2</span>}
            </button>
          );
        })}
      </div>

      <style jsx global>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  );
}
