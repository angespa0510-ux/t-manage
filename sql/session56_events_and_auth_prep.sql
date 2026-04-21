-- ═══════════════════════════════════════════════════════════
-- Session 56: イベント管理 + 会員認証基盤整備
--
-- 目的:
--   (A) 公式HP カルーセル/マイページで表示する「イベント」を
--       独立テーブルとして新設。割引(discounts)とは別概念。
--       期間限定の告知（画像・本文・期間・CTA）をスタッフが
--       管理画面から直接編集できるようにする。
--
--   (B) HP ⇔ お客様マイページのログイン状態共有のための
--       基盤整備。将来 Supabase Auth へ段階移行できるよう
--       customers テーブルに紐付け用カラムを追加する。
--       既存の login_email / login_password 認証は温存。
--
-- 冪等性: CREATE TABLE IF NOT EXISTS / ADD COLUMN IF NOT EXISTS
-- RLS: プロジェクト方針に従い無効化
-- ═══════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────
-- ① events テーブル新設
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS events (
  id                bigserial PRIMARY KEY,

  -- 基本情報
  title             text NOT NULL,                       -- イベント名（例: 夏の感謝祭）
  subtitle          text DEFAULT '',                     -- サブタイトル（例: 30分延長無料）
  description       text DEFAULT '',                     -- 本文（複数行OK）
  badge_label       text DEFAULT '',                     -- 右上バッジ（例: NEW / 限定 / 人気）

  -- ビジュアル
  image_url         text DEFAULT '',                     -- カルーセル用画像（横長推奨 16:9）
  accent_color      text DEFAULT '',                     -- カード強調色（HEX）空なら既定のピンク

  -- 期間
  start_date        date,                                -- 開始日（NULL なら即時）
  end_date          date,                                -- 終了日（NULL なら無期限）

  -- 公開制御
  is_published      boolean DEFAULT true,                -- スタッフ側で下書き⇔公開
  show_on_hp        boolean DEFAULT true,                -- HP カルーセルに出す
  show_on_mypage    boolean DEFAULT true,                -- マイページでも出す
  members_only      boolean DEFAULT false,               -- ログイン会員のみに表示

  -- 導線
  cta_label         text DEFAULT '',                     -- ボタン文言（例: 詳細を見る / 今すぐ予約）
  cta_url           text DEFAULT '',                     -- 遷移先（内部パス or 外部URL）

  -- 並び
  sort_order        int DEFAULT 0,                       -- 昇順、同順は id 降順

  -- メタ
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now(),
  created_by_name   text DEFAULT ''
);

-- 有効イベント抽出用（期間判定・並び替え用）
CREATE INDEX IF NOT EXISTS idx_events_published  ON events(is_published) WHERE is_published = true;
CREATE INDEX IF NOT EXISTS idx_events_period     ON events(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_events_sort       ON events(sort_order, id DESC);

-- RLS 無効化（プロジェクト方針）
ALTER TABLE events DISABLE ROW LEVEL SECURITY;


-- updated_at 自動更新トリガー
CREATE OR REPLACE FUNCTION trg_events_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS events_set_updated_at ON events;
CREATE TRIGGER events_set_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW
  EXECUTE FUNCTION trg_events_set_updated_at();


-- ─────────────────────────────────────────────────────────────
-- ② 会員認証基盤整備（customers 拡張）
-- ─────────────────────────────────────────────────────────────
-- 将来 Supabase Auth（auth.users）と紐付けるための ID カラム。
-- 段階移行のため、値が入っていなくても既存のログインは機能する。
--
-- 運用イメージ:
--   Phase A（今）: login_email/login_password + localStorage で認証
--                  このカラムは NULL のまま
--   Phase B:      マイページログイン時に supabase.auth.signInWithPassword
--                 を同時試行し、成功したら auth.users.id を保存
--   Phase C:      既存ユーザー全員が Auth 移行済みになったら
--                 login_password カラムは deprecated にして削除検討
-- ─────────────────────────────────────────────────────────────

ALTER TABLE customers ADD COLUMN IF NOT EXISTS supabase_user_id uuid;
-- auth.users.id への論理 FK（物理 FK は張らない＝Auth未連携でも動作）

CREATE INDEX IF NOT EXISTS idx_customers_supabase_user_id ON customers(supabase_user_id)
  WHERE supabase_user_id IS NOT NULL;

-- 会員登録完了フラグ（既存の rank='normal' 以外でログイン中フラグ管理したい場合用）
ALTER TABLE customers ADD COLUMN IF NOT EXISTS last_login_at timestamptz;


-- ─────────────────────────────────────────────────────────────
-- ③ 初期データ（任意）
-- ─────────────────────────────────────────────────────────────
-- サンプルイベント 1 件だけ（実運用前に管理画面から書き換え推奨）
-- INSERT INTO events (title, subtitle, description, image_url, badge_label, cta_label, cta_url)
-- VALUES
--   ('会員登録で 500pt プレゼント',
--    'はじめての方限定',
--    '会員登録していただくと、すぐに使える 500 ポイントをプレゼント。次回ご予約時にご利用いただけます。',
--    '',
--    'NEW',
--    '会員登録する',
--    '/customer-mypage');


-- ═══════════════════════════════════════════════════════════
-- 以上
--
-- 次セッションで検討（Phase B）:
--   - ログイン/登録時の supabase.auth.signUp/signIn 同時呼び出し
--   - 既存ユーザーの supabase_user_id 自動紐付けバッチ
--   - HP 側のログインボタン → マイページログインモーダル
-- ═══════════════════════════════════════════════════════════
