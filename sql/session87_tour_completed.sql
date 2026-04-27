-- =============================================================
-- session87: マイページ初回ログイン時のインタラクティブツアー
-- 5/1先行リリース時にセラピストさんへ機能案内を表示する
-- =============================================================

-- 1. tour_completed カラムを追加（false = まだ未完了）
ALTER TABLE therapists ADD COLUMN IF NOT EXISTS tour_completed boolean DEFAULT false;

-- 2. デモアカウントは tour_completed = false（毎回ツアー表示）
-- (毎晩のリセットで is_demo の人は tour_completed もリセット推奨だが、
--  /api/demo-reset では therapists テーブル本体は触らないので、
--  ログアウト時にデモは false にリセットする方針でフロント側で処理)

-- 3. 確認クエリ
-- SELECT id, name, login_email, tour_completed, is_demo
-- FROM therapists
-- WHERE deleted_at IS NULL
-- ORDER BY id;
