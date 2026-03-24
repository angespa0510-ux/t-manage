"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";

type Therapist = { id: number; name: string; phone: string; status: string };
type Reservation = {
  id: number; customer_name: string; therapist_id: number;
  date: string; start_time: string; end_time: string; course: string; notes: string;
};

const HOURS = Array.from({ length: 15 }, (_, i) => i + 9); // 9:00-23:00

export default function TimeChart() {
  const router = useRouter();
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date(); return d.toISOString().split("T")[0];
  });

  // New reservation
  const [showNewRes, setShowNewRes] = useState(false);
  const [newCustName, setNewCustName] = useState("");
  const [newTherapistId, setNewTherapistId] = useState<number>(0);
  const [newDate, setNewDate] = useState("");
  const [newStart, setNewStart] = useState("10:00");
  const [newEnd, setNewEnd] = useState("11:00");
  const [newCourse, setNewCourse] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  // New therapist
  const [showNewTherapist, setShowNewTherapist] = useState(false);
  const [tName, setTName] = useState("");
  const [tPhone, setTPhone] = useState("");

  const fetchData = useCallback(async () => {
    const { data: t } = await supabase.from("therapists").select("*").order("id");
    if (t) setTherapists(t);
    const { data: r } = await supabase.from("reservations").select("*").eq("date", selectedDate).order("start_time");
    if (r) setReservations(r);
  }, [selectedDate]);

  useEffect(() => {
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) router.push("/");
    };
    check();
    fetchData();
  }, [router, fetchData]);

  const addReservation = async () => {
    if (!newCustName.trim() || !newTherapistId) { setMsg("顧客名とセラピストを選択してください"); return; }
    setSaving(true); setMsg("");
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("reservations").insert({
      customer_name: newCustName.trim(), therapist_id: newTherapistId,
      date: newDate || selectedDate, start_time: newStart, end_time: newEnd,
      course: newCourse.trim(), notes: newNotes.trim(), user_id: user?.id,
    });
    setSaving(false);
    if (error) { setMsg("登録失敗: " + error.message); }
    else {
      setMsg("予約を登録しました！");
      setNewCustName(""); setNewTherapistId(0); setNewCourse(""); setNewNotes("");
      setNewStart("10:00"); setNewEnd("11:00");
      fetchData();
      setTimeout(() => { setShowNewRes(false); setMsg(""); }, 800);
    }
  };

  const addTherapist = async () => {
    if (!tName.trim()) return;
    await supabase.from("therapists").insert({ name: tName.trim(), phone: tPhone.trim(), status: "active" });
    setTName(""); setTPhone("");
    setShowNewTherapist(false);
    fetchData();
  };

  const deleteReservation = async (id: number) => {
    if (!confirm("この予約を削除しますか？")) return;
    await supabase.from("reservations").delete().eq("id", id);
    fetchData();
  };

  const getResForCell = (therapistId: number, hour: number) => {
    return reservations.filter((r) => {
      const startH = parseInt(r.start_time.split(":")[0]);
      const endH = parseInt(r.end_time.split(":")[0]);
      return r.therapist_id === therapistId && hour >= startH && hour < endH;
    });
  };

  const getResSpan = (r: Reservation) => {
    const startH = parseInt(r.start_time.split(":")[0]);
    const endH = parseInt(r.end_time.split(":")[0]);
    return endH - startH;
  };

  const isStartHour = (r: Reservation, hour: number) => {
    return parseInt(r.start_time.split(":")[0]) === hour;
  };

  const prevDay = () => {
    const d = new Date(selectedDate); d.setDate(d.getDate() - 1);
    setSelectedDate(d.toISOString().split("T")[0]);
  };
  const nextDay = () => {
    const d = new Date(selectedDate); d.setDate(d.getDate() + 1);
    setSelectedDate(d.toISOString().split("T")[0]);
  };
  const today = () => setSelectedDate(new Date().toISOString().split("T")[0]);

  const dateDisplay = (() => {
    const d = new Date(selectedDate + "T00:00:00");
    const days = ["日", "月", "火", "水", "木", "金", "土"];
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日（${days[d.getDay()]}）`;
  })();

  const colors = ["#c3a782", "#7ab88f", "#85a8c4", "#c49885", "#a885c4", "#85c4b8", "#c4a685", "#8599c4"];

  return (
    <div className="h-screen flex flex-col bg-[#f8f6f3]">
      {/* Header */}
      <div className="h-[64px] bg-white/80 backdrop-blur-xl border-b border-[#e8e4df] flex items-center justify-between px-6 flex-shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push("/dashboard")} className="p-2 rounded-lg hover:bg-[#f8f6f3] transition-colors cursor-pointer">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9c9a92" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <h1 className="text-[15px] font-medium text-[#2c2c2a]">タイムチャート</h1>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => { setShowNewTherapist(true); }} className="px-4 py-2 border border-[#e8e4df] text-[#888780] text-[11px] rounded-xl hover:bg-[#f8f6f3] transition-colors cursor-pointer">+ セラピスト追加</button>
          <button onClick={() => { setShowNewRes(true); setNewDate(selectedDate); }} className="px-4 py-2 bg-gradient-to-r from-[#c3a782] to-[#b09672] text-white text-[11px] rounded-xl hover:shadow-[0_4px_16px_rgba(195,167,130,0.25)] transition-all cursor-pointer">+ 予約追加</button>
        </div>
      </div>

      {/* Date Nav */}
      <div className="h-[52px] bg-white border-b border-[#e8e4df] flex items-center justify-center gap-4 flex-shrink-0">
        <button onClick={prevDay} className="p-1.5 rounded-lg hover:bg-[#f8f6f3] transition-colors cursor-pointer">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#888780" strokeWidth="1.5"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <button onClick={today} className="px-3 py-1 text-[11px] text-[#888780] border border-[#e8e4df] rounded-lg hover:bg-[#f8f6f3] cursor-pointer">今日</button>
        <span className="text-[14px] font-medium text-[#2c2c2a] min-w-[200px] text-center">{dateDisplay}</span>
        <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)}
          className="text-[12px] text-[#888780] border border-[#e8e4df] rounded-lg px-2 py-1 outline-none cursor-pointer" />
        <button onClick={nextDay} className="p-1.5 rounded-lg hover:bg-[#f8f6f3] transition-colors cursor-pointer">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#888780" strokeWidth="1.5"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>

      {/* Chart */}
      <div className="flex-1 overflow-auto">
        {therapists.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#e0dbd2" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            <p className="text-[14px] text-[#b4b2a9] mt-4">セラピストが登録されていません</p>
            <button onClick={() => setShowNewTherapist(true)} className="mt-4 px-5 py-2.5 bg-gradient-to-r from-[#c3a782] to-[#b09672] text-white text-[12px] rounded-xl cursor-pointer">+ セラピストを追加</button>
          </div>
        ) : (
          <div className="min-w-[800px]">
            <table className="w-full border-collapse">
              <thead className="sticky top-0 z-10">
                <tr>
                  <th className="w-[120px] bg-[#f0ece4] border-b border-r border-[#e8e4df] p-3 text-[11px] text-[#888780] font-normal text-left sticky left-0 z-20">セラピスト</th>
                  {HOURS.map((h) => (
                    <th key={h} className="bg-[#f0ece4] border-b border-r border-[#e8e4df] p-2 text-[11px] text-[#888780] font-normal min-w-[80px]">{h}:00</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {therapists.map((t, ti) => (
                  <tr key={t.id} className="hover:bg-[#faf9f7]">
                    <td className="bg-white border-b border-r border-[#e8e4df] p-3 sticky left-0 z-10">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] text-white font-medium flex-shrink-0" style={{ backgroundColor: colors[ti % colors.length] }}>
                          {t.name.charAt(0)}
                        </div>
                        <span className="text-[12px] text-[#2c2c2a] font-medium truncate">{t.name}</span>
                      </div>
                    </td>
                    {HOURS.map((h) => {
                      const cellRes = getResForCell(t.id, h);
                      const startRes = cellRes.find((r) => isStartHour(r, h));
                      if (cellRes.length > 0 && !startRes) return null;
                      return (
                        <td key={h}
                          colSpan={startRes ? getResSpan(startRes) : 1}
                          className={`border-b border-r border-[#e8e4df] p-1 ${!startRes ? "bg-white cursor-pointer hover:bg-[#f8f6f3]" : ""}`}
                          onClick={() => {
                            if (!startRes) {
                              setShowNewRes(true);
                              setNewDate(selectedDate);
                              setNewTherapistId(t.id);
                              setNewStart(`${h}:00`);
                              setNewEnd(`${h + 1}:00`);
                            }
                          }}
                        >
                          {startRes && (
                            <div className="rounded-lg p-2 h-full min-h-[48px] relative group cursor-default" style={{ backgroundColor: colors[ti % colors.length] + "18", borderLeft: `3px solid ${colors[ti % colors.length]}` }}>
                              <p className="text-[11px] font-medium text-[#2c2c2a] truncate">{startRes.customer_name}</p>
                              <p className="text-[10px] text-[#888780] truncate">{startRes.course || startRes.start_time + "〜" + startRes.end_time}</p>
                              <button onClick={(e) => { e.stopPropagation(); deleteReservation(startRes.id); }}
                                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-white/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer hover:bg-red-50">
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#c45555" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                              </button>
                            </div>
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

      {/* New Reservation Modal */}
      {showNewRes && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowNewRes(false)}>
          <div className="bg-white rounded-2xl border border-[#f0ece4] p-8 w-full max-w-md animate-[fadeIn_0.25s_ease-out]" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-[16px] font-medium text-[#2c2c2a] mb-1">予約追加</h2>
            <p className="text-[11px] text-[#d3d1c7] mb-6">新しい予約を登録します</p>
            <div className="space-y-4">
              <div>
                <label className="block text-[11px] text-[#888780] mb-1.5">顧客名 <span className="text-[#c49885]">*</span></label>
                <input type="text" value={newCustName} onChange={(e) => setNewCustName(e.target.value)} placeholder="お客様の名前"
                  className="w-full px-4 py-3 bg-[#f8f6f3] border border-transparent rounded-xl text-[13px] outline-none focus:border-[#c3a782]/30 focus:bg-white transition-all placeholder-[#d3d1c7]" />
              </div>
              <div>
                <label className="block text-[11px] text-[#888780] mb-1.5">セラピスト <span className="text-[#c49885]">*</span></label>
                <select value={newTherapistId} onChange={(e) => setNewTherapistId(Number(e.target.value))}
                  className="w-full px-4 py-3 bg-[#f8f6f3] border border-transparent rounded-xl text-[13px] outline-none focus:border-[#c3a782]/30 focus:bg-white transition-all cursor-pointer">
                  <option value={0}>選択してください</option>
                  {therapists.map((t) => (<option key={t.id} value={t.id}>{t.name}</option>))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] text-[#888780] mb-1.5">日付</label>
                <input type="date" value={newDate || selectedDate} onChange={(e) => setNewDate(e.target.value)}
                  className="w-full px-4 py-3 bg-[#f8f6f3] border border-transparent rounded-xl text-[13px] outline-none focus:border-[#c3a782]/30 focus:bg-white transition-all cursor-pointer" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-[#888780] mb-1.5">開始時間</label>
                  <select value={newStart} onChange={(e) => setNewStart(e.target.value)}
                    className="w-full px-4 py-3 bg-[#f8f6f3] border border-transparent rounded-xl text-[13px] outline-none focus:border-[#c3a782]/30 focus:bg-white transition-all cursor-pointer">
                    {HOURS.map((h) => (<option key={h} value={`${h}:00`}>{h}:00</option>))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] text-[#888780] mb-1.5">終了時間</label>
                  <select value={newEnd} onChange={(e) => setNewEnd(e.target.value)}
                    className="w-full px-4 py-3 bg-[#f8f6f3] border border-transparent rounded-xl text-[13px] outline-none focus:border-[#c3a782]/30 focus:bg-white transition-all cursor-pointer">
                    {HOURS.map((h) => (<option key={h + 1} value={`${h + 1}:00`}>{h + 1}:00</option>))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[11px] text-[#888780] mb-1.5">コース</label>
                <input type="text" value={newCourse} onChange={(e) => setNewCourse(e.target.value)} placeholder="コース名"
                  className="w-full px-4 py-3 bg-[#f8f6f3] border border-transparent rounded-xl text-[13px] outline-none focus:border-[#c3a782]/30 focus:bg-white transition-all placeholder-[#d3d1c7]" />
              </div>
              <div>
                <label className="block text-[11px] text-[#888780] mb-1.5">備考</label>
                <input type="text" value={newNotes} onChange={(e) => setNewNotes(e.target.value)} placeholder="メモ"
                  className="w-full px-4 py-3 bg-[#f8f6f3] border border-transparent rounded-xl text-[13px] outline-none focus:border-[#c3a782]/30 focus:bg-white transition-all placeholder-[#d3d1c7]" />
              </div>
              {msg && <div className={`px-4 py-3 rounded-xl text-[12px] ${msg.includes("失敗") || msg.includes("選択") ? "bg-[#c49885]/10 text-[#c49885]" : "bg-[#7ab88f]/10 text-[#5a9e6f]"}`}>{msg}</div>}
              <div className="flex gap-3 pt-2">
                <button onClick={addReservation} disabled={saving} className="px-7 py-3 bg-gradient-to-r from-[#c3a782] to-[#b09672] text-white text-[12px] rounded-xl hover:shadow-[0_4px_16px_rgba(195,167,130,0.25)] transition-all cursor-pointer disabled:opacity-60">{saving ? "登録中..." : "予約する"}</button>
                <button onClick={() => { setShowNewRes(false); setMsg(""); }} className="px-7 py-3 border border-[#f0ece4] text-[#888780] text-[12px] rounded-xl hover:bg-[#f8f6f3] transition-all cursor-pointer">キャンセル</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New Therapist Modal */}
      {showNewTherapist && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowNewTherapist(false)}>
          <div className="bg-white rounded-2xl border border-[#f0ece4] p-8 w-full max-w-sm animate-[fadeIn_0.25s_ease-out]" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-[16px] font-medium text-[#2c2c2a] mb-1">セラピスト追加</h2>
            <p className="text-[11px] text-[#d3d1c7] mb-6">新しいセラピストを登録します</p>
            <div className="space-y-4">
              <div>
                <label className="block text-[11px] text-[#888780] mb-1.5">名前 <span className="text-[#c49885]">*</span></label>
                <input type="text" value={tName} onChange={(e) => setTName(e.target.value)} placeholder="セラピスト名"
                  className="w-full px-4 py-3 bg-[#f8f6f3] border border-transparent rounded-xl text-[13px] outline-none focus:border-[#c3a782]/30 focus:bg-white transition-all placeholder-[#d3d1c7]" />
              </div>
              <div>
                <label className="block text-[11px] text-[#888780] mb-1.5">電話番号</label>
                <input type="tel" value={tPhone} onChange={(e) => setTPhone(e.target.value)} placeholder="090-xxxx-xxxx"
                  className="w-full px-4 py-3 bg-[#f8f6f3] border border-transparent rounded-xl text-[13px] outline-none focus:border-[#c3a782]/30 focus:bg-white transition-all placeholder-[#d3d1c7]" />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={addTherapist} className="px-7 py-3 bg-gradient-to-r from-[#c3a782] to-[#b09672] text-white text-[12px] rounded-xl hover:shadow-[0_4px_16px_rgba(195,167,130,0.25)] transition-all cursor-pointer">登録する</button>
                <button onClick={() => setShowNewTherapist(false)} className="px-7 py-3 border border-[#f0ece4] text-[#888780] text-[12px] rounded-xl hover:bg-[#f8f6f3] transition-all cursor-pointer">キャンセル</button>
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
