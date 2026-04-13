-- Session 29: セラピストゴミ箱機能（ソフトデリート）
ALTER TABLE therapists ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;
