# 17. 写メ日記システム 設計書

サロン集客の主力コンテンツとなる写メ日記システムの完全設計書。
T-MANAGE を主体に、ange-spa.com への表示と駅ちか（+6ポータル同時投稿）への連携を行う。

**ステータス**: 設計フェーズ
**ターゲット稼働**: 6/1 本番運用開始までに Phase 1 完了
**関連ドキュメント**: `02_FEATURES.md`, `04_DATABASE.md`, `06_EXTENSIONS.md`, `07_API_ROUTES.md`

---

## 🎯 プロジェクト目的

### ビジネス上のゴール
1. **集客の主力コンテンツ化** — お客様が日々チェックしたくなる「いま、誰が、どんな状態か」を伝えるメディアに
2. **セラピストの自走化** — マイページから1分で投稿できる UX
3. **マルチチャネル一元化** — T-MANAGE 1箇所への投稿で、HP・駅ちか・他6ポータルに同時反映
4. **会員囲い込み** — 「会員限定写メ日記」でお客様マイページ登録の動機づけ

### システム上のゴール
- **データ所有権を T-MANAGE 側に確保**（駅ちかが消えてもコンテンツが残る）
- **HP の SEO 強化**（更新頻度の高い動的コンテンツとして）
- **既存スタックでの完結**（Supabase + Vercel + nodemailer のみ）
- **駅ちか UI 変更耐性**（ブラウザ自動化ではなくメール投稿を採用）

---

## 📐 要件サマリー（ユーザー確認済み）

| 項目 | 決定事項 |
|---|---|
| 編集権限 | **事後修正可**：即時公開するが、スタッフが後から編集・削除できる |
| HP 表示範囲 | **個別 + タイムライン + 検索/フィルタ/ハッシュタグ** |
| お客様マイページ連動 | **全部盛り**：通知 + コメント/いいね |
| **会員限定タブ** | **マイページ会員のみ閲覧可の限定写メ日記**を別軸で運用 |

---

## 🏗 全体アーキテクチャ

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         セラピスト (スマホ)                              │
│                                                                         │
│   T-MANAGE マイページ → 📸写メ日記タブ                                   │
│   ・タイトル / 本文 / 画像複数枚 / ハッシュタグ                           │
│   ・公開範囲選択：[全公開] [会員限定]                                     │
│   ・🚀投稿ボタン                                                          │
│                                                                         │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │ POST /api/diary/post
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         T-MANAGE (Vercel)                               │
│                                                                         │
│   ① Supabase Storage 保存（therapist-diary バケット）                    │
│   ② therapist_diary_entries に INSERT (status='published')              │
│   ③ 公開範囲が「全公開」の場合のみ駅ちかへメール送信                       │
│      ├─ nodemailer で multipart 形式（画像添付）                          │
│      └─ ekichika_dispatch_logs に送信ログ記録                            │
│   ④ 会員限定の場合は駅ちかへ送らない（HP の会員限定タブのみ）              │
│   ⑤ お気に入り登録会員へプッシュ通知                                      │
│                                                                         │
└────┬───────────────────────────┬────────────────────────────┬───────────┘
     │                           │                            │
     │ ange-spa.com 表示         │ メール送信                    │ プッシュ通知
     ▼                           ▼                            ▼
┌──────────────┐         ┌──────────────────┐         ┌─────────────────┐
│ HP公開エリア  │         │ 駅ちか           │         │ お客様マイページ │
│              │         │ (専用メール宛)    │         │                 │
│ ・個別ページ  │         │      ↓           │         │ ・新着通知       │
│ ・タイムライン│         │ 6ポータル自動転送 │         │ ・お気に入り更新 │
│ ・検索/タグ   │         │ ・メンエス       │         │ ・コメント/いいね│
│ ・会員限定タブ│         │ ・口コミ情報局等  │         │                 │
│  (要ログイン) │         │                  │         │                 │
└──────────────┘         └──────────────────┘         └─────────────────┘
```

### データフローの整理

| アクション | T-MANAGE DB | HP | 駅ちか | 会員通知 |
|---|---|---|---|---|
| 全公開で投稿 | ✅ 保存 | ✅ 表示 | ✅ メール送信 | ✅ プッシュ |
| 会員限定で投稿 | ✅ 保存 | ✅ 会員限定タブのみ | ❌ 送らない | ✅ プッシュ |
| スタッフ編集 | ✅ 更新 | ✅ 反映 | ⚠ 駅ちかは更新不可（手動再投稿） | ❌ 通知なし |
| スタッフ削除 | ✅ 論理削除 | ✅ 非表示 | ⚠ 駅ちか側は手動削除 | ❌ 通知なし |
| いいね/コメント | ✅ 保存 | ✅ 表示 | ❌ 関係なし | ❌ 通知なし |

### 駅ちか側の制約と現実解
駅ちか側はメール投稿のため**「投稿のみ可能・編集/削除はできない」**。これは仕様として割り切る：
- T-MANAGE 上での編集/削除は HP には反映、駅ちかは手動オペレーション
- 編集 UI に「⚠ 駅ちかには反映されません」の注記を表示
- 緊急時は駅ちか管理画面で対応する運用フロー

---

## 📑 目次

このドキュメントは長いため、セクションを分けて読めるようにしています。

1. **DB 設計** — テーブル定義・インデックス・SQL
2. **API 設計** — `/api/diary/*` エンドポイント仕様
3. **UI 設計（セラピスト側）** — マイページ📸写メ日記タブ
4. **UI 設計（管理画面側）** — モデレーション・統計
5. **HP 表示設計** — タイムライン・個別ページ・タグ・検索
6. **会員限定タブ設計** — お客様マイページ統合
7. **駅ちか連携詳細** — メール投稿仕様・テスト手順
8. **実装フェーズ** — Phase 1〜4 のリリース計画

---

## 🗄 1. DB 設計

### 1.1 テーブル一覧

| テーブル | 用途 | 想定レコード数（1年後） |
|---|---|---|
| `therapist_diary_entries` | 写メ日記本体 | ~30,000 (100人 × 月25投稿 × 12ヶ月) |
| `therapist_diary_images` | 添付画像（1投稿に複数枚） | ~120,000 (1投稿平均4枚) |
| `therapist_diary_tags` | ハッシュタグマスター | ~500 |
| `therapist_diary_entry_tags` | 投稿×タグの中間テーブル | ~150,000 (1投稿平均5タグ) |
| `therapist_diary_likes` | いいね（会員のみ） | ~500,000 |
| `therapist_diary_comments` | コメント（会員のみ） | ~50,000 |
| `therapist_diary_views` | 閲覧履歴（個別カウント用） | ~3,000,000 |
| `ekichika_post_settings` | 各セラピストの駅ちか宛メールアドレス | ~100 |
| `ekichika_dispatch_logs` | 駅ちか送信ログ | ~30,000 |
| `customer_diary_favorites` | お客様のお気に入りセラピスト（既存活用 or 新設） | ~5,000 |

### 1.2 メインテーブル: `therapist_diary_entries`

```sql
CREATE TABLE IF NOT EXISTS therapist_diary_entries (
  id BIGSERIAL PRIMARY KEY,
  therapist_id BIGINT NOT NULL,                  -- セラピスト
  
  -- コンテンツ
  title TEXT NOT NULL,                            -- タイトル（駅ちか件名にも使用）
  body TEXT NOT NULL,                             -- 本文（markdown 簡易記法対応）
  cover_image_url TEXT,                           -- カバー画像（タイムライン表示用、images の1枚目から自動設定）
  
  -- 公開範囲
  visibility TEXT NOT NULL DEFAULT 'public',     -- 'public' | 'members_only'
  status TEXT NOT NULL DEFAULT 'published',      -- 'published' | 'edited' | 'deleted'
  
  -- 駅ちか連携
  send_to_ekichika BOOLEAN NOT NULL DEFAULT true, -- 駅ちか送信フラグ（members_only 時は強制 false）
  ekichika_dispatched_at TIMESTAMPTZ,             -- 駅ちか送信完了日時
  ekichika_dispatch_status TEXT,                  -- 'pending' | 'sent' | 'failed' | 'skipped'
  ekichika_error_message TEXT,
  
  -- メタデータ
  view_count BIGINT NOT NULL DEFAULT 0,
  like_count BIGINT NOT NULL DEFAULT 0,
  comment_count BIGINT NOT NULL DEFAULT 0,
  
  -- スケジュール投稿（Phase 2）
  scheduled_at TIMESTAMPTZ,                       -- 予約投稿日時（NULL なら即時）
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), -- 実際に公開された日時
  
  -- 編集・削除トラッキング
  edited_by_staff_id BIGINT,                      -- 最後に編集したスタッフ
  edited_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,                         -- 論理削除
  deleted_by_staff_id BIGINT,
  delete_reason TEXT,
  
  -- 投稿元
  source TEXT NOT NULL DEFAULT 'mypage',          -- 'mypage' | 'admin' | 'ekichika_import'
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_diary_entries_therapist ON therapist_diary_entries(therapist_id);
CREATE INDEX idx_diary_entries_published ON therapist_diary_entries(published_at DESC) 
  WHERE deleted_at IS NULL AND status = 'published';
CREATE INDEX idx_diary_entries_visibility ON therapist_diary_entries(visibility, published_at DESC) 
  WHERE deleted_at IS NULL;
CREATE INDEX idx_diary_entries_dispatch ON therapist_diary_entries(ekichika_dispatch_status) 
  WHERE ekichika_dispatch_status IN ('pending', 'failed');

ALTER TABLE therapist_diary_entries DISABLE ROW LEVEL SECURITY;
```

### 1.3 画像テーブル: `therapist_diary_images`

```sql
CREATE TABLE IF NOT EXISTS therapist_diary_images (
  id BIGSERIAL PRIMARY KEY,
  entry_id BIGINT NOT NULL REFERENCES therapist_diary_entries(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,                        -- Supabase Storage URL
  thumbnail_url TEXT,                              -- サムネイル（後で生成）
  sort_order INT NOT NULL DEFAULT 0,
  width INT,                                       -- 元画像の解像度（lazy load 最適化用）
  height INT,
  file_size_bytes BIGINT,
  caption TEXT,                                    -- 画像ごとのキャプション（オプション）
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_diary_images_entry ON therapist_diary_images(entry_id, sort_order);
ALTER TABLE therapist_diary_images DISABLE ROW LEVEL SECURITY;
```

### 1.4 タグマスター: `therapist_diary_tags`

```sql
CREATE TABLE IF NOT EXISTS therapist_diary_tags (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,                       -- '#新人' '#今日の私' 等（# 含めない正規形）
  display_name TEXT NOT NULL,                      -- 表示用（# 付き）
  category TEXT,                                   -- 'mood' | 'outfit' | 'event' | 'salon' | 'other'
  color TEXT DEFAULT '#c3a782',                    -- タグ表示色
  use_count BIGINT NOT NULL DEFAULT 0,             -- 使用回数（人気順表示用）
  is_featured BOOLEAN NOT NULL DEFAULT false,      -- HP のタグ一覧で目立たせる
  is_blocked BOOLEAN NOT NULL DEFAULT false,       -- NG タグ
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_diary_tags_use_count ON therapist_diary_tags(use_count DESC) 
  WHERE is_blocked = false;
CREATE INDEX idx_diary_tags_featured ON therapist_diary_tags(is_featured) 
  WHERE is_featured = true;

ALTER TABLE therapist_diary_tags DISABLE ROW LEVEL SECURITY;

-- 初期タグ投入
INSERT INTO therapist_diary_tags (name, display_name, category, is_featured) VALUES
  ('今日の私', '#今日の私', 'mood', true),
  ('お礼', '#お礼', 'mood', true),
  ('新人', '#新人', 'salon', true),
  ('出勤', '#出勤', 'salon', true),
  ('久しぶり', '#久しぶり', 'salon', false),
  ('衣装', '#衣装', 'outfit', false),
  ('カフェ', '#カフェ', 'other', false),
  ('プライベート', '#プライベート', 'mood', false)
ON CONFLICT (name) DO NOTHING;
```

### 1.5 投稿×タグ中間: `therapist_diary_entry_tags`

```sql
CREATE TABLE IF NOT EXISTS therapist_diary_entry_tags (
  id BIGSERIAL PRIMARY KEY,
  entry_id BIGINT NOT NULL REFERENCES therapist_diary_entries(id) ON DELETE CASCADE,
  tag_id BIGINT NOT NULL REFERENCES therapist_diary_tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(entry_id, tag_id)
);

CREATE INDEX idx_diary_entry_tags_entry ON therapist_diary_entry_tags(entry_id);
CREATE INDEX idx_diary_entry_tags_tag ON therapist_diary_entry_tags(tag_id);
ALTER TABLE therapist_diary_entry_tags DISABLE ROW LEVEL SECURITY;
```

### 1.6 いいね: `therapist_diary_likes`

```sql
CREATE TABLE IF NOT EXISTS therapist_diary_likes (
  id BIGSERIAL PRIMARY KEY,
  entry_id BIGINT NOT NULL REFERENCES therapist_diary_entries(id) ON DELETE CASCADE,
  customer_id BIGINT NOT NULL,                     -- お客様マイページの会員ID
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(entry_id, customer_id)
);

CREATE INDEX idx_diary_likes_entry ON therapist_diary_likes(entry_id);
CREATE INDEX idx_diary_likes_customer ON therapist_diary_likes(customer_id);
ALTER TABLE therapist_diary_likes DISABLE ROW LEVEL SECURITY;
```

**いいね数の更新は INSERT/DELETE で entries.like_count をアプリ側でインクリメント/デクリメント**。
（トリガーよりアプリで明示制御の方が T-MANAGE のスタイルに合う）

### 1.7 コメント: `therapist_diary_comments`

```sql
CREATE TABLE IF NOT EXISTS therapist_diary_comments (
  id BIGSERIAL PRIMARY KEY,
  entry_id BIGINT NOT NULL REFERENCES therapist_diary_entries(id) ON DELETE CASCADE,
  customer_id BIGINT NOT NULL,
  body TEXT NOT NULL,                              -- コメント本文
  is_hidden BOOLEAN NOT NULL DEFAULT false,        -- スタッフが非表示化
  is_replied BOOLEAN NOT NULL DEFAULT false,       -- セラピストが返信済み
  reply_body TEXT,                                 -- セラピストからの返信
  reply_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_diary_comments_entry ON therapist_diary_comments(entry_id, created_at DESC) 
  WHERE deleted_at IS NULL AND is_hidden = false;
CREATE INDEX idx_diary_comments_customer ON therapist_diary_comments(customer_id);
ALTER TABLE therapist_diary_comments DISABLE ROW LEVEL SECURITY;
```

### 1.8 閲覧履歴: `therapist_diary_views`

```sql
CREATE TABLE IF NOT EXISTS therapist_diary_views (
  id BIGSERIAL PRIMARY KEY,
  entry_id BIGINT NOT NULL,                        -- entries への FK は付けない（削除されても閲覧統計は残す）
  customer_id BIGINT,                              -- 非ログイン時は NULL
  ip_hash TEXT,                                    -- IPハッシュ（重複カウント抑止用）
  user_agent TEXT,
  referrer TEXT,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_diary_views_entry_date ON therapist_diary_views(entry_id, viewed_at DESC);
CREATE INDEX idx_diary_views_customer ON therapist_diary_views(customer_id) 
  WHERE customer_id IS NOT NULL;

-- 1日経過した views は集計後削除（DBサイズ抑制）。日次集計バッチで対応
ALTER TABLE therapist_diary_views DISABLE ROW LEVEL SECURITY;
```

### 1.9 駅ちか設定: `ekichika_post_settings`

```sql
CREATE TABLE IF NOT EXISTS ekichika_post_settings (
  id BIGSERIAL PRIMARY KEY,
  therapist_id BIGINT NOT NULL UNIQUE,
  ekichika_email TEXT NOT NULL,                   -- 駅ちか専用投稿メールアドレス
  is_active BOOLEAN NOT NULL DEFAULT true,         -- false なら駅ちか送信スキップ
  last_sent_at TIMESTAMPTZ,
  total_sent_count BIGINT NOT NULL DEFAULT 0,
  total_failed_count BIGINT NOT NULL DEFAULT 0,
  note TEXT,                                       -- メモ（例：「2026/4/25 取得」）
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ekichika_settings_therapist ON ekichika_post_settings(therapist_id);
ALTER TABLE ekichika_post_settings DISABLE ROW LEVEL SECURITY;
```

### 1.10 駅ちか送信ログ: `ekichika_dispatch_logs`

```sql
CREATE TABLE IF NOT EXISTS ekichika_dispatch_logs (
  id BIGSERIAL PRIMARY KEY,
  entry_id BIGINT NOT NULL,                        -- FK 付けない（投稿削除後もログは残す）
  therapist_id BIGINT NOT NULL,
  ekichika_email TEXT NOT NULL,
  
  -- 送信内容
  subject TEXT NOT NULL,                           -- 件名（タイトル）
  body_text TEXT NOT NULL,                         -- 本文プレーン
  image_count INT NOT NULL DEFAULT 0,
  total_size_bytes BIGINT,                         -- 添付画像合計サイズ
  
  -- 結果
  status TEXT NOT NULL,                            -- 'sent' | 'failed' | 'retry_pending'
  smtp_response TEXT,                              -- SMTPサーバーの応答
  error_message TEXT,
  retry_count INT NOT NULL DEFAULT 0,
  
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ekichika_logs_entry ON ekichika_dispatch_logs(entry_id);
CREATE INDEX idx_ekichika_logs_status ON ekichika_dispatch_logs(status, created_at DESC);
CREATE INDEX idx_ekichika_logs_therapist ON ekichika_dispatch_logs(therapist_id, created_at DESC);
ALTER TABLE ekichika_dispatch_logs DISABLE ROW LEVEL SECURITY;
```

### 1.11 お気に入り: `customer_diary_favorites`

既存に類似テーブルがあれば統合、なければ新設。

```sql
CREATE TABLE IF NOT EXISTS customer_diary_favorites (
  id BIGSERIAL PRIMARY KEY,
  customer_id BIGINT NOT NULL,
  therapist_id BIGINT NOT NULL,
  notify_on_post BOOLEAN NOT NULL DEFAULT true,    -- 投稿通知の希望
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(customer_id, therapist_id)
);

CREATE INDEX idx_diary_favs_customer ON customer_diary_favorites(customer_id);
CREATE INDEX idx_diary_favs_therapist ON customer_diary_favorites(therapist_id);
ALTER TABLE customer_diary_favorites DISABLE ROW LEVEL SECURITY;
```

### 1.12 Storage バケット

```sql
-- Supabase Storage で実行
-- バケット名: therapist-diary
-- public: true（HP に直接表示するため）
-- ファイルパス規則: {therapist_id}/{entry_id}/{uuid}.webp

-- ストレージポリシー（Storage RLS）
-- 読み取り: 全員可（public バケット）
-- 書き込み: anon 可（アプリ側でセラピスト認証済みのリクエストのみ通すため）
-- 削除: anon 可（アプリ側で entry_id とセラピスト ID 検証）
```

**画像最適化ルール:**
- アップロード時に Sharp で **WebP 変換 + 最大幅 1920px にリサイズ**
- サムネイル（最大幅 600px）も同時生成
- 元 JPG/PNG は保存しない（容量節約）

### 1.13 SQL ファイル: `sql/session46_diary_system.sql`

上記すべてを冪等な形でまとめた1つの SQL ファイルとして作成。
ユーザーは Supabase SQL Editor で1回実行するだけで全テーブル作成完了。

---


## 🔌 2. API 設計

### 2.1 API ルート一覧

| エンドポイント | メソッド | 認証 | 用途 |
|---|---|---|---|
| `/api/diary/post` | POST | セラピスト | 新規投稿 |
| `/api/diary/update/[id]` | PATCH | セラピスト/スタッフ | 編集 |
| `/api/diary/delete/[id]` | DELETE | スタッフ | 論理削除 |
| `/api/diary/list` | GET | 公開 | タイムライン取得 |
| `/api/diary/[id]` | GET | 公開/会員 | 個別記事取得 |
| `/api/diary/like` | POST/DELETE | 会員 | いいねトグル |
| `/api/diary/comment` | POST | 会員 | コメント投稿 |
| `/api/diary/comment/[id]/reply` | POST | セラピスト | コメント返信 |
| `/api/diary/comment/[id]/hide` | PATCH | スタッフ | コメント非表示 |
| `/api/diary/view` | POST | 公開 | 閲覧カウント |
| `/api/diary/dispatch-ekichika` | POST | システム内部 | 駅ちか送信 |
| `/api/diary/retry-failed-dispatch` | POST | スタッフ | 送信失敗のリトライ |
| `/api/diary/favorite` | POST/DELETE | 会員 | お気に入り登録 |
| `/api/diary/feed/favorites` | GET | 会員 | お気に入り会員のフィード |
| `/api/diary/tags/popular` | GET | 公開 | 人気タグ取得 |
| `/api/diary/search` | GET | 公開 | 全文検索 |

### 2.2 主要エンドポイント詳細

#### `POST /api/diary/post`

**リクエスト:**
```typescript
{
  therapistId: number,            // ログイン中のセラピスト
  authToken: string,              // セラピストマイページのセッショントークン
  title: string,                  // 必須、最大80文字
  body: string,                   // 必須、最大2000文字
  visibility: 'public' | 'members_only',
  images: {                       // 画像は base64 で受け取り、サーバーで Storage 保存
    base64: string,
    mediaType: 'image/jpeg' | 'image/png' | 'image/webp',
    caption?: string
  }[],                            // 1〜10枚
  tags: string[],                 // タグ名（'#' なし、最大10個）
  scheduledAt?: string,           // ISO日時（Phase 2）
  sendToEkichika: boolean         // visibility='public' の時のみ true 可能
}
```

**処理フロー:**
```
1. セラピスト認証確認 (therapists.login_email + token)
2. バリデーション
   - title: 1〜80文字
   - body: 1〜2000文字
   - images: 1〜10枚、各 5MB 以下
   - visibility と sendToEkichika の整合性チェック
3. 画像処理（順次）
   - Sharp で WebP 変換 + リサイズ（最大1920px）
   - サムネイル生成（最大600px）
   - Supabase Storage `therapist-diary` バケットへアップロード
   - therapist_diary_images に INSERT
4. therapist_diary_entries に INSERT (status='published')
5. タグ処理
   - 新規タグは therapist_diary_tags に作成
   - therapist_diary_entry_tags に中間レコード作成
   - 既存タグは use_count++
6. 駅ちか送信（visibility='public' && sendToEkichika=true の場合）
   - 非同期で /api/diary/dispatch-ekichika を呼ぶ
   - レスポンスは待たない（投稿成功のレスポンスを先に返す）
7. プッシュ通知（お気に入り会員へ、Phase 3）
8. レスポンス返却
```

**レスポンス:**
```typescript
{
  success: true,
  entryId: number,
  publishedAt: string,
  hpUrl: string,                  // https://ange-spa.com/diary/[id]
  ekichikaDispatchScheduled: boolean
}
```

#### `POST /api/diary/dispatch-ekichika` (内部 API)

**処理フロー:**
```
1. entry_id を受け取り therapist_diary_entries から記事取得
2. ekichika_post_settings から該当セラピストの駅ちかメアド取得
3. is_active=false ならスキップ（ekichika_dispatch_status='skipped'）
4. nodemailer でメール送信
   subject: title
   body: body のプレーンテキスト
   from: 設定された送信元アドレス
   to: ekichika_email
   attachments: 画像（最大10枚）を Storage から取得して添付
5. 送信成功:
   - ekichika_dispatch_logs に status='sent' で記録
   - entries.ekichika_dispatched_at = NOW()
   - entries.ekichika_dispatch_status = 'sent'
   - settings.last_sent_at, total_sent_count 更新
6. 送信失敗:
   - ekichika_dispatch_logs に status='failed' で記録
   - entries.ekichika_dispatch_status = 'failed'
   - 3回までリトライ（指数バックオフ: 1分→5分→15分）
```

**実装上の注意:**
- メール添付容量上限: 25MB（駅ちか側の上限を確認必要）
- 画像は Storage から都度ダウンロードしてバッファに変換
- nodemailer の `attachments` 配列に渡す
- HTMLメール（デコメ）対応: Phase 2 で検討

#### `GET /api/diary/list`

**クエリパラメータ:**
```
?therapistId=123       (任意、特定セラピストのみ)
&tag=新人              (任意、タグフィルタ)
&q=キーワード          (任意、全文検索)
&visibility=public     ('public' | 'members_only' | 'all'(会員のみ))
&memberAuth=token      (会員認証トークン、members_only/all 取得時必須)
&limit=20
&offset=0
&sortBy=newest         ('newest' | 'popular' | 'most_liked')
```

**レスポンス:**
```typescript
{
  entries: {
    id: number,
    therapist: {
      id: number,
      name: string,
      avatarUrl: string,
      isWorkingToday: boolean   // 本日出勤中バッジ用
    },
    title: string,
    bodyPreview: string,         // 本文先頭100文字
    coverImageUrl: string,
    imageCount: number,
    visibility: 'public' | 'members_only',
    tags: { name: string, displayName: string, color: string }[],
    likeCount: number,
    commentCount: number,
    viewCount: number,
    publishedAt: string,
    isLikedByMe: boolean,        // 会員ログイン時のみ
  }[],
  total: number,
  hasMore: boolean
}
```

**重要:** `visibility='members_only'` の記事は **会員ログイン時のみ** 返す。
非会員には存在自体を見せない（プレビューだけ見せて煽る作戦は別途検討可）。

#### `GET /api/diary/[id]`

会員限定記事の場合は memberAuth トークン検証必須。
**閲覧時に view_count をインクリメント**（同一 IP/ユーザーは10分以内は重複カウントしない）。

#### `POST /api/diary/like` / `DELETE /api/diary/like`

会員のみ操作可能。トグル方式。
`like_count` は同一トランザクションで更新。

#### `POST /api/diary/comment`

会員のみ。
**NGワードフィルタ**を入れる（Phase 2、設定可能なリスト）。

### 2.3 セラピスト認証

写メ日記の投稿は既存のセラピストマイページのセッション認証を流用。
`therapists.login_email + login_password` でログイン → sessionStorage に保存されたトークンを使用。

API 側では：
```typescript
async function verifyTherapistAuth(therapistId: number, token: string) {
  // 簡易版: sessionStorage に保存された JSON とサーバーで再検証
  // 本格版: JWT 化を Phase 2 で検討
}
```

### 2.4 会員認証

お客様マイページ（`customer-mypage`）の既存セッションを使用。
詳細は既存実装を確認した上で擦り合わせる。

---

## 📱 3. UI 設計（セラピスト側）

### 3.1 マイページに「📸 写メ日記」タブを追加

既存の8タブ（ホーム/シフト希望/出勤予定/給料明細/お客様/マニュアル/確定申告/証明書）に **9つ目のタブ** として追加。

```
🏠 ホーム / 📝 シフト希望 / 📅 出勤予定 / 💰 給料明細 / 👤 お客様
📖 マニュアル / 📊 確定申告 / 📄 証明書 / 📸 写メ日記 ← NEW
```

### 3.2 写メ日記タブの画面構成

```
┌─────────────────────────────────────────┐
│  📸 写メ日記                              │
│                                          │
│  ┌────────────────────────────────────┐ │
│  │ ✏️ 新しい日記を書く             →  │ │
│  └────────────────────────────────────┘ │
│                                          │
│  🟢 今月の投稿: 18件 (目標 20件)          │
│  ❤️ 今月のいいね: 234件                   │
│  👀 今月の閲覧数: 5,678回                 │
│                                          │
│  ─────────────────────────────────────   │
│                                          │
│  📜 過去の投稿                            │
│                                          │
│  ┌────────────────────────────────────┐ │
│  │ [画像] 久しぶりの出勤です♪          │ │
│  │        ❤️ 12  💬 3  👀 145          │ │
│  │        2026/4/24 21:30              │ │
│  │        🌐 全公開                     │ │
│  │        [✏️ 編集] [🗑 削除]            │ │
│  └────────────────────────────────────┘ │
│                                          │
│  ┌────────────────────────────────────┐ │
│  │ [画像] 今日のお礼です♡               │ │
│  │        ❤️ 8   💬 1  👀 89           │ │
│  │        2026/4/22 18:15              │ │
│  │        🔒 会員限定                   │ │
│  │        [✏️ 編集] [🗑 削除]            │ │
│  └────────────────────────────────────┘ │
│                                          │
└─────────────────────────────────────────┘
```

### 3.3 投稿モーダル / 投稿画面

タブ内で「✏️ 新しい日記を書く」を押すと、フルスクリーンの投稿画面が開く。

```
┌─────────────────────────────────────────┐
│  ← 戻る              📸 新しい日記        │
│                                          │
│  ┌────────────────────────────────────┐ │
│  │ 📷 写真を追加 (最大10枚)            │ │
│  │                                    │ │
│  │ [📷] [📷] [📷] [+追加]              │ │
│  │                                    │ │
│  │ ※ 1枚目がカバー画像になります        │ │
│  └────────────────────────────────────┘ │
│                                          │
│  ┌────────────────────────────────────┐ │
│  │ タイトル (最大80文字)               │ │
│  │ ──────────────────────────────────  │ │
│  │ 久しぶりの出勤です♪                 │ │
│  └────────────────────────────────────┘ │
│                                          │
│  ┌────────────────────────────────────┐ │
│  │ 本文 (最大2000文字)                 │ │
│  │ ──────────────────────────────────  │ │
│  │ 今日は3週間ぶりの出勤でした！       │ │
│  │ 久しぶりだったけどリピーターさんに  │ │
│  │ 会えて嬉しかったです♡               │ │
│  │                                    │ │
│  │                                    │ │
│  │                                    │ │
│  │ 残り 1,892 文字                    │ │
│  └────────────────────────────────────┘ │
│                                          │
│  ┌────────────────────────────────────┐ │
│  │ 🏷️ タグを選ぶ (最大10個)            │ │
│  │ ──────────────────────────────────  │ │
│  │ よく使うタグ:                       │ │
│  │ [#今日の私] [#お礼] [#出勤]         │ │
│  │ [#新人] [#久しぶり]                 │ │
│  │                                    │ │
│  │ 自分で追加: [入力欄] [+追加]        │ │
│  │                                    │ │
│  │ 選択中: #出勤 ❌ #久しぶり ❌        │ │
│  └────────────────────────────────────┘ │
│                                          │
│  ┌────────────────────────────────────┐ │
│  │ 公開範囲                            │ │
│  │ ──────────────────────────────────  │ │
│  │ ⦿ 🌐 全公開                          │ │
│  │   HP・駅ちかなど全てに公開           │ │
│  │                                    │ │
│  │ ○ 🔒 会員限定                       │ │
│  │   HPの会員専用ページのみ            │ │
│  │   駅ちかには送りません              │ │
│  └────────────────────────────────────┘ │
│                                          │
│  ┌────────────────────────────────────┐ │
│  │ 駅ちか連動 (全公開時のみ)           │ │
│  │ ──────────────────────────────────  │ │
│  │ ☑️ 駅ちか + 6サイトに同時投稿        │ │
│  │   メンエスマップ・口コミ情報局      │ │
│  │   など6つのポータルに自動転送       │ │
│  └────────────────────────────────────┘ │
│                                          │
│  ┌────────────────────────────────────┐ │
│  │  📤 投稿する                        │ │
│  └────────────────────────────────────┘ │
│                                          │
│  [💾 下書き保存]                         │
└─────────────────────────────────────────┘
```

### 3.4 UX のこだわりポイント

- **画像アップロード**: 複数枚を一括選択可能。スマホは「カメラ」「ライブラリ」両方対応
- **画像の並び替え**: ドラッグで順序変更可能（HTML5 DnD）
- **画像の削除**: 各画像にピボットの「×」ボタン
- **タイトル/本文の自動保存**: 1秒ごとに sessionStorage に保存（誤操作防止）
- **投稿前プレビュー**: 「📤 投稿する」前に「👁️ プレビュー」ボタンで HP の見え方確認
- **絵文字パレット**: 本文入力時に簡単に絵文字を入れられるショートカット
- **下書き機能**: `therapist_diary_entries.status='draft'` として保存（Phase 2）

### 3.5 セラピスト向け統計画面

写メ日記タブの上部に統計カードを表示。やる気が出る指標を中心に：

- **今月の投稿数 + 目標達成度**（目標は管理画面で設定可能）
- **今月のいいね数 + 前月比**
- **今月の閲覧数 + 前月比**
- **コメント未返信件数**（赤バッジで通知）
- **人気記事 TOP3**
- **連続投稿日数**（GitHub Contributions ライク）

---

## 🔧 4. UI 設計（管理画面側）

### 4.1 新規メニュー: `/diary-moderation`

`lib/nav-menu.tsx` のセラピストカテゴリに追加：
```
💆 セラピスト
  └── 📸 写メ日記モデレーション (NEW)
```

権限: `isManager` 以上。

### 4.2 モデレーション画面

```
┌─────────────────────────────────────────────────────────┐
│ 📸 写メ日記モデレーション                                  │
│                                                          │
│ ┌─ 統計サマリー ──────────────────────────────────────┐ │
│ │ 📝 今月の投稿数: 156件                               │ │
│ │ 🌐 全公開: 142  🔒 会員限定: 14                       │ │
│ │ ❤️ 総いいね: 2,341  💬 総コメント: 245                │ │
│ │ 📤 駅ちか送信成功率: 98.2% (153/156)                 │ │
│ │ ⚠️ 送信失敗: 3件 [リトライ]                          │ │
│ └────────────────────────────────────────────────────┘ │
│                                                          │
│ ┌─ フィルタ ──────────────────────────────────────────┐ │
│ │ [全て] [全公開] [会員限定] [削除済み] [駅ちか失敗]   │ │
│ │ セラピスト: [▼ 全員]  期間: [今月 ▼]                 │ │
│ │ 🔍 タイトル・本文検索: [_______________]              │ │
│ └────────────────────────────────────────────────────┘ │
│                                                          │
│ ┌─ 投稿一覧 ──────────────────────────────────────────┐ │
│ │                                                      │ │
│ │ ┌──────────────────────────────────────────────┐ │ │
│ │ │ [画像] 久しぶりの出勤です♪                    │ │ │
│ │ │        by ゆめ姫 (@yumehime)                 │ │ │
│ │ │        2026/4/24 21:30                       │ │ │
│ │ │        🌐全公開 ❤️12 💬3 👀145                │ │ │
│ │ │        ✅駅ちか送信済み (15:31)               │ │ │
│ │ │                                              │ │ │
│ │ │  [👁️ 詳細] [✏️ 編集] [🗑 削除] [📤 駅ちか再送]  │ │ │
│ │ └──────────────────────────────────────────────┘ │ │
│ │                                                      │ │
│ │ ┌──────────────────────────────────────────────┐ │ │
│ │ │ [画像] 今日のお礼♡                            │ │ │
│ │ │        by あいり                              │ │ │
│ │ │        2026/4/24 18:15                       │ │ │
│ │ │        🔒会員限定 ❤️8 💬1 👀89                │ │ │
│ │ │                                              │ │ │
│ │ │  [👁️ 詳細] [✏️ 編集] [🗑 削除]                 │ │ │
│ │ └──────────────────────────────────────────────┘ │ │
│ │                                                      │ │
│ └────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### 4.3 編集モーダル

スタッフ編集時:
- セラピストの投稿モーダルとほぼ同じ UI
- ヘッダーに「⚠️ スタッフ編集モード」バッジ
- 編集後は edited_by_staff_id, edited_at が記録される
- ⚠️注意:「駅ちかには反映されません」の注記表示
- 編集理由を任意入力（履歴に残す、Phase 2で履歴テーブル作る）

### 4.4 削除フロー

「🗑 削除」ボタン押下時:
1. 確認モーダル
2. 削除理由を選択（プルダウン）
   - 不適切な内容
   - セラピスト退職
   - 重複投稿
   - 写真の問題
   - その他（テキスト入力）
3. ⚠️「駅ちかからは手動で削除する必要があります」注意喚起
4. 論理削除（deleted_at + deleted_by_staff_id + delete_reason）

### 4.5 コメント管理画面 `/diary-comments`

セラピストごとの未返信コメント一覧 + NG ワードでフラグされたコメント。
スタッフがセラピストに代わって返信することも可能（権限制御）。

### 4.6 駅ちか設定画面 `/ekichika-settings`

```
┌─────────────────────────────────────────────────────────┐
│ 📧 駅ちか同時投稿設定                                      │
│                                                          │
│ 各セラピストの駅ちか専用投稿メールアドレスを設定。         │
│ T-MANAGE で写メ日記を投稿すると、ここに登録された          │
│ アドレスへ自動でメール送信されます。                       │
│                                                          │
│ ┌──────────────────────────────────────────────┐ │
│ │ セラピスト名 │ 駅ちかメアド │ 状態 │ 送信数 │ 操作  │ │
│ ├──────────────────────────────────────────────┤ │
│ │ ゆめ姫       │ 8f4cc...    │ ✅有効 │ 156   │ [編集]│ │
│ │ あいり       │ b7e23...    │ ✅有効 │ 89    │ [編集]│ │
│ │ さくら       │ 未設定       │ ❌無効 │ 0     │ [追加]│ │
│ └──────────────────────────────────────────────┘ │
│                                                          │
│ 📝 メアドの取得方法:                                      │
│ 1. 駅ちか管理画面にログイン                                │
│ 2. 各セラピストの写メ日記投稿ページを開く                  │
│ 3. メールアドレス欄をコピー                                │
│ 4. ここに貼り付け                                         │
│                                                          │
│ ⚠️ メアドが流出すると勝手に投稿される可能性があるため        │
│    取扱注意                                               │
└─────────────────────────────────────────────────────────┘
```


---

## 🌐 5. HP 表示設計 (ange-spa.com)

写メ日記はサロンの主力コンテンツ。**SEO 強化** + **ユーザー体験** の両軸で設計。

### 5.1 ページ構成

| URL | 用途 |
|---|---|
| `/diary` | 全体タイムライン（新着順） |
| `/diary?tag=新人` | タグフィルタ |
| `/diary/popular` | 人気記事（週間/月間） |
| `/diary/search?q=...` | 全文検索結果 |
| `/diary/[id]` | 個別記事ページ |
| `/diary/therapist/[therapistId]` | セラピスト個別タイムライン |
| `/diary/members-only` | 会員限定記事一覧（要ログイン） |
| `/therapist/[id]` | セラピスト紹介ページ（既存）に「最新の写メ日記」セクション追加 |

### 5.2 タイムラインページ `/diary`

```
┌─────────────────────────────────────────────────────────┐
│  Ange Spa ロゴ           [ホーム] [セラピスト] [写メ日記]   │
│                          [予約] [会員ページ] [ログイン]    │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  📸 写メ日記                                              │
│  セラピストたちの日常をお届け                              │
│                                                          │
│  ┌─ 検索・フィルタ ───────────────────────────────────┐ │
│  │ 🔍 [_____________________] [検索]                 │ │
│  │                                                    │ │
│  │ 並び順: ⦿新着 ○人気 ○いいね順                     │ │
│  │                                                    │ │
│  │ 人気タグ:                                          │ │
│  │ [#今日の私] [#お礼] [#新人] [#出勤] [#久しぶり]    │ │
│  │ [#衣装] [#カフェ] [#プライベート] [もっと見る]      │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  ┌─ 会員限定への誘導バナー ────────────────────────────┐ │
│  │ 🔒 会員限定の写メ日記もあります                     │ │
│  │ 無料登録で限定コンテンツが見られます → [会員登録]   │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  📅 2026年4月25日 (本日)                                 │
│                                                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ │
│  │ [画像]   │ │ [画像]   │ │ [画像]   │ │ [画像]   │ │
│  │          │ │          │ │          │ │          │ │
│  │ ゆめ姫    │ │ あいり    │ │ さくら    │ │ ひより    │ │
│  │ 久しぶり… │ │ 今日のお… │ │ 出勤しま… │ │ 新作の…  │ │
│  │ ❤️12 💬3 │ │ ❤️8  💬1 │ │ ❤️15 💬5│ │ ❤️20 💬7│ │
│  │ #出勤    │ │ #お礼    │ │ #新人    │ │ #衣装    │ │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ │
│                                                          │
│  📅 2026年4月24日                                        │
│                                                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ │
│  │ ...     │ │ ...     │ │ ...     │ │ ...     │ │
│                                                          │
│  [もっと読む ↓]                                           │
└─────────────────────────────────────────────────────────┘
```

### 5.3 個別記事ページ `/diary/[id]`

```
┌─────────────────────────────────────────────────────────┐
│  ← 一覧に戻る                                             │
│                                                          │
│  ┌────────────────────────────────────────────────┐    │
│  │                                                │    │
│  │            [カバー画像 大きく表示]              │    │
│  │                                                │    │
│  │    [<] [画像1/4] [>]  ← スワイプ可             │    │
│  │                                                │    │
│  │    [サムネイル1] [サムネイル2] [3] [4]          │    │
│  └────────────────────────────────────────────────┘    │
│                                                          │
│  ╔════════════════════════════════════════════════╗    │
│  ║ 久しぶりの出勤です♪                            ║    │
│  ║                                                ║    │
│  ║ [👤 ゆめ姫] @yumehime · 2026/4/25 21:30        ║    │
│  ║ ✅ 本日出勤中 [予約する]                        ║    │
│  ╚════════════════════════════════════════════════╝    │
│                                                          │
│  今日は3週間ぶりの出勤でした！                            │
│  久しぶりだったけどリピーターさんに会えて嬉しかったです♡  │
│                                                          │
│  [#出勤] [#久しぶり] [#お礼]                              │
│                                                          │
│  ❤️ 12  💬 3  👀 145                                     │
│                                                          │
│  ┌─ アクションバー (会員のみ) ──────────────────────┐   │
│  │ [❤️ いいね] [💬 コメント] [⭐ お気に入り] [🔗 共有]│   │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  💬 コメント (3)                                          │
│                                                          │
│  ┌─────────────────────────────────────────────────┐  │
│  │ [👤] お客様A · 2分前                              │  │
│  │ お疲れ様です！また予約しますね♪                    │  │
│  │   ↳ ゆめ姫: ありがとうございます♡                  │  │
│  └─────────────────────────────────────────────────┘  │
│                                                          │
│  ┌─ コメントを書く (会員のみ) ──────────────────────┐  │
│  │ [_____________________________________________] │  │
│  │ [送信]                                           │  │
│  └─────────────────────────────────────────────────┘  │
│                                                          │
│  ┌─ 関連記事 ────────────────────────────────────────┐ │
│  │ 同じセラピストの最新記事                            │ │
│  │ [記事1] [記事2] [記事3]                            │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  ┌─ おすすめタグ ────────────────────────────────────┐ │
│  │ [#出勤] [#久しぶり] [#お礼]                        │ │
│  └────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### 5.4 セラピスト個別タイムライン `/diary/therapist/[id]`

セラピスト紹介ページ（既存）の下部に統合する形でも良い。

- そのセラピストの過去全投稿を新着順
- プロフィール、本日のシフト、予約導線を上部に
- 投稿数、いいね総数、フォロワー数（お気に入り登録数）を表示

### 5.5 SEO 最適化

- **構造化データ** (`Schema.org`):
  - `BlogPosting` を各記事に
  - `Person` をセラピストに紐付け
  - `Organization` をサロンに
- **OGP**:
  - 記事タイトルとカバー画像を `og:title` `og:image` に
  - LINE/Twitter シェア時に映える
- **sitemap.xml**:
  - 動的生成（`/diary` 以下を全記事 + タグページ）
- **canonical URL**:
  - 個別記事は `/diary/[id]` を canonical に
- **alt テキスト**:
  - 画像の caption をそのまま alt に
- **更新頻度**:
  - sitemap の `<lastmod>` で最新投稿日を反映

### 5.6 デザインシステム

T-MANAGE 内部のダーク基調とは違い、**HP 側はサロンブランドに合わせた華やかなデザイン**。
既存の ange-spa.com の世界観を崩さない（既存サイトを確認した上でトーン合わせ）。

カラー候補:
- **メイン**: サロンのブランドカラー (ピンクゴールド系)
- **アクセント**: 写メ日記カードに微細なグラデーション
- **読みやすさ**: 本文は黒文字 + 適度な行間

### 5.7 パフォーマンス対応

- 画像 lazy loading（`loading="lazy"`）
- ファーストビューだけ即時、それ以降はスクロール時
- WebP 配信（既に Storage で WebP 化済み）
- カバー画像は `srcset` でレスポンシブ
- ページネーション or 無限スクロール（推奨：無限スクロール）
- 1ページあたり 12〜20件

---

## 🔐 6. 会員限定タブ設計

会員限定写メ日記は**お客様マイページ登録の最大の動機づけ**となる重要機能。

### 6.1 入口の設計

#### お客様マイページに「💎 限定写メ日記」タブを追加

```
予約一覧 / お気に入り / プッシュ通知 / 会員情報 / 💎 限定写メ日記 (NEW)
```

#### HP の各所からの導線

1. **写メ日記タイムラインに「会員限定への誘導バナー」を表示**
   ```
   🔒 会員限定の写メ日記もあります
   無料登録で限定コンテンツが見られます → [会員登録]
   ```

2. **個別記事の下部に「もっと見たい？会員限定もあるよ」**

3. **セラピスト紹介ページに「このセラピストの会員限定日記 (X件)」**
   - 会員でない場合: タイトルだけ見せて画像はぼかし表示
   - 「会員登録するとすべて見られます」CTA

### 6.2 会員限定タイムラインページ `/diary/members-only`

```
┌─────────────────────────────────────────────────────────┐
│  💎 限定写メ日記                                          │
│                                                          │
│  会員様だけが見られる特別な投稿です♡                       │
│                                                          │
│  ┌─ フィルタ ──────────────────────────────────────────┐ │
│  │ [全て] [お気に入りセラピストのみ] [今日の出勤者]    │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  📅 2026年4月25日                                        │
│                                                          │
│  ┌────────────────────────────────────────────┐         │
│  │ [画像]                                      │         │
│  │  💎 限定                                     │         │
│  │  ゆめ姫 · 30分前                              │         │
│  │  本日のお礼です♡ プライベートな…              │         │
│  │  ❤️ 5  💬 2                                  │         │
│  └────────────────────────────────────────────┘         │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### 6.3 会員限定機能の運用ガイドライン

セラピストへの説明用：

- **会員限定 = 駅ちかには送らない**
- 会員さんだけが見られる、ちょっと特別な内容に
- お礼・本音・プライベート寄りの内容、ファンを大事にする投稿に向く
- 過激な内容は禁止（一般公開と同じ運用ルール）

### 6.4 非会員向けプレビュー戦略

「会員限定です」とだけ表示するより、**会員登録を促す導線**が有効：

```
┌────────────────────────────────────────┐
│ [画像をぼかして表示]                     │
│                                        │
│ 💎 限定写メ日記                          │
│                                        │
│ ゆめ姫 · 30分前                          │
│ 「本日のお礼です♡ プライベートな…」      │
│                                        │
│ 🔒 続きは会員登録で見られます (無料)      │
│ [今すぐ会員登録]                         │
└────────────────────────────────────────┘
```

### 6.5 通知設計（Phase 3）

会員のお気に入りセラピストが投稿した時：

1. **プッシュ通知**（Web Push API）
   - お客様マイページで通知許可を取得済みの場合
   - 「ゆめ姫さんが新しい日記を投稿しました」
   
2. **プッシュ通知の頻度制限**
   - 同一会員に対して **1日3通まで**（うざがられないように）
   - 「お気に入り全員」「特定セラピストのみ」を会員側で選択可能

3. **メール通知**（オプション、デフォルト OFF）
   - 1日 or 1週間まとめて送る形

---

## 📧 7. 駅ちか連携詳細

### 7.1 メール投稿の仕様（推定 + 検証必須）

画像から読み取れる情報をもとに想定。**実装前に検証必要**：

| 項目 | 想定値 | 検証要否 |
|---|---|---|
| 件名 | 写メ日記タイトル | 要確認 |
| 本文 | 写メ日記本文（プレーンテキスト） | 要確認 |
| 添付画像 | 1〜10枚、JPEG/PNG | 要確認（最大枚数・サイズ） |
| 画像順序 | 添付順 = 投稿時の表示順 | 要確認 |
| HTML メール対応 | デコメ可能性あり | 要確認 |
| エンコーディング | UTF-8 | 要確認 |
| 画像形式 | JPEG/PNG | WebP 不可の可能性 |

### 7.2 駅ちか送信の実装

`/api/diary/dispatch-ekichika`:

```typescript
import nodemailer from 'nodemailer';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  const { entryId } = await req.json();
  
  // 1. エントリ取得
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const { data: entry } = await supabase
    .from('therapist_diary_entries')
    .select('*, therapist_diary_images(*)')
    .eq('id', entryId)
    .single();
  
  if (!entry || entry.visibility !== 'public') {
    return NextResponse.json({ error: 'Not public' }, { status: 400 });
  }
  
  // 2. 駅ちか設定取得
  const { data: settings } = await supabase
    .from('ekichika_post_settings')
    .select('*')
    .eq('therapist_id', entry.therapist_id)
    .eq('is_active', true)
    .single();
  
  if (!settings) {
    await markDispatchSkipped(entryId, '駅ちか設定なし');
    return NextResponse.json({ skipped: true });
  }
  
  // 3. 画像をダウンロード（Storage → Buffer）
  const attachments = [];
  for (const img of entry.therapist_diary_images.sort((a,b) => a.sort_order - b.sort_order)) {
    const path = img.image_url.replace(/^.*\/therapist-diary\//, '');
    const { data: blob } = await supabase.storage
      .from('therapist-diary')
      .download(path);
    const buffer = Buffer.from(await blob.arrayBuffer());
    attachments.push({
      filename: `image_${img.sort_order + 1}.webp`,
      content: buffer,
    });
  }
  
  // 4. nodemailer 送信
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });
  
  try {
    const info = await transporter.sendMail({
      from: `"アンジュスパ" <${process.env.GMAIL_USER}>`,
      to: settings.ekichika_email,
      subject: entry.title,
      text: entry.body,
      attachments,
    });
    
    // 5. ログ記録
    await supabase.from('ekichika_dispatch_logs').insert({
      entry_id: entryId,
      therapist_id: entry.therapist_id,
      ekichika_email: settings.ekichika_email,
      subject: entry.title,
      body_text: entry.body,
      image_count: attachments.length,
      total_size_bytes: attachments.reduce((s, a) => s + a.content.length, 0),
      status: 'sent',
      smtp_response: info.response,
      sent_at: new Date().toISOString(),
    });
    
    await supabase.from('therapist_diary_entries').update({
      ekichika_dispatch_status: 'sent',
      ekichika_dispatched_at: new Date().toISOString(),
    }).eq('id', entryId);
    
    await supabase.from('ekichika_post_settings').update({
      last_sent_at: new Date().toISOString(),
      total_sent_count: settings.total_sent_count + 1,
    }).eq('id', settings.id);
    
    return NextResponse.json({ success: true, messageId: info.messageId });
  } catch (error) {
    // 失敗ログ + リトライキューイング
    await markDispatchFailed(entryId, error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

### 7.3 リトライ戦略

送信失敗時:
1. **即座**: 1回目自動リトライ
2. **5分後**: 2回目リトライ（cron / Vercel Cron）
3. **30分後**: 3回目リトライ
4. **失敗確定**: スタッフに通知（管理画面に赤バッジ）

リトライは Vercel Cron Jobs 推奨：
```typescript
// vercel.json
{
  "crons": [{
    "path": "/api/diary/retry-failed-dispatch",
    "schedule": "*/15 * * * *"  // 15分ごと
  }]
}
```

### 7.4 検証フェーズ（リリース前必須）

実装に入る前に、以下を **手動検証**：

1. **駅ちか管理画面で1人テスト用にメアド取得**
2. **手動で Gmail から1通送信**してみる
   - 件名/本文/画像1枚 → 駅ちかに反映されるか
3. **画像複数枚送信**（2枚, 5枚, 10枚で挙動確認）
4. **画像形式テスト**（JPEG/PNG/WebP のうちどれが OK か）
5. **画像サイズテスト**（1MB, 5MB, 10MB で上限確認）
6. **6ポータルへの転送タイミング確認**（即時 or 数分遅延）
7. **同時投稿失敗時の挙動**（1ポータルだけ失敗 → 他は成功する？）

検証結果をまとめてから本実装する。

### 7.5 駅ちか送信時の本文整形

セラピストの本文に T-MANAGE 独自記法（`[link:...]` 等）が含まれている場合は除去：

```typescript
function formatBodyForEkichika(body: string): string {
  return body
    .replace(/\[link:[^\]]+\]/g, '')           // T-MANAGE記法除去
    .replace(/\[catlink:[^\]]+\]/g, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')      // markdown画像除去
    .trim();
}
```

ただし、ハッシュタグ（`#xxx`）はそのまま送信。駅ちか側もタグ機能あり。

---

## 🚀 8. 実装フェーズ計画

リリースを段階的に分けて、6/1 までに **Phase 1** を確実に終わらせる。

### Phase 1: MVP（6/1 本番運用までに完成）

**目的**: 最小限の機能で運用開始できる状態にする

✅ 含むもの:
- DB テーブル全作成（`session65_diary_system.sql`）
- API: post / list / dispatch-ekichika / get / update / delete / view
- セラピストマイページに📸写メ日記タブ
  - 投稿モーダル（基本機能）
  - 過去投稿一覧
  - 簡易統計（投稿数のみ）
- HP: タイムライン + 個別記事ページ + セラピストごと
- 管理画面: モデレーション基本機能（一覧/編集/削除）
- 駅ちか設定画面 + 駅ちか送信機能
- 公開範囲（全公開/会員限定）
- 会員限定タブの基本実装

❌ 含まないもの:
- いいね・コメント機能 → Phase 2
- プッシュ通知 → Phase 3
- 全文検索 → Phase 2
- 統計詳細 → Phase 2
- スケジュール投稿 → Phase 3
- 下書き機能 → Phase 2

**工期見積**: 2〜3週間（5/1〜5/22 開発 + 5/23〜5/31 検証/微調整）

### Phase 2: エンゲージメント強化（7月中）

- いいね機能（会員のみ）
- コメント機能（会員のみ + セラピスト返信）
- 全文検索
- タグページ + 人気タグ
- セラピスト統計画面（連続投稿日数等）
- 下書き機能
- HTML メール（デコメ）対応の検討
- 編集履歴

### Phase 3: 通知・自動化（8月中）

- Web Push 通知
- メール通知（ダイジェスト）
- スケジュール投稿
- お客様の「お気に入り」フィード
- 関連記事レコメンド

### Phase 4: 高度化（9月以降）

- 動画投稿対応
- AI による NG ワード検出
- AI による投稿内容アドバイス（「もっといいねもらえそうな書き方」サジェスト）
- インスタ・X への同時投稿
- 投稿パフォーマンス分析（どの時間帯/タグが人気か）

---

## 🎯 KPI とゴール

### Phase 1 リリース後 1ヶ月での目標

| 指標 | 目標 |
|---|---|
| セラピストの投稿利用率 | 70% 以上が月1回以上投稿 |
| 月間投稿数 | 300件以上 |
| 駅ちか送信成功率 | 95%以上 |
| HP 写メ日記ページ PV | 月1万 PV |
| 1記事平均閲覧数 | 50 PV 以上 |

### Phase 2 リリース後 3ヶ月

| 指標 | 目標 |
|---|---|
| 会員登録者数 | 500人以上 |
| 会員限定記事の閲覧率 | 会員1人あたり週3記事 |
| いいね数 / 記事 | 平均10いいね |
| コメント返信率（セラピスト） | 80% |

---

## ⚠️ リスクと対策

| リスク | 対策 |
|---|---|
| 駅ちかが仕様変更で受信不可になる | nodemailer のエラーをキャッチして即座に通知。フォールバックとして Playwright での投稿手段も Phase 4 で検討 |
| セラピストが不適切な投稿を行う | 事後修正可の運用 + 管理画面の通知強化 + 利用規約に明文化 |
| 画像の Storage 容量超過 | 古い画像は半年経過で自動削除（DB レコードは残す）or 圧縮率向上 |
| API コスト | nodemailer + Storage は安価。問題は AI 連携が増えた場合のみ |
| 駅ちかメアドの流出 | T-MANAGE 内でマスク表示。アクセスログ取得 |
| 会員限定記事のスクショ流出 | 完全防御は不可能。透かし入れる程度（Phase 4） |

---

## 📋 セッション開始時の確認事項

実装セッション開始時には以下を確認:

1. ✅ この設計書（`08_DIARY_DESIGN.md`）を読む
2. ✅ 駅ちかメール投稿の検証が完了しているか
3. ✅ ange-spa.com の写メ日記表示エリアの設計が固まっているか
4. ✅ 既存のセラピストマイページ認証フローを把握
5. ✅ 既存のお客様マイページ会員認証フローを把握
6. ✅ Phase 1 のスコープから外れる機能を実装しないよう注意

---

## 関連ドキュメント
- `00_README.md` — 索引
- `02_FEATURES.md` — 既存機能（マイページ・マニュアル等）の仕様
- `04_DATABASE.md` — 既存テーブル定義
- `05_SESSION_START.md` — 開発ルール・命名規則
- `06_EXTENSIONS.md` — エステ魂拡張（既存の類似実装の参考）
- `07_API_ROUTES.md` — 既存 API ルート

