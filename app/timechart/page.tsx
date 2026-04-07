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
  const [newCustPhone, setNewCustPhone] = useState("");
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
  const [editCustPhone, setEditCustPhone] = useState("");
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
  const [editCustomerStatus, setEditCustomerStatus] = useState("unsent");
  const [editTherapistStatus, setEditTherapistStatus] = useState("unsent");
  const [editCardBase, setEditCardBase] = useState("");
  const [editPaypay, setEditPaypay] = useState("");
  const [editStaffName, setEditStaffName] = useState("");
  const [editManualPoints, setEditManualPoints] = useState("");
  const [editManualPointDesc, setEditManualPointDesc] = useState("");
  const [ptSettings, setPtSettings] = useState<{earn_per_yen:number;earn_points:number;expiry_months:number;rainy_day_active:boolean;rainy_day_multiplier:number}|null>(null);
  const [editMsg, setEditMsg] = useState("");

  const [showNewTherapist, setShowNewTherapist] = useState(false);
  const [showStatusList, setShowStatusList] = useState(false);
  const [statusListTab, setStatusListTab] = useState<"therapist"|"customer">("therapist");
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
  const [showReplenish, setShowReplenish] = useState<number | null>(null);
  const [settledIds, setSettledIds] = useState<Set<number>>(new Set());
  const [changeCollectedIds, setChangeCollectedIds] = useState<Set<number>>(new Set());
  const [replenishAmount, setReplenishAmount] = useState("");
  const [replenishStaff, setReplenishStaff] = useState("");
  const [replenishTherapistId, setReplenishTherapistId] = useState(0);
  const [staffMembers, setStaffMembers] = useState<{ id: number; name: string; role: string }[]>([]);
  const [dailySettlements, setDailySettlements] = useState<{ therapist_id: number; sales_collected: boolean; change_collected: boolean; total_cash: number; total_back: number; room_id: number; safe_deposited: boolean }[]>([]);

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
  const [newStaffName, setNewStaffName] = useState(() => typeof window !== "undefined" ? localStorage.getItem("last_staff_name") || "" : "");

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

  // Shift request notifications
  type ShiftReq = { id: number; therapist_id: number; date: string; start_time: string; end_time: string; store_id: number; notes: string; status: string; updated_at: string; week_start: string };
  const [pendingShiftReqs, setPendingShiftReqs] = useState<ShiftReq[]>([]);
  const [showShiftNotif, setShowShiftNotif] = useState(false);

  // Reservation notification
  type NotifyInfo = { resId?: number; custName: string; custPhone: string; custEmail: string; hasLine: boolean; isMember: boolean; date: string; startTime: string; endTime: string; course: string; therapistName: string; total: number; nomination: string; discountName: string; extensionName: string; storeName: string; buildingName: string };
  const [notifyInfo, setNotifyInfo] = useState<NotifyInfo | null>(null);
  const [notifySender, setNotifySender] = useState(() => typeof window !== "undefined" ? localStorage.getItem("notify_sender") || "" : "");
  const [notifyTab, setNotifyTab] = useState<"staff"|"customer">("customer");
  const [notifyMode, setNotifyMode] = useState<"summary"|"detail">("summary");
  // DB templates
  type NtTemplate = { template_key: string; body: string };
  const [ntTemplates, setNtTemplates] = useState<NtTemplate[]>([]);
  const [ntUrlDays, setNtUrlDays] = useState(1);
  const [ntLocToyohashi, setNtLocToyohashi] = useState("https://quiet-banana-895.notion.site/2f4db1122fba80fb931afe6989118990");
  const [ntLocMycourt, setNtLocMycourt] = useState("https://quiet-banana-895.notion.site/2f4db1122fba8020b500c46883464fd7?pvs=73");
  const [ntLocOasis, setNtLocOasis] = useState("https://quiet-banana-895.notion.site/fd809514263e4351af42b67cbfbd06ef");

  // Bulk notification
  const [showBulkNotify, setShowBulkNotify] = useState(false);
  type BulkResInfo = { id: number; customer_name: string; start_time: string; end_time: string; course: string; nomination: string; total_price: number; discount_name: string; extension_name: string };
  type BulkTherapistData = { therapistId: number; therapistName: string; reservations: BulkResInfo[]; message: string };
  const [bulkData, setBulkData] = useState<BulkTherapistData[]>([]);
  const [bulkCopied, setBulkCopied] = useState<Record<number, boolean>>({});

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
    const { data: settled } = await supabase.from("therapist_daily_settlements").select("therapist_id,change_collected").eq("date", selectedDate).eq("is_settled", true); if (settled) { setSettledIds(new Set(settled.map(s => s.therapist_id))); setChangeCollectedIds(new Set(settled.filter(s => s.change_collected).map(s => s.therapist_id))); }
    const { data: stf } = await supabase.from("staff").select("id,name,role").eq("status", "active").order("id"); if (stf) setStaffMembers(stf);
    const { data: pts } = await supabase.from("point_settings").select("earn_per_yen,earn_points,expiry_months,rainy_day_active,rainy_day_multiplier").limit(1).single(); if (pts) setPtSettings(pts);
    // Notification templates from DB
    const { data: nts } = await supabase.from("notification_templates").select("template_key,body"); if (nts) setNtTemplates(nts);
    const ntKeys = ["notify_url_days", "notify_loc_toyohashi", "notify_loc_mycourt", "notify_loc_oasis", "notify_sender_default", "line_url_customer", "line_url_staff"];
    const { data: ntSets } = await supabase.from("store_settings").select("key,value").in("key", ntKeys);
    if (ntSets) { for (const s of ntSets) { if (s.key === "notify_url_days") setNtUrlDays(parseInt(s.value) || 1); else if (s.key === "notify_loc_toyohashi") setNtLocToyohashi(s.value); else if (s.key === "notify_loc_mycourt") setNtLocMycourt(s.value); else if (s.key === "notify_loc_oasis") setNtLocOasis(s.value); else if (s.key === "notify_sender_default" && s.value && !notifySender) setNotifySender(s.value); else if (s.key === "line_url_customer") document.body.dataset.lineUrlCustomer = s.value; else if (s.key === "line_url_staff") document.body.dataset.lineUrlStaff = s.value; } }
  }, [selectedDate]);

  useEffect(() => { const check = async () => { const { data: { user } } = await supabase.auth.getUser(); if (!user) router.push("/"); }; check(); fetchData(); }, [router, fetchData]);

  // リアルタイム同期
  useEffect(() => {
    const channel = supabase.channel("timechart-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "reservations" }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "room_assignments" }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "shifts" }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "therapist_daily_settlements" }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "room_cash_replenishments" }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "shift_requests" }, () => fetchPendingShifts())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchData]);

  // Shift request notifications
  const fetchPendingShifts = async () => {
    const { data } = await supabase.from("shift_requests").select("*").eq("status", "pending").order("updated_at", { ascending: false });
    if (data) setPendingShiftReqs(data);
  };
  useEffect(() => { fetchPendingShifts(); }, []);
  
  useEffect(() => { const p = new URLSearchParams(window.location.search).get("date"); if (p) setSelectedDate(p); }, []);

  // CTI着信からの自動遷移
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ctiCustomer = params.get("cti_customer");
    const ctiPhone = params.get("cti_phone");
    if (!ctiCustomer && !ctiPhone) return;
    // データ読み込み後に実行するため少し待つ
    const timer = setTimeout(() => {
      if (ctiCustomer) {
        // 既存顧客 → オーダー登録を直接開く
        setNewCustName(ctiCustomer);
        setShowNewRes(true);
        supabase.from("customers").select("phone").eq("name", ctiCustomer).maybeSingle().then(({ data }) => setNewCustPhone(data?.phone || ""));
      } else if (ctiPhone) {
        // 新規顧客 → 新規登録フォームを電話番号入りで開く
        setNcPhone(ctiPhone);
        setNcName("");
        setShowNewCust(true);
      }
      // URLパラメータをクリア（リロード時の再実行防止）
      window.history.replaceState({}, "", window.location.pathname);
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

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

  const handlePanStart = (e: React.MouseEvent) => { if ((e.target as HTMLElement).closest(".res-block")) return; const c = timelineRef.current; if (!c) return; setIsPanning(true); panMoved.current = false; panStartX.current = e.clientX; panScrollLeft.current = c.scrollLeft; lastX.current = e.clientX; lastTime2.current = Date.now(); velocity.current = 0; cancelAnimationFrame(animFrame.current); };
  const handlePanMove = (e: React.MouseEvent) => { if (!isPanning) return; const c = timelineRef.current; if (!c) return; e.preventDefault(); const dx = e.clientX - panStartX.current; c.scrollLeft = panScrollLeft.current - dx; if (Math.abs(dx) > 5) panMoved.current = true; const now = Date.now(); const dt = now - lastTime2.current; if (dt > 0) velocity.current = (e.clientX - lastX.current) / dt; lastX.current = e.clientX; lastTime2.current = now; };
  const handlePanEnd = () => { if (!isPanning) return; setIsPanning(false); const c = timelineRef.current; if (!c) return; let v = velocity.current * 15; const dec = () => { if (Math.abs(v) < 0.5) return; c.scrollLeft -= v; v *= 0.92; animFrame.current = requestAnimationFrame(dec); }; dec(); };

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
    const { error } = await supabase.from("reservations").insert({ customer_name: newCustName.trim(), therapist_id: newTherapistId, date: newDate || selectedDate, start_time: newStart, end_time: newEnd, course: selectedCourse?.name || "", notes: newNotes.trim(), user_id: user?.id, nomination: newNomination, nomination_fee: newNomFee, options_text: optText, options_total: optTotal, discount_name: discText, discount_amount: discTotal, extension_name: newExtension, extension_price: newExtPrice, extension_duration: newExtDur, total_price: total, status: "unprocessed", customer_status: "unsent", therapist_status: "unsent", card_base: parseInt(newCardBase) || 0, paypay_amount: parseInt(newPaypay) || 0, card_billing: Math.round((parseInt(newCardBase) || 0) * 1.1), cash_amount: total - (parseInt(newCardBase) || 0) - (parseInt(newPaypay) || 0), staff_name: newStaffName });
    if (!error) {
      const { data: cust } = await supabase.from("customers").select("id").eq("name", newCustName.trim()).maybeSingle();
      if (cust) {
        const optT2 = newOptions.reduce((s, o) => s + o.price, 0); const discT2 = newDiscounts.reduce((s, d) => s + d.amount, 0); const tot2 = (selectedCourse?.price || 0) + newNomFee + optT2 + newExtPrice - discT2;
        await supabase.from("customer_visits").insert({ customer_id: cust.id, date: newDate || selectedDate, start_time: newStart, end_time: newEnd, therapist_id: newTherapistId, course_name: selectedCourse?.name || "", price: selectedCourse?.price || 0, therapist_back: selectedCourse?.therapist_back || 0, total: tot2, nomination: newNomination, options: newOptions.map(o=>o.name).join(","), discount: newDiscounts.map(d=>d.name).join(",") });
      }
    }
    setSaving(false);
    if (error) { toast.show("登録失敗: " + error.message, "error"); }
    else {
      const thName = therapists.find(t => t.id === newTherapistId)?.name || "";
      const { data: custInfo } = await supabase.from("customers").select("phone,login_email,self_name").eq("name", newCustName.trim()).maybeSingle();
      const hasLine = /\sL$/i.test(newCustName.trim()) || /\sL\s/i.test(newCustName.trim());
      const isMember = !!(custInfo?.login_email);
      // Get store/building from room assignment
      const ra = roomAssigns.find(a => a.therapist_id === newTherapistId);
      const rm = ra ? allRooms.find(r => r.id === ra.room_id) : null;
      const bl = rm ? buildings.find(b => b.id === rm.building_id) : null;
      const st = rm ? stores.find(s => s.id === rm.store_id) : null;
      const courseWithExt = (selectedCourse?.name || "") + (newExtension ? `＋${newExtension}` : "");
      setNotifyInfo({ custName: newCustName.trim(), custPhone: custInfo?.phone || "", custEmail: custInfo?.login_email || "", hasLine, isMember, date: newDate || selectedDate, startTime: newStart, endTime: newEnd, course: courseWithExt, therapistName: thName, total: coursePrice + newNomFee + optTotal + newExtPrice - discTotal, nomination: newNomination || "指名なし", discountName: newDiscounts.map(d => d.name).join(",") || "なし", extensionName: newExtension, storeName: st?.name || "", buildingName: bl?.name || "" });
      toast.show("予約を登録しました！", "success"); /* 電話番号・名前を顧客テーブルに反映（レコードがなければ自動作成） */ if (newCustPhone.trim()) { const ph = newCustPhone.trim().replace(/[-\s　()（）]/g, ""); const { data: existCust } = await supabase.from("customers").select("id").eq("name", newCustName.trim()).maybeSingle(); if (existCust) { await supabase.from("customers").update({ phone: ph }).eq("id", existCust.id); } else { await supabase.from("customers").insert({ name: newCustName.trim(), phone: ph }); } } else { /* 電話番号なしでも顧客レコードを確保 */ const { data: existCust } = await supabase.from("customers").select("id").eq("name", newCustName.trim()).maybeSingle(); if (!existCust) { await supabase.from("customers").insert({ name: newCustName.trim() }); } } setNewCustName(""); setNewCustPhone(""); setNewTherapistId(0); setNewCourseId(0); setNewNotes(""); setNewStart("12:00"); setNewEnd("13:00"); setNewNomination(""); setNewNomFee(0); setNewOptions([]); setNewDiscounts([]); setNewExtension(""); setNewExtPrice(0); setNewExtDur(0); setNewCardBase(""); setNewPaypay(""); fetchData(); setTimeout(() => { setShowNewRes(false); setMsg(""); }, 600);
    }
  };

  const openEdit = (r: Reservation) => { setEditRes(r); setEditCustName(r.customer_name); setEditTherapistId(r.therapist_id); setEditStart(r.start_time); setEditEnd(r.end_time); setEditNotes(r.notes || ""); const c = courses.find((x) => x.name === r.course); setEditCourseId(c ? c.id : 0); setEditMsg(""); setEditNomination((r as any).nomination || ""); setEditNomFee((r as any).nomination_fee || 0); const discs = (r as any).discount_name ? (r as any).discount_name.split(",").map((n: string) => { const d = discounts.find(x=>x.name===n); return { name: n, amount: d ? (d.type==="percent" ? Math.round((courses.find(x=>x.name===r.course)?.price || 0) * d.amount / 100) : d.amount) : 0 }; }).filter((d: any)=>d.name) : []; setEditDiscounts(discs); setEditExtension((r as any).extension_name || ""); setEditExtPrice((r as any).extension_price || 0); setEditExtDur((r as any).extension_duration || 0); const opts = (r as any).options_text ? (r as any).options_text.split(",").map((n: string) => { const o = options.find(x=>x.name===n); return { name: n, price: o?.price || 0 }; }).filter((o: any)=>o.name) : []; setEditOptions(opts); setEditStatus((r as any).status || "unprocessed"); setEditCustomerStatus((r as any).customer_status || "unsent"); setEditTherapistStatus((r as any).therapist_status || "unsent"); setEditCardBase(String((r as any).card_base || "")); setEditPaypay(String((r as any).paypay_amount || "")); setEditStaffName((r as any).staff_name || ""); supabase.from("customers").select("phone").eq("name", r.customer_name).maybeSingle().then(({ data }) => setEditCustPhone(data?.phone || "")); };
  // ===== ポイント自動付与（completed時） =====
  const awardPoints = async (resId: number, customerName: string, totalPrice: number, resDate: string) => {
    try {
      // 顧客取得
      const { data: cust } = await supabase.from("customers").select("id,rank,birthday").eq("name", customerName).limit(1).maybeSingle();
      if (!cust) return;
      // 既に付与済みかチェック
      const { data: existingPt } = await supabase.from("customer_points").select("id").eq("customer_id", cust.id).eq("description", `予約#${resId}ポイント付与`).maybeSingle();
      if (existingPt) return;
      // ポイント設定取得
      const { data: ps } = await supabase.from("point_settings").select("*").limit(1).single();
      if (!ps) return;
      // 基本ポイント計算
      const basePoints = Math.floor(totalPrice / (ps.earn_per_yen || 1000)) * (ps.earn_points || 20);
      if (basePoints <= 0) return;
      // ボーナスルール取得
      const { data: rules } = await supabase.from("point_bonus_rules").select("*").eq("is_active", true);
      const { data: rankMults } = await supabase.from("rank_point_multipliers").select("*");
      const d = new Date(resDate + "T00:00:00");
      const dow = d.getDay();
      const dayOfMonth = d.getDate();
      let multiplier = 1.0;
      let bonusLabels: string[] = [];
      // 曜日ボーナス
      (rules || []).filter(r => r.type === "weekday" && r.day_of_week === dow).forEach(r => {
        if (r.multiplier > multiplier) { multiplier = r.multiplier; bonusLabels.push(r.label || `曜日${r.multiplier}倍`); }
      });
      // 期間ボーナス
      (rules || []).filter(r => r.type === "period" && dayOfMonth >= (r.start_day || 1) && dayOfMonth <= (r.end_day || 31)).forEach(r => {
        if (r.multiplier > multiplier) { multiplier = r.multiplier; bonusLabels.push(r.label || `期間${r.multiplier}倍`); }
      });
      // 誕生月ボーナス
      if (cust.birthday) {
        const bMonth = new Date(cust.birthday).getMonth();
        const resMonth = d.getMonth();
        (rules || []).filter(r => r.type === "birthday" && bMonth === resMonth).forEach(r => {
          if (r.multiplier > multiplier) { multiplier = r.multiplier; bonusLabels.push(r.label || `誕生月${r.multiplier}倍`); }
        });
      }
      // アイドルタイムボーナス（予約の開始時間で判定）
      const resStartMinutes = (() => { const r = reservations.find(x => x.id === resId); if (!r) return 0; const [h, m] = r.start_time.split(":").map(Number); return h * 60 + m; })();
      (rules || []).filter(r => r.type === "idle_time").forEach(r => {
        const wd = r.weekdays || [];
        if (!wd.includes(dow)) return;
        const [sh, sm] = (r.start_time || "0:0").split(":").map(Number);
        const [eh, em] = (r.end_time || "0:0").split(":").map(Number);
        const startMin = sh * 60 + sm;
        const endMin = eh * 60 + em;
        if (resStartMinutes >= startMin && resStartMinutes < endMin) {
          if (r.multiplier > multiplier) { multiplier = r.multiplier; bonusLabels.push(r.label || `アイドルタイム${r.multiplier}倍`); }
        }
      });
      // 雨の日ボーナス
      if (ps.rainy_day_active && ps.rainy_day_multiplier > multiplier) {
        multiplier = ps.rainy_day_multiplier; bonusLabels.push(`☔雨の日${ps.rainy_day_multiplier}倍`);
      }
      // 会員ランク倍率
      const rankMult = (rankMults || []).find(rm => rm.rank_name === (cust.rank || "normal"));
      const rankMultiplier = rankMult?.multiplier || 1.0;
      // 最終ポイント計算
      const finalPoints = Math.floor(basePoints * multiplier * rankMultiplier);
      // 有効期限
      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + (ps.expiry_months || 12));
      // ポイント付与
      const desc = `予約#${resId}ポイント付与` + (bonusLabels.length > 0 ? `（${bonusLabels.join("・")}）` : "") + (rankMultiplier > 1 ? `（ランク×${rankMultiplier}）` : "");
      await supabase.from("customer_points").insert({
        customer_id: cust.id, amount: finalPoints, type: "earn",
        description: desc, expires_at: expiresAt.toISOString(),
      });
      // 期限切れ通知予約（期限のexpiry_notify_days日前）
      const notifyDate = new Date(expiresAt);
      notifyDate.setDate(notifyDate.getDate() - (ps.expiry_notify_days || 30));
      if (notifyDate > new Date()) {
        await supabase.from("customer_notifications").insert({
          title: "ポイント有効期限のお知らせ",
          body: `${finalPoints}ptの有効期限が${expiresAt.toLocaleDateString("ja-JP")}に迫っています。お早めにご利用ください！`,
          type: "campaign",
          target_customer_id: cust.id,
        });
      }
    // ===== 自動ランク判定 =====
      try {
        const { data: rankRules } = await supabase.from("rank_point_multipliers").select("*").order("min_total_visits", { ascending: false });
        if (rankRules && rankRules.length > 0) {
          // 累計来店回数
          const { count: totalVisits } = await supabase.from("customer_visits").select("*", { count: "exact", head: true }).eq("customer_id", cust.id);
          // 各ランクを上位から判定
          let newRank = "normal";
          for (const rule of rankRules) {
            if (rule.rank_name === "normal") continue;
            const periodStart = new Date();
            periodStart.setMonth(periodStart.getMonth() - (rule.period_months || 3));
            const { count: recentVisits } = await supabase.from("customer_visits").select("*", { count: "exact", head: true }).eq("customer_id", cust.id).gte("date", periodStart.toISOString().split("T")[0]);
            if ((totalVisits || 0) >= (rule.min_total_visits || 0) && (recentVisits || 0) >= (rule.min_visits_in_period || 0)) {
              newRank = rule.rank_name;
              break;
            }
          }
          // ランク変更があれば更新
          if (newRank !== (cust.rank || "normal")) {
            await supabase.from("customers").update({ rank: newRank }).eq("id", cust.id);
            const rankLabel = newRank === "platinum" ? "💎プラチナ" : newRank === "gold" ? "🥇ゴールド" : newRank === "silver" ? "🥈シルバー" : "👤一般";
            const isUp = ["platinum","gold","silver","normal"].indexOf(newRank) < ["platinum","gold","silver","normal"].indexOf(cust.rank || "normal");
            if (isUp) {
              await supabase.from("customer_notifications").insert({
                title: "🎉 ランクアップおめでとうございます！",
                body: `${rankLabel}会員にランクアップしました！ポイント倍率がアップします。`,
                type: "campaign", target_customer_id: cust.id,
              });
            }
          }
        }
      } catch (e2) { console.error("ランク判定エラー:", e2); }
      // ポイント使用を仮押さえ→確定
      try {
        await supabase.from("customer_points").update({ status: "confirmed", description: `予約利用（確定）` }).eq("reservation_id", resId).eq("status", "pending");
      } catch (e3) { console.error("ポイント確定エラー:", e3); }
    } catch (e) { console.error("ポイント付与エラー:", e); }
  };
  const updateReservation = async () => { if (!editRes) return; setEditSaving(true); setEditMsg(""); const eOptText = editOptions.map(o=>o.name).join(","); const eOptTotal = editOptions.reduce((s,o)=>s+o.price,0); const eCp = editSelectedCourse?.price || 0; const eDiscText = editDiscounts.map(d=>d.name).join(","); const eDiscTotal = editDiscounts.reduce((s,d)=>s+d.amount,0); const eTotal = eCp + editNomFee + eOptTotal + editExtPrice - eDiscTotal; const derivedStatus = editCustomerStatus === "completed" ? "completed" : editCustomerStatus === "serving" ? "serving" : editCustomerStatus === "web_reservation" ? "web_reservation" : editCustomerStatus.startsWith("detail") ? "processed" : editCustomerStatus.startsWith("summary") ? "email_sent" : "unprocessed"; const { error } = await supabase.from("reservations").update({ customer_name: editCustName.trim(), therapist_id: editTherapistId, start_time: editStart, end_time: editEnd, course: editSelectedCourse?.name || editRes.course, notes: editNotes.trim(), nomination: editNomination, nomination_fee: editNomFee, options_text: eOptText, options_total: eOptTotal, discount_name: eDiscText, discount_amount: eDiscTotal, extension_name: editExtension, extension_price: editExtPrice, extension_duration: editExtDur, total_price: eTotal, status: derivedStatus, customer_status: editCustomerStatus, therapist_status: editTherapistStatus, card_base: parseInt(editCardBase) || 0, paypay_amount: parseInt(editPaypay) || 0, card_billing: Math.round((parseInt(editCardBase) || 0) * 1.1), cash_amount: eTotal - (parseInt(editCardBase) || 0) - (parseInt(editPaypay) || 0), staff_name: editStaffName }).eq("id", editRes.id); setEditSaving(false); if (error) { toast.show("更新失敗: " + error.message, "error"); } else { if (editCustomerStatus === "completed") { await awardPoints(editRes.id, editCustName.trim(), eTotal, editRes.date); } if (editManualPoints && parseInt(editManualPoints) !== 0) { const mp = parseInt(editManualPoints); const { data: cust } = await supabase.from("customers").select("id").eq("name", editCustName.trim()).maybeSingle(); if (cust) { const expAt = new Date(); expAt.setMonth(expAt.getMonth() + (ptSettings?.expiry_months || 12)); await supabase.from("customer_points").insert({ customer_id: cust.id, amount: mp, type: mp > 0 ? "earn" : "use", description: editManualPointDesc.trim() || (mp > 0 ? "手動ポイント付与" : "手動ポイント減算"), expires_at: mp > 0 ? expAt.toISOString() : null }); } setEditManualPoints(""); setEditManualPointDesc(""); } toast.show("更新しました！", "success"); /* 顧客情報も更新（レコードがなければ自動作成） */ const origName = editRes.customer_name; const { data: custRec } = await supabase.from("customers").select("id").eq("name", origName).maybeSingle(); if (custRec) { const custUpdate: Record<string, string> = {}; if (editCustPhone.trim()) custUpdate.phone = editCustPhone.trim().replace(/[-\s　()（）]/g, ""); if (editCustName.trim() !== origName) custUpdate.name = editCustName.trim(); if (Object.keys(custUpdate).length > 0) await supabase.from("customers").update(custUpdate).eq("id", custRec.id); } else { const newCust: Record<string, string> = { name: editCustName.trim() }; if (editCustPhone.trim()) newCust.phone = editCustPhone.trim().replace(/[-\s　()（）]/g, ""); await supabase.from("customers").insert(newCust); } fetchData(); setTimeout(() => { setEditRes(null); setEditMsg(""); }, 600); } };
  const deleteReservation = async (id: number) => { /* ポイント仮押さえ返還 */ const { data: pendingPts } = await supabase.from("customer_points").select("id,customer_id,amount").eq("reservation_id", id).eq("status", "pending"); if (pendingPts && pendingPts.length > 0) { for (const pp of pendingPts) { await supabase.from("customer_points").delete().eq("id", pp.id); } toast.show("仮押さえポイントを返還しました", "info"); } await supabase.from("reservations").delete().eq("id", id); setEditRes(null); fetchData(); };
  const notifyFavShift = async (thId: number, date: string, start: string, end: string) => { try { const th = therapists.find(t => t.id === thId); if (!th) return; const d = new Date(date + "T00:00:00"); const days = ["日","月","火","水","木","金","土"]; const dateStr = `${d.getMonth()+1}/${d.getDate()}(${days[d.getDay()]})`; const { data: favs } = await supabase.from("customer_favorites").select("customer_id").eq("type", "therapist").eq("item_id", thId); if (!favs || favs.length === 0) return; for (const fav of favs) { const { data: exist } = await supabase.from("customer_notifications").select("id").eq("target_customer_id", fav.customer_id).like("title", "%出勤のお知らせ%").like("body", `%${th.name}%${dateStr}%`).maybeSingle(); if (!exist) { await supabase.from("customer_notifications").insert({ title: "❤️ お気に入りセラピスト出勤のお知らせ", body: `${th.name}さんが${dateStr} ${start}〜${end}に出勤します！ご予約はお早めに♪`, type: "info", target_customer_id: fav.customer_id }); } } } catch (e) { console.error("お気に入り通知エラー:", e); } };
  const addShiftTherapist = async () => { if (!addShiftTherapistId) return; await supabase.from("shifts").insert({ therapist_id: addShiftTherapistId, date: selectedDate, start_time: addShiftStart, end_time: addShiftEnd, status: "confirmed" }); if (addShiftRoom) { await supabase.from("room_assignments").insert({ date: selectedDate, room_id: addShiftRoom, therapist_id: addShiftTherapistId, slot: "early", start_time: addShiftStart, end_time: addShiftEnd }); } await notifyFavShift(addShiftTherapistId, selectedDate, addShiftStart, addShiftEnd); setShowNewTherapist(false); setAddShiftTherapistId(0); fetchData(); };

  const getCourseByName = (name: string) => courses.find((c) => c.name === name);
  const fmt = (n: number) => "¥" + (n || 0).toLocaleString();
  // ===== 一括通知（セラピスト別まとめ送信）=====
  const openBulkNotify = async () => {
    // 当日の全予約を取得（フルデータ）
    const { data: allRes } = await supabase.from("reservations").select("*").eq("date", selectedDate).order("start_time");
    if (!allRes || allRes.length === 0) { toast.show("本日の予約がありません", "info"); return; }

    // 顧客マスタ取得（お客様リンク用）
    const { data: custData } = await supabase.from("customers").select("name, phone, login_email");
    const custMap: Record<string, { phone: string; email: string }> = {};
    if (custData) custData.forEach(c => { custMap[c.name] = { phone: c.phone || "", email: c.login_email || "" }; });

    const d = new Date(selectedDate + "T00:00:00"); const days = ["日","月","火","水","木","金","土"];
    const dateFull = `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日（${days[d.getDay()]}）`;
    const senderLine = notifySender ? `\n\n送信者 : ${notifySender}` : "";

    // セラピスト別にグループ化
    const grouped: Record<number, BulkResInfo[]> = {};
    for (const r of allRes) {
      if (!grouped[r.therapist_id]) grouped[r.therapist_id] = [];
      grouped[r.therapist_id].push({
        id: r.id, customer_name: r.customer_name, start_time: r.start_time, end_time: r.end_time,
        course: r.course, nomination: r.nomination || "フリー", total_price: r.total_price || 0,
        discount_name: r.discount_name || "", extension_name: r.extension_name || "",
      });
    }

    const result: BulkTherapistData[] = [];
    for (const [tidStr, rsvs] of Object.entries(grouped)) {
      const tid = parseInt(tidStr);
      const th = therapists.find(t => t.id === tid);
      if (!th) continue;

      // メッセージ生成
      let msg = `お疲れ様です！\n\n${dateFull} の予約一覧です。\n`;
      rsvs.forEach((r, i) => {
        const cleanName = r.customer_name.replace(/\s*L$/i, "").replace(/\s+\d+～\d+歳$/, "").trim();
        const nomLine = r.nomination && r.nomination !== "フリー" && r.nomination !== "指名なし" ? `\n指名 : ${r.nomination}` : "";
        const discLine = r.discount_name ? `\n割引 : ${r.discount_name}` : "";
        const extLine = r.extension_name ? ` + ${r.extension_name}` : "";
        const custLink = `https://t-manage.vercel.app/mypage/customer?name=${encodeURIComponent(cleanName)}`;
        msg += `\n━━━━━━━━━━━━━━━\n`;
        msg += `${i + 1}⃣  ${r.start_time?.slice(0,5)}〜${r.end_time?.slice(0,5)}\n`;
        msg += `お客様 : ${cleanName}\n`;
        msg += `コース : ${r.course}${extLine}`;
        msg += nomLine;
        msg += discLine;
        msg += `\n金額 : ¥${(r.total_price || 0).toLocaleString()}`;
        msg += `\nお客様情報 : ${custLink}`;
      });
      msg += `\n━━━━━━━━━━━━━━━\n\n合計 ${rsvs.length}件\nよろしくお願いします。${senderLine}`;

      result.push({ therapistId: tid, therapistName: th.name, reservations: rsvs, message: msg });
    }

    setBulkData(result);
    setBulkCopied({});
    setShowBulkNotify(true);
  };

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
          <button onClick={() => setShowShiftNotif(!showShiftNotif)} className="relative px-3 py-2 border text-[11px] rounded-xl cursor-pointer" style={{ borderColor: pendingShiftReqs.length > 0 ? "#f59e0b44" : T.border, color: pendingShiftReqs.length > 0 ? "#f59e0b" : T.textSub }}>
            📝 出勤希望{pendingShiftReqs.length > 0 && <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] rounded-full text-[9px] font-bold text-white flex items-center justify-center" style={{ backgroundColor: "#f59e0b" }}>{new Set(pendingShiftReqs.map(r => r.therapist_id)).size}</span>}
          </button>
          <button onClick={() => setShowStatusList(true)} className="px-3 py-2 border text-[11px] rounded-xl cursor-pointer" style={{ borderColor: "#c3a78244", color: "#c3a782" }}>📋 ステータス一覧</button>
          <button onClick={openBulkNotify} className="px-3 py-2 border text-[11px] rounded-xl cursor-pointer" style={{ borderColor: "#3d6b9f44", color: "#3d6b9f" }}>📩 一括通知</button>
          <button onClick={toggle} className="px-3 py-1.5 text-[10px] rounded-lg cursor-pointer border" style={{ borderColor: T.border, color: T.textSub }}>{dark ? "☀️ ライト" : "🌙 ダーク"}</button>
          <button onClick={() => { router.push("/dashboard?openSafe=true&returnDate=" + selectedDate); }} className="px-3 py-2 border text-[11px] rounded-xl cursor-pointer" style={{ borderColor: "#a855f744", color: "#a855f7" }}>🔐 金庫</button>
          <button onClick={() => { router.push("/dashboard?page=" + encodeURIComponent("営業締め") + "&date=" + selectedDate); }} className="px-3 py-2 border text-[11px] rounded-xl cursor-pointer" style={{ borderColor: "#c3a78244", color: "#c3a782" }}>📊 日次集計</button>
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
            <div className="w-[240px] flex-shrink-0 sticky left-0 z-20" style={{ backgroundColor: T.bg }}>
              <div className="h-[32px] border-b border-r flex items-center px-3" style={{ backgroundColor: T.cardAlt, borderColor: T.border }}>
                <span className="text-[11px]" style={{ color: T.textSub }}>セラピスト</span>
              </div>
              {displayTherapists.map((t, ti) => {
                const isCO = clockedOut.has(t.id);
                const origIdx = therapists.findIndex((x) => x.id === t.id);
                return (
                  <div key={t.id} className="h-[52px] border-b border-r flex items-center px-2 gap-1.5" style={{ backgroundColor: isCO ? (dark ? "#2a2020" : "#faf5f5") : T.card, borderColor: T.border, opacity: isCO ? 0.5 : 1 }}>
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] text-white font-medium flex-shrink-0" style={{ backgroundColor: isCO ? "#888" : colors[origIdx % colors.length] }}>{t.name.charAt(0)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1"><button onClick={(e) => { e.stopPropagation(); setEditTherapist(t); setEtNotes((t as any).notes || ""); }} className="text-[10px] font-medium truncate cursor-pointer flex items-center gap-0.5" style={{ textDecoration: isCO ? "line-through" : "none", background: "none", border: "none", padding: 0, color: T.text, textAlign: "left" }}>{t.name}<span style={{ fontSize: 8, opacity: 0.4 }}>✏️</span></button>
                        {(t as any).age > 0 && <span className="text-[7px]" style={{ color: T.textMuted }}>{(t as any).age}歳</span>}
                        {(t as any).height_cm > 0 && <span className="text-[7px]" style={{ color: T.textMuted }}>{(t as any).height_cm}cm</span>}
                        {(t as any).cup && <span className="text-[7px]" style={{ color: T.textMuted }}>{(t as any).cup}</span>}
                      </div>
                      <div className="flex items-center gap-1 text-[7px]" style={{ color: T.textMuted }}>
                        
                        {(() => { const sh = shifts.find(s => s.therapist_id === t.id); return sh ? <button onClick={(e) => { e.stopPropagation(); setEditShiftTherapist(t.id); setEditShiftId(sh.id); setEditShiftStart(sh.start_time?.slice(0,5) || "12:00"); setEditShiftEnd(sh.end_time?.slice(0,5) || "03:00"); }} className="cursor-pointer" style={{ color: "#c3a782", background: "none", border: "none", padding: 0, fontSize: 7 }}>⏰{sh.start_time?.slice(0,5)}〜{sh.end_time?.slice(0,5)}</button> : null; })()}
                        {(() => { const ra = roomAssigns.find(a => a.therapist_id === t.id); if (ra) { const rm = allRooms.find(r => r.id === ra.room_id); const bl = rm ? buildings.find(b => b.id === rm.building_id) : null; const hasReserve = (bl as any)?.cash_reserve > 0; return <><button onClick={(e) => { e.stopPropagation(); setEditRoomTherapist(t.id); const ra2 = roomAssigns.find(a => a.therapist_id === t.id); if (ra2) { const rm2 = allRooms.find(r => r.id === ra2.room_id); setEditRoomId(ra2.room_id); setEditRoomStore(rm2?.store_id || 0); setEditRoomBuilding(rm2?.building_id || 0); } }} className="cursor-pointer" style={{ color: "#85a8c4", background: "none", border: "none", padding: 0, fontSize: 7 }}>🏠{bl?.name || ""}{rm?.name || ""}</button>{hasReserve && <button onClick={async (e) => { e.stopPropagation(); setShowReplenish(ra.room_id); setReplenishAmount(String((bl as any)?.cash_reserve || 20000)); setReplenishTherapistId(t.id); setReplenishStaff(""); const { data: ds } = await supabase.from("therapist_daily_settlements").select("therapist_id,sales_collected,change_collected,total_cash,total_back,room_id,safe_deposited").eq("date", selectedDate).eq("room_id", ra.room_id); if (ds) setDailySettlements(prev => { const filtered = prev.filter(p => p.room_id !== ra.room_id); return [...filtered, ...ds]; }); const past7: typeof pastUncollected = []; for (let d = 1; d <= 7; d++) { const dd = new Date(selectedDate); dd.setDate(dd.getDate() - d); const ds2 = dd.toISOString().split("T")[0]; const { data: ps } = await supabase.from("therapist_daily_settlements").select("*").eq("room_id", ra.room_id).eq("date", ds2); if (ps) { for (const p of ps) { if (!p.sales_collected || !p.change_collected) { const th2 = therapists.find(x => x.id === p.therapist_id); const { data: pastRep } = await supabase.from("room_cash_replenishments").select("amount").eq("room_id", ra.room_id).eq("date", ds2); const repAmt = pastRep ? pastRep.reduce((s2: number, r2: { amount: number }) => s2 + r2.amount, 0) : 0; past7.push({ date: ds2, total_cash: p.total_cash || 0, total_back: p.total_back || 0, total_sales: p.total_sales || 0, therapist_name: th2?.name || "", sales_collected: !!p.sales_collected, change_collected: !!p.change_collected, replenish_amount: repAmt }); } } } } setPastUncollected(past7); }} style={{ color: "#22c55e", background: "none", border: "none", padding: 0, fontSize: 7, cursor: "pointer", marginLeft: 2 }}>💰釣銭{(() => { if (changeCollectedIds.has(t.id)) return "¥0"; const rp = replenishments.filter(x => rm && x.room_id === rm.id).reduce((s2, x2) => s2 + x2.amount, 0); return fmt(rp); })()}</button>}</>; } return null; })()}
                      </div>
                      {(t as any).notes && <div style={{ overflow: "hidden", maxWidth: 120 }}><span className="text-[6px] block" style={{ color: "#f59e0b", whiteSpace: "nowrap", animation: (t as any).notes.length > 12 ? `scrollLeft ${Math.max(3, (t as any).notes.length * 0.2)}s linear infinite` : "none" }}>📝{(t as any).notes}</span></div>}
                      {isCO && <span className="text-[7px]" style={{ color: "#c45555" }}>退勤済</span>}
                      {settledIds.has(t.id) && <button onClick={async (e) => { e.stopPropagation(); if (!confirm(`${t.name}の清算確定を取り消しますか？`)) return; await supabase.from("therapist_daily_settlements").delete().eq("therapist_id", t.id).eq("date", selectedDate); setSettledIds(prev => { const next = new Set(prev); next.delete(t.id); return next; }); toast.show("清算を取り消しました", "info"); fetchData(); }} className="text-[8px] px-1.5 py-0.5 rounded font-bold cursor-pointer" style={{ backgroundColor: "#22c55e22", color: "#22c55e", border: "1px solid #22c55e44" }}>✓ 清算済</button>}
                    </div>
                    <div className="flex flex-col gap-0.5 flex-shrink-0">
                      <button onClick={() => toggleClockOut(t.id)} className="text-[8px] px-1.5 py-0 rounded cursor-pointer border leading-tight"
                        style={{ borderColor: isCO ? "#7ab88f66" : "#c4555566", backgroundColor: isCO ? "#7ab88f12" : "#c4555512", color: isCO ? "#7ab88f" : "#c45555" }}>
                        {isCO ? "復活" : "退勤"}
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); const bRes2 = reservations.filter(r => r.therapist_id === t.id).sort((a, b) => timeToMinutes(b.end_time) - timeToMinutes(a.end_time)); setBreakStart(bRes2.length > 0 ? bRes2[0].end_time.slice(0,5) : "12:00"); setShowBreakModal(t.id); setBreakDuration(30); }} className="text-[8px] px-1.5 py-0 rounded cursor-pointer border leading-tight" style={{ borderColor: "#a855f744", color: "#a855f7" }}>休憩</button>
                      <button onClick={async (e) => { e.stopPropagation(); setSettleTh(t); setSettleAdj(""); setSettleAdjNote(""); setSettleInvoice((t as any).has_invoice || false); setSettleSalesCollected(false); setSettleChangeCollected(false); const { data: existing } = await supabase.from("therapist_daily_settlements").select("*").eq("therapist_id", t.id).eq("date", selectedDate).maybeSingle(); setSettleSettled(!!existing?.is_settled); if (existing) { setSettleSalesCollected(!!existing.sales_collected); setSettleChangeCollected(!!existing.change_collected); setSettleSafeDeposited(!!existing.safe_deposited); } else { setSettleSafeDeposited(false); } const ra2 = roomAssigns.find(a => a.therapist_id === t.id); if (ra2) { const past7: typeof pastUncollected = []; for (let d = 0; d <= 7; d++) { const dd = new Date(selectedDate); dd.setDate(dd.getDate() - d); const ds = dd.toISOString().split("T")[0]; const { data: ps } = await supabase.from("therapist_daily_settlements").select("*").eq("room_id", ra2.room_id).eq("date", ds); if (ps) { for (const p of ps) { if (p.therapist_id === t.id && ds === selectedDate) continue; if (!p.sales_collected || !p.change_collected) { const th2 = therapists.find(x => x.id === p.therapist_id); const { data: pastRep } = await supabase.from("room_cash_replenishments").select("amount").eq("room_id", ra2.room_id).eq("date", ds); const repAmt = pastRep ? pastRep.reduce((s: number, r: { amount: number }) => s + r.amount, 0) : 0; past7.push({ date: ds, total_cash: p.total_cash || 0, total_back: p.total_back || 0, total_sales: p.total_sales || 0, therapist_name: th2?.name || "不明", sales_collected: !!p.sales_collected, change_collected: !!p.change_collected, replenish_amount: repAmt }); } } } } setPastUncollected(past7); } else { setPastUncollected([]); } }} className="text-[8px] px-1.5 py-0 rounded cursor-pointer border leading-tight" style={{ borderColor: "#c3a78244", color: "#c3a782" }}>清算</button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Grid */}
            <div className="flex-1 relative">
              <div className="h-[32px] flex border-b sticky top-0 z-10" style={{ backgroundColor: T.cardAlt, borderColor: T.border }}>
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
                  <div key={t.id} className="h-[52px] border-b relative transition-colors"
                    style={{ backgroundColor: isCO ? (dark ? "#2a2020" : "#faf5f5") : T.card, borderColor: T.border, opacity: isCO ? 0.4 : 1 }}
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest(".res-block") || isCO) return;
                      const rect = e.currentTarget.getBoundingClientRect(); const x = e.clientX - rect.left; const min = Math.round(x / MIN_10_WIDTH) * 10;
                      if (panMoved.current) return;
                      setNewTherapistId(t.id); setNewStart(minutesToTime(min)); setNewEnd(minutesToTime(min + 60)); setNewDate(selectedDate); setNewCourseId(0); setMsg(""); setCustSearchQ(""); setShowCustSearch(true); supabase.from("customers").select("id,name,phone,rank").order("created_at",{ascending:false}).then(({data})=>{if(data)setCustList(data)});
                    }}>
                    {(() => { const sh = shifts.find(s => s.therapist_id === t.id); if (sh) { const shStart = timeToMinutes(sh.start_time); const shEnd = timeToMinutes(sh.end_time); const left = shStart * MIN_10_WIDTH / 10; const w = (shEnd - shStart) * MIN_10_WIDTH / 10; return <div className="absolute top-0 bottom-0" style={{ left, width: w, backgroundColor: dark ? "#c3a78208" : "#c3a78210", borderLeft: "2px solid #c3a78233", borderRight: "2px solid #c3a78233", zIndex: 1 }} />; } return null; })()}
                    {HOURS_RAW.map((rawH) => (<div key={`g-${t.id}-${rawH}`} className="absolute top-0 bottom-0" style={{ left: (rawH - START_HOUR) * HOUR_WIDTH, width: 1, backgroundColor: T.border }}>{[1, 2, 3, 4, 5].map((tick) => (<div key={tick} className="absolute top-0 bottom-0" style={{ left: tick * MIN_10_WIDTH, width: 1, backgroundColor: dark ? "#2a2a32" : "#f8f6f3" }} />))}</div>))}
                    {tRes.map((r, ri) => {
                      const sM = timeToMinutes(r.start_time); const eM = timeToMinutes(r.end_time);
                      const left = sM * (HOUR_WIDTH / 60); const width = (eM - sM) * (HOUR_WIDTH / 60);
                      const course = getCourseByName(r.course); const custSt = (r as any).customer_status || "unsent"; const therSt = (r as any).therapist_status || "unsent"; const dualStatusColors: Record<string,string> = { unsent: "#888780", web_reservation: "#a855f7", summary_unread: "#3b82f6", summary_read: "#2563eb", detail_unread: "#4a7c59", detail_read: "#16a34a", detail_sent: "#4a7c59", serving: "#22c55e", completed: "#c3a782" }; const color = dualStatusColors[custSt] || colors[origIdx % colors.length];
                      const custLabel: Record<string,string> = { unsent: "", web_reservation: "WEB", summary_unread: "概要未読", summary_read: "概要既読", detail_unread: "詳細未読", detail_read: "詳細既読", serving: "接客中", completed: "終了" }; const therLabel: Record<string,string> = { unsent: "", detail_sent: "セ送信済", serving: "接客中", completed: "終了" };
                      const cBadge = custLabel[custSt] || ""; const tBadge = therLabel[therSt] || "";
                      return (
                        <div key={`res-${r.id}-${ri}`} className="res-block absolute top-[4px] bottom-[4px] rounded-lg cursor-pointer group"
                          style={{ left, width: Math.max(width, MIN_10_WIDTH), backgroundColor: color + "20", borderLeft: `3px solid ${color}`, zIndex: 5 }}
                          onClick={(e) => { e.stopPropagation(); openEdit(r); }}>
                          <div className="absolute left-0 top-0 bottom-0 w-[6px] cursor-ew-resize opacity-0 group-hover:opacity-100 hover:bg-black/10 rounded-l-lg"
                            onMouseDown={(e) => { e.stopPropagation(); setDragInfo({ resId: r.id, edge: "start", initX: e.clientX, initMin: sM, initEndMin: eM }); }} />
                          <div className="px-2 py-1 overflow-hidden h-full"
                            onMouseDown={(e) => { if ((e.target as HTMLElement).closest(".drag-handle")) return; e.stopPropagation(); setDragInfo({ resId: r.id, edge: "move", initX: e.clientX, initMin: sM, initEndMin: eM }); }}>
                            <p className="text-[11px] font-medium truncate" style={{ color: T.text }}>{r.customer_name}{cBadge && <span style={{ marginLeft: 4, fontSize: 7, padding: "1px 4px", borderRadius: 4, backgroundColor: color + "22", color }}>{cBadge}</span>}{tBadge && custSt !== therSt && <span style={{ marginLeft: 2, fontSize: 7, padding: "1px 4px", borderRadius: 4, backgroundColor: (dualStatusColors[therSt] || "#888780") + "22", color: dualStatusColors[therSt] || "#888780" }}>{tBadge}</span>}</p>
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
                <button key={c.id} onClick={async () => { setNewCustName(c.name); setNewCustPhone((c as any).phone || ""); setShowCustSearch(false); setShowNewRes(true); setNewNomination(""); setNewNomFee(0); setNewOptions([]); setNewDiscounts([]); setNewExtension(""); setNewExtPrice(0); setNewExtDur(0); if (newTherapistId) { const { data: prevRes } = await supabase.from("reservations").select("id").eq("customer_name", c.name).eq("therapist_id", newTherapistId).limit(1); const { data: noms } = await supabase.from("nominations").select("*"); if (prevRes && prevRes.length > 0 && noms) { const honNom = noms.find((n: { name: string }) => n.name === "本指名"); if (honNom) { setNewNomination(honNom.name); setNewNomFee(honNom.price); } } } }} className="w-full text-left px-4 py-3 rounded-xl flex items-center justify-between cursor-pointer" style={{ backgroundColor: T.cardAlt }}>
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
              <div><label className="block text-[11px] mb-1" style={{ color: T.textSub }}>お名前</label><input type="text" value={ncName} onChange={(e) => setNcName(e.target.value)} placeholder="あとで入力してもOK" className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={{ backgroundColor: T.cardAlt, color: T.text }} /></div>
              <div><label className="block text-[11px] mb-1" style={{ color: T.textSub }}>電話番号</label><input type="tel" value={ncPhone} onChange={(e) => setNcPhone(e.target.value)} placeholder="090-xxxx-xxxx" className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={{ backgroundColor: T.cardAlt, color: T.text }} /></div>
              <div className="flex flex-col gap-2 pt-2">
                {ncName.trim() ? (
                  <button onClick={async () => { const { error } = await supabase.from("customers").insert({ name: ncName.trim(), phone: ncPhone.trim() }); if (!error) { setNewCustName(ncName.trim()); setNewCustPhone(ncPhone.trim()); setShowNewCust(false); setShowNewRes(true); } }} className="w-full py-2.5 bg-gradient-to-r from-[#c3a782] to-[#b09672] text-white text-[12px] rounded-xl cursor-pointer font-medium">登録してオーダーへ</button>
                ) : ncPhone.trim() ? (
                  <button onClick={async () => { const tempName = ncPhone.trim(); const { error } = await supabase.from("customers").insert({ name: tempName, phone: ncPhone.trim() }); if (!error) { setNewCustName(tempName); setNewCustPhone(ncPhone.trim()); setShowNewCust(false); setShowNewRes(true); } }} className="w-full py-2.5 bg-gradient-to-r from-[#c3a782] to-[#b09672] text-white text-[12px] rounded-xl cursor-pointer font-medium">📞 電話番号のみでオーダーへ</button>
                ) : (
                  <button disabled className="w-full py-2.5 text-[12px] rounded-xl opacity-40" style={{ backgroundColor: T.cardAlt, color: T.textMuted }}>名前または電話番号を入力してください</button>
                )}
                <button onClick={() => { setShowNewCust(false); setShowCustSearch(true); }} className="w-full py-2.5 border text-[12px] rounded-xl cursor-pointer" style={{ borderColor: T.border, color: T.textSub }}>戻る</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New Reservation Modal */}
      {showNewRes && (() => {
        const cp = selectedCourse?.price || 0; const optT = newOptions.reduce((s,o)=>s+o.price,0); const newDiscTotal = newDiscounts.reduce((s,d)=>s+d.amount,0); const totalCalc = cp + newNomFee + optT + newExtPrice - newDiscTotal;
        return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowNewRes(false)}>
          <div className="rounded-2xl border p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto animate-[fadeIn_0.25s]" style={{ backgroundColor: T.card, borderColor: T.border }} onClick={(e) => e.stopPropagation()}>
            <h2 className="text-[16px] font-medium mb-1">オーダー登録</h2>
            <p className="text-[11px] mb-5" style={{ color: T.textFaint }}>{newCustName} 様の予約</p>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>顧客名</label><input type="text" value={newCustName} onChange={(e) => setNewCustName(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} /></div>
                <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>📞 電話番号</label><input type="tel" value={newCustPhone} onChange={(e) => setNewCustPhone(e.target.value)} placeholder="090-xxxx-xxxx" className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>セラピスト <span style={{ color: "#c49885" }}>*</span></label><select value={newTherapistId} onChange={(e) => setNewTherapistId(Number(e.target.value))} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none cursor-pointer" style={inputStyle}><option value={0}>選択</option>{therapists.map((t) => (<option key={t.id} value={t.id}>{t.name}</option>))}</select></div>
                <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>👤 受付スタッフ</label><select value={newStaffName} onChange={(e) => { setNewStaffName(e.target.value); localStorage.setItem("last_staff_name", e.target.value); }} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none cursor-pointer" style={inputStyle}><option value="">未選択</option>{staffMembers.map((s) => (<option key={s.id} value={s.name}>{s.name}</option>))}</select></div>
              </div>
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

      {/* Edit Modal */}
      {editRes && (() => {
        const eCp = editSelectedCourse?.price || 0; const eOptT = editOptions.reduce((s,o)=>s+o.price,0); const eDiscTotal = editDiscounts.reduce((s,d)=>s+d.amount,0); const eTotalCalc = eCp + editNomFee + eOptT + editExtPrice - eDiscTotal;
        return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setEditRes(null)}>
          <div className="rounded-2xl border p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto animate-[fadeIn_0.25s]" style={{ backgroundColor: T.card, borderColor: T.border }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-[16px] font-medium">オーダー編集</h2>
              <div className="flex gap-2">
                <button onClick={updateReservation} disabled={editSaving} className="px-4 py-1.5 bg-gradient-to-r from-[#c3a782] to-[#b09672] text-white text-[10px] rounded-lg cursor-pointer disabled:opacity-60">{editSaving ? "更新中..." : "💾 更新"}</button>
                <button onClick={async () => {
                  const thName = therapists.find(t => t.id === editTherapistId)?.name || "";
                  const { data: custInfo } = await supabase.from("customers").select("phone,login_email,self_name").eq("name", editCustName.trim()).maybeSingle();
                  const hasLine = /\sL$/i.test(editCustName.trim()) || /\sL\s/i.test(editCustName.trim());
                  const isMember = !!(custInfo?.login_email);
                  const ra = roomAssigns.find(a => a.therapist_id === editTherapistId);
                  const rm = ra ? allRooms.find(r => r.id === ra.room_id) : null;
                  const bl = rm ? buildings.find(b => b.id === rm.building_id) : null;
                  const st = rm ? stores.find(s => s.id === rm.store_id) : null;
                  const courseWithExt = (editSelectedCourse?.name || editRes.course) + (editExtension ? `＋${editExtension}` : "");
                  const eOptTotal2 = editOptions.reduce((s,o)=>s+o.price,0);
                  const eDiscTotal2 = editDiscounts.reduce((s,d)=>s+d.amount,0);
                  const eTotal2 = (editSelectedCourse?.price || 0) + editNomFee + eOptTotal2 + editExtPrice - eDiscTotal2;
                  setNotifyInfo({ resId: editRes.id, custName: editCustName.trim(), custPhone: custInfo?.phone || "", custEmail: custInfo?.login_email || "", hasLine, isMember, date: editRes.date, startTime: editStart, endTime: editEnd, course: courseWithExt, therapistName: thName, total: eTotal2, nomination: editNomination || "指名なし", discountName: editDiscounts.map(d => d.name).join(",") || "なし", extensionName: editExtension, storeName: st?.name || "", buildingName: bl?.name || "" });
                }} className="px-4 py-1.5 text-[10px] rounded-lg cursor-pointer" style={{ backgroundColor: "#3d6b9f18", color: "#3d6b9f", border: "1px solid #3d6b9f44" }}>📩 通知</button>
              </div>
            </div>
            <p className="text-[11px] mb-3" style={{ color: T.textFaint }}>{editCustName} 様の予約を編集</p>
            {/* ── デュアルステータス ── */}
            <div className="mb-4 space-y-3">
              {/* 👤 お客様の状態 */}
              <div>
                <p className="text-[10px] mb-1.5" style={{ color: T.textSub }}>👤 お客様の状態</p>
                <div className="flex flex-wrap gap-1.5">{([
                  ["unsent","未送信","#888780"],
                  ["web_reservation","WEB予約","#a855f7"],
                  ["summary_unread","概要送信済(未読)","#3b82f6"],
                  ["summary_read","概要送信済(既読)","#2563eb"],
                  ["detail_unread","詳細送信済(未読)","#4a7c59"],
                  ["detail_read","詳細送信済(既読)","#16a34a"],
                ] as const).map(([val,label,color]) => (<button key={val} onClick={() => { setEditCustomerStatus(val); if (editCustomerStatus === "serving" || editCustomerStatus === "completed") { setEditTherapistStatus("unsent"); } }} className="px-2.5 py-1 rounded-lg text-[9px] cursor-pointer" style={{ backgroundColor: editCustomerStatus === val ? color + "22" : T.cardAlt, color: editCustomerStatus === val ? color : T.textMuted, border: `1px solid ${editCustomerStatus === val ? color : T.border}`, fontWeight: editCustomerStatus === val ? 700 : 400 }}>{label}</button>))}</div>
              </div>
              {/* 💆 セラピストの状態 + 🔗 共通 */}
              <div>
                <p className="text-[10px] mb-1.5" style={{ color: T.textSub }}>💆 セラピスト　／　🔗 共通</p>
                <div className="flex flex-wrap gap-1.5">{([
                  ["unsent","未送信","#888780"],
                  ["detail_sent","詳細送信済","#4a7c59"],
                ] as const).map(([val,label,color]) => (<button key={val} onClick={() => { setEditTherapistStatus(val); if (editTherapistStatus === "serving" || editTherapistStatus === "completed") { setEditCustomerStatus("unsent"); } }} className="px-2.5 py-1 rounded-lg text-[9px] cursor-pointer" style={{ backgroundColor: editTherapistStatus === val ? color + "22" : T.cardAlt, color: editTherapistStatus === val ? color : T.textMuted, border: `1px solid ${editTherapistStatus === val ? color : T.border}`, fontWeight: editTherapistStatus === val ? 700 : 400 }}>{label}</button>))}
                  <span style={{ borderLeft: `1px solid ${T.border}`, margin: "0 2px" }} />
                  {([
                  ["serving","接客中","#22c55e"],
                  ["completed","終了","#c3a782"],
                ] as const).map(([val,label,color]) => (<button key={val} onClick={() => { setEditCustomerStatus(val); setEditTherapistStatus(val); setEditStatus(val); }} className="px-2.5 py-1 rounded-lg text-[9px] cursor-pointer" style={{ backgroundColor: (editCustomerStatus === val && editTherapistStatus === val) ? color + "22" : T.cardAlt, color: (editCustomerStatus === val && editTherapistStatus === val) ? color : T.textMuted, border: `1px solid ${(editCustomerStatus === val && editTherapistStatus === val) ? color : T.border}`, fontWeight: (editCustomerStatus === val && editTherapistStatus === val) ? 700 : 400 }}>{label}</button>))}</div>
              </div>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-[10px] mb-1" style={{ color: T.textSub }}>開始時間</label><select value={editStart} onChange={(e) => handleStartChange(e.target.value, true)} className="w-full px-3 py-2 rounded-xl text-[12px] outline-none cursor-pointer" style={inputStyle}>{TIMES_10MIN.map((t) => (<option key={t} value={t}>{minutesToDisplay(timeToMinutes(t))}</option>))}</select></div>
                <div><label className="block text-[10px] mb-1" style={{ color: T.textSub }}>終了時間{editSelectedCourse ? "（自動）" : ""}</label><select value={editEnd} onChange={(e) => setEditEnd(e.target.value)} disabled={!!editSelectedCourse} className="w-full px-3 py-2 rounded-xl text-[12px] outline-none cursor-pointer" style={{ ...inputStyle, color: editSelectedCourse ? "#c3a782" : T.text }}>{TIMES_10MIN.map((t) => (<option key={t} value={t}>{minutesToDisplay(timeToMinutes(t))}</option>))}</select></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-[10px] mb-1" style={{ color: T.textSub }}>顧客名</label><input type="text" value={editCustName} onChange={(e) => setEditCustName(e.target.value)} className="w-full px-3 py-2 rounded-xl text-[12px] outline-none" style={inputStyle} /></div>
                <div><label className="block text-[10px] mb-1" style={{ color: T.textSub }}>📞 電話番号</label><input type="tel" value={editCustPhone} onChange={(e) => setEditCustPhone(e.target.value)} placeholder="090-xxxx-xxxx" className="w-full px-3 py-2 rounded-xl text-[12px] outline-none" style={inputStyle} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-[10px] mb-1" style={{ color: T.textSub }}>セラピスト</label><select value={editTherapistId} onChange={(e) => setEditTherapistId(Number(e.target.value))} className="w-full px-3 py-2 rounded-xl text-[12px] outline-none cursor-pointer" style={inputStyle}>{therapists.map((t) => (<option key={t.id} value={t.id}>{t.name}</option>))}</select></div>
                <div><label className="block text-[10px] mb-1" style={{ color: T.textSub }}>👤 受付スタッフ</label><select value={editStaffName} onChange={(e) => setEditStaffName(e.target.value)} className="w-full px-3 py-2 rounded-xl text-[12px] outline-none cursor-pointer" style={inputStyle}><option value="">未選択</option>{staffMembers.map((s) => (<option key={s.id} value={s.name}>{s.name}</option>))}</select></div>
              </div>
              <div><label className="block text-[10px] mb-1" style={{ color: T.textSub }}>コース <span style={{ color: "#c49885" }}>* 必須</span></label><select value={editCourseId} onChange={(e) => handleCourseChange(Number(e.target.value), true)} className="w-full px-3 py-2 rounded-xl text-[11px] outline-none cursor-pointer" style={inputStyle}><option value={0}>— コースを選択 —</option>{courses.map((c) => (<option key={c.id} value={c.id}>{c.name}（{c.duration}分 / {fmt(c.price)}）</option>))}</select></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-[10px] mb-1" style={{ color: T.textSub }}>指名</label><select value={editNomination} onChange={(e) => { const n = nominations.find(x=>x.name===e.target.value); setEditNomination(e.target.value); setEditNomFee(n?.price||0); }} className="w-full px-3 py-2 rounded-xl text-[11px] outline-none cursor-pointer" style={inputStyle}><option value="">指名なし</option>{nominations.map((n) => (<option key={n.id} value={n.name}>{n.name}（{fmt(n.price)}）</option>))}</select></div>
                <div><label className="block text-[10px] mb-1" style={{ color: T.textSub }}>延長</label><select value={editExtension} onChange={(e) => { const ex = extensions.find(x=>x.name===e.target.value); setEditExtension(e.target.value); setEditExtPrice(ex?.price||0); setEditExtDur(ex?.duration||0); if (ex && editSelectedCourse && editStart) { setEditEnd(minutesToTime(timeToMinutes(editStart) + editSelectedCourse.duration + ex.duration)); } }} className="w-full px-3 py-2 rounded-xl text-[11px] outline-none cursor-pointer" style={inputStyle}><option value="">延長なし</option>{extensions.map((ex) => (<option key={ex.id} value={ex.name}>{ex.name}（{ex.duration}分 / {fmt(ex.price)}）</option>))}</select></div>
              </div>
              <div><label className="block text-[10px] mb-1" style={{ color: T.textSub }}>割引（複数追加可）</label><div className="flex gap-2"><select id="editDiscSelect" className="flex-1 min-w-0 px-3 py-2 rounded-xl text-[11px] outline-none cursor-pointer" style={inputStyle}><option value="">— 割引を選択 —</option>{discounts.filter(d => !editDiscounts.some(ed => ed.name === d.name)).map((d) => (<option key={d.id} value={d.name}>{d.name}（{d.type==="percent" ? d.amount+"%" : fmt(d.amount)}）</option>))}</select><button onClick={() => { const sel = (document.getElementById("editDiscSelect") as HTMLSelectElement)?.value; if (!sel) return; const d = discounts.find(x=>x.name===sel); if (!d) return; const amt = d.type==="percent" ? Math.round(eCp * d.amount / 100) : d.amount; setEditDiscounts([...editDiscounts, { name: sel, amount: amt }]); (document.getElementById("editDiscSelect") as HTMLSelectElement).value = ""; }} className="flex-shrink-0 px-4 py-2 rounded-xl text-[10px] cursor-pointer font-medium" style={{ backgroundColor: "#c4555518", color: "#c45555", border: "1px solid #c4555544" }}>+ 追加</button></div></div>
              {editDiscounts.length > 0 && <div className="flex flex-wrap gap-2">{editDiscounts.map((d, i) => <div key={i} className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-[10px]" style={{ backgroundColor: "#c4555518", color: "#c45555", border: "1px solid #c4555544" }}><span>{d.name}（-{fmt(d.amount)}）</span><button onClick={() => setEditDiscounts(editDiscounts.filter((_, j) => j !== i))} className="cursor-pointer" style={{ background: "none", border: "none", color: "#c45555", fontWeight: 700, padding: 0, fontSize: 12 }}>×</button></div>)}<p className="text-[10px] w-full" style={{ color: "#c45555" }}>割引合計: -{fmt(eDiscTotal)}</p></div>}
              <div><label className="block text-[10px] mb-1" style={{ color: T.textSub }}>オプション（複数選択可）</label><div className="flex flex-wrap gap-1.5">{options.map((o) => { const sel = editOptions.some(x=>x.name===o.name); return <button key={o.id} onClick={() => { if (sel) setEditOptions(editOptions.filter(x=>x.name!==o.name)); else setEditOptions([...editOptions, { name: o.name, price: o.price }]); }} className="px-2.5 py-1 rounded-xl text-[9px] cursor-pointer" style={{ backgroundColor: sel ? "#85a8c418" : T.cardAlt, color: sel ? "#85a8c4" : T.textMuted, border: `1px solid ${sel ? "#85a8c4" : T.border}`, fontWeight: sel ? 600 : 400 }}>{o.name}（{fmt(o.price)}）</button>; })}</div>{editOptions.length > 0 && <p className="text-[9px] mt-1" style={{ color: "#85a8c4" }}>オプション合計: {fmt(eOptT)}</p>}</div>
              <div><label className="block text-[10px] mb-1" style={{ color: T.textSub }}>備考</label><div style={{ position: "relative" }}><textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} placeholder="メモ・備考を入力" rows={3} className="w-full px-3 py-2 rounded-xl text-[11px] outline-none resize-y" style={inputStyle} /><div style={{ position: "absolute", left: 12, right: 12, top: 36, borderTop: "1px dashed #f59e0b44", pointerEvents: "none" }} /><p className="text-[8px] mt-1" style={{ color: T.textFaint }}>⚠ 点線より上がタイムチャートに表示されます</p></div></div>
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
              {/* ポイントプレビュー */}
              {ptSettings && (() => {
                const previewPts = Math.floor(eTotalCalc / (ptSettings.earn_per_yen || 1000)) * (ptSettings.earn_points || 20);
                const isRainy = ptSettings.rainy_day_active;
                const rainyMult = ptSettings.rainy_day_multiplier || 2.0;
                const previewWithRainy = isRainy ? Math.floor(previewPts * rainyMult) : previewPts;
                const alreadyAwarded = (editRes as any).customer_status === "completed" || (editRes as any).status === "completed";
                return (
                <div className="rounded-xl p-4" style={{ backgroundColor: "#d4a84308", border: "1px solid #d4a84330" }}>
                  <p className="text-[11px] font-medium mb-2" style={{ color: "#d4a843" }}>🎁 ポイント</p>
                  <div className="space-y-1.5 text-[11px]">
                    <div className="flex justify-between"><span>自動付与（¥{(ptSettings.earn_per_yen||1000).toLocaleString()}={ptSettings.earn_points||20}pt）</span><span style={{ color: "#d4a843", fontWeight: 600 }}>+{previewPts}pt</span></div>
                    {isRainy && <div className="flex justify-between"><span>☔ 雨の日ボーナス（×{rainyMult}）</span><span style={{ color: "#d4a843", fontWeight: 600 }}>+{previewWithRainy}pt</span></div>}
                    <p className="text-[9px]" style={{ color: "#888" }}>※曜日・期間・誕生月・ランク倍率は終了時に自動計算されます</p>
                    {alreadyAwarded && <p className="text-[9px] px-2 py-1 rounded-lg inline-block" style={{ backgroundColor: "#4a7c5918", color: "#4a7c59" }}>✅ ポイント付与済み</p>}
                    <div className="pt-2 mt-1" style={{ borderTop: "1px dashed #d4a84330" }}>
                      <p className="text-[10px] font-medium mb-1.5" style={{ color: "#d4a843" }}>➕➖ 手動ポイント調整</p>
                      <div className="flex gap-2 items-end">
                        <div className="w-[100px]"><label className="block text-[9px] mb-0.5" style={{ color: "#888" }}>ポイント数</label><input type="text" inputMode="numeric" value={editManualPoints} onChange={e => setEditManualPoints(e.target.value.replace(/[^0-9-]/g, ""))} placeholder="例: 100 or -50" className="w-full px-2 py-2 rounded-lg text-[11px] outline-none" style={{ backgroundColor: "#d4a84310", color: "#d4a843", border: "1px solid #d4a84330" }} /></div>
                        <div className="flex-1"><label className="block text-[9px] mb-0.5" style={{ color: "#888" }}>理由</label><input type="text" value={editManualPointDesc} onChange={e => setEditManualPointDesc(e.target.value)} placeholder="例: アンケート回答" className="w-full px-2 py-2 rounded-lg text-[11px] outline-none" style={{ backgroundColor: "#d4a84310", color: "#d4a843", border: "1px solid #d4a84330" }} /></div>
                      </div>
                    </div>
                  </div>
                </div>);
              })()}
              {editMsg && <div className="px-4 py-3 rounded-xl text-[12px]" style={{ backgroundColor: editMsg.includes("失敗") ? "#c4988518" : "#7ab88f18", color: editMsg.includes("失敗") ? "#c49885" : "#5a9e6f" }}>{editMsg}</div>}
              <div className="flex gap-3 pt-2">
                <button onClick={updateReservation} disabled={editSaving} className="px-6 py-2.5 bg-gradient-to-r from-[#c3a782] to-[#b09672] text-white text-[12px] rounded-xl cursor-pointer disabled:opacity-60">{editSaving ? "更新中..." : "更新する"}</button>
                <button onClick={async () => {
                  const thName = therapists.find(t => t.id === editTherapistId)?.name || "";
                  const { data: custInfo } = await supabase.from("customers").select("phone,login_email,self_name").eq("name", editCustName.trim()).maybeSingle();
                  const hasLine = /\sL$/i.test(editCustName.trim()) || /\sL\s/i.test(editCustName.trim());
                  const isMember = !!(custInfo?.login_email);
                  const ra = roomAssigns.find(a => a.therapist_id === editTherapistId);
                  const rm = ra ? allRooms.find(r => r.id === ra.room_id) : null;
                  const bl = rm ? buildings.find(b => b.id === rm.building_id) : null;
                  const st = rm ? stores.find(s => s.id === rm.store_id) : null;
                  const courseWithExt = (editSelectedCourse?.name || editRes.course) + (editExtension ? `＋${editExtension}` : "");
                  const eOptTotal = editOptions.reduce((s,o)=>s+o.price,0);
                  const eDiscTotal = editDiscounts.reduce((s,d)=>s+d.amount,0);
                  const eTotal = (editSelectedCourse?.price || 0) + editNomFee + eOptTotal + editExtPrice - eDiscTotal;
                  setNotifyInfo({ resId: editRes.id, custName: editCustName.trim(), custPhone: custInfo?.phone || "", custEmail: custInfo?.login_email || "", hasLine, isMember, date: editRes.date, startTime: editStart, endTime: editEnd, course: courseWithExt, therapistName: thName, total: eTotal, nomination: editNomination || "指名なし", discountName: editDiscounts.map(d => d.name).join(",") || "なし", extensionName: editExtension, storeName: st?.name || "", buildingName: bl?.name || "" });
                }} className="px-5 py-2.5 text-[12px] rounded-xl cursor-pointer" style={{ backgroundColor: "#3d6b9f18", color: "#3d6b9f", border: "1px solid #3d6b9f44" }}>📩 通知</button>
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
        const totalNomFee = tRes.reduce((s,r) => s + ((r as any).nomination_fee || 0), 0);
        const totalNom = tRes.reduce((s,r) => { const nom = nominations.find(n => n.name === (r as any).nomination); return s + (nom?.therapist_back || (r as any).nomination_fee || 0); }, 0);
        const totalNomBack = tRes.reduce((s,r) => { const nom = nominations.find(n => n.name === (r as any).nomination); return s + (nom?.back_amount || 0); }, 0);
        
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
        const welfareFee = (() => {
          if (tRes.length === 0) return 0;
          const base = (settleTh as any).welfare_fee ?? 500;
          const ordTh = (settleTh as any).welfare_fee_orders_threshold || 0;
          const ordAmt = (settleTh as any).welfare_fee_orders_amount || 0;
          const payTh = (settleTh as any).welfare_fee_pay_threshold || 0;
          const payAmt = (settleTh as any).welfare_fee_pay_amount || 0;
          if (payTh > 0 && backTotal >= payTh) return payAmt;
          if (ordTh > 0 && tRes.length >= ordTh) return ordAmt;
          return base;
        })();
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
                  <div className="flex justify-between" style={{ color: "#c45555" }}><span>③ 備品・リネン代</span><span>-{fmt(welfareFee)}</span></div>
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
              {(() => { const roomReps = replenishments.filter(r => r.room_id === showReplenish); if (roomReps.length === 0) return null; return (
                <div className="mt-4 pt-3" style={{ borderTop: `1px solid ${T.border}` }}>
                  <p className="text-[10px] font-medium mb-2" style={{ color: T.textSub }}>📋 補充履歴（{allRooms.find(r => r.id === showReplenish)?.name || ""}）</p>
                  <div className="space-y-1">
                    {roomReps.map(r => (
                      <div key={r.id} className="flex justify-between items-center py-1.5 px-2 rounded-lg text-[11px]" style={{ backgroundColor: T.cardAlt }}>
                        <span>{r.staff_name ? `👤${r.staff_name}` : ""}{r.created_at ? <span style={{ color: T.textFaint, fontSize: 9 }}> {new Date(r.created_at).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}</span> : ""}</span>
                        <div className="flex items-center gap-2">
                          <span style={{ color: "#22c55e", fontWeight: 600 }}>{fmt(r.amount)}</span>
                          <button onClick={async () => { if (!confirm(`${fmt(r.amount)} の補充を取り消しますか？`)) return; await supabase.from("room_cash_replenishments").delete().eq("id", r.id); toast.show("補充を取り消しました", "info"); setShowReplenish(null); fetchData(); }} className="text-[8px] px-1.5 py-0.5 rounded cursor-pointer" style={{ backgroundColor: "#c4555512", color: "#c45555", border: "1px solid #c4555533" }}>取消</button>
                        </div>
                      </div>
                    ))}
                    <div className="flex justify-between pt-1 font-bold text-[11px]" style={{ borderTop: `1px dashed ${T.border}` }}><span>合計</span><span style={{ color: "#22c55e" }}>{fmt(roomReps.reduce((s, r) => s + r.amount, 0))}</span></div>
                  </div>
                </div>
              ); })()}
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
      {/* Shift Request Notification Popup */}
      {showShiftNotif && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-start justify-center z-50 pt-20 p-4" onClick={() => setShowShiftNotif(false)}>
          <div className="rounded-2xl border w-full max-w-lg max-h-[70vh] overflow-y-auto animate-[fadeIn_0.25s]" style={{ backgroundColor: T.card, borderColor: T.border }} onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: `1px solid ${T.border}` }}>
              <h2 className="text-[15px] font-medium">📝 出勤希望一覧</h2>
              <button onClick={() => setShowShiftNotif(false)} className="text-[14px] cursor-pointer p-2" style={{ color: T.textSub }}>✕</button>
            </div>
            <div className="px-6 py-4">
              {pendingShiftReqs.length === 0 ? (
                <p className="text-[12px] text-center py-8" style={{ color: T.textFaint }}>未処理の出勤希望はありません</p>
              ) : (() => {
                const grouped: Record<number, ShiftReq[]> = {};
                pendingShiftReqs.forEach(r => { if (!grouped[r.therapist_id]) grouped[r.therapist_id] = []; grouped[r.therapist_id].push(r); });
                return (
                  <div className="space-y-4">
                    {Object.entries(grouped).map(([tid, reqs]) => {
                      const t = therapists.find(x => x.id === Number(tid));
                      const sorted = [...reqs].sort((a, b) => a.date.localeCompare(b.date));
                      const weekLabel = sorted[0]?.week_start ? (() => { const ws = new Date(sorted[0].week_start + "T00:00:00"); return `${ws.getMonth()+1}/${ws.getDate()}〜`; })() : "";
                      return (
                        <div key={tid} className="rounded-xl border p-4" style={{ borderColor: "#f59e0b33", backgroundColor: "#f59e0b08" }}>
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <span className="text-[14px] font-medium">{t?.name || "不明"}</span>
                              <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: "#f59e0b18", color: "#f59e0b" }}>未処理 {weekLabel}</span>
                            </div>
                            <span className="text-[9px]" style={{ color: T.textMuted }}>{sorted[0]?.updated_at ? new Date(sorted[0].updated_at).toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) + " 提出" : ""}</span>
                          </div>
                          <div className="space-y-1.5">
                            {sorted.map(r => {
                              const d = new Date(r.date + "T00:00:00");
                              const days = ["日","月","火","水","木","金","土"];
                              const store = stores.find(s => s.id === r.store_id);
                              return (
                                <div key={r.id} className="flex items-center justify-between rounded-lg px-3 py-2 text-[12px]" style={{ backgroundColor: T.card }}>
                                  <span className="font-medium">{d.getMonth()+1}/{d.getDate()}({days[d.getDay()]})</span>
                                  <span style={{ color: T.textSub }}>{r.start_time?.slice(0,5)} 〜 {r.end_time?.slice(0,5)}</span>
                                  {store && <span className="text-[10px]" style={{ color: T.textMuted }}>{store.name}</span>}
                                  {r.notes && <span className="text-[10px]" style={{ color: "#f59e0b" }}>📝 {r.notes}</span>}
                                </div>
                              );
                            })}
                          </div>
                          <div className="flex gap-2 mt-3">
                            <button onClick={() => { router.push("/shifts"); }} className="px-4 py-2 text-[11px] rounded-lg cursor-pointer" style={{ backgroundColor: "#4a7c5918", color: "#4a7c59" }}>シフト管理で確認</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Reservation Notification Popup — Full Spec */}
      {notifyInfo && (() => {
        const ni = notifyInfo;
        const d = new Date(ni.date + "T00:00:00"); const days = ["日","月","火","水","木","金","土"];
        const dateStr = `${String(d.getMonth()+1).padStart(2,"0")}/${String(d.getDate()).padStart(2,"0")}（${days[d.getDay()]}）`;
        const dateFull = `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日（${days[d.getDay()]}）`;
        const cleanName = ni.custName.replace(/\s*L$/i, "").replace(/\s+\d+～\d+歳$/, "");
        // URL判定: DB設定の日数 or デフォルト1日
        const now = new Date(); const h = now.getHours();
        const today = h < 5 ? new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1) : new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const diff = Math.floor((d.getTime() - today.getTime()) / 86400000);
        const showUrl = diff <= ntUrlDays;
        // 場所URL切替（DB値使用）
        const locUrl = ni.storeName.includes("豊橋") ? ntLocToyohashi : ni.buildingName.includes("マイコート") ? ntLocMycourt : ntLocOasis;
        // 条件行の値を計算
        const nomLine = ni.nomination && ni.nomination !== "フリー" && ni.nomination !== "指名なし" ? `\n指名 : ${ni.nomination}` : "";
        const discLine = ni.discountName && ni.discountName !== "なし" ? `\n割引 : ${ni.discountName}` : "";
        const thLine = ni.nomination !== "フリー" ? `\n${ni.therapistName}セラピスト` : "";
        const senderLine = notifySender ? `\n\n送信者 : ${notifySender}` : "";
        // テンプレート変数マッピング
        const ra = roomAssigns.find(a => a.therapist_id === therapists.find(t => t.name === ni.therapistName)?.id);
        const rm = ra ? allRooms.find(r => r.id === ra.room_id) : null;
        const bl = rm ? buildings.find(b => b.id === rm.building_id) : null;
        const roomName = rm?.name || "";
        const buildingName = bl?.name || "";
        const applyTemplate = (tpl: string) => {
          let text = tpl;
          const vars: Record<string, string> = {
            "{お客様名}": cleanName, "{日時}": dateFull, "{日付}": dateStr,
            "{開始時刻}": ni.startTime?.slice(0,5) || "", "{終了時刻}": ni.endTime?.slice(0,5) || "",
            "{コース}": ni.course, "{指名}": ni.nomination || "指名なし", "{割引}": ni.discountName || "なし",
            "{店舗名}": ni.storeName || "チョップ", "{金額}": ni.total.toLocaleString(),
            "{送信者}": notifySender, "{セラピスト名}": ni.therapistName, "{場所URL}": locUrl,
            "{ルーム名}": roomName, "{ビル名}": buildingName,
            "{お客様リンク}": `https://t-manage.vercel.app/mypage/customer?name=${encodeURIComponent(cleanName)}`,
          };
          text = text.replace(/\{指名行\}/g, nomLine);
          text = text.replace(/\{割引行\}/g, discLine);
          text = text.replace(/\{セラピスト行\}/g, thLine);
          text = text.replace(/\{送信者行\}/g, senderLine);
          for (const [k, v] of Object.entries(vars)) text = text.replaceAll(k, v);
          return text;
        };
        // DBテンプレート（5種）
        const staffTpl = ntTemplates.find(t => t.template_key === "staff");
        const custUrlTpl = ntTemplates.find(t => t.template_key === "customer_url");
        const custNoUrlTpl = ntTemplates.find(t => t.template_key === "customer_no_url");
        const custDetailUrlTpl = ntTemplates.find(t => t.template_key === "customer_detail_url");
        const custDetailNoUrlTpl = ntTemplates.find(t => t.template_key === "customer_detail_no_url");
        const custLink = `https://t-manage.vercel.app/mypage/customer?name=${encodeURIComponent(cleanName)}`;
        const staffMsg = staffTpl ? applyTemplate(staffTpl.body) : `お疲れ様です！\n\nお時間 : ${dateFull} ${ni.startTime?.slice(0,5)}～${ni.endTime?.slice(0,5)}\n\nお客様 : ${cleanName}\n\nコース : ${ni.course}\n\n割引 : ${ni.discountName}\n\n指名 : ${ni.nomination}\n\n店舗名 : ${ni.storeName || "チョップ"}\n\n金額 : ${ni.total.toLocaleString()}円\n\nお客様情報 : ${custLink}\n\nよろしくお願いします。${senderLine}`;
        // 概要テンプレート
        const custMsgUrl = custUrlTpl ? applyTemplate(custUrlTpl.body) : `アンジュスパです。\n\n※予約内容を確認されましたらお手数ですがお返事をお願い致します。\n\nお時間 : ${dateStr} ${ni.startTime?.slice(0,5)}～${ni.endTime?.slice(0,5)}\nコース : ${ni.course}${nomLine}${discLine}\n店舗名 : ${ni.storeName || "チョップ"}\n金額 : ${ni.total.toLocaleString()}円${thLine}\n\n場所等はリンクURLからご確認ください\n${locUrl}\n\n※リンクが開けない場合はWEBで「シークレットモード」で開いていただくか\n「Yahoo」の検索ページでURLを張り付けて検索をお願いします。\n\n当店より、ご来店時のお願いでございます。\n当店は近隣に居住されている方もいらっしゃいます。\nつきましては、施術中はお静かにお過ごしいただけますよう、ご理解とご協力をお願い申し上げます。\n\n皆様に心地よい時間をお過ごしいただけるよう努めてまいります。\n当日のご来店を心よりお待ちしております。`;
        const custMsgNoUrl = custNoUrlTpl ? applyTemplate(custNoUrlTpl.body) : `アンジュスパです。\n\n※予約内容を確認されましたらお手数ですがお返事をお願い致します\n\nお時間 : ${dateStr} ${ni.startTime?.slice(0,5)}～${ni.endTime?.slice(0,5)}\nコース : ${ni.course}${nomLine}${discLine}\n店舗名 : ${ni.storeName || "チョップ"}\n金額 : ${ni.total.toLocaleString()}円${thLine}\n\n当日のルーム等詳細につきましては\n前日の夜、または当日の11時半までにご連絡致しますので\nご確認よろしくお願い致します🙇‍♂️`;
        // 詳細テンプレート
        const custMsgDetailUrl = custDetailUrlTpl ? applyTemplate(custDetailUrlTpl.body) : `アンジュスパです。\n\n本日のご予約詳細をお知らせします。\n\nお時間 : ${dateStr} ${ni.startTime?.slice(0,5)}～${ni.endTime?.slice(0,5)}\nコース : ${ni.course}${nomLine}${discLine}\n店舗名 : ${ni.storeName || "チョップ"}\n金額 : ${ni.total.toLocaleString()}円${thLine}\n\n場所はこちら\n${locUrl}\n${roomName ? `ルーム : ${roomName}` : ""}${buildingName ? `\nビル : ${buildingName}` : ""}\n\n当日のご来店を心よりお待ちしております。`;
        const custMsgDetailNoUrl = custDetailNoUrlTpl ? applyTemplate(custDetailNoUrlTpl.body) : `アンジュスパです。\n\n本日のご予約詳細をお知らせします。\n\nお時間 : ${dateStr} ${ni.startTime?.slice(0,5)}～${ni.endTime?.slice(0,5)}\nコース : ${ni.course}${nomLine}${discLine}\n店舗名 : ${ni.storeName || "チョップ"}\n金額 : ${ni.total.toLocaleString()}円${thLine}\n${roomName ? `\nルーム : ${roomName}` : ""}${buildingName ? `\nビル : ${buildingName}` : ""}\n\n当日のルーム等詳細が確定次第、再度ご連絡いたします。`;
        // モード + URL有無でメッセージ選択
        const custMsg = notifyMode === "detail"
          ? (showUrl ? custMsgDetailUrl : custMsgDetailNoUrl)
          : (showUrl ? custMsgUrl : custMsgNoUrl);

        // ── 確認リンク生成＆ステータス更新 ──
        const prepareCustomerNotify = async (msg: string) => {
          if (!ni.resId) return msg;
          try {
            const { data: resData } = await supabase.from("reservations").select("confirmation_token, customer_status").eq("id", ni.resId).maybeSingle();
            let token = resData?.confirmation_token;
            if (!token) {
              token = Math.random().toString(36).slice(2) + Date.now().toString(36);
              await supabase.from("reservations").update({ confirmation_token: token }).eq("id", ni.resId);
            }
            // ステータスを未読に更新
            const cs = resData?.customer_status || "unsent";
            let newCs = cs;
            if (notifyMode === "summary") {
              if (cs === "unsent" || cs === "web_reservation") newCs = "summary_unread";
            } else {
              if (["unsent","web_reservation","summary_unread","summary_read"].includes(cs)) newCs = "detail_unread";
            }
            if (newCs !== cs) {
              await supabase.from("reservations").update({ customer_status: newCs }).eq("id", ni.resId);
            }
            const confirmUrl = `${window.location.origin}/reservation-confirm?token=${token}`;
            return `▼ ご予約確認はこちら（タップで確認）\n${confirmUrl}\n\n${msg}`;
          } catch (e) {
            console.error("確認リンク生成エラー:", e);
            return msg;
          }
        };

        return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setNotifyInfo(null)} data-tm-notify="true" data-tm-custname={cleanName} data-tm-therapist={ni.therapistName} data-tm-phone={ni.custPhone || ""}>
          <div className="rounded-2xl border w-full max-w-lg max-h-[90vh] overflow-y-auto animate-[fadeIn_0.25s]" style={{ backgroundColor: T.card, borderColor: T.border }} onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: `1px solid ${T.border}` }}>
              <div>
                <h2 className="text-[15px] font-medium">📩 予約確認通知</h2>
                <p className="text-[11px] mt-0.5" style={{ color: T.textMuted }}>{cleanName} 様 | {dateStr} {ni.startTime?.slice(0,5)}〜 | {showUrl ? "URL付き" : "URLなし"}</p>
              </div>
              <button onClick={() => setNotifyInfo(null)} className="text-[14px] cursor-pointer p-2" style={{ color: T.textSub }}>✕</button>
            </div>
            <div className="px-6 py-4">
              {/* Tab */}
              <div className="flex gap-2 mb-3">
                <button onClick={() => setNotifyTab("customer")} className="flex-1 py-2 rounded-xl text-[12px] cursor-pointer" style={{ backgroundColor: notifyTab === "customer" ? "#c3a78222" : T.cardAlt, color: notifyTab === "customer" ? "#c3a782" : T.textMuted, fontWeight: notifyTab === "customer" ? 600 : 400 }}>👤 お客様向け</button>
                <button onClick={() => setNotifyTab("staff")} className="flex-1 py-2 rounded-xl text-[12px] cursor-pointer" style={{ backgroundColor: notifyTab === "staff" ? "#85a8c422" : T.cardAlt, color: notifyTab === "staff" ? "#85a8c4" : T.textMuted, fontWeight: notifyTab === "staff" ? 600 : 400 }}>💼 セラピスト向け</button>
              </div>

              {/* 概要/詳細モード切替（お客様タブのみ） */}
              {notifyTab === "customer" && (
                <div className="flex gap-2 mb-3">
                  <button onClick={() => setNotifyMode("summary")} className="flex-1 py-1.5 rounded-lg text-[11px] cursor-pointer" style={{ backgroundColor: notifyMode === "summary" ? "#3d6b9f18" : T.cardAlt, color: notifyMode === "summary" ? "#3d6b9f" : T.textMuted, border: `1px solid ${notifyMode === "summary" ? "#3d6b9f44" : T.border}`, fontWeight: notifyMode === "summary" ? 600 : 400 }}>📝 概要通知</button>
                  <button onClick={() => setNotifyMode("detail")} className="flex-1 py-1.5 rounded-lg text-[11px] cursor-pointer" style={{ backgroundColor: notifyMode === "detail" ? "#4a7c5918" : T.cardAlt, color: notifyMode === "detail" ? "#4a7c59" : T.textMuted, border: `1px solid ${notifyMode === "detail" ? "#4a7c5944" : T.border}`, fontWeight: notifyMode === "detail" ? 600 : 400 }}>📋 詳細通知</button>
                </div>
              )}

              {/* 通知方法バッジ（推奨方法を表示） */}
              <div className="rounded-xl p-3 mb-3 text-[11px]" style={{ backgroundColor: ni.hasLine ? "#06C75512" : ni.isMember ? "#3b82f612" : "#f59e0b12", border: `1px solid ${ni.hasLine ? "#06C75533" : ni.isMember ? "#3b82f633" : "#f59e0b33"}` }}>
                <span style={{ color: ni.hasLine ? "#06C755" : ni.isMember ? "#3b82f6" : "#f59e0b" }}>
                  {ni.hasLine ? "💬 LINE登録済み（推奨）" : ni.isMember ? "✉️ マイページ会員（推奨: メール）" : "📱 SMS対象（推奨）"}
                  {ni.custPhone ? ` — ${ni.custPhone}` : ""}
                </span>
              </div>

              {/* メッセージプレビュー */}
              <div data-tm-preview="true" className="rounded-xl p-4 mb-4 text-[11px] whitespace-pre-wrap leading-relaxed max-h-[250px] overflow-y-auto" style={{ backgroundColor: T.cardAlt, color: T.textSub, fontFamily: "var(--font-mono, monospace)" }}>
                {notifyTab === "customer" && ni.resId ? (<><span style={{ color: "#c3a782" }}>▼ ご予約確認はこちら（タップで確認）{"\n"}https://t-manage.vercel.app/reservation-confirm?token=...{"\n\n"}</span>{custMsg}</>) : (notifyTab === "customer" ? custMsg : staffMsg)}
              </div>

              {/* 送信者名（セラピスト向け） */}
              {notifyTab === "staff" && (
                <div className="mb-3">
                  <label className="block text-[10px] mb-1" style={{ color: T.textMuted }}>送信者名（受付スタッフ）</label>
                  <select value={notifySender} onChange={e => { setNotifySender(e.target.value); localStorage.setItem("notify_sender", e.target.value); }}
                    className="w-full px-3 py-2 rounded-lg text-[12px] outline-none cursor-pointer" style={{ backgroundColor: T.cardAlt, color: T.text, border: `1px solid ${T.border}` }}>
                    <option value="">送信者なし</option>
                    {staffMembers.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                  </select>
                </div>
              )}

              {/* 送信ボタン — 全方法を常に表示 */}
              <div className="space-y-2">
                {notifyTab === "customer" ? (<>
                  {/* LINE（名前にLがある場合） */}
                  {ni.hasLine && <button onClick={async () => {
                    const msg = await prepareCustomerNotify(custMsg);
                    navigator.clipboard.writeText(msg);
                    toast.show("LINE用メッセージをコピーしました！", "success");
                  }} className="w-full py-3 rounded-xl text-[13px] font-medium cursor-pointer" style={{ backgroundColor: "#06C75518", color: "#06C755", border: "1px solid #06C75544" }}>💬 LINE用テキストをコピー</button>}

                  {/* メール（マイページ会員の場合） */}
                  {ni.isMember && ni.custEmail && <button onClick={async () => {
                    const msg = await prepareCustomerNotify(custMsg);
                    const s = encodeURIComponent("【アンジュスパ】ご予約確認");
                    const b = encodeURIComponent(msg);
                    window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${ni.custEmail}&su=${s}&body=${b}`, "_blank");
                  }} className="w-full py-3 rounded-xl text-[13px] font-medium cursor-pointer" style={{ backgroundColor: "#3b82f618", color: "#3b82f6", border: "1px solid #3b82f644" }}>✉️ Gmailで送信（{ni.custEmail}）</button>}

                  {/* SMS①②（電話番号がある場合 — 常に表示） */}
                  {ni.custPhone && <div className="flex gap-2">
                    <button onClick={async () => {
                      const msg = await prepareCustomerNotify(custMsg);
                      navigator.clipboard.writeText(msg);
                      toast.show(`SMS①コピー完了（${ni.custPhone}）`, "success");
                    }} className="flex-1 py-3 rounded-xl text-[12px] font-medium cursor-pointer" style={{ backgroundColor: "#f59e0b18", color: "#f59e0b", border: "1px solid #f59e0b44" }}>📱 SMS①コピー</button>
                    <button onClick={async () => {
                      const msg = await prepareCustomerNotify(custMsg);
                      await navigator.clipboard.writeText(msg);
                      const bridgeUrl = `${window.location.origin}/sms-bridge#phone=${encodeURIComponent(ni.custPhone || "")}&body=${encodeURIComponent(msg)}`;
                      const edgeUrl = `microsoft-edge:${bridgeUrl}`;
                      window.open(edgeUrl);
                      toast.show(`SMS②メッセージコピー＆Edge起動`, "success");
                    }} className="flex-1 py-3 rounded-xl text-[12px] font-medium cursor-pointer" style={{ backgroundColor: "#8b5cf618", color: "#8b5cf6", border: "1px solid #8b5cf644" }}>📲 SMS②Edge</button>
                  </div>}

                  <button onClick={async () => {
                    const msg = await prepareCustomerNotify(custMsg);
                    navigator.clipboard.writeText(msg);
                    toast.show("テキストをコピーしました！", "success");
                  }} className="w-full py-2 rounded-xl text-[11px] cursor-pointer" style={{ color: T.textMuted, backgroundColor: T.cardAlt }}>📋 テキストだけコピー</button>
                </>) : (<>
                  <button onClick={() => { navigator.clipboard.writeText(staffMsg); toast.show("セラピスト向けメッセージをコピーしました！", "success"); }} className="w-full py-3 rounded-xl text-[13px] font-medium cursor-pointer" style={{ backgroundColor: "#85a8c418", color: "#85a8c4", border: "1px solid #85a8c444" }}>💬 セラピストLINE用コピー</button>
                </>)}
                <button onClick={() => setNotifyInfo(null)} className="w-full py-2.5 rounded-xl text-[12px] cursor-pointer" style={{ color: T.textMuted }}>閉じる</button>
              </div>
            </div>
          </div>
        </div>);
      })()}

      {/* ===== ステータス一覧モーダル ===== */}
      {showStatusList && (() => {
        const custStatusLabel: Record<string,string> = { unsent:"未送信", web_reservation:"WEB予約", summary_unread:"概要未読", summary_read:"概要既読", detail_unread:"詳細未読", detail_read:"詳細既読", serving:"接客中", completed:"終了" };
        const therStatusLabel: Record<string,string> = { unsent:"未送信", detail_sent:"送信済", serving:"接客中", completed:"終了" };
        const custStatusColor: Record<string,string> = { unsent:"#888780", web_reservation:"#a855f7", summary_unread:"#3b82f6", summary_read:"#2563eb", detail_unread:"#4a7c59", detail_read:"#16a34a", serving:"#22c55e", completed:"#c3a782" };
        const therStatusColor: Record<string,string> = { unsent:"#888780", detail_sent:"#4a7c59", serving:"#22c55e", completed:"#c3a782" };
        const sortedRes = [...reservations].sort((a, b) => a.start_time.localeCompare(b.start_time));
        const thGroups: Record<number, typeof reservations> = {};
        sortedRes.forEach(r => { if (!thGroups[r.therapist_id]) thGroups[r.therapist_id] = []; thGroups[r.therapist_id].push(r); });
        return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowStatusList(false)}>
          <div className="rounded-2xl border w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-[fadeIn_0.25s]" style={{ backgroundColor: T.card, borderColor: T.border }} onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-3 flex items-center justify-between sticky top-0 z-10" style={{ backgroundColor: T.card, borderBottom: `1px solid ${T.border}` }}>
              <div>
                <h2 className="text-[15px] font-medium">📋 ステータス一覧</h2>
                <p className="text-[10px]" style={{ color: T.textMuted }}>{dateDisplay}　{reservations.length}件の予約</p>
              </div>
              <button onClick={() => setShowStatusList(false)} className="text-[14px] cursor-pointer p-2" style={{ color: T.textSub }}>✕</button>
            </div>
            <div className="flex" style={{ borderBottom: `1px solid ${T.border}` }}>
              {(["therapist","customer"] as const).map(tab => (
                <button key={tab} onClick={() => setStatusListTab(tab)} className="flex-1 py-2.5 text-[12px] cursor-pointer" style={{ background: "none", border: "none", borderBottom: statusListTab === tab ? "2px solid #c3a782" : "2px solid transparent", color: statusListTab === tab ? T.text : T.textMuted, fontWeight: statusListTab === tab ? 600 : 400 }}>
                  {tab === "therapist" ? "💆 セラピストビュー" : "👤 お客様ビュー"}
                </button>
              ))}
            </div>
            <div>
              {statusListTab === "therapist" ? (
                Object.entries(thGroups).map(([thId, rList]) => {
                  const th = therapists.find(t => t.id === Number(thId));
                  return (<div key={thId}>
                    <div className="px-4 py-2 text-[11px] font-medium" style={{ backgroundColor: T.cardAlt, color: T.textSub }}>
                      💆 {th?.name || "不明"}（{rList.length}件）
                    </div>
                    {rList.map(r => {
                      const cs = (r as any).customer_status || "unsent";
                      const ts = (r as any).therapist_status || "unsent";
                      const cc = custStatusColor[cs] || "#888780";
                      const tc = therStatusColor[ts] || "#888780";
                      return (
                        <div key={r.id} className="flex items-center gap-2 px-4 py-2.5" style={{ borderBottom: `0.5px solid ${T.border}` }}>
                          <span className="text-[12px] font-medium" style={{ minWidth: 85 }}>{r.start_time?.slice(0,5)}〜{r.end_time?.slice(0,5)}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-[12px] font-medium truncate" style={{ color: T.text }}>{r.customer_name}</p>
                            <p className="text-[10px] truncate" style={{ color: T.textMuted }}>{r.course}</p>
                          </div>
                          <span className="text-[8px] px-2 py-0.5 rounded" style={{ backgroundColor: cc + "22", color: cc, whiteSpace: "nowrap" }}>客:{custStatusLabel[cs] || cs}</span>
                          <span className="text-[8px] px-2 py-0.5 rounded" style={{ backgroundColor: tc + "22", color: tc, whiteSpace: "nowrap" }}>セ:{therStatusLabel[ts] || ts}</span>
                          <button onClick={() => { setShowStatusList(false); openEdit(r); }} className="text-[9px] px-2.5 py-1 rounded cursor-pointer" style={{ backgroundColor: T.cardAlt, color: T.textSub, border: `0.5px solid ${T.border}` }}>詳細</button>
                        </div>
                      );
                    })}
                  </div>);
                })
              ) : (
                sortedRes.map(r => {
                  const cs = (r as any).customer_status || "unsent";
                  const ts = (r as any).therapist_status || "unsent";
                  const cc = custStatusColor[cs] || "#888780";
                  const tc = therStatusColor[ts] || "#888780";
                  const th = therapists.find(t => t.id === r.therapist_id);
                  return (
                    <div key={r.id} className="flex items-center gap-2 px-4 py-2.5" style={{ borderBottom: `0.5px solid ${T.border}` }}>
                      <span className="text-[12px] font-medium" style={{ minWidth: 85 }}>{r.start_time?.slice(0,5)}〜{r.end_time?.slice(0,5)}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-medium truncate" style={{ color: T.text }}>{r.customer_name}</p>
                        <p className="text-[10px] truncate" style={{ color: T.textMuted }}>{th?.name || ""} / {r.course}</p>
                      </div>
                      <span className="text-[8px] px-2 py-0.5 rounded" style={{ backgroundColor: cc + "22", color: cc, whiteSpace: "nowrap" }}>客:{custStatusLabel[cs] || cs}</span>
                      <span className="text-[8px] px-2 py-0.5 rounded" style={{ backgroundColor: tc + "22", color: tc, whiteSpace: "nowrap" }}>セ:{therStatusLabel[ts] || ts}</span>
                      <button onClick={() => { setShowStatusList(false); openEdit(r); }} className="text-[9px] px-2.5 py-1 rounded cursor-pointer" style={{ backgroundColor: T.cardAlt, color: T.textSub, border: `0.5px solid ${T.border}` }}>詳細</button>
                    </div>
                  );
                })
              )}
              {reservations.length === 0 && (
                <div className="py-10 text-center">
                  <p className="text-[28px] mb-2">📋</p>
                  <p className="text-[12px]" style={{ color: T.textMuted }}>本日の予約はありません</p>
                </div>
              )}
            </div>
          </div>
        </div>);
      })()}

      {/* ===== 一括通知モーダル ===== */}
      {showBulkNotify && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowBulkNotify(false)}>
          <div className="rounded-2xl border w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-[fadeIn_0.25s]" style={{ backgroundColor: T.card, borderColor: T.border }} onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="px-6 py-4 flex items-center justify-between sticky top-0 z-10" style={{ backgroundColor: T.card, borderBottom: `1px solid ${T.border}` }}>
              <div>
                <h2 className="text-[15px] font-medium">📩 一括通知（セラピスト別）</h2>
                <p className="text-[11px] mt-0.5" style={{ color: T.textMuted }}>{dateDisplay} ・ {bulkData.length}名のセラピスト ・ {bulkData.reduce((s, d) => s + d.reservations.length, 0)}件の予約</p>
              </div>
              <div className="flex items-center gap-2">
                {/* 送信者名 */}
                <select value={notifySender} onChange={e => { setNotifySender(e.target.value); localStorage.setItem("notify_sender", e.target.value); openBulkNotify(); }}
                  className="px-2 py-1.5 rounded-lg text-[11px] outline-none cursor-pointer" style={{ backgroundColor: T.cardAlt, color: T.text, border: `1px solid ${T.border}` }}>
                  <option value="">送信者なし</option>
                  {staffMembers.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                </select>
                <button onClick={() => setShowBulkNotify(false)} className="text-[14px] cursor-pointer p-2" style={{ color: T.textSub }}>✕</button>
              </div>
            </div>

            <div className="px-6 py-4 space-y-4">
              {bulkData.length === 0 ? (
                <p className="text-[13px] text-center py-12" style={{ color: T.textFaint }}>本日の予約がありません</p>
              ) : bulkData.map((td) => (
                <div key={td.therapistId} className="rounded-xl border" style={{ borderColor: bulkCopied[td.therapistId] ? "#4a7c5944" : T.border }}>
                  {/* セラピスト名ヘッダー */}
                  <div className="flex items-center justify-between px-4 py-3" style={{ backgroundColor: bulkCopied[td.therapistId] ? "#4a7c5908" : T.cardAlt, borderRadius: "12px 12px 0 0" }}>
                    <div className="flex items-center gap-3">
                      <span className="text-[14px] font-medium" style={{ color: T.text }}>{td.therapistName}</span>
                      <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ backgroundColor: "#c3a78218", color: "#c3a782" }}>{td.reservations.length}件</span>
                      {bulkCopied[td.therapistId] && <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: "#4a7c5918", color: "#4a7c59" }}>✅ コピー済み</span>}
                    </div>
                    <button onClick={() => {
                      navigator.clipboard.writeText(td.message);
                      setBulkCopied(prev => ({ ...prev, [td.therapistId]: true }));
                      toast.show(`${td.therapistName}さんの通知をコピーしました！`, "success");
                    }} className="px-4 py-2 rounded-xl text-[11px] cursor-pointer" style={{
                      backgroundColor: bulkCopied[td.therapistId] ? "#4a7c5918" : "#85a8c418",
                      color: bulkCopied[td.therapistId] ? "#4a7c59" : "#85a8c4",
                      border: `1px solid ${bulkCopied[td.therapistId] ? "#4a7c5944" : "#85a8c444"}`
                    }}>
                      {bulkCopied[td.therapistId] ? "✅ 済" : "💬 コピー"}
                    </button>
                  </div>

                  {/* 予約サマリー（コンパクト表示） */}
                  <div className="px-4 py-2" style={{ borderTop: `1px solid ${T.border}` }}>
                    {td.reservations.map((r, i) => (
                      <div key={r.id} className="flex items-center gap-3 py-1.5 text-[11px]" style={{ borderBottom: i < td.reservations.length - 1 ? `1px solid ${T.border}` : "none" }}>
                        <span style={{ color: T.textMuted, minWidth: 90 }}>{r.start_time?.slice(0,5)}〜{r.end_time?.slice(0,5)}</span>
                        <span style={{ color: T.text, flex: 1 }}>{r.customer_name.replace(/\s*L$/i, "")}</span>
                        <span style={{ color: T.textSub }}>{r.course}</span>
                        <span style={{ color: T.textMuted }}>¥{(r.total_price || 0).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>

                  {/* メッセージプレビュー（折りたたみ） */}
                  <details className="px-4 pb-3">
                    <summary className="text-[10px] cursor-pointer py-1" style={{ color: T.textMuted }}>📄 メッセージプレビュー</summary>
                    <div className="rounded-lg p-3 mt-1 text-[10px] whitespace-pre-wrap leading-relaxed max-h-[200px] overflow-y-auto" style={{ backgroundColor: T.cardAlt, color: T.textSub, fontFamily: "var(--font-mono, monospace)" }}>
                      {td.message}
                    </div>
                  </details>
                </div>
              ))}

              {/* 全員コピーボタン */}
              {bulkData.length > 0 && (
                <div className="pt-2 space-y-2">
                  <button onClick={() => {
                    const allCopied = Object.keys(bulkCopied).length === bulkData.length;
                    if (allCopied) { toast.show("全員分コピー済みです", "info"); return; }
                    const remaining = bulkData.filter(d => !bulkCopied[d.therapistId]);
                    if (remaining.length > 0) {
                      navigator.clipboard.writeText(remaining[0].message);
                      setBulkCopied(prev => ({ ...prev, [remaining[0].therapistId]: true }));
                      toast.show(`${remaining[0].therapistName}さんの通知をコピー（残り${remaining.length - 1}名）`, "success");
                    }
                  }} className="w-full py-3 rounded-xl text-[13px] font-medium cursor-pointer" style={{
                    backgroundColor: "#85a8c418", color: "#85a8c4", border: "1px solid #85a8c444"
                  }}>
                    💬 次の未送信をコピー（{bulkData.filter(d => !bulkCopied[d.therapistId]).length}名残り）
                  </button>
                  <button onClick={() => setShowBulkNotify(false)} className="w-full py-2.5 rounded-xl text-[12px] cursor-pointer" style={{ color: T.textMuted }}>閉じる</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } } @keyframes scrollLeft { 0%,5% { transform: translateX(10%); } 95%,100% { transform: translateX(-100%); } } @keyframes scrollNote { 0%,15% { transform: translateY(0); } 85%,100% { transform: translateY(calc(-100% + 20px)); } }`}</style>
    </div>
  );
}
