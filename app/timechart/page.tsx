"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";

type Therapist = { id: number; name: string; phone: string; status: string };
type Reservation = {
  id: number; customer_name: string; therapist_id: number;
  date: string; start_time: string; end_time: string; course: string; notes: string;
};
type Course = { id: number; name: string; duration: number; price: number; therapist_back: number };

const HOUR_WIDTH = 120;
const MIN_10_WIDTH = HOUR_WIDTH / 6;
const HOURS_DISPLAY = Array.from({ length: 19 }, (_, i) => {
  const h = i + 9;
  return h >= 24 ? h - 24 : h;
});
const HOURS_RAW = Array.from({ length: 19 }, (_, i) => i + 9);

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  const adjusted = h < 9 ? h + 24 : h;
  return (adjusted - 9) * 60 + m;
}

function minutesToTime(min: number): string {
  const totalMin = min + 9 * 60;
  const h = Math.floor(totalMin / 60) % 24;
  const m = totalMin % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function minutesToDisplay(min: number): string {
  const totalMin = min + 9 * 60;
  const h = Math.floor(totalMin / 60);
  const displayH = h >= 24 ? h - 24 : h;
  const m = totalMin % 60;
  return `${displayH}:${String(m).padStart(2, "0")}`;
}

const TIMES_10MIN: string[] = [];
for (let m = 0; m <= 18 * 60; m += 10) {
  TIMES_10MIN.push(minutesToTime(m));
}

export default function TimeChart() {
  const router = useRouter();
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split("T")[0]);

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

  // Pan scroll state
// Current time update
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const currentTimePos = (() => {
    const now = currentTime;
    const h = now.getHours();
    const m = now.getMinutes();
    const adjustedH = h < 9 ? h + 24 : h;
    if (adjustedH < 9 || adjustedH >= 27) return -1;
    return ((adjustedH - 9) * 60 + m) * (HOUR_WIDTH / 60);
  })();

  const [isPanning, setIsPanning] = useState(false);
  const panStartX = useRef(0);
  const panMoved = useRef(false);
  const panScrollLeft = useRef(0);
  const velocity = useRef(0);
  const lastX = useRef(0);
  const lastTime = useRef(0);
  const animFrame = useRef<number>(0);

  const selectedCourse = courses.find((c) => c.id === newCourseId);
  const editSelectedCourse = courses.find((c) => c.id === editCourseId);

  const fetchData = useCallback(async () => {
    const { data: t } = await supabase.from("therapists").select("*").order("id");
    if (t) setTherapists(t);
    const { data: r } = await supabase.from("reservations").select("*").eq("date", selectedDate).order("start_time");
    if (r) setReservations(r);
    const { data: c } = await supabase.from("courses").select("*").order("duration");
    if (c) setCourses(c);
  }, [selectedDate]);

  useEffect(() => {
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) router.push("/");
    };
    check();
    fetchData();
  }, [router, fetchData]);

  // Pan scroll handlers
  const handlePanStart = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest(".res-block")) return;
    const container = timelineRef.current;
    if (!container) return;
    setIsPanning(true);panMoved.current = false;
    panStartX.current = e.clientX;
    panScrollLeft.current = container.scrollLeft;
    lastX.current = e.clientX;
    lastTime.current = Date.now();
    velocity.current = 0;
    cancelAnimationFrame(animFrame.current);
  };

  const handlePanMove = (e: React.MouseEvent) => {
    if (!isPanning) return;
    const container = timelineRef.current;
    if (!container) return;
    e.preventDefault();
    const dx = e.clientX - panStartX.current;
    container.scrollLeft = panScrollLeft.current - dx;if (Math.abs(dx) > 5) panMoved.current = true;
    const now = Date.now();
    const dt = now - lastTime.current;
    if (dt > 0) {
      velocity.current = (e.clientX - lastX.current) / dt;
    }
    lastX.current = e.clientX;
    lastTime.current = now;
  };

  const handlePanEnd = () => {
    if (!isPanning) return;
    setIsPanning(false);
    const container = timelineRef.current;
    if (!container) return;
    let v = velocity.current * 15;
    const decelerate = () => {
      if (Math.abs(v) < 0.5) return;
      container.scrollLeft -= v;
      v *= 0.92;
      animFrame.current = requestAnimationFrame(decelerate);
    };
    decelerate();
  };

  // Drag handlers
  useEffect(() => {
    if (!dragInfo) return;
    const handleMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - dragInfo.initX;
      const dMin = Math.round(dx / MIN_10_WIDTH) * 10;
      const res = reservations.find((r) => r.id === dragInfo.resId);
      if (!res) return;

      if (dragInfo.edge === "end") {
        const newEndMin = Math.max(dragInfo.initEndMin + dMin, dragInfo.initMin + 10);
        const newEnd = minutesToTime(newEndMin);
        supabase.from("reservations").update({ end_time: newEnd }).eq("id", dragInfo.resId).then(() => fetchData());
      } else if (dragInfo.edge === "start") {
        const newStartMin = Math.min(dragInfo.initMin + dMin, dragInfo.initEndMin - 10);
        const newStart = minutesToTime(Math.max(0, newStartMin));
        supabase.from("reservations").update({ start_time: newStart }).eq("id", dragInfo.resId).then(() => fetchData());
      } else if (dragInfo.edge === "move") {
        const newStartMin = Math.max(0, dragInfo.initMin + dMin);
        const duration = dragInfo.initEndMin - dragInfo.initMin;
        const newEndMin = newStartMin + duration;
        if (newEndMin <= 18 * 60) {
          const ns = minutesToTime(newStartMin);
          const ne = minutesToTime(newEndMin);
          supabase.from("reservations").update({ start_time: ns, end_time: ne }).eq("id", dragInfo.resId).then(() => fetchData());
        }
      }
    };
    const handleMouseUp = () => setDragInfo(null);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => { window.removeEventListener("mousemove", handleMouseMove); window.removeEventListener("mouseup", handleMouseUp); };
  }, [dragInfo, reservations, fetchData]);

  const handleCourseChange = (courseId: number, isEdit = false) => {
    const course = courses.find((c) => c.id === courseId);
    if (isEdit) {
      setEditCourseId(courseId);
      if (course && editStart) {
        const startMin = timeToMinutes(editStart);
        setEditEnd(minutesToTime(startMin + course.duration));
      }
    } else {
      setNewCourseId(courseId);
      if (course && newStart) {
        const startMin = timeToMinutes(newStart);
        setNewEnd(minutesToTime(startMin + course.duration));
      }
    }
  };

  const handleStartChange = (start: string, isEdit = false) => {
    if (isEdit) {
      setEditStart(start);
      if (editSelectedCourse) {
        const startMin = timeToMinutes(start);
        setEditEnd(minutesToTime(startMin + editSelectedCourse.duration));
      }
    } else {
      setNewStart(start);
      if (selectedCourse) {
        const startMin = timeToMinutes(start);
        setNewEnd(minutesToTime(startMin + selectedCourse.duration));
      }
    }
  };

  const addReservation = async () => {
    if (!newCustName.trim() || !newTherapistId) { setMsg("顧客名とセラピストを選択してください"); return; }
    setSaving(true); setMsg("");
    const { data: { user } } = await supabase.auth.getUser();
    const courseName = selectedCourse ? selectedCourse.name : "";
    const { error } = await supabase.from("reservations").insert({
      customer_name: newCustName.trim(), therapist_id: newTherapistId,
      date: newDate || selectedDate, start_time: newStart, end_time: newEnd,
      course: courseName, notes: newNotes.trim(), user_id: user?.id,
    });
    setSaving(false);
    if (error) { setMsg("登録失敗: " + error.message); }
    else {
      setMsg("予約を登録しました！");
      setNewCustName(""); setNewTherapistId(0); setNewCourseId(0); setNewNotes("");
      setNewStart("12:00"); setNewEnd("13:00");
      fetchData();
      setTimeout(() => { setShowNewRes(false); setMsg(""); }, 600);
    }
  };

  const openEdit = (r: Reservation) => {
    setEditRes(r);
    setEditCustName(r.customer_name);
    setEditTherapistId(r.therapist_id);
    setEditStart(r.start_time);
    setEditEnd(r.end_time);
    setEditNotes(r.notes || "");
    const course = courses.find((c) => c.name === r.course);
    setEditCourseId(course ? course.id : 0);
    setEditMsg("");
  };

  const updateReservation = async () => {
    if (!editRes) return;
    setEditSaving(true); setEditMsg("");
    const courseName = editSelectedCourse ? editSelectedCourse.name : editRes.course;
    const { error } = await supabase.from("reservations").update({
      customer_name: editCustName.trim(), therapist_id: editTherapistId,
      start_time: editStart, end_time: editEnd, course: courseName, notes: editNotes.trim(),
    }).eq("id", editRes.id);
    setEditSaving(false);
    if (error) { setEditMsg("更新失敗: " + error.message); }
    else {
      setEditMsg("更新しました！");
      fetchData();
      setTimeout(() => { setEditRes(null); setEditMsg(""); }, 600);
    }
  };

  const deleteReservation = async (id: number) => {
    
  const { error } = await supabase.from("reservations").delete().eq("id", id);
    if (error) { alert("削除失敗: " + error.message); return; }
    setEditRes(null);
    fetchData();
  };

  const addTherapist = async () => {
    if (!tName.trim()) return;
    await supabase.from("therapists").insert({ name: tName.trim(), phone: tPhone.trim(), status: "active" });
    setTName(""); setTPhone("");
    setShowNewTherapist(false);
    fetchData();
  };

  const getCourseByName = (name: string) => courses.find((c) => c.name === name);
  const fmt = (n: number) => "¥" + (n || 0).toLocaleString();

  const prevDay = () => { const d = new Date(selectedDate); d.setDate(d.getDate() - 1); setSelectedDate(d.toISOString().split("T")[0]); };
  const nextDay = () => { const d = new Date(selectedDate); d.setDate(d.getDate() + 1); setSelectedDate(d.toISOString().split("T")[0]); };

  const dateDisplay = (() => {
    const d = new Date(selectedDate + "T00:00:00");
    const days = ["日", "月", "火", "水", "木", "金", "土"];
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日（${days[d.getDay()]}）`;
  })();

  const colors = ["#c3a782", "#7ab88f", "#85a8c4", "#c49885", "#a885c4", "#85c4b8", "#c4a685", "#8599c4"];
  const totalWidth = 19 * HOUR_WIDTH;

  const getResForTherapist = (therapistId: number) => reservations.filter((r) => r.therapist_id === therapistId);

  return (
    <div className="h-screen flex flex-col bg-[#f8f6f3]">
      {/* Header */}
      <div className="h-[64px] bg-white/80 backdrop-blur-xl border-b border-[#e8e4df] flex items-center justify-between px-6 flex-shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push("/dashboard")} className="p-2 rounded-lg hover:bg-[#f8f6f3] transition-colors cursor-pointer">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9c9a92" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <h1 className="text-[15px] font-medium text-[#2c2c2a]">タイムチャート</h1>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowNewTherapist(true)} className="px-4 py-2 border border-[#e8e4df] text-[#888780] text-[11px] rounded-xl hover:bg-[#f8f6f3] transition-colors cursor-pointer">+ セラピスト追加</button>
          <button onClick={() => { setShowNewRes(true); setNewDate(selectedDate); setNewCourseId(0); setNewStart("12:00"); setNewEnd("13:00"); setMsg(""); }}
            className="px-4 py-2 bg-gradient-to-r from-[#c3a782] to-[#b09672] text-white text-[11px] rounded-xl hover:shadow-[0_4px_16px_rgba(195,167,130,0.25)] transition-all cursor-pointer">+ 予約追加</button>
        </div>
      </div>

      {/* Date Nav */}
      <div className="h-[52px] bg-white border-b border-[#e8e4df] flex items-center justify-center gap-4 flex-shrink-0">
        <button onClick={prevDay} className="p-1.5 rounded-lg hover:bg-[#f8f6f3] transition-colors cursor-pointer">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#888780" strokeWidth="1.5"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <button onClick={() => setSelectedDate(new Date().toISOString().split("T")[0])} className="px-3 py-1 text-[11px] text-[#888780] border border-[#e8e4df] rounded-lg hover:bg-[#f8f6f3] cursor-pointer">今日</button>
        <span className="text-[14px] font-medium text-[#2c2c2a] min-w-[200px] text-center">{dateDisplay}</span>
        <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)}
          className="text-[12px] text-[#888780] border border-[#e8e4df] rounded-lg px-2 py-1 outline-none cursor-pointer" />
        <button onClick={nextDay} className="p-1.5 rounded-lg hover:bg-[#f8f6f3] transition-colors cursor-pointer">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#888780" strokeWidth="1.5"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>

      {/* Timeline */}
      <div className="flex-1 overflow-auto select-none [&::-webkit-scrollbar]:h-[4px] [&::-webkit-scrollbar-thumb]:bg-[#d3d1c7]/40 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent hover:[&::-webkit-scrollbar-thumb]:bg-[#b4b2a9]/50" ref={timelineRef} style={{ cursor: isPanning ? "grabbing" : "grab" }} onMouseDown={handlePanStart} onMouseMove={handlePanMove} onMouseUp={handlePanEnd} onMouseLeave={handlePanEnd}>
        {therapists.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#e0dbd2" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            <p className="text-[14px] text-[#b4b2a9] mt-4">セラピストが登録されていません</p>
            <button onClick={() => setShowNewTherapist(true)} className="mt-4 px-5 py-2.5 bg-gradient-to-r from-[#c3a782] to-[#b09672] text-white text-[12px] rounded-xl cursor-pointer">+ セラピストを追加</button>
          </div>
        ) : (
          <div className="flex" style={{ minWidth: totalWidth + 130 }}>
            {/* Therapist Names */}
            <div className="w-[130px] flex-shrink-0 sticky left-0 z-20 bg-[#f8f6f3]">
              <div className="h-[40px] bg-[#f0ece4] border-b border-r border-[#e8e4df] flex items-center px-3">
                <span className="text-[11px] text-[#888780]">セラピスト</span>
              </div>
              {therapists.map((t, ti) => (
                <div key={t.id} className="h-[72px] bg-white border-b border-r border-[#e8e4df] flex items-center px-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] text-white font-medium flex-shrink-0" style={{ backgroundColor: colors[ti % colors.length] }}>
                      {t.name.charAt(0)}
                    </div>
                    <span className="text-[12px] text-[#2c2c2a] font-medium truncate">{t.name}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Timeline Grid */}
            <div className="flex-1 relative">
              {/* Hour Headers */}
              <div className="h-[40px] flex bg-[#f0ece4] border-b border-[#e8e4df] sticky top-0 z-10">
                {HOURS_RAW.map((rawH, i) => (
                  <div key={rawH} className="flex-shrink-0 border-r border-[#e8e4df] flex items-end pb-1 px-1 relative" style={{ width: HOUR_WIDTH }}>
                    <span className={`text-[11px] font-medium ${rawH >= 24 ? "text-[#85a8c4]" : "text-[#888780]"}`}>
                      {HOURS_DISPLAY[i]}:00
                    </span>
                    {/* 10-min ticks */}
                    {[1, 2, 3, 4, 5].map((tick) => (
                      <div key={tick} className="absolute bottom-0" style={{ left: tick * MIN_10_WIDTH, width: 1, height: tick === 3 ? 8 : 4, backgroundColor: tick === 3 ? "#d3d1c7" : "#e8e4df" }} />
                    ))}
                  </div>
                ))}
              </div>
              {/* Current Time Line */}
              {selectedDate === new Date().toISOString().split("T")[0] && currentTimePos >= 0 && (
                <div className="absolute top-0 bottom-0 z-30 pointer-events-none" style={{ left: currentTimePos }}>
                  <div className="w-3 h-3 rounded-full bg-[#e24b4a] -ml-1.5 -mt-1 relative z-10" />
                  <div className="w-[2px] h-full bg-[#e24b4a]/60 -mt-1 ml-[5px]" />
                </div>
              )}
              {/* Therapist Rows */}
              {therapists.map((t, ti) => {
                const tRes = getResForTherapist(t.id);
                return (
                  <div key={t.id} className="h-[72px] border-b border-[#e8e4df] relative bg-white hover:bg-[#faf9f7] transition-colors"
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest(".res-block")) return;
                      const rect = e.currentTarget.getBoundingClientRect();
                      const x = e.clientX - rect.left;
                      const min = Math.round(x / MIN_10_WIDTH) * 10;
                      const startTime = minutesToTime(min);
                      if (panMoved.current) return;
                      setNewTherapistId(t.id);
                      setNewStart(startTime);
                      setNewEnd(minutesToTime(min + 60));
                      setNewDate(selectedDate);
                      setNewCourseId(0);
                      setMsg("");
                      setShowNewRes(true);
                    }}>
                    {/* 10-min grid lines */}
                    {HOURS_RAW.map((rawH) => (
                      <div key={`grid-${t.id}-${rawH}`} className="absolute top-0 bottom-0" style={{ left: (rawH - 9) * HOUR_WIDTH, width: 1, backgroundColor: "#e8e4df" }}>
                        {[1, 2, 3, 4, 5].map((tick) => (
                          <div key={`tick-${rawH}-${tick}`} className="absolute top-0 bottom-0" style={{ left: tick * MIN_10_WIDTH, width: 1, backgroundColor: tick === 3 ? "#f0ece4" : "#f8f6f3" }} />
                        ))}
                      </div>
                    ))}

                    {/* Reservations */}
                    {tRes.map((r, ri) => {
                      const startMin = timeToMinutes(r.start_time);
                      const endMin = timeToMinutes(r.end_time);
                      const left = startMin * (HOUR_WIDTH / 60);
                      const width = (endMin - startMin) * (HOUR_WIDTH / 60);
                      const course = getCourseByName(r.course);
                      const color = colors[ti % colors.length];

                      return (
                        <div key={`res-${r.id}-${ri}`} className="res-block absolute top-[4px] bottom-[4px] rounded-lg cursor-pointer group"
                          style={{ left, width: Math.max(width, MIN_10_WIDTH), backgroundColor: color + "20", borderLeft: `3px solid ${color}`, zIndex: 5 }}
                          onClick={(e) => { e.stopPropagation(); openEdit(r); }}>
                          {/* Drag handle: left */}
                          <div className="absolute left-0 top-0 bottom-0 w-[6px] cursor-ew-resize opacity-0 group-hover:opacity-100 hover:bg-black/10 rounded-l-lg"
                            onMouseDown={(e) => { e.stopPropagation(); setDragInfo({ resId: r.id, edge: "start", initX: e.clientX, initMin: startMin, initEndMin: endMin }); }} />
                          {/* Content */}
                          <div className="px-2 py-1 overflow-hidden h-full"
                            onMouseDown={(e) => { if ((e.target as HTMLElement).closest(".drag-handle")) return; e.stopPropagation(); setDragInfo({ resId: r.id, edge: "move", initX: e.clientX, initMin: startMin, initEndMin: endMin }); }}>
                            <p className="text-[11px] font-medium text-[#2c2c2a] truncate">{r.customer_name}</p>
                            <p className="text-[9px] text-[#888780] truncate">{r.course || `${r.start_time}〜${r.end_time}`}</p>
                            {course && width > 80 && (
                              <div className="flex items-center gap-1 mt-0.5">
                                <span className="text-[8px] text-[#c3a782] font-medium">{fmt(course.price)}</span>
                                <span className="text-[8px] text-[#7ab88f]">B:{fmt(course.therapist_back)}</span>
                              </div>
                            )}
                          </div>
                          {/* Drag handle: right */}
                          <div className="drag-handle absolute right-0 top-0 bottom-0 w-[6px] cursor-ew-resize opacity-0 group-hover:opacity-100 hover:bg-black/10 rounded-r-lg"
                            onMouseDown={(e) => { e.stopPropagation(); setDragInfo({ resId: r.id, edge: "end", initX: e.clientX, initMin: startMin, initEndMin: endMin }); }} />
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
      <div className="border-t border-[#e8e4df] bg-white p-4 flex-shrink-0">
        <div className="flex items-center gap-6 text-[11px] text-[#888780]">
          <span>予約: <strong className="text-[#2c2c2a]">{reservations.length}</strong>件</span>
          <span>売上: <strong className="text-[#2c2c2a]">{fmt(reservations.reduce((s, r) => { const c = getCourseByName(r.course); return s + (c ? c.price : 0); }, 0))}</strong></span>
          <span>バック: <strong className="text-[#7ab88f]">{fmt(reservations.reduce((s, r) => { const c = getCourseByName(r.course); return s + (c ? c.therapist_back : 0); }, 0))}</strong></span>
          <span className="ml-auto text-[10px] text-[#d3d1c7]">ドラッグで時間変更 / クリックで編集</span>
        </div>
      </div>

      {/* New Reservation Modal */}
      {showNewRes && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowNewRes(false)}>
          <div className="bg-white rounded-2xl border border-[#f0ece4] p-8 w-full max-w-md animate-[fadeIn_0.25s_ease-out]" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-[16px] font-medium text-[#2c2c2a] mb-1">予約追加</h2>
            <p className="text-[11px] text-[#d3d1c7] mb-6">新しい予約を登録します</p>
            <div className="space-y-4">
              <div>
                <label className="block text-[11px] text-[#888780] mb-1.5">顧客名 <span className="text-[#c49885]">*</span></label>
                <input type="text" value={newCustName} onChange={(e) => setNewCustName(e.target.value)} placeholder="お客様の名前"
                  className="w-full px-4 py-3 bg-[#f8f6f3] border border-transparent rounded-xl text-[13px] outline-none focus:border-[#c3a782]/30 focus:bg-white transition-all placeholder-[#d3d1c7]" />
              </div>
              <div>
                <label className="block text-[11px] text-[#888780] mb-1.5">セラピスト <span className="text-[#c49885]">*</span></label>
                <select value={newTherapistId} onChange={(e) => setNewTherapistId(Number(e.target.value))}
                  className="w-full px-4 py-3 bg-[#f8f6f3] border border-transparent rounded-xl text-[13px] outline-none focus:border-[#c3a782]/30 focus:bg-white transition-all cursor-pointer">
                  <option value={0}>選択してください</option>
                  {therapists.map((t) => (<option key={t.id} value={t.id}>{t.name}</option>))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] text-[#888780] mb-1.5">コース</label>
                <select value={newCourseId} onChange={(e) => handleCourseChange(Number(e.target.value))}
                  className="w-full px-4 py-3 bg-[#f8f6f3] border border-transparent rounded-xl text-[13px] outline-none focus:border-[#c3a782]/30 focus:bg-white transition-all cursor-pointer">
                  <option value={0}>選択なし</option>
                  {courses.map((c) => (<option key={c.id} value={c.id}>{c.name}（{c.duration}分 / {fmt(c.price)}）</option>))}
                </select>
              </div>
              {selectedCourse && (
                <div className="bg-[#f8f6f3] rounded-xl p-3 flex items-center gap-4 text-[12px]">
                  <span className="text-[#888780]">料金: <span className="text-[#2c2c2a] font-medium">{fmt(selectedCourse.price)}</span></span>
                  <span className="text-[#888780]">バック: <span className="text-[#7ab88f] font-medium">{fmt(selectedCourse.therapist_back)}</span></span>
                  <span className="text-[#888780]">利益: <span className="text-[#2c2c2a] font-medium">{fmt(selectedCourse.price - selectedCourse.therapist_back)}</span></span>
                </div>
              )}
              <div>
                <label className="block text-[11px] text-[#888780] mb-1.5">日付</label>
                <input type="date" value={newDate || selectedDate} onChange={(e) => setNewDate(e.target.value)}
                  className="w-full px-4 py-3 bg-[#f8f6f3] border border-transparent rounded-xl text-[13px] outline-none focus:border-[#c3a782]/30 focus:bg-white transition-all cursor-pointer" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-[#888780] mb-1.5">開始時間</label>
                  <select value={newStart} onChange={(e) => handleStartChange(e.target.value)}
                    className="w-full px-4 py-3 bg-[#f8f6f3] border border-transparent rounded-xl text-[13px] outline-none focus:border-[#c3a782]/30 focus:bg-white transition-all cursor-pointer">
                    {TIMES_10MIN.map((t) => (<option key={t} value={t}>{minutesToDisplay(timeToMinutes(t))}</option>))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] text-[#888780] mb-1.5">終了時間{selectedCourse ? "（自動）" : ""}</label>
                  <select value={newEnd} onChange={(e) => setNewEnd(e.target.value)} disabled={!!selectedCourse}
                    className={`w-full px-4 py-3 bg-[#f8f6f3] border border-transparent rounded-xl text-[13px] outline-none transition-all cursor-pointer ${selectedCourse ? "text-[#c3a782] font-medium" : ""}`}>
                    {TIMES_10MIN.map((t) => (<option key={t} value={t}>{minutesToDisplay(timeToMinutes(t))}</option>))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[11px] text-[#888780] mb-1.5">備考</label>
                <input type="text" value={newNotes} onChange={(e) => setNewNotes(e.target.value)} placeholder="メモ"
                  className="w-full px-4 py-3 bg-[#f8f6f3] border border-transparent rounded-xl text-[13px] outline-none focus:border-[#c3a782]/30 focus:bg-white transition-all placeholder-[#d3d1c7]" />
              </div>
              {msg && <div className={`px-4 py-3 rounded-xl text-[12px] ${msg.includes("失敗") || msg.includes("選択") ? "bg-[#c49885]/10 text-[#c49885]" : "bg-[#7ab88f]/10 text-[#5a9e6f]"}`}>{msg}</div>}
              <div className="flex gap-3 pt-2">
                <button onClick={addReservation} disabled={saving} className="px-7 py-3 bg-gradient-to-r from-[#c3a782] to-[#b09672] text-white text-[12px] rounded-xl hover:shadow-[0_4px_16px_rgba(195,167,130,0.25)] transition-all cursor-pointer disabled:opacity-60">{saving ? "登録中..." : "予約する"}</button>
                <button onClick={() => { setShowNewRes(false); setMsg(""); }} className="px-7 py-3 border border-[#f0ece4] text-[#888780] text-[12px] rounded-xl hover:bg-[#f8f6f3] transition-all cursor-pointer">キャンセル</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Reservation Modal */}
      {editRes && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setEditRes(null)}>
          <div className="bg-white rounded-2xl border border-[#f0ece4] p-8 w-full max-w-md animate-[fadeIn_0.25s_ease-out]" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-[16px] font-medium text-[#2c2c2a] mb-1">予約編集</h2>
            <p className="text-[11px] text-[#d3d1c7] mb-6">予約情報を変更します</p>
            <div className="space-y-4">
              <div>
                <label className="block text-[11px] text-[#888780] mb-1.5">顧客名</label>
                <input type="text" value={editCustName} onChange={(e) => setEditCustName(e.target.value)}
                  className="w-full px-4 py-3 bg-[#f8f6f3] border border-transparent rounded-xl text-[13px] outline-none focus:border-[#c3a782]/30 focus:bg-white transition-all" />
              </div>
              <div>
                <label className="block text-[11px] text-[#888780] mb-1.5">セラピスト</label>
                <select value={editTherapistId} onChange={(e) => setEditTherapistId(Number(e.target.value))}
                  className="w-full px-4 py-3 bg-[#f8f6f3] border border-transparent rounded-xl text-[13px] outline-none focus:border-[#c3a782]/30 focus:bg-white transition-all cursor-pointer">
                  {therapists.map((t) => (<option key={t.id} value={t.id}>{t.name}</option>))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] text-[#888780] mb-1.5">コース</label>
                <select value={editCourseId} onChange={(e) => handleCourseChange(Number(e.target.value), true)}
                  className="w-full px-4 py-3 bg-[#f8f6f3] border border-transparent rounded-xl text-[13px] outline-none focus:border-[#c3a782]/30 focus:bg-white transition-all cursor-pointer">
                  <option value={0}>選択なし</option>
                  {courses.map((c) => (<option key={c.id} value={c.id}>{c.name}（{c.duration}分 / {fmt(c.price)}）</option>))}
                </select>
              </div>
              {editSelectedCourse && (
                <div className="bg-[#f8f6f3] rounded-xl p-3 flex items-center gap-4 text-[12px]">
                  <span className="text-[#888780]">料金: <span className="text-[#2c2c2a] font-medium">{fmt(editSelectedCourse.price)}</span></span>
                  <span className="text-[#888780]">バック: <span className="text-[#7ab88f] font-medium">{fmt(editSelectedCourse.therapist_back)}</span></span>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-[#888780] mb-1.5">開始時間</label>
                  <select value={editStart} onChange={(e) => handleStartChange(e.target.value, true)}
                    className="w-full px-4 py-3 bg-[#f8f6f3] border border-transparent rounded-xl text-[13px] outline-none focus:border-[#c3a782]/30 focus:bg-white transition-all cursor-pointer">
                    {TIMES_10MIN.map((t) => (<option key={t} value={t}>{minutesToDisplay(timeToMinutes(t))}</option>))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] text-[#888780] mb-1.5">終了時間</label>
                  <select value={editEnd} onChange={(e) => setEditEnd(e.target.value)} disabled={!!editSelectedCourse}
                    className={`w-full px-4 py-3 bg-[#f8f6f3] border border-transparent rounded-xl text-[13px] outline-none transition-all cursor-pointer ${editSelectedCourse ? "text-[#c3a782]" : ""}`}>
                    {TIMES_10MIN.map((t) => (<option key={t} value={t}>{minutesToDisplay(timeToMinutes(t))}</option>))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[11px] text-[#888780] mb-1.5">備考</label>
                <input type="text" value={editNotes} onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full px-4 py-3 bg-[#f8f6f3] border border-transparent rounded-xl text-[13px] outline-none focus:border-[#c3a782]/30 focus:bg-white transition-all" />
              </div>
              {editMsg && <div className={`px-4 py-3 rounded-xl text-[12px] ${editMsg.includes("失敗") ? "bg-[#c49885]/10 text-[#c49885]" : "bg-[#7ab88f]/10 text-[#5a9e6f]"}`}>{editMsg}</div>}
              <div className="flex gap-3 pt-2">
                <button onClick={updateReservation} disabled={editSaving} className="px-6 py-3 bg-gradient-to-r from-[#c3a782] to-[#b09672] text-white text-[12px] rounded-xl hover:shadow-[0_4px_16px_rgba(195,167,130,0.25)] transition-all cursor-pointer disabled:opacity-60">{editSaving ? "更新中..." : "更新する"}</button>
                <button onClick={() => deleteReservation(editRes.id)} className="px-6 py-3 bg-[#c45555] text-white text-[12px] rounded-xl hover:bg-[#b04444] transition-colors cursor-pointer">削除</button>
                <button onClick={() => setEditRes(null)} className="px-6 py-3 border border-[#f0ece4] text-[#888780] text-[12px] rounded-xl hover:bg-[#f8f6f3] transition-all cursor-pointer">閉じる</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New Therapist Modal */}
      {showNewTherapist && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowNewTherapist(false)}>
          <div className="bg-white rounded-2xl border border-[#f0ece4] p-8 w-full max-w-sm animate-[fadeIn_0.25s_ease-out]" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-[16px] font-medium text-[#2c2c2a] mb-1">セラピスト追加</h2>
            <p className="text-[11px] text-[#d3d1c7] mb-6">新しいセラピストを登録します</p>
            <div className="space-y-4">
              <div>
                <label className="block text-[11px] text-[#888780] mb-1.5">名前 <span className="text-[#c49885]">*</span></label>
                <input type="text" value={tName} onChange={(e) => setTName(e.target.value)} placeholder="セラピスト名"
                  className="w-full px-4 py-3 bg-[#f8f6f3] border border-transparent rounded-xl text-[13px] outline-none focus:border-[#c3a782]/30 focus:bg-white transition-all placeholder-[#d3d1c7]" />
              </div>
              <div>
                <label className="block text-[11px] text-[#888780] mb-1.5">電話番号</label>
                <input type="tel" value={tPhone} onChange={(e) => setTPhone(e.target.value)} placeholder="090-xxxx-xxxx"
                  className="w-full px-4 py-3 bg-[#f8f6f3] border border-transparent rounded-xl text-[13px] outline-none focus:border-[#c3a782]/30 focus:bg-white transition-all placeholder-[#d3d1c7]" />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={addTherapist} className="px-7 py-3 bg-gradient-to-r from-[#c3a782] to-[#b09672] text-white text-[12px] rounded-xl hover:shadow-[0_4px_16px_rgba(195,167,130,0.25)] transition-all cursor-pointer">登録する</button>
                <button onClick={() => setShowNewTherapist(false)} className="px-7 py-3 border border-[#f0ece4] text-[#888780] text-[12px] rounded-xl hover:bg-[#f8f6f3] transition-all cursor-pointer">キャンセル</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
