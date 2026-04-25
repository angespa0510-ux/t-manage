import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://cbewozzdyjqmhzkxsjqo.supabase.co";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * 顧客のポイント残高取得 (期限切れ除外)
 *
 * GET ?customerId=xx
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const customerIdStr = url.searchParams.get("customerId");
    if (!customerIdStr) {
      return NextResponse.json({ error: "customerId が必要です" }, { status: 400 });
    }
    const customerId = parseInt(customerIdStr);

    const { data: ptRows, error } = await supabase
      .from("customer_points")
      .select("amount, expires_at")
      .eq("customer_id", customerId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    type PtRow = { amount: number; expires_at: string | null };
    const now = new Date();
    let balance = 0;
    for (const p of (ptRows || []) as PtRow[]) {
      if (p.amount > 0 && p.expires_at && new Date(p.expires_at) < now) continue;
      balance += p.amount;
    }

    return NextResponse.json({ pointBalance: balance });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "不明なエラー";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
