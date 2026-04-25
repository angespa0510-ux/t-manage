import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://cbewozzdyjqmhzkxsjqo.supabase.co";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * セラピスト本人用: 自分の記事へのコメント一覧 (未返信優先)
 *
 * GET ?therapistId=&authToken=
 *   返信するコメントを集めるため、未返信を優先表示
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const therapistId = url.searchParams.get("therapistId");
    const authToken = url.searchParams.get("authToken");
    const filter = url.searchParams.get("filter") || "unreplied"; // unreplied | replied | all

    if (!therapistId || !authToken) {
      return NextResponse.json({ error: "認証情報が必要です" }, { status: 401 });
    }

    const { data: t } = await supabase
      .from("therapists")
      .select("id, login_password, status")
      .eq("id", parseInt(therapistId))
      .maybeSingle();
    if (!t || t.login_password !== authToken || t.status !== "active") {
      return NextResponse.json({ error: "認証エラー" }, { status: 401 });
    }

    // 自分の記事一覧取得 (削除されていないもの)
    const { data: entries } = await supabase
      .from("therapist_diary_entries")
      .select("id, title")
      .eq("therapist_id", parseInt(therapistId))
      .is("deleted_at", null);

    type EntryLite = { id: number; title: string };
    const entryMap = new Map<number, EntryLite>();
    for (const e of (entries || []) as EntryLite[]) entryMap.set(e.id, e);

    if (entryMap.size === 0) {
      return NextResponse.json({
        comments: [],
        stats: { unrepliedCount: 0, totalComments: 0 },
      });
    }

    let query = supabase
      .from("therapist_diary_comments")
      .select("*")
      .in("entry_id", Array.from(entryMap.keys()))
      .is("deleted_at", null)
      .eq("is_hidden", false);

    if (filter === "unreplied") {
      query = query.eq("is_replied", false);
    } else if (filter === "replied") {
      query = query.eq("is_replied", true);
    }

    query = query.order("created_at", { ascending: false }).limit(100);

    const { data: comments, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    type CommentRow = {
      id: number;
      entry_id: number;
      customer_id: number;
      body: string;
      is_replied: boolean;
      reply_body: string | null;
      reply_at: string | null;
      created_at: string;
    };

    const rows = (comments || []) as CommentRow[];

    type Customer = { id: number; name: string; self_name: string | null };
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

    const result = rows.map((r) => {
      const cust = customerMap.get(r.customer_id);
      const entry = entryMap.get(r.entry_id);
      const displayName = cust?.self_name ||
        (cust?.name ? `${cust.name.charAt(0)}***` : "ゲストさん");
      return {
        id: r.id,
        entryId: r.entry_id,
        entryTitle: entry?.title || "(削除済み)",
        body: r.body,
        author: { id: r.customer_id, displayName },
        isReplied: r.is_replied,
        replyBody: r.reply_body,
        replyAt: r.reply_at,
        createdAt: r.created_at,
      };
    });

    // 統計
    const { count: unrepliedCount } = await supabase
      .from("therapist_diary_comments")
      .select("id", { count: "exact", head: true })
      .in("entry_id", Array.from(entryMap.keys()))
      .is("deleted_at", null)
      .eq("is_hidden", false)
      .eq("is_replied", false);

    const { count: totalCount } = await supabase
      .from("therapist_diary_comments")
      .select("id", { count: "exact", head: true })
      .in("entry_id", Array.from(entryMap.keys()))
      .is("deleted_at", null)
      .eq("is_hidden", false);

    return NextResponse.json({
      comments: result,
      stats: {
        unrepliedCount: unrepliedCount || 0,
        totalComments: totalCount || 0,
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "不明なエラー";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
