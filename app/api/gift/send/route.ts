import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { findGift } from "../../../../lib/gift-catalog";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://cbewozzdyjqmhzkxsjqo.supabase.co";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

const MAX_MESSAGE_LEN = 30;

/**
 * 投げ銭送信
 *
 * Body: {
 *   customerId: number,
 *   sourceType: 'live' | 'diary' | 'story',
 *   sourceId: number,
 *   giftKind: GiftKind,
 *   message?: string (30字以内)
 * }
 *
 * 処理:
 *   1. 顧客 + ソース確認
 *   2. ギフトのポイント数を確認
 *   3. 顧客のポイント残高を集計 (customer_points の sum)
 *      - 残高不足ならエラー
 *   4. customer_points に -ポイント のレコード追加
 *   5. gift_transactions に記録
 *   6. therapist_gift_points を upsert (累計加算)
 *   7. ソース別の集計カラムを更新
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { customerId, sourceType, sourceId, giftKind, message } = body;

    // バリデーション
    if (!customerId || !sourceType || !sourceId || !giftKind) {
      return NextResponse.json({ error: "必須パラメータが不足しています" }, { status: 400 });
    }
    if (!["live", "diary", "story"].includes(sourceType)) {
      return NextResponse.json({ error: "sourceType が不正です" }, { status: 400 });
    }
    const gift = findGift(giftKind);
    if (!gift) {
      return NextResponse.json({ error: "不正なギフトです" }, { status: 400 });
    }
    let cleanMsg: string | null = null;
    if (message) {
      const t = String(message).trim();
      if (t.length > MAX_MESSAGE_LEN) {
        return NextResponse.json({ error: `メッセージは${MAX_MESSAGE_LEN}字以内にしてください` }, { status: 400 });
      }
      cleanMsg = t || null;
    }

    // 1. 顧客確認
    const { data: customer } = await supabase
      .from("customers")
      .select("id, name, self_name")
      .eq("id", customerId)
      .maybeSingle();
    if (!customer) {
      return NextResponse.json({ error: "会員が見つかりません" }, { status: 401 });
    }

    // 2. ソース確認 + therapist_id を取得
    let therapistId: number | null = null;
    if (sourceType === "live") {
      const { data: s } = await supabase
        .from("live_streams")
        .select("therapist_id, status")
        .eq("id", sourceId)
        .maybeSingle();
      if (!s) return NextResponse.json({ error: "配信が見つかりません" }, { status: 404 });
      if (s.status !== "live") {
        return NextResponse.json({ error: "配信が終了しています" }, { status: 410 });
      }
      therapistId = s.therapist_id;
    } else if (sourceType === "diary") {
      const { data: e } = await supabase
        .from("therapist_diary_entries")
        .select("therapist_id, deleted_at")
        .eq("id", sourceId)
        .maybeSingle();
      if (!e || e.deleted_at) {
        return NextResponse.json({ error: "日記が見つかりません" }, { status: 404 });
      }
      therapistId = e.therapist_id;
    } else if (sourceType === "story") {
      const { data: s } = await supabase
        .from("therapist_diary_stories")
        .select("therapist_id, deleted_at, expires_at")
        .eq("id", sourceId)
        .maybeSingle();
      if (!s || s.deleted_at) {
        return NextResponse.json({ error: "ストーリーが見つかりません" }, { status: 404 });
      }
      if (s.expires_at && new Date(s.expires_at) < new Date()) {
        return NextResponse.json({ error: "ストーリーは期限切れです" }, { status: 410 });
      }
      therapistId = s.therapist_id;
    }
    if (!therapistId) {
      return NextResponse.json({ error: "受領者情報が取得できません" }, { status: 500 });
    }

    // 3. 顧客のポイント残高を計算 (期限切れを除く)
    const { data: ptRows } = await supabase
      .from("customer_points")
      .select("amount, expires_at")
      .eq("customer_id", customerId);

    type PtRow = { amount: number; expires_at: string | null };
    const now = new Date();
    let balance = 0;
    for (const p of (ptRows || []) as PtRow[]) {
      // 期限切れ過去ポイント (amount > 0 で expires_at < now) は無効
      if (p.amount > 0 && p.expires_at && new Date(p.expires_at) < now) continue;
      balance += p.amount;
    }

    if (balance < gift.pointAmount) {
      return NextResponse.json({
        error: `ポイントが足りません (必要: ${gift.pointAmount}pt / 残高: ${balance}pt)`,
        currentBalance: balance,
        required: gift.pointAmount,
      }, { status: 402 });
    }

    // 4. customer_points に消費レコード追加
    const sourceLabel = sourceType === "live" ? "ライブ配信" : sourceType === "diary" ? "日記" : "ストーリー";
    const { data: pt, error: ptErr } = await supabase
      .from("customer_points")
      .insert({
        customer_id: customerId,
        amount: -gift.pointAmount,
        type: "use",
        description: `🎁 投げ銭: ${gift.emoji}${gift.label} (${sourceLabel})`,
        status: "confirmed",
      })
      .select("id")
      .single();
    if (ptErr || !pt) {
      console.error("customer_points insert error:", ptErr);
      return NextResponse.json({ error: "ポイント消費の記録に失敗しました" }, { status: 500 });
    }

    // 5. gift_transactions 記録
    const { data: tx, error: txErr } = await supabase
      .from("gift_transactions")
      .insert({
        customer_id: customerId,
        therapist_id: therapistId,
        source_type: sourceType,
        source_id: sourceId,
        gift_kind: gift.kind,
        gift_label: gift.label,
        gift_emoji: gift.emoji,
        point_amount: gift.pointAmount,
        message: cleanMsg,
        customer_point_id: pt.id,
      })
      .select("id, created_at")
      .single();

    if (txErr || !tx) {
      // ポイント消費を取り消し
      await supabase.from("customer_points").delete().eq("id", pt.id);
      return NextResponse.json({ error: "投げ銭の記録に失敗しました" }, { status: 500 });
    }

    // 6. therapist_gift_points を upsert (累計+期間別加算)
    const nowDate = new Date();
    const curYear = nowDate.getFullYear();
    const curMonth = nowDate.getMonth() + 1;

    const { data: existing } = await supabase
      .from("therapist_gift_points")
      .select("*")
      .eq("therapist_id", therapistId)
      .maybeSingle();

    if (existing) {
      type Existing = {
        total_received_points: number;
        total_received_count: number;
        current_balance_points: number;
        this_month_received: number;
        this_month_year: number | null;
        this_month_month: number | null;
        this_year_received: number;
        this_year_year: number | null;
      };
      const e = existing as Existing;
      // 月またぎ判定
      const monthMatches = e.this_month_year === curYear && e.this_month_month === curMonth;
      const yearMatches = e.this_year_year === curYear;

      await supabase
        .from("therapist_gift_points")
        .update({
          total_received_points: e.total_received_points + gift.pointAmount,
          total_received_count: e.total_received_count + 1,
          current_balance_points: e.current_balance_points + gift.pointAmount,
          this_month_received: monthMatches ? e.this_month_received + gift.pointAmount : gift.pointAmount,
          this_month_year: curYear,
          this_month_month: curMonth,
          this_year_received: yearMatches ? e.this_year_received + gift.pointAmount : gift.pointAmount,
          this_year_year: curYear,
          last_received_at: nowDate.toISOString(),
        })
        .eq("therapist_id", therapistId);
    } else {
      await supabase.from("therapist_gift_points").insert({
        therapist_id: therapistId,
        total_received_points: gift.pointAmount,
        total_received_count: 1,
        current_balance_points: gift.pointAmount,
        this_month_received: gift.pointAmount,
        this_month_year: curYear,
        this_month_month: curMonth,
        this_year_received: gift.pointAmount,
        this_year_year: curYear,
        last_received_at: nowDate.toISOString(),
        first_received_at: nowDate.toISOString(),
      });
    }

    // 7. ソース別集計カラム更新 (++)
    if (sourceType === "live") {
      const { data: s } = await supabase
        .from("live_streams")
        .select("gift_count_total, gift_points_total")
        .eq("id", sourceId)
        .maybeSingle();
      if (s) {
        await supabase
          .from("live_streams")
          .update({
            gift_count_total: (s.gift_count_total || 0) + 1,
            gift_points_total: (s.gift_points_total || 0) + gift.pointAmount,
          })
          .eq("id", sourceId);
      }
    } else if (sourceType === "diary") {
      const { data: s } = await supabase
        .from("therapist_diary_entries")
        .select("gift_count, gift_points")
        .eq("id", sourceId)
        .maybeSingle();
      if (s) {
        await supabase
          .from("therapist_diary_entries")
          .update({
            gift_count: (s.gift_count || 0) + 1,
            gift_points: (s.gift_points || 0) + gift.pointAmount,
          })
          .eq("id", sourceId);
      }
    } else if (sourceType === "story") {
      const { data: s } = await supabase
        .from("therapist_diary_stories")
        .select("gift_count, gift_points")
        .eq("id", sourceId)
        .maybeSingle();
      if (s) {
        await supabase
          .from("therapist_diary_stories")
          .update({
            gift_count: (s.gift_count || 0) + 1,
            gift_points: (s.gift_points || 0) + gift.pointAmount,
          })
          .eq("id", sourceId);
      }
    }

    return NextResponse.json({
      success: true,
      transactionId: tx.id,
      gift: {
        kind: gift.kind,
        label: gift.label,
        emoji: gift.emoji,
        pointAmount: gift.pointAmount,
      },
      newBalance: balance - gift.pointAmount,
      message: cleanMsg,
      createdAt: tx.created_at,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "不明なエラー";
    console.error("/api/gift/send error:", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
