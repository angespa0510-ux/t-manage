-- ═══════════════════════════════════════════════════════════════
-- session68_bluesky_integration.sql
-- Bluesky自動投稿機能 (Phase 3 Step F)
-- ═══════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────
-- 1. セラピストのBlueskyアカウント情報
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS therapist_bluesky_accounts (
  therapist_id BIGINT PRIMARY KEY REFERENCES therapists(id) ON DELETE CASCADE,

  -- 接続情報
  handle TEXT NOT NULL,                -- 例: yume.bsky.social
  app_password TEXT NOT NULL,          -- Blueskyのアプリパスワード (例: xxxx-xxxx-xxxx-xxxx)
  did TEXT,                             -- 認証成功時に取得 (DID識別子)

  -- 設定
  active BOOLEAN NOT NULL DEFAULT true,
  auto_post_enabled BOOLEAN NOT NULL DEFAULT true,
  include_image BOOLEAN NOT NULL DEFAULT true,  -- カバー画像を添付するか

  -- 頻度制御
  daily_post_limit INTEGER NOT NULL DEFAULT 3,
  post_count_today INTEGER NOT NULL DEFAULT 0,
  last_count_reset_date DATE,
  last_posted_at TIMESTAMPTZ,

  -- メタ
  setup_by TEXT NOT NULL DEFAULT 'self',  -- 'self' | 'staff'
  setup_by_staff_id BIGINT,
  last_test_status TEXT,                  -- 'success' | 'failed'
  last_test_at TIMESTAMPTZ,
  last_error TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bsky_accounts_active
  ON therapist_bluesky_accounts(active, auto_post_enabled)
  WHERE active = true AND auto_post_enabled = true;

ALTER TABLE therapist_bluesky_accounts DISABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────
-- 2. Bluesky投稿ログ
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS diary_bluesky_posts (
  id BIGSERIAL PRIMARY KEY,
  entry_id BIGINT NOT NULL REFERENCES therapist_diary_entries(id) ON DELETE CASCADE,
  therapist_id BIGINT NOT NULL,

  -- 投稿結果
  status TEXT NOT NULL DEFAULT 'pending',  -- pending | posted | failed | skipped
  bluesky_post_uri TEXT,                    -- at://did:plc:xxxxx/app.bsky.feed.post/xxxxx
  bluesky_post_url TEXT,                    -- ブラウザ表示用 URL
  bluesky_post_cid TEXT,                    -- コンテンツID

  -- 投稿内容スナップショット
  posted_text TEXT,
  posted_image_url TEXT,                    -- 添付した画像URL
  daily_post_index INTEGER,                 -- その日の何投稿目か

  -- エラー
  error_message TEXT,
  error_code TEXT,                          -- rate_limit | auth_error | network | etc

  -- スキップ理由
  skip_reason TEXT,                         -- daily_limit | account_inactive | not_public | manual

  -- タイミング
  posted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(entry_id)  -- 1記事につき1投稿まで
);

CREATE INDEX IF NOT EXISTS idx_bsky_posts_entry
  ON diary_bluesky_posts(entry_id);
CREATE INDEX IF NOT EXISTS idx_bsky_posts_therapist
  ON diary_bluesky_posts(therapist_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bsky_posts_status
  ON diary_bluesky_posts(status, created_at DESC)
  WHERE status IN ('pending', 'failed');

ALTER TABLE diary_bluesky_posts DISABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────
-- 3. updated_at 自動更新トリガー
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_bluesky_accounts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_bluesky_accounts_updated_at ON therapist_bluesky_accounts;
CREATE TRIGGER trg_bluesky_accounts_updated_at
  BEFORE UPDATE ON therapist_bluesky_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_bluesky_accounts_updated_at();
