-- Session 48: 書類庫に対象者フィールドを追加
-- 生命保険料控除証明書・ふるさと納税受領証明書など、
-- 個人の書類の所有者を明確化するため。

ALTER TABLE tax_documents
  ADD COLUMN IF NOT EXISTS target_person_name TEXT DEFAULT '';

-- 対象者でフィルタできるようインデックス追加
CREATE INDEX IF NOT EXISTS idx_tax_documents_target_person
  ON tax_documents(target_person_name)
  WHERE target_person_name IS NOT NULL AND target_person_name != '';

-- RLS は既存方針どおり無効化
ALTER TABLE tax_documents DISABLE ROW LEVEL SECURITY;
