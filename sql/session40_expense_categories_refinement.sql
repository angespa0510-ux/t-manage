-- セッション40: 勘定科目25拡張に伴う既存ルールの振り替え
-- 「雑費」にまとめられていた通信費・支払手数料・雑収入を専用カテゴリへ移動

-- 【通信費】 other → communication
UPDATE bank_category_rules SET account_category = 'communication', account_label = '通信費（Google）'
  WHERE pattern IN ('Google', 'ＧＯＯＧＬＥ');
UPDATE bank_category_rules SET account_category = 'communication', account_label = '通信費（KATCH）'
  WHERE pattern = 'ＫＡＴＣＨ';
UPDATE bank_category_rules SET account_category = 'communication', account_label = '通信費（Anthropic）'
  WHERE pattern = 'ANTHROPIC';
UPDATE bank_category_rules SET account_category = 'communication', account_label = '通信費（Claude.ai）'
  WHERE pattern = 'CLAUDE.AI';
UPDATE bank_category_rules SET account_category = 'communication', account_label = '通信費（Amazonプライム）'
  WHERE pattern = 'Ａｍａｚｏｎプライム';

-- 【支払手数料】 other → fee
UPDATE bank_category_rules SET account_category = 'fee', account_label = '支払手数料'
  WHERE pattern = '振込手数料';
UPDATE bank_category_rules SET account_category = 'fee', account_label = '支払手数料（Sony Payment）'
  WHERE pattern = 'SONYPAYMENTSERVICES';
UPDATE bank_category_rules SET account_category = 'fee', account_label = '決済手数料（BASE）'
  WHERE pattern = 'ＢＡＳＥ＊';

-- 【雑収入】 other(false) → misc_income
UPDATE bank_category_rules SET account_category = 'misc_income', account_label = '受取利息', is_expense = false
  WHERE pattern = '決算お利息';

-- 【業務委託スタッフ】 therapist_back → outsource（セラピストと区別）
UPDATE bank_category_rules SET account_category = 'outsource', account_label = '外注費（業務委託スタッフ）'
  WHERE pattern IN ('ヤマナカ　ケンジ', 'タカハシ　リユウ', 'アライ　マサヨシ');

-- 【DGマーケティング】 supplies → communication (広告配信サービスの可能性高い)
-- ※ユーザー判断必要。現状のsuppliesのままでもOKだが、通信費扱いの方が適切
-- UPDATE bank_category_rules SET account_category = 'communication', account_label = '通信費（DGマーケティング）'
--   WHERE pattern = 'ＤＧ＿ＭＴＧ';

-- 【家賃保証料】地代家賃のままでOK（税務上も地代家賃に含めることが多い）
-- 別扱いしたい場合は以下:
-- UPDATE bank_category_rules SET account_category = 'fee', account_label = '家賃保証料（全保連）'
--   WHERE pattern = 'ゼンホレンヤチン';

-- 確認用クエリ（実行後に結果を確認すると安心）
-- SELECT pattern, account_category, account_label FROM bank_category_rules ORDER BY priority DESC, id;
