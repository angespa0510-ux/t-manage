-- =====================================================
-- Session 60: call_ai_settings のモデル名を正式API形式に統一
-- =====================================================
-- 問題:
--   session58 で挿入された初期データの default_model / escalation_model が
--   'sonnet-4-6' / 'opus-4-7' という短縮形で保存されていた。
--   一方、call-analyze API は Anthropic API の正式なモデル名
--   'claude-sonnet-4-6' / 'claude-opus-4-7' をハードコードしている。
--
-- 解決:
--   既存レコードの値を正式API形式に更新し、今後の設定値も同形式で統一。
-- =====================================================

-- 短縮形 → 正式形に一括更新
UPDATE call_ai_settings
SET
  default_model = CASE
    WHEN default_model = 'sonnet-4-6' THEN 'claude-sonnet-4-6'
    WHEN default_model = 'opus-4-7' THEN 'claude-opus-4-7'
    WHEN default_model = 'sonnet-4-5' THEN 'claude-sonnet-4-5'
    WHEN default_model = 'opus-4-6' THEN 'claude-opus-4-6'
    ELSE default_model
  END,
  escalation_model = CASE
    WHEN escalation_model = 'sonnet-4-6' THEN 'claude-sonnet-4-6'
    WHEN escalation_model = 'opus-4-7' THEN 'claude-opus-4-7'
    WHEN escalation_model = 'sonnet-4-5' THEN 'claude-sonnet-4-5'
    WHEN escalation_model = 'opus-4-6' THEN 'claude-opus-4-6'
    ELSE escalation_model
  END,
  updated_at = NOW()
WHERE
  default_model NOT LIKE 'claude-%'
  OR escalation_model NOT LIKE 'claude-%';

-- call_transcripts.ai_model_used も同様に修正
UPDATE call_transcripts
SET ai_model_used = CASE
  WHEN ai_model_used = 'sonnet-4-6' THEN 'claude-sonnet-4-6'
  WHEN ai_model_used = 'opus-4-7' THEN 'claude-opus-4-7'
  WHEN ai_model_used = 'sonnet-4-5' THEN 'claude-sonnet-4-5'
  WHEN ai_model_used = 'opus-4-6' THEN 'claude-opus-4-6'
  ELSE ai_model_used
END
WHERE ai_model_used NOT LIKE 'claude-%' AND ai_model_used <> '';

-- DEFAULT 値も今後のために更新しておく
ALTER TABLE call_ai_settings
  ALTER COLUMN default_model SET DEFAULT 'claude-sonnet-4-6',
  ALTER COLUMN escalation_model SET DEFAULT 'claude-opus-4-7';

ALTER TABLE call_transcripts
  ALTER COLUMN ai_model_used SET DEFAULT 'claude-sonnet-4-6';

-- 確認用クエリ
-- SELECT id, default_model, escalation_model FROM call_ai_settings;
