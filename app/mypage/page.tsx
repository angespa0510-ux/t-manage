"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "../../lib/supabase";
import { useTheme } from "../../lib/theme";

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
type CustomerNote = { id: number; therapist_id: number; customer_name: string; note: string; is_ng: boolean; ng_reason: string; rating: number };
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
  const { dark, toggle, T } = useTheme();
  const [loggedIn, setLoggedIn] = useState(false);
  const [therapist, setTherapist] = useState<Therapist | null>(null);
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState(""); const [loginLoading, setLoginLoading] = useState(false);
  const [tab, setTab] = useState<"home" | "shift" | "schedule" | "salary" | "customers">("home");
  const [shifts, setShifts] = useState<Shift[]>([]); const [shiftRequests, setShiftRequests] = useState<ShiftRequest[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]); const [reservations, setReservations] = useState<Reservation[]>([]);
  const [allReservations, setAllReservations] = useState<Reservation[]>([]); const [customerNotes, setCustomerNotes] = useState<CustomerNote[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [coursesMaster, setCoursesMaster] = useState<{ id: number; name: string; therapist_back: number }[]>([]);
const [nomsMaster, setNomsMaster] = useState<{ id: number; name: string; back_amount: number }[]>([]);
const [extsMaster, setExtsMaster] = useState<{ id: number; name: string; therapist_back: number }[]>([]);
const [optsMaster, setOptsMaster] = useState<{ id: number; name: string; therapist_back: number }[]>([]);
  const [weekOffset, setWeekOffset] = useState(1);
  const [reqDrafts, setReqDrafts] = useState<Record<string, { enabled: boolean; start: string; end: string; store_id: number; notes: string }>>({});
  const [reqSaving, setReqSaving] = useState(false); const [reqMsg, setReqMsg] = useState(""); const [copiedShift, setCopiedShift] = useState(false);
  const [salaryMonth, setSalaryMonth] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; });
  const [noteSearch, setNoteSearch] = useState(""); const [showAddNote, setShowAddNote] = useState(false);
  const [noteForm, setNoteForm] = useState({ customer_name: "", note: "", is_ng: false, ng_reason: "", rating: 0 })
  const [noteViewTarget, setNoteViewTarget] = useState<CustomerNote | null>(null);
  const [calMonth, setCalMonth] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; });
　const [calShifts, setCalShifts] = useState<Shift[]>([]);
　const [calSettlements, setCalSettlements] = useState<Settlement[]>([]);
　const [calReservations, setCalReservations] = useState<Reservation[]>([]);
　const [calDetailDate, setCalDetailDate] = useState<string | null>(null);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) { setLoginError("メールアドレスとパスワードを入力してください"); return; }
    setLoginLoading(true); setLoginError("");
    const { data } = await supabase.from("therapists").select("*").eq("login_email", email.trim()).eq("login_password", password.trim()).maybeSingle();
    setLoginLoading(false);
    if (data) { setTherapist(data); setLoggedIn(true); localStorage.setItem("therapist_session", JSON.stringify({ id: data.id, email: data.login_email })); }
    else { setLoginError("メールアドレスまたはパスワードが間違っています"); }
  };

  useEffect(() => {
    const session = localStorage.getItem("therapist_session");
    if (session) { const { id } = JSON.parse(session); supabase.from("therapists").select("*").eq("id", id).maybeSingle().then(({ data }) => { if (data) { setTherapist(data); setLoggedIn(true); } else localStorage.removeItem("therapist_session"); }); }
  }, []);

  const fetchData = useCallback(async () => {
    if (!therapist) return; const tid = therapist.id;
    const { data: st } = await supabase.from("stores").select("*"); if (st) setStores(st);
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
    const { data: cn } = await supabase.from("therapist_customer_notes").select("*").eq("therapist_id", tid).order("customer_name"); if (cn) setCustomerNotes(cn);
    const [cy, cm] = calMonth.split("-").map(Number);
    const calDim = new Date(cy, cm, 0).getDate();
    const calStart = `${calMonth}-01`; const calEnd = `${calMonth}-${String(calDim).padStart(2, "0")}`;
    const { data: csh } = await supabase.from("shifts").select("*").eq("therapist_id", tid).gte("date", calStart).lte("date", calEnd).eq("status", "confirmed"); if (csh) setCalShifts(csh);
    const { data: cstl } = await supabase.from("therapist_daily_settlements").select("*").eq("therapist_id", tid).gte("date", calStart).lte("date", calEnd).eq("is_settled", true); if (cstl) setCalSettlements(cstl);
    const { data: cres } = await supabase.from("reservations").select("*").eq("therapist_id", tid).gte("date", calStart).lte("date", calEnd).eq("status", "completed"); if (cres) setCalReservations(cres);
  }, [therapist, salaryMonth, calMonth]);

  useEffect(() => { fetchData(); }, [fetchData]);

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
    if (!confirm("このメモを削除しますか？")) return;
    await supabase.from("therapist_customer_notes").delete().eq("id", id);
    const returnDate = calDetailDate; setShowAddNote(false); setNoteViewTarget(null); await fetchData(); if (returnDate) setCalDetailDate(returnDate);
  };

  const saveCustomerNote = async () => {
    if (!therapist || !noteForm.customer_name.trim()) return;
    const existing = customerNotes.find(n => n.customer_name === noteForm.customer_name.trim());
    if (existing) { await supabase.from("therapist_customer_notes").update({ note: noteForm.note, is_ng: noteForm.is_ng, ng_reason: noteForm.ng_reason, rating: noteForm.rating, updated_at: new Date().toISOString() }).eq("id", existing.id); }
    else { await supabase.from("therapist_customer_notes").insert({ therapist_id: therapist.id, customer_name: noteForm.customer_name.trim(), note: noteForm.note, is_ng: noteForm.is_ng, ng_reason: noteForm.ng_reason, rating: noteForm.rating }); }
    const returnDate = calDetailDate; setShowAddNote(false); setNoteViewTarget(null); setNoteForm({ customer_name: "", note: "", is_ng: false, ng_reason: "", rating: 0 }); await fetchData(); if (returnDate) setCalDetailDate(returnDate);
  };

  const logout = () => { localStorage.removeItem("therapist_session"); setLoggedIn(false); setTherapist(null); setTab("home"); };
  const chipStyle = (active: boolean, color: string) => ({ backgroundColor: active ? color + "20" : "transparent", color: active ? color : T.textMuted, borderColor: active ? color : T.border });
  const getStoreName = (id: number) => stores.find(s => s.id === id)?.name || "";
  const getStoreShort = (id: number) => stores.find(s => s.id === id)?.name?.replace(/ルーム$/, "") || "";

  if (!loggedIn) return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: "#0f0f1a" }}>
      <div className="w-full max-w-[360px]">
        <div className="text-center mb-8"><div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: "linear-gradient(135deg, #c3a782, #a8895e)" }}><span className="text-white text-2xl font-bold">C</span></div><h1 className="text-xl font-medium text-white">チョップ</h1><p className="text-xs mt-1" style={{ color: "#888" }}>セラピスト マイページ</p></div>
        <div className="rounded-2xl p-6 space-y-4" style={{ backgroundColor: "#1a1a2e", border: "1px solid #2a2a3e" }}>
          <div><label className="block text-[10px] mb-1.5" style={{ color: "#888" }}>メールアドレス</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="example@email.com" className="w-full px-4 py-3 rounded-xl text-[13px] outline-none" style={{ backgroundColor: "#12121e", color: "#fff", border: "1px solid #2a2a3e" }} onKeyDown={(e) => e.key === "Enter" && handleLogin()} /></div>
          <div><label className="block text-[10px] mb-1.5" style={{ color: "#888" }}>パスワード</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="パスワード" className="w-full px-4 py-3 rounded-xl text-[13px] outline-none" style={{ backgroundColor: "#12121e", color: "#fff", border: "1px solid #2a2a3e" }} onKeyDown={(e) => e.key === "Enter" && handleLogin()} /></div>
          {loginError && <p className="text-[11px] text-center" style={{ color: "#c45555" }}>{loginError}</p>}
          <button onClick={handleLogin} disabled={loginLoading} className="w-full py-3 rounded-xl text-[13px] font-medium cursor-pointer text-white disabled:opacity-50" style={{ background: "linear-gradient(135deg, #c3a782, #a8895e)" }}>{loginLoading ? "ログイン中..." : "ログイン"}</button>
        </div>
        <p className="text-[9px] text-center mt-4" style={{ color: "#555" }}>ログイン情報はオーナーにお問い合わせください</p>
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
      <div className="h-[56px] flex items-center justify-between px-4 flex-shrink-0 border-b" style={{ backgroundColor: T.card, borderColor: T.border }}>
        <div className="flex items-center gap-3"><div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] text-white font-medium" style={{ background: "linear-gradient(135deg, #c3a782, #a8895e)" }}>{therapist?.name?.charAt(0) || "?"}</div><div><p className="text-[13px] font-medium">{therapist?.name}</p><p className="text-[8px]" style={{ color: T.textMuted }}>マイページ</p></div></div>
        <div className="flex items-center gap-2"><button onClick={toggle} className="px-2 py-1 text-[9px] rounded-lg cursor-pointer border" style={{ borderColor: T.border, color: T.textSub }}>{dark ? "☀️" : "🌙"}</button><button onClick={logout} className="px-3 py-1.5 text-[10px] rounded-lg cursor-pointer" style={{ backgroundColor: "#c4555518", color: "#c45555" }}>ログアウト</button></div>
      </div>
      <div className="flex items-center gap-1 px-4 py-2 flex-shrink-0 border-b overflow-x-auto" style={{ backgroundColor: T.card, borderColor: T.border }}>
        {[{ key: "home" as const, label: "🏠 ホーム" }, { key: "shift" as const, label: "📝 シフト希望" }, { key: "schedule" as const, label: "📅 出勤予定" }, { key: "salary" as const, label: "💰 給料明細" }, { key: "customers" as const, label: "👤 お客様" }].map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className="px-3 py-1.5 text-[10px] rounded-lg cursor-pointer border whitespace-nowrap" style={chipStyle(tab === t.key, "#c3a782")}>{t.label}</button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto"><div className="max-w-[600px] mx-auto p-4">

        {tab === "home" && (<div className="space-y-4">
          {todayShift ? (<div className="rounded-2xl p-5 border" style={{ backgroundColor: "#22c55e10", borderColor: "#22c55e33" }}><p className="text-[10px] mb-1" style={{ color: "#22c55e" }}>本日の出勤</p><p className="text-[18px] font-medium">{todayShift.start_time?.slice(0,5)} 〜 {todayShift.end_time?.slice(0,5)}</p>{todayShift.store_id > 0 && <p className="text-[11px] mt-1" style={{ color: T.textMuted }}>{getStoreName(todayShift.store_id)}</p>}</div>) : (<div className="rounded-2xl p-5 border" style={{ backgroundColor: T.card, borderColor: T.border }}><p className="text-[12px]" style={{ color: T.textMuted }}>本日の出勤予定はありません</p></div>)}
          <div className="grid grid-cols-3 gap-3">{[{ l: "今月の報酬", v: fmt(monthTotal), c: "#c3a782" }, { l: "接客数", v: `${monthOrders}件`, c: T.text }, { l: "出勤日数", v: `${monthDays}日`, c: T.text }].map(s => (<div key={s.l} className="rounded-xl p-4 border text-center" style={{ backgroundColor: T.card, borderColor: T.border }}><p className="text-[9px] mb-1" style={{ color: T.textMuted }}>{s.l}</p><p className="text-[16px] font-light" style={{ color: s.c }}>{s.v}</p></div>))}</div>

          {/* カレンダー */}
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
              <div className="rounded-2xl border p-4" style={{ backgroundColor: T.card, borderColor: T.border }}>
                <div className="flex items-center justify-between mb-3">
                  <button onClick={() => { const d = new Date(cy, cm - 2, 1); setCalMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`); }}
                    className="px-2 py-1 text-[11px] cursor-pointer rounded border" style={{ borderColor: T.border, color: T.textSub }}>◀</button>
                  <div className="text-center">
                    <span className="text-[13px] font-medium">{cy}年{cm}月</span>
                    <div className="flex items-center gap-3 justify-center mt-0.5">
                      <span className="text-[9px]" style={{ color: "#c3a782" }}>{fmt(calTotal)}</span>
                      <span className="text-[9px]" style={{ color: T.textMuted }}>{calOrders}件</span>
                      <span className="text-[9px]" style={{ color: T.textMuted }}>{calDays}日出勤</span>
                    </div>
                  </div>
                  <button onClick={() => { const d = new Date(cy, cm, 1); setCalMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`); }}
                    className="px-2 py-1 text-[11px] cursor-pointer rounded border" style={{ borderColor: T.border, color: T.textSub }}>▶</button>
                </div>

                <div className="grid grid-cols-7 gap-0.5">
                  {["日", "月", "火", "水", "木", "金", "土"].map((d, i) => (
                    <div key={d} className="text-center text-[9px] py-1 font-medium" style={{ color: i === 0 ? "#c45555" : i === 6 ? "#3d6b9f" : T.textMuted }}>{d}</div>
                  ))}
                  {cells.map((date, i) => {
                    if (!date) return <div key={`e-${i}`} className="p-0.5" />;
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
                      <div key={date} onClick={() => setCalDetailDate(date)} className="rounded-lg p-1 text-center min-h-[58px] flex flex-col cursor-pointer hover:opacity-80"
                        style={{
                          backgroundColor: isToday2 ? "#c3a78215" : hasSettled ? "#22c55e08" : hasWork ? "#85a8c408" : "transparent",
                          border: isToday2 ? "1.5px solid #c3a782" : hasWork ? `1px solid ${T.border}` : "1px solid transparent",
                        }}>
                        <span className="text-[11px] font-medium" style={{ color: dow === 0 ? "#c45555" : dow === 6 ? "#3d6b9f" : T.text }}>{dayNum}</span>
                        {hasWork && (
                          <span className="text-[7px] mt-0.5" style={{ color: "#85a8c4" }}>
                            {shift.start_time?.slice(0,5)}〜
                          </span>
                        )}
                        {hasSettled && (
                          <span className="text-[7px] font-medium" style={{ color: "#c3a782" }}>
                            {fmt(settlement.final_payment)}
                          </span>
                        )}
                        {custCount > 0 && (
                          <span className="text-[7px]" style={{ color: "#22c55e" }}>
                            👤{uniqueCust}名{custCount > uniqueCust ? `(${custCount})` : ""}
                          </span>
                        )}
                        {hasWork && !hasSettled && date < today && (
                          <span className="text-[6px]" style={{ color: "#f59e0b" }}>未清算</span>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center gap-4 mt-3 pt-2 justify-center flex-wrap" style={{ borderTop: `1px solid ${T.border}` }}>
                  <span className="flex items-center gap-1 text-[8px]" style={{ color: T.textMuted }}><span className="w-2 h-2 rounded-sm" style={{ backgroundColor: "#85a8c420", border: "1px solid #85a8c4" }} /> 出勤予定</span>
                  <span className="flex items-center gap-1 text-[8px]" style={{ color: T.textMuted }}><span className="w-2 h-2 rounded-sm" style={{ backgroundColor: "#22c55e15" }} /> 清算済み</span>
                  <span className="flex items-center gap-1 text-[8px]" style={{ color: "#c3a782" }}><span className="w-2 h-2 rounded-sm" style={{ backgroundColor: "#c3a78220", border: "1.5px solid #c3a782" }} /> 今日</span>
                  <span className="flex items-center gap-1 text-[8px]" style={{ color: "#f59e0b" }}>⚠ 未清算</span>
                </div>
              </div>
            );
          })()}

          {upcomingShifts.length > 0 && (<div className="rounded-2xl border p-4" style={{ backgroundColor: T.card, borderColor: T.border }}><p className="text-[11px] font-medium mb-3">直近の出勤予定</p><div className="space-y-1.5">{upcomingShifts.map(s => (<div key={s.id} className="flex items-center justify-between py-1.5 px-2 rounded-lg" style={{ backgroundColor: T.cardAlt }}><span className="text-[11px]">{formatDate(s.date)}</span><div className="flex items-center gap-2">{s.store_id > 0 && <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "#85a8c418", color: "#85a8c4" }}>{getStoreShort(s.store_id)}</span>}<span className="text-[11px] font-medium">{s.start_time?.slice(0,5)} 〜 {s.end_time?.slice(0,5)}</span></div></div>))}</div></div>)}
        </div>)}

        {tab === "shift" && (<div className="space-y-4">
          <div className="flex items-center justify-between"><h2 className="text-[14px] font-medium">📝 シフト希望提出</h2><div className="flex items-center gap-2"><button onClick={() => setWeekOffset(Math.max(1, weekOffset - 1))} className="px-2 py-1 text-[11px] cursor-pointer rounded border" style={{ borderColor: T.border, color: T.textSub }}>◀</button><span className="text-[11px] font-medium min-w-[120px] text-center">{formatDate(weekDates[0])} 〜 {formatDate(weekDates[6])}</span><button onClick={() => setWeekOffset(weekOffset + 1)} className="px-2 py-1 text-[11px] cursor-pointer rounded border" style={{ borderColor: T.border, color: T.textSub }}>▶</button></div></div>
          <div className="space-y-2">{weekDates.map(d => { const draft = reqDrafts[d]; if (!draft) return null; const dt = new Date(d + "T00:00:00"); const dow = ["日","月","火","水","木","金","土"][dt.getDay()]; const isSun = dt.getDay() === 0; const isSat = dt.getDay() === 6; const existing = shiftRequests.find(r => r.date === d);
            return (<div key={d} className="rounded-xl border p-3" style={{ backgroundColor: draft.enabled ? "#c3a78210" : T.card, borderColor: draft.enabled ? "#c3a78244" : T.border }}>
              <div className="flex items-center gap-2 mb-1"><button onClick={() => setReqDrafts({ ...reqDrafts, [d]: { ...draft, enabled: !draft.enabled } })} className="text-[14px] cursor-pointer flex-shrink-0" style={{ background: "none", border: "none" }}>{draft.enabled ? "✅" : "⬜"}</button><span className="text-[13px] font-medium min-w-[70px]" style={{ color: isSun ? "#c45555" : isSat ? "#3d6b9f" : T.text }}>{dt.getDate()}日 ({dow})</span>{existing && <span className="text-[8px] px-1.5 py-0.5 rounded ml-auto" style={{ backgroundColor: existing.status === "approved" ? "#22c55e18" : existing.status === "rejected" ? "#c4555518" : "#f59e0b18", color: existing.status === "approved" ? "#22c55e" : existing.status === "rejected" ? "#c45555" : "#f59e0b" }}>{existing.status === "approved" ? "承認済" : existing.status === "rejected" ? "却下" : "提出済"}</span>}</div>
              {draft.enabled && (<div className="flex items-center gap-1.5 ml-7 flex-wrap"><select value={draft.store_id} onChange={(e) => setReqDrafts({ ...reqDrafts, [d]: { ...draft, store_id: Number(e.target.value) } })} className="px-2 py-1.5 rounded-lg text-[10px] outline-none cursor-pointer border" style={{ backgroundColor: T.cardAlt, borderColor: "#85a8c444", color: "#85a8c4", fontWeight: 600 }}><option value={0}>店舗未選択</option>{stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select><select value={draft.start} onChange={(e) => setReqDrafts({ ...reqDrafts, [d]: { ...draft, start: e.target.value } })} className="px-2 py-1.5 rounded-lg text-[11px] outline-none cursor-pointer border" style={{ backgroundColor: T.cardAlt, borderColor: T.border, color: T.text }}>{TIMES.map(t => <option key={t} value={t}>{t}</option>)}</select><span className="text-[10px]" style={{ color: T.textMuted }}>〜</span><select value={draft.end} onChange={(e) => setReqDrafts({ ...reqDrafts, [d]: { ...draft, end: e.target.value } })} className="px-2 py-1.5 rounded-lg text-[11px] outline-none cursor-pointer border" style={{ backgroundColor: T.cardAlt, borderColor: T.border, color: T.text }}>{TIMES.map(t => <option key={t} value={t}>{t}</option>)}</select><input type="text" value={draft.notes} onChange={(e) => setReqDrafts({ ...reqDrafts, [d]: { ...draft, notes: e.target.value } })} placeholder="備考" className="flex-1 px-2 py-1.5 rounded-lg text-[10px] outline-none border min-w-[60px]" style={{ backgroundColor: T.cardAlt, borderColor: T.border, color: T.text }} /></div>)}
            </div>); })}</div>
          {reqMsg && <p className="text-[11px] text-center" style={{ color: "#22c55e" }}>{reqMsg}</p>}
          <div className="flex gap-2"><button onClick={submitShiftRequests} disabled={reqSaving} className="flex-1 py-3 rounded-xl text-[12px] font-medium cursor-pointer text-white disabled:opacity-50" style={{ background: "linear-gradient(135deg, #c3a782, #a8895e)" }}>{reqSaving ? "送信中..." : "シフト希望を提出"}</button><button onClick={copyShiftToClipboard} className="px-4 py-3 rounded-xl text-[11px] font-medium cursor-pointer border" style={{ borderColor: copiedShift ? "#22c55e" : "#85a8c444", color: copiedShift ? "#22c55e" : "#85a8c4", backgroundColor: copiedShift ? "#22c55e18" : "transparent" }}>{copiedShift ? "✅ コピー済" : "📋 LINE用コピー"}</button></div>
          {weekDates.some(d => reqDrafts[d]?.enabled) && (<div className="rounded-xl border p-3" style={{ backgroundColor: T.cardAlt, borderColor: T.border }}><p className="text-[9px] font-medium mb-1" style={{ color: T.textMuted }}>📋 コピー内容プレビュー</p><pre className="text-[10px] whitespace-pre-wrap" style={{ color: T.textSub }}>{generateShiftCopyText()}</pre></div>)}
        </div>)}

        {tab === "schedule" && (<div className="space-y-4">
          <h2 className="text-[14px] font-medium">📅 確定シフト</h2>
          {shifts.length === 0 ? <p className="text-[12px] text-center py-8" style={{ color: T.textFaint }}>確定シフトがありません</p> : (<div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: T.card, borderColor: T.border }}>{shifts.map(s => (<div key={s.id} className="flex items-center justify-between px-4 py-3" style={{ borderBottom: `1px solid ${T.border}` }}><div className="flex items-center gap-3"><span className="text-[12px] font-medium min-w-[80px]">{formatDate(s.date)}</span>{s.store_id > 0 && <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "#85a8c418", color: "#85a8c4" }}>{getStoreShort(s.store_id)}</span>}<span className="text-[12px]">{s.start_time?.slice(0,5)} 〜 {s.end_time?.slice(0,5)}</span></div>{s.date === today && <span className="text-[9px] px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: "#c3a782" }}>今日</span>}</div>))}</div>)}
          {shiftRequests.filter(r => r.status === "pending").length > 0 && (<div className="rounded-2xl border p-4" style={{ backgroundColor: "#f59e0b10", borderColor: "#f59e0b33" }}><p className="text-[11px] font-medium mb-2" style={{ color: "#f59e0b" }}>⏳ 承認待ちのシフト希望</p>{shiftRequests.filter(r => r.status === "pending").map(r => (<div key={r.id} className="flex items-center justify-between py-1 text-[11px]"><span>{formatDate(r.date)}</span><div className="flex items-center gap-2">{r.store_id > 0 && <span className="text-[9px]" style={{ color: "#85a8c4" }}>{getStoreShort(r.store_id)}</span>}<span>{r.start_time} 〜 {r.end_time}</span></div></div>))}</div>)}
        </div>)}

        {tab === "salary" && (<div className="space-y-4">
          <div className="flex items-center justify-between"><h2 className="text-[14px] font-medium">💰 給料明細</h2><div className="flex items-center gap-2"><button onClick={() => { const d = new Date(smY, smM - 2, 1); setSalaryMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`); }} className="px-2 py-1 text-[11px] cursor-pointer rounded border" style={{ borderColor: T.border, color: T.textSub }}>◀</button><span className="text-[12px] font-medium">{smY}年{smM}月</span><button onClick={() => { const d = new Date(smY, smM, 1); setSalaryMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`); }} className="px-2 py-1 text-[11px] cursor-pointer rounded border" style={{ borderColor: T.border, color: T.textSub }}>▶</button></div></div>
          <div className="grid grid-cols-3 gap-3">{[{ l: "月合計", v: fmt(monthTotal), c: "#c3a782" }, { l: "接客数", v: `${monthOrders}件`, c: T.text }, { l: "出勤日数", v: `${monthDays}日`, c: T.text }].map(s => (<div key={s.l} className="rounded-xl p-4 border text-center" style={{ backgroundColor: T.card, borderColor: T.border }}><p className="text-[9px] mb-1" style={{ color: T.textMuted }}>{s.l}</p><p className="text-[18px] font-light" style={{ color: s.c }}>{s.v}</p></div>))}</div>
          {settlements.length === 0 ? <p className="text-[12px] text-center py-8" style={{ color: T.textFaint }}>清算データがありません</p> : (<div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: T.card, borderColor: T.border }}>{settlements.map(stl => (<div key={stl.id} className="px-4 py-3" style={{ borderBottom: `1px solid ${T.border}` }}><div className="flex items-center justify-between mb-1"><span className="text-[12px] font-medium">{formatDate(stl.date)}</span><span className="text-[14px] font-medium" style={{ color: "#c3a782" }}>{fmt(stl.final_payment)}</span></div><div className="flex items-center gap-3 text-[9px] flex-wrap" style={{ color: T.textMuted }}><span>{stl.order_count}件</span><span>売上{fmt(stl.total_sales)}</span><span>バック{fmt(stl.total_back)}</span>{stl.invoice_deduction > 0 && <span style={{ color: "#c45555" }}>INV-{fmt(stl.invoice_deduction)}</span>}{stl.withholding_tax > 0 && <span style={{ color: "#c45555" }}>源泉-{fmt(stl.withholding_tax)}</span>}{stl.welfare_fee > 0 && <span style={{ color: "#c45555" }}>厚生-{fmt(stl.welfare_fee)}</span>}{stl.transport_fee > 0 && <span style={{ color: "#22c55e" }}>交通+{fmt(stl.transport_fee)}</span>}</div></div>))}</div>)}
        </div>)}

        {tab === "customers" && (<div className="space-y-4">
          <div className="flex items-center justify-between"><h2 className="text-[14px] font-medium">👤 お客様メモ・NG</h2><button onClick={() => { setShowAddNote(true); setNoteForm({ customer_name: "", note: "", is_ng: false, ng_reason: "", rating: 0 }); }} className="px-3 py-1.5 text-[10px] rounded-lg cursor-pointer text-white" style={{ backgroundColor: "#c3a782" }}>+ メモ追加</button></div>
          <input type="text" value={noteSearch} onChange={(e) => setNoteSearch(e.target.value)} placeholder="お客様名で検索..." className="w-full px-4 py-2.5 rounded-xl text-[12px] outline-none border" style={{ backgroundColor: T.cardAlt, borderColor: T.border, color: T.text }} />
          {uniqueCustomers.length > 0 && (<div className="rounded-2xl border p-4" style={{ backgroundColor: T.card, borderColor: T.border }}><p className="text-[10px] font-medium mb-2" style={{ color: T.textMuted }}>接客したお客様（全{uniqueCustomers.length}名）</p><div className="flex flex-wrap gap-1.5">{uniqueCustomers.filter(([name]) => !noteSearch || name.includes(noteSearch)).map(([name, info]) => { const note = customerNotes.find(n => n.customer_name === name); return (<button key={name} onClick={() => { if (note) setNoteViewTarget(note); else { setShowAddNote(true); setNoteForm({ customer_name: name, note: "", is_ng: false, ng_reason: "", rating: 0 }); } }} className="px-2.5 py-1.5 rounded-lg text-[10px] cursor-pointer border" style={{ backgroundColor: note?.is_ng ? "#c4555515" : note ? "#c3a78215" : T.cardAlt, borderColor: note?.is_ng ? "#c4555544" : note ? "#c3a78244" : T.border, color: note?.is_ng ? "#c45555" : T.text }}>{note?.is_ng && "🚫"}{name}({info.count}回){note && " 📝"}</button>); })}</div></div>)}
          <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: T.card, borderColor: T.border }}><div className="px-4 py-2.5 border-b" style={{ borderColor: T.border }}><p className="text-[11px] font-medium">登録済みメモ（{customerNotes.length}件）</p><p className="text-[8px]" style={{ color: T.textFaint }}>※ メモの削除はスタッフにお申し付けください</p></div>
            {customerNotes.filter(n => !noteSearch || n.customer_name.includes(noteSearch)).length === 0 ? <p className="text-[12px] text-center py-6" style={{ color: T.textFaint }}>メモがありません</p> : customerNotes.filter(n => !noteSearch || n.customer_name.includes(noteSearch)).map(n => (<div key={n.id} className="px-4 py-3 cursor-pointer" style={{ borderBottom: `1px solid ${T.border}` }} onClick={() => setNoteViewTarget(n)}><div className="flex items-center gap-2"><span className="text-[12px] font-medium">{n.customer_name}</span>{n.is_ng && <span className="text-[8px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "#c4555518", color: "#c45555" }}>🚫 NG</span>}</div>{n.note && <p className="text-[10px] mt-0.5 truncate" style={{ color: T.textSub }}>{n.note}</p>}</div>))}
          </div>
        </div>)}

      </div></div>

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
                <div className="rounded-xl p-3 mb-3" style={{ backgroundColor: "#85a8c410", border: "1px solid #85a8c430" }}>
                  <p className="text-[10px] font-medium mb-1" style={{ color: "#85a8c4" }}>⏰ 出勤</p>
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
                <div className="rounded-xl p-3 mb-3" style={{ backgroundColor: "#c3a78210", border: "1px solid #c3a78230" }}>
                  <p className="text-[10px] font-medium mb-2" style={{ color: "#c3a782" }}>💰 清算明細</p>
                  <div className="space-y-1 text-[11px]">
                    <div className="flex justify-between"><span>接客数</span><span className="font-medium">{dSettlement.order_count}件</span></div>
                    <div className="flex justify-between"><span>売上合計</span><span>{fmt(dSettlement.total_sales)}</span></div>
                    <div className="flex justify-between"><span>バック合計</span><span>{fmt(dSettlement.total_back)}</span></div>
                    {dSettlement.adjustment !== 0 && <div className="flex justify-between" style={{ color: dSettlement.adjustment > 0 ? "#22c55e" : "#c45555" }}><span>調整金{dSettlement.adjustment_note ? `（${dSettlement.adjustment_note}）` : ""}</span><span>{dSettlement.adjustment > 0 ? "+" : ""}{fmt(dSettlement.adjustment)}</span></div>}
                    {dSettlement.invoice_deduction > 0 && <div className="flex justify-between" style={{ color: "#c45555" }}><span>インボイス控除</span><span>-{fmt(dSettlement.invoice_deduction)}</span></div>}
                    {dSettlement.withholding_tax > 0 && <div className="flex justify-between" style={{ color: "#c45555" }}><span>源泉徴収</span><span>-{fmt(dSettlement.withholding_tax)}</span></div>}
                    {dSettlement.welfare_fee > 0 && <div className="flex justify-between" style={{ color: "#c45555" }}><span>備品・リネン代</span><span>-{fmt(dSettlement.welfare_fee)}</span></div>}
                    {dSettlement.transport_fee > 0 && <div className="flex justify-between" style={{ color: "#22c55e" }}><span>交通費</span><span>+{fmt(dSettlement.transport_fee)}</span></div>}
                    <div className="flex justify-between pt-1.5 font-bold text-[13px]" style={{ borderTop: `1px solid #c3a78230`, color: "#c3a782" }}><span>支給額</span><span>{fmt(dSettlement.final_payment)}</span></div>
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
                    const note = customerNotes.find(n => n.customer_name === r.customer_name);
                    return (
                      <div key={r.id} className="px-3 py-2.5" style={{ borderTop: i > 0 ? `1px solid ${T.border}` : "none" }}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[12px] font-medium">{r.customer_name}</span>
                            {note?.is_ng && <span className="text-[8px] px-1 py-0.5 rounded" style={{ backgroundColor: "#c4555518", color: "#c45555" }}>🚫NG</span>}
                            {note && note.rating > 0 && <span className="text-[9px]" style={{ color: "#f59e0b" }}>{"★".repeat(note.rating)}{"☆".repeat(5 - note.rating)}</span>}
                          </div>
                          <span className="text-[11px] font-medium" style={{ color: "#c3a782" }}>{fmt(r.total_price)}</span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] flex-wrap" style={{ color: T.textSub }}>
                          <span>🕐 {r.start_time?.slice(0,5)}〜{r.end_time?.slice(0,5)}</span>
                          <span>📋 {r.course}</span>
                        </div>
                        <div className="flex items-center gap-2 text-[9px] flex-wrap mt-0.5" style={{ color: T.textMuted }}>
                          {r.nomination && <span style={{ color: "#c3a782" }}>指名: {r.nomination}（{fmt(r.nomination_fee)}）</span>}
                          {r.options_text && <span style={{ color: "#85a8c4" }}>OP: {r.options_text}</span>}
                          {r.extension_name && <span style={{ color: "#a855f7" }}>延長: {r.extension_name}</span>}
                          {(r as any).discount_name && <span style={{ color: "#c45555" }}>割引: {(r as any).discount_name}</span>}
                        </div>
                        <div className="flex items-center gap-2 text-[9px] flex-wrap mt-0.5" style={{ color: T.textMuted }}>
                          {(r as any).card_billing > 0 && <span style={{ color: "#85a8c4" }}>💳{fmt((r as any).card_billing)}</span>}
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
                            {r.nomination && <div className="flex justify-between"><span>指名バック（{r.nomination}）</span><span style={{ color: "#c3a782" }}>+{fmt(nomBack)}</span></div>}
                            {optNames.length > 0 && optNames.map((n, oi) => { const ob = optsMaster.find(o => o.name === n)?.therapist_back || 0; return <div key={oi} className="flex justify-between"><span>OPバック（{n}）</span><span style={{ color: "#85a8c4" }}>+{fmt(ob)}</span></div>; })}
                            {r.extension_name && <div className="flex justify-between"><span>延長バック（{r.extension_name}）</span><span style={{ color: "#a855f7" }}>+{fmt(extBack)}</span></div>}
                          </div>
                        ); })()}
                        {note && note.note && (
                          <div className="mt-1 px-2 py-1 rounded text-[9px]" style={{ backgroundColor: "#c3a78210", color: "#c3a782" }}>
                            📝 {note.note}
                          </div>
                        )}
                        {note?.is_ng && note.ng_reason && (
                          <div className="mt-0.5 px-2 py-1 rounded text-[9px]" style={{ backgroundColor: "#c4555510", color: "#c45555" }}>
                            🚫 NG理由: {note.ng_reason}
                          </div>
                        )}
                        <div className="flex gap-1 mt-1.5">
                          <button onClick={(e) => { e.stopPropagation(); if (note) { setNoteForm({ customer_name: note.customer_name, note: note.note, is_ng: note.is_ng, ng_reason: note.ng_reason, rating: note.rating || 0 }); } else { setNoteForm({ customer_name: r.customer_name, note: "", is_ng: false, ng_reason: "", rating: 0 }); } setCalDetailDate(null); setShowAddNote(true); }}
                            className="px-2 py-1 text-[9px] rounded cursor-pointer" style={{ backgroundColor: "#c3a78218", color: "#c3a782" }}>
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

      {noteViewTarget && (<div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setNoteViewTarget(null)}><div className="rounded-2xl border p-5 w-full max-w-sm" style={{ backgroundColor: T.card, borderColor: T.border }} onClick={(e) => e.stopPropagation()}>
        <h3 className="text-[14px] font-medium mb-1">{noteViewTarget.customer_name}</h3>
        {noteViewTarget.is_ng && <p className="text-[10px] mb-2" style={{ color: "#c45555" }}>🚫 NG登録済み{noteViewTarget.ng_reason ? `（${noteViewTarget.ng_reason}）` : ""}</p>}{noteViewTarget.rating > 0 && <p className="text-[12px] mb-2" style={{ color: "#f59e0b" }}>{"★".repeat(noteViewTarget.rating)}{"☆".repeat(5 - noteViewTarget.rating)} <span className="text-[10px]">{noteViewTarget.rating}/5</span></p>}
        <div className="rounded-xl p-3 mb-3" style={{ backgroundColor: T.cardAlt }}><p className="text-[10px] font-medium mb-1" style={{ color: T.textMuted }}>メモ</p><p className="text-[12px] whitespace-pre-wrap">{noteViewTarget.note || "メモなし"}</p></div>
        {(() => { const hist = allReservations.filter(r => r.customer_name === noteViewTarget.customer_name).slice(0, 10); if (hist.length === 0) return null; return (<div className="rounded-xl p-3 mb-3" style={{ backgroundColor: T.cardAlt }}><p className="text-[10px] font-medium mb-1" style={{ color: T.textMuted }}>接客履歴（直近{hist.length}件）</p>{hist.map(r => (<div key={r.id} className="flex items-center justify-between py-1 text-[10px]" style={{ borderBottom: `1px solid ${T.border}` }}><span>{formatDate(r.date)} {r.start_time?.slice(0,5)}</span><span style={{ color: T.textSub }}>{r.course}</span></div>))}</div>); })()}
        <div className="flex gap-2"><button onClick={() => { setNoteForm({ customer_name: noteViewTarget.customer_name, note: noteViewTarget.note, is_ng: noteViewTarget.is_ng, ng_reason: noteViewTarget.ng_reason, rating: noteViewTarget.rating || 0 }); setNoteViewTarget(null); setShowAddNote(true); }} className="px-4 py-2 text-[11px] rounded-xl cursor-pointer text-white" style={{ background: "linear-gradient(135deg, #c3a782, #a8895e)" }}>✏️ メモ編集</button><button onClick={() => setNoteViewTarget(null)} className="px-4 py-2 border text-[11px] rounded-xl cursor-pointer" style={{ borderColor: T.border, color: T.textSub }}>閉じる</button></div>
      </div></div>)}

      {showAddNote && (<div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowAddNote(false)}><div className="rounded-2xl border p-5 w-full max-w-sm" style={{ backgroundColor: T.card, borderColor: T.border }} onClick={(e) => e.stopPropagation()}>
        <h3 className="text-[14px] font-medium mb-4">📝 お客様メモ</h3>
        <div className="space-y-3">
          <div><label className="block text-[10px] mb-1" style={{ color: T.textSub }}>お客様名</label><input type="text" value={noteForm.customer_name} onChange={(e) => setNoteForm({ ...noteForm, customer_name: e.target.value })} readOnly={!!customerNotes.find(n => n.customer_name === noteForm.customer_name)} placeholder="お客様名" className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={{ backgroundColor: T.cardAlt, color: T.text, border: "1px solid transparent" }} /></div>
          <div><label className="block text-[10px] mb-1" style={{ color: T.textSub }}>メモ</label><textarea value={noteForm.note} onChange={(e) => setNoteForm({ ...noteForm, note: e.target.value })} placeholder="お客様についてのメモ" rows={4} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none resize-y" style={{ backgroundColor: T.cardAlt, color: T.text, border: "1px solid transparent" }} /></div>
          <div className="flex items-center gap-1.5">
                <button onClick={() => { const now = new Date(); const ds = `${now.getMonth()+1}/${now.getDate()} ${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`; setNoteForm({ ...noteForm, note: noteForm.note + (noteForm.note ? "\n" : "") + `[${ds}] ` }); }}
                  className="px-2.5 py-1.5 text-[10px] rounded-lg cursor-pointer border" style={{ borderColor: "#85a8c444", color: "#85a8c4" }}>📅 日時挿入</button>
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
          <div className="flex gap-3 pt-2"><button onClick={saveCustomerNote} className="px-5 py-2.5 text-white text-[11px] rounded-xl cursor-pointer" style={{ background: "linear-gradient(135deg, #c3a782, #a8895e)" }}>保存</button><button onClick={() => setShowAddNote(false)} className="px-5 py-2.5 border text-[11px] rounded-xl cursor-pointer" style={{ borderColor: T.border, color: T.textSub }}>キャンセル</button></div>
        </div>
      </div></div>)}
    </div>
  );
}
