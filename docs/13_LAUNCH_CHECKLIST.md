# 13. 新HP（ange-spa.jp）動作確認チェックリスト

> DNS反映完了後に行う、新HPの動作確認手順。
> 本番運用開始前に必ず実施。

**作成日**: 2026-04-24
**対象URL**: https://ange-spa.jp/
**前提**: Vercel設定完了、お名前.comネームサーバー切替済み

---

## 🎯 基本動作確認（優先度 ⭐⭐⭐）

### 1. ドメインアクセス

| 項目 | URL | 期待結果 | 状態 |
|---|---|---|---|
| apex HTTPS | https://ange-spa.jp/ | ✅ 新HPトップページ表示 | ☐ |
| www付き HTTPS | https://www.ange-spa.jp/ | ✅ ange-spa.jp にリダイレクト | ☐ |
| apex HTTP | http://ange-spa.jp/ | ✅ HTTPSに自動切替 | ☐ |
| www付き HTTP | http://www.ange-spa.jp/ | ✅ HTTPSに自動切替 | ☐ |

**シークレットモードで確認することを強く推奨**（キャッシュ回避）

### 2. SSL/TLS証明書

| 項目 | 期待結果 | 状態 |
|---|---|---|
| ブラウザの鍵マーク表示 | ✅ 緑 or 鍵マーク | ☐ |
| 警告なし | ✅ 「保護されていない通信」が出ない | ☐ |
| 発行元 | ✅ Let's Encrypt（Vercel自動） | ☐ |
| 有効期限 | ✅ 3ヶ月後以降 | ☐ |

### 3. 主要ページアクセス

| ページ | URL | 状態 |
|---|---|---|
| トップ | / | ☐ |
| サービス | /system | ☐ |
| セラピスト一覧 | /therapist | ☐ |
| スケジュール | /schedule | ☐ |
| アクセス | /access | ☐ |
| 採用情報 | /recruit | ☐ |
| お問い合わせ | /contact | ☐ |

---

## 🔗 T-MANAGE連携確認（優先度 ⭐⭐⭐）

### 1. 管理画面アクセス

| 項目 | URL | 期待結果 | 状態 |
|---|---|---|---|
| T-MANAGE ログイン | https://ange-spa.t-manage.jp/ | ✅ ログイン画面表示 | ☐ |
| スタッフログイン | (同上) | ✅ 正常ログイン | ☐ |
| ダッシュボード | /dashboard | ✅ 表示 | ☐ |
| タイムチャート | /timechart | ✅ 表示 | ☐ |
| 税理士ポータル | /tax-portal | ✅ 表示 | ☐ |

### 2. 顧客マイページ

```
URL例: https://ange-spa.t-manage.jp/mypage/{token}

確認:
  ☐ LINE経由でマイページリンクが届く
  ☐ トークン付きURLでログイン可能
  ☐ 予約履歴が表示される
  ☐ 新規予約ができる
```

### 3. セラピストマイページ

```
URL: https://ange-spa.t-manage.jp/mypage-therapist/{token}

確認:
  ☐ セラピスト個別URLでログイン可能
  ☐ 出勤予定編集ができる
  ☐ 給与明細が表示される
  ☐ 支払調書PDF出力できる
```

---

## 📊 SEO・メタデータ確認（優先度 ⭐⭐）

### 1. robots.txt

```
URL: https://ange-spa.jp/robots.txt

期待内容:
  User-agent: *
  Allow: /
  Disallow: /dashboard
  Disallow: /timechart
  ...
  
  Sitemap: https://ange-spa.jp/sitemap.xml
  
☐ 確認済み
```

### 2. sitemap.xml

```
URL: https://ange-spa.jp/sitemap.xml

期待内容:
  公開HPの主要URLが列挙されている
  すべてのURLが ange-spa.jp ベース
  
☐ 確認済み
```

### 3. OGP（SNSシェア時のプレビュー）

**確認ツール**: https://www.opengraph.xyz/

| ソース | 期待値 | 状態 |
|---|---|---|
| og:title | Ange Spa / アンジュスパ | ☐ |
| og:description | （サイト説明） | ☐ |
| og:image | アンジュスパのロゴ or メイン画像 | ☐ |
| og:url | https://ange-spa.jp | ☐ |

### 4. Google Search Console

```
作業:
  ☐ Search Console に ange-spa.jp を新規プロパティ追加
  ☐ DNS TXT または HTMLタグで所有権確認
  ☐ sitemap.xml を送信
  ☐ インデックス登録をリクエスト
```

---

## 🔒 セキュリティ確認（優先度 ⭐⭐）

### 1. HTTPSリダイレクト

```
☐ http:// で始まるURLはすべて https:// に自動リダイレクト
☐ HSTS（HTTP Strict Transport Security）有効
```

### 2. セキュリティヘッダー

**確認ツール**: https://securityheaders.com/

| ヘッダー | 推奨値 | 状態 |
|---|---|---|
| Strict-Transport-Security | 有効 | ☐ |
| X-Content-Type-Options | nosniff | ☐ |
| X-Frame-Options | DENY または SAMEORIGIN | ☐ |
| Content-Security-Policy | 設定あり | ☐ |

### 3. 認証系の動作

```
☐ ログインセッションが正常に維持される
☐ ログアウトが正常に動作する
☐ パスワードリセットメールが届く
  - 送信元は正しいか
  - リンクURLは ange-spa.t-manage.jp か
```

---

## 📱 モバイル対応確認（優先度 ⭐⭐）

### 1. レスポンシブデザイン

| デバイス | 画面幅 | 状態 |
|---|---|---|
| iPhone SE | 375px | ☐ |
| iPhone 15 Pro | 393px | ☐ |
| iPad | 768px | ☐ |
| デスクトップ | 1920px | ☐ |

### 2. タッチ操作

```
☐ ボタンがタップしやすい（44px以上）
☐ フォーム入力がしやすい
☐ スクロールがスムーズ
☐ 画像がタップでズーム可能（必要な箇所）
```

### 3. PWA（必要なら）

```
☐ manifest.json が正常
☐ ホーム画面追加が動作
☐ オフラインキャッシュが効く
```

---

## ⚡ パフォーマンス確認（優先度 ⭐）

### 1. Google PageSpeed Insights

**URL**: https://pagespeed.web.dev/

```
測定対象: https://ange-spa.jp/

目標値:
  Performance:    80以上
  Accessibility:  90以上
  Best Practices: 90以上
  SEO:            95以上

☐ デスクトップ測定
☐ モバイル測定
```

### 2. 読み込み速度

```
☐ トップページが3秒以内に表示
☐ 画像が段階的に読み込まれる（lazy load）
☐ JavaScript実行がブロックしない
```

### 3. 画像最適化

```
☐ マーブル背景タイルは軽量WebP
☐ セラピスト写真は適切なサイズ
☐ アイコンはSVG形式
```

---

## 📧 メール・連絡機能確認（優先度 ⭐⭐）

### 1. お問い合わせフォーム

```
☐ /contact でフォームが表示される
☐ 必須項目チェックが動作
☐ 送信ボタンが反応する
☐ 送信後、管理者にメール通知が届く
☐ 送信者に自動返信メールが届く
```

### 2. メールアドレス

```
現状:
  info@ange-spa.com  ← 旧業者経由、動作確認必要
  
新規運用時:
  info@ange-spa.jp   ← Cloudflare Email Routing or Google Workspace
```

---

## 🤖 拡張機能連携確認（優先度 ⭐⭐⭐）

### 1. Chrome拡張機能

```
対象: T-MANAGE 連携拡張 v2.2.0

☐ 拡張機能アイコンをクリック → ポップアップ表示
☐ 「連携中」表示
☐ CTIポップアップが ange-spa.t-manage.jp から読み込まれる
☐ 通話履歴が管理画面に反映される
```

### 2. Edge拡張機能

```
対象: T-MANAGE SMS拡張 v1.1.0

☐ SMS送信ページで拡張機能アイコン表示
☐ 自動送信機能が動作
☐ 送信履歴が管理画面に反映
```

### 3. エステ魂拡張

```
対象: T-MANAGE エステ魂拡張 v2.4.0

☐ エステ魂の予約情報が ange-spa.t-manage.jp に同期
☐ 自動取得が動作
```

---

## 🎊 最終確認（本番稼働前）

### 全体テスト

```
☐ スタッフ代表が1日実運用
☐ セラピスト代表が1日実運用
☐ 顧客体験テスト（予約〜施術〜決済まで）
☐ 経理処理1日分の入力テスト
☐ 税理士さんへの提出テスト
```

### データ整合性

```
☐ 既存顧客データが正常
☐ 予約履歴が正常
☐ セラピスト情報が正常
☐ 給与計算が正確
```

### バックアップ体制

```
☐ Supabase 日次バックアップ有効
☐ GitHub リポジトリバックアップ（自動）
☐ 緊急時ロールバック手順の確認
```

---

## 🚨 トラブル時の対応

### ケース1: DNS反映されない

```
対処:
  1. 1時間待つ（通常15分〜1時間）
  2. お名前.comで ns1.vercel-dns.com が反映されているか確認
  3. 別PCやスマホ回線から確認（別DNSキャッシュ）
  4. Cloudflare 1.1.1.1 で whois 確認
```

### ケース2: 「このサイトにアクセスできません」

```
原因: DNS切替中の一時的エラー
対処:
  1. 15分待って再アクセス
  2. シークレットモードで確認
  3. ブラウザキャッシュクリア
  4. DNSキャッシュクリア（ipconfig /flushdns）
```

### ケース3: 証明書エラー

```
原因: Vercel の SSL 発行待ち
対処:
  1. Vercel Dashboard で該当ドメインの状態確認
  2. 「Valid Configuration」になるまで待つ（通常5分〜30分）
  3. 変化がなければ Vercel に問い合わせ
```

### ケース4: 機能が動かない

```
原因: コードバグ or 環境変数未設定
対処:
  1. Vercel Dashboard → Functions → ログ確認
  2. 該当APIのエラーメッセージ確認
  3. 環境変数が production 環境に設定されているか確認
```

---

## 📝 確認完了報告フォーマット

```
【ange-spa.jp 動作確認報告】

実施日: 2026/ / 
実施者: 
環境: 
  ☐ デスクトップ（Chrome）
  ☐ デスクトップ（Edge）
  ☐ iPhone（Safari）
  ☐ Android（Chrome）

結果:
  基本動作:      ✅ / ⚠️ / ❌
  T-MANAGE連携:  ✅ / ⚠️ / ❌
  SEO/メタデータ: ✅ / ⚠️ / ❌
  セキュリティ:   ✅ / ⚠️ / ❌
  モバイル対応:   ✅ / ⚠️ / ❌
  パフォーマンス: ✅ / ⚠️ / ❌
  拡張機能:       ✅ / ⚠️ / ❌

発見した問題:
  1. 
  2. 

総合判定: 🟢 本番稼働可 / 🟡 要修正 / 🔴 不可
```

---

## 改訂履歴

- 2026-04-24: 初版作成（ange-spa.jp 取得完了時）
