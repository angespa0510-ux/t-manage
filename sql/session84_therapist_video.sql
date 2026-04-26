-- ═══════════════════════════════════════════════════════════
-- Session 84: セラピスト紹介動画（1人1動画）
--
-- 目的:
--   HP公開セラピスト詳細ページに、セラピスト本人の紹介動画を
--   1人につき1つまで掲載できるようにする。
--
-- 運用:
--   - 動画は Supabase Storage の "therapist-photos" バケットに
--     therapist_video_{id}_{timestamp}.{ext} の名前でアップロード
--   - therapists.video_url にパブリックURLを格納
--   - 動画なしの場合は NULL
-- ═══════════════════════════════════════════════════════════

-- video_url カラム追加（既に存在する場合はスキップ）
ALTER TABLE therapists
  ADD COLUMN IF NOT EXISTS video_url TEXT;

-- ポスター画像（任意・サムネイル用）
ALTER TABLE therapists
  ADD COLUMN IF NOT EXISTS video_poster_url TEXT;

-- コメント
COMMENT ON COLUMN therapists.video_url IS 'セラピスト紹介動画のURL（1人1動画）。Supabase Storage にアップロード後のパブリックURL。';
COMMENT ON COLUMN therapists.video_poster_url IS '動画再生前のポスター画像URL（任意）';
