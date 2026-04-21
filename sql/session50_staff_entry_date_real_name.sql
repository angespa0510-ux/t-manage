-- セッション50: staff テーブルに入社日・本名を追加
--
-- 目的: スタッフ向け証明書発行（業務委託契約証明書・報酬支払証明書・取引実績証明書）に
--       必要なデータをスタッフテーブルに追加する。
--
-- 背景: セラピストには real_name（本名）と entry_date（契約開始日）が既に存在するが、
--       スタッフは name だけで source（源氏名 or 本名）の区別がなく、entry_date もない。
--       現状は name に源氏名で登録されているケースもあるため、real_name 列を新設する。
--
-- 移行ポリシー:
--   - 既存スタッフの real_name は NULL（空）のままスタート
--   - 証明書発行側で real_name が空なら name にフォールバック（当面の運用）
--   - 運用が進んだら管理画面で本名を順次埋めていく

ALTER TABLE staff ADD COLUMN IF NOT EXISTS entry_date date;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS real_name text;

-- RLS は staff 全体で既に無効化されているため追加不要
