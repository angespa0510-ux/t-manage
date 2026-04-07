-- =============================================
-- セッション⑳: リアルタイム速報用 store_settings
-- =============================================

-- Bluesky認証情報
INSERT INTO store_settings (key, value) VALUES ('bsky_id', '') ON CONFLICT (key) DO NOTHING;
INSERT INTO store_settings (key, value) VALUES ('bsky_pw', '') ON CONFLICT (key) DO NOTHING;

-- エステ魂認証情報（ルーム別）
INSERT INTO store_settings (key, value) VALUES ('estama_id_mikawa', '') ON CONFLICT (key) DO NOTHING;
INSERT INTO store_settings (key, value) VALUES ('estama_pw_mikawa', '') ON CONFLICT (key) DO NOTHING;
INSERT INTO store_settings (key, value) VALUES ('estama_id_toyohashi', '') ON CONFLICT (key) DO NOTHING;
INSERT INTO store_settings (key, value) VALUES ('estama_pw_toyohashi', '') ON CONFLICT (key) DO NOTHING;

-- ※ Bluesky: 速報パネルの⚙️設定 or システム設定→速報タブから入力
-- ※ エステ魂: システム設定→速報タブ→STEP3から入力
