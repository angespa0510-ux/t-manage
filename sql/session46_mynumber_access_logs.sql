-- ===================================================================
-- セッション46: マイナンバーアクセスログ + 最終DL情報
-- 番号法遵守のための操作履歴テーブルと、セラピスト側の最終DL情報
-- ===================================================================

-- マイナンバーへのアクセス・操作ログ
CREATE TABLE IF NOT EXISTS mynumber_access_logs (
  id bigserial PRIMARY KEY,
  therapist_id bigint,                      -- 個別DL/閲覧/削除の対象。一括DLの場合はNULL
  action text NOT NULL,                      -- 'download' | 'bulk_download' | 'view' | 'delete'
  staff_name text DEFAULT '',                -- 実行者（バックオフィス利用者）
  target_count int DEFAULT 1,                -- 一括DLの場合の対象人数
  target_names text DEFAULT '',              -- 一括DLの場合の対象セラピスト名（カンマ区切り、ログ用）
  save_method text DEFAULT '',               -- 'zip' | 'folder_picker'（保存方式）
  note text DEFAULT '',                      -- 追加メモ
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mynumber_logs_created ON mynumber_access_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mynumber_logs_therapist ON mynumber_access_logs(therapist_id);
CREATE INDEX IF NOT EXISTS idx_mynumber_logs_action ON mynumber_access_logs(action);

ALTER TABLE mynumber_access_logs DISABLE ROW LEVEL SECURITY;

-- セラピストテーブルに最終DL情報を追加（一覧に表示するため）
ALTER TABLE therapists
  ADD COLUMN IF NOT EXISTS mynumber_downloaded_at timestamptz,
  ADD COLUMN IF NOT EXISTS mynumber_downloaded_by text DEFAULT '';

COMMENT ON TABLE mynumber_access_logs IS 'マイナンバー関連の操作履歴（番号法遵守のため保持）';
COMMENT ON COLUMN therapists.mynumber_downloaded_at IS 'マイナンバーを最後にローカル保存した日時';
COMMENT ON COLUMN therapists.mynumber_downloaded_by IS 'マイナンバーを最後にローカル保存したスタッフ名';
