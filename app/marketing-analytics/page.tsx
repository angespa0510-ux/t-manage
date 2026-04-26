"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useStaffSession } from "../../lib/staff-session";
import { useTheme } from "../../lib/theme";
import { GIFT_CATALOG } from "../../lib/gift-catalog";

/**
 * 集客分析ダッシュボード (Phase 4 Step L)
 *
 * 権限: isManager
 *
 * 表示内容:
 *   - KPI サマリー (予約/売上/新規会員/お気に入り)
 *   - コンテンツ統計 (日記/ストーリー/ライブ)
 *   - 投げ銭分析 (ランキング/人気ギフト/ソース別)
 *   - 人気セラピストランキング
 *   - 日別タイムライン (シンプルなSVG折れ線グラフ)
 */

type Period = "7d" | "30d" | "90d" | "year";

type AnalyticsData = {
  period: string;
  label: string;
  since: string;
  kpi: {
    totalReservations: number;
    completedReservations: number;
    totalRevenue: number;
    avgPricePerReservation: number;
    newCustomers: number;
    repeaters: number;
    newFavorites: number;
  };
  diary: {
    publishedCount: number;
    ekichikaSent: number;
    totalViews: number;
    totalLikes: number;
    totalComments: number;
    totalGiftPoints: number;
  };
  story: {
    publishedCount: number;
    totalViews: number;
    totalGiftPoints: number;
  };
  live: {
    totalStreams: number;
    completedStreams: number;
    totalDurationSec: number;
    totalViewers: number;
    totalHearts: number;
    totalComments: number;
    totalGiftPoints: number;
  };
  gift: {
    totalCount: number;
    totalPoints: number;
    bySource: { live: number; diary: number; story: number };
    therapistRanking: {
      therapistId: number;
      therapistName: string;
      photoUrl: string | null;
      count: number;
      points: number;
    }[];
    popularGifts: { kind: string; count: number; points: number }[];
  };
  popularTherapists: {
    therapistId: number;
    therapistName: string;
    photoUrl: string | null;
    favoriteCount: number;
  }[];
  dailyTimeline: {
    date: string;
    reservations: number;
    revenue: number;
    diaryViews: number;
    giftPoints: number;
  }[];
};

export default function MarketingAnalyticsPage() {
  const { activeStaff, isManager, isRestored } = useStaffSession();
  const { dark, toggle, T } = useTheme();

  const [period, setPeriod] = useState<Period>("30d");
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/analytics/marketing?period=${period}`);
      const d = await res.json();
      if (res.ok) setData(d);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    if (isRestored && isManager) fetchData();
  }, [isRestored, isManager, fetchData]);

  // ─────────────────────────────────────────────
  // フォーマッタ
  // ─────────────────────────────────────────────
  const fmt = (n: number) => n.toLocaleString();
  const fmtYen = (n: number) => "¥" + n.toLocaleString();
  const fmtDuration = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    if (h > 0) return `${h}h${m}m`;
    return `${m}分`;
  };

  // ─────────────────────────────────────────────
  // 認証
  // ─────────────────────────────────────────────
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

  // ─────────────────────────────────────────────
  // 折れ線グラフのSVG (シンプル実装)
  // ─────────────────────────────────────────────
  const renderTimeline = (
    timeline: AnalyticsData["dailyTimeline"],
    field: "reservations" | "revenue" | "giftPoints",
    color: string
  ) => {
    if (timeline.length === 0) return null;
    const W = 800;
    const H = 140;
    const PAD = 28;
    const values = timeline.map((p) => p[field]);
    const maxVal = Math.max(...values, 1);
    const stepX = (W - PAD * 2) / Math.max(timeline.length - 1, 1);

    const points = timeline.map((p, i) => ({
      x: PAD + i * stepX,
      y: H - PAD - ((p[field] / maxVal) * (H - PAD * 2)),
      raw: p[field],
      date: p.date,
    }));
    const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
    const areaPath = `${path} L${points[points.length - 1].x.toFixed(1)},${H - PAD} L${PAD},${H - PAD} Z`;

    return (
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}>
        {/* 背景グリッド */}
        {[0, 0.25, 0.5, 0.75, 1].map((r, i) => (
          <line key={i} x1={PAD} x2={W - PAD} y1={H - PAD - r * (H - PAD * 2)} y2={H - PAD - r * (H - PAD * 2)} stroke={T.border} strokeDasharray="2 4" strokeWidth={0.5} />
        ))}
        {/* エリア塗り */}
        <path d={areaPath} fill={color} opacity={0.12} />
        {/* 折れ線 */}
        <path d={path} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />
        {/* ドット */}
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={2.5} fill={color}>
            <title>{p.date}: {p.raw.toLocaleString()}</title>
          </circle>
        ))}
        {/* X軸ラベル (5分割) */}
        {[0, 1, 2, 3, 4].map((i) => {
          const idx = Math.floor((timeline.length - 1) * (i / 4));
          const p = timeline[idx];
          if (!p) return null;
          const x = PAD + idx * stepX;
          const md = p.date.slice(5);
          return (
            <text key={i} x={x} y={H - 8} fontSize={9} fill={T.textMuted} textAnchor="middle" fontFamily="monospace">{md}</text>
          );
        })}
        {/* Y軸最大値 */}
        <text x={PAD - 4} y={PAD + 3} fontSize={9} fill={T.textMuted} textAnchor="end" fontFamily="monospace">{maxVal.toLocaleString()}</text>
      </svg>
    );
  };

  // ─────────────────────────────────────────────
  // レンダリング
  // ─────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", backgroundColor: T.bg, color: T.text, padding: 16 }}>
      {/* ヘッダ */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 500, marginBottom: 4 }}>📊 集客分析ダッシュボード</h1>
          <p style={{ fontSize: 11, color: T.textMuted }}>
            写メ日記・ストーリー・ライブ配信・情報配信報酬の分析
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={fetchData} style={{ padding: "6px 10px", fontSize: 11, cursor: "pointer", backgroundColor: "transparent", border: `1px solid ${T.border}`, color: T.textSub }}>🔄 更新</button>
          <button onClick={toggle} style={{ padding: "6px 10px", fontSize: 11, cursor: "pointer", backgroundColor: "transparent", border: `1px solid ${T.border}`, color: T.textSub }}>{dark ? "☀️" : "🌙"}</button>
          <Link href="/dashboard" style={{ padding: "6px 10px", fontSize: 11, backgroundColor: "transparent", border: `1px solid ${T.border}`, color: T.textSub, textDecoration: "none" }}>← HOME</Link>
        </div>
      </div>

      {/* 期間切替 */}
      <div style={{ display: "flex", gap: 0, marginBottom: 16, border: `1px solid ${T.border}`, backgroundColor: T.card }}>
        {([
          { key: "7d", label: "7日間" },
          { key: "30d", label: "30日間" },
          { key: "90d", label: "90日間" },
          { key: "year", label: "1年間" },
        ] as const).map((p, i) => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            style={{
              flex: 1,
              padding: 10,
              fontSize: 12,
              cursor: "pointer",
              backgroundColor: period === p.key ? T.accent : "transparent",
              color: period === p.key ? "#fff" : T.textSub,
              border: "none",
              borderLeft: i > 0 ? `1px solid ${T.border}` : "none",
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      {loading || !data ? (
        <p style={{ textAlign: "center", padding: 60, color: T.textMuted }}>読み込み中...</p>
      ) : (
        <>
          <p style={{ fontSize: 11, color: T.textSub, marginBottom: 12, textAlign: "center" }}>{data.label} の集計</p>

          {/* ──────────── KPI サマリー ──────────── */}
          <div style={{ marginBottom: 18 }}>
            <p style={{ fontSize: 11, color: T.textSub, marginBottom: 8, fontWeight: 500 }}>📈 KPI サマリー</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8 }}>
              <KpiCard T={T} label="予約数" value={fmt(data.kpi.totalReservations)} sub={`完了 ${data.kpi.completedReservations}件`} />
              <KpiCard T={T} label="売上" value={fmtYen(data.kpi.totalRevenue)} sub={`平均 ${fmtYen(data.kpi.avgPricePerReservation)}/件`} color="#6b9b7e" />
              <KpiCard T={T} label="新規会員" value={fmt(data.kpi.newCustomers)} sub={`リピーター ${data.kpi.repeaters}人`} color="#4a7ca0" />
              <KpiCard T={T} label="新規お気に入り" value={fmt(data.kpi.newFavorites)} sub="セラピストへの登録" color={T.accent} />
            </div>
          </div>

          {/* ──────────── コンテンツ統計 ──────────── */}
          <div style={{ marginBottom: 18 }}>
            <p style={{ fontSize: 11, color: T.textSub, marginBottom: 8, fontWeight: 500 }}>📓 コンテンツ統計</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
              {/* 写メ日記 */}
              <div style={{ padding: 14, backgroundColor: T.card, border: `1px solid ${T.border}` }}>
                <p style={{ fontSize: 13, fontWeight: 500, marginBottom: 10, color: T.text }}>📓 写メ日記</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 11 }}>
                  <Stat T={T} label="投稿数" value={fmt(data.diary.publishedCount)} />
                  <Stat T={T} label="駅ちか連携" value={fmt(data.diary.ekichikaSent)} />
                  <Stat T={T} label="総PV" value={fmt(data.diary.totalViews)} />
                  <Stat T={T} label="いいね" value={fmt(data.diary.totalLikes)} />
                  <Stat T={T} label="コメント" value={fmt(data.diary.totalComments)} />
                  <Stat T={T} label="配信報酬" value={fmt(data.diary.totalGiftPoints) + "pt"} />
                </div>
              </div>

              {/* ストーリー */}
              <div style={{ padding: 14, backgroundColor: T.card, border: `1px solid ${T.border}` }}>
                <p style={{ fontSize: 13, fontWeight: 500, marginBottom: 10, color: T.text }}>📡 ストーリー</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, fontSize: 11 }}>
                  <Stat T={T} label="投稿数" value={fmt(data.story.publishedCount)} />
                  <Stat T={T} label="閲覧数" value={fmt(data.story.totalViews)} />
                  <Stat T={T} label="配信報酬" value={fmt(data.story.totalGiftPoints) + "pt"} />
                </div>
              </div>

              {/* ライブ配信 */}
              <div style={{ padding: 14, backgroundColor: T.card, border: `1px solid ${T.border}` }}>
                <p style={{ fontSize: 13, fontWeight: 500, marginBottom: 10, color: T.text }}>🔴 ライブ配信</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 11 }}>
                  <Stat T={T} label="配信数" value={fmt(data.live.totalStreams)} />
                  <Stat T={T} label="完了配信" value={fmt(data.live.completedStreams)} />
                  <Stat T={T} label="累計時間" value={fmtDuration(data.live.totalDurationSec)} />
                  <Stat T={T} label="累計視聴" value={fmt(data.live.totalViewers)} />
                  <Stat T={T} label="ハート" value={fmt(data.live.totalHearts)} />
                  <Stat T={T} label="コメント" value={fmt(data.live.totalComments)} />
                  <Stat T={T} label="配信報酬" value={fmt(data.live.totalGiftPoints) + "pt"} />
                </div>
              </div>
            </div>
          </div>

          {/* ──────────── 日別タイムライン ──────────── */}
          <div style={{ marginBottom: 18 }}>
            <p style={{ fontSize: 11, color: T.textSub, marginBottom: 8, fontWeight: 500 }}>📈 日別推移</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 12 }}>
              <ChartCard T={T} title="📅 予約数" color="#4a7ca0">
                {renderTimeline(data.dailyTimeline, "reservations", "#4a7ca0")}
              </ChartCard>
              <ChartCard T={T} title="💰 売上" color="#6b9b7e">
                {renderTimeline(data.dailyTimeline, "revenue", "#6b9b7e")}
              </ChartCard>
              <ChartCard T={T} title="💝 情報配信報酬" color={T.accent}>
                {renderTimeline(data.dailyTimeline, "giftPoints", T.accent)}
              </ChartCard>
            </div>
          </div>

          {/* ──────────── 投げ銭分析 ──────────── */}
          <div style={{ marginBottom: 18 }}>
            <p style={{ fontSize: 11, color: T.textSub, marginBottom: 8, fontWeight: 500 }}>💝 情報配信報酬分析（お客様からの投げ銭）</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
              {/* 概要 */}
              <div style={{ padding: 14, backgroundColor: T.card, border: `1px solid ${T.border}` }}>
                <p style={{ fontSize: 13, fontWeight: 500, marginBottom: 10, color: T.text }}>📊 概要</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 11, marginBottom: 10 }}>
                  <Stat T={T} label="総回数" value={fmt(data.gift.totalCount)} />
                  <Stat T={T} label="累計" value={fmt(data.gift.totalPoints) + "pt"} />
                </div>
                <p style={{ fontSize: 10, color: T.textMuted, marginBottom: 4 }}>ソース別:</p>
                <div style={{ display: "flex", gap: 6 }}>
                  <SourceBar label="🔴ライブ" count={data.gift.bySource.live} total={data.gift.totalCount} color="#dc3250" />
                  <SourceBar label="📓日記" count={data.gift.bySource.diary} total={data.gift.totalCount} color="#4a7ca0" />
                  <SourceBar label="📡ストーリー" count={data.gift.bySource.story} total={data.gift.totalCount} color={T.accent} />
                </div>
              </div>

              {/* 人気ギフト */}
              <div style={{ padding: 14, backgroundColor: T.card, border: `1px solid ${T.border}` }}>
                <p style={{ fontSize: 13, fontWeight: 500, marginBottom: 10, color: T.text }}>✨ 人気ギフト</p>
                {data.gift.popularGifts.length === 0 ? (
                  <p style={{ fontSize: 11, color: T.textMuted, textAlign: "center", padding: 16 }}>データなし</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {data.gift.popularGifts.slice(0, 8).map((g) => {
                      const cat = GIFT_CATALOG.find((c) => c.kind === g.kind);
                      const max = data.gift.popularGifts[0].count;
                      const w = max > 0 ? (g.count / max) * 100 : 0;
                      return (
                        <div key={g.kind}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, marginBottom: 2 }}>
                            <span style={{ color: T.text }}>
                              <span style={{ fontSize: 13, marginRight: 4 }}>{cat?.emoji || "🎁"}</span>
                              {cat?.label || g.kind}
                            </span>
                            <span style={{ color: T.textSub, fontVariantNumeric: "tabular-nums" }}>
                              {g.count}回 ({fmt(g.points)}pt)
                            </span>
                          </div>
                          <div style={{ height: 4, backgroundColor: T.cardAlt, position: "relative" }}>
                            <div style={{ position: "absolute", inset: 0, width: `${w}%`, backgroundColor: cat?.color || T.accent }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* セラピストランキング */}
              <div style={{ padding: 14, backgroundColor: T.card, border: `1px solid ${T.border}` }}>
                <p style={{ fontSize: 13, fontWeight: 500, marginBottom: 10, color: T.text }}>🏆 情報配信報酬TOP5</p>
                {data.gift.therapistRanking.length === 0 ? (
                  <p style={{ fontSize: 11, color: T.textMuted, textAlign: "center", padding: 16 }}>データなし</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {data.gift.therapistRanking.map((r, i) => (
                      <div key={r.therapistId} style={{ display: "flex", alignItems: "center", gap: 8, padding: 6, backgroundColor: i === 0 ? "#fef7e0" : T.cardAlt }}>
                        <span style={{ width: 22, textAlign: "center", fontSize: 14, color: i === 0 ? "#e0b240" : i === 1 ? "#9a9a9a" : i === 2 ? "#c08c5e" : T.textMuted, fontWeight: 500 }}>
                          {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                        </span>
                        <p style={{ flex: 1, fontSize: 11, color: T.text }}>{r.therapistName}</p>
                        <p style={{ fontSize: 11, color: T.accent, fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>
                          {fmt(r.points)}pt
                        </p>
                        <p style={{ fontSize: 9, color: T.textMuted, fontVariantNumeric: "tabular-nums" }}>
                          ({r.count}回)
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ──────────── 人気セラピスト (お気に入り) ──────────── */}
          <div style={{ marginBottom: 18 }}>
            <p style={{ fontSize: 11, color: T.textSub, marginBottom: 8, fontWeight: 500 }}>💗 お気に入り登録セラピストTOP5</p>
            <div style={{ padding: 14, backgroundColor: T.card, border: `1px solid ${T.border}` }}>
              {data.popularTherapists.length === 0 ? (
                <p style={{ fontSize: 11, color: T.textMuted, textAlign: "center", padding: 16 }}>データなし</p>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8 }}>
                  {data.popularTherapists.map((r, i) => (
                    <div key={r.therapistId} style={{ padding: 10, backgroundColor: T.cardAlt, textAlign: "center", border: i === 0 ? `1px solid ${T.accent}` : `1px solid ${T.border}` }}>
                      <p style={{ fontSize: 16, marginBottom: 4 }}>{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}</p>
                      <p style={{ fontSize: 12, fontWeight: 500, color: T.text, marginBottom: 4 }}>{r.therapistName}</p>
                      <p style={{ fontSize: 11, color: T.accent, fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>
                        💗 {fmt(r.favoriteCount)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// 補助コンポーネント
// ─────────────────────────────────────────────
function KpiCard({ T, label, value, sub, color }: { T: { card: string; border: string; text: string; textSub: string; textMuted: string }; label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{ padding: 14, backgroundColor: T.card, border: `1px solid ${T.border}` }}>
      <p style={{ fontSize: 10, color: T.textMuted, marginBottom: 6 }}>{label}</p>
      <p style={{ fontSize: 22, fontWeight: 500, color: color || T.text, fontVariantNumeric: "tabular-nums", lineHeight: 1.1 }}>{value}</p>
      {sub && <p style={{ fontSize: 9, color: T.textMuted, marginTop: 4 }}>{sub}</p>}
    </div>
  );
}

function Stat({ T, label, value }: { T: { textMuted: string; text: string }; label: string; value: string }) {
  return (
    <div>
      <p style={{ fontSize: 9, color: T.textMuted, marginBottom: 2 }}>{label}</p>
      <p style={{ fontSize: 14, fontWeight: 500, color: T.text, fontVariantNumeric: "tabular-nums" }}>{value}</p>
    </div>
  );
}

function ChartCard({ T, title, color, children }: { T: { card: string; border: string; text: string }; title: string; color: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: 14, backgroundColor: T.card, border: `1px solid ${T.border}` }}>
      <p style={{ fontSize: 12, fontWeight: 500, marginBottom: 8, color }}>{title}</p>
      {children}
    </div>
  );
}

function SourceBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div style={{ flex: 1, textAlign: "center" }}>
      <p style={{ fontSize: 9, color: "#888", marginBottom: 2 }}>{label}</p>
      <p style={{ fontSize: 13, color, fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>{count}</p>
      <p style={{ fontSize: 8, color: "#aaa" }}>{pct}%</p>
    </div>
  );
}
