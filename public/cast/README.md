# マイページ画像アセット

このディレクトリは、お客様マイページで使用する画像・動画アセットの配置場所です。

## 📁 ファイル構成（期待されるファイル名）

すべてのファイルは **このディレクトリ直下** に配置してください。存在しない場合は SVG 装飾が自動的にフォールバック表示されます。

| ファイル名 | 用途 | アスペクト比 | 推奨サイズ |
|---|---|---|---|
| `hero-login.jpg` | ログイン画面背景 | 16:9 | 1920 × 1080 |
| `hero-home.jpg` | ホーム画面上部装飾 | 16:9 | 1920 × 1080 |
| `empty-reservation.jpg` | エンプティ：次回予約なし | 4:3 | 1200 × 900 |
| `empty-favorite.jpg` | エンプティ：お気に入りなし | 1:1 | 1200 × 1200 |
| `empty-notification.jpg` | エンプティ：お知らせなし | 1:1 | 1200 × 1200 |
| `welcome-loop.mp4` | ホーム用ループ動画（任意） | 16:9 | 1920 × 1080 / 6秒 |

## 🎨 Gemini 生成用プロンプト

以下のプロンプトをそのままコピペして Gemini に入力してください。

### ① hero-login.jpg（ログイン画面ヒーロー）

```
A soft, ethereal close-up of pale pink peonies and white silk ribbons
on a rustic wooden table by a window with sheer white curtains.
Warm natural morning light streaming through.
NO text, NO labels, NO logos, NO brand names, NO watermarks.
Include a plain unlabeled glass bottle and a ceramic bowl with a folded white towel softly blurred in background.
Dreamy shallow depth of field, minimalist composition, editorial fashion photography style,
elegant Japanese spa aesthetic, muted pastel tones with soft rose pink accents.
16:9 landscape aspect ratio, high resolution.
```

### ② hero-home.jpg（ホーム画面上部装飾）

```
A dreamy wide-angle view of an elegant white linen-covered massage bed
in a luxury spa room. Soft morning light through sheer curtains,
pink peony petals scattered on the bed, a small bouquet of pink roses on a side table.
Minimalist Japanese aesthetic, warm neutral tones, rose pink accents.
NO text, NO people, NO faces, NO watermarks.
Editorial spa photography, soft focus background, 16:9 landscape aspect ratio.
```

### ③ empty-reservation.jpg（エンプティ：予約なし）

```
A serene minimal still life of a single small bouquet of pale pink peonies
wrapped in white linen, resting on a plain white marble surface.
Soft diffused natural light from above, airy white negative space on the sides.
Japanese minimalist aesthetic, editorial photography, shallow depth of field.
NO text, NO watermarks, NO logos.
4:3 landscape aspect ratio, high resolution, muted warm tones.
```

### ④ empty-favorite.jpg（エンプティ：お気に入りなし）

```
A minimal overhead still life of a pink rose heart-shape arrangement
made of loose pink rose petals on a plain white linen surface.
Soft natural morning light, very shallow depth of field.
NO text, NO watermarks, NO logos.
Japanese minimalist aesthetic, editorial photography, 1:1 square aspect ratio.
```

### ⑤ empty-notification.jpg（エンプティ：お知らせなし）

```
A minimal still life of a single sealed white envelope with a pale pink wax seal,
lying on a plain white linen surface with a small dried rose next to it.
Soft diffused morning light, airy white space.
NO text, NO watermarks, NO logos, NO writing on the envelope.
Japanese minimalist aesthetic, editorial photography, 1:1 square aspect ratio.
```

### ⑥ welcome-loop.mp4（ホーム用動画 — VEO）

```
A slow cinematic close-up of pale pink peony petals gently swaying
in a soft morning breeze by a sheer white curtain.
Warm sunlight filtering through, dreamy shallow depth of field.
Seamless loop, subtle movement only (petals and curtain),
NO text, NO people, NO watermarks.
Elegant Japanese spa aesthetic, muted pastel rose pink tones.
6-second seamless loop, 16:9 landscape, 1080p resolution.
```

## ⚠️ 注意点

1. **透かし・ブランド名の混入を避ける** — 生成画像に "ETHEREAL SPA" などのテキストが入る場合、再生成してください
2. **人物や顔は入れない** — 特定の人物像が入らないよう注意
3. **ファイル名は厳密に上記に合わせてください** — コード側で直接参照しているため
4. **ファイルサイズ** — 各画像 500KB 以下を目安に（必要なら tinypng.com などで圧縮）

## 🔄 画像を差し替えたいとき

1. Gemini で再生成
2. 上記ファイル名で `/public/mypage/` に上書き保存
3. Vercel が自動デプロイ
