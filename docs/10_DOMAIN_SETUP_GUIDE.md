# 10. ドメイン設定手順書（Vercel + お名前.com）

> ⚠️ **このドキュメントは古い構成案(.com 想定)です**
> 最新の URL 構造・ドメイン設計は **`19_URL_STRUCTURE.md`** を参照してください。
> 2026-04-26 に新設計(`ange-spa.jp` ベース、3ドメイン構成)に変更されました。

> T-MANAGE / TERA-MANAGE / Ange Spa の独自ドメイン設定を実施するための手順書。
> スクリーンショットは付いていないが、画面の文言を引用する形で順に進めれば迷わない構成にしてある。
>
> 最終更新: 2026-04-24
> 関連: `08_MASTER_SYSTEM_DESIGN.md` 付録E.2

---

## 📋 作業の全体像

```
お名前.com（ドメイン管理）
    │
    │ ① DNSでVercelに向ける
    ▼
Vercel（ホスティング）
    │
    │ ② SSL自動発行
    ▼
https://ange-spa.com          → 新HP（お客様向け）
https://ange-spa.t-manage.jp  → T-MANAGE管理画面
https://admin.tera-manage.jp  → TERA-MANAGE マスター
https://*.t-manage.jp         → 将来のリゼクシー等
```

### 取得済みドメイン

| ドメイン | 用途 | 取得日 |
|---|---|---|
| `ange-spa.com` | Ange Spa 公開HP（既存・移行対象） | 取得済（既存）|
| `tera-manage.jp` | TERA-MANAGE マスター基盤 | 2026-04-24 |
| `t-manage.jp` | 各 T-MANAGE インスタンス基盤 | 2026-04-24 |

### 最終的な配置

| URL | 中身 |
|---|---|
| `https://ange-spa.com/` | 新HP（Next.js `app/(site)/*`） |
| `https://www.ange-spa.com/` | apex へリダイレクト |
| `https://ange-spa.t-manage.jp/` | T-MANAGE管理画面・マイページ |
| `https://admin.tera-manage.jp/` | TERA-MANAGE マスター管理画面 |
| `https://resexy.t-manage.jp/` | リゼクシー用（2027/1/1 稼働） |
| `https://{subdomain}.t-manage.jp/` | 将来のインスタンス |

### 所要時間の目安

| フェーズ | 作業時間 | DNS反映待ち |
|---|---|---|
| Phase 0: `.jp` 情報認証 | 5分 | - |
| Phase 1: Vercel追加 | 30分 | - |
| Phase 2: `.jp` DNS設定 | 20分 | 数時間〜最大48時間 |
| Phase 3: `ange-spa.com` DNS設定 | 30分 | 数時間〜最大48時間 |
| Phase 4: 動作確認 | 30分 | - |
| Phase 5: 拡張機能再インストール | 各PC 10分 | - |

---

## ⚠️ Phase 0: `.jp` ドメイン情報認証（最優先・期限あり）

`.jp` ドメインはJPRS（日本レジストリサービス）のルールにより、**登録から14日以内に登録者情報の認証メール内リンクをクリックしないと、ドメインが自動的に利用停止**になります。

### チェック手順

- [ ] お名前.com 登録メールアドレス宛の **2026/4/24 以降のメール**を確認
- [ ] 以下のようなタイトルのメールを探す：
  - 件名例: 「【重要】[ドメイン名] ドメイン登録者情報の確認(認証)」
  - 送信元例: `noreply@onamae.com` または `jprs-info@jprs.jp`
- [ ] **両方のドメインそれぞれにメール**が届いているので注意：
  - `tera-manage.jp` 用
  - `t-manage.jp` 用
- [ ] メール内のリンクをクリック → 認証画面で確認ボタンを押す

### 認証済みかどうかの確認方法

お名前.com Navi にログイン → 「**ドメイン一覧**」 → 対象ドメインの「**ドメイン情報認証**」欄を確認。

| 表示 | 意味 |
|---|---|
| 「認証済み」 | OK、作業続行可能 |
| 「未認証」 | ⚠️ 急いで認証メールを探す |
| 「認証期限切れ」 | 🚨 お名前.comサポートに連絡（回復可能な場合あり） |

### メールが見つからない場合

1. 迷惑メールフォルダを確認
2. お名前.com Navi → 「登録情報」→ 「連絡先メールアドレス」を確認
3. 再送信を依頼：お名前.com Navi → ドメイン一覧 → 「認証メール再送」

⛔ **この手順が完了するまで他の作業は進めないこと**。認証前にDNS設定しても、ドメイン停止時にすべてリセットされます。

---

## 🟢 Phase 1: Vercel 側の準備

### 1.1 Vercel Dashboard へログイン

- [ ] https://vercel.com/dashboard にアクセス
- [ ] `t-manage` プロジェクトを選択
- [ ] 左メニュー → **Settings** → **Domains**

### 1.2 追加するドメイン一覧

以下を **1つずつ** 追加していきます。追加順は任意ですが、**先に `.jp` ドメイン** を設定するとリスクが小さい（既存HPに影響しないため）。

| 優先順 | 追加するドメイン | 用途 |
|---|---|---|
| 1 | `t-manage.jp` | ルート（予約的に） |
| 2 | `tera-manage.jp` | ルート（予約的に） |
| 3 | `ange-spa.t-manage.jp` | T-MANAGE管理画面 |
| 4 | `admin.tera-manage.jp` | TERA-MANAGE マスター |
| 5 | `*.t-manage.jp` | ワイルドカード（将来用） |
| 6 | `ange-spa.com` | 新HP（要DNS切替注意） |
| 7 | `www.ange-spa.com` | wwwからapexへリダイレクト |

### 1.3 各ドメイン追加の操作（共通）

- [ ] Settings → Domains → **「Add Domain」** ボタン
- [ ] ドメイン名を入力 → **Add**
- [ ] Vercelが**必要なDNSレコード**を表示するので**画面のキャプチャを保存**しておく

**例: `ange-spa.t-manage.jp` 追加時の画面表示**
```
Set the following record on your DNS provider to continue:

Type    Name                    Value
CNAME   ange-spa                cname.vercel-dns.com
```

### 1.4 ワイルドカード `*.t-manage.jp` の注意

- [ ] ワイルドカード追加時、Vercelが **DNS 認証用の TXT レコード** を要求する場合あり
- [ ] 表示されたTXTレコードをメモ（例: `_vercel.t-manage.jp` → `vc-domain-verify=xxxxx`）
- [ ] これはSSL証明書発行のために必須

### 1.5 このフェーズのゴール

- [ ] 7件すべてのドメインがVercel側に「**Invalid Configuration**」または「**Pending**」状態で登録されている
- [ ] 各ドメインに対するDNSレコード（CNAME/A/TXT）の値を**控えてある**

> この時点では `Invalid` 表示でOKです。DNS設定が反映されると自動的に `Valid` に変わります。

---

## 🟡 Phase 2: `.jp` ドメインのDNS設定（方式A = ネームサーバー変更）

`.jp` ドメインは新規取得で既存の用途がないため、**ネームサーバーを Vercel に移す方式Aが最も楽**。

### 2.1 Vercelのネームサーバーを確認

- [ ] Vercel Dashboard → Settings → Domains で `t-manage.jp` を追加した状態
- [ ] 表示される Vercel ネームサーバーをメモ：
  ```
  ns1.vercel-dns.com
  ns2.vercel-dns.com
  ```
  ※ 正確な値はVercel画面から確認してください

### 2.2 お名前.comでネームサーバー変更（`t-manage.jp`）

- [ ] お名前.com Navi にログイン
- [ ] 「**ドメイン一覧**」→ `t-manage.jp` をクリック
- [ ] 「**ネームサーバーの変更**」タブ
- [ ] 「**その他のサービス**」を選択
- [ ] 「**その他のネームサーバーを使う**」
- [ ] プライマリ欄に `ns1.vercel-dns.com`
- [ ] セカンダリ欄に `ns2.vercel-dns.com`
- [ ] **確認画面** → **設定する**

### 2.3 `tera-manage.jp` も同じ手順

- [ ] お名前.com Navi → ドメイン一覧 → `tera-manage.jp` → ネームサーバー変更
- [ ] 上と同じ設定

### 2.4 反映待ち

- [ ] 数時間〜最大48時間待つ（通常は1時間以内）
- [ ] 反映確認コマンド（Windows PowerShell / Mac ターミナル）：
  ```
  nslookup -type=NS t-manage.jp
  ```
- [ ] 結果に `vercel-dns.com` が含まれればOK

### 2.5 Vercel側の状態確認

- [ ] 反映後、Vercel Dashboard → Domains
- [ ] `t-manage.jp` と `tera-manage.jp` が **Valid Configuration** (緑チェック) になる
- [ ] サブドメイン (`ange-spa.t-manage.jp` / `admin.tera-manage.jp` / `*.t-manage.jp`) もネームサーバー変更で自動的に有効化される

> ネームサーバーをVercelに向けた場合、以降の追加サブドメインはVercel側の設定だけで完結します。

---

## 🔴 Phase 3: `ange-spa.com` のDNS設定（方式B = レコード追加）

**⚠️ 最重要フェーズ。既存HP(Panda Web Concierge)が動いているため、切替タイミングとメール設定に注意。**

### 3.1 事前準備（切替前の確認事項）

#### 3.1.1 既存メールの有無を確認

- [ ] `info@ange-spa.com` などのメールアドレスを使っているか確認
- [ ] 使っている場合、**MXレコード**（メール送受信の設定）を絶対に消さないこと
- [ ] 現在のMXレコードを記録：
  - お名前.com Navi → `ange-spa.com` → DNSレコード設定 → MXレコードを全てコピー

#### 3.1.2 新HPの事前動作確認

- [ ] **先に Phase 2 を完了**しておく
- [ ] `https://ange-spa.t-manage.jp/` で新HP（`app/(site)/*`）が正しく表示されることを確認
- [ ] 各ページが開けるか確認：
  - [ ] `/` （TOP）
  - [ ] `/system` （料金システム）
  - [ ] `/therapist` （セラピスト一覧）
  - [ ] `/schedule` （スケジュール）
  - [ ] `/access` （アクセス）
  - [ ] `/recruit` （求人）
  - [ ] `/contact` （お問い合わせ）

#### 3.1.3 旧HPのバックアップ

- [ ] Panda Web Concierge の管理画面（pwc-admin）にログインできることを確認
- [ ] 万一の切り戻し用に、現在のHPの **スクリーンショット** を主要ページぶん取っておく
- [ ] 旧HPの**データは削除しない**（しばらく並行で残しておく）

### 3.2 Vercel側で必要なレコードを確認

Vercel Dashboard → Domains → `ange-spa.com` で表示される値。

典型的には以下（Vercel画面が正）：

| ホスト名 | TYPE | 値 | 用途 |
|---|---|---|---|
| @ (ルート) | A | `76.76.21.21` | apex |
| www | CNAME | `cname.vercel-dns.com` | www.ange-spa.com |

### 3.3 お名前.com 側での設定

- [ ] お名前.com Navi → 「**DNS**」→ `ange-spa.com` → 「**DNSレコード設定**」
- [ ] 「**次へ進む**」→ 「**DNSレコード設定を利用する**」→ 「**設定する**」

#### 3.3.1 既存Aレコード（旧HP）を削除

- [ ] ホスト名が空欄（@）の **Aレコード** を探す
- [ ] 右側の「**削除**」チェックボックスをON
- [ ] （まだ保存しない）

#### 3.3.2 新しいAレコード（Vercel向け）を追加

- [ ] 空欄行に以下を入力：
  - ホスト名: 空欄
  - TYPE: `A`
  - TTL: `3600`（または空欄でデフォルト）
  - VALUE: `76.76.21.21`（Vercel表示値）

#### 3.3.3 www用のCNAMEを追加

- [ ] 空欄行に以下を入力：
  - ホスト名: `www`
  - TYPE: `CNAME`
  - TTL: `3600`
  - VALUE: `cname.vercel-dns.com`（末尾ドット不要）

#### 3.3.4 既存MXレコードを確認

- [ ] 既存の MX レコードが **消えていないか** 確認
- [ ] メール使用中なら、MXレコードは一切触らない

#### 3.3.5 保存

- [ ] 画面下の「**確認画面へ進む**」→ 内容確認 → 「**設定する**」

### 3.4 反映確認

- [ ] 5分〜最大48時間待つ
- [ ] コマンド確認：
  ```
  nslookup ange-spa.com
  ```
- [ ] 結果が `76.76.21.21` を返せばOK
- [ ] 別端末・別ネットワーク（モバイル回線等）からもアクセス確認

### 3.5 切り戻し手順（万一新HPに問題があった場合）

- [ ] お名前.com Navi → `ange-spa.com` のDNSレコード設定
- [ ] 追加した Vercel 向けの A レコードを削除
- [ ] 元のAレコード（Panda Web Concierge のIP）を復元
- [ ] 反映後、旧HPが元通り表示される

---

## 🎨 Phase 4: SSL証明書の確認

Vercelが **Let's Encrypt** で自動発行します。手動設定不要。

### 4.1 自動発行の確認

- [ ] DNS反映後、**各ドメインに数分〜1時間以内**にSSLが自動発行される
- [ ] Vercel Dashboard → Domains → 各ドメインの状態が **Valid Configuration** で緑チェックになる
- [ ] ブラウザで `https://` でアクセスして **鍵マーク** が表示されればOK

### 4.2 発行されない場合のチェック

- [ ] DNS設定が正しく反映されているか再確認
- [ ] Vercel Dashboard で対象ドメインを **Remove** → 再 **Add**
- [ ] それでもダメなら24時間待つ（Let's Encryptのレート制限回避）

### 4.3 ワイルドカード（`*.t-manage.jp`）のSSL

- [ ] ワイルドカードSSLは **DNS-01 認証** が必要
- [ ] Vercelが指定するTXTレコード (`_acme-challenge.t-manage.jp`) を `t-manage.jp` のDNSに設定
- [ ] Phase 2でネームサーバーをVercelに向けた場合は**自動で処理されるため手動不要**

---

## ✅ Phase 5: 動作確認チェックリスト

DNS・SSLの設定がすべて完了したあとの最終チェック。

### 5.1 各URLにアクセス

| URL | 期待される内容 |
|---|---|
| `https://ange-spa.com/` | 新HP TOP（Next.js `app/(site)/page.tsx`） |
| `https://www.ange-spa.com/` | `ange-spa.com` にリダイレクトされる |
| `https://ange-spa.t-manage.jp/` | ログイン画面（`app/page.tsx` または `app/staff-login`） |
| `https://admin.tera-manage.jp/` | TERA-MANAGE管理画面（`app/tera-admin/*`） |

> ⚠️ 現状は middleware.ts が未実装のため、どのURLでアクセスしても同じ Next.js アプリが表示される。URLパス（`/dashboard`, `/tera-admin` 等）で画面が切り替わる。middleware.ts 導入（Phase 5 / 2026/12月予定）後にホスト別のルーティングが完成する。

### 5.2 管理画面の動作

- [ ] `https://ange-spa.t-manage.jp/` でスタッフPINログイン
- [ ] タイムチャート・HOME・営業締めが通常通り動作
- [ ] 資金管理ダッシュボードが動作
- [ ] セラピストマイページ（`/mypage`）ログインOK

### 5.3 セラピスト向けメッセージ確認

- [ ] タイムチャートから予約通知メッセージを生成
- [ ] 含まれるURLが `ange-spa.t-manage.jp/mypage/customer?name=xxx` になっているか確認
- [ ] 予約確認URLが `ange-spa.t-manage.jp/reservation-confirm?token=xxx` になっているか確認

### 5.4 メール確認（使っている場合のみ）

- [ ] `info@ange-spa.com` 宛に外部からテストメール送信
- [ ] 正常に届くか確認

### 5.5 Google OAuth 設定の更新

`/api/google-auth/callback` のリダイレクトURIがGoogle Cloud Console に登録されている場合、新URL追加が必要：

- [ ] https://console.cloud.google.com/apis/credentials にアクセス
- [ ] OAuth 2.0 クライアント ID を開く
- [ ] 「承認済みのリダイレクトURI」に以下を追加：
  - `https://ange-spa.t-manage.jp/api/google-auth/callback`
- [ ] 保存

---

## 🔌 Phase 6: 拡張機能の再インストール

ドメイン切替に伴い、Chrome / Edge 拡張機能の再インストールが必要。

### 6.1 リポジトリから最新取得

- [ ] GitHub から最新コード取得（T-MANAGE開発者のリポジトリpull）

### 6.2 Chrome 拡張の再読込

各スタッフPCで：

- [ ] `chrome://extensions/` を開く
- [ ] 「デベロッパーモード」ON
- [ ] 「T-MANAGE 通知アシスタント」の**削除**
- [ ] 「パッケージ化されていない拡張機能を読み込む」→ `chrome-extension/` フォルダを選択
- [ ] アイコンがツールバーに表示されればOK

### 6.3 Edge 拡張の再読込

各スタッフPCで：

- [ ] `edge://extensions/` を開く
- [ ] 「T-MANAGE SMS② 自動入力」の**削除**
- [ ] 「展開して読み込み」→ `edge-extension-sms/` フォルダを選択

### 6.4 エステ魂拡張の再読込

各スタッフPCで：

- [ ] `chrome://extensions/` を開く
- [ ] 「T-MANAGE エステ魂 自動投稿」の**削除**
- [ ] 「パッケージ化されていない拡張機能を読み込む」→ `estama-extension/` フォルダを選択

### 6.5 動作確認

- [ ] `https://ange-spa.t-manage.jp/` でタイムチャートから通知ボタン押下
- [ ] LINE / SMS / エステ魂への自動入力が動作するか確認

---

## 🆘 トラブルシューティング

### Q1. DNS設定したのに反映されない

- [ ] 設定後すぐは反映されないことがある（最大48時間）
- [ ] ブラウザキャッシュを削除
- [ ] DNS キャッシュをクリア：
  - Windows: `ipconfig /flushdns`
  - Mac: `sudo dscacheutil -flushcache`
- [ ] 別端末・別ネットワーク（モバイル回線）からアクセス確認
- [ ] `whatsmydns.net` でグローバルなDNS伝播状況を確認

### Q2. Vercel の Domains 画面が「Invalid Configuration」のまま

- [ ] DNSレコードの値が Vercel の指示と**完全一致**しているか確認
  - 特に CNAME の末尾ドット `.` の有無、大文字小文字
- [ ] TTL が長すぎる場合、Vercel 側で反映されるまで時間がかかる（TTLを 300 に下げると早い）
- [ ] 一度 Vercel 側で対象ドメインを **Remove** → **Add** し直す

### Q3. 新HPは表示されるのに管理画面で CORS エラー

- [ ] Supabase のプロジェクト設定を確認（通常は不要）
- [ ] Supabase Dashboard → Settings → API → **Additional CORS Allowed Origins** に以下を追加：
  - `https://ange-spa.t-manage.jp`
  - `https://ange-spa.com`（新HP）

### Q4. メールが届かなくなった

- [ ] お名前.com のDNS設定でMXレコードが残っているか確認
- [ ] ネームサーバーを変更した場合、MX も Vercel DNS に複写する必要あり
- [ ] 切り戻す場合は DNS 設定を元に戻す

### Q5. 既存HPに戻したい

- [ ] お名前.com → DNSレコード設定 → Vercel向けAレコードを削除
- [ ] 旧HP（Panda Web Concierge）向けのAレコードを復元
- [ ] 最大48時間で元に戻る

### Q6. `.jp` ドメインが突然使えなくなった

- [ ] ドメイン情報認証の期限切れの可能性大
- [ ] お名前.com Navi でドメイン状態確認
- [ ] お名前.comサポート（03-xxxx-xxxx）に電話

### Q7. SSL証明書が発行されない

- [ ] DNS 反映が先。DNSが有効化されてから最大24時間で自動発行
- [ ] Let's Encryptのレート制限（同ドメインで週20回まで）に引っかかっていないか
- [ ] Vercel で該当ドメインを Remove → Add し直す

---

## 📅 推奨実施スケジュール

### 即時（今週中）
- [x] ドメイン取得（2026-04-24 完了）
- [ ] **Phase 0**: `.jp` ドメイン情報認証（期限: 2026-05-08）

### 今月中（2026年4月末〜5月）
- [ ] **Phase 1**: Vercelドメイン追加
- [ ] **Phase 2**: `tera-manage.jp` / `t-manage.jp` のネームサーバー変更
- [ ] `ange-spa.t-manage.jp` で管理画面が動作することを確認

### 本番運用前（2026年5月末まで）
- [ ] **Phase 3**: `ange-spa.com` のDNS切替（**営業時間外を推奨**）
- [ ] **Phase 4**: SSL確認
- [ ] **Phase 5**: 動作確認
- [ ] **Phase 6**: 拡張機能再インストール
- [ ] Google OAuth リダイレクトURI追加

### 本番運用（2026年6月1日〜）
- [ ] 独自ドメイン体制で稼働開始

---

## 📝 作業後のチェック項目一覧

Phase全体を通した最終確認リスト。完了したらチェック。

- [ ] `.jp` ドメイン情報認証（期限厳守）
- [ ] Vercel に7ドメイン追加
- [ ] `tera-manage.jp` ネームサーバーがVercel
- [ ] `t-manage.jp` ネームサーバーがVercel
- [ ] `ange-spa.com` の A レコードがVercel（MXは既存維持）
- [ ] `www.ange-spa.com` がCNAMEでVercel
- [ ] 全URLでSSL有効（鍵マーク）
- [ ] `ange-spa.com` で新HP表示
- [ ] `ange-spa.t-manage.jp` で管理画面表示
- [ ] `admin.tera-manage.jp` で tera-admin表示
- [ ] セラピスト向けメッセージのURL更新確認
- [ ] Google OAuth リダイレクトURI更新
- [ ] 各PCでChrome拡張再インストール
- [ ] 各PCでEdge拡張再インストール
- [ ] 各PCでエステ魂拡張再インストール
- [ ] `info@ange-spa.com` 宛メール動作確認
- [ ] 旧 `t-manage.vercel.app` が現時点で使われていないか最終確認

---

## 🔗 関連リソース

- お名前.com Navi: https://navi.onamae.com/
- お名前.com ログインID: `75141796`
- Vercel Dashboard: https://vercel.com/dashboard
- Supabase Dashboard: https://supabase.com/dashboard/project/cbewozzdyjqmhzkxsjqo
- Google Cloud Console (OAuth): https://console.cloud.google.com/apis/credentials
- DNS 伝播チェック: https://www.whatsmydns.net/

## 📚 関連ドキュメント
- `08_MASTER_SYSTEM_DESIGN.md` — 全体設計（付録E.2 DNS設定）
- `09_SUPABASE_PRO_MIGRATION.md` — Supabase移行計画
- `00_README.md` — 全体索引

---

*初版: 2026-04-24*
