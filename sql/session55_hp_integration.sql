-- ═══════════════════════════════════════════════════════════
-- Session 55: 公式HP統合（Ange Spa 公開サイト連携）
--
-- 目的:
--   T-MANAGE を単なる管理システムから、公式HP (ange-spa.com)
--   の情報マスターとしても機能させる。
--   管理画面で入力したセラピスト情報・店舗情報が、公開HPに
--   自動反映される構造にする。
--
-- 対応ページ:
--   /            — 新HP HOME
--   /system      — 料金・コース
--   /therapist   — セラピスト一覧・詳細
--   /schedule    — 出勤スケジュール（/public-schedule を統合リニューアル）
--   /access      — 店舗・アクセス
--   /recruit     — 求人情報
--
-- 本SQLで追加する拡張カラム:
--   therapists — 公開フラグ・自己紹介・タグ等
--   stores     — 店舗別の公開情報（住所・電話・営業時間・地図）
--
-- 既存カラムは一切変更しない。ADD COLUMN IF NOT EXISTS のみ使用。
-- ═══════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────
-- ① therapists テーブル拡張（公開HP掲載用の追加情報）
-- ─────────────────────────────────────────────────────────────

-- 公開/非公開フラグ
ALTER TABLE therapists ADD COLUMN IF NOT EXISTS is_public boolean DEFAULT false;
-- 公開HPに載せるかどうか。デフォルトは false（既存セラピストは本人確認後に順次公開）

-- 自己紹介・PR
ALTER TABLE therapists ADD COLUMN IF NOT EXISTS bio text DEFAULT '';
-- 自己紹介文（複数行、1000文字程度想定）

ALTER TABLE therapists ADD COLUMN IF NOT EXISTS catchphrase text DEFAULT '';
-- キャッチコピー（「確変中」「高リピート率」等、一覧カードの上に帯で表示）

ALTER TABLE therapists ADD COLUMN IF NOT EXISTS specialty text DEFAULT '';
-- 得意な施術（「アロマ」「リンパ」「ディープ」等の自由記述）

ALTER TABLE therapists ADD COLUMN IF NOT EXISTS message text DEFAULT '';
-- お客様へのメッセージ（プロフィール下部に表示）

-- タイプタグ（複数選択）
ALTER TABLE therapists ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';
-- 現行HP準拠: カワイイ系 / キレイ系 / ロリ系 / ギャル系 / セクシー系 / 人妻系
--             明るい / おっとり / 癒し系 / 甘えん坊 / 天然 / 恥ずかしがりや / 人懐っこい / オタク / 上品 / 小悪魔 / ツンデレ / 知的
--             現役学生 / OL / マッサージ上手 / 外部講習済
--             素人 / 経験豊富
--             色白 / 喫煙しない / PICK UP / 鼠径部 / サービス精神抜群 等

-- 体型・見た目の追加情報
ALTER TABLE therapists ADD COLUMN IF NOT EXISTS body_type text DEFAULT '';
-- モデル / スレンダー / 標準 / グラマー / ぽっちゃり

ALTER TABLE therapists ADD COLUMN IF NOT EXISTS hair_style text DEFAULT '';
-- ショート / ミディアム / ロング

ALTER TABLE therapists ADD COLUMN IF NOT EXISTS hair_color text DEFAULT '';
-- 黒髪 / 茶髪 / 金髪 / 派手髪

-- 追加写真・外部リンク
ALTER TABLE therapists ADD COLUMN IF NOT EXISTS sub_photo_urls text[] DEFAULT '{}';
-- サブ写真（複数枚、詳細ページでギャラリー表示）

ALTER TABLE therapists ADD COLUMN IF NOT EXISTS blog_url text DEFAULT '';
-- 写メ日記URL（現行HPでは外部サイト ranking-deli.jp へのリンク）

ALTER TABLE therapists ADD COLUMN IF NOT EXISTS twitter_url text DEFAULT '';
-- Twitter / X の URL

ALTER TABLE therapists ADD COLUMN IF NOT EXISTS instagram_url text DEFAULT '';
-- Instagram の URL

-- 公開時の表示順（昇順）
ALTER TABLE therapists ADD COLUMN IF NOT EXISTS public_sort_order int DEFAULT 0;
-- 同順序の場合は id 降順（新しいセラピストが上）

-- PICK UP / おすすめフラグ
ALTER TABLE therapists ADD COLUMN IF NOT EXISTS is_pickup boolean DEFAULT false;
-- TOPページの「PICK UP」枠に出すセラピスト

-- 新人フラグ（公開HP上の NEW バッジ表示）
ALTER TABLE therapists ADD COLUMN IF NOT EXISTS is_newcomer boolean DEFAULT false;
-- 明示的に「新人」として扱う。通常は entry_date から自動判定するが、
-- 手動で NEW バッジを継続させたい場合に使う。


-- 公開HP用インデックス
CREATE INDEX IF NOT EXISTS idx_therapists_is_public ON therapists(is_public) WHERE is_public = true;
CREATE INDEX IF NOT EXISTS idx_therapists_public_sort ON therapists(public_sort_order, id DESC) WHERE is_public = true;
CREATE INDEX IF NOT EXISTS idx_therapists_is_pickup ON therapists(is_pickup) WHERE is_pickup = true;
CREATE INDEX IF NOT EXISTS idx_therapists_is_newcomer ON therapists(is_newcomer) WHERE is_newcomer = true;


-- ─────────────────────────────────────────────────────────────
-- ② stores テーブル拡張（店舗別の公開情報）
-- ─────────────────────────────────────────────────────────────
--
-- 既存の stores は「会社全体情報」(company_*) を1レコード目に
-- 持たせる構造になっている。
-- そこに各レコード（＝各店舗）固有の公開情報を追加する。
-- shop_ プレフィックスで、company_ と区別する。
--
-- 例:
--   id=1: name=三河安城A店, shop_address='愛知県安城市...', shop_phone='070-...'
--         company_name='合同会社テラスライフ', company_address='愛知県安城市...'
--   id=2: name=三河安城B店, shop_address='愛知県安城市...'
--         company_* は空（会社情報は1レコード目のみ使用）
-- ─────────────────────────────────────────────────────────────

ALTER TABLE stores ADD COLUMN IF NOT EXISTS shop_is_public boolean DEFAULT false;
-- 公開HPに掲載するか

ALTER TABLE stores ADD COLUMN IF NOT EXISTS shop_display_name text DEFAULT '';
-- 公開HP用の表示名（例: 「三河安城A店」「Ange Spa 豊橋ルーム」等）
-- 空なら name をそのまま使う

ALTER TABLE stores ADD COLUMN IF NOT EXISTS shop_address text DEFAULT '';
-- 店舗住所（公開）

ALTER TABLE stores ADD COLUMN IF NOT EXISTS shop_phone text DEFAULT '';
-- 店舗電話番号

ALTER TABLE stores ADD COLUMN IF NOT EXISTS shop_phone_secondary text DEFAULT '';
-- 予備の電話番号（現行HPで 070-1675-5900 と 080-9486-2282 の2回線運用）

ALTER TABLE stores ADD COLUMN IF NOT EXISTS shop_hours text DEFAULT '';
-- 営業時間（例: 12:00〜深夜27:00）

ALTER TABLE stores ADD COLUMN IF NOT EXISTS shop_reception_hours text DEFAULT '';
-- 受付時間（例: 最終受付26:00、電話受付時間11:00〜26:00）

ALTER TABLE stores ADD COLUMN IF NOT EXISTS shop_holiday text DEFAULT '';
-- 定休日（例: 年中無休）

ALTER TABLE stores ADD COLUMN IF NOT EXISTS shop_access text DEFAULT '';
-- アクセス説明（例: 「JR三河安城駅より徒歩5分」）

ALTER TABLE stores ADD COLUMN IF NOT EXISTS shop_map_embed text DEFAULT '';
-- Google Maps 埋め込みHTML（<iframe>タグ全体）

ALTER TABLE stores ADD COLUMN IF NOT EXISTS shop_image_url text DEFAULT '';
-- 店舗外観・内観メイン写真

ALTER TABLE stores ADD COLUMN IF NOT EXISTS shop_sub_image_urls text[] DEFAULT '{}';
-- 店舗写真ギャラリー（内観・設備等を複数枚）

ALTER TABLE stores ADD COLUMN IF NOT EXISTS shop_description text DEFAULT '';
-- 店舗紹介文（アクセスページで表示）

ALTER TABLE stores ADD COLUMN IF NOT EXISTS shop_sort_order int DEFAULT 0;
-- 公開HPでの店舗表示順


-- 公開HP用インデックス
CREATE INDEX IF NOT EXISTS idx_stores_shop_is_public ON stores(shop_is_public, shop_sort_order) WHERE shop_is_public = true;


-- ─────────────────────────────────────────────────────────────
-- ③ RLS 無効化（T-MANAGE 全体方針に従う）
-- ─────────────────────────────────────────────────────────────
-- stores / therapists は既に無効化済みだが、念のため再確認
-- （既にDISABLEされていれば何もしない安全な操作）

ALTER TABLE therapists DISABLE ROW LEVEL SECURITY;
ALTER TABLE stores     DISABLE ROW LEVEL SECURITY;


-- ═══════════════════════════════════════════════════════════
-- 以上
--
-- 次セッションで追加予定（Phase 1 範囲外、備忘）:
--   - blog_posts テーブル新設（公開ブログ用、現行HPのブログを移行）
--   - public_videos テーブル新設 or video_generation_logs に is_public 追加
--   - survey_responses テーブル新設（アンケート、Phase 3予定）
-- ═══════════════════════════════════════════════════════════
