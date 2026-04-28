-- ==========================================================================
-- session97_treatment_charts_auto_backfill.sql (Revised)
--
-- treatment_charts (施術カルテ) の customer_id / therapist_id を
-- reservation_id から自動補完する。
--
-- 【修正履歴】
--   v1: store_id も補完しようとしていたが、reservations テーブルには
--       store_id カラムが存在しなかったため削除。
--       store_id は将来 reservations.room_id → rooms.store_id 経由で
--       補完する別 SQL を用意する想定 (今回はスコープ外)。
--
-- 【目的】
--   - 既存のカルテレコードは reservation_id しか紐付いていないものが多いため
--     customer_id 等の検索効率が悪い (reservation 経由の二段検索が必要)
--   - 今後の新規カルテも、フロントが reservation_id しか送らない場合に
--     DB 側で自動補完されるようにする
--
-- 【方針】
--   STEP 1: 既存レコードの一括補完
--           reservation_id 経由で reservations / customers から逆引き
--   STEP 2: BEFORE INSERT/UPDATE トリガで今後も自動補完
--   STEP 3: 動作確認クエリ (コメントアウト済)
--
-- 【顧客紐付け】
--   reservations.customer_name (text) ←→ customers.name (text) で完全一致
--   ※ 表記ゆれがあるレコードは customer_id NULL のままになる (既存運用と同じ)
--
-- 関連: docs/23_TREATMENT_CHART.md
-- ==========================================================================


-- ==========================================================================
-- STEP 1: 既存カルテの customer_id / therapist_id を一括補完
-- ==========================================================================

-- (1) therapist_id の補完 — reservation.therapist_id をコピー
UPDATE treatment_charts tc
   SET therapist_id = r.therapist_id
  FROM reservations r
 WHERE tc.reservation_id = r.id
   AND tc.therapist_id IS NULL
   AND r.therapist_id IS NOT NULL;

-- (2) customer_id の補完 — reservation.customer_name → customers.name で逆引き
--     完全一致のみ (表記ゆれは NULL のままで運用継続)
UPDATE treatment_charts tc
   SET customer_id = c.id
  FROM reservations r
  JOIN customers c ON c.name = r.customer_name
 WHERE tc.reservation_id = r.id
   AND tc.customer_id IS NULL
   AND r.customer_name IS NOT NULL
   AND r.customer_name <> '';


-- ==========================================================================
-- STEP 2: BEFORE INSERT/UPDATE トリガ — 今後の自動補完
-- ==========================================================================
-- treatment_charts へ INSERT/UPDATE する際、reservation_id があり、かつ
-- customer_id / therapist_id が NULL の場合は reservation から逆引きして補完。
-- アプリ層が reservation_id だけ渡してくる現状の挙動を維持しつつ、
-- 結果として customer_id 検索ができるようになる。

CREATE OR REPLACE FUNCTION trg_treatment_charts_auto_backfill()
RETURNS trigger AS $$
DECLARE
  v_customer_name text;
  v_therapist_id  bigint;
  v_customer_id   bigint;
BEGIN
  -- reservation_id がない場合は何もしない (NULL のまま受け入れる)
  IF NEW.reservation_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- reservation の情報を取得
  SELECT customer_name, therapist_id
    INTO v_customer_name, v_therapist_id
    FROM reservations
   WHERE id = NEW.reservation_id;

  -- 該当する reservation がなければ何もしない
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- therapist_id が NULL なら補完
  IF NEW.therapist_id IS NULL AND v_therapist_id IS NOT NULL THEN
    NEW.therapist_id := v_therapist_id;
  END IF;

  -- customer_id が NULL かつ customer_name で逆引き可能なら補完
  IF NEW.customer_id IS NULL AND v_customer_name IS NOT NULL AND v_customer_name <> '' THEN
    SELECT id INTO v_customer_id
      FROM customers
     WHERE name = v_customer_name
     LIMIT 1;
    IF FOUND THEN
      NEW.customer_id := v_customer_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 既存トリガを削除してから再作成 (冪等)
DROP TRIGGER IF EXISTS treatment_charts_auto_backfill ON treatment_charts;

CREATE TRIGGER treatment_charts_auto_backfill
  BEFORE INSERT OR UPDATE ON treatment_charts
  FOR EACH ROW
  EXECUTE FUNCTION trg_treatment_charts_auto_backfill();

COMMENT ON FUNCTION trg_treatment_charts_auto_backfill() IS
  'カルテの customer_id/therapist_id を reservation_id 経由で自動補完。reservations.customer_name → customers.name で完全一致のみ。store_id は reservations にカラムがないため対象外。';


-- ==========================================================================
-- STEP 3: 動作確認クエリ (実行は手動で)
-- ==========================================================================
-- -- カルテ全体の補完率を確認
-- SELECT
--   COUNT(*)                                      AS total,
--   COUNT(*) FILTER (WHERE customer_id IS NULL)   AS missing_customer,
--   COUNT(*) FILTER (WHERE therapist_id IS NULL)  AS missing_therapist
-- FROM treatment_charts;
--
-- -- 補完できなかったカルテの reservation を見る (表記ゆれの確認)
-- SELECT tc.id, tc.reservation_id, r.customer_name AS res_customer_name
-- FROM treatment_charts tc
-- JOIN reservations r ON r.id = tc.reservation_id
-- WHERE tc.customer_id IS NULL
--   AND r.customer_name IS NOT NULL
--   AND r.customer_name <> '';
--
-- -- 試験 INSERT (reservation_id だけ指定 → customer_id 等が自動で埋まることを確認)
-- INSERT INTO treatment_charts (reservation_id, pre_condition)
-- VALUES (1, 'トリガテスト')
-- RETURNING id, reservation_id, customer_id, therapist_id;
-- → customer_id / therapist_id が自動で埋まっていれば成功


-- ==========================================================================
-- 補足: store_id 補完について
-- ==========================================================================
-- reservations テーブルには store_id カラムが存在しないため、本 SQL では
-- treatment_charts.store_id の自動補完は行わない。
--
-- 将来 store_id を補完したい場合は以下のいずれかの方法を採用:
--   (A) reservations.room_id → rooms.store_id 経由で補完
--   (B) reservations.free_building_id → buildings.store_id 経由で補完
--   (C) shifts (date + therapist_id 一致) 経由で補完
--
-- 1店舗運用 (チョップのみ) の場合は store_id = 1 で固定して問題ないので、
-- 必要なら以下を一度だけ実行:
--   UPDATE treatment_charts SET store_id = 1 WHERE store_id IS NULL;
