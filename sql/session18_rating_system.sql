-- =====================================================
-- T-MANAGE: 動画評価システム カラム追加
-- Supabase SQL Editor で実行してください
-- =====================================================

-- 4カテゴリ × 5段階評価
ALTER TABLE video_generation_logs ADD COLUMN IF NOT EXISTS rating_motion INTEGER DEFAULT 0;      -- 動きの質 (0=未評価, 1-5)
ALTER TABLE video_generation_logs ADD COLUMN IF NOT EXISTS rating_consistency INTEGER DEFAULT 0;  -- 一貫性 (0=未評価, 1-5)
ALTER TABLE video_generation_logs ADD COLUMN IF NOT EXISTS rating_quality INTEGER DEFAULT 0;      -- 品質 (0=未評価, 1-5)
ALTER TABLE video_generation_logs ADD COLUMN IF NOT EXISTS rating_safety INTEGER DEFAULT 0;       -- 安全性 (0=未評価, 1-5)

-- 評価コメント（キーワード形式）
ALTER TABLE video_generation_logs ADD COLUMN IF NOT EXISTS rating_comment TEXT DEFAULT '';

-- 元画像URL保持（プロンプト改善時の参考用）
ALTER TABLE video_generation_logs ADD COLUMN IF NOT EXISTS original_image_url TEXT DEFAULT '';

-- 評価済みインデックス（10件溜まったかの確認用）
CREATE INDEX IF NOT EXISTS idx_video_logs_rated
  ON video_generation_logs(rating_motion)
  WHERE rating_motion > 0;

-- =====================================================
-- 確認用クエリ
-- =====================================================
-- 評価済み件数を確認
-- SELECT COUNT(*) AS rated_count FROM video_generation_logs WHERE rating_motion > 0;
--
-- 評価データエクスポート用（10件溜まったらこれを実行）
-- SELECT
--   therapist_name, motion_category, prompt_used,
--   rating_motion, rating_consistency, rating_quality, rating_safety,
--   rating_comment, original_image_url, video_filename,
--   created_at
-- FROM video_generation_logs
-- WHERE rating_motion > 0
-- ORDER BY created_at DESC;
