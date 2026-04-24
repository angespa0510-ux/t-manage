# チャット AI 分析 - 3つの実行方法

T-MANAGE のチャット履歴を AI で分析する方法は 3 つあります。用途に応じて使い分けてください。

| 方法 | コスト | 実行タイミング | 設定難易度 |
|---|---|---|---|
| **A. Vercel Cron（自動・デフォルト）** | API 従量 $0.02〜0.10/回 | 毎週日曜深夜3時 | 環境変数設定のみ |
| **B. 管理画面から手動実行** | API 従量 | 任意のタイミング | A と同じ環境変数 |
| **C. Claude MAX で実行** | **MAX プラン定額（追加費用ゼロ）** | 手動 | CLI 実行できる環境が必要 |

---

## 🅰️ パターン A: Vercel Cron（自動）

### セットアップ
Vercel の環境変数に以下を設定：

```
ANTHROPIC_API_KEY=sk-ant-api03-xxxxx
CRON_SECRET=（適当な長い文字列・例: openssl rand -hex 32）
SUPABASE_SERVICE_ROLE_KEY=eyJ...（Supabase > Settings > API の service_role）
```

`vercel.json` で以下のスケジュールが設定済み：
- `0 18 * * 0` (UTC) = **日本時間 月曜 03:00** → 過去7日分を分析
- `30 18 * * 0` (UTC) = 同日 03:30 → 15日経過の添付ファイルをStorageから削除

自動で `chat_insights` テーブルにデータが溜まり、`/chat-insights` ページで閲覧可能。

---

## 🅱️ パターン B: 管理画面から手動実行

`/chat-insights` ページの「🔄 今すぐ分析」ボタンから手動実行可能。
バッチ API `/api/chat-insights-batch` が呼ばれ、同じ処理が走ります。

Vercel 環境変数 `ANTHROPIC_API_KEY` が必要（A と同じ）。

---

## 🅲️ パターン C: Claude MAX で実行（APIコストゼロ）

Claude MAX プランを持っている場合、API ではなく **Claude Code / claude.ai** 経由で
分析することで API コストをゼロにできます。

### 事前準備（1回だけ）

```bash
cd scripts/chat-insights
npm install @supabase/supabase-js
```

### 毎週の実行手順

**1. チャットログをエクスポート**

```bash
cd scripts/chat-insights

# 環境変数をセット
export SUPABASE_URL="https://cbewozzdyjqmhzkxsjqo.supabase.co"
export SUPABASE_SERVICE_KEY="eyJ..."   # Service Role Key

# 過去7日分をエクスポート
node export-chat-logs.mjs

# あるいは期間指定
node export-chat-logs.mjs 14         # 過去14日分
```

`./out/` に 3 ファイル生成されます：
- `chat-log-YYYY-MM-DD_to_YYYY-MM-DD.txt` … ログ本体
- `analysis-prompt.txt` … **Claude に渡すプロンプト**（そのままコピペ用）
- `period.json` … 期間情報（インポート時に必要）

**2. Claude MAX で分析**

`analysis-prompt.txt` の内容を全部コピーして、以下のいずれかに貼り付け：

- **Claude Code**（ターミナル）→ そのまま貼り付けて実行
- **claude.ai のチャット** → 貼り付けて送信

Claude が JSON 形式で分析結果を返します。出力の JSON 部分だけを
**`./out/analysis-result.json`** として保存してください。

> **ヒント**: claude.ai の場合、返ってきた JSON ブロックをコピーして保存。
> ```json ... ``` の装飾が含まれていても CLI 側で除去されます。

**3. Supabase に取り込む**

```bash
node import-chat-insights.mjs

# あるいはファイル指定
node import-chat-insights.mjs ./out/my-result.json
```

取り込み成功すると `chat_insights` テーブルに保存され、`/chat-insights` ページで閲覧可能に。

### Claude MAX 実行の実行ログ

`chat_insight_runs` テーブルに以下の情報で記録されます：
- `triggered_by = "claude_max"`
- `triggered_by_name = "Claude MAX (local CLI)"`
- `tokens_in / tokens_out / cost_jpy = 0` （API コストなしのため）

---

## 📊 分析結果の確認

どの方法で実行しても結果は同じ `chat_insights` テーブルに保存されます。

- **一覧ページ**: `/chat-insights`
- **実行履歴**: 同ページの「実行ログ」タブ

---

## 🆘 トラブルシューティング

### SUPABASE_SERVICE_KEY がわからない
Supabase Dashboard → プロジェクト → Settings → API → **service_role** (secret)。
**公開禁止**の Key なので、`.env` やシェル環境変数で管理。

### `analysis-result.json` のパースエラー
Claude の出力に説明文が混ざっていると失敗することがあります。
**`{ "insights": [...] }` の JSON ブロックだけ** を抜き出して保存してください。

### `scope_id が null です` という警告
Claude が出した `scope_name`（スタッフ名・セラピスト名）が DB の名前と一致しない場合です。
表示には影響しませんが、正確なフィルタ表示のためには名前を揃えてください。
