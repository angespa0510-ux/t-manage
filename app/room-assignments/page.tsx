"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";
import { useTheme } from "../../lib/theme";

type Store = { id: number; name: string };
type Building = { id: number; store_id: number; name: string };
type Room = { id: number; store_id: number; building_id: number; name: string };
type Therapist = { id: number; name: string };
type Shift = { id: number; therapist_id: number; store_id: number; date: string; start_time: string; end_time: string; status: string };
type RoomAssignment = { id: number; date: string; room_id: number; slot: string; therapist_id: number; start_time: string; end_time: string; attendance: string; cleaning: string; memo: string };
type ParkingSpot = { id: number; store_id: number; building_id: number; number: string; type: string };
type ParkingUsage = { id: number; date: string; parking_spot_id: number; user_type: string; therapist_id: number | null; customer_name: string | null; notes: string | null };
type RoomDailySetting = { id: number; date: string; room_id: number; send_off: boolean; memo: string };
type AbsentRecord = { id: number; date: string; therapist_id: number; room_id: number; slot: string; original_start: string; original_end: string; created_at: string };

const CLEAN_OPTS: { value: string; label: string; color: string }[] = [
  { value: "", label: "—", color: "#b4b2a9" },
  { value: "early_clean", label: "早番清掃", color: "#4ade80" },
  { value: "clean", label: "清掃済", color: "#22c55e" },
  { value: "order1", label: "順番①", color: "#3b82f6" },
  { value: "order2", label: "順番②", color: "#3b82f6" },
  { value: "order3", label: "順番③", color: "#3b82f6" },
  { value: "order4", label: "順番④", color: "#3b82f6" },
  { value: "order5", label: "順番⑤", color: "#3b82f6" },
  { value: "order6", label: "順番⑥", color: "#3b82f6" },
  { value: "order7", label: "順番⑦", color: "#3b82f6" },
  { value: "staying", label: "泊り", color: "#a78bfa" },
  { value: "next_morning", label: "翌朝退室", color: "#f59e0b" },
  { value: "late_clean", label: "遅清掃", color: "#ec4899" },
];

const BIZ_START = 1200; const BIZ_END = 2700; const MIN_GAP = 4; const INTERVAL_V = 100;

function isWeekend(d: string) { const dt = new Date(d + "T00:00:00"); const w = dt.getDay(); return w === 0 || w === 5 || w === 6; }
function getWeekMonday(d: string) { const dt = new Date(d + "T00:00:00"); const w = dt.getDay(); dt.setDate(dt.getDate() - (w === 0 ? 6 : w - 1)); return dt.toISOString().split("T")[0]; }
function getPrevDate(d: string) { const dt = new Date(d + "T00:00:00"); dt.setDate(dt.getDate() - 1); return dt.toISOString().split("T")[0]; }
function timeToRaw(t: string) { const [h, m] = t.split(":").map(Number); return (h < 9 ? h + 24 : h) * 100 + m; }
function rawToDisplay(r: number) { const h = Math.floor(r / 100); const m = r % 100; return `${h >= 24 ? h - 24 : h}:${String(m).padStart(2, "0")}`; }
function formatDateShort(d: string) { const dt = new Date(d + "T00:00:00"); const days = ["日", "月", "火", "水", "木", "金", "土"]; return `${dt.getMonth() + 1}/${dt.getDate()}(${days[dt.getDay()]})`; }

export default function RoomAssignments() {
  const router = useRouter();
  const { dark, toggle, T } = useTheme();
  const [stores, setStores] = useState<Store[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [allShifts, setAllShifts] = useState<Shift[]>([]);
  const [allAssignments, setAllAssignments] = useState<RoomAssignment[]>([]);
  const [parkingSpots, setParkingSpots] = useState<ParkingSpot[]>([]);
  const [allParkingUsage, setAllParkingUsage] = useState<ParkingUsage[]>([]);
  const [dailySettings, setDailySettings] = useState<RoomDailySetting[]>([]);
  const [absentRecords, setAbsentRecords] = useState<AbsentRecord[]>([]);
  const [prevMonthAssignments, setPrevMonthAssignments] = useState<RoomAssignment[]>([]);
  const [pointAssignments, setPointAssignments] = useState<RoomAssignment[]>([]);
  const [pointAbsents, setPointAbsents] = useState<AbsentRecord[]>([]);

  const [currentMonth, setCurrentMonth] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; });
  const [expandedDay, setExpandedDay] = useState<string>(new Date().toISOString().split("T")[0]);
  const [showPoints, setShowPoints] = useState(false);
  const [showVacancy, setShowVacancy] = useState(false);
  const [vacancyText, setVacancyText] = useState("");
  const [copiedVacancy, setCopiedVacancy] = useState(false);
  const dayRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  const [year, month] = currentMonth.split("-").map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const allDates = Array.from({ length: daysInMonth }, (_, i) => `${year}-${String(month).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`);
  const todayStr = new Date().toISOString().split("T")[0];

  const jumpToToday = () => {
    const tm = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
    if (currentMonth !== tm) setCurrentMonth(tm);
    setExpandedDay(todayStr);
    setTimeout(() => { dayRefs.current[todayStr]?.scrollIntoView({ behavior: "smooth", block: "start" }); }, 100);
  };

  const fetchData = useCallback(async () => {
    const { data: st } = await supabase.from("stores").select("*").order("id"); if (st) setStores(st);
    const { data: b } = await supabase.from("buildings").select("*").order("id"); if (b) setBuildings(b);
    const { data: r } = await supabase.from("rooms").select("*").order("id"); if (r) setRooms(r);
    const { data: t } = await supabase.from("therapists").select("*").order("id"); if (t) setTherapists(t);
    const { data: ps } = await supabase.from("parking_spots").select("*").order("id"); if (ps) setParkingSpots(ps);
    const startDate = `${currentMonth}-01`; const endDate = `${currentMonth}-${String(daysInMonth).padStart(2, "0")}`;
    const { data: sh } = await supabase.from("shifts").select("*").gte("date", startDate).lte("date", endDate).eq("status", "confirmed").order("start_time"); if (sh) setAllShifts(sh);
    const { data: a } = await supabase.from("room_assignments").select("*").gte("date", startDate).lte("date", endDate).order("room_id"); if (a) setAllAssignments(a);
    const { data: pu } = await supabase.from("parking_usage").select("*").gte("date", startDate).lte("date", endDate).order("parking_spot_id"); if (pu) setAllParkingUsage(pu);
    const { data: ds } = await supabase.from("room_daily_settings").select("*").gte("date", startDate).lte("date", endDate); if (ds) setDailySettings(ds);
    const { data: ab } = await supabase.from("absent_records").select("*").gte("date", startDate).lte("date", endDate).order("created_at"); if (ab) setAbsentRecords(ab);
    const prevLastDay = getPrevDate(startDate);
    const { data: prevA } = await supabase.from("room_assignments").select("*").eq("date", prevLastDay).eq("slot", "late"); if (prevA) setPrevMonthAssignments(prevA);
    const tma = new Date(year, month - 4, 1); const pointStart = `${tma.getFullYear()}-${String(tma.getMonth() + 1).padStart(2, "0")}-01`;
    const { data: pa } = await supabase.from("room_assignments").select("*").gte("date", pointStart).lte("date", endDate); if (pa) setPointAssignments(pa);
    const { data: pab } = await supabase.from("absent_records").select("*").gte("date", pointStart).lte("date", endDate); if (pab) setPointAbsents(pab);
  }, [currentMonth, daysInMonth, year, month]);

  useEffect(() => { const check = async () => { const { data: { user } } = await supabase.auth.getUser(); if (!user) router.push("/"); }; check(); fetchData(); }, [router, fetchData]);
  useEffect(() => { setTimeout(() => { dayRefs.current[todayStr]?.scrollIntoView({ behavior: "smooth", block: "start" }); }, 300); }, []);

  const calcPoints = useCallback((tid: number) => {
    let absent = 0, absentWE = 0, late = 0, lateWE = 0, el = 0, elWE = 0;
    const wp = new Map<string, boolean>();
    for (const a of pointAssignments) { if (a.therapist_id !== tid || !a.attendance) continue; const atts = a.attendance.split(",").filter(Boolean); const we = isWeekend(a.date); const wk = getWeekMonday(a.date); if (atts.includes("late")) { we ? lateWE++ : late++; wp.set(wk, true); } if (atts.includes("early_leave")) { we ? elWE++ : el++; wp.set(wk, true); } }
    for (const ab of pointAbsents) { if (ab.therapist_id !== tid) continue; const we = isWeekend(ab.date); const wk = getWeekMonday(ab.date); we ? absentWE++ : absent++; wp.set(wk, true); }
    const ww = new Set<string>(); for (const a of pointAssignments) { if (a.therapist_id === tid) ww.add(getWeekMonday(a.date)); }
    let fw = 0; ww.forEach((wk) => { if (!wp.has(wk)) fw++; });
    const points = fw + late * -1 + lateWE * -2 + absent * -2 + absentWE * -3 + el * -1 + elWE * -2;
    return { points, details: { absent, absentWE, late, lateWE, earlyLeave: el, earlyLeaveWE: elWE, fullWeeks: fw } };
  }, [pointAssignments, pointAbsents]);

  const allPoints = useMemo(() => therapists.map((t) => ({ ...t, ...calcPoints(t.id) })).sort((a, b) => a.points - b.points), [therapists, calcPoints]);

  const getTherapistName = (id: number) => therapists.find((t) => t.id === id)?.name || "";
  const getShiftsForDate = (date: string) => allShifts.filter((s) => s.date === date);
  const getAssignmentsForDate = (date: string) => allAssignments.filter((a) => a.date === date);
  const getAssignment = (date: string, roomId: number, slot: string) => allAssignments.find((a) => a.date === date && a.room_id === roomId && a.slot === slot);
  const getParkingUsageForDate = (date: string) => allParkingUsage.filter((pu) => pu.date === date);
  const getTherapistParking = (date: string, tid: number) => allParkingUsage.find((pu) => pu.date === date && pu.therapist_id === tid);
  const isSpotUsedOnDate = (date: string, sid: number, ex?: number) => allParkingUsage.some((pu) => pu.date === date && pu.parking_spot_id === sid && pu.therapist_id !== ex);
  const getDailySetting = (date: string, roomId: number) => dailySettings.find((ds) => ds.date === date && ds.room_id === roomId);
  const getAbsentsForDate = (date: string) => absentRecords.filter((ab) => ab.date === date);
  const isTherapistAssigned = (date: string, tid: number) => allAssignments.some((a) => a.date === date && a.therapist_id === tid);
  const getPrevLateCleaning = (date: string, roomId: number): string => { const p = getPrevDate(date); const pl = allAssignments.find((a) => a.date === p && a.room_id === roomId && a.slot === "late"); if (pl) return pl.cleaning || ""; const pml = prevMonthAssignments.find((a) => a.room_id === roomId); return pml?.cleaning || ""; };

  const assignTherapist = async (date: string, roomId: number, slot: string, tid: number) => {
    const ex = getAssignment(date, roomId, slot);
    if (tid === 0) { if (ex) { const op = getTherapistParking(date, ex.therapist_id); if (op) await supabase.from("parking_usage").delete().eq("id", op.id); await supabase.from("room_assignments").delete().eq("id", ex.id); } }
    else {
      if (isTherapistAssigned(date, tid)) { const cs = allAssignments.find((a) => a.date === date && a.therapist_id === tid); if (cs && !(cs.room_id === roomId && cs.slot === slot)) { alert(`${getTherapistName(tid)} は既にこの日の別の枠に割り当てられています。`); return; } }
      const { points } = calcPoints(tid); if (points <= -5) { if (!confirm(`${getTherapistName(tid)} は現在 ${points}pt です。割り当てますか？`)) return; }
      const sh = allShifts.find((s) => s.therapist_id === tid && s.date === date);
      const st = sh?.start_time || (slot === "early" ? "12:00" : "18:00"); const et = sh?.end_time || (slot === "early" ? "18:00" : "03:00");
      if (ex) { await supabase.from("room_assignments").update({ therapist_id: tid, start_time: st, end_time: et }).eq("id", ex.id); }
      else { await supabase.from("room_assignments").insert({ date, room_id: roomId, slot, therapist_id: tid, start_time: st, end_time: et, attendance: "", cleaning: "", memo: "" }); }
    } fetchData();
  };
  const updateTime = async (id: number, f: "start_time" | "end_time", v: string) => { await supabase.from("room_assignments").update({ [f]: v }).eq("id", id); fetchData(); };
  const assignParking = async (date: string, tid: number, sid: number) => { const ex = getTherapistParking(date, tid); if (ex) await supabase.from("parking_usage").delete().eq("id", ex.id); if (sid === 0) { fetchData(); return; } await supabase.from("parking_usage").insert({ date, parking_spot_id: sid, user_type: "therapist", therapist_id: tid, customer_name: null, notes: null }); fetchData(); };
  const toggleAttendance = async (id: number, cur: string, val: "late" | "early_leave") => { const a = cur.split(",").filter(Boolean); const n = a.includes(val) ? a.filter((x) => x !== val) : [...a, val]; await supabase.from("room_assignments").update({ attendance: n.join(",") }).eq("id", id); fetchData(); };
  const markAbsent = async (date: string, a: RoomAssignment) => { if (!confirm(`${getTherapistName(a.therapist_id)} を当欠にしますか？\n枠が空きます。`)) return; await supabase.from("absent_records").insert({ date, therapist_id: a.therapist_id, room_id: a.room_id, slot: a.slot, original_start: a.start_time, original_end: a.end_time }); const p = getTherapistParking(date, a.therapist_id); if (p) await supabase.from("parking_usage").delete().eq("id", p.id); await supabase.from("room_assignments").delete().eq("id", a.id); fetchData(); };
  const cancelAbsent = async (id: number) => { await supabase.from("absent_records").delete().eq("id", id); fetchData(); };
  const updateCleaning = async (id: number, v: string) => { await supabase.from("room_assignments").update({ cleaning: v }).eq("id", id); fetchData(); };
  const updateSlotMemo = async (id: number, v: string) => { await supabase.from("room_assignments").update({ memo: v }).eq("id", id); fetchData(); };
  const updateDailySetting = async (date: string, roomId: number, updates: Partial<{ send_off: boolean }>) => {
    const ex = getDailySetting(date, roomId);
    if (ex) { await supabase.from("room_daily_settings").update(updates).eq("id", ex.id); }
    else { await supabase.from("room_daily_settings").insert({ date, room_id: roomId, send_off: updates.send_off ?? false, memo: "" }); }
    fetchData();
  };
  const autoAssign = async (date: string) => {
    if (!confirm(`${date} のシフトから自動割当しますか？`)) return;
    const da = getAssignmentsForDate(date); if (da.length > 0) await supabase.from("room_assignments").delete().in("id", da.map((a) => a.id));
    const ds = getShiftsForDate(date); const eS = ds.filter((s) => parseInt(s.start_time.split(":")[0]) < 18); const lS = ds.filter((s) => parseInt(s.start_time.split(":")[0]) >= 18);
    const uE = new Set<number>(); const uL = new Set<number>();
    for (const room of rooms) {
      const e = eS.find((s) => !uE.has(s.therapist_id) && buildings.find((b) => b.id === room.building_id)?.store_id === s.store_id);
      if (e) { uE.add(e.therapist_id); await supabase.from("room_assignments").insert({ date, room_id: room.id, slot: "early", therapist_id: e.therapist_id, start_time: e.start_time, end_time: e.end_time, attendance: "", cleaning: "", memo: "" }); }
      const l = lS.find((s) => !uL.has(s.therapist_id) && buildings.find((b) => b.id === room.building_id)?.store_id === s.store_id);
      if (l) { uL.add(l.therapist_id); await supabase.from("room_assignments").insert({ date, room_id: room.id, slot: "late", therapist_id: l.therapist_id, start_time: l.start_time, end_time: l.end_time, attendance: "", cleaning: "", memo: "" }); }
    } fetchData();
  };

  const extractVacancy = () => {
    const today = new Date(); const dow = today.getDay(); const addDays = dow === 0 ? 7 : (7 - dow) + 7;
    const targetDates: string[] = [];
    for (let i = 0; i <= addDays; i++) { const d = new Date(today); d.setDate(d.getDate() + i); const ds = d.toISOString().split("T")[0]; if (allDates.includes(ds)) targetDates.push(ds); }
    type GI = { start: number; end: number; hours: number }; const storeGaps: { [sid: number]: { [d: string]: { gap: GI; count: number }[] } } = {};
    for (const s of stores) storeGaps[s.id] = {};
    for (const date of targetDates) { const da = getAssignmentsForDate(date);
      for (const room of rooms) { const bld = buildings.find((b) => b.id === room.building_id); if (!bld) continue; const sid = bld.store_id;
        const eA = da.find((a) => a.room_id === room.id && a.slot === "early"); const lA = da.find((a) => a.room_id === room.id && a.slot === "late");
        const occ: { s: number; e: number }[] = []; if (eA) occ.push({ s: timeToRaw(eA.start_time), e: timeToRaw(eA.end_time) }); if (lA) occ.push({ s: timeToRaw(lA.start_time), e: timeToRaw(lA.end_time) }); occ.sort((a, b) => a.s - b.s);
        const gaps: GI[] = []; let cursor = BIZ_START;
        for (const o of occ) { if (o.s > cursor) { const h = (o.s - cursor) / 100; if (h >= MIN_GAP) gaps.push({ start: cursor, end: o.s, hours: h }); } cursor = Math.max(cursor, o.e + INTERVAL_V); }
        if (occ.length === 0) cursor = BIZ_START; if (BIZ_END > cursor) { const h = (BIZ_END - cursor) / 100; if (h >= MIN_GAP) gaps.push({ start: cursor, end: BIZ_END, hours: h }); }
        if (!storeGaps[sid][date]) storeGaps[sid][date] = [];
        for (const g of gaps) { const k = `${g.start}-${g.end}`; const ex = storeGaps[sid][date].find((m) => `${m.gap.start}-${m.gap.end}` === k); if (ex) ex.count++; else storeGaps[sid][date].push({ gap: g, count: 1 }); }
    } }
    let text = "【一斉送信】返信不要です！\n\nお疲れ様です🙇‍♀️✨\n\nお部屋にまだ空きがありますので出勤できる方ぜひ出勤して頂ければと思います🙏💕\n先着順でお取りしますので、出勤可能な方はLINEにてご連絡ください📱💬\n\n※出勤無理な方はこちらお返事要りませんのでスルーして頂いて大丈夫です🙆‍♀️\n\n";
    for (const store of stores) { const emoji = store.name.includes("豊橋") ? "🏡" : "🏠"; const hasAny = targetDates.some((d) => (storeGaps[store.id][d] || []).length > 0); if (!hasAny) continue;
      text += `━━━━━━━━━━━━━━\n${emoji} ${store.name}　空き情報\n━━━━━━━━━━━━━━\n\n`;
      for (const date of targetDates) { const merged = storeGaps[store.id][date] || []; if (merged.length === 0) continue; merged.sort((a, b) => a.gap.hours - b.gap.hours); text += `📅 ${formatDateShort(date)}\n`;
        for (const m of merged) text += `  ▶ ${rawToDisplay(m.gap.start)}〜${rawToDisplay(m.gap.end)}（${m.gap.hours}h）${m.count}部屋空き🔑\n`; text += "\n"; }
    }
    text += "━━━━━━━━━━━━━━\nよろしくお願いします🌸"; setVacancyText(text); setShowVacancy(true);
  };

  const prevMonth2 = () => { const d = new Date(year, month - 2, 1); setCurrentMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`); };
  const nextMonth2 = () => { const d = new Date(year, month, 1); setCurrentMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`); };
  const formatDay = (date: string) => { const d = new Date(date + "T00:00:00"); const days = ["日", "月", "火", "水", "木", "金", "土"]; return { day: d.getDate(), dow: days[d.getDay()], isSun: d.getDay() === 0, isSat: d.getDay() === 6, isToday: date === todayStr }; };
  const storeColors = ["#c3a782", "#7ab88f", "#85a8c4", "#c49885", "#a885c4"];
  const TIMES = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00", "21:00", "22:00", "23:00", "00:00", "01:00", "02:00", "03:00"];
  const getParkingSummary = (date: string, spots: ParkingSpot[]) => { const du = getParkingUsageForDate(date); const u = spots.filter((s) => du.some((pu) => pu.parking_spot_id === s.id)).length; return { total: spots.length, available: spots.length - u }; };

  const CleanSel = ({ value, onChange, ph }: { value: string; onChange: (v: string) => void; ph: string }) => {
    const o = CLEAN_OPTS.find((x) => x.value === value) || CLEAN_OPTS[0];
    return (<select value={value} onChange={(e) => onChange(e.target.value)} className="px-1.5 py-0.5 rounded text-[9px] outline-none cursor-pointer border"
      style={{ borderColor: value ? o.color + "66" : T.border, backgroundColor: value ? o.color + "12" : dark ? T.cardAlt : "white", color: value ? o.color : T.textMuted, fontWeight: value ? 600 : 400 }}>
      {CLEAN_OPTS.map((x) => (<option key={x.value} value={x.value}>{x.value === "" ? ph : x.label}</option>))}
    </select>);
  };
  const AttBtn = ({ label, color, active, onClick }: { label: string; color: string; active: boolean; onClick: () => void }) => (
    <button onClick={onClick} className="text-[9px] px-1.5 py-0.5 rounded cursor-pointer border transition-all"
      style={{ borderColor: active ? color : T.border, backgroundColor: active ? color + "18" : "transparent", color: active ? color : T.textMuted, fontWeight: active ? 700 : 400 }}>{label}</button>
  );

  return (
    <div className="h-screen flex flex-col" style={{ backgroundColor: T.bg, color: T.text }}>
      {/* Header */}
      <div className="h-[56px] flex items-center justify-between px-4 flex-shrink-0 border-b" style={{ backgroundColor: T.card, borderColor: T.border }}>
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/dashboard")} className="p-2 rounded-lg cursor-pointer" style={{ color: T.textSub }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="15 18 9 12 15 6"/></svg></button>
          <h1 className="text-[14px] font-medium">部屋割り管理</h1>
          <button onClick={jumpToToday} className="px-2.5 py-1 text-[10px] rounded-lg cursor-pointer font-medium" style={{ backgroundColor: T.accent, color: "white" }}>今日</button>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={toggle} className="px-2.5 py-1.5 text-[10px] rounded-lg cursor-pointer border" style={{ borderColor: T.border, color: T.textSub }}>{dark ? "☀️ ライト" : "🌙 ダーク"}</button>
          <button onClick={extractVacancy} className="px-2.5 py-1.5 text-[10px] rounded-lg cursor-pointer text-white" style={{ backgroundColor: "#3b82f6" }}>🔍 空き状況</button>
          <button onClick={() => setShowPoints(!showPoints)} className="px-2.5 py-1.5 text-[10px] rounded-lg cursor-pointer border" style={{ borderColor: T.border, color: T.textSub }}>📊 ポイント</button>
          <button onClick={() => router.push("/rooms")} className="px-2.5 py-1.5 text-[10px] rounded-lg cursor-pointer border" style={{ borderColor: T.border, color: T.textSub }}>利用場所</button>
          <button onClick={() => router.push("/shifts")} className="px-2.5 py-1.5 text-[10px] rounded-lg cursor-pointer border" style={{ borderColor: T.border, color: T.textSub }}>シフト</button>
        </div>
      </div>

      {/* Points */}
      {showPoints && (
        <div className="border-b px-6 py-4 animate-[fadeIn_0.2s]" style={{ backgroundColor: T.card, borderColor: T.border }}>
          <div className="max-w-[1100px] mx-auto">
            <div className="flex items-center justify-between mb-3"><h2 className="text-[13px] font-medium">📊 出勤ポイント一覧（過去3ヶ月）</h2><button onClick={() => setShowPoints(false)} className="text-[11px] cursor-pointer" style={{ color: T.textSub }}>✕ 閉じる</button></div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
              {allPoints.map((t) => (
                <div key={t.id} className="p-2.5 rounded-lg border" style={{ borderColor: t.points <= -5 ? "#c4555566" : T.border, backgroundColor: t.points <= -5 ? "#c4555512" : T.cardAlt }}>
                  <div className="flex items-center justify-between mb-1"><span className="text-[11px] font-medium">{t.name}</span><span className="text-[13px] font-bold" style={{ color: t.points <= -5 ? "#c45555" : t.points < 0 ? "#f59e0b" : "#22c55e" }}>{t.points > 0 ? "+" : ""}{t.points}pt</span></div>
                  <div className="text-[9px] space-y-0.5" style={{ color: T.textSub }}>
                    {t.details.fullWeeks > 0 && <div style={{ color: "#22c55e" }}>無欠勤 +{t.details.fullWeeks}週</div>}
                    {(t.details.absent + t.details.absentWE) > 0 && <div>当欠 {t.details.absent + t.details.absentWE}回</div>}
                    {(t.details.late + t.details.lateWE) > 0 && <div>遅刻 {t.details.late + t.details.lateWE}回</div>}
                    {(t.details.earlyLeave + t.details.earlyLeaveWE) > 0 && <div>早退 {t.details.earlyLeave + t.details.earlyLeaveWE}回</div>}
                    {t.points === 0 && t.details.fullWeeks === 0 && <div>記録なし</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Vacancy modal */}
      {showVacancy && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowVacancy(false)}>
          <div className="rounded-2xl w-full max-w-[600px] max-h-[80vh] flex flex-col" style={{ backgroundColor: T.card }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: T.border }}>
              <h2 className="text-[14px] font-medium">🔍 空き状況抽出</h2>
              <div className="flex items-center gap-2">
                <button onClick={() => { navigator.clipboard.writeText(vacancyText); setCopiedVacancy(true); setTimeout(() => setCopiedVacancy(false), 2000); }} className="px-3 py-1.5 text-white text-[11px] rounded-lg cursor-pointer" style={{ backgroundColor: "#22c55e" }}>{copiedVacancy ? "✅ コピー済" : "📋 コピー"}</button>
                <button onClick={() => setShowVacancy(false)} className="text-[14px] cursor-pointer p-1" style={{ color: T.textSub }}>✕</button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4"><textarea value={vacancyText} onChange={(e) => setVacancyText(e.target.value)} className="w-full h-full min-h-[400px] p-3 rounded-xl border text-[12px] outline-none resize-none leading-relaxed" style={{ backgroundColor: T.cardAlt, borderColor: T.border, color: T.text }} /></div>
          </div>
        </div>
      )}

      {/* Month Nav */}
      <div className="h-[48px] flex items-center justify-center gap-4 flex-shrink-0 border-b" style={{ backgroundColor: T.card, borderColor: T.border }}>
        <button onClick={prevMonth2} className="p-1.5 rounded-lg cursor-pointer" style={{ color: T.textSub }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="15 18 9 12 15 6"/></svg></button>
        <button onClick={jumpToToday} className="px-3 py-1 text-[11px] border rounded-lg cursor-pointer" style={{ borderColor: T.border, color: T.textSub }}>今月</button>
        <span className="text-[16px] font-medium min-w-[140px] text-center">{year}年{month}月</span>
        <button onClick={nextMonth2} className="p-1.5 rounded-lg cursor-pointer" style={{ color: T.textSub }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="9 18 15 12 9 6"/></svg></button>
      </div>

      {/* Calendar */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[1100px] mx-auto py-4 px-4">
          {allDates.map((date) => {
            const f = formatDay(date); const dayShifts = getShiftsForDate(date); const dayA = getAssignmentsForDate(date); const dayPU = getParkingUsageForDate(date); const dayAb = getAbsentsForDate(date); const isExp = expandedDay === date;
            return (
              <div key={date} ref={(el) => { dayRefs.current[date] = el; }} className="mb-1 rounded-xl overflow-hidden border transition-all" style={{ borderColor: isExp ? T.accent + "44" : "transparent", boxShadow: isExp ? "0 4px 20px rgba(0,0,0,0.06)" : "none" }}>
                <button onClick={() => setExpandedDay(isExp ? "" : date)} className="w-full flex items-center justify-between px-5 py-3 cursor-pointer" style={{ backgroundColor: isExp ? T.card : f.isToday ? T.accentBg : "transparent" }}>
                  <div className="flex items-center gap-3">
                    <span className="text-[15px] font-medium w-[28px]" style={{ color: f.isToday ? T.accent : f.isSun ? "#c45555" : f.isSat ? "#3d6b9f" : T.text }}>{f.day}</span>
                    <span className="text-[12px]" style={{ color: f.isSun ? "#c45555" : f.isSat ? "#3d6b9f" : T.textMuted }}>({f.dow})</span>
                    {f.isToday && <span className="px-2 py-0.5 text-white text-[9px] rounded-full" style={{ backgroundColor: T.accent }}>今日</span>}
                    <span className="text-[11px] ml-2" style={{ color: T.textMuted }}>出勤:{dayShifts.length}名</span>
                    {dayA.length > 0 && <span className="text-[11px] ml-1" style={{ color: "#7ab88f" }}>割当:{dayA.length}</span>}
                    {dayAb.length > 0 && <span className="text-[11px] ml-1" style={{ color: "#c45555" }}>当欠:{dayAb.length}</span>}
                    {dayPU.length > 0 && <span className="text-[11px] ml-1" style={{ color: "#85a8c4" }}>🅿{dayPU.length}</span>}
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.textFaint} strokeWidth="2" style={{ transform: isExp ? "rotate(180deg)" : "", transition: "transform 0.2s" }}><polyline points="6 9 12 15 18 9"/></svg>
                </button>

                {isExp && (
                  <div className="px-5 pb-5 animate-[fadeIn_0.3s]" style={{ backgroundColor: T.card }}>
                    

                    <div className="mb-4 p-3 rounded-xl" style={{ backgroundColor: T.cardAlt }}>
                      <p className="text-[10px] mb-2" style={{ color: T.textMuted }}>出勤セラピスト</p>
                      {dayShifts.length === 0 ? <p className="text-[11px]" style={{ color: T.textFaint }}>シフトが登録されていません</p> : (
                        <div className="flex flex-wrap gap-1.5">
                          {dayShifts.map((s) => { const asgn = dayA.some((a) => a.therapist_id === s.therapist_id); const tp = getTherapistParking(date, s.therapist_id); const sn = tp ? parkingSpots.find((ps) => ps.id === tp.parking_spot_id)?.number : null; const { points } = calcPoints(s.therapist_id); const isW = points <= -5;
                            return (<span key={s.id} className="px-2 py-1 rounded-md text-[10px] font-medium" style={{ backgroundColor: isW ? "#c4555518" : asgn ? "#7ab88f18" : "#f59e0b18", color: isW ? "#c45555" : asgn ? "#4a7c59" : "#854f0b", border: isW ? "1px solid #c4555544" : "none" }}>
                              {getTherapistName(s.therapist_id)} {s.start_time}〜{s.end_time}{isW && <span className="ml-1">⚠{points}pt</span>}{sn && <span className="ml-1" style={{ color: "#3d6b9f" }}>🅿{sn}</span>}
                            </span>); })}
                        </div>
                      )}
                      {dayAb.length > 0 && (<div className="mt-2 flex flex-wrap gap-1.5">{dayAb.map((ab) => (<span key={ab.id} className="px-2 py-1 rounded-md text-[10px] font-medium" style={{ backgroundColor: "#c4555512", color: "#c45555", border: "1px solid #c4555530" }}>❌ {getTherapistName(ab.therapist_id)} 当欠<button onClick={() => cancelAbsent(ab.id)} className="ml-1.5 px-1 py-0.5 rounded text-[8px] cursor-pointer" style={{ backgroundColor: T.card, border: "1px solid #c4555530", color: "#c45555" }}>取消</button></span>))}</div>)}
                    </div>

                    {stores.map((store, si) => {
                      const sB = buildings.filter((b) => b.store_id === store.id); if (!sB.some((b) => rooms.some((r) => r.building_id === b.id))) return null;
                      return (<div key={store.id} className="mb-4">{sB.map((bld) => {
                        const bR = rooms.filter((r) => r.building_id === bld.id); if (bR.length === 0) return null;
                        const bTS = parkingSpots.filter((ps) => ps.building_id === bld.id && ps.type === "therapist"); const bCS = parkingSpots.filter((ps) => ps.building_id === bld.id && ps.type === "customer");
                        const tS = getParkingSummary(date, bTS); const cS = getParkingSummary(date, bCS); const sc = storeColors[si % storeColors.length];
                        return (<div key={bld.id} className="mb-3">
                          <div className="flex items-start gap-2 mb-2"><div className="w-1 h-4 rounded-full mt-0.5" style={{ backgroundColor: sc }} />
                            <div className="flex-1"><div className="flex items-center gap-2 flex-wrap"><span className="text-[12px] font-medium">{store.name}</span><span className="text-[12px]" style={{ color: T.textSub }}>{bld.name}</span></div>
                              {(bTS.length > 0 || bCS.length > 0) && (<div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
                                {bTS.length > 0 && (<div className="flex items-center gap-1.5"><span className="text-[9px] font-medium" style={{ color: "#3d6b9f" }}>🅿セラピスト</span><span className="text-[9px]" style={{ color: "#85a8c4" }}>({tS.available}/{tS.total}空)</span><div className="flex gap-1">{bTS.map((sp) => { const u = dayPU.some((pu) => pu.parking_spot_id === sp.id); return (<span key={sp.id} className="px-1.5 py-0.5 rounded text-[9px] font-medium border" style={{ backgroundColor: u ? "#3d6b9f18" : T.card, borderColor: u ? "#3d6b9f44" : T.border, color: u ? "#3d6b9f" : T.textMuted }}>{sp.number}</span>); })}</div></div>)}
                                {bCS.length > 0 && (<div className="flex items-center gap-1.5"><span className="text-[9px] font-medium" style={{ color: "#c49885" }}>🅿お客様</span><span className="text-[9px]" style={{ color: "#c4988588" }}>({cS.total}台)</span><div className="flex gap-1">{bCS.map((sp) => (<span key={sp.id} className="px-1.5 py-0.5 rounded text-[9px] font-medium border" style={{ backgroundColor: T.card, borderColor: T.border, color: "#c49885" }}>{sp.number}</span>))}</div></div>)}
                              </div>)}
                            </div></div>
                          <div className="space-y-1.5">{bR.map((room) => {
                            const eA = getAssignment(date, room.id, "early"); const lA = getAssignment(date, room.id, "late");
                            const eP = eA ? getTherapistParking(date, eA.therapist_id) : null; const lP = lA ? getTherapistParking(date, lA.therapist_id) : null;
                            const set = getDailySetting(date, room.id); const so = set?.send_off ?? false;
                            const eClean = eA?.cleaning || (eA ? getPrevLateCleaning(date, room.id) : "");
                            const hasE = !!eA; const hasL = !!lA; let eB = T.border, lB = T.border;
                            if (!hasE && !hasL) { eB = "#c45555"; lB = "#c45555"; }
                            else if (hasE && !hasL) { eB = "#7ab88f"; const g = BIZ_END - (timeToRaw(eA!.end_time) + INTERVAL_V); lB = g >= 500 ? "#c45555" : "#7ab88f"; }
                            else if (!hasE && hasL) { lB = "#c49885"; const g = timeToRaw(lA!.start_time) - BIZ_START; eB = g >= 500 ? "#c45555" : "#7ab88f"; }
                            else { eB = "#7ab88f"; lB = "#c49885"; }
                            const availE = dayShifts.filter((s) => !isTherapistAssigned(date, s.therapist_id) || (eA && eA.therapist_id === s.therapist_id));
                            const availL = dayShifts.filter((s) => !isTherapistAssigned(date, s.therapist_id) || (lA && lA.therapist_id === s.therapist_id));
                            return (<div key={room.id} className="rounded-xl p-2 space-y-1.5" style={{ backgroundColor: T.cardAlt }}>
                              <div className="flex items-stretch gap-2">
                                <div className="w-[50px] rounded-lg flex items-center justify-center flex-shrink-0 font-medium text-[14px]" style={{ backgroundColor: sc + "18", color: sc }}>{room.name}</div>
                                {/* Early */}
                                <div className="flex-1 rounded-lg p-2" style={{ border: `2px solid ${eB}30`, backgroundColor: eA ? eB + "08" : T.card }}>
                                  <div className="flex items-center gap-2"><span className="text-[8px] font-medium" style={{ color: "#7ab88f" }}>早番</span>
                                    <select value={eA?.therapist_id || 0} onChange={(e) => assignTherapist(date, room.id, "early", Number(e.target.value))} className="flex-1 px-2 py-1 bg-transparent border-none text-[11px] outline-none cursor-pointer" style={{ color: T.text }}><option value={0}>—</option>{availE.map((s) => (<option key={s.therapist_id} value={s.therapist_id}>{getTherapistName(s.therapist_id)}</option>))}</select></div>
                                  {eA && (<>
                                    <div className="flex items-center flex-wrap gap-x-2 gap-y-1 mt-1">
                                      <select value={eA.start_time} onChange={(e) => updateTime(eA.id, "start_time", e.target.value)} className="px-1 py-0.5 rounded text-[9px] outline-none cursor-pointer border" style={{ backgroundColor: T.card, borderColor: T.border, color: T.textSub }}>{TIMES.map((t) => (<option key={t} value={t}>{t}</option>))}</select><span className="text-[9px]" style={{ color: T.textFaint }}>〜</span><select value={eA.end_time} onChange={(e) => updateTime(eA.id, "end_time", e.target.value)} className="px-1 py-0.5 rounded text-[9px] outline-none cursor-pointer border" style={{ backgroundColor: T.card, borderColor: T.border, color: T.textSub }}>{TIMES.map((t) => (<option key={t} value={t}>{t}</option>))}</select>
                                      {bTS.length > 0 && (<><span className="text-[8px]" style={{ color: "#85a8c4" }}>🅿</span><select value={eP?.parking_spot_id || 0} onChange={(e) => assignParking(date, eA.therapist_id, Number(e.target.value))} className="px-1.5 py-0.5 rounded text-[9px] outline-none cursor-pointer border" style={{ borderColor: eP ? "#85a8c466" : T.border, backgroundColor: eP ? "#85a8c412" : T.card, color: eP ? "#3d6b9f" : T.textMuted, fontWeight: eP ? 600 : 400 }}><option value={0}>なし</option>{bTS.map((sp) => { const u = isSpotUsedOnDate(date, sp.id, eA.therapist_id); return (<option key={sp.id} value={sp.id} disabled={u}>{sp.number}{u ? "（使用中）" : ""}</option>); })}</select></>)}
                                      <CleanSel value={eClean} onChange={(v) => updateCleaning(eA.id, v)} ph="早番清掃" />
                                      <AttBtn label="当欠" color="#c45555" active={false} onClick={() => markAbsent(date, eA)} /><AttBtn label="遅刻" color="#f59e0b" active={eA.attendance?.includes("late") || false} onClick={() => toggleAttendance(eA.id, eA.attendance || "", "late")} /><AttBtn label="早退" color="#a78bfa" active={eA.attendance?.includes("early_leave") || false} onClick={() => toggleAttendance(eA.id, eA.attendance || "", "early_leave")} />
                                      <button onClick={() => updateDailySetting(date, room.id, { send_off: !so })} className="text-[8px] px-1.5 py-0.5 rounded cursor-pointer border font-medium" style={{ borderColor: so ? "#fbbf2466" : T.border, backgroundColor: so ? "#fbbf2418" : "transparent", color: so ? "#b45309" : T.textMuted }}>送{so ? "有" : "無"}</button>
                                    </div>
                                    <input type="text" placeholder="早番メモ" defaultValue={eA.memo || ""} onBlur={(e) => { if (e.target.value !== (eA.memo || "")) updateSlotMemo(eA.id, e.target.value); }} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} className="w-full mt-1 px-2 py-0.5 rounded text-[9px] outline-none border" style={{ backgroundColor: T.card, borderColor: T.border, color: T.text }} />
                                  </>)}
                                </div>
                                {/* Late */}
                                <div className="flex-1 rounded-lg p-2" style={{ border: `2px solid ${lB}30`, backgroundColor: lA ? lB + "08" : T.card }}>
                                  <div className="flex items-center gap-2"><span className="text-[8px] font-medium" style={{ color: "#c49885" }}>遅番</span>
                                    <select value={lA?.therapist_id || 0} onChange={(e) => assignTherapist(date, room.id, "late", Number(e.target.value))} className="flex-1 px-2 py-1 bg-transparent border-none text-[11px] outline-none cursor-pointer" style={{ color: T.text }}><option value={0}>—</option>{availL.map((s) => (<option key={s.therapist_id} value={s.therapist_id}>{getTherapistName(s.therapist_id)}</option>))}</select></div>
                                  {lA && (<>
                                    <div className="flex items-center flex-wrap gap-x-2 gap-y-1 mt-1">
                                      <select value={lA.start_time} onChange={(e) => updateTime(lA.id, "start_time", e.target.value)} className="px-1 py-0.5 rounded text-[9px] outline-none cursor-pointer border" style={{ backgroundColor: T.card, borderColor: T.border, color: T.textSub }}>{TIMES.map((t) => (<option key={t} value={t}>{t}</option>))}</select><span className="text-[9px]" style={{ color: T.textFaint }}>〜</span><select value={lA.end_time} onChange={(e) => updateTime(lA.id, "end_time", e.target.value)} className="px-1 py-0.5 rounded text-[9px] outline-none cursor-pointer border" style={{ backgroundColor: T.card, borderColor: T.border, color: T.textSub }}>{TIMES.map((t) => (<option key={t} value={t}>{t}</option>))}</select>
                                      {bTS.length > 0 && (<><span className="text-[8px]" style={{ color: "#85a8c4" }}>🅿</span><select value={lP?.parking_spot_id || 0} onChange={(e) => assignParking(date, lA.therapist_id, Number(e.target.value))} className="px-1.5 py-0.5 rounded text-[9px] outline-none cursor-pointer border" style={{ borderColor: lP ? "#85a8c466" : T.border, backgroundColor: lP ? "#85a8c412" : T.card, color: lP ? "#3d6b9f" : T.textMuted, fontWeight: lP ? 600 : 400 }}><option value={0}>なし</option>{bTS.map((sp) => { const u = isSpotUsedOnDate(date, sp.id, lA.therapist_id); return (<option key={sp.id} value={sp.id} disabled={u}>{sp.number}{u ? "（使用中）" : ""}</option>); })}</select></>)}
                                      <CleanSel value={lA.cleaning || ""} onChange={(v) => updateCleaning(lA.id, v)} ph="遅番清掃" />
                                      <AttBtn label="当欠" color="#c45555" active={false} onClick={() => markAbsent(date, lA)} /><AttBtn label="遅刻" color="#f59e0b" active={lA.attendance?.includes("late") || false} onClick={() => toggleAttendance(lA.id, lA.attendance || "", "late")} /><AttBtn label="早退" color="#a78bfa" active={lA.attendance?.includes("early_leave") || false} onClick={() => toggleAttendance(lA.id, lA.attendance || "", "early_leave")} />
                                      <button onClick={() => updateDailySetting(date, room.id, { send_off: !so })} className="text-[8px] px-1.5 py-0.5 rounded cursor-pointer border font-medium" style={{ borderColor: so ? "#fbbf2466" : T.border, backgroundColor: so ? "#fbbf2418" : "transparent", color: so ? "#b45309" : T.textMuted }}>送{so ? "有" : "無"}</button>
                                    </div>
                                    <input type="text" placeholder="遅番メモ" defaultValue={lA.memo || ""} onBlur={(e) => { if (e.target.value !== (lA.memo || "")) updateSlotMemo(lA.id, e.target.value); }} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} className="w-full mt-1 px-2 py-0.5 rounded text-[9px] outline-none border" style={{ backgroundColor: T.card, borderColor: T.border, color: T.text }} />
                                  </>)}
                                </div>
                              </div>
                            </div>);
                          })}</div>
                        </div>);
                      })}</div>);
                    })}

                    {(() => { const aIds = dayA.map((a) => a.therapist_id); const abIds = dayAb.map((ab) => ab.therapist_id); const un = dayShifts.filter((s) => !aIds.includes(s.therapist_id) && !abIds.includes(s.therapist_id));
                      if (un.length === 0) return null;
                      return (<div className="mt-3 p-3 rounded-xl" style={{ backgroundColor: "#f59e0b12", border: "1px solid #f59e0b30" }}><p className="text-[10px] mb-2 font-medium" style={{ color: "#854f0b" }}>未割当セラピスト</p><div className="flex flex-wrap gap-1.5">{un.map((s) => (<span key={s.id} className="px-2 py-1 rounded-md text-[10px]" style={{ backgroundColor: T.card, color: "#854f0b" }}>{getTherapistName(s.therapist_id)} {s.start_time}〜{s.end_time}</span>))}</div></div>);
                    })()}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <style jsx global>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  );
}
