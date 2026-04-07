"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabase";

type ThemeColors = { bg: string; card: string; cardAlt: string; border: string; text: string; textSub: string; textMuted: string; textFaint: string; accent: string; accentBg: string };
type Store = { id: number; name: string };
type Building = { id: number; store_id: number; name: string };
type Room = { id: number; store_id: number; building_id: number; name: string };
type Therapist = { id: number; name: string };
type RoomAssignment = { id: number; date: string; room_id: number; slot: string; therapist_id: number; start_time: string; end_time: string };

type HPAssignment = {
  therapistName: string;
  therapistId: number;
  date: string;
  dateLabel: string;
  startTime: string;
  endTime: string;
  room: string;
  buildingName: string;
  buildingId: string;
};

type HPResult = {
  therapistName: string;
  date: string;
  status: string;
  message: string;
};

type HPNameMapEntry = { smanage: string; hp: string };

function getBuildingDisplayName(buildingName: string): string {
  const n = buildingName.toLowerCase();
  if (n.includes("oasis") || n.includes("オアシス")) return "オアシス";
  if (n.includes("mycourt") || n.includes("マイコート")) return "マイコート";
  if (n.includes("ring") || n.includes("リング")) return "リングセレクト";
  return buildingName;
}

function formatDateLabel(d: string): string {
  const dt = new Date(d + "T00:00:00");
  const days = ["日", "月", "火", "水", "木", "金", "土"];
  return `${dt.getMonth() + 1}/${dt.getDate()}(${days[dt.getDay()]})`;
}

export default function HPOutputPanel({
  T,
  onClose,
  stores,
  buildings,
  rooms,
  therapists,
}: {
  T: ThemeColors;
  onClose: () => void;
  stores: Store[];
  buildings: Building[];
  rooms: Room[];
  therapists: Therapist[];
}) {
  // 日付範囲（デフォルト: 翌週月曜〜日曜）
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [assignments, setAssignments] = useState<HPAssignment[]>([]);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<HPResult[]>([]);
  const [progress, setProgress] = useState("");
  const [hpNameMap, setHpNameMap] = useState<HPNameMapEntry[]>([]);
  const [newMapSmanage, setNewMapSmanage] = useState("");
  const [newMapHp, setNewMapHp] = useState("");
  const [showMapping, setShowMapping] = useState(false);

  // 初期日付設定
  useEffect(() => {
    const today = new Date();
    const dow = today.getDay();
    const daysToNextMon = dow === 0 ? 1 : 8 - dow;
    const nextMon = new Date(today);
    nextMon.setDate(today.getDate() + daysToNextMon);
    const nextSun = new Date(nextMon);
    nextSun.setDate(nextMon.getDate() + 6);
    setStartDate(nextMon.toISOString().split("T")[0]);
    setEndDate(nextSun.toISOString().split("T")[0]);
  }, []);

  // HP名前マッピング読み込み
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("store_settings").select("key,value").eq("key", "hp_name_map").maybeSingle();
      if (data?.value) {
        try {
          setHpNameMap(JSON.parse(data.value));
        } catch { /* ignore */ }
      }
    };
    load();
  }, []);

  // マッピング保存
  const saveNameMap = async (map: HPNameMapEntry[]) => {
    setHpNameMap(map);
    await supabase.from("store_settings").upsert({ key: "hp_name_map", value: JSON.stringify(map) }, { onConflict: "key" });
  };

  const addMapping = () => {
    if (!newMapSmanage.trim() || !newMapHp.trim()) return;
    const updated = [...hpNameMap.filter(m => m.smanage !== newMapSmanage.trim()), { smanage: newMapSmanage.trim(), hp: newMapHp.trim() }];
    saveNameMap(updated);
    setNewMapSmanage("");
    setNewMapHp("");
  };

  const removeMapping = (smanage: string) => {
    saveNameMap(hpNameMap.filter(m => m.smanage !== smanage));
  };

  // クイック日付選択
  const setQuickDate = (offset: number) => {
    const today = new Date();
    const dow = today.getDay();
    let daysToMon: number;
    if (offset === 0) {
      daysToMon = dow === 0 ? -6 : 1 - dow;
    } else if (offset === 1) {
      daysToMon = dow === 0 ? 1 : 8 - dow;
    } else {
      daysToMon = dow === 0 ? 8 : 15 - dow;
    }
    const mon = new Date(today);
    mon.setDate(today.getDate() + daysToMon);
    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);
    setStartDate(mon.toISOString().split("T")[0]);
    setEndDate(sun.toISOString().split("T")[0]);
  };

  // データ取得
  const fetchAssignments = useCallback(async () => {
    if (!startDate || !endDate) return;
    setLoading(true);
    setResults([]);

    const { data: aData } = await supabase
      .from("room_assignments")
      .select("*")
      .gte("date", startDate)
      .lte("date", endDate)
      .order("date");

    if (!aData || aData.length === 0) {
      setAssignments([]);
      setLoading(false);
      return;
    }

    const hpAssignments: HPAssignment[] = [];
    for (const a of aData) {
      const therapist = therapists.find(t => t.id === a.therapist_id);
      if (!therapist) continue;
      const room = rooms.find(r => r.id === a.room_id);
      if (!room) continue;
      const building = buildings.find(b => b.id === room.building_id);
      if (!building) continue;

      hpAssignments.push({
        therapistName: therapist.name,
        therapistId: therapist.id,
        date: a.date,
        dateLabel: formatDateLabel(a.date),
        startTime: a.start_time,
        endTime: a.end_time,
        room: getBuildingDisplayName(building.name) + room.name,
        buildingName: building.name,
        buildingId: String(building.id),
      });
    }

    setAssignments(hpAssignments);
    setLoading(false);
  }, [startDate, endDate, therapists, rooms, buildings]);

  useEffect(() => {
    if (startDate && endDate) fetchAssignments();
  }, [startDate, endDate, fetchAssignments]);

  // セラピストごとにグループ化
  const grouped = assignments.reduce<Record<string, HPAssignment[]>>((acc, a) => {
    if (!acc[a.therapistName]) acc[a.therapistName] = [];
    acc[a.therapistName].push(a);
    return acc;
  }, {});

  // HP一括出力
  const runBulkUpdate = async () => {
    setRunning(true);
    setResults([]);
    setProgress("HPにログイン中...");

    // store_settingsからHP認証取得
    const { data: settings } = await supabase
      .from("store_settings")
      .select("key,value")
      .in("key", ["hp_login_id", "hp_login_pass"]);

    const loginId = settings?.find(s => s.key === "hp_login_id")?.value;
    const loginPass = settings?.find(s => s.key === "hp_login_pass")?.value;

    if (!loginId || !loginPass) {
      setProgress("");
      setResults([{ therapistName: "-", date: "-", status: "error", message: "HP認証情報がシステム設定に未登録です" }]);
      setRunning(false);
      return;
    }

    const nameMapObj: Record<string, string> = {};
    for (const m of hpNameMap) nameMapObj[m.smanage] = m.hp;

    try {
      setProgress(`${assignments.length}件のスケジュールを更新中...`);

      const res = await fetch("/api/hp-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "bulk_update",
          loginId,
          loginPass,
          assignments: assignments.map(a => ({
            therapistName: a.therapistName,
            date: a.date,
            startTime: a.startTime,
            endTime: a.endTime,
            buildingName: a.buildingName,
          })),
          hpNameMap: nameMapObj,
        }),
      });

      const data = await res.json();
      if (data.results) {
        setResults(data.results);
      } else {
        setResults([{ therapistName: "-", date: "-", status: "error", message: data.error || "不明なエラー" }]);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "通信エラー";
      setResults([{ therapistName: "-", date: "-", status: "error", message: msg }]);
    }

    setProgress("");
    setRunning(false);
  };

  // 個別出力
  const runSingleUpdate = async (therapistName: string) => {
    const therapistAssignments = grouped[therapistName];
    if (!therapistAssignments) return;

    setRunning(true);
    setProgress(`${therapistName} をHP更新中...`);

    const { data: settings } = await supabase
      .from("store_settings")
      .select("key,value")
      .in("key", ["hp_login_id", "hp_login_pass"]);

    const loginId = settings?.find(s => s.key === "hp_login_id")?.value;
    const loginPass = settings?.find(s => s.key === "hp_login_pass")?.value;

    if (!loginId || !loginPass) {
      setResults(prev => [...prev, { therapistName, date: "-", status: "error", message: "HP認証情報が未登録" }]);
      setRunning(false);
      setProgress("");
      return;
    }

    const nameMapObj: Record<string, string> = {};
    for (const m of hpNameMap) nameMapObj[m.smanage] = m.hp;

    try {
      const res = await fetch("/api/hp-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "bulk_update",
          loginId,
          loginPass,
          assignments: therapistAssignments.map(a => ({
            therapistName: a.therapistName,
            date: a.date,
            startTime: a.startTime,
            endTime: a.endTime,
            buildingName: a.buildingName,
          })),
          hpNameMap: nameMapObj,
        }),
      });

      const data = await res.json();
      if (data.results) {
        setResults(prev => [...prev, ...data.results]);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "通信エラー";
      setResults(prev => [...prev, { therapistName, date: "-", status: "error", message: msg }]);
    }

    setProgress("");
    setRunning(false);
  };

  const successCount = results.filter(r => r.status === "success").length;
  const errorCount = results.filter(r => r.status === "error").length;
  const getResultsForTherapist = (name: string) => results.filter(r => r.therapistName === name);
  const isTherapistDone = (name: string) => getResultsForTherapist(name).length > 0;
  const isTherapistSuccess = (name: string) => {
    const r = getResultsForTherapist(name);
    return r.length > 0 && r.every(x => x.status === "success");
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="rounded-2xl w-full max-w-[800px] max-h-[90vh] flex flex-col animate-[fadeIn_0.25s]" style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: T.border }}>
          <div>
            <h2 className="text-[16px] font-medium">🌐 HP出力（Panda Web Concierge）</h2>
            <p className="text-[11px] mt-1" style={{ color: T.textMuted }}>部屋割りのスケジュールをHPに自動反映します</p>
          </div>
          <button onClick={onClose} className="text-[16px] cursor-pointer p-2" style={{ color: T.textSub, background: "none", border: "none" }}>✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* 日付範囲 */}
          <div className="rounded-xl p-4" style={{ backgroundColor: T.cardAlt }}>
            <div className="flex items-center gap-3 mb-3">
              <span className="text-[12px] font-medium">📅 対象期間</span>
              <div className="flex gap-1.5">
                {[["今週", 0], ["翌週", 1], ["2週先", 2]].map(([label, offset]) => (
                  <button key={String(offset)} onClick={() => setQuickDate(offset as number)} className="px-2.5 py-1 text-[10px] rounded-lg cursor-pointer" style={{ backgroundColor: "#c3a78218", color: "#c3a782", border: "1px solid #c3a78244" }}>{String(label)}</button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="px-3 py-1.5 rounded-lg text-[12px] outline-none border" style={{ backgroundColor: T.card, borderColor: T.border, color: T.text }} />
              <span className="text-[12px]" style={{ color: T.textMuted }}>〜</span>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="px-3 py-1.5 rounded-lg text-[12px] outline-none border" style={{ backgroundColor: T.card, borderColor: T.border, color: T.text }} />
            </div>
          </div>

          {/* HP名前マッピング */}
          <div className="rounded-xl" style={{ backgroundColor: T.cardAlt }}>
            <button onClick={() => setShowMapping(!showMapping)} className="w-full flex items-center justify-between px-4 py-3 cursor-pointer" style={{ background: "none", border: "none", color: T.text }}>
              <span className="text-[12px] font-medium">🔗 HP名前マッピング（{hpNameMap.length}件）</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={T.textMuted} strokeWidth="2" style={{ transform: showMapping ? "rotate(180deg)" : "", transition: "0.2s" }}><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            {showMapping && (
              <div className="px-4 pb-4 space-y-2">
                <p className="text-[10px]" style={{ color: T.textMuted }}>T-MANAGE名とHP登録名が異なる場合に設定</p>
                {hpNameMap.map(m => (
                  <div key={m.smanage} className="flex items-center gap-2">
                    <span className="text-[11px] px-2 py-1 rounded" style={{ backgroundColor: T.card }}>{m.smanage}</span>
                    <span className="text-[10px]" style={{ color: T.textMuted }}>→</span>
                    <span className="text-[11px] px-2 py-1 rounded" style={{ backgroundColor: T.card }}>{m.hp}</span>
                    <button onClick={() => removeMapping(m.smanage)} className="text-[9px] px-1 cursor-pointer" style={{ color: "#c45555", background: "none", border: "none" }}>✕</button>
                  </div>
                ))}
                <div className="flex items-center gap-2">
                  <input type="text" placeholder="T-MANAGE名" value={newMapSmanage} onChange={e => setNewMapSmanage(e.target.value)} className="px-2 py-1 rounded text-[11px] outline-none border w-[100px]" style={{ backgroundColor: T.card, borderColor: T.border, color: T.text }} />
                  <span className="text-[10px]" style={{ color: T.textMuted }}>→</span>
                  <input type="text" placeholder="HP名" value={newMapHp} onChange={e => setNewMapHp(e.target.value)} className="px-2 py-1 rounded text-[11px] outline-none border w-[100px]" style={{ backgroundColor: T.card, borderColor: T.border, color: T.text }} />
                  <button onClick={addMapping} className="px-2.5 py-1 text-[10px] rounded cursor-pointer" style={{ backgroundColor: "#22c55e18", color: "#22c55e", border: "1px solid #22c55e44" }}>追加</button>
                </div>
              </div>
            )}
          </div>

          {/* 一括出力ボタン */}
          {assignments.length > 0 && (
            <div className="flex items-center gap-3">
              <button
                onClick={runBulkUpdate}
                disabled={running}
                className="px-4 py-2.5 rounded-xl text-[13px] font-medium cursor-pointer text-white"
                style={{ backgroundColor: running ? "#999" : "#3b82f6", opacity: running ? 0.6 : 1 }}
              >
                {running ? "⏳ 処理中..." : `🌐 全員HP出力（${Object.keys(grouped).length}名）`}
              </button>
              {progress && <span className="text-[11px]" style={{ color: "#3b82f6" }}>{progress}</span>}
              {results.length > 0 && (
                <span className="text-[11px]">
                  {successCount > 0 && <span style={{ color: "#22c55e" }}>✅{successCount}件成功</span>}
                  {errorCount > 0 && <span style={{ color: "#c45555" }} className="ml-2">❌{errorCount}件失敗</span>}
                </span>
              )}
            </div>
          )}

          {/* セラピスト一覧 */}
          {loading ? (
            <div className="text-center py-8">
              <p className="text-[12px]" style={{ color: T.textMuted }}>読み込み中...</p>
            </div>
          ) : assignments.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-[12px]" style={{ color: T.textMuted }}>この期間の部屋割りデータがありません</p>
            </div>
          ) : (
            <div className="space-y-2">
              {Object.entries(grouped).map(([name, items]) => {
                const done = isTherapistDone(name);
                const success = isTherapistSuccess(name);
                const tResults = getResultsForTherapist(name);
                return (
                  <div key={name} className="rounded-xl p-3" style={{
                    backgroundColor: T.card,
                    border: `1px solid ${done ? (success ? "#22c55e44" : "#c4555544") : T.border}`,
                  }}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-medium">{name}</span>
                        {hpNameMap.find(m => m.smanage === name) && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "#85a8c418", color: "#85a8c4" }}>HP名: {hpNameMap.find(m => m.smanage === name)?.hp}</span>
                        )}
                        {done && success && <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: "#22c55e18", color: "#22c55e" }}>✅ 完了</span>}
                        {done && !success && <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: "#c4555518", color: "#c45555" }}>❌ エラー</span>}
                      </div>
                      <button
                        onClick={() => runSingleUpdate(name)}
                        disabled={running}
                        className="px-3 py-1.5 text-[10px] rounded-lg cursor-pointer font-medium"
                        style={{ backgroundColor: "#3b82f618", color: "#3b82f6", border: "1px solid #3b82f644", opacity: running ? 0.5 : 1 }}
                      >
                        🌐 HP出力
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {items.map((a, i) => (
                        <span key={i} className="text-[10px] px-2 py-1 rounded" style={{ backgroundColor: T.cardAlt, color: T.textSub }}>
                          {a.dateLabel} {a.startTime}〜{a.endTime} {a.room}
                        </span>
                      ))}
                    </div>
                    {tResults.length > 0 && tResults.some(r => r.status === "error") && (
                      <div className="mt-2 space-y-1">
                        {tResults.filter(r => r.status === "error").map((r, i) => (
                          <p key={i} className="text-[10px]" style={{ color: "#c45555" }}>❌ {r.date}: {r.message}</p>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
