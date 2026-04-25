import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://cbewozzdyjqmhzkxsjqo.supabase.co";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

const MAX_COMMENT = 500;
const MAX_REPLY = 500;

/**
 * GET ?entryId=xx [&limit=20]
 *   コメント一覧取得 (公開向け)
 *
 * POST { entryId, customerId, body }
 *   コメント投稿 (会員のみ)
 *
 * PATCH { commentId, replyBody, therapistId, authToken }
 *   セラピスト返信 (本人のみ)
 *   または PATCH { commentId, isHidden, staffId } で非表示化
 *
 * DELETE { commentId, customerId? authToken? therapistId? staffId? }
 *   コメント削除 (本人 or スタッフ)
 */

type CommentRow = {
  id: number;
  entry_id: number;
  customer_id: number;
  body: string;
  is_hidden: boolean;
  is_replied: boolean;
  reply_body: string | null;
  reply_at: string | null;
  created_at: string;
};

type Customer = { id: number; name: string; self_name: string | null };

// ════════════════════════════════════════════════════════
// GET: 一覧
// ════════════════════════════════════════════════════════
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const entryIdStr = url.searchParams.get("entryId");
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "30"), 100);
    const includeHidden = url.searchParams.get("includeHidden") === "1";

    if (!entryIdStr) {
      return NextResponse.json({ error: "entryId が必要です" }, { status: 400 });
    }
    const entryId = parseInt(entryIdStr);

    let query = supabase
      .from("therapist_diary_comments")
      .select("*")
      .eq("entry_id", entryId)
      .is("deleted_at", null);

    if (!includeHidden) {
      query = query.eq("is_hidden", false);
    }

    query = query.order("created_at", { ascending: true }).limit(limit);

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rows = (data || []) as CommentRow[];

    // 投稿者情報まとめて取得
    const customerIds = Array.from(new Set(rows.map((r) => r.customer_id)));
    const customerMap = new Map<number, Customer>();
    if (customerIds.length > 0) {
      const { data: customers } = await supabase
        .from("customers")
        .select("id, name, self_name")
        .in("id", customerIds);
      if (customers) {
        for (const c of customers as Customer[]) customerMap.set(c.id, c);
      }
    }

    const comments = rows.map((r) => {
      const cust = customerMap.get(r.customer_id);
      // 表示名は self_name (セルフネーム) > name の頭文字+さん
      const displayName = cust?.self_name ||
        (cust?.name ? `${cust.name.charAt(0)}***` : "ゲストさん");
      return {
        id: r.id,
        body: r.body,
        author: { id: r.customer_id, displayName },
        isHidden: r.is_hidden,
        isReplied: r.is_replied,
        replyBody: r.reply_body,
        replyAt: r.reply_at,
        createdAt: r.created_at,
      };
    });

    return NextResponse.json({ comments, total: comments.length });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "不明なエラー";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ════════════════════════════════════════════════════════
// POST: 投稿
// ════════════════════════════════════════════════════════
export async function POST(req: Request) {
  try {
    const { entryId, customerId, body } = await req.json();

    if (!entryId || !customerId || !body) {
      return NextResponse.json({ error: "entryId, customerId, body が必要です" }, { status: 400 });
    }
    const trimmed = String(body).trim();
    if (!trimmed) {
      return NextResponse.json({ error: "コメントを入力してください" }, { status: 400 });
    }
    if (trimmed.length > MAX_COMMENT) {
      return NextResponse.json({ error: `${MAX_COMMENT}文字以内にしてください` }, { status: 400 });
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
      .select("id, comment_count, deleted_at")
      .eq("id", entryId)
      .maybeSingle();
    if (!entry || entry.deleted_at) {
      return NextResponse.json({ error: "記事が見つかりません" }, { status: 404 });
    }

    const { data: inserted, error: insErr } = await supabase
      .from("therapist_diary_comments")
      .insert({
        entry_id: entryId,
        customer_id: customerId,
        body: trimmed,
      })
      .select("id, created_at")
      .single();

    if (insErr || !inserted) {
      return NextResponse.json({ error: insErr?.message || "投稿失敗" }, { status: 500 });
    }

    // comment_count++
    await supabase
      .from("therapist_diary_entries")
      .update({ comment_count: entry.comment_count + 1 })
      .eq("id", entryId);

    return NextResponse.json({
      success: true,
      commentId: inserted.id,
      createdAt: inserted.created_at,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "不明なエラー";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ════════════════════════════════════════════════════════
// PATCH: セラピスト返信 / スタッフ非表示化
// ════════════════════════════════════════════════════════
export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { commentId, replyBody, therapistId, authToken, isHidden, staffId } = body;

    if (!commentId) {
      return NextResponse.json({ error: "commentId が必要です" }, { status: 400 });
    }

    // コメント取得
    const { data: comment } = await supabase
      .from("therapist_diary_comments")
      .select("id, entry_id, deleted_at")
      .eq("id", commentId)
      .maybeSingle();
    if (!comment || comment.deleted_at) {
      return NextResponse.json({ error: "コメントが見つかりません" }, { status: 404 });
    }

    // entry経由でtherapistIdを得る
    const { data: entry } = await supabase
      .from("therapist_diary_entries")
      .select("therapist_id")
      .eq("id", comment.entry_id)
      .maybeSingle();
    if (!entry) {
      return NextResponse.json({ error: "記事が見つかりません" }, { status: 404 });
    }

    // ── セラピスト返信 ──────────────────────────
    if (replyBody !== undefined) {
      if (!therapistId || !authToken) {
        return NextResponse.json({ error: "セラピスト認証が必要です" }, { status: 401 });
      }
      if (entry.therapist_id !== therapistId) {
        return NextResponse.json({ error: "他のセラピストの記事には返信できません" }, { status: 403 });
      }
      const { data: t } = await supabase
        .from("therapists")
        .select("login_password, status")
        .eq("id", therapistId)
        .maybeSingle();
      if (!t || t.login_password !== authToken || t.status !== "active") {
        return NextResponse.json({ error: "認証エラー" }, { status: 401 });
      }

      const trimmed = String(replyBody).trim();
      if (trimmed.length > MAX_REPLY) {
        return NextResponse.json({ error: `返信は${MAX_REPLY}文字以内です` }, { status: 400 });
      }

      const { error: updErr } = await supabase
        .from("therapist_diary_comments")
        .update({
          reply_body: trimmed || null,
          is_replied: !!trimmed,
          reply_at: trimmed ? new Date().toISOString() : null,
        })
        .eq("id", commentId);

      if (updErr) {
        return NextResponse.json({ error: updErr.message }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    // ── スタッフ非表示化 ──────────────────────────
    if (typeof isHidden === "boolean") {
      if (!staffId) {
        return NextResponse.json({ error: "staffId が必要です" }, { status: 401 });
      }
      const { data: staff } = await supabase
        .from("staff")
        .select("role, status")
        .eq("id", staffId)
        .maybeSingle();
      if (!staff || staff.status !== "active" || !["owner", "manager", "leader"].includes(staff.role)) {
        return NextResponse.json({ error: "権限がありません" }, { status: 403 });
      }

      await supabase
        .from("therapist_diary_comments")
        .update({ is_hidden: isHidden })
        .eq("id", commentId);

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "操作内容が不正です" }, { status: 400 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "不明なエラー";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ════════════════════════════════════════════════════════
// DELETE: 削除
// ════════════════════════════════════════════════════════
export async function DELETE(req: Request) {
  try {
    const body = await req.json();
    const { commentId, customerId, staffId } = body;

    if (!commentId) {
      return NextResponse.json({ error: "commentId が必要です" }, { status: 400 });
    }

    const { data: comment } = await supabase
      .from("therapist_diary_comments")
      .select("id, customer_id, entry_id, deleted_at")
      .eq("id", commentId)
      .maybeSingle();
    if (!comment) {
      return NextResponse.json({ error: "コメントが見つかりません" }, { status: 404 });
    }
    if (comment.deleted_at) {
      return NextResponse.json({ success: true, alreadyDeleted: true });
    }

    let canDelete = false;

    if (staffId) {
      const { data: staff } = await supabase
        .from("staff")
        .select("role, status")
        .eq("id", staffId)
        .maybeSingle();
      if (staff && staff.status === "active" && ["owner", "manager", "leader"].includes(staff.role)) {
        canDelete = true;
      }
    } else if (customerId && comment.customer_id === customerId) {
      const { data: c } = await supabase
        .from("customers")
        .select("id")
        .eq("id", customerId)
        .maybeSingle();
      if (c) canDelete = true;
    }

    if (!canDelete) {
      return NextResponse.json({ error: "権限がありません" }, { status: 403 });
    }

    await supabase
      .from("therapist_diary_comments")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", commentId);

    // entry の comment_count を再カウント (確実性重視)
    const { count } = await supabase
      .from("therapist_diary_comments")
      .select("id", { count: "exact", head: true })
      .eq("entry_id", comment.entry_id)
      .is("deleted_at", null)
      .eq("is_hidden", false);

    await supabase
      .from("therapist_diary_entries")
      .update({ comment_count: count || 0 })
      .eq("id", comment.entry_id);

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "不明なエラー";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
