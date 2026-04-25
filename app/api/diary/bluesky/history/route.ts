import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://cbewozzdyjqmhzkxsjqo.supabase.co";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Bluesky 投稿履歴
 *
 * GET ?therapistId=xx [&limit=20]  (本人マイページ)
 * GET ?staff=1 [&limit=50]          (管理画面用、全セラピスト)
 *
 * 返り値:
 *   {
 *     posts: [
 *       { id, entryId, entryTitle, therapist, status, blueskyPostUrl, postedText, errorMessage, skipReason, createdAt }
 *     ],
 *     stats: { posted, failed, skipped, today }
 *   }
 */

type PostRow = {
  id: number;
  entry_id: number;
  therapist_id: number;
  status: string;
  bluesky_post_url: string | null;
  posted_text: string | null;
  posted_image_url: string | null;
  daily_post_index: number | null;
  error_message: string | null;
  skip_reason: string | null;
  posted_at: string | null;
  created_at: string;
};

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const therapistIdStr = url.searchParams.get("therapistId");
    const isStaffView = url.searchParams.get("staff") === "1";
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "30"), 200);

    if (!isStaffView && !therapistIdStr) {
      return NextResponse.json({ error: "therapistId か staff=1 が必要です" }, { status: 400 });
    }

    let query = supabase
      .from("diary_bluesky_posts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (therapistIdStr) {
      query = query.eq("therapist_id", parseInt(therapistIdStr));
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rows = (data || []) as PostRow[];

    // entry / therapist 情報まとめて取得
    const entryIds = Array.from(new Set(rows.map((r) => r.entry_id)));
    const therapistIds = Array.from(new Set(rows.map((r) => r.therapist_id)));

    type EntryLite = { id: number; title: string };
    type TherapistLite = { id: number; name: string };

    const entryMap = new Map<number, EntryLite>();
    const therapistMap = new Map<number, TherapistLite>();

    if (entryIds.length > 0) {
      const { data: entries } = await supabase
        .from("therapist_diary_entries")
        .select("id, title")
        .in("id", entryIds);
      if (entries) {
        for (const e of entries as EntryLite[]) entryMap.set(e.id, e);
      }
    }

    if (therapistIds.length > 0) {
      const { data: therapists } = await supabase
        .from("therapists")
        .select("id, name")
        .in("id", therapistIds);
      if (therapists) {
        for (const t of therapists as TherapistLite[]) therapistMap.set(t.id, t);
      }
    }

    const posts = rows.map((r) => ({
      id: r.id,
      entryId: r.entry_id,
      entryTitle: entryMap.get(r.entry_id)?.title || "(削除済み)",
      therapist: {
        id: r.therapist_id,
        name: therapistMap.get(r.therapist_id)?.name || "(削除済み)",
      },
      status: r.status,
      blueskyPostUrl: r.bluesky_post_url,
      postedText: r.posted_text,
      postedImageUrl: r.posted_image_url,
      dailyPostIndex: r.daily_post_index,
      errorMessage: r.error_message,
      skipReason: r.skip_reason,
      postedAt: r.posted_at,
      createdAt: r.created_at,
    }));

    // 統計
    const stats = {
      posted: rows.filter((r) => r.status === "posted").length,
      failed: rows.filter((r) => r.status === "failed").length,
      skipped: rows.filter((r) => r.status === "skipped").length,
      today: rows.filter((r) => {
        if (!r.created_at) return false;
        const d = new Date(r.created_at);
        const today = new Date();
        return d.toDateString() === today.toDateString();
      }).length,
    };

    return NextResponse.json({ posts, stats });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "不明なエラー";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
