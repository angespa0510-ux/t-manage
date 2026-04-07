"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";
import { useTheme } from "../../lib/theme";
import { NavMenu } from "../../lib/nav-menu";
import { useStaffSession } from "../../lib/staff-session";

type StaffMember = { id: number; name: string; role: string; unit_price: number; transport_fee: number; status: string };
type StaffSchedule = { id: number; staff_id: number; date: string; start_time: string; end_time: string; unit_price: number; units: number; commission_fee: number; transport_fee: number; total_payment: number; status: string; notes: string; is_checked: boolean; checked_by: string; clock_in_time: string; clock_out_time: string; break_minutes: number };

const TIMES: string[] = [];
for (let h = 6; h <= 23; h++) { for (const m of ["00", "15", "30", "45"]) TIMES.push(`${String(h).padStart(2, "0")}:${m}`); }
const BREAK_OPTS = [0, 15, 30, 45, 60, 75, 90, 105, 120];

function getWeekDates(baseDate: Date): string[] {
  const d = new Date(baseDate);
  const dow = d.getDay();
  const mon = new Date(d);
  mon.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const dt = new Date(mon);
    dt.setDate(mon.getDate() + i);
    dates.push(dt.toISOString().split("T")[0]);
  }
  return dates;
}

function formatDay(d: string): { label: string; dow: string; isSun: boolean; isSat: boolean; isToday: boolean } {
  const dt = new Date(d + "T00:00:00");
  const days = ["日", "月", "火", "水", "木", "金", "土"];
  const today = new Date().toISOString().split("T")[0];
  return { label: `${dt.getMonth() + 1}/${dt.getDate()}`, dow: days[dt.getDay()], isSun: dt.getDay() === 0, isSat: dt.getDay() === 6, isToday: d === today };
}

function calcUnits(start: string, end: string, breakMin: number = 0): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const diff = (eh * 60 + em) - (sh * 60 + sm) - breakMin;
  return Math.max(0, Math.floor(diff / 15) * 0.25);
}

export default function StaffAttendance() {
  const router = useRouter();
  const { dark, toggle, T } = useTheme();
  const { activeStaff, isManager, login, logout } = useStaffSession();
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [schedules, setSchedules] = useState<StaffSchedule[]>([]);
  const [weekBase, setWeekBase] = useState(() => new Date());
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState("");
  const [editingCell, setEditingCell] = useState<string | null>(null);

  const weekDates = getWeekDates(weekBase);
  const startDate = weekDates[0];
  const endDate = weekDates[6];

  const fetchData = useCallback(async () => {
    const { data: stf } = await supabase.from("staff").select("*").eq("status", "active").order("id");
    if (stf) setStaffList(stf);
    const { data: sch } = await supabase.from("staff_schedules").select("*").gte("date", startDate).lte("date", endDate).order("date");
    if (sch) setSchedules(sch);
  }, [startDate, endDate]);

  useEffect(() => {
    const check = async () => { const { data: { user } } = await supabase.auth.getUser(); if (!user) router.push("/"); };
    check(); fetchData();
  }, [router, fetchData]);

  useEffect(() => {
    const ch = supabase.channel("staff-att-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "staff_schedules" }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchData]);

  const prevWeek = () => { const d = new Date(weekBase); d.setDate(d.getDate() - 7); setWeekBase(d); };
  const nextWeek = () => { const d = new Date(weekBase); d.setDate(d.getDate() + 7); setWeekBase(d); };
  const goThisWeek = () => setWeekBase(new Date());

  const getSch = (staffId: number, date: string) => schedules.find(s => s.staff_id === staffId && s.date === date);

  const addSchedule = async (staffId: number, date: string) => {
    const staff = staffList.find(s => s.id === staffId);
    if (!staff) return;
    const up = staff.unit_price || 1200;
    const units = calcUnits("10:00", "19:00");
    const comm = Math.round(up * units);
    const tr = staff.transport_fee || 0;
    await supabase.from("staff_schedules").insert({
      staff_id: staffId, date, start_time: "10:00", end_time: "19:00",
      unit_price: up, units, commission_fee: comm, transport_fee: tr, total_payment: comm + tr,
      status: "scheduled", notes: ""
    });
    fetchData();
  };

  const removeSchedule = async (id: number) => {
    if (!confirm("このスケジュールを削除しますか？")) return;
    await supabase.from("staff_schedules").delete().eq("id", id);
    fetchData();
  };

  const updateTime = async (id: number, field: "start_time" | "end_time", value: string, sch: StaffSchedule) => {
    const newStart = field === "start_time" ? value : sch.start_time;
    const newEnd = field === "end_time" ? value : sch.end_time;
    const staff = staffList.find(s => s.id === sch.staff_id);
    const up = staff?.unit_price || sch.unit_price;
    const units = calcUnits(newStart, newEnd, sch.break_minutes || 0);
    const comm = Math.round(up * units);
    const tr = staff?.transport_fee || sch.transport_fee;
    await supabase.from("staff_schedules").update({ [field]: value, units, commission_fee: comm, total_payment: comm + tr }).eq("id", id);
    fetchData();
  };

  const updateBreak = async (id: number, breakMin: number, sch: StaffSchedule) => {
    const staff = staffList.find(s => s.id === sch.staff_id);
    const up = staff?.unit_price || sch.unit_price;
    const units = calcUnits(sch.start_time, sch.end_time, breakMin);
    const comm = Math.round(up * units);
    const tr = staff?.transport_fee || sch.transport_fee;
    await supabase.from("staff_schedules").update({ break_minutes: breakMin, units, commission_fee: comm, total_payment: comm + tr }).eq("id", id);
    fetchData();
  };

  const clockIn = async (id: number) => {
    const now = new Date();
    const t = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    await supabase.from("staff_schedules").update({ clock_in_time: t }).eq("id", id);
    fetchData();
  };

  const clockOut = async (id: number) => {
    const now = new Date();
    const t = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    await supabase.from("staff_schedules").update({ clock_out_time: t, status: "completed" }).eq("id", id);
    fetchData();
  };

  const managerCheck = async (id: number) => {
    if (!isManager) return;
    await supabase.from("staff_schedules").update({ is_checked: true, checked_by: activeStaff?.name || "manager" }).eq("id", id);
    fetchData();
  };

  const undoCheck = async (id: number) => {
    if (!isManager) return;
    await supabase.from("staff_schedules").update({ is_checked: false, checked_by: "" }).eq("id", id);
    fetchData();
  };

  // 週間集計
  const getWeeklyTotal = (staffId: number) => {
    const staffScheds = schedules.filter(s => s.staff_id === staffId);
    const days = staffScheds.length;
    const totalUnits = staffScheds.reduce((s, x) => s + (x.units || 0), 0);
    const totalPay = staffScheds.reduce((s, x) => s + (x.total_payment || 0), 0);
    return { days, totalUnits, totalPay };
  };

  const weekLabel = (() => {
    const s = new Date(startDate + "T00:00:00");
    const e = new Date(endDate + "T00:00:00");
    return `${s.getMonth() + 1}/${s.getDate()} 〜 ${e.getMonth() + 1}/${e.getDate()}`;
  })();

  return (
    <div className="h-screen flex flex-col" style={{ backgroundColor: T.bg, color: T.text }}>
      {/* Header */}
      <div className="h-[56px] flex items-center justify-between px-4 flex-shrink-0 border-b" style={{ backgroundColor: T.card, borderColor: T.border }}>
        <div className="flex items-center gap-3">
          <NavMenu T={T} dark={dark} />
          <h1 className="text-[14px] font-medium">📊 スタッフ勤怠</h1>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={toggle} className="px-2.5 py-1.5 text-[10px] rounded-lg cursor-pointer border" style={{ borderColor: T.border, color: T.textSub }}>{dark ? "☀️" : "🌙"}</button>
          {activeStaff ? (
            <button onClick={logout} className="px-2.5 py-1.5 text-[10px] rounded-lg cursor-pointer font-medium" style={{ backgroundColor: activeStaff.role === "owner" ? "#c3a78222" : "#85a8c422", color: activeStaff.role === "owner" ? "#c3a782" : "#85a8c4", border: `1px solid ${activeStaff.role === "owner" ? "#c3a78244" : "#85a8c444"}` }}>👤 {activeStaff.name} ✕</button>
          ) : (
            <button onClick={() => { setShowPinModal(true); setPinInput(""); setPinError(""); }} className="px-2.5 py-1.5 text-[10px] rounded-lg cursor-pointer font-medium" style={{ backgroundColor: "#a855f718", color: "#a855f7", border: "1px solid #a855f744" }}>🔑 ログイン</button>
          )}
        </div>
      </div>

      {/* Week Nav */}
      <div className="h-[48px] flex items-center justify-center gap-4 flex-shrink-0 border-b" style={{ backgroundColor: T.card, borderColor: T.border }}>
        <button onClick={prevWeek} className="p-1.5 rounded-lg cursor-pointer" style={{ color: T.textSub }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="15 18 9 12 15 6"/></svg></button>
        <button onClick={goThisWeek} className="px-3 py-1 text-[11px] border rounded-lg cursor-pointer" style={{ borderColor: T.border, color: T.textSub }}>今週</button>
        <span className="text-[15px] font-medium min-w-[180px] text-center">{weekLabel}</span>
        <button onClick={nextWeek} className="p-1.5 rounded-lg cursor-pointer" style={{ color: T.textSub }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="9 18 15 12 9 6"/></svg></button>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <div className="min-w-[900px]">
          {/* Header row */}
          <div className="flex sticky top-0 z-10" style={{ backgroundColor: T.card, borderBottom: `1px solid ${T.border}` }}>
            <div className="w-[120px] flex-shrink-0 px-3 py-2 text-[11px] font-medium" style={{ color: T.textMuted, borderRight: `1px solid ${T.border}` }}>スタッフ</div>
            {weekDates.map(d => {
              const f = formatDay(d);
              return (
                <div key={d} className="flex-1 px-2 py-2 text-center" style={{ borderRight: `1px solid ${T.border}`, backgroundColor: f.isToday ? "#c3a78210" : "transparent" }}>
                  <div className="text-[12px] font-medium" style={{ color: f.isToday ? "#c3a782" : f.isSun ? "#c45555" : f.isSat ? "#3d6b9f" : T.text }}>{f.label}</div>
                  <div className="text-[10px]" style={{ color: f.isSun ? "#c45555" : f.isSat ? "#3d6b9f" : T.textMuted }}>({f.dow})</div>
                </div>
              );
            })}
            <div className="w-[100px] flex-shrink-0 px-2 py-2 text-center text-[11px] font-medium" style={{ color: T.textMuted }}>週間計</div>
          </div>

          {/* Staff rows */}
          {staffList.map(staff => {
            const wt = getWeeklyTotal(staff.id);
            return (
              <div key={staff.id} className="flex" style={{ borderBottom: `1px solid ${T.border}` }}>
                {/* Staff name */}
                <div className="w-[120px] flex-shrink-0 px-3 py-3 flex items-start" style={{ borderRight: `1px solid ${T.border}` }}>
                  <div>
                    <div className="text-[12px] font-medium">{staff.name}</div>
                    <div className="text-[9px] mt-0.5" style={{ color: T.textMuted }}>¥{staff.unit_price?.toLocaleString()}/u</div>
                  </div>
                </div>

                {/* Daily cells */}
                {weekDates.map(date => {
                  const sch = getSch(staff.id, date);
                  const f = formatDay(date);
                  const cellKey = `${staff.id}-${date}`;
                  const isEditing = editingCell === cellKey;
                  const locked = sch?.is_checked;

                  return (
                    <div key={date} className="flex-1 px-1.5 py-2 min-h-[80px]" style={{ borderRight: `1px solid ${T.border}`, backgroundColor: f.isToday ? "#c3a78208" : "transparent" }}>
                      {!sch ? (
                        <button onClick={() => addSchedule(staff.id, date)} className="w-full h-full flex items-center justify-center text-[18px] cursor-pointer rounded-lg opacity-30 hover:opacity-70 transition-opacity" style={{ background: "none", border: `1px dashed ${T.border}`, color: T.textMuted, minHeight: 60 }}>+</button>
                      ) : (
                        <div className="space-y-1" onClick={() => !locked && setEditingCell(isEditing ? null : cellKey)}>
                          {/* 予定時間 */}
                          {isEditing && !locked ? (
                            <div className="space-y-1">
                              <div className="flex items-center gap-0.5">
                                <select value={sch.start_time} onChange={e => { updateTime(sch.id, "start_time", e.target.value, sch); }} onClick={e => e.stopPropagation()} className="flex-1 px-1 py-0.5 rounded text-[9px] outline-none cursor-pointer border" style={{ backgroundColor: T.card, borderColor: T.border, color: T.text }}>{TIMES.map(t => <option key={t} value={t}>{t}</option>)}</select>
                                <span className="text-[8px]" style={{ color: T.textFaint }}>〜</span>
                                <select value={sch.end_time} onChange={e => { updateTime(sch.id, "end_time", e.target.value, sch); }} onClick={e => e.stopPropagation()} className="flex-1 px-1 py-0.5 rounded text-[9px] outline-none cursor-pointer border" style={{ backgroundColor: T.card, borderColor: T.border, color: T.text }}>{TIMES.map(t => <option key={t} value={t}>{t}</option>)}</select>
                              </div>
                              <select value={sch.break_minutes || 0} onChange={e => updateBreak(sch.id, parseInt(e.target.value), sch)} onClick={e => e.stopPropagation()} className="w-full px-1 py-0.5 rounded text-[8px] outline-none cursor-pointer border" style={{ backgroundColor: T.card, borderColor: (sch.break_minutes || 0) > 0 ? "#f59e0b44" : T.border, color: (sch.break_minutes || 0) > 0 ? "#f59e0b" : T.textMuted }}>{BREAK_OPTS.map(b => <option key={b} value={b}>{b === 0 ? "休憩なし" : `☕${b}分`}</option>)}</select>
                              <button onClick={e => { e.stopPropagation(); removeSchedule(sch.id); }} className="w-full text-[8px] py-0.5 rounded cursor-pointer" style={{ color: "#c45555", background: "none", border: `1px solid #c4555533` }}>削除</button>
                            </div>
                          ) : (
                            <>
                              <div className="text-[10px] font-medium text-center" style={{ color: T.text }}>{sch.start_time?.slice(0,5)}〜{sch.end_time?.slice(0,5)}</div>
                              {(sch.break_minutes || 0) > 0 && <div className="text-[8px] text-center" style={{ color: "#f59e0b" }}>☕{sch.break_minutes}分</div>}
                              <div className="text-[8px] text-center" style={{ color: T.textMuted }}>{sch.units}u ¥{(sch.total_payment || 0).toLocaleString()}</div>
                            </>
                          )}

                          {/* 出退勤 */}
                          <div className="flex flex-col gap-0.5 mt-1">
                            {!sch.clock_in_time ? (
                              <button onClick={e => { e.stopPropagation(); clockIn(sch.id); }} className="w-full text-[8px] py-0.5 rounded cursor-pointer font-medium" style={{ backgroundColor: "#3b82f618", color: "#3b82f6", border: "1px solid #3b82f644" }}>▶ 出勤</button>
                            ) : (
                              <div className="text-[8px] text-center px-1 py-0.5 rounded" style={{ backgroundColor: "#3b82f612", color: "#3b82f6" }}>出勤 {sch.clock_in_time}</div>
                            )}
                            {sch.clock_in_time && !sch.clock_out_time ? (
                              <button onClick={e => { e.stopPropagation(); clockOut(sch.id); }} className="w-full text-[8px] py-0.5 rounded cursor-pointer font-medium" style={{ backgroundColor: "#f59e0b18", color: "#f59e0b", border: "1px solid #f59e0b44" }}>⏹ 退勤</button>
                            ) : sch.clock_out_time ? (
                              <div className="text-[8px] text-center px-1 py-0.5 rounded" style={{ backgroundColor: "#f59e0b12", color: "#f59e0b" }}>退勤 {sch.clock_out_time}</div>
                            ) : null}
                          </div>

                          {/* 確認 */}
                          <div className="mt-0.5">
                            {!locked ? (
                              isManager ? (
                                <button onClick={e => { e.stopPropagation(); managerCheck(sch.id); }} className="w-full text-[8px] py-0.5 rounded cursor-pointer font-medium" style={{ backgroundColor: "#22c55e18", color: "#22c55e", border: "1px solid #22c55e44" }}>🔓 確認</button>
                              ) : (
                                <div className="text-[8px] text-center" style={{ color: "#f59e0b" }}>⏳未確認</div>
                              )
                            ) : (
                              <div className="text-[8px] text-center px-1 py-0.5 rounded" style={{ backgroundColor: "#22c55e18", color: "#22c55e" }}>
                                ✅ 確認済
                                {isManager && <button onClick={e => { e.stopPropagation(); undoCheck(sch.id); }} className="ml-1 cursor-pointer" style={{ background: "none", border: "none", color: "#c45555", fontSize: 7, padding: 0 }}>取消</button>}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Weekly total */}
                <div className="w-[100px] flex-shrink-0 px-2 py-3 text-center" style={{ backgroundColor: T.cardAlt }}>
                  <div className="text-[11px] font-medium">{wt.days}日</div>
                  <div className="text-[10px]" style={{ color: T.textSub }}>{wt.totalUnits}u</div>
                  <div className="text-[11px] font-bold mt-1" style={{ color: "#c3a782" }}>¥{wt.totalPay.toLocaleString()}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* PIN Modal */}
      {showPinModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowPinModal(false)}>
          <div className="rounded-2xl w-full max-w-[300px] p-6 animate-[fadeIn_0.25s]" style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }} onClick={e => e.stopPropagation()}>
            <h2 className="text-[16px] font-medium text-center mb-1">🔑 スタッフログイン</h2>
            <p className="text-[11px] text-center mb-5" style={{ color: T.textFaint }}>4桁のPINコードを入力</p>
            <div className="flex justify-center gap-2 mb-4">
              {[0, 1, 2, 3].map(i => (
                <div key={i} className="w-12 h-14 rounded-xl flex items-center justify-center text-[22px] font-bold" style={{ backgroundColor: T.cardAlt, color: pinInput[i] ? T.text : T.textFaint, border: `2px solid ${pinInput.length === i ? "#c3a782" : T.border}` }}>
                  {pinInput[i] ? "●" : ""}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, null, 0, "del"].map((n, i) => {
                if (n === null) return <div key={i} />;
                return (
                  <button key={i} onClick={() => {
                    if (n === "del") { setPinInput(prev => prev.slice(0, -1)); setPinError(""); return; }
                    const next = pinInput + String(n);
                    if (next.length > 4) return;
                    setPinInput(next); setPinError("");
                    if (next.length === 4) {
                      login(next).then(ok => { if (ok) setShowPinModal(false); else { setPinError("PINが一致しません"); setPinInput(""); } });
                    }
                  }} className="h-12 rounded-xl text-[16px] font-medium cursor-pointer" style={{ backgroundColor: T.cardAlt, color: n === "del" ? "#c45555" : T.text, border: `1px solid ${T.border}` }}>
                    {n === "del" ? "⌫" : n}
                  </button>
                );
              })}
            </div>
            {pinError && <p className="text-[11px] text-center" style={{ color: "#c45555" }}>{pinError}</p>}
            <button onClick={() => setShowPinModal(false)} className="w-full mt-2 py-2 text-[11px] rounded-xl cursor-pointer border" style={{ borderColor: T.border, color: T.textSub }}>キャンセル</button>
          </div>
        </div>
      )}

      <style jsx global>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  );
}
