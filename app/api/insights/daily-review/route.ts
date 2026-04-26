/**
 * GET /api/insights/daily-review?date=YYYY-MM-DD
 * GET /api/insights/daily-review?recent=7
 *
 * ai_daily_reviews から過去のAI分析レポートを取得。
 *
 * - ?date 指定: その日のレポート1件（なければ null）
 * - ?recent=N: 最新N件のサマリー（リスト表示用）
 * - 引数なし: 最新1件
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !serviceKey) throw new Error("Supabase接続情報が未設定");
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const supabase = getServerClient();

    const date = searchParams.get("date");
    const recent = Number(searchParams.get("recent") || 0);

    // ── 単日指定 ──
    if (date) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return NextResponse.json({ error: "date は YYYY-MM-DD 形式で" }, { status: 400 });
      }
      const { data, error } = await supabase.from("ai_daily_reviews").select("*").eq("review_date", date).maybeSingle();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ review: data || null });
    }

    // ── 最新N件 ──
    if (recent > 0) {
      const { data, error } = await supabase
        .from("ai_daily_reviews")
        .select("review_date, summary, warnings, generated_at, read_at, cost_usd")
        .order("review_date", { ascending: false })
        .limit(Math.min(recent, 30));
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ reviews: data || [] });
    }

    // ── 最新1件（デフォルト） ──
    const { data, error } = await supabase
      .from("ai_daily_reviews")
      .select("*")
      .order("review_date", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ review: data || null });
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error }, { status: 500 });
  }
}

// ───────── PATCH: 既読化 ─────────

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const date: string | undefined = body.date;
    const readBy: string | undefined = body.readBy;
    if (!date) return NextResponse.json({ error: "date 必須" }, { status: 400 });

    const supabase = getServerClient();
    const { error } = await supabase
      .from("ai_daily_reviews")
      .update({ read_at: new Date().toISOString(), read_by: readBy ?? null })
      .eq("review_date", date);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error }, { status: 500 });
  }
}
