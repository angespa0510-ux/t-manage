-- ==========================================================================
-- session91_therapist_training.sql
--
-- ②セラピスト研修・技術ライブラリ — DB基盤構築 + 必須5カリキュラム初期コンテンツ
--
-- 仕様書: docs/24_THERAPIST_TRAINING.md
-- 関連: docs/21_TREATMENT_BUSINESS_POSITIONING.md
--      docs/22_CONTRACT_REDESIGN.md  第10条 研修受講義務
--
-- 【目的】
--   「施術業」として研修制度・技術習得記録を整備し、税務調査時の実態証跡とする。
--   セラピスト全員が定期的に研修を受講している記録 + 研修カリキュラムの体系性
--   (解剖学から始まる学術的アプローチ) で「専門技術者」性を補強する。
--
-- 【スコープ】 Phase 1 (6/1までに必達)
--   - training_categories          : 研修カテゴリ
--   - training_modules             : 研修モジュール (個別レッスン)
--   - therapist_training_records   : 受講記録 (進捗管理)
--   - therapist_skill_badges       : 技術習得バッジ
--   - INDEX, RLS 設定
--   - 必須5カリキュラム + 全9カテゴリの初期データ
--   - 必須5カテゴリの初期モジュールコンテンツ (合計10モジュール)
--
-- 【RLS方針】 仕様書 2.5
--   - セラピスト: 自分の受講記録・バッジのみ閲覧/更新
--   - 管理者: 全セラピストの記録閲覧・バッジ付与可能
--   - 研修教材: 全セラピスト閲覧可能
--   現行 T-MANAGE は Supabase Auth 未使用のため、既存テーブル同様
--   DISABLE + 全許可で運用し、therapist_id 指定でフロント側制御。
-- ==========================================================================


-- ==========================================================================
-- STEP 1: training_categories (研修カテゴリ)
-- ==========================================================================

CREATE TABLE IF NOT EXISTS training_categories (
  id bigserial PRIMARY KEY,
  name          varchar(100) NOT NULL,
  slug          varchar(100) UNIQUE,         -- 'anatomy', 'lymph', 'oil' 等
  description   text,
  level         varchar(20),                 -- 'basic'|'intermediate'|'advanced'
  prerequisites bigint[],                    -- 前提となる他カテゴリのID
  emoji         varchar(10),                 -- '🦴'|'💧'|'🌿' 等
  sort_order    int,
  is_required   boolean DEFAULT false,       -- 必須カテゴリか (入店30日以内必達)
  is_active     boolean DEFAULT true,
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_training_categories_sort
  ON training_categories(sort_order) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_training_categories_required
  ON training_categories(is_required) WHERE is_required = true;

ALTER TABLE training_categories DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "training_categories_all" ON training_categories;
CREATE POLICY "training_categories_all" ON training_categories
  FOR ALL USING (true) WITH CHECK (true);

COMMENT ON TABLE training_categories IS
  '研修カテゴリ (基礎/中級/上級)。docs/24_THERAPIST_TRAINING.md 参照。';


-- ==========================================================================
-- STEP 2: training_modules (研修モジュール = 個別レッスン)
-- ==========================================================================

CREATE TABLE IF NOT EXISTS training_modules (
  id bigserial PRIMARY KEY,
  category_id      bigint REFERENCES training_categories(id) ON DELETE CASCADE,
  title            varchar(200) NOT NULL,
  slug             varchar(200) UNIQUE,           -- 全モジュールで一意 (ON CONFLICT 用)
  content          text,                          -- Markdown対応
  video_url        text,                          -- 動画URL (Phase 2)
  duration_minutes int,                           -- 所要時間
  has_quiz         boolean DEFAULT false,         -- 修了テストの有無
  sort_order       int,
  is_required      boolean DEFAULT false,         -- 必須受講
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

CREATE OR REPLACE FUNCTION trg_training_modules_set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS training_modules_set_updated_at ON training_modules;
CREATE TRIGGER training_modules_set_updated_at
  BEFORE UPDATE ON training_modules
  FOR EACH ROW
  EXECUTE FUNCTION trg_training_modules_set_updated_at();

CREATE INDEX IF NOT EXISTS idx_training_modules_category
  ON training_modules(category_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_training_modules_required
  ON training_modules(is_required) WHERE is_required = true;

ALTER TABLE training_modules DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "training_modules_all" ON training_modules;
CREATE POLICY "training_modules_all" ON training_modules
  FOR ALL USING (true) WITH CHECK (true);

COMMENT ON TABLE training_modules IS
  '研修モジュール (個別レッスン)。content は Markdown。';


-- ==========================================================================
-- STEP 3: therapist_training_records (受講記録)
-- ==========================================================================

CREATE TABLE IF NOT EXISTS therapist_training_records (
  id bigserial PRIMARY KEY,
  therapist_id bigint NOT NULL REFERENCES therapists(id) ON DELETE CASCADE,
  module_id    bigint NOT NULL REFERENCES training_modules(id) ON DELETE CASCADE,

  -- 進捗
  status            varchar(20) DEFAULT 'not_started',  -- 'not_started'|'in_progress'|'completed'
  progress_percent  int DEFAULT 0,
  started_at        timestamptz,
  completed_at      timestamptz,

  -- テスト結果 (任意)
  quiz_score    int,
  quiz_attempts int DEFAULT 0,

  -- メタ
  last_accessed_at timestamptz,
  created_at       timestamptz DEFAULT now(),

  UNIQUE(therapist_id, module_id)
);

CREATE INDEX IF NOT EXISTS idx_training_records_therapist
  ON therapist_training_records(therapist_id);
CREATE INDEX IF NOT EXISTS idx_training_records_status
  ON therapist_training_records(status);
CREATE INDEX IF NOT EXISTS idx_training_records_module
  ON therapist_training_records(module_id);

ALTER TABLE therapist_training_records DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "therapist_training_records_all" ON therapist_training_records;
CREATE POLICY "therapist_training_records_all" ON therapist_training_records
  FOR ALL USING (true) WITH CHECK (true);

COMMENT ON TABLE therapist_training_records IS
  'セラピストの研修受講記録 (進捗管理)。1セラピスト×1モジュール=1レコード。';


-- ==========================================================================
-- STEP 4: therapist_skill_badges (技術習得バッジ)
-- ==========================================================================

CREATE TABLE IF NOT EXISTS therapist_skill_badges (
  id bigserial PRIMARY KEY,
  therapist_id bigint NOT NULL REFERENCES therapists(id) ON DELETE CASCADE,
  category_id  bigint NOT NULL REFERENCES training_categories(id) ON DELETE CASCADE,

  -- 習得状況
  level           varchar(20),  -- 'basic'|'intermediate'|'advanced'|'master'
  acquired_at     timestamptz DEFAULT now(),
  acquired_method varchar(50),  -- 'completed_modules'|'manual_grant'|'external_cert'

  -- 外部資格の場合
  external_certificate_name text,
  external_certificate_url  text,

  -- 評価
  evaluator_id bigint,          -- 評価者 (管理者の staff.id 想定、FKは緩く張らない)
  notes        text,

  created_at timestamptz DEFAULT now(),

  UNIQUE(therapist_id, category_id, level)
);

CREATE INDEX IF NOT EXISTS idx_skill_badges_therapist
  ON therapist_skill_badges(therapist_id);
CREATE INDEX IF NOT EXISTS idx_skill_badges_category
  ON therapist_skill_badges(category_id);

ALTER TABLE therapist_skill_badges DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "therapist_skill_badges_all" ON therapist_skill_badges;
CREATE POLICY "therapist_skill_badges_all" ON therapist_skill_badges
  FOR ALL USING (true) WITH CHECK (true);

COMMENT ON TABLE therapist_skill_badges IS
  'セラピストの技術習得バッジ。公開HPセラピスト紹介ページにも表示予定 (Phase 2)。';


-- ==========================================================================
-- STEP 5: 初期データ — 9カテゴリ
-- ==========================================================================
-- INSERT は ON CONFLICT (slug) DO NOTHING で冪等化。再実行しても重複しない。

INSERT INTO training_categories (name, slug, description, level, emoji, sort_order, is_required)
VALUES
  ('衛生管理・感染対策', 'hygiene',
   '施術業務にあたり最重要となる衛生管理。手指消毒・器具の清浄化・感染症対応の基礎を学ぶ。',
   'basic', '🧴', 10, true),
  ('解剖学の基礎', 'anatomy',
   '主要な筋肉群・骨格・関節の理解。施術の安全性と効果を高めるための学術的基礎。',
   'basic', '🦴', 20, true),
  ('リンパ系の理解', 'lymph',
   'リンパシステムの仕組み・主要リンパ節と流れ。リンパドレナージュ施術の前提知識。',
   'basic', '💧', 30, true),
  ('オイル種別と効能', 'oil',
   '主要オイルの種類・特性・効能。お客様の体質と目的に合わせたオイル選定。',
   'basic', '🌿', 40, true),
  ('カウンセリング技法', 'counseling',
   '施術前のヒアリング・お客様の声を引き出す傾聴技法。施術カルテ記録に直結する。',
   'basic', '🩺', 50, true),
  ('ボディケア基本技法', 'bodycare',
   '基本的な圧迫・揉捏・摩擦等の手技。解剖学を踏まえた効果的な施術。',
   'intermediate', '🤲', 60, false),
  ('リンパドレナージュ', 'lymph_drainage',
   'リンパの流れに沿った優しい手技。むくみ・疲労回復に効果的な施術。',
   'intermediate', '💆', 70, false),
  ('アロマトリートメント', 'aroma',
   'エッセンシャルオイルを用いた香りと触れ合いのトリートメント。',
   'intermediate', '🧖', 80, false),
  ('部位別ケア応用', 'advanced_parts',
   '肩・腰・脚等の部位別の集中ケア手技。中級カリキュラム修了後の応用。',
   'advanced', '🎯', 90, false)
ON CONFLICT (slug) DO NOTHING;

-- prerequisites を slug 経由で解決して UPDATE
-- (中級カテゴリは対応する基礎カテゴリの修了を前提とする)
UPDATE training_categories SET prerequisites = ARRAY[
  (SELECT id FROM training_categories WHERE slug = 'anatomy')
] WHERE slug = 'bodycare';

UPDATE training_categories SET prerequisites = ARRAY[
  (SELECT id FROM training_categories WHERE slug = 'lymph')
] WHERE slug = 'lymph_drainage';

UPDATE training_categories SET prerequisites = ARRAY[
  (SELECT id FROM training_categories WHERE slug = 'oil')
] WHERE slug = 'aroma';

UPDATE training_categories SET prerequisites = ARRAY[
  (SELECT id FROM training_categories WHERE slug = 'bodycare')
] WHERE slug = 'advanced_parts';


-- ==========================================================================
-- STEP 6: 初期コンテンツ — 必須5カリキュラム (合計10モジュール)
-- ==========================================================================
-- 仕様書 5.1 必須カリキュラム:
--   1. 衛生管理       — 30分 / 1モジュール
--   2. 解剖学の基礎   — 90分 / 3モジュール
--   3. リンパ系の理解 — 60分 / 2モジュール
--   4. オイル種別     — 45分 / 2モジュール
--   5. カウンセリング — 60分 / 2モジュール
--
-- 仕様書 8節「暫定対応」: 6/1ローンチ時は社内で初版作成、6月以降に外部専門家ブラッシュアップ。

-- ──────────────────────────────────────────────
-- 1. 🧴 衛生管理・感染対策 (必須・1モジュール・30分)
-- ──────────────────────────────────────────────
INSERT INTO training_modules (category_id, title, slug, content, duration_minutes, sort_order, is_required)
SELECT id, '衛生管理の基本', 'hygiene-basics',
$module$
# 衛生管理の基本

施術業において、衛生管理は**お客様の安全と信頼の土台**です。本モジュールでは、施術前後に必ず守るべき基本ルールを学びます。

## 1. 手指消毒の徹底

施術前後の手指消毒は **絶対に省略しない** こと。

- **施術前**: 流水と石けんで30秒以上の手洗い → アルコール消毒
- **施術後**: 同様に手洗い + 消毒
- **施術中**: 顧客の患部・粘膜に触れる前後で再消毒

## 2. 施術用品の清浄化

| 用品 | 頻度 | 方法 |
|---|---|---|
| タオル類 | お客様ごと | 高温洗濯+乾燥 |
| ベッドシーツ | お客様ごと | 交換 |
| オイルボトル | 1日1回 | 外側をアルコール拭き |
| 施術ベッド | お客様ごと | 表面アルコール拭き |

## 3. 自身の身だしなみ

- 爪は短く切り、マニキュアは控えめに
- 髪は施術中に顧客に触れない長さ・結び方
- アクセサリー類は外す（指輪・腕時計含む）
- ユニフォームは清潔なものに毎日交換

## 4. 感染症の罹患・疑いがある場合

業務委託契約書 第12条第3項に従い、感染症の罹患または疑いがある場合は **直ちに業務を中止し、甲（運営）に通知** してください。具体的には:

- 発熱（37.5°C以上）
- 風邪症状（咳・喉の痛み）
- 胃腸症状（嘔吐・下痢）
- 皮膚の発疹・湿疹（手・腕に出ている場合特に）

## 5. お客様側の状態確認

カウンセリング時に以下を確認:

- 当日の体調
- アレルギーの有無
- 皮膚の状態（傷・湿疹がある場合は施術部位を変更）
- 発熱・体調不良の場合は施術を控える判断

## まとめ

衛生管理は **「気付いた時にやる」のではなく、ルーチン化する** こと。お客様一人ひとりへの誠実さが、施術業としての信頼を作ります。
$module$,
   30, 10, true
FROM training_categories WHERE slug = 'hygiene'
ON CONFLICT (slug) DO NOTHING;


-- ──────────────────────────────────────────────
-- 2. 🦴 解剖学の基礎 (必須・3モジュール・各30分)
-- ──────────────────────────────────────────────
INSERT INTO training_modules (category_id, title, slug, content, duration_minutes, sort_order, is_required)
SELECT id, '主要な筋肉群の理解', 'anatomy-muscles',
$module$
# 主要な筋肉群の理解

施術の効果と安全性は、**どの筋肉に、どのようにアプローチするか** で決まります。本モジュールでは、施術で扱う頻度が高い主要筋肉を整理します。

## 1. 上半身の主要筋肉

### 僧帽筋（そうぼうきん）
- 位置: 首から肩、背中の上部
- 役割: 肩甲骨を動かす、首を支える
- 凝りが出やすい部位の代表

### 三角筋
- 位置: 肩の丸み部分
- 役割: 腕を上げる動作
- デスクワークで負担がかかる

### 広背筋
- 位置: 背中の中〜下部、脇下まで広がる
- 役割: 腕を引く動作
- 姿勢の悪さで硬くなりやすい

## 2. 下半身の主要筋肉

### 大腿四頭筋
- 位置: 太ももの前面（4つの筋肉の総称）
- 役割: 膝を伸ばす、立ち上がる動作
- 立ち仕事の方に施術機会が多い

### ハムストリングス
- 位置: 太ももの裏側
- 役割: 膝を曲げる、骨盤を支える
- 座り仕事で硬くなりやすい

### 大殿筋
- 位置: お尻の最も大きな筋肉
- 役割: 股関節を伸ばす
- 腰痛の遠因となることが多い

## 3. 体幹の主要筋肉

### 腹直筋・腹斜筋
- 位置: お腹の前面・側面
- 役割: 体を曲げる・ひねる

### 脊柱起立筋
- 位置: 背骨の両側に縦に走る
- 役割: 姿勢の維持
- **腰痛の主役**となる筋肉

## 施術における重要ポイント

1. 筋肉の **走行方向** に沿った手技が効果的
2. 起始（始点）と停止（終点）を意識すると、深部までアプローチできる
3. 痛みを訴える部位だけでなく、関連する筋肉群も整える
$module$,
   30, 10, true
FROM training_categories WHERE slug = 'anatomy'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO training_modules (category_id, title, slug, content, duration_minutes, sort_order, is_required)
SELECT id, '骨格と関節の理解', 'anatomy-skeleton',
$module$
# 骨格と関節の理解

筋肉だけでなく **骨格と関節** の理解は、安全な施術の前提です。誤った圧迫は関節を痛めるリスクがあります。

## 1. 脊柱（背骨）の構造

脊柱は24個の椎骨で構成され、4つの部位に分かれます。

| 部位 | 椎骨の数 | 特徴 |
|---|---|---|
| 頸椎（けいつい） | 7個 | 首、最も繊細 |
| 胸椎（きょうつい） | 12個 | 肋骨と接続 |
| 腰椎（ようつい） | 5個 | 腰痛の中心 |
| 仙骨・尾骨 | — | 骨盤と接続 |

**施術の注意**: 脊柱の真上を直接強く押さない。両脇の筋肉（脊柱起立筋）にアプローチする。

## 2. 主要な関節

### 肩関節
- 可動域が最も広い関節
- **無理な可動域を超えた施術は禁忌**
- 五十肩・四十肩のお客様には特に慎重に

### 股関節
- 体の中心、最大の関節
- 周辺の筋肉（大殿筋・腸腰筋）から間接的にアプローチ

### 膝関節
- 蝶番関節（一方向のみ動く）
- 横方向への圧は厳禁

## 3. 骨格の個人差

身長・体格・骨格の太さはお客様ごとに異なります。

- 細身の方 → 圧を弱めに、骨に直接触れない
- 筋肉質の方 → 圧をやや強めに、深部にアプローチ
- 高齢の方 → 骨密度低下を考慮し、特に弱めに

## 施術における判断軸

1. **可動域を超えない**
2. **骨に直接押し当てない**（指圧でも筋肉部分を狙う）
3. **左右対称性を確認**（姿勢の歪みを把握）
4. **違和感があればすぐ中止**（顧客の表情・反応を観察）
$module$,
   30, 20, true
FROM training_categories WHERE slug = 'anatomy'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO training_modules (category_id, title, slug, content, duration_minutes, sort_order, is_required)
SELECT id, '施術と解剖学の関係', 'anatomy-application',
$module$
# 施術と解剖学の関係

## 1. なぜ解剖学を学ぶのか

施術業は **「気持ちいいだけ」では成立しない** 専門技術です。お客様の体に触れる以上、構造を理解した上で施術することが、安全と効果の両面で必須です。

施術業として税務上認められるためには、**学術的基礎を持った技術提供** であることを示せる必要があります。

## 2. お客様のお悩みと筋肉の関連

| お悩み | 主な原因筋 |
|---|---|
| 肩こり | 僧帽筋上部・肩甲挙筋 |
| 慢性腰痛 | 脊柱起立筋・腰方形筋・大殿筋 |
| 脚のむくみ | ハムストリングス・腓腹筋（ふくらはぎ） |
| 頭痛（緊張型） | 後頭下筋群・僧帽筋上部 |
| 手のしびれ | 斜角筋・小胸筋（神経圧迫の関連） |

## 3. 「悪い姿勢」の構造

- **猫背**: 大胸筋・小胸筋の短縮 + 菱形筋の伸長
- **反り腰**: 腸腰筋・脊柱起立筋の短縮 + 腹筋群の弱化
- **巻き肩**: 大胸筋の短縮 + 僧帽筋中部の弱化

→ 短縮した筋肉を緩める施術が、姿勢改善に直結する

## 4. 神経の走行を意識する

筋肉の下には神経が走っています。代表的なものは:

- 坐骨神経（梨状筋の下を通り脚へ）
- 腕神経叢（首から肩、腕へ）

これらを **強く圧迫しすぎない** ことが安全性の鍵です。

## 5. 学び続ける姿勢

解剖学は奥深く、本モジュールはその入口です。以下のリソースで継続学習を推奨:

- 書籍『身体運動の機能解剖』
- アプリ『Visible Body 3D 解剖学』
- 整体師・あんま師等の有資格者によるセミナー

業務委託契約書 第10条に基づき、技術の習得・維持は受託者の継続的な義務です。
$module$,
   30, 30, true
FROM training_categories WHERE slug = 'anatomy'
ON CONFLICT (slug) DO NOTHING;


-- ──────────────────────────────────────────────
-- 3. 💧 リンパ系の理解 (必須・2モジュール・各30分)
-- ──────────────────────────────────────────────
INSERT INTO training_modules (category_id, title, slug, content, duration_minutes, sort_order, is_required)
SELECT id, 'リンパシステムの基礎', 'lymph-basics',
$module$
# リンパシステムの基礎

## 1. リンパシステムとは

リンパシステムは **体の老廃物回収・免疫機能** を担う循環システムです。血液が動脈→静脈で循環するように、リンパ液はリンパ管を通って循環します。

## 2. リンパの主な働き

1. **老廃物の回収** — 細胞が出した不要物を運ぶ
2. **余分な水分の回収** — 血管から漏れ出た水分を戻す
3. **免疫機能** — リンパ節で異物を除去
4. **脂肪の運搬** — 食事由来の脂質を運ぶ

## 3. 血液との違い

| 項目 | 血液 | リンパ |
|---|---|---|
| 循環の動力 | 心臓 | 筋肉の動き・呼吸 |
| 速度 | 速い | 非常にゆっくり |
| 流れの方向 | 全身循環 | 末端→中心への一方向 |

→ リンパは**心臓のようなポンプを持たない**ため、施術や運動による外部からの働きかけが効果的です。

## 4. むくみの仕組み

リンパの流れが滞ると:
- 余分な水分が組織に溜まる
- 老廃物が回収されず蓄積
- 結果として「むくみ」が生じる

特にむくみが出やすい部位:
- 脚（重力で下がる）
- 顔（朝のむくみ）
- 腕（デスクワーク・運動不足）

## 5. リンパマッサージの位置付け

セラピストとしてのリンパケアは **「医療行為ではない」** ことを常に意識してください。

- ✅ 健康な方のリラクゼーション・むくみ軽減
- ❌ 病気の治療・診断
- ❌ 「治る」「改善する」等の医学的効能の説明

医学的な相談はお客様自身が医療機関に向かうよう案内します。
$module$,
   30, 10, true
FROM training_categories WHERE slug = 'lymph'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO training_modules (category_id, title, slug, content, duration_minutes, sort_order, is_required)
SELECT id, '主要リンパ節と流れ', 'lymph-nodes',
$module$
# 主要リンパ節と流れ

## 1. 主要なリンパ節

リンパ節は体内に約400〜700個あり、特に集中しているのが **「リンパ節クラスター」** と呼ばれる以下の部位です。

| リンパ節 | 位置 | 担当領域 |
|---|---|---|
| 顎下リンパ節 | 顎の下 | 顔・口腔 |
| 鎖骨リンパ節 | 鎖骨の上下 | **全身のリンパの最終出口** |
| 腋窩リンパ節 | 脇の下 | 腕・胸 |
| 鼠径リンパ節 | 太ももの付け根 | 下半身全体 |
| 膝窩リンパ節 | 膝の裏 | 下腿 |

## 2. リンパの流れの方向

リンパ液は **末端から中心** へ、最終的に鎖骨下静脈で血液に合流します。

施術の基本原則:
1. **末端から中心へ向けて** 流す
2. **リンパ節へ向けて** 集める
3. 鎖骨リンパ節を最後にケアして「出口を開く」

## 3. 施術の順序例（脚のリンパケア）

```
[1] 鎖骨リンパ節を軽くタッチ（出口を開く）
   ↓
[2] 鼠径リンパ節を軽く刺激
   ↓
[3] 太もも → 膝裏 → ふくらはぎ → 足首 の順に流す
   ↓
[4] 最後にもう一度、鼠径から鎖骨へ向けて流す
```

## 4. 施術上の注意

- **圧は弱め** — リンパ管は皮膚直下を走るため、強い圧は逆効果
- **方向は一方向** — 往復させない
- **リンパ節は刺激しすぎない** — 軽くタッチする程度
- **食後すぐは避ける** — 1時間以上空ける

## 5. 禁忌（施術を行わない場合）

以下のケースは施術を控えてください:
- 発熱・体調不良
- 妊娠初期
- 心臓・腎臓疾患のある方
- リンパ浮腫の医学的治療を受けている方
- 当日の飲酒後

判断に迷う場合は施術を控え、お客様に医師相談を勧めます。
$module$,
   30, 20, true
FROM training_categories WHERE slug = 'lymph'
ON CONFLICT (slug) DO NOTHING;


-- ──────────────────────────────────────────────
-- 4. 🌿 オイル種別と効能 (必須・2モジュール・各約22分)
-- ──────────────────────────────────────────────
INSERT INTO training_modules (category_id, title, slug, content, duration_minutes, sort_order, is_required)
SELECT id, '主要オイルの種類と特性', 'oil-types',
$module$
# 主要オイルの種類と特性

## 1. キャリアオイル（ベースオイル）

施術で大量に使用する基本のオイル。エッセンシャルオイルと混ぜて使用します。

### ホホバオイル
- 浸透が早く、肌なじみが良い
- 酸化しにくく長期保存可能
- ほぼ全ての肌質に対応 → **店舗の標準オイルに最適**

### スイートアーモンドオイル
- 保湿力が高い
- 乾燥肌・敏感肌向け
- やや酸化しやすいので開封後は早めに使用

### グレープシードオイル
- さらっとした使用感
- べたつきを嫌うお客様向け
- ビタミンEが豊富

### ココナッツオイル（フラクショネイテッド）
- 軽くてべたつかない
- 香りがほぼ無い → 香りでアレルギーが心配な方に

## 2. エッセンシャルオイル（精油）の代表例

ごく少量（キャリア100mlに対し2〜5滴）を加えて使用。

| 精油 | 主な効能 | 注意 |
|---|---|---|
| ラベンダー | リラックス・睡眠 | 妊娠初期は避ける |
| オレンジスイート | 気分転換・元気 | 光毒性弱（柑橘系で日中注意） |
| ペパーミント | リフレッシュ・頭痛 | 妊娠中・乳幼児は避ける |
| ユーカリ | 呼吸器系・集中力 | 高血圧の方は避ける |
| ティーツリー | 抗菌・スキンケア | 高濃度使用は刺激あり |
| ローズマリー | 集中・血行促進 | 高血圧・てんかんの方は避ける |

## 3. お客様の体質に合わせる

- **乾燥肌**: スイートアーモンド主体 + ラベンダー
- **オイリー肌**: グレープシード + ティーツリー
- **敏感肌**: ホホバ単独、または無香料
- **冷え性**: ホホバ + ローズマリー（少量）

## 4. オイルの管理

- **保管**: 冷暗所、直射日光を避ける
- **開封後**: 6〜12ヶ月以内に使用
- **容器**: 遮光瓶（茶色・青）
- **酸化臭**: 使用前に必ず嗅いで確認、酸化していれば廃棄
$module$,
   22, 10, true
FROM training_categories WHERE slug = 'oil'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO training_modules (category_id, title, slug, content, duration_minutes, sort_order, is_required)
SELECT id, 'オイルの選び方と注意点', 'oil-selection',
$module$
# オイルの選び方と注意点

## 1. お客様への確認事項

施術前のカウンセリングで必ず確認:

1. **アレルギーの有無**（ナッツ系・植物由来のアレルギー）
2. **妊娠の可能性**
3. **皮膚疾患の有無**
4. **過去のオイル施術での反応**
5. **当日の体調**
6. **直近の薬の服用**（特に肌に影響する薬）

## 2. パッチテストの実施

初めてのお客様、または過敏な肌のお客様には:

- 施術開始前に **腕の内側** に少量塗布
- 5〜10分後に発赤・かゆみがないか確認
- 異常があれば別のオイルに変更、または施術中止

## 3. 妊娠中のお客様への対応

妊娠初期（〜16週）は **アロマトリートメントを控える** のが基本。
中期以降も以下の精油は避ける:

❌ ローズマリー / ペパーミント / クラリセージ / ジャスミン / ジュニパー / シナモン / バジル

✅ 比較的安全とされる: ラベンダー（少量）/ オレンジスイート / ネロリ / フランキンセンス

ただし **「絶対安全」とは保証しない**。お客様の主治医確認を促す。

## 4. 光毒性のあるオイル

柑橘系の精油は **使用後12時間は紫外線を避ける** よう案内:
- ベルガモット
- レモン
- グレープフルーツ
- ライム

夏場・日中の施術後は特に注意喚起。

## 5. 使用量の目安

| 部位 | キャリアオイル量 |
|---|---|
| 全身 (60分) | 30〜50ml |
| 背中・肩 (40分) | 15〜25ml |
| 脚のみ (30分) | 10〜20ml |

精油は **キャリア100mlに対し2〜5滴**（濃度1〜3%）を厳守。

## 6. お客様の希望を尊重する

- 香りが好きでない方には無香料のホホバ・ココナッツのみ
- 強い香りが苦手な方は精油濃度を下げる
- ベタつきを嫌う方は軽いキャリアオイル（グレープシード・ココナッツ）

カルテ（施術カルテ）に **使用したオイル** を記録することで、次回以降の選択が容易になります（業務委託契約書 第11条）。
$module$,
   23, 20, true
FROM training_categories WHERE slug = 'oil'
ON CONFLICT (slug) DO NOTHING;


-- ──────────────────────────────────────────────
-- 5. 🩺 カウンセリング技法 (必須・2モジュール・各30分)
-- ──────────────────────────────────────────────
INSERT INTO training_modules (category_id, title, slug, content, duration_minutes, sort_order, is_required)
SELECT id, '効果的な施術前カウンセリング', 'counseling-pre',
$module$
# 効果的な施術前カウンセリング

## 1. なぜカウンセリングが重要か

施術前カウンセリングは:

1. **お客様の状態を把握** し、安全な施術につなげる
2. **期待値を擦り合わせる** ことで満足度を高める
3. **施術カルテ（第11条）** の基礎情報を集める
4. **施術業としての専門性** を示す

雑談ではなく、構造化された問診として行います。

## 2. カウンセリングの基本構成（5分目安）

```
[1] お客様の体調確認  (1分)
   「本日のお体の状態はいかがですか？」
   「気になる箇所はございますか？」

[2] 施術部位の希望確認  (1分)
   「特に重点的にケアしたい部位はありますか？」
   「逆に避けたい部位はございますか？」

[3] 圧の強さ確認  (30秒)
   「圧の強さはお好みありますか？」
   （ソフト / 普通 / しっかり / 強め）

[4] アレルギー・健康状態確認  (1分)
   「アレルギーはございますか？」
   「現在通院中の症状や服用中のお薬はありますか？」
   「妊娠の可能性はございますか？（女性のみ）」

[5] 目的・期待の確認  (30秒)
   「本日はどのような目的でご来店ですか？」
   （リラックス / 疲労回復 / むくみ / 肩こり等）
```

## 3. 体調NG・施術NGの判断

以下の場合は施術を控える、または部位変更:

- 発熱・体調不良
- 飲酒直後
- 食後30分以内（深い圧の施術）
- 施術部位の皮膚に傷・湿疹
- 当日大きな手術・処置を受けた

判断に迷う場合は **「念のため部位を変えますね」** と伝え、安全側に倒す。

## 4. 言葉づかいの基本

- **専門用語を使いすぎない** — 「僧帽筋が」より「肩のこの部分が」
- **断定的な表現を避ける** — 「治ります」ではなく「楽になられる方が多いです」
- **医学的判断を避ける** — 「病気かもしれない」と感じても、医療機関受診を促すに留める

## 5. お客様情報の取り扱い

- カウンセリング内容は **施術カルテに記録**
- 健康情報は **要配慮個人情報** — 取得同意を頂く
- スタッフ間の共有は **業務上必要な範囲に限定**
- 第三者（家族・友人）への漏洩は厳禁
$module$,
   30, 10, true
FROM training_categories WHERE slug = 'counseling'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO training_modules (category_id, title, slug, content, duration_minutes, sort_order, is_required)
SELECT id, 'お客様の声を引き出す傾聴技法', 'counseling-listening',
$module$
# お客様の声を引き出す傾聴技法

## 1. 傾聴とは

傾聴とは **「ただ聴く」のではなく、お客様が話しやすい場を作る積極的な聴き方** です。優れたセラピストは技術と同等に「聴く力」を持っています。

## 2. 傾聴の3原則

### ① 相づち
- 「はい」「そうですね」「なるほど」を**適度に**入れる
- 多すぎると形式的、少なすぎると無関心に映る

### ② オウム返し
- お客様の言葉を **そのまま返す**
- 例: お客様「最近、肩がパンパンで…」
       セラピスト「肩がパンパンなんですね。お辛いですね」

### ③ 否定しない
- お客様の感じ方を否定しない
- 「そんなことないですよ」より「そう感じておられるんですね」

## 3. オープンクエスチョンとクローズドクエスチョン

| 種類 | 特徴 | 使い所 |
|---|---|---|
| クローズド | はい/いいえで答えられる | 事実確認・チェック |
| オープン | 自由に答えられる | 状況の深掘り |

例:
- ❌ 「肩こりですか？」（クローズド、情報少ない）
- ✅ 「肩のどのあたりが特に気になりますか？」（オープン、詳しい情報が得られる）

## 4. 沈黙を恐れない

お客様が考えている沈黙は **大切な情報を引き出す前段階** です。慌てて話題を変えず、待つことも傾聴の一部です。

ただし長すぎる沈黙は気まずさにつながるので、5〜10秒を目安に。

## 5. 施術中の傾聴

施術中は会話を最小限にしつつ、以下を観察:

- **表情の変化** — 痛そう / リラックスしている
- **呼吸の変化** — 深くなる = リラックス、浅い = 緊張
- **体の反応** — 力が抜けている / 緊張している

これらは言葉以上の情報源です。

## 6. NGな対応例

❌ お客様の悩みを「私もそうなんです」と自分の話にすり替える
❌ 詮索しすぎる質問（私生活・職業の詳細を必要以上に聞く）
❌ アドバイスの押し付け（「○○した方がいいですよ」を多用）
❌ 噂話・他のお客様の話をする

## 7. 業務委託契約書との関係

業務委託契約書 第5条第5項により、**業務時間外のお客様との私的な連絡は禁止** されています。施術中の信頼関係は施術中に閉じ、店舗運営の枠組みの中で完結させることが、施術業としての専門性を保ちます。

カウンセリングで得た情報は施術カルテ（第11条）に記録し、次回以降の施術品質向上に活用してください。
$module$,
   30, 20, true
FROM training_categories WHERE slug = 'counseling'
ON CONFLICT (slug) DO NOTHING;


-- ==========================================================================
-- 動作確認クエリ (実行後に手動で確認用)
-- ==========================================================================
--
-- SELECT tablename, rowsecurity FROM pg_tables
--  WHERE tablename IN ('training_categories','training_modules',
--                      'therapist_training_records','therapist_skill_badges');
-- → rowsecurity = false が4テーブル分表示されればOK
--
-- SELECT slug, name, level, is_required FROM training_categories ORDER BY sort_order;
-- → 9カテゴリ、必須5件 (hygiene/anatomy/lymph/oil/counseling) が is_required=true
--
-- SELECT c.slug AS category, m.title, m.duration_minutes
--   FROM training_modules m
--   JOIN training_categories c ON c.id = m.category_id
--  WHERE m.is_required = true
--  ORDER BY c.sort_order, m.sort_order;
-- → 必須10モジュールが表示される
