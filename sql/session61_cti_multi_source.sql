-- =====================================================
-- T-MANAGE CTI マルチソース対応（セッション㉛ / 61）
-- Supabase SQL Editor で実行してください
--
-- 目的:
--   1. iPhone Beta版 CTI Bridge (Windows + Python) を追加
--   2. 将来の TERAMANAGE 外販に向けたマルチテナント下地
--   3. source 別の検出統計・漏れ推定を可能にする
-- =====================================================

-- 1. ソース識別カラム追加
--    'android'      … 既存Androidアプリ (デフォルト、旧データ用)
--    'iphone_beta'  … 新設: iPhone Beta版 (Windows Phone Link経由)
--    'twilio'       … 将来: Twilio連携版 (有料プラン、100%検出保証)
--    'manual'       … 手動テスト用
ALTER TABLE cti_calls
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'android';

-- 2. 店舗ID (将来のマルチテナント用、当面は 1 = アンジュスパ固定)
ALTER TABLE cti_calls
  ADD COLUMN IF NOT EXISTS store_id INTEGER DEFAULT 1;

-- 3. デバイス識別子 (同一店舗で複数PC運用時の切り分け用、任意)
ALTER TABLE cti_calls
  ADD COLUMN IF NOT EXISTS device_id TEXT DEFAULT '';

-- 4. エラーメモ (iPhone Beta版で名前しか取れなかった等の記録)
ALTER TABLE cti_calls
  ADD COLUMN IF NOT EXISTS raw_text TEXT DEFAULT '';

-- 5. インデックス追加
CREATE INDEX IF NOT EXISTS idx_cti_calls_source ON cti_calls (source);
CREATE INDEX IF NOT EXISTS idx_cti_calls_store ON cti_calls (store_id);

-- 6. 既存レコードはすべて android 扱い (Android CTI アプリからの着信)
UPDATE cti_calls SET source = 'android' WHERE source IS NULL;

-- 7. コメント
COMMENT ON COLUMN cti_calls.source IS
  'CTI source: android | iphone_beta | twilio | manual';
COMMENT ON COLUMN cti_calls.store_id IS
  'Store identifier for multi-tenant (TERAMANAGE)';
COMMENT ON COLUMN cti_calls.device_id IS
  'Device/PC identifier for per-device monitoring';
COMMENT ON COLUMN cti_calls.raw_text IS
  'Raw notification text (used for iphone_beta when number extraction fails)';
