# T-MANAGE 通知アシスタント Chrome拡張

T-MANAGEの予約確認通知をLINE / SMS に自動入力するChrome拡張です。

## インストール方法

1. Chromeで `chrome://extensions` を開く
2. 右上の「デベロッパーモード」をON
3. 「パッケージ化されていない拡張機能を読み込む」をクリック
4. `chrome-extension` フォルダを選択

## 使い方

### 基本フロー
1. T-MANAGEのタイムチャートで予約通知ポップアップを開く
2. 「🚀 LINE自動入力」or「🚀 SMS自動入力」ボタンをクリック
3. LINE Business / Google Messages が自動で開き、メッセージが入力される
4. 内容を確認して送信ボタンを押す

### 対応サービス
| サービス | URL | 用途 |
|---------|-----|------|
| LINE Business Chat | chat.line.biz | セラピスト/お客様向けLINE通知 |
| Google Messages | messages.google.com | SMS送信 |

### LINE業務アカウント
- アカウント名に「業務」が含まれる → スタッフ向け
- 含まれない → お客様向け

### ポップアップ
拡張アイコンをクリックすると、接続状態・保留メッセージ・クイックアクションが表示されます。

## ファイル構成
```
chrome-extension/
├── manifest.json        # Manifest V3
├── background.js        # バックグラウンドサービスワーカー
├── content_tmanage.js   # T-MANAGE用（自動入力ボタン追加）
├── content_line.js      # LINE Business Chat用（メッセージ自動入力）
├── content_sms.js       # Google Messages用（SMS自動入力）
├── popup.html           # 拡張ポップアップUI
├── popup.js             # ポップアップロジック
├── icon16.png           # アイコン 16x16
├── icon48.png           # アイコン 48x48
└── icon128.png          # アイコン 128x128
```

## 注意事項
- LINE Business / Google Messagesの仕様変更により自動入力が動作しなくなる場合があります
- セレクタが変更された場合は `content_line.js` / `content_sms.js` のセレクタを更新してください
- 自動入力後は必ず内容を確認してから送信してください
