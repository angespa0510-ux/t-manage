-- セッション51: 取引先マスター（インボイス番号帳）
--
-- 目的: 経費・仕入の取引先を一元管理し、適格請求書発行事業者番号を
--       取引先単位で把握する。仕入税額控除の可否判定に使う。
--
-- バックオフィスの「💼 取引先」タブからCRUD操作。
-- 次セッションで expenses テーブルに vendor_id FK を追加し、
-- 経費登録時に取引先を選択できるようにする予定。

CREATE TABLE IF NOT EXISTS vendors (
  id bigserial PRIMARY KEY,
  name text NOT NULL,                                -- 取引先名（会社名・屋号・個人名）
  kana text DEFAULT '',                              -- フリガナ（並び替え・検索用）
  invoice_number text DEFAULT '',                    -- 適格請求書発行事業者番号（T+13桁）
  has_invoice boolean DEFAULT false,                 -- インボイス登録済みフラグ
  category text DEFAULT '',                          -- 取引カテゴリ（仕入/家賃/光熱費/通信費/etc）
  address text DEFAULT '',                           -- 住所
  phone text DEFAULT '',                             -- 電話番号
  email text DEFAULT '',                             -- メール
  website text DEFAULT '',                           -- サイトURL
  payment_bank text DEFAULT '',                      -- 振込先銀行・支店
  payment_account text DEFAULT '',                   -- 口座番号（口座種別含む: 普通1234567 等）
  payment_account_name text DEFAULT '',              -- 口座名義（カナ）
  notes text DEFAULT '',                             -- メモ
  started_at date,                                   -- 取引開始日
  ended_at date,                                     -- 取引終了日（契約終了時）
  status text DEFAULT 'active',                      -- active / archived
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_vendors_name ON vendors(name);
CREATE INDEX IF NOT EXISTS idx_vendors_kana ON vendors(kana);
CREATE INDEX IF NOT EXISTS idx_vendors_invoice ON vendors(has_invoice);
CREATE INDEX IF NOT EXISTS idx_vendors_category ON vendors(category);
CREATE INDEX IF NOT EXISTS idx_vendors_status ON vendors(status);

-- RLS 無効化（T-MANAGE の標準方針に合わせる）
ALTER TABLE vendors DISABLE ROW LEVEL SECURITY;

-- updated_at 自動更新トリガー
CREATE OR REPLACE FUNCTION update_vendors_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS vendors_updated_at_trigger ON vendors;
CREATE TRIGGER vendors_updated_at_trigger
  BEFORE UPDATE ON vendors
  FOR EACH ROW
  EXECUTE FUNCTION update_vendors_updated_at();
