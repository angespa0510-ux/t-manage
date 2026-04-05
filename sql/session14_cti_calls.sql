-- =====================================================
-- T-MANAGE CTI テーブル（セッション⑭）
-- Supabase SQL Editor で実行してください
-- =====================================================

-- 着信記録テーブル
CREATE TABLE IF NOT EXISTS cti_calls (
  id SERIAL PRIMARY KEY,
  phone TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  handled BOOLEAN DEFAULT false
);

-- インデックス（電話番号検索用）
CREATE INDEX IF NOT EXISTS idx_cti_calls_phone ON cti_calls (phone);
CREATE INDEX IF NOT EXISTS idx_cti_calls_created ON cti_calls (created_at DESC);

-- RLSポリシー（MacroDroid/アプリからのINSERT許可）
ALTER TABLE cti_calls ENABLE ROW LEVEL SECURITY;

-- anonロールからのINSERTを許可（Androidアプリ用）
CREATE POLICY "Allow anon insert" ON cti_calls
  FOR INSERT TO anon WITH CHECK (true);

-- authenticatedロールからの全操作を許可（T-MANAGE PC用）
CREATE POLICY "Allow authenticated all" ON cti_calls
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- anonロールからのSELECTも許可（Realtimeサブスクリプション用）
CREATE POLICY "Allow anon select" ON cti_calls
  FOR SELECT TO anon USING (true);

-- Realtime有効化（重要！）
ALTER PUBLICATION supabase_realtime ADD TABLE cti_calls;

-- 古いログの自動クリーン用（30日以上前のデータを削除するcronは任意）
-- ※ 手動で定期的に DELETE FROM cti_calls WHERE created_at < NOW() - INTERVAL '30 days' でもOK
