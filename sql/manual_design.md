# 📖 マニュアルシステム 設計書

## コンセプト
- セラピストが「見たくなる」楽しいマニュアル
- スタッフが「更新したくなる」簡単な編集体験
- AIで検索・質問・記事整理をサポート

## 画面構成

### スタッフ側（ダッシュボード /dashboard 内）
- 📖 マニュアル管理ページ
- 記事一覧（カテゴリ別、閲覧数・既読状況表示）
- 記事編集（リッチエディタ + AI整理 + タグ自動生成）
- カテゴリ管理（アイコン・カラー・並び順）
- 📊 閲覧ランキング（🥇🥈🥉 + 読まれてない記事の警告）
- ✅ セラピスト既読確認（誰が読んだか一覧）
- Claudeチャットからも記事追加・編集可能

### セラピスト側（マイページ 📖タブ）
- カテゴリフィルタ + キーワード検索
- 📌 ピン留め記事がトップに表示
- 🆕 新着バッジ（キラッとアニメーション）
- ✅ 読了マーク（達成感）
- 🔔 ホームタブに更新通知バッジ
- 🤖 AIチャット（マニュアル内容ベースで質問回答）
- 記事内に画像・YouTube・直接アップロード動画を表示

## データベース設計

### manual_categories
```sql
CREATE TABLE manual_categories (
  id serial PRIMARY KEY,
  name text NOT NULL,
  icon text DEFAULT '📄',
  color text DEFAULT '#c3a782',
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
```

### manual_articles
```sql
CREATE TABLE manual_articles (
  id serial PRIMARY KEY,
  title text NOT NULL,
  category_id int REFERENCES manual_categories(id),
  content text NOT NULL DEFAULT '',
  tags text[] DEFAULT '{}',
  is_published boolean DEFAULT false,
  is_pinned boolean DEFAULT false,
  view_count int DEFAULT 0,
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

### manual_reads
```sql
CREATE TABLE manual_reads (
  id serial PRIMARY KEY,
  article_id int REFERENCES manual_articles(id) ON DELETE CASCADE,
  therapist_id int REFERENCES therapists(id) ON DELETE CASCADE,
  read_at timestamptz DEFAULT now(),
  UNIQUE(article_id, therapist_id)
);
```

## 技術スタック
- エディタ: React用リッチエディタ（TipTap or 自作）
- 画像: Supabase Storage（manual-images バケット）
- 動画: YouTube埋め込み + Supabase Storage直接アップロード
- AI: Claude API（Sonnet）- 記事整理、タグ生成、チャット回答
- マークダウンレンダリング: react-markdown or カスタム

## 実装フェーズ
- Phase 1: DBテーブル + スタッフ管理画面（CRUD+リッチエディタ）
- Phase 2: セラピストマイページ（📖タブ+検索+カテゴリ+ピン+新着）
- Phase 3: 🤖 AIチャット + AI整理 + タグ自動生成
- Phase 4: 📊 閲覧ランキング + 🔔 通知 + 📸 画像/動画

## API コスト見積もり
- 月約¥1,000（10件/日の質問 + 記事整理）
- Prompt caching使用で¥300〜500まで削減可能
