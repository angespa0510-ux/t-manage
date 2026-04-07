-- =============================================
-- セッション⑳: リアルタイム速報用 store_settings
-- =============================================

-- Bluesky認証情報
INSERT INTO store_settings (key, value) VALUES ('bsky_id', '') ON CONFLICT (key) DO NOTHING;
INSERT INTO store_settings (key, value) VALUES ('bsky_pw', '') ON CONFLICT (key) DO NOTHING;

-- ※ Bluesky IDとパスワードは速報パネルの⚙️設定から入力可能
-- ※ App Passwordの使用を推奨（https://bsky.app/settings/app-passwords）
