-- ==========================================================================
-- session81_fix_newline_literal.sql
--
-- DB内の "\n" リテラル文字列を実際の改行コードに変換
--
-- 背景:
--   ユーザーが画面で確認したところ、チャットボットの応答に "\n" が
--   そのまま文字として表示されていた。
--
--   例: "...特典があります：\n・会員様限定の写真閲覧\n・ポイント制度"
--
--   これは hp_chatbot_faqs.answer に "\n" がリテラル文字列（バックスラッシュ + n）
--   として保存されていることが原因。本来は実際の改行コード(LF)である必要がある。
--
-- 影響範囲:
--   - hp_chatbot_faqs.answer (FAQ回答)
--   - hp_chatbot_settings.greeting_message / fallback_message (念のため)
--
-- 補足:
--   コード側 (ChatbotWidget.tsx) でも "\n" を改行に変換する防御を入れているので、
--   このSQLを実行しなくても表示は直るが、データ自体をクリーンにしておくと
--   将来の混乱を防げる。
-- ==========================================================================

-- ==========================================================================
-- STEP 1: 確認 - "\n" リテラルを含むレコードを表示
-- ==========================================================================

SELECT 'hp_chatbot_faqs' AS table_name,
       id::text || ': ' || question AS identifier,
       answer AS content
FROM hp_chatbot_faqs
WHERE answer LIKE '%\n%';

SELECT 'hp_chatbot_settings' AS table_name,
       'greeting_message' AS field,
       greeting_message AS content
FROM hp_chatbot_settings
WHERE greeting_message LIKE '%\n%'

UNION ALL

SELECT 'hp_chatbot_settings' AS table_name,
       'fallback_message' AS field,
       fallback_message AS content
FROM hp_chatbot_settings
WHERE fallback_message LIKE '%\n%';


-- ==========================================================================
-- STEP 2: 置換実行
-- ==========================================================================

-- 2-1. hp_chatbot_faqs.answer の "\n" → 改行コード
--      E'\\n' = リテラル "\n"、E'\n' = 改行コード (LF)
UPDATE hp_chatbot_faqs
SET answer = REPLACE(answer, E'\\n', E'\n'),
    updated_at = NOW()
WHERE answer LIKE '%\n%';

-- 2-2. hp_chatbot_settings の挨拶/フォールバック (念のため)
UPDATE hp_chatbot_settings
SET greeting_message = REPLACE(greeting_message, E'\\n', E'\n'),
    fallback_message = REPLACE(fallback_message, E'\\n', E'\n'),
    updated_at = NOW()
WHERE greeting_message LIKE '%\n%' OR fallback_message LIKE '%\n%';


-- ==========================================================================
-- STEP 3: 結果確認
-- ==========================================================================

-- 残存ゼロ確認
SELECT 'hp_chatbot_faqs'     AS tbl, COUNT(*) AS remaining
FROM hp_chatbot_faqs WHERE answer LIKE '%\n%'
UNION ALL
SELECT 'hp_chatbot_settings_greeting' AS tbl, COUNT(*) AS remaining
FROM hp_chatbot_settings WHERE greeting_message LIKE '%\n%'
UNION ALL
SELECT 'hp_chatbot_settings_fallback' AS tbl, COUNT(*) AS remaining
FROM hp_chatbot_settings WHERE fallback_message LIKE '%\n%';

-- 修正後の例 (Q12 会員登録のメリット を表示)
SELECT id, question, answer FROM hp_chatbot_faqs WHERE id IN (3, 12);
