import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://cbewozzdyjqmhzkxsjqo.supabase.co";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * デモアカウント自動リセット (Vercel Cron で毎日0時JST = 15時UTC前日に実行)
 *
 * セラピストさんが触ったデモアカウントの書き込みを毎晩クリアする。
 * リセット対象:
 * - shift_requests (シフト希望)
 * - customer_therapist_memos (顧客メモ)
 * - therapist_expenses (個人経費)
 * - manual_reads (マニュアル既読)
 * - manual_ai_logs (AI質問ログ)
 * - therapist_notifications (お知らせ既読)
 *
 * デモアカウント自体（therapists レコード）は削除しない。
 */
export async function GET(req: Request) {
  // Vercel Cron 認証
  const authHeader = req.headers.get("authorization");
  const expectedSecret = process.env.CRON_SECRET;
  if (expectedSecret && authHeader !== `Bearer ${expectedSecret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    // デモアカウントを取得
    const { data: demo, error: demoErr } = await supabase
      .from("therapists")
      .select("id, login_email")
      .eq("is_demo", true)
      .maybeSingle();

    if (demoErr || !demo) {
      return NextResponse.json(
        { error: "demo account not found", details: demoErr?.message },
        { status: 404 }
      );
    }

    const demoId = demo.id;
    const result: Record<string, number | string> = {
      demo_therapist_id: demoId,
      timestamp: new Date().toISOString(),
    };

    // 各テーブルから demo_id のデータを削除
    // エラーが起きても他のテーブルの処理は続ける
    const tables = [
      "shift_requests",
      "customer_therapist_memos",
      "therapist_expenses",
      "manual_reads",
      "manual_ai_logs",
    ];

    for (const table of tables) {
      try {
        const { error, count } = await supabase
          .from(table)
          .delete({ count: "exact" })
          .eq("therapist_id", demoId);

        if (error) {
          result[`${table}_error`] = error.message;
        } else {
          result[`${table}_deleted`] = count || 0;
        }
      } catch (e) {
        result[`${table}_error`] = e instanceof Error ? e.message : "unknown error";
      }
    }

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "unknown error" },
      { status: 500 }
    );
  }
}
