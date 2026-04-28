"use client";

import ContractV3InfoSlides from "../../../components/ContractV3InfoSlides";

export const dynamic = "force-dynamic";

/**
 * /cast/contract-v3-info
 * セラピスト向け 業務委託契約書 v3.0 改訂説明スライド
 *
 * - 共通コンポーネント ContractV3InfoSlides を audience="cast" で表示
 * - HP世界観のマーブルピンクUIで、丁寧・ビジネスライクなトーン
 * - スライド10枚構成 (表紙〜お問い合わせ)
 */
export default function CastContractV3InfoPage() {
  return <ContractV3InfoSlides audience="cast" />;
}
