-- ═══════════════════════════════════════════════════════════
-- Session 57: お知らせのHP公開フラグ
--
-- 目的:
--   customer_notifications テーブルに「HP にも表示するか」のフラグを追加。
--
--   運用イメージ:
--     - 全員向け告知（休業／お祝い／一般キャンペーン）
--       → target_customer_id=NULL, show_on_hp=true
--       → HPトップ「最新のお知らせ」に表示、マイページにも表示
--
--     - 会員専用告知（ポイント有効期限等）
--       → target_customer_id=<cust>, show_on_hp=false（デフォルト）
--       → 当該会員のマイページにのみ表示
--
--     - 全員向けだがHPには出したくない（マイページ内部のみ）
--       → target_customer_id=NULL, show_on_hp=false
-- ═══════════════════════════════════════════════════════════

ALTER TABLE customer_notifications
  ADD COLUMN IF NOT EXISTS show_on_hp boolean DEFAULT false;

COMMENT ON COLUMN customer_notifications.show_on_hp IS
  'true のとき HP トップの「最新のお知らせ」セクションに表示される。target_customer_id=NULL（全員宛）のものだけが対象。';

-- HP 表示用インデックス
CREATE INDEX IF NOT EXISTS idx_customer_notifications_hp
  ON customer_notifications(show_on_hp, created_at DESC)
  WHERE show_on_hp = true AND target_customer_id IS NULL;
