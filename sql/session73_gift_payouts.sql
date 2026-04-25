-- ═══════════════════════════════════════════════════════════════
-- セラピスト投げ銭換金申請テーブル
-- ═══════════════════════════════════════════════════════════════
--
-- 設計方針:
--   - セラピストが 1,000pt 以上 (100pt 単位) で換金申請
--   - 申請時点で therapist_gift_points.current_balance_points から減算
--     (ダブル申請防止)
--   - status='pending' で待機 → 出勤日の精算時に紐付けて 'paid' に
--   - 1pt = 1円換算
--   - 店舗手数料 10% + (任意) インボイス控除 10% + (任意) 源泉徴収 10.21% を控除
--   - 控除後の金額を therapist_daily_settlements.adjustment に上乗せ
--
-- 状態遷移:
--   pending  : 申請済み、未精算
--   paid     : 精算で支給済み (settlement_id に紐付き)
--   cancelled: セラピストが取消 (current_balance_points に返却)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS gift_payouts (
  id BIGSERIAL PRIMARY KEY,

  therapist_id BIGINT NOT NULL REFERENCES therapists(id) ON DELETE CASCADE,

  -- 申請内容
  requested_points INTEGER NOT NULL CHECK (requested_points >= 1000 AND requested_points % 100 = 0),
  requested_amount_yen INTEGER NOT NULL,                 -- 申請額 (1pt=1円なので requested_points と同じ、将来レート変更時のため別カラム)

  -- 控除内訳 (申請時に確定、後で参照しやすいよう保存)
  store_fee_amount INTEGER NOT NULL DEFAULT 0,           -- 店舗手数料 (10%)
  invoice_deduction INTEGER NOT NULL DEFAULT 0,          -- インボイス未登録時の控除 (10%)
  withholding_tax INTEGER NOT NULL DEFAULT 0,            -- 源泉徴収 (10.21%)
  net_payout_amount INTEGER NOT NULL,                    -- 手取り = requested - store_fee - invoice - withholding

  -- 申請時のセラピスト状態 (申請時にスナップショット保存、後で変更されても精算は申請時の条件で実施)
  has_invoice_at_request BOOLEAN NOT NULL DEFAULT false,
  has_withholding_at_request BOOLEAN NOT NULL DEFAULT false,

  -- 状態
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- 精算紐付け (status='paid' 時にセット)
  settlement_id BIGINT REFERENCES therapist_daily_settlements(id) ON DELETE SET NULL,
  settlement_date DATE,                                  -- 精算した出勤日 (検索用)
  paid_at TIMESTAMPTZ,

  -- キャンセル
  cancelled_at TIMESTAMPTZ,
  cancel_reason TEXT,

  -- メモ (運営用)
  note TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_gift_payouts_therapist ON gift_payouts(therapist_id);
CREATE INDEX IF NOT EXISTS idx_gift_payouts_status ON gift_payouts(status);
CREATE INDEX IF NOT EXISTS idx_gift_payouts_settlement ON gift_payouts(settlement_id) WHERE settlement_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_gift_payouts_pending_therapist
  ON gift_payouts(therapist_id, status)
  WHERE status = 'pending';

-- updated_at トリガー
CREATE OR REPLACE FUNCTION update_gift_payouts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS gift_payouts_updated_at ON gift_payouts;
CREATE TRIGGER gift_payouts_updated_at
BEFORE UPDATE ON gift_payouts
FOR EACH ROW
EXECUTE FUNCTION update_gift_payouts_updated_at();

-- RLS 無効化 (T-MANAGE 標準)
ALTER TABLE gift_payouts DISABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────
-- 投げ銭ボーナス用のオプショナル列を therapist_daily_settlements に追加
-- (任意: 精算側に「投げ銭ボーナス」として独立列を持つと税理士ポータルで分けて表示可能)
-- ─────────────────────────────────────────────────────────────
ALTER TABLE therapist_daily_settlements
  ADD COLUMN IF NOT EXISTS gift_bonus_amount INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN therapist_daily_settlements.gift_bonus_amount IS '投げ銭換金ボーナス (gift_payouts から精算時に加算された手取り合計)';
