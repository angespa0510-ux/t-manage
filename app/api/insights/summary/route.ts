/**
 * GET /api/insights/summary?date=YYYY-MM-DD
 *
 * 指定日の GA4 / Clarity / T-MANAGE 統合サマリーを返す。
 * Mode A（手動コピー）と Mode B（自動分析）の両方で使用される共通エンドポイント。
 *
 * 各APIが未設定の場合は、そのソースは null になる（部分的な動作を許容）。
 *
 * キャッシュ:
 * - insights_data_cache テーブルに 24時間キャッシュ
 * - 同じ日付で何度叩いても API コール1回で済む
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fetchGa4Summary, type Ga4Summary } from "../../../../lib/insights/ga4-client";
import { fetchClaritySummary, type ClaritySummary } from "../../../../lib/insights/clarity-client";
import { fetchTmanageSummary, type TmanageSummary } from "../../../../lib/insights/tmanage-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SourceResult<T> = { data: T; cached: boolean; error?: undefined } | { data: null; cached: false; error: string };

function getServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !serviceKey) throw new Error("Supabase接続情報が未設定");
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

/**
 * キャッシュ確認 → なければfetch → キャッシュに保存
 */
async function getCachedOrFetch<T>(
  source: "ga4" | "clarity" | "tmanage",
  date: string,
  fetcher: () => Promise<T>,
  cacheHours: number = 24
): Promise<SourceResult<T>> {
  const supabase = getServerClient();

  // ── キャッシュ確認 ──
  const { data: cached } = await supabase
    .from("insights_data_cache")
    .select("data, expires_at")
    .eq("source", source)
    .eq("target_date", date)
    .maybeSingle();

  if (cached && new Date(cached.expires_at) > new Date()) {
    return { data: cached.data as T, cached: true };
  }

  // ── キャッシュなし or 期限切れ → fetch ──
  try {
    const data = await fetcher();
    const expiresAt = new Date(Date.now() + cacheHours * 60 * 60 * 1000).toISOString();

    // upsert
    await supabase.from("insights_data_cache").upsert(
      {
        source,
        target_date: date,
        data: data as object,
        fetched_at: new Date().toISOString(),
        expires_at: expiresAt,
      },
      { onConflict: "source,target_date" }
    );

    return { data, cached: false };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    return { data: null, cached: false, error };
  }
}

// ───────── GET /api/insights/summary ─────────

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    // 日付決定（デフォルト: 昨日）
    let date = searchParams.get("date");
    if (!date) {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      date = d.toISOString().slice(0, 10);
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: "date は YYYY-MM-DD 形式で" }, { status: 400 });
    }

    // ── 3ソース並行取得 ──
    const [ga4, clarity, tmanage] = await Promise.all([
      getCachedOrFetch<Ga4Summary>("ga4", date, () => fetchGa4Summary(date as string)),
      getCachedOrFetch<ClaritySummary>("clarity", date, () => fetchClaritySummary(date as string)),
      getCachedOrFetch<TmanageSummary>("tmanage", date, () => fetchTmanageSummary(date as string), 1), // 当日データは1時間キャッシュ
    ]);

    return NextResponse.json({
      date,
      ga4,
      clarity,
      tmanage,
      generatedAt: new Date().toISOString(),
    });
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error }, { status: 500 });
  }
}
