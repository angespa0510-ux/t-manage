-- Session 61: CTI監視ページと iPhone CTI Bridge の操作マニュアル記事追加
-- カテゴリ: システム設定 (category_id=7)
-- 記事数: 2記事

INSERT INTO ops_manual_articles (category_id, title, content, sort_order) VALUES

-- ─── 記事1: CTI監視ページの使い方 ─────────────────────
(7, 'CTI監視ページの使い方', '## CTI監視ページとは？

着信検出の件数や精度を、ソース別（Android / iPhone Beta / Twilio）に可視化するダッシュボードです。

[button:/cti-monitor:📞 CTI監視を開く]

## 見られるもの

### 全体サマリー
・**総着信検出数** … 期間内の全ソース合計
・**番号抽出失敗数** … 電話番号が取れなかった件数（名前だけで通知が来た場合など）
・**アクティブソース数** … 実際に着信を検出したソースの種類数

### ソース別内訳
各ソース（Android / iPhone Beta / Twilio）ごとに：
・検出件数
・全体に占める割合
・番号抽出失敗件数

### 直近14日間の推移グラフ
日別の着信検出件数。お店の繁閑や、CTI自体が動いていない日を発見できる。

### iPhone Beta版の精度パネル
iPhone Beta版を使っている場合だけ表示される。
・検出成功数
・番号取得失敗数（iPhone連絡先に登録済みで名前しか取れなかったケース）

### 直近の着信ログ（最大100件）
日時・ソース・電話番号・デバイス・対応状態を一覧で表示。

## 使える人

・社長
・経営責任者
・店長（leader）

※ 一般スタッフのメニューには表示されません。

## こんな時にチェック

### ①「最近CTIポップアップが出ない」と感じた時
→ 日別グラフを見て、特定の日だけ極端に件数が少なければ、その日はCTIアプリ/Bridgeが止まっていた可能性大。

### ② iPhone Beta版を使っているお客様の店舗で
→ 「番号抽出失敗」の件数を見て、失敗が多ければ連絡先登録運用を見直すか、Twilio連携版を提案する。

### ③ 新規デバイスを追加した時
→ ソース別内訳・デバイスIDで、想定通りのデバイスから着信が来ているか確認。

## トラブル: Android CTIの件数が0

Android CTIアプリが止まっている可能性。
・スマホが電源オフ / スリープ
・バッテリーセーバーで勝手に停止されている
・Supabase URL / KEY の設定が誤っている

詳しくは [link:Android CTIアプリの確認] 記事を参照。
', 50),

-- ─── 記事2: iPhone CTI Bridge のセットアップ ─────────
(7, 'iPhone CTI Bridge (Beta) のセットアップ', '## iPhone CTI Bridgeとは？

iPhone からの着信を Windows PC 経由で T-MANAGE に連携するツールです。
Android CTIアプリの iPhone 版という位置づけで、**ベータ版**として無料提供しています。

## ⚠ 重要: ベータ版の制限

Android CTIアプリと違い、100%の検出は保証できません。以下のケースでは動作しません。

・iPhoneとWindowsのPhone Link接続が切れている
・iPhoneが集中モード/おやすみモードになっている
・iPhone連絡先に登録済みの番号（名前で通知されるため番号抽出不可）
・PCがスリープ/電源オフ
・Windows集中モードがオン

業務クリティカルには **Twilio連携版（有料）** を提案するのが基本方針です。

## 動作原理

① iPhone に着信
② Bluetooth で Windows Phone Link が通知表示
③ Python スクリプトが通知センターを監視
④ 正規表現で電話番号抽出
⑤ Supabase cti_calls テーブルに INSERT（source=iphone_beta）
⑥ T-MANAGE の既存 CTI ポップアップがそのまま反応

**既存のAndroid CTIと同じポップアップUIが使われる**ので、ユーザー側の操作感は変わりません。

## セットアップ手順

### ステップ1: Phone Link で iPhone ペアリング
① Windowsの「スマートフォン連携」アプリ起動
② iPhoneを選択してペアリング
③ 通知・連絡先の共有を許可
④ PC右下にテスト通知が届くか確認

💡 不安定な場合は Intel Unison の方が相性が良い場合があります。

### ステップ2: Python 3.10+ をインストール
① https://www.python.org/downloads/ からダウンロード
② インストール時「Add Python to PATH」に**必ずチェック**
③ コマンドプロンプトで `python --version` を実行して確認

### ステップ3: Bridge ファイルを配置
GitHub から `iphone-cti-bridge` フォルダを取得し、PC上の任意の場所に展開。
例: `C:\\t-manage\\iphone-cti-bridge\\`

### ステップ4: 設定ファイル作成
① `.env.example` をコピーして `.env` にリネーム
② メモ帳で開き、以下を設定:
    - SUPABASE_URL
    - SUPABASE_ANON_KEY
    - STORE_ID (アンジュスパは 1)

### ステップ5: 通知アクセス許可
Windows設定 > プライバシーとセキュリティ > 通知 で有効化。
初回実行時のダイアログで「はい」でもOK。

### ステップ6: Bridge 起動
`start-bridge.bat` をダブルクリック。初回のみ依存パッケージの自動インストール。

### ステップ7: 動作テスト
別の電話番号から iPhone に電話 → PC右下に着信通知 → Bridge画面に「✅ 送信成功」表示 → T-MANAGE にポップアップ出現。

### ステップ8: 自動起動 (推奨)
`register-startup.bat` をダブルクリック。次回PC起動時から自動実行。

## ソース別の表示確認

セットアップ後、[button:/cti-monitor:📞 CTI監視] を開いて、ソース別内訳に「📱 iPhone Beta版」が表示されていれば正常に連携できています。

## トラブルシューティング

### 「Python がインストールされていません」
→ Python再インストール時に「Add Python to PATH」にチェック。

### 「通知アクセスが許可されていません」
→ Windows設定 > プライバシー > 通知 で許可。

### 着信通知は PC に届くが、Bridge が反応しない
→ iPhone連絡先に登録済みの番号の可能性。**未登録番号でテスト**。

### 「Supabase 送信エラー」
→ `.env` の URL / KEY を再確認。インターネット接続確認。

### 着信通知自体が PC に届かない
→ Phone Linkの再ペアリング。集中モードをオフ。

### 名前だけ表示されて番号が取れない
→ iPhone連絡先から当該番号を削除する、または業務用iPhoneを連絡先未登録のまま運用する。

## TERAMANAGE 外販時のスタンス

お客様への案内は以下の3段構え：

### 無料: iPhone Beta版
「検出精度は保証できませんが、無料でお使いいただけます」
→ iPhone派の小規模店舗、試験導入向け

### 中価格: Android CTI
「スマホをお店に置いていただければ、ほぼ100%検出できます」
→ スマホ用意できるお客様

### 高価格: Twilio連携版
「業務用番号を取得して転送運用。100%検出保証・通話録音も可能」
→ 精度を求める本格運用のお客様

## データ構造

`cti_calls` テーブルに以下のカラムが追加されています（セッション61）:

・`source` … android / iphone_beta / twilio / manual
・`store_id` … 店舗ID（マルチテナント用）
・`device_id` … PC名など
・`raw_text` … 通知元テキスト（番号抽出失敗時のデバッグ用）

詳細は GitHub の `sql/session61_cti_multi_source.sql` を参照。
', 51);
