-- ============================================
-- セッション㉖: マニュアルシステム Phase 1
-- ============================================

-- 1. カテゴリテーブル
CREATE TABLE IF NOT EXISTS manual_categories (
  id serial PRIMARY KEY,
  name text NOT NULL,
  icon text DEFAULT '📄',
  color text DEFAULT '#FBEAF0',
  description text DEFAULT '',
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- 2. 記事テーブル
CREATE TABLE IF NOT EXISTS manual_articles (
  id serial PRIMARY KEY,
  title text NOT NULL,
  category_id int REFERENCES manual_categories(id) ON DELETE SET NULL,
  content text NOT NULL DEFAULT '',
  cover_image text DEFAULT '',
  tags text[] DEFAULT '{}',
  is_published boolean DEFAULT false,
  is_pinned boolean DEFAULT false,
  view_count int DEFAULT 0,
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 3. 既読管理テーブル
CREATE TABLE IF NOT EXISTS manual_reads (
  id serial PRIMARY KEY,
  article_id int REFERENCES manual_articles(id) ON DELETE CASCADE,
  therapist_id int REFERENCES therapists(id) ON DELETE CASCADE,
  read_at timestamptz DEFAULT now(),
  UNIQUE(article_id, therapist_id)
);

-- 4. 更新履歴テーブル
CREATE TABLE IF NOT EXISTS manual_updates (
  id serial PRIMARY KEY,
  article_id int REFERENCES manual_articles(id) ON DELETE CASCADE,
  summary text NOT NULL DEFAULT '',
  updated_by text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

-- 5. Q&Aテーブル
CREATE TABLE IF NOT EXISTS manual_qa (
  id serial PRIMARY KEY,
  article_id int REFERENCES manual_articles(id) ON DELETE CASCADE,
  question text NOT NULL,
  answer text NOT NULL DEFAULT '',
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- 6. カテゴリ初期データ
INSERT INTO manual_categories (name, icon, color, description, sort_order) VALUES
  ('はじめに', '🌸', '#FBEAF0', '新人さん向けの基本情報', 1),
  ('施術マニュアル', '💆', '#EEEDFE', '技術・接客のポイント', 2),
  ('清掃・準備', '🧹', '#E1F5EE', 'お部屋をキレイに', 3),
  ('お金・精算', '💰', '#FAEEDA', 'お給料・お釣り・精算', 4),
  ('勤務・シフト', '⏰', '#E6F1FB', '出退勤のルール', 5),
  ('予約・接客', '📅', '#EEEDFE', 'お客様対応', 6),
  ('ルーム別ガイド', '🏢', '#FAECE7', '各店舗の情報', 7),
  ('ルール・その他', '📋', '#F1EFE8', '規定・Tips', 8)
ON CONFLICT DO NOTHING;

-- 7. RLSポリシー
ALTER TABLE manual_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE manual_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE manual_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE manual_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE manual_qa ENABLE ROW LEVEL SECURITY;

CREATE POLICY "manual_categories_all" ON manual_categories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "manual_articles_all" ON manual_articles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "manual_reads_all" ON manual_reads FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "manual_updates_all" ON manual_updates FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "manual_qa_all" ON manual_qa FOR ALL USING (true) WITH CHECK (true);

-- 8. Supabase Storage バケット（手動作成が必要な場合のメモ）
-- バケット名: manual-images
-- パブリック: はい
-- 許可MIME: image/jpeg, image/png, image/gif, image/webp
