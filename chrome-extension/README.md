# T-MANAGE 通知アシスタント v2.0

LINE Business Chat / Google Messages への自動入力Chrome拡張機能

## アーキテクチャ（S-MANAGE実績ベース）

### なぜ複雑なのか
- **chat.line.biz は Vue.js SPA** → 通常のDOMクリックでは遷移できない
- **メッセージ入力欄は Shadow DOM（textarea-ex）** → `querySelector('textarea')` では取得不可
- **Vue instance は MAIN world でしかアクセスできない**

### 3ファイルの役割分担

| ファイル | World | 役割 |
|---|---|---|
| `background.js` | Service Worker | LINEタブ検索・アカウント識別・MAIN world実行・SMS管理 |
| `content_line.js` | ISOLATED | 検索欄に名前入力・MAIN world依頼・完了通知受信 |
| `content_tmanage.js` | ISOLATED | 自動入力ボタン追加・LINE URL同期・名前/メッセージ抽出 |
| `content_sms.js` | ISOLATED | Google Messages検索・メッセージ入力 |

### 処理フロー（LINE自動入力）

```
【T-MANAGE】content_tmanage.js
  ↓ SEARCH_LINE_CUSTOMER / SEARCH_LINE_THERAPIST

【タブ探索・識別】background.js
  ↓ div.account-name で業務用/お客様用を判別
  ↓ PING → 応答なし → content_line.js 再インジェクト
  ↓ TYPE_IN_LINE_SEARCH

【検索欄入力】content_line.js（ISOLATED world）
  ↓ execCommand('insertText') で1文字ずつ入力
  ↓ 1500ms待機
  ↓ EXECUTE_IN_MAIN_WORLD

【Vue操作】background.js → MAIN world
  ↓ .list-group-item-chat → el.__vue__ → chatId取得
  ↓ router.push('/{accountId}/chat/{chatId}')
  ↓ 200msポーリング（チャット読み込み確認）
  ↓ textarea-ex → shadowRoot → textarea
  ↓ execCommand('insertText', false, template)
  ↓ CustomEvent('tmanage_success') 発火

【完了通知】content_line.js（ISOLATED world）
  ↓ CustomEvent受信 → インジケーター表示
```

## インストール

1. `chrome://extensions/` を開く
2. 「デベロッパーモード」をON
3. 「パッケージ化されていない拡張機能を読み込む」→ `chrome-extension/` フォルダを選択
4. T-MANAGEのシステム設定でLINE URLを設定

## 必要な権限

- `scripting` — MAIN worldでVue操作を実行するために必要
- `tabs` — LINEタブの検索・アクティブ化
- `clipboardWrite` — フォールバック時のテキストコピー
- `storage` — 保留メッセージ・LINE URL管理

## v1.0 → v2.0 変更点

- ❌ DOMクリックでチャット遷移 → ✅ Vue Router (`router.push()`)
- ❌ `querySelector('textarea')` → ✅ Shadow DOM突破 (`textarea-ex.shadowRoot`)
- ❌ `value` セットで検索 → ✅ `execCommand('insertText')` 1文字ずつ
- ❌ URL一致でアカウント判別 → ✅ `div.account-name` テキスト判別
- ❌ 直接メッセージ送信 → ✅ PING確認 + 再インジェクト機構
- ✅ MAIN world ↔ ISOLATED world のCustomEvent通信
- ✅ 名前マッチングスコアリング（完全一致 > 前方一致 > 部分一致）
