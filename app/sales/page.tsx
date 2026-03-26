"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";

type Sale = {
  id: number; created_at: string; date: string; therapist_id: number;
  customer_name: string; course: string; amount: number; store_id: number; notes: string;
};
type Therapist = { id: number; name: string };
type Store = { id: number; name: string };

export default function SalesAnalysis() {
  const router = useRouter();
  const [sales, setSales] = useState<Sale[]>([]);
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [view, setView] = useState<"daily" | "monthly" | "yearly">("daily");
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [selectedYear, setSelectedYear] = useState(() => String(new Date().getFullYear()));

  const [showAdd, setShowAdd] = useState(false);
  const [addDate, setAddDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [addTherapistId, setAddTherapistId] = useState<number>(0);
  const [addCustomer, setAddCustomer] = useState("");
  const [addCourse, setAddCourse] = useState("");
  const [addAmount, setAddAmount] = useState("");
  const [addStoreId, setAddStoreId] = useState<number>(0);
  const [addNotes, setAddNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const fetchData = useCallback(async () => {
    const { data: t } = await supabase.from("therapists").select("*").order("id");
    if (t) setTherapists(t);
    const { data: s } = await supabase.from("stores").select("*").order("id");
    if (s) setStores(s);

    let query = supabase.from("sales").select("*").order("date", { ascending: false });
    if (view === "daily") {
      query = query.gte("date", selectedMonth + "-01").lte("date", selectedMonth + "-31");
    } else if (view === "monthly") {
      query = query.gte("date", selectedYear + "-01-01").lte("date", selectedYear + "-12-31");
    }
    const { data: sl } = await query;
    if (sl) setSales(sl);
  }, [view, selectedMonth, selectedYear]);

  useEffect(() => {
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) router.push("/");
    };
    check();
    fetchData();
  }, [router, fetchData]);

  const addSale = async () => {
    if (!addDate || !addAmount) { setMsg("日付と金額を入力してください"); return; }
    setSaving(true); setMsg("");
    const { error } = await supabase.from("sales").insert({
      date: addDate, therapist_id: addTherapistId || null, customer_name: addCustomer.trim(),
      course: addCourse.trim(), amount: parseInt(addAmount), store_id: addStoreId || null, notes: addNotes.trim(),
    });
    setSaving(false);
    if (error) { setMsg("登録失敗: " + error.message); }
    else {
      setMsg("登録しました！");
      setAddCustomer(""); setAddCourse(""); setAddAmount(""); setAddNotes("");
      fetchData();
      setTimeout(() => { setShowAdd(false); setMsg(""); }, 600);
    }
  };

  const deleteSale = async (id: number) => {
    if (!confirm("この売上データを削除しますか？")) return;
    await supabase.from("sales").delete().eq("id", id);
    fetchData();
  };

  const getTherapistName = (id: number) => therapists.find((t) => t.id === id)?.name || "不明";
  const getStoreName = (id: number) => stores.find((s) => s.id === id)?.name || "";
  const fmt = (n: number) => "¥" + n.toLocaleString();

  // Daily stats
  const dailyData = (() => {
    const days: Record<string, number> = {};
    const daysInMonth = new Date(parseInt(selectedMonth.split("-")[0]), parseInt(selectedMonth.split("-")[1]), 0).getDate();
    for (let i = 1; i <= daysInMonth; i++) {
      const key = `${selectedMonth}-${String(i).padStart(2, "0")}`;
      days[key] = 0;
    }
    sales.forEach((s) => { if (days[s.date] !== undefined) days[s.date] += s.amount; });
    return Object.entries(days).map(([date, amount]) => ({ date, amount, day: parseInt(date.split("-")[2]) }));
  })();

  const maxDaily = Math.max(...dailyData.map((d) => d.amount), 1);

  // Monthly stats
  const monthlyData = (() => {
    const months: Record<string, number> = {};
    for (let i = 1; i <= 12; i++) {
      months[`${selectedYear}-${String(i).padStart(2, "0")}`] = 0;
    }
    sales.forEach((s) => {
      const m = s.date.substring(0, 7);
      if (months[m] !== undefined) months[m] += s.amount;
    });
    return Object.entries(months).map(([month, amount]) => ({ month, amount, label: parseInt(month.split("-")[1]) + "月" }));
  })();

  const maxMonthly = Math.max(...monthlyData.map((d) => d.amount), 1);

  // Therapist ranking
  const therapistRanking = (() => {
    const map: Record<number, number> = {};
    sales.forEach((s) => { if (s.therapist_id) map[s.therapist_id] = (map[s.therapist_id] || 0) + s.amount; });
    return Object.entries(map)
      .map(([id, amount]) => ({ id: parseInt(id), name: getTherapistName(parseInt(id)), amount }))
      .sort((a, b) => b.amount - a.amount);
  })();

  const maxTherapist = therapistRanking.length > 0 ? therapistRanking[0].amount : 1;

  // Course breakdown
  const courseBreakdown = (() => {
    const map: Record<string, number> = {};
    sales.forEach((s) => { if (s.course) map[s.course] = (map[s.course] || 0) + s.amount; });
    return Object.entries(map)
      .map(([course, amount]) => ({ course, amount }))
      .sort((a, b) => b.amount - a.amount);
  })();

  const totalCourse = courseBreakdown.reduce((sum, c) => sum + c.amount, 0) || 1;

  // Summary
  const totalSales = sales.reduce((sum, s) => sum + s.amount, 0);
  const avgPerDay = dailyData.filter((d) => d.amount > 0).length > 0
    ? Math.round(totalSales / dailyData.filter((d) => d.amount > 0).length) : 0;
  const todayStr = new Date().toISOString().split("T")[0];
  const todaySales = sales.filter((s) => s.date === todayStr).reduce((sum, s) => sum + s.amount, 0);

  const colors = ["#c3a782", "#7ab88f", "#85a8c4", "#c49885", "#a885c4", "#85c4b8", "#c4a685", "#8599c4"];
  const courseColors = ["#c3a782", "#7ab88f", "#85a8c4", "#c49885", "#a885c4", "#85c4b8"];

  const prevMonth = () => {
    const [y, m] = selectedMonth.split("-").map(Number);
    const d = new Date(y, m - 2, 1);
    setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };
  const nextMonth = () => {
    const [y, m] = selectedMonth.split("-").map(Number);
    const d = new Date(y, m, 1);
    setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };

  const monthLabel = (() => {
    const [y, m] = selectedMonth.split("-");
    return `${y}年${parseInt(m)}月`;
  })();

  return (
    <div className="h-screen flex flex-col bg-[#f8f6f3]">
      {/* Header */}
      <div className="h-[64px] bg-white/80 backdrop-blur-xl border-b border-[#e8e4df] flex items-center justify-between px-6 flex-shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push("/dashboard")} className="p-2 rounded-lg hover:bg-[#f8f6f3] transition-colors cursor-pointer">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9c9a92" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <h1 className="text-[15px] font-medium text-[#2c2c2a]">売上分析</h1>
        </div>
        <div className="flex items-center gap-2">
          {(["daily", "monthly", "yearly"] as const).map((v) => (
            <button key={v} onClick={() => setView(v)}
              className={`px-4 py-2 text-[11px] rounded-xl transition-all cursor-pointer ${view === v ? "bg-[#c3a782] text-white" : "border border-[#e8e4df] text-[#888780] hover:bg-[#f8f6f3]"}`}>
              {v === "daily" ? "日別" : v === "monthly" ? "月別" : "年別"}
            </button>
          ))}
          <div className="w-px h-5 bg-[#e8e4df] mx-1" />
          <button onClick={() => { setMsg(""); setShowAdd(true); }}
            className="px-4 py-2 bg-gradient-to-r from-[#c3a782] to-[#b09672] text-white text-[11px] rounded-xl hover:shadow-[0_4px_16px_rgba(195,167,130,0.25)] transition-all cursor-pointer">+ 売上登録</button>
        </div>
      </div>

      {/* Nav */}
      {view === "daily" && (
        <div className="h-[52px] bg-white border-b border-[#e8e4df] flex items-center justify-center gap-4 flex-shrink-0">
          <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-[#f8f6f3] transition-colors cursor-pointer">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#888780" strokeWidth="1.5"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <span className="text-[14px] font-medium text-[#2c2c2a] min-w-[140px] text-center">{monthLabel}</span>
          <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-[#f8f6f3] transition-colors cursor-pointer">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#888780" strokeWidth="1.5"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>
      )}
      {view === "monthly" && (
        <div className="h-[52px] bg-white border-b border-[#e8e4df] flex items-center justify-center gap-4 flex-shrink-0">
          <button onClick={() => setSelectedYear(String(parseInt(selectedYear) - 1))} className="p-1.5 rounded-lg hover:bg-[#f8f6f3] transition-colors cursor-pointer">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#888780" strokeWidth="1.5"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <span className="text-[14px] font-medium text-[#2c2c2a] min-w-[100px] text-center">{selectedYear}年</span>
          <button onClick={() => setSelectedYear(String(parseInt(selectedYear) + 1))} className="p-1.5 rounded-lg hover:bg-[#f8f6f3] transition-colors cursor-pointer">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#888780" strokeWidth="1.5"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-[1200px] mx-auto animate-[fadeIn_0.4s_ease-out]">

          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[
              { label: "本日の売上", value: fmt(todaySales), accent: "#c3a782" },
              { label: view === "daily" ? "月間合計" : "期間合計", value: fmt(totalSales), accent: "#7ab88f" },
              { label: "営業日平均", value: fmt(avgPerDay), accent: "#85a8c4" },
              { label: "件数", value: `${sales.length}件`, accent: "#c49885" },
            ].map((s) => (
              <div key={s.label} className="bg-white rounded-2xl p-5 border border-[#f0ece4]">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[11px] text-[#b4b2a9]">{s.label}</span>
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.accent, opacity: 0.5 }} />
                </div>
                <span className="text-[24px] font-light text-[#2c2c2a] tracking-tight">{s.value}</span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Chart */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-[#f0ece4] p-6">
              <h3 className="text-[13px] font-medium text-[#2c2c2a] mb-4">
                {view === "daily" ? "日別売上" : view === "monthly" ? "月別売上" : "年別売上"}
              </h3>
              {view === "daily" && (
                <div className="flex items-end gap-[2px] h-[200px]">
                  {dailyData.map((d) => (
                    <div key={d.date} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                      <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-[#2c2c2a] text-white text-[9px] px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                        {d.day}日: {fmt(d.amount)}
                      </div>
                      <div className="w-full rounded-t-sm transition-all duration-300 cursor-default"
                        style={{ height: d.amount > 0 ? `${Math.max((d.amount / maxDaily) * 100, 3)}%` : "2px", backgroundColor: d.amount > 0 ? "#c3a782" : "#f0ece4" }} />
                      <span className="text-[8px] text-[#d3d1c7] mt-1">{d.day}</span>
                    </div>
                  ))}
                </div>
              )}
              {view === "monthly" && (
                <div className="flex items-end gap-2 h-[200px]">
                  {monthlyData.map((d, i) => (
                    <div key={d.month} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                      <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-[#2c2c2a] text-white text-[9px] px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                        {d.label}: {fmt(d.amount)}
                      </div>
                      <div className="w-full max-w-[40px] rounded-t-md transition-all duration-300 cursor-default"
                        style={{ height: d.amount > 0 ? `${Math.max((d.amount / maxMonthly) * 100, 3)}%` : "2px", backgroundColor: d.amount > 0 ? colors[i % colors.length] : "#f0ece4" }} />
                      <span className="text-[10px] text-[#b4b2a9] mt-2">{d.label}</span>
                    </div>
                  ))}
                </div>
              )}
              {view === "yearly" && (
                <div className="flex flex-col items-center justify-center h-[200px]">
                  <p className="text-[13px] text-[#b4b2a9]">年別表示はデータが蓄積されてから有効になります</p>
                  <p className="text-[11px] text-[#d3d1c7] mt-1">まずは日別・月別で売上を登録してください</p>
                </div>
              )}
            </div>

            {/* Therapist Ranking */}
            <div className="bg-white rounded-2xl border border-[#f0ece4] p-6">
              <h3 className="text-[13px] font-medium text-[#2c2c2a] mb-4">セラピスト別売上</h3>
              {therapistRanking.length === 0 ? (
                <div className="flex items-center justify-center h-[200px]">
                  <p className="text-[12px] text-[#d3d1c7]">データがありません</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {therapistRanking.map((t, i) => (
                    <div key={t.id}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-medium w-5" style={{ color: i < 3 ? "#c3a782" : "#b4b2a9" }}>{i + 1}</span>
                          <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] text-white" style={{ backgroundColor: colors[i % colors.length] }}>
                            {t.name.charAt(0)}
                          </div>
                          <span className="text-[12px] text-[#2c2c2a]">{t.name}</span>
                        </div>
                        <span className="text-[12px] font-medium text-[#2c2c2a]">{fmt(t.amount)}</span>
                      </div>
                      <div className="h-1.5 bg-[#f0ece4] rounded-full overflow-hidden ml-7">
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${(t.amount / maxTherapist) * 100}%`, backgroundColor: colors[i % colors.length] }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Course Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
            <div className="bg-white rounded-2xl border border-[#f0ece4] p-6">
              <h3 className="text-[13px] font-medium text-[#2c2c2a] mb-4">コース別売上</h3>
              {courseBreakdown.length === 0 ? (
                <div className="flex items-center justify-center h-[150px]">
                  <p className="text-[12px] text-[#d3d1c7]">データがありません</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {courseBreakdown.map((c, i) => (
                    <div key={c.course}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[12px] text-[#2c2c2a]">{c.course}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-[#b4b2a9]">{Math.round((c.amount / totalCourse) * 100)}%</span>
                          <span className="text-[12px] font-medium text-[#2c2c2a]">{fmt(c.amount)}</span>
                        </div>
                      </div>
                      <div className="h-2 bg-[#f0ece4] rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${(c.amount / totalCourse) * 100}%`, backgroundColor: courseColors[i % courseColors.length] }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Sales */}
            <div className="bg-white rounded-2xl border border-[#f0ece4] p-6">
              <h3 className="text-[13px] font-medium text-[#2c2c2a] mb-4">最近の売上</h3>
              {sales.length === 0 ? (
                <div className="flex items-center justify-center h-[150px]">
                  <p className="text-[12px] text-[#d3d1c7]">売上データがありません</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {sales.slice(0, 20).map((s) => (
                    <div key={s.id} className="flex items-center justify-between py-2 px-3 rounded-xl hover:bg-[#f8f6f3] transition-colors group">
                      <div className="flex items-center gap-3">
                        <div className="text-center min-w-[36px]">
                          <p className="text-[10px] text-[#b4b2a9]">{s.date.substring(5).replace("-", "/")}</p>
                        </div>
                        <div>
                          <p className="text-[12px] text-[#2c2c2a]">{s.customer_name || "—"}</p>
                          <p className="text-[10px] text-[#b4b2a9]">{s.therapist_id ? getTherapistName(s.therapist_id) : ""}{s.course ? " / " + s.course : ""}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-medium text-[#2c2c2a]">{fmt(s.amount)}</span>
                        <button onClick={() => deleteSale(s.id)}
                          className="w-5 h-5 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer hover:bg-[#fce8e8]">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#c45555" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Add Sale Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowAdd(false)}>
          <div className="bg-white rounded-2xl border border-[#f0ece4] p-8 w-full max-w-md animate-[fadeIn_0.25s_ease-out]" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-[16px] font-medium text-[#2c2c2a] mb-1">売上登録</h2>
            <p className="text-[11px] text-[#d3d1c7] mb-6">売上データを登録します</p>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-[#888780] mb-1.5">日付 <span className="text-[#c49885]">*</span></label>
                  <input type="date" value={addDate} onChange={(e) => setAddDate(e.target.value)}
                    className="w-full px-4 py-3 bg-[#f8f6f3] border border-transparent rounded-xl text-[13px] outline-none focus:border-[#c3a782]/30 focus:bg-white transition-all cursor-pointer" />
                </div>
                <div>
                  <label className="block text-[11px] text-[#888780] mb-1.5">金額 <span className="text-[#c49885]">*</span></label>
                  <input type="number" value={addAmount} onChange={(e) => setAddAmount(e.target.value)} placeholder="10000"
                    className="w-full px-4 py-3 bg-[#f8f6f3] border border-transparent rounded-xl text-[13px] outline-none focus:border-[#c3a782]/30 focus:bg-white transition-all placeholder-[#d3d1c7]" />
                </div>
              </div>
              <div>
                <label className="block text-[11px] text-[#888780] mb-1.5">セラピスト</label>
                <select value={addTherapistId} onChange={(e) => setAddTherapistId(Number(e.target.value))}
                  className="w-full px-4 py-3 bg-[#f8f6f3] border border-transparent rounded-xl text-[13px] outline-none focus:border-[#c3a782]/30 focus:bg-white transition-all cursor-pointer">
                  <option value={0}>選択なし</option>
                  {therapists.map((t) => (<option key={t.id} value={t.id}>{t.name}</option>))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] text-[#888780] mb-1.5">顧客名</label>
                <input type="text" value={addCustomer} onChange={(e) => setAddCustomer(e.target.value)} placeholder="お客様名"
                  className="w-full px-4 py-3 bg-[#f8f6f3] border border-transparent rounded-xl text-[13px] outline-none focus:border-[#c3a782]/30 focus:bg-white transition-all placeholder-[#d3d1c7]" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-[#888780] mb-1.5">コース</label>
                  <input type="text" value={addCourse} onChange={(e) => setAddCourse(e.target.value)} placeholder="90分コース"
                    className="w-full px-4 py-3 bg-[#f8f6f3] border border-transparent rounded-xl text-[13px] outline-none focus:border-[#c3a782]/30 focus:bg-white transition-all placeholder-[#d3d1c7]" />
                </div>
                <div>
                  <label className="block text-[11px] text-[#888780] mb-1.5">店舗</label>
                  <select value={addStoreId} onChange={(e) => setAddStoreId(Number(e.target.value))}
                    className="w-full px-4 py-3 bg-[#f8f6f3] border border-transparent rounded-xl text-[13px] outline-none focus:border-[#c3a782]/30 focus:bg-white transition-all cursor-pointer">
                    <option value={0}>選択なし</option>
                    {stores.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[11px] text-[#888780] mb-1.5">備考</label>
                <input type="text" value={addNotes} onChange={(e) => setAddNotes(e.target.value)} placeholder="メモ"
                  className="w-full px-4 py-3 bg-[#f8f6f3] border border-transparent rounded-xl text-[13px] outline-none focus:border-[#c3a782]/30 focus:bg-white transition-all placeholder-[#d3d1c7]" />
              </div>
              {msg && <div className={`px-4 py-3 rounded-xl text-[12px] ${msg.includes("失敗") || msg.includes("入力") ? "bg-[#c49885]/10 text-[#c49885]" : "bg-[#7ab88f]/10 text-[#5a9e6f]"}`}>{msg}</div>}
              <div className="flex gap-3 pt-2">
                <button onClick={addSale} disabled={saving} className="px-7 py-3 bg-gradient-to-r from-[#c3a782] to-[#b09672] text-white text-[12px] rounded-xl hover:shadow-[0_4px_16px_rgba(195,167,130,0.25)] transition-all cursor-pointer disabled:opacity-60">{saving ? "登録中..." : "登録する"}</button>
                <button onClick={() => { setShowAdd(false); setMsg(""); }} className="px-7 py-3 border border-[#f0ece4] text-[#888780] text-[12px] rounded-xl hover:bg-[#f8f6f3] transition-all cursor-pointer">キャンセル</button>
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
