import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://cbewozzdyjqmhzkxsjqo.supabase.co";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * 投げ銭履歴 + 残高取得
 *
 * GET ?therapistId=xx&authToken=xx              (セラピスト本人: 受領一覧+残高)
 * GET ?customerId=xx                              (お客様: 自分が送ったもの一覧)
 * GET ?sourceType=live&sourceId=xx [&since=ISO]  (ライブ/日記/ストーリーへの投げ銭一覧、リアルタイム表示用)
 * GET ?staff=1 [&limit=100]                      (管理画面用、全件)
 */

type GiftRow = {
  id: number;
  customer_id: number;
  therapist_id: number;
  source_type: string;
  source_id: number | null;
  gift_kind: string;
  gift_label: string | null;
  gift_emoji: string | null;
  point_amount: number;
  message: string | null;
  is_visible: boolean;
  created_at: string;
};

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const therapistIdStr = url.searchParams.get("therapistId");
    const authToken = url.searchParams.get("authToken");
    const customerIdStr = url.searchParams.get("customerId");
    const sourceType = url.searchParams.get("sourceType");
    const sourceIdStr = url.searchParams.get("sourceId");
    const since = url.searchParams.get("since");
    const isStaff = url.searchParams.get("staff") === "1";
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 200);

    let query = supabase
      .from("gift_transactions")
      .select("*")
      .eq("is_visible", true)
      .order("created_at", { ascending: false })
      .limit(limit);

    // セラピスト本人モード: 認証要 + 残高情報も返す
    if (therapistIdStr && authToken) {
      const therapistId = parseInt(therapistIdStr);
      const { data: t } = await supabase
        .from("therapists")
        .select("login_password, status")
        .eq("id", therapistId)
        .maybeSingle();
      if (!t || t.login_password !== authToken || t.status !== "active") {
        return NextResponse.json({ error: "認証エラー" }, { status: 401 });
      }
      query = query.eq("therapist_id", therapistId);

      const { data: gifts, error } = await query;
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      // 残高取得
      const { data: balanceRow } = await supabase
        .from("therapist_gift_points")
        .select("*")
        .eq("therapist_id", therapistId)
        .maybeSingle();

      // 顧客情報まとめて取得
      const customerIds = Array.from(new Set(((gifts || []) as GiftRow[]).map((g) => g.customer_id)));
      type CustomerLite = { id: number; name: string; self_name: string | null };
      const customerMap = new Map<number, CustomerLite>();
      if (customerIds.length > 0) {
        const { data: cs } = await supabase
          .from("customers")
          .select("id, name, self_name")
          .in("id", customerIds);
        if (cs) {
          for (const c of cs as CustomerLite[]) customerMap.set(c.id, c);
        }
      }

      return NextResponse.json({
        gifts: ((gifts || []) as GiftRow[]).map((g) => {
          const c = customerMap.get(g.customer_id);
          return {
            id: g.id,
            sender: {
              id: g.customer_id,
              displayName: c?.self_name || (c?.name ? `${c.name.charAt(0)}***` : "ゲスト"),
            },
            sourceType: g.source_type,
            sourceId: g.source_id,
            gift: {
              kind: g.gift_kind,
              label: g.gift_label,
              emoji: g.gift_emoji,
              pointAmount: g.point_amount,
            },
            message: g.message,
            createdAt: g.created_at,
          };
        }),
        balance: balanceRow
          ? {
              totalReceived: balanceRow.total_received_points,
              totalCount: balanceRow.total_received_count,
              currentBalance: balanceRow.current_balance_points,
              thisMonth: balanceRow.this_month_received,
              thisYear: balanceRow.this_year_received,
              lastReceivedAt: balanceRow.last_received_at,
              firstReceivedAt: balanceRow.first_received_at,
            }
          : null,
      });
    }

    // 顧客モード: 自分が送ったもの一覧
    if (customerIdStr) {
      query = query.eq("customer_id", parseInt(customerIdStr));
      const { data: gifts, error } = await query;
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      // セラピスト名まとめて取得
      const therapistIds = Array.from(new Set(((gifts || []) as GiftRow[]).map((g) => g.therapist_id)));
      type TherapistLite = { id: number; name: string };
      const therapistMap = new Map<number, TherapistLite>();
      if (therapistIds.length > 0) {
        const { data: ts } = await supabase
          .from("therapists")
          .select("id, name")
          .in("id", therapistIds);
        if (ts) {
          for (const t of ts as TherapistLite[]) therapistMap.set(t.id, t);
        }
      }

      return NextResponse.json({
        gifts: ((gifts || []) as GiftRow[]).map((g) => {
          const t = therapistMap.get(g.therapist_id);
          return {
            id: g.id,
            recipient: { id: g.therapist_id, name: t?.name || "(削除済み)" },
            sourceType: g.source_type,
            sourceId: g.source_id,
            gift: {
              kind: g.gift_kind,
              label: g.gift_label,
              emoji: g.gift_emoji,
              pointAmount: g.point_amount,
            },
            message: g.message,
            createdAt: g.created_at,
          };
        }),
      });
    }

    // ソース別: ライブ/日記/ストーリーへの投げ銭一覧 (リアルタイム表示用)
    if (sourceType && sourceIdStr) {
      query = query
        .eq("source_type", sourceType)
        .eq("source_id", parseInt(sourceIdStr));
      if (since) {
        query = query.gt("created_at", since);
      }
      // 古い順 (ストリームに流す感じ) で返す
      query = supabase
        .from("gift_transactions")
        .select("*")
        .eq("is_visible", true)
        .eq("source_type", sourceType)
        .eq("source_id", parseInt(sourceIdStr))
        .order("created_at", { ascending: true })
        .limit(limit);
      if (since) {
        query = query.gt("created_at", since);
      }

      const { data: gifts, error } = await query;
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      const customerIds = Array.from(new Set(((gifts || []) as GiftRow[]).map((g) => g.customer_id)));
      type CustomerLite = { id: number; name: string; self_name: string | null };
      const customerMap = new Map<number, CustomerLite>();
      if (customerIds.length > 0) {
        const { data: cs } = await supabase
          .from("customers")
          .select("id, name, self_name")
          .in("id", customerIds);
        if (cs) {
          for (const c of cs as CustomerLite[]) customerMap.set(c.id, c);
        }
      }

      return NextResponse.json({
        gifts: ((gifts || []) as GiftRow[]).map((g) => {
          const c = customerMap.get(g.customer_id);
          return {
            id: g.id,
            sender: {
              id: g.customer_id,
              displayName: c?.self_name || (c?.name ? `${c.name.charAt(0)}***` : "ゲスト"),
            },
            gift: {
              kind: g.gift_kind,
              label: g.gift_label,
              emoji: g.gift_emoji,
              pointAmount: g.point_amount,
            },
            message: g.message,
            createdAt: g.created_at,
          };
        }),
      });
    }

    // 管理画面: 全件
    if (isStaff) {
      const { data: gifts, error } = await query;
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      const customerIds = Array.from(new Set(((gifts || []) as GiftRow[]).map((g) => g.customer_id)));
      const therapistIds = Array.from(new Set(((gifts || []) as GiftRow[]).map((g) => g.therapist_id)));
      type CustomerLite = { id: number; name: string; self_name: string | null };
      type TherapistLite = { id: number; name: string };
      const customerMap = new Map<number, CustomerLite>();
      const therapistMap = new Map<number, TherapistLite>();
      if (customerIds.length > 0) {
        const { data: cs } = await supabase
          .from("customers")
          .select("id, name, self_name")
          .in("id", customerIds);
        if (cs) for (const c of cs as CustomerLite[]) customerMap.set(c.id, c);
      }
      if (therapistIds.length > 0) {
        const { data: ts } = await supabase
          .from("therapists")
          .select("id, name")
          .in("id", therapistIds);
        if (ts) for (const t of ts as TherapistLite[]) therapistMap.set(t.id, t);
      }

      return NextResponse.json({
        gifts: ((gifts || []) as GiftRow[]).map((g) => {
          const c = customerMap.get(g.customer_id);
          const t = therapistMap.get(g.therapist_id);
          return {
            id: g.id,
            sender: { id: g.customer_id, name: c?.name || "(削除)", displayName: c?.self_name || c?.name || "(削除)" },
            recipient: { id: g.therapist_id, name: t?.name || "(削除)" },
            sourceType: g.source_type,
            sourceId: g.source_id,
            gift: {
              kind: g.gift_kind,
              label: g.gift_label,
              emoji: g.gift_emoji,
              pointAmount: g.point_amount,
            },
            message: g.message,
            createdAt: g.created_at,
          };
        }),
      });
    }

    return NextResponse.json({ error: "クエリパラメータが不足しています" }, { status: 400 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "不明なエラー";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
