-- ==============================================================
-- session50_rls_fix.sql
-- RLS 403 エラー修正:
--   staff_advances / staff_login_logs などで 403 Forbidden が出る問題を修正。
--   過去の session46-49 の SQL で CREATE TABLE だけ実行されて
--   DISABLE ROW LEVEL SECURITY が効いていなかったテーブル群の救済。
--
--   ALTER TABLE IF EXISTS ... は Postgres 10+ で利用可能 (Supabase は 15+)。
--   存在しないテーブルはスキップされるので安全に複数回実行可能 (冪等)。
-- ==============================================================

-- session46: PIN セキュリティ関連
ALTER TABLE IF EXISTS staff_login_logs   DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS mynumber_access_logs DISABLE ROW LEVEL SECURITY;

-- session48: 前借り・通知ログ
ALTER TABLE IF EXISTS staff_advances     DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS notification_logs  DISABLE ROW LEVEL SECURITY;

-- session43-44: 資金管理系 (念のため)
ALTER TABLE IF EXISTS atm_deposits               DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS toyohashi_reserve_movements DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS cash_balance_checks        DISABLE ROW LEVEL SECURITY;

-- session49: 在庫管理系 (念のため)
ALTER TABLE IF EXISTS inventory_stores    DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS inventory_items     DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS inventory_sessions  DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS inventory_counts    DISABLE ROW LEVEL SECURITY;

-- ==============================================================
-- 【確認用】RLS が有効なままのテーブルがないか検査
-- このクエリの結果が 0 件なら OK
-- ==============================================================
-- SELECT schemaname, tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public'
--   AND rowsecurity = true
-- ORDER BY tablename;
