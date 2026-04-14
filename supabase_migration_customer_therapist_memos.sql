-- お客様セラピストメモテーブル
CREATE TABLE IF NOT EXISTS customer_therapist_memos (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  therapist_id INTEGER NOT NULL REFERENCES therapists(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL DEFAULT 0 CHECK (rating >= 0 AND rating <= 5),
  memo TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(customer_id, therapist_id)
);

-- RLS有効化
ALTER TABLE customer_therapist_memos ENABLE ROW LEVEL SECURITY;

-- 全員読み書き可能ポリシー（anon key用）
CREATE POLICY "Allow all for customer_therapist_memos" ON customer_therapist_memos
  FOR ALL USING (true) WITH CHECK (true);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_ctm_customer ON customer_therapist_memos(customer_id);
CREATE INDEX IF NOT EXISTS idx_ctm_therapist ON customer_therapist_memos(therapist_id);
