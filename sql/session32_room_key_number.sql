-- セッション32: 部屋に鍵番号カラムを追加
-- roomsテーブルに鍵番号（任意入力）を紐づけ
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS key_number text DEFAULT '';
