-- ==============================================================
-- session48_notification_logs.sql
-- 通知（SMS/LINE/メール）の送信ログを記録するテーブル
-- /notification-dashboard で一覧表示・検索に使う
-- ==============================================================

CREATE TABLE IF NOT EXISTS notification_logs (
  id bigserial PRIMARY KEY,
  created_at timestamptz DEFAULT now(),

  -- 送信チャネル
  --   line             : LINE公式アカウント宛て（クリップボードコピー）
  --   sms1             : SMS①（iPhoneメッセージなど手動）
  --   sms2             : SMS②（Edge拡張経由のGoogle Messages）
  --   gmail            : Gmail送信
  --   copy             : テキストだけコピー（汎用）
  --   therapist_line   : セラピスト向けLINE
  --   bulk_therapist   : 一括セラピスト通知
  --   other            : その他
  channel text NOT NULL DEFAULT 'other',

  -- 受信者
  recipient_type text NOT NULL DEFAULT 'customer', -- 'customer' | 'therapist' | 'other'
  recipient_name text DEFAULT '',
  recipient_phone text DEFAULT '',
  recipient_email text DEFAULT '',
  therapist_id bigint,                              -- セラピスト宛ての場合

  -- メッセージ種別・内容
  message_type text DEFAULT '',                     -- 'summary' | 'detail' | 'shift' | 'bulk' | ''
  subject text DEFAULT '',                          -- メール件名など
  body text DEFAULT '',                             -- 本文全文
  body_preview text DEFAULT '',                     -- 先頭100文字（一覧表示用）

  -- 関連する予約
  reservation_id bigint,
  reservation_date date,

  -- 操作者（誰が送信ボタンを押したか）
  sent_by_staff_id bigint,
  sent_by_name text DEFAULT '',

  -- ステータス
  status text DEFAULT 'copied'                      -- 'copied' | 'sent' | 'failed'
);

CREATE INDEX IF NOT EXISTS idx_notification_logs_created_at ON notification_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_logs_reservation ON notification_logs(reservation_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_therapist ON notification_logs(therapist_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_channel ON notification_logs(channel);
CREATE INDEX IF NOT EXISTS idx_notification_logs_recipient_type ON notification_logs(recipient_type);
CREATE INDEX IF NOT EXISTS idx_notification_logs_message_type ON notification_logs(message_type);

ALTER TABLE notification_logs DISABLE ROW LEVEL SECURITY;

-- ==============================================================
-- 【運用メモ】
-- ・タイムチャートのSMS/LINE送信ボタン押下時に INSERT される（フェーズ1）
-- ・将来的に Chrome/Edge 拡張から送信実行ステータスを PATCH する（フェーズ2）
-- ・/notification-dashboard で isManager 権限のスタッフが閲覧可能
-- ・body カラムは個人情報を含むため、長期保存は検討事項
--   （当面は全件保持、必要になったら保管期間ポリシーを設定）
-- ==============================================================
