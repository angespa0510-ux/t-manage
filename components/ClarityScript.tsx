"use client";

import Script from "next/script";

/**
 * Microsoft Clarity トラッキングスクリプト
 *
 * 全ページで動作する。プロジェクトIDは環境変数で制御。
 *
 * ========== 環境変数 ==========
 *
 *   NEXT_PUBLIC_CLARITY_PROJECT_ID  Clarity プロジェクトID（10桁前後の英数字）
 *
 * Vercel 環境変数で設定済み。未設定時はスクリプトを読み込まない。
 *
 * ========== マスキング方針 ==========
 *
 * Clarity は既定で「Strict」マスキングモード（全テキスト・画像をマスク）。
 * 個別の要素を露出するには HTML 側で `data-clarity-unmask="true"` を付与。
 *
 * 個人情報（顧客氏名・電話・金額・マイナンバー等）は引き続きマスクされる。
 * UI要素（ボタン・タブ・見出し）のみアンマスクする想定。
 *
 * <PrivateText> コンポーネント（@/components/PrivateText）も併用可能。
 *
 * ========== 開発環境では無効化 ==========
 *
 * NODE_ENV !== "production" では読み込まない。
 * 開発時の操作ログを Clarity に送らないため。
 *
 * ========== プライバシー ==========
 *
 * - Cookie ベース（ファーストパーティCookie）
 * - データ保持期間: 30日（設定で変更可能）
 * - GDPR/CCPA 対応
 * - データは Microsoft の分析基盤で処理
 *
 * @see https://learn.microsoft.com/en-us/clarity/setup-and-installation/
 */

const CLARITY_PROJECT_ID = process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID;

export function ClarityScript() {
  // 開発環境では動作させない
  if (process.env.NODE_ENV !== "production") {
    return null;
  }

  // プロジェクトID未設定時は何もしない
  if (!CLARITY_PROJECT_ID) {
    return null;
  }

  return (
    <Script id="clarity-script" strategy="afterInteractive">
      {`
        (function(c,l,a,r,i,t,y){
            c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
            t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
            y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
        })(window, document, "clarity", "script", "${CLARITY_PROJECT_ID}");
      `}
    </Script>
  );
}
