-- セッション35: 税理士ポータル Phase 2B-1 書類庫
-- tax_documents テーブル + Storage バケット作成

-- 1. 税務書類メタデータテーブル
CREATE TABLE IF NOT EXISTS tax_documents (
  id bigserial PRIMARY KEY,
  category text NOT NULL, -- 決算書/申告書/契約書/固定資産/その他
  file_name text NOT NULL,
  file_url text,
  file_path text, -- Storage内のパス（削除用）
  file_size bigint DEFAULT 0,
  fiscal_period text DEFAULT '', -- 第3期、第2期、全期共通など
  uploaded_by_id bigint,
  uploaded_by_name text DEFAULT '',
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tax_documents_category ON tax_documents(category);
CREATE INDEX IF NOT EXISTS idx_tax_documents_fiscal_period ON tax_documents(fiscal_period);
CREATE INDEX IF NOT EXISTS idx_tax_documents_created_at ON tax_documents(created_at DESC);

-- 2. Storageバケット作成（非公開・署名付きURL方式）
INSERT INTO storage.buckets (id, name, public)
VALUES ('tax-documents', 'tax-documents', true)
ON CONFLICT (id) DO NOTHING;

-- 備考:
-- UIからのアクセス制御（canAccessTaxPortal）により、
-- 社長・経営責任者・税理士のみがアップロード/閲覧可能。
-- ファイル名はUUIDでランダム化されるため、URLの推測は困難。
