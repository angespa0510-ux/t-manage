-- ==========================================================================
-- session82_review_system_tables.sql
--
-- アンケート/レビューシステム DB基盤構築（Phase 1A）
--
-- 設計: docs/14_REVIEW_SYSTEM.md (967行)
-- ロードマップ: docs/14b_REVIEW_SYSTEM_ROADMAP.md
--
-- 【設計原則】
-- 1. AIは「書かない」、「言語化を助ける」だけ
-- 2. Googleポリシー完全遵守（投稿に対する報酬は一切なし）
-- 3. お客様の身バレリスクへの最大限の配慮
--
-- 【報酬設計】
-- - アンケート回答 → 全員に1,000円OFFクーポン（SV-XXXXXX 形式）
-- - HP掲載同意   → 500pt（マイページ登録者のみ、社内承認後）
-- - Google投稿   → 0pt（絶対に付与しない、ポリシー違反のため）
--
-- 【影響】
-- - 新規テーブル: customer_surveys, survey_notifications, survey_coupons
-- - 既存拡張: customers, point_settings, therapists, stores, reservations
-- ==========================================================================


-- ==========================================================================
-- STEP 1: 新規テーブル作成
-- ==========================================================================

-- ──────────────────────────────────────────────────────────────────────
-- 1-1. customer_surveys (アンケート回答)
-- ──────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS customer_surveys (
  id bigserial PRIMARY KEY,

  -- 紐付け
  customer_id bigint REFERENCES customers(id) ON DELETE SET NULL,
  reservation_id bigint REFERENCES reservations(id) ON DELETE SET NULL,
  therapist_id bigint REFERENCES therapists(id) ON DELETE SET NULL,

  -- トークン認証（非登録者用）
  access_token text UNIQUE,

  -- 評価
  rating_overall int CHECK (rating_overall >= 1 AND rating_overall <= 5),
  rating_therapist text,           -- 'good' | 'normal' | 'bad'
  rating_service text,
  rating_atmosphere text,
  rating_cleanliness text,
  rating_course text,

  -- 印象ポイント（複数選択）
  highlights jsonb DEFAULT '[]'::jsonb,   -- ["技術の高さ", "清潔感", ...]
  highlights_custom text,                  -- その他自由記述

  -- 自由記述
  good_points text,
  improvement_points text,
  therapist_message text,

  -- AI 生成文章
  ai_generated_text text,          -- AI が生成した文章
  final_review_text text,          -- お客様が最終的に確定した文章
  ai_regenerate_count int DEFAULT 0, -- AI再生成回数（上限3）

  -- 投稿状態
  google_posted boolean DEFAULT false,      -- Google投稿したか（自己申告）
  google_posted_at timestamptz,
  hp_publish_consent boolean DEFAULT false, -- HP掲載同意したか
  hp_publish_approved_at timestamptz,        -- 社内承認日時
  hp_publish_approved_by bigint,             -- 承認者 staff_id
  hp_published boolean DEFAULT false,        -- 実際にHP掲載中か
  hp_display_name text,                      -- HP掲載時の表示名（「30代男性 Aさん」等）

  -- 報酬付与状態
  coupon_issued boolean DEFAULT false,       -- アンケートクーポン発行済み
  coupon_id bigint,                          -- survey_coupons.id への参照（後で外部キー追加）
  hp_point_granted boolean DEFAULT false,    -- HP掲載ポイント付与済み
  hp_point_granted_amount int DEFAULT 0,

  -- メタ
  submitted_at timestamptz DEFAULT now(),
  submitted_from text,              -- 'mypage' | 'qr' | 'email_link'
  ip_hash text,                     -- 重複回答防止（ハッシュ化）

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  -- 制約
  UNIQUE(reservation_id)            -- 1予約1アンケート
);

CREATE INDEX IF NOT EXISTS idx_surveys_customer ON customer_surveys(customer_id);
CREATE INDEX IF NOT EXISTS idx_surveys_therapist ON customer_surveys(therapist_id);
CREATE INDEX IF NOT EXISTS idx_surveys_reservation ON customer_surveys(reservation_id);
CREATE INDEX IF NOT EXISTS idx_surveys_rating ON customer_surveys(rating_overall);
CREATE INDEX IF NOT EXISTS idx_surveys_submitted ON customer_surveys(submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_surveys_hp_published ON customer_surveys(hp_published) WHERE hp_published = true;
CREATE INDEX IF NOT EXISTS idx_surveys_token ON customer_surveys(access_token);

ALTER TABLE customer_surveys DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on customer_surveys" ON customer_surveys;
CREATE POLICY "Allow all on customer_surveys" ON customer_surveys
  FOR ALL USING (true) WITH CHECK (true);


-- ──────────────────────────────────────────────────────────────────────
-- 1-2. survey_notifications (配信管理)
-- ──────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS survey_notifications (
  id bigserial PRIMARY KEY,
  reservation_id bigint REFERENCES reservations(id) ON DELETE CASCADE,
  customer_id bigint REFERENCES customers(id) ON DELETE CASCADE,

  -- 配信スケジュール
  scheduled_at timestamptz NOT NULL,       -- 配信予定時刻
  sent_at timestamptz,                     -- 実際の送信時刻
  channel text NOT NULL,                   -- 'mypage_notification' | 'email' | 'line'

  -- 状態
  status text DEFAULT 'pending',           -- 'pending' | 'sent' | 'failed' | 'skipped'
  response_survey_id bigint REFERENCES customer_surveys(id),  -- 回答された場合紐付け

  -- ステータス理由
  skip_reason text,                        -- 'opted_out' | 'already_responded' | 'no_mypage'
  error_message text,

  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_survey_notify_scheduled ON survey_notifications(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_survey_notify_status ON survey_notifications(status);
CREATE INDEX IF NOT EXISTS idx_survey_notify_reservation ON survey_notifications(reservation_id);

ALTER TABLE survey_notifications DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on survey_notifications" ON survey_notifications;
CREATE POLICY "Allow all on survey_notifications" ON survey_notifications
  FOR ALL USING (true) WITH CHECK (true);


-- ──────────────────────────────────────────────────────────────────────
-- 1-3. survey_coupons (アンケート完了クーポン)
-- ──────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS survey_coupons (
  id bigserial PRIMARY KEY,
  code text UNIQUE NOT NULL,                -- SV-XXXXXX 形式

  -- 紐付け
  customer_id bigint REFERENCES customers(id) ON DELETE CASCADE,
  survey_id bigint REFERENCES customer_surveys(id) ON DELETE CASCADE,

  -- 値引き内容
  discount_amount int NOT NULL DEFAULT 1000,
  combinable boolean DEFAULT true,           -- 他の割引と併用可

  -- 有効期限
  issued_at timestamptz DEFAULT now(),
  expires_at timestamptz NOT NULL,           -- issued_at + 3ヶ月

  -- 使用状態
  used_at timestamptz,
  used_reservation_id bigint REFERENCES reservations(id),
  used_store_id bigint REFERENCES stores(id),

  created_at timestamptz DEFAULT now(),
  UNIQUE(survey_id)                          -- 1アンケート1クーポン
);

CREATE INDEX IF NOT EXISTS idx_survey_coupons_customer ON survey_coupons(customer_id);
CREATE INDEX IF NOT EXISTS idx_survey_coupons_code ON survey_coupons(code);
CREATE INDEX IF NOT EXISTS idx_survey_coupons_unused ON survey_coupons(customer_id, used_at) WHERE used_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_survey_coupons_expires ON survey_coupons(expires_at);

ALTER TABLE survey_coupons DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on survey_coupons" ON survey_coupons;
CREATE POLICY "Allow all on survey_coupons" ON survey_coupons
  FOR ALL USING (true) WITH CHECK (true);


-- ==========================================================================
-- STEP 2: customer_surveys.coupon_id の外部キー追加
-- (循環参照のため、survey_coupons 作成後に追加)
-- ==========================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_surveys_coupon_id'
  ) THEN
    ALTER TABLE customer_surveys
      ADD CONSTRAINT fk_surveys_coupon_id
      FOREIGN KEY (coupon_id) REFERENCES survey_coupons(id) ON DELETE SET NULL;
  END IF;
END $$;


-- ==========================================================================
-- STEP 3: 既存テーブル拡張
-- ==========================================================================

-- 3-1. customers (アンケート配信オプトアウト)
ALTER TABLE customers ADD COLUMN IF NOT EXISTS survey_opt_out boolean DEFAULT false;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS survey_response_count int DEFAULT 0;

-- 3-2. point_settings (報酬金額設定)
ALTER TABLE point_settings ADD COLUMN IF NOT EXISTS survey_coupon_amount int DEFAULT 1000;
ALTER TABLE point_settings ADD COLUMN IF NOT EXISTS survey_coupon_valid_months int DEFAULT 3;
ALTER TABLE point_settings ADD COLUMN IF NOT EXISTS hp_publish_bonus int DEFAULT 500;

-- 3-3. therapists (満足度キャッシュ)
ALTER TABLE therapists ADD COLUMN IF NOT EXISTS avg_rating numeric(3,2);
ALTER TABLE therapists ADD COLUMN IF NOT EXISTS survey_count int DEFAULT 0;
ALTER TABLE therapists ADD COLUMN IF NOT EXISTS nps_score numeric(5,2);

-- 3-4. stores (Google Place ID)
ALTER TABLE stores ADD COLUMN IF NOT EXISTS google_place_id text;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS google_review_url text;

-- 3-5. reservations (アンケートクーポン使用記録)
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS survey_coupon_id bigint REFERENCES survey_coupons(id);
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS survey_coupon_discount int DEFAULT 0;


-- ==========================================================================
-- STEP 4: 確認
-- ==========================================================================

-- 4-1. 新規テーブルが作成されたか確認
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('customer_surveys', 'survey_notifications', 'survey_coupons')
ORDER BY table_name;

-- 4-2. RLS が無効化されていることを確認
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename IN ('customer_surveys', 'survey_notifications', 'survey_coupons')
ORDER BY tablename;

-- 4-3. 既存テーブルの新カラムが追加されたか確認
SELECT table_name, column_name, data_type, column_default
FROM information_schema.columns
WHERE (table_name = 'customers' AND column_name IN ('survey_opt_out', 'survey_response_count'))
   OR (table_name = 'point_settings' AND column_name IN ('survey_coupon_amount', 'survey_coupon_valid_months', 'hp_publish_bonus'))
   OR (table_name = 'therapists' AND column_name IN ('avg_rating', 'survey_count', 'nps_score'))
   OR (table_name = 'stores' AND column_name IN ('google_place_id', 'google_review_url'))
   OR (table_name = 'reservations' AND column_name IN ('survey_coupon_id', 'survey_coupon_discount'))
ORDER BY table_name, column_name;
