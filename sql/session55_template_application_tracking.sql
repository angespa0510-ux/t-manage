-- セッション55: テンプレート適用履歴の紐付け
--
-- 目的: 「どのセラピスト（またはスタッフ）にどのバージョンの書類テンプレートを渡したか」を
--       記録できるようにする。テンプレートが更新された際に「未更新者一覧」を
--       一覧化できる基盤を作る。
--
-- 紐付けの入口は2つ:
--   1. contracts テーブル（既存の契約書アップロードフロー）
--   2. document_deliveries テーブル（今回追加済みの一括配信ログ）
--
-- どちらも document_template_id / document_template_version_id を持つ構造にして、
-- 後で UNION でまとめて「適用履歴」として集計できるようにする。

-- contracts テーブルにFK列を追加
ALTER TABLE contracts
  ADD COLUMN IF NOT EXISTS document_template_id bigint REFERENCES document_templates(id) ON DELETE SET NULL;
ALTER TABLE contracts
  ADD COLUMN IF NOT EXISTS document_template_version_id bigint REFERENCES document_template_versions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_contracts_template_id ON contracts(document_template_id);
CREATE INDEX IF NOT EXISTS idx_contracts_template_version_id ON contracts(document_template_version_id);

-- 備考:
--   document_deliveries テーブルには session54 で既に
--   document_template_id / document_template_version_id 列を追加済み。
--   今回の変更によりアプリ側から UNION ALL で両テーブルを統合して
--   テンプレ別の適用状況を取得できるようになる。
--
-- 想定クエリ例（アプリ側で実行）:
--   SELECT recipient_kind, recipient_id, recipient_name,
--          document_template_id, document_template_version_id, applied_at
--   FROM (
--     SELECT 'therapist' AS recipient_kind, therapist_id AS recipient_id,
--            signer_name AS recipient_name, document_template_id,
--            document_template_version_id, signed_at AS applied_at
--     FROM contracts
--     WHERE status = 'signed' AND document_template_id IS NOT NULL
--     UNION ALL
--     SELECT recipient_kind, recipient_id, recipient_name,
--            document_template_id, document_template_version_id,
--            delivered_at AS applied_at
--     FROM document_deliveries
--     WHERE status = 'sent' AND document_template_id IS NOT NULL
--   ) AS applied
--   ORDER BY applied_at DESC;
