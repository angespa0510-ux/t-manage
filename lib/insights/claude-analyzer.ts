/**
 * Mode B（自動分析）：Claude API で日次レビューを生成
 *
 * Vercel Cron から POST /api/insights/cron が呼ばれた時に実行される。
 * 結果は ai_daily_reviews テーブルに保存。
 */

import type { Ga4Summary } from "./ga4-client";
import type { ClaritySummary } from "./clarity-client";
import type { TmanageSummary } from "./tmanage-data";
import { formatForClaudeMax } from "./format-for-claude";

// ───────── 型定義 ─────────

export type AiReviewResult = {
  summary: string;
  fullReport: string;
  goodNews: { title: string; detail: string }[];
  warnings: { title: string; detail: string; severity: "low" | "medium" | "high" }[];
  opportunities: { title: string; detail: string }[];
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
};

// ───────── プロンプト ─────────

const SYSTEM_PROMPT = `あなたはアンジュスパ（リラクゼーションサロン）の経営アドバイザー兼データアナリストです。
社長への朝の業務報告として、毎日のアクセス解析データを分析し、簡潔で実行可能な提案を行います。

【分析方針】
- 数字の単純な羅列ではなく、ビジネスインパクトの観点で解釈する
- 良いニュース・要対応・機会発見・今日のアクション、の4観点で構造化する
- 親しみやすい文体（敬語だが堅すぎない）
- 朝忙しい社長が15秒で要点把握できる構成
- 推測で物事を断定しない、慎重な分析

【出力フォーマット】
必ず以下のJSON形式で出力してください（マークダウンコードブロック等は不要、純粋なJSONのみ）。

{
  "summary": "30文字以内の今日の要約（朝のあいさつ風）",
  "fullReport": "Markdown形式の完全レポート（500文字程度、絵文字でセクション分け）",
  "goodNews": [
    {"title": "短い見出し", "detail": "1-2文の詳細"}
  ],
  "warnings": [
    {"title": "要対応事項", "detail": "なぜ問題か・対処方法", "severity": "low|medium|high"}
  ],
  "opportunities": [
    {"title": "機会の見出し", "detail": "なぜ機会か・具体策"}
  ]
}

警告のseverity判定:
- high: 即日対応すべき（Rage Click多発・売上急落・予約激減等）
- medium: 1週間以内に対応（Dead Click多発・特定ページの離脱率上昇等）
- low: 監視継続（軽微な異常）`;

// ───────── コスト計算 ─────────

// Sonnet 4.6 通常価格: $3 / 1M input tokens, $15 / 1M output tokens
// Batch APIで50%オフ
const COST_PER_INPUT_TOKEN = 3 / 1_000_000;
const COST_PER_OUTPUT_TOKEN = 15 / 1_000_000;

function calculateCost(inputTokens: number, outputTokens: number, useBatch: boolean): number {
  const multiplier = useBatch ? 0.5 : 1;
  return (inputTokens * COST_PER_INPUT_TOKEN + outputTokens * COST_PER_OUTPUT_TOKEN) * multiplier;
}

// ───────── 公開関数: Claude APIで分析 ─────────

type AnalyzeInput = {
  date: string;
  ga4: Ga4Summary | null;
  clarity: ClaritySummary | null;
  tmanage: TmanageSummary | null;
  model?: string;
};

export async function analyzeWithClaude(input: AnalyzeInput): Promise<AiReviewResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY が未設定");

  const model = input.model || "claude-sonnet-4-6";
  const userMessage = formatForClaudeMax(input);

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Claude API失敗: ${res.status} ${text}`);
  }

  const data = await res.json();
  const text = data.content?.[0]?.text || "";
  const inputTokens = data.usage?.input_tokens ?? 0;
  const outputTokens = data.usage?.output_tokens ?? 0;
  const costUsd = calculateCost(inputTokens, outputTokens, false); // Cronは非Batch

  // ── JSON パース ──
  let parsed: {
    summary?: string;
    fullReport?: string;
    goodNews?: { title: string; detail: string }[];
    warnings?: { title: string; detail: string; severity: "low" | "medium" | "high" }[];
    opportunities?: { title: string; detail: string }[];
  };
  try {
    // マークダウンの ```json ... ``` ラッパーが付いている場合の対策
    const cleaned = text.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
    parsed = JSON.parse(cleaned);
  } catch {
    // パース失敗時はテキストをそのまま fullReport に
    parsed = { fullReport: text, summary: text.slice(0, 30), goodNews: [], warnings: [], opportunities: [] };
  }

  return {
    summary: parsed.summary || "",
    fullReport: parsed.fullReport || text,
    goodNews: parsed.goodNews || [],
    warnings: parsed.warnings || [],
    opportunities: parsed.opportunities || [],
    inputTokens,
    outputTokens,
    costUsd,
  };
}
