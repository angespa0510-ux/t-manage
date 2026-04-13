-- Session 29: 業務委託契約書テーブル
CREATE TABLE IF NOT EXISTS contracts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  therapist_id bigint REFERENCES therapists(id),
  token text UNIQUE NOT NULL,
  status text DEFAULT 'pending',
  signer_name text,
  signer_address text,
  signature_url text,
  signed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "contracts_all" ON contracts FOR ALL USING (true);

-- 契約書タイプ追加（contract=契約書, license=免許証）
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS type text DEFAULT 'contract';
