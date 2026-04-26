/**
 * T-MANAGE / Ange Spa サイトURL 一元管理
 *
 * ========== 本番ドメイン体系（2026-04-26 最終確定）==========
 *
 *   ange-spa.jp                  アンジュスパ屋号 = 1号機テナント
 *                                  ├ /              公開HP（お客様向け）
 *                                  ├ /mypage        お客様マイページ
 *                                  ├ /cast          セラピストマイページ
 *                                  └ /admin/*       スタッフ管理画面（PIN認証）
 *
 *   tera-manage.jp               TERA-MANAGE 法人ブランドサイト
 *   admin.tera-manage.jp         TERA-MANAGE SaaS 全体管理画面
 *   t-manage.jp                  T-MANAGE 製品紹介LP
 *   {tenant}.t-manage.jp         （将来）独自ドメインなしテナント用
 *   resexy.t-manage.jp           （2027/1/1）リゼクシー T-MANAGE
 *
 * ホスト振り分けは middleware.ts が担当する。
 * 公開HP・マイページ・管理画面は全て ange-spa.jp 配下のパスで分離されている。
 *
 * ========== ange-spa.com について ==========
 *
 * 旧HP業者（Panda Web Concierge）が運用中の旧ドメイン。テラスライフに権限なし。
 * 移管不可との回答を受け、2026-04-24 に ange-spa.jp を新規取得し完全移行する方針。
 * 業者契約終了後、旧HPは閉鎖予定。
 *
 * ========== 使い方 ==========
 *
 * このファイルは、コード内で絶対URLを使う場所（LINE/SMS/メールに埋め込むリンク、
 * サイトマップ、robots.txt、拡張機能の対象URL等）の唯一の真実として使用する。
 *
 *   import { TMANAGE_URL, customerMypageUrl } from "@/lib/site-urls";
 *   const url = customerMypageUrl("田中太郎");
 *
 * ========== 絶対URL vs 相対URL ==========
 *
 * アプリ内リンクは原則 Next.js の Link や window.location.origin を使用。
 * このファイルの絶対URLは「外部（LINE, SMS, メール）に送る時」のみ使用する。
 *
 * @see docs/19_URL_STRUCTURE.md  URL構造・ドメイン分離仕様
 */

// ─── 本番ドメイン定数 ──────────────────────────────────────

/** アンジュスパ屋号のメインドメイン（公開HP・マイページ・管理画面すべて） */
export const ANGE_SPA_URL = "https://ange-spa.jp";

/** アンジュスパ公開HP（お客様向け、ange-spa.jp で配信） */
export const PUBLIC_HP_URL = ANGE_SPA_URL;

/** T-MANAGE 管理画面・マイページ（スタッフ・セラピスト・お客様認証後）
 *  ※ 2026-04-26 ドメイン分離以降、ange-spa.jp に統合された。
 *     後方互換のため定数名は維持する。 */
export const TMANAGE_URL = ANGE_SPA_URL;

/** TERA-MANAGE マスター管理画面（運営者専用） */
export const TERA_ADMIN_URL = "https://admin.tera-manage.jp";

/** TERA-MANAGE 法人ブランドサイト */
export const TERA_MANAGE_URL = "https://tera-manage.jp";

/** T-MANAGE 製品紹介LP */
export const TMANAGE_LP_URL = "https://t-manage.jp";

/** T-MANAGE サブドメインのベース（マルチインスタンス用） */
export const TMANAGE_BASE_DOMAIN = "t-manage.jp";

/** TERA-MANAGE ベースドメイン */
export const TERA_MANAGE_BASE_DOMAIN = "tera-manage.jp";

// ─── 旧URL（参考・移行期間の照合用）───────────────────────

/** 旧Vercelサブドメイン（移行完了までの暫定URL、拡張機能等から外された後に削除予定） */
export const LEGACY_VERCEL_URL = "https://t-manage.vercel.app";

/** 旧公開HP（Panda Web Concierge管理、移管不可のため新ドメインへ完全移行） */
export const LEGACY_PUBLIC_HP_URL = "https://ange-spa.com";

// ─── よく使う絶対URLのヘルパー ─────────────────────────────

/**
 * セラピストが顧客を確認するためのページURL（/cast/customer）
 * LINE/SMS で「お客様情報はこちら」リンクに使用
 *
 * 旧URL: ange-spa.t-manage.jp/mypage/customer
 * 新URL: ange-spa.jp/cast/customer
 */
export const customerMypageUrl = (customerName: string): string =>
  `${TMANAGE_URL}/cast/customer?name=${encodeURIComponent(customerName)}`;

/**
 * セラピストマイページのトップURL
 * 入室/退室確認のリマインダー等で使用
 *
 * 旧URL: ange-spa.t-manage.jp/mypage
 * 新URL: ange-spa.jp/cast
 */
export const therapistMypageUrl = (): string => `${TMANAGE_URL}/cast`;

/**
 * お客様マイページのトップURL
 *
 * 新URL: ange-spa.jp/mypage
 */
export const customerMyPageTopUrl = (): string => `${TMANAGE_URL}/mypage`;

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
 * スタッフ管理画面のトップURL
 *
 * 新URL: ange-spa.jp/admin
 */
export const adminTopUrl = (): string => `${TMANAGE_URL}/admin`;

/**
 * Google OAuth コールバックURL（/admin/contact-sync で使用）
 */
export const googleOauthCallbackUrl = (): string => `${TMANAGE_URL}/api/google-auth/callback`;

/**
 * ブリッジページURL（ブラウザ拡張連携）
 * これらは /admin プレフィックスを持たない（middleware の管理エリア判定対象外）
 */
export const smsBridgeUrl = (): string => `${TMANAGE_URL}/sms-bridge`;
export const estamaBridgeUrl = (): string => `${TMANAGE_URL}/estama-bridge`;

// ─── メタデータ用 ──────────────────────────────────────────

/**
 * Next.js metadataBase に使う URL（デフォルトは公開HPルート）
 * OGP画像や sitemap.xml の絶対URL解決に使用される。
 *
 * 公開HP・マイページ・管理画面すべて ange-spa.jp 配下なので、
 * 単一のベースURLで全画面のメタデータを解決できる。
 */
export const METADATA_BASE_URL = ANGE_SPA_URL;
