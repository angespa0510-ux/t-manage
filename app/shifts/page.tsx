"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";
import { useTheme } from "../../lib/theme";
import { NavMenu } from "../../lib/nav-menu";
import { useConfirm } from "../../components/useConfirm";

type Therapist = { id: number; name: string };
type Store = { id: number; name: string };
type Shift = { id: number; therapist_id: number; store_id: number; date: string; start_time: string; end_time: string; status: string };
type ShiftRequest = { id: number; therapist_id: number; week_start: string; date: string; start_time: string; end_time: string; store_id: number; status: string; notes: string };

export default function ShiftManagement() {
  const router = useRouter();
  const { dark, toggle, T } = useTheme();
  const { confirm, ConfirmModalNode } = useConfirm();
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

  // シフト希望タブ
  const [tabMode, setTabMode] = useState<"shift" | "request">("shift");
  const [shiftRequests, setShiftRequests] = useState<ShiftRequest[]>([]);
  const [reqFilter, setReqFilter] = useState<"pending" | "all">("pending");
  const [processingReqId, setProcessingReqId] = useState<number | null>(null);

  const weekDates = Array.from({ length: 7 }, (_, i) => { const d = new Date(weekStart + "T00:00:00"); d.setDate(d.getDate() + i); return d.toISOString().split("T")[0]; });

  const fetchData = useCallback(async () => {
    const { data: t } = await supabase.from("therapists").select("*").order("id"); if (t) setTherapists(t);
    const { data: s } = await supabase.from("stores").select("*").order("id"); if (s) setStores(s);
    const startDate = weekDates[0]; const endDate = weekDates[6];
    const { data: sh } = await supabase.from("shifts").select("*").gte("date", startDate).lte("date", endDate).order("date"); if (sh) setShifts(sh);
    const { data: sr } = await supabase.from("shift_requests").select("*").order("date"); if (sr) setShiftRequests(sr);
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

  const getTherapistName = (id: number) => therapists.find((t) => t.id === id)?.name || "—";

  // お気に入り通知
  const notifyFavoriteCustomers = async (therapistId: number, date: string, startTime: string, endTime: string) => {
    try {
      const thName = getTherapistName(therapistId);
      const d = new Date(date + "T00:00:00");
      const days = ["日","月","火","水","木","金","土"];
      const dateStr = `${d.getMonth()+1}/${d.getDate()}(${days[d.getDay()]})`;
      // このセラピストをお気に入りにしている顧客を取得
      const { data: favs } = await supabase.from("customer_favorites").select("customer_id").eq("type", "therapist").eq("item_id", therapistId);
      if (!favs || favs.length === 0) return;
      // 同じ日付・セラピストで既に通知済みかチェック
      for (const fav of favs) {
        const notifKey = `${thName}さん ${dateStr} 出勤`;
        const { data: exist } = await supabase.from("customer_notifications").select("id").eq("target_customer_id", fav.customer_id).like("title", "%出勤のお知らせ%").like("body", `%${thName}%${dateStr}%`).maybeSingle();
        if (!exist) {
          await supabase.from("customer_notifications").insert({
            title: "❤️ お気に入りセラピスト出勤のお知らせ",
            body: `${thName}さんが${dateStr} ${startTime}〜${endTime}に出勤します！ご予約はお早めに♪`,
            type: "info",
            target_customer_id: fav.customer_id,
          });
        }
      }
    } catch (e) { console.error("お気に入り通知エラー:", e); }
  };

  // シフト希望 承認
  const approveRequest = async (req: ShiftRequest) => {
    setProcessingReqId(req.id);
    await supabase.from("shift_requests").update({ status: "approved" }).eq("id", req.id);
    // shiftsテーブルに確定シフトとして登録（既存があれば更新、なければ追加）
    const { data: existing } = await supabase.from("shifts").select("id").eq("therapist_id", req.therapist_id).eq("date", req.date).limit(1);
    if (existing && existing.length > 0) {
      await supabase.from("shifts").update({ store_id: req.store_id || null, start_time: req.start_time, end_time: req.end_time, status: "confirmed" }).eq("id", existing[0].id);
    } else {
      await supabase.from("shifts").insert({ therapist_id: req.therapist_id, store_id: req.store_id || null, date: req.date, start_time: req.start_time, end_time: req.end_time, status: "confirmed" });
    }
    await notifyFavoriteCustomers(req.therapist_id, req.date, req.start_time, req.end_time);
    setProcessingReqId(null);
    fetchData();
  };

  // シフト希望 却下
  const rejectRequest = async (req: ShiftRequest) => {
    setProcessingReqId(req.id);
    await supabase.from("shift_requests").update({ status: "rejected" }).eq("id", req.id);
    setProcessingReqId(null);
    fetchData();
  };

  // 一括承認
  const approveAllPending = async () => {
    const pending = shiftRequests.filter(r => r.status === "pending");
    if (pending.length === 0) return;
    const ok = await confirm({ title: `未処理のシフト希望${pending.length}件をすべて承認しますか？`, message: "承認すると確定シフトとして登録され、お気に入り顧客に通知が送られます。", variant: "warning", confirmLabel: "すべて承認する", icon: "✅" });
    if (!ok) return;
    for (const req of pending) {
      await supabase.from("shift_requests").update({ status: "approved" }).eq("id", req.id);
      const { data: existing } = await supabase.from("shifts").select("id").eq("therapist_id", req.therapist_id).eq("date", req.date).limit(1);
      if (existing && existing.length > 0) {
        await supabase.from("shifts").update({ store_id: req.store_id || null, start_time: req.start_time, end_time: req.end_time, status: "confirmed" }).eq("id", existing[0].id);
      } else {
        await supabase.from("shifts").insert({ therapist_id: req.therapist_id, store_id: req.store_id || null, date: req.date, start_time: req.start_time, end_time: req.end_time, status: "confirmed" });
      }
      await notifyFavoriteCustomers(req.therapist_id, req.date, req.start_time, req.end_time);
    }
    fetchData();
  };

  const inputStyle = { backgroundColor: T.cardAlt, color: T.text, border: "1px solid transparent" };

  return (
    <div className="h-screen flex flex-col" style={{ backgroundColor: T.bg, color: T.text }}>
      {ConfirmModalNode}
      {/* Header */}
      <div className="h-[64px] backdrop-blur-xl border-b flex items-center justify-between px-6 flex-shrink-0" style={{ backgroundColor: dark ? T.card + "cc" : "rgba(255,255,255,0.8)", borderColor: T.border }}>
        <div className="flex items-center gap-4">
          <NavMenu T={T} dark={dark} />
          <button onClick={() => router.push("/dashboard")} className="p-2 rounded-lg cursor-pointer" style={{ color: T.textSub }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg></button>
          <h1 className="text-[15px] font-medium">セラピスト勤怠（シフト管理）</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={toggle} className="px-3 py-1.5 text-[10px] rounded-lg cursor-pointer border" style={{ borderColor: T.border, color: T.textSub }}>{dark ? "☀️ ライト" : "🌙 ダーク"}</button>
          {tabMode === "shift" && <button onClick={() => { setAddDate(new Date().toISOString().split("T")[0]); setAddTherapistId(0); setAddStoreId(stores.length > 0 ? stores[0].id : 0); setMsg(""); setShowAddShift(true); }}
            className="px-4 py-2 bg-gradient-to-r from-[#c3a782] to-[#b09672] text-white text-[11px] rounded-xl cursor-pointer">+ シフト追加</button>}
        </div>
      </div>

      {/* Tab Toggle */}
      <div className="h-[48px] border-b flex items-center gap-2 px-6 flex-shrink-0" style={{ backgroundColor: T.card, borderColor: T.border }}>
        <button onClick={() => setTabMode("shift")} className="px-4 py-1.5 rounded-lg text-[12px] cursor-pointer transition-all" style={{ backgroundColor: tabMode === "shift" ? T.accent + "18" : "transparent", color: tabMode === "shift" ? T.accent : T.textMuted, fontWeight: tabMode === "shift" ? 600 : 400 }}>📅 シフト表</button>
        <button onClick={() => setTabMode("request")} className="px-4 py-1.5 rounded-lg text-[12px] cursor-pointer transition-all flex items-center gap-1.5" style={{ backgroundColor: tabMode === "request" ? "#c3a782" + "18" : "transparent", color: tabMode === "request" ? "#c3a782" : T.textMuted, fontWeight: tabMode === "request" ? 600 : 400 }}>
          📋 シフト希望
          {shiftRequests.filter(r => r.status === "pending").length > 0 && (
            <span className="min-w-[18px] h-[18px] rounded-full bg-[#c45555] text-white text-[9px] font-bold flex items-center justify-center">{shiftRequests.filter(r => r.status === "pending").length}</span>
          )}
        </button>
      </div>

      {/* ===== シフト表タブ ===== */}
      {tabMode === "shift" && <>
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
      </>}

      {/* ===== シフト希望タブ ===== */}
      {tabMode === "request" && (
        <div className="flex-1 overflow-auto">
          <div className="p-6">
            {/* ヘッダー */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-[15px] font-medium">セラピストからのシフト希望</h2>
                <p className="text-[11px] mt-0.5" style={{ color: T.textFaint }}>マイページから提出されたシフト希望を承認・却下します</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: T.border }}>
                  <button onClick={() => setReqFilter("pending")} className="px-3 py-1.5 text-[11px] cursor-pointer" style={{ backgroundColor: reqFilter === "pending" ? "#c3a782" + "18" : "transparent", color: reqFilter === "pending" ? "#c3a782" : T.textMuted, fontWeight: reqFilter === "pending" ? 600 : 400 }}>未処理</button>
                  <button onClick={() => setReqFilter("all")} className="px-3 py-1.5 text-[11px] cursor-pointer border-l" style={{ borderColor: T.border, backgroundColor: reqFilter === "all" ? T.accent + "18" : "transparent", color: reqFilter === "all" ? T.accent : T.textMuted, fontWeight: reqFilter === "all" ? 600 : 400 }}>すべて</button>
                </div>
                {shiftRequests.filter(r => r.status === "pending").length > 0 && (
                  <button onClick={approveAllPending} className="px-4 py-1.5 bg-gradient-to-r from-[#4a7c59] to-[#3d6b4c] text-white text-[11px] rounded-lg cursor-pointer">✅ 一括承認</button>
                )}
              </div>
            </div>

            {/* リスト */}
            {(() => {
              const filtered = reqFilter === "pending" ? shiftRequests.filter(r => r.status === "pending") : shiftRequests;
              // 日付でグループ化
              const grouped: Record<string, ShiftRequest[]> = {};
              filtered.forEach(r => { if (!grouped[r.date]) grouped[r.date] = []; grouped[r.date].push(r); });
              const sortedDates = Object.keys(grouped).sort();

              if (sortedDates.length === 0) return (
                <div className="flex flex-col items-center justify-center py-20">
                  <span className="text-[32px] mb-3">📋</span>
                  <p className="text-[14px]" style={{ color: T.textMuted }}>{reqFilter === "pending" ? "未処理のシフト希望はありません" : "シフト希望はありません"}</p>
                </div>
              );

              const reqStatusColors: Record<string, { bg: string; text: string; label: string }> = {
                pending: { bg: "#f59e0b18", text: "#b45309", label: "⏳ 未処理" },
                approved: { bg: "#4a7c5918", text: "#4a7c59", label: "✅ 承認済み" },
                rejected: { bg: "#c4555518", text: "#c45555", label: "❌ 却下" },
              };

              return (
                <div className="space-y-4">
                  {sortedDates.map(date => {
                    const fd = new Date(date + "T00:00:00");
                    const days = ["日", "月", "火", "水", "木", "金", "土"];
                    const isSun = fd.getDay() === 0; const isSat = fd.getDay() === 6;
                    return (
                      <div key={date}>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-[13px] font-medium" style={{ color: isSun ? "#c45555" : isSat ? "#3d6b9f" : T.text }}>{fd.getMonth() + 1}/{fd.getDate()}({days[fd.getDay()]})</span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: T.cardAlt, color: T.textMuted }}>{grouped[date].length}件</span>
                        </div>
                        <div className="space-y-2">
                          {grouped[date].map(req => {
                            const sc = reqStatusColors[req.status] || reqStatusColors.pending;
                            const tName = getTherapistName(req.therapist_id);
                            const sName = req.store_id ? (stores.find(s => s.id === req.store_id)?.name || "") : "";
                            return (
                              <div key={req.id} className="rounded-xl border p-4 transition-all" style={{ backgroundColor: T.card, borderColor: T.border }}>
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3 flex-1">
                                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-[12px] text-white font-medium flex-shrink-0" style={{ backgroundColor: colors[therapists.findIndex(t => t.id === req.therapist_id) % colors.length] || "#999" }}>{tName.charAt(0)}</div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-[13px] font-medium">{tName}</span>
                                        <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: sc.bg, color: sc.text }}>{sc.label}</span>
                                      </div>
                                      <div className="flex items-center gap-3 mt-1 text-[11px]" style={{ color: T.textSub }}>
                                        <span>🕐 {req.start_time}〜{req.end_time}</span>
                                        {sName && <span>🏠 {sName}</span>}
                                      </div>
                                      {req.notes && <p className="text-[10px] mt-1" style={{ color: T.textMuted }}>📝 {req.notes}</p>}
                                    </div>
                                  </div>
                                  {req.status === "pending" && (
                                    <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                                      <button onClick={() => approveRequest(req)} disabled={processingReqId === req.id} className="px-4 py-2 rounded-lg text-[11px] cursor-pointer transition-all disabled:opacity-50" style={{ backgroundColor: "#4a7c5918", color: "#4a7c59" }}>✅ 承認</button>
                                      <button onClick={() => rejectRequest(req)} disabled={processingReqId === req.id} className="px-4 py-2 rounded-lg text-[11px] cursor-pointer transition-all disabled:opacity-50" style={{ backgroundColor: "#c4555518", color: "#c45555" }}>❌ 却下</button>
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
            })()}
          </div>
        </div>
      )}

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
