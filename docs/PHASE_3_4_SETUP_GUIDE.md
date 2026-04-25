# Phase 3-4 本番運用セットアップガイド

最終更新: Phase 4 完了時点

このガイドは、Phase 3 (写メ日記・ライブ配信) と Phase 4 (投げ銭・集客分析) の機能を本番運用するために、**スタッフが最初の1回だけ実施する作業**をまとめたものです。

---

## 📋 必要な作業チェックリスト

### Supabase マイグレーション実行

未実行の SQL ファイルを Supabase Dashboard の SQL Editor で順番に実行する。

- [ ] `sql/session67_diary_scheduled_publish.sql` (予約投稿)
- [ ] `sql/session68_bluesky_integration.sql` (Bluesky連携)
- [ ] `sql/session69_video_processing.sql` (動画リエンコード)
- [ ] `sql/session70_live_streaming.sql` (ライブ配信)
- [ ] `sql/session71_gift_system.sql` (投げ銭)
- [ ] `sql/session72_operations_manual_phase34.sql` (運用マニュアル記事)

実行手順:
1. Supabase Dashboard ([https://supabase.com/dashboard](https://supabase.com/dashboard)) にログイン
2. プロジェクト `cbewozzdyjqmhzkxsjqo` を選択
3. 左メニュー → SQL Editor → New query
4. 各ファイルの中身をコピペ → Run
5. エラーが出なければ次のファイルへ

---

### Supabase Storage バケット作成

ストーリー動画用に2つのバケットを手動作成する必要があります。

| バケット名 | Public | サイズ制限 |
|-----------|--------|----------|
| `therapist-videos-raw` | **OFF** (非公開) | 100MB |
| `therapist-videos` | **ON** (公開) | 50MB |

作成手順:
1. Supabase Dashboard → Storage
2. 「+ New bucket」
3. Name に上記の名前を入れる
4. Public toggle を上記の通り
5. File size limit を MB単位で入力
6. 「Save」

---

### LiveKit Cloud セットアップ (ライブ配信用)

#### Step 1: アカウント作成
1. [https://livekit.io/cloud](https://livekit.io/cloud) にアクセス
2. Sign Up → メールアドレスで登録
3. メール認証

#### Step 2: プロジェクト作成
1. ダッシュボード → 「+ Create Project」
2. Name: `Ange Spa T-MANAGE` など
3. Region: `Asia (Tokyo)` を選択（日本のお客様向けなので）
4. Create

#### Step 3: API認証情報取得
1. プロジェクト → Settings → Keys
2. 「+ Create Key」
3. 表示される以下を**メモ**:
   - **API Key**: `APIxxxxxxxx`
   - **API Secret**: `secretxxxxxxxxxxxxxxxxxxxxx` (画面閉じると見られない！)
   - **Server URL**: `wss://xxxx-xxxxxx.livekit.cloud`

#### Step 4: Vercel 環境変数設定
1. Vercel Dashboard → t-manage プロジェクト → Settings → Environment Variables
2. 以下3つを追加:
   ```
   LIVEKIT_API_KEY = APIxxxxxxxx
   LIVEKIT_API_SECRET = secretxxxxxxxxxxxxxxxxxxxxx
   LIVEKIT_WS_URL = wss://xxxx-xxxxxx.livekit.cloud
   ```
3. すべて「Production / Preview / Development」全環境で有効化
4. 「Save」
5. Vercel → Deployments で最新を「Redeploy」

#### Step 5: 動作確認
- マイページから対象セラピストを「ライブ配信許可」に設定
- そのセラピストでログイン → 配信開始 → 視聴できれば成功

#### 料金について
- 無料枠: 月10,000トラック分配信時間
- 計算例: 30分配信に100視聴者がいる場合、3,000分使用 → 月3回までは無料枠内
- 超過: $0.05/分 (執筆時点)
- 使用量はLiveKitダッシュボードで毎日確認可能

---

### セラピストへのライブ配信許可

1. T-MANAGE にスタッフでログイン
2. 左メニュー → セラピスト → 🎬 ライブ配信管理 (`/live-admin`)
3. 「👥 配信許可」タブ
4. 配信させたいセラピストの「停止中」ボタンをクリック → 「✓ 許可」になる
5. 即座にそのセラピストのマイページに配信ボタンが表示される

**推奨**: 信頼できるセラピストから順次解放。トラブル時は強制終了で対応。

---

### 既存セラピストへのアナウンス

新機能が増えたので、セラピストに使い方を共有する。

#### LINE で送る文面例

```
お疲れさまです。
T-MANAGE に新しい機能が追加されました！

📓 写メ日記 進化版
- 投稿予約機能（時刻指定で自動公開）
- AIに下書き提案ボタン（Claudeが3パターン提案）
- Bluesky自動連携（公開設定の日記が自動投稿）

🎬 ライブ配信
- 美顔・スタンプ・モザイクのフィルター付き
- お客様からハート・コメント・投げ銭が来る
- ※許可されたセラピストのみ使えます

🎁 投げ銭機能
- お客様がポイントでギフトを送れる
- マイページの「いただいた投げ銭」セクションで確認
- 累計・今月・今年それぞれ表示

詳しい使い方は T-MANAGE → 📖 マニュアル をご覧ください！
わからないことがあればチャットで聞いてください。
```

---

### テストデータの削除（本番運用直前）

開発・検証中に作ったテストデータをクリーンアップ。

```sql
-- ライブ配信テストデータ削除（本番前のみ実行）
DELETE FROM live_stream_views;
DELETE FROM live_stream_hearts;
DELETE FROM live_stream_comments;
DELETE FROM live_streams;

-- 投げ銭テストデータ削除（本番前のみ実行）
DELETE FROM gift_transactions;
DELETE FROM therapist_gift_points;

-- 動画処理ジョブ削除
DELETE FROM video_processing_jobs;

-- ストーリーテストデータ削除（本番前のみ実行）
-- DELETE FROM therapist_diary_stories WHERE deleted_at IS NULL;
-- ↑ 慎重に。実データが入っている可能性あり。

-- 投稿予約テストデータ削除（本番前のみ実行）
-- DELETE FROM therapist_diary_entries WHERE status = 'scheduled';
```

⚠ 上記のSQLは **本番運用開始直前** にのみ実行。
途中で実行すると実データも消えるので注意。

---

## ✅ セットアップ完了の確認

すべての作業が終わったら、以下を確認:

1. [ ] スタッフでログインしてライブ配信管理 (`/live-admin`) が開ける
2. [ ] スタッフでログインして集客分析 (`/marketing-analytics`) が開ける
3. [ ] テストセラピストに配信許可 → そのセラピストのマイページに配信ボタンが表示される
4. [ ] テストセラピストでライブ配信開始 → カメラとマイクが起動する
5. [ ] 別端末（または別ブラウザ）でログインして視聴 → 映像と音声が届く
6. [ ] 視聴側からハート・コメント・投げ銭を送れる
7. [ ] セラピストマイページの「いただいた投げ銭」に反映される

---

## 🎯 本番運用開始 (6/1) までのスケジュール例

```
5/15-5/20: SQL実行 + Storage作成 + LiveKit接続
5/21-5/25: テスト配信 (社内のみ)
5/26-5/30: 主要セラピストに許可付与 + 練習配信
5/31:      テストデータ削除
6/1:       本番運用開始 🎉
```
