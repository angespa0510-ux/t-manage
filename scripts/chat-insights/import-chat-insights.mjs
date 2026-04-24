#!/usr/bin/env node
/**
 * ═══════════════════════════════════════════════════════════
 * import-chat-insights.mjs
 *
 * Claude MAX が生成した分析結果 JSON を Supabase に取り込む。
 *
 * 使い方:
 *   cd scripts/chat-insights
 *   node import-chat-insights.mjs                     # ./out/analysis-result.json を読み込む
 *   node import-chat-insights.mjs ./my-result.json
 *
 * 前提ファイル:
 *   ./out/period.json          … エクスポート時に生成された期間情報
 *   ./out/analysis-result.json … Claude MAX が返した JSON (insights 配列)
 *
 * 動作:
 *   1. chat_insight_runs に run を作成 (triggered_by='claude_max')
 *   2. analysis-result.json の insights を chat_insights に一括挿入
 *   3. scope_name から staff.id / therapists.id を解決して scope_id を設定
 *   4. 成功・失敗を run に記録
 *
 * 環境変数:
 *   SUPABASE_URL              (必須)
 *   SUPABASE_SERVICE_KEY      (必須・Service Role Key)
 * ═══════════════════════════════════════════════════════════
 */

import { createClient } from "@supabase/supabase-js";
import fs from "node:fs/promises";
import path from "node:path";

const resultFile = process.argv[2] || "./out/analysis-result.json";
const periodFile = path.join(path.dirname(resultFile), "period.json");

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("❌ 環境変数が不足しています。");
  console.error("   SUPABASE_URL と SUPABASE_SERVICE_KEY を設定してください。");
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// period 情報
let period;
try {
  const periodRaw = await fs.readFile(periodFile, "utf-8");
  period = JSON.parse(periodRaw);
} catch (e) {
  console.error(`❌ ${periodFile} が読めません。先に export-chat-logs.mjs を実行してください。`);
  console.error(`   ${e.message}`);
  process.exit(1);
}

// 結果 JSON
let result;
try {
  const raw = await fs.readFile(resultFile, "utf-8");
  // ```json ... ``` の装飾があれば除去
  const cleaned = raw.replace(/^```json\s*/gm, "").replace(/\s*```\s*$/gm, "").trim();
  result = JSON.parse(cleaned);
} catch (e) {
  console.error(`❌ ${resultFile} が読めません / JSON パースエラー。`);
  console.error(`   ${e.message}`);
  console.error("   Claude からの出力をそのままファイルに保存してください。");
  process.exit(1);
}

const insights = Array.isArray(result) ? result : result.insights;
if (!Array.isArray(insights) || insights.length === 0) {
  console.error('❌ insights 配列が見つかりません。JSON 形式は { "insights": [...] } である必要があります。');
  process.exit(1);
}

console.log(`📥 ${insights.length} 件の insight を取り込みます`);
console.log(`   期間: ${period.period_start} 〜 ${period.period_end}`);

// マスタ
const [{ data: staffs }, { data: theras }] = await Promise.all([
  sb.from("staff").select("id, name"),
  sb.from("therapists").select("id, name"),
]);
const staffMap = new Map((staffs || []).map((s) => [s.name, s.id]));
const therapistMap = new Map((theras || []).map((t) => [t.name, t.id]));

// run 作成
const startTs = Date.now();
const { data: runRow, error: runErr } = await sb
  .from("chat_insight_runs")
  .insert({
    period_start: period.period_start,
    period_end: period.period_end,
    triggered_by: "claude_max",
    triggered_by_name: "Claude MAX (local CLI)",
    status: "running",
    messages_analyzed: period.messages_analyzed || 0,
  })
  .select()
  .single();

if (runErr) {
  console.error("❌ chat_insight_runs への挿入失敗:", runErr.message);
  process.exit(1);
}

const runId = runRow.id;

// 各 insight を挿入
let savedCount = 0;
const failures = [];
for (const ins of insights) {
  // scope_name から ID 解決
  let scopeId = null;
  if (ins.scope === "staff" && ins.scope_name) {
    scopeId = staffMap.get(ins.scope_name) || null;
  } else if (ins.scope === "therapist" && ins.scope_name) {
    scopeId = therapistMap.get(ins.scope_name) || null;
  }

  const row = {
    run_id: runId,
    period_start: period.period_start,
    period_end: period.period_end,
    insight_type: ins.insight_type || "summary",
    scope: ins.scope || "global",
    scope_id: scopeId,
    scope_name: ins.scope_name || null,
    title: (ins.title || "分析結果").slice(0, 200),
    summary: ins.summary ? String(ins.summary).slice(0, 500) : null,
    detail: ins.detail ? String(ins.detail).slice(0, 2000) : null,
    suggested_action: ins.suggested_action ? String(ins.suggested_action).slice(0, 1000) : null,
    example_good: ins.example_good ? String(ins.example_good).slice(0, 500) : null,
    example_bad: ins.example_bad ? String(ins.example_bad).slice(0, 500) : null,
    metric_value: typeof ins.metric_value === "number" ? ins.metric_value : null,
    metric_label: ins.metric_label ? String(ins.metric_label).slice(0, 100) : null,
    priority: typeof ins.priority === "number" ? ins.priority : 5,
    tags: Array.isArray(ins.tags) ? ins.tags : [],
  };

  const { error } = await sb.from("chat_insights").insert(row);
  if (error) {
    failures.push(`${ins.title}: ${error.message}`);
  } else {
    savedCount++;
  }
}

// run 更新
await sb
  .from("chat_insight_runs")
  .update({
    status: failures.length === insights.length ? "failed" : "success",
    insights_generated: savedCount,
    tokens_in: 0,
    tokens_out: 0,
    cost_jpy: 0,
    error_message: failures.length > 0 ? failures.slice(0, 5).join(" / ") : null,
    finished_at: new Date().toISOString(),
    duration_ms: Date.now() - startTs,
  })
  .eq("id", runId);

console.log("");
console.log(`✅ 完了: ${savedCount} / ${insights.length} 件を保存`);
if (failures.length > 0) {
  console.log(`⚠️  失敗: ${failures.length} 件`);
  for (const f of failures.slice(0, 5)) {
    console.log(`   - ${f}`);
  }
}
console.log(`📍 run_id: ${runId}`);
console.log(`📍 /chat-insights ページで確認できます`);
