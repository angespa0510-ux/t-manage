import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://cbewozzdyjqmhzkxsjqo.supabase.co";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const PREVIEW_LEN = 120;

type DiaryEntry = {
  id: number;
  therapist_id: number;
  title: string;
  body: string;
  cover_image_url: string | null;
  visibility: "public" | "members_only";
  view_count: number;
  like_count: number;
  comment_count: number;
  published_at: string;
};

type Therapist = { id: number; name: string };

type ImageRow = { entry_id: number; image_url: string; thumbnail_url: string | null; sort_order: number };

type TagRow = {
  entry_id: number;
  therapist_diary_tags: { id: number; name: string; display_name: string; color: string | null } | null;
};

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const therapistId = url.searchParams.get("therapistId");
    const therapistIdsStr = url.searchParams.get("therapistIds"); // カンマ区切り
    const tag = url.searchParams.get("tag");
    const q = url.searchParams.get("q");
    const visibility = url.searchParams.get("visibility") || "public";
    const memberAuth = url.searchParams.get("memberAuth"); // 会員認証(簡易)
    const sortBy = url.searchParams.get("sortBy") || "newest";
    const limit = Math.min(parseInt(url.searchParams.get("limit") || `${DEFAULT_LIMIT}`), MAX_LIMIT);
    const offset = parseInt(url.searchParams.get("offset") || "0");

    // 可視性: members_only / all はログイン会員のみアクセス可
    const isMember = !!memberAuth; // 簡易判定
    if ((visibility === "members_only" || visibility === "all") && !isMember) {
      return NextResponse.json({ error: "会員ログインが必要です" }, { status: 401 });
    }

    let query = supabase
      .from("therapist_diary_entries")
      .select(
        "id, therapist_id, title, body, cover_image_url, visibility, view_count, like_count, comment_count, published_at",
        { count: "exact" }
      )
      .is("deleted_at", null)
      .eq("status", "published")
      .lte("published_at", new Date().toISOString());

    if (visibility === "public") {
      query = query.eq("visibility", "public");
    } else if (visibility === "members_only") {
      query = query.eq("visibility", "members_only");
    }
    // 'all' は両方含める (会員のみ到達可能)

    if (therapistId) {
      query = query.eq("therapist_id", parseInt(therapistId));
    } else if (therapistIdsStr) {
      const ids = therapistIdsStr.split(",").map((s) => parseInt(s.trim())).filter((n) => !isNaN(n));
      if (ids.length === 0) {
        return NextResponse.json({ entries: [], total: 0, hasMore: false });
      }
      query = query.in("therapist_id", ids);
    }

    if (q) {
      query = query.or(`title.ilike.%${q}%,body.ilike.%${q}%`);
    }

    // タグフィルタは中間テーブル経由なので、entry_idリストを先に取得
    if (tag) {
      const { data: tagRow } = await supabase
        .from("therapist_diary_tags")
        .select("id")
        .eq("name", tag.replace(/^#/, ""))
        .maybeSingle();

      if (!tagRow) {
        return NextResponse.json({ entries: [], total: 0, hasMore: false });
      }

      const { data: entryIds } = await supabase
        .from("therapist_diary_entry_tags")
        .select("entry_id")
        .eq("tag_id", tagRow.id);

      const ids = ((entryIds || []) as Array<{ entry_id: number }>).map((r) => r.entry_id);
      if (ids.length === 0) {
        return NextResponse.json({ entries: [], total: 0, hasMore: false });
      }
      query = query.in("id", ids);
    }

    // ソート
    if (sortBy === "popular") {
      query = query.order("view_count", { ascending: false });
    } else if (sortBy === "most_liked") {
      query = query.order("like_count", { ascending: false });
    } else {
      query = query.order("published_at", { ascending: false });
    }

    query = query.range(offset, offset + limit - 1);

    const { data: entries, count, error } = await query;
    if (error) {
      console.error("list error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!entries || entries.length === 0) {
      return NextResponse.json({ entries: [], total: count || 0, hasMore: false });
    }

    const entryRows = entries as DiaryEntry[];

    // セラピスト情報まとめて取得
    const therapistIds = Array.from(new Set(entryRows.map((e) => e.therapist_id)));
    const { data: therapists } = await supabase
      .from("therapists")
      .select("id, name")
      .in("id", therapistIds);
    const therapistMap = new Map<number, Therapist>();
    if (therapists) {
      for (const t of therapists as Therapist[]) therapistMap.set(t.id, t);
    }

    // 画像枚数を取得 (タイムライン表示用)
    const entryIds = entryRows.map((e) => e.id);
    const { data: images } = await supabase
      .from("therapist_diary_images")
      .select("entry_id, image_url, thumbnail_url, sort_order")
      .in("entry_id", entryIds)
      .order("sort_order", { ascending: true });

    const imageCountMap = new Map<number, number>();
    if (images) {
      for (const img of images as ImageRow[]) {
        imageCountMap.set(img.entry_id, (imageCountMap.get(img.entry_id) || 0) + 1);
      }
    }

    // タグ取得
    const { data: tagJoins } = await supabase
      .from("therapist_diary_entry_tags")
      .select("entry_id, therapist_diary_tags(id, name, display_name, color)")
      .in("entry_id", entryIds);

    const tagsByEntry = new Map<
      number,
      { id: number; name: string; displayName: string; color: string | null }[]
    >();
    if (tagJoins) {
      for (const row of tagJoins as unknown as TagRow[]) {
        const tg = row.therapist_diary_tags;
        if (!tg) continue;
        const arr = tagsByEntry.get(row.entry_id) || [];
        arr.push({
          id: tg.id,
          name: tg.name,
          displayName: tg.display_name,
          color: tg.color,
        });
        tagsByEntry.set(row.entry_id, arr);
      }
    }

    const result = entryRows.map((e) => {
      const t = therapistMap.get(e.therapist_id);
      const preview = e.body.length > PREVIEW_LEN ? e.body.slice(0, PREVIEW_LEN) + "…" : e.body;
      return {
        id: e.id,
        therapist: {
          id: e.therapist_id,
          name: t?.name || "",
        },
        title: e.title,
        bodyPreview: preview,
        coverImageUrl: e.cover_image_url,
        imageCount: imageCountMap.get(e.id) || 0,
        visibility: e.visibility,
        tags: tagsByEntry.get(e.id) || [],
        likeCount: e.like_count,
        commentCount: e.comment_count,
        viewCount: e.view_count,
        publishedAt: e.published_at,
      };
    });

    const total = count || 0;
    const hasMore = offset + result.length < total;

    return NextResponse.json({ entries: result, total, hasMore });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "不明なエラー";
    console.error("/api/diary/list error:", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
