import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * ═══════════════════════════════════════════════════════════
 * アンケートリマインダ通知 Cron
 *
 * URL: GET /api/cron/survey-reminder
 *
 * 実行頻度: 1日1回 (Vercel Cron で日本時間 10:00 = UTC 1:00)
 *
 * 処理:
 *   1. 2日前〜7日前に customer_status=completed になった予約を取得
 *   2. customer_id があり (マイページ会員)、survey_opt_out=false の予約のみ
 *   3. その予約のアンケートが未回答
 *   4. survey_notifications に既に送信済みレコードがない
 *   5. 上記すべて満たす予約に対して:
 *      a. customer_notifications に INSERT (マイページプッシュ通知)
 *      b. survey_notifications に sent レコード INSERT (重複防止)
 *
 * セキュリティ:
 *   - Vercel Cron は Authorization: Bearer ${CRON_SECRET} を送る
 *   - .env に CRON_SECRET を設定
 *
 * 設計: docs/14_REVIEW_SYSTEM.md
 * ═══════════════════════════════════════════════════════════
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://cbewozzdyjqmhzkxsjqo.supabase.co";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

const CRON_SECRET = process.env.CRON_SECRET || "";

const CHANNEL = "mypage_notification";
const NOTIFICATION_TITLE = "🌸 ご感想をお聞かせください";

export async function GET(req: Request) {
  // ─────────────────────────────────────
  // 認証
  // ─────────────────────────────────────
  if (CRON_SECRET) {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const stats = {
      candidates: 0,
      sent: 0,
      skippedAlreadyResponded: 0,
      skippedOptedOut: 0,
      skippedNoMypage: 0,
      skippedAlreadyNotified: 0,
      errors: 0,
    };

    // ─────────────────────────────────────
    // 1. 対象期間の completed 予約を取得（2〜7日前）
    // ─────────────────────────────────────
    const today = new Date();
    const fromDate = new Date(today);
    fromDate.setDate(today.getDate() - 7);
    const toDate = new Date(today);
    toDate.setDate(today.getDate() - 2);

    const fromStr = fromDate.toISOString().split("T")[0];
    const toStr = toDate.toISOString().split("T")[0];

    const { data: reservations } = await supabase
      .from("reservations")
      .select("id, customer_name, date, start_time, course, therapist_id")
      .eq("customer_status", "completed")
      .gte("date", fromStr)
      .lte("date", toStr)
      .order("date", { ascending: false })
      .limit(500);

    if (!reservations || reservations.length === 0) {
      return NextResponse.json({
        message: "対象予約なし",
        period: { from: fromStr, to: toStr },
        stats,
      });
    }

    stats.candidates = reservations.length;

    // ─────────────────────────────────────
    // 2. 顧客名 → customer_id 解決（マイページ会員）
    // ─────────────────────────────────────
    const customerNames = Array.from(new Set(reservations.map((r) => r.customer_name).filter(Boolean)));
    const { data: customers } = await supabase
      .from("customers")
      .select("id, name, login_email, survey_opt_out")
      .in("name", customerNames);

    const custMap = new Map<string, { id: number; isMember: boolean; optOut: boolean }>();
    (customers || []).forEach((c) => {
      custMap.set(c.name, {
        id: c.id,
        isMember: Boolean(c.login_email), // login_email がある = マイページ会員
        optOut: Boolean(c.survey_opt_out),
      });
    });

    // ─────────────────────────────────────
    // 3. 既回答チェック (customer_surveys)
    // ─────────────────────────────────────
    const reservationIds = reservations.map((r) => r.id);
    const { data: existingSurveys } = await supabase
      .from("customer_surveys")
      .select("reservation_id")
      .in("reservation_id", reservationIds);
    const answeredSet = new Set((existingSurveys || []).map((s) => s.reservation_id));

    // ─────────────────────────────────────
    // 4. 既送信チェック (survey_notifications)
    // ─────────────────────────────────────
    const { data: alreadyNotified } = await supabase
      .from("survey_notifications")
      .select("reservation_id")
      .eq("channel", CHANNEL)
      .in("reservation_id", reservationIds);
    const notifiedSet = new Set((alreadyNotified || []).map((n) => n.reservation_id));

    // ─────────────────────────────────────
    // 5. 各予約を判定して送信
    // ─────────────────────────────────────
    const sentReservations: number[] = [];

    for (const r of reservations) {
      // 既回答ならスキップ
      if (answeredSet.has(r.id)) {
        stats.skippedAlreadyResponded++;
        continue;
      }

      // 既送信ならスキップ
      if (notifiedSet.has(r.id)) {
        stats.skippedAlreadyNotified++;
        continue;
      }

      // 顧客レコードチェック
      const cust = custMap.get(r.customer_name);
      if (!cust) {
        stats.skippedNoMypage++;
        // それでも survey_notifications に skipped で記録（再試行防止）
        await supabase.from("survey_notifications").insert({
          reservation_id: r.id,
          customer_id: null,
          channel: CHANNEL,
          scheduled_at: new Date().toISOString(),
          status: "skipped",
          skip_reason: "no_mypage",
        });
        continue;
      }

      // マイページ会員でないとスキップ
      if (!cust.isMember) {
        stats.skippedNoMypage++;
        await supabase.from("survey_notifications").insert({
          reservation_id: r.id,
          customer_id: cust.id,
          channel: CHANNEL,
          scheduled_at: new Date().toISOString(),
          status: "skipped",
          skip_reason: "no_mypage",
        });
        continue;
      }

      // オプトアウトされてればスキップ
      if (cust.optOut) {
        stats.skippedOptedOut++;
        await supabase.from("survey_notifications").insert({
          reservation_id: r.id,
          customer_id: cust.id,
          channel: CHANNEL,
          scheduled_at: new Date().toISOString(),
          status: "skipped",
          skip_reason: "opted_out",
        });
        continue;
      }

      // ─── 通知送信 ───
      const dateLabel = `${r.date}`;

      const { error: notifErr } = await supabase.from("customer_notifications").insert({
        title: NOTIFICATION_TITLE,
        body: `${dateLabel}のご来店、ありがとうございました🌸\nご感想をお聞かせいただいたお客様には、次回ご来店時に1,000円OFFを自動適用いたします（90分以上のコース限定・3ヶ月有効）。\n\n所要 2〜3分で完了します。`,
        type: "campaign",
        target_customer_id: cust.id,
      });

      if (notifErr) {
        stats.errors++;
        console.error("[survey-reminder] notification insert error:", notifErr);
        continue;
      }

      // 送信履歴記録
      await supabase.from("survey_notifications").insert({
        reservation_id: r.id,
        customer_id: cust.id,
        channel: CHANNEL,
        scheduled_at: new Date().toISOString(),
        sent_at: new Date().toISOString(),
        status: "sent",
      });

      sentReservations.push(r.id);
      stats.sent++;
    }

    return NextResponse.json({
      message: "完了",
      period: { from: fromStr, to: toStr },
      stats,
      sentReservations,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "エラーが発生しました";
    console.error("[survey-reminder] error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
