"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabase";

type ThemeColors = { bg: string; card: string; cardAlt: string; border: string; text: string; textSub: string; textMuted: string; textFaint: string; accent: string; accentBg: string };
type Store = { id: number; name: string };
type Building = { id: number; store_id: number; name: string };
type Room = { id: number; store_id: number; building_id: number; name: string };
type Therapist = { id: number; name: string };

type CastShift = {
  date: string;
  dateLabel: string;
  startTime: string;
  endTime: string;
  room: string;
};

type CastData = {
  therapistName: string;
  therapistId: number;
  shifts: CastShift[];
  message: string;
  sent: boolean;
  editing: boolean;
};

const NOTION_URL = "https://quiet-banana-895.notion.site/30ddb1122fba8173bab1fada4c58d9a9";

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

function formatDateRange(start: string, end: string): string {
  return `${formatDateLabel(start)}～${formatDateLabel(end)}`;
}

function generateMessage(therapistName: string, shifts: CastShift[], dateRange: string): string {
  if (shifts.length === 0) {
    return `💁‍♀️お疲れ様です✨\n📋【確定シフト】${dateRange}\n\nこの期間の出勤予定はありません。\n\n━━━━━━━━━━━━\n【ルーム詳細】\n${NOTION_URL}\n\nこちらご確認をしていただけましたら返信をお願いいたします🙇‍♀️✨`;
  }

  let msg = `💁‍♀️お疲れ様です✨\n📋【確定シフト】${dateRange}\n\n`;

  for (const s of shifts) {
    msg += `📅 ${s.dateLabel}\n`;
    msg += `  ⏰ ${s.startTime}～${s.endTime}\n`;
    msg += `  🏠 ${s.room}\n\n`;
  }

  msg += `━━━━━━━━━━━━\n【ルーム詳細】\n${NOTION_URL}\n\nこちらご確認をしていただけましたら返信をお願いいたします🙇‍♀️✨`;
  return msg;
}

export default function LineShiftPanel({
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
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [castList, setCastList] = useState<CastData[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchFilter, setSearchFilter] = useState("");
  const [lineUrlStaff, setLineUrlStaff] = useState("");
  const [bulkSending, setBulkSending] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  // 初期日付設定（翌週月曜〜日曜）
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

  // LINE URL読み込み
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("store_settings").select("key,value").eq("key", "line_url_staff").maybeSingle();
      if (data?.value) setLineUrlStaff(data.value);
    };
    load();
  }, []);

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
  const fetchCastData = useCallback(async () => {
    if (!startDate || !endDate) return;
    setLoading(true);

    const { data: aData } = await supabase
      .from("room_assignments")
      .select("*")
      .gte("date", startDate)
      .lte("date", endDate)
      .order("date");

    // セラピストごとにグループ化
    const castMap: Record<number, CastShift[]> = {};

    if (aData) {
      for (const a of aData) {
        const room = rooms.find(r => r.id === a.room_id);
        if (!room) continue;
        const building = buildings.find(b => b.id === room.building_id);
        if (!building) continue;

        if (!castMap[a.therapist_id]) castMap[a.therapist_id] = [];
        castMap[a.therapist_id].push({
          date: a.date,
          dateLabel: formatDateLabel(a.date),
          startTime: a.start_time,
          endTime: a.end_time,
          room: getBuildingDisplayName(building.name) + room.name,
        });
      }
    }

    // 部屋割りに入っているセラピストのみ + シフトだけある人も含める
    const dateRange = formatDateRange(startDate, endDate);
    const allCastIds = new Set<number>(Object.keys(castMap).map(Number));

    // シフトだけのセラピストも取得（割り当てなし）
    const { data: shiftData } = await supabase
      .from("shifts")
      .select("therapist_id")
      .gte("date", startDate)
      .lte("date", endDate)
      .eq("status", "confirmed");

    if (shiftData) {
      for (const s of shiftData) {
        allCastIds.add(s.therapist_id);
      }
    }

    const list: CastData[] = [];
    for (const tid of allCastIds) {
      const therapist = therapists.find(t => t.id === tid);
      if (!therapist) continue;
      const shifts = castMap[tid] || [];
      list.push({
        therapistName: therapist.name,
        therapistId: tid,
        shifts,
        message: generateMessage(therapist.name, shifts, dateRange),
        sent: false,
        editing: false,
      });
    }

    list.sort((a, b) => b.shifts.length - a.shifts.length || a.therapistName.localeCompare(b.therapistName));
    setCastList(list);
    setLoading(false);
  }, [startDate, endDate, therapists, rooms, buildings]);

  useEffect(() => {
    if (startDate && endDate) fetchCastData();
  }, [startDate, endDate, fetchCastData]);

  // メッセージ編集
  const updateMessage = (tid: number, msg: string) => {
    setCastList(prev => prev.map(c => c.therapistId === tid ? { ...c, message: msg } : c));
  };

  const toggleEdit = (tid: number) => {
    setCastList(prev => prev.map(c => c.therapistId === tid ? { ...c, editing: !c.editing } : c));
  };

  // クリップボードコピー
  const copyMessage = async (tid: number, msg: string) => {
    try {
      await navigator.clipboard.writeText(msg);
      setCopiedId(tid);
      setTimeout(() => setCopiedId(null), 2000);
    } catch { /* ignore */ }
  };

  // LINE送信（拡張機能経由 or フォールバック）
  const sendLine = (cast: CastData) => {
    // クリップボードに常にコピー（フォールバック用）
    navigator.clipboard.writeText(cast.message).catch(() => {});

    // 拡張機能検知: content_tmanage.jsがbodyにdata-tmanage-extension属性をセット
    const hasExtension = document.body.dataset.tmanageExtension === 'true';

    if (hasExtension) {
      // 拡張機能あり → カスタムイベントで送信
      const event = new CustomEvent("TMANAGE_LINE_SHIFT_SEND", {
        detail: { name: cast.therapistName, template: cast.message },
      });
      window.dispatchEvent(event);
    } else {
      // 拡張機能なし → LINE新タブ + ガイド表示
      const url = lineUrlStaff || "https://chat.line.biz/";
      window.open(url, "_blank");
      alert(`📋 メッセージをコピーしました！\n\n① LINEで「${cast.therapistName}」を検索\n② チャットを開く\n③ Ctrl+V で貼り付けて送信`);
    }

    // 送信済みマーク
    setCastList(prev => prev.map(c => c.therapistId === cast.therapistId ? { ...c, sent: true } : c));
  };

  // 全員送信
  const sendAll = async () => {
    const unsent = castList.filter(c => !c.sent && c.shifts.length > 0);
    if (unsent.length === 0) return;
    if (!confirm(`${unsent.length}名に順番にLINE送信します。\n3秒間隔で送信されます。`)) return;

    setBulkSending(true);
    for (let i = 0; i < unsent.length; i++) {
      sendLine(unsent[i]);
      if (i < unsent.length - 1) {
        await new Promise(r => setTimeout(r, 3000));
      }
    }
    setBulkSending(false);
  };

  // フィルタ
  const filtered = castList.filter(c =>
    !searchFilter || c.therapistName.includes(searchFilter)
  );

  const sentCount = castList.filter(c => c.sent).length;
  const totalWithShifts = castList.filter(c => c.shifts.length > 0).length;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="rounded-2xl w-full max-w-[800px] max-h-[90vh] flex flex-col animate-[fadeIn_0.25s]" style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: T.border }}>
          <div>
            <h2 className="text-[16px] font-medium">💬 確定シフトLINE送信</h2>
            <p className="text-[11px] mt-1" style={{ color: T.textMuted }}>セラピストに確定シフトをLINEで送信します</p>
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

          {/* 操作バー */}
          <div className="flex items-center gap-3 flex-wrap">
            <input
              type="text"
              placeholder="🔍 名前で検索"
              value={searchFilter}
              onChange={e => setSearchFilter(e.target.value)}
              className="px-3 py-1.5 rounded-lg text-[11px] outline-none border"
              style={{ backgroundColor: T.cardAlt, borderColor: T.border, color: T.text, width: 160 }}
            />
            {totalWithShifts > 0 && (
              <button
                onClick={sendAll}
                disabled={bulkSending}
                className="px-4 py-2 rounded-xl text-[12px] font-medium cursor-pointer text-white"
                style={{ backgroundColor: bulkSending ? "#999" : "#06C755" }}
              >
                {bulkSending ? "⏳ 送信中..." : `💬 全員にLINE送信（${totalWithShifts - sentCount}名）`}
              </button>
            )}
            {sentCount > 0 && (
              <span className="text-[11px]" style={{ color: "#22c55e" }}>✅ {sentCount}/{totalWithShifts}名 送信済</span>
            )}
          </div>

          {/* セラピストカード */}
          {loading ? (
            <div className="text-center py-8">
              <p className="text-[12px]" style={{ color: T.textMuted }}>読み込み中...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-[12px]" style={{ color: T.textMuted }}>対象セラピストがいません</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map(cast => (
                <div key={cast.therapistId} className="rounded-xl p-3 transition-all" style={{
                  backgroundColor: T.card,
                  border: `1px solid ${cast.sent ? "#22c55e44" : T.border}`,
                }}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-medium">{cast.therapistName}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: cast.shifts.length > 0 ? "#22c55e18" : "#f59e0b18", color: cast.shifts.length > 0 ? "#22c55e" : "#f59e0b" }}>
                        {cast.shifts.length > 0 ? `${cast.shifts.length}日出勤` : "出勤なし"}
                      </span>
                      {cast.sent && <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: "#22c55e18", color: "#22c55e" }}>✅ 送信済</span>}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => toggleEdit(cast.therapistId)} className="px-2.5 py-1 text-[10px] rounded-lg cursor-pointer" style={{ backgroundColor: T.cardAlt, color: T.textSub, border: `1px solid ${T.border}` }}>
                        {cast.editing ? "📄 閉じる" : "✏️ 編集"}
                      </button>
                      <button onClick={() => copyMessage(cast.therapistId, cast.message)} className="px-2.5 py-1 text-[10px] rounded-lg cursor-pointer" style={{ backgroundColor: copiedId === cast.therapistId ? "#22c55e18" : T.cardAlt, color: copiedId === cast.therapistId ? "#22c55e" : T.textSub, border: `1px solid ${copiedId === cast.therapistId ? "#22c55e44" : T.border}` }}>
                        {copiedId === cast.therapistId ? "✅ コピー済" : "📋 コピー"}
                      </button>
                      <button onClick={() => sendLine(cast)} disabled={bulkSending} className="px-3 py-1 text-[10px] rounded-lg cursor-pointer font-medium text-white" style={{ backgroundColor: cast.sent ? "#999" : "#06C755" }}>
                        💬 LINE送信
                      </button>
                    </div>
                  </div>

                  {/* シフト概要 */}
                  {!cast.editing && cast.shifts.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-1">
                      {cast.shifts.map((s, i) => (
                        <span key={i} className="text-[10px] px-2 py-0.5 rounded" style={{ backgroundColor: T.cardAlt, color: T.textSub }}>
                          {s.dateLabel} {s.startTime}〜{s.endTime} {s.room}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* 編集モード */}
                  {cast.editing && (
                    <textarea
                      value={cast.message}
                      onChange={e => updateMessage(cast.therapistId, e.target.value)}
                      className="w-full mt-1 p-3 rounded-xl text-[11px] outline-none border resize-none leading-relaxed"
                      style={{ backgroundColor: T.cardAlt, borderColor: T.border, color: T.text, minHeight: 200, fontFamily: "monospace" }}
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
