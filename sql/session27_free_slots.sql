-- Session 27: フリー枠対応
-- reservationsテーブルにfree_building_idカラムを追加
-- NULLの場合は通常の指名予約
-- 値がある場合はそのbuilding_idのフリー予約

ALTER TABLE reservations ADD COLUMN IF NOT EXISTS free_building_id integer DEFAULT NULL;

-- インデックス追加（フリー予約の検索を高速化）
CREATE INDEX IF NOT EXISTS idx_reservations_free_building ON reservations (free_building_id) WHERE free_building_id IS NOT NULL;
