# T-MANAGE セッション㉗ 引き継ぎ



## 環境情報

- GitHub: https://github.com/angespa0510-ux/t-manage.git

- Vercel: https://t-manage.vercel.app

- Supabase URL: `https://cbewozzdyjqmhzkxsjqo.supabase.co`

- Supabase Anon Key: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNiZXdvenpkeWpxbWh6a3hzanFvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyNjU2MzYsImV4cCI6MjA4OTg0MTYzNn0.cddSSXx6OqOKNTc-WlaHTusK67sFgi8QwETnGaVGgIw`

- GitHubトークン: セッション冒頭に`ghp_`トークンを伝えてもらう

- HP: https://ange-spa.com

- Gmailアプリパスワード名: T-MANAGE3

- PCフォルダ: `C:\Users\user\Desktop\t-manage`（二重フォルダ問題を解消済み）



## 前回セッション（㉖）で完了したこと



### 📖 マニュアルシステム Phase 1: スタッフ管理画面 [完了]

**DB設計（5テーブル）:**
- `manual_categories`: カテゴリ（アイコン/カラー/説明/並び順）
- `manual_articles`: 記事（タイトル/本文/カバー画像/タグ/公開/ピン留め/閲覧数）
- `manual_reads`: 既読管理（therapist_id × article_id）
- `manual_updates`: 更新履歴（更新メモ/更新者/日時）
- `manual_qa`: Q&A（記事ごとの質問/回答ペア）

**8カテゴリプリセット:**
1. 🌸 はじめに（新人さん向け）
2. 💆 施術マニュアル
3. 🧹 清掃・準備
4. 💰 お金・精算
5. ⏰ 勤務・シフト
6. 📅 予約・接客
7. 🏢 ルーム別ガイド
8. 📋 ルール・その他

**管理画面 `/manual`:**
- 記事CRUD（タイトル/カテゴリ/本文/カバー画像/タグ/公開/ピン留め）
- マークダウンエディタ（太字/見出し/リスト/画像挿入ツールバー）
- 📝編集 / 👁プレビュー 切替ボタン
- 🏷️ タグ管理（カラフルピル+既存タグクイック追加）
- ❓ Q&A管理（質問/回答ペアの追加/編集/削除）
- ✏️ 更新メモ（保存時に変更内容を記録）
- 📝 更新タイムライン（最近の更新5件表示）
- 📊 閲覧状況（セラピストごとの既読/未読 + プログレスバー）
- 📂 カテゴリ管理（アイコン/カラー/説明の編集）
- 🔍 キーワード検索 + タグフィルタ
- 📸 カバー画像アップロード（Supabase Storage: manual-images）
- 🖼 本文中画像挿入
- 🎬 YouTube動画埋め込み（[youtube:動画ID] 形式、レスポンシブ表示）
- マークダウン対応: ## 見出し / **太字** / - リスト / 1. 番号リスト / > 引用 / --- 区切り線
- 🔄 既読リセット機能（大きな更新時に全セラピストへ再通知）
- 📋 記事複製ボタン（下書き状態でコピー作成）
- ナビメニューに📖マニュアル管理を追加



### 📖 マニュアルシステム Phase 2: セラピストマイページ [完了]

**📖マニュアルタブ（/mypage）:**
- カテゴリフィルタ（横スクロール、カラフルチップ）
- 🏷️ タグフィルタ
- 🔍 キーワード検索
- 📌 ピン留め記事をトップ表示
- 🆕 NEWバッジ（7日以内+未読、キラッとアニメーション）
- ✏️ 更新バッジ（アニメーション付き）
- ✅ 既読マーク（閲覧時に自動記録）
- 記事詳細表示（マークダウンレンダリング）
- ❓ Q&Aアコーディオン表示
- ✏️ 更新バナー（記事上部に黄色い通知）
- 📝 更新タイムライン（最近の更新3件）
- 👁 view_count自動カウント

**ホームタブ通知:**
- 📖 マニュアル未読通知カード（未読件数+最近の更新表示）
- タップでマニュアルタブに遷移
- マニュアルタブに未読件数バッジ



### 🤖 マニュアルシステム Phase 3: AI機能 [完了]

**API Route `/api/manual-ai`:**
- Claude Sonnet (claude-sonnet-4-20250514) 使用
- 環境変数: `ANTHROPIC_API_KEY` をVercelに設定が必要

**🤖 AIチャット（セラピストマイページ）:**
- マニュアル全記事+Q&Aをコンテキストに質問回答
- 会話履歴対応（直近6メッセージ）
- 質問サジェスト3つ（掃除/シフト/精算）
- チャットバブルUI（ピンク=ユーザー/グレー=AI）
- 「🤖 AIに質問する」ボタンで開閉

**🤖 AI整理（管理画面エディタ）:**
- 記事本文をAIが校正・マークダウン整形
- プレビューに自動切替
- セラピスト向けのやさしい言葉遣いに変換

**🏷️ タグ自動生成（管理画面）:**
- 記事内容+既存タグから3-5個提案
- 既存タグを優先的に再利用



### 🏆 マニュアルシステム Phase 4: 閲覧ランキング [完了]

- 🥇🥈🥉 よく読まれている記事ランキング（TOP5）
- ⚠️ あまり読まれていない記事の警告（既読人数表示）
- 改善アドバイス（「ピン留めや更新通知で閲覧を促しましょう」）



### ⚠️ 要確認: Anthropic APIキー設定

1. https://console.anthropic.com でAPIキー取得
2. Vercel Dashboard → Settings → Environment Variables
3. Key: `ANTHROPIC_API_KEY` / Value: `sk-ant-api03-...`
4. Redeployで反映

以下が未実行の場合は実行が必要:

1. **SQL実行**: `sql/session26_manual_system.sql` をSupabase SQL Editorで実行
   - 5テーブル作成 + 8カテゴリ初期データ + RLSポリシー

2. **Storageバケット**: Supabase Dashboard > Storage > New Bucket
   - 名前: `manual-images`
   - Public: ON



## 次回セッション（㉗）の予定タスク



### Google Sites コンテンツ移行

現在のGoogle Sitesマニュアル（33+記事）を新システムに移行:
- URL: https://sites.google.com/view/angespatherapist/ホーム
- Google SitesはJS描画のためスクレイピング不可 → 手動移行が必要
- 移行時にカテゴリ再整理（提案済みの8カテゴリ構成に基づく）



### マニュアルシステム追加機能（任意）

- 📸 画像アップロード改善（ドラッグ&ドロップ）
- 🎬 動画直接アップロード（Supabase Storage）
- 記事の並び替え（ドラッグ&ドロップ or ↑↓ボタン）
- セラピスト個別の既読率ダッシュボード
- マニュアルの印刷/PDF出力機能



## 設計判断（全セッション通じて）

[DECISION] NG表示: ログイン前=全表示(確認画面で警告), ログイン後=非表示

[DECISION] 30分ルール: 現在時刻+30分以内は予約不可

[DECISION] 終了時刻超過: ブロックせず注意書き表示

[DECISION] キャンセル: リクエスト中=直接キャンセル可, 確定済み=電話案内

[DECISION] タイムチャート設定: store_settings.timechart_config（お店共通）

[DECISION] 入退室: セラピストがボタン操作、タイムチャート時間は不変

[DECISION] 超過通知: 手動LINE送信ボタン方式（自動送信は廃止）

[DECISION] 電話確認: 全オーダー対象、ONにした予約のみ通知（時間は設定で変更可能）

[DECISION] 確定シフト表示: 建物名あり、ルーム名は直前変更あるため非表示

[DECISION] LINE送信: Chrome拡張経由（PCが起動していれば動作）

[DECISION] マニュアル管理: ダッシュボード /manual に配置

[DECISION] マニュアル閲覧: セラピストマイページの📖タブ

[DECISION] マニュアル編集: マークダウンエディタ（太字/見出し/リスト/画像ツールバー+プレビュー）

[DECISION] マニュアルカテゴリ: 8カテゴリ（はじめに/施術/清掃/お金/勤務/予約/ルーム別/ルール）

[DECISION] マニュアル更新通知: 更新メモ→タイムライン+バッジ+バナー

[DECISION] マニュアルQ&A: 記事ごとにQ&Aペア（アコーディオン表示）

[DECISION] マニュアル既読管理: 閲覧時に自動記録、管理画面で全セラピストの状況確認

[DECISION] マニュアル画像: Supabase Storage (manual-images バケット)

[DECISION] マニュアルAI: Claude API Sonnet使用（月約¥1,000）

[DECISION] 動画埋め込み: YouTube + 直接アップロード両対応（Phase 4）



## その他 PENDING タスク

- 顧客14,371件の全件スクレイピング実行

- セラピストCSV整理+インポート実行

- NGデータのインポート

- HP制作会社への依頼実行

- 部屋割り管理表の改善

- 税理士待ち: 勘定科目見直し

- レスポンシブ対応、バリデーション強化

- Googleコンタクト自動同期

- セキュリティ強化(運用安定後)



## Chrome拡張の更新

- `content_tmanage.js` に `TMANAGE_LINE_OVERDUE_SEND` イベントリスナー追加済み

- 拡張更新時は `chrome://extensions` で🔄ボタン

- PCフォルダ: `C:\Users\user\Desktop\t-manage\chrome-extension`



## API コスト

- Claude API: 月約¥1,000（Sonnet、10件/日の質問+記事整理）

- Prompt caching使用で¥300〜500まで削減可能

- 初回$5無料クレジットあり
