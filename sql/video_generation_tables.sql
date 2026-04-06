-- =====================================================
-- T-MANAGE: AI動画生成機能 テーブル
-- Supabase SQL Editor で実行してください
-- =====================================================

-- 動画生成ログテーブル
CREATE TABLE IF NOT EXISTS video_generation_logs (
  id SERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- セラピスト情報
  therapist_name TEXT NOT NULL,
  therapist_sid TEXT NOT NULL,
  therapist_age TEXT DEFAULT '',
  therapist_height TEXT DEFAULT '',
  therapist_cup TEXT DEFAULT '',

  -- 画像情報
  image_url TEXT DEFAULT '',
  all_image_urls JSONB DEFAULT '[]',

  -- 生成パラメータ
  motion_category TEXT NOT NULL,
  prompt_used TEXT DEFAULT '',

  -- 結果
  result TEXT DEFAULT 'pending',  -- pending / processing / success / safety_rejected / failed / timeout
  retry_count INTEGER DEFAULT 0,
  error_message TEXT DEFAULT '',

  -- いいね
  liked BOOLEAN DEFAULT FALSE,

  -- ファイル情報
  video_filename TEXT DEFAULT '',
  gdrive_path TEXT DEFAULT ''
);

-- updated_at 自動更新トリガー
CREATE OR REPLACE FUNCTION update_video_log_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_video_log_updated
  BEFORE UPDATE ON video_generation_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_video_log_timestamp();

-- RLS ポリシー（認証ユーザーのみ）
ALTER TABLE video_generation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage video logs"
  ON video_generation_logs
  FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- インデックス
CREATE INDEX IF NOT EXISTS idx_video_logs_result ON video_generation_logs(result);
CREATE INDEX IF NOT EXISTS idx_video_logs_therapist ON video_generation_logs(therapist_sid);
CREATE INDEX IF NOT EXISTS idx_video_logs_liked ON video_generation_logs(liked) WHERE liked = true;

-- Realtime有効化（ステータス監視用）
ALTER PUBLICATION supabase_realtime ADD TABLE video_generation_logs;

-- =====================================================
-- 確認用クエリ
-- =====================================================
-- SELECT * FROM video_generation_logs ORDER BY created_at DESC LIMIT 10;
