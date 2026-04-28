-- ==========================================================================
-- session90_treatment_charts.sql
--
-- ④お客様カルテシステム — DB基盤構築 (Phase 1)
--
-- 仕様書: docs/23_TREATMENT_CHART.md
-- 関連: docs/21_TREATMENT_BUSINESS_POSITIONING.md
--      docs/22_CONTRACT_REDESIGN.md  第11条 カルテ記録義務
--
-- 【目的】
--   「施術業」としての実態証跡を残すため、施術前カウンセリング・施術内容・
--   反応・次回提案を体系的に記録するシステムの DB を構築する。
--   税務調査時に「施術業として継続的に業務を行っている証跡」となる。
--
-- 【スコープ】 Phase 1 (6/1までに必達)
--   - treatment_charts          : 施術カルテ (1施術 = 1レコード)
--   - customer_health_profiles  : 顧客の健康プロファイル (1顧客 = 1レコード、永続)
--   - INDEX, RLS 設定
--
-- 【RLS方針】 仕様書 2.3
--   仕様書ではセラピスト/管理者/顧客で閲覧範囲を分ける案だが、現行 T-MANAGE は
--   Supabase Auth を使わず独自セッション (login_email/password) で運用しており、
--   anon キーでフロントから直接 supabase-js が呼ばれる。
--   したがって既存テーブル (reservations, customer_therapist_memos 等) と同様
--   RLS は DISABLE + 全許可ポリシーで運用し、therapist_id 指定によるクエリで
--   フロント側からアクセス制御を行う。
--   将来 Supabase Auth 移行時に厳格RLSへ切替予定。
-- ==========================================================================


-- ==========================================================================
-- STEP 1: treatment_charts (施術カルテ)
-- ==========================================================================

CREATE TABLE IF NOT EXISTS treatment_charts (
  id bigserial PRIMARY KEY,

  -- 紐付け
  reservation_id bigint REFERENCES reservations(id) ON DELETE CASCADE,
  customer_id    bigint REFERENCES customers(id)    ON DELETE SET NULL,
  therapist_id   bigint REFERENCES therapists(id)   ON DELETE SET NULL,
  store_id       bigint REFERENCES stores(id)       ON DELETE SET NULL,

  -- 施術前カウンセリング (仕様書 2.1)
  pre_condition text,             -- 当日の体調・コンディション
  pre_concern   text,             -- 気になる箇所・お悩み
  pre_request   text,             -- 当日のご希望 (圧の強さ、重点ケア部位等)

  -- 施術内容
  course_id        bigint,          -- 提供したコース (courses.id への参照、FKは型互換性を考慮し張らない)
  options_used     jsonb,          -- 使用オプション (複数)
  body_parts       text[],         -- 施術部位 ['肩', '腰', '足裏']
  oils_used        text[],         -- 使用オイル ['ラベンダー', 'ホホバ']
  techniques_used  text[],         -- 使用技法 ['リンパドレナージュ', '深部圧迫']
  pressure_level   varchar(20),    -- 圧の強さ 'soft'|'medium'|'firm'|'extra_firm'

  -- 施術中の所見
  treatment_notes   text,          -- 施術中の気付き (凝り、緊張、好み等)
  customer_reaction text,          -- お客様の反応・喜ばれた点

  -- 次回提案
  next_recommendation    text,        -- 次回提案の内容
  recommended_interval   varchar(50), -- 推奨来店間隔 '1週間以内'|'2週間以内'|'1ヶ月以内' 等
  recommended_course_id  bigint,      -- 次回推奨コース (courses.id への参照、FKは型互換性を考慮し張らない)

  -- メタ
  is_finalized boolean   DEFAULT false,  -- 確定済 (true で編集不可)
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now(),
  created_by_therapist_id bigint REFERENCES therapists(id) ON DELETE SET NULL
    -- 記入者 (代筆や複数セラピスト対応の場合は therapist_id と異なる)
);

-- updated_at 自動更新トリガ
CREATE OR REPLACE FUNCTION trg_treatment_charts_set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS treatment_charts_set_updated_at ON treatment_charts;
CREATE TRIGGER treatment_charts_set_updated_at
  BEFORE UPDATE ON treatment_charts
  FOR EACH ROW
  EXECUTE FUNCTION trg_treatment_charts_set_updated_at();

-- INDEX
CREATE INDEX IF NOT EXISTS idx_treatment_charts_customer
  ON treatment_charts(customer_id);
CREATE INDEX IF NOT EXISTS idx_treatment_charts_reservation
  ON treatment_charts(reservation_id);
CREATE INDEX IF NOT EXISTS idx_treatment_charts_therapist
  ON treatment_charts(therapist_id);
CREATE INDEX IF NOT EXISTS idx_treatment_charts_created_at
  ON treatment_charts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_treatment_charts_finalized
  ON treatment_charts(is_finalized) WHERE is_finalized = false;
  -- 「未確定 = 編集中」の高速検索用 (パーシャルインデックス)

-- RLS (現行運用は DISABLE + 全許可)
ALTER TABLE treatment_charts DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "treatment_charts_all" ON treatment_charts;
CREATE POLICY "treatment_charts_all" ON treatment_charts
  FOR ALL USING (true) WITH CHECK (true);

-- COMMENT
COMMENT ON TABLE treatment_charts IS
  '施術カルテ (1施術=1レコード)。docs/23_TREATMENT_CHART.md 参照。施術業の実態証跡。';
COMMENT ON COLUMN treatment_charts.is_finalized IS
  '確定済フラグ。true の場合編集不可とする (フロント側で制御)。';
COMMENT ON COLUMN treatment_charts.pressure_level IS
  '圧の強さ。soft/medium/firm/extra_firm を想定 (CHECK制約は将来追加検討)。';


-- ==========================================================================
-- STEP 2: customer_health_profiles (健康プロファイル・永続)
-- ==========================================================================

CREATE TABLE IF NOT EXISTS customer_health_profiles (
  id bigserial PRIMARY KEY,
  customer_id bigint UNIQUE REFERENCES customers(id) ON DELETE CASCADE,
  -- UNIQUE: 1顧客 = 1プロファイル (UPSERT 運用)

  -- 体質・アレルギー (永続情報・要配慮個人情報)
  allergies            text,         -- アレルギー (オイル種別、食品等)
  skin_sensitivity     varchar(20),  -- 'normal'|'sensitive'|'very_sensitive'
  health_conditions    text,         -- 既往症・健康状態
  current_medications  text,         -- 服用中の薬

  -- 体型・特性
  posture_notes  text,                 -- 姿勢の特徴
  chronic_issues text[],               -- 慢性的な不調 ['腰痛', '肩こり']

  -- 好み (過去施術から蓄積)
  preferred_pressure  varchar(20),
  preferred_oils      text[],
  avoided_techniques  text[],

  -- 注意事項
  caution_notes text,                  -- セラピストへの注意事項

  -- 同意 (個人情報保護法 = 要配慮個人情報の取得同意)
  consent_given_at timestamptz,        -- 顧客が「健康情報収集同意」した日時
  consent_source   varchar(40),        -- 'mypage'|'paper'|'verbal' 等

  -- メタ
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now(),
  last_reviewed_at  timestamptz        -- 最終レビュー日 (セラピストが情報確認した日)
);

-- updated_at 自動更新トリガ
CREATE OR REPLACE FUNCTION trg_customer_health_profiles_set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS customer_health_profiles_set_updated_at ON customer_health_profiles;
CREATE TRIGGER customer_health_profiles_set_updated_at
  BEFORE UPDATE ON customer_health_profiles
  FOR EACH ROW
  EXECUTE FUNCTION trg_customer_health_profiles_set_updated_at();

-- INDEX
CREATE INDEX IF NOT EXISTS idx_customer_health_profiles_updated_at
  ON customer_health_profiles(updated_at DESC);

-- RLS (現行運用は DISABLE + 全許可)
ALTER TABLE customer_health_profiles DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "customer_health_profiles_all" ON customer_health_profiles;
CREATE POLICY "customer_health_profiles_all" ON customer_health_profiles
  FOR ALL USING (true) WITH CHECK (true);

-- COMMENT
COMMENT ON TABLE customer_health_profiles IS
  '顧客の健康プロファイル (要配慮個人情報、永続)。docs/23_TREATMENT_CHART.md 参照。';
COMMENT ON COLUMN customer_health_profiles.consent_given_at IS
  '個人情報保護法 上、要配慮個人情報の取得には本人同意が必須。Phase 2 で顧客マイページから収集。';


-- ==========================================================================
-- 動作確認クエリ (実行後に手動で確認用)
-- ==========================================================================
--
-- SELECT tablename, rowsecurity
-- FROM pg_tables
-- WHERE tablename IN ('treatment_charts', 'customer_health_profiles');
-- → rowsecurity = false が確認できれば OK
--
-- INSERT INTO treatment_charts (reservation_id, customer_id, therapist_id,
--   pre_condition, body_parts, pressure_level, treatment_notes,
--   recommended_interval)
-- VALUES (1, 1, 1, '本日疲労感あり', ARRAY['肩','腰'], 'medium',
--   '右肩に強い凝り', '2週間以内');
-- → サンプル INSERT が通ることを確認
