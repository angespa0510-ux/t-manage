# 08. TERA-MANAGE / T-MANAGE 設計書

> **このドキュメントは設計確定版である**
> リゼクシーヒアリング完了、税理士確定、出張対応方針確定を経て、全項目確定。実装判断可能。

---

## 本設計書の前提

| 項目 | 決定内容 |
|---|---|
| 実装開始時期 | 2026/6/1 チョップ本番運用後、1〜2ヶ月の安定確認を経て Phase 2 着手 |
| 初期展開 | **チョップ（自社）→ リゼクシー（グループ内2号）を年内稼働** |
| 実装戦略 | **選択肢B: 最小TERA-MANAGE方式**（発行フローは最小限、フル機能管理画面は Phase 7 以降） |
| 将来展開 | RESEXY GROUP 全店舗 → グループ外への外販 |

---

## 1. 命名体系の定義

### 1.1 プロダクト階層

```
TERA-MANAGE（SaaSプラットフォーム）
  admin.tera-manage.jp
  │
  ├─ T-MANAGE インスタンス #1: チョップ
  │     ange-spa.t-manage.jp
  │
  ├─ T-MANAGE インスタンス #2: リゼクシー
  │     resexy.t-manage.jp ⭐ 年内稼働目標
  │
  └─ T-MANAGE インスタンス #N: 将来展開
        {subdomain}.t-manage.jp
```

### 1.2 ドメイン設計 ⭐

**2ドメイン構成**:
- `tera-manage.jp` … マスターシステム・運営側ドメイン（管理画面）
- `t-manage.jp` … 各インスタンスのサブドメインベースドメイン

⚠️ **即実施推奨**: 両ドメインの whois 確認・取得。将来の重要資産のため早期押さえが必要。

### 1.3 用語定義

| 用語 | 定義 |
|---|---|
| TERA-MANAGE | SaaSプラットフォーム全体 |
| TERA-MANAGE管理画面 | `admin.tera-manage.jp` |
| T-MANAGE | 1店舗に提供されるパッケージ製品 |
| T-MANAGE インスタンス | 個別発行されたT-MANAGEの実体 |
| インスタンスオーナー | 店舗側の責任者 |
| RESEXY GROUP | 既存の運営グループ（リゼクシー・アンジュスパ他） |

---

## 2. 決定済みの論点（全確定）

| # | 論点 | 決定 |
|---|---|---|
| A | インスタンスの単位 | 自由設定 |
| B | 顧客データ | 完全分離 |
| C | セラピスト | 分離 |
| D | 資金管理 | 完全分離（ただし構成は可変） |
| E | 1法人で複数インスタンス | OK |
| F | 税務合算 | Phase F 以降 |
| G | 初期リリース | 1インスタンスずつ順次 |
| H | 既存HP引用 | 3モード全対応（リゼクシーは不使用） |
| I | モジュール構成 | 3層構造 |
| J | 税務モジュール | 1つに統合 |
| K | 認証方式 | PIN認証継続 |
| L | 独自ロジック汎用化 | 必要（資金管理・カード手数料等） |
| M | ドメイン設計 | **2ドメイン**（tera-manage.jp + t-manage.jp） |
| N | リゼクシー導入時期 | **年内（2026年12月末）** |
| O | 実装戦略 | **選択肢B: 最小TERA-MANAGE方式** |
| P | リゼクシー顧問税理士 | **江坂瑠衣先生**（チョップと同じ）⭐ |
| Q | 出張対応の実装方法 | **コース追加で対応**（例: 「出張90分コース」）⭐ |

---

## 3. 想定ユースケース

### 3.1 ケース1: チョップ（自社運用・1号）

- **屋号**: アンジュスパ
- **法人**: 合同会社テラスライフ（3月決算）
- **運用形態**: 自社運用
- **既存HP**: あり → T-MANAGEで新HP生成
- **サブドメイン**: `ange-spa.t-manage.jp`
- **開始時期**: 2026/6/1
- **モジュール**: Full（全モジュールON）

### 3.2 ケース2: リゼクシー（グループ内2号） ⭐ 全項目確定

```
■ 運営
  屋号: RESEXY〜リゼクシー
  法人: 合同会社ライフテラス（9月決算）
  契約: 無償（グループ内2号、実証事例）
  税理士: 江坂瑠衣先生（チョップと同じ）⭐

■ 規模
  セラピスト: 100名以上 ⭐ 大規模

■ サブドメイン: resexy.t-manage.jp

■ HP
  方針: T-MANAGEで新規作成（完全置換）
  既存HP（resexy.info）: 移行時にDNS切替予定
  駅ちか等の外部ポータル: 連携終了

■ セラピスト
  契約形態: 業務委託（個人事業主）一律
  源泉徴収: セラピスト個別ON/OFF（204条1項6号）
  インボイス: セラピスト個別ON/OFF

■ 出張対応
  実装方法: コース追加で対応 ⭐
    例: 「通常60分コース」「出張60分コース」「出張90分コース」
    移動時間はスタッフが現場で考慮（システムでは特別管理しない）
    → 新規モジュール不要、既存のコース管理機能で完結

■ 資金管理
  方式: シンプル（事務所一元・当日締め・翌日持ち越しなし）
  金庫: 事務所のみ1つ
  予備金制度: なし

■ 決済手数料
  クレジットカード: 10%
  PayPay: 10% ⭐ チョップと異なる
  LINE Pay: 10%
  現金: 0%

■ 顧客管理
  既存システムからのデータ移行: なし（新規やり直し）
  会員登録・ポイント・メルマガ: すべてT-MANAGEで再構築

■ 予約・電話
  予約チャネル: 電話（メイン）+ WEB予約 + LINE
  CTI連携: 使用
  LINE連携: 使用

■ 有効モジュール構成（確定）
  Tier 1 コア: すべてON（必須）
  Tier 2 基本パッケージ: すべてON（必須）
  Tier 3 オプション:
    ✅ hp            （新規HP作成）
    ❌ external_hp
    ✅ customer_mypage
    ❌ ai_video      （コスト対象外）
    ✅ point_management
    ✅ mail_marketing
    ✅ tax           ⭐ 江坂瑠衣先生がチョップと共通運用
    ✅ cti
    ✅ iot_integration    （カメラ・鍵管理）
    ✅ chrome_extensions  （LINE自動送信）
    ❓ notification
    ❓ ranking
```

### 3.3 RESEXY GROUP 構成

```
RESEXY GROUP（運営グループ）
  ├─ RESEXY〜リゼクシー（合同会社ライフテラス）⭐ Phase 6 対応
  ├─ Ange Spa〜アンジュスパ（合同会社テラスライフ）⭐ Phase 0 対応
  ├─ LEON（運営法人未確認）
  ├─ ミセス暁（運営法人未確認）
  └─ 俺×妹（運営法人未確認）
```

### 3.4 税理士共通化のメリット

江坂瑠衣先生がチョップとリゼクシーの両方を担当することで：

- `/tax-portal` で税理士アカウントは1つのPINで両インスタンスを閲覧可能（マスター管理者権限でブランド切替）
- 税務運用フロー・会計ソフトの整合性が保たれる
- 将来 Phase F（法人合算）実装時、すでに同じ税理士が両方見ているので移行がスムーズ
- 年間スケジュール（税務タスク）の管理も一元化しやすい

---

## 4. データモデル設計

### 4.1 新規テーブル

```sql
-- 法人マスター
CREATE TABLE IF NOT EXISTS corporations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  name_kana text,
  corporate_number text,
  representative_name text,
  fiscal_month int DEFAULT 3,
  tax_office text,
  invoice_number text,
  tax_accountant_name text,              -- 江坂瑠衣先生
  tax_accountant_phone text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 初期データ
-- ('合同会社テラスライフ', 3月決算) - チョップ
-- ('合同会社ライフテラス', 9月決算) - リゼクシー
-- 両方とも tax_accountant_name = '江坂瑠衣'

-- T-MANAGE インスタンスマスター
CREATE TABLE IF NOT EXISTS tmanage_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  corporation_id uuid REFERENCES corporations(id),
  
  name text NOT NULL,
  name_en text,
  shop_type text,
  concept text,
  description text,
  
  logo_url text,
  theme_color_primary text,
  theme_color_accent text,
  
  subdomain text UNIQUE,                 -- resexy, ange-spa など
  custom_domain text UNIQUE,             -- 独自ドメイン（Phase B）
  
  status text DEFAULT 'active',
  plan text DEFAULT 'full',
  operation_type text DEFAULT 'self',
  group_tag text,                        -- 'resexy' などグループ識別
  
  settings jsonb DEFAULT '{}',
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz,
  CHECK (status IN ('active', 'suspended', 'archived')),
  CHECK (operation_type IN ('self', 'external'))
);

-- モジュール有効化
CREATE TABLE IF NOT EXISTS instance_modules (
  instance_id uuid REFERENCES tmanage_instances(id) ON DELETE CASCADE,
  module_key text NOT NULL,
  enabled boolean DEFAULT true,
  settings jsonb DEFAULT '{}',
  enabled_at timestamptz DEFAULT now(),
  disabled_at timestamptz,
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (instance_id, module_key)
);

-- マスター管理者
CREATE TABLE IF NOT EXISTS master_admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id bigint REFERENCES staff(id),
  email text UNIQUE,
  pin text,
  granted_by_admin_id uuid,
  granted_at timestamptz DEFAULT now(),
  revoked_at timestamptz
);

-- 活動ログ
CREATE TABLE IF NOT EXISTS instance_activity_logs (
  id bigserial PRIMARY KEY,
  instance_id uuid,
  action text NOT NULL,
  performed_by uuid,
  payload jsonb,
  created_at timestamptz DEFAULT now()
);
```

### 4.2 既存テーブル改修（instance_id追加）

ほぼ全てのビジネステーブルに `instance_id uuid` を追加（省略）。

### 4.3 出張対応について（カラム追加は不要）⭐

出張対応は**既存のコース管理で対応**するため、DB変更は不要。

- 既存の `courses` テーブルに「出張90分コース」「出張60分コース」等のレコードを追加
- コース名に「出張」を含めれば、タイムチャート上でも識別可能
- 料金も通常コースと同様に `courses.price` で管理
- セラピスト側で「出張対応可能」の情報は HP 側の表示のみ（システム管理不要）

### 4.4 インスタンス非依存テーブル

- corporations, tmanage_instances, instance_modules
- master_admins, instance_activity_logs
- aichi_cities

---

## 5. モジュール体系（3層構造・確定版）

### 5.1 Tier 1: コア（OFF不可）

- 予約管理 / 精算 / スタッフ管理 / 営業締め

### 5.2 Tier 2: 基本パッケージ（OFF不可、広めに設定）

- 顧客カルテ、セラピスト管理、シフト管理、セラピストマイページ
- スタッフ勤怠、部屋割り管理、経費管理、売上分析
- マニュアル（サロン業務・操作）、各種設定（コース・指名・オプション・ルーム等）
- 書類提出（契約・身分証）

### 5.3 Tier 3: オプションモジュール（ON/OFF自由）

| module_key | 名称 | チョップ | リゼクシー |
|---|---|---|---|
| `hp` | HP作成 | ✅ | ✅ |
| `external_hp` | 既存HP引用 | ❌ | ❌ |
| `customer_mypage` | お客様マイページ | ✅ | ✅ |
| `ai_video` | AI動画生成 | ✅ | ❌ |
| `point_management` | ポイント管理 | ✅ | ✅ |
| `mail_marketing` | メール配信 | ❓ | ✅ |
| `tax` | 税務機能（統合） | ✅ | ✅ ⭐ 確定 |
| `cti` | CTI連携 | ✅ | ✅ |
| `iot_integration` | IoT連携（カメラ・鍵）| ✅ | ✅ |
| `chrome_extensions` | 拡張機能連携 | ✅ | ✅ |
| `notification` | お知らせ投稿 | ✅ | ❓ |
| `ranking` | 売上ランキング | ✅ | ❓ |

**出張対応は既存のコース管理で対応**するため、専用モジュールは不要。

### 5.4 プラン初期設定

| プラン | 内容 | 想定 |
|---|---|---|
| Light | Tier1 + Tier2 のみ | 小規模店舗 |
| Standard | Light + hp + customer_mypage + point_management | 標準 |
| Full | 全モジュールON | チョップ・リゼクシー |

---

## 6. 独自ロジック汎用化（確定仕様）⭐

### 6.1 `tmanage_instances.settings` の構造

インスタンスごとの独自ロジックは、settings jsonb で制御：

```json
{
  "cash_management": {
    "wallets": ["bank", "office_cash"],       // リゼクシー: 2つ / チョップ: 5つ
    "has_reserve_fund": false,                 // 予備金の有無
    "reserve_fund_name": null,                 // 呼称
    "has_room_uncollected": false,             // ルーム未回収の概念
    "has_safe_uncollected": false,             // 金庫未回収の概念
    "daily_close_required": true,              // 当日締め必須
    "carry_over_allowed": false                // 翌日持ち越し許可
  },
  "payment_fees": {
    "card": 10,
    "paypay": 10,                              // リゼクシー: 10 / チョップ: 0
    "line_pay": 10,
    "cash": 0
  },
  "labels": {
    "welfare_fee": "備品・リネン代",
    "reserve_fund": "豊橋予備金"               // リゼクシーはなし
  }
}
```

### 6.2 設定値の参照パターン

```typescript
// lib/instance-settings.ts
const settings = useInstanceSettings();
const paypayFee = settings.payment_fees?.paypay ?? 0;
const cashManagement = settings.cash_management ?? {};
const hasReserveFund = cashManagement.has_reserve_fund ?? false;

{hasReserveFund && <ReserveFundCard name={cashManagement.reserve_fund_name} />}
```

### 6.3 影響範囲の主なファイル

| ファイル | 修正内容 |
|---|---|
| `app/cash-dashboard/page.tsx` | 表示する財布を settings.wallets で制御 |
| `app/dashboard/page.tsx` (fetchClosingReport) | 当日締め・持ち越しの挙動を設定駆動化 |
| `app/timechart/page.tsx` 精算モーダル | カード手数料を設定駆動化、豊橋予備金トグル表示制御 |
| `app/analytics/page.tsx` | 手数料計算を設定駆動化 |
| 予備金関連のUI | `settings.cash_management.has_reserve_fund` でトグル |

---

## 7. 既存HP引用機能（リゼクシーでは不使用）

3モード対応は設計として維持（A: URLリンク / B: iframe / C: スクレイピング取り込み）。
リゼクシーは `hp` モジュールで新規作成方針のため `external_hp` は使わない。

---

## 8. 最小TERA-MANAGE方式（Phase 5 の簡略版）⭐

### 8.1 方針

**実装する**:
- データ的なインスタンス発行（SQL経由）
- middleware での instance_id 解決
- instance_modules によるモジュールON/OFF
- 既存HP引用の3モード（将来のため）
- ドメイン振り分け（`admin.tera-manage.jp` / `*.t-manage.jp`）

**実装を後回し（Phase 7）**:
- `/tera-admin/*` の本格UI（発行ウィザード、ログイン代行等）
- マスターダッシュボードのカード式UI
- 一斉アップデート配信機能
- プレビュー機能

### 8.2 Phase 5簡略版でのリゼクシー発行フロー

```
1. [SQL直接] corporations に合同会社ライフテラス投入
   （税理士: 江坂瑠衣先生）
2. [SQL直接] tmanage_instances にリゼクシーレコード投入
   - subdomain: 'resexy'
   - operation_type: 'external'
   - group_tag: 'resexy'
3. [SQL直接] instance_modules に ON/OFF 設定投入
4. [SQL直接] tmanage_instances.settings に独自設定投入
5. [管理者手動] Vercel に resexy.t-manage.jp のワイルドカード確認
6. [管理者手動] テンプレートデータ（コース・ルーム等）を投入
   - 出張対応コースも通常コースと同様に追加
7. [リゼクシー担当者] 初期管理者PINを設定
8. [運用開始]
```

---

## 9. ドメイン戦略

### 9.1 2ドメイン構成

| ドメイン | 用途 | Vercel設定 |
|---|---|---|
| `tera-manage.jp` | マスターシステム | `admin.tera-manage.jp` 単独 |
| `t-manage.jp` | 各インスタンス | `*.t-manage.jp` ワイルドカード |

### 9.2 middleware.ts

```typescript
export async function middleware(req) {
  const host = req.headers.get('host') || '';
  
  if (host === 'admin.tera-manage.jp') {
    return NextResponse.rewrite(new URL('/tera-admin', req.url));
  }
  
  const subdomainMatch = host.match(/^([^.]+)\.t-manage\.jp$/);
  if (subdomainMatch) {
    const instanceId = await resolveInstanceBySubdomain(subdomainMatch[1]);
    const res = NextResponse.next();
    if (instanceId) res.headers.set('x-instance-id', instanceId);
    return res;
  }
  
  const instanceId = await resolveInstanceByCustomDomain(host);
  if (instanceId) {
    const res = NextResponse.next();
    res.headers.set('x-instance-id', instanceId);
    return res;
  }
  
  return NextResponse.next();
}
```

### 9.3 Phase B: 独自ドメイン（将来）

リゼクシーが `resexy.info` のDNSを T-MANAGE に向ける場合に対応。

---

## 10. 認証（PIN継続）

- 現状のPIN認証を継続
- Supabase Auth 統合は将来の検討事項（Phase N以降）

---

## 11. 権限モデル

```
Master Admin（TERA-MANAGE管理者）
  └─ 全インスタンス横断
Instance Owner（現 role="owner"）
  └─ 自インスタンス内
Instance Manager / Leader / Staff
  └─ 段階的権限
```

税理士（江坂瑠衣先生）は `company_position = "税理士"` として両インスタンスのスタッフレコードに登録し、マスター権限でインスタンス切替しながら両方の税理士ポータルにアクセス可能にする。

---

## 12. 移行戦略

### 12.1 段階的ステップ

**Step 1: テーブル追加**
- corporations に2法人投入（両方 江坂瑠衣先生）
- tmanage_instances にチョップインスタンス作成
- 全テーブルに instance_id カラム追加（NULL許可）
- backfill でチョップデータを紐付け

**Step 2: クエリ改修**
- lib/supabase.ts にラッパー関数
- 段階的にラッパー経由に置換
- middleware 実装

**Step 3: NOT NULL化・制約**
- instance_id を NOT NULL
- 外部キー・インデックス

**Step 4: 独自ロジック汎用化**
- `toyohashi_reserve_movements` → `reserve_movements` リネーム
- カード手数料の設定駆動化
- cash_dashboard のカード表示を設定駆動化

**Step 5: 最小TERA-MANAGE方式の実装**
- instance_modules による機能ON/OFF実装
- 既存HP引用3モード（基盤）
- middleware でドメイン振り分け
- 発行ウィザードは作らない（手動SQL運用）

**Step 6: リゼクシーインスタンス発行**
- 手動SQLで発行
- リゼクシー用テンプレートデータ投入（**出張コース含む**）
- 既存HPコンテンツのスクレイピング取り込み
- 並行運用開始

**Step 7（来年以降）: フル機能管理画面**
- `/tera-admin/*` のUI実装
- RESEXY GROUP 他店舗展開の準備

---

## 13. 実装フェーズと時期（確定版）⭐

| フェーズ | 時期 | 内容 | リスク |
|---|---|---|---|
| **Phase 0** | 〜2026/05/末 | チョップ本番運用準備、**両ドメイン取得**、Supabaseプラン試算 | - |
| **Phase 1** | 2026/06〜07 | チョップ運用安定確認 | - |
| **Phase 2** | 2026/08 | テーブル追加、instance_id付与、backfill | 低 |
| **Phase 3** | 2026/09〜10 | クエリ改修、middleware、ラッパー関数 | **高** |
| **Phase 4** | 2026/11 | 独自ロジック汎用化 + NOT NULL化 | 中 |
| **Phase 5** | 2026/12/上旬 | 最小TERA-MANAGE方式（発行フローのみ、UIは後回し） | 低 |
| **Phase 6** | 2026/12/中旬〜末 | **リゼクシーインスタンス発行・並行運用開始** ⭐ 年内稼働 | 中 |
| **Phase 7** | 2027/Q1〜 | フル機能TERA-MANAGE管理画面、RESEXY GROUP他店舗準備 | - |
| **Phase N** | 2027年中 | LEON・ミセス暁・俺×妹展開、外販準備 | - |
| **Phase F** | 未定 | 法人単位の税務合算 | - |

**工数見積もり**: 80〜110時間 ⭐ 出張対応モジュール不要化により削減

### 13.1 Phase 4 の工数内訳

- 資金管理構成の設定駆動化: 20h
- カード手数料の決済方法別設定化: 10h
- `toyohashi_reserve_movements` 汎用化: 10h
- UI 修正全般: 15h
- テスト: 10h

**出張対応はコース追加で済むため、追加の実装工数ゼロ**。

---

## 14. インフラコスト試算

### 14.1 リゼクシー追加によるコスト変化

| 項目 | チョップ単独 | +リゼクシー |
|---|---|---|
| Supabase | 無料枠 | **Pro プラン必須**（$25/月〜） |
| 想定DB容量 | ~100MB | ~500MB〜1GB |
| 想定リクエスト | ~100万/月 | ~500万〜1000万/月 |
| ストレージ | ~500MB | ~5GB（セラピスト写真100名分等）|
| Vercel | 無料 | 無料枠内見込み |
| ドメイン | 1つ（ange-spa.com） | **+2つ**（tera-manage.jp, t-manage.jp）年間計 ~¥5,000 |
| Anthropic API | $20/月上限 | 継続可 |

**Phase 5〜6 移行時の追加コスト想定**: 月$25〜50 + 年間ドメイン費

### 14.2 Supabase Pro プラン移行タイミング

- **Phase 5 開始前（2026/11〜12）** には Pro プラン移行完了
- リゼクシー稼働前に負荷テスト実施

---

## 15. リスクと対応

| リスク | 対応 |
|---|---|
| 既存クエリへの instance_id 付け忘れ | ラッパー関数で自動化、ESLintルール |
| backfill 失敗 | ステージング事前検証 |
| インスタンス間データ漏洩 | ラッパー関数 + middleware 二重チェック |
| リゼクシー100名規模のパフォーマンス | Phase 5 前に負荷テスト、Pro プラン移行 |
| 年内稼働のスケジュール圧迫 | 最小TERA-MANAGE方式で優先度を絞る |
| 両ドメイン取得漏れ | **Phase 0 で即実施** |
| 既存HPコンテンツ移行の工数増 | 写真のみ先行移行、文章は新規作成方針 |
| ドメインレジストラのDNS管理コスト | 1箇所に集約（Cloudflare等）で運用コスト削減 |

---

## 16. 外販への拡張パス

```
2026/06  チョップ単独運用開始
2026/12  リゼクシー導入（RESEXY GROUP 2号、無償）⭐ 年内目標
2027     RESEXY GROUP 他店舗（LEON・ミセス暁・俺×妹）
    ↓（グループ実績蓄積）
2027後半〜  グループ外の同業他社に本格外販（課金あり）
```

---

## 17. 今後の議論が必要な論点（残りわずか）

- [ ] **Phase 0 で実施**: `t-manage.jp` と `tera-manage.jp` のドメイン取得
- [ ] **Phase 0 で実施**: Supabase Pro プラン移行計画
- [ ] **Phase 5 着手前**: リゼクシー担当者との具体的な契約書面
- [ ] **Phase 6 着手前**: 既存HPコンテンツ（写真）の移行方針詳細
- [ ] **Phase 6 着手前**: 既存顧客への告知計画（プラチナムマガジン購読者向け）
- [ ] **Phase 5 着手前**: `notification` `ranking` モジュールのリゼクシーでの要否
- [ ] **Phase 4 着手前**: リゼクシーの出張コースの料金体系（参考情報として）

---

## 付録A: リゼクシーヒアリング結果（完了）⭐

### 実施日: 2026/04/23

| カテゴリ | 項目 | 結果 |
|---|---|---|
| 規模 | セラピスト数 | ✅ 100名以上 |
| HP | 既存HPの扱い | ✅ T-MANAGEで新規作成 |
| HP | サブドメイン | ✅ `resexy.t-manage.jp` |
| HP | 外部ポータル連携 | ✅ 継続不要（駅ちか等） |
| セラピスト | 契約形態 | ✅ 業務委託一律 |
| セラピスト | 源泉徴収 | ✅ 個別ON/OFF |
| セラピスト | インボイス | ✅ 個別ON/OFF |
| セラピスト | **出張対応** | ✅ **コース追加で対応**（例: 出張90分コース） |
| 資金 | 金庫・予備金 | ✅ 事務所一元、予備金なし |
| 資金 | カード手数料 | ✅ カード・PayPay・LINE Pay全て10% |
| 顧客 | 既存システムの扱い | ✅ 新規やり直し、データ移行なし |
| 予約 | チャネル | ✅ 電話メイン + WEB + LINE |
| 機能 | AI動画生成 | ❌ 使わない |
| 機能 | CTI連携 | ✅ 使う |
| 機能 | IoT連携 | ✅ 使う |
| スケジュール | 希望時期 | ⭐ 年内（2026/12月末）|
| 実装戦略 | 採択 | ✅ 選択肢B（最小TERA-MANAGE方式）|
| 税理士 | **顧問税理士** | ✅ **江坂瑠衣先生**（チョップと同じ）|

### 追加の要確認項目（Phase 5〜6 で）
- `notification` / `ranking` モジュールの要否
- 出張コースの料金体系
- 既存顧客への告知計画

---

## 付録B: 画像モックアップとの対応表

| モックアップ要素 | 本設計 |
|---|---|
| 「TERA-MANAGE」ロゴ | TERA-MANAGEはマスターシステム名 |
| 「店舗A/B/C/D」| tmanage_instances 各レコード |
| 「新規店舗追加」| Phase 7 で発行ウィザード実装 |
| 「店舗ロゴ自動生成設定」| Phase 7以降、Gemini API 連携 |
| 「データインポート」| external_hp モードC |
| モジュールトグル | instance_modules.enabled |
| 「PREVIEW」| Phase 7 で実装 |
| 「ログイン代行」 | Phase 7 で実装 |

---

## 付録C: 命名規則

### DBテーブル
- インスタンス関連: `tmanage_*` / `instance_*`
- マスター関連: `master_*`
- 法人関連: `corporation_*`

### URL
- マスター: `admin.tera-manage.jp`
- インスタンス: `{subdomain}.t-manage.jp`
- ローカル開発: `localhost:3000` + `DEFAULT_INSTANCE_ID` 環境変数

### ファイル命名（Phase 2以降）
```
sql/session{N}_tmanage_01_tables.sql        -- 新規テーブル
sql/session{N}_tmanage_02_add_instance_id.sql
sql/session{N}_tmanage_03_backfill.sql
sql/session{N}_tmanage_04_generalize_cash.sql -- 資金管理汎用化
sql/session{N}_tmanage_05_constraints.sql
sql/session{N}_tmanage_06_rezeksi_instance.sql -- リゼクシー発行
```

---

## 付録D: 呼称ルール（社内統一）

| 場面 | 呼称 |
|---|---|
| SaaS基盤全体 | **TERA-MANAGE** |
| マスター管理画面 | **TERA-MANAGE管理画面** |
| 1店舗のパッケージ | **T-MANAGE** |
| 個別インスタンス | **{屋号}のT-MANAGE** |
| グループ | **RESEXY GROUP** |

コミット・PRメッセージでも統一すること。

---

## 付録E: Phase 0 Quick Win チェックリスト

本設計書完成直後（Phase 0 中）に着手できる、低リスクな準備作業：

- [ ] `t-manage.jp` の whois 確認・取得交渉
- [ ] `tera-manage.jp` の whois 確認・取得交渉
- [ ] Supabase Pro プランの料金・機能比較資料作成
- [ ] 本設計書を `docs/08_MASTER_SYSTEM_DESIGN.md` としてコミット
- [ ] AGENTS.md / CLAUDE.md から本設計書への参照追加
- [ ] リゼクシー担当者との次回打ち合わせ日程設定
- [ ] リゼクシーの既存HPコンテンツ（写真）移行方針の詳細協議

---

## 関連ドキュメント
- `00_README.md` 〜 `07_API_ROUTES.md` - 既存T-MANAGEドキュメント
- 画像モックアップ - `Gemini_Generated_Image_xbbmrvxbbmrvxbbm.png`
- リゼクシーHP - https://resexy.info/

---

**設計確定版**: 本セッションで全ヒアリング完了、実装判断可能。
**次のアクション**: Phase 0 Quick Win（付録E）の着手。

*初版: 2026-04-23*
*改訂1: 2026-04-23（命名再定義、リゼクシー反映、既存HP引用3モード）*
*改訂2: 2026-04-23（モジュール3層化、税務統合、RESEXY GROUP反映、独自ロジック汎用化）*
*改訂3: 2026-04-23（ヒアリング完了・設計確定版。出張対応・2ドメイン・選択肢B・年内稼働）*
*改訂4: 2026-04-23（**全項目確定**。税理士=江坂瑠衣先生、出張対応=コース追加で完結、outcallモジュール廃止）*
