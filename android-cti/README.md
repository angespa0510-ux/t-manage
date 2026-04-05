# T-MANAGE CTI アプリ セットアップガイド

## 📋 概要
スマホへの着信時に、電話番号をSupabaseに送信 → PCのT-MANAGEに顧客情報をポップアップ表示する仕組みです。

---

## STEP 1: Android Studio インストール

### ① ダウンロード
1. ブラウザで以下を開く：
   **https://developer.android.com/studio**
2. 「Download Android Studio」ボタンをクリック
3. 利用規約に同意してダウンロード（約1.2GB）

### ② インストール
1. ダウンロードした `.exe` ファイルをダブルクリック
2. 「Next」を押していく（設定はすべてデフォルトでOK）
3. インストール先: `C:\Program Files\Android\Android Studio`（そのままでOK）
4. 「Android Virtual Device」にチェックが入っていなくてもOK（実機で使うため）
5. 「Install」→ 完了まで待つ

### ③ 初回起動（SDK自動ダウンロード）
1. Android Studio を起動
2. 「Do not import settings」→ OK
3. Setup Wizard が始まる → **Standard** を選択 → Next
4. テーマを選ぶ（どちらでもOK）→ Next
5. SDK のダウンロードが始まる（5〜10分）→ Finish

---

## STEP 2: プロジェクトを開く

### ① プロジェクトフォルダの場所
```
t-manage/android-cti/
```
GitHubからpull後、このフォルダがあります。

### ② 開き方
1. Android Studio のトップ画面で「Open」をクリック
2. `t-manage/android-cti` フォルダを選択 → OK
3. 「Trust Project?」→ Trust Project
4. Gradle Sync が自動で始まる（初回は3〜5分）

### ③ Supabase接続設定
`app/src/main/java/com/tmanage/cti/Config.kt` を開いて：
```kotlin
const val SUPABASE_URL = "https://xxxxxxxxxx.supabase.co"  // ← あなたのSupabase URL
const val SUPABASE_ANON_KEY = "eyJxxxxxxxxxx"              // ← あなたのAnon Key
```
T-MANAGEの `.env.local` にある値と同じものを入れてください。

---

## STEP 3: スマホにインストール

### ① スマホ側の準備（USBデバッグ有効化）
1. **設定** → **デバイス情報** → 「ビルド番号」を **7回連続タップ**
   → 「開発者モードになりました」と表示される
2. **設定** → **開発者向けオプション** → **USBデバッグ** を ON
3. PCとスマホをUSBケーブルで接続
4. スマホに「USBデバッグを許可しますか？」→ **許可**

### ② ビルド＆インストール
1. Android Studio の上部に接続したスマホ名が表示される
2. ▶（実行ボタン）をクリック
3. 自動でビルド → スマホにインストール → 起動

### ③ 権限の許可
アプリ起動後、以下の権限を全て「許可」してください：
- ✅ 電話の発信と管理
- ✅ 通話履歴の読み取り
- ✅ 通知の表示

### ④ バッテリー最適化を除外
1. スマホの **設定** → **アプリ** → **CTI Notifier**
2. **バッテリー** → **制限なし** を選択

---

## STEP 4: 使い方

1. アプリを開いて **「サービス開始」** をタップ
2. 通知バーに「📞 CTI監視中」が常時表示される
3. 着信があると自動でSupabaseに送信
4. PCのT-MANAGEに顧客情報がポップアップ！

### 確認方法
- アプリ画面に最新の着信ログが表示されます
- 別のスマホから電話をかけてテストできます

---

## トラブルシューティング

| 問題 | 解決方法 |
|------|----------|
| スマホが表示されない | USBケーブルを挿し直す。「USBデバッグ」がONか確認 |
| ビルドエラー | Android Studio → File → Sync Project with Gradle Files |
| 着信が検知されない | アプリの権限を全て許可しているか確認 |
| 再起動後に動かない | アプリを開いて「サービス開始」を再タップ |
| PCにポップアップが出ない | T-MANAGEをブラウザで開いた状態にしておく |
