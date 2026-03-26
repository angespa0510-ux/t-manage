"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";

type Therapist = { id: number; name: string };
type Store = { id: number; name: string };
type Shift = {
  id: number; therapist_id: number; store_id: number;
  date: string; start_time: string; end_time: string; status: string;
};

export default function ShiftManagement() {
  const router = useRouter();
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [weekStart, setWeekStart] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay() + 1);
    return d.toISOString().split("T")[0];
  });
  const [view, setView] = useState<"week" | "month">("week");

  const [showAddShift, setShowAddShift] = useState(false);
  const [addTherapistId, setAddTherapistId] = useState<number>(0);
  const [addStoreId, setAddStoreId] = useState<number>(0);
  const [addDate, setAddDate] = useState("");
  const [addStart, setAddStart] = useState("12:00");
  const [addEnd, setAddEnd] = useState("03:00");
  const [addStatus, setAddStatus] = useState("confirmed");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const [editShift, setEditShift] = useState<Shift | null>(null);
  const [editStoreId, setEditStoreId] = useState<number>(0);
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");
  const [editStatus, setEditStatus] = useState("");

  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart + "T00:00:00");
    d.setDate(d.getDate() + i);
    return d.toISOString().split("T")[0];
  });

  const fetchData = useCallback(async () => {
    const { data: t } = await supabase.from("therapists").select("*").order("id");
    if (t) setTherapists(t);
    const { data: s } = await supabase.from("stores").select("*").order("id");
    if (s) setStores(s);
    const startDate = weekDates[0];
    const endDate = weekDates[6];
    const { data: sh } = await supabase.from("shifts").select("*")
      .gte("date", startDate).lte("date", endDate).order("date");
    if (sh) setShifts(sh);
  }, [weekStart]);

  useEffect(() => {
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) router.push("/");
    };
    check();
    fetchData();
  }, [router, fetchData]);

  const prevWeek = () => {
    const d = new Date(weekStart); d.setDate(d.getDate() - 7);
    setWeekStart(d.toISOString().split("T")[0]);
  };
  const nextWeek = () => {
    const d = new Date(weekStart); d.setDate(d.getDate() + 7);
    setWeekStart(d.toISOString().split("T")[0]);
  };
  const thisWeek = () => {
    const d = new Date(); d.setDate(d.getDate() - d.getDay() + 1);
    setWeekStart(d.toISOString().split("T")[0]);
  };

  const addShift = async () => {
    if (!addTherapistId || !addDate) { setMsg("セラピストと日付を選択してください"); return; }
    setSaving(true); setMsg("");
    const { error } = await supabase.from("shifts").insert({
      therapist_id: addTherapistId, store_id: addStoreId || null,
      date: addDate, start_time: addStart, end_time: addEnd, status: addStatus,
    });
    setSaving(false);
    if (error) { setMsg("登録失敗: " + error.message); }
    else {
      setMsg("シフトを登録しました！");
      fetchData();
      setTimeout(() => { setShowAddShift(false); setMsg(""); }, 600);
    }
  };

  const updateShift = async () => {
    if (!editShift) return;
    await supabase.from("shifts").update({
      store_id: editStoreId || null,
      start_time: editStart, end_time: editEnd, status: editStatus,
    }).eq("id", editShift.id);
    setEditShift(null);
    fetchData();
  };

  const deleteShift = async (id: number) => {
    await supabase.from("shifts").delete().eq("id", id);
    fetchData();
  };

  const getShift = (therapistId: number, date: string) => {
    return shifts.filter((s) => s.therapist_id === therapistId && s.date === date);
  };

  const getStoreName = (id: number) => stores.find((s) => s.id === id)?.name || "";

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + "T00:00:00");
    const days = ["日", "月", "火", "水", "木", "金", "土"];
    return { day: d.getDate(), dow: days[d.getDay()], isToday: dateStr === new Date().toISOString().split("T")[0], isSat: d.getDay() === 6, isSun: d.getDay() === 0 };
  };

  const weekLabel = (() => {
    const s = new Date(weekDates[0] + "T00:00:00");
    const e = new Date(weekDates[6] + "T00:00:00");
    return `${s.getFullYear()}年${s.getMonth() + 1}月${s.getDate()}日 〜 ${e.getMonth() + 1}月${e.getDate()}日`;
  })();

  const statusColors: Record<string, { bg: string; text: string; label: string }> = {
    confirmed: { bg: "#e8f0ea", text: "#4a7c59", label: "確定" },
    pending: { bg: "#faeeda", text: "#854f0b", label: "仮" },
    cancelled: { bg: "#fce8e8", text: "#c45555", label: "取消" },
  };

  const colors = ["#c3a782", "#7ab88f", "#85a8c4", "#c49885", "#a885c4", "#85c4b8"];

  const openAddForCell = (therapistId: number, date: string) => {
    setAddTherapistId(therapistId);
    setAddDate(date);
    setAddStoreId(stores.length > 0 ? stores[0].id : 0);
    setAddStart("12:00");
    setAddEnd("03:00");
    setAddStatus("confirmed");
    setMsg("");
    setShowAddShift(true);
  };

  const openEdit = (s: Shift) => {
    setEditShift(s);
    setEditStoreId(s.store_id);
    setEditStart(s.start_time);
    setEditEnd(s.end_time);
    setEditStatus(s.status);
  };

  const TIMES = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00", "21:00", "22:00", "23:00", "00:00", "01:00", "02:00", "03:00", "04:00", "05:00"];

  return (
    <div className="h-screen flex flex-col bg-[#f8f6f3]">
      {/* Header */}
      <div className="h-[64px] bg-white/80 backdrop-blur-xl border-b border-[#e8e4df] flex items-center justify-between px-6 flex-shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push("/dashboard")} className="p-2 rounded-lg hover:bg-[#f8f6f3] transition-colors cursor-pointer">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9c9a92" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <h1 className="text-[15px] font-medium text-[#2c2c2a]">セラピスト勤怠（シフト管理）</h1>
        </div>
        <button onClick={() => { setAddDate(new Date().toISOString().split("T")[0]); setAddTherapistId(0); setAddStoreId(stores.length > 0 ? stores[0].id : 0); setMsg(""); setShowAddShift(true); }}
          className="px-4 py-2 bg-gradient-to-r from-[#c3a782] to-[#b09672] text-white text-[11px] rounded-xl hover:shadow-[0_4px_16px_rgba(195,167,130,0.25)] transition-all cursor-pointer">+ シフト追加</button>
      </div>

      {/* Week Nav */}
      <div className="h-[52px] bg-white border-b border-[#e8e4df] flex items-center justify-center gap-4 flex-shrink-0">
        <button onClick={prevWeek} className="p-1.5 rounded-lg hover:bg-[#f8f6f3] transition-colors cursor-pointer">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#888780" strokeWidth="1.5"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <button onClick={thisWeek} className="px-3 py-1 text-[11px] text-[#888780] border border-[#e8e4df] rounded-lg hover:bg-[#f8f6f3] cursor-pointer">今週</button>
        <span className="text-[14px] font-medium text-[#2c2c2a] min-w-[260px] text-center">{weekLabel}</span>
        <button onClick={nextWeek} className="p-1.5 rounded-lg hover:bg-[#f8f6f3] transition-colors cursor-pointer">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#888780" strokeWidth="1.5"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>

      {/* Shift Table */}
      <div className="flex-1 overflow-auto">
        {therapists.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full">
            <p className="text-[14px] text-[#b4b2a9] mb-4">セラピストが登録されていません</p>
            <button onClick={() => router.push("/timechart")} className="px-5 py-2.5 bg-gradient-to-r from-[#c3a782] to-[#b09672] text-white text-[12px] rounded-xl cursor-pointer">タイムチャートでセラピストを追加</button>
          </div>
        ) : (
          <div className="min-w-[800px]">
            <table className="w-full border-collapse">
              <thead className="sticky top-0 z-10">
                <tr>
                  <th className="w-[130px] bg-[#f0ece4] border-b border-r border-[#e8e4df] p-3 text-[11px] text-[#888780] font-normal text-left sticky left-0 z-20">セラピスト</th>
                  {weekDates.map((date) => {
                    const f = formatDate(date);
                    return (
                      <th key={date} className={`bg-[#f0ece4] border-b border-r border-[#e8e4df] p-3 text-center min-w-[120px] ${f.isToday ? "bg-[#c3a782]/10" : ""}`}>
                        <span className={`text-[11px] font-normal ${f.isSun ? "text-[#c45555]" : f.isSat ? "text-[#3d6b9f]" : "text-[#888780]"}`}>{f.dow}</span>
                        <span className={`block text-[15px] font-medium ${f.isToday ? "text-[#c3a782]" : "text-[#2c2c2a]"}`}>{f.day}</span>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {therapists.map((t, ti) => (
                  <tr key={t.id}>
                    <td className="bg-white border-b border-r border-[#e8e4df] p-3 sticky left-0 z-10">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] text-white font-medium flex-shrink-0" style={{ backgroundColor: colors[ti % colors.length] }}>
                          {t.name.charAt(0)}
                        </div>
                        <span className="text-[12px] text-[#2c2c2a] font-medium truncate">{t.name}</span>
                      </div>
                    </td>
                    {weekDates.map((date) => {
                      const dayShifts = getShift(t.id, date);
                      const f = formatDate(date);
                      return (
                        <td key={date} className={`border-b border-r border-[#e8e4df] p-1.5 align-top cursor-pointer hover:bg-[#f8f6f3] transition-colors ${f.isToday ? "bg-[#c3a782]/[0.03]" : "bg-white"}`}
                          onClick={() => { if (dayShifts.length === 0) openAddForCell(t.id, date); }}>
                          {dayShifts.length === 0 ? (
                            <div className="h-[48px] flex items-center justify-center">
                              <span className="text-[18px] text-[#e8e4df]">+</span>
                            </div>
                          ) : (
                            dayShifts.map((s) => {
                              const sc = statusColors[s.status] || statusColors.confirmed;
                              return (
                                <div key={s.id} onClick={(e) => { e.stopPropagation(); openEdit(s); }}
                                  className="rounded-lg p-2 mb-1 cursor-pointer hover:opacity-80 transition-opacity"
                                  style={{ backgroundColor: sc.bg, borderLeft: `3px solid ${sc.text}` }}>
                                  <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-medium" style={{ color: sc.text }}>{sc.label}</span>
                                    <button onClick={(e) => { e.stopPropagation(); deleteShift(s.id); }}
                                      className="w-4 h-4 rounded-full flex items-center justify-center hover:bg-white/60 transition-colors">
                                      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke={sc.text} strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                    </button>
                                  </div>
                                  <p className="text-[11px] text-[#2c2c2a] mt-0.5">{s.start_time}〜{s.end_time}</p>
                                  {s.store_id > 0 && <p className="text-[9px] text-[#b4b2a9] truncate">{getStoreName(s.store_id)}</p>}
                                </div>
                              );
                            })
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Summary Bar */}
      <div className="border-t border-[#e8e4df] bg-white p-4 flex-shrink-0">
        <div className="flex items-center gap-6 text-[11px] text-[#888780]">
          <span>今週のシフト数: <strong className="text-[#2c2c2a]">{shifts.length}</strong></span>
          <span>出勤セラピスト: <strong className="text-[#2c2c2a]">{new Set(shifts.map((s) => s.therapist_id)).size}</strong>名</span>
          <div className="flex items-center gap-3 ml-auto">
            {Object.entries(statusColors).map(([key, val]) => (
              <div key={key} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: val.bg, border: `1px solid ${val.text}` }} />
                <span>{val.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Add Shift Modal */}
      {showAddShift && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowAddShift(false)}>
          <div className="bg-white rounded-2xl border border-[#f0ece4] p-8 w-full max-w-md animate-[fadeIn_0.25s_ease-out]" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-[16px] font-medium text-[#2c2c2a] mb-1">シフト追加</h2>
            <p className="text-[11px] text-[#d3d1c7] mb-6">セラピストのシフトを登録</p>
            <div className="space-y-4">
              <div>
                <label className="block text-[11px] text-[#888780] mb-1.5">セラピスト <span className="text-[#c49885]">*</span></label>
                <select value={addTherapistId} onChange={(e) => setAddTherapistId(Number(e.target.value))}
                  className="w-full px-4 py-3 bg-[#f8f6f3] border border-transparent rounded-xl text-[13px] outline-none focus:border-[#c3a782]/30 focus:bg-white transition-all cursor-pointer">
                  <option value={0}>選択してください</option>
                  {therapists.map((t) => (<option key={t.id} value={t.id}>{t.name}</option>))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] text-[#888780] mb-1.5">店舗</label>
                <select value={addStoreId} onChange={(e) => setAddStoreId(Number(e.target.value))}
                  className="w-full px-4 py-3 bg-[#f8f6f3] border border-transparent rounded-xl text-[13px] outline-none focus:border-[#c3a782]/30 focus:bg-white transition-all cursor-pointer">
                  <option value={0}>指定なし</option>
                  {stores.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] text-[#888780] mb-1.5">日付 <span className="text-[#c49885]">*</span></label>
                <input type="date" value={addDate} onChange={(e) => setAddDate(e.target.value)}
                  className="w-full px-4 py-3 bg-[#f8f6f3] border border-transparent rounded-xl text-[13px] outline-none focus:border-[#c3a782]/30 focus:bg-white transition-all cursor-pointer" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-[#888780] mb-1.5">開始時間</label>
                  <select value={addStart} onChange={(e) => setAddStart(e.target.value)}
                    className="w-full px-4 py-3 bg-[#f8f6f3] border border-transparent rounded-xl text-[13px] outline-none focus:border-[#c3a782]/30 focus:bg-white transition-all cursor-pointer">
                    {TIMES.map((t) => (<option key={t} value={t}>{t}</option>))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] text-[#888780] mb-1.5">終了時間</label>
                  <select value={addEnd} onChange={(e) => setAddEnd(e.target.value)}
                    className="w-full px-4 py-3 bg-[#f8f6f3] border border-transparent rounded-xl text-[13px] outline-none focus:border-[#c3a782]/30 focus:bg-white transition-all cursor-pointer">
                    {TIMES.map((t) => (<option key={t} value={t}>{t}</option>))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[11px] text-[#888780] mb-1.5">ステータス</label>
                <div className="flex gap-2">
                  {Object.entries(statusColors).map(([key, val]) => (
                    <button key={key} onClick={() => setAddStatus(key)}
                      className={`px-4 py-2 rounded-xl text-[12px] transition-all cursor-pointer ${addStatus === key ? "ring-2 ring-offset-1" : "opacity-60 hover:opacity-80"}`}
                      style={{ backgroundColor: val.bg, color: val.text }}>
                      {val.label}
                    </button>
                  ))}
                </div>
              </div>
              {msg && <div className={`px-4 py-3 rounded-xl text-[12px] ${msg.includes("失敗") || msg.includes("選択") ? "bg-[#c49885]/10 text-[#c49885]" : "bg-[#7ab88f]/10 text-[#5a9e6f]"}`}>{msg}</div>}
              <div className="flex gap-3 pt-2">
                <button onClick={addShift} disabled={saving} className="px-7 py-3 bg-gradient-to-r from-[#c3a782] to-[#b09672] text-white text-[12px] rounded-xl hover:shadow-[0_4px_16px_rgba(195,167,130,0.25)] transition-all cursor-pointer disabled:opacity-60">{saving ? "登録中..." : "登録する"}</button>
                <button onClick={() => { setShowAddShift(false); setMsg(""); }} className="px-7 py-3 border border-[#f0ece4] text-[#888780] text-[12px] rounded-xl hover:bg-[#f8f6f3] transition-all cursor-pointer">キャンセル</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Shift Modal */}
      {editShift && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setEditShift(null)}>
          <div className="bg-white rounded-2xl border border-[#f0ece4] p-8 w-full max-w-md animate-[fadeIn_0.25s_ease-out]" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-[16px] font-medium text-[#2c2c2a] mb-1">シフト編集</h2>
            <p className="text-[11px] text-[#d3d1c7] mb-6">{therapists.find((t) => t.id === editShift.therapist_id)?.name} / {editShift.date}</p>
            <div className="space-y-4">
              <div>
                <label className="block text-[11px] text-[#888780] mb-1.5">店舗</label>
                <select value={editStoreId} onChange={(e) => setEditStoreId(Number(e.target.value))}
                  className="w-full px-4 py-3 bg-[#f8f6f3] border border-transparent rounded-xl text-[13px] outline-none focus:border-[#c3a782]/30 focus:bg-white transition-all cursor-pointer">
                  <option value={0}>指定なし</option>
                  {stores.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-[#888780] mb-1.5">開始時間</label>
                  <select value={editStart} onChange={(e) => setEditStart(e.target.value)}
                    className="w-full px-4 py-3 bg-[#f8f6f3] border border-transparent rounded-xl text-[13px] outline-none focus:border-[#c3a782]/30 focus:bg-white transition-all cursor-pointer">
                    {TIMES.map((t) => (<option key={t} value={t}>{t}</option>))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] text-[#888780] mb-1.5">終了時間</label>
                  <select value={editEnd} onChange={(e) => setEditEnd(e.target.value)}
                    className="w-full px-4 py-3 bg-[#f8f6f3] border border-transparent rounded-xl text-[13px] outline-none focus:border-[#c3a782]/30 focus:bg-white transition-all cursor-pointer">
                    {TIMES.map((t) => (<option key={t} value={t}>{t}</option>))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[11px] text-[#888780] mb-1.5">ステータス</label>
                <div className="flex gap-2">
                  {Object.entries(statusColors).map(([key, val]) => (
                    <button key={key} onClick={() => setEditStatus(key)}
                      className={`px-4 py-2 rounded-xl text-[12px] transition-all cursor-pointer ${editStatus === key ? "ring-2 ring-offset-1" : "opacity-60 hover:opacity-80"}`}
                      style={{ backgroundColor: val.bg, color: val.text }}>
                      {val.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={updateShift} className="px-7 py-3 bg-gradient-to-r from-[#c3a782] to-[#b09672] text-white text-[12px] rounded-xl hover:shadow-[0_4px_16px_rgba(195,167,130,0.25)] transition-all cursor-pointer">更新する</button>
                <button onClick={() => setEditShift(null)} className="px-7 py-3 border border-[#f0ece4] text-[#888780] text-[12px] rounded-xl hover:bg-[#f8f6f3] transition-all cursor-pointer">キャンセル</button>
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
