"use client";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "../../lib/supabase";

/* ═══ Types ═══ */
type Therapist = { id: number; name: string; age: number; height_cm: number; bust: number; waist: number; hip: number; cup: string; photo_url: string; status: string; interval_minutes: number };
type Shift = { id: number; therapist_id: number; date: string; start_time: string; end_time: string; store_id: number; status: string };
type Reservation = { id: number; customer_name: string; therapist_id: number; date: string; start_time: string; end_time: string; course: string; status: string; nomination: string; nomination_fee: number; options_text: string; options_total: number; extension_name: string; extension_price: number; extension_duration: number; discount_name: string; discount_amount: number; total_price: number; point_used: number };
type Course = { id: number; name: string; duration: number; price: number };
type Store = { id: number; name: string };
type Customer = { id: number; name: string; self_name: string; phone: string; phone2: string; phone3: string; email: string; login_email: string; login_password: string; rank: string; birthday: string };
type Nomination = { id: number; name: string; price: number };
type Discount = { id: number; name: string; amount: number; type: string; web_available?: boolean; newcomer_only?: boolean; valid_from?: string; valid_until?: string; combinable?: boolean };
type Extension = { id: number; name: string; duration: number; price: number };
type Option = { id: number; name: string; price: number };

/* ═══ Utils ═══ */
const fmt = (n: number) => "¥" + (n || 0).toLocaleString();
const normPhone = (p: string) => p.replace(/[-\s\u3000()（）\u2010-\u2015\uff0d]/g, "");
const timeToMin = (t: string) => { const [h, m] = t.split(":").map(Number); return (h < 9 ? h + 24 : h) * 60 + m; };
const minToTime = (m: number) => { const h = Math.floor(m / 60); const mi = m % 60; return `${String(h >= 24 ? h - 24 : h).padStart(2, "0")}:${String(mi).padStart(2, "0")}`; };
const dateFmt = (d: string) => { const dt = new Date(d + "T00:00:00"); const days = ["日", "月", "火", "水", "木", "金", "土"]; return `${dt.getMonth() + 1}/${dt.getDate()}(${days[dt.getDay()]})`; };
const dateNav = (d: string, offset: number) => { const dt = new Date(d + "T00:00:00"); dt.setDate(dt.getDate() + offset); return dt.toISOString().split("T")[0]; };
const getWeekDates = (d: string) => { const dt = new Date(d + "T00:00:00"); const w = dt.getDay(); const mon = new Date(dt); mon.setDate(dt.getDate() - (w === 0 ? 6 : w - 1)); return Array.from({ length: 7 }, (_, i) => { const dd = new Date(mon); dd.setDate(mon.getDate() + i); return dd.toISOString().split("T")[0]; }); };

/* ═══ Colors ═══ */
const C = {
  bg: "#0f0f14", bgGrad: "linear-gradient(180deg, #0f0f14 0%, #1a1520 100%)",
  card: "#1a1a22", cardAlt: "#15151d", border: "#2a2a35",
  accent: "#c3a782", accentDark: "#a88d68", accentBg: "rgba(195,167,130,0.08)", accentBorder: "rgba(195,167,130,0.2)",
  text: "#e8e6e2", textSub: "#9a9890", textMuted: "#6a6860", textFaint: "#4a4a44",
  green: "#5a9c6e", greenBg: "rgba(90,156,110,0.1)", greenBorder: "rgba(90,156,110,0.25)",
  red: "#c45555", redBg: "rgba(196,85,85,0.1)",
  purple: "#9b7ec8",
};

/* ═══ Steps ═══ */
type Step = "list" | "therapist" | "course" | "auth" | "confirm" | "done";

export default function PublicSchedule() {
  const today = new Date().toISOString().split("T")[0];

  /* ─── State ─── */
  const [step, setStep] = useState<Step>("list");
  const [date, setDate] = useState(today);
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [nominations, setNominations] = useState<Nomination[]>([]);
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [extensions, setExtensions] = useState<Extension[]>([]);
  const [optionsList, setOptionsList] = useState<Option[]>([]);
  const [loading, setLoading] = useState(true);

  // Selection
  const [selTherapistId, setSelTherapistId] = useState(0);
  const [selTime, setSelTime] = useState("");
  const [selCourseId, setSelCourseId] = useState(0);
  const [selExtId, setSelExtId] = useState(0);
  const [selDiscountId, setSelDiscountId] = useState(0);
  const [selOptions, setSelOptions] = useState<number[]>([]);
  const [selNotes, setSelNotes] = useState("");

  // Auth
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPw, setAuthPw] = useState("");
  const [authName, setAuthName] = useState("");
  const [authPhone, setAuthPhone] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);

  // Booking
  const [bookSaving, setBookSaving] = useState(false);
  const [bookMsg, setBookMsg] = useState("");

  // Weekly view
  const [weeklyMode, setWeeklyMode] = useState(false);
  const [weekShifts, setWeekShifts] = useState<Shift[]>([]);
  const [weekRes, setWeekRes] = useState<Reservation[]>([]);

  // Store name
  const [storeName, setStoreName] = useState("チョップ");

  /* ─── Data fetch ─── */
  const fetchMaster = useCallback(async () => {
    const [tRes, cRes, sRes, nRes, dRes, eRes, oRes, stRes] = await Promise.all([
      supabase.from("therapists").select("id,name,age,height_cm,bust,waist,hip,cup,photo_url,status,interval_minutes").eq("status", "active").order("sort_order"),
      supabase.from("courses").select("id,name,duration,price").order("id"),
      supabase.from("stores").select("id,name").order("id"),
      supabase.from("nominations").select("id,name,price").order("id"),
      supabase.from("discounts").select("id,name,amount,type,web_available,newcomer_only,valid_from,valid_until,combinable").order("id"),
      supabase.from("extensions").select("id,name,duration,price").order("duration"),
      supabase.from("options").select("id,name,price").order("id"),
      supabase.from("store_settings").select("key,value").eq("key", "store_name").maybeSingle(),
    ]);
    if (tRes.data) setTherapists(tRes.data);
    if (cRes.data) setCourses(cRes.data);
    if (sRes.data) setStores(sRes.data);
    if (nRes.data) setNominations(nRes.data);
    if (dRes.data) setDiscounts(dRes.data.filter((d: Discount) => d.web_available !== false));
    if (eRes.data) setExtensions(eRes.data);
    if (oRes.data) setOptionsList(oRes.data);
    if (stRes.data?.value) setStoreName(stRes.data.value);
  }, []);

  const fetchDay = useCallback(async (d: string) => {
    setLoading(true);
    const [shRes, resRes] = await Promise.all([
      supabase.from("shifts").select("*").eq("date", d).eq("status", "confirmed").order("start_time"),
      supabase.from("reservations").select("*").eq("date", d).not("status", "eq", "cancelled").order("start_time"),
    ]);
    if (shRes.data) setShifts(shRes.data);
    if (resRes.data) setReservations(resRes.data);
    setLoading(false);
  }, []);

  const fetchWeek = useCallback(async (tid: number, baseDate: string) => {
    const dates = getWeekDates(baseDate);
    const [shRes, resRes] = await Promise.all([
      supabase.from("shifts").select("*").eq("therapist_id", tid).gte("date", dates[0]).lte("date", dates[6]).eq("status", "confirmed").order("date"),
      supabase.from("reservations").select("*").eq("therapist_id", tid).gte("date", dates[0]).lte("date", dates[6]).not("status", "eq", "cancelled").order("start_time"),
    ]);
    if (shRes.data) setWeekShifts(shRes.data);
    if (resRes.data) setWeekRes(resRes.data);
  }, []);

  useEffect(() => { fetchMaster(); }, [fetchMaster]);
  useEffect(() => { fetchDay(date); }, [date, fetchDay]);
  useEffect(() => {
    const saved = localStorage.getItem("customer_mypage_id");
    if (saved) {
      supabase.from("customers").select("*").eq("id", Number(saved)).single().then(({ data }) => { if (data) setCustomer(data); });
    }
  }, []);

  /* ─── Slot generation ─── */
  const makeSlots = (shift: Shift, resForTherapist: Reservation[]) => {
    const ss = timeToMin(shift.start_time); const se = timeToMin(shift.end_time);
    const slots: { time: string; available: boolean }[] = [];
    for (let m = ss; m < se; m += 15) {
      const t = minToTime(m);
      const busy = resForTherapist.find(r => { const rs = timeToMin(r.start_time); const re = timeToMin(r.end_time); return m >= rs && m < re; });
      slots.push({ time: t, available: !busy });
    }
    return slots;
  };

  /* ─── Nomination logic ─── */
  const getNominationType = (tid: number): { name: string; label: string; price: number } => {
    if (tid === 0 || !customer) return { name: "P指名", label: "✨ P指名", price: nominations.find(n => n.name.includes("P指名") || n.name.includes("パネル"))?.price || 0 };
    // No history check without customer reservations - default to P指名
    return { name: "P指名", label: "✨ P指名（初回）", price: nominations.find(n => n.name.includes("P指名") || n.name.includes("パネル"))?.price || 0 };
  };

  /* ─── Helpers ─── */
  const getStoreName = (sid: number) => stores.find(s => s.id === sid)?.name || "";
  const selTherapist = therapists.find(t => t.id === selTherapistId);
  const selShift = shifts.find(s => s.therapist_id === selTherapistId);
  const selCourse = courses.find(c => c.id === selCourseId);

  /* ─── Actions ─── */
  const selectTherapist = (tid: number) => {
    setSelTherapistId(tid);
    setSelTime("");
    setSelCourseId(0);
    setSelExtId(0);
    setSelDiscountId(0);
    setSelOptions([]);
    setSelNotes("");
    setWeeklyMode(false);
    setStep("therapist");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const selectTime = (time: string) => {
    setSelTime(time);
    setStep("course");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const goToAuth = () => {
    if (!selCourseId) return;
    if (customer) {
      // Already logged in — skip auth, go to confirm
      setStep("confirm");
    } else {
      setStep("auth");
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const goBack = (target: Step) => {
    setStep(target);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  /* ─── Auth ─── */
  const handleLogin = async () => {
    setAuthError(""); setAuthLoading(true);
    const { data, error } = await supabase.from("customers").select("*").eq("login_email", authEmail.trim()).eq("login_password", authPw).single();
    setAuthLoading(false);
    if (error || !data) { setAuthError("メールアドレスまたはパスワードが正しくありません"); return; }
    setCustomer(data);
    localStorage.setItem("customer_mypage_id", String(data.id));
    setStep("confirm");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleRegister = async () => {
    setAuthError(""); setAuthLoading(true);
    if (!authName.trim() || !authEmail.trim() || !authPw) { setAuthError("すべての項目を入力してください"); setAuthLoading(false); return; }
    if (authPw.length < 6) { setAuthError("パスワードは6文字以上にしてください"); setAuthLoading(false); return; }
    const { data: dup } = await supabase.from("customers").select("id").eq("login_email", authEmail.trim());
    if (dup && dup.length > 0) { setAuthError("このメールアドレスは既に登録されています"); setAuthLoading(false); return; }
    let custId = 0;
    const ph = normPhone(authPhone);
    if (ph) {
      const { data: existing } = await supabase.from("customers").select("*").or(`phone.eq.${ph},phone2.eq.${ph},phone3.eq.${ph}`);
      if (existing && existing.length > 0) {
        await supabase.from("customers").update({ self_name: authName.trim(), login_email: authEmail.trim(), login_password: authPw }).eq("id", existing[0].id);
        custId = existing[0].id;
      }
    }
    if (custId === 0) {
      const { data: newCust, error: insErr } = await supabase.from("customers").insert({ name: authName.trim(), self_name: authName.trim(), phone: ph, email: authEmail.trim(), login_email: authEmail.trim(), login_password: authPw, rank: "normal" }).select().single();
      if (insErr) { setAuthError("登録に失敗しました: " + insErr.message); setAuthLoading(false); return; }
      if (newCust) custId = newCust.id;
    }
    // 初回登録ボーナス
    const { data: ps } = await supabase.from("point_settings").select("registration_bonus,expiry_months").limit(1).single();
    if (ps && ps.registration_bonus > 0) {
      const { data: existBonus } = await supabase.from("customer_points").select("id").eq("customer_id", custId).eq("description", "🎉 初回会員登録ボーナス").maybeSingle();
      if (!existBonus) {
        const expAt = new Date(); expAt.setMonth(expAt.getMonth() + (ps.expiry_months || 12));
        await supabase.from("customer_points").insert({ customer_id: custId, amount: ps.registration_bonus, type: "earn", description: "🎉 初回会員登録ボーナス", expires_at: expAt.toISOString() });
      }
    }
    setAuthLoading(false);
    const { data: loginData } = await supabase.from("customers").select("*").eq("id", custId).single();
    if (loginData) {
      setCustomer(loginData);
      localStorage.setItem("customer_mypage_id", String(loginData.id));
      setStep("confirm");
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  /* ─── Submit Booking ─── */
  const submitBooking = async () => {
    if (!customer || !selTime || !selCourseId) return;
    setBookSaving(true); setBookMsg("");
    const course = courses.find(c => c.id === selCourseId);
    const ext = extensions.find(e => e.id === selExtId);
    const dur = (course?.duration || 60) + (ext?.duration || 0);
    const endTime = minToTime(timeToMin(selTime) + dur);
    const nom = getNominationType(selTherapistId);
    const disc = discounts.find(d => d.id === selDiscountId);
    const selOpts = optionsList.filter(o => selOptions.includes(o.id));
    const optText = selOpts.map(o => o.name).join(",");
    const optTotal = selOpts.reduce((s, o) => s + o.price, 0);
    const totalPrice = Math.max(0, (course?.price || 0) + nom.price + optTotal + (ext?.price || 0) - (disc?.amount || 0));

    const { error } = await supabase.from("reservations").insert({
      customer_name: customer.name, therapist_id: selTherapistId || null,
      date, start_time: selTime, end_time: endTime,
      course: course?.name || "", total_price: totalPrice,
      status: "unprocessed", customer_status: "web_reservation",
      notes: selNotes, nomination: nom.name, nomination_fee: nom.price,
      options_text: optText, options_total: optTotal,
      extension_name: ext?.name || "", extension_price: ext?.price || 0, extension_duration: ext?.duration || 0,
      discount_name: disc?.name || "", discount_amount: disc?.amount || 0,
      point_used: 0,
    });
    setBookSaving(false);
    if (error) { setBookMsg("予約に失敗しました: " + error.message); }
    else { setStep("done"); window.scrollTo({ top: 0, behavior: "smooth" }); }
  };

  /* ─── Price calc ─── */
  const calcTotal = () => {
    const course = courses.find(c => c.id === selCourseId);
    const ext = extensions.find(e => e.id === selExtId);
    const nom = getNominationType(selTherapistId);
    const disc = discounts.find(d => d.id === selDiscountId);
    const optTotal = optionsList.filter(o => selOptions.includes(o.id)).reduce((s, o) => s + o.price, 0);
    return Math.max(0, (course?.price || 0) + nom.price + optTotal + (ext?.price || 0) - (disc?.amount || 0));
  };

  /* ═══ Styles ═══ */
  const btnPrimary = { background: `linear-gradient(135deg, ${C.accent}, ${C.accentDark})`, color: "#fff", border: "none" };
  const btnOutline = { backgroundColor: "transparent", border: `1px solid ${C.accentBorder}`, color: C.accent };
  const cardStyle = { backgroundColor: C.card, border: `1px solid ${C.border}`, borderRadius: 16 };
  const inputStyle = { backgroundColor: C.cardAlt, border: `1px solid ${C.border}`, color: C.text, borderRadius: 12, outline: "none" };

  /* ═══ Step indicator ═══ */
  const steps: { key: Step; label: string; icon: string }[] = [
    { key: "list", label: "セラピスト", icon: "👤" },
    { key: "therapist", label: "時間選択", icon: "🕐" },
    { key: "course", label: "コース", icon: "📋" },
    { key: "auth", label: "ログイン", icon: "🔑" },
    { key: "confirm", label: "確認", icon: "✅" },
  ];
  const stepIndex = steps.findIndex(s => s.key === step);

  return (
    <div style={{ minHeight: "100vh", background: C.bgGrad, color: C.text }}>
      {/* ═══ Header ═══ */}
      <header style={{ background: "rgba(15,15,20,0.95)", backdropFilter: "blur(12px)", borderBottom: `1px solid ${C.border}`, position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 480, margin: "0 auto", padding: "12px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: `linear-gradient(135deg, ${C.accent}, ${C.accentDark})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: "#fff" }}>C</div>
              <div>
                <h1 style={{ fontSize: 15, fontWeight: 600, margin: 0, letterSpacing: 1 }}>{storeName}</h1>
                <p style={{ fontSize: 10, color: C.textMuted, margin: 0 }}>WEB予約</p>
              </div>
            </div>
            {customer ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 10, color: C.accent }}>👤 {customer.self_name || customer.name}様</span>
                <a href="/customer-mypage" style={{ fontSize: 10, color: C.textMuted, textDecoration: "underline" }}>マイページ</a>
              </div>
            ) : (
              <a href="/customer-mypage" style={{ fontSize: 11, color: C.accent, textDecoration: "none", padding: "6px 12px", borderRadius: 8, border: `1px solid ${C.accentBorder}` }}>ログイン</a>
            )}
          </div>
        </div>
      </header>

      {/* ═══ Step Indicator ═══ */}
      {step !== "done" && step !== "list" && (
        <div style={{ maxWidth: 480, margin: "0 auto", padding: "12px 16px 0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            {steps.map((s, i) => {
              if (s.key === "auth" && customer) return null; // skip auth step if logged in
              const isActive = i === stepIndex;
              const isPast = i < stepIndex;
              return (
                <div key={s.key} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <div style={{ width: "100%", height: 3, borderRadius: 2, backgroundColor: isPast || isActive ? C.accent : C.border, transition: "all 0.3s" }} />
                  <span style={{ fontSize: 9, color: isPast || isActive ? C.accent : C.textFaint }}>{s.icon} {s.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <main style={{ maxWidth: 480, margin: "0 auto", padding: "16px 16px 80px" }}>

        {/* ═══════════════════════════════════════════════════ */}
        {/* STEP: LIST — セラピスト一覧 */}
        {/* ═══════════════════════════════════════════════════ */}
        {step === "list" && (<>
          {/* Date navigation */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 12 }}>
              <button onClick={() => setDate(dateNav(date, -1))} style={{ width: 36, height: 36, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", ...btnOutline, fontSize: 14 }}>◀</button>
              <button onClick={() => setDate(today)} style={{ padding: "4px 12px", borderRadius: 8, cursor: "pointer", fontSize: 11, ...btnOutline }}>今日</button>
              <span style={{ fontSize: 16, fontWeight: 600, minWidth: 120, textAlign: "center", color: date === today ? C.accent : C.text }}>{dateFmt(date)}</span>
              <button onClick={() => setDate(dateNav(date, 1))} style={{ width: 36, height: 36, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", ...btnOutline, fontSize: 14 }}>▶</button>
            </div>
            {/* Week buttons */}
            <div style={{ display: "flex", gap: 6, overflowX: "auto" }}>
              {Array.from({ length: 7 }, (_, i) => {
                const d = dateNav(today, i);
                const dt = new Date(d + "T00:00:00");
                const days = ["日", "月", "火", "水", "木", "金", "土"];
                const isSel = date === d;
                const isSun = dt.getDay() === 0;
                const isSat = dt.getDay() === 6;
                return (
                  <button key={d} onClick={() => setDate(d)} style={{
                    flex: 1, minWidth: 44, padding: "8px 0", borderRadius: 12, textAlign: "center", cursor: "pointer",
                    backgroundColor: isSel ? C.accentBg : C.card, border: isSel ? `1px solid ${C.accentBorder}` : `1px solid ${C.border}`,
                    color: isSel ? C.accent : isSun ? C.red : isSat ? "#5588cc" : C.text, transition: "all 0.2s"
                  }}>
                    <span style={{ display: "block", fontSize: 9, color: isSel ? C.accent : isSun ? C.red : isSat ? "#5588cc" : C.textMuted }}>{days[dt.getDay()]}</span>
                    <span style={{ display: "block", fontSize: 15, fontWeight: 600 }}>{dt.getDate()}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Therapist Grid */}
          {loading ? (
            <div style={{ textAlign: "center", padding: "60px 0" }}>
              <div style={{ fontSize: 28, marginBottom: 8, animation: "spin 1s linear infinite" }}>💆</div>
              <p style={{ fontSize: 12, color: C.textMuted }}>読み込み中...</p>
            </div>
          ) : shifts.length === 0 ? (
            <div style={{ ...cardStyle, padding: "48px 24px", textAlign: "center" }}>
              <p style={{ fontSize: 36, marginBottom: 8 }}>😴</p>
              <p style={{ fontSize: 13, color: C.textMuted }}>この日の出勤はありません</p>
              <p style={{ fontSize: 11, color: C.textFaint, marginTop: 8 }}>別の日付をお選びください</p>
            </div>
          ) : (
            <>
              <p style={{ fontSize: 12, color: C.textMuted, marginBottom: 8, paddingLeft: 4 }}>
                {dateFmt(date)} の出勤 — <span style={{ color: C.accent, fontWeight: 600 }}>{shifts.filter(s => therapists.some(t => t.id === s.therapist_id)).length}名</span>
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {shifts.map(shift => {
                  const t = therapists.find(th => th.id === shift.therapist_id);
                  if (!t) return null;
                  const tRes = reservations.filter(r => r.therapist_id === shift.therapist_id);
                  const slots = makeSlots(shift, tRes);
                  const freeCount = slots.filter(s => s.available).length;
                  return (
                    <button key={shift.id} onClick={() => selectTherapist(shift.therapist_id)} style={{
                      ...cardStyle, overflow: "hidden", cursor: "pointer", textAlign: "left", padding: 0,
                      transition: "transform 0.2s, box-shadow 0.2s",
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; (e.currentTarget as HTMLElement).style.boxShadow = `0 8px 24px rgba(195,167,130,0.15)`; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = "none"; (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}
                    >
                      {/* Photo */}
                      {t.photo_url ? (
                        <img src={t.photo_url} alt="" style={{ width: "100%", aspectRatio: "3/4", objectFit: "cover", display: "block" }} />
                      ) : (
                        <div style={{ width: "100%", aspectRatio: "3/4", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40, color: "#fff", fontWeight: 700, background: `linear-gradient(135deg, ${C.accent}, ${C.accentDark})` }}>{t.name.charAt(0)}</div>
                      )}
                      {/* Info */}
                      <div style={{ padding: "10px 12px" }}>
                        <p style={{ fontSize: 14, fontWeight: 600, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {t.name}
                          {t.age > 0 && <span style={{ fontSize: 11, fontWeight: 400, color: C.textMuted, marginLeft: 4 }}>({t.age})</span>}
                        </p>
                        {shift.store_id > 0 && (
                          <span style={{ display: "inline-block", marginTop: 4, fontSize: 9, padding: "2px 8px", borderRadius: 99, backgroundColor: C.accentBg, color: C.accent }}>{getStoreName(shift.store_id)}</span>
                        )}
                        <p style={{ fontSize: 11, margin: "4px 0 0", color: C.textSub }}>{shift.start_time.slice(0,5)}〜{shift.end_time.slice(0,5)}</p>
                        {(t.height_cm > 0 || t.bust > 0) && (
                          <p style={{ fontSize: 10, margin: "2px 0 0", color: C.textMuted }}>T{t.height_cm} B{t.bust}({t.cup}) W{t.waist} H{t.hip}</p>
                        )}
                        <div style={{ marginTop: 6 }}>
                          <span style={{
                            fontSize: 10, padding: "3px 10px", borderRadius: 99,
                            backgroundColor: freeCount > 0 ? C.greenBg : C.redBg,
                            color: freeCount > 0 ? C.green : C.red,
                            border: freeCount > 0 ? `1px solid ${C.greenBorder}` : `1px solid rgba(196,85,85,0.2)`,
                          }}>
                            {freeCount > 0 ? `◯ 空き${freeCount}枠` : "✕ 空きなし"}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </>)}

        {/* ═══════════════════════════════════════════════════ */}
        {/* STEP: THERAPIST — 時間選択 */}
        {/* ═══════════════════════════════════════════════════ */}
        {step === "therapist" && selTherapist && (<>
          <button onClick={() => goBack("list")} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: C.accent, cursor: "pointer", background: "none", border: "none", marginBottom: 12, padding: 0 }}>← 一覧に戻る</button>

          {/* Therapist header card */}
          <div style={{ ...cardStyle, overflow: "hidden", marginBottom: 16 }}>
            <div style={{ display: "flex", gap: 16, padding: 16, borderBottom: `1px solid ${C.border}` }}>
              {selTherapist.photo_url ? (
                <img src={selTherapist.photo_url} alt="" style={{ width: 80, height: 80, borderRadius: 14, objectFit: "cover", flexShrink: 0 }} />
              ) : (
                <div style={{ width: 80, height: 80, borderRadius: 14, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, color: "#fff", fontWeight: 700, background: `linear-gradient(135deg, ${C.accent}, ${C.accentDark})` }}>{selTherapist.name.charAt(0)}</div>
              )}
              <div>
                <p style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>{selTherapist.name}
                  {selTherapist.age > 0 && <span style={{ fontSize: 13, fontWeight: 400, color: C.textMuted, marginLeft: 4 }}>({selTherapist.age})</span>}
                </p>
                {selShift && selShift.store_id > 0 && (
                  <span style={{ display: "inline-block", marginTop: 4, fontSize: 10, padding: "2px 10px", borderRadius: 99, backgroundColor: C.accentBg, color: C.accent }}>{getStoreName(selShift.store_id)}</span>
                )}
                {selShift && <p style={{ fontSize: 12, margin: "6px 0 0", color: C.textSub }}>出勤 {selShift.start_time.slice(0,5)}〜{selShift.end_time.slice(0,5)}</p>}
                {(selTherapist.height_cm > 0 || selTherapist.bust > 0) && (
                  <p style={{ fontSize: 11, margin: "2px 0 0", color: C.textMuted }}>T{selTherapist.height_cm} B{selTherapist.bust}({selTherapist.cup}) W{selTherapist.waist} H{selTherapist.hip}</p>
                )}
              </div>
            </div>

            {/* Weekly toggle */}
            <div style={{ display: "flex", gap: 8, padding: "10px 16px", borderBottom: `1px solid ${C.border}` }}>
              <button onClick={() => { setWeeklyMode(false); }} style={{ flex: 1, padding: "8px 0", borderRadius: 10, fontSize: 12, fontWeight: 500, cursor: "pointer", ...(weeklyMode ? btnOutline : btnPrimary) }}>📅 {dateFmt(date)}</button>
              <button onClick={() => { setWeeklyMode(true); fetchWeek(selTherapistId, date); }} style={{ flex: 1, padding: "8px 0", borderRadius: 10, fontSize: 12, fontWeight: 500, cursor: "pointer", ...(weeklyMode ? btnPrimary : btnOutline) }}>📊 週間スケジュール</button>
            </div>

            {/* ─ Day view: Time slots ─ */}
            {!weeklyMode && selShift && (() => {
              const tRes = reservations.filter(r => r.therapist_id === selTherapistId);
              const slots = makeSlots(selShift, tRes);
              return (
                <div style={{ padding: "12px 16px" }}>
                  <p style={{ fontSize: 11, fontWeight: 500, color: C.textSub, marginBottom: 8 }}>{dateFmt(date)} の空き状況</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {slots.map((sl, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", borderRadius: 10, backgroundColor: sl.available ? "transparent" : "rgba(196,85,85,0.04)" }}>
                        <span style={{ fontSize: 13, fontFamily: "monospace", width: 48, flexShrink: 0, color: sl.available ? C.text : C.textFaint }}>{sl.time}</span>
                        {sl.available ? (
                          <button onClick={() => selectTime(sl.time)} style={{ flex: 1, padding: "8px 0", borderRadius: 10, fontSize: 12, fontWeight: 500, cursor: "pointer", textAlign: "center", backgroundColor: C.greenBg, color: C.green, border: `1px solid ${C.greenBorder}` }}>◯ 空き — タップで予約</button>
                        ) : (
                          <span style={{ flex: 1, textAlign: "center", fontSize: 12, color: C.textFaint, padding: "8px 0" }}>✕ 予約済</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* ─ Weekly view ─ */}
            {weeklyMode && (() => {
              const weekDates = getWeekDates(date);
              const days = ["月", "火", "水", "木", "金", "土", "日"];
              return (
                <div style={{ padding: "12px 16px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 12 }}>
                    <button onClick={() => { const prev = dateNav(date, -7); setDate(prev); fetchWeek(selTherapistId, prev); }} style={{ ...btnOutline, width: 32, height: 32, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 12, padding: 0 }}>◀</button>
                    <span style={{ fontSize: 12, color: C.textSub }}>{dateFmt(weekDates[0])} 〜 {dateFmt(weekDates[6])}</span>
                    <button onClick={() => { const next = dateNav(date, 7); setDate(next); fetchWeek(selTherapistId, next); }} style={{ ...btnOutline, width: 32, height: 32, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 12, padding: 0 }}>▶</button>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
                    {weekDates.map((wd, i) => {
                      const ws = weekShifts.find(s => s.date === wd);
                      const wr = weekRes.filter(r => r.date === wd);
                      const dt = new Date(wd + "T00:00:00");
                      const isPast = wd < today;
                      const isSel = wd === date;
                      const slots = ws ? makeSlots(ws, wr) : [];
                      const freeCount = slots.filter(s => s.available).length;
                      return (
                        <button key={wd} onClick={() => { if (ws && !isPast) { setDate(wd); setWeeklyMode(false); fetchDay(wd); } }}
                          style={{
                            padding: "8px 0", borderRadius: 10, textAlign: "center", cursor: ws && !isPast ? "pointer" : "default",
                            backgroundColor: isSel ? C.accentBg : "transparent", border: isSel ? `1px solid ${C.accentBorder}` : `1px solid ${C.border}`,
                            opacity: isPast ? 0.4 : 1,
                          }}>
                          <span style={{ display: "block", fontSize: 9, color: C.textMuted }}>{days[i]}</span>
                          <span style={{ display: "block", fontSize: 14, fontWeight: 600, color: isSel ? C.accent : C.text }}>{dt.getDate()}</span>
                          {ws ? (
                            <span style={{ display: "block", fontSize: 8, marginTop: 2, color: freeCount > 0 ? C.green : C.red }}>
                              {freeCount > 0 ? `空${freeCount}` : "✕"}
                            </span>
                          ) : (
                            <span style={{ display: "block", fontSize: 8, marginTop: 2, color: C.textFaint }}>休</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>
        </>)}

        {/* ═══════════════════════════════════════════════════ */}
        {/* STEP: COURSE — コース選択 */}
        {/* ═══════════════════════════════════════════════════ */}
        {step === "course" && (<>
          <button onClick={() => goBack("therapist")} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: C.accent, cursor: "pointer", background: "none", border: "none", marginBottom: 12, padding: 0 }}>← 時間選択に戻る</button>

          {/* Selection summary */}
          <div style={{ ...cardStyle, padding: 16, marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {selTherapist?.photo_url ? (
                <img src={selTherapist.photo_url} alt="" style={{ width: 48, height: 48, borderRadius: 12, objectFit: "cover" }} />
              ) : (
                <div style={{ width: 48, height: 48, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, color: "#fff", fontWeight: 700, background: `linear-gradient(135deg, ${C.accent}, ${C.accentDark})` }}>{selTherapist?.name.charAt(0)}</div>
              )}
              <div>
                <p style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>{selTherapist?.name}</p>
                <p style={{ fontSize: 12, color: C.textSub, margin: "2px 0 0" }}>{dateFmt(date)} {selTime}〜</p>
              </div>
            </div>
          </div>

          {/* Course selection */}
          <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: C.textSub }}>📋 コースを選択</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
            {courses.map(c => {
              const isSel = selCourseId === c.id;
              return (
                <button key={c.id} onClick={() => setSelCourseId(c.id)} style={{
                  ...cardStyle, padding: "14px 16px", cursor: "pointer", textAlign: "left",
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  border: isSel ? `2px solid ${C.accent}` : `1px solid ${C.border}`,
                  backgroundColor: isSel ? C.accentBg : C.card,
                }}>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>{c.name}</p>
                    <p style={{ fontSize: 11, color: C.textMuted, margin: "2px 0 0" }}>⏱ {c.duration}分</p>
                  </div>
                  <span style={{ fontSize: 15, fontWeight: 700, color: C.accent }}>{fmt(c.price)}</span>
                </button>
              );
            })}
          </div>

          {/* Extension */}
          {extensions.length > 0 && (<>
            <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: C.textSub }}>⏱ 延長（任意）</h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
              <button onClick={() => setSelExtId(0)} style={{ padding: "8px 16px", borderRadius: 10, cursor: "pointer", fontSize: 12, ...(selExtId === 0 ? btnPrimary : btnOutline) }}>なし</button>
              {extensions.map(e => (
                <button key={e.id} onClick={() => setSelExtId(e.id)} style={{ padding: "8px 16px", borderRadius: 10, cursor: "pointer", fontSize: 12, ...(selExtId === e.id ? btnPrimary : btnOutline) }}>+{e.duration}分 {fmt(e.price)}</button>
              ))}
            </div>
          </>)}

          {/* Options */}
          {optionsList.length > 0 && (<>
            <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: C.textSub }}>🎁 オプション（任意）</h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
              {optionsList.map(o => {
                const isSel = selOptions.includes(o.id);
                return (
                  <button key={o.id} onClick={() => setSelOptions(prev => isSel ? prev.filter(id => id !== o.id) : [...prev, o.id])} style={{ padding: "8px 16px", borderRadius: 10, cursor: "pointer", fontSize: 12, ...(isSel ? btnPrimary : btnOutline) }}>{o.name} {fmt(o.price)}</button>
                );
              })}
            </div>
          </>)}

          {/* Discount */}
          {discounts.length > 0 && (<>
            <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: C.textSub }}>🏷️ 割引（任意）</h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
              <button onClick={() => setSelDiscountId(0)} style={{ padding: "8px 16px", borderRadius: 10, cursor: "pointer", fontSize: 12, ...(selDiscountId === 0 ? btnPrimary : btnOutline) }}>なし</button>
              {discounts.map(d => (
                <button key={d.id} onClick={() => setSelDiscountId(d.id)} style={{ padding: "8px 16px", borderRadius: 10, cursor: "pointer", fontSize: 12, ...(selDiscountId === d.id ? btnPrimary : btnOutline) }}>-{fmt(d.amount)} {d.name}</button>
              ))}
            </div>
          </>)}

          {/* Notes */}
          <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: C.textSub }}>📝 ご要望（任意）</h3>
          <textarea value={selNotes} onChange={e => setSelNotes(e.target.value)} rows={3} placeholder="ご要望やメッセージがあればご記入ください" style={{ ...inputStyle, width: "100%", padding: "12px 14px", fontSize: 13, marginBottom: 20, resize: "vertical", boxSizing: "border-box" }} />

          {/* Total & Next */}
          {selCourseId > 0 && (
            <div style={{ ...cardStyle, padding: 16, marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <span style={{ fontSize: 13, color: C.textSub }}>合計金額（税込）</span>
                <span style={{ fontSize: 22, fontWeight: 700, color: C.accent }}>{fmt(calcTotal())}</span>
              </div>
              <div style={{ fontSize: 11, color: C.textMuted, lineHeight: 1.8, marginBottom: 12 }}>
                <p style={{ margin: 0 }}>📋 {selCourse?.name}（{selCourse?.duration}分）… {fmt(selCourse?.price || 0)}</p>
                <p style={{ margin: 0 }}>✨ {getNominationType(selTherapistId).label} … {fmt(getNominationType(selTherapistId).price)}</p>
                {selExtId > 0 && <p style={{ margin: 0 }}>⏱ +{extensions.find(e => e.id === selExtId)?.duration}分延長 … {fmt(extensions.find(e => e.id === selExtId)?.price || 0)}</p>}
                {selOptions.length > 0 && selOptions.map(oid => { const o = optionsList.find(op => op.id === oid); return o ? <p key={oid} style={{ margin: 0 }}>🎁 {o.name} … {fmt(o.price)}</p> : null; })}
                {selDiscountId > 0 && <p style={{ margin: 0, color: C.green }}>🏷️ {discounts.find(d => d.id === selDiscountId)?.name} … -{fmt(discounts.find(d => d.id === selDiscountId)?.amount || 0)}</p>}
              </div>
              <button onClick={goToAuth} style={{ ...btnPrimary, width: "100%", padding: "14px 0", borderRadius: 14, fontSize: 15, fontWeight: 600, cursor: "pointer" }}>
                {customer ? "✅ 予約内容を確認する" : "🔑 ログインして予約する"}
              </button>
            </div>
          )}
        </>)}

        {/* ═══════════════════════════════════════════════════ */}
        {/* STEP: AUTH — ログイン/新規登録 */}
        {/* ═══════════════════════════════════════════════════ */}
        {step === "auth" && (<>
          <button onClick={() => goBack("course")} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: C.accent, cursor: "pointer", background: "none", border: "none", marginBottom: 12, padding: 0 }}>← コース選択に戻る</button>

          <div style={{ ...cardStyle, padding: 24 }}>
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div style={{ width: 56, height: 56, margin: "0 auto 12px", borderRadius: 16, background: `linear-gradient(135deg, ${C.accent}, ${C.accentDark})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 700, color: "#fff" }}>C</div>
              <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>{storeName}</h2>
              <p style={{ fontSize: 12, color: C.textMuted, margin: "4px 0 0" }}>予約にはログインが必要です</p>
            </div>

            {/* Tab */}
            <div style={{ display: "flex", marginBottom: 20, borderRadius: 12, overflow: "hidden", border: `1px solid ${C.border}` }}>
              <button onClick={() => { setAuthMode("login"); setAuthError(""); }} style={{ flex: 1, padding: "10px 0", fontSize: 13, fontWeight: 600, cursor: "pointer", border: "none", backgroundColor: authMode === "login" ? C.accent : C.cardAlt, color: authMode === "login" ? "#fff" : C.textMuted }}>ログイン</button>
              <button onClick={() => { setAuthMode("register"); setAuthError(""); }} style={{ flex: 1, padding: "10px 0", fontSize: 13, fontWeight: 600, cursor: "pointer", border: "none", backgroundColor: authMode === "register" ? C.accent : C.cardAlt, color: authMode === "register" ? "#fff" : C.textMuted }}>新規登録</button>
            </div>

            {authMode === "login" ? (<>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 11, color: C.textSub, marginBottom: 6 }}>📧 メールアドレス</label>
                <input type="email" value={authEmail} onChange={e => setAuthEmail(e.target.value)} placeholder="email@example.com" style={{ ...inputStyle, width: "100%", padding: "12px 14px", fontSize: 14, boxSizing: "border-box" }} />
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 11, color: C.textSub, marginBottom: 6 }}>🔒 パスワード</label>
                <div style={{ position: "relative" }}>
                  <input type={showPw ? "text" : "password"} value={authPw} onChange={e => setAuthPw(e.target.value)} placeholder="パスワード" style={{ ...inputStyle, width: "100%", padding: "12px 14px", fontSize: 14, paddingRight: 44, boxSizing: "border-box" }} />
                  <button onClick={() => setShowPw(!showPw)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 16, color: C.textMuted }}>{showPw ? "🙈" : "👁"}</button>
                </div>
              </div>
              {authError && <p style={{ fontSize: 12, color: C.red, marginBottom: 12 }}>{authError}</p>}
              <button onClick={handleLogin} disabled={authLoading} style={{ ...btnPrimary, width: "100%", padding: "14px 0", borderRadius: 14, fontSize: 15, fontWeight: 600, cursor: "pointer", opacity: authLoading ? 0.6 : 1 }}>
                {authLoading ? "ログイン中..." : "ログイン"}
              </button>
            </>) : (<>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 11, color: C.textSub, marginBottom: 6 }}>👤 お名前</label>
                <input type="text" value={authName} onChange={e => setAuthName(e.target.value)} placeholder="ご予約のお名前" style={{ ...inputStyle, width: "100%", padding: "12px 14px", fontSize: 14, boxSizing: "border-box" }} />
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 11, color: C.textSub, marginBottom: 6 }}>📱 電話番号（任意）</label>
                <input type="tel" value={authPhone} onChange={e => setAuthPhone(e.target.value)} placeholder="090-XXXX-XXXX" style={{ ...inputStyle, width: "100%", padding: "12px 14px", fontSize: 14, boxSizing: "border-box" }} />
                <p style={{ fontSize: 10, color: C.textFaint, margin: "4px 0 0" }}>※ 以前ご利用の方は電話番号で照合します</p>
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 11, color: C.textSub, marginBottom: 6 }}>📧 メールアドレス</label>
                <input type="email" value={authEmail} onChange={e => setAuthEmail(e.target.value)} placeholder="email@example.com" style={{ ...inputStyle, width: "100%", padding: "12px 14px", fontSize: 14, boxSizing: "border-box" }} />
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 11, color: C.textSub, marginBottom: 6 }}>🔒 パスワード（6文字以上）</label>
                <div style={{ position: "relative" }}>
                  <input type={showPw ? "text" : "password"} value={authPw} onChange={e => setAuthPw(e.target.value)} placeholder="パスワード" style={{ ...inputStyle, width: "100%", padding: "12px 14px", fontSize: 14, paddingRight: 44, boxSizing: "border-box" }} />
                  <button onClick={() => setShowPw(!showPw)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 16, color: C.textMuted }}>{showPw ? "🙈" : "👁"}</button>
                </div>
              </div>
              {authError && <p style={{ fontSize: 12, color: C.red, marginBottom: 12 }}>{authError}</p>}
              <button onClick={handleRegister} disabled={authLoading} style={{ ...btnPrimary, width: "100%", padding: "14px 0", borderRadius: 14, fontSize: 15, fontWeight: 600, cursor: "pointer", opacity: authLoading ? 0.6 : 1 }}>
                {authLoading ? "登録中..." : "新規登録して予約する"}
              </button>
            </>)}
          </div>
        </>)}

        {/* ═══════════════════════════════════════════════════ */}
        {/* STEP: CONFIRM — 予約確認 */}
        {/* ═══════════════════════════════════════════════════ */}
        {step === "confirm" && customer && (<>
          <button onClick={() => goBack(customer ? "course" : "auth")} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: C.accent, cursor: "pointer", background: "none", border: "none", marginBottom: 12, padding: 0 }}>← 戻る</button>

          <div style={{ textAlign: "center", marginBottom: 20 }}>
            <p style={{ fontSize: 32, marginBottom: 4 }}>📋</p>
            <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0, color: C.accent }}>ご予約内容の確認</h2>
            <p style={{ fontSize: 12, color: C.textMuted, margin: "4px 0 0" }}>{customer.self_name || customer.name}様、以下の内容でよろしいですか？</p>
          </div>

          <div style={{ ...cardStyle, padding: 20, marginBottom: 16 }}>
            {/* Therapist info */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, paddingBottom: 16, borderBottom: `1px solid ${C.border}` }}>
              {selTherapist?.photo_url ? (
                <img src={selTherapist.photo_url} alt="" style={{ width: 56, height: 56, borderRadius: 14, objectFit: "cover" }} />
              ) : (
                <div style={{ width: 56, height: 56, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, color: "#fff", fontWeight: 700, background: `linear-gradient(135deg, ${C.accent}, ${C.accentDark})` }}>{selTherapist?.name.charAt(0)}</div>
              )}
              <div>
                <p style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>{selTherapist?.name}</p>
                <p style={{ fontSize: 12, color: C.textSub, margin: "2px 0 0" }}>{getNominationType(selTherapistId).label}</p>
              </div>
            </div>

            {/* Details */}
            <div style={{ fontSize: 13, lineHeight: 2.2, color: C.textSub }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>📅 日時</span>
                <span style={{ color: C.text, fontWeight: 500 }}>{dateFmt(date)} {selTime}〜</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>📋 コース</span>
                <span style={{ color: C.text, fontWeight: 500 }}>{selCourse?.name}（{selCourse?.duration}分）</span>
              </div>
              {selExtId > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>⏱ 延長</span>
                  <span style={{ color: C.text, fontWeight: 500 }}>+{extensions.find(e => e.id === selExtId)?.duration}分</span>
                </div>
              )}
              {selOptions.length > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>🎁 オプション</span>
                  <span style={{ color: C.text, fontWeight: 500 }}>{selOptions.map(oid => optionsList.find(o => o.id === oid)?.name).join(", ")}</span>
                </div>
              )}
              {selDiscountId > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>🏷️ 割引</span>
                  <span style={{ color: C.green, fontWeight: 500 }}>{discounts.find(d => d.id === selDiscountId)?.name}</span>
                </div>
              )}
              {selNotes && (
                <div style={{ marginTop: 8 }}>
                  <span>📝 ご要望</span>
                  <p style={{ fontSize: 12, color: C.text, margin: "4px 0 0", padding: "8px 12px", borderRadius: 10, backgroundColor: C.cardAlt }}>{selNotes}</p>
                </div>
              )}
            </div>

            {/* Total */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16, paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>合計金額</span>
              <span style={{ fontSize: 24, fontWeight: 700, color: C.accent }}>{fmt(calcTotal())}</span>
            </div>
          </div>

          {bookMsg && <p style={{ fontSize: 12, color: C.red, marginBottom: 12, textAlign: "center" }}>{bookMsg}</p>}

          <button onClick={submitBooking} disabled={bookSaving} style={{ ...btnPrimary, width: "100%", padding: "16px 0", borderRadius: 14, fontSize: 16, fontWeight: 600, cursor: "pointer", opacity: bookSaving ? 0.6 : 1, boxSizing: "border-box" }}>
            {bookSaving ? "送信中..." : "✨ 予約リクエストを送信"}
          </button>
          <p style={{ fontSize: 10, color: C.textFaint, textAlign: "center", marginTop: 8 }}>※ リクエスト後、お店から確認のご連絡をいたします</p>
        </>)}

        {/* ═══════════════════════════════════════════════════ */}
        {/* STEP: DONE — 予約完了 */}
        {/* ═══════════════════════════════════════════════════ */}
        {step === "done" && (
          <div style={{ textAlign: "center", paddingTop: 40 }}>
            <div style={{ width: 80, height: 80, margin: "0 auto 16px", borderRadius: "50%", background: `linear-gradient(135deg, ${C.green}, #3d8b5a)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36 }}>✅</div>
            <h2 style={{ fontSize: 22, fontWeight: 600, margin: "0 0 8px", color: C.accent }}>予約リクエスト完了</h2>
            <p style={{ fontSize: 13, color: C.textSub, lineHeight: 1.8, margin: "0 0 24px" }}>
              ご予約リクエストありがとうございます！<br />
              お店から確認のご連絡をいたします。<br />
              少々お待ちくださいませ 🙏
            </p>

            <div style={{ ...cardStyle, padding: 16, marginBottom: 24, textAlign: "left" }}>
              <p style={{ fontSize: 12, color: C.textSub, margin: 0 }}>
                <strong style={{ color: C.text }}>📅 {dateFmt(date)} {selTime}〜</strong><br />
                💆 {selTherapist?.name}<br />
                📋 {selCourse?.name}（{selCourse?.duration}分）<br />
                💰 {fmt(calcTotal())}
              </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <a href="/customer-mypage" style={{ ...btnPrimary, display: "block", padding: "14px 0", borderRadius: 14, fontSize: 14, fontWeight: 600, textDecoration: "none", textAlign: "center" }}>👤 マイページを見る</a>
              <button onClick={() => { setStep("list"); setSelTherapistId(0); setSelTime(""); setSelCourseId(0); fetchDay(date); window.scrollTo({ top: 0, behavior: "smooth" }); }} style={{ ...btnOutline, padding: "14px 0", borderRadius: 14, fontSize: 14, fontWeight: 500, cursor: "pointer" }}>📅 続けて予約する</button>
            </div>
          </div>
        )}

      </main>

      {/* ═══ Footer ═══ */}
      <footer style={{ textAlign: "center", padding: "20px 16px 40px", borderTop: `1px solid ${C.border}` }}>
        <p style={{ fontSize: 10, color: C.textFaint, margin: 0 }}>Powered by T-MANAGE</p>
      </footer>

      {/* ═══ CSS Animation ═══ */}
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        main > div { animation: fadeIn 0.3s ease-out; }
        input::placeholder, textarea::placeholder { color: ${C.textFaint}; }
        * { -webkit-tap-highlight-color: transparent; }
        body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
      `}</style>
    </div>
  );
}
