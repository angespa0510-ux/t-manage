"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "./supabase";

// ========================================
// Types
// ========================================
type Therapist = { id: number; name: string; phone: string; status: string; has_withholding: boolean; interval_minutes?: number };
type Reservation = { id: number; customer_name: string; therapist_id: number; date: string; start_time: string; end_time: string; course: string; notes: string };
type Shift = { id: number; therapist_id: number; store_id: number; date: string; start_time: string; end_time: string; status: string };
type Building = { id: number; store_id: number; name: string };
type Room = { id: number; store_id: number; building_id: number; name: string };
type RoomAssign = { id: number; date: string; room_id: number; therapist_id: number; slot: string };
type Store = { id: number; name: string };

type TherapistSlot = {
  id: number;
  name: string;
  nextSlot: string; // "25:00〜" or "完売✨"
  emoji: string;
  workEnd: number; // in minutes from midnight
  isSoldOut: boolean;
};

type SokuhoProps = {
  show: boolean;
  onClose: () => void;
  therapists: Therapist[];
  reservations: Reservation[];
  shifts: Shift[];
  stores: Store[];
  buildings: Building[];
  allRooms: Room[];
  roomAssigns: RoomAssign[];
  clockedOut: Set<number>;
  selectedDate: string;
  T: Record<string, string>;
  dark: boolean;
};

// ========================================
// Constants
// ========================================
const ROOMS_CONFIG: Record<string, { name: string; area: string; keywords: RegExp }> = {
  mikawa: {
    name: "三河安城ルーム",
    area: "三河安城エリアで極上のリラクゼーションを✨",
    keywords: /オアシス|マイコート|三河安城/,
  },
  toyohashi: {
    name: "豊橋ルーム",
    area: "豊橋エリアでゆったりとしたひとときを✨",
    keywords: /リングセレクト|豊橋/,
  },
};

const CONTACT = {
  tel: "070-1675-5900",
  line: "lin.ee/tJtwJL9",
  web: "angespa.short.gy/vE1urg",
};

const MIN_COURSE = 60; // 最短コース60分
const DEFAULT_INTERVAL = 15; // デフォルトインターバル15分

// ========================================
// Time utility functions
// ========================================

/** HH:MM → 分（深夜0-5時は+24h） */
function toMinsNight(t: string): number {
  const [hStr, mStr] = t.split(":");
  let h = parseInt(hStr);
  const m = parseInt(mStr);
  if (h < 6) h += 24;
  return h * 60 + m;
}

/** 分 → 表示用文字列（24h超対応: 25:00等） */
function minsToDisplay(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}

/** 現在時刻を分で取得（深夜対応） */
function getNowMins(): number {
  const now = new Date();
  let h = now.getHours();
  const m = now.getMinutes();
  if (h < 6) h += 24;
  return h * 60 + m;
}

/** 次の案内可能時間を計算 */
function calcNextSlot(
  workStart: number,
  workEnd: number,
  bookings: { start: number; end: number }[],
  interval: number,
  nowMins: number
): string {
  const sorted = [...bookings].sort((a, b) => a.start - b.start);

  // 候補: シフト開始、各予約終了+インターバル
  const candidates = [workStart, ...sorted.map((b) => b.end + interval)];

  for (const c of candidates) {
    const slotStart = Math.max(c, nowMins);

    // 勤務時間内か？
    if (slotStart + MIN_COURSE > workEnd) continue;

    // 既存予約と被らないか？
    let conflict = false;
    for (const b of sorted) {
      // スロット開始が予約の範囲内（or インターバル内）に重なっていないか
      if (slotStart < b.end + interval && slotStart + MIN_COURSE > b.start) {
        conflict = true;
        break;
      }
    }
    if (!conflict) {
      return minsToDisplay(slotStart) + "〜";
    }
  }

  return "完売✨";
}

// ========================================
// Bluesky API
// ========================================

/** Blueskyのfacets（リンク化）を生成 */
function buildFacets(text: string) {
  const facets: any[] = [];
  const encoder = new TextEncoder();
  const bytes = encoder.encode(text);

  // URL正規表現（https:// 付き、またはlin.ee/ angespa.short.gy/ で始まるもの）
  const urlPatterns = [
    /https?:\/\/[^\s\u3000）」』】\]]+/g,
    /lin\.ee\/[^\s\u3000）」』】\]]+/g,
    /angespa\.short\.gy\/[^\s\u3000）」』】\]]+/g,
  ];

  for (const pattern of urlPatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const matchText = match[0];
      const uri = matchText.startsWith("http") ? matchText : `https://${matchText}`;

      // バイトオフセットを計算
      const beforeText = text.substring(0, match.index);
      const byteStart = encoder.encode(beforeText).length;
      const byteEnd = byteStart + encoder.encode(matchText).length;

      facets.push({
        index: { byteStart, byteEnd },
        features: [{ $type: "app.bsky.richtext.facet#link", uri }],
      });
    }
  }

  return facets;
}

async function postToBluesky(id: string, pw: string, text: string): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. 認証
    const authRes = await fetch("https://bsky.social/xrpc/com.atproto.server.createSession", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: id, password: pw }),
    });
    if (!authRes.ok) {
      const err = await authRes.json().catch(() => ({}));
      return { success: false, error: `認証失敗: ${err.message || authRes.status}` };
    }
    const session = await authRes.json();

    // 2. Facets生成
    const facets = buildFacets(text);

    // 3. 投稿
    const postRes = await fetch("https://bsky.social/xrpc/com.atproto.repo.createRecord", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.accessJwt}`,
      },
      body: JSON.stringify({
        repo: session.did,
        collection: "app.bsky.feed.post",
        record: {
          $type: "app.bsky.feed.post",
          text,
          facets,
          createdAt: new Date().toISOString(),
        },
      }),
    });

    if (!postRes.ok) {
      const err = await postRes.json().catch(() => ({}));
      return { success: false, error: `投稿失敗: ${err.message || postRes.status}` };
    }

    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message || "ネットワークエラー" };
  }
}

// ========================================
// Main Component
// ========================================
export function SokuhoPanel({
  show, onClose, therapists, reservations, shifts, stores, buildings, allRooms, roomAssigns, clockedOut, selectedDate, T, dark,
}: SokuhoProps) {
  const [currentRoom, setCurrentRoom] = useState<"mikawa" | "toyohashi">("mikawa");
  const [slots, setSlots] = useState<TherapistSlot[]>([]);
  const [bskyId, setBskyId] = useState("");
  const [bskyPw, setBskyPw] = useState("");
  const [estamaIdMikawa, setEstamaIdMikawa] = useState("");
  const [estamaPwMikawa, setEstamaPwMikawa] = useState("");
  const [estamaIdToyohashi, setEstamaIdToyohashi] = useState("");
  const [estamaPwToyohashi, setEstamaPwToyohashi] = useState("");
  const [posting, setPosting] = useState(false);
  const [postResult, setPostResult] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const dragOverIdx = useRef<number | null>(null);

  // Load credentials from store_settings
  useEffect(() => {
    const loadCredentials = async () => {
      const { data } = await supabase.from("store_settings").select("key,value").in("key", [
        "bsky_id", "bsky_pw", "estama_id_mikawa", "estama_pw_mikawa", "estama_id_toyohashi", "estama_pw_toyohashi"
      ]);
      if (data) {
        for (const s of data) {
          if (s.key === "bsky_id") setBskyId(s.value);
          if (s.key === "bsky_pw") setBskyPw(s.value);
          if (s.key === "estama_id_mikawa") setEstamaIdMikawa(s.value);
          if (s.key === "estama_pw_mikawa") setEstamaPwMikawa(s.value);
          if (s.key === "estama_id_toyohashi") setEstamaIdToyohashi(s.value);
          if (s.key === "estama_pw_toyohashi") setEstamaPwToyohashi(s.value);
        }
      }
    };
    if (show) {
      loadCredentials();
      setPostResult(null);

      // 自動ルーム選択: セラピストがいるルームを優先
      const shiftIds = new Set(shifts.map(s => s.therapist_id));
      let mikawaCount = 0, toyohashiCount = 0;
      for (const t of therapists) {
        if (!shiftIds.has(t.id) || clockedOut.has(t.id)) continue;
        const ra = roomAssigns.find(a => a.therapist_id === t.id);
        if (!ra) continue;
        const rm = allRooms.find(r => r.id === ra.room_id);
        if (!rm) continue;
        const bl = buildings.find(b => b.id === rm.building_id);
        const st = stores.find(s => s.id === rm.store_id);
        const combined = `${bl?.name || ""} ${st?.name || ""} ${rm.name || ""}`;
        if (ROOMS_CONFIG.toyohashi.keywords.test(combined) || st?.name?.includes("豊橋")) toyohashiCount++;
        else mikawaCount++;
      }
      if (toyohashiCount > 0 && mikawaCount === 0) setCurrentRoom("toyohashi");
      else setCurrentRoom("mikawa");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show]);

  // ========================================
  // Determine room for each therapist
  // ========================================
  const getRoomKey = useCallback(
    (therapistId: number): "mikawa" | "toyohashi" | null => {
      const ra = roomAssigns.find((a) => a.therapist_id === therapistId);
      if (!ra) return null;
      const rm = allRooms.find((r) => r.id === ra.room_id);
      if (!rm) return null;
      const bl = buildings.find((b) => b.id === rm.building_id);
      const st = stores.find((s) => s.id === rm.store_id);
      const combined = `${bl?.name || ""} ${st?.name || ""} ${rm.name || ""}`;
      if (ROOMS_CONFIG.mikawa.keywords.test(combined)) return "mikawa";
      if (ROOMS_CONFIG.toyohashi.keywords.test(combined)) return "toyohashi";
      // デフォルト: store_idで判定
      if (st?.name?.includes("豊橋")) return "toyohashi";
      return "mikawa";
    },
    [roomAssigns, allRooms, buildings, stores]
  );

  // ========================================
  // Calculate available slots
  // ========================================
  const calculateSlots = useCallback(() => {
    const nowMins = getNowMins();
    const shiftTherapistIds = new Set(shifts.map((s) => s.therapist_id));
    const result: TherapistSlot[] = [];

    for (const t of therapists) {
      if (!shiftTherapistIds.has(t.id)) continue;
      if (clockedOut.has(t.id)) continue;

      const roomKey = getRoomKey(t.id);
      if (roomKey !== currentRoom) continue;

      const shift = shifts.find((s) => s.therapist_id === t.id);
      if (!shift) continue;

      const workStart = toMinsNight(shift.start_time);
      const workEnd = toMinsNight(shift.end_time);

      // 予約を取得
      const tReservations = reservations.filter((r) => r.therapist_id === t.id);
      const bookings = tReservations.map((r) => ({
        start: toMinsNight(r.start_time),
        end: toMinsNight(r.end_time),
      }));

      const interval = (t as any).interval_minutes || DEFAULT_INTERVAL;
      const nextSlot = calcNextSlot(workStart, workEnd, bookings, interval, nowMins);
      const isSoldOut = nextSlot === "完売✨";

      // 完売かつ退勤済み（勤務終了後）はスキップ
      if (isSoldOut && nowMins > workEnd) continue;

      result.push({
        id: t.id,
        name: t.name,
        nextSlot,
        emoji: "🌈",
        workEnd,
        isSoldOut,
      });
    }

    // ソート: 案内可能（時間順）→ 完売
    result.sort((a, b) => {
      if (a.isSoldOut && !b.isSoldOut) return 1;
      if (!a.isSoldOut && b.isSoldOut) return -1;
      return 0;
    });

    setSlots(result);
  }, [therapists, reservations, shifts, clockedOut, currentRoom, getRoomKey]);

  useEffect(() => {
    if (show) calculateSlots();
  }, [show, calculateSlots]);

  // ========================================
  // Toggle emoji
  // ========================================
  const toggleEmoji = (idx: number) => {
    setSlots((prev) => prev.map((s, i) => (i === idx ? { ...s, emoji: s.emoji === "🌈" ? "🟧" : "🌈" } : s)));
  };

  // ========================================
  // Drag & Drop
  // ========================================
  const handleDragStart = (idx: number) => setDragIdx(idx);
  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    dragOverIdx.current = idx;
  };
  const handleDrop = (targetIdx: number) => {
    if (dragIdx === null || dragIdx === targetIdx) return;
    setSlots((prev) => {
      const next = [...prev];
      const [item] = next.splice(dragIdx, 1);
      next.splice(targetIdx, 0, item);
      return next;
    });
    setDragIdx(null);
    dragOverIdx.current = null;
  };
  const handleTouchMove = useRef<{ idx: number; startY: number } | null>(null);

  // ========================================
  // Generate post text
  // ========================================
  const generateText = useCallback(() => {
    const config = ROOMS_CONFIG[currentRoom];
    const now = new Date();
    const days = ["日", "月", "火", "水", "木", "金", "土"];
    const d = new Date(selectedDate + "T00:00:00");
    const dateStr = `${d.getMonth() + 1}月${d.getDate()}日(${days[d.getDay()]})`;

    const lines = slots.map((s) => `${s.emoji}${s.name} ${s.nextSlot}`);

    const text = [
      `☀️ ${dateStr} ${config.name} ☀️`,
      "",
      config.area,
      "本日の出勤セラピストはこちらです。",
      "",
      ...lines,
      "",
      `📞 ${config.name}のご予約`,
      `📟 TEL: ${CONTACT.tel}`,
      `💬 公式LINE: ${CONTACT.line}`,
      `💻 WEB予約: ${CONTACT.web}`,
    ].join("\n");

    return text;
  }, [slots, currentRoom, selectedDate]);

  // ========================================
  // Post to Bluesky
  // ========================================
  const handlePostBluesky = async () => {
    if (!bskyId || !bskyPw) {
      setPostResult({ type: "error", msg: "Bluesky IDとパスワードを設定してください（⚙️ボタン）" });
      return;
    }
    const text = generateText();
    // Blueskyのグラフェム制限（300文字）チェック
    const segmenter = typeof Intl !== "undefined" && Intl.Segmenter
      ? new Intl.Segmenter("ja", { granularity: "grapheme" })
      : null;
    const graphemeCount = segmenter
      ? [...segmenter.segment(text)].length
      : text.length;
    if (graphemeCount > 300) {
      if (!confirm(`テキストが${graphemeCount}文字です（Bluesky上限300文字）。\n投稿するとエラーになる可能性があります。続行しますか？`)) return;
    }
    setPosting(true);
    setPostResult(null);
    const result = await postToBluesky(bskyId, bskyPw, text);
    if (result.success) {
      setPostResult({ type: "success", msg: "Blueskyに投稿しました！" });
    } else {
      setPostResult({ type: "error", msg: result.error || "投稿に失敗しました" });
    }
    setPosting(false);
  };

  // ========================================
  // Save Bluesky credentials
  // ========================================
  const saveCredentials = async () => {
    await supabase.from("store_settings").upsert({ key: "bsky_id", value: bskyId }, { onConflict: "key" });
    await supabase.from("store_settings").upsert({ key: "bsky_pw", value: bskyPw }, { onConflict: "key" });
    setShowSettings(false);
    setPostResult({ type: "success", msg: "認証情報を保存しました" });
  };

  // ========================================
  // エステ魂 ワンクリック投稿
  // ========================================

  const getEstamaTitle = () => {
    const now = new Date();
    const h = now.getHours() < 6 ? now.getHours() + 24 : now.getHours();
    const m = String(now.getMinutes()).padStart(2, "0");
    return `☀️只今のご案内状況 ${h}:${m}☀️`.slice(0, 30);
  };

  const handleEstamaPost = () => {
    const estamaId = currentRoom === "toyohashi" ? estamaIdToyohashi : estamaIdMikawa;
    const estamaPw = currentRoom === "toyohashi" ? estamaPwToyohashi : estamaPwMikawa;

    if (!estamaId || !estamaPw) {
      setPostResult({ type: "error", msg: `エステ魂（${currentRoom === "toyohashi" ? "豊橋" : "三河安城"}）のID/PWが未設定です。システム設定→速報タブで設定してください` });
      return;
    }

    const title = getEstamaTitle();
    const content = generateText();

    // localStorageに保存してブリッジページへ
    localStorage.setItem("estama_post_data", JSON.stringify({
      room: currentRoom,
      title,
      content,
      estamaId,
      estamaPw,
    }));

    window.open("/estama-bridge", "_blank");
    setPostResult({ type: "success", msg: "エステ魂ブリッジを開きました" });
  };

  if (!show) return null;

  const previewText = generateText();
  const roomConfig = ROOMS_CONFIG[currentRoom];
  const inputStyle = { backgroundColor: T.cardAlt, color: T.text, border: `1px solid ${T.border}` };

  // 案内可能人数
  const availableCount = slots.filter((s) => !s.isSoldOut).length;
  const soldOutCount = slots.filter((s) => s.isSoldOut).length;

  // ルーム別のセラピスト数を計算
  const roomCounts = (() => {
    const shiftIds = new Set(shifts.map(s => s.therapist_id));
    const counts = { mikawa: 0, toyohashi: 0 };
    for (const t of therapists) {
      if (!shiftIds.has(t.id) || clockedOut.has(t.id)) continue;
      const rk = getRoomKey(t.id);
      if (rk === "mikawa") counts.mikawa++;
      else if (rk === "toyohashi") counts.toyohashi++;
    }
    return counts;
  })();

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="rounded-2xl shadow-2xl w-full max-w-[520px] max-h-[90vh] overflow-hidden flex flex-col"
        style={{ backgroundColor: T.card }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="px-6 py-4 flex items-center justify-between"
          style={{
            background: "linear-gradient(135deg, #ff6b9d22, #c44dff22, #6b8bff22)",
            borderBottom: `1px solid ${T.border}`,
          }}
        >
          <div>
            <h2 className="text-[16px] font-semibold" style={{ color: T.text }}>
              📢 リアルタイム速報
            </h2>
            <p className="text-[10px] mt-0.5" style={{ color: T.textFaint }}>
              案内時間を自動計算 → Bluesky / エステ魂に投稿
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="text-[10px] px-2 py-1 rounded-lg cursor-pointer"
              style={{ backgroundColor: T.cardAlt, color: T.textSub, border: `1px solid ${T.border}` }}
            >
              ⚙️
            </button>
            <button onClick={onClose} className="text-[16px] cursor-pointer p-1.5" style={{ color: T.textSub }}>
              ✕
            </button>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
          {/* Settings (collapsible) */}
          {showSettings && (
            <div className="rounded-xl p-4 space-y-3" style={{ backgroundColor: T.cardAlt, border: `1px solid ${T.border}` }}>
              <p className="text-[12px] font-medium" style={{ color: T.text }}>🔑 Bluesky認証設定</p>
              <div>
                <label className="block text-[10px] mb-1" style={{ color: T.textFaint }}>Bluesky ID</label>
                <input
                  type="text"
                  value={bskyId}
                  onChange={(e) => setBskyId(e.target.value)}
                  placeholder="your-handle.bsky.social"
                  className="w-full px-3 py-2 rounded-lg text-[12px] outline-none"
                  style={inputStyle}
                />
              </div>
              <div>
                <label className="block text-[10px] mb-1" style={{ color: T.textFaint }}>パスワード（App Password推奨）</label>
                <input
                  type="password"
                  value={bskyPw}
                  onChange={(e) => setBskyPw(e.target.value)}
                  placeholder="xxxx-xxxx-xxxx-xxxx"
                  className="w-full px-3 py-2 rounded-lg text-[12px] outline-none"
                  style={inputStyle}
                />
              </div>
              <button
                onClick={saveCredentials}
                className="px-4 py-2 rounded-lg text-[11px] font-medium cursor-pointer"
                style={{ backgroundColor: "#3b82f618", color: "#3b82f6", border: "1px solid #3b82f644" }}
              >
                💾 保存
              </button>
            </div>
          )}

          {/* Room tabs */}
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentRoom("mikawa")}
              className="flex-1 py-2.5 rounded-xl text-[12px] font-medium cursor-pointer transition-all"
              style={{
                backgroundColor: currentRoom === "mikawa" ? "#ff6b9d18" : T.cardAlt,
                color: currentRoom === "mikawa" ? "#ff6b9d" : T.textMuted,
                border: `1px solid ${currentRoom === "mikawa" ? "#ff6b9d44" : T.border}`,
              }}
            >
              🏠 三河安城ルーム{roomCounts.mikawa > 0 && <span className="ml-1 text-[10px] opacity-70">({roomCounts.mikawa})</span>}
            </button>
            <button
              onClick={() => setCurrentRoom("toyohashi")}
              className="flex-1 py-2.5 rounded-xl text-[12px] font-medium cursor-pointer transition-all"
              style={{
                backgroundColor: currentRoom === "toyohashi" ? "#6b8bff18" : T.cardAlt,
                color: currentRoom === "toyohashi" ? "#6b8bff" : T.textMuted,
                border: `1px solid ${currentRoom === "toyohashi" ? "#6b8bff44" : T.border}`,
              }}
            >
              🏠 豊橋ルーム{roomCounts.toyohashi > 0 && <span className="ml-1 text-[10px] opacity-70">({roomCounts.toyohashi})</span>}
            </button>
          </div>

          {/* Status summary */}
          <div className="flex gap-3 text-[11px]" style={{ color: T.textSub }}>
            <span>
              出勤: <strong style={{ color: T.text }}>{slots.length}</strong>名
            </span>
            <span>
              案内可能: <strong style={{ color: "#22c55e" }}>{availableCount}</strong>名
            </span>
            {soldOutCount > 0 && (
              <span>
                完売: <strong style={{ color: "#f59e0b" }}>{soldOutCount}</strong>名
              </span>
            )}
            <button
              onClick={calculateSlots}
              className="ml-auto text-[10px] px-2 py-0.5 rounded cursor-pointer"
              style={{ backgroundColor: T.cardAlt, color: T.textMuted, border: `1px solid ${T.border}` }}
            >
              🔄 再計算
            </button>
          </div>

          {/* Therapist list (drag & drop) */}
          <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${T.border}` }}>
            {slots.length === 0 ? (
              <div className="p-6 text-center text-[12px]" style={{ color: T.textMuted }}>
                このルームに出勤中のセラピストはいません
              </div>
            ) : (
              slots.map((s, idx) => (
                <div
                  key={s.id}
                  draggable
                  onDragStart={() => handleDragStart(idx)}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDrop={() => handleDrop(idx)}
                  className="flex items-center gap-2 px-3 py-2.5 cursor-grab active:cursor-grabbing transition-colors"
                  style={{
                    backgroundColor: dragIdx === idx ? (dark ? "#333" : "#f0f0f0") : T.card,
                    borderBottom: idx < slots.length - 1 ? `1px solid ${T.border}` : "none",
                    opacity: s.isSoldOut ? 0.6 : 1,
                  }}
                >
                  {/* Drag handle */}
                  <span className="text-[14px] select-none" style={{ color: T.textFaint, cursor: "grab" }}>
                    ⠿
                  </span>

                  {/* Emoji toggle */}
                  <button
                    onClick={() => toggleEmoji(idx)}
                    className="text-[16px] cursor-pointer select-none"
                    style={{ background: "none", border: "none", padding: 0 }}
                  >
                    {s.emoji}
                  </button>

                  {/* Name */}
                  <span className="text-[13px] font-medium flex-1 min-w-0 truncate" style={{ color: T.text }}>
                    {s.name}
                  </span>

                  {/* Time slot */}
                  <span
                    className="text-[13px] font-semibold"
                    style={{ color: s.isSoldOut ? "#f59e0b" : "#22c55e" }}
                  >
                    {s.nextSlot}
                  </span>
                </div>
              ))
            )}
          </div>

          {/* Text preview */}
          {(() => {
            const segmenter = typeof Intl !== "undefined" && Intl.Segmenter
              ? new Intl.Segmenter("ja", { granularity: "grapheme" }) : null;
            const charCount = segmenter ? [...segmenter.segment(previewText)].length : previewText.length;
            const isOver = charCount > 300;
            return (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[10px]" style={{ color: T.textFaint }}>📋 投稿プレビュー</p>
                <span className="text-[10px]" style={{ color: isOver ? "#ef4444" : T.textFaint }}>
                  {charCount}/300文字{isOver ? " ⚠️ Bluesky上限超過" : ""}
                </span>
              </div>
              <div
                className="rounded-xl p-4 text-[11px] whitespace-pre-wrap leading-relaxed max-h-[200px] overflow-y-auto"
                style={{
                  backgroundColor: T.cardAlt, color: T.textSub,
                  fontFamily: "var(--font-mono, monospace)",
                  border: `1px solid ${isOver ? "#ef444444" : T.border}`,
                }}
              >
                {previewText}
              </div>
            </div>);
          })()}

          {/* Result message */}
          {postResult && (
            <div
              className="rounded-xl p-3 text-[11px]"
              style={{
                backgroundColor: postResult.type === "success" ? "#22c55e12" : "#ef444412",
                color: postResult.type === "success" ? "#22c55e" : "#ef4444",
                border: `1px solid ${postResult.type === "success" ? "#22c55e33" : "#ef444433"}`,
              }}
            >
              {postResult.type === "success" ? "✅ " : "❌ "}
              {postResult.msg}
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="px-6 py-4 space-y-2" style={{ borderTop: `1px solid ${T.border}` }}>
          <div className="flex gap-2">
            {/* Bluesky */}
            <button
              onClick={handlePostBluesky}
              disabled={posting || slots.length === 0}
              className="flex-1 py-3 rounded-xl text-[13px] font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: "#3b82f618", color: "#3b82f6", border: "1px solid #3b82f644" }}
            >
              {posting ? "投稿中..." : "🦋 Bluesky投稿"}
            </button>

            {/* エステ魂 ワンクリック */}
            <button
              onClick={handleEstamaPost}
              disabled={slots.length === 0}
              className="flex-1 py-3 rounded-xl text-[13px] font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: "#ec489918", color: "#ec4899", border: "1px solid #ec489944" }}
            >
              💅 エステ魂投稿
            </button>
          </div>

          <button
            onClick={() => {
              navigator.clipboard.writeText(previewText);
              setPostResult({ type: "success", msg: "テキストをコピーしました" });
            }}
            disabled={slots.length === 0}
            className="w-full py-2 rounded-xl text-[11px] cursor-pointer disabled:opacity-50"
            style={{ color: T.textMuted, backgroundColor: T.cardAlt }}
          >
            📋 テキストだけコピー
          </button>
        </div>
      </div>
    </div>
  );
}
