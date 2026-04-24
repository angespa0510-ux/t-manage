# 08. TERA-MANAGE / T-MANAGE 設計書

> **このドキュメントは設計確定版である**
>
> リゼクシー向けヒアリング完全完了を経て、全項目確定。実装判断可能なレベルに到達。
> 今後の更新は Phase 2 着手時、または新たな決定があった際に行う。

---

## 本設計書の前提

| 項目 | 決定内容 |
|---|---|
| 実装開始時期 | 2026/6/1 チョップ本番運用後、1〜2ヶ月の安定確認を経て Phase 2 着手 |
| 初期展開 | **チョップ（自社）→ リゼクシー（グループ内2号）を 2027/1/1 本格稼働** |
| 実装戦略 | **選択肢B: 最小TERA-MANAGE方式**（Phase 5 は発行フローのみ、フル機能管理画面は Phase 7 以降） |
| 将来展開 | RESEXY GROUP 全店舗 → グループ外への外販 |
| 契約書 | `docs/CONTRACT_TEMPLATE.md` に別途テンプレート化済み |

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
  │     resexy.t-manage.jp ⭐ 2027/1/1 本格稼働目標
  │
  └─ T-MANAGE インスタンス #N: 将来展開
        {subdomain}.t-manage.jp
```

### 1.2 ドメイン設計 ⭐

**2ドメイン構成**:
- `tera-manage.jp` … マスターシステム・運営側ドメイン（管理画面）
- `t-manage.jp` … 各インスタンスのサブドメインベースドメイン

**取得先**: お名前.com（Cloudflare Registrar は .jp 非対応のため）

### 1.3 用語定義

| 用語 | 定義 |
|---|---|
| TERA-MANAGE | SaaSプラットフォーム全体 |
| TERA-MANAGE管理画面 | `admin.tera-manage.jp` |
| T-MANAGE | 1店舗に提供されるパッケージ製品 |
| T-MANAGE インスタンス | 個別発行されたT-MANAGEの実体 |
| インスタンスオーナー | 店舗側の責任者 |
| RESEXY GROUP | 既存の運営グループ（リゼクシー・アンジュスパ他） |
| Shop Manage | 現在 RESEXY GROUP で使用中の既存管理システム（S-MANAGE として言及される）|

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
| N | リゼクシー稼働日 | **2027年1月1日**（12月末構築完了、12月テスト運用、1/1 本番）⭐ |
| O | 実装戦略 | 選択肢B: 最小TERA-MANAGE方式 |
| P | リゼクシー顧問税理士 | 江坂瑠衣先生（チョップと同じ） |
| Q | 出張対応の実装方法 | コース追加で対応（月頻度低いため専用機能不要） |
| R | 既存システム | **Shop Manage**（エクスポート不可、スクレイピング+手入力で移行）⭐ |
| S | 契約書 | **テンプレート化済み**（他店舗展開で再利用可能）⭐ |

---

## 3. 想定ユースケース

### 3.1 ケース1: チョップ（自社運用・1号）

- **屋号**: アンジュスパ
- **法人**: 合同会社テラスライフ（3月決算）
- **運用形態**: 自社運用
- **既存システム**: Shop Manage（段階的に T-MANAGE に移行中）
- **既存HP**: あり → T-MANAGEで新HP生成
- **サブドメイン**: `ange-spa.t-manage.jp`
- **開始時期**: 2026/6/1
- **モジュール**: Full（全モジュールON）

### 3.2 ケース2: リゼクシー（グループ内2号） ⭐ 全項目確定

```
■ 運営
  屋号: RESEXY〜リゼクシー
  法人: 合同会社ライフテラス（9月決算）
  契約: 無償（初期期間）、他店舗展開時に有償化検討
  契約書: docs/CONTRACT_TEMPLATE.md に基づき個別契約書を作成
  税理士: 江坂瑠衣先生（チョップと共通）
  意思決定: 社長本人承認済み

■ 規模
  セラピスト: 100名以上

■ 事務所環境
  PC: Windows 6台（研修不要・Shop Manage 経験あり）
  スマホ: 現在 iPhone → システム完成後 Android へ移行予定（CTI対応のため）

■ サブドメイン: resexy.t-manage.jp

■ スケジュール
  システム構築完了: 2026/12月末
  テスト運用期間: 2026/12月中
  本格稼働: 2027/1/1 ⭐ 月初スタートで経理の区切り明確
  告知: 2027/2月頃（システム完成1ヶ月後）
  移行1ヶ月前に既存HP上でも告知

■ 告知 ⭐ 2026/04/24 ミーティング後確定
  メルマガ配信・告知文面: リゼクシー側に一任
  テラスライフ側の関与: なし
  （プラチナマガジンの運用はリゼクシー側のノウハウに基づく）

■ HP
  方針: T-MANAGEで新規作成（完全置換）
  既存HP（resexy.info）: 移行時にDNS切替予定
  駅ちか等の外部ポータル: 連携終了

■ 既存データ移行 ⭐ 2026/04/24 ミーティング後更新
  元システム: Shop Manage
  エクスポート機能: なし
  移行方法:
    ① セラピスト100名分 → ⭐ リゼクシー社長から直接データ受領
       （元々社長の手元にデータがあるため、スクレイピング不要）
    ② セラピスト写真 → ⭐ 既存HP（resexy.info）から流用OK
       （撮影時契約で他媒体転用が認められている、肖像権クリア）
    ③ 顧客データ・ポイント・メルマガ購読者 → 移行せず新規やり直し

■ セラピスト
  契約形態: 業務委託（個人事業主）一律
  源泉徴収: セラピスト個別ON/OFF（204条1項6号）
  インボイス: セラピスト個別ON/OFF

■ 出張対応
  実装方法: コース追加で対応（例: 「出張90分コース」）
  頻度: 月に少ない（特別な最適化不要）
  料金: コース料金 + 出張費を含めた固定料金として設定

■ 資金管理
  方式: シンプル（事務所一元・当日締め・翌日持ち越しなし）
  金庫: 事務所のみ1つ
  予備金制度: なし

■ 決済手数料
  クレジットカード: 10%
  PayPay: 10% ⭐ チョップと異なる
  LINE Pay: 10%
  現金: 0%

■ 予約・電話
  予約チャネル: 電話（メイン）+ WEB予約 + LINE
  CTI連携: 使用
  LINE連携: 使用
  現シフト管理: スプレッドシート → T-MANAGEで置き換え

■ IoT機器 ⭐ 2026/04/24 ミーティング後更新
  方針: システムだけ実装し、導入判断はリゼクシーに一任
  機材購入: リゼクシー側の判断・タイミング
  テラスライフ側: IoT連携モジュール（iot_integration）を機能として提供するのみ

■ 運営ミーティング
  頻度: 都度開催（フレキシブル）
  緊急連絡先: 既に把握済み

■ 有効モジュール構成（確定）⭐ 2026/04/24 ミーティング後確定
  Tier 1 コア: すべてON（必須）
  Tier 2 基本パッケージ: すべてON（必須）
  Tier 3 オプション:
    ✅ hp            （新規HP作成）
    ❌ external_hp
    ✅ customer_mypage
    ❌ ai_video      （コスト対象外）
    ✅ point_management
    ✅ mail_marketing
    ✅ tax           （江坂瑠衣先生がチョップと共通運用）
    ✅ cti
    ✅ iot_integration    （システムだけ実装、機材導入はリゼクシーに一任）
    ✅ chrome_extensions  （LINE自動送信）
    ✅ notification       ⭐ 確定（お知らせ投稿が必要）
    ❌ ranking            ⭐ 確定（現状不要）

■ 契約状況 ⭐ 2026/04/24 ミーティング後確定
  契約書: 書面で正式締結済み（2026/04/24）
  契約期間: 1年
  自動更新: あり
  利用料: 無償
  電子契約: T-MANAGE側での機能実装を追加要望（後述 Section 6.4）
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

### 3.4 Shop Manage からの移行について（新設）⭐

RESEXY GROUP の既存店舗は、現在 **Shop Manage**（https://www.shop-manage.site/）を利用している。T-MANAGE は Shop Manage と機能セットが非常に似ているため、UI 操作に慣れたスタッフは T-MANAGE へスムーズに移行できる。

| 項目 | Shop Manage | T-MANAGE |
|---|---|---|
| 予約管理（タイムチャート） | ✅ | ✅ |
| 顧客管理 | ✅ | ✅ |
| セラピスト・スタッフ管理 | ✅ | ✅ |
| CTI 連携 | ✅ | ✅ |
| NG 設定 | ✅ | ✅ |
| セラピストマイページ | ✅ | ✅ |
| 売上・給料管理 | ✅ | ✅ |

**移行上の課題**:
- Shop Manage にはデータエクスポート機能がない
- → 既存HPからのスクレイピング + 必要に応じ手入力補完が主な移行手段
- 顧客データ・ポイント・メルマガ購読者は移行せず、T-MANAGE で新規構築する方針

**Shop Manage 移行時の考慮点**:
- スタッフは既に Shop Manage 運用に慣れているため研修不要
- ただし T-MANAGE 独自機能（税務連携、独自ドメイン対応、AI動画等）の説明は必要

### 3.5 税理士共通化のメリット

江坂瑠衣先生がチョップとリゼクシーの両方を担当することで：
- `/tax-portal` で税理士アカウントは1つのPINで両インスタンスを閲覧可能
- 税務運用フロー・会計ソフトの整合性が保たれる
- 将来 Phase F（法人合算）実装時の移行がスムーズ
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
  
  subdomain text UNIQUE,
  custom_domain text UNIQUE,
  
  status text DEFAULT 'active',
  plan text DEFAULT 'full',
  operation_type text DEFAULT 'self',
  group_tag text,                        -- 'resexy'
  
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

ほぼ全てのビジネステーブルに `instance_id uuid` を追加。

### 4.3 出張対応について

既存のコース管理（`courses` テーブル）で対応。DB変更は不要。
「出張90分コース」等をコースとして追加。

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
- マニュアル（サロン業務・操作）、各種設定
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
| `tax` | 税務機能（統合） | ✅ | ✅ |
| `cti` | CTI連携 | ✅ | ✅ |
| `iot_integration` | IoT連携（カメラ・鍵）| ✅ | ✅ |
| `chrome_extensions` | 拡張機能連携 | ✅ | ✅ |
| `notification` | お知らせ投稿 | ✅ | ✅ ⭐ 確定 |
| `ranking` | 売上ランキング | ✅ | ❌ ⭐ 確定 |
| `e_contract` ⭐ 新規 | 電子契約 | ✅ | ✅ ⭐ リゼクシー要望 |

### 5.4 プラン初期設定

| プラン | 内容 | 想定 |
|---|---|---|
| Light | Tier1 + Tier2 のみ | 小規模店舗 |
| Standard | Light + hp + customer_mypage + point_management | 標準 |
| Full | 全モジュールON | チョップ・リゼクシー |

---

## 6. 独自ロジック汎用化（確定仕様）

### 6.1 `tmanage_instances.settings` の構造

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

### 6.2 影響範囲の主なファイル

| ファイル | 修正内容 |
|---|---|
| `app/cash-dashboard/page.tsx` | 表示する財布を settings.wallets で制御 |
| `app/dashboard/page.tsx` (fetchClosingReport) | 当日締め・持ち越しの挙動を設定駆動化 |
| `app/timechart/page.tsx` 精算モーダル | カード手数料を設定駆動化、豊橋予備金トグル表示制御 |
| `app/analytics/page.tsx` | 手数料計算を設定駆動化 |

### 6.3 電子契約モジュール（新規追加）⭐ 2026/04/24 リゼクシー社長リクエスト

リゼクシー社長より、「T-MANAGE 利用契約書を電子契約化できるようにしてほしい」とのリクエスト。将来の他店舗展開時も必ず必要になるため、T-MANAGE の機能として実装する。

#### 既存機能の活用

チョップ既存の `/contract-sign/[token]` (業務委託契約書のオンライン署名機能) を拡張する形で実装。以下は既に T-MANAGE に存在：
- トークン認証による個別 URL 発行
- ブラウザ上での同意チェック
- 電子署名（タッチ・マウスでの手書き）
- 契約履歴の DB 記録 (`contracts` テーブル、session29 で実装済)
- 12条の業務委託契約書テンプレート

#### 拡張する機能

| 項目 | 内容 |
|---|---|
| 対象契約 | 業務委託契約書（既存）+ **T-MANAGE 利用契約書**（新規） |
| 署名方式 | 電子署名（タッチ・マウス） + 電子印鑑画像アップロード |
| タイムスタンプ | 署名日時を自動記録 |
| IPアドレス記録 | 署名時の IP を記録（後日の証拠保全） |
| 契約書PDF | 署名後、PDF として自動生成・DL可能 |
| 双方向署名 | 甲・乙の両者が署名完了で契約成立 |
| メール通知 | 署名完了時に双方へメール通知 |

#### 実装方針

**Phase 1: 自前実装（まずはこれ）**
- 既存 `/contract-sign/[token]` を拡張
- `contracts` テーブルに `contract_type` カラム追加（`業務委託` or `T-MANAGE利用`）
- T-MANAGE 管理画面から契約書発行フロー追加
- 追加コスト：0円

**Phase 2（将来）: クラウドサイン等の外部 SaaS 連携（必要時）**
- 法的効力をより強く担保する必要が出た場合
- 本格外販フェーズ（Phase N）で検討

#### 実装時期

- 自前実装は **Phase 6** と並行して進める（2026/12月）
- リゼクシー稼働時には使える状態にする
- ただし、リゼクシーの1件目は**書面で既に締結済み**なので、次の契約（2回目以降・グループ他店舗）から電子化

#### データモデル拡張

```sql
-- 既存 contracts テーブルに追加
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS contract_type text DEFAULT 'worker';
  -- 'worker' (業務委託) | 'tmanage_service' (T-MANAGE利用契約)
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS counterparty_signed_at timestamptz;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS counterparty_signature_url text;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS counterparty_ip_address text;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS signed_pdf_url text;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending';
  -- 'pending' | 'party_a_signed' | 'party_b_signed' | 'completed' | 'cancelled'
```

---

## 7. 既存HP引用機能（リゼクシーでは不使用）

3モード対応は設計として維持（A: URLリンク / B: iframe / C: スクレイピング取り込み）。
リゼクシーは `hp` モジュールで新規作成方針。

---

## 8. 最小TERA-MANAGE方式（Phase 5 の簡略版）

### 8.1 方針

**実装する**:
- データ的なインスタンス発行（SQL経由）
- middleware での instance_id 解決
- instance_modules によるモジュールON/OFF
- 既存HP引用の3モード（将来のため）
- ドメイン振り分け

**実装を後回し（Phase 7）**:
- `/tera-admin/*` の本格UI（発行ウィザード、ログイン代行等）
- マスターダッシュボードのカード式UI
- 一斉アップデート配信機能

### 8.2 リゼクシー発行フロー

```
1. [SQL直接] corporations に合同会社ライフテラス投入
   （税理士: 江坂瑠衣先生）
2. [SQL直接] tmanage_instances にリゼクシーレコード投入
3. [SQL直接] instance_modules に ON/OFF 設定投入
4. [SQL直接] tmanage_instances.settings に独自設定投入
5. [管理者手動] Vercel に resexy.t-manage.jp のワイルドカード確認
6. [管理者手動] テンプレートデータ（コース・ルーム等）を投入
   - 出張対応コースも通常コースと同様に追加
7. [スクレイピング] resexy.info からセラピスト100名分の情報取得
8. [手入力補完] スクレイピングで取れない情報を補完
9. [リゼクシー担当者] 初期管理者PINを設定
10. [テスト運用] 2026/12月中
11. [本番稼働] 2027/1/1
```

---

## 9. ドメイン戦略

### 9.1 2ドメイン構成

| ドメイン | 用途 | Vercel設定 |
|---|---|---|
| `tera-manage.jp` | マスターシステム | `admin.tera-manage.jp` 単独 |
| `t-manage.jp` | 各インスタンス | `*.t-manage.jp` ワイルドカード |

**取得先**: お名前.com

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

---

## 10. 認証（PIN継続）

- 現状のPIN認証を継続
- Supabase Auth 統合は将来の検討事項（Phase N以降）

---

## 11. 権限モデル

```
Master Admin（TERA-MANAGE管理者）
  ↓ 全インスタンス横断
Instance Owner（現 role="owner"）
  ↓ 自インスタンス内
Instance Manager / Leader / Staff
  ↓ 段階的権限
```

税理士（江坂瑠衣先生）は `company_position = "税理士"` として両インスタンスのスタッフレコードに登録し、マスター権限でインスタンス切替しながら両方の税理士ポータルにアクセス。

---

## 12. 移行戦略

### 12.1 段階的ステップ

**Step 1: テーブル追加** — corporations, tmanage_instances等作成、既存テーブルに instance_id 追加、backfill

**Step 2: クエリ改修** — ラッパー関数、middleware 実装

**Step 3: NOT NULL化・制約** — instance_id NOT NULL、外部キー、インデックス

**Step 4: 独自ロジック汎用化** — reserve_movements リネーム、カード手数料設定駆動化、cash_dashboard 設定駆動化

**Step 5: 最小TERA-MANAGE方式の実装** — モジュール ON/OFF、middleware、既存HP引用3モード（基盤）

**Step 6: リゼクシーインスタンス発行** — 手動SQL、テンプレートデータ、**Shop Manage → T-MANAGE データ移行（スクレイピング+手入力）**、契約書締結

**Step 7（来年以降）: フル機能管理画面** — `/tera-admin/*` UI、RESEXY GROUP 他店舗展開準備

---

## 13. 実装フェーズと時期（確定版）⭐

| フェーズ | 時期 | 内容 | リスク |
|---|---|---|---|
| **Phase 0** | 〜2026/05/末 | チョップ本番運用準備、両ドメイン取得、Supabaseプラン試算、契約書テンプレート準備 | - |
| **Phase 1** | 2026/06〜07 | チョップ運用安定確認 | - |
| **Phase 2** | 2026/08 | テーブル追加、instance_id付与、backfill | 低 |
| **Phase 3** | 2026/09〜10 | クエリ改修、middleware、ラッパー関数 | **高** |
| **Phase 4** | 2026/11 | 独自ロジック汎用化 + NOT NULL化 | 中 |
| **Phase 5** | 2026/12/上旬 | 最小TERA-MANAGE方式（発行フロー） | 低 |
| **Phase 6** | 2026/12/中旬〜末 | **リゼクシーインスタンス発行・データ移行・テスト運用** | 中 |
| **1/1**| **2027/1/1** | **リゼクシー本格稼働** ⭐ | - |
| **Phase 7** | 2027/Q1〜 | フル機能TERA-MANAGE管理画面、RESEXY GROUP他店舗準備 | - |
| **Phase N** | 2027年中 | LEON・ミセス暁・俺×妹展開、外販準備 | - |
| **Phase F** | 未定 | 法人単位の税務合算 | - |

**工数見積もり**: 80〜110時間

### 13.1 Phase 4 の工数内訳

- 資金管理構成の設定駆動化: 20h
- カード手数料の決済方法別設定化: 10h
- `toyohashi_reserve_movements` 汎用化: 10h
- UI 修正全般: 15h
- テスト: 10h

### 13.2 Phase 6 の工数内訳（新規詳細化）⭐

- リゼクシー用 SQL 発行スクリプト: 5h
- 既存HPからのスクレイピング（セラピスト100名分）: 10h
- 手入力補完サポート: 5h
- テンプレートデータ投入（コース・ルーム等）: 3h
- テスト運用・動作確認: 10h
- 契約書締結・運用準備: 3h

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
| ドメイン | 1つ | **+2つ**（tera-manage.jp, t-manage.jp）年間計 ~¥5,000〜8,000 |
| Anthropic API | $20/月上限 | 継続可 |

**Phase 5〜6 移行時の追加コスト想定**: 月$25〜50 + 年間ドメイン費

### 14.2 Supabase Pro プラン移行タイミング

**Phase 5 開始前（2026/11〜12）** には Pro プラン移行完了。
リゼクシー稼働前に負荷テスト実施。

---

## 15. リスクと対応

| リスク | 対応 |
|---|---|
| 既存クエリへの instance_id 付け忘れ | ラッパー関数で自動化、ESLintルール |
| backfill 失敗 | ステージング事前検証 |
| インスタンス間データ漏洩 | ラッパー関数 + middleware 二重チェック |
| リゼクシー100名規模のパフォーマンス | Phase 5 前に負荷テスト、Pro プラン移行 |
| 2027/1/1稼働に対するスケジュール圧迫 | 最小TERA-MANAGE方式で優先度を絞る |
| 両ドメイン取得漏れ | ✅ 完了（2026/04/24） |
| セラピストデータ移行 | ✅ リゼクシー社長から直接受領（解決済み） |
| 既存HP写真の肖像権 | ✅ 撮影時契約で転用OK確認済み |
| 契約書の不備 | 弁護士レビュー（Phase 1 中に実施推奨） |
| 電子契約機能の法的効力 | Phase 1（自前実装）で十分、Phase 2 で外部連携も検討 |

---

## 16. 外販への拡張パス

```
2026/04  ドメイン取得完了、リゼクシー書面契約締結 ⭐
2026/06  チョップ単独運用開始
2026/12  リゼクシー構築・テスト運用
2027/01  リゼクシー本格稼働（RESEXY GROUP 2号、無償）⭐
2027     RESEXY GROUP 他店舗（LEON・ミセス暁・俺×妹）
    ↓（グループ実績蓄積）
2027後半〜  グループ外の同業他社に本格外販（課金あり）
```

---

## 17. 今後の議論が必要な論点

### ✅ 完了済み（2026/04/24 ミーティングで解決）

- [x] `t-manage.jp` と `tera-manage.jp` のドメイン取得（お名前.com、2026/04/24）
- [x] リゼクシーとの契約書締結（書面で締結済み）
- [x] セラピストデータ移行方針（社長から直接データ受領）
- [x] 既存HP写真の肖像権（転用OK）
- [x] 税理士決定（江坂瑠衣先生）
- [x] 会計ソフト統一（アンジュスパと同じ）
- [x] 法人決算月（9月）
- [x] `notification` モジュール（ON 確定）
- [x] `ranking` モジュール（OFF 確定）
- [x] 告知方針（リゼクシー側に一任）
- [x] IoT機材（システムだけ実装、導入判断はリゼクシーに一任）

### 🔄 残タスク

- [ ] **Phase 0 で実施**: Supabase Pro プラン移行計画
- [ ] **Phase 1 で実施**: 契約書テンプレートの弁護士レビュー（本契約は書面締結済みだが、今後の他店舗用テンプレートとして）
- [ ] **Phase 4 着手前**: リゼクシーの出張コースの料金体系詳細（参考情報）
- [ ] **Phase 6 着手前**: Android スマホ移行の具体的機種・時期
- [ ] **Phase 6 着手前**: 電子契約モジュール（`e_contract`）の実装

---

## 付録A: リゼクシーヒアリング結果（完全完了）⭐

### 実施日: 2026/04/23（全4バッチ完了）

| カテゴリ | 項目 | 結果 |
|---|---|---|
| 規模 | セラピスト数 | ✅ 100名以上 |
| HP | 既存HPの扱い | ✅ T-MANAGEで新規作成 |
| HP | サブドメイン | ✅ `resexy.t-manage.jp` |
| HP | 外部ポータル連携 | ✅ 継続不要（駅ちか等） |
| セラピスト | 契約形態 | ✅ 業務委託一律 |
| セラピスト | 源泉徴収 | ✅ 個別ON/OFF |
| セラピスト | インボイス | ✅ 個別ON/OFF |
| セラピスト | 出張対応 | ✅ コース追加で対応 |
| 資金 | 金庫・予備金 | ✅ 事務所一元、予備金なし |
| 資金 | カード手数料 | ✅ カード・PayPay・LINE Pay全て10% |
| 顧客 | 既存システムの扱い | ✅ 新規やり直し、データ移行なし |
| 予約 | チャネル | ✅ 電話メイン + WEB + LINE |
| 機能 | AI動画生成 | ❌ 使わない |
| 機能 | CTI連携 | ✅ 使う |
| 機能 | IoT連携 | ✅ 使う（機材は後から購入） |
| スケジュール | 稼働日 | ✅ **2027年1月1日 本格稼働** |
| 実装戦略 | 採択 | ✅ 選択肢B（最小TERA-MANAGE方式）|
| 税理士 | 顧問税理士 | ✅ 江坂瑠衣先生（チョップと共通）|
| 意思決定 | 決裁者 | ✅ 社長本人、導入意思確定 |
| 契約書 | 方針 | ✅ テンプレート化済み（他店舗展開用）|
| 契約書 | 料金 | ✅ 無償提供（初期期間） |
| ミーティング | 頻度 | ✅ 都度開催（フレキシブル）|
| 事務所 | PC | ✅ Windows 6台 |
| 事務所 | スマホ | ✅ iPhone → Android移行予定 |
| 研修 | 必要性 | ✅ 不要（Shop Manage経験あり）|
| 現システム | 内容 | ✅ **Shop Manage**（エクスポート不可）|
| 現システム | シフト管理 | ✅ スプレッドシート運用 |
| データ移行 | セラピスト | ✅ ⭐ リゼクシー社長から直接データ受領（スクレイピング不要）|
| データ移行 | 顧客・ポイント | ✅ 移行せず新規構築 |
| データ移行 | セラピスト写真 | ✅ ⭐ 既存HPから流用OK（肖像権クリア）|
| 告知 | 方法 | ✅ ⭐ リゼクシー側に一任（プラチナマガジン運用）|
| IoT機材 | 現状 | ✅ ⭐ システムだけ実装、導入判断はリゼクシーに一任 |
| 出張対応 | 頻度 | ✅ 月に少ない |

全項目確定 → Phase 0 〜 5 の計画を詳細に立てられる状態。

---

### 付録A.1 2026/04/24 対面ミーティング結果 ⭐

**実施**: 2026/04/24、社長対社長、書面契約締結済み

| 議題 | 結果 |
|---|---|
| 5-1. 契約関連 | ✅ **書面で正式締結完了**、自動更新ON、電子契約化は追加要望 |
| 5-2. 既存HP写真の肖像権 | ✅ 撮影時契約で他媒体転用OK、新規撮影不要 |
| 5-3. 税理士・会計ソフト・決算月 | ✅ すべて確定（江坂瑠衣先生、アンジュスパと同一、9月決算）|
| 5-4. `notification` / `ranking` | ✅ notification ON、ranking OFF |
| 5-5. 告知計画 | ✅ リゼクシー側に一任（メルマガ運用ノウハウを尊重） |
| 5-6. IoT機材 | ✅ システム側のみ実装、導入判断はリゼクシー側 |
| 新規要望: 電子契約 | ⭐ T-MANAGE 機能として実装することに合意 |
| 新規情報: セラピストデータ | ⭐ 社長が直接所有、スクレイピング不要 |

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
sql/session{N}_tmanage_01_tables.sql
sql/session{N}_tmanage_02_add_instance_id.sql
sql/session{N}_tmanage_03_backfill.sql
sql/session{N}_tmanage_04_generalize_cash.sql
sql/session{N}_tmanage_05_constraints.sql
sql/session{N}_tmanage_06_rezeksi_instance.sql
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
| 現行システム | **Shop Manage**（旧: S-MANAGE）|

---

## 付録E: Phase 0 Quick Win チェックリスト

本設計書完成直後に着手できる準備作業：

- [x] 本設計書を `docs/08_MASTER_SYSTEM_DESIGN.md` としてコミット
- [x] AGENTS.md から本設計書への参照追加
- [x] `t-manage.jp` / `tera-manage.jp` の whois 調査（取得可能と判定）
- [x] **契約書テンプレート作成**（`docs/CONTRACT_TEMPLATE.md`）⭐
- [x] **ドメイン取得完了**（お名前.com、2026/04/24）⭐
- [ ] ドメイン情報認証メールへの対応（2週間以内・必須）
- [ ] Supabase Pro プランの料金・機能比較資料作成
- [ ] 契約書テンプレートの弁護士レビュー依頼
- [ ] リゼクシー側の契約書個別化（別紙3の項目を埋める）
- [ ] リゼクシー担当者との初回打ち合わせ実施
- [ ] 既存HPコンテンツ（写真）の著作権・肖像権の確認

### 付録E.1 ドメイン取得記録 ⭐

| 項目 | 内容 |
|---|---|
| 取得日 | 2026/04/24 |
| レジストラ | お名前.com（GMO Internet） |
| お名前ID | 75141796 |
| 契約者 | 合同会社テラスライフ |

| ドメイン | 初年度料金（税込） | 翌年以降（税込） | Whois公開代行 | 用途 |
|---|---|---|---|---|
| `tera-manage.jp` | **0円**（キャンペーン適用） | 3,124円/年 | 0円（標準付帯） | マスターシステム用 |
| `t-manage.jp` | 2,339円（1,860円 + サービス維持調整費479円） | 3,124円/年（推定） | 0円（標準付帯） | 各インスタンス用 |
| **合計初年度** | **2,339円** | 約6,248円/年 | - | - |

**年次予算（ドメイン関連）**: 約6,248円/年（2年目以降）

### 付録E.2 Vercel 連携時のDNS設定（Phase 5 時に実施）

ドメイン取得済みのため、Phase 5 着手時に以下の設定を行う：

1. **Vercel Dashboard → Settings → Domains** で以下を追加：
   - `admin.tera-manage.jp`（管理画面用）
   - `*.t-manage.jp`（ワイルドカード、各インスタンス用）
   - `t-manage.jp`（ルート、将来的にランディングページに使うなら）
   - `tera-manage.jp`（ルート、予約）

2. **お名前.com の DNS 設定**:
   - ネームサーバーを Vercel のものに変更するか、
   - CNAME/A レコードを Vercel 指定のものに設定
   - 推奨: ネームサーバー変更（反映が早く、管理がシンプル）

3. **SSL 証明書**: Vercel が Let's Encrypt で自動発行（ワイルドカード対応）

4. **反映時間の目安**:
   - DNS反映: 数分〜48時間（通常は1時間以内）
   - SSL発行: 数分

**注意**: `.jp` ドメインはドメイン情報認証が完了してから利用可能。認証メールの確認を必ず行うこと。

---

## 関連ドキュメント
- `00_README.md` 〜 `07_API_ROUTES.md` - 既存T-MANAGEドキュメント
- **`docs/CONTRACT_TEMPLATE.md` - T-MANAGE 利用契約書テンプレート** ⭐
- 画像モックアップ - `Gemini_Generated_Image_xbbmrvxbbmrvxbbm.png`
- リゼクシーHP - https://resexy.info/
- 現行システム - Shop Manage https://www.shop-manage.site/

---

**設計確定版**: 本セッションで全ヒアリング完了、契約書テンプレート作成完了、実装判断可能。
**次のアクション**: Phase 0 Quick Win（付録E）の残タスク。

*初版: 2026-04-23*
*改訂1: 2026-04-23（命名再定義、リゼクシー反映、既存HP引用3モード）*
*改訂2: 2026-04-23（モジュール3層化、税務統合、RESEXY GROUP反映、独自ロジック汎用化）*
*改訂3: 2026-04-23（ヒアリング完了・設計確定版。出張対応・2ドメイン・選択肢B・年内稼働）*
*改訂4: 2026-04-23（税理士=江坂瑠衣先生、出張=コース追加、outcallモジュール廃止）*
*改訂5: 2026-04-23（**全項目完全確定**。稼働日2027/1/1、Shop Manage移行、契約書テンプレート連携、Windows 6台、Android移行計画、IoT設計先行）*
*改訂6: 2026-04-24（**ドメイン取得完了**。tera-manage.jp + t-manage.jp 取得済み、初年度2,339円、Vercel連携手順を付録E.2に追加）*
*改訂7: 2026-04-24（**リゼクシー社長対面ミーティング完了・契約書面締結済み**。電子契約モジュールを新規追加、セラピストデータは社長直接受領、写真は既存HPから流用OK、notification=ON/ranking=OFF確定、告知とIoT機材導入判断はリゼクシー側に一任）*
