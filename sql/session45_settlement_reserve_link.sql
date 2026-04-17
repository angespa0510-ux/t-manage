-- セッション45: 精算モーダルと豊橋予備金の連動
-- therapist_daily_settlements に reserve_used_amount カラムを追加

ALTER TABLE therapist_daily_settlements 
ADD COLUMN IF NOT EXISTS reserve_used_amount bigint DEFAULT 0;

COMMENT ON COLUMN therapist_daily_settlements.reserve_used_amount IS '豊橋予備金から立替した金額（精算モーダルの「予備金から補充」トグル）';

CREATE INDEX IF NOT EXISTS idx_settlements_reserve_used ON therapist_daily_settlements(reserve_used_amount) WHERE reserve_used_amount > 0;

-- 連動ロジック:
-- 1. timechart 精算モーダルで cashBalance < 0 の時、「予備金から補充」トグルが表示される
-- 2. ONにして清算確定すると:
--    - therapist_daily_settlements.reserve_used_amount = abs(cashBalance)
--    - toyohashi_reserve_movements に withdraw エントリ自動作成
--      (therapist_id, movement_date = 精算日, amount, note='精算連動:{セラピスト名}')
-- 3. 再編集時は、既存の対応する withdraw エントリを更新/削除してから再作成
-- 4. 日次集計・資金管理ダッシュボードは、このデータから自動で集計表示

-- 運用フロー:
-- - 管理者は後日、スタッフ金庫から豊橋予備金に補充 (既存の「📥 補充」モーダルで記録)
-- - 立替と補充が同額になれば、豊橋予備金の残高が元に戻る
