-- =====================================================================
-- session65_diary_system.sql
-- 写メ日記システム Phase 1 用マイグレーション
-- 作成日: 2026/4/25
-- 関連ドキュメント: docs/17_DIARY_DESIGN.md
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. メイン: 写メ日記投稿テーブル
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS therapist_diary_entries (
  id BIGSERIAL PRIMARY KEY,
  therapist_id BIGINT NOT NULL,
  
  -- コンテンツ
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  cover_image_url TEXT,
  
  -- 公開範囲
  visibility TEXT NOT NULL DEFAULT 'public',
  status TEXT NOT NULL DEFAULT 'published',
  
  -- 駅ちか連携
  send_to_ekichika BOOLEAN NOT NULL DEFAULT true,
  ekichika_dispatched_at TIMESTAMPTZ,
  ekichika_dispatch_status TEXT,
  ekichika_error_message TEXT,
  
  -- メタデータ
  view_count BIGINT NOT NULL DEFAULT 0,
  like_count BIGINT NOT NULL DEFAULT 0,
  comment_count BIGINT NOT NULL DEFAULT 0,
  
  -- スケジュール
  scheduled_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- 編集・削除
  edited_by_staff_id BIGINT,
  edited_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  deleted_by_staff_id BIGINT,
  delete_reason TEXT,
  
  -- 投稿元
  source TEXT NOT NULL DEFAULT 'mypage',
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_diary_entries_therapist 
  ON therapist_diary_entries(therapist_id);
CREATE INDEX IF NOT EXISTS idx_diary_entries_published 
  ON therapist_diary_entries(published_at DESC) 
  WHERE deleted_at IS NULL AND status = 'published';
CREATE INDEX IF NOT EXISTS idx_diary_entries_visibility 
  ON therapist_diary_entries(visibility, published_at DESC) 
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_diary_entries_dispatch 
  ON therapist_diary_entries(ekichika_dispatch_status) 
  WHERE ekichika_dispatch_status IN ('pending', 'failed');

ALTER TABLE therapist_diary_entries DISABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------
-- 2. 添付画像テーブル
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS therapist_diary_images (
  id BIGSERIAL PRIMARY KEY,
  entry_id BIGINT NOT NULL REFERENCES therapist_diary_entries(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  thumbnail_url TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  width INT,
  height INT,
  file_size_bytes BIGINT,
  caption TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_diary_images_entry 
  ON therapist_diary_images(entry_id, sort_order);

ALTER TABLE therapist_diary_images DISABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------
-- 3. タグマスター
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS therapist_diary_tags (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  category TEXT,
  color TEXT DEFAULT '#c3a782',
  use_count BIGINT NOT NULL DEFAULT 0,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  is_blocked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_diary_tags_use_count 
  ON therapist_diary_tags(use_count DESC) 
  WHERE is_blocked = false;
CREATE INDEX IF NOT EXISTS idx_diary_tags_featured 
  ON therapist_diary_tags(is_featured) 
  WHERE is_featured = true;

ALTER TABLE therapist_diary_tags DISABLE ROW LEVEL SECURITY;

-- 初期タグ投入
INSERT INTO therapist_diary_tags (name, display_name, category, is_featured) VALUES
  ('今日の私', '#今日の私', 'mood', true),
  ('お礼', '#お礼', 'mood', true),
  ('新人', '#新人', 'salon', true),
  ('出勤', '#出勤', 'salon', true),
  ('久しぶり', '#久しぶり', 'salon', false),
  ('衣装', '#衣装', 'outfit', false),
  ('カフェ', '#カフェ', 'other', false),
  ('プライベート', '#プライベート', 'mood', false),
  ('お知らせ', '#お知らせ', 'salon', true),
  ('リピーター様', '#リピーター様', 'mood', false)
ON CONFLICT (name) DO NOTHING;

-- ---------------------------------------------------------------------
-- 4. 投稿×タグ中間テーブル
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS therapist_diary_entry_tags (
  id BIGSERIAL PRIMARY KEY,
  entry_id BIGINT NOT NULL REFERENCES therapist_diary_entries(id) ON DELETE CASCADE,
  tag_id BIGINT NOT NULL REFERENCES therapist_diary_tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(entry_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_diary_entry_tags_entry 
  ON therapist_diary_entry_tags(entry_id);
CREATE INDEX IF NOT EXISTS idx_diary_entry_tags_tag 
  ON therapist_diary_entry_tags(tag_id);

ALTER TABLE therapist_diary_entry_tags DISABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------
-- 5. いいね（Phase 2 で本格使用、Phase 1 でもテーブルだけ作っておく）
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS therapist_diary_likes (
  id BIGSERIAL PRIMARY KEY,
  entry_id BIGINT NOT NULL REFERENCES therapist_diary_entries(id) ON DELETE CASCADE,
  customer_id BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(entry_id, customer_id)
);

CREATE INDEX IF NOT EXISTS idx_diary_likes_entry 
  ON therapist_diary_likes(entry_id);
CREATE INDEX IF NOT EXISTS idx_diary_likes_customer 
  ON therapist_diary_likes(customer_id);

ALTER TABLE therapist_diary_likes DISABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------
-- 6. コメント（Phase 2 で本格使用）
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS therapist_diary_comments (
  id BIGSERIAL PRIMARY KEY,
  entry_id BIGINT NOT NULL REFERENCES therapist_diary_entries(id) ON DELETE CASCADE,
  customer_id BIGINT NOT NULL,
  body TEXT NOT NULL,
  is_hidden BOOLEAN NOT NULL DEFAULT false,
  is_replied BOOLEAN NOT NULL DEFAULT false,
  reply_body TEXT,
  reply_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_diary_comments_entry 
  ON therapist_diary_comments(entry_id, created_at DESC) 
  WHERE deleted_at IS NULL AND is_hidden = false;
CREATE INDEX IF NOT EXISTS idx_diary_comments_customer 
  ON therapist_diary_comments(customer_id);

ALTER TABLE therapist_diary_comments DISABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------
-- 7. 閲覧履歴（DBサイズ管理のため定期削除推奨）
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS therapist_diary_views (
  id BIGSERIAL PRIMARY KEY,
  entry_id BIGINT NOT NULL,
  customer_id BIGINT,
  ip_hash TEXT,
  user_agent TEXT,
  referrer TEXT,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_diary_views_entry_date 
  ON therapist_diary_views(entry_id, viewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_diary_views_customer 
  ON therapist_diary_views(customer_id) 
  WHERE customer_id IS NOT NULL;

ALTER TABLE therapist_diary_views DISABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------
-- 8. 駅ちか送信先設定
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ekichika_post_settings (
  id BIGSERIAL PRIMARY KEY,
  therapist_id BIGINT NOT NULL UNIQUE,
  ekichika_email TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_sent_at TIMESTAMPTZ,
  total_sent_count BIGINT NOT NULL DEFAULT 0,
  total_failed_count BIGINT NOT NULL DEFAULT 0,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ekichika_settings_therapist 
  ON ekichika_post_settings(therapist_id);

ALTER TABLE ekichika_post_settings DISABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------
-- 9. 駅ちか送信ログ
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ekichika_dispatch_logs (
  id BIGSERIAL PRIMARY KEY,
  entry_id BIGINT NOT NULL,
  therapist_id BIGINT NOT NULL,
  ekichika_email TEXT NOT NULL,
  
  subject TEXT NOT NULL,
  body_text TEXT NOT NULL,
  image_count INT NOT NULL DEFAULT 0,
  total_size_bytes BIGINT,
  
  status TEXT NOT NULL,
  smtp_response TEXT,
  error_message TEXT,
  retry_count INT NOT NULL DEFAULT 0,
  
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ekichika_logs_entry 
  ON ekichika_dispatch_logs(entry_id);
CREATE INDEX IF NOT EXISTS idx_ekichika_logs_status 
  ON ekichika_dispatch_logs(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ekichika_logs_therapist 
  ON ekichika_dispatch_logs(therapist_id, created_at DESC);

ALTER TABLE ekichika_dispatch_logs DISABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------
-- 10. お客様のお気に入りセラピスト
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS customer_diary_favorites (
  id BIGSERIAL PRIMARY KEY,
  customer_id BIGINT NOT NULL,
  therapist_id BIGINT NOT NULL,
  notify_on_post BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(customer_id, therapist_id)
);

CREATE INDEX IF NOT EXISTS idx_diary_favs_customer 
  ON customer_diary_favorites(customer_id);
CREATE INDEX IF NOT EXISTS idx_diary_favs_therapist 
  ON customer_diary_favorites(therapist_id);

ALTER TABLE customer_diary_favorites DISABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------
-- 11. updated_at 自動更新トリガー
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_diary_entries_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_diary_entries_updated_at ON therapist_diary_entries;
CREATE TRIGGER trg_diary_entries_updated_at
  BEFORE UPDATE ON therapist_diary_entries
  FOR EACH ROW EXECUTE FUNCTION update_diary_entries_updated_at();

DROP TRIGGER IF EXISTS trg_ekichika_settings_updated_at ON ekichika_post_settings;
CREATE TRIGGER trg_ekichika_settings_updated_at
  BEFORE UPDATE ON ekichika_post_settings
  FOR EACH ROW EXECUTE FUNCTION update_diary_entries_updated_at();

-- ---------------------------------------------------------------------
-- 12. Storage バケット作成は Supabase ダッシュボードで手動実行
-- ---------------------------------------------------------------------
-- 名前: therapist-diary
-- public: true
-- 許可ファイル形式: image/webp, image/jpeg, image/png
-- 最大ファイルサイズ: 5MB
-- パス規則: {therapist_id}/{entry_id}/{uuid}.webp

-- ---------------------------------------------------------------------
-- 確認用クエリ
-- ---------------------------------------------------------------------
-- SELECT tablename, rowsecurity FROM pg_tables 
-- WHERE tablename LIKE '%diary%' OR tablename LIKE '%ekichika%'
-- ORDER BY tablename;
-- 
-- 全テーブルの rowsecurity が false になっていれば正常
