-- Session 21: HP連携 & LINE送信設定
-- store_settingsテーブルに新キーを追加（upsert対応なのでテーブル変更不要）

-- HP認証情報
-- key: hp_login_id — HP管理画面(Panda Web Concierge)のログインID
-- key: hp_login_pass — HP管理画面のパスワード
-- key: hp_name_map — HP名前マッピング（JSON文字列）

-- 設定はシステム設定ページ → HP連携タブから行う
-- HP出力は部屋割り管理ページの「🌐 HP出力」ボタンから実行

-- 手動で初期値を入れる場合:
-- INSERT INTO store_settings (key, value) VALUES ('hp_login_id', 'your_id') ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
-- INSERT INTO store_settings (key, value) VALUES ('hp_login_pass', 'your_pass') ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
