-- IoT操作ログテーブル
-- スマートロック操作やカメラ操作の履歴を記録
CREATE TABLE IF NOT EXISTS iot_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  device_type text NOT NULL,          -- 'lock', 'camera'
  device_id text,                      -- SwitchBot device ID
  action text NOT NULL,                -- 'lock', 'unlock', 'record_start', 'record_stop'
  result text DEFAULT 'success',       -- 'success', 'error'
  detail jsonb,                        -- API response etc.
  created_at timestamptz DEFAULT now()
);

-- RLSポリシー
ALTER TABLE iot_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "iot_logs_all" ON iot_logs FOR ALL USING (true);

-- インデックス
CREATE INDEX idx_iot_logs_created ON iot_logs(created_at DESC);
CREATE INDEX idx_iot_logs_device ON iot_logs(device_type, created_at DESC);
