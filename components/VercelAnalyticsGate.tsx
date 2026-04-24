"use client";

import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";

/**
 * Vercel Analytics / Speed Insights ラッパー
 *
 * 全ページで有効化する。
 * - 管理画面: スタッフの操作傾向・重い画面を把握
 * - セラピストマイページ: どのタブが使われているか
 * - お客様マイページ: 予約フローの離脱・表示速度
 * - 公式HP・法人サイト: 訪問数・表示速度
 *
 * プライバシー:
 * - Vercel Analytics は IP アドレスを匿名化
 * - Cookie を使わずファーストパーティで動作
 * - 個人情報は収集しない
 */
export function VercelAnalyticsGate() {
  return (
    <>
      <Analytics />
      <SpeedInsights />
    </>
  );
}
