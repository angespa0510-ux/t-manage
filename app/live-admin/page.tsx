"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useStaffSession } from "../../lib/staff-session";
import { useTheme } from "../../lib/theme";
import { useToast } from "../../lib/toast";
import { supabase } from "../../lib/supabase";

/**
 * ライブ配信管理画面
 *
 * 機能:
 *   - セラピスト一覧 + ライブ配信許可ON/OFF
 *   - 現在配信中のライブ一覧 (リアルタイム視聴者数 + 強制終了)
 *   - 過去の配信履歴
 *
 * 権限: isManager
 */

type TherapistRow = {
  id: number;
  name: string;
  status: string;
  live_streaming_enabled: boolean;
  live_streaming_enabled_at: string | null;
};

type StreamRow = {
  id: number;
  therapist_id: number;
  therapist_name: string;
  title: string;
  status: string;
  visibility: string;
  filter_mode: string;
  viewer_count_current: number;
  viewer_count_peak: number;
  viewer_count_total: number;
  heart_count_total: number;
  comment_count_total: number;
  started_at: string | null;
  ended_at: string | null;
  duration_sec: number | null;
};

export default function LiveAdminPage() {
  const { activeStaff, isManager, isRestored } = useStaffSession();
  const { dark, toggle, T } = useTheme();
  const { show: pushToast } = useToast();

  const [tab, setTab] = useState<"permissions" | "live" | "history">("permissions");
  const [therapists, setTherapists] = useState<TherapistRow[]>([]);
  const [liveStreams, setLiveStreams] = useState<StreamRow[]>([]);
  const [historyStreams, setHistoryStreams] = useState<StreamRow[]>([]);
  const [loading, setLoading] = useState(true);

  // ───────── データ取得
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // セラピスト一覧
      const { data: ts } = await supabase
        .from("therapists")
        .select("id, name, status, live_streaming_enabled, live_streaming_enabled_at")
        .eq("status", "active")
        .is("deleted_at", null)
        .order("name", { ascending: true });

      setTherapists((ts || []) as TherapistRow[]);

      // 配信中
      const { data: live } = await supabase
        .from("live_streams")
        .select("*")
        .in("status", ["preparing", "live"])
        .order("started_at", { ascending: false });

      // セラピスト名を解決
      type Stream = Omit<StreamRow, "therapist_name">;
      const therapistMap = new Map<number, string>();
      for (const t of (ts || []) as TherapistRow[]) therapistMap.set(t.id, t.name);

      setLiveStreams(((live || []) as Stream[]).map((s) => ({
        ...s,
        therapist_name: therapistMap.get(s.therapist_id) || "(削除済み)",
      })));

      // 履歴 (直近100件)
      const { data: hist } = await supabase
        .from("live_streams")
        .select("*")
        .in("status", ["ended", "error"])
        .order("created_at", { ascending: false })
        .limit(100);

      setHistoryStreams(((hist || []) as Stream[]).map((s) => ({
        ...s,
        therapist_name: therapistMap.get(s.therapist_id) || "(削除済み)",
      })));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isRestored && isManager) {
      fetchData();
    }
  }, [isRestored, isManager, fetchData]);

  // 配信中タブのときは10秒ごとに自動更新
  useEffect(() => {
    if (tab !== "live") return;
    const t = setInterval(fetchData, 10000);
    return () => clearInterval(t);
  }, [tab, fetchData]);

  // ─────────────────────────────────────────────
  // 許可ON/OFF
  // ─────────────────────────────────────────────
  const togglePermission = async (t: TherapistRow) => {
    if (!activeStaff) return;
    const newValue = !t.live_streaming_enabled;
    try {
      const { error } = await supabase
        .from("therapists")
        .update({
          live_streaming_enabled: newValue,
          live_streaming_enabled_at: newValue ? new Date().toISOString() : null,
          live_streaming_enabled_by_staff_id: newValue ? activeStaff.id : null,
        })
        .eq("id", t.id);
      if (error) {
        pushToast(error.message, "error");
        return;
      }
      pushToast(`${t.name}: ライブ配信を ${newValue ? "許可" : "停止"}しました`, "success");
      await fetchData();
    } catch (e) {
      console.error(e);
      pushToast("通信エラー", "error");
    }
  };

  // ─────────────────────────────────────────────
  // 強制終了
  // ─────────────────────────────────────────────
  const forceEnd = async (s: StreamRow) => {
    if (!confirm(`${s.therapist_name}の配信「${s.title}」を強制終了しますか？`)) return;
    try {
      const endedAt = new Date().toISOString();
      const updates: Record<string, unknown> = {
        status: "ended",
        ended_at: endedAt,
        end_reason: "staff_force",
      };
      if (s.started_at) {
        updates.duration_sec = Math.floor((new Date(endedAt).getTime() - new Date(s.started_at).getTime()) / 1000);
      }
      const { error } = await supabase.from("live_streams").update(updates).eq("id", s.id);
      if (error) {
        pushToast(error.message, "error");
        return;
      }
      pushToast("強制終了しました", "success");
      await fetchData();
    } catch (e) {
      console.error(e);
      pushToast("通信エラー", "error");
    }
  };

  // ─────────────────────────────────────────────
  // フォーマッタ
  // ─────────────────────────────────────────────
  const fmtDateTime = (iso: string | null) => {
    if (!iso) return "—";
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };
  const fmtDuration = (s: number | null) => {
    if (s === null || s === undefined) return "—";
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    if (h > 0) return `${h}h${m}m`;
    if (m > 0) return `${m}m`;
    return `${s}s`;
  };

  if (!isRestored) {
    return <div style={{ padding: 40, textAlign: "center", color: T.textMuted, backgroundColor: T.bg, minHeight: "100vh" }}>読み込み中...</div>;
  }
  if (!activeStaff || !isManager) {
    return (
      <div style={{ padding: 40, textAlign: "center", backgroundColor: T.bg, minHeight: "100vh", color: T.text }}>
        <p style={{ fontSize: 14, marginBottom: 16 }}>権限がありません</p>
        <Link href="/dashboard" style={{ fontSize: 12, color: T.accent, textDecoration: "none" }}>← HOMEに戻る</Link>
      </div>
    );
  }

  // 統計
  const stats = {
    total: therapists.length,
    enabled: therapists.filter((t) => t.live_streaming_enabled).length,
    living: liveStreams.length,
    pastTotal: historyStreams.length,
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: T.bg, color: T.text, padding: 16 }}>
      {/* ヘッダ */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 500, marginBottom: 4 }}>🎬 ライブ配信管理</h1>
          <p style={{ fontSize: 11, color: T.textMuted }}>
            セラピストの配信許可と配信中ライブの監視
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={fetchData} style={{ padding: "6px 10px", fontSize: 11, cursor: "pointer", backgroundColor: "transparent", border: `1px solid ${T.border}`, color: T.textSub }}>
            🔄 更新
          </button>
          <button onClick={toggle} style={{ padding: "6px 10px", fontSize: 11, cursor: "pointer", backgroundColor: "transparent", border: `1px solid ${T.border}`, color: T.textSub }}>
            {dark ? "☀️" : "🌙"}
          </button>
          <Link href="/dashboard" style={{ padding: "6px 10px", fontSize: 11, backgroundColor: "transparent", border: `1px solid ${T.border}`, color: T.textSub, textDecoration: "none" }}>
            ← HOME
          </Link>
        </div>
      </div>

      {/* 統計 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 0, border: `1px solid ${T.border}`, backgroundColor: T.card, marginBottom: 16 }}>
        <div style={{ padding: 12, textAlign: "center", borderRight: `1px solid ${T.border}` }}>
          <p style={{ fontSize: 9, color: T.textMuted, marginBottom: 4 }}>セラピスト総数</p>
          <p style={{ fontSize: 22, fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>{stats.total}</p>
        </div>
        <div style={{ padding: 12, textAlign: "center", borderRight: `1px solid ${T.border}` }}>
          <p style={{ fontSize: 9, color: T.textMuted, marginBottom: 4 }}>許可済み</p>
          <p style={{ fontSize: 22, fontWeight: 500, color: "#6b9b7e", fontVariantNumeric: "tabular-nums" }}>{stats.enabled}</p>
        </div>
        <div style={{ padding: 12, textAlign: "center", borderRight: `1px solid ${T.border}` }}>
          <p style={{ fontSize: 9, color: T.textMuted, marginBottom: 4 }}>配信中</p>
          <p style={{ fontSize: 22, fontWeight: 500, color: "#dc3250", fontVariantNumeric: "tabular-nums" }}>{stats.living}</p>
        </div>
        <div style={{ padding: 12, textAlign: "center" }}>
          <p style={{ fontSize: 9, color: T.textMuted, marginBottom: 4 }}>過去配信</p>
          <p style={{ fontSize: 22, fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>{stats.pastTotal}</p>
        </div>
      </div>

      {/* タブ */}
      <div style={{ display: "flex", gap: 0, marginBottom: 14, border: `1px solid ${T.border}`, backgroundColor: T.card }}>
        {[
          { key: "permissions" as const, label: "👥 配信許可" },
          { key: "live" as const, label: `🔴 配信中 (${stats.living})` },
          { key: "history" as const, label: "📜 配信履歴" },
        ].map((t, i) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              flex: 1,
              padding: 10,
              fontSize: 12,
              cursor: "pointer",
              backgroundColor: tab === t.key ? T.accent : "transparent",
              color: tab === t.key ? "#fff" : T.textSub,
              border: "none",
              borderLeft: i > 0 ? `1px solid ${T.border}` : "none",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ─────────── 配信許可タブ ─────────── */}
      {tab === "permissions" && (
        loading ? (
          <p style={{ textAlign: "center", padding: 30, color: T.textMuted }}>読み込み中...</p>
        ) : (
          <div style={{ overflowX: "auto", border: `1px solid ${T.border}`, backgroundColor: T.card }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
              <thead>
                <tr style={{ backgroundColor: T.cardAlt }}>
                  <th style={{ padding: 8, textAlign: "left", borderBottom: `1px solid ${T.border}` }}>セラピスト</th>
                  <th style={{ padding: 8, textAlign: "center", borderBottom: `1px solid ${T.border}` }}>配信許可</th>
                  <th style={{ padding: 8, textAlign: "left", borderBottom: `1px solid ${T.border}` }}>許可日時</th>
                </tr>
              </thead>
              <tbody>
                {therapists.map((t) => (
                  <tr key={t.id} style={{ borderBottom: `1px solid ${T.border}` }}>
                    <td style={{ padding: 8, color: T.text }}>{t.name}</td>
                    <td style={{ padding: 8, textAlign: "center" }}>
                      <button
                        onClick={() => togglePermission(t)}
                        style={{
                          padding: "4px 14px",
                          fontSize: 11,
                          cursor: "pointer",
                          backgroundColor: t.live_streaming_enabled ? "#6b9b7e" : T.cardAlt,
                          color: t.live_streaming_enabled ? "#fff" : T.textMuted,
                          border: `1px solid ${t.live_streaming_enabled ? "#6b9b7e" : T.border}`,
                          fontWeight: 500,
                        }}
                      >
                        {t.live_streaming_enabled ? "✓ 許可" : "停止中"}
                      </button>
                    </td>
                    <td style={{ padding: 8, fontSize: 10, color: T.textMuted, fontVariantNumeric: "tabular-nums" }}>
                      {fmtDateTime(t.live_streaming_enabled_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* ─────────── 配信中タブ ─────────── */}
      {tab === "live" && (
        loading ? (
          <p style={{ textAlign: "center", padding: 30, color: T.textMuted }}>読み込み中...</p>
        ) : liveStreams.length === 0 ? (
          <p style={{ textAlign: "center", padding: 30, color: T.textMuted, fontSize: 12 }}>現在配信中のライブはありません</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {liveStreams.map((s) => (
              <div key={s.id} style={{ padding: 12, backgroundColor: T.card, border: `1px solid ${T.border}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                  <div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                      <span style={{ fontSize: 9, padding: "2px 6px", backgroundColor: "#dc3250", color: "#fff", letterSpacing: "0.05em", animation: "pulse 1.5s infinite" }}>
                        🔴 {s.status === "live" ? "LIVE" : "準備中"}
                      </span>
                      <span style={{ fontSize: 9, padding: "2px 6px", backgroundColor: s.visibility === "members_only" ? "#e8849a" : "#6b9b7e", color: "#fff" }}>
                        {s.visibility === "members_only" ? "💗 会員限定" : "🌐 公開"}
                      </span>
                      {s.filter_mode !== "none" && (
                        <span style={{ fontSize: 9, padding: "2px 6px", backgroundColor: T.cardAlt, color: T.textSub }}>
                          {s.filter_mode === "beauty" ? "✨美顔" : s.filter_mode === "stamp" ? "🌸スタンプ" : "🌫モザイク"}
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: 14, color: T.text, fontWeight: 500, marginBottom: 4 }}>{s.title}</p>
                    <p style={{ fontSize: 11, color: T.textSub }}>{s.therapist_name}</p>
                  </div>
                  <button
                    onClick={() => forceEnd(s)}
                    style={{ padding: "6px 12px", fontSize: 11, cursor: "pointer", backgroundColor: "transparent", color: "#c45555", border: `1px solid #c45555`, fontWeight: 500 }}
                  >
                    ✕ 強制終了
                  </button>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(80px, 1fr))", gap: 8, fontSize: 10, color: T.textMuted, paddingTop: 8, borderTop: `1px solid ${T.border}` }}>
                  <div>👥 視聴中: <strong style={{ color: T.text, fontVariantNumeric: "tabular-nums" }}>{s.viewer_count_current}</strong></div>
                  <div>📊 ピーク: <strong style={{ color: T.text, fontVariantNumeric: "tabular-nums" }}>{s.viewer_count_peak}</strong></div>
                  <div>累計: <strong style={{ color: T.text, fontVariantNumeric: "tabular-nums" }}>{s.viewer_count_total}</strong></div>
                  <div>💗: <strong style={{ color: T.text, fontVariantNumeric: "tabular-nums" }}>{s.heart_count_total}</strong></div>
                  <div>💬: <strong style={{ color: T.text, fontVariantNumeric: "tabular-nums" }}>{s.comment_count_total}</strong></div>
                  <div>開始: <strong style={{ color: T.text }}>{fmtDateTime(s.started_at)}</strong></div>
                </div>
                <div style={{ marginTop: 8 }}>
                  <Link href={`/diary/live/${s.id}`} target="_blank" style={{ fontSize: 11, color: T.accent, textDecoration: "none" }}>
                    👁 視聴側で開く ↗
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* ─────────── 履歴タブ ─────────── */}
      {tab === "history" && (
        loading ? (
          <p style={{ textAlign: "center", padding: 30, color: T.textMuted }}>読み込み中...</p>
        ) : historyStreams.length === 0 ? (
          <p style={{ textAlign: "center", padding: 30, color: T.textMuted, fontSize: 12 }}>過去の配信履歴はありません</p>
        ) : (
          <div style={{ overflowX: "auto", border: `1px solid ${T.border}`, backgroundColor: T.card }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
              <thead>
                <tr style={{ backgroundColor: T.cardAlt }}>
                  <th style={{ padding: 8, textAlign: "left", borderBottom: `1px solid ${T.border}` }}>セラピスト</th>
                  <th style={{ padding: 8, textAlign: "left", borderBottom: `1px solid ${T.border}` }}>タイトル</th>
                  <th style={{ padding: 8, textAlign: "left", borderBottom: `1px solid ${T.border}` }}>公開</th>
                  <th style={{ padding: 8, textAlign: "left", borderBottom: `1px solid ${T.border}` }}>開始</th>
                  <th style={{ padding: 8, textAlign: "left", borderBottom: `1px solid ${T.border}` }}>時間</th>
                  <th style={{ padding: 8, textAlign: "right", borderBottom: `1px solid ${T.border}` }}>👥ピーク</th>
                  <th style={{ padding: 8, textAlign: "right", borderBottom: `1px solid ${T.border}` }}>累計</th>
                  <th style={{ padding: 8, textAlign: "right", borderBottom: `1px solid ${T.border}` }}>💗</th>
                  <th style={{ padding: 8, textAlign: "right", borderBottom: `1px solid ${T.border}` }}>💬</th>
                </tr>
              </thead>
              <tbody>
                {historyStreams.map((s) => (
                  <tr key={s.id} style={{ borderBottom: `1px solid ${T.border}` }}>
                    <td style={{ padding: 8, color: T.text }}>{s.therapist_name}</td>
                    <td style={{ padding: 8, color: T.textSub, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.title}</td>
                    <td style={{ padding: 8, fontSize: 10 }}>
                      <span style={{ padding: "2px 5px", backgroundColor: s.visibility === "members_only" ? "#e8849a" : "#6b9b7e", color: "#fff" }}>
                        {s.visibility === "members_only" ? "会員" : "公開"}
                      </span>
                    </td>
                    <td style={{ padding: 8, fontSize: 10, color: T.textMuted }}>{fmtDateTime(s.started_at)}</td>
                    <td style={{ padding: 8, fontSize: 10, color: T.textSub, fontVariantNumeric: "tabular-nums" }}>{fmtDuration(s.duration_sec)}</td>
                    <td style={{ padding: 8, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{s.viewer_count_peak}</td>
                    <td style={{ padding: 8, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{s.viewer_count_total}</td>
                    <td style={{ padding: 8, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{s.heart_count_total}</td>
                    <td style={{ padding: 8, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{s.comment_count_total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
      `}</style>
    </div>
  );
}
