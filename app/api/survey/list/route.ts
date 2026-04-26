import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * ═══════════════════════════════════════════════════════════
 * アンケート対象予約一覧 API
 *
 * GET /api/survey/list?customerId=N
 *
 * マイページから呼ぶ。指定顧客の以下を返す:
 *   - pending: 回答可能な予約（施術完了 + 未回答）
 *   - completed: 回答済みアンケート
 *   - coupons: 未使用のアンケートクーポン
 *
 * 設計: docs/14_REVIEW_SYSTEM.md
 * ═══════════════════════════════════════════════════════════
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://cbewozzdyjqmhzkxsjqo.supabase.co";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const customerIdStr = searchParams.get("customerId");

    if (!customerIdStr) {
      return NextResponse.json({ error: "customerId が必要です" }, { status: 400 });
    }

    const customerId = parseInt(customerIdStr, 10);
    if (isNaN(customerId)) {
      return NextResponse.json({ error: "customerId が不正です" }, { status: 400 });
    }

    // 顧客名取得（予約は customer_name で紐づくため）
    const { data: customer } = await supabase
      .from("customers")
      .select("name, survey_opt_out")
      .eq("id", customerId)
      .maybeSingle();

    if (!customer) {
      return NextResponse.json({ error: "顧客が見つかりません" }, { status: 404 });
    }

    // ─────────────────────────────────────
    // 1. 既回答アンケート
    // ─────────────────────────────────────
    const { data: completedSurveys } = await supabase
      .from("customer_surveys")
      .select(`
        id,
        reservation_id,
        therapist_id,
        rating_overall,
        submitted_at,
        coupon_issued,
        coupon_id,
        hp_publish_consent,
        hp_published
      `)
      .eq("customer_id", customerId)
      .order("submitted_at", { ascending: false })
      .limit(20);

    const answeredReservationIds = new Set(
      (completedSurveys || []).map((s) => s.reservation_id).filter(Boolean)
    );

    // ─────────────────────────────────────
    // 2. 回答可能な予約（施術完了 + 未回答）
    // ─────────────────────────────────────
    const { data: completedReservations } = await supabase
      .from("reservations")
      .select(`
        id,
        date,
        start_time,
        end_time,
        course,
        therapist_id,
        customer_status
      `)
      .eq("customer_name", customer.name)
      .in("customer_status", ["completed"])
      .order("date", { ascending: false })
      .order("start_time", { ascending: false })
      .limit(20);

    const pendingReservations = (completedReservations || []).filter(
      (r) => !answeredReservationIds.has(r.id)
    );

    // セラピスト名を補完
    const therapistIds = new Set<number>();
    pendingReservations.forEach((r) => r.therapist_id && therapistIds.add(r.therapist_id));
    (completedSurveys || []).forEach((s) => s.therapist_id && therapistIds.add(s.therapist_id));

    let therapistMap: Record<number, string> = {};
    if (therapistIds.size > 0) {
      const { data: therapists } = await supabase
        .from("therapists")
        .select("id, name")
        .in("id", Array.from(therapistIds));
      if (therapists) {
        therapistMap = Object.fromEntries(therapists.map((t) => [t.id, t.name]));
      }
    }

    // ─────────────────────────────────────
    // 3. アンケート紐付けクーポン取得（使用/未使用すべて）
    // ─────────────────────────────────────
    const surveyCouponIds = (completedSurveys || [])
      .map((s) => s.coupon_id)
      .filter((id): id is number => Boolean(id));

    let couponMap: Record<number, {
      code: string;
      discountAmount: number;
      issuedAt: string;
      expiresAt: string;
      usedAt: string | null;
      usedReservationId: number | null;
    }> = {};

    if (surveyCouponIds.length > 0) {
      const { data: surveyCoupons } = await supabase
        .from("survey_coupons")
        .select("id, code, discount_amount, issued_at, expires_at, used_at, used_reservation_id")
        .in("id", surveyCouponIds);

      if (surveyCoupons) {
        couponMap = Object.fromEntries(
          surveyCoupons.map((c) => [
            c.id,
            {
              code: c.code,
              discountAmount: c.discount_amount,
              issuedAt: c.issued_at,
              expiresAt: c.expires_at,
              usedAt: c.used_at,
              usedReservationId: c.used_reservation_id,
            },
          ])
        );
      }
    }

    // 未使用のクーポン一覧（ホーム表示用）
    const { data: coupons } = await supabase
      .from("survey_coupons")
      .select("id, code, discount_amount, issued_at, expires_at, used_at")
      .eq("customer_id", customerId)
      .is("used_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("issued_at", { ascending: false });

    return NextResponse.json({
      customerName: customer.name,
      surveyOptOut: customer.survey_opt_out || false,
      pending: pendingReservations.map((r) => ({
        reservationId: r.id,
        date: r.date,
        startTime: r.start_time,
        endTime: r.end_time,
        course: r.course,
        therapistId: r.therapist_id,
        therapistName: r.therapist_id ? therapistMap[r.therapist_id] || "" : "",
      })),
      completed: (completedSurveys || []).map((s) => {
        const cInfo = s.coupon_id ? couponMap[s.coupon_id] : null;
        return {
          surveyId: s.id,
          reservationId: s.reservation_id,
          therapistId: s.therapist_id,
          therapistName: s.therapist_id ? therapistMap[s.therapist_id] || "" : "",
          ratingOverall: s.rating_overall,
          submittedAt: s.submitted_at,
          couponIssued: s.coupon_issued,
          hpPublishConsent: s.hp_publish_consent,
          hpPublished: s.hp_published,
          // クーポン情報（使用状況を含む）
          couponCode: cInfo?.code || null,
          couponExpiresAt: cInfo?.expiresAt || null,
          couponUsedAt: cInfo?.usedAt || null,
          couponUsed: !!cInfo?.usedAt,
          couponDiscountAmount: cInfo?.discountAmount || 0,
        };
      }),
      coupons: (coupons || []).map((c) => ({
        id: c.id,
        code: c.code,
        discountAmount: c.discount_amount,
        issuedAt: c.issued_at,
        expiresAt: c.expires_at,
      })),
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "エラーが発生しました";
    console.error("[survey/list] error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
