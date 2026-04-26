import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * ═══════════════════════════════════════════════════════════
 * 電話番号認証 + 未回答予約検索API
 *
 * POST /api/survey/find-by-phone
 *
 * リクエスト:
 *   { phone: string }   // ハイフン有無どちらでもOK
 *
 * 処理:
 *   1. 電話番号正規化（ハイフン・空白除去）
 *   2. customers テーブルから phone/phone2/phone3 で検索
 *   3. 該当顧客の completed 予約で未回答のものを取得（直近順）
 *   4. 一覧を返す（複数あれば顧客が選択）
 *
 * セキュリティ:
 *   - 顧客情報は最小限のみ返す（名前のイニシャル）
 *   - レート制限はミドルウェア任せ
 *
 * 設計: docs/14_REVIEW_SYSTEM.md
 * ═══════════════════════════════════════════════════════════
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://cbewozzdyjqmhzkxsjqo.supabase.co";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

function normalizePhone(phone: string): string {
  return phone.replace(/[-\s　()（）+]/g, "");
}

export async function POST(req: Request) {
  try {
    const { phone } = await req.json();

    if (!phone || typeof phone !== "string") {
      return NextResponse.json({ error: "電話番号を入力してください" }, { status: 400 });
    }

    const cleanPhone = normalizePhone(phone.trim());
    if (cleanPhone.length < 8) {
      return NextResponse.json(
        { error: "電話番号の形式が正しくありません" },
        { status: 400 }
      );
    }

    // ─────────────────────────────────────
    // 1. 顧客を電話番号で検索
    // ─────────────────────────────────────
    const { data: customers } = await supabase
      .from("customers")
      .select("id, name")
      .or(`phone.eq.${cleanPhone},phone2.eq.${cleanPhone},phone3.eq.${cleanPhone}`);

    if (!customers || customers.length === 0) {
      return NextResponse.json(
        {
          error: "この電話番号でのご予約が見つかりません。お電話番号をご確認ください。",
        },
        { status: 404 }
      );
    }

    const customer = customers[0]; // 同じ電話番号で複数顧客が登録されることは稀なので最初のレコードを使う

    // ─────────────────────────────────────
    // 2. 既回答の予約IDセットを取得
    // ─────────────────────────────────────
    const { data: answeredSurveys } = await supabase
      .from("customer_surveys")
      .select("reservation_id")
      .eq("customer_id", customer.id);

    const answeredIds = new Set(
      (answeredSurveys || []).map((s) => s.reservation_id).filter(Boolean)
    );

    // ─────────────────────────────────────
    // 3. completed 予約で未回答のものを取得（直近30日）
    // ─────────────────────────────────────
    const since = new Date();
    since.setDate(since.getDate() - 60); // 過去60日まで遡る
    const sinceStr = since.toISOString().split("T")[0];

    const { data: reservations } = await supabase
      .from("reservations")
      .select(`
        id,
        date,
        start_time,
        end_time,
        course,
        therapist_id,
        customer_status,
        customer_name
      `)
      .eq("customer_name", customer.name)
      .eq("customer_status", "completed")
      .gte("date", sinceStr)
      .order("date", { ascending: false })
      .order("start_time", { ascending: false })
      .limit(20);

    const pending = (reservations || []).filter((r) => !answeredIds.has(r.id));

    if (pending.length === 0) {
      return NextResponse.json(
        {
          error:
            "ご回答可能なご予約が見つかりません。施術完了から間もない場合は、しばらく経ってからお試しください。",
        },
        { status: 404 }
      );
    }

    // セラピスト情報を補完
    const therapistIds = Array.from(
      new Set(pending.map((r) => r.therapist_id).filter(Boolean))
    );
    let therapistMap: Record<number, string> = {};
    if (therapistIds.length > 0) {
      const { data: therapists } = await supabase
        .from("therapists")
        .select("id, name")
        .in("id", therapistIds);
      if (therapists) {
        therapistMap = Object.fromEntries(therapists.map((t) => [t.id, t.name]));
      }
    }

    return NextResponse.json({
      customerId: customer.id,
      // 名前は最後の1文字だけ伏せて返す（個人情報保護）
      customerNameMasked: maskName(customer.name),
      pending: pending.map((r) => ({
        reservationId: r.id,
        date: r.date,
        startTime: r.start_time,
        course: r.course,
        therapistId: r.therapist_id,
        therapistName: r.therapist_id ? therapistMap[r.therapist_id] || "" : "",
      })),
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "エラーが発生しました";
    console.error("[survey/find-by-phone] error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

function maskName(name: string): string {
  if (!name || name.length <= 1) return "**";
  if (name.length === 2) return name[0] + "*";
  return name[0] + "*".repeat(Math.min(name.length - 1, 3));
}
