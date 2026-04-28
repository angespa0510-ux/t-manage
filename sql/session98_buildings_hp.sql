-- ═══════════════════════════════════════════════════════════
-- Session 98: 公開HP掲載情報を buildings テーブルに移行
--
-- 背景:
--   現状 stores（ルーム）に shop_* フィールドがあるが、実態は
--   1ストア配下に複数の建物（オアシス・マイコート 等）があり、
--   建物ごとに住所・電話・地図が異なる。
--   /access ページを建物単位で表示できるよう、buildings に
--   公開HP用フィールドを移植する。
--
-- 役割分担（migration 後）:
--   stores       — 営業時間/受付時間/定休日 など全建物共通
--   buildings    — 表示名/住所/電話/アクセス/地図/写真/紹介文 など
--                  公開拠点単位の情報
--   rooms        — 個室番号（公開しない）
--
-- 既存 stores.shop_* は破棄せず残す（ロールバック用）
-- buildings 側に同名カラムを追加し、初期値として stores から
-- コピーする。コピー先の buildings は shop_is_public も継承する
-- ので、migration 直後から /access に表示される想定。
--
-- ステップ:
--   ①  ALTER TABLE buildings — shop_* カラム追加
--   ②  CREATE INDEX
--   ③  DISABLE ROW LEVEL SECURITY
--   ④  既存 stores.shop_* → buildings.shop_* へコピー（冪等）
--   ⑤  検証 SELECT
-- ═══════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────
-- ① buildings テーブル拡張（公開HP掲載情報）
-- ─────────────────────────────────────────────────────────────

-- 公開フラグ（この建物を /access に出すか）
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS shop_is_public boolean DEFAULT false;

-- 公開HP用の表示名（例: 「オアシス」「マイコート」「リングセレクト」）
-- 空なら buildings.name をそのまま使う
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS shop_display_name text DEFAULT '';

-- 建物ごとの住所
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS shop_address text DEFAULT '';

-- 建物ごとの電話番号
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS shop_phone text DEFAULT '';

-- 予備の電話番号
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS shop_phone_secondary text DEFAULT '';

-- アクセス説明（例: 「JR三河安城駅 北口 徒歩5分」）
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS shop_access text DEFAULT '';

-- Google Maps 埋め込みHTML（<iframe>タグ全体）
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS shop_map_embed text DEFAULT '';

-- 建物のメイン写真（外観・入口等）
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS shop_image_url text DEFAULT '';

-- 建物のサブ写真ギャラリー（複数枚）
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS shop_sub_image_urls text[] DEFAULT '{}';

-- 建物紹介文（/access の各建物カードで表示）
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS shop_description text DEFAULT '';

-- 公開HPでの表示順（昇順、同値は id 昇順）
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS shop_sort_order int DEFAULT 0;


-- ─────────────────────────────────────────────────────────────
-- ② 公開HP用インデックス
-- ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_buildings_shop_is_public
  ON buildings(shop_is_public, shop_sort_order)
  WHERE shop_is_public = true;


-- ─────────────────────────────────────────────────────────────
-- ③ RLS 無効化（T-MANAGE 全体方針）
-- ─────────────────────────────────────────────────────────────
ALTER TABLE buildings DISABLE ROW LEVEL SECURITY;


-- ─────────────────────────────────────────────────────────────
-- ④ 既存 stores.shop_* → buildings.shop_* へコピー
--
-- 冪等性: 既にマイグレーション済みの建物（shop_address が
--          埋まっている）はスキップして再実行可能。
--
-- ロジック:
--   - stores の shop_* 値を、配下の全 buildings に同一の値でコピー
--   - shop_display_name は buildings.name を初期値とする
--   - shop_sort_order は buildings.id を初期値とする
--   - shop_is_public は store の値を継承（true なら全建物公開）
-- ─────────────────────────────────────────────────────────────
UPDATE buildings b
SET
  shop_is_public       = COALESCE(s.shop_is_public, false),
  shop_address         = COALESCE(s.shop_address, ''),
  shop_phone           = COALESCE(s.shop_phone, ''),
  shop_phone_secondary = COALESCE(s.shop_phone_secondary, ''),
  shop_access          = COALESCE(s.shop_access, ''),
  shop_map_embed       = COALESCE(s.shop_map_embed, ''),
  shop_image_url       = COALESCE(s.shop_image_url, ''),
  shop_sub_image_urls  = COALESCE(s.shop_sub_image_urls, '{}'),
  shop_description     = COALESCE(s.shop_description, ''),
  shop_display_name    = b.name,
  shop_sort_order      = b.id
FROM stores s
WHERE b.store_id = s.id
  AND (b.shop_address IS NULL OR b.shop_address = '');


-- ─────────────────────────────────────────────────────────────
-- ⑤ 検証 SELECT
--
-- 期待される出力（現状データから想定）:
--   bid=1 三河安城ルーム / オアシス       / true / 〒446-... / 070-...
--   bid=2 三河安城ルーム / マイコート     / true / 〒446-... / 070-...
--   bid=3 豊橋ルーム     / リングセレクト / true / 〒441-... / 080-...
--
-- ※ 三河安城のオアシス・マイコートは migration 直後は同じ住所が
--    入っている。次ステップ（管理画面UI）で建物ごとに正しい住所に
--    アンジュスパさんが書き換えてください。
-- ─────────────────────────────────────────────────────────────
SELECT
  b.id                              AS bid,
  s.name                            AS store_name,
  b.name                            AS building_name,
  b.shop_display_name,
  b.shop_is_public,
  LEFT(b.shop_address, 40)          AS address_preview,
  b.shop_phone,
  b.shop_sort_order,
  array_length(b.shop_sub_image_urls, 1) AS sub_image_count
FROM buildings b
JOIN stores s ON b.store_id = s.id
ORDER BY s.id, b.shop_sort_order, b.id;


-- ═══════════════════════════════════════════════════════════
-- 以上
--
-- 次セッションで実装予定:
--   - app/rooms/page.tsx : 建物編集モーダルに公開HP用UI追加
--                         （住所・電話・地図・画像・サブ画像・紹介文）
--                         店舗編集モーダルからは住所等を削除し、
--                         営業時間/受付/定休日のみに整理
--   - app/(site)/access/page.tsx :
--                         データ取得を buildings JOIN stores に変更
--                         建物カードで stores.shop_hours 等を継承表示
-- ═══════════════════════════════════════════════════════════
