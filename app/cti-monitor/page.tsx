"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { useTheme } from "../../lib/theme";
import { NavMenu } from "../../lib/nav-menu";
import { useStaffSession } from "../../lib/staff-session";

// ─── 型 ──────────────────────────────────────────────
type CtiCall = {
  id: number;
  phone: string;
  created_at: string;
  handled: boolean;
  source: string | null;
  store_id: number | null;
  device_id: string | null;
  raw_text: string | null;
};

type SourceStats = {
  source: string;
  label: string;
  icon: string;
  color: string;
  count: number;
  unknownCount: number; // 番号抽出失敗件数
};

// ─── 定数 ────────────────────────────────────────────
const SOURCE_META: Record<string, { label: string; icon: string; color: string }> = {
  android: { label: "Android CTI", icon: "🤖", color: "#4a7c59" },
  iphone_beta: { label: "iPhone Beta版", icon: "📱", color: "#e8849a" },
  twilio: { label: "Twilio 連携", icon: "☁️", color: "#4a7ca0" },
  manual: { label: "手動テスト", icon: "🧪", color: "#888780" },
};

const PERIOD_OPTIONS = [
  { key: "7d", label: "過去7日間", days: 7 },
  { key: "30d", label: "過去30日間", days: 30 },
  { key: "90d", label: "過去90日間", days: 90 },
] as const;

// ─── コンポーネント ───────────────────────────────────
export default function CtiMonitorPage() {
  const router = useRouter();
  const { dark, toggle, T } = useTheme();
  const { activeStaff, isManager } = useStaffSession();

  const [calls, setCalls] = useState<CtiCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<"7d" | "30d" | "90d">("30d");

  // アクセス制御
  useEffect(() => {
    if (activeStaff === null) return;
    if (!isManager) {
      router.push("/dashboard");
    }
  }, [activeStaff, isManager, router]);

  // データ取得
  const fetchCalls = useCallback(async () => {
    setLoading(true);
    const days = PERIOD_OPTIONS.find((p) => p.key === period)?.days ?? 30;
    const sinceIso = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from("cti_calls")
      .select("*")
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false })
      .limit(2000);

    if (error) {
      console.error("CTI calls fetch error:", error);
      setCalls([]);
    } else {
      setCalls((data ?? []) as CtiCall[]);
    }
    setLoading(false);
  }, [period]);

  useEffect(() => {
    if (isManager) fetchCalls();
  }, [isManager, fetchCalls]);

  // ソース別統計
  const sourceStats = useMemo<SourceStats[]>(() => {
    const acc: Record<string, { count: number; unknownCount: number }> = {};
    for (const c of calls) {
      const src = c.source || "android";
      if (!acc[src]) acc[src] = { count: 0, unknownCount: 0 };
      acc[src].count += 1;
      if (c.phone === "unknown" || !c.phone || c.phone.length < 10) {
        acc[src].unknownCount += 1;
      }
    }
    const results: SourceStats[] = [];
    for (const src of Object.keys(acc)) {
      const meta = SOURCE_META[src] || { label: src, icon: "❓", color: "#888" };
      results.push({
        source: src,
        label: meta.label,
        icon: meta.icon,
        color: meta.color,
        count: acc[src].count,
        unknownCount: acc[src].unknownCount,
      });
    }
    return results.sort((a, b) => b.count - a.count);
  }, [calls]);

  // 全体サマリー
  const totalCount = calls.length;
  const unknownTotal = calls.filter(
    (c) => c.phone === "unknown" || !c.phone || c.phone.length < 10
  ).length;
  const iphoneBetaStats = sourceStats.find((s) => s.source === "iphone_beta");

  // 直近100件
  const recentCalls = useMemo(() => calls.slice(0, 100), [calls]);

  // 日別件数(最大14日分、グラフ用)
  const dailyCounts = useMemo(() => {
    const days = 14;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const result: { date: string; counts: Record<string, number>; total: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const ymd = d.toISOString().slice(0, 10);
      const md = `${d.getMonth() + 1}/${d.getDate()}`;
      result.push({ date: md, counts: {}, total: 0 });
    }
    for (const c of calls) {
      const d = new Date(c.created_at);
      d.setHours(0, 0, 0, 0);
      const md = `${d.getMonth() + 1}/${d.getDate()}`;
      const entry = result.find((r) => r.date === md);
      if (!entry) continue;
      const src = c.source || "android";
      entry.counts[src] = (entry.counts[src] || 0) + 1;
      entry.total += 1;
    }
    return result;
  }, [calls]);
  const maxDailyTotal = Math.max(1, ...dailyCounts.map((d) => d.total));

  // ─── レンダリング ────────────────────────────────
  if (activeStaff === null) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: T.bg, color: T.text }}>
        <p className="text-[13px]" style={{ color: T.textMuted }}>認証中...</p>
      </div>
    );
  }

  if (!isManager) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: T.bg, color: T.text }}>
        <p className="text-[13px]" style={{ color: T.textMuted }}>このページにアクセスする権限がありません</p>
      </div>
    );
  }

  const cardStyle = { backgroundColor: T.card, border: `1px solid ${T.border}` };

  return (
    <div className="min-h-screen" style={{ backgroundColor: T.bg, color: T.text }}>
      {/* ヘッダー */}
      <div
        className="sticky top-0 z-10 px-6 py-3 flex items-center justify-between"
        style={{ backgroundColor: T.card, borderBottom: `1px solid ${T.border}` }}
      >
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="text-[12px]" style={{ color: T.textSub, textDecoration: "none" }}>
            ← ダッシュボード
          </Link>
          <div>
            <div className="text-[14px] font-medium">📞 CTI 監視</div>
            <div className="text-[10px]" style={{ color: T.textMuted }}>
              着信検出の統計・ソース別精度
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={toggle}
            className="px-3 py-1.5 rounded-lg text-[11px] cursor-pointer"
            style={{ backgroundColor: T.cardAlt, color: T.textSub, border: `1px solid ${T.border}` }}
          >
            {dark ? "☀️" : "🌙"}
          </button>
          <NavMenu T={T} dark={dark} />
        </div>
      </div>

      <div className="p-6 max-w-6xl mx-auto">
        {/* 期間選択 */}
        <div className="flex items-center gap-2 mb-5">
          <span className="text-[11px]" style={{ color: T.textMuted }}>期間:</span>
          {PERIOD_OPTIONS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key as "7d" | "30d" | "90d")}
              className="px-3 py-1.5 rounded-lg text-[11px] cursor-pointer"
              style={{
                backgroundColor: period === p.key ? T.accent : T.cardAlt,
                color: period === p.key ? "#fff" : T.textSub,
                border: `1px solid ${T.border}`,
                fontWeight: period === p.key ? 600 : 400,
              }}
            >
              {p.label}
            </button>
          ))}
          <button
            onClick={fetchCalls}
            className="ml-auto px-3 py-1.5 rounded-lg text-[11px] cursor-pointer"
            style={{ backgroundColor: T.cardAlt, color: T.textSub, border: `1px solid ${T.border}` }}
          >
            🔄 更新
          </button>
        </div>

        {loading ? (
          <div className="text-center py-20 text-[13px]" style={{ color: T.textMuted }}>
            読み込み中...
          </div>
        ) : (
          <>
            {/* 全体サマリー */}
            <div className="grid grid-cols-3 gap-4 mb-5">
              <div className="rounded-2xl p-5" style={cardStyle}>
                <div className="text-[10px] mb-1" style={{ color: T.textMuted }}>総着信検出数</div>
                <div className="text-[28px] font-medium" style={{ fontVariantNumeric: "tabular-nums" }}>
                  {totalCount.toLocaleString()}
                </div>
                <div className="text-[10px] mt-1" style={{ color: T.textFaint }}>件 (全ソース)</div>
              </div>
              <div className="rounded-2xl p-5" style={cardStyle}>
                <div className="text-[10px] mb-1" style={{ color: T.textMuted }}>番号抽出失敗</div>
                <div
                  className="text-[28px] font-medium"
                  style={{ fontVariantNumeric: "tabular-nums", color: unknownTotal > 0 ? "#f59e0b" : T.text }}
                >
                  {unknownTotal.toLocaleString()}
                </div>
                <div className="text-[10px] mt-1" style={{ color: T.textFaint }}>
                  件 ({totalCount > 0 ? ((unknownTotal / totalCount) * 100).toFixed(1) : "0.0"}%)
                </div>
              </div>
              <div className="rounded-2xl p-5" style={cardStyle}>
                <div className="text-[10px] mb-1" style={{ color: T.textMuted }}>アクティブソース</div>
                <div className="text-[28px] font-medium" style={{ fontVariantNumeric: "tabular-nums" }}>
                  {sourceStats.length}
                </div>
                <div className="text-[10px] mt-1" style={{ color: T.textFaint }}>種類</div>
              </div>
            </div>

            {/* ソース別統計 */}
            <div className="rounded-2xl p-5 mb-5" style={cardStyle}>
              <div className="text-[13px] font-medium mb-4">📊 ソース別内訳</div>
              {sourceStats.length === 0 ? (
                <div className="text-[12px] text-center py-8" style={{ color: T.textMuted }}>
                  この期間に着信はありません
                </div>
              ) : (
                <div className="space-y-3">
                  {sourceStats.map((s) => {
                    const pct = totalCount > 0 ? (s.count / totalCount) * 100 : 0;
                    const unknownPct = s.count > 0 ? (s.unknownCount / s.count) * 100 : 0;
                    return (
                      <div key={s.source}>
                        <div className="flex items-center gap-3 mb-1">
                          <span className="text-[14px]">{s.icon}</span>
                          <span className="text-[12px] font-medium flex-1">{s.label}</span>
                          <span className="text-[12px]" style={{ fontVariantNumeric: "tabular-nums" }}>
                            {s.count.toLocaleString()} 件
                          </span>
                          <span className="text-[10px]" style={{ color: T.textMuted, minWidth: 42, textAlign: "right" }}>
                            {pct.toFixed(1)}%
                          </span>
                        </div>
                        <div
                          style={{
                            height: 6,
                            backgroundColor: T.cardAlt,
                            borderRadius: 3,
                            overflow: "hidden",
                            position: "relative",
                          }}
                        >
                          <div
                            style={{
                              width: `${pct}%`,
                              height: "100%",
                              backgroundColor: s.color,
                              transition: "width 0.3s",
                            }}
                          />
                        </div>
                        {s.unknownCount > 0 && (
                          <div className="text-[10px] mt-1" style={{ color: "#f59e0b" }}>
                            ⚠ 番号抽出失敗 {s.unknownCount} 件 ({unknownPct.toFixed(1)}%)
                            {s.source === "iphone_beta" &&
                              " — iPhone 連絡先登録済みの番号が名前で通知された可能性"}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 日別推移グラフ */}
            <div className="rounded-2xl p-5 mb-5" style={cardStyle}>
              <div className="text-[13px] font-medium mb-4">📈 直近14日間の推移</div>
              <div className="flex items-end gap-1" style={{ height: 120 }}>
                {dailyCounts.map((d, i) => {
                  const h = maxDailyTotal > 0 ? (d.total / maxDailyTotal) * 100 : 0;
                  return (
                    <div
                      key={i}
                      className="flex-1 flex flex-col items-center justify-end gap-1"
                      title={`${d.date}: ${d.total}件`}
                    >
                      <div
                        style={{
                          width: "100%",
                          height: `${h}%`,
                          backgroundColor: d.total > 0 ? T.accent : T.cardAlt,
                          borderRadius: "4px 4px 0 0",
                          minHeight: d.total > 0 ? 3 : 1,
                          transition: "height 0.3s",
                        }}
                      />
                      <div className="text-[9px]" style={{ color: T.textFaint }}>
                        {d.date}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* iPhone Beta版の特別パネル (アップセル導線) */}
            {iphoneBetaStats && iphoneBetaStats.count > 0 && (
              <div
                className="rounded-2xl p-5 mb-5"
                style={{
                  backgroundColor: dark ? "rgba(232,132,154,0.08)" : "rgba(232,132,154,0.05)",
                  border: "1px solid rgba(232,132,154,0.3)",
                }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[16px]">📱</span>
                  <span className="text-[13px] font-medium">iPhone Beta版の精度</span>
                  <span
                    className="px-2 py-0.5 rounded-full text-[9px]"
                    style={{ backgroundColor: "#e8849a", color: "#fff" }}
                  >
                    BETA
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-4 mb-3">
                  <div>
                    <div className="text-[10px]" style={{ color: T.textMuted }}>検出成功</div>
                    <div
                      className="text-[20px] font-medium"
                      style={{ fontVariantNumeric: "tabular-nums", color: "#4a7c59" }}
                    >
                      {(iphoneBetaStats.count - iphoneBetaStats.unknownCount).toLocaleString()} 件
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px]" style={{ color: T.textMuted }}>番号取得失敗 (名前のみ)</div>
                    <div
                      className="text-[20px] font-medium"
                      style={{ fontVariantNumeric: "tabular-nums", color: "#f59e0b" }}
                    >
                      {iphoneBetaStats.unknownCount.toLocaleString()} 件
                    </div>
                  </div>
                </div>
                <div
                  className="text-[11px] p-3 rounded-lg"
                  style={{ backgroundColor: T.card, color: T.textSub, lineHeight: 1.6 }}
                >
                  💡 <strong>100% の検出率が必要な場合</strong>は、Twilio 連携版 (有料) をご検討ください。
                  Phone Link 接続状態・iPhone 連絡先の状況に依存しない、クラウド完結型の CTI です。
                </div>
              </div>
            )}

            {/* 直近の着信ログ */}
            <div className="rounded-2xl p-5" style={cardStyle}>
              <div className="text-[13px] font-medium mb-4">🗒 直近の着信ログ ({Math.min(100, recentCalls.length)}件)</div>
              {recentCalls.length === 0 ? (
                <div className="text-[12px] text-center py-8" style={{ color: T.textMuted }}>
                  着信履歴がありません
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-[11px]" style={{ borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${T.border}`, color: T.textMuted }}>
                        <th className="text-left py-2 px-2 font-normal">日時</th>
                        <th className="text-left py-2 px-2 font-normal">ソース</th>
                        <th className="text-left py-2 px-2 font-normal">電話番号</th>
                        <th className="text-left py-2 px-2 font-normal">デバイス</th>
                        <th className="text-left py-2 px-2 font-normal">状態</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentCalls.map((c) => {
                        const meta = SOURCE_META[c.source || "android"] || {
                          label: c.source || "android",
                          icon: "❓",
                          color: "#888",
                        };
                        const unknown = c.phone === "unknown" || !c.phone || c.phone.length < 10;
                        const d = new Date(c.created_at);
                        const dateStr = `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(
                          2,
                          "0"
                        )}:${String(d.getMinutes()).padStart(2, "0")}`;
                        return (
                          <tr key={c.id} style={{ borderBottom: `1px solid ${T.border}` }}>
                            <td className="py-2 px-2" style={{ fontVariantNumeric: "tabular-nums", color: T.textSub }}>
                              {dateStr}
                            </td>
                            <td className="py-2 px-2">
                              <span
                                className="px-2 py-0.5 rounded-full text-[9px]"
                                style={{
                                  backgroundColor: `${meta.color}22`,
                                  color: meta.color,
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {meta.icon} {meta.label}
                              </span>
                            </td>
                            <td className="py-2 px-2" style={{ fontVariantNumeric: "tabular-nums" }}>
                              {unknown ? (
                                <span style={{ color: "#f59e0b" }}>
                                  ⚠ 抽出失敗
                                  {c.raw_text && (
                                    <span className="ml-1 text-[9px]" style={{ color: T.textFaint }}>
                                      ({c.raw_text.slice(0, 20)}...)
                                    </span>
                                  )}
                                </span>
                              ) : (
                                c.phone
                              )}
                            </td>
                            <td className="py-2 px-2" style={{ color: T.textFaint }}>
                              {c.device_id || "-"}
                            </td>
                            <td className="py-2 px-2">
                              {c.handled ? (
                                <span style={{ color: "#4a7c59" }}>✓ 対応済</span>
                              ) : (
                                <span style={{ color: T.textFaint }}>-</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* フッター: セットアップ導線 */}
            <div className="mt-5 text-[10px] text-center" style={{ color: T.textFaint, lineHeight: 1.8 }}>
              📱 iPhone Beta 版のセットアップは <code>iphone-cti-bridge/</code> フォルダの README.md を参照
              <br />
              🔌 着信検出が滞っている場合は、Bridge / CTI アプリの起動状態を確認してください
            </div>
          </>
        )}
      </div>
    </div>
  );
}
