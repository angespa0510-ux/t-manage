/**
 * Clarity マスキング用ヘルパーコンポーネント
 *
 * Microsoft Clarity でセッション録画する際の表示制御。
 *
 * ========== 使い分け ==========
 *
 * <PrivateText>      個人情報・金額など、Clarity録画で隠したい部分
 * <PublicText>       UI要素・操作ラベルなど、Clarity録画で表示OK
 * <PrivateBlock>     画像・カード全体を隠したい時のラッパー（block要素）
 *
 * ========== 使用例 ==========
 *
 *   // 顧客名を隠す
 *   <td><PrivateText>{customer.name}</PrivateText></td>
 *
 *   // 金額を隠す
 *   <span>合計: <PrivateText>¥{total.toLocaleString()}</PrivateText></span>
 *
 *   // ボタンラベルは見せる（明示的に）
 *   <button>
 *     <PublicText>精算確定</PublicText>
 *   </button>
 *
 *   // セラピストプロフィール画像エリアを隠す
 *   <PrivateBlock>
 *     <img src={therapist.photo} alt={therapist.name} />
 *     <p>{therapist.name}</p>
 *   </PrivateBlock>
 *
 * ========== Clarity の動作仕様 ==========
 *
 * - data-clarity-mask="true"   : この要素のテキスト・画像をマスク
 * - data-clarity-unmask="true" : この要素のテキスト・画像を露出
 * - data-clarity-region="X"    : 領域名を付ける（分析時にフィルタ可能）
 *
 * 親で mask 指定された場合、子で unmask しても露出されないことに注意。
 * デフォルトは Clarity ダッシュボードの Settings > Mask で制御。
 *
 * @see https://learn.microsoft.com/en-us/clarity/setup-and-installation/cookie-consent
 */

import type { ReactNode, CSSProperties } from "react";

type Props = {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** 領域名（分析時のフィルタ用、任意） */
  region?: string;
};

/**
 * Clarity録画でマスクする(個人情報・金額など)
 * inline 要素として動作するため、テーブルセルや span 内で使用可能
 */
export function PrivateText({ children, className, style, region }: Props) {
  return (
    <span
      className={className}
      style={style}
      data-clarity-mask="true"
      data-clarity-region={region}
    >
      {children}
    </span>
  );
}

/**
 * Clarity録画で露出する(UI要素・操作ラベルなど)
 * 主にボタン・タブ・見出しに使用
 */
export function PublicText({ children, className, style, region }: Props) {
  return (
    <span
      className={className}
      style={style}
      data-clarity-unmask="true"
      data-clarity-region={region}
    >
      {children}
    </span>
  );
}

/**
 * Clarity録画でマスクする (block 要素・カード全体)
 * 画像・カード・複数要素のラッパーとして使用
 */
export function PrivateBlock({ children, className, style, region }: Props) {
  return (
    <div
      className={className}
      style={style}
      data-clarity-mask="true"
      data-clarity-region={region}
    >
      {children}
    </div>
  );
}

/**
 * Clarity録画で露出する (block 要素)
 */
export function PublicBlock({ children, className, style, region }: Props) {
  return (
    <div
      className={className}
      style={style}
      data-clarity-unmask="true"
      data-clarity-region={region}
    >
      {children}
    </div>
  );
}
