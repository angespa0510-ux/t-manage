# 10. ドメイン移行・URL一元管理（2026-04-24）

> お名前.com で取得した独自ドメインを Vercel に向け、
> コード内のハードコーディングURLを整理した作業記録。

---

## 1. 完了した作業

### 1.1 ドメイン取得・設定

| ドメイン | 取得日 | ネームサーバー | 用途 |
|---|---|---|---|
| `tera-manage.jp` | 2026-04-24 | `ns1.vercel-dns.com` / `ns2.vercel-dns.com` | TERA-MANAGE マスター |
| `t-manage.jp` | 2026-04-24 | `ns1.vercel-dns.com` / `ns2.vercel-dns.com` | T-MANAGE 各インスタンス |

### 1.2 Vercel ドメイン追加

| ドメイン | 用途 |
|---|---|
| `ange-spa.t-manage.jp` | T-MANAGE 管理画面・マイページ |
| `admin.tera-manage.jp` | TERA-MANAGE マスター管理 |
| `*.t-manage.jp` | ワイルドカード（将来のインスタンス用） |
| `tera-manage.jp` | ルート（予約・www.に307リダイレクト） |
| `www.tera-manage.jp` | www付き |
| `t-manage.jp` | ルート（予約・www.に307リダイレクト） |
| `www.t-manage.jp` | www付き |

⚠️ **`ange-spa.com`（公開HP）はまだVercelに切替えていない**。
既存HP（Panda Web Concierge）と既存メールを保護するため、新HP準備完了後にDNSを移行する。

### 1.3 URL一元管理ライブラリ新設

- `lib/site-urls.ts` を新規作成
- 公開HP・T-MANAGE管理画面・TERA-MANAGE の URL 定数を集約
- よく使う絶対URLのヘルパー関数（`customerMypageUrl`, `reservationConfirmUrl` 等）

---

## 2. URL 全体像

```
┌─────────────────────────────────────────────────────┐
│ 公開HP                                                 │
│ https://ange-spa.com/                                 │
│   app/(site)/* が配信                                 │
│   ※現時点ではまだ既存HP（Panda Web Concierge）が動作中 │
└─────────────────────────────────────────────────────┘
                    ↓ 認証 / 予約
┌─────────────────────────────────────────────────────┐
│ T-MANAGE 管理画面 + マイページ                         │
│ https://ange-spa.t-manage.jp/                         │
│   /dashboard, /timechart, /mypage 等                  │
│   スタッフ・セラピスト・お客様 向け                    │
└─────────────────────────────────────────────────────┘
                    ↓ マスター管理
┌─────────────────────────────────────────────────────┐
│ TERA-MANAGE マスター                                   │
│ https://admin.tera-manage.jp/                         │
│   /tera-admin/* にリライト予定                        │
└─────────────────────────────────────────────────────┘
                    ↓ 将来のインスタンス
┌─────────────────────────────────────────────────────┐
│ リゼクシー T-MANAGE（2027/1/1 稼働予定）               │
│ https://resexy.t-manage.jp/                           │
└─────────────────────────────────────────────────────┘
```

---

## 3. コード修正箇所

### 3.1 新規作成

- `lib/site-urls.ts` — URL 定数・ヘルパー集約

### 3.2 修正ファイル

#### アプリ層（URL置換）
- `app/layout.tsx` — `metadataBase` 追加
- `app/robots.ts` — `ange-spa.com` 基準に書き換え、disallow リスト拡充
- `app/sitemap.ts` — `ange-spa.com` 基準に書き換え
- `app/timechart/page.tsx` — 4箇所のハードコードURLを `customerMypageUrl()` / `TMANAGE_URL` に
- `app/service-settings/page.tsx` — サンプルURLを `customerMypageUrl()` に
- `app/system-setup/page.tsx` — 3箇所を `TMANAGE_URL` / ドメイン名に修正
- `app/contact-sync/page.tsx` — OAuthコールバックURLプレースホルダを修正

#### ブラウザ拡張（完全切替：新URLのみ）
- `chrome-extension/manifest.json` → v2.2.0、host_permissions を `ange-spa.t-manage.jp` に
- `chrome-extension/popup.js` — タブ検出の URL を `ange-spa.t-manage.jp` に
- `edge-extension-sms/manifest.json` → v1.1.0、同上
- `estama-extension/manifest.json` → v2.4.0、同上
- `estama-extension/content-bridge.js` — コメント修正

#### Phase C（コード品質改善）
- `app/api/hp-chatbot/route.ts` — `claude-sonnet-4-5` → `claude-sonnet-4-6`
- `app/api/chat-ai/route.ts` — 同上
- `app/api/chat-insights-batch/route.ts` — 同上
- `app/api/tax-ai/route.ts` — Supabase Anon Key ハードコード削除
- `app/api/manual-ai/route.ts` — 同上
- `app/api/password-reset/route.ts` — 同上
- `app/api/deliver-email/route.ts` — 同上

---

## 4. 運用上の注意

### 4.1 ブラウザ拡張の更新

**社内全PCで拡張機能の再読み込みが必要。**

各拡張機能は`host_permissions`に新URL（`ange-spa.t-manage.jp`）のみを指定したため、旧URL（`t-manage.vercel.app`）では動作しない。

#### 手順（各PC）

1. Chrome: `chrome://extensions/` を開く
2. 「**T-MANAGE 通知アシスタント**」の 🔄 **更新ボタン**をクリック
3. 同様に Edge: `edge://extensions/` で「**T-MANAGE SMS② 自動入力**」を更新
4. エステ魂拡張も同様

### 4.2 ange-spa.com の扱い

**現時点では何もしない。** 既存HP・既存メールが動作し続ける。

新HPの切替タイミング:
1. `ange-spa.t-manage.jp/` で新HP（`app/(site)/*`）の動作確認
2. 問題なければ `ange-spa.com` のDNS設定を変更してVercelに向ける
3. メール（MXレコード）は既存のまま維持

### 4.3 Vercel の旧URL（`t-manage.vercel.app`）

Vercelは `t-manage.vercel.app` も引き続き有効にしている。
移行確認後、Vercel設定の「Domains」から削除可能。

---

## 5. 残タスク

### Phase A 続き
- [ ] Vercelでの反映確認（Valid Configuration ✅ になるのを確認）
- [ ] ブラウザで `https://ange-spa.t-manage.jp/` アクセス確認
- [ ] ブラウザで `https://admin.tera-manage.jp/tera-admin` アクセス確認

### Phase B（今後実施）
- [ ] `ange-spa.com` の DNS を Vercel 向けに変更（新HP完成後）
- [ ] `middleware.ts` 実装（サブドメインベースのインスタンス解決）
- [ ] メール（MX）設定の確認・移行

### Phase C（完了）
- [x] Claudeモデル統一
- [x] Supabase Anon Key ハードコード削除

---

## 6. 参考情報

- 設計書: `docs/08_MASTER_SYSTEM_DESIGN.md`
- Supabase Pro 移行: `docs/09_SUPABASE_PRO_MIGRATION.md`
- URL 定数: `lib/site-urls.ts`

---

*作業日: 2026-04-24*
*作業者: Claude Opus 4.7*
