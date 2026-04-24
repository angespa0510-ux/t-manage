#!/usr/bin/env node
/**
 * ═══════════════════════════════════════════════════════════
 * export-chat-logs.mjs
 *
 * Supabase からチャットログを取り出し、Claude MAX (Claude Code や
 * claude.ai) に貼り付けるためのテキストファイルを生成する。
 *
 * 使い方:
 *   cd scripts/chat-insights
 *   node export-chat-logs.mjs           # 過去7日分
 *   node export-chat-logs.mjs 14        # 過去14日分
 *   node export-chat-logs.mjs 7 ./out   # 出力先指定
 *
 * 出力:
 *   ./out/chat-log-YYYY-MM-DD_to_YYYY-MM-DD.txt
 *     → Claude MAX に「このログを分析して」と貼り付ける用
 *   ./out/analysis-prompt.txt
 *     → Claude に渡すプロンプト（コピペ用）
 *   ./out/period.json
 *     → 期間情報（import 時に必要）
 *
 * 環境変数:
 *   SUPABASE_URL              (必須)
 *   SUPABASE_SERVICE_KEY      (必須・Service Role Key)
 * ═══════════════════════════════════════════════════════════
 */

import { createClient } from "@supabase/supabase-js";
import fs from "node:fs/promises";
import path from "node:path";

const days = parseInt(process.argv[2] || "7", 10);
const outDir = process.argv[3] || "./out";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("❌ 環境変数が不足しています。");
  console.error("   SUPABASE_URL と SUPABASE_SERVICE_KEY を設定してください。");
  console.error("");
  console.error("   例:");
  console.error('     export SUPABASE_URL="https://cbewozzdyjqmhzkxsjqo.supabase.co"');
  console.error('     export SUPABASE_SERVICE_KEY="eyJ..."');
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const now = new Date();
const periodEnd = new Date(now.getTime() - 24 * 60 * 60 * 1000);
const periodStart = new Date(periodEnd.getTime() - (days - 1) * 24 * 60 * 60 * 1000);
const periodStartStr = periodStart.toISOString().slice(0, 10);
const periodEndStr = periodEnd.toISOString().slice(0, 10);

console.log(`📊 チャットログをエクスポート中...`);
console.log(`   期間: ${periodStartStr} 〜 ${periodEndStr} (${days} 日間)`);

// メッセージ取得
const { data: messages, error } = await sb
  .from("chat_messages")
  .select("id, conversation_id, sender_type, sender_id, sender_name, content, message_type, attachment_type, created_at, ai_feature_used")
  .eq("is_deleted", false)
  .neq("sender_type", "system")
  .gte("created_at", periodStart.toISOString())
  .lte("created_at", periodEnd.toISOString() + "T23:59:59")
  .order("created_at", { ascending: true })
  .limit(5000);

if (error) {
  console.error("❌ Supabase 取得エラー:", error.message);
  process.exit(1);
}

if (!messages || messages.length === 0) {
  console.log("⚠️  期間内にメッセージがありません。");
  process.exit(0);
}

console.log(`✅ ${messages.length} 件のメッセージを取得`);

// マスタ
const [{ data: staffs }, { data: theras }, { data: convs }] = await Promise.all([
  sb.from("staff").select("id, name"),
  sb.from("therapists").select("id, name, status"),
  sb.from("chat_conversations").select("id, type, name"),
]);
const staffMap = new Map((staffs || []).map((s) => [s.id, s.name]));
const therapistMap = new Map((theras || []).map((t) => [t.id, { name: t.name, status: t.status }]));
const convMap = new Map((convs || []).map((c) => [c.id, c]));

// テキスト化
const lines = [];
lines.push(`# チャットログ (${periodStartStr} 〜 ${periodEndStr})`);
lines.push(`# 総メッセージ数: ${messages.length}`);
lines.push("");

let lastConvId = null;
for (const m of messages) {
  if (m.conversation_id !== lastConvId) {
    const conv = convMap.get(m.conversation_id);
    const convLabel = conv
      ? conv.type === "broadcast"
        ? "[一斉配信]"
        : conv.type === "group"
        ? `[グループ: ${conv.name || "名前なし"}]`
        : "[DM]"
      : "[会話]";
    lines.push("");
    lines.push(`────────────────── ${convLabel} 会話ID=${m.conversation_id} ──────────────────`);
    lastConvId = m.conversation_id;
  }
  const name = m.sender_name ||
    (m.sender_type === "staff" ? staffMap.get(m.sender_id) || "スタッフ" :
     m.sender_type === "therapist" ? therapistMap.get(m.sender_id)?.name || "セラピスト" :
     "AI");
  const label = m.sender_type === "staff" ? "スタッフ" : m.sender_type === "therapist" ? "セラ" : m.sender_type === "ai" ? "AI" : "";
  const statusBadge = m.sender_type === "therapist"
    ? `(${therapistMap.get(m.sender_id)?.status || "?"})`
    : "";
  const attach = m.attachment_type
    ? m.attachment_type.startsWith("image/") ? " [📷画像添付]" :
      m.attachment_type.startsWith("video/") ? " [🎬動画添付]" : " [📎添付]"
    : "";
  const aiTag = m.ai_feature_used ? ` {AI:${m.ai_feature_used}}` : "";
  const content = (m.content || "").replace(/\n/g, " / ");
  lines.push(`[${m.created_at.slice(5, 16)}] ${label}${statusBadge} ${name}${aiTag}: ${content}${attach}`);
}

const logText = lines.join("\n");

// プロンプト
const analysisPrompt = `あなたはリラクゼーションサロンのチャットコミュニケーション改善アドバイザーです。
以下のスタッフとセラピスト間のチャットログを分析し、実務的な改善提案を行ってください。

分析観点:
1. 頻出パターン（よくあるやり取りの分類と件数）
2. 応答品質（スタッフの返信の丁寧さ・適切さ・速さ）
3. トラブル兆候（体調不良の繰り返し、人間関係、シフト問題など）
4. スタッフ別の返信スタイル（誰がどんな返し方をしているか）
5. セラピスト別の傾向（連絡頻度・困っていること）
6. 改善すべき返信例（「こう返したほうがよかった」）

出力は **JSON のみ** で、以下の形式に厳密に従ってください。余計な説明は一切不要です。

{
  "insights": [
    {
      "insight_type": "summary|pattern|suggestion|staff_style|therapist_trend|trouble|improvement",
      "scope": "global|staff|therapist",
      "scope_name": "対象者の名前（scope=globalなら空文字）",
      "title": "40文字以内の見出し",
      "summary": "100文字以内の短い要約",
      "detail": "詳細な分析（300文字以内）",
      "suggested_action": "推奨アクション（任意）",
      "example_good": "良い返信例（任意）",
      "example_bad": "改善が必要な返信例（任意）",
      "metric_value": 数値またはnull,
      "metric_label": "指標ラベル（例: 件数、時間、%）",
      "priority": 1-10の重要度,
      "tags": ["カテゴリタグ"]
    }
  ]
}

制約:
- insights は 5〜15 件生成する
- scope_name はデータ通りの名前を使う
- 根拠のない推測はしない
- 同じ内容を重複させない
- priority=10 は緊急度高（トラブル兆候など）、5前後が通常、2以下は参考情報

分析期間: ${periodStartStr} 〜 ${periodEndStr}
総メッセージ数: ${messages.length}

────────── チャットログここから ──────────

${logText}

────────── チャットログここまで ──────────

このログを分析して、上記 JSON 形式で出力してください。
出力した JSON は analysis-result.json として保存し、
import-chat-insights.mjs で Supabase に取り込みます。`;

const period = {
  period_start: periodStartStr,
  period_end: periodEndStr,
  messages_analyzed: messages.length,
  generated_at: new Date().toISOString(),
};

// 書き出し
await fs.mkdir(outDir, { recursive: true });
const logFile = path.join(outDir, `chat-log-${periodStartStr}_to_${periodEndStr}.txt`);
const promptFile = path.join(outDir, "analysis-prompt.txt");
const periodFile = path.join(outDir, "period.json");

await fs.writeFile(logFile, logText, "utf-8");
await fs.writeFile(promptFile, analysisPrompt, "utf-8");
await fs.writeFile(periodFile, JSON.stringify(period, null, 2), "utf-8");

console.log("");
console.log("✅ エクスポート完了");
console.log(`   ${logFile}`);
console.log(`   ${promptFile}`);
console.log(`   ${periodFile}`);
console.log("");
console.log("📋 次のステップ:");
console.log(`   1. ${promptFile} の内容をコピー`);
console.log(`   2. Claude Code または claude.ai に貼り付けて実行`);
console.log(`   3. 返ってきた JSON を ${outDir}/analysis-result.json として保存`);
console.log(`   4. node import-chat-insights.mjs を実行`);
