"use client";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "../../lib/supabase";

type Customer = { id: number; name: string; self_name: string; phone: string; phone2: string; phone3: string; email: string; notes: string; rank: string; login_email: string; login_password: string; created_at: string; birthday: string };
type Reservation = { id: number; customer_name: string; therapist_id: number; date: string; start_time: string; end_time: string; course: string; notes: string; total_price: number; status: string; nomination: string; nomination_fee: number; options_text: string; extension_name: string; extension_price: number; discount_name: string; discount_amount: number; card_base: number; paypay_amount: number; cash_amount: number };
type Therapist = { id: number; name: string; age: number; height_cm: number; bust: number; waist: number; hip: number; cup: string; photo_url: string; status: string };
type Course = { id: number; name: string; duration: number; price: number };
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

const fmt = (n: number) => "¥" + (n || 0).toLocaleString();
const normPhone = (p: string) => p.replace(/[-\s\u3000()（）\u2010-\u2015\uff0d]/g, "");
const C = { bg: "#faf8f5", card: "#ffffff", cardAlt: "#f5f2ed", border: "#e8e3db", accent: "#c3a782", accentDark: "#b09672", accentBg: "#c3a78218", text: "#2d2a24", textSub: "#6b6860", textMuted: "#9e9a91", textFaint: "#c4c0b8", green: "#4a7c59", red: "#c45555", blue: "#3d6b9f" };
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
  return parts.map((part, i) => urlRegex.test(part) ? <a key={i} href={part} target="_blank" rel="noopener noreferrer" style={{ color: "#3d6b9f", textDecoration: "underline" }}>{part}</a> : part);
};

export default function CustomerMypage() {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authEmail, setAuthEmail] = useState(""); const [authPw, setAuthPw] = useState(""); const [authName, setAuthName] = useState(""); const [authPhone, setAuthPhone] = useState(""); const [authError, setAuthError] = useState(""); const [authLoading, setAuthLoading] = useState(false); const [showPw, setShowPw] = useState(false);
  const [tab, setTab] = useState<"home" | "schedule" | "favorites" | "notifications" | "settings">("home");
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
  const [schedSearch, setSchedSearch] = useState("");
  const [showCalendar, setShowCalendar] = useState(false);
  const [selectedSchedTid, setSelectedSchedTid] = useState(0);
  const [schedShifts, setSchedShifts] = useState<Shift[]>([]);
  const [schedRes, setSchedRes] = useState<Reservation[]>([]);
  const [schedLoading, setSchedLoading] = useState(false);
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

  useEffect(() => { const saved = localStorage.getItem("customer_mypage_id"); if (saved) { supabase.from("customers").select("*").eq("id", Number(saved)).single().then(({ data }) => { if (data) { setCustomer(data); setSetEmail(data.login_email || ""); setSetBday(data.birthday || ""); setSetSelfN(data.self_name || data.name || ""); } }); } }, []);

  const fetchData = useCallback(async () => {
    if (!customer) return;
    const { data: r } = await supabase.from("reservations").select("*").eq("customer_name", customer.name).order("date", { ascending: false }); if (r) setReservations(r);
    const { data: t } = await supabase.from("therapists").select("id,name,age,height_cm,bust,waist,hip,cup,photo_url,status").eq("status", "active").order("sort_order"); if (t) setTherapists(t);
    const { data: c } = await supabase.from("courses").select("id,name,duration,price").order("id"); if (c) setCourses(c);
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
    const { data: disc } = await supabase.from("discounts").select("id,name,amount,type").order("id"); if (disc) setDiscounts(disc);
    const { data: ext } = await supabase.from("extensions").select("id,name,duration,price").order("duration"); if (ext) setExtensions(ext);
    const { data: opts } = await supabase.from("options").select("id,name,price").order("id"); if (opts) setOptionsList(opts);
  }, [customer]);
  useEffect(() => { if (customer) fetchData(); }, [customer, fetchData]);

  // 当日スケジュール取得
  const fetchDaySchedule = useCallback(async (date: string) => {
    setSchedLoading(true);
    const { data: sh } = await supabase.from("shifts").select("*").eq("date", date).eq("status", "confirmed").order("start_time"); if (sh) setSchedShifts(sh);
    const { data: res } = await supabase.from("reservations").select("*").eq("date", date).not("status", "eq", "cancelled").order("start_time"); if (res) setSchedRes(res);
    setSchedLoading(false);
  }, []);
  useEffect(() => { if (customer && tab === "schedule") { fetchDaySchedule(schedDate); setSelectedSchedTid(0); } }, [schedDate, tab, customer, fetchDaySchedule]);

  // 週間スケジュール取得
  const fetchWeekSchedule = useCallback(async (tid: number, baseDate: string) => {
    const dates = getWeekDates(baseDate);
    const s = dates[0]; const e = dates[6];
    const { data: sh } = await supabase.from("shifts").select("*").eq("therapist_id", tid).gte("date", s).lte("date", e).eq("status", "confirmed").order("date"); if (sh) setWeekShifts(sh);
    const { data: res } = await supabase.from("reservations").select("*").eq("therapist_id", tid).gte("date", s).lte("date", e).not("status", "eq", "cancelled").order("start_time"); if (res) setWeekRes(res);
  }, []);

  const openWeekly = (tid: number) => { setWeeklyTid(tid); setSchedView("weekly"); fetchWeekSchedule(tid, schedDate); };
  const openBookForm = (date: string, time: string, tid: number) => {
    const shift = schedShifts.find(s => s.therapist_id === tid && s.date === date) || weekShifts.find(s => s.therapist_id === tid && s.date === date);
    setBookDate(date); setBookTime(time); setBookTherapistId(tid); setBookCourseId(0);
    setBookStoreId(shift?.store_id || (stores.length > 0 ? stores[0].id : 0));
    setBookNotes(""); setBookMsg(""); setBookDiscountId(0); setBookOptions([]); setBookExtId(0); setBookPointUse(0); setBookDone(false); setSchedView("form");
  };

  // 指名判定
  const getNominationType = (tid: number): { name: string; label: string; price: number } => {
    if (tid === 0) return { name: "", label: "", price: 0 };
    const pastWithTherapist = reservations.some(r => r.therapist_id === tid && r.status === "completed");
    if (pastWithTherapist) { const n = nominations.find(n => n.name.includes("本指名")); return { name: n?.name || "本指名", label: "⭐ 本指名（リピーター）", price: n?.price || 0 }; }
    else { const n = nominations.find(n => n.name.includes("P指名") || n.name.includes("パネル")); return { name: n?.name || "P指名", label: "✨ P指名（初めて）", price: n?.price || 0 }; }
  };

  // 認証
  const handleLogin = async () => { setAuthError(""); setAuthLoading(true); const { data, error } = await supabase.from("customers").select("*").eq("login_email", authEmail.trim()).eq("login_password", authPw).single(); setAuthLoading(false); if (error || !data) { setAuthError("メールアドレスまたはパスワードが正しくありません"); return; } setCustomer(data); localStorage.setItem("customer_mypage_id", String(data.id)); setSetEmail(data.login_email || ""); setSetBday(data.birthday || ""); setSetSelfN(data.self_name || data.name || ""); };
  const handleRegister = async () => { setAuthError(""); setAuthLoading(true); if (!authName.trim() || !authEmail.trim() || !authPw) { setAuthError("すべての項目を入力してください"); setAuthLoading(false); return; } if (authPw.length < 6) { setAuthError("パスワードは6文字以上にしてください"); setAuthLoading(false); return; } const { data: dup } = await supabase.from("customers").select("id").eq("login_email", authEmail.trim()); if (dup && dup.length > 0) { setAuthError("このメールアドレスは既に登録されています"); setAuthLoading(false); return; } let custId = 0; const ph = normPhone(authPhone); if (ph) { const { data: existing } = await supabase.from("customers").select("*").or(`phone.eq.${ph},phone2.eq.${ph},phone3.eq.${ph}`); if (existing && existing.length > 0) { await supabase.from("customers").update({ self_name: authName.trim(), login_email: authEmail.trim(), login_password: authPw }).eq("id", existing[0].id); custId = existing[0].id; } } if (custId === 0) { const { data: newCust, error: insErr } = await supabase.from("customers").insert({ name: authName.trim(), self_name: authName.trim(), phone: ph, email: authEmail.trim(), login_email: authEmail.trim(), login_password: authPw, rank: "normal" }).select().single(); if (insErr) { setAuthError("登録に失敗しました: " + insErr.message); setAuthLoading(false); return; } if (newCust) custId = newCust.id; } setAuthLoading(false); const { data: loginData } = await supabase.from("customers").select("*").eq("id", custId).single(); if (loginData) { setCustomer(loginData); localStorage.setItem("customer_mypage_id", String(loginData.id)); setSetEmail(loginData.login_email || ""); setSetBday(loginData.birthday || ""); setSetSelfN(loginData.self_name || loginData.name || ""); /* 初回登録ボーナス */ const { data: ps } = await supabase.from("point_settings").select("registration_bonus,expiry_months").limit(1).single(); if (ps && ps.registration_bonus > 0) { const { data: existBonus } = await supabase.from("customer_points").select("id").eq("customer_id", custId).eq("description", "🎉 初回会員登録ボーナス").maybeSingle(); if (!existBonus) { const expAt = new Date(); expAt.setMonth(expAt.getMonth() + (ps.expiry_months || 12)); await supabase.from("customer_points").insert({ customer_id: custId, amount: ps.registration_bonus, type: "earn", description: "🎉 初回会員登録ボーナス", expires_at: expAt.toISOString() }); await supabase.from("customer_notifications").insert({ title: "🎉 ようこそ！登録ボーナスをプレゼント", body: `会員登録ありがとうございます！${ps.registration_bonus}ptをプレゼントしました。ぜひご利用ください♪`, type: "campaign", target_customer_id: custId }); } } } };
  const handleLogout = () => { setCustomer(null); localStorage.removeItem("customer_mypage_id"); setTab("home"); };
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
  const removeCard = async (id: number) => { if (!confirm("このカードを削除しますか？")) return; await supabase.from("customer_cards").delete().eq("id", id); fetchData(); };
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
    const { data: newRes, error } = await supabase.from("reservations").insert({ customer_name: customer.name, therapist_id: bookTherapistId || null, date: bookDate, start_time: bookTime, end_time: endTime, course: course?.name || "", total_price: totalPrice, status: "unprocessed", notes: bookNotes, nomination: nom.name, nomination_fee: nom.price, options_text: optText, options_total: optTotal, extension_name: ext?.name || "", extension_price: ext?.price || 0, extension_duration: ext?.duration || 0, discount_name: disc?.name || "", discount_amount: disc?.amount || 0, point_used: bookPointUse }).select("id").single();
    setBookSaving(false);
    if (error) { setBookMsg("予約に失敗しました: " + error.message); } else { if (bookPointUse > 0 && newRes) { await supabase.from("customer_points").insert({ customer_id: customer.id, amount: -bookPointUse, type: "use", description: `予約利用（仮押さえ）${dateFmt(bookDate)}`, status: "pending", reservation_id: newRes.id }); } setBookDone(true); fetchData(); fetchDaySchedule(bookDate); }
  };
  const saveSettings = async () => { if (!customer) return; setSettingMsg(""); setSettingSaving(true); const updates: Record<string, string | null> = {}; if (setSelfN.trim() && setSelfN.trim() !== (customer.self_name || customer.name)) updates.self_name = setSelfN.trim(); if (setEmail.trim() && setEmail.trim() !== customer.login_email) updates.login_email = setEmail.trim(); if ((setBday || "") !== (customer.birthday || "")) updates.birthday = setBday || null; if (setPw) { if (setPw.length < 6) { setSettingMsg("パスワードは6文字以上にしてください"); setSettingSaving(false); return; } if (setPw !== setPwConfirm) { setSettingMsg("パスワードが一致しません"); setSettingSaving(false); return; } updates.login_password = setPw; } if (Object.keys(updates).length === 0) { setSettingMsg("変更がありません"); setSettingSaving(false); return; } const { error } = await supabase.from("customers").update(updates).eq("id", customer.id); setSettingSaving(false); if (error) setSettingMsg("保存に失敗しました"); else { setSettingMsg("保存しました！"); setSetPw(""); setSetPwConfirm(""); const { data } = await supabase.from("customers").select("*").eq("id", customer.id).single(); if (data) { setCustomer(data); setSetBday(data.birthday || ""); setSetSelfN(data.self_name || data.name || ""); } setTimeout(() => setSettingMsg(""), 2000); } };

  const getTherapistName = (id: number) => therapists.find(t => t.id === id)?.name || "—";
  const getStoreName = (sid: number) => stores.find(s => s.id === sid)?.name || "";
  const getStatusBadge = (status: string): { label: string; color: string; bg: string } => {
    switch (status) {
      case "unprocessed": return { label: "🟡 リクエスト中", color: "#b45309", bg: "#f59e0b18" };
      case "email_sent": return { label: "🔵 確認メール送信済", color: "#3d6b9f", bg: "#3d6b9f18" };
      case "customer_confirmed": return { label: "🟢 お客様確定", color: "#4a7c59", bg: "#4a7c5918" };
      case "completed": return { label: "✅ 完了", color: "#c3a782", bg: "#c3a78218" };
      case "serving": return { label: "💆 接客中", color: "#22c55e", bg: "#22c55e18" };
      case "cancelled": return { label: "❌ キャンセル", color: "#c45555", bg: "#c4555518" };
      default: return { label: status || "未処理", color: "#888780", bg: "#88878018" };
    }
  };
  const today = new Date().toISOString().split("T")[0];
  const upcomingRes = reservations.filter(r => r.date >= today && r.status !== "cancelled").sort((a, b) => a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time));
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
  if (!customer) { return (<div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: C.bg }}><div className="w-full max-w-[400px]"><div className="text-center mb-8"><div className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center text-[24px] font-bold text-white" style={{ background: `linear-gradient(135deg, ${C.accent}, ${C.accentDark})` }}>C</div><h1 className="text-[28px] font-light tracking-[2px]" style={{ color: C.text }}>チョップ</h1><p className="text-[13px] mt-1" style={{ color: C.textMuted }}>お客様マイページ</p></div><div className="rounded-2xl border p-6" style={{ backgroundColor: C.card, borderColor: C.border }}><div className="grid grid-cols-2 gap-2 mb-6"><button onClick={() => { setAuthMode("login"); setAuthError(""); }} className="py-2.5 rounded-xl text-[13px] cursor-pointer" style={{ backgroundColor: authMode === "login" ? C.accentBg : "transparent", color: authMode === "login" ? C.accent : C.textMuted, fontWeight: authMode === "login" ? 600 : 400, border: authMode === "login" ? `1px solid ${C.accent}44` : "1px solid transparent" }}>ログイン</button><button onClick={() => { setAuthMode("register"); setAuthError(""); }} className="py-2.5 rounded-xl text-[13px] cursor-pointer" style={{ backgroundColor: authMode === "register" ? C.accentBg : "transparent", color: authMode === "register" ? C.accent : C.textMuted, fontWeight: authMode === "register" ? 600 : 400, border: authMode === "register" ? `1px solid ${C.accent}44` : "1px solid transparent" }}>新規会員登録</button></div><div className="space-y-4">{authMode === "register" && (<><div><label className="block text-[11px] mb-1.5" style={{ color: C.textSub }}>お名前 <span style={{ color: C.red }}>*</span></label><input type="text" value={authName} onChange={e => setAuthName(e.target.value)} placeholder="山田 太郎" className="w-full px-4 py-3 rounded-xl text-[13px] outline-none border" style={inputStyle} /></div><div><label className="block text-[11px] mb-1.5" style={{ color: C.textSub }}>電話番号（既存データと紐付け）</label><input type="tel" value={authPhone} onChange={e => setAuthPhone(e.target.value)} placeholder="090-1234-5678" className="w-full px-4 py-3 rounded-xl text-[13px] outline-none border" style={inputStyle} /></div></>)}<div><label className="block text-[11px] mb-1.5" style={{ color: C.textSub }}>メールアドレス <span style={{ color: C.red }}>*</span></label><input type="email" value={authEmail} onChange={e => setAuthEmail(e.target.value)} placeholder="example@email.com" className="w-full px-4 py-3 rounded-xl text-[13px] outline-none border" style={inputStyle} /></div><div><label className="block text-[11px] mb-1.5" style={{ color: C.textSub }}>パスワード <span style={{ color: C.red }}>*</span></label><div className="relative"><input type={showPw ? "text" : "password"} value={authPw} onChange={e => setAuthPw(e.target.value)} placeholder="6文字以上" className="w-full px-4 py-3 rounded-xl text-[13px] outline-none border pr-12" style={inputStyle} /><button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] cursor-pointer" style={{ color: C.textMuted }}>{showPw ? "🙈" : "👁"}</button></div></div>{authError && <div className="px-4 py-3 rounded-xl text-[12px]" style={{ backgroundColor: "#c4555512", color: C.red }}>{authError}</div>}<button onClick={authMode === "login" ? handleLogin : handleRegister} disabled={authLoading} className="w-full py-3.5 rounded-xl text-[14px] font-medium cursor-pointer text-white disabled:opacity-60" style={{ background: `linear-gradient(135deg, ${C.accent}, ${C.accentDark})` }}>{authLoading ? "処理中..." : authMode === "login" ? "ログイン" : "会員登録"}</button></div></div><p className="text-center text-[11px] mt-6" style={{ color: C.textFaint }}>ログイン情報はオーナーにお問い合わせください</p></div></div>); }

  const tabs: { key: typeof tab; label: string; icon: string }[] = [{ key: "home", label: "ホーム", icon: "🏠" }, { key: "schedule", label: "予約", icon: "📅" }, { key: "favorites", label: "お気に入り", icon: "❤️" }, { key: "notifications", label: "お知らせ", icon: "🔔" }, { key: "settings", label: "設定", icon: "⚙️" }];

  return (<div className="min-h-screen pb-20" style={{ backgroundColor: C.bg, color: C.text }}>
    {/* Header */}
    <div className="sticky top-0 z-30 border-b backdrop-blur-xl" style={{ backgroundColor: C.card + "ee", borderColor: C.border }}><div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between"><div className="flex items-center gap-3"><div className="w-9 h-9 rounded-full flex items-center justify-center text-[13px] text-white font-medium" style={{ background: `linear-gradient(135deg, ${C.accent}, ${C.accentDark})` }}>{(customer.self_name || customer.name)?.charAt(0)}</div><div><p className="text-[14px] font-medium">{customer.self_name || customer.name} 様</p><p className="text-[10px]" style={{ color: C.textMuted }}>ポイント: <span style={{ color: C.accent, fontWeight: 600 }}>{pointBalance.toLocaleString()}pt</span></p></div></div><div className="flex items-center gap-2"><button onClick={() => setTab("notifications")} className="relative p-2 cursor-pointer"><span className="text-[18px]">🔔</span>{unreadCount > 0 && <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] rounded-full text-[9px] font-bold text-white flex items-center justify-center" style={{ backgroundColor: C.red }}>{unreadCount}</span>}</button><button onClick={handleLogout} className="px-3 py-1.5 text-[10px] rounded-lg cursor-pointer border" style={{ borderColor: C.border, color: C.textMuted }}>ログアウト</button></div></div></div>

    {/* 予約速報テロップ */}
    {tickerMsgs.length > 0 && (
      <div className="overflow-hidden border-b" style={{ backgroundColor: C.accent + "08", borderColor: C.accent + "20", height: 32 }}>
        <div className="ticker-scroll flex items-center gap-16 whitespace-nowrap h-full text-[11px]" style={{ color: C.accent }}>
          {tickerMsgs.map((m, i) => <span key={i} className="inline-block px-4">{m}</span>)}
          {tickerMsgs.map((m, i) => <span key={`dup-${i}`} className="inline-block px-4">{m}</span>)}
        </div>
      </div>
    )}
    <div className="max-w-lg mx-auto px-4 py-4">

      {/* ═══ ホーム ═══ */}
      {tab === "home" && (<div className="space-y-4 animate-[fadeIn_0.3s]">
        {unreadCount > 0 && (<button onClick={() => setTab("notifications")} className="w-full rounded-xl border p-3 flex items-center gap-3 cursor-pointer" style={{ backgroundColor: "#f59e0b08", borderColor: "#f59e0b44" }}><span className="text-[20px]">🔔</span><span className="text-[12px] font-medium" style={{ color: "#b45309" }}>未読のお知らせが{unreadCount}件あります</span><span className="ml-auto text-[11px]" style={{ color: C.textMuted }}>→</span></button>)}
        <button onClick={() => { setTab("schedule"); setSchedView("day"); setSchedDate(today); }} className="w-full py-4 rounded-2xl text-[15px] font-medium cursor-pointer text-white" style={{ background: `linear-gradient(135deg, ${C.accent}, ${C.accentDark})` }}>📅 予約する</button>
        <div className="rounded-2xl border p-5" style={{ backgroundColor: C.card, borderColor: C.border }}><h2 className="text-[13px] font-medium mb-3" style={{ color: C.textSub }}>📅 次回のご予約</h2>{upcomingRes.length === 0 ? (<p className="text-[12px] text-center py-4" style={{ color: C.textFaint }}>現在予約はありません</p>) : (<div className="space-y-3">{upcomingRes.slice(0, 3).map(r => (<div key={r.id} className="rounded-xl p-4" style={{ backgroundColor: C.accentBg, border: `1px solid ${C.accent}30` }}><div className="flex items-center justify-between mb-1"><span className="text-[15px] font-medium" style={{ color: C.accent }}>{dateFmt(r.date)}</span><span className="text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: getStatusBadge(r.status).bg, color: getStatusBadge(r.status).color }}>{getStatusBadge(r.status).label}</span></div><p className="text-[13px]">{r.start_time}〜{r.end_time}</p><div className="flex flex-wrap gap-x-4 mt-1 text-[11px]" style={{ color: C.textSub }}>{r.course && <span>💆 {r.course}</span>}{r.therapist_id > 0 && <span>👤 {getTherapistName(r.therapist_id)}</span>}</div>{r.total_price > 0 && <p className="text-[12px] mt-1 font-medium" style={{ color: C.accent }}>{fmt(r.total_price)}</p>}{r.total_price > 0 && (r.status === "customer_confirmed" || r.status === "email_sent") && <div className="mt-2 rounded-lg p-2" style={{ backgroundColor: "#3d6b9f08", border: "1px solid #3d6b9f20" }}><p className="text-[9px] mb-1" style={{ color: "#3d6b9f" }}>💳 カード決済額: <strong>{fmt(Math.round(r.total_price * 1.1))}</strong>（税10%込）</p><button onClick={(e) => { e.stopPropagation(); window.open("https://pay2.star-pay.jp/site/com/shop.php?tel=&payc=A5623&guide=", "_blank"); }} className="w-full py-1.5 rounded-lg text-[10px] font-medium cursor-pointer text-white flex items-center justify-center gap-1" style={{ background: "linear-gradient(135deg, #3d6b9f, #2d5a8e)" }}>💳 クレジットカードで支払う</button></div>}</div>))}</div>)}</div>
        <div className="grid grid-cols-3 gap-3">{[{ label: "累計来店", value: String(totalVisits), unit: "回", color: C.accent }, { label: "今月利用", value: fmt(monthTotal), unit: "", color: C.green }, { label: "ポイント", value: pointBalance.toLocaleString(), unit: "pt", color: C.blue }].map((s, i) => (<div key={i} className="rounded-xl border p-3 text-center" style={{ backgroundColor: C.card, borderColor: C.border }}><p className="text-[9px] mb-1" style={{ color: C.textMuted }}>{s.label}</p><p className="text-[16px] font-bold" style={{ color: s.color }}>{s.value}<span className="text-[10px] font-normal">{s.unit}</span></p></div>))}</div>
        <div className="rounded-2xl border p-5" style={{ backgroundColor: C.card, borderColor: C.border }}><h2 className="text-[13px] font-medium mb-3" style={{ color: C.textSub }}>🕐 直近のご利用</h2>{pastRes.length === 0 ? (<p className="text-[12px] text-center py-4" style={{ color: C.textFaint }}>利用履歴がありません</p>) : (<div className="space-y-2">{pastRes.slice(0, 5).map(r => (<div key={r.id} className="rounded-xl p-3 border" style={{ borderColor: C.border, backgroundColor: C.cardAlt }}><div className="flex items-center justify-between"><div><span className="text-[12px] font-medium">{dateFmt(r.date)}</span><span className="text-[11px] ml-2" style={{ color: C.textSub }}>{r.course}</span></div>{r.total_price > 0 && <span className="text-[12px] font-medium" style={{ color: C.accent }}>{fmt(r.total_price)}</span>}</div></div>))}{pastRes.length > 5 && <button onClick={() => { setTab("schedule"); setSchedView("history"); }} className="w-full py-2 text-[11px] rounded-lg cursor-pointer" style={{ color: C.accent }}>すべて見る →</button>}</div>)}</div>
      </div>)}

      {/* ═══ スケジュール / 予約 ═══ */}
      {tab === "schedule" && (<div className="animate-[fadeIn_0.3s]">

        {/* --- 当日スケジュール --- */}
        {schedView === "day" && (<>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[16px] font-medium">出勤セラピスト</h2>
            <button onClick={() => setSchedView("history")} className="px-3 py-1.5 text-[10px] rounded-lg cursor-pointer" style={{ color: C.accent, backgroundColor: C.accentBg }}>📋 予約履歴</button>
          </div>

          {/* 日付ナビ + カレンダー */}
          <div className="flex items-center justify-center gap-2 mb-2">
            <button onClick={() => setSchedDate(dateNav(schedDate, -1))} className="w-8 h-8 rounded-full flex items-center justify-center cursor-pointer border" style={{ borderColor: C.border, color: C.textSub }}>◀</button>
            <button onClick={() => setSchedDate(today)} className="px-2.5 py-1 text-[10px] rounded-lg cursor-pointer border" style={{ borderColor: C.border, color: C.textMuted }}>今日</button>
            <span className="text-[15px] font-medium min-w-[110px] text-center" style={{ color: schedDate === today ? C.accent : C.text }}>{dateFmt(schedDate)}</span>
            <button onClick={() => setSchedDate(dateNav(schedDate, 1))} className="w-8 h-8 rounded-full flex items-center justify-center cursor-pointer border" style={{ borderColor: C.border, color: C.textSub }}>▶</button>
            <button onClick={() => setShowCalendar(!showCalendar)} className="w-8 h-8 rounded-full flex items-center justify-center cursor-pointer border" style={{ borderColor: showCalendar ? C.accent + "44" : C.border, color: showCalendar ? C.accent : C.textSub, backgroundColor: showCalendar ? C.accentBg : "transparent" }}>📅</button>
          </div>
          {/* 1週間ボタン */}
          <div className="flex gap-1.5 mb-2 overflow-x-auto">
            {Array.from({ length: 7 }, (_, i) => { const d = dateNav(today, i); const dt = new Date(d + "T00:00:00"); const days = ["日", "月", "火", "水", "木", "金", "土"]; const isSel = schedDate === d; const isSun = dt.getDay() === 0; const isSat = dt.getDay() === 6; return (
              <button key={d} onClick={() => setSchedDate(d)} className="flex-1 min-w-[44px] py-2 rounded-xl text-center cursor-pointer transition-all" style={{ backgroundColor: isSel ? C.accentBg : C.card, border: isSel ? `1px solid ${C.accent}44` : `1px solid ${C.border}`, color: isSel ? C.accent : isSun ? C.red : isSat ? C.blue : C.text }}>
                <span className="block text-[9px]" style={{ color: isSel ? C.accent : isSun ? C.red : isSat ? C.blue : C.textMuted }}>{days[dt.getDay()]}</span>
                <span className="block text-[14px] font-medium">{dt.getDate()}</span>
              </button>
            ); })}
          </div>
          {showCalendar && (
            <div className="mb-3 flex justify-center">
              <input type="date" value={schedDate} onChange={e => { setSchedDate(e.target.value); setShowCalendar(false); }} className="px-4 py-2.5 rounded-xl text-[13px] outline-none border cursor-pointer" style={{ backgroundColor: C.cardAlt, borderColor: C.border, color: C.text }} />
            </div>
          )}

          {/* 検索バー */}
          <div className="relative mb-4">
            <input type="text" value={schedSearch} onChange={e => setSchedSearch(e.target.value)} placeholder="セラピスト名で検索" className="w-full pl-9 pr-4 py-2.5 rounded-xl text-[12px] outline-none border" style={{ backgroundColor: C.cardAlt, borderColor: C.border, color: C.text }} />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[12px]">🔍</span>
            {schedSearch && <button onClick={() => setSchedSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] cursor-pointer" style={{ color: C.textMuted }}>✕</button>}
          </div>

          {/* セラピスト個別スロット表示（選択時） */}
          {selectedSchedTid > 0 ? (() => {
            const shift = schedShifts.find(s => s.therapist_id === selectedSchedTid);
            const t = therapists.find(th => th.id === selectedSchedTid);
            if (!shift || !t) return null;
            const tRes = schedRes.filter(r => r.therapist_id === selectedSchedTid);
            const slots = makeSlots(shift, tRes);
            return (
              <div className="animate-[fadeIn_0.2s]">
                <button onClick={() => setSelectedSchedTid(0)} className="flex items-center gap-1.5 mb-3 text-[13px] cursor-pointer" style={{ color: C.accent }}>← 一覧に戻る</button>
                <div className="rounded-2xl border overflow-hidden mb-3" style={{ backgroundColor: C.card, borderColor: C.border }}>
                  <div className="flex items-center gap-4 p-4" style={{ borderBottom: `1px solid ${C.border}` }}>
                    {t.photo_url ? <img src={t.photo_url} alt="" className="w-20 h-20 rounded-xl object-cover flex-shrink-0" /> : <div className="w-20 h-20 rounded-xl flex items-center justify-center text-[24px] text-white font-bold flex-shrink-0" style={{ background: `linear-gradient(135deg, ${C.accent}, ${C.accentDark})` }}>{t.name.charAt(0)}</div>}
                    <div>
                      <p className="text-[16px] font-medium">{t.name}{t.age > 0 && <span className="text-[12px] font-normal ml-1" style={{ color: C.textMuted }}>({t.age})</span>}</p>
                      {shift.store_id > 0 && <span className="inline-block mt-1 text-[9px] px-2 py-0.5 rounded-full" style={{ backgroundColor: C.accentBg, color: C.accent }}>{getStoreName(shift.store_id)}</span>}
                      <p className="text-[11px] mt-1" style={{ color: C.textSub }}>出勤 {shift.start_time}〜{shift.end_time}</p>
                      {(t.height_cm > 0 || t.bust > 0) && <p className="text-[10px] mt-0.5" style={{ color: C.textMuted }}>T{t.height_cm} B{t.bust}({t.cup}) W{t.waist} H{t.hip}</p>}
                    </div>
                  </div>
                  <div className="flex gap-2 p-3" style={{ borderBottom: `1px solid ${C.border}` }}>
                    <button onClick={() => openWeekly(selectedSchedTid)} className="flex-1 py-2 rounded-lg text-[11px] font-medium cursor-pointer" style={{ backgroundColor: C.accentBg, color: C.accent, border: `1px solid ${C.accent}30` }}>📅 週間スケジュール</button>
                  </div>
                  {/* スロット一覧 */}
                  <div className="px-4 py-2 space-y-1">
                    <p className="text-[10px] mb-1 font-medium" style={{ color: C.textSub }}>{dateFmt(schedDate)} の空き状況</p>
                    {slots.map((sl, i) => (
                      <div key={i} className="flex items-center gap-2 py-1.5 px-2 rounded-lg" style={{ backgroundColor: sl.available ? "transparent" : "#c4555506" }}>
                        <span className="text-[12px] font-mono w-[44px] flex-shrink-0" style={{ color: sl.available ? C.text : C.textFaint }}>{sl.time}</span>
                        {sl.available ? (
                          <button onClick={() => openBookForm(schedDate, sl.time, selectedSchedTid)} className="flex-1 py-1.5 rounded-lg text-[11px] font-medium cursor-pointer text-center" style={{ backgroundColor: "#4a7c5910", color: C.green, border: `1px solid ${C.green}30` }}>◯ 空き — タップで予約</button>
                        ) : (
                          <span className="flex-1 py-1.5 rounded-lg text-[11px] text-center" style={{ color: C.textFaint }}>✕ 予約済</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })() : (
            /* セラピストカード一覧（グリッド） */
            <>
              {schedLoading ? (<p className="text-center py-8 text-[12px]" style={{ color: C.textMuted }}>読み込み中...</p>) : schedShifts.length === 0 ? (
                <div className="rounded-xl border p-8 text-center" style={{ backgroundColor: C.card, borderColor: C.border }}><p className="text-[32px] mb-2">😴</p><p className="text-[12px]" style={{ color: C.textFaint }}>この日の出勤はありません</p></div>
              ) : (() => {
                const filtered = schedShifts.filter(shift => {
                  const t = therapists.find(th => th.id === shift.therapist_id);
                  if (!t) return false;
                  if (schedSearch && !t.name.toLowerCase().includes(schedSearch.toLowerCase())) return false;
                  return true;
                });
                return filtered.length === 0 ? (
                  <div className="rounded-xl border p-8 text-center" style={{ backgroundColor: C.card, borderColor: C.border }}><p className="text-[12px]" style={{ color: C.textFaint }}>該当するセラピストがいません</p></div>
                ) : (
                  <>
                    <p className="text-[11px] mb-2 px-1" style={{ color: C.textMuted }}>{dateFmt(schedDate)} の出勤 — {filtered.length}名</p>
                    <div className="grid grid-cols-2 gap-3">
                      {filtered.map(shift => {
                        const t = therapists.find(th => th.id === shift.therapist_id);
                        if (!t) return null;
                        const tRes = schedRes.filter(r => r.therapist_id === shift.therapist_id);
                        const slots = makeSlots(shift, tRes);
                        const freeCount = slots.filter(s => s.available).length;
                        return (
                          <button key={shift.id} onClick={() => setSelectedSchedTid(shift.therapist_id)} className="rounded-xl border overflow-hidden cursor-pointer text-left transition-all" style={{ backgroundColor: C.card, borderColor: C.border }}>
                            {/* 写真 */}
                            {t.photo_url ? (
                              <img src={t.photo_url} alt="" className="w-full aspect-[3/4] object-cover" />
                            ) : (
                              <div className="w-full aspect-[3/4] flex items-center justify-center text-[36px] text-white font-bold" style={{ background: `linear-gradient(135deg, ${C.accent}, ${C.accentDark})` }}>{t.name.charAt(0)}</div>
                            )}
                            {/* 情報 */}
                            <div className="p-2.5">
                              <p className="text-[13px] font-medium truncate">{t.name}{t.age > 0 && <span className="text-[10px] font-normal" style={{ color: C.textMuted }}>({t.age})</span>}</p>
                              {shift.store_id > 0 && <span className="inline-block mt-1 text-[8px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: C.accentBg, color: C.accent }}>{getStoreName(shift.store_id)}</span>}
                              <p className="text-[10px] mt-1" style={{ color: C.textSub }}>{shift.start_time}〜{shift.end_time}</p>
                              {(t.height_cm > 0 || t.bust > 0) && <p className="text-[9px] mt-0.5" style={{ color: C.textMuted }}>T{t.height_cm} B{t.bust}({t.cup}) W{t.waist} H{t.hip}</p>}
                              <div className="mt-1.5">
                                <span className="text-[9px] px-2 py-0.5 rounded-full" style={{ backgroundColor: freeCount > 0 ? "#4a7c5912" : "#c4555512", color: freeCount > 0 ? C.green : C.red }}>{freeCount > 0 ? `空き${freeCount}枠` : "空きなし"}</span>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </>
                );
              })()}
            </>
          )}
        </>)}

        {/* --- 週間スケジュール --- */}
        {schedView === "weekly" && (() => {
          const t = therapists.find(th => th.id === weeklyTid);
          const weekDates = getWeekDates(schedDate);
          return (<>
            <div className="flex items-center gap-3 mb-4">
              <button onClick={() => setSchedView("day")} className="text-[14px] cursor-pointer" style={{ color: C.textMuted }}>← 戻る</button>
              <h2 className="text-[16px] font-medium">{t?.name || ""} の週間スケジュール</h2>
            </div>
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
                              <button onClick={() => openBookForm(date, sl.time, weeklyTid)} className="flex-1 py-1 rounded text-[10px] font-medium cursor-pointer text-center" style={{ backgroundColor: "#4a7c5910", color: C.green, border: `1px solid ${C.green}30` }}>◯ 空き</button>
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
              <p className="text-[13px] font-medium" style={{ color: C.accent }}>{dateFmt(bookDate)} {bookTime}〜</p>
              {bookTherapistId > 0 && <div className="flex items-center gap-2 mt-1"><span className="text-[12px]" style={{ color: C.textSub }}>👤 {getTherapistName(bookTherapistId)}</span><span className="text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: getNominationType(bookTherapistId).name.includes("本") ? "#c3a78220" : "#85a8c420", color: getNominationType(bookTherapistId).name.includes("本") ? C.accent : C.blue }}>{getNominationType(bookTherapistId).label}</span></div>}
              {bookTherapistId > 0 && getNominationType(bookTherapistId).price > 0 && <p className="text-[10px] mt-0.5" style={{ color: C.textMuted }}>指名料: {fmt(getNominationType(bookTherapistId).price)}</p>}
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

            {bookMsg && <div className="px-4 py-3 rounded-xl text-[12px]" style={{ backgroundColor: "#c4555512", color: C.red }}>{bookMsg}</div>}
            <button onClick={submitBooking} disabled={bookSaving || !bookCourseId} className="w-full py-3.5 rounded-xl text-[14px] font-medium cursor-pointer text-white disabled:opacity-60" style={{ background: `linear-gradient(135deg, ${C.accent}, ${C.accentDark})` }}>{bookSaving ? "送信中..." : "予約リクエストを送信"}</button>
          </div>
          </>) : (
          /* ===== 予約完了案内 ===== */
          <div className="animate-[fadeIn_0.3s]">
            <div className="text-center mb-6">
              <span className="text-[48px]">✅</span>
              <h2 className="text-[20px] font-medium mt-3">予約リクエストを送信しました！</h2>
              <p className="text-[12px] mt-1" style={{ color: C.textMuted }}>{dateFmt(bookDate)} {bookTime}〜 {getTherapistName(bookTherapistId)}</p>
            </div>
            <div className="rounded-2xl border p-5 space-y-5" style={{ backgroundColor: C.card, borderColor: C.border }}>
              <h3 className="text-[14px] font-medium text-center" style={{ color: C.accent }}>📋 ご予約の流れ</h3>
              <div className="space-y-4">
                <div className="flex gap-3"><div className="w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-bold flex-shrink-0" style={{ backgroundColor: C.accentBg, color: C.accent }}>1</div><div><p className="text-[13px] font-medium">スタッフが確認します</p><p className="text-[11px] mt-0.5" style={{ color: C.textSub }}>お店のスタッフがご予約内容を確認いたします。</p></div></div>
                <div className="flex gap-3"><div className="w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-bold flex-shrink-0" style={{ backgroundColor: C.accentBg, color: C.accent }}>2</div><div><p className="text-[13px] font-medium">確定メールをお送りします</p><p className="text-[11px] mt-0.5" style={{ color: C.textSub }}>ご登録のメールアドレスに確定メールを送信します。メール内のリンクを開いて詳細をご確認ください。</p><p className="text-[10px] mt-1 px-3 py-2 rounded-lg" style={{ backgroundColor: "#f59e0b08", color: "#b45309" }}>⚠ 迷惑メールフォルダに入っている場合がございますので、ご確認をお願いいたします。</p></div></div>
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
              <div className="rounded-xl p-4" style={{ backgroundColor: "#c4555508", border: `1px solid ${C.red}20` }}>
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
          {upcomingRes.length > 0 && (<div className="mb-4"><h3 className="text-[12px] font-medium mb-2" style={{ color: C.accent }}>📅 今後の予約（{upcomingRes.length}件）</h3><div className="space-y-2">{upcomingRes.map(r => (<div key={r.id} className="rounded-xl border p-4" style={{ backgroundColor: C.card, borderColor: C.accent + "44" }}><div className="flex items-center justify-between mb-1"><span className="text-[14px] font-medium" style={{ color: C.accent }}>{dateFmt(r.date)}</span><span className="text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: getStatusBadge(r.status).bg, color: getStatusBadge(r.status).color }}>{getStatusBadge(r.status).label}</span></div><p className="text-[13px]">{r.start_time}〜{r.end_time} {r.course}</p><div className="flex flex-wrap gap-x-3 mt-1 text-[11px]" style={{ color: C.textSub }}>{r.therapist_id > 0 && <span>👤 {getTherapistName(r.therapist_id)}</span>}{r.nomination && <span>⭐ {r.nomination}</span>}</div>{r.total_price > 0 && <p className="text-[13px] mt-1 font-bold" style={{ color: C.accent }}>{fmt(r.total_price)}</p>}{r.total_price > 0 && (r.status === "customer_confirmed" || r.status === "email_sent") && <div className="mt-2 rounded-lg p-2.5" style={{ backgroundColor: "#3d6b9f08", border: "1px solid #3d6b9f20" }}><p className="text-[10px] mb-1.5" style={{ color: "#3d6b9f" }}>💳 カード決済額: <strong>{fmt(Math.round(r.total_price * 1.1))}</strong>（税10%込）</p><button onClick={() => window.open("https://pay2.star-pay.jp/site/com/shop.php?tel=&payc=A5623&guide=", "_blank")} className="w-full py-2 rounded-lg text-[10px] font-medium cursor-pointer text-white flex items-center justify-center gap-1" style={{ background: "linear-gradient(135deg, #3d6b9f, #2d5a8e)" }}>💳 クレジットカードで支払う</button></div>}</div>))}</div></div>)}
          <h3 className="text-[12px] font-medium mb-2" style={{ color: C.textSub }}>🕐 過去のご利用（{pastRes.length}件）</h3>
          {pastRes.length === 0 ? (<p className="text-[12px] text-center py-8" style={{ color: C.textFaint }}>利用履歴がありません</p>) : (<div className="space-y-2">{pastRes.map(r => (<div key={r.id} className="rounded-xl border p-4" style={{ backgroundColor: C.card, borderColor: C.border }}><div className="flex items-center justify-between mb-1"><span className="text-[13px] font-medium">{dateFmt(r.date)}</span><span className="text-[12px] font-medium" style={{ color: C.accent }}>{fmt(r.total_price)}</span></div><p className="text-[12px]" style={{ color: C.textSub }}>{r.start_time}〜{r.end_time} {r.course}</p><div className="flex flex-wrap gap-x-3 mt-1 text-[10px]" style={{ color: C.textMuted }}>{r.therapist_id > 0 && <span>👤 {getTherapistName(r.therapist_id)}</span>}{r.nomination && <span>⭐ {r.nomination}</span>}</div></div>))}</div>)}
        </>)}
      </div>)}

      {/* ═══ お気に入り ═══ */}
      {tab === "favorites" && (<div className="animate-[fadeIn_0.3s]"><h2 className="text-[16px] font-medium mb-4">お気に入り</h2><h3 className="text-[12px] font-medium mb-3 px-1" style={{ color: C.textSub }}>💆 セラピスト</h3><div className="grid grid-cols-2 gap-3 mb-6">{therapists.map(t => { const faved = isFav("therapist", t.id); return (<div key={t.id} className="rounded-xl border p-3 relative" style={{ backgroundColor: C.card, borderColor: faved ? C.accent + "66" : C.border }}><button onClick={() => toggleFav("therapist", t.id)} className="absolute top-2 right-2 text-[16px] cursor-pointer" style={{ color: faved ? "#e74c3c" : C.textFaint }}>{faved ? "❤️" : "🤍"}</button><div className="w-12 h-12 rounded-full mx-auto mb-2 flex items-center justify-center text-[16px] text-white font-medium" style={{ background: `linear-gradient(135deg, ${C.accent}, ${C.accentDark})` }}>{t.name.charAt(0)}</div><p className="text-[13px] font-medium text-center">{t.name}</p><div className="flex justify-center gap-2 mt-1 text-[10px]" style={{ color: C.textMuted }}>{t.age > 0 && <span>{t.age}歳</span>}{t.height_cm > 0 && <span>{t.height_cm}cm</span>}{t.cup && <span>{t.cup}カップ</span>}</div>{faved && <button onClick={() => { setTab("schedule"); setSchedView("weekly"); setWeeklyTid(t.id); setSchedDate(today); fetchWeekSchedule(t.id, today); }} className="w-full mt-2 py-1.5 rounded-lg text-[10px] font-medium cursor-pointer text-white" style={{ background: `linear-gradient(135deg, ${C.accent}, ${C.accentDark})` }}>📅 スケジュールを見る</button>}</div>); })}</div><h3 className="text-[12px] font-medium mb-3 px-1" style={{ color: C.textSub }}>📋 コース</h3><div className="space-y-2">{courses.map(c => { const faved = isFav("course", c.id); return (<div key={c.id} className="rounded-xl border p-4 flex items-center justify-between" style={{ backgroundColor: C.card, borderColor: faved ? C.accent + "66" : C.border }}><div className="flex-1"><p className="text-[13px] font-medium">{c.name}</p><div className="flex gap-3 mt-0.5 text-[11px]" style={{ color: C.textMuted }}><span>⏱ {c.duration}分</span><span style={{ color: C.accent, fontWeight: 600 }}>{fmt(c.price)}</span></div></div><button onClick={() => toggleFav("course", c.id)} className="text-[20px] cursor-pointer" style={{ color: faved ? "#e74c3c" : C.textFaint }}>{faved ? "❤️" : "🤍"}</button></div>); })}</div></div>)}

      {/* ═══ お知らせ ═══ */}
      {tab === "notifications" && (<div className="animate-[fadeIn_0.3s]"><div className="flex items-center justify-between mb-4"><h2 className="text-[16px] font-medium">お知らせ</h2>{unreadCount > 0 && <button onClick={markAllRead} className="px-3 py-1.5 text-[10px] rounded-lg cursor-pointer" style={{ color: C.accent, backgroundColor: C.accentBg }}>すべて既読にする</button>}</div>{notifications.length === 0 ? (<div className="rounded-xl border p-8 text-center" style={{ backgroundColor: C.card, borderColor: C.border }}><p className="text-[32px] mb-2">🔔</p><p className="text-[12px]" style={{ color: C.textFaint }}>お知らせはありません</p></div>) : (<div className="space-y-2">{notifications.map(n => { const isRead = readNotifIds.includes(n.id); return (<div key={n.id} onClick={() => markRead(n.id)} className="rounded-xl border p-4 cursor-pointer" style={{ backgroundColor: isRead ? C.card : "#c3a78208", borderColor: isRead ? C.border : C.accent + "44" }}><div className="flex items-start gap-3"><span className="text-[20px]">{NOTI_ICONS[n.type] || "📢"}</span><div className="flex-1"><div className="flex items-center gap-2 mb-1"><span className="text-[13px] font-medium" style={{ color: isRead ? C.text : C.accent }}>{n.title}</span>{!isRead && <span className="w-2 h-2 rounded-full" style={{ backgroundColor: C.red }} />}</div>{n.body && <p className="text-[11px] whitespace-pre-wrap" style={{ color: C.textSub }}>{linkify(n.body)}</p>}<div className="flex items-center gap-2 mt-1.5"><span className="text-[9px] px-2 py-0.5 rounded-full" style={{ backgroundColor: C.cardAlt, color: C.textMuted }}>{NOTI_LABELS[n.type] || n.type}</span><span className="text-[9px]" style={{ color: C.textFaint }}>{timeAgo(n.created_at)}</span></div></div></div></div>); })}</div>)}</div>)}

      {/* ═══ 設定 ═══ */}
      {tab === "settings" && (<div className="animate-[fadeIn_0.3s] space-y-4"><h2 className="text-[16px] font-medium">会員情報設定</h2>
        <div className="rounded-2xl border p-5 space-y-4" style={{ backgroundColor: C.card, borderColor: C.border }}><div><label className="block text-[11px] mb-1.5" style={{ color: C.textSub }}>お名前</label><input type="text" value={setSelfN} onChange={e => setSetSelfN(e.target.value)} className="w-full px-4 py-3 rounded-xl text-[13px] outline-none border" style={inputStyle} /></div><div className="pb-4" style={{ borderBottom: `1px solid ${C.border}` }}><p className="text-[11px] mb-1" style={{ color: C.textMuted }}>電話番号</p><p className="text-[14px]">{customer.phone || "—"}</p></div><div><label className="block text-[11px] mb-1.5" style={{ color: C.textSub }}>メールアドレス</label><input type="email" value={setEmail} onChange={e => setSetEmail(e.target.value)} className="w-full px-4 py-3 rounded-xl text-[13px] outline-none border" style={inputStyle} /></div><div><label className="block text-[11px] mb-1.5" style={{ color: C.textSub }}>🎂 誕生日</label><input type="date" value={setBday} onChange={e => setSetBday(e.target.value)} className="w-full px-4 py-3 rounded-xl text-[13px] outline-none border" style={inputStyle} /><p className="text-[10px] mt-1" style={{ color: C.textFaint }}>誕生月にボーナスポイントが付与されます</p></div><div><label className="block text-[11px] mb-1.5" style={{ color: C.textSub }}>新しいパスワード</label><input type="password" value={setPw} onChange={e => setSetPw(e.target.value)} placeholder="変更する場合のみ入力" className="w-full px-4 py-3 rounded-xl text-[13px] outline-none border" style={inputStyle} /></div>{setPw && <div><label className="block text-[11px] mb-1.5" style={{ color: C.textSub }}>パスワード確認</label><input type="password" value={setPwConfirm} onChange={e => setSetPwConfirm(e.target.value)} placeholder="もう一度入力" className="w-full px-4 py-3 rounded-xl text-[13px] outline-none border" style={inputStyle} /></div>}{settingMsg && <div className="px-4 py-3 rounded-xl text-[12px]" style={{ backgroundColor: settingMsg.includes("保存しました") ? "#4a7c5912" : "#c4555512", color: settingMsg.includes("保存しました") ? C.green : C.red }}>{settingMsg}</div>}<button onClick={saveSettings} disabled={settingSaving} className="w-full py-3 rounded-xl text-[13px] font-medium cursor-pointer text-white disabled:opacity-60" style={{ background: `linear-gradient(135deg, ${C.accent}, ${C.accentDark})` }}>{settingSaving ? "保存中..." : "変更を保存"}</button></div>
        <div className="rounded-2xl border p-5" style={{ backgroundColor: C.card, borderColor: C.border }}><div className="flex items-center justify-between mb-3"><h3 className="text-[13px] font-medium">💳 決済カード</h3><button onClick={() => setShowAddCard(true)} className="px-3 py-1.5 text-[10px] rounded-lg cursor-pointer" style={{ color: C.accent, backgroundColor: C.accentBg }}>+ 追加</button></div>{cards.length === 0 ? (<p className="text-[12px] text-center py-4" style={{ color: C.textFaint }}>カードが登録されていません</p>) : (<div className="space-y-2">{cards.map(c => (<div key={c.id} className="rounded-xl p-3 flex items-center justify-between" style={{ backgroundColor: C.cardAlt, border: c.is_default ? `1px solid ${C.accent}44` : `1px solid ${C.border}` }}><div className="flex items-center gap-3"><span className="text-[20px]">💳</span><div><div className="flex items-center gap-2"><span className="text-[12px] font-medium">{c.brand.toUpperCase()} •••• {c.last4}</span>{c.is_default && <span className="text-[8px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: C.accentBg, color: C.accent }}>メイン</span>}</div><span className="text-[10px]" style={{ color: C.textMuted }}>{c.exp_month}/{c.exp_year}</span></div></div><div className="flex items-center gap-1.5">{!c.is_default && <button onClick={() => setDefaultCard(c.id)} className="px-2 py-1 text-[9px] rounded cursor-pointer" style={{ color: C.accent, backgroundColor: C.accentBg }}>メインに</button>}<button onClick={() => removeCard(c.id)} className="px-2 py-1 text-[9px] rounded cursor-pointer" style={{ color: C.red, backgroundColor: "#c4555512" }}>削除</button></div></div>))}</div>)}</div>
        <div className="rounded-2xl border p-5" style={{ backgroundColor: C.card, borderColor: C.border }}>
              <p className="text-[11px] font-medium mb-3" style={{ color: C.textSub }}>💳 クレジットカード決済</p>
              <p className="text-[10px] mb-1" style={{ color: C.textMuted }}>クレジットカードでのお支払いはこちらから。事前決済で当日のお支払いがスムーズになります。</p>
              <div className="rounded-lg p-2.5 mb-3" style={{ backgroundColor: "#f59e0b08", border: "1px solid #f59e0b30" }}>
                <p className="text-[10px]" style={{ color: "#b45309" }}>⚠ 料金には10%のタックスが加算されます。</p>
                <p className="text-[10px] mt-0.5" style={{ color: "#b45309" }}>⚠ ご予約が確定してからカード決済をお願いいたします。</p>
              </div>
              <button onClick={() => window.open("https://pay2.star-pay.jp/site/com/shop.php?tel=&payc=A5623&guide=", "_blank")} className="w-full py-3 rounded-xl text-[13px] font-medium cursor-pointer text-white flex items-center justify-center gap-2" style={{ background: "linear-gradient(135deg, #3d6b9f, #2d5a8e)" }}>💳 クレジットカードで支払う</button>
              <p className="text-[9px] mt-2 text-center" style={{ color: C.textFaint }}>※ 別サイト（Star Pay）に移動します</p>
            </div>

            <div className="rounded-2xl border p-5" style={{ backgroundColor: C.card, borderColor: C.border }}><div className="flex items-center justify-between"><div><p className="text-[11px]" style={{ color: C.textMuted }}>ポイント残高</p><p className="text-[24px] font-bold" style={{ color: C.accent }}>{pointBalance.toLocaleString()}<span className="text-[12px] font-normal ml-1">pt</span></p></div><button onClick={() => setShowPoints(true)} className="px-3 py-1.5 text-[10px] rounded-lg cursor-pointer" style={{ color: C.accent, backgroundColor: C.accentBg }}>履歴を見る</button></div></div>
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
                          <span className="text-[10px] font-medium" style={{ color: totalProg >= 100 ? "#4a7c59" : C.text }}>{totalVisits} / {needTotal}回 {totalProg >= 100 ? "✅" : `(あと${totalRemain}回)`}</span>
                        </div>
                        <div className="w-full h-[6px] rounded-full overflow-hidden" style={{ backgroundColor: C.border }}>
                          <div className="h-full rounded-full transition-all" style={{ width: `${totalProg}%`, background: totalProg >= 100 ? "#4a7c59" : `linear-gradient(90deg, ${rankColor(nextRank)}88, ${rankColor(nextRank)})` }} />
                        </div>
                      </div>
                      {/* 直近来店プログレス */}
                      <div className="mb-3">
                        <div className="flex justify-between mb-1">
                          <span className="text-[10px]" style={{ color: C.textSub }}>直近{periodMonths}ヶ月の来店</span>
                          <span className="text-[10px] font-medium" style={{ color: recentProg >= 100 ? "#4a7c59" : C.text }}>{recentVisitCount} / {needRecent}回 {recentProg >= 100 ? "✅" : `(あと${recentRemain}回)`}</span>
                        </div>
                        <div className="w-full h-[6px] rounded-full overflow-hidden" style={{ backgroundColor: C.border }}>
                          <div className="h-full rounded-full transition-all" style={{ width: `${recentProg}%`, background: recentProg >= 100 ? "#4a7c59" : `linear-gradient(90deg, ${rankColor(nextRank)}88, ${rankColor(nextRank)})` }} />
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
    <div className="fixed bottom-0 left-0 right-0 z-30 border-t" style={{ backgroundColor: C.card, borderColor: C.border }}><div className="max-w-lg mx-auto flex">{tabs.map(t => (<button key={t.key} onClick={() => { setTab(t.key); if (t.key === "schedule") setSchedView("day"); }} className="flex-1 py-2.5 flex flex-col items-center gap-0.5 cursor-pointer relative" style={{ color: tab === t.key ? C.accent : C.textMuted }}><span className="text-[18px]">{t.icon}</span><span className="text-[9px]" style={{ fontWeight: tab === t.key ? 600 : 400 }}>{t.label}</span>{t.key === "notifications" && unreadCount > 0 && <span className="absolute top-1 right-1/4 min-w-[14px] h-[14px] rounded-full text-[8px] font-bold text-white flex items-center justify-center" style={{ backgroundColor: C.red }}>{unreadCount}</span>}</button>))}</div></div>

    {/* カード追加モーダル */}
    {showAddCard && (<div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50" onClick={() => setShowAddCard(false)}><div className="rounded-t-2xl sm:rounded-2xl border w-full max-w-md animate-[slideUp_0.3s]" style={{ backgroundColor: C.card, borderColor: C.border }} onClick={e => e.stopPropagation()}><div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: `1px solid ${C.border}` }}><h3 className="text-[16px] font-medium">💳 カード追加</h3><button onClick={() => setShowAddCard(false)} className="text-[14px] cursor-pointer p-1" style={{ color: C.textMuted }}>✕</button></div><div className="px-6 py-4 space-y-4">
      <div><label className="block text-[11px] mb-1.5" style={{ color: C.textSub }}>カードブランド</label><div className="flex gap-2">{["visa", "mastercard", "amex", "jcb", "other"].map(b => (<button key={b} onClick={() => setCardBrand(b)} className="px-3 py-2 rounded-lg text-[11px] cursor-pointer" style={{ backgroundColor: cardBrand === b ? C.accentBg : C.cardAlt, color: cardBrand === b ? C.accent : C.textMuted, border: cardBrand === b ? `1px solid ${C.accent}44` : `1px solid ${C.border}`, fontWeight: cardBrand === b ? 600 : 400 }}>{b.toUpperCase()}</button>))}</div></div>
      <div><label className="block text-[11px] mb-1.5" style={{ color: C.textSub }}>カード番号 下4桁</label><input type="text" value={cardLast4} onChange={e => setCardLast4(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="1234" maxLength={4} className="w-full px-4 py-3 rounded-xl text-[13px] outline-none border" style={inputStyle} /></div>
      <div><label className="block text-[11px] mb-1.5" style={{ color: C.textSub }}>カード名義</label><input type="text" value={cardHolder} onChange={e => setCardHolder(e.target.value)} placeholder="TARO YAMADA" className="w-full px-4 py-3 rounded-xl text-[13px] outline-none border" style={inputStyle} /></div>
      <div className="grid grid-cols-2 gap-3"><div><label className="block text-[11px] mb-1.5" style={{ color: C.textSub }}>有効期限（月）</label><select value={cardExpMonth} onChange={e => setCardExpMonth(Number(e.target.value))} className="w-full px-4 py-3 rounded-xl text-[13px] outline-none border cursor-pointer" style={inputStyle}>{Array.from({ length: 12 }, (_, i) => <option key={i} value={i + 1}>{String(i + 1).padStart(2, "0")}</option>)}</select></div><div><label className="block text-[11px] mb-1.5" style={{ color: C.textSub }}>有効期限（年）</label><select value={cardExpYear} onChange={e => setCardExpYear(Number(e.target.value))} className="w-full px-4 py-3 rounded-xl text-[13px] outline-none border cursor-pointer" style={inputStyle}>{Array.from({ length: 10 }, (_, i) => <option key={i} value={new Date().getFullYear() + i}>{new Date().getFullYear() + i}</option>)}</select></div></div>
      <button onClick={addCard} disabled={!cardLast4 || cardLast4.length !== 4} className="w-full py-3 rounded-xl text-[13px] font-medium cursor-pointer text-white disabled:opacity-60" style={{ background: `linear-gradient(135deg, ${C.accent}, ${C.accentDark})` }}>カードを登録</button>
    </div></div></div>)}

    {/* ポイント履歴モーダル */}
    {showPoints && (()=>{ const now = new Date(); const expiringPts = points.filter(pt => pt.amount > 0 && pt.expires_at && new Date(pt.expires_at) > now && new Date(pt.expires_at) <= new Date(now.getTime() + 30*24*60*60*1000)); const totalExpiring = expiringPts.reduce((s,pt) => s+pt.amount, 0); return (<div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50" onClick={() => setShowPoints(false)}><div className="rounded-t-2xl sm:rounded-2xl border w-full max-w-md max-h-[80vh] overflow-y-auto animate-[slideUp_0.3s]" style={{ backgroundColor: C.card, borderColor: C.border }} onClick={e => e.stopPropagation()}><div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: `1px solid ${C.border}` }}><h3 className="text-[16px] font-medium">🎁 ポイント履歴</h3><button onClick={() => setShowPoints(false)} className="text-[14px] cursor-pointer p-1" style={{ color: C.textMuted }}>✕</button></div><div className="px-6 py-4"><div className="text-center mb-4"><p className="text-[11px]" style={{ color: C.textMuted }}>ポイント残高</p><p className="text-[28px] font-bold" style={{ color: C.accent }}>{pointBalance.toLocaleString()}<span className="text-[12px] font-normal ml-1">pt</span></p>{customer.rank && customer.rank !== "normal" && <p className="text-[10px] mt-1" style={{ color: C.accent }}>{customer.rank === "platinum" ? "💎 プラチナ会員" : customer.rank === "gold" ? "🥇 ゴールド会員" : customer.rank === "silver" ? "🥈 シルバー会員" : ""}</p>}</div>{totalExpiring > 0 && (<div className="rounded-xl p-3 mb-3 flex items-center gap-2" style={{ backgroundColor: "#f59e0b12", border: "1px solid #f59e0b30" }}><span className="text-[14px]">⏰</span><div><p className="text-[11px] font-medium" style={{ color: "#f59e0b" }}>期限切れ間近: {totalExpiring.toLocaleString()}pt</p><p className="text-[9px]" style={{ color: "#f59e0b88" }}>30日以内に有効期限を迎えるポイントがあります</p></div></div>)}{points.length === 0 ? (<p className="text-center py-4 text-[12px]" style={{ color: C.textFaint }}>ポイント履歴がありません</p>) : (<div className="space-y-2">{points.map(pt => { const isExpiring = pt.amount > 0 && pt.expires_at && new Date(pt.expires_at) > now && new Date(pt.expires_at) <= new Date(now.getTime() + 30*24*60*60*1000); const isExpired = pt.amount > 0 && pt.expires_at && new Date(pt.expires_at) <= now; const desc = pt.description || (pt.type === "earn" ? "ポイント付与" : "ポイント利用"); const icon = desc.includes("初回") ? "🎉" : desc.includes("誕生") ? "🎂" : desc.includes("雨") ? "☔" : desc.includes("曜日") || desc.includes("期間") ? "📅" : desc.includes("アイドル") ? "🕐" : desc.includes("ランク") ? "📈" : desc.includes("アンケート") ? "📝" : pt.amount > 0 ? "💰" : "🏷"; return (<div key={pt.id} className="rounded-xl border p-3" style={{ borderColor: C.border, opacity: isExpired ? 0.4 : 1 }}><div className="flex items-center justify-between"><div className="flex items-center gap-2 flex-1 min-w-0"><span className="text-[14px]">{icon}</span><div className="min-w-0"><p className="text-[12px] font-medium truncate">{desc}{isExpired && <span className="ml-1 text-[9px]" style={{ color: C.red }}>（期限切れ）</span>}</p><div className="flex gap-2 items-center"><span className="text-[10px]" style={{ color: C.textMuted }}>{new Date(pt.created_at).toLocaleDateString("ja-JP")}</span>{pt.expires_at && !isExpired && <span className="text-[9px]" style={{ color: isExpiring ? "#f59e0b" : C.textFaint }}>{isExpiring ? "⚠ " : ""}期限: {new Date(pt.expires_at).toLocaleDateString("ja-JP")}</span>}</div></div></div><span className="text-[14px] font-bold flex-shrink-0" style={{ color: isExpired ? C.textFaint : pt.amount > 0 ? C.green : C.red }}>{pt.amount > 0 ? "+" : ""}{pt.amount.toLocaleString()}pt</span></div></div>); })}</div>)}</div></div></div>); })()}

    <style jsx global>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes tickerScroll { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        .ticker-scroll { animation: tickerScroll 30s linear infinite; }
        .ticker-scroll:hover { animation-play-state: paused; } @keyframes slideUp { from { opacity: 0; transform: translateY(100%); } to { opacity: 1; transform: translateY(0); } }`}</style>
  </div>);
}
