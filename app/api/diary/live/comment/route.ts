import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://cbewozzdyjqmhzkxsjqo.supabase.co";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

const MAX_COMMENT_LEN = 100;

/**
 * ライブコメント
 *
 * GET ?streamId=xx [&since=ISO]
 *   配信のコメント一覧 (時系列、最新50件 or since以降)
 *
 * POST { streamId, customerId, body }
 *   コメント投稿 (会員のみ、100字以内)
 *
 * PATCH { commentId, isHidden, therapistId, authToken } or { commentId, isHidden, staffId }
 *   コメント非表示化 (配信者本人 or スタッフ)
 */

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const streamIdStr = url.searchParams.get("streamId");
    const since = url.searchParams.get("since");
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 200);

    if (!streamIdStr) {
      return NextResponse.json({ error: "streamId が必要です" }, { status: 400 });
    }
    const streamId = parseInt(streamIdStr);

    let query = supabase
      .from("live_stream_comments")
      .select("id, customer_id, display_name, body, created_at")
      .eq("stream_id", streamId)
      .eq("is_hidden", false)
      .order("created_at", { ascending: true })
      .limit(limit);

    if (since) {
      query = query.gt("created_at", since);
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    type Row = {
      id: number;
      customer_id: number | null;
      display_name: string;
      body: string;
      created_at: string;
    };

    return NextResponse.json({
      comments: ((data || []) as Row[]).map((r) => ({
        id: r.id,
        author: { id: r.customer_id, displayName: r.display_name },
        body: r.body,
        createdAt: r.created_at,
      })),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "不明なエラー";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { streamId, customerId, body } = await req.json();
    if (!streamId || !customerId || !body) {
      return NextResponse.json({ error: "必須パラメータが不足しています" }, { status: 400 });
    }
    const trimmed = String(body).trim();
    if (!trimmed) {
      return NextResponse.json({ error: "コメントを入力してください" }, { status: 400 });
    }
    if (trimmed.length > MAX_COMMENT_LEN) {
      return NextResponse.json({ error: `${MAX_COMMENT_LEN}文字以内にしてください` }, { status: 400 });
    }

    // 会員確認
    const { data: customer } = await supabase
      .from("customers")
      .select("id, name, self_name")
      .eq("id", customerId)
      .maybeSingle();
    if (!customer) {
      return NextResponse.json({ error: "会員が見つかりません" }, { status: 401 });
    }

    // ストリーム確認
    const { data: stream } = await supabase
      .from("live_streams")
      .select("status, comment_count_total")
      .eq("id", streamId)
      .maybeSingle();
    if (!stream || stream.status !== "live") {
      return NextResponse.json({ error: "配信中ではありません" }, { status: 410 });
    }

    // 表示名
    const displayName = customer.self_name || (customer.name ? `${customer.name.charAt(0)}***` : "ゲスト");

    const { data: inserted, error: insErr } = await supabase
      .from("live_stream_comments")
      .insert({
        stream_id: streamId,
        customer_id: customerId,
        display_name: displayName,
        body: trimmed,
      })
      .select("id, created_at")
      .single();

    if (insErr || !inserted) {
      return NextResponse.json({ error: insErr?.message || "投稿失敗" }, { status: 500 });
    }

    await supabase
      .from("live_streams")
      .update({ comment_count_total: stream.comment_count_total + 1 })
      .eq("id", streamId);

    return NextResponse.json({
      success: true,
      commentId: inserted.id,
      createdAt: inserted.created_at,
      author: { id: customerId, displayName },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "不明なエラー";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const { commentId, isHidden, therapistId, authToken, staffId } = await req.json();
    if (!commentId || typeof isHidden !== "boolean") {
      return NextResponse.json({ error: "commentId と isHidden が必要です" }, { status: 400 });
    }

    // 認証 (配信者本人 or スタッフ)
    let canModerate = false;
    if (staffId) {
      const { data: s } = await supabase
        .from("staff")
        .select("role, status")
        .eq("id", staffId)
        .maybeSingle();
      if (s && s.status === "active" && ["owner", "manager", "leader"].includes(s.role)) {
        canModerate = true;
      }
    } else if (therapistId && authToken) {
      // コメントが自分の配信のものか確認
      const { data: comment } = await supabase
        .from("live_stream_comments")
        .select("stream_id")
        .eq("id", commentId)
        .maybeSingle();
      if (comment) {
        const { data: stream } = await supabase
          .from("live_streams")
          .select("therapist_id")
          .eq("id", comment.stream_id)
          .maybeSingle();
        if (stream?.therapist_id === therapistId) {
          const { data: t } = await supabase
            .from("therapists")
            .select("login_password, status")
            .eq("id", therapistId)
            .maybeSingle();
          if (t && t.login_password === authToken && t.status === "active") {
            canModerate = true;
          }
        }
      }
    }

    if (!canModerate) {
      return NextResponse.json({ error: "権限がありません" }, { status: 403 });
    }

    await supabase
      .from("live_stream_comments")
      .update({ is_hidden: isHidden })
      .eq("id", commentId);

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "不明なエラー";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
