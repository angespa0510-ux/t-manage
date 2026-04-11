-- 電話確認カラム追加
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS phone_confirm boolean DEFAULT false;
