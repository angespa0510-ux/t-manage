"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";
import { useTheme } from "../../lib/theme";

type Therapist = { id: number; name: string };
type Store = { id: number; name: string };
type Shift = { id: number; therapist_id: number; store_id: number; date: string; start_time: string; end_time: string; status: string };

export default function ShiftManagement() {
  const router = useRouter();
  const { dark, toggle, T } = useTheme();
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [weekStart, setWeekStart] = useState(() => { const d = new Date(); d.setDate(d.getDate() - d.getDay() + 1); return d.toISOString().split("T")[0]; });

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

  const weekDates = Array.from({ length: 7 }, (_, i) => { const d = new Date(weekStart + "T00:00:00"); d.setDate(d.getDate() + i); return d.toISOString().split("T")[0]; });

  const fetchData = useCallback(async () => {
    const { data: t } = await supabase.from("therapists").select("*").order("id"); if (t) setTherapists(t);
    const { data: s } = await supabase.from("stores").select("*").order("id"); if (s) setStores(s);
    const startDate = weekDates[0]; const endDate = weekDates[6];
    const { data: sh } = await supabase.from("shifts").select("*").gte("date", startDate).lte("date", endDate).order("date"); if (sh) setShifts(sh);
  }, [weekStart]);

  useEffect(() => { const check = async () => { const { data: { user } } = await supabase.auth.getUser(); if (!user) router.push("/"); }; check(); fetchData(); }, [router, fetchData]);

  const prevWeek = () => { const d = new Date(weekStart); d.setDate(d.getDate() - 7); setWeekStart(d.toISOString().split("T")[0]); };
  const nextWeek = () => { const d = new Date(weekStart); d.setDate(d.getDate() + 7); setWeekStart(d.toISOString().split("T")[0]); };
  const thisWeek = () => { const d = new Date(); d.setDate(d.getDate() - d.getDay() + 1); setWeekStart(d.toISOString().split("T")[0]); };

  const addShift = async () => {
    if (!addTherapistId || !addDate) { setMsg("セラピストと日付を選択してください"); return; }
    setSaving(true); setMsg("");
    const { error } = await supabase.from("shifts").insert({ therapist_id: addTherapistId, store_id: addStoreId || null, date: addDate, start_time: addStart, end_time: addEnd, status: addStatus });
    setSaving(false);
    if (error) { setMsg("登録失敗: " + error.message); }
    else { setMsg("シフトを登録しました！"); fetchData(); setTimeout(() => { setShowAddShift(false); setMsg(""); }, 600); }
  };
  const updateShift = async () => { if (!editShift) return; await supabase.from("shifts").update({ store_id: editStoreId || null, start_time: editStart, end_time: editEnd, status: editStatus }).eq("id", editShift.id); setEditShift(null); fetchData(); };
  const deleteShift = async (id: number) => { await supabase.from("shifts").delete().eq("id", id); fetchData(); };
  const getShift = (tid: number, date: string) => shifts.filter((s) => s.therapist_id === tid && s.date === date);
  const getStoreName = (id: number) => stores.find((s) => s.id === id)?.name || "";

  const formatDate = (dateStr: string) => { const d = new Date(dateStr + "T00:00:00"); const days = ["日", "月", "火", "水", "木", "金", "土"]; return { day: d.getDate(), dow: days[d.getDay()], isToday: dateStr === new Date().toISOString().split("T")[0], isSat: d.getDay() === 6, isSun: d.getDay() === 0 }; };
  const weekLabel = (() => { const s = new Date(weekDates[0] + "T00:00:00"); const e = new Date(weekDates[6] + "T00:00:00"); return `${s.getFullYear()}年${s.getMonth() + 1}月${s.getDate()}日 〜 ${e.getMonth() + 1}月${e.getDate()}日`; })();

  const statusColors: Record<string, { bg: string; text: string; label: string }> = {
    confirmed: { bg: "#4a7c5918", text: "#4a7c59", label: "確定" },
    pending: { bg: "#854f0b18", text: "#854f0b", label: "仮" },
    cancelled: { bg: "#c4555518", text: "#c45555", label: "取消" },
  };
  const colors = ["#c3a782", "#7ab88f", "#85a8c4", "#c49885", "#a885c4", "#85c4b8"];
  const TIMES = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00", "21:00", "22:00", "23:00", "00:00", "01:00", "02:00", "03:00", "04:00", "05:00"];

  const openAddForCell = (tid: number, date: string) => { setAddTherapistId(tid); setAddDate(date); setAddStoreId(stores.length > 0 ? stores[0].id : 0); setAddStart("12:00"); setAddEnd("03:00"); setAddStatus("confirmed"); setMsg(""); setShowAddShift(true); };
  const openEdit = (s: Shift) => { setEditShift(s); setEditStoreId(s.store_id); setEditStart(s.start_time); setEditEnd(s.end_time); setEditStatus(s.status); };

  const inputStyle = { backgroundColor: T.cardAlt, color: T.text, border: "1px solid transparent" };

  return (
    <div className="h-screen flex flex-col" style={{ backgroundColor: T.bg, color: T.text }}>
      {/* Header */}
      <div className="h-[64px] backdrop-blur-xl border-b flex items-center justify-between px-6 flex-shrink-0" style={{ backgroundColor: dark ? T.card + "cc" : "rgba(255,255,255,0.8)", borderColor: T.border }}>
        <div className="flex items-center gap-4">
          <button onClick={() => router.push("/dashboard")} className="p-2 rounded-lg cursor-pointer" style={{ color: T.textSub }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg></button>
          <h1 className="text-[15px] font-medium">セラピスト勤怠（シフト管理）</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={toggle} className="px-3 py-1.5 text-[10px] rounded-lg cursor-pointer border" style={{ borderColor: T.border, color: T.textSub }}>{dark ? "☀️ ライト" : "🌙 ダーク"}</button>
          <button onClick={() => { setAddDate(new Date().toISOString().split("T")[0]); setAddTherapistId(0); setAddStoreId(stores.length > 0 ? stores[0].id : 0); setMsg(""); setShowAddShift(true); }}
            className="px-4 py-2 bg-gradient-to-r from-[#c3a782] to-[#b09672] text-white text-[11px] rounded-xl cursor-pointer">+ シフト追加</button>
        </div>
      </div>

      {/* Week Nav */}
      <div className="h-[52px] border-b flex items-center justify-center gap-4 flex-shrink-0" style={{ backgroundColor: T.card, borderColor: T.border }}>
        <button onClick={prevWeek} className="p-1.5 rounded-lg cursor-pointer" style={{ color: T.textSub }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="15 18 9 12 15 6"/></svg></button>
        <button onClick={thisWeek} className="px-3 py-1 text-[11px] border rounded-lg cursor-pointer" style={{ borderColor: T.border, color: T.textSub }}>今週</button>
        <span className="text-[14px] font-medium min-w-[260px] text-center">{weekLabel}</span>
        <button onClick={nextWeek} className="p-1.5 rounded-lg cursor-pointer" style={{ color: T.textSub }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="9 18 15 12 9 6"/></svg></button>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {therapists.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full">
            <p className="text-[14px] mb-4" style={{ color: T.textMuted }}>セラピストが登録されていません</p>
            <button onClick={() => router.push("/timechart")} className="px-5 py-2.5 bg-gradient-to-r from-[#c3a782] to-[#b09672] text-white text-[12px] rounded-xl cursor-pointer">タイムチャートでセラピストを追加</button>
          </div>
        ) : (
          <div className="min-w-[800px]">
            <table className="w-full border-collapse">
              <thead className="sticky top-0 z-10">
                <tr>
                  <th className="w-[130px] border-b border-r p-3 text-[11px] font-normal text-left sticky left-0 z-20" style={{ backgroundColor: T.cardAlt, borderColor: T.border, color: T.textSub }}>セラピスト</th>
                  {weekDates.map((date) => { const f = formatDate(date); return (
                    <th key={date} className="border-b border-r p-3 text-center min-w-[120px]" style={{ backgroundColor: f.isToday ? T.accent + "12" : T.cardAlt, borderColor: T.border }}>
                      <span className="text-[11px] font-normal" style={{ color: f.isSun ? "#c45555" : f.isSat ? "#3d6b9f" : T.textSub }}>{f.dow}</span>
                      <span className="block text-[15px] font-medium" style={{ color: f.isToday ? T.accent : T.text }}>{f.day}</span>
                    </th>
                  ); })}
                </tr>
              </thead>
              <tbody>
                {therapists.map((t, ti) => (
                  <tr key={t.id}>
                    <td className="border-b border-r p-3 sticky left-0 z-10" style={{ backgroundColor: T.card, borderColor: T.border }}>
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] text-white font-medium flex-shrink-0" style={{ backgroundColor: colors[ti % colors.length] }}>{t.name.charAt(0)}</div>
                        <span className="text-[12px] font-medium truncate">{t.name}</span>
                      </div>
                    </td>
                    {weekDates.map((date) => { const dayShifts = getShift(t.id, date); const f = formatDate(date); return (
                      <td key={date} className="border-b border-r p-1.5 align-top cursor-pointer transition-colors"
                        style={{ backgroundColor: f.isToday ? T.accent + "06" : T.card, borderColor: T.border }}
                        onClick={() => { if (dayShifts.length === 0) openAddForCell(t.id, date); }}>
                        {dayShifts.length === 0 ? (
                          <div className="h-[48px] flex items-center justify-center"><span className="text-[18px]" style={{ color: T.textFaint }}>+</span></div>
                        ) : (
                          dayShifts.map((s) => { const sc = statusColors[s.status] || statusColors.confirmed; return (
                            <div key={s.id} onClick={(e) => { e.stopPropagation(); openEdit(s); }}
                              className="rounded-lg p-2 mb-1 cursor-pointer hover:opacity-80 transition-opacity"
                              style={{ backgroundColor: sc.bg, borderLeft: `3px solid ${sc.text}` }}>
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-medium" style={{ color: sc.text }}>{sc.label}</span>
                                <button onClick={(e) => { e.stopPropagation(); deleteShift(s.id); }}
                                  className="w-4 h-4 rounded-full flex items-center justify-center cursor-pointer">
                                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke={sc.text} strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                </button>
                              </div>
                              <p className="text-[11px] mt-0.5" style={{ color: T.text }}>{s.start_time}〜{s.end_time}</p>
                              {s.store_id > 0 && <p className="text-[9px] truncate" style={{ color: T.textMuted }}>{getStoreName(s.store_id)}</p>}
                            </div>
                          ); })
                        )}
                      </td>
                    ); })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Summary */}
      <div className="border-t p-4 flex-shrink-0" style={{ backgroundColor: T.card, borderColor: T.border }}>
        <div className="flex items-center gap-6 text-[11px]" style={{ color: T.textSub }}>
          <span>今週のシフト数: <strong style={{ color: T.text }}>{shifts.length}</strong></span>
          <span>出勤セラピスト: <strong style={{ color: T.text }}>{new Set(shifts.map((s) => s.therapist_id)).size}</strong>名</span>
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

      {/* Add Modal */}
      {showAddShift && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowAddShift(false)}>
          <div className="rounded-2xl border p-8 w-full max-w-md animate-[fadeIn_0.25s]" style={{ backgroundColor: T.card, borderColor: T.border }} onClick={(e) => e.stopPropagation()}>
            <h2 className="text-[16px] font-medium mb-1">シフト追加</h2>
            <p className="text-[11px] mb-6" style={{ color: T.textFaint }}>セラピストのシフトを登録</p>
            <div className="space-y-4">
              <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>セラピスト <span style={{ color: "#c49885" }}>*</span></label><select value={addTherapistId} onChange={(e) => setAddTherapistId(Number(e.target.value))} className="w-full px-4 py-3 rounded-xl text-[13px] outline-none cursor-pointer" style={inputStyle}><option value={0}>選択してください</option>{therapists.map((t) => (<option key={t.id} value={t.id}>{t.name}</option>))}</select></div>
              <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>店舗</label><select value={addStoreId} onChange={(e) => setAddStoreId(Number(e.target.value))} className="w-full px-4 py-3 rounded-xl text-[13px] outline-none cursor-pointer" style={inputStyle}><option value={0}>指定なし</option>{stores.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}</select></div>
              <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>日付 <span style={{ color: "#c49885" }}>*</span></label><input type="date" value={addDate} onChange={(e) => setAddDate(e.target.value)} className="w-full px-4 py-3 rounded-xl text-[13px] outline-none cursor-pointer" style={inputStyle} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>開始時間</label><select value={addStart} onChange={(e) => setAddStart(e.target.value)} className="w-full px-4 py-3 rounded-xl text-[13px] outline-none cursor-pointer" style={inputStyle}>{TIMES.map((t) => (<option key={t} value={t}>{t}</option>))}</select></div>
                <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>終了時間</label><select value={addEnd} onChange={(e) => setAddEnd(e.target.value)} className="w-full px-4 py-3 rounded-xl text-[13px] outline-none cursor-pointer" style={inputStyle}>{TIMES.map((t) => (<option key={t} value={t}>{t}</option>))}</select></div>
              </div>
              <div>
                <label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>ステータス</label>
                <div className="flex gap-2">{Object.entries(statusColors).map(([key, val]) => (
                  <button key={key} onClick={() => setAddStatus(key)} className={`px-4 py-2 rounded-xl text-[12px] transition-all cursor-pointer ${addStatus === key ? "ring-2 ring-offset-1" : "opacity-60"}`} style={{ backgroundColor: val.bg, color: val.text }}>{val.label}</button>
                ))}</div>
              </div>
              {msg && <div className="px-4 py-3 rounded-xl text-[12px]" style={{ backgroundColor: msg.includes("失敗") || msg.includes("選択") ? "#c4988518" : "#7ab88f18", color: msg.includes("失敗") || msg.includes("選択") ? "#c49885" : "#5a9e6f" }}>{msg}</div>}
              <div className="flex gap-3 pt-2">
                <button onClick={addShift} disabled={saving} className="px-7 py-3 bg-gradient-to-r from-[#c3a782] to-[#b09672] text-white text-[12px] rounded-xl cursor-pointer disabled:opacity-60">{saving ? "登録中..." : "登録する"}</button>
                <button onClick={() => { setShowAddShift(false); setMsg(""); }} className="px-7 py-3 border text-[12px] rounded-xl cursor-pointer" style={{ borderColor: T.border, color: T.textSub }}>キャンセル</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editShift && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setEditShift(null)}>
          <div className="rounded-2xl border p-8 w-full max-w-md animate-[fadeIn_0.25s]" style={{ backgroundColor: T.card, borderColor: T.border }} onClick={(e) => e.stopPropagation()}>
            <h2 className="text-[16px] font-medium mb-1">シフト編集</h2>
            <p className="text-[11px] mb-6" style={{ color: T.textFaint }}>{therapists.find((t) => t.id === editShift.therapist_id)?.name} / {editShift.date}</p>
            <div className="space-y-4">
              <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>店舗</label><select value={editStoreId} onChange={(e) => setEditStoreId(Number(e.target.value))} className="w-full px-4 py-3 rounded-xl text-[13px] outline-none cursor-pointer" style={inputStyle}><option value={0}>指定なし</option>{stores.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}</select></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>開始時間</label><select value={editStart} onChange={(e) => setEditStart(e.target.value)} className="w-full px-4 py-3 rounded-xl text-[13px] outline-none cursor-pointer" style={inputStyle}>{TIMES.map((t) => (<option key={t} value={t}>{t}</option>))}</select></div>
                <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>終了時間</label><select value={editEnd} onChange={(e) => setEditEnd(e.target.value)} className="w-full px-4 py-3 rounded-xl text-[13px] outline-none cursor-pointer" style={inputStyle}>{TIMES.map((t) => (<option key={t} value={t}>{t}</option>))}</select></div>
              </div>
              <div>
                <label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>ステータス</label>
                <div className="flex gap-2">{Object.entries(statusColors).map(([key, val]) => (
                  <button key={key} onClick={() => setEditStatus(key)} className={`px-4 py-2 rounded-xl text-[12px] transition-all cursor-pointer ${editStatus === key ? "ring-2 ring-offset-1" : "opacity-60"}`} style={{ backgroundColor: val.bg, color: val.text }}>{val.label}</button>
                ))}</div>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={updateShift} className="px-7 py-3 bg-gradient-to-r from-[#c3a782] to-[#b09672] text-white text-[12px] rounded-xl cursor-pointer">更新する</button>
                <button onClick={() => setEditShift(null)} className="px-7 py-3 border text-[12px] rounded-xl cursor-pointer" style={{ borderColor: T.border, color: T.textSub }}>キャンセル</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  );
}
