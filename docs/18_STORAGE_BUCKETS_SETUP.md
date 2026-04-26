# 📦 Storage バケット作成手順 (動画機能用)

セラピストの **日記・ストーリー機能の動画投稿** で必要な Supabase Storage バケットの作成手順。

**作成日:** 2026-04-26
**対応セッション:** session69 (動画リエンコード基盤)
**作成必要なタイミング:** 6/1 本番運用開始までに

---

## 🎯 なぜ必要か

セラピストが日記・ストーリーで動画をアップロードすると、以下の流れで処理されます：

```
[1] アップロード (.mp4 / .mov、最大100MB、最大60秒)
        ↓
[2] therapist-videos-raw に生ファイル保存 (非公開)
        ↓
[3] video_processing_jobs にジョブ作成 → ffmpeg で処理
    - 縦横比変換 (9:16 / 16:9 / original)
    - MP4 圧縮 (最大1080p、ビットレート2M、音声128k)
    - サムネイル生成
        ↓
[4] therapist-videos に処理済みファイル保存 (公開)
        ↓
[5] 顧客が公開URLで視聴
        ↓
[6] therapist-videos-raw の生ファイルは削除 (容量節約)
```

バケットが無い状態で動画アップロードすると、API が 500 エラーを返します。

---

## 📋 作成するバケット2つ

### 1. therapist-videos-raw (生ファイル保管用)

| 項目 | 値 |
|---|---|
| 名前 | `therapist-videos-raw` |
| Public bucket | **OFF** ✗ (非公開) |
| File size limit | **100 MB** |
| Allowed MIME types | `video/mp4, video/quicktime, video/x-m4v` |

### 2. therapist-videos (処理済み配信用)

| 項目 | 値 |
|---|---|
| 名前 | `therapist-videos` |
| Public bucket | **ON** ✓ (公開) |
| File size limit | **50 MB** |
| Allowed MIME types | `video/mp4, image/jpeg, image/webp` |

---

## 🛠 作成手順 (Supabase ダッシュボード)

### ステップ1: Storage 画面を開く

1. ブラウザで以下のURLを開く:
   <https://supabase.com/dashboard/project/cbewozzdyjqmhzkxsjqo/storage/buckets>

2. ログイン済みであれば Storage のバケット一覧画面が表示される

### ステップ2: 1個目のバケット作成 (therapist-videos-raw)

1. 右上の緑色の **「New bucket」** ボタンをクリック

2. ダイアログが開いたら、以下を入力:
   - **Name of bucket**: `therapist-videos-raw`
   - **Public bucket**: スイッチを **OFF のまま** (デフォルト)
   - **Additional configuration** をクリックして展開:
     - **Restrict file upload size for bucket**: チェックを ON
     - **File size limit**: `100` を入力、単位は **MB** を選択
     - **Allowed MIME types**: 以下をカンマ区切りで入力 (改行なし):
       ```
       video/mp4,video/quicktime,video/x-m4v
       ```

3. **「Save」** をクリック

4. 一覧に `therapist-videos-raw` が表示されれば成功 🎉

### ステップ3: 2個目のバケット作成 (therapist-videos)

1. 再度 **「New bucket」** をクリック

2. ダイアログが開いたら、以下を入力:
   - **Name of bucket**: `therapist-videos`
   - **Public bucket**: スイッチを **ON** ✓ にする (重要！)
   - **Additional configuration** をクリックして展開:
     - **Restrict file upload size for bucket**: チェックを ON
     - **File size limit**: `50` を入力、単位は **MB** を選択
     - **Allowed MIME types**: 以下をカンマ区切りで入力:
       ```
       video/mp4,image/jpeg,image/webp
       ```

3. **「Save」** をクリック

4. 一覧に `therapist-videos` が表示され、その横に「Public」と緑色の表示があれば成功 🎉

---

## ✅ 作成後の確認

Supabase ダッシュボードの **「SQL Editor」** で以下のクエリを実行して確認できます:

```sql
SELECT
  id AS bucket_name,
  public,
  file_size_limit,
  allowed_mime_types,
  created_at
FROM storage.buckets
WHERE id IN ('therapist-videos-raw', 'therapist-videos')
ORDER BY id;
```

期待される結果:

| bucket_name | public | file_size_limit | allowed_mime_types |
|---|---|---|---|
| therapist-videos | true | 52428800 | {video/mp4,image/jpeg,image/webp} |
| therapist-videos-raw | false | 104857600 | {video/mp4,video/quicktime,video/x-m4v} |

※ `file_size_limit` はバイト単位 (50MB = 52,428,800 / 100MB = 104,857,600)

---

## 🔒 RLS ポリシー (必要に応じて)

T-MANAGE は基本的に Service Role Key 経由で操作しているため、現状は **デフォルトのポリシーのままでOK**。

ただし将来、セラピストマイページから直接アップロードする場合 (現在は `/api/diary/video/upload` 経由のため不要) は、以下のようなポリシーが必要になります:

```sql
-- 認証済みのみアップロード可能 (将来用、現時点では不要)
-- CREATE POLICY "Authenticated users can upload" ON storage.objects
--   FOR INSERT TO authenticated
--   WITH CHECK (bucket_id = 'therapist-videos-raw');
```

---

## 🧪 動作確認

バケット作成後、セラピストマイページのストーリー機能で動画をアップロードしてみる:

1. <https://t-manage.vercel.app/mypage> にログイン
2. ストーリー作成 (今後実装予定)
3. 動画ファイルを選択 → アップロード
4. `video_processing_jobs` テーブルに `status='pending'` で行が追加される
5. 数十秒後、`status='completed'` になり、`processed_url` に公開URLがセットされる

---

## 📚 関連ファイル

- `sql/session69_video_processing.sql` - ジョブテーブル定義 (バケット作成手順の元)
- `app/api/diary/video/upload/route.ts` - アップロードAPI (RAW_BUCKET 定数)
- `app/api/diary/video/process-job/route.ts` - 処理API (PROCESSED_BUCKET 定数)
- `lib/video-processor.ts` - ffmpeg 処理ヘルパー
- `sql/session72_operations_manual_phase34.sql` - 操作マニュアル記事

---

## ⚠️ 注意事項

- `therapist-videos-raw` を **誤って Public にしないこと**。生ファイルが外部から直接見られてしまう
- `therapist-videos` を **誤って Private にしないこと**。顧客が動画を視聴できなくなる
- バケット名は **完全一致** (大文字小文字、ハイフン位置すべて) で作成する。コード側で文字列マッチしているため
- 一度作成したバケット名は変更不可。間違えたら削除して作り直し
- 既にファイルが入っているバケットは削除前に空にする必要がある
