import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://cbewozzdyjqmhzkxsjqo.supabase.co";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

type EntryRow = {
  id: number;
  therapist_id: number;
  title: string;
  body: string;
  cover_image_url: string | null;
  visibility: string;
  status: string;
  view_count: number;
  like_count: number;
  comment_count: number;
  published_at: string;
  ekichika_dispatch_status: string | null;
  ekichika_dispatched_at: string | null;
  ekichika_error_message: string | null;
  edited_at: string | null;
  edited_by_staff_id: number | null;
  deleted_at: string | null;
  deleted_by_staff_id: number | null;
  delete_reason: string | null;
};

type Therapist = { id: number; name: string; status: string };

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const filter = url.searchParams.get("filter") || "all";
    const therapistIdStr = url.searchParams.get("therapistId");
    const fromDate = url.searchParams.get("from"); // YYYY-MM-DD
    const toDate = url.searchParams.get("to");
    const q = url.searchParams.get("q");
    const limit = Math.min(parseInt(url.searchParams.get("limit") || `${DEFAULT_LIMIT}`), MAX_LIMIT);
    const offset = parseInt(url.searchParams.get("offset") || "0");

    let query = supabase
      .from("therapist_diary_entries")
      .select(
        "id, therapist_id, title, body, cover_image_url, visibility, status, view_count, like_count, comment_count, published_at, ekichika_dispatch_status, ekichika_dispatched_at, ekichika_error_message, edited_at, edited_by_staff_id, deleted_at, deleted_by_staff_id, delete_reason",
        { count: "exact" }
      );

    // フィルタ
    if (filter === "active") {
      query = query.is("deleted_at", null);
    } else if (filter === "deleted") {
      query = query.not("deleted_at", "is", null);
    } else if (filter === "public") {
      query = query.is("deleted_at", null).eq("visibility", "public");
    } else if (filter === "members_only") {
      query = query.is("deleted_at", null).eq("visibility", "members_only");
    } else if (filter === "ekichika_failed") {
      query = query.is("deleted_at", null).eq("ekichika_dispatch_status", "failed");
    } else if (filter === "ekichika_pending") {
      query = query.is("deleted_at", null).eq("ekichika_dispatch_status", "pending");
    }

    if (therapistIdStr) {
      query = query.eq("therapist_id", parseInt(therapistIdStr));
    }

    if (fromDate) {
      query = query.gte("published_at", fromDate);
    }
    if (toDate) {
      query = query.lte("published_at", `${toDate}T23:59:59`);
    }

    if (q) {
      query = query.or(`title.ilike.%${q}%,body.ilike.%${q}%`);
    }

    query = query.order("published_at", { ascending: false }).range(offset, offset + limit - 1);

    const { data, count, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rows = (data || []) as EntryRow[];

    // セラピストまとめて取得
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

    const entries = rows.map((e) => {
      const t = therapistMap.get(e.therapist_id);
      return {
        id: e.id,
        therapist: {
          id: e.therapist_id,
          name: t?.name || "(削除済み)",
          status: t?.status || "unknown",
        },
        title: e.title,
        bodyPreview: e.body.length > 100 ? e.body.slice(0, 100) + "…" : e.body,
        coverImageUrl: e.cover_image_url,
        visibility: e.visibility,
        status: e.status,
        viewCount: e.view_count,
        likeCount: e.like_count,
        commentCount: e.comment_count,
        publishedAt: e.published_at,
        ekichikaDispatchStatus: e.ekichika_dispatch_status,
        ekichikaDispatchedAt: e.ekichika_dispatched_at,
        ekichikaErrorMessage: e.ekichika_error_message,
        editedAt: e.edited_at,
        editedByStaffId: e.edited_by_staff_id,
        deletedAt: e.deleted_at,
        deletedByStaffId: e.deleted_by_staff_id,
        deleteReason: e.delete_reason,
      };
    });

    // 統計サマリ (今月分)
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const { count: thisMonthTotal } = await supabase
      .from("therapist_diary_entries")
      .select("id", { count: "exact", head: true })
      .gte("published_at", monthStart)
      .is("deleted_at", null);

    const { count: thisMonthPublic } = await supabase
      .from("therapist_diary_entries")
      .select("id", { count: "exact", head: true })
      .gte("published_at", monthStart)
      .eq("visibility", "public")
      .is("deleted_at", null);

    const { count: thisMonthMembers } = await supabase
      .from("therapist_diary_entries")
      .select("id", { count: "exact", head: true })
      .gte("published_at", monthStart)
      .eq("visibility", "members_only")
      .is("deleted_at", null);

    const { count: thisMonthFailed } = await supabase
      .from("therapist_diary_entries")
      .select("id", { count: "exact", head: true })
      .gte("published_at", monthStart)
      .eq("ekichika_dispatch_status", "failed")
      .is("deleted_at", null);

    const { count: thisMonthSent } = await supabase
      .from("therapist_diary_entries")
      .select("id", { count: "exact", head: true })
      .gte("published_at", monthStart)
      .eq("ekichika_dispatch_status", "sent")
      .is("deleted_at", null);

    return NextResponse.json({
      entries,
      total: count || 0,
      hasMore: offset + entries.length < (count || 0),
      stats: {
        thisMonthTotal: thisMonthTotal || 0,
        thisMonthPublic: thisMonthPublic || 0,
        thisMonthMembers: thisMonthMembers || 0,
        thisMonthEkichikaFailed: thisMonthFailed || 0,
        thisMonthEkichikaSent: thisMonthSent || 0,
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "不明なエラー";
    console.error("/api/diary/admin-list error:", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
