import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * ═══════════════════════════════════════════════════════════
 * /api/chat-insights-batch
 *
 * 週1回（日曜深夜）Vercel Cron で自動実行されるチャットAI分析バッチ。
 * 過去7日分の chat_messages を分析し、以下を chat_insights に蓄積:
 *   - 全体サマリー（週の総メッセージ数・応答時間中央値など）
 *   - 頻出パターン（「体調不良」「遅刻」等のカテゴリ別件数）
 *   - 改善提案（「このパターンへの返信は◯◯のほうが良い」）
 *   - スタッフ別の返信傾向（丁寧さ・速さ・AI利用率）
 *   - セラピスト別の傾向（連絡頻度・困りごとの種類）
 *   - トラブル兆候の検出
 *
 * セキュリティ:
 *   - Vercel Cron からのみ呼ばれる想定
 *   - Authorization: Bearer {CRON_SECRET} をチェック
 *   - 手動実行は管理者が /chat-insights から可能（別ルート）
 * ═══════════════════════════════════════════════════════════
 */

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";
const CRON_SECRET = process.env.CRON_SECRET || "";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

// Sonnet の料金（2026-04 時点・USD per 1M tokens）
const COST_IN_PER_1M_USD = 3;
const COST_OUT_PER_1M_USD = 15;
const USD_TO_JPY = 150;

// ─── ヘルパー: Anthropic Claude を呼ぶ ───
type ClaudeResult = { text: string; inputTokens: number; outputTokens: number };

async function callClaude(systemPrompt: string, userMessage: string, maxTokens = 2000): Promise<ClaudeResult> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5",
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude API ${res.status}: ${err}`);
  }
  const data = await res.json();
  const text = data.content?.[0]?.text || "";
  return {
    text,
    inputTokens: data.usage?.input_tokens || 0,
    outputTokens: data.usage?.output_tokens || 0,
  };
}

function calcCostJpy(inTok: number, outTok: number): number {
  const usd = (inTok / 1_000_000) * COST_IN_PER_1M_USD + (outTok / 1_000_000) * COST_OUT_PER_1M_USD;
  return Math.round(usd * USD_TO_JPY * 10000) / 10000;
}

// JSON 抽出（Claude が余計な装飾を混ぜた場合の保険）
function extractJson<T>(text: string): T | null {
  const cleaned = text.replace(/^```json\s*|\s*```$/g, "").trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]) as T;
      } catch {}
    }
    return null;
  }
}

type InsightOut = {
  insight_type: string;
  scope?: string;
  scope_id?: number | null;
  scope_name?: string;
  title: string;
  summary?: string;
  detail?: string;
  suggested_action?: string;
  example_good?: string;
  example_bad?: string;
  metric_value?: number | null;
  metric_label?: string;
  priority?: number;
  tags?: string[];
};

// ─── メイン ───
export async function GET(request: NextRequest) {
  return handle(request, "cron", "Vercel Cron");
}

export async function POST(request: NextRequest) {
  // 手動実行（管理者が /chat-insights から）
  const body = await request.json().catch(() => ({}));
  return handle(request, "manual", body.triggered_by_name || "manual");
}

async function handle(request: NextRequest, triggeredBy: string, triggeredByName: string) {
  // 認証: Vercel Cron は Authorization: Bearer {CRON_SECRET} を送る
  const auth = request.headers.get("authorization") || "";
  if (triggeredBy === "cron") {
    if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }
  if (!ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return NextResponse.json({ error: "Supabase credentials missing" }, { status: 500 });
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 期間: 過去7日間
  const now = new Date();
  const periodEnd = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 昨日
  const periodStart = new Date(periodEnd.getTime() - 6 * 24 * 60 * 60 * 1000); // 7日前

  const periodStartStr = periodStart.toISOString().slice(0, 10);
  const periodEndStr = periodEnd.toISOString().slice(0, 10);

  // run 作成
  const { data: runRow } = await sb
    .from("chat_insight_runs")
    .insert({
      period_start: periodStartStr,
      period_end: periodEndStr,
      triggered_by: triggeredBy,
      triggered_by_name: triggeredByName,
      status: "running",
    })
    .select()
    .single();
  const runId = runRow?.id;
  const startTs = Date.now();

  try {
    // 対象メッセージ取得（is_deleted=false、期間内）
    const { data: msgs } = await sb
      .from("chat_messages")
      .select("id, conversation_id, sender_type, sender_id, sender_name, content, created_at, ai_feature_used")
      .eq("is_deleted", false)
      .neq("sender_type", "system")
      .gte("created_at", periodStart.toISOString())
      .lte("created_at", periodEnd.toISOString() + "T23:59:59")
      .order("created_at", { ascending: true })
      .limit(3000);

    const messages = msgs || [];

    // メッセージが少なすぎたら分析スキップ
    if (messages.length < 10) {
      await sb
        .from("chat_insight_runs")
        .update({
          status: "success",
          messages_analyzed: messages.length,
          insights_generated: 0,
          finished_at: new Date().toISOString(),
          duration_ms: Date.now() - startTs,
          error_message: messages.length === 0 ? "期間内にメッセージがありません" : "メッセージ数が少ないため分析スキップ",
        })
        .eq("id", runId);
      return NextResponse.json({
        status: "success",
        run_id: runId,
        messages_analyzed: messages.length,
        insights_generated: 0,
        skipped: true,
      });
    }

    // マスタ取得（スタッフ・セラピスト名を参照するため）
    const [{ data: staffs }, { data: theras }] = await Promise.all([
      sb.from("staff").select("id, name"),
      sb.from("therapists").select("id, name"),
    ]);
    const staffMap = new Map((staffs || []).map((s: { id: number; name: string }) => [s.id, s.name]));
    const therapistMap = new Map((theras || []).map((t: { id: number; name: string }) => [t.id, t.name]));

    // Claude 用のテキスト化（メッセージ量が多い場合は最新1500件で切る）
    const trimmed = messages.slice(-1500);
    const lines = trimmed.map((m) => {
      const name = m.sender_name ||
        (m.sender_type === "staff" ? staffMap.get(m.sender_id || 0) || "スタッフ" :
         m.sender_type === "therapist" ? therapistMap.get(m.sender_id || 0) || "セラピスト" :
         "AI");
      const label = m.sender_type === "staff" ? "スタッフ" : m.sender_type === "therapist" ? "セラ" : m.sender_type === "ai" ? "AI" : "";
      return `[${m.created_at.slice(5, 16)}] ${label} ${name}: ${(m.content || "").replace(/\n/g, " ").slice(0, 200)}`;
    });
    const conversationText = lines.join("\n");

    // ── Claude 呼び出し ──
    const systemPrompt = `あなたはリラクゼーションサロンのチャットコミュニケーション改善アドバイザーです。
スタッフとセラピスト間のチャットログを分析し、以下の観点で実務的な改善提案を行ってください。

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
- 実名の言及は scope_name フィールドのみ、本文では "A さん" のように伏せない（データ利用者は内部スタッフのため）
- 根拠のない推測はしない
- 同じ内容を重複させない
- priority=10 は緊急度高（トラブル兆候など）、5前後が通常、2以下は参考情報`;

    const userMessage = `分析期間: ${periodStartStr} 〜 ${periodEndStr}
総メッセージ数: ${messages.length}

以下のチャットログを分析してJSONで出力してください。

${conversationText}`;

    const claudeRes = await callClaude(systemPrompt, userMessage, 4000);
    const parsed = extractJson<{ insights: InsightOut[] }>(claudeRes.text);
    const insights = parsed?.insights || [];

    // ── insights を保存 ──
    let savedCount = 0;
    for (const ins of insights) {
      // scope_name からスタッフ/セラピストIDを解決
      let scopeId: number | null = null;
      if (ins.scope === "staff" && ins.scope_name) {
        for (const [id, name] of staffMap.entries()) {
          if (name === ins.scope_name) { scopeId = id; break; }
        }
      } else if (ins.scope === "therapist" && ins.scope_name) {
        for (const [id, name] of therapistMap.entries()) {
          if (name === ins.scope_name) { scopeId = id; break; }
        }
      }

      const { error } = await sb.from("chat_insights").insert({
        run_id: runId,
        period_start: periodStartStr,
        period_end: periodEndStr,
        insight_type: ins.insight_type || "summary",
        scope: ins.scope || "global",
        scope_id: scopeId,
        scope_name: ins.scope_name || null,
        title: ins.title?.slice(0, 200) || "分析結果",
        summary: ins.summary?.slice(0, 500) || null,
        detail: ins.detail?.slice(0, 2000) || null,
        suggested_action: ins.suggested_action?.slice(0, 1000) || null,
        example_good: ins.example_good?.slice(0, 500) || null,
        example_bad: ins.example_bad?.slice(0, 500) || null,
        metric_value: ins.metric_value ?? null,
        metric_label: ins.metric_label?.slice(0, 100) || null,
        priority: ins.priority ?? 5,
        tags: ins.tags || [],
      });
      if (!error) savedCount++;
    }

    const costJpy = calcCostJpy(claudeRes.inputTokens, claudeRes.outputTokens);

    await sb
      .from("chat_insight_runs")
      .update({
        status: "success",
        messages_analyzed: messages.length,
        insights_generated: savedCount,
        tokens_in: claudeRes.inputTokens,
        tokens_out: claudeRes.outputTokens,
        cost_jpy: costJpy,
        finished_at: new Date().toISOString(),
        duration_ms: Date.now() - startTs,
      })
      .eq("id", runId);

    return NextResponse.json({
      status: "success",
      run_id: runId,
      period_start: periodStartStr,
      period_end: periodEndStr,
      messages_analyzed: messages.length,
      insights_generated: savedCount,
      tokens_in: claudeRes.inputTokens,
      tokens_out: claudeRes.outputTokens,
      cost_jpy: costJpy,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    await sb
      .from("chat_insight_runs")
      .update({
        status: "failed",
        error_message: msg.slice(0, 1000),
        finished_at: new Date().toISOString(),
        duration_ms: Date.now() - startTs,
      })
      .eq("id", runId);
    return NextResponse.json({ status: "failed", error: msg }, { status: 500 });
  }
}
