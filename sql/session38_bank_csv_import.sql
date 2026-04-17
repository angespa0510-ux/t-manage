-- セッション38: 税理士ポータル Phase 3A 銀行CSV取込（PayPay銀行対応）

-- 1. 銀行取引明細テーブル
CREATE TABLE IF NOT EXISTS bank_transactions (
  id bigserial PRIMARY KEY,
  transaction_date date NOT NULL,
  transaction_time text DEFAULT '',     -- HH:MM:SS
  order_no text DEFAULT '',              -- 取引順番号
  description text NOT NULL,             -- 摘要
  debit_amount bigint DEFAULT 0,         -- お支払金額 (出金)
  credit_amount bigint DEFAULT 0,        -- お預り金額 (入金)
  balance bigint DEFAULT 0,              -- 残高
  memo text DEFAULT '',
  account_category text DEFAULT 'other', -- expenses.category に連動 (rent/utilities/supplies/transport/advertising/therapist_back/income/other)
  account_label text DEFAULT '',         -- 表示用科目名
  is_expense boolean DEFAULT true,       -- true=経費, false=売上入金
  is_confirmed boolean DEFAULT false,    -- expenses に登録済み
  confirmed_expense_id bigint,           -- 登録後の expenses.id
  imported_at timestamptz DEFAULT now(),
  imported_by_name text DEFAULT '',
  UNIQUE(transaction_date, order_no, description, debit_amount, credit_amount)
);

CREATE INDEX IF NOT EXISTS idx_bank_transactions_date ON bank_transactions(transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_confirmed ON bank_transactions(is_confirmed);

-- 2. 摘要→勘定科目ルール学習テーブル
CREATE TABLE IF NOT EXISTS bank_category_rules (
  id bigserial PRIMARY KEY,
  pattern text NOT NULL,                 -- 摘要に含まれる文字列
  account_category text NOT NULL,        -- expenses.category
  account_label text DEFAULT '',
  is_expense boolean DEFAULT true,
  priority int DEFAULT 0,                -- 高い方が優先
  hit_count int DEFAULT 0,
  created_by_name text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bank_category_rules_priority ON bank_category_rules(priority DESC);

-- RLS無効化
ALTER TABLE bank_transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE bank_category_rules DISABLE ROW LEVEL SECURITY;

-- 3. 初期ルール投入 (PayPay銀行の典型パターン)
INSERT INTO bank_category_rules (pattern, account_category, account_label, is_expense, priority, created_by_name) VALUES
  ('振込手数料', 'other', '支払手数料', true, 100, 'system'),
  ('決算お利息', 'other', '受取利息', false, 100, 'system'),
  ('三井住友ＡＴＭ', 'income', '売上入金（現金預入）', false, 90, 'system'),
  ('マイコ−ト', 'rent', '地代家賃', true, 90, 'system'),
  ('マイコート', 'rent', '地代家賃', true, 90, 'system'),
  ('オアシス', 'rent', '地代家賃', true, 80, 'system'),
  ('Amazon', 'supplies', '消耗品費（Amazon）', true, 70, 'system'),
  ('ＡＭＡＺＯＮ', 'supplies', '消耗品費（Amazon）', true, 70, 'system'),
  ('ＡＭＡＺＯＮ．ＣＯ．ＪＰ', 'supplies', '消耗品費（Amazon）', true, 75, 'system'),
  ('楽天', 'supplies', '消耗品費（楽天）', true, 70, 'system'),
  ('ﾗｸﾃﾝ', 'supplies', '消耗品費（楽天）', true, 70, 'system'),
  ('Google', 'other', '通信費（Google）', true, 70, 'system'),
  ('ＧＯＯＧＬＥ', 'other', '通信費（Google）', true, 70, 'system'),
  ('エステタマシイ', 'supplies', '消耗品費（施術用品）', true, 70, 'system'),
  ('ｴｽﾃﾀﾏｼｲ', 'supplies', '消耗品費（施術用品）', true, 70, 'system'),
  ('オフイスメデイア', 'advertising', '広告宣伝費', true, 60, 'system'),
  ('オフィスメディア', 'advertising', '広告宣伝費', true, 60, 'system'),
  ('ケースバイケース', 'advertising', '広告宣伝費', true, 60, 'system'),
  ('ｹ-ｽﾊﾞｲｹ-ｽ', 'advertising', '広告宣伝費', true, 60, 'system'),
  ('リングコーポレーション', 'advertising', '広告宣伝費', true, 60, 'system'),
  ('ﾘﾝｸﾞｺ-ﾎﾟﾚ-ｼﾖﾝ', 'advertising', '広告宣伝費', true, 60, 'system'),
  ('リングコ−ポレ−シヨン', 'advertising', '広告宣伝費', true, 60, 'system')
ON CONFLICT DO NOTHING;
