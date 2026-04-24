# 14. 口コミ・アンケートシステム仕様書

> Ange Spa の顧客満足度調査（アンケート）と、そこから派生する Google 口コミ / HP掲載への自然な誘導を設計したシステム仕様書。
> AI が口コミ文章を「書く」のではなく、お客様の実体験を「言語化するのを助ける」ツールとして実装する。

**作成日**: 2026-04-25
**対象**: T-MANAGE の顧客マイページ / バックオフィス
**実装優先度**: Phase 1 として本番稼働後（6/1以降）の最優先機能
**想定実装期間**: 2〜3週間

---

## 🎯 目的と設計思想

### 最終ゴール

1. **MEO順位向上**: Google マップ検索で「安城 メンズエステ」「豊橋 メンズエステ」等の上位表示を達成
2. **顧客満足度の定量把握**: セラピスト別・店舗別の NPS（Net Promoter Score）を継続的に追跡
3. **HP への口コミ掲載**: 自社サイトにリアルな顧客の声を掲載して信頼性向上
4. **改善サイクル構築**: 不満点の早期発見と即座の改善

### 3つの絶対原則

**① AIは「書かない」、「言語化を助ける」だけ**
お客様が体験した事実・感情を引き出し、自然な文章に成形するのみ。AI が創作した内容は絶対に混入させない。

**② Google ポリシー完全遵守**
Google 口コミ投稿に対するポイント付与は行わない。Google へ投稿しなくてもアンケートだけで完結する設計。

**③ お客様の身バレリスクへの最大限の配慮**
メンズエステ特有の事情を理解し、実名・アカウント名での投稿を強制しない。サブアカウント利用の詳細ガイドを明記。

---

## ⚖️ 法的制約と前提（最重要）

### Google ポリシー違反になる行為

Google 公式「マップユーザーの投稿コンテンツに関するポリシー」より、以下は明確な禁止事項：

> 企業が提供するインセンティブ（金銭的報酬、割引、無料の商品やサービスなど）が誘因となって投稿されているコンテンツ

**ポイント付与は「金銭的報酬」に該当する** ため、Google 口コミ投稿に対してポイントを付与することは禁止。

### 違反した場合のペナルティ（2024〜2025年で急激に強化）

1. 虚偽エンゲージメントと判定された口コミの一括削除
2. 一定期間、新規クチコミ・評価を受け取れなくなる
3. Google ビジネスプロフィールの検索順位が圏外に
4. 最悪、ビジネスプロフィール完全停止 → Google マップ上から Ange Spa が消える

### 消費者庁ステマ規制（追加リスク）

2024年6月、消費者庁はステマ規制で初の措置命令を医療法人に発出。「星5または4で投稿すれば割引」と案内していたクリニックが対象。景品表示法違反として行政処分を受ける可能性がある。

### 2024年11月以降の新たなリスク

Google が「事業活動を報告するフォーム」を公開。競合店や一般ユーザーが**証拠写真付きで通報できる** ようになった。メンズエステ業界は競合密集度が高く、通報リスクが現実的。

### 本システムでの遵守方針

| 行為 | ポイント付与 | 理由 |
|---|---|---|
| T-MANAGE内アンケート回答 | ✅ 1000pt | 社内調査であり Google と無関係 |
| HP掲載許可（自社サイト） | ✅ 500pt | 自社サイトは Google 規制の対象外 |
| Google 口コミ投稿 | ❌ 0pt | **絶対に付与しない** |

Google 投稿は「アンケート完了後のお礼として任意でご案内」するのみ。ポイントインセンティブと切り離す。

---

## 📐 システム全体アーキテクチャ

```
┌─────────────────────────────────────────────────────────┐
│                  お客様の体験ルート                       │
└─────────────────────────────────────────────────────────┘

【施術終了】
    │
    ├─ マイページ登録者 → 自動でアンケート通知が届く
    │       │
    │       ▼
    │   customer-mypage でアンケート回答
    │
    └─ 非登録者 → 施術後の案内カード QR から任意アクセス
            │
            ▼
        /survey/[token] で回答（トークン認証・軽量フォーム）

【アンケート回答画面】
    ↓
    ① 評価（星・チェックボックス・自由記述）
    ② AI が文章化のお手伝い
    ③ 回答確定（customer_surveys に保存）
    ④ ポイント1000pt自動付与（マイページ登録者のみ）

【完了画面（最重要）】
    ↓
    ┌──────────────────────────────────────┐
    │ ✨ ご回答ありがとうございました          │
    │ AI が作成した口コミ文章はこちら：        │
    │ ┌────────────────────────────────┐   │
    │ │ （生成された文章）                 │   │
    │ └────────────────────────────────┘   │
    │                                      │
    │ 【目立つボタン】                      │
    │ 🌸 Google に投稿する（任意）          │
    │ 🌸 HP 掲載を許可する（500pt）          │
    │                                      │
    │ 💡 Google 投稿時の身バレ配慮ガイド     │
    │ ├ サブアカウント推奨                   │
    │ ├ Googleアカウント名変更リンク         │
    │ └ ニックネーム登録方法                 │
    └──────────────────────────────────────┘
```

---

## 👥 ユーザー体験フロー（詳細）

### シナリオA: マイページ登録者

**トリガー**: `reservations.customer_status` が `completed` に遷移
**遅延**: 施術終了後 2時間後（帰宅後、落ち着いたタイミング）

1. マイページに通知「🌸 本日のご感想をお聞かせください（1000pt獲得）」
2. 顧客が通知タップ → アンケート画面へ
3. 評価項目に回答（2〜3分想定）
4. AI 生成文章の確認・編集
5. 回答確定 → `customer_surveys` に保存
6. 1000pt 自動付与（`customer_points` に insert）
7. 完了画面で Google 投稿誘導 + HP 掲載同意オプション

### シナリオB: 非登録者

**トリガー**: ルーム内の案内カード QR コードをお客様がスキャン
**認証**: 無認証 or 電話番号入力での簡易紐付け

1. `/survey/[token]` にアクセス（トークンは予約IDから生成）
2. 「お客様のお名前 or 電話番号下4桁」で予約を特定
3. 同じアンケート画面
4. 回答確定 → `customer_surveys` に保存（顧客IDなし、予約IDで紐付け）
5. **ポイント付与なし**（マイページ登録を訴求）
6. 完了画面で Google 投稿誘導 + マイページ登録誘導（登録すれば1000pt遡及付与）

### シナリオC: 配信停止希望者

マイページ設定に「アンケート通知を受け取らない」チェックボックス。ON にした顧客にはアンケート通知を送らない（ただし、任意でマイページから回答は可能）。

---

## 📝 アンケートの構造（AI補助対応）

### Phase 1: 評価項目（所要 1分）

**① 総合満足度**（必須・5段階星評価）

```
★☆☆☆☆ 1 とても不満
★★☆☆☆ 2 不満
★★★☆☆ 3 普通
★★★★☆ 4 満足
★★★★★ 5 とても満足
```

**② 各項目の評価**（任意・3段階）

| 項目 | 😊 よかった / 🙂 普通 / 😢 改善希望 |
|---|---|
| セラピストの施術 |  |
| 接客・対応 |  |
| お部屋の雰囲気 |  |
| 清潔感 |  |
| コースの満足度 |  |

**③ 印象に残ったポイント**（複数選択可）

```
☐ 技術の高さ
☐ リラックスできた
☐ 話しやすい・気さく
☐ 清潔感
☐ アロマの香り
☐ タオル・備品の質
☐ 時間管理
☐ プライバシー配慮
☐ おもてなし
☐ その他（自由記述）
```

### Phase 2: 自由記述（所要 1分）

**④ 特に良かった点**（任意・短文）
> 例: アロマの香りがとてもよく、リラックスできました

**⑤ 改善してほしい点**（任意・短文）
> 例: お部屋が少し寒く感じた

**⑥ 担当セラピストへの一言**（任意・短文）
> 例: またぜひ指名したいです

### Phase 3: AI 補助（所要 30秒）

上記の情報を元に、Claude API で自然な口コミ文章を生成：

**AI プロンプト設計**:
```
あなたは、メンズエステ店での実体験をもとに、お客様が Google 口コミや
HP 掲載用に使える自然な文章を作成するアシスタントです。

# 絶対ルール
- お客様が入力した情報以外を絶対に創作しない
- 誇張表現、宣伝文句を追加しない
- 「施術」「マッサージ」等の性的ニュアンスを避け、
  「ボディケア」「リラクゼーション」等の中立表現を使用
- 150〜250文字程度で、です・ます調
- セラピスト個人を特定しすぎない（源氏名は入れてよい）
- 絵文字は控えめに（0〜2個まで）

# お客様の入力情報
- 総合評価: {rating_overall}/5
- 印象に残ったポイント: {highlights}
- 特に良かった点: {good_points}
- 改善してほしい点: {improvement_points}
- セラピストへの一言: {therapist_message}

# 出力
口コミ本文のみ。前置きや「以下が口コミです」等の説明不要。
```

**生成後の挙動**:
- 画面上に文章が表示される
- **お客様が自由に編集可能**（テキストエリアで直接編集）
- 「もう一度AIに作ってもらう」ボタン（最大3回まで再生成可能、API コスト対策）
- 「自分で最初から書く」ボタン（AI使わない選択肢）

### Phase 4: 投稿導線（所要 1分）

詳細は [Google 投稿誘導の詳細](#-google-投稿誘導の詳細設計) セクション参照。

---

## 🗄 データベース設計

### 新規テーブル1: `customer_surveys`

```sql
CREATE TABLE IF NOT EXISTS customer_surveys (
  id bigserial PRIMARY KEY,

  -- 紐付け
  customer_id bigint REFERENCES customers(id) ON DELETE SET NULL,
  reservation_id bigint REFERENCES reservations(id) ON DELETE SET NULL,
  therapist_id bigint REFERENCES therapists(id) ON DELETE SET NULL,

  -- トークン認証（非登録者用）
  access_token text UNIQUE,

  -- 評価
  rating_overall int CHECK (rating_overall >= 1 AND rating_overall <= 5),
  rating_therapist text,           -- 'good' | 'normal' | 'bad'
  rating_service text,
  rating_atmosphere text,
  rating_cleanliness text,
  rating_course text,

  -- 印象ポイント（複数選択）
  highlights jsonb DEFAULT '[]',   -- ["技術の高さ", "清潔感", ...]
  highlights_custom text,          -- その他自由記述

  -- 自由記述
  good_points text,
  improvement_points text,
  therapist_message text,

  -- AI 生成文章
  ai_generated_text text,          -- AI が生成した文章
  final_review_text text,          -- お客様が最終的に確定した文章
  ai_regenerate_count int DEFAULT 0, -- AI再生成回数（上限3）

  -- 投稿状態
  google_posted boolean DEFAULT false,     -- Google投稿したか（自己申告）
  google_posted_at timestamptz,
  hp_publish_consent boolean DEFAULT false, -- HP掲載同意したか
  hp_publish_approved_at timestamptz,       -- 社内承認日時
  hp_publish_approved_by bigint,            -- 承認者 staff_id
  hp_published boolean DEFAULT false,       -- 実際にHP掲載中か
  hp_display_name text,                     -- HP掲載時の表示名（「30代男性 Aさん」等）

  -- ポイント
  point_granted boolean DEFAULT false,      -- アンケート回答ポイント付与済み
  point_granted_amount int DEFAULT 0,
  hp_point_granted boolean DEFAULT false,   -- HP掲載ポイント付与済み
  hp_point_granted_amount int DEFAULT 0,

  -- メタ
  submitted_at timestamptz DEFAULT now(),
  submitted_from text,              -- 'mypage' | 'qr' | 'email_link'
  ip_hash text,                     -- 重複回答防止（ハッシュ化）

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  -- 制約
  UNIQUE(reservation_id)            -- 1予約1アンケート
);

CREATE INDEX idx_surveys_customer ON customer_surveys(customer_id);
CREATE INDEX idx_surveys_therapist ON customer_surveys(therapist_id);
CREATE INDEX idx_surveys_reservation ON customer_surveys(reservation_id);
CREATE INDEX idx_surveys_rating ON customer_surveys(rating_overall);
CREATE INDEX idx_surveys_submitted ON customer_surveys(submitted_at DESC);
CREATE INDEX idx_surveys_hp_published ON customer_surveys(hp_published) WHERE hp_published = true;
CREATE INDEX idx_surveys_token ON customer_surveys(access_token);

ALTER TABLE customer_surveys DISABLE ROW LEVEL SECURITY;
```

### 新規テーブル2: `survey_notifications`（配信管理）

```sql
CREATE TABLE IF NOT EXISTS survey_notifications (
  id bigserial PRIMARY KEY,
  reservation_id bigint REFERENCES reservations(id) ON DELETE CASCADE,
  customer_id bigint REFERENCES customers(id) ON DELETE CASCADE,

  -- 配信スケジュール
  scheduled_at timestamptz NOT NULL,       -- 配信予定時刻
  sent_at timestamptz,                     -- 実際の送信時刻
  channel text NOT NULL,                   -- 'mypage_notification' | 'email' | 'line'

  -- 状態
  status text DEFAULT 'pending',           -- 'pending' | 'sent' | 'failed' | 'skipped'
  response_survey_id bigint REFERENCES customer_surveys(id),  -- 回答された場合紐付け

  -- ステータス理由
  skip_reason text,                        -- 'opted_out' | 'already_responded' | 'no_mypage'
  error_message text,

  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_survey_notify_scheduled ON survey_notifications(scheduled_at);
CREATE INDEX idx_survey_notify_status ON survey_notifications(status);

ALTER TABLE survey_notifications DISABLE ROW LEVEL SECURITY;
```

### 既存テーブルの拡張

**`customers` テーブル**:
```sql
ALTER TABLE customers ADD COLUMN IF NOT EXISTS survey_opt_out boolean DEFAULT false;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS survey_response_count int DEFAULT 0;
```

**`point_settings` テーブル**（既存の `review_bonus` を再定義）:
```sql
-- 既存 review_bonus を「アンケート回答ボーナス」として1000に設定
UPDATE point_settings SET review_bonus = 1000 WHERE id = (SELECT id FROM point_settings LIMIT 1);

-- HP掲載同意ボーナスを新規追加
ALTER TABLE point_settings ADD COLUMN IF NOT EXISTS hp_publish_bonus int DEFAULT 500;
```

**`therapists` テーブル**（セラピスト別満足度集計のキャッシュ）:
```sql
ALTER TABLE therapists ADD COLUMN IF NOT EXISTS avg_rating numeric(3,2);
ALTER TABLE therapists ADD COLUMN IF NOT EXISTS survey_count int DEFAULT 0;
ALTER TABLE therapists ADD COLUMN IF NOT EXISTS nps_score numeric(5,2);
```

---

## 🌐 Google 投稿誘導の詳細設計

### Place ID の取得（事前準備）

Ange Spa の各店舗の Google Maps Place ID を取得して `stores` テーブルに保存する。

```sql
ALTER TABLE stores ADD COLUMN IF NOT EXISTS google_place_id text;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS google_review_url text;
```

Place ID は https://developers.google.com/maps/documentation/places/web-service/place-id で取得可能。
取得できれば以下の形式で書込み画面直リンクを生成：

```
https://search.google.com/local/writereview?placeid={PLACE_ID}
```

### 完了画面の UI 設計

```
┌──────────────────────────────────────────────────┐
│  ✨ ご回答いただきありがとうございました            │
│                                                  │
│  🎁 1,000pt を獲得しました                         │
│                                                  │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                  │
│  📝 AIがあなたのご感想をもとに文章を作成しました：    │
│  ┌────────────────────────────────────────────┐  │
│  │                                            │  │
│  │  「本日はリラクゼーションの時間を過ごさせて     │  │
│  │   いただきました。アロマの香りが心地よく、      │  │
│  │   担当の方もとても丁寧で、日々の疲れが        │  │
│  │   すっかり癒されました。また利用したいです。」   │  │
│  │                                            │  │
│  └────────────────────────────────────────────┘  │
│  [ ✏️ 編集する ] [ 🔄 AIに作り直してもらう ]         │
│                                                  │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                  │
│  上記の文章を活用していただけると大変嬉しいです       │
│                                                  │
│  ┌────────────────────────────────────────────┐  │
│  │  📋 文章をコピー                            │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  ┌────────────────────────────────────────────┐  │
│  │  🌸 Google にクチコミを投稿する（任意）       │  │
│  │     ※ポイント付与はございません              │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  ┌────────────────────────────────────────────┐  │
│  │  ✨ HP への掲載を許可する（+500pt）           │  │
│  │     匿名「30代男性 Aさん」として掲載         │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                  │
│  💡 Google 投稿についての大切なお知らせ            │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                  │
│  Google マップのクチコミは、Googleアカウント名      │
│  （本名やメールアドレスの一部）が表示されます。       │
│                                                  │
│  プライバシーが気になる方は、以下の方法をご検討      │
│  ください：                                       │
│                                                  │
│  🔒 方法1: サブアカウント（推奨）                   │
│  クチコミ投稿用に、別の Google アカウントを         │
│  作成してご利用いただく方法です。本アカウントとは   │
│  完全に分離されるため、最も安心です。               │
│  [ サブアカウントの作り方を見る → ]                │
│                                                  │
│  ✏️ 方法2: Googleアカウント名を変更                 │
│  本アカウントのまま、表示名のみニックネームに        │
│  変更することもできます。5分で完了します。          │
│  [ 変更方法を見る → ]                              │
│                                                  │
│  ❓ よくあるご質問                                 │
│  Q. 過去のクチコミの表示名も変わりますか？          │
│  A. はい、すべて新しい名前で表示されます。          │
│                                                  │
│  Q. 実名がバレる可能性はありますか？                │
│  A. プロフィール写真と表示名を変更すれば、          │
│     実名が表示されることはありません。              │
│                                                  │
│  もちろん投稿は任意です。アンケートだけでも          │
│  十分ありがたく存じます 🌸                         │
└──────────────────────────────────────────────────┘
```

### 身バレ配慮ガイドページ（詳細版）

`/mypage/google-review-guide` を新設。以下の内容を記載：

1. **はじめに**
   - なぜこのページが必要か
   - Ange Spa がお客様のプライバシーを最優先に考えていること

2. **方法1: サブアカウント作成（5〜10分）**
   - サブアカウント作成のメリット・デメリット
   - Gmail で新しいアカウントを作る手順（スクリーンショット付き）
   - Googleマップアプリでアカウント切替手順
   - 注意: 13歳以上である必要があること等
   - 外部リンク: https://support.google.com/accounts/answer/27441

3. **方法2: 表示名変更（3〜5分）**
   - Googleアカウント管理画面への行き方
   - 「個人情報」→「名前」編集の手順（スクリーンショット）
   - 姓名どちらもニックネームに変更可能
   - 外部リンク: https://myaccount.google.com/personal-info

4. **方法3: プロフィール写真の変更**
   - 実名・顔写真を削除する手順
   - イニシャル表示への変更

5. **投稿内容の注意**
   - 通った頻度や具体的な場所を明かしすぎない
   - 「お世話になっています」等のリピーター感を強調する一文を避けたい場合の配慮

6. **Q&A**

### 実装上の工夫

**コピーボタンの挙動**:
```javascript
navigator.clipboard.writeText(finalReviewText);
// トースト: 「📋 クリップボードにコピーしました」
```

**Google投稿ボタンの挙動**:
```javascript
// 1. コピー実行（自動）
await navigator.clipboard.writeText(finalReviewText);

// 2. モーダル表示「文章をコピーしました。投稿先でペーストしてください」
showModal({
  title: "📋 文章をコピーしました",
  body: "Google マップの投稿画面を開きます。画面が表示されたら、本文欄に長押しでペーストしてください。",
  confirm: "Google を開く",
  onConfirm: () => {
    window.open(store.google_review_url, "_blank");
    // survey.google_posted = true 仮マーク（自己申告ベース）
  }
});
```

---

## 🎁 ポイント付与仕様

### ポイント一覧

| アクション | ポイント | 付与タイミング | 条件 |
|---|---|---|---|
| アンケート回答完了 | **1,000pt** | 即時 | マイページ登録者のみ、1予約1回まで |
| HP掲載同意 | **500pt** | 社内承認後 | 同意かつ運営側で公開承認した時点 |
| Google 口コミ投稿 | **0pt** | - | **絶対に付与しない**（ポリシー違反） |

### 有効期限

既存 `point_settings.expiry_months`（デフォルト12ヶ月）に準拠。

### UI での表示例

```
┌─────────────────────────┐
│ 🎁 1,000pt を獲得しました │
│ 有効期限: 2027/04/25    │
└─────────────────────────┘
```

### 不正対策

- 1予約1アンケートのみ（`UNIQUE(reservation_id)`）
- 同一IPハッシュで短時間に複数予約への回答検出
- 管理画面でポイント付与取消機能（付与済みポイントを取消し＋理由記録）

---

## 📊 バックオフィス分析画面

### 新規ページ: `/survey-dashboard`

**アクセス権**: `isManager`（owner / manager / leader / 責任者）

#### タブ1: 📊 総合サマリー

- 当月の回答数・回答率
- 平均満足度（5段階）
- NPS スコア
- 月次推移グラフ

#### タブ2: 👤 セラピスト別

- セラピストごとの平均星・回答数・NPS
- 良かった点ランキング
- 改善希望ランキング
- セラピストマイページからも自分のだけ閲覧可能

#### タブ3: 📝 個別回答閲覧

- アンケート一覧（日付・顧客・セラピスト・評価）
- 詳細モーダルで自由記述フル表示
- HP 掲載承認ワークフロー（未承認→承認→公開）
- 悪質口コミ・誹謗中傷の削除機能

#### タブ4: 🏢 店舗別

- 豊橋・安城・名古屋の比較
- 清潔感・雰囲気の店舗別評価

#### タブ5: 🚨 アラート

- 星1〜2の低評価回答を自動ピックアップ
- 改善希望が集中している項目
- 特定セラピストの評価急落警告

### 回答データの外部公開

**HP**（`/corporate` または Ange Spa 公式HP）:
- `hp_published = true` の回答のみ自動掲載
- 直近100件、星4以上のみ
- セラピスト名を伏せるかオプション

---

## 📬 配信仕様

### マイページ登録者への自動配信

**実装方式**: Vercel Cron Job or Supabase pg_cron
**頻度**: 15分ごと

```sql
-- 配信対象を抽出するクエリ
SELECT r.*, c.id as customer_id
FROM reservations r
JOIN customers c ON c.id = r.customer_id
WHERE r.customer_status = 'completed'
  AND r.status = 'completed'
  AND c.login_email IS NOT NULL
  AND c.survey_opt_out = false
  AND NOT EXISTS (
    SELECT 1 FROM survey_notifications sn
    WHERE sn.reservation_id = r.id
  )
  AND NOT EXISTS (
    SELECT 1 FROM customer_surveys cs
    WHERE cs.reservation_id = r.id
  )
  AND r.end_time < now() - interval '2 hours';
```

取得したものを `survey_notifications` にスケジュール登録 → 別の Cron Job が配信実行。

### 非登録者への QR コード配布

**印刷物のデザイン**（ルーム内カード）:

```
┌────────────────────────────┐
│  🌸 本日はご来店ありがとう    │
│      ございました             │
│                            │
│  よろしければ 1分で完了する   │
│  アンケートにご協力ください    │
│                            │
│   ┌─────────┐              │
│   │ [QR コード] │             │
│   └─────────┘              │
│                            │
│  マイページ会員登録で         │
│  1,000pt 獲得できます         │
│                            │
│  Ange Spa                  │
└────────────────────────────┘
```

QR コードは `/survey/[token]` にリンク。トークンは各予約ごとに発行。

---

## 🔌 API 設計

### 新規エンドポイント

#### `POST /api/survey-ai-compose`

AI で口コミ文章を生成。

**リクエスト**:
```ts
{
  ratingOverall: number,           // 1-5
  highlights: string[],            // ["技術の高さ", "清潔感"]
  goodPoints: string,              // 自由記述
  improvementPoints: string,
  therapistMessage: string,
  therapistName?: string,          // 源氏名を文章に含める場合
  regenerateCount: number,         // 再生成回数（上限3）
}
```

**レスポンス**:
```ts
{
  text: string,                    // 生成された文章
  canRegenerate: boolean,
}
```

**実装**:
- モデル: `claude-sonnet-4-6`（自然な文章向け）
- max_tokens: 500
- キャッシュなし（毎回生成）
- レートリミット: 同一IPで1分10回まで

#### `POST /api/survey-submit`

アンケート回答を保存してポイント付与。

**リクエスト**:
```ts
{
  token?: string,                  // 非登録者の場合
  customerId?: number,             // マイページ登録者の場合
  reservationId: number,
  therapistId: number,
  ratingOverall: number,
  ratingTherapist: string,
  // ... 他の評価項目
  finalReviewText: string,
  aiGenerated: boolean,
  hpPublishConsent: boolean,
  submittedFrom: 'mypage' | 'qr',
}
```

**レスポンス**:
```ts
{
  surveyId: number,
  pointsGranted: number,
  googleReviewUrl?: string,
}
```

### 既存 API の拡張

- `/api/tax-ai` にレビュー生成用プロンプトを追加 or 専用エンドポイント分離
- マニュアル AI と同じく 529 自動リトライパターン適用

---

## 🎨 UI/UXの配慮

### モバイル優先設計

- すべての画面がスマホ縦画面最適化
- 評価ボタンは指で押しやすいサイズ（min-height: 44px）
- AI 生成中のローディングは丁寧に（「✨ 文章を作成中...」）

### 心理的ハードルを下げる工夫

- 所要時間を明示「所要2〜3分」
- プログレスバーで進捗可視化
- 「スキップ」ボタンを各任意項目に配置
- 「後で回答する」オプション（マイページ登録者）

### アクセシビリティ

- 文字サイズ調整可
- 色だけに依存しない表現（星と数字併記）
- スクリーンリーダー対応

---

## 🏗 段階実装プラン

### Phase 1: 最小機能（1週間）

- [ ] DB マイグレーション実行
- [ ] `customer-mypage` にアンケートタブ追加
- [ ] 評価フォーム実装（Phase 1-2）
- [ ] AI 生成 API 実装
- [ ] 完了画面・コピー機能
- [ ] ポイント付与ロジック

### Phase 2: 配信と分析（1週間）

- [ ] 自動配信 Cron Job
- [ ] 非登録者用 `/survey/[token]` ページ
- [ ] バックオフィス `/survey-dashboard`（タブ1〜3）
- [ ] セラピストマイページの評価閲覧

### Phase 3: Google / HP連動（1週間）

- [ ] Place ID 取得・登録
- [ ] 身バレ配慮ガイド `/mypage/google-review-guide`
- [ ] HP掲載承認ワークフロー
- [ ] 公式HPへの口コミ掲載セクション実装
- [ ] QR コード印刷物のデザイン

### Phase 4: 運用改善（継続）

- [ ] 低評価アラート通知（経営者向け）
- [ ] 月次レポート自動生成
- [ ] プロンプト調整（運用データから学習）
- [ ] A/Bテスト（完了画面の導線）

---

## ⚠️ 運用面の注意事項

### セラピストへの教育

- アンケート結果は個人攻撃に使わない
- 低評価は「改善機会」として扱う
- セラピスト本人にフィードバック時は言い方に配慮

### 低評価への対応フロー

1. 星1〜2の回答が来たら即日 Slack / LINE で通知
2. 経営者が本人に状況確認
3. 必要に応じて店長が顧客にフォロー（LINE等）
4. 改善案をアクションリストに追加

### Google 口コミへの返信運用

- **すべての口コミに丁寧に返信する**（MEO 重要要素）
- 返信は経営責任者または店長が担当
- 低評価にも感情的にならず、改善姿勢を示す
- 返信テンプレートを何種類か用意

### ポリシー違反の自己監査

**年4回（四半期ごと）に以下を確認**:
- [ ] Google 口コミポイント付与ロジックがコードに存在しないか
- [ ] 完了画面の文言に「ポイントプレゼント」がGoogleボタン側に無いか
- [ ] 印刷物・案内カードで Google 口コミに対価示唆の表現がないか
- [ ] セラピストが口頭で「Googleに書いてくれたら◯◯」と言っていないか

---

## 📚 参考情報

### Google 公式ポリシー
- [マップユーザーの投稿コンテンツに関するポリシー](https://support.google.com/contributionpolicy/answer/7400114)
- [禁止および制限されているコンテンツ](https://support.google.com/contributionpolicy/answer/7400114?hl=ja)

### 消費者庁ステマ規制
- 2024年6月 医療法人に対する初の措置命令
- 景品表示法に基づく指定告示

### 技術情報
- Google Places API（Place ID 取得）
- writereview URL: `https://search.google.com/local/writereview?placeid=XXX`

---

## 📝 関連ドキュメント

- `02_FEATURES.md` — マイページ全機能との統合
- `04_DATABASE.md` — DB 構造全体
- `07_API_ROUTES.md` — API エンドポイント一覧
- `13_LAUNCH_CHECKLIST.md` — 本番稼働時のチェック項目

---

## 🔄 更新履歴

- **2026-04-25**: 初版作成
  - Google ポリシー違反の致命的リスクを明記
  - アンケート（1000pt）と Google 投稿（0pt）の明確な分離
  - 身バレ配慮ガイドの詳細化
  - AI 補助の設計思想を明記（創作禁止）
