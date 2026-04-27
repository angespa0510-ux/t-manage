-- =============================================================
-- session86: デモアカウント機能
-- 5/1先行リリースに向け、セラピストさん全員が事前体験できる
-- 共通デモアカウントを作成。深夜0時(JST)に自動リセット。
-- =============================================================

-- 1. is_demo カラムを追加（デモアカウント識別用）
ALTER TABLE therapists ADD COLUMN IF NOT EXISTS is_demo boolean DEFAULT false;

-- 2. 既存のデモアカウントがあれば削除（クリーンアップ）
DELETE FROM therapists WHERE login_email = 'demo@ange-spa.jp' OR is_demo = true;

-- 3. デモアカウントを新規作成
INSERT INTO therapists (
  name,
  login_email,
  login_password,
  status,
  is_demo,
  has_invoice,
  has_withholding,
  transport_fee,
  age,
  height,
  bust,
  cup,
  waist,
  hip,
  interval,
  photo_url,
  notes
) VALUES (
  'デモ',
  'demo@ange-spa.jp',
  'demo2026',
  'active',
  true,
  false,
  true,
  2000,
  25,
  160,
  85,
  'C',
  58,
  86,
  15,
  '',
  'これはデモアカウントです。自由に触ってください。深夜0時(JST)に内容が自動リセットされます。'
);

-- 3. 確認クエリ
-- SELECT id, name, login_email, is_demo, status FROM therapists WHERE is_demo = true;
-- 期待結果: 1行返る、デモアカウント情報

-- 4. インデックス（リセット処理高速化）
CREATE INDEX IF NOT EXISTS idx_therapists_is_demo ON therapists(is_demo) WHERE is_demo = true;
