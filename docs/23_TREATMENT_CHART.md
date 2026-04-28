# ④お客様カルテシステム — 設計書

**作成日**: 2026-04-28
**目的**: 「施術業」としての実態証跡を残すため、施術前カウンセリング・施術内容・反応・次回提案を体系的に記録するシステムを設計
**前提**: `21_TREATMENT_BUSINESS_POSITIONING.md` に従う
**関連**: `22_CONTRACT_REDESIGN.md` 第11条（カルテ記録義務）

---

## 1. 設計方針

### 1.1 既存データとの棲み分け

現行のお客様情報関連テーブル：
| テーブル | 用途 | 参照者 |
|---|---|---|
| `customers` | 顧客マスター | 全員 |
| `therapist_customer_notes` | セラピスト個別の顧客メモ（NG含む） | 担当セラピスト |
| `customer_therapist_memos` | お客様→セラピストへの評価・メモ | 顧客 |
| `reservations` | 予約・履歴 | 全員 |

これらに対して**新規追加**：
| テーブル | 用途 | 参照者 |
|---|---|---|
| `treatment_charts` | 施術カルテ（1施術=1レコード） | 担当セラピスト＋管理者 |
| `customer_health_profiles` | 顧客の健康プロファイル（永続） | 担当セラピスト＋管理者 |

### 1.2 施術業の実態証跡として
- 1施術につき1カルテ（reservation_id とリンク）
- セラピスト全員が記録義務（契約書 第11条）
- 税務調査時に「施術業として実態あり」を証明する資料となる
- 個人情報保護法に準拠した運用

### 1.3 段階的実装方針
- **Phase 1（6/1まで）**: 基本入力UI＋DB＋セラピストマイページ統合
- **Phase 2（6月中）**: お客様健康プロファイル（永続情報）連携
- **Phase 3（7月以降）**: AI分析（施術提案・健康トレンド）

---

## 2. データモデル

### 2.1 treatment_charts（施術カルテ）

```sql
CREATE TABLE treatment_charts (
  id BIGSERIAL PRIMARY KEY,

  -- 紐付け
  reservation_id BIGINT REFERENCES reservations(id) ON DELETE CASCADE,
  customer_id BIGINT REFERENCES customers(id),
  therapist_id BIGINT REFERENCES therapists(id),
  store_id BIGINT REFERENCES stores(id),

  -- 施術前カウンセリング
  pre_condition TEXT,           -- 当日の体調・コンディション
  pre_concern TEXT,             -- 気になる箇所・お悩み
  pre_request TEXT,             -- 当日のご希望（圧の強さ、重点ケア部位等）

  -- 施術内容
  course_id BIGINT,             -- 提供したコース
  options_used JSONB,           -- 使用オプション（複数）
  body_parts TEXT[],            -- 施術部位 ['肩', '腰', '足裏']
  oils_used TEXT[],             -- 使用オイル ['ラベンダー', 'ホホバ']
  techniques_used TEXT[],       -- 使用技法 ['リンパドレナージュ', '深部圧迫']
  pressure_level VARCHAR(20),   -- 圧の強さ ('soft'|'medium'|'firm'|'extra_firm')

  -- 施術中の所見
  treatment_notes TEXT,         -- 施術中の気付き（凝り、緊張、好み等）
  customer_reaction TEXT,       -- お客様の反応・喜ばれた点

  -- 次回提案
  next_recommendation TEXT,     -- 次回提案の内容
  recommended_interval VARCHAR(50),  -- 推奨来店間隔（'1週間以内'|'2週間以内'|'1ヶ月以内'）
  recommended_course_id BIGINT,      -- 次回推奨コース

  -- メタ
  is_finalized BOOLEAN DEFAULT FALSE,  -- 確定済（編集不可）
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by_therapist_id BIGINT,    -- 記入者（複数セラピスト対応の場合）

  -- 監査
  store_id_for_audit BIGINT,
  notes_for_audit TEXT
);

CREATE INDEX idx_treatment_charts_customer ON treatment_charts(customer_id);
CREATE INDEX idx_treatment_charts_reservation ON treatment_charts(reservation_id);
CREATE INDEX idx_treatment_charts_therapist ON treatment_charts(therapist_id);
CREATE INDEX idx_treatment_charts_created_at ON treatment_charts(created_at DESC);
```

### 2.2 customer_health_profiles（健康プロファイル・永続）

```sql
CREATE TABLE customer_health_profiles (
  id BIGSERIAL PRIMARY KEY,
  customer_id BIGINT UNIQUE REFERENCES customers(id) ON DELETE CASCADE,

  -- 体質・アレルギー（永続情報）
  allergies TEXT,                -- アレルギー（オイル種別、食品等）
  skin_sensitivity VARCHAR(20),  -- 肌の敏感度 ('normal'|'sensitive'|'very_sensitive')
  health_conditions TEXT,        -- 既往症・健康状態
  current_medications TEXT,      -- 服用中の薬

  -- 体型・特性
  posture_notes TEXT,            -- 姿勢の特徴
  chronic_issues TEXT[],         -- 慢性的な不調 ['腰痛', '肩こり']

  -- 好み（過去施術から蓄積）
  preferred_pressure VARCHAR(20),
  preferred_oils TEXT[],
  avoided_techniques TEXT[],

  -- 注意事項
  caution_notes TEXT,            -- セラピストへの注意事項

  -- メタ
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_reviewed_at TIMESTAMPTZ   -- 最終レビュー日
);
```

### 2.3 RLS（Row Level Security）方針
- セラピストは**自分が施術を担当した顧客のカルテのみ**閲覧可能
- 管理者（admin role）は全カルテ閲覧可能
- 顧客本人は自分のプロファイルを閲覧可能（マイページ）
- それ以外は完全遮断

---

## 3. UI/UX 設計

### 3.1 セラピストマイページからの導線

#### A. 施術中・施術後の入力フロー
```
セラピストマイページ HOME
  ↓
本日の予約一覧
  ↓
予約カードに「カルテ未記入」バッジ表示
  ↓ タップ
カルテ入力画面（モーダル or フルスクリーン）
  ┌─────────────────────────┐
  │ 顧客名 / 予約時間 / コース            │
  ├─────────────────────────┤
  │ 1. 施術前カウンセリング             │
  │   - 体調・コンディション             │
  │   - 気になる箇所                  │
  │   - ご希望                       │
  ├─────────────────────────┤
  │ 2. 施術内容                       │
  │   - 部位（チェックボックス）          │
  │   - 使用オイル（候補から選択）        │
  │   - 圧の強さ（slider/select）        │
  ├─────────────────────────┤
  │ 3. 施術中の所見                    │
  │   - 気付き・お客様の反応            │
  ├─────────────────────────┤
  │ 4. 次回提案                       │
  │   - 推奨内容                      │
  │   - 推奨来店間隔                   │
  ├─────────────────────────┤
  │ [一時保存]  [確定保存]              │
  └─────────────────────────┘
```

#### B. お客様カルテ履歴閲覧
```
セラピストマイページ
  → 「お客様」タブ
    → 顧客一覧
      → 顧客詳細
        → 「カルテ履歴」タブ（新設）
          → 過去の施術カルテ時系列表示
          → 健康プロファイル参照
```

### 3.2 入力簡素化の工夫
- **テンプレート選択**：よく使う施術内容をテンプレ化（「肩こり集中」「むくみケア」等）
- **チェックボックス＋自由入力**：体調・部位は候補チェックで素早く、特殊事項は自由記入
- **過去カルテ参照**：前回カルテをワンタップで参照できる「前回参照」ボタン
- **音声入力対応**：ブラウザの音声認識API活用（Phase 2）

### 3.3 入力義務化の運用
- 予約終了後24時間以内のカルテ未記入はマイページTOPに警告バッジ
- 月次レポートに「カルテ記入率」を表示
- 管理者ダッシュボードで未記入アラート集計

---

## 4. お客様マイページ連携（Phase 2）

### 4.1 顧客が見られる情報
- 健康プロファイル（自身が更新可能）
- 施術記録の概要（施術日、コース、担当セラピスト、簡単な記録）
  - **詳細な施術内容は表示しない**（セラピストの所見はプライベート）

### 4.2 顧客が更新できる情報
- アレルギー情報
- 既往症・服用薬
- 慢性的な不調

### 4.3 利点
- 顧客の継続的なケアに有用
- 施術業としての専門性を顧客にも実感してもらえる
- 個人情報保護法上、本人の閲覧権を担保

---

## 5. 法務・税務観点

### 5.1 個人情報保護法
- 健康情報は「要配慮個人情報」 → 取得時の同意明示が必要
- 顧客マイページ初回ログイン時に「健康プロファイル収集の同意」を求める
- カルテデータの保管期間：5年（消費者契約法等の参考期間）

### 5.2 税務調査対応
- カルテは「施術業として業務を遂行している実態証跡」として最重要
- 月次・年次で「総施術件数」「カルテ記入率」を集計可能にする
- 数年分のカルテをエクスポート可能にする（CSV/PDF）

### 5.3 削除請求への対応
- 顧客から削除請求があった場合、健康プロファイルは削除可能
- カルテ本体は税務記録として匿名化処理（顧客特定情報のみ削除、施術記録は保持）

---

## 6. 実装フェーズ

### Phase 1（6/1までに必達）
- [ ] DB: `treatment_charts` テーブル作成（SQL）
- [ ] DB: `customer_health_profiles` テーブル作成（SQL）
- [ ] DB: RLS 設定
- [ ] UI: セラピストマイページにカルテ入力画面（モーダル）
- [ ] UI: 予約カードに「カルテ記入」ボタン追加
- [ ] UI: 顧客詳細画面にカルテ履歴タブ追加
- [ ] 既存セラピスト全員への入力フロー周知

### Phase 2（6月中）
- [ ] テンプレート選択機能
- [ ] 前回カルテ参照ボタン
- [ ] お客様マイページに健康プロファイル更新画面
- [ ] お客様マイページにカルテ概要表示
- [ ] 個人情報保護法対応の同意フロー

### Phase 3（7月以降）
- [ ] 月次「施術実績レポート」自動生成
- [ ] AI分析：過去カルテから次回提案候補を自動生成
- [ ] 音声入力対応
- [ ] 健康トレンド分析（顧客への可視化）

---

## 7. 実装ロードマップ

| 時期 | アクション |
|---|---|
| 5/1〜5/3 | DB設計確定・SQL作成 |
| 5/4〜5/7 | DB作成（Supabase）+ RLS設定 |
| 5/8〜5/15 | カルテ入力UI実装（セラピストマイページ） |
| 5/16〜5/22 | カルテ履歴閲覧UI実装＋既存予約UIとの連携 |
| 5/23〜5/27 | 内部テスト・バグ修正 |
| 5/28〜5/31 | 既存セラピストへの周知・トレーニング |
| **6/1** | **本番ローンチ** |

---

## 8. リスクと対応

| リスク | 対応 |
|---|---|
| セラピストが入力を怠る | 契約書第11条＋未記入アラート＋月次記入率 |
| 入力時間が長くて施術回転に影響 | テンプレート＋チェックボックス＋音声入力（Phase 2） |
| 個人情報管理の過失 | RLS厳格化＋アクセスログ＋管理者監査 |
| 顧客が健康情報提供を拒否 | プロファイル入力は任意、カルテは必須（業務記録のため） |
| データ容量増加 | Supabase Pro移行で対応（既存ロードマップ） |

---

## 9. 既存実装との関係

### 9.1 既存の `therapist_customer_notes` の扱い
- 現行は「セラピスト個人の顧客メモ・NG・評価」
- 新カルテと**別物**として残す（NG情報・個人評価は引き続き個別メモへ）
- 新カルテは「業務記録」、既存ノートは「セラピスト個人の所感」

### 9.2 既存の `customer_therapist_memos` の扱い
- 顧客→セラピストへの評価
- 新カルテとは別物として残す

### 9.3 影響範囲
- `app/cast/page.tsx` — 新カルテ入力UI追加
- `app/cast/customer/page.tsx` — カルテ履歴タブ追加
- `app/timechart/page.tsx` — 予約カードに「カルテ未記入」バッジ
- `app/mypage/page.tsx` — Phase 2で健康プロファイル画面

---

## 10. 監査・税務対応

### 10.1 月次レポート（管理者向け）
- 総予約件数
- 総カルテ記入件数
- カルテ記入率（%）
- セラピスト別カルテ記入率

### 10.2 年次レポート（税務調査用）
- 年間施術件数
- セラピスト別年間施術件数
- 平均施術時間（カルテから算出可能）
- これらすべてを「施術業として継続的に業務を行っている証跡」として提出可能

---

## 11. 関連設計書

- `21_TREATMENT_BUSINESS_POSITIONING.md` — 全体方針
- `22_CONTRACT_REDESIGN.md` — 業務委託契約書（第11条 カルテ記録義務）
- `24_THERAPIST_TRAINING.md` — セラピスト研修・技術ライブラリ
