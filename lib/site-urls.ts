/**
 * T-MANAGE / Ange Spa サイトURL 一元管理
 *
 * ========== 本番ドメイン体系（2026-04-24 設定完了）==========
 *
 *   ange-spa.com                 公開HP（お客様向け、Next.js app/(site)/*）
 *   ange-spa.t-manage.jp         T-MANAGE 管理画面 + セラピストマイページ
 *   admin.tera-manage.jp         TERA-MANAGE マスター管理画面
 *   resexy.t-manage.jp           （将来）リゼクシー T-MANAGE
 *   {subdomain}.t-manage.jp      各インスタンスのサブドメイン
 *
 * ========== 使い方 ==========
 *
 * このファイルは、コード内で絶対URLを使う場所（LINE/SMS/メールに埋め込むリンク、
 * サイトマップ、robots.txt、拡張機能の対象URL等）の唯一の真実として使用する。
 *
 * import { TMANAGE_URL, customerMypageUrl } from "@/lib/site-urls";
 * const url = customerMypageUrl("田中太郎");
 *
 * ========== 絶対URL vs 相対URL ==========
 *
 * アプリ内リンクは原則 Next.js の Link や window.location.origin を使用。
 * このファイルの絶対URLは「外部（LINE, SMS, メール）に送る時」のみ使用する。
 *
 * @see docs/08_MASTER_SYSTEM_DESIGN.md  命名体系・ドメイン戦略
 */

// ─── 本番ドメイン定数 ──────────────────────────────────────

/** アンジュスパ公開HP（お客様向け、ange-spa.com で配信） */
export const PUBLIC_HP_URL = "https://ange-spa.com";

/** T-MANAGE 管理画面・マイページ（スタッフ・セラピスト・お客様認証後） */
export const TMANAGE_URL = "https://ange-spa.t-manage.jp";

/** TERA-MANAGE マスター管理画面 */
export const TERA_ADMIN_URL = "https://admin.tera-manage.jp";

/** T-MANAGE サブドメインのベース（マルチインスタンス用） */
export const TMANAGE_BASE_DOMAIN = "t-manage.jp";

/** TERA-MANAGE ベースドメイン */
export const TERA_MANAGE_BASE_DOMAIN = "tera-manage.jp";

// ─── 旧URL（参考・移行期間の照合用）───────────────────────

/** 旧Vercelサブドメイン（移行完了までの暫定URL、拡張機能等から外された後に削除予定） */
export const LEGACY_VERCEL_URL = "https://t-manage.vercel.app";

// ─── よく使う絶対URLのヘルパー ─────────────────────────────

/**
 * セラピストマイページのお客様情報URL
 * LINE/SMS で「お客様情報はこちら」リンクに使用
 */
export const customerMypageUrl = (customerName: string): string =>
  `${TMANAGE_URL}/mypage/customer?name=${encodeURIComponent(customerName)}`;

/**
 * セラピストマイページのトップURL
 * 入室/退室確認のリマインダー等で使用
 */
export const therapistMypageUrl = (): string => `${TMANAGE_URL}/mypage`;

/**
 * お客様向け予約確認URL（トークン認証）
 */
export const reservationConfirmUrl = (token: string): string =>
  `${TMANAGE_URL}/reservation-confirm?token=${token}`;

/**
 * メール確認URL（お客様・スタッフ・セラピスト共通）
 */
export const emailConfirmUrl = (token: string, type: "customer" | "staff" = "customer"): string => {
  const path = type === "staff" ? "/confirm-staff-email" : "/confirm-email";
  return `${TMANAGE_URL}${path}?token=${token}`;
};

/**
 * 契約署名 / 書類提出URL（トークン認証、セラピスト・スタッフ向け）
 */
export const contractSignUrl = (token: string): string => `${TMANAGE_URL}/contract-sign/${token}`;
export const licenseUploadUrl = (token: string): string => `${TMANAGE_URL}/license-upload/${token}`;
export const invoiceUploadUrl = (token: string): string => `${TMANAGE_URL}/invoice-upload/${token}`;
export const mynumberUploadUrl = (token: string): string => `${TMANAGE_URL}/mynumber-upload/${token}`;

/**
 * Google OAuth コールバックURL（/contact-sync で使用）
 */
export const googleOauthCallbackUrl = (): string => `${TMANAGE_URL}/api/google-auth/callback`;

/**
 * ブリッジページURL（ブラウザ拡張連携）
 */
export const smsBridgeUrl = (): string => `${TMANAGE_URL}/sms-bridge`;
export const estamaBridgeUrl = (): string => `${TMANAGE_URL}/estama-bridge`;

// ─── メタデータ用 ──────────────────────────────────────────

/**
 * Next.js metadataBase に使う URL（デフォルトは公開HPルート）
 * OGP画像や sitemap.xml の絶対URL解決に使用される。
 *
 * app/(site)/* 配下では PUBLIC_HP_URL をベースに、
 * それ以外（管理画面等）では TMANAGE_URL をベースに metadata を解決する想定。
 * 共通 layout.tsx では PUBLIC_HP_URL を既定とする。
 */
export const METADATA_BASE_URL = PUBLIC_HP_URL;
