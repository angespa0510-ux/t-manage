-- =====================================================
-- T-MANAGE: デュアルステータス（お客様 + セラピスト）
-- Supabase SQL Editor で実行してください
-- =====================================================

-- お客様の状態
-- unsent / web_reservation / summary_unread / summary_read / detail_unread / detail_read / serving / completed
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS customer_status TEXT DEFAULT 'unsent';

-- セラピストの状態
-- unsent / detail_sent / serving / completed
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS therapist_status TEXT DEFAULT 'unsent';

-- 既存データの移行: 旧statusからcustomer_statusに値をコピー
UPDATE reservations SET customer_status = CASE
  WHEN status = 'completed' THEN 'completed'
  WHEN status = 'serving' THEN 'serving'
  WHEN status = 'web_reservation' THEN 'web_reservation'
  WHEN status = 'customer_confirmed' THEN 'detail_read'
  WHEN status = 'email_sent' THEN 'summary_unread'
  WHEN status = 'processed' THEN 'detail_read'
  WHEN status = 'phone_check' THEN 'summary_unread'
  ELSE 'unsent'
END
WHERE customer_status = 'unsent' OR customer_status IS NULL;

-- 既存データの移行: 旧statusからtherapist_statusに値をコピー
UPDATE reservations SET therapist_status = CASE
  WHEN status = 'completed' THEN 'completed'
  WHEN status = 'serving' THEN 'serving'
  WHEN status = 'processed' THEN 'detail_sent'
  ELSE 'unsent'
END
WHERE therapist_status = 'unsent' OR therapist_status IS NULL;

-- インデックス
CREATE INDEX IF NOT EXISTS idx_reservations_customer_status ON reservations(customer_status);
CREATE INDEX IF NOT EXISTS idx_reservations_therapist_status ON reservations(therapist_status);
