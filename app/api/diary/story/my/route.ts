import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://cbewozzdyjqmhzkxsjqo.supabase.co";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * セラピスト自身のストーリー一覧 (公開中 + 期限切れの直近)
 *
 * GET ?therapistId=&authToken=
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const therapistId = url.searchParams.get("therapistId");
    const authToken = url.searchParams.get("authToken");
    const includeExpired = url.searchParams.get("includeExpired") === "1";

    if (!therapistId || !authToken) {
      return NextResponse.json({ error: "認証情報が必要です" }, { status: 401 });
    }

    const { data: therapist } = await supabase
      .from("therapists")
      .select("id, login_password, status")
      .eq("id", parseInt(therapistId))
      .maybeSingle();

    if (!therapist || therapist.login_password !== authToken || therapist.status !== "active") {
      return NextResponse.json({ error: "認証に失敗しました" }, { status: 401 });
    }

    let query = supabase
      .from("therapist_diary_stories")
      .select(
        "id, media_type, media_url, thumbnail_url, caption, visibility, status, view_count, unique_viewer_count, reaction_count, published_at, expires_at, video_duration_sec"
      )
      .eq("therapist_id", parseInt(therapistId))
      .is("deleted_at", null)
      .order("published_at", { ascending: false });

    if (!includeExpired) {
      query = query.eq("status", "active");
    }

    query = query.limit(50);

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    type Row = {
      id: number;
      media_type: string;
      media_url: string | null;
      thumbnail_url: string | null;
      caption: string | null;
      visibility: string;
      status: string;
      view_count: number;
      unique_viewer_count: number;
      reaction_count: number;
      published_at: string;
      expires_at: string;
      video_duration_sec: number | null;
    };

    return NextResponse.json({
      stories: ((data || []) as Row[]).map((s) => ({
        id: s.id,
        mediaType: s.media_type,
        mediaUrl: s.media_url,
        thumbnailUrl: s.thumbnail_url,
        caption: s.caption,
        visibility: s.visibility,
        status: s.status,
        viewCount: s.view_count,
        uniqueViewerCount: s.unique_viewer_count,
        reactionCount: s.reaction_count,
        publishedAt: s.published_at,
        expiresAt: s.expires_at,
        videoDurationSec: s.video_duration_sec,
        isExpired: new Date(s.expires_at) < new Date() || s.status !== "active",
      })),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "不明なエラー";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * ストーリー削除 (本人 or スタッフ)
 *
 * Body: { storyId, therapistId?, authToken?, staffId? }
 */
export async function DELETE(req: Request) {
  try {
    const body = await req.json();
    const { storyId, therapistId, authToken, staffId, deleteReason } = body;

    if (!storyId) {
      return NextResponse.json({ error: "storyId が必要です" }, { status: 400 });
    }

    const { data: story } = await supabase
      .from("therapist_diary_stories")
      .select("id, therapist_id, media_url, deleted_at, status")
      .eq("id", storyId)
      .maybeSingle();

    if (!story) {
      return NextResponse.json({ error: "ストーリーが見つかりません" }, { status: 404 });
    }
    if (story.deleted_at) {
      return NextResponse.json({ success: true, alreadyDeleted: true });
    }

    let deletedByStaffId: number | null = null;
    let isSelfDelete = false;

    if (staffId) {
      const { data: staff } = await supabase
        .from("staff")
        .select("id, role")
        .eq("id", staffId)
        .maybeSingle();
      if (!staff || !["owner", "manager", "leader"].includes(staff.role)) {
        return NextResponse.json({ error: "権限がありません" }, { status: 403 });
      }
      deletedByStaffId = staff.id;
    } else if (therapistId && authToken) {
      if (story.therapist_id !== therapistId) {
        return NextResponse.json({ error: "権限がありません" }, { status: 403 });
      }
      const { data: t } = await supabase
        .from("therapists")
        .select("login_password, status")
        .eq("id", therapistId)
        .maybeSingle();
      if (!t || t.login_password !== authToken || t.status !== "active") {
        return NextResponse.json({ error: "認証エラー" }, { status: 401 });
      }
      isSelfDelete = true;
    } else {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    // 論理削除 + Storage削除キューに登録
    await supabase
      .from("therapist_diary_stories")
      .update({
        status: isSelfDelete ? "deleted_by_self" : "deleted_by_staff",
        deleted_at: new Date().toISOString(),
        deleted_by_staff_id: deletedByStaffId,
        delete_reason: deleteReason || null,
      })
      .eq("id", storyId);

    // Storage削除キューに登録 (即時削除予定)
    if (story.media_url) {
      const m = story.media_url.match(/\/therapist-stories\/(.+)$/);
      if (m) {
        await supabase.from("storage_deletion_queue").insert({
          storage_bucket: "therapist-stories",
          storage_path: m[1],
          related_type: "story",
          related_id: storyId,
          therapist_id: story.therapist_id,
          scheduled_delete_at: new Date().toISOString(),
          reason: isSelfDelete ? "manual_delete" : "manual_delete",
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "不明なエラー";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
