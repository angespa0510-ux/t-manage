# Ange Spa 公式HP 画像・動画 生成プロンプト集

Google Gemini（Imagen 4 / VEO 3）で生成する、公式HP用の画像・動画プロンプトです。

## 🎨 デザイン原則（全プロンプト共通）

仕様 ■20 準拠:
- **世界観**: 静けさ・上品さ・女性的になりすぎない柔らかさ
- **トーン**: ピンク基調、または淡いベージュ基調
- **光**: 柔らかい自然光、抽象的/情緒的な構図
- **色数**: 4色以内（pink, white, beige, warm grey）
- **人物**: AI生成人物は**絶対NG**（人物写真はセラピスト本人撮影のみ）
- **NG要素**: 派手・下品・過度に女性的・文字・ロゴ・アイコン・低品質

全プロンプトに含める「共通ネガティブプロンプト」:
```
no humans, no faces, no people, no text, no letters, no logos,
no watermarks, no lowres, no oversaturated colors, no flashy,
no cheap lighting, no plastic look, no cartoon, no anime
```

---

## 📐 配置予定の画像一覧（Phase 1）

| ファイルパス | サイズ | 用途 | 優先度 |
|---|---|---|---|
| `/images/placeholder/top-hero.jpg` | 1920×1080 | HOMEメインビジュアル | ★★★ |
| `/images/placeholder/recruit.jpg` | 1200×800 | RECRUITセクション | ★★ |
| `/images/placeholder/concept.jpg` | 1600×1000 | CONCEPTセクション挿入 | ★★ |
| `/images/placeholder/system.jpg` | 1600×900 | /system ヘッダー | ★★ |
| `/images/placeholder/schedule.jpg` | 1600×900 | /schedule ヘッダー | ★★ |
| `/images/placeholder/access.jpg` | 1600×900 | /access ヘッダー | ★★ |
| `/images/placeholder/shop-mikawa-a.jpg` | 1200×800 | 三河安城A店イメージ | ★★ |
| `/images/placeholder/shop-mikawa-b.jpg` | 1200×800 | 三河安城B店イメージ | ★★ |
| `/images/placeholder/shop-toyohashi.jpg` | 1200×800 | 豊橋店イメージ | ★★ |
| `/images/placeholder/room-interior.jpg` | 1600×1000 | ルーム内装イメージ | ★ |
| `/images/placeholder/texture-1.jpg` | 1920×800 | セクション仕切り | ★ |
| `/images/placeholder/texture-2.jpg` | 1920×800 | セクション仕切り | ★ |
| `/images/placeholder/video-top-hero.mp4` | 1920×1080 | メインビジュアル動画 | ★★★ |
| `/images/placeholder/video-concept.mp4` | 1920×1080 | CONCEPT動画 | ★ |

---

## 🖼 画像プロンプト（Imagen 4 / Gemini）

### 1. メインビジュアル（HOME 最上部）

現行HPと置き換わる、ファーストインパクトの画像。3案から選択。

#### 案A（推奨）: 朝陽と花びら
```
A serene, dreamy abstract composition with soft pastel pink cherry blossom
petals scattered on a warm cream-white background. Soft morning sunlight
streams diagonally from upper left, creating gentle lens flare and bokeh.
Minimal, elegant, Japanese aesthetic. Shallow depth of field. Cinematic,
film grain, high-end editorial photography style. Colors: dusty pink
(#E8849A), warm ivory, soft beige. 16:9 aspect ratio, 1920x1080.

no humans, no faces, no text, no letters, no logos, no watermarks,
no oversaturated colors, no flashy, no cartoon
```

**日本語参考訳**:
> 温かいクリームホワイトの背景に淡いピンクの桜の花びらが舞い散る、静謐で夢のような抽象構図。朝の柔らかな光が左上から斜めに差し込み、レンズフレアとボケ味を生む。ミニマルで上品、日本的な美意識。浅い被写界深度。シネマティック、フィルムグレイン、ハイエンド編集写真風。色: ダスティピンク / ウォームアイボリー / ソフトベージュ。

#### 案B: シルクと光
```
An abstract close-up of flowing silk fabric in soft dusty pink, catching
gentle natural window light. Subtle folds and gradients, with warm ivory
highlights and soft shadow valleys. Minimal, luxurious, meditative.
Cinematic shallow depth of field, subtle film grain. Peaceful, high-end
spa aesthetic. 16:9 aspect ratio, 1920x1080.

no humans, no faces, no text, no logos, no oversaturated colors, no flashy
```

#### 案C: 水面の反射
```
Abstract overhead shot of still water surface in a warm, sun-drenched
setting. Subtle ripples catch soft pink and peach sunset tones. A single
floating petal drifts near the center. Ethereal, meditative, ultra-minimal.
Cinematic, soft focus, film grain. Japanese wabi-sabi aesthetic, luxurious
stillness. 16:9, 1920x1080.

no humans, no faces, no text, no logos, no harsh contrast, no cartoon
```

---

### 2. CONCEPT（私たちについて）

セクション挿入用、縦に余裕のある構図。

```
Soft diffused portrait of a single pink peony in full bloom, resting on
aged natural linen fabric. Warm afternoon window light from the right,
creating soft shadows and a cream-colored glow. Shallow depth of field,
deep bokeh. Minimal, quiet, Japanese-modern aesthetic. Shot like a
high-end lifestyle magazine. Colors: pastel pink petals, warm ivory,
soft beige linen. 16:10, 1600x1000.

no humans, no faces, no text, no logos, no cartoon, no oversaturation
```

---

### 3. RECRUIT（求人案内）

前向き・明るく・清潔感のあるイメージ。人物NG、象徴的な画で。

#### 案A: 開きかけた窓
```
Elegant white linen curtains gently billowing in front of a sunlit window,
morning light filtering through. Warm cream walls, hints of pale pink
reflections. A single small vase with a pink ranunculus on a minimal
wooden surface below. Tranquil, hopeful, fresh beginning. Japanese
minimalist interior, magazine editorial style. Shallow DOF.
3:2 ratio, 1200x800.

no humans, no faces, no text, no logos, no clutter, no flashy
```

#### 案B: 朝の光とお茶
```
Overhead shot of a delicate ceramic teacup with steaming warm tea on a
pale beige linen tablecloth. A single pink flower petal beside it.
Soft morning sunlight casts gentle shadows. Serene, welcoming, refined
Japanese hospitality aesthetic. Minimal, editorial, cinematic.
3:2 ratio, 1200x800.

no humans, no faces, no text, no logos
```

---

### 4. /system（料金・コース）ヘッダー

#### 案A: アロマオイルと花
```
Close-up still life: clear glass amber aromatherapy oil bottle with a
wooden dropper, surrounded by soft pink peonies and eucalyptus sprigs
on a warm beige linen. Soft natural light from the left. Tranquil,
luxurious, high-end wellness aesthetic. Editorial photography.
16:9 ratio, 1600x900.

no humans, no faces, no text, no logos, no cartoon
```

#### 案B: キャンドルと布
```
Softly lit close-up of a simple cream-colored scented candle burning
gently, with folded white linen towels and a sprig of pink baby's breath
beside it. Warm ambient spa lighting. Quiet, peaceful, refined.
Minimal Japanese-modern aesthetic. 16:9, 1600x900.

no humans, no text, no fire hazard, no flashy, no oversaturation
```

---

### 5. /schedule（スケジュール）ヘッダー

```
Abstract close-up of a minimal white wall calendar or linen fabric with
soft shadows cast by a single pink peony in the foreground (out of focus).
Cream and dusty pink tones. Morning light, gentle bokeh. Quiet, anticipatory
mood. Japanese-modern aesthetic. 16:9, 1600x900.

no humans, no faces, no text, no numbers, no logos, no clutter
```

---

### 6. /access（アクセス・店舗）ヘッダー

```
Elegant architectural detail of a minimal Japanese-modern building
entrance: warm wooden door, soft cream wall, a single potted plant with
pink flowers. Late afternoon golden hour lighting. Serene, welcoming,
understated luxury. High-end architectural photography, shallow DOF.
16:9, 1600x900.

no humans, no faces, no text, no logos, no signage, no flashy colors
```

---

### 7. 店舗別イメージ（3店舗分）

各店舗のイメージカット。実写がなくても「雰囲気」を伝える抽象ショット。

#### 三河安城A店
```
Interior detail shot: a tranquil private relaxation space with warm
cream walls, soft pink accent pillow on a beige linen-covered daybed,
a single vase of pink peonies on a minimal wooden side table. Diffused
natural light through sheer curtains. Private, luxurious, Japanese
minimalism meets modern spa. Editorial interior photography.
3:2, 1200x800.

no humans, no faces, no text, no logos
```

#### 三河安城B店
```
Close-up of a serene corner with a minimal round mirror, a small
ceramic bowl with pink flower petals floating in water, and soft
cream fabric. Natural window light, peaceful morning mood.
High-end Japanese spa aesthetic. 3:2, 1200x800.

no humans, no faces, no text, no logos
```

#### 豊橋店
```
Overhead shot of a meditation setup: folded beige linen blankets,
a white ceramic teacup, a single pink rose on an oak wooden surface.
Soft natural afternoon light. Minimalist, tranquil, refined.
3:2, 1200x800.

no humans, no faces, no text, no logos
```

---

### 8. ルーム内装イメージ（汎用）

```
Wide interior shot of a private minimal spa room: low wooden platform
with cream linen bedding, warm ambient lighting from floor lamps, a
single large pink peony in a tall ceramic vase. Beige walls, oak wood
floor, sheer white curtains. Luxurious, serene, Japanese contemporary
spa design. 16:10, 1600x1000.

no humans, no faces, no text, no logos, no signage
```

---

### 9. テクスチャ（セクション仕切り）

繊細な「息抜き」としてセクション間に挟む抽象テクスチャ。

#### テクスチャA: 布の質感
```
Extreme close-up macro shot of natural linen fabric weave in warm cream
color, with faint pink tonal shift across the surface. Soft shadow
highlights the texture. Abstract, tactile, minimal. Editorial still life.
21:9 panoramic, 1920x800.

no humans, no faces, no text, no logos, no pattern
```

#### テクスチャB: 光のグラデーション
```
Abstract soft gradient of dusty pink fading into warm ivory, with gentle
light bleed and subtle film grain. Minimalist, ethereal, calming.
Ultra-smooth, like the inside of a petal. 21:9 panoramic, 1920x800.

no humans, no text, no logos, no hard edges, no geometric shapes
```

---

## 🎬 動画プロンプト（VEO 3 / Gemini）

動画は5〜10秒、ループ可能・音なし前提。

### V1. メインビジュアル動画（HOME最上部、静止画の代替）

#### 案A: 花びらが舞う
```
A slow-motion cinematic shot of soft pink cherry blossom petals gently
drifting downward through warm diffused sunlight. Cream-colored background
with subtle light rays. Peaceful, dreamy, meditative atmosphere.
Shallow depth of field, delicate bokeh. No camera movement. Loopable.
16:9, 1920x1080, 8 seconds.

no humans, no faces, no text, no logos, no harsh contrast
```

#### 案B: カーテンが揺れる
```
A cinematic slow-motion shot of sheer white linen curtains gently
billowing in a soft morning breeze, backlit by warm golden sunlight.
Pale pink reflections dance on the fabric. Tranquil, elegant,
Japanese-modern aesthetic. No camera movement. Loopable.
16:9, 1920x1080, 6 seconds.

no humans, no faces, no text, no logos, no flashy
```

#### 案C: 水面の波紋
```
Slow overhead shot of still water in a warm-lit pool. A single pink
petal drops in and creates gentle concentric ripples that fade outward.
Peaceful, meditative, minimal. Cinematic, high-end. Loopable.
16:9, 1920x1080, 6 seconds.

no humans, no text, no splash, no harsh movement
```

---

### V2. CONCEPT（私たちについて）動画

```
Extreme close-up slow-motion of a single pink peony petal unfurling
slowly in soft diffused light on cream linen fabric. Delicate, serene,
poetic. Shallow depth of field. No camera movement, just the petal.
16:9, 1920x1080, 8 seconds.

no humans, no text, no logos, no fast movement
```

---

### V3. CONTENTS セクションの背景動画（オプション）

```
Subtle slow-motion loop: soft pink silk fabric undulating gently like
a calm ocean wave, in close-up. Warm diffused light creates highlights
and shadow valleys. Luxurious, hypnotic, peaceful. Perfect background
loop. 16:9, 1920x1080, 5 seconds, seamlessly loopable.

no humans, no faces, no text, no logos, no fast movement
```

---

### V4. ローディング動画（オプション）

```
Abstract minimalist loop: a single thin vertical line of soft pink light
slowly pulses and breathes against a warm white background. Extremely
subtle, meditative, clean. 1:1 or 16:9, 3 seconds, seamless loop.

no humans, no text, no logos, no geometry, no flashy
```

---

### V5. 季節バリエーション（差し替え用・将来用）

#### 春（桜）
```
Slow cinematic shot of pink cherry blossom branches swaying gently in
a soft spring breeze, backlit by morning sun. Shallow DOF, petals
drifting slowly. 16:9, 8 seconds, loopable.
```

#### 夏（紫陽花と水滴）
```
Macro slow-motion of water droplets rolling off a pink hydrangea petal
in soft morning light. Tranquil, refreshing. 16:9, 6 seconds.
```

#### 秋（紅葉と光）
```
Soft backlit close-up of autumn maple leaves in muted pink and coral
tones, gently swaying. Warm golden hour light. 16:9, 8 seconds, loopable.
```

#### 冬（雪とバラ）
```
A single pink rose dusted with soft falling snow in warm lantern light.
Slow-motion, delicate, poetic. 16:9, 8 seconds, loopable.
```

---

## 💡 プロンプト調整のコツ

### 色味を強めたい時
`"saturated pink"` ではなく `"dusty pink, #E8849A color palette"` のように **16進数指定** が効く。

### 「高級感」を出すには
以下の要素を足す:
- `editorial`
- `magazine quality`
- `high-end`
- `cinematic`
- `film grain`
- `shallow depth of field`

### 「和のテイスト」を加える場合
- `Japanese aesthetic`
- `wabi-sabi`
- `Japanese minimalism`
- `zen`

### 「女性的になりすぎない」ためには
避ける語: `girly`, `cute`, `sweet`, `frilly`, `lace`, `bow`  
使う語: `refined`, `elegant`, `understated`, `quiet luxury`, `modern`

---

## 📂 配置手順

1. Gemini / Google AI Studio で上記プロンプトを実行
2. 出力画像/動画をダウンロード
3. ファイル名を指定のものに揃える（例: `top-hero.jpg`）
4. `public/images/placeholder/` に配置
5. git commit & push → Vercel 自動反映

動画の場合は拡張子 `.mp4` で、上記テーブルの `video-*.mp4` パスに配置。HOMEページの
`<Image src=...>` を動画用の `<video>` タグに差し替える調整は別途実施（依頼があれば対応）。

---

## 🔄 今後の追加候補

Phase 2以降で画像が必要になりそうな箇所:
- ブログ記事のサムネイル（記事ごとに生成）
- メルマガ用バナー
- SNS投稿用ビジュアル
- イベント告知バナー
- 季節テーマの差し替え用

これらは後日プロンプト集を追加予定。
