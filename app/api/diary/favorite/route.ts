import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://cbewozzdyjqmhzkxsjqo.supabase.co";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * 日記用お気に入りセラピスト管理
 *
 * GET ?customerId=xx
 *   会員のお気に入り一覧 (セラピスト情報付き)
 *
 * POST { customerId, therapistId, notifyOnPost? }
 *   トグル (既存ならbool反転、無ければ追加)
 *
 * PATCH { customerId, therapistId, notifyOnPost }
 *   通知ON/OFFのみ切替
 *
 * DELETE { customerId, therapistId }
 *   削除
 */

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const customerIdStr = url.searchParams.get("customerId");
    if (!customerIdStr) {
      return NextResponse.json({ error: "customerId が必要です" }, { status: 400 });
    }
    const customerId = parseInt(customerIdStr);

    const { data: favs, error } = await supabase
      .from("customer_diary_favorites")
      .select("id, therapist_id, notify_on_post, created_at")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    type FavRow = { id: number; therapist_id: number; notify_on_post: boolean; created_at: string };
    const favRows = (favs || []) as FavRow[];

    // セラピスト情報付加
    const therapistIds = favRows.map((f) => f.therapist_id);
    type Therapist = {
      id: number;
      name: string;
      photo_url: string | null;
      status: string;
    };
    const therapistMap = new Map<number, Therapist>();
    if (therapistIds.length > 0) {
      const { data: therapists } = await supabase
        .from("therapists")
        .select("id, name, photo_url, status")
        .in("id", therapistIds);
      if (therapists) {
        for (const t of therapists as Therapist[]) therapistMap.set(t.id, t);
      }
    }

    const items = favRows.map((f) => {
      const t = therapistMap.get(f.therapist_id);
      return {
        id: f.id,
        therapist: t
          ? { id: t.id, name: t.name, photoUrl: t.photo_url, status: t.status }
          : { id: f.therapist_id, name: "(削除済み)", photoUrl: null, status: "unknown" },
        notifyOnPost: f.notify_on_post,
        createdAt: f.created_at,
      };
    });

    return NextResponse.json({
      items,
      total: items.length,
      therapistIds,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "不明なエラー";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { customerId, therapistId, notifyOnPost } = await req.json();
    if (!customerId || !therapistId) {
      return NextResponse.json({ error: "customerId と therapistId が必要です" }, { status: 400 });
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

    // 既存チェック
    const { data: existing } = await supabase
      .from("customer_diary_favorites")
      .select("id")
      .eq("customer_id", customerId)
      .eq("therapist_id", therapistId)
      .maybeSingle();

    if (existing) {
      // 解除
      await supabase.from("customer_diary_favorites").delete().eq("id", existing.id);
      return NextResponse.json({ success: true, favorited: false });
    } else {
      const { error } = await supabase
        .from("customer_diary_favorites")
        .insert({
          customer_id: customerId,
          therapist_id: therapistId,
          notify_on_post: notifyOnPost !== false,
        });
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true, favorited: true });
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "不明なエラー";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const { customerId, therapistId, notifyOnPost } = await req.json();
    if (!customerId || !therapistId || typeof notifyOnPost !== "boolean") {
      return NextResponse.json({ error: "パラメータ不足" }, { status: 400 });
    }
    const { error } = await supabase
      .from("customer_diary_favorites")
      .update({ notify_on_post: notifyOnPost })
      .eq("customer_id", customerId)
      .eq("therapist_id", therapistId);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "不明なエラー";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { customerId, therapistId } = await req.json();
    if (!customerId || !therapistId) {
      return NextResponse.json({ error: "customerId と therapistId が必要です" }, { status: 400 });
    }
    await supabase
      .from("customer_diary_favorites")
      .delete()
      .eq("customer_id", customerId)
      .eq("therapist_id", therapistId);
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "不明なエラー";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
