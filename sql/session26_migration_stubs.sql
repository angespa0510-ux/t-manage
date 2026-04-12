-- ============================================
-- Google Sites 記事移行用スタブ（下書き）
-- session26_manual_system.sql + session26_sample_articles.sql の後に実行
-- ※ サンプル記事と重複するタイトルは除外済み
-- ============================================

-- 🌸 はじめに
INSERT INTO manual_articles (title, category_id, content, tags, is_published, is_pinned, sort_order) VALUES
(
  '新人セラピストさん説明事項',
  (SELECT id FROM manual_categories WHERE name = 'はじめに' LIMIT 1),
  '## この記事の内容

> Google Sitesから移行予定です。管理画面で編集してください。

- 新人さん向けの重要事項をここにまとめます',
  ARRAY['新人', '重要'],
  false, true, 0
);

-- 💆 施術マニュアル
INSERT INTO manual_articles (title, category_id, content, tags, is_published, is_pinned, sort_order) VALUES
(
  '重要ポイント集 〜 鼠径部＆密着のコツ編 〜',
  (SELECT id FROM manual_categories WHERE name = '施術マニュアル' LIMIT 1),
  '## この記事の内容

> Google Sitesから移行予定です。管理画面で編集してください。',
  ARRAY['施術', '技術', '重要'],
  false, true, 1
);

-- 🧹 清掃・準備（退室前のルーム清掃はサンプルにあるので除外）
INSERT INTO manual_articles (title, category_id, content, tags, is_published, is_pinned, sort_order) VALUES
(
  '清掃NG、OK写真',
  (SELECT id FROM manual_categories WHERE name = '清掃・準備' LIMIT 1),
  '## この記事の内容

> Google Sitesから移行予定です。画像付きの記事です。
> 管理画面で画像をアップロードしてください。',
  ARRAY['清掃', '写真', '基本'],
  false, false, 2
),
(
  'ベッドメイキングについて',
  (SELECT id FROM manual_categories WHERE name = '清掃・準備' LIMIT 1),
  '## この記事の内容

> Google Sitesから移行予定です。管理画面で編集してください。',
  ARRAY['清掃', 'ベッド', '基本'],
  false, false, 3
),
(
  'タオルの畳み方',
  (SELECT id FROM manual_categories WHERE name = '清掃・準備' LIMIT 1),
  '## この記事の内容

> Google Sitesから移行予定です。管理画面で編集してください。',
  ARRAY['清掃', 'タオル'],
  false, false, 4
),
(
  'ポストの開け方',
  (SELECT id FROM manual_categories WHERE name = '清掃・準備' LIMIT 1),
  '## この記事の内容

> Google Sitesから移行予定です。管理画面で編集してください。',
  ARRAY['清掃', 'ポスト'],
  false, false, 5
),
(
  '麦茶の蓋について',
  (SELECT id FROM manual_categories WHERE name = '清掃・準備' LIMIT 1),
  '## この記事の内容

> Google Sitesから移行予定です。管理画面で編集してください。',
  ARRAY['清掃', '備品'],
  false, false, 6
);

-- 💰 お金・精算（精算の仕方はサンプルにあるので除外）
INSERT INTO manual_articles (title, category_id, content, tags, is_published, is_pinned, sort_order) VALUES
(
  'お給料について',
  (SELECT id FROM manual_categories WHERE name = 'お金・精算' LIMIT 1),
  '## この記事の内容

> Google Sitesから移行予定です。管理画面で編集してください。',
  ARRAY['お金', '給料', '重要'],
  false, false, 2
),
(
  '釣銭の準備と両替に関するご案内',
  (SELECT id FROM manual_categories WHERE name = 'お金・精算' LIMIT 1),
  '## この記事の内容

> Google Sitesから移行予定です。管理画面で編集してください。',
  ARRAY['お金', '釣銭', '両替'],
  false, false, 3
),
(
  '料金未払いでお客様が帰ってしまった場合の対応について',
  (SELECT id FROM manual_categories WHERE name = 'お金・精算' LIMIT 1),
  '## この記事の内容

> Google Sitesから移行予定です。管理画面で編集してください。',
  ARRAY['お金', 'トラブル', '対応'],
  false, false, 4
);

-- ⏰ 勤務・シフト（シフト提出はサンプルにあるので除外）
INSERT INTO manual_articles (title, category_id, content, tags, is_published, is_pinned, sort_order) VALUES
(
  '遅刻、早退、当日欠勤について',
  (SELECT id FROM manual_categories WHERE name = '勤務・シフト' LIMIT 1),
  '## この記事の内容

> Google Sitesから移行予定です。管理画面で編集してください。',
  ARRAY['勤務', 'ルール', '重要'],
  false, false, 2
),
(
  '勤務時間中の外出について',
  (SELECT id FROM manual_categories WHERE name = '勤務・シフト' LIMIT 1),
  '## この記事の内容

> Google Sitesから移行予定です。管理画面で編集してください。',
  ARRAY['勤務', '外出', 'ルール'],
  false, false, 3
),
(
  'LASTまで出勤する場合の勤務時間について',
  (SELECT id FROM manual_categories WHERE name = '勤務・シフト' LIMIT 1),
  '## この記事の内容

> Google Sitesから移行予定です。管理画面で編集してください。',
  ARRAY['勤務', 'LAST', '時間'],
  false, false, 4
),
(
  '予約が入っていない場合の終了時間について',
  (SELECT id FROM manual_categories WHERE name = '勤務・シフト' LIMIT 1),
  '## この記事の内容

> Google Sitesから移行予定です。管理画面で編集してください。',
  ARRAY['勤務', '予約', '時間'],
  false, false, 5
),
(
  '近隣店への掛持ちについて',
  (SELECT id FROM manual_categories WHERE name = '勤務・シフト' LIMIT 1),
  '## この記事の内容

> Google Sitesから移行予定です。管理画面で編集してください。',
  ARRAY['勤務', '掛持ち', 'ルール'],
  false, false, 6
);

-- 📅 予約・接客
INSERT INTO manual_articles (title, category_id, content, tags, is_published, is_pinned, sort_order) VALUES
(
  '予約時間に関する注意事項',
  (SELECT id FROM manual_categories WHERE name = '予約・接客' LIMIT 1),
  '## この記事の内容

> Google Sitesから移行予定です。管理画面で編集してください。',
  ARRAY['予約', '時間', '注意'],
  false, false, 1
),
(
  'ルームの入室時間・退室時間に関する決まり事',
  (SELECT id FROM manual_categories WHERE name = '予約・接客' LIMIT 1),
  '## この記事の内容

> Google Sitesから移行予定です。管理画面で編集してください。',
  ARRAY['予約', '入退室', 'ルール'],
  false, false, 2
),
(
  'お客様が入室後のコース時間変更について',
  (SELECT id FROM manual_categories WHERE name = '予約・接客' LIMIT 1),
  '## この記事の内容

> Google Sitesから移行予定です。管理画面で編集してください。',
  ARRAY['予約', 'コース変更', '対応'],
  false, false, 3
),
(
  '呼び指名について（XのDM予約）',
  (SELECT id FROM manual_categories WHERE name = '予約・接客' LIMIT 1),
  '## この記事の内容

> Google Sitesから移行予定です。管理画面で編集してください。',
  ARRAY['予約', '指名', 'X', 'DM'],
  false, false, 4
),
(
  'お客様のNG登録について',
  (SELECT id FROM manual_categories WHERE name = '予約・接客' LIMIT 1),
  '## この記事の内容

> Google Sitesから移行予定です。管理画面で編集してください。',
  ARRAY['接客', 'NG', '安全'],
  false, false, 5
);

-- 🏢 ルーム別ガイド
INSERT INTO manual_articles (title, category_id, content, tags, is_published, is_pinned, sort_order) VALUES
(
  '【三河安城】サブ部屋備品について',
  (SELECT id FROM manual_categories WHERE name = 'ルーム別ガイド' LIMIT 1),
  '## この記事の内容

> Google Sitesから移行予定です。管理画面で編集してください。',
  ARRAY['三河安城', '備品'],
  false, false, 1
),
(
  '【三河安城】ゴミの分別について',
  (SELECT id FROM manual_categories WHERE name = 'ルーム別ガイド' LIMIT 1),
  '## この記事の内容

> Google Sitesから移行予定です。管理画面で編集してください。',
  ARRAY['三河安城', 'ゴミ', '分別'],
  false, false, 2
),
(
  '【豊橋】備品について',
  (SELECT id FROM manual_categories WHERE name = 'ルーム別ガイド' LIMIT 1),
  '## この記事の内容

> Google Sitesから移行予定です。管理画面で編集してください。',
  ARRAY['豊橋', '備品'],
  false, false, 3
),
(
  '【豊橋】利用ルール',
  (SELECT id FROM manual_categories WHERE name = 'ルーム別ガイド' LIMIT 1),
  '## この記事の内容

> Google Sitesから移行予定です。管理画面で編集してください。',
  ARRAY['豊橋', 'ルール'],
  false, false, 4
),
(
  '【豊橋】ルーム関係まとめ',
  (SELECT id FROM manual_categories WHERE name = 'ルーム別ガイド' LIMIT 1),
  '## この記事の内容

> Google Sitesから移行予定です。管理画面で編集してください。',
  ARRAY['豊橋', 'まとめ'],
  false, false, 5
),
(
  '【豊橋】出退勤時の釣銭と鍵について',
  (SELECT id FROM manual_categories WHERE name = 'ルーム別ガイド' LIMIT 1),
  '## この記事の内容

> Google Sitesから移行予定です。管理画面で編集してください。',
  ARRAY['豊橋', '釣銭', '鍵'],
  false, false, 6
);

-- 📋 ルール・その他（喫煙はサンプルにあるので除外）
INSERT INTO manual_articles (title, category_id, content, tags, is_published, is_pinned, sort_order) VALUES
(
  'お部屋にあるスピーカーが壊れた時',
  (SELECT id FROM manual_categories WHERE name = 'ルール・その他' LIMIT 1),
  '## この記事の内容

> Google Sitesから移行予定です。管理画面で編集してください。',
  ARRAY['備品', 'トラブル', 'スピーカー'],
  false, false, 2
),
(
  '写メ日記参考ポーズ解説',
  (SELECT id FROM manual_categories WHERE name = 'ルール・その他' LIMIT 1),
  '## この記事の内容

> Google Sitesから移行予定です。画像付きの記事です。',
  ARRAY['写メ日記', 'ポーズ', '参考'],
  false, false, 3
);
