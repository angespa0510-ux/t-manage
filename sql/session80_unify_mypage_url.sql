-- ==========================================================================
-- session80_unify_mypage_url.sql
--
-- DB内の /customer-mypage 参照を実在URL /mypage に統一
--
-- 背景:
--   旧 URL 構造では /customer-mypage を想定していたが、2026-04-26 のドメイン
--   分離で /mypage が お客様マイページの正式URLとなった。
--   session79 で member_cta_url のデフォルト値を /customer-mypage で入れて
--   しまったため、これを /mypage に統一する。
--
-- 影響範囲:
--   - hp_chatbot_settings.member_cta_url (チャットの会員登録CTAボタン遷移先)
--   - hp_chatbot_faqs.answer (FAQ回答内のリンク)
-- ==========================================================================

-- ==========================================================================
-- STEP 1: 確認 - どこに /customer-mypage が残っているか
-- ==========================================================================

SELECT 'hp_chatbot_settings' AS table_name,
       id::text AS identifier,
       member_cta_url AS content
FROM hp_chatbot_settings
WHERE member_cta_url LIKE '%/customer-mypage%';

SELECT 'hp_chatbot_faqs' AS table_name,
       id::text || ': ' || question AS identifier,
       answer AS content
FROM hp_chatbot_faqs
WHERE answer LIKE '%/customer-mypage%';


-- ==========================================================================
-- STEP 2: 置換実行
-- ==========================================================================

-- 2-1. hp_chatbot_settings.member_cta_url を /mypage に統一
UPDATE hp_chatbot_settings
SET member_cta_url = REPLACE(member_cta_url, '/customer-mypage', '/mypage'),
    updated_at = NOW()
WHERE member_cta_url LIKE '%/customer-mypage%';

-- 2-2. hp_chatbot_faqs.answer 内のリンク全て置換
UPDATE hp_chatbot_faqs
SET answer = REPLACE(answer, '/customer-mypage', '/mypage'),
    updated_at = NOW()
WHERE answer LIKE '%/customer-mypage%';


-- ==========================================================================
-- STEP 3: 結果確認
-- ==========================================================================

-- 残存ゼロを確認
SELECT 'hp_chatbot_settings' AS tbl, COUNT(*) AS remaining
FROM hp_chatbot_settings WHERE member_cta_url LIKE '%/customer-mypage%'
UNION ALL
SELECT 'hp_chatbot_faqs' AS tbl, COUNT(*) AS remaining
FROM hp_chatbot_faqs WHERE answer LIKE '%/customer-mypage%';

-- 修正後の値を表示
SELECT id, member_cta_text, member_cta_url FROM hp_chatbot_settings;
