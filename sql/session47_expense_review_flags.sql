-- Session 47: 経費に「要確認」フラグを追加
-- 税理士ポータル「💸 経費」シートで、税理士が気になる経費に要確認マークを付けられるように

ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS needs_review BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS review_note TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS flagged_by_name TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS flagged_at TIMESTAMPTZ;

-- 要確認のみをすばやく抽出できるように部分インデックス
CREATE INDEX IF NOT EXISTS idx_expenses_needs_review
  ON expenses(needs_review)
  WHERE needs_review = TRUE;

-- RLS は既存方針どおり無効化
ALTER TABLE expenses DISABLE ROW LEVEL SECURITY;
