# Ange Spa プロンプト集 v4 — サブページヘッダー動画

> **目的**: トップページの `hero.mp4`（ピンク夕焼け屋上ブランドルック・人物あり）が
> 完成度高く好評のため、`/schedule`・`/diary`・`/access` の3つのサブページに
> **同じブランドDNA**を持つヘッダー動画を追加する。
>
> **キーワード**: 「hero.mp4 と並べて違和感がない」「同じ世界観の続編」

---

## 🎨 ブランドDNA（v4 共通アンカー）

すべてのプロンプトの先頭に以下を貼り付けることで、`hero.mp4` と統一感を保てます。

```
Same dreamy pastel pink sunset aesthetic as the brand hero shot:
warm magic-hour rooftop atmosphere, soft golden side-lighting,
delicate bokeh light particles drifting, hazy soft focus,
muted dusty pink palette (#E8849A / #FCE4E9 / #FFF5F1),
gentle film grain, editorial Japanese photography, cinematic 24fps,
ultra-slow camera, peaceful, unhurried, elegant, feminine.
Seamlessly loopable.
```

**色温度の参考**: 日没15分前〜マジックアワー（約3500K〜4500K）。彩度はやや落として上品に。

---

## 🎯 差し込みたい3ページマップ

| # | ページ | 現状 | テーマ | コンセプト |
|---|--------|------|--------|-----------|
| H1 | `/schedule` | 大理石ピンク背景のみ | 時間・予約 | 屋上テラスのティーセット & 揺れるカーテン |
| H2 | `/diary` | 大理石ピンク背景のみ | 日常・素顔 | 開いたジャーナルと押し花 |
| H3 | `/access` | 「公開準備中」の寂しさ | 場所・玄関 | 真鍮ランタンと藤の入口 |

すべて：
- **長さ**: 8秒、シームレスループ
- **解像度**: 1920×1080（16:9）
- **被写体**: 人物なし・顔なし・ロゴなし・文字なし
- **構図**: 中央〜左寄り（右側に文字が乗るスペース）

---

## 🌅 H1. `/schedule` — 屋上テラスのティーセット

「予約・スケジュール」のページ。お客様が「次にいつ会えるか」を確認する場所。
**待ち時間の優雅さ**・**約束された再会**を表現します。

```
[v4 共通アンカーをここに貼る]

Cinematic ultra-slow loop on a rooftop terrace at pastel pink sunset.
A delicate ceramic teacup with rising warm steam sits on a low rattan
side table. Beside it, a small open pocket diary with a thin gold
ribbon bookmark fluttering very gently. A small vase of soft pink
peonies and dried baby's breath. A sheer white linen curtain in the
left third of the frame sways gently in a warm summer breeze.
Background: out-of-focus dusty-pink sky and floating bokeh particles.
Camera fully static, no panning, no zooming. Composition: subjects
slightly LEFT of center, leaving the RIGHT 40% as soft empty bokeh
space (for overlay text). 8 seconds, seamless loop. 16:9, 1920x1080.

NEGATIVE: no humans, no faces, no hands, no text, no logos, no clock,
no fast movement, no harsh shadows, no oversaturated colors,
no modern electronics, no cars, no buildings in foreground.
```

**意味づけ**: ティーカップの湯気=「これから始まる時間」、ダイアリー=「予定」、揺れるカーテン=「呼吸する時間の流れ」。

---

## 📖 H2. `/diary` — 開いたジャーナルと押し花

「写メ日記」のページ。セラピストたちの**日常・素顔・記録**を表現します。
押し花・万年筆・古紙の質感で「綴られた瞬間」を可視化。

```
[v4 共通アンカーをここに貼る]

Cinematic ultra-slow overhead loop. A worn cream-colored linen
tablecloth with soft pink sunset light grazing across it. Open
on the table: a vintage cream paper journal with handwritten
script (illegible, blurred), a thin gold fountain pen resting
diagonally, scattered pressed pink rose petals and a single sprig
of dried lavender. A small polaroid frame face-down beside the
journal (no image visible). Soft warm side-lighting from the right
creates a delicate lens flare and floating dust particles. The page
of the journal lifts and settles very gently as if from a soft
breeze. Camera fully static, no panning. Composition: subjects
slightly LEFT of center, leaving the RIGHT 40% as warm soft
out-of-focus space. 8 seconds, seamless loop. 16:9, 1920x1080.

NEGATIVE: no humans, no faces, no readable text, no readable
handwriting, no logos, no brand names, no modern electronics,
no phones, no cameras visible, no harsh shadows, no fast movement.
```

**意味づけ**: 開いたジャーナル=「日記」、押し花=「記憶」、万年筆=「書き残す」、ポラロイド裏面=「本人は写らない」。

---

## 🏮 H3. `/access` — 真鍮ランタンと藤の入口

「店舗・アクセス」のページ。**たどり着く場所**・**ようこそ**の空気感を作ります。
v3 の V3（ランタン）を **hero.mp4 と統一感が出るよう** より具体化したリビジョン。

```
[v4 共通アンカーをここに貼る]

Cinematic ultra-slow loop at pastel pink magic hour. A warm brass
lantern with a softly flickering golden flame stands beside an
elegant wooden entrance door (door slightly ajar, sheer cream
curtain just visible inside swaying gently). Cascading soft pink
wisteria or bougainvillea flowers frame the upper left corner.
A small worn stone step beneath the door. Floating bokeh light
particles drift across the frame. Warm pink-orange sunset glow
spills from camera right, casting long soft shadows. Camera fully
static. Composition: door and lantern centered slightly LEFT,
leaving the RIGHT 40% as warm bokeh sky for overlay text.
8 seconds, seamless loop. 16:9, 1920x1080.

NEGATIVE: no humans, no faces, no signage, no street numbers,
no readable text, no logos, no shop names, no cars, no modern
storefront elements, no neon, no fast movement, no harsh contrast.
```

**意味づけ**: ランタン=「灯り・歓迎」、半開きのドア=「ようこそ」、藤の花=「日本×フレンチの上品さ」。

---

## 🎬 生成ワークフロー（推奨）

### Step 1: VEO 3 / Gemini Video / Sora で生成
- 1ページにつき **2〜3バリエーション** 生成して比較推奨
- 生成後、**hero.mp4 と並べて再生** し、色温度・グレイン・パーティクルが揃っているか確認

### Step 2: 軽量化
現状 `hero.mp4` は約 2.9MB。サブページ動画も同水準にしたいので：

```bash
# 8秒 / 1080p / H.264 / 約 2-3MB に圧縮
ffmpeg -i input.mp4 -t 8 -vf scale=1920:1080 \
  -c:v libx264 -crf 28 -preset slow -an \
  -movflags +faststart schedule.mp4
```

### Step 3: ポスター画像も書き出し
動画読み込み前のフォールバック用：

```bash
ffmpeg -ss 00:00:03 -i schedule.mp4 -frames:v 1 -q:v 2 schedule-poster.jpg
```

### Step 4: 配置先
```
public/videos/
├── schedule.mp4         (新規)
├── schedule-poster.jpg  (新規)
├── diary.mp4            (新規)
├── diary-poster.jpg     (新規)
├── access.mp4           (新規)
└── access-poster.jpg    (新規)
```

ファイルがアップされたら、私（Claude）が以下のように **3ページのヘッダー部分にビデオ背景を組み込む** ところまで担当します：

```tsx
// 例: app/(site)/schedule/page.tsx のヘッダー部分
<div className="relative overflow-hidden">
  <video
    src="/videos/schedule.mp4"
    poster="/videos/schedule-poster.jpg"
    autoPlay loop muted playsInline preload="metadata"
    className="absolute inset-0 w-full h-full object-cover"
    style={{ objectPosition: "30% center" }}  // 文字は右寄せなので左を見せる
  />
  <div className="absolute inset-0 bg-gradient-to-r from-white/40 via-white/20 to-white/0" />
  {/* ... 既存のヘッダーテキスト ... */}
</div>
```

---

## 💡 hero.mp4 と「並べたとき」のチェックリスト

生成後、以下を満たすか確認：

- [ ] **色温度**: hero.mp4 と同じくマジックアワー（やや暖色）
- [ ] **彩度**: ピンクは "dusty"（くすみピンク）であり原色ピンクではない
- [ ] **粒状感**: 微細なフィルムグレインが乗っている
- [ ] **ボケ**: 球状のソフトボケが画面全体に浮遊
- [ ] **動き**: 1秒で1〜2cm程度しか動かない超スロー
- [ ] **構図**: 右側 30〜40% は文字を乗せられる空白
- [ ] **ループ**: 最後と最初がつながり、切れ目に違和感なし

---

## 🎁 ボーナスプロンプト: 各セクション間の "つなぎ" 動画

将来的にスクロール演出として使えます（任意）。

### B1. ピンクシルクのリボン（セクション仕切り用）
```
Abstract cinematic loop: a thin pastel pink silk ribbon undulating
horizontally across a soft cream-pink gradient background, like a
calm wave. Backlit by warm sunset glow with floating bokeh particles.
Ultra slow, hypnotic. 5 seconds, seamless loop. 16:9, 1920x1080.
no humans, no text, no logos, no fast movement.
```

### B2. 花びら降下（フッター手前）
```
Vertical cinematic slow-motion of soft pink peony and cherry blossom
petals drifting downward across a pastel pink sunset sky background
with golden lens flare and floating bokeh particles. Cream pink
gradient. Dreamy, meditative. 8 seconds, seamless loop. 16:9, 1920x1080.
no humans, no text, no logos, no harsh contrast.
```

---

## 📝 次のアクション

1. **H1〜H3 のいずれかから生成開始** （おすすめ順: H1 schedule → H3 access → H2 diary）
2. 生成された `.mp4` をアップロード
3. Claude が圧縮 + ポスター抽出 + 各ページのヘッダーへの組み込みまで担当
4. 並べて再生 → 違和感あれば再生成（プロンプトを微調整）

「ピンク夕焼け屋上ブランドルックの世界観」を3ページに広げて、サイト全体に **シネマティックな統一感** を与えるのが v4 のゴールです 🌸
