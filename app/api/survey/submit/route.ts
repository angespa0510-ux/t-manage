import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { generateSurveyCouponCode, type SurveySubmitRequest, type SurveySubmitResponse } from "@/lib/survey-types";

/**
 * ═══════════════════════════════════════════════════════════
 * アンケート回答送信 API
 *
 * POST /api/survey/submit
 *
 * 処理フロー:
 *   1. リクエスト検証（reservationId必須、評価項目必須）
 *   2. 重複チェック（1予約1アンケート）
 *   3. customer_surveys にINSERT
 *   4. survey_coupons でクーポン発行（衝突回避リトライ最大10回）
 *   5. customer_surveys.coupon_id を更新
 *   6. customers.survey_response_count をインクリメント
 *   7. therapists の集計 (avg_rating, survey_count, nps_score) を再計算
 *   8. 店舗の Google Review URL を返却（次の画面で使用）
 *
 * 返却:
 *   - surveyId
 *   - couponCode (SV-XXXXXX)
 *   - couponExpiresAt
 *   - pointsGranted (HP掲載同意したらポイント、ただしHP承認後付与なので常に0)
 *   - googleReviewUrl (店舗設定があれば)
 *
 * 設計: docs/14_REVIEW_SYSTEM.md
 * ═══════════════════════════════════════════════════════════
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://cbewozzdyjqmhzkxsjqo.supabase.co";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

const MAX_COUPON_RETRY = 10;

export async function POST(req: Request) {
  try {
    const body: SurveySubmitRequest = await req.json();

    // ─────────────────────────────────────
    // 1. バリデーション
    // ─────────────────────────────────────
    if (!body.reservationId || !body.therapistId) {
      return NextResponse.json(
        { error: "予約とセラピストの情報が必要です" },
        { status: 400 }
      );
    }

    if (!body.ratingOverall || body.ratingOverall < 1 || body.ratingOverall > 5) {
      return NextResponse.json(
        { error: "総合満足度を選択してください（1〜5）" },
        { status: 400 }
      );
    }

    // ─────────────────────────────────────
    // 2. 重複チェック (1予約1アンケート)
    // ─────────────────────────────────────
    const { data: existing } = await supabase
      .from("customer_surveys")
      .select("id")
      .eq("reservation_id", body.reservationId)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: "このご予約のアンケートはすでにご回答済みです" },
        { status: 409 }
      );
    }

    // ─────────────────────────────────────
    // 3. 顧客IDの解決
    // ─────────────────────────────────────
    let customerId = body.customerId || null;

    // トークン認証（非登録者）の場合は token から customer_id を解決
    if (!customerId && body.token) {
      const { data: tokenSurvey } = await supabase
        .from("customer_surveys")
        .select("customer_id")
        .eq("access_token", body.token)
        .maybeSingle();
      customerId = tokenSurvey?.customer_id || null;
    }

    // 予約から customer を逆引き
    if (!customerId) {
      const { data: reservation } = await supabase
        .from("reservations")
        .select("customer_name")
        .eq("id", body.reservationId)
        .maybeSingle();

      if (reservation?.customer_name) {
        const { data: cust } = await supabase
          .from("customers")
          .select("id")
          .eq("name", reservation.customer_name)
          .maybeSingle();
        customerId = cust?.id || null;
      }
    }

    // ─────────────────────────────────────
    // 4. アンケートをINSERT
    // ─────────────────────────────────────
    const { data: survey, error: surveyErr } = await supabase
      .from("customer_surveys")
      .insert({
        customer_id: customerId,
        reservation_id: body.reservationId,
        therapist_id: body.therapistId,
        rating_overall: body.ratingOverall,
        rating_therapist: body.ratingTherapist || null,
        rating_service: body.ratingService || null,
        rating_atmosphere: body.ratingAtmosphere || null,
        rating_cleanliness: body.ratingCleanliness || null,
        rating_course: body.ratingCourse || null,
        highlights: body.highlights || [],
        highlights_custom: body.highlightsCustom || null,
        good_points: body.goodPoints || null,
        improvement_points: body.improvementPoints || null,
        therapist_message: body.therapistMessage || null,
        final_review_text: body.finalReviewText || null,
        ai_generated_text: body.aiGenerated ? body.finalReviewText : null,
        hp_publish_consent: body.hpPublishConsent,
        submitted_from: body.submittedFrom,
      })
      .select("id")
      .single();

    if (surveyErr || !survey) {
      console.error("[survey/submit] insert error:", surveyErr);
      return NextResponse.json(
        { error: "アンケートの保存に失敗しました" },
        { status: 500 }
      );
    }

    // ─────────────────────────────────────
    // 5. クーポン発行（衝突回避リトライ）
    // ─────────────────────────────────────
    const { data: ptSettings } = await supabase
      .from("point_settings")
      .select("survey_coupon_amount, survey_coupon_valid_months")
      .maybeSingle();

    const discountAmount = ptSettings?.survey_coupon_amount || 1000;
    const validMonths = ptSettings?.survey_coupon_valid_months || 3;
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + validMonths);

    let couponCode = "";
    let couponId: number | null = null;
    let issued = false;

    for (let i = 0; i < MAX_COUPON_RETRY; i++) {
      couponCode = generateSurveyCouponCode();
      const { data: coupon, error: couponErr } = await supabase
        .from("survey_coupons")
        .insert({
          code: couponCode,
          customer_id: customerId,
          survey_id: survey.id,
          discount_amount: discountAmount,
          combinable: true,
          expires_at: expiresAt.toISOString(),
        })
        .select("id")
        .single();

      if (!couponErr && coupon) {
        couponId = coupon.id;
        issued = true;
        break;
      }
      // UNIQUE 衝突なら次のコードでリトライ。それ以外は中断。
      if (couponErr && !couponErr.message?.includes("duplicate")) {
        console.error("[survey/submit] coupon insert error:", couponErr);
        break;
      }
    }

    if (!issued) {
      console.error("[survey/submit] クーポン発行に失敗（衝突連発）");
      // アンケートは保存済みなので、クーポンなしで返す
    } else {
      // survey にクーポンIDを紐付け
      await supabase
        .from("customer_surveys")
        .update({ coupon_issued: true, coupon_id: couponId })
        .eq("id", survey.id);
    }

    // ─────────────────────────────────────
    // 6. 顧客の回答カウント更新
    // ─────────────────────────────────────
    if (customerId) {
      // 現在値を取得してインクリメント (Supabase の RPC なしで実装)
      const { data: cust } = await supabase
        .from("customers")
        .select("survey_response_count")
        .eq("id", customerId)
        .maybeSingle();
      await supabase
        .from("customers")
        .update({ survey_response_count: (cust?.survey_response_count || 0) + 1 })
        .eq("id", customerId);
    }

    // ─────────────────────────────────────
    // 7. セラピスト集計の再計算
    // ─────────────────────────────────────
    await recomputeTherapistStats(body.therapistId);

    // ─────────────────────────────────────
    // 8. Google Review URL の取得（店舗設定）
    // ─────────────────────────────────────
    const { data: reservation } = await supabase
      .from("reservations")
      .select("free_building_id")
      .eq("id", body.reservationId)
      .maybeSingle();

    let googleReviewUrl: string | null = null;
    if (reservation?.free_building_id) {
      const { data: store } = await supabase
        .from("stores")
        .select("google_review_url")
        .eq("id", reservation.free_building_id)
        .maybeSingle();
      googleReviewUrl = store?.google_review_url || null;
    }

    // ─────────────────────────────────────
    // レスポンス
    // ─────────────────────────────────────
    const response: SurveySubmitResponse = {
      surveyId: survey.id,
      couponCode: issued ? couponCode : "",
      couponExpiresAt: issued ? expiresAt.toISOString() : "",
      pointsGranted: 0, // HP掲載は社内承認後に付与のため、この時点では0
      googleReviewUrl,
    };

    return NextResponse.json(response);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "エラーが発生しました";
    console.error("[survey/submit] error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * セラピストの平均評価・回答数・NPSを再計算してキャッシュ更新
 *
 * NPS = (推奨者率 - 批判者率) × 100
 *   推奨者: rating_overall = 5
 *   中立者: rating_overall = 3 or 4
 *   批判者: rating_overall = 1 or 2
 */
async function recomputeTherapistStats(therapistId: number) {
  const { data: surveys } = await supabase
    .from("customer_surveys")
    .select("rating_overall")
    .eq("therapist_id", therapistId)
    .not("rating_overall", "is", null);

  if (!surveys || surveys.length === 0) return;

  const total = surveys.length;
  const sum = surveys.reduce((s, r) => s + (r.rating_overall || 0), 0);
  const avg = sum / total;

  const promoters = surveys.filter((r) => r.rating_overall === 5).length;
  const detractors = surveys.filter((r) => (r.rating_overall || 0) <= 2).length;
  const nps = ((promoters - detractors) / total) * 100;

  await supabase
    .from("therapists")
    .update({
      avg_rating: Number(avg.toFixed(2)),
      survey_count: total,
      nps_score: Number(nps.toFixed(2)),
    })
    .eq("id", therapistId);
}
