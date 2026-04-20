-- セッション㊸: セラピストお知らせ既読管理テーブル
-- 2026-04-20

-- セラピスト×お知らせの既読管理
CREATE TABLE IF NOT EXISTS therapist_notification_reads (
  id bigserial PRIMARY KEY,
  therapist_id bigint NOT NULL,
  notification_id bigint NOT NULL,
  read_at timestamptz DEFAULT now(),
  UNIQUE(therapist_id, notification_id)
);

ALTER TABLE therapist_notification_reads DISABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_therapist_notif_reads_therapist
  ON therapist_notification_reads(therapist_id);
CREATE INDEX IF NOT EXISTS idx_therapist_notif_reads_notif
  ON therapist_notification_reads(notification_id);

COMMENT ON TABLE therapist_notification_reads IS 'セラピスト向けお知らせの既読管理 (therapist_id × notification_id UNIQUE)';
