import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://cbewozzdyjqmhzkxsjqo.supabase.co";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * HP用: 公開中ストーリーをセラピストごとにグループ化して返す
 *
 * Instagram風のストーリーリング表示用:
 *   [ゆめ姫] [あいり] [さくら] ... と並ぶ
 *   各セラピストの最新の未読サムネを表示
 *
 * クエリパラメータ:
 *   - memberAuth: 会員ID (会員限定ストーリーも含める)
 *   - viewerId: 閲覧者の customer_id (既読判定用)
 */

type StoryRow = {
  id: number;
  therapist_id: number;
  media_type: string;
  thumbnail_url: string | null;
  media_url: string | null;
  caption: string | null;
  visibility: string;
  published_at: string;
  expires_at: string;
};

type Therapist = { id: number; name: string };

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const memberAuth = url.searchParams.get("memberAuth");
    const viewerId = url.searchParams.get("viewerId");
    const isMember = !!memberAuth;

    // 公開中の全ストーリー取得
    let query = supabase
      .from("therapist_diary_stories")
      .select(
        "id, therapist_id, media_type, thumbnail_url, media_url, caption, visibility, published_at, expires_at"
      )
      .eq("status", "active")
      .gt("expires_at", new Date().toISOString())
      .is("deleted_at", null)
      .order("published_at", { ascending: false });

    // 非会員は public のみ
    if (!isMember) {
      query = query.eq("visibility", "public");
    }

    const { data: stories, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rows = (stories || []) as StoryRow[];

    // セラピスト情報まとめて取得
    const therapistIds = Array.from(new Set(rows.map((r) => r.therapist_id)));
    const therapistMap = new Map<number, Therapist>();
    if (therapistIds.length > 0) {
      const { data: therapists } = await supabase
        .from("therapists")
        .select("id, name")
        .in("id", therapistIds)
        .eq("status", "active")
        .is("deleted_at", null);
      if (therapists) {
        for (const t of therapists as Therapist[]) therapistMap.set(t.id, t);
      }
    }

    // 既読情報 (viewerId 指定時のみ)
    const readStoryIds = new Set<number>();
    if (viewerId) {
      const { data: views } = await supabase
        .from("therapist_diary_story_views")
        .select("story_id")
        .eq("customer_id", parseInt(viewerId))
        .in("story_id", rows.map((r) => r.id));
      if (views) {
        for (const v of views as Array<{ story_id: number }>) readStoryIds.add(v.story_id);
      }
    }

    // セラピストごとにグループ化
    type Group = {
      therapist: { id: number; name: string };
      stories: Array<{
        id: number;
        mediaType: "image" | "video";
        mediaUrl: string | null;
        thumbnailUrl: string | null;
        caption: string | null;
        visibility: string;
        publishedAt: string;
        expiresAt: string;
        isRead: boolean;
      }>;
      hasUnread: boolean;
      latestThumbnail: string | null;
      coverUrl: string | null; // 画像なら thumbnail、動画ならポスター用
    };
    const groupMap = new Map<number, Group>();

    for (const r of rows) {
      const therapist = therapistMap.get(r.therapist_id);
      if (!therapist) continue; // 退店等で取れない場合スキップ

      const isRead = readStoryIds.has(r.id);

      let g = groupMap.get(r.therapist_id);
      if (!g) {
        g = {
          therapist: { id: therapist.id, name: therapist.name },
          stories: [],
          hasUnread: false,
          latestThumbnail: r.thumbnail_url || r.media_url,
          coverUrl: r.thumbnail_url || (r.media_type === "image" ? r.media_url : null),
        };
        groupMap.set(r.therapist_id, g);
      }

      g.stories.push({
        id: r.id,
        mediaType: r.media_type as "image" | "video",
        mediaUrl: r.media_url,
        thumbnailUrl: r.thumbnail_url,
        caption: r.caption,
        visibility: r.visibility,
        publishedAt: r.published_at,
        expiresAt: r.expires_at,
        isRead,
      });

      if (!isRead) g.hasUnread = true;
    }

    // 配列化: 未読あり → 未読なし、それぞれ新しい順
    const groups = Array.from(groupMap.values()).sort((a, b) => {
      if (a.hasUnread !== b.hasUnread) return a.hasUnread ? -1 : 1;
      return b.stories[0].publishedAt.localeCompare(a.stories[0].publishedAt);
    });

    // 各グループ内のストーリーは古い順に並べ替え (タップで時系列に進む)
    for (const g of groups) {
      g.stories.reverse();
    }

    return NextResponse.json({ groups, total: groups.length });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "不明なエラー";
    console.error("/api/diary/story/active error:", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
