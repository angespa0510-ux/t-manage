-- ==========================================================================
-- session79_chatbot_member_cta_url.sql
--
-- hp_chatbot_settings に member_cta_url カラムを追加
--
-- 背景:
--   ChatbotWidget は会員登録CTAボタンの遷移先として settings.member_cta_url
--   を参照しているが、DB側に当該カラムが存在せず、API も返していなかった。
--   結果として「会員登録ボタンが常に非表示」になっていた。
--
-- 影響:
--   - 既存 hp_chatbot_settings レコードに member_cta_url が追加される
--   - デフォルト値は /mypage (新お客様マイページのURL)
-- ==========================================================================

-- カラム追加 (デフォルト値付き)
ALTER TABLE hp_chatbot_settings
ADD COLUMN IF NOT EXISTS member_cta_url TEXT DEFAULT '/mypage';

-- 既存レコードに値を入れる (NULL の場合のみ)
UPDATE hp_chatbot_settings
SET member_cta_url = '/mypage'
WHERE member_cta_url IS NULL OR member_cta_url = '';

-- 確認
SELECT id, is_enabled, show_member_cta, member_cta_text, member_cta_url
FROM hp_chatbot_settings;
