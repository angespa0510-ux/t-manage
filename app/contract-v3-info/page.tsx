"use client";

import ContractV3InfoSlides from "../../components/ContractV3InfoSlides";

export const dynamic = "force-dynamic";

/**
 * /admin/contract-v3-info (URLは middleware で /contract-v3-info にリライト)
 * 管理者向け 業務委託契約書 v3.0 改訂説明スライド
 *
 * - 共通コンポーネント ContractV3InfoSlides を audience="admin" で表示
 * - スタッフがセラピストからの問い合わせ対応時に内容を確認するため
 * - スライド内容はセラピスト向けと共通だが、9枚目10枚目は管理者文言に切り替わる
 */
export default function AdminContractV3InfoPage() {
  return <ContractV3InfoSlides audience="admin" />;
}
