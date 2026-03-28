"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";
import { useTheme } from "../../lib/theme"; import { NavMenu } from "../../lib/nav-menu";

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

  const [showCustSearch, setShowCustSearch] = useState(false);
  const [custSearchQ, setCustSearchQ] = useState("");
  const [custList, setCustList] = useState<{ id: number; name: string; phone: string; rank: string }[]>([]);
  const [showNewCust, setShowNewCust] = useState(false);
  const [ncName, setNcName] = useState(""); const [ncPhone, setNcPhone] = useState("");
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
  const [editNomination, setEditNomination] = useState("");
  const [editNomFee, setEditNomFee] = useState(0);
  const [editOptions, setEditOptions] = useState<{ name: string; price: number }[]>([]);
  const [editDiscount, setEditDiscount] = useState("");
  const [editDiscAmt, setEditDiscAmt] = useState(0);
  const [editExtension, setEditExtension] = useState("");
  const [editExtPrice, setEditExtPrice] = useState(0);
  const [editExtDur, setEditExtDur] = useState(0);
  const [editStatus, setEditStatus] = useState("unprocessed");
  const [editCardBase, setEditCardBase] = useState("");
  const [editPaypay, setEditPaypay] = useState("");
  const [editMsg, setEditMsg] = useState("");

  const [showNewTherapist, setShowNewTherapist] = useState(false);
  const [addShiftTherapistId, setAddShiftTherapistId] = useState(0);
  const [addShiftStart, setAddShiftStart] = useState("12:00");
  const [addShiftEnd, setAddShiftEnd] = useState("03:00");
  const [addShiftStore, setAddShiftStore] = useState(0);
  const [addShiftBuilding, setAddShiftBuilding] = useState(0);
  const [addShiftRoom, setAddShiftRoom] = useState(0);
  const [addShiftSearch, setAddShiftSearch] = useState("");
  const [editTherapist, setEditTherapist] = useState<Therapist | null>(null);
  const [etNotes, setEtNotes] = useState("");
  const [etSaving, setEtSaving] = useState(false);
  const [settleTh, setSettleTh] = useState<Therapist | null>(null);
  const [settleAdj, setSettleAdj] = useState("");
  const [settleAdjNote, setSettleAdjNote] = useState("");
  const [settleInvoice, setSettleInvoice] = useState(false);
  const [settleSaving, setSettleSaving] = useState(false);
  const [settleSettled, setSettleSettled] = useState(false);

  const [nominations, setNominations] = useState<{ id: number; name: string; price: number }[]>([]);
  const [options, setOptions] = useState<{ id: number; name: string; price: number }[]>([]);
  const [discounts, setDiscounts] = useState<{ id: number; name: string; amount: number; type: string }[]>([]);
  const [extensions, setExtensions] = useState<{ id: number; name: string; duration: number; price: number }[]>([]);
  const [stores, setStores] = useState<{ id: number; name: string }[]>([]);
  const [buildings, setBuildings] = useState<{ id: number; store_id: number; name: string }[]>([]);
  const [allRooms, setAllRooms] = useState<{ id: number; store_id: number; building_id: number; name: string }[]>([]);
  const [roomAssigns, setRoomAssigns] = useState<{ id: number; date: string; room_id: number; therapist_id: number; slot: string }[]>([]);
  const [editShiftTherapist, setEditShiftTherapist] = useState<number | null>(null);
  const [editShiftStart, setEditShiftStart] = useState("");
  const [editShiftEnd, setEditShiftEnd] = useState("");
  const [editShiftId, setEditShiftId] = useState<number | null>(null);
  const [editRoomTherapist, setEditRoomTherapist] = useState<number | null>(null);
  const [editRoomStore, setEditRoomStore] = useState(0);
  const [editRoomBuilding, setEditRoomBuilding] = useState(0);
  const [editRoomId, setEditRoomId] = useState(0);
  const [newNomination, setNewNomination] = useState("");
  const [newNomFee, setNewNomFee] = useState(0);
  const [newOptions, setNewOptions] = useState<{ name: string; price: number }[]>([]);
  const [newDiscount, setNewDiscount] = useState("");
  const [newDiscAmt, setNewDiscAmt] = useState(0);
  const [newExtension, setNewExtension] = useState("");
  const [newExtPrice, setNewExtPrice] = useState(0);
  const [newExtDur, setNewExtDur] = useState(0);
  const [newCardBase, setNewCardBase] = useState("");
  const [newPaypay, setNewPaypay] = useState("");

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
    const { data: nm } = await supabase.from("nominations").select("*"); if (nm) setNominations(nm);
    const { data: op } = await supabase.from("options").select("*"); if (op) setOptions(op);
    const { data: dc } = await supabase.from("discounts").select("*"); if (dc) setDiscounts(dc);
    const { data: ex } = await supabase.from("extensions").select("*"); if (ex) setExtensions(ex);
    const { data: st } = await supabase.from("stores").select("*"); if (st) setStores(st);
    const { data: bl } = await supabase.from("buildings").select("*"); if (bl) setBuildings(bl);
    const { data: rm } = await supabase.from("rooms").select("*"); if (rm) setAllRooms(rm);
    const { data: ra } = await supabase.from("room_assignments").select("*").eq("date", selectedDate); if (ra) setRoomAssigns(ra);
  }, [selectedDate]);

  useEffect(() => { const check = async () => { const { data: { user } } = await supabase.auth.getUser(); if (!user) router.push("/"); }; check(); fetchData(); }, [router, fetchData]);

  // 日付変更時に退勤リセット
  useEffect(() => { setClockedOut(new Set()); }, [selectedDate]);

  // シフトに入っているセラピストだけ表示（退勤者は下に）
  const shiftTherapistIds = new Set(shifts.map((s) => s.therapist_id));
  const sortByBuildingAndTime = (list: Therapist[]) => list.sort((a, b) => {
    const raA = roomAssigns.find(r => r.therapist_id === a.id); const raB = roomAssigns.find(r => r.therapist_id === b.id);
    const rmA = raA ? allRooms.find(r => r.id === raA.room_id) : null; const rmB = raB ? allRooms.find(r => r.id === raB.room_id) : null;
    const blA = rmA ? (rmA.building_id || 0) : 9999; const blB = rmB ? (rmB.building_id || 0) : 9999;
    if (blA !== blB) return blA - blB;
    const rmIdA = rmA ? rmA.id : 9999; const rmIdB = rmB ? rmB.id : 9999;
    if (rmIdA !== rmIdB) return rmIdA - rmIdB;
    const shA = shifts.find(s => s.therapist_id === a.id); const shB = shifts.find(s => s.therapist_id === b.id);
    const tA = shA ? timeToMinutes(shA.start_time) : 9999; const tB = shB ? timeToMinutes(shB.start_time) : 9999;
    return tA - tB;
  });
  const activeTherapists = sortByBuildingAndTime(therapists.filter((t) => shiftTherapistIds.has(t.id) && !clockedOut.has(t.id)));
  const clockedOutTherapists = sortByBuildingAndTime(therapists.filter((t) => shiftTherapistIds.has(t.id) && clockedOut.has(t.id)));
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
    if (!newCourseId) { setSaving(false); setMsg("コースを選択してください"); return; }
    const optText = newOptions.map(o => o.name).join(","); const optTotal = newOptions.reduce((s, o) => s + o.price, 0);
    const coursePrice = selectedCourse?.price || 0; const total = coursePrice + newNomFee + optTotal + newExtPrice - newDiscAmt;
    const { error } = await supabase.from("reservations").insert({ customer_name: newCustName.trim(), therapist_id: newTherapistId, date: newDate || selectedDate, start_time: newStart, end_time: newEnd, course: selectedCourse?.name || "", notes: newNotes.trim(), user_id: user?.id, nomination: newNomination, nomination_fee: newNomFee, options_text: optText, options_total: optTotal, discount_name: newDiscount, discount_amount: newDiscAmt, extension_name: newExtension, extension_price: newExtPrice, extension_duration: newExtDur, total_price: total, status: "unprocessed", card_base: parseInt(newCardBase) || 0, paypay_amount: parseInt(newPaypay) || 0, card_billing: Math.round((parseInt(newCardBase) || 0) * 1.1), cash_amount: total - (parseInt(newCardBase) || 0) - (parseInt(newPaypay) || 0) });
    if (!error) {
      const { data: cust } = await supabase.from("customers").select("id").eq("name", newCustName.trim()).maybeSingle();
      if (cust) {
        const optT2 = newOptions.reduce((s, o) => s + o.price, 0); const tot2 = (selectedCourse?.price || 0) + newNomFee + optT2 + newExtPrice - newDiscAmt;
        await supabase.from("customer_visits").insert({ customer_id: cust.id, date: newDate || selectedDate, start_time: newStart, end_time: newEnd, therapist_id: newTherapistId, course_name: selectedCourse?.name || "", price: selectedCourse?.price || 0, therapist_back: selectedCourse?.therapist_back || 0, total: tot2, nomination: newNomination, options: newOptions.map(o=>o.name).join(","), discount: newDiscount });
      }
    }
    setSaving(false);
    if (error) { setMsg("登録失敗: " + error.message); }
    else { setMsg("予約を登録しました！"); setNewCustName(""); setNewTherapistId(0); setNewCourseId(0); setNewNotes(""); setNewStart("12:00"); setNewEnd("13:00"); setNewNomination(""); setNewNomFee(0); setNewOptions([]); setNewDiscount(""); setNewDiscAmt(0); setNewExtension(""); setNewExtPrice(0); setNewExtDur(0); setNewCardBase(""); setNewPaypay(""); fetchData(); setTimeout(() => { setShowNewRes(false); setMsg(""); }, 600); }
  };

  const openEdit = (r: Reservation) => { setEditRes(r); setEditCustName(r.customer_name); setEditTherapistId(r.therapist_id); setEditStart(r.start_time); setEditEnd(r.end_time); setEditNotes(r.notes || ""); const c = courses.find((x) => x.name === r.course); setEditCourseId(c ? c.id : 0); setEditMsg(""); setEditNomination((r as any).nomination || ""); setEditNomFee((r as any).nomination_fee || 0); setEditDiscount((r as any).discount_name || ""); setEditDiscAmt((r as any).discount_amount || 0); setEditExtension((r as any).extension_name || ""); setEditExtPrice((r as any).extension_price || 0); setEditExtDur((r as any).extension_duration || 0); const opts = (r as any).options_text ? (r as any).options_text.split(",").map((n: string) => { const o = options.find(x=>x.name===n); return { name: n, price: o?.price || 0 }; }).filter((o: any)=>o.name) : []; setEditOptions(opts); setEditStatus((r as any).status || "unprocessed"); setEditCardBase(String((r as any).card_base || "")); setEditPaypay(String((r as any).paypay_amount || "")); };
  const updateReservation = async () => { if (!editRes) return; setEditSaving(true); setEditMsg(""); const eOptText = editOptions.map(o=>o.name).join(","); const eOptTotal = editOptions.reduce((s,o)=>s+o.price,0); const eCp = editSelectedCourse?.price || 0; const eTotal = eCp + editNomFee + eOptTotal + editExtPrice - editDiscAmt; const { error } = await supabase.from("reservations").update({ customer_name: editCustName.trim(), therapist_id: editTherapistId, start_time: editStart, end_time: editEnd, course: editSelectedCourse?.name || editRes.course, notes: editNotes.trim(), nomination: editNomination, nomination_fee: editNomFee, options_text: eOptText, options_total: eOptTotal, discount_name: editDiscount, discount_amount: editDiscAmt, extension_name: editExtension, extension_price: editExtPrice, extension_duration: editExtDur, total_price: eTotal, status: editStatus, card_base: parseInt(editCardBase) || 0, paypay_amount: parseInt(editPaypay) || 0, card_billing: Math.round((parseInt(editCardBase) || 0) * 1.1), cash_amount: eTotal - (parseInt(editCardBase) || 0) - (parseInt(editPaypay) || 0) }).eq("id", editRes.id); setEditSaving(false); if (error) { setEditMsg("更新失敗: " + error.message); } else { setEditMsg("更新しました！"); fetchData(); setTimeout(() => { setEditRes(null); setEditMsg(""); }, 600); } };
  const deleteReservation = async (id: number) => { await supabase.from("reservations").delete().eq("id", id); setEditRes(null); fetchData(); };
  const addShiftTherapist = async () => { if (!addShiftTherapistId) return; await supabase.from("shifts").insert({ therapist_id: addShiftTherapistId, date: selectedDate, start_time: addShiftStart, end_time: addShiftEnd, status: "confirmed" }); if (addShiftRoom) { await supabase.from("room_assignments").insert({ date: selectedDate, room_id: addShiftRoom, therapist_id: addShiftTherapistId, slot: "early" }); } setShowNewTherapist(false); setAddShiftTherapistId(0); fetchData(); };

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
          <NavMenu T={T} dark={dark} />
          <h1 className="text-[15px] font-medium">タイムチャート</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={toggle} className="px-3 py-1.5 text-[10px] rounded-lg cursor-pointer border" style={{ borderColor: T.border, color: T.textSub }}>{dark ? "☀️ ライト" : "🌙 ダーク"}</button>
          <button onClick={() => setShowNewTherapist(true)} className="px-3 py-2 border text-[11px] rounded-xl cursor-pointer" style={{ borderColor: T.border, color: T.textSub }}>+ セラピスト追加</button>
          <button onClick={() => { setNewDate(selectedDate); setNewCourseId(0); setNewStart("12:00"); setNewEnd("13:00"); setMsg(""); setNewTherapistId(0); setCustSearchQ(""); setShowCustSearch(true); supabase.from("customers").select("id,name,phone,rank").order("created_at",{ascending:false}).then(({data})=>{if(data)setCustList(data)}); }}
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
                  <div key={t.id} className="h-[72px] border-b border-r flex items-center px-2 gap-1.5" style={{ backgroundColor: isCO ? (dark ? "#2a2020" : "#faf5f5") : T.card, borderColor: T.border, opacity: isCO ? 0.5 : 1 }}>
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] text-white font-medium flex-shrink-0" style={{ backgroundColor: isCO ? "#888" : colors[origIdx % colors.length] }}>{t.name.charAt(0)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1"><button onClick={(e) => { e.stopPropagation(); setEditTherapist(t); setEtNotes((t as any).notes || ""); }} className="text-[10px] font-medium truncate cursor-pointer flex items-center gap-0.5" style={{ textDecoration: isCO ? "line-through" : "none", background: "none", border: "none", padding: 0, color: T.text, textAlign: "left" }}>{t.name}<span style={{ fontSize: 8, opacity: 0.4 }}>✏️</span></button></div>
                      <div className="flex items-center gap-1 flex-wrap text-[7px]" style={{ color: T.textMuted }}>
                        {(t as any).age > 0 && <span>{(t as any).age}歳</span>}
                        {(t as any).height_cm > 0 && <span>{(t as any).height_cm}cm</span>}
                        {(t as any).cup && <span>{(t as any).cup}</span>}
                        {(() => { const sh = shifts.find(s => s.therapist_id === t.id); return sh ? <button onClick={(e) => { e.stopPropagation(); setEditShiftTherapist(t.id); setEditShiftId(sh.id); setEditShiftStart(sh.start_time?.slice(0,5) || "12:00"); setEditShiftEnd(sh.end_time?.slice(0,5) || "03:00"); }} className="cursor-pointer" style={{ color: "#c3a782", background: "none", border: "none", padding: 0, fontSize: 7 }}>⏰{sh.start_time?.slice(0,5)}〜{sh.end_time?.slice(0,5)}</button> : null; })()}
                        {(() => { const ra = roomAssigns.find(a => a.therapist_id === t.id); if (ra) { const rm = allRooms.find(r => r.id === ra.room_id); const bl = rm ? buildings.find(b => b.id === rm.building_id) : null; return <button onClick={(e) => { e.stopPropagation(); setEditRoomTherapist(t.id); const ra2 = roomAssigns.find(a => a.therapist_id === t.id); if (ra2) { const rm2 = allRooms.find(r => r.id === ra2.room_id); setEditRoomId(ra2.room_id); setEditRoomStore(rm2?.store_id || 0); setEditRoomBuilding(rm2?.building_id || 0); } }} className="cursor-pointer" style={{ color: "#85a8c4", background: "none", border: "none", padding: 0, fontSize: 7 }}>🏠{bl?.name || ""}{rm?.name || ""}</button>; } return null; })()}
                      </div>
                      {(t as any).notes && <div style={{ overflow: "hidden", maxWidth: 120 }}><span className="text-[6px] block" style={{ color: "#f59e0b", whiteSpace: "nowrap", animation: (t as any).notes.length > 12 ? `scrollLeft ${Math.max(3, (t as any).notes.length * 0.2)}s linear infinite` : "none" }}>📝{(t as any).notes}</span></div>}
                      {isCO && <span className="text-[7px]" style={{ color: "#c45555" }}>退勤済</span>}
                    </div>
                    <div className="flex flex-col gap-0.5 flex-shrink-0">
                      <button onClick={() => toggleClockOut(t.id)} className="text-[7px] px-1 py-0.5 rounded cursor-pointer border"
                        style={{ borderColor: isCO ? "#7ab88f66" : "#c4555566", backgroundColor: isCO ? "#7ab88f12" : "#c4555512", color: isCO ? "#7ab88f" : "#c45555" }}>
                        {isCO ? "復活" : "退勤"}
                      </button>
                      <button onClick={async (e) => { e.stopPropagation(); setSettleTh(t); setSettleAdj(""); setSettleAdjNote(""); setSettleInvoice((t as any).has_invoice || false); const { data: existing } = await supabase.from("therapist_daily_settlements").select("*").eq("therapist_id", t.id).eq("date", selectedDate).maybeSingle(); setSettleSettled(!!existing?.is_settled); }} className="text-[7px] px-1 py-0.5 rounded cursor-pointer border" style={{ borderColor: "#c3a78244", color: "#c3a782" }}>清算</button>
                    </div>
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
                      setNewTherapistId(t.id); setNewStart(minutesToTime(min)); setNewEnd(minutesToTime(min + 60)); setNewDate(selectedDate); setNewCourseId(0); setMsg(""); setCustSearchQ(""); setShowCustSearch(true); supabase.from("customers").select("id,name,phone,rank").order("created_at",{ascending:false}).then(({data})=>{if(data)setCustList(data)});
                    }}>
                    {(() => { const sh = shifts.find(s => s.therapist_id === t.id); if (sh) { const shStart = timeToMinutes(sh.start_time); const shEnd = timeToMinutes(sh.end_time); const left = shStart * MIN_10_WIDTH / 10; const w = (shEnd - shStart) * MIN_10_WIDTH / 10; return <div className="absolute top-0 bottom-0" style={{ left, width: w, backgroundColor: dark ? "#c3a78208" : "#c3a78210", borderLeft: "2px solid #c3a78233", borderRight: "2px solid #c3a78233", zIndex: 1 }} />; } return null; })()}
                    {HOURS_RAW.map((rawH) => (<div key={`g-${t.id}-${rawH}`} className="absolute top-0 bottom-0" style={{ left: (rawH - 9) * HOUR_WIDTH, width: 1, backgroundColor: T.border }}>{[1, 2, 3, 4, 5].map((tick) => (<div key={tick} className="absolute top-0 bottom-0" style={{ left: tick * MIN_10_WIDTH, width: 1, backgroundColor: dark ? "#2a2a32" : "#f8f6f3" }} />))}</div>))}
                    {tRes.map((r, ri) => {
                      const sM = timeToMinutes(r.start_time); const eM = timeToMinutes(r.end_time);
                      const left = sM * (HOUR_WIDTH / 60); const width = (eM - sM) * (HOUR_WIDTH / 60);
                      const course = getCourseByName(r.course); const statusColors: Record<string,string> = { unprocessed: "#888780", processed: "#85a8c4", web_reservation: "#a855f7", phone_check: "#f59e0b", serving: "#22c55e", completed: "#c3a782" }; const color = statusColors[(r as any).status] || colors[origIdx % colors.length];
                      return (
                        <div key={`res-${r.id}-${ri}`} className="res-block absolute top-[4px] bottom-[4px] rounded-lg cursor-pointer group"
                          style={{ left, width: Math.max(width, MIN_10_WIDTH), backgroundColor: color + "20", borderLeft: `3px solid ${color}`, zIndex: 5 }}
                          onClick={(e) => { e.stopPropagation(); openEdit(r); }}>
                          <div className="absolute left-0 top-0 bottom-0 w-[6px] cursor-ew-resize opacity-0 group-hover:opacity-100 hover:bg-black/10 rounded-l-lg"
                            onMouseDown={(e) => { e.stopPropagation(); setDragInfo({ resId: r.id, edge: "start", initX: e.clientX, initMin: sM, initEndMin: eM }); }} />
                          <div className="px-2 py-1 overflow-hidden h-full"
                            onMouseDown={(e) => { if ((e.target as HTMLElement).closest(".drag-handle")) return; e.stopPropagation(); setDragInfo({ resId: r.id, edge: "move", initX: e.clientX, initMin: sM, initEndMin: eM }); }}>
                            <p className="text-[11px] font-medium truncate" style={{ color: T.text }}>{r.customer_name}{(r as any).status && (r as any).status !== "unprocessed" && <span style={{ marginLeft: 4, fontSize: 8, padding: "1px 4px", borderRadius: 4, backgroundColor: (r as any).status === "completed" ? "#c3a78222" : (r as any).status === "serving" ? "#22c55e22" : (r as any).status === "phone_check" ? "#f59e0b22" : (r as any).status === "web_reservation" ? "#a855f722" : "#85a8c422", color: (r as any).status === "completed" ? "#c3a782" : (r as any).status === "serving" ? "#22c55e" : (r as any).status === "phone_check" ? "#f59e0b" : (r as any).status === "web_reservation" ? "#a855f7" : "#85a8c4" }}>{(r as any).status === "completed" ? "終了" : (r as any).status === "serving" ? "接客中" : (r as any).status === "phone_check" ? "電話確認" : (r as any).status === "web_reservation" ? "WEB" : (r as any).status === "processed" ? "処理済" : ""}</span>}</p>
                            <p className="text-[9px] truncate" style={{ color: T.textSub }}>{r.course || `${r.start_time}〜${r.end_time}`}</p>
                            {((r as any).card_billing > 0 || (r as any).paypay_amount > 0) && <p className="text-[8px] truncate" style={{ color: "#85a8c4" }}>{(r as any).card_billing > 0 ? `💳${fmt((r as any).card_billing)}` : ""}{(r as any).card_billing > 0 && (r as any).paypay_amount > 0 ? " " : ""}{(r as any).paypay_amount > 0 ? `📱${fmt((r as any).paypay_amount)}` : ""}</p>}
                            {r.notes && <div style={{ overflow: "hidden", maxHeight: 20, lineHeight: "10px", marginTop: 2, position: "relative" }}><p className="text-[8px]" style={{ color: "#f59e0b", whiteSpace: "pre-wrap", animation: r.notes.length > 20 ? `scrollNote ${Math.max(4, r.notes.length * 0.15)}s linear infinite` : "none" }}>📝 {r.notes}</p></div>}
                            
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
          <span>売上: <strong style={{ color: T.text }}>{fmt(reservations.filter(r => (r as any).status === "completed").reduce((s, r) => { const t = (r as any).total_price; return s + (t || (getCourseByName(r.course)?.price || 0)); }, 0))}</strong></span>
          <span>バック: <strong style={{ color: "#7ab88f" }}>{fmt(reservations.filter(r => (r as any).status === "completed").reduce((s, r) => { const c = getCourseByName(r.course); return s + (c ? c.therapist_back : 0); }, 0))}</strong></span>
          <span style={{ color: "#c3a782" }}>終了: <strong>{reservations.filter(r => (r as any).status === "completed").length}</strong>件</span>
          <span className="ml-auto text-[10px]" style={{ color: T.textFaint }}>ドラッグで時間変更 / クリックで編集</span>
        </div>
      </div>

      {/* Customer Search Modal */}
      {showCustSearch && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowCustSearch(false)}>
          <div className="rounded-2xl border p-6 w-full max-w-md max-h-[80vh] overflow-y-auto" style={{ backgroundColor: T.card, borderColor: T.border }} onClick={(e) => e.stopPropagation()}>
            <h2 className="text-[16px] font-medium mb-1">お客様を選択</h2>
            <p className="text-[11px] mb-4" style={{ color: T.textFaint }}>予約するお客様を検索してください</p>
            <input type="text" placeholder="名前・電話番号で検索" value={custSearchQ} onChange={(e) => setCustSearchQ(e.target.value)} className="w-full px-4 py-3 rounded-xl text-[12px] outline-none mb-3" style={{ backgroundColor: T.cardAlt, color: T.text }} />
            <div className="space-y-1 max-h-[300px] overflow-y-auto mb-4">
              {custList.filter(c => { const q = custSearchQ.toLowerCase(); return !q || c.name?.toLowerCase().includes(q) || c.phone?.includes(q); }).map(c => (
                <button key={c.id} onClick={async () => { setNewCustName(c.name); setShowCustSearch(false); setShowNewRes(true); setNewNomination(""); setNewNomFee(0); setNewOptions([]); setNewDiscount(""); setNewDiscAmt(0); setNewExtension(""); setNewExtPrice(0); setNewExtDur(0); if (newTherapistId) { const { data: prevRes } = await supabase.from("reservations").select("id").eq("customer_name", c.name).eq("therapist_id", newTherapistId).limit(1); const { data: noms } = await supabase.from("nominations").select("*"); if (prevRes && prevRes.length > 0 && noms) { const honNom = noms.find((n: { name: string }) => n.name === "本指名"); if (honNom) { setNewNomination(honNom.name); setNewNomFee(honNom.price); } } } }} className="w-full text-left px-4 py-3 rounded-xl flex items-center justify-between cursor-pointer" style={{ backgroundColor: T.cardAlt }}>
                  <div><p className="text-[13px] font-medium">{c.name}</p><p className="text-[10px]" style={{ color: T.textMuted }}>{c.phone || "電話番号なし"}</p></div>
                  <span className="text-[10px] px-2 py-0.5 rounded" style={{ backgroundColor: c.rank === "good" ? "#7ab88f18" : c.rank === "caution" ? "#f59e0b18" : c.rank === "banned" ? "#c4555518" : "#88878018", color: c.rank === "good" ? "#7ab88f" : c.rank === "caution" ? "#f59e0b" : c.rank === "banned" ? "#c45555" : "#888780" }}>{c.rank === "good" ? "優良" : c.rank === "caution" ? "要注意" : c.rank === "banned" ? "出禁" : "普通"}</span>
                </button>
              ))}
              {custList.filter(c => { const q = custSearchQ.toLowerCase(); return !q || c.name?.toLowerCase().includes(q) || c.phone?.includes(q); }).length === 0 && <p className="text-[12px] text-center py-6" style={{ color: T.textFaint }}>該当するお客様がいません</p>}
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setShowCustSearch(false); setShowNewCust(true); setNcName(custSearchQ); setNcPhone(""); }} className="px-5 py-2.5 bg-gradient-to-r from-[#c3a782] to-[#b09672] text-white text-[12px] rounded-xl cursor-pointer">+ 新規お客様登録</button>
              <button onClick={() => setShowCustSearch(false)} className="px-5 py-2.5 border text-[12px] rounded-xl cursor-pointer" style={{ borderColor: T.border, color: T.textSub }}>キャンセル</button>
            </div>
          </div>
        </div>
      )}

      {/* New Customer Quick Modal */}
      {showNewCust && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowNewCust(false)}>
          <div className="rounded-2xl border p-6 w-full max-w-sm" style={{ backgroundColor: T.card, borderColor: T.border }} onClick={(e) => e.stopPropagation()}>
            <h2 className="text-[16px] font-medium mb-4">新規お客様登録</h2>
            <div className="space-y-3">
              <div><label className="block text-[11px] mb-1" style={{ color: T.textSub }}>お名前 *</label><input type="text" value={ncName} onChange={(e) => setNcName(e.target.value)} placeholder="お客様名" className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={{ backgroundColor: T.cardAlt, color: T.text }} /></div>
              <div><label className="block text-[11px] mb-1" style={{ color: T.textSub }}>電話番号</label><input type="tel" value={ncPhone} onChange={(e) => setNcPhone(e.target.value)} placeholder="090-xxxx-xxxx" className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={{ backgroundColor: T.cardAlt, color: T.text }} /></div>
              <div className="flex gap-3 pt-2">
                <button onClick={async () => { if (!ncName.trim()) return; const { error } = await supabase.from("customers").insert({ name: ncName.trim(), phone: ncPhone.trim() }); if (!error) { setNewCustName(ncName.trim()); setShowNewCust(false); setShowNewRes(true); } }} className="px-6 py-2.5 bg-gradient-to-r from-[#c3a782] to-[#b09672] text-white text-[12px] rounded-xl cursor-pointer">登録してオーダーへ</button>
                <button onClick={() => { setShowNewCust(false); setShowCustSearch(true); }} className="px-5 py-2.5 border text-[12px] rounded-xl cursor-pointer" style={{ borderColor: T.border, color: T.textSub }}>戻る</button>
              </div>
            </div>
          </div>
        </div>
      )}

      Select-String -Path app\timechart\page.tsx -Pattern "New Reservation Modal" -Context 0,30
      {showNewRes && (() => {
        const cp = selectedCourse?.price || 0; const optT = newOptions.reduce((s,o)=>s+o.price,0); const totalCalc = cp + newNomFee + optT + newExtPrice - newDiscAmt;
        return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowNewRes(false)}>
          <div className="rounded-2xl border p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto animate-[fadeIn_0.25s]" style={{ backgroundColor: T.card, borderColor: T.border }} onClick={(e) => e.stopPropagation()}>
            <h2 className="text-[16px] font-medium mb-1">オーダー登録</h2>
            <p className="text-[11px] mb-5" style={{ color: T.textFaint }}>{newCustName} 様の予約</p>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>顧客名</label><input type="text" value={newCustName} readOnly className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={{ ...inputStyle, opacity: 0.7 }} /></div>
                <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>セラピスト <span style={{ color: "#c49885" }}>*</span></label><select value={newTherapistId} onChange={(e) => setNewTherapistId(Number(e.target.value))} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none cursor-pointer" style={inputStyle}><option value={0}>選択</option>{therapists.map((t) => (<option key={t.id} value={t.id}>{t.name}</option>))}</select></div>
              </div>
              <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>コース <span style={{ color: "#c49885" }}>* 必須</span></label><select value={newCourseId} onChange={(e) => handleCourseChange(Number(e.target.value))} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none cursor-pointer" style={{ ...inputStyle, borderColor: !newCourseId ? "#c49885" : "transparent" }}><option value={0}>— コースを選択してください —</option>{courses.map((c) => (<option key={c.id} value={c.id}>{c.name}（{c.duration}分 / {fmt(c.price)}）</option>))}</select></div>
              {selectedCourse && (<div className="rounded-xl p-3 flex items-center gap-4 text-[11px]" style={{ backgroundColor: T.cardAlt }}><span style={{ color: T.textSub }}>料金: <strong style={{ color: T.text }}>{fmt(selectedCourse.price)}</strong></span><span style={{ color: T.textSub }}>バック: <strong style={{ color: "#7ab88f" }}>{fmt(selectedCourse.therapist_back)}</strong></span></div>)}
              <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>指名</label><select value={newNomination} onChange={(e) => { const n = nominations.find(x=>x.name===e.target.value); setNewNomination(e.target.value); setNewNomFee(n?.price||0); }} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none cursor-pointer" style={inputStyle}><option value="">指名なし</option>{nominations.map((n) => (<option key={n.id} value={n.name}>{n.name}（{fmt(n.price)}）</option>))}</select>{newNomination && <p className="text-[10px] mt-1" style={{ color: "#c3a782" }}>指名料: {fmt(newNomFee)}</p>}</div>
              <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>オプション（複数選択可）</label><div className="flex flex-wrap gap-2">{options.map((o) => { const sel = newOptions.some(x=>x.name===o.name); return <button key={o.id} onClick={() => { if (sel) setNewOptions(newOptions.filter(x=>x.name!==o.name)); else setNewOptions([...newOptions, { name: o.name, price: o.price }]); }} className="px-3 py-1.5 rounded-xl text-[10px] cursor-pointer" style={{ backgroundColor: sel ? "#85a8c418" : T.cardAlt, color: sel ? "#85a8c4" : T.textMuted, border: `1px solid ${sel ? "#85a8c4" : T.border}`, fontWeight: sel ? 600 : 400 }}>{o.name}（{fmt(o.price)}）</button>; })}</div>{newOptions.length > 0 && <p className="text-[10px] mt-1" style={{ color: "#85a8c4" }}>オプション合計: {fmt(newOptions.reduce((s,o)=>s+o.price,0))}</p>}</div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>延長</label><select value={newExtension} onChange={(e) => { const ex = extensions.find(x=>x.name===e.target.value); setNewExtension(e.target.value); setNewExtPrice(ex?.price||0); setNewExtDur(ex?.duration||0); if (ex && selectedCourse && newStart) { setNewEnd(minutesToTime(timeToMinutes(newStart) + selectedCourse.duration + ex.duration)); } }} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none cursor-pointer" style={inputStyle}><option value="">延長なし</option>{extensions.map((ex) => (<option key={ex.id} value={ex.name}>{ex.name}（{ex.duration}分 / {fmt(ex.price)}）</option>))}</select></div>
                <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>割引</label><select value={newDiscount} onChange={(e) => { const d = discounts.find(x=>x.name===e.target.value); setNewDiscount(e.target.value); setNewDiscAmt(d ? (d.type==="percent" ? Math.round(cp * d.amount / 100) : d.amount) : 0); }} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none cursor-pointer" style={inputStyle}><option value="">割引なし</option>{discounts.map((d) => (<option key={d.id} value={d.name}>{d.name}（{d.type==="percent" ? d.amount+"%" : fmt(d.amount)}）</option>))}</select></div>
              </div>
              <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>日付</label><input type="date" value={newDate || selectedDate} onChange={(e) => setNewDate(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none cursor-pointer" style={inputStyle} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>開始時間</label><select value={newStart} onChange={(e) => handleStartChange(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none cursor-pointer" style={inputStyle}>{TIMES_10MIN.map((t) => (<option key={t} value={t}>{minutesToDisplay(timeToMinutes(t))}</option>))}</select></div>
                <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>終了時間{selectedCourse ? "（自動）" : ""}</label><select value={newEnd} onChange={(e) => setNewEnd(e.target.value)} disabled={!!selectedCourse} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none cursor-pointer" style={{ ...inputStyle, color: selectedCourse ? "#c3a782" : T.text }}>{TIMES_10MIN.map((t) => (<option key={t} value={t}>{minutesToDisplay(timeToMinutes(t))}</option>))}</select></div>
              </div>
              <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>備考</label><div style={{ position: "relative" }}><textarea value={newNotes} onChange={(e) => setNewNotes(e.target.value)} placeholder="メモ・備考を入力" rows={4} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none resize-y" style={inputStyle} /><div style={{ position: "absolute", left: 12, right: 12, top: 42, borderTop: "1px dashed #f59e0b44", pointerEvents: "none" }} /><p className="text-[8px] mt-1" style={{ color: T.textFaint }}>⚠ 点線より上がタイムチャートに表示されます（2行まで）</p></div></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>💳 カード充当額（税抜）</label><input type="text" inputMode="numeric" value={newCardBase} onChange={(e) => setNewCardBase(e.target.value.replace(/[^0-9]/g, ""))} placeholder="0" className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} />{parseInt(newCardBase) > 0 && <p className="text-[9px] mt-1" style={{ color: "#85a8c4" }}>カード決済額: {fmt(Math.round(parseInt(newCardBase) * 1.1))}（10%手数料込）</p>}</div>
                <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>📱 PayPay支払額</label><input type="text" inputMode="numeric" value={newPaypay} onChange={(e) => setNewPaypay(e.target.value.replace(/[^0-9]/g, ""))} placeholder="0" className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} /></div>
              </div>
              <div className="rounded-xl p-4" style={{ backgroundColor: T.cardAlt, border: `1px solid ${T.border}` }}>
                <p className="text-[11px] font-medium mb-2" style={{ color: T.textSub }}>料金サマリー</p>
                <div className="space-y-1 text-[11px]">
                  {selectedCourse && <div className="flex justify-between"><span>コース: {selectedCourse.name}</span><span>{fmt(cp)}</span></div>}
                  {newNomination && <div className="flex justify-between"><span>指名: {newNomination}</span><span>+{fmt(newNomFee)}</span></div>}
                  {newOptions.map((o,i) => <div key={i} className="flex justify-between"><span>OP: {o.name}</span><span>+{fmt(o.price)}</span></div>)}
                  {newExtension && <div className="flex justify-between"><span>延長: {newExtension}</span><span>+{fmt(newExtPrice)}</span></div>}
                  {newDiscount && <div className="flex justify-between" style={{ color: "#c45555" }}><span>割引: {newDiscount}</span><span>-{fmt(newDiscAmt)}</span></div>}
                  <div className="flex justify-between pt-2 font-bold text-[13px]" style={{ borderTop: `1px solid ${T.border}`, color: "#c3a782" }}><span>合計</span><span>{fmt(totalCalc)}</span></div>
                  {(parseInt(newCardBase) > 0 || parseInt(newPaypay) > 0) && (<>
                    <div className="pt-2 mt-1" style={{ borderTop: `1px dashed ${T.border}` }}>
                      {parseInt(newCardBase) > 0 && <div className="flex justify-between"><span>💳 カード端末入力額</span><span style={{ color: "#85a8c4", fontWeight: 700 }}>{fmt(Math.round(parseInt(newCardBase) * 1.1))}</span></div>}
                      {parseInt(newPaypay) > 0 && <div className="flex justify-between"><span>📱 PayPay</span><span style={{ color: "#22c55e" }}>{fmt(parseInt(newPaypay))}</span></div>}
                      <div className="flex justify-between"><span>💴 現金</span><span>{fmt(totalCalc - (parseInt(newCardBase) || 0) - (parseInt(newPaypay) || 0))}</span></div>
                    </div>
                  </>)}
                </div>
              </div>
              {msg && <div className="px-4 py-3 rounded-xl text-[12px]" style={{ backgroundColor: msg.includes("失敗") || msg.includes("選択") ? "#c4988518" : "#7ab88f18", color: msg.includes("失敗") || msg.includes("選択") ? "#c49885" : "#5a9e6f" }}>{msg}</div>}
              <div className="flex gap-3 pt-2">
                <button onClick={addReservation} disabled={saving} className="px-7 py-3 bg-gradient-to-r from-[#c3a782] to-[#b09672] text-white text-[12px] rounded-xl cursor-pointer disabled:opacity-60">{saving ? "登録中..." : "予約する"}</button>
                <button onClick={() => { setShowNewRes(false); setMsg(""); }} className="px-7 py-3 border text-[12px] rounded-xl cursor-pointer" style={{ borderColor: T.border, color: T.textSub }}>キャンセル</button>
              </div>
            </div>
          </div>
        </div>);
      })()}

      {/* Edit Modal */}
      {editRes && (() => {
        const eCp = editSelectedCourse?.price || 0; const eOptT = editOptions.reduce((s,o)=>s+o.price,0); const eTotalCalc = eCp + editNomFee + eOptT + editExtPrice - editDiscAmt;
        return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setEditRes(null)}>
          <div className="rounded-2xl border p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto animate-[fadeIn_0.25s]" style={{ backgroundColor: T.card, borderColor: T.border }} onClick={(e) => e.stopPropagation()}>
            <h2 className="text-[16px] font-medium mb-1">オーダー編集</h2>
            <p className="text-[11px] mb-3" style={{ color: T.textFaint }}>{editCustName} 様の予約を編集</p>
            <div className="flex flex-wrap gap-1.5 mb-4">{([["unprocessed","未処理","#888780"],["processed","処理済","#85a8c4"],["web_reservation","WEB予約","#a855f7"],["phone_check","電話確認","#f59e0b"],["serving","接客中","#22c55e"],["completed","終了","#c3a782"]] as const).map(([val,label,color]) => (<button key={val} onClick={() => setEditStatus(val)} className="px-3 py-1.5 rounded-lg text-[10px] cursor-pointer" style={{ backgroundColor: editStatus === val ? color + "22" : T.cardAlt, color: editStatus === val ? color : T.textMuted, border: `1px solid ${editStatus === val ? color : T.border}`, fontWeight: editStatus === val ? 700 : 400 }}>{label}</button>))}</div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>顧客名</label><input type="text" value={editCustName} onChange={(e) => setEditCustName(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} /></div>
                <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>セラピスト</label><select value={editTherapistId} onChange={(e) => setEditTherapistId(Number(e.target.value))} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none cursor-pointer" style={inputStyle}>{therapists.map((t) => (<option key={t.id} value={t.id}>{t.name}</option>))}</select></div>
              </div>
              <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>コース <span style={{ color: "#c49885" }}>* 必須</span></label><select value={editCourseId} onChange={(e) => handleCourseChange(Number(e.target.value), true)} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none cursor-pointer" style={inputStyle}><option value={0}>— コースを選択 —</option>{courses.map((c) => (<option key={c.id} value={c.id}>{c.name}（{c.duration}分 / {fmt(c.price)}）</option>))}</select></div>
              {editSelectedCourse && (<div className="rounded-xl p-3 flex items-center gap-4 text-[11px]" style={{ backgroundColor: T.cardAlt }}><span style={{ color: T.textSub }}>料金: <strong style={{ color: T.text }}>{fmt(editSelectedCourse.price)}</strong></span><span style={{ color: T.textSub }}>バック: <strong style={{ color: "#7ab88f" }}>{fmt(editSelectedCourse.therapist_back)}</strong></span></div>)}
              <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>指名</label><select value={editNomination} onChange={(e) => { const n = nominations.find(x=>x.name===e.target.value); setEditNomination(e.target.value); setEditNomFee(n?.price||0); }} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none cursor-pointer" style={inputStyle}><option value="">指名なし</option>{nominations.map((n) => (<option key={n.id} value={n.name}>{n.name}（{fmt(n.price)}）</option>))}</select>{editNomination && <p className="text-[10px] mt-1" style={{ color: "#c3a782" }}>指名料: {fmt(editNomFee)}</p>}</div>
              <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>オプション（複数選択可）</label><div className="flex flex-wrap gap-2">{options.map((o) => { const sel = editOptions.some(x=>x.name===o.name); return <button key={o.id} onClick={() => { if (sel) setEditOptions(editOptions.filter(x=>x.name!==o.name)); else setEditOptions([...editOptions, { name: o.name, price: o.price }]); }} className="px-3 py-1.5 rounded-xl text-[10px] cursor-pointer" style={{ backgroundColor: sel ? "#85a8c418" : T.cardAlt, color: sel ? "#85a8c4" : T.textMuted, border: `1px solid ${sel ? "#85a8c4" : T.border}`, fontWeight: sel ? 600 : 400 }}>{o.name}（{fmt(o.price)}）</button>; })}</div>{editOptions.length > 0 && <p className="text-[10px] mt-1" style={{ color: "#85a8c4" }}>オプション合計: {fmt(eOptT)}</p>}</div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>延長</label><select value={editExtension} onChange={(e) => { const ex = extensions.find(x=>x.name===e.target.value); setEditExtension(e.target.value); setEditExtPrice(ex?.price||0); setEditExtDur(ex?.duration||0); if (ex && editSelectedCourse && editStart) { setEditEnd(minutesToTime(timeToMinutes(editStart) + editSelectedCourse.duration + ex.duration)); } }} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none cursor-pointer" style={inputStyle}><option value="">延長なし</option>{extensions.map((ex) => (<option key={ex.id} value={ex.name}>{ex.name}（{ex.duration}分 / {fmt(ex.price)}）</option>))}</select></div>
                <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>割引</label><select value={editDiscount} onChange={(e) => { const d = discounts.find(x=>x.name===e.target.value); setEditDiscount(e.target.value); setEditDiscAmt(d ? (d.type==="percent" ? Math.round(eCp * d.amount / 100) : d.amount) : 0); }} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none cursor-pointer" style={inputStyle}><option value="">割引なし</option>{discounts.map((d) => (<option key={d.id} value={d.name}>{d.name}（{d.type==="percent" ? d.amount+"%" : fmt(d.amount)}）</option>))}</select></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>開始時間</label><select value={editStart} onChange={(e) => handleStartChange(e.target.value, true)} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none cursor-pointer" style={inputStyle}>{TIMES_10MIN.map((t) => (<option key={t} value={t}>{minutesToDisplay(timeToMinutes(t))}</option>))}</select></div>
                <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>終了時間{editSelectedCourse ? "（自動）" : ""}</label><select value={editEnd} onChange={(e) => setEditEnd(e.target.value)} disabled={!!editSelectedCourse} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none cursor-pointer" style={{ ...inputStyle, color: editSelectedCourse ? "#c3a782" : T.text }}>{TIMES_10MIN.map((t) => (<option key={t} value={t}>{minutesToDisplay(timeToMinutes(t))}</option>))}</select></div>
              </div>
              <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>備考</label><div style={{ position: "relative" }}><textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} placeholder="メモ・備考を入力" rows={4} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none resize-y" style={inputStyle} /><div style={{ position: "absolute", left: 12, right: 12, top: 42, borderTop: "1px dashed #f59e0b44", pointerEvents: "none" }} /><p className="text-[8px] mt-1" style={{ color: T.textFaint }}>⚠ 点線より上がタイムチャートに表示されます（2行まで）</p></div></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>💳 カード充当額（税抜）</label><input type="text" inputMode="numeric" value={editCardBase} onChange={(e) => setEditCardBase(e.target.value.replace(/[^0-9]/g, ""))} placeholder="0" className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} />{parseInt(editCardBase) > 0 && <p className="text-[9px] mt-1" style={{ color: "#85a8c4" }}>カード決済額: {fmt(Math.round(parseInt(editCardBase) * 1.1))}（10%手数料込）</p>}</div>
                <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>📱 PayPay支払額</label><input type="text" inputMode="numeric" value={editPaypay} onChange={(e) => setEditPaypay(e.target.value.replace(/[^0-9]/g, ""))} placeholder="0" className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} /></div>
              </div>
              <div className="rounded-xl p-4" style={{ backgroundColor: T.cardAlt, border: `1px solid ${T.border}` }}>
                <p className="text-[11px] font-medium mb-2" style={{ color: T.textSub }}>料金サマリー</p>
                <div className="space-y-1 text-[11px]">
                  {editSelectedCourse && <div className="flex justify-between"><span>コース: {editSelectedCourse.name}</span><span>{fmt(eCp)}</span></div>}
                  {editNomination && <div className="flex justify-between"><span>指名: {editNomination}</span><span>+{fmt(editNomFee)}</span></div>}
                  {editOptions.map((o,i) => <div key={i} className="flex justify-between"><span>OP: {o.name}</span><span>+{fmt(o.price)}</span></div>)}
                  {editExtension && <div className="flex justify-between"><span>延長: {editExtension}</span><span>+{fmt(editExtPrice)}</span></div>}
                  {editDiscount && <div className="flex justify-between" style={{ color: "#c45555" }}><span>割引: {editDiscount}</span><span>-{fmt(editDiscAmt)}</span></div>}
                  <div className="flex justify-between pt-2 font-bold text-[13px]" style={{ borderTop: `1px solid ${T.border}`, color: "#c3a782" }}><span>合計</span><span>{fmt(eTotalCalc)}</span></div>
                  {(parseInt(editCardBase) > 0 || parseInt(editPaypay) > 0) && (<>
                    <div className="pt-2 mt-1" style={{ borderTop: `1px dashed ${T.border}` }}>
                      {parseInt(editCardBase) > 0 && <div className="flex justify-between"><span>💳 カード端末入力額</span><span style={{ color: "#85a8c4", fontWeight: 700 }}>{fmt(Math.round(parseInt(editCardBase) * 1.1))}</span></div>}
                      {parseInt(editPaypay) > 0 && <div className="flex justify-between"><span>📱 PayPay</span><span style={{ color: "#22c55e" }}>{fmt(parseInt(editPaypay))}</span></div>}
                      <div className="flex justify-between"><span>💴 現金</span><span>{fmt(eTotalCalc - (parseInt(editCardBase) || 0) - (parseInt(editPaypay) || 0))}</span></div>
                    </div>
                  </>)}
                </div>
              </div>
              {editMsg && <div className="px-4 py-3 rounded-xl text-[12px]" style={{ backgroundColor: editMsg.includes("失敗") ? "#c4988518" : "#7ab88f18", color: editMsg.includes("失敗") ? "#c49885" : "#5a9e6f" }}>{editMsg}</div>}
              <div className="flex gap-3 pt-2">
                <button onClick={updateReservation} disabled={editSaving} className="px-6 py-2.5 bg-gradient-to-r from-[#c3a782] to-[#b09672] text-white text-[12px] rounded-xl cursor-pointer disabled:opacity-60">{editSaving ? "更新中..." : "更新する"}</button>
                <button onClick={() => deleteReservation(editRes.id)} className="px-6 py-2.5 bg-[#c45555] text-white text-[12px] rounded-xl cursor-pointer">削除</button>
                <button onClick={() => setEditRes(null)} className="px-6 py-2.5 border text-[12px] rounded-xl cursor-pointer" style={{ borderColor: T.border, color: T.textSub }}>閉じる</button>
              </div>
            </div>
          </div>
        </div>);
      })()}

      {/* Settlement Modal */}
      {settleTh && (() => {
        const tRes = reservations.filter(r => r.therapist_id === settleTh.id && (r as any).status === "completed");
        const totalSales = tRes.reduce((s,r) => s + ((r as any).total_price || 0), 0);
        const totalBack = tRes.reduce((s,r) => { const c = getCourseByName(r.course); return s + (c?.therapist_back || 0); }, 0);
        const salaryType = (settleTh as any).salary_type || "fixed";
        const salaryAmount = (settleTh as any).salary_amount || 0;
        const salaryBonus = salaryType === "percent" ? Math.round(totalBack * salaryAmount / 100) : salaryAmount * tRes.length;
        const totalNom = tRes.reduce((s,r) => s + ((r as any).nomination_fee || 0), 0);
        const totalOpt = tRes.reduce((s,r) => s + ((r as any).options_total || 0), 0);
        const totalExt = tRes.reduce((s,r) => s + ((r as any).extension_price || 0), 0);
        const totalDisc = tRes.reduce((s,r) => s + ((r as any).discount_amount || 0), 0);
        const totalCard = tRes.reduce((s,r) => s + ((r as any).card_billing || 0), 0);
        const totalPaypay = tRes.reduce((s,r) => s + ((r as any).paypay_amount || 0), 0);
        const totalCash = tRes.reduce((s,r) => s + ((r as any).cash_amount || 0), 0);
        const adj = parseInt(settleAdj) || 0;
        const subtotal = totalBack + salaryBonus + adj;
        const invoiceDed = settleInvoice ? Math.round(subtotal * 0.1) : 0;
        const finalPay = subtotal - invoiceDed;
        const ra = roomAssigns.find(a => a.therapist_id === settleTh.id);
        const rm = ra ? allRooms.find(r => r.id === ra.room_id) : null;
        const bl = rm ? buildings.find(b => b.id === rm.building_id) : null;
        const cashReserve = (bl as any)?.cash_reserve || 0;
        const cashBalance = cashReserve + totalCash - finalPay;
        const storeRecovery = cashBalance > cashReserve ? cashBalance - cashReserve : 0;
        return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setSettleTh(null)}>
          <div className="rounded-2xl border p-6 w-full max-w-md max-h-[90vh] overflow-y-auto animate-[fadeIn_0.25s]" style={{ backgroundColor: T.card, borderColor: T.border }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div><h2 className="text-[15px] font-medium">💰 本日の清算</h2><p className="text-[11px]" style={{ color: T.textFaint }}>{settleTh.name} — {selectedDate}</p></div>
              {settleSettled && <span className="px-2 py-1 rounded text-[9px] font-medium" style={{ backgroundColor: "#22c55e18", color: "#22c55e" }}>✓ 清算済</span>}
            </div>
            <div className="space-y-3">
              <div className="rounded-xl p-4" style={{ backgroundColor: T.cardAlt }}>
                <p className="text-[10px] font-medium mb-2" style={{ color: T.textSub }}>売上明細（終了 {tRes.length}件）</p>
                <div className="space-y-1 text-[11px]">
                  {tRes.map((r,i) => <div key={i} className="flex justify-between"><span className="truncate" style={{ maxWidth: 200 }}>{r.customer_name} / {r.course}</span><span className="font-medium">{fmt((r as any).total_price || 0)}</span></div>)}
                  {tRes.length === 0 && <p className="text-[10px] text-center py-2" style={{ color: T.textFaint }}>終了した予約がありません</p>}
                </div>
              </div>
              <div className="rounded-xl p-4" style={{ backgroundColor: T.cardAlt }}>
                <p className="text-[10px] font-medium mb-2" style={{ color: T.textSub }}>給与計算</p>
                <div className="space-y-1 text-[11px]">
                  <div className="flex justify-between"><span>基本バック（{tRes.length}件）</span><span>{fmt(totalBack)}</span></div>
                  {salaryAmount > 0 && <div className="flex justify-between" style={{ color: "#c3a782" }}><span>給料ランク（{salaryType === "percent" ? `${salaryAmount}%UP` : `${salaryAmount.toLocaleString()}円UP×${tRes.length}件`}）</span><span>+{fmt(salaryBonus)}</span></div>}
                  <div className="flex justify-between"><span>指名料合計</span><span>{fmt(totalNom)}</span></div>
                </div>
              </div>
              <div className="rounded-xl p-4" style={{ backgroundColor: T.cardAlt }}>
                <p className="text-[10px] font-medium mb-2" style={{ color: T.textSub }}>支払い内訳</p>
                <div className="space-y-1 text-[11px]">
                  <div className="flex justify-between"><span>💳 カード合計</span><span>{fmt(totalCard)}</span></div>
                  <div className="flex justify-between"><span>📱 PayPay合計</span><span>{fmt(totalPaypay)}</span></div>
                  <div className="flex justify-between"><span>💴 現金合計</span><span>{fmt(totalCash)}</span></div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-[9px] mb-1" style={{ color: T.textSub }}>調整金（+/-）</label><input type="text" value={settleAdj} onChange={(e) => setSettleAdj(e.target.value.replace(/[^0-9-]/g, ""))} placeholder="0" className="w-full px-3 py-2 rounded-xl text-[12px] outline-none" style={inputStyle} /></div>
                <div><label className="block text-[9px] mb-1" style={{ color: T.textSub }}>調整理由</label><input type="text" value={settleAdjNote} onChange={(e) => setSettleAdjNote(e.target.value)} placeholder="理由" className="w-full px-3 py-2 rounded-xl text-[12px] outline-none" style={inputStyle} /></div>
              </div>
              <button onClick={() => setSettleInvoice(!settleInvoice)} className="px-3 py-2 rounded-xl text-[11px] cursor-pointer w-full text-left" style={{ backgroundColor: settleInvoice ? "#a855f718" : T.cardAlt, color: settleInvoice ? "#a855f7" : T.textMuted, border: `1px solid ${settleInvoice ? "#a855f7" : T.border}` }}>{settleInvoice ? "✅ インボイス控除あり（10%）" : "インボイス控除なし"}</button>
              <div className="rounded-xl p-4" style={{ backgroundColor: "#c3a78212", border: "1px solid #c3a78233" }}>
                <div className="space-y-1 text-[12px]">
                  <div className="flex justify-between"><span>バック小計</span><span>{fmt(totalBack + salaryBonus)}</span></div>
                  {adj !== 0 && <div className="flex justify-between" style={{ color: adj > 0 ? "#22c55e" : "#c45555" }}><span>調整金</span><span>{adj > 0 ? "+" : ""}{fmt(adj)}</span></div>}
                  {settleInvoice && <div className="flex justify-between" style={{ color: "#a855f7" }}><span>インボイス控除（10%）</span><span>-{fmt(invoiceDed)}</span></div>}
                  <div className="flex justify-between pt-2 font-bold text-[15px]" style={{ borderTop: "1px solid #c3a78233", color: "#c3a782" }}><span>支給額</span><span>{fmt(finalPay)}</span></div>
                </div>
              </div>
              {cashReserve > 0 && (
              <div className="rounded-xl p-4" style={{ backgroundColor: cashBalance < 0 ? "#c4555512" : "#85a8c412", border: `1px solid ${cashBalance < 0 ? "#c4555533" : "#85a8c433"}` }}>
                <p className="text-[10px] font-medium mb-2" style={{ color: T.textSub }}>💴 ルーム内現金（{bl?.name || ""}）</p>
                <div className="space-y-1 text-[11px]">
                  <div className="flex justify-between"><span>準備金（釣銭）</span><span>{fmt(cashReserve)}</span></div>
                  <div className="flex justify-between"><span>現金受取（お客様から）</span><span>+{fmt(totalCash)}</span></div>
                  <div className="flex justify-between" style={{ color: "#c45555" }}><span>報酬支払（セラピストへ）</span><span>-{fmt(finalPay)}</span></div>
                  <div className="flex justify-between pt-2 font-bold text-[13px]" style={{ borderTop: `1px solid ${cashBalance < 0 ? "#c4555533" : "#85a8c433"}`, color: cashBalance < 0 ? "#c45555" : "#85a8c4" }}><span>現在の残高</span><span>{fmt(cashBalance)}</span></div>
                  {cashBalance < 0 && <p className="text-[10px] font-medium mt-2 px-2 py-1.5 rounded" style={{ backgroundColor: "#c4555518", color: "#c45555" }}>⚠ 残高がマイナスです。予備金から {fmt(Math.abs(cashBalance))} を補充してください</p>}
                  {storeRecovery > 0 && <div className="flex justify-between mt-2 pt-2" style={{ borderTop: `1px dashed ${T.border}` }}><span>営業終了時の回収額（残高 - 準備金）</span><span className="font-bold" style={{ color: "#22c55e" }}>{fmt(storeRecovery)}</span></div>}
                </div>
              </div>
              )}
              <div className="flex gap-3 pt-2">
                <button onClick={async () => { setSettleSaving(true); await supabase.from("therapist_daily_settlements").upsert({ therapist_id: settleTh.id, date: selectedDate, total_sales: totalSales, total_back: totalBack + salaryBonus, total_nomination: totalNom, total_options: totalOpt, total_extension: totalExt, total_discount: totalDisc, total_card: totalCard, total_paypay: totalPaypay, total_cash: totalCash, order_count: tRes.length, is_settled: true, adjustment: adj, adjustment_note: settleAdjNote.trim(), invoice_deduction: invoiceDed, has_invoice: settleInvoice }, { onConflict: "therapist_id,date" }); setSettleSaving(false); setSettleTh(null); fetchData(); }} disabled={settleSaving} className="px-5 py-2.5 bg-gradient-to-r from-[#c3a782] to-[#b09672] text-white text-[11px] rounded-xl cursor-pointer disabled:opacity-60">{settleSaving ? "保存中..." : "清算確定"}</button>
                <button onClick={() => setSettleTh(null)} className="px-5 py-2.5 border text-[11px] rounded-xl cursor-pointer" style={{ borderColor: T.border, color: T.textSub }}>閉じる</button>
              </div>
            </div>
          </div>
        </div>);
      })()}

      {/* Therapist Edit Modal */}
      {editTherapist && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setEditTherapist(null)}>
          <div className="rounded-2xl border p-6 w-full max-w-sm animate-[fadeIn_0.25s]" style={{ backgroundColor: T.card, borderColor: T.border }} onClick={(e) => e.stopPropagation()}>
            <h2 className="text-[15px] font-medium mb-2">セラピスト編集</h2>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-[14px] text-white font-medium" style={{ backgroundColor: colors[therapists.findIndex(x => x.id === editTherapist.id) % colors.length] }}>{editTherapist.name.charAt(0)}</div>
              <div>
                <p className="text-[13px] font-medium">{editTherapist.name}</p>
                <div className="flex gap-2 text-[9px]" style={{ color: T.textMuted }}>
                  {(editTherapist as any).age > 0 && <span>{(editTherapist as any).age}歳</span>}
                  {(editTherapist as any).height_cm > 0 && <span>{(editTherapist as any).height_cm}cm</span>}
                  {(editTherapist as any).cup && <span>{(editTherapist as any).cup}カップ</span>}
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <div><label className="block text-[10px] mb-1" style={{ color: T.textSub }}>備考・メモ</label><textarea value={etNotes} onChange={(e) => { if (e.target.value.length <= 50) setEtNotes(e.target.value); }} placeholder="セラピストの備考を入力" rows={3} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none resize-y" style={inputStyle} /><div className="flex items-center justify-between mt-1"><div className="h-1 flex-1 rounded-full overflow-hidden" style={{ backgroundColor: T.cardAlt }}><div className="h-full rounded-full" style={{ width: `${(etNotes.length / 50) * 100}%`, backgroundColor: etNotes.length > 40 ? "#c45555" : etNotes.length > 25 ? "#f59e0b" : "#7ab88f" }} /></div><span className="text-[8px] ml-2 flex-shrink-0" style={{ color: etNotes.length > 40 ? "#c45555" : T.textMuted }}>{etNotes.length}/50</span></div></div>
              <div className="flex gap-3 pt-2">
                <button onClick={async () => { setEtSaving(true); await supabase.from("therapists").update({ notes: etNotes.trim() }).eq("id", editTherapist.id); setEtSaving(false); setEditTherapist(null); fetchData(); }} disabled={etSaving} className="px-5 py-2.5 bg-gradient-to-r from-[#c3a782] to-[#b09672] text-white text-[11px] rounded-xl cursor-pointer disabled:opacity-60">{etSaving ? "保存中..." : "保存する"}</button>
                <button onClick={() => window.open("/therapists", "_blank")} className="px-5 py-2.5 text-[11px] rounded-xl cursor-pointer" style={{ backgroundColor: "#85a8c418", color: "#85a8c4" }}>詳細編集</button>
                <button onClick={() => setEditTherapist(null)} className="px-5 py-2.5 border text-[11px] rounded-xl cursor-pointer" style={{ borderColor: T.border, color: T.textSub }}>閉じる</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Shift Change Modal */}
      {editShiftTherapist && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setEditShiftTherapist(null)}>
          <div className="rounded-2xl border p-6 w-full max-w-sm animate-[fadeIn_0.25s]" style={{ backgroundColor: T.card, borderColor: T.border }} onClick={(e) => e.stopPropagation()}>
            <h2 className="text-[15px] font-medium mb-2">⏰ 出勤時間変更</h2>
            <p className="text-[11px] mb-4" style={{ color: T.textFaint }}>{therapists.find(t => t.id === editShiftTherapist)?.name} の出勤時間</p>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-[10px] mb-1" style={{ color: T.textSub }}>開始時間</label><select value={editShiftStart} onChange={(e) => setEditShiftStart(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none cursor-pointer" style={inputStyle}>{TIMES_10MIN.map((t) => (<option key={t} value={t}>{minutesToDisplay(timeToMinutes(t))}</option>))}</select></div>
                <div><label className="block text-[10px] mb-1" style={{ color: T.textSub }}>終了時間</label><select value={editShiftEnd} onChange={(e) => setEditShiftEnd(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none cursor-pointer" style={inputStyle}>{TIMES_10MIN.map((t) => (<option key={t} value={t}>{minutesToDisplay(timeToMinutes(t))}</option>))}</select></div>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={async () => { if (!editShiftId) return; await supabase.from("shifts").update({ start_time: editShiftStart, end_time: editShiftEnd }).eq("id", editShiftId); setEditShiftTherapist(null); fetchData(); }} className="px-5 py-2.5 bg-gradient-to-r from-[#c3a782] to-[#b09672] text-white text-[11px] rounded-xl cursor-pointer">変更する</button>
                <button onClick={() => setEditShiftTherapist(null)} className="px-5 py-2.5 border text-[11px] rounded-xl cursor-pointer" style={{ borderColor: T.border, color: T.textSub }}>キャンセル</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Room Change Modal */}
      {editRoomTherapist && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setEditRoomTherapist(null)}>
          <div className="rounded-2xl border p-6 w-full max-w-sm animate-[fadeIn_0.25s]" style={{ backgroundColor: T.card, borderColor: T.border }} onClick={(e) => e.stopPropagation()}>
            <h2 className="text-[15px] font-medium mb-4">🏠 ルーム変更</h2>
            <p className="text-[11px] mb-4" style={{ color: T.textFaint }}>{therapists.find(t => t.id === editRoomTherapist)?.name} のルームを変更</p>
            <div className="space-y-3">
              <div><label className="block text-[10px] mb-1" style={{ color: T.textSub }}>店舗</label><select value={editRoomStore} onChange={(e) => { setEditRoomStore(Number(e.target.value)); setEditRoomBuilding(0); setEditRoomId(0); }} className="w-full px-3 py-2 rounded-xl text-[12px] outline-none cursor-pointer" style={inputStyle}><option value={0}>選択</option>{stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
              {editRoomStore > 0 && <div><label className="block text-[10px] mb-1" style={{ color: T.textSub }}>建物</label><select value={editRoomBuilding} onChange={(e) => { setEditRoomBuilding(Number(e.target.value)); setEditRoomId(0); }} className="w-full px-3 py-2 rounded-xl text-[12px] outline-none cursor-pointer" style={inputStyle}><option value={0}>選択</option>{buildings.filter(b => b.store_id === editRoomStore).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div>}
              {editRoomBuilding > 0 && <div><label className="block text-[10px] mb-1" style={{ color: T.textSub }}>部屋</label><select value={editRoomId} onChange={(e) => setEditRoomId(Number(e.target.value))} className="w-full px-3 py-2 rounded-xl text-[12px] outline-none cursor-pointer" style={inputStyle}><option value={0}>選択</option>{allRooms.filter(r => r.building_id === editRoomBuilding).map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></div>}
              <div className="flex gap-3 pt-2">
                <button onClick={async () => { if (!editRoomTherapist || !editRoomId) return; const existing = roomAssigns.find(a => a.therapist_id === editRoomTherapist); if (existing) { await supabase.from("room_assignments").update({ room_id: editRoomId }).eq("id", existing.id); } else { await supabase.from("room_assignments").insert({ date: selectedDate, room_id: editRoomId, therapist_id: editRoomTherapist, slot: "early" }); } setEditRoomTherapist(null); fetchData(); }} className="px-5 py-2.5 bg-gradient-to-r from-[#c3a782] to-[#b09672] text-white text-[11px] rounded-xl cursor-pointer">変更する</button>
                <button onClick={() => setEditRoomTherapist(null)} className="px-5 py-2.5 border text-[11px] rounded-xl cursor-pointer" style={{ borderColor: T.border, color: T.textSub }}>キャンセル</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Shift Modal */}
      {showNewTherapist && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowNewTherapist(false)}>
          <div className="rounded-2xl border p-6 w-full max-w-sm max-h-[90vh] overflow-y-auto animate-[fadeIn_0.25s]" style={{ backgroundColor: T.card, borderColor: T.border }} onClick={(e) => e.stopPropagation()}>
            <h2 className="text-[15px] font-medium mb-1">出勤追加</h2>
            <p className="text-[11px] mb-4" style={{ color: T.textFaint }}>セラピストを本日の出勤に追加します</p>
            <div className="space-y-3">
              <div><label className="block text-[10px] mb-1" style={{ color: T.textSub }}>セラピスト *</label><input type="text" placeholder="名前で検索" value={addShiftSearch} onChange={(e) => setAddShiftSearch(e.target.value)} className="w-full px-3 py-2 rounded-xl text-[11px] outline-none mb-2" style={inputStyle} /><div className="max-h-[150px] overflow-y-auto space-y-1">{therapists.filter(t => t.status === "active" && (!addShiftSearch || t.name.toLowerCase().includes(addShiftSearch.toLowerCase()))).map(t => { const onShift = shiftTherapistIds.has(t.id); return <button key={t.id} onClick={() => setAddShiftTherapistId(t.id)} className="w-full text-left px-3 py-2 rounded-lg text-[11px] cursor-pointer flex items-center justify-between" style={{ backgroundColor: addShiftTherapistId === t.id ? "#c3a78222" : T.cardAlt, border: `1px solid ${addShiftTherapistId === t.id ? "#c3a782" : "transparent"}` }}><span>{t.name}{(t as any).age ? ` (${(t as any).age}歳)` : ""}</span>{onShift && <span className="text-[8px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "#22c55e18", color: "#22c55e" }}>出勤中</span>}</button>; })}</div></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-[10px] mb-1" style={{ color: T.textSub }}>開始時間</label><select value={addShiftStart} onChange={(e) => setAddShiftStart(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none cursor-pointer" style={inputStyle}>{TIMES_10MIN.map((t) => (<option key={t} value={t}>{minutesToDisplay(timeToMinutes(t))}</option>))}</select></div>
                <div><label className="block text-[10px] mb-1" style={{ color: T.textSub }}>終了時間</label><select value={addShiftEnd} onChange={(e) => setAddShiftEnd(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none cursor-pointer" style={inputStyle}>{TIMES_10MIN.map((t) => (<option key={t} value={t}>{minutesToDisplay(timeToMinutes(t))}</option>))}</select></div>
              </div>
              <div><label className="block text-[10px] mb-1" style={{ color: T.textSub }}>店舗</label><select value={addShiftStore} onChange={(e) => { setAddShiftStore(Number(e.target.value)); setAddShiftBuilding(0); setAddShiftRoom(0); }} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none cursor-pointer" style={inputStyle}><option value={0}>選択</option>{stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
              {addShiftStore > 0 && <div><label className="block text-[10px] mb-1" style={{ color: T.textSub }}>建物</label><select value={addShiftBuilding} onChange={(e) => { setAddShiftBuilding(Number(e.target.value)); setAddShiftRoom(0); }} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none cursor-pointer" style={inputStyle}><option value={0}>選択</option>{buildings.filter(b => b.store_id === addShiftStore).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div>}
              {addShiftBuilding > 0 && <div><label className="block text-[10px] mb-1" style={{ color: T.textSub }}>部屋</label><select value={addShiftRoom} onChange={(e) => setAddShiftRoom(Number(e.target.value))} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none cursor-pointer" style={inputStyle}><option value={0}>選択</option>{allRooms.filter(r => r.building_id === addShiftBuilding).map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></div>}
              <div className="flex gap-3 pt-2">
                <button onClick={addShiftTherapist} className="px-5 py-2.5 bg-gradient-to-r from-[#c3a782] to-[#b09672] text-white text-[11px] rounded-xl cursor-pointer">出勤追加</button>
<button onClick={() => setShowNewTherapist(false)} className="px-5 py-2.5 border text-[11px] rounded-xl cursor-pointer" style={{ borderColor: T.border, color: T.textSub }}>キャンセル</button>
              </div>
            </div>
          </div>
        </div>
      )}
      <style jsx global>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } } @keyframes scrollLeft { 0%,5% { transform: translateX(10%); } 95%,100% { transform: translateX(-100%); } } @keyframes scrollNote { 0%,15% { transform: translateY(0); } 85%,100% { transform: translateY(calc(-100% + 20px)); } }`}</style>
    </div>
  );
}
