# 19. URL 構造・ドメイン分離仕様書

> **このドキュメントが最新です**。`10_DOMAIN_SETUP_GUIDE.md` には古い構成案(`ange-spa.com` 想定)が残っています — 設定や設計の参照は本書を優先してください。

最終更新: 2026-04-26
実装コミット: `feat/domain-separation` ブランチ

---

## 0. 設計の核心

T-MANAGE をマルチテナント SaaS として展開するため、URL を以下の階層関係で整理した:

| レイヤー | ドメイン | 役割 |
|---|---|---|
| 法人 | `tera-manage.jp` | TERA-MANAGE 法人ブランドサイト |
| 法人(管理) | `admin.tera-manage.jp` | SaaS 全体管理(運営者専用) |
| 製品 | `t-manage.jp` | T-MANAGE 製品紹介 LP |
| テナント(独自ドメインあり) | `ange-spa.jp` | アンジュスパ屋号 = 1号機 |
| テナント(独自ドメインなし) | `*.t-manage.jp` | 将来の他サロン用(例: `tanaka.t-manage.jp`) |

**「アンジュスパというお店が、T-MANAGE というシステムを使って運営されている。それを提供しているのが TERA-MANAGE」** という階層関係。

```
            tera-manage.jp(法人ブランド・運営本体)
            ├── 法人サイト(対外PR)
            └── admin.tera-manage.jp(SaaS全体管理)
                      │
                      ▼ 提供
            t-manage.jp(製品名・営業窓口LP)
                      │
                      ▼ 製品の実体は各屋号ドメインで稼働
            ┌─────────┴─────────┐
            ▼                   ▼
    ange-spa.jp           {tenant}.t-manage.jp(将来)
    (独自ドメインあり)     (独自ドメインなし)
    ├── /  公開HP          ├── /  公開HP
    ├── /mypage(お客様)    ├── /mypage(お客様)
    ├── /cast(セラピスト)  ├── /cast(セラピスト)
    └── /admin(管理画面)   └── /admin(管理画面)
```

---

## 1. ange-spa.jp のURL構造(独自ドメインありテナントの基本形)

### 公開エリア(誰でもアクセス可)

| URL | 内容 | 実装ファイル |
|---|---|---|
| `/` | HOME | `app/(site)/page.tsx` |
| `/schedule` | 本日の出勤 | `app/(site)/schedule/page.tsx` |
| `/therapist` | セラピスト一覧 | `app/(site)/therapist/page.tsx` |
| `/therapist/[id]` | セラピスト詳細 | `app/(site)/therapist/[id]/page.tsx` |
| `/diary` | 写メ日記 | `app/(site)/diary/page.tsx` |
| `/diary/[id]` | 日記詳細 | `app/(site)/diary/[id]/page.tsx` |
| `/diary/live/[streamId]` | ライブ配信視聴 | `app/(site)/diary/live/[streamId]/page.tsx` |
| `/system` | 料金・システム | `app/(site)/system/page.tsx` |
| `/access` | アクセス | `app/(site)/access/page.tsx` |
| `/contact` | お問い合わせ | `app/(site)/contact/page.tsx` |
| `/recruit` | 求人 | `app/(site)/recruit/page.tsx` |

### お客様エリア(顧客アカウントログイン)

| URL | 内容 | 実装ファイル |
|---|---|---|
| `/mypage` | お客様マイページ | `app/mypage/page.tsx` |
| `/reservation-confirm` | 予約確認(トークン認証) | `app/reservation-confirm/` |
| `/confirm-email` | メール確認 | `app/confirm-email/` |

### セラピストエリア(セラピストログイン)

| URL | 内容 | 実装ファイル |
|---|---|---|
| `/cast` | セラピストログイン+マイページ(8タブ) | `app/cast/page.tsx` |
| `/cast/tax-guide` | 副業バレ防止ガイド | `app/cast/tax-guide/` |
| `/cast/spouse-guide` | 配偶者控除ガイド | `app/cast/spouse-guide/` |
| `/cast/invoice-guide` | インボイス手取りシミュレーター | `app/cast/invoice-guide/` |
| `/cast/single-mother-guide` | シングルマザー向けガイド | `app/cast/single-mother-guide/` |
| `/cast/customer` | 顧客詳細 | `app/cast/customer/` |
| `/cast/live-broadcast` | ライブ配信(配信側) | `app/cast/live-broadcast/` |

### セラピスト書類提出(トークン認証・ログイン不要)

| URL | 内容 | 実装ファイル |
|---|---|---|
| `/contract-sign/[token]` | 業務委託契約書署名 | `app/contract-sign/[token]/` |
| `/license-upload/[token]` | 身分証アップロード | `app/license-upload/[token]/` |
| `/invoice-upload/[token]` | インボイス登録証 | `app/invoice-upload/[token]/` |
| `/mynumber-upload/[token]` | マイナンバー | `app/mynumber-upload/[token]/` |
| `/confirm-staff-email` | スタッフメール確認 | `app/confirm-staff-email/` |

### 管理エリア(スタッフ PIN ログイン)

| URL | 内容 | 実装ファイル |
|---|---|---|
| `/admin` | スタッフログイン | `app/staff-login/` (middleware で rewrite) |
| `/admin/dashboard` | HOME・営業締め | `app/dashboard/` (middleware で rewrite) |
| `/admin/timechart` | タイムチャート | `app/timechart/` |
| `/admin/expenses` | 経費管理 | `app/expenses/` |
| `/admin/cash-dashboard` | 資金管理(社長・経営責任者) | `app/cash-dashboard/` |
| `/admin/tax-portal` | 税理士ポータル(税理士) | `app/tax-portal/` |
| `/admin/tax-dashboard` | バックオフィス | `app/tax-dashboard/` |
| `/admin/staff` | スタッフ設定 | `app/staff/` |
| `/admin/staff-attendance` | スタッフ勤怠 | `app/staff-attendance/` |
| `/admin/therapists` | セラピスト登録 | `app/therapists/` |
| `/admin/shifts` | セラピスト勤怠 | `app/shifts/` |
| `/admin/courses` | コース登録 | `app/courses/` |
| `/admin/rooms` | 利用場所登録 | `app/rooms/` |
| `/admin/room-assignments` | 部屋割り管理 | `app/room-assignments/` |
| `/admin/manual` | マニュアル管理 | `app/manual/` |
| `/admin/operations-manual` | 操作マニュアル | `app/operations-manual/` |
| `/admin/notification-post` | 会員お知らせ投稿 | `app/notification-post/` |
| `/admin/therapist-notification-post` | セラピストお知らせ投稿 | `app/therapist-notification-post/` |
| `/admin/notification-dashboard` | 通知ダッシュボード | `app/notification-dashboard/` |
| `/admin/cti-monitor` | CTI 監視 | `app/cti-monitor/` |
| `/admin/contact-sync` | 電話番号バックアップ | `app/contact-sync/` |
| `/admin/camera` | カメラ・ロック管理 | `app/camera/` |
| `/admin/iot-settings` | IoT デバイス設定 | `app/iot-settings/` |
| `/admin/web-booking-settings` | WEB予約公開設定 | `app/web-booking-settings/` |
| `/admin/service-settings` | サービス設定 | `app/service-settings/` |
| `/admin/system-setup` | システム設定 | `app/system-setup/` |
| `/admin/video-generator` | AI 動画生成 | `app/video-generator/` |
| `/admin/analytics` | 売上分析 | `app/analytics/` |
| `/admin/marketing-analytics` | 集客分析 | `app/marketing-analytics/` |
| `/admin/sales` | 売上閲覧 | `app/sales/` |
| `/admin/inventory` | 棚卸管理 | `app/inventory/` |
| `/admin/diary-moderation` | 写メ日記管理 | `app/diary-moderation/` |
| `/admin/story-moderation` | ストーリー監視 | `app/story-moderation/` |
| `/admin/bluesky-admin` | Bluesky 連携 | `app/bluesky-admin/` |
| `/admin/live-admin` | ライブ配信管理 | `app/live-admin/` |
| `/admin/ekichika-settings` | 駅ちか設定 | `app/ekichika-settings/` |
| `/admin/hp-chatbot-admin` | HP チャットBOT | `app/hp-chatbot-admin/` |
| `/admin/hp-photos-admin` | HP 写真管理 | `app/hp-photos-admin/` |
| `/admin/chat` | チャット | `app/chat/` |
| `/admin/chat-insights` | チャット分析 | `app/chat-insights/` |
| `/admin/call-test` | 通話AI(社長・経営責任者) | `app/call-test/` |
| `/admin/call-assistant` | 通話アシスタント | `app/call-assistant/` |

> 注: 管理画面は **物理的にディレクトリ移動はしていない**。`middleware.ts` が `/admin/X` → `/X` を内部 rewrite している。URL バーには `/admin/X` が表示される。

### 拡張連携(ブリッジ)

| URL | 内容 |
|---|---|
| `/estama-bridge` | エステ魂拡張連携 |
| `/sms-bridge` | SMS 拡張連携 |

---

## 2. {tenant}.t-manage.jp(独自ドメインなしテナント)

ange-spa.jp と **完全に同じパス構造**。例: `tanaka.t-manage.jp/admin/dashboard`

middleware が `host` から `tenant` 名を抽出し、`x-tenant` ヘッダに設定して内部処理に渡す。
将来の DB クエリは `x-tenant` でフィルタリングする想定(現時点では未実装)。

---

## 3. tera-manage.jp(法人サイト)

| URL | 内容 | 内部 rewrite 先 |
|---|---|---|
| `/` | 法人 TOP | `/corporate` |
| `/products/ai` | AI ソリューション | `/corporate/products/ai` |
| `/products/dx` | DX 支援 | `/corporate/products/dx` |
| `/products/web` | Web 制作 | `/corporate/products/web` |
| `/news` | お知らせ | `/corporate/news` |
| `/careers` | 採用 | `/corporate/careers` |
| `/faq` | よくある質問 | `/corporate/faq` |
| `/privacy` | プライバシーポリシー | `/corporate/privacy` |
| `/legal` | 特定商取引法 | `/corporate/legal` |
| `/contact` | お問い合わせ | `/corporate/contact` |

---

## 4. admin.tera-manage.jp(SaaS 全体管理)

| URL | 内容 | 内部 rewrite 先 |
|---|---|---|
| `/` | ダッシュボード | `/tera-admin` |
| `/instances` | 店舗一覧 | `/tera-admin/instances` |
| `/instances/new` | 新規店舗発行 | `/tera-admin/instances/new` |
| `/url-structure` | URL 構成図 | `/tera-admin/url-structure` |
| `/updates` | 一斉配信 | `/tera-admin/updates` |
| `/stats` | 横断統計 | `/tera-admin/stats` |
| `/logs` | アクティビティログ | `/tera-admin/logs` |

---

## 5. t-manage.jp(製品紹介 LP)

| URL | 内容 |
|---|---|
| `/` | 製品 TOP |
| `/features` | 機能紹介(将来) |
| `/pricing` | 料金プラン(将来) |
| `/docs` | ドキュメント(将来) |
| `/contact` | 導入相談(将来) |

実装: `app/t-manage-lp/page.tsx` 配下。middleware が `t-manage.jp/X` → `/t-manage-lp/X` に rewrite。

---

## 6. middleware.ts の動作フロー

`middleware.ts` がすべてのリクエストを最初に受け、ホスト名で振り分ける。

```
リクエスト
  │
  ▼
host を判定
  │
  ├── ange-spa.jp
  │   ├── 旧URL(/dashboard等) → /admin/* に 301 リダイレクト
  │   ├── /admin/* → 内部で /* に rewrite
  │   └── その他はそのまま(公開HP・/cast・/mypage)
  │
  ├── tera-manage.jp
  │   └── /* → /corporate/* に rewrite
  │
  ├── admin.tera-manage.jp
  │   └── /* → /tera-admin/* に rewrite
  │
  ├── *.t-manage.jp(www. 除く)
  │   ├── x-tenant ヘッダにテナント名セット
  │   └── ange-spa.jp と同じ rewrite/redirect 適用
  │
  ├── t-manage.jp
  │   └── /* → /t-manage-lp/* に rewrite
  │
  └── その他(t-manage.vercel.app など)
      └── ange-spa.jp と同じ rewrite/redirect 適用(移行期暫定)
```

### 旧URL → 新URL の自動リダイレクト

middleware の `LEGACY_REDIRECTS` テーブルで定義:

```
/dashboard           → /admin/dashboard
/timechart           → /admin/timechart
/expenses            → /admin/expenses
/staff-login         → /admin
/customer-mypage     → /mypage
... (全約40の旧URLマッピング)
```

セラピスト用の旧 `/mypage` には注意:お客様マイページの新URLと衝突するため、自動リダイレクトしていない。セラピストには「新URLは `/cast` です」と告知が必要。

---

## 7. DNS 設定(お名前.com)

### ange-spa.jp

| ホスト名 | TYPE | VALUE |
|---|---|---|
| (空欄) | A | `76.76.21.21` |
| www | CNAME | `cname.vercel-dns.com.` |

### t-manage.jp(ワイルドカード対応)

| ホスト名 | TYPE | VALUE |
|---|---|---|
| (空欄) | A | `76.76.21.21` |
| www | CNAME | `cname.vercel-dns.com.` |
| `*` | CNAME | `cname.vercel-dns.com.` |

### tera-manage.jp

| ホスト名 | TYPE | VALUE |
|---|---|---|
| (空欄) | A | `76.76.21.21` |
| www | CNAME | `cname.vercel-dns.com.` |
| admin | CNAME | `cname.vercel-dns.com.` |

---

## 8. Vercel 側の設定

Vercel ダッシュボード → t-manage プロジェクト → Settings → Domains で以下を追加:

```
ange-spa.jp
www.ange-spa.jp(redirect to apex)
t-manage.jp
www.t-manage.jp(redirect to apex)
tera-manage.jp
www.tera-manage.jp(redirect to apex)
admin.tera-manage.jp
```

ワイルドカード `*.t-manage.jp` は Vercel Pro 以上で対応。Hobby プランの場合は、テナント追加ごとに `tanaka.t-manage.jp` を1つずつ手動追加。

---

## 9. ファイル移動の履歴(Phase 1 移行コミット)

```
git mv app/mypage app/cast              セラピスト用マイページ
git mv app/customer-mypage app/mypage   お客様マイページ
git mv public/mypage public/cast        セラピストアセット
```

それ以外の30+ 管理ページは物理移動せず、middleware で URL を仮想的に振り分け。
これにより `router.push("/timechart")` のような既存コードもLEGACY_REDIRECTSで自動転送される。

---

## 10. 今後の拡張計画

### Phase 2(2026年6月以降):tera-manage.jp 法人サイト本格化
- `app/corporate/` を `app/(tera-manage-corp)/` に移動して整理
- 製品LP(`t-manage.jp`)のコンテンツ拡充

### Phase 3(2026年8月以降):tenants テーブル設計
- `tenants` マスターテーブル新設
- 各種データテーブルに `tenant_id` カラム追加
- middleware の `x-tenant` ヘッダを各 API・クエリで参照

### Phase 4(2027年1月):リゼクシー導入
- まず `resexy.t-manage.jp` で稼働開始
- 必要に応じて独自ドメイン(`resexy.info` 等)に切り替え

---

## 11. 関連ドキュメント

- `00_README.md` — 索引
- `02_FEATURES.md` — 機能詳細(URL は本書の構造に追従要)
- `08_MASTER_SYSTEM_DESIGN.md` — TERA-MANAGE マスター設計
- `10_DOMAIN_SETUP_GUIDE.md` — **古い構成案(.com)あり、本書を優先**
- `middleware.ts` — 実装本体
- `app/tera-admin/url-structure/page.tsx` — admin.tera-manage.jp 内の可視化ページ
