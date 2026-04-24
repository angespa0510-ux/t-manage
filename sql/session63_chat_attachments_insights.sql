-- ═══════════════════════════════════════════════════════════
-- Session 63: チャット添付ファイル + AI分析基盤
--
-- 追加内容:
--   ① chat_attachments       — 画像・動画の添付記録（15日で自動削除）
--   ② chat_insights          — AI 分析結果（週次バッチで蓄積）
--   ③ chat_insight_runs      — バッチ実行ログ（成功/失敗・使用量）
--   ④ 添付ファイル自動削除関数
--
-- 既存 chat_messages の attachment_url / attachment_type を活用し、
-- 別テーブル chat_attachments で「15日で自動削除」用のメタ情報を管理。
--
-- AI 分析は週1回（日曜深夜）Vercel Cron でバッチ実行し、
-- 結果を chat_insights に蓄積。/chat-insights ページで閲覧。
-- ═══════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────
-- ① 添付ファイル管理
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_attachments (
  id bigserial PRIMARY KEY,
  conversation_id bigint NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
  message_id bigint REFERENCES chat_messages(id) ON DELETE SET NULL,
  storage_path text NOT NULL,                    -- 'conv-123/1234567890-abc.jpg'
  file_url text NOT NULL,                        -- public URL
  file_type text NOT NULL,                       -- 'image/jpeg', 'video/mp4' など
  file_size bigint DEFAULT 0,                    -- バイト
  uploaded_by_type text NOT NULL,                -- 'staff' | 'therapist'
  uploaded_by_id bigint NOT NULL,
  expires_at timestamptz NOT NULL,               -- この時刻を過ぎたら削除対象
  deleted_at timestamptz,                        -- 削除済み（Storage削除も完了）
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_att_conv ON chat_attachments(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_att_expires ON chat_attachments(expires_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_chat_att_uploader ON chat_attachments(uploaded_by_type, uploaded_by_id);

ALTER TABLE chat_attachments DISABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────
-- ② AI 分析結果
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_insights (
  id bigserial PRIMARY KEY,
  run_id bigint,                                 -- chat_insight_runs への参照
  period_start date NOT NULL,                    -- 分析対象期間の開始日
  period_end date NOT NULL,                      -- 分析対象期間の終了日
  insight_type text NOT NULL,                    -- 'summary' | 'pattern' | 'suggestion' | 'staff_style' | 'therapist_trend' | 'trouble' | 'improvement'
  scope text DEFAULT 'global',                   -- 'global' | 'staff' | 'therapist' | 'conversation'
  scope_id bigint,                               -- scope に応じた ID
  scope_name text,                               -- 表示用の名前（スタッフ名など）
  title text NOT NULL,                           -- 見出し
  summary text,                                  -- 短い要約
  detail text,                                   -- 詳細な分析
  suggested_action text,                         -- 推奨アクション
  example_good text,                             -- 良い返信例
  example_bad text,                              -- 悪い返信例（改善対象）
  metric_value numeric,                          -- 数値指標（応答時間など）
  metric_label text,                             -- 指標ラベル
  priority int DEFAULT 0,                        -- 重要度（高い順）
  tags text[] DEFAULT '{}',                      -- 'urgency:high', 'category:shift' など
  is_dismissed boolean DEFAULT false,            -- 管理者が「対応済み/不要」にした
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_ins_period ON chat_insights(period_start DESC, period_end DESC);
CREATE INDEX IF NOT EXISTS idx_chat_ins_type ON chat_insights(insight_type);
CREATE INDEX IF NOT EXISTS idx_chat_ins_scope ON chat_insights(scope, scope_id);
CREATE INDEX IF NOT EXISTS idx_chat_ins_priority ON chat_insights(priority DESC) WHERE is_dismissed = false;

ALTER TABLE chat_insights DISABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────
-- ③ バッチ実行ログ
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_insight_runs (
  id bigserial PRIMARY KEY,
  period_start date NOT NULL,
  period_end date NOT NULL,
  triggered_by text DEFAULT 'cron',              -- 'cron' | 'manual'
  triggered_by_name text,
  status text DEFAULT 'running',                 -- 'running' | 'success' | 'failed'
  messages_analyzed int DEFAULT 0,
  insights_generated int DEFAULT 0,
  tokens_in int DEFAULT 0,
  tokens_out int DEFAULT 0,
  cost_jpy numeric(10,4) DEFAULT 0,
  error_message text,
  started_at timestamptz DEFAULT now(),
  finished_at timestamptz,
  duration_ms int
);

CREATE INDEX IF NOT EXISTS idx_chat_ins_runs_started ON chat_insight_runs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_ins_runs_status ON chat_insight_runs(status);

ALTER TABLE chat_insight_runs DISABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────
-- ④ chat_insights.run_id の外部キー（遅延付与、chat_insight_runs 作成後）
-- ─────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chat_insights_run_id_fkey'
  ) THEN
    ALTER TABLE chat_insights
      ADD CONSTRAINT chat_insights_run_id_fkey
      FOREIGN KEY (run_id) REFERENCES chat_insight_runs(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ─────────────────────────────────────────────
-- ⑤ Storage バケット作成
--    Dashboard > Storage > "chat-attachments" (public) を作成してください
--    File size limit: 30MB 推奨
--    Allowed MIME types: image/*, video/*
-- ─────────────────────────────────────────────

-- Storage RLS ポリシー（chat-attachments バケット用）
-- 誰でも閲覧・アップロード可能（チャット内部利用のため）
-- 削除はサービスロールから chat-attachments-cleanup で実行

-- 既存の類似ポリシーを削除（冪等性）
DROP POLICY IF EXISTS "chat-attachments public select"  ON storage.objects;
DROP POLICY IF EXISTS "chat-attachments public insert"  ON storage.objects;

CREATE POLICY "chat-attachments public select"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'chat-attachments');

CREATE POLICY "chat-attachments public insert"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'chat-attachments');

-- ─────────────────────────────────────────────
-- 備考: 15日経過した添付ファイルの削除は
--   /api/chat-attachments-cleanup (週次 cron) で
--   1) storage から remove → 2) chat_attachments.deleted_at を更新
--   という順に処理する。pg_cron は使わない（Vercel Cron に統一）。
-- ─────────────────────────────────────────────
