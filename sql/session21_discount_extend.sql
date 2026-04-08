-- Session 21: 割引テーブル拡張

-- 新人のみフラグ
ALTER TABLE discounts ADD COLUMN IF NOT EXISTS newcomer_only boolean DEFAULT false;

-- ネット予約可否
ALTER TABLE discounts ADD COLUMN IF NOT EXISTS web_available boolean DEFAULT true;

-- 公開期間
ALTER TABLE discounts ADD COLUMN IF NOT EXISTS valid_from date DEFAULT null;
ALTER TABLE discounts ADD COLUMN IF NOT EXISTS valid_until date DEFAULT null;

-- 併用可否
ALTER TABLE discounts ADD COLUMN IF NOT EXISTS combinable boolean DEFAULT true;
