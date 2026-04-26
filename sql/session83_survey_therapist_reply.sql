-- ═══════════════════════════════════════════════════════════
-- session83: アンケートにセラピスト返信機能を追加
-- ═══════════════════════════════════════════════════════════
-- 機能:
--   - HP掲載承認時にセラピストに通知 (therapist_notifications)
--   - セラピストが口コミに返信できる (therapist_reply)
--   - 返信時にお客様にプッシュ通知 (customer_notifications)
-- ═══════════════════════════════════════════════════════════

-- ─────────────────────────────────────
-- 1. customer_surveys にセラピスト返信カラムを追加
-- ─────────────────────────────────────
ALTER TABLE customer_surveys
  ADD COLUMN IF NOT EXISTS therapist_reply text,
  ADD COLUMN IF NOT EXISTS therapist_reply_at timestamptz,
  ADD COLUMN IF NOT EXISTS therapist_notified_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_surveys_therapist_replied
  ON customer_surveys(therapist_id, therapist_reply_at)
  WHERE therapist_reply IS NOT NULL;

-- ─────────────────────────────────────
-- 2. 確認クエリ
-- ─────────────────────────────────────
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'customer_surveys'
  AND column_name IN ('therapist_reply', 'therapist_reply_at', 'therapist_notified_at')
ORDER BY column_name;

-- 期待される出力:
--   therapist_notified_at | timestamp with time zone | YES
--   therapist_reply       | text                      | YES
--   therapist_reply_at    | timestamp with time zone | YES
