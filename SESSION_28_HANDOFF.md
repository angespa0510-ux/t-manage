# T-MANAGE セッション㉘ 引き継ぎ



## 環境情報

- GitHub: https://github.com/angespa0510-ux/t-manage.git
- Vercel: https://t-manage.vercel.app
- Supabase URL: `https://cbewozzdyjqmhzkxsjqo.supabase.co`
- Supabase Anon Key: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNiZXdvenpkeWpxbWh6a3hzanFvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyNjU2MzYsImV4cCI6MjA4OTg0MTYzNn0.cddSSXx6OqOKNTc-WlaHTusK67sFgi8QwETnGaVGgIw`
- Anthropic API Key: Vercel環境変数 `ANTHROPIC_API_KEY` に設定済み（$20/月制限）
- GitHubトークン: セッション冒頭に`ghp_`トークンを伝えてもらう
- HP: https://ange-spa.com
- Gmailアプリパスワード名: T-MANAGE3
- PCフォルダ: `C:\Users\user\Desktop\t-manage`
- 旧マニュアルサイト: https://sites.google.com/view/angespatherapist/ホーム



## 前回セッション（㉗）で完了したこと

### 📸 画像ドラッグ&ドロップ対応 [完了]
- カバー画像エリア: D&D対応 + ビジュアルフィードバック
- エディタ: D&D対応（複数画像OK）+ ドロップオーバーレイ
- Ctrl+V クリップボード貼り付け対応
- アップロード中スピナー表示

### 🔗 記事間リンク機能 [完了]
- `[link:記事タイトル]` → タップで記事にジャンプ
- `[catlink:カテゴリ名]` → タップでカテゴリフィルタ
- マイページ: ピンク色下線リンク、タップで遷移
- 管理画面: プレビューでリンク表示
- ツールバー: 🔗記事リンク / 📂🔗カテゴリリンク ボタン
- SQL実行済み: 12記事に相互リンク追加

### 📱 スワイプバック対応 [完了]
- 記事間移動時にブラウザ履歴(pushState)に追加
- スマホのスワイプバックで前の記事に戻れる
- 記事一覧→ホームタブへのガード（ログインに飛ばない）
- 「← 前の記事名に戻る」ボタン + 「📋 一覧へ」ボタン

### 🤖 AIチャット全面改善 [完了]
**API改善:**
- マークダウン記法を使わないよう指示（丸数字①②③で手順表現）
- 記事リンク`[link:記事タイトル]`を回答に自動挿入
- セラピスト名で呼びかけ（「花世さん、精算の方法は〜」）
- 回答文字数300文字に拡大

**チャットUI改善:**
- 🤖アイコン付きAIバブル（LINEライク吹き出し）
- グラデーション送信ボタン
- 💭考え中アニメーション
- 🗑️会話クリアボタン
- サジェスト質問5つ（丸ボタン）
- onlineインジケーター

### 🔑 Anthropic API設定 [完了]
- Claude Console でAPIキー取得
- $5クレジット購入済み
- 月額$20制限 + $15通知設定
- Vercel環境変数 `ANTHROPIC_API_KEY` 設定済み

### 🎤 音声入力 [完了]
- マイクボタンでAIチャットに音声入力
- Web Speech API (ja-JP) 対応
- 録音中はピンク色パルスアニメーション
- プレースホルダー「🎤 話してください...」

### 📊 AI質問ログ [完了]
- `manual_ai_logs` テーブル作成済み
- 質問・回答・セラピスト名・日時を自動保存
- 管理画面に「🤖 AI質問ログ」ビュー追加
- 質問統計（総数/質問者数/直近日）
- 🔥よく聞かれるキーワード分析
- ログ一覧（質問者名/日時/Q&A表示）
- 全削除ボタン

### ⬆⬇ 記事並び替え [完了]
- 記事カードに⬆⬇ボタン追加
- sort_orderをスワップして並び替え
- カテゴリフィルタ中はカテゴリ内で並び替え

### 🆓 フリー枠 Phase 1 [完了]
**DB:**
- `reservations` テーブルに `free_building_id` カラム追加済み
- NULLの場合は通常の指名予約、値がある場合はフリー予約

**タイムチャート表示:**
- 建物ごとのフリー行を追加（青色テーマ、Fアイコン）
- フリー予約のブロック表示
- 重なりはサブロウで段積み表示（見落とし防止）
- フリー行の件数バッジ表示

**予約作成:**
- フリー行クリックで予約作成フォーム起動
- `free_building_id` を予約データに保存
- `therapist_id=0` でフリー枠として登録可能
- バリデーション修正（フリー枠対応）



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
[DECISION] マニュアル画像: Supabase Storage (manual-images バケット) + ドラッグ&ドロップ
[DECISION] マニュアル動画: YouTube埋め込み[youtube:ID] + Google Drive埋め込み[gdrive:ID:説明]
[DECISION] マニュアルAI: Claude API Sonnet使用（月$20制限）
[DECISION] マニュアルAIログ: 質問を自動保存→管理画面でキーワード分析→マニュアル改善に活用
[DECISION] 記事間リンク: [link:記事タイトル] / [catlink:カテゴリ名] でタップ遷移
[DECISION] Google Sites移行: 全32記事をSQL化してSupabaseに投入、画像は後から手動アップ
[DECISION] フリー枠: building別フリー行、therapist_id=0、free_building_idで管理、重なりはサブロウ段積み



## 次回セッション（㉘）の予定タスク

### 🆓 フリー枠 Phase 2（優先）
- 空き判定ロジック: その時間帯の出勤セラピスト数 vs 既存予約数を比較し、全員埋まっていたらフリー不可
- WEB予約のフリー対応: セラピストを選ばない「フリー」選択肢追加
- フリー予約のセラピスト割り当て: タイムチャートからフリー→セラピスト行にドラッグして割り当て
- フリー予約の通知: フリー予約が入った際のスタッフ通知

### その他候補タスク
- 📝 マニュアルクイズ機能（新人教育）
- 🌸 新人オンボーディングガイド
- 💬 接客シーン別アドバイスAI
- マニュアル画像の手動アップロード
- 記事の印刷/PDF出力



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
- `session26_full_migration.sql` — ★全32記事+8Q&Aの本番データ（実行済み）
- `session27_article_links.sql` — 記事間リンク追加（実行済み）
- `session27_ai_logs.sql` — AI質問ログテーブル（実行済み）
- `session27_free_slots.sql` — フリー枠カラム追加（実行済み）
