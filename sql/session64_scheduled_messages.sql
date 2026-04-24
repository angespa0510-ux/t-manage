-- ═══════════════════════════════════════════════════════════
-- Session 64: チャット送信予約機能
--
-- 追加内容:
--   chat_scheduled_messages — 予約投稿テーブル
--
-- 運用:
--   スタッフが「この時間に送信」として登録
--   /api/scheduled-messages-send が Vercel Cron で 10分おきに実行
--   scheduled_at <= NOW() かつ status='pending' を chat_messages に挿入
--   status = 'sent' に更新
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS chat_scheduled_messages (
  id bigserial PRIMARY KEY,
  conversation_id bigint NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
  sender_type text NOT NULL DEFAULT 'staff',   -- 'staff' 固定（将来拡張用）
  sender_id bigint NOT NULL,
  sender_name text NOT NULL,
  content text DEFAULT '',
  -- 添付（予約時にもアップロード、expires_atは送信成功時に再計算）
  attachment_url text,
  attachment_type text,
  attachment_storage_path text,                -- 添付ファイル経路（送信時に chat_attachments へ登録）
  attachment_size bigint DEFAULT 0,
  -- 予約スケジュール
  scheduled_at timestamptz NOT NULL,           -- この時刻を過ぎたら送信
  status text NOT NULL DEFAULT 'pending',      -- 'pending' | 'sent' | 'cancelled' | 'failed'
  sent_at timestamptz,                         -- 実際に送信された時刻
  sent_message_id bigint REFERENCES chat_messages(id) ON DELETE SET NULL,
  error_message text,
  -- メタ
  created_by_id bigint NOT NULL,               -- 作成者(staff.id)
  created_by_name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_sched_pending
  ON chat_scheduled_messages(scheduled_at)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_chat_sched_conv
  ON chat_scheduled_messages(conversation_id, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_chat_sched_creator
  ON chat_scheduled_messages(created_by_id, scheduled_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_sched_status
  ON chat_scheduled_messages(status, scheduled_at);

ALTER TABLE chat_scheduled_messages DISABLE ROW LEVEL SECURITY;

-- updated_at 自動更新トリガー（既存があればスキップ）
CREATE OR REPLACE FUNCTION trg_chat_sched_update_timestamp()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS chat_sched_update_timestamp ON chat_scheduled_messages;
CREATE TRIGGER chat_sched_update_timestamp
  BEFORE UPDATE ON chat_scheduled_messages
  FOR EACH ROW
  EXECUTE FUNCTION trg_chat_sched_update_timestamp();
