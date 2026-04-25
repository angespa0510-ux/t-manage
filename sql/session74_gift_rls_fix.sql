-- ═══════════════════════════════════════════════════════════════
-- 投げ銭関連テーブルの RLS を無効化 (緊急パッチ)
-- ═══════════════════════════════════════════════════════════════
--
-- 【背景】
-- session71 で gift_transactions テーブルに RLS 無効化を入れ忘れていた。
-- そのため Supabase Anon Key からの INSERT がすべて拒否され、投げ銭送信時に
--   "new row violates row-level security policy for table gift_transactions"
-- エラーが発生していた。
--
-- 【方針】
-- T-MANAGE 標準: RLS は無効化、認証はアプリケーション層で実施。
-- 投げ銭関連の3テーブルすべての RLS を無効化する。
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE gift_transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE therapist_gift_points DISABLE ROW LEVEL SECURITY;
ALTER TABLE gift_payouts DISABLE ROW LEVEL SECURITY;

-- 確認用クエリ (実行後、すべて 'f' (false) になっていれば OK)
-- SELECT tablename, rowsecurity FROM pg_tables
-- WHERE tablename IN ('gift_transactions', 'therapist_gift_points', 'gift_payouts');
