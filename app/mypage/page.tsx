"use client";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "../../lib/supabase";
import { useConfirm } from "../../components/useConfirm";
import PushToggle from "../../components/PushToggle";
import InstallPrompt from "../../components/InstallPrompt";
import { fetchActiveEvents, formatEventPeriod, type Event as EventItem } from "../../lib/events";
import {
  IconHome, IconCalendar, IconHeart, IconBell, IconSettings,
  IconUser, IconPhone, IconClock, IconMapPin, IconCheck, IconClose,
  IconEdit, IconWarning, IconLogout, IconArrowRight, IconSparkle,
  IconCard, IconCamera,
  StarRating, BellWithBadge,
} from "../../components/mypage/Icon";
import CustomerDiaryTab from "../../components/mypage/CustomerDiaryTab";

type Customer = { id: number; name: string; self_name: string; phone: string; phone2: string; phone3: string; email: string; notes: string; rank: string; login_email: string; login_password: string; created_at: string; birthday: string; survey_opt_out?: boolean };
type Reservation = { id: number; customer_name: string; therapist_id: number; date: string; start_time: string; end_time: string; course: string; notes: string; total_price: number; status: string; nomination: string; nomination_fee: number; options_text: string; extension_name: string; extension_price: number; discount_name: string; discount_amount: number; card_base: number; paypay_amount: number; cash_amount: number; free_building_id?: number; point_used?: number };
type Therapist = { id: number; name: string; age: number; height_cm: number; bust: number; waist: number; hip: number; cup: string; photo_url: string; status: string };
type Course = { id: number; name: string; duration: number; price: number; description: string };
type Store = { id: number; name: string };
type Shift = { id: number; therapist_id: number; date: string; start_time: string; end_time: string; store_id: number; status: string };
type Favorite = { id: number; customer_id: number; type: string; item_id: number; created_at: string };
type PointRecord = { id: number; customer_id: number; amount: number; type: string; description: string; expires_at: string; created_at: string };
type Notification = { id: number; title: string; body: string; type: string; image_url: string; target_customer_id: number | null; created_at: string };
type CardInfo = { id: number; customer_id: number; brand: string; last4: string; holder_name: string; exp_month: number; exp_year: number; is_default: boolean; created_at: string };
type Nomination = { id: number; name: string; price: number };
type Discount = { id: number; name: string; amount: number; type: string };
type Extension = { id: number; name: string; duration: number; price: number };
type Option = { id: number; name: string; price: number };
type Building = { id: number; store_id: number; name: string };
type Room = { id: number; store_id: number; building_id: number; name: string };
type CustomerTherapistMemo = { id: number; customer_id: number; therapist_id: number; reservation_id: number; rating: number; memo: string; created_at: string; updated_at: string };

const fmt = (n: number) => "¥" + (n || 0).toLocaleString();
const normPhone = (p: string) => p.replace(/[-\s\u3000()（）\u2010-\u2015\uff0d]/g, "");
// HP（site-theme）と統一感を持たせたカラーパレット
// ピンク基調 + ホワイト背景 + 明朝見出し
const C = {
  bg:         "#ffffff",   // ベース白
  card:       "#ffffff",   // カード白
  cardAlt:    "#faf6f1",   // サブカード（ごく淡いクリーム）
  border:     "#e5ded6",   // HP罫線と同じ
  borderPink: "#ead3da",   // ピンク寄りの罫線
  accent:     "#e8849a",   // ブランドピンク（HPと同じ）
  accentDark: "#c96b83",   // 濃ピンク
  accentBg:   "#f7e3e7",   // 淡ピンク（HPのpinkSoft）
  text:       "#2b2b2b",   // HPのtext
  textSub:    "#555555",
  textMuted:  "#8a8a8a",
  textFaint:  "#b5b5b5",
  green:      "#6b9b7e",   // 成功（少し落ち着いた緑）
  red:        "#c96b83",   // 警告もピンク系に寄せる
  blue:       "#6b8ba8",   // 補助情報
};
const FONT_SERIF = "'Noto Serif JP', 'Yu Mincho', 'Hiragino Mincho ProN', serif";
const FONT_DISPLAY = "'Cormorant Garamond', 'Noto Serif JP', 'Yu Mincho', serif";
const NOTI_ICONS: Record<string, string> = { news: "📢", new_therapist: "🌟", campaign: "🎉" };
const NOTI_LABELS: Record<string, string> = { news: "お知らせ", new_therapist: "新人紹介", campaign: "キャンペーン" };
const timeToMin = (t: string) => { const [h, m] = t.split(":").map(Number); return (h < 9 ? h + 24 : h) * 60 + m; };
const minToTime = (m: number) => { const h = Math.floor(m / 60); const mi = m % 60; return `${String(h >= 24 ? h - 24 : h).padStart(2, "0")}:${String(mi).padStart(2, "0")}`; };
const dateFmt = (d: string) => { const dt = new Date(d + "T00:00:00"); const days = ["日", "月", "火", "水", "木", "金", "土"]; return `${dt.getMonth() + 1}/${dt.getDate()}(${days[dt.getDay()]})`; };
const dateNav = (d: string, offset: number) => { const dt = new Date(d + "T00:00:00"); dt.setDate(dt.getDate() + offset); return dt.toISOString().split("T")[0]; };
const getWeekDates = (d: string) => { const dt = new Date(d + "T00:00:00"); const w = dt.getDay(); const mon = new Date(dt); mon.setDate(dt.getDate() - (w === 0 ? 6 : w - 1)); return Array.from({ length: 7 }, (_, i) => { const dd = new Date(mon); dd.setDate(mon.getDate() + i); return dd.toISOString().split("T")[0]; }); };
const timeAgo = (d: string) => { const diff = Date.now() - new Date(d).getTime(); const mins = Math.floor(diff / 60000); if (mins < 60) return `${mins}分前`; const hrs = Math.floor(mins / 60); if (hrs < 24) return `${hrs}時間前`; const ds = Math.floor(hrs / 24); if (ds < 30) return `${ds}日前`; return new Date(d).toLocaleDateString("ja-JP"); };

const linkify = (text: string) => {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  return parts.map((part, i) => urlRegex.test(part) ? <a key={i} href={part} target="_blank" rel="noopener noreferrer" style={{ color: "#6b8ba8", textDecoration: "underline" }}>{part}</a> : part);
};

export default function CustomerMypage() {
  const { confirm, ConfirmModalNode } = useConfirm();
  const [customer, setCustomer] = useState<Customer | null>(null);
  // アンケート: 回答可能な予約と発行済みクーポンを保持（Phase 1B-2）
  const [pendingSurveys, setPendingSurveys] = useState<Array<{
    reservationId: number;
    date: string;
    startTime: string;
    course: string;
    therapistName: string;
  }>>([]);
  const [surveyCoupons, setSurveyCoupons] = useState<Array<{
    id: number;
    code: string;
    discountAmount: number;
    expiresAt: string;
  }>>([]);
  // アンケート履歴（既回答 + クーポン使用状況）
  const [completedSurveys, setCompletedSurveys] = useState<Array<{
    surveyId: number;
    reservationId: number;
    therapistName: string;
    ratingOverall: number;
    submittedAt: string;
    couponCode: string | null;
    couponUsed: boolean;
    couponUsedAt: string | null;
    couponExpiresAt: string | null;
    couponDiscountAmount: number;
  }>>([]);
  const [authMode, setAuthMode] = useState<"login" | "register" | "reset">("login");
  const [authEmail, setAuthEmail] = useState(""); const [authPw, setAuthPw] = useState(""); const [authName, setAuthName] = useState(""); const [authPhone, setAuthPhone] = useState(""); const [authError, setAuthError] = useState(""); const [authLoading, setAuthLoading] = useState(false); const [showPw, setShowPw] = useState(false);
  const [resetPhone, setResetPhone] = useState(""); const [resetMsg, setResetMsg] = useState(""); const [resetDone, setResetDone] = useState(false);
  const [tab, setTab] = useState<"home" | "schedule" | "favorites" | "notifications" | "settings" | "diary">("home");
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [points, setPoints] = useState<PointRecord[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [readNotifIds, setReadNotifIds] = useState<number[]>([]);
  const [cards, setCards] = useState<CardInfo[]>([]);
  const [setEmail, setSetEmail] = useState(""); const [setPw, setSetPw] = useState(""); const [setPwConfirm, setSetPwConfirm] = useState(""); const [settingMsg, setSettingMsg] = useState(""); const [settingSaving, setSettingSaving] = useState(false); const [setBday, setSetBday] = useState(""); const [setSelfN, setSetSelfN] = useState("");
  const [showAddCard, setShowAddCard] = useState(false); const [cardBrand, setCardBrand] = useState("visa"); const [cardLast4, setCardLast4] = useState(""); const [cardHolder, setCardHolder] = useState(""); const [cardExpMonth, setCardExpMonth] = useState(1); const [cardExpYear, setCardExpYear] = useState(new Date().getFullYear());

  // スケジュール
  const [schedDate, setSchedDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [schedView, setSchedView] = useState<"day" | "weekly" | "form" | "history">("day");
  const [schedShifts, setSchedShifts] = useState<Shift[]>([]);
  const [schedRes, setSchedRes] = useState<Reservation[]>([]);
  // 週間
  const [weeklyTid, setWeeklyTid] = useState(0);
  const [weekShifts, setWeekShifts] = useState<Shift[]>([]);
  const [weekRes, setWeekRes] = useState<Reservation[]>([]);
  // 予約フォーム
  const [bookTherapistId, setBookTherapistId] = useState(0);
  const [bookDate, setBookDate] = useState("");
  const [bookTime, setBookTime] = useState("12:00");
  const [bookCourseId, setBookCourseId] = useState(0);
  const [bookStoreId, setBookStoreId] = useState(0);
  const [bookNotes, setBookNotes] = useState("");
  const [bookSaving, setBookSaving] = useState(false);
  const [bookMsg, setBookMsg] = useState("");
  const [bookDiscountId, setBookDiscountId] = useState(0);
  const [bookOptions, setBookOptions] = useState<number[]>([]);
  const [bookExtId, setBookExtId] = useState(0);
  const [bookPointUse, setBookPointUse] = useState(0);
  const [bookDone, setBookDone] = useState(false);
  const [nominations, setNominations] = useState<Nomination[]>([]);
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [extensions, setExtensions] = useState<Extension[]>([]);
  const [optionsList, setOptionsList] = useState<Option[]>([]);
  // ポイント
  const [showPoints, setShowPoints] = useState(false);
  const [rankRules, setRankRules] = useState<{rank_name:string;multiplier:number;min_visits_in_period:number;period_months:number;min_total_visits:number}[]>([]);
  const [recentVisitCount, setRecentVisitCount] = useState(0);
  const [tickerMsgs, setTickerMsgs] = useState<string[]>([]);
  const [ngTherapistIdsForMe, setNgTherapistIdsForMe] = useState<Set<number>>(new Set());
  const [cancelTarget, setCancelTarget] = useState<Reservation | null>(null);
  const [cancelMsg, setCancelMsg] = useState("");
  const [cancelPhone, setCancelPhone] = useState("070-1675-5900");
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [freeMode, setFreeMode] = useState(false); // フリー予約モード
  const [bookFreeBuildingId, setBookFreeBuildingId] = useState<number | null>(null);
  // セラピストメモ（1接客ごと）
  const [customerMemos, setCustomerMemos] = useState<CustomerTherapistMemo[]>([]);
  const [editMemoResId, setEditMemoResId] = useState(0);
  const [editMemoTherapistId, setEditMemoTherapistId] = useState(0);
  const [editMemoRating, setEditMemoRating] = useState(0);
  const [editMemoText, setEditMemoText] = useState("");
  const [memoSaving, setMemoSaving] = useState(false);
  const [showMemoModal, setShowMemoModal] = useState(false);

  // 予約導線（HPセラピスト詳細→空き時間→マイページ）
  // ログイン画面でセラピスト名と日時バナーを表示するための情報
  const [pendingBookInfo, setPendingBookInfo] = useState<{ tid: number; date: string; time: string; therapistName?: string } | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    let raw: string | null = null;
    try { raw = localStorage.getItem("pending_book"); } catch { return; }
    if (!raw) return;
    try {
      const p = JSON.parse(raw) as { tid: number; date: string; time: string };
      if (p.tid && p.date && p.time) {
        setPendingBookInfo(p);
        // セラピスト名を取得（バナー表示用）
        supabase.from("therapists").select("name").eq("id", p.tid).maybeSingle().then(({ data }) => {
          if (data?.name) setPendingBookInfo({ ...p, therapistName: data.name });
        });
      }
    } catch {}
  }, []);

  // イベント（マイページ用に取得・Session 56）
  const [customerEvents, setCustomerEvents] = useState<EventItem[]>([]);

  useEffect(() => { const saved = localStorage.getItem("customer_mypage_id"); if (saved) { supabase.from("customers").select("*").eq("id", Number(saved)).single().then(({ data }) => { if (data) { setCustomer(data); setSetEmail(data.login_email || ""); setSetBday(data.birthday || ""); setSetSelfN(data.self_name || data.name || ""); } }); } }, []);

  // URLパラメータ ?register=1 で登録モードで開く（HPからの会員登録導線）
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("register") === "1") {
      setAuthMode("register");
    }
  }, []);

  // URLパラメータ ?book=THERAPIST_ID&date=YYYY-MM-DD&time=HH:MM で予約導線（HPセラピスト詳細→空き時間タップ）
  // ログイン中: 予約フォームを自動表示
  // 未ログイン: localStorage に保存し、登録画面に切り替えてから登録/ログイン後に自動表示
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const bookId = params.get("book");
    const bookDateP = params.get("date");
    const bookTimeP = params.get("time");
    if (bookId && /^\d+$/.test(bookId) && bookDateP && bookTimeP) {
      try {
        localStorage.setItem(
          "pending_book",
          JSON.stringify({ tid: Number(bookId), date: bookDateP, time: bookTimeP })
        );
      } catch {}
      // 未ログイン時のみ登録モードに（既ログインの場合は別 useEffect で予約フォームを開く）
      const saved = localStorage.getItem("customer_mypage_id");
      if (!saved) setAuthMode("register");
    }
  }, []);

  // イベント取得（ログイン中のみ）
  useEffect(() => {
    if (!customer) return;
    fetchActiveEvents("mypage").then((es) => {
      // members_only を含む形で取得済み。ログイン中なので全部見せてOK
      setCustomerEvents(es);
    });
  }, [customer]);
  useEffect(() => { supabase.from("store_settings").select("value").eq("key", "cancel_phone").maybeSingle().then(({ data }) => { if (data?.value) setCancelPhone(data.value); }); }, []);

  const fetchData = useCallback(async () => {
    if (!customer) return;
    const { data: r } = await supabase.from("reservations").select("*").eq("customer_name", customer.name).order("date", { ascending: false }); if (r) setReservations(r);
    const { data: t } = await supabase.from("therapists").select("id,name,age,height_cm,bust,waist,hip,cup,photo_url,status").eq("status", "active").order("sort_order"); if (t) setTherapists(t);
    const { data: c } = await supabase.from("courses").select("id,name,duration,price,description").order("id"); if (c) setCourses(c);
    const { data: s } = await supabase.from("stores").select("*").order("id"); if (s) setStores(s);
    const { data: f } = await supabase.from("customer_favorites").select("*").eq("customer_id", customer.id).order("created_at", { ascending: false }); if (f) setFavorites(f);
    const { data: rr } = await supabase.from("rank_point_multipliers").select("*").order("min_total_visits", { ascending: true }); if (rr) setRankRules(rr);
    const since3m = new Date(); since3m.setMonth(since3m.getMonth() - 3);
    const { count: rc } = await supabase.from("reservations").select("*", { count: "exact", head: true }).eq("customer_name", customer.name).eq("status", "completed").gte("date", since3m.toISOString().split("T")[0]);
    setRecentVisitCount(rc || 0);
    const { data: p } = await supabase.from("customer_points").select("*").eq("customer_id", customer.id).order("created_at", { ascending: false }); if (p) { setPoints(p); /* 期限切れ間近ポイント通知 */ const { data: ps } = await supabase.from("point_settings").select("expiry_notify_days").limit(1).single(); const notifyDays = ps?.expiry_notify_days || 30; const now = new Date(); const warnDate = new Date(); warnDate.setDate(warnDate.getDate() + notifyDays); const expiringPts = p.filter(pt => pt.amount > 0 && pt.expires_at && new Date(pt.expires_at) > now && new Date(pt.expires_at) <= warnDate); if (expiringPts.length > 0) { const totalExpiring = expiringPts.reduce((s, pt) => s + pt.amount, 0); const nearestExpiry = expiringPts.sort((a, b) => new Date(a.expires_at).getTime() - new Date(b.expires_at).getTime())[0]; const expiryStr = new Date(nearestExpiry.expires_at).toLocaleDateString("ja-JP"); const descKey = `ポイント期限通知_${expiryStr}`; const { data: existNotify } = await supabase.from("customer_notifications").select("id").eq("target_customer_id", customer.id).eq("title", "⏰ ポイント有効期限のお知らせ").like("body", `%${expiryStr}%`).maybeSingle(); if (!existNotify) { await supabase.from("customer_notifications").insert({ title: "⏰ ポイント有効期限のお知らせ", body: `${totalExpiring.toLocaleString()}ptが${expiryStr}までに期限切れになります。お早めにご利用ください！`, type: "campaign", target_customer_id: customer.id }); } } }
    const { data: n } = await supabase.from("customer_notifications").select("*").or(`target_customer_id.is.null,target_customer_id.eq.${customer.id}`).order("created_at", { ascending: false }); if (n) setNotifications(n);
    const { data: nr } = await supabase.from("customer_notification_reads").select("notification_id").eq("customer_id", customer.id); if (nr) setReadNotifIds(nr.map((x: { notification_id: number }) => x.notification_id));
    const { data: cd } = await supabase.from("customer_cards").select("*").eq("customer_id", customer.id).order("is_default", { ascending: false }); if (cd) setCards(cd);
    const { data: nom } = await supabase.from("nominations").select("id,name,price").order("id"); if (nom) setNominations(nom);
    const { data: disc } = await supabase.from("discounts").select("id,name,amount,type,web_available,newcomer_only,valid_from,valid_until,combinable").order("id"); if (disc) setDiscounts(disc.filter(d => d.web_available !== false));
    const { data: ext } = await supabase.from("extensions").select("id,name,duration,price").order("duration"); if (ext) setExtensions(ext);
    const { data: opts } = await supabase.from("options").select("id,name,price").order("id"); if (opts) setOptionsList(opts);
    const { data: bl } = await supabase.from("buildings").select("*"); if (bl) setBuildings(bl);
    // NGセラピスト取得（このお客様をNGにしたセラピスト）
    const { data: ngNotes } = await supabase.from("therapist_customer_notes").select("therapist_id").eq("customer_name", customer.name).eq("is_ng", true);
    if (ngNotes) setNgTherapistIdsForMe(new Set(ngNotes.map(n => n.therapist_id)));
    // アンケート: 未回答予約と発行済みクーポン取得（Phase 1B-2）
    try {
      const sr = await fetch(`/api/survey/list?customerId=${customer.id}`);
      if (sr.ok) {
        const sd = await sr.json();
        setPendingSurveys(sd.pending || []);
        setSurveyCoupons(sd.coupons || []);
        setCompletedSurveys(sd.completed || []);
      }
    } catch { /* 取得失敗は静かに無視 */ }
    // お客様セラピストメモ取得
    try { const { data: memos } = await supabase.from("customer_therapist_memos").select("*").eq("customer_id", customer.id); if (memos) setCustomerMemos(memos); } catch {}
  }, [customer]);
  useEffect(() => { if (customer) fetchData(); }, [customer, fetchData]);

  // 当日スケジュール取得
  const fetchDaySchedule = useCallback(async (date: string) => {
    const { data: sh } = await supabase.from("shifts").select("*").eq("date", date).eq("status", "confirmed").order("start_time"); if (sh) setSchedShifts(sh);
    const { data: res } = await supabase.from("reservations").select("*").eq("date", date).not("status", "eq", "cancelled").order("start_time"); if (res) setSchedRes(res);
  }, []);
  useEffect(() => { if (customer && tab === "schedule") { fetchDaySchedule(schedDate); } }, [schedDate, tab, customer, fetchDaySchedule]);

  // 保留中予約の自動オープン（HPからの予約導線：?book=ID&date=...&time=... → 登録/ログイン後に自動表示）
  useEffect(() => {
    if (!customer) return;
    if (typeof window === "undefined") return;
    if (courses.length === 0) return; // コースデータが未取得の間は待つ
    let raw: string | null = null;
    try {
      raw = localStorage.getItem("pending_book");
    } catch { return; }
    if (!raw) return;
    try {
      const p = JSON.parse(raw) as { tid: number; date: string; time: string };
      if (!p.tid || !p.date || !p.time) {
        localStorage.removeItem("pending_book");
        return;
      }
      // 該当セラピストのその日のシフト店舗を取得（フォールバック: stores[0]）
      supabase
        .from("shifts")
        .select("store_id")
        .eq("therapist_id", p.tid)
        .eq("date", p.date)
        .eq("status", "confirmed")
        .maybeSingle()
        .then(({ data }) => {
          const storeId = data?.store_id || (stores.length > 0 ? stores[0].id : 0);
          setBookDate(p.date);
          setBookTime(p.time);
          setBookTherapistId(p.tid);
          setBookCourseId(0);
          setBookStoreId(storeId);
          setBookNotes("");
          setBookMsg("");
          setBookDiscountId(0);
          setBookOptions([]);
          setBookExtId(0);
          setBookPointUse(0);
          setBookDone(false);
          setFreeMode(false);
          setBookFreeBuildingId(null);
          setSchedView("form");
          setTab("schedule");
          try { localStorage.removeItem("pending_book"); } catch {}
          // URL からクエリを除去
          try {
            const url = new URL(window.location.href);
            url.searchParams.delete("book");
            url.searchParams.delete("date");
            url.searchParams.delete("time");
            url.searchParams.delete("register");
            window.history.replaceState({}, "", url.toString());
          } catch {}
        });
    } catch {
      try { localStorage.removeItem("pending_book"); } catch {}
    }
  }, [customer, courses, stores]);

  // 週間スケジュール取得
  const fetchWeekSchedule = useCallback(async (tid: number, baseDate: string) => {
    const dates = getWeekDates(baseDate);
    const s = dates[0]; const e = dates[6];
    const { data: sh } = await supabase.from("shifts").select("*").eq("therapist_id", tid).gte("date", s).lte("date", e).eq("status", "confirmed").order("date"); if (sh) setWeekShifts(sh);
    const { data: res } = await supabase.from("reservations").select("*").eq("therapist_id", tid).gte("date", s).lte("date", e).not("status", "eq", "cancelled").order("start_time"); if (res) setWeekRes(res);
  }, []);

  const openBookForm = (date: string, time: string, tid: number) => {
    const shift = schedShifts.find(s => s.therapist_id === tid && s.date === date) || weekShifts.find(s => s.therapist_id === tid && s.date === date);
    setBookDate(date); setBookTime(time); setBookTherapistId(tid); setBookCourseId(0);
    setBookStoreId(shift?.store_id || (stores.length > 0 ? stores[0].id : 0));
    setBookNotes(""); setBookMsg(""); setBookDiscountId(0); setBookOptions([]); setBookExtId(0); setBookPointUse(0); setBookDone(false); setFreeMode(false); setBookFreeBuildingId(null); setSchedView("form");
  };

  // 指名判定
  const getNominationType = (tid: number): { name: string; label: string; price: number } => {
    if (tid === 0) return { name: "フリー", label: "🎲 おまかせフリー", price: 0 };
    const pastWithTherapist = reservations.some(r => r.therapist_id === tid && r.status === "completed");
    if (pastWithTherapist) { const n = nominations.find(n => n.name.includes("本指名")); return { name: n?.name || "本指名", label: "⭐ 本指名（リピーター）", price: n?.price || 0 }; }
    else { const n = nominations.find(n => n.name.includes("P指名") || n.name.includes("パネル")); return { name: n?.name || "P指名", label: "✨ P指名（初めて）", price: n?.price || 0 }; }
  };

  // 認証
  const handleLogin = async () => { setAuthError(""); setAuthLoading(true); const { data, error } = await supabase.from("customers").select("*").eq("login_email", authEmail.trim()).eq("login_password", authPw).single(); setAuthLoading(false); if (error || !data) { setAuthError("メールアドレスまたはパスワードが正しくありません"); return; } setCustomer(data); localStorage.setItem("customer_mypage_id", String(data.id)); setSetEmail(data.login_email || ""); setSetBday(data.birthday || ""); setSetSelfN(data.self_name || data.name || ""); };
  const handleRegister = async () => { setAuthError(""); setAuthLoading(true); if (!authName.trim() || !authEmail.trim() || !authPw) { setAuthError("すべての項目を入力してください"); setAuthLoading(false); return; } if (authPw.length < 6) { setAuthError("パスワードは6文字以上にしてください"); setAuthLoading(false); return; } const { data: dup } = await supabase.from("customers").select("id").eq("login_email", authEmail.trim()); if (dup && dup.length > 0) { setAuthError("このメールアドレスは既に登録されています"); setAuthLoading(false); return; } let custId = 0; const ph = normPhone(authPhone); if (ph) { const { data: existing } = await supabase.from("customers").select("*").or(`phone.eq.${ph},phone2.eq.${ph},phone3.eq.${ph}`); if (existing && existing.length > 0) { await supabase.from("customers").update({ self_name: authName.trim(), login_email: authEmail.trim(), login_password: authPw }).eq("id", existing[0].id); custId = existing[0].id; } } if (custId === 0) { const { data: newCust, error: insErr } = await supabase.from("customers").insert({ name: authName.trim(), self_name: authName.trim(), phone: ph, email: authEmail.trim(), login_email: authEmail.trim(), login_password: authPw, rank: "normal" }).select().single(); if (insErr) { setAuthError("登録に失敗しました: " + insErr.message); setAuthLoading(false); return; } if (newCust) custId = newCust.id; } setAuthLoading(false); const { data: loginData } = await supabase.from("customers").select("*").eq("id", custId).single(); if (loginData) { setCustomer(loginData); localStorage.setItem("customer_mypage_id", String(loginData.id)); setSetEmail(loginData.login_email || ""); setSetBday(loginData.birthday || ""); setSetSelfN(loginData.self_name || loginData.name || ""); /* 初回登録ボーナス */ const { data: ps } = await supabase.from("point_settings").select("registration_bonus,expiry_months").limit(1).single(); if (ps && ps.registration_bonus > 0) { const { data: existBonus } = await supabase.from("customer_points").select("id").eq("customer_id", custId).eq("description", "🎉 初回会員登録ボーナス").maybeSingle(); if (!existBonus) { const expAt = new Date(); expAt.setMonth(expAt.getMonth() + (ps.expiry_months || 12)); await supabase.from("customer_points").insert({ customer_id: custId, amount: ps.registration_bonus, type: "earn", description: "🎉 初回会員登録ボーナス", expires_at: expAt.toISOString() }); await supabase.from("customer_notifications").insert({ title: "🎉 ようこそ！登録ボーナスをプレゼント", body: `会員登録ありがとうございます！${ps.registration_bonus}ptをプレゼントしました。ぜひご利用ください♪`, type: "campaign", target_customer_id: custId }); } } } };
  const handleLogout = () => { setCustomer(null); localStorage.removeItem("customer_mypage_id"); setTab("home"); };
  const handleResetPassword = async () => {
    setResetMsg(""); setAuthLoading(true);
    try {
      const res = await fetch("/api/password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: resetPhone }),
      });
      const data = await res.json();
      if (data.success) {
        setResetDone(true);
        setResetMsg(data.emailSent ? `✅ 新しいパスワードを ${data.maskedEmail} に送信しました` : `✅ パスワードを再発行しました。お店にお問い合わせください。`);
      } else {
        setResetMsg(data.error || "エラーが発生しました");
      }
    } catch { setResetMsg("通信エラーが発生しました"); }
    setAuthLoading(false);
  };
  const isFav = (type: string, itemId: number) => favorites.some(f => f.type === type && f.item_id === itemId);
  const toggleFav = async (type: string, itemId: number) => { if (!customer) return; const ex = favorites.find(f => f.type === type && f.item_id === itemId); if (ex) { await supabase.from("customer_favorites").delete().eq("id", ex.id); } else { await supabase.from("customer_favorites").insert({ customer_id: customer.id, type, item_id: itemId }); } fetchData(); };
  const pointBalance = points.reduce((sum, p) => sum + p.amount, 0);

  // テロップ: リアルタイム予約速報
  useEffect(() => {
    if (!customer) return;
    // 直近3時間の予約を取得してテロップ初期化
    const loadRecent = async () => {
      const since = new Date(); since.setHours(since.getHours() - 10);
      const { data: recent } = await supabase.from("reservations").select("therapist_id,course,created_at").gte("created_at", since.toISOString()).order("created_at", { ascending: false }).limit(30);
      const { data: thAll } = await supabase.from("therapists").select("id,name");
      if (recent && thAll) {
        const msgs = recent.map(r => {
          const th = thAll.find(t => t.id === r.therapist_id);
          const ago = Math.floor((Date.now() - new Date(r.created_at).getTime()) / 60000);
          const agoText = ago < 1 ? "たった今" : ago < 60 ? `${ago}分前` : `${Math.floor(ago / 60)}時間前`;
          return `🔥 ${agoText} ${th?.name || "セラピスト"}さん ${r.course || "コース"}の予約が入りました！`;
        });
        setTickerMsgs(msgs);
      }
    };
    loadRecent();
    // リアルタイム購読
    const ch = supabase.channel("ticker-reservations").on("postgres_changes", { event: "INSERT", schema: "public", table: "reservations" }, async (payload) => {
      const r = payload.new as { therapist_id: number; course: string };
      const { data: th } = await supabase.from("therapists").select("name").eq("id", r.therapist_id).maybeSingle();
      const msg = `🔥 たった今 ${th?.name || "セラピスト"}さん ${r.course || "コース"}の予約が入りました！`;
      setTickerMsgs(prev => [msg, ...prev].slice(0, 15));
    }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [customer]);
  const unreadCount = notifications.filter(n => !readNotifIds.includes(n.id)).length;
  const markRead = async (nid: number) => { if (!customer || readNotifIds.includes(nid)) return; await supabase.from("customer_notification_reads").insert({ customer_id: customer.id, notification_id: nid }); setReadNotifIds(prev => [...prev, nid]); };
  const markAllRead = async () => { if (!customer) return; for (const n of notifications.filter(n => !readNotifIds.includes(n.id))) { try { await supabase.from("customer_notification_reads").insert({ customer_id: customer.id, notification_id: n.id }); } catch {} } setReadNotifIds(notifications.map(n => n.id)); };
  const addCard = async () => { if (!customer || !cardLast4 || cardLast4.length !== 4) return; await supabase.from("customer_cards").insert({ customer_id: customer.id, brand: cardBrand, last4: cardLast4, holder_name: cardHolder, exp_month: cardExpMonth, exp_year: cardExpYear, is_default: cards.length === 0 }); setShowAddCard(false); setCardLast4(""); setCardHolder(""); fetchData(); };
  const removeCard = async (id: number) => { const ok = await confirm({ title: "このカードを削除しますか？", variant: "danger", confirmLabel: "削除する" }); if (!ok) return; await supabase.from("customer_cards").delete().eq("id", id); fetchData(); };
  const setDefaultCard = async (id: number) => { if (!customer) return; await supabase.from("customer_cards").update({ is_default: false }).eq("customer_id", customer.id); await supabase.from("customer_cards").update({ is_default: true }).eq("id", id); fetchData(); };
  const submitBooking = async () => {
    if (!customer || !bookDate) { setBookMsg("日付を選択してください"); return; }
    if (!bookCourseId) { setBookMsg("コースを選択してください"); return; }
    setBookSaving(true); setBookMsg("");
    const course = courses.find(c => c.id === bookCourseId);
    const ext = extensions.find(e => e.id === bookExtId);
    const dur = (course?.duration || 60) + (ext?.duration || 0);
    const endTime = minToTime(timeToMin(bookTime) + dur);
    const nom = getNominationType(bookTherapistId);
    const disc = discounts.find(d => d.id === bookDiscountId);
    const selOpts = optionsList.filter(o => bookOptions.includes(o.id));
    const optText = selOpts.map(o => o.name).join(",");
    const optTotal = selOpts.reduce((s, o) => s + o.price, 0);
    const totalPrice = Math.max(0, (course?.price || 0) + nom.price + optTotal + (ext?.price || 0) - (disc?.amount || 0) - bookPointUse);
    if (bookPointUse > 0 && bookPointUse < 1000) { alert("ポイントは1,000pt以上からご利用いただけます"); setBookSaving(false); return; }
    const { data: newRes, error } = await supabase.from("reservations").insert({ customer_name: customer.name, therapist_id: bookTherapistId || 0, date: bookDate, start_time: bookTime, end_time: endTime, course: course?.name || "", total_price: totalPrice, status: "unprocessed", customer_status: "web_reservation", notes: bookNotes, nomination: nom.name, nomination_fee: nom.price, options_text: optText, options_total: optTotal, extension_name: ext?.name || "", extension_price: ext?.price || 0, extension_duration: ext?.duration || 0, discount_name: disc?.name || "", discount_amount: disc?.amount || 0, point_used: bookPointUse, ...(freeMode && bookFreeBuildingId ? { free_building_id: bookFreeBuildingId } : {}) }).select("id").single();
    setBookSaving(false);
    if (error) { setBookMsg("予約に失敗しました: " + error.message); } else { if (bookPointUse > 0 && newRes) { await supabase.from("customer_points").insert({ customer_id: customer.id, amount: -bookPointUse, type: "use", description: `予約利用（仮押さえ）${dateFmt(bookDate)}`, status: "pending", reservation_id: newRes.id }); } setBookDone(true); fetchData(); fetchDaySchedule(bookDate); }
  };
  const saveSettings = async () => { if (!customer) return; setSettingMsg(""); setSettingSaving(true); const updates: Record<string, string | null> = {}; if (setSelfN.trim() && setSelfN.trim() !== (customer.self_name || customer.name)) updates.self_name = setSelfN.trim(); if (setEmail.trim() && setEmail.trim() !== customer.login_email) updates.login_email = setEmail.trim(); if ((setBday || "") !== (customer.birthday || "")) updates.birthday = setBday || null; if (setPw) { if (setPw.length < 6) { setSettingMsg("パスワードは6文字以上にしてください"); setSettingSaving(false); return; } if (setPw !== setPwConfirm) { setSettingMsg("パスワードが一致しません"); setSettingSaving(false); return; } updates.login_password = setPw; } if (Object.keys(updates).length === 0) { setSettingMsg("変更がありません"); setSettingSaving(false); return; } const { error } = await supabase.from("customers").update(updates).eq("id", customer.id); setSettingSaving(false); if (error) setSettingMsg("保存に失敗しました"); else { setSettingMsg("保存しました！"); setSetPw(""); setSetPwConfirm(""); const { data } = await supabase.from("customers").select("*").eq("id", customer.id).single(); if (data) { setCustomer(data); setSetBday(data.birthday || ""); setSetSelfN(data.self_name || data.name || ""); } setTimeout(() => setSettingMsg(""), 2000); } };

  const getTherapistName = (id: number) => therapists.find(t => t.id === id)?.name || "—";
  const getStoreName = (sid: number) => stores.find(s => s.id === sid)?.name || "";
  const getReservationPointsEarned = (r: Reservation) => {
    return points.filter(p => p.amount > 0 && p.description && p.description.includes(dateFmt(r.date))).reduce((s, p) => s + p.amount, 0);
  };
  const getPaymentInfo = (r: Reservation) => {
    const parts: string[] = [];
    if (r.card_base > 0) parts.push(`💳${fmt(r.card_base)}`);
    if (r.paypay_amount > 0) parts.push(`📱${fmt(r.paypay_amount)}`);
    if (r.cash_amount > 0) parts.push(`💵${fmt(r.cash_amount)}`);
    return parts.length > 0 ? parts.join(" ") : "";
  };
  const getMemo = (resId: number) => customerMemos.find(m => m.reservation_id === resId);
  const getMemosForTherapist = (tid: number) => customerMemos.filter(m => m.therapist_id === tid).sort((a, b) => b.id - a.id);
  const openMemoEdit = (resId: number, therapistId: number) => {
    const existing = getMemo(resId);
    setEditMemoResId(resId);
    setEditMemoTherapistId(therapistId);
    setEditMemoRating(existing?.rating || 0);
    setEditMemoText(existing?.memo || "");
    setShowMemoModal(true);
  };
  const saveMemo = async () => {
    if (!customer || !editMemoResId) return;
    setMemoSaving(true);
    const existing = getMemo(editMemoResId);
    if (existing) {
      await supabase.from("customer_therapist_memos").update({ rating: editMemoRating, memo: editMemoText, updated_at: new Date().toISOString() }).eq("id", existing.id);
    } else {
      await supabase.from("customer_therapist_memos").insert({ customer_id: customer.id, therapist_id: editMemoTherapistId, reservation_id: editMemoResId, rating: editMemoRating, memo: editMemoText });
    }
    setMemoSaving(false);
    setShowMemoModal(false);
    try { const { data: memos } = await supabase.from("customer_therapist_memos").select("*").eq("customer_id", customer.id); if (memos) setCustomerMemos(memos); } catch {}
  };
  const getStatusBadge = (status: string): { label: string; color: string; bg: string } => {
    switch (status) {
      case "unprocessed": return { label: "🟡 リクエスト中", color: "#b38419", bg: "#b3841918" };
      case "email_sent": return { label: "🔵 確認メール送信済", color: "#6b8ba8", bg: "#6b8ba818" };
      case "customer_confirmed": return { label: "🟢 お客様確定", color: "#6b9b7e", bg: "#6b9b7e18" };
      case "completed": return { label: "✅ 完了", color: "#c3a782", bg: "#c3a78218" };
      case "serving": return { label: "💆 接客中", color: "#6b9b7e", bg: "#6b9b7e18" };
      case "cancelled": return { label: "❌ キャンセル", color: "#c96b83", bg: "#c96b8318" };
      default: return { label: status || "未処理", color: "#888780", bg: "#88878018" };
    }
  };
  const today = new Date().toISOString().split("T")[0];
  const upcomingRes = reservations.filter(r => r.date >= today && r.status !== "cancelled").sort((a, b) => a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time));
  const canCancelDirectly = (r: Reservation) => r.status === "unprocessed";
  const handleCancelClick = (r: Reservation) => { setCancelTarget(r); setCancelMsg(""); };
  const confirmCancel = async () => {
    if (!cancelTarget) return;
    const { error } = await supabase.from("reservations").update({ status: "cancelled" }).eq("id", cancelTarget.id);
    if (error) { setCancelMsg("キャンセルに失敗しました"); return; }
    setCancelTarget(null); fetchData();
  };
  const pastRes = reservations.filter(r => r.date < today || r.status === "completed");
  const thisMonth = new Date().toISOString().slice(0, 7);
  const monthTotal = reservations.filter(r => r.date.startsWith(thisMonth) && r.status === "completed").reduce((s, r) => s + (r.total_price || 0), 0);
  const totalVisits = reservations.filter(r => r.status === "completed").length;
  const inputStyle = { backgroundColor: C.cardAlt, borderColor: C.border, color: C.text };

  // スロット生成
  const makeSlots = (shift: Shift, resForTherapist: Reservation[]) => {
    const ss = timeToMin(shift.start_time); const se = timeToMin(shift.end_time);
    const slots: { time: string; available: boolean; resInfo?: string }[] = [];
    for (let m = ss; m < se; m += 15) {
      const t = minToTime(m);
      const busy = resForTherapist.find(r => { const rs = timeToMin(r.start_time); const re = timeToMin(r.end_time); return m >= rs && m < re; });
      slots.push({ time: t, available: !busy, resInfo: busy ? `${busy.start_time}〜${busy.end_time} ${busy.course}` : undefined });
    }
    return slots;
  };

  // ログイン画面
  if (!customer) {
    return (
      <div style={{ minHeight: "100vh", backgroundColor: C.bg, position: "relative", fontFamily: FONT_SERIF }}>
        {/* ヒーロー画像（/public/mypage/hero-login.jpg） */}
        <div style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "45vh",
          overflow: "hidden",
          backgroundColor: C.accentBg,
        }}>
          <img
            src="/mypage/hero-login.jpg"
            alt=""
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "center left",
              transform: "scale(1.08)",
              transformOrigin: "center left",
            }}
          />
          {/* 白いフェード */}
          <div style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(180deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.7) 70%, rgba(255,255,255,1) 100%)",
          }} />
        </div>

        {/* コンテンツ */}
        <div style={{
          position: "relative",
          zIndex: 1,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px 20px 48px",
        }}>
          <div style={{ width: "100%", maxWidth: 420, marginTop: "20vh" }}>
            {/* ブランドヘッダー */}
            <div style={{ textAlign: "center", marginBottom: 40 }}>
              <p style={{
                margin: 0,
                fontFamily: FONT_DISPLAY,
                fontSize: 11,
                letterSpacing: "0.3em",
                color: C.accent,
                textTransform: "uppercase",
              }}>Member Page</p>
              <h1 style={{
                margin: "10px 0 6px",
                fontFamily: FONT_DISPLAY,
                fontSize: 32,
                fontWeight: 400,
                letterSpacing: "0.15em",
                color: C.text,
              }}>Ange Spa</h1>
              <div style={{ width: 32, height: 1, backgroundColor: C.accent, margin: "12px auto" }} />
              <p style={{
                margin: 0,
                fontSize: 12,
                letterSpacing: "0.08em",
                color: C.textSub,
              }}>会員の皆さまへ</p>
            </div>

            {/* 予約導線バナー（HPセラピスト詳細→空き時間→マイページ から来た場合） */}
            {pendingBookInfo && (
              <div
                style={{
                  marginBottom: 20,
                  padding: 16,
                  backgroundColor: "#fff5f7",
                  border: `1px solid ${C.accent}55`,
                  borderRadius: 8,
                  textAlign: "center",
                }}
              >
                <p style={{ margin: 0, fontSize: 10, letterSpacing: "0.2em", color: C.accent, fontFamily: FONT_DISPLAY }}>
                  ＼ ご予約の最終ステップ ／
                </p>
                <p style={{ margin: "8px 0 4px", fontSize: 14, color: C.text, fontFamily: FONT_SERIF, letterSpacing: "0.05em", fontWeight: 500 }}>
                  {pendingBookInfo.therapistName ? `${pendingBookInfo.therapistName} さん` : "ご指名セラピスト"}
                </p>
                <p style={{ margin: 0, fontSize: 12, color: C.textSub, fontFamily: FONT_SERIF, letterSpacing: "0.05em" }}>
                  {(() => {
                    const dt = new Date(pendingBookInfo.date + "T00:00:00");
                    const wd = ["日", "月", "火", "水", "木", "金", "土"][dt.getDay()];
                    return `${dt.getMonth() + 1}/${dt.getDate()}(${wd}) ${pendingBookInfo.time} 〜`;
                  })()}
                </p>
                <p style={{ margin: "10px 0 0", fontSize: 10, color: C.textMuted, lineHeight: 1.6 }}>
                  会員登録（無料・約30秒）後にコース選択へ進みます
                </p>
              </div>
            )}

            {/* カード */}
            <div style={{
              backgroundColor: C.card,
              border: `1px solid ${C.border}`,
              borderRadius: 8,
              padding: 28,
              boxShadow: "0 2px 20px rgba(0,0,0,0.04)",
            }}>
              {authMode === "reset" ? (
                <>
                  <div style={{ textAlign: "center", marginBottom: 24 }}>
                    <p style={{
                      margin: 0,
                      fontFamily: FONT_DISPLAY,
                      fontSize: 18,
                      letterSpacing: "0.08em",
                      color: C.text,
                    }}>パスワード再発行</p>
                    <p style={{ margin: "8px 0 0", fontSize: 11, color: C.textMuted, letterSpacing: "0.05em" }}>ご登録の電話番号を入力してください</p>
                  </div>
                  {!resetDone ? (
                    <div className="space-y-4">
                      <div>
                        <label style={{ display: "block", fontSize: 11, letterSpacing: "0.1em", color: C.textSub, marginBottom: 6 }}>電話番号</label>
                        <input type="tel" value={resetPhone} onChange={e => setResetPhone(e.target.value)} placeholder="090-1234-5678" style={{ width: "100%", padding: "12px 14px", fontSize: 13, backgroundColor: C.cardAlt, border: `1px solid ${C.border}`, borderRadius: 4, outline: "none", fontFamily: FONT_SERIF, color: C.text }} />
                        <p style={{ margin: "6px 0 0", fontSize: 10, color: C.textFaint }}>マイページに紐づいた電話番号を入力してください</p>
                      </div>
                      {resetMsg && <div style={{ padding: "12px 14px", backgroundColor: C.accentBg, color: C.accentDark, fontSize: 12, borderRadius: 4 }}>{resetMsg}</div>}
                      <button onClick={handleResetPassword} disabled={authLoading || !resetPhone.trim()} style={{ width: "100%", padding: "14px", backgroundColor: C.accent, color: "#fff", border: "none", borderRadius: 4, cursor: authLoading ? "not-allowed" : "pointer", fontFamily: FONT_SERIF, fontSize: 13, letterSpacing: "0.1em", opacity: authLoading || !resetPhone.trim() ? 0.5 : 1 }}>{authLoading ? "送信中..." : "パスワードを再発行"}</button>
                      <button onClick={() => { setAuthMode("login"); setResetMsg(""); setResetPhone(""); setResetDone(false); }} style={{ width: "100%", padding: "10px", backgroundColor: "transparent", color: C.textMuted, border: `1px solid ${C.border}`, borderRadius: 4, cursor: "pointer", fontFamily: FONT_SERIF, fontSize: 12 }}>ログインに戻る</button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div style={{ padding: 20, backgroundColor: C.accentBg, border: `1px solid ${C.accent}30`, borderRadius: 6, textAlign: "center" }}>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: C.accentDark }}>{resetMsg}</p>
                        <p style={{ margin: "10px 0 0", fontSize: 11, color: C.textMuted, lineHeight: 1.7 }}>メールに記載された新しいパスワードでログインしてください。ログイン後、設定画面からパスワードを変更できます。</p>
                      </div>
                      <button onClick={() => { setAuthMode("login"); setResetMsg(""); setResetPhone(""); setResetDone(false); }} style={{ width: "100%", padding: "14px", backgroundColor: C.accent, color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontFamily: FONT_SERIF, fontSize: 13, letterSpacing: "0.1em" }}>ログイン画面に戻る</button>
                    </div>
                  )}
                </>
              ) : (
                <>
                  {/* タブ */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderBottom: `1px solid ${C.border}`, marginBottom: 24 }}>
                    <button onClick={() => { setAuthMode("login"); setAuthError(""); }} style={{ padding: "12px 0", backgroundColor: "transparent", color: authMode === "login" ? C.accent : C.textMuted, border: "none", borderBottom: authMode === "login" ? `2px solid ${C.accent}` : "2px solid transparent", cursor: "pointer", fontFamily: FONT_SERIF, fontSize: 13, letterSpacing: "0.08em", fontWeight: authMode === "login" ? 500 : 400 }}>ログイン</button>
                    <button onClick={() => { setAuthMode("register"); setAuthError(""); }} style={{ padding: "12px 0", backgroundColor: "transparent", color: authMode === "register" ? C.accent : C.textMuted, border: "none", borderBottom: authMode === "register" ? `2px solid ${C.accent}` : "2px solid transparent", cursor: "pointer", fontFamily: FONT_SERIF, fontSize: 13, letterSpacing: "0.08em", fontWeight: authMode === "register" ? 500 : 400 }}>新規会員登録</button>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    {authMode === "register" && (
                      <>
                        <div>
                          <label style={{ display: "block", fontSize: 11, letterSpacing: "0.1em", color: C.textSub, marginBottom: 6 }}>お名前</label>
                          <input type="text" value={authName} onChange={e => setAuthName(e.target.value)} placeholder="山田 太郎" style={{ width: "100%", padding: "12px 14px", fontSize: 13, backgroundColor: C.cardAlt, border: `1px solid ${C.border}`, borderRadius: 4, outline: "none", fontFamily: FONT_SERIF, color: C.text }} />
                        </div>
                        <div>
                          <label style={{ display: "block", fontSize: 11, letterSpacing: "0.1em", color: C.textSub, marginBottom: 6 }}>電話番号 <span style={{ fontSize: 9, color: C.textMuted, marginLeft: 4 }}>（既存データと紐付け）</span></label>
                          <input type="tel" value={authPhone} onChange={e => setAuthPhone(e.target.value)} placeholder="090-1234-5678" style={{ width: "100%", padding: "12px 14px", fontSize: 13, backgroundColor: C.cardAlt, border: `1px solid ${C.border}`, borderRadius: 4, outline: "none", fontFamily: FONT_SERIF, color: C.text }} />
                        </div>
                      </>
                    )}
                    <div>
                      <label style={{ display: "block", fontSize: 11, letterSpacing: "0.1em", color: C.textSub, marginBottom: 6 }}>メールアドレス</label>
                      <input type="email" value={authEmail} onChange={e => setAuthEmail(e.target.value)} placeholder="example@email.com" style={{ width: "100%", padding: "12px 14px", fontSize: 13, backgroundColor: C.cardAlt, border: `1px solid ${C.border}`, borderRadius: 4, outline: "none", fontFamily: FONT_SERIF, color: C.text }} />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: 11, letterSpacing: "0.1em", color: C.textSub, marginBottom: 6 }}>パスワード</label>
                      <div style={{ position: "relative" }}>
                        <input type={showPw ? "text" : "password"} value={authPw} onChange={e => setAuthPw(e.target.value)} placeholder="6文字以上" style={{ width: "100%", padding: "12px 44px 12px 14px", fontSize: 13, backgroundColor: C.cardAlt, border: `1px solid ${C.border}`, borderRadius: 4, outline: "none", fontFamily: FONT_SERIF, color: C.text }} />
                        <button type="button" onClick={() => setShowPw(!showPw)} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: C.textMuted, fontSize: 11 }}>{showPw ? "非表示" : "表示"}</button>
                      </div>
                    </div>
                    {authError && <div style={{ padding: "12px 14px", backgroundColor: C.accentBg, color: C.accentDark, fontSize: 12, borderRadius: 4 }}>{authError}</div>}
                    <button onClick={authMode === "login" ? handleLogin : handleRegister} disabled={authLoading} style={{ width: "100%", padding: "14px", backgroundColor: C.accent, color: "#fff", border: "none", borderRadius: 4, cursor: authLoading ? "not-allowed" : "pointer", fontFamily: FONT_SERIF, fontSize: 13, letterSpacing: "0.1em", opacity: authLoading ? 0.5 : 1, marginTop: 4 }}>{authLoading ? "処理中..." : authMode === "login" ? "ログイン" : "会員登録"}</button>
                  </div>
                </>
              )}
            </div>

            {authMode !== "reset" && (
              <p style={{ textAlign: "center", marginTop: 20, fontSize: 11 }}>
                <button onClick={() => { setAuthMode("reset"); setResetMsg(""); setResetPhone(""); setResetDone(false); }} style={{ color: C.accent, background: "none", border: "none", cursor: "pointer", textDecoration: "underline", fontFamily: FONT_SERIF, letterSpacing: "0.05em" }}>パスワードを忘れた方はこちら</button>
              </p>
            )}

            {/* フッター：HPに戻る */}
            <div style={{ textAlign: "center", marginTop: 32 }}>
              <a href="/" style={{ fontSize: 10, color: C.textFaint, letterSpacing: "0.15em", textDecoration: "none", fontFamily: FONT_DISPLAY, textTransform: "uppercase" }}>← Back to Home</a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const tabs: { key: typeof tab; label: string; Icon: React.ComponentType<{ size?: number; color?: string }> }[] = [
    { key: "home", label: "ホーム", Icon: IconHome },
    { key: "schedule", label: "予約", Icon: IconCalendar },
    { key: "diary", label: "日記", Icon: IconCamera },
    { key: "favorites", label: "お気に入り", Icon: IconHeart },
    { key: "notifications", label: "お知らせ", Icon: IconBell },
    { key: "settings", label: "設定", Icon: IconSettings },
  ];

  return (<div className="min-h-screen pb-24" style={{ backgroundColor: C.bg, color: C.text, fontFamily: FONT_SERIF }}>
    {ConfirmModalNode}
    <InstallPrompt dismissKey="customer" />

    {/* ═══ ヘッダー（HP風・明朝ブランド） ═══ */}
    <div style={{
      position: "sticky",
      top: 0,
      zIndex: 30,
      backgroundColor: "rgba(255,255,255,0.95)",
      backdropFilter: "blur(12px)",
      borderBottom: `1px solid ${C.border}`,
    }}>
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        {/* 左：ブランドロゴ＋会員情報 */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
          <a href="/" style={{ textDecoration: "none" }}>
            <span style={{
              fontFamily: FONT_DISPLAY,
              fontSize: 18,
              letterSpacing: "0.1em",
              color: C.text,
              fontWeight: 400,
            }}>Ange Spa</span>
          </a>
          <div style={{ height: 20, width: 1, backgroundColor: C.border }} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <p style={{ margin: 0, fontSize: 12, color: C.text, letterSpacing: "0.03em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {customer.self_name || customer.name} 様
            </p>
            <p style={{ margin: "1px 0 0", fontSize: 10, color: C.textMuted, letterSpacing: "0.05em" }}>
              {(() => {
                const r = customer.rank || "normal";
                const label = r === "platinum" ? "PLATINUM" : r === "gold" ? "GOLD" : r === "silver" ? "SILVER" : null;
                return (
                  <>
                    {label && <span style={{ fontFamily: FONT_DISPLAY, color: r === "platinum" ? "#9b7cb6" : r === "gold" ? "#b8945a" : "#888", letterSpacing: "0.15em", marginRight: 8 }}>{label}</span>}
                    <span style={{ color: C.accent, fontWeight: 500 }}>{pointBalance.toLocaleString()}</span>
                    <span style={{ marginLeft: 2, color: C.textMuted }}>pt</span>
                  </>
                );
              })()}
            </p>
          </div>
        </div>

        {/* 右：ベル + ログアウト */}
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <button
            onClick={() => setTab("notifications")}
            aria-label="お知らせ"
            style={{ padding: 8, background: "none", border: "none", cursor: "pointer", color: C.textSub }}
          >
            <BellWithBadge count={unreadCount} size={18} color={C.textSub} badgeColor={C.accent} />
          </button>
          <button
            onClick={handleLogout}
            aria-label="ログアウト"
            title="ログアウト"
            style={{ padding: 8, background: "none", border: "none", cursor: "pointer", color: C.textMuted }}
          >
            <IconLogout size={16} color={C.textMuted} />
          </button>
        </div>
      </div>
    </div>

    {/* 予約速報テロップ */}
    {tickerMsgs.length > 0 && (
      <div style={{ overflow: "hidden", borderBottom: `1px solid ${C.border}`, backgroundColor: C.accentBg, height: 30 }}>
        <div className="ticker-scroll" style={{ display: "flex", alignItems: "center", gap: 64, whiteSpace: "nowrap", height: "100%", fontSize: 11, color: C.accentDark, letterSpacing: "0.05em" }}>
          {tickerMsgs.map((m, i) => <span key={i} style={{ display: "inline-block", padding: "0 16px" }}>{m}</span>)}
          {tickerMsgs.map((m, i) => <span key={`dup-${i}`} style={{ display: "inline-block", padding: "0 16px" }}>{m}</span>)}
        </div>
      </div>
    )}
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "20px 16px" }}>

      {/* ═══ ホーム ═══ */}
      {tab === "home" && (<div style={{ display: "flex", flexDirection: "column", gap: 24 }} className="animate-[fadeIn_0.3s]">
        {unreadCount > 0 && (
          <button onClick={() => setTab("notifications")} style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "12px 16px",
            backgroundColor: C.accentBg,
            border: `1px solid ${C.accent}40`,
            borderRadius: 6,
            cursor: "pointer",
            fontFamily: FONT_SERIF,
            textAlign: "left",
          }}>
            <IconBell size={18} color={C.accentDark} />
            <span style={{ flex: 1, fontSize: 12, color: C.accentDark, letterSpacing: "0.03em" }}>未読のお知らせが {unreadCount} 件あります</span>
            <IconArrowRight size={14} color={C.accentDark} />
          </button>
        )}

        {/* ═══ アンケート未回答（Phase 1B-2） ═══ */}
        {pendingSurveys.length > 0 && (
          <div style={{
            border: `1px solid ${C.borderPink}`,
            backgroundColor: C.accentBg,
            padding: 16,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 16 }}>🌸</span>
              <p style={{ fontSize: 13, color: C.accentDark, margin: 0, fontWeight: 500 }}>
                ご感想をお聞かせください
              </p>
            </div>
            <p style={{ fontSize: 11, color: C.textSub, margin: 0, marginBottom: 12, lineHeight: 1.6 }}>
              ご回答いただくと <strong style={{ color: C.accentDark }}>1,000円OFFクーポン</strong> をプレゼント🎁（次回ご予約時に利用可・他の割引と併用可）
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {pendingSurveys.slice(0, 3).map((p) => (
                <a
                  key={p.reservationId}
                  href={`/mypage/survey/${p.reservationId}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 12px",
                    backgroundColor: "#fff",
                    border: `1px solid ${C.borderPink}`,
                    textDecoration: "none",
                    fontFamily: FONT_SERIF,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 12, color: C.text, margin: 0, marginBottom: 2 }}>
                      {p.date} {p.startTime}〜
                      {p.therapistName && <span style={{ color: C.accentDark, marginLeft: 6 }}>担当: {p.therapistName}</span>}
                    </p>
                    <p style={{ fontSize: 10, color: C.textMuted, margin: 0 }}>{p.course}</p>
                  </div>
                  <IconArrowRight size={14} color={C.accent} />
                </a>
              ))}
              {pendingSurveys.length > 3 && (
                <p style={{ fontSize: 10, color: C.textMuted, textAlign: "center", margin: 0 }}>
                  他 {pendingSurveys.length - 3} 件
                </p>
              )}
            </div>
          </div>
        )}

        {/* ═══ アンケートクーポン（Phase 1B-2） ═══ */}
        {surveyCoupons.length > 0 && (
          <div style={{
            border: `1px solid ${C.borderPink}`,
            backgroundColor: "#fff",
            padding: 16,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 16 }}>🎁</span>
              <p style={{ fontSize: 13, color: C.text, margin: 0, fontWeight: 500 }}>
                次回ご来店時に1,000円OFFを自動適用
              </p>
            </div>
            <p style={{ fontSize: 11, color: C.textSub, lineHeight: 1.6, marginBottom: 12 }}>
              アンケートご回答ありがとうございました🌸<br />
              ご予約・ご来店時に何もお伝えいただく必要はございません。
            </p>
            <div style={{
              padding: "8px 10px",
              backgroundColor: C.accentBg,
              border: `1px solid ${C.borderPink}`,
              fontSize: 10,
              color: C.accentDark,
              lineHeight: 1.5,
              marginBottom: 10,
            }}>
              ⚠️ <strong>90分以上のコース</strong>でのご利用に限ります（1回のご予約につき1枚のみ）
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {surveyCoupons.map((c) => (
                <div
                  key={c.id}
                  style={{
                    padding: "10px 12px",
                    backgroundColor: C.cardAlt,
                    border: `1px dashed ${C.borderPink}`,
                  }}
                >
                  <p style={{ fontSize: 11, color: C.textSub, margin: 0, lineHeight: 1.6 }}>
                    🎟 {c.discountAmount.toLocaleString()}円OFF・有効期限{" "}
                    <strong style={{ color: C.text }}>
                      {new Date(c.expiresAt).toLocaleDateString("ja-JP")}
                    </strong>{" "}
                    まで
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══ アンケート履歴（Phase 1B-2 改修版） ═══ */}
        {completedSurveys.length > 0 && (
          <div style={{
            border: `1px solid ${C.border}`,
            backgroundColor: "#fff",
            padding: 16,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <span style={{ fontSize: 16 }}>📝</span>
              <p style={{ fontSize: 13, color: C.text, margin: 0, fontWeight: 500 }}>
                ご回答いただいたアンケート
              </p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {completedSurveys.slice(0, 6).map((s) => {
                const used = s.couponUsed;
                const expired = s.couponExpiresAt && new Date(s.couponExpiresAt) < new Date();
                return (
                  <div
                    key={s.surveyId}
                    style={{
                      padding: "10px 12px",
                      backgroundColor: used ? C.cardAlt : "#fff",
                      border: `1px solid ${used ? C.border : C.borderPink}`,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 11, color: C.textMuted, margin: 0, marginBottom: 2 }}>
                          {new Date(s.submittedAt).toLocaleDateString("ja-JP")} ご回答
                        </p>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                          <span style={{ color: C.accent, fontSize: 13, letterSpacing: 1 }}>
                            {"★".repeat(s.ratingOverall)}
                          </span>
                          {s.therapistName && (
                            <span style={{ fontSize: 10, color: C.accentDark }}>
                              担当: {s.therapistName}
                            </span>
                          )}
                        </div>
                        {s.couponCode && (
                          <p style={{ fontSize: 10, color: C.textSub, margin: 0, lineHeight: 1.5 }}>
                            {used ? (
                              <>
                                ✓ {s.couponDiscountAmount.toLocaleString()}円OFF を{" "}
                                <strong style={{ color: C.green }}>
                                  {s.couponUsedAt && new Date(s.couponUsedAt).toLocaleDateString("ja-JP")}
                                </strong>{" "}
                                にご利用いただきました
                              </>
                            ) : expired ? (
                              <span style={{ color: C.textMuted }}>
                                有効期限切れ（{s.couponExpiresAt && new Date(s.couponExpiresAt).toLocaleDateString("ja-JP")}）
                              </span>
                            ) : (
                              <>
                                🎁 90分以上のコースで次回ご来店時に自動適用<br />
                                <span style={{ fontSize: 9 }}>
                                  有効期限{" "}
                                  <strong style={{ color: C.text }}>
                                    {s.couponExpiresAt && new Date(s.couponExpiresAt).toLocaleDateString("ja-JP")}
                                  </strong>{" "}
                                  まで
                                </span>
                              </>
                            )}
                          </p>
                        )}
                      </div>
                      <span
                        style={{
                          fontSize: 9,
                          padding: "2px 8px",
                          backgroundColor: used ? C.textMuted : (expired ? C.textFaint : C.accent),
                          color: "#fff",
                          letterSpacing: 0.5,
                          flexShrink: 0,
                          alignSelf: "flex-start",
                        }}
                      >
                        {used ? "使用済" : expired ? "期限切れ" : "未使用"}
                      </span>
                    </div>
                  </div>
                );
              })}
              {completedSurveys.length > 6 && (
                <p style={{ fontSize: 10, color: C.textMuted, textAlign: "center", margin: 0 }}>
                  他 {completedSurveys.length - 6} 件のアンケート履歴
                </p>
              )}
            </div>
          </div>
        )}

        {/* ═══ ヒーロー ═══ */}
        <div style={{
          position: "relative",
          width: "calc(100% + 32px)",
          marginLeft: -16,
          marginRight: -16,
          height: 200,
          overflow: "hidden",
          backgroundColor: C.accentBg,
        }}>
          <img
            src="/mypage/hero-home.jpg"
            alt=""
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 50%" }}
          />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0.9) 100%)" }} />
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: 20 }}>
            <p style={{ margin: 0, fontFamily: FONT_DISPLAY, fontSize: 10, letterSpacing: "0.3em", color: C.accent, textTransform: "uppercase" }}>Welcome back</p>
            <h1 style={{ margin: "10px 0 0", fontFamily: FONT_DISPLAY, fontSize: 22, fontWeight: 400, letterSpacing: "0.08em", color: C.text }}>{customer.self_name || customer.name} 様</h1>
            <div style={{ width: 32, height: 1, backgroundColor: C.accent, margin: "12px auto 0" }} />
          </div>
        </div>

        {/* ═══ 予約ボタン（大CTA） ═══ */}
        <button
          onClick={() => { setTab("schedule"); setSchedView("day"); setSchedDate(today); }}
          style={{
            width: "100%",
            padding: "16px 24px",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            backgroundColor: C.accent,
            color: "#fff",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
            fontFamily: FONT_SERIF,
            fontSize: 13,
            letterSpacing: "0.2em",
            fontWeight: 400,
          }}
        >
          <IconCalendar size={16} color="#fff" />
          ご予約する
        </button>

        {/* ═══ 開催中のイベント ═══ */}
        {customerEvents.length > 0 && (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, paddingLeft: 4 }}>
              <div style={{ width: 20, height: 1, backgroundColor: C.accent }} />
              <span style={{ fontFamily: FONT_DISPLAY, fontSize: 10, letterSpacing: "0.2em", color: C.accent, textTransform: "uppercase" }}>Events</span>
            </div>
            <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 8, margin: "0 -16px", padding: "0 16px 8px", scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch", scrollbarWidth: "none" }}>
              {customerEvents.map(ev => {
                const hasLink = !!ev.cta_url;
                const accent = ev.accent_color || C.accent;
                const period = formatEventPeriod(ev);
                const inner = (
                  <div key={ev.id} style={{ flexShrink: 0, width: 280, scrollSnapAlign: "start", backgroundColor: C.card, border: `1px solid ${C.border}`, borderRadius: 6, overflow: "hidden" }}>
                    <div style={{ position: "relative", width: "100%", aspectRatio: "16/10", backgroundColor: ev.image_url ? C.cardAlt : accent + "20", backgroundImage: ev.image_url ? `url(${ev.image_url})` : undefined, backgroundSize: "cover", backgroundPosition: "center" }}>
                      {ev.badge_label && <span style={{ position: "absolute", top: 8, left: 8, padding: "3px 10px", fontSize: 9, color: "#fff", backgroundColor: accent, borderRadius: 2, letterSpacing: "0.1em", fontFamily: FONT_SERIF }}>{ev.badge_label}</span>}
                      {period && <span style={{ position: "absolute", bottom: 8, right: 8, padding: "3px 10px", fontSize: 9, backgroundColor: "rgba(255,255,255,0.92)", color: C.text, borderRadius: 999, fontFamily: FONT_DISPLAY, letterSpacing: "0.05em" }}>{period}</span>}
                    </div>
                    <div style={{ padding: 14 }}>
                      {ev.subtitle && <p style={{ margin: 0, fontSize: 10, color: accent, letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: FONT_DISPLAY }}>{ev.subtitle}</p>}
                      <h3 style={{ margin: "6px 0 0", fontSize: 14, fontFamily: FONT_DISPLAY, fontWeight: 400, color: C.text, letterSpacing: "0.05em" }}>{ev.title}</h3>
                      {ev.description && <p style={{ margin: "6px 0 0", fontSize: 11, color: C.textSub, lineHeight: 1.7, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{ev.description}</p>}
                      {ev.cta_label && hasLink && (
                        <div style={{ marginTop: 10, paddingTop: 10, display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: `1px solid ${C.border}` }}>
                          <span style={{ fontSize: 11, color: accent, letterSpacing: "0.05em" }}>{ev.cta_label}</span>
                          <IconArrowRight size={12} color={accent} />
                        </div>
                      )}
                    </div>
                  </div>
                );
                if (hasLink) {
                  const isExternal = /^https?:\/\//.test(ev.cta_url);
                  if (isExternal) return <a key={ev.id} href={ev.cta_url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none", display: "contents" }}>{inner}</a>;
                  return <a key={ev.id} href={ev.cta_url} style={{ textDecoration: "none", display: "contents" }}>{inner}</a>;
                }
                return inner;
              })}
            </div>
          </div>
        )}

        {/* ═══ 次回のご予約 ═══ */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, paddingLeft: 4 }}>
            <div style={{ width: 20, height: 1, backgroundColor: C.accent }} />
            <span style={{ fontFamily: FONT_DISPLAY, fontSize: 10, letterSpacing: "0.2em", color: C.accent, textTransform: "uppercase" }}>Next Reservation</span>
          </div>
          {upcomingRes.length === 0 ? (
            <div style={{ padding: "32px 24px", textAlign: "center", backgroundColor: C.card, border: `1px solid ${C.border}`, borderRadius: 6 }}>
              <img src="/mypage/empty-reservation.jpg" alt="" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} style={{ width: "100%", maxWidth: 240, aspectRatio: "4/3", objectFit: "cover", borderRadius: 4, marginBottom: 20, opacity: 0.9 }} />
              <p style={{ margin: 0, fontFamily: FONT_DISPLAY, fontSize: 15, letterSpacing: "0.08em", color: C.text }}>現在ご予約はありません</p>
              <p style={{ margin: "8px 0 0", fontSize: 11, color: C.textMuted }}>次のご来店を心よりお待ちしております</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {upcomingRes.slice(0, 3).map(r => (
                <div key={r.id} style={{ padding: 18, backgroundColor: C.accentBg, border: `1px solid ${C.accent}30`, borderRadius: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                    <span style={{ fontFamily: FONT_DISPLAY, fontSize: 18, letterSpacing: "0.05em", color: C.accentDark }}>{dateFmt(r.date)}</span>
                    <span style={{ fontSize: 10, padding: "3px 10px", borderRadius: 999, backgroundColor: getStatusBadge(r.status).bg, color: getStatusBadge(r.status).color, letterSpacing: "0.05em" }}>{getStatusBadge(r.status).label}</span>
                  </div>
                  <p style={{ margin: 0, fontSize: 14, fontFamily: FONT_DISPLAY, letterSpacing: "0.05em", color: C.text }}>{r.start_time}〜{r.end_time}</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 16px", marginTop: 6, fontSize: 11, color: C.textSub }}>
                    {r.course && <span>{r.course}</span>}
                    {r.therapist_id > 0 && <span>{getTherapistName(r.therapist_id)}</span>}
                  </div>
                  {r.total_price > 0 && <p style={{ margin: "10px 0 0", fontSize: 13, fontFamily: FONT_DISPLAY, color: C.accentDark, letterSpacing: "0.05em" }}>{fmt(r.total_price)}</p>}
                  {r.total_price > 0 && (r.status === "customer_confirmed" || r.status === "email_sent") && (
                    <div style={{ marginTop: 12, padding: 12, backgroundColor: "#ffffff", border: `1px solid ${C.border}`, borderRadius: 4 }}>
                      <p style={{ margin: "0 0 6px", fontSize: 10, color: C.textSub, letterSpacing: "0.05em" }}>カード決済額（税10%込）: <strong style={{ color: C.text, fontFamily: FONT_DISPLAY }}>{fmt(Math.round(r.total_price * 1.1))}</strong></p>
                      <button onClick={(e) => { e.stopPropagation(); window.open("https://pay2.star-pay.jp/site/com/shop.php?tel=&payc=A5623&guide=", "_blank"); }} style={{ width: "100%", padding: "8px 0", fontSize: 11, color: "#fff", backgroundColor: C.text, border: "none", borderRadius: 2, cursor: "pointer", fontFamily: FONT_SERIF, letterSpacing: "0.12em" }}>クレジットカードで支払う</button>
                    </div>
                  )}
                  {/* キャンセルボタン */}
                  <button onClick={() => handleCancelClick(r)} style={{ width: "100%", marginTop: 10, padding: "8px 0", fontSize: 10, backgroundColor: "transparent", color: canCancelDirectly(r) ? C.accentDark : C.textMuted, border: `1px solid ${canCancelDirectly(r) ? C.accent + "40" : C.border}`, borderRadius: 2, cursor: "pointer", fontFamily: FONT_SERIF, letterSpacing: "0.08em" }}>
                    {canCancelDirectly(r) ? "この予約をキャンセル" : "キャンセル・変更について"}
                  </button>
                </div>
              ))}
            </div>
          )}
          {/* キャンセルポリシー */}
          <div style={{ marginTop: 12, padding: "12px 14px", backgroundColor: "transparent", border: `1px solid ${C.border}`, borderRadius: 4 }}>
            <p style={{ margin: "0 0 4px", fontSize: 10, letterSpacing: "0.08em", color: C.textSub, fontFamily: FONT_DISPLAY }}>CANCELLATION POLICY</p>
            <p style={{ margin: 0, fontSize: 10, color: C.textMuted, lineHeight: 1.8 }}>ご予約のキャンセル・変更は、必ずお電話にてスタッフまでお申しつけください。当日のキャンセルは<strong style={{ color: C.accentDark }}>100％キャンセル料</strong>を頂戴いたします。</p>
            <a href={`tel:${cancelPhone.replace(/[-\s]/g, "")}`} style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 8, fontSize: 11, color: C.accent, textDecoration: "none", letterSpacing: "0.05em" }}>
              <IconPhone size={12} color={C.accent} />
              {cancelPhone}
            </a>
          </div>
        </div>

        {/* ═══ 統計（3カラム） ═══ */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
          {[
            { label: "Visits", value: String(totalVisits), unit: "回" },
            { label: "This Month", value: fmt(monthTotal), unit: "" },
            { label: "Points", value: pointBalance.toLocaleString(), unit: "pt" },
          ].map((s, i) => (
            <div key={i} style={{ padding: 16, textAlign: "center", backgroundColor: C.card, border: `1px solid ${C.border}`, borderRadius: 4 }}>
              <p style={{ margin: 0, fontSize: 9, fontFamily: FONT_DISPLAY, letterSpacing: "0.2em", color: C.accent, textTransform: "uppercase" }}>{s.label}</p>
              <p style={{ margin: "10px 0 0", fontSize: 20, fontFamily: FONT_DISPLAY, fontWeight: 400, color: C.text, letterSpacing: "0.02em" }}>
                {s.value}
                <span style={{ fontSize: 10, color: C.textMuted, marginLeft: 2, letterSpacing: 0 }}>{s.unit}</span>
              </p>
            </div>
          ))}
        </div>

        {/* ═══ 直近のご利用 ═══ */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, paddingLeft: 4 }}>
            <div style={{ width: 20, height: 1, backgroundColor: C.accent }} />
            <span style={{ fontFamily: FONT_DISPLAY, fontSize: 10, letterSpacing: "0.2em", color: C.accent, textTransform: "uppercase" }}>Recent Visits</span>
          </div>
          {pastRes.length === 0 ? (
            <div style={{ padding: "28px 24px", textAlign: "center", backgroundColor: C.card, border: `1px solid ${C.border}`, borderRadius: 6 }}>
              <p style={{ margin: 0, fontSize: 12, color: C.textMuted }}>ご利用履歴はまだありません</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {pastRes.slice(0, 5).map(r => {
                const ptEarned = getReservationPointsEarned(r);
                const payInfo = getPaymentInfo(r);
                const memo = getMemo(r.id);
                return (
                  <div key={r.id} style={{ padding: 14, border: `1px solid ${C.border}`, backgroundColor: C.card, borderRadius: 4 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                        <span style={{ fontFamily: FONT_DISPLAY, fontSize: 13, letterSpacing: "0.05em", color: C.text }}>{dateFmt(r.date)}</span>
                        <span style={{ fontSize: 11, color: C.textSub }}>{r.course}</span>
                      </div>
                      {r.total_price > 0 && <span style={{ fontSize: 12, fontFamily: FONT_DISPLAY, color: C.accentDark, letterSpacing: "0.03em" }}>{fmt(r.total_price)}</span>}
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "2px 12px", marginTop: 6, fontSize: 10, color: C.textMuted }}>
                      {r.therapist_id > 0 && <span>{getTherapistName(r.therapist_id)}</span>}
                      {r.nomination && <span>{r.nomination}</span>}
                      {r.options_text && <span>{r.options_text}</span>}
                    </div>
                    {(payInfo || ptEarned > 0) && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "2px 12px", marginTop: 4, fontSize: 9, color: C.textFaint }}>
                        {payInfo && <span>{payInfo}</span>}
                        {ptEarned > 0 && <span>+{ptEarned}pt 付与</span>}
                      </div>
                    )}
                    {memo ? (
                      <div style={{ marginTop: 10, padding: "8px 12px", backgroundColor: C.accentBg, borderRadius: 4 }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <StarRating rating={memo.rating} size={10} filledColor={C.accent} emptyColor={C.border} />
                          <button onClick={() => openMemoEdit(r.id, r.therapist_id)} style={{ background: "none", border: "none", color: C.accent, cursor: "pointer", padding: 2, display: "inline-flex", alignItems: "center" }}>
                            <IconEdit size={12} color={C.accent} />
                          </button>
                        </div>
                        {memo.memo && <p style={{ margin: "4px 0 0", fontSize: 10, color: C.textSub, lineHeight: 1.7 }}>{memo.memo}</p>}
                      </div>
                    ) : (
                      <button onClick={() => openMemoEdit(r.id, r.therapist_id)} style={{ width: "100%", marginTop: 10, padding: "7px 0", fontSize: 10, color: C.textMuted, backgroundColor: "transparent", border: `1px dashed ${C.border}`, borderRadius: 2, cursor: "pointer", fontFamily: FONT_SERIF, letterSpacing: "0.1em" }}>ひとことメモを残す</button>
                    )}
                  </div>
                );
              })}
              {pastRes.length > 5 && (
                <button onClick={() => { setTab("schedule"); setSchedView("history"); }} style={{ width: "100%", padding: "10px 0", fontSize: 11, color: C.accent, backgroundColor: "transparent", border: "none", cursor: "pointer", fontFamily: FONT_DISPLAY, letterSpacing: "0.15em" }}>VIEW ALL →</button>
              )}
            </div>
          )}
        </div>
      </div>)}

      {/* ═══ スケジュール / 予約 ═══ */}
      {tab === "schedule" && (<div className="animate-[fadeIn_0.3s]">

        {/* --- DAY: シンプル入口画面 --- */}
        {schedView === "day" && (<div className="space-y-4">
          {/* ヘッダー */}
          <div className="flex items-center justify-between">
            <h2 className="text-[16px] font-medium">ご予約</h2>
            <button onClick={() => setSchedView("history")} className="px-3 py-1.5 text-[10px] rounded-lg cursor-pointer" style={{ color: C.accent, backgroundColor: C.accentBg }}>📋 予約履歴</button>
          </div>

          {/* 次回のご予約（あれば） */}
          {upcomingRes.length > 0 && (
            <div className="rounded-2xl border p-4" style={{ backgroundColor: C.accentBg, borderColor: C.accent + "44" }}>
              <p className="text-[10px] mb-2" style={{ color: C.accent, letterSpacing: "0.1em" }}>NEXT RESERVATION</p>
              {upcomingRes.slice(0, 1).map(r => (
                <div key={r.id}>
                  <p className="text-[16px] font-medium" style={{ color: C.accent }}>{dateFmt(r.date)} {r.start_time}〜</p>
                  <div className="flex flex-wrap gap-x-3 mt-1 text-[11px]" style={{ color: C.textSub }}>
                    {r.course && <span>💆 {r.course}</span>}
                    {r.therapist_id > 0 && <span>👤 {getTherapistName(r.therapist_id)}</span>}
                  </div>
                </div>
              ))}
              {upcomingRes.length > 1 && (
                <button onClick={() => setSchedView("history")} className="mt-2 text-[10px] cursor-pointer" style={{ color: C.accent }}>ほか {upcomingRes.length - 1} 件のご予約 →</button>
              )}
            </div>
          )}

          {/* お気に入りセラピストから予約（あれば） */}
          {therapists.filter(t => isFav("therapist", t.id) && !ngTherapistIdsForMe.has(t.id)).length > 0 && (
            <div>
              <p className="text-[12px] font-medium mb-2 px-1" style={{ color: C.textSub }}>❤️ お気に入りから予約</p>
              <div className="grid grid-cols-3 gap-2">
                {therapists.filter(t => isFav("therapist", t.id) && !ngTherapistIdsForMe.has(t.id)).slice(0, 6).map(t => (
                  <button key={t.id} onClick={() => { setWeeklyTid(t.id); setSchedView("weekly"); fetchWeekSchedule(t.id, schedDate); }} className="rounded-xl border overflow-hidden cursor-pointer text-left" style={{ backgroundColor: C.card, borderColor: C.border }}>
                    {t.photo_url ? (
                      <img src={t.photo_url} alt="" className="w-full aspect-square object-cover" />
                    ) : (
                      <div className="w-full aspect-square flex items-center justify-center text-[24px] text-white font-bold" style={{ background: `linear-gradient(135deg, ${C.accent}, ${C.accentDark})` }}>{t.name.charAt(0)}</div>
                    )}
                    <div className="p-1.5">
                      <p className="text-[11px] font-medium truncate text-center">{t.name}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* HPで見る導線 */}
          <div className="rounded-2xl border p-5 space-y-3" style={{ backgroundColor: C.card, borderColor: C.border }}>
            <div>
              <p className="text-[13px] font-medium mb-1">📅 セラピスト・スケジュールを見る</p>
              <p className="text-[10px]" style={{ color: C.textMuted }}>出勤予定・セラピストのプロフィールは公式サイトでご覧いただけます</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <a href="/schedule" target="_blank" rel="noopener noreferrer" className="py-2.5 rounded-xl text-[12px] font-medium text-center cursor-pointer no-underline" style={{ backgroundColor: C.accentBg, color: C.accent, border: `1px solid ${C.accent}30` }}>📅 出勤スケジュール</a>
              <a href="/therapist" target="_blank" rel="noopener noreferrer" className="py-2.5 rounded-xl text-[12px] font-medium text-center cursor-pointer no-underline" style={{ backgroundColor: C.accentBg, color: C.accent, border: `1px solid ${C.accent}30` }}>💆 セラピスト一覧</a>
            </div>
          </div>

          {/* 直接予約フォーム（おまかせフリー） */}
          <div className="rounded-2xl border p-5 space-y-3" style={{ backgroundColor: C.card, borderColor: C.border }}>
            <div>
              <p className="text-[13px] font-medium mb-1">🕐 直接ご予約</p>
              <p className="text-[10px]" style={{ color: C.textMuted }}>ご希望のセラピストが決まっている場合は、上の「お気に入り」からスケジュールをご確認ください</p>
            </div>
            <button onClick={() => { setBookTherapistId(0); setFreeMode(true); setBookDate(schedDate); setBookTime("13:00"); setBookStoreId(stores[0]?.id || 0); setSchedView("form"); }} className="w-full py-3 rounded-xl text-[12px] font-medium cursor-pointer text-white" style={{ background: `linear-gradient(135deg, ${C.accent}, ${C.accentDark})` }}>🎲 おまかせフリーで予約リクエスト</button>
            <p className="text-[9px] text-center" style={{ color: C.textFaint }}>※ セラピストはお店にて手配いたします</p>
          </div>

          {/* キャンセルポリシー */}
          <div className="rounded-lg p-3" style={{ backgroundColor: "#c96b8306", border: `1px solid #c96b8315` }}>
            <p className="text-[10px] font-medium mb-1" style={{ color: C.red }}>📌 キャンセル・変更について</p>
            <p className="text-[9px] m-0" style={{ color: C.textMuted, lineHeight: 1.7 }}>ご予約のキャンセル・変更は、必ずお電話にてスタッフまでお申しつけください。<br />当日のキャンセルにつきましては、<strong style={{ color: C.red }}>100％キャンセル料</strong>を頂戴いたします。</p>
            <a href={`tel:${cancelPhone.replace(/[-\s]/g, "")}`} className="inline-flex items-center gap-1 mt-1.5 text-[10px] font-medium no-underline" style={{ color: C.accent }}>📞 {cancelPhone}</a>
          </div>
        </div>)}


        {/* --- 週間スケジュール --- */}
        {schedView === "weekly" && (() => {
          const t = therapists.find(th => th.id === weeklyTid);
          const weekDates = getWeekDates(schedDate);
          return (<>
            <div className="flex items-center gap-3 mb-4">
              <button onClick={() => setSchedView("day")} className="text-[14px] cursor-pointer" style={{ color: C.textMuted }}>← 戻る</button>
              <h2 className="text-[16px] font-medium flex-1">{t?.name || ""} の週間スケジュール</h2>
            </div>
            {/* メモ履歴 */}
            {(() => { const memos = getMemosForTherapist(weeklyTid); return memos.length > 0 ? (<div className="rounded-xl px-4 py-2.5 mb-3" style={{ backgroundColor: "#c3a78210", border: "1px solid #c3a78225" }}><p className="text-[10px] font-medium mb-1.5" style={{ color: C.accent }}>📝 ひとことメモ（{memos.length}件）</p><div className="space-y-1.5">{memos.slice(0, 3).map(m => (<div key={m.id} className="rounded-lg px-2 py-1" style={{ backgroundColor: "#c3a78215" }}><span className="text-[9px]" style={{ color: C.accent }}>{"★".repeat(m.rating)}{"☆".repeat(5 - m.rating)}</span>{m.memo && <p className="text-[10px] mt-0.5" style={{ color: C.textSub }}>{m.memo}</p>}</div>))}{memos.length > 3 && <p className="text-[9px] mt-1" style={{ color: C.textMuted }}>{"他" + (memos.length - 3) + "件のメモ"}</p>}</div></div>) : null; })()}
            {/* 週ナビ */}
            <div className="flex items-center justify-center gap-3 mb-4">
              <button onClick={() => { const nd = dateNav(weekDates[0], -7); setSchedDate(nd); fetchWeekSchedule(weeklyTid, nd); }} className="w-9 h-9 rounded-full flex items-center justify-center cursor-pointer border" style={{ borderColor: C.border, color: C.textSub }}>◀</button>
              <span className="text-[13px] font-medium min-w-[180px] text-center">{dateFmt(weekDates[0])} 〜 {dateFmt(weekDates[6])}</span>
              <button onClick={() => { const nd = dateNav(weekDates[0], 7); setSchedDate(nd); fetchWeekSchedule(weeklyTid, nd); }} className="w-9 h-9 rounded-full flex items-center justify-center cursor-pointer border" style={{ borderColor: C.border, color: C.textSub }}>▶</button>
            </div>
            <div className="space-y-3">
              {weekDates.map(date => {
                const shift = weekShifts.find(s => s.date === date);
                const dRes = weekRes.filter(r => r.date === date);
                const isToday = date === today;
                const isPast = date < today;
                const dt = new Date(date + "T00:00:00");
                const isSun = dt.getDay() === 0; const isSat = dt.getDay() === 6;
                return (
                  <div key={date} className="rounded-xl border overflow-hidden" style={{ backgroundColor: C.card, borderColor: isToday ? C.accent + "44" : C.border }}>
                    <div className="px-4 py-2.5 flex items-center justify-between" style={{ borderBottom: `1px solid ${C.border}`, backgroundColor: isToday ? C.accentBg : "transparent" }}>
                      <span className="text-[13px] font-medium" style={{ color: isSun ? C.red : isSat ? C.blue : isToday ? C.accent : C.text }}>{dateFmt(date)}{isToday && " 📍今日"}</span>
                      {shift ? (<span className="text-[11px]" style={{ color: C.green }}>出勤 {shift.start_time}〜{shift.end_time}</span>) : (<span className="text-[11px]" style={{ color: C.textFaint }}>休み</span>)}
                    </div>
                    {shift && !isPast && (
                      <div className="px-4 py-2 space-y-1">
                        {makeSlots(shift, dRes).map((sl, i) => (
                          <div key={i} className="flex items-center gap-2 py-1 px-2 rounded-lg">
                            <span className="text-[11px] font-mono w-[40px]" style={{ color: sl.available ? C.text : C.textFaint }}>{sl.time}</span>
                            {sl.available ? (
                              <button onClick={() => openBookForm(date, sl.time, weeklyTid)} className="flex-1 py-1 rounded text-[10px] font-medium cursor-pointer text-center" style={{ backgroundColor: "#6b9b7e10", color: C.green, border: `1px solid ${C.green}30` }}>◯ 空き</button>
                            ) : (<span className="flex-1 py-1 rounded text-[10px] text-center" style={{ color: C.textFaint }}>✕ 予約済</span>)}
                          </div>
                        ))}
                      </div>
                    )}
                    {shift && isPast && (<p className="px-4 py-2 text-[10px]" style={{ color: C.textFaint }}>過去の日付です</p>)}
                  </div>
                );
              })}
            </div>
          </>);
        })()}

        {/* --- 予約フォーム --- */}
        {schedView === "form" && (<>
          {!bookDone ? (<>
          <div className="flex items-center gap-3 mb-4">
            <button onClick={() => setSchedView("day")} className="text-[14px] cursor-pointer" style={{ color: C.textMuted }}>← 戻る</button>
            <h2 className="text-[16px] font-medium">予約リクエスト</h2>
          </div>
          <div className="rounded-2xl border p-5 space-y-4" style={{ backgroundColor: C.card, borderColor: C.border }}>
            {/* 選択済み情報 */}
            <div className="rounded-xl p-4" style={{ backgroundColor: C.accentBg, border: `1px solid ${C.accent}30` }}>
              <p className="text-[13px] font-medium" style={{ color: freeMode ? "#378ADD" : C.accent }}>{dateFmt(bookDate)} {bookTime}〜</p>
              {freeMode ? <div className="flex items-center gap-2 mt-1"><span className="text-[12px]" style={{ color: "#378ADD" }}>🎲 おまかせフリー</span><span className="text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: "#378ADD20", color: "#378ADD" }}>📍 {getStoreName(bookStoreId)} ｜ 指名料なし</span></div> : bookTherapistId > 0 && <div className="flex items-center gap-2 mt-1"><span className="text-[12px]" style={{ color: C.textSub }}>👤 {getTherapistName(bookTherapistId)}</span><span className="text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: getNominationType(bookTherapistId).name.includes("本") ? "#c3a78220" : "#85a8c420", color: getNominationType(bookTherapistId).name.includes("本") ? C.accent : C.blue }}>{getNominationType(bookTherapistId).label}</span></div>}
              {!freeMode && bookTherapistId > 0 && getNominationType(bookTherapistId).price > 0 && <p className="text-[10px] mt-0.5" style={{ color: C.textMuted }}>指名料: {fmt(getNominationType(bookTherapistId).price)}</p>}
            </div>

            {/* コース */}
            <div><label className="block text-[11px] mb-1.5" style={{ color: C.textSub }}>コース <span style={{ color: C.red }}>*</span></label><select value={bookCourseId} onChange={e => setBookCourseId(Number(e.target.value))} className="w-full px-4 py-3 rounded-xl text-[13px] outline-none border cursor-pointer" style={inputStyle}><option value={0}>選択してください</option>{courses.map(c => <option key={c.id} value={c.id}>{c.name}（{c.duration}分 / {fmt(c.price)}）</option>)}</select></div>

            {/* オプション */}
            {optionsList.length > 0 && (<div><label className="block text-[11px] mb-1.5" style={{ color: C.textSub }}>✨ オプション</label><div className="space-y-1.5">{optionsList.map(o => { const sel = bookOptions.includes(o.id); return (<button key={o.id} onClick={() => setBookOptions(prev => sel ? prev.filter(x => x !== o.id) : [...prev, o.id])} className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-[12px] cursor-pointer" style={{ backgroundColor: sel ? C.accentBg : C.cardAlt, border: sel ? `1px solid ${C.accent}44` : `1px solid ${C.border}`, color: sel ? C.accent : C.text }}><span>{sel ? "✅ " : ""}{o.name}</span><span style={{ color: C.textMuted }}>+{fmt(o.price)}</span></button>); })}</div></div>)}

            {/* 延長 */}
            {extensions.length > 0 && (<div><label className="block text-[11px] mb-1.5" style={{ color: C.textSub }}>⏰ 延長</label><select value={bookExtId} onChange={e => setBookExtId(Number(e.target.value))} className="w-full px-4 py-3 rounded-xl text-[13px] outline-none border cursor-pointer" style={inputStyle}><option value={0}>なし</option>{extensions.map(e => <option key={e.id} value={e.id}>{e.name}（{e.duration}分 / +{fmt(e.price)}）</option>)}</select></div>)}

            {/* 割引 */}
            {discounts.length > 0 && (<div><label className="block text-[11px] mb-1.5" style={{ color: C.textSub }}>🏷 割引</label><select value={bookDiscountId} onChange={e => setBookDiscountId(Number(e.target.value))} className="w-full px-4 py-3 rounded-xl text-[13px] outline-none border cursor-pointer" style={inputStyle}><option value={0}>なし</option>{discounts.map(d => <option key={d.id} value={d.id}>{d.name}（-{fmt(d.amount)}）</option>)}</select></div>)}

            {/* ポイント利用 */}
            {pointBalance > 0 && (<div><label className="block text-[11px] mb-1.5" style={{ color: C.textSub }}>🎁 ポイント利用（残高: {pointBalance.toLocaleString()}pt）</label><div className="flex items-center gap-2"><input type="number" value={bookPointUse || ""} onChange={e => { const v = Math.min(Math.max(0, parseInt(e.target.value) || 0), pointBalance); setBookPointUse(v); }} placeholder="0" min={0} max={pointBalance} className="flex-1 px-4 py-3 rounded-xl text-[13px] outline-none border" style={inputStyle} /><span className="text-[12px]" style={{ color: C.textMuted }}>pt</span><button onClick={() => setBookPointUse(pointBalance)} className="px-3 py-2 rounded-lg text-[10px] cursor-pointer" style={{ backgroundColor: C.accentBg, color: C.accent }}>全額</button></div>{bookPointUse > 0 && bookPointUse < 1000 && <p className="text-[10px] mt-1" style={{ color: C.red }}>⚠ ポイントは1,000pt以上からご利用いただけます</p>}<p className="text-[9px] mt-1" style={{ color: C.textFaint }}>※ 1,000pt単位でご利用可能（100pt = ¥100割引）</p></div>)}

            {bookStoreId > 0 && <div><label className="block text-[11px] mb-1.5" style={{ color: C.textSub }}>🏠 ルーム</label><div className="px-4 py-3 rounded-xl text-[13px] border" style={{ backgroundColor: C.cardAlt, borderColor: C.border, color: C.text }}>{getStoreName(bookStoreId)}</div></div>}

            <div><label className="block text-[11px] mb-1.5" style={{ color: C.textSub }}>ご要望・備考</label><textarea value={bookNotes} onChange={e => setBookNotes(e.target.value)} rows={3} placeholder="ご要望があればご記入ください" className="w-full px-4 py-3 rounded-xl text-[13px] outline-none border resize-none" style={inputStyle} /></div>

            {/* 料金概算 */}
            {bookCourseId > 0 && (() => {
              const course = courses.find(c => c.id === bookCourseId);
              const nom = getNominationType(bookTherapistId);
              const ext = extensions.find(e => e.id === bookExtId);
              const disc = discounts.find(d => d.id === bookDiscountId);
              const optTotal = optionsList.filter(o => bookOptions.includes(o.id)).reduce((s, o) => s + o.price, 0);
              const total = Math.max(0, (course?.price || 0) + nom.price + optTotal + (ext?.price || 0) - (disc?.amount || 0) - bookPointUse);
              return (<div className="rounded-xl p-3" style={{ backgroundColor: C.cardAlt }}>
                <p className="text-[10px] font-medium mb-2" style={{ color: C.textSub }}>💰 料金概算</p>
                <div className="space-y-1 text-[11px]">
                  <div className="flex justify-between"><span>コース: {course?.name}</span><span>{fmt(course?.price || 0)}</span></div>
                  {nom.price > 0 && <div className="flex justify-between"><span>{nom.name}</span><span>+{fmt(nom.price)}</span></div>}
                  {optTotal > 0 && <div className="flex justify-between"><span>オプション</span><span>+{fmt(optTotal)}</span></div>}
                  {ext && <div className="flex justify-between"><span>{ext.name}</span><span>+{fmt(ext.price)}</span></div>}
                  {disc && <div className="flex justify-between" style={{ color: C.red }}><span>{disc.name}</span><span>-{fmt(disc.amount)}</span></div>}
                  {bookPointUse > 0 && <div className="flex justify-between" style={{ color: C.blue }}><span>ポイント利用</span><span>-{bookPointUse.toLocaleString()}pt</span></div>}
                  <div className="flex justify-between pt-1.5 mt-1.5 text-[14px] font-bold" style={{ borderTop: `1px solid ${C.border}`, color: C.accent }}><span>合計</span><span>{fmt(total)}</span></div>
                </div>
              </div>);
            })()}

            {bookMsg && <div className="px-4 py-3 rounded-xl text-[12px]" style={{ backgroundColor: "#c96b8312", color: C.red }}>{bookMsg}</div>}
            <button onClick={submitBooking} disabled={bookSaving || !bookCourseId} className="w-full py-3.5 rounded-xl text-[14px] font-medium cursor-pointer text-white disabled:opacity-60" style={{ background: `linear-gradient(135deg, ${C.accent}, ${C.accentDark})` }}>{bookSaving ? "送信中..." : "予約リクエストを送信"}</button>
          </div>
          </>) : (
          /* ===== 予約完了案内 ===== */
          <div className="animate-[fadeIn_0.3s]">
            <div className="text-center mb-6">
              <span className="text-[48px]">✅</span>
              <h2 className="text-[20px] font-medium mt-3">予約リクエストを送信しました！</h2>
              <p className="text-[12px] mt-1" style={{ color: C.textMuted }}>{dateFmt(bookDate)} {bookTime}〜 {freeMode ? "🎲 おまかせフリー" : getTherapistName(bookTherapistId)}</p>
            </div>
            <div className="rounded-2xl border p-5 space-y-5" style={{ backgroundColor: C.card, borderColor: C.border }}>
              <h3 className="text-[14px] font-medium text-center" style={{ color: C.accent }}>📋 ご予約の流れ</h3>
              <div className="space-y-4">
                <div className="flex gap-3"><div className="w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-bold flex-shrink-0" style={{ backgroundColor: C.accentBg, color: C.accent }}>1</div><div><p className="text-[13px] font-medium">スタッフが確認します</p><p className="text-[11px] mt-0.5" style={{ color: C.textSub }}>お店のスタッフがご予約内容を確認いたします。</p></div></div>
                <div className="flex gap-3"><div className="w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-bold flex-shrink-0" style={{ backgroundColor: C.accentBg, color: C.accent }}>2</div><div><p className="text-[13px] font-medium">確定メールをお送りします</p><p className="text-[11px] mt-0.5" style={{ color: C.textSub }}>ご登録のメールアドレスに確定メールを送信します。メール内のリンクを開いて詳細をご確認ください。</p><p className="text-[10px] mt-1 px-3 py-2 rounded-lg" style={{ backgroundColor: "#b3841908", color: "#b38419" }}>⚠ 迷惑メールフォルダに入っている場合がございますので、ご確認をお願いいたします。</p></div></div>
                <div className="flex gap-3"><div className="w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-bold flex-shrink-0" style={{ backgroundColor: C.accentBg, color: C.accent }}>3</div><div><p className="text-[13px] font-medium">お部屋の詳細について</p><p className="text-[11px] mt-0.5" style={{ color: C.textSub }}>翌日以降のご予約はお部屋が確定していないため、前日の夜もしくは当日の朝11時までに、ルーム詳細が載ったメールをお送りいたします。</p></div></div>
              </div>
              <div className="rounded-xl p-4" style={{ backgroundColor: C.cardAlt }}>
                <p className="text-[11px] font-medium mb-2" style={{ color: C.textSub }}>⏰ 営業時間外のリクエストについて</p>
                <p className="text-[11px]" style={{ color: C.textMuted }}>翌日11時以降にスタッフが確認し、確定メールをお送りいたしますので、今しばらくお待ちください。</p>
              </div>
              <div className="rounded-xl p-4" style={{ backgroundColor: C.cardAlt }}>
                <p className="text-[11px] font-medium mb-2" style={{ color: C.textSub }}>📞 お電話でのご連絡について</p>
                <p className="text-[11px]" style={{ color: C.textMuted }}>お時間の調整が必要な場合など、お電話でお客様にご連絡する場合もございますので、ご対応をお願いいたします。</p>
              </div>
              <div className="rounded-xl p-4" style={{ backgroundColor: "#c96b8308", border: `1px solid ${C.red}20` }}>
                <p className="text-[11px] font-medium" style={{ color: C.red }}>⚠ ご注意</p>
                <p className="text-[11px] mt-1" style={{ color: C.textSub }}>お電話の対応・確定メールがない場合は、ご予約が確定しておりませんのでご注意ください。</p>
              </div>
              <button onClick={() => { setSchedView("day"); setBookDone(false); }} className="w-full py-3 rounded-xl text-[13px] font-medium cursor-pointer text-white" style={{ background: `linear-gradient(135deg, ${C.accent}, ${C.accentDark})` }}>出勤一覧に戻る</button>
            </div>
          </div>
          )}
        </>)}

        {/* --- 予約履歴 --- */}
        {schedView === "history" && (<>
          <div className="flex items-center gap-3 mb-4">
            <button onClick={() => setSchedView("day")} className="text-[14px] cursor-pointer" style={{ color: C.textMuted }}>← 戻る</button>
            <h2 className="text-[16px] font-medium">予約履歴</h2>
          </div>
          {upcomingRes.length > 0 && (<div className="mb-4"><h3 className="text-[12px] font-medium mb-2" style={{ color: C.accent }}>📅 今後の予約（{upcomingRes.length}件）</h3><div className="space-y-2">{upcomingRes.map(r => (<div key={r.id} className="rounded-xl border p-4" style={{ backgroundColor: C.card, borderColor: C.accent + "44" }}><div className="flex items-center justify-between mb-1"><span className="text-[14px] font-medium" style={{ color: C.accent }}>{dateFmt(r.date)}</span><span className="text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: getStatusBadge(r.status).bg, color: getStatusBadge(r.status).color }}>{getStatusBadge(r.status).label}</span></div><p className="text-[13px]">{r.start_time}〜{r.end_time} {r.course}</p><div className="flex flex-wrap gap-x-3 mt-1 text-[11px]" style={{ color: C.textSub }}>{r.therapist_id > 0 && <span>👤 {getTherapistName(r.therapist_id)}</span>}{r.nomination && <span>⭐ {r.nomination}</span>}</div>{r.total_price > 0 && <p className="text-[13px] mt-1 font-bold" style={{ color: C.accent }}>{fmt(r.total_price)}</p>}{r.total_price > 0 && (r.status === "customer_confirmed" || r.status === "email_sent") && <div className="mt-2 rounded-lg p-2.5" style={{ backgroundColor: "#6b8ba808", border: "1px solid #6b8ba820" }}><p className="text-[10px] mb-1.5" style={{ color: "#6b8ba8" }}>💳 カード決済額: <strong>{fmt(Math.round(r.total_price * 1.1))}</strong>（税10%込）</p><button onClick={() => window.open("https://pay2.star-pay.jp/site/com/shop.php?tel=&payc=A5623&guide=", "_blank")} className="w-full py-2 rounded-lg text-[10px] font-medium cursor-pointer text-white flex items-center justify-center gap-1" style={{ background: "linear-gradient(135deg, #6b8ba8, #5a7897)" }}>💳 クレジットカードで支払う</button></div>}{/* キャンセルボタン */}<div className="mt-2"><button onClick={() => handleCancelClick(r)} className="w-full py-2 rounded-lg text-[10px] font-medium cursor-pointer" style={{ backgroundColor: canCancelDirectly(r) ? "#c96b8310" : "#88878010", color: canCancelDirectly(r) ? C.red : C.textMuted, border: `1px solid ${canCancelDirectly(r) ? "#c96b8325" : "#88878020"}` }}>{canCancelDirectly(r) ? "✕ この予約をキャンセル" : "📞 キャンセル・変更について"}</button></div></div>))}</div></div>)}
          <h3 className="text-[12px] font-medium mb-2" style={{ color: C.textSub }}>🕐 過去のご利用（{pastRes.length}件）</h3>
          {pastRes.length === 0 ? (<p className="text-[12px] text-center py-8" style={{ color: C.textFaint }}>利用履歴がありません</p>) : (<div className="space-y-2">{pastRes.map(r => { const bName = (() => { if (r.free_building_id) { const b = buildings.find(bl => bl.id === r.free_building_id); return b?.name || ""; } return ""; })(); const ptEarned = getReservationPointsEarned(r); const payInfo = getPaymentInfo(r); const memo = getMemo(r.id); return (<div key={r.id} className="rounded-xl border p-4" style={{ backgroundColor: C.card, borderColor: C.border }}><div className="flex items-center justify-between mb-1"><span className="text-[13px] font-medium">{dateFmt(r.date)}</span><span className="text-[12px] font-medium" style={{ color: C.accent }}>{fmt(r.total_price)}</span></div><p className="text-[12px]" style={{ color: C.textSub }}>{r.start_time}〜{r.end_time} {r.course}</p><div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5 text-[10px]" style={{ color: C.textSub }}>{r.therapist_id > 0 && <span>👤 {getTherapistName(r.therapist_id)}</span>}{r.nomination && <span>⭐ {r.nomination}</span>}{r.options_text && <span>✨ {r.options_text}</span>}{bName && <span>🏠 {bName}</span>}</div>{(payInfo || ptEarned > 0) && <div className="flex flex-wrap gap-x-3 mt-1 text-[9px]" style={{ color: C.textMuted }}>{payInfo && <span>{payInfo}</span>}{ptEarned > 0 && <span>🎁 +{ptEarned}pt付与</span>}</div>}{memo ? (<div className="mt-2 rounded-lg px-3 py-2" style={{ backgroundColor: "#c3a78210", border: "1px solid #c3a78225" }}><div className="flex items-center justify-between"><div className="flex items-center gap-1"><span className="text-[9px]" style={{ color: C.accent }}>{"★".repeat(memo.rating)}{"☆".repeat(5 - memo.rating)}</span></div><button onClick={() => openMemoEdit(r.id, r.therapist_id)} className="text-[9px] cursor-pointer" style={{ color: C.accent }}>✏️ 編集</button></div>{memo.memo && <p className="text-[10px] mt-0.5" style={{ color: C.textSub }}>{memo.memo}</p>}</div>) : (<button onClick={() => openMemoEdit(r.id, r.therapist_id)} className="mt-2 w-full py-1.5 rounded-lg text-[9px] cursor-pointer" style={{ color: C.textMuted, backgroundColor: C.cardAlt, border: `1px solid ${C.border}` }}>📝 ひとことメモ</button>)}</div>); })}</div>)}
        </>)}
      </div>)}

      {/* ═══ お気に入り ═══ */}
      {tab === "favorites" && (<div className="animate-[fadeIn_0.3s]">
        {/* 見出し */}
        <div style={{ textAlign: "center", marginBottom: 28, paddingTop: 8 }}>
          <p style={{ margin: 0, fontFamily: FONT_DISPLAY, fontSize: 11, letterSpacing: "0.25em", color: C.accent, textTransform: "uppercase" }}>Favorites</p>
          <h2 style={{ margin: "8px 0 0", fontFamily: FONT_DISPLAY, fontSize: 22, fontWeight: 400, letterSpacing: "0.1em", color: C.text }}>お気に入り</h2>
          <div style={{ width: 32, height: 1, backgroundColor: C.accent, margin: "12px auto" }} />
        </div>

        {/* セラピストセクション */}
        <div style={{ marginBottom: 36 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, paddingLeft: 4 }}>
            <div style={{ width: 20, height: 1, backgroundColor: C.accent }} />
            <span style={{ fontFamily: FONT_DISPLAY, fontSize: 10, letterSpacing: "0.2em", color: C.accent, textTransform: "uppercase" }}>Therapists</span>
          </div>

          {therapists.filter(t => isFav("therapist", t.id)).length === 0 ? (
            <div style={{ padding: "40px 24px", textAlign: "center", backgroundColor: C.card, border: `1px solid ${C.border}`, borderRadius: 6 }}>
              <img src="/mypage/empty-favorite.jpg" alt="" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} style={{ width: "100%", maxWidth: 160, aspectRatio: "1/1", objectFit: "cover", borderRadius: 4, marginBottom: 20, opacity: 0.9 }} />
              <p style={{ margin: 0, fontFamily: FONT_DISPLAY, fontSize: 16, letterSpacing: "0.08em", color: C.text }}>お気に入りはまだありません</p>
              <p style={{ margin: "10px 0 0", fontSize: 11, color: C.textMuted, lineHeight: 1.8 }}>公式サイトで気になるセラピストを<br />見つけてください</p>
              <a href="/therapist" target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", marginTop: 16, padding: "10px 24px", fontSize: 11, color: C.accent, border: `1px solid ${C.accent}`, borderRadius: 2, textDecoration: "none", letterSpacing: "0.12em", fontFamily: FONT_SERIF }}>セラピスト一覧を見る</a>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {therapists.filter(t => isFav("therapist", t.id)).map(t => {
                const memos = getMemosForTherapist(t.id);
                const latestMemo = memos.length > 0 ? memos[0] : null;
                return (
                  <div key={t.id} style={{ backgroundColor: C.card, border: `1px solid ${C.borderPink || C.border}`, borderRadius: 6, overflow: "hidden", position: "relative" }}>
                    <button onClick={() => toggleFav("therapist", t.id)} style={{ position: "absolute", top: 8, right: 8, zIndex: 1, width: 30, height: 30, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.85)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", backdropFilter: "blur(4px)" }}>
                      <IconHeart size={15} color={C.accent} fill={C.accent} />
                    </button>
                    {t.photo_url ? (
                      <img src={t.photo_url} alt={t.name} style={{ width: "100%", aspectRatio: "3/4", objectFit: "cover" }} />
                    ) : (
                      <div style={{ width: "100%", aspectRatio: "3/4", backgroundColor: C.accentBg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT_DISPLAY, fontSize: 48, color: C.accent }}>{t.name.charAt(0)}</div>
                    )}
                    <div style={{ padding: 12 }}>
                      <p style={{ margin: 0, fontFamily: FONT_DISPLAY, fontSize: 15, letterSpacing: "0.05em", color: C.text }}>{t.name}{t.age > 0 && <span style={{ fontSize: 11, color: C.textMuted, marginLeft: 6 }}>({t.age})</span>}</p>
                      {(t.height_cm > 0 || t.bust > 0) && <p style={{ margin: "2px 0 0", fontSize: 10, color: C.textMuted, letterSpacing: "0.03em" }}>T{t.height_cm} B{t.bust}({t.cup}) W{t.waist}</p>}
                      {latestMemo && (
                        <div style={{ marginTop: 8, padding: "6px 8px", backgroundColor: C.accentBg, borderRadius: 4 }}>
                          <StarRating rating={latestMemo.rating} size={9} filledColor={C.accent} emptyColor={C.border} />
                          {latestMemo.memo && <p style={{ margin: "2px 0 0", fontSize: 10, color: C.textSub, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{latestMemo.memo}</p>}
                          {memos.length > 1 && <p style={{ margin: "2px 0 0", fontSize: 9, color: C.textMuted }}>他 {memos.length - 1} 件</p>}
                        </div>
                      )}
                      <button onClick={() => { setTab("schedule"); setSchedView("weekly"); setWeeklyTid(t.id); setSchedDate(today); fetchWeekSchedule(t.id, today); }} style={{ width: "100%", marginTop: 10, padding: "8px 0", fontSize: 10, color: "#fff", backgroundColor: C.accent, border: "none", borderRadius: 2, cursor: "pointer", fontFamily: FONT_SERIF, letterSpacing: "0.1em" }}>スケジュールを見る</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* メモセクション */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, paddingLeft: 4 }}>
            <div style={{ width: 20, height: 1, backgroundColor: C.accent }} />
            <span style={{ fontFamily: FONT_DISPLAY, fontSize: 10, letterSpacing: "0.2em", color: C.accent, textTransform: "uppercase" }}>Memories</span>
          </div>
          {customerMemos.length === 0 ? (
            <div style={{ padding: "32px 24px", textAlign: "center", backgroundColor: C.card, border: `1px solid ${C.border}`, borderRadius: 6 }}>
              <p style={{ margin: 0, fontFamily: FONT_DISPLAY, fontSize: 14, letterSpacing: "0.05em", color: C.textSub }}>まだメモがありません</p>
              <p style={{ margin: "8px 0 0", fontSize: 11, color: C.textMuted }}>ご来店後、予約履歴から感想を残せます</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {customerMemos.sort((a, b) => b.id - a.id).map(m => {
                const r = reservations.find(res => res.id === m.reservation_id);
                const tName = m.therapist_id > 0 ? getTherapistName(m.therapist_id) : "フリー";
                return (
                  <div key={m.id} style={{ padding: 16, backgroundColor: C.card, border: `1px solid ${C.border}`, borderRadius: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 12, fontFamily: FONT_DISPLAY, fontWeight: 400, letterSpacing: "0.05em", color: C.text }}>{tName}</span>
                        <StarRating rating={m.rating} size={10} filledColor={C.accent} emptyColor={C.border} />
                      </div>
                      <button onClick={() => openMemoEdit(m.reservation_id, m.therapist_id)} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, color: C.accent, background: "none", border: "none", cursor: "pointer", fontFamily: FONT_SERIF }}>
                        <IconEdit size={11} color={C.accent} />編集
                      </button>
                    </div>
                    {m.memo && <p style={{ margin: 0, fontSize: 12, color: C.textSub, lineHeight: 1.8 }}>{m.memo}</p>}
                    {r && <p style={{ margin: "8px 0 0", fontSize: 10, color: C.textMuted, fontFamily: FONT_DISPLAY, letterSpacing: "0.05em" }}>{dateFmt(r.date)} {r.start_time}〜 {r.course}</p>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>)}

      {/* ═══ お知らせ ═══ */}
      {tab === "notifications" && (<div className="animate-[fadeIn_0.3s]">
        {/* 見出し（HP風） */}
        <div style={{ textAlign: "center", marginBottom: 28, paddingTop: 8 }}>
          <p style={{ margin: 0, fontFamily: FONT_DISPLAY, fontSize: 11, letterSpacing: "0.25em", color: C.accent, textTransform: "uppercase" }}>Notifications</p>
          <h2 style={{ margin: "8px 0 0", fontFamily: FONT_DISPLAY, fontSize: 22, fontWeight: 400, letterSpacing: "0.1em", color: C.text }}>お知らせ</h2>
          <div style={{ width: 32, height: 1, backgroundColor: C.accent, margin: "12px auto" }} />
          {unreadCount > 0 && (
            <button onClick={markAllRead} style={{
              fontSize: 11,
              color: C.accent,
              background: "none",
              border: `1px solid ${C.accent}40`,
              borderRadius: 2,
              padding: "6px 14px",
              cursor: "pointer",
              fontFamily: FONT_SERIF,
              letterSpacing: "0.08em",
              marginTop: 4,
            }}>すべて既読にする</button>
          )}
        </div>

        {notifications.length === 0 ? (
          <div style={{ padding: "48px 24px", textAlign: "center", backgroundColor: C.card, border: `1px solid ${C.border}`, borderRadius: 6 }}>
            <img src="/mypage/empty-notification.jpg" alt="" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} style={{ width: "100%", maxWidth: 180, aspectRatio: "1/1", objectFit: "cover", borderRadius: 4, marginBottom: 24, opacity: 0.9 }} />
            <p style={{ margin: 0, fontFamily: FONT_DISPLAY, fontSize: 18, letterSpacing: "0.08em", color: C.text }}>新しいお知らせはありません</p>
            <p style={{ margin: "10px 0 0", fontSize: 12, color: C.textMuted, lineHeight: 1.8 }}>キャンペーンや新人紹介などの<br />お知らせがここに表示されます</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {notifications.map(n => {
              const isRead = readNotifIds.includes(n.id);
              return (
                <div key={n.id} onClick={() => markRead(n.id)} style={{
                  padding: 16,
                  backgroundColor: isRead ? C.card : C.accentBg,
                  border: `1px solid ${isRead ? C.border : C.accent + "50"}`,
                  borderRadius: 6,
                  cursor: "pointer",
                }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                        {!isRead && <span style={{ width: 6, height: 6, borderRadius: 999, backgroundColor: C.accent, flexShrink: 0 }} />}
                        <span style={{ fontSize: 14, fontFamily: FONT_DISPLAY, fontWeight: 400, letterSpacing: "0.05em", color: isRead ? C.text : C.accentDark }}>{n.title}</span>
                      </div>
                      {n.body && <p style={{ margin: 0, fontSize: 12, lineHeight: 1.8, color: C.textSub, whiteSpace: "pre-wrap" }}>{linkify(n.body)}</p>}
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
                        <span style={{ fontSize: 9, letterSpacing: "0.1em", padding: "2px 8px", borderRadius: 999, backgroundColor: "transparent", border: `1px solid ${C.border}`, color: C.textMuted }}>{NOTI_LABELS[n.type] || n.type}</span>
                        <span style={{ fontSize: 10, color: C.textFaint, fontFamily: FONT_DISPLAY, letterSpacing: "0.05em" }}>{timeAgo(n.created_at)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>)}

      {/* ═══ 写メ日記 ═══ */}
      {tab === "diary" && customer && (
        <div className="animate-[fadeIn_0.3s]">
          <CustomerDiaryTab
            customerId={customer.id}
            C={C}
            FONT_SERIF={FONT_SERIF}
            FONT_DISPLAY={FONT_DISPLAY}
          />
        </div>
      )}

      {/* ═══ 設定 ═══ */}
      {tab === "settings" && (<div className="animate-[fadeIn_0.3s]" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* 見出し */}
        <div style={{ textAlign: "center", marginBottom: 8, paddingTop: 8 }}>
          <p style={{ margin: 0, fontFamily: FONT_DISPLAY, fontSize: 11, letterSpacing: "0.25em", color: C.accent, textTransform: "uppercase" }}>Account</p>
          <h2 style={{ margin: "8px 0 0", fontFamily: FONT_DISPLAY, fontSize: 22, fontWeight: 400, letterSpacing: "0.1em", color: C.text }}>会員情報</h2>
          <div style={{ width: 32, height: 1, backgroundColor: C.accent, margin: "12px auto" }} />
        </div>

        {/* ═══ 会員情報フォーム ═══ */}
        <div style={{ padding: 22, backgroundColor: C.card, border: `1px solid ${C.border}`, borderRadius: 6, display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={{ display: "block", fontSize: 11, letterSpacing: "0.12em", color: C.textSub, marginBottom: 6 }}>お名前</label>
            <input type="text" value={setSelfN} onChange={e => setSetSelfN(e.target.value)} style={{ width: "100%", padding: "12px 14px", fontSize: 13, backgroundColor: C.cardAlt, border: `1px solid ${C.border}`, borderRadius: 4, outline: "none", fontFamily: FONT_SERIF, color: C.text }} />
          </div>
          <div style={{ paddingBottom: 14, borderBottom: `1px solid ${C.border}` }}>
            <p style={{ margin: 0, fontSize: 11, letterSpacing: "0.12em", color: C.textMuted, marginBottom: 4 }}>電話番号</p>
            <p style={{ margin: 0, fontSize: 14, fontFamily: FONT_DISPLAY, letterSpacing: "0.05em", color: C.text }}>{customer.phone || "—"}</p>
          </div>
          <div>
            <label style={{ display: "block", fontSize: 11, letterSpacing: "0.12em", color: C.textSub, marginBottom: 6 }}>メールアドレス</label>
            <input type="email" value={setEmail} onChange={e => setSetEmail(e.target.value)} style={{ width: "100%", padding: "12px 14px", fontSize: 13, backgroundColor: C.cardAlt, border: `1px solid ${C.border}`, borderRadius: 4, outline: "none", fontFamily: FONT_SERIF, color: C.text }} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 11, letterSpacing: "0.12em", color: C.textSub, marginBottom: 6 }}>お誕生日</label>
            <input type="date" value={setBday} onChange={e => setSetBday(e.target.value)} style={{ width: "100%", padding: "12px 14px", fontSize: 13, backgroundColor: C.cardAlt, border: `1px solid ${C.border}`, borderRadius: 4, outline: "none", fontFamily: FONT_SERIF, color: C.text }} />
            <p style={{ margin: "6px 0 0", fontSize: 10, color: C.textFaint, letterSpacing: "0.03em" }}>誕生月にボーナスポイントをプレゼント</p>
          </div>
          <div>
            <label style={{ display: "block", fontSize: 11, letterSpacing: "0.12em", color: C.textSub, marginBottom: 6 }}>新しいパスワード</label>
            <input type="password" value={setPw} onChange={e => setSetPw(e.target.value)} placeholder="変更する場合のみ入力" style={{ width: "100%", padding: "12px 14px", fontSize: 13, backgroundColor: C.cardAlt, border: `1px solid ${C.border}`, borderRadius: 4, outline: "none", fontFamily: FONT_SERIF, color: C.text }} />
          </div>
          {setPw && (
            <div>
              <label style={{ display: "block", fontSize: 11, letterSpacing: "0.12em", color: C.textSub, marginBottom: 6 }}>パスワード確認</label>
              <input type="password" value={setPwConfirm} onChange={e => setSetPwConfirm(e.target.value)} placeholder="もう一度入力" style={{ width: "100%", padding: "12px 14px", fontSize: 13, backgroundColor: C.cardAlt, border: `1px solid ${C.border}`, borderRadius: 4, outline: "none", fontFamily: FONT_SERIF, color: C.text }} />
            </div>
          )}
          {settingMsg && (
            <div style={{ padding: "12px 14px", backgroundColor: settingMsg.includes("保存しました") ? "#edf3ee" : C.accentBg, color: settingMsg.includes("保存しました") ? C.green : C.accentDark, fontSize: 12, borderRadius: 4, border: `1px solid ${settingMsg.includes("保存しました") ? "#cadbcf" : C.accent + "30"}` }}>
              {settingMsg}
            </div>
          )}
          <button onClick={saveSettings} disabled={settingSaving} style={{ width: "100%", padding: "14px", fontSize: 13, color: "#fff", backgroundColor: C.accent, border: "none", borderRadius: 4, cursor: settingSaving ? "not-allowed" : "pointer", fontFamily: FONT_SERIF, letterSpacing: "0.15em", opacity: settingSaving ? 0.5 : 1 }}>
            {settingSaving ? "保存中..." : "変更を保存"}
          </button>
        </div>

        {/* ═══ プッシュ通知 ═══ */}
        <div style={{ padding: 22, backgroundColor: C.card, border: `1px solid ${C.border}`, borderRadius: 6 }}>
          <p style={{ margin: 0, fontFamily: FONT_DISPLAY, fontSize: 10, letterSpacing: "0.2em", color: C.accent, textTransform: "uppercase" }}>Notifications</p>
          <h3 style={{ margin: "6px 0 4px", fontFamily: FONT_DISPLAY, fontSize: 15, fontWeight: 400, letterSpacing: "0.05em", color: C.text }}>プッシュ通知</h3>
          <p style={{ margin: "0 0 14px", fontSize: 11, color: C.textMuted, lineHeight: 1.7 }}>予約前日のリマインダーやお得なキャンペーン情報を受け取れます。</p>
          <PushToggle userType="customer" userId={customer.id} className="w-full" />
        </div>

        {/* ═══ アンケート通知設定（オプトアウト） ═══ */}
        <div style={{ padding: 22, backgroundColor: C.card, border: `1px solid ${C.border}`, borderRadius: 6 }}>
          <p style={{ margin: 0, fontFamily: FONT_DISPLAY, fontSize: 10, letterSpacing: "0.2em", color: C.accent, textTransform: "uppercase" }}>Survey Settings</p>
          <h3 style={{ margin: "6px 0 4px", fontFamily: FONT_DISPLAY, fontSize: 15, fontWeight: 400, letterSpacing: "0.05em", color: C.text }}>🌸 アンケート通知</h3>
          <p style={{ margin: "0 0 14px", fontSize: 11, color: C.textMuted, lineHeight: 1.7 }}>
            ご来店後のアンケートご回答のお願いをお知らせします。<br />
            ご回答いただくと、次回ご来店時に1,000円OFFを自動適用します。
          </p>

          <label
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 14px",
              backgroundColor: C.cardAlt,
              border: `1px solid ${C.border}`,
              borderRadius: 4,
              cursor: "pointer",
            }}
          >
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: 13, color: C.text, fontWeight: 500 }}>
                アンケートのお願いを受け取る
              </p>
              <p style={{ margin: "4px 0 0", fontSize: 10, color: C.textMuted, lineHeight: 1.6 }}>
                {customer.survey_opt_out
                  ? "現在オフ：アンケートのお知らせは届きません"
                  : "現在オン：施術後のアンケートお知らせが届きます"}
              </p>
            </div>
            <input
              type="checkbox"
              checked={!customer.survey_opt_out}
              onChange={async (e) => {
                const optOut = !e.target.checked;
                await supabase
                  .from("customers")
                  .update({ survey_opt_out: optOut })
                  .eq("id", customer.id);
                setCustomer({ ...customer, survey_opt_out: optOut });
              }}
              style={{
                width: 44,
                height: 24,
                accentColor: C.accent,
                cursor: "pointer",
                marginLeft: 12,
                flexShrink: 0,
              }}
            />
          </label>

          <p style={{ margin: "10px 0 0", fontSize: 10, color: C.textFaint, lineHeight: 1.6 }}>
            ※ オフにしてもアンケートご回答は引き続き可能です。クーポンも問題なく発行されます。
          </p>
        </div>

        {/* ═══ カード情報登録（API連携待ち・UI非表示） ═══
            カード会社APIとの連携確認後にONにする。`false` を `true` に変えるだけで復活。
            関連テーブル: customer_cards（データは保持） */}
        {false && (
        <div style={{ padding: 22, backgroundColor: C.card, border: `1px solid ${C.border}`, borderRadius: 6 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div>
              <p style={{ margin: 0, fontFamily: FONT_DISPLAY, fontSize: 10, letterSpacing: "0.2em", color: C.accent, textTransform: "uppercase" }}>Saved Cards</p>
              <h3 style={{ margin: "6px 0 0", fontFamily: FONT_DISPLAY, fontSize: 15, fontWeight: 400, letterSpacing: "0.05em", color: C.text }}>決済カード</h3>
            </div>
            <button onClick={() => setShowAddCard(true)} style={{ padding: "8px 14px", fontSize: 11, color: C.accent, backgroundColor: "transparent", border: `1px solid ${C.accent}60`, borderRadius: 2, cursor: "pointer", fontFamily: FONT_SERIF, letterSpacing: "0.1em" }}>+ 追加</button>
          </div>
          {cards.length === 0 ? (
            <p style={{ margin: 0, padding: "20px 0", textAlign: "center", fontSize: 12, color: C.textMuted }}>カードが登録されていません</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {cards.map(c => (
                <div key={c.id} style={{ padding: 14, backgroundColor: C.cardAlt, border: c.is_default ? `1px solid ${C.accent}60` : `1px solid ${C.border}`, borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <IconCard size={20} color={C.textSub} />
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 13, fontFamily: FONT_DISPLAY, letterSpacing: "0.08em", color: C.text }}>{c.brand.toUpperCase()} •••• {c.last4}</span>
                        {c.is_default && <span style={{ fontSize: 9, padding: "2px 8px", borderRadius: 999, backgroundColor: C.accentBg, color: C.accentDark, letterSpacing: "0.08em", fontFamily: FONT_SERIF }}>メイン</span>}
                      </div>
                      <span style={{ fontSize: 10, color: C.textMuted, fontFamily: FONT_DISPLAY, letterSpacing: "0.05em" }}>{c.exp_month}/{c.exp_year}</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {!c.is_default && <button onClick={() => setDefaultCard(c.id)} style={{ padding: "4px 10px", fontSize: 9, color: C.accent, backgroundColor: "transparent", border: `1px solid ${C.accent}40`, borderRadius: 2, cursor: "pointer", letterSpacing: "0.08em", fontFamily: FONT_SERIF }}>メインに</button>}
                    <button onClick={() => removeCard(c.id)} style={{ padding: "4px 10px", fontSize: 9, color: C.textMuted, backgroundColor: "transparent", border: `1px solid ${C.border}`, borderRadius: 2, cursor: "pointer", letterSpacing: "0.08em", fontFamily: FONT_SERIF }}>削除</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        )}

        {/* ═══ クレジットカード決済（Star Pay外部連携） ═══ */}
        <div style={{ padding: 22, backgroundColor: C.card, border: `1px solid ${C.border}`, borderRadius: 6 }}>
          <p style={{ margin: 0, fontFamily: FONT_DISPLAY, fontSize: 10, letterSpacing: "0.2em", color: C.accent, textTransform: "uppercase" }}>Payment</p>
          <h3 style={{ margin: "6px 0 4px", fontFamily: FONT_DISPLAY, fontSize: 15, fontWeight: 400, letterSpacing: "0.05em", color: C.text }}>クレジットカード決済</h3>
          <p style={{ margin: "0 0 12px", fontSize: 11, color: C.textMuted, lineHeight: 1.7 }}>事前決済で当日のお支払いがスムーズになります。</p>
          <div style={{ padding: "10px 12px", backgroundColor: C.accentBg, border: `1px solid ${C.accent}30`, borderRadius: 4, marginBottom: 14 }}>
            <p style={{ margin: 0, fontSize: 10, color: C.accentDark, lineHeight: 1.7, letterSpacing: "0.03em" }}>料金には 10% のタックスが加算されます。<br />ご予約が確定してからカード決済をお願いいたします。</p>
          </div>
          <button onClick={() => window.open("https://pay2.star-pay.jp/site/com/shop.php?tel=&payc=A5623&guide=", "_blank")} style={{ width: "100%", padding: "14px", fontSize: 13, color: "#fff", backgroundColor: C.text, border: "none", borderRadius: 4, cursor: "pointer", fontFamily: FONT_SERIF, letterSpacing: "0.15em" }}>
            クレジットカードで支払う
          </button>
          <p style={{ margin: "8px 0 0", fontSize: 10, color: C.textFaint, textAlign: "center", letterSpacing: "0.05em" }}>※ 別サイト（Star Pay）に移動します</p>
        </div>

        {/* ═══ ポイント残高 ═══ */}
        <div style={{ padding: 22, backgroundColor: C.card, border: `1px solid ${C.border}`, borderRadius: 6 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <p style={{ margin: 0, fontFamily: FONT_DISPLAY, fontSize: 10, letterSpacing: "0.2em", color: C.accent, textTransform: "uppercase" }}>Points</p>
              <p style={{ margin: "10px 0 0", fontFamily: FONT_DISPLAY, fontSize: 30, fontWeight: 400, color: C.text, letterSpacing: "0.02em" }}>
                {pointBalance.toLocaleString()}
                <span style={{ fontSize: 12, marginLeft: 4, color: C.textMuted, letterSpacing: 0 }}>pt</span>
              </p>
            </div>
            <button onClick={() => setShowPoints(true)} style={{ padding: "10px 16px", fontSize: 11, color: C.accent, backgroundColor: "transparent", border: `1px solid ${C.accent}60`, borderRadius: 2, cursor: "pointer", fontFamily: FONT_SERIF, letterSpacing: "0.12em" }}>
              履歴を見る
            </button>
          </div>
        </div>
        <div className="rounded-2xl border p-5" style={{ backgroundColor: C.card, borderColor: C.border }}>
              <p className="text-[11px] mb-3" style={{ color: C.textMuted }}>会員ランク</p>
              {(() => {
                const currentRank = customer.rank || "normal";
                const rankIcon = (r: string) => r === "platinum" ? "💎" : r === "gold" ? "🥇" : r === "silver" ? "🥈" : "👤";
                const rankLabel = (r: string) => r === "platinum" ? "プラチナ" : r === "gold" ? "ゴールド" : r === "silver" ? "シルバー" : "一般";
                const rankColor = (r: string) => r === "platinum" ? "#9b59b6" : r === "gold" ? "#f1c40f" : r === "silver" ? "#95a5a6" : C.accent;
                const rankOrder = ["normal", "silver", "gold", "platinum"];
                const currentIdx = rankOrder.indexOf(currentRank);
                const nextRank = currentIdx < rankOrder.length - 1 ? rankOrder[currentIdx + 1] : null;
                const nextRule = nextRank ? rankRules.find(r => r.rank_name === nextRank) : null;
                const currentRule = rankRules.find(r => r.rank_name === currentRank);
                const currentMult = currentRule?.multiplier || 1.0;
                const periodMonths = nextRule?.period_months || 3;
                const needTotal = nextRule?.min_total_visits || 0;
                const needRecent = nextRule?.min_visits_in_period || 0;
                const totalProg = needTotal > 0 ? Math.min(100, Math.round((totalVisits / needTotal) * 100)) : 100;
                const recentProg = needRecent > 0 ? Math.min(100, Math.round((recentVisitCount / needRecent) * 100)) : 100;
                const totalRemain = Math.max(0, needTotal - totalVisits);
                const recentRemain = Math.max(0, needRecent - recentVisitCount);
                return (<>
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-[32px]">{rankIcon(currentRank)}</span>
                    <div>
                      <p className="text-[16px] font-bold" style={{ color: rankColor(currentRank) }}>{rankLabel(currentRank)}会員</p>
                      <p className="text-[10px]" style={{ color: C.textMuted }}>ポイント <strong style={{ color: rankColor(currentRank) }}>×{currentMult}倍</strong> ・ 累計{totalVisits}回ご来店</p>
                    </div>
                  </div>
                  {/* 全ランク表示 */}
                  <div className="flex items-center gap-1 mb-4">
                    {rankOrder.map((r, i) => (
                      <div key={r} className="flex items-center">
                        <div className="flex flex-col items-center">
                          <span className="text-[16px]">{rankIcon(r)}</span>
                          <span className="text-[8px] mt-0.5" style={{ color: r === currentRank ? rankColor(r) : C.textFaint, fontWeight: r === currentRank ? 700 : 400 }}>{rankLabel(r)}</span>
                        </div>
                        {i < rankOrder.length - 1 && <div className="w-8 h-[2px] mx-1 rounded" style={{ backgroundColor: i < currentIdx ? rankColor(rankOrder[i+1]) : C.border }} />}
                      </div>
                    ))}
                  </div>
                  {nextRank && nextRule ? (
                    <div className="rounded-xl p-4" style={{ backgroundColor: C.cardAlt, border: `1px solid ${rankColor(nextRank)}30` }}>
                      <p className="text-[11px] font-medium mb-3" style={{ color: rankColor(nextRank) }}>🎯 {rankLabel(nextRank)}会員まであと少し！</p>
                      {/* 累計来店プログレス */}
                      <div className="mb-3">
                        <div className="flex justify-between mb-1">
                          <span className="text-[10px]" style={{ color: C.textSub }}>累計来店回数</span>
                          <span className="text-[10px] font-medium" style={{ color: totalProg >= 100 ? "#6b9b7e" : C.text }}>{totalVisits} / {needTotal}回 {totalProg >= 100 ? "✅" : `(あと${totalRemain}回)`}</span>
                        </div>
                        <div className="w-full h-[6px] rounded-full overflow-hidden" style={{ backgroundColor: C.border }}>
                          <div className="h-full rounded-full transition-all" style={{ width: `${totalProg}%`, background: totalProg >= 100 ? "#6b9b7e" : `linear-gradient(90deg, ${rankColor(nextRank)}88, ${rankColor(nextRank)})` }} />
                        </div>
                      </div>
                      {/* 直近来店プログレス */}
                      <div className="mb-3">
                        <div className="flex justify-between mb-1">
                          <span className="text-[10px]" style={{ color: C.textSub }}>直近{periodMonths}ヶ月の来店</span>
                          <span className="text-[10px] font-medium" style={{ color: recentProg >= 100 ? "#6b9b7e" : C.text }}>{recentVisitCount} / {needRecent}回 {recentProg >= 100 ? "✅" : `(あと${recentRemain}回)`}</span>
                        </div>
                        <div className="w-full h-[6px] rounded-full overflow-hidden" style={{ backgroundColor: C.border }}>
                          <div className="h-full rounded-full transition-all" style={{ width: `${recentProg}%`, background: recentProg >= 100 ? "#6b9b7e" : `linear-gradient(90deg, ${rankColor(nextRank)}88, ${rankColor(nextRank)})` }} />
                        </div>
                      </div>
                      <p className="text-[9px]" style={{ color: C.textMuted }}>🎁 {rankLabel(nextRank)}になるとポイントが<strong style={{ color: rankColor(nextRank) }}>×{nextRule.multiplier}倍</strong>にアップ！</p>
                    </div>
                  ) : (
                    <div className="rounded-xl p-4 text-center" style={{ backgroundColor: C.cardAlt, border: `1px solid ${rankColor(currentRank)}30` }}>
                      <p className="text-[11px]" style={{ color: rankColor(currentRank) }}>🏆 最高ランクに到達しました！</p>
                      <p className="text-[9px] mt-1" style={{ color: C.textMuted }}>ポイント×{currentMult}倍の特典をお楽しみください</p>
                    </div>
                  )}
                  {/* 全ランク特典一覧 */}
                  <div className="mt-4 space-y-1.5">
                    <p className="text-[10px] font-medium" style={{ color: C.textSub }}>📊 ランク特典一覧</p>
                    {rankRules.filter(r => r.rank_name !== "normal").map(r => {
                      const isCurrent = r.rank_name === currentRank;
                      return (
                      <div key={r.rank_name} className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ backgroundColor: isCurrent ? rankColor(r.rank_name) + "12" : "transparent", border: isCurrent ? `1px solid ${rankColor(r.rank_name)}30` : "1px solid transparent" }}>
                        <div className="flex items-center gap-2">
                          <span className="text-[14px]">{rankIcon(r.rank_name)}</span>
                          <span className="text-[11px]" style={{ color: isCurrent ? rankColor(r.rank_name) : C.textSub, fontWeight: isCurrent ? 600 : 400 }}>{rankLabel(r.rank_name)}</span>
                        </div>
                        <div className="text-[10px] text-right" style={{ color: C.textMuted }}>
                          <span>直近{r.period_months}ヶ月に{r.min_visits_in_period}回 & 累計{r.min_total_visits}回</span>
                          <span className="ml-2 font-medium" style={{ color: rankColor(r.rank_name) }}>×{r.multiplier}倍</span>
                        </div>
                      </div>);
                    })}
                  </div>
                </>);
              })()}
            </div>
      </div>)}
    </div>

    {/* Bottom Nav */}
    <div style={{
      position: "fixed",
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 30,
      backgroundColor: "rgba(255,255,255,0.97)",
      backdropFilter: "blur(12px)",
      borderTop: `1px solid ${C.border}`,
    }}>
      <div style={{ maxWidth: 560, margin: "0 auto", display: "flex" }}>
        {tabs.map(t => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); if (t.key === "schedule") setSchedView("day"); }}
              style={{
                flex: 1,
                padding: "10px 0 14px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 4,
                cursor: "pointer",
                position: "relative",
                background: "none",
                border: "none",
                fontFamily: FONT_SERIF,
                color: active ? C.accent : C.textMuted,
                borderTop: active ? `2px solid ${C.accent}` : "2px solid transparent",
                transition: "color .15s ease",
              }}
            >
              {t.key === "notifications" ? (
                <BellWithBadge count={unreadCount} size={20} color={active ? C.accent : C.textMuted} badgeColor={C.accent} />
              ) : (
                <t.Icon size={20} color={active ? C.accent : C.textMuted} />
              )}
              <span style={{ fontSize: 9, letterSpacing: "0.08em", fontWeight: active ? 500 : 400 }}>{t.label}</span>
            </button>
          );
        })}
      </div>
    </div>

    {/* カード追加モーダル */}
    {showAddCard && (<div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50" onClick={() => setShowAddCard(false)}><div className="rounded-t-2xl sm:rounded-2xl border w-full max-w-md animate-[slideUp_0.3s]" style={{ backgroundColor: C.card, borderColor: C.border }} onClick={e => e.stopPropagation()}><div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: `1px solid ${C.border}` }}><h3 className="text-[16px] font-medium">💳 カード追加</h3><button onClick={() => setShowAddCard(false)} className="text-[14px] cursor-pointer p-1" style={{ color: C.textMuted }}>✕</button></div><div className="px-6 py-4 space-y-4">
      <div><label className="block text-[11px] mb-1.5" style={{ color: C.textSub }}>カードブランド</label><div className="flex gap-2">{["visa", "mastercard", "amex", "jcb", "other"].map(b => (<button key={b} onClick={() => setCardBrand(b)} className="px-3 py-2 rounded-lg text-[11px] cursor-pointer" style={{ backgroundColor: cardBrand === b ? C.accentBg : C.cardAlt, color: cardBrand === b ? C.accent : C.textMuted, border: cardBrand === b ? `1px solid ${C.accent}44` : `1px solid ${C.border}`, fontWeight: cardBrand === b ? 600 : 400 }}>{b.toUpperCase()}</button>))}</div></div>
      <div><label className="block text-[11px] mb-1.5" style={{ color: C.textSub }}>カード番号 下4桁</label><input type="text" value={cardLast4} onChange={e => setCardLast4(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="1234" maxLength={4} className="w-full px-4 py-3 rounded-xl text-[13px] outline-none border" style={inputStyle} /></div>
      <div><label className="block text-[11px] mb-1.5" style={{ color: C.textSub }}>カード名義</label><input type="text" value={cardHolder} onChange={e => setCardHolder(e.target.value)} placeholder="TARO YAMADA" className="w-full px-4 py-3 rounded-xl text-[13px] outline-none border" style={inputStyle} /></div>
      <div className="grid grid-cols-2 gap-3"><div><label className="block text-[11px] mb-1.5" style={{ color: C.textSub }}>有効期限（月）</label><select value={cardExpMonth} onChange={e => setCardExpMonth(Number(e.target.value))} className="w-full px-4 py-3 rounded-xl text-[13px] outline-none border cursor-pointer" style={inputStyle}>{Array.from({ length: 12 }, (_, i) => <option key={i} value={i + 1}>{String(i + 1).padStart(2, "0")}</option>)}</select></div><div><label className="block text-[11px] mb-1.5" style={{ color: C.textSub }}>有効期限（年）</label><select value={cardExpYear} onChange={e => setCardExpYear(Number(e.target.value))} className="w-full px-4 py-3 rounded-xl text-[13px] outline-none border cursor-pointer" style={inputStyle}>{Array.from({ length: 10 }, (_, i) => <option key={i} value={new Date().getFullYear() + i}>{new Date().getFullYear() + i}</option>)}</select></div></div>
      <button onClick={addCard} disabled={!cardLast4 || cardLast4.length !== 4} className="w-full py-3 rounded-xl text-[13px] font-medium cursor-pointer text-white disabled:opacity-60" style={{ background: `linear-gradient(135deg, ${C.accent}, ${C.accentDark})` }}>カードを登録</button>
    </div></div></div>)}

    {/* ポイント履歴モーダル */}
    {showPoints && (()=>{ const now = new Date(); const expiringPts = points.filter(pt => pt.amount > 0 && pt.expires_at && new Date(pt.expires_at) > now && new Date(pt.expires_at) <= new Date(now.getTime() + 30*24*60*60*1000)); const totalExpiring = expiringPts.reduce((s,pt) => s+pt.amount, 0); return (<div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50" onClick={() => setShowPoints(false)}><div className="rounded-t-2xl sm:rounded-2xl border w-full max-w-md max-h-[80vh] overflow-y-auto animate-[slideUp_0.3s]" style={{ backgroundColor: C.card, borderColor: C.border }} onClick={e => e.stopPropagation()}><div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: `1px solid ${C.border}` }}><h3 className="text-[16px] font-medium">🎁 ポイント履歴</h3><button onClick={() => setShowPoints(false)} className="text-[14px] cursor-pointer p-1" style={{ color: C.textMuted }}>✕</button></div><div className="px-6 py-4"><div className="text-center mb-4"><p className="text-[11px]" style={{ color: C.textMuted }}>ポイント残高</p><p className="text-[28px] font-bold" style={{ color: C.accent }}>{pointBalance.toLocaleString()}<span className="text-[12px] font-normal ml-1">pt</span></p>{customer.rank && customer.rank !== "normal" && <p className="text-[10px] mt-1" style={{ color: C.accent }}>{customer.rank === "platinum" ? "💎 プラチナ会員" : customer.rank === "gold" ? "🥇 ゴールド会員" : customer.rank === "silver" ? "🥈 シルバー会員" : ""}</p>}</div>{totalExpiring > 0 && (<div className="rounded-xl p-3 mb-3 flex items-center gap-2" style={{ backgroundColor: "#b3841912", border: "1px solid #b3841930" }}><span className="text-[14px]">⏰</span><div><p className="text-[11px] font-medium" style={{ color: "#b38419" }}>期限切れ間近: {totalExpiring.toLocaleString()}pt</p><p className="text-[9px]" style={{ color: "#b3841988" }}>30日以内に有効期限を迎えるポイントがあります</p></div></div>)}{points.length === 0 ? (<p className="text-center py-4 text-[12px]" style={{ color: C.textFaint }}>ポイント履歴がありません</p>) : (<div className="space-y-2">{points.map(pt => { const isExpiring = pt.amount > 0 && pt.expires_at && new Date(pt.expires_at) > now && new Date(pt.expires_at) <= new Date(now.getTime() + 30*24*60*60*1000); const isExpired = pt.amount > 0 && pt.expires_at && new Date(pt.expires_at) <= now; const desc = pt.description || (pt.type === "earn" ? "ポイント付与" : "ポイント利用"); const icon = desc.includes("初回") ? "🎉" : desc.includes("誕生") ? "🎂" : desc.includes("雨") ? "☔" : desc.includes("曜日") || desc.includes("期間") ? "📅" : desc.includes("アイドル") ? "🕐" : desc.includes("ランク") ? "📈" : desc.includes("アンケート") ? "📝" : pt.amount > 0 ? "💰" : "🏷"; return (<div key={pt.id} className="rounded-xl border p-3" style={{ borderColor: C.border, opacity: isExpired ? 0.4 : 1 }}><div className="flex items-center justify-between"><div className="flex items-center gap-2 flex-1 min-w-0"><span className="text-[14px]">{icon}</span><div className="min-w-0"><p className="text-[12px] font-medium truncate">{desc}{isExpired && <span className="ml-1 text-[9px]" style={{ color: C.red }}>（期限切れ）</span>}</p><div className="flex gap-2 items-center"><span className="text-[10px]" style={{ color: C.textMuted }}>{new Date(pt.created_at).toLocaleDateString("ja-JP")}</span>{pt.expires_at && !isExpired && <span className="text-[9px]" style={{ color: isExpiring ? "#b38419" : C.textFaint }}>{isExpiring ? "⚠ " : ""}期限: {new Date(pt.expires_at).toLocaleDateString("ja-JP")}</span>}</div></div></div><span className="text-[14px] font-bold flex-shrink-0" style={{ color: isExpired ? C.textFaint : pt.amount > 0 ? C.green : C.red }}>{pt.amount > 0 ? "+" : ""}{pt.amount.toLocaleString()}pt</span></div></div>); })}</div>)}</div></div></div>); })()}

    {/* セラピストメモ編集モーダル */}
    {showMemoModal && editMemoResId > 0 && (
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50" onClick={() => setShowMemoModal(false)}>
        <div className="rounded-t-2xl sm:rounded-2xl border w-full max-w-md animate-[slideUp_0.3s]" style={{ backgroundColor: C.card, borderColor: C.border }} onClick={e => e.stopPropagation()}>
          <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: `1px solid ${C.border}` }}>
            <h3 className="text-[16px] font-medium">📝 ひとことメモ</h3>
            <button onClick={() => setShowMemoModal(false)} className="text-[14px] cursor-pointer p-1" style={{ color: C.textMuted }}>✕</button>
          </div>
          <div className="px-6 py-5 space-y-4">
            {editMemoTherapistId > 0 && <p className="text-[12px]" style={{ color: C.textSub }}>👤 {getTherapistName(editMemoTherapistId)}</p>}
            {/* 星評価 */}
            <div>
              <label className="block text-[11px] mb-2" style={{ color: C.textSub }}>⭐ 評価</label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map(star => (
                  <button key={star} onClick={() => setEditMemoRating(star)} className="text-[28px] cursor-pointer transition-all" style={{ color: star <= editMemoRating ? "#b38419" : C.textFaint, transform: star <= editMemoRating ? "scale(1.1)" : "scale(1)" }}>
                    {star <= editMemoRating ? "★" : "☆"}
                  </button>
                ))}
              </div>
            </div>
            {/* メモテキスト */}
            <div>
              <label className="block text-[11px] mb-1.5" style={{ color: C.textSub }}>ひとことメモ</label>
              <textarea value={editMemoText} onChange={e => setEditMemoText(e.target.value)} rows={3} placeholder="例：会話も弾んで、とっても癒された！旅行が趣味らしい。" className="w-full px-4 py-3 rounded-xl text-[13px] outline-none border resize-none" style={inputStyle} />
            </div>
            <button onClick={saveMemo} disabled={memoSaving || editMemoRating === 0} className="w-full py-3 rounded-xl text-[13px] font-medium cursor-pointer text-white disabled:opacity-60" style={{ background: `linear-gradient(135deg, ${C.accent}, ${C.accentDark})` }}>
              {memoSaving ? "保存中..." : "メモを保存"}
            </button>
            {getMemo(editMemoResId) && (
              <button onClick={async () => { const m = getMemo(editMemoResId); if (!m) return; const ok = await confirm({ title: "このメモを削除しますか？", variant: "danger", confirmLabel: "削除する" }); if (!ok) return; await supabase.from("customer_therapist_memos").delete().eq("id", m.id); setShowMemoModal(false); try { const { data: memos } = await supabase.from("customer_therapist_memos").select("*").eq("customer_id", customer!.id); if (memos) setCustomerMemos(memos); } catch {} }} className="w-full py-2.5 rounded-xl text-[12px] cursor-pointer" style={{ color: C.red, backgroundColor: "#c96b8310", border: "1px solid #c96b8320" }}>
                メモを削除
              </button>
            )}
          </div>
        </div>
      </div>
    )}

    {/* キャンセル確認モーダル */}
    {cancelTarget && (
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 px-4" onClick={() => setCancelTarget(null)}>
        <div className="rounded-2xl border w-full max-w-[400px] animate-[slideUp_0.3s]" style={{ backgroundColor: C.card, borderColor: C.border }} onClick={e => e.stopPropagation()}>
          {canCancelDirectly(cancelTarget) ? (<>
            <div className="px-6 py-5 text-center" style={{ borderBottom: `1px solid ${C.border}` }}>
              <p className="text-[28px] mb-2">⚠️</p>
              <h3 className="text-[16px] font-medium mb-1">予約をキャンセルしますか？</h3>
              <p className="text-[12px]" style={{ color: C.textSub }}>{dateFmt(cancelTarget.date)} {cancelTarget.start_time}〜 {cancelTarget.course}</p>
            </div>
            <div className="px-6 py-4">
              {cancelMsg && <p className="text-[12px] text-center mb-3" style={{ color: C.red }}>{cancelMsg}</p>}
              <button onClick={confirmCancel} className="w-full py-3 rounded-xl text-[13px] font-medium cursor-pointer mb-2" style={{ backgroundColor: "#c96b8315", color: C.red, border: "1px solid #c96b8330" }}>キャンセルを確定する</button>
              <button onClick={() => setCancelTarget(null)} className="w-full py-3 rounded-xl text-[13px] font-medium cursor-pointer" style={{ backgroundColor: C.cardAlt, color: C.textSub, border: `1px solid ${C.border}` }}>戻る</button>
            </div>
          </>) : (<>
            <div className="px-6 py-5 text-center" style={{ borderBottom: `1px solid ${C.border}` }}>
              <p className="text-[28px] mb-2">📞</p>
              <h3 className="text-[16px] font-medium mb-1">キャンセル・変更について</h3>
            </div>
            <div className="px-6 py-4">
              <p className="text-[13px] mb-3" style={{ color: C.textSub, lineHeight: 1.8 }}>ご予約は確定しておりますので、<br /><strong style={{ color: C.text }}>キャンセル・変更はお電話にてお願いいたします。</strong></p>
              <a href={`tel:${cancelPhone.replace(/[-\s]/g, "")}`} className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl text-[15px] font-bold no-underline mb-3" style={{ background: `linear-gradient(135deg, #6b9b7e, #5a8a6c)`, color: "#fff" }}>📞 {cancelPhone}</a>
              <div className="rounded-xl p-3 mb-4" style={{ backgroundColor: "#c96b8308", border: "1px solid #c96b8320" }}>
                <p className="text-[10px] m-0" style={{ color: C.red, lineHeight: 1.7 }}>⚠ 当日のキャンセルにつきましては、<strong>100％キャンセル料</strong>を頂戴いたします。</p>
              </div>
              <button onClick={() => setCancelTarget(null)} className="w-full py-3 rounded-xl text-[13px] font-medium cursor-pointer" style={{ background: `linear-gradient(135deg, ${C.accent}, ${C.accentDark})`, color: "#fff", border: "none" }}>閉じる</button>
            </div>
          </>)}
        </div>
      </div>
    )}

    <style jsx global>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes tickerScroll { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        .ticker-scroll { animation: tickerScroll 30s linear infinite; }
        .ticker-scroll:hover { animation-play-state: paused; } @keyframes slideUp { from { opacity: 0; transform: translateY(100%); } to { opacity: 1; transform: translateY(0); } }`}</style>
  </div>);
}
