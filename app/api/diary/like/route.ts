import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://cbewozzdyjqmhzkxsjqo.supabase.co";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * いいねトグル (会員のみ)
 *
 * Body: { entryId, customerId }
 *
 * 既にいいね済みなら解除、未いいねなら新規追加。
 * UNIQUE(entry_id, customer_id) 制約あり。
 * like_count は手動更新 (DBトリガーがある場合は不要だが、確実性のため)。
 */
export async function POST(req: Request) {
  try {
    const { entryId, customerId } = await req.json();

    if (!entryId || !customerId) {
      return NextResponse.json({ error: "entryId と customerId が必要です" }, { status: 400 });
    }

    // 会員確認
    const { data: customer } = await supabase
      .from("customers")
      .select("id")
      .eq("id", customerId)
      .maybeSingle();
    if (!customer) {
      return NextResponse.json({ error: "会員が見つかりません" }, { status: 401 });
    }

    // entry確認
    const { data: entry } = await supabase
      .from("therapist_diary_entries")
      .select("id, like_count, deleted_at")
      .eq("id", entryId)
      .maybeSingle();
    if (!entry || entry.deleted_at) {
      return NextResponse.json({ error: "記事が見つかりません" }, { status: 404 });
    }

    // 既存チェック
    const { data: existing } = await supabase
      .from("therapist_diary_likes")
      .select("id")
      .eq("entry_id", entryId)
      .eq("customer_id", customerId)
      .maybeSingle();

    if (existing) {
      // 解除
      await supabase.from("therapist_diary_likes").delete().eq("id", existing.id);
      const newCount = Math.max(0, entry.like_count - 1);
      await supabase
        .from("therapist_diary_entries")
        .update({ like_count: newCount })
        .eq("id", entryId);
      return NextResponse.json({ success: true, liked: false, likeCount: newCount });
    } else {
      // 追加
      const { error: insErr } = await supabase
        .from("therapist_diary_likes")
        .insert({ entry_id: entryId, customer_id: customerId });
      if (insErr) {
        return NextResponse.json({ error: insErr.message }, { status: 500 });
      }
      const newCount = entry.like_count + 1;
      await supabase
        .from("therapist_diary_entries")
        .update({ like_count: newCount })
        .eq("id", entryId);
      return NextResponse.json({ success: true, liked: true, likeCount: newCount });
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "不明なエラー";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * いいね状態確認
 *
 * GET ?entryId=xx&customerId=xx
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const entryId = url.searchParams.get("entryId");
    const customerId = url.searchParams.get("customerId");

    if (!entryId) {
      return NextResponse.json({ error: "entryId が必要です" }, { status: 400 });
    }

    const { data: entry } = await supabase
      .from("therapist_diary_entries")
      .select("like_count")
      .eq("id", entryId)
      .maybeSingle();

    if (!entry) {
      return NextResponse.json({ error: "記事が見つかりません" }, { status: 404 });
    }

    let liked = false;
    if (customerId) {
      const { data: like } = await supabase
        .from("therapist_diary_likes")
        .select("id")
        .eq("entry_id", entryId)
        .eq("customer_id", customerId)
        .maybeSingle();
      liked = !!like;
    }

    return NextResponse.json({ liked, likeCount: entry.like_count });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "不明なエラー";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * 一括状態取得 (タイムライン用)
 *
 * Body: { entryIds: number[], customerId }
 * Returns: { liked: { [entryId]: boolean } }
 */
export async function PUT(req: Request) {
  try {
    const { entryIds, customerId } = await req.json();

    if (!Array.isArray(entryIds) || entryIds.length === 0) {
      return NextResponse.json({ liked: {} });
    }
    if (!customerId) {
      return NextResponse.json({ liked: {} });
    }

    const { data, error } = await supabase
      .from("therapist_diary_likes")
      .select("entry_id")
      .in("entry_id", entryIds)
      .eq("customer_id", customerId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const likedMap: Record<number, boolean> = {};
    for (const row of (data || []) as Array<{ entry_id: number }>) {
      likedMap[row.entry_id] = true;
    }

    return NextResponse.json({ liked: likedMap });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "不明なエラー";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
