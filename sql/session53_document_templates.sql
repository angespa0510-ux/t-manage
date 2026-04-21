-- セッション53: 社内書類テンプレート管理
--
-- 目的: 契約書・誓約書・同意書などのテンプレートファイルを保存し、
--       バージョン管理できるようにする。「どのバージョンの書類を
--       誰に渡したか」を将来トレースできる基盤も兼ねる。
--
-- 構成:
--   - document_templates: テンプレート本体（名前・カテゴリ・対象者）
--   - document_template_versions: バージョン履歴（ファイル・変更内容・適用開始日）
--
-- 運用:
--   - 同じテンプレで複数バージョン管理（例: 業務委託契約書 v1.0 → v1.1 → v2.0）
--   - is_current = true は各テンプレで1件だけ
--   - アーカイブ済みテンプレは一覧からデフォルト非表示
--
-- Storage バケット:
--   - 'document-templates' を手動で Supabase Dashboard から作成し、
--     public フラグは false にして RLS で制御する想定。
--     （このSQLではバケット作成はしない。DashboardのStorageから実行）

-- テンプレート本体
CREATE TABLE IF NOT EXISTS document_templates (
  id bigserial PRIMARY KEY,
  name text NOT NULL,                           -- テンプレート名（業務委託契約書、誓約書など）
  category text DEFAULT 'その他',               -- 契約書 / 誓約書 / 同意書 / 業務マニュアル / その他
  description text DEFAULT '',                  -- 説明（何のための書類か）
  target_kind text DEFAULT 'therapist',         -- therapist / staff / both / vendor / customer / internal
  status text DEFAULT 'active',                 -- active / archived
  created_by_name text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- バージョン履歴
CREATE TABLE IF NOT EXISTS document_template_versions (
  id bigserial PRIMARY KEY,
  template_id bigint NOT NULL REFERENCES document_templates(id) ON DELETE CASCADE,
  version text NOT NULL,                        -- "1.0", "1.1", "2.0" 等
  file_url text DEFAULT '',                     -- Storage の public URL（signed URL でも可）
  file_path text DEFAULT '',                    -- Storage 内のパス（削除時用）
  file_name text DEFAULT '',                    -- 元ファイル名
  file_size bigint DEFAULT 0,                   -- バイト単位
  mime_type text DEFAULT '',                    -- application/pdf, etc
  change_note text DEFAULT '',                  -- 変更内容（「税率変更に対応」など）
  effective_from date,                          -- この版の適用開始日
  is_current boolean DEFAULT false,             -- 現行版フラグ（各 template_id で1件のみ true）
  uploaded_by_name text DEFAULT '',
  uploaded_at timestamptz DEFAULT now()
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_doc_templates_status ON document_templates(status);
CREATE INDEX IF NOT EXISTS idx_doc_templates_category ON document_templates(category);
CREATE INDEX IF NOT EXISTS idx_doc_templates_target_kind ON document_templates(target_kind);
CREATE INDEX IF NOT EXISTS idx_doc_versions_template_id ON document_template_versions(template_id);
CREATE INDEX IF NOT EXISTS idx_doc_versions_current ON document_template_versions(template_id, is_current) WHERE is_current = true;

-- RLS 無効化（T-MANAGE の標準方針）
ALTER TABLE document_templates DISABLE ROW LEVEL SECURITY;
ALTER TABLE document_template_versions DISABLE ROW LEVEL SECURITY;

-- updated_at 自動更新トリガー
CREATE OR REPLACE FUNCTION update_doc_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS doc_templates_updated_at_trigger ON document_templates;
CREATE TRIGGER doc_templates_updated_at_trigger
  BEFORE UPDATE ON document_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_doc_templates_updated_at();

-- 新バージョン追加時に既存の is_current を false にするトリガー
CREATE OR REPLACE FUNCTION ensure_single_current_version()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_current = true THEN
    UPDATE document_template_versions
    SET is_current = false
    WHERE template_id = NEW.template_id
      AND id != NEW.id
      AND is_current = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ensure_single_current_trigger ON document_template_versions;
CREATE TRIGGER ensure_single_current_trigger
  AFTER INSERT OR UPDATE OF is_current ON document_template_versions
  FOR EACH ROW
  EXECUTE FUNCTION ensure_single_current_version();
