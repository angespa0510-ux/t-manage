-- Session 27: AIチャット質問ログテーブル
CREATE TABLE IF NOT EXISTS manual_ai_logs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  question text NOT NULL,
  answer text,
  therapist_name text,
  created_at timestamptz DEFAULT now()
);

-- RLSポリシー
ALTER TABLE manual_ai_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "manual_ai_logs_select" ON manual_ai_logs FOR SELECT USING (true);
CREATE POLICY "manual_ai_logs_insert" ON manual_ai_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "manual_ai_logs_delete" ON manual_ai_logs FOR DELETE USING (true);
