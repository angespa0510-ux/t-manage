-- セッション54: 書類の個人向け一括配信ログ
--
-- 目的: セラピスト/スタッフに向けて証明書PDFやテンプレファイルを配信した履歴を記録する。
--       「2025年分の支払調書を誰に、いつ、どの手段で送ったか」を追跡できるようにする。
--
-- 配信チャネル:
--   - セラピスト向け: therapist_notifications にレコードを作成 → マイページで閲覧
--   - スタッフ向け  : nodemailer でメール送信（添付ファイル付き）
--
-- 添付ファイルは以下のいずれか:
--   - 支払調書PDF（クライアントサイドで生成 → Storage にアップロード → URL を記録）
--   - 書類テンプレの特定バージョンファイル（document_template_versions.file_url）
--
-- このテーブル自体は「配信ログ」なので、添付ファイル本体は別管理。

CREATE TABLE IF NOT EXISTS document_deliveries (
  id bigserial PRIMARY KEY,

  -- 配信対象
  recipient_kind text NOT NULL,                     -- 'therapist' | 'staff'
  recipient_id bigint NOT NULL,                     -- therapists.id or staff.id
  recipient_name text DEFAULT '',                   -- 送付時の名前（スナップショット）
  recipient_email text DEFAULT '',                  -- スタッフ向けメール送信時のアドレス

  -- 配信内容
  document_kind text NOT NULL,                      -- 'payment_certificate' | 'contract_certificate'
                                                    -- | 'transaction_certificate' | 'template' | 'custom'
  document_template_id bigint REFERENCES document_templates(id) ON DELETE SET NULL,
  document_template_version_id bigint REFERENCES document_template_versions(id) ON DELETE SET NULL,
  target_year integer,                              -- 支払調書なら年度（2025 等）
  subject text DEFAULT '',                          -- 件名 / 通知タイトル
  message text DEFAULT '',                          -- 本文
  attachment_url text DEFAULT '',                   -- PDFやテンプレファイルのURL
  attachment_name text DEFAULT '',                  -- 添付ファイル名（表示用）

  -- 配信情報
  delivery_channel text NOT NULL,                   -- 'email' | 'notification'
  status text DEFAULT 'pending',                    -- 'pending' | 'sent' | 'failed'
  error_message text DEFAULT '',                    -- 失敗時のエラーメッセージ
  delivered_at timestamptz,                         -- 実際に配信完了した時刻

  -- メタ情報
  batch_id uuid,                                    -- 一括配信時の束ID（バッチ単位で集計するため）
  created_by_name text DEFAULT '',                  -- 配信実行者
  created_at timestamptz DEFAULT now()
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_deliveries_recipient ON document_deliveries(recipient_kind, recipient_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_kind ON document_deliveries(document_kind);
CREATE INDEX IF NOT EXISTS idx_deliveries_year ON document_deliveries(target_year);
CREATE INDEX IF NOT EXISTS idx_deliveries_status ON document_deliveries(status);
CREATE INDEX IF NOT EXISTS idx_deliveries_batch ON document_deliveries(batch_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_created_at ON document_deliveries(created_at DESC);

-- RLS 無効化（T-MANAGE の標準方針）
ALTER TABLE document_deliveries DISABLE ROW LEVEL SECURITY;
