import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://cbewozzdyjqmhzkxsjqo.supabase.co";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * 駅ちか送信失敗のリトライAPI (スタッフのみ)
 * - 単発: { entryId } を渡す
 * - 一括: { retryAllFailed: true } で failed なもの全部
 */
export async function POST(req: Request) {
  try {
    const { entryId, retryAllFailed, staffId } = await req.json();

    // スタッフ認証
    if (!staffId) {
      return NextResponse.json({ error: "staffId が必要です" }, { status: 401 });
    }
    const { data: staff } = await supabase
      .from("staff")
      .select("id, role")
      .eq("id", staffId)
      .maybeSingle();
    if (!staff || !["owner", "manager", "leader"].includes(staff.role)) {
      return NextResponse.json({ error: "権限がありません" }, { status: 403 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://t-manage.vercel.app";

    // 対象 entry を集める
    let targetIds: number[] = [];

    if (retryAllFailed) {
      const { data: failed } = await supabase
        .from("therapist_diary_entries")
        .select("id")
        .eq("ekichika_dispatch_status", "failed")
        .eq("visibility", "public")
        .eq("send_to_ekichika", true)
        .is("deleted_at", null)
        .limit(50);
      targetIds = ((failed || []) as Array<{ id: number }>).map((r) => r.id);
    } else if (entryId) {
      targetIds = [parseInt(entryId)];
    } else {
      return NextResponse.json({ error: "entryId または retryAllFailed が必要" }, { status: 400 });
    }

    if (targetIds.length === 0) {
      return NextResponse.json({ success: true, message: "対象なし", processed: 0 });
    }

    // 対象を pending に戻して dispatch を順番に呼ぶ (並列だと駅ちか側が嫌がるかも)
    const results: { entryId: number; ok: boolean; error?: string }[] = [];

    for (const id of targetIds) {
      // status を pending に戻す
      await supabase
        .from("therapist_diary_entries")
        .update({
          ekichika_dispatch_status: "pending",
          ekichika_error_message: null,
        })
        .eq("id", id);

      try {
        const res = await fetch(`${baseUrl}/api/diary/dispatch-ekichika`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ entryId: id }),
        });
        const data = await res.json();
        results.push({
          entryId: id,
          ok: res.ok && !!data.success,
          error: data.error,
        });
      } catch (e) {
        results.push({
          entryId: id,
          ok: false,
          error: e instanceof Error ? e.message : "通信エラー",
        });
      }

      // 駅ちか側の rate limit を考慮して 500ms 待つ
      await new Promise((r) => setTimeout(r, 500));
    }

    const succeeded = results.filter((r) => r.ok).length;
    const failed = results.filter((r) => !r.ok).length;

    return NextResponse.json({
      success: true,
      processed: results.length,
      succeeded,
      failed,
      results,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "不明なエラー";
    console.error("/api/diary/retry-dispatch error:", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
