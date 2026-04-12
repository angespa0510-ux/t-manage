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

- 旧マニュアルサイト: https://sites.google.com/view/angespatherapist/ホーム



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
- マークダウンエディタ + 📝編集 / 👁プレビュー 切替
- ツールバー: B(太字) / H(見出し) / ・(リスト) / 1.(番号リスト) / ❝(引用) / ―(区切り線) / 🖼(画像) / ▶(YouTube) / 📁(Google Drive動画)
- 🏷️ タグ管理（カラフルピル+既存タグクイック追加）
- ❓ Q&A管理（質問/回答ペアの追加/編集/削除）
- ✏️ 更新メモ + 🔄既読リセットチェックボックス
- 📝 更新タイムライン（最近の更新5件表示）
- 📊 既読率ダッシュボード（公開記事数/セラピスト数/全体既読率/総閲覧数）
- 📊 記事ごとの閲覧状況パネル（セラピスト一覧+読了日時）
- 🏆 閲覧ランキングTOP5 + ⚠️未読記事警告
- 📋 記事複製ボタン
- 📂 カテゴリ管理（アイコン/カラー/説明の編集）
- 🔍 キーワード検索 + タグフィルタ
- 📸 画像アップロード（Supabase Storage: manual-images バケット）
- 🎬 YouTube埋め込み: `[youtube:動画ID]`
- 📁 Google Drive埋め込み: `[gdrive:ファイルID:説明テキスト]`



### 📖 マニュアルシステム Phase 2: セラピストマイページ [完了]

**📖マニュアルタブ（/mypage）:**
- カテゴリフィルタ（横スクロール、カラフルチップ）
- 🏷️ タグフィルタ + 🔍 キーワード検索
- 📌 ピン留め記事をトップ表示
- 🆕 NEWバッジ（7日以内+未読、キラッとアニメーション）
- ✏️ 更新バッジ（アニメーション付き）
- ✅ 既読管理（閲覧時に自動記録+チェックマーク）
- 記事詳細表示（マークダウンレンダリング、YouTube/GDrive対応）
- ❓ Q&Aアコーディオン表示
- ✏️ 更新バナー（記事上部に黄色い通知）
- 📝 更新タイムライン（最近の更新3件）
- 👁 view_count自動カウント
- 🏠 ホームタブに未読マニュアル通知カード
- タブに未読件数バッジ



### 🤖 マニュアルシステム Phase 3: AI機能 [完了]

**API Route `/api/manual-ai`:**
- Claude Sonnet (claude-sonnet-4-20250514) 使用

**🤖 AIチャット（セラピストマイページ）:**
- マニュアル全記事+Q&Aをコンテキストに質問回答
- 会話履歴対応（直近6メッセージ）
- 質問サジェスト3つ（掃除/シフト/精算）
- チャットバブルUI

**🤖 AI整理（管理画面エディタ）:**
- 記事本文をAIが校正・マークダウン整形

**🏷️ タグ自動生成（管理画面）:**
- 記事内容+既存タグから3-5個提案



### 🏆 マニュアルシステム Phase 4: 閲覧ランキング [完了]

- 🥇🥈🥉 よく読まれている記事ランキング（TOP5）
- ⚠️ あまり読まれていない記事の警告



### 📋 Google Sites全記事移行 [完了]

**全32記事 + 8件Q&AをSQL化済み:**
- `sql/session26_full_migration.sql` — 全記事（本文含む）
- Google Sitesの全ページをスクリーンショットから読み取り、マークダウン整形
- カテゴリ別に再整理済み

**移行済み記事一覧:**

| カテゴリ | 記事 |
|---------|------|
| 🌸はじめに | 新人説明事項 / マイページ使い方 |
| 💆施術 | 施術マニュアル / 重要ポイント集（鼠径部&密着） |
| 🧹清掃 | 退室前清掃 / 清掃NG OK写真 / ベッドメイキング / タオル畳み方 / 麦茶の蓋 |
| 💰お金 | 精算の仕方 / お給料 / 釣銭と両替 / 料金未払い対応 |
| ⏰勤務 | 遅刻早退欠勤 / 外出 / LAST勤務 / 予約なし終了時間 / 近隣店掛持ち |
| 📅予約 | 予約時間注意 / 入退室時間 / コース変更 / 呼び指名(XのDM) / NG登録 |
| 🏢ルーム別 | 三河安城サブ部屋 / 三河安城ゴミ分別 / 豊橋備品 / 豊橋利用ルール / 豊橋鍵と釣銭 |
| 📋その他 | 音楽準備設定 / ポスト開け方 / 写メ日記ポーズ / 喫煙ルール |



### ⚠️ 未完了・要対応タスク

**① Anthropic APIキー設定（AI機能に必要）:**
1. https://console.anthropic.com でAPIキー取得（セッション㉖時点でコンソール一時停止中だった）
2. Vercel Dashboard → Settings → Environment Variables
3. Key: `ANTHROPIC_API_KEY` / Value: `sk-ant-api03-...`
4. Redeployで反映
5. 月額コスト: 約¥300〜1,000（初回$5無料クレジットあり）

**② 管理画面から画像アップロード（手動作業）:**
- 清掃NG/OK写真（比較画像5枚程度）
- ベッドメイキング写真
- 三河安城サブ部屋の備品写真（流し下/洗面台下/クローゼット）
- 豊橋備品のキッチン引き出し写真
- 精算明細の参考画像
- カード決済の参考画像
- 組織図の画像（ホームページ用）

**③ Google Drive動画の埋め込み（管理画面で📁ボタン）:**
- 施術動画01〜15（Google Driveリンク）
- タオルの畳み方.mp4
- 各記事を編集 → 📁ボタン → Google DriveのURL貼り付け → 説明入力

**④ Storageバケットのポリシー確認:**
- `manual-images` バケット作成済み（Public ON）
- RLSポリシー設定済み（SELECT/INSERT/UPDATE/DELETE）



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
[DECISION] マニュアル編集: マークダウンエディタ+プレビュー
[DECISION] マニュアルカテゴリ: 8カテゴリ（はじめに/施術/清掃/お金/勤務/予約/ルーム別/ルール）
[DECISION] マニュアル更新通知: 更新メモ→タイムライン+バッジ+バナー+既読リセット
[DECISION] マニュアルQ&A: 記事ごとにQ&Aペア（アコーディオン表示）
[DECISION] マニュアル既読管理: 閲覧時に自動記録、管理画面で全セラピストの状況確認
[DECISION] マニュアル画像: Supabase Storage (manual-images バケット)
[DECISION] マニュアル動画: YouTube埋め込み[youtube:ID] + Google Drive埋め込み[gdrive:ID:説明]
[DECISION] マニュアルAI: Claude API Sonnet使用（月約¥1,000）
[DECISION] Google Sites移行: 全32記事をSQL化してSupabaseに投入、画像は後から手動アップ



## 次回セッション（㉗）の予定タスク

### 候補タスク
- 管理画面から画像の一括アップロード補助ツール
- 記事の並び替え（ドラッグ&ドロップ or ↑↓ボタン）
- セラピスト個別の既読率ダッシュボード
- マニュアルの印刷/PDF出力機能
- 画像のドラッグ&ドロップアップロード対応
- その他PENDINGタスク



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



## SQLファイル一覧（sql/フォルダ）

- `session26_manual_system.sql` — テーブル作成+カテゴリ+RLS（実行済み）
- `session26_sample_articles.sql` — サンプル記事（full_migrationで上書き済み）
- `session26_migration_stubs.sql` — スタブ記事（full_migrationで上書き済み）
- `session26_full_migration.sql` — ★全32記事+8Q&Aの本番データ
