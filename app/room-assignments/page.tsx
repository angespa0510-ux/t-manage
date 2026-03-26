"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";

type Store = { id: number; name: string };
type Building = { id: number; store_id: number; name: string };
type Room = { id: number; store_id: number; building_id: number; name: string };
type Therapist = { id: number; name: string };
type Shift = { id: number; therapist_id: number; store_id: number; date: string; start_time: string; end_time: string; status: string };
type RoomAssignment = { id: number; date: string; room_id: number; slot: string; therapist_id: number; start_time: string; end_time: string };

export default function RoomAssignments() {
  const router = useRouter();
  const [stores, setStores] = useState<Store[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [allShifts, setAllShifts] = useState<Shift[]>([]);
  const [allAssignments, setAllAssignments] = useState<RoomAssignment[]>([]);

  const [currentMonth, setCurrentMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [expandedDay, setExpandedDay] = useState<string>(new Date().toISOString().split("T")[0]);

  const [year, month] = currentMonth.split("-").map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const allDates = Array.from({ length: daysInMonth }, (_, i) => {
    return `${year}-${String(month).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`;
  });

  const fetchData = useCallback(async () => {
    const { data: st } = await supabase.from("stores").select("*").order("id");
    if (st) setStores(st);
    const { data: b } = await supabase.from("buildings").select("*").order("id");
    if (b) setBuildings(b);
    const { data: r } = await supabase.from("rooms").select("*").order("id");
    if (r) setRooms(r);
    const { data: t } = await supabase.from("therapists").select("*").order("id");
    if (t) setTherapists(t);
    const startDate = `${currentMonth}-01`;
    const endDate = `${currentMonth}-${String(daysInMonth).padStart(2, "0")}`;
    const { data: sh } = await supabase.from("shifts").select("*").gte("date", startDate).lte("date", endDate).eq("status", "confirmed").order("start_time");
    if (sh) setAllShifts(sh);
    const { data: a } = await supabase.from("room_assignments").select("*").gte("date", startDate).lte("date", endDate).order("room_id");
    if (a) setAllAssignments(a);
  }, [currentMonth, daysInMonth]);

  useEffect(() => {
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) router.push("/");
    };
    check();
    fetchData();
  }, [router, fetchData]);

  const getTherapistName = (id: number) => therapists.find((t) => t.id === id)?.name || "";
  const getBuildingName = (id: number) => buildings.find((b) => b.id === id)?.name || "";
  const getShiftsForDate = (date: string) => allShifts.filter((s) => s.date === date);
  const getAssignmentsForDate = (date: string) => allAssignments.filter((a) => a.date === date);
  const getAssignment = (date: string, roomId: number, slot: string) => allAssignments.find((a) => a.date === date && a.room_id === roomId && a.slot === slot);

  const assignTherapist = async (date: string, roomId: number, slot: string, therapistId: number) => {
    const existing = getAssignment(date, roomId, slot);
    if (therapistId === 0) {
      if (existing) await supabase.from("room_assignments").delete().eq("id", existing.id);
    } else {
      const shift = allShifts.find((s) => s.therapist_id === therapistId && s.date === date);
      const startTime = shift?.start_time || (slot === "early" ? "12:00" : "18:00");
      const endTime = shift?.end_time || (slot === "early" ? "18:00" : "03:00");
      if (existing) {
        await supabase.from("room_assignments").update({ therapist_id: therapistId, start_time: startTime, end_time: endTime }).eq("id", existing.id);
      } else {
        await supabase.from("room_assignments").insert({ date, room_id: roomId, slot, therapist_id: therapistId, start_time: startTime, end_time: endTime });
      }
    }
    fetchData();
  };

  const updateTime = async (id: number, field: "start_time" | "end_time", value: string) => {
    await supabase.from("room_assignments").update({ [field]: value }).eq("id", id);
    fetchData();
  };

  const autoAssign = async (date: string) => {
    if (!confirm(`${date} のシフトから自動割当しますか？`)) return;
    const dayAssignments = getAssignmentsForDate(date);
    if (dayAssignments.length > 0) {
      await supabase.from("room_assignments").delete().in("id", dayAssignments.map((a) => a.id));
    }
    const dayShifts = getShiftsForDate(date);
    const earlyShifts = dayShifts.filter((s) => { const h = parseInt(s.start_time.split(":")[0]); return h < 18; });
    const lateShifts = dayShifts.filter((s) => { const h = parseInt(s.start_time.split(":")[0]); return h >= 18; });
    const usedE = new Set<number>();
    const usedL = new Set<number>();
    for (const room of rooms) {
      const eShift = earlyShifts.find((s) => !usedE.has(s.therapist_id) && buildings.find((b) => b.id === room.building_id)?.store_id === s.store_id);
      if (eShift) {
        usedE.add(eShift.therapist_id);
        await supabase.from("room_assignments").insert({ date, room_id: room.id, slot: "early", therapist_id: eShift.therapist_id, start_time: eShift.start_time, end_time: eShift.end_time });
      }
      const lShift = lateShifts.find((s) => !usedL.has(s.therapist_id) && buildings.find((b) => b.id === room.building_id)?.store_id === s.store_id);
      if (lShift) {
        usedL.add(lShift.therapist_id);
        await supabase.from("room_assignments").insert({ date, room_id: room.id, slot: "late", therapist_id: lShift.therapist_id, start_time: lShift.start_time, end_time: lShift.end_time });
      }
    }
    fetchData();
  };

  const prevMonth = () => {
    const d = new Date(year, month - 2, 1);
    setCurrentMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };
  const nextMonth = () => {
    const d = new Date(year, month, 1);
    setCurrentMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };

  const formatDay = (date: string) => {
    const d = new Date(date + "T00:00:00");
    const days = ["日", "月", "火", "水", "木", "金", "土"];
    return { day: d.getDate(), dow: days[d.getDay()], isSun: d.getDay() === 0, isSat: d.getDay() === 6, isToday: date === new Date().toISOString().split("T")[0] };
  };

  const colors = ["#c3a782", "#7ab88f", "#85a8c4", "#c49885", "#a885c4"];
  const TIMES = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00", "21:00", "22:00", "23:00", "00:00", "01:00", "02:00", "03:00"];

  return (
    <div className="h-screen flex flex-col bg-[#f8f6f3]">
      {/* Header */}
      <div className="h-[64px] bg-white/80 backdrop-blur-xl border-b border-[#e8e4df] flex items-center justify-between px-6 flex-shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push("/dashboard")} className="p-2 rounded-lg hover:bg-[#f8f6f3] transition-colors cursor-pointer">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9c9a92" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <h1 className="text-[15px] font-medium text-[#2c2c2a]">部屋割り管理</h1>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/rooms")} className="px-4 py-2 border border-[#e8e4df] text-[#888780] text-[11px] rounded-xl hover:bg-[#f8f6f3] transition-colors cursor-pointer">利用場所設定</button>
          <button onClick={() => router.push("/shifts")} className="px-4 py-2 border border-[#e8e4df] text-[#888780] text-[11px] rounded-xl hover:bg-[#f8f6f3] transition-colors cursor-pointer">シフト管理</button>
        </div>
      </div>

      {/* Month Nav */}
      <div className="h-[52px] bg-white border-b border-[#e8e4df] flex items-center justify-center gap-4 flex-shrink-0">
        <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-[#f8f6f3] transition-colors cursor-pointer">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#888780" strokeWidth="1.5"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <button onClick={() => { setCurrentMonth(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`); setExpandedDay(new Date().toISOString().split("T")[0]); }}
          className="px-3 py-1 text-[11px] text-[#888780] border border-[#e8e4df] rounded-lg hover:bg-[#f8f6f3] cursor-pointer">今月</button>
        <span className="text-[16px] font-medium text-[#2c2c2a] min-w-[140px] text-center">{year}年{month}月</span>
        <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-[#f8f6f3] transition-colors cursor-pointer">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#888780" strokeWidth="1.5"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>

      {/* Calendar */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[1000px] mx-auto py-4 px-4">
          {allDates.map((date) => {
            const f = formatDay(date);
            const dayShifts = getShiftsForDate(date);
            const dayAssignments = getAssignmentsForDate(date);
            const isExpanded = expandedDay === date;

            return (
              <div key={date} className={`mb-1 rounded-xl overflow-hidden border transition-all ${isExpanded ? "border-[#c3a782]/30 shadow-[0_4px_20px_rgba(0,0,0,0.04)]" : "border-transparent hover:border-[#f0ece4]"}`}>
                {/* Day Header */}
                <button onClick={() => setExpandedDay(isExpanded ? "" : date)}
                  className={`w-full flex items-center justify-between px-5 py-3 cursor-pointer transition-all ${isExpanded ? "bg-white" : "hover:bg-white/60"} ${f.isToday ? "bg-[#c3a782]/[0.05]" : ""}`}>
                  <div className="flex items-center gap-3">
                    <span className={`text-[15px] font-medium w-[28px] ${f.isToday ? "text-[#c3a782]" : f.isSun ? "text-[#c45555]" : f.isSat ? "text-[#3d6b9f]" : "text-[#2c2c2a]"}`}>{f.day}</span>
                    <span className={`text-[12px] ${f.isSun ? "text-[#c45555]" : f.isSat ? "text-[#3d6b9f]" : "text-[#b4b2a9]"}`}>({f.dow})</span>
                    {f.isToday && <span className="px-2 py-0.5 bg-[#c3a782] text-white text-[9px] rounded-full">今日</span>}
                    <span className="text-[11px] text-[#b4b2a9] ml-2">出勤:{dayShifts.length}名</span>
                    {dayAssignments.length > 0 && <span className="text-[11px] text-[#7ab88f] ml-1">割当:{dayAssignments.length}</span>}
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d3d1c7" strokeWidth="2" className={`transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}><polyline points="6 9 12 15 18 9"/></svg>
                </button>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="bg-white px-5 pb-5 animate-[fadeIn_0.3s_ease-out]">
                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 mb-4 pt-2">
                      <button onClick={() => autoAssign(date)} className="px-3 py-1.5 bg-gradient-to-r from-[#c3a782] to-[#b09672] text-white text-[10px] rounded-lg cursor-pointer">シフトから自動割当</button>
                    </div>

                    {/* Working Therapists */}
                    <div className="mb-4 p-3 bg-[#f8f6f3] rounded-xl">
                      <p className="text-[10px] text-[#b4b2a9] mb-2">出勤セラピスト</p>
                      {dayShifts.length === 0 ? (
                        <p className="text-[11px] text-[#d3d1c7]">シフトが登録されていません</p>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {dayShifts.map((s) => {
                            const assigned = dayAssignments.some((a) => a.therapist_id === s.therapist_id);
                            return (
                              <span key={s.id} className={`px-2 py-1 rounded-md text-[10px] font-medium ${assigned ? "bg-[#e8f0ea] text-[#4a7c59]" : "bg-[#faeeda] text-[#854f0b]"}`}>
                                {getTherapistName(s.therapist_id)} {s.start_time}〜{s.end_time}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Room Cards grouped by Store > Building */}
                    {stores.map((store, si) => {
                      const sBuildings = buildings.filter((b) => b.store_id === store.id);
                      const hasRooms = sBuildings.some((b) => rooms.filter((r) => r.building_id === b.id).length > 0);
                      if (!hasRooms) return null;
                      return (
                        <div key={store.id} className="mb-4">
                          {sBuildings.map((building, bi) => {
                            const bRooms = rooms.filter((r) => r.building_id === building.id);
                            if (bRooms.length === 0) return null;
                            return (
                              <div key={building.id} className="mb-3">
                                <div className="flex items-center gap-2 mb-2">
                                  <div className="w-1 h-4 rounded-full" style={{ backgroundColor: colors[si % colors.length] }} />
                                  <span className="text-[12px] font-medium text-[#2c2c2a]">{store.name}</span>
                                  <span className="text-[12px] text-[#888780]">{building.name}</span>
                                </div>
                                <div className="space-y-1.5">
                                  {bRooms.map((room) => {
                                    const earlyA = getAssignment(date, room.id, "early");
                                    const lateA = getAssignment(date, room.id, "late");
                                    return (
                                      <div key={room.id} className="flex items-stretch gap-2 bg-[#f8f6f3] rounded-xl p-2">
                                        {/* Room Number */}
                                        <div className="w-[52px] rounded-lg flex items-center justify-center flex-shrink-0 font-medium text-[14px]" style={{ backgroundColor: colors[si % colors.length] + "18", color: colors[si % colors.length] }}>
                                          {room.name}
                                        </div>

                                        {/* Early Slot */}
                                        <div className={`flex-1 rounded-lg p-2 border ${earlyA ? "border-[#7ab88f]/30 bg-[#e8f0ea]/30" : "border-[#e8e4df] bg-white"}`}>
                                          <div className="flex items-center gap-2">
                                            <span className="text-[8px] text-[#7ab88f] font-medium tracking-wide">早番</span>
                                            <select value={earlyA?.therapist_id || 0} onChange={(e) => assignTherapist(date, room.id, "early", Number(e.target.value))}
                                              className="flex-1 px-2 py-1 bg-transparent border-none text-[11px] outline-none cursor-pointer text-[#2c2c2a]">
                                              <option value={0}>—</option>
                                              {dayShifts.map((s) => (
                                                <option key={s.therapist_id} value={s.therapist_id}>{getTherapistName(s.therapist_id)}</option>
                                              ))}
                                            </select>
                                          </div>
                                          {earlyA && (
                                            <div className="flex items-center gap-1 mt-1">
                                              <select value={earlyA.start_time} onChange={(e) => updateTime(earlyA.id, "start_time", e.target.value)}
                                                className="px-1 py-0.5 bg-white rounded text-[9px] outline-none cursor-pointer text-[#888780] border border-[#e8e4df]">
                                                {TIMES.map((t) => (<option key={t} value={t}>{t}</option>))}
                                              </select>
                                              <span className="text-[9px] text-[#d3d1c7]">〜</span>
                                              <select value={earlyA.end_time} onChange={(e) => updateTime(earlyA.id, "end_time", e.target.value)}
                                                className="px-1 py-0.5 bg-white rounded text-[9px] outline-none cursor-pointer text-[#888780] border border-[#e8e4df]">
                                                {TIMES.map((t) => (<option key={t} value={t}>{t}</option>))}
                                              </select>
                                            </div>
                                          )}
                                        </div>

                                        {/* Late Slot */}
                                        <div className={`flex-1 rounded-lg p-2 border ${lateA ? "border-[#c49885]/30 bg-[#fceee8]/30" : "border-[#e8e4df] bg-white"}`}>
                                          <div className="flex items-center gap-2">
                                            <span className="text-[8px] text-[#c49885] font-medium tracking-wide">遅番</span>
                                            <select value={lateA?.therapist_id || 0} onChange={(e) => assignTherapist(date, room.id, "late", Number(e.target.value))}
                                              className="flex-1 px-2 py-1 bg-transparent border-none text-[11px] outline-none cursor-pointer text-[#2c2c2a]">
                                              <option value={0}>—</option>
                                              {dayShifts.map((s) => (
                                                <option key={s.therapist_id} value={s.therapist_id}>{getTherapistName(s.therapist_id)}</option>
                                              ))}
                                            </select>
                                          </div>
                                          {lateA && (
                                            <div className="flex items-center gap-1 mt-1">
                                              <select value={lateA.start_time} onChange={(e) => updateTime(lateA.id, "start_time", e.target.value)}
                                                className="px-1 py-0.5 bg-white rounded text-[9px] outline-none cursor-pointer text-[#888780] border border-[#e8e4df]">
                                                {TIMES.map((t) => (<option key={t} value={t}>{t}</option>))}
                                              </select>
                                              <span className="text-[9px] text-[#d3d1c7]">〜</span>
                                              <select value={lateA.end_time} onChange={(e) => updateTime(lateA.id, "end_time", e.target.value)}
                                                className="px-1 py-0.5 bg-white rounded text-[9px] outline-none cursor-pointer text-[#888780] border border-[#e8e4df]">
                                                {TIMES.map((t) => (<option key={t} value={t}>{t}</option>))}
                                              </select>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}

                    {/* Unassigned Therapists */}
                    {(() => {
                      const assignedIds = dayAssignments.map((a) => a.therapist_id);
                      const unassigned = dayShifts.filter((s) => !assignedIds.includes(s.therapist_id));
                      if (unassigned.length === 0) return null;
                      return (
                        <div className="mt-3 p-3 bg-[#faeeda] rounded-xl">
                          <p className="text-[10px] text-[#854f0b] mb-2 font-medium">未割当セラピスト</p>
                          <div className="flex flex-wrap gap-1.5">
                            {unassigned.map((s) => (
                              <span key={s.id} className="px-2 py-1 bg-white rounded-md text-[10px] text-[#854f0b]">
                                {getTherapistName(s.therapist_id)} {s.start_time}〜{s.end_time}
                              </span>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
