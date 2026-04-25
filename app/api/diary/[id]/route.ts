import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://cbewozzdyjqmhzkxsjqo.supabase.co";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

const VIEW_DEDUP_WINDOW_MIN = 10; // 同一IPで10分以内の重複はカウントしない

type DiaryEntry = {
  id: number;
  therapist_id: number;
  title: string;
  body: string;
  cover_image_url: string | null;
  visibility: "public" | "members_only";
  status: string;
  view_count: number;
  like_count: number;
  comment_count: number;
  published_at: string;
  ekichika_dispatch_status: string | null;
  ekichika_dispatched_at: string | null;
  deleted_at: string | null;
};

function hashIp(ip: string): string {
  return crypto.createHash("sha256").update(ip).digest("hex").slice(0, 32);
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: idStr } = await ctx.params;
    const id = parseInt(idStr);
    if (!id || isNaN(id)) {
      return NextResponse.json({ error: "不正なID" }, { status: 400 });
    }

    const url = new URL(req.url);
    const memberAuth = url.searchParams.get("memberAuth");
    const skipView = url.searchParams.get("skipView") === "1"; // プレビュー時など

    const { data: entry, error } = await supabase
      .from("therapist_diary_entries")
      .select(
        "id, therapist_id, title, body, cover_image_url, visibility, status, view_count, like_count, comment_count, published_at, ekichika_dispatch_status, ekichika_dispatched_at, deleted_at"
      )
      .eq("id", id)
      .maybeSingle();

    if (error || !entry) {
      return NextResponse.json({ error: "投稿が見つかりません" }, { status: 404 });
    }

    const e = entry as DiaryEntry;

    if (e.deleted_at) {
      return NextResponse.json({ error: "削除済み" }, { status: 404 });
    }

    if (e.status !== "published") {
      return NextResponse.json({ error: "非公開の投稿です" }, { status: 404 });
    }

    // 会員限定の場合は memberAuth が必要
    if (e.visibility === "members_only" && !memberAuth) {
      return NextResponse.json(
        {
          error: "会員ログインが必要です",
          requiresMembership: true,
          previewTitle: e.title,
          previewCoverUrl: e.cover_image_url,
        },
        { status: 401 }
      );
    }

    // セラピスト情報
    const { data: therapist } = await supabase
      .from("therapists")
      .select("id, name, real_name")
      .eq("id", e.therapist_id)
      .maybeSingle();

    // 画像
    const { data: images } = await supabase
      .from("therapist_diary_images")
      .select("id, image_url, thumbnail_url, sort_order, width, height, caption")
      .eq("entry_id", id)
      .order("sort_order", { ascending: true });

    // タグ
    const { data: tagJoins } = await supabase
      .from("therapist_diary_entry_tags")
      .select("therapist_diary_tags(id, name, display_name, color)")
      .eq("entry_id", id);

    type TagJoin = {
      therapist_diary_tags: { id: number; name: string; display_name: string; color: string | null } | null;
    };
    const tags = ((tagJoins || []) as unknown as TagJoin[])
      .map((row: TagJoin) => row.therapist_diary_tags)
      .filter((t): t is { id: number; name: string; display_name: string; color: string | null } => t !== null)
      .map((t) => ({ id: t.id, name: t.name, displayName: t.display_name, color: t.color }));

    // 閲覧カウント (同一IP10分以内は除外)
    if (!skipView) {
      const ip =
        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        req.headers.get("x-real-ip") ||
        "0.0.0.0";
      const ipHash = hashIp(ip);
      const cutoff = new Date(Date.now() - VIEW_DEDUP_WINDOW_MIN * 60 * 1000).toISOString();

      const { data: recent } = await supabase
        .from("therapist_diary_views")
        .select("id")
        .eq("entry_id", id)
        .eq("ip_hash", ipHash)
        .gte("viewed_at", cutoff)
        .limit(1);

      if (!recent || recent.length === 0) {
        await supabase.from("therapist_diary_views").insert({
          entry_id: id,
          ip_hash: ipHash,
          user_agent: req.headers.get("user-agent")?.slice(0, 500) || null,
          referrer: req.headers.get("referer")?.slice(0, 500) || null,
        });
        // entries.view_count をインクリメント
        await supabase
          .from("therapist_diary_entries")
          .update({ view_count: e.view_count + 1 })
          .eq("id", id);
        e.view_count += 1;
      }
    }

    return NextResponse.json({
      entry: {
        id: e.id,
        title: e.title,
        body: e.body,
        coverImageUrl: e.cover_image_url,
        visibility: e.visibility,
        viewCount: e.view_count,
        likeCount: e.like_count,
        commentCount: e.comment_count,
        publishedAt: e.published_at,
        ekichikaDispatchStatus: e.ekichika_dispatch_status,
        ekichikaDispatchedAt: e.ekichika_dispatched_at,
      },
      therapist: therapist
        ? {
            id: therapist.id,
            name: therapist.name,
          }
        : null,
      images: (
        (images || []) as Array<{
          id: number;
          image_url: string;
          thumbnail_url: string | null;
          sort_order: number;
          width: number | null;
          height: number | null;
          caption: string | null;
        }>
      ).map((img) => ({
        id: img.id,
        imageUrl: img.image_url,
        thumbnailUrl: img.thumbnail_url,
        sortOrder: img.sort_order,
        width: img.width,
        height: img.height,
        caption: img.caption,
      })),
      tags,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "不明なエラー";
    console.error("/api/diary/[id] GET error:", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * PATCH: 編集 (セラピスト本人 or スタッフ)
 */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: idStr } = await ctx.params;
    const id = parseInt(idStr);
    if (!id || isNaN(id)) {
      return NextResponse.json({ error: "不正なID" }, { status: 400 });
    }

    const body = await req.json();
    const {
      title,
      body: newBody,
      visibility,
      // 認証情報
      therapistId,
      authToken,
      staffId, // スタッフ編集時
    } = body;

    // 既存エントリ取得
    const { data: entry } = await supabase
      .from("therapist_diary_entries")
      .select("id, therapist_id, deleted_at")
      .eq("id", id)
      .maybeSingle();

    if (!entry) {
      return NextResponse.json({ error: "投稿が見つかりません" }, { status: 404 });
    }
    if (entry.deleted_at) {
      return NextResponse.json({ error: "削除済みです" }, { status: 400 });
    }

    // 認証
    let editedByStaffId: number | null = null;
    if (staffId) {
      // スタッフ編集
      const { data: staff } = await supabase
        .from("staff")
        .select("id, role")
        .eq("id", staffId)
        .maybeSingle();
      if (!staff || !["owner", "manager", "leader"].includes(staff.role)) {
        return NextResponse.json({ error: "権限がありません" }, { status: 403 });
      }
      editedByStaffId = staff.id;
    } else if (therapistId && authToken) {
      // セラピスト本人
      if (entry.therapist_id !== therapistId) {
        return NextResponse.json({ error: "権限がありません" }, { status: 403 });
      }
      const { data: therapist } = await supabase
        .from("therapists")
        .select("login_password, status")
        .eq("id", therapistId)
        .maybeSingle();
      if (!therapist || therapist.login_password !== authToken || therapist.status !== "active") {
        return NextResponse.json({ error: "認証エラー" }, { status: 401 });
      }
    } else {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    // 更新内容組み立て
    const updates: Record<string, unknown> = { status: "edited", edited_at: new Date().toISOString() };
    if (title !== undefined) {
      if (!title || title.length > 80) {
        return NextResponse.json({ error: "タイトルが不正です" }, { status: 400 });
      }
      updates.title = title.trim();
    }
    if (newBody !== undefined) {
      if (!newBody || newBody.length > 2000) {
        return NextResponse.json({ error: "本文が不正です" }, { status: 400 });
      }
      updates.body = newBody.trim();
    }
    if (visibility !== undefined) {
      if (!["public", "members_only"].includes(visibility)) {
        return NextResponse.json({ error: "可視性が不正です" }, { status: 400 });
      }
      updates.visibility = visibility;
    }
    if (editedByStaffId) updates.edited_by_staff_id = editedByStaffId;

    const { error: updErr } = await supabase
      .from("therapist_diary_entries")
      .update(updates)
      .eq("id", id);

    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "不明なエラー";
    console.error("/api/diary/[id] PATCH error:", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * DELETE: 論理削除 (セラピスト本人 or スタッフ)
 */
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: idStr } = await ctx.params;
    const id = parseInt(idStr);
    if (!id || isNaN(id)) {
      return NextResponse.json({ error: "不正なID" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const { therapistId, authToken, staffId, deleteReason } = body;

    const { data: entry } = await supabase
      .from("therapist_diary_entries")
      .select("id, therapist_id, deleted_at")
      .eq("id", id)
      .maybeSingle();

    if (!entry) {
      return NextResponse.json({ error: "投稿が見つかりません" }, { status: 404 });
    }
    if (entry.deleted_at) {
      return NextResponse.json({ success: true, alreadyDeleted: true });
    }

    let deletedByStaffId: number | null = null;
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
      if (entry.therapist_id !== therapistId) {
        return NextResponse.json({ error: "権限がありません" }, { status: 403 });
      }
      const { data: therapist } = await supabase
        .from("therapists")
        .select("login_password, status")
        .eq("id", therapistId)
        .maybeSingle();
      if (!therapist || therapist.login_password !== authToken || therapist.status !== "active") {
        return NextResponse.json({ error: "認証エラー" }, { status: 401 });
      }
    } else {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    await supabase
      .from("therapist_diary_entries")
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by_staff_id: deletedByStaffId,
        delete_reason: deleteReason || null,
      })
      .eq("id", id);

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "不明なエラー";
    console.error("/api/diary/[id] DELETE error:", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
