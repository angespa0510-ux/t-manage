/**
 * GET /api/insights/settings   設定取得
 * PUT /api/insights/settings   設定更新
 *
 * insights_settings テーブル（id=1の単一行）の操作。
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

export async function GET() {
  try {
    const supabase = getServerClient();
    const { data, error } = await supabase.from("insights_settings").select("*").eq("id", 1).maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ settings: data });
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const supabase = getServerClient();

    // 許可されたフィールドのみ更新
    const allowed: Record<string, unknown> = {};
    const fields = [
      "mode_a_enabled",
      "mode_b_enabled",
      "cron_hour",
      "ai_model",
      "use_batch_api",
      "email_notifications",
      "notification_emails",
      "notify_only_on_warnings",
      "use_ga4",
      "use_clarity",
      "use_tmanage_db",
      "monthly_budget_usd",
      "updated_by",
    ];
    fields.forEach((f) => {
      if (body[f] !== undefined) allowed[f] = body[f];
    });
    allowed.updated_at = new Date().toISOString();

    const { data, error } = await supabase.from("insights_settings").update(allowed).eq("id", 1).select().maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ settings: data });
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error }, { status: 500 });
  }
}
