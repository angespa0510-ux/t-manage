/**
 * POST /api/insights/cron
 *
 * Vercel Cron から毎朝 8:00 (JST) に呼ばれる。
 * 昨日のデータで Mode B（API自動分析）を実行し、ai_daily_reviews に保存。
 *
 * 設定:
 * - vercel.json の crons 設定で起動
 * - CRON_SECRET 環境変数で認証（Vercelが自動付与する Authorization ヘッダー）
 *
 * 動作:
 * 1. insights_settings を読む（Mode B 有効でなければ即終了）
 * 2. 月間予算チェック（超過していれば skip）
 * 3. 昨日の3ソースデータを fetch（または cache から）
 * 4. Claude API で分析
 * 5. ai_daily_reviews に保存
 * 6. 通知設定に従って Gmail送信
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fetchGa4Summary } from "../../../../lib/insights/ga4-client";
import { fetchClaritySummary } from "../../../../lib/insights/clarity-client";
import { fetchTmanageSummary } from "../../../../lib/insights/tmanage-data";
import { analyzeWithClaude } from "../../../../lib/insights/claude-analyzer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function getServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !serviceKey) throw new Error("Supabase接続情報が未設定");
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

// ───────── 認証 ─────────

function isAuthorized(req: Request): boolean {
  const authHeader = req.headers.get("authorization");
  const expected = process.env.CRON_SECRET;
  if (!expected) return true; // 未設定時はスルー（開発用）
  return authHeader === `Bearer ${expected}`;
}

// ───────── メイン処理 ─────────

export async function GET(req: Request) {
  return runCron(req);
}

export async function POST(req: Request) {
  return runCron(req);
}

async function runCron(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getServerClient();
  const startedAt = new Date();

  try {
    // ── 1. 設定確認 ──
    const { data: settings } = await supabase.from("insights_settings").select("*").eq("id", 1).maybeSingle();
    if (!settings || !settings.mode_b_enabled) {
      return NextResponse.json({ ok: true, skipped: "Mode B 未有効" });
    }

    // ── 2. 月間予算チェック ──
    if (Number(settings.monthly_spent_usd) >= Number(settings.monthly_budget_usd)) {
      return NextResponse.json({ ok: true, skipped: "月間予算超過" });
    }

    // ── 3. 昨日の日付 ──
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const date = d.toISOString().slice(0, 10);

    // ── 4. 既に存在チェック ──
    const { data: existing } = await supabase.from("ai_daily_reviews").select("id").eq("review_date", date).maybeSingle();
    if (existing) {
      return NextResponse.json({ ok: true, skipped: "既に生成済み", date });
    }

    // ── 5. データ取得（並行、失敗してもnullで継続） ──
    const [ga4, clarity, tmanage] = await Promise.all([
      settings.use_ga4 ? fetchGa4Summary(date).catch(() => null) : Promise.resolve(null),
      settings.use_clarity ? fetchClaritySummary(date).catch(() => null) : Promise.resolve(null),
      settings.use_tmanage_db ? fetchTmanageSummary(date).catch(() => null) : Promise.resolve(null),
    ]);

    // ── 6. Claude API で分析 ──
    const review = await analyzeWithClaude({
      date,
      ga4,
      clarity,
      tmanage,
      model: settings.ai_model || "claude-sonnet-4-6",
    });

    // ── 7. ai_daily_reviews に保存 ──
    await supabase.from("ai_daily_reviews").insert({
      review_date: date,
      generated_at: startedAt.toISOString(),
      ga4_data: ga4,
      clarity_data: clarity,
      tmanage_data: tmanage,
      summary: review.summary,
      full_report: review.fullReport,
      good_news: review.goodNews,
      warnings: review.warnings,
      opportunities: review.opportunities,
      ai_model: settings.ai_model,
      input_tokens: review.inputTokens,
      output_tokens: review.outputTokens,
      cost_usd: review.costUsd,
    });

    // ── 8. 月間使用額 加算 ──
    const newSpent = Number(settings.monthly_spent_usd) + review.costUsd;
    await supabase.from("insights_settings").update({ monthly_spent_usd: newSpent }).eq("id", 1);

    // ── 9. Gmail通知（重大警告がある時 or 設定で常時通知） ──
    const shouldNotify =
      settings.email_notifications &&
      (!settings.notify_only_on_warnings || review.warnings.some((w) => w.severity === "high"));

    if (shouldNotify && settings.notification_emails && settings.notification_emails.length > 0) {
      // 既存の deliver-email APIを呼ぶ（簡略版：直接nodemailer使ってもOK）
      // ここでは省略、Phase 2 で実装
    }

    return NextResponse.json({
      ok: true,
      date,
      summary: review.summary,
      cost: review.costUsd.toFixed(6),
      tokens: { input: review.inputTokens, output: review.outputTokens },
    });
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error }, { status: 500 });
  }
}
