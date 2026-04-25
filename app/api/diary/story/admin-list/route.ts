import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://cbewozzdyjqmhzkxsjqo.supabase.co";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * 管理画面用: 全ストーリー一覧 (公開中/期限切れ/削除済み 含む)
 *
 * クエリ:
 *   - filter: active(default) | reported | expired | deleted | all
 *   - therapistId: フィルタ
 *   - q: キャプション検索
 */

type StoryRow = {
  id: number;
  therapist_id: number;
  media_type: string;
  media_url: string | null;
  thumbnail_url: string | null;
  caption: string | null;
  visibility: string;
  status: string;
  view_count: number;
  unique_viewer_count: number;
  reaction_count: number;
  is_reported: boolean;
  report_count: number;
  published_at: string;
  expires_at: string;
  deleted_at: string | null;
  delete_reason: string | null;
  storage_deleted_at: string | null;
};

type Therapist = { id: number; name: string; status: string };

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const filter = url.searchParams.get("filter") || "active";
    const therapistIdStr = url.searchParams.get("therapistId");
    const q = url.searchParams.get("q");
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "100"), 200);

    let query = supabase
      .from("therapist_diary_stories")
      .select(
        "id, therapist_id, media_type, media_url, thumbnail_url, caption, visibility, status, view_count, unique_viewer_count, reaction_count, is_reported, report_count, published_at, expires_at, deleted_at, delete_reason, storage_deleted_at"
      );

    if (filter === "active") {
      query = query.eq("status", "active").gt("expires_at", new Date().toISOString()).is("deleted_at", null);
    } else if (filter === "reported") {
      query = query.eq("is_reported", true).is("deleted_at", null);
    } else if (filter === "expired") {
      query = query.eq("status", "expired").is("deleted_at", null);
    } else if (filter === "deleted") {
      query = query.not("deleted_at", "is", null);
    }
    // all は無条件

    if (therapistIdStr) {
      query = query.eq("therapist_id", parseInt(therapistIdStr));
    }
    if (q) {
      query = query.ilike("caption", `%${q}%`);
    }

    // 通報優先 → 公開中 → 新しい順
    query = query
      .order("is_reported", { ascending: false })
      .order("published_at", { ascending: false })
      .limit(limit);

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rows = (data || []) as StoryRow[];

    // セラピスト情報まとめて取得
    const therapistIds = Array.from(new Set(rows.map((r) => r.therapist_id)));
    const therapistMap = new Map<number, Therapist>();
    if (therapistIds.length > 0) {
      const { data: therapists } = await supabase
        .from("therapists")
        .select("id, name, status")
        .in("id", therapistIds);
      if (therapists) {
        for (const t of therapists as Therapist[]) therapistMap.set(t.id, t);
      }
    }

    const stories = rows.map((r) => {
      const t = therapistMap.get(r.therapist_id);
      const expiresIn = new Date(r.expires_at).getTime() - Date.now();
      return {
        id: r.id,
        therapist: { id: r.therapist_id, name: t?.name || "(削除済み)", status: t?.status || "unknown" },
        mediaType: r.media_type,
        mediaUrl: r.media_url,
        thumbnailUrl: r.thumbnail_url,
        caption: r.caption,
        visibility: r.visibility,
        status: r.status,
        viewCount: r.view_count,
        uniqueViewerCount: r.unique_viewer_count,
        reactionCount: r.reaction_count,
        isReported: r.is_reported,
        reportCount: r.report_count,
        publishedAt: r.published_at,
        expiresAt: r.expires_at,
        expiresInMs: expiresIn,
        deletedAt: r.deleted_at,
        deleteReason: r.delete_reason,
        storageDeletedAt: r.storage_deleted_at,
      };
    });

    // 統計サマリ
    const { count: activeCount } = await supabase
      .from("therapist_diary_stories")
      .select("id", { count: "exact", head: true })
      .eq("status", "active")
      .gt("expires_at", new Date().toISOString())
      .is("deleted_at", null);

    const { count: reportedCount } = await supabase
      .from("therapist_diary_stories")
      .select("id", { count: "exact", head: true })
      .eq("is_reported", true)
      .is("deleted_at", null);

    const { count: todayPostsCount } = await supabase
      .from("therapist_diary_stories")
      .select("id", { count: "exact", head: true })
      .gte("published_at", new Date(Date.now() - 24 * 3600 * 1000).toISOString());

    return NextResponse.json({
      stories,
      stats: {
        activeCount: activeCount || 0,
        reportedCount: reportedCount || 0,
        todayPostsCount: todayPostsCount || 0,
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "不明なエラー";
    console.error("/api/diary/story/admin-list error:", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
