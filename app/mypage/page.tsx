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
  const [tab, setTab] = useState<"home" | "work" | "money" | "learn" | "shift" | "schedule" | "salary" | "customers" | "manual" | "notifications" | "tax" | "cert">("home");
  // ワーク / マネー / ラーン タブ内のサブセグメント
  const [workSub, setWorkSub] = useState<"schedule" | "shift" | "customers">("schedule");
  const [moneySub, setMoneySub] = useState<"salary" | "cert" | "tax">("salary");
  const [learnSub, setLearnSub] = useState<"notifications" | "manual">("notifications");
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
            ];
          }
          const clickSub = (k: typeof tab) => {
            setTab(k);
            if (k === "shift" || k === "schedule" || k === "customers") setWorkSub(k);
            else if (k === "salary" || k === "cert" || k === "tax") setMoneySub(k);
            else if (k === "notifications" || k === "manual") setLearnSub(k);
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
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-[14px] font-medium">🔔 お知らせ</h2>
              {notifications.filter(n => !notifReadIds.includes(n.id)).length > 0 && (
                <button onClick={markAllNotifRead} className="px-3 py-1.5 text-[10px] rounded-lg cursor-pointer" style={{ backgroundColor: "#e8849a18", color: "#e8849a", border: "1px solid #e8849a44" }}>
                  ✅ すべて既読にする
                </button>
              )}
            </div>

            {notifications.length === 0 ? (
              <div className="rounded-2xl border p-8 text-center" style={{ backgroundColor: T.card, borderColor: T.border }}>
                <p className="text-[30px] mb-2">📭</p>
                <p className="text-[12px]" style={{ color: T.textMuted }}>まだお知らせはありません</p>
              </div>
            ) : (
              <div className="space-y-2">
                {notifications.map(n => {
                  const isRead = notifReadIds.includes(n.id);
                  const icon = n.type === "schedule" ? "📅" : n.type === "warning" ? "⚠️" : "📢";
                  const borderColor = n.type === "warning" ? "#c4555544" : n.type === "schedule" ? "#85a8c444" : "#e8849a44";
                  const bgColor = isRead ? T.cardAlt : (n.type === "warning" ? "#c4555508" : n.type === "schedule" ? "#85a8c408" : "#FBEAF015");
                  return (
                    <div key={n.id} onClick={() => openNotif(n)} className="rounded-xl p-4 cursor-pointer transition-all hover:shadow-md" style={{ backgroundColor: bgColor, border: `1px solid ${isRead ? T.border : borderColor}` }}>
                      <div className="flex items-start gap-3">
                        <span className="text-[20px] leading-none flex-shrink-0 mt-0.5">{icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-[13px] font-medium flex-1" style={{ color: isRead ? T.textSub : T.text }}>{n.title}</p>
                            {!isRead && <span className="text-[9px] px-2 py-0.5 rounded-full text-white flex-shrink-0" style={{ backgroundColor: "#e8849a" }}>NEW</span>}
                            {n.target_therapist_id && <span className="text-[9px] px-1.5 py-0.5 rounded flex-shrink-0" style={{ backgroundColor: "#c3a78218", color: "#c3a782" }}>個別</span>}
                          </div>
                          <p className="text-[11px] line-clamp-2 mb-1.5" style={{ color: T.textMuted, whiteSpace: "pre-wrap" }}>{n.body}</p>
                          <p className="text-[9px]" style={{ color: T.textFaint }}>
                            {new Date(n.created_at).toLocaleDateString("ja-JP", { year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
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
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.5)" }} onClick={() => setNotifDetail(null)}>
            <div onClick={e => e.stopPropagation()} className="w-full max-w-[500px] rounded-2xl p-6 animate-[fadeIn_0.2s]" style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}>
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-[24px]">{notifDetail.type === "schedule" ? "📅" : notifDetail.type === "warning" ? "⚠️" : "📢"}</span>
                  <div>
                    <p className="text-[10px]" style={{ color: T.textFaint }}>
                      {new Date(notifDetail.created_at).toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
                <button onClick={() => setNotifDetail(null)} className="w-8 h-8 rounded-full cursor-pointer flex items-center justify-center text-[16px]" style={{ backgroundColor: T.cardAlt, color: T.textMuted }}>✕</button>
              </div>
              <h3 className="text-[16px] font-medium mb-3">{notifDetail.title}</h3>
              <div className="rounded-xl p-4" style={{ backgroundColor: T.cardAlt, border: `1px solid ${T.border}` }}>
                <p className="text-[13px] leading-relaxed whitespace-pre-wrap" style={{ color: T.text }}>{notifDetail.body}</p>
              </div>
              <button onClick={() => setNotifDetail(null)} className="w-full mt-4 py-3 rounded-xl text-[12px] font-medium cursor-pointer text-white" style={{ background: "linear-gradient(135deg, #e8849a, #d4687e)" }}>
                閉じる
              </button>
            </div>
          </div>
        )}

        {tab === "shift" && (<div className="space-y-4">
          <div className="flex items-center justify-between"><h2 className="text-[14px] font-medium">📝 シフト希望提出</h2><div className="flex items-center gap-2"><button onClick={() => setWeekOffset(Math.max(1, weekOffset - 1))} className="px-2 py-1 text-[11px] cursor-pointer rounded border" style={{ borderColor: T.border, color: T.textSub }}>◀</button><span className="text-[11px] font-medium min-w-[120px] text-center">{formatDate(weekDates[0])} 〜 {formatDate(weekDates[6])}</span><button onClick={() => setWeekOffset(weekOffset + 1)} className="px-2 py-1 text-[11px] cursor-pointer rounded border" style={{ borderColor: T.border, color: T.textSub }}>▶</button></div></div>
          {/* 説明テキスト */}
          <div className="rounded-xl p-3" style={{ backgroundColor: T.cardAlt, border: `1px solid ${T.border}` }}>
            <p className="text-[10px] m-0" style={{ color: T.textMuted, lineHeight: 1.8 }}>
              出勤希望の日にチェックを入れ、時間と店舗を選択してください。<br />
              希望シフトが決まったら<strong style={{ color: T.text }}>「シフト希望を提出」ボタン</strong>を押してお店に提出してください。<br />
              提出後、<strong style={{ color: "#e091a8" }}>LINEでお店にもご報告をお願いします</strong>。（📋 LINE用コピーで簡単に送れます）
            </p>
          </div>
          <div className="space-y-2">{weekDates.map(d => { const draft = reqDrafts[d]; if (!draft) return null; const dt = new Date(d + "T00:00:00"); const dow = ["日","月","火","水","木","金","土"][dt.getDay()]; const isSun = dt.getDay() === 0; const isSat = dt.getDay() === 6; const existing = shiftRequests.find(r => r.date === d);
            return (<div key={d} className="rounded-xl border p-3" style={{ backgroundColor: draft.enabled ? "#e8849a10" : T.card, borderColor: draft.enabled ? "#e8849a44" : T.border }}>
              <div className="flex items-center gap-2 mb-1"><button onClick={() => setReqDrafts({ ...reqDrafts, [d]: { ...draft, enabled: !draft.enabled } })} className="text-[14px] cursor-pointer flex-shrink-0" style={{ background: "none", border: "none" }}>{draft.enabled ? "✅" : "⬜"}</button><span className="text-[13px] font-medium min-w-[70px]" style={{ color: isSun ? "#c45555" : isSat ? "#3d6b9f" : T.text }}>{dt.getDate()}日 ({dow})</span>{existing && <span className="text-[8px] px-1.5 py-0.5 rounded ml-auto" style={{ backgroundColor: existing.status === "approved" ? "#22c55e18" : existing.status === "rejected" ? "#c4555518" : "#f59e0b18", color: existing.status === "approved" ? "#22c55e" : existing.status === "rejected" ? "#c45555" : "#f59e0b" }}>{existing.status === "approved" ? "承認済" : existing.status === "rejected" ? "却下" : "提出済"}</span>}</div>
              {draft.enabled && (<div className="flex items-center gap-1.5 ml-7 flex-wrap"><select value={draft.store_id} onChange={(e) => setReqDrafts({ ...reqDrafts, [d]: { ...draft, store_id: Number(e.target.value) } })} className="px-2 py-1.5 rounded-lg text-[10px] outline-none cursor-pointer border" style={{ backgroundColor: T.cardAlt, borderColor: "#e091a844", color: "#e091a8", fontWeight: 600 }}><option value={0}>店舗未選択</option>{stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select><select value={draft.start} onChange={(e) => setReqDrafts({ ...reqDrafts, [d]: { ...draft, start: e.target.value } })} className="px-2 py-1.5 rounded-lg text-[11px] outline-none cursor-pointer border" style={{ backgroundColor: T.cardAlt, borderColor: T.border, color: T.text }}>{TIMES.map(t => <option key={t} value={t}>{t}</option>)}</select><span className="text-[10px]" style={{ color: T.textMuted }}>〜</span><select value={draft.end} onChange={(e) => setReqDrafts({ ...reqDrafts, [d]: { ...draft, end: e.target.value } })} className="px-2 py-1.5 rounded-lg text-[11px] outline-none cursor-pointer border" style={{ backgroundColor: T.cardAlt, borderColor: T.border, color: T.text }}>{TIMES.map(t => <option key={t} value={t}>{t}</option>)}</select><input type="text" value={draft.notes} onChange={(e) => setReqDrafts({ ...reqDrafts, [d]: { ...draft, notes: e.target.value } })} placeholder="備考" className="flex-1 px-2 py-1.5 rounded-lg text-[10px] outline-none border min-w-[60px]" style={{ backgroundColor: T.cardAlt, borderColor: T.border, color: T.text }} /></div>)}
            </div>); })}</div>
          {reqMsg && <p className="text-[11px] text-center" style={{ color: "#22c55e" }}>{reqMsg}</p>}
          <div className="flex gap-2"><button onClick={submitShiftRequests} disabled={reqSaving} className="flex-1 py-3 rounded-xl text-[12px] font-medium cursor-pointer text-white disabled:opacity-50" style={{ background: "linear-gradient(135deg, #e8849a, #d4687e)" }}>{reqSaving ? "送信中..." : "シフト希望を提出"}</button><button onClick={copyShiftToClipboard} className="px-4 py-3 rounded-xl text-[11px] font-medium cursor-pointer border" style={{ borderColor: copiedShift ? "#22c55e" : "#e091a844", color: copiedShift ? "#22c55e" : "#e091a8", backgroundColor: copiedShift ? "#22c55e18" : "transparent" }}>{copiedShift ? "✅ コピー済" : "📋 LINE用コピー"}</button></div>
          {weekDates.some(d => reqDrafts[d]?.enabled) && (<div className="rounded-xl border p-3" style={{ backgroundColor: T.cardAlt, borderColor: T.border }}><p className="text-[9px] font-medium mb-1" style={{ color: T.textMuted }}>📋 コピー内容プレビュー</p><pre className="text-[10px] whitespace-pre-wrap" style={{ color: T.textSub }}>{generateShiftCopyText()}</pre></div>)}
        </div>)}

        {tab === "schedule" && (<div className="space-y-4">
          <h2 className="text-[14px] font-medium">📅 確定シフト</h2>
          {shifts.length === 0 ? <p className="text-[12px] text-center py-8" style={{ color: T.textFaint }}>確定シフトがありません</p> : (<div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: T.card, borderColor: T.border }}>{shifts.map(s => { const bld = getBuildingForDate(s.date); return (<div key={s.id} className="flex items-center justify-between px-4 py-3" style={{ borderBottom: `1px solid ${T.border}` }}><div className="flex items-center gap-3 flex-wrap"><span className="text-[12px] font-medium min-w-[80px]">{formatDate(s.date)}</span>{s.store_id > 0 && <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "#f8bbd018", color: "#e091a8" }}>{getStoreShort(s.store_id)}</span>}{bld && <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "#85a8c418", color: "#85a8c4" }}>🏢 {bld}</span>}<span className="text-[12px]">{s.start_time?.slice(0,5)} 〜 {s.end_time?.slice(0,5)}</span></div>{s.date === today && <span className="text-[9px] px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: "#e8849a" }}>今日</span>}</div>); })}</div>)}
          {shiftRequests.filter(r => r.status === "pending").length > 0 && (<div className="rounded-2xl border p-4" style={{ backgroundColor: "#f59e0b10", borderColor: "#f59e0b33" }}><p className="text-[11px] font-medium mb-2" style={{ color: "#f59e0b" }}>⏳ 承認待ちのシフト希望</p>{shiftRequests.filter(r => r.status === "pending").map(r => (<div key={r.id} className="flex items-center justify-between py-1 text-[11px]"><span>{formatDate(r.date)}</span><div className="flex items-center gap-2">{r.store_id > 0 && <span className="text-[9px]" style={{ color: "#e091a8" }}>{getStoreShort(r.store_id)}</span>}<span>{r.start_time} 〜 {r.end_time}</span></div></div>))}</div>)}
        </div>)}

        {tab === "salary" && (<div className="space-y-4">
          {/* モード切替 */}
          <div className="flex items-center justify-between">
            <h2 className="text-[14px] font-medium">💰 給料明細</h2>
            <div className="flex gap-1">
              {([["monthly","📅 月別"],["annual","📊 年間"]] as const).map(([k,l]) => (
                <button key={k} onClick={() => setSalaryViewMode(k)} className="px-3 py-1.5 text-[10px] rounded-lg cursor-pointer" style={{ backgroundColor: salaryViewMode === k ? "#e8849a20" : "transparent", color: salaryViewMode === k ? "#e8849a" : T.textMuted, border: `1px solid ${salaryViewMode === k ? "#e8849a44" : T.border}`, fontWeight: salaryViewMode === k ? 600 : 400 }}>{l}</button>
              ))}
            </div>
          </div>

          {/* 月別ビュー */}
          {salaryViewMode === "monthly" && (<>
            <div className="flex items-center justify-center gap-2">
              <button onClick={() => { const d = new Date(smY, smM - 2, 1); setSalaryMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`); }} className="px-2 py-1 text-[11px] cursor-pointer rounded border" style={{ borderColor: T.border, color: T.textSub }}>◀</button>
              <span className="text-[12px] font-medium">{smY}年{smM}月</span>
              <button onClick={() => { const d = new Date(smY, smM, 1); setSalaryMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`); }} className="px-2 py-1 text-[11px] cursor-pointer rounded border" style={{ borderColor: T.border, color: T.textSub }}>▶</button>
            </div>
            <div className="grid grid-cols-3 gap-3">{[{ l: "月合計", v: fmt(monthTotal), c: "#e8849a" }, { l: "接客数", v: `${monthOrders}件`, c: T.text }, { l: "出勤日数", v: `${monthDays}日`, c: T.text }].map(s => (<div key={s.l} className="rounded-xl p-4 border text-center" style={{ backgroundColor: T.card, borderColor: T.border }}><p className="text-[9px] mb-1" style={{ color: T.textMuted }}>{s.l}</p><p className="text-[18px] font-light" style={{ color: s.c }}>{s.v}</p></div>))}</div>
            {settlements.length === 0 ? <p className="text-[12px] text-center py-8" style={{ color: T.textFaint }}>清算データがありません</p> : (<div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: T.card, borderColor: T.border }}>{settlements.map(stl => (<div key={stl.id} className="px-4 py-3" style={{ borderBottom: `1px solid ${T.border}` }}><div className="flex items-center justify-between mb-1"><span className="text-[12px] font-medium">{formatDate(stl.date)}</span><span className="text-[14px] font-medium" style={{ color: "#e8849a" }}>{fmt(stl.final_payment)}</span></div><div className="flex items-center gap-3 text-[9px] flex-wrap" style={{ color: T.textMuted }}><span>{stl.order_count}件</span><span>売上{fmt(stl.total_sales)}</span><span>バック{fmt(stl.total_back)}</span>{stl.invoice_deduction > 0 && <span style={{ color: "#c45555" }}>INV-{fmt(stl.invoice_deduction)}</span>}{stl.withholding_tax > 0 && <span style={{ color: "#c45555" }}>源泉-{fmt(stl.withholding_tax)}</span>}{stl.welfare_fee > 0 && <span style={{ color: "#c45555" }}>備品-{fmt(stl.welfare_fee)}</span>}{stl.transport_fee > 0 && <span style={{ color: "#22c55e" }}>交通+{fmt(stl.transport_fee)}</span>}</div></div>))}</div>)}
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
            // 月別集計
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
              <div className="flex items-center justify-center gap-2">
                <button onClick={() => setSalaryYear(salaryYear - 1)} className="px-2 py-1 text-[11px] cursor-pointer rounded border" style={{ borderColor: T.border, color: T.textSub }}>◀</button>
                <span className="text-[12px] font-medium">{salaryYear}年</span>
                <button onClick={() => setSalaryYear(salaryYear + 1)} className="px-2 py-1 text-[11px] cursor-pointer rounded border" style={{ borderColor: T.border, color: T.textSub }}>▶</button>
              </div>
              {annualLoading ? <p className="text-[12px] text-center py-8" style={{ color: T.textFaint }}>読み込み中...</p> : (<>
                {/* 年間サマリーカード */}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { l: "年間報酬（税込）", v: fmt(aGross), c: "#e8849a" },
                    { l: "差引支払額", v: fmt(aFinal), c: "#c3a782" },
                    { l: "源泉徴収", v: aTax > 0 ? `-${fmt(aTax)}` : "なし", c: aTax > 0 ? "#c45555" : T.textMuted },
                    { l: "出勤日数", v: `${aDays}日（${aOrders}件）`, c: T.text },
                  ].map(s => (<div key={s.l} className="rounded-xl p-4 border text-center" style={{ backgroundColor: T.card, borderColor: T.border }}><p className="text-[9px] mb-1" style={{ color: T.textMuted }}>{s.l}</p><p className="text-[16px] font-light" style={{ color: s.c }}>{s.v}</p></div>))}
                </div>

                {/* 控除内訳 */}
                {(aInvDed > 0 || aWelfare > 0 || aTransport > 0) && (
                  <div className="rounded-xl border p-4" style={{ backgroundColor: T.card, borderColor: T.border }}>
                    <p className="text-[10px] font-medium mb-2" style={{ color: T.textMuted }}>控除・加算の内訳（計算式）</p>
                    <div className="space-y-1 text-[11px]">
                      <div className="flex justify-between"><span>報酬額（税込）</span><span className="font-medium">{fmt(aGross)}</span></div>
                      {aInvDed > 0 && <div className="flex justify-between" style={{ color: "#c45555" }}><span>− インボイス控除（10%）</span><span>-{fmt(aInvDed)}</span></div>}
                      {aTax > 0 && <div className="flex justify-between" style={{ color: "#c45555" }}><span>− 源泉徴収（10.21%）</span><span>-{fmt(aTax)}</span></div>}
                      {aWelfare > 0 && <div className="flex justify-between" style={{ color: "#c45555" }}><span>− 備品・リネン代</span><span>-{fmt(aWelfare)}</span></div>}
                      {aTransport > 0 && <div className="flex justify-between" style={{ color: "#22c55e" }}><span>+ 交通費（実費精算・非課税）</span><span>+{fmt(aTransport)}</span></div>}
                      <div className="flex justify-between pt-2 font-bold" style={{ borderTop: `1px dashed ${T.border}`, color: "#c3a782" }}><span>差引支払額（お手取り）</span><span>{fmt(aFinal)}</span></div>
                    </div>
                    <div className="mt-3 pt-2 text-[9px]" style={{ borderTop: `1px dashed ${T.border}`, color: T.textMuted, lineHeight: 1.6 }}>
                      <p>💡 <strong>確定申告のヒント</strong>:</p>
                      <p>・上の「報酬額（税込）」が税務署に報告される<strong>支払金額</strong>です（収入）</p>
                      {aWelfare > 0 && <p>・<strong>備品・リネン代</strong>（{fmt(aWelfare)}）は必要経費として計上できます（消耗品費など）</p>}
                      {aTransport > 0 && <p>・<strong>交通費（実費精算分）</strong>（{fmt(aTransport)}）は立替精算なので<span style={{ color: "#c45555" }}>収入にも経費にもなりません</span>（課税対象外）</p>}
                      {aTax > 0 && <p>・<strong>源泉徴収税額</strong>（{fmt(aTax)}）は確定申告で還付または納税調整の対象になります</p>}
                    </div>
                  </div>
                )}

                {/* 支払調書ボタン */}
                {aDays > 0 && (
                  <button onClick={openPayslip} className="w-full py-3 rounded-xl text-[12px] font-medium cursor-pointer" style={{ background: "linear-gradient(135deg, #e8849a, #d4687e)", color: "#fff" }}>📄 {salaryYear}年 支払調書を表示</button>
                )}

                {/* 証明書発行 → タブへ */}
                <button onClick={() => { setTab("cert"); window.location.hash = "cert"; }} className="w-full py-3 rounded-xl text-[11px] font-medium cursor-pointer flex items-center justify-center gap-2" style={{ backgroundColor: T.card, border: `1px solid ${T.border}`, color: T.textSub }}>
                  📄 証明書を発行する →
                </button>

                {/* 月別内訳 */}
                {monthlyData.length > 0 && (
                  <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: T.card, borderColor: T.border }}>
                    <div className="px-4 py-3" style={{ borderBottom: `1px solid ${T.border}` }}><p className="text-[11px] font-medium">月別内訳</p></div>
                    {monthlyData.map(md => (
                      <div key={md.month} className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: `1px solid ${T.border}` }}>
                        <span className="text-[12px] font-medium">{md.month}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-[9px]" style={{ color: T.textMuted }}>{md.days}日</span>
                          <span className="text-[9px]" style={{ color: T.textMuted }}>報酬{fmt(md.gross)}</span>
                          <span className="text-[13px] font-medium" style={{ color: "#e8849a" }}>{fmt(md.final)}</span>
                        </div>
                      </div>
                    ))}
                    <div className="flex items-center justify-between px-4 py-3 font-bold" style={{ backgroundColor: T.cardAlt }}>
                      <span className="text-[12px]">合計</span>
                      <span className="text-[14px]" style={{ color: "#e8849a" }}>{fmt(aFinal)}</span>
                    </div>
                  </div>
                )}
                {aDays === 0 && <p className="text-[12px] text-center py-8" style={{ color: T.textFaint }}>{salaryYear}年の清算データがありません</p>}
              </>)}
            </>);
          })()}
        </div>)}

        {tab === "customers" && (<div className="space-y-4">
          <div className="flex items-center justify-between"><h2 className="text-[14px] font-medium">👤 お客様メモ・NG</h2><button onClick={() => { setShowAddNote(true); setNoteForm({ customer_name: "", note: "", is_ng: false, ng_reason: "", rating: 0, reservation_id: 0 }); }} className="px-3 py-1.5 text-[10px] rounded-lg cursor-pointer text-white" style={{ backgroundColor: "#e8849a" }}>+ メモ追加</button></div>
          <div className="rounded-xl p-3" style={{ backgroundColor: "#85a8c410", border: "1px solid #85a8c430" }}>
            <p className="text-[11px] font-medium mb-1" style={{ color: "#85a8c4" }}>🛡️ NG登録について</p>
            <p className="text-[10px] leading-relaxed" style={{ color: T.textSub }}>NGに登録されたお客様がネット予約をする際は、あなたの出勤枠が<span style={{ color: "#c45555", fontWeight: 600 }}>「お休み」として表示</span>されるため、予約が入ることはありません。お電話でのご予約の場合も、受付スタッフが事前に確認しお断りいたしますのでご安心ください。</p>
          </div>
          <input type="text" value={noteSearch} onChange={(e) => setNoteSearch(e.target.value)} placeholder="お客様名で検索..." className="w-full px-4 py-2.5 rounded-xl text-[12px] outline-none border" style={{ backgroundColor: T.cardAlt, borderColor: T.border, color: T.text }} />
          {uniqueCustomers.length > 0 && (<div className="rounded-2xl border p-4" style={{ backgroundColor: T.card, borderColor: T.border }}><p className="text-[10px] font-medium mb-2" style={{ color: T.textMuted }}>接客したお客様（全{uniqueCustomers.length}名）</p><div className="flex flex-wrap gap-1.5">{uniqueCustomers.filter(([name]) => !noteSearch || name.includes(noteSearch)).map(([name, info]) => { const notes = customerNotes.filter(n => n.customer_name === name); const isNg = notes.some(n => n.is_ng); const hasNote = notes.length > 0; return (<button key={name} onClick={() => setNoteHistoryCustomer(name)} className="px-2.5 py-1.5 rounded-lg text-[10px] cursor-pointer border" style={{ backgroundColor: isNg ? "#c4555515" : hasNote ? "#e8849a15" : T.cardAlt, borderColor: isNg ? "#c4555544" : hasNote ? "#e8849a44" : T.border, color: isNg ? "#c45555" : T.text }}>{isNg && "🚫"}{name}({info.count}回){notes.length > 0 && (" 📝" + (notes.length > 1 ? notes.length : ""))}</button>); })}</div></div>)}
          <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: T.card, borderColor: T.border }}><div className="px-4 py-2.5 border-b" style={{ borderColor: T.border }}><p className="text-[11px] font-medium">登録済みメモ（{customerNotes.length}件）</p><p className="text-[8px]" style={{ color: T.textFaint }}>※ メモの削除はスタッフにお申し付けください</p></div>
            {customerNotes.filter(n => !noteSearch || n.customer_name.includes(noteSearch)).length === 0 ? <p className="text-[12px] text-center py-6" style={{ color: T.textFaint }}>メモがありません</p> : customerNotes.filter(n => !noteSearch || n.customer_name.includes(noteSearch)).map(n => { const res = n.reservation_id ? allReservations.find(r => r.id === n.reservation_id) : null; return (<div key={n.id} className="px-4 py-3 cursor-pointer" style={{ borderBottom: `1px solid ${T.border}` }} onClick={() => setNoteHistoryCustomer(n.customer_name)}><div className="flex items-center gap-2"><span className="text-[12px] font-medium">{n.customer_name}</span>{n.is_ng && <span className="text-[8px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "#c4555518", color: "#c45555" }}>🚫 NG</span>}{n.rating > 0 && <span className="text-[9px]" style={{ color: "#f59e0b" }}>{"★".repeat(n.rating)}</span>}{res && <span className="text-[9px]" style={{ color: T.textMuted }}>{formatDate(res.date)}</span>}</div>{n.note && <p className="text-[10px] mt-0.5 truncate" style={{ color: T.textSub }}>{n.note}</p>}</div>); })}
          </div>
        </div>)}

        {tab === "manual" && (<div className="space-y-4">
          {/* マニュアル詳細表示 */}
          {manualViewArticle ? (() => {
            const cat = manualCats.find(c => c.id === manualViewArticle.category_id);
            const latestUpd = manualUpdates.find(u => u.article_id === manualViewArticle.id);
            return (<div>
              <div className="flex gap-2 mb-3">
                <button onClick={goBackManual} className="px-3 py-1.5 text-[10px] rounded-lg cursor-pointer border" style={{ borderColor: T.border, color: T.textSub }}>
                  {manualHistory.length > 0 ? `← ${manualHistory[manualHistory.length - 1].title.slice(0, 12)}${manualHistory[manualHistory.length - 1].title.length > 12 ? '...' : ''} に戻る` : '← 一覧に戻る'}
                </button>
                {manualHistory.length > 0 && (
                  <button onClick={() => { setManualViewArticle(null); setManualHistory([]); }} className="px-3 py-1.5 text-[10px] rounded-lg cursor-pointer border" style={{ borderColor: T.border, color: T.textMuted }}>
                    📋 一覧へ
                  </button>
                )}
              </div>
              {manualViewArticle.cover_image && <div className="rounded-xl overflow-hidden mb-3" style={{ maxHeight: 200 }}><img src={manualViewArticle.cover_image} alt="" style={{ width: "100%", objectFit: "cover" }} /></div>}
              <h2 className="text-[18px] font-semibold mb-2">{manualViewArticle.title}</h2>
              <div className="flex items-center gap-2 flex-wrap mb-3">
                {cat && <span className="text-[10px] px-2 py-0.5 rounded-lg" style={{ background: cat.color, color: "#333" }}>{cat.icon} {cat.name}</span>}
                {manualViewArticle.tags.map(t => <span key={t} className="text-[10px] px-2 py-0.5 rounded-lg" style={{ background: "#f0eee8", color: T.textSub }}>{t}</span>)}
              </div>
              {latestUpd && <div className="rounded-xl p-3 mb-3" style={{ background: "#FAEEDA", border: "1px solid #f59e0b33" }}><span className="text-[11px]" style={{ color: "#854F0B" }}>✏️ {new Date(latestUpd.created_at).toLocaleDateString("ja")} 更新: {latestUpd.summary}</span></div>}
              {/* 本文レンダリング */}
              <div className="rounded-2xl border p-4 mb-3" style={{ backgroundColor: T.card, borderColor: T.border }}>
                {manualViewArticle.content.split("\n").map((line, i) => {
                  if (line.startsWith("## ")) return <h3 key={i} className="text-[15px] font-semibold mt-3 mb-1" style={{ color: "#e8849a" }}>{renderInlineLinks(line.slice(3))}</h3>;
                  if (line.startsWith("### ")) return <h4 key={i} className="text-[13px] font-medium mt-2 mb-1" style={{ color: T.accent }}>{renderInlineLinks(line.slice(4))}</h4>;
                  if (line.startsWith("- ")) return <div key={i} className="flex gap-2 text-[13px] leading-relaxed ml-2"><span style={{ color: "#e8849a" }}>●</span><span>{renderInlineContent(line.slice(2))}</span></div>;
                  if (line.match(/^\d+\.\s/)) return <div key={i} className="flex gap-2 text-[13px] leading-relaxed ml-2"><span style={{ color: "#e8849a", fontWeight: 600, minWidth: 18 }}>{line.match(/^(\d+)\./)?.[1]}.</span><span>{renderInlineContent(line.replace(/^\d+\.\s/, ""))}</span></div>;
                  if (line.startsWith("> ")) return <div key={i} style={{ borderLeft: "3px solid #e8849a", paddingLeft: 12, margin: "6px 0", fontSize: 13, color: T.textSub, fontStyle: "italic" }}>{renderInlineContent(line.slice(2))}</div>;
                  if (line.trim() === "---") return <hr key={i} style={{ border: "none", borderTop: `1px solid ${T.border}`, margin: "12px 0" }} />;
                  if (line.startsWith("![")) { const m = line.match(/!\[.*?\]\((.*?)\)/); if (m) return <img key={i} src={m[1]} alt="" className="rounded-xl my-2" style={{ maxWidth: "100%" }} />; }
                  if (line.match(/^\[youtube:([\w-]+)\]$/)) { const vid = line.match(/^\[youtube:([\w-]+)\]$/)?.[1]; return <div key={i} style={{ position: "relative", paddingBottom: "56.25%", height: 0, margin: "8px 0", borderRadius: 12, overflow: "hidden" }}><iframe src={`https://www.youtube.com/embed/${vid}`} style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: "none" }} allowFullScreen /></div>; }
                  if (line.match(/^\[gdrive:([\w-]+)(:.*)?\]$/)) { const gm = line.match(/^\[gdrive:([\w-]+)(?::(.+))?\]$/); const fid = gm?.[1]; const gdesc = gm?.[2] || ""; return <div key={i} style={{ margin: "12px 0" }}><div style={{ position: "relative", paddingBottom: "56.25%", height: 0, borderRadius: 12, overflow: "hidden" }}><iframe src={`https://drive.google.com/file/d/${fid}/preview`} style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: "none" }} allow="autoplay" /></div>{gdesc && <p className="text-[11px] font-medium mt-1 text-center" style={{ color: "#e8849a" }}>🎬 {gdesc}</p>}</div>; }
                  if (line.match(/\*\*(.*?)\*\*/)) { return <p key={i} className="text-[13px] leading-relaxed">{renderInlineContent(line)}</p>; }
                  if (line.trim() === "") return <div key={i} className="h-2" />;
                  return <p key={i} className="text-[13px] leading-relaxed">{renderInlineContent(line)}</p>;
                })}
              </div>
              {/* Q&A */}
              {manualViewQAs.length > 0 && (<div className="rounded-2xl border p-4" style={{ backgroundColor: T.card, borderColor: T.border }}>
                <h3 className="text-[13px] font-semibold mb-3" style={{ color: "#e8849a" }}>❓ よくある質問（{manualViewQAs.length}件）</h3>
                {manualViewQAs.map((qa, i) => (
                  <div key={i} className="rounded-xl border mb-2" style={{ borderColor: T.border, overflow: "hidden" }}>
                    <button className="w-full text-left px-3 py-2.5 flex items-center gap-2 text-[12px] font-medium cursor-pointer" style={{ background: manualOpenQA === i ? ("#fef9f0") : "transparent" }} onClick={() => setManualOpenQA(manualOpenQA === i ? null : i)}>
                      <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "#e8849a20", color: "#e8849a" }}>Q</span>
                      <span style={{ flex: 1, color: T.text }}>{qa.question}</span>
                      <span style={{ color: T.textMuted, fontSize: 10, transition: "transform 0.2s", transform: manualOpenQA === i ? "rotate(90deg)" : "none" }}>▶</span>
                    </button>
                    {manualOpenQA === i && <div className="px-3 pb-3 pt-1 text-[12px] leading-relaxed" style={{ color: T.textSub, borderTop: `1px solid ${T.border}` }}><span className="text-[10px] px-1.5 py-0.5 rounded mr-1" style={{ background: "#4a7c5920", color: "#4a7c59" }}>A</span>{qa.answer}</div>}
                  </div>
                ))}
              </div>)}
            </div>);
          })() : (<div>
            {/* 更新タイムライン */}
            {manualUpdates.length > 0 && (<div className="rounded-2xl border p-4" style={{ backgroundColor: T.card, borderColor: T.border }}>
              <h3 className="text-[13px] font-semibold mb-2">📝 最近の更新</h3>
              {manualUpdates.slice(0, 3).map(u => {
                const art = manualArticles.find(a => a.id === u.article_id);
                return (<div key={u.id} className="flex gap-2 py-1.5" style={{ borderBottom: `1px solid ${T.border}` }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#e8849a", marginTop: 5, flexShrink: 0 }} />
                  <div><span className="text-[12px] font-medium cursor-pointer" style={{ color: "#e8849a" }} onClick={() => { if (art) openManualArticle(art); }}>{art?.title || "?"}</span><span className="text-[10px] ml-1" style={{ color: T.textMuted }}>{u.summary}</span><div className="text-[9px]" style={{ color: T.textFaint }}>{new Date(u.created_at).toLocaleDateString("ja")}</div></div>
                </div>);
              })}
            </div>)}
            {/* 検索 */}
            <input type="text" value={manualSearch} onChange={e => setManualSearch(e.target.value)} placeholder="🔍 マニュアルを検索..." className="w-full px-4 py-2.5 rounded-xl text-[12px] outline-none border" style={{ backgroundColor: T.cardAlt, borderColor: T.border, color: T.text }} />
            {/* カテゴリフィルタ */}
            <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ WebkitOverflowScrolling: "touch" }}>
              <button onClick={() => setManualSelCat(null)} className="px-3 py-1.5 text-[10px] rounded-lg cursor-pointer whitespace-nowrap border" style={chipStyle(manualSelCat === null, "#e8849a")}>すべて</button>
              {manualCats.map(c => (<button key={c.id} onClick={() => setManualSelCat(c.id)} className="px-3 py-1.5 text-[10px] rounded-lg cursor-pointer whitespace-nowrap border" style={{ ...chipStyle(manualSelCat === c.id, "#e8849a"), ...(manualSelCat !== c.id ? { borderColor: c.color } : {}) }}>{c.icon} {c.name}</button>))}
            </div>
            {/* タグフィルタ */}
            {(() => { const allT = Array.from(new Set(manualArticles.flatMap(a => a.tags))).sort(); return allT.length > 0 ? (
              <div className="flex gap-1 flex-wrap">
                <span className="text-[9px] leading-[22px]" style={{ color: T.textMuted }}>🏷️</span>
                {manualFilterTag && <button onClick={() => setManualFilterTag("")} className="text-[9px] px-2 py-0.5 rounded-lg cursor-pointer border" style={{ borderColor: T.border, color: T.textSub }}>× クリア</button>}
                {allT.map(t => <button key={t} onClick={() => setManualFilterTag(manualFilterTag === t ? "" : t)} className="text-[9px] px-2 py-0.5 rounded-lg cursor-pointer" style={{ background: manualFilterTag === t ? "#e8849a" : ("#f0eee8"), color: manualFilterTag === t ? "#fff" : T.textSub, border: "none", opacity: manualFilterTag && manualFilterTag !== t ? 0.4 : 1 }}>{t}</button>)}
              </div>
            ) : null; })()}
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
                return (<div key={a.id} className="rounded-2xl border p-3 cursor-pointer" style={{ backgroundColor: T.card, borderColor: isNew && !isRead ? "#e8849a55" : T.border, transition: "transform 0.15s" }} onClick={() => openManualArticle(a)}>
                  <div className="flex gap-3">
                    {a.cover_image ? <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0"><img src={a.cover_image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /></div> : <div className="w-16 h-16 rounded-xl flex-shrink-0 flex items-center justify-center text-[24px]" style={{ background: cat?.color || T.bg }}>{cat?.icon || "📄"}</div>}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="flex items-center gap-1.5 flex-wrap mb-1">
                        {a.is_pinned && <span className="text-[8px] px-1.5 py-0.5 rounded" style={{ background: "#FAEEDA", color: "#854F0B" }}>📌</span>}
                        {isNew && !isRead && <span className="manual-new-badge text-[8px] px-1.5 py-0.5 rounded" style={{ background: "#e8849a", color: "#fff" }}>🆕 NEW</span>}
                        {isUpdated && <span className="manual-updated-badge text-[8px] px-1.5 py-0.5 rounded" style={{ background: "#FAEEDA", color: "#854F0B" }}>✏️更新</span>}
                        {isRead && <span className="text-[8px]" style={{ color: "#4a7c59" }}>✅</span>}
                      </div>
                      <h4 className="text-[13px] font-semibold truncate" style={{ color: T.text }}>{a.title}</h4>
                      {a.tags.length > 0 && <div className="flex gap-1 flex-wrap mt-1">{a.tags.slice(0, 3).map(t => <span key={t} className="text-[8px] px-1.5 py-0.5 rounded" style={{ background: "#f0eee8", color: T.textSub }}>{t}</span>)}</div>}
                    </div>
                  </div>
                </div>);
              };
              return (<div className="space-y-2">
                {pinned.map(renderCard)}
                {unpinned.map(renderCard)}
                {filtered.length === 0 && <div className="text-center py-8"><div className="text-[32px] mb-2">📖</div><p className="text-[12px]" style={{ color: T.textMuted }}>該当する記事がありません</p></div>}
              </div>);
            })()}
          </div>)}

          {/* 🤖 AIチャット */}
          {!manualViewArticle && (
            <div>
              {!aiChatOpen ? (
                <button onClick={() => setAiChatOpen(true)}
                  className="w-full py-3.5 rounded-2xl text-[13px] font-medium cursor-pointer border flex items-center justify-center gap-2"
                  style={{ background: "linear-gradient(135deg, #e8849a18, #d4687e08)", borderColor: "#e8849a44", color: "#e8849a" }}>
                  <span style={{ fontSize: 18 }}>🤖</span>
                  <span>マニュアルAIに質問する</span>
                </button>
              ) : (
                <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: T.card, borderColor: "#e8849a44", boxShadow: "0 2px 12px rgba(232,132,154,0.08)" }}>
                  {/* ヘッダー */}
                  <div className="flex items-center justify-between px-4 py-2.5 border-b" style={{ borderColor: T.border, background: "linear-gradient(135deg, #e8849a18, #d4687e08)" }}>
                    <div className="flex items-center gap-2">
                      <span style={{ fontSize: 16 }}>🤖</span>
                      <span className="text-[12px] font-semibold" style={{ color: "#e8849a" }}>マニュアルAI</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: "#4ade8033", color: "#22c55e" }}>● online</span>
                      {aiSessionCount > 0 && <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: aiSessionCount >= 4 ? "#ef444420" : "#f59e0b20", color: aiSessionCount >= 4 ? "#ef4444" : "#f59e0b" }}>{aiSessionCount >= 4 ? "質問上限" : `残り${4 - aiSessionCount}回`}</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      {aiChatMessages.length > 0 && (
                        <button onClick={() => { setAiChatMessages([]); setAiSessionCount(0); }} className="text-[9px] px-2 py-0.5 rounded cursor-pointer" style={{ color: T.textMuted, background: "none", border: `1px solid ${T.border}` }}>🗑️ クリア</button>
                      )}
                      <button onClick={() => setAiChatOpen(false)} className="text-[10px] px-2 py-0.5 rounded cursor-pointer" style={{ color: T.textMuted, background: "none", border: "none" }}>✕ 閉じる</button>
                    </div>
                  </div>
                  {/* メッセージエリア */}
                  <div style={{ maxHeight: 350, overflowY: "auto", padding: 12 }}>
                    {aiChatMessages.length === 0 && (
                      <div className="text-center py-6">
                        <div style={{ fontSize: 36, marginBottom: 8 }}>🤖</div>
                        <p className="text-[12px] font-medium" style={{ color: T.text }}>マニュアルAIアシスタント</p>
                        <p className="text-[10px] mt-1" style={{ color: T.textMuted }}>マニュアルの内容について何でも聞いてね！</p>
                        <div className="flex flex-wrap gap-1.5 justify-center mt-4">
                          {["掃除の手順を教えて", "精算方法は？", "シフトの出し方", "LAST勤務とは？", "お給料について"].map(q => (
                            <button key={q} onClick={() => { setAiChatInput(q); }}
                              className="text-[10px] px-3 py-1.5 rounded-full cursor-pointer border transition-all"
                              style={{ borderColor: "#e8849a33", color: "#e8849a", background: "transparent" }}>{q}</button>
                          ))}
                        </div>
                      </div>
                    )}
                    {aiChatMessages.map((m, i) => (
                      <div key={i} className={`flex mb-3 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                        {m.role === "ai" && <div className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center mr-2 mt-0.5" style={{ background: "#e8849a20", fontSize: 12 }}>🤖</div>}
                        <div style={{ maxWidth: "80%" }}>
                          <div className="rounded-2xl px-3.5 py-2.5 text-[12px] leading-[1.7]" style={{
                            background: m.role === "user" ? "linear-gradient(135deg, #e8849a, #d4687e)" : ("#f8f6f3"),
                            color: m.role === "user" ? "#fff" : T.text,
                            borderBottomRightRadius: m.role === "user" ? 4 : 16,
                            borderBottomLeftRadius: m.role === "ai" ? 4 : 16,
                          }}>
                            {m.role === "ai" ? renderInlineContent(m.content) : m.content}
                          </div>
                          {m.role === "ai" && m.logId && (
                            <div className="flex gap-1.5 mt-1 ml-1">
                              <button onClick={async () => {
                                if (m.rating) return;
                                try {
                                  await fetch("/api/manual-ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "rate", logId: m.logId, rating: 1 }) });
                                  setAiChatMessages(prev => prev.map((msg, idx) => idx === i ? { ...msg, rating: 1 } : msg));
                                } catch {}
                              }} className="text-[11px] px-2 py-0.5 rounded-full cursor-pointer transition-all" style={{
                                background: m.rating === 1 ? "#4ade8030" : "transparent",
                                border: `1px solid ${m.rating === 1 ? "#4ade80" : T.border}`,
                                color: m.rating === 1 ? "#22c55e" : T.textMuted,
                                opacity: m.rating && m.rating !== 1 ? 0.3 : 1,
                              }}>👍</button>
                              <button onClick={async () => {
                                if (m.rating) return;
                                try {
                                  await fetch("/api/manual-ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "rate", logId: m.logId, rating: -1 }) });
                                  setAiChatMessages(prev => prev.map((msg, idx) => idx === i ? { ...msg, rating: -1 } : msg));
                                } catch {}
                              }} className="text-[11px] px-2 py-0.5 rounded-full cursor-pointer transition-all" style={{
                                background: m.rating === -1 ? "#ef444430" : "transparent",
                                border: `1px solid ${m.rating === -1 ? "#ef4444" : T.border}`,
                                color: m.rating === -1 ? "#ef4444" : T.textMuted,
                                opacity: m.rating && m.rating !== -1 ? 0.3 : 1,
                              }}>👎</button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    {aiChatLoading && (
                      <div className="flex justify-start mb-3">
                        <div className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center mr-2 mt-0.5" style={{ background: "#e8849a20", fontSize: 12 }}>🤖</div>
                        <div className="rounded-2xl px-3.5 py-2.5 text-[12px] flex items-center gap-2" style={{ background: "#f8f6f3", color: T.textMuted, borderBottomLeftRadius: 4 }}>
                          <span className="inline-block" style={{ animation: "pulse 1.5s ease-in-out infinite" }}>💭</span>
                          考え中...
                          <style>{`@keyframes pulse { 0%,100% { opacity: 0.4; } 50% { opacity: 1; } }`}</style>
                        </div>
                      </div>
                    )}
                  </div>
                  {/* 入力エリア */}
                  <div className="flex gap-2 p-3 border-t items-center" style={{ borderColor: T.border, background: "#faf9f7" }}>
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
                      className="flex-1 px-3.5 py-2.5 rounded-xl text-[12px] outline-none"
                      style={{ backgroundColor: T.cardAlt, color: T.text, border: aiListening ? "1px solid #e8849a" : `1px solid ${T.border}` }} />
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
                      className="w-9 h-9 rounded-full flex items-center justify-center cursor-pointer flex-shrink-0"
                      style={{
                        background: aiListening ? "#e8849a" : "transparent",
                        border: aiListening ? "none" : `1px solid ${T.border}`,
                        color: aiListening ? "#fff" : "#e8849a",
                        fontSize: 16,
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
                      className="px-4 py-2.5 rounded-xl text-[11px] text-white cursor-pointer disabled:opacity-40 font-medium"
                      style={{ background: "linear-gradient(135deg, #e8849a, #d4687e)", border: "none", boxShadow: "0 2px 6px rgba(232,132,154,0.25)" }}>送信</button>
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
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setCalDetailDate(null)}>
            <div className="rounded-2xl border p-5 w-full max-w-md max-h-[85vh] overflow-y-auto" style={{ backgroundColor: T.card, borderColor: T.border }} onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[15px] font-medium">📅 {dateLabel}</h3>
                <button onClick={() => setCalDetailDate(null)} className="text-[14px] cursor-pointer p-1" style={{ color: T.textSub, background: "none", border: "none" }}>✕</button>
              </div>

              {/* 出勤情報 */}
              {dShift ? (
                <div className="rounded-xl p-3 mb-3" style={{ backgroundColor: "#e091a810", border: "1px solid #e091a830" }}>
                  <p className="text-[10px] font-medium mb-1" style={{ color: "#e091a8" }}>⏰ 出勤</p>
                  <p className="text-[14px] font-medium">{dShift.start_time?.slice(0,5)} 〜 {dShift.end_time?.slice(0,5)}</p>
                  {dShift.store_id > 0 && <p className="text-[11px] mt-0.5" style={{ color: T.textMuted }}>{getStoreName(dShift.store_id)}</p>}
                </div>
              ) : (
                <div className="rounded-xl p-3 mb-3" style={{ backgroundColor: T.cardAlt }}>
                  <p className="text-[11px]" style={{ color: T.textFaint }}>出勤予定なし</p>
                </div>
              )}

              {/* 給料明細 */}
              {dSettlement ? (
                <div className="rounded-xl p-3 mb-3" style={{ backgroundColor: "#e8849a10", border: "1px solid #e8849a30" }}>
                  <p className="text-[10px] font-medium mb-2" style={{ color: "#e8849a" }}>💰 清算明細</p>
                  <div className="space-y-1 text-[11px]">
                    <div className="flex justify-between"><span>接客数</span><span className="font-medium">{dSettlement.order_count}件</span></div>
                    <div className="flex justify-between"><span>売上合計</span><span>{fmt(dSettlement.total_sales)}</span></div>
                    <div className="flex justify-between"><span>バック合計</span><span>{fmt(dSettlement.total_back)}</span></div>
                    {dSettlement.adjustment !== 0 && <div className="flex justify-between" style={{ color: dSettlement.adjustment > 0 ? "#22c55e" : "#c45555" }}><span>調整金{dSettlement.adjustment_note ? `（${dSettlement.adjustment_note}）` : ""}</span><span>{dSettlement.adjustment > 0 ? "+" : ""}{fmt(dSettlement.adjustment)}</span></div>}
                    {dSettlement.invoice_deduction > 0 && <div className="flex justify-between" style={{ color: "#c45555" }}><span>インボイス控除</span><span>-{fmt(dSettlement.invoice_deduction)}</span></div>}
                    {dSettlement.withholding_tax > 0 && <div className="flex justify-between" style={{ color: "#c45555" }}><span>源泉徴収</span><span>-{fmt(dSettlement.withholding_tax)}</span></div>}
                    {dSettlement.welfare_fee > 0 && <div className="flex justify-between" style={{ color: "#c45555" }}><span>備品・リネン代</span><span>-{fmt(dSettlement.welfare_fee)}</span></div>}
                    {dSettlement.transport_fee > 0 && <div className="flex justify-between" style={{ color: "#22c55e" }}><span>交通費（実費精算）</span><span>+{fmt(dSettlement.transport_fee)}</span></div>}
                    <div className="flex justify-between pt-1.5 font-bold text-[13px]" style={{ borderTop: `1px solid #e8849a30`, color: "#e8849a" }}><span>支給額</span><span>{fmt(dSettlement.final_payment)}</span></div>
                    <div className="flex items-center gap-3 pt-1 text-[9px]" style={{ color: T.textMuted }}>
                      <span>💴現金 {fmt(dSettlement.total_cash)}</span>
                      {dSettlement.total_card > 0 && <span>💳カード {fmt(dSettlement.total_card)}</span>}
                      {dSettlement.total_paypay > 0 && <span>📱PayPay {fmt(dSettlement.total_paypay)}</span>}
                    </div>
                  </div>
                </div>
              ) : dShift && calDetailDate < today ? (
                <div className="rounded-xl p-3 mb-3" style={{ backgroundColor: "#f59e0b10", border: "1px solid #f59e0b30" }}>
                  <p className="text-[11px] font-medium" style={{ color: "#f59e0b" }}>⚠ 未清算</p>
                </div>
              ) : null}

              {/* お客様情報 */}
              {dRes.length > 0 ? (
                <div className="rounded-xl border overflow-hidden mb-3" style={{ borderColor: T.border }}>
                  <div className="px-3 py-2" style={{ backgroundColor: T.cardAlt }}>
                    <p className="text-[10px] font-medium" style={{ color: "#22c55e" }}>👤 接客情報（{dRes.length}件）</p>
                  </div>
                  {dRes.map((r, i) => {
                    const note = customerNotes.find(n => n.reservation_id === r.id) || customerNotes.find(n => n.customer_name === r.customer_name && !n.reservation_id);
                    const isNg = customerNotes.some(n => n.customer_name === r.customer_name && n.is_ng);
                    return (
                      <div key={r.id} className="px-3 py-2.5" style={{ borderTop: i > 0 ? `1px solid ${T.border}` : "none" }}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[12px] font-medium">{r.customer_name}</span>
                            {isNg && <span className="text-[8px] px-1 py-0.5 rounded" style={{ backgroundColor: "#c4555518", color: "#c45555" }}>🚫NG</span>}
                            {note && note.rating > 0 && <span className="text-[9px]" style={{ color: "#f59e0b" }}>{"★".repeat(note.rating)}{"☆".repeat(5 - note.rating)}</span>}
                          </div>
                          <span className="text-[11px] font-medium" style={{ color: "#e8849a" }}>{fmt(r.total_price)}</span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] flex-wrap" style={{ color: T.textSub }}>
                          <span>🕐 {r.start_time?.slice(0,5)}〜{r.end_time?.slice(0,5)}</span>
                          <span>📋 {r.course}</span>
                        </div>
                        <div className="flex items-center gap-2 text-[9px] flex-wrap mt-0.5" style={{ color: T.textMuted }}>
                          {r.nomination && <span style={{ color: "#e8849a" }}>指名: {r.nomination}（{fmt(r.nomination_fee)}）</span>}
                          {r.options_text && <span style={{ color: "#e091a8" }}>OP: {r.options_text}</span>}
                          {r.extension_name && <span style={{ color: "#a855f7" }}>延長: {r.extension_name}</span>}
                          {(r as any).discount_name && <span style={{ color: "#c45555" }}>割引: {(r as any).discount_name}</span>}
                        </div>
                        <div className="flex items-center gap-2 text-[9px] flex-wrap mt-0.5" style={{ color: T.textMuted }}>
                          {(r as any).card_billing > 0 && <span style={{ color: "#e091a8" }}>💳{fmt((r as any).card_billing)}</span>}
                          {(r as any).paypay_amount > 0 && <span style={{ color: "#22c55e" }}>📱{fmt((r as any).paypay_amount)}</span>}
                          {(r as any).cash_amount > 0 && <span>💴{fmt((r as any).cash_amount)}</span>}
                        </div>
                        {(() => {
                          const courseBack = coursesMaster.find(c => c.name === r.course)?.therapist_back || 0;
                          const nomBack = r.nomination ? (nomsMaster.find(n => n.name === r.nomination)?.back_amount || 0) : 0;
                          const optNames = r.options_text ? r.options_text.split(",").filter(Boolean) : [];
                          const optBack = optNames.reduce((s, n) => s + (optsMaster.find(o => o.name === n)?.therapist_back || 0), 0);
                          const extBack = r.extension_name ? (extsMaster.find(e => e.name === r.extension_name)?.therapist_back || 0) : 0;
                          const totalBack = courseBack + nomBack + optBack + extBack;
                          return (
                          <div className="text-[9px] mt-1 px-2 py-1.5 rounded space-y-0.5" style={{ backgroundColor: "#7ab88f10", border: "1px solid #7ab88f20" }}>
                            <div className="flex items-center justify-between"><span style={{ color: "#7ab88f" }}>💵 バック詳細</span><span className="font-medium" style={{ color: "#7ab88f" }}>合計 {fmt(totalBack)}</span></div>
                            <div className="flex justify-between"><span>コースバック（{r.course}）</span><span style={{ color: "#7ab88f" }}>{fmt(courseBack)}</span></div>
                            {r.nomination && <div className="flex justify-between"><span>指名バック（{r.nomination}）</span><span style={{ color: "#e8849a" }}>+{fmt(nomBack)}</span></div>}
                            {optNames.length > 0 && optNames.map((n, oi) => { const ob = optsMaster.find(o => o.name === n)?.therapist_back || 0; return <div key={oi} className="flex justify-between"><span>OPバック（{n}）</span><span style={{ color: "#e091a8" }}>+{fmt(ob)}</span></div>; })}
                            {r.extension_name && <div className="flex justify-between"><span>延長バック（{r.extension_name}）</span><span style={{ color: "#a855f7" }}>+{fmt(extBack)}</span></div>}
                          </div>
                        ); })()}
                        {note && note.note && (
                          <div className="mt-1 px-2 py-1 rounded text-[9px]" style={{ backgroundColor: "#e8849a10", color: "#e8849a" }}>
                            📝 {note.note}
                          </div>
                        )}
                        {note?.is_ng && note.ng_reason && (
                          <div className="mt-0.5 px-2 py-1 rounded text-[9px]" style={{ backgroundColor: "#c4555510", color: "#c45555" }}>
                            🚫 NG理由: {note.ng_reason}
                          </div>
                        )}
                        <div className="flex gap-1 mt-1.5">
                          <button onClick={(e) => { e.stopPropagation(); if (note) { setNoteForm({ customer_name: note.customer_name, note: note.note, is_ng: note.is_ng, ng_reason: note.ng_reason, rating: note.rating || 0, reservation_id: note.reservation_id || r.id }); } else { setNoteForm({ customer_name: r.customer_name, note: "", is_ng: false, ng_reason: "", rating: 0, reservation_id: r.id }); } setCalDetailDate(null); setShowAddNote(true); }}
                            className="px-2 py-1 text-[9px] rounded cursor-pointer" style={{ backgroundColor: "#e8849a18", color: "#e8849a" }}>
                            {note ? "✏️ メモ編集" : "📝 メモ追加"}
                          </button>
                          {note && <button onClick={(e) => { e.stopPropagation(); deleteCustomerNote(note.id); }}
                            className="px-2 py-1 text-[9px] rounded cursor-pointer" style={{ backgroundColor: "#c4555518", color: "#c45555" }}>🗑 削除</button>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : dShift ? (
                <div className="rounded-xl p-3 mb-3" style={{ backgroundColor: T.cardAlt }}>
                  <p className="text-[11px]" style={{ color: T.textFaint }}>接客情報なし</p>
                </div>
              ) : null}

              <button onClick={() => setCalDetailDate(null)}
                className="w-full py-2.5 text-[11px] rounded-xl cursor-pointer border" style={{ borderColor: T.border, color: T.textSub }}>閉じる</button>
            </div>
          </div>
        );
      })()}

      {/* お客様接客履歴モーダル */}
      {/* ── 証明書発行タブ ── */}
      {tab === "cert" && therapist && (
        <div className="space-y-4">
          <h2 className="text-[14px] font-medium">📄 証明書発行</h2>
          <p className="text-[11px]" style={{ color: T.textMuted }}>お店が公式に発行する証明書です。以下の書類をPDFで即座に発行できます。</p>

          {/* 証明書の種類と用途 */}
          {[
            { icon: "📝", title: "業務委託契約証明書", sub: "在籍証明", color: "#2563eb", type: "contract" as const,
              uses: ["🏠 賃貸マンション・アパートの契約", "👶 保育園・学童の就労証明", "💳 クレジットカードの申込", "📱 携帯電話の分割払い契約"],
              merit: "「どこで働いているか」を証明する書類です。フリーランスは会社員と違って在籍証明が取りにくいですが、この証明書があれば賃貸審査もスムーズに通ります。" },
            { icon: "💰", title: "報酬支払証明書", sub: "収入証明", color: "#06b6d4", type: "payment" as const,
              uses: ["🏦 住宅ローン・カーローンの審査", "💳 クレジットカードの限度額アップ", "🏥 児童手当・医療費助成の申請", "📋 奨学金の保護者収入証明"],
              merit: "「年間いくら稼いでいるか」を月別内訳つきで証明します。収入が安定していることを金融機関に示せるので、ローン審査の通過率が上がります。" },
            { icon: "📊", title: "取引実績証明書", sub: "実績証明", color: "#7c3aed", type: "transaction" as const,
              uses: ["📑 確定申告の補助資料", "🏦 事業融資・小規模企業共済の申請", "💰 補助金・助成金の申請", "📋 開業届・青色申告の添付資料"],
              merit: "「どれだけ継続的に仕事をしているか」を証明します。月平均取引額や取引月数が記載されるので、安定した事業実績のアピールに使えます。" },
          ].map((cert, i) => (
            <div key={i} className="rounded-2xl border overflow-hidden" style={{ backgroundColor: T.card, borderColor: T.border }}>
              <div className="px-4 py-3 flex items-center gap-3" style={{ borderBottom: `1px solid ${T.border}` }}>
                <span className="text-[18px]">{cert.icon}</span>
                <div className="flex-1">
                  <p className="text-[13px] font-medium">{cert.title}</p>
                  <p className="text-[10px]" style={{ color: cert.color }}>{cert.sub}</p>
                </div>
              </div>
              <div className="px-4 py-3">
                <p className="text-[11px] mb-3" style={{ color: T.textMuted, lineHeight: 1.8 }}>{cert.merit}</p>
                <p className="text-[10px] font-medium mb-2">こんな時に使えます</p>
                <div className="grid grid-cols-2 gap-1 mb-3">
                  {cert.uses.map((u, j) => <p key={j} className="text-[10px]" style={{ color: T.textMuted }}>{u}</p>)}
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
                  }} className="w-full py-2.5 rounded-xl text-[11px] font-medium cursor-pointer" style={{ backgroundColor: cert.color + "12", color: cert.color, border: `1px solid ${cert.color}30` }}>
                    {cert.icon} この証明書を発行する
                  </button>
                ) : (
                  <div className="w-full py-2.5 rounded-xl text-[11px] text-center" style={{ backgroundColor: "#88878010", color: "#888780", border: "1px solid #88878020" }}>
                    発行条件を満たすと発行できます ↓
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* 発行条件 */}
          <div className="rounded-2xl border p-4" style={{ backgroundColor: T.card, borderColor: T.border }}>
            <p className="text-[12px] font-medium mb-3">✅ 発行条件</p>
            <p className="text-[10px] mb-3" style={{ color: T.textMuted }}>以下の条件をすべて満たすと、証明書を自分で発行できるようになります。</p>
            <div className="space-y-2">
              {certChecks.map((c, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-xl" style={{ backgroundColor: c.ok ? "#22c55e06" : "#c4555506", border: `1px solid ${c.ok ? "#22c55e15" : "#c4555515"}` }}>
                  <span className="text-[14px]">{c.ok ? "✅" : "⬜"}</span>
                  <div className="flex-1">
                    <p className="text-[11px] font-medium" style={{ color: c.ok ? "#22c55e" : T.text }}>{c.label}</p>
                    {!c.ok && i === 0 && <p className="text-[9px]" style={{ color: "#c45555" }}>身分証はスタッフに提出してください</p>}
                    {!c.ok && i === 1 && <p className="text-[9px]" style={{ color: "#c45555" }}>契約書のリンクをスタッフからもらってください</p>}
                    {!c.ok && i === 2 && <p className="text-[9px]" style={{ color: "#c45555" }}>スタッフに本名を伝えてください</p>}
                    {!c.ok && i === 3 && <p className="text-[9px]" style={{ color: "#c45555" }}>スタッフに住所を伝えてください</p>}
                    {!c.ok && i === 4 && <p className="text-[9px]" style={{ color: "#c45555" }}>出勤を重ねると条件を達成できます</p>}
                  </div>
                </div>
              ))}
            </div>
            {certEligible && (
              <div className="mt-3 px-3 py-2 rounded-xl text-center" style={{ backgroundColor: "#22c55e0c", border: "1px solid #22c55e20" }}>
                <p className="text-[11px] font-medium" style={{ color: "#22c55e" }}>🎉 すべての条件を満たしています！上の証明書を発行できます。</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── 確定申告サポートタブ ── */}
      {tab === "tax" && therapist && (
        <div className="space-y-4">
          <h2 className="text-[14px] font-medium">📊 確定申告サポート</h2>
          <div className="flex gap-2">
            <button onClick={() => setTaxSubTab("support")} className="flex-1 py-2.5 text-[11px] rounded-xl cursor-pointer border"
              style={{ backgroundColor: taxSubTab === "support" ? "#e8849a20" : "transparent", color: taxSubTab === "support" ? "#e8849a" : T.textMuted, borderColor: taxSubTab === "support" ? "#e8849a" : T.border, fontWeight: taxSubTab === "support" ? 600 : 400 }}>
              📊 申告サポート
            </button>
            <button onClick={() => setTaxSubTab("ledger")} className="flex-1 py-2.5 text-[11px] rounded-xl cursor-pointer border"
              style={{ backgroundColor: taxSubTab === "ledger" ? "#22c55e20" : "transparent", color: taxSubTab === "ledger" ? "#22c55e" : T.textMuted, borderColor: taxSubTab === "ledger" ? "#22c55e" : T.border, fontWeight: taxSubTab === "ledger" ? 600 : 400 }}>
              📒 帳簿・経費管理
            </button>
          </div>
          {taxSubTab === "support" && <TaxSupportWizard T={T} therapistId={therapist.id} onGoToLedger={() => setTaxSubTab("ledger")} />}
          {taxSubTab === "ledger" && <TaxBookkeeping T={T} therapistId={therapist.id} />}
        </div>
      )}

      {/* お客様接客履歴モーダル（元の位置） */}
      {noteHistoryCustomer && (<div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setNoteHistoryCustomer("")}><div className="rounded-2xl border w-full max-w-sm max-h-[85vh] overflow-hidden flex flex-col" style={{ backgroundColor: T.card, borderColor: T.border }} onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: `1px solid ${T.border}` }}>
          <div>
            <h3 className="text-[14px] font-medium">{noteHistoryCustomer}</h3>
            <p className="text-[9px] mt-0.5" style={{ color: T.textFaint }}>接客を選んでメモを追加できます</p>
          </div>
          <button onClick={() => setNoteHistoryCustomer("")} className="text-[14px] cursor-pointer p-1" style={{ color: T.textSub }}>✕</button>
        </div>
        {/* NG管理エリア */}
        {(() => { const isNg = customerNotes.some(n => n.customer_name === noteHistoryCustomer && n.is_ng); return (
          <div className="px-5 py-2 flex items-center justify-between" style={{ borderBottom: `1px solid ${T.border}`, backgroundColor: isNg ? "#c4555508" : "transparent" }}>
            <div className="flex items-center gap-2">
              {isNg && <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "#c4555518", color: "#c45555" }}>🚫 NG登録済み</span>}
            </div>
            <button onClick={() => {
              const ngNote = customerNotes.find(n => n.customer_name === noteHistoryCustomer && !n.reservation_id);
              setNoteForm({ customer_name: noteHistoryCustomer, note: ngNote?.note || "", is_ng: ngNote?.is_ng || false, ng_reason: ngNote?.ng_reason || "", rating: ngNote?.rating || 0, reservation_id: 0 });
              setNoteHistoryCustomer(""); setShowAddNote(true);
            }} className="text-[9px] cursor-pointer px-2 py-1 rounded-lg" style={{ color: isNg ? "#c45555" : T.textMuted, backgroundColor: isNg ? "#c4555510" : T.cardAlt }}>
              {isNg ? "🚫 NG編集" : "⚙️ NG管理"}
            </button>
          </div>
        ); })()}
        {/* 接客履歴一覧 */}
        <div className="overflow-y-auto flex-1 px-5 py-3">
          {/* 旧形式メモ（reservation_idなし）表示 */}
          {(() => { const generalNotes = customerNotes.filter(n => n.customer_name === noteHistoryCustomer && !n.reservation_id && n.note); return generalNotes.length > 0 ? (
            <div className="mb-3">
              <p className="text-[10px] font-medium mb-2" style={{ color: "#e8849a" }}>📝 過去のメモ</p>
              {generalNotes.map(n => (
                <div key={n.id} className="rounded-lg px-3 py-2 mb-1.5" style={{ backgroundColor: "#e8849a08", border: "1px solid #e8849a20" }}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      {n.rating > 0 && <span className="text-[9px]" style={{ color: "#f59e0b" }}>{"★".repeat(n.rating)}{"☆".repeat(5 - n.rating)}</span>}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => { setNoteForm({ customer_name: n.customer_name, note: n.note, is_ng: n.is_ng, ng_reason: n.ng_reason, rating: n.rating || 0, reservation_id: 0 }); setNoteHistoryCustomer(""); setShowAddNote(true); }} className="text-[9px] cursor-pointer px-1.5 py-0.5 rounded" style={{ color: "#e8849a", backgroundColor: "#e8849a15" }}>✏️ 編集</button>
                      <button onClick={async () => { const ok = await confirm({ title: "このメモを削除しますか？", variant: "danger", confirmLabel: "削除する" }); if (ok) { await supabase.from("therapist_customer_notes").delete().eq("id", n.id); await fetchData(); } }} className="text-[9px] cursor-pointer px-1.5 py-0.5 rounded" style={{ color: "#c45555", backgroundColor: "#c4555510" }}>🗑</button>
                    </div>
                  </div>
                  <p className="text-[10px] whitespace-pre-wrap leading-relaxed" style={{ color: T.textSub }}>{n.note}</p>
                </div>
              ))}
            </div>
          ) : null; })()}
          <p className="text-[10px] font-medium mb-2" style={{ color: T.textMuted }}>接客履歴</p>
          {(() => {
            const hist = allReservations.filter(r => r.customer_name === noteHistoryCustomer);
            if (hist.length === 0) return <p className="text-[11px] text-center py-6" style={{ color: T.textFaint }}>接客履歴がありません</p>;
            return hist.map(r => {
              const dateStr = (() => { const dt = new Date(r.date + "T00:00:00"); const days = ["日","月","火","水","木","金","土"]; return `${dt.getMonth()+1}/${dt.getDate()}(${days[dt.getDay()]})`; })();
              const resNote = customerNotes.find(n => n.reservation_id === r.id);
              return (
                <div key={r.id} className="rounded-xl border p-3 mb-2" style={{ borderColor: resNote ? "#e8849a44" : T.border, backgroundColor: resNote ? "#e8849a08" : T.cardAlt }}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[12px] font-medium">{dateStr}</span>
                    <span className="text-[10px]" style={{ color: T.textMuted }}>{r.start_time?.slice(0,5)}〜{r.end_time?.slice(0,5)}</span>
                  </div>
                  <p className="text-[10px]" style={{ color: T.textSub }}>{r.course}{r.nomination ? ` ⭐${r.nomination}` : ""}</p>
                  {resNote ? (
                    <div className="mt-1.5">
                      <div className="rounded-lg px-2.5 py-2" style={{ backgroundColor: "#e8849a10", border: "1px solid #e8849a20" }}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px] font-medium" style={{ color: "#e8849a" }}>📝 メモ</span>
                            {resNote.rating > 0 && <span className="text-[9px]" style={{ color: "#f59e0b" }}>{"★".repeat(resNote.rating)}{"☆".repeat(5 - resNote.rating)}</span>}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button onClick={() => { setNoteForm({ customer_name: resNote.customer_name, note: resNote.note, is_ng: resNote.is_ng, ng_reason: resNote.ng_reason, rating: resNote.rating || 0, reservation_id: r.id }); setNoteHistoryCustomer(""); setShowAddNote(true); }} className="text-[9px] cursor-pointer px-1.5 py-0.5 rounded" style={{ color: "#e8849a", backgroundColor: "#e8849a15" }}>✏️ 編集</button>
                            <button onClick={async () => { const ok = await confirm({ title: "このメモを削除しますか？", variant: "danger", confirmLabel: "削除する" }); if (ok) { await supabase.from("therapist_customer_notes").delete().eq("id", resNote.id); await fetchData(); } }} className="text-[9px] cursor-pointer px-1.5 py-0.5 rounded" style={{ color: "#c45555", backgroundColor: "#c4555510" }}>🗑</button>
                          </div>
                        </div>
                        {resNote.note && <p className="text-[10px] whitespace-pre-wrap leading-relaxed" style={{ color: T.textSub }}>{resNote.note}</p>}
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => {
                      setNoteForm({ customer_name: noteHistoryCustomer, note: "", is_ng: false, ng_reason: "", rating: 0, reservation_id: r.id });
                      setNoteHistoryCustomer(""); setShowAddNote(true);
                    }} className="mt-1.5 w-full py-1.5 text-[10px] rounded-lg cursor-pointer font-medium" style={{ backgroundColor: "#e8849a15", color: "#e8849a", border: "1px solid #e8849a30" }}>
                      📝 メモを追加
                    </button>
                  )}
                </div>
              );
            });
          })()}
        </div>
        <div className="px-5 py-3" style={{ borderTop: `1px solid ${T.border}` }}>
          <button onClick={() => setNoteHistoryCustomer("")} className="w-full py-2 border text-[10px] rounded-xl cursor-pointer" style={{ borderColor: T.border, color: T.textSub }}>閉じる</button>
        </div>
      </div></div>)}

      {noteViewTarget && (<div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setNoteViewTarget(null)}><div className="rounded-2xl border p-5 w-full max-w-sm" style={{ backgroundColor: T.card, borderColor: T.border }} onClick={(e) => e.stopPropagation()}>
        <h3 className="text-[14px] font-medium mb-1">{noteViewTarget.customer_name}</h3>
        {noteViewTarget.is_ng && <p className="text-[10px] mb-2" style={{ color: "#c45555" }}>🚫 NG登録済み{noteViewTarget.ng_reason ? `（${noteViewTarget.ng_reason}）` : ""}</p>}{noteViewTarget.rating > 0 && <p className="text-[12px] mb-2" style={{ color: "#f59e0b" }}>{"★".repeat(noteViewTarget.rating)}{"☆".repeat(5 - noteViewTarget.rating)} <span className="text-[10px]">{noteViewTarget.rating}/5</span></p>}
        <div className="rounded-xl p-3 mb-3" style={{ backgroundColor: T.cardAlt }}><p className="text-[10px] font-medium mb-1" style={{ color: T.textMuted }}>メモ</p><p className="text-[12px] whitespace-pre-wrap">{noteViewTarget.note || "メモなし"}</p></div>
        {(() => { const hist = allReservations.filter(r => r.customer_name === noteViewTarget.customer_name).slice(0, 10); if (hist.length === 0) return null; return (<div className="rounded-xl p-3 mb-3" style={{ backgroundColor: T.cardAlt }}><p className="text-[10px] font-medium mb-1" style={{ color: T.textMuted }}>接客履歴（直近{hist.length}件）</p>{hist.map(r => (<div key={r.id} className="flex items-center justify-between py-1 text-[10px]" style={{ borderBottom: `1px solid ${T.border}` }}><span>{formatDate(r.date)} {r.start_time?.slice(0,5)}</span><span style={{ color: T.textSub }}>{r.course}</span></div>))}</div>); })()}
        <div className="flex gap-2"><button onClick={() => { setNoteForm({ customer_name: noteViewTarget.customer_name, note: noteViewTarget.note, is_ng: noteViewTarget.is_ng, ng_reason: noteViewTarget.ng_reason, rating: noteViewTarget.rating || 0, reservation_id: noteViewTarget.reservation_id || 0 }); setNoteViewTarget(null); setShowAddNote(true); }} className="px-4 py-2 text-[11px] rounded-xl cursor-pointer text-white" style={{ background: "linear-gradient(135deg, #e8849a, #d4687e)" }}>✏️ メモ編集</button><button onClick={() => setNoteViewTarget(null)} className="px-4 py-2 border text-[11px] rounded-xl cursor-pointer" style={{ borderColor: T.border, color: T.textSub }}>閉じる</button></div>
      </div></div>)}

      {showAddNote && (<div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowAddNote(false)}><div className="rounded-2xl border p-5 w-full max-w-sm" style={{ backgroundColor: T.card, borderColor: T.border }} onClick={(e) => e.stopPropagation()}>
        <h3 className="text-[14px] font-medium mb-4">📝 お客様メモ</h3>
        <div className="space-y-3">
          <div><label className="block text-[10px] mb-1" style={{ color: T.textSub }}>お客様名</label><input type="text" value={noteForm.customer_name} onChange={(e) => setNoteForm({ ...noteForm, customer_name: e.target.value })} readOnly={!!customerNotes.find(n => n.customer_name === noteForm.customer_name)} placeholder="お客様名" className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={{ backgroundColor: T.cardAlt, color: T.text, border: "1px solid transparent" }} /></div>
          <div><label className="block text-[10px] mb-1" style={{ color: T.textSub }}>メモ</label><textarea value={noteForm.note} onChange={(e) => setNoteForm({ ...noteForm, note: e.target.value })} placeholder="お客様についてのメモ" rows={4} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none resize-y" style={{ backgroundColor: T.cardAlt, color: T.text, border: "1px solid transparent" }} /></div>
          <div className="flex items-center gap-1.5">
                <button onClick={() => { const now = new Date(); const ds = `${now.getMonth()+1}/${now.getDate()} ${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`; setNoteForm({ ...noteForm, note: noteForm.note + (noteForm.note ? "\n" : "") + `[${ds}] ` }); }}
                  className="px-2.5 py-1.5 text-[10px] rounded-lg cursor-pointer border" style={{ borderColor: "#e091a844", color: "#e091a8" }}>📅 日時挿入</button>
              </div>
              <div>
                <label className="block text-[10px] mb-1" style={{ color: T.textSub }}>お客様評価</label>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map(s => (
                    <button key={s} onClick={() => setNoteForm({ ...noteForm, rating: noteForm.rating === s ? 0 : s })}
                      className="text-[20px] cursor-pointer" style={{ background: "none", border: "none", padding: 0, color: s <= noteForm.rating ? "#f59e0b" : T.textFaint }}>
                      {s <= noteForm.rating ? "★" : "☆"}
                    </button>
                  ))}
                  {noteForm.rating > 0 && <span className="text-[10px] ml-1" style={{ color: "#f59e0b" }}>{noteForm.rating}/5</span>}
                </div>
              </div>
          <div className="flex items-center gap-3"><button onClick={() => setNoteForm({ ...noteForm, is_ng: !noteForm.is_ng })} className="px-4 py-2 rounded-xl text-[11px] cursor-pointer border" style={chipStyle(noteForm.is_ng, "#c45555")}>{noteForm.is_ng ? "🚫 NG登録あり" : "NG登録なし"}</button></div>
          {noteForm.is_ng && (<div><label className="block text-[10px] mb-1" style={{ color: T.textSub }}>NG理由</label><input type="text" value={noteForm.ng_reason} onChange={(e) => setNoteForm({ ...noteForm, ng_reason: e.target.value })} placeholder="理由を入力" className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={{ backgroundColor: T.cardAlt, color: T.text, border: "1px solid transparent" }} /></div>)}
          <div className="flex gap-3 pt-2"><button onClick={saveCustomerNote} className="px-5 py-2.5 text-white text-[11px] rounded-xl cursor-pointer" style={{ background: "linear-gradient(135deg, #e8849a, #d4687e)" }}>保存</button><button onClick={() => setShowAddNote(false)} className="px-5 py-2.5 border text-[11px] rounded-xl cursor-pointer" style={{ borderColor: T.border, color: T.textSub }}>キャンセル</button></div>
        </div>
      </div></div>)}

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
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-full cursor-pointer"
              style={{ background: "linear-gradient(135deg, #e8849a, #d4687e)", boxShadow: "0 4px 20px rgba(232,132,154,0.5)", border: "none", color: "#fff" }}>
              <span className="text-[16px]">{aiChatOpenG ? "✕" : "🤖"}</span>
              <span className="text-[11px] font-bold">{aiChatOpenG ? "閉じる" : "AI Chat"}</span>
            </button>
          </div>

          {/* チャットウィンドウ */}
          {aiChatOpenG && (
            <div className="fixed bottom-4 right-4 w-[calc(100%-32px)] max-w-sm rounded-2xl overflow-hidden z-40 flex flex-col"
              style={{ backgroundColor: T.card, border: `1px solid ${T.border}`, boxShadow: "0 8px 30px rgba(0,0,0,0.25)", maxHeight: "65vh" }}>
              <div className="px-4 py-3 flex items-center justify-between" style={{ background: "linear-gradient(135deg, #e8849a, #d4687e)" }}>
                <div>
                  <p className="text-[12px] font-bold text-white">🤖 {chatTitle}</p>
                  <p className="text-[8px] text-white/70">{chatHint}なんでも聞いてね</p>
                </div>
                <button onClick={() => setAiChatOpenG(false)} className="text-white text-[16px] cursor-pointer" style={{ background: "none", border: "none" }}>✕</button>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-2" style={{ minHeight: "200px", maxHeight: "45vh" }}>
                {aiChatMsgsG.length === 0 && (
                  <div className="text-center py-4">
                    <p className="text-[20px] mb-2">🌸</p>
                    <p className="text-[11px]" style={{ color: T.textSub }}>{chatHint}なんでも聞いてください！</p>
                    <div className="mt-3 space-y-1">
                      {suggestions.map((q, i) => (
                        <button key={i} onClick={() => setAiChatInputG(q)} className="block w-full text-left px-3 py-2 rounded-xl text-[10px] cursor-pointer"
                          style={{ backgroundColor: T.cardAlt, color: "#e8849a", border: "1px solid #e8849a33" }}>{q}</button>
                      ))}
                    </div>
                  </div>
                )}
                {aiChatMsgsG.map((m, i) => (
                  <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className="max-w-[85%] rounded-2xl px-3 py-2" style={{
                      backgroundColor: m.role === "user" ? "#e8849a" : T.cardAlt,
                      color: m.role === "user" ? "#fff" : T.text,
                      borderBottomRightRadius: m.role === "user" ? "4px" : "16px",
                      borderBottomLeftRadius: m.role === "user" ? "16px" : "4px",
                    }}>
                      <p className="text-[10px] whitespace-pre-wrap leading-relaxed">{m.text}</p>
                      {m.cached && <p className="text-[7px] mt-0.5" style={{ color: m.role === "user" ? "#fff8" : T.textFaint }}>⚡ キャッシュ回答</p>}
                    </div>
                  </div>
                ))}
                {aiChatLoadingG && (
                  <div className="flex justify-start"><div className="rounded-2xl px-3 py-2" style={{ backgroundColor: T.cardAlt }}>
                    <p className="text-[10px] animate-pulse" style={{ color: "#e8849a" }}>🤖 考え中...</p>
                  </div></div>
                )}
              </div>
              <div className="p-2 flex gap-2" style={{ borderTop: `1px solid ${T.border}` }}>
                <input type="text" value={aiChatInputG} onChange={e => setAiChatInputG(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") sendMsg(); }}
                  placeholder="質問を入力..." className="flex-1 px-3 py-2 rounded-xl text-[11px] outline-none"
                  style={{ backgroundColor: T.cardAlt, color: T.text, border: `1px solid ${T.border}` }} />
                <button onClick={sendMsg} className="px-3 py-2 rounded-xl text-[11px] cursor-pointer"
                  style={{ background: "linear-gradient(135deg, #e8849a, #d4687e)", color: "#fff", border: "none" }}>送信</button>
              </div>
            </div>
          )}
        </>);
      })()}
    </div>
  );
}
