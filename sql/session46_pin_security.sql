-- ==============================================================
-- session46_pin_security.sql
-- PIN セキュリティ強化:
--   1. staff.pin_updated_at カラム追加（NULL=初期PIN＝未変更）
--   2. ログイン履歴テーブル（将来のセキュリティ監査用）
-- ==============================================================

-- ① staff に pin_updated_at カラムを追加
-- NULL のままなら「初期PIN（未変更）」として扱い、ログイン時に PIN 変更モーダルを強制表示する
ALTER TABLE staff
  ADD COLUMN IF NOT EXISTS pin_updated_at timestamptz;

-- 既存の全スタッフは pin_updated_at = NULL のままなので、
-- 次回 PIN ログイン時に全員が「PIN 変更モーダル」を経由する運用となる。
-- → 6/1 本番運用開始前に全員が新 PIN を設定する想定。


-- ② ログイン履歴テーブル（将来の監査用、今は記録するだけ）
CREATE TABLE IF NOT EXISTS staff_login_logs (
  id bigserial PRIMARY KEY,
  staff_id bigint NOT NULL,
  staff_name text DEFAULT '',
  login_at timestamptz DEFAULT now(),
  logout_at timestamptz,
  idle_logout boolean DEFAULT false,     -- アイドルタイムアウトで自動ログアウトされたか
  user_agent text DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_staff_login_logs_staff ON staff_login_logs(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_login_logs_login_at ON staff_login_logs(login_at DESC);

ALTER TABLE staff_login_logs DISABLE ROW LEVEL SECURITY;


-- ==============================================================
-- 【運用メモ】
-- ・アイドルタイムアウト (lib/staff-session.tsx で実装)
--   - 税理士 (company_position='税理士'): 60 分
--   - owner / manager: 120 分
--   - その他: 240 分
-- ・PIN 変更は初回ログイン時に強制 (pin_updated_at IS NULL)
-- ・弱い PIN (0000, 1234, 1111 など) は changePin() で拒否される
-- ==============================================================
