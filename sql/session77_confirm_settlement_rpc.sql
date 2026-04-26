-- ═══════════════════════════════════════════════════════════════
-- セラピスト日次精算 アトミック確定 RPC
-- 健康診断レポート 2026-04-26 「重要度: 高 - 精算保存にトランザクション無し」対応
-- ═══════════════════════════════════════════════════════════════
--
-- 旧式の問題:
--   精算「清算確定」ボタンで以下 9 オペレーションが連鎖実行されるが、
--   トランザクションが無く、途中失敗で部分書込みが残るリスクがあった。
--   エラーチェックは gift_payouts の try-catch のみ。
--     ① therapist_daily_settlements UPSERT
--     ② gift_payouts UPDATE (pending → paid)
--     ③ 過去未回収売上 UPDATE
--     ④ 過去未回収釣銭 UPDATE
--     ⑤ toyohashi_reserve_movements DELETE (旧連動)
--     ⑥ toyohashi_reserve_movements INSERT (reserve_used > 0)
--     ⑦ room_cash_replenishments DELETE (旧自動補充)
--     ⑧ room_cash_replenishments INSERT (replenish > 0)
--
-- 新式（本関数）:
--   PostgreSQL 関数は既定で 1 トランザクションとして実行される。
--   関数内で例外が発生した場合は自動 ROLLBACK され、部分書込みは生じない。
--   全ての操作を本関数内に集約することで真の ACID を保証する。
--
-- 入力: p_data JSONB
--   キー一覧（全て必須、ただし number/boolean は省略時 0 / false）:
--     therapist_id, therapist_name, date, room_id,
--     total_sales, total_back, total_nomination, total_options,
--     total_extension, total_discount, total_card, total_paypay, total_cash,
--     order_count, adjustment, adjustment_note, invoice_deduction,
--     has_invoice, withholding_tax, final_payment, welfare_fee, transport_fee,
--     effective_sales_collected, effective_change_collected, effective_safe_deposited,
--     reserve_used_amount, replenish_used_amount, gift_bonus_amount,
--     gift_payout_ids: number[],
--     past_uncollected_sales_dates: string[] (YYYY-MM-DD),
--     past_uncollected_change_dates: string[] (YYYY-MM-DD)
--
-- 戻り値: JSONB { settlement_id: bigint, gift_bonus_count: int }
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION confirm_settlement(p_data JSONB)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_settlement_id      BIGINT;
  v_gift_bonus_count   INT     := 0;
  v_therapist_id       BIGINT;
  v_therapist_name     TEXT;
  v_date               DATE;
  v_room_id            BIGINT;
  v_reserve_used       BIGINT;
  v_replenish_used     BIGINT;
  v_eff_sales_coll     BOOLEAN;
  v_eff_change_coll    BOOLEAN;
  v_eff_safe_deposited BOOLEAN;
  v_link_note          TEXT;
  v_now                TIMESTAMPTZ := NOW();
BEGIN
  -- ─── パラメータ取得 ───
  v_therapist_id       := (p_data->>'therapist_id')::BIGINT;
  v_therapist_name     := COALESCE(p_data->>'therapist_name', '');
  v_date               := (p_data->>'date')::DATE;
  v_room_id            := COALESCE((p_data->>'room_id')::BIGINT, 0);
  v_reserve_used       := COALESCE((p_data->>'reserve_used_amount')::BIGINT, 0);
  v_replenish_used     := COALESCE((p_data->>'replenish_used_amount')::BIGINT, 0);
  v_eff_sales_coll     := COALESCE((p_data->>'effective_sales_collected')::BOOLEAN, false);
  v_eff_change_coll    := COALESCE((p_data->>'effective_change_collected')::BOOLEAN, false);
  v_eff_safe_deposited := COALESCE((p_data->>'effective_safe_deposited')::BOOLEAN, false);
  v_link_note          := '精算連動:' || v_therapist_name;

  -- ① therapist_daily_settlements UPSERT
  INSERT INTO therapist_daily_settlements (
    therapist_id, date, total_sales, total_back, total_nomination,
    total_options, total_extension, total_discount, total_card, total_paypay,
    total_cash, order_count, is_settled, adjustment, adjustment_note,
    invoice_deduction, has_invoice, withholding_tax, final_payment,
    welfare_fee, transport_fee, room_id, sales_collected, change_collected,
    safe_deposited, reserve_used_amount, gift_bonus_amount
  )
  VALUES (
    v_therapist_id,
    v_date,
    COALESCE((p_data->>'total_sales')::BIGINT, 0),
    COALESCE((p_data->>'total_back')::BIGINT, 0),
    COALESCE((p_data->>'total_nomination')::BIGINT, 0),
    COALESCE((p_data->>'total_options')::BIGINT, 0),
    COALESCE((p_data->>'total_extension')::BIGINT, 0),
    COALESCE((p_data->>'total_discount')::BIGINT, 0),
    COALESCE((p_data->>'total_card')::BIGINT, 0),
    COALESCE((p_data->>'total_paypay')::BIGINT, 0),
    COALESCE((p_data->>'total_cash')::BIGINT, 0),
    COALESCE((p_data->>'order_count')::INT, 0),
    true,                                          -- is_settled は常に true
    COALESCE((p_data->>'adjustment')::BIGINT, 0),
    COALESCE(p_data->>'adjustment_note', ''),
    COALESCE((p_data->>'invoice_deduction')::BIGINT, 0),
    COALESCE((p_data->>'has_invoice')::BOOLEAN, false),
    COALESCE((p_data->>'withholding_tax')::BIGINT, 0),
    COALESCE((p_data->>'final_payment')::BIGINT, 0),
    COALESCE((p_data->>'welfare_fee')::BIGINT, 0),
    COALESCE((p_data->>'transport_fee')::BIGINT, 0),
    v_room_id,
    v_eff_sales_coll,
    v_eff_change_coll,
    v_eff_safe_deposited,
    v_reserve_used,
    COALESCE((p_data->>'gift_bonus_amount')::BIGINT, 0)
  )
  ON CONFLICT (therapist_id, date) DO UPDATE SET
    total_sales         = EXCLUDED.total_sales,
    total_back          = EXCLUDED.total_back,
    total_nomination    = EXCLUDED.total_nomination,
    total_options       = EXCLUDED.total_options,
    total_extension     = EXCLUDED.total_extension,
    total_discount      = EXCLUDED.total_discount,
    total_card          = EXCLUDED.total_card,
    total_paypay        = EXCLUDED.total_paypay,
    total_cash          = EXCLUDED.total_cash,
    order_count         = EXCLUDED.order_count,
    is_settled          = EXCLUDED.is_settled,
    adjustment          = EXCLUDED.adjustment,
    adjustment_note     = EXCLUDED.adjustment_note,
    invoice_deduction   = EXCLUDED.invoice_deduction,
    has_invoice         = EXCLUDED.has_invoice,
    withholding_tax     = EXCLUDED.withholding_tax,
    final_payment       = EXCLUDED.final_payment,
    welfare_fee         = EXCLUDED.welfare_fee,
    transport_fee       = EXCLUDED.transport_fee,
    room_id             = EXCLUDED.room_id,
    sales_collected     = EXCLUDED.sales_collected,
    change_collected    = EXCLUDED.change_collected,
    safe_deposited      = EXCLUDED.safe_deposited,
    reserve_used_amount = EXCLUDED.reserve_used_amount,
    gift_bonus_amount   = EXCLUDED.gift_bonus_amount
  RETURNING id INTO v_settlement_id;

  -- ② gift_payouts: pending → paid
  --    settleGiftPayoutIds に含まれる ID のうち、まだ pending のものだけを更新
  IF jsonb_array_length(COALESCE(p_data->'gift_payout_ids', '[]'::JSONB)) > 0 THEN
    WITH updated AS (
      UPDATE gift_payouts
      SET status          = 'paid',
          settlement_id   = v_settlement_id,
          settlement_date = v_date,
          paid_at         = v_now
      WHERE id IN (
              SELECT (jsonb_array_elements_text(p_data->'gift_payout_ids'))::BIGINT
            )
        AND status = 'pending'
      RETURNING id
    )
    SELECT COUNT(*) INTO v_gift_bonus_count FROM updated;
  END IF;

  -- ③ 過去未回収売上の sales_collected フラグ更新
  --    ra && effectiveSalesCollected の場合、past_uncollected_sales_dates を一括更新
  IF v_eff_sales_coll
     AND v_room_id > 0
     AND jsonb_array_length(COALESCE(p_data->'past_uncollected_sales_dates', '[]'::JSONB)) > 0 THEN
    UPDATE therapist_daily_settlements
    SET sales_collected = true
    WHERE room_id = v_room_id
      AND date IN (
            SELECT (jsonb_array_elements_text(p_data->'past_uncollected_sales_dates'))::DATE
          )
      AND sales_collected = false;
  END IF;

  -- ④ 過去未回収釣銭の change_collected フラグ更新
  IF v_eff_change_coll
     AND v_room_id > 0
     AND jsonb_array_length(COALESCE(p_data->'past_uncollected_change_dates', '[]'::JSONB)) > 0 THEN
    UPDATE therapist_daily_settlements
    SET change_collected = true
    WHERE room_id = v_room_id
      AND date IN (
            SELECT (jsonb_array_elements_text(p_data->'past_uncollected_change_dates'))::DATE
          )
      AND change_collected = false;
  END IF;

  -- ⑤ 豊橋予備金: 既存の精算連動 withdraw エントリを削除
  --    (再編集時の冪等性を確保)
  DELETE FROM toyohashi_reserve_movements
  WHERE therapist_id  = v_therapist_id
    AND movement_date = v_date
    AND movement_type = 'withdraw'
    AND note          = v_link_note;

  -- ⑥ 豊橋予備金: 必要なら新規 INSERT
  IF v_reserve_used > 0 THEN
    INSERT INTO toyohashi_reserve_movements (
      movement_date, movement_type, amount, therapist_id,
      recorded_by_name, note
    ) VALUES (
      v_date, 'withdraw', v_reserve_used, v_therapist_id,
      '精算モーダル自動連動', v_link_note
    );
  END IF;

  -- ⑦ 釣銭補充: 既存の自動補充レコードを削除 (room_id があるときのみ)
  IF v_room_id > 0 THEN
    DELETE FROM room_cash_replenishments
    WHERE room_id      = v_room_id
      AND date         = v_date
      AND therapist_id = v_therapist_id
      AND staff_name   = '精算モーダル自動補充';

    -- ⑧ 釣銭補充: 必要なら新規 INSERT
    IF v_replenish_used > 0 THEN
      INSERT INTO room_cash_replenishments (
        room_id, date, amount, therapist_id, staff_name
      ) VALUES (
        v_room_id, v_date, v_replenish_used, v_therapist_id, '精算モーダル自動補充'
      );
    END IF;
  END IF;

  -- ─── 成功時、サマリー情報を返却 ───
  RETURN jsonb_build_object(
    'settlement_id',     v_settlement_id,
    'gift_bonus_count',  v_gift_bonus_count
  );
END;
$$;

COMMENT ON FUNCTION confirm_settlement(JSONB) IS
  'セラピスト日次精算のアトミック確定。9 個のオペレーションを 1 トランザクションでまとめ、エラー時は ROLLBACK。健康診断レポート 2026-04-26 Fix #3 対応。';

-- ─── 動作確認用 SELECT (実行前に DRY-RUN したい場合のサンプル) ───
-- SELECT confirm_settlement('{
--   "therapist_id": 1,
--   "therapist_name": "テスト",
--   "date": "2026-04-26",
--   "room_id": 1,
--   "total_sales": 30000,
--   "total_back": 15000,
--   "total_nomination": 0,
--   "total_options": 0,
--   "total_extension": 0,
--   "total_discount": 0,
--   "total_card": 0,
--   "total_paypay": 0,
--   "total_cash": 30000,
--   "order_count": 1,
--   "adjustment": 0,
--   "adjustment_note": "",
--   "invoice_deduction": 0,
--   "has_invoice": true,
--   "withholding_tax": 0,
--   "final_payment": 14500,
--   "welfare_fee": 500,
--   "transport_fee": 0,
--   "effective_sales_collected": true,
--   "effective_change_collected": true,
--   "effective_safe_deposited": false,
--   "reserve_used_amount": 0,
--   "replenish_used_amount": 0,
--   "gift_bonus_amount": 0,
--   "gift_payout_ids": [],
--   "past_uncollected_sales_dates": [],
--   "past_uncollected_change_dates": []
-- }'::jsonb);
