-- ═══════════════════════════════════════════════════════════════
-- session70_live_streaming.sql
-- ライブストリーミング機能 (Phase 3 Step J)
-- ═══════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────
-- 1. セラピストにライブ配信許可フラグ追加
-- ─────────────────────────────────────────────────────────────
ALTER TABLE therapists
  ADD COLUMN IF NOT EXISTS live_streaming_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS live_streaming_enabled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS live_streaming_enabled_by_staff_id BIGINT;

CREATE INDEX IF NOT EXISTS idx_therapists_live_enabled
  ON therapists(live_streaming_enabled)
  WHERE live_streaming_enabled = true;

-- ─────────────────────────────────────────────────────────────
-- 2. ライブ配信ルームテーブル
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS live_streams (
  id BIGSERIAL PRIMARY KEY,
  therapist_id BIGINT NOT NULL REFERENCES therapists(id) ON DELETE CASCADE,

  -- ルーム識別子
  room_name TEXT NOT NULL UNIQUE,           -- LiveKit のルーム名 (例: 'live_t123_1234567890')

  -- 配信内容
  title TEXT NOT NULL DEFAULT '',
  description TEXT DEFAULT '',
  thumbnail_url TEXT,                        -- 配信開始時のスナップショット

  -- 状態
  status TEXT NOT NULL DEFAULT 'preparing',  -- preparing | live | ended | error
  visibility TEXT NOT NULL DEFAULT 'members_only',  -- public | members_only

  -- フィルター情報 (記録用、再開時の復元用)
  filter_mode TEXT DEFAULT 'none',           -- none | beauty | stamp | mosaic
  filter_options JSONB DEFAULT '{}',         -- {stamp: 'sakura', mosaicTarget: 'face' など}

  -- 統計
  viewer_count_current INTEGER NOT NULL DEFAULT 0,
  viewer_count_peak INTEGER NOT NULL DEFAULT 0,
  viewer_count_total INTEGER NOT NULL DEFAULT 0,
  heart_count_total INTEGER NOT NULL DEFAULT 0,
  comment_count_total INTEGER NOT NULL DEFAULT 0,

  -- タイミング
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  duration_sec INTEGER,                       -- ended時に計算

  -- 終了理由
  end_reason TEXT,                            -- self_end | timeout | error | staff_force

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_live_streams_status
  ON live_streams(status, started_at DESC)
  WHERE status = 'live';
CREATE INDEX IF NOT EXISTS idx_live_streams_therapist
  ON live_streams(therapist_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_live_streams_room
  ON live_streams(room_name);

ALTER TABLE live_streams DISABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────
-- 3. ライブ視聴ログ
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS live_stream_views (
  id BIGSERIAL PRIMARY KEY,
  stream_id BIGINT NOT NULL REFERENCES live_streams(id) ON DELETE CASCADE,
  customer_id BIGINT,                        -- 非会員はNULL
  ip_hash TEXT,                              -- 非会員の重複防止用
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  left_at TIMESTAMPTZ,
  watched_sec INTEGER                        -- left時に計算
);

CREATE INDEX IF NOT EXISTS idx_live_views_stream
  ON live_stream_views(stream_id, joined_at DESC);
CREATE INDEX IF NOT EXISTS idx_live_views_customer
  ON live_stream_views(customer_id, joined_at DESC)
  WHERE customer_id IS NOT NULL;

ALTER TABLE live_stream_views DISABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────
-- 4. ライブハート (連打可、集計用)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS live_stream_hearts (
  id BIGSERIAL PRIMARY KEY,
  stream_id BIGINT NOT NULL REFERENCES live_streams(id) ON DELETE CASCADE,
  customer_id BIGINT,                        -- 非会員はNULL
  count INTEGER NOT NULL DEFAULT 1,          -- 1回のリクエストで複数送信可
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_live_hearts_stream
  ON live_stream_hearts(stream_id, created_at DESC);

ALTER TABLE live_stream_hearts DISABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────
-- 5. ライブコメント
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS live_stream_comments (
  id BIGSERIAL PRIMARY KEY,
  stream_id BIGINT NOT NULL REFERENCES live_streams(id) ON DELETE CASCADE,
  customer_id BIGINT,                        -- 非会員NULL (会員のみコメント可なら強制非NULL)
  display_name TEXT NOT NULL,                -- 表示名 (self_name 優先 → name頭文字)
  body TEXT NOT NULL,
  is_hidden BOOLEAN NOT NULL DEFAULT false,  -- スタッフ/セラピストが非表示化
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_live_comments_stream
  ON live_stream_comments(stream_id, created_at DESC)
  WHERE is_hidden = false;

ALTER TABLE live_stream_comments DISABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────
-- 6. updated_at 自動更新トリガー
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_live_streams_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_live_streams_updated_at ON live_streams;
CREATE TRIGGER trg_live_streams_updated_at
  BEFORE UPDATE ON live_streams
  FOR EACH ROW
  EXECUTE FUNCTION update_live_streams_updated_at();
