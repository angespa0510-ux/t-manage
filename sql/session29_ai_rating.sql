-- Session 29: AI回答評価機能
-- manual_ai_logsにratingカラム追加 (NULL=未評価, 1=良い, -1=悪い)
ALTER TABLE manual_ai_logs ADD COLUMN IF NOT EXISTS rating smallint DEFAULT NULL;

-- UPDATEポリシー追加
CREATE POLICY "manual_ai_logs_update" ON manual_ai_logs FOR UPDATE USING (true);
