-- ═══════════════════════════════════════════════════════════
-- Session 62-A: スタッフ↔セラピスト チャットシステム
--
-- 目的:
--   LINE に代わる社内チャット基盤。メンエス業界では LINE が
--   アカウント凍結リスクを抱えるため、自前で持つ必要がある。
--   さらに LINE では有料/不可の以下の AI 機能を無料で提供:
--     - 丁寧語変換
--     - 翻訳（外国人セラピスト対応）
--     - 要約（長文を短く）
--     - 返信ドラフト生成
--     - NG 表現チェック（メンエス業界向けの配慮）
--
-- 会話種別:
--   dm                 — 1対1 DM（スタッフ↔セラピスト）
--   group              — 複数人グループ（スタッフ同士・セラピスト同士・混在）
--   broadcast          — スタッフ→全セラピスト向け一斉配信
--
-- 既存の RLS 無効化方針に準拠。
-- ═══════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────
-- ① 会話ルーム
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_conversations (
  id bigserial PRIMARY KEY,
  type text NOT NULL DEFAULT 'dm',               -- 'dm' | 'group' | 'broadcast'
  name text DEFAULT '',                          -- グループ名（dmでは空）
  created_by_type text NOT NULL DEFAULT 'staff', -- 'staff' | 'therapist'
  created_by_id bigint NOT NULL,
  is_archived boolean DEFAULT false,
  last_message_at timestamptz DEFAULT now(),
  last_message_preview text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_conv_last ON chat_conversations(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_conv_type ON chat_conversations(type);

-- ─────────────────────────────────────────────
-- ② 会話参加者
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_participants (
  id bigserial PRIMARY KEY,
  conversation_id bigint NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
  participant_type text NOT NULL,                -- 'staff' | 'therapist'
  participant_id bigint NOT NULL,
  display_name text DEFAULT '',                  -- 参加時のスナップショット（名前変更後も追えるため）
  role text DEFAULT 'member',                    -- 'owner' | 'admin' | 'member'
  last_read_message_id bigint DEFAULT 0,
  last_read_at timestamptz,
  is_muted boolean DEFAULT false,
  joined_at timestamptz DEFAULT now(),
  left_at timestamptz,
  UNIQUE(conversation_id, participant_type, participant_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_part_lookup ON chat_participants(participant_type, participant_id);
CREATE INDEX IF NOT EXISTS idx_chat_part_conv ON chat_participants(conversation_id);

-- ─────────────────────────────────────────────
-- ③ メッセージ
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_messages (
  id bigserial PRIMARY KEY,
  conversation_id bigint NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
  sender_type text NOT NULL,                     -- 'staff' | 'therapist' | 'ai' | 'system'
  sender_id bigint,
  sender_name text DEFAULT '',                   -- 送信時の名前スナップショット
  content text NOT NULL DEFAULT '',
  message_type text DEFAULT 'text',              -- 'text' | 'image' | 'file' | 'ai_suggestion' | 'system'
  attachment_url text,                           -- 画像・ファイルURL
  attachment_type text,                          -- 'image/jpeg' など
  reply_to_id bigint,                            -- リプライ元メッセージID
  ai_feature_used text,                          -- 'polite' | 'translate' | 'draft' | 'summarize' | null
  is_edited boolean DEFAULT false,
  is_deleted boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_msg_conv ON chat_messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_msg_created ON chat_messages(created_at DESC);

-- ─────────────────────────────────────────────
-- ④ メッセージへのリアクション（絵文字スタンプ）
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_reactions (
  id bigserial PRIMARY KEY,
  message_id bigint NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  reactor_type text NOT NULL,                    -- 'staff' | 'therapist'
  reactor_id bigint NOT NULL,
  emoji text NOT NULL,                           -- '👍' | '❤️' | '🙏' | '😂' | etc
  created_at timestamptz DEFAULT now(),
  UNIQUE(message_id, reactor_type, reactor_id, emoji)
);

CREATE INDEX IF NOT EXISTS idx_chat_react_msg ON chat_reactions(message_id);

-- ─────────────────────────────────────────────
-- ⑤ AI 機能の利用ログ（使用量管理・品質改善）
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_ai_logs (
  id bigserial PRIMARY KEY,
  conversation_id bigint,
  message_id bigint,
  requester_type text NOT NULL,                  -- 'staff' | 'therapist'
  requester_id bigint NOT NULL,
  feature text NOT NULL,                         -- 'polite' | 'translate' | 'draft' | 'summarize' | 'ng_check'
  input text,
  output text,
  target_language text,                          -- 翻訳先言語（'en' | 'zh' | 'ko' | 'vi' 等）
  model text DEFAULT 'claude-sonnet-4-6',
  tokens_in int DEFAULT 0,
  tokens_out int DEFAULT 0,
  cost_jpy numeric(10,4) DEFAULT 0,
  error text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_ailog_created ON chat_ai_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_ailog_feature ON chat_ai_logs(feature);
CREATE INDEX IF NOT EXISTS idx_chat_ailog_requester ON chat_ai_logs(requester_type, requester_id);

-- ─────────────────────────────────────────────
-- ⑥ チャット AI 設定（予算管理）
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_ai_settings (
  id bigserial PRIMARY KEY,
  is_enabled boolean DEFAULT true,
  monthly_budget_jpy numeric(10,2) DEFAULT 3000,  -- 月次予算
  current_month_usage_jpy numeric(10,2) DEFAULT 0,
  current_month text,                             -- 'YYYY-MM'
  per_user_daily_limit int DEFAULT 30,            -- 1ユーザーあたり1日何回まで
  enabled_features text[] DEFAULT ARRAY['polite','translate','draft','summarize','ng_check'],
  updated_at timestamptz DEFAULT now()
);

-- 初期1レコード
INSERT INTO chat_ai_settings (id, is_enabled, monthly_budget_jpy)
  VALUES (1, true, 3000)
  ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────
-- RLS 無効化
-- ─────────────────────────────────────────────
ALTER TABLE chat_conversations DISABLE ROW LEVEL SECURITY;
ALTER TABLE chat_participants DISABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE chat_reactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE chat_ai_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE chat_ai_settings DISABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────
-- Realtime 対応
-- ─────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE chat_conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE chat_participants;
