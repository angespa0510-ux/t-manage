"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";
import { useTheme } from "../../lib/theme";

type Therapist = { id: number; name: string; phone: string; status: string };
type Reservation = { id: number; customer_name: string; therapist_id: number; date: string; start_time: string; end_time: string; course: string; notes: string };
type Course = { id: number; name: string; duration: number; price: number; therapist_back: number };
type Shift = { id: number; therapist_id: number; store_id: number; date: string; start_time: string; end_time: string; status: string };

const HOUR_WIDTH = 120;
const MIN_10_WIDTH = HOUR_WIDTH / 6;
const HOURS_DISPLAY = Array.from({ length: 19 }, (_, i) => { const h = i + 9; return h >= 24 ? h - 24 : h; });
const HOURS_RAW = Array.from({ length: 19 }, (_, i) => i + 9);

function timeToMinutes(time: string): number { const [h, m] = time.split(":").map(Number); const adj = h < 9 ? h + 24 : h; return (adj - 9) * 60 + m; }
function minutesToTime(min: number): string { const t = min + 9 * 60; const h = Math.floor(t / 60) % 24; const m = t % 60; return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`; }
function minutesToDisplay(min: number): string { const t = min + 9 * 60; const h = Math.floor(t / 60); const dh = h >= 24 ? h - 24 : h; const m = t % 60; return `${dh}:${String(m).padStart(2, "0")}`; }

const TIMES_10MIN: string[] = [];
for (let m = 0; m <= 18 * 60; m += 10) TIMES_10MIN.push(minutesToTime(m));

export default function TimeChart() {
  const router = useRouter();
  const { dark, toggle, T } = useTheme();
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [clockedOut, setClockedOut] = useState<Set<number>>(new Set());

  const [showNewRes, setShowNewRes] = useState(false);
  const [newCustName, setNewCustName] = useState("");
  const [newTherapistId, setNewTherapistId] = useState<number>(0);
  const [newDate, setNewDate] = useState("");
  const [newStart, setNewStart] = useState("12:00");
  const [newEnd, setNewEnd] = useState("13:00");
  const [newCourseId, setNewCourseId] = useState<number>(0);
  const [newNotes, setNewNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const [editRes, setEditRes] = useState<Reservation | null>(null);
  const [editCustName, setEditCustName] = useState("");
  const [editTherapistId, setEditTherapistId] = useState<number>(0);
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");
  const [editCourseId, setEditCourseId] = useState<number>(0);
  const [editNotes, setEditNotes] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editMsg, setEditMsg] = useState("");

  const [showNewTherapist, setShowNewTherapist] = useState(false);
  const [tName, setTName] = useState("");
  const [tPhone, setTPhone] = useState("");

  const [dragInfo, setDragInfo] = useState<{ resId: number; edge: "start" | "end" | "move"; initX: number; initMin: number; initEndMin: number } | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isPanning, setIsPanning] = useState(false);
  const panStartX = useRef(0);
  const panMoved = useRef(false);
  const panScrollLeft = useRef(0);
  const velocity = useRef(0);
  const lastX = useRef(0);
  const lastTime2 = useRef(0);
  const animFrame = useRef<number>(0);

  const selectedCourse = courses.find((c) => c.id === newCourseId);
  const editSelectedCourse = courses.find((c) => c.id === editCourseId);

  useEffect(() => { const timer = setInterval(() => setCurrentTime(new Date()), 60000); return () => clearInterval(timer); }, []);

  const currentTimePos = (() => {
    const now = currentTime; const h = now.getHours(); const m = now.getMinutes();
    const adjH = h < 9 ? h + 24 : h;
    if (adjH < 9 || adjH >= 27) return -1;
    return ((adjH - 9) * 60 + m) * (HOUR_WIDTH / 60);
  })();

  const fetchData = useCallback(async () => {
    const { data: t } = await supabase.from("therapists").select("*").order("id"); if (t) setTherapists(t);
    const { data: r } = await supabase.from("reservations").select("*").eq("date", selectedDate).order("start_time"); if (r) setReservations(r);
    const { data: c } = await supabase.from("courses").select("*").order("duration"); if (c) setCourses(c);
    const { data: sh } = await supabase.from("shifts").select("*").eq("date", selectedDate).eq("status", "confirmed"); if (sh) setShifts(sh);
  }, [selectedDate]);

  useEffect(() => { const check = async () => { const { data: { user } } = await supabase.auth.getUser(); if (!user) router.push("/"); }; check(); fetchData(); }, [router, fetchData]);

  // 日付変更時に退勤リセット
  useEffect(() => { setClockedOut(new Set()); }, [selectedDate]);

  // シフトに入っているセラピストだけ表示（退勤者は下に）
  const shiftTherapistIds = new Set(shifts.map((s) => s.therapist_id));
  const activeTherapists = therapists.filter((t) => shiftTherapistIds.has(t.id) && !clockedOut.has(t.id));
  const clockedOutTherapists = therapists.filter((t) => shiftTherapistIds.has(t.id) && clockedOut.has(t.id));
  const displayTherapists = [...activeTherapists, ...clockedOutTherapists];

  const toggleClockOut = (id: number) => {
    setClockedOut((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // Pan handlers
  const handlePanStart = (e: React.MouseEvent) => { if ((e.target as HTMLElement).closest(".res-block")) return; const c = timelineRef.current; if (!c) return; setIsPanning(true); panMoved.current = false; panStartX.current = e.clientX; panScrollLeft.current = c.scrollLeft; lastX.current = e.clientX; lastTime2.current = Date.now(); velocity.current = 0; cancelAnimationFrame(animFrame.current); };
  const handlePanMove = (e: React.MouseEvent) => { if (!isPanning) return; const c = timelineRef.current; if (!c) return; e.preventDefault(); const dx = e.clientX - panStartX.current; c.scrollLeft = panScrollLeft.current - dx; if (Math.abs(dx) > 5) panMoved.current = true; const now = Date.now(); const dt = now - lastTime2.current; if (dt > 0) velocity.current = (e.clientX - lastX.current) / dt; lastX.current = e.clientX; lastTime2.current = now; };
  const handlePanEnd = () => { if (!isPanning) return; setIsPanning(false); const c = timelineRef.current; if (!c) return; let v = velocity.current * 15; const dec = () => { if (Math.abs(v) < 0.5) return; c.scrollLeft -= v; v *= 0.92; animFrame.current = requestAnimationFrame(dec); }; dec(); };

  // Drag handlers
  useEffect(() => {
    if (!dragInfo) return;
    const hm = (e: MouseEvent) => {
      const dx = e.clientX - dragInfo.initX; const dMin = Math.round(dx / MIN_10_WIDTH) * 10;
      if (dragInfo.edge === "end") { const ne = Math.max(dragInfo.initEndMin + dMin, dragInfo.initMin + 10); supabase.from("reservations").update({ end_time: minutesToTime(ne) }).eq("id", dragInfo.resId).then(() => fetchData()); }
      else if (dragInfo.edge === "start") { const ns = Math.min(dragInfo.initMin + dMin, dragInfo.initEndMin - 10); supabase.from("reservations").update({ start_time: minutesToTime(Math.max(0, ns)) }).eq("id", dragInfo.resId).then(() => fetchData()); }
      else { const ns = Math.max(0, dragInfo.initMin + dMin); const dur = dragInfo.initEndMin - dragInfo.initMin; if (ns + dur <= 18 * 60) { supabase.from("reservations").update({ start_time: minutesToTime(ns), end_time: minutesToTime(ns + dur) }).eq("id", dragInfo.resId).then(() => fetchData()); } }
    };
    const hu = () => setDragInfo(null);
    window.addEventListener("mousemove", hm); window.addEventListener("mouseup", hu);
    return () => { window.removeEventListener("mousemove", hm); window.removeEventListener("mouseup", hu); };
  }, [dragInfo, fetchData]);

  const handleCourseChange = (cid: number, isEdit = false) => { const c = courses.find((x) => x.id === cid); if (isEdit) { setEditCourseId(cid); if (c && editStart) setEditEnd(minutesToTime(timeToMinutes(editStart) + c.duration)); } else { setNewCourseId(cid); if (c && newStart) setNewEnd(minutesToTime(timeToMinutes(newStart) + c.duration)); } };
  const handleStartChange = (s: string, isEdit = false) => { if (isEdit) { setEditStart(s); if (editSelectedCourse) setEditEnd(minutesToTime(timeToMinutes(s) + editSelectedCourse.duration)); } else { setNewStart(s); if (selectedCourse) setNewEnd(minutesToTime(timeToMinutes(s) + selectedCourse.duration)); } };

  const addReservation = async () => {
    if (!newCustName.trim() || !newTherapistId) { setMsg("顧客名とセラピストを選択してください"); return; }
    setSaving(true); setMsg("");
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("reservations").insert({ customer_name: newCustName.trim(), therapist_id: newTherapistId, date: newDate || selectedDate, start_time: newStart, end_time: newEnd, course: selectedCourse?.name || "", notes: newNotes.trim(), user_id: user?.id });
    setSaving(false);
    if (error) { setMsg("登録失敗: " + error.message); }
    else { setMsg("予約を登録しました！"); setNewCustName(""); setNewTherapistId(0); setNewCourseId(0); setNewNotes(""); setNewStart("12:00"); setNewEnd("13:00"); fetchData(); setTimeout(() => { setShowNewRes(false); setMsg(""); }, 600); }
  };

  const openEdit = (r: Reservation) => { setEditRes(r); setEditCustName(r.customer_name); setEditTherapistId(r.therapist_id); setEditStart(r.start_time); setEditEnd(r.end_time); setEditNotes(r.notes || ""); const c = courses.find((x) => x.name === r.course); setEditCourseId(c ? c.id : 0); setEditMsg(""); };
  const updateReservation = async () => { if (!editRes) return; setEditSaving(true); setEditMsg(""); const { error } = await supabase.from("reservations").update({ customer_name: editCustName.trim(), therapist_id: editTherapistId, start_time: editStart, end_time: editEnd, course: editSelectedCourse?.name || editRes.course, notes: editNotes.trim() }).eq("id", editRes.id); setEditSaving(false); if (error) { setEditMsg("更新失敗: " + error.message); } else { setEditMsg("更新しました！"); fetchData(); setTimeout(() => { setEditRes(null); setEditMsg(""); }, 600); } };
  const deleteReservation = async (id: number) => { await supabase.from("reservations").delete().eq("id", id); setEditRes(null); fetchData(); };
  const addTherapist = async () => { if (!tName.trim()) return; await supabase.from("therapists").insert({ name: tName.trim(), phone: tPhone.trim(), status: "active" }); setTName(""); setTPhone(""); setShowNewTherapist(false); fetchData(); };

  const getCourseByName = (name: string) => courses.find((c) => c.name === name);
  const fmt = (n: number) => "¥" + (n || 0).toLocaleString();
  const prevDay = () => { const d = new Date(selectedDate); d.setDate(d.getDate() - 1); setSelectedDate(d.toISOString().split("T")[0]); };
  const nextDay = () => { const d = new Date(selectedDate); d.setDate(d.getDate() + 1); setSelectedDate(d.toISOString().split("T")[0]); };
  const dateDisplay = (() => { const d = new Date(selectedDate + "T00:00:00"); const days = ["日", "月", "火", "水", "木", "金", "土"]; return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日（${days[d.getDay()]}）`; })();

  const colors = ["#c3a782", "#7ab88f", "#85a8c4", "#c49885", "#a885c4", "#85c4b8", "#c4a685", "#8599c4"];
  const totalWidth = 19 * HOUR_WIDTH;
  const getResForTherapist = (tid: number) => reservations.filter((r) => r.therapist_id === tid);

  const inputStyle = { backgroundColor: T.cardAlt, color: T.text, border: "1px solid transparent" };

  return (
    <div className="h-screen flex flex-col" style={{ backgroundColor: T.bg, color: T.text }}>
      {/* Header */}
      <div className="h-[64px] backdrop-blur-xl border-b flex items-center justify-between px-6 flex-shrink-0" style={{ backgroundColor: dark ? T.card + "cc" : "rgba(255,255,255,0.8)", borderColor: T.border }}>
        <div className="flex items-center gap-4">
          <button onClick={() => router.push("/dashboard")} className="p-2 rounded-lg cursor-pointer" style={{ color: T.textSub }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg></button>
          <h1 className="text-[15px] font-medium">タイムチャート</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={toggle} className="px-3 py-1.5 text-[10px] rounded-lg cursor-pointer border" style={{ borderColor: T.border, color: T.textSub }}>{dark ? "☀️ ライト" : "🌙 ダーク"}</button>
          <button onClick={() => setShowNewTherapist(true)} className="px-3 py-2 border text-[11px] rounded-xl cursor-pointer" style={{ borderColor: T.border, color: T.textSub }}>+ セラピスト追加</button>
          <button onClick={() => { setShowNewRes(true); setNewDate(selectedDate); setNewCourseId(0); setNewStart("12:00"); setNewEnd("13:00"); setMsg(""); }}
            className="px-4 py-2 bg-gradient-to-r from-[#c3a782] to-[#b09672] text-white text-[11px] rounded-xl cursor-pointer">+ 予約追加</button>
        </div>
      </div>

      {/* Date Nav */}
      <div className="h-[52px] border-b flex items-center justify-center gap-4 flex-shrink-0" style={{ backgroundColor: T.card, borderColor: T.border }}>
        <button onClick={prevDay} className="p-1.5 rounded-lg cursor-pointer" style={{ color: T.textSub }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="15 18 9 12 15 6"/></svg></button>
        <button onClick={() => setSelectedDate(new Date().toISOString().split("T")[0])} className="px-3 py-1 text-[11px] border rounded-lg cursor-pointer" style={{ borderColor: T.border, color: T.textSub }}>今日</button>
        <span className="text-[14px] font-medium min-w-[200px] text-center">{dateDisplay}</span>
        <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="text-[12px] border rounded-lg px-2 py-1 outline-none cursor-pointer" style={{ borderColor: T.border, color: T.textSub, backgroundColor: T.card }} />
        <button onClick={nextDay} className="p-1.5 rounded-lg cursor-pointer" style={{ color: T.textSub }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="9 18 15 12 9 6"/></svg></button>
      </div>

      {/* Timeline */}
      <div className="flex-1 overflow-auto select-none [&::-webkit-scrollbar]:h-[4px] [&::-webkit-scrollbar-thumb]:bg-[#d3d1c7]/40 [&::-webkit-scrollbar-thumb]:rounded-full" ref={timelineRef} style={{ cursor: isPanning ? "grabbing" : "grab" }} onMouseDown={handlePanStart} onMouseMove={handlePanMove} onMouseUp={handlePanEnd} onMouseLeave={handlePanEnd}>
        {displayTherapists.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={T.textFaint} strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
            <p className="text-[14px] mt-4" style={{ color: T.textMuted }}>本日のシフトが登録されていません</p>
          </div>
        ) : (
          <div className="flex" style={{ minWidth: totalWidth + 170 }}>
            {/* Names */}
            <div className="w-[170px] flex-shrink-0 sticky left-0 z-20" style={{ backgroundColor: T.bg }}>
              <div className="h-[40px] border-b border-r flex items-center px-3" style={{ backgroundColor: T.cardAlt, borderColor: T.border }}>
                <span className="text-[11px]" style={{ color: T.textSub }}>セラピスト</span>
              </div>
              {displayTherapists.map((t, ti) => {
                const isCO = clockedOut.has(t.id);
                const origIdx = therapists.findIndex((x) => x.id === t.id);
                return (
                  <div key={t.id} className="h-[72px] border-b border-r flex items-center px-3 gap-2" style={{ backgroundColor: isCO ? (dark ? "#2a2020" : "#faf5f5") : T.card, borderColor: T.border, opacity: isCO ? 0.5 : 1 }}>
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] text-white font-medium flex-shrink-0" style={{ backgroundColor: isCO ? "#888" : colors[origIdx % colors.length] }}>{t.name.charAt(0)}</div>
                    <div className="flex-1 min-w-0">
                      <span className="text-[11px] font-medium truncate block" style={{ textDecoration: isCO ? "line-through" : "none" }}>{t.name}</span>
                      {isCO && <span className="text-[8px]" style={{ color: "#c45555" }}>退勤済</span>}
                    </div>
                    <button onClick={() => toggleClockOut(t.id)} className="text-[8px] px-1.5 py-1 rounded cursor-pointer border flex-shrink-0"
                      style={{ borderColor: isCO ? "#7ab88f66" : "#c4555566", backgroundColor: isCO ? "#7ab88f12" : "#c4555512", color: isCO ? "#7ab88f" : "#c45555" }}>
                      {isCO ? "復活" : "退勤"}
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Grid */}
            <div className="flex-1 relative">
              <div className="h-[40px] flex border-b sticky top-0 z-10" style={{ backgroundColor: T.cardAlt, borderColor: T.border }}>
                {HOURS_RAW.map((rawH, i) => (
                  <div key={rawH} className="flex-shrink-0 border-r flex items-end pb-1 px-1 relative" style={{ width: HOUR_WIDTH, borderColor: T.border }}>
                    <span className="text-[11px] font-medium" style={{ color: rawH >= 24 ? "#85a8c4" : T.textSub }}>{HOURS_DISPLAY[i]}:00</span>
                    {[1, 2, 3, 4, 5].map((tick) => (<div key={tick} className="absolute bottom-0" style={{ left: tick * MIN_10_WIDTH, width: 1, height: tick === 3 ? 8 : 4, backgroundColor: tick === 3 ? T.textFaint : T.border }} />))}
                  </div>
                ))}
              </div>
              {/* Current Time */}
              {selectedDate === new Date().toISOString().split("T")[0] && currentTimePos >= 0 && (
                <div className="absolute top-0 bottom-0 z-30 pointer-events-none" style={{ left: currentTimePos }}>
                  <div className="w-3 h-3 rounded-full bg-[#e24b4a] -ml-1.5 -mt-1 relative z-10" />
                  <div className="w-[2px] h-full bg-[#e24b4a]/60 -mt-1 ml-[5px]" />
                </div>
              )}
              {/* Rows */}
              {displayTherapists.map((t, ti) => {
                const tRes = getResForTherapist(t.id);
                const isCO = clockedOut.has(t.id);
                const origIdx = therapists.findIndex((x) => x.id === t.id);
                return (
                  <div key={t.id} className="h-[72px] border-b relative transition-colors"
                    style={{ backgroundColor: isCO ? (dark ? "#2a2020" : "#faf5f5") : T.card, borderColor: T.border, opacity: isCO ? 0.4 : 1 }}
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest(".res-block") || isCO) return;
                      const rect = e.currentTarget.getBoundingClientRect(); const x = e.clientX - rect.left; const min = Math.round(x / MIN_10_WIDTH) * 10;
                      if (panMoved.current) return;
                      setNewTherapistId(t.id); setNewStart(minutesToTime(min)); setNewEnd(minutesToTime(min + 60)); setNewDate(selectedDate); setNewCourseId(0); setMsg(""); setShowNewRes(true);
                    }}>
                    {HOURS_RAW.map((rawH) => (<div key={`g-${t.id}-${rawH}`} className="absolute top-0 bottom-0" style={{ left: (rawH - 9) * HOUR_WIDTH, width: 1, backgroundColor: T.border }}>{[1, 2, 3, 4, 5].map((tick) => (<div key={tick} className="absolute top-0 bottom-0" style={{ left: tick * MIN_10_WIDTH, width: 1, backgroundColor: dark ? "#2a2a32" : "#f8f6f3" }} />))}</div>))}
                    {tRes.map((r, ri) => {
                      const sM = timeToMinutes(r.start_time); const eM = timeToMinutes(r.end_time);
                      const left = sM * (HOUR_WIDTH / 60); const width = (eM - sM) * (HOUR_WIDTH / 60);
                      const course = getCourseByName(r.course); const color = colors[origIdx % colors.length];
                      return (
                        <div key={`res-${r.id}-${ri}`} className="res-block absolute top-[4px] bottom-[4px] rounded-lg cursor-pointer group"
                          style={{ left, width: Math.max(width, MIN_10_WIDTH), backgroundColor: color + "20", borderLeft: `3px solid ${color}`, zIndex: 5 }}
                          onClick={(e) => { e.stopPropagation(); openEdit(r); }}>
                          <div className="absolute left-0 top-0 bottom-0 w-[6px] cursor-ew-resize opacity-0 group-hover:opacity-100 hover:bg-black/10 rounded-l-lg"
                            onMouseDown={(e) => { e.stopPropagation(); setDragInfo({ resId: r.id, edge: "start", initX: e.clientX, initMin: sM, initEndMin: eM }); }} />
                          <div className="px-2 py-1 overflow-hidden h-full"
                            onMouseDown={(e) => { if ((e.target as HTMLElement).closest(".drag-handle")) return; e.stopPropagation(); setDragInfo({ resId: r.id, edge: "move", initX: e.clientX, initMin: sM, initEndMin: eM }); }}>
                            <p className="text-[11px] font-medium truncate" style={{ color: T.text }}>{r.customer_name}</p>
                            <p className="text-[9px] truncate" style={{ color: T.textSub }}>{r.course || `${r.start_time}〜${r.end_time}`}</p>
                            {course && width > 80 && (<div className="flex items-center gap-1 mt-0.5"><span className="text-[8px] font-medium" style={{ color: "#c3a782" }}>{fmt(course.price)}</span><span className="text-[8px]" style={{ color: "#7ab88f" }}>B:{fmt(course.therapist_back)}</span></div>)}
                          </div>
                          <div className="drag-handle absolute right-0 top-0 bottom-0 w-[6px] cursor-ew-resize opacity-0 group-hover:opacity-100 hover:bg-black/10 rounded-r-lg"
                            onMouseDown={(e) => { e.stopPropagation(); setDragInfo({ resId: r.id, edge: "end", initX: e.clientX, initMin: sM, initEndMin: eM }); }} />
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Summary */}
      <div className="border-t p-4 flex-shrink-0" style={{ backgroundColor: T.card, borderColor: T.border }}>
        <div className="flex items-center gap-6 text-[11px]" style={{ color: T.textSub }}>
          <span>出勤: <strong style={{ color: T.text }}>{activeTherapists.length}</strong>名</span>
          {clockedOutTherapists.length > 0 && <span>退勤: <strong style={{ color: "#c45555" }}>{clockedOutTherapists.length}</strong>名</span>}
          <span>予約: <strong style={{ color: T.text }}>{reservations.length}</strong>件</span>
          <span>売上: <strong style={{ color: T.text }}>{fmt(reservations.reduce((s, r) => { const c = getCourseByName(r.course); return s + (c ? c.price : 0); }, 0))}</strong></span>
          <span>バック: <strong style={{ color: "#7ab88f" }}>{fmt(reservations.reduce((s, r) => { const c = getCourseByName(r.course); return s + (c ? c.therapist_back : 0); }, 0))}</strong></span>
          <span className="ml-auto text-[10px]" style={{ color: T.textFaint }}>ドラッグで時間変更 / クリックで編集</span>
        </div>
      </div>

      {/* New Reservation Modal */}
      {showNewRes && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowNewRes(false)}>
          <div className="rounded-2xl border p-8 w-full max-w-md animate-[fadeIn_0.25s]" style={{ backgroundColor: T.card, borderColor: T.border }} onClick={(e) => e.stopPropagation()}>
            <h2 className="text-[16px] font-medium mb-1">予約追加</h2>
            <p className="text-[11px] mb-6" style={{ color: T.textFaint }}>新しい予約を登録します</p>
            <div className="space-y-4">
              <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>顧客名 <span style={{ color: "#c49885" }}>*</span></label><input type="text" value={newCustName} onChange={(e) => setNewCustName(e.target.value)} placeholder="お客様の名前" className="w-full px-4 py-3 rounded-xl text-[13px] outline-none" style={inputStyle} /></div>
              <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>セラピスト <span style={{ color: "#c49885" }}>*</span></label><select value={newTherapistId} onChange={(e) => setNewTherapistId(Number(e.target.value))} className="w-full px-4 py-3 rounded-xl text-[13px] outline-none cursor-pointer" style={inputStyle}><option value={0}>選択してください</option>{therapists.map((t) => (<option key={t.id} value={t.id}>{t.name}</option>))}</select></div>
              <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>コース</label><select value={newCourseId} onChange={(e) => handleCourseChange(Number(e.target.value))} className="w-full px-4 py-3 rounded-xl text-[13px] outline-none cursor-pointer" style={inputStyle}><option value={0}>選択なし</option>{courses.map((c) => (<option key={c.id} value={c.id}>{c.name}（{c.duration}分 / {fmt(c.price)}）</option>))}</select></div>
              {selectedCourse && (<div className="rounded-xl p-3 flex items-center gap-4 text-[12px]" style={{ backgroundColor: T.cardAlt }}><span style={{ color: T.textSub }}>料金: <span className="font-medium" style={{ color: T.text }}>{fmt(selectedCourse.price)}</span></span><span style={{ color: T.textSub }}>バック: <span className="font-medium" style={{ color: "#7ab88f" }}>{fmt(selectedCourse.therapist_back)}</span></span></div>)}
              <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>日付</label><input type="date" value={newDate || selectedDate} onChange={(e) => setNewDate(e.target.value)} className="w-full px-4 py-3 rounded-xl text-[13px] outline-none cursor-pointer" style={inputStyle} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>開始時間</label><select value={newStart} onChange={(e) => handleStartChange(e.target.value)} className="w-full px-4 py-3 rounded-xl text-[13px] outline-none cursor-pointer" style={inputStyle}>{TIMES_10MIN.map((t) => (<option key={t} value={t}>{minutesToDisplay(timeToMinutes(t))}</option>))}</select></div>
                <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>終了時間{selectedCourse ? "（自動）" : ""}</label><select value={newEnd} onChange={(e) => setNewEnd(e.target.value)} disabled={!!selectedCourse} className="w-full px-4 py-3 rounded-xl text-[13px] outline-none cursor-pointer" style={{ ...inputStyle, color: selectedCourse ? "#c3a782" : T.text }}>{TIMES_10MIN.map((t) => (<option key={t} value={t}>{minutesToDisplay(timeToMinutes(t))}</option>))}</select></div>
              </div>
              <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>備考</label><input type="text" value={newNotes} onChange={(e) => setNewNotes(e.target.value)} placeholder="メモ" className="w-full px-4 py-3 rounded-xl text-[13px] outline-none" style={inputStyle} /></div>
              {msg && <div className="px-4 py-3 rounded-xl text-[12px]" style={{ backgroundColor: msg.includes("失敗") || msg.includes("選択") ? "#c4988518" : "#7ab88f18", color: msg.includes("失敗") || msg.includes("選択") ? "#c49885" : "#5a9e6f" }}>{msg}</div>}
              <div className="flex gap-3 pt-2">
                <button onClick={addReservation} disabled={saving} className="px-7 py-3 bg-gradient-to-r from-[#c3a782] to-[#b09672] text-white text-[12px] rounded-xl cursor-pointer disabled:opacity-60">{saving ? "登録中..." : "予約する"}</button>
                <button onClick={() => { setShowNewRes(false); setMsg(""); }} className="px-7 py-3 border text-[12px] rounded-xl cursor-pointer" style={{ borderColor: T.border, color: T.textSub }}>キャンセル</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editRes && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setEditRes(null)}>
          <div className="rounded-2xl border p-8 w-full max-w-md animate-[fadeIn_0.25s]" style={{ backgroundColor: T.card, borderColor: T.border }} onClick={(e) => e.stopPropagation()}>
            <h2 className="text-[16px] font-medium mb-1">予約編集</h2>
            <p className="text-[11px] mb-6" style={{ color: T.textFaint }}>予約情報を変更します</p>
            <div className="space-y-4">
              <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>顧客名</label><input type="text" value={editCustName} onChange={(e) => setEditCustName(e.target.value)} className="w-full px-4 py-3 rounded-xl text-[13px] outline-none" style={inputStyle} /></div>
              <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>セラピスト</label><select value={editTherapistId} onChange={(e) => setEditTherapistId(Number(e.target.value))} className="w-full px-4 py-3 rounded-xl text-[13px] outline-none cursor-pointer" style={inputStyle}>{therapists.map((t) => (<option key={t.id} value={t.id}>{t.name}</option>))}</select></div>
              <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>コース</label><select value={editCourseId} onChange={(e) => handleCourseChange(Number(e.target.value), true)} className="w-full px-4 py-3 rounded-xl text-[13px] outline-none cursor-pointer" style={inputStyle}><option value={0}>選択なし</option>{courses.map((c) => (<option key={c.id} value={c.id}>{c.name}（{c.duration}分 / {fmt(c.price)}）</option>))}</select></div>
              {editSelectedCourse && (<div className="rounded-xl p-3 flex items-center gap-4 text-[12px]" style={{ backgroundColor: T.cardAlt }}><span style={{ color: T.textSub }}>料金: <span className="font-medium" style={{ color: T.text }}>{fmt(editSelectedCourse.price)}</span></span><span style={{ color: T.textSub }}>バック: <span className="font-medium" style={{ color: "#7ab88f" }}>{fmt(editSelectedCourse.therapist_back)}</span></span></div>)}
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>開始時間</label><select value={editStart} onChange={(e) => handleStartChange(e.target.value, true)} className="w-full px-4 py-3 rounded-xl text-[13px] outline-none cursor-pointer" style={inputStyle}>{TIMES_10MIN.map((t) => (<option key={t} value={t}>{minutesToDisplay(timeToMinutes(t))}</option>))}</select></div>
                <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>終了時間</label><select value={editEnd} onChange={(e) => setEditEnd(e.target.value)} disabled={!!editSelectedCourse} className="w-full px-4 py-3 rounded-xl text-[13px] outline-none cursor-pointer" style={{ ...inputStyle, color: editSelectedCourse ? "#c3a782" : T.text }}>{TIMES_10MIN.map((t) => (<option key={t} value={t}>{minutesToDisplay(timeToMinutes(t))}</option>))}</select></div>
              </div>
              <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>備考</label><input type="text" value={editNotes} onChange={(e) => setEditNotes(e.target.value)} className="w-full px-4 py-3 rounded-xl text-[13px] outline-none" style={inputStyle} /></div>
              {editMsg && <div className="px-4 py-3 rounded-xl text-[12px]" style={{ backgroundColor: editMsg.includes("失敗") ? "#c4988518" : "#7ab88f18", color: editMsg.includes("失敗") ? "#c49885" : "#5a9e6f" }}>{editMsg}</div>}
              <div className="flex gap-3 pt-2">
                <button onClick={updateReservation} disabled={editSaving} className="px-6 py-3 bg-gradient-to-r from-[#c3a782] to-[#b09672] text-white text-[12px] rounded-xl cursor-pointer disabled:opacity-60">{editSaving ? "更新中..." : "更新する"}</button>
                <button onClick={() => deleteReservation(editRes.id)} className="px-6 py-3 bg-[#c45555] text-white text-[12px] rounded-xl cursor-pointer">削除</button>
                <button onClick={() => setEditRes(null)} className="px-6 py-3 border text-[12px] rounded-xl cursor-pointer" style={{ borderColor: T.border, color: T.textSub }}>閉じる</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New Therapist Modal */}
      {showNewTherapist && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowNewTherapist(false)}>
          <div className="rounded-2xl border p-8 w-full max-w-sm animate-[fadeIn_0.25s]" style={{ backgroundColor: T.card, borderColor: T.border }} onClick={(e) => e.stopPropagation()}>
            <h2 className="text-[16px] font-medium mb-1">セラピスト追加</h2>
            <p className="text-[11px] mb-6" style={{ color: T.textFaint }}>新しいセラピストを登録します</p>
            <div className="space-y-4">
              <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>名前 <span style={{ color: "#c49885" }}>*</span></label><input type="text" value={tName} onChange={(e) => setTName(e.target.value)} placeholder="セラピスト名" className="w-full px-4 py-3 rounded-xl text-[13px] outline-none" style={inputStyle} /></div>
              <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>電話番号</label><input type="tel" value={tPhone} onChange={(e) => setTPhone(e.target.value)} placeholder="090-xxxx-xxxx" className="w-full px-4 py-3 rounded-xl text-[13px] outline-none" style={inputStyle} /></div>
              <div className="flex gap-3 pt-2">
                <button onClick={addTherapist} className="px-7 py-3 bg-gradient-to-r from-[#c3a782] to-[#b09672] text-white text-[12px] rounded-xl cursor-pointer">登録する</button>
                <button onClick={() => setShowNewTherapist(false)} className="px-7 py-3 border text-[12px] rounded-xl cursor-pointer" style={{ borderColor: T.border, color: T.textSub }}>キャンセル</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  );
}
