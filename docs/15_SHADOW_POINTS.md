# 15. シャドウロイヤリティプログラム（シャドウポイント）仕様書

> マイページ未登録のお客様にも「裏で」ポイントを蓄積し、登録時に2倍付けで解放することで、マイページ登録率の飛躍的な向上を目指す仕組み。

**作成日**: 2026-04-25
**対象**: T-MANAGE 全体（マイページ / バックオフィス / タイムチャート）
**実装優先度**: Phase 2 として `14_REVIEW_SYSTEM.md` 実装後に着手
**想定実装期間**: 1〜2週間

---

## 🎯 目的と設計思想

### 解決したい課題

現状のポイントシステムは「マイページ登録者のみ」が対象。そのため：

- 未登録者にとってポイントはゼロの価値
- 登録する強いメリットが「今」感じられない
- リピート客ほど「今さら登録しても…」と腰が重い
- 休眠客の呼び戻しフックがない

### シャドウポイントで実現すること

1. **全顧客に自動でポイント蓄積**（裏で）
2. **未登録者への登録インセンティブを劇的強化**
3. **休眠客の呼び戻し材料**として活用
4. **スタッフの接客カード**として機能
5. **Ange Spa の「お客様を大切にする姿勢」の具現化**

### 設計の3原則

**① お客様には事前に告知しない（サプライズ要素）**
普段の接客では「裏で貯まっている」ことは話さない。「登録時の特典」として初めて開示することで、心理的インパクトを最大化。

**② 登録時に満額解放（損失回避バイアスの活用）**
「今登録すれば倍になる」という提案は、行動経済学の「授かり効果」と「損失回避」の両方を突く。

**③ 未登録期間は原資リスク50%に抑制**
シャドウポイントは正規レートの50%で蓄積。登録時に2倍化して正規レートに戻す。未登録のまま原資リスクを膨らませない。

---

## 📐 全体アーキテクチャ

```
┌─────────────────────────────────────────────────────────┐
│                未登録時（シャドウ蓄積）                    │
└─────────────────────────────────────────────────────────┘

【来店・施術完了】
    │
    ↓
顧客の customer_points に insert:
  {
    customer_id: 123,
    amount: 100,              ← 正規200ptの50%
    type: "earn",
    is_shadow: true,          ← 🔑 シャドウフラグ
    shadow_multiplier: 0.5,   ← 50%で貯めた記録
    description: "ご来店ポイント",
    expires_at: 2027/04/25    ← 有効期限は通常通り
  }

【お客様から見ると】
  マイページは未登録なので、そもそもポイント残高を確認できない。
  裏で貯まっていることを知らない。


┌─────────────────────────────────────────────────────────┐
│               登録時（シャドウ昇格）                       │
└─────────────────────────────────────────────────────────┘

【マイページ登録】
    │
    ↓
シャドウポイント昇格処理（SQL Function or アプリ層）:
  ① is_shadow=true の該当顧客ポイントを全取得
  ② それぞれ amount × (1 / shadow_multiplier) で再計算
     100pt → 200pt （0.5 の逆数 = 2倍）
  ③ is_shadow=false に更新
  ④ description に「(登録時2倍化)」を追加
  ⑤ お祝い通知を送信（「ようこそ！ XX pt を解放しました」）

【お客様から見ると】
  マイページ登録完了の瞬間に「おめでとうございます！
  1,200pt をプレゼント！」と大きな通知が表示される。
  内訳: 登録ボーナス200pt + シャドウ解放1,000pt


┌─────────────────────────────────────────────────────────┐
│         登録後（通常の正規レート蓄積）                     │
└─────────────────────────────────────────────────────────┘

来店時のポイント付与は通常の正規レート（200pt/回等）。
以降のポイントは is_shadow=false で普通に蓄積される。
```

---

## 🗄 データベース設計

### 既存テーブル `customer_points` の拡張

```sql
ALTER TABLE customer_points ADD COLUMN IF NOT EXISTS is_shadow boolean DEFAULT false;
ALTER TABLE customer_points ADD COLUMN IF NOT EXISTS shadow_multiplier numeric(3,2) DEFAULT 1.0;
ALTER TABLE customer_points ADD COLUMN IF NOT EXISTS promoted_at timestamptz;
ALTER TABLE customer_points ADD COLUMN IF NOT EXISTS original_amount int;
-- 昇格前の元の金額を保持（例: 100）。プロモート後も参照可能に。

CREATE INDEX idx_customer_points_shadow ON customer_points(customer_id, is_shadow)
  WHERE is_shadow = true;
```

**カラムの意味**:

| カラム | 意味 | 例 |
|---|---|---|
| `is_shadow` | シャドウポイントかどうか | `true`: 裏蓄積中 / `false`: 通常（またはプロモ済み） |
| `shadow_multiplier` | 蓄積時の倍率 | `0.5`: 半額で貯めた / `1.0`: 正規レート |
| `promoted_at` | 昇格日時 | プロモーション処理実行時刻 |
| `original_amount` | 元の金額 | 100（プロモ後に amount=200になっても original=100 のまま） |

### 既存テーブル `point_settings` の拡張

```sql
ALTER TABLE point_settings ADD COLUMN IF NOT EXISTS shadow_enabled boolean DEFAULT true;
ALTER TABLE point_settings ADD COLUMN IF NOT EXISTS shadow_rate numeric(3,2) DEFAULT 0.5;
ALTER TABLE point_settings ADD COLUMN IF NOT EXISTS shadow_max_amount int DEFAULT 5000;
-- 1顧客あたりシャドウ蓄積上限（5000pt = 5000円相当）
-- これを超えたら蓄積停止、登録誘導を強化
```

**設定項目**:

| 項目 | デフォルト | 説明 |
|---|---|---|
| `shadow_enabled` | `true` | シャドウポイント制度の ON/OFF |
| `shadow_rate` | `0.5` | 未登録時の蓄積レート（正規の50%） |
| `shadow_max_amount` | `5000` | 1顧客あたりのシャドウ蓄積上限 |

### 新規テーブル `shadow_promotion_logs`（昇格履歴）

```sql
CREATE TABLE IF NOT EXISTS shadow_promotion_logs (
  id bigserial PRIMARY KEY,
  customer_id bigint NOT NULL REFERENCES customers(id) ON DELETE CASCADE,

  -- 昇格前後の金額
  shadow_points_count int NOT NULL,        -- 昇格対象のポイント件数
  total_original_amount int NOT NULL,      -- 昇格前の合計（例: 1000pt）
  total_promoted_amount int NOT NULL,      -- 昇格後の合計（例: 2000pt）
  multiplier_used numeric(3,2) NOT NULL,   -- 使用倍率（例: 2.0）

  -- トリガー
  triggered_by text DEFAULT 'mypage_registration',
  -- 'mypage_registration' | 'manual_by_staff' | 'recovery_process'

  staff_id bigint,  -- スタッフ手動実行の場合
  note text,

  promoted_at timestamptz DEFAULT now()
);

CREATE INDEX idx_shadow_promo_customer ON shadow_promotion_logs(customer_id);

ALTER TABLE shadow_promotion_logs DISABLE ROW LEVEL SECURITY;
```

---

## ⚙️ コアロジック

### ポイント付与時の分岐（施術完了時）

```typescript
// lib/point-grant.ts (仮)
async function grantPointsOnVisit(
  customerId: number,
  reservationId: number,
  coursePrice: number
) {
  const { data: customer } = await supabase
    .from("customers")
    .select("id, login_email, login_password")
    .eq("id", customerId)
    .single();

  const { data: settings } = await supabase
    .from("point_settings")
    .select("*")
    .single();

  const isRegistered = !!(customer?.login_email && customer?.login_password);
  const normalPoints = Math.floor(coursePrice * settings.earn_per_yen);

  if (isRegistered) {
    // 正規レートで付与
    await supabase.from("customer_points").insert({
      customer_id: customerId,
      amount: normalPoints,
      type: "earn",
      is_shadow: false,
      shadow_multiplier: 1.0,
      description: "🌸 ご来店ポイント",
      expires_at: addMonths(new Date(), settings.expiry_months),
    });
  } else {
    // シャドウモード判定
    if (!settings.shadow_enabled) {
      return; // 制度無効なら何もしない
    }

    // 既存シャドウ合計チェック（上限5000pt）
    const { data: existingShadow } = await supabase
      .from("customer_points")
      .select("amount")
      .eq("customer_id", customerId)
      .eq("is_shadow", true);

    const currentShadowTotal = (existingShadow || []).reduce(
      (sum, p) => sum + p.amount, 0
    );

    if (currentShadowTotal >= settings.shadow_max_amount) {
      // 上限に達している → 蓄積停止（登録誘導アラートフラグは立てる）
      await flagCustomerForRegistrationPush(customerId);
      return;
    }

    // シャドウポイントとして半額で insert
    const shadowAmount = Math.floor(normalPoints * settings.shadow_rate);

    await supabase.from("customer_points").insert({
      customer_id: customerId,
      amount: shadowAmount,
      original_amount: shadowAmount,
      type: "earn",
      is_shadow: true,
      shadow_multiplier: settings.shadow_rate,
      description: "🌸 ご来店ポイント（非公開）",
      expires_at: addMonths(new Date(), settings.expiry_months),
    });
  }
}
```

### マイページ登録時の昇格処理

```typescript
// lib/shadow-promote.ts
async function promoteShadowPoints(customerId: number) {
  // 1. シャドウポイントを全取得
  const { data: shadowPoints } = await supabase
    .from("customer_points")
    .select("*")
    .eq("customer_id", customerId)
    .eq("is_shadow", true);

  if (!shadowPoints || shadowPoints.length === 0) {
    return { promoted: false, count: 0, amount: 0 };
  }

  const totalOriginal = shadowPoints.reduce((sum, p) => sum + p.amount, 0);
  let totalPromoted = 0;

  // 2. 各ポイントを個別に昇格
  for (const pt of shadowPoints) {
    const newAmount = Math.floor(pt.amount / pt.shadow_multiplier);
    totalPromoted += newAmount;

    await supabase
      .from("customer_points")
      .update({
        amount: newAmount,
        is_shadow: false,
        shadow_multiplier: 1.0,
        promoted_at: new Date().toISOString(),
        description: `${pt.description} (登録時${1 / pt.shadow_multiplier}倍化)`,
      })
      .eq("id", pt.id);
  }

  // 3. 昇格履歴を記録
  await supabase.from("shadow_promotion_logs").insert({
    customer_id: customerId,
    shadow_points_count: shadowPoints.length,
    total_original_amount: totalOriginal,
    total_promoted_amount: totalPromoted,
    multiplier_used: shadowPoints[0]?.shadow_multiplier
      ? 1 / shadowPoints[0].shadow_multiplier
      : 2.0,
    triggered_by: "mypage_registration",
  });

  // 4. お祝い通知
  await supabase.from("customer_notifications").insert({
    title: "🎉 おめでとうございます！ 特別ポイントを解放",
    body: `マイページご登録ありがとうございます！\n\n` +
      `これまでの来店で貯まった ${totalOriginal}pt が、\n` +
      `**${totalPromoted}pt**（${Math.round(totalPromoted / totalOriginal * 10) / 10}倍）に増えて使えるようになりました。\n\n` +
      `次回のご予約でぜひご利用ください 🌸`,
    type: "campaign",
    target_customer_id: customerId,
  });

  return { promoted: true, count: shadowPoints.length, amount: totalPromoted };
}
```

### 登録処理への組み込み

既存の `app/customer-mypage/page.tsx` の `handleRegister` 関数内の登録完了後に追加：

```typescript
// 既存の初回登録ボーナス処理の後に追加
await promoteShadowPoints(custId);
```

---

## 🖥 バックオフィス表示

### 顧客詳細画面（`/dashboard` 顧客一覧タブ）

未登録者の顧客詳細モーダルに、シャドウポイント情報を表示：

```
┌────────────────────────────────────────────┐
│ 👤 田中 太郎 様                              │
│ 📞 090-XXXX-XXXX                            │
│ 📅 来店 5回目                                │
│                                            │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                            │
│ 💎 シャドウポイント情報（お客様には非表示）     │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                            │
│ 📊 現在の蓄積: 500 pt                        │
│ 🎁 登録時の解放額: 1,000 pt（2倍化）          │
│                                            │
│ 💡 お客様接客時のご提案:                      │
│ 「マイページに登録いただくと、                │
│    これまでの来店ポイントが                   │
│    倍になって使えるようになります。            │
│    1,000円分のお得、いかがですか？」          │
│                                            │
│ [ 📱 登録案内カードを印刷 ]                   │
│ [ ✉️ SMS で登録リンクを送る ]                 │
│                                            │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│ 蓄積履歴                                    │
│  04/20 来店 +100pt                          │
│  04/05 来店 +100pt                          │
│  03/18 来店 +100pt                          │
│  03/01 来店 +100pt                          │
│  02/15 来店 +100pt                          │
└────────────────────────────────────────────┘
```

### タイムチャート精算モーダル（スタッフ/セラピスト向け）

精算時に、該当顧客が未登録の場合だけ控えめにバッジ表示：

```
┌──────────────────────────────────┐
│ 精算内容                          │
│ ...                              │
│                                  │
│ 💎 登録未完了のお客様               │
│ シャドウポイント 500pt 蓄積中       │
│ 登録案内の好機です                 │
└──────────────────────────────────┘
```

### 新規ページ `/shadow-dashboard`（管理画面）

**アクセス権**: `isManager`

```
┌────────────────────────────────────────────┐
│ 💎 シャドウポイント ダッシュボード            │
├────────────────────────────────────────────┤
│                                            │
│ 📊 概況                                     │
│ ┌────────────┬────────────┬────────────┐  │
│ │蓄積中顧客数 │蓄積総額    │登録時想定額 │  │
│ │  128 名    │ 45,300 pt  │ 90,600 pt  │  │
│ └────────────┴────────────┴────────────┘  │
│                                            │
│ 🎯 登録誘導優先リスト（蓄積多い順）           │
│ ┌──────────────────────────────────────┐  │
│ │ 1. 田中様   1,000pt → 2,000pt(登録時)│  │
│ │ 2. 佐藤様     800pt → 1,600pt        │  │
│ │ 3. 鈴木様     700pt → 1,400pt        │  │
│ │ ...                                  │  │
│ └──────────────────────────────────────┘  │
│                                            │
│ 📈 昇格統計（過去30日）                      │
│ ┌──────────────────────────────────────┐  │
│ │ 昇格件数: 12件                        │  │
│ │ 解放合計: 14,800pt                    │  │
│ │ 昇格率（未登録→登録）: 9.4%            │  │
│ └──────────────────────────────────────┘  │
│                                            │
│ ⚠️ 上限に達した顧客（要即登録誘導）           │
│ ┌──────────────────────────────────────┐  │
│ │ 山田様  5,000pt（上限）                │  │
│ │ これ以上蓄積されません。登録誘導を推奨。   │  │
│ └──────────────────────────────────────┘  │
└────────────────────────────────────────────┘
```

---

## 📋 スタッフ向け接客スクリプト

### 初回来店後の会計時（未登録・まだシャドウポイント少ない）

> 「本日はありがとうございました。当店ではマイページに登録いただくと、ポイントが貯まって次回からお得にご利用いただけます。ご興味ございましたら、QRコードをお渡ししますね」

**ポイント**: まだシャドウポイントが少ないので、特別な訴求はしない。通常のマイページ紹介。

### 3回目以降の会計時（シャドウポイント 300pt以上）

> 「田中様、いつもありがとうございます。実は当店のシステムで、田中様専用に『登録時特典ポイント』が貯まっておりまして…（笑顔）
>
> 今マイページに登録いただくと、**{shadowPoints × 2}pt** として次回お使いいただけます。金額にして **{shadowPoints × 2}円分** のお得になります。
>
> 登録はスマホで1分ほど、QRコードからできますが、いかがでしょうか？」

**ポイント**:
- 「システムで専用に」がサプライズ要素
- 具体的な金額を明示
- 所要時間（1分）で心理的ハードル下げる

### 久しぶりの来店時（休眠客・シャドウポイント 500pt以上）

> 「〇〇様、お久しぶりのご来店ありがとうございます！
>
> 実はまだお使いいただいていない『ご来店ポイント』が **{shadowPoints}pt** ございまして、マイページご登録で **{shadowPoints × 2}pt** として解放されます。
>
> 次回のご施術で **{shadowPoints × 2}円** がお値引きになりますよ。
>
> もしよろしければ、いまご登録されませんか？」

**ポイント**:
- 「久しぶり」を前向きに捉えて歓迎ムード
- 「解放」という表現でサプライズ感
- 強制感なく「もしよろしければ」で閉じる

### シャドウポイント上限到達時（5,000pt）

> 「〇〇様、いつもありがとうございます。実は〇〇様のお客様専用ポイントが **5,000pt（上限）** に達しておりまして…
>
> マイページに登録いただかないと、これ以上増えないようになっているんです。**いま登録いただくと 10,000pt** に倍化されますので、何回分もの施術がほぼ無料になる計算です。
>
> 当店としてもぜひ〇〇様に登録いただきたいので、少しお時間よろしければご案内いたします」

**ポイント**:
- 上限到達というレア状況を強調
- 金額インパクト（10,000pt = 10,000円分）
- スタッフも積極的に関与する姿勢を示す

---

## 🎨 お客様向けUI（登録完了時）

### 登録完了画面

```
┌──────────────────────────────────────────────┐
│                                              │
│         🎉 ご登録ありがとうございます！         │
│                                              │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                              │
│  ✨ 特別なお知らせ ✨                          │
│                                              │
│  これまでのご来店で貯まった                      │
│  「Ange Spa 特別ポイント」を                    │
│                                              │
│         1,000pt → 2,000pt                    │
│         (2倍化して解放)                        │
│                                              │
│  としてプレゼントいたします！                    │
│                                              │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                              │
│  🎁 初回登録ボーナス   +  500pt               │
│  💎 特別ポイント解放  + 2,000pt               │
│  ─────────────────────────                  │
│  現在のポイント残高      2,500pt               │
│                                              │
│  次回のご予約で、1ptあたり1円として            │
│  ご利用いただけます。                           │
│                                              │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                              │
│  [ 予約ページへ ]  [ マイページへ ]             │
└──────────────────────────────────────────────┘
```

### 通知センターへの通知

マイページ内の通知タブに以下の通知を自動送信：

```
🎉 おめでとうございます！ 特別ポイントを解放

マイページご登録ありがとうございます！

これまでの来店で貯まった 1,000pt が、
2,000pt（2倍）に増えて使えるようになりました。

次回のご予約でぜひご利用ください 🌸

[ 予約する ]
```

---

## 🔐 不正防止・運用ルール

### 重複カウント防止

- 同日の同顧客への複数予約 → 施術完了時にポイント付与は各回独立
- ただし「1予約1回」を超える付与はしない（`reservations.id` で UNIQUE 制約相当のチェック）

### シャドウポイント上限

- 1顧客あたり **5,000pt**（設定変更可能）
- 上限到達後は蓄積停止
- バックオフィスでアラート通知

### 退会時の扱い

- マイページ退会（顧客側操作）→ シャドウポイントは消さない（顧客情報は残る）
- 顧客論理削除（店舗側操作）→ シャドウポイントも無効化

### スタッフによる手動昇格

稀なケースで、登録せずに退店したけど再来店した顧客に、スタッフが手動でシャドウポイントを昇格させたい場合：

```
/dashboard > 顧客詳細 >
  [ 💎 シャドウポイントを手動で昇格 ] ボタン

→ 確認モーダル
→ 昇格実行（trigger='manual_by_staff', staff_id記録）
→ 後日マイページ登録時は通常通り（既に昇格済みなので再昇格されない）
```

### 監査ログ

- すべての昇格処理は `shadow_promotion_logs` に記録
- 月次でレビュー可能
- 怪しい挙動（同一IPから複数顧客の急激な昇格等）はフラグ立て

---

## 🏗 段階実装プラン

### Phase 1: DB 準備とロジック（3日）

- [ ] マイグレーション SQL（`sql/session65_shadow_points.sql` 作成）
- [ ] `customer_points` にカラム追加
- [ ] `point_settings` に設定追加
- [ ] `shadow_promotion_logs` テーブル新設
- [ ] `lib/point-grant.ts` ヘルパー作成
- [ ] `lib/shadow-promote.ts` ヘルパー作成
- [ ] ユニットテスト

### Phase 2: ポイント付与ロジック統合（2日）

- [ ] 既存のポイント付与箇所を `grantPointsOnVisit` 経由に変更
- [ ] `app/timechart/page.tsx` の精算時ポイント付与
- [ ] `app/dashboard/page.tsx` の手動付与
- [ ] 上限チェックロジック

### Phase 3: 登録時の昇格（1日）

- [ ] `app/customer-mypage/page.tsx` の `handleRegister` に昇格処理追加
- [ ] 登録完了画面のシャドウ表示
- [ ] お祝い通知の送信

### Phase 4: バックオフィスUI（3日）

- [ ] `/dashboard` 顧客詳細モーダルのシャドウ表示
- [ ] `/timechart` 精算モーダルの控えめバッジ
- [ ] `/shadow-dashboard` 新規ページ作成
- [ ] 登録案内カード印刷機能
- [ ] SMS 登録リンク送信機能

### Phase 5: 接客支援機能（2日）

- [ ] スタッフ向けスクリプト一覧ページ
- [ ] 顧客ごとの推奨メッセージ自動生成
- [ ] 登録誘導の結果トラッキング

---

## ⚠️ 注意事項・リスク

### 法的リスク

- **景品表示法**: 通常のポイント制度（値引き相当）の範囲内なので問題なし
- **個人情報保護**: 電話番号ベースの識別なので、既存運用の範囲内
- **消費者庁**: ステマ規制の対象外（口コミと無関係）

### 運用上の注意

1. **顧客には事前に話さない**
   - シャドウ蓄積中は「裏で貯まってる」ことは公開しない
   - 登録時のサプライズとして取っておく
   - ただし、問い合わせがあれば誠実に説明する姿勢で

2. **スタッフ教育**
   - 全スタッフに接客スクリプトを共有
   - 「シャドウポイント」という用語は社内だけで使う
   - お客様には「登録時特典ポイント」「Ange Spa 特別ポイント」等の表現

3. **原資管理**
   - 月次でシャドウ蓄積総額を確認
   - 想定外の膨張があれば `shadow_rate` の調整を検討
   - 年間予算と照らし合わせた運用

### 既存ポイント制度との整合性

既存の `point_settings`:
- `earn_per_yen`: 円あたりのポイント付与レート（例: 0.01 = 1%還元）
- `earn_points`: 固定ポイント
- `rainy_day_multiplier`: 雨の日倍率
- `expiry_months`: 有効期限

すべて **シャドウ蓄積時にも適用される**（ただし最終額は `shadow_rate` で半額化）。

例: 10,000円施術・雨の日（2倍）の場合
- 通常レート: 10,000 × 0.01 × 2 = 200pt
- シャドウ蓄積: 200 × 0.5 = **100pt** 蓄積
- 登録時の昇格後: 100 / 0.5 = **200pt** に解放

---

## 📊 KPI・効果測定

### 追跡する指標

| 指標 | 定義 | 目標値 |
|---|---|---|
| シャドウ蓄積顧客数 | 現在 is_shadow=true のポイントを持つ顧客数 | - |
| シャドウ蓄積総額 | 全シャドウポイントの合計 | - |
| 登録時想定支出額 | 蓄積総額 × 2 | 月次で監視 |
| マイページ登録率（新規） | 月新規客のうち登録した割合 | 制度前と比較 |
| 登録率（リピ後） | リピート客のうち登録した割合 | 制度前と比較 |
| シャドウ昇格件数 | 月次の昇格処理実行件数 | 月10件以上を目標 |
| 昇格顧客のLTV | 昇格後1年のLTV vs 非昇格顧客 | 定期分析 |

### A/B テスト案

- スクリプトの「2倍化」の強調度を変えて登録率測定
- 印刷物のデザインバリエーション
- シャドウ開示タイミング（初回 vs 3回目以降）の効果比較

---

## 📝 関連ドキュメント

- `02_FEATURES.md` — ポイント制度全体
- `04_DATABASE.md` — customer_points / point_settings テーブル定義
- `14_REVIEW_SYSTEM.md` — アンケート報酬（クーポン）との関係性

---

## 🔄 更新履歴

- **2026-04-25**: 初版作成
  - シャドウポイント制度の全体設計
  - 未登録時50% / 登録時2倍化のレート設計
  - バックオフィスUI・スタッフスクリプト・段階実装プラン
  - シャドウ蓄積上限 5,000pt を設定
