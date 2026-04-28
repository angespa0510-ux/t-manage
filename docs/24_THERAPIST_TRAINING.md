# ②セラピスト研修・技術ライブラリ — 設計書

**作成日**: 2026-04-28
**目的**: 「施術業」として研修制度・技術習得記録を整備し、セラピストマイページを大変革
**前提**: `21_TREATMENT_BUSINESS_POSITIONING.md` に従う
**関連**: `22_CONTRACT_REDESIGN.md` 第10条（研修受講義務）

---

## 1. 設計方針

### 1.1 既存マニュアルとの関係

現状：
- `manual_categories` / `manual_articles` テーブル
- `/cast/page.tsx` の「ラーン」タブで閲覧
- 業務マニュアル（出勤手順・PCの使い方等）が中心

これに対し、**研修・技術ライブラリ**は以下の特徴を持つ：
- 体系的なカリキュラム（解剖学・リンパ・オイル等）
- 受講記録の管理（誰が何をいつ学んだか）
- 進捗管理（初級→中級→上級）
- 修了テスト（任意）

→ 既存テーブルを拡張する形で実装

### 1.2 セラピストマイページの大変革

現状のメインタブ5つ：
```
🏠 ホーム / 💼 ワーク / 💬 チャット / 💰 マネー / 📖 ラーン
```

**「ラーン」タブを大幅強化**し、以下のサブセクションに分割：
- 📋 業務マニュアル（既存）
- 🌿 **施術技術ライブラリ**（新設）
- 🏆 **研修受講記録**（新設）
- 📜 **施術手順マニュアル**（新設）

### 1.3 「施術業」としての実態証跡
- 全セラピストが定期的に研修を受講している記録
- 研修カリキュラムの体系性（解剖学から始まる学術的アプローチ）
- 技術習得バッジ・修了証で「専門技術者」性を補強
- 税務調査時に「施術業として技術習得・教育を継続している」証拠

---

## 2. データモデル

### 2.1 training_categories（研修カテゴリ）

```sql
CREATE TABLE training_categories (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) UNIQUE,            -- 'anatomy', 'lymph', 'oil', etc
  description TEXT,
  level VARCHAR(20),                   -- 'basic'|'intermediate'|'advanced'
  prerequisites BIGINT[],              -- 前提となる他カテゴリのID
  emoji VARCHAR(10),                   -- '🦴'|'💧'|'🌿' 等
  sort_order INT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**初期データ例：**
```
1. 🦴 解剖学の基礎 (basic)
2. 💧 リンパ系の理解 (basic)
3. 🌿 オイル種別と効能 (basic)
4. 🤲 ボディケア基本技法 (intermediate, prereq: 1)
5. 💆 リンパドレナージュ (intermediate, prereq: 2)
6. 🧖 アロマトリートメント (intermediate, prereq: 3)
7. 🎯 部位別ケア応用 (advanced, prereq: 4)
8. 🩺 カウンセリング技法 (basic)
9. 🧴 衛生管理・感染対策 (basic, 必須)
```

### 2.2 training_modules（研修モジュール）

```sql
CREATE TABLE training_modules (
  id BIGSERIAL PRIMARY KEY,
  category_id BIGINT REFERENCES training_categories(id),
  title VARCHAR(200) NOT NULL,
  slug VARCHAR(200),
  content TEXT,                        -- Markdown対応
  video_url TEXT,                      -- 動画URL（Phase 2）
  duration_minutes INT,                -- 所要時間
  has_quiz BOOLEAN DEFAULT FALSE,      -- 修了テストの有無
  sort_order INT,
  is_required BOOLEAN DEFAULT FALSE,   -- 必須受講かどうか
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 2.3 therapist_training_records（受講記録）

```sql
CREATE TABLE therapist_training_records (
  id BIGSERIAL PRIMARY KEY,
  therapist_id BIGINT REFERENCES therapists(id) ON DELETE CASCADE,
  module_id BIGINT REFERENCES training_modules(id),

  -- 進捗
  status VARCHAR(20) DEFAULT 'not_started',  -- 'not_started'|'in_progress'|'completed'
  progress_percent INT DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  -- テスト結果（任意）
  quiz_score INT,
  quiz_attempts INT DEFAULT 0,

  -- メタ
  last_accessed_at TIMESTAMPTZ,

  UNIQUE(therapist_id, module_id)
);

CREATE INDEX idx_training_records_therapist ON therapist_training_records(therapist_id);
CREATE INDEX idx_training_records_status ON therapist_training_records(status);
```

### 2.4 therapist_skill_badges（技術習得バッジ）

```sql
CREATE TABLE therapist_skill_badges (
  id BIGSERIAL PRIMARY KEY,
  therapist_id BIGINT REFERENCES therapists(id) ON DELETE CASCADE,
  category_id BIGINT REFERENCES training_categories(id),

  -- 習得状況
  level VARCHAR(20),                   -- 'basic'|'intermediate'|'advanced'|'master'
  acquired_at TIMESTAMPTZ DEFAULT NOW(),
  acquired_method VARCHAR(50),         -- 'completed_modules'|'manual_grant'|'external_cert'

  -- 外部資格の場合
  external_certificate_name TEXT,
  external_certificate_url TEXT,

  -- 評価
  evaluator_id BIGINT,                 -- 評価者（管理者）
  notes TEXT,

  UNIQUE(therapist_id, category_id, level)
);
```

### 2.5 RLS方針
- セラピスト：自分の受講記録・バッジのみ閲覧/更新
- 管理者：全セラピストの記録閲覧・バッジ付与可能
- 研修教材（modules/categories）：全セラピストが閲覧可能

---

## 3. UI/UX 設計

### 3.1 セラピストマイページ「ラーン」タブの新構成

```
📖 ラーン
├─ 📋 業務マニュアル（既存）
├─ 🌿 施術技術ライブラリ（新設）
│   ├─ 基礎カテゴリ（解剖学/リンパ/オイル/カウンセリング/衛生）
│   ├─ 中級カテゴリ（ボディケア/リンパドレナージュ/アロマ）
│   └─ 上級カテゴリ（部位別応用）
├─ 🏆 研修受講記録（新設）
│   ├─ 受講中モジュール
│   ├─ 完了モジュール
│   └─ 取得バッジ一覧
└─ 📜 施術手順マニュアル（新設）
    ├─ 標準施術フロー
    ├─ カウンセリング手順
    └─ 衛生管理ガイドライン
```

### 3.2 研修受講UI（モジュール詳細画面）

```
┌─────────────────────────────────┐
│ 🦴 解剖学の基礎 / モジュール1               │
│ 「筋肉と骨格の関係」                     │
├─────────────────────────────────┤
│ 所要時間: 30分                          │
│ 進捗: ▓▓▓▓░░░░░░ 40%                 │
├─────────────────────────────────┤
│ [本文 Markdown表示]                     │
│                                       │
│ - 主要な筋肉群                          │
│ - 骨格との関係                          │
│ - 施術における重要ポイント                │
├─────────────────────────────────┤
│ [前のセクション]  [次のセクション →]      │
└─────────────────────────────────┘

────── 完了時 ──────
┌─────────────────────────────────┐
│ 🎉 モジュール完了！                       │
│ あなたは「解剖学の基礎」を1つ習得しました。 │
│                                       │
│ [次のモジュールへ]  [カテゴリ一覧へ]      │
└─────────────────────────────────┘
```

### 3.3 バッジ一覧画面

```
┌─────────────────────────────────┐
│ 🏆 取得バッジ                            │
├─────────────────────────────────┤
│ 🦴 解剖学 — 基礎 ✓                       │
│   2026年5月15日 取得                    │
├─────────────────────────────────┤
│ 💧 リンパ系 — 基礎 ✓                     │
│   2026年5月18日 取得                    │
├─────────────────────────────────┤
│ 🌿 オイル種別 — 基礎 (進捗 60%)          │
└─────────────────────────────────┘
```

### 3.4 ホーム画面でのプロモーション
- 未受講の必須モジュールがある場合、ホームに通知バナー
- 「今月のおすすめ研修」をホームに表示
- 「今週学んだこと」のサマリー表示

---

## 4. プロフィール表示への反映

### 4.1 セラピスト紹介ページ（公開HP）
セラピスト一覧・詳細ページに**取得バッジを表示**：
```
🌸 セラピスト名: 〇〇
   得意施術: ボディケア・リンパドレナージュ
   取得スキル: 🦴 解剖学 / 💧 リンパ / 🌿 オイル
```

→ 顧客に「技術を習得したセラピスト」として安心感を提供
→ 施術業としての対外アピール強化

### 4.2 セラピスト個別ページの「研修歴」セクション
公開HPの `/therapist/[id]` ページに、取得バッジと研修歴を表示。

---

## 5. 必須研修プログラム

### 5.1 入店時必須カリキュラム（v1.0）
全セラピストが入店から**30日以内**に完了すべき必須モジュール：

1. **🧴 衛生管理・感染対策**（必須） — 30分
2. **🦴 解剖学の基礎**（必須） — 90分（3モジュール構成）
3. **💧 リンパ系の理解**（必須） — 60分
4. **🌿 オイル種別と効能**（必須） — 45分
5. **🩺 カウンセリング技法**（必須） — 60分

### 5.2 推奨研修（業務拡張に応じて）
- ボディケア基本技法
- リンパドレナージュ
- アロマトリートメント
- 部位別ケア応用

### 5.3 研修受講証明書（PDF）
完了モジュール一覧を**PDF形式で出力可能**に。
- 確定申告時の経費計上用（受講料・研修費の証明）
- 自身の経歴証明として

---

## 6. 既存実装との関係

### 6.1 既存マニュアル（manual_articles）との棲み分け
| 種別 | テーブル | 用途 |
|---|---|---|
| 業務マニュアル | `manual_articles` | 出勤手順・PCの使い方・店舗運営ルール |
| 研修教材 | `training_modules`（新設） | 解剖学・施術技術等の体系的カリキュラム |
| 施術手順マニュアル | `manual_articles` の特定カテゴリ | 標準施術フロー（カテゴリ「施術手順」） |

→ 既存テーブルは触らず、研修系は新テーブルで管理。施術手順マニュアルは既存マニュアル内のカテゴリとして整備。

### 6.2 影響範囲
- `app/cast/page.tsx` — ラーンタブの再構成
- 新規 `app/training/[module_id]/page.tsx` — 研修モジュール詳細画面
- 新規 `app/cast/badges/page.tsx` — バッジ一覧画面
- `app/(site)/therapist/[id]/page.tsx` — 公開セラピストページにバッジ表示
- 既存マニュアル管理UI（`/manual`）に「研修教材」管理機能追加 or 別画面新設

---

## 7. 実装フェーズ

### Phase 1（6/1までに必達）
- [ ] DB: `training_categories`, `training_modules`, `therapist_training_records`, `therapist_skill_badges` 作成
- [ ] DB: RLS設定
- [ ] 初期コンテンツ作成：必須5カリキュラム（衛生・解剖学・リンパ・オイル・カウンセリング）
- [ ] UI: セラピストマイページ「ラーン」タブ新構成
- [ ] UI: 研修モジュール閲覧画面
- [ ] UI: 取得バッジ表示
- [ ] 管理者UI: 研修教材管理画面
- [ ] 管理者UI: バッジ手動付与画面

### Phase 2（6月中）
- [ ] 修了テスト機能
- [ ] PDF修了証書出力
- [ ] 公開HPセラピストページにバッジ表示
- [ ] ホーム画面の研修通知バナー
- [ ] 中級・上級カリキュラム追加

### Phase 3（7月以降）
- [ ] 動画コンテンツ対応
- [ ] AI質問応答機能（モジュール内容について質問可能）
- [ ] 月次研修進捗レポート（管理者向け）
- [ ] 研修受講ランキング（モチベーション施策）

---

## 8. コンテンツ作成計画

研修モジュールのコンテンツは**外部専門家との協業**を推奨：

### 候補
- 整体師・あんまマッサージ指圧師（解剖学・基本技法の監修）
- アロマセラピスト（オイル知識）
- 看護師・医療従事者（衛生管理・カウンセリング）

### 暫定対応（6/1ローンチ時）
- 既存のWebリソース・書籍を参考に、社内で初版作成
- 6月以降に外部専門家でブラッシュアップ
- 外部資格保持者の取得バッジ機能で補強

---

## 9. 実装ロードマップ

| 時期 | アクション |
|---|---|
| 5/1〜5/3 | DB設計確定・SQL作成 |
| 5/4〜5/7 | DB作成 + 必須5カリキュラムの初版コンテンツ作成 |
| 5/8〜5/15 | UI実装：研修閲覧・バッジ表示 |
| 5/16〜5/22 | UI実装：管理者向け教材管理 |
| 5/23〜5/27 | 内部テスト・コンテンツ調整 |
| 5/28〜5/31 | セラピスト周知・初回研修開始 |
| **6/1** | **本番ローンチ** |

---

## 10. リスクと対応

| リスク | 対応 |
|---|---|
| コンテンツ作成が間に合わない | Phase 1は必須5カリキュラムに絞る、他は順次追加 |
| セラピストが研修を受けない | 契約書第10条＋ホーム画面警告＋月次受講率レポート |
| 外部専門家のレビュー未完了 | 社内版でローンチ→6月以降にバージョンアップ |
| バッジが軽く見られる | 公開HPのセラピスト紹介に表示し対外価値を可視化 |
| 古い知識・誤情報のリスク | 定期見直し（年次） |

---

## 11. 関連設計書

- `21_TREATMENT_BUSINESS_POSITIONING.md` — 全体方針
- `22_CONTRACT_REDESIGN.md` — 業務委託契約書（第10条 研修受講義務）
- `23_TREATMENT_CHART.md` — お客様カルテ（カウンセリング・施術内容を記録）
