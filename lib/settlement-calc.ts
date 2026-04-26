/**
 * therapist_daily_settlements の派生計算ヘルパー (SSOT)
 *
 * 業務委託報酬・精算金額の計算ロジックを単一の真実の源として集約する。
 * 税務系画面 (tax-dashboard / tax-portal / cast 個人ページ / TaxBookkeeping) や
 * 締め報告・集計の派生計算は、本ファイルの関数を経由すること。
 *
 * 直書きの計算式（特に `total_back + adjustment + gift_bonus_amount`）が
 * 各ファイルに散在していたため、変更時の同期漏れを防ぐ目的でここに集約する。
 *
 * 健康診断レポート 2026-04-26: 「重要度: 高 - gift_bonus_amount の扱い不統一」対応
 */

export type SettlementForCalc = {
  total_back?: number | null;
  adjustment?: number | null;
  gift_bonus_amount?: number | null;
  invoice_deduction?: number | null;
  withholding_tax?: number | null;
  welfare_fee?: number | null;
  transport_fee?: number | null;
  final_payment?: number | null;
};

/**
 * 業務委託報酬総額 (gross compensation)
 *   = バック合計 + 調整金 + 情報配信報酬 (gift_bonus_amount, 投げ銭換金分)
 *
 * 税務上の「事業収入 / 売上高 / 業務委託報酬総額」として用いる正式な計算。
 * 源泉徴収・インボイス控除の計算基礎にもなる。
 *
 * NOTE: gift_bonus_amount は精算時に backTotal に加算され、
 *       源泉・インボイス控除が計算された上で final_payment に反映済み。
 *       税務申告上は通常の業務委託報酬と一体として扱う。
 *
 * 参照: app/timechart/page.tsx の精算モーダル backTotal 計算
 *       (= totalBack + salaryBonus + totalNom + totalOptBack + totalExtBack + giftBack + adj
 *        ただし DB 保存時は salary/nom/opt/ext を total_back に集約、
 *        giftBack は gift_bonus_amount、adj は adjustment として別カラム)
 */
export function calcGrossRevenue(stl: SettlementForCalc): number {
  return (stl.total_back || 0)
    + (stl.adjustment || 0)
    + (stl.gift_bonus_amount || 0);
}

/**
 * 100円切上による精算端数 (実支給額 − 計算上の支給額)
 *   通常 0〜99 円の正の整数。セラピストが受け取る "切上ボーナス"。
 *
 * = final_payment − (gross − invoice_deduction − withholding_tax − welfare_fee + transport_fee)
 *
 * 締め報告での「端数集計」用途。負値 / 大きな正値が出た場合は
 * 計算式の不整合を疑う指標になる (本来は 0〜99 の範囲のみ)。
 */
export function calcSettlementRounding(stl: SettlementForCalc): number {
  const raw = calcGrossRevenue(stl)
    - (stl.invoice_deduction || 0)
    - (stl.withholding_tax || 0)
    - (stl.welfare_fee || 0)
    + (stl.transport_fee || 0);
  return (stl.final_payment || 0) - raw;
}
