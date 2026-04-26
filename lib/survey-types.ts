/**
 * ═══════════════════════════════════════════════════════════
 * アンケート/レビューシステム 型定義
 *
 * 設計: docs/14_REVIEW_SYSTEM.md (967行)
 * ロードマップ: docs/14b_REVIEW_SYSTEM_ROADMAP.md
 *
 * Phase 1A で導入。Phase 1B 以降のUI/APIで参照する。
 * ═══════════════════════════════════════════════════════════
 */

// ──────────────────────────────────────────────────────────────────────
// アンケート回答 (customer_surveys)
// ──────────────────────────────────────────────────────────────────────

export type RatingChoice = "good" | "normal" | "bad";

/** 印象ポイントの選択肢（複数選択） */
export const SURVEY_HIGHLIGHTS = [
  "技術の高さ",
  "丁寧な施術",
  "清潔感",
  "落ち着いた雰囲気",
  "リラックスできた",
  "アロマの香り",
  "会話が楽しい",
  "プライバシー配慮",
  "店舗の立地",
  "スタッフ対応",
] as const;

export type SurveyHighlight = (typeof SURVEY_HIGHLIGHTS)[number];

/** 回答送信元 */
export type SurveySubmittedFrom = "mypage" | "qr" | "email_link";

/** アンケート回答1件 */
export type CustomerSurvey = {
  id: number;

  // 紐付け
  customer_id: number | null;
  reservation_id: number | null;
  therapist_id: number | null;

  // トークン認証（非登録者用）
  access_token: string | null;

  // 評価
  rating_overall: number | null;          // 1-5
  rating_therapist: RatingChoice | null;
  rating_service: RatingChoice | null;
  rating_atmosphere: RatingChoice | null;
  rating_cleanliness: RatingChoice | null;
  rating_course: RatingChoice | null;

  // 印象ポイント
  highlights: SurveyHighlight[];
  highlights_custom: string | null;

  // 自由記述
  good_points: string | null;
  improvement_points: string | null;
  therapist_message: string | null;

  // AI生成
  ai_generated_text: string | null;
  final_review_text: string | null;
  ai_regenerate_count: number;

  // 投稿状態
  google_posted: boolean;
  google_posted_at: string | null;
  hp_publish_consent: boolean;
  hp_publish_approved_at: string | null;
  hp_publish_approved_by: number | null;
  hp_published: boolean;
  hp_display_name: string | null;

  // 報酬付与状態
  coupon_issued: boolean;
  coupon_id: number | null;
  hp_point_granted: boolean;
  hp_point_granted_amount: number;

  // メタ
  submitted_at: string;
  submitted_from: SurveySubmittedFrom | null;
  ip_hash: string | null;

  created_at: string;
  updated_at: string;
};

// ──────────────────────────────────────────────────────────────────────
// 配信通知 (survey_notifications)
// ──────────────────────────────────────────────────────────────────────

export type NotificationChannel = "mypage_notification" | "email" | "line";
export type NotificationStatus = "pending" | "sent" | "failed" | "skipped";
export type NotificationSkipReason = "opted_out" | "already_responded" | "no_mypage";

export type SurveyNotification = {
  id: number;
  reservation_id: number;
  customer_id: number;

  scheduled_at: string;
  sent_at: string | null;
  channel: NotificationChannel;

  status: NotificationStatus;
  response_survey_id: number | null;

  skip_reason: NotificationSkipReason | null;
  error_message: string | null;

  created_at: string;
};

// ──────────────────────────────────────────────────────────────────────
// アンケートクーポン (survey_coupons)
// ──────────────────────────────────────────────────────────────────────

export type SurveyCoupon = {
  id: number;
  code: string;                   // SV-XXXXXX 形式

  customer_id: number | null;
  survey_id: number;

  discount_amount: number;        // デフォルト 1000
  combinable: boolean;            // 既存割引と併用可

  issued_at: string;
  expires_at: string;             // issued_at + 3ヶ月

  used_at: string | null;
  used_reservation_id: number | null;
  used_store_id: number | null;

  created_at: string;
};

// ──────────────────────────────────────────────────────────────────────
// API リクエスト/レスポンス型
// ──────────────────────────────────────────────────────────────────────

/** アンケート送信API のリクエスト */
export type SurveySubmitRequest = {
  token?: string;                 // 非登録者の場合
  customerId?: number;            // マイページ登録者の場合
  reservationId: number;
  therapistId: number;

  ratingOverall: number;
  ratingTherapist?: RatingChoice;
  ratingService?: RatingChoice;
  ratingAtmosphere?: RatingChoice;
  ratingCleanliness?: RatingChoice;
  ratingCourse?: RatingChoice;

  highlights?: SurveyHighlight[];
  highlightsCustom?: string;

  goodPoints?: string;
  improvementPoints?: string;
  therapistMessage?: string;

  finalReviewText?: string;
  aiGenerated?: boolean;
  hpPublishConsent: boolean;
  submittedFrom: SurveySubmittedFrom;
};

/** アンケート送信API のレスポンス */
export type SurveySubmitResponse = {
  surveyId: number;
  couponCode: string;             // SV-A3F9K2
  couponExpiresAt: string;        // ISO日時
  pointsGranted: number;          // HP掲載同意時のみ非0
  googleReviewUrl: string | null; // 店舗の Place ID 設定時のみ
};

/** AI言語化補助API のリクエスト */
export type AiComposeRequest = {
  ratingOverall: number;
  highlights: SurveyHighlight[];
  goodPoints: string;
  improvementPoints?: string;
  therapistMessage?: string;
  therapistName?: string;
  regenerateCount: number;        // 0-3
};

/** AI言語化補助API のレスポンス */
export type AiComposeResponse = {
  text: string;
  canRegenerate: boolean;         // regenerateCount < 3 の時 true
  remainingRegenerations: number;
};

// ──────────────────────────────────────────────────────────────────────
// クーポンコード生成
// ──────────────────────────────────────────────────────────────────────

/**
 * SV-XXXXXX 形式のクーポンコードを生成。
 * X は英数字（大文字 + 数字、紛らわしい0/O/1/Iは除外）
 *
 * 衝突チェックは呼び出し側で行う想定（DB側 UNIQUE 制約あり）。
 */
export function generateSurveyCouponCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 0/O/1/I 除外
  let code = "SV-";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// ──────────────────────────────────────────────────────────────────────
// HP掲載表示名生成
// ──────────────────────────────────────────────────────────────────────

/** 「30代男性 Aさん」のような表示名を生成 */
export function generateHpDisplayName(ageGroup?: string, suffix?: string): string {
  const age = ageGroup || "";
  const initial = suffix || String.fromCharCode(65 + Math.floor(Math.random() * 26)); // A-Z
  return `${age}男性 ${initial}さん`.trim();
}
