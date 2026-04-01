"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useToast } from "../../lib/toast";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";
import { useTheme } from "../../lib/theme"; import { NavMenu } from "../../lib/nav-menu";

type Therapist = { id: number; name: string; phone: string; status: string; has_withholding: boolean };
type Reservation = { id: number; customer_name: string; therapist_id: number; date: string; start_time: string; end_time: string; course: string; notes: string };
type Course = { id: number; name: string; duration: number; price: number; therapist_back: number };
type Shift = { id: number; therapist_id: number; store_id: number; date: string; start_time: string; end_time: string; status: string };

const HOUR_WIDTH = 120;
const MIN_10_WIDTH = HOUR_WIDTH / 6;
const START_HOUR = 11;
const DISPLAY_HOURS = 17;
const HOURS_RAW = Array.from({ length: DISPLAY_HOURS }, (_, i) => i + START_HOUR);
const HOURS_DISPLAY = Array.from({ length: DISPLAY_HOURS }, (_, i) => { const h = i + START_HOUR; return h >= 24 ? h - 24 : h; });

function timeToMinutes(time: string): number { const [h, m] = time.split(":").map(Number); const adj = h < START_HOUR ? h + 24 : h; return (adj - START_HOUR) * 60 + m; }
function minutesToTime(min: number): string { const t = min + START_HOUR * 60; const h = Math.floor(t / 60) % 24; const m = t % 60; return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`; }
function minutesToDisplay(min: number): string { const t = min + START_HOUR * 60; const h = Math.floor(t / 60); const dh = h >= 24 ? h - 24 : h; const m = t % 60; return `${dh}:${String(m).padStart(2, "0")}`; }

const TIMES_10MIN: string[] = [];
for (let m = 0; m <= 18 * 60; m += 10) TIMES_10MIN.push(minutesToTime(m));

export default function TimeChart() {
  const router = useRouter();
  const toast = useToast();
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
  const [editDiscounts, setEditDiscounts] = useState<{ name: string; amount: number }[]>([]);
  const [editExtension, setEditExtension] = useState("");
  const [editExtPrice, setEditExtPrice] = useState(0);
  const [editExtDur, setEditExtDur] = useState(0);
  const [editStatus, setEditStatus] = useState("unprocessed");
  const [editCardBase, setEditCardBase] = useState("");
  const [editPaypay, setEditPaypay] = useState("");
  const [editStaffName, setEditStaffName] = useState(""); // ★追加: 編集用スタッフ名
  const [editMsg, setEditMsg] = useState("");

  const [showNewTherapist, setShowNewTherapist] = useState(false);
  const [addShiftTherapistId, setAddShiftTherapistId] = useState(0);
  const [addShiftStart, setAddShiftStart] = useState("12:00");
  const [addShiftEnd, setAddShiftEnd] = useState("03:00");
  const [addShiftStore, setAddShiftStore] = useState(0);
  const [addShiftBuilding, setAddShiftBuilding] = useState(0);
  const [addShiftRoom, setAddShiftRoom] = useState(0);
  const [addShiftSearch, setAddShiftSearch] = useState("");
  const [breaks, setBreaks] = useState<{ id: number; therapist_id: number; start: string; end: string; label: string }[]>([]);
  const [nextBreakId, setNextBreakId] = useState(1);
  const [showBreakModal, setShowBreakModal] = useState<number | null>(null);
  const [breakDuration, setBreakDuration] = useState(30);
  const [breakStart, setBreakStart] = useState("12:00");
  const [editTherapist, setEditTherapist] = useState<Therapist | null>(null);
  const [etNotes, setEtNotes] = useState("");
  const [etSaving, setEtSaving] = useState(false);
  const [settleTh, setSettleTh] = useState<Therapist | null>(null);
  const [settleAdj, setSettleAdj] = useState("");
  const [settleAdjNote, setSettleAdjNote] = useState("");
  const [settleInvoice, setSettleInvoice] = useState(false);
  const [settleSaving, setSettleSaving] = useState(false);
  const [settleSettled, setSettleSettled] = useState(false);
  const [pastUncollected, setPastUncollected] = useState<{ date: string; total_cash: number; total_back: number; total_sales: number; therapist_name: string; sales_collected: boolean; change_collected: boolean; replenish_amount: number }[]>([]);
  const [settleSalesCollected, setSettleSalesCollected] = useState(false);
  const [settleChangeCollected, setSettleChangeCollected] = useState(false);
  const [settleSafeDeposited, setSettleSafeDeposited] = useState(false);
  const [showSafeList, setShowSafeList] = useState(false);
  const [safeUncollected, setSafeUncollected] = useState<{ id: number; therapist_id: number; date: string; total_cash: number; total_back: number; room_id: number; therapist_name: string; room_label: string; replenish: number }[]>([]);
  const [safeHistory, setSafeHistory] = useState<{ id: number; date: string; total_cash: number; total_back: number; room_id: number; therapist_name: string; room_label: string; replenish: number; safe_collected_date: string }[]>([]);
  const [showReplenish, setShowReplenish] = useState<number | null>(null);
  const [showDailySummary, setShowDailySummary] = useState(false);
  const [dailySettlements, setDailySettlements] = useState<{ therapist_id: number; sales_collected: boolean; change_collected: boolean; total_cash: number; total_back: number; room_id: number; safe_deposited: boolean }[]>([]);
  const [settledIds, setSettledIds] = useState<Set<number>>(new Set());
  const [pastCollected, setPastCollected] = useState<{ date: string; total_cash: number; total_back: number; room_id: number; replenish: number; therapist_name: string }[]>([]);
  const [safeCollectedToday, setSafeCollectedToday] = useState<{ date: string; total_cash: number; total_back: number; room_id: number; replenish: number; therapist_name: string }[]>([]);
  const [replenishAmount, setReplenishAmount] = useState("");
  const [replenishStaff, setReplenishStaff] = useState("");
  const [replenishTherapistId, setReplenishTherapistId] = useState(0);
  const [staffMembers, setStaffMembers] = useState<{ id: number; name: string; role: string }[]>([]); // ★追加: スタッフ一覧

  const [nominations, setNominations] = useState<{ id: number; name: string; price: number; back_amount?: number; therapist_back?: number }[]>([]);
  const [options, setOptions] = useState<{ id: number; name: string; price: number }[]>([]);
  const [discounts, setDiscounts] = useState<{ id: number; name: string; amount: number; type: string }[]>([]);
  const [extensions, setExtensions] = useState<{ id: number; name: string; duration: number; price: number }[]>([]);
  const [stores, setStores] = useState<{ id: number; name: string; invoice_number?: string; company_name?: string; company_address?: string; company_phone?: string }[]>([]);
  const [buildings, setBuildings] = useState<{ id: number; store_id: number; name: string }[]>([]);
  const [allRooms, setAllRooms] = useState<{ id: number; store_id: number; building_id: number; name: string }[]>([]);
  const [roomAssigns, setRoomAssigns] = useState<{ id: number; date: string; room_id: number; therapist_id: number; slot: string }[]>([]);
  const [replenishments, setReplenishments] = useState<{ id: number; room_id: number; date: string; amount: number; therapist_id?: number; staff_name?: string; created_at?: string }[]>([]);
  const [dailyExpenses, setDailyExpenses] = useState<{ id: number; name: string; amount: number; category: string; type: string }[]>([]);
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
  const [newDiscounts, setNewDiscounts] = useState<{ name: string; amount: number }[]>([]);
  const [newExtension, setNewExtension] = useState("");
  const [newExtPrice, setNewExtPrice] = useState(0);
  const [newExtDur, setNewExtDur] = useState(0);
  const [newCardBase, setNewCardBase] = useState("");
  const [newPaypay, setNewPaypay] = useState("");
  const [newStaffName, setNewStaffName] = useState(""); // ★追加: 新規登録用スタッフ名

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
    return ((adjH - START_HOUR) * 60 + m) * (HOUR_WIDTH / 60);
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
    const { data: rep } = await supabase.from("room_cash_replenishments").select("*").eq("date", selectedDate); if (rep) setReplenishments(rep);
    const { data: exp } = await supabase.from("expenses").select("*").eq("date", selectedDate); if (exp) setDailyExpenses(exp);
    const { data: settled } = await supabase.from("therapist_daily_settlements").select("therapist_id").eq("date", selectedDate).eq("is_settled", true); if (settled) setSettledIds(new Set(settled.map(s => s.therapist_id)));
    const { data: stf } = await supabase.from("staff").select("id,name,role").eq("status", "active").order("id"); if (stf) setStaffMembers(stf); // ★追加: スタッフ取得
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
    const coursePrice = selectedCourse?.price || 0; const discText = newDiscounts.map(d => d.name).join(","); const discTotal = newDiscounts.reduce((s, d) => s + d.amount, 0); const total = coursePrice + newNomFee + optTotal + newExtPrice - discTotal;
    const { error } = await supabase.from("reservations").insert({ customer_name: newCustName.trim(), therapist_id: newTherapistId, date: newDate || selectedDate, start_time: newStart, end_time: newEnd, course: selectedCourse?.name || "", notes: newNotes.trim(), user_id: user?.id, nomination: newNomination, nomination_fee: newNomFee, options_text: optText, options_total: optTotal, discount_name: discText, discount_amount: discTotal, extension_name: newExtension, extension_price: newExtPrice, extension_duration: newExtDur, total_price: total, status: "unprocessed", card_base: parseInt(newCardBase) || 0, paypay_amount: parseInt(newPaypay) || 0, card_billing: Math.round((parseInt(newCardBase) || 0) * 1.1), cash_amount: total - (parseInt(newCardBase) || 0) - (parseInt(newPaypay) || 0), staff_name: newStaffName }); // ★追加: staff_name
    if (!error) {
      const { data: cust } = await supabase.from("customers").select("id").eq("name", newCustName.trim()).maybeSingle();
      if (cust) {
        const optT2 = newOptions.reduce((s, o) => s + o.price, 0); const discT2 = newDiscounts.reduce((s, d) => s + d.amount, 0); const tot2 = (selectedCourse?.price || 0) + newNomFee + optT2 + newExtPrice - discT2;
        await supabase.from("customer_visits").insert({ customer_id: cust.id, date: newDate || selectedDate, start_time: newStart, end_time: newEnd, therapist_id: newTherapistId, course_name: selectedCourse?.name || "", price: selectedCourse?.price || 0, therapist_back: selectedCourse?.therapist_back || 0, total: tot2, nomination: newNomination, options: newOptions.map(o=>o.name).join(","), discount: newDiscounts.map(d=>d.name).join(",") });
      }
    }
    setSaving(false);
    if (error) { toast.show("登録失敗: " + error.message, "error"); }
    else { toast.show("予約を登録しました！", "success"); setNewCustName(""); setNewTherapistId(0); setNewCourseId(0); setNewNotes(""); setNewStart("12:00"); setNewEnd("13:00"); setNewNomination(""); setNewNomFee(0); setNewOptions([]); setNewDiscounts([]); setNewExtension(""); setNewExtPrice(0); setNewExtDur(0); setNewCardBase(""); setNewPaypay(""); setNewStaffName(""); fetchData(); setTimeout(() => { setShowNewRes(false); setMsg(""); }, 600); } // ★追加: setNewStaffName リセット
  };

  const openEdit = (r: Reservation) => { setEditRes(r); setEditCustName(r.customer_name); setEditTherapistId(r.therapist_id); setEditStart(r.start_time); setEditEnd(r.end_time); setEditNotes(r.notes || ""); const c = courses.find((x) => x.name === r.course); setEditCourseId(c ? c.id : 0); setEditMsg(""); setEditNomination((r as any).nomination || ""); setEditNomFee((r as any).nomination_fee || 0); const discs = (r as any).discount_name ? (r as any).discount_name.split(",").map((n: string) => { const d = discounts.find(x=>x.name===n); return { name: n, amount: d ? (d.type==="percent" ? Math.round((courses.find(x=>x.name===r.course)?.price || 0) * d.amount / 100) : d.amount) : 0 }; }).filter((d: any)=>d.name) : []; setEditDiscounts(discs); setEditExtension((r as any).extension_name || ""); setEditExtPrice((r as any).extension_price || 0); setEditExtDur((r as any).extension_duration || 0); const opts = (r as any).options_text ? (r as any).options_text.split(",").map((n: string) => { const o = options.find(x=>x.name===n); return { name: n, price: o?.price || 0 }; }).filter((o: any)=>o.name) : []; setEditOptions(opts); setEditStatus((r as any).status || "unprocessed"); setEditCardBase(String((r as any).card_base || "")); setEditPaypay(String((r as any).paypay_amount || "")); setEditStaffName((r as any).staff_name || ""); }; // ★追加: setEditStaffName
  const updateReservation = async () => { if (!editRes) return; setEditSaving(true); setEditMsg(""); const eOptText = editOptions.map(o=>o.name).join(","); const eOptTotal = editOptions.reduce((s,o)=>s+o.price,0); const eCp = editSelectedCourse?.price || 0; const eDiscText = editDiscounts.map(d=>d.name).join(","); const eDiscTotal = editDiscounts.reduce((s,d)=>s+d.amount,0); const eTotal = eCp + editNomFee + eOptTotal + editExtPrice - eDiscTotal; const { error } = await supabase.from("reservations").update({ customer_name: editCustName.trim(), therapist_id: editTherapistId, start_time: editStart, end_time: editEnd, course: editSelectedCourse?.name || editRes.course, notes: editNotes.trim(), nomination: editNomination, nomination_fee: editNomFee, options_text: eOptText, options_total: eOptTotal, discount_name: eDiscText, discount_amount: eDiscTotal, extension_name: editExtension, extension_price: editExtPrice, extension_duration: editExtDur, total_price: eTotal, status: editStatus, card_base: parseInt(editCardBase) || 0, paypay_amount: parseInt(editPaypay) || 0, card_billing: Math.round((parseInt(editCardBase) || 0) * 1.1), cash_amount: eTotal - (parseInt(editCardBase) || 0) - (parseInt(editPaypay) || 0), staff_name: editStaffName }).eq("id", editRes.id); setEditSaving(false); if (error) { toast.show("更新失敗: " + error.message, "error"); } else { toast.show("更新しました！", "success"); fetchData(); setTimeout(() => { setEditRes(null); setEditMsg(""); }, 600); } }; // ★追加: staff_name
  const deleteReservation = async (id: number) => { await supabase.from("reservations").delete().eq("id", id); setEditRes(null); fetchData(); };
  const addShiftTherapist = async () => { if (!addShiftTherapistId) return; await supabase.from("shifts").insert({ therapist_id: addShiftTherapistId, date: selectedDate, start_time: addShiftStart, end_time: addShiftEnd, status: "confirmed" }); if (addShiftRoom) { await supabase.from("room_assignments").insert({ date: selectedDate, room_id: addShiftRoom, therapist_id: addShiftTherapistId, slot: "early" }); } setShowNewTherapist(false); setAddShiftTherapistId(0); fetchData(); };

  const getCourseByName = (name: string) => courses.find((c) => c.name === name);
  const fmt = (n: number) => "¥" + (n || 0).toLocaleString();
  const prevDay = () => { const d = new Date(selectedDate); d.setDate(d.getDate() - 1); setSelectedDate(d.toISOString().split("T")[0]); };
  const nextDay = () => { const d = new Date(selectedDate); d.setDate(d.getDate() + 1); setSelectedDate(d.toISOString().split("T")[0]); };
  const dateDisplay = (() => { const d = new Date(selectedDate + "T00:00:00"); const days = ["日", "月", "火", "水", "木", "金", "土"]; return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日（${days[d.getDay()]}）`; })();

  const colors = ["#c3a782", "#7ab88f", "#85a8c4", "#c49885", "#a885c4", "#85c4b8", "#c4a685", "#8599c4"];
  const totalWidth = DISPLAY_HOURS * HOUR_WIDTH;
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
          <button onClick={async () => { setShowSafeList(true); const { data: sf } = await supabase.from("therapist_daily_settlements").select("*").eq("safe_deposited", true).is("safe_collected_date", null); if (sf) { const items: typeof safeUncollected = []; for (const s of sf) { const th = therapists.find(t => t.id === s.therapist_id); const rm = allRooms.find(r => r.id === s.room_id); const bl = rm ? buildings.find(b => b.id === rm.building_id) : null; const { data: rep } = await supabase.from("room_cash_replenishments").select("amount").eq("room_id", s.room_id).eq("date", s.date); const repAmt = rep ? rep.reduce((sum: number, r: { amount: number }) => sum + r.amount, 0) : 0; items.push({ id: s.id, therapist_id: s.therapist_id, date: s.date, total_cash: s.total_cash || 0, total_back: s.total_back || 0, room_id: s.room_id, therapist_name: th?.name || "不明", room_label: (bl?.name || "") + (rm?.name || ""), replenish: repAmt }); } setSafeUncollected(items); } const { data: sfH } = await supabase.from("therapist_daily_settlements").select("*").eq("safe_deposited", true).not("safe_collected_date", "is", null).order("safe_collected_date", { ascending: false }).limit(20); const hItems: typeof safeHistory = []; if (sfH) { for (const s of sfH) { const th = therapists.find(t => t.id === s.therapist_id); const rm = allRooms.find(r => r.id === s.room_id); const bl = rm ? buildings.find(b => b.id === rm.building_id) : null; const { data: rep } = await supabase.from("room_cash_replenishments").select("amount").eq("room_id", s.room_id).eq("date", s.date); const repAmt = rep ? rep.reduce((sum: number, r: { amount: number }) => sum + r.amount, 0) : 0; hItems.push({ id: s.id, date: s.date, total_cash: s.total_cash || 0, total_back: s.total_back || 0, room_id: s.room_id, therapist_name: th?.name || "", room_label: (bl?.name || "") + (rm?.name || ""), replenish: repAmt, safe_collected_date: s.safe_collected_date }); } } setSafeHistory(hItems); }} className="px-3 py-2 border text-[11px] rounded-xl cursor-pointer" style={{ borderColor: "#a855f744", color: "#a855f7" }}>🔐 金庫</button>
          <button onClick={async () => { setShowDailySummary(true); const { data: ds } = await supabase.from("therapist_daily_settlements").select("therapist_id,sales_collected,change_collected,total_cash,total_back,room_id,safe_deposited").eq("date", selectedDate); if (ds) setDailySettlements(ds); const roomIds = [...new Set(roomAssigns.map(r => r.room_id))]; const past: typeof pastCollected = []; for (const rid of roomIds) { for (let d = 1; d <= 7; d++) { const dd = new Date(selectedDate); dd.setDate(dd.getDate() - d); const ds2 = dd.toISOString().split("T")[0]; const { data: ps } = await supabase.from("therapist_daily_settlements").select("*").eq("room_id", rid).eq("date", ds2); if (ps) { for (const p of ps) { if ((p.sales_collected || p.change_collected) && !p.safe_deposited) { const { data: rep } = await supabase.from("room_cash_replenishments").select("amount").eq("room_id", rid).eq("date", ds2); const repAmt = rep ? rep.reduce((s: number, r: { amount: number }) => s + r.amount, 0) : 0; const th3 = therapists.find(x => x.id === p.therapist_id); past.push({ date: ds2, total_cash: p.total_cash || 0, total_back: p.total_back || 0, room_id: rid, replenish: repAmt, therapist_name: th3?.name || "" }); } } } } } setPastCollected(past); const { data: safeColl } = await supabase.from("therapist_daily_settlements").select("*").eq("safe_collected_date", selectedDate).eq("safe_deposited", true); const safeItems: typeof safeCollectedToday = []; if (safeColl) { for (const sc of safeColl) { const th4 = therapists.find(x => x.id === sc.therapist_id); const rm4 = allRooms.find(r => r.id === sc.room_id); const bl4 = rm4 ? buildings.find(b => b.id === rm4.building_id) : null; const { data: rep4 } = await supabase.from("room_cash_replenishments").select("amount").eq("room_id", sc.room_id).eq("date", sc.date); const repAmt4 = rep4 ? rep4.reduce((s2: number, r2: { amount: number }) => s2 + r2.amount, 0) : 0; safeItems.push({ date: sc.date, total_cash: sc.total_cash || 0, total_back: sc.total_back || 0, room_id: sc.room_id, replenish: repAmt4, therapist_name: th4?.name || "" }); } } setSafeCollectedToday(safeItems); }} className="px-3 py-2 border text-[11px] rounded-xl cursor-pointer" style={{ borderColor: "#c3a78244", color: "#c3a782" }}>📊 日次集計</button>
          <button onClick={() => setShowNewTherapist(true)} className="px-3 py-2 border text-[11px] rounded-xl cursor-pointer" style={{ borderColor: T.border, color: T.textSub }}>+ セラピスト追加</button>
          <button onClick={() => { setNewDate(selectedDate); setNewCourseId(0); setNewStart("12:00"); setNewEnd("13:00"); setMsg(""); setNewTherapistId(0); setNewStaffName(""); setCustSearchQ(""); setShowCustSearch(true); supabase.from("customers").select("id,name,phone,rank").order("created_at",{ascending:false}).then(({data})=>{if(data)setCustList(data)}); }}
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
            <div className="w-[200px] flex-shrink-0 sticky left-0 z-20" style={{ backgroundColor: T.bg }}>
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
                        {(() => { const ra = roomAssigns.find(a => a.therapist_id === t.id); if (ra) { const rm = allRooms.find(r => r.id === ra.room_id); const bl = rm ? buildings.find(b => b.id === rm.building_id) : null; const hasReserve = (bl as any)?.cash_reserve > 0; return <><button onClick={(e) => { e.stopPropagation(); setEditRoomTherapist(t.id); const ra2 = roomAssigns.find(a => a.therapist_id === t.id); if (ra2) { const rm2 = allRooms.find(r => r.id === ra2.room_id); setEditRoomId(ra2.room_id); setEditRoomStore(rm2?.store_id || 0); setEditRoomBuilding(rm2?.building_id || 0); } }} className="cursor-pointer" style={{ color: "#85a8c4", background: "none", border: "none", padding: 0, fontSize: 7 }}>🏠{bl?.name || ""}{rm?.name || ""}</button>{hasReserve && <button onClick={async (e) => { e.stopPropagation(); setShowReplenish(ra.room_id); setReplenishAmount(String((bl as any)?.cash_reserve || 20000)); setReplenishTherapistId(t.id); setReplenishStaff(""); const { data: ds } = await supabase.from("therapist_daily_settlements").select("therapist_id,sales_collected,change_collected,total_cash,total_back,room_id,safe_deposited").eq("date", selectedDate).eq("room_id", ra.room_id); if (ds) setDailySettlements(prev => { const filtered = prev.filter(p => p.room_id !== ra.room_id); return [...filtered, ...ds]; }); const past7: typeof pastUncollected = []; for (let d = 1; d <= 7; d++) { const dd = new Date(selectedDate); dd.setDate(dd.getDate() - d); const ds2 = dd.toISOString().split("T")[0]; const { data: ps } = await supabase.from("therapist_daily_settlements").select("*").eq("room_id", ra.room_id).eq("date", ds2); if (ps) { for (const p of ps) { if (!p.sales_collected || !p.change_collected) { const th2 = therapists.find(x => x.id === p.therapist_id); const { data: pastRep } = await supabase.from("room_cash_replenishments").select("amount").eq("room_id", ra.room_id).eq("date", ds2); const repAmt = pastRep ? pastRep.reduce((s2: number, r2: { amount: number }) => s2 + r2.amount, 0) : 0; past7.push({ date: ds2, total_cash: p.total_cash || 0, total_back: p.total_back || 0, total_sales: p.total_sales || 0, therapist_name: th2?.name || "", sales_collected: !!p.sales_collected, change_collected: !!p.change_collected, replenish_amount: repAmt }); } } } } setPastUncollected(past7); }} style={{ color: "#22c55e", background: "none", border: "none", padding: 0, fontSize: 7, cursor: "pointer", marginLeft: 2 }}>💰</button>}</>; } return null; })()}
                      </div>
                      {(t as any).notes && <div style={{ overflow: "hidden", maxWidth: 120 }}><span className="text-[6px] block" style={{ color: "#f59e0b", whiteSpace: "nowrap", animation: (t as any).notes.length > 12 ? `scrollLeft ${Math.max(3, (t as any).notes.length * 0.2)}s linear infinite` : "none" }}>📝{(t as any).notes}</span></div>}
                      {isCO && <span className="text-[7px]" style={{ color: "#c45555" }}>退勤済</span>}
                      {settledIds.has(t.id) && <button onClick={async (e) => { e.stopPropagation(); if (!confirm(`${t.name}の清算確定を取り消しますか？`)) return; await supabase.from("therapist_daily_settlements").delete().eq("therapist_id", t.id).eq("date", selectedDate); setSettledIds(prev => { const next = new Set(prev); next.delete(t.id); return next; }); toast.show("清算を取り消しました", "info"); fetchData(); }} className="text-[8px] px-1.5 py-0.5 rounded font-bold cursor-pointer" style={{ backgroundColor: "#22c55e22", color: "#22c55e", border: "1px solid #22c55e44" }}>✓ 清算済</button>}
                    </div>
                    <div className="flex flex-col gap-0.5 flex-shrink-0">
                      <button onClick={() => toggleClockOut(t.id)} className="text-[7px] px-1 py-0.5 rounded cursor-pointer border"
                        style={{ borderColor: isCO ? "#7ab88f66" : "#c4555566", backgroundColor: isCO ? "#7ab88f12" : "#c4555512", color: isCO ? "#7ab88f" : "#c45555" }}>
                        {isCO ? "復活" : "退勤"}
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); const bRes2 = reservations.filter(r => r.therapist_id === t.id).sort((a, b) => timeToMinutes(b.end_time) - timeToMinutes(a.end_time)); setBreakStart(bRes2.length > 0 ? bRes2[0].end_time.slice(0,5) : "12:00"); setShowBreakModal(t.id); setBreakDuration(30); }} className="text-[7px] px-1 py-0.5 rounded cursor-pointer border" style={{ borderColor: "#a855f744", color: "#a855f7" }}>休憩</button>
                      <button onClick={async (e) => { e.stopPropagation(); setSettleTh(t); setSettleAdj(""); setSettleAdjNote(""); setSettleInvoice((t as any).has_invoice || false); setSettleSalesCollected(false); setSettleChangeCollected(false); const { data: existing } = await supabase.from("therapist_daily_settlements").select("*").eq("therapist_id", t.id).eq("date", selectedDate).maybeSingle(); setSettleSettled(!!existing?.is_settled); if (existing) { setSettleSalesCollected(!!existing.sales_collected); setSettleChangeCollected(!!existing.change_collected); setSettleSafeDeposited(!!existing.safe_deposited); } else { setSettleSafeDeposited(false); } const ra2 = roomAssigns.find(a => a.therapist_id === t.id); if (ra2) { const past7: typeof pastUncollected = []; for (let d = 0; d <= 7; d++) { const dd = new Date(selectedDate); dd.setDate(dd.getDate() - d); const ds = dd.toISOString().split("T")[0]; const { data: ps } = await supabase.from("therapist_daily_settlements").select("*").eq("room_id", ra2.room_id).eq("date", ds); if (ps) { for (const p of ps) { if (p.therapist_id === t.id && ds === selectedDate) continue; if (!p.sales_collected || !p.change_collected) { const th2 = therapists.find(x => x.id === p.therapist_id); const { data: pastRep } = await supabase.from("room_cash_replenishments").select("amount").eq("room_id", ra2.room_id).eq("date", ds); const repAmt = pastRep ? pastRep.reduce((s: number, r: { amount: number }) => s + r.amount, 0) : 0; past7.push({ date: ds, total_cash: p.total_cash || 0, total_back: p.total_back || 0, total_sales: p.total_sales || 0, therapist_name: th2?.name || "不明", sales_collected: !!p.sales_collected, change_collected: !!p.change_collected, replenish_amount: repAmt }); } } } } setPastUncollected(past7); } else { setPastUncollected([]); } }} className="text-[7px] px-1 py-0.5 rounded cursor-pointer border" style={{ borderColor: "#c3a78244", color: "#c3a782" }}>清算</button>
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
                      setNewTherapistId(t.id); setNewStart(minutesToTime(min)); setNewEnd(minutesToTime(min + 60)); setNewDate(selectedDate); setNewCourseId(0); setMsg(""); setNewStaffName(""); setCustSearchQ(""); setShowCustSearch(true); supabase.from("customers").select("id,name,phone,rank").order("created_at",{ascending:false}).then(({data})=>{if(data)setCustList(data)});
                    }}>
                    {(() => { const sh = shifts.find(s => s.therapist_id === t.id); if (sh) { const shStart = timeToMinutes(sh.start_time); const shEnd = timeToMinutes(sh.end_time); const left = shStart * MIN_10_WIDTH / 10; const w = (shEnd - shStart) * MIN_10_WIDTH / 10; return <div className="absolute top-0 bottom-0" style={{ left, width: w, backgroundColor: dark ? "#c3a78208" : "#c3a78210", borderLeft: "2px solid #c3a78233", borderRight: "2px solid #c3a78233", zIndex: 1 }} />; } return null; })()}
                    {HOURS_RAW.map((rawH) => (<div key={`g-${t.id}-${rawH}`} className="absolute top-0 bottom-0" style={{ left: (rawH - START_HOUR) * HOUR_WIDTH, width: 1, backgroundColor: T.border }}>{[1, 2, 3, 4, 5].map((tick) => (<div key={tick} className="absolute top-0 bottom-0" style={{ left: tick * MIN_10_WIDTH, width: 1, backgroundColor: dark ? "#2a2a32" : "#f8f6f3" }} />))}</div>))}
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
                            <p className="text-[9px] truncate" style={{ color: T.textSub }}>{r.start_time?.slice(0,5)}〜{r.end_time?.slice(0,5)}{r.course ? ` / ${r.course}` : ""}{(r as any).staff_name ? ` 👤${(r as any).staff_name}` : ""}</p>
                            {((r as any).card_billing > 0 || (r as any).paypay_amount > 0) && <p className="text-[8px] truncate" style={{ color: "#85a8c4" }}>{(r as any).card_billing > 0 ? `💳${fmt((r as any).card_billing)}` : ""}{(r as any).card_billing > 0 && (r as any).paypay_amount > 0 ? " " : ""}{(r as any).paypay_amount > 0 ? `📱${fmt((r as any).paypay_amount)}` : ""}</p>}
                            {r.notes && <div style={{ overflow: "hidden", maxHeight: 20, lineHeight: "10px", marginTop: 2, position: "relative" }}><p className="text-[8px]" style={{ color: "#f59e0b", whiteSpace: "pre-wrap", animation: r.notes.length > 20 ? `scrollNote ${Math.max(4, r.notes.length * 0.15)}s linear infinite` : "none" }}>📝 {r.notes}</p></div>}
                            
                          </div>
                          <div className="drag-handle absolute right-0 top-0 bottom-0 w-[6px] cursor-ew-resize opacity-0 group-hover:opacity-100 hover:bg-black/10 rounded-r-lg"
                            onMouseDown={(e) => { e.stopPropagation(); setDragInfo({ resId: r.id, edge: "end", initX: e.clientX, initMin: sM, initEndMin: eM }); }} />
                        </div>
                      );
                    })}
                    {breaks.filter(b => b.therapist_id === t.id).map((b) => {
                      const bsM = timeToMinutes(b.start); const beM = timeToMinutes(b.end);
                      const bLeft = bsM * (HOUR_WIDTH / 60); const bWidth = (beM - bsM) * (HOUR_WIDTH / 60);
                      return (
                        <div key={`brk-${b.id}`} className="absolute top-[2px] bottom-[2px] rounded-lg cursor-pointer" style={{ left: bLeft, width: bWidth, backgroundColor: dark ? "#a855f715" : "#a855f710", borderLeft: `2px dashed #a855f7`, zIndex: 4 }}
                          onClick={(e) => { e.stopPropagation(); if (confirm("この休憩を削除しますか？")) setBreaks(prev => prev.filter(x => x.id !== b.id)); }}>
                          <div className="px-1 py-0.5"><p className="text-[8px] font-medium" style={{ color: "#a855f7" }}>☕ {b.start?.slice(0,5)}〜{b.end?.slice(0,5)}</p></div>
                        </div>
                      );
                    })}
                    {tRes.map((r, ri) => {
                      const intervalMin = (t as any).interval_minutes || 0;
                      if (intervalMin <= 0) return null;
                      const eM = timeToMinutes(r.end_time);
                      const iLeft = eM * (HOUR_WIDTH / 60);
                      const iWidth = intervalMin * (HOUR_WIDTH / 60);
                      return (
                        <div key={`int-${r.id}-${ri}`} className="absolute top-[8px] bottom-[8px] rounded" style={{ left: iLeft, width: iWidth, backgroundColor: dark ? "#ffffff08" : "#00000008", borderLeft: `1px dashed ${dark ? "#ffffff22" : "#00000022"}`, borderRight: `1px dashed ${dark ? "#ffffff22" : "#00000022"}`, zIndex: 2 }}>
                          <span className="text-[7px] absolute top-0.5 left-1" style={{ color: T.textFaint }}>{intervalMin}分</span>
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
                <button key={c.id} onClick={async () => { setNewCustName(c.name); setShowCustSearch(false); setShowNewRes(true); setNewNomination(""); setNewNomFee(0); setNewOptions([]); setNewDiscounts([]); setNewExtension(""); setNewExtPrice(0); setNewExtDur(0); if (newTherapistId) { const { data: prevRes } = await supabase.from("reservations").select("id").eq("customer_name", c.name).eq("therapist_id", newTherapistId).limit(1); const { data: noms } = await supabase.from("nominations").select("*"); if (prevRes && prevRes.length > 0 && noms) { const honNom = noms.find((n: { name: string }) => n.name === "本指名"); if (honNom) { setNewNomination(honNom.name); setNewNomFee(honNom.price); } } } }} className="w-full text-left px-4 py-3 rounded-xl flex items-center justify-between cursor-pointer" style={{ backgroundColor: T.cardAlt }}>
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

      {/* ★ New Reservation Modal — スタッフ名セレクト追加 */}
      {showNewRes && (() => {
        const cp = selectedCourse?.price || 0; const optT = newOptions.reduce((s,o)=>s+o.price,0); const newDiscTotal = newDiscounts.reduce((s,d)=>s+d.amount,0); const totalCalc = cp + newNomFee + optT + newExtPrice - newDiscTotal;
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
              {/* ★追加: 受付スタッフ選択 */}
              <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>👤 受付スタッフ</label><select value={newStaffName} onChange={(e) => setNewStaffName(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none cursor-pointer" style={inputStyle}><option value="">未選択</option>{staffMembers.map((s) => (<option key={s.id} value={s.name}>{s.name}</option>))}</select></div>
              <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>コース <span style={{ color: "#c49885" }}>* 必須</span></label><select value={newCourseId} onChange={(e) => handleCourseChange(Number(e.target.value))} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none cursor-pointer" style={{ ...inputStyle, borderColor: !newCourseId ? "#c49885" : "transparent" }}><option value={0}>— コースを選択してください —</option>{courses.map((c) => (<option key={c.id} value={c.id}>{c.name}（{c.duration}分 / {fmt(c.price)}）</option>))}</select></div>
              {selectedCourse && (<div className="rounded-xl p-3 flex items-center gap-4 text-[11px]" style={{ backgroundColor: T.cardAlt }}><span style={{ color: T.textSub }}>料金: <strong style={{ color: T.text }}>{fmt(selectedCourse.price)}</strong></span><span style={{ color: T.textSub }}>バック: <strong style={{ color: "#7ab88f" }}>{fmt(selectedCourse.therapist_back)}</strong></span></div>)}
              <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>指名</label><select value={newNomination} onChange={(e) => { const n = nominations.find(x=>x.name===e.target.value); setNewNomination(e.target.value); setNewNomFee(n?.price||0); }} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none cursor-pointer" style={inputStyle}><option value="">指名なし</option>{nominations.map((n) => (<option key={n.id} value={n.name}>{n.name}（{fmt(n.price)}）</option>))}</select>{newNomination && <p className="text-[10px] mt-1" style={{ color: "#c3a782" }}>指名料: {fmt(newNomFee)}</p>}</div>
              <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>オプション（複数選択可）</label><div className="flex flex-wrap gap-2">{options.map((o) => { const sel = newOptions.some(x=>x.name===o.name); return <button key={o.id} onClick={() => { if (sel) setNewOptions(newOptions.filter(x=>x.name!==o.name)); else setNewOptions([...newOptions, { name: o.name, price: o.price }]); }} className="px-3 py-1.5 rounded-xl text-[10px] cursor-pointer" style={{ backgroundColor: sel ? "#85a8c418" : T.cardAlt, color: sel ? "#85a8c4" : T.textMuted, border: `1px solid ${sel ? "#85a8c4" : T.border}`, fontWeight: sel ? 600 : 400 }}>{o.name}（{fmt(o.price)}）</button>; })}</div>{newOptions.length > 0 && <p className="text-[10px] mt-1" style={{ color: "#85a8c4" }}>オプション合計: {fmt(newOptions.reduce((s,o)=>s+o.price,0))}</p>}</div>
              <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>延長</label><select value={newExtension} onChange={(e) => { const ex = extensions.find(x=>x.name===e.target.value); setNewExtension(e.target.value); setNewExtPrice(ex?.price||0); setNewExtDur(ex?.duration||0); if (ex && selectedCourse && newStart) { setNewEnd(minutesToTime(timeToMinutes(newStart) + selectedCourse.duration + ex.duration)); } }} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none cursor-pointer" style={inputStyle}><option value="">延長なし</option>{extensions.map((ex) => (<option key={ex.id} value={ex.name}>{ex.name}（{ex.duration}分 / {fmt(ex.price)}）</option>))}</select></div>
              <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>割引（複数追加可）</label><div className="flex gap-2"><select id="newDiscSelect" className="flex-1 min-w-0 px-3 py-2.5 rounded-xl text-[12px] outline-none cursor-pointer" style={inputStyle}><option value="">— 割引を選択 —</option>{discounts.filter(d => !newDiscounts.some(nd => nd.name === d.name)).map((d) => (<option key={d.id} value={d.name}>{d.name}（{d.type==="percent" ? d.amount+"%" : fmt(d.amount)}）</option>))}</select><button onClick={() => { const sel = (document.getElementById("newDiscSelect") as HTMLSelectElement)?.value; if (!sel) return; const d = discounts.find(x=>x.name===sel); if (!d) return; const amt = d.type==="percent" ? Math.round(cp * d.amount / 100) : d.amount; setNewDiscounts([...newDiscounts, { name: sel, amount: amt }]); (document.getElementById("newDiscSelect") as HTMLSelectElement).value = ""; }} className="flex-shrink-0 px-4 py-2.5 rounded-xl text-[11px] cursor-pointer font-medium" style={{ backgroundColor: "#c4555518", color: "#c45555", border: "1px solid #c4555544" }}>+ 追加</button></div></div>
              {newDiscounts.length > 0 && <div className="flex flex-wrap gap-2">{newDiscounts.map((d, i) => <div key={i} className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-[10px]" style={{ backgroundColor: "#c4555518", color: "#c45555", border: "1px solid #c4555544" }}><span>{d.name}（-{fmt(d.amount)}）</span><button onClick={() => setNewDiscounts(newDiscounts.filter((_, j) => j !== i))} className="cursor-pointer" style={{ background: "none", border: "none", color: "#c45555", fontWeight: 700, padding: 0, fontSize: 12 }}>×</button></div>)}<p className="text-[10px] w-full" style={{ color: "#c45555" }}>割引合計: -{fmt(newDiscTotal)}</p></div>}
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
                  {newDiscounts.map((d,i) => <div key={`disc-${i}`} className="flex justify-between" style={{ color: "#c45555" }}><span>割引: {d.name}</span><span>-{fmt(d.amount)}</span></div>)}
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

      {/* ★ Edit Modal — スタッフ名セレクト追加 */}
      {editRes && (() => {
        const eCp = editSelectedCourse?.price || 0; const eOptT = editOptions.reduce((s,o)=>s+o.price,0); const eDiscTotal = editDiscounts.reduce((s,d)=>s+d.amount,0); const eTotalCalc = eCp + editNomFee + eOptT + editExtPrice - eDiscTotal;
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
              {/* ★追加: 受付スタッフ選択（編集） */}
              <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>👤 受付スタッフ</label><select value={editStaffName} onChange={(e) => setEditStaffName(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none cursor-pointer" style={inputStyle}><option value="">未選択</option>{staffMembers.map((s) => (<option key={s.id} value={s.name}>{s.name}</option>))}</select></div>
              <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>コース <span style={{ color: "#c49885" }}>* 必須</span></label><select value={editCourseId} onChange={(e) => handleCourseChange(Number(e.target.value), true)} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none cursor-pointer" style={inputStyle}><option value={0}>— コースを選択 —</option>{courses.map((c) => (<option key={c.id} value={c.id}>{c.name}（{c.duration}分 / {fmt(c.price)}）</option>))}</select></div>
              {editSelectedCourse && (<div className="rounded-xl p-3 flex items-center gap-4 text-[11px]" style={{ backgroundColor: T.cardAlt }}><span style={{ color: T.textSub }}>料金: <strong style={{ color: T.text }}>{fmt(editSelectedCourse.price)}</strong></span><span style={{ color: T.textSub }}>バック: <strong style={{ color: "#7ab88f" }}>{fmt(editSelectedCourse.therapist_back)}</strong></span></div>)}
              <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>指名</label><select value={editNomination} onChange={(e) => { const n = nominations.find(x=>x.name===e.target.value); setEditNomination(e.target.value); setEditNomFee(n?.price||0); }} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none cursor-pointer" style={inputStyle}><option value="">指名なし</option>{nominations.map((n) => (<option key={n.id} value={n.name}>{n.name}（{fmt(n.price)}）</option>))}</select>{editNomination && <p className="text-[10px] mt-1" style={{ color: "#c3a782" }}>指名料: {fmt(editNomFee)}</p>}</div>
              <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>オプション（複数選択可）</label><div className="flex flex-wrap gap-2">{options.map((o) => { const sel = editOptions.some(x=>x.name===o.name); return <button key={o.id} onClick={() => { if (sel) setEditOptions(editOptions.filter(x=>x.name!==o.name)); else setEditOptions([...editOptions, { name: o.name, price: o.price }]); }} className="px-3 py-1.5 rounded-xl text-[10px] cursor-pointer" style={{ backgroundColor: sel ? "#85a8c418" : T.cardAlt, color: sel ? "#85a8c4" : T.textMuted, border: `1px solid ${sel ? "#85a8c4" : T.border}`, fontWeight: sel ? 600 : 400 }}>{o.name}（{fmt(o.price)}）</button>; })}</div>{editOptions.length > 0 && <p className="text-[10px] mt-1" style={{ color: "#85a8c4" }}>オプション合計: {fmt(eOptT)}</p>}</div>
              <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>延長</label><select value={editExtension} onChange={(e) => { const ex = extensions.find(x=>x.name===e.target.value); setEditExtension(e.target.value); setEditExtPrice(ex?.price||0); setEditExtDur(ex?.duration||0); if (ex && editSelectedCourse && editStart) { setEditEnd(minutesToTime(timeToMinutes(editStart) + editSelectedCourse.duration + ex.duration)); } }} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none cursor-pointer" style={inputStyle}><option value="">延長なし</option>{extensions.map((ex) => (<option key={ex.id} value={ex.name}>{ex.name}（{ex.duration}分 / {fmt(ex.price)}）</option>))}</select></div>
              <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>割引（複数追加可）</label><div className="flex gap-2"><select id="editDiscSelect" className="flex-1 min-w-0 px-3 py-2.5 rounded-xl text-[12px] outline-none cursor-pointer" style={inputStyle}><option value="">— 割引を選択 —</option>{discounts.filter(d => !editDiscounts.some(ed => ed.name === d.name)).map((d) => (<option key={d.id} value={d.name}>{d.name}（{d.type==="percent" ? d.amount+"%" : fmt(d.amount)}）</option>))}</select><button onClick={() => { const sel = (document.getElementById("editDiscSelect") as HTMLSelectElement)?.value; if (!sel) return; const d = discounts.find(x=>x.name===sel); if (!d) return; const amt = d.type==="percent" ? Math.round(eCp * d.amount / 100) : d.amount; setEditDiscounts([...editDiscounts, { name: sel, amount: amt }]); (document.getElementById("editDiscSelect") as HTMLSelectElement).value = ""; }} className="flex-shrink-0 px-4 py-2.5 rounded-xl text-[11px] cursor-pointer font-medium" style={{ backgroundColor: "#c4555518", color: "#c45555", border: "1px solid #c4555544" }}>+ 追加</button></div></div>
              {editDiscounts.length > 0 && <div className="flex flex-wrap gap-2">{editDiscounts.map((d, i) => <div key={i} className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-[10px]" style={{ backgroundColor: "#c4555518", color: "#c45555", border: "1px solid #c4555544" }}><span>{d.name}（-{fmt(d.amount)}）</span><button onClick={() => setEditDiscounts(editDiscounts.filter((_, j) => j !== i))} className="cursor-pointer" style={{ background: "none", border: "none", color: "#c45555", fontWeight: 700, padding: 0, fontSize: 12 }}>×</button></div>)}<p className="text-[10px] w-full" style={{ color: "#c45555" }}>割引合計: -{fmt(eDiscTotal)}</p></div>}
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
                  {editDiscounts.map((d,i) => <div key={`edisc-${i}`} className="flex justify-between" style={{ color: "#c45555" }}><span>割引: {d.name}</span><span>-{fmt(d.amount)}</span></div>)}
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

      {/* Settlement Modal — 以降は変更なし（元のコードと同じ） */}
      {settleTh && (() => {
        const tRes = reservations.filter(r => r.therapist_id === settleTh.id && (r as any).status === "completed");
        const totalSales = tRes.reduce((s,r) => s + ((r as any).total_price || 0), 0);
        const totalBack = tRes.reduce((s,r) => { const c = getCourseByName(r.course); return s + (c?.therapist_back || 0); }, 0);
        const salaryType = (settleTh as any).salary_type || "fixed";
        const salaryAmount = (settleTh as any).salary_amount || 0;
        const salaryBonus = salaryType === "percent" ? Math.round(totalBack * salaryAmount / 100) : salaryAmount * tRes.length;
        const totalNomFee = tRes.reduce((s,r) => s + ((r as any).nomination_fee || 0), 0);
        const totalNom = tRes.reduce((s,r) => { const nom = nominations.find(n => n.name === (r as any).nomination); return s + (nom?.therapist_back || (r as any).nomination_fee || 0); }, 0);
        const totalNomBack = tRes.reduce((s,r) => { const nom = nominations.find(n => n.name === (r as any).nomination); return s + (nom?.back_amount || 0); }, 0);
        const welfareFee = 500;
        const transportFee = (settleTh as any).transport_fee || 0;
        const totalOpt = tRes.reduce((s,r) => s + ((r as any).options_total || 0), 0);
        const totalOptBack = tRes.reduce((s,r) => { const optNames = ((r as any).options_text || "").split(",").filter((n: string) => n); return s + optNames.reduce((os: number, n: string) => { const o = options.find(x => x.name === n); return os + ((o as any)?.therapist_back || 0); }, 0); }, 0);
        const totalExt = tRes.reduce((s,r) => s + ((r as any).extension_price || 0), 0);
        const totalExtBack = tRes.reduce((s,r) => { const ex = extensions.find(x => x.name === (r as any).extension_name); return s + ((ex as any)?.therapist_back || 0); }, 0);
        const totalDisc = tRes.reduce((s,r) => s + ((r as any).discount_amount || 0), 0);
        const totalCard = tRes.reduce((s,r) => s + ((r as any).card_billing || 0), 0);
        const totalPaypay = tRes.reduce((s,r) => s + ((r as any).paypay_amount || 0), 0);
        const totalCash = tRes.reduce((s,r) => s + ((r as any).cash_amount || 0), 0);
        const adj = parseInt(settleAdj) || 0;
        const backTotal = totalBack + salaryBonus + totalNom + totalOptBack + totalExtBack + adj;
        const invoiceDed = settleInvoice ? 0 : Math.round(backTotal * 0.1);
        const adjustedPay = backTotal - invoiceDed;
        const hasWT = settleTh?.has_withholding || false;
        const withholdingBase = hasWT ? Math.max(adjustedPay - 5000, 0) : 0;
        const withholding = hasWT ? Math.floor(withholdingBase * 0.1021) : 0;
        const finalPayRaw = adjustedPay - withholding - welfareFee + transportFee;
        const finalPay = Math.ceil(finalPayRaw / 100) * 100;
        const ra = roomAssigns.find(a => a.therapist_id === settleTh.id);
        const rm = ra ? allRooms.find(r => r.id === ra.room_id) : null;
        const bl = rm ? buildings.find(b => b.id === rm.building_id) : null;
        const todayReplenish = replenishments.filter(r => rm && r.room_id === rm.id).reduce((s, r) => s + r.amount, 0);
        const cashReserve = todayReplenish;
        const carryOverSales = pastUncollected.filter(p => !p.sales_collected).reduce((s, p) => s + (p.total_cash - p.total_back), 0);
        const carryOverChange = pastUncollected.filter(p => !p.change_collected).reduce((s, p) => s + p.replenish_amount, 0);
        const carryOverTotal = carryOverSales + carryOverChange;
        const cashBalance = cashReserve + totalCash - finalPay + carryOverTotal;
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
                  {totalNom > 0 && <div className="flex justify-between"><span>指名バック</span><span>+{fmt(totalNom)}</span></div>}
                  {totalOptBack > 0 && <div className="flex justify-between"><span>オプションバック</span><span>+{fmt(totalOptBack)}</span></div>}
                  {totalExtBack > 0 && <div className="flex justify-between"><span>延長バック</span><span>+{fmt(totalExtBack)}</span></div>}
                  {adj !== 0 && <div className="flex justify-between" style={{ color: adj > 0 ? "#22c55e" : "#c45555" }}><span>調整金{settleAdjNote ? `（${settleAdjNote}）` : ""}</span><span>{adj > 0 ? "+" : ""}{fmt(adj)}</span></div>}
                  <div className="flex justify-between font-bold pt-1" style={{ borderTop: `1px dashed ${T.border}` }}><span>バック額</span><span>{fmt(backTotal)}</span></div>
                  {invoiceDed > 0 && <div className="flex justify-between" style={{ color: "#c45555" }}><span>① インボイス控除（10%）</span><span>-{fmt(invoiceDed)}</span></div>}
                  {invoiceDed > 0 && <div className="flex justify-between"><span>調整後の報酬額</span><span>{fmt(adjustedPay)}</span></div>}
                  {withholding > 0 && <div className="flex justify-between" style={{ color: "#c45555" }}><span>② 源泉徴収（10.21%）</span><span>-{fmt(withholding)}</span></div>}
                  {withholding > 0 && <div className="text-[8px] pl-2" style={{ color: T.textFaint }}>({fmt(adjustedPay)} - ¥5,000) × 10.21%</div>}
                  {!settleTh?.has_withholding && <div className="flex justify-between text-[10px]" style={{ color: T.textFaint }}><span>② 源泉徴収</span><span>なし</span></div>}
                  <div className="flex justify-between" style={{ color: "#c45555" }}><span>③ 備品代・リネン代</span><span>-{fmt(welfareFee)}</span></div>
                  {transportFee > 0 && <div className="flex justify-between" style={{ color: "#22c55e" }}><span>④ 交通費（実費精算分）</span><span>+{fmt(transportFee)}</span></div>}
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
              <div className="rounded-xl p-4" style={{ backgroundColor: "#c3a78212", border: "1px solid #c3a78233" }}>
                <div className="space-y-1 text-[12px]">
                  {finalPayRaw !== finalPay && <div className="flex justify-between text-[10px]" style={{ color: T.textFaint }}><span>計算額</span><span>{fmt(finalPayRaw)}</span></div>}
                  <div className="flex justify-between pt-2 font-bold text-[15px]" style={{ borderTop: "1px solid #c3a78233", color: "#c3a782" }}><span>支給額（100円繰上）</span><span>{fmt(finalPay)}</span></div>
                </div>
              </div>
              {pastUncollected.length > 0 && (
              <div className="rounded-xl p-4" style={{ backgroundColor: "#f59e0b12", border: "1px solid #f59e0b33" }}>
                <p className="text-[10px] font-medium mb-2" style={{ color: "#f59e0b" }}>📦 前日からの引き継ぎ（未回収）</p>
                <div className="space-y-1 text-[11px]">
                  {pastUncollected.map((p, i) => <div key={i} className="flex justify-between text-[10px]"><span>{p.date} {p.therapist_name}</span><span>{!p.sales_collected && <span style={{ color: "#f59e0b" }}>売上+{fmt(p.total_cash - p.total_back)} </span>}{!p.change_collected && <span style={{ color: "#85a8c4" }}>釣銭+{fmt(p.replenish_amount)}</span>}</span></div>)}
                  <div className="flex justify-between pt-1 font-bold" style={{ borderTop: "1px solid #f59e0b33", color: "#f59e0b" }}><span>引き継ぎ合計（売上{fmt(carryOverSales)} + 釣銭{fmt(carryOverChange)}）</span><span>{fmt(carryOverTotal)}</span></div>
                </div>
              </div>
              )}
              {(cashReserve > 0 || carryOverTotal > 0 || totalCash > 0) && (
              <div className="rounded-xl p-4" style={{ backgroundColor: cashBalance < 0 ? "#c4555512" : "#85a8c412", border: `1px solid ${cashBalance < 0 ? "#c4555533" : "#85a8c433"}` }}>
                <p className="text-[10px] font-medium mb-2" style={{ color: T.textSub }}>💴 ルーム内現金（{bl?.name || ""}）</p>
                <div className="space-y-1 text-[11px]">
                  <div className="flex justify-between"><span>準備金（釣銭）</span><span>{fmt(cashReserve)}</span></div>
                  {carryOverTotal > 0 && <div className="flex justify-between" style={{ color: "#f59e0b" }}><span>引き継ぎ分（売上{fmt(carryOverSales)} + 釣銭{fmt(carryOverChange)}）</span><span>+{fmt(carryOverTotal)}</span></div>}
                  <div className="flex justify-between"><span>現金受取（お客様から）</span><span>+{fmt(totalCash)}</span></div>
                  <div className="flex justify-between" style={{ color: "#c45555" }}><span>報酬支払（セラピストへ）</span><span>-{fmt(finalPay)}</span></div>
                  <div className="flex justify-between pt-2 font-bold text-[13px]" style={{ borderTop: `1px solid ${cashBalance < 0 ? "#c4555533" : "#85a8c433"}`, color: cashBalance < 0 ? "#c45555" : "#85a8c4" }}><span>現在の残高</span><span>{fmt(cashBalance)}</span></div>
                  {cashBalance < 0 && <p className="text-[10px] font-medium mt-2 px-2 py-1.5 rounded" style={{ backgroundColor: "#c4555518", color: "#c45555" }}>⚠ 残高がマイナスです。予備金から {fmt(Math.abs(cashBalance))} を補充してください</p>}
                  {storeRecovery > 0 && <div className="flex justify-between mt-2 pt-2" style={{ borderTop: `1px dashed ${T.border}` }}><span>回収額（残高 - 準備金）</span><span className="font-bold" style={{ color: "#22c55e" }}>{fmt(storeRecovery)}</span></div>}
                </div>
                <div className="flex gap-2 mt-3">
                  <button onClick={() => setSettleSalesCollected(!settleSalesCollected)} className="flex-1 px-3 py-2 rounded-xl text-[10px] cursor-pointer" style={{ backgroundColor: settleSalesCollected ? "#22c55e18" : T.cardAlt, color: settleSalesCollected ? "#22c55e" : T.textMuted, border: `1px solid ${settleSalesCollected ? "#22c55e" : T.border}`, fontWeight: settleSalesCollected ? 700 : 400 }}>{settleSalesCollected ? "✅ 売上回収済" : "💴 売上回収"}</button>
                  <button onClick={() => setSettleChangeCollected(!settleChangeCollected)} className="flex-1 px-3 py-2 rounded-xl text-[10px] cursor-pointer" style={{ backgroundColor: settleChangeCollected ? "#22c55e18" : T.cardAlt, color: settleChangeCollected ? "#22c55e" : T.textMuted, border: `1px solid ${settleChangeCollected ? "#22c55e" : T.border}`, fontWeight: settleChangeCollected ? 700 : 400 }}>{settleChangeCollected ? "✅ 釣銭回収済" : "💰 釣銭回収"}</button>
                </div>
                {(settleSalesCollected || settleChangeCollected) && <div className="grid grid-cols-2 gap-2"><button onClick={() => { setSettleSafeDeposited(false); }} className="px-3 py-2.5 rounded-xl text-[10px] cursor-pointer" style={{ backgroundColor: !settleSafeDeposited ? "#22c55e18" : T.cardAlt, color: !settleSafeDeposited ? "#22c55e" : T.textMuted, border: `1px solid ${!settleSafeDeposited ? "#22c55e" : T.border}`, fontWeight: !settleSafeDeposited ? 700 : 400 }}>{!settleSafeDeposited ? "✅ スタッフが回収" : "👤 スタッフが回収"}</button><button onClick={() => { setSettleSafeDeposited(true); }} className="px-3 py-2.5 rounded-xl text-[10px] cursor-pointer" style={{ backgroundColor: settleSafeDeposited ? "#a855f718" : T.cardAlt, color: settleSafeDeposited ? "#a855f7" : T.textMuted, border: `1px solid ${settleSafeDeposited ? "#a855f7" : T.border}`, fontWeight: settleSafeDeposited ? 700 : 400 }}>{settleSafeDeposited ? "✅ 金庫に投函" : "🔐 金庫に投函"}</button></div>}
              </div>
              )}
              <div className="flex gap-3 pt-2">
                <button onClick={async () => { setSettleSaving(true); await supabase.from("therapist_daily_settlements").upsert({ therapist_id: settleTh.id, date: selectedDate, total_sales: totalSales, total_back: totalBack + salaryBonus + totalNom + totalOptBack + totalExtBack, total_nomination: totalNom, total_options: totalOpt, total_extension: totalExt, total_discount: totalDisc, total_card: totalCard, total_paypay: totalPaypay, total_cash: totalCash, order_count: tRes.length, is_settled: true, adjustment: adj, adjustment_note: settleAdjNote.trim(), invoice_deduction: invoiceDed, has_invoice: settleInvoice, withholding_tax: withholding, final_payment: finalPay, welfare_fee: welfareFee, transport_fee: transportFee, room_id: ra?.room_id || 0, sales_collected: settleSalesCollected, change_collected: settleChangeCollected, safe_deposited: settleSafeDeposited }, { onConflict: "therapist_id,date" }); if (ra && settleSalesCollected) { for (const p of pastUncollected) { if (!p.sales_collected) { await supabase.from("therapist_daily_settlements").update({ sales_collected: true }).eq("room_id", ra.room_id).eq("date", p.date).eq("sales_collected", false); } } } if (ra && settleChangeCollected) { for (const p of pastUncollected) { if (!p.change_collected) { await supabase.from("therapist_daily_settlements").update({ change_collected: true }).eq("room_id", ra.room_id).eq("date", p.date).eq("change_collected", false); } } } toast.show("清算を確定しました", "success"); setSettleSaving(false); setSettleTh(null); fetchData(); }} disabled={settleSaving} className="px-5 py-2.5 bg-gradient-to-r from-[#c3a782] to-[#b09672] text-white text-[11px] rounded-xl cursor-pointer disabled:opacity-60">{settleSaving ? "保存中..." : "清算確定"}</button>
                <button onClick={() => setSettleTh(null)} className="px-5 py-2.5 border text-[11px] rounded-xl cursor-pointer" style={{ borderColor: T.border, color: T.textSub }}>閉じる</button>
<button onClick={() => { const store = stores[0]; const th = settleTh; const realName = (th as any)?.real_name || th.name; const hasInv = settleInvoice; const invNum = (th as any)?.therapist_invoice_number || ""; const w = window.open("", "_blank"); if (!w) return; w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>支払通知書_${selectedDate}_${th.name}</title>
<style>body{font-family:'Hiragino Sans','Yu Gothic','Meiryo',sans-serif;max-width:750px;margin:40px auto;padding:30px;color:#222;font-weight:500}h1{text-align:center;font-size:20px;border-bottom:3px double #333;padding-bottom:10px;margin-bottom:5px;letter-spacing:4px}h2{text-align:center;font-size:12px;color:#888;font-weight:normal;margin-bottom:25px}table{width:100%;border-collapse:collapse;margin:15px 0}td,th{border:1px solid #bbb;padding:10px 14px;font-size:13px;font-weight:500}th{background:#f5f0e8;text-align:left;width:38%}.right{text-align:right}.total-row{background:#f9f6f0;font-weight:bold;font-size:14px}.section{margin-top:25px;padding-top:15px;border-top:1px solid #ddd}.company{font-size:11px;line-height:2;color:#555}.note{font-size:9px;color:#888;margin-top:4px;line-height:1.8}.doc-title{font-size:9px;color:#999;text-align:right;margin-bottom:20px}.stamp-area{display:flex;justify-content:space-between;margin-top:40px}.stamp-box{border-top:1px solid #333;width:180px;text-align:center;padding-top:5px;font-size:11px;color:#666}@media print{body{margin:0;padding:20px}}</style></head><body>
<div style="text-align:center;display:flex;gap:10px;justify-content:center;margin-bottom:20px" class="no-print"><button onclick="window.print()" style="padding:8px 20px;background:linear-gradient(to right,#c3a782,#b09672);color:#fff;border:none;border-radius:10px;font-size:12px;cursor:pointer">📄 PDF保存</button><button onclick="saveAsImage()" style="padding:8px 20px;background:linear-gradient(to right,#3b82f6,#2563eb);color:#fff;border:none;border-radius:10px;font-size:12px;cursor:pointer">📥 画像保存</button><button onclick="copyAsImage()" style="padding:8px 20px;background:linear-gradient(to right,#22c55e,#16a34a);color:#fff;border:none;border-radius:10px;font-size:12px;cursor:pointer">📋 コピー</button></div>
<p class="doc-title">業務委託報酬 支払通知書</p>
<h1>支 払 通 知 書</h1>
<h2>業務実施日：${selectedDate}</h2>
<table>
<tr><th>支払を受ける者（氏名）</th><td>${realName}</td></tr>
${realName !== th.name ? `<tr><th>業務上の名称</th><td>${th.name}</td></tr>` : ""}
<tr><th>区分</th><td>${(th as any)?.has_withholding ? "報酬（所得税法第204条第1項第6号）" : "報酬（所得税法第204条第1項第1号）"}</td></tr>
<tr><th>細目</th><td>${(th as any)?.has_withholding ? "ホステス等の業務に関する報酬" : "エステティック施術業務"}</td></tr>
<tr><th>適格請求書発行事業者</th><td>${hasInv ? "登録あり（登録番号：" + invNum + "）" : "未登録"}</td></tr>
</table>
<table>
<tr><th style="width:40%">項目</th><th class="right" style="width:22%">金額</th><th style="width:38%">摘要</th></tr>
<tr><td>基本バック（${tRes.length}件）</td><td class="right">&yen;${totalBack.toLocaleString()}</td><td style="font-size:11px;color:#666">コースバック合計（税込）</td></tr>
${salaryBonus > 0 ? `<tr><td>給料ランク</td><td class="right">+&yen;${salaryBonus.toLocaleString()}</td><td style="font-size:11px;color:#666">${salaryType === "percent" ? salaryAmount + "%UP" : "¥" + salaryAmount.toLocaleString() + "×" + tRes.length + "件"}</td></tr>` : ""}
${totalNom > 0 ? `<tr><td>指名バック</td><td class="right">+&yen;${totalNom.toLocaleString()}</td><td style="font-size:11px;color:#666">指名料（税込）</td></tr>` : ""}
${totalOptBack > 0 ? `<tr><td>オプションバック</td><td class="right">+&yen;${totalOptBack.toLocaleString()}</td><td style="font-size:11px;color:#666">オプション設定バック（税込）</td></tr>` : ""}
${totalExtBack > 0 ? `<tr><td>延長バック</td><td class="right">+&yen;${totalExtBack.toLocaleString()}</td><td style="font-size:11px;color:#666">延長設定バック（税込）</td></tr>` : ""}
${adj !== 0 ? `<tr><td>調整金${settleAdjNote ? "（" + settleAdjNote + "）" : ""}</td><td class="right" style="color:${adj > 0 ? "#22c55e" : "#c45555"}">${adj > 0 ? "+" : ""}&yen;${adj.toLocaleString()}</td><td></td></tr>` : ""}
<tr style="background:#f9f6f0"><td><strong>業務委託報酬（税込）</strong></td><td class="right"><strong>&yen;${backTotal.toLocaleString()}</strong></td><td style="font-size:11px;color:#666">控除前の報酬総額</td></tr>
${invoiceDed > 0 ? `<tr><td style="color:#c45555">仕入税額控除の経過措置</td><td class="right" style="color:#c45555">-&yen;${invoiceDed.toLocaleString()}</td><td style="font-size:11px;color:#666">適格請求書発行事業者以外<br>報酬額の10%を控除</td></tr>
<tr style="background:#f9f6f0"><td>控除後の報酬額</td><td class="right">&yen;${adjustedPay.toLocaleString()}</td><td style="font-size:11px;color:#666">税金計算の基準額</td></tr>` : ""}
${(th as any)?.has_withholding ? `<tr><td style="color:#c45555">源泉徴収税（10.21%）</td><td class="right" style="color:#c45555">-&yen;${withholding.toLocaleString()}</td><td style="font-size:11px;color:#666">（&yen;${adjustedPay.toLocaleString()} − &yen;5,000）× 10.21%<br>所得税及び復興特別所得税</td></tr>` : `<tr><td>源泉徴収税額</td><td class="right">&yen;0</td><td style="font-size:11px;color:#666">源泉徴収対象外</td></tr>`}
<tr><td style="color:#c45555">備品・リネン代</td><td class="right" style="color:#c45555">-&yen;${welfareFee.toLocaleString()}</td><td style="font-size:11px;color:#666">備品・リネン代等</td></tr>
${transportFee > 0 ? `<tr><td>交通費（実費精算分）</td><td class="right" style="color:#22c55e">+&yen;${transportFee.toLocaleString()}</td><td style="font-size:11px;color:#666">源泉対象外</td></tr>` : ""}
<tr class="total-row"><td>差引支給額（100円切上）</td><td class="right" style="color:#c3a782">&yen;${finalPay.toLocaleString()}</td><td style="font-size:11px;color:#666">実際にお渡しする金額</td></tr>
</table>
<div style="display:none">
<table><tr><th>顧客</th><th>コース</th><th class="right">売上（税込）</th></tr>
${tRes.map(r => `<tr><td>${r.customer_name}</td><td>${r.course}</td><td class="right">&yen;${((r as any).total_price || 0).toLocaleString()}</td></tr>`).join("")}
</table></div>
<div style="margin-top:15px">
<p class="note">※ 金額は全て税込（内税方式）で記載しています。</p>
<p class="note">※ 源泉徴収税額は所得税法第204条第1項${(th as any)?.has_withholding ? "第6号" : "第1号"}に基づき計算。${(th as any)?.has_withholding ? "1回の支払につき¥5,000を控除した残額に対し10.21%を適用。" : ""}</p>
${invoiceDed > 0 ? `<p class="note">※ 仕入税額控除の経過措置は、消費税法附則第52条・第53条に基づきます。</p>` : ""}
</div>
<div class="section"><p style="font-size:11px;color:#888;margin-bottom:8px">支払者</p><div class="company"><p><strong>${store?.company_name || ""}</strong></p><p>${store?.company_address || ""}</p><p>TEL: ${store?.company_phone || ""}</p>${store?.invoice_number ? `<p>適格請求書発行事業者登録番号: ${store.invoice_number}</p>` : ""}</div></div>
<div class="stamp-area"><div class="stamp-box">支払者（${store?.company_name || ""}）</div><div class="stamp-box">支払を受ける者（${realName} 様）</div></div>

<script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
<script>function saveAsImage(){var btns=document.querySelector('.no-print');btns.style.display='none';html2canvas(document.querySelector('body'),{scale:2,useCORS:true,width:750,windowWidth:750}).then(function(c){btns.style.display='flex';var a=document.createElement('a');a.download='支払通知書_${selectedDate}_${th.name}.png';a.href=c.toDataURL('image/png');a.click();})}function copyAsImage(){var btns=document.querySelector('.no-print');btns.style.display='none';html2canvas(document.querySelector('body'),{scale:2,useCORS:true,width:750,windowWidth:750}).then(function(c){btns.style.display='flex';c.toBlob(function(b){navigator.clipboard.write([new ClipboardItem({'image/png':b})]).then(function(){alert('クリップボードにコピーしました！LINEやメールに貼り付けできます。')})});})}</script>
<style>@media print{.no-print{display:none!important}}</style>
</body></html>`); w.document.close(); }} className="px-5 py-2.5 border text-[11px] rounded-xl cursor-pointer" style={{ borderColor: "#85a8c444", color: "#85a8c4" }}>📄 通知書</button>
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

      {/* Safe/Daily/Replenish/Break/Shift/Room/AddShift Modals は元のコードと同じため省略 */}
      {/* 以下、元のコードのモーダル部分をそのまま配置 */}

{/* Safe List Modal */}
      {showSafeList && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowSafeList(false)}>
          <div className="rounded-2xl border p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto animate-[fadeIn_0.25s]" style={{ backgroundColor: T.card, borderColor: T.border }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div><h2 className="text-[16px] font-medium">🔐 金庫管理</h2><p className="text-[11px]" style={{ color: T.textFaint }}>投函・回収の一覧</p></div>
              <button onClick={() => setShowSafeList(false)} className="text-[18px] cursor-pointer" style={{ color: T.textMuted, background: "none", border: "none" }}>&times;</button>
            </div>
            <div className="space-y-4">
              <div className="rounded-xl p-4" style={{ backgroundColor: "#a855f712", border: "1px solid #a855f733" }}>
                <p className="text-[10px] font-medium mb-2" style={{ color: "#a855f7" }}>未回収（金庫内）</p>
                {safeUncollected.length === 0 ? <p className="text-[11px] text-center py-3" style={{ color: T.textFaint }}>金庫に未回収の投函はありません</p> : (
                <div className="space-y-1">
                  {safeUncollected.map(s => {
                    const netCash = s.total_cash - s.total_back;
                    const safeAmount = (netCash > 0 ? netCash : 0) + s.replenish;
                    return <div key={s.id} className="flex items-center justify-between py-1.5 px-3 rounded-lg text-[11px]" style={{ backgroundColor: T.cardAlt }}>
                      <span>{s.date.slice(5)} {s.therapist_name} <span style={{ color: T.textFaint, fontSize: 9 }}>({s.room_label})</span></span>
                      <div className="flex items-center gap-2">
                        <span style={{ color: "#a855f7", fontWeight: 700 }}>{fmt(safeAmount)}</span>
                        <button onClick={async () => { if (!confirm(`${s.therapist_name}の${fmt(safeAmount)}を回収しますか？`)) return; const today = new Date().toISOString().split("T")[0]; await supabase.from("therapist_daily_settlements").update({ safe_collected_date: today }).eq("id", s.id); toast.show(`${s.therapist_name}の${fmt(safeAmount)}を回収しました`, "success"); setSafeUncollected(prev => prev.filter(x => x.id !== s.id)); }} className="text-[8px] px-2 py-1 rounded cursor-pointer" style={{ backgroundColor: "#a855f718", color: "#a855f7", border: "1px solid #a855f744" }}>回収</button>
                      </div>
                    </div>;
                  })}
                  <div className="flex justify-between font-bold text-[13px] pt-2" style={{ borderTop: "1px solid #a855f733", color: "#a855f7" }}>
                    <span>金庫内合計</span>
                    <span>{fmt(safeUncollected.reduce((s, x) => { const n = x.total_cash - x.total_back; return s + (n > 0 ? n : 0) + x.replenish; }, 0))}</span>
                  </div>
                  <button onClick={async () => { if (!confirm("金庫内の全額を回収しますか？")) return; const today = new Date().toISOString().split("T")[0]; for (const s of safeUncollected) { await supabase.from("therapist_daily_settlements").update({ safe_collected_date: today }).eq("id", s.id); } toast.show("金庫の全額を回収しました", "success"); setSafeUncollected([]); }} className="w-full px-3 py-2 bg-gradient-to-r from-[#a855f7] to-[#9333ea] text-white text-[11px] rounded-xl cursor-pointer font-medium mt-2">📦 全額回収</button>
                </div>
                )}
              </div>
              
            <div className="rounded-xl p-4" style={{ backgroundColor: T.cardAlt }}>
                <p className="text-[10px] font-medium mb-2" style={{ color: "#22c55e" }}>回収履歴（直近20件）</p>
                {safeHistory.length === 0 ? <p className="text-[11px] text-center py-3" style={{ color: T.textFaint }}>回収履歴はありません</p> : (
                <div className="space-y-1">
                  {safeHistory.map(s => {
                    const netCash = s.total_cash - s.total_back;
                    const safeAmount = (netCash > 0 ? netCash : 0) + s.replenish;
                    return <div key={s.id} className="flex items-center justify-between py-1 px-2 text-[10px]">
                      <span style={{ color: T.textSub }}><span style={{ color: "#22c55e" }}>回収{s.safe_collected_date?.slice(5)}</span> | 投函{s.date.slice(5)} {s.therapist_name} <span style={{ fontSize: 8, color: T.textFaint }}>({s.room_label})</span></span>
                      <div className="flex items-center gap-2">
                        <span style={{ color: "#22c55e" }}>{fmt(safeAmount)}</span>
                        <button onClick={async () => { if (!confirm("この回収を取り消しますか？")) return; await supabase.from("therapist_daily_settlements").update({ safe_collected_date: null }).eq("id", s.id); toast.show("回収を取り消しました", "info"); setSafeHistory(prev => prev.filter(x => x.id !== s.id)); setSafeUncollected(prev => [...prev, { id: s.id, therapist_id: 0, date: s.date, total_cash: s.total_cash, total_back: s.total_back, room_id: s.room_id, therapist_name: s.therapist_name, room_label: s.room_label, replenish: s.replenish }]); }} className="text-[7px] px-1.5 py-0.5 rounded cursor-pointer" style={{ backgroundColor: "#c4555512", color: "#c45555", border: "none" }}>取消</button>
                      </div>
                    </div>;
                  })}
                </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Daily Summary Modal */}
      {showDailySummary && (() => {
        const compRes = reservations.filter(r => (r as any).status === "completed");
        const totalSales = compRes.reduce((s, r) => s + ((r as any).total_price || 0), 0);
        const totalCard = compRes.reduce((s, r) => s + ((r as any).card_billing || 0), 0);
        const totalPaypay = compRes.reduce((s, r) => s + ((r as any).paypay_amount || 0), 0);
        const totalCashSales = compRes.reduce((s, r) => s + ((r as any).cash_amount || 0), 0);
        const totalBack = compRes.reduce((s, r) => { const c = getCourseByName(r.course); return s + (c?.therapist_back || 0); }, 0);
        const totalNom = compRes.reduce((s, r) => s + ((r as any).nomination_fee || 0), 0);
        const totalOpt = compRes.reduce((s, r) => s + ((r as any).options_total || 0), 0);
        const totalExt = compRes.reduce((s, r) => s + ((r as any).extension_price || 0), 0);
        const totalDisc = compRes.reduce((s, r) => s + ((r as any).discount_amount || 0), 0);
        const totalReplenish = replenishments.reduce((s, r) => s + r.amount, 0);
        const settledTherapists = therapists.filter(t => {
          const ra = roomAssigns.find(a => a.therapist_id === t.id);
          return ra && shiftTherapistIds.has(t.id);
        });
        const profit = totalSales - totalBack;
        return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowDailySummary(false)}>
          <div className="rounded-2xl border p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto animate-[fadeIn_0.25s]" style={{ backgroundColor: T.card, borderColor: T.border }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div><h2 className="text-[16px] font-medium">📊 日次集計</h2><p className="text-[11px]" style={{ color: T.textFaint }}>{selectedDate}</p></div>
              <button onClick={() => setShowDailySummary(false)} className="text-[18px] cursor-pointer" style={{ color: T.textMuted, background: "none", border: "none" }}>&times;</button>
            </div>
            <div className="space-y-3">
              <div className="rounded-xl p-4" style={{ backgroundColor: "#c3a78212", border: "1px solid #c3a78233" }}>
                <p className="text-[10px] font-medium mb-2" style={{ color: "#c3a782" }}>売上サマリー</p>
                <div className="space-y-1 text-[12px]">
                  <div className="flex justify-between"><span style={{ color: T.textSub }}>予約件数</span><span>{reservations.length}件</span></div>
                  <div className="flex justify-between"><span style={{ color: T.textSub }}>終了件数</span><span style={{ color: "#c3a782" }}>{compRes.length}件</span></div>
                  <div className="flex justify-between pt-2 font-bold text-[15px]" style={{ borderTop: "1px solid #c3a78233", color: "#c3a782" }}><span>総売上</span><span>{fmt(totalSales)}</span></div>
                </div>
              </div>
              <div className="rounded-xl p-4" style={{ backgroundColor: T.cardAlt }}>
                <p className="text-[10px] font-medium mb-2" style={{ color: T.textSub }}>売上内訳</p>
                <div className="space-y-1 text-[12px]">
                  <div className="flex justify-between"><span style={{ color: T.textSub }}>指名料合計</span><span>+{fmt(totalNom)}</span></div>
                  <div className="flex justify-between"><span style={{ color: T.textSub }}>オプション合計</span><span>+{fmt(totalOpt)}</span></div>
                  <div className="flex justify-between"><span style={{ color: T.textSub }}>延長合計</span><span>+{fmt(totalExt)}</span></div>
                  {totalDisc > 0 && <div className="flex justify-between" style={{ color: "#c45555" }}><span>割引合計</span><span>-{fmt(totalDisc)}</span></div>}
                </div>
              </div>
              <div className="rounded-xl p-4" style={{ backgroundColor: T.cardAlt }}>
                <p className="text-[10px] font-medium mb-2" style={{ color: T.textSub }}>支払い方法別</p>
                <div className="space-y-1 text-[12px]">
                  <div className="flex justify-between"><span style={{ color: "#85a8c4" }}>💳 カード決済</span><span>{fmt(totalCard)}</span></div>
                  <div className="flex justify-between"><span style={{ color: "#22c55e" }}>📱 PayPay</span><span>{fmt(totalPaypay)}</span></div>
                  <div className="flex justify-between"><span style={{ color: "#f59e0b" }}>💴 現金</span><span>{fmt(totalCashSales)}</span></div>
                </div>
              </div>
              <div className="rounded-xl p-4" style={{ backgroundColor: T.cardAlt }}>
                <p className="text-[10px] font-medium mb-2" style={{ color: T.textSub }}>セラピスト支払い</p>
                <div className="space-y-1 text-[12px]">
                  <div className="flex justify-between"><span style={{ color: T.textSub }}>バック合計</span><span style={{ color: "#c45555" }}>-{fmt(totalBack)}</span></div>
                </div>
              </div>
              <div className="rounded-xl p-4" style={{ backgroundColor: T.cardAlt }}>
                <p className="text-[10px] font-medium mb-2" style={{ color: T.textSub }}>釣銭状況</p>
                <div className="space-y-1 text-[12px]">
                  <div className="flex justify-between"><span style={{ color: T.textSub }}>本日の補充合計</span><span style={{ color: "#22c55e" }}>{fmt(totalReplenish)}</span></div>
                </div>
              </div>
              <div className="rounded-xl p-4" style={{ backgroundColor: T.cardAlt }}>
                <p className="text-[10px] font-medium mb-2" style={{ color: T.textSub }}>経費・支出</p>
                <div className="space-y-1 text-[12px]">
                  {dailyExpenses.filter(e => e.type === "expense").length > 0 ? dailyExpenses.filter(e => e.type === "expense").map(e => <div key={e.id} className="flex justify-between"><span style={{ color: T.textSub }}>{e.category}: {e.name}</span><span style={{ color: "#c45555" }}>-{fmt(e.amount)}</span></div>) : <p className="text-[10px]" style={{ color: T.textFaint }}>本日の経費はありません</p>}
                  {dailyExpenses.filter(e => e.type === "expense").length > 0 && <div className="flex justify-between pt-1 font-bold" style={{ borderTop: `1px solid ${T.border}` }}><span>経費合計</span><span style={{ color: "#c45555" }}>-{fmt(dailyExpenses.filter(e => e.type === "expense").reduce((s, e) => s + e.amount, 0))}</span></div>}
                </div>
              </div>
              {dailyExpenses.filter(e => e.type === "income").length > 0 && (
              <div className="rounded-xl p-4" style={{ backgroundColor: T.cardAlt }}>
                <p className="text-[10px] font-medium mb-2" style={{ color: T.textSub }}>入金</p>
                <div className="space-y-1 text-[12px]">
                  {dailyExpenses.filter(e => e.type === "income").map(e => <div key={e.id} className="flex justify-between"><span style={{ color: T.textSub }}>{e.category}: {e.name}</span><span style={{ color: "#22c55e" }}>+{fmt(e.amount)}</span></div>)}
                  <div className="flex justify-between pt-1 font-bold" style={{ borderTop: `1px solid ${T.border}` }}><span>入金合計</span><span style={{ color: "#22c55e" }}>+{fmt(dailyExpenses.filter(e => e.type === "income").reduce((s, e) => s + e.amount, 0))}</span></div>
                </div>
              </div>
              )}
              <div className="rounded-xl p-4" style={{ backgroundColor: "#22c55e12", border: "1px solid #22c55e33" }}>
                <p className="text-[10px] font-medium mb-2" style={{ color: "#22c55e" }}>本日の収支</p>
                {(() => { const expTotal = dailyExpenses.filter(e => e.type === "expense").reduce((s, e) => s + e.amount, 0); const incTotal = dailyExpenses.filter(e => e.type === "income").reduce((s, e) => s + e.amount, 0); const netProfit = totalSales - totalBack - expTotal + incTotal; return (
                <div className="space-y-1 text-[12px]">
                  <div className="flex justify-between"><span>売上</span><span>{fmt(totalSales)}</span></div>
                  <div className="flex justify-between" style={{ color: "#c45555" }}><span>セラピスト支払い</span><span>-{fmt(totalBack)}</span></div>
                  {expTotal > 0 && <div className="flex justify-between" style={{ color: "#c45555" }}><span>経費</span><span>-{fmt(expTotal)}</span></div>}
                  {incTotal > 0 && <div className="flex justify-between" style={{ color: "#22c55e" }}><span>入金</span><span>+{fmt(incTotal)}</span></div>}
                  <div className="flex justify-between pt-2 font-bold text-[15px]" style={{ borderTop: "1px solid #22c55e33", color: "#22c55e" }}><span>粗利</span><span>{fmt(netProfit)}</span></div>
                </div>); })()}
              </div>
              <div className="rounded-xl p-4" style={{ backgroundColor: "#f59e0b12", border: "1px solid #f59e0b33" }}>
                <p className="text-[10px] font-medium mb-3" style={{ color: "#f59e0b" }}>💴 現金確認シート</p>
                {(() => { const expTotal = dailyExpenses.filter(e => e.type === "expense").reduce((s, e) => s + e.amount, 0); const incTotal = dailyExpenses.filter(e => e.type === "income").reduce((s, e) => s + e.amount, 0);
                const therapistData = [...activeTherapists, ...clockedOutTherapists].map(t => {
                  const tRes = compRes.filter(r => r.therapist_id === t.id); if (tRes.length === 0) return null;
                  const tCash = tRes.reduce((s, r) => s + ((r as any).cash_amount || 0), 0);
                  const tBack = tRes.reduce((s, r) => { const c = getCourseByName(r.course); return s + (c?.therapist_back || 0); }, 0);
                  const ra = roomAssigns.find(a => a.therapist_id === t.id);
                  const rm = ra ? allRooms.find(r => r.id === ra.room_id) : null;
                  const bl = rm ? buildings.find(b => b.id === rm.building_id) : null;
                  return { id: t.id, name: t.name, room: bl && rm ? `${bl.name}${rm.name}` : "", cash: tCash, back: tBack, net: tCash - tBack };
                }).filter(Boolean) as { id: number; name: string; room: string; cash: number; back: number; net: number }[];
                const totalOut = totalReplenish + totalBack + expTotal;
                const staffCollectedAmount = therapistData.filter(t => { const ds = dailySettlements.find(d => d.therapist_id === t.id); return !!ds?.sales_collected && !ds?.safe_deposited; }).reduce((s, t) => s + t.net, 0);
                const safeDepositedAmount = therapistData.filter(t => { const ds = dailySettlements.find(d => d.therapist_id === t.id); return !!ds?.sales_collected && !!ds?.safe_deposited; }).reduce((s, t) => s + t.net, 0);
                const totalUncollected = therapistData.filter(t => { const ds = dailySettlements.find(d => d.therapist_id === t.id); return !ds?.sales_collected; }).reduce((s, t) => s + t.net, 0);
                const cashOnHand = -totalReplenish - totalBack - expTotal + incTotal + staffCollectedAmount;
                return (
                <div className="space-y-1 text-[12px]">
                  <p className="text-[9px] font-medium" style={{ color: "#c45555" }}>出金（事務所から出たお金）</p>
                  <div className="flex justify-between"><span>釣銭補充（ルームへ）</span><span style={{ color: "#c45555" }}>-{fmt(totalReplenish)}</span></div>
                  <div className="flex justify-between"><span>セラピスト支払い（バック）</span><span style={{ color: "#c45555" }}>-{fmt(totalBack)}</span></div>
                  {expTotal > 0 && <div className="flex justify-between"><span>経費</span><span style={{ color: "#c45555" }}>-{fmt(expTotal)}</span></div>}
                  <div className="flex justify-between font-bold pt-1" style={{ borderTop: `1px dashed ${T.border}`, color: "#c45555" }}><span>出金合計</span><span>-{fmt(totalOut)}</span></div>
                  {incTotal > 0 && (<><p className="text-[9px] font-medium mt-2" style={{ color: "#22c55e" }}>入金</p><div className="flex justify-between"><span>入金合計</span><span style={{ color: "#22c55e" }}>+{fmt(incTotal)}</span></div></>)}
                  <p className="text-[9px] font-medium mt-3" style={{ color: "#f59e0b" }}>ルーム別 現金状況（未回収 = 事務所にまだ戻っていない）</p>
                  {therapistData.map((t, i) => { const ds = dailySettlements.find(d => d.therapist_id === t.id); const collected = !!ds?.sales_collected; const inSafe = !!ds?.safe_deposited; return <div key={i} className="flex justify-between py-0.5"><span>{t.name} <span style={{ color: T.textFaint, fontSize: 9 }}>({t.room})</span></span><span>{fmt(t.net)} {collected && !inSafe ? <span style={{ color: "#22c55e", fontSize: 9, fontWeight: 700 }}>✅ スタッフ回収</span> : collected && inSafe ? <span style={{ color: "#a855f7", fontSize: 9, fontWeight: 700 }}>🔐 金庫投函</span> : <span style={{ color: "#c45555", fontSize: 9 }}>未回収</span>}</span></div>; })}
                  <div className="flex justify-between font-bold pt-1" style={{ borderTop: `1px dashed ${T.border}`, color: "#f59e0b" }}><span>未回収合計（ルームにある現金）</span><span>{fmt(therapistData.filter(t => { const ds = dailySettlements.find(d => d.therapist_id === t.id); return !ds?.sales_collected; }).reduce((s, t) => s + t.net, 0))}</span></div>
                  {(() => { const safeSales = therapistData.filter(t => { const ds = dailySettlements.find(d => d.therapist_id === t.id); return !!ds?.sales_collected && !!ds?.safe_deposited; }).reduce((s, t) => s + t.net, 0); const safeChange = therapistData.filter(t => { const ds = dailySettlements.find(d => d.therapist_id === t.id); return !!ds?.sales_collected && !!ds?.safe_deposited; }).length > 0 ? totalReplenish : 0; const safeTotal = safeSales + safeChange; return safeTotal > 0 ? <div className="flex justify-between font-bold pt-1" style={{ borderTop: `1px dashed ${T.border}`, color: "#a855f7" }}><span>🔐 金庫未回収合計（売上{fmt(safeSales)} + 釣銭{fmt(safeChange)}）</span><span>{fmt(safeTotal)}</span></div> : null; })()}
                  {pastCollected.length > 0 && (<>
                    <p className="text-[9px] font-medium mt-3" style={{ color: "#22c55e" }}>過去の引き継ぎ回収分（本日回収済み）</p>
                    {pastCollected.map((p, i) => { const rm2 = allRooms.find(r => r.id === p.room_id); const bl2 = rm2 ? buildings.find(b => b.id === rm2.building_id) : null; return <div key={i} className="flex justify-between py-0.5"><span style={{ color: T.textSub }}>{p.date.slice(5)} <span style={{ fontSize: 9 }}>{bl2?.name || ""}{rm2?.name || ""} {p.therapist_name}</span></span><span style={{ color: "#22c55e" }}>売上+{fmt(p.total_cash - p.total_back)} 釣銭+{fmt(p.replenish)}</span></div>; })}
                    <div className="flex justify-between font-bold pt-1" style={{ borderTop: `1px dashed ${T.border}`, color: "#22c55e" }}><span>過去回収合計</span><span>+{fmt(pastCollected.reduce((s, p) => s + (p.total_cash - p.total_back) + p.replenish, 0))}</span></div>
                  </>)}
                  {safeCollectedToday.length > 0 && (<>
                    <p className="text-[9px] font-medium mt-3" style={{ color: "#a855f7" }}>🔐 金庫回収分（本日回収）</p>
                    {safeCollectedToday.map((s, i) => { const rm3 = allRooms.find(r => r.id === s.room_id); const bl3 = rm3 ? buildings.find(b => b.id === rm3.building_id) : null; const net3 = s.total_cash - s.total_back; return <div key={i} className="flex justify-between py-0.5"><span style={{ color: T.textSub }}>{s.date.slice(5)} {bl3?.name || ""}{rm3?.name || ""} {s.therapist_name}</span><span style={{ color: "#a855f7" }}>+{fmt((net3 > 0 ? net3 : 0) + s.replenish)}</span></div>; })}
                    <div className="flex justify-between font-bold pt-1" style={{ borderTop: `1px dashed ${T.border}`, color: "#a855f7" }}><span>金庫回収合計</span><span>+{fmt(safeCollectedToday.reduce((s, x) => { const n = x.total_cash - x.total_back; return s + (n > 0 ? n : 0) + x.replenish; }, 0))}</span></div>
                  </>)}
                  {(() => { const pastRecovered = pastCollected.reduce((s, p) => s + (p.total_cash - p.total_back) + p.replenish, 0); const safeRecovered = safeCollectedToday.reduce((s, x) => { const n = x.total_cash - x.total_back; return s + (n > 0 ? n : 0) + x.replenish; }, 0); const finalCash = cashOnHand + pastRecovered + safeRecovered; return (
                  <div className="pt-3 mt-2" style={{ borderTop: "2px solid #f59e0b44" }}>
                    <div className="flex justify-between font-bold text-[15px]"><span style={{ color: "#f59e0b" }}>💴 事務所の残金</span><span style={{ color: finalCash >= 0 ? "#22c55e" : "#c45555" }}>{fmt(finalCash)}</span></div>
                    <p className="text-[9px] mt-1" style={{ color: T.textFaint }}>※ 未回収の売上はルームにあるため含まれません。回収後に事務所の残金が増えます。</p>
                    {safeDepositedAmount > 0 && <div className="flex justify-between mt-1 text-[12px]"><span style={{ color: "#a855f7" }}>🔐 金庫回収後の残金</span><span style={{ color: "#a855f7", fontWeight: 700 }}>{fmt(finalCash + safeDepositedAmount)}</span></div>}
                    {totalUncollected > 0 && <div className="flex justify-between mt-1 text-[12px]"><span style={{ color: "#22c55e" }}>全額回収後の残金</span><span style={{ color: "#22c55e", fontWeight: 700 }}>{fmt(finalCash + safeDepositedAmount + totalUncollected)}</span></div>}
                  </div>); })()}
                </div>); })()}
              </div>
              <div className="rounded-xl p-4" style={{ backgroundColor: T.cardAlt }}>
                <p className="text-[10px] font-medium mb-2" style={{ color: T.textSub }}>セラピスト別売上</p>
                <div className="space-y-1 text-[11px]">
                  {[...activeTherapists, ...clockedOutTherapists].map(t => {
                    const tRes = compRes.filter(r => r.therapist_id === t.id);
                    if (tRes.length === 0) return null;
                    const tSales = tRes.reduce((s, r) => s + ((r as any).total_price || 0), 0);
                    const tBack = tRes.reduce((s, r) => { const c = getCourseByName(r.course); return s + (c?.therapist_back || 0); }, 0);
                    return <div key={t.id} className="flex justify-between py-0.5"><span>{t.name}（{tRes.length}件）</span><span>売上{fmt(tSales)} / バック{fmt(tBack)}</span></div>;
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>);
      })()}

      {/* Replenish Modal */}
      {showReplenish && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowReplenish(null)}>
          <div className="rounded-2xl border p-6 w-full max-w-xs animate-[fadeIn_0.25s]" style={{ backgroundColor: T.card, borderColor: T.border }} onClick={(e) => e.stopPropagation()}>
            <h2 className="text-[15px] font-medium mb-2">💰 釣銭補充</h2>
            <p className="text-[11px] mb-3" style={{ color: T.textFaint }}>{allRooms.find(r => r.id === showReplenish)?.name || ""} — {selectedDate}</p>
            <div className="space-y-3">
              <div><label className="block text-[10px] mb-1" style={{ color: T.textSub }}>担当スタッフ</label><div className="flex flex-wrap gap-2">{staffMembers.map(s => (<button key={s.id} onClick={() => setReplenishStaff(s.name)} className="px-3 py-1.5 rounded-xl text-[11px] cursor-pointer" style={{ backgroundColor: replenishStaff === s.name ? "#85a8c422" : T.cardAlt, color: replenishStaff === s.name ? "#85a8c4" : T.textMuted, border: `1px solid ${replenishStaff === s.name ? "#85a8c4" : T.border}`, fontWeight: replenishStaff === s.name ? 700 : 400 }}>{s.name}</button>))}</div></div>
              <div><label className="block text-[10px] mb-1" style={{ color: T.textSub }}>補充金額</label><input type="text" inputMode="numeric" value={replenishAmount} onChange={(e) => setReplenishAmount(e.target.value.replace(/[^0-9]/g, ""))} placeholder="20000" className="w-full px-3 py-2.5 rounded-xl text-[14px] font-bold outline-none text-center" style={inputStyle} /></div>
              <div className="flex flex-wrap gap-2">{[10000, 15000, 20000, 30000, 50000].map(v => (<button key={v} onClick={() => setReplenishAmount(String(v))} className="px-3 py-1.5 rounded-xl text-[11px] cursor-pointer" style={{ backgroundColor: replenishAmount === String(v) ? "#22c55e22" : T.cardAlt, color: replenishAmount === String(v) ? "#22c55e" : T.textMuted, border: `1px solid ${replenishAmount === String(v) ? "#22c55e" : T.border}` }}>{fmt(v)}</button>))}</div>
              <div className="flex gap-3 pt-2">
                <button onClick={async () => { const amt = parseInt(replenishAmount) || 0; if (amt <= 0) return; await supabase.from("room_cash_replenishments").insert({ room_id: showReplenish, date: selectedDate, amount: amt, therapist_id: replenishTherapistId, staff_name: replenishStaff }); toast.show(`${fmt(amt)} を補充しました`, "success"); setShowReplenish(null); fetchData(); }} className="px-5 py-2.5 bg-gradient-to-r from-[#22c55e] to-[#16a34a] text-white text-[11px] rounded-xl cursor-pointer">補充する</button>
                <button onClick={() => setShowReplenish(null)} className="px-5 py-2.5 border text-[11px] rounded-xl cursor-pointer" style={{ borderColor: T.border, color: T.textSub }}>キャンセル</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Break Modal */}
      {showBreakModal && (() => {
        const bTh = therapists.find(t => t.id === showBreakModal);
        const bEndMin = timeToMinutes(breakStart) + breakDuration;
        const bEnd = minutesToTime(bEndMin);
        return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowBreakModal(null)}>
          <div className="rounded-2xl border p-6 w-full max-w-xs animate-[fadeIn_0.25s]" style={{ backgroundColor: T.card, borderColor: T.border }} onClick={(e) => e.stopPropagation()}>
            <h2 className="text-[15px] font-medium mb-2">☕ 休憩追加</h2>
            <p className="text-[11px] mb-4" style={{ color: T.textFaint }}>{bTh?.name}</p>
            <div className="space-y-3">
              <div><label className="block text-[10px] mb-1" style={{ color: T.textSub }}>開始時間</label><select value={breakStart} onChange={(e) => setBreakStart(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none cursor-pointer" style={inputStyle}>{TIMES_10MIN.map((t) => (<option key={t} value={t}>{minutesToDisplay(timeToMinutes(t))}</option>))}</select></div>
              <div><label className="block text-[10px] mb-1" style={{ color: T.textSub }}>休憩時間</label><div className="flex flex-wrap gap-2">{[10, 15, 20, 30, 45, 60].map(d => (<button key={d} onClick={() => setBreakDuration(d)} className="px-3 py-2 rounded-xl text-[12px] cursor-pointer" style={{ backgroundColor: breakDuration === d ? "#a855f722" : T.cardAlt, color: breakDuration === d ? "#a855f7" : T.textMuted, border: `1px solid ${breakDuration === d ? "#a855f7" : T.border}`, fontWeight: breakDuration === d ? 700 : 400 }}>{d}分</button>))}</div></div>
              <p className="text-[11px] text-center py-2" style={{ color: "#a855f7" }}>☕ {breakStart?.slice(0,5)} 〜 {minutesToDisplay(bEndMin)}（{breakDuration}分間）</p>
              <div className="flex gap-3">
                <button onClick={() => { setBreaks(prev => [...prev, { id: nextBreakId, therapist_id: showBreakModal, start: breakStart, end: bEnd, label: "休憩" }]); setNextBreakId(prev => prev + 1); setShowBreakModal(null); }} className="px-5 py-2.5 bg-gradient-to-r from-[#a855f7] to-[#9333ea] text-white text-[11px] rounded-xl cursor-pointer">追加する</button>
                <button onClick={() => setShowBreakModal(null)} className="px-5 py-2.5 border text-[11px] rounded-xl cursor-pointer" style={{ borderColor: T.border, color: T.textSub }}>キャンセル</button>
              </div>
            </div>
          </div>
        </div>);
      })()}

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
