-- =====================================================================
-- session66_diary_stories_and_retention.sql
-- 写メ日記 ストーリーズ機能 + データ保存期間管理
-- 作成日: 2026/4/25
-- 関連ドキュメント: docs/17_DIARY_DESIGN.md
--
-- 追加内容:
--   1. ストーリーズ機能 (24時間で消える画像/動画)
--   2. ストーリーズの閲覧ログ + 通報機能
--   3. データ保存期間管理 (退店/休止セラピストの自動非公開)
--   4. ストレージ削除キュー (バッチで物理削除する対象を管理)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. ストーリーズ本体テーブル
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS therapist_diary_stories (
  id BIGSERIAL PRIMARY KEY,
  therapist_id BIGINT NOT NULL,

  -- メディア種別
  media_type TEXT NOT NULL,                    -- 'image' | 'video'
  media_url TEXT,                              -- Storage URL (24時間後にNULL化)
  thumbnail_url TEXT,                          -- 50px小サムネ (30日保持、ログ用)
  
  -- 動画専用
  video_duration_sec INT,                      -- 動画の長さ (秒)
  video_width INT,
  video_height INT,
  
  -- 画像専用
  image_width INT,
  image_height INT,
  
  -- メタデータ
  caption TEXT,                                -- 短いキャプション (最大200文字)
  file_size_bytes BIGINT,
  
  -- 公開範囲 (写メ日記と同じ)
  visibility TEXT NOT NULL DEFAULT 'public',   -- 'public' | 'members_only'
  
  -- ステータス
  status TEXT NOT NULL DEFAULT 'active',       -- 'active' | 'expired' | 'deleted_by_staff' | 'deleted_by_self'
  
  -- 期限管理
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,             -- 公開終了日時 (公開後24時間)
  storage_deleted_at TIMESTAMPTZ,              -- Storage実体削除日時
  
  -- 閲覧統計
  view_count BIGINT NOT NULL DEFAULT 0,
  unique_viewer_count BIGINT NOT NULL DEFAULT 0,
  reaction_count BIGINT NOT NULL DEFAULT 0,
  
  -- モデレーション
  is_reported BOOLEAN NOT NULL DEFAULT false,  -- 通報あり
  report_count INT NOT NULL DEFAULT 0,
  deleted_by_staff_id BIGINT,
  delete_reason TEXT,
  deleted_at TIMESTAMPTZ,
  
  source TEXT NOT NULL DEFAULT 'mypage',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stories_therapist 
  ON therapist_diary_stories(therapist_id, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_stories_active 
  ON therapist_diary_stories(expires_at DESC) 
  WHERE status = 'active' AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_stories_expired_pending_delete 
  ON therapist_diary_stories(expires_at) 
  WHERE storage_deleted_at IS NULL AND media_url IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_stories_reported 
  ON therapist_diary_stories(is_reported, created_at DESC) 
  WHERE is_reported = true;

ALTER TABLE therapist_diary_stories DISABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------
-- 2. ストーリーズ閲覧ログ (誰が見たか - セラピスト側で確認できるInstagram風)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS therapist_diary_story_views (
  id BIGSERIAL PRIMARY KEY,
  story_id BIGINT NOT NULL,
  customer_id BIGINT,                          -- 会員のみ記録 (非会員はNULL)
  ip_hash TEXT,                                -- 重複カウント抑止
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(story_id, customer_id)                -- 1人1回まで (お気に入り会員に「見てくれた」分かる用)
);

CREATE INDEX IF NOT EXISTS idx_story_views_story 
  ON therapist_diary_story_views(story_id, viewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_story_views_customer 
  ON therapist_diary_story_views(customer_id) 
  WHERE customer_id IS NOT NULL;

ALTER TABLE therapist_diary_story_views DISABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------
-- 3. ストーリーリアクション (絵文字スタンプ - Phase 2)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS therapist_diary_story_reactions (
  id BIGSERIAL PRIMARY KEY,
  story_id BIGINT NOT NULL,
  customer_id BIGINT NOT NULL,
  reaction TEXT NOT NULL,                      -- '❤️' | '🔥' | '😍' | '👏' | '🥰'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(story_id, customer_id)                -- 1人1リアクション (上書き式)
);

CREATE INDEX IF NOT EXISTS idx_story_reactions_story 
  ON therapist_diary_story_reactions(story_id);

ALTER TABLE therapist_diary_story_reactions DISABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------
-- 4. 通報テーブル (ストーリー + 写メ日記共通)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS therapist_diary_reports (
  id BIGSERIAL PRIMARY KEY,
  target_type TEXT NOT NULL,                   -- 'story' | 'entry' | 'comment'
  target_id BIGINT NOT NULL,
  reporter_customer_id BIGINT,                 -- 会員からの通報 (匿名通報も許可)
  reporter_ip_hash TEXT,
  reason TEXT NOT NULL,                        -- 'inappropriate' | 'spam' | 'fake' | 'other'
  detail TEXT,                                 -- 任意の補足説明
  status TEXT NOT NULL DEFAULT 'pending',      -- 'pending' | 'reviewed' | 'dismissed' | 'actioned'
  reviewed_by_staff_id BIGINT,
  reviewed_at TIMESTAMPTZ,
  staff_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reports_target 
  ON therapist_diary_reports(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_reports_pending 
  ON therapist_diary_reports(status, created_at DESC) 
  WHERE status = 'pending';

ALTER TABLE therapist_diary_reports DISABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------
-- 5. ストレージ削除キュー (バッチ処理で物理削除する対象を管理)
-- ---------------------------------------------------------------------
-- 退店セラピスト・期限切れストーリー・古い画像を非同期で削除するためのキュー
CREATE TABLE IF NOT EXISTS storage_deletion_queue (
  id BIGSERIAL PRIMARY KEY,
  storage_bucket TEXT NOT NULL,                -- 'therapist-diary' | 'therapist-stories' 等
  storage_path TEXT NOT NULL,                  -- バケット内のフルパス
  
  -- 関連エンティティ (削除前にチェックするため)
  related_type TEXT,                           -- 'story' | 'entry' | 'image' | 'therapist'
  related_id BIGINT,
  therapist_id BIGINT,
  
  -- 削除予定日時 (この日時以降にバッチで削除)
  scheduled_delete_at TIMESTAMPTZ NOT NULL,
  
  -- 削除理由 (運用ログ用)
  reason TEXT NOT NULL,                        -- 'story_expired' | 'therapist_retired' | 'therapist_inactive' | 'manual_delete' | 'old_archive'
  
  -- 結果
  status TEXT NOT NULL DEFAULT 'pending',      -- 'pending' | 'completed' | 'failed' | 'cancelled'
  attempted_count INT NOT NULL DEFAULT 0,
  last_error TEXT,
  completed_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_storage_queue_pending 
  ON storage_deletion_queue(scheduled_delete_at) 
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_storage_queue_therapist 
  ON storage_deletion_queue(therapist_id);

ALTER TABLE storage_deletion_queue DISABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------
-- 6. セラピストステータス管理の拡張
-- ---------------------------------------------------------------------
-- 既存の therapists.status を拡張: 'active' | 'inactive' | 'retired'
-- 'inactive' = 休止 (一時的、戻る可能性あり)
-- 'retired' = 退店 (戻らない、削除予定)

-- 退店日記録カラム追加
ALTER TABLE therapists 
  ADD COLUMN IF NOT EXISTS retired_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS inactive_since TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS storage_cleanup_scheduled_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_therapists_status 
  ON therapists(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_therapists_retired 
  ON therapists(retired_at) WHERE retired_at IS NOT NULL;

-- ---------------------------------------------------------------------
-- 7. 写メ日記/ストーリーの非公開トリガー (退店/休止時)
-- ---------------------------------------------------------------------
-- セラピストのstatusが変更されたら、紐付く写メ日記とストーリーを非公開化
CREATE OR REPLACE FUNCTION handle_therapist_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- active以外になったら、写メ日記もストーリーも非公開
  IF NEW.status != 'active' AND OLD.status = 'active' THEN
    -- 写メ日記を非公開化 (論理削除ではなく status 変更)
    UPDATE therapist_diary_entries
    SET status = 'unlisted',
        updated_at = NOW()
    WHERE therapist_id = NEW.id 
      AND status = 'published'
      AND deleted_at IS NULL;
    
    -- 公開中ストーリーを即座にステータス変更
    UPDATE therapist_diary_stories
    SET status = 'expired',
        expires_at = NOW()
    WHERE therapist_id = NEW.id 
      AND status = 'active';
    
    -- 退店日記録
    IF NEW.status = 'retired' THEN
      NEW.retired_at = COALESCE(NEW.retired_at, NOW());
      -- 30日後に Storage 削除予定
      NEW.storage_cleanup_scheduled_at = NOW() + INTERVAL '30 days';
    ELSIF NEW.status = 'inactive' THEN
      NEW.inactive_since = COALESCE(NEW.inactive_since, NOW());
      -- 6ヶ月後に Storage 削除予定 (戻る可能性あるので長め)
      NEW.storage_cleanup_scheduled_at = NOW() + INTERVAL '6 months';
    END IF;
  END IF;
  
  -- active に復帰した場合: 削除予定キャンセル + 写メ日記復活
  IF NEW.status = 'active' AND OLD.status != 'active' THEN
    NEW.storage_cleanup_scheduled_at = NULL;
    NEW.inactive_since = NULL;
    -- ※退店からの復帰は通常ないので retired_at はリセットしない
    
    -- unlistedの写メ日記を復活
    UPDATE therapist_diary_entries
    SET status = 'published',
        updated_at = NOW()
    WHERE therapist_id = NEW.id 
      AND status = 'unlisted'
      AND deleted_at IS NULL;
    
    -- 削除キューからキャンセル
    UPDATE storage_deletion_queue
    SET status = 'cancelled'
    WHERE therapist_id = NEW.id 
      AND status = 'pending'
      AND reason IN ('therapist_inactive', 'therapist_retired');
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_therapist_status_change ON therapists;
CREATE TRIGGER trg_therapist_status_change
  BEFORE UPDATE OF status ON therapists
  FOR EACH ROW EXECUTE FUNCTION handle_therapist_status_change();

-- ---------------------------------------------------------------------
-- 8. ストーリー期限切れ自動処理 (cron で呼ぶ用のヘルパー関数)
-- ---------------------------------------------------------------------
-- 期限切れストーリーを 'expired' にして削除キューに登録する関数
-- API側 cron からこの関数を呼ぶ
CREATE OR REPLACE FUNCTION expire_old_stories()
RETURNS TABLE (story_id BIGINT, queued INT) AS $$
DECLARE
  expired_count INT := 0;
  rec RECORD;
BEGIN
  -- まず期限切れマーク
  UPDATE therapist_diary_stories
  SET status = 'expired'
  WHERE status = 'active' 
    AND expires_at < NOW();
  
  -- 削除キューに登録 (まだメディア実体が残っているもの)
  FOR rec IN 
    SELECT s.id, s.media_url, s.therapist_id
    FROM therapist_diary_stories s
    WHERE s.media_url IS NOT NULL
      AND s.storage_deleted_at IS NULL
      AND s.status IN ('expired', 'deleted_by_self', 'deleted_by_staff')
      AND NOT EXISTS (
        SELECT 1 FROM storage_deletion_queue q
        WHERE q.related_type = 'story' 
          AND q.related_id = s.id
          AND q.status = 'pending'
      )
  LOOP
    -- メイン画像/動画を削除キューに追加
    INSERT INTO storage_deletion_queue (
      storage_bucket, storage_path, 
      related_type, related_id, therapist_id,
      scheduled_delete_at, reason
    )
    SELECT 
      'therapist-stories',
      regexp_replace(rec.media_url, '^.*/therapist-stories/', ''),
      'story', rec.id, rec.therapist_id,
      NOW(), 'story_expired'
    WHERE rec.media_url LIKE '%/therapist-stories/%';
    
    expired_count := expired_count + 1;
  END LOOP;
  
  RETURN QUERY SELECT NULL::BIGINT, expired_count;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------
-- 9. 通報数の自動同期 (target が story の場合)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sync_report_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.target_type = 'story' THEN
      UPDATE therapist_diary_stories
      SET report_count = report_count + 1,
          is_reported = true
      WHERE id = NEW.target_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_report_count_sync ON therapist_diary_reports;
CREATE TRIGGER trg_report_count_sync
  AFTER INSERT ON therapist_diary_reports
  FOR EACH ROW EXECUTE FUNCTION sync_report_count();

-- ---------------------------------------------------------------------
-- 10. Storage バケット (Supabase ダッシュボードで手動作成)
-- ---------------------------------------------------------------------
-- バケット名: therapist-stories
-- public: true
-- 許可ファイル形式: image/webp, image/jpeg, image/png, video/mp4
-- 最大ファイルサイズ: 25MB (動画用に大きめ)
-- パス規則: {therapist_id}/{story_id}/{uuid}.{ext}

-- ---------------------------------------------------------------------
-- 11. 写メ日記エントリの 'unlisted' ステータス対応
-- ---------------------------------------------------------------------
-- status カラムに 'unlisted' (退店等で非公開だが論理削除ではない) を許可
-- 既存の CHECK 制約はないので、アプリケーション側で扱う
COMMENT ON COLUMN therapist_diary_entries.status IS 
  'published | edited | deleted | unlisted (退店/休止時の自動非公開)';

-- ---------------------------------------------------------------------
-- 12. データ保存ポリシーのドキュメント (system_settings に保存)
-- ---------------------------------------------------------------------
-- データ保持期間設定 (将来的に管理画面から変更可能にする想定)
INSERT INTO store_settings (key, value, description) VALUES 
  ('story_lifetime_hours', '24', 'ストーリーの公開時間 (時間)'),
  ('story_thumbnail_retention_days', '30', 'ストーリーサムネイル保持日数'),
  ('story_max_video_seconds', '15', 'ストーリー動画の最大長 (秒)'),
  ('story_max_video_mb', '20', 'ストーリー動画の最大サイズ (MB)'),
  ('story_max_image_mb', '5', 'ストーリー画像の最大サイズ (MB)'),
  ('diary_image_archive_months', '6', '写メ日記画像のアーカイブ開始 (月数)'),
  ('therapist_retired_storage_grace_days', '30', '退店セラピスト Storage 保持日数'),
  ('therapist_inactive_storage_grace_months', '6', '休止セラピスト Storage 保持月数')
ON CONFLICT (key) DO NOTHING;

-- ---------------------------------------------------------------------
-- 13. 確認用クエリ
-- ---------------------------------------------------------------------
-- SELECT tablename, rowsecurity FROM pg_tables 
-- WHERE tablename LIKE '%stor%' OR tablename LIKE '%report%' OR tablename LIKE '%queue%'
-- ORDER BY tablename;
--
-- 期待結果:
-- storage_deletion_queue          | false
-- therapist_diary_reports         | false
-- therapist_diary_stories         | false
-- therapist_diary_story_reactions | false
-- therapist_diary_story_views     | false

-- ---------------------------------------------------------------------
-- 14. 設計時の重要な決定事項 (実装メモ)
-- ---------------------------------------------------------------------
-- 【セラピスト側にも残すか】
--   → 残さない (24時間で物理削除)
--   理由: 「監視されてる感」を排除しセラピストが気軽に投稿できる UX を優先
--   ただし投稿事実とサムネ(50px)は30日残す = トラブル時に最低限追跡可能
--
-- 【動画の制約】
--   → 15秒/20MB/720p/MP4限定 (Instagramストーリー準拠)
--   理由: Storage コスト管理 + Vercel Edge の処理時間制約
--
-- 【退店セラピスト】
--   → 30日のグレース期間後に物理削除
--   理由: 退店日に支払調書作成・確認できる時間を確保
--
-- 【休止セラピスト】
--   → 6ヶ月後に物理削除 (戻ってくる可能性あるので長め)
--   理由: 短期休止からの復帰時に画像を再アップする手間を回避
--
-- 【お客様側にだけ消える設計】
--   → ストーリーは expires_at で公開停止 + Storage 物理削除
--   → 写メ日記は 6ヶ月経過で「アーカイブ」化 (低画質サムネのみ残し原寸削除)
--      これは Phase 2 以降で実装

-- =====================================================================
-- 実行後の確認手順
-- =====================================================================
-- 1. Supabase ダッシュボードで Storage バケット 'therapist-stories' を作成
--    - public: true
--    - 許可形式: image/webp, image/jpeg, image/png, video/mp4
--    - 最大サイズ: 25MB
--
-- 2. 削除バッチ用の Vercel Cron 設定 (vercel.json):
--    {
--      "crons": [
--        {
--          "path": "/api/diary/cleanup-stories",
--          "schedule": "*/15 * * * *"
--        },
--        {
--          "path": "/api/diary/process-deletion-queue", 
--          "schedule": "0 3 * * *"
--        }
--      ]
--    }
--
-- 3. 既存セラピストの status 確認
--    SELECT status, COUNT(*) FROM therapists GROUP BY status;
