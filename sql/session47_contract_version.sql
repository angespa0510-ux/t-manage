-- ======================================================================
-- session47: 契約書バージョン記録
-- ======================================================================
-- 目的:
--   セラピストがどの版の業務委託契約書に同意したかを追跡するため、
--   contracts テーブルに contract_version カラムを追加する。
--
-- バージョン運用ルール:
--   v1.0 = 6条版(株式会社アンジュスパ表記) ... 過去データは NULL
--   v2.0 = 12条版(合同会社テラスライフ / Ange Spa表記 / 電子署名完結) ← 現行版
--   以後、契約書を改訂するたびにインクリメント
-- ======================================================================

ALTER TABLE contracts ADD COLUMN IF NOT EXISTS contract_version text;

COMMENT ON COLUMN contracts.contract_version IS '同意した契約書の版 (例: v2.0)。過去データで NULL の場合は v1.0(6条版)とみなす';

-- 既存の署名済みレコードは v1.0 として明示的に記録
UPDATE contracts SET contract_version = 'v1.0' WHERE status = 'signed' AND contract_version IS NULL;

-- RLS はこれまで通り (session29 で既に設定済み)
