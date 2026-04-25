-- ═══════════════════════════════════════════════════════════════
-- C案: 投げ銭の控除を撤廃 (店舗手数料・インボイス・源泉は精算側で再計算)
-- ═══════════════════════════════════════════════════════════════
--
-- 【背景】
-- 当初は API 側で店舗手数料 10% + インボイス控除 + 源泉徴収 を引いていたが、
-- セラピストの心情と計算の一貫性を考えて以下の方針に変更:
--   - 投げ銭1000pt → そのまま「投げ銭バック ¥1,000」として精算のバック額に上乗せ
--   - 店舗手数料は取らない (投げ銭文化の促進)
--   - インボイス・源泉は通常のバック額と一括で精算側で計算
--   - 端数は最後の100円繰り上げで1回だけ
--
-- 【既存データの扱い】
-- pending な申請は net_payout_amount を requested_points と同額に書き換える。
-- paid な申請はそのまま (既に精算済みなので変更しない)。
-- ═══════════════════════════════════════════════════════════════

-- 1. 控除内訳カラムをデフォルト 0 のまま、net_payout_amount = requested_points に変更
UPDATE gift_payouts
SET
  store_fee_amount = 0,
  invoice_deduction = 0,
  withholding_tax = 0,
  net_payout_amount = requested_points
WHERE status = 'pending';

-- 2. 確認用クエリ (実行後、pending な申請の控除がすべて 0 になっていれば OK)
-- SELECT id, requested_points, store_fee_amount, invoice_deduction, withholding_tax, net_payout_amount, status
-- FROM gift_payouts
-- ORDER BY requested_at DESC;
