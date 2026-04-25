-- ═══════════════════════════════════════════════════════════════
-- session67_diary_scheduled_publish.sql
-- 写メ日記の投稿予約機能 (Phase 3 Step G)
-- ═══════════════════════════════════════════════════════════════
--
-- 既存:
--   therapist_diary_entries.scheduled_at TIMESTAMPTZ ← 既にあり
--   therapist_diary_entries.status TEXT DEFAULT 'published' ← 既にあり (CHECK制約なし)
--
-- 追加:
--   - status='scheduled' の場合に scheduled_at で検索する partial index
--
-- 新規SQL不要 (テーブル変更なし)、indexのみ追加
-- ═══════════════════════════════════════════════════════════════

-- 予約投稿の cron 走査用 partial index
-- status='scheduled' && scheduled_at <= now() を高速検索
CREATE INDEX IF NOT EXISTS idx_diary_scheduled
  ON therapist_diary_entries(scheduled_at)
  WHERE status = 'scheduled' AND deleted_at IS NULL;

-- 確認用クエリ (実行後に手動で確認):
-- SELECT id, title, status, scheduled_at, published_at FROM therapist_diary_entries WHERE status = 'scheduled';
