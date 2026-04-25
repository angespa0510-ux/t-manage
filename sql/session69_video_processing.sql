-- ═══════════════════════════════════════════════════════════════
-- session69_video_processing.sql
-- 動画リエンコード基盤 (Phase 3 Step I)
-- ═══════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────
-- 1. 動画処理ジョブテーブル
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS video_processing_jobs (
  id BIGSERIAL PRIMARY KEY,

  -- 元情報
  source_type TEXT NOT NULL,                -- 'story' | 'diary' | 'mypage'
  source_id BIGINT,                          -- story_id or entry_id (none yetの場合NULL)
  therapist_id BIGINT NOT NULL,

  -- ファイル情報
  raw_storage_bucket TEXT NOT NULL,          -- 例: 'therapist-videos-raw'
  raw_storage_path TEXT NOT NULL,            -- アップロード生ファイルのパス
  raw_url TEXT,                              -- public URL
  raw_size_bytes BIGINT,
  raw_mime_type TEXT,

  processed_storage_bucket TEXT,             -- 例: 'therapist-videos'
  processed_storage_path TEXT,               -- 完成MP4のパス
  processed_url TEXT,                        -- public URL (最終)
  processed_size_bytes BIGINT,

  thumbnail_storage_path TEXT,
  thumbnail_url TEXT,

  -- 動画メタデータ
  duration_sec NUMERIC,
  width INTEGER,
  height INTEGER,
  codec TEXT,                                -- 元コーデック (h264, hevc, etc)
  framerate NUMERIC,

  -- 処理状態
  status TEXT NOT NULL DEFAULT 'pending',    -- pending | processing | completed | failed
  attempt_count INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 2,

  -- 処理オプション
  target_aspect TEXT,                        -- '9:16' | 'original' (ストーリーは9:16)
  target_max_height INTEGER NOT NULL DEFAULT 1080,
  target_video_bitrate TEXT NOT NULL DEFAULT '2M',
  target_audio_bitrate TEXT NOT NULL DEFAULT '128k',

  -- エラー
  error_message TEXT,
  error_code TEXT,

  -- 処理時間計測
  processing_started_at TIMESTAMPTZ,
  processing_finished_at TIMESTAMPTZ,
  processing_ms INTEGER,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_video_jobs_status
  ON video_processing_jobs(status, created_at)
  WHERE status IN ('pending', 'processing');
CREATE INDEX IF NOT EXISTS idx_video_jobs_source
  ON video_processing_jobs(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_video_jobs_therapist
  ON video_processing_jobs(therapist_id, created_at DESC);

ALTER TABLE video_processing_jobs DISABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────
-- 2. ストーリーテーブル拡張: 処理ジョブIDの参照
-- ─────────────────────────────────────────────────────────────
ALTER TABLE therapist_diary_stories
  ADD COLUMN IF NOT EXISTS video_processing_job_id BIGINT;

CREATE INDEX IF NOT EXISTS idx_diary_stories_processing_job
  ON therapist_diary_stories(video_processing_job_id)
  WHERE video_processing_job_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────
-- 3. updated_at 自動更新トリガー
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_video_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_video_jobs_updated_at ON video_processing_jobs;
CREATE TRIGGER trg_video_jobs_updated_at
  BEFORE UPDATE ON video_processing_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_video_jobs_updated_at();

-- ─────────────────────────────────────────────────────────────
-- 4. Storage バケット (Supabase ダッシュボードで手動作成)
-- ─────────────────────────────────────────────────────────────
-- 必要なバケット:
--   - therapist-videos-raw (Public OFF, 100MB制限)
--     生ファイルアップロード用、処理後は削除される
--   - therapist-videos (Public ON, 50MB制限)
--     処理済み MP4 + サムネ
