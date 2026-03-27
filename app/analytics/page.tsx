"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";
import { useTheme } from "../../lib/theme";

type Reservation = { id: number; customer_name: string; therapist_id: number; date: string; start_time: string; end_time: string; course: string; notes: string };
type Course = { id: number; name: string; duration: number; price: number; therapist_back: number };
type Therapist = { id: number; name: string };
type Store = { id: number; name: string };
type Shift = { id: number; therapist_id: number; store_id: number; date: string };
type RoomAssignment = { id: number; date: string; room_id: number; slot: string; therapist_id: number };
type Room = { id: number; store_id: number; building_id: number; name: string };
type Building = { id: number; store_id: number; name: string };

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

  const [tab, setTab] = useState<Tab>("daily");
  const [selectedMonth, setSelectedMonth] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; });
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());

  const [smYear, smMonth] = selectedMonth.split("-").map(Number);
  const daysInMonth = new Date(smYear, smMonth, 0).getDate();

  const fetchData = useCallback(async () => {
    const { data: c } = await supabase.from("courses").select("*").order("duration"); if (c) setCourses(c);
    const { data: t } = await supabase.from("therapists").select("*").order("id"); if (t) setTherapists(t);
    const { data: s } = await supabase.from("stores").select("*").order("id"); if (s) setStores(s);
    const { data: b } = await supabase.from("buildings").select("*").order("id"); if (b) setBuildings(b);
    const { data: rm } = await supabase.from("rooms").select("*").order("id"); if (rm) setRooms(rm);

    // 当月の予約
    const startDate = `${selectedMonth}-01`;
    const endDate = `${selectedMonth}-${String(daysInMonth).padStart(2, "0")}`;
    const { data: r } = await supabase.from("reservations").select("*").gte("date", startDate).lte("date", endDate).order("date");
    if (r) setReservations(r);

    // 当月の部屋割り
    const { data: a } = await supabase.from("room_assignments").select("*").gte("date", startDate).lte("date", endDate);
    if (a) setAssignments(a);

    // 年間データ
    const yearStart = `${selectedYear}-01-01`;
    const yearEnd = `${selectedYear}-12-31`;
    const { data: ar } = await supabase.from("reservations").select("*").gte("date", yearStart).lte("date", yearEnd).order("date");
    if (ar) setAllReservations(ar);
  }, [selectedMonth, daysInMonth, selectedYear]);

  useEffect(() => { const check = async () => { const { data: { user } } = await supabase.auth.getUser(); if (!user) router.push("/"); }; check(); fetchData(); }, [router, fetchData]);

  const getCourse = (name: string) => courses.find((c) => c.name === name);
  const getTherapistName = (id: number) => therapists.find((t) => t.id === id)?.name || "不明";
  const fmt = (n: number) => "¥" + (n || 0).toLocaleString();

  const getPrice = (r: Reservation) => getCourse(r.course)?.price || 0;
  const getBack = (r: Reservation) => getCourse(r.course)?.therapist_back || 0;

  // ===== 日別データ =====
  const dailyData = useMemo(() => {
    const data: { date: string; label: string; sales: number; back: number; profit: number; count: number; dow: string }[] = [];
    const days = ["日", "月", "火", "水", "木", "金", "土"];
    for (let i = 1; i <= daysInMonth; i++) {
      const date = `${selectedMonth}-${String(i).padStart(2, "0")}`;
      const d = new Date(date + "T00:00:00");
      const dayRes = reservations.filter((r) => r.date === date);
      const sales = dayRes.reduce((s, r) => s + getPrice(r), 0);
      const back = dayRes.reduce((s, r) => s + getBack(r), 0);
      data.push({ date, label: `${i}`, sales, back, profit: sales - back, count: dayRes.length, dow: days[d.getDay()] });
    }
    return data;
  }, [reservations, selectedMonth, daysInMonth, courses]);

  // ===== 月別データ =====
  const monthlyData = useMemo(() => {
    const data: { month: string; label: string; sales: number; back: number; profit: number; count: number }[] = [];
    for (let m = 1; m <= 12; m++) {
      const prefix = `${selectedYear}-${String(m).padStart(2, "0")}`;
      const mRes = allReservations.filter((r) => r.date.startsWith(prefix));
      const sales = mRes.reduce((s, r) => s + getPrice(r), 0);
      const back = mRes.reduce((s, r) => s + getBack(r), 0);
      data.push({ month: prefix, label: `${m}月`, sales, back, profit: sales - back, count: mRes.length });
    }
    return data;
  }, [allReservations, selectedYear, courses]);

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

  // 月間合計
  const monthTotal = useMemo(() => {
    const sales = reservations.reduce((s, r) => s + getPrice(r), 0);
    const back = reservations.reduce((s, r) => s + getBack(r), 0);
    return { sales, back, profit: sales - back, count: reservations.length };
  }, [reservations, courses]);

  // 年間合計
  const yearTotal = useMemo(() => {
    const sales = allReservations.reduce((s, r) => s + getPrice(r), 0);
    const back = allReservations.reduce((s, r) => s + getBack(r), 0);
    return { sales, back, profit: sales - back, count: allReservations.length };
  }, [allReservations, courses]);

  const maxDailySales = Math.max(...dailyData.map((d) => d.sales), 1);
  const maxMonthlySales = Math.max(...monthlyData.map((d) => d.sales), 1);
  const maxTherapistSales = therapistData.length > 0 ? therapistData[0].sales || 1 : 1;
  const totalCourseSales = courseData.reduce((s, c) => s + c.sales, 0) || 1;

  const tabs: { key: Tab; label: string }[] = [
    { key: "daily", label: "日別" }, { key: "monthly", label: "月別" }, { key: "yearly", label: "年別" },
    { key: "therapist", label: "セラピスト" }, { key: "course", label: "コース" },
    { key: "store", label: "ルーム" }, { key: "customer", label: "顧客分析" },
  ];

  const prevMonth = () => { const d = new Date(smYear, smMonth - 2, 1); setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`); };
  const nextMonth = () => { const d = new Date(smYear, smMonth, 1); setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`); };

  // Bar component
  const Bar = ({ value, max, color, height = 120 }: { value: number; max: number; color: string; height?: number }) => {
    const h = max > 0 ? (value / max) * height : 0;
    return <div className="rounded-t" style={{ width: "100%", height: h, backgroundColor: color, minHeight: value > 0 ? 2 : 0, transition: "height 0.3s" }} />;
  };

  return (
    <div className="h-screen flex flex-col" style={{ backgroundColor: T.bg, color: T.text }}>
      {/* Header */}
      <div className="h-[56px] flex items-center justify-between px-4 flex-shrink-0 border-b" style={{ backgroundColor: T.card, borderColor: T.border }}>
        <div className="flex items-center gap-3">
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
        <div className="max-w-[1100px] mx-auto">

          {/* 日別 */}
          {tab === "daily" && (
            <div className="animate-[fadeIn_0.3s]">
              <div className="flex items-center justify-center gap-4 mb-4">
                <button onClick={prevMonth} className="p-1 cursor-pointer" style={{ color: T.textSub }}>◀</button>
                <span className="text-[14px] font-medium">{smYear}年{smMonth}月</span>
                <button onClick={nextMonth} className="p-1 cursor-pointer" style={{ color: T.textSub }}>▶</button>
              </div>
              <div className="rounded-2xl border p-4 overflow-x-auto" style={{ backgroundColor: T.card, borderColor: T.border }}>
                <div className="flex items-end gap-[2px]" style={{ minWidth: daysInMonth * 28 }}>
                  {dailyData.map((d) => (
                    <div key={d.date} className="flex-1 flex flex-col items-center min-w-[26px]" title={`${d.date}\n売上: ${fmt(d.sales)}\n予約: ${d.count}件`}>
                      <p className="text-[7px] mb-1" style={{ color: d.sales > 0 ? T.text : T.textFaint }}>{d.sales > 0 ? fmt(d.sales).replace("¥", "") : ""}</p>
                      <div className="w-full flex items-end justify-center" style={{ height: 120 }}>
                        <div className="w-[80%]"><Bar value={d.sales} max={maxDailySales} color={d.dow === "日" ? "#c45555" : d.dow === "土" ? "#3d6b9f" : T.accent} /></div>
                      </div>
                      <p className="text-[9px] mt-1" style={{ color: d.dow === "日" ? "#c45555" : d.dow === "土" ? "#3d6b9f" : T.textMuted }}>{d.label}</p>
                      <p className="text-[7px]" style={{ color: T.textFaint }}>{d.dow}</p>
                    </div>
                  ))}
                </div>
              </div>
              {/* 日別テーブル */}
              <div className="rounded-2xl border mt-4 overflow-hidden" style={{ backgroundColor: T.card, borderColor: T.border }}>
                <table className="w-full text-[11px]">
                  <thead><tr style={{ borderBottom: `1px solid ${T.border}` }}>
                    {["日付", "曜日", "予約数", "売上", "バック", "利益"].map((h) => (<th key={h} className="py-2 px-3 text-left font-normal" style={{ color: T.textMuted }}>{h}</th>))}
                  </tr></thead>
                  <tbody>{dailyData.filter((d) => d.count > 0).map((d) => (
                    <tr key={d.date} style={{ borderBottom: `1px solid ${T.border}` }}>
                      <td className="py-2 px-3">{d.date}</td>
                      <td className="py-2 px-3" style={{ color: d.dow === "日" ? "#c45555" : d.dow === "土" ? "#3d6b9f" : T.textSub }}>{d.dow}</td>
                      <td className="py-2 px-3">{d.count}件</td>
                      <td className="py-2 px-3 font-medium" style={{ color: T.accent }}>{fmt(d.sales)}</td>
                      <td className="py-2 px-3" style={{ color: "#7ab88f" }}>{fmt(d.back)}</td>
                      <td className="py-2 px-3">{fmt(d.profit)}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </div>
          )}

          {/* 月別 */}
          {tab === "monthly" && (
            <div className="animate-[fadeIn_0.3s]">
              <div className="flex items-center justify-center gap-4 mb-4">
                <button onClick={() => setSelectedYear(selectedYear - 1)} className="p-1 cursor-pointer" style={{ color: T.textSub }}>◀</button>
                <span className="text-[14px] font-medium">{selectedYear}年</span>
                <button onClick={() => setSelectedYear(selectedYear + 1)} className="p-1 cursor-pointer" style={{ color: T.textSub }}>▶</button>
              </div>
              <div className="rounded-2xl border p-4" style={{ backgroundColor: T.card, borderColor: T.border }}>
                <div className="flex items-end gap-2">
                  {monthlyData.map((d) => (
                    <div key={d.month} className="flex-1 flex flex-col items-center" title={`${d.label}\n売上: ${fmt(d.sales)}\n予約: ${d.count}件`}>
                      <p className="text-[9px] mb-1" style={{ color: d.sales > 0 ? T.accent : T.textFaint }}>{d.sales > 0 ? fmt(d.sales).replace("¥", "") : ""}</p>
                      <div className="w-full flex items-end justify-center" style={{ height: 140 }}>
                        <div className="w-[70%]"><Bar value={d.sales} max={maxMonthlySales} color={T.accent} height={140} /></div>
                      </div>
                      <p className="text-[11px] mt-1" style={{ color: T.textSub }}>{d.label}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border mt-4 p-4" style={{ backgroundColor: T.card, borderColor: T.border }}>
                <p className="text-[13px] font-medium mb-2">{selectedYear}年 合計</p>
                <div className="flex gap-6 text-[12px]">
                  <span style={{ color: T.textSub }}>売上: <span className="font-medium" style={{ color: T.accent }}>{fmt(yearTotal.sales)}</span></span>
                  <span style={{ color: T.textSub }}>バック: <span className="font-medium" style={{ color: "#7ab88f" }}>{fmt(yearTotal.back)}</span></span>
                  <span style={{ color: T.textSub }}>利益: <span className="font-medium" style={{ color: T.text }}>{fmt(yearTotal.profit)}</span></span>
                  <span style={{ color: T.textSub }}>予約: <span className="font-medium" style={{ color: T.text }}>{yearTotal.count}件</span></span>
                </div>
              </div>
            </div>
          )}

          {/* 年別 */}
          {tab === "yearly" && (
            <div className="animate-[fadeIn_0.3s]">
              <div className="rounded-2xl border p-4" style={{ backgroundColor: T.card, borderColor: T.border }}>
                <p className="text-[13px] font-medium mb-3">{selectedYear}年 月別推移テーブル</p>
                <table className="w-full text-[11px]">
                  <thead><tr style={{ borderBottom: `1px solid ${T.border}` }}>
                    {["月", "予約数", "売上", "バック", "利益", "平均単価"].map((h) => (<th key={h} className="py-2 px-3 text-left font-normal" style={{ color: T.textMuted }}>{h}</th>))}
                  </tr></thead>
                  <tbody>{monthlyData.map((d) => (
                    <tr key={d.month} style={{ borderBottom: `1px solid ${T.border}` }}>
                      <td className="py-2 px-3 font-medium">{d.label}</td>
                      <td className="py-2 px-3">{d.count}件</td>
                      <td className="py-2 px-3 font-medium" style={{ color: T.accent }}>{fmt(d.sales)}</td>
                      <td className="py-2 px-3" style={{ color: "#7ab88f" }}>{fmt(d.back)}</td>
                      <td className="py-2 px-3">{fmt(d.profit)}</td>
                      <td className="py-2 px-3" style={{ color: T.textSub }}>{d.count > 0 ? fmt(Math.round(d.sales / d.count)) : "—"}</td>
                    </tr>
                  ))}</tbody>
                  <tfoot><tr style={{ borderTop: `2px solid ${T.border}` }}>
                    <td className="py-2 px-3 font-bold">合計</td>
                    <td className="py-2 px-3 font-bold">{yearTotal.count}件</td>
                    <td className="py-2 px-3 font-bold" style={{ color: T.accent }}>{fmt(yearTotal.sales)}</td>
                    <td className="py-2 px-3 font-bold" style={{ color: "#7ab88f" }}>{fmt(yearTotal.back)}</td>
                    <td className="py-2 px-3 font-bold">{fmt(yearTotal.profit)}</td>
                    <td className="py-2 px-3 font-bold" style={{ color: T.textSub }}>{yearTotal.count > 0 ? fmt(Math.round(yearTotal.sales / yearTotal.count)) : "—"}</td>
                  </tr></tfoot>
                </table>
              </div>
              <div className="flex items-center justify-center gap-4 mt-4">
                <button onClick={() => setSelectedYear(selectedYear - 1)} className="px-3 py-1.5 text-[11px] border rounded-lg cursor-pointer" style={{ borderColor: T.border, color: T.textSub }}>◀ {selectedYear - 1}年</button>
                <span className="text-[14px] font-medium">{selectedYear}年</span>
                <button onClick={() => setSelectedYear(selectedYear + 1)} className="px-3 py-1.5 text-[11px] border rounded-lg cursor-pointer" style={{ borderColor: T.border, color: T.textSub }}>{selectedYear + 1}年 ▶</button>
              </div>
            </div>
          )}

          {/* セラピスト別 */}
          {tab === "therapist" && (
            <div className="animate-[fadeIn_0.3s]">
              <p className="text-[12px] mb-3" style={{ color: T.textMuted }}>{smYear}年{smMonth}月 セラピスト別ランキング</p>
              <div className="space-y-2">
                {therapistData.map((t, i) => (
                  <div key={t.id} className="rounded-xl border p-4" style={{ backgroundColor: T.card, borderColor: T.border }}>
                    <div className="flex items-center gap-4">
                      <span className="text-[18px] font-bold w-8 text-center" style={{ color: i === 0 ? "#fbbf24" : i === 1 ? "#9ca3af" : i === 2 ? "#c49885" : T.textFaint }}>{i + 1}</span>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[13px] font-medium">{t.name}</span>
                          <span className="text-[16px] font-medium" style={{ color: T.accent }}>{fmt(t.sales)}</span>
                        </div>
                        <div className="w-full rounded-full h-2 mb-2" style={{ backgroundColor: T.cardAlt }}>
                          <div className="rounded-full h-2 transition-all" style={{ width: `${(t.sales / maxTherapistSales) * 100}%`, backgroundColor: T.accent }} />
                        </div>
                        <div className="flex gap-4 text-[10px]" style={{ color: T.textSub }}>
                          <span>予約: {t.count}件</span>
                          <span>バック: <span style={{ color: "#7ab88f" }}>{fmt(t.back)}</span></span>
                          <span>顧客数: {t.customers}名</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {therapistData.length === 0 && <p className="text-[12px] text-center py-8" style={{ color: T.textFaint }}>データがありません</p>}
              </div>
            </div>
          )}

          {/* コース別 */}
          {tab === "course" && (
            <div className="animate-[fadeIn_0.3s]">
              <p className="text-[12px] mb-3" style={{ color: T.textMuted }}>{smYear}年{smMonth}月 コース別売上</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 円グラフ的な棒グラフ */}
                <div className="rounded-2xl border p-4" style={{ backgroundColor: T.card, borderColor: T.border }}>
                  <p className="text-[12px] font-medium mb-3">売上割合</p>
                  <div className="space-y-2">
                    {courseData.map((c, i) => {
                      const pct = Math.round((c.sales / totalCourseSales) * 100);
                      const colors = ["#c3a782", "#7ab88f", "#85a8c4", "#c49885", "#a885c4", "#85c4b8"];
                      return (
                        <div key={c.name}>
                          <div className="flex items-center justify-between text-[11px] mb-1">
                            <span>{c.name}</span>
                            <span style={{ color: T.textSub }}>{pct}%</span>
                          </div>
                          <div className="w-full rounded-full h-3" style={{ backgroundColor: T.cardAlt }}>
                            <div className="rounded-full h-3 transition-all" style={{ width: `${pct}%`, backgroundColor: colors[i % colors.length] }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                {/* テーブル */}
                <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: T.card, borderColor: T.border }}>
                  <table className="w-full text-[11px]">
                    <thead><tr style={{ borderBottom: `1px solid ${T.border}` }}>
                      {["コース", "予約数", "売上", "割合"].map((h) => (<th key={h} className="py-2 px-3 text-left font-normal" style={{ color: T.textMuted }}>{h}</th>))}
                    </tr></thead>
                    <tbody>{courseData.map((c) => (
                      <tr key={c.name} style={{ borderBottom: `1px solid ${T.border}` }}>
                        <td className="py-2 px-3 font-medium">{c.name}</td>
                        <td className="py-2 px-3">{c.count}件</td>
                        <td className="py-2 px-3" style={{ color: T.accent }}>{fmt(c.sales)}</td>
                        <td className="py-2 px-3" style={{ color: T.textSub }}>{Math.round((c.sales / totalCourseSales) * 100)}%</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ルーム別 */}
          {tab === "store" && (
            <div className="animate-[fadeIn_0.3s]">
              <p className="text-[12px] mb-3" style={{ color: T.textMuted }}>{smYear}年{smMonth}月 ルーム別売上</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {storeData.map((s, i) => {
                  const colors = ["#c3a782", "#7ab88f", "#85a8c4", "#c49885"];
                  return (
                    <div key={s.id} className="rounded-2xl border p-5" style={{ backgroundColor: T.card, borderColor: T.border }}>
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: colors[i % colors.length] }} />
                        <span className="text-[13px] font-medium">{s.name}</span>
                      </div>
                      <p className="text-[24px] font-light mb-1" style={{ color: colors[i % colors.length] }}>{fmt(s.sales)}</p>
                      <p className="text-[11px]" style={{ color: T.textSub }}>予約: {s.count}件</p>
                    </div>
                  );
                })}
                {storeData.length === 0 && <p className="text-[12px] py-8" style={{ color: T.textFaint }}>部屋割りデータがありません</p>}
              </div>
            </div>
          )}

          {/* 顧客分析 */}
          {tab === "customer" && (
            <div className="animate-[fadeIn_0.3s]">
              <p className="text-[12px] mb-3" style={{ color: T.textMuted }}>{smYear}年{smMonth}月 顧客分析</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                {[
                  { label: "総顧客数", value: `${customerStats.totalCustomers}名`, color: "#c3a782" },
                  { label: "リピーター", value: `${customerStats.repeaters}名 (${customerStats.repeatRate}%)`, color: "#7ab88f" },
                  { label: "指名率", value: `${customerStats.nominationRate}%`, color: "#85a8c4" },
                  { label: "総予約数", value: `${customerStats.totalReservations}件`, color: "#c49885" },
                ].map((s) => (
                  <div key={s.label} className="rounded-xl border p-4" style={{ backgroundColor: T.card, borderColor: T.border }}>
                    <p className="text-[9px] mb-1" style={{ color: T.textMuted }}>{s.label}</p>
                    <p className="text-[18px] font-light" style={{ color: s.color }}>{s.value}</p>
                  </div>
                ))}
              </div>
              <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: T.card, borderColor: T.border }}>
                <div className="px-4 py-3" style={{ borderBottom: `1px solid ${T.border}` }}>
                  <p className="text-[12px] font-medium">売上TOP10 顧客</p>
                </div>
                <table className="w-full text-[11px]">
                  <thead><tr style={{ borderBottom: `1px solid ${T.border}` }}>
                    {["順位", "顧客名", "来店回数", "売上合計"].map((h) => (<th key={h} className="py-2 px-3 text-left font-normal" style={{ color: T.textMuted }}>{h}</th>))}
                  </tr></thead>
                  <tbody>{customerStats.topCustomers.map((c, i) => (
                    <tr key={c.name} style={{ borderBottom: `1px solid ${T.border}` }}>
                      <td className="py-2 px-3 font-bold" style={{ color: i === 0 ? "#fbbf24" : i === 1 ? "#9ca3af" : i === 2 ? "#c49885" : T.textFaint }}>{i + 1}</td>
                      <td className="py-2 px-3 font-medium">{c.name}</td>
                      <td className="py-2 px-3">{c.count}回</td>
                      <td className="py-2 px-3" style={{ color: T.accent }}>{fmt(c.sales)}</td>
                    </tr>
                  ))}</tbody>
                </table>
                {customerStats.topCustomers.length === 0 && <p className="text-[12px] text-center py-8" style={{ color: T.textFaint }}>データがありません</p>}
              </div>
            </div>
          )}
        </div>
      </div>

      <style jsx global>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  );
}
