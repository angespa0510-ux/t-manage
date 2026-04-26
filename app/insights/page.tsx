"use client";

import { useEffect, useState, useCallback } from "react";
import { useTheme } from "../../lib/theme";
import { useToast } from "../../lib/toast";
import { useStaffSession } from "../../lib/staff-session";
import { useRouter } from "next/navigation";
import Link from "next/link";

// ─── 型 ─────────────────────────────────────────

type Ga4Summary = {
  date: string;
  totalUsers: number;
  newUsers: number;
  sessions: number;
  pageViews: number;
  averageSessionDuration: number;
  bounceRate: number;
  topPages: { path: string; views: number }[];
  topReferrers: { source: string; users: number }[];
  trafficByChannel: { channel: string; users: number }[];
  deviceBreakdown: { device: string; users: number }[];
};

type ClaritySummary = {
  totalSessions: number;
  totalPageViews: number;
  totalDistinctUsers: number;
  rageClicks: number;
  deadClicks: number;
  quickBacks: number;
  excessiveScroll: number;
};

type TmanageSummary = {
  date: string;
  reservationCount: number;
  reservationCountPrevDay: number;
  totalSales: number;
  newCustomerCount: number;
  averageUnitPrice: number;
  shopReceived: number;
  topCourses: { name: string; count: number }[];
  topTherapists: { name: string; count: number }[];
};

type SourceResult<T> = { data: T; cached: boolean; error?: undefined } | { data: null; cached: false; error: string };

type SummaryResponse = {
  date: string;
  ga4: SourceResult<Ga4Summary>;
  clarity: SourceResult<ClaritySummary>;
  tmanage: SourceResult<TmanageSummary>;
  generatedAt: string;
};

type AiReview = {
  review_date: string;
  generated_at: string;
  summary: string;
  full_report: string;
  good_news: { title: string; detail: string }[];
  warnings: { title: string; detail: string; severity: "low" | "medium" | "high" }[];
  opportunities: { title: string; detail: string }[];
  read_at: string | null;
};

// ─── 日付ヘルパー ────────────────────────────────

function yesterdayStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

function shiftDate(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// ─── メインコンポーネント ───────────────────────

export default function InsightsPage() {
  const { T } = useTheme();
  const { show: toast } = useToast();
  const { activeStaff: staff, isManager } = useStaffSession();
  const router = useRouter();

  const [date, setDate] = useState(yesterdayStr());
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [latestReview, setLatestReview] = useState<AiReview | null>(null);

  // 権限チェック（社長・経営責任者のみ）
  useEffect(() => {
    if (staff && !isManager) {
      toast("アクセス解析は社長・経営責任者のみ閲覧可能です", "error");
      router.push("/admin/dashboard");
    }
  }, [staff, isManager, router, toast]);

  const loadData = useCallback(async (targetDate: string) => {
    setLoading(true);
    try {
      const [summaryRes, reviewRes] = await Promise.all([
        fetch(`/api/insights/summary?date=${targetDate}`).then((r) => r.json()),
        fetch(`/api/insights/daily-review?date=${targetDate}`).then((r) => r.json()),
      ]);
      setSummary(summaryRes);
      setLatestReview(reviewRes.review);
    } catch (e) {
      toast("データ取得に失敗しました", "error");
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadData(date);
  }, [date, loadData]);

  // ─── Mode A: コピーボタン ─────────────────────
  const handleCopy = async () => {
    if (!summary) return;
    try {
      const formatRes = await fetch("/api/insights/format-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(summary),
      });

      let text: string;
      if (formatRes.ok) {
        const j = await formatRes.json();
        text = j.text;
      } else {
        // フォールバック：クライアントで簡易整形
        text = buildSimpleText(summary);
      }
      await navigator.clipboard.writeText(text);
      toast("コピー完了！claude.ai に貼り付けて分析できます", "success");
    } catch (e) {
      toast("コピーに失敗しました", "error");
      console.error(e);
    }
  };

  // ─── レンダリング ────────────────────────────
  if (!staff) return null;

  return (
    <div className="min-h-screen" style={{ backgroundColor: T.bg, color: T.text }}>
      {/* ヘッダー */}
      <div className="px-4 py-3 sticky top-0 z-10 border-b" style={{ backgroundColor: T.card, borderColor: T.border }}>
        <div className="flex items-center justify-between gap-3 max-w-6xl mx-auto">
          <div>
            <h1 className="text-lg font-semibold">📊 アクセス解析</h1>
            <p className="text-[10px]" style={{ color: T.textSub }}>GA4 × Clarity × T-MANAGE 統合分析</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setDate(shiftDate(date, -1))}
              className="px-2 py-1 rounded text-sm"
              style={{ backgroundColor: T.cardAlt, color: T.text }}
            >
              ‹
            </button>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              max={yesterdayStr()}
              className="px-2 py-1 rounded text-sm"
              style={{ backgroundColor: T.cardAlt, color: T.text, border: `1px solid ${T.border}` }}
            />
            <button
              onClick={() => setDate(shiftDate(date, 1))}
              disabled={date >= yesterdayStr()}
              className="px-2 py-1 rounded text-sm disabled:opacity-30"
              style={{ backgroundColor: T.cardAlt, color: T.text }}
            >
              ›
            </button>
            <Link
              href="/admin/insights/settings"
              className="px-3 py-1 rounded text-xs"
              style={{ backgroundColor: T.cardAlt, color: T.textSub }}
            >
              ⚙ 設定
            </Link>
          </div>
        </div>
      </div>

      {/* メインコンテンツ */}
      <div className="max-w-6xl mx-auto p-4 space-y-4">
        {loading && (
          <div className="text-center py-12" style={{ color: T.textSub }}>読み込み中...</div>
        )}

        {!loading && summary && (
          <>
            {/* AI レポート（Mode B 結果） */}
            {latestReview && (
              <AiReportCard review={latestReview} T={T} />
            )}

            {/* T-MANAGE 実績 */}
            <SourceCard title="💴 T-MANAGE 実績" source={summary.tmanage} T={T}>
              {summary.tmanage.data && <TmanageView data={summary.tmanage.data} T={T} />}
            </SourceCard>

            {/* GA4 */}
            <SourceCard title="🟢 GA4 — 訪問・流入分析" source={summary.ga4} T={T}>
              {summary.ga4.data && <Ga4View data={summary.ga4.data} T={T} />}
            </SourceCard>

            {/* Clarity */}
            <SourceCard title="🟣 Microsoft Clarity — 行動分析" source={summary.clarity} T={T}>
              {summary.clarity.data && <ClarityView data={summary.clarity.data} T={T} />}
            </SourceCard>

            {/* Mode A コピーボタン */}
            <div className="rounded-lg p-4" style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}>
              <h3 className="font-semibold mb-2">🤖 AI分析</h3>
              <p className="text-xs mb-3" style={{ color: T.textSub }}>
                以下のボタンで全データをコピーし、Maxプランの claude.ai に貼り付けて分析できます。<br />
                ※ Mode B（API自動分析）は設定画面で有効化できます。
              </p>
              <button
                onClick={handleCopy}
                className="w-full px-4 py-3 rounded-lg font-medium text-sm"
                style={{ backgroundColor: "#c3a782", color: "#fff" }}
              >
                📋 全データをコピー（Maxプラン分析用）
              </button>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3">
                <a
                  href="https://clarity.microsoft.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-center px-3 py-2 rounded text-xs"
                  style={{ backgroundColor: T.cardAlt, color: T.textSub }}
                >
                  🟣 Clarity を開く →
                </a>
                <a
                  href="https://analytics.google.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-center px-3 py-2 rounded text-xs"
                  style={{ backgroundColor: T.cardAlt, color: T.textSub }}
                >
                  🟢 GA4 を開く →
                </a>
                <a
                  href="https://claude.ai/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-center px-3 py-2 rounded text-xs"
                  style={{ backgroundColor: T.cardAlt, color: T.textSub }}
                >
                  🤖 Claude.ai を開く →
                </a>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── 子コンポーネント ────────────────────────────

type Theme = ReturnType<typeof useTheme>["T"];

function SourceCard({ title, source, children, T }: { title: string; source: SourceResult<unknown>; children: React.ReactNode; T: Theme }) {
  return (
    <div className="rounded-lg p-4" style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}>
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold">{title}</h2>
        {source.cached && (
          <span className="text-[10px] px-2 py-0.5 rounded" style={{ backgroundColor: T.cardAlt, color: T.textSub }}>
            cached
          </span>
        )}
      </div>
      {source.error ? (
        <div className="text-sm" style={{ color: "#e88e8e" }}>
          ⚠ {source.error}
        </div>
      ) : (
        children
      )}
    </div>
  );
}

function Ga4View({ data, T }: { data: Ga4Summary; T: Theme }) {
  return (
    <div className="space-y-2 text-sm">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Stat label="訪問数" value={data.totalUsers.toLocaleString()} unit="人" T={T} />
        <Stat label="新規" value={data.newUsers.toLocaleString()} unit="人" T={T} />
        <Stat label="セッション" value={data.sessions.toLocaleString()} T={T} />
        <Stat label="PV" value={data.pageViews.toLocaleString()} T={T} />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
        <Stat label="平均滞在" value={`${Math.round(data.averageSessionDuration)}秒`} T={T} />
        <Stat label="直帰率" value={`${(data.bounceRate * 100).toFixed(1)}%`} T={T} />
      </div>
      {data.trafficByChannel.length > 0 && (
        <div className="mt-3">
          <p className="text-xs mb-1" style={{ color: T.textSub }}>チャネル別</p>
          <div className="text-xs space-y-1">
            {data.trafficByChannel.slice(0, 5).map((c) => (
              <div key={c.channel} className="flex justify-between">
                <span>{c.channel}</span>
                <span>{c.users}人</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {data.topPages.length > 0 && (
        <div className="mt-3">
          <p className="text-xs mb-1" style={{ color: T.textSub }}>人気ページ TOP5</p>
          <div className="text-xs space-y-1">
            {data.topPages.slice(0, 5).map((p) => (
              <div key={p.path} className="flex justify-between gap-2">
                <span className="truncate">{p.path}</span>
                <span style={{ color: T.textSub }}>{p.views}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ClarityView({ data, T }: { data: ClaritySummary; T: Theme }) {
  return (
    <div className="space-y-2 text-sm">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <Stat label="セッション" value={data.totalSessions.toLocaleString()} T={T} />
        <Stat label="ユーザー" value={data.totalDistinctUsers.toLocaleString()} unit="人" T={T} />
        <Stat label="PV" value={data.totalPageViews.toLocaleString()} T={T} />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
        <Stat label="⚠ Rage Click" value={data.rageClicks.toString()} T={T} alert={data.rageClicks > 0} />
        <Stat label="⚠ Dead Click" value={data.deadClicks.toString()} T={T} alert={data.deadClicks > 5} />
        <Stat label="迷子" value={data.quickBacks.toString()} T={T} />
        <Stat label="過剰スクロール" value={data.excessiveScroll.toString()} T={T} />
      </div>
      <p className="text-[10px] mt-2" style={{ color: T.textSub }}>
        💡 詳細セッション録画は Clarity ダッシュボードで再生できます
      </p>
    </div>
  );
}

function TmanageView({ data, T }: { data: TmanageSummary; T: Theme }) {
  const diff = data.reservationCount - data.reservationCountPrevDay;
  return (
    <div className="space-y-2 text-sm">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Stat
          label="予約数"
          value={data.reservationCount.toString()}
          unit="件"
          subText={`前日比 ${diff >= 0 ? "+" : ""}${diff}`}
          T={T}
        />
        <Stat label="売上" value={`¥${data.totalSales.toLocaleString()}`} T={T} />
        <Stat label="平均単価" value={`¥${data.averageUnitPrice.toLocaleString()}`} T={T} />
        <Stat label="新規顧客" value={data.newCustomerCount.toString()} unit="名" T={T} />
      </div>
      <div className="mt-2">
        <Stat label="店取概算" value={`¥${data.shopReceived.toLocaleString()}`} T={T} />
      </div>
      {data.topCourses.length > 0 && (
        <div className="mt-3">
          <p className="text-xs mb-1" style={{ color: T.textSub }}>人気コース</p>
          <div className="text-xs space-y-1">
            {data.topCourses.map((c) => (
              <div key={c.name} className="flex justify-between">
                <span className="truncate">{c.name}</span>
                <span style={{ color: T.textSub }}>{c.count}件</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {data.topTherapists.length > 0 && (
        <div className="mt-3">
          <p className="text-xs mb-1" style={{ color: T.textSub }}>指名上位</p>
          <div className="text-xs space-y-1">
            {data.topTherapists.map((t) => (
              <div key={t.name} className="flex justify-between">
                <span>{t.name}</span>
                <span style={{ color: T.textSub }}>{t.count}件</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, unit, subText, T, alert = false }: { label: string; value: string; unit?: string; subText?: string; T: Theme; alert?: boolean }) {
  return (
    <div className="rounded p-2" style={{ backgroundColor: T.cardAlt }}>
      <p className="text-[10px]" style={{ color: T.textSub }}>{label}</p>
      <p className="text-base font-semibold mt-0.5" style={{ color: alert ? "#e88e8e" : T.text }}>
        {value}
        {unit && <span className="text-[10px] ml-1" style={{ color: T.textSub }}>{unit}</span>}
      </p>
      {subText && <p className="text-[10px]" style={{ color: T.textSub }}>{subText}</p>}
    </div>
  );
}

function AiReportCard({ review, T }: { review: AiReview; T: Theme }) {
  return (
    <div className="rounded-lg p-4" style={{ backgroundColor: T.card, border: `2px solid #c3a782` }}>
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-semibold">🤖 AI 朝レポート（自動生成）</h2>
        <span className="text-[10px]" style={{ color: T.textSub }}>
          {new Date(review.generated_at).toLocaleString("ja-JP")}
        </span>
      </div>
      {review.summary && (
        <p className="text-sm font-medium mb-3" style={{ color: "#c3a782" }}>
          {review.summary}
        </p>
      )}

      {review.good_news?.length > 0 && (
        <div className="mb-3">
          <p className="text-xs font-semibold mb-1">📈 良いニュース</p>
          <ul className="text-xs space-y-1">
            {review.good_news.map((n, i) => (
              <li key={i}>
                <span className="font-medium">{n.title}</span>: <span style={{ color: T.textSub }}>{n.detail}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {review.warnings?.length > 0 && (
        <div className="mb-3">
          <p className="text-xs font-semibold mb-1">⚠️ 要対応</p>
          <ul className="text-xs space-y-1">
            {review.warnings.map((w, i) => (
              <li key={i}>
                <span className="font-medium" style={{ color: w.severity === "high" ? "#e88e8e" : T.text }}>
                  [{w.severity}] {w.title}
                </span>
                : <span style={{ color: T.textSub }}>{w.detail}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {review.opportunities?.length > 0 && (
        <div>
          <p className="text-xs font-semibold mb-1">💡 機会発見</p>
          <ul className="text-xs space-y-1">
            {review.opportunities.map((o, i) => (
              <li key={i}>
                <span className="font-medium">{o.title}</span>: <span style={{ color: T.textSub }}>{o.detail}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ─── クライアント側のフォールバック整形 ───
function buildSimpleText(s: SummaryResponse): string {
  const lines: string[] = [];
  lines.push(`【アンジュスパ アクセス解析データ ${s.date}】`);
  lines.push("");
  if (s.tmanage.data) {
    const t = s.tmanage.data;
    lines.push("■ T-MANAGE 実績");
    lines.push(`予約数: ${t.reservationCount}件 / 売上: ¥${t.totalSales.toLocaleString()} / 新規: ${t.newCustomerCount}名`);
    lines.push("");
  }
  if (s.ga4.data) {
    const g = s.ga4.data;
    lines.push("■ GA4");
    lines.push(`訪問: ${g.totalUsers}人 / 新規: ${g.newUsers}人 / PV: ${g.pageViews}`);
    lines.push("");
  }
  if (s.clarity.data) {
    const c = s.clarity.data;
    lines.push("■ Clarity");
    lines.push(`Rage:${c.rageClicks} Dead:${c.deadClicks} 迷子:${c.quickBacks}`);
    lines.push("");
  }
  lines.push("このデータを分析して、良いニュース・要対応・機会発見・今日のアクションの4観点で報告してください。");
  return lines.join("\n");
}
