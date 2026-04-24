-- =====================================================
-- Session 62: 通話AI 同意管理機能
-- =====================================================
-- 録音開始時にスタッフがお客様に告知したことを記録
-- 顧客属性別のセリフを設定画面から編集可能に
-- =====================================================

-- call_transcripts に同意記録カラムを追加
ALTER TABLE call_transcripts
  ADD COLUMN IF NOT EXISTS consent_notified boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS consent_notified_at timestamptz,
  ADD COLUMN IF NOT EXISTS consent_script_shown text DEFAULT '',
  ADD COLUMN IF NOT EXISTS consent_script_key text DEFAULT '';

-- 同意記録カラムのインデックス（レポート用）
CREATE INDEX IF NOT EXISTS idx_call_transcripts_consent
  ON call_transcripts(consent_notified, started_at DESC);


-- =====================================================
-- call_consent_scripts テーブル
-- 顧客属性別のセリフマスター（編集可能）
-- =====================================================

CREATE TABLE IF NOT EXISTS call_consent_scripts (
  id bigserial PRIMARY KEY,
  script_key text UNIQUE NOT NULL,     -- 'manual_recording' 等の識別キー
  title text DEFAULT '',                -- 設定画面での表示名
  description text DEFAULT '',          -- 説明文
  script_text text NOT NULL,            -- 実際のセリフ
  customer_type text DEFAULT 'all',     -- 'all' | 'new' | 'repeat' | 'vip' | 'caution'
  sort_order int DEFAULT 0,
  is_active boolean DEFAULT true,
  updated_at timestamptz DEFAULT now(),
  updated_by_name text DEFAULT ''
);

ALTER TABLE call_consent_scripts DISABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_call_consent_scripts_key
  ON call_consent_scripts(script_key);
CREATE INDEX IF NOT EXISTS idx_call_consent_scripts_active
  ON call_consent_scripts(is_active) WHERE is_active = true;


-- =====================================================
-- 初期データ投入
-- =====================================================

INSERT INTO call_consent_scripts
  (script_key, title, description, script_text, customer_type, sort_order)
VALUES
  (
    'manual_recording',
    '録音ボタン押下時（共通）',
    'スタッフが手動で「録音開始」ボタンを押した時に表示するセリフ',
    'サービス品質向上のため、通話を録音させていただきます。ご了承ください。',
    'all',
    10
  ),
  (
    'new_customer_greeting',
    '新規のお客様 着信時',
    '新規顧客からの着信時、CTIポップアップに表示する挨拶＋録音告知',
    'お電話ありがとうございます、アンジュスパでございます。サービス品質向上のため、通話を録音させていただいております。',
    'new',
    20
  ),
  (
    'repeat_customer_greeting',
    'リピーター 着信時',
    'リピーターからの着信時の挨拶（録音する場合の告知付き）',
    'お電話ありがとうございます、アンジュスパでございます。いつもご利用ありがとうございます。',
    'repeat',
    30
  ),
  (
    'vip_customer_greeting',
    'VIP・常連様 着信時',
    'VIP・常連様からの着信時の挨拶',
    'いつも大変お世話になっております、アンジュスパでございます。',
    'vip',
    40
  ),
  (
    'caution_customer_greeting',
    '要注意顧客 着信時',
    '要注意顧客からの着信時の挨拶（丁寧対応＋録音告知）',
    'お電話ありがとうございます、アンジュスパでございます。品質向上のため通話を録音させていただいております。',
    'caution',
    50
  ),
  (
    'midcall_recording',
    '通話途中から録音開始',
    '通話中に追加で録音を開始する際にお客様にお伝えするセリフ',
    'ここからは、より正確にお話を伺うため、通話を録音させていただきます。よろしいでしょうか？',
    'all',
    60
  )
ON CONFLICT (script_key) DO NOTHING;
