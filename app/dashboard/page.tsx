"use client";

import { useState, useEffect, useCallback, useRef, lazy, Suspense } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";
import { useTheme } from "../../lib/theme";
import { NavMenu } from "../../lib/nav-menu";
import { useStaffSession } from "../../lib/staff-session";
import { usePinKeyboard } from "../../lib/use-pin-keyboard";
import { useBackNav } from "../../lib/use-back-nav";
import { useConfirm } from "../../components/useConfirm";
import { runAutoSettlementIfDue } from "../../lib/staff-advances";
import { calcSettlementRounding } from "../../lib/settlement-calc";
import { useToast } from "../../lib/toast";
const CustomerImportPanel = lazy(() => import("../../lib/customer-import-panel"));
const NgImportPanel = lazy(() => import("../../lib/ng-import-panel"));

type Customer = {
  id: number; created_at: string; name: string; self_name: string; phone: string; phone2: string; phone3: string;
  email: string; notes: string; user_id: string; rank: string; birthday: string; mypage_registered_at: string;
  login_email: string; login_password: string;
};
type Visit = {
  id: number; customer_id: number; date: string; start_time: string; end_time: string;
  therapist_id: number; store_id: number; course_name: string; price: number;
  therapist_back: number; nomination: string; options: string; discount: number;
  total: number; payment_method: string; notes: string;
};
type Therapist = { id: number; name: string; status: string };
type Store = { id: number; name: string };
type Course = { id: number; name: string; duration: number; price: number; therapist_back: number };
type CustomerNote = { id: number; therapist_id: number; customer_name: string; note: string; is_ng: boolean; ng_reason: string; rating: number };

const RANKS: Record<string, { label: string; color: string; bg: string; desc: string }> = {
  banned: { label: "出禁", color: "#c45555", bg: "#c4555518", desc: "一切当店の利用を禁止" },
  caution: { label: "要注意", color: "#f59e0b", bg: "#f59e0b18", desc: "予約を取る際は注意" },
  normal: { label: "普通", color: "#888780", bg: "#88878018", desc: "デフォルト" },
  good: { label: "善良", color: "#4a7c59", bg: "#4a7c5918", desc: "とても良いお客様" },
};

const normPhone = (p: string) => p.replace(/[-\s\u3000()（）\u2010-\u2015\uff0d]/g, "");

const menuItems = [
  { label: "HOME", icon: "home", sub: [] },
  { label: "営業締め", icon: "clipboard", sub: [] },
  { label: "顧客管理", icon: "users", sub: ["顧客一覧", "顧客登録", "ポイント管理"] },
  { label: "予約管理", icon: "calendar", sub: ["タイムチャート", "オーダー一覧", "SMS送信履歴一覧"] },
  { label: "勤怠管理", icon: "clock", sub: ["セラピスト勤怠", "スタッフ勤怠", "部屋割り管理"] },
  { label: "売上分析", icon: "chart", sub: ["年別分析", "月別分析", "日別分析"] },
  { label: "面接管理", icon: "clipboard", sub: ["面接管理"] },
  { label: "メッセージ", icon: "mail", sub: [] },
  { label: "設定", icon: "settings", sub: ["セラピスト登録", "スタッフ登録", "コース登録", "利用場所登録", "指名登録", "延長登録", "オプション登録", "割引登録", "営業時間設定"] },
];

function Icon({ name, size = 18 }: { name: string; size?: number }) {
  const p = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (name) {
    case "home": return <svg {...p}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>;
    case "users": return <svg {...p}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
    case "calendar": return <svg {...p}><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>;
    case "clock": return <svg {...p}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;
    case "chart": return <svg {...p}><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>;
    case "clipboard": return <svg {...p}><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>;
    case "mail": return <svg {...p}><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 7l-10 6L2 7"/></svg>;
    case "settings": return <svg {...p}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>;
    default: return null;
  }
}

export default function Dashboard() {
  const router = useRouter();
  const { dark, toggle, T } = useTheme();
  const { activeStaff, isManager, login, logout: staffLogout } = useStaffSession();
  const { confirm, ConfirmModalNode } = useConfirm();
  const toast = useToast();
  const [showPinModal, setShowPinModal] = useState(false);
  usePinKeyboard(showPinModal);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState("");
  const [userId, setUserId] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [openMenus, setOpenMenus] = useState<string[]>(["HOME"]);
  const [activePage, setActivePage] = useState("HOME");
  useEffect(() => { const params = new URLSearchParams(window.location.search); const p = params.get("page"); if (p) setActivePage(p); const d = params.get("date"); if (d) setClosingDate(d); const s = params.get("search"); if (s) { setActivePage("顧客一覧"); setSearchQuery(s); } if (params.get("openSafe")) { (async () => { setShowSafeList(true); const { data: rooms2 } = await supabase.from("rooms").select("*"); const { data: blds2 } = await supabase.from("buildings").select("*"); const { data: thList2 } = await supabase.from("therapists").select("id,name"); const getName2 = (id: number) => (thList2 || []).find((t: any) => t.id === id)?.name || "不明"; const { data: sf } = await supabase.from("therapist_daily_settlements").select("*").eq("safe_deposited", true).is("safe_collected_date", null); const items: typeof safeUncollected = []; for (const s of (sf || [])) { const rm = (rooms2 || []).find((r: any) => r.id === s.room_id); const bl = rm ? (blds2 || []).find((b: any) => b.id === rm.building_id) : null; const { data: rep } = await supabase.from("room_cash_replenishments").select("amount").eq("room_id", s.room_id).eq("date", s.date); const repAmt = (rep || []).reduce((sum: number, r: any) => sum + r.amount, 0); items.push({ id: s.id, date: s.date, total_cash: s.total_cash || 0, final_payment: s.final_payment || 0, room_id: s.room_id, therapist_name: getName2(s.therapist_id), room_label: (bl?.name || "") + (rm?.name || ""), replenish: repAmt }); } setSafeUncollected(items); const { data: sfH } = await supabase.from("therapist_daily_settlements").select("*").eq("safe_deposited", true).not("safe_collected_date", "is", null).order("safe_collected_date", { ascending: false }).limit(20); const hItems: typeof safeHistory = []; for (const s of (sfH || [])) { const rm = (rooms2 || []).find((r: any) => r.id === s.room_id); const bl = rm ? (blds2 || []).find((b: any) => b.id === rm.building_id) : null; const { data: rep } = await supabase.from("room_cash_replenishments").select("amount").eq("room_id", s.room_id).eq("date", s.date); const repAmt = (rep || []).reduce((sum: number, r: any) => sum + r.amount, 0); hItems.push({ id: s.id, date: s.date, total_cash: s.total_cash || 0, final_payment: s.final_payment || 0, room_id: s.room_id, therapist_name: getName2(s.therapist_id), room_label: (bl?.name || "") + (rm?.name || ""), replenish: repAmt, safe_collected_date: s.safe_collected_date }); } setSafeHistory(hItems); })(); } }, []);
  useEffect(() => { const h = (e: Event) => setActivePage((e as CustomEvent).detail); window.addEventListener("dashboardPage", h); return () => window.removeEventListener("dashboardPage", h); }, []);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [storesList, setStoresList] = useState<Store[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [closingDate, setClosingDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [closingData, setClosingData] = useState<any>(null);
  const [closingLoading, setClosingLoading] = useState(false);
  const [showSafeList, setShowSafeList] = useState(false);
  const [safeUncollected, setSafeUncollected] = useState<{ id: number; date: string; total_cash: number; final_payment: number; room_id: number; therapist_name: string; room_label: string; replenish: number }[]>([]);
  const [safeHistory, setSafeHistory] = useState<{ id: number; date: string; total_cash: number; final_payment: number; room_id: number; therapist_name: string; room_label: string; replenish: number; safe_collected_date: string }[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterRank, setFilterRank] = useState<string>("all");
  const [custStats, setCustStats] = useState<Record<number, { visitCount: number; lastVisit: string; pointBalance: number }>>({});
  const [custMemoStats, setCustMemoStats] = useState<Record<string, { count: number; hasNg: boolean }>>({});

  // NG登録
  const [showNgRegister, setShowNgRegister] = useState(false);
  const [showCustImport, setShowCustImport] = useState(false);
  const [custListView, setCustListView] = useState<"list" | "cancelHistory">("list");
  const [allCancelledRes, setAllCancelledRes] = useState<{id:number;date:string;start_time:string;end_time:string;course:string;therapist_id:number;total_price:number;notes:string;customer_name:string}[]>([]);
  const [showNgImport, setShowNgImport] = useState(false);
  const [ngCustSearch, setNgCustSearch] = useState("");
  const [ngSelectedCust, setNgSelectedCust] = useState<Customer | null>(null);
  const [ngTherapistId, setNgTherapistId] = useState(0);
  const [ngReason, setNgReason] = useState("");
  const [ngSaving, setNgSaving] = useState(false);
  const [ngMsg, setNgMsg] = useState("");

  const registerNg = async () => {
    if (!ngSelectedCust || !ngTherapistId) { setNgMsg("お客様とセラピストを選択してください"); return; }
    setNgSaving(true); setNgMsg("");
    const { data: existing } = await supabase.from("therapist_customer_notes").select("id,is_ng").eq("customer_name", ngSelectedCust.name).eq("therapist_id", ngTherapistId).maybeSingle();
    if (existing) {
      await supabase.from("therapist_customer_notes").update({ is_ng: true, ng_reason: ngReason }).eq("id", existing.id);
    } else {
      await supabase.from("therapist_customer_notes").insert({ customer_name: ngSelectedCust.name, therapist_id: ngTherapistId, is_ng: true, ng_reason: ngReason, note: "", rating: 0 });
    }
    // 自動ランク判定
    const { data: ngNotes } = await supabase.from("therapist_customer_notes").select("therapist_id").eq("customer_name", ngSelectedCust.name).eq("is_ng", true);
    const { data: activeTh } = await supabase.from("therapists").select("id").eq("status", "active");
    const activeIds = new Set((activeTh || []).map(t => t.id));
    const activeNgCount = (ngNotes || []).filter(n => activeIds.has(n.therapist_id)).length;
    let newRank: string | null = null;
    if (activeNgCount >= 5) newRank = "banned";
    else if (activeNgCount >= 3) newRank = "caution";
    if (newRank && ngSelectedCust) {
      const { data: cust } = await supabase.from("customers").select("id,rank").eq("name", ngSelectedCust.name).maybeSingle();
      if (cust && cust.rank !== "banned") { await supabase.from("customers").update({ rank: newRank }).eq("id", cust.id); }
    }
    setNgSaving(false);
    const thName = therapists.find(t => t.id === ngTherapistId)?.name || "";
    setNgMsg(`✅ ${ngSelectedCust.name} 様を ${thName} のNGに登録しました${newRank ? ` → ランク: ${newRank === "banned" ? "出禁" : "要注意"}に自動変更` : ""}`);
    setNgTherapistId(0); setNgReason("");
    fetchCustomers();
  };

  // Register
  const [custName, setCustName] = useState(""); const [custSelfName, setCustSelfName] = useState(""); const [custPhone, setCustPhone] = useState(""); const [custPhone2, setCustPhone2] = useState(""); const [custPhone3, setCustPhone3] = useState("");

  const [custEmail, setCustEmail] = useState(""); const [custNotes, setCustNotes] = useState(""); const [custRank, setCustRank] = useState("normal"); const [custBirthday, setCustBirthday] = useState("");
  const [saving, setSaving] = useState(false); const [saveMsg, setSaveMsg] = useState("");

  // Edit
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [editName, setEditName] = useState(""); const [editSelfName, setEditSelfName] = useState(""); const [editPhone, setEditPhone] = useState(""); const [editPhone2, setEditPhone2] = useState(""); const [editPhone3, setEditPhone3] = useState("");
  const [editEmail, setEditEmail] = useState(""); const [editNotes, setEditNotes] = useState(""); const [editRank, setEditRank] = useState("normal"); const [editBirthday, setEditBirthday] = useState("");
  const [editSaving, setEditSaving] = useState(false); const [editMsg, setEditMsg] = useState("");

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null); const [deleting, setDeleting] = useState(false);

  // Merge
  const [mergeSource, setMergeSource] = useState<Customer | null>(null);
  const [mergeTargetId, setMergeTargetId] = useState<number>(0);
  const [mergeSearch, setMergeSearch] = useState("");
  const [merging, setMerging] = useState(false);
  const [mergeMsg, setMergeMsg] = useState("");

  // Monthly back rate
  type MonthlyResult = { therapist_id: number; name: string; sessions: number; nom_sessions: number; nom_rate: number; absences: number; lates: number; early_leaves: number; work_days: number; back_increase: number; prev_increase: number; salary_type: string };
  const [monthlyResults, setMonthlyResults] = useState<MonthlyResult[]>([]);
  const [showMonthlyModal, setShowMonthlyModal] = useState(false);
  const [monthlyTarget, setMonthlyTarget] = useState("");
  const [monthlyCalculated, setMonthlyCalculated] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  // Detail / History
  const [detailCustomer, setDetailCustomer] = useState<Customer | null>(null);
  const [custPoints, setCustPoints] = useState<{id:number;amount:number;type:string;description:string;expires_at:string;created_at:string}[]>([]);
  const [manualPt, setManualPt] = useState("");
  const [manualPtDesc, setManualPtDesc] = useState("");
  const [ptSaving, setPtSaving] = useState(false);
  const [ptData, setPtData] = useState<{customer_id:number;name:string;rank:string;balance:number;total_earned:number;total_used:number}[]>([]);
  const [ptLoading, setPtLoading] = useState(false);
  const [ptSort, setPtSort] = useState<"balance"|"earned"|"used">("balance");

  // マウス戻るボタン対応: モーダル → ページ切替 → 前のページ
  useBackNav(activePage, setActivePage, [
    { isOpen: !!detailCustomer, close: () => setDetailCustomer(null) },
    { isOpen: !!editingCustomer, close: () => setEditingCustomer(null) },
    { isOpen: showSafeList, close: () => setShowSafeList(false) },
    { isOpen: showMonthlyModal, close: () => setShowMonthlyModal(false) },
    { isOpen: showNgRegister, close: () => setShowNgRegister(false) },
    { isOpen: showCustImport, close: () => setShowCustImport(false) },
    { isOpen: showNgImport, close: () => setShowNgImport(false) },
    { isOpen: !!deleteTarget, close: () => setDeleteTarget(null) },
  ]);

  useEffect(() => {
    if (activePage !== "ポイント管理") return;
    setPtLoading(true);
    (async () => {
      const { data: allPts } = await supabase.from("customer_points").select("customer_id,amount,type");
      const { data: custs } = await supabase.from("customers").select("id,name,rank");
      if (allPts && custs) {
        const map = new Map<number, {balance:number;earned:number;used:number}>();
        allPts.forEach(p => {
          const e = map.get(p.customer_id) || {balance:0,earned:0,used:0};
          e.balance += p.amount;
          if (p.amount > 0) e.earned += p.amount; else e.used += Math.abs(p.amount);
          map.set(p.customer_id, e);
        });
        const rows = custs.filter(c => map.has(c.id)).map(c => {
          const e = map.get(c.id)!;
          return { customer_id: c.id, name: c.name, rank: c.rank || "normal", balance: e.balance, total_earned: e.earned, total_used: e.used };
        });
        setPtData(rows);
      }
      setPtLoading(false);
    })();
  }, [activePage]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [cancelledRes, setCancelledRes] = useState<{id:number;date:string;start_time:string;end_time:string;course:string;therapist_id:number;total_price:number;notes:string;customer_name:string}[]>([]);
  const [customerNotes, setCustomerNotes] = useState<CustomerNote[]>([]);
  const [showAddVisit, setShowAddVisit] = useState(false);
  const [vDate, setVDate] = useState(""); const [vStart, setVStart] = useState("12:00"); const [vEnd, setVEnd] = useState("13:00");
  const [vTherapistId, setVTherapistId] = useState(0); const [vStoreId, setVStoreId] = useState(0);
  const [vCourseId, setVCourseId] = useState(0); const [vNomination, setVNomination] = useState(""); const [vOptions, setVOptions] = useState("");
  const [vDiscount, setVDiscount] = useState("0"); const [vPayment, setVPayment] = useState(""); const [vNotes, setVNotes] = useState("");
  const [vSaving, setVSaving] = useState(false);

  const fetchClosingReport = useCallback(async (date: string) => {
    setClosingLoading(true);

    // 健康診断レポート 2026-04-26 「重要度: 高 - fetchClosingReport の全クエリでエラー未チェック」対応。
    // 旧式は { data } のみを destructure して error を破棄していたため、Supabase 障害時に
    // 空配列で続行 → 売上 0 円・支給額 0 円のレポートが出力されて誤った経営判断につながる
    // リスクがあった。expectOk で error を throw → try/catch で toast 通知して中断する。
    const expectOk = async <R,>(
      promise: PromiseLike<{ data: R | null; error: any }>,
      label: string,
    ): Promise<R | null> => {
      const { data, error } = await promise;
      if (error) throw new Error(`[${label}] ${error.message || "クエリ失敗"}`);
      return data;
    };

    try {
      // ─── 第1群: 当日データ + マスタ (12 件並列) ───
      const [
        res, settlements, exp, rooms, blds, repData, crs, ra, thList,
        nomData, optData, extData,
      ] = await Promise.all([
        expectOk<any[]>(supabase.from("reservations").select("*").eq("date", date), "reservations"),
        expectOk<any[]>(supabase.from("therapist_daily_settlements").select("*").eq("date", date), "therapist_daily_settlements(date)"),
        expectOk<any[]>(supabase.from("expenses").select("*").eq("date", date), "expenses"),
        expectOk<any[]>(supabase.from("rooms").select("*"), "rooms"),
        expectOk<any[]>(supabase.from("buildings").select("*"), "buildings"),
        expectOk<any[]>(supabase.from("room_cash_replenishments").select("*").eq("date", date), "room_cash_replenishments"),
        expectOk<any[]>(supabase.from("courses").select("*"), "courses"),
        expectOk<any[]>(supabase.from("room_assignments").select("*").eq("date", date), "room_assignments"),
        expectOk<any[]>(supabase.from("therapists").select("id,name,status"), "therapists"),
        expectOk<any[]>(supabase.from("nominations").select("*"), "nominations"),
        expectOk<any[]>(supabase.from("options").select("*"), "options"),
        expectOk<any[]>(supabase.from("extensions").select("*"), "extensions"),
      ]);

      const allRes = res || [];
      const completed = allRes.filter(r => (r as any).status === "completed");
      const getCourseByName = (name: string) => (crs || []).find((c: any) => c.name === name);
      const getThName = (id: number) => (thList || []).find((t: any) => t.id === id)?.name || "不明";
      // 売上サマリー
      const totalSales = completed.reduce((s, r) => s + ((r as any).total_price || 0), 0);
      // 売上内訳
      const totalCoursePrice = completed.reduce((s, r) => { const c = getCourseByName(r.course); return s + ((c as any)?.price || 0); }, 0);
      const totalNom = completed.reduce((s, r) => s + ((r as any).nomination_fee || 0), 0);
      const totalOpt = completed.reduce((s, r) => s + ((r as any).options_total || 0), 0);
      const totalExt = completed.reduce((s, r) => s + ((r as any).extension_price || 0), 0);
      const totalDisc = completed.reduce((s, r) => s + ((r as any).discount_amount || 0), 0);
      // 支払い方法別
      const totalCard = completed.reduce((s, r) => s + ((r as any).card_billing || 0), 0);
      const totalPaypay = completed.reduce((s, r) => s + ((r as any).paypay_amount || 0), 0);
      const totalCashSales = completed.reduce((s, r) => s + ((r as any).cash_amount || 0), 0);
      // セラピスト支払い（バック内訳）
      const totalCourseBack = completed.reduce((s, r) => { const c = getCourseByName(r.course); return s + ((c as any)?.therapist_back || 0); }, 0);
      // 健康診断レポート 2026-04-26 Fix #5: 旧式 `nom.therapist_back || nomination_fee || 0` の
      // 過払いリスクを options/extensions と同じ `|| 0` 形式に統一。
      const totalNomBack = completed.reduce((s, r) => { const nom = (nomData || []).find((n: any) => n.name === (r as any).nomination); return s + ((nom as any)?.therapist_back || 0); }, 0);
      const totalOptBack = completed.reduce((s, r) => { const optNames = ((r as any).options_text || "").split(",").filter((n: string) => n); return s + optNames.reduce((os: number, n: string) => { const o = (optData || []).find((x: any) => x.name === n); return os + ((o as any)?.therapist_back || 0); }, 0); }, 0);
      const totalExtBack = completed.reduce((s, r) => { const ex = (extData || []).find((x: any) => x.name === (r as any).extension_name); return s + ((ex as any)?.therapist_back || 0); }, 0);
      const totalBack = totalCourseBack + totalNomBack + totalOptBack + totalExtBack;
      // 清算データから実支給額
      const settledList2 = settlements || [];
      const totalFinalPay = settledList2.reduce((s: number, d: any) => s + (d.final_payment || 0), 0);
      const totalInvoiceDed = settledList2.reduce((s: number, d: any) => s + (d.invoice_deduction || 0), 0);
      const totalWithholding = settledList2.reduce((s: number, d: any) => s + (d.withholding_tax || 0), 0);
      const totalWelfare = settledList2.reduce((s: number, d: any) => s + (d.welfare_fee || 0), 0);
      const totalTransportSettle = settledList2.reduce((s: number, d: any) => s + (d.transport_fee || 0), 0);
      // 💝 投げ銭バック合計（gift_bonus_amount は精算時に final_payment に込まれている）
      const totalGiftBack = settledList2.reduce((s: number, d: any) => s + (d.gift_bonus_amount || 0), 0);
      // 100円切上による端数集計（旧式は adjustment が抜けて adjustment 分過大になっていたため
      // SSOT helper calcSettlementRounding で統一）
      const totalRounding = settledList2.reduce((s: number, d: any) => s + calcSettlementRounding(d), 0);
      // 釣銭補充（明細付き）
      const replenishList = (repData || []).map((r: any) => {
        const rm = (rooms || []).find((x: any) => x.id === r.room_id);
        const bl2 = rm ? (blds || []).find((b: any) => b.id === rm.building_id) : null;
        const bldName = bl2?.name || "";
        const thName = r.therapist_id ? getThName(r.therapist_id) : "";
        return { id: r.id, room: `${bldName}${rm?.name || ""}`, therapist: thName, staff: r.staff_name || "", amount: r.amount || 0, time: r.created_at ? new Date(r.created_at).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" }) : "" };
      });
      const totalReplenish = replenishList.reduce((s: number, r: any) => s + r.amount, 0);
      // 経費・入金
      const expenseList = (exp || []).filter((e: any) => e.type === "expense");
      const expenseTotal = expenseList.reduce((s: number, e: any) => s + (e.amount || 0), 0);
      const incomeList = (exp || []).filter((e: any) => e.type === "income");
      const incomeTotal = incomeList.reduce((s: number, e: any) => s + (e.amount || 0), 0);
      // 本日の収支
      const netProfit = totalSales - totalFinalPay - expenseTotal + incomeTotal;
      // 現金確認シート
      const settledList = settlements || [];
      const therapistData = [...new Set(completed.map(r => r.therapist_id))].map(tid => {
        const tRes = completed.filter(r => r.therapist_id === tid);
        const tCash = tRes.reduce((s, r) => s + ((r as any).cash_amount || 0), 0);
        const tBack = tRes.reduce((s, r) => { const c = getCourseByName(r.course); return s + ((c as any)?.therapist_back || 0); }, 0);
        const assign = (ra || []).find((a: any) => a.therapist_id === tid);
        const ds = settledList.find((s: any) => s.therapist_id === tid);
        const roomId = (ds && ds.room_id > 0) ? ds.room_id : (assign ? assign.room_id : 0);
        const rm = roomId > 0 ? (rooms || []).find((r: any) => r.id === roomId) : null;
        const bl = rm ? (blds || []).find((b: any) => b.id === rm.building_id) : null;
        const bldName = bl?.name || "";
        const rmName = rm?.name || "";
        const finalPay = ds?.final_payment || 0;
        const reserveUsed = ds?.reserve_used_amount || 0;  // 豊橋予備金からの立替額
        const roomReplenish = assign ? replenishList.filter((r: any) => (rooms || []).find((x: any) => x.id === assign.room_id)?.id === r.id ? false : true, []).length >= 0 ? (repData || []).filter((r: any) => r.room_id === assign.room_id).reduce((s2: number, r2: any) => s2 + (r2.amount || 0), 0) : 0 : 0;
        // 売上残 = お客様現金 - セラピスト支払 + 予備金立替 (予備金で補充された分は実質0)
        const netAfterPay = tCash - finalPay + reserveUsed;
        return { id: tid, name: getThName(tid), room: `${bldName}${rmName}`, cash: tCash, back: tBack, finalPay, replenish: roomReplenish, netAfterPay, net: tCash - finalPay + reserveUsed, reserveUsed, salesCollected: !!ds?.sales_collected, changeCollected: !!ds?.change_collected, safeDeposited: !!ds?.safe_deposited };
      });
      const totalOut = totalReplenish + expenseTotal;
      const staffCollectedAmt = therapistData.filter(t => t.salesCollected && !t.safeDeposited).reduce((s, t) => s + (t.changeCollected ? t.replenish : 0) + t.netAfterPay, 0);
      const safeDepositedAmt = therapistData.filter(t => t.salesCollected && t.safeDeposited).reduce((s, t) => s + (t.changeCollected ? t.replenish : 0) + t.netAfterPay, 0);
      const totalUncollected = therapistData.filter(t => !t.salesCollected).reduce((s, t) => s + t.replenish + t.netAfterPay, 0);
      const totalChangeUncollected = therapistData.filter(t => t.salesCollected && !t.changeCollected).reduce((s, t) => s + t.replenish, 0);

      // ─── 第2群: スタッフ前借り関連 (5 件並列) ───
      const [advRows, staffAll, todaySchs, eligibleStaff, skippedRows] = await Promise.all([
        expectOk<any[]>(
          supabase.from("staff_advances").select("id,staff_id,amount,reason,status").eq("advance_date", date).eq("status", "pending"),
          "staff_advances(pending)"
        ),
        expectOk<any[]>(supabase.from("staff").select("id,name"), "staff"),
        expectOk<any[]>(supabase.from("staff_schedules").select("staff_id").eq("date", date), "staff_schedules"),
        expectOk<any[]>(
          supabase.from("staff").select("id,name,advance_preset_amount").eq("status", "active").gt("advance_preset_amount", 0),
          "staff(eligible)"
        ),
        expectOk<any[]>(
          supabase.from("staff_advances").select("staff_id").eq("advance_date", date).eq("status", "skipped"),
          "staff_advances(skipped)"
        ),
      ]);

      const getStaffName = (id: number) => (staffAll || []).find((s: any) => s.id === id)?.name || "不明";
      const staffAdvanceList = (advRows || []).map((a: any) => ({
        id: a.id, staff_id: a.staff_id, name: getStaffName(a.staff_id), amount: a.amount, reason: a.reason || "",
      }));
      const staffAdvanceTotal = staffAdvanceList.reduce((s: number, a: any) => s + a.amount, 0);

      // 前借り未記録チェック (本日出勤予定で preset>0 かつ pending/skipped 未記録のスタッフ)
      const todayWorkingIds = new Set((todaySchs || []).map((s: any) => s.staff_id));
      const recordedIds = new Set(staffAdvanceList.map((a: any) => a.staff_id));
      const skippedIds = new Set((skippedRows || []).map((s: any) => s.staff_id));
      const unrecordedAdvanceList = (eligibleStaff || [])
        .filter((s: any) => todayWorkingIds.has(s.id))
        .filter((s: any) => !recordedIds.has(s.id) && !skippedIds.has(s.id))
        .map((s: any) => ({ id: s.id, name: s.name, preset: s.advance_preset_amount }));

      const cashOnHand = -totalReplenish - expenseTotal + incomeTotal + staffCollectedAmt - staffAdvanceTotal;

      // ─── 第3群: 金庫関連 (3 件並列) ───
      const [safeUncoll, safeCollToday, reserveMovements] = await Promise.all([
        expectOk<any[]>(
          supabase.from("therapist_daily_settlements").select("*").eq("safe_deposited", true).is("safe_collected_date", null),
          "therapist_daily_settlements(safe_uncollected)"
        ),
        expectOk<any[]>(
          supabase.from("therapist_daily_settlements").select("*").eq("safe_collected_date", date).eq("safe_deposited", true),
          "therapist_daily_settlements(safe_collected_today)"
        ),
        expectOk<any[]>(
          supabase.from("toyohashi_reserve_movements").select("movement_type,amount").lte("movement_date", date).range(0, 49999),
          "toyohashi_reserve_movements"
        ),
      ]);

      // 金庫未回収（金庫投函済み・未回収）
      const safeUncollectedList = (safeUncoll || []).map((s: any) => {
        const rm2 = (rooms || []).find((r: any) => r.id === s.room_id);
        const bl2 = rm2 ? (blds || []).find((b: any) => b.id === rm2.building_id) : null;
        return { date: s.date, therapist: getThName(s.therapist_id), room: `${bl2?.name || ""}${rm2?.name || ""}`, salesAmt: Math.max((s.total_cash || 0) - (s.final_payment || 0), 0), changeAmt: 0 };
      });
      // 各金庫投函の釣銭を取得 (N+1 だが、本ファイル外で個別最適化予定。エラー時は throw)
      for (const su of safeUncollectedList) {
        const roomMatch = (rooms || []).find((r: any) => su.room.includes(r.name || ""));
        if (roomMatch) {
          const repSafe = await expectOk<any[]>(
            supabase.from("room_cash_replenishments").select("amount").eq("room_id", roomMatch.id).eq("date", su.date),
            `room_cash_replenishments(safe_uncollected/${su.date})`
          );
          su.changeAmt = (repSafe || []).reduce((s2: number, r2: any) => s2 + (r2.amount || 0), 0);
        }
      }
      const safeTotalUncollected = safeUncollectedList.reduce((s: number, x: any) => s + x.salesAmt + x.changeAmt, 0);

      // 金庫回収分（本日回収）
      const safeCollectedTodayList: { date: string; therapist: string; room: string; amount: number }[] = [];
      for (const sc of (safeCollToday || [])) {
        const rm3 = (rooms || []).find((r: any) => r.id === sc.room_id);
        const bl3 = rm3 ? (blds || []).find((b: any) => b.id === rm3.building_id) : null;
        const net3 = Math.max((sc.total_cash || 0) - (sc.final_payment || 0), 0);
        const repSc = await expectOk<any[]>(
          supabase.from("room_cash_replenishments").select("amount").eq("room_id", sc.room_id).eq("date", sc.date),
          `room_cash_replenishments(safe_collected/${sc.id})`
        );
        const repAmt3 = (repSc || []).reduce((s2: number, r2: any) => s2 + (r2.amount || 0), 0);
        safeCollectedTodayList.push({ date: sc.date, therapist: getThName(sc.therapist_id), room: `${bl3?.name || ""}${rm3?.name || ""}`, amount: net3 + repAmt3 });
      }
      const safeCollectedTodayTotal = safeCollectedTodayList.reduce((s: number, x: any) => s + x.amount, 0);

      // 豊橋予備金使用額（本日、精算モーダルから立替された分）
      const reserveUsedList = settledList.filter((s: any) => (s.reserve_used_amount || 0) > 0).map((s: any) => ({
        therapist: getThName(s.therapist_id),
        amount: s.reserve_used_amount || 0
      }));
      const reserveUsedTotal = reserveUsedList.reduce((s: number, x: any) => s + x.amount, 0);

      // 豊橋予備金の残高（当日終了時点の累計）
      // initial + refund + adjustment − withdraw
      const toyohashiBalance = (reserveMovements || []).reduce((s: number, m: any) => {
        const amt = m.amount || 0;
        return m.movement_type === "withdraw" ? s - amt : s + amt;
      }, 0);

      // セラピスト別売上
      const therapistSales = [...new Set(completed.map(r => r.therapist_id))].map(tid => {
        const tRes = completed.filter(r => r.therapist_id === tid);
        const tSales = tRes.reduce((s, r) => s + ((r as any).total_price || 0), 0);
        const tBack = tRes.reduce((s, r) => { const c = getCourseByName(r.course); return s + ((c as any)?.therapist_back || 0); }, 0);
        const ds = settledList2.find((s: any) => s.therapist_id === tid);
        const tGiftBack = ds?.gift_bonus_amount || 0;
        return { name: getThName(tid), count: tRes.length, sales: tSales, back: tBack, giftBack: tGiftBack };
      });
      setClosingData({
        resCount: allRes.length, compCount: completed.length, totalSales,
        totalCoursePrice, totalNom, totalOpt, totalExt, totalDisc,
        totalCard, totalPaypay, totalCashSales,
        totalBack, totalCourseBack, totalNomBack, totalOptBack, totalExtBack, totalGiftBack, totalFinalPay, totalInvoiceDed, totalWithholding, totalWelfare, totalTransportSettle, totalRounding, totalReplenish, replenishList,
        expenseList, expenseTotal, incomeList, incomeTotal,
        netProfit, therapistData, totalOut,
        staffCollectedAmt, safeDepositedAmt, totalUncollected, cashOnHand,
        staffAdvanceList, staffAdvanceTotal, unrecordedAdvanceList,
        therapistSales, safeUncollectedList, safeTotalUncollected, safeCollectedTodayList, safeCollectedTodayTotal,
        reserveUsedList, reserveUsedTotal, toyohashiBalance,
      });
    } catch (err) {
      console.error("[fetchClosingReport]", err);
      const msg = err instanceof Error ? err.message : "不明なエラー";
      toast.show(`営業締めデータの取得に失敗しました。${msg}`, "error");
      // setClosingData は更新せず、前回値（または初期値）を維持して
      // 「取得失敗」と分かる状態のまま finally で loading を解除する
    } finally {
      setClosingLoading(false);
    }
  }, [toast]);

  // Auto-fetch closing report when date changes or page becomes active
  useEffect(() => {
    if (activePage === "営業締め") {
      fetchClosingReport(closingDate);
    }
  }, [closingDate, activePage, fetchClosingReport]);

  // 前借り月末自動精算チェック (dashboard 初回ロード時に一度だけ実行)
  // 健康診断レポート 2026-04-26 「重要度: 中 - サイレントエラー吞み込み」対応:
  // 旧式は .catch(() => {}) で完全無視 → 月末締めで自動精算が走らなかった日に気づけない。
  // console.error と toast 通知でユーザーが気づけるようにする。
  useEffect(() => {
    runAutoSettlementIfDue().catch((err) => {
      console.error("[runAutoSettlementIfDue]", err);
      const msg = err instanceof Error ? err.message : "不明なエラー";
      toast.show(`月末自動精算チェックに失敗しました。${msg}`, "error");
    });
  }, [toast]);

  const shiftClosingDate = (days: number) => {
    const d = new Date(closingDate + "T00:00:00");
    d.setDate(d.getDate() + days);
    setClosingDate(d.toISOString().split("T")[0]);
  };

  const formatClosingDateLabel = (dateStr: string) => {
    const d = new Date(dateStr + "T00:00:00");
    const dayNames = ["日", "月", "火", "水", "木", "金", "土"];
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}（${dayNames[d.getDay()]}）`;
  };

  const fetchCustomers = useCallback(async () => {
    const { data } = await supabase.from("customers").select("*").order("created_at", { ascending: false }); if (data) setCustomers(data);
    // 利用回数・最終利用日
    const { data: visits } = await supabase.from("customer_visits").select("customer_id,date");
    if (visits) {
      const stats: Record<number, { visitCount: number; lastVisit: string; pointBalance: number }> = {};
      for (const v of visits) {
        if (!stats[v.customer_id]) stats[v.customer_id] = { visitCount: 0, lastVisit: "", pointBalance: 0 };
        stats[v.customer_id].visitCount++;
        if (v.date > stats[v.customer_id].lastVisit) stats[v.customer_id].lastVisit = v.date;
      }
      // ポイント残高
      const { data: pts } = await supabase.from("customer_points").select("customer_id,amount,type,expires_at");
      if (pts) {
        const now = new Date().toISOString();
        for (const p of pts) {
          if (!stats[p.customer_id]) stats[p.customer_id] = { visitCount: 0, lastVisit: "", pointBalance: 0 };
          if (p.type === "earn" && p.expires_at && p.expires_at < now) continue; // 期限切れ除外
          stats[p.customer_id].pointBalance += p.amount;
        }
      }
      setCustStats(stats);
    }
    // メモ統計（名前ベース）
    const { data: notes } = await supabase.from("therapist_customer_notes").select("customer_name,is_ng");
    if (notes) {
      const ms: Record<string, { count: number; hasNg: boolean }> = {};
      for (const n of notes) {
        if (!ms[n.customer_name]) ms[n.customer_name] = { count: 0, hasNg: false };
        ms[n.customer_name].count++;
        if (n.is_ng) ms[n.customer_name].hasNg = true;
      }
      setCustMemoStats(ms);
    }
  }, []);

  const fetchMaster = useCallback(async () => {
    const { data: t } = await supabase.from("therapists").select("*").order("id"); if (t) setTherapists(t);
    const { data: s } = await supabase.from("stores").select("*").order("id"); if (s) setStoresList(s);
    const { data: c } = await supabase.from("courses").select("*").order("duration"); if (c) setCourses(c);
  }, []);

  const fetchVisits = useCallback(async (custId: number) => {
    const { data } = await supabase.from("customer_visits").select("*").eq("customer_id", custId).order("date", { ascending: false }); if (data) setVisits(data);
  }, []);
  const fetchAllCancelled = useCallback(async () => {
    const { data } = await supabase.from("reservations").select("id,date,start_time,end_time,course,therapist_id,total_price,notes,customer_name").eq("status", "cancelled").order("date", { ascending: false }).limit(100);
    if (data) setAllCancelledRes(data);
  }, []);

  useEffect(() => {
    const checkUser = async () => { const { data: { user } } = await supabase.auth.getUser(); if (!user) { router.push("/"); } else { setUserEmail(user.email || ""); setUserId(user.id); } };
    checkUser(); fetchCustomers(); fetchMaster(); fetchAllCancelled();
  }, [router, fetchCustomers, fetchMaster, fetchAllCancelled]);

  // Register
  const handleRegister = async () => {
    if (!custName.trim()) { setSaveMsg("名前を入力してください"); return; }
    setSaving(true); setSaveMsg("");
    const p1 = normPhone(custPhone); const p2 = normPhone(custPhone2); const p3 = normPhone(custPhone3);
    if (p1) {
      const { data: dup } = await supabase.from("customers").select("id, name").or(`phone.eq.${p1},phone2.eq.${p1},phone3.eq.${p1}`);
      if (dup && dup.length > 0) { setSaving(false); setSaveMsg(`この電話番号は「${dup[0].name}」で既に登録されています`); return; }
    }
    const { error } = await supabase.from("customers").insert({ name: custName.trim(), self_name: custSelfName.trim() || null, phone: p1, phone2: p2, phone3: p3, email: custEmail.trim(), notes: custNotes.trim(), rank: custRank, birthday: custBirthday || null, user_id: userId });
    setSaving(false);
    if (error) { setSaveMsg("登録に失敗しました: " + error.message); }
    else { setSaveMsg("登録しました！"); setCustName(""); setCustSelfName(""); setCustPhone(""); setCustPhone2(""); setCustPhone3(""); setCustEmail(""); setCustNotes(""); setCustRank("normal"); setCustBirthday(""); fetchCustomers(); setTimeout(() => { setSaveMsg(""); setActivePage("顧客一覧"); }, 1000); }
  };

  // Edit
  const startEdit = (c: Customer) => { setEditingCustomer(c); setEditName(c.name || ""); setEditSelfName(c.self_name || ""); setEditPhone(c.phone || ""); setEditPhone2(c.phone2 || ""); setEditPhone3(c.phone3 || ""); setEditEmail(c.email || c.login_email || ""); setEditNotes(c.notes || ""); setEditRank(c.rank || "normal"); setEditBirthday(c.birthday || ""); setEditMsg(""); };
  const handleUpdate = async () => {
    if (!editingCustomer || !editName.trim()) { setEditMsg("名前を入力してください"); return; }
    setEditSaving(true); setEditMsg("");
    const { error } = await supabase.from("customers").update({ name: editName.trim(), self_name: editSelfName.trim() || null, phone: normPhone(editPhone), phone2: normPhone(editPhone2), phone3: normPhone(editPhone3), email: editEmail.trim(), notes: editNotes.trim(), rank: editRank, birthday: editBirthday || null }).eq("id", editingCustomer.id);
    setEditSaving(false);
    if (error) { setEditMsg("更新に失敗しました: " + error.message); }
    else { setEditMsg("更新しました！"); fetchCustomers(); setTimeout(() => { setEditingCustomer(null); setEditMsg(""); }, 800); }
  };
  const handleDelete = async () => { if (!deleteTarget) return; setDeleting(true); await supabase.from("customers").delete().eq("id", deleteTarget.id); setDeleting(false); setDeleteTarget(null); fetchCustomers(); };

  // Merge customers
  const handleMerge = async () => {
    if (!mergeSource || !mergeTargetId || mergeSource.id === mergeTargetId) return;
    setMerging(true); setMergeMsg("");
    try {
      const srcId = mergeSource.id; const tgtId = mergeTargetId;
      const tgt = customers.find(c => c.id === tgtId);
      // Move customer_visits
      await supabase.from("customer_visits").update({ customer_id: tgtId }).eq("customer_id", srcId);
      // Move customer_points
      await supabase.from("customer_points").update({ customer_id: tgtId }).eq("customer_id", srcId);
      // Move reservations (update customer_name)
      if (tgt) await supabase.from("reservations").update({ customer_name: tgt.name }).eq("customer_name", mergeSource.name);
      // Move therapist_customer_notes
      if (tgt) await supabase.from("therapist_customer_notes").update({ customer_name: tgt.name }).eq("customer_name", mergeSource.name);
      // Move customer_favorites
      await supabase.from("customer_favorites").update({ customer_id: tgtId }).eq("customer_id", srcId);
      // Move customer_notifications
      await supabase.from("customer_notifications").update({ target_customer_id: tgtId }).eq("target_customer_id", srcId);
      // Copy self_name if target doesn't have one
      if (tgt && !tgt.self_name && mergeSource.self_name) {
        await supabase.from("customers").update({ self_name: mergeSource.self_name }).eq("id", tgtId);
      }
      // Copy login info if target doesn't have one
      if (tgt && !tgt.login_email && mergeSource.login_email) {
        await supabase.from("customers").update({ login_email: mergeSource.login_email, login_password: mergeSource.login_password }).eq("id", tgtId);
      }
      // Delete source
      await supabase.from("customers").delete().eq("id", srcId);
      setMergeMsg("統合完了！"); fetchCustomers();
      setTimeout(() => { setMergeSource(null); setMergeMsg(""); setMergeTargetId(0); setMergeSearch(""); }, 1200);
    } catch { setMergeMsg("統合に失敗しました"); }
    setMerging(false);
  };

  // Monthly back rate auto-calculation
  useEffect(() => {
    (async () => {
      const now = new Date();
      const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const ym = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, "0")}`;
      const { data: existing } = await supabase.from("therapist_monthly_back").select("id").eq("year_month", ym).limit(1);
      if (existing && existing.length > 0) { setMonthlyCalculated(true); return; }
      // Check if rules exist
      const { data: rules } = await supabase.from("back_rate_rules").select("*").eq("is_active", true).order("back_increase", { ascending: false });
      if (!rules || rules.length === 0) return;
      const { data: therapists } = await supabase.from("therapists").select("id,name,salary_type,salary_amount").eq("status", "active");
      if (!therapists || therapists.length === 0) return;
      // Get prev month date range
      const firstDay = `${ym}-01`;
      const lastDay = new Date(prevMonth.getFullYear(), prevMonth.getMonth() + 1, 0).toISOString().split("T")[0];
      // Get reservations
      const { data: res } = await supabase.from("reservations").select("therapist_id,nomination").eq("status", "completed").gte("date", firstDay).lte("date", lastDay);
      // Get absences
      const { data: absents } = await supabase.from("absent_records").select("therapist_id").gte("date", firstDay).lte("date", lastDay);
      // Get attendance (late/early_leave)
      const { data: assigns } = await supabase.from("room_assignments").select("therapist_id,attendance").gte("date", firstDay).lte("date", lastDay);
      // Get shifts for work days
      const { data: shifts } = await supabase.from("shifts").select("therapist_id,date").eq("status", "approved").gte("date", firstDay).lte("date", lastDay);
      const results: MonthlyResult[] = [];
      for (const t of therapists) {
        const tRes = (res || []).filter(r => r.therapist_id === t.id);
        const sessions = tRes.length;
        const nomSessions = tRes.filter(r => r.nomination === "本指名").length;
        const nomRate = sessions > 0 ? Math.round(nomSessions / sessions * 1000) / 10 : 0;
        const abs = (absents || []).filter(a => a.therapist_id === t.id).length;
        const tAssigns = (assigns || []).filter(a => a.therapist_id === t.id);
        const lates = tAssigns.filter(a => a.attendance?.includes("late")).length;
        const earlyLeaves = tAssigns.filter(a => a.attendance?.includes("early_leave")).length;
        const workDays = new Set((shifts || []).filter(s => s.therapist_id === t.id).map(s => s.date)).size;
        // Find best matching rule
        let backIncrease = 0; let salaryType = "fixed";
        for (const rule of rules) { if (sessions >= rule.min_sessions && nomRate >= rule.min_nomination_rate) { backIncrease = rule.back_increase; salaryType = rule.salary_type; break; } }
        results.push({ therapist_id: t.id, name: t.name, sessions, nom_sessions: nomSessions, nom_rate: nomRate, absences: abs, lates, early_leaves: earlyLeaves, work_days: workDays, back_increase: backIncrease, prev_increase: t.salary_amount || 0, salary_type: salaryType });
        // Save to DB
        await supabase.from("therapist_monthly_back").insert({ therapist_id: t.id, year_month: ym, total_sessions: sessions, nomination_sessions: nomSessions, nomination_rate: nomRate, back_increase: backIncrease });
        // Update therapist salary
        await supabase.from("therapists").update({ salary_amount: backIncrease, salary_type: salaryType }).eq("id", t.id);
      }
      setMonthlyResults(results); setMonthlyTarget(ym); setShowMonthlyModal(true); setMonthlyCalculated(true);
    })();
  }, []);

  // LINE copy helper
  const copyLineMsg = async (r: MonthlyResult) => {
    const ym = monthlyTarget; const [y, m] = ym.split("-");
    const nextMonth = new Date(parseInt(y), parseInt(m), 1);
    const nextLabel = `${nextMonth.getFullYear()}年${nextMonth.getMonth() + 1}月`;
    const change = r.back_increase > r.prev_increase ? "up" : r.back_increase < r.prev_increase ? "down" : "same";
    const backLabel = r.salary_type === "percent" ? `${r.back_increase}%UP` : `+${r.back_increase.toLocaleString()}円UP`;
    let footer = "";
    if (change === "up") footer = `${nextLabel}のバックが ${backLabel} となりました🎉\n素晴らしい実績です！引き続きよろしくお願いします！`;
    else if (change === "same") footer = `${nextLabel}のバックは現状と同じ内容で継続です！\n来月もよろしくお願いします💪`;
    else footer = r.back_increase > 0 ? `${nextLabel}のバックは ${backLabel} となります。\n来月もよろしくお願いします💪` : `${nextLabel}のバックは基本レートとなります。\n来月もよろしくお願いします💪`;
    const msg = `${r.name}さん、お疲れ様です！\n${parseInt(m)}月の実績報告です📊\n\n出勤回数: ${r.work_days}日\n接客本数: ${r.sessions}本\n本指名率: ${r.nom_rate}%\n当日欠勤: ${r.absences}回\n遅刻: ${r.lates}回\n早退: ${r.early_leaves}回\n\n${footer}`;
    navigator.clipboard.writeText(msg);
    try {
      await supabase.from("notification_logs").insert({
        channel: "therapist_line",
        recipient_type: "therapist",
        recipient_name: r.name,
        therapist_id: r.therapist_id,
        message_type: "shift",
        body: msg,
        body_preview: msg.slice(0, 100),
        sent_by_staff_id: activeStaff?.id || null,
        sent_by_name: activeStaff?.name || "",
        status: "copied",
      });
    } catch (e) { console.error("通知ログ記録失敗:", e); }
    setCopiedId(r.therapist_id); setTimeout(() => setCopiedId(null), 2000);
  };

  // Detail
  const fetchCustomerNotes = async (customerName: string) => {
    const { data } = await supabase.from("therapist_customer_notes").select("*").eq("customer_name", customerName).order("id", { ascending: false });
    if (data) setCustomerNotes(data);
  };
  const openDetail = (c: Customer) => { setDetailCustomer(c); fetchVisits(c.id); fetchCustomerNotes(c.name); supabase.from("customer_points").select("*").eq("customer_id", c.id).order("created_at", { ascending: false }).then(({ data }) => { if (data) setCustPoints(data); }); supabase.from("reservations").select("id,date,start_time,end_time,course,therapist_id,total_price,notes,customer_name").eq("customer_name", c.name).eq("status", "cancelled").order("date", { ascending: false }).then(({ data }) => { if (data) setCancelledRes(data); }); };
  const deleteCustomerNote = async (noteId: number) => {
    const ok = await confirm({
      title: "このセラピストメモを削除しますか？",
      message: "この操作は取り消せません。",
      variant: "danger",
      confirmLabel: "削除する",
    });
    if (!ok) return;
    await supabase.from("therapist_customer_notes").delete().eq("id", noteId);
    if (detailCustomer) fetchCustomerNotes(detailCustomer.name);
  };

  // Add Visit
  const handleAddVisit = async () => {
    if (!detailCustomer || !vDate) return;
    setVSaving(true);
    const course = courses.find((c) => c.id === vCourseId);
    const price = course?.price || 0; const tb = course?.therapist_back || 0;
    const disc = parseInt(vDiscount) || 0; const total = price - disc;
    await supabase.from("customer_visits").insert({ customer_id: detailCustomer.id, date: vDate, start_time: vStart, end_time: vEnd, therapist_id: vTherapistId || null, store_id: vStoreId || null, course_name: course?.name || "", price, therapist_back: tb, nomination: vNomination, options: vOptions, discount: disc, total, payment_method: vPayment, notes: vNotes });
    setVSaving(false); setShowAddVisit(false);
    setVDate(""); setVStart("12:00"); setVEnd("13:00"); setVTherapistId(0); setVStoreId(0); setVCourseId(0); setVNomination(""); setVOptions(""); setVDiscount("0"); setVPayment(""); setVNotes("");
    fetchVisits(detailCustomer.id);
  };
  const deleteVisit = async (id: number) => { if (!detailCustomer) return; await supabase.from("customer_visits").delete().eq("id", id); fetchVisits(detailCustomer.id); };

  const handleLogout = async () => { await supabase.auth.signOut(); router.push("/"); };
  const toggleMenu = (label: string) => { setOpenMenus((prev) => prev.includes(label) ? prev.filter((m) => m !== label) : [...prev, label]); };
  const filteredCustomers = customers.filter((c) => { const q = searchQuery.toLowerCase(); const matchSearch = c.name?.toLowerCase().includes(q) || c.phone?.includes(q) || c.phone2?.includes(q) || c.phone3?.includes(q) || c.email?.toLowerCase().includes(q); const matchRank = filterRank === "all" || (c.rank || "normal") === filterRank; return matchSearch && matchRank; });

  const today = new Date(); const dateStr = `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日`; const dayNames = ["日", "月", "火", "水", "木", "金", "土"]; const dayStr = dayNames[today.getDay()];
  const hours = today.getHours(); const greeting = hours < 12 ? "おはようございます" : hours < 18 ? "こんにちは" : "お疲れ様です";
  const getTherapistName = (id: number) => therapists.find((t) => t.id === id)?.name || "—";
  const getStoreName = (id: number) => storesList.find((s) => s.id === id)?.name || "—";
  const fmt = (n: number) => "¥" + (n || 0).toLocaleString();

  const SB = { bg: "#1a1a2e", border: "rgba(255,255,255,0.04)", textActive: "#c3a782", textActiveBg: "rgba(195,167,130,0.08)", text: "rgba(255,255,255,0.40)", textFaint: "rgba(255,255,255,0.25)", textIcon: "rgba(255,255,255,0.25)" };
  const inputStyle = { backgroundColor: T.cardAlt, color: T.text, border: "1px solid transparent" };
  const TIMES = ["09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00","19:00","20:00","21:00","22:00","23:00","00:00","01:00","02:00","03:00"];

  const RankBadge = ({ rank }: { rank: string }) => { const r = RANKS[rank] || RANKS.normal; return <span className="px-2 py-0.5 rounded-md text-[10px] font-medium" style={{ backgroundColor: r.bg, color: r.color }}>{r.label}</span>; };
  const RankSelector = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <div className="flex gap-2 flex-wrap">{Object.entries(RANKS).map(([key, val]) => (
      <button key={key} onClick={() => onChange(key)} className={`px-3 py-1.5 rounded-xl text-[11px] cursor-pointer transition-all ${value === key ? "ring-2 ring-offset-1" : "opacity-50"}`}
        style={{ backgroundColor: val.bg, color: val.color }} title={val.desc}>{val.label}</button>
    ))}</div>
  );

  return (
    <div className="flex h-screen" style={{ backgroundColor: T.bg, color: T.text }}>
      {ConfirmModalNode}      {/* Sidebar */}
      <aside className={`${sidebarOpen ? "w-[260px]" : "w-0 overflow-hidden"} flex flex-col transition-all duration-500 flex-shrink-0`} style={{ backgroundColor: SB.bg }}>
        <div className="h-[72px] flex items-center px-6" style={{ borderBottom: `1px solid ${SB.border}` }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-[10px] bg-gradient-to-br from-[#c3a782] to-[#a8895e] flex items-center justify-center shadow-[0_2px_8px_rgba(195,167,130,0.3)]"><span className="text-white text-[13px] font-semibold">C</span></div>
            <div><p className="text-[14px] font-medium text-white/90">チョップ</p><p className="text-[9px] text-white/25 tracking-[2px] uppercase">salon management</p></div>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto py-5 px-3">
          <p className="text-[9px] text-white/20 tracking-[2px] uppercase px-3 mb-3">メニュー</p>
          {menuItems.map((item) => (
            <div key={item.label} className="mb-0.5">
              <button onClick={() => { item.sub.length === 0 ? setActivePage(item.label) : toggleMenu(item.label); }}
                className="w-full flex items-center gap-3 px-3 py-[10px] text-[13px] rounded-lg transition-all cursor-pointer group"
                style={{ color: activePage === item.label || (item.sub.length > 0 && item.sub.includes(activePage)) ? SB.textActive : SB.text, backgroundColor: activePage === item.label || (item.sub.length > 0 && item.sub.includes(activePage)) ? SB.textActiveBg : "transparent" }}>
                <span style={{ color: activePage === item.label || (item.sub.length > 0 && item.sub.includes(activePage)) ? SB.textActive : SB.textIcon }}><Icon name={item.icon} size={17} /></span>
                <span className="flex-1 text-left">{item.label}</span>
                {item.sub.length > 0 && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`transition-transform duration-300 opacity-40 ${openMenus.includes(item.label) ? "rotate-180" : ""}`}><polyline points="6 9 12 15 18 9"/></svg>}
              </button>
              {item.sub.length > 0 && openMenus.includes(item.label) && (
                <div className="ml-[18px] pl-4 my-1" style={{ borderLeft: `1px solid ${SB.border}` }}>
                  {item.sub.map((sub) => (
                    <button key={sub} onClick={() => sub === "タイムチャート" ? router.push("/timechart") : sub === "利用場所登録" ? router.push("/rooms") : sub === "セラピスト勤怠" ? router.push("/shifts") : sub === "セラピスト登録" ? router.push("/therapists") : sub === "コース登録" ? router.push("/courses") : sub === "部屋割り管理" ? router.push("/room-assignments") : sub === "年別分析" || sub === "月別分析" || sub === "日別分析" ? router.push("/analytics") : sub === "指名登録" || sub === "延長登録" || sub === "オプション登録" || sub === "割引登録" ? router.push("/service-settings") : setActivePage(sub)}
                      className="w-full text-left px-3 py-[7px] text-[12px] rounded-md transition-all cursor-pointer"
                      style={{ color: activePage === sub ? SB.textActive : SB.textFaint, backgroundColor: activePage === sub ? "rgba(195,167,130,0.06)" : "transparent" }}>{sub}</button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>
        <div className="p-4 mx-3 mb-3" style={{ borderTop: `1px solid ${SB.border}` }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#c3a782]/30 to-[#c3a782]/10 flex items-center justify-center text-[#c3a782] text-[12px] font-medium">{userEmail.charAt(0).toUpperCase()}</div>
            <div className="flex-1 min-w-0"><p className="text-[11px] text-white/60 truncate">{userEmail}</p><p className="text-[9px] text-white/20">スタッフ</p></div>
            <button onClick={handleLogout} className="text-white/15 hover:text-white/40 cursor-pointer p-1"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg></button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-[72px] backdrop-blur-xl flex items-center justify-between px-8 flex-shrink-0 border-b" style={{ backgroundColor: dark ? T.card + "cc" : "rgba(255,255,255,0.8)", borderColor: T.border }}>
          <div className="flex items-center gap-5">
            <NavMenu T={T} dark={dark} />
            <div><h1 className="text-[16px] font-medium">{activePage}</h1><p className="text-[11px]" style={{ color: T.textMuted }}>{dateStr}（{dayStr}）</p></div>
          </div>
          <div className="flex items-center gap-4">
            {activeStaff ? (
              <button onClick={staffLogout} className="px-3 py-1.5 text-[11px] rounded-lg cursor-pointer font-medium" style={{ backgroundColor: activeStaff.role === "owner" ? "#c3a78222" : activeStaff.role === "manager" ? "#85a8c422" : "#22c55e22", color: activeStaff.role === "owner" ? "#c3a782" : activeStaff.role === "manager" ? "#85a8c4" : "#22c55e", border: `1px solid ${activeStaff.role === "owner" ? "#c3a78244" : activeStaff.role === "manager" ? "#85a8c444" : "#22c55e44"}` }}>👤 {activeStaff.name} ✕</button>
            ) : (
              <button onClick={() => { setShowPinModal(true); setPinInput(""); setPinError(""); }} className="px-3 py-1.5 text-[11px] rounded-lg cursor-pointer font-medium" style={{ backgroundColor: "#a855f718", color: "#a855f7", border: "1px solid #a855f744" }}>🔑 スタッフログイン</button>
            )}
            <button onClick={async () => { setShowSafeList(true); const { data: rooms2 } = await supabase.from("rooms").select("*"); const { data: blds2 } = await supabase.from("buildings").select("*"); const { data: thList2 } = await supabase.from("therapists").select("id,name"); const getName2 = (id: number) => (thList2 || []).find((t: any) => t.id === id)?.name || "不明"; const { data: sf } = await supabase.from("therapist_daily_settlements").select("*").eq("safe_deposited", true).is("safe_collected_date", null); const items: typeof safeUncollected = []; for (const s of (sf || [])) { const rm = (rooms2 || []).find((r: any) => r.id === s.room_id); const bl = rm ? (blds2 || []).find((b: any) => b.id === rm.building_id) : null; const { data: rep } = await supabase.from("room_cash_replenishments").select("amount").eq("room_id", s.room_id).eq("date", s.date); const repAmt = (rep || []).reduce((sum: number, r: any) => sum + r.amount, 0); items.push({ id: s.id, date: s.date, total_cash: s.total_cash || 0, final_payment: s.final_payment || 0, room_id: s.room_id, therapist_name: getName2(s.therapist_id), room_label: (bl?.name || "") + (rm?.name || ""), replenish: repAmt }); } setSafeUncollected(items); const { data: sfH } = await supabase.from("therapist_daily_settlements").select("*").eq("safe_deposited", true).not("safe_collected_date", "is", null).order("safe_collected_date", { ascending: false }).limit(20); const hItems: typeof safeHistory = []; for (const s of (sfH || [])) { const rm = (rooms2 || []).find((r: any) => r.id === s.room_id); const bl = rm ? (blds2 || []).find((b: any) => b.id === rm.building_id) : null; const { data: rep } = await supabase.from("room_cash_replenishments").select("amount").eq("room_id", s.room_id).eq("date", s.date); const repAmt = (rep || []).reduce((sum: number, r: any) => sum + r.amount, 0); hItems.push({ id: s.id, date: s.date, total_cash: s.total_cash || 0, final_payment: s.final_payment || 0, room_id: s.room_id, therapist_name: getName2(s.therapist_id), room_label: (bl?.name || "") + (rm?.name || ""), replenish: repAmt, safe_collected_date: s.safe_collected_date }); } setSafeHistory(hItems); }} data-safe-btn className="px-3 py-1.5 text-[11px] rounded-lg cursor-pointer border" style={{ borderColor: "#a855f744", color: "#a855f7" }}>🔐 金庫</button>
            <button onClick={toggle} className="px-3 py-1.5 text-[11px] rounded-lg cursor-pointer border" style={{ borderColor: T.border, color: T.textSub }}>{dark ? "☀️ ライト" : "🌙 ダーク"}</button>
            <div className="w-px h-5" style={{ backgroundColor: T.border }} />
            <button onClick={handleLogout} className="text-[11px] cursor-pointer" style={{ color: T.textMuted }}>ログアウト</button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-8">
          {/* Loading */}
          {activePage === "" && null}
          {/* HOME */}
          {activePage === "HOME" && (
            <div className="animate-[fadeIn_0.4s]">
              <div className="mb-8"><h2 className="text-[22px] font-medium">{greeting}</h2><p className="text-[13px] mt-1" style={{ color: T.textMuted }}>{dateStr}（{dayStr}）の業務状況</p></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
                {[{ label: "本日の予約", value: "0", unit: "件", accent: "#c3a782" }, { label: "本日の売上", value: "¥0", unit: "", accent: "#7ab88f" }, { label: "出勤セラピスト", value: "0", unit: "名", accent: "#85a8c4" }, { label: "総顧客数", value: String(customers.length), unit: "名", accent: "#c49885" }].map((stat) => (
                  <div key={stat.label} className="rounded-2xl p-6 border cursor-default" style={{ backgroundColor: T.card, borderColor: T.border }}>
                    <div className="flex items-center justify-between mb-4"><span className="text-[11px]" style={{ color: T.textMuted }}>{stat.label}</span><div className="w-2 h-2 rounded-full" style={{ backgroundColor: stat.accent, opacity: 0.5 }} /></div>
                    <div className="flex items-baseline gap-1.5"><span className="text-[32px] font-light tracking-tight leading-none">{stat.value}</span><span className="text-[12px]" style={{ color: T.textFaint }}>{stat.unit}</span></div>
                  </div>
                ))}
              </div>
              <div className="mt-8"><p className="text-[11px] mb-4" style={{ color: T.textMuted }}>クイックアクション</p>
                <div className="flex flex-wrap gap-3">{["顧客登録", "タイムチャート", "日別分析", "セラピスト登録"].map((a) => (<button key={a} onClick={() => a === "タイムチャート" ? router.push("/timechart") : setActivePage(a)} className="px-5 py-2.5 border rounded-xl text-[12px] cursor-pointer" style={{ backgroundColor: T.card, borderColor: T.border, color: T.textSub }}>{a}</button>))}</div>
              </div>
            </div>
          )}

          {/* 顧客一覧 */}
          {activePage === "顧客一覧" && (
            <div className="animate-[fadeIn_0.4s]">
              <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: T.card, borderColor: T.border }}>
                <div className="px-6 py-5 flex items-center justify-between" style={{ borderBottom: `1px solid ${T.cardAlt}` }}>
                  <div><h2 className="text-[15px] font-medium">顧客一覧</h2><p className="text-[11px] mt-0.5" style={{ color: T.textFaint }}>{customers.length}件の顧客情報</p></div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setShowCustImport(true)} className="px-4 py-2.5 text-[12px] rounded-xl cursor-pointer font-medium" style={{ backgroundColor: "#3b82f618", color: "#3b82f6", border: "1px solid #3b82f644" }}>📥 インポート</button>
                    <button onClick={() => setShowNgImport(true)} className="px-4 py-2.5 text-[12px] rounded-xl cursor-pointer font-medium" style={{ backgroundColor: "#c4555518", color: "#c45555", border: "1px solid #c4555544" }}>🚫 NGインポート</button>
                    <button onClick={() => setShowNgRegister(true)} className="px-4 py-2.5 text-[12px] rounded-xl cursor-pointer font-medium" style={{ backgroundColor: "#c4555518", color: "#c45555", border: "1px solid #c4555544" }}>🚫 NG登録</button>
                    <button onClick={() => setActivePage("顧客登録")} className="px-5 py-2.5 bg-gradient-to-r from-[#c3a782] to-[#b09672] text-white text-[12px] rounded-xl cursor-pointer">+ 新規登録</button>
                  </div>
                </div>
                <div className="px-6 py-4" style={{ borderBottom: `1px solid ${T.cardAlt}` }}>
                  {/* サブタブ */}
                  <div className="flex gap-2 mb-3">
                    <button onClick={() => setCustListView("list")} className="px-4 py-2 rounded-lg text-[12px] font-medium cursor-pointer" style={{ backgroundColor: custListView === "list" ? T.accent + "18" : "transparent", color: custListView === "list" ? T.accent : T.textMuted, border: custListView === "list" ? `1px solid ${T.accent}44` : `1px solid ${T.border}` }}>👥 顧客一覧</button>
                    <button onClick={() => setCustListView("cancelHistory")} className="px-4 py-2 rounded-lg text-[12px] font-medium cursor-pointer relative" style={{ backgroundColor: custListView === "cancelHistory" ? "#c4555518" : "transparent", color: custListView === "cancelHistory" ? "#c45555" : T.textMuted, border: custListView === "cancelHistory" ? "1px solid #c4555544" : `1px solid ${T.border}` }}>🚫 キャンセル履歴{allCancelledRes.length > 0 && <span className="ml-1.5 text-[9px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "#c4555518", color: "#c45555" }}>{allCancelledRes.length}</span>}</button>
                  </div>
                  {custListView === "list" && (
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="relative max-w-sm flex-1">
                      <input type="text" placeholder="名前・電話番号で検索" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} />
                      <svg className="absolute left-3.5 top-1/2 -translate-y-1/2" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.textFaint} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => setFilterRank("all")} className="px-2.5 py-1.5 rounded-lg text-[10px] cursor-pointer border" style={{ borderColor: filterRank === "all" ? T.accent : T.border, backgroundColor: filterRank === "all" ? T.accent + "18" : "transparent", color: filterRank === "all" ? T.accent : T.textMuted, fontWeight: filterRank === "all" ? 600 : 400 }}>全て</button>
                      {Object.entries(RANKS).map(([key, val]) => (<button key={key} onClick={() => setFilterRank(filterRank === key ? "all" : key)} className="px-2.5 py-1.5 rounded-lg text-[10px] cursor-pointer border" style={{ borderColor: filterRank === key ? val.color : T.border, backgroundColor: filterRank === key ? val.bg : "transparent", color: filterRank === key ? val.color : T.textMuted, fontWeight: filterRank === key ? 600 : 400 }}>{val.label} {filterRank === "all" ? customers.filter((c) => (c.rank || "normal") === key).length : ""}</button>))}
                    </div>
                  </div>
                  )}
                </div>
                {custListView === "list" && (<div className="overflow-x-auto">
                  <table className="w-full text-[12px]">
                    <thead><tr style={{ borderBottom: `1px solid ${T.cardAlt}` }}>
                      {["ランク", "名前", "電話番号", "利用回数", "最終利用日", "ポイント", "メモ", "備考", "操作"].map((h) => (<th key={h} className="text-left py-3.5 px-4 font-normal text-[11px]" style={{ color: T.textMuted }}>{h}</th>))}
                    </tr></thead>
                    <tbody>
                      {filteredCustomers.length === 0 ? (
                        <tr><td colSpan={9} className="text-center py-16 text-[12px]" style={{ color: T.textFaint }}>{customers.length === 0 ? "顧客データがありません" : "検索結果がありません"}</td></tr>
                      ) : filteredCustomers.map((c) => {
                        const phones = [c.phone, c.phone2, c.phone3].filter(Boolean);
                        const st = custStats[c.id] || { visitCount: 0, lastVisit: "", pointBalance: 0 };
                        const memo = custMemoStats[c.name] || { count: 0, hasNg: false };
                        return (
                          <tr key={c.id} className="transition-colors cursor-pointer" style={{ borderBottom: `1px solid ${T.cardAlt}` }} onClick={() => openDetail(c)}>
                            <td className="py-3 px-4"><RankBadge rank={c.rank || "normal"} /></td>
                            <td className="py-3 px-4"><div className="flex items-center gap-3"><div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-medium flex-shrink-0" style={{ backgroundColor: T.cardAlt, color: T.textSub }}>{c.name?.charAt(0)}</div><div><div className="flex items-center gap-1.5"><span className="font-medium">{c.name}</span>{c.login_email && <span className="text-[8px] px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: "#3b82f612", color: "#3b82f6", border: "1px solid #3b82f633" }}>📱会員</span>}</div>{c.self_name && c.self_name !== c.name && <span className="block text-[10px]" style={{ color: T.textMuted }}>👤 {c.self_name}</span>}</div></div></td>
                            <td className="py-3 px-4" style={{ color: T.textSub }}>
                              {phones.length === 0 ? "—" : phones.map((p, i) => (<span key={i} className="block text-[11px]">{p}</span>))}
                            </td>
                            <td className="py-3 px-4 text-center" style={{ color: st.visitCount > 0 ? T.text : T.textFaint }}>{st.visitCount > 0 ? <span className="font-medium">{st.visitCount}<span className="text-[9px] font-normal" style={{ color: T.textMuted }}>回</span></span> : "—"}</td>
                            <td className="py-3 px-4 text-[11px]" style={{ color: st.lastVisit ? T.textSub : T.textFaint }}>{st.lastVisit ? new Date(st.lastVisit).toLocaleDateString("ja-JP", { month: "short", day: "numeric" }) : "—"}</td>
                            <td className="py-3 px-4" style={{ color: st.pointBalance > 0 ? "#d4a843" : T.textFaint }}>{st.pointBalance > 0 ? <span className="font-medium text-[11px]">{st.pointBalance.toLocaleString()}<span className="text-[8px]">pt</span></span> : "—"}</td>
                            <td className="py-3 px-4">{memo.count > 0 ? <span className="text-[10px] px-2 py-1 rounded-lg" style={{ backgroundColor: memo.hasNg ? "#c4555515" : "#e8849a15", color: memo.hasNg ? "#c45555" : "#e8849a" }}>{memo.hasNg && "🚫"}{memo.count}件</span> : <span style={{ color: T.textFaint }}>—</span>}</td>
                            <td className="py-3 px-4 max-w-[150px] truncate" style={{ color: T.textMuted }}>{c.notes || "—"}</td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                <button onClick={() => openDetail(c)} className="px-3 py-1.5 text-[11px] rounded-lg cursor-pointer" style={{ color: "#c3a782", backgroundColor: "#c3a78218" }}>オーダー</button>
                                <button onClick={() => startEdit(c)} className="px-3 py-1.5 text-[11px] rounded-lg cursor-pointer" style={{ color: "#3d6b9f", backgroundColor: "#3d6b9f18" }}>編集</button>
                                <button onClick={() => { setMergeSource(c); setMergeTargetId(0); setMergeSearch(""); setMergeMsg(""); }} className="px-3 py-1.5 text-[11px] rounded-lg cursor-pointer" style={{ color: "#8b5cf6", backgroundColor: "#8b5cf618" }}>統合</button>
                                <button onClick={() => setDeleteTarget(c)} className="px-3 py-1.5 text-[11px] rounded-lg cursor-pointer" style={{ color: "#c45555", backgroundColor: "#c4555518" }}>削除</button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>)}
                {/* キャンセル履歴ビュー */}
                {custListView === "cancelHistory" && (
                  <div className="px-6 py-4">
                    {allCancelledRes.length === 0 ? (
                      <p className="text-[12px] text-center py-16" style={{ color: T.textFaint }}>キャンセル履歴がありません</p>
                    ) : (
                      <div className="space-y-2">
                        {allCancelledRes.map(cr => {
                          const m = cr.notes?.match(/【(お客様都合|お店都合)キャンセル】(.*)?$/m);
                          const cancelTypeLabel = m?.[1] || "";
                          const cancelReasonText = m?.[2]?.trim() || "";
                          return (
                            <div key={cr.id} className="rounded-xl p-4 border flex items-start justify-between" style={{ borderColor: "#c4555525", backgroundColor: "#c4555506" }}>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-3 mb-1">
                                  <span className="text-[13px] font-medium" style={{ color: "#c45555" }}>{cr.date}</span>
                                  {cr.start_time && <span className="text-[11px]" style={{ color: T.textSub }}>{cr.start_time}〜{cr.end_time}</span>}
                                  {cancelTypeLabel && <span className="text-[9px] px-2 py-0.5 rounded-full" style={{ backgroundColor: cancelTypeLabel === "お客様都合" ? "#c4555518" : "#3d6b9f18", color: cancelTypeLabel === "お客様都合" ? "#c45555" : "#3d6b9f" }}>{cancelTypeLabel}</span>}
                                </div>
                                <div className="flex flex-wrap gap-x-4 text-[11px]" style={{ color: T.textSub }}>
                                  <span>👤 {cr.customer_name}</span>
                                  {cr.therapist_id > 0 && <span>💆 {getTherapistName(cr.therapist_id)}</span>}
                                  {cr.course && <span>📋 {cr.course}</span>}
                                  {cr.total_price > 0 && <span style={{ color: T.textMuted }}>{fmt(cr.total_price)}</span>}
                                </div>
                                {cancelReasonText && <p className="text-[10px] mt-1" style={{ color: T.textMuted }}>📝 {cancelReasonText}</p>}
                              </div>
                              <button onClick={async () => { await supabase.from("reservations").update({ status: "unprocessed" }).eq("id", cr.id); fetchAllCancelled(); }} className="text-[10px] px-3 py-1.5 rounded-lg cursor-pointer flex-shrink-0" style={{ color: "#4a7c59", backgroundColor: "#4a7c5910", border: "1px solid #4a7c5925" }}>↩ 復元</button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 顧客登録 */}
          {activePage === "顧客登録" && (
            <div className="animate-[fadeIn_0.4s] max-w-xl">
              <div className="rounded-2xl border p-8" style={{ backgroundColor: T.card, borderColor: T.border }}>
                <div className="mb-8"><h2 className="text-[16px] font-medium">顧客登録</h2><p className="text-[11px] mt-1" style={{ color: T.textFaint }}>新しい顧客情報を登録します</p></div>
                <div className="space-y-5">
                  <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>名前（スタッフ管理用）<span style={{ color: "#c49885" }}> *</span></label><input type="text" placeholder="タナカ1234" value={custName} onChange={(e) => setCustName(e.target.value)} className="w-full px-4 py-3 rounded-xl text-[13px] outline-none" style={inputStyle} /><p className="text-[9px] mt-1" style={{ color: T.textFaint }}>スタッフがタイムチャート等で使う管理用の名前</p></div>
                  <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>会員登録名（お客様用）</label><input type="text" placeholder="山田 太郎" value={custSelfName} onChange={(e) => setCustSelfName(e.target.value)} className="w-full px-4 py-3 rounded-xl text-[13px] outline-none" style={inputStyle} /><p className="text-[9px] mt-1" style={{ color: T.textFaint }}>お客様がマイページで見る名前（未入力の場合はお客様が登録時に設定）</p></div>
                  <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>電話番号①</label><input type="tel" placeholder="090-1234-5678" value={custPhone} onChange={(e) => setCustPhone(e.target.value)} className="w-full px-4 py-3 rounded-xl text-[13px] outline-none" style={inputStyle} /></div>
                  <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>電話番号②</label><input type="tel" placeholder="2つ目の電話番号（任意）" value={custPhone2} onChange={(e) => setCustPhone2(e.target.value)} className="w-full px-4 py-3 rounded-xl text-[13px] outline-none" style={inputStyle} /></div>
                  <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>電話番号③</label><input type="tel" placeholder="3つ目の電話番号（任意）" value={custPhone3} onChange={(e) => setCustPhone3(e.target.value)} className="w-full px-4 py-3 rounded-xl text-[13px] outline-none" style={inputStyle} /></div>
                  <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>メールアドレス</label><input type="email" placeholder="example@email.com" value={custEmail} onChange={(e) => setCustEmail(e.target.value)} className="w-full px-4 py-3 rounded-xl text-[13px] outline-none" style={inputStyle} /></div>
                  <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>🎂 誕生日</label><input type="date" value={custBirthday} onChange={(e) => setCustBirthday(e.target.value)} className="w-full px-4 py-3 rounded-xl text-[13px] outline-none" style={inputStyle} /></div>
                  <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>お客様ランク</label><RankSelector value={custRank} onChange={setCustRank} /></div>
                  <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>備考</label><textarea placeholder="メモ・備考を入力" rows={3} value={custNotes} onChange={(e) => setCustNotes(e.target.value)} className="w-full px-4 py-3 rounded-xl text-[13px] outline-none resize-none" style={inputStyle} /></div>
                  {saveMsg && <div className="px-4 py-3 rounded-xl text-[12px]" style={{ backgroundColor: saveMsg.includes("失敗") || saveMsg.includes("入力") ? "#c4988518" : "#7ab88f18", color: saveMsg.includes("失敗") || saveMsg.includes("入力") ? "#c49885" : "#5a9e6f" }}>{saveMsg}</div>}
                  <div className="flex gap-3 pt-3">
                    <button onClick={handleRegister} disabled={saving} className="px-7 py-3 bg-gradient-to-r from-[#c3a782] to-[#b09672] text-white text-[12px] rounded-xl cursor-pointer disabled:opacity-60">{saving ? "登録中..." : "登録する"}</button>
                    <button onClick={() => { setActivePage("顧客一覧"); setSaveMsg(""); }} className="px-7 py-3 border text-[12px] rounded-xl cursor-pointer" style={{ borderColor: T.border, color: T.textSub }}>キャンセル</button>
                  </div>
                </div>
              </div>
            </div>
          )}

{/* ポイント管理 */}
          {activePage === "ポイント管理" && (() => {
            const sorted = [...ptData].sort((a, b) => ptSort === "balance" ? b.balance - a.balance : ptSort === "earned" ? b.total_earned - a.total_earned : b.total_used - a.total_used);
            const totalBal = ptData.reduce((s,r) => s+r.balance, 0);
            const totalEarned = ptData.reduce((s,r) => s+r.total_earned, 0);
            const totalUsed = ptData.reduce((s,r) => s+r.total_used, 0);
            const rankIcon = (r: string) => r === "platinum" ? "💎" : r === "gold" ? "🥇" : r === "silver" ? "🥈" : "👤";
            return (
            <div className="max-w-4xl mx-auto animate-[fadeIn_0.3s]">
              <div className="mb-6 flex items-center justify-between"><div><h2 className="text-[15px] font-medium">🎁 ポイント管理</h2><p className="text-[11px] mt-0.5" style={{ color: T.textFaint }}>全顧客のポイント状況を確認・管理</p></div><button onClick={() => { setActivePage("HOME"); setTimeout(() => setActivePage("ポイント管理"), 100); }} className="px-3 py-1.5 text-[10px] rounded-lg cursor-pointer border" style={{ borderColor: T.border, color: T.textSub }}>🔄 更新</button></div>
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="rounded-2xl border p-5 text-center" style={{ backgroundColor: T.card, borderColor: T.border }}><p className="text-[10px] mb-1" style={{ color: T.textMuted }}>総ポイント残高</p><p className="text-[22px] font-bold" style={{ color: "#d4a843" }}>{totalBal.toLocaleString()}<span className="text-[11px] font-normal">pt</span></p></div>
                <div className="rounded-2xl border p-5 text-center" style={{ backgroundColor: T.card, borderColor: T.border }}><p className="text-[10px] mb-1" style={{ color: T.textMuted }}>累計付与</p><p className="text-[22px] font-bold" style={{ color: "#4a7c59" }}>+{totalEarned.toLocaleString()}<span className="text-[11px] font-normal">pt</span></p></div>
                <div className="rounded-2xl border p-5 text-center" style={{ backgroundColor: T.card, borderColor: T.border }}><p className="text-[10px] mb-1" style={{ color: T.textMuted }}>累計利用</p><p className="text-[22px] font-bold" style={{ color: "#c45555" }}>-{totalUsed.toLocaleString()}<span className="text-[11px] font-normal">pt</span></p></div>
              </div>
              <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: T.card, borderColor: T.border }}>
                <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: `1px solid ${T.border}` }}>
                  <p className="text-[12px] font-medium">顧客別ポイント一覧（{ptData.length}名）</p>
                  <div className="flex gap-1">{([ ["balance","残高順"], ["earned","付与順"], ["used","利用順"] ] as const).map(([k,l]) => (<button key={k} onClick={() => setPtSort(k)} className="px-2 py-1 text-[9px] rounded-lg cursor-pointer" style={{ backgroundColor: ptSort===k ? "#d4a84318" : "transparent", color: ptSort===k ? "#d4a843" : T.textMuted, fontWeight: ptSort===k ? 600 : 400 }}>{l}</button>))}</div>
                </div>
                {ptLoading ? <p className="text-center py-8 text-[12px]" style={{ color: T.textFaint }}>読み込み中...</p> : ptData.length === 0 ? <p className="text-center py-8 text-[12px]" style={{ color: T.textFaint }}>ポイントデータがありません（予約終了時に自動付与されます）</p> : (
                <table className="w-full text-[12px]"><thead><tr style={{ borderBottom: `1px solid ${T.border}` }}>{["","お客様","ランク","残高","累計付与","累計利用"].map(h => <th key={h} className="py-3 px-4 text-left font-normal text-[10px]" style={{ color: T.textMuted }}>{h}</th>)}</tr></thead><tbody>{sorted.map((r,i) => (
                  <tr key={r.customer_id} className="cursor-pointer hover:opacity-80" style={{ borderBottom: `1px solid ${T.border}` }} onClick={() => { const c = customers.find(x => x.id === r.customer_id); if (c) openDetail(c); }}>
                    <td className="py-2.5 px-4 text-[10px]" style={{ color: T.textFaint }}>{i+1}</td>
                    <td className="py-2.5 px-4 font-medium">{r.name}</td>
                    <td className="py-2.5 px-4">{rankIcon(r.rank)}</td>
                    <td className="py-2.5 px-4 font-bold" style={{ color: "#d4a843" }}>{r.balance.toLocaleString()}pt</td>
                    <td className="py-2.5 px-4" style={{ color: "#4a7c59" }}>+{r.total_earned.toLocaleString()}</td>
                    <td className="py-2.5 px-4" style={{ color: "#c45555" }}>-{r.total_used.toLocaleString()}</td>
                  </tr>
                ))}</tbody></table>
                )}
              </div>
            </div>);
          })()}

          {/* 営業締め */}
          {activePage === "営業締め" && (
            <div className="animate-[fadeIn_0.4s] max-w-[800px]">
              <h2 className="text-[18px] font-medium mb-4">📊 日次集計</h2>
              <div className="flex items-center gap-2 mb-6">
                <button onClick={() => shiftClosingDate(-1)} className="px-3 py-2 rounded-xl text-[12px] cursor-pointer border" style={{ backgroundColor: T.card, borderColor: T.border, color: T.textSub }}>◀ 前日</button>
                <input type="date" value={closingDate} onChange={(e) => setClosingDate(e.target.value)} className="px-3 py-2 rounded-xl text-[12px] outline-none border" style={{ backgroundColor: T.card, borderColor: T.border, color: T.text }} />
                <span className="text-[13px] font-medium ml-1" style={{ color: T.textSub }}>{formatClosingDateLabel(closingDate)}</span>
                <button onClick={() => shiftClosingDate(1)} className="px-3 py-2 rounded-xl text-[12px] cursor-pointer border" style={{ backgroundColor: T.card, borderColor: T.border, color: T.textSub }}>翌日 ▶</button>
                {closingLoading && <span className="text-[11px] ml-2" style={{ color: T.textMuted }}>読込中...</span>}
              </div>
              {closingData && (
                <div className="space-y-3">
                  {/* 売上サマリー */}
                  <div className="rounded-xl p-4" style={{ backgroundColor: "#c3a78212", border: "1px solid #c3a78233" }}>
                    <p className="text-[10px] font-medium mb-2" style={{ color: "#c3a782" }}>売上サマリー</p>
                    <div className="space-y-1 text-[12px]">
                      <div className="flex justify-between"><span style={{ color: T.textSub }}>予約件数</span><span>{closingData.resCount}件</span></div>
                      <div className="flex justify-between"><span style={{ color: T.textSub }}>終了件数</span><span style={{ color: "#c3a782" }}>{closingData.compCount}件</span></div>
                      <div className="flex justify-between pt-2 font-bold text-[15px]" style={{ borderTop: "1px solid #c3a78233", color: "#c3a782" }}><span>総売上</span><span>{fmt(closingData.totalSales)}</span></div>
                    </div>
                  </div>
                  {/* 売上内訳 */}
                  <div className="rounded-xl p-4" style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}>
                    <p className="text-[10px] font-medium mb-2" style={{ color: T.textSub }}>売上内訳</p>
                    <div className="space-y-1 text-[12px]">
                      <div className="flex justify-between"><span style={{ color: T.textSub }}>コース合計</span><span>{fmt(closingData.totalCoursePrice)}</span></div>
                      <div className="flex justify-between"><span style={{ color: T.textSub }}>指名料合計</span><span>+{fmt(closingData.totalNom)}</span></div>
                      <div className="flex justify-between"><span style={{ color: T.textSub }}>オプション合計</span><span>+{fmt(closingData.totalOpt)}</span></div>
                      <div className="flex justify-between"><span style={{ color: T.textSub }}>延長合計</span><span>+{fmt(closingData.totalExt)}</span></div>
                      {closingData.totalDisc > 0 && <div className="flex justify-between" style={{ color: "#c45555" }}><span>割引合計</span><span>-{fmt(closingData.totalDisc)}</span></div>}
                    </div>
                  </div>
                  {/* 支払い方法別 */}
                  <div className="rounded-xl p-4" style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}>
                    <p className="text-[10px] font-medium mb-2" style={{ color: T.textSub }}>支払い方法別</p>
                    <div className="space-y-1 text-[12px]">
                      <div className="flex justify-between"><span style={{ color: "#85a8c4" }}>💳 カード決済</span><span>{fmt(closingData.totalCard)}</span></div>
                      <div className="flex justify-between"><span style={{ color: "#22c55e" }}>📱 PayPay</span><span>{fmt(closingData.totalPaypay)}</span></div>
                      <div className="flex justify-between"><span style={{ color: "#f59e0b" }}>💴 現金</span><span>{fmt(closingData.totalCashSales)}</span></div>
                    </div>
                  </div>
                  {/* セラピスト支払い */}
                  <div className="rounded-xl p-4" style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}>
                    <p className="text-[10px] font-medium mb-2" style={{ color: T.textSub }}>セラピスト支払い</p>
                    <div className="space-y-1 text-[12px]">
                      <div className="flex justify-between"><span style={{ color: T.textSub }}>コースバック</span><span>-{fmt(closingData.totalCourseBack)}</span></div>
                      {closingData.totalNomBack > 0 && <div className="flex justify-between"><span style={{ color: T.textSub }}>指名バック</span><span>-{fmt(closingData.totalNomBack)}</span></div>}
                      {closingData.totalOptBack > 0 && <div className="flex justify-between"><span style={{ color: T.textSub }}>オプションバック</span><span>-{fmt(closingData.totalOptBack)}</span></div>}
                      {closingData.totalExtBack > 0 && <div className="flex justify-between"><span style={{ color: T.textSub }}>延長バック</span><span>-{fmt(closingData.totalExtBack)}</span></div>}
                      <div className="flex justify-between pt-1" style={{ borderTop: `1px dashed ${T.border}` }}><span style={{ color: T.textSub }}>バック合計</span><span>-{fmt(closingData.totalBack)}</span></div>
                      {closingData.totalGiftBack > 0 && <div className="flex justify-between" style={{ color: "#c96b83" }}><span>💝 情報配信報酬</span><span>-{fmt(closingData.totalGiftBack)}</span></div>}
                      {closingData.totalInvoiceDed > 0 && <div className="flex justify-between"><span style={{ color: T.textSub }}>インボイス控除（店側収入）</span><span style={{ color: "#22c55e" }}>+{fmt(closingData.totalInvoiceDed)}</span></div>}
                      {closingData.totalWithholding > 0 && <div className="flex justify-between"><span style={{ color: T.textSub }}>源泉徴収（店側預り）</span><span style={{ color: "#22c55e" }}>+{fmt(closingData.totalWithholding)}</span></div>}
                      {closingData.totalWelfare > 0 && <div className="flex justify-between"><span style={{ color: T.textSub }}>備品・リネン代（店側収入）</span><span style={{ color: "#22c55e" }}>+{fmt(closingData.totalWelfare)}</span></div>}
                      {closingData.totalTransportSettle > 0 && <div className="flex justify-between"><span style={{ color: T.textSub }}>交通費（店側支出）</span><span style={{ color: "#c45555" }}>-{fmt(closingData.totalTransportSettle)}</span></div>}
                      {closingData.totalRounding !== 0 && <div className="flex justify-between"><span style={{ color: T.textSub }}>端数切上げ</span><span style={{ color: "#c45555" }}>-{fmt(Math.abs(closingData.totalRounding))}</span></div>}
                      <div className="flex justify-between pt-1 font-bold" style={{ borderTop: `1px dashed ${T.border}`, color: "#c45555" }}><span>実支給額合計</span><span>-{fmt(closingData.totalFinalPay)}</span></div>
                    </div>
                  </div>
                  {/* 釣銭状況 */}
                  <div className="rounded-xl p-4" style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}>
                    <p className="text-[10px] font-medium mb-2" style={{ color: T.textSub }}>釣銭状況</p>
                    <div className="space-y-1 text-[12px]">
                      {closingData.replenishList.length > 0 ? closingData.replenishList.map((r: any, i: number) => (
                        <div key={i} className="flex justify-between items-center py-1 px-2 rounded-lg" style={{ backgroundColor: T.cardAlt }}>
                          <span className="text-[11px]">🏠 {r.room}{r.therapist ? ` / ${r.therapist}` : ""}{r.staff ? <span style={{ color: T.textFaint }}> 👤{r.staff}</span> : ""}{r.time ? <span style={{ color: T.textFaint, fontSize: 9 }}> {r.time}</span> : ""}</span>
                          <span style={{ color: "#22c55e", fontWeight: 600 }}>{fmt(r.amount)}</span>
                        </div>
                      )) : <p className="text-[10px]" style={{ color: T.textFaint }}>本日の補充はありません</p>}
                      {closingData.replenishList.length > 0 && <div className="flex justify-between pt-1 font-bold" style={{ borderTop: `1px solid ${T.border}` }}><span>補充合計</span><span style={{ color: "#22c55e" }}>{fmt(closingData.totalReplenish)}</span></div>}
                    </div>
                  </div>
                  {/* 経費・支出 */}
                  <div className="rounded-xl p-4" style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}>
                    <p className="text-[10px] font-medium mb-2" style={{ color: T.textSub }}>経費・支出</p>
                    <div className="space-y-1 text-[12px]">
                      {closingData.expenseList.length > 0 ? closingData.expenseList.map((e: any, i: number) => (
                        <div key={i} className="flex justify-between"><span style={{ color: T.textSub }}>{e.category}: {e.name}</span><span style={{ color: "#c45555" }}>-{fmt(e.amount)}</span></div>
                      )) : <p className="text-[10px]" style={{ color: T.textFaint }}>本日の経費はありません</p>}
                      {closingData.expenseList.length > 0 && <div className="flex justify-between pt-1 font-bold" style={{ borderTop: `1px solid ${T.border}` }}><span>経費合計</span><span style={{ color: "#c45555" }}>-{fmt(closingData.expenseTotal)}</span></div>}
                    </div>
                  </div>
                  {/* 入金 */}
                  {closingData.incomeList.length > 0 && (
                    <div className="rounded-xl p-4" style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}>
                      <p className="text-[10px] font-medium mb-2" style={{ color: T.textSub }}>入金</p>
                      <div className="space-y-1 text-[12px]">
                        {closingData.incomeList.map((e: any, i: number) => (
                          <div key={i} className="flex justify-between"><span style={{ color: T.textSub }}>{e.category}: {e.name}</span><span style={{ color: "#22c55e" }}>+{fmt(e.amount)}</span></div>
                        ))}
                        <div className="flex justify-between pt-1 font-bold" style={{ borderTop: `1px solid ${T.border}` }}><span>入金合計</span><span style={{ color: "#22c55e" }}>+{fmt(closingData.incomeTotal)}</span></div>
                      </div>
                    </div>
                  )}
                  {/* 本日の収支 */}
                  <div className="rounded-xl p-4" style={{ backgroundColor: "#22c55e12", border: "1px solid #22c55e33" }}>
                    <p className="text-[10px] font-medium mb-2" style={{ color: "#22c55e" }}>本日の収支</p>
                    <div className="space-y-1 text-[12px]">
                      <div className="flex justify-between"><span>売上</span><span>{fmt(closingData.totalSales)}</span></div>
                      <div className="flex justify-between" style={{ color: "#c45555" }}><span>セラピスト支払い</span><span>-{fmt(closingData.totalFinalPay)}</span></div>
                      {closingData.expenseTotal > 0 && <div className="flex justify-between" style={{ color: "#c45555" }}><span>経費</span><span>-{fmt(closingData.expenseTotal)}</span></div>}
                      {closingData.incomeTotal > 0 && <div className="flex justify-between" style={{ color: "#22c55e" }}><span>入金</span><span>+{fmt(closingData.incomeTotal)}</span></div>}
                      <div className="flex justify-between pt-2 font-bold text-[15px]" style={{ borderTop: "1px solid #22c55e33", color: "#22c55e" }}><span>店取り</span><span>{fmt(closingData.netProfit)}</span></div>
                    </div>
                  </div>
                  {/* 現金確認シート */}
                  <div className="rounded-xl p-4" style={{ backgroundColor: "#f59e0b12", border: "1px solid #f59e0b33" }}>
                    <p className="text-[10px] font-medium mb-3" style={{ color: "#f59e0b" }}>💴 現金確認シート</p>
                    <div className="space-y-1 text-[12px]">
                      <p className="text-[9px] font-medium" style={{ color: "#c45555" }}>出金（事務所から出たお金）</p>
                      <div className="flex justify-between"><span>釣銭補充（ルームへ）</span><span style={{ color: "#c45555" }}>-{fmt(closingData.totalReplenish)}</span></div>
                      <div className="flex justify-between"><span>セラピスト支払い（ルーム内現金から）</span><span style={{ color: T.textFaint }}>-{fmt(closingData.totalFinalPay)}</span></div>
                      <p className="text-[9px] pl-2" style={{ color: T.textFaint }}>※ ルーム内で支払済み。スタッフ回収時に相殺されます</p>
                      {closingData.expenseTotal > 0 && <div className="flex justify-between"><span>経費</span><span style={{ color: "#c45555" }}>-{fmt(closingData.expenseTotal)}</span></div>}
                      {/* 💸 スタッフ前借り — 記録があれば明細表示、未記録があれば警告表示、なければ非表示 */}
                      {(closingData.staffAdvanceTotal > 0 || (closingData.unrecordedAdvanceList || []).length > 0) && (
                        <>
                          <div className="flex justify-between items-center">
                            <span className="flex items-center gap-2">
                              <span>💸 スタッフ前借り</span>
                              <button onClick={() => router.push("/staff?tab=advances")} className="text-[9px] px-2 py-0.5 rounded cursor-pointer" style={{ backgroundColor: "#d4687e22", color: "#d4687e", border: "1px solid #d4687e44" }}>📝 記録画面へ →</button>
                            </span>
                            <span style={{ color: "#d4687e" }}>-{fmt(closingData.staffAdvanceTotal)}</span>
                          </div>
                          {closingData.staffAdvanceList.map((a: any) => (
                            <div key={a.id} className="flex justify-between pl-3 text-[10px]"><span style={{ color: T.textMuted }}>・{a.name}{a.reason ? `（${a.reason}）` : ""}</span><span style={{ color: T.textMuted }}>-{fmt(a.amount)}</span></div>
                          ))}
                          {(closingData.unrecordedAdvanceList || []).length > 0 && (
                            <div className="rounded-lg p-2 mt-1" style={{ backgroundColor: "#f59e0b18", border: "1px solid #f59e0b44" }}>
                              <div className="flex justify-between items-center">
                                <span className="text-[10px] font-medium" style={{ color: "#f59e0b" }}>⚠️ 未記録 {closingData.unrecordedAdvanceList.length} 名</span>
                                <button onClick={() => router.push("/staff?tab=advances")} className="text-[9px] px-2 py-0.5 rounded cursor-pointer font-medium" style={{ backgroundColor: "#f59e0b", color: "#fff" }}>記録する →</button>
                              </div>
                              <p className="text-[9px] mt-0.5" style={{ color: T.textFaint }}>{closingData.unrecordedAdvanceList.map((x: any) => x.name).join("・")}</p>
                            </div>
                          )}
                        </>
                      )}
                      <div className="flex justify-between font-bold pt-1" style={{ borderTop: `1px dashed ${T.border}`, color: "#c45555" }}><span>出金合計</span><span>-{fmt(closingData.totalOut + (closingData.staffAdvanceTotal || 0))}</span></div>
                      {closingData.incomeTotal > 0 && (<><p className="text-[9px] font-medium mt-2" style={{ color: "#22c55e" }}>入金</p><div className="flex justify-between"><span>入金合計</span><span style={{ color: "#22c55e" }}>+{fmt(closingData.incomeTotal)}</span></div></>)}
                      <p className="text-[9px] font-medium mt-3" style={{ color: "#f59e0b" }}>ルーム別 現金状況（未回収 = 事務所にまだ戻っていない）</p>
                      {closingData.therapistData.map((t: any, i: number) => (
                        <div key={i} className="py-1">
                          <div className="flex justify-between">
                            <span>{t.name} <span style={{ color: T.textFaint, fontSize: 9 }}>({t.room})</span></span>
                            <div className="flex gap-1">
                              {t.salesCollected ? (t.safeDeposited ? <span style={{ color: "#a855f7", fontSize: 9, fontWeight: 700 }}>🔐 売上金庫</span> : <span style={{ color: "#22c55e", fontSize: 9, fontWeight: 700 }}>✅ 売上回収</span>) : <span style={{ color: "#c45555", fontSize: 9 }}>売上未回収</span>}
                              {t.replenish > 0 && (t.changeCollected ? <span style={{ color: "#22c55e", fontSize: 9, fontWeight: 700 }}>✅ 釣銭回収</span> : <span style={{ color: "#c45555", fontSize: 9 }}>釣銭未回収</span>)}
                            </div>
                          </div>
                          <div className="flex gap-3 text-[10px] pl-2" style={{ color: T.textMuted }}>
                            {t.replenish > 0 && <span style={{ color: t.changeCollected ? "#22c55e" : "#c45555" }}>釣銭{fmt(t.replenish)}</span>}
                            <span>売上残{fmt(t.netAfterPay)}</span>
                            <span className="font-medium" style={{ color: T.text }}>計{fmt((t.changeCollected ? t.replenish : 0) + t.netAfterPay)}</span>
                          </div>
                        </div>
                      ))}
                      <div className="flex justify-between font-bold pt-1" style={{ borderTop: `1px dashed ${T.border}`, color: "#f59e0b" }}><span>未回収合計（ルームにある現金）</span><span>{fmt(closingData.totalUncollected)}</span></div>
                      {closingData.safeUncollectedList.length > 0 && (
                        <div className="pt-2 mt-2" style={{ borderTop: `1px dashed ${T.border}` }}>
                          <div className="flex justify-between font-bold pt-1" style={{ color: "#a855f7" }}><span>🔐 金庫未回収合計</span><span>{fmt(closingData.safeTotalUncollected)}</span></div>
                        </div>
                      )}
                      {closingData.safeCollectedTodayList.length > 0 && (
                        <div className="pt-2 mt-2" style={{ borderTop: `1px dashed ${T.border}` }}>
                          <p className="text-[9px] font-medium mb-1" style={{ color: "#a855f7" }}>🔐 金庫回収分（本日回収）</p>
                          {closingData.safeCollectedTodayList.map((s: any, i: number) => (
                            <div key={i} className="flex justify-between py-0.5 text-[11px]"><span style={{ color: T.textSub }}>{s.date.slice(5)} {s.room} {s.therapist}</span><span style={{ color: "#a855f7" }}>+{fmt(s.amount)}</span></div>
                          ))}
                          <div className="flex justify-between font-bold pt-1" style={{ borderTop: `1px dashed ${T.border}`, color: "#a855f7" }}><span>金庫回収合計</span><span>+{fmt(closingData.safeCollectedTodayTotal)}</span></div>
                        </div>
                      )}
                      <div className="pt-3 mt-2" style={{ borderTop: "2px solid #f59e0b44" }}>
                        {/* 今ある現金 4箇所 + 合計 スタッフが実測で照合する部分 */}
                        <p className="text-[11px] font-bold mb-3" style={{ color: "#f59e0b" }}>📦 今ある現金（実際にカウントして照合）</p>
                        <div className="space-y-1.5 text-[12px]">
                          <div className="flex justify-between items-center px-2 py-1.5 rounded" style={{ backgroundColor: "rgba(34,197,94,0.08)" }}>
                            <span>💴 事務所にある現金</span>
                            <span style={{ color: (closingData.cashOnHand + closingData.safeCollectedTodayTotal) >= 0 ? "#22c55e" : "#c45555", fontWeight: 700 }}>{fmt(closingData.cashOnHand + closingData.safeCollectedTodayTotal)}</span>
                          </div>
                          {closingData.safeTotalUncollected > 0 && (
                            <div className="flex justify-between items-center px-2 py-1.5 rounded" style={{ backgroundColor: "rgba(168,85,247,0.08)" }}>
                              <span>🔐 金庫にある現金（投函済・未回収）</span>
                              <span style={{ color: "#a855f7", fontWeight: 700 }}>{fmt(closingData.safeTotalUncollected)}</span>
                            </div>
                          )}
                          {closingData.totalUncollected > 0 && (
                            <div className="flex justify-between items-center px-2 py-1.5 rounded" style={{ backgroundColor: "rgba(245,158,11,0.08)" }}>
                              <span>🏠 ルームにある現金（まだ回収してない）</span>
                              <span style={{ color: "#f59e0b", fontWeight: 700 }}>{fmt(closingData.totalUncollected)}</span>
                            </div>
                          )}
                          <div className="flex justify-between items-center px-2 py-1.5 rounded" style={{ backgroundColor: "rgba(212,104,126,0.08)" }}>
                            <span>🏛 豊橋予備金（立替用・豊橋保管）</span>
                            <span style={{ color: "#d4687e", fontWeight: 700 }}>{fmt(closingData.toyohashiBalance || 0)}</span>
                          </div>
                          <div className="flex justify-between items-center px-3 py-2.5 rounded-lg mt-2" style={{ backgroundColor: "#22c55e18", border: "2px solid #22c55e" }}>
                            <span className="text-[14px] font-bold" style={{ color: "#22c55e" }}>📦 今ある現金 合計</span>
                            <span className="text-[18px] font-bold" style={{ color: "#22c55e", fontVariantNumeric: "tabular-nums" }}>{fmt(closingData.cashOnHand + closingData.safeCollectedTodayTotal + closingData.safeTotalUncollected + closingData.totalUncollected + (closingData.toyohashiBalance || 0))}</span>
                          </div>
                          <p className="text-[10px] mt-2 px-2" style={{ color: T.textFaint, lineHeight: 1.5 }}>
                            ※ 実際に <strong style={{ color: "#22c55e" }}>事務所</strong>・<strong style={{ color: "#a855f7" }}>金庫</strong>・<strong style={{ color: "#f59e0b" }}>ルーム</strong>・<strong style={{ color: "#d4687e" }}>豊橋予備金</strong> の現金を数えて、合計がこの金額と一致していれば本日の現金残はOKです
                          </p>
                        </div>
                        {closingData.reserveUsedTotal > 0 && (
                          <div className="mt-3 pt-2" style={{ borderTop: `1px dashed ${T.border}` }}>
                            <div className="flex justify-between text-[11px]" style={{ color: "#d4687e" }}>
                              <span>🏛 豊橋予備金からの立替（事務所残金に含む）</span>
                              <span style={{ fontWeight: 500 }}>{fmt(closingData.reserveUsedTotal)}</span>
                            </div>
                            {closingData.reserveUsedList.map((r: any, i: number) => (
                              <div key={i} className="flex justify-between py-0.5 text-[10px] pl-3" style={{ color: T.textFaint }}>
                                <span>{r.therapist}</span>
                                <span>{fmt(r.amount)}</span>
                              </div>
                            ))}
                            <p className="text-[9px] mt-1" style={{ color: T.textFaint }}>※ セラピストに全額渡済み。後日スタッフ金庫から予備金へ {fmt(closingData.reserveUsedTotal)} 補充してください。</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  {/* セラピスト別売上 */}
                  <div className="rounded-xl p-4" style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}>
                    <p className="text-[10px] font-medium mb-2" style={{ color: T.textSub }}>セラピスト別売上</p>
                    <div className="space-y-1 text-[11px]">
                      {closingData.therapistSales.length === 0 ? (
                        <p className="text-[10px]" style={{ color: T.textFaint }}>データなし</p>
                      ) : closingData.therapistSales.map((t: any, i: number) => (
                        <div key={i} className="flex justify-between py-0.5"><span>{t.name}（{t.count}件）</span><span>売上{fmt(t.sales)} / バック{fmt(t.back)}{t.giftBack > 0 ? <> / <span style={{ color: "#c96b83" }}>情報配信+{fmt(t.giftBack)}</span></> : ""}</span></div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              {!closingData && !closingLoading && (
                <div className="rounded-xl border p-12 text-center" style={{ backgroundColor: T.card, borderColor: T.border }}>
                  <p className="text-[13px]" style={{ color: T.textFaint }}>日付を選択すると自動で集計されます</p>
                </div>
              )}
            </div>
          )}

          {/* Other pages */}
          {activePage !== "HOME" && activePage !== "顧客一覧" && activePage !== "顧客登録" && activePage !== "営業締め" && activePage !== "ポイント管理" && (
            <div className="animate-[fadeIn_0.4s]">
              <div className="rounded-2xl border p-8" style={{ backgroundColor: T.card, borderColor: T.border }}>
                <div className="flex flex-col items-center justify-center py-20">
                  <div className="w-[72px] h-[72px] rounded-2xl flex items-center justify-center mb-5" style={{ backgroundColor: T.cardAlt }}><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={T.textFaint} strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg></div>
                  <h3 className="text-[15px] mb-1.5" style={{ color: T.textSub }}>{activePage}</h3>
                  <p className="text-[12px]" style={{ color: T.textFaint }}>この機能は次のステップで実装します</p>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Edit Modal */}
      {editingCustomer && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setEditingCustomer(null)}>
          <div className="rounded-2xl border p-8 w-full max-w-lg max-h-[90vh] overflow-y-auto animate-[fadeIn_0.25s]" style={{ backgroundColor: T.card, borderColor: T.border }} onClick={(e) => e.stopPropagation()}>
            <div className="mb-6"><h2 className="text-[16px] font-medium">顧客情報を編集</h2></div>
            <div className="space-y-4">
              <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>名前（スタッフ管理用） <span style={{ color: "#c49885" }}>*</span></label><input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full px-4 py-3 rounded-xl text-[13px] outline-none" style={inputStyle} /><p className="text-[9px] mt-1" style={{ color: T.textFaint }}>スタッフがタイムチャート等で使う管理用の名前</p></div>
              <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>👤 会員登録名（お客様用）</label><input type="text" value={editSelfName} onChange={(e) => setEditSelfName(e.target.value)} placeholder="お客様が設定した名前" className="w-full px-4 py-3 rounded-xl text-[13px] outline-none" style={inputStyle} /><p className="text-[9px] mt-1" style={{ color: T.textFaint }}>お客様がマイページで見る名前・パスワード再発行メールにも使用</p></div>
              <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>電話番号①</label><input type="tel" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} className="w-full px-4 py-3 rounded-xl text-[13px] outline-none" style={inputStyle} /></div>
              <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>電話番号②</label><input type="tel" value={editPhone2} onChange={(e) => setEditPhone2(e.target.value)} className="w-full px-4 py-3 rounded-xl text-[13px] outline-none" style={inputStyle} /></div>
              <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>電話番号③</label><input type="tel" value={editPhone3} onChange={(e) => setEditPhone3(e.target.value)} className="w-full px-4 py-3 rounded-xl text-[13px] outline-none" style={inputStyle} /></div>
              <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>メールアドレス</label><input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} className="w-full px-4 py-3 rounded-xl text-[13px] outline-none" style={inputStyle} /></div>
              {editingCustomer?.login_email && <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>📱 マイページ登録メール（本人登録）</label><p className="px-4 py-3 rounded-xl text-[13px]" style={{ backgroundColor: "#3b82f608", color: "#3b82f6", border: "1px solid #3b82f622" }}>{editingCustomer.login_email}</p></div>}
              <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>🎂 誕生日</label><input type="date" value={editBirthday} onChange={(e) => setEditBirthday(e.target.value)} className="w-full px-4 py-3 rounded-xl text-[13px] outline-none" style={inputStyle} /></div>
              <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>お客様ランク</label><RankSelector value={editRank} onChange={setEditRank} /></div>
              <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>備考</label><textarea rows={3} value={editNotes} onChange={(e) => setEditNotes(e.target.value)} className="w-full px-4 py-3 rounded-xl text-[13px] outline-none resize-none" style={inputStyle} /></div>
              {editMsg && <div className="px-4 py-3 rounded-xl text-[12px]" style={{ backgroundColor: editMsg.includes("失敗") || editMsg.includes("入力") ? "#c4988518" : "#7ab88f18", color: editMsg.includes("失敗") || editMsg.includes("入力") ? "#c49885" : "#5a9e6f" }}>{editMsg}</div>}
              <div className="flex gap-3 pt-2">
                <button onClick={handleUpdate} disabled={editSaving} className="px-7 py-3 bg-gradient-to-r from-[#c3a782] to-[#b09672] text-white text-[12px] rounded-xl cursor-pointer disabled:opacity-60">{editSaving ? "更新中..." : "更新する"}</button>
                <button onClick={() => setEditingCustomer(null)} className="px-7 py-3 border text-[12px] rounded-xl cursor-pointer" style={{ borderColor: T.border, color: T.textSub }}>キャンセル</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setDeleteTarget(null)}>
          <div className="rounded-2xl border p-8 w-full max-w-sm text-center animate-[fadeIn_0.25s]" style={{ backgroundColor: T.card, borderColor: T.border }} onClick={(e) => e.stopPropagation()}>
            <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-5" style={{ backgroundColor: "#c4555518" }}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#c45555" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></div>
            <h3 className="text-[15px] font-medium mb-2">顧客を削除しますか？</h3>
            <p className="text-[12px] mb-6" style={{ color: T.textMuted }}>「{deleteTarget.name}」を削除すると元に戻せません</p>
            <div className="flex gap-3 justify-center">
              <button onClick={handleDelete} disabled={deleting} className="px-6 py-2.5 bg-[#c45555] text-white text-[12px] rounded-xl cursor-pointer disabled:opacity-60">{deleting ? "削除中..." : "削除する"}</button>
              <button onClick={() => setDeleteTarget(null)} className="px-6 py-2.5 border text-[12px] rounded-xl cursor-pointer" style={{ borderColor: T.border, color: T.textSub }}>キャンセル</button>
            </div>
          </div>
        </div>
      )}

      {/* Merge Modal */}
      {mergeSource && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setMergeSource(null)}>
          <div className="rounded-2xl border p-8 w-full max-w-md animate-[fadeIn_0.25s]" style={{ backgroundColor: T.card, borderColor: T.border }} onClick={(e) => e.stopPropagation()}>
            <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-5" style={{ backgroundColor: "#8b5cf618" }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            </div>
            <h3 className="text-[15px] font-medium mb-1 text-center">顧客データ統合</h3>
            <p className="text-[11px] mb-5 text-center" style={{ color: T.textMuted }}>「{mergeSource.name}」のデータを別の顧客に統合します</p>
            <div className="rounded-xl p-4 mb-4" style={{ backgroundColor: T.cardAlt }}>
              <p className="text-[10px] font-medium mb-2" style={{ color: "#8b5cf6" }}>📋 統合される内容</p>
              <p className="text-[10px]" style={{ color: T.textSub }}>来店履歴・ポイント・予約・セラピストメモ・お気に入り・通知</p>
            </div>
            <div className="mb-4">
              <label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>統合先の顧客を選択</label>
              <input type="text" placeholder="名前・電話番号で検索" value={mergeSearch} onChange={e => setMergeSearch(e.target.value)} className="w-full px-4 py-2.5 rounded-xl text-[12px] outline-none mb-2" style={inputStyle} />
              <div className="max-h-[200px] overflow-y-auto rounded-xl border" style={{ borderColor: T.border }}>
                {customers.filter(c => c.id !== mergeSource.id && (mergeSearch === "" || c.name?.toLowerCase().includes(mergeSearch.toLowerCase()) || c.phone?.includes(mergeSearch) || c.self_name?.toLowerCase().includes(mergeSearch.toLowerCase()))).map(c => (
                  <div key={c.id} onClick={() => setMergeTargetId(c.id)} className="px-4 py-2.5 cursor-pointer flex items-center justify-between text-[12px] transition-colors" style={{ backgroundColor: mergeTargetId === c.id ? "#8b5cf612" : "transparent", borderBottom: `1px solid ${T.cardAlt}` }}>
                    <div><span className="font-medium">{c.name}</span>{c.self_name && c.self_name !== c.name && <span className="text-[10px] ml-1.5" style={{ color: T.textMuted }}>({c.self_name})</span>}</div>
                    <span className="text-[10px]" style={{ color: T.textMuted }}>{c.phone}</span>
                  </div>
                ))}
              </div>
            </div>
            {mergeTargetId > 0 && (() => { const t = customers.find(c => c.id === mergeTargetId); return t ? (
              <div className="rounded-xl p-3 mb-4 text-[11px]" style={{ backgroundColor: "#f59e0b12", border: "1px solid #f59e0b33" }}>
                <p style={{ color: "#f59e0b" }}>⚠️ 「<b>{mergeSource.name}</b>」→「<b>{t.name}</b>」に統合</p>
                <p className="mt-1" style={{ color: T.textMuted }}>統合元（{mergeSource.name}）は削除されます。この操作は取り消せません。</p>
              </div>
            ) : null; })()}
            {mergeMsg && <div className="px-4 py-3 rounded-xl text-[12px] mb-3" style={{ backgroundColor: mergeMsg.includes("完了") ? "#4a7c5912" : "#c4555512", color: mergeMsg.includes("完了") ? "#5a9e6f" : "#c45555" }}>{mergeMsg}</div>}
            <div className="flex gap-3 justify-center">
              <button onClick={handleMerge} disabled={merging || !mergeTargetId} className="px-6 py-2.5 text-white text-[12px] rounded-xl cursor-pointer disabled:opacity-40" style={{ backgroundColor: "#8b5cf6" }}>{merging ? "統合中..." : "統合する"}</button>
              <button onClick={() => setMergeSource(null)} className="px-6 py-2.5 border text-[12px] rounded-xl cursor-pointer" style={{ borderColor: T.border, color: T.textSub }}>キャンセル</button>
            </div>
          </div>
        </div>
      )}

      {/* Detail + History Modal */}
      {detailCustomer && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setDetailCustomer(null)}>
          <div className="rounded-2xl border w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-[fadeIn_0.25s]" style={{ backgroundColor: T.card, borderColor: T.border }} onClick={(e) => e.stopPropagation()}>
            {/* Customer Info */}
            <div className="px-6 py-5" style={{ borderBottom: `1px solid ${T.border}` }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full flex items-center justify-center text-[18px] font-medium" style={{ backgroundColor: T.cardAlt, color: T.textSub }}>{detailCustomer.name?.charAt(0)}</div>
                  <div>
                    <div className="flex items-center gap-2"><h2 className="text-[18px] font-medium">{detailCustomer.name}</h2><RankBadge rank={detailCustomer.rank || "normal"} /></div>
                    {detailCustomer.self_name && detailCustomer.self_name !== detailCustomer.name && <p className="text-[11px] mt-0.5" style={{ color: T.textMuted }}>👤 お客様登録名: {detailCustomer.self_name}</p>}
                    <div className="flex flex-wrap gap-3 mt-1 text-[12px]" style={{ color: T.textSub }}>
                      {detailCustomer.phone && <span>📱 {detailCustomer.phone}</span>}
                      {detailCustomer.phone2 && <span>📱 {detailCustomer.phone2}</span>}
                      {detailCustomer.phone3 && <span>📱 {detailCustomer.phone3}</span>}
                      {detailCustomer.email && <span>✉ {detailCustomer.email}</span>}
                      {detailCustomer.birthday && <span>🎂 {new Date(detailCustomer.birthday + "T00:00:00").toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" })}</span>}
                    </div>
                    {detailCustomer.notes && <p className="text-[11px] mt-1" style={{ color: T.textMuted }}>📝 {detailCustomer.notes}</p>}
                    <p className="text-[10px] mt-1" style={{ color: T.textFaint }}>📅 登録日: {new Date(detailCustomer.created_at).toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" })}</p>
                  </div>
                </div>
                <button onClick={() => setDetailCustomer(null)} className="text-[14px] cursor-pointer p-2" style={{ color: T.textSub }}>✕</button>
              </div>
            </div>

            {/* Visit History */}
            <div className="px-6 py-4">

              {/* ポイント管理 */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[14px] font-medium">🎁 ポイント（残高: <span style={{ color: "#d4a843" }}>{custPoints.reduce((s,p) => s+p.amount, 0).toLocaleString()}pt</span>）</h3>
                </div>
                <div className="rounded-xl border p-4 mb-3" style={{ borderColor: T.border, backgroundColor: T.cardAlt }}>
                  <p className="text-[10px] font-medium mb-2" style={{ color: "#d4a843" }}>➕➖ 手動ポイント調整</p>
                  <div className="flex gap-2 items-end">
                    <div className="w-[100px]"><label className="block text-[9px] mb-0.5" style={{ color: T.textMuted }}>ポイント</label><input type="text" inputMode="numeric" value={manualPt} onChange={e => setManualPt(e.target.value.replace(/[^0-9-]/g, ""))} placeholder="100 or -50" className="w-full px-2 py-2 rounded-lg text-[11px] outline-none" style={{ backgroundColor: T.card, color: T.text, border: `1px solid ${T.border}` }} /></div>
                    <div className="flex-1"><label className="block text-[9px] mb-0.5" style={{ color: T.textMuted }}>理由</label><input type="text" value={manualPtDesc} onChange={e => setManualPtDesc(e.target.value)} placeholder="例: アンケート回答" className="w-full px-2 py-2 rounded-lg text-[11px] outline-none" style={{ backgroundColor: T.card, color: T.text, border: `1px solid ${T.border}` }} /></div>
                    <button disabled={ptSaving || !manualPt} onClick={async () => { if (!detailCustomer || !manualPt) return; const mp = parseInt(manualPt); if (mp === 0) return; setPtSaving(true); const expAt = new Date(); expAt.setMonth(expAt.getMonth() + 12); await supabase.from("customer_points").insert({ customer_id: detailCustomer.id, amount: mp, type: mp > 0 ? "earn" : "use", description: manualPtDesc.trim() || (mp > 0 ? "手動ポイント付与" : "手動ポイント減算"), expires_at: mp > 0 ? expAt.toISOString() : null }); setManualPt(""); setManualPtDesc(""); setPtSaving(false); supabase.from("customer_points").select("*").eq("customer_id", detailCustomer.id).order("created_at", { ascending: false }).then(({ data }) => { if (data) setCustPoints(data); }); }} className="px-3 py-2 text-[10px] rounded-lg cursor-pointer text-white disabled:opacity-50" style={{ backgroundColor: "#d4a843" }}>{ptSaving ? "..." : "付与"}</button>
                  </div>
                </div>
                {custPoints.length > 0 && (<div className="space-y-1 max-h-[150px] overflow-y-auto">{custPoints.slice(0, 10).map(p => (<div key={p.id} className="flex items-center justify-between px-3 py-2 rounded-lg text-[11px]" style={{ backgroundColor: T.cardAlt }}><div className="min-w-0 flex-1"><p className="truncate">{p.description || (p.type === "earn" ? "ポイント付与" : "ポイント利用")}</p><span className="text-[9px]" style={{ color: T.textMuted }}>{new Date(p.created_at).toLocaleDateString("ja-JP")}{p.expires_at && ` / 期限:${new Date(p.expires_at).toLocaleDateString("ja-JP")}`}</span></div><span className="font-bold ml-2 flex-shrink-0" style={{ color: p.amount > 0 ? "#4a7c59" : "#c45555" }}>{p.amount > 0 ? "+" : ""}{p.amount.toLocaleString()}pt</span></div>))}{custPoints.length > 10 && <p className="text-[9px] text-center py-1" style={{ color: T.textFaint }}>他{custPoints.length - 10}件</p>}</div>)}
              </div>

              {/* セラピストメモ */}
              {customerNotes.length > 0 && (
                <div className="mb-6">
                  {/* NG サマリー */}
                  {(() => {
                    const ngNotes = customerNotes.filter(cn => cn.is_ng);
                    const activeNg = ngNotes.filter(cn => { const th = therapists.find(t => t.id === cn.therapist_id); return th?.status === "active"; });
                    const inactiveNg = ngNotes.filter(cn => { const th = therapists.find(t => t.id === cn.therapist_id); return th && th.status !== "active"; });
                    if (ngNotes.length > 0) return (
                      <div className="rounded-xl p-3 mb-3" style={{ backgroundColor: activeNg.length >= 5 ? "#c4555518" : activeNg.length >= 3 ? "#f59e0b18" : "#88878018", border: `1px solid ${activeNg.length >= 5 ? "#c4555544" : activeNg.length >= 3 ? "#f59e0b44" : "#88878044"}` }}>
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-[12px] font-medium" style={{ color: activeNg.length >= 5 ? "#c45555" : activeNg.length >= 3 ? "#f59e0b" : T.text }}>
                            🚫 NG状況: 稼働中 {activeNg.length}名{inactiveNg.length > 0 && <span style={{ color: T.textMuted, fontWeight: 400 }}>（休止/退職 {inactiveNg.length}名は除外）</span>}
                          </span>
                          {activeNg.length >= 5 && <span className="text-[9px] px-2 py-0.5 rounded-full" style={{ backgroundColor: "#c4555518", color: "#c45555" }}>→ 出禁推奨</span>}
                          {activeNg.length >= 3 && activeNg.length < 5 && <span className="text-[9px] px-2 py-0.5 rounded-full" style={{ backgroundColor: "#f59e0b18", color: "#f59e0b" }}>→ 要注意推奨</span>}
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {ngNotes.map(cn => {
                            const th = therapists.find(t => t.id === cn.therapist_id);
                            const isActive = th?.status === "active";
                            return <span key={cn.id} className="text-[10px] px-2 py-0.5 rounded" style={{ backgroundColor: isActive ? "#c4555518" : "#88878012", color: isActive ? "#c45555" : "#888780", textDecoration: isActive ? "none" : "line-through", opacity: isActive ? 1 : 0.6 }}>{th?.name || "不明"}{!isActive && " (休止/退職)"}</span>;
                          })}
                        </div>
                      </div>
                    );
                    return null;
                  })()}
                  <h3 className="text-[14px] font-medium mb-3">💆 セラピストメモ（{customerNotes.length}件）</h3>
                  <div className="space-y-2">
                    {customerNotes.map((cn) => {
                      const tName = getTherapistName(cn.therapist_id);
                      const th = therapists.find(t => t.id === cn.therapist_id);
                      const isActive = th?.status === "active";
                      const stars = "★".repeat(cn.rating || 0) + "☆".repeat(5 - (cn.rating || 0));
                      return (
                        <div key={cn.id} className="rounded-xl p-3 border" style={{ borderColor: cn.is_ng ? "#c4555544" : T.border, backgroundColor: cn.is_ng ? "#c4555508" : T.cardAlt }}>
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <span className="text-[12px] font-medium">{tName}</span>
                                {th && !isActive && <span className="text-[8px] px-1.5 py-0.5 rounded" style={{ backgroundColor: th.status === "retired" ? "#c4555518" : "#88878018", color: th.status === "retired" ? "#c45555" : "#888780" }}>{th.status === "retired" ? "退職" : "休止"}</span>}
                                {cn.rating > 0 && <span className="text-[10px]" style={{ color: "#f59e0b" }}>{stars}</span>}
                                {cn.is_ng && <span className="text-[9px] px-2 py-0.5 rounded-full" style={{ backgroundColor: "#c4555518", color: "#c45555" }}>⚠ NG{!isActive && "（カウント除外）"}</span>}
                              </div>
                              {cn.note && <p className="text-[11px] whitespace-pre-wrap" style={{ color: T.textSub }}>{cn.note}</p>}
                              {cn.is_ng && cn.ng_reason && <p className="text-[10px] mt-1" style={{ color: "#c45555" }}>NG理由: {cn.ng_reason}</p>}
                            </div>
                            <button onClick={() => deleteCustomerNote(cn.id)} className="text-[9px] px-2 py-1 rounded cursor-pointer flex-shrink-0 ml-2" style={{ color: "#c45555", backgroundColor: "#c4555512" }}>削除</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[14px] font-medium">利用履歴（{visits.length}件）</h3>
                <button onClick={() => { setShowAddVisit(true); setVDate(new Date().toISOString().split("T")[0]); }} className="px-3 py-1.5 bg-gradient-to-r from-[#c3a782] to-[#b09672] text-white text-[10px] rounded-lg cursor-pointer">+ オーダー登録</button>
              </div>

              {visits.length === 0 ? (
                <p className="text-[12px] text-center py-8" style={{ color: T.textFaint }}>利用履歴がありません</p>
              ) : (
                <div className="space-y-2">
                  {visits.map((v) => (
                    <div key={v.id} className="rounded-xl p-4 border" style={{ borderColor: T.border, backgroundColor: T.cardAlt }}>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-1.5">
                            <span className="text-[13px] font-medium" style={{ color: T.accent }}>{v.date}</span>
                            {v.start_time && <span className="text-[11px]" style={{ color: T.textSub }}>{v.start_time}〜{v.end_time}</span>}
                          </div>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px]" style={{ color: T.textSub }}>
                            {v.therapist_id > 0 && <span>💆 {getTherapistName(v.therapist_id)}</span>}
                            {v.store_id > 0 && <span>🏠 {getStoreName(v.store_id)}</span>}
                            {v.course_name && <span>📋 {v.course_name}</span>}
                            {v.nomination && <span>⭐ {v.nomination}</span>}
                          </div>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-[11px]">
                            {v.price > 0 && <span style={{ color: T.text }}>料金: {fmt(v.price)}</span>}
                            {v.discount > 0 && <span style={{ color: "#c45555" }}>割引: -{fmt(v.discount)}</span>}
                            {v.total > 0 && <span className="font-medium" style={{ color: T.accent }}>合計: {fmt(v.total)}</span>}
                            {v.payment_method && <span style={{ color: T.textMuted }}>💳 {v.payment_method}</span>}
                          </div>
                          {v.options && <p className="text-[10px] mt-1" style={{ color: T.textMuted }}>オプション: {v.options}</p>}
                          {v.notes && <p className="text-[10px] mt-1" style={{ color: T.textMuted }}>📝 {v.notes}</p>}
                        </div>
                        <button onClick={() => deleteVisit(v.id)} className="text-[10px] px-2 py-1 rounded cursor-pointer" style={{ color: "#c45555", backgroundColor: "#c4555512" }}>削除</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* キャンセル履歴 */}
              {cancelledRes.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-[14px] font-medium mb-3" style={{ color: "#c45555" }}>🚫 キャンセル履歴（{cancelledRes.length}件）</h3>
                  <div className="space-y-2">
                    {cancelledRes.map(cr => {
                      const cancelMatch = cr.notes?.match(/【(お客様都合|お店都合)キャンセル】(.*)?$/m);
                      const cancelTypeLabel = cancelMatch?.[1] || "";
                      const cancelReasonText = cancelMatch?.[2]?.trim() || "";
                      return (
                        <div key={cr.id} className="rounded-xl p-4 border flex items-start justify-between" style={{ borderColor: "#c4555530", backgroundColor: "#c4555508" }}>
                          <div className="flex-1">
                          <div className="flex items-center gap-3 mb-1.5">
                            <span className="text-[13px] font-medium" style={{ color: "#c45555" }}>{cr.date}</span>
                            {cr.start_time && <span className="text-[11px]" style={{ color: T.textSub }}>{cr.start_time}〜{cr.end_time}</span>}
                            {cancelTypeLabel && <span className="text-[9px] px-2 py-0.5 rounded-full" style={{ backgroundColor: cancelTypeLabel === "お客様都合" ? "#c4555518" : "#3d6b9f18", color: cancelTypeLabel === "お客様都合" ? "#c45555" : "#3d6b9f" }}>{cancelTypeLabel}</span>}
                          </div>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px]" style={{ color: T.textSub }}>
                            {cr.therapist_id > 0 && <span>💆 {getTherapistName(cr.therapist_id)}</span>}
                            {cr.course && <span>📋 {cr.course}</span>}
                            {cr.total_price > 0 && <span style={{ color: T.textMuted }}>料金: {fmt(cr.total_price)}</span>}
                          </div>
                          {cancelReasonText && <p className="text-[10px] mt-1" style={{ color: T.textMuted }}>📝 理由: {cancelReasonText}</p>}
                          </div>
                          <button onClick={async () => { await supabase.from("reservations").update({ status: "unprocessed" }).eq("id", cr.id); if (detailCustomer) { supabase.from("reservations").select("id,date,start_time,end_time,course,therapist_id,total_price,notes,customer_name").eq("customer_name", detailCustomer.name).eq("status", "cancelled").order("date", { ascending: false }).then(({ data }) => { if (data) setCancelledRes(data); }); } fetchAllCancelled(); }} className="text-[10px] px-3 py-1.5 rounded-lg cursor-pointer flex-shrink-0" style={{ color: "#4a7c59", backgroundColor: "#4a7c5910", border: "1px solid #4a7c5925" }}>↩ 復元</button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add Visit Modal */}
      {showAddVisit && detailCustomer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4" onClick={() => setShowAddVisit(false)}>
          <div className="rounded-2xl border p-6 w-full max-w-md max-h-[85vh] overflow-y-auto animate-[fadeIn_0.25s]" style={{ backgroundColor: T.card, borderColor: T.border }} onClick={(e) => e.stopPropagation()}>
            <h2 className="text-[15px] font-medium mb-4">オーダー登録</h2>
            <div className="space-y-3">
              <div><label className="block text-[10px] mb-1" style={{ color: T.textSub }}>日付 *</label><input type="date" value={vDate} onChange={(e) => setVDate(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="block text-[10px] mb-1" style={{ color: T.textSub }}>開始時間</label><select value={vStart} onChange={(e) => setVStart(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none cursor-pointer" style={inputStyle}>{TIMES.map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
                <div><label className="block text-[10px] mb-1" style={{ color: T.textSub }}>終了時間</label><select value={vEnd} onChange={(e) => setVEnd(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none cursor-pointer" style={inputStyle}>{TIMES.map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
              </div>
              <div><label className="block text-[10px] mb-1" style={{ color: T.textSub }}>セラピスト</label><select value={vTherapistId} onChange={(e) => setVTherapistId(Number(e.target.value))} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none cursor-pointer" style={inputStyle}><option value={0}>選択なし</option>{therapists.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
              <div><label className="block text-[10px] mb-1" style={{ color: T.textSub }}>ルーム</label><select value={vStoreId} onChange={(e) => setVStoreId(Number(e.target.value))} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none cursor-pointer" style={inputStyle}><option value={0}>選択なし</option>{storesList.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
              <div><label className="block text-[10px] mb-1" style={{ color: T.textSub }}>コース</label><select value={vCourseId} onChange={(e) => setVCourseId(Number(e.target.value))} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none cursor-pointer" style={inputStyle}><option value={0}>選択なし</option>{courses.map((c) => <option key={c.id} value={c.id}>{c.name}（{fmt(c.price)}）</option>)}</select></div>
              <div><label className="block text-[10px] mb-1" style={{ color: T.textSub }}>指名種別</label><input type="text" value={vNomination} onChange={(e) => setVNomination(e.target.value)} placeholder="本指名/写真指名/フリー" className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} /></div>
              <div><label className="block text-[10px] mb-1" style={{ color: T.textSub }}>オプション</label><input type="text" value={vOptions} onChange={(e) => setVOptions(e.target.value)} placeholder="オプション内容" className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} /></div>
              <div><label className="block text-[10px] mb-1" style={{ color: T.textSub }}>割引額</label><input type="text" inputMode="numeric" value={vDiscount} onChange={(e) => setVDiscount(e.target.value.replace(/[^0-9]/g, ""))} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} /></div>
              <div><label className="block text-[10px] mb-1" style={{ color: T.textSub }}>支払方法</label><input type="text" value={vPayment} onChange={(e) => setVPayment(e.target.value)} placeholder="現金/カード" className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} /></div>
              <div><label className="block text-[10px] mb-1" style={{ color: T.textSub }}>メモ</label><input type="text" value={vNotes} onChange={(e) => setVNotes(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} /></div>
              <div className="flex gap-3 pt-2">
                <button onClick={handleAddVisit} disabled={vSaving} className="px-6 py-2.5 bg-gradient-to-r from-[#c3a782] to-[#b09672] text-white text-[11px] rounded-xl cursor-pointer disabled:opacity-60">{vSaving ? "登録中..." : "登録する"}</button>
                <button onClick={() => setShowAddVisit(false)} className="px-6 py-2.5 border text-[11px] rounded-xl cursor-pointer" style={{ borderColor: T.border, color: T.textSub }}>キャンセル</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PIN Login Modal */}
      {showPinModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowPinModal(false)}>
          <div className="rounded-2xl w-full max-w-[300px] p-6 animate-[fadeIn_0.25s]" style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }} onClick={(e) => e.stopPropagation()}>
            <h2 className="text-[16px] font-medium text-center mb-1">🔑 スタッフログイン</h2>
            <p className="text-[11px] text-center mb-5" style={{ color: T.textFaint }}>4桁のPINコードを入力</p>
            <div className="flex justify-center gap-2 mb-4">
              {[0, 1, 2, 3].map(i => (
                <div key={i} className="w-12 h-14 rounded-xl flex items-center justify-center text-[22px] font-bold" style={{ backgroundColor: T.cardAlt, color: pinInput[i] ? T.text : T.textFaint, border: `2px solid ${pinInput.length === i ? "#c3a782" : T.border}` }}>
                  {pinInput[i] ? "●" : ""}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, null, 0, "del"].map((n, i) => {
                if (n === null) return <div key={i} />;
                return (
                  <button key={i} onClick={() => {
                    if (n === "del") { setPinInput(prev => prev.slice(0, -1)); setPinError(""); return; }
                    const next = pinInput + String(n);
                    if (next.length > 4) return;
                    setPinInput(next); setPinError("");
                    if (next.length === 4) {
                      login(next).then(({ ok }) => {
                        if (ok) { setShowPinModal(false); }
                        else { setPinError("PINが一致しません"); setPinInput(""); }
                      });
                    }
                  }} data-pin-key={n === "del" ? "del" : String(n)} className="h-12 rounded-xl text-[16px] font-medium cursor-pointer" style={{ backgroundColor: T.cardAlt, color: n === "del" ? "#c45555" : T.text, border: `1px solid ${T.border}` }}>
                    {n === "del" ? "⌫" : n}
                  </button>
                );
              })}
            </div>
            {pinError && <p className="text-[11px] text-center" style={{ color: "#c45555" }}>{pinError}</p>}
            <button onClick={() => setShowPinModal(false)} className="w-full mt-2 py-2 text-[11px] rounded-xl cursor-pointer border" style={{ borderColor: T.border, color: T.textSub }}>キャンセル</button>
          </div>
        </div>
      )}
      {/* Safe List Modal */}
      {showSafeList && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => { setShowSafeList(false); const rd = new URLSearchParams(window.location.search).get("returnDate"); if (rd) router.push("/timechart?date=" + rd); }}>
          <div className="rounded-2xl border p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto animate-[fadeIn_0.25s]" style={{ backgroundColor: T.card, borderColor: T.border }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div><h2 className="text-[16px] font-medium">🔐 金庫管理</h2><p className="text-[11px]" style={{ color: T.textFaint }}>投函・回収の一覧</p></div>
              <button onClick={() => { setShowSafeList(false); const rd = new URLSearchParams(window.location.search).get("returnDate"); if (rd) router.push("/timechart?date=" + rd); }} className="text-[18px] cursor-pointer" style={{ color: T.textMuted, background: "none", border: "none" }}>&times;</button>
            </div>
            <div className="space-y-4">
              <div className="rounded-xl p-4" style={{ backgroundColor: "#a855f712", border: "1px solid #a855f733" }}>
                <p className="text-[10px] font-medium mb-2" style={{ color: "#a855f7" }}>未回収（金庫内）</p>
                {safeUncollected.length === 0 ? <p className="text-[11px] text-center py-3" style={{ color: T.textFaint }}>金庫に未回収の投函はありません</p> : (
                <div className="space-y-1">
                  {safeUncollected.map(s => {
                    const safeAmount = Math.max(s.total_cash - s.final_payment, 0) + s.replenish;
                    return <div key={s.id} className="flex items-center justify-between py-1.5 px-3 rounded-lg text-[11px]" style={{ backgroundColor: T.cardAlt }}>
                      <span>{s.date.slice(5)} {s.therapist_name} <span style={{ color: T.textFaint, fontSize: 9 }}>({s.room_label})</span></span>
                      <div className="flex items-center gap-2">
                        <span style={{ color: "#a855f7", fontWeight: 700 }}>{fmt(safeAmount)}</span>
                        <button onClick={async () => { const ok = await confirm({ title: `${s.therapist_name} の ${fmt(safeAmount)} を回収しますか？`, message: "金庫内の当該セラピスト分を回収済みとして記録します。", variant: "warning", confirmLabel: "回収する", icon: "🔐" }); if (!ok) return; const today = new Date().toISOString().split("T")[0]; await supabase.from("therapist_daily_settlements").update({ safe_collected_date: today }).eq("id", s.id); setSafeUncollected(prev => prev.filter(x => x.id !== s.id)); if (activePage === "営業締め") fetchClosingReport(closingDate); }} className="text-[8px] px-2 py-1 rounded cursor-pointer" style={{ backgroundColor: "#a855f718", color: "#a855f7", border: "1px solid #a855f744" }}>回収</button>
                      </div>
                    </div>;
                  })}
                  <div className="flex justify-between font-bold text-[13px] pt-2" style={{ borderTop: "1px solid #a855f733", color: "#a855f7" }}>
                    <span>金庫内合計</span>
                    <span>{fmt(safeUncollected.reduce((s, x) => s + Math.max(x.total_cash - x.final_payment, 0) + x.replenish, 0))}</span>
                  </div>
                  <button onClick={async () => { const ok = await confirm({ title: "金庫内の全額を回収しますか？", message: `${safeUncollected.length} 件のセラピスト分すべてを本日付で回収済みに更新します。`, variant: "warning", confirmLabel: "全額回収する", icon: "📦" }); if (!ok) return; const today = new Date().toISOString().split("T")[0]; for (const s of safeUncollected) { await supabase.from("therapist_daily_settlements").update({ safe_collected_date: today }).eq("id", s.id); } setSafeUncollected([]); if (activePage === "営業締め") fetchClosingReport(closingDate); }} className="w-full px-3 py-2 bg-gradient-to-r from-[#a855f7] to-[#9333ea] text-white text-[11px] rounded-xl cursor-pointer font-medium mt-2">📦 全額回収</button>
                </div>
                )}
              </div>
              <div className="rounded-xl p-4" style={{ backgroundColor: T.cardAlt }}>
                <p className="text-[10px] font-medium mb-2" style={{ color: "#22c55e" }}>回収履歴（直近20件）</p>
                {safeHistory.length === 0 ? <p className="text-[11px] text-center py-3" style={{ color: T.textFaint }}>回収履歴はありません</p> : (
                <div className="space-y-1">
                  {safeHistory.map(s => {
                    const safeAmount = Math.max(s.total_cash - s.final_payment, 0) + s.replenish;
                    return <div key={s.id} className="flex items-center justify-between py-1 px-2 text-[10px]">
                      <span style={{ color: T.textSub }}><span style={{ color: "#22c55e" }}>回収{s.safe_collected_date?.slice(5)}</span> | 投函{s.date.slice(5)} {s.therapist_name} <span style={{ fontSize: 8, color: T.textFaint }}>({s.room_label})</span></span>
                      <div className="flex items-center gap-2">
                        <span style={{ color: "#22c55e" }}>{fmt(safeAmount)}</span>
                        <button onClick={async () => { const ok = await confirm({ title: "この回収を取り消しますか？", message: `${s.therapist_name} の金庫回収を未回収に戻します。`, variant: "danger", confirmLabel: "取り消す" }); if (!ok) return; await supabase.from("therapist_daily_settlements").update({ safe_collected_date: null }).eq("id", s.id); setSafeHistory(prev => prev.filter(x => x.id !== s.id)); setSafeUncollected(prev => [...prev, { id: s.id, date: s.date, total_cash: s.total_cash, final_payment: s.final_payment, room_id: s.room_id, therapist_name: s.therapist_name, room_label: s.room_label, replenish: s.replenish }]); if (activePage === "営業締め") fetchClosingReport(closingDate); }} className="text-[7px] px-1.5 py-0.5 rounded cursor-pointer" style={{ backgroundColor: "#c4555512", color: "#c45555", border: "none" }}>取消</button>
                      </div>
                    </div>;
                  })}
                </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Monthly Back Rate Results Modal */}
      {showMonthlyModal && monthlyResults.length > 0 && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowMonthlyModal(false)}>
          <div className="rounded-2xl border w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-[fadeIn_0.25s]" style={{ backgroundColor: T.card, borderColor: T.border }} onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-5 flex items-center justify-between" style={{ borderBottom: `1px solid ${T.border}` }}>
              <div><h2 className="text-[16px] font-medium">📊 月次バックレート計算結果</h2><p className="text-[11px] mt-1" style={{ color: T.textMuted }}>{monthlyTarget}月分 → 翌月に反映済み</p></div>
              <button onClick={() => setShowMonthlyModal(false)} className="text-[14px] cursor-pointer p-2" style={{ color: T.textSub }}>✕</button>
            </div>
            <div className="px-6 py-4 space-y-3">
              {monthlyResults.map((r) => {
                const change = r.back_increase > r.prev_increase ? "up" : r.back_increase < r.prev_increase ? "down" : "same";
                return (
                  <div key={r.therapist_id} className="rounded-xl p-4" style={{ backgroundColor: T.cardAlt }}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[14px] font-medium">{r.name}</span>
                        {change === "up" && <span className="px-2 py-0.5 rounded-full text-[9px] font-medium" style={{ backgroundColor: "#4a7c5918", color: "#4a7c59" }}>UP</span>}
                        {change === "down" && <span className="px-2 py-0.5 rounded-full text-[9px] font-medium" style={{ backgroundColor: "#c4555518", color: "#c45555" }}>DOWN</span>}
                        {change === "same" && <span className="px-2 py-0.5 rounded-full text-[9px] font-medium" style={{ backgroundColor: "#88878018", color: "#888780" }}>維持</span>}
                      </div>
                      <button onClick={() => copyLineMsg(r)} className="px-3 py-1.5 text-[10px] rounded-lg cursor-pointer flex items-center gap-1" style={{ backgroundColor: "#06C75518", color: "#06C755" }}>
                        {copiedId === r.therapist_id ? "✓ コピー済み" : "LINE用コピー"}
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-[11px]" style={{ color: T.textSub }}>
                      <span>出勤: {r.work_days}日</span><span>接客: {r.sessions}本</span><span>本指名率: {r.nom_rate}%</span>
                      <span>当欠: {r.absences}回</span><span>遅刻: {r.lates}回</span><span>早退: {r.early_leaves}回</span>
                    </div>
                    <p className="text-[12px] mt-2 font-medium" style={{ color: change === "up" ? "#4a7c59" : change === "down" ? "#c45555" : T.textSub }}>
                      {r.back_increase > 0 ? `${r.salary_type === "percent" ? r.back_increase + "%" : r.back_increase.toLocaleString() + "円"}UP` : "基本レート"}
                      {change !== "same" && ` （前月: ${r.prev_increase > 0 ? r.prev_increase.toLocaleString() + "円UP" : "基本"}）`}
                    </p>
                  </div>
                );
              })}
              <button onClick={() => { monthlyResults.forEach(r => copyLineMsg(r)); }} className="w-full py-3 rounded-xl text-[12px] font-medium cursor-pointer" style={{ backgroundColor: "#06C75518", color: "#06C755" }}>全員分を順番にコピー</button>
            </div>
          </div>
        </div>
      )}

      {/* NG登録モーダル */}
      {showNgRegister && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => { setShowNgRegister(false); setNgSelectedCust(null); setNgCustSearch(""); setNgTherapistId(0); setNgReason(""); setNgMsg(""); }}>
          <div className="rounded-2xl w-full max-w-md animate-[fadeIn_0.25s]" style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }} onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: `1px solid ${T.border}` }}>
              <h2 className="text-[16px] font-medium" style={{ color: "#c45555" }}>🚫 NG登録</h2>
              <button onClick={() => { setShowNgRegister(false); setNgSelectedCust(null); setNgCustSearch(""); setNgTherapistId(0); setNgReason(""); setNgMsg(""); }} className="text-[14px] cursor-pointer p-2" style={{ color: T.textSub, background: "none", border: "none" }}>✕</button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="rounded-xl p-3" style={{ backgroundColor: "#85a8c410", border: "1px solid #85a8c430" }}>
                <p className="text-[10px] leading-relaxed" style={{ color: T.textSub }}>
                  🛡️ NG登録されたお客様は、ネット予約時にそのセラピストの出勤枠が<span style={{ color: "#c45555", fontWeight: 600 }}>すべてお休み表示</span>になります。
                  タイムチャートでのオーダー登録時もセラピスト名の横に<span style={{ color: "#c45555", fontWeight: 600 }}>⚠️NG</span>と表示されます。
                </p>
                <p className="text-[10px] mt-1" style={{ color: T.textMuted }}>稼働中セラピストのNG登録が<span style={{ color: "#f59e0b", fontWeight: 600 }}>3件で要注意</span>、<span style={{ color: "#c45555", fontWeight: 600 }}>5件以上で出禁</span>に自動変更されます（休止・退職セラピストは除外）。</p>
              </div>
              {/* お客様選択 */}
              <div>
                <label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>お客様を検索・選択</label>
                {ngSelectedCust ? (
                  <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl" style={{ backgroundColor: "#c4555512", border: "1px solid #c4555544" }}>
                    <span className="text-[13px] font-medium flex-1" style={{ color: "#c45555" }}>{ngSelectedCust.name}</span>
                    <RankBadge rank={ngSelectedCust.rank || "normal"} />
                    <button onClick={() => { setNgSelectedCust(null); setNgCustSearch(""); }} className="text-[11px] cursor-pointer" style={{ color: "#c45555", background: "none", border: "none" }}>✕</button>
                  </div>
                ) : (
                  <>
                    <input type="text" placeholder="名前・電話番号で検索" value={ngCustSearch} onChange={e => setNgCustSearch(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} />
                    {ngCustSearch.length >= 1 && (
                      <div className="mt-1 max-h-[150px] overflow-y-auto rounded-xl border" style={{ borderColor: T.border }}>
                        {customers.filter(c => c.name?.includes(ngCustSearch) || c.phone?.includes(ngCustSearch)).slice(0, 10).map(c => (
                          <button key={c.id} onClick={() => { setNgSelectedCust(c); setNgCustSearch(""); }} className="w-full text-left px-3 py-2 text-[12px] cursor-pointer flex items-center gap-2" style={{ borderBottom: `1px solid ${T.border}`, backgroundColor: T.cardAlt, color: T.text }}>
                            <span>{c.name}</span>
                            <RankBadge rank={c.rank || "normal"} />
                            {c.phone && <span className="text-[10px]" style={{ color: T.textMuted }}>{c.phone}</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* セラピスト選択 */}
              <div>
                <label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>NGにするセラピスト</label>
                <select value={ngTherapistId} onChange={e => setNgTherapistId(Number(e.target.value))} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none cursor-pointer" style={inputStyle}>
                  <option value={0}>— セラピストを選択 —</option>
                  {therapists.filter(t => t.status === "active").map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>

              {/* NG理由 */}
              <div>
                <label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>NG理由（任意）</label>
                <textarea value={ngReason} onChange={e => setNgReason(e.target.value)} placeholder="理由を入力（任意）" rows={2} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none resize-none" style={inputStyle} />
              </div>

              {ngMsg && <div className="px-4 py-3 rounded-xl text-[12px]" style={{ backgroundColor: ngMsg.startsWith("✅") ? "#4a7c5918" : "#c4555518", color: ngMsg.startsWith("✅") ? "#4a7c59" : "#c45555" }}>{ngMsg}</div>}

              <div className="flex gap-3">
                <button onClick={registerNg} disabled={ngSaving || !ngSelectedCust || !ngTherapistId} className="px-6 py-3 rounded-xl text-[13px] font-medium cursor-pointer text-white disabled:opacity-50" style={{ backgroundColor: "#c45555" }}>
                  {ngSaving ? "登録中..." : "🚫 NG登録する"}
                </button>
                <button onClick={() => { setShowNgRegister(false); setNgSelectedCust(null); setNgCustSearch(""); setNgTherapistId(0); setNgReason(""); setNgMsg(""); }} className="px-6 py-3 border text-[13px] rounded-xl cursor-pointer" style={{ borderColor: T.border, color: T.textSub }}>閉じる</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 顧客インポート */}
      {showCustImport && (
        <Suspense fallback={null}>
          <CustomerImportPanel T={T} onClose={() => setShowCustImport(false)} onComplete={fetchCustomers} />
        </Suspense>
      )}

      {/* NGインポート */}
      {showNgImport && (
        <Suspense fallback={null}>
          <NgImportPanel T={T} onClose={() => setShowNgImport(false)} onComplete={fetchCustomers} />
        </Suspense>
      )}

      <style jsx global>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  );
}
