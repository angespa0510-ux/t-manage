-- =====================================================
-- Session 58: 通話AI Phase 1 基盤（call_transcripts）
-- =====================================================
-- 通話の音声文字起こし・AI分析結果を保存するテーブル
-- 個人情報保護のため、音声ファイルは保存せず、テキストのみ90日保持
-- =====================================================

CREATE TABLE IF NOT EXISTS call_transcripts (
  id bigserial PRIMARY KEY,

  -- 通話基本情報
  staff_id bigint,                       -- 対応スタッフID
  staff_name text DEFAULT '',            -- スタッフ名（表示用）
  customer_id bigint,                    -- 顧客ID（特定できた場合）
  customer_name text DEFAULT '',         -- 顧客名（通話から抽出 or DB）
  phone_number text DEFAULT '',          -- 電話番号

  -- 時間情報
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  duration_sec int DEFAULT 0,            -- 通話時間（秒）

  -- 文字起こしテキスト
  transcript_full text DEFAULT '',       -- 通話全体の最終文字起こし
  transcript_chunks jsonb,               -- 30秒チャンクごとの文字起こし履歴 [{at, text}, ...]

  -- AI分析結果（Phase 2以降で使用）
  ai_summary text DEFAULT '',            -- 通話サマリー
  ai_extracted jsonb,                    -- 抽出情報 {customer_name, phone, date_time, course, ...}
  ai_intent text DEFAULT '',             -- 通話意図（予約/問合せ/クレーム/キャンセル/その他）
  ai_sentiment text DEFAULT '',          -- 感情分析結果（positive/neutral/negative）
  ai_warnings jsonb,                     -- AIが検出した注意点 ["確認忘れ:電話番号", ...]

  -- モデル使用情報
  ai_model_used text DEFAULT 'sonnet-4-6',  -- 使用した標準モデル
  escalated_to_opus boolean DEFAULT false,  -- Opusエスカレーションが発生したか
  escalation_reason text DEFAULT '',        -- エスカレーション理由

  -- 予約連携
  created_reservation_id bigint,         -- この通話から作成された予約のID

  -- メタ情報
  tags text[] DEFAULT '{}',              -- タグ（新規/リピート/VIP/クレーム等）
  note text DEFAULT '',                  -- スタッフメモ
  recording_reason text DEFAULT 'manual', -- 録音理由（manual/new_customer/auto/...）

  -- タイムスタンプ
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  -- 自動削除（90日後）
  expires_at timestamptz DEFAULT (now() + interval '90 days')
);

-- RLS無効化（T-MANAGE方針）
ALTER TABLE call_transcripts DISABLE ROW LEVEL SECURITY;

-- インデックス
CREATE INDEX IF NOT EXISTS idx_call_transcripts_started_at 
  ON call_transcripts(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_call_transcripts_customer 
  ON call_transcripts(customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_call_transcripts_phone 
  ON call_transcripts(phone_number) WHERE phone_number <> '';
CREATE INDEX IF NOT EXISTS idx_call_transcripts_expires 
  ON call_transcripts(expires_at);
CREATE INDEX IF NOT EXISTS idx_call_transcripts_staff 
  ON call_transcripts(staff_id) WHERE staff_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_call_transcripts_intent 
  ON call_transcripts(ai_intent) WHERE ai_intent <> '';


-- =====================================================
-- call_ai_settings テーブル
-- 録音対象や予算上限を管理
-- =====================================================

CREATE TABLE IF NOT EXISTS call_ai_settings (
  id bigserial PRIMARY KEY,

  -- 録音対象の条件（ON/OFF）
  record_new_customer boolean DEFAULT true,       -- 新規顧客
  record_repeat_2_3 boolean DEFAULT false,        -- リピーター（2〜3回目）
  record_regular boolean DEFAULT false,           -- 常連様（4回以上）
  record_manual_only boolean DEFAULT true,        -- 手動録音ボタン
  record_new_staff boolean DEFAULT false,         -- 新人スタッフ対応時

  -- Opusエスカレーション条件
  escalate_on_claim boolean DEFAULT true,         -- クレームキーワード検知
  escalate_on_long_call boolean DEFAULT true,     -- 10分以上の通話
  escalate_on_negative boolean DEFAULT true,      -- 感情「怒り」検知
  escalate_on_vip boolean DEFAULT false,          -- VIP顧客（常時）
  escalate_on_blacklist boolean DEFAULT true,     -- ブラックリスト顧客

  -- AIモデル設定
  default_model text DEFAULT 'sonnet-4-6',        -- 標準モデル
  escalation_model text DEFAULT 'opus-4-7',       -- エスカレーション先モデル

  -- 予算制限
  monthly_budget_jpy int DEFAULT 3000,            -- 月間予算上限（円）
  daily_limit_count int DEFAULT 100,              -- 1日の録音件数上限
  max_duration_sec int DEFAULT 900,               -- 1通話の最大録音時間（15分）

  -- 長期保存設定
  retention_days int DEFAULT 90,                  -- テキスト保存期間（日）

  -- 全体ON/OFF
  enabled boolean DEFAULT false,                  -- 機能全体の有効化

  -- メタ情報
  updated_at timestamptz DEFAULT now(),
  updated_by_name text DEFAULT ''
);

ALTER TABLE call_ai_settings DISABLE ROW LEVEL SECURITY;

-- 初期レコードを1件だけ挿入（シングルトン設計）
INSERT INTO call_ai_settings (enabled) 
SELECT false 
WHERE NOT EXISTS (SELECT 1 FROM call_ai_settings);


-- =====================================================
-- call_usage_logs テーブル
-- API使用量の日次集計（予算管理用）
-- =====================================================

CREATE TABLE IF NOT EXISTS call_usage_logs (
  id bigserial PRIMARY KEY,
  usage_date date NOT NULL,
  
  -- Whisper API
  whisper_seconds int DEFAULT 0,          -- 文字起こし秒数
  whisper_cost_usd numeric(10,4) DEFAULT 0,
  
  -- Claude API（Sonnet）
  sonnet_input_tokens int DEFAULT 0,
  sonnet_output_tokens int DEFAULT 0,
  sonnet_cost_usd numeric(10,4) DEFAULT 0,
  
  -- Claude API（Opus）
  opus_input_tokens int DEFAULT 0,
  opus_output_tokens int DEFAULT 0,
  opus_cost_usd numeric(10,4) DEFAULT 0,
  
  -- 件数
  call_count int DEFAULT 0,
  escalation_count int DEFAULT 0,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(usage_date)
);

ALTER TABLE call_usage_logs DISABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_call_usage_logs_date 
  ON call_usage_logs(usage_date DESC);
