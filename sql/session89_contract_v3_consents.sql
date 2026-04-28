-- Session 89: 業務委託契約書 v3.0 (施術業対応版 / 仕様書 v2) — 個別条項同意フラグ
-- 仕様書: docs/22_CONTRACT_REDESIGN.md
-- 関連メモ: docs/21_TREATMENT_BUSINESS_POSITIONING.md
-- 作成: 2026-04-28
--
-- 背景:
--   税務上「施術業」として一貫したポジショニングを取るため、
--   契約書 v3.0 では下記の条項を新設・強化した。
--     第5条  禁止事項に酒類・同伴・アフター・店外接触を明文化
--     第10条 施術技術研修の受講義務 (新設)
--     第11条 施術カルテ記録義務     (新設)
--     第3条  源泉徴収なしの根拠と確定申告責任を明記
--
--   このうち税務調査での実態証跡として最も重要な以下4条項について、
--   セラピストの個別同意フラグを別テーブルで保持する。
--
-- バージョン整理:
--   - DB の contracts.contract_version カラム
--       v1.0  : 6条版 (株式会社アンジュスパ表記、初期版)
--       v2.0  : 12条版 (合同会社テラスライフ、現行)
--       v3.0  : 18条版 (施術業対応版、本セッション追加)  ← この同意テーブルが紐づく
--   - 仕様書上の呼称
--       v1    : 既存契約者署名済 (= DB v1.0 / v2.0)
--       v2    : 施術業対応版      (= DB v3.0)
--   テーブル名は仕様書の呼称に合わせ contracts_v2_consents としている。
--
-- 弁護士レビュー: 未実施 (2026-04-28 時点)
-- 公開フロー   : ?preview=v3 クエリ時のみ v3 ドラフトを表示。
--                レビュー完了後、page.tsx の DEFAULT_VERSION を v3 に切替。

CREATE TABLE IF NOT EXISTS contracts_v2_consents (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  contract_id bigint REFERENCES contracts(id) ON DELETE CASCADE,

  -- 第10条 施術技術の研修受講義務
  consent_research_training boolean NOT NULL DEFAULT false,

  -- 第11条 施術カルテの記録義務
  consent_chart_record boolean NOT NULL DEFAULT false,

  -- 第5条第3項 店舗内での酒類提供・飲酒の禁止
  consent_no_alcohol boolean NOT NULL DEFAULT false,

  -- 第5条第4-5項 店外飲食・同伴・アフター・私的連絡の禁止
  consent_no_outside_contact boolean NOT NULL DEFAULT false,

  agreed_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS contracts_v2_consents_contract_id_idx
  ON contracts_v2_consents(contract_id);

-- RLS: 現行 contracts テーブルと同じく全許可で運用 (token 認証で保護)
ALTER TABLE contracts_v2_consents DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "contracts_v2_consents_all" ON contracts_v2_consents;
CREATE POLICY "contracts_v2_consents_all" ON contracts_v2_consents
  FOR ALL USING (true) WITH CHECK (true);

COMMENT ON TABLE contracts_v2_consents IS
  '業務委託契約書 v3.0 (施術業対応版) の個別条項同意フラグ。docs/22_CONTRACT_REDESIGN.md 参照。';
COMMENT ON COLUMN contracts_v2_consents.consent_research_training IS '第10条: 施術技術研修の受講義務に同意';
COMMENT ON COLUMN contracts_v2_consents.consent_chart_record IS '第11条: 施術カルテの記録義務に同意';
COMMENT ON COLUMN contracts_v2_consents.consent_no_alcohol IS '第5条: 店内飲酒禁止に同意';
COMMENT ON COLUMN contracts_v2_consents.consent_no_outside_contact IS '第5条: 店外接触・同伴・アフター禁止に同意';
