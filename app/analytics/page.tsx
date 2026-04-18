"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";
import { useTheme } from "../../lib/theme";
import { NavMenu } from "../../lib/nav-menu";
import { useBackNav } from "../../lib/use-back-nav";

type Reservation = { id: number; customer_name: string; therapist_id: number; date: string; start_time: string; end_time: string; course: string; notes: string; status?: string; total_price?: number; card_billing?: number; paypay_amount?: number; cash_amount?: number; nomination?: string; discount_amount?: number };
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
  // 当月中に safe_collected_date が該当する settlements（投函日は当月外の可能性あり）
  const [safeCollectedInMonth, setSafeCollectedInMonth] = useState<Settlement[]>([]);
  // 年間集計用
  const [yearSettlements, setYearSettlements] = useState<Settlement[]>([]);
  const [yearExpenses, setYearExpenses] = useState<ExpenseRow[]>([]);
  const [yearReplenishments, setYearReplenishments] = useState<Replenishment[]>([]);

  const [tab, setTab] = useState<Tab>("daily");
  const [selectedMonth, setSelectedMonth] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; });
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
  const [showStoreFormula, setShowStoreFormula] = useState(false);

  // マウス戻るボタン対応: タブ → 前のページ
  useBackNav(tab, setTab);

  const [smYear, smMonth] = selectedMonth.split("-").map(Number);
  const daysInMonth = new Date(smYear, smMonth, 0).getDate();

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
  }, [selectedMonth, daysInMonth, selectedYear]);

  useEffect(() => { const check = async () => { const { data: { user } } = await supabase.auth.getUser(); if (!user) router.push("/"); }; check(); fetchData(); }, [router, fetchData]);

  const getCourse = (name: string) => courses.find((c) => c.name === name);
  const getTherapistName = (id: number) => therapists.find((t) => t.id === id)?.name || "不明";
  const fmt = (n: number) => "¥" + (n || 0).toLocaleString();

  // 売上は実際に計上された total_price を優先（dashboard/営業締めと同じ根拠）。null の古い予約は course.price にフォールバック
  const getPrice = (r: Reservation) => (r.total_price ?? 0) || (getCourse(r.course)?.price || 0);
  const getBack = (r: Reservation) => getCourse(r.course)?.therapist_back || 0;

  // ===== 日別データ（営業締めと同じロジックで日ごとに再現） =====
  const dailyData = useMemo(() => {
    type Row = {
      date: string; label: string; dow: string; count: number;
      sales: number; discount: number; back: number; card: number; paypay: number; cash: number;
      invoice: number; withholding: number;
      expense: number; income: number; replenish: number;
      uncollectedSales: number; safeUncollected: number; cashOnHand: number;
      avgNet: number; storeShare: number;
    };
    const data: Row[] = [];
    const dayNames = ["日", "月", "火", "水", "木", "金", "土"];
    for (let i = 1; i <= daysInMonth; i++) {
      const date = `${selectedMonth}-${String(i).padStart(2, "0")}`;
      const d = new Date(date + "T00:00:00");

      const dayRes = reservations.filter((r) => r.date === date);
      const daySettles = monthSettlements.filter((s) => s.date === date);
      const dayExp = monthExpenses.filter((e) => e.date === date);
      const dayReps = monthReplenishments.filter((r) => r.date === date);
      const collectedToday = safeCollectedInMonth.filter((s) => s.safe_collected_date === date);

      const count = dayRes.length;
      const sales = dayRes.reduce((s, r) => s + getPrice(r), 0);
      const discount = dayRes.reduce((s, r) => s + (r.discount_amount || 0), 0);
      const card = dayRes.reduce((s, r) => s + (r.card_billing || 0), 0);
      const paypay = dayRes.reduce((s, r) => s + (r.paypay_amount || 0), 0);
      const cash = dayRes.reduce((s, r) => s + (r.cash_amount || 0), 0);

      const back = daySettles.reduce((s, ds) => s + (ds.total_back || 0), 0);
      const invoice = daySettles.reduce((s, ds) => s + (ds.invoice_deduction || 0), 0);
      const withholding = daySettles.reduce((s, ds) => s + (ds.withholding_tax || 0), 0);

      const expense = dayExp.filter((e) => e.type === "expense").reduce((s, e) => s + (e.amount || 0), 0);
      const income = dayExp.filter((e) => e.type === "income").reduce((s, e) => s + (e.amount || 0), 0);
      const replenish = dayReps.reduce((s, r) => s + (r.amount || 0), 0);

      // セラピスト単位で現金状態を計算（予約ベース + settlementsマッチ、営業締めと同じ）
      let staffCollectedAmt = 0;
      let uncollectedSales = 0;
      let safeUncollected = 0;
      const processedTids = new Set<number>();

      // 1) 予約のあるセラピストを走査（settlementsが無ければ未精算 = 売上未回収）
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
          // !sales_collected（ds自体が無い場合も含む）
          uncollectedSales += netAfterPay + roomRep;
        }
        processedTids.add(tid);
      }

      // 2) 予約は無いが settlements のみあるケース（予約外精算等、念のため）
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

      // その日に金庫から回収した額（投函日の釣銭も加算）
      let safeCollectedTodayTotal = 0;
      for (const sc of collectedToday) {
        const net3 = Math.max((sc.total_cash || 0) - (sc.final_payment || 0), 0);
        const repAmt = sc.room_id ? monthReplenishments.filter((r) => r.date === sc.date && r.room_id === sc.room_id).reduce((s, r) => s + (r.amount || 0), 0) : 0;
        safeCollectedTodayTotal += net3 + repAmt;
      }

      // 事務所残金 = -釣銭補充 - 経費 + 収入 + スタッフ回収 + 本日の金庫回収分
      const cashOnHand = -replenish - expense + income + staffCollectedAmt + safeCollectedTodayTotal;

      // 平均単価 = (売上 - セラピストバック) / 予約数
      const avgNet = count > 0 ? Math.round((sales - back) / count) : 0;
      // 店取概算 = 売上 − 割引 − インボイス − 源泉 − セラピスト
      const storeShare = sales - discount - invoice - withholding - back;

      data.push({
        date, label: `${i}`, dow: dayNames[d.getDay()], count,
        sales, discount, back, card, paypay, cash,
        invoice, withholding,
        expense, income, replenish,
        uncollectedSales, safeUncollected, cashOnHand,
        avgNet, storeShare,
      });
    }
    return data;
  }, [reservations, monthSettlements, monthExpenses, monthReplenishments, safeCollectedInMonth, selectedMonth, daysInMonth, courses]);

  // ===== 月別データ（日別データと同じ思想で月ごとに集計） =====
  const monthlyData = useMemo(() => {
    type MRow = {
      month: string; label: string; count: number;
      sales: number; discount: number; back: number; card: number; paypay: number; cash: number;
      invoice: number; withholding: number;
      expense: number; income: number;
      profit: number; avgNet: number;
    };
    const data: MRow[] = [];
    for (let m = 1; m <= 12; m++) {
      const prefix = `${selectedYear}-${String(m).padStart(2, "0")}`;
      const mRes = allReservations.filter((r) => r.date.startsWith(prefix));
      const mSettles = yearSettlements.filter((s) => s.date.startsWith(prefix));
      const mExp = yearExpenses.filter((e) => e.date.startsWith(prefix));
      const count = mRes.length;
      const sales = mRes.reduce((s, r) => s + getPrice(r), 0);
      const discount = mRes.reduce((s, r) => s + (r.discount_amount || 0), 0);
      const card = mRes.reduce((s, r) => s + (r.card_billing || 0), 0);
      const paypay = mRes.reduce((s, r) => s + (r.paypay_amount || 0), 0);
      const cash = mRes.reduce((s, r) => s + (r.cash_amount || 0), 0);
      const back = mSettles.reduce((s, ds) => s + (ds.total_back || 0), 0);
      const invoice = mSettles.reduce((s, ds) => s + (ds.invoice_deduction || 0), 0);
      const withholding = mSettles.reduce((s, ds) => s + (ds.withholding_tax || 0), 0);
      const expense = mExp.filter((e) => e.type === "expense").reduce((s, e) => s + (e.amount || 0), 0);
      const income = mExp.filter((e) => e.type === "income").reduce((s, e) => s + (e.amount || 0), 0);
      // 月次利益（粗い集計）: 売上 - バック - 経費 + 収入
      const profit = sales - back - expense + income;
      const avgNet = count > 0 ? Math.round((sales - back) / count) : 0;
      data.push({ month: prefix, label: `${m}月`, count, sales, discount, back, card, paypay, cash, invoice, withholding, expense, income, profit, avgNet });
    }
    return data;
  }, [allReservations, yearSettlements, yearExpenses, selectedYear, courses]);

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

  // 月間合計（バックは settlements ベース、営業締めと同根拠）
  const monthTotal = useMemo(() => {
    const sales = reservations.reduce((s, r) => s + getPrice(r), 0);
    const back = monthSettlements.reduce((s, ds) => s + (ds.total_back || 0), 0);
    return { sales, back, profit: sales - back, count: reservations.length };
  }, [reservations, monthSettlements, courses]);

  // 年間合計（バックは settlements ベース）
  const yearTotal = useMemo(() => {
    const sales = allReservations.reduce((s, r) => s + getPrice(r), 0);
    const back = yearSettlements.reduce((s, ds) => s + (ds.total_back || 0), 0);
    return { sales, back, profit: sales - back, count: allReservations.length };
  }, [allReservations, yearSettlements, courses]);

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

      {/* Summary Cards */}
      <div className="px-4 py-3 flex gap-3 flex-shrink-0 overflow-x-auto" style={{ backgroundColor: T.cardAlt }}>
        {[
          { label: "月間売上", value: fmt(monthTotal.sales), color: "#c3a782" },
          { label: "月間バック", value: fmt(monthTotal.back), color: "#7ab88f" },
          { label: "月間利益", value: fmt(monthTotal.profit), color: "#85a8c4" },
          { label: "月間予約数", value: `${monthTotal.count}件`, color: "#c49885" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl px-4 py-3 border min-w-[140px]" style={{ backgroundColor: T.card, borderColor: T.border }}>
            <p className="text-[9px] mb-1" style={{ color: T.textMuted }}>{s.label}</p>
            <p className="text-[18px] font-light" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className={tab === "daily" ? "mx-auto" : "max-w-[1100px] mx-auto"}>

          {/* 日別 */}
          {tab === "daily" && (
            <div className="animate-[fadeIn_0.3s]">
              <div className="flex items-center justify-center gap-4 mb-4">
                <button onClick={prevMonth} className="p-1 cursor-pointer" style={{ color: T.textSub }}>◀</button>
                <span className="text-[14px] font-medium">{smYear}年{smMonth}月 日別</span>
                <button onClick={nextMonth} className="p-1 cursor-pointer" style={{ color: T.textSub }}>▶</button>
              </div>
              {showStoreFormula && (
                <div className="mb-3 rounded-xl border p-3 flex items-center justify-between" style={{ backgroundColor: "rgba(133,168,196,0.08)", borderColor: "#85a8c4" }}>
                  <div className="text-[12px]" style={{ color: T.text }}>
                    <span className="font-medium" style={{ color: "#85a8c4" }}>💡 店取概算の計算式</span>
                    <span className="mx-2" style={{ color: T.textMuted }}>=</span>
                    <span style={{ color: T.accent }}>売上</span>
                    <span className="mx-1" style={{ color: T.textMuted }}>−</span>
                    <span style={{ color: "#f59e0b" }}>割引</span>
                    <span className="mx-1" style={{ color: T.textMuted }}>−</span>
                    <span style={{ color: "#a855f7" }}>インボイス</span>
                    <span className="mx-1" style={{ color: T.textMuted }}>−</span>
                    <span style={{ color: "#d4687e" }}>源泉</span>
                    <span className="mx-1" style={{ color: T.textMuted }}>−</span>
                    <span style={{ color: "#7ab88f" }}>セラピスト</span>
                  </div>
                  <button onClick={() => setShowStoreFormula(false)} className="text-[12px] cursor-pointer" style={{ color: T.textSub }}>✕</button>
                </div>
              )}
              <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: T.card, borderColor: T.border }}>
                <div className="overflow-x-auto">
                  <table className="text-[11px]" style={{ fontVariantNumeric: "tabular-nums", borderCollapse: "collapse", minWidth: "100%" }}>
                    <thead>
                      <tr style={{ backgroundColor: T.cardAlt, borderBottom: `2px solid ${T.border}` }}>
                        {[
                          { label: "日付", align: "left", w: "54px", clickable: false },
                          { label: "曜", align: "center", w: "28px", clickable: false },
                          { label: "予約", align: "right", w: "48px", clickable: false },
                          { label: "平均単価", align: "right", w: "", clickable: false },
                          { label: "売上", align: "right", w: "", clickable: false },
                          { label: "店取概算", align: "right", w: "", clickable: true },
                          { label: "セラピスト", align: "right", w: "", clickable: false },
                          { label: "割引", align: "right", w: "", clickable: false },
                          { label: "カード", align: "right", w: "", clickable: false },
                          { label: "ペイペイ", align: "right", w: "", clickable: false },
                          { label: "インボイス", align: "right", w: "", clickable: false },
                          { label: "源泉", align: "right", w: "", clickable: false },
                          { label: "経費", align: "right", w: "", clickable: false },
                          { label: "入金", align: "right", w: "", clickable: false },
                          { label: "売上未回収", align: "right", w: "", clickable: false },
                          { label: "金庫未回収", align: "right", w: "", clickable: false },
                          { label: "事務所残金", align: "right", w: "", clickable: false },
                        ].map((h) => (
                          <th
                            key={h.label}
                            onClick={h.clickable ? () => setShowStoreFormula(v => !v) : undefined}
                            className={`py-2 px-1.5 font-medium text-[10px] text-${h.align} whitespace-nowrap ${h.clickable ? "cursor-pointer select-none" : ""}`}
                            style={{ color: h.clickable && showStoreFormula ? "#85a8c4" : T.textMuted, width: h.w || "auto", borderRight: `1px solid ${T.border}` }}
                          >
                            {h.label}{h.clickable ? " ⓘ" : ""}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {dailyData.map((d) => {
                        const zero = d.count === 0 && d.expense === 0 && d.income === 0 && d.replenish === 0 && d.uncollectedSales === 0 && d.safeUncollected === 0 && d.cashOnHand === 0;
                        const dowColor = d.dow === "日" ? "#c45555" : d.dow === "土" ? "#3d6b9f" : T.textSub;
                        const dash = (v: number, formatted: string) => (zero && v === 0) ? "—" : formatted;
                        return (
                          <tr key={d.date} style={{ borderBottom: `1px solid ${T.border}`, opacity: zero ? 0.45 : 1, backgroundColor: d.dow === "日" ? "rgba(196,85,85,0.03)" : d.dow === "土" ? "rgba(61,107,159,0.03)" : "transparent" }}>
                            <td className="py-1.5 px-1.5 whitespace-nowrap" style={{ borderRight: `1px solid ${T.border}` }}>{`${smMonth}/${d.label}`}</td>
                            <td className="py-1.5 px-1.5 text-center font-medium" style={{ color: dowColor, borderRight: `1px solid ${T.border}` }}>{d.dow}</td>
                            <td className="py-1.5 px-1.5 text-right" style={{ borderRight: `1px solid ${T.border}` }}>{d.count === 0 ? "—" : d.count}</td>
                            <td className="py-1.5 px-1.5 text-right whitespace-nowrap" style={{ color: d.avgNet === 0 ? T.textFaint : T.textSub, borderRight: `1px solid ${T.border}` }}>{d.avgNet === 0 ? "—" : fmt(d.avgNet)}</td>
                            <td className="py-1.5 px-1.5 text-right font-medium whitespace-nowrap" style={{ color: d.sales === 0 ? T.textFaint : T.accent, borderRight: `1px solid ${T.border}` }}>{dash(d.sales, fmt(d.sales))}</td>
                            <td className="py-1.5 px-1.5 text-right font-medium whitespace-nowrap" style={{ color: d.storeShare === 0 ? T.textFaint : d.storeShare >= 0 ? "#85a8c4" : "#c45555", borderRight: `1px solid ${T.border}` }}>{dash(d.storeShare, fmt(d.storeShare))}</td>
                            <td className="py-1.5 px-1.5 text-right whitespace-nowrap" style={{ color: d.back === 0 ? T.textFaint : "#7ab88f", borderRight: `1px solid ${T.border}` }}>{dash(d.back, fmt(d.back))}</td>
                            <td className="py-1.5 px-1.5 text-right whitespace-nowrap" style={{ color: d.discount === 0 ? T.textFaint : "#f59e0b", borderRight: `1px solid ${T.border}` }}>{dash(d.discount, d.discount === 0 ? fmt(0) : `−${fmt(d.discount)}`)}</td>
                            <td className="py-1.5 px-1.5 text-right whitespace-nowrap" style={{ color: d.card === 0 ? T.textFaint : T.textSub, borderRight: `1px solid ${T.border}` }}>{dash(d.card, fmt(d.card))}</td>
                            <td className="py-1.5 px-1.5 text-right whitespace-nowrap" style={{ color: d.paypay === 0 ? T.textFaint : T.textSub, borderRight: `1px solid ${T.border}` }}>{dash(d.paypay, fmt(d.paypay))}</td>
                            <td className="py-1.5 px-1.5 text-right whitespace-nowrap" style={{ color: d.invoice === 0 ? T.textFaint : "#a855f7", borderRight: `1px solid ${T.border}` }}>{dash(d.invoice, fmt(d.invoice))}</td>
                            <td className="py-1.5 px-1.5 text-right whitespace-nowrap" style={{ color: d.withholding === 0 ? T.textFaint : "#d4687e", borderRight: `1px solid ${T.border}` }}>{dash(d.withholding, fmt(d.withholding))}</td>
                            <td className="py-1.5 px-1.5 text-right whitespace-nowrap" style={{ color: d.expense === 0 ? T.textFaint : "#c45555", borderRight: `1px solid ${T.border}` }}>{dash(d.expense, fmt(d.expense))}</td>
                            <td className="py-1.5 px-1.5 text-right whitespace-nowrap" style={{ color: d.income === 0 ? T.textFaint : "#22c55e", borderRight: `1px solid ${T.border}` }}>{dash(d.income, d.income === 0 ? fmt(0) : `+${fmt(d.income)}`)}</td>
                            <td className="py-1.5 px-1.5 text-right whitespace-nowrap" style={{ color: d.uncollectedSales === 0 ? T.textFaint : "#c45555", borderRight: `1px solid ${T.border}` }}>{dash(d.uncollectedSales, d.uncollectedSales === 0 ? fmt(0) : `−${fmt(d.uncollectedSales)}`)}</td>
                            <td className="py-1.5 px-1.5 text-right whitespace-nowrap" style={{ color: d.safeUncollected === 0 ? T.textFaint : "#c45555", borderRight: `1px solid ${T.border}` }}>{dash(d.safeUncollected, d.safeUncollected === 0 ? fmt(0) : `−${fmt(d.safeUncollected)}`)}</td>
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
                          income: acc.income + d.income,
                          uncollectedSales: acc.uncollectedSales + d.uncollectedSales,
                          safeUncollected: acc.safeUncollected + d.safeUncollected,
                          cashOnHand: acc.cashOnHand + d.cashOnHand,
                          storeShare: acc.storeShare + d.storeShare,
                        }), { count: 0, sales: 0, discount: 0, card: 0, paypay: 0, cash: 0, back: 0, invoice: 0, withholding: 0, expense: 0, income: 0, uncollectedSales: 0, safeUncollected: 0, cashOnHand: 0, storeShare: 0 });
                        const avg = tot.count > 0 ? Math.round((tot.sales - tot.back) / tot.count) : 0;
                        return (
                          <tr style={{ borderTop: `2px solid ${T.border}`, backgroundColor: T.cardAlt }}>
                            <td className="py-2 px-1.5 font-bold" style={{ borderRight: `1px solid ${T.border}` }} colSpan={2}>合計</td>
                            <td className="py-2 px-1.5 text-right font-bold" style={{ borderRight: `1px solid ${T.border}` }}>{tot.count}</td>
                            <td className="py-2 px-1.5 text-right font-bold whitespace-nowrap" style={{ color: T.textSub, borderRight: `1px solid ${T.border}` }}>{avg > 0 ? fmt(avg) : "—"}</td>
                            <td className="py-2 px-1.5 text-right font-bold whitespace-nowrap" style={{ color: T.accent, borderRight: `1px solid ${T.border}` }}>{fmt(tot.sales)}</td>
                            <td className="py-2 px-1.5 text-right font-bold whitespace-nowrap" style={{ color: tot.storeShare >= 0 ? "#85a8c4" : "#c45555", borderRight: `1px solid ${T.border}` }}>{fmt(tot.storeShare)}</td>
                            <td className="py-2 px-1.5 text-right font-bold whitespace-nowrap" style={{ color: "#7ab88f", borderRight: `1px solid ${T.border}` }}>{fmt(tot.back)}</td>
                            <td className="py-2 px-1.5 text-right font-bold whitespace-nowrap" style={{ color: tot.discount === 0 ? T.textFaint : "#f59e0b", borderRight: `1px solid ${T.border}` }}>{tot.discount === 0 ? fmt(0) : `−${fmt(tot.discount)}`}</td>
                            <td className="py-2 px-1.5 text-right font-bold whitespace-nowrap" style={{ color: T.textSub, borderRight: `1px solid ${T.border}` }}>{fmt(tot.card)}</td>
                            <td className="py-2 px-1.5 text-right font-bold whitespace-nowrap" style={{ color: T.textSub, borderRight: `1px solid ${T.border}` }}>{fmt(tot.paypay)}</td>
                            <td className="py-2 px-1.5 text-right font-bold whitespace-nowrap" style={{ color: "#a855f7", borderRight: `1px solid ${T.border}` }}>{fmt(tot.invoice)}</td>
                            <td className="py-2 px-1.5 text-right font-bold whitespace-nowrap" style={{ color: "#d4687e", borderRight: `1px solid ${T.border}` }}>{fmt(tot.withholding)}</td>
                            <td className="py-2 px-1.5 text-right font-bold whitespace-nowrap" style={{ color: "#c45555", borderRight: `1px solid ${T.border}` }}>{fmt(tot.expense)}</td>
                            <td className="py-2 px-1.5 text-right font-bold whitespace-nowrap" style={{ color: tot.income === 0 ? T.textFaint : "#22c55e", borderRight: `1px solid ${T.border}` }}>{tot.income === 0 ? fmt(0) : `+${fmt(tot.income)}`}</td>
                            <td className="py-2 px-1.5 text-right font-bold whitespace-nowrap" style={{ color: "#c45555", borderRight: `1px solid ${T.border}` }}>{tot.uncollectedSales === 0 ? fmt(0) : `−${fmt(tot.uncollectedSales)}`}</td>
                            <td className="py-2 px-1.5 text-right font-bold whitespace-nowrap" style={{ color: "#c45555", borderRight: `1px solid ${T.border}` }}>{tot.safeUncollected === 0 ? fmt(0) : `−${fmt(tot.safeUncollected)}`}</td>
                            <td className="py-2 px-1.5 text-right font-bold whitespace-nowrap" style={{ color: tot.cashOnHand >= 0 ? "#22c55e" : "#c45555", backgroundColor: "rgba(245,158,11,0.06)" }}>{fmt(tot.cashOnHand)}</td>
                          </tr>
                        );
                      })()}
                    </tfoot>
                  </table>
                </div>
              </div>
              <div className="mt-2 space-y-1">
                <p className="text-[10px]" style={{ color: T.textFaint }}>※ オーダーが「終了」になっている予約のみ集計。事務所残金は営業締めと同じ計算式</p>
                <p className="text-[10px]" style={{ color: T.textFaint }}>※ 平均単価 =（売上 − セラピストバック）÷ 予約数 （インボイス・源泉は引かない／指名・オプション・延長は含む）</p>
                <p className="text-[10px]" style={{ color: T.textFaint }}>※ 売上未回収・金庫未回収は「まだ事務所に入っていない現金」なのでマイナス表記（赤）。精算確定すると事務所残金に移動します</p>
                <p className="text-[10px]" style={{ color: T.textFaint }}>※ 割引は定価から値引きした額をオレンジでマイナス表示（売上には既に適用済み）</p>
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
                        {["月", "予約数", "売上", "割引", "カード", "ペイペイ", "現金", "バック", "インボイス", "源泉", "経費", "利益", "平均単価", "前月比"].map((h, i) => (
                          <th key={h} className={`py-2.5 px-2.5 font-medium text-[10px] whitespace-nowrap ${i === 0 ? "text-left" : "text-right"}`} style={{ color: T.textMuted, borderRight: `1px solid ${T.border}` }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {monthlyData.map((d, idx) => {
                        const zero = d.count === 0 && d.expense === 0;
                        const prev = idx > 0 ? monthlyData[idx - 1].sales : 0;
                        const diff = d.sales - prev;
                        const diffPct = prev > 0 ? Math.round((diff / prev) * 100) : 0;
                        const diffColor = diff > 0 ? "#7ab88f" : diff < 0 ? "#c45555" : T.textFaint;
                        return (
                          <tr key={d.month} style={{ borderBottom: `1px solid ${T.border}`, opacity: zero ? 0.45 : 1 }}>
                            <td className="py-2 px-2.5 font-medium" style={{ borderRight: `1px solid ${T.border}` }}>{d.label}</td>
                            <td className="py-2 px-2.5 text-right" style={{ borderRight: `1px solid ${T.border}` }}>{d.count === 0 ? "—" : `${d.count}件`}</td>
                            <td className="py-2 px-2.5 text-right font-medium whitespace-nowrap" style={{ color: d.sales === 0 ? T.textFaint : T.accent, borderRight: `1px solid ${T.border}` }}>{d.sales === 0 ? "—" : fmt(d.sales)}</td>
                            <td className="py-2 px-2.5 text-right whitespace-nowrap" style={{ color: d.discount === 0 ? T.textFaint : "#f59e0b", borderRight: `1px solid ${T.border}` }}>{d.discount === 0 ? "—" : `−${fmt(d.discount)}`}</td>
                            <td className="py-2 px-2.5 text-right whitespace-nowrap" style={{ color: d.card === 0 ? T.textFaint : T.textSub, borderRight: `1px solid ${T.border}` }}>{d.card === 0 ? "—" : fmt(d.card)}</td>
                            <td className="py-2 px-2.5 text-right whitespace-nowrap" style={{ color: d.paypay === 0 ? T.textFaint : T.textSub, borderRight: `1px solid ${T.border}` }}>{d.paypay === 0 ? "—" : fmt(d.paypay)}</td>
                            <td className="py-2 px-2.5 text-right whitespace-nowrap" style={{ color: d.cash === 0 ? T.textFaint : T.textSub, borderRight: `1px solid ${T.border}` }}>{d.cash === 0 ? "—" : fmt(d.cash)}</td>
                            <td className="py-2 px-2.5 text-right whitespace-nowrap" style={{ color: d.back === 0 ? T.textFaint : "#7ab88f", borderRight: `1px solid ${T.border}` }}>{d.back === 0 ? "—" : fmt(d.back)}</td>
                            <td className="py-2 px-2.5 text-right whitespace-nowrap" style={{ color: d.invoice === 0 ? T.textFaint : "#a855f7", borderRight: `1px solid ${T.border}` }}>{d.invoice === 0 ? "—" : fmt(d.invoice)}</td>
                            <td className="py-2 px-2.5 text-right whitespace-nowrap" style={{ color: d.withholding === 0 ? T.textFaint : "#d4687e", borderRight: `1px solid ${T.border}` }}>{d.withholding === 0 ? "—" : fmt(d.withholding)}</td>
                            <td className="py-2 px-2.5 text-right whitespace-nowrap" style={{ color: d.expense === 0 ? T.textFaint : "#c45555", borderRight: `1px solid ${T.border}` }}>{d.expense === 0 ? "—" : fmt(d.expense)}</td>
                            <td className="py-2 px-2.5 text-right font-medium whitespace-nowrap" style={{ color: zero ? T.textFaint : d.profit >= 0 ? T.text : "#c45555", borderRight: `1px solid ${T.border}` }}>{zero && d.profit === 0 ? "—" : fmt(d.profit)}</td>
                            <td className="py-2 px-2.5 text-right whitespace-nowrap" style={{ color: d.avgNet === 0 ? T.textFaint : T.textSub, borderRight: `1px solid ${T.border}` }}>{d.avgNet === 0 ? "—" : fmt(d.avgNet)}</td>
                            <td className="py-2 px-2.5 text-right text-[10px] whitespace-nowrap" style={{ color: idx === 0 || prev === 0 ? T.textFaint : diffColor }}>
                              {idx === 0 || prev === 0 ? "—" : `${diff >= 0 ? "+" : ""}${diffPct}%`}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      {(() => {
                        const tot = monthlyData.reduce((a, d) => ({
                          count: a.count + d.count, sales: a.sales + d.sales, discount: a.discount + d.discount, card: a.card + d.card, paypay: a.paypay + d.paypay, cash: a.cash + d.cash,
                          back: a.back + d.back, invoice: a.invoice + d.invoice, withholding: a.withholding + d.withholding,
                          expense: a.expense + d.expense, income: a.income + d.income,
                        }), { count: 0, sales: 0, discount: 0, card: 0, paypay: 0, cash: 0, back: 0, invoice: 0, withholding: 0, expense: 0, income: 0 });
                        const profit = tot.sales - tot.back - tot.expense + tot.income;
                        const avg = tot.count > 0 ? Math.round((tot.sales - tot.back) / tot.count) : 0;
                        return (
                          <tr style={{ borderTop: `2px solid ${T.border}`, backgroundColor: T.cardAlt }}>
                            <td className="py-2.5 px-2.5 font-bold" style={{ borderRight: `1px solid ${T.border}` }}>年間合計</td>
                            <td className="py-2.5 px-2.5 text-right font-bold" style={{ borderRight: `1px solid ${T.border}` }}>{tot.count}件</td>
                            <td className="py-2.5 px-2.5 text-right font-bold whitespace-nowrap" style={{ color: T.accent, borderRight: `1px solid ${T.border}` }}>{fmt(tot.sales)}</td>
                            <td className="py-2.5 px-2.5 text-right font-bold whitespace-nowrap" style={{ color: tot.discount === 0 ? T.textFaint : "#f59e0b", borderRight: `1px solid ${T.border}` }}>{tot.discount === 0 ? fmt(0) : `−${fmt(tot.discount)}`}</td>
                            <td className="py-2.5 px-2.5 text-right font-bold whitespace-nowrap" style={{ color: T.textSub, borderRight: `1px solid ${T.border}` }}>{fmt(tot.card)}</td>
                            <td className="py-2.5 px-2.5 text-right font-bold whitespace-nowrap" style={{ color: T.textSub, borderRight: `1px solid ${T.border}` }}>{fmt(tot.paypay)}</td>
                            <td className="py-2.5 px-2.5 text-right font-bold whitespace-nowrap" style={{ color: T.textSub, borderRight: `1px solid ${T.border}` }}>{fmt(tot.cash)}</td>
                            <td className="py-2.5 px-2.5 text-right font-bold whitespace-nowrap" style={{ color: "#7ab88f", borderRight: `1px solid ${T.border}` }}>{fmt(tot.back)}</td>
                            <td className="py-2.5 px-2.5 text-right font-bold whitespace-nowrap" style={{ color: "#a855f7", borderRight: `1px solid ${T.border}` }}>{fmt(tot.invoice)}</td>
                            <td className="py-2.5 px-2.5 text-right font-bold whitespace-nowrap" style={{ color: "#d4687e", borderRight: `1px solid ${T.border}` }}>{fmt(tot.withholding)}</td>
                            <td className="py-2.5 px-2.5 text-right font-bold whitespace-nowrap" style={{ color: "#c45555", borderRight: `1px solid ${T.border}` }}>{fmt(tot.expense)}</td>
                            <td className="py-2.5 px-2.5 text-right font-bold whitespace-nowrap" style={{ color: profit >= 0 ? T.text : "#c45555", borderRight: `1px solid ${T.border}` }}>{fmt(profit)}</td>
                            <td className="py-2.5 px-2.5 text-right font-bold whitespace-nowrap" style={{ color: T.textSub, borderRight: `1px solid ${T.border}` }}>{avg > 0 ? fmt(avg) : "—"}</td>
                            <td className="py-2.5 px-2.5 text-right" style={{ color: T.textFaint }}>—</td>
                          </tr>
                        );
                      })()}
                    </tfoot>
                  </table>
                </div>
              </div>
              <div className="mt-2 space-y-1">
                <p className="text-[10px]" style={{ color: T.textFaint }}>※ オーダーが「終了」になっている予約のみ集計。利益 = 売上 − バック − 経費 + 収入</p>
                <p className="text-[10px]" style={{ color: T.textFaint }}>※ 平均単価 =（売上 − セラピストバック）÷ 予約数</p>
              </div>
            </div>
          )}

          {/* 年別 */}
          {tab === "yearly" && (
            <div className="animate-[fadeIn_0.3s]">
              <div className="flex items-center justify-center gap-4 mb-4">
                <button onClick={() => setSelectedYear(selectedYear - 1)} className="p-1 cursor-pointer" style={{ color: T.textSub }}>◀</button>
                <span className="text-[14px] font-medium">{selectedYear}年 年間推移</span>
                <button onClick={() => setSelectedYear(selectedYear + 1)} className="p-1 cursor-pointer" style={{ color: T.textSub }}>▶</button>
              </div>
              <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: T.card, borderColor: T.border }}>
                <div className="overflow-x-auto">
                  <table className="text-[11px]" style={{ fontVariantNumeric: "tabular-nums", borderCollapse: "collapse", minWidth: "100%" }}>
                    <thead>
                      <tr style={{ backgroundColor: T.cardAlt, borderBottom: `2px solid ${T.border}` }}>
                        {["四半期", "月", "予約数", "売上", "割引", "カード", "ペイペイ", "現金", "バック", "インボイス", "源泉", "経費", "利益", "平均単価", "構成比"].map((h, i) => (
                          <th key={h} className={`py-2.5 px-2.5 font-medium text-[10px] whitespace-nowrap ${i <= 1 ? "text-left" : "text-right"}`} style={{ color: T.textMuted, borderRight: `1px solid ${T.border}` }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[0, 1, 2, 3].map((q) => {
                        const qMonths = monthlyData.slice(q * 3, q * 3 + 3);
                        const qSales = qMonths.reduce((s, m) => s + m.sales, 0);
                        const qDiscount = qMonths.reduce((s, m) => s + m.discount, 0);
                        const qCard = qMonths.reduce((s, m) => s + m.card, 0);
                        const qPaypay = qMonths.reduce((s, m) => s + m.paypay, 0);
                        const qCash = qMonths.reduce((s, m) => s + m.cash, 0);
                        const qBack = qMonths.reduce((s, m) => s + m.back, 0);
                        const qInvoice = qMonths.reduce((s, m) => s + m.invoice, 0);
                        const qWithholding = qMonths.reduce((s, m) => s + m.withholding, 0);
                        const qExpense = qMonths.reduce((s, m) => s + m.expense, 0);
                        const qIncome = qMonths.reduce((s, m) => s + m.income, 0);
                        const qProfit = qSales - qBack - qExpense + qIncome;
                        const qCount = qMonths.reduce((s, m) => s + m.count, 0);
                        const qColors = ["#c3a782", "#7ab88f", "#85a8c4", "#c49885"];
                        const qColor = qColors[q];
                        return (
                          <React.Fragment key={q}>
                            {qMonths.map((d, mi) => {
                              const zero = d.count === 0 && d.expense === 0;
                              const pct = yearTotal.sales > 0 ? ((d.sales / yearTotal.sales) * 100).toFixed(1) : "0.0";
                              return (
                                <tr key={d.month} style={{ borderBottom: `1px solid ${T.border}`, opacity: zero ? 0.45 : 1 }}>
                                  {mi === 0 && (
                                    <td rowSpan={3} className="py-2 px-2.5 font-medium text-center" style={{ borderRight: `1px solid ${T.border}`, color: qColor, backgroundColor: qColor + "10", verticalAlign: "middle" }}>Q{q + 1}</td>
                                  )}
                                  <td className="py-2 px-2.5 font-medium" style={{ borderRight: `1px solid ${T.border}` }}>{d.label}</td>
                                  <td className="py-2 px-2.5 text-right" style={{ borderRight: `1px solid ${T.border}` }}>{d.count === 0 ? "—" : `${d.count}件`}</td>
                                  <td className="py-2 px-2.5 text-right font-medium whitespace-nowrap" style={{ color: d.sales === 0 ? T.textFaint : T.accent, borderRight: `1px solid ${T.border}` }}>{d.sales === 0 ? "—" : fmt(d.sales)}</td>
                                  <td className="py-2 px-2.5 text-right whitespace-nowrap" style={{ color: d.discount === 0 ? T.textFaint : "#f59e0b", borderRight: `1px solid ${T.border}` }}>{d.discount === 0 ? "—" : `−${fmt(d.discount)}`}</td>
                                  <td className="py-2 px-2.5 text-right whitespace-nowrap" style={{ color: d.card === 0 ? T.textFaint : T.textSub, borderRight: `1px solid ${T.border}` }}>{d.card === 0 ? "—" : fmt(d.card)}</td>
                                  <td className="py-2 px-2.5 text-right whitespace-nowrap" style={{ color: d.paypay === 0 ? T.textFaint : T.textSub, borderRight: `1px solid ${T.border}` }}>{d.paypay === 0 ? "—" : fmt(d.paypay)}</td>
                                  <td className="py-2 px-2.5 text-right whitespace-nowrap" style={{ color: d.cash === 0 ? T.textFaint : T.textSub, borderRight: `1px solid ${T.border}` }}>{d.cash === 0 ? "—" : fmt(d.cash)}</td>
                                  <td className="py-2 px-2.5 text-right whitespace-nowrap" style={{ color: d.back === 0 ? T.textFaint : "#7ab88f", borderRight: `1px solid ${T.border}` }}>{d.back === 0 ? "—" : fmt(d.back)}</td>
                                  <td className="py-2 px-2.5 text-right whitespace-nowrap" style={{ color: d.invoice === 0 ? T.textFaint : "#a855f7", borderRight: `1px solid ${T.border}` }}>{d.invoice === 0 ? "—" : fmt(d.invoice)}</td>
                                  <td className="py-2 px-2.5 text-right whitespace-nowrap" style={{ color: d.withholding === 0 ? T.textFaint : "#d4687e", borderRight: `1px solid ${T.border}` }}>{d.withholding === 0 ? "—" : fmt(d.withholding)}</td>
                                  <td className="py-2 px-2.5 text-right whitespace-nowrap" style={{ color: d.expense === 0 ? T.textFaint : "#c45555", borderRight: `1px solid ${T.border}` }}>{d.expense === 0 ? "—" : fmt(d.expense)}</td>
                                  <td className="py-2 px-2.5 text-right font-medium whitespace-nowrap" style={{ color: zero && d.profit === 0 ? T.textFaint : d.profit >= 0 ? T.text : "#c45555", borderRight: `1px solid ${T.border}` }}>{zero && d.profit === 0 ? "—" : fmt(d.profit)}</td>
                                  <td className="py-2 px-2.5 text-right whitespace-nowrap" style={{ color: d.avgNet === 0 ? T.textFaint : T.textSub, borderRight: `1px solid ${T.border}` }}>{d.avgNet === 0 ? "—" : fmt(d.avgNet)}</td>
                                  <td className="py-2 px-2.5 text-right whitespace-nowrap" style={{ color: d.sales === 0 ? T.textFaint : T.textSub }}>{d.sales === 0 ? "—" : `${pct}%`}</td>
                                </tr>
                              );
                            })}
                            <tr style={{ borderBottom: `1px solid ${T.border}`, backgroundColor: qColor + "08" }}>
                              <td className="py-2 px-2.5 text-[10px] font-medium" style={{ color: qColor, borderRight: `1px solid ${T.border}` }} colSpan={2}>Q{q + 1}小計</td>
                              <td className="py-2 px-2.5 text-right text-[10px] font-medium" style={{ borderRight: `1px solid ${T.border}` }}>{qCount}件</td>
                              <td className="py-2 px-2.5 text-right text-[10px] font-medium whitespace-nowrap" style={{ color: qColor, borderRight: `1px solid ${T.border}` }}>{fmt(qSales)}</td>
                              <td className="py-2 px-2.5 text-right text-[10px] whitespace-nowrap" style={{ color: qDiscount === 0 ? T.textFaint : "#f59e0b", borderRight: `1px solid ${T.border}` }}>{qDiscount === 0 ? fmt(0) : `−${fmt(qDiscount)}`}</td>
                              <td className="py-2 px-2.5 text-right text-[10px] whitespace-nowrap" style={{ color: T.textSub, borderRight: `1px solid ${T.border}` }}>{fmt(qCard)}</td>
                              <td className="py-2 px-2.5 text-right text-[10px] whitespace-nowrap" style={{ color: T.textSub, borderRight: `1px solid ${T.border}` }}>{fmt(qPaypay)}</td>
                              <td className="py-2 px-2.5 text-right text-[10px] whitespace-nowrap" style={{ color: T.textSub, borderRight: `1px solid ${T.border}` }}>{fmt(qCash)}</td>
                              <td className="py-2 px-2.5 text-right text-[10px] font-medium whitespace-nowrap" style={{ color: "#7ab88f", borderRight: `1px solid ${T.border}` }}>{fmt(qBack)}</td>
                              <td className="py-2 px-2.5 text-right text-[10px] whitespace-nowrap" style={{ color: "#a855f7", borderRight: `1px solid ${T.border}` }}>{fmt(qInvoice)}</td>
                              <td className="py-2 px-2.5 text-right text-[10px] whitespace-nowrap" style={{ color: "#d4687e", borderRight: `1px solid ${T.border}` }}>{fmt(qWithholding)}</td>
                              <td className="py-2 px-2.5 text-right text-[10px] whitespace-nowrap" style={{ color: "#c45555", borderRight: `1px solid ${T.border}` }}>{fmt(qExpense)}</td>
                              <td className="py-2 px-2.5 text-right text-[10px] font-medium whitespace-nowrap" style={{ color: qProfit >= 0 ? T.text : "#c45555", borderRight: `1px solid ${T.border}` }}>{fmt(qProfit)}</td>
                              <td className="py-2 px-2.5 text-right text-[10px] whitespace-nowrap" style={{ color: T.textSub, borderRight: `1px solid ${T.border}` }}>{qCount > 0 ? fmt(Math.round((qSales - qBack) / qCount)) : "—"}</td>
                              <td className="py-2 px-2.5 text-right text-[10px] whitespace-nowrap" style={{ color: T.textSub }}>{yearTotal.sales > 0 ? `${((qSales / yearTotal.sales) * 100).toFixed(1)}%` : "—"}</td>
                            </tr>
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      {(() => {
                        const tot = monthlyData.reduce((a, d) => ({
                          count: a.count + d.count, sales: a.sales + d.sales, discount: a.discount + d.discount, card: a.card + d.card, paypay: a.paypay + d.paypay, cash: a.cash + d.cash,
                          back: a.back + d.back, invoice: a.invoice + d.invoice, withholding: a.withholding + d.withholding,
                          expense: a.expense + d.expense, income: a.income + d.income,
                        }), { count: 0, sales: 0, discount: 0, card: 0, paypay: 0, cash: 0, back: 0, invoice: 0, withholding: 0, expense: 0, income: 0 });
                        const profit = tot.sales - tot.back - tot.expense + tot.income;
                        const avg = tot.count > 0 ? Math.round((tot.sales - tot.back) / tot.count) : 0;
                        return (
                          <tr style={{ borderTop: `2px solid ${T.border}`, backgroundColor: T.cardAlt }}>
                            <td className="py-2.5 px-2.5 font-bold" style={{ borderRight: `1px solid ${T.border}` }} colSpan={2}>年間合計</td>
                            <td className="py-2.5 px-2.5 text-right font-bold" style={{ borderRight: `1px solid ${T.border}` }}>{tot.count}件</td>
                            <td className="py-2.5 px-2.5 text-right font-bold whitespace-nowrap" style={{ color: T.accent, borderRight: `1px solid ${T.border}` }}>{fmt(tot.sales)}</td>
                            <td className="py-2.5 px-2.5 text-right font-bold whitespace-nowrap" style={{ color: tot.discount === 0 ? T.textFaint : "#f59e0b", borderRight: `1px solid ${T.border}` }}>{tot.discount === 0 ? fmt(0) : `−${fmt(tot.discount)}`}</td>
                            <td className="py-2.5 px-2.5 text-right font-bold whitespace-nowrap" style={{ color: T.textSub, borderRight: `1px solid ${T.border}` }}>{fmt(tot.card)}</td>
                            <td className="py-2.5 px-2.5 text-right font-bold whitespace-nowrap" style={{ color: T.textSub, borderRight: `1px solid ${T.border}` }}>{fmt(tot.paypay)}</td>
                            <td className="py-2.5 px-2.5 text-right font-bold whitespace-nowrap" style={{ color: T.textSub, borderRight: `1px solid ${T.border}` }}>{fmt(tot.cash)}</td>
                            <td className="py-2.5 px-2.5 text-right font-bold whitespace-nowrap" style={{ color: "#7ab88f", borderRight: `1px solid ${T.border}` }}>{fmt(tot.back)}</td>
                            <td className="py-2.5 px-2.5 text-right font-bold whitespace-nowrap" style={{ color: "#a855f7", borderRight: `1px solid ${T.border}` }}>{fmt(tot.invoice)}</td>
                            <td className="py-2.5 px-2.5 text-right font-bold whitespace-nowrap" style={{ color: "#d4687e", borderRight: `1px solid ${T.border}` }}>{fmt(tot.withholding)}</td>
                            <td className="py-2.5 px-2.5 text-right font-bold whitespace-nowrap" style={{ color: "#c45555", borderRight: `1px solid ${T.border}` }}>{fmt(tot.expense)}</td>
                            <td className="py-2.5 px-2.5 text-right font-bold whitespace-nowrap" style={{ color: profit >= 0 ? T.text : "#c45555", borderRight: `1px solid ${T.border}` }}>{fmt(profit)}</td>
                            <td className="py-2.5 px-2.5 text-right font-bold whitespace-nowrap" style={{ color: T.textSub, borderRight: `1px solid ${T.border}` }}>{avg > 0 ? fmt(avg) : "—"}</td>
                            <td className="py-2.5 px-2.5 text-right font-bold whitespace-nowrap" style={{ color: T.textSub }}>100.0%</td>
                          </tr>
                        );
                      })()}
                    </tfoot>
                  </table>
                </div>
              </div>
              <div className="mt-2 space-y-1">
                <p className="text-[10px]" style={{ color: T.textFaint }}>※ オーダーが「終了」になっている予約のみ集計。利益 = 売上 − バック − 経費 + 収入</p>
                <p className="text-[10px]" style={{ color: T.textFaint }}>※ 平均単価 =（売上 − セラピストバック）÷ 予約数</p>
              </div>
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
