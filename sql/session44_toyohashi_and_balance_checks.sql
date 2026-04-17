-- セッション44: 豊橋予備金 + 金庫残高確認機能追加

-- 1. 豊橋予備金の取引履歴
CREATE TABLE IF NOT EXISTS toyohashi_reserve_movements (
  id bigserial PRIMARY KEY,
  movement_date date NOT NULL,
  movement_type text NOT NULL,          -- 'withdraw'(立替) / 'refund'(補充) / 'initial'(初期残高) / 'adjustment'(棚卸調整)
  amount bigint NOT NULL,                -- 金額（常に正の数で記録、movement_typeで方向判定）
  therapist_id bigint,                   -- withdraw時のセラピスト
  recorded_by_name text DEFAULT '',
  note text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_toyohashi_reserve_date ON toyohashi_reserve_movements(movement_date DESC);
CREATE INDEX IF NOT EXISTS idx_toyohashi_reserve_type ON toyohashi_reserve_movements(movement_type);
CREATE INDEX IF NOT EXISTS idx_toyohashi_reserve_therapist ON toyohashi_reserve_movements(therapist_id);

-- 2. 金庫残高確認記録（実測値）
CREATE TABLE IF NOT EXISTS cash_balance_checks (
  id bigserial PRIMARY KEY,
  check_date date NOT NULL,
  manager_safe_actual bigint,            -- 管理者金庫の実測値（NULLなら未入力）
  staff_safe_actual bigint,              -- スタッフ金庫の実測値
  toyohashi_reserve_actual bigint,       -- 豊橋予備金の実測値
  checked_by_name text DEFAULT '',
  note text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cash_balance_checks_date ON cash_balance_checks(check_date DESC);

-- RLS無効化
ALTER TABLE toyohashi_reserve_movements DISABLE ROW LEVEL SECURITY;
ALTER TABLE cash_balance_checks DISABLE ROW LEVEL SECURITY;

-- 備考:
-- 豊橋予備金は立替専用の第4の財布。基本残高は一定。
-- 運用フロー:
--   1. 管理者が「🏛 立替を記録」で withdraw エントリ追加
--   2. 後日、スタッフ金庫から補充した時に「🏛 補充を記録」で refund エントリ追加
--   3. withdraw と refund は別日でOK（同日に完結しなくていい）
--   4. 豊橋予備金残高 = 全 refund - 全 withdraw + 初期残高 (+ 棚卸調整)
-- 
-- 金庫残高確認は3金庫を一括で確認する仕組みだが、入力必須は1つだけでOK。
-- 当日確認しなかった金庫は NULL で保存される。
