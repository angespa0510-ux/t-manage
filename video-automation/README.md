# T-MANAGE AI動画自動生成

## 概要

T-MANAGEの管理画面からセラピストを選び、ボタン1つでAI動画を自動生成するシステム。

```
T-MANAGE Web UI（Vercel）
  ↓ リクエスト作成（Supabase）
ローカルPC（このスクリプト）
  ↓ ポーリングで検出 → Playwright実行
  ↓ HPスクレイピング → Gemini画像生成 → VEO動画生成
  ↓ ffmpegウォーターマーク除去
  ↓ デスクトップ保存 + Googleドライブコピー
  ↓ メール通知 + Supabaseステータス更新
T-MANAGE Web UI に結果反映
```

## セットアップ

### 1. 前提条件

- Node.js 18+
- ffmpeg（PATHに通す or .envでパス指定）
- Chrome（Geminiにログイン済み）
- Googleドライブデスクトップアプリ（自動保存用）

### 2. インストール

```bash
cd video-automation
npm install
npx playwright install chromium
```

### 3. 環境変数設定

```bash
copy .env.example .env
# .env を編集して各値を設定
```

### 4. Supabaseテーブル作成

`sql/video_generation_tables.sql` をSupabase SQL Editorで実行。

### 5. Chromeプロファイルの確認

Geminiにログイン済みのChromeプロファイルのパスを `.env` に設定：
```
CHROME_PROFILE_PATH=C:\Users\user\AppData\Local\Google\Chrome\User Data
CHROME_PROFILE_NAME=Default
```

**注意**: Chromeを閉じた状態で実行してください（プロファイルのロック防止）。

## 使い方

### 自動監視モード（推奨）

```bash
npm run watch
```

T-MANAGEのWeb画面から「動画を生成する」を押すと自動で処理開始。

### 手動実行

```bash
node index.js 1   # リクエストID 1 を処理
```

## T-MANAGE Web UI

`/video-generator` ページの3つのタブ：

| タブ | 機能 |
|------|------|
| 🎬 動画生成 | セラピスト選択 → 画像選択 → 印象選択 → 生成 |
| 📋 生成履歴 | 過去の生成ログ、👍いいね機能 |
| ⚙️ 設定 | プロンプト編集、カテゴリ管理、通知設定 |

## ファイル構成

```
video-automation/
├── package.json        # 依存パッケージ
├── .env.example        # 環境変数テンプレート
├── config.js           # 設定ファイル
├── watcher.js          # Supabaseポーリング監視（npm run watch）
├── index.js            # 手動実行用
├── processor.js        # メイン処理フロー
├── downloader.js       # 画像ダウンロード
├── ffmpeg-utils.js     # ウォーターマーク除去
├── mailer.js           # メール通知
└── README.md           # このファイル
```

## トラブルシューティング

| 問題 | 対処 |
|------|------|
| Chromeが起動しない | Chromeを閉じてから再実行 |
| Geminiにログインできない | Chromeプロファイルパスを確認 |
| 画像アップロード失敗 | Geminiの UI変更の可能性 → processor.js のセレクタを更新 |
| ffmpegエラー | ffmpegがPATHに通っているか確認: `ffmpeg -version` |
| メールが届かない | Gmailアプリパスワードを確認 |
