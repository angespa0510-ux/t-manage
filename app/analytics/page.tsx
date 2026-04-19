"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";
import { useTheme } from "../../lib/theme";
import { NavMenu } from "../../lib/nav-menu";
import { useBackNav } from "../../lib/use-back-nav";

type Reservation = { id: number; customer_name: string; therapist_id: number; date: string; start_time: string; end_time: string; course: string; notes: string; status?: string; total_price?: number; card_billing?: number; paypay_amount?: number; cash_amount?: number; nomination?: string; discount_amount?: number; nomination_fee?: number; options_total?: number; extension_price?: number };
type Course = { id: number; name: string; duration: number; price: number; therapist_back: number };
type Therapist = { id: number; name: string };
type Store = { id: number; name: string };
type Shift = { id: number; therapist_id: number; store_id: number; date: string };
type RoomAssignment = { id: number; date: string; room_id: number; slot: string; therapist_id: number };
type Room = { id: number; store_id: number; building_id: number; name: string };
type Building = { id: number; store_id: number; name: string };

type Settlement = {
  id: number; therapist_id: number; date: string; room_id: number | null;
  total_cash?: number; total_back?: number; final_payment?: number;
  invoice_deduction?: number; withholding_tax?: number;
  reserve_used_amount?: number;
  sales_collected?: boolean; change_collected?: boolean; safe_deposited?: boolean;
  safe_collected_date?: string | null;
};
type ExpenseRow = { id: number; date: string; amount: number; type: string };
type Replenishment = { id: number; date: string; room_id: number; amount: number };

type Tab = "daily" | "monthly" | "yearly" | "therapist" | "course" | "store" | "customer";

export default function Analytics() {
  const router = useRouter();
  const { dark, toggle, T } = useTheme();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [allReservations, setAllReservations] = useState<Reservation[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [assignments, setAssignments] = useState<RoomAssignment[]>([]);

  // 資金/税務計算用（当月分）
  const [monthSettlements, setMonthSettlements] = useState<Settlement[]>([]);
  const [monthExpenses, setMonthExpenses] = useState<ExpenseRow[]>([]);
  const [monthReplenishments, setMonthReplenishments] = useState<Replenishment[]>([]);
  // 豊橋予備金の動き（当月分）。movement_type: 'withdraw'=立替 / 'refund'=補充 / 'initial'=初期残高 / 'adjustment'=棚卸調整
  const [monthReserveMovements, setMonthReserveMovements] = useState<{ movement_date: string; movement_type: string; amount: number }[]>([]);
  // スタッフ前借り（当月分・pending のみ）— 営業締めと同じく事務所残金から差し引く
  const [monthAdvances, setMonthAdvances] = useState<{ advance_date: string; amount: number }[]>([]);
  // 当月中に safe_collected_date が該当する settlements（投函日は当月外の可能性あり）
  const [safeCollectedInMonth, setSafeCollectedInMonth] = useState<Settlement[]>([]);
  // 年間集計用
  const [yearSettlements, setYearSettlements] = useState<Settlement[]>([]);
  const [yearExpenses, setYearExpenses] = useState<ExpenseRow[]>([]);
  const [yearReplenishments, setYearReplenishments] = useState<Replenishment[]>([]);
  const [yearReserveMovements, setYearReserveMovements] = useState<{ movement_date: string; movement_type: string; amount: number }[]>([]);
  const [yearAdvances, setYearAdvances] = useState<{ advance_date: string; amount: number }[]>([]);
  const [yearSafeCollected, setYearSafeCollected] = useState<Settlement[]>([]);

  // 年別タブ用: 複数年の集計データ (最新年を右端、5年分)
  type YearSummary = {
    year: number; count: number; sales: number; discount: number; back: number;
    card: number; paypay: number; cash: number; cardFee: number; storeShare: number;
    invoice: number; withholding: number; expense: number; advance: number; income: number;
    replenish: number; reserve: number; changeNet: number;
    uncollectedSales: number; safeUncollected: number; cashOnHand: number;
    avgNet: number;
  };
  const [multiYearTotals, setMultiYearTotals] = useState<YearSummary[]>([]);
  const [multiYearLoading, setMultiYearLoading] = useState(false);
  const [multiYearAnchor, setMultiYearAnchor] = useState(() => new Date().getFullYear()); // 表示中5年の最新年

  const [tab, setTab] = useState<Tab>("daily");
  const [selectedMonth, setSelectedMonth] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; });
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
  // 日別ヘッダークリックで表示するヒント（sales/storeShare/avg/back/card いずれか、null なら非表示）
  const [activeFormula, setActiveFormula] = useState<null | "sales" | "storeShare" | "avg" | "back" | "card">(null);
  const toggleFormula = (key: "sales" | "storeShare" | "avg" | "back" | "card") => setActiveFormula(v => v === key ? null : key);
  // 日別 日付範囲選択（1回目クリック=開始、2回目クリック=終了、3回目=リセットして新規開始）
  const [rangeStart, setRangeStart] = useState<string | null>(null);
  const [rangeEnd, setRangeEnd] = useState<string | null>(null);
  const handleDateClick = (date: string) => {
    if (!rangeStart || rangeEnd) {
      setRangeStart(date); setRangeEnd(null);
    } else if (date === rangeStart) {
      setRangeStart(null); setRangeEnd(null);
    } else if (date < rangeStart) {
      setRangeEnd(rangeStart); setRangeStart(date);
    } else {
      setRangeEnd(date);
    }
  };
  const clearRange = () => { setRangeStart(null); setRangeEnd(null); };

  // マウス戻るボタン対応: タブ → 前のページ
  useBackNav(tab, setTab);

  const [smYear, smMonth] = selectedMonth.split("-").map(Number);
  const daysInMonth = new Date(smYear, smMonth, 0).getDate();

  // 月間サマリーの並び順 (ドラッグで変更可能、localStorage に保存)
  const SUMMARY_ORDER_KEY = "t-manage-analytics-summary-order";
  const DEFAULT_SUMMARY_ORDER = [
    "sales", "count", "avgNet", "storeShare", "back", "discount", "card", "cardFee",
    "paypay", "invoice", "withholding", "expense", "advance", "income",
    "changeNet", "reserve", "uncollectedSales", "safeUncollected", "cashOnHand",
  ];
  const [summaryOrder, setSummaryOrder] = useState<string[]>(DEFAULT_SUMMARY_ORDER);
  const [draggingKey, setDraggingKey] = useState<string | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);

  // マウント時に保存済み並び順を復元
  useEffect(() => {
    try {
      const saved = localStorage.getItem(SUMMARY_ORDER_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved) as string[];
      // 全キーが揃っていて余計なキーがないこと (新規項目追加時に壊れないよう validate)
      const validKeys = new Set(DEFAULT_SUMMARY_ORDER);
      const parsedKeys = new Set(parsed);
      if (parsed.length === DEFAULT_SUMMARY_ORDER.length && parsed.every(k => validKeys.has(k)) && DEFAULT_SUMMARY_ORDER.every(k => parsedKeys.has(k))) {
        setSummaryOrder(parsed);
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveSummaryOrder = useCallback((order: string[]) => {
    setSummaryOrder(order);
    try { localStorage.setItem(SUMMARY_ORDER_KEY, JSON.stringify(order)); } catch {}
  }, []);

  const resetSummaryOrder = useCallback(() => {
    saveSummaryOrder(DEFAULT_SUMMARY_ORDER);
  }, [saveSummaryOrder]);

  const handleSummaryDrop = useCallback((targetKey: string) => {
    if (!draggingKey || draggingKey === targetKey) { setDraggingKey(null); setDragOverKey(null); return; }
    const newOrder = [...summaryOrder];
    const from = newOrder.indexOf(draggingKey);
    const to = newOrder.indexOf(targetKey);
    if (from === -1 || to === -1) return;
    newOrder.splice(from, 1);
    newOrder.splice(to, 0, draggingKey);
    saveSummaryOrder(newOrder);
    setDraggingKey(null);
    setDragOverKey(null);
  }, [draggingKey, summaryOrder, saveSummaryOrder]);

  const fetchData = useCallback(async () => {
    const { data: c } = await supabase.from("courses").select("*").order("duration"); if (c) setCourses(c);
    const { data: t } = await supabase.from("therapists").select("*").order("id"); if (t) setTherapists(t);
    const { data: s } = await supabase.from("stores").select("*").order("id"); if (s) setStores(s);
    const { data: b } = await supabase.from("buildings").select("*").order("id"); if (b) setBuildings(b);
    const { data: rm } = await supabase.from("rooms").select("*").order("id"); if (rm) setRooms(rm);

    const startDate = `${selectedMonth}-01`;
    const endDate = `${selectedMonth}-${String(daysInMonth).padStart(2, "0")}`;

    // 当月の予約（終了のみ）
    const { data: r } = await supabase.from("reservations").select("*").eq("status", "completed").gte("date", startDate).lte("date", endDate).order("date");
    if (r) setReservations(r as Reservation[]);

    // 当月の部屋割り
    const { data: a } = await supabase.from("room_assignments").select("*").gte("date", startDate).lte("date", endDate);
    if (a) setAssignments(a);

    // 当月の精算・経費・釣銭補充
    const { data: ms } = await supabase.from("therapist_daily_settlements").select("*").gte("date", startDate).lte("date", endDate).range(0, 9999);
    if (ms) setMonthSettlements(ms as Settlement[]);
    const { data: me } = await supabase.from("expenses").select("id,date,amount,type").gte("date", startDate).lte("date", endDate).range(0, 9999);
    if (me) setMonthExpenses(me as ExpenseRow[]);
    const { data: mr } = await supabase.from("room_cash_replenishments").select("id,date,room_id,amount").gte("date", startDate).lte("date", endDate).range(0, 9999);
    if (mr) setMonthReplenishments(mr as Replenishment[]);

    // 当月の豊橋予備金の動き
    const { data: mrm } = await supabase.from("toyohashi_reserve_movements").select("movement_date,movement_type,amount").gte("movement_date", startDate).lte("movement_date", endDate).range(0, 9999);
    if (mrm) setMonthReserveMovements(mrm as { movement_date: string; movement_type: string; amount: number }[]);

    // 当月のスタッフ前借り（pending のみ — settled は expenses に振替済みなので二重計上しない）
    const { data: ma } = await supabase.from("staff_advances").select("advance_date,amount").eq("status", "pending").gte("advance_date", startDate).lte("advance_date", endDate).range(0, 9999);
    if (ma) setMonthAdvances(ma as { advance_date: string; amount: number }[]);

    // 当月中に金庫から回収された精算（投函日は過去の可能性あり）
    const { data: sct } = await supabase.from("therapist_daily_settlements").select("*").eq("safe_deposited", true).gte("safe_collected_date", startDate).lte("safe_collected_date", endDate).range(0, 9999);
    if (sct) setSafeCollectedInMonth(sct as Settlement[]);

    // 年間データ（終了のみ）
    const yearStart = `${selectedYear}-01-01`;
    const yearEnd = `${selectedYear}-12-31`;
    const { data: ar } = await supabase.from("reservations").select("*").eq("status", "completed").gte("date", yearStart).lte("date", yearEnd).range(0, 49999).order("date");
    if (ar) setAllReservations(ar as Reservation[]);

    // 年間の精算・経費・釣銭補充
    const { data: ys } = await supabase.from("therapist_daily_settlements").select("id,therapist_id,date,total_cash,total_back,final_payment,invoice_deduction,withholding_tax,reserve_used_amount,sales_collected,change_collected,safe_deposited,safe_collected_date,room_id").gte("date", yearStart).lte("date", yearEnd).range(0, 49999);
    if (ys) setYearSettlements(ys as Settlement[]);
    const { data: ye } = await supabase.from("expenses").select("id,date,amount,type").gte("date", yearStart).lte("date", yearEnd).range(0, 49999);
    if (ye) setYearExpenses(ye as ExpenseRow[]);
    const { data: yr } = await supabase.from("room_cash_replenishments").select("id,date,room_id,amount").gte("date", yearStart).lte("date", yearEnd).range(0, 49999);
    if (yr) setYearReplenishments(yr as Replenishment[]);
    // 年間の豊橋予備金・前借り
    const { data: yrm } = await supabase.from("toyohashi_reserve_movements").select("movement_date,movement_type,amount").gte("movement_date", yearStart).lte("movement_date", yearEnd).range(0, 9999);
    if (yrm) setYearReserveMovements(yrm as { movement_date: string; movement_type: string; amount: number }[]);
    const { data: ya } = await supabase.from("staff_advances").select("advance_date,amount").eq("status", "pending").gte("advance_date", yearStart).lte("advance_date", yearEnd).range(0, 9999);
    if (ya) setYearAdvances(ya as { advance_date: string; amount: number }[]);
    // 年内に金庫から回収された精算 (投函日は過去の可能性あり)
    const { data: ysc } = await supabase.from("therapist_daily_settlements").select("id,therapist_id,date,total_cash,total_back,final_payment,room_id,safe_collected_date").eq("safe_deposited", true).gte("safe_collected_date", yearStart).lte("safe_collected_date", yearEnd).range(0, 9999);
    if (ysc) setYearSafeCollected(ysc as Settlement[]);
  }, [selectedMonth, daysInMonth, selectedYear]);

  useEffect(() => { const check = async () => { const { data: { user } } = await supabase.auth.getUser(); if (!user) router.push("/"); }; check(); fetchData(); }, [router, fetchData]);

  const getCourse = (name: string) => courses.find((c) => c.name === name);
  const getTherapistName = (id: number) => therapists.find((t) => t.id === id)?.name || "不明";
  const fmt = (n: number) => "¥" + (n || 0).toLocaleString();

  // 売上は実際に計上された total_price を優先（dashboard/営業締めと同じ根拠）。null の古い予約は course.price にフォールバック
  const getPrice = (r: Reservation) => (r.total_price ?? 0) || (getCourse(r.course)?.price || 0);
  const getBack = (r: Reservation) => getCourse(r.course)?.therapist_back || 0;

  // ===== 日別集計ロジックを共通化するヘルパー =====
  // 日別・月別・年別で同じ計算結果が得られるよう、1日分の統計を計算する関数
  type DayStats = {
    date: string; count: number;
    sales: number; discount: number; back: number; card: number; paypay: number; cash: number;
    invoice: number; withholding: number;
    expense: number; income: number; replenish: number; advance: number;
    uncollectedSales: number; safeUncollected: number; cashOnHand: number;
    avgNet: number; storeShare: number; reserve: number; changeNet: number; cardFee: number;
  };
  const computeDayStats = useCallback((
    date: string,
    srcReservations: Reservation[],
    srcSettlements: Settlement[],
    srcExpenses: ExpenseRow[],
    srcReplenishments: Replenishment[],
    srcSafeCollected: Settlement[],
    srcReserveMovements: { movement_date: string; movement_type: string; amount: number }[],
    srcAdvances: { advance_date: string; amount: number }[],
  ): DayStats => {
    const dayRes = srcReservations.filter((r) => r.date === date);
    const daySettles = srcSettlements.filter((s) => s.date === date);
    const dayExp = srcExpenses.filter((e) => e.date === date);
    const dayReps = srcReplenishments.filter((r) => r.date === date);
    const collectedToday = srcSafeCollected.filter((s) => s.safe_collected_date === date);
    const dayMovements = srcReserveMovements.filter((m) => m.movement_date === date);
    const reserve = dayMovements.reduce((s, m) => s + (m.movement_type === "withdraw" ? -m.amount : m.amount), 0);

    const count = dayRes.length;
    const sales = dayRes.reduce((s, r) => {
      const coursePrice = getCourse(r.course)?.price || 0;
      return s + coursePrice + (r.nomination_fee || 0) + (r.options_total || 0) + (r.extension_price || 0);
    }, 0);
    const discount = dayRes.reduce((s, r) => s + (r.discount_amount || 0), 0);
    const card = dayRes.reduce((s, r) => s + (r.card_billing || 0), 0);
    const cardFee = card > 0 ? card - Math.round(card / 1.10) : 0;
    const paypay = dayRes.reduce((s, r) => s + (r.paypay_amount || 0), 0);
    const cash = dayRes.reduce((s, r) => s + (r.cash_amount || 0), 0);

    const back = daySettles.reduce((s, ds) => s + (ds.final_payment || 0), 0);
    const invoice = daySettles.reduce((s, ds) => s + (ds.invoice_deduction || 0), 0);
    const withholding = daySettles.reduce((s, ds) => s + (ds.withholding_tax || 0), 0);

    const expense = dayExp.filter((e) => e.type === "expense").reduce((s, e) => s + (e.amount || 0), 0);
    const income = dayExp.filter((e) => e.type === "income").reduce((s, e) => s + (e.amount || 0), 0);
    const replenish = dayReps.reduce((s, r) => s + (r.amount || 0), 0);
    const advance = srcAdvances.filter((a) => a.advance_date === date).reduce((s, a) => s + (a.amount || 0), 0);

    let staffCollectedAmt = 0;
    let uncollectedSales = 0;
    let safeUncollected = 0;
    const processedTids = new Set<number>();

    const therapistIds = Array.from(new Set(dayRes.map((r) => r.therapist_id)));
    for (const tid of therapistIds) {
      const tRes = dayRes.filter((r) => r.therapist_id === tid);
      const tCash = tRes.reduce((s, r) => s + (r.cash_amount || 0), 0);
      const ds = daySettles.find((s) => s.therapist_id === tid);
      const finalPay = ds?.final_payment || 0;
      const reserveUsed = ds?.reserve_used_amount || 0;
      const roomId = ds?.room_id || 0;
      const roomRep = roomId ? dayReps.filter((r) => r.room_id === roomId).reduce((s, r) => s + (r.amount || 0), 0) : 0;
      const netAfterPay = tCash - finalPay + reserveUsed;

      if (ds?.sales_collected && !ds?.safe_deposited) {
        staffCollectedAmt += netAfterPay + (ds.change_collected ? roomRep : 0);
      } else if (ds?.safe_deposited && !ds?.safe_collected_date) {
        safeUncollected += Math.max(tCash - finalPay, 0) + roomRep;
      } else {
        uncollectedSales += netAfterPay + roomRep;
      }
      processedTids.add(tid);
    }

    for (const ds of daySettles) {
      if (processedTids.has(ds.therapist_id)) continue;
      const netAfterPay = (ds.total_cash || 0) - (ds.final_payment || 0) + (ds.reserve_used_amount || 0);
      const roomRep = ds.room_id ? dayReps.filter((r) => r.room_id === ds.room_id).reduce((s, r) => s + (r.amount || 0), 0) : 0;
      if (ds.sales_collected && !ds.safe_deposited) {
        staffCollectedAmt += netAfterPay + (ds.change_collected ? roomRep : 0);
      } else if (ds.safe_deposited && !ds.safe_collected_date) {
        safeUncollected += Math.max((ds.total_cash || 0) - (ds.final_payment || 0), 0) + roomRep;
      } else if (!ds.sales_collected) {
        uncollectedSales += netAfterPay + roomRep;
      }
    }

    let safeCollectedTodayTotal = 0;
    for (const sc of collectedToday) {
      const net3 = Math.max((sc.total_cash || 0) - (sc.final_payment || 0), 0);
      const repAmt = sc.room_id ? srcReplenishments.filter((r) => r.date === sc.date && r.room_id === sc.room_id).reduce((s, r) => s + (r.amount || 0), 0) : 0;
      safeCollectedTodayTotal += net3 + repAmt;
    }

    const cashOnHand = -replenish - expense - advance + income + staffCollectedAmt + safeCollectedTodayTotal;

    let changeCollectedAmt = 0;
    const changeCollectedRooms = new Set<number>();
    for (const ds of daySettles) {
      if (ds.change_collected && ds.sales_collected && !ds.safe_deposited && ds.room_id && !changeCollectedRooms.has(ds.room_id)) {
        changeCollectedRooms.add(ds.room_id);
        const repSum = dayReps.filter((r) => r.room_id === ds.room_id).reduce((x, r) => x + (r.amount || 0), 0);
        changeCollectedAmt += repSum;
      }
    }
    for (const sc of collectedToday) {
      if (sc.room_id && !changeCollectedRooms.has(sc.room_id)) {
        changeCollectedRooms.add(sc.room_id);
        const repAmt = srcReplenishments.filter((r) => r.date === sc.date && r.room_id === sc.room_id).reduce((s, r) => s + (r.amount || 0), 0);
        changeCollectedAmt += repAmt;
      }
    }
    const changeNet = changeCollectedAmt - replenish;

    const storeShare = sales - discount - back - invoice - withholding;
    const avgNet = count > 0 ? Math.round(storeShare / count) : 0;

    return {
      date, count, sales, discount, back, card, paypay, cash,
      invoice, withholding, expense, income, replenish, advance,
      uncollectedSales, safeUncollected, cashOnHand,
      avgNet, storeShare, reserve, changeNet, cardFee,
    };
  }, [courses]);

  // ===== 日別データ（営業締めと同じロジックで日ごとに再現） =====
  const dailyData = useMemo(() => {
    type Row = DayStats & { label: string; dow: string };
    const data: Row[] = [];
    const dayNames = ["日", "月", "火", "水", "木", "金", "土"];
    for (let i = 1; i <= daysInMonth; i++) {
      const date = `${selectedMonth}-${String(i).padStart(2, "0")}`;
      const d = new Date(date + "T00:00:00");
      const stats = computeDayStats(date, reservations, monthSettlements, monthExpenses, monthReplenishments, safeCollectedInMonth, monthReserveMovements, monthAdvances);
      data.push({ ...stats, label: `${i}`, dow: dayNames[d.getDay()] });
    }
    return data;
  }, [reservations, monthSettlements, monthExpenses, monthReplenishments, monthAdvances, safeCollectedInMonth, monthReserveMovements, selectedMonth, daysInMonth, computeDayStats]);

  // ===== 年内全日のデータ（月別・年別の算出に使用） =====
  const yearlyDaily = useMemo(() => {
    const data: DayStats[] = [];
    const yearStart = new Date(selectedYear, 0, 1);
    const yearEnd = new Date(selectedYear, 11, 31);
    for (let d = new Date(yearStart); d <= yearEnd; d.setDate(d.getDate() + 1)) {
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      data.push(computeDayStats(dateStr, allReservations, yearSettlements, yearExpenses, yearReplenishments, yearSafeCollected, yearReserveMovements, yearAdvances));
    }
    return data;
  }, [allReservations, yearSettlements, yearExpenses, yearReplenishments, yearSafeCollected, yearReserveMovements, yearAdvances, selectedYear, computeDayStats]);

  // ===== 複数年データ取得 (年別タブ用、anchor 年から過去5年分) =====
  const fetchMultiYearData = useCallback(async () => {
    setMultiYearLoading(true);
    const years: number[] = [];
    for (let i = 4; i >= 0; i--) years.push(multiYearAnchor - i);

    const results: YearSummary[] = await Promise.all(years.map(async (year) => {
      const yStart = `${year}-01-01`;
      const yEnd = `${year}-12-31`;
      const [rRes, sRes, eRes, repRes, rmRes, aRes, scRes] = await Promise.all([
        supabase.from("reservations").select("*").eq("status", "completed").gte("date", yStart).lte("date", yEnd).range(0, 49999),
        supabase.from("therapist_daily_settlements").select("id,therapist_id,date,total_cash,total_back,final_payment,invoice_deduction,withholding_tax,reserve_used_amount,sales_collected,change_collected,safe_deposited,safe_collected_date,room_id").gte("date", yStart).lte("date", yEnd).range(0, 49999),
        supabase.from("expenses").select("id,date,amount,type").gte("date", yStart).lte("date", yEnd).range(0, 49999),
        supabase.from("room_cash_replenishments").select("id,date,room_id,amount").gte("date", yStart).lte("date", yEnd).range(0, 49999),
        supabase.from("toyohashi_reserve_movements").select("movement_date,movement_type,amount").gte("movement_date", yStart).lte("movement_date", yEnd).range(0, 9999),
        supabase.from("staff_advances").select("advance_date,amount").eq("status", "pending").gte("advance_date", yStart).lte("advance_date", yEnd).range(0, 9999),
        supabase.from("therapist_daily_settlements").select("id,therapist_id,date,total_cash,total_back,final_payment,room_id,safe_collected_date").eq("safe_deposited", true).gte("safe_collected_date", yStart).lte("safe_collected_date", yEnd).range(0, 9999),
      ]);

      const reservations = (rRes.data || []) as Reservation[];
      const settlements = (sRes.data || []) as Settlement[];
      const expenses = (eRes.data || []) as ExpenseRow[];
      const replenishments = (repRes.data || []) as Replenishment[];
      const reserveMovements = (rmRes.data || []) as { movement_date: string; movement_type: string; amount: number }[];
      const advances = (aRes.data || []) as { advance_date: string; amount: number }[];
      const safeCollected = (scRes.data || []) as Settlement[];

      // 1年分を日ごとに computeDayStats で集計
      const agg = {
        year, count: 0, sales: 0, discount: 0, back: 0, card: 0, paypay: 0, cash: 0,
        cardFee: 0, storeShare: 0, invoice: 0, withholding: 0, expense: 0, advance: 0, income: 0,
        replenish: 0, reserve: 0, changeNet: 0, uncollectedSales: 0, safeUncollected: 0, cashOnHand: 0,
      };
      const startD = new Date(year, 0, 1);
      const endD = new Date(year, 11, 31);
      for (let d = new Date(startD); d <= endD; d.setDate(d.getDate() + 1)) {
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        const stats = computeDayStats(dateStr, reservations, settlements, expenses, replenishments, safeCollected, reserveMovements, advances);
        agg.count += stats.count;
        agg.sales += stats.sales;
        agg.discount += stats.discount;
        agg.back += stats.back;
        agg.card += stats.card;
        agg.paypay += stats.paypay;
        agg.cash += stats.cash;
        agg.cardFee += stats.cardFee;
        agg.storeShare += stats.storeShare;
        agg.invoice += stats.invoice;
        agg.withholding += stats.withholding;
        agg.expense += stats.expense;
        agg.advance += stats.advance;
        agg.income += stats.income;
        agg.replenish += stats.replenish;
        agg.reserve += stats.reserve;
        agg.changeNet += stats.changeNet;
        agg.uncollectedSales += stats.uncollectedSales;
        agg.safeUncollected += stats.safeUncollected;
        agg.cashOnHand += stats.cashOnHand;
      }
      const avgNet = agg.count > 0 ? Math.round(agg.storeShare / agg.count) : 0;
      return { ...agg, avgNet };
    }));

    setMultiYearTotals(results);
    setMultiYearLoading(false);
  }, [multiYearAnchor, computeDayStats]);

  // 年別タブ初回アクセス時 + anchor 変更時にフェッチ
  useEffect(() => {
    if (tab === "yearly") {
      fetchMultiYearData();
    }
  }, [tab, multiYearAnchor, fetchMultiYearData]);

  // ===== 月別データ（yearlyDaily を月ごとに集計 — 日別と完全整合） =====
  const monthlyData = useMemo(() => {
    type MRow = {
      month: string; label: string; count: number;
      sales: number; discount: number; back: number; card: number; paypay: number; cash: number;
      invoice: number; withholding: number; cardFee: number; storeShare: number;
      expense: number; income: number; replenish: number; advance: number;
      reserve: number; changeNet: number;
      uncollectedSales: number; safeUncollected: number; cashOnHand: number;
      profit: number; avgNet: number;
    };
    const data: MRow[] = [];
    for (let m = 1; m <= 12; m++) {
      const prefix = `${selectedYear}-${String(m).padStart(2, "0")}`;
      const monthDays = yearlyDaily.filter((d) => d.date.startsWith(prefix));
      const agg = monthDays.reduce((a, d) => ({
        count: a.count + d.count,
        sales: a.sales + d.sales,
        discount: a.discount + d.discount,
        back: a.back + d.back,
        card: a.card + d.card,
        paypay: a.paypay + d.paypay,
        cash: a.cash + d.cash,
        invoice: a.invoice + d.invoice,
        withholding: a.withholding + d.withholding,
        cardFee: a.cardFee + d.cardFee,
        storeShare: a.storeShare + d.storeShare,
        expense: a.expense + d.expense,
        income: a.income + d.income,
        replenish: a.replenish + d.replenish,
        advance: a.advance + d.advance,
        reserve: a.reserve + d.reserve,
        changeNet: a.changeNet + d.changeNet,
        uncollectedSales: a.uncollectedSales + d.uncollectedSales,
        safeUncollected: a.safeUncollected + d.safeUncollected,
        cashOnHand: a.cashOnHand + d.cashOnHand,
      }), { count: 0, sales: 0, discount: 0, back: 0, card: 0, paypay: 0, cash: 0, invoice: 0, withholding: 0, cardFee: 0, storeShare: 0, expense: 0, income: 0, replenish: 0, advance: 0, reserve: 0, changeNet: 0, uncollectedSales: 0, safeUncollected: 0, cashOnHand: 0 });
      const profit = agg.sales - agg.back - agg.expense + agg.income;
      const avgNet = agg.count > 0 ? Math.round(agg.storeShare / agg.count) : 0;
      data.push({ month: prefix, label: `${m}月`, ...agg, profit, avgNet });
    }
    return data;
  }, [yearlyDaily, selectedYear]);

  // ===== セラピスト別 =====
  const therapistData = useMemo(() => {
    const map = new Map<number, { sales: number; back: number; count: number; customers: Set<string> }>();
    const src = tab === "therapist" ? reservations : allReservations;
    for (const r of src) {
      const ex = map.get(r.therapist_id) || { sales: 0, back: 0, count: 0, customers: new Set<string>() };
      ex.sales += getPrice(r); ex.back += getBack(r); ex.count++; ex.customers.add(r.customer_name);
      map.set(r.therapist_id, ex);
    }
    return Array.from(map.entries()).map(([id, d]) => ({
      id, name: getTherapistName(id), ...d, customers: d.customers.size,
      nomination: src.filter((r) => r.therapist_id === id && r.notes?.includes("指名")).length,
    })).sort((a, b) => b.sales - a.sales);
  }, [reservations, allReservations, tab, courses, therapists]);

  // ===== コース別 =====
  const courseData = useMemo(() => {
    const map = new Map<string, { count: number; sales: number }>();
    const src = tab === "course" ? reservations : allReservations;
    for (const r of src) {
      const name = r.course || "コースなし";
      const ex = map.get(name) || { count: 0, sales: 0 };
      ex.count++; ex.sales += getPrice(r);
      map.set(name, ex);
    }
    return Array.from(map.entries()).map(([name, d]) => ({ name, ...d })).sort((a, b) => b.sales - a.sales);
  }, [reservations, allReservations, tab, courses]);

  // ===== ルーム別 =====
  const storeData = useMemo(() => {
    const map = new Map<number, { sales: number; count: number }>();
    for (const a of assignments) {
      const room = rooms.find((r) => r.id === a.room_id);
      if (!room) continue;
      const bld = buildings.find((b) => b.id === room.building_id);
      if (!bld) continue;
      const sid = bld.store_id;
      // この割当のセラピストの予約を探す
      const tRes = reservations.filter((r) => r.therapist_id === a.therapist_id && r.date === a.date);
      const sales = tRes.reduce((s, r) => s + getPrice(r), 0);
      const ex = map.get(sid) || { sales: 0, count: 0 };
      ex.sales += sales; ex.count += tRes.length;
      map.set(sid, ex);
    }
    return Array.from(map.entries()).map(([sid, d]) => ({ id: sid, name: stores.find((s) => s.id === sid)?.name || "不明", ...d })).sort((a, b) => b.sales - a.sales);
  }, [assignments, reservations, rooms, buildings, stores, courses]);

  // ===== リピート率・指名率 =====
  const customerStats = useMemo(() => {
    const src = tab === "customer" ? reservations : allReservations;
    const custMap = new Map<string, number>();
    for (const r of src) { custMap.set(r.customer_name, (custMap.get(r.customer_name) || 0) + 1); }
    const totalCustomers = custMap.size;
    const repeaters = Array.from(custMap.values()).filter((c) => c >= 2).length;
    const repeatRate = totalCustomers > 0 ? Math.round((repeaters / totalCustomers) * 100) : 0;
    const nominationCount = src.filter((r) => r.notes?.includes("指名")).length;
    const nominationRate = src.length > 0 ? Math.round((nominationCount / src.length) * 100) : 0;
    const topCustomers = Array.from(custMap.entries()).map(([name, count]) => ({ name, count, sales: src.filter((r) => r.customer_name === name).reduce((s, r) => s + getPrice(r), 0) })).sort((a, b) => b.sales - a.sales).slice(0, 10);
    return { totalCustomers, repeaters, repeatRate, nominationCount, nominationRate, totalReservations: src.length, topCustomers };
  }, [reservations, allReservations, tab, courses]);

  // 月間合計（日別タブと同じ計算ロジック：売上=定価ベース、セラピスト=実支給額、店取概算=売上-割引-セラピスト-インボイス-源泉）
  const monthTotal = useMemo(() => {
    // 基本情報 (月別以降のタブでも参照されるため維持)
    const sales = reservations.reduce((s, r) => {
      const coursePrice = getCourse(r.course)?.price || 0;
      return s + coursePrice + (r.nomination_fee || 0) + (r.options_total || 0) + (r.extension_price || 0);
    }, 0);
    const discount = reservations.reduce((s, r) => s + (r.discount_amount || 0), 0);
    const back = monthSettlements.reduce((s, ds) => s + (ds.final_payment || 0), 0);
    const invoice = monthSettlements.reduce((s, ds) => s + (ds.invoice_deduction || 0), 0);
    const withholding = monthSettlements.reduce((s, ds) => s + (ds.withholding_tax || 0), 0);
    const storeShare = sales - discount - back - invoice - withholding;
    // dailyData から残りの資金系指標を集計 (日別テーブルの合計と一致する)
    const agg = dailyData.reduce((a, d) => ({
      card: a.card + d.card,
      cardFee: a.cardFee + d.cardFee,
      paypay: a.paypay + d.paypay,
      cash: a.cash + d.cash,
      expense: a.expense + d.expense,
      advance: a.advance + d.advance,
      income: a.income + d.income,
      reserve: a.reserve + d.reserve,
      changeNet: a.changeNet + d.changeNet,
      uncollectedSales: a.uncollectedSales + d.uncollectedSales,
      safeUncollected: a.safeUncollected + d.safeUncollected,
      cashOnHand: a.cashOnHand + d.cashOnHand,
    }), { card: 0, cardFee: 0, paypay: 0, cash: 0, expense: 0, advance: 0, income: 0, reserve: 0, changeNet: 0, uncollectedSales: 0, safeUncollected: 0, cashOnHand: 0 });
    const count = reservations.length;
    const avgNet = count > 0 ? Math.round(storeShare / count) : 0;
    return { sales, back, profit: storeShare, storeShare, count, discount, invoice, withholding, avgNet, ...agg };
  }, [reservations, monthSettlements, dailyData, courses]);

  // 年間合計（yearlyDaily を全期間サマリー。全指標を含み、月間と同じ形 — 月別タブのサマリーで使用）
  const yearTotal = useMemo(() => {
    const agg = yearlyDaily.reduce((a, d) => ({
      count: a.count + d.count,
      sales: a.sales + d.sales,
      discount: a.discount + d.discount,
      back: a.back + d.back,
      card: a.card + d.card,
      paypay: a.paypay + d.paypay,
      cash: a.cash + d.cash,
      invoice: a.invoice + d.invoice,
      withholding: a.withholding + d.withholding,
      cardFee: a.cardFee + d.cardFee,
      storeShare: a.storeShare + d.storeShare,
      expense: a.expense + d.expense,
      income: a.income + d.income,
      replenish: a.replenish + d.replenish,
      advance: a.advance + d.advance,
      reserve: a.reserve + d.reserve,
      changeNet: a.changeNet + d.changeNet,
      uncollectedSales: a.uncollectedSales + d.uncollectedSales,
      safeUncollected: a.safeUncollected + d.safeUncollected,
      cashOnHand: a.cashOnHand + d.cashOnHand,
    }), { count: 0, sales: 0, discount: 0, back: 0, card: 0, paypay: 0, cash: 0, invoice: 0, withholding: 0, cardFee: 0, storeShare: 0, expense: 0, income: 0, replenish: 0, advance: 0, reserve: 0, changeNet: 0, uncollectedSales: 0, safeUncollected: 0, cashOnHand: 0 });
    const avgNet = agg.count > 0 ? Math.round(agg.storeShare / agg.count) : 0;
    return { ...agg, avgNet, profit: agg.storeShare };
  }, [yearlyDaily]);

  // 選択範囲の小計（日別タブ 日付クリックで範囲選択）
  const rangeTotal = useMemo(() => {
    if (!rangeStart) return null;
    const endDate = rangeEnd || rangeStart;
    const filtered = dailyData.filter(d => d.date >= rangeStart && d.date <= endDate);
    if (filtered.length === 0) return null;
    return filtered.reduce((acc, d) => ({
      days: acc.days + 1,
      count: acc.count + d.count,
      sales: acc.sales + d.sales,
      discount: acc.discount + d.discount,
      back: acc.back + d.back,
      card: acc.card + d.card,
      paypay: acc.paypay + d.paypay,
      invoice: acc.invoice + d.invoice,
      withholding: acc.withholding + d.withholding,
      expense: acc.expense + d.expense,
      advance: acc.advance + d.advance,
      income: acc.income + d.income,
      storeShare: acc.storeShare + d.storeShare,
      uncollectedSales: acc.uncollectedSales + d.uncollectedSales,
      safeUncollected: acc.safeUncollected + d.safeUncollected,
      cashOnHand: acc.cashOnHand + d.cashOnHand,
      reserve: acc.reserve + d.reserve,
      changeNet: acc.changeNet + d.changeNet,
      cardFee: acc.cardFee + d.cardFee,
    }), { days: 0, count: 0, sales: 0, discount: 0, back: 0, card: 0, paypay: 0, invoice: 0, withholding: 0, expense: 0, advance: 0, income: 0, storeShare: 0, uncollectedSales: 0, safeUncollected: 0, cashOnHand: 0, reserve: 0, changeNet: 0, cardFee: 0 });
  }, [rangeStart, rangeEnd, dailyData]);

  const totalCourseSales = courseData.reduce((s, c) => s + c.sales, 0) || 1;

  const tabs: { key: Tab; label: string }[] = [
    { key: "daily", label: "日別" }, { key: "monthly", label: "月別" }, { key: "yearly", label: "年別" },
    { key: "therapist", label: "セラピスト" }, { key: "course", label: "コース" },
    { key: "store", label: "ルーム" }, { key: "customer", label: "顧客分析" },
  ];

  const prevMonth = () => { const d = new Date(smYear, smMonth - 2, 1); setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`); };
  const nextMonth = () => { const d = new Date(smYear, smMonth, 1); setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`); };

  return (
    <div className="h-screen flex flex-col" style={{ backgroundColor: T.bg, color: T.text }}>
      {/* Header */}
      <div className="h-[56px] flex items-center justify-between px-4 flex-shrink-0 border-b" style={{ backgroundColor: T.card, borderColor: T.border }}>
        <div className="flex items-center gap-3">
          <NavMenu T={T} dark={dark} />
          <button onClick={() => router.push("/dashboard")} className="p-2 rounded-lg cursor-pointer" style={{ color: T.textSub }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="15 18 9 12 15 6"/></svg></button>
          <h1 className="text-[14px] font-medium">売上分析</h1>
        </div>
        <button onClick={toggle} className="px-2.5 py-1.5 text-[10px] rounded-lg cursor-pointer border" style={{ borderColor: T.border, color: T.textSub }}>{dark ? "☀️ ライト" : "🌙 ダーク"}</button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 px-4 py-2 border-b overflow-x-auto flex-shrink-0" style={{ backgroundColor: T.card, borderColor: T.border }}>
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className="px-3 py-1.5 text-[11px] rounded-lg cursor-pointer whitespace-nowrap transition-all"
            style={{ backgroundColor: tab === t.key ? T.accent + "18" : "transparent", color: tab === t.key ? T.accent : T.textMuted, fontWeight: tab === t.key ? 600 : 400 }}>{t.label}</button>
        ))}
      </div>

      {/* Summary Grid — タブに応じて月間/年間合計を切替表示 (ドラッグで並び替え可能) */}
      <div className="px-4 py-3 flex-shrink-0" style={{ backgroundColor: T.cardAlt, borderBottom: `1px solid ${T.border}` }}>
        {(() => {
          const isYearScope = tab === "monthly" || tab === "yearly";
          const M = isYearScope ? yearTotal : monthTotal;
          const scopeLabel = isYearScope ? `${selectedYear}年` : `${smYear}年${smMonth}月`;
          const cashColor = M.cashOnHand >= 0 ? "#22c55e" : "#c45555";
          const changeColor = M.changeNet === 0 ? T.textFaint : M.changeNet > 0 ? "#22c55e" : "#f59e0b";
          const reserveColor = M.reserve === 0 ? T.textFaint : M.reserve > 0 ? "#22c55e" : "#d4687e";
          const changeSign = M.changeNet > 0 ? "+" : M.changeNet < 0 ? "−" : "";
          const reserveSign = M.reserve > 0 ? "+" : M.reserve < 0 ? "−" : "";
          const itemMap: Record<string, { label: string; value: string; color: string; emphasis?: boolean }> = {
            sales: { label: isYearScope ? "年間売上" : "月間売上", value: fmt(M.sales), color: "#c3a782", emphasis: true },
            count: { label: "予約数", value: `${M.count}件`, color: "#c3a782", emphasis: true },
            avgNet: { label: "平均単価", value: M.avgNet > 0 ? fmt(M.avgNet) : "—", color: T.textSub },
            storeShare: { label: "店取概算", value: fmt(M.storeShare), color: "#85a8c4", emphasis: true },
            back: { label: "セラピスト支給", value: fmt(M.back), color: "#7ab88f" },
            discount: { label: "割引", value: M.discount === 0 ? "¥0" : `−${fmt(M.discount)}`, color: M.discount === 0 ? T.textFaint : "#f59e0b" },
            card: { label: "カード", value: fmt(M.card), color: T.textSub },
            cardFee: { label: "カード手数料", value: M.cardFee === 0 ? "¥0" : `+${fmt(M.cardFee)}`, color: M.cardFee === 0 ? T.textFaint : "#22c55e" },
            paypay: { label: "ペイペイ", value: fmt(M.paypay), color: T.textSub },
            invoice: { label: "インボイス", value: fmt(M.invoice), color: M.invoice === 0 ? T.textFaint : "#a855f7" },
            withholding: { label: "源泉徴収", value: fmt(M.withholding), color: M.withholding === 0 ? T.textFaint : "#d4687e" },
            expense: { label: "経費", value: fmt(M.expense), color: M.expense === 0 ? T.textFaint : "#c45555" },
            advance: { label: "前借り", value: M.advance === 0 ? "¥0" : `−${fmt(M.advance)}`, color: M.advance === 0 ? T.textFaint : "#d4687e" },
            income: { label: "入金", value: M.income === 0 ? "¥0" : `+${fmt(M.income)}`, color: M.income === 0 ? T.textFaint : "#22c55e" },
            changeNet: { label: "釣銭", value: M.changeNet === 0 ? "¥0" : `${changeSign}${fmt(Math.abs(M.changeNet))}`, color: changeColor },
            reserve: { label: "豊橋予備金", value: M.reserve === 0 ? "¥0" : `${reserveSign}${fmt(Math.abs(M.reserve))}`, color: reserveColor },
            uncollectedSales: { label: "売上未回収", value: M.uncollectedSales === 0 ? "¥0" : `−${fmt(M.uncollectedSales)}`, color: M.uncollectedSales === 0 ? T.textFaint : "#c45555" },
            safeUncollected: { label: "金庫未回収", value: M.safeUncollected === 0 ? "¥0" : `−${fmt(M.safeUncollected)}`, color: M.safeUncollected === 0 ? T.textFaint : "#c45555" },
            cashOnHand: { label: "事務所残金", value: fmt(M.cashOnHand), color: cashColor, emphasis: true },
          };
          return (
            <>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[9px]" style={{ color: T.textMuted }}>📊 {scopeLabel} 合計 <span className="ml-1" style={{ color: T.textFaint }}>（カードをドラッグで並び替え可能）</span></p>
                <button onClick={resetSummaryOrder} className="text-[9px] px-2 py-0.5 rounded cursor-pointer border" style={{ borderColor: T.border, color: T.textMuted }} title="並び順を初期化">↺ リセット</button>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 gap-1.5">
                {summaryOrder.map((key) => {
                  const s = itemMap[key];
                  if (!s) return null;
                  const isDragging = draggingKey === key;
                  const isDragOver = dragOverKey === key && draggingKey !== key;
                  return (
                    <div
                      key={key}
                      draggable
                      onDragStart={(e) => { setDraggingKey(key); e.dataTransfer.effectAllowed = "move"; }}
                      onDragEnd={() => { setDraggingKey(null); setDragOverKey(null); }}
                      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (dragOverKey !== key) setDragOverKey(key); }}
                      onDragLeave={() => { if (dragOverKey === key) setDragOverKey(null); }}
                      onDrop={(e) => { e.preventDefault(); handleSummaryDrop(key); }}
                      className="rounded-lg px-2 py-1 border cursor-move transition-all select-none"
                      style={{
                        backgroundColor: T.card,
                        borderColor: isDragOver ? "#c3a782" : T.border,
                        borderWidth: isDragOver ? 2 : 1,
                        opacity: isDragging ? 0.4 : 1,
                        transform: isDragOver ? "scale(1.03)" : "scale(1)",
                      }}
                      title="ドラッグで並び替え"
                    >
                      <p className="text-[9px] whitespace-nowrap leading-tight" style={{ color: T.textMuted }}>{s.label}</p>
                      <p className={`tabular-nums whitespace-nowrap leading-tight ${s.emphasis ? "text-[13px] font-medium" : "text-[12px]"}`} style={{ color: s.color }}>{s.value}</p>
                    </div>
                  );
                })}
              </div>
            </>
          );
        })()}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className={(tab === "daily" || tab === "monthly" || tab === "yearly") ? "mx-auto" : "max-w-[1100px] mx-auto"}>

          {/* 日別 */}
          {tab === "daily" && (
            <div className="animate-[fadeIn_0.3s]">
              <div className="flex items-center justify-center gap-4 mb-4">
                <button onClick={prevMonth} className="p-1 cursor-pointer" style={{ color: T.textSub }}>◀</button>
                <span className="text-[14px] font-medium">{smYear}年{smMonth}月 日別</span>
                <button onClick={nextMonth} className="p-1 cursor-pointer" style={{ color: T.textSub }}>▶</button>
              </div>
              {rangeStart && (
                <div className="mb-3 rounded-xl border p-3" style={{ backgroundColor: "rgba(133,168,196,0.08)", borderColor: "#85a8c4" }}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-[12px] font-medium" style={{ color: "#85a8c4" }}>
                      📅 期間選択: {rangeStart.slice(5).replace("-", "/")}
                      {rangeEnd && rangeEnd !== rangeStart && ` 〜 ${rangeEnd.slice(5).replace("-", "/")}`}
                      {!rangeEnd && <span className="ml-2 text-[10px]" style={{ color: T.textMuted }}>（終了日をクリック）</span>}
                      {rangeTotal && <span className="ml-2" style={{ color: T.textSub }}>・{rangeTotal.days}日間</span>}
                    </div>
                    <button onClick={clearRange} className="text-[11px] cursor-pointer px-2 py-1 rounded" style={{ color: T.textSub, backgroundColor: T.card }}>クリア</button>
                  </div>
                  {rangeTotal && (
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px]" style={{ color: T.text }}>
                      <span>予約: <strong>{rangeTotal.count}件</strong></span>
                      <span style={{ color: "#85a8c4" }}>店取概算: <strong>{fmt(rangeTotal.storeShare)}</strong></span>
                      <span style={{ color: T.accent }}>売上: <strong>{fmt(rangeTotal.sales)}</strong></span>
                      <span style={{ color: "#7ab88f" }}>セラピスト: <strong>{fmt(rangeTotal.back)}</strong></span>
                      {rangeTotal.discount > 0 && <span style={{ color: "#f59e0b" }}>割引: <strong>−{fmt(rangeTotal.discount)}</strong></span>}
                      {rangeTotal.card > 0 && <span style={{ color: T.textSub }}>カード: <strong>{fmt(rangeTotal.card)}</strong></span>}
                      {rangeTotal.cardFee > 0 && <span style={{ color: "#22c55e" }}>カード手数料: <strong>+{fmt(rangeTotal.cardFee)}</strong></span>}
                      {rangeTotal.paypay > 0 && <span style={{ color: T.textSub }}>ペイペイ: <strong>{fmt(rangeTotal.paypay)}</strong></span>}
                      {rangeTotal.invoice > 0 && <span style={{ color: "#a855f7" }}>インボイス: <strong>{fmt(rangeTotal.invoice)}</strong></span>}
                      {rangeTotal.withholding > 0 && <span style={{ color: "#d4687e" }}>源泉: <strong>{fmt(rangeTotal.withholding)}</strong></span>}
                      {rangeTotal.expense > 0 && <span style={{ color: "#c45555" }}>経費: <strong>{fmt(rangeTotal.expense)}</strong></span>}
                      {rangeTotal.advance > 0 && <span style={{ color: "#d4687e" }}>前借り: <strong>−{fmt(rangeTotal.advance)}</strong></span>}
                      {rangeTotal.income > 0 && <span style={{ color: "#22c55e" }}>入金: <strong>+{fmt(rangeTotal.income)}</strong></span>}
                      {rangeTotal.changeNet !== 0 && <span style={{ color: rangeTotal.changeNet > 0 ? "#22c55e" : "#f59e0b" }}>釣銭: <strong>{rangeTotal.changeNet > 0 ? `+${fmt(rangeTotal.changeNet)}` : `−${fmt(Math.abs(rangeTotal.changeNet))}`}</strong></span>}
                      {rangeTotal.reserve !== 0 && <span style={{ color: rangeTotal.reserve > 0 ? "#22c55e" : "#d4687e" }}>豊橋予備金: <strong>{rangeTotal.reserve > 0 ? `+${fmt(rangeTotal.reserve)}` : `−${fmt(Math.abs(rangeTotal.reserve))}`}</strong></span>}
                      <span style={{ color: rangeTotal.cashOnHand >= 0 ? "#22c55e" : "#c45555" }}>事務所残金: <strong>{fmt(rangeTotal.cashOnHand)}</strong></span>
                    </div>
                  )}
                </div>
              )}
              {activeFormula === "sales" && (
                <div className="mb-3 rounded-xl border p-3 flex items-center justify-between" style={{ backgroundColor: "rgba(195,167,130,0.08)", borderColor: T.accent }}>
                  <div className="text-[12px]" style={{ color: T.text }}>
                    <span className="font-medium" style={{ color: T.accent }}>💡 売上の内訳</span>
                    <span className="mx-2" style={{ color: T.textMuted }}>=</span>
                    <span>コース定価 + 指名料 + オプション + 延長</span>
                    <span className="mx-2" style={{ color: T.textFaint }}>|</span>
                    <span className="text-[11px]" style={{ color: T.textMuted }}>定価ベース（割引・カード/ペイペイ・経費/入金を引く前）</span>
                  </div>
                  <button onClick={() => setActiveFormula(null)} className="text-[12px] cursor-pointer" style={{ color: T.textSub }}>✕</button>
                </div>
              )}
              {activeFormula === "storeShare" && (
                <div className="mb-3 rounded-xl border p-3 flex items-center justify-between" style={{ backgroundColor: "rgba(133,168,196,0.08)", borderColor: "#85a8c4" }}>
                  <div className="text-[12px]" style={{ color: T.text }}>
                    <span className="font-medium" style={{ color: "#85a8c4" }}>💡 店取概算の計算式</span>
                    <span className="mx-2" style={{ color: T.textMuted }}>=</span>
                    <span style={{ color: T.accent }}>売上</span>
                    <span className="mx-1" style={{ color: T.textMuted }}>−</span>
                    <span style={{ color: "#f59e0b" }}>割引</span>
                    <span className="mx-1" style={{ color: T.textMuted }}>−</span>
                    <span style={{ color: "#7ab88f" }}>セラピスト</span>
                    <span className="mx-1" style={{ color: T.textMuted }}>−</span>
                    <span style={{ color: "#a855f7" }}>インボイス</span>
                    <span className="mx-1" style={{ color: T.textMuted }}>−</span>
                    <span style={{ color: "#d4687e" }}>源泉</span>
                    <span className="mx-2" style={{ color: T.textFaint }}>|</span>
                    <span className="text-[11px]" style={{ color: T.textMuted }}>インボイス・源泉は国へ納付するため店取りから除く</span>
                  </div>
                  <button onClick={() => setActiveFormula(null)} className="text-[12px] cursor-pointer" style={{ color: T.textSub }}>✕</button>
                </div>
              )}
              {activeFormula === "avg" && (
                <div className="mb-3 rounded-xl border p-3 flex items-center justify-between" style={{ backgroundColor: "rgba(138,138,138,0.06)", borderColor: T.textSub }}>
                  <div className="text-[12px]" style={{ color: T.text }}>
                    <span className="font-medium" style={{ color: T.textSub }}>💡 平均単価の計算式</span>
                    <span className="mx-2" style={{ color: T.textMuted }}>=</span>
                    <span style={{ color: "#85a8c4" }}>店取概算</span>
                    <span className="mx-1" style={{ color: T.textMuted }}>÷</span>
                    <span>予約数</span>
                  </div>
                  <button onClick={() => setActiveFormula(null)} className="text-[12px] cursor-pointer" style={{ color: T.textSub }}>✕</button>
                </div>
              )}
              {activeFormula === "back" && (
                <div className="mb-3 rounded-xl border p-3 flex items-center justify-between" style={{ backgroundColor: "rgba(122,184,143,0.08)", borderColor: "#7ab88f" }}>
                  <div className="text-[12px]" style={{ color: T.text }}>
                    <span className="font-medium" style={{ color: "#7ab88f" }}>💡 セラピスト（実支給額）の内訳</span>
                    <span className="mx-2" style={{ color: T.textMuted }}>=</span>
                    <span>バック合計</span>
                    <span className="mx-1" style={{ color: T.textMuted }}>−</span>
                    <span style={{ color: "#a855f7" }}>インボイス</span>
                    <span className="mx-1" style={{ color: T.textMuted }}>−</span>
                    <span style={{ color: "#d4687e" }}>源泉</span>
                    <span className="mx-1" style={{ color: T.textMuted }}>−</span>
                    <span>備品・リネン代</span>
                    <span className="mx-1" style={{ color: T.textMuted }}>+</span>
                    <span>交通費(実費精算)</span>
                    <span className="mx-1" style={{ color: T.textMuted }}>+</span>
                    <span>調整金</span>
                    <span className="mx-2" style={{ color: T.textFaint }}>|</span>
                    <span className="text-[11px]" style={{ color: T.textMuted }}>精算モーダルで確定したセラピストへの実際の支給額（final_payment）</span>
                  </div>
                  <button onClick={() => setActiveFormula(null)} className="text-[12px] cursor-pointer" style={{ color: T.textSub }}>✕</button>
                </div>
              )}
              {activeFormula === "card" && (
                <div className="mb-3 rounded-xl border p-3 flex items-center justify-between" style={{ backgroundColor: "rgba(138,138,138,0.06)", borderColor: T.textSub }}>
                  <div className="text-[12px]" style={{ color: T.text }}>
                    <span className="font-medium" style={{ color: T.textSub }}>💡 カードの内訳</span>
                    <span className="mx-2" style={{ color: T.textMuted }}>=</span>
                    <span style={{ color: T.accent }}>売上</span>
                    <span className="mx-1" style={{ color: T.textMuted }}>×</span>
                    <span>1.10</span>
                    <span className="mx-2" style={{ color: T.textFaint }}>|</span>
                    <span className="text-[11px]" style={{ color: "#f59e0b" }}>TAX 10% 上乗せ込み</span>
                    <span className="mx-2" style={{ color: T.textFaint }}>|</span>
                    <span className="text-[11px]" style={{ color: T.textMuted }}>コース料金は税込、カード決済時のみ10%上乗せ請求（上乗せ分は店の収入）</span>
                  </div>
                  <button onClick={() => setActiveFormula(null)} className="text-[12px] cursor-pointer" style={{ color: T.textSub }}>✕</button>
                </div>
              )}
              <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: T.card, borderColor: T.border }}>
                <div className="overflow-x-auto">
                  <table className="text-[11px]" style={{ fontVariantNumeric: "tabular-nums", borderCollapse: "collapse", minWidth: "100%" }}>
                    <thead>
                      <tr style={{ backgroundColor: T.cardAlt, borderBottom: `2px solid ${T.border}` }}>
                        {[
                          { label: "日付", align: "left", w: "54px", key: null },
                          { label: "曜", align: "center", w: "28px", key: null },
                          { label: "予約", align: "right", w: "48px", key: null },
                          { label: "平均単価", align: "right", w: "", key: "avg" as const },
                          { label: "店取概算", align: "right", w: "", key: "storeShare" as const },
                          { label: "売上", align: "right", w: "", key: "sales" as const },
                          { label: "セラピスト", align: "right", w: "", key: "back" as const },
                          { label: "割引", align: "right", w: "", key: null },
                          { label: "カード", align: "right", w: "", key: "card" as const },
                          { label: "カード手数料", align: "right", w: "", key: null },
                          { label: "ペイペイ", align: "right", w: "", key: null },
                          { label: "インボイス", align: "right", w: "", key: null },
                          { label: "源泉", align: "right", w: "", key: null },
                          { label: "経費", align: "right", w: "", key: null },
                          { label: "前借り", align: "right", w: "", key: null },
                          { label: "入金", align: "right", w: "", key: null },
                          { label: "売上未回収", align: "right", w: "", key: null },
                          { label: "金庫未回収", align: "right", w: "", key: null },
                          { label: "釣銭", align: "right", w: "", key: null },
                          { label: "豊橋予備金", align: "right", w: "", key: null },
                          { label: "事務所残金", align: "right", w: "", key: null },
                        ].map((h) => (
                          <th
                            key={h.label}
                            onClick={h.key ? () => toggleFormula(h.key!) : undefined}
                            className={`py-2 px-1.5 font-medium text-[10px] text-${h.align} whitespace-nowrap ${h.key ? "cursor-pointer select-none" : ""}`}
                            style={{
                              color: h.key && activeFormula === h.key ? "#85a8c4" : T.textMuted,
                              width: h.w || "auto",
                              borderRight: `1px solid ${T.border}`,
                              position: "sticky",
                              top: 0,
                              backgroundColor: T.cardAlt,
                              zIndex: 10,
                            }}
                          >
                            {h.label}{h.key ? " ⓘ" : ""}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {dailyData.map((d) => {
                        const zero = d.count === 0 && d.expense === 0 && d.income === 0 && d.replenish === 0 && d.advance === 0 && d.uncollectedSales === 0 && d.safeUncollected === 0 && d.cashOnHand === 0 && d.reserve === 0 && d.changeNet === 0;
                        const dowColor = d.dow === "日" ? "#c45555" : d.dow === "土" ? "#3d6b9f" : T.textSub;
                        const dash = (v: number, formatted: string) => (zero && v === 0) ? "—" : formatted;
                        // 選択範囲判定
                        const inRange = rangeStart && ((!rangeEnd && d.date === rangeStart) || (rangeEnd && d.date >= rangeStart && d.date <= rangeEnd));
                        const rowBg = inRange ? "rgba(133,168,196,0.12)" : d.dow === "日" ? "rgba(196,85,85,0.03)" : d.dow === "土" ? "rgba(61,107,159,0.03)" : "transparent";
                        return (
                          <tr key={d.date} style={{ borderBottom: `1px solid ${T.border}`, opacity: zero && !inRange ? 0.45 : 1, backgroundColor: rowBg }}>
                            <td
                              onClick={() => handleDateClick(d.date)}
                              className="py-1.5 px-1.5 whitespace-nowrap cursor-pointer select-none"
                              style={{ borderRight: `1px solid ${T.border}`, fontWeight: inRange ? 600 : 400, color: inRange ? "#85a8c4" : "inherit" }}
                              title="クリックで期間選択（1回目=開始、2回目=終了）"
                            >{`${smMonth}/${d.label}`}</td>
                            <td className="py-1.5 px-1.5 text-center font-medium" style={{ color: dowColor, borderRight: `1px solid ${T.border}` }}>{d.dow}</td>
                            <td className="py-1.5 px-1.5 text-right" style={{ borderRight: `1px solid ${T.border}` }}>{d.count === 0 ? "—" : d.count}</td>
                            <td className="py-1.5 px-1.5 text-right whitespace-nowrap" style={{ color: d.avgNet === 0 ? T.textFaint : T.textSub, borderRight: `1px solid ${T.border}` }}>{d.avgNet === 0 ? "—" : fmt(d.avgNet)}</td>
                            <td className="py-1.5 px-1.5 text-right font-medium whitespace-nowrap" style={{ color: d.storeShare === 0 ? T.textFaint : d.storeShare >= 0 ? "#85a8c4" : "#c45555", borderRight: `1px solid ${T.border}` }}>{dash(d.storeShare, fmt(d.storeShare))}</td>
                            <td className="py-1.5 px-1.5 text-right font-medium whitespace-nowrap" style={{ color: d.sales === 0 ? T.textFaint : T.accent, borderRight: `1px solid ${T.border}` }}>{dash(d.sales, fmt(d.sales))}</td>
                            <td className="py-1.5 px-1.5 text-right whitespace-nowrap" style={{ color: d.back === 0 ? T.textFaint : "#7ab88f", borderRight: `1px solid ${T.border}` }}>{dash(d.back, fmt(d.back))}</td>
                            <td className="py-1.5 px-1.5 text-right whitespace-nowrap" style={{ color: d.discount === 0 ? T.textFaint : "#f59e0b", borderRight: `1px solid ${T.border}` }}>{dash(d.discount, d.discount === 0 ? fmt(0) : `−${fmt(d.discount)}`)}</td>
                            <td className="py-1.5 px-1.5 text-right whitespace-nowrap" style={{ color: d.card === 0 ? T.textFaint : T.textSub, borderRight: `1px solid ${T.border}` }}>{dash(d.card, fmt(d.card))}</td>
                            <td className="py-1.5 px-1.5 text-right whitespace-nowrap" style={{ color: d.cardFee === 0 ? T.textFaint : "#22c55e", borderRight: `1px solid ${T.border}` }}>{d.cardFee === 0 ? (zero ? "—" : fmt(0)) : `+${fmt(d.cardFee)}`}</td>
                            <td className="py-1.5 px-1.5 text-right whitespace-nowrap" style={{ color: d.paypay === 0 ? T.textFaint : T.textSub, borderRight: `1px solid ${T.border}` }}>{dash(d.paypay, fmt(d.paypay))}</td>
                            <td className="py-1.5 px-1.5 text-right whitespace-nowrap" style={{ color: d.invoice === 0 ? T.textFaint : "#a855f7", borderRight: `1px solid ${T.border}` }}>{dash(d.invoice, fmt(d.invoice))}</td>
                            <td className="py-1.5 px-1.5 text-right whitespace-nowrap" style={{ color: d.withholding === 0 ? T.textFaint : "#d4687e", borderRight: `1px solid ${T.border}` }}>{dash(d.withholding, fmt(d.withholding))}</td>
                            <td className="py-1.5 px-1.5 text-right whitespace-nowrap" style={{ color: d.expense === 0 ? T.textFaint : "#c45555", borderRight: `1px solid ${T.border}` }}>{dash(d.expense, fmt(d.expense))}</td>
                            <td className="py-1.5 px-1.5 text-right whitespace-nowrap" style={{ color: d.advance === 0 ? T.textFaint : "#d4687e", borderRight: `1px solid ${T.border}` }}>{dash(d.advance, d.advance === 0 ? fmt(0) : `−${fmt(d.advance)}`)}</td>
                            <td className="py-1.5 px-1.5 text-right whitespace-nowrap" style={{ color: d.income === 0 ? T.textFaint : "#22c55e", borderRight: `1px solid ${T.border}` }}>{dash(d.income, d.income === 0 ? fmt(0) : `+${fmt(d.income)}`)}</td>
                            <td className="py-1.5 px-1.5 text-right whitespace-nowrap" style={{ color: d.uncollectedSales === 0 ? T.textFaint : "#c45555", borderRight: `1px solid ${T.border}` }}>{dash(d.uncollectedSales, d.uncollectedSales === 0 ? fmt(0) : `−${fmt(d.uncollectedSales)}`)}</td>
                            <td className="py-1.5 px-1.5 text-right whitespace-nowrap" style={{ color: d.safeUncollected === 0 ? T.textFaint : "#c45555", borderRight: `1px solid ${T.border}` }}>{dash(d.safeUncollected, d.safeUncollected === 0 ? fmt(0) : `−${fmt(d.safeUncollected)}`)}</td>
                            <td className="py-1.5 px-1.5 text-right whitespace-nowrap" style={{ color: d.changeNet === 0 ? T.textFaint : d.changeNet > 0 ? "#22c55e" : "#f59e0b", borderRight: `1px solid ${T.border}` }}>{d.changeNet === 0 ? (zero ? "—" : fmt(0)) : d.changeNet > 0 ? `+${fmt(d.changeNet)}` : `−${fmt(Math.abs(d.changeNet))}`}</td>
                            <td className="py-1.5 px-1.5 text-right whitespace-nowrap" style={{ color: d.reserve === 0 ? T.textFaint : d.reserve > 0 ? "#22c55e" : "#d4687e", borderRight: `1px solid ${T.border}` }}>{d.reserve === 0 ? (zero ? "—" : fmt(0)) : d.reserve > 0 ? `+${fmt(d.reserve)}` : `−${fmt(Math.abs(d.reserve))}`}</td>
                            <td className="py-1.5 px-1.5 text-right font-bold whitespace-nowrap" style={{ color: zero ? T.textFaint : d.cashOnHand >= 0 ? "#22c55e" : "#c45555", backgroundColor: zero ? "transparent" : "rgba(245,158,11,0.04)" }}>{zero && d.cashOnHand === 0 ? "—" : fmt(d.cashOnHand)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      {(() => {
                        const tot = dailyData.reduce((acc, d) => ({
                          count: acc.count + d.count,
                          sales: acc.sales + d.sales,
                          discount: acc.discount + d.discount,
                          card: acc.card + d.card,
                          paypay: acc.paypay + d.paypay,
                          cash: acc.cash + d.cash,
                          back: acc.back + d.back,
                          invoice: acc.invoice + d.invoice,
                          withholding: acc.withholding + d.withholding,
                          expense: acc.expense + d.expense,
                          advance: acc.advance + d.advance,
                          income: acc.income + d.income,
                          uncollectedSales: acc.uncollectedSales + d.uncollectedSales,
                          safeUncollected: acc.safeUncollected + d.safeUncollected,
                          cashOnHand: acc.cashOnHand + d.cashOnHand,
                          storeShare: acc.storeShare + d.storeShare,
                          reserve: acc.reserve + d.reserve,
                          changeNet: acc.changeNet + d.changeNet,
                          cardFee: acc.cardFee + d.cardFee,
                        }), { count: 0, sales: 0, discount: 0, card: 0, paypay: 0, cash: 0, back: 0, invoice: 0, withholding: 0, expense: 0, advance: 0, income: 0, uncollectedSales: 0, safeUncollected: 0, cashOnHand: 0, storeShare: 0, reserve: 0, changeNet: 0, cardFee: 0 });
                        // 平均単価 = 店取概算 ÷ 予約数
                        const avg = tot.count > 0 ? Math.round(tot.storeShare / tot.count) : 0;
                        return (
                          <tr style={{ borderTop: `2px solid ${T.border}`, backgroundColor: T.cardAlt }}>
                            <td className="py-2 px-1.5 font-bold" style={{ borderRight: `1px solid ${T.border}` }} colSpan={2}>合計</td>
                            <td className="py-2 px-1.5 text-right font-bold" style={{ borderRight: `1px solid ${T.border}` }}>{tot.count}</td>
                            <td className="py-2 px-1.5 text-right font-bold whitespace-nowrap" style={{ color: T.textSub, borderRight: `1px solid ${T.border}` }}>{avg > 0 ? fmt(avg) : "—"}</td>
                            <td className="py-2 px-1.5 text-right font-bold whitespace-nowrap" style={{ color: tot.storeShare >= 0 ? "#85a8c4" : "#c45555", borderRight: `1px solid ${T.border}` }}>{fmt(tot.storeShare)}</td>
                            <td className="py-2 px-1.5 text-right font-bold whitespace-nowrap" style={{ color: T.accent, borderRight: `1px solid ${T.border}` }}>{fmt(tot.sales)}</td>
                            <td className="py-2 px-1.5 text-right font-bold whitespace-nowrap" style={{ color: "#7ab88f", borderRight: `1px solid ${T.border}` }}>{fmt(tot.back)}</td>
                            <td className="py-2 px-1.5 text-right font-bold whitespace-nowrap" style={{ color: tot.discount === 0 ? T.textFaint : "#f59e0b", borderRight: `1px solid ${T.border}` }}>{tot.discount === 0 ? fmt(0) : `−${fmt(tot.discount)}`}</td>
                            <td className="py-2 px-1.5 text-right font-bold whitespace-nowrap" style={{ color: T.textSub, borderRight: `1px solid ${T.border}` }}>{fmt(tot.card)}</td>
                            <td className="py-2 px-1.5 text-right font-bold whitespace-nowrap" style={{ color: tot.cardFee === 0 ? T.textFaint : "#22c55e", borderRight: `1px solid ${T.border}` }}>{tot.cardFee === 0 ? fmt(0) : `+${fmt(tot.cardFee)}`}</td>
                            <td className="py-2 px-1.5 text-right font-bold whitespace-nowrap" style={{ color: T.textSub, borderRight: `1px solid ${T.border}` }}>{fmt(tot.paypay)}</td>
                            <td className="py-2 px-1.5 text-right font-bold whitespace-nowrap" style={{ color: "#a855f7", borderRight: `1px solid ${T.border}` }}>{fmt(tot.invoice)}</td>
                            <td className="py-2 px-1.5 text-right font-bold whitespace-nowrap" style={{ color: "#d4687e", borderRight: `1px solid ${T.border}` }}>{fmt(tot.withholding)}</td>
                            <td className="py-2 px-1.5 text-right font-bold whitespace-nowrap" style={{ color: "#c45555", borderRight: `1px solid ${T.border}` }}>{fmt(tot.expense)}</td>
                            <td className="py-2 px-1.5 text-right font-bold whitespace-nowrap" style={{ color: tot.advance === 0 ? T.textFaint : "#d4687e", borderRight: `1px solid ${T.border}` }}>{tot.advance === 0 ? fmt(0) : `−${fmt(tot.advance)}`}</td>
                            <td className="py-2 px-1.5 text-right font-bold whitespace-nowrap" style={{ color: tot.income === 0 ? T.textFaint : "#22c55e", borderRight: `1px solid ${T.border}` }}>{tot.income === 0 ? fmt(0) : `+${fmt(tot.income)}`}</td>
                            <td className="py-2 px-1.5 text-right font-bold whitespace-nowrap" style={{ color: "#c45555", borderRight: `1px solid ${T.border}` }}>{tot.uncollectedSales === 0 ? fmt(0) : `−${fmt(tot.uncollectedSales)}`}</td>
                            <td className="py-2 px-1.5 text-right font-bold whitespace-nowrap" style={{ color: "#c45555", borderRight: `1px solid ${T.border}` }}>{tot.safeUncollected === 0 ? fmt(0) : `−${fmt(tot.safeUncollected)}`}</td>
                            <td className="py-2 px-1.5 text-right font-bold whitespace-nowrap" style={{ color: tot.changeNet === 0 ? T.textFaint : tot.changeNet > 0 ? "#22c55e" : "#f59e0b", borderRight: `1px solid ${T.border}` }}>{tot.changeNet === 0 ? fmt(0) : tot.changeNet > 0 ? `+${fmt(tot.changeNet)}` : `−${fmt(Math.abs(tot.changeNet))}`}</td>
                            <td className="py-2 px-1.5 text-right font-bold whitespace-nowrap" style={{ color: tot.reserve === 0 ? T.textFaint : tot.reserve > 0 ? "#22c55e" : "#d4687e", borderRight: `1px solid ${T.border}` }}>{tot.reserve === 0 ? fmt(0) : tot.reserve > 0 ? `+${fmt(tot.reserve)}` : `−${fmt(Math.abs(tot.reserve))}`}</td>
                            <td className="py-2 px-1.5 text-right font-bold whitespace-nowrap" style={{ color: tot.cashOnHand >= 0 ? "#22c55e" : "#c45555", backgroundColor: "rgba(245,158,11,0.06)" }}>{fmt(tot.cashOnHand)}</td>
                          </tr>
                        );
                      })()}
                    </tfoot>
                  </table>
                </div>
              </div>
              <div className="mt-2 space-y-1">
                <p className="text-[10px]" style={{ color: T.textFaint }}>※ 💡 <strong>日付セルをクリック</strong>すると期間選択できます（1回目=開始日、2回目=終了日）。選択中は行がハイライトされ上部に小計バーが表示されます</p>
                <p className="text-[10px]" style={{ color: T.textFaint }}>※ オーダーが「終了」になっている予約のみ集計。事務所残金は営業締めと同じ計算式</p>
                <p className="text-[10px]" style={{ color: T.textFaint }}>※ 売上は定価ベース（コース+指名+オプション+延長）、売上 − 割引 = 実売上</p>
                <p className="text-[10px]" style={{ color: T.textFaint }}>※ セラピスト列は「実支給額」= バック合計 − インボイス − 源泉 − 備品・リネン代 + 交通費(実費精算) + 調整金</p>
                <p className="text-[10px]" style={{ color: T.textFaint }}>※ 店取概算 = 売上 − 割引 − セラピスト − インボイス − 源泉（インボイス・源泉は国へ納付するため店取りから除外）</p>
                <p className="text-[10px]" style={{ color: T.textFaint }}>※ 売上未回収・金庫未回収は「まだ事務所に入っていない現金」なのでマイナス表記（赤）</p>
                <p className="text-[10px]" style={{ color: T.textFaint }}>※ カード手数料列: カード決済時に10%上乗せ請求した分（カード − カード÷1.10）。店の追加収入</p>
                <p className="text-[10px]" style={{ color: T.textFaint }}>※ 釣銭列: −=補充（事務所金庫からルームへ）/ +=回収（ルームから事務所金庫へ）。合計が0なら整合OK</p>
                <p className="text-[10px]" style={{ color: T.textFaint }}>※ 前借り列: スタッフ前借り（pending）の日次合計。月末第1月曜12時以降に外注費へ自動振替され、振替後は経費列に計上される</p>
                <p className="text-[10px]" style={{ color: T.textFaint }}>※ 豊橋予備金列: −=立替（予備金が減った、セラピスト補填）/ +=補充・初期・調整（予備金が増えた）</p>
              </div>
            </div>
          )}

          {/* 月別 */}
          {tab === "monthly" && (
            <div className="animate-[fadeIn_0.3s]">
              <div className="flex items-center justify-center gap-4 mb-4">
                <button onClick={() => setSelectedYear(selectedYear - 1)} className="p-1 cursor-pointer" style={{ color: T.textSub }}>◀</button>
                <span className="text-[14px] font-medium">{selectedYear}年 月別</span>
                <button onClick={() => setSelectedYear(selectedYear + 1)} className="p-1 cursor-pointer" style={{ color: T.textSub }}>▶</button>
              </div>
              <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: T.card, borderColor: T.border }}>
                <div className="overflow-x-auto">
                  <table className="text-[11px]" style={{ fontVariantNumeric: "tabular-nums", borderCollapse: "collapse", minWidth: "100%" }}>
                    <thead>
                      <tr style={{ backgroundColor: T.cardAlt, borderBottom: `2px solid ${T.border}` }}>
                        {[
                          { label: "月", align: "left" },
                          { label: "予約", align: "right" },
                          { label: "平均単価", align: "right" },
                          { label: "店取概算", align: "right" },
                          { label: "売上", align: "right" },
                          { label: "セラピスト", align: "right" },
                          { label: "割引", align: "right" },
                          { label: "カード", align: "right" },
                          { label: "カード手数料", align: "right" },
                          { label: "ペイペイ", align: "right" },
                          { label: "インボイス", align: "right" },
                          { label: "源泉", align: "right" },
                          { label: "経費", align: "right" },
                          { label: "前借り", align: "right" },
                          { label: "入金", align: "right" },
                          { label: "売上未回収", align: "right" },
                          { label: "金庫未回収", align: "right" },
                          { label: "釣銭", align: "right" },
                          { label: "豊橋予備金", align: "right" },
                          { label: "事務所残金", align: "right" },
                        ].map((h) => (
                          <th key={h.label} className={`py-2 px-1.5 font-medium text-[10px] text-${h.align} whitespace-nowrap`}
                            style={{ color: T.textMuted, borderRight: `1px solid ${T.border}`, position: "sticky", top: 0, backgroundColor: T.cardAlt, zIndex: 10 }}>
                            {h.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {monthlyData.map((d) => {
                        const zero = d.count === 0 && d.expense === 0 && d.income === 0 && d.replenish === 0 && d.advance === 0 && d.uncollectedSales === 0 && d.safeUncollected === 0 && d.cashOnHand === 0 && d.reserve === 0 && d.changeNet === 0;
                        const dash = (v: number, formatted: string) => (zero && v === 0) ? "—" : formatted;
                        return (
                          <tr key={d.month} style={{ borderBottom: `1px solid ${T.border}`, opacity: zero ? 0.45 : 1 }}>
                            <td className="py-1.5 px-1.5 font-medium whitespace-nowrap" style={{ borderRight: `1px solid ${T.border}` }}>{d.label}</td>
                            <td className="py-1.5 px-1.5 text-right" style={{ borderRight: `1px solid ${T.border}` }}>{d.count === 0 ? "—" : d.count}</td>
                            <td className="py-1.5 px-1.5 text-right whitespace-nowrap" style={{ color: d.avgNet === 0 ? T.textFaint : T.textSub, borderRight: `1px solid ${T.border}` }}>{d.avgNet === 0 ? "—" : fmt(d.avgNet)}</td>
                            <td className="py-1.5 px-1.5 text-right font-medium whitespace-nowrap" style={{ color: d.storeShare === 0 ? T.textFaint : d.storeShare >= 0 ? "#85a8c4" : "#c45555", borderRight: `1px solid ${T.border}` }}>{dash(d.storeShare, fmt(d.storeShare))}</td>
                            <td className="py-1.5 px-1.5 text-right font-medium whitespace-nowrap" style={{ color: d.sales === 0 ? T.textFaint : T.accent, borderRight: `1px solid ${T.border}` }}>{dash(d.sales, fmt(d.sales))}</td>
                            <td className="py-1.5 px-1.5 text-right whitespace-nowrap" style={{ color: d.back === 0 ? T.textFaint : "#7ab88f", borderRight: `1px solid ${T.border}` }}>{dash(d.back, fmt(d.back))}</td>
                            <td className="py-1.5 px-1.5 text-right whitespace-nowrap" style={{ color: d.discount === 0 ? T.textFaint : "#f59e0b", borderRight: `1px solid ${T.border}` }}>{dash(d.discount, d.discount === 0 ? fmt(0) : `−${fmt(d.discount)}`)}</td>
                            <td className="py-1.5 px-1.5 text-right whitespace-nowrap" style={{ color: d.card === 0 ? T.textFaint : T.textSub, borderRight: `1px solid ${T.border}` }}>{dash(d.card, fmt(d.card))}</td>
                            <td className="py-1.5 px-1.5 text-right whitespace-nowrap" style={{ color: d.cardFee === 0 ? T.textFaint : "#22c55e", borderRight: `1px solid ${T.border}` }}>{dash(d.cardFee, d.cardFee === 0 ? fmt(0) : `+${fmt(d.cardFee)}`)}</td>
                            <td className="py-1.5 px-1.5 text-right whitespace-nowrap" style={{ color: d.paypay === 0 ? T.textFaint : T.textSub, borderRight: `1px solid ${T.border}` }}>{dash(d.paypay, fmt(d.paypay))}</td>
                            <td className="py-1.5 px-1.5 text-right whitespace-nowrap" style={{ color: d.invoice === 0 ? T.textFaint : "#a855f7", borderRight: `1px solid ${T.border}` }}>{dash(d.invoice, fmt(d.invoice))}</td>
                            <td className="py-1.5 px-1.5 text-right whitespace-nowrap" style={{ color: d.withholding === 0 ? T.textFaint : "#d4687e", borderRight: `1px solid ${T.border}` }}>{dash(d.withholding, fmt(d.withholding))}</td>
                            <td className="py-1.5 px-1.5 text-right whitespace-nowrap" style={{ color: d.expense === 0 ? T.textFaint : "#c45555", borderRight: `1px solid ${T.border}` }}>{dash(d.expense, fmt(d.expense))}</td>
                            <td className="py-1.5 px-1.5 text-right whitespace-nowrap" style={{ color: d.advance === 0 ? T.textFaint : "#d4687e", borderRight: `1px solid ${T.border}` }}>{dash(d.advance, d.advance === 0 ? fmt(0) : `−${fmt(d.advance)}`)}</td>
                            <td className="py-1.5 px-1.5 text-right whitespace-nowrap" style={{ color: d.income === 0 ? T.textFaint : "#22c55e", borderRight: `1px solid ${T.border}` }}>{dash(d.income, d.income === 0 ? fmt(0) : `+${fmt(d.income)}`)}</td>
                            <td className="py-1.5 px-1.5 text-right whitespace-nowrap" style={{ color: d.uncollectedSales === 0 ? T.textFaint : "#c45555", borderRight: `1px solid ${T.border}` }}>{dash(d.uncollectedSales, d.uncollectedSales === 0 ? fmt(0) : `−${fmt(d.uncollectedSales)}`)}</td>
                            <td className="py-1.5 px-1.5 text-right whitespace-nowrap" style={{ color: d.safeUncollected === 0 ? T.textFaint : "#c45555", borderRight: `1px solid ${T.border}` }}>{dash(d.safeUncollected, d.safeUncollected === 0 ? fmt(0) : `−${fmt(d.safeUncollected)}`)}</td>
                            <td className="py-1.5 px-1.5 text-right whitespace-nowrap" style={{ color: d.changeNet === 0 ? T.textFaint : d.changeNet > 0 ? "#22c55e" : "#f59e0b", borderRight: `1px solid ${T.border}` }}>{d.changeNet === 0 ? (zero ? "—" : fmt(0)) : d.changeNet > 0 ? `+${fmt(d.changeNet)}` : `−${fmt(Math.abs(d.changeNet))}`}</td>
                            <td className="py-1.5 px-1.5 text-right whitespace-nowrap" style={{ color: d.reserve === 0 ? T.textFaint : d.reserve > 0 ? "#22c55e" : "#d4687e", borderRight: `1px solid ${T.border}` }}>{d.reserve === 0 ? (zero ? "—" : fmt(0)) : d.reserve > 0 ? `+${fmt(d.reserve)}` : `−${fmt(Math.abs(d.reserve))}`}</td>
                            <td className="py-1.5 px-1.5 text-right font-bold whitespace-nowrap" style={{ color: zero ? T.textFaint : d.cashOnHand >= 0 ? "#22c55e" : "#c45555", backgroundColor: zero ? "transparent" : "rgba(245,158,11,0.04)" }}>{zero && d.cashOnHand === 0 ? "—" : fmt(d.cashOnHand)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      {(() => {
                        const tot = monthlyData.reduce((a, d) => ({
                          count: a.count + d.count,
                          sales: a.sales + d.sales,
                          discount: a.discount + d.discount,
                          card: a.card + d.card,
                          cardFee: a.cardFee + d.cardFee,
                          paypay: a.paypay + d.paypay,
                          back: a.back + d.back,
                          invoice: a.invoice + d.invoice,
                          withholding: a.withholding + d.withholding,
                          expense: a.expense + d.expense,
                          advance: a.advance + d.advance,
                          income: a.income + d.income,
                          uncollectedSales: a.uncollectedSales + d.uncollectedSales,
                          safeUncollected: a.safeUncollected + d.safeUncollected,
                          cashOnHand: a.cashOnHand + d.cashOnHand,
                          storeShare: a.storeShare + d.storeShare,
                          reserve: a.reserve + d.reserve,
                          changeNet: a.changeNet + d.changeNet,
                        }), { count: 0, sales: 0, discount: 0, card: 0, cardFee: 0, paypay: 0, back: 0, invoice: 0, withholding: 0, expense: 0, advance: 0, income: 0, uncollectedSales: 0, safeUncollected: 0, cashOnHand: 0, storeShare: 0, reserve: 0, changeNet: 0 });
                        const avg = tot.count > 0 ? Math.round(tot.storeShare / tot.count) : 0;
                        return (
                          <tr style={{ borderTop: `2px solid ${T.border}`, backgroundColor: T.cardAlt }}>
                            <td className="py-2 px-1.5 font-bold" style={{ borderRight: `1px solid ${T.border}` }}>年間合計</td>
                            <td className="py-2 px-1.5 text-right font-bold" style={{ borderRight: `1px solid ${T.border}` }}>{tot.count}</td>
                            <td className="py-2 px-1.5 text-right font-bold whitespace-nowrap" style={{ color: T.textSub, borderRight: `1px solid ${T.border}` }}>{avg > 0 ? fmt(avg) : "—"}</td>
                            <td className="py-2 px-1.5 text-right font-bold whitespace-nowrap" style={{ color: tot.storeShare >= 0 ? "#85a8c4" : "#c45555", borderRight: `1px solid ${T.border}` }}>{fmt(tot.storeShare)}</td>
                            <td className="py-2 px-1.5 text-right font-bold whitespace-nowrap" style={{ color: T.accent, borderRight: `1px solid ${T.border}` }}>{fmt(tot.sales)}</td>
                            <td className="py-2 px-1.5 text-right font-bold whitespace-nowrap" style={{ color: "#7ab88f", borderRight: `1px solid ${T.border}` }}>{fmt(tot.back)}</td>
                            <td className="py-2 px-1.5 text-right font-bold whitespace-nowrap" style={{ color: tot.discount === 0 ? T.textFaint : "#f59e0b", borderRight: `1px solid ${T.border}` }}>{tot.discount === 0 ? fmt(0) : `−${fmt(tot.discount)}`}</td>
                            <td className="py-2 px-1.5 text-right font-bold whitespace-nowrap" style={{ color: T.textSub, borderRight: `1px solid ${T.border}` }}>{fmt(tot.card)}</td>
                            <td className="py-2 px-1.5 text-right font-bold whitespace-nowrap" style={{ color: tot.cardFee === 0 ? T.textFaint : "#22c55e", borderRight: `1px solid ${T.border}` }}>{tot.cardFee === 0 ? fmt(0) : `+${fmt(tot.cardFee)}`}</td>
                            <td className="py-2 px-1.5 text-right font-bold whitespace-nowrap" style={{ color: T.textSub, borderRight: `1px solid ${T.border}` }}>{fmt(tot.paypay)}</td>
                            <td className="py-2 px-1.5 text-right font-bold whitespace-nowrap" style={{ color: "#a855f7", borderRight: `1px solid ${T.border}` }}>{fmt(tot.invoice)}</td>
                            <td className="py-2 px-1.5 text-right font-bold whitespace-nowrap" style={{ color: "#d4687e", borderRight: `1px solid ${T.border}` }}>{fmt(tot.withholding)}</td>
                            <td className="py-2 px-1.5 text-right font-bold whitespace-nowrap" style={{ color: "#c45555", borderRight: `1px solid ${T.border}` }}>{fmt(tot.expense)}</td>
                            <td className="py-2 px-1.5 text-right font-bold whitespace-nowrap" style={{ color: tot.advance === 0 ? T.textFaint : "#d4687e", borderRight: `1px solid ${T.border}` }}>{tot.advance === 0 ? fmt(0) : `−${fmt(tot.advance)}`}</td>
                            <td className="py-2 px-1.5 text-right font-bold whitespace-nowrap" style={{ color: tot.income === 0 ? T.textFaint : "#22c55e", borderRight: `1px solid ${T.border}` }}>{tot.income === 0 ? fmt(0) : `+${fmt(tot.income)}`}</td>
                            <td className="py-2 px-1.5 text-right font-bold whitespace-nowrap" style={{ color: "#c45555", borderRight: `1px solid ${T.border}` }}>{tot.uncollectedSales === 0 ? fmt(0) : `−${fmt(tot.uncollectedSales)}`}</td>
                            <td className="py-2 px-1.5 text-right font-bold whitespace-nowrap" style={{ color: "#c45555", borderRight: `1px solid ${T.border}` }}>{tot.safeUncollected === 0 ? fmt(0) : `−${fmt(tot.safeUncollected)}`}</td>
                            <td className="py-2 px-1.5 text-right font-bold whitespace-nowrap" style={{ color: tot.changeNet === 0 ? T.textFaint : tot.changeNet > 0 ? "#22c55e" : "#f59e0b", borderRight: `1px solid ${T.border}` }}>{tot.changeNet === 0 ? fmt(0) : tot.changeNet > 0 ? `+${fmt(tot.changeNet)}` : `−${fmt(Math.abs(tot.changeNet))}`}</td>
                            <td className="py-2 px-1.5 text-right font-bold whitespace-nowrap" style={{ color: tot.reserve === 0 ? T.textFaint : tot.reserve > 0 ? "#22c55e" : "#d4687e", borderRight: `1px solid ${T.border}` }}>{tot.reserve === 0 ? fmt(0) : tot.reserve > 0 ? `+${fmt(tot.reserve)}` : `−${fmt(Math.abs(tot.reserve))}`}</td>
                            <td className="py-2 px-1.5 text-right font-bold whitespace-nowrap" style={{ color: tot.cashOnHand >= 0 ? "#22c55e" : "#c45555", backgroundColor: "rgba(245,158,11,0.06)" }}>{fmt(tot.cashOnHand)}</td>
                          </tr>
                        );
                      })()}
                    </tfoot>
                  </table>
                </div>
              </div>
              <div className="mt-2 space-y-1">
                <p className="text-[10px]" style={{ color: T.textFaint }}>※ 各月の合計は日別の合算で、日別テーブル・営業締めと完全整合</p>
                <p className="text-[10px]" style={{ color: T.textFaint }}>※ 店取概算 = 売上 − 割引 − セラピスト − インボイス − 源泉（国へ納付する分は店取りから除外）</p>
                <p className="text-[10px]" style={{ color: T.textFaint }}>※ 事務所残金 = 各日の事務所残金を月合算した値（資金の動き額）</p>
              </div>
            </div>
          )}

          {/* 年別（複数年比較） */}
          {tab === "yearly" && (
            <div className="animate-[fadeIn_0.3s]">
              <div className="flex items-center justify-center gap-4 mb-4">
                <button onClick={() => setMultiYearAnchor(multiYearAnchor - 1)} className="p-1 cursor-pointer" style={{ color: T.textSub }}>◀</button>
                <span className="text-[14px] font-medium">{multiYearAnchor - 4}年 〜 {multiYearAnchor}年 年度比較</span>
                <button onClick={() => setMultiYearAnchor(multiYearAnchor + 1)} className="p-1 cursor-pointer" style={{ color: T.textSub }}>▶</button>
              </div>
              {multiYearLoading ? (
                <div className="text-center py-8 text-[12px]" style={{ color: T.textMuted }}>📊 読み込み中...</div>
              ) : (
                <>
                  <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: T.card, borderColor: T.border }}>
                    <div className="overflow-x-auto">
                      <table className="text-[11px]" style={{ fontVariantNumeric: "tabular-nums", borderCollapse: "collapse", minWidth: "100%" }}>
                        <thead>
                          <tr style={{ backgroundColor: T.cardAlt, borderBottom: `2px solid ${T.border}` }}>
                            {[
                              { label: "年", align: "left" },
                              { label: "予約", align: "right" },
                              { label: "平均単価", align: "right" },
                              { label: "店取概算", align: "right" },
                              { label: "売上", align: "right" },
                              { label: "セラピスト", align: "right" },
                              { label: "割引", align: "right" },
                              { label: "カード", align: "right" },
                              { label: "カード手数料", align: "right" },
                              { label: "ペイペイ", align: "right" },
                              { label: "インボイス", align: "right" },
                              { label: "源泉", align: "right" },
                              { label: "経費", align: "right" },
                              { label: "前借り", align: "right" },
                              { label: "入金", align: "right" },
                              { label: "売上未回収", align: "right" },
                              { label: "金庫未回収", align: "right" },
                              { label: "釣銭", align: "right" },
                              { label: "豊橋予備金", align: "right" },
                              { label: "事務所残金", align: "right" },
                              { label: "前年比", align: "right" },
                            ].map((h) => (
                              <th key={h.label} className={`py-2 px-1.5 font-medium text-[10px] text-${h.align} whitespace-nowrap`}
                                style={{ color: T.textMuted, borderRight: `1px solid ${T.border}`, position: "sticky", top: 0, backgroundColor: T.cardAlt, zIndex: 10 }}>
                                {h.label}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {multiYearTotals.map((d, idx) => {
                            const zero = d.count === 0 && d.expense === 0 && d.income === 0 && d.advance === 0 && d.uncollectedSales === 0 && d.safeUncollected === 0 && d.cashOnHand === 0 && d.reserve === 0 && d.changeNet === 0;
                            const prev = idx > 0 ? multiYearTotals[idx - 1].sales : 0;
                            const diff = d.sales - prev;
                            const diffPct = prev > 0 ? Math.round((diff / prev) * 100) : 0;
                            const diffColor = diff > 0 ? "#22c55e" : diff < 0 ? "#c45555" : T.textFaint;
                            const dash = (v: number, formatted: string) => (zero && v === 0) ? "—" : formatted;
                            const isCurrent = d.year === new Date().getFullYear();
                            return (
                              <tr key={d.year} style={{ borderBottom: `1px solid ${T.border}`, opacity: zero ? 0.45 : 1, backgroundColor: isCurrent ? "rgba(195,167,130,0.05)" : "transparent" }}>
                                <td className="py-1.5 px-1.5 font-medium whitespace-nowrap" style={{ borderRight: `1px solid ${T.border}`, color: isCurrent ? "#c3a782" : T.text }}>
                                  {d.year}年{isCurrent && <span className="ml-1 text-[9px]" style={{ color: "#c3a782" }}>● 今年</span>}
                                </td>
                                <td className="py-1.5 px-1.5 text-right" style={{ borderRight: `1px solid ${T.border}` }}>{d.count === 0 ? "—" : d.count}</td>
                                <td className="py-1.5 px-1.5 text-right whitespace-nowrap" style={{ color: d.avgNet === 0 ? T.textFaint : T.textSub, borderRight: `1px solid ${T.border}` }}>{d.avgNet === 0 ? "—" : fmt(d.avgNet)}</td>
                                <td className="py-1.5 px-1.5 text-right font-medium whitespace-nowrap" style={{ color: d.storeShare === 0 ? T.textFaint : d.storeShare >= 0 ? "#85a8c4" : "#c45555", borderRight: `1px solid ${T.border}` }}>{dash(d.storeShare, fmt(d.storeShare))}</td>
                                <td className="py-1.5 px-1.5 text-right font-medium whitespace-nowrap" style={{ color: d.sales === 0 ? T.textFaint : T.accent, borderRight: `1px solid ${T.border}` }}>{dash(d.sales, fmt(d.sales))}</td>
                                <td className="py-1.5 px-1.5 text-right whitespace-nowrap" style={{ color: d.back === 0 ? T.textFaint : "#7ab88f", borderRight: `1px solid ${T.border}` }}>{dash(d.back, fmt(d.back))}</td>
                                <td className="py-1.5 px-1.5 text-right whitespace-nowrap" style={{ color: d.discount === 0 ? T.textFaint : "#f59e0b", borderRight: `1px solid ${T.border}` }}>{dash(d.discount, d.discount === 0 ? fmt(0) : `−${fmt(d.discount)}`)}</td>
                                <td className="py-1.5 px-1.5 text-right whitespace-nowrap" style={{ color: d.card === 0 ? T.textFaint : T.textSub, borderRight: `1px solid ${T.border}` }}>{dash(d.card, fmt(d.card))}</td>
                                <td className="py-1.5 px-1.5 text-right whitespace-nowrap" style={{ color: d.cardFee === 0 ? T.textFaint : "#22c55e", borderRight: `1px solid ${T.border}` }}>{dash(d.cardFee, d.cardFee === 0 ? fmt(0) : `+${fmt(d.cardFee)}`)}</td>
                                <td className="py-1.5 px-1.5 text-right whitespace-nowrap" style={{ color: d.paypay === 0 ? T.textFaint : T.textSub, borderRight: `1px solid ${T.border}` }}>{dash(d.paypay, fmt(d.paypay))}</td>
                                <td className="py-1.5 px-1.5 text-right whitespace-nowrap" style={{ color: d.invoice === 0 ? T.textFaint : "#a855f7", borderRight: `1px solid ${T.border}` }}>{dash(d.invoice, fmt(d.invoice))}</td>
                                <td className="py-1.5 px-1.5 text-right whitespace-nowrap" style={{ color: d.withholding === 0 ? T.textFaint : "#d4687e", borderRight: `1px solid ${T.border}` }}>{dash(d.withholding, fmt(d.withholding))}</td>
                                <td className="py-1.5 px-1.5 text-right whitespace-nowrap" style={{ color: d.expense === 0 ? T.textFaint : "#c45555", borderRight: `1px solid ${T.border}` }}>{dash(d.expense, fmt(d.expense))}</td>
                                <td className="py-1.5 px-1.5 text-right whitespace-nowrap" style={{ color: d.advance === 0 ? T.textFaint : "#d4687e", borderRight: `1px solid ${T.border}` }}>{dash(d.advance, d.advance === 0 ? fmt(0) : `−${fmt(d.advance)}`)}</td>
                                <td className="py-1.5 px-1.5 text-right whitespace-nowrap" style={{ color: d.income === 0 ? T.textFaint : "#22c55e", borderRight: `1px solid ${T.border}` }}>{dash(d.income, d.income === 0 ? fmt(0) : `+${fmt(d.income)}`)}</td>
                                <td className="py-1.5 px-1.5 text-right whitespace-nowrap" style={{ color: d.uncollectedSales === 0 ? T.textFaint : "#c45555", borderRight: `1px solid ${T.border}` }}>{dash(d.uncollectedSales, d.uncollectedSales === 0 ? fmt(0) : `−${fmt(d.uncollectedSales)}`)}</td>
                                <td className="py-1.5 px-1.5 text-right whitespace-nowrap" style={{ color: d.safeUncollected === 0 ? T.textFaint : "#c45555", borderRight: `1px solid ${T.border}` }}>{dash(d.safeUncollected, d.safeUncollected === 0 ? fmt(0) : `−${fmt(d.safeUncollected)}`)}</td>
                                <td className="py-1.5 px-1.5 text-right whitespace-nowrap" style={{ color: d.changeNet === 0 ? T.textFaint : d.changeNet > 0 ? "#22c55e" : "#f59e0b", borderRight: `1px solid ${T.border}` }}>{d.changeNet === 0 ? (zero ? "—" : fmt(0)) : d.changeNet > 0 ? `+${fmt(d.changeNet)}` : `−${fmt(Math.abs(d.changeNet))}`}</td>
                                <td className="py-1.5 px-1.5 text-right whitespace-nowrap" style={{ color: d.reserve === 0 ? T.textFaint : d.reserve > 0 ? "#22c55e" : "#d4687e", borderRight: `1px solid ${T.border}` }}>{d.reserve === 0 ? (zero ? "—" : fmt(0)) : d.reserve > 0 ? `+${fmt(d.reserve)}` : `−${fmt(Math.abs(d.reserve))}`}</td>
                                <td className="py-1.5 px-1.5 text-right font-bold whitespace-nowrap" style={{ color: zero ? T.textFaint : d.cashOnHand >= 0 ? "#22c55e" : "#c45555", borderRight: `1px solid ${T.border}`, backgroundColor: zero ? "transparent" : "rgba(245,158,11,0.04)" }}>{zero && d.cashOnHand === 0 ? "—" : fmt(d.cashOnHand)}</td>
                                <td className="py-1.5 px-1.5 text-right text-[10px] whitespace-nowrap" style={{ color: idx === 0 || prev === 0 ? T.textFaint : diffColor }}>
                                  {idx === 0 || prev === 0 ? "—" : `${diff >= 0 ? "+" : ""}${diffPct}%`}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div className="mt-2 space-y-1">
                    <p className="text-[10px]" style={{ color: T.textFaint }}>※ 年度比較: 下ほど新しい年。◀▶ で表示範囲を1年ずつ移動</p>
                    <p className="text-[10px]" style={{ color: T.textFaint }}>※ 各年の合計は日別データの年合算で、日別・月別テーブル・営業締めと完全整合</p>
                    <p className="text-[10px]" style={{ color: T.textFaint }}>※ 前年比 = (当年売上 − 前年売上) ÷ 前年売上</p>
                  </div>
                </>
              )}
            </div>
          )}

          {/* セラピスト別 */}
          {tab === "therapist" && (
            <div className="animate-[fadeIn_0.3s]">
              <div className="flex items-center justify-center gap-4 mb-4">
                <button onClick={prevMonth} className="p-1 cursor-pointer" style={{ color: T.textSub }}>◀</button>
                <span className="text-[14px] font-medium">{smYear}年{smMonth}月 セラピスト別</span>
                <button onClick={nextMonth} className="p-1 cursor-pointer" style={{ color: T.textSub }}>▶</button>
              </div>
              <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: T.card, borderColor: T.border }}>
                <div className="overflow-x-auto">
                  <table className="w-full text-[12px]" style={{ fontVariantNumeric: "tabular-nums", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ backgroundColor: T.cardAlt, borderBottom: `2px solid ${T.border}` }}>
                        {[
                          { label: "順位", align: "center", w: "56px" },
                          { label: "セラピスト", align: "left", w: "" },
                          { label: "予約数", align: "right", w: "" },
                          { label: "指名", align: "right", w: "" },
                          { label: "売上", align: "right", w: "" },
                          { label: "バック", align: "right", w: "" },
                          { label: "利益", align: "right", w: "" },
                          { label: "顧客数", align: "right", w: "" },
                          { label: "平均単価", align: "right", w: "" },
                          { label: "構成比", align: "right", w: "" },
                        ].map((h) => (
                          <th key={h.label} className={`py-2.5 px-3 font-medium text-[11px] text-${h.align}`} style={{ color: T.textMuted, width: h.w || "auto", borderRight: `1px solid ${T.border}` }}>{h.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {therapistData.length === 0 && (
                        <tr><td colSpan={10} className="py-8 text-center text-[12px]" style={{ color: T.textFaint }}>データがありません</td></tr>
                      )}
                      {therapistData.map((t, i) => {
                        const avg = t.count > 0 ? Math.round(t.sales / t.count) : 0;
                        const pct = monthTotal.sales > 0 ? ((t.sales / monthTotal.sales) * 100).toFixed(1) : "0.0";
                        const rankColor = i === 0 ? "#fbbf24" : i === 1 ? "#9ca3af" : i === 2 ? "#c49885" : T.textFaint;
                        return (
                          <tr key={t.id} style={{ borderBottom: `1px solid ${T.border}` }}>
                            <td className="py-2 px-3 text-center font-bold" style={{ color: rankColor, borderRight: `1px solid ${T.border}` }}>{i + 1}</td>
                            <td className="py-2 px-3 font-medium" style={{ borderRight: `1px solid ${T.border}` }}>{t.name}</td>
                            <td className="py-2 px-3 text-right" style={{ borderRight: `1px solid ${T.border}` }}>{t.count}件</td>
                            <td className="py-2 px-3 text-right" style={{ color: T.textSub, borderRight: `1px solid ${T.border}` }}>{t.nomination}件</td>
                            <td className="py-2 px-3 text-right font-medium" style={{ color: T.accent, borderRight: `1px solid ${T.border}` }}>{fmt(t.sales)}</td>
                            <td className="py-2 px-3 text-right" style={{ color: "#7ab88f", borderRight: `1px solid ${T.border}` }}>{fmt(t.back)}</td>
                            <td className="py-2 px-3 text-right" style={{ borderRight: `1px solid ${T.border}` }}>{fmt(t.sales - t.back)}</td>
                            <td className="py-2 px-3 text-right" style={{ color: T.textSub, borderRight: `1px solid ${T.border}` }}>{t.customers}名</td>
                            <td className="py-2 px-3 text-right" style={{ color: T.textSub, borderRight: `1px solid ${T.border}` }}>{fmt(avg)}</td>
                            <td className="py-2 px-3 text-right" style={{ color: T.textSub }}>{pct}%</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    {therapistData.length > 0 && (
                      <tfoot>
                        <tr style={{ borderTop: `2px solid ${T.border}`, backgroundColor: T.cardAlt }}>
                          <td className="py-2.5 px-3 font-bold" style={{ borderRight: `1px solid ${T.border}` }} colSpan={2}>合計</td>
                          <td className="py-2.5 px-3 text-right font-bold" style={{ borderRight: `1px solid ${T.border}` }}>{therapistData.reduce((s, t) => s + t.count, 0)}件</td>
                          <td className="py-2.5 px-3 text-right font-bold" style={{ color: T.textSub, borderRight: `1px solid ${T.border}` }}>{therapistData.reduce((s, t) => s + t.nomination, 0)}件</td>
                          <td className="py-2.5 px-3 text-right font-bold" style={{ color: T.accent, borderRight: `1px solid ${T.border}` }}>{fmt(therapistData.reduce((s, t) => s + t.sales, 0))}</td>
                          <td className="py-2.5 px-3 text-right font-bold" style={{ color: "#7ab88f", borderRight: `1px solid ${T.border}` }}>{fmt(therapistData.reduce((s, t) => s + t.back, 0))}</td>
                          <td className="py-2.5 px-3 text-right font-bold" style={{ borderRight: `1px solid ${T.border}` }}>{fmt(therapistData.reduce((s, t) => s + (t.sales - t.back), 0))}</td>
                          <td className="py-2.5 px-3 text-right font-bold" style={{ color: T.textSub, borderRight: `1px solid ${T.border}` }}>—</td>
                          <td className="py-2.5 px-3 text-right font-bold" style={{ color: T.textSub, borderRight: `1px solid ${T.border}` }}>{monthTotal.count > 0 ? fmt(Math.round(monthTotal.sales / monthTotal.count)) : "—"}</td>
                          <td className="py-2.5 px-3 text-right font-bold" style={{ color: T.textSub }}>100.0%</td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>
              <p className="text-[10px] mt-2" style={{ color: T.textFaint }}>※ オーダーが「終了」になっている予約のみ集計</p>
            </div>
          )}

          {/* コース別 */}
          {tab === "course" && (
            <div className="animate-[fadeIn_0.3s]">
              <div className="flex items-center justify-center gap-4 mb-4">
                <button onClick={prevMonth} className="p-1 cursor-pointer" style={{ color: T.textSub }}>◀</button>
                <span className="text-[14px] font-medium">{smYear}年{smMonth}月 コース別</span>
                <button onClick={nextMonth} className="p-1 cursor-pointer" style={{ color: T.textSub }}>▶</button>
              </div>
              <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: T.card, borderColor: T.border }}>
                <div className="overflow-x-auto">
                  <table className="w-full text-[12px]" style={{ fontVariantNumeric: "tabular-nums", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ backgroundColor: T.cardAlt, borderBottom: `2px solid ${T.border}` }}>
                        {[
                          { label: "順位", align: "center", w: "56px" },
                          { label: "コース名", align: "left", w: "" },
                          { label: "予約数", align: "right", w: "" },
                          { label: "売上", align: "right", w: "" },
                          { label: "平均単価", align: "right", w: "" },
                          { label: "構成比", align: "right", w: "" },
                        ].map((h) => (
                          <th key={h.label} className={`py-2.5 px-3 font-medium text-[11px] text-${h.align}`} style={{ color: T.textMuted, width: h.w || "auto", borderRight: `1px solid ${T.border}` }}>{h.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {courseData.length === 0 && (
                        <tr><td colSpan={6} className="py-8 text-center text-[12px]" style={{ color: T.textFaint }}>データがありません</td></tr>
                      )}
                      {courseData.map((c, i) => {
                        const avg = c.count > 0 ? Math.round(c.sales / c.count) : 0;
                        const pct = totalCourseSales > 0 ? ((c.sales / totalCourseSales) * 100).toFixed(1) : "0.0";
                        const rankColor = i === 0 ? "#fbbf24" : i === 1 ? "#9ca3af" : i === 2 ? "#c49885" : T.textFaint;
                        return (
                          <tr key={c.name} style={{ borderBottom: `1px solid ${T.border}` }}>
                            <td className="py-2 px-3 text-center font-bold" style={{ color: rankColor, borderRight: `1px solid ${T.border}` }}>{i + 1}</td>
                            <td className="py-2 px-3 font-medium" style={{ borderRight: `1px solid ${T.border}` }}>{c.name}</td>
                            <td className="py-2 px-3 text-right" style={{ borderRight: `1px solid ${T.border}` }}>{c.count}件</td>
                            <td className="py-2 px-3 text-right font-medium" style={{ color: T.accent, borderRight: `1px solid ${T.border}` }}>{fmt(c.sales)}</td>
                            <td className="py-2 px-3 text-right" style={{ color: T.textSub, borderRight: `1px solid ${T.border}` }}>{fmt(avg)}</td>
                            <td className="py-2 px-3 text-right" style={{ color: T.textSub }}>{pct}%</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    {courseData.length > 0 && (
                      <tfoot>
                        <tr style={{ borderTop: `2px solid ${T.border}`, backgroundColor: T.cardAlt }}>
                          <td className="py-2.5 px-3 font-bold" style={{ borderRight: `1px solid ${T.border}` }} colSpan={2}>合計</td>
                          <td className="py-2.5 px-3 text-right font-bold" style={{ borderRight: `1px solid ${T.border}` }}>{courseData.reduce((s, c) => s + c.count, 0)}件</td>
                          <td className="py-2.5 px-3 text-right font-bold" style={{ color: T.accent, borderRight: `1px solid ${T.border}` }}>{fmt(courseData.reduce((s, c) => s + c.sales, 0))}</td>
                          <td className="py-2.5 px-3 text-right font-bold" style={{ color: T.textSub, borderRight: `1px solid ${T.border}` }}>{(() => { const tc = courseData.reduce((s, c) => s + c.count, 0); const ts = courseData.reduce((s, c) => s + c.sales, 0); return tc > 0 ? fmt(Math.round(ts / tc)) : "—"; })()}</td>
                          <td className="py-2.5 px-3 text-right font-bold" style={{ color: T.textSub }}>100.0%</td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>
              <p className="text-[10px] mt-2" style={{ color: T.textFaint }}>※ オーダーが「終了」になっている予約のみ集計</p>
            </div>
          )}

          {/* ルーム別 */}
          {tab === "store" && (
            <div className="animate-[fadeIn_0.3s]">
              <div className="flex items-center justify-center gap-4 mb-4">
                <button onClick={prevMonth} className="p-1 cursor-pointer" style={{ color: T.textSub }}>◀</button>
                <span className="text-[14px] font-medium">{smYear}年{smMonth}月 ルーム別</span>
                <button onClick={nextMonth} className="p-1 cursor-pointer" style={{ color: T.textSub }}>▶</button>
              </div>
              <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: T.card, borderColor: T.border }}>
                <div className="overflow-x-auto">
                  <table className="w-full text-[12px]" style={{ fontVariantNumeric: "tabular-nums", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ backgroundColor: T.cardAlt, borderBottom: `2px solid ${T.border}` }}>
                        {[
                          { label: "順位", align: "center", w: "56px" },
                          { label: "ルーム名", align: "left", w: "" },
                          { label: "予約数", align: "right", w: "" },
                          { label: "売上", align: "right", w: "" },
                          { label: "平均単価", align: "right", w: "" },
                          { label: "構成比", align: "right", w: "" },
                        ].map((h) => (
                          <th key={h.label} className={`py-2.5 px-3 font-medium text-[11px] text-${h.align}`} style={{ color: T.textMuted, width: h.w || "auto", borderRight: `1px solid ${T.border}` }}>{h.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {storeData.length === 0 && (
                        <tr><td colSpan={6} className="py-8 text-center text-[12px]" style={{ color: T.textFaint }}>部屋割りデータがありません</td></tr>
                      )}
                      {storeData.map((s, i) => {
                        const totalStoreSales = storeData.reduce((sum, x) => sum + x.sales, 0);
                        const avg = s.count > 0 ? Math.round(s.sales / s.count) : 0;
                        const pct = totalStoreSales > 0 ? ((s.sales / totalStoreSales) * 100).toFixed(1) : "0.0";
                        const rankColor = i === 0 ? "#fbbf24" : i === 1 ? "#9ca3af" : i === 2 ? "#c49885" : T.textFaint;
                        return (
                          <tr key={s.id} style={{ borderBottom: `1px solid ${T.border}` }}>
                            <td className="py-2 px-3 text-center font-bold" style={{ color: rankColor, borderRight: `1px solid ${T.border}` }}>{i + 1}</td>
                            <td className="py-2 px-3 font-medium" style={{ borderRight: `1px solid ${T.border}` }}>{s.name}</td>
                            <td className="py-2 px-3 text-right" style={{ borderRight: `1px solid ${T.border}` }}>{s.count}件</td>
                            <td className="py-2 px-3 text-right font-medium" style={{ color: T.accent, borderRight: `1px solid ${T.border}` }}>{fmt(s.sales)}</td>
                            <td className="py-2 px-3 text-right" style={{ color: T.textSub, borderRight: `1px solid ${T.border}` }}>{fmt(avg)}</td>
                            <td className="py-2 px-3 text-right" style={{ color: T.textSub }}>{pct}%</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    {storeData.length > 0 && (
                      <tfoot>
                        <tr style={{ borderTop: `2px solid ${T.border}`, backgroundColor: T.cardAlt }}>
                          <td className="py-2.5 px-3 font-bold" style={{ borderRight: `1px solid ${T.border}` }} colSpan={2}>合計</td>
                          <td className="py-2.5 px-3 text-right font-bold" style={{ borderRight: `1px solid ${T.border}` }}>{storeData.reduce((s, x) => s + x.count, 0)}件</td>
                          <td className="py-2.5 px-3 text-right font-bold" style={{ color: T.accent, borderRight: `1px solid ${T.border}` }}>{fmt(storeData.reduce((s, x) => s + x.sales, 0))}</td>
                          <td className="py-2.5 px-3 text-right font-bold" style={{ color: T.textSub, borderRight: `1px solid ${T.border}` }}>{(() => { const tc = storeData.reduce((s, x) => s + x.count, 0); const ts = storeData.reduce((s, x) => s + x.sales, 0); return tc > 0 ? fmt(Math.round(ts / tc)) : "—"; })()}</td>
                          <td className="py-2.5 px-3 text-right font-bold" style={{ color: T.textSub }}>100.0%</td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>
              <p className="text-[10px] mt-2" style={{ color: T.textFaint }}>※ 部屋割り登録 × 終了オーダーの予約に基づく</p>
            </div>
          )}

          {/* 顧客分析 */}
          {tab === "customer" && (
            <div className="animate-[fadeIn_0.3s]">
              <div className="flex items-center justify-center gap-4 mb-4">
                <button onClick={prevMonth} className="p-1 cursor-pointer" style={{ color: T.textSub }}>◀</button>
                <span className="text-[14px] font-medium">{smYear}年{smMonth}月 顧客分析</span>
                <button onClick={nextMonth} className="p-1 cursor-pointer" style={{ color: T.textSub }}>▶</button>
              </div>

              {/* KPI テーブル */}
              <div className="rounded-2xl border overflow-hidden mb-4" style={{ backgroundColor: T.card, borderColor: T.border }}>
                <div className="overflow-x-auto">
                  <table className="w-full text-[12px]" style={{ fontVariantNumeric: "tabular-nums", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ backgroundColor: T.cardAlt, borderBottom: `2px solid ${T.border}` }}>
                        {["指標", "値"].map((h, i) => (
                          <th key={h} className={`py-2.5 px-3 font-medium text-[11px] ${i === 0 ? "text-left" : "text-right"}`} style={{ color: T.textMuted, borderRight: i === 0 ? `1px solid ${T.border}` : undefined, width: i === 0 ? "40%" : "auto" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { label: "総顧客数", value: `${customerStats.totalCustomers}名`, color: "#c3a782" },
                        { label: "リピーター数", value: `${customerStats.repeaters}名`, color: "#7ab88f" },
                        { label: "リピート率", value: `${customerStats.repeatRate}%`, color: "#7ab88f" },
                        { label: "指名件数", value: `${customerStats.nominationCount}件`, color: "#85a8c4" },
                        { label: "指名率", value: `${customerStats.nominationRate}%`, color: "#85a8c4" },
                        { label: "総予約数", value: `${customerStats.totalReservations}件`, color: "#c49885" },
                        { label: "顧客あたり平均予約数", value: customerStats.totalCustomers > 0 ? `${(customerStats.totalReservations / customerStats.totalCustomers).toFixed(1)}件` : "—", color: T.textSub },
                      ].map((row) => (
                        <tr key={row.label} style={{ borderBottom: `1px solid ${T.border}` }}>
                          <td className="py-2 px-3 font-medium" style={{ borderRight: `1px solid ${T.border}` }}>{row.label}</td>
                          <td className="py-2 px-3 text-right font-medium" style={{ color: row.color }}>{row.value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 売上TOP10 */}
              <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: T.card, borderColor: T.border }}>
                <div className="px-4 py-2.5" style={{ borderBottom: `1px solid ${T.border}`, backgroundColor: T.cardAlt }}>
                  <p className="text-[12px] font-medium">売上TOP10 顧客</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-[12px]" style={{ fontVariantNumeric: "tabular-nums", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ backgroundColor: T.cardAlt, borderBottom: `2px solid ${T.border}` }}>
                        {[
                          { label: "順位", align: "center", w: "56px" },
                          { label: "顧客名", align: "left", w: "" },
                          { label: "来店回数", align: "right", w: "" },
                          { label: "売上合計", align: "right", w: "" },
                          { label: "平均単価", align: "right", w: "" },
                          { label: "構成比", align: "right", w: "" },
                        ].map((h) => (
                          <th key={h.label} className={`py-2.5 px-3 font-medium text-[11px] text-${h.align}`} style={{ color: T.textMuted, width: h.w || "auto", borderRight: `1px solid ${T.border}` }}>{h.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {customerStats.topCustomers.length === 0 && (
                        <tr><td colSpan={6} className="py-8 text-center text-[12px]" style={{ color: T.textFaint }}>データがありません</td></tr>
                      )}
                      {customerStats.topCustomers.map((c, i) => {
                        const avg = c.count > 0 ? Math.round(c.sales / c.count) : 0;
                        const pct = monthTotal.sales > 0 ? ((c.sales / monthTotal.sales) * 100).toFixed(1) : "0.0";
                        const rankColor = i === 0 ? "#fbbf24" : i === 1 ? "#9ca3af" : i === 2 ? "#c49885" : T.textFaint;
                        return (
                          <tr key={c.name} style={{ borderBottom: `1px solid ${T.border}` }}>
                            <td className="py-2 px-3 text-center font-bold" style={{ color: rankColor, borderRight: `1px solid ${T.border}` }}>{i + 1}</td>
                            <td className="py-2 px-3 font-medium" style={{ borderRight: `1px solid ${T.border}` }}>{c.name}</td>
                            <td className="py-2 px-3 text-right" style={{ borderRight: `1px solid ${T.border}` }}>{c.count}回</td>
                            <td className="py-2 px-3 text-right font-medium" style={{ color: T.accent, borderRight: `1px solid ${T.border}` }}>{fmt(c.sales)}</td>
                            <td className="py-2 px-3 text-right" style={{ color: T.textSub, borderRight: `1px solid ${T.border}` }}>{fmt(avg)}</td>
                            <td className="py-2 px-3 text-right" style={{ color: T.textSub }}>{pct}%</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
              <p className="text-[10px] mt-2" style={{ color: T.textFaint }}>※ オーダーが「終了」になっている予約のみ集計</p>
            </div>
          )}
        </div>
      </div>

      <style jsx global>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  );
}
