"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";
import { useTheme } from "../../lib/theme";
import { NavMenu } from "../../lib/nav-menu";
import { useStaffSession } from "../../lib/staff-session";

type Customer = {
  id: number; created_at: string; name: string; phone: string; phone2: string; phone3: string;
  email: string; notes: string; user_id: string; rank: string;
};
type Visit = {
  id: number; customer_id: number; date: string; start_time: string; end_time: string;
  therapist_id: number; store_id: number; course_name: string; price: number;
  therapist_back: number; nomination: string; options: string; discount: number;
  total: number; payment_method: string; notes: string;
};
type Therapist = { id: number; name: string };
type Store = { id: number; name: string };
type Course = { id: number; name: string; duration: number; price: number; therapist_back: number };
type CustomerNote = { id: number; therapist_id: number; customer_name: string; note: string; is_ng: boolean; ng_reason: string; rating: number };

const RANKS: Record<string, { label: string; color: string; bg: string; desc: string }> = {
  banned: { label: "出禁", color: "#c45555", bg: "#c4555518", desc: "一切当店の利用を禁止" },
  caution: { label: "要注意", color: "#f59e0b", bg: "#f59e0b18", desc: "予約を取る際は注意" },
  normal: { label: "普通", color: "#888780", bg: "#88878018", desc: "デフォルト" },
  good: { label: "善良", color: "#4a7c59", bg: "#4a7c5918", desc: "とても良いお客様" },
};

const menuItems = [
  { label: "HOME", icon: "home", sub: [] },
  { label: "営業締め", icon: "clipboard", sub: [] },
  { label: "顧客管理", icon: "users", sub: ["顧客一覧", "顧客登録"] },
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
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState("");
  const [userId, setUserId] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [openMenus, setOpenMenus] = useState<string[]>(["HOME"]);
  const [activePage, setActivePage] = useState("HOME");
  useEffect(() => { const params = new URLSearchParams(window.location.search); const p = params.get("page"); if (p) setActivePage(p); const d = params.get("date"); if (d) setClosingDate(d); if (params.get("openSafe")) { (async () => { setShowSafeList(true); const { data: rooms2 } = await supabase.from("rooms").select("*"); const { data: blds2 } = await supabase.from("buildings").select("*"); const { data: thList2 } = await supabase.from("therapists").select("id,name"); const getName2 = (id: number) => (thList2 || []).find((t: any) => t.id === id)?.name || "不明"; const { data: sf } = await supabase.from("therapist_daily_settlements").select("*").eq("safe_deposited", true).is("safe_collected_date", null); const items: typeof safeUncollected = []; for (const s of (sf || [])) { const rm = (rooms2 || []).find((r: any) => r.id === s.room_id); const bl = rm ? (blds2 || []).find((b: any) => b.id === rm.building_id) : null; const { data: rep } = await supabase.from("room_cash_replenishments").select("amount").eq("room_id", s.room_id).eq("date", s.date); const repAmt = (rep || []).reduce((sum: number, r: any) => sum + r.amount, 0); items.push({ id: s.id, date: s.date, total_cash: s.total_cash || 0, final_payment: s.final_payment || 0, room_id: s.room_id, therapist_name: getName2(s.therapist_id), room_label: (bl?.name || "") + (rm?.name || ""), replenish: repAmt }); } setSafeUncollected(items); const { data: sfH } = await supabase.from("therapist_daily_settlements").select("*").eq("safe_deposited", true).not("safe_collected_date", "is", null).order("safe_collected_date", { ascending: false }).limit(20); const hItems: typeof safeHistory = []; for (const s of (sfH || [])) { const rm = (rooms2 || []).find((r: any) => r.id === s.room_id); const bl = rm ? (blds2 || []).find((b: any) => b.id === rm.building_id) : null; const { data: rep } = await supabase.from("room_cash_replenishments").select("amount").eq("room_id", s.room_id).eq("date", s.date); const repAmt = (rep || []).reduce((sum: number, r: any) => sum + r.amount, 0); hItems.push({ id: s.id, date: s.date, total_cash: s.total_cash || 0, final_payment: s.final_payment || 0, room_id: s.room_id, therapist_name: getName2(s.therapist_id), room_label: (bl?.name || "") + (rm?.name || ""), replenish: repAmt, safe_collected_date: s.safe_collected_date }); } setSafeHistory(hItems); })(); } }, []);
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

  // Register
  const [custName, setCustName] = useState(""); const [custPhone, setCustPhone] = useState(""); const [custPhone2, setCustPhone2] = useState(""); const [custPhone3, setCustPhone3] = useState("");
  const [custEmail, setCustEmail] = useState(""); const [custNotes, setCustNotes] = useState(""); const [custRank, setCustRank] = useState("normal");
  const [saving, setSaving] = useState(false); const [saveMsg, setSaveMsg] = useState("");

  // Edit
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [editName, setEditName] = useState(""); const [editPhone, setEditPhone] = useState(""); const [editPhone2, setEditPhone2] = useState(""); const [editPhone3, setEditPhone3] = useState("");
  const [editEmail, setEditEmail] = useState(""); const [editNotes, setEditNotes] = useState(""); const [editRank, setEditRank] = useState("normal");
  const [editSaving, setEditSaving] = useState(false); const [editMsg, setEditMsg] = useState("");

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null); const [deleting, setDeleting] = useState(false);

  // Detail / History
  const [detailCustomer, setDetailCustomer] = useState<Customer | null>(null);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [customerNotes, setCustomerNotes] = useState<CustomerNote[]>([]);
  const [showAddVisit, setShowAddVisit] = useState(false);
  const [vDate, setVDate] = useState(""); const [vStart, setVStart] = useState("12:00"); const [vEnd, setVEnd] = useState("13:00");
  const [vTherapistId, setVTherapistId] = useState(0); const [vStoreId, setVStoreId] = useState(0);
  const [vCourseId, setVCourseId] = useState(0); const [vNomination, setVNomination] = useState(""); const [vOptions, setVOptions] = useState("");
  const [vDiscount, setVDiscount] = useState("0"); const [vPayment, setVPayment] = useState(""); const [vNotes, setVNotes] = useState("");
  const [vSaving, setVSaving] = useState(false);

  const fetchClosingReport = useCallback(async (date: string) => {
    setClosingLoading(true);
    const { data: res } = await supabase.from("reservations").select("*").eq("date", date);
    const { data: settlements } = await supabase.from("therapist_daily_settlements").select("*").eq("date", date);
    const { data: exp } = await supabase.from("expenses").select("*").eq("date", date);
    const { data: rooms } = await supabase.from("rooms").select("*");
    const { data: blds } = await supabase.from("buildings").select("*");
    const { data: repData } = await supabase.from("room_cash_replenishments").select("*").eq("date", date);
    const { data: crs } = await supabase.from("courses").select("*");
    const { data: ra } = await supabase.from("room_assignments").select("*").eq("date", date);
    const { data: thList } = await supabase.from("therapists").select("id,name");
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
    const { data: nomData } = await supabase.from("nominations").select("*");
    const { data: optData } = await supabase.from("options").select("*");
    const { data: extData } = await supabase.from("extensions").select("*");
    const totalCourseBack = completed.reduce((s, r) => { const c = getCourseByName(r.course); return s + ((c as any)?.therapist_back || 0); }, 0);
    const totalNomBack = completed.reduce((s, r) => { const nom = (nomData || []).find((n: any) => n.name === (r as any).nomination); return s + ((nom as any)?.therapist_back || (r as any).nomination_fee || 0); }, 0);
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
    const totalRounding = settledList2.reduce((s: number, d: any) => {
      const raw = (d.total_back || 0) - (d.invoice_deduction || 0) - (d.withholding_tax || 0) - (d.welfare_fee || 0) + (d.transport_fee || 0);
      return s + ((d.final_payment || 0) - raw);
    }, 0);
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
      const roomReplenish = assign ? replenishList.filter((r: any) => (rooms || []).find((x: any) => x.id === assign.room_id)?.id === r.id ? false : true, []).length >= 0 ? (repData || []).filter((r: any) => r.room_id === assign.room_id).reduce((s2: number, r2: any) => s2 + (r2.amount || 0), 0) : 0 : 0;
      const netAfterPay = tCash - finalPay;
      return { id: tid, name: getThName(tid), room: `${bldName}${rmName}`, cash: tCash, back: tBack, finalPay, replenish: roomReplenish, netAfterPay, net: tCash - finalPay, salesCollected: !!ds?.sales_collected, changeCollected: !!ds?.change_collected, safeDeposited: !!ds?.safe_deposited };
    });
    const totalOut = totalReplenish + expenseTotal;
    const staffCollectedAmt = therapistData.filter(t => t.salesCollected && !t.safeDeposited).reduce((s, t) => s + (t.changeCollected ? t.replenish : 0) + t.netAfterPay, 0);
    const safeDepositedAmt = therapistData.filter(t => t.salesCollected && t.safeDeposited).reduce((s, t) => s + (t.changeCollected ? t.replenish : 0) + t.netAfterPay, 0);
    const totalUncollected = therapistData.filter(t => !t.salesCollected).reduce((s, t) => s + t.replenish + t.netAfterPay, 0);
    const totalChangeUncollected = therapistData.filter(t => t.salesCollected && !t.changeCollected).reduce((s, t) => s + t.replenish, 0);
    const cashOnHand = -totalReplenish - expenseTotal + incomeTotal + staffCollectedAmt;
    // 金庫未回収（金庫投函済み・未回収）
    const { data: safeUncoll } = await supabase.from("therapist_daily_settlements").select("*").eq("safe_deposited", true).is("safe_collected_date", null);
    const safeUncollectedList = (safeUncoll || []).map((s: any) => {
      const rm2 = (rooms || []).find((r: any) => r.id === s.room_id);
      const bl2 = rm2 ? (blds || []).find((b: any) => b.id === rm2.building_id) : null;
      return { date: s.date, therapist: getThName(s.therapist_id), room: `${bl2?.name || ""}${rm2?.name || ""}`, salesAmt: Math.max((s.total_cash || 0) - (s.final_payment || 0), 0), changeAmt: 0 };
    });
    // 各金庫投函の釣銭を取得
    for (const su of safeUncollectedList) {
      const roomMatch = (rooms || []).find((r: any) => su.room.includes(r.name || ""));
      if (roomMatch) {
        const { data: repSafe } = await supabase.from("room_cash_replenishments").select("amount").eq("room_id", roomMatch.id).eq("date", su.date);
        su.changeAmt = (repSafe || []).reduce((s2: number, r2: any) => s2 + (r2.amount || 0), 0);
      }
    }
    const safeTotalUncollected = safeUncollectedList.reduce((s: number, x: any) => s + x.salesAmt + x.changeAmt, 0);

    // 金庫回収分（本日回収）
    const { data: safeCollToday } = await supabase.from("therapist_daily_settlements").select("*").eq("safe_collected_date", date).eq("safe_deposited", true);
    const safeCollectedTodayList: { date: string; therapist: string; room: string; amount: number }[] = [];
    for (const sc of (safeCollToday || [])) {
      const rm3 = (rooms || []).find((r: any) => r.id === sc.room_id);
      const bl3 = rm3 ? (blds || []).find((b: any) => b.id === rm3.building_id) : null;
      const net3 = Math.max((sc.total_cash || 0) - (sc.final_payment || 0), 0);
      const { data: repSc } = await supabase.from("room_cash_replenishments").select("amount").eq("room_id", sc.room_id).eq("date", sc.date);
      const repAmt3 = (repSc || []).reduce((s2: number, r2: any) => s2 + (r2.amount || 0), 0);
      safeCollectedTodayList.push({ date: sc.date, therapist: getThName(sc.therapist_id), room: `${bl3?.name || ""}${rm3?.name || ""}`, amount: net3 + repAmt3 });
    }
    const safeCollectedTodayTotal = safeCollectedTodayList.reduce((s: number, x: any) => s + x.amount, 0);

    // セラピスト別売上
    const therapistSales = [...new Set(completed.map(r => r.therapist_id))].map(tid => {
      const tRes = completed.filter(r => r.therapist_id === tid);
      const tSales = tRes.reduce((s, r) => s + ((r as any).total_price || 0), 0);
      const tBack = tRes.reduce((s, r) => { const c = getCourseByName(r.course); return s + ((c as any)?.therapist_back || 0); }, 0);
      return { name: getThName(tid), count: tRes.length, sales: tSales, back: tBack };
    });
    setClosingData({
      resCount: allRes.length, compCount: completed.length, totalSales,
      totalCoursePrice, totalNom, totalOpt, totalExt, totalDisc,
      totalCard, totalPaypay, totalCashSales,
      totalBack, totalCourseBack, totalNomBack, totalOptBack, totalExtBack, totalFinalPay, totalInvoiceDed, totalWithholding, totalWelfare, totalTransportSettle, totalRounding, totalReplenish, replenishList,
      expenseList, expenseTotal, incomeList, incomeTotal,
      netProfit, therapistData, totalOut,
      staffCollectedAmt, safeDepositedAmt, totalUncollected, cashOnHand,
      therapistSales, safeUncollectedList, safeTotalUncollected, safeCollectedTodayList, safeCollectedTodayTotal,
    });
    setClosingLoading(false);
  }, []);

  // Auto-fetch closing report when date changes or page becomes active
  useEffect(() => {
    if (activePage === "営業締め") {
      fetchClosingReport(closingDate);
    }
  }, [closingDate, activePage, fetchClosingReport]);

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
  }, []);

  const fetchMaster = useCallback(async () => {
    const { data: t } = await supabase.from("therapists").select("*").order("id"); if (t) setTherapists(t);
    const { data: s } = await supabase.from("stores").select("*").order("id"); if (s) setStoresList(s);
    const { data: c } = await supabase.from("courses").select("*").order("duration"); if (c) setCourses(c);
  }, []);

  const fetchVisits = useCallback(async (custId: number) => {
    const { data } = await supabase.from("customer_visits").select("*").eq("customer_id", custId).order("date", { ascending: false }); if (data) setVisits(data);
  }, []);

  useEffect(() => {
    const checkUser = async () => { const { data: { user } } = await supabase.auth.getUser(); if (!user) { router.push("/"); } else { setUserEmail(user.email || ""); setUserId(user.id); } };
    checkUser(); fetchCustomers(); fetchMaster();
  }, [router, fetchCustomers, fetchMaster]);

  // Register
  const handleRegister = async () => {
    if (!custName.trim()) { setSaveMsg("名前を入力してください"); return; }
    setSaving(true); setSaveMsg("");
    const phoneToCheck = custPhone.trim();
    if (phoneToCheck) {
      const { data: dup } = await supabase.from("customers").select("id, name").or(`phone.eq.${phoneToCheck},phone2.eq.${phoneToCheck},phone3.eq.${phoneToCheck}`);
      if (dup && dup.length > 0) { setSaving(false); setSaveMsg(`この電話番号は「${dup[0].name}」で既に登録されています`); return; }
    }
    const { error } = await supabase.from("customers").insert({ name: custName.trim(), phone: custPhone.trim(), phone2: custPhone2.trim(), phone3: custPhone3.trim(), email: custEmail.trim(), notes: custNotes.trim(), rank: custRank, user_id: userId });
    setSaving(false);
    if (error) { setSaveMsg("登録に失敗しました: " + error.message); }
    else { setSaveMsg("登録しました！"); setCustName(""); setCustPhone(""); setCustPhone2(""); setCustPhone3(""); setCustEmail(""); setCustNotes(""); setCustRank("normal"); fetchCustomers(); setTimeout(() => { setSaveMsg(""); setActivePage("顧客一覧"); }, 1000); }
  };

  // Edit
  const startEdit = (c: Customer) => { setEditingCustomer(c); setEditName(c.name || ""); setEditPhone(c.phone || ""); setEditPhone2(c.phone2 || ""); setEditPhone3(c.phone3 || ""); setEditEmail(c.email || ""); setEditNotes(c.notes || ""); setEditRank(c.rank || "normal"); setEditMsg(""); };
  const handleUpdate = async () => {
    if (!editingCustomer || !editName.trim()) { setEditMsg("名前を入力してください"); return; }
    setEditSaving(true); setEditMsg("");
    const { error } = await supabase.from("customers").update({ name: editName.trim(), phone: editPhone.trim(), phone2: editPhone2.trim(), phone3: editPhone3.trim(), email: editEmail.trim(), notes: editNotes.trim(), rank: editRank }).eq("id", editingCustomer.id);
    setEditSaving(false);
    if (error) { setEditMsg("更新に失敗しました: " + error.message); }
    else { setEditMsg("更新しました！"); fetchCustomers(); setTimeout(() => { setEditingCustomer(null); setEditMsg(""); }, 800); }
  };
  const handleDelete = async () => { if (!deleteTarget) return; setDeleting(true); await supabase.from("customers").delete().eq("id", deleteTarget.id); setDeleting(false); setDeleteTarget(null); fetchCustomers(); };

  // Detail
  const fetchCustomerNotes = async (customerName: string) => {
    const { data } = await supabase.from("therapist_customer_notes").select("*").eq("customer_name", customerName).order("id", { ascending: false });
    if (data) setCustomerNotes(data);
  };
  const openDetail = (c: Customer) => { setDetailCustomer(c); fetchVisits(c.id); fetchCustomerNotes(c.name); };
  const deleteCustomerNote = async (noteId: number) => {
    if (!confirm("このセラピストメモを削除しますか？")) return;
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
      {/* Sidebar */}
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
                  <button onClick={() => setActivePage("顧客登録")} className="px-5 py-2.5 bg-gradient-to-r from-[#c3a782] to-[#b09672] text-white text-[12px] rounded-xl cursor-pointer">+ 新規登録</button>
                </div>
                <div className="px-6 py-4" style={{ borderBottom: `1px solid ${T.cardAlt}` }}>
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
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-[12px]">
                    <thead><tr style={{ borderBottom: `1px solid ${T.cardAlt}` }}>
                      {["ランク", "名前", "電話番号", "備考", "登録日", "操作"].map((h) => (<th key={h} className="text-left py-3.5 px-4 font-normal text-[11px]" style={{ color: T.textMuted }}>{h}</th>))}
                    </tr></thead>
                    <tbody>
                      {filteredCustomers.length === 0 ? (
                        <tr><td colSpan={6} className="text-center py-16 text-[12px]" style={{ color: T.textFaint }}>{customers.length === 0 ? "顧客データがありません" : "検索結果がありません"}</td></tr>
                      ) : filteredCustomers.map((c) => {
                        const phones = [c.phone, c.phone2, c.phone3].filter(Boolean);
                        return (
                          <tr key={c.id} className="transition-colors cursor-pointer" style={{ borderBottom: `1px solid ${T.cardAlt}` }} onClick={() => openDetail(c)}>
                            <td className="py-3 px-4"><RankBadge rank={c.rank || "normal"} /></td>
                            <td className="py-3 px-4"><div className="flex items-center gap-3"><div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-medium flex-shrink-0" style={{ backgroundColor: T.cardAlt, color: T.textSub }}>{c.name?.charAt(0)}</div><span className="font-medium">{c.name}</span></div></td>
                            <td className="py-3 px-4" style={{ color: T.textSub }}>
                              {phones.length === 0 ? "—" : phones.map((p, i) => (<span key={i} className="block text-[11px]">{p}</span>))}
                            </td>
                            <td className="py-3 px-4 max-w-[200px] truncate" style={{ color: T.textMuted }}>{c.notes || "—"}</td>
                            <td className="py-3 px-4" style={{ color: T.textMuted }}>{new Date(c.created_at).toLocaleDateString("ja-JP")}</td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                <button onClick={() => openDetail(c)} className="px-3 py-1.5 text-[11px] rounded-lg cursor-pointer" style={{ color: "#c3a782", backgroundColor: "#c3a78218" }}>オーダー</button>
                                <button onClick={() => startEdit(c)} className="px-3 py-1.5 text-[11px] rounded-lg cursor-pointer" style={{ color: "#3d6b9f", backgroundColor: "#3d6b9f18" }}>編集</button>
                                <button onClick={() => setDeleteTarget(c)} className="px-3 py-1.5 text-[11px] rounded-lg cursor-pointer" style={{ color: "#c45555", backgroundColor: "#c4555518" }}>削除</button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* 顧客登録 */}
          {activePage === "顧客登録" && (
            <div className="animate-[fadeIn_0.4s] max-w-xl">
              <div className="rounded-2xl border p-8" style={{ backgroundColor: T.card, borderColor: T.border }}>
                <div className="mb-8"><h2 className="text-[16px] font-medium">顧客登録</h2><p className="text-[11px] mt-1" style={{ color: T.textFaint }}>新しい顧客情報を登録します</p></div>
                <div className="space-y-5">
                  <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>名前 <span style={{ color: "#c49885" }}>*</span></label><input type="text" placeholder="山田 太郎" value={custName} onChange={(e) => setCustName(e.target.value)} className="w-full px-4 py-3 rounded-xl text-[13px] outline-none" style={inputStyle} /></div>
                  <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>電話番号①</label><input type="tel" placeholder="090-1234-5678" value={custPhone} onChange={(e) => setCustPhone(e.target.value)} className="w-full px-4 py-3 rounded-xl text-[13px] outline-none" style={inputStyle} /></div>
                  <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>電話番号②</label><input type="tel" placeholder="2つ目の電話番号（任意）" value={custPhone2} onChange={(e) => setCustPhone2(e.target.value)} className="w-full px-4 py-3 rounded-xl text-[13px] outline-none" style={inputStyle} /></div>
                  <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>電話番号③</label><input type="tel" placeholder="3つ目の電話番号（任意）" value={custPhone3} onChange={(e) => setCustPhone3(e.target.value)} className="w-full px-4 py-3 rounded-xl text-[13px] outline-none" style={inputStyle} /></div>
                  <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>メールアドレス</label><input type="email" placeholder="example@email.com" value={custEmail} onChange={(e) => setCustEmail(e.target.value)} className="w-full px-4 py-3 rounded-xl text-[13px] outline-none" style={inputStyle} /></div>
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
                      <div className="flex justify-between font-bold pt-1" style={{ borderTop: `1px dashed ${T.border}`, color: "#c45555" }}><span>出金合計</span><span>-{fmt(closingData.totalOut)}</span></div>
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
                        <div className="flex justify-between font-bold text-[15px]"><span style={{ color: "#f59e0b" }}>💴 事務所の残金</span><span style={{ color: (closingData.cashOnHand + closingData.safeCollectedTodayTotal) >= 0 ? "#22c55e" : "#c45555" }}>{fmt(closingData.cashOnHand + closingData.safeCollectedTodayTotal)}</span></div>
                        <p className="text-[9px] mt-1" style={{ color: T.textFaint }}>※ 未回収の売上はルームにあるため含まれません。回収後に事務所の残金が増えます。</p>
                        {closingData.safeTotalUncollected > 0 && <div className="flex justify-between mt-1 text-[12px]"><span style={{ color: "#a855f7" }}>🔐 金庫回収後の残金</span><span style={{ color: "#a855f7", fontWeight: 700 }}>{fmt(closingData.cashOnHand + closingData.safeCollectedTodayTotal + closingData.safeTotalUncollected)}</span></div>}
                        {closingData.totalUncollected > 0 && <div className="flex justify-between mt-1 text-[12px]"><span style={{ color: "#22c55e" }}>全額回収後の残金</span><span style={{ color: "#22c55e", fontWeight: 700 }}>{fmt(closingData.cashOnHand + closingData.safeCollectedTodayTotal + closingData.safeTotalUncollected + closingData.totalUncollected)}</span></div>}
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
                        <div key={i} className="flex justify-between py-0.5"><span>{t.name}（{t.count}件）</span><span>売上{fmt(t.sales)} / バック{fmt(t.back)}</span></div>
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
          {activePage !== "HOME" && activePage !== "顧客一覧" && activePage !== "顧客登録" && activePage !== "営業締め" && (
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
              <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>名前 <span style={{ color: "#c49885" }}>*</span></label><input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full px-4 py-3 rounded-xl text-[13px] outline-none" style={inputStyle} /></div>
              <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>電話番号①</label><input type="tel" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} className="w-full px-4 py-3 rounded-xl text-[13px] outline-none" style={inputStyle} /></div>
              <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>電話番号②</label><input type="tel" value={editPhone2} onChange={(e) => setEditPhone2(e.target.value)} className="w-full px-4 py-3 rounded-xl text-[13px] outline-none" style={inputStyle} /></div>
              <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>電話番号③</label><input type="tel" value={editPhone3} onChange={(e) => setEditPhone3(e.target.value)} className="w-full px-4 py-3 rounded-xl text-[13px] outline-none" style={inputStyle} /></div>
              <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>メールアドレス</label><input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} className="w-full px-4 py-3 rounded-xl text-[13px] outline-none" style={inputStyle} /></div>
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
                    <div className="flex flex-wrap gap-3 mt-1 text-[12px]" style={{ color: T.textSub }}>
                      {detailCustomer.phone && <span>📱 {detailCustomer.phone}</span>}
                      {detailCustomer.phone2 && <span>📱 {detailCustomer.phone2}</span>}
                      {detailCustomer.phone3 && <span>📱 {detailCustomer.phone3}</span>}
                      {detailCustomer.email && <span>✉ {detailCustomer.email}</span>}
                    </div>
                    {detailCustomer.notes && <p className="text-[11px] mt-1" style={{ color: T.textMuted }}>📝 {detailCustomer.notes}</p>}
                  </div>
                </div>
                <button onClick={() => setDetailCustomer(null)} className="text-[14px] cursor-pointer p-2" style={{ color: T.textSub }}>✕</button>
              </div>
            </div>

            {/* Visit History */}
            <div className="px-6 py-4">

              {/* セラピストメモ */}
              {customerNotes.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-[14px] font-medium mb-3">💆 セラピストメモ（{customerNotes.length}件）</h3>
                  <div className="space-y-2">
                    {customerNotes.map((cn) => {
                      const tName = getTherapistName(cn.therapist_id);
                      const stars = "★".repeat(cn.rating || 0) + "☆".repeat(5 - (cn.rating || 0));
                      return (
                        <div key={cn.id} className="rounded-xl p-3 border" style={{ borderColor: cn.is_ng ? "#c4555544" : T.border, backgroundColor: cn.is_ng ? "#c4555508" : T.cardAlt }}>
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <span className="text-[12px] font-medium">{tName}</span>
                                {cn.rating > 0 && <span className="text-[10px]" style={{ color: "#f59e0b" }}>{stars}</span>}
                                {cn.is_ng && <span className="text-[9px] px-2 py-0.5 rounded-full" style={{ backgroundColor: "#c4555518", color: "#c45555" }}>⚠ NG</span>}
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
                      login(next).then(ok => {
                        if (ok) { setShowPinModal(false); }
                        else { setPinError("PINが一致しません"); setPinInput(""); }
                      });
                    }
                  }} className="h-12 rounded-xl text-[16px] font-medium cursor-pointer" style={{ backgroundColor: T.cardAlt, color: n === "del" ? "#c45555" : T.text, border: `1px solid ${T.border}` }}>
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
                        <button onClick={async () => { if (!confirm(`${s.therapist_name}の${fmt(safeAmount)}を回収しますか？`)) return; const today = new Date().toISOString().split("T")[0]; await supabase.from("therapist_daily_settlements").update({ safe_collected_date: today }).eq("id", s.id); setSafeUncollected(prev => prev.filter(x => x.id !== s.id)); if (activePage === "営業締め") fetchClosingReport(closingDate); }} className="text-[8px] px-2 py-1 rounded cursor-pointer" style={{ backgroundColor: "#a855f718", color: "#a855f7", border: "1px solid #a855f744" }}>回収</button>
                      </div>
                    </div>;
                  })}
                  <div className="flex justify-between font-bold text-[13px] pt-2" style={{ borderTop: "1px solid #a855f733", color: "#a855f7" }}>
                    <span>金庫内合計</span>
                    <span>{fmt(safeUncollected.reduce((s, x) => s + Math.max(x.total_cash - x.final_payment, 0) + x.replenish, 0))}</span>
                  </div>
                  <button onClick={async () => { if (!confirm("金庫内の全額を回収しますか？")) return; const today = new Date().toISOString().split("T")[0]; for (const s of safeUncollected) { await supabase.from("therapist_daily_settlements").update({ safe_collected_date: today }).eq("id", s.id); } setSafeUncollected([]); if (activePage === "営業締め") fetchClosingReport(closingDate); }} className="w-full px-3 py-2 bg-gradient-to-r from-[#a855f7] to-[#9333ea] text-white text-[11px] rounded-xl cursor-pointer font-medium mt-2">📦 全額回収</button>
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
                        <button onClick={async () => { if (!confirm("この回収を取り消しますか？")) return; await supabase.from("therapist_daily_settlements").update({ safe_collected_date: null }).eq("id", s.id); setSafeHistory(prev => prev.filter(x => x.id !== s.id)); setSafeUncollected(prev => [...prev, { id: s.id, date: s.date, total_cash: s.total_cash, final_payment: s.final_payment, room_id: s.room_id, therapist_name: s.therapist_name, room_label: s.room_label, replenish: s.replenish }]); if (activePage === "営業締め") fetchClosingReport(closingDate); }} className="text-[7px] px-1.5 py-0.5 rounded cursor-pointer" style={{ backgroundColor: "#c4555512", color: "#c45555", border: "none" }}>取消</button>
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
      <style jsx global>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  );
}
