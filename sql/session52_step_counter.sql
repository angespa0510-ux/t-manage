-- セッション52: 歩数計・ウォーキングポイント
-- 2026-04-20

-- 方針: Google Fit REST API は2026年末廃止のため使わず、
-- iOS ショートカット / LINE Bot / 手動送信 ベースの設計とする
-- サーバー側で受信・検証・ポイント付与を行う

-- 1. 端末連携トークン管理 (ショートカット認証用)
CREATE TABLE IF NOT EXISTS customer_step_tokens (
  customer_id bigint PRIMARY KEY,
  -- ショートカット用の簡易トークン (推測困難な文字列)
  shortcut_token text UNIQUE NOT NULL,
  -- 連携してる端末の種類
  source_hint text DEFAULT 'ios_shortcut',  -- 'ios_shortcut' | 'line_bot' | 'manual' | 'fitbit' | 'garmin'
  connected_at timestamptz DEFAULT now(),
  last_used_at timestamptz,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE customer_step_tokens DISABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_step_tokens_shortcut ON customer_step_tokens(shortcut_token) WHERE is_active = true;

-- 2. 日次歩数ログ
CREATE TABLE IF NOT EXISTS customer_step_logs (
  id bigserial PRIMARY KEY,
  customer_id bigint NOT NULL,
  log_date date NOT NULL,
  steps int NOT NULL,
  source text NOT NULL,                   -- 'ios_shortcut' | 'line_bot' | 'manual' | 'screenshot' | 'fitbit' | 'garmin'
  -- 不正対策フラグ
  verified boolean DEFAULT true,          -- 検証済み (false なら手動レビュー待ち)
  flagged_reason text,                    -- 異常値検出理由 (例: "1時間6000歩超")
  -- ポイント付与情報
  points_awarded int DEFAULT 0,           -- 実際に付与した pt
  bonus_pt int DEFAULT 0,                 -- 連続達成等のボーナス
  points_transaction_id bigint,           -- customer_points.id への参照
  raw_data jsonb,                         -- Google Fit 等の元データ (デバッグ用)
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(customer_id, log_date)
);
ALTER TABLE customer_step_logs DISABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_step_logs_customer_date ON customer_step_logs(customer_id, log_date DESC);
CREATE INDEX IF NOT EXISTS idx_step_logs_date ON customer_step_logs(log_date DESC);
CREATE INDEX IF NOT EXISTS idx_step_logs_flagged ON customer_step_logs(verified) WHERE verified = false;

-- 3. 顧客ごとの連続達成・累計統計 (高速取得用)
CREATE TABLE IF NOT EXISTS customer_step_stats (
  customer_id bigint PRIMARY KEY,
  -- 現在の連続達成 (8000歩以上をカウント)
  current_streak int DEFAULT 0,
  longest_streak int DEFAULT 0,
  streak_started_at date,
  last_qualifying_date date,              -- 最後に8000歩を達成した日
  -- 今月の累計
  total_steps_month int DEFAULT 0,
  total_pt_month int DEFAULT 0,
  month_key text,                         -- '2026-04' 形式、変わったらリセット
  -- 歴代記録
  total_steps_all_time bigint DEFAULT 0,
  total_pt_all_time int DEFAULT 0,
  max_steps_in_day int DEFAULT 0,
  max_steps_date date,
  -- バッジ獲得状況
  earned_badges text[] DEFAULT '{}',      -- ['streak_7', 'streak_30', 'month_100k']
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE customer_step_stats DISABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_step_stats_month_pt ON customer_step_stats(month_key, total_pt_month DESC);
CREATE INDEX IF NOT EXISTS idx_step_stats_streak ON customer_step_stats(current_streak DESC);

-- 4. 歩数ポイントのルール設定 (管理画面から編集可能にする)
CREATE TABLE IF NOT EXISTS step_point_rules (
  id bigserial PRIMARY KEY,
  -- 階段式 pt テーブル
  threshold_3000 int DEFAULT 10,
  threshold_5000 int DEFAULT 20,
  threshold_8000 int DEFAULT 40,
  threshold_10000 int DEFAULT 60,
  threshold_15000 int DEFAULT 80,
  -- 連続達成ボーナス
  bonus_3days int DEFAULT 30,
  bonus_7days int DEFAULT 100,
  bonus_30days int DEFAULT 500,
  bonus_100days int DEFAULT 2000,
  -- 上限
  max_pt_per_day int DEFAULT 80,
  max_pt_per_month int DEFAULT 1000,
  -- 整合性チェック
  max_steps_per_day int DEFAULT 25000,    -- これ以上は無効
  max_steps_per_hour int DEFAULT 6000,    -- 警告フラグ
  -- 連続達成の基準歩数
  streak_threshold int DEFAULT 8000,
  -- 機能ON/OFF
  is_active boolean DEFAULT true,
  -- 有効期限 (customer_points と同じ扱い)
  expiry_months int DEFAULT 12,
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE step_point_rules DISABLE ROW LEVEL SECURITY;

-- 初期データ投入 (存在しない場合のみ)
INSERT INTO step_point_rules (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE customer_step_tokens IS '歩数連携の認証トークン (iOS ショートカット / LINE Bot 用)';
COMMENT ON TABLE customer_step_logs IS '顧客の日次歩数ログ (不正対策含む)';
COMMENT ON TABLE customer_step_stats IS '顧客ごとの連続達成・累計統計 (集計高速化)';
COMMENT ON TABLE step_point_rules IS '歩数ポイントの付与ルール (管理画面から編集)';
