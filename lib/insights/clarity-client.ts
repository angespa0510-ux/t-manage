/**
 * Microsoft Clarity Data Export API クライアント
 *
 * Clarityのプロジェクトデータ（数値サマリー）を取得する。
 * 録画動画自体は取得できない（ダッシュボードでのみ閲覧可能）。
 *
 * ========== Vercel 環境変数 ==========
 *
 *   CLARITY_API_TOKEN  Clarityで生成したAPIトークン
 *
 * ========== 取得できるメトリック ==========
 *
 * - Sessions（セッション数）
 * - PageViews（ページビュー数）
 * - DistinctUsers（ユニークユーザー数）
 * - DeadClicks（無反応クリック）
 * - RageClicks（イライラクリック）
 * - QuickBacks（迷子）
 * - ScrollDepth（スクロール深度）
 * - ExcessiveScroll（過剰スクロール）
 *
 * ========== レート制限 ==========
 *
 * 1日10リクエストまで（Clarity API 仕様）。
 * 重複呼び出しを避けるため insights_data_cache でキャッシュする。
 *
 * @see https://learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-data-export-api
 */

// ───────── 型定義 ─────────

export type ClaritySummary = {
  startDate: string;                          // YYYY-MM-DD
  endDate: string;                            // YYYY-MM-DD
  totalSessions: number;
  totalPageViews: number;
  totalDistinctUsers: number;
  rageClicks: number;
  deadClicks: number;
  quickBacks: number;
  excessiveScroll: number;
  averageScrollDepth: number;                 // 0〜1
  topPagesByRageClicks: { url: string; count: number }[];
  topPagesByDeadClicks: { url: string; count: number }[];
};

type ClarityRawMetric = {
  metricName: string;
  information?: { sessionsCount?: string; sessionsWithMetricCount?: string }[];
};

// ───────── 公開関数: 1日分のサマリー取得 ─────────

/**
 * 指定日の Clarity サマリーを取得
 *
 * Clarity API は「過去N日」で取得する仕様（特定日指定不可）。
 * numOfDays=1 を指定すると「直近24時間」のデータが返る。
 *
 * @param date YYYY-MM-DD 形式（情報メモ用、APIには影響しない）
 */
export async function fetchClaritySummary(date: string): Promise<ClaritySummary> {
  const token = process.env.CLARITY_API_TOKEN;
  if (!token) {
    throw new Error("CLARITY_API_TOKEN が未設定");
  }

  // Clarity API: 直近1日分のサマリーを取得
  const url = "https://www.clarity.ms/export-data/api/v1/project-live-insights?numOfDays=1";

  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Clarity API 失敗: ${res.status} ${text}`);
  }

  const data = (await res.json()) as ClarityRawMetric[];

  // ── パース ──
  const findMetric = (name: string) => data.find((m) => m.metricName === name);
  const getCount = (m: ClarityRawMetric | undefined) => {
    const info = m?.information?.[0];
    return Number(info?.sessionsWithMetricCount ?? info?.sessionsCount ?? 0);
  };

  const totalSessions = getCount(findMetric("Traffic"));
  const distinctUsers = Number(findMetric("Traffic")?.information?.[0]?.sessionsCount ?? 0);

  return {
    startDate: date,
    endDate: date,
    totalSessions,
    totalPageViews: getCount(findMetric("PagesPerSession")) || totalSessions, // 概算
    totalDistinctUsers: distinctUsers || totalSessions,
    rageClicks: getCount(findMetric("RageClick")),
    deadClicks: getCount(findMetric("DeadClick")),
    quickBacks: getCount(findMetric("QuickbackClick")),
    excessiveScroll: getCount(findMetric("ExcessiveScroll")),
    averageScrollDepth: 0, // Clarity API では取得不可
    topPagesByRageClicks: [], // 詳細はダッシュボードで
    topPagesByDeadClicks: [],
  };
}
