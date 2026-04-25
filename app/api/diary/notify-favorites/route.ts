import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://cbewozzdyjqmhzkxsjqo.supabase.co";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * 新規日記投稿時に、お気に入り会員へpush通知を送る
 *
 * Body: { entryId }
 *
 * フロー:
 *   1. entry を取得 (deleted/hidden/会員限定 確認)
 *   2. customer_diary_favorites から notify_on_post=true な customer_id を集める
 *   3. /api/push/send に userIds で投げる
 */
export async function POST(req: Request) {
  try {
    const { entryId } = await req.json();
    if (!entryId) {
      return NextResponse.json({ error: "entryId が必要です" }, { status: 400 });
    }

    // entry取得
    const { data: entry } = await supabase
      .from("therapist_diary_entries")
      .select("id, therapist_id, title, body, cover_image_url, visibility, deleted_at")
      .eq("id", entryId)
      .maybeSingle();

    if (!entry || entry.deleted_at) {
      return NextResponse.json({ error: "記事が見つかりません" }, { status: 404 });
    }

    // セラピスト名取得
    const { data: therapist } = await supabase
      .from("therapists")
      .select("name")
      .eq("id", entry.therapist_id)
      .maybeSingle();

    if (!therapist) {
      return NextResponse.json({ error: "セラピストが見つかりません" }, { status: 404 });
    }

    // お気に入り会員 (notify_on_post=true) を取得
    const { data: favs } = await supabase
      .from("customer_diary_favorites")
      .select("customer_id")
      .eq("therapist_id", entry.therapist_id)
      .eq("notify_on_post", true);

    type FavRow = { customer_id: number };
    const customerIds = ((favs || []) as FavRow[]).map((f) => f.customer_id);

    if (customerIds.length === 0) {
      return NextResponse.json({ success: true, recipientCount: 0, message: "お気に入り会員なし" });
    }

    // 通知本文
    const titleText = `${therapist.name}さんが新しい日記を投稿しました`;
    const bodyText = entry.title.length > 60 ? entry.title.slice(0, 60) + "…" : entry.title;
    const url = `/diary/${entry.id}`;

    // push送信 (非同期で投げる、失敗しても投稿成功は変わらない)
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://t-manage.vercel.app";
    try {
      const res = await fetch(`${baseUrl}/api/push/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userType: "customer",
          userIds: customerIds,
          title: titleText,
          body: bodyText,
          url,
          tag: `diary-${entry.id}`,
          icon: entry.cover_image_url || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));

      return NextResponse.json({
        success: true,
        recipientCount: customerIds.length,
        pushResult: data,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "送信エラー";
      return NextResponse.json({
        success: false,
        recipientCount: customerIds.length,
        pushError: msg,
      });
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "不明なエラー";
    console.error("/api/diary/notify-favorites error:", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
