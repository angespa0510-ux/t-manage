"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { useStaffSession } from "../../lib/staff-session";
import { useTheme } from "../../lib/theme";
import { NavMenu } from "../../lib/nav-menu";
import { useToast } from "../../lib/toast";

/**
 * ═══════════════════════════════════════════════════════════
 * /chat-insights
 *
 * チャット AI 分析結果の閲覧ページ（管理者専用）。
 *
 * タブ構成:
 *   📋 インサイト一覧     … chat_insights の絞り込み表示
 *   👥 スタッフ別         … スタッフごとの返信傾向
 *   💆 セラピスト別       … セラピストごとの傾向
 *   🔁 実行履歴           … chat_insight_runs
 *   ⚙️ 実行・設定         … 今すぐ分析 / Claude MAX 手順
 * ═══════════════════════════════════════════════════════════
 */

type Insight = {
  id: number;
  run_id: number | null;
  period_start: string;
  period_end: string;
  insight_type: string;
  scope: string;
  scope_id: number | null;
  scope_name: string | null;
  title: string;
  summary: string | null;
  detail: string | null;
  suggested_action: string | null;
  example_good: string | null;
  example_bad: string | null;
  metric_value: number | null;
  metric_label: string | null;
  priority: number;
  tags: string[];
  is_dismissed: boolean;
  created_at: string;
};

type InsightRun = {
  id: number;
  period_start: string;
  period_end: string;
  triggered_by: string;
  triggered_by_name: string | null;
  status: string;
  messages_analyzed: number;
  insights_generated: number;
  tokens_in: number;
  tokens_out: number;
  cost_jpy: number;
  error_message: string | null;
  started_at: string;
  finished_at: string | null;
  duration_ms: number | null;
};

const INSIGHT_TYPE_LABEL: Record<string, { label: string; emoji: string; color: string }> = {
  summary:          { label: "サマリー",       emoji: "📊", color: "#85a8c4" },
  pattern:          { label: "頻出パターン",   emoji: "🔄", color: "#7ab88f" },
  suggestion:       { label: "改善提案",       emoji: "💡", color: "#c3a782" },
  staff_style:      { label: "スタッフ傾向",   emoji: "👥", color: "#a885c4" },
  therapist_trend:  { label: "セラ傾向",       emoji: "💆", color: "#e8849a" },
  trouble:          { label: "トラブル兆候",   emoji: "⚠️", color: "#c45555" },
  improvement:      { label: "改善必要",       emoji: "🔧", color: "#d4687e" },
};

export default function ChatInsightsPage() {
  const router = useRouter();
  const toast = useToast();
  const { T, dark } = useTheme();
  const { activeStaff, isRestored, isManager } = useStaffSession();

  const [tab, setTab] = useState<"list" | "staff" | "therapist" | "runs" | "actions">("list");
  const [insights, setInsights] = useState<Insight[]>([]);
  const [runs, setRuns] = useState<InsightRun[]>([]);
  const [filterType, setFilterType] = useState<string>("all");
  const [showDismissed, setShowDismissed] = useState(false);
  const [detailModal, setDetailModal] = useState<Insight | null>(null);
  const [running, setRunning] = useState(false);
  const [loading, setLoading] = useState(true);

  // アクセス制御
  useEffect(() => {
    if (!isRestored) return;
    if (!activeStaff) {
      router.push("/dashboard");
      return;
    }
    if (!isManager) {
      toast.show("アクセス権がありません", "error");
      router.push("/dashboard");
    }
  }, [isRestored, activeStaff, isManager, router, toast]);

  const load = useCallback(async () => {
    setLoading(true);
    const [iResp, rResp] = await Promise.all([
      supabase
        .from("chat_insights")
        .select("*")
        .order("priority", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("chat_insight_runs")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(30),
    ]);
    setInsights(iResp.data || []);
    setRuns(rResp.data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (activeStaff && isManager) load();
  }, [activeStaff, isManager, load]);

  // インサイト dismiss / restore
  const toggleDismiss = async (ins: Insight) => {
    const next = !ins.is_dismissed;
    await supabase.from("chat_insights").update({ is_dismissed: next }).eq("id", ins.id);
    setInsights((prev) => prev.map((i) => (i.id === ins.id ? { ...i, is_dismissed: next } : i)));
    toast.show(next ? "対応済みにしました" : "復元しました", "success");
  };

  // 手動分析実行
  const runAnalysis = async () => {
    if (running) return;
    if (!confirm("過去7日分のチャットを分析します。API 料金が発生します。\n実行しますか？")) return;
    setRunning(true);
    try {
      const res = await fetch("/api/chat-insights-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ triggered_by_name: activeStaff?.name || "" }),
      });
      const data = await res.json();
      if (res.ok && data.status === "success") {
        toast.show(
          `✅ 分析完了：${data.insights_generated}件 (¥${data.cost_jpy?.toFixed(2) || 0})`,
          "success",
        );
        load();
      } else {
        toast.show("分析失敗: " + (data.error || "不明"), "error");
      }
    } catch (e) {
      toast.show("分析失敗: " + (e instanceof Error ? e.message : "不明"), "error");
    }
    setRunning(false);
  };

  if (!activeStaff || !isManager) {
    return <div style={{ padding: 40 }}>読み込み中...</div>;
  }

  const filteredInsights = insights.filter((i) => {
    if (!showDismissed && i.is_dismissed) return false;
    if (filterType !== "all" && i.insight_type !== filterType) return false;
    return true;
  });

  const staffInsights = insights.filter((i) => i.scope === "staff" && !i.is_dismissed);
  const therapistInsights = insights.filter((i) => i.scope === "therapist" && !i.is_dismissed);

  // スタッフ別集計
  const staffGroups = Array.from(
    staffInsights.reduce((acc, i) => {
      const key = i.scope_name || "不明";
      if (!acc.has(key)) acc.set(key, []);
      acc.get(key)!.push(i);
      return acc;
    }, new Map<string, Insight[]>()),
  );
  const therapistGroups = Array.from(
    therapistInsights.reduce((acc, i) => {
      const key = i.scope_name || "不明";
      if (!acc.has(key)) acc.set(key, []);
      acc.get(key)!.push(i);
      return acc;
    }, new Map<string, Insight[]>()),
  );

  return (
    <div style={{ display: "flex", minHeight: "100vh", backgroundColor: T.bg, color: T.text }}>
      <NavMenu T={T as Record<string, string>} dark={dark} />
      <main style={{ flex: 1, marginLeft: 80, padding: 24 }}>
        {/* ヘッダ */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0, display: "flex", alignItems: "center", gap: 10 }}>
              🧠 チャット AI 分析
            </h1>
            <p style={{ fontSize: 12, color: T.textSub, margin: "4px 0 0" }}>
              スタッフ↔セラピスト間のチャットから改善提案・傾向を抽出
            </p>
          </div>
          <button
            onClick={runAnalysis}
            disabled={running}
            style={{
              padding: "10px 20px",
              backgroundColor: running ? T.cardAlt : "#c3a782",
              color: running ? T.textMuted : "#fff",
              border: "none",
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              cursor: running ? "not-allowed" : "pointer",
            }}
          >
            {running ? "🔄 分析中..." : "🔄 今すぐ分析（API使用）"}
          </button>
        </div>

        {/* タブ */}
        <div style={{ display: "flex", borderBottom: `1px solid ${T.border}`, marginBottom: 16, gap: 2, flexWrap: "wrap" }}>
          {[
            { k: "list" as const, label: "📋 インサイト一覧", count: insights.filter((i) => !i.is_dismissed).length },
            { k: "staff" as const, label: "👥 スタッフ別", count: staffGroups.length },
            { k: "therapist" as const, label: "💆 セラピスト別", count: therapistGroups.length },
            { k: "runs" as const, label: "🔁 実行履歴", count: runs.length },
            { k: "actions" as const, label: "⚙️ 実行・設定", count: null },
          ].map((t) => (
            <button
              key={t.k}
              onClick={() => setTab(t.k)}
              style={{
                padding: "8px 14px",
                background: "transparent",
                border: "none",
                borderBottom: `2px solid ${tab === t.k ? T.accent : "transparent"}`,
                color: tab === t.k ? T.accent : T.textSub,
                fontSize: 12,
                fontWeight: tab === t.k ? 600 : 400,
                cursor: "pointer",
              }}
            >
              {t.label}
              {t.count !== null && (
                <span style={{ marginLeft: 6, fontSize: 10, opacity: 0.75 }}>{t.count}</span>
              )}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: T.textMuted }}>読み込み中...</div>
        ) : (
          <>
            {/* タブ: インサイト一覧 */}
            {tab === "list" && (
              <div>
                {/* フィルタ */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
                  {[{ k: "all", label: "全て", color: T.accent }, ...Object.entries(INSIGHT_TYPE_LABEL).map(([k, v]) => ({ k, label: v.label, color: v.color }))].map((f) => (
                    <button
                      key={f.k}
                      onClick={() => setFilterType(f.k)}
                      style={{
                        padding: "4px 10px",
                        border: `1px solid ${filterType === f.k ? f.color : T.border}`,
                        backgroundColor: filterType === f.k ? `${f.color}18` : T.card,
                        color: filterType === f.k ? f.color : T.textSub,
                        fontSize: 11,
                        borderRadius: 999,
                        cursor: "pointer",
                      }}
                    >
                      {f.label}
                    </button>
                  ))}
                  <label style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: T.textSub, marginLeft: 8, cursor: "pointer" }}>
                    <input type="checkbox" checked={showDismissed} onChange={(e) => setShowDismissed(e.target.checked)} />
                    対応済みも表示
                  </label>
                </div>

                {filteredInsights.length === 0 ? (
                  <div style={{ padding: 40, textAlign: "center", color: T.textMuted, backgroundColor: T.card, borderRadius: 8, border: `1px solid ${T.border}` }}>
                    分析結果はまだありません。
                    <br />
                    「🔄 今すぐ分析」または Claude MAX で実行してください。
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12 }}>
                    {filteredInsights.map((i) => {
                      const typeInfo = INSIGHT_TYPE_LABEL[i.insight_type] || { label: i.insight_type, emoji: "📌", color: T.textMuted };
                      return (
                        <div
                          key={i.id}
                          onClick={() => setDetailModal(i)}
                          style={{
                            padding: 14,
                            backgroundColor: T.card,
                            border: `1px solid ${T.border}`,
                            borderLeftWidth: 3,
                            borderLeftColor: typeInfo.color,
                            borderRadius: 8,
                            cursor: "pointer",
                            opacity: i.is_dismissed ? 0.5 : 1,
                            display: "flex",
                            flexDirection: "column",
                            gap: 6,
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 6 }}>
                            <span style={{ padding: "2px 8px", fontSize: 10, fontWeight: 600, color: typeInfo.color, backgroundColor: `${typeInfo.color}18`, borderRadius: 999 }}>
                              {typeInfo.emoji} {typeInfo.label}
                            </span>
                            {i.priority >= 8 && (
                              <span style={{ padding: "2px 8px", fontSize: 10, fontWeight: 600, color: "#c45555", backgroundColor: "#c4555518", borderRadius: 999 }}>
                                🔥 優先
                              </span>
                            )}
                          </div>
                          <h3 style={{ fontSize: 13, fontWeight: 600, margin: 0, color: T.text, lineHeight: 1.4 }}>
                            {i.title}
                          </h3>
                          {i.scope_name && (
                            <div style={{ fontSize: 10, color: T.textSub }}>
                              対象: <span style={{ fontWeight: 500 }}>{i.scope_name}</span>
                            </div>
                          )}
                          {i.summary && (
                            <p style={{ fontSize: 11, color: T.textSub, margin: 0, lineHeight: 1.5 }}>
                              {i.summary}
                            </p>
                          )}
                          {i.metric_value !== null && (
                            <div style={{ fontSize: 18, fontWeight: 600, color: typeInfo.color, marginTop: 4 }}>
                              {i.metric_value}
                              <span style={{ fontSize: 10, color: T.textMuted, marginLeft: 4, fontWeight: 400 }}>
                                {i.metric_label}
                              </span>
                            </div>
                          )}
                          <div style={{ marginTop: "auto", paddingTop: 8, fontSize: 9, color: T.textMuted, display: "flex", justifyContent: "space-between" }}>
                            <span>{i.period_start} 〜 {i.period_end}</span>
                            <span>タップで詳細</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* タブ: スタッフ別 */}
            {tab === "staff" && (
              <div>
                {staffGroups.length === 0 ? (
                  <div style={{ padding: 40, textAlign: "center", color: T.textMuted, backgroundColor: T.card, borderRadius: 8, border: `1px solid ${T.border}` }}>
                    スタッフ別の分析結果はまだありません。
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 14 }}>
                    {staffGroups.map(([name, items]) => (
                      <div key={name} style={{ padding: 14, backgroundColor: T.card, border: `1px solid ${T.border}`, borderRadius: 8 }}>
                        <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: T.text }}>
                          👥 {name}
                        </h3>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {items.map((i) => (
                            <div key={i.id} onClick={() => setDetailModal(i)} style={{ padding: "6px 10px", backgroundColor: T.cardAlt, borderRadius: 6, cursor: "pointer", fontSize: 11, lineHeight: 1.5 }}>
                              <div style={{ fontWeight: 500 }}>{i.title}</div>
                              {i.summary && <div style={{ color: T.textSub, marginTop: 2 }}>{i.summary}</div>}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* タブ: セラピスト別 */}
            {tab === "therapist" && (
              <div>
                {therapistGroups.length === 0 ? (
                  <div style={{ padding: 40, textAlign: "center", color: T.textMuted, backgroundColor: T.card, borderRadius: 8, border: `1px solid ${T.border}` }}>
                    セラピスト別の分析結果はまだありません。
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 14 }}>
                    {therapistGroups.map(([name, items]) => (
                      <div key={name} style={{ padding: 14, backgroundColor: T.card, border: `1px solid ${T.border}`, borderRadius: 8 }}>
                        <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: T.text }}>
                          💆 {name}
                        </h3>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {items.map((i) => (
                            <div key={i.id} onClick={() => setDetailModal(i)} style={{ padding: "6px 10px", backgroundColor: T.cardAlt, borderRadius: 6, cursor: "pointer", fontSize: 11, lineHeight: 1.5 }}>
                              <div style={{ fontWeight: 500 }}>{i.title}</div>
                              {i.summary && <div style={{ color: T.textSub, marginTop: 2 }}>{i.summary}</div>}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* タブ: 実行履歴 */}
            {tab === "runs" && (
              <div>
                {runs.length === 0 ? (
                  <div style={{ padding: 40, textAlign: "center", color: T.textMuted, backgroundColor: T.card, borderRadius: 8, border: `1px solid ${T.border}` }}>
                    実行履歴はまだありません。
                  </div>
                ) : (
                  <div style={{ overflowX: "auto", backgroundColor: T.card, borderRadius: 8, border: `1px solid ${T.border}` }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                      <thead>
                        <tr style={{ borderBottom: `1px solid ${T.border}`, textAlign: "left", backgroundColor: T.cardAlt }}>
                          <th style={{ padding: "10px 12px", fontWeight: 600, fontSize: 11 }}>実行日時</th>
                          <th style={{ padding: "10px 12px", fontWeight: 600, fontSize: 11 }}>期間</th>
                          <th style={{ padding: "10px 12px", fontWeight: 600, fontSize: 11 }}>実行元</th>
                          <th style={{ padding: "10px 12px", fontWeight: 600, fontSize: 11 }}>状態</th>
                          <th style={{ padding: "10px 12px", fontWeight: 600, fontSize: 11, textAlign: "right" }}>メッセ数</th>
                          <th style={{ padding: "10px 12px", fontWeight: 600, fontSize: 11, textAlign: "right" }}>生成数</th>
                          <th style={{ padding: "10px 12px", fontWeight: 600, fontSize: 11, textAlign: "right" }}>コスト</th>
                        </tr>
                      </thead>
                      <tbody>
                        {runs.map((r) => {
                          const trigBadge = r.triggered_by === "cron"
                            ? { label: "自動", color: "#7ab88f" }
                            : r.triggered_by === "claude_max"
                            ? { label: "MAX", color: "#a855f7" }
                            : { label: "手動", color: "#85a8c4" };
                          const statusBadge = r.status === "success"
                            ? { label: "✓ 成功", color: "#4a7c59" }
                            : r.status === "failed"
                            ? { label: "✗ 失敗", color: "#c45555" }
                            : { label: "⏳ 実行中", color: "#f59e0b" };
                          return (
                            <tr key={r.id} style={{ borderBottom: `1px solid ${T.border}` }}>
                              <td style={{ padding: "10px 12px" }}>
                                {new Date(r.started_at).toLocaleString("ja-JP", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
                              </td>
                              <td style={{ padding: "10px 12px", color: T.textSub }}>
                                {r.period_start.slice(5)} 〜 {r.period_end.slice(5)}
                              </td>
                              <td style={{ padding: "10px 12px" }}>
                                <span style={{ padding: "2px 8px", fontSize: 10, fontWeight: 600, color: trigBadge.color, backgroundColor: `${trigBadge.color}18`, borderRadius: 999 }}>
                                  {trigBadge.label}
                                </span>
                                {r.triggered_by_name && <span style={{ marginLeft: 6, fontSize: 10, color: T.textSub }}>{r.triggered_by_name}</span>}
                              </td>
                              <td style={{ padding: "10px 12px" }}>
                                <span style={{ padding: "2px 8px", fontSize: 10, fontWeight: 600, color: statusBadge.color, backgroundColor: `${statusBadge.color}18`, borderRadius: 999 }}>
                                  {statusBadge.label}
                                </span>
                                {r.error_message && <div style={{ fontSize: 10, color: T.textSub, marginTop: 2 }}>{r.error_message.slice(0, 60)}</div>}
                              </td>
                              <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "monospace" }}>{r.messages_analyzed}</td>
                              <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "monospace" }}>{r.insights_generated}</td>
                              <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "monospace", color: r.cost_jpy > 0 ? T.text : T.textMuted }}>
                                {r.cost_jpy > 0 ? `¥${r.cost_jpy.toFixed(2)}` : "¥0"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* タブ: 実行・設定 */}
            {tab === "actions" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ padding: 18, backgroundColor: T.card, border: `1px solid ${T.border}`, borderRadius: 8 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 600, marginTop: 0, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                    🅰️ パターンA: Vercel Cron（自動）
                  </h3>
                  <p style={{ fontSize: 12, color: T.textSub, lineHeight: 1.7, margin: "0 0 10px" }}>
                    毎週<strong style={{ color: T.text }}>日曜深夜 3:00</strong>に自動で過去7日分を分析。
                    追加操作は不要です。
                  </p>
                  <div style={{ fontSize: 11, color: T.textMuted, backgroundColor: T.cardAlt, padding: 10, borderRadius: 6, lineHeight: 1.7 }}>
                    <div>📍 Vercel 環境変数に以下をセット：</div>
                    <code style={{ display: "block", marginTop: 4, color: T.text }}>
                      ANTHROPIC_API_KEY=sk-ant-...<br />
                      CRON_SECRET=（長いランダム文字列）<br />
                      SUPABASE_SERVICE_ROLE_KEY=eyJ...
                    </code>
                  </div>
                </div>

                <div style={{ padding: 18, backgroundColor: T.card, border: `1px solid ${T.border}`, borderRadius: 8 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 600, marginTop: 0, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                    🅱️ パターンB: 手動実行（画面上から）
                  </h3>
                  <p style={{ fontSize: 12, color: T.textSub, lineHeight: 1.7, margin: "0 0 10px" }}>
                    画面右上の「🔄 今すぐ分析」ボタンを押すと、即座に分析が走ります。
                    過去7日分を API 経由で処理 (1回あたり $0.02〜0.10)。
                  </p>
                  <button
                    onClick={runAnalysis}
                    disabled={running}
                    style={{
                      padding: "8px 16px",
                      backgroundColor: running ? T.cardAlt : "#c3a782",
                      color: running ? T.textMuted : "#fff",
                      border: "none",
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: running ? "not-allowed" : "pointer",
                    }}
                  >
                    {running ? "🔄 実行中..." : "🔄 今すぐ実行"}
                  </button>
                </div>

                <div style={{ padding: 18, backgroundColor: T.card, border: `1px solid #a855f744`, borderLeftWidth: 3, borderLeftColor: "#a855f7", borderRadius: 8 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 600, marginTop: 0, marginBottom: 8, display: "flex", alignItems: "center", gap: 6, color: "#a855f7" }}>
                    🅲️ パターンC: Claude MAX で実行（API コスト ゼロ）
                  </h3>
                  <p style={{ fontSize: 12, color: T.textSub, lineHeight: 1.7, margin: "0 0 10px" }}>
                    Claude MAX プランを持っている場合、API ではなく Claude Code / claude.ai 経由で
                    分析できます。<strong style={{ color: T.text }}>API コストは 0 円</strong>。
                  </p>
                  <div style={{ fontSize: 11, color: T.text, backgroundColor: T.cardAlt, padding: 12, borderRadius: 6, lineHeight: 1.8 }}>
                    <div><strong>手順:</strong></div>
                    <div>1. ローカルで <code style={{ backgroundColor: T.bg, padding: "1px 4px", borderRadius: 3 }}>scripts/chat-insights/</code> に移動</div>
                    <div>2. <code style={{ backgroundColor: T.bg, padding: "1px 4px", borderRadius: 3 }}>node export-chat-logs.mjs</code> でログをエクスポート</div>
                    <div>3. 生成された <code style={{ backgroundColor: T.bg, padding: "1px 4px", borderRadius: 3 }}>analysis-prompt.txt</code> を Claude MAX に貼り付け</div>
                    <div>4. 返ってきた JSON を <code style={{ backgroundColor: T.bg, padding: "1px 4px", borderRadius: 3 }}>analysis-result.json</code> として保存</div>
                    <div>5. <code style={{ backgroundColor: T.bg, padding: "1px 4px", borderRadius: 3 }}>node import-chat-insights.mjs</code> で Supabase に取込</div>
                    <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${T.border}` }}>
                      📖 詳しい手順: <code style={{ backgroundColor: T.bg, padding: "1px 4px", borderRadius: 3 }}>scripts/chat-insights/README.md</code>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* 詳細モーダル */}
      {detailModal && (
        <div
          onClick={() => setDetailModal(null)}
          style={{
            position: "fixed", inset: 0, zIndex: 100, backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: 600, width: "100%", maxHeight: "85vh", overflowY: "auto",
              backgroundColor: T.card, borderRadius: 12, padding: 24, color: T.text,
            }}
          >
            {(() => {
              const ti = INSIGHT_TYPE_LABEL[detailModal.insight_type] || { label: detailModal.insight_type, emoji: "📌", color: T.textMuted };
              return (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                    <span style={{ padding: "3px 10px", fontSize: 11, fontWeight: 600, color: ti.color, backgroundColor: `${ti.color}18`, borderRadius: 999 }}>
                      {ti.emoji} {ti.label}
                    </span>
                    {detailModal.priority >= 8 && (
                      <span style={{ padding: "3px 10px", fontSize: 11, fontWeight: 600, color: "#c45555", backgroundColor: "#c4555518", borderRadius: 999 }}>
                        🔥 優先度 {detailModal.priority}
                      </span>
                    )}
                    {detailModal.scope_name && (
                      <span style={{ fontSize: 11, color: T.textSub }}>対象: <strong>{detailModal.scope_name}</strong></span>
                    )}
                  </div>
                  <h2 style={{ fontSize: 17, fontWeight: 600, margin: "0 0 14px", lineHeight: 1.4 }}>
                    {detailModal.title}
                  </h2>
                  {detailModal.summary && (
                    <p style={{ fontSize: 13, lineHeight: 1.7, color: T.textSub, marginBottom: 14, paddingBottom: 14, borderBottom: `1px solid ${T.border}` }}>
                      {detailModal.summary}
                    </p>
                  )}
                  {detailModal.detail && (
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: T.textSub, marginBottom: 4 }}>📝 詳細</div>
                      <div style={{ fontSize: 13, lineHeight: 1.8, whiteSpace: "pre-wrap" }}>{detailModal.detail}</div>
                    </div>
                  )}
                  {detailModal.suggested_action && (
                    <div style={{ marginBottom: 14, padding: 12, backgroundColor: "#c3a78218", borderRadius: 8, borderLeft: "3px solid #c3a782" }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "#c3a782", marginBottom: 4 }}>💡 推奨アクション</div>
                      <div style={{ fontSize: 13, lineHeight: 1.7 }}>{detailModal.suggested_action}</div>
                    </div>
                  )}
                  {detailModal.example_good && (
                    <div style={{ marginBottom: 10, padding: 10, backgroundColor: "#4a7c5918", borderRadius: 8 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "#4a7c59", marginBottom: 4 }}>✅ 良い例</div>
                      <div style={{ fontSize: 12, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{detailModal.example_good}</div>
                    </div>
                  )}
                  {detailModal.example_bad && (
                    <div style={{ marginBottom: 14, padding: 10, backgroundColor: "#c4555518", borderRadius: 8 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "#c45555", marginBottom: 4 }}>⚠ 改善が必要な例</div>
                      <div style={{ fontSize: 12, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{detailModal.example_bad}</div>
                    </div>
                  )}
                  {detailModal.metric_value !== null && (
                    <div style={{ marginBottom: 14, padding: 12, backgroundColor: T.cardAlt, borderRadius: 8, textAlign: "center" }}>
                      <div style={{ fontSize: 24, fontWeight: 600, color: ti.color }}>
                        {detailModal.metric_value}
                      </div>
                      <div style={{ fontSize: 11, color: T.textSub, marginTop: 2 }}>{detailModal.metric_label}</div>
                    </div>
                  )}
                  {detailModal.tags && detailModal.tags.length > 0 && (
                    <div style={{ marginBottom: 14, display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {detailModal.tags.map((t, i) => (
                        <span key={i} style={{ fontSize: 10, padding: "2px 7px", border: `1px solid ${T.border}`, borderRadius: 999, color: T.textSub }}>
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                  <div style={{ fontSize: 10, color: T.textMuted, marginBottom: 14 }}>
                    分析期間: {detailModal.period_start} 〜 {detailModal.period_end}
                  </div>
                  <div style={{ display: "flex", gap: 8, justifyContent: "space-between" }}>
                    <button
                      onClick={() => { toggleDismiss(detailModal); setDetailModal(null); }}
                      style={{
                        padding: "8px 14px",
                        backgroundColor: T.cardAlt,
                        color: T.text,
                        border: `1px solid ${T.border}`,
                        borderRadius: 6,
                        fontSize: 12,
                        cursor: "pointer",
                      }}
                    >
                      {detailModal.is_dismissed ? "🔄 復元" : "✅ 対応済みにする"}
                    </button>
                    <button
                      onClick={() => setDetailModal(null)}
                      style={{
                        padding: "8px 14px",
                        backgroundColor: "#c3a782",
                        color: "#fff",
                        border: "none",
                        borderRadius: 6,
                        fontSize: 12,
                        cursor: "pointer",
                      }}
                    >
                      閉じる
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
