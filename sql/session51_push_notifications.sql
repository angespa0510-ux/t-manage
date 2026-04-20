-- セッション51: PWA プッシュ通知基盤
-- 2026-04-20

-- 1. プッシュ通知サブスクリプション管理
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id bigserial PRIMARY KEY,
  user_type text NOT NULL,                -- 'customer' | 'therapist' | 'staff'
  user_id bigint NOT NULL,
  endpoint text NOT NULL,                 -- プッシュサービスのエンドポイントURL
  p256dh text NOT NULL,                   -- 暗号化用公開鍵
  auth text NOT NULL,                     -- 認証シークレット
  device_info text DEFAULT '',            -- "iPhone Safari 17.0" 等 (UA由来)
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  last_used_at timestamptz,
  -- 同じデバイスの重複登録を防ぐ
  UNIQUE(user_type, user_id, endpoint)
);
ALTER TABLE push_subscriptions DISABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_push_subs_user ON push_subscriptions(user_type, user_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_push_subs_active ON push_subscriptions(is_active);

-- 2. プッシュ通知送信ログ (エラー追跡・統計用)
CREATE TABLE IF NOT EXISTS push_send_logs (
  id bigserial PRIMARY KEY,
  subscription_id bigint,                 -- push_subscriptions.id (削除時も履歴は残す)
  user_type text,
  user_id bigint,
  title text,
  body text,
  url text,
  status text NOT NULL,                   -- 'sent' | 'failed' | 'expired'
  error_message text,
  sent_at timestamptz DEFAULT now()
);
ALTER TABLE push_send_logs DISABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_push_send_logs_date ON push_send_logs(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_push_send_logs_user ON push_send_logs(user_type, user_id);
CREATE INDEX IF NOT EXISTS idx_push_send_logs_status ON push_send_logs(status);

COMMENT ON TABLE push_subscriptions IS 'PWA プッシュ通知のサブスクリプション情報';
COMMENT ON TABLE push_send_logs IS 'プッシュ通知送信の履歴・エラーログ';
