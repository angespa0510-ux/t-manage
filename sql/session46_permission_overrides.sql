-- ======================================================================
-- session46: 権限個別上書き機能 + 責任者(supervisor)ロール追加
-- ======================================================================
-- 目的:
--   (1) ロールベースの権限判定はそのまま維持
--   (2) 社長だけが、スタッフごとに権限を個別上書きできるようにする
--   (3) 「責任者」ロール (supervisor) を新規追加
--       -> デフォルトで「管理系操作」+「税理士ポータル」が使える
--   (4) 「管理系操作」はロール問わず全員デフォルト有効化 (基本みんなできる)
-- ======================================================================

-- 個別上書きカラム (NULL = ロール/ポジションベースの既定判定を使う)
ALTER TABLE staff ADD COLUMN IF NOT EXISTS override_is_manager BOOLEAN;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS override_can_tax_portal BOOLEAN;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS override_can_cash_dashboard BOOLEAN;

COMMENT ON COLUMN staff.role IS 'ロール: owner / manager / leader / supervisor / staff';
COMMENT ON COLUMN staff.override_is_manager IS 'NULL=既定(全員true)、true/false=明示的上書き';
COMMENT ON COLUMN staff.override_can_tax_portal IS 'NULL=既定(社長/経営責任者/税理士/責任者)、true/false=明示的上書き';
COMMENT ON COLUMN staff.override_can_cash_dashboard IS 'NULL=既定(社長/経営責任者)、true/false=明示的上書き';

-- RLS はこれまで通り無効
ALTER TABLE staff DISABLE ROW LEVEL SECURITY;
