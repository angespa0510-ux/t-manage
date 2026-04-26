-- ═══════════════════════════════════════════════════════════════
-- _schema_snapshot.sql — スキーマ SSOT（手動メンテ）
-- 健康診断レポート 2026-04-26 「M-4: スキーマ SSOT 不在」対応
-- ═══════════════════════════════════════════════════════════════
--
-- ■ 目的
--   コードベース内に CREATE TABLE 文が見つからない既存テーブルを
--   ここに集約し、スキーマの SSOT（Single Source of Truth）として運用する。
--   sql/sessionXX_*.sql は ALTER による差分適用が中心で、初期定義が
--   別ツール（Supabase Studio 等）で行われたテーブルの完全な姿が
--   コードベース内で参照できない状態だった。
--
-- ■ 更新ルール
--   1. テーブル構造を変更したマイグレーションを sql/sessionNN_*.sql に追加したら、
--      対応する CREATE TABLE / ALTER をこのファイルにも反映する。
--   2. このファイルは本番に直接適用しない（DROP/CREATE で破壊的に動くため）。
--      新環境構築時のリファレンス、または diff 比較の基準として使う。
--   3. 本番スキーマと差分が生じた場合は、Supabase の pg_dump を出力して照合する：
--        pg_dump --schema-only --no-owner --no-acl \
--          "postgresql://postgres:[PWD]@db.[PROJECT].supabase.co:5432/postgres" \
--          > sql/_schema_dump_$(date +%Y%m%d).sql
--
-- ■ 本ファイルの記載範囲（最低限）
--   - therapist_daily_settlements（複数 session で ALTER されているが CREATE が不明）
--   - 他テーブルは sql/sessionNN_*.sql の CREATE 文で網羅されているため割愛
--   - 必要に応じて追記
--
-- ═══════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────
-- therapist_daily_settlements
-- ───────────────────────────────────────────────────────────────
-- セラピスト日次精算の確定状態を保持する。
-- timechart「清算確定」ボタンから confirm_settlement(JSONB) RPC 経由で UPSERT される。
-- 由来: 初期定義は Supabase Studio で作成されたと思われる。
--       カラム構成は session45 / session73 / session77 / app/timechart/page.tsx
--       および lib/settlement-calc.ts から再構築。
--
-- 注意: 本ブロックは「再構築」であり、本番スキーマと完全一致する保証はない。
--       初回確認時は pg_dump 出力と照合し、差分があればこのファイルを修正する。

CREATE TABLE IF NOT EXISTS therapist_daily_settlements (
  id                  BIGSERIAL PRIMARY KEY,
  therapist_id        BIGINT      NOT NULL REFERENCES therapists(id) ON DELETE CASCADE,
  date                DATE        NOT NULL,
  room_id             BIGINT,                                         -- 当日メイン稼働ルーム
  total_sales         BIGINT      NOT NULL DEFAULT 0,                 -- 総売上（コース＋指名＋OP＋延長−割引）
  total_back          BIGINT      NOT NULL DEFAULT 0,                 -- 業務委託バック合計
  total_nomination    BIGINT      NOT NULL DEFAULT 0,
  total_options       BIGINT      NOT NULL DEFAULT 0,
  total_extension     BIGINT      NOT NULL DEFAULT 0,
  total_discount      BIGINT      NOT NULL DEFAULT 0,
  total_card          BIGINT      NOT NULL DEFAULT 0,                 -- カード決済合計
  total_paypay        BIGINT      NOT NULL DEFAULT 0,                 -- PayPay 決済合計
  total_cash          BIGINT      NOT NULL DEFAULT 0,                 -- 現金回収額（金庫に入る金額）
  order_count         INT         NOT NULL DEFAULT 0,
  is_settled          BOOLEAN     NOT NULL DEFAULT false,             -- 清算確定済みフラグ
  adjustment          BIGINT      NOT NULL DEFAULT 0,                 -- 手動調整（プラス/マイナス）
  adjustment_note     TEXT        NOT NULL DEFAULT '',
  invoice_deduction   BIGINT      NOT NULL DEFAULT 0,                 -- インボイス未登録時の控除額
  has_invoice         BOOLEAN     NOT NULL DEFAULT false,
  withholding_tax     BIGINT      NOT NULL DEFAULT 0,                 -- 源泉徴収（業務委託は基本 0）
  final_payment       BIGINT      NOT NULL DEFAULT 0,                 -- 最終手取り
  welfare_fee         BIGINT      NOT NULL DEFAULT 0,                 -- 厚生費控除（500円/日 等）
  transport_fee       BIGINT      NOT NULL DEFAULT 0,                 -- 交通費
  sales_collected     BOOLEAN     NOT NULL DEFAULT false,             -- 売上金回収済み（管理者が金庫へ収納）
  change_collected    BOOLEAN     NOT NULL DEFAULT false,             -- 釣銭回収済み
  safe_deposited      BOOLEAN     NOT NULL DEFAULT false,             -- 金庫入金済み
  reserve_used_amount BIGINT      NOT NULL DEFAULT 0,                 -- session45: 豊橋予備金からの立替額
  gift_bonus_amount   BIGINT      NOT NULL DEFAULT 0,                 -- session73: 投げ銭バック合計
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (therapist_id, date)
);

CREATE INDEX IF NOT EXISTS idx_tds_date         ON therapist_daily_settlements(date);
CREATE INDEX IF NOT EXISTS idx_tds_therapist    ON therapist_daily_settlements(therapist_id, date);
CREATE INDEX IF NOT EXISTS idx_tds_room_date    ON therapist_daily_settlements(room_id, date);
CREATE INDEX IF NOT EXISTS idx_settlements_reserve_used
  ON therapist_daily_settlements(reserve_used_amount) WHERE reserve_used_amount > 0;

COMMENT ON TABLE  therapist_daily_settlements                          IS 'セラピスト日次精算の確定スナップショット。confirm_settlement RPC で UPSERT される。';
COMMENT ON COLUMN therapist_daily_settlements.reserve_used_amount       IS '豊橋予備金から立替した金額（精算モーダルの「予備金から補充」トグル）';
COMMENT ON COLUMN therapist_daily_settlements.gift_bonus_amount         IS '投げ銭換金ボーナス（gift_payouts から精算時に加算された手取り合計）';

-- ═══════════════════════════════════════════════════════════════
-- 履歴: マイグレーションファイル一覧（time-ordered）
-- 詳細は sql/sessionNN_*.sql を参照。本ファイルは最新の集約形を保持する。
-- ═══════════════════════════════════════════════════════════════
