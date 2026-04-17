-- セッション39: 税理士ポータル Phase 3A-1 銀行取込ルール追加
-- PayPay銀行CSV全216件を分析し、チョップの実取引パターンからルール化

-- 重複防止のため pattern に UNIQUE 制約を付ける (既になければ)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'bank_category_rules_pattern_unique'
  ) THEN
    ALTER TABLE bank_category_rules
      ADD CONSTRAINT bank_category_rules_pattern_unique UNIQUE (pattern);
  END IF;
END $$;

-- 新規ルール追加 (29件)
INSERT INTO bank_category_rules (pattern, account_category, account_label, is_expense, priority, created_by_name) VALUES
  -- 水道光熱費 (ガス・水道)
  ('フジプロ', 'utilities', '水道光熱費（ガス）', true, 75, 'system'),
  ('ソラリスガスヤ', 'utilities', '水道光熱費（ガス）', true, 75, 'system'),
  ('イズオカ　レイア', 'utilities', '水道光熱費（マンション水道代）', true, 85, 'system'),

  -- 通信費 (インターネット・AI・サブスク)
  ('ＫＡＴＣＨ', 'other', '通信費（KATCH）', true, 75, 'system'),
  ('ANTHROPIC', 'other', '通信費（Anthropic）', true, 80, 'system'),
  ('CLAUDE.AI', 'other', '通信費（Claude.ai）', true, 80, 'system'),
  ('Ａｍａｚｏｎプライム', 'other', '通信費（Amazonプライム）', true, 75, 'system'),

  -- 広告宣伝費
  ('ＬＩＮＥ公式', 'advertising', '広告宣伝費（LINE公式）', true, 80, 'system'),
  ('リンクライフ', 'advertising', '広告宣伝費（リンクライフ）', true, 70, 'system'),
  ('アイエムシ', 'advertising', '広告宣伝費（アイエムシー）', true, 70, 'system'),
  ('フクナガ　テツオ', 'advertising', '広告宣伝費（フクナガ）', true, 85, 'system'),

  -- 支払手数料 (決済サービス)
  ('SONYPAYMENTSERVICES', 'other', '支払手数料（Sony Payment）', true, 75, 'system'),
  ('ＢＡＳＥ＊', 'other', '決済手数料（BASE）', true, 75, 'system'),

  -- 地代家賃
  ('ゼンホレンヤチン', 'rent', '家賃保証料（全保連）', true, 80, 'system'),
  ('イズオカ　ノブヒロ', 'rent', '地代家賃（賃貸マンション）', true, 85, 'system'),

  -- 消耗品費 (施術用品・楽天系通販)
  ('ESTAMA', 'supplies', '消耗品費（施術用品）', true, 75, 'system'),
  ('ＤＧ＿ＭＴＧ', 'supplies', '消耗品費（DGマーケティング）', true, 70, 'system'),
  ('ｱ-ﾙｽﾄｱ', 'supplies', '消耗品費（楽天アールストア）', true, 70, 'system'),
  ('ﾛｽﾄｼﾞ', 'supplies', '消耗品費（楽天ロストジー）', true, 65, 'system'),
  ('ﾃﾞﾝﾃﾞﾝ', 'supplies', '消耗品費（楽天デンデン）', true, 65, 'system'),
  ('ﾗｸﾃﾝﾆｼﾞｭｳﾖﾝ', 'supplies', '消耗品費（楽天24）', true, 70, 'system'),

  -- 消耗品費 (店舗備品・美容用品)
  ('ベイス　（カ', 'supplies', '消耗品費（店舗備品・ベイス）', true, 80, 'system'),
  ('ジヤパンシヨウカイ', 'supplies', '消耗品費（店舗備品・ジャパン商会）', true, 75, 'system'),
  ('アサヒデンキ', 'supplies', '消耗品費（店舗備品・アサヒデンキ）', true, 75, 'system'),
  -- 「セブン ビユ−テイ−」の「−」はU+2212 (MINUS SIGN) 注意
  ('セブン　ビユ−テイ−', 'supplies', '消耗品費（美容用品仕入・セブンビューティ）', true, 80, 'system'),

  -- 外注費 (業務委託スタッフ)
  ('ヤマナカ　ケンジ', 'therapist_back', '外注費（業務委託スタッフ）', true, 85, 'system'),
  ('タカハシ　リユウ', 'therapist_back', '外注費（業務委託スタッフ）', true, 85, 'system'),
  ('アライ　マサヨシ', 'therapist_back', '外注費（業務委託スタッフ）', true, 85, 'system'),

  -- 雑費 (元社員・単発)
  ('ウエハラ　カズオ', 'other', '雑費（元社員関連）', true, 70, 'system')
ON CONFLICT (pattern) DO NOTHING;

-- 備考:
-- 姓名の間は全角スペース（U+3000）で記録されています
-- includes マッチのため、「フクナガ　テツオ」と書けば「振込 フクナガ　テツオ」にマッチします
-- 優先度85: 個人名/具体的取引先 (誤マッチ防止)
-- 優先度70-80: 会社名・一般的なサービス名
-- 優先度65: 短めのパターン（誤マッチリスク若干高）
