"use client";
import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { useTheme } from "../../lib/theme";
import { NavMenu } from "../../lib/nav-menu";
import { useStaffSession } from "../../lib/staff-session";

type NotificationLog = {
  id: number;
  created_at: string;
  channel: string;
  recipient_type: string;
  recipient_name: string;
  recipient_phone: string;
  recipient_email: string;
  therapist_id: number | null;
  message_type: string;
  subject: string;
  body: string;
  body_preview: string;
  reservation_id: number | null;
  reservation_date: string | null;
  sent_by_staff_id: number | null;
  sent_by_name: string;
  status: string;
};

const channelMeta: Record<string, { label: string; icon: string; color: string }> = {
  line:            { label: "LINE",              icon: "💬", color: "#06C755" },
  sms1:            { label: "SMS①",              icon: "📱", color: "#f59e0b" },
  sms2:            { label: "SMS②(Edge)",        icon: "📲", color: "#8b5cf6" },
  gmail:           { label: "Gmail",             icon: "✉️", color: "#3b82f6" },
  copy:            { label: "コピー",            icon: "📋", color: "#888780" },
  therapist_line:  { label: "セラピストLINE",    icon: "💬", color: "#85a8c4" },
  bulk_therapist:  { label: "一括セラピスト",    icon: "📢", color: "#a855f7" },
  other:           { label: "その他",            icon: "📨", color: "#888780" },
};

const msgTypeMeta: Record<string, { label: string; color: string }> = {
  summary:  { label: "概要",   color: "#3b82f6" },
  detail:   { label: "詳細",   color: "#4a7c59" },
  shift:    { label: "シフト", color: "#c3a782" },
  bulk:     { label: "一括",   color: "#a855f7" },
  "":       { label: "その他", color: "#888780" },
};

export default function NotificationDashboardPage() {
  const router = useRouter();
  const { dark, toggle, T } = useTheme();
  const { activeStaff, isManager } = useStaffSession();
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<NotificationLog | null>(null);

  // フィルタ
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split("T")[0];
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split("T")[0]);
  const [channelFilter, setChannelFilter] = useState<string>("");
  const [msgTypeFilter, setMsgTypeFilter] = useState<string>("");
  const [recipientTypeFilter, setRecipientTypeFilter] = useState<string>("");
  const [searchText, setSearchText] = useState("");

  useEffect(() => {
    if (!activeStaff) { router.push("/dashboard"); return; }
    if (!isManager) { router.push("/dashboard"); return; }
  }, [activeStaff, isManager, router]);

  useEffect(() => {
    const fetchLogs = async () => {
      setLoading(true);
      const from = new Date(dateFrom + "T00:00:00").toISOString();
      const to = new Date(dateTo + "T23:59:59").toISOString();
      let q = supabase
        .from("notification_logs")
        .select("*")
        .gte("created_at", from)
        .lte("created_at", to)
        .order("created_at", { ascending: false })
        .limit(500);
      const { data } = await q;
      if (data) setLogs(data);
      setLoading(false);
    };
    fetchLogs();
  }, [dateFrom, dateTo]);

  // フィルタリング済みログ
  const filteredLogs = useMemo(() => {
    return logs.filter(l => {
      if (channelFilter && l.channel !== channelFilter) return false;
      if (msgTypeFilter && (l.message_type || "") !== msgTypeFilter) return false;
      if (recipientTypeFilter && l.recipient_type !== recipientTypeFilter) return false;
      if (searchText) {
        const q = searchText.toLowerCase();
        const hit = (l.recipient_name || "").toLowerCase().includes(q)
          || (l.recipient_phone || "").includes(q)
          || (l.body || "").toLowerCase().includes(q)
          || (l.sent_by_name || "").toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });
  }, [logs, channelFilter, msgTypeFilter, recipientTypeFilter, searchText]);

  // サマリー集計
  const summary = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    const todayCount = logs.filter(l => l.created_at.startsWith(today)).length;
    const totalCount = logs.length;
    const byChannel: Record<string, number> = {};
    logs.forEach(l => { byChannel[l.channel] = (byChannel[l.channel] || 0) + 1; });
    return { todayCount, totalCount, byChannel };
  }, [logs]);

  const formatDateTime = (iso: string) => {
    const d = new Date(iso);
    const m = d.getMonth() + 1;
    const day = d.getDate();
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${m}/${day} ${hh}:${mm}`;
  };

  if (!activeStaff || !isManager) return null;

  return (
    <div className="min-h-screen" style={{ backgroundColor: T.bg, color: T.text }}>
      {/* Header */}
      <div className="h-[64px] backdrop-blur-xl border-b flex items-center justify-between px-6" style={{ backgroundColor: dark ? T.card + "cc" : "rgba(255,255,255,0.8)", borderColor: T.border }}>
        <div className="flex items-center gap-4">
          <NavMenu T={T} dark={dark} />
          <h1 className="text-[18px] font-medium">📢 通知ダッシュボード</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={toggle} className="px-3 py-1.5 text-[10px] rounded-lg cursor-pointer border" style={{ borderColor: T.border, color: T.textSub }}>
            {dark ? "☀️ ライト" : "🌙 ダーク"}
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-6 space-y-4">
        {/* 説明 */}
        <div className="rounded-xl p-3" style={{ backgroundColor: "#85a8c412", border: "1px solid #85a8c433" }}>
          <p className="text-[11px]" style={{ color: T.textSub }}>
            タイムチャートのSMS/LINE送信ボタンを押した履歴を時系列で表示します。
            クリップボードへのコピー時点で記録されます（実際の送信完了は別途確認が必要）。
          </p>
        </div>

        {/* サマリーカード */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-xl p-4" style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}>
            <p className="text-[10px] mb-1" style={{ color: T.textMuted }}>本日の送信</p>
            <p className="text-[22px] font-medium tabular-nums">{summary.todayCount}<span className="text-[10px] ml-1 font-normal" style={{ color: T.textMuted }}>件</span></p>
          </div>
          <div className="rounded-xl p-4" style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}>
            <p className="text-[10px] mb-1" style={{ color: T.textMuted }}>期間内合計</p>
            <p className="text-[22px] font-medium tabular-nums">{summary.totalCount}<span className="text-[10px] ml-1 font-normal" style={{ color: T.textMuted }}>件</span></p>
          </div>
          {(["line", "sms2"] as const).map(ch => {
            const meta = channelMeta[ch];
            return (
              <div key={ch} className="rounded-xl p-4" style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}>
                <p className="text-[10px] mb-1" style={{ color: T.textMuted }}>{meta.icon} {meta.label}</p>
                <p className="text-[22px] font-medium tabular-nums" style={{ color: meta.color }}>{summary.byChannel[ch] || 0}<span className="text-[10px] ml-1 font-normal" style={{ color: T.textMuted }}>件</span></p>
              </div>
            );
          })}
        </div>

        {/* フィルタ */}
        <div className="rounded-xl p-4 space-y-3" style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-[10px]" style={{ color: T.textMuted }}>期間</span>
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="text-[11px] px-2 py-1 rounded border outline-none" style={{ backgroundColor: T.cardAlt, borderColor: T.border, color: T.text }} />
              <span className="text-[10px]" style={{ color: T.textMuted }}>〜</span>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="text-[11px] px-2 py-1 rounded border outline-none" style={{ backgroundColor: T.cardAlt, borderColor: T.border, color: T.text }} />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px]" style={{ color: T.textMuted }}>チャネル</span>
              <select value={channelFilter} onChange={(e) => setChannelFilter(e.target.value)} className="text-[11px] px-2 py-1 rounded border outline-none cursor-pointer" style={{ backgroundColor: T.cardAlt, borderColor: T.border, color: T.text }}>
                <option value="">すべて</option>
                {Object.entries(channelMeta).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px]" style={{ color: T.textMuted }}>種別</span>
              <select value={msgTypeFilter} onChange={(e) => setMsgTypeFilter(e.target.value)} className="text-[11px] px-2 py-1 rounded border outline-none cursor-pointer" style={{ backgroundColor: T.cardAlt, borderColor: T.border, color: T.text }}>
                <option value="">すべて</option>
                <option value="summary">概要</option>
                <option value="detail">詳細</option>
                <option value="shift">シフト</option>
                <option value="bulk">一括</option>
                <option value="">その他</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px]" style={{ color: T.textMuted }}>宛先</span>
              <select value={recipientTypeFilter} onChange={(e) => setRecipientTypeFilter(e.target.value)} className="text-[11px] px-2 py-1 rounded border outline-none cursor-pointer" style={{ backgroundColor: T.cardAlt, borderColor: T.border, color: T.text }}>
                <option value="">すべて</option>
                <option value="customer">お客様</option>
                <option value="therapist">セラピスト</option>
                <option value="other">その他</option>
              </select>
            </div>
            <input
              type="text"
              placeholder="🔍 名前・電話・本文で検索"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="flex-1 min-w-[200px] text-[11px] px-3 py-1.5 rounded border outline-none"
              style={{ backgroundColor: T.cardAlt, borderColor: T.border, color: T.text }}
            />
            {(channelFilter || msgTypeFilter || recipientTypeFilter || searchText) && (
              <button
                onClick={() => { setChannelFilter(""); setMsgTypeFilter(""); setRecipientTypeFilter(""); setSearchText(""); }}
                className="text-[10px] px-2 py-1.5 rounded cursor-pointer"
                style={{ color: T.textSub, border: `1px solid ${T.border}` }}
              >
                ✕ リセット
              </button>
            )}
          </div>
          <p className="text-[10px]" style={{ color: T.textMuted }}>{filteredLogs.length} 件表示中（最大500件）</p>
        </div>

        {/* ログ一覧 */}
        <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: T.card, borderColor: T.border }}>
          {loading ? (
            <div className="text-center py-12 text-[12px]" style={{ color: T.textMuted }}>読み込み中...</div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-12 text-[12px]" style={{ color: T.textMuted }}>
              該当する通知ログはありません
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]" style={{ borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ backgroundColor: T.cardAlt }}>
                    <th className="text-left px-3 py-2 font-medium" style={{ color: T.textSub, borderBottom: `1px solid ${T.border}` }}>送信日時</th>
                    <th className="text-left px-3 py-2 font-medium" style={{ color: T.textSub, borderBottom: `1px solid ${T.border}` }}>チャネル</th>
                    <th className="text-left px-3 py-2 font-medium" style={{ color: T.textSub, borderBottom: `1px solid ${T.border}` }}>種別</th>
                    <th className="text-left px-3 py-2 font-medium" style={{ color: T.textSub, borderBottom: `1px solid ${T.border}` }}>宛先</th>
                    <th className="text-left px-3 py-2 font-medium" style={{ color: T.textSub, borderBottom: `1px solid ${T.border}` }}>メッセージ</th>
                    <th className="text-left px-3 py-2 font-medium" style={{ color: T.textSub, borderBottom: `1px solid ${T.border}` }}>操作者</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map(l => {
                    const cm = channelMeta[l.channel] || channelMeta.other;
                    const mt = msgTypeMeta[l.message_type || ""] || msgTypeMeta[""];
                    return (
                      <tr
                        key={l.id}
                        onClick={() => setSelectedLog(l)}
                        className="cursor-pointer transition-colors"
                        style={{ borderBottom: `1px solid ${T.border}` }}
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = T.cardAlt; }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
                      >
                        <td className="px-3 py-2 whitespace-nowrap tabular-nums" style={{ color: T.textSub }}>{formatDateTime(l.created_at)}</td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <span className="text-[10px] px-2 py-0.5 rounded" style={{ backgroundColor: cm.color + "22", color: cm.color }}>
                            {cm.icon} {cm.label}
                          </span>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <span className="text-[10px] px-2 py-0.5 rounded" style={{ backgroundColor: mt.color + "22", color: mt.color }}>
                            {mt.label}
                          </span>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <div>
                            <div className="text-[11px]">{l.recipient_name || "—"}</div>
                            {l.recipient_phone && <div className="text-[9px]" style={{ color: T.textMuted }}>{l.recipient_phone}</div>}
                          </div>
                        </td>
                        <td className="px-3 py-2" style={{ color: T.textSub, maxWidth: 360 }}>
                          <div className="truncate">{l.body_preview || l.body?.slice(0, 80) || "—"}</div>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap" style={{ color: T.textMuted }}>{l.sent_by_name || "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* 詳細モーダル */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setSelectedLog(null)}>
          <div className="rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-5 animate-[fadeIn_0.2s]" style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-[15px] font-medium mb-1">📨 通知ログ詳細</h2>
                <p className="text-[11px]" style={{ color: T.textMuted }}>{formatDateTime(selectedLog.created_at)}</p>
              </div>
              <button onClick={() => setSelectedLog(null)} className="text-[20px] cursor-pointer" style={{ color: T.textMuted, background: "none", border: "none" }}>×</button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-[11px]">
                <div><span style={{ color: T.textMuted }}>チャネル: </span>{channelMeta[selectedLog.channel]?.icon} {channelMeta[selectedLog.channel]?.label || selectedLog.channel}</div>
                <div><span style={{ color: T.textMuted }}>種別: </span>{msgTypeMeta[selectedLog.message_type || ""]?.label || selectedLog.message_type || "—"}</div>
                <div><span style={{ color: T.textMuted }}>宛先: </span>{selectedLog.recipient_name || "—"}</div>
                <div><span style={{ color: T.textMuted }}>電話: </span>{selectedLog.recipient_phone || "—"}</div>
                {selectedLog.reservation_date && <div><span style={{ color: T.textMuted }}>予約日: </span>{selectedLog.reservation_date}</div>}
                <div><span style={{ color: T.textMuted }}>操作者: </span>{selectedLog.sent_by_name || "—"}</div>
              </div>
              {selectedLog.subject && (
                <div>
                  <p className="text-[10px] mb-1" style={{ color: T.textMuted }}>件名</p>
                  <p className="text-[11px] px-3 py-2 rounded-lg" style={{ backgroundColor: T.cardAlt }}>{selectedLog.subject}</p>
                </div>
              )}
              <div>
                <p className="text-[10px] mb-1" style={{ color: T.textMuted }}>本文</p>
                <pre className="text-[11px] px-3 py-2 rounded-lg whitespace-pre-wrap break-words" style={{ backgroundColor: T.cardAlt, fontFamily: "inherit" }}>{selectedLog.body || "（本文なし）"}</pre>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => { navigator.clipboard.writeText(selectedLog.body || ""); }}
                  className="px-4 py-2 text-[11px] rounded-xl cursor-pointer"
                  style={{ backgroundColor: "#c3a78218", color: "#c3a782", border: "1px solid #c3a78244" }}
                >
                  📋 本文をコピー
                </button>
                <button
                  onClick={() => setSelectedLog(null)}
                  className="px-4 py-2 text-[11px] rounded-xl cursor-pointer border ml-auto"
                  style={{ borderColor: T.border, color: T.textSub }}
                >
                  閉じる
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
