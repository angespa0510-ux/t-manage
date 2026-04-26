"use client";

import { GoogleAnalytics as NextGoogleAnalytics } from "@next/third-parties/google";

/**
 * Google Analytics 4 トラッキングスクリプト
 *
 * 全ページで動作する。測定IDは環境変数で制御。
 * @next/third-parties/google を使用して Next.js 公式推奨の方法で実装。
 *
 * ========== 環境変数 ==========
 *
 *   NEXT_PUBLIC_GA_MEASUREMENT_ID  GA4 測定ID（G-XXXXXXXXXX 形式）
 *
 * Vercel 環境変数で設定済み。未設定時はスクリプトを読み込まない。
 *
 * ========== 開発環境では無効化 ==========
 *
 * NODE_ENV !== "production" では読み込まない。
 * 開発時の操作ログが GA に送られないため、本番データが汚染されない。
 *
 * ========== 計測内容 ==========
 *
 * - ページビュー（自動）
 * - スクロール深度（拡張計測機能ON時、自動）
 * - 離脱クリック（拡張計測機能ON時、自動）
 * - 動画エンゲージメント（拡張計測機能ON時、自動）
 * - ファイルダウンロード（拡張計測機能ON時、自動）
 *
 * 個人情報を含むパラメータは送信していない。
 * メールアドレス・電話番号など PII は GA4 のデータ削除設定で自動的に除外される。
 *
 * ========== Cookie について ==========
 *
 * GA4 は _ga / _gid などのCookieを発行する（GDPR/CCPA対応のため要件あり）。
 * プライバシーポリシー第10条に明記済み。
 *
 * @see https://nextjs.org/docs/app/guides/third-party-libraries#google-analytics
 */

const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

export function GoogleAnalytics() {
  // 開発環境では動作させない
  if (process.env.NODE_ENV !== "production") {
    return null;
  }

  // 測定ID未設定時は何もしない
  if (!GA_MEASUREMENT_ID) {
    return null;
  }

  return <NextGoogleAnalytics gaId={GA_MEASUREMENT_ID} />;
}
