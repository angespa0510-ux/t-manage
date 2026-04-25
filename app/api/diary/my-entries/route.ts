import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://cbewozzdyjqmhzkxsjqo.supabase.co";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const therapistId = url.searchParams.get("therapistId");
    const authToken = url.searchParams.get("authToken");
    const includeDeleted = url.searchParams.get("includeDeleted") === "1";

    if (!therapistId || !authToken) {
      return NextResponse.json({ error: "認証情報が必要です" }, { status: 401 });
    }

    // 認証
    const { data: therapist } = await supabase
      .from("therapists")
      .select("id, login_password, status")
      .eq("id", parseInt(therapistId))
      .maybeSingle();

    if (!therapist || therapist.login_password !== authToken || therapist.status !== "active") {
      return NextResponse.json({ error: "認証に失敗しました" }, { status: 401 });
    }

    let query = supabase
      .from("therapist_diary_entries")
      .select(
        "id, title, body, cover_image_url, visibility, status, view_count, like_count, comment_count, published_at, ekichika_dispatch_status, ekichika_dispatched_at, ekichika_error_message, deleted_at"
      )
      .eq("therapist_id", parseInt(therapistId));

    if (!includeDeleted) {
      query = query.is("deleted_at", null);
    }

    query = query.order("published_at", { ascending: false }).limit(100);

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    type EntryRow = {
      id: number;
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
      deleted_at: string | null;
    };

    return NextResponse.json({
      entries: ((data || []) as EntryRow[]).map((e) => ({
        id: e.id,
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
        deletedAt: e.deleted_at,
      })),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "不明なエラー";
    console.error("/api/diary/my-entries error:", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
