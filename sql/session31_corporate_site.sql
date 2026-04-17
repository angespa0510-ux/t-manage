-- ═══════════════════════════════════════════════════════════
-- Session 31: コーポレートサイト強化 (/corporate)
-- stores テーブル拡張 + お知らせ/FAQ/採用テーブル新設
-- ═══════════════════════════════════════════════════════════

-- ─── stores テーブル拡張（コーポレートHP用フィールド）───
ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS representative_name TEXT,
  ADD COLUMN IF NOT EXISTS representative_name_kana TEXT,
  ADD COLUMN IF NOT EXISTS representative_title TEXT DEFAULT '代表社員',
  ADD COLUMN IF NOT EXISTS representative_photo_url TEXT,
  ADD COLUMN IF NOT EXISTS representative_message TEXT,
  ADD COLUMN IF NOT EXISTS company_name_en TEXT,
  ADD COLUMN IF NOT EXISTS company_established TEXT,
  ADD COLUMN IF NOT EXISTS company_capital TEXT,
  ADD COLUMN IF NOT EXISTS company_fiscal TEXT,
  ADD COLUMN IF NOT EXISTS company_email TEXT,
  ADD COLUMN IF NOT EXISTS company_business TEXT,
  ADD COLUMN IF NOT EXISTS company_tagline TEXT,
  ADD COLUMN IF NOT EXISTS company_map_embed TEXT,
  ADD COLUMN IF NOT EXISTS company_website_url TEXT,
  ADD COLUMN IF NOT EXISTS company_employees TEXT,
  ADD COLUMN IF NOT EXISTS company_main_bank TEXT;

-- ─── corporate_news: お知らせ・プレスリリース ───
CREATE TABLE IF NOT EXISTS corporate_news (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT DEFAULT 'news',  -- news | press | event | update
  body TEXT,
  link_url TEXT,
  published_at DATE DEFAULT CURRENT_DATE,
  is_published BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_corporate_news_published ON corporate_news(is_published, published_at DESC);

-- ─── corporate_faqs: よくあるご質問 ───
CREATE TABLE IF NOT EXISTS corporate_faqs (
  id BIGSERIAL PRIMARY KEY,
  category TEXT DEFAULT 'サービス',  -- サービス | 料金 | 導入 | サポート | セキュリティ
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  sort_order INT DEFAULT 0,
  is_published BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_corporate_faqs_sort ON corporate_faqs(is_published, sort_order);

-- ─── corporate_jobs: 採用情報 ───
CREATE TABLE IF NOT EXISTS corporate_jobs (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  job_type TEXT DEFAULT 'full_time',  -- full_time | part_time | contract | intern
  summary TEXT,
  description TEXT,
  requirements TEXT,
  salary_range TEXT,
  location TEXT,
  is_open BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_corporate_jobs_open ON corporate_jobs(is_open, sort_order);

-- ═══════════════════════════════════════════════════════════
-- 初期データ投入
-- ═══════════════════════════════════════════════════════════

-- ─── サンプルお知らせ（3件）───
INSERT INTO corporate_news (title, category, body, published_at) VALUES
('コーポレートサイトをリニューアルしました', 'update', 'より見やすく、弊社の事業内容と実績がお伝えできるデザインに刷新いたしました。今後とも合同会社テラスライフをよろしくお願いいたします。', CURRENT_DATE),
('AI業務支援プラットフォーム「TERA AI」を正式リリース', 'press', '社内ナレッジ学習型のAIチャットボット、書類AI読取・自動分類、売上予測分析を統合した業務支援プラットフォーム「TERA AI」を正式リリースいたしました。', CURRENT_DATE - INTERVAL '7 days'),
('愛知県安城市を拠点にDX推進支援を開始', 'news', 'リラクゼーション業界で培った現場のデジタル化ノウハウを活かし、中小企業向けのDX推進支援サービスを開始しました。', CURRENT_DATE - INTERVAL '21 days')
ON CONFLICT DO NOTHING;

-- ─── サンプルFAQ（12件）───
INSERT INTO corporate_faqs (category, question, answer, sort_order) VALUES
('サービス', 'どのような業種に対応していますか？', 'リラクゼーション・美容・飲食・医療・物流・不動産など、幅広い業種での導入実績がございます。業界特有の商習慣やワークフローを丁寧にヒアリングし、最適なカスタマイズを行います。', 1),
('サービス', 'スマホでも利用できますか？', 'すべての製品はレスポンシブ対応で、PC・タブレット・スマホから快適にご利用いただけます。特に現場スタッフ向けのマイページ機能はスマホファーストで設計されています。', 2),
('料金', '導入費用はどれくらいかかりますか？', '初期費用・月額費用ともに、御社の規模と機能要件により変動いたします。シンプルなプランで月額数万円〜、フルカスタマイズ構築の場合は初期費用100万円〜となります。まずはお気軽にご相談ください。', 3),
('料金', '無料トライアルはありますか？', 'TERA Cloud（業務管理システム）は14日間の無料トライアルをご提供しております。機能を実際にお試しいただいたうえで導入判断していただけます。', 4),
('導入', '導入までの期間はどれくらいですか？', '標準的なケースで、初回ヒアリングから本番稼働まで約4〜8週間を目安としております。既存データの移行やフルカスタマイズが必要な場合はさらにお時間をいただく場合がございます。', 5),
('導入', '既存システムからのデータ移行は可能ですか？', 'CSV・Excelでのインポートに対応しております。他システムからのAPI連携や、スクレイピングによる自動取り込みも対応可能です。移行作業はすべて弊社で実施いたします。', 6),
('導入', '操作研修はありますか？', '導入時に管理者向け・スタッフ向けの操作研修をオンラインで実施いたします。また、AIチャットアシスタントが24時間サポートするため、導入後の「これどうやるの？」もすぐ解決できます。', 7),
('サポート', 'トラブル時のサポートはどのような形ですか？', 'メール・チャットでのサポートを標準提供しており、緊急時は電話対応も可能です。システム稼働率99%以上を維持するため、24時間の自動監視を行っております。', 8),
('サポート', 'カスタマイズ要望は対応してもらえますか？', 'はい、弊社は受託開発を得意としております。現場の声を反映した機能追加・改修を継続的に行うことが可能です。', 9),
('セキュリティ', 'データのバックアップ体制は？', 'Supabase（PostgreSQL）の自動バックアップに加え、日次の差分バックアップを別リージョンに保管しております。万一の際も過去30日間の任意の時点に復旧可能です。', 10),
('セキュリティ', '通信・データ保存のセキュリティは？', '全通信はSSL/TLSで暗号化されており、データベースへのアクセスは認証トークンとRLS（行レベルセキュリティ）で厳格に制御しています。個人情報保護法・改正電子帳簿保存法に準拠した設計です。', 11),
('セキュリティ', '情報漏洩対策は？', 'アクセスログを全量記録し、不正アクセスの検知体制を構築しております。スタッフのアカウントはロールベースのアクセス制御により、職務上必要な情報のみ閲覧可能です。', 12)
ON CONFLICT DO NOTHING;

-- ─── サンプル採用情報（3件）───
INSERT INTO corporate_jobs (title, job_type, summary, description, requirements, salary_range, location, sort_order) VALUES
('フルスタックエンジニア', 'full_time', '自社プロダクトの開発・運用を担うエンジニアを募集。現場の声を反映した機能改善を行うやりがいのあるポジションです。', 'Next.js / TypeScript / Supabase を用いた自社SaaSプロダクトの開発、機能追加、運用保守。現場スタッフや顧客からのフィードバックを受けて、企画から実装まで一貫して携わっていただきます。', '・Web開発実務経験2年以上\n・TypeScript / React の実務経験\n・RDB設計の基本知識\n・リモートワーク環境の自己管理能力', '年収 450万円〜700万円', '愛知県安城市（リモート可）', 1),
('AIエンジニア', 'full_time', 'Claude API や RAG を活用した業務AIソリューション開発を担当。', 'Anthropic Claude API を中心とした AI プロダクトの設計・実装。RAG 構築、プロンプトエンジニアリング、AI エージェント開発。', '・Python または TypeScript での LLM API 利用経験\n・ベクトルDB・埋め込みモデルの基礎知識\n・技術トレンドのキャッチアップ意欲', '年収 500万円〜800万円', '愛知県安城市（フルリモート可）', 2),
('カスタマーサクセス', 'part_time', '導入企業様の活用支援・運用サポートを担当する、顧客と直接向き合うポジション。', '導入企業様への操作研修、活用提案、運用上のお困りごとへの対応。顧客からのフィードバックを開発チームに連携する橋渡し役。', '・BtoB SaaS のカスタマーサクセス経験歓迎\n・丁寧なコミュニケーション能力\n・業務改善提案への関心', '時給 1,500円〜2,000円', '愛知県安城市（一部リモート可）', 3)
ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════════════════════════
-- 会社情報の初期値セット（1件目の store にデフォルトを入れる）
-- 実データはスタッフページの「会社情報」タブから編集可能
-- ═══════════════════════════════════════════════════════════
UPDATE stores SET
  company_name = COALESCE(NULLIF(company_name, ''), '合同会社テラスライフ'),
  company_name_en = COALESCE(NULLIF(company_name_en, ''), 'Terrace Life LLC'),
  representative_title = COALESCE(NULLIF(representative_title, ''), '代表社員'),
  company_fiscal = COALESCE(NULLIF(company_fiscal, ''), '3月決算'),
  company_business = COALESCE(NULLIF(company_business, ''), 'AIソリューション開発、Webデザイン・システム開発、DX推進支援、リラクゼーションサロン運営'),
  company_tagline = COALESCE(NULLIF(company_tagline, ''), 'テクノロジーで、ビジネスの未来をデザインする。'),
  representative_message = COALESCE(NULLIF(representative_message, ''), 'テラスライフは「現場で役立つテクノロジー」を信条に、AIとWebの力で中小企業のDXを支援する会社です。私たち自身がリラクゼーションサロンを運営する事業者でもあるからこそ、現場の「こうだったらいいのに」を肌感覚で理解し、本当に使われるシステムを作ることができます。お客様一社一社の課題に真摯に向き合い、共に成長するパートナーでありたいと考えております。')
WHERE id = (SELECT id FROM stores ORDER BY id LIMIT 1);
