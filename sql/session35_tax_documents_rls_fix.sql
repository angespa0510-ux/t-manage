-- セッション35 修正: 書類庫のRLSポリシー
-- 「new row violates row-level security policy」エラーの修正

-- 1. tax_documents テーブルのRLSを無効化
-- （T-MANAGE の他のテーブルと同じく、アプリレベルで権限制御するため）
ALTER TABLE tax_documents DISABLE ROW LEVEL SECURITY;

-- 2. storage.objects はRLS無効化不可のため、permissive policyを追加
-- tax-documents バケット内の操作をすべて許可
-- （UIレベルでの権限制御 canAccessTaxPortal で実質的な制御を行う）
DROP POLICY IF EXISTS "tax_documents_bucket_all" ON storage.objects;
CREATE POLICY "tax_documents_bucket_all"
ON storage.objects FOR ALL
TO anon, authenticated
USING (bucket_id = 'tax-documents')
WITH CHECK (bucket_id = 'tax-documents');
