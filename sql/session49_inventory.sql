-- Session 49: 棚卸管理システム
-- 店舗単位で棚卸を実施。アンジュスパ三河安城 / アンジュスパ豊橋 の2店舗を初期投入。
-- 既存Excel「棚卸チェックシート」2025年9月アンジュから品目マスター41件を初期投入。

/* ─────────── テーブル定義 ─────────── */

-- 店舗マスター
CREATE TABLE IF NOT EXISTS inventory_stores (
  id bigserial PRIMARY KEY,
  name text UNIQUE NOT NULL,
  display_order int DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE inventory_stores DISABLE ROW LEVEL SECURITY;

-- 棚卸品目マスター（全店舗共通）
CREATE TABLE IF NOT EXISTS inventory_items (
  id bigserial PRIMARY KEY,
  name text NOT NULL,
  category text DEFAULT 'その他',
  unit text DEFAULT '個',
  default_unit_price numeric(10,2) DEFAULT 0,
  sort_order int DEFAULT 0,
  is_active boolean DEFAULT true,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_inventory_items_sort ON inventory_items(sort_order, id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_active ON inventory_items(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_inventory_items_category ON inventory_items(category);
ALTER TABLE inventory_items DISABLE ROW LEVEL SECURITY;

-- 棚卸セッション（店舗 × 日）
CREATE TABLE IF NOT EXISTS inventory_sessions (
  id bigserial PRIMARY KEY,
  count_date date NOT NULL,
  store_id bigint REFERENCES inventory_stores(id) ON DELETE SET NULL,
  store_name_snapshot text NOT NULL,
  fiscal_period text DEFAULT '',
  status text DEFAULT 'draft',
  total_amount bigint DEFAULT 0,
  item_count int DEFAULT 0,
  memo text DEFAULT '',
  counted_by_name text DEFAULT '',
  finalized_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (count_date, store_id)
);
CREATE INDEX IF NOT EXISTS idx_inventory_sessions_date ON inventory_sessions(count_date DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_sessions_store ON inventory_sessions(store_id);
ALTER TABLE inventory_sessions DISABLE ROW LEVEL SECURITY;

-- 棚卸実績（セッション × 品目）
CREATE TABLE IF NOT EXISTS inventory_counts (
  id bigserial PRIMARY KEY,
  session_id bigint REFERENCES inventory_sessions(id) ON DELETE CASCADE,
  count_date date NOT NULL,
  store_id bigint,
  item_id bigint REFERENCES inventory_items(id) ON DELETE SET NULL,
  item_name_snapshot text NOT NULL,
  category_snapshot text DEFAULT '',
  unit_snapshot text DEFAULT '',
  quantity numeric(10,2) DEFAULT 0,
  unit_price numeric(10,2) DEFAULT 0,
  subtotal numeric(12,2) DEFAULT 0,
  note text DEFAULT '',
  counted_by_name text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (session_id, item_id)
);
CREATE INDEX IF NOT EXISTS idx_inventory_counts_session ON inventory_counts(session_id);
CREATE INDEX IF NOT EXISTS idx_inventory_counts_date ON inventory_counts(count_date DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_counts_item ON inventory_counts(item_id);
ALTER TABLE inventory_counts DISABLE ROW LEVEL SECURITY;

/* ─────────── 初期データ ─────────── */

INSERT INTO inventory_stores (name, display_order) VALUES
  ('アンジュスパ三河安城', 10),
  ('アンジュスパ豊橋', 20)
ON CONFLICT (name) DO NOTHING;

INSERT INTO inventory_items (name, category, unit, default_unit_price, sort_order) VALUES
  ('オイル', '施術関連備品', 'L', 2727, 110),
  ('ボディースポンジ', '施術関連備品', '枚', 12, 120),
  ('紙パンツ', '施術関連備品', '枚', 16, 130),
  ('施術着', '施術関連備品', '着', 1500, 140),
  ('施術着（キャミソール他）', '施術関連備品', '着', 1500, 150),
  ('ガラスマイペット（本体）', 'リビング周辺', '本', 305, 210),
  ('ガラスマイペット（詰め替え）', 'リビング周辺', '個', 151, 220),
  ('マイペット（本体）', 'リビング周辺', '本', 305, 230),
  ('マイペット（詰め替え）', 'リビング周辺', '個', 151, 240),
  ('激落ちくん（本体）', 'リビング周辺', '個', 305, 250),
  ('激落ちくん（詰め替え）', 'リビング周辺', '個', 360, 260),
  ('コロコロ（本体）', 'リビング周辺', '本', 767, 270),
  ('コロコロ（詰め替え）', 'リビング周辺', '個', 233, 280),
  ('ファブリーズマイクロミスト（本体）', 'リビング周辺', '本', 416, 290),
  ('ファブリーズマイクロミスト（詰め替え）', 'リビング周辺', '個', 437, 300),
  ('リビング清掃シート', 'リビング周辺', '袋', 273, 310),
  ('消臭元', 'リビング周辺', '個', 404, 320),
  ('BOXティシュ', 'リビング周辺', '箱', 61, 330),
  ('麦茶', 'キッチン周り', '袋', 258, 410),
  ('食器洗剤（本体）', 'キッチン周り', '本', 305, 420),
  ('食器洗剤（詰め替え）', 'キッチン周り', '個', 415, 430),
  ('カビキラー（本体）', 'キッチン周り', '本', 259, 440),
  ('カビキラー（詰め替え）', 'キッチン周り', '個', 207, 450),
  ('パイプ洗浄剤', 'キッチン周り', '個', 195, 460),
  ('水切り袋', 'キッチン周り', '袋', 217, 470),
  ('ゴミ袋', 'キッチン周り', '袋', 154, 480),
  ('ハンドソープ（詰め替え）', '洗面台・洗濯機・バスルーム周り', '個', 1897, 510),
  ('ハンドソープ（本体）', '洗面台・洗濯機・バスルーム周り', '本', 547, 520),
  ('マウスウォッシュ（お客様）', '洗面台・洗濯機・バスルーム周り', '本', 987, 530),
  ('洗濯洗剤（詰め替え）', '洗面台・洗濯機・バスルーム周り', '個', 213, 540),
  ('ボディソープ', '洗面台・洗濯機・バスルーム周り', '本', 1200, 550),
  ('バスマジックリン（本体）', '洗面台・洗濯機・バスルーム周り', '本', 305, 560),
  ('バスマジックリン（詰め替え）', '洗面台・洗濯機・バスルーム周り', '個', 583, 570),
  ('シャンプー', '洗面台・洗濯機・バスルーム周り', '本', 1015, 580),
  ('コンディショナー', '洗面台・洗濯機・バスルーム周り', '本', 1050, 590),
  ('レジ袋', '洗面台・洗濯機・バスルーム周り', '袋', 216, 600),
  ('トイレットペーパー', 'トイレ周り', 'ロール', 70, 710),
  ('トイレマジックリン（本体）', 'トイレ周り', '本', 305, 720),
  ('トイレマジックリン（詰め替え）', 'トイレ周り', '個', 385, 730),
  ('流せるトイレシート（詰め替え）', 'トイレ周り', '個', 250, 740),
  ('電球', 'その他', '個', 491, 910)
ON CONFLICT DO NOTHING;
