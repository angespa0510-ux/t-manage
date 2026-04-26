-- ==========================================================================
-- session78_brand_rename_chop_to_angespa.sql
--
-- DB内に残っている「チョップ」表記を「Ange Spa」に統一
--
-- 背景:
--   コード側の「チョップ」表記は既にコミット 1e27c12 で全て「Ange Spa」に
--   置換済み。ただし、メール本文や予約メッセージは store_settings.store_name
--   や notification_templates.body のDB値を参照しているため、DB側でも
--   同じ置換が必要。
--
-- ユーザー報告:
--   - パスワード再発行メールの件名「【チョップ】マイページ...」
--   - 本文フッターの「チョップ」
--
-- 影響範囲:
--   - パスワード再発行メール (password-reset API)
--   - 一般メール送信 (deliver-email API)
--   - 写メ日記の駅近サービス送信 (dispatch-ekichika API)
--   - 予約LINEメッセージ (notification_templates 経由のテンプレート)
--   - 顧客通知 (customer_notifications の本文に「チョップ」が含まれる場合)
-- ==========================================================================

-- ==========================================================================
-- STEP 1: 確認 - どこに「チョップ」が残っているか
-- ==========================================================================

-- 1-1. store_settings の「チョップ」
SELECT 'store_settings' AS table_name, key AS identifier, value AS content
FROM store_settings
WHERE value LIKE '%チョップ%';

-- 1-2. notification_templates の「チョップ」
SELECT 'notification_templates' AS table_name,
       template_key AS identifier,
       LEFT(body, 100) AS content_preview
FROM notification_templates
WHERE body LIKE '%チョップ%';

-- 1-3. customer_notifications (お客様への通知履歴) の「チョップ」
--      ※ 過去ログなので件数だけ確認
SELECT 'customer_notifications' AS table_name,
       COUNT(*) AS chop_count
FROM customer_notifications
WHERE title LIKE '%チョップ%' OR body LIKE '%チョップ%';

-- 1-4. notification_logs の「チョップ」
--      ※ 送信ログなので件数だけ確認
SELECT 'notification_logs' AS table_name,
       COUNT(*) AS chop_count
FROM notification_logs
WHERE message LIKE '%チョップ%';


-- ==========================================================================
-- STEP 2: 置換実行
-- ==========================================================================

-- 2-1. store_settings.store_name を 'Ange Spa' に更新
--      存在しない場合は新規挿入
INSERT INTO store_settings (key, value)
VALUES ('store_name', 'Ange Spa')
ON CONFLICT (key) DO UPDATE SET value = 'Ange Spa';

-- 2-2. store_settings 内の他フィールドにも「チョップ」があれば置換
UPDATE store_settings
SET value = REPLACE(value, 'チョップ', 'Ange Spa')
WHERE value LIKE '%チョップ%';

-- 2-3. notification_templates の body 内の「チョップ」を全置換
UPDATE notification_templates
SET body = REPLACE(body, 'チョップ', 'Ange Spa'),
    updated_at = NOW()
WHERE body LIKE '%チョップ%';

-- 2-4. customer_notifications (お客様への過去通知) も置換
--     ※ 既送信済みのログだが、お客様マイページで履歴表示されるので置換推奨
UPDATE customer_notifications
SET title = REPLACE(title, 'チョップ', 'Ange Spa'),
    body  = REPLACE(body,  'チョップ', 'Ange Spa')
WHERE title LIKE '%チョップ%' OR body LIKE '%チョップ%';


-- ==========================================================================
-- STEP 3: 置換結果の確認
-- ==========================================================================

-- 3-1. 残存「チョップ」が0件であることを確認
SELECT 'store_settings'         AS tbl, COUNT(*) AS remaining FROM store_settings        WHERE value LIKE '%チョップ%'
UNION ALL
SELECT 'notification_templates' AS tbl, COUNT(*) AS remaining FROM notification_templates WHERE body  LIKE '%チョップ%'
UNION ALL
SELECT 'customer_notifications' AS tbl, COUNT(*) AS remaining FROM customer_notifications WHERE title LIKE '%チョップ%' OR body LIKE '%チョップ%';

-- 3-2. store_name が 'Ange Spa' になっていることを確認
SELECT key, value FROM store_settings WHERE key = 'store_name';
