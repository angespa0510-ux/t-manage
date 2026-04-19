-- ======================================================================
-- session48: スタッフ前借り管理機能
-- ======================================================================
-- 目的:
--   業務委託スタッフへの日次前借り(通常 ¥3,000)を記録し、月末に外注費へ
--   自動振替する仕組み。
--
-- 運用:
--   - 前借り時: staff_advances に pending で insert
--     管理者金庫(cash-dashboard)の officeCashBalance から控除される
--   - 月末自動精算: 毎月第1月曜 12:00 以降のアクセス時に
--     前月分の pending → settled に更新し、
--     同時に expenses へ「スタッフ前借り精算」として自動計上
--   - settled 後は expenses 経由で管理者金庫の計算に反映される
--     → pending 控除と expense 控除が入れ替わるだけなので金庫残高は不変
--
-- 前提:
--   - settlements ではなく staff_schedules が対象 (業務委託スタッフ用)
--   - staff.advance_preset_amount が NULL/0 のスタッフは前借り対象外
-- ======================================================================

-- 前借り履歴テーブル
CREATE TABLE IF NOT EXISTS staff_advances (
  id bigserial PRIMARY KEY,
  staff_id bigint NOT NULL REFERENCES staff(id),
  advance_date date NOT NULL,                  -- 前借り日 (稼働日)
  amount bigint NOT NULL,                      -- 前借り金額
  reason text DEFAULT '',                      -- 任意メモ
  status text DEFAULT 'pending',               -- 'pending' | 'settled'
  settled_month text,                          -- "2026-05" 形式の精算月
  settled_at timestamptz,                      -- 自動精算時刻
  settled_expense_id bigint,                   -- 対応する expenses レコード ID
  recorded_by_name text DEFAULT '',            -- 記録したスタッフ名
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_staff_advances_staff_id ON staff_advances(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_advances_date ON staff_advances(advance_date DESC);
CREATE INDEX IF NOT EXISTS idx_staff_advances_status ON staff_advances(status);
CREATE INDEX IF NOT EXISTS idx_staff_advances_pending ON staff_advances(status) WHERE status = 'pending';

ALTER TABLE staff_advances DISABLE ROW LEVEL SECURITY;

COMMENT ON TABLE staff_advances IS 'スタッフ前借り履歴。月末第1月曜12時以降に自動精算。';
COMMENT ON COLUMN staff_advances.status IS 'pending=金庫から控除中 / settled=月末振替済み(expenses参照) / skipped=当日なし(履歴用)';
COMMENT ON COLUMN staff_advances.settled_expense_id IS '月末精算時に自動生成された expenses.id';

-- staff テーブルに前借りプリセット金額カラム
-- NULL or 0 の場合は「前借り対象外」として扱う
ALTER TABLE staff ADD COLUMN IF NOT EXISTS advance_preset_amount bigint;

COMMENT ON COLUMN staff.advance_preset_amount IS '前借りデフォルト額。NULL/0=前借り対象外';

-- expenses テーブルに自動生成フラグ (手動削除防止のため)
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS auto_generated boolean DEFAULT false;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS auto_source text;  -- 'staff_advance_settlement' など

COMMENT ON COLUMN expenses.auto_generated IS 'システム自動生成されたレコード。編集・削除は社長/経営責任者のみ';
COMMENT ON COLUMN expenses.auto_source IS '自動生成元の識別子';

CREATE INDEX IF NOT EXISTS idx_expenses_auto_generated ON expenses(auto_generated) WHERE auto_generated = true;
