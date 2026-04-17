-- セッション43: 資金管理ダッシュボード向け ATM預入記録テーブル
-- 管理者金庫 → PayPay銀行への現金預入を記録

CREATE TABLE IF NOT EXISTS atm_deposits (
  id bigserial PRIMARY KEY,
  deposit_date date NOT NULL,             -- ATM預入日
  amount bigint NOT NULL,                 -- 預入額
  note text DEFAULT '',
  recorded_by_name text DEFAULT '',       -- 記録者名
  created_at timestamptz DEFAULT now(),
  -- 銀行取込との照合
  bank_verified boolean DEFAULT false,    -- 銀行側で確認できたか
  bank_verified_transaction_id bigint,    -- 対応する bank_transactions.id
  bank_verified_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_atm_deposits_date ON atm_deposits(deposit_date DESC);
CREATE INDEX IF NOT EXISTS idx_atm_deposits_verified ON atm_deposits(bank_verified);

ALTER TABLE atm_deposits DISABLE ROW LEVEL SECURITY;

-- 備考:
-- 資金管理ダッシュボードで「🏦 ATM預入を記録」ボタンから入力される
-- 銀行CSV取込時に、同日・同額の「三井住友ＡＴＭ」入金を自動マッチングして bank_verified を true にする
-- マッチング後は ダッシュボードで「✓ 銀行側で確認済み」と表示される
