-- ═══════════════════════════════════════════════════════════
-- Session 62-B: HP お客様チャットBOT（ange-spa.com）
--
-- 目的:
--   公式HPに AI チャットBOT を設置し、お客様の質問に 24時間 応答。
--   ただし、無制限に AI を叩くとコストがかかるので 3段階構成:
--     1. 事前 FAQ（ボタンで選べる選択肢）→ AIコスト 0
--     2. キャッシュ（過去の類似質問の回答）→ AIコスト 0
--     3. AI（Claude Sonnet）→ 上記でヒットしなかった時のみ
--
--   事前に「コース料金」「予約方法」「アクセス」など、
--   よくある質問を項目化してボタン表示する。
--   お客様が項目を選ぶと即座に回答を返す（AI を使わない）。
--
-- 既存の RLS 無効化方針に準拠。
-- ═══════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────
-- ① FAQ マスター（ボタンで選べる事前回答）
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hp_chatbot_faqs (
  id bigserial PRIMARY KEY,
  category text NOT NULL DEFAULT 'その他',      -- 'コース・料金' | '予約方法' | 'アクセス' | 'セラピスト' | '支払い' | '会員' | 'その他'
  question text NOT NULL,                        -- ボタンに表示する質問テキスト
  answer text NOT NULL,                          -- 回答本文（Markdown 可）
  keywords text[] DEFAULT '{}',                  -- キーワードマッチ用（「料金」「値段」等）
  display_order int DEFAULT 0,
  is_active boolean DEFAULT true,
  is_featured boolean DEFAULT false,             -- 初期表示する目玉質問
  view_count int DEFAULT 0,                      -- クリック回数
  helpful_count int DEFAULT 0,                   -- 「役に立った」
  unhelpful_count int DEFAULT 0,                 -- 「役に立たなかった」
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hp_faq_category ON hp_chatbot_faqs(category);
CREATE INDEX IF NOT EXISTS idx_hp_faq_active ON hp_chatbot_faqs(is_active, display_order);
CREATE INDEX IF NOT EXISTS idx_hp_faq_featured ON hp_chatbot_faqs(is_featured) WHERE is_featured = true;

-- ─────────────────────────────────────────────
-- ② キャッシュ（過去質問の正規化＋回答）
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hp_chatbot_cache (
  id bigserial PRIMARY KEY,
  normalized_q text UNIQUE NOT NULL,             -- 正規化済み質問（小文字化・空白圧縮）
  original_q text NOT NULL,                      -- 元の質問
  answer text NOT NULL,
  source text DEFAULT 'ai',                      -- 'faq' | 'ai' | 'manual'
  source_faq_id bigint REFERENCES hp_chatbot_faqs(id) ON DELETE SET NULL,
  hit_count int DEFAULT 0,
  is_approved boolean DEFAULT true,              -- 管理者が確認済みか（低品質回答を止める）
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hp_cache_norm ON hp_chatbot_cache(normalized_q);
CREATE INDEX IF NOT EXISTS idx_hp_cache_hit ON hp_chatbot_cache(hit_count DESC);

-- ─────────────────────────────────────────────
-- ③ 会話ログ（分析用）
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hp_chatbot_logs (
  id bigserial PRIMARY KEY,
  session_id text NOT NULL,                      -- ブラウザセッション識別子（cookie ID）
  question text NOT NULL,
  answer text,
  source text,                                   -- 'faq' | 'cache' | 'ai' | 'fallback'
  matched_faq_id bigint REFERENCES hp_chatbot_faqs(id) ON DELETE SET NULL,
  used_cache boolean DEFAULT false,
  used_ai boolean DEFAULT false,
  response_time_ms int DEFAULT 0,
  user_agent text,
  referer text,                                  -- 流入元ページ
  rating int,                                    -- 1=役立った, -1=役立たず, NULL=未評価
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hp_log_session ON hp_chatbot_logs(session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hp_log_source ON hp_chatbot_logs(source);
CREATE INDEX IF NOT EXISTS idx_hp_log_ai ON hp_chatbot_logs(used_ai, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hp_log_rating ON hp_chatbot_logs(rating) WHERE rating IS NOT NULL;

-- ─────────────────────────────────────────────
-- ④ チャットBOT 設定
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hp_chatbot_settings (
  id bigserial PRIMARY KEY,
  is_enabled boolean DEFAULT true,
  greeting_message text DEFAULT 'こんにちは！Ange Spa へようこそ。下のメニューからお気軽にお問い合わせください。',
  fallback_message text DEFAULT 'お問い合わせ内容について、お調べしております。お急ぎの場合は直接店舗までお電話ください。',
  ai_enabled boolean DEFAULT true,                -- AI フォールバックの有無
  ai_monthly_budget_jpy numeric(10,2) DEFAULT 5000,
  ai_current_month_usage_jpy numeric(10,2) DEFAULT 0,
  ai_current_month text,                          -- 'YYYY-MM'
  ai_stopped_reason text,                         -- 予算超過で停止時の理由
  show_member_cta boolean DEFAULT true,           -- 会員登録への誘導を表示するか
  member_cta_text text DEFAULT '会員登録すると限定写真・特別料金をご覧いただけます',
  max_questions_per_session int DEFAULT 20,       -- 1セッションで質問可能な回数
  updated_at timestamptz DEFAULT now()
);

INSERT INTO hp_chatbot_settings (id, is_enabled)
  VALUES (1, true)
  ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────
-- 初期 FAQ データ投入（チョップ向け・15件）
-- ─────────────────────────────────────────────
INSERT INTO hp_chatbot_faqs (category, question, answer, keywords, display_order, is_featured) VALUES
  ('コース・料金', 'コースと料金を教えてください', 'コース一覧と料金は「料金・コース」ページからご確認いただけます。当店では 60分・90分・120分 の各コースをご用意しております。詳細は [コース一覧](/system) をご覧ください。', ARRAY['料金','値段','価格','コース','時間'], 1, true),
  ('コース・料金', '指名料はいくらですか', '本指名 1,000円、ネット指名 無料です。初回のお客様は「フリー」でもご予約可能です。', ARRAY['指名','指名料'], 2, true),
  ('予約方法', '予約はどうやってすればいいですか', 'ご予約は以下の方法でお受けしています：\n・公式LINE（推奨）\n・お電話\n・ホームページの予約フォーム\n24時間受付しております。', ARRAY['予約','予約方法','ライン','電話'], 3, true),
  ('予約方法', '当日予約は可能ですか', 'はい、当日予約も空きがあればお受けしています。お急ぎの場合はお電話が確実です。', ARRAY['当日','当日予約'], 4, false),
  ('予約方法', 'キャンセルはどうすればいいですか', 'キャンセルは施術開始の2時間前までにご連絡ください。それ以降は100%のキャンセル料が発生いたします。', ARRAY['キャンセル','変更'], 5, false),
  ('アクセス', 'お店はどこにありますか', '当店は豊橋ルームと三河安城ルームの2店舗を運営しております。詳しいアクセス情報は [アクセスページ](/access) をご覧ください。', ARRAY['場所','住所','アクセス','行き方'], 6, true),
  ('アクセス', '駐車場はありますか', '店舗周辺のコインパーキングをご利用ください。駐車場代のサービスは行っておりません。', ARRAY['駐車場','車'], 7, false),
  ('セラピスト', 'セラピストの写真は見られますか', '[セラピスト一覧](/therapist) ページですべてのキャストをご紹介しております。会員登録いただくと、会員様限定の写真もご覧いただけます。', ARRAY['セラピスト','キャスト','写真','女の子'], 8, true),
  ('セラピスト', '出勤スケジュールはどこで確認できますか', '[スケジュール](/schedule) ページで本日・明日以降の出勤予定をリアルタイムでご確認いただけます。', ARRAY['出勤','スケジュール','予定'], 9, false),
  ('支払い', '支払い方法は何がありますか', '現金・クレジットカード（VISA/Master/JCB/AMEX）・PayPay に対応しております。', ARRAY['支払い','カード','現金','paypay'], 10, true),
  ('支払い', 'カード決済に手数料はかかりますか', 'カード・PayPay でのお支払いの場合、決済手数料として10%加算させていただきます。', ARRAY['手数料','カード手数料'], 11, false),
  ('会員', '会員登録のメリットは何ですか', '会員登録いただくと以下の特典があります：\n・会員様限定のセラピスト写真閲覧\n・ポイント制度（来店ごとに付与）\n・予約履歴・お気に入り登録\n・限定キャンペーン情報\n登録は無料です。', ARRAY['会員','登録','メリット','特典'], 12, true),
  ('会員', '会員登録はどこからできますか', '[会員登録ページ](/customer-mypage) から簡単に登録いただけます。メールアドレスとお電話番号のみでご登録可能です。', ARRAY['会員登録','登録方法','入会'], 13, false),
  ('その他', '初めてでも大丈夫ですか', 'もちろん大丈夫です。初めてのお客様も多くご来店いただいておりますので、安心してお越しください。スタッフが丁寧にご案内いたします。', ARRAY['初めて','初回','初心者'], 14, false),
  ('その他', '営業時間を教えてください', '営業時間は店舗ごとに異なります。最新の営業時間は [アクセスページ](/access) でご確認ください。', ARRAY['営業時間','時間','何時'], 15, false)
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────
-- RLS 無効化
-- ─────────────────────────────────────────────
ALTER TABLE hp_chatbot_faqs DISABLE ROW LEVEL SECURITY;
ALTER TABLE hp_chatbot_cache DISABLE ROW LEVEL SECURITY;
ALTER TABLE hp_chatbot_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE hp_chatbot_settings DISABLE ROW LEVEL SECURITY;
