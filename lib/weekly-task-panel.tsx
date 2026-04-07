"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabase";

type ThemeColors = { bg: string; card: string; cardAlt: string; border: string; text: string; textSub: string; textMuted: string; textFaint: string; accent: string; accentBg: string };
type Building = { id: number; store_id: number; name: string };
type Store = { id: number; name: string };
type WeeklyTask = { id: number; day_of_week: number; title: string; scope: string; sort_order: number; is_active: boolean };

const DOW_LABELS = ["日曜日", "月曜日", "火曜日", "水曜日", "木曜日", "金曜日", "土曜日"];
const DOW_COLORS = ["#c45555", "#333", "#333", "#333", "#333", "#333", "#3d6b9f"];

function getBuildingLabel(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("oasis") || n.includes("オアシス")) return "オアシス";
  if (n.includes("mycourt") || n.includes("マイコート")) return "マイコート";
  if (n.includes("ring") || n.includes("リング")) return "リングセレクト";
  return name;
}

function getScopeLabel(scope: string, buildings: Building[], stores: Store[]): string {
  if (scope === "all") return "全体";
  if (scope.startsWith("building:")) {
    const bid = parseInt(scope.split(":")[1]);
    const b = buildings.find(x => x.id === bid);
    return b ? getBuildingLabel(b.name) : "不明";
  }
  if (scope.startsWith("store:")) {
    const sid = parseInt(scope.split(":")[1]);
    const s = stores.find(x => x.id === sid);
    return s?.name || "不明";
  }
  return scope;
}

function getScopeColor(scope: string): string {
  if (scope === "all") return "#c3a782";
  if (scope.startsWith("building:")) return "#85a8c4";
  if (scope.startsWith("store:")) return "#7ab88f";
  return "#999";
}

export default function WeeklyTaskPanel({
  T,
  dark,
  onClose,
  buildings,
  stores,
}: {
  T: ThemeColors;
  dark: boolean;
  onClose: () => void;
  buildings: Building[];
  stores: Store[];
}) {
  const [tasks, setTasks] = useState<WeeklyTask[]>([]);
  const [newTitles, setNewTitles] = useState<Record<number, string>>({});
  const [newScopes, setNewScopes] = useState<Record<number, string>>({});

  const fetchTasks = useCallback(async () => {
    const { data } = await supabase.from("weekly_tasks").select("*").eq("is_active", true).order("day_of_week").order("sort_order");
    if (data) setTasks(data);
  }, []);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const addTask = async (dow: number) => {
    const title = (newTitles[dow] || "").trim();
    if (!title) return;
    const scope = newScopes[dow] || "all";
    const maxSort = tasks.filter(t => t.day_of_week === dow).reduce((m, t) => Math.max(m, t.sort_order), 0);
    await supabase.from("weekly_tasks").insert({ day_of_week: dow, title, scope, sort_order: maxSort + 1 });
    setNewTitles(prev => ({ ...prev, [dow]: "" }));
    fetchTasks();
  };

  const deleteTask = async (id: number) => {
    await supabase.from("weekly_tasks").update({ is_active: false }).eq("id", id);
    fetchTasks();
  };

  // スコープ選択肢を生成
  const scopeOptions: { value: string; label: string }[] = [
    { value: "all", label: "全体" },
    ...buildings.map(b => ({ value: `building:${b.id}`, label: getBuildingLabel(b.name) })),
    ...stores.map(s => ({ value: `store:${s.id}`, label: s.name })),
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="rounded-2xl w-full max-w-[700px] max-h-[90vh] flex flex-col animate-[fadeIn_0.25s]" style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: T.border }}>
          <div>
            <h2 className="text-[16px] font-medium">📋 曜日別タスク管理</h2>
            <p className="text-[11px] mt-1" style={{ color: T.textMuted }}>各曜日で毎週行うタスクを登録・管理します</p>
          </div>
          <button onClick={onClose} className="text-[16px] cursor-pointer p-2" style={{ color: T.textSub, background: "none", border: "none" }}>✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {[1, 2, 3, 4, 5, 6, 0].map(dow => {
            const dayTasks = tasks.filter(t => t.day_of_week === dow);
            return (
              <div key={dow} className="rounded-xl" style={{ backgroundColor: T.cardAlt, border: `1px solid ${T.border}` }}>
                <div className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: `1px solid ${T.border}` }}>
                  <span className="text-[13px] font-medium" style={{ color: dark ? (dow === 0 ? "#ef8888" : dow === 6 ? "#7ab3d4" : T.text) : (DOW_COLORS[dow] || T.text) }}>
                    {DOW_LABELS[dow]}
                  </span>
                  <span className="text-[10px]" style={{ color: T.textMuted }}>{dayTasks.length}件</span>
                </div>

                <div className="px-4 py-2 space-y-1.5">
                  {dayTasks.map(task => (
                    <div key={task.id} className="flex items-center gap-2 py-1">
                      <span className="text-[11px] flex-1" style={{ color: T.text }}>{task.title}</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ backgroundColor: getScopeColor(task.scope) + "18", color: getScopeColor(task.scope) }}>
                        {getScopeLabel(task.scope, buildings, stores)}
                      </span>
                      <button onClick={() => deleteTask(task.id)} className="text-[10px] px-1 cursor-pointer" style={{ color: "#c45555", background: "none", border: "none" }}>✕</button>
                    </div>
                  ))}

                  {/* 追加フォーム */}
                  <div className="flex items-center gap-1.5 pt-1">
                    <input
                      type="text"
                      placeholder="タスクを追加..."
                      value={newTitles[dow] || ""}
                      onChange={e => setNewTitles(prev => ({ ...prev, [dow]: e.target.value }))}
                      onKeyDown={e => { if (e.key === "Enter") addTask(dow); }}
                      className="flex-1 px-2.5 py-1.5 rounded-lg text-[10px] outline-none border"
                      style={{ backgroundColor: T.card, borderColor: T.border, color: T.text }}
                    />
                    <select
                      value={newScopes[dow] || "all"}
                      onChange={e => setNewScopes(prev => ({ ...prev, [dow]: e.target.value }))}
                      className="px-1.5 py-1.5 rounded-lg text-[9px] outline-none cursor-pointer border"
                      style={{ backgroundColor: T.card, borderColor: T.border, color: T.textSub }}
                    >
                      {scopeOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                    <button
                      onClick={() => addTask(dow)}
                      className="px-3 py-1.5 rounded-lg text-[10px] cursor-pointer font-medium"
                      style={{ backgroundColor: "#c3a78218", color: "#c3a782", border: "1px solid #c3a78244" }}
                    >+ 追加</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
