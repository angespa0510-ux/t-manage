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

const ACCOUNT_MAP: Record<string, string> = {
  rent: "地代家賃", utilities: "水道光熱費", supplies: "消耗品費",
  transport: "旅費交通費", advertising: "広告宣伝費", therapist_back: "外注費",
  income: "売上高（入金）", other: "雑費",
};

const fmt = (n: number) => "¥" + (n || 0).toLocaleString();
const fmtN = (n: number) => (n || 0).toLocaleString();

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
  const [companyName, setCompanyName] = useState("合同会社テラスライフ");
  const [fiscalMonth, setFiscalMonth] = useState(3);

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
  }, [viewMode, selectedMonth, selectedYear, smYear, smMonth]);

  useEffect(() => { if (canAccessTaxPortal) fetchData(); }, [fetchData, canAccessTaxPortal]);

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
                  Phase 1 現在、月次サマリーと売上明細が利用可能です。Phase 2では経費・セラピスト支払・源泉徴収・インボイス集計・年間スケジュール・書類庫・会計ソフト出力（弥生/freee/MFクラウド）を実装予定。
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

          {/* ── Sheet: その他のタブ（Phase 2以降） ── */}
          {(sheet === "expense" || sheet === "therapist" || sheet === "invoice" || sheet === "schedule" || sheet === "docs") && (
            <div className="rounded-xl p-10 text-center animate-[fadeIn_0.3s]" style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}>
              <div className="text-[48px] mb-3">🚧</div>
              <p className="text-[14px] font-medium mb-2">Phase 2で実装予定</p>
              <p className="text-[11px]" style={{ color: T.textMuted }}>
                {sheet === "expense" && "経費明細・勘定科目別の詳細表示"}
                {sheet === "therapist" && "セラピスト支払・源泉徴収集計（204条1項6号・5000円控除対応）"}
                {sheet === "invoice" && "インボイス登録状況・2割特例控除集計"}
                {sheet === "schedule" && "年間税務スケジュール（3月決算ベース）"}
                {sheet === "docs" && "書類庫（決算書・申告書・契約書のアップ・DL）"}
              </p>
              <p className="text-[10px] mt-3" style={{ color: T.textFaint }}>
                現状の /tax-dashboard（バックオフィス）に類似機能があります。Phase 2でこのポータルに統合予定です。
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
          { k: "expense" as SheetKey, l: "経費", icon: "💸", ready: false },
          { k: "therapist" as SheetKey, l: "セラピスト支払・源泉", icon: "👥", ready: false },
          { k: "invoice" as SheetKey, l: "インボイス", icon: "🧾", ready: false },
          { k: "schedule" as SheetKey, l: "年間スケジュール", icon: "📅", ready: false },
          { k: "docs" as SheetKey, l: "書類庫", icon: "📁", ready: false },
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
