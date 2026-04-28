# 25. 研修コンテンツ ビジュアル化ガイド

> **更新**: 2026-04-28
> **関連**: `docs/24_THERAPIST_TRAINING.md` / `sql/session91_therapist_training.sql` / `sql/session92_training_visual_embeds.sql`

---

## 1. 全体方針 ─ 3層のビジュアル戦略

研修モジュールの画像・動画を **3つのレイヤー** で構成する。

| 層 | 種類 | 担当 | 状態 |
|---|---|---|---|
| **L1** | SVG図解（構造的・教育的） | Claude生成 | ✅ Phase A 完了 |
| **L2** | AI生成画像（雰囲気・装飾） | Gemini Imagen | 🔵 本ドキュメントで生成 |
| **L3** | 実演動画（手技・フロー） | iPhone自撮り → YouTube限定公開 | ⚪ Phase C 未着手 |

「正確性が必要なもの = SVG」「世界観・装飾 = AI画像」「動きで伝えるもの = 動画」と棲み分け。

---

## 2. SVG図解 一覧（Phase A 完了済）

10モジュール全てに、教育的に正確な SVG 図解が `public/training-svg/` 配下に格納済み。`session92_training_visual_embeds.sql` で各モジュール本文の冒頭に Markdown 画像参照として埋め込み済み。

| # | モジュール slug | SVGファイル名 | 内容 |
|---|---|---|---|
| 1 | hygiene-basics | hygiene-basics.svg | 手指衛生 6ステップ図 |
| 2 | anatomy-muscles | anatomy-muscles.svg | 主要筋肉群（背側/腹側） |
| 3 | anatomy-skeleton | anatomy-skeleton.svg | 骨格と主要関節 |
| 4 | anatomy-application | anatomy-application.svg | 施術部位ごとの注意点（推奨/注意/禁忌） |
| 5 | lymph-basics | lymph-basics.svg | リンパシステム全身概観 |
| 6 | lymph-nodes | lymph-nodes.svg | 主要リンパ節と流れの方向 |
| 7 | oil-types | oil-types.svg | 主要オイルの種類と効能 |
| 8 | oil-selection | oil-selection.svg | 肌タイプ別 選び方フローチャート |
| 9 | counseling-pre | counseling-pre.svg | 施術前カウンセリング 5ステップ |
| 10 | counseling-listening | counseling-listening.svg | 傾聴技法のスキル階層ピラミッド |

---

## 3. Gemini Imagen 用プロンプト集（Phase B）

### 3.1 共通スタイル（全プロンプトの末尾に必ず付ける）

**英語版（推奨）**:
```
Style: soft pastel watercolor illustration, elegant minimalist Japanese spa
aesthetic, muted dusty pink (#e8849a) and beige palette, subtle marble texture
undertones, serene and professional atmosphere, no text overlays, no logos,
no watermarks, clean balanced composition, natural soft lighting, photorealistic
but with gentle painterly softness.
```

**日本語版**:
```
柔らかな水彩イラスト風、和モダンの上品なサロンの世界観、
くすみピンクとベージュ基調、マーブル質感、文字・ロゴ・透かしなし、
自然光、清潔で洗練された雰囲気、写実とイラストの中間
```

### 3.2 ネガティブプロンプト（必要に応じて）

```
no text, no letters, no watermarks, no logos, no signatures, no people's faces
in detail, no anatomical labels, no medical illustration style, no harsh shadows,
not photorealistic skin pores
```

### 3.3 モジュール別プロンプト

各モジュールには **ヘッダー画像（必須）** + **詳細画像（オプション）** の構成を推奨。SVGの上に Imagen 画像が来る形にすると、雰囲気→学習の流れが綺麗。

---

#### 🧴 1. 衛生管理の基本（hygiene-basics）

**[H] ヘッダー画像 ─ 清潔な施術ベッド**:
```
A serene Japanese spa room with a freshly prepared massage bed, pristine white
fluffy linens neatly folded, soft natural light streaming through translucent
curtains, single small dried flower in a vase on a side table, no people,
hygienic and inviting, dusty pink accent.
[共通スタイル]
```

**[D1] 消毒用品のフラットレイ**:
```
Top-down flat lay of professional spa cleaning supplies: amber spray bottle,
white folded towels, a small bowl of cotton pads, latex-free gloves, bottle
of antibacterial gel, on a cream marble surface, soft natural light, dusty
pink ribbon accent, no text labels.
[共通スタイル]
```

> 💡 手洗い手順そのものは Claude SVG (hygiene-basics.svg) で十分なので、Gemini はあえて雰囲気カットだけに使う。

---

#### 🦴 2. 主要な筋肉群の理解（anatomy-muscles）

**[H] ヘッダー画像 ─ 抽象的な人体シルエット**:
```
Abstract artistic representation of a graceful human silhouette in soft
watercolor flowing washes, dusty pink and warm beige tones gently bleeding,
suggesting muscle structure without medical detail, vertical composition,
elegant and decorative.
[共通スタイル]
```

> 💡 解剖図そのものは Claude SVG (anatomy-muscles.svg) で正確に作成済。Gemini は雰囲気のみ。

---

#### 🦴 3. 骨格と関節の理解（anatomy-skeleton）

**[H] 抽象骨格イメージ**:
```
Abstract artistic watercolor painting of a graceful human form with hints
of skeletal structure visible through translucent washes, dusty pink and
warm cream tones, ethereal and elegant, vertical composition, no anatomical
labels.
[共通スタイル]
```

---

#### 🦴 4. 施術と解剖学の関係（anatomy-application）

**[H] 施術風景のシルエット**:
```
Soft silhouette of a therapist's hands gently working on a client's back,
viewed from a respectful angle, only hands visible (no face), white draped
linen, cream marble background, dusty pink accent, watercolor illustration,
sense of focused care and expertise.
[共通スタイル]
```

---

#### 💧 5. リンパシステムの基礎（lymph-basics）

**[H] 流れ・水のイメージ**:
```
Abstract watercolor painting suggesting gentle flowing streams and pools,
dusty pink and soft turquoise blue washes flowing across a cream background,
evoking the concept of body fluids in motion, decorative and serene, no
human figures.
[共通スタイル]
```

---

#### 💧 6. 主要リンパ節と流れ（lymph-nodes）

**[H] 流れ系のヘッダー**:
```
Soft watercolor abstract of converging streams flowing toward a central point,
delicate dusty pink and pale blue tones, suggesting the lymphatic flow toward
the central terminus, elegant and minimal, vertical composition.
[共通スタイル]
```

---

#### 🌿 7. 主要オイルの種類と特性（oil-types）

**[H] オイルボトル フラットレイ ★最重要★**:
```
Top-down flat lay photograph of 8 essential oil bottles arranged in two neat
rows on a cream marble surface: amber glass bottles of jojoba oil, sweet almond
oil, grape seed oil, coconut oil (slightly cloudy), and dark amber bottles of
lavender oil with fresh lavender sprigs, sweet orange oil with dried orange
slice, peppermint oil with fresh mint leaves, rosemary oil with rosemary sprig.
Each bottle paired with its source plant or ingredient. Soft natural lighting
from upper left, dusty pink silk ribbon coiled at the bottom edge, no text or
labels visible on bottles, photorealistic with watercolor softness.
[共通スタイル]
```

**[D] 個別オイル単体（テンプレート）**:
```
A delicate amber glass bottle of [OIL_NAME] essential oil standing upright,
fresh [PLANT_NAME] arranged gracefully beside it, natural cream marble surface,
soft warm window light from the left, vertical composition, dusty pink subtle
accent in background, photorealistic with painterly softness, no labels on
bottle.
[共通スタイル]
```

差し替え用ペア:
- `[OIL_NAME]=lavender` / `[PLANT_NAME]=lavender sprigs`
- `[OIL_NAME]=jojoba` / `[PLANT_NAME]=jojoba leaves`
- `[OIL_NAME]=sweet almond` / `[PLANT_NAME]=raw almonds in shells`
- `[OIL_NAME]=grape seed` / `[PLANT_NAME]=fresh grapes on vine`
- `[OIL_NAME]=coconut` / `[PLANT_NAME]=fresh coconut halves`
- `[OIL_NAME]=sweet orange` / `[PLANT_NAME]=fresh orange slice and peel`
- `[OIL_NAME]=peppermint` / `[PLANT_NAME]=fresh peppermint leaves`
- `[OIL_NAME]=rosemary` / `[PLANT_NAME]=fresh rosemary sprigs`

---

#### 🌿 8. オイルの選び方と注意点（oil-selection）

**[H] 選定の手元シーン**:
```
Soft photograph of a therapist's hands gently considering two amber oil bottles
on a cream marble surface, only hands visible, beside a dried lavender sprig
and a small consultation note (text not legible), dusty pink ambient lighting,
contemplative and caring atmosphere, watercolor softness.
[共通スタイル]
```

---

#### 🩺 9. 効果的な施術前カウンセリング（counseling-pre）

**[H] カウンセリングシーン**:
```
A soft pastel scene of two women sitting across from each other at a small
elegant table in a tranquil spa lounge, both stylized with subtle features
(faces gently abstracted, not photorealistic), one listening attentively while
the other speaks gently, warm trusting atmosphere, dusty pink and beige interior
with marble accents, vase with single dried flower between them, watercolor
illustration aesthetic, professional warmth.
[共通スタイル]
```

**[D] カウンセリングシート**:
```
Top-down view of an elegant wooden clipboard holding a blank pastel pink
consultation form (no readable text), beside a small vase with a single dried
rose stem and a slim fountain pen, on cream marble surface, soft natural light
from upper left, gentle shadows, watercolor aesthetic.
[共通スタイル]
```

---

#### 🩺 10. お客様の声を引き出す傾聴技法（counseling-listening）

**[H] 傾聴の手のひらイメージ**:
```
Abstract artistic representation of two open hands gently held in a listening
gesture, palms facing upward, dusty pink and beige watercolor washes, suggesting
warmth and receptivity, no full figure visible, decorative and emotionally
evocative.
[共通スタイル]
```

---

## 4. アップロード & 埋め込み手順

### 4.1 Gemini で生成する手順

1. [Google Gemini](https://gemini.google.com/) または [Google AI Studio](https://aistudio.google.com/) にログイン
2. Imagen モデルで画像生成（Pro プランまたは Imagen API）
3. 上記プロンプトをコピペして実行
4. 生成された画像のうち、世界観に最も合うものを選定（通常4枚生成される）
5. ローカルに保存（推奨ファイル名: `{slug}-h.webp`、詳細は `{slug}-d1.webp`）

### 4.2 Supabase Storage にアップロード

1. [Supabase Dashboard](https://supabase.com/dashboard/project/cbewozzdyjqmhzkxsjqo) にログイン
2. **Storage** → 既存 `manual-images` バケット（または新規 `training-images` バケット）に配置
3. パス推奨: `training/{slug}-h.webp`
4. ファイルをアップロード
5. **Get URL** で公開URLを取得（パブリックバケットの場合）

```
https://cbewozzdyjqmhzkxsjqo.supabase.co/storage/v1/object/public/training-images/training/hygiene-basics-h.webp
```

### 4.3 モジュール本文に埋め込み

SQL Editor で以下のような UPDATE を実行：

```sql
-- 例: hygiene-basics のヘッダー画像を SVG の前に挿入
UPDATE training_modules
SET content = E'![清潔な施術ベッド](https://...supabase.co/.../hygiene-basics-h.webp)\n\n' || content
WHERE slug = 'hygiene-basics' AND content NOT LIKE '%hygiene-basics-h.webp%';
```

または、SVG と置き換えたい場合：

```sql
-- 例: SVG行を Imagen 画像に差し替え
UPDATE training_modules
SET content = REGEXP_REPLACE(content,
  E'!\\[.*?\\]\\(/training-svg/hygiene-basics\\.svg\\)',
  '![清潔な施術ベッド](https://.../hygiene-basics-h.webp)'
)
WHERE slug = 'hygiene-basics';
```

> 💡 **推奨パターン**: SVG はそのまま残して、Imagen 画像をその **前（ヘッダー）** に追加すると、雰囲気カット → 教育的図解 → 本文 の流れになって最も学習しやすい。

---

## 5. 動画化（Phase C）

### 5.1 撮影推奨モジュール

| 優先度 | モジュール | 内容 | 撮影ポイント |
|---|---|---|---|
| ★★★ | hygiene-basics | 手洗い6ステップ実演 | 手元のクローズアップ、30秒×6シーン |
| ★★★ | counseling-pre | カウンセリング会話例 | 2人で対面ロールプレイ |
| ★★ | anatomy-application | 施術部位の触り方 | 施術ベッド上での実演（モデル必要） |
| ★★ | lymph-nodes | リンパマッサージの基本動作 | 手の動かし方を上から撮影 |
| ★ | oil-selection | カウンセリングからオイル選定までの流れ | 全工程の通し |

### 5.2 撮影 → 公開 → 埋め込みフロー

1. **iPhone で縦撮影**（縦撮り推奨：モバイル視聴最適化）
2. **iMovie でカット編集**（不要部分削除、字幕追加）
3. **YouTube に「限定公開」でアップロード**
   - 限定公開 = URLを知っている人だけ見れる、検索結果に出ない
   - URL から `?v=XXXXXXXXXXX` の `XXXXXXXXXXX` 部分が VIDEO_ID
4. **モジュール本文に追加**:

```sql
UPDATE training_modules
SET content = content || E'\n\n## 📹 実演動画\n\n[youtube:XXXXXXXXXXX]\n'
WHERE slug = 'hygiene-basics';
```

既存マニュアル機能で `[youtube:VIDEO_ID]` 構文は実装済（`app/cast/page.tsx` line 2486 参照）。研修モジュールも同じレンダラーを使うので動画は自動で埋め込まれる。

### 5.3 撮影スケジュール提案

| 週 | 撮影モジュール | 所要時間 |
|---|---|---|
| Week 1 | 手洗い6ステップ + 消毒手順 | 1日（再撮影含む） |
| Week 2 | カウンセリング会話例 | 半日 |
| Week 3 | 施術部位の触り方（基礎4部位） | 1日 |
| Week 4 | オイル選定〜施術導入 | 半日 |
| Week 5 | リンパマッサージ基本動作 | 1日 |

合計4〜5日の撮影で全主要モジュールをカバー可能。

---

## 6. ロードマップまとめ

```
   Phase A (✅ 完了)              Phase B (🔵 次)             Phase C (⚪ 後日)
  ┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
  │ Claude SVG 図解  │  +      │ Gemini AI 画像   │  +      │ iPhone 実演動画 │
  │ (10枚 構造的)    │         │ (10〜20枚 雰囲気) │         │ (4〜5本 手技)    │
  │ /training-svg/   │         │ Supabase Storage │         │ YouTube 限定公開│
  └─────────────────┘         └─────────────────┘         └─────────────────┘
        ↓                              ↓                              ↓
  各モジュール先頭に              SVGの前(ヘッダー)に              本文末尾に
  Markdown 画像として             追加埋め込み                    [youtube:ID]
  自動レンダリング
```

---

## 7. 補足

- **画像最適化**: アップロード前に WebP 変換（`cwebp -q 85 input.png -o output.webp`）で容量を 1/3 程度に
- **代替テキスト**: アクセシビリティのため、すべての画像に `![alt text](...)` で日本語の説明を必ず付ける
- **著作権**: AI生成画像は商用利用可だが、Gemini の利用規約を都度確認すること
- **SVG編集**: SVGはテキストファイルなので、ブランドカラーが変更になっても全置換で一括更新可能
