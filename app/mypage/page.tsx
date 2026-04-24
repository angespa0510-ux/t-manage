"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../../lib/supabase";
import TaxSupportWizard from "../../components/TaxSupportWizard";
import TaxBookkeeping from "../../components/TaxBookkeeping";
import { SITE, MARBLE } from "../../lib/site-theme";
import { generateContractCertificate, generatePaymentCertificate, generateTransactionCertificate } from "../../lib/certificate-pdf";
import { useConfirm } from "../../components/useConfirm";
import PushToggle from "../../components/PushToggle";
import InstallPrompt from "../../components/InstallPrompt";
import TherapistChatTab from "../../components/therapist-chat-tab";

/* ─────────────────────────────────────────────────────────────
 * セラピストマイページ デザインシステム (Session 60 Phase 1)
 *
 * 方針: HP (/app/(site)) の世界観を踏襲
 *  - 白基調 + ピンクアクセント + 明朝体
 *  - 大きな数字はサンセリフ(Inter/Geist系)で可読性重視
 *  - ダークモード廃止・ライト固定
 *  - 絵文字は機能識別のため残す（タブ/ステータス/カテゴリ）
 * ───────────────────────────────────────────────────────────── */
const FONT_SERIF   = "'Noto Serif JP', 'Yu Mincho', 'Hiragino Mincho ProN', serif";
const FONT_DISPLAY = "'Cormorant Garamond', 'Noto Serif JP', 'Yu Mincho', serif";
const FONT_SANS    = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Geist', system-ui, sans-serif";

// HP風のカラーパレット (既存コードの T.* 互換 shape)
const T = {
  bg:         SITE.color.bg,         // #ffffff
  card:       SITE.color.surface,    // #ffffff
  cardAlt:    SITE.color.surfaceAlt, // #faf6f1
  border:     SITE.color.border,     // #e5ded6
  text:       SITE.color.text,       // #2b2b2b
  textSub:    SITE.color.textSub,    // #555555
  textMuted:  SITE.color.textMuted,  // #8a8a8a
  textFaint:  SITE.color.textFaint,  // #b5b5b5
  accent:     SITE.color.pink,       // #e8849a
  accentBg:   SITE.color.pinkSoft,   // #f7e3e7
  accentDeep: SITE.color.pinkDeep,   // #c96b83
} as const;

// メインタブ（ボトムナビ4つ） / サブセグメント
type MainTab = "home" | "work" | "money" | "learn";
const MAIN_TABS: { key: MainTab; emoji: string; label: string }[] = [
  { key: "home",  emoji: "🏠", label: "ホーム" },
  { key: "work",  emoji: "💼", label: "ワーク" },
  { key: "money", emoji: "💰", label: "マネー" },
  { key: "learn", emoji: "📖", label: "ラーン" },
];

/* ───────── 型定義 ───────── */
type Therapist = {
  id: number; name: string; login_email: string; login_password: string;
  has_invoice: boolean; has_withholding: boolean; transport_fee: number;
  real_name: string; notes: string; status: string;
};
type Shift = { id: number; therapist_id: number; date: string; start_time: string; end_time: string; store_id: number; status: string };
type ShiftRequest = { id: number; therapist_id: number; week_start: string; date: string; start_time: string; end_time: string; store_id: number; status: string; notes: string };
type Settlement = {
  id: number; therapist_id: number; date: string; total_sales: number; total_back: number;
  order_count: number; adjustment: number; adjustment_note: string; invoice_deduction: number;
  withholding_tax: number; welfare_fee: number; transport_fee: number; final_payment: number;
  total_card: number; total_paypay: number; total_cash: number; is_settled: boolean;
};
type Reservation = {
  id: number; customer_name: string; therapist_id: number; date: string; start_time: string;
  end_time: string; course: string; notes: string; total_price: number; status: string;
  nomination: string; nomination_fee: number; options_text: string; extension_name: string;
};
type CustomerNote = { id: number; therapist_id: number; customer_name: string; note: string; is_ng: boolean; ng_reason: string; rating: number; reservation_id?: number; updated_at?: string };
type Store = { id: number; name: string };

const fmt = (n: number) => "¥" + (n || 0).toLocaleString();
const TIMES: string[] = [];
for (let h = 9; h <= 27; h++) { for (let m = 0; m < 60; m += 30) { const dh = h >= 24 ? h - 24 : h; TIMES.push(`${String(dh).padStart(2, "0")}:${String(m).padStart(2, "0")}`); } }

function getWeekStart(date: Date): string {
  const d = new Date(date); const day = d.getDay(); d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  return d.toISOString().split("T")[0];
}
function getWeekDates(weekStart: string): string[] {
  const dates: string[] = []; const d = new Date(weekStart + "T00:00:00");
  for (let i = 0; i < 7; i++) { const dd = new Date(d); dd.setDate(dd.getDate() + i); dates.push(dd.toISOString().split("T")[0]); }
  return dates;
}
function formatDate(d: string): string {
  const dt = new Date(d + "T00:00:00"); const days = ["日", "月", "火", "水", "木", "金", "土"];
  return `${dt.getMonth() + 1}/${dt.getDate()}(${days[dt.getDay()]})`;
}

export default function TherapistMyPage() {
  const { confirm, ConfirmModalNode } = useConfirm();
  const [loggedIn, setLoggedIn] = useState(false);
  const [therapist, setTherapist] = useState<Therapist | null>(null);
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState(""); const [loginLoading, setLoginLoading] = useState(false);
  const [showReset, setShowReset] = useState(false); const [resetPhone, setResetPhone] = useState(""); const [resetMsg, setResetMsg] = useState(""); const [resetDone, setResetDone] = useState(false);
  const [tab, setTab] = useState<"home" | "work" | "money" | "learn" | "shift" | "schedule" | "salary" | "customers" | "manual" | "notifications" | "tax" | "cert" | "chat">("home");
  // ワーク / マネー / ラーン タブ内のサブセグメント
  const [workSub, setWorkSub] = useState<"schedule" | "shift" | "customers">("schedule");
  const [moneySub, setMoneySub] = useState<"salary" | "cert" | "tax">("salary");
  const [learnSub, setLearnSub] = useState<"notifications" | "manual" | "chat">("notifications");
  // ボトムナビ→実タブへのディスパッチ
  const clickMain = (m: MainTab) => {
    if (m === "home") setTab("home");
    else if (m === "work") setTab(workSub);
    else if (m === "money") setTab(moneySub);
    else setTab(learnSub);
  };
  // 現在の実タブから メインタブを逆引き
  const getMainTab = (t: string): MainTab => {
    if (t === "home") return "home";
    if (t === "shift" || t === "schedule" || t === "customers" || t === "work") return "work";
    if (t === "salary" || t === "cert" || t === "tax" || t === "money") return "money";
    return "learn";
  };
  const mainTab = getMainTab(tab);
  const [shifts, setShifts] = useState<Shift[]>([]); const [shiftRequests, setShiftRequests] = useState<ShiftRequest[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]); const [reservations, setReservations] = useState<Reservation[]>([]);
  const [allReservations, setAllReservations] = useState<Reservation[]>([]); const [customerNotes, setCustomerNotes] = useState<CustomerNote[]>([]);
  const [todayOrders, setTodayOrders] = useState<Reservation[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [allRooms, setAllRooms] = useState<{id:number;name:string;store_id:number;building_id:number;key_number?:string}[]>([]);
  const [buildings, setBuildings] = useState<{id:number;name:string}[]>([]);
  const [roomAssigns, setRoomAssigns] = useState<{therapist_id:number;room_id:number;date:string}[]>([]);
  const [coursesMaster, setCoursesMaster] = useState<{ id: number; name: string; therapist_back: number }[]>([]);
const [nomsMaster, setNomsMaster] = useState<{ id: number; name: string; back_amount: number }[]>([]);
const [extsMaster, setExtsMaster] = useState<{ id: number; name: string; therapist_back: number }[]>([]);
const [optsMaster, setOptsMaster] = useState<{ id: number; name: string; therapist_back: number }[]>([]);
  const [weekOffset, setWeekOffset] = useState(1);
  const [reqDrafts, setReqDrafts] = useState<Record<string, { enabled: boolean; start: string; end: string; store_id: number; notes: string }>>({});
  const [reqSaving, setReqSaving] = useState(false); const [reqMsg, setReqMsg] = useState(""); const [copiedShift, setCopiedShift] = useState(false);
  const [salaryMonth, setSalaryMonth] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; });
  const [salaryViewMode, setSalaryViewMode] = useState<"monthly" | "annual">("monthly");
  const [salaryYear, setSalaryYear] = useState(() => new Date().getFullYear());
  const [annualSettlements, setAnnualSettlements] = useState<Settlement[]>([]);
  const [annualLoading, setAnnualLoading] = useState(false);
  const [storeInfo, setStoreInfo] = useState<{ company_name?: string; company_address?: string; company_phone?: string; invoice_number?: string } | null>(null);
  const [certChecks, setCertChecks] = useState<{ label: string; ok: boolean }[]>([]);
  const [certEligible, setCertEligible] = useState(false);
  const [noteSearch, setNoteSearch] = useState(""); const [showAddNote, setShowAddNote] = useState(false);
  const [noteForm, setNoteForm] = useState({ customer_name: "", note: "", is_ng: false, ng_reason: "", rating: 0, reservation_id: 0 })
  const [noteViewTarget, setNoteViewTarget] = useState<CustomerNote | null>(null);
  const [noteHistoryCustomer, setNoteHistoryCustomer] = useState("");
  const [calMonth, setCalMonth] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; });
　const [calShifts, setCalShifts] = useState<Shift[]>([]);
　const [calSettlements, setCalSettlements] = useState<Settlement[]>([]);
　const [calReservations, setCalReservations] = useState<Reservation[]>([]);
　const [calDetailDate, setCalDetailDate] = useState<string | null>(null);

  // ── セラピストお知らせ関連 (セッション㊸) ──
  type TherapistNotification = { id: number; title: string; body: string; type: string; target_therapist_id: number | null; created_at: string };
  const [notifications, setNotifications] = useState<TherapistNotification[]>([]);
  const [notifReadIds, setNotifReadIds] = useState<number[]>([]);
  const [notifDetail, setNotifDetail] = useState<TherapistNotification | null>(null);

  // ── マニュアル関連 ──
  type ManualCategory = { id: number; name: string; icon: string; color: string; description: string; sort_order: number };
  type ManualArticle = { id: number; title: string; category_id: number | null; content: string; cover_image: string; tags: string[]; is_published: boolean; is_pinned: boolean; view_count: number; sort_order: number; created_at: string; updated_at: string };
  type ManualQA = { id: number; article_id: number; question: string; answer: string; sort_order: number };
  type ManualUpdate = { id: number; article_id: number; summary: string; updated_by: string; created_at: string };
  const [manualCats, setManualCats] = useState<ManualCategory[]>([]);
  const [manualArticles, setManualArticles] = useState<ManualArticle[]>([]);
  const [manualReads, setManualReads] = useState<number[]>([]);
  const [manualUpdates, setManualUpdates] = useState<ManualUpdate[]>([]);
  const [manualSelCat, setManualSelCat] = useState<number | null>(null);
  const [manualSearch, setManualSearch] = useState("");
  const [manualFilterTag, setManualFilterTag] = useState("");
  const [manualViewArticle, setManualViewArticle] = useState<ManualArticle | null>(null);
  const [manualViewQAs, setManualViewQAs] = useState<ManualQA[]>([]);
  const [manualOpenQA, setManualOpenQA] = useState<number | null>(null);
  const [manualHistory, setManualHistory] = useState<ManualArticle[]>([]);
  const [aiChatOpen, setAiChatOpen] = useState(false);
  const [aiChatMessages, setAiChatMessages] = useState<{ role: "user" | "ai"; content: string; logId?: number; rating?: number }[]>([]);
  const [aiChatInput, setAiChatInput] = useState("");
  const [aiChatLoading, setAiChatLoading] = useState(false);
  const [taxSubTab, setTaxSubTab] = useState<"support" | "ledger">("support");
  const [aiChatOpenG, setAiChatOpenG] = useState(false);
  const [aiChatMsgsG, setAiChatMsgsG] = useState<{ role: "user" | "ai"; text: string; cached?: boolean }[]>([]);
  const [aiChatInputG, setAiChatInputG] = useState("");
  const [aiChatLoadingG, setAiChatLoadingG] = useState(false);
  const [chatBtnPos, setChatBtnPos] = useState({ x: -1, y: -1 });
  const chatDragRef = useRef<{ dragging: boolean; startX: number; startY: number; origX: number; origY: number }>({ dragging: false, startX: 0, startY: 0, origX: 0, origY: 0 });
  const [aiListening, setAiListening] = useState(false);
  const [aiSessionCount, setAiSessionCount] = useState(0);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) { setLoginError("メールアドレスとパスワードを入力してください"); return; }
    setLoginLoading(true); setLoginError("");
    const { data } = await supabase.from("therapists").select("*").eq("login_email", email.trim()).eq("login_password", password.trim()).maybeSingle();
    setLoginLoading(false);
    if (data) { setTherapist(data); setLoggedIn(true); localStorage.setItem("therapist_session", JSON.stringify({ id: data.id, email: data.login_email })); }
    else { setLoginError("メールアドレスまたはパスワードが間違っています"); }
  };

  const handleResetPassword = async () => {
    setResetMsg(""); setLoginLoading(true);
    try {
      const res = await fetch("/api/password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: resetPhone, type: "therapist" }),
      });
      const data = await res.json();
      if (data.success) {
        setResetDone(true);
        setResetMsg(data.emailSent ? `✅ 新しいパスワードを ${data.maskedEmail} に送信しました` : "✅ パスワードを再発行しました。オーナーにお問い合わせください。");
      } else {
        setResetMsg(data.error || "エラーが発生しました");
      }
    } catch { setResetMsg("通信エラーが発生しました"); }
    setLoginLoading(false);
  };

  useEffect(() => {
    const session = localStorage.getItem("therapist_session");
    if (session) { const { id } = JSON.parse(session); supabase.from("therapists").select("*").eq("id", id).maybeSingle().then(({ data }) => { if (data) { setTherapist(data); setLoggedIn(true); } else localStorage.removeItem("therapist_session"); }); }
    // URLクエリパラメータから初期タブを設定（例: /mypage?tab=tax）
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const t = params.get("tab");
      if (t && ["home", "shift", "schedule", "salary", "customers", "manual", "tax", "cert"].includes(t)) {
        setTab(t as typeof tab);
      }
    }
  }, []);

  const fetchData = useCallback(async () => {
    if (!therapist) return; const tid = therapist.id;
    const { data: st } = await supabase.from("stores").select("*"); if (st) setStores(st);
    const { data: rms } = await supabase.from("rooms").select("id,name,store_id,building_id,key_number"); if (rms) setAllRooms(rms);
    const { data: blds } = await supabase.from("buildings").select("id,name"); if (blds) setBuildings(blds);
    const todayStr2 = new Date().toISOString().split("T")[0];
    const { data: ras } = await supabase.from("room_assignments").select("therapist_id,room_id,date").eq("therapist_id", tid).gte("date", todayStr2); if (ras) setRoomAssigns(ras);
    const { data: crsM } = await supabase.from("courses").select("id,name,therapist_back"); if (crsM) setCoursesMaster(crsM);
    const { data: nm } = await supabase.from("nominations").select("id,name,back_amount"); if (nm) setNomsMaster(nm);
    const { data: em } = await supabase.from("extensions").select("id,name,therapist_back"); if (em) setExtsMaster(em);
    const { data: om } = await supabase.from("options").select("id,name,therapist_back"); if (om) setOptsMaster(om);
    const now = new Date(); const m1 = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const m2end = new Date(now.getFullYear(), now.getMonth() + 2, 0); const m2 = m2end.toISOString().split("T")[0];
    const { data: sh } = await supabase.from("shifts").select("*").eq("therapist_id", tid).gte("date", m1).lte("date", m2).eq("status", "confirmed").order("date"); if (sh) setShifts(sh);
    const { data: sr } = await supabase.from("shift_requests").select("*").eq("therapist_id", tid).order("date"); if (sr) setShiftRequests(sr);
    const [sy, sm] = salaryMonth.split("-").map(Number); const dim = new Date(sy, sm, 0).getDate();
    const { data: stl } = await supabase.from("therapist_daily_settlements").select("*").eq("therapist_id", tid).gte("date", `${salaryMonth}-01`).lte("date", `${salaryMonth}-${String(dim).padStart(2, "0")}`).eq("is_settled", true).order("date"); if (stl) setSettlements(stl);
    const d30 = new Date(); d30.setDate(d30.getDate() - 30);
    const { data: res } = await supabase.from("reservations").select("*").eq("therapist_id", tid).gte("date", d30.toISOString().split("T")[0]).eq("status", "completed").order("date", { ascending: false }); if (res) setReservations(res);
    const { data: allRes } = await supabase.from("reservations").select("*").eq("therapist_id", tid).eq("status", "completed").order("date", { ascending: false }); if (allRes) setAllReservations(allRes);
    // 本日の全オーダー（キャンセル以外）
    const todayStr = new Date().toISOString().split("T")[0];
    const { data: todayR } = await supabase.from("reservations").select("*").eq("therapist_id", tid).eq("date", todayStr).neq("status", "cancelled").order("start_time"); if (todayR) setTodayOrders(todayR);
    const { data: cn } = await supabase.from("therapist_customer_notes").select("*").eq("therapist_id", tid).order("customer_name"); if (cn) setCustomerNotes(cn);
    const [cy, cm] = calMonth.split("-").map(Number);
    const calDim = new Date(cy, cm, 0).getDate();
    const calStart = `${calMonth}-01`; const calEnd = `${calMonth}-${String(calDim).padStart(2, "0")}`;
    const { data: csh } = await supabase.from("shifts").select("*").eq("therapist_id", tid).gte("date", calStart).lte("date", calEnd).eq("status", "confirmed"); if (csh) setCalShifts(csh);
    const { data: cstl } = await supabase.from("therapist_daily_settlements").select("*").eq("therapist_id", tid).gte("date", calStart).lte("date", calEnd).eq("is_settled", true); if (cstl) setCalSettlements(cstl);
    const { data: cres } = await supabase.from("reservations").select("*").eq("therapist_id", tid).gte("date", calStart).lte("date", calEnd).neq("status", "cancelled"); if (cres) setCalReservations(cres);
    // マニュアルデータ
    const { data: mc } = await supabase.from("manual_categories").select("*").order("sort_order"); if (mc) setManualCats(mc);
    const { data: ma } = await supabase.from("manual_articles").select("*").eq("is_published", true).order("sort_order").order("created_at", { ascending: false }); if (ma) setManualArticles(ma);
    const { data: mr } = await supabase.from("manual_reads").select("article_id").eq("therapist_id", tid); if (mr) setManualReads(mr.map((r: any) => r.article_id));
    const { data: mu } = await supabase.from("manual_updates").select("*").order("created_at", { ascending: false }).limit(10); if (mu) setManualUpdates(mu);
    const { data: storeD } = await supabase.from("stores").select("company_name,company_address,company_phone,invoice_number"); if (storeD?.[0]) setStoreInfo(storeD[0]);
    // 証明書発行条件チェック
    const th = therapist as any;
    const { data: ct } = await supabase.from("contracts").select("status").eq("therapist_id", tid).eq("status", "signed").maybeSingle();
    const { data: allSett } = await supabase.from("therapist_daily_settlements").select("id").eq("therapist_id", tid).eq("is_settled", true);
    const totalDays = allSett?.length || 0;
    const checks = [
      { label: "身分証が提出済み", ok: !!th.license_photo_url },
      { label: "業務委託契約に署名済み", ok: !!ct },
      { label: "本名が登録済み", ok: !!(th.real_name && th.real_name.trim()) },
      { label: "住所が登録済み", ok: !!(th.address && th.address.trim()) },
      { label: `総出勤30日以上（現在${totalDays}日）`, ok: totalDays >= 30 },
    ];
    setCertChecks(checks);
    setCertEligible(checks.every(c => c.ok));

    // 🔔 お知らせ: 全体向け(target_therapist_id=null) + 自分宛のみ
    const { data: notifs } = await supabase.from("therapist_notifications")
      .select("*")
      .or(`target_therapist_id.is.null,target_therapist_id.eq.${tid}`)
      .order("created_at", { ascending: false })
      .limit(100);
    if (notifs) setNotifications(notifs);
    const { data: notifReads } = await supabase.from("therapist_notification_reads")
      .select("notification_id").eq("therapist_id", tid);
    if (notifReads) setNotifReadIds(notifReads.map((r: { notification_id: number }) => r.notification_id));
  }, [therapist, salaryMonth, calMonth]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // 年間清算データ取得
  useEffect(() => {
    if (!therapist || salaryViewMode !== "annual") return;
    const fetchAnnual = async () => {
      setAnnualLoading(true);
      const { data } = await supabase.from("therapist_daily_settlements").select("*").eq("therapist_id", therapist.id).gte("date", `${salaryYear}-01-01`).lte("date", `${salaryYear}-12-31`).eq("is_settled", true).order("date");
      if (data) setAnnualSettlements(data);
      setAnnualLoading(false);
    };
    fetchAnnual();
  }, [therapist, salaryYear, salaryViewMode]);
  // リアルタイム同期
  useEffect(() => {
    const ch = supabase.channel("mypage-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "shifts" }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "room_assignments" }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "reservations" }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchData]);

  const targetWeekStart = getWeekStart(new Date(Date.now() + weekOffset * 7 * 86400000));
  const weekDates = getWeekDates(targetWeekStart);

  useEffect(() => {
    const drafts: Record<string, { enabled: boolean; start: string; end: string; store_id: number; notes: string }> = {};
    for (const d of weekDates) { const existing = shiftRequests.find(r => r.date === d); drafts[d] = existing ? { enabled: true, start: existing.start_time, end: existing.end_time, store_id: existing.store_id || 0, notes: existing.notes || "" } : { enabled: false, start: "12:00", end: "03:00", store_id: stores[0]?.id || 0, notes: "" }; }
    setReqDrafts(drafts);
  }, [weekOffset, shiftRequests, targetWeekStart, stores]);

  const submitShiftRequests = async () => {
    if (!therapist) return; setReqSaving(true); setReqMsg("");
    for (const d of weekDates) { const draft = reqDrafts[d]; if (!draft) continue; if (draft.enabled) { await supabase.from("shift_requests").upsert({ therapist_id: therapist.id, week_start: targetWeekStart, date: d, start_time: draft.start, end_time: draft.end, store_id: draft.store_id, notes: draft.notes, status: "pending", updated_at: new Date().toISOString() }, { onConflict: "therapist_id,date" }); } else { await supabase.from("shift_requests").delete().eq("therapist_id", therapist.id).eq("date", d); } }
    setReqSaving(false); setReqMsg("✅ シフト希望を提出しました！"); fetchData(); setTimeout(() => setReqMsg(""), 2000);
  };

  const generateShiftCopyText = () => {
    if (!therapist) return ""; const enabledDays = weekDates.filter(d => reqDrafts[d]?.enabled);
    if (enabledDays.length === 0) return `【シフト希望】${therapist.name}\n${formatDate(weekDates[0])}〜${formatDate(weekDates[6])}\n\n出勤希望なし`;
    let text = `【シフト希望】${therapist.name}\n${formatDate(weekDates[0])}〜${formatDate(weekDates[6])}\n\n`;
    for (const d of enabledDays) { const draft = reqDrafts[d]; const store = stores.find(s => s.id === draft.store_id); const sn = store?.name?.replace(/ルーム$/, "") || ""; text += `${formatDate(d)} ${draft.start}〜${draft.end}${sn ? ` [${sn}]` : ""}${draft.notes ? ` ※${draft.notes}` : ""}\n`; }
    return text.trim();
  };
  const copyShiftToClipboard = () => { navigator.clipboard.writeText(generateShiftCopyText()); setCopiedShift(true); setTimeout(() => setCopiedShift(false), 2000); };

  const deleteCustomerNote = async (id: number) => {
    const ok = await confirm({
      title: "このメモを削除しますか？",
      variant: "danger",
      confirmLabel: "削除する",
    });
    if (!ok) return;
    await supabase.from("therapist_customer_notes").delete().eq("id", id);
    const returnDate = calDetailDate; setShowAddNote(false); setNoteViewTarget(null); await fetchData(); if (returnDate) setCalDetailDate(returnDate);
  };

  const saveCustomerNote = async () => {
    if (!therapist || !noteForm.customer_name.trim()) return;
    if (noteForm.reservation_id > 0) {
      // 接客単位メモ: reservation_idで検索
      const existing = customerNotes.find(n => n.reservation_id === noteForm.reservation_id);
      if (existing) {
        await supabase.from("therapist_customer_notes").update({ note: noteForm.note, rating: noteForm.rating, is_ng: noteForm.is_ng, ng_reason: noteForm.ng_reason, updated_at: new Date().toISOString() }).eq("id", existing.id);
      } else {
        await supabase.from("therapist_customer_notes").insert({ therapist_id: therapist.id, customer_name: noteForm.customer_name.trim(), note: noteForm.note, is_ng: noteForm.is_ng, ng_reason: noteForm.ng_reason, rating: noteForm.rating, reservation_id: noteForm.reservation_id });
      }
    } else {
      // 旧式: customer_nameでreservation_id無しのものを検索
      const existing = customerNotes.find(n => n.customer_name === noteForm.customer_name.trim() && !n.reservation_id);
      if (existing) {
        await supabase.from("therapist_customer_notes").update({ note: noteForm.note, is_ng: noteForm.is_ng, ng_reason: noteForm.ng_reason, rating: noteForm.rating, updated_at: new Date().toISOString() }).eq("id", existing.id);
      } else {
        await supabase.from("therapist_customer_notes").insert({ therapist_id: therapist.id, customer_name: noteForm.customer_name.trim(), note: noteForm.note, is_ng: noteForm.is_ng, ng_reason: noteForm.ng_reason, rating: noteForm.rating });
      }
    }
    const returnDate = calDetailDate; setShowAddNote(false); setNoteViewTarget(null); setNoteForm({ customer_name: "", note: "", is_ng: false, ng_reason: "", rating: 0, reservation_id: 0 }); await fetchData(); if (returnDate) setCalDetailDate(returnDate);
  };

  const logout = () => { localStorage.removeItem("therapist_session"); setLoggedIn(false); setTherapist(null); setTab("home"); };

  // 🔔 お知らせ既読操作
  const markNotifRead = async (notifId: number) => {
    if (!therapist || notifReadIds.includes(notifId)) return;
    await supabase.from("therapist_notification_reads").insert({ therapist_id: therapist.id, notification_id: notifId });
    setNotifReadIds(prev => [...prev, notifId]);
  };
  const markAllNotifRead = async () => {
    if (!therapist) return;
    const unread = notifications.filter(n => !notifReadIds.includes(n.id));
    for (const n of unread) {
      try { await supabase.from("therapist_notification_reads").insert({ therapist_id: therapist.id, notification_id: n.id }); } catch {}
    }
    setNotifReadIds(notifications.map(n => n.id));
  };
  const openNotif = (n: TherapistNotification) => {
    setNotifDetail(n);
    markNotifRead(n.id);
  };
  const chipStyle = (active: boolean, color: string) => ({ backgroundColor: active ? color + "20" : "transparent", color: active ? color : T.textMuted, borderColor: active ? color : T.border });

  // マニュアル記事を開く（fromLink=true のとき履歴に追加）
  const openManualArticle = async (article: ManualArticle, fromLink = false) => {
    if (fromLink && manualViewArticle) {
      setManualHistory(prev => [...prev, manualViewArticle]);
    } else if (!fromLink) {
      setManualHistory([]);
    }
    setManualViewArticle(article); setManualOpenQA(null);
    // ブラウザ履歴に追加（スワイプバック対応）
    window.history.pushState({ manualArticleId: article.id, fromLink }, "");
    // Q&A取得
    const { data: qa } = await supabase.from("manual_qa").select("*").eq("article_id", article.id).order("sort_order");
    if (qa) setManualViewQAs(qa);
    // 既読記録
    if (therapist && !manualReads.includes(article.id)) {
      await supabase.from("manual_reads").upsert({ article_id: article.id, therapist_id: therapist.id }, { onConflict: "article_id,therapist_id" });
      setManualReads(prev => [...prev, article.id]);
      // view_count++
      await supabase.from("manual_articles").update({ view_count: (article.view_count || 0) + 1 }).eq("id", article.id);
    }
  };

  // 1つ前の記事に戻る（ボタン用）
  const goBackManual = () => {
    // ブラウザ履歴を戻す → popstateで処理される
    window.history.back();
  };

  // ブラウザのスワイプバック・戻るボタン対応
  const manualHistoryRef = useRef(manualHistory);
  manualHistoryRef.current = manualHistory;
  const manualViewRef = useRef(manualViewArticle);
  manualViewRef.current = manualViewArticle;
  const manualArticlesRef = useRef(manualArticles);
  manualArticlesRef.current = manualArticles;
  const tabRef = useRef(tab);
  tabRef.current = tab;

  // タブ切替時にブラウザ履歴ガード追加
  useEffect(() => {
    if (tab === "manual") {
      window.history.pushState({ manualTab: true }, "");
    }
  }, [tab]);

  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      // マニュアル記事を表示中の場合
      if (manualViewRef.current) {
        const history = manualHistoryRef.current;
        if (history.length > 0) {
          // 前の記事に戻る
          const prev = history[history.length - 1];
          setManualHistory(h => h.slice(0, -1));
          setManualViewArticle(prev); setManualOpenQA(null);
          supabase.from("manual_qa").select("*").eq("article_id", prev.id).order("sort_order").then(({ data }) => { if (data) setManualViewQAs(data); });
        } else {
          // 記事一覧に戻る
          setManualViewArticle(null);
          // 一覧に戻った後のガード
          window.history.pushState({ manualTab: true }, "");
        }
        return;
      }
      // マニュアルタブ（一覧表示中）からスワイプバック → ホームタブへ
      if (tabRef.current === "manual" && !manualViewRef.current) {
        setTab("home");
        window.history.pushState({ homeTab: true }, "");
        return;
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 記事内リンク処理 ──
  const renderInlineLinks = (text: string): React.ReactNode => {
    // [link:記事タイトル] [catlink:カテゴリ名] [page:パス:表示テキスト] [button:パス:ボタンテキスト] をパース
    const parts = text.split(/(\[link:[^\]]+\]|\[catlink:[^\]]+\]|\[page:[^\]]+\]|\[button:[^\]]+\])/g);
    if (parts.length === 1) return text;
    return parts.map((part, idx) => {
      const linkMatch = part.match(/^\[link:(.+)\]$/);
      if (linkMatch) {
        const title = linkMatch[1];
        const target = manualArticles.find(a => a.title === title || a.title.includes(title));
        if (target) {
          return <span key={idx} onClick={(e) => { e.stopPropagation(); openManualArticle(target, true); }}
            style={{ color: "#e8849a", fontWeight: 600, cursor: "pointer", borderBottom: "1px dashed #e8849a", paddingBottom: 1 }}>📖 {title}</span>;
        }
        return <span key={idx} style={{ color: "#e8849a" }}>📖 {title}</span>;
      }
      const catMatch = part.match(/^\[catlink:(.+)\]$/);
      if (catMatch) {
        const catName = catMatch[1];
        const target = manualCats.find(c => c.name === catName || c.name.includes(catName));
        if (target) {
          return <span key={idx} onClick={(e) => { e.stopPropagation(); setManualViewArticle(null); setManualHistory([]); setManualSelCat(target.id); }}
            style={{ color: "#e8849a", fontWeight: 600, cursor: "pointer", borderBottom: "1px dashed #e8849a", paddingBottom: 1 }}>{target.icon} {target.name}</span>;
        }
        return <span key={idx} style={{ color: "#e8849a" }}>{catName}</span>;
      }
      // [page:/mypage/tax-guide:📖 詳しい手順はこちら] — 内部ページへの通常リンク
      const pageMatch = part.match(/^\[page:([^:]+):(.+)\]$/);
      if (pageMatch) {
        const [, path, label] = pageMatch;
        const isExternal = /^https?:\/\//.test(path);
        return <a key={idx} href={path} {...(isExternal ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          onClick={(e) => e.stopPropagation()}
          style={{ color: "#e8849a", fontWeight: 600, cursor: "pointer", borderBottom: "1px dashed #e8849a", paddingBottom: 1 }}>{label}</a>;
      }
      // [button:/mypage/tax-guide:詳しい手順はこちら] — 目立つボタン
      const btnMatch = part.match(/^\[button:([^:]+):(.+)\]$/);
      if (btnMatch) {
        const [, path, label] = btnMatch;
        const isExternal = /^https?:\/\//.test(path);
        return <a key={idx} href={path} {...(isExternal ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          onClick={(e) => e.stopPropagation()}
          style={{
            display: "inline-block", background: "linear-gradient(135deg, #e8849a, #d4687e)", color: "#fff",
            fontWeight: 600, fontSize: 12, padding: "8px 16px", borderRadius: 999, textDecoration: "none",
            boxShadow: "0 2px 6px rgba(232,132,154,0.25)", margin: "4px 2px", cursor: "pointer",
          }}>{label} →</a>;
      }
      return <span key={idx}>{part}</span>;
    });
  };

  // テキスト行のインライン処理（太字+リンク）
  const renderInlineContent = (text: string): React.ReactNode => {
    // まず太字を処理、その結果をリンク処理
    if (text.match(/\*\*(.*?)\*\*/)) {
      const parts = text.split(/(\*\*.*?\*\*)/g);
      return parts.map((p, j) => {
        if (p.startsWith("**") && p.endsWith("**")) return <strong key={j} style={{ color: "#e8849a" }}>{renderInlineLinks(p.slice(2, -2))}</strong>;
        return <span key={j}>{renderInlineLinks(p)}</span>;
      });
    }
    return renderInlineLinks(text);
  };
  const getStoreName = (id: number) => stores.find(s => s.id === id)?.name || "";
  const getBuildingForDate = (date: string) => {
    const ra = roomAssigns.find(a => a.date === date);
    if (!ra) return "";
    const rm = allRooms.find(r => r.id === ra.room_id);
    if (!rm) return "";
    const bl = buildings.find(b => b.id === rm.building_id);
    return bl?.name || "";
  };
  const getRoomForDate = (date: string) => {
    const ra = roomAssigns.find(a => a.date === date);
    if (!ra) return "";
    const rm = allRooms.find(r => r.id === ra.room_id);
    return rm?.name || "";
  };
  const getKeyNumberForDate = (date: string) => {
    const ra = roomAssigns.find(a => a.date === date);
    if (!ra) return "";
    const rm = allRooms.find(r => r.id === ra.room_id);
    return rm?.key_number || "";
  };
  const getStoreShort = (id: number) => stores.find(s => s.id === id)?.name?.replace(/ルーム$/, "") || "";

  if (!loggedIn) return (
    <div style={{ minHeight: "100vh", backgroundColor: T.bg, fontFamily: FONT_SERIF, position: "relative", overflow: "hidden" }}>
      {/* 大理石pink背景 */}
      <div style={{ ...MARBLE.pink, position: "absolute", inset: 0, zIndex: 0, opacity: 0.5 }} />
      <div style={{ position: "relative", zIndex: 1, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 20px" }}>
        <div style={{ width: "100%", maxWidth: 400 }}>
          {/* ヒーロー見出し */}
          <div style={{ textAlign: "center", marginBottom: 36 }}>
            <div style={{ width: 1, height: 40, backgroundColor: T.accent, margin: "0 auto 20px" }} />
            <p style={{ fontFamily: FONT_DISPLAY, fontSize: 11, letterSpacing: "0.25em", color: T.accent, marginBottom: 10, fontWeight: 500 }}>THERAPIST</p>
            <h1 style={{ fontFamily: FONT_DISPLAY, fontSize: 42, letterSpacing: "0.08em", color: T.text, fontWeight: 500, marginBottom: 8, lineHeight: 1.2 }}>Ange Spa</h1>
            <p style={{ fontFamily: FONT_SERIF, fontSize: 11, letterSpacing: "0.4em", color: T.textSub, fontWeight: 400 }}>マイページ</p>
            <div style={{ width: 40, height: 1, backgroundColor: T.accent, margin: "20px auto 0" }} />
          </div>

          {/* ログインカード */}
          <div style={{ backgroundColor: T.card, border: `1px solid ${T.border}`, padding: "36px 28px" }}>
            {showReset ? (
              <>
                <div style={{ textAlign: "center", marginBottom: 28 }}>
                  <p style={{ fontFamily: FONT_DISPLAY, fontSize: 11, letterSpacing: "0.2em", color: T.accent, marginBottom: 8, fontWeight: 500 }}>PASSWORD RESET</p>
                  <p style={{ fontFamily: FONT_SERIF, fontSize: 13, color: T.text, letterSpacing: "0.05em", fontWeight: 500 }}>パスワード再発行</p>
                  <div style={{ width: 30, height: 1, backgroundColor: T.accent, margin: "14px auto 0" }} />
                </div>
                {!resetDone ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                    <div>
                      <label style={{ display: "block", fontSize: 11, letterSpacing: "0.1em", color: T.textSub, marginBottom: 8 }}>電話番号</label>
                      <input type="tel" value={resetPhone} onChange={e => setResetPhone(e.target.value)} placeholder="090-1234-5678" style={{ width: "100%", padding: "13px 14px", fontSize: 13, backgroundColor: T.cardAlt, border: `1px solid ${T.border}`, outline: "none", fontFamily: FONT_SERIF, color: T.text, boxSizing: "border-box" }} />
                      <p style={{ margin: "6px 0 0", fontSize: 10, color: T.textFaint, letterSpacing: "0.05em" }}>セラピスト登録時の電話番号を入力してください</p>
                    </div>
                    {resetMsg && <div style={{ padding: "12px 14px", backgroundColor: T.accentBg, color: SITE.color.pinkDeep, fontSize: 12, letterSpacing: "0.05em" }}>{resetMsg}</div>}
                    <button onClick={handleResetPassword} disabled={loginLoading || !resetPhone.trim()} style={{ width: "100%", padding: "14px", backgroundColor: T.accent, color: "#fff", border: "none", cursor: loginLoading ? "not-allowed" : "pointer", fontFamily: FONT_SERIF, fontSize: 13, letterSpacing: "0.15em", opacity: loginLoading || !resetPhone.trim() ? 0.5 : 1 }}>{loginLoading ? "送信中..." : "パスワードを再発行"}</button>
                    <button onClick={() => { setShowReset(false); setResetMsg(""); setResetPhone(""); setResetDone(false); }} style={{ width: "100%", padding: "11px", backgroundColor: "transparent", color: T.textMuted, border: `1px solid ${T.border}`, cursor: "pointer", fontFamily: FONT_SERIF, fontSize: 12, letterSpacing: "0.08em" }}>ログインに戻る</button>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                    <div style={{ padding: 20, backgroundColor: T.accentBg, textAlign: "center" }}>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: SITE.color.pinkDeep, letterSpacing: "0.05em" }}>{resetMsg}</p>
                      <p style={{ margin: "10px 0 0", fontSize: 11, color: T.textMuted, lineHeight: 1.7, letterSpacing: "0.03em" }}>メールに記載された新しいパスワードでログインしてください</p>
                    </div>
                    <button onClick={() => { setShowReset(false); setResetMsg(""); setResetPhone(""); setResetDone(false); }} style={{ width: "100%", padding: "14px", backgroundColor: T.accent, color: "#fff", border: "none", cursor: "pointer", fontFamily: FONT_SERIF, fontSize: 13, letterSpacing: "0.15em" }}>ログイン画面に戻る</button>
                  </div>
                )}
              </>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <div>
                  <label style={{ display: "block", fontSize: 11, letterSpacing: "0.1em", color: T.textSub, marginBottom: 8 }}>メールアドレス</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="example@email.com" onKeyDown={(e) => e.key === "Enter" && handleLogin()} style={{ width: "100%", padding: "13px 14px", fontSize: 13, backgroundColor: T.cardAlt, border: `1px solid ${T.border}`, outline: "none", fontFamily: FONT_SERIF, color: T.text, boxSizing: "border-box" }} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 11, letterSpacing: "0.1em", color: T.textSub, marginBottom: 8 }}>パスワード</label>
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="パスワード" onKeyDown={(e) => e.key === "Enter" && handleLogin()} style={{ width: "100%", padding: "13px 14px", fontSize: 13, backgroundColor: T.cardAlt, border: `1px solid ${T.border}`, outline: "none", fontFamily: FONT_SERIF, color: T.text, boxSizing: "border-box" }} />
                </div>
                {loginError && <div style={{ padding: "12px 14px", backgroundColor: T.accentBg, color: SITE.color.pinkDeep, fontSize: 12, letterSpacing: "0.05em" }}>{loginError}</div>}
                <button onClick={handleLogin} disabled={loginLoading} style={{ width: "100%", padding: "14px", backgroundColor: T.accent, color: "#fff", border: "none", cursor: loginLoading ? "not-allowed" : "pointer", fontFamily: FONT_SERIF, fontSize: 13, letterSpacing: "0.15em", opacity: loginLoading ? 0.5 : 1, marginTop: 4 }}>{loginLoading ? "ログイン中..." : "ログイン"}</button>
              </div>
            )}
          </div>

          {!showReset && (
            <p style={{ textAlign: "center", marginTop: 20 }}>
              <button onClick={() => { setShowReset(true); setResetMsg(""); setResetPhone(""); setResetDone(false); }} style={{ fontSize: 11, color: T.accent, background: "none", border: "none", cursor: "pointer", fontFamily: FONT_SERIF, letterSpacing: "0.08em", borderBottom: `1px solid ${T.accent}`, paddingBottom: 2 }}>パスワードを忘れた方はこちら</button>
            </p>
          )}
        </div>
      </div>
    </div>
  );

  const today = new Date().toISOString().split("T")[0]; const todayShift = shifts.find(s => s.date === today);
  const upcomingShifts = shifts.filter(s => s.date >= today).slice(0, 7);
  const monthTotal = settlements.reduce((s, stl) => s + stl.final_payment, 0);
  const monthOrders = settlements.reduce((s, stl) => s + stl.order_count, 0); const monthDays = settlements.length;
  const [smY, smM] = salaryMonth.split("-").map(Number);
  const customerVisitsAll = allReservations.reduce((acc, r) => { if (!acc[r.customer_name]) acc[r.customer_name] = { count: 0, lastDate: r.date }; acc[r.customer_name].count++; if (r.date > acc[r.customer_name].lastDate) acc[r.customer_name].lastDate = r.date; return acc; }, {} as Record<string, { count: number; lastDate: string }>);
  const uniqueCustomers = Object.entries(customerVisitsAll).sort((a, b) => b[1].count - a[1].count);

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: T.bg, color: T.text }}>
      {ConfirmModalNode}
      <InstallPrompt dismissKey="therapist" />
      {/* ═══ HP風ヘッダー ═══ */}
      <div style={{ height: 60, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px", flexShrink: 0, backgroundColor: T.card, borderBottom: `1px solid ${T.border}`, fontFamily: FONT_SERIF }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 32, height: 32, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "#fff", fontWeight: 500, backgroundColor: T.accent, fontFamily: FONT_DISPLAY, letterSpacing: "0.05em" }}>{therapist?.name?.charAt(0) || "?"}</div>
          <div>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 500, letterSpacing: "0.05em", color: T.text }}>{therapist?.name}</p>
            <p style={{ margin: 0, fontSize: 9, color: T.textMuted, fontFamily: FONT_DISPLAY, letterSpacing: "0.25em", marginTop: 1 }}>THERAPIST</p>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={() => fetchData()} title="更新" style={{ padding: "6px 10px", fontSize: 11, cursor: "pointer", border: `1px solid ${T.border}`, backgroundColor: "transparent", color: T.textSub, fontFamily: FONT_SERIF }}>🔄</button>
          <button onClick={logout} style={{ padding: "7px 14px", fontSize: 11, cursor: "pointer", border: `1px solid ${T.accent}`, backgroundColor: "transparent", color: T.accent, fontFamily: FONT_SERIF, letterSpacing: "0.1em" }}>ログアウト</button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto" style={{ paddingBottom: 76 }}><div className="max-w-[600px] mx-auto p-4">

        {tab === "home" && (<div style={{ display: "flex", flexDirection: "column", gap: 28, fontFamily: FONT_SERIF }}>

          {/* ═══ ブロック1 — 本日のヒーロー ═══ */}
          {(() => {
            const bldName = getBuildingForDate(today);
            const rmName = getRoomForDate(today);
            const keyNum = getKeyNumberForDate(today);
            const d = new Date(today + "T00:00:00");
            const days = ["日", "月", "火", "水", "木", "金", "土"];
            const dateLabel = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
            const dowLabel = days[d.getDay()];
            return (
              <section style={{ ...MARBLE.pink, padding: "40px 24px 48px", marginLeft: -16, marginRight: -16, marginTop: -16, position: "relative" }}>
                <div style={{ width: 1, height: 36, backgroundColor: T.accent, marginBottom: 18 }} />
                <p style={{ fontFamily: FONT_DISPLAY, fontSize: 11, letterSpacing: "0.25em", color: T.accent, marginBottom: 6, fontWeight: 500 }}>TODAY</p>
                <p style={{ fontFamily: FONT_DISPLAY, fontSize: 22, letterSpacing: "0.08em", color: T.text, fontWeight: 500, marginBottom: 4 }}>{dateLabel}</p>
                <p style={{ fontFamily: FONT_SERIF, fontSize: 12, letterSpacing: "0.15em", color: T.textSub, marginBottom: 24 }}>{dowLabel}曜日</p>
                {todayShift ? (
                  <>
                    <p style={{ fontFamily: FONT_SANS, fontSize: 32, letterSpacing: "0.02em", color: T.text, fontWeight: 300, marginBottom: 16, lineHeight: 1.1 }}>
                      {todayShift.start_time?.slice(0,5)}<span style={{ fontSize: 16, color: T.textMuted, margin: "0 8px" }}>—</span>{todayShift.end_time?.slice(0,5)}
                    </p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 20px", fontSize: 12, color: T.textSub, letterSpacing: "0.05em" }}>
                      {todayShift.store_id > 0 && <span>🏠 {getStoreName(todayShift.store_id)}</span>}
                      {bldName && <span>🏢 {bldName}</span>}
                      {rmName && <span>🚪 {rmName}</span>}
                      {keyNum && <span style={{ color: T.accent, fontWeight: 500 }}>🔑 {keyNum}</span>}
                    </div>
                  </>
                ) : (
                  <p style={{ fontFamily: FONT_SERIF, fontSize: 13, color: T.textMuted, letterSpacing: "0.05em" }}>本日の出勤予定はありません</p>
                )}
              </section>
            );
          })()}

          {/* ═══ ブロック2 — 今月のサマリー ═══ */}
          <section>
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <p style={{ fontFamily: FONT_DISPLAY, fontSize: 11, letterSpacing: "0.2em", color: T.accent, marginBottom: 8, fontWeight: 500 }}>THIS MONTH</p>
              <p style={{ fontFamily: FONT_SERIF, fontSize: 15, letterSpacing: "0.08em", color: T.text, fontWeight: 500, marginBottom: 12 }}>今月の実績</p>
              <div style={{ width: 30, height: 1, backgroundColor: T.accent, margin: "0 auto" }} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              {[
                { l: "REWARD",   subL: "報酬",     v: monthTotal.toLocaleString(),   unit: "¥", primary: true },
                { l: "ORDERS",   subL: "接客数",   v: String(monthOrders),            unit: "件", primary: false },
                { l: "DAYS",     subL: "出勤日数", v: String(monthDays),              unit: "日", primary: false },
              ].map(s => (
                <div key={s.l} style={{ backgroundColor: T.card, border: `1px solid ${T.border}`, padding: "18px 12px", textAlign: "center" }}>
                  <p style={{ fontFamily: FONT_DISPLAY, fontSize: 9, letterSpacing: "0.15em", color: T.textMuted, marginBottom: 4, fontWeight: 500 }}>{s.l}</p>
                  <p style={{ fontFamily: FONT_SANS, fontSize: s.primary ? 20 : 22, color: s.primary ? T.accent : T.text, fontWeight: s.primary ? 500 : 300, letterSpacing: "0em", lineHeight: 1.1, marginBottom: 2 }}>
                    {s.unit === "¥" && <span style={{ fontSize: 13, marginRight: 1 }}>¥</span>}{s.v}{s.unit !== "¥" && <span style={{ fontSize: 11, color: T.textMuted, marginLeft: 2, fontWeight: 400 }}>{s.unit}</span>}
                  </p>
                  <p style={{ fontFamily: FONT_SERIF, fontSize: 10, color: T.textMuted, letterSpacing: "0.08em" }}>{s.subL}</p>
                </div>
              ))}
            </div>
          </section>

          {/* ═══ ブロック3 — 本日のオーダー ═══ */}
          <section>
            <div style={{ textAlign: "center", marginBottom: 16 }}>
              <p style={{ fontFamily: FONT_DISPLAY, fontSize: 11, letterSpacing: "0.2em", color: T.accent, marginBottom: 8, fontWeight: 500 }}>TODAY&apos;S ORDERS</p>
              <p style={{ fontFamily: FONT_SERIF, fontSize: 15, letterSpacing: "0.08em", color: T.text, fontWeight: 500, marginBottom: 12, display: "inline-flex", gap: 12, alignItems: "center" }}>
                本日のオーダー
                <span style={{ fontFamily: FONT_DISPLAY, fontSize: 11, color: T.accent, padding: "2px 12px", border: `1px solid ${T.accent}44`, fontWeight: 400 }}>{todayOrders.length}件</span>
              </p>
              <div style={{ width: 30, height: 1, backgroundColor: T.accent, margin: "0 auto" }} />
            </div>

            <div style={{ backgroundColor: T.cardAlt, border: `1px solid ${T.border}`, padding: "12px 14px", marginBottom: 14 }}>
              <p style={{ margin: 0, fontSize: 10, color: T.textMuted, lineHeight: 1.8, letterSpacing: "0.03em" }}>
                🔔 お客様が来店されたら <strong style={{ color: T.text }}>「入室」</strong>ボタンを<br />
                🚪 お客様が退室されたら <strong style={{ color: T.text }}>「退室」</strong>ボタンを<br />
                <span style={{ color: T.textFaint }}>※ 間違えた場合は「取消」で元に戻せます。</span>
              </p>
            </div>

            {todayOrders.length === 0 ? (
              <div style={{ backgroundColor: T.card, border: `1px solid ${T.border}`, padding: "32px 16px", textAlign: "center" }}>
                <p style={{ margin: 0, fontSize: 12, color: T.textFaint, letterSpacing: "0.05em" }}>本日のオーダーはありません</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {todayOrders.map(r => {
                  const custSt = (r as any).customer_status || "unsent";
                  const isServing = custSt === "serving";
                  const isCompleted = custSt === "completed" || (r as any).status === "completed";
                  const statusLabel = isCompleted ? "終了" : isServing ? "接客中" : "予約済";
                  const statusIcon = isCompleted ? "✅" : isServing ? "💆" : "⏳";
                  const statusColor = isCompleted ? SITE.color.text : isServing ? T.accent : T.textMuted;
                  const accentBorder = isServing ? T.accent : isCompleted ? "#6b9b7e" : T.border;
                  return (
                    <div key={r.id} style={{ backgroundColor: T.card, border: `1px solid ${accentBorder}`, padding: "14px 16px", position: "relative" }}>
                      {isServing && <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, backgroundColor: T.accent }} />}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontFamily: FONT_SANS, fontSize: 16, fontWeight: 400, letterSpacing: "0.02em", color: T.text, margin: 0 }}>
                            {r.start_time?.slice(0,5)} <span style={{ color: T.textMuted, margin: "0 4px" }}>—</span> {r.end_time?.slice(0,5)}
                          </p>
                          <p style={{ margin: "6px 0 0", fontSize: 12, color: T.textSub, letterSpacing: "0.03em" }}>👤 {r.customer_name}</p>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "2px 12px", marginTop: 4, fontSize: 10, color: T.textMuted }}>
                            <span>📋 {r.course}</span>
                            {(r as any).nomination && (r as any).nomination !== "フリー" && <span>⭐ {(r as any).nomination}</span>}
                            {(r as any).extension_name && <span>⏱ +{(r as any).extension_name}</span>}
                            {(r as any).options_text && <span>🎁 {(r as any).options_text}</span>}
                          </div>
                          {r.notes && <p style={{ margin: "6px 0 0", fontSize: 10, color: "#b38419", letterSpacing: "0.03em" }}>📝 {r.notes.split("\n")[0]}</p>}
                        </div>
                        <span style={{ fontFamily: FONT_SERIF, fontSize: 10, padding: "4px 10px", color: statusColor, border: `1px solid ${statusColor}33`, backgroundColor: statusColor + "10", letterSpacing: "0.08em", whiteSpace: "nowrap", marginLeft: 8 }}>{statusIcon} {statusLabel}</span>
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        {!isServing && !isCompleted && (
                          <button onClick={async () => {
                            await supabase.from("reservations").update({ customer_status: "serving", therapist_status: "serving" }).eq("id", r.id);
                            setTodayOrders(prev => prev.map(o => o.id === r.id ? { ...o, customer_status: "serving", therapist_status: "serving" } as any : o));
                          }} style={{ flex: 1, padding: "11px", fontSize: 12, cursor: "pointer", backgroundColor: T.accent, color: "#fff", border: "none", fontFamily: FONT_SERIF, letterSpacing: "0.1em", fontWeight: 500 }}>
                            🔔 入室（接客開始）
                          </button>
                        )}
                        {isServing && (<>
                          <button onClick={async () => {
                            await supabase.from("reservations").update({ customer_status: "completed", therapist_status: "completed", status: "completed" }).eq("id", r.id);
                            setTodayOrders(prev => prev.map(o => o.id === r.id ? { ...o, customer_status: "completed", therapist_status: "completed", status: "completed" } as any : o));
                            fetchData();
                          }} style={{ flex: 1, padding: "11px", fontSize: 12, cursor: "pointer", backgroundColor: "#6b9b7e", color: "#fff", border: "none", fontFamily: FONT_SERIF, letterSpacing: "0.1em", fontWeight: 500 }}>
                            🚪 退室（接客終了）
                          </button>
                          <button onClick={async () => {
                            await supabase.from("reservations").update({ customer_status: "detail_read", therapist_status: "detail_sent" }).eq("id", r.id);
                            setTodayOrders(prev => prev.map(o => o.id === r.id ? { ...o, customer_status: "detail_read", therapist_status: "detail_sent" } as any : o));
                          }} style={{ padding: "11px 14px", fontSize: 10, cursor: "pointer", backgroundColor: "transparent", color: T.textMuted, border: `1px solid ${T.border}`, fontFamily: FONT_SERIF, letterSpacing: "0.05em" }}>
                            ↩ 取消
                          </button>
                        </>)}
                        {isCompleted && (
                          <button onClick={async () => {
                            await supabase.from("reservations").update({ customer_status: "serving", therapist_status: "serving", status: "unprocessed" }).eq("id", r.id);
                            setTodayOrders(prev => prev.map(o => o.id === r.id ? { ...o, customer_status: "serving", therapist_status: "serving", status: "unprocessed" } as any : o));
                            fetchData();
                          }} style={{ padding: "9px 14px", fontSize: 10, cursor: "pointer", backgroundColor: "transparent", color: T.textMuted, border: `1px solid ${T.border}`, fontFamily: FONT_SERIF, letterSpacing: "0.05em" }}>
                            ↩ 退室を取り消す
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* ═══ ブロック4 — アラートセンター (お知らせ・マニュアル未読) ═══ */}
          {(() => {
            const unreadNotifs = notifications.filter(n => !notifReadIds.includes(n.id));
            const unreadArticles = manualArticles.filter(a => a.is_published && !manualReads.includes(a.id));
            const recentUpdates = manualUpdates.slice(0, 2);
            if (unreadNotifs.length === 0 && unreadArticles.length === 0 && recentUpdates.length === 0) return null;
            return (
              <section style={{ ...MARBLE.beige, padding: "36px 20px", marginLeft: -16, marginRight: -16 }}>
                <div style={{ textAlign: "center", marginBottom: 20 }}>
                  <p style={{ fontFamily: FONT_DISPLAY, fontSize: 11, letterSpacing: "0.2em", color: T.accent, marginBottom: 8, fontWeight: 500 }}>NOTICE</p>
                  <p style={{ fontFamily: FONT_SERIF, fontSize: 15, letterSpacing: "0.08em", color: T.text, fontWeight: 500, marginBottom: 12 }}>未確認のお知らせ</p>
                  <div style={{ width: 30, height: 1, backgroundColor: T.accent, margin: "0 auto" }} />
                </div>

                {unreadNotifs.length > 0 && (
                  <div style={{ backgroundColor: T.card, border: `1px solid ${T.border}`, marginBottom: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderBottom: `1px solid ${T.border}` }}>
                      <p style={{ margin: 0, fontSize: 12, fontWeight: 500, letterSpacing: "0.08em", color: T.text }}>📣 お知らせ <span style={{ fontFamily: FONT_DISPLAY, color: T.accent, marginLeft: 4 }}>{unreadNotifs.length}</span></p>
                      <button onClick={() => { setLearnSub("notifications"); setTab("notifications"); }} style={{ fontSize: 10, color: T.accent, background: "none", border: "none", cursor: "pointer", fontFamily: FONT_SERIF, letterSpacing: "0.08em" }}>すべて見る →</button>
                    </div>
                    <div>
                      {unreadNotifs.slice(0, 3).map(n => {
                        const icon = n.type === "schedule" ? "📅" : n.type === "warning" ? "⚠️" : "📢";
                        return (
                          <div key={n.id} onClick={() => openNotif(n)} style={{ padding: "12px 16px", borderBottom: `1px solid ${T.border}`, cursor: "pointer", display: "flex", gap: 10, alignItems: "flex-start" }}>
                            <span style={{ fontSize: 14 }}>{icon}</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ margin: 0, fontSize: 12, fontWeight: 500, color: T.text, letterSpacing: "0.03em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.title}</p>
                              <p style={{ margin: "2px 0 0", fontSize: 10, color: T.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.body}</p>
                            </div>
                            <span style={{ fontSize: 9, color: T.textFaint, whiteSpace: "nowrap" }}>{new Date(n.created_at).toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" })}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {(unreadArticles.length > 0 || recentUpdates.length > 0) && (
                  <div style={{ backgroundColor: T.card, border: `1px solid ${T.border}`, cursor: "pointer" }} onClick={() => { setLearnSub("manual"); setTab("manual"); }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderBottom: `1px solid ${T.border}` }}>
                      <p style={{ margin: 0, fontSize: 12, fontWeight: 500, letterSpacing: "0.08em", color: T.text }}>📖 マニュアル {unreadArticles.length > 0 && <span style={{ fontFamily: FONT_DISPLAY, color: T.accent, marginLeft: 4 }}>{unreadArticles.length}件未読</span>}</p>
                      <span style={{ fontSize: 10, color: T.accent, letterSpacing: "0.08em" }}>開く →</span>
                    </div>
                    {recentUpdates.length > 0 && (
                      <div style={{ padding: "10px 16px" }}>
                        {recentUpdates.map(u => {
                          const art = manualArticles.find(a => a.id === u.article_id);
                          return <p key={u.id} style={{ margin: "2px 0", fontSize: 10, color: T.textSub, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>✏️ {art?.title}: {u.summary}</p>;
                        })}
                      </div>
                    )}
                  </div>
                )}
              </section>
            );
          })()}

          {/* ═══ ブロック5 — カレンダー ═══ */}
          {(() => {
            const [cy, cm] = calMonth.split("-").map(Number);
            const calDim = new Date(cy, cm, 0).getDate();
            const firstDow = new Date(cy, cm - 1, 1).getDay();
            const cells: (string | null)[] = [];
            for (let i = 0; i < firstDow; i++) cells.push(null);
            for (let d = 1; d <= calDim; d++) cells.push(`${calMonth}-${String(d).padStart(2, "0")}`);
            while (cells.length % 7 !== 0) cells.push(null);
            const calTotal = calSettlements.reduce((s, stl) => s + stl.final_payment, 0);
            const calOrders = calReservations.length;
            const calDays = calSettlements.length;

            return (
              <section>
                <div style={{ textAlign: "center", marginBottom: 16 }}>
                  <p style={{ fontFamily: FONT_DISPLAY, fontSize: 11, letterSpacing: "0.2em", color: T.accent, marginBottom: 8, fontWeight: 500 }}>CALENDAR</p>
                  <p style={{ fontFamily: FONT_SERIF, fontSize: 15, letterSpacing: "0.08em", color: T.text, fontWeight: 500, marginBottom: 12 }}>月別カレンダー</p>
                  <div style={{ width: 30, height: 1, backgroundColor: T.accent, margin: "0 auto" }} />
                </div>

                <div style={{ backgroundColor: T.card, border: `1px solid ${T.border}`, padding: "16px 14px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                    <button onClick={() => { const d = new Date(cy, cm - 2, 1); setCalMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`); }}
                      style={{ padding: "6px 10px", fontSize: 12, cursor: "pointer", border: `1px solid ${T.border}`, backgroundColor: "transparent", color: T.textSub, fontFamily: FONT_SERIF }}>◀</button>
                    <div style={{ textAlign: "center" }}>
                      <p style={{ margin: 0, fontFamily: FONT_DISPLAY, fontSize: 20, color: T.text, letterSpacing: "0.05em" }}>{cy}.{String(cm).padStart(2, "0")}</p>
                      <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 4, fontSize: 9, letterSpacing: "0.05em" }}>
                        <span style={{ color: T.accent, fontFamily: FONT_SANS }}>{fmt(calTotal)}</span>
                        <span style={{ color: T.textMuted }}>{calOrders}件</span>
                        <span style={{ color: T.textMuted }}>{calDays}日出勤</span>
                      </div>
                    </div>
                    <button onClick={() => { const d = new Date(cy, cm, 1); setCalMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`); }}
                      style={{ padding: "6px 10px", fontSize: 12, cursor: "pointer", border: `1px solid ${T.border}`, backgroundColor: "transparent", color: T.textSub, fontFamily: FONT_SERIF }}>▶</button>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
                    {["日", "月", "火", "水", "木", "金", "土"].map((d, i) => (
                      <div key={d} style={{ textAlign: "center", fontSize: 9, padding: "6px 0", fontFamily: FONT_SERIF, letterSpacing: "0.05em", color: i === 0 ? "#c96b83" : i === 6 ? "#6b8ba8" : T.textMuted }}>{d}</div>
                    ))}
                    {cells.map((date, i) => {
                      if (!date) return <div key={`e-${i}`} style={{ padding: 2 }} />;
                      const dt = new Date(date + "T00:00:00");
                      const dayNum = dt.getDate();
                      const dow = dt.getDay();
                      const isToday2 = date === today;
                      const shift = calShifts.find(s => s.date === date);
                      const settlement = calSettlements.find(s => s.date === date);
                      const dayRes = calReservations.filter(r => r.date === date);
                      const hasWork = !!shift;
                      const hasSettled = !!settlement;
                      const custCount = dayRes.length;
                      const uniqueCust = new Set(dayRes.map(r => r.customer_name)).size;

                      return (
                        <div key={date} onClick={() => setCalDetailDate(date)} style={{
                          padding: 3, textAlign: "center", minHeight: 58, display: "flex", flexDirection: "column", cursor: "pointer",
                          backgroundColor: isToday2 ? T.accentBg : hasSettled ? "rgba(107,155,126,0.06)" : hasWork ? "rgba(232,132,154,0.04)" : "transparent",
                          border: isToday2 ? `1.5px solid ${T.accent}` : hasWork ? `1px solid ${T.border}` : "1px solid transparent",
                        }}>
                          <span style={{ fontFamily: FONT_SANS, fontSize: 12, fontWeight: 500, color: dow === 0 ? "#c96b83" : dow === 6 ? "#6b8ba8" : T.text }}>{dayNum}</span>
                          {hasWork && <span style={{ fontSize: 7, marginTop: 1, color: T.accent, fontFamily: FONT_SANS, letterSpacing: "0.02em" }}>{shift.start_time?.slice(0,5)}〜</span>}
                          {hasSettled && <span style={{ fontSize: 7, fontWeight: 500, color: T.accent, fontFamily: FONT_SANS }}>{fmt(settlement.final_payment)}</span>}
                          {custCount > 0 && <span style={{ fontSize: 7, color: "#6b9b7e", fontFamily: FONT_SANS }}>👤{uniqueCust}名{custCount > uniqueCust ? `(${custCount})` : ""}</span>}
                          {hasWork && !hasSettled && date < today && <span style={{ fontSize: 6, color: "#b38419", letterSpacing: "0.05em" }}>未清算</span>}
                        </div>
                      );
                    })}
                  </div>

                  <div style={{ display: "flex", gap: 14, marginTop: 12, paddingTop: 10, justifyContent: "center", flexWrap: "wrap", borderTop: `1px solid ${T.border}`, fontSize: 9, letterSpacing: "0.03em" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 4, color: T.textMuted }}><span style={{ width: 8, height: 8, backgroundColor: "rgba(232,132,154,0.15)", border: `1px solid ${T.accent}` }} />出勤</span>
                    <span style={{ display: "flex", alignItems: "center", gap: 4, color: T.textMuted }}><span style={{ width: 8, height: 8, backgroundColor: "rgba(107,155,126,0.15)" }} />清算済</span>
                    <span style={{ display: "flex", alignItems: "center", gap: 4, color: T.accent }}><span style={{ width: 8, height: 8, backgroundColor: T.accentBg, border: `1.5px solid ${T.accent}` }} />今日</span>
                    <span style={{ color: "#b38419" }}>⚠ 未清算</span>
                  </div>
                </div>
              </section>
            );
          })()}

          {/* ═══ ブロック6 — 直近の出勤予定 ═══ */}
          {upcomingShifts.length > 0 && (
            <section>
              <div style={{ textAlign: "center", marginBottom: 16 }}>
                <p style={{ fontFamily: FONT_DISPLAY, fontSize: 11, letterSpacing: "0.2em", color: T.accent, marginBottom: 8, fontWeight: 500 }}>UPCOMING</p>
                <p style={{ fontFamily: FONT_SERIF, fontSize: 15, letterSpacing: "0.08em", color: T.text, fontWeight: 500, marginBottom: 12 }}>直近の出勤予定</p>
                <div style={{ width: 30, height: 1, backgroundColor: T.accent, margin: "0 auto" }} />
              </div>
              <div style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}>
                {upcomingShifts.map((s, idx) => (
                  <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderBottom: idx < upcomingShifts.length - 1 ? `1px solid ${T.border}` : "none" }}>
                    <span style={{ fontFamily: FONT_SERIF, fontSize: 12, letterSpacing: "0.05em", color: T.text }}>{formatDate(s.date)}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      {s.store_id > 0 && <span style={{ fontSize: 10, padding: "2px 8px", border: `1px solid ${T.border}`, color: T.textSub, letterSpacing: "0.03em" }}>{getStoreShort(s.store_id)}</span>}
                      <span style={{ fontFamily: FONT_SANS, fontSize: 13, fontWeight: 400, letterSpacing: "0.02em", color: T.text }}>{s.start_time?.slice(0,5)} — {s.end_time?.slice(0,5)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ═══ ブロック7 — プッシュ通知設定 ═══ */}
          {therapist && (
            <section style={{ ...MARBLE.soft, padding: "28px 20px", marginLeft: -16, marginRight: -16 }}>
              <div style={{ textAlign: "center", marginBottom: 14 }}>
                <p style={{ fontFamily: FONT_DISPLAY, fontSize: 10, letterSpacing: "0.2em", color: T.textMuted, marginBottom: 6, fontWeight: 500 }}>NOTIFICATION</p>
                <p style={{ fontFamily: FONT_SERIF, fontSize: 13, letterSpacing: "0.08em", color: T.text, fontWeight: 500 }}>🔔 プッシュ通知設定</p>
              </div>
              <div style={{ backgroundColor: T.card, border: `1px solid ${T.border}`, padding: "14px 16px" }}>
                <p style={{ margin: "0 0 10px", fontSize: 10, color: T.textMuted, textAlign: "center", letterSpacing: "0.03em" }}>シフト確定・お知らせをリアルタイムで受け取れます</p>
                <PushToggle userType="therapist" userId={therapist.id} className="w-full" />
              </div>
            </section>
          )}

        </div>)}

        {/* ═══ サブセグメント（ワーク/マネー/ラーン） ═══ */}
        {(mainTab === "work" || mainTab === "money" || mainTab === "learn") && (() => {
          type SubItem = { key: typeof tab; emoji: string; label: string; badge?: number };
          let items: SubItem[] = [];
          const notifUnread = notifications.filter(n => !notifReadIds.includes(n.id)).length;
          const manualUnread = manualArticles.filter(a => a.is_published && !manualReads.includes(a.id)).length;
          if (mainTab === "work") {
            items = [
              { key: "schedule",  emoji: "📅", label: "出勤予定" },
              { key: "shift",     emoji: "📝", label: "シフト希望" },
              { key: "customers", emoji: "👤", label: "お客様" },
            ];
          } else if (mainTab === "money") {
            items = [
              { key: "salary", emoji: "💰", label: "給料明細" },
              { key: "cert",   emoji: "📄", label: "証明書" },
              { key: "tax",    emoji: "📊", label: "確定申告" },
            ];
          } else {
            items = [
              { key: "notifications", emoji: "🔔", label: "お知らせ",   badge: notifUnread },
              { key: "manual",        emoji: "📖", label: "マニュアル", badge: manualUnread },
              { key: "chat",          emoji: "💬", label: "チャット" },
            ];
          }
          const clickSub = (k: typeof tab) => {
            setTab(k);
            if (k === "shift" || k === "schedule" || k === "customers") setWorkSub(k);
            else if (k === "salary" || k === "cert" || k === "tax") setMoneySub(k);
            else if (k === "notifications" || k === "manual" || k === "chat") setLearnSub(k);
          };
          const sectionLabel = mainTab === "work" ? "WORK" : mainTab === "money" ? "MONEY" : "LEARN";
          const sectionTitle = mainTab === "work" ? "仕事" : mainTab === "money" ? "報酬・税務" : "情報・お知らせ";
          return (
            <div style={{ marginBottom: 20, fontFamily: FONT_SERIF }}>
              <div style={{ textAlign: "center", marginBottom: 18 }}>
                <p style={{ fontFamily: FONT_DISPLAY, fontSize: 11, letterSpacing: "0.25em", color: T.accent, marginBottom: 6, fontWeight: 500 }}>{sectionLabel}</p>
                <p style={{ fontFamily: FONT_SERIF, fontSize: 14, letterSpacing: "0.08em", color: T.text, fontWeight: 500, marginBottom: 10 }}>{sectionTitle}</p>
                <div style={{ width: 30, height: 1, backgroundColor: T.accent, margin: "0 auto" }} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: `repeat(${items.length}, 1fr)`, gap: 0, border: `1px solid ${T.border}`, backgroundColor: T.card }}>
                {items.map((it, idx) => {
                  const active = tab === it.key;
                  return (
                    <button key={it.key} onClick={() => clickSub(it.key)}
                      style={{
                        padding: "10px 4px",
                        fontSize: 11,
                        fontFamily: FONT_SERIF,
                        letterSpacing: "0.05em",
                        cursor: "pointer",
                        border: "none",
                        borderLeft: idx > 0 ? `1px solid ${T.border}` : "none",
                        backgroundColor: active ? T.accent : "transparent",
                        color: active ? "#fff" : T.textSub,
                        fontWeight: active ? 500 : 400,
                        transition: "all 0.2s ease",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 4,
                      }}>
                      <span style={{ fontSize: 12 }}>{it.emoji}</span>
                      <span>{it.label}</span>
                      {it.badge !== undefined && it.badge > 0 && (
                        <span style={{ fontFamily: FONT_SANS, fontSize: 9, padding: "1px 5px", backgroundColor: active ? "#fff" : T.accent, color: active ? T.accent : "#fff", borderRadius: 999, marginLeft: 2, fontWeight: 500, letterSpacing: 0 }}>{it.badge}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })()}


        {/* 🔔 お知らせタブ (セッション㊸) */}
        {tab === "notifications" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20, fontFamily: FONT_SERIF }}>
            {/* セクション見出し */}
            <div style={{ textAlign: "center" }}>
              <p style={{ fontFamily: FONT_DISPLAY, fontSize: 11, letterSpacing: "0.25em", color: T.accent, marginBottom: 6, fontWeight: 500 }}>NOTIFICATIONS</p>
              <p style={{ fontFamily: FONT_SERIF, fontSize: 15, letterSpacing: "0.08em", color: T.text, fontWeight: 500, marginBottom: 10 }}>🔔 お知らせ</p>
              <div style={{ width: 30, height: 1, backgroundColor: T.accent, margin: "0 auto" }} />
            </div>

            {notifications.filter(n => !notifReadIds.includes(n.id)).length > 0 && (
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button onClick={markAllNotifRead} style={{ padding: "7px 14px", fontSize: 11, cursor: "pointer", border: `1px solid ${T.accent}`, color: T.accent, backgroundColor: "transparent", fontFamily: FONT_SERIF, letterSpacing: "0.08em" }}>
                  ✅ すべて既読にする
                </button>
              </div>
            )}

            {notifications.length === 0 ? (
              <div style={{ backgroundColor: T.card, border: `1px solid ${T.border}`, padding: "48px 16px", textAlign: "center" }}>
                <p style={{ fontSize: 28, margin: "0 0 12px" }}>📭</p>
                <p style={{ margin: 0, fontSize: 12, color: T.textMuted, letterSpacing: "0.05em" }}>まだお知らせはありません</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 0, backgroundColor: T.card, border: `1px solid ${T.border}` }}>
                {notifications.map((n, idx) => {
                  const isRead = notifReadIds.includes(n.id);
                  const icon = n.type === "schedule" ? "📅" : n.type === "warning" ? "⚠️" : "📢";
                  const accentColor = n.type === "warning" ? "#c96b83" : n.type === "schedule" ? "#6b8ba8" : T.accent;
                  return (
                    <div key={n.id} onClick={() => openNotif(n)}
                      style={{
                        padding: "16px 18px",
                        cursor: "pointer",
                        borderBottom: idx < notifications.length - 1 ? `1px solid ${T.border}` : "none",
                        backgroundColor: isRead ? "transparent" : "rgba(232,132,154,0.03)",
                        display: "flex",
                        gap: 12,
                        alignItems: "flex-start",
                        position: "relative",
                      }}>
                      {!isRead && <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, backgroundColor: accentColor }} />}
                      <span style={{ fontSize: 20, lineHeight: 1, flexShrink: 0, marginTop: 2 }}>{icon}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                          <p style={{ margin: 0, fontSize: 13, fontWeight: 500, letterSpacing: "0.03em", color: isRead ? T.textSub : T.text, flex: 1, minWidth: 0 }}>{n.title}</p>
                          {!isRead && <span style={{ fontFamily: FONT_DISPLAY, fontSize: 9, padding: "2px 8px", color: "#fff", backgroundColor: accentColor, letterSpacing: "0.15em", fontWeight: 500, flexShrink: 0 }}>NEW</span>}
                          {n.target_therapist_id && <span style={{ fontSize: 9, padding: "2px 7px", border: `1px solid ${T.border}`, color: T.textMuted, letterSpacing: "0.08em", flexShrink: 0 }}>個別</span>}
                        </div>
                        <p style={{ margin: "0 0 6px", fontSize: 11, color: T.textMuted, lineHeight: 1.6, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", whiteSpace: "pre-wrap" }}>{n.body}</p>
                        <p style={{ margin: 0, fontFamily: FONT_SANS, fontSize: 10, color: T.textFaint, letterSpacing: "0.02em" }}>
                          {new Date(n.created_at).toLocaleDateString("ja-JP", { year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* 📖 お知らせ詳細モーダル */}
        {notifDetail && (
          <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, backgroundColor: "rgba(0,0,0,0.45)" }} onClick={() => setNotifDetail(null)}>
            <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 500, padding: 32, backgroundColor: T.card, border: `1px solid ${T.border}`, fontFamily: FONT_SERIF }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, paddingBottom: 16, borderBottom: `1px solid ${T.border}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 26 }}>{notifDetail.type === "schedule" ? "📅" : notifDetail.type === "warning" ? "⚠️" : "📢"}</span>
                  <div>
                    <p style={{ fontFamily: FONT_DISPLAY, fontSize: 10, letterSpacing: "0.2em", color: T.accent, margin: 0, fontWeight: 500 }}>NOTICE</p>
                    <p style={{ fontFamily: FONT_SANS, fontSize: 10, color: T.textFaint, margin: "2px 0 0", letterSpacing: "0.03em" }}>
                      {new Date(notifDetail.created_at).toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
                <button onClick={() => setNotifDetail(null)} style={{ width: 30, height: 30, cursor: "pointer", fontSize: 14, backgroundColor: "transparent", border: `1px solid ${T.border}`, color: T.textMuted, fontFamily: FONT_SERIF }}>✕</button>
              </div>
              <h3 style={{ fontFamily: FONT_SERIF, fontSize: 17, fontWeight: 500, letterSpacing: "0.05em", color: T.text, margin: "0 0 16px" }}>{notifDetail.title}</h3>
              <div style={{ backgroundColor: T.cardAlt, border: `1px solid ${T.border}`, padding: "16px 18px" }}>
                <p style={{ margin: 0, fontSize: 13, lineHeight: 1.9, letterSpacing: "0.02em", whiteSpace: "pre-wrap", color: T.text }}>{notifDetail.body}</p>
              </div>
              <button onClick={() => setNotifDetail(null)} style={{ width: "100%", marginTop: 20, padding: 14, fontSize: 13, cursor: "pointer", backgroundColor: T.accent, color: "#fff", border: "none", fontFamily: FONT_SERIF, letterSpacing: "0.15em", fontWeight: 500 }}>
                閉じる
              </button>
            </div>
          </div>
        )}

        {tab === "chat" && therapist && (<div style={{ display: "flex", flexDirection: "column", gap: 14, fontFamily: FONT_SERIF }}>
          {/* セクション見出し */}
          <div style={{ textAlign: "center" }}>
            <p style={{ fontFamily: FONT_DISPLAY, fontSize: 11, letterSpacing: "0.25em", color: T.accent, marginBottom: 6, fontWeight: 500 }}>CHAT</p>
            <p style={{ fontFamily: FONT_SERIF, fontSize: 15, letterSpacing: "0.08em", color: T.text, fontWeight: 500, marginBottom: 10 }}>💬 スタッフとのチャット</p>
            <div style={{ width: 30, height: 1, backgroundColor: T.accent, margin: "0 auto" }} />
          </div>
          <TherapistChatTab
            therapistId={therapist.id}
            therapistName={therapist.name}
            C={T}
            FONT_SERIF={FONT_SERIF}
          />
        </div>)}

        {tab === "shift" && (<div style={{ display: "flex", flexDirection: "column", gap: 20, fontFamily: FONT_SERIF }}>
          {/* セクション見出し */}
          <div style={{ textAlign: "center" }}>
            <p style={{ fontFamily: FONT_DISPLAY, fontSize: 11, letterSpacing: "0.25em", color: T.accent, marginBottom: 6, fontWeight: 500 }}>SHIFT REQUEST</p>
            <p style={{ fontFamily: FONT_SERIF, fontSize: 15, letterSpacing: "0.08em", color: T.text, fontWeight: 500, marginBottom: 10 }}>📝 シフト希望提出</p>
            <div style={{ width: 30, height: 1, backgroundColor: T.accent, margin: "0 auto" }} />
          </div>

          {/* 週ナビゲーション */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
            <button onClick={() => setWeekOffset(Math.max(1, weekOffset - 1))} style={{ padding: "6px 12px", fontSize: 12, cursor: "pointer", border: `1px solid ${T.border}`, backgroundColor: "transparent", color: T.textSub, fontFamily: FONT_SERIF }}>◀</button>
            <div style={{ padding: "6px 16px", border: `1px solid ${T.border}`, backgroundColor: T.cardAlt, fontSize: 12, fontFamily: FONT_SANS, letterSpacing: "0.02em", color: T.text, minWidth: 180, textAlign: "center" }}>
              {formatDate(weekDates[0])} <span style={{ color: T.textMuted, margin: "0 4px" }}>—</span> {formatDate(weekDates[6])}
            </div>
            <button onClick={() => setWeekOffset(weekOffset + 1)} style={{ padding: "6px 12px", fontSize: 12, cursor: "pointer", border: `1px solid ${T.border}`, backgroundColor: "transparent", color: T.textSub, fontFamily: FONT_SERIF }}>▶</button>
          </div>

          {/* 説明テキスト */}
          <div style={{ backgroundColor: T.cardAlt, border: `1px solid ${T.border}`, padding: "14px 16px" }}>
            <p style={{ margin: 0, fontSize: 11, color: T.textMuted, lineHeight: 1.9, letterSpacing: "0.03em" }}>
              出勤希望の日にチェックを入れ、時間と店舗を選択してください。<br />
              希望シフトが決まったら <strong style={{ color: T.text }}>「シフト希望を提出」</strong> ボタンを押してお店に提出してください。<br />
              提出後、<strong style={{ color: T.accent }}>LINEでお店にもご報告をお願いします</strong>（📋 LINE用コピーで簡単に送れます）。
            </p>
          </div>

          {/* 日付カード */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {weekDates.map(d => {
              const draft = reqDrafts[d];
              if (!draft) return null;
              const dt = new Date(d + "T00:00:00");
              const dow = ["日","月","火","水","木","金","土"][dt.getDay()];
              const isSun = dt.getDay() === 0;
              const isSat = dt.getDay() === 6;
              const existing = shiftRequests.find(r => r.date === d);
              return (
                <div key={d} style={{ backgroundColor: draft.enabled ? T.accentBg : T.card, border: `1px solid ${draft.enabled ? T.accent : T.border}`, padding: "12px 14px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: draft.enabled ? 10 : 0 }}>
                    <button onClick={() => setReqDrafts({ ...reqDrafts, [d]: { ...draft, enabled: !draft.enabled } })} style={{ fontSize: 16, cursor: "pointer", background: "none", border: "none", padding: 0, lineHeight: 1 }}>{draft.enabled ? "✅" : "⬜"}</button>
                    <span style={{ fontFamily: FONT_SANS, fontSize: 14, fontWeight: 500, letterSpacing: "0.02em", minWidth: 72, color: isSun ? "#c96b83" : isSat ? "#6b8ba8" : T.text }}>
                      {dt.getDate()}<span style={{ fontSize: 11, color: T.textMuted, marginLeft: 2 }}>日</span> ({dow})
                    </span>
                    {existing && (
                      <span style={{ marginLeft: "auto", fontSize: 9, padding: "3px 8px", letterSpacing: "0.08em", fontFamily: FONT_SERIF,
                        color: existing.status === "approved" ? "#6b9b7e" : existing.status === "rejected" ? "#c96b83" : "#b38419",
                        border: `1px solid ${existing.status === "approved" ? "#6b9b7e" : existing.status === "rejected" ? "#c96b83" : "#b38419"}44`,
                        backgroundColor: existing.status === "approved" ? "rgba(107,155,126,0.08)" : existing.status === "rejected" ? "rgba(201,107,131,0.08)" : "rgba(179,132,25,0.08)" }}>
                        {existing.status === "approved" ? "承認済" : existing.status === "rejected" ? "却下" : "提出済"}
                      </span>
                    )}
                  </div>
                  {draft.enabled && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", paddingLeft: 28 }}>
                      <select value={draft.store_id} onChange={(e) => setReqDrafts({ ...reqDrafts, [d]: { ...draft, store_id: Number(e.target.value) } })} style={{ padding: "6px 10px", fontSize: 10, cursor: "pointer", border: `1px solid ${T.accent}44`, backgroundColor: T.card, color: T.accent, fontFamily: FONT_SERIF, letterSpacing: "0.05em", fontWeight: 500, outline: "none" }}>
                        <option value={0}>店舗未選択</option>
                        {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                      <select value={draft.start} onChange={(e) => setReqDrafts({ ...reqDrafts, [d]: { ...draft, start: e.target.value } })} style={{ padding: "6px 8px", fontSize: 11, cursor: "pointer", border: `1px solid ${T.border}`, backgroundColor: T.card, color: T.text, fontFamily: FONT_SANS, outline: "none" }}>
                        {TIMES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                      <span style={{ fontSize: 11, color: T.textMuted }}>—</span>
                      <select value={draft.end} onChange={(e) => setReqDrafts({ ...reqDrafts, [d]: { ...draft, end: e.target.value } })} style={{ padding: "6px 8px", fontSize: 11, cursor: "pointer", border: `1px solid ${T.border}`, backgroundColor: T.card, color: T.text, fontFamily: FONT_SANS, outline: "none" }}>
                        {TIMES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                      <input type="text" value={draft.notes} onChange={(e) => setReqDrafts({ ...reqDrafts, [d]: { ...draft, notes: e.target.value } })} placeholder="備考" style={{ flex: 1, minWidth: 70, padding: "6px 10px", fontSize: 10, border: `1px solid ${T.border}`, backgroundColor: T.card, color: T.text, fontFamily: FONT_SERIF, outline: "none" }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {reqMsg && (
            <div style={{ padding: "10px 14px", backgroundColor: "rgba(107,155,126,0.08)", border: `1px solid #6b9b7e44`, color: "#6b9b7e", fontSize: 12, textAlign: "center", letterSpacing: "0.05em" }}>{reqMsg}</div>
          )}

          {/* 送信ボタン */}
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={submitShiftRequests} disabled={reqSaving} style={{ flex: 1, padding: "14px", fontSize: 13, cursor: reqSaving ? "not-allowed" : "pointer", backgroundColor: T.accent, color: "#fff", border: "none", fontFamily: FONT_SERIF, letterSpacing: "0.15em", fontWeight: 500, opacity: reqSaving ? 0.5 : 1 }}>
              {reqSaving ? "送信中..." : "シフト希望を提出"}
            </button>
            <button onClick={copyShiftToClipboard} style={{ padding: "14px 18px", fontSize: 11, cursor: "pointer", border: `1px solid ${copiedShift ? "#6b9b7e" : T.accent}`, color: copiedShift ? "#6b9b7e" : T.accent, backgroundColor: copiedShift ? "rgba(107,155,126,0.08)" : "transparent", fontFamily: FONT_SERIF, letterSpacing: "0.1em", fontWeight: 500 }}>
              {copiedShift ? "✅ コピー済" : "📋 LINE用コピー"}
            </button>
          </div>

          {weekDates.some(d => reqDrafts[d]?.enabled) && (
            <div style={{ backgroundColor: T.cardAlt, border: `1px solid ${T.border}`, padding: "12px 14px" }}>
              <p style={{ margin: "0 0 6px", fontFamily: FONT_DISPLAY, fontSize: 10, fontWeight: 500, letterSpacing: "0.2em", color: T.textMuted }}>PREVIEW</p>
              <pre style={{ margin: 0, fontSize: 11, whiteSpace: "pre-wrap", color: T.textSub, fontFamily: FONT_SANS, lineHeight: 1.7 }}>{generateShiftCopyText()}</pre>
            </div>
          )}
        </div>)}

        {tab === "schedule" && (<div style={{ display: "flex", flexDirection: "column", gap: 20, fontFamily: FONT_SERIF }}>
          {/* セクション見出し */}
          <div style={{ textAlign: "center" }}>
            <p style={{ fontFamily: FONT_DISPLAY, fontSize: 11, letterSpacing: "0.25em", color: T.accent, marginBottom: 6, fontWeight: 500 }}>CONFIRMED SHIFT</p>
            <p style={{ fontFamily: FONT_SERIF, fontSize: 15, letterSpacing: "0.08em", color: T.text, fontWeight: 500, marginBottom: 10 }}>📅 確定シフト</p>
            <div style={{ width: 30, height: 1, backgroundColor: T.accent, margin: "0 auto" }} />
          </div>

          {shifts.length === 0 ? (
            <div style={{ backgroundColor: T.card, border: `1px solid ${T.border}`, padding: "40px 16px", textAlign: "center" }}>
              <p style={{ margin: 0, fontSize: 12, color: T.textFaint, letterSpacing: "0.05em" }}>確定シフトがありません</p>
            </div>
          ) : (
            <div style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}>
              {shifts.map((s, idx) => {
                const bld = getBuildingForDate(s.date);
                const isToday2 = s.date === today;
                return (
                  <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", borderBottom: idx < shifts.length - 1 ? `1px solid ${T.border}` : "none", backgroundColor: isToday2 ? T.accentBg : "transparent" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                      <span style={{ fontFamily: FONT_SERIF, fontSize: 13, fontWeight: 500, letterSpacing: "0.03em", minWidth: 76, color: T.text }}>{formatDate(s.date)}</span>
                      {s.store_id > 0 && <span style={{ fontSize: 10, padding: "2px 8px", border: `1px solid ${T.accent}44`, color: T.accent, letterSpacing: "0.03em" }}>{getStoreShort(s.store_id)}</span>}
                      {bld && <span style={{ fontSize: 10, padding: "2px 8px", border: `1px solid ${T.border}`, color: T.textSub, letterSpacing: "0.03em" }}>🏢 {bld}</span>}
                      <span style={{ fontFamily: FONT_SANS, fontSize: 13, letterSpacing: "0.02em", color: T.text }}>{s.start_time?.slice(0,5)} — {s.end_time?.slice(0,5)}</span>
                    </div>
                    {isToday2 && <span style={{ fontSize: 9, padding: "3px 10px", color: "#fff", backgroundColor: T.accent, letterSpacing: "0.15em", fontFamily: FONT_DISPLAY, fontWeight: 500 }}>TODAY</span>}
                  </div>
                );
              })}
            </div>
          )}

          {shiftRequests.filter(r => r.status === "pending").length > 0 && (
            <div>
              <div style={{ textAlign: "center", marginBottom: 14 }}>
                <p style={{ fontFamily: FONT_DISPLAY, fontSize: 10, letterSpacing: "0.2em", color: "#b38419", marginBottom: 4, fontWeight: 500 }}>PENDING</p>
                <p style={{ fontFamily: FONT_SERIF, fontSize: 12, letterSpacing: "0.08em", color: T.text, fontWeight: 500 }}>⏳ 承認待ちのシフト希望</p>
              </div>
              <div style={{ backgroundColor: "rgba(179,132,25,0.04)", border: `1px solid #b3841944` }}>
                {shiftRequests.filter(r => r.status === "pending").map((r, idx, arr) => (
                  <div key={r.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderBottom: idx < arr.length - 1 ? `1px solid #b3841922` : "none", fontSize: 12 }}>
                    <span style={{ fontFamily: FONT_SERIF, letterSpacing: "0.03em" }}>{formatDate(r.date)}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {r.store_id > 0 && <span style={{ fontSize: 10, color: T.accent, letterSpacing: "0.03em" }}>{getStoreShort(r.store_id)}</span>}
                      <span style={{ fontFamily: FONT_SANS, fontSize: 12 }}>{r.start_time} — {r.end_time}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>)}

        {tab === "salary" && (<div style={{ display: "flex", flexDirection: "column", gap: 20, fontFamily: FONT_SERIF }}>
          {/* セクション見出し */}
          <div style={{ textAlign: "center" }}>
            <p style={{ fontFamily: FONT_DISPLAY, fontSize: 11, letterSpacing: "0.25em", color: T.accent, marginBottom: 6, fontWeight: 500 }}>PAYSLIP</p>
            <p style={{ fontFamily: FONT_SERIF, fontSize: 15, letterSpacing: "0.08em", color: T.text, fontWeight: 500, marginBottom: 10 }}>💰 給料明細</p>
            <div style={{ width: 30, height: 1, backgroundColor: T.accent, margin: "0 auto" }} />
          </div>

          {/* モード切替セグメント */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", border: `1px solid ${T.border}` }}>
            {([["monthly","📅","月別"],["annual","📊","年間"]] as const).map(([k, emoji, l], idx) => {
              const active = salaryViewMode === k;
              return (
                <button key={k} onClick={() => setSalaryViewMode(k)}
                  style={{ padding: "10px", fontSize: 12, cursor: "pointer", border: "none", borderLeft: idx > 0 ? `1px solid ${T.border}` : "none", backgroundColor: active ? T.accent : "transparent", color: active ? "#fff" : T.textSub, fontFamily: FONT_SERIF, letterSpacing: "0.08em", fontWeight: active ? 500 : 400, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                  <span>{emoji}</span><span>{l}</span>
                </button>
              );
            })}
          </div>

          {/* 月別ビュー */}
          {salaryViewMode === "monthly" && (<>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
              <button onClick={() => { const d = new Date(smY, smM - 2, 1); setSalaryMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`); }} style={{ padding: "6px 12px", fontSize: 12, cursor: "pointer", border: `1px solid ${T.border}`, backgroundColor: "transparent", color: T.textSub, fontFamily: FONT_SERIF }}>◀</button>
              <div style={{ padding: "6px 20px", border: `1px solid ${T.border}`, backgroundColor: T.cardAlt, fontFamily: FONT_DISPLAY, fontSize: 16, letterSpacing: "0.05em", color: T.text, minWidth: 120, textAlign: "center" }}>{smY}.{String(smM).padStart(2, "0")}</div>
              <button onClick={() => { const d = new Date(smY, smM, 1); setSalaryMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`); }} style={{ padding: "6px 12px", fontSize: 12, cursor: "pointer", border: `1px solid ${T.border}`, backgroundColor: "transparent", color: T.textSub, fontFamily: FONT_SERIF }}>▶</button>
            </div>

            {/* 月サマリー3カード */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              {[
                { label: "MONTHLY", jp: "月合計", v: monthTotal.toLocaleString(), unit: "¥", primary: true },
                { label: "ORDERS",  jp: "接客数", v: String(monthOrders),           unit: "件", primary: false },
                { label: "DAYS",    jp: "出勤日数", v: String(monthDays),           unit: "日", primary: false },
              ].map(s => (
                <div key={s.label} style={{ backgroundColor: T.card, border: `1px solid ${T.border}`, padding: "18px 10px", textAlign: "center" }}>
                  <p style={{ fontFamily: FONT_DISPLAY, fontSize: 9, letterSpacing: "0.15em", color: T.textMuted, marginBottom: 4, fontWeight: 500 }}>{s.label}</p>
                  <p style={{ fontFamily: FONT_SANS, fontSize: s.primary ? 19 : 22, color: s.primary ? T.accent : T.text, fontWeight: s.primary ? 500 : 300, letterSpacing: "0em", lineHeight: 1.1, marginBottom: 2 }}>
                    {s.unit === "¥" && <span style={{ fontSize: 13 }}>¥</span>}{s.v}{s.unit !== "¥" && <span style={{ fontSize: 11, color: T.textMuted, marginLeft: 2, fontWeight: 400 }}>{s.unit}</span>}
                  </p>
                  <p style={{ fontFamily: FONT_SERIF, fontSize: 10, color: T.textMuted, letterSpacing: "0.08em" }}>{s.jp}</p>
                </div>
              ))}
            </div>

            {/* 日別清算リスト */}
            {settlements.length === 0 ? (
              <div style={{ padding: "40px 16px", textAlign: "center", backgroundColor: T.card, border: `1px solid ${T.border}` }}>
                <p style={{ margin: 0, fontSize: 12, color: T.textFaint, letterSpacing: "0.05em" }}>清算データがありません</p>
              </div>
            ) : (
              <div style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}>
                {settlements.map((stl, idx) => (
                  <div key={stl.id} style={{ padding: "14px 16px", borderBottom: idx < settlements.length - 1 ? `1px solid ${T.border}` : "none" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ fontFamily: FONT_SERIF, fontSize: 13, fontWeight: 500, letterSpacing: "0.03em", color: T.text }}>{formatDate(stl.date)}</span>
                      <span style={{ fontFamily: FONT_SANS, fontSize: 16, fontWeight: 500, color: T.accent, letterSpacing: "0.02em" }}><span style={{ fontSize: 11 }}>¥</span>{(stl.final_payment || 0).toLocaleString()}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "4px 12px", fontSize: 10, flexWrap: "wrap", color: T.textMuted, letterSpacing: "0.02em" }}>
                      <span>{stl.order_count}件</span>
                      <span>売上 <span style={{ fontFamily: FONT_SANS }}>{fmt(stl.total_sales)}</span></span>
                      <span>バック <span style={{ fontFamily: FONT_SANS }}>{fmt(stl.total_back)}</span></span>
                      {stl.invoice_deduction > 0 && <span style={{ color: "#c96b83" }}>INV <span style={{ fontFamily: FONT_SANS }}>-{fmt(stl.invoice_deduction)}</span></span>}
                      {stl.withholding_tax > 0 && <span style={{ color: "#c96b83" }}>源泉 <span style={{ fontFamily: FONT_SANS }}>-{fmt(stl.withholding_tax)}</span></span>}
                      {stl.welfare_fee > 0 && <span style={{ color: "#c96b83" }}>備品 <span style={{ fontFamily: FONT_SANS }}>-{fmt(stl.welfare_fee)}</span></span>}
                      {stl.transport_fee > 0 && <span style={{ color: "#6b9b7e" }}>交通 <span style={{ fontFamily: FONT_SANS }}>+{fmt(stl.transport_fee)}</span></span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>)}

          {/* 年間ビュー */}
          {salaryViewMode === "annual" && (() => {
            const aGross = annualSettlements.reduce((s, r) => s + (r.total_back || 0) + (r.adjustment || 0), 0);
            const aInvDed = annualSettlements.reduce((s, r) => s + (r.invoice_deduction || 0), 0);
            const aTax = annualSettlements.reduce((s, r) => s + (r.withholding_tax || 0), 0);
            const aWelfare = annualSettlements.reduce((s, r) => s + (r.welfare_fee || 0), 0);
            const aTransport = annualSettlements.reduce((s, r) => s + (r.transport_fee || 0), 0);
            const aFinal = annualSettlements.reduce((s, r) => s + (r.final_payment || 0), 0);
            const aDays = annualSettlements.length;
            const aOrders = annualSettlements.reduce((s, r) => s + (r.order_count || 0), 0);
            const monthlyData: { month: string; gross: number; final: number; days: number }[] = [];
            for (let m = 1; m <= 12; m++) {
              const key = `${salaryYear}-${String(m).padStart(2, "0")}`;
              const ms = annualSettlements.filter(s => s.date.startsWith(key));
              if (ms.length > 0) monthlyData.push({ month: `${m}月`, gross: ms.reduce((s, r) => s + (r.total_back || 0) + (r.adjustment || 0), 0), final: ms.reduce((s, r) => s + (r.final_payment || 0), 0), days: ms.length });
            }
            const openPayslip = () => {
              if (!therapist) return;
              const th = therapist as any;
              const realName = th.real_name || th.name;
              const hasInv = th.has_invoice || false;
              const invNum = th.therapist_invoice_number || "";
              const store = storeInfo;
              const w = window.open("", "_blank"); if (!w) return;
              w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>支払調書_${salaryYear}_${realName}</title>
<style>body{font-family:'Hiragino Sans','Yu Gothic','Meiryo',sans-serif;max-width:750px;margin:40px auto;padding:30px;color:#333}h1{text-align:center;font-size:20px;border-bottom:3px double #333;padding-bottom:10px;margin-bottom:5px;letter-spacing:4px}h2{text-align:center;font-size:12px;color:#888;font-weight:normal;margin-bottom:25px}table{width:100%;border-collapse:collapse;margin:15px 0}td,th{border:1px solid #ccc;padding:9px 14px;font-size:12px}th{background:#f5f0e8;text-align:left;width:38%}.right{text-align:right}.total-row{background:#f9f6f0;font-weight:bold;font-size:14px}.section{margin-top:25px;padding-top:15px;border-top:1px solid #ddd}.company{font-size:11px;line-height:2;color:#555}.note{font-size:9px;color:#888;margin-top:4px;line-height:1.8}.doc-title{font-size:9px;color:#999;text-align:right;margin-bottom:20px}.stamp-area{display:flex;justify-content:space-between;margin-top:40px}.stamp-box{border-top:1px solid #333;width:180px;text-align:center;padding-top:5px;font-size:10px;color:#888}@media print{body{margin:0;padding:20px}}</style></head><body>
<p class="doc-title">報酬、料金、契約金及び賞金の支払調書</p><h1>支　払　調　書</h1><h2>対象期間：${salaryYear}年1月1日 〜 ${salaryYear}年12月31日</h2>
<table><tr><th>支払を受ける者（氏名）</th><td>${realName}</td></tr>${realName !== th.name ? `<tr><th>業務上の名称</th><td>${th.name}</td></tr>` : ""}<tr><th>支払を受ける者（住所）</th><td>${th.address || '<span style="color:#c45555">※未登録</span>'}</td></tr>${th.birth_date ? `<tr><th>生年月日</th><td>${th.birth_date}</td></tr>` : ""}<tr><th>区分</th><td>${th.has_withholding ? "報酬（所得税法第204条第1項第6号）" : "報酬（所得税法第204条第1項第1号）"}</td></tr><tr><th>細目</th><td>${th.has_withholding ? "ホステス等の業務に関する報酬" : "マッサージ施術業務"}</td></tr><tr><th>適格請求書発行事業者</th><td>${hasInv ? `登録あり（登録番号：${invNum}）` : "未登録"}</td></tr></table>
<table><tr><th style="width:45%">項目</th><th class="right" style="width:20%">金額</th><th style="width:35%">摘要</th></tr>
<tr><td>稼働日数</td><td class="right">${aDays}日</td><td style="font-size:10px;color:#888">年間清算回数</td></tr>
<tr><td><strong>支払金額（税込）</strong></td><td class="right"><strong>&yen;${aGross.toLocaleString()}</strong></td><td style="font-size:10px;color:#888">業務委託報酬の年間合計</td></tr>
${aInvDed > 0 ? `<tr><td style="color:#c45555">仕入税額控除の経過措置</td><td class="right" style="color:#c45555">-&yen;${aInvDed.toLocaleString()}</td><td style="font-size:10px;color:#888">報酬額の10%を控除</td></tr><tr style="background:#f9f6f0"><td>控除後の報酬額</td><td class="right">&yen;${(aGross - aInvDed).toLocaleString()}</td><td style="font-size:10px;color:#888">支払金額 − 仕入税額控除</td></tr>` : ""}
${aTax > 0 ? `<tr><td style="color:#c45555">源泉徴収税額</td><td class="right" style="color:#c45555">-&yen;${aTax.toLocaleString()}</td><td style="font-size:10px;color:#888">所得税及び復興特別所得税</td></tr>` : `<tr><td>源泉徴収税額</td><td class="right">&yen;0</td><td style="font-size:10px;color:#888">源泉徴収対象外</td></tr>`}
${aWelfare > 0 ? `<tr><td style="color:#c45555">備品代・リネン代</td><td class="right" style="color:#c45555">-&yen;${aWelfare.toLocaleString()}</td><td style="font-size:10px;color:#888">&yen;${aDays > 0 ? Math.round(aWelfare / aDays).toLocaleString() : 0}/日 × ${aDays}日</td></tr>` : ""}
${aTransport > 0 ? `<tr><td>交通費（実費精算分）</td><td class="right">&yen;${aTransport.toLocaleString()}</td><td style="font-size:10px;color:#888">&yen;${aDays > 0 ? Math.round(aTransport / aDays).toLocaleString() : 0}/日 × ${aDays}日</td></tr>` : ""}
<tr class="total-row"><td>差引支払額</td><td class="right">&yen;${aFinal.toLocaleString()}</td><td style="font-size:10px;color:#888">年間支給額合計</td></tr></table>
<div style="margin-top:15px"><p class="note">※ 支払金額は全て税込（内税方式）で記載。</p><p class="note">※ 源泉徴収税額は所得税法第204条第1項${th.has_withholding ? "第6号" : "第1号"}に基づき日次清算時に控除済み。</p>${aTransport > 0 ? `<p class="note">※ 交通費（実費精算分）は立替精算のため、支払金額・源泉徴収の対象外です（所得税基本通達204-2）。</p>` : ""}${aWelfare > 0 ? `<p class="note">※ 備品・リネン代は業務使用の備品・消耗品に対する実費控除です。確定申告時に必要経費として計上可能です。</p>` : ""}<p class="note">※ 本書は所得税法第225条第1項に基づく支払調書に準じて作成。</p></div>
<div class="section"><p style="font-size:11px;color:#888;margin-bottom:8px">支払者</p><div class="company"><p><strong>${store?.company_name || ""}</strong></p><p>${store?.company_address || ""}</p><p>TEL: ${store?.company_phone || ""}</p>${store?.invoice_number ? `<p>適格請求書発行事業者登録番号: ${store.invoice_number}</p>` : ""}</div></div>
<div class="stamp-area"><div class="stamp-box">支払者（${store?.company_name || ""}）</div><div class="stamp-box">支払を受ける者（${realName} 様）</div></div></body></html>`);
              w.document.close();
            };
            return (<>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
                <button onClick={() => setSalaryYear(salaryYear - 1)} style={{ padding: "6px 12px", fontSize: 12, cursor: "pointer", border: `1px solid ${T.border}`, backgroundColor: "transparent", color: T.textSub, fontFamily: FONT_SERIF }}>◀</button>
                <div style={{ padding: "6px 24px", border: `1px solid ${T.border}`, backgroundColor: T.cardAlt, fontFamily: FONT_DISPLAY, fontSize: 18, letterSpacing: "0.05em", color: T.text, minWidth: 100, textAlign: "center" }}>{salaryYear}</div>
                <button onClick={() => setSalaryYear(salaryYear + 1)} style={{ padding: "6px 12px", fontSize: 12, cursor: "pointer", border: `1px solid ${T.border}`, backgroundColor: "transparent", color: T.textSub, fontFamily: FONT_SERIF }}>▶</button>
              </div>

              {annualLoading ? (
                <p style={{ fontSize: 12, textAlign: "center", padding: "40px 0", color: T.textFaint }}>読み込み中...</p>
              ) : (<>
                {/* 年間サマリー2x2 */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {[
                    { label: "ANNUAL",   jp: "年間報酬（税込）", v: aGross.toLocaleString(), unit: "¥", color: T.accent, primary: true },
                    { label: "NET",      jp: "差引支払額",       v: aFinal.toLocaleString(), unit: "¥", color: "#b38419", primary: true },
                    { label: "TAX",      jp: "源泉徴収",         v: aTax > 0 ? `-${aTax.toLocaleString()}` : "0", unit: aTax > 0 ? "¥" : "—", color: aTax > 0 ? "#c96b83" : T.textMuted, primary: false },
                    { label: "WORKDAYS", jp: "出勤日数",         v: `${aDays}`, unit: `日 / ${aOrders}件`, color: T.text, primary: false },
                  ].map(s => (
                    <div key={s.label} style={{ backgroundColor: T.card, border: `1px solid ${T.border}`, padding: "20px 14px", textAlign: "center" }}>
                      <p style={{ fontFamily: FONT_DISPLAY, fontSize: 10, letterSpacing: "0.2em", color: T.textMuted, marginBottom: 6, fontWeight: 500 }}>{s.label}</p>
                      <p style={{ fontFamily: FONT_SANS, fontSize: s.primary ? 22 : 20, color: s.color, fontWeight: s.primary ? 500 : 300, letterSpacing: "0em", lineHeight: 1.1, marginBottom: 4 }}>
                        {s.unit === "¥" && <span style={{ fontSize: 13 }}>¥</span>}{s.v}{s.unit !== "¥" && <span style={{ fontSize: 10, color: T.textMuted, marginLeft: 3, fontWeight: 400 }}>{s.unit}</span>}
                      </p>
                      <p style={{ fontFamily: FONT_SERIF, fontSize: 10, color: T.textMuted, letterSpacing: "0.08em" }}>{s.jp}</p>
                    </div>
                  ))}
                </div>

                {/* 控除内訳 */}
                {(aInvDed > 0 || aWelfare > 0 || aTransport > 0) && (
                  <div style={{ backgroundColor: T.card, border: `1px solid ${T.border}`, padding: "16px 18px" }}>
                    <p style={{ margin: "0 0 12px", fontFamily: FONT_DISPLAY, fontSize: 10, letterSpacing: "0.2em", color: T.textMuted, fontWeight: 500 }}>CALCULATION — 控除・加算の内訳</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}><span>報酬額（税込）</span><span style={{ fontFamily: FONT_SANS, fontWeight: 500 }}>{fmt(aGross)}</span></div>
                      {aInvDed > 0 && <div style={{ display: "flex", justifyContent: "space-between", color: "#c96b83" }}><span>− インボイス控除（10%）</span><span style={{ fontFamily: FONT_SANS }}>-{fmt(aInvDed)}</span></div>}
                      {aTax > 0 && <div style={{ display: "flex", justifyContent: "space-between", color: "#c96b83" }}><span>− 源泉徴収（10.21%）</span><span style={{ fontFamily: FONT_SANS }}>-{fmt(aTax)}</span></div>}
                      {aWelfare > 0 && <div style={{ display: "flex", justifyContent: "space-between", color: "#c96b83" }}><span>− 備品・リネン代</span><span style={{ fontFamily: FONT_SANS }}>-{fmt(aWelfare)}</span></div>}
                      {aTransport > 0 && <div style={{ display: "flex", justifyContent: "space-between", color: "#6b9b7e" }}><span>+ 交通費（実費精算・非課税）</span><span style={{ fontFamily: FONT_SANS }}>+{fmt(aTransport)}</span></div>}
                      <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 10, marginTop: 4, borderTop: `1px dashed ${T.border}`, fontWeight: 600, color: "#b38419" }}>
                        <span>差引支払額（お手取り）</span>
                        <span style={{ fontFamily: FONT_SANS, fontSize: 15 }}>{fmt(aFinal)}</span>
                      </div>
                    </div>
                    <div style={{ marginTop: 14, paddingTop: 10, borderTop: `1px dashed ${T.border}`, fontSize: 10, color: T.textMuted, lineHeight: 1.8, letterSpacing: "0.02em" }}>
                      <p style={{ margin: "0 0 4px", fontWeight: 500, color: T.textSub }}>💡 確定申告のヒント</p>
                      <p style={{ margin: 0 }}>・上の「報酬額（税込）」が税務署に報告される<strong>支払金額</strong>です（収入）</p>
                      {aWelfare > 0 && <p style={{ margin: 0 }}>・<strong>備品・リネン代</strong>（{fmt(aWelfare)}）は必要経費として計上できます（消耗品費など）</p>}
                      {aTransport > 0 && <p style={{ margin: 0 }}>・<strong>交通費（実費精算分）</strong>（{fmt(aTransport)}）は立替精算なので<span style={{ color: "#c96b83" }}>収入にも経費にもなりません</span>（課税対象外）</p>}
                      {aTax > 0 && <p style={{ margin: 0 }}>・<strong>源泉徴収税額</strong>（{fmt(aTax)}）は確定申告で還付または納税調整の対象になります</p>}
                    </div>
                  </div>
                )}

                {/* 支払調書・証明書ボタン */}
                {aDays > 0 && (
                  <button onClick={openPayslip} style={{ width: "100%", padding: 14, fontSize: 13, cursor: "pointer", backgroundColor: T.accent, color: "#fff", border: "none", fontFamily: FONT_SERIF, letterSpacing: "0.15em", fontWeight: 500 }}>
                    📄 {salaryYear}年 支払調書を表示
                  </button>
                )}
                <button onClick={() => { setMoneySub("cert"); setTab("cert"); window.location.hash = "cert"; }} style={{ width: "100%", padding: 13, fontSize: 12, cursor: "pointer", backgroundColor: "transparent", border: `1px solid ${T.accent}`, color: T.accent, fontFamily: FONT_SERIF, letterSpacing: "0.1em", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  📄 証明書を発行する →
                </button>

                {/* 月別内訳 */}
                {monthlyData.length > 0 && (
                  <div style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}>
                    <div style={{ padding: "12px 16px", borderBottom: `1px solid ${T.border}` }}>
                      <p style={{ margin: 0, fontFamily: FONT_DISPLAY, fontSize: 10, letterSpacing: "0.2em", color: T.textMuted, fontWeight: 500 }}>MONTHLY BREAKDOWN</p>
                    </div>
                    {monthlyData.map(md => (
                      <div key={md.month} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: `1px solid ${T.border}` }}>
                        <span style={{ fontFamily: FONT_SERIF, fontSize: 13, fontWeight: 500, letterSpacing: "0.03em" }}>{md.month}</span>
                        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                          <span style={{ fontSize: 10, color: T.textMuted, fontFamily: FONT_SANS }}>{md.days}日</span>
                          <span style={{ fontSize: 10, color: T.textMuted }}>報酬 <span style={{ fontFamily: FONT_SANS }}>{fmt(md.gross)}</span></span>
                          <span style={{ fontFamily: FONT_SANS, fontSize: 14, fontWeight: 500, color: T.accent }}>{fmt(md.final)}</span>
                        </div>
                      </div>
                    ))}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", backgroundColor: T.cardAlt }}>
                      <span style={{ fontFamily: FONT_SERIF, fontSize: 13, fontWeight: 600, letterSpacing: "0.08em" }}>合計</span>
                      <span style={{ fontFamily: FONT_SANS, fontSize: 16, fontWeight: 600, color: T.accent }}>{fmt(aFinal)}</span>
                    </div>
                  </div>
                )}
                {aDays === 0 && (
                  <div style={{ padding: "40px 16px", textAlign: "center", backgroundColor: T.card, border: `1px solid ${T.border}` }}>
                    <p style={{ margin: 0, fontSize: 12, color: T.textFaint, letterSpacing: "0.05em" }}>{salaryYear}年の清算データがありません</p>
                  </div>
                )}
              </>)}
            </>);
          })()}
        </div>)}


        {tab === "customers" && (<div style={{ display: "flex", flexDirection: "column", gap: 18, fontFamily: FONT_SERIF }}>
          {/* セクション見出し */}
          <div style={{ textAlign: "center" }}>
            <p style={{ fontFamily: FONT_DISPLAY, fontSize: 11, letterSpacing: "0.25em", color: T.accent, marginBottom: 6, fontWeight: 500 }}>CUSTOMER MEMO</p>
            <p style={{ fontFamily: FONT_SERIF, fontSize: 15, letterSpacing: "0.08em", color: T.text, fontWeight: 500, marginBottom: 10 }}>👤 お客様メモ・NG</p>
            <div style={{ width: 30, height: 1, backgroundColor: T.accent, margin: "0 auto" }} />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button onClick={() => { setShowAddNote(true); setNoteForm({ customer_name: "", note: "", is_ng: false, ng_reason: "", rating: 0, reservation_id: 0 }); }}
              style={{ padding: "8px 16px", fontSize: 11, cursor: "pointer", backgroundColor: T.accent, color: "#fff", border: "none", fontFamily: FONT_SERIF, letterSpacing: "0.1em", fontWeight: 500 }}>
              + メモ追加
            </button>
          </div>

          {/* NG案内 */}
          <div style={{ backgroundColor: "rgba(107,139,168,0.04)", border: `1px solid #6b8ba844`, padding: "14px 16px" }}>
            <p style={{ margin: "0 0 6px", fontFamily: FONT_SERIF, fontSize: 12, fontWeight: 500, letterSpacing: "0.05em", color: "#6b8ba8" }}>🛡️ NG登録について</p>
            <p style={{ margin: 0, fontSize: 11, lineHeight: 1.9, color: T.textSub, letterSpacing: "0.03em" }}>
              NGに登録されたお客様がネット予約をする際は、あなたの出勤枠が<span style={{ color: "#c96b83", fontWeight: 600 }}>「お休み」として表示</span>されるため、予約が入ることはありません。お電話でのご予約の場合も、受付スタッフが事前に確認しお断りいたしますのでご安心ください。
            </p>
          </div>

          {/* 検索 */}
          <input type="text" value={noteSearch} onChange={(e) => setNoteSearch(e.target.value)} placeholder="お客様名で検索..."
            style={{ width: "100%", padding: "11px 14px", fontSize: 12, outline: "none", border: `1px solid ${T.border}`, backgroundColor: T.cardAlt, color: T.text, fontFamily: FONT_SERIF, boxSizing: "border-box" }} />

          {/* お客様チップ一覧 */}
          {uniqueCustomers.length > 0 && (
            <div style={{ backgroundColor: T.card, border: `1px solid ${T.border}`, padding: "14px 16px" }}>
              <p style={{ margin: "0 0 10px", fontFamily: FONT_DISPLAY, fontSize: 10, letterSpacing: "0.2em", color: T.textMuted, fontWeight: 500 }}>
                接客したお客様 <span style={{ fontFamily: FONT_SANS, color: T.accent, letterSpacing: 0, marginLeft: 4 }}>{uniqueCustomers.length}名</span>
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {uniqueCustomers.filter(([name]) => !noteSearch || name.includes(noteSearch)).map(([name, info]) => {
                  const notes = customerNotes.filter(n => n.customer_name === name);
                  const isNg = notes.some(n => n.is_ng);
                  const hasNote = notes.length > 0;
                  return (
                    <button key={name} onClick={() => setNoteHistoryCustomer(name)}
                      style={{
                        padding: "6px 11px",
                        fontSize: 11,
                        cursor: "pointer",
                        border: `1px solid ${isNg ? "#c96b83" : hasNote ? T.accent : T.border}`,
                        backgroundColor: isNg ? "rgba(201,107,131,0.08)" : hasNote ? T.accentBg : T.cardAlt,
                        color: isNg ? "#c96b83" : T.text,
                        fontFamily: FONT_SERIF,
                        letterSpacing: "0.03em",
                      }}>
                      {isNg && "🚫 "}{name}
                      <span style={{ fontFamily: FONT_SANS, marginLeft: 4, color: T.textMuted, fontSize: 10 }}>({info.count})</span>
                      {notes.length > 0 && <span style={{ marginLeft: 3 }}>📝{notes.length > 1 ? notes.length : ""}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 登録済みメモ */}
          <div style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}>
            <div style={{ padding: "12px 16px", borderBottom: `1px solid ${T.border}` }}>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 500, letterSpacing: "0.05em", color: T.text }}>
                登録済みメモ <span style={{ fontFamily: FONT_SANS, color: T.accent, marginLeft: 4 }}>{customerNotes.length}件</span>
              </p>
              <p style={{ margin: "3px 0 0", fontSize: 9, color: T.textFaint, letterSpacing: "0.03em" }}>※ メモの削除はスタッフにお申し付けください</p>
            </div>
            {customerNotes.filter(n => !noteSearch || n.customer_name.includes(noteSearch)).length === 0 ? (
              <p style={{ fontSize: 12, textAlign: "center", padding: "32px 0", color: T.textFaint, margin: 0 }}>メモがありません</p>
            ) : (
              customerNotes.filter(n => !noteSearch || n.customer_name.includes(noteSearch)).map((n, idx, arr) => {
                const res = n.reservation_id ? allReservations.find(r => r.id === n.reservation_id) : null;
                return (
                  <div key={n.id} style={{ padding: "12px 16px", cursor: "pointer", borderBottom: idx < arr.length - 1 ? `1px solid ${T.border}` : "none" }} onClick={() => setNoteHistoryCustomer(n.customer_name)}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 12, fontWeight: 500, letterSpacing: "0.03em" }}>{n.customer_name}</span>
                      {n.is_ng && <span style={{ fontSize: 9, padding: "2px 7px", color: "#c96b83", border: `1px solid #c96b8344`, backgroundColor: "rgba(201,107,131,0.06)", letterSpacing: "0.05em" }}>🚫 NG</span>}
                      {n.rating > 0 && <span style={{ fontSize: 10, color: "#b38419", letterSpacing: "0.05em" }}>{"★".repeat(n.rating)}</span>}
                      {res && <span style={{ fontFamily: FONT_SANS, fontSize: 10, color: T.textMuted }}>{formatDate(res.date)}</span>}
                    </div>
                    {n.note && <p style={{ margin: "4px 0 0", fontSize: 11, color: T.textSub, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", letterSpacing: "0.02em" }}>{n.note}</p>}
                  </div>
                );
              })
            )}
          </div>
        </div>)}

        {tab === "manual" && (<div className="space-y-4">
          {/* マニュアル詳細表示 */}
          {manualViewArticle ? (() => {
            const cat = manualCats.find(c => c.id === manualViewArticle.category_id);
            const latestUpd = manualUpdates.find(u => u.article_id === manualViewArticle.id);
            return (
              <div style={{ fontFamily: FONT_SERIF }}>
                {/* 戻るボタン */}
                <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
                  <button onClick={goBackManual} style={{ padding: "8px 14px", fontSize: 11, cursor: "pointer", border: `1px solid ${T.border}`, color: T.textSub, backgroundColor: "transparent", fontFamily: FONT_SERIF, letterSpacing: "0.05em" }}>
                    {manualHistory.length > 0 ? `← ${manualHistory[manualHistory.length - 1].title.slice(0, 12)}${manualHistory[manualHistory.length - 1].title.length > 12 ? '...' : ''} に戻る` : '← 一覧に戻る'}
                  </button>
                  {manualHistory.length > 0 && (
                    <button onClick={() => { setManualViewArticle(null); setManualHistory([]); }} style={{ padding: "8px 14px", fontSize: 11, cursor: "pointer", border: `1px solid ${T.border}`, color: T.textMuted, backgroundColor: "transparent", fontFamily: FONT_SERIF, letterSpacing: "0.05em" }}>
                      📋 一覧へ
                    </button>
                  )}
                </div>

                {/* カバー画像 */}
                {manualViewArticle.cover_image && (
                  <div style={{ overflow: "hidden", marginBottom: 18, maxHeight: 220 }}>
                    <img src={manualViewArticle.cover_image} alt="" style={{ width: "100%", objectFit: "cover" }} />
                  </div>
                )}

                {/* カテゴリ英文ラベル */}
                {cat && (
                  <p style={{ fontFamily: FONT_DISPLAY, fontSize: 10, letterSpacing: "0.25em", color: T.accent, fontWeight: 500, marginBottom: 6 }}>
                    ARTICLE
                  </p>
                )}

                {/* タイトル */}
                <h2 style={{ fontFamily: FONT_SERIF, fontSize: 20, fontWeight: 500, letterSpacing: "0.05em", color: T.text, lineHeight: 1.5, marginBottom: 10 }}>
                  {manualViewArticle.title}
                </h2>

                {/* ピンク細罫線 */}
                <div style={{ width: 30, height: 1, backgroundColor: T.accent, marginBottom: 14 }} />

                {/* カテゴリ・タグ */}
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
                  {cat && <span style={{ fontSize: 10, padding: "3px 10px", backgroundColor: cat.color, color: "#333", letterSpacing: "0.03em" }}>{cat.icon} {cat.name}</span>}
                  {manualViewArticle.tags.map(t => <span key={t} style={{ fontSize: 10, padding: "3px 10px", backgroundColor: T.cardAlt, color: T.textSub, letterSpacing: "0.03em" }}>{t}</span>)}
                </div>

                {/* 更新通知 */}
                {latestUpd && (
                  <div style={{ padding: "10px 14px", marginBottom: 16, backgroundColor: "rgba(179,132,25,0.06)", border: `1px solid #b3841944`, display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 14 }}>✏️</span>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, fontFamily: FONT_DISPLAY, fontSize: 9, letterSpacing: "0.15em", color: "#b38419", fontWeight: 500 }}>UPDATED {new Date(latestUpd.created_at).toLocaleDateString("ja")}</p>
                      <p style={{ margin: "2px 0 0", fontSize: 11, color: "#b38419", letterSpacing: "0.02em" }}>{latestUpd.summary}</p>
                    </div>
                  </div>
                )}

                {/* 本文 */}
                <div style={{ backgroundColor: T.card, border: `1px solid ${T.border}`, padding: "18px 20px", marginBottom: 16 }}>
                  {manualViewArticle.content.split("\n").map((line, i) => {
                    if (line.startsWith("## ")) return <h3 key={i} style={{ fontSize: 15, fontWeight: 500, marginTop: 16, marginBottom: 8, color: T.accent, fontFamily: FONT_SERIF, letterSpacing: "0.05em" }}>{renderInlineLinks(line.slice(3))}</h3>;
                    if (line.startsWith("### ")) return <h4 key={i} style={{ fontSize: 13, fontWeight: 500, marginTop: 12, marginBottom: 6, color: T.accent, fontFamily: FONT_SERIF, letterSpacing: "0.03em" }}>{renderInlineLinks(line.slice(4))}</h4>;
                    if (line.startsWith("- ")) return <div key={i} style={{ display: "flex", gap: 10, fontSize: 13, lineHeight: 1.9, marginLeft: 6, letterSpacing: "0.02em" }}><span style={{ color: T.accent }}>●</span><span>{renderInlineContent(line.slice(2))}</span></div>;
                    if (line.match(/^\d+\.\s/)) return <div key={i} style={{ display: "flex", gap: 10, fontSize: 13, lineHeight: 1.9, marginLeft: 6, letterSpacing: "0.02em" }}><span style={{ color: T.accent, fontWeight: 600, minWidth: 18, fontFamily: FONT_SANS }}>{line.match(/^(\d+)\./)?.[1]}.</span><span>{renderInlineContent(line.replace(/^\d+\.\s/, ""))}</span></div>;
                    if (line.startsWith("> ")) return <div key={i} style={{ borderLeft: `2px solid ${T.accent}`, paddingLeft: 14, margin: "8px 0", fontSize: 12, color: T.textSub, fontStyle: "italic", letterSpacing: "0.02em", lineHeight: 1.9 }}>{renderInlineContent(line.slice(2))}</div>;
                    if (line.trim() === "---") return <hr key={i} style={{ border: "none", borderTop: `1px solid ${T.border}`, margin: "14px 0" }} />;
                    if (line.startsWith("![")) { const m = line.match(/!\[.*?\]\((.*?)\)/); if (m) return <img key={i} src={m[1]} alt="" style={{ margin: "10px 0", maxWidth: "100%" }} />; }
                    if (line.match(/^\[youtube:([\w-]+)\]$/)) { const vid = line.match(/^\[youtube:([\w-]+)\]$/)?.[1]; return <div key={i} style={{ position: "relative", paddingBottom: "56.25%", height: 0, margin: "10px 0", overflow: "hidden" }}><iframe src={`https://www.youtube.com/embed/${vid}`} style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: "none" }} allowFullScreen /></div>; }
                    if (line.match(/^\[gdrive:([\w-]+)(:.*)?\]$/)) { const gm = line.match(/^\[gdrive:([\w-]+)(?::(.+))?\]$/); const fid = gm?.[1]; const gdesc = gm?.[2] || ""; return <div key={i} style={{ margin: "14px 0" }}><div style={{ position: "relative", paddingBottom: "56.25%", height: 0, overflow: "hidden" }}><iframe src={`https://drive.google.com/file/d/${fid}/preview`} style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: "none" }} allow="autoplay" /></div>{gdesc && <p style={{ fontSize: 11, fontWeight: 500, marginTop: 6, textAlign: "center", color: T.accent, fontFamily: FONT_SERIF, letterSpacing: "0.05em" }}>🎬 {gdesc}</p>}</div>; }
                    if (line.match(/\*\*(.*?)\*\*/)) { return <p key={i} style={{ fontSize: 13, lineHeight: 1.9, letterSpacing: "0.02em", margin: "4px 0" }}>{renderInlineContent(line)}</p>; }
                    if (line.trim() === "") return <div key={i} style={{ height: 8 }} />;
                    return <p key={i} style={{ fontSize: 13, lineHeight: 1.9, letterSpacing: "0.02em", margin: "4px 0" }}>{renderInlineContent(line)}</p>;
                  })}
                </div>

                {/* Q&A */}
                {manualViewQAs.length > 0 && (
                  <div style={{ backgroundColor: T.card, border: `1px solid ${T.border}`, padding: "18px 20px" }}>
                    <p style={{ margin: "0 0 4px", fontFamily: FONT_DISPLAY, fontSize: 10, letterSpacing: "0.2em", color: T.accent, fontWeight: 500 }}>FAQ</p>
                    <h3 style={{ margin: "0 0 14px", fontSize: 13, fontWeight: 500, letterSpacing: "0.05em", color: T.text }}>❓ よくある質問 <span style={{ fontFamily: FONT_DISPLAY, color: T.accent, marginLeft: 4 }}>{manualViewQAs.length}</span></h3>
                    {manualViewQAs.map((qa, i) => (
                      <div key={i} style={{ border: `1px solid ${T.border}`, marginBottom: 6, overflow: "hidden" }}>
                        <button style={{ width: "100%", textAlign: "left", padding: "11px 14px", display: "flex", alignItems: "center", gap: 10, fontSize: 12, fontWeight: 500, cursor: "pointer", backgroundColor: manualOpenQA === i ? T.accentBg : "transparent", border: "none", fontFamily: FONT_SERIF, letterSpacing: "0.03em" }} onClick={() => setManualOpenQA(manualOpenQA === i ? null : i)}>
                          <span style={{ fontFamily: FONT_DISPLAY, fontSize: 10, padding: "2px 8px", backgroundColor: T.accent, color: "#fff", letterSpacing: "0.1em", fontWeight: 500 }}>Q</span>
                          <span style={{ flex: 1, color: T.text }}>{qa.question}</span>
                          <span style={{ color: T.textMuted, fontSize: 10, transition: "transform 0.2s", transform: manualOpenQA === i ? "rotate(90deg)" : "none" }}>▶</span>
                        </button>
                        {manualOpenQA === i && (
                          <div style={{ padding: "10px 14px 14px", fontSize: 12, lineHeight: 1.9, color: T.textSub, borderTop: `1px solid ${T.border}`, display: "flex", gap: 10, alignItems: "flex-start", letterSpacing: "0.02em" }}>
                            <span style={{ fontFamily: FONT_DISPLAY, fontSize: 10, padding: "2px 8px", backgroundColor: "#6b9b7e", color: "#fff", letterSpacing: "0.1em", fontWeight: 500, flexShrink: 0, marginTop: 2 }}>A</span>
                            <span>{qa.answer}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })() : (<div style={{ display: "flex", flexDirection: "column", gap: 16, fontFamily: FONT_SERIF }}>
            {/* セクション見出し */}
            <div style={{ textAlign: "center" }}>
              <p style={{ fontFamily: FONT_DISPLAY, fontSize: 11, letterSpacing: "0.25em", color: T.accent, marginBottom: 6, fontWeight: 500 }}>MANUAL</p>
              <p style={{ fontFamily: FONT_SERIF, fontSize: 15, letterSpacing: "0.08em", color: T.text, fontWeight: 500, marginBottom: 10 }}>📖 業務マニュアル</p>
              <div style={{ width: 30, height: 1, backgroundColor: T.accent, margin: "0 auto" }} />
            </div>

            {/* 更新タイムライン */}
            {manualUpdates.length > 0 && (
              <div style={{ backgroundColor: T.card, border: `1px solid ${T.border}`, padding: "14px 16px" }}>
                <p style={{ margin: "0 0 10px", fontFamily: FONT_DISPLAY, fontSize: 10, letterSpacing: "0.2em", color: T.textMuted, fontWeight: 500 }}>📝 RECENT UPDATES</p>
                {manualUpdates.slice(0, 3).map((u, idx, arr) => {
                  const art = manualArticles.find(a => a.id === u.article_id);
                  return (
                    <div key={u.id} style={{ display: "flex", gap: 10, padding: "8px 0", borderBottom: idx < arr.length - 1 ? `1px solid ${T.border}` : "none" }}>
                      <div style={{ width: 6, height: 6, borderRadius: "50%", background: T.accent, marginTop: 6, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ fontSize: 12, fontWeight: 500, cursor: "pointer", color: T.accent, letterSpacing: "0.03em" }} onClick={() => { if (art) openManualArticle(art); }}>{art?.title || "?"}</span>
                        <span style={{ fontSize: 11, marginLeft: 6, color: T.textMuted }}>{u.summary}</span>
                        <div style={{ fontFamily: FONT_SANS, fontSize: 10, color: T.textFaint, marginTop: 2 }}>{new Date(u.created_at).toLocaleDateString("ja")}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* 検索 */}
            <input type="text" value={manualSearch} onChange={e => setManualSearch(e.target.value)} placeholder="🔍 マニュアルを検索..."
              style={{ width: "100%", padding: "11px 14px", fontSize: 12, outline: "none", border: `1px solid ${T.border}`, backgroundColor: T.cardAlt, color: T.text, fontFamily: FONT_SERIF, boxSizing: "border-box" }} />

            {/* カテゴリフィルタ */}
            <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2, WebkitOverflowScrolling: "touch" }}>
              <button onClick={() => setManualSelCat(null)}
                style={{ padding: "7px 14px", fontSize: 11, cursor: "pointer", border: `1px solid ${manualSelCat === null ? T.accent : T.border}`, backgroundColor: manualSelCat === null ? T.accent : "transparent", color: manualSelCat === null ? "#fff" : T.textSub, whiteSpace: "nowrap", fontFamily: FONT_SERIF, letterSpacing: "0.05em", fontWeight: manualSelCat === null ? 500 : 400 }}>
                すべて
              </button>
              {manualCats.map(c => {
                const active = manualSelCat === c.id;
                return (
                  <button key={c.id} onClick={() => setManualSelCat(c.id)}
                    style={{ padding: "7px 14px", fontSize: 11, cursor: "pointer", border: `1px solid ${active ? T.accent : T.border}`, backgroundColor: active ? T.accent : "transparent", color: active ? "#fff" : T.textSub, whiteSpace: "nowrap", fontFamily: FONT_SERIF, letterSpacing: "0.03em", fontWeight: active ? 500 : 400 }}>
                    {c.icon} {c.name}
                  </button>
                );
              })}
            </div>

            {/* タグフィルタ */}
            {(() => {
              const allT = Array.from(new Set(manualArticles.flatMap(a => a.tags))).sort();
              return allT.length > 0 ? (
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
                  <span style={{ fontSize: 10, color: T.textMuted, marginRight: 2, letterSpacing: "0.05em" }}>🏷️</span>
                  {manualFilterTag && <button onClick={() => setManualFilterTag("")} style={{ fontSize: 10, padding: "3px 8px", cursor: "pointer", border: `1px solid ${T.border}`, color: T.textSub, backgroundColor: "transparent", fontFamily: FONT_SERIF }}>× クリア</button>}
                  {allT.map(t => (
                    <button key={t} onClick={() => setManualFilterTag(manualFilterTag === t ? "" : t)}
                      style={{ fontSize: 10, padding: "3px 10px", cursor: "pointer", backgroundColor: manualFilterTag === t ? T.accent : T.cardAlt, color: manualFilterTag === t ? "#fff" : T.textSub, border: `1px solid ${manualFilterTag === t ? T.accent : T.border}`, opacity: manualFilterTag && manualFilterTag !== t ? 0.4 : 1, fontFamily: FONT_SERIF, letterSpacing: "0.03em" }}>
                      {t}
                    </button>
                  ))}
                </div>
              ) : null;
            })()}
            {/* 記事一覧 */}
            {(() => {
              const filtered = manualArticles.filter(a => {
                if (manualSelCat !== null && a.category_id !== manualSelCat) return false;
                if (manualSearch) { const q = manualSearch.toLowerCase(); if (!a.title.toLowerCase().includes(q) && !a.tags.some(t => t.toLowerCase().includes(q))) return false; }
                if (manualFilterTag && !a.tags.includes(manualFilterTag)) return false;
                return true;
              });
              const pinned = filtered.filter(a => a.is_pinned);
              const unpinned = filtered.filter(a => !a.is_pinned);
              const renderCard = (a: ManualArticle) => {
                const cat = manualCats.find(c => c.id === a.category_id);
                const isRead = manualReads.includes(a.id);
                const latestUpd = manualUpdates.find(u => u.article_id === a.id);
                const isNew = (Date.now() - new Date(a.created_at).getTime()) < 7 * 86400000;
                const isUpdated = latestUpd && !isRead;
                return (
                  <div key={a.id} style={{ backgroundColor: T.card, border: `1px solid ${isNew && !isRead ? T.accent : T.border}`, padding: 12, cursor: "pointer", position: "relative" }} onClick={() => openManualArticle(a)}>
                    {isNew && !isRead && <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, backgroundColor: T.accent }} />}
                    <div style={{ display: "flex", gap: 12 }}>
                      {a.cover_image ? (
                        <div style={{ width: 64, height: 64, overflow: "hidden", flexShrink: 0 }}>
                          <img src={a.cover_image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        </div>
                      ) : (
                        <div style={{ width: 64, height: 64, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, backgroundColor: cat?.color || T.cardAlt }}>
                          {cat?.icon || "📄"}
                        </div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 4 }}>
                          {a.is_pinned && <span style={{ fontSize: 9, padding: "2px 7px", color: "#b38419", border: `1px solid #b3841944`, letterSpacing: "0.05em" }}>📌 ピン</span>}
                          {isNew && !isRead && <span className="manual-new-badge" style={{ fontFamily: FONT_DISPLAY, fontSize: 9, padding: "2px 8px", backgroundColor: T.accent, color: "#fff", letterSpacing: "0.15em", fontWeight: 500 }}>NEW</span>}
                          {isUpdated && <span className="manual-updated-badge" style={{ fontSize: 9, padding: "2px 7px", color: "#b38419", border: `1px solid #b3841944`, letterSpacing: "0.05em" }}>✏️ 更新</span>}
                          {isRead && <span style={{ fontSize: 10, color: "#6b9b7e" }}>✅</span>}
                        </div>
                        <h4 style={{ margin: 0, fontSize: 13, fontWeight: 500, letterSpacing: "0.03em", color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.title}</h4>
                        {a.tags.length > 0 && (
                          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 4 }}>
                            {a.tags.slice(0, 3).map(t => <span key={t} style={{ fontSize: 9, padding: "1px 6px", backgroundColor: T.cardAlt, color: T.textSub, letterSpacing: "0.03em" }}>{t}</span>)}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              };
              return (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {pinned.map(renderCard)}
                  {unpinned.map(renderCard)}
                  {filtered.length === 0 && (
                    <div style={{ textAlign: "center", padding: "40px 16px", backgroundColor: T.card, border: `1px solid ${T.border}` }}>
                      <div style={{ fontSize: 28, marginBottom: 8 }}>📖</div>
                      <p style={{ margin: 0, fontSize: 12, color: T.textMuted, letterSpacing: "0.05em" }}>該当する記事がありません</p>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>)}

          {/* 🤖 AIチャット */}
          {!manualViewArticle && (
            <div>
              {!aiChatOpen ? (
                <button onClick={() => setAiChatOpen(true)}
                  style={{ width: "100%", padding: "14px", fontSize: 12, cursor: "pointer", backgroundColor: "transparent", color: T.accent, border: `1px solid ${T.accent}`, fontFamily: FONT_SERIF, letterSpacing: "0.1em", fontWeight: 500, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  <span style={{ fontSize: 16 }}>🤖</span>
                  <span>マニュアルAIに質問する</span>
                </button>
              ) : (
                <div style={{ backgroundColor: T.card, border: `1px solid ${T.accent}`, overflow: "hidden", fontFamily: FONT_SERIF }}>
                  {/* ヘッダー */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderBottom: `1px solid ${T.border}`, backgroundColor: T.accentBg }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 15 }}>🤖</span>
                      <span style={{ fontFamily: FONT_DISPLAY, fontSize: 11, letterSpacing: "0.2em", color: T.accent, fontWeight: 500 }}>MANUAL AI</span>
                      <span style={{ fontSize: 9, padding: "2px 7px", color: "#6b9b7e", border: `1px solid #6b9b7e44`, letterSpacing: "0.05em", fontFamily: FONT_SERIF }}>● online</span>
                      {aiSessionCount > 0 && <span style={{ fontSize: 9, padding: "2px 7px", color: aiSessionCount >= 4 ? "#c96b83" : "#b38419", border: `1px solid ${aiSessionCount >= 4 ? "#c96b83" : "#b38419"}44`, letterSpacing: "0.03em", fontFamily: FONT_SERIF }}>{aiSessionCount >= 4 ? "質問上限" : `残り${4 - aiSessionCount}回`}</span>}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      {aiChatMessages.length > 0 && (
                        <button onClick={() => { setAiChatMessages([]); setAiSessionCount(0); }} style={{ fontSize: 9, padding: "2px 7px", cursor: "pointer", color: T.textMuted, backgroundColor: "transparent", border: `1px solid ${T.border}`, fontFamily: FONT_SERIF }}>🗑️ クリア</button>
                      )}
                      <button onClick={() => setAiChatOpen(false)} style={{ fontSize: 10, padding: "2px 7px", cursor: "pointer", color: T.textMuted, backgroundColor: "transparent", border: "none", fontFamily: FONT_SERIF }}>✕ 閉じる</button>
                    </div>
                  </div>
                  {/* メッセージエリア */}
                  <div style={{ maxHeight: 350, overflowY: "auto", padding: 14 }}>
                    {aiChatMessages.length === 0 && (
                      <div style={{ textAlign: "center", padding: "24px 0" }}>
                        <div style={{ fontSize: 32, marginBottom: 10 }}>🤖</div>
                        <p style={{ margin: "0 0 4px", fontSize: 12, fontWeight: 500, color: T.text, letterSpacing: "0.05em" }}>マニュアルAIアシスタント</p>
                        <p style={{ margin: 0, fontSize: 10, color: T.textMuted, letterSpacing: "0.03em" }}>マニュアルの内容について何でも聞いてね！</p>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, justifyContent: "center", marginTop: 16 }}>
                          {["掃除の手順を教えて", "精算方法は？", "シフトの出し方", "LAST勤務とは？", "お給料について"].map(q => (
                            <button key={q} onClick={() => { setAiChatInput(q); }}
                              style={{ fontSize: 10, padding: "5px 11px", cursor: "pointer", border: `1px solid ${T.accent}44`, color: T.accent, backgroundColor: "transparent", fontFamily: FONT_SERIF, letterSpacing: "0.03em" }}>{q}</button>
                          ))}
                        </div>
                      </div>
                    )}
                    {aiChatMessages.map((m, i) => (
                      <div key={i} style={{ display: "flex", marginBottom: 12, justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                        {m.role === "ai" && <div style={{ flexShrink: 0, width: 24, height: 24, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", marginRight: 8, marginTop: 2, backgroundColor: T.accentBg, fontSize: 11 }}>🤖</div>}
                        <div style={{ maxWidth: "80%" }}>
                          <div style={{
                            padding: "10px 14px",
                            fontSize: 12,
                            lineHeight: 1.8,
                            letterSpacing: "0.02em",
                            backgroundColor: m.role === "user" ? T.accent : T.cardAlt,
                            color: m.role === "user" ? "#fff" : T.text,
                            fontFamily: FONT_SERIF,
                          }}>
                            {m.role === "ai" ? renderInlineContent(m.content) : m.content}
                          </div>
                          {m.role === "ai" && m.logId && (
                            <div style={{ display: "flex", gap: 6, marginTop: 5, marginLeft: 3 }}>
                              <button onClick={async () => {
                                if (m.rating) return;
                                try {
                                  await fetch("/api/manual-ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "rate", logId: m.logId, rating: 1 }) });
                                  setAiChatMessages(prev => prev.map((msg, idx) => idx === i ? { ...msg, rating: 1 } : msg));
                                } catch {}
                              }} style={{ fontSize: 11, padding: "2px 9px", cursor: "pointer", backgroundColor: m.rating === 1 ? "rgba(107,155,126,0.15)" : "transparent", border: `1px solid ${m.rating === 1 ? "#6b9b7e" : T.border}`, color: m.rating === 1 ? "#6b9b7e" : T.textMuted, opacity: m.rating && m.rating !== 1 ? 0.3 : 1, fontFamily: FONT_SERIF }}>👍</button>
                              <button onClick={async () => {
                                if (m.rating) return;
                                try {
                                  await fetch("/api/manual-ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "rate", logId: m.logId, rating: -1 }) });
                                  setAiChatMessages(prev => prev.map((msg, idx) => idx === i ? { ...msg, rating: -1 } : msg));
                                } catch {}
                              }} style={{ fontSize: 11, padding: "2px 9px", cursor: "pointer", backgroundColor: m.rating === -1 ? "rgba(201,107,131,0.15)" : "transparent", border: `1px solid ${m.rating === -1 ? "#c96b83" : T.border}`, color: m.rating === -1 ? "#c96b83" : T.textMuted,
                                opacity: m.rating && m.rating !== -1 ? 0.3 : 1,
                              }}>👎</button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    {aiChatLoading && (
                      <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: 12 }}>
                        <div style={{ flexShrink: 0, width: 24, height: 24, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", marginRight: 8, marginTop: 2, backgroundColor: T.accentBg, fontSize: 11 }}>🤖</div>
                        <div style={{ padding: "10px 14px", fontSize: 12, display: "flex", alignItems: "center", gap: 8, backgroundColor: T.cardAlt, color: T.textMuted, fontFamily: FONT_SERIF, letterSpacing: "0.05em" }}>
                          <span style={{ display: "inline-block", animation: "pulse 1.5s ease-in-out infinite" }}>💭</span>
                          考え中...
                          <style>{`@keyframes pulse { 0%,100% { opacity: 0.4; } 50% { opacity: 1; } }`}</style>
                        </div>
                      </div>
                    )}
                  </div>
                  {/* 入力エリア */}
                  <div style={{ display: "flex", gap: 6, padding: 12, borderTop: `1px solid ${T.border}`, alignItems: "center", backgroundColor: T.cardAlt }}>
                    <input type="text" value={aiChatInput} onChange={e => setAiChatInput(e.target.value)}
                      onKeyDown={async (e) => {
                        if (e.key === "Enter" && aiChatInput.trim() && !aiChatLoading) {
                          const q = aiChatInput.trim();
                          setAiChatInput("");
                          setAiChatMessages(prev => [...prev, { role: "user", content: q }]);
                          setAiChatLoading(true);
                          const newCount = aiSessionCount + 1;
                          setAiSessionCount(newCount);
                          if (newCount > 4) {
                            setAiChatMessages(prev => [...prev, { role: "ai", content: "😊 この質問はスタッフに直接お問い合わせください！\n\n何度も質問していただきありがとうございます。より正確にお答えするため、スタッフに聞いていただく方が早いかと思います📞\n\n🗑️「クリア」で会話をリセットすると、また質問できますよ！" }]);
                            setAiChatLoading(false);
                            return;
                          }
                          try {
                            const res = await fetch("/api/manual-ai", {
                              method: "POST", headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ action: "chat", question: q, chatHistory: aiChatMessages, therapistName: therapist?.name || "" }),
                            });
                            const data = await res.json();
                            setAiChatMessages(prev => [...prev, { role: "ai", content: data.answer || "応答エラー", logId: data.logId || undefined }]);
                          } catch { setAiChatMessages(prev => [...prev, { role: "ai", content: "⚠️ 通信エラーが発生しました" }]); }
                          setAiChatLoading(false);
                        }
                      }}
                      placeholder={aiListening ? "🎤 話してください..." : "質問を入力..."}
                      style={{ flex: 1, padding: "10px 14px", fontSize: 12, outline: "none", backgroundColor: T.card, color: T.text, border: `1px solid ${aiListening ? T.accent : T.border}`, fontFamily: FONT_SERIF, letterSpacing: "0.02em" }} />
                    <button
                      onClick={() => {
                        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
                        if (!SpeechRecognition) { alert("お使いのブラウザは音声入力に対応していません"); return; }
                        if (aiListening) return;
                        const recognition = new SpeechRecognition();
                        recognition.lang = "ja-JP";
                        recognition.interimResults = false;
                        recognition.maxAlternatives = 1;
                        setAiListening(true);
                        recognition.onresult = (event: any) => {
                          const text = event.results[0][0].transcript;
                          setAiChatInput(prev => prev + text);
                          setAiListening(false);
                        };
                        recognition.onerror = () => setAiListening(false);
                        recognition.onend = () => setAiListening(false);
                        recognition.start();
                      }}
                      style={{
                        width: 36,
                        height: 36,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        flexShrink: 0,
                        backgroundColor: aiListening ? T.accent : "transparent",
                        border: `1px solid ${aiListening ? T.accent : T.border}`,
                        color: aiListening ? "#fff" : T.accent,
                        fontSize: 15,
                        animation: aiListening ? "pulse 1s ease-in-out infinite" : "none",
                      }}
                      title="音声入力">
                      🎤
                    </button>
                    <button disabled={!aiChatInput.trim() || aiChatLoading}
                      onClick={async () => {
                        const q = aiChatInput.trim();
                        if (!q) return;
                        setAiChatInput("");
                        setAiChatMessages(prev => [...prev, { role: "user", content: q }]);
                        setAiChatLoading(true);
                        const newCount = aiSessionCount + 1;
                        setAiSessionCount(newCount);
                        if (newCount > 4) {
                          setAiChatMessages(prev => [...prev, { role: "ai", content: "😊 この質問はスタッフに直接お問い合わせください！\n\n何度も質問していただきありがとうございます。より正確にお答えするため、スタッフに聞いていただく方が早いかと思います📞\n\n🗑️「クリア」で会話をリセットすると、また質問できますよ！" }]);
                          setAiChatLoading(false);
                          return;
                        }
                        try {
                          const res = await fetch("/api/manual-ai", {
                            method: "POST", headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ action: "chat", question: q, chatHistory: aiChatMessages, therapistName: therapist?.name || "" }),
                          });
                          const data = await res.json();
                          setAiChatMessages(prev => [...prev, { role: "ai", content: data.answer || "応答エラー", logId: data.logId || undefined }]);
                        } catch { setAiChatMessages(prev => [...prev, { role: "ai", content: "⚠️ 通信エラーが発生しました" }]); }
                        setAiChatLoading(false);
                      }}
                      style={{ padding: "10px 18px", fontSize: 11, color: "#fff", cursor: "pointer", backgroundColor: T.accent, border: "none", opacity: !aiChatInput.trim() || aiChatLoading ? 0.4 : 1, fontFamily: FONT_SERIF, letterSpacing: "0.15em", fontWeight: 500 }}>送信</button>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>)}

      </div></div>

      {/* ═══ ボトムナビ（4タブ・絵文字のみ・画面下部固定） ═══ */}
      <nav style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        height: 64,
        backgroundColor: T.card,
        borderTop: `1px solid ${T.border}`,
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        zIndex: 30,
        fontFamily: FONT_SERIF,
        boxShadow: "0 -1px 8px rgba(0,0,0,0.03)",
      }}>
        {(() => {
          const notifUnread = notifications.filter(n => !notifReadIds.includes(n.id)).length;
          const manualUnread = manualArticles.filter(a => a.is_published && !manualReads.includes(a.id)).length;
          const learnUnread = notifUnread + manualUnread;
          return MAIN_TABS.map((m) => {
            const active = mainTab === m.key;
            const showBadge = m.key === "learn" && learnUnread > 0;
            return (
              <button key={m.key} onClick={() => clickMain(m.key)}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 4,
                  border: "none",
                  backgroundColor: "transparent",
                  cursor: "pointer",
                  padding: "6px 4px",
                  position: "relative",
                  color: active ? T.accent : T.textMuted,
                  transition: "color 0.2s ease",
                }}>
                <span style={{ fontSize: 20, lineHeight: 1 }}>{m.emoji}</span>
                <span style={{ fontSize: 9, letterSpacing: "0.15em", fontFamily: FONT_DISPLAY, fontWeight: 500, textTransform: "uppercase" }}>{m.key}</span>
                {active && <span style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: 24, height: 2, backgroundColor: T.accent }} />}
                {showBadge && (
                  <span style={{
                    position: "absolute",
                    top: 6,
                    right: "28%",
                    fontFamily: FONT_SANS,
                    fontSize: 9,
                    fontWeight: 600,
                    minWidth: 16,
                    height: 16,
                    padding: "0 4px",
                    borderRadius: 999,
                    backgroundColor: T.accent,
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    letterSpacing: 0,
                  }}>{learnUnread > 99 ? "99+" : learnUnread}</span>
                )}
              </button>
            );
          });
        })()}
      </nav>

{/* カレンダー日付詳細モーダル */}
      {calDetailDate && (() => {
        const dShift = calShifts.find(s => s.date === calDetailDate);
        const dSettlement = calSettlements.find(s => s.date === calDetailDate);
        const dRes = calReservations.filter(r => r.date === calDetailDate);
        const dNotes = dRes.map(r => customerNotes.find(n => n.customer_name === r.customer_name)).filter(Boolean);
        const dt = new Date(calDetailDate + "T00:00:00");
        const days = ["日", "月", "火", "水", "木", "金", "土"];
        const dateLabel = `${dt.getFullYear()}年${dt.getMonth() + 1}月${dt.getDate()}日（${days[dt.getDay()]}）`;

        return (
          <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, backgroundColor: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)", fontFamily: FONT_SERIF }} onClick={() => setCalDetailDate(null)}>
            <div style={{ width: "100%", maxWidth: 460, maxHeight: "85vh", overflowY: "auto", padding: 22, backgroundColor: T.card, border: `1px solid ${T.border}` }} onClick={(e) => e.stopPropagation()}>
              {/* ヘッダー */}
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 18, paddingBottom: 14, borderBottom: `1px solid ${T.border}` }}>
                <div>
                  <p style={{ margin: 0, fontFamily: FONT_DISPLAY, fontSize: 10, letterSpacing: "0.2em", color: T.accent, fontWeight: 500 }}>DAILY DETAIL</p>
                  <h3 style={{ margin: "3px 0 0", fontSize: 15, fontWeight: 500, letterSpacing: "0.05em", color: T.text }}>📅 {dateLabel}</h3>
                </div>
                <button onClick={() => setCalDetailDate(null)} style={{ width: 28, height: 28, fontSize: 13, cursor: "pointer", backgroundColor: "transparent", border: `1px solid ${T.border}`, color: T.textMuted, fontFamily: FONT_SERIF }}>✕</button>
              </div>

              {/* 出勤情報 */}
              {dShift ? (
                <div style={{ padding: "12px 14px", marginBottom: 12, backgroundColor: T.accentBg, border: `1px solid ${T.accent}44` }}>
                  <p style={{ margin: "0 0 4px", fontFamily: FONT_DISPLAY, fontSize: 10, letterSpacing: "0.2em", color: T.accent, fontWeight: 500 }}>⏰ SHIFT</p>
                  <p style={{ margin: 0, fontFamily: FONT_SANS, fontSize: 16, fontWeight: 500, color: T.text }}>{dShift.start_time?.slice(0,5)} — {dShift.end_time?.slice(0,5)}</p>
                  {dShift.store_id > 0 && <p style={{ margin: "3px 0 0", fontSize: 11, color: T.textMuted, letterSpacing: "0.03em" }}>{getStoreName(dShift.store_id)}</p>}
                </div>
              ) : (
                <div style={{ padding: "12px 14px", marginBottom: 12, backgroundColor: T.cardAlt, border: `1px solid ${T.border}` }}>
                  <p style={{ margin: 0, fontSize: 11, color: T.textFaint, letterSpacing: "0.05em" }}>出勤予定なし</p>
                </div>
              )}

              {/* 給料明細 */}
              {dSettlement ? (
                <div style={{ padding: "12px 14px", marginBottom: 12, backgroundColor: T.card, border: `1px solid ${T.accent}44` }}>
                  <p style={{ margin: "0 0 8px", fontFamily: FONT_DISPLAY, fontSize: 10, letterSpacing: "0.2em", color: T.accent, fontWeight: 500 }}>💰 SETTLEMENT</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: 11 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", letterSpacing: "0.02em" }}><span>接客数</span><span style={{ fontFamily: FONT_SANS, fontWeight: 500 }}>{dSettlement.order_count} 件</span></div>
                    <div style={{ display: "flex", justifyContent: "space-between", letterSpacing: "0.02em" }}><span>売上合計</span><span style={{ fontFamily: FONT_SANS }}>{fmt(dSettlement.total_sales)}</span></div>
                    <div style={{ display: "flex", justifyContent: "space-between", letterSpacing: "0.02em" }}><span>バック合計</span><span style={{ fontFamily: FONT_SANS }}>{fmt(dSettlement.total_back)}</span></div>
                    {dSettlement.adjustment !== 0 && <div style={{ display: "flex", justifyContent: "space-between", color: dSettlement.adjustment > 0 ? "#6b9b7e" : "#c96b83", letterSpacing: "0.02em" }}><span>調整金{dSettlement.adjustment_note ? `（${dSettlement.adjustment_note}）` : ""}</span><span style={{ fontFamily: FONT_SANS }}>{dSettlement.adjustment > 0 ? "+" : ""}{fmt(dSettlement.adjustment)}</span></div>}
                    {dSettlement.invoice_deduction > 0 && <div style={{ display: "flex", justifyContent: "space-between", color: "#c96b83", letterSpacing: "0.02em" }}><span>インボイス控除</span><span style={{ fontFamily: FONT_SANS }}>−{fmt(dSettlement.invoice_deduction)}</span></div>}
                    {dSettlement.withholding_tax > 0 && <div style={{ display: "flex", justifyContent: "space-between", color: "#c96b83", letterSpacing: "0.02em" }}><span>源泉徴収</span><span style={{ fontFamily: FONT_SANS }}>−{fmt(dSettlement.withholding_tax)}</span></div>}
                    {dSettlement.welfare_fee > 0 && <div style={{ display: "flex", justifyContent: "space-between", color: "#c96b83", letterSpacing: "0.02em" }}><span>備品・リネン代</span><span style={{ fontFamily: FONT_SANS }}>−{fmt(dSettlement.welfare_fee)}</span></div>}
                    {dSettlement.transport_fee > 0 && <div style={{ display: "flex", justifyContent: "space-between", color: "#6b9b7e", letterSpacing: "0.02em" }}><span>交通費（実費精算）</span><span style={{ fontFamily: FONT_SANS }}>+{fmt(dSettlement.transport_fee)}</span></div>}
                    <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 8, marginTop: 4, borderTop: `1px solid ${T.accent}44`, color: T.accent }}>
                      <span style={{ fontFamily: FONT_DISPLAY, fontSize: 11, letterSpacing: "0.2em", fontWeight: 500, alignSelf: "center" }}>PAYMENT</span>
                      <span style={{ fontFamily: FONT_SANS, fontSize: 18, fontWeight: 500 }}>{fmt(dSettlement.final_payment)}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, paddingTop: 4, fontSize: 9, color: T.textMuted, letterSpacing: "0.02em", fontFamily: FONT_SANS }}>
                      <span>💴 現金 {fmt(dSettlement.total_cash)}</span>
                      {dSettlement.total_card > 0 && <span>💳 カード {fmt(dSettlement.total_card)}</span>}
                      {dSettlement.total_paypay > 0 && <span>📱 PayPay {fmt(dSettlement.total_paypay)}</span>}
                    </div>
                  </div>
                </div>
              ) : dShift && calDetailDate < today ? (
                <div style={{ padding: "12px 14px", marginBottom: 12, backgroundColor: "rgba(179,132,25,0.06)", border: `1px solid #b3841944` }}>
                  <p style={{ margin: 0, fontSize: 11, fontWeight: 500, color: "#b38419", letterSpacing: "0.05em" }}>⚠ 未清算</p>
                </div>
              ) : null}

              {/* お客様情報 */}
              {dRes.length > 0 ? (
                <div style={{ border: `1px solid ${T.border}`, overflow: "hidden", marginBottom: 12 }}>
                  <div style={{ padding: "8px 14px", backgroundColor: T.cardAlt, borderBottom: `1px solid ${T.border}` }}>
                    <p style={{ margin: 0, fontFamily: FONT_DISPLAY, fontSize: 10, letterSpacing: "0.2em", color: "#6b9b7e", fontWeight: 500 }}>👤 CUSTOMERS <span style={{ fontFamily: FONT_SANS, letterSpacing: 0, marginLeft: 4 }}>{dRes.length} 件</span></p>
                  </div>
                  {dRes.map((r, i) => {
                    const note = customerNotes.find(n => n.reservation_id === r.id) || customerNotes.find(n => n.customer_name === r.customer_name && !n.reservation_id);
                    const isNg = customerNotes.some(n => n.customer_name === r.customer_name && n.is_ng);
                    return (
                      <div key={r.id} style={{ padding: "10px 14px", borderTop: i > 0 ? `1px solid ${T.border}` : "none" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ fontSize: 12, fontWeight: 500, letterSpacing: "0.03em" }}>{r.customer_name}</span>
                            {isNg && <span style={{ fontSize: 8, padding: "1px 6px", color: "#c96b83", border: `1px solid #c96b8344`, letterSpacing: "0.03em" }}>🚫 NG</span>}
                            {note && note.rating > 0 && <span style={{ fontSize: 9, color: "#b38419" }}>{"★".repeat(note.rating)}{"☆".repeat(5 - note.rating)}</span>}
                          </div>
                          <span style={{ fontFamily: FONT_SANS, fontSize: 12, fontWeight: 500, color: T.accent }}>{fmt(r.total_price)}</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 10, color: T.textSub, letterSpacing: "0.02em" }}>
                          <span style={{ fontFamily: FONT_SANS }}>🕐 {r.start_time?.slice(0,5)} — {r.end_time?.slice(0,5)}</span>
                          <span>📋 {r.course}</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 9, color: T.textMuted, marginTop: 2, letterSpacing: "0.02em" }}>
                          {r.nomination && <span style={{ color: T.accent }}>指名: {r.nomination}（{fmt(r.nomination_fee)}）</span>}
                          {r.options_text && <span style={{ color: T.accentDeep }}>OP: {r.options_text}</span>}
                          {r.extension_name && <span style={{ color: "#8b6cb7" }}>延長: {r.extension_name}</span>}
                          {(r as any).discount_name && <span style={{ color: "#c96b83" }}>割引: {(r as any).discount_name}</span>}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 9, color: T.textMuted, marginTop: 2, letterSpacing: "0.02em", fontFamily: FONT_SANS }}>
                          {(r as any).card_billing > 0 && <span style={{ color: T.accentDeep }}>💳 {fmt((r as any).card_billing)}</span>}
                          {(r as any).paypay_amount > 0 && <span style={{ color: "#6b9b7e" }}>📱 {fmt((r as any).paypay_amount)}</span>}
                          {(r as any).cash_amount > 0 && <span>💴 {fmt((r as any).cash_amount)}</span>}
                        </div>
                        {(() => {
                          const courseBack = coursesMaster.find(c => c.name === r.course)?.therapist_back || 0;
                          const nomBack = r.nomination ? (nomsMaster.find(n => n.name === r.nomination)?.back_amount || 0) : 0;
                          const optNames = r.options_text ? r.options_text.split(",").filter(Boolean) : [];
                          const optBack = optNames.reduce((s, n) => s + (optsMaster.find(o => o.name === n)?.therapist_back || 0), 0);
                          const extBack = r.extension_name ? (extsMaster.find(e => e.name === r.extension_name)?.therapist_back || 0) : 0;
                          const totalBack = courseBack + nomBack + optBack + extBack;
                          return (
                            <div style={{ fontSize: 9, marginTop: 6, padding: "6px 10px", display: "flex", flexDirection: "column", gap: 2, backgroundColor: "rgba(107,155,126,0.06)", border: `1px solid #6b9b7e33` }}>
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                <span style={{ fontFamily: FONT_DISPLAY, fontSize: 9, letterSpacing: "0.15em", color: "#6b9b7e", fontWeight: 500 }}>💵 BACK DETAIL</span>
                                <span style={{ fontFamily: FONT_SANS, fontWeight: 500, color: "#6b9b7e" }}>合計 {fmt(totalBack)}</span>
                              </div>
                              <div style={{ display: "flex", justifyContent: "space-between", letterSpacing: "0.02em" }}><span>コース（{r.course}）</span><span style={{ fontFamily: FONT_SANS, color: "#6b9b7e" }}>{fmt(courseBack)}</span></div>
                              {r.nomination && <div style={{ display: "flex", justifyContent: "space-between", letterSpacing: "0.02em" }}><span>指名（{r.nomination}）</span><span style={{ fontFamily: FONT_SANS, color: T.accent }}>+{fmt(nomBack)}</span></div>}
                              {optNames.length > 0 && optNames.map((n, oi) => { const ob = optsMaster.find(o => o.name === n)?.therapist_back || 0; return <div key={oi} style={{ display: "flex", justifyContent: "space-between", letterSpacing: "0.02em" }}><span>OP（{n}）</span><span style={{ fontFamily: FONT_SANS, color: T.accentDeep }}>+{fmt(ob)}</span></div>; })}
                              {r.extension_name && <div style={{ display: "flex", justifyContent: "space-between", letterSpacing: "0.02em" }}><span>延長（{r.extension_name}）</span><span style={{ fontFamily: FONT_SANS, color: "#8b6cb7" }}>+{fmt(extBack)}</span></div>}
                            </div>
                          );
                        })()}
                        {note && note.note && (
                          <div style={{ marginTop: 5, padding: "5px 10px", fontSize: 9, backgroundColor: T.accentBg, color: T.accentDeep, letterSpacing: "0.02em", lineHeight: 1.7 }}>
                            📝 {note.note}
                          </div>
                        )}
                        {note?.is_ng && note.ng_reason && (
                          <div style={{ marginTop: 3, padding: "5px 10px", fontSize: 9, backgroundColor: "rgba(201,107,131,0.08)", color: "#c96b83", letterSpacing: "0.02em" }}>
                            🚫 NG理由: {note.ng_reason}
                          </div>
                        )}
                        <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                          <button onClick={(e) => { e.stopPropagation(); if (note) { setNoteForm({ customer_name: note.customer_name, note: note.note, is_ng: note.is_ng, ng_reason: note.ng_reason, rating: note.rating || 0, reservation_id: note.reservation_id || r.id }); } else { setNoteForm({ customer_name: r.customer_name, note: "", is_ng: false, ng_reason: "", rating: 0, reservation_id: r.id }); } setCalDetailDate(null); setShowAddNote(true); }}
                            style={{ padding: "3px 9px", fontSize: 9, cursor: "pointer", backgroundColor: "transparent", color: T.accent, border: `1px solid ${T.accent}`, fontFamily: FONT_SERIF, letterSpacing: "0.03em" }}>
                            {note ? "✏️ メモ編集" : "📝 メモ追加"}
                          </button>
                          {note && <button onClick={(e) => { e.stopPropagation(); deleteCustomerNote(note.id); }}
                            style={{ padding: "3px 9px", fontSize: 9, cursor: "pointer", backgroundColor: "transparent", color: "#c96b83", border: `1px solid #c96b83`, fontFamily: FONT_SERIF }}>🗑 削除</button>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : dShift ? (
                <div style={{ padding: "12px 14px", marginBottom: 12, backgroundColor: T.cardAlt, border: `1px solid ${T.border}` }}>
                  <p style={{ margin: 0, fontSize: 11, color: T.textFaint, letterSpacing: "0.05em" }}>接客情報なし</p>
                </div>
              ) : null}

              <button onClick={() => setCalDetailDate(null)}
                style={{ width: "100%", padding: 11, fontSize: 11, cursor: "pointer", border: `1px solid ${T.border}`, color: T.textSub, backgroundColor: "transparent", fontFamily: FONT_SERIF, letterSpacing: "0.1em" }}>閉じる</button>
            </div>
          </div>
        );
      })()}

      {/* お客様接客履歴モーダル */}
      {/* ── 証明書発行タブ ── */}
      {tab === "cert" && therapist && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20, fontFamily: FONT_SERIF }}>
          {/* セクション見出し */}
          <div style={{ textAlign: "center" }}>
            <p style={{ fontFamily: FONT_DISPLAY, fontSize: 11, letterSpacing: "0.25em", color: T.accent, marginBottom: 6, fontWeight: 500 }}>CERTIFICATE</p>
            <p style={{ fontFamily: FONT_SERIF, fontSize: 15, letterSpacing: "0.08em", color: T.text, fontWeight: 500, marginBottom: 10 }}>📄 証明書発行</p>
            <div style={{ width: 30, height: 1, backgroundColor: T.accent, margin: "0 auto" }} />
          </div>
          <p style={{ margin: 0, fontSize: 11, color: T.textMuted, textAlign: "center", lineHeight: 1.9, letterSpacing: "0.03em" }}>お店が公式に発行する証明書です。<br />以下の書類を PDF で即座に発行できます。</p>

          {/* 証明書カード */}
          {[
            { icon: "📝", title: "業務委託契約証明書", sub: "CONTRACT", jpSub: "在籍証明", color: T.accent, type: "contract" as const,
              uses: ["🏠 賃貸マンション・アパートの契約", "👶 保育園・学童の就労証明", "💳 クレジットカードの申込", "📱 携帯電話の分割払い契約"],
              merit: "「どこで働いているか」を証明する書類です。フリーランスは会社員と違って在籍証明が取りにくいですが、この証明書があれば賃貸審査もスムーズに通ります。" },
            { icon: "💰", title: "報酬支払証明書", sub: "PAYMENT", jpSub: "収入証明", color: "#6b8ba8", type: "payment" as const,
              uses: ["🏦 住宅ローン・カーローンの審査", "💳 クレジットカードの限度額アップ", "🏥 児童手当・医療費助成の申請", "📋 奨学金の保護者収入証明"],
              merit: "「年間いくら稼いでいるか」を月別内訳つきで証明します。収入が安定していることを金融機関に示せるので、ローン審査の通過率が上がります。" },
            { icon: "📊", title: "取引実績証明書", sub: "TRANSACTION", jpSub: "実績証明", color: "#b38419", type: "transaction" as const,
              uses: ["📑 確定申告の補助資料", "🏦 事業融資・小規模企業共済の申請", "💰 補助金・助成金の申請", "📋 開業届・青色申告の添付資料"],
              merit: "「どれだけ継続的に仕事をしているか」を証明します。月平均取引額や取引月数が記載されるので、安定した事業実績のアピールに使えます。" },
          ].map((cert, i) => (
            <div key={i} style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}>
              {/* ヘッダー */}
              <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 18px", borderBottom: `1px solid ${T.border}` }}>
                <span style={{ fontSize: 22 }}>{cert.icon}</span>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontFamily: FONT_DISPLAY, fontSize: 10, letterSpacing: "0.2em", color: cert.color, fontWeight: 500 }}>{cert.sub}</p>
                  <p style={{ margin: "2px 0 0", fontSize: 14, fontWeight: 500, letterSpacing: "0.03em", color: T.text }}>{cert.title}</p>
                </div>
                <span style={{ fontSize: 10, padding: "3px 10px", border: `1px solid ${cert.color}44`, color: cert.color, letterSpacing: "0.05em" }}>{cert.jpSub}</span>
              </div>
              <div style={{ padding: "16px 18px" }}>
                <p style={{ margin: "0 0 14px", fontSize: 11, color: T.textSub, lineHeight: 1.9, letterSpacing: "0.02em" }}>{cert.merit}</p>
                <p style={{ margin: "0 0 8px", fontFamily: FONT_DISPLAY, fontSize: 9, letterSpacing: "0.2em", color: T.textMuted, fontWeight: 500 }}>USE CASES — こんな時に使えます</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "3px 8px", marginBottom: 14 }}>
                  {cert.uses.map((u, j) => <p key={j} style={{ margin: 0, fontSize: 10, color: T.textMuted, letterSpacing: "0.02em" }}>{u}</p>)}
                </div>
                {certEligible ? (
                  <button onClick={async () => {
                    if (!storeInfo || !therapist) return;
                    const store = { company_name: storeInfo.company_name || "", company_address: storeInfo.company_address || "", company_phone: storeInfo.company_phone || "" };
                    const th = { real_name: (therapist as any).real_name || therapist.name, name: therapist.name, address: (therapist as any).address || "", entry_date: (therapist as any).entry_date || "" };
                    if (cert.type === "contract") { generateContractCertificate(store, th); return; }
                    const yr = new Date().getFullYear();
                    const { data: sett } = await supabase.from("therapist_daily_settlements").select("date, total_back").eq("therapist_id", therapist.id).gte("date", `${yr}-01-01`).lte("date", `${yr}-12-31`);
                    const months: { month: number; amount: number; days: number }[] = [];
                    for (let m = 1; m <= 12; m++) { const ms = (sett || []).filter((s: any) => new Date(s.date).getMonth() + 1 === m); months.push({ month: m, amount: ms.reduce((a: number, s: any) => a + (s.total_back || 0), 0), days: ms.length }); }
                    const payment = { year: yr, totalGross: months.reduce((a, m) => a + m.amount, 0), totalDays: months.reduce((a, m) => a + m.days, 0), months };
                    if (cert.type === "payment") generatePaymentCertificate(store, th, payment);
                    else generateTransactionCertificate(store, th, payment);
                  }} style={{ width: "100%", padding: 12, fontSize: 12, cursor: "pointer", backgroundColor: cert.color, color: "#fff", border: "none", fontFamily: FONT_SERIF, letterSpacing: "0.1em", fontWeight: 500 }}>
                    {cert.icon} この証明書を発行する
                  </button>
                ) : (
                  <div style={{ width: "100%", padding: 12, fontSize: 11, textAlign: "center", color: T.textMuted, border: `1px dashed ${T.border}`, backgroundColor: T.cardAlt, fontFamily: FONT_SERIF, letterSpacing: "0.05em", boxSizing: "border-box" }}>
                    発行条件を満たすと発行できます ↓
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* 発行条件 */}
          <div style={{ backgroundColor: T.card, border: `1px solid ${T.border}`, padding: "18px 18px" }}>
            <p style={{ margin: "0 0 4px", fontFamily: FONT_DISPLAY, fontSize: 10, letterSpacing: "0.2em", color: T.accent, fontWeight: 500 }}>REQUIREMENTS</p>
            <p style={{ margin: "0 0 14px", fontSize: 13, fontWeight: 500, letterSpacing: "0.05em", color: T.text }}>✅ 発行条件</p>
            <p style={{ margin: "0 0 14px", fontSize: 10, color: T.textMuted, lineHeight: 1.8, letterSpacing: "0.02em" }}>以下の条件をすべて満たすと、証明書を自分で発行できるようになります。</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {certChecks.map((c, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", backgroundColor: c.ok ? "rgba(107,155,126,0.05)" : "rgba(201,107,131,0.04)", border: `1px solid ${c.ok ? "#6b9b7e33" : "#c96b8333"}` }}>
                  <span style={{ fontSize: 16 }}>{c.ok ? "✅" : "⬜"}</span>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontSize: 11, fontWeight: 500, letterSpacing: "0.03em", color: c.ok ? "#6b9b7e" : T.text }}>{c.label}</p>
                    {!c.ok && i === 0 && <p style={{ margin: "3px 0 0", fontSize: 10, color: "#c96b83", letterSpacing: "0.02em" }}>身分証はスタッフに提出してください</p>}
                    {!c.ok && i === 1 && <p style={{ margin: "3px 0 0", fontSize: 10, color: "#c96b83", letterSpacing: "0.02em" }}>契約書のリンクをスタッフからもらってください</p>}
                    {!c.ok && i === 2 && <p style={{ margin: "3px 0 0", fontSize: 10, color: "#c96b83", letterSpacing: "0.02em" }}>スタッフに本名を伝えてください</p>}
                    {!c.ok && i === 3 && <p style={{ margin: "3px 0 0", fontSize: 10, color: "#c96b83", letterSpacing: "0.02em" }}>スタッフに住所を伝えてください</p>}
                    {!c.ok && i === 4 && <p style={{ margin: "3px 0 0", fontSize: 10, color: "#c96b83", letterSpacing: "0.02em" }}>出勤を重ねると条件を達成できます</p>}
                  </div>
                </div>
              ))}
            </div>
            {certEligible && (
              <div style={{ marginTop: 14, padding: "12px 14px", textAlign: "center", backgroundColor: "rgba(107,155,126,0.08)", border: `1px solid #6b9b7e44` }}>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 500, color: "#6b9b7e", letterSpacing: "0.05em" }}>🎉 すべての条件を満たしています！上の証明書を発行できます。</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── 確定申告サポートタブ ── */}
      {tab === "tax" && therapist && (
        <div style={{ display: "flex", flexDirection: "column", gap: 18, fontFamily: FONT_SERIF }}>
          {/* セクション見出し */}
          <div style={{ textAlign: "center" }}>
            <p style={{ fontFamily: FONT_DISPLAY, fontSize: 11, letterSpacing: "0.25em", color: T.accent, marginBottom: 6, fontWeight: 500 }}>TAX FILING</p>
            <p style={{ fontFamily: FONT_SERIF, fontSize: 15, letterSpacing: "0.08em", color: T.text, fontWeight: 500, marginBottom: 10 }}>📊 確定申告サポート</p>
            <div style={{ width: 30, height: 1, backgroundColor: T.accent, margin: "0 auto" }} />
          </div>

          {/* 2タブ切替 */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", border: `1px solid ${T.border}` }}>
            <button onClick={() => setTaxSubTab("support")}
              style={{ padding: 11, fontSize: 12, cursor: "pointer", backgroundColor: taxSubTab === "support" ? T.accent : "transparent", color: taxSubTab === "support" ? "#fff" : T.textSub, border: "none", fontFamily: FONT_SERIF, letterSpacing: "0.08em", fontWeight: taxSubTab === "support" ? 500 : 400, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <span>📊</span><span>申告サポート</span>
            </button>
            <button onClick={() => setTaxSubTab("ledger")}
              style={{ padding: 11, fontSize: 12, cursor: "pointer", backgroundColor: taxSubTab === "ledger" ? "#6b9b7e" : "transparent", color: taxSubTab === "ledger" ? "#fff" : T.textSub, border: "none", borderLeft: `1px solid ${T.border}`, fontFamily: FONT_SERIF, letterSpacing: "0.08em", fontWeight: taxSubTab === "ledger" ? 500 : 400, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <span>📒</span><span>帳簿・経費管理</span>
            </button>
          </div>

          {taxSubTab === "support" && <TaxSupportWizard T={T} therapistId={therapist.id} onGoToLedger={() => setTaxSubTab("ledger")} />}
          {taxSubTab === "ledger" && <TaxBookkeeping T={T} therapistId={therapist.id} />}
        </div>
      )}

      {/* お客様接客履歴モーダル */}
      {noteHistoryCustomer && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, backgroundColor: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)", fontFamily: FONT_SERIF }} onClick={() => setNoteHistoryCustomer("")}>
          <div style={{ width: "100%", maxWidth: 420, maxHeight: "85vh", backgroundColor: T.card, border: `1px solid ${T.border}`, display: "flex", flexDirection: "column", overflow: "hidden" }} onClick={(e) => e.stopPropagation()}>
            {/* ヘッダー */}
            <div style={{ padding: "16px 20px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", borderBottom: `1px solid ${T.border}` }}>
              <div>
                <p style={{ margin: 0, fontFamily: FONT_DISPLAY, fontSize: 10, letterSpacing: "0.2em", color: T.accent, fontWeight: 500 }}>CUSTOMER</p>
                <h3 style={{ margin: "3px 0 0", fontSize: 15, fontWeight: 500, letterSpacing: "0.05em", color: T.text }}>{noteHistoryCustomer}</h3>
                <p style={{ margin: "3px 0 0", fontSize: 10, color: T.textFaint, letterSpacing: "0.03em" }}>接客を選んでメモを追加できます</p>
              </div>
              <button onClick={() => setNoteHistoryCustomer("")} style={{ width: 28, height: 28, fontSize: 13, cursor: "pointer", backgroundColor: "transparent", border: `1px solid ${T.border}`, color: T.textMuted, fontFamily: FONT_SERIF }}>✕</button>
            </div>
            {/* NG管理エリア */}
            {(() => {
              const isNg = customerNotes.some(n => n.customer_name === noteHistoryCustomer && n.is_ng);
              return (
                <div style={{ padding: "10px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${T.border}`, backgroundColor: isNg ? "rgba(201,107,131,0.05)" : "transparent" }}>
                  <div>
                    {isNg && <span style={{ fontSize: 10, padding: "3px 9px", color: "#c96b83", border: `1px solid #c96b8344`, letterSpacing: "0.05em" }}>🚫 NG登録済み</span>}
                  </div>
                  <button onClick={() => {
                    const ngNote = customerNotes.find(n => n.customer_name === noteHistoryCustomer && !n.reservation_id);
                    setNoteForm({ customer_name: noteHistoryCustomer, note: ngNote?.note || "", is_ng: ngNote?.is_ng || false, ng_reason: ngNote?.ng_reason || "", rating: ngNote?.rating || 0, reservation_id: 0 });
                    setNoteHistoryCustomer(""); setShowAddNote(true);
                  }} style={{ fontSize: 10, padding: "5px 11px", cursor: "pointer", border: `1px solid ${isNg ? "#c96b83" : T.border}`, color: isNg ? "#c96b83" : T.textSub, backgroundColor: "transparent", fontFamily: FONT_SERIF, letterSpacing: "0.05em" }}>
                    {isNg ? "🚫 NG編集" : "⚙️ NG管理"}
                  </button>
                </div>
              );
            })()}
            {/* スクロール領域 */}
            <div style={{ overflowY: "auto", flex: 1, padding: "14px 20px" }}>
              {/* 旧形式メモ */}
              {(() => {
                const generalNotes = customerNotes.filter(n => n.customer_name === noteHistoryCustomer && !n.reservation_id && n.note);
                return generalNotes.length > 0 ? (
                  <div style={{ marginBottom: 16 }}>
                    <p style={{ margin: "0 0 8px", fontFamily: FONT_DISPLAY, fontSize: 10, letterSpacing: "0.2em", color: T.accent, fontWeight: 500 }}>📝 PAST MEMO — 過去のメモ</p>
                    {generalNotes.map(n => (
                      <div key={n.id} style={{ backgroundColor: T.accentBg, border: `1px solid ${T.accent}33`, padding: "10px 12px", marginBottom: 6 }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
                          <div>{n.rating > 0 && <span style={{ fontSize: 10, color: "#b38419", letterSpacing: "0.05em" }}>{"★".repeat(n.rating)}{"☆".repeat(5 - n.rating)}</span>}</div>
                          <div style={{ display: "flex", gap: 6 }}>
                            <button onClick={() => { setNoteForm({ customer_name: n.customer_name, note: n.note, is_ng: n.is_ng, ng_reason: n.ng_reason, rating: n.rating || 0, reservation_id: 0 }); setNoteHistoryCustomer(""); setShowAddNote(true); }} style={{ fontSize: 9, padding: "3px 8px", cursor: "pointer", border: `1px solid ${T.accent}`, color: T.accent, backgroundColor: "transparent", fontFamily: FONT_SERIF, letterSpacing: "0.03em" }}>✏️ 編集</button>
                            <button onClick={async () => { const ok = await confirm({ title: "このメモを削除しますか？", variant: "danger", confirmLabel: "削除する" }); if (ok) { await supabase.from("therapist_customer_notes").delete().eq("id", n.id); await fetchData(); } }} style={{ fontSize: 9, padding: "3px 8px", cursor: "pointer", border: `1px solid #c96b83`, color: "#c96b83", backgroundColor: "transparent", fontFamily: FONT_SERIF }}>🗑</button>
                          </div>
                        </div>
                        <p style={{ margin: 0, fontSize: 11, whiteSpace: "pre-wrap", lineHeight: 1.7, color: T.textSub, letterSpacing: "0.02em" }}>{n.note}</p>
                      </div>
                    ))}
                  </div>
                ) : null;
              })()}
              <p style={{ margin: "0 0 8px", fontFamily: FONT_DISPLAY, fontSize: 10, letterSpacing: "0.2em", color: T.textMuted, fontWeight: 500 }}>HISTORY — 接客履歴</p>
              {(() => {
                const hist = allReservations.filter(r => r.customer_name === noteHistoryCustomer);
                if (hist.length === 0) return <p style={{ fontSize: 11, textAlign: "center", padding: "32px 0", color: T.textFaint, margin: 0 }}>接客履歴がありません</p>;
                return hist.map(r => {
                  const dateStr = (() => { const dt = new Date(r.date + "T00:00:00"); const days = ["日","月","火","水","木","金","土"]; return `${dt.getMonth()+1}/${dt.getDate()}(${days[dt.getDay()]})`; })();
                  const resNote = customerNotes.find(n => n.reservation_id === r.id);
                  return (
                    <div key={r.id} style={{ border: `1px solid ${resNote ? T.accent + "44" : T.border}`, backgroundColor: resNote ? T.accentBg : T.cardAlt, padding: "10px 12px", marginBottom: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ fontFamily: FONT_SERIF, fontSize: 12, fontWeight: 500, letterSpacing: "0.03em" }}>{dateStr}</span>
                        <span style={{ fontFamily: FONT_SANS, fontSize: 10, color: T.textMuted }}>{r.start_time?.slice(0,5)} — {r.end_time?.slice(0,5)}</span>
                      </div>
                      <p style={{ margin: 0, fontSize: 10, color: T.textSub, letterSpacing: "0.02em" }}>{r.course}{r.nomination ? ` ⭐${r.nomination}` : ""}</p>
                      {resNote ? (
                        <div style={{ marginTop: 8, padding: "8px 10px", backgroundColor: T.card, border: `1px solid ${T.accent}33` }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span style={{ fontSize: 9, fontWeight: 500, color: T.accent, letterSpacing: "0.08em", fontFamily: FONT_DISPLAY }}>📝 MEMO</span>
                              {resNote.rating > 0 && <span style={{ fontSize: 10, color: "#b38419" }}>{"★".repeat(resNote.rating)}{"☆".repeat(5 - resNote.rating)}</span>}
                            </div>
                            <div style={{ display: "flex", gap: 6 }}>
                              <button onClick={() => { setNoteForm({ customer_name: resNote.customer_name, note: resNote.note, is_ng: resNote.is_ng, ng_reason: resNote.ng_reason, rating: resNote.rating || 0, reservation_id: r.id }); setNoteHistoryCustomer(""); setShowAddNote(true); }} style={{ fontSize: 9, padding: "2px 7px", cursor: "pointer", border: `1px solid ${T.accent}`, color: T.accent, backgroundColor: "transparent", fontFamily: FONT_SERIF }}>✏️</button>
                              <button onClick={async () => { const ok = await confirm({ title: "このメモを削除しますか？", variant: "danger", confirmLabel: "削除する" }); if (ok) { await supabase.from("therapist_customer_notes").delete().eq("id", resNote.id); await fetchData(); } }} style={{ fontSize: 9, padding: "2px 7px", cursor: "pointer", border: `1px solid #c96b83`, color: "#c96b83", backgroundColor: "transparent", fontFamily: FONT_SERIF }}>🗑</button>
                            </div>
                          </div>
                          {resNote.note && <p style={{ margin: 0, fontSize: 10, whiteSpace: "pre-wrap", lineHeight: 1.7, color: T.textSub, letterSpacing: "0.02em" }}>{resNote.note}</p>}
                        </div>
                      ) : (
                        <button onClick={() => {
                          setNoteForm({ customer_name: noteHistoryCustomer, note: "", is_ng: false, ng_reason: "", rating: 0, reservation_id: r.id });
                          setNoteHistoryCustomer(""); setShowAddNote(true);
                        }} style={{ marginTop: 8, width: "100%", padding: "7px", fontSize: 10, cursor: "pointer", border: `1px solid ${T.accent}`, color: T.accent, backgroundColor: "transparent", fontFamily: FONT_SERIF, letterSpacing: "0.05em", fontWeight: 500 }}>
                          📝 メモを追加
                        </button>
                      )}
                    </div>
                  );
                });
              })()}
            </div>
            <div style={{ padding: "12px 20px", borderTop: `1px solid ${T.border}` }}>
              <button onClick={() => setNoteHistoryCustomer("")} style={{ width: "100%", padding: 10, fontSize: 11, cursor: "pointer", border: `1px solid ${T.border}`, color: T.textSub, backgroundColor: "transparent", fontFamily: FONT_SERIF, letterSpacing: "0.1em" }}>閉じる</button>
            </div>
          </div>
        </div>
      )}

      {/* メモ閲覧モーダル */}
      {noteViewTarget && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, backgroundColor: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)", fontFamily: FONT_SERIF }} onClick={() => setNoteViewTarget(null)}>
          <div style={{ width: "100%", maxWidth: 380, padding: 24, backgroundColor: T.card, border: `1px solid ${T.border}` }} onClick={(e) => e.stopPropagation()}>
            <div style={{ marginBottom: 14, paddingBottom: 12, borderBottom: `1px solid ${T.border}` }}>
              <p style={{ margin: 0, fontFamily: FONT_DISPLAY, fontSize: 10, letterSpacing: "0.2em", color: T.accent, fontWeight: 500 }}>CUSTOMER MEMO</p>
              <h3 style={{ margin: "3px 0 0", fontSize: 15, fontWeight: 500, letterSpacing: "0.05em", color: T.text }}>{noteViewTarget.customer_name}</h3>
              {noteViewTarget.is_ng && <p style={{ margin: "6px 0 0", fontSize: 10, color: "#c96b83", letterSpacing: "0.05em" }}>🚫 NG登録済み{noteViewTarget.ng_reason ? `（${noteViewTarget.ng_reason}）` : ""}</p>}
              {noteViewTarget.rating > 0 && <p style={{ margin: "4px 0 0", fontSize: 12, color: "#b38419" }}>{"★".repeat(noteViewTarget.rating)}{"☆".repeat(5 - noteViewTarget.rating)} <span style={{ fontFamily: FONT_SANS, fontSize: 10, marginLeft: 4 }}>{noteViewTarget.rating}/5</span></p>}
            </div>
            <div style={{ backgroundColor: T.cardAlt, border: `1px solid ${T.border}`, padding: "12px 14px", marginBottom: 14 }}>
              <p style={{ margin: "0 0 6px", fontFamily: FONT_DISPLAY, fontSize: 10, letterSpacing: "0.2em", color: T.textMuted, fontWeight: 500 }}>NOTE</p>
              <p style={{ margin: 0, fontSize: 12, whiteSpace: "pre-wrap", lineHeight: 1.8, letterSpacing: "0.02em" }}>{noteViewTarget.note || "メモなし"}</p>
            </div>
            {(() => {
              const hist = allReservations.filter(r => r.customer_name === noteViewTarget.customer_name).slice(0, 10);
              if (hist.length === 0) return null;
              return (
                <div style={{ backgroundColor: T.cardAlt, border: `1px solid ${T.border}`, padding: "12px 14px", marginBottom: 14 }}>
                  <p style={{ margin: "0 0 6px", fontFamily: FONT_DISPLAY, fontSize: 10, letterSpacing: "0.2em", color: T.textMuted, fontWeight: 500 }}>HISTORY <span style={{ fontFamily: FONT_SANS, letterSpacing: 0, marginLeft: 4 }}>直近 {hist.length} 件</span></p>
                  {hist.map(r => (
                    <div key={r.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "5px 0", fontSize: 10, borderBottom: `1px solid ${T.border}` }}>
                      <span style={{ fontFamily: FONT_SANS }}>{formatDate(r.date)} {r.start_time?.slice(0,5)}</span>
                      <span style={{ color: T.textSub, letterSpacing: "0.02em" }}>{r.course}</span>
                    </div>
                  ))}
                </div>
              );
            })()}
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => { setNoteForm({ customer_name: noteViewTarget.customer_name, note: noteViewTarget.note, is_ng: noteViewTarget.is_ng, ng_reason: noteViewTarget.ng_reason, rating: noteViewTarget.rating || 0, reservation_id: noteViewTarget.reservation_id || 0 }); setNoteViewTarget(null); setShowAddNote(true); }} style={{ flex: 1, padding: 11, fontSize: 12, cursor: "pointer", backgroundColor: T.accent, color: "#fff", border: "none", fontFamily: FONT_SERIF, letterSpacing: "0.1em", fontWeight: 500 }}>✏️ メモ編集</button>
              <button onClick={() => setNoteViewTarget(null)} style={{ padding: "11px 20px", fontSize: 11, cursor: "pointer", border: `1px solid ${T.border}`, color: T.textSub, backgroundColor: "transparent", fontFamily: FONT_SERIF, letterSpacing: "0.08em" }}>閉じる</button>
            </div>
          </div>
        </div>
      )}

      {/* メモ追加・編集モーダル */}
      {showAddNote && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, backgroundColor: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)", fontFamily: FONT_SERIF }} onClick={() => setShowAddNote(false)}>
          <div style={{ width: "100%", maxWidth: 400, padding: 24, backgroundColor: T.card, border: `1px solid ${T.border}`, maxHeight: "90vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ marginBottom: 18, paddingBottom: 14, borderBottom: `1px solid ${T.border}`, textAlign: "center" }}>
              <p style={{ margin: 0, fontFamily: FONT_DISPLAY, fontSize: 10, letterSpacing: "0.25em", color: T.accent, fontWeight: 500 }}>MEMO</p>
              <h3 style={{ margin: "4px 0 6px", fontSize: 14, fontWeight: 500, letterSpacing: "0.08em", color: T.text }}>📝 お客様メモ</h3>
              <div style={{ width: 24, height: 1, backgroundColor: T.accent, margin: "0 auto" }} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 10, letterSpacing: "0.1em", color: T.textSub, marginBottom: 6 }}>お客様名</label>
                <input type="text" value={noteForm.customer_name} onChange={(e) => setNoteForm({ ...noteForm, customer_name: e.target.value })} readOnly={!!customerNotes.find(n => n.customer_name === noteForm.customer_name)} placeholder="お客様名" style={{ width: "100%", padding: "11px 14px", fontSize: 12, outline: "none", backgroundColor: T.cardAlt, color: T.text, border: `1px solid ${T.border}`, fontFamily: FONT_SERIF, boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 10, letterSpacing: "0.1em", color: T.textSub, marginBottom: 6 }}>メモ</label>
                <textarea value={noteForm.note} onChange={(e) => setNoteForm({ ...noteForm, note: e.target.value })} placeholder="お客様についてのメモ" rows={4} style={{ width: "100%", padding: "11px 14px", fontSize: 12, outline: "none", resize: "vertical", backgroundColor: T.cardAlt, color: T.text, border: `1px solid ${T.border}`, fontFamily: FONT_SERIF, boxSizing: "border-box", lineHeight: 1.7 }} />
              </div>
              <div>
                <button onClick={() => { const now = new Date(); const ds = `${now.getMonth()+1}/${now.getDate()} ${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`; setNoteForm({ ...noteForm, note: noteForm.note + (noteForm.note ? "\n" : "") + `[${ds}] ` }); }}
                  style={{ padding: "6px 12px", fontSize: 10, cursor: "pointer", border: `1px solid ${T.accent}`, color: T.accent, backgroundColor: "transparent", fontFamily: FONT_SERIF, letterSpacing: "0.05em" }}>📅 日時挿入</button>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 10, letterSpacing: "0.1em", color: T.textSub, marginBottom: 6 }}>お客様評価</label>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  {[1, 2, 3, 4, 5].map(s => (
                    <button key={s} onClick={() => setNoteForm({ ...noteForm, rating: noteForm.rating === s ? 0 : s })}
                      style={{ fontSize: 22, cursor: "pointer", background: "none", border: "none", padding: 0, color: s <= noteForm.rating ? "#b38419" : T.textFaint }}>
                      {s <= noteForm.rating ? "★" : "☆"}
                    </button>
                  ))}
                  {noteForm.rating > 0 && <span style={{ fontFamily: FONT_SANS, fontSize: 11, marginLeft: 6, color: "#b38419" }}>{noteForm.rating}/5</span>}
                </div>
              </div>
              <div>
                <button onClick={() => setNoteForm({ ...noteForm, is_ng: !noteForm.is_ng })}
                  style={{ padding: "9px 16px", fontSize: 11, cursor: "pointer", border: `1px solid ${noteForm.is_ng ? "#c96b83" : T.border}`, color: noteForm.is_ng ? "#c96b83" : T.textSub, backgroundColor: noteForm.is_ng ? "rgba(201,107,131,0.08)" : "transparent", fontFamily: FONT_SERIF, letterSpacing: "0.05em", fontWeight: noteForm.is_ng ? 500 : 400 }}>
                  {noteForm.is_ng ? "🚫 NG登録あり" : "NG登録なし"}
                </button>
              </div>
              {noteForm.is_ng && (
                <div>
                  <label style={{ display: "block", fontSize: 10, letterSpacing: "0.1em", color: T.textSub, marginBottom: 6 }}>NG理由</label>
                  <input type="text" value={noteForm.ng_reason} onChange={(e) => setNoteForm({ ...noteForm, ng_reason: e.target.value })} placeholder="理由を入力" style={{ width: "100%", padding: "11px 14px", fontSize: 12, outline: "none", backgroundColor: T.cardAlt, color: T.text, border: `1px solid ${T.border}`, fontFamily: FONT_SERIF, boxSizing: "border-box" }} />
                </div>
              )}
              <div style={{ display: "flex", gap: 8, paddingTop: 4 }}>
                <button onClick={saveCustomerNote} style={{ flex: 1, padding: 12, fontSize: 12, cursor: "pointer", backgroundColor: T.accent, color: "#fff", border: "none", fontFamily: FONT_SERIF, letterSpacing: "0.15em", fontWeight: 500 }}>保存</button>
                <button onClick={() => setShowAddNote(false)} style={{ padding: "12px 24px", fontSize: 11, cursor: "pointer", border: `1px solid ${T.border}`, color: T.textSub, backgroundColor: "transparent", fontFamily: FONT_SERIF, letterSpacing: "0.1em" }}>キャンセル</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════
          🤖 グローバルAIチャット（全タブ共通・ドラッグ可能）
          ═══════════════════════════════════════════ */}
      {loggedIn && therapist && (() => {
        const chatApiUrl = tab === "tax" ? "/api/tax-ai" : "/api/manual-ai";
        const chatAction = tab === "tax" ? undefined : "chat";
        const chatTitle = tab === "tax" ? "確定申告AIアシスタント" : tab === "manual" ? "マニュアルAIアシスタント" : "AIアシスタント";
        const chatHint = tab === "tax" ? "税金・経費・申告のこと" : tab === "manual" ? "マニュアル・業務のこと" : "お仕事のことなんでも";
        const suggestions = tab === "tax"
          ? ["経費にできるものは？", "青色申告って何？", "副業バレしない方法は？", "還付金って何？"]
          : tab === "manual"
          ? ["出勤の流れを教えて", "精算の仕方は？", "お客様対応のコツは？", "清掃の手順は？"]
          : ["シフトの出し方は？", "給料の計算方法は？", "お客様メモの使い方は？", "マニュアルはどこ？"];

        const btnX = chatBtnPos.x >= 0 ? chatBtnPos.x : (typeof window !== "undefined" ? window.innerWidth - 80 : 300);
        const btnY = chatBtnPos.y >= 0 ? chatBtnPos.y : (typeof window !== "undefined" ? window.innerHeight - 140 : 500);

        const handleDragStart = (clientX: number, clientY: number) => {
          chatDragRef.current = { dragging: true, startX: clientX, startY: clientY, origX: btnX, origY: btnY };
        };
        const handleDragMove = (clientX: number, clientY: number) => {
          if (!chatDragRef.current.dragging) return;
          const dx = clientX - chatDragRef.current.startX;
          const dy = clientY - chatDragRef.current.startY;
          setChatBtnPos({ x: chatDragRef.current.origX + dx, y: chatDragRef.current.origY + dy });
        };
        const handleDragEnd = () => { chatDragRef.current.dragging = false; };

        const sendMsg = async () => {
          if (!aiChatInputG.trim() || aiChatLoadingG) return;
          const q = aiChatInputG.trim(); setAiChatInputG(""); setAiChatLoadingG(true);
          setAiChatMsgsG(prev => [...prev, { role: "user", text: q }]);
          try {
            const body = chatAction ? { action: chatAction, question: q, therapistName: therapist?.name } : { question: q };
            const res = await fetch(chatApiUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
            const data = await res.json();
            setAiChatMsgsG(prev => [...prev, { role: "ai", text: data.answer || data.error || "エラー", cached: data.cached }]);
          } catch { setAiChatMsgsG(prev => [...prev, { role: "ai", text: "⚠️ 通信エラー" }]); }
          setAiChatLoadingG(false);
        };

        return (<>
          {/* フローティングボタン（ドラッグ可能） */}
          <div style={{ position: "fixed", left: btnX, top: btnY, zIndex: 45, touchAction: "none" }}
            onMouseDown={e => handleDragStart(e.clientX, e.clientY)}
            onMouseMove={e => handleDragMove(e.clientX, e.clientY)}
            onMouseUp={handleDragEnd} onMouseLeave={handleDragEnd}
            onTouchStart={e => { const t = e.touches[0]; handleDragStart(t.clientX, t.clientY); }}
            onTouchMove={e => { const t = e.touches[0]; handleDragMove(t.clientX, t.clientY); }}
            onTouchEnd={handleDragEnd}>
            <button onClick={() => { if (!chatDragRef.current.dragging || (Math.abs(chatDragRef.current.startX - chatBtnPos.x) < 5)) setAiChatOpenG(!aiChatOpenG); }}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 18px", cursor: "pointer", backgroundColor: T.accent, boxShadow: "0 4px 18px rgba(201,107,131,0.35)", border: "none", color: "#fff", fontFamily: FONT_SERIF, letterSpacing: "0.1em", fontWeight: 500 }}>
              <span style={{ fontSize: 15 }}>{aiChatOpenG ? "✕" : "🤖"}</span>
              <span style={{ fontSize: 11 }}>{aiChatOpenG ? "閉じる" : "AI Chat"}</span>
            </button>
          </div>

          {/* チャットウィンドウ */}
          {aiChatOpenG && (
            <div style={{ position: "fixed", bottom: 16, right: 16, width: "calc(100% - 32px)", maxWidth: 380, overflow: "hidden", zIndex: 40, display: "flex", flexDirection: "column", backgroundColor: T.card, border: `1px solid ${T.accent}`, boxShadow: "0 12px 40px rgba(0,0,0,0.18)", maxHeight: "65vh", fontFamily: FONT_SERIF }}>
              {/* ヘッダー */}
              <div style={{ padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", backgroundColor: T.accentBg, borderBottom: `1px solid ${T.border}` }}>
                <div>
                  <p style={{ margin: 0, fontFamily: FONT_DISPLAY, fontSize: 10, letterSpacing: "0.25em", color: T.accent, fontWeight: 500 }}>AI ASSISTANT</p>
                  <p style={{ margin: "3px 0 0", fontSize: 12, fontWeight: 500, color: T.text, letterSpacing: "0.05em" }}>🤖 {chatTitle}</p>
                  <p style={{ margin: "2px 0 0", fontSize: 9, color: T.textMuted, letterSpacing: "0.03em" }}>{chatHint}なんでも聞いてね</p>
                </div>
                <button onClick={() => setAiChatOpenG(false)} style={{ width: 28, height: 28, fontSize: 14, cursor: "pointer", backgroundColor: "transparent", color: T.accent, border: `1px solid ${T.accent}`, fontFamily: FONT_SERIF }}>✕</button>
              </div>

              {/* メッセージエリア */}
              <div style={{ flex: 1, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 8, minHeight: 200, maxHeight: "45vh" }}>
                {aiChatMsgsG.length === 0 && (
                  <div style={{ textAlign: "center", padding: "12px 0" }}>
                    <p style={{ fontSize: 24, margin: "0 0 8px" }}>🌸</p>
                    <p style={{ margin: 0, fontSize: 11, color: T.textSub, letterSpacing: "0.03em", lineHeight: 1.7 }}>{chatHint}<br />なんでも聞いてください！</p>
                    <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 5 }}>
                      {suggestions.map((q, i) => (
                        <button key={i} onClick={() => setAiChatInputG(q)}
                          style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 12px", fontSize: 10, cursor: "pointer", backgroundColor: "transparent", color: T.accent, border: `1px solid ${T.accent}44`, fontFamily: FONT_SERIF, letterSpacing: "0.03em" }}>{q}</button>
                      ))}
                    </div>
                  </div>
                )}
                {aiChatMsgsG.map((m, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                    <div style={{
                      maxWidth: "85%",
                      padding: "9px 13px",
                      backgroundColor: m.role === "user" ? T.accent : T.cardAlt,
                      color: m.role === "user" ? "#fff" : T.text,
                      fontFamily: FONT_SERIF,
                    }}>
                      <p style={{ margin: 0, fontSize: 11, whiteSpace: "pre-wrap", lineHeight: 1.8, letterSpacing: "0.02em" }}>{m.text}</p>
                      {m.cached && <p style={{ margin: "2px 0 0", fontSize: 8, color: m.role === "user" ? "rgba(255,255,255,0.55)" : T.textFaint, letterSpacing: "0.05em" }}>⚡ キャッシュ回答</p>}
                    </div>
                  </div>
                ))}
                {aiChatLoadingG && (
                  <div style={{ display: "flex", justifyContent: "flex-start" }}>
                    <div style={{ padding: "9px 13px", backgroundColor: T.cardAlt }}>
                      <p style={{ margin: 0, fontSize: 10, color: T.accent, letterSpacing: "0.05em", animation: "pulse 1.5s ease-in-out infinite" }}>🤖 考え中...</p>
                    </div>
                  </div>
                )}
              </div>

              {/* 入力エリア */}
              <div style={{ padding: 10, display: "flex", gap: 6, borderTop: `1px solid ${T.border}`, backgroundColor: T.cardAlt }}>
                <input type="text" value={aiChatInputG} onChange={e => setAiChatInputG(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") sendMsg(); }}
                  placeholder="質問を入力..."
                  style={{ flex: 1, padding: "9px 13px", fontSize: 11, outline: "none", backgroundColor: T.card, color: T.text, border: `1px solid ${T.border}`, fontFamily: FONT_SERIF, letterSpacing: "0.02em" }} />
                <button onClick={sendMsg}
                  style={{ padding: "9px 16px", fontSize: 11, cursor: "pointer", backgroundColor: T.accent, color: "#fff", border: "none", fontFamily: FONT_SERIF, letterSpacing: "0.15em", fontWeight: 500 }}>送信</button>
              </div>
            </div>
          )}
        </>);
      })()}
    </div>
  );
}
