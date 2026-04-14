-- お客様セラピストメモテーブル（1接客ごとのメモ）
-- 既存テーブルがある場合はDROPしてから再作成
DROP TABLE IF EXISTS customer_therapist_memos;

CREATE TABLE customer_therapist_memos (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  therapist_id INTEGER NOT NULL DEFAULT 0,
  reservation_id INTEGER NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL DEFAULT 0 CHECK (rating >= 0 AND rating <= 5),
  memo TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(customer_id, reservation_id)
);

-- RLS有効化
ALTER TABLE customer_therapist_memos ENABLE ROW LEVEL SECURITY;

-- 全員読み書き可能ポリシー（anon key用）
CREATE POLICY "Allow all for customer_therapist_memos" ON customer_therapist_memos
  FOR ALL USING (true) WITH CHECK (true);

-- インデックス
CREATE INDEX idx_ctm_customer ON customer_therapist_memos(customer_id);
CREATE INDEX idx_ctm_therapist ON customer_therapist_memos(therapist_id);
CREATE INDEX idx_ctm_reservation ON customer_therapist_memos(reservation_id);
