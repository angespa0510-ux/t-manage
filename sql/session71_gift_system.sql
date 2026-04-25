-- ═══════════════════════════════════════════════════════════════
-- session71_gift_system.sql
-- ポイント投げ銭機能 (Phase 4 Step K)
-- ═══════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────
-- 1. 投げ銭トランザクション (送信ログ)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gift_transactions (
  id BIGSERIAL PRIMARY KEY,

  -- 送信者
  customer_id BIGINT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,

  -- 受領者
  therapist_id BIGINT NOT NULL REFERENCES therapists(id) ON DELETE CASCADE,

  -- 対象コンテンツ
  source_type TEXT NOT NULL,                -- 'live' | 'diary' | 'story'
  source_id BIGINT,                          -- 該当ID (live_streams.id / therapist_diary_entries.id / therapist_diary_stories.id)

  -- ギフト情報
  gift_kind TEXT NOT NULL,                   -- 'sakura' | 'dango' | 'cake' | 'taiyaki' | 'flower' | 'ribbon' | 'crown' | 'diamond'
  gift_label TEXT,                            -- 表示用 ('🌸 桜' など、スナップショット)
  gift_emoji TEXT,                            -- 絵文字 ('🌸' など)
  point_amount INTEGER NOT NULL,             -- 投入ポイント数

  -- メッセージ (任意、20文字以内推奨)
  message TEXT,

  -- 表示制御
  is_visible BOOLEAN NOT NULL DEFAULT true,  -- スパム時の非表示化用

  -- リンクされた customer_points レコード
  customer_point_id BIGINT,                   -- customer_points.id (投げ銭利用記録)

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gift_tx_customer
  ON gift_transactions(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gift_tx_therapist
  ON gift_transactions(therapist_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gift_tx_source
  ON gift_transactions(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_gift_tx_visible
  ON gift_transactions(is_visible, created_at DESC)
  WHERE is_visible = true;

ALTER TABLE gift_transactions DISABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────
-- 2. セラピスト投げ銭ポイント残高 (集計用)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS therapist_gift_points (
  therapist_id BIGINT PRIMARY KEY REFERENCES therapists(id) ON DELETE CASCADE,

  -- 累計
  total_received_points BIGINT NOT NULL DEFAULT 0,    -- 全期間の累計受領
  total_received_count INTEGER NOT NULL DEFAULT 0,    -- 受領回数

  -- 現在の残高 (将来換金時に減算予定)
  current_balance_points BIGINT NOT NULL DEFAULT 0,

  -- 期間別集計 (再計算なし、insert時に+=)
  this_month_received BIGINT NOT NULL DEFAULT 0,
  this_month_year INTEGER,                             -- 集計対象年
  this_month_month INTEGER,                            -- 集計対象月 (1-12)
  this_year_received BIGINT NOT NULL DEFAULT 0,
  this_year_year INTEGER,

  -- タイミング
  last_received_at TIMESTAMPTZ,
  first_received_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE therapist_gift_points DISABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────
-- 3. ライブ配信側にも投げ銭累計カラム追加
-- ─────────────────────────────────────────────────────────────
ALTER TABLE live_streams
  ADD COLUMN IF NOT EXISTS gift_count_total INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gift_points_total INTEGER NOT NULL DEFAULT 0;

-- 日記、ストーリーへの累計 (将来集計しやすく)
ALTER TABLE therapist_diary_entries
  ADD COLUMN IF NOT EXISTS gift_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gift_points INTEGER NOT NULL DEFAULT 0;

ALTER TABLE therapist_diary_stories
  ADD COLUMN IF NOT EXISTS gift_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gift_points INTEGER NOT NULL DEFAULT 0;

-- ─────────────────────────────────────────────────────────────
-- 4. updated_at トリガー
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_therapist_gift_points_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_therapist_gift_points_updated_at ON therapist_gift_points;
CREATE TRIGGER trg_therapist_gift_points_updated_at
  BEFORE UPDATE ON therapist_gift_points
  FOR EACH ROW
  EXECUTE FUNCTION update_therapist_gift_points_updated_at();
