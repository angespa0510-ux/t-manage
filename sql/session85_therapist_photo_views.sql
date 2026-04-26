-- ═══════════════════════════════════════════════════════════
-- Session 85: セラピスト写真アクセス分析
--
-- 目的:
--   sub_photo_urls の各写真がHP上でどれだけ見られたかを記録し、
--   スタッフ管理画面とセラピストマイページで「どの写真が人気か」
--   を可視化する。
--
-- 設計:
--   sub_photo_urls は文字列配列のため、写真ごとの主キーが存在しない。
--   そこで「写真の URL」または「インデックス (0〜4)」で識別する。
--
--   今回は (therapist_id, photo_index) で識別。
--   インデックスが入れ替わると集計が崩れるが、運用上は大きな並べ替えが
--   起きない前提。並べ替え対応は将来 hp_photos テーブルへ移行時に対応。
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS therapist_photo_views (
  id bigserial PRIMARY KEY,
  therapist_id bigint NOT NULL REFERENCES therapists(id) ON DELETE CASCADE,
  photo_index int NOT NULL,                       -- 0〜4 (sub_photo_urls の位置)
  view_type text NOT NULL DEFAULT 'view',         -- 'view' | 'cta_clicked' | 'thumb_click'
  is_member boolean DEFAULT false,
  customer_id bigint REFERENCES customers(id) ON DELETE SET NULL,
  session_id text,                                -- ブラウザセッション識別
  user_agent text,
  referer text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tpv_therapist ON therapist_photo_views(therapist_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tpv_therapist_index ON therapist_photo_views(therapist_id, photo_index);
CREATE INDEX IF NOT EXISTS idx_tpv_view_type ON therapist_photo_views(view_type) WHERE view_type != 'view';

-- ─────────────────────────────────────────────
-- 集計ビュー: セラピスト × 写真index ごとの閲覧数
-- ─────────────────────────────────────────────
CREATE OR REPLACE VIEW therapist_photo_view_counts AS
SELECT
  therapist_id,
  photo_index,
  COUNT(*) FILTER (WHERE view_type = 'view') AS view_count,
  COUNT(*) FILTER (WHERE view_type = 'view' AND is_member = true) AS view_count_member,
  COUNT(*) FILTER (WHERE view_type = 'view' AND is_member = false) AS view_count_public,
  COUNT(*) FILTER (WHERE view_type = 'thumb_click') AS thumb_click_count,
  COUNT(*) FILTER (WHERE view_type = 'cta_clicked') AS cta_click_count,
  MAX(created_at) AS last_viewed_at
FROM therapist_photo_views
GROUP BY therapist_id, photo_index;

-- ─────────────────────────────────────────────
-- RLS 無効化
-- ─────────────────────────────────────────────
ALTER TABLE therapist_photo_views DISABLE ROW LEVEL SECURITY;
