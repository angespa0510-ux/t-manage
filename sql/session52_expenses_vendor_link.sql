-- セッション52: 経費と取引先マスターの紐付け
--
-- 目的: 経費レコードに取引先マスター（vendors）への参照を追加する。
--       これにより:
--         - 経費登録時に取引先を選ぶと、インボイス番号・登録状況が自動補完される
--         - 取引先マスターから「この取引先への年間支払額」を逆引きできる
--         - インボイス未登録の取引先への支払いが集計できる
--
-- 既存の counterpart（自由入力の取引先名）・has_invoice・invoice_number は
-- そのまま残す。vendor_id は NULL 可で、選択しなくても経費登録は可能。

ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS vendor_id bigint REFERENCES vendors(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_expenses_vendor_id ON expenses(vendor_id);

-- RLS 設定は既存の方針に合わせる（expenses は RLS 無効）
-- 追加カラムへの特別な設定は不要
