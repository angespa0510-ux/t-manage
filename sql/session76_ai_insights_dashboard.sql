-- ═══════════════════════════════════════════════════════════════════════
-- Session 76: AI Insights ダッシュボード基盤
--
-- 目的:
-- - GA4 / Clarity / T-MANAGE DB を統合した分析画面（/admin/insights）
-- - Mode A（手動）+ Mode B（API自動）のデュアル設計
-- - Vercel Cron + Claude API で毎朝AI分析レポート生成
--
-- 作成テーブル:
-- 1. ai_daily_reviews ─ 毎朝のAI分析結果保存
-- 2. insights_settings ─ 分析モード切替・通知設定
-- 3. insights_data_cache ─ GA4 / Clarity API レスポンスのキャッシュ（コスト削減）
-- ═══════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────
-- 1. ai_daily_reviews
-- 毎朝 8:00 に Vercel Cron で生成される、Claude による分析レポート。
-- ───────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_daily_reviews (
  id           BIGSERIAL PRIMARY KEY,
  review_date  DATE NOT NULL UNIQUE,           -- 分析対象日（昨日の日付）
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- 入力データ（Claude に渡したもの、再分析用）
  ga4_data        JSONB,    -- GA4 から取得した生データ
  clarity_data    JSONB,    -- Clarity から取得した生データ
  tmanage_data    JSONB,    -- T-MANAGE DB から取得した実績

  -- AI 分析結果
  summary         TEXT,                        -- 短い概要（朝見て15秒で読める）
  full_report     TEXT,                        -- 完全レポート（Markdown）
  good_news       JSONB,                       -- 良いニュースの配列 [{title, detail}]
  warnings        JSONB,                       -- 要対応の配列 [{title, detail, severity}]
  opportunities   JSONB,                       -- 機会発見の配列 [{title, detail}]

  -- 分析メタ情報
  ai_model        TEXT,                        -- 使用したClaudeモデル名
  input_tokens    INTEGER,
  output_tokens   INTEGER,
  cost_usd        NUMERIC(10, 6),              -- このレポートの実コスト

  -- 通知ステータス
  email_sent      BOOLEAN DEFAULT FALSE,       -- Gmail通知送信済みか
  email_sent_at   TIMESTAMPTZ,

  -- レビュー（社長が読んだか）
  read_at         TIMESTAMPTZ,
  read_by         TEXT,                        -- staff name（読んだスタッフ）

  -- 追加メモ・タグ
  notes           TEXT,
  tags            TEXT[],

  CONSTRAINT ai_daily_reviews_date_check CHECK (review_date <= CURRENT_DATE)
);

CREATE INDEX IF NOT EXISTS idx_ai_daily_reviews_date ON ai_daily_reviews(review_date DESC);
CREATE INDEX IF NOT EXISTS idx_ai_daily_reviews_unread ON ai_daily_reviews(read_at) WHERE read_at IS NULL;

ALTER TABLE ai_daily_reviews DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ai_daily_reviews_all ON ai_daily_reviews;
CREATE POLICY ai_daily_reviews_all ON ai_daily_reviews FOR ALL USING (true) WITH CHECK (true);

COMMENT ON TABLE ai_daily_reviews IS '毎朝のAI分析レポート。Vercel Cron + Claude APIで自動生成（Mode B時）。';

-- ───────────────────────────────────────────────────────────────────────
-- 2. insights_settings
-- 分析モード（手動/自動）の切替、通知先メール、Cron時刻などの設定。
-- ───────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS insights_settings (
  id                       INTEGER PRIMARY KEY DEFAULT 1,         -- 単一行（id=1固定）

  -- モード設定
  mode_a_enabled           BOOLEAN DEFAULT TRUE,                   -- Mode A（手動コピー）
  mode_b_enabled           BOOLEAN DEFAULT FALSE,                  -- Mode B（API自動）

  -- Mode B（自動）の設定
  cron_hour                INTEGER DEFAULT 8 CHECK (cron_hour BETWEEN 0 AND 23),  -- 何時にレポート生成
  ai_model                 TEXT DEFAULT 'claude-sonnet-4-6',      -- 使用するClaudeモデル
  use_batch_api            BOOLEAN DEFAULT TRUE,                   -- Batch APIで50%オフ

  -- 通知設定
  email_notifications      BOOLEAN DEFAULT TRUE,                   -- Gmail通知ON/OFF
  notification_emails      TEXT[],                                 -- 通知先メールアドレス
  notify_only_on_warnings  BOOLEAN DEFAULT FALSE,                  -- 警告がある日だけ通知

  -- データソース
  use_ga4                  BOOLEAN DEFAULT TRUE,
  use_clarity              BOOLEAN DEFAULT TRUE,
  use_tmanage_db           BOOLEAN DEFAULT TRUE,

  -- 月間予算（コスト保護）
  monthly_budget_usd       NUMERIC(10, 2) DEFAULT 5.00,            -- 月$5まで（約750円）
  monthly_spent_usd        NUMERIC(10, 6) DEFAULT 0.00,            -- 当月の使用額
  budget_reset_at          DATE DEFAULT CURRENT_DATE,              -- 月初リセット日

  updated_at               TIMESTAMPTZ DEFAULT NOW(),
  updated_by               TEXT,

  CONSTRAINT insights_settings_singleton CHECK (id = 1)
);

-- 初期レコードを必ず1行用意
INSERT INTO insights_settings (id, mode_a_enabled, mode_b_enabled)
VALUES (1, TRUE, FALSE)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE insights_settings DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS insights_settings_all ON insights_settings;
CREATE POLICY insights_settings_all ON insights_settings FOR ALL USING (true) WITH CHECK (true);

COMMENT ON TABLE insights_settings IS '/admin/insights の分析モード・通知設定。単一行（id=1固定）。';

-- ───────────────────────────────────────────────────────────────────────
-- 3. insights_data_cache
-- GA4 / Clarity APIのレスポンスをキャッシュ（同日の重複呼び出し回避）。
-- ───────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS insights_data_cache (
  id            BIGSERIAL PRIMARY KEY,
  source        TEXT NOT NULL CHECK (source IN ('ga4', 'clarity', 'tmanage')),
  target_date   DATE NOT NULL,                 -- どの日のデータか
  fetched_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  data          JSONB NOT NULL,
  expires_at    TIMESTAMPTZ NOT NULL,          -- このキャッシュの有効期限

  UNIQUE(source, target_date)
);

CREATE INDEX IF NOT EXISTS idx_insights_cache_lookup ON insights_data_cache(source, target_date);
CREATE INDEX IF NOT EXISTS idx_insights_cache_expires ON insights_data_cache(expires_at);

ALTER TABLE insights_data_cache DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS insights_data_cache_all ON insights_data_cache;
CREATE POLICY insights_data_cache_all ON insights_data_cache FOR ALL USING (true) WITH CHECK (true);

COMMENT ON TABLE insights_data_cache IS 'GA4/Clarity APIレスポンスのキャッシュ。同日の再呼び出しを防いでコスト削減。';

-- ═══════════════════════════════════════════════════════════════════════
-- 動作確認
-- ═══════════════════════════════════════════════════════════════════════

-- 設定が1行入っているはず
SELECT * FROM insights_settings;

-- RLS無効を確認
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename IN ('ai_daily_reviews', 'insights_settings', 'insights_data_cache');
