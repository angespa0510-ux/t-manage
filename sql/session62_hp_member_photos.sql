-- ═══════════════════════════════════════════════════════════
-- Session 62-C: HP 会員限定写真
--
-- 目的:
--   HP (ange-spa.com) 上のセラピスト写真を「公開」と「会員限定」
--   の2段階で掲載可能にする。未登録のお客様には「会員になると
--   もっと見られる」とCTAを表示し、会員登録を促す。
--
-- 運用:
--   - 公開写真: 誰でも閲覧可能（メイン1枚はセラピスト一覧にも表示）
--   - 会員限定: customer_mypage にログイン済みの会員のみ閲覧可能
--     → 非会員には「ぼかし画像 + 会員登録ボタン」を表示
--
-- 既存の therapists テーブルには main_photo_url が既にあるが、
-- 複数枚管理のため hp_photos テーブルを新設。
-- ═══════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────
-- ① セラピスト写真（複数枚対応 + 公開レベル）
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hp_photos (
  id bigserial PRIMARY KEY,
  therapist_id bigint NOT NULL REFERENCES therapists(id) ON DELETE CASCADE,
  photo_url text NOT NULL,                       -- Supabase Storage URL
  thumbnail_url text,                            -- サムネイル（任意）
  visibility text NOT NULL DEFAULT 'public',     -- 'public' | 'member_only'
  caption text DEFAULT '',
  display_order int DEFAULT 0,
  is_main boolean DEFAULT false,                 -- メイン写真（1人につき1枚）
  is_active boolean DEFAULT true,
  width int,
  height int,
  file_size_kb int,
  view_count_public int DEFAULT 0,               -- 非会員にも見られる回数
  view_count_member int DEFAULT 0,               -- 会員が見た回数
  member_cta_shown_count int DEFAULT 0,          -- 「ぼかし」CTA表示回数
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hp_photos_therapist ON hp_photos(therapist_id, display_order);
CREATE INDEX IF NOT EXISTS idx_hp_photos_visibility ON hp_photos(visibility, is_active);
CREATE INDEX IF NOT EXISTS idx_hp_photos_main ON hp_photos(therapist_id, is_main) WHERE is_main = true;

-- ─────────────────────────────────────────────
-- ② 閲覧ログ（会員登録コンバージョン測定用）
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hp_photo_views (
  id bigserial PRIMARY KEY,
  photo_id bigint NOT NULL REFERENCES hp_photos(id) ON DELETE CASCADE,
  therapist_id bigint,
  session_id text,                               -- ブラウザセッション
  customer_id bigint REFERENCES customers(id) ON DELETE SET NULL,
  is_member boolean DEFAULT false,
  view_type text DEFAULT 'view',                 -- 'view' | 'cta_shown' | 'cta_clicked'
  referer text,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hp_photo_views_photo ON hp_photo_views(photo_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hp_photo_views_customer ON hp_photo_views(customer_id);
CREATE INDEX IF NOT EXISTS idx_hp_photo_views_cta ON hp_photo_views(view_type) WHERE view_type != 'view';

-- ─────────────────────────────────────────────
-- ③ 会員向け特設フィード（新着・おすすめ等）
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hp_member_feed (
  id bigserial PRIMARY KEY,
  feed_type text NOT NULL DEFAULT 'photo',       -- 'photo' | 'notice' | 'campaign'
  title text DEFAULT '',
  body text DEFAULT '',
  photo_id bigint REFERENCES hp_photos(id) ON DELETE SET NULL,
  link_url text,
  is_published boolean DEFAULT true,
  published_at timestamptz DEFAULT now(),
  expires_at timestamptz,
  created_by_staff_id bigint,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hp_feed_published ON hp_member_feed(is_published, published_at DESC);

-- ─────────────────────────────────────────────
-- ④ Supabase Storage 用バケット（手動作成 必要）
--    Dashboard > Storage > "hp-photos" (public) を作成してください
-- ─────────────────────────────────────────────

-- ─────────────────────────────────────────────
-- RLS 無効化
-- ─────────────────────────────────────────────
ALTER TABLE hp_photos DISABLE ROW LEVEL SECURITY;
ALTER TABLE hp_photo_views DISABLE ROW LEVEL SECURITY;
ALTER TABLE hp_member_feed DISABLE ROW LEVEL SECURITY;
