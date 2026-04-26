import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * ═══════════════════════════════════════════════════════════
 * アンケート月次レポート Cron
 *
 * URL: GET /api/cron/survey-monthly-report
 *
 * 実行頻度: 毎月1日 朝9時 (JST) = UTC 0時
 *
 * 処理:
 *   1. 前月のすべての customer_surveys を集計
 *   2. メール本文を組み立て
 *   3. settings.smtp_from 宛にメール送信
 *
 * 集計内容:
 *   - 件数
 *   - 平均評価
 *   - NPS（推奨者率 - 批判者率）
 *   - トップセラピスト（評価高い順、最低3件以上）
 *   - 低評価件数（rating <= 3）
 *   - HP掲載件数
 *   - HP掲載同意件数
 *   - クーポン発行/使用件数
 *
 * 設計: docs/14_REVIEW_SYSTEM.md
 * ═══════════════════════════════════════════════════════════
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://cbewozzdyjqmhzkxsjqo.supabase.co";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

const CRON_SECRET = process.env.CRON_SECRET || "";

export async function GET(req: Request) {
  // 認証
  if (CRON_SECRET) {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    // ─────────────────────────────────────
    // 1. 前月の期間を計算
    // ─────────────────────────────────────
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthLabel = `${lastMonth.getFullYear()}年${lastMonth.getMonth() + 1}月`;

    const fromIso = lastMonth.toISOString();
    const toIso = thisMonth.toISOString();

    // ─────────────────────────────────────
    // 2. 前月のサーベイを取得
    // ─────────────────────────────────────
    const { data: surveys } = await supabase
      .from("customer_surveys")
      .select(`
        id,
        therapist_id,
        rating_overall,
        coupon_issued,
        coupon_id,
        hp_publish_consent,
        hp_published,
        submitted_at
      `)
      .gte("submitted_at", fromIso)
      .lt("submitted_at", toIso);

    if (!surveys || surveys.length === 0) {
      return NextResponse.json({
        message: `${lastMonthLabel}のアンケート回答はありませんでした`,
        sent: false,
      });
    }

    // ─────────────────────────────────────
    // 3. 集計
    // ─────────────────────────────────────
    const total = surveys.length;
    const ratings = surveys.map((s) => s.rating_overall || 0).filter((r) => r > 0);
    const avgRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;
    const promoters = ratings.filter((r) => r === 5).length;
    const detractors = ratings.filter((r) => r <= 2).length;
    const nps = ratings.length > 0 ? ((promoters - detractors) / ratings.length) * 100 : 0;
    const lowRating = ratings.filter((r) => r <= 3).length;
    const hpConsent = surveys.filter((s) => s.hp_publish_consent).length;
    const hpPublished = surveys.filter((s) => s.hp_published).length;
    const couponsIssued = surveys.filter((s) => s.coupon_issued).length;

    // クーポン使用数（前月の survey_coupons.used_at が前月内）
    const { data: usedCoupons } = await supabase
      .from("survey_coupons")
      .select("id")
      .gte("used_at", fromIso)
      .lt("used_at", toIso);
    const couponsUsed = usedCoupons?.length || 0;

    // ─────────────────────────────────────
    // 4. セラピスト別ランキング
    // ─────────────────────────────────────
    const therapistMap: Record<number, { count: number; sum: number; promoters: number; detractors: number }> = {};
    surveys.forEach((s) => {
      if (!s.therapist_id || !s.rating_overall) return;
      if (!therapistMap[s.therapist_id]) therapistMap[s.therapist_id] = { count: 0, sum: 0, promoters: 0, detractors: 0 };
      const m = therapistMap[s.therapist_id];
      m.count++;
      m.sum += s.rating_overall;
      if (s.rating_overall === 5) m.promoters++;
      if (s.rating_overall <= 2) m.detractors++;
    });

    const therapistIds = Object.keys(therapistMap).map(Number);
    let therapistNameMap: Record<number, string> = {};
    if (therapistIds.length > 0) {
      const { data: ths } = await supabase.from("therapists").select("id,name").in("id", therapistIds);
      if (ths) therapistNameMap = Object.fromEntries(ths.map((t) => [t.id, t.name]));
    }

    const ranking = Object.entries(therapistMap)
      .map(([id, m]) => ({
        id: Number(id),
        name: therapistNameMap[Number(id)] || "?",
        count: m.count,
        avg: m.sum / m.count,
        nps: ((m.promoters - m.detractors) / m.count) * 100,
      }))
      .filter((t) => t.count >= 3) // 3件以上の回答があるセラピストのみ
      .sort((a, b) => b.avg - a.avg);

    // ─────────────────────────────────────
    // 5. メール本文を組み立て
    // ─────────────────────────────────────
    const lines: string[] = [];
    lines.push(`【${lastMonthLabel} アンケート月次レポート】`);
    lines.push("");
    lines.push("─────────────────────");
    lines.push("📊 全体サマリー");
    lines.push("─────────────────────");
    lines.push(`ご回答数: ${total} 件`);
    lines.push(`平均満足度: ${avgRating.toFixed(2)} / 5.00`);
    lines.push(`NPS: ${nps.toFixed(1)} (推奨者 ${promoters} / 批判者 ${detractors})`);
    lines.push(`低評価 (3以下): ${lowRating} 件`);
    lines.push("");
    lines.push("─────────────────────");
    lines.push("🎁 クーポン");
    lines.push("─────────────────────");
    lines.push(`発行数: ${couponsIssued} 件`);
    lines.push(`使用数: ${couponsUsed} 件 (前月使用ベース)`);
    lines.push("");
    lines.push("─────────────────────");
    lines.push("🌸 HP掲載");
    lines.push("─────────────────────");
    lines.push(`掲載同意: ${hpConsent} 件`);
    lines.push(`掲載済み: ${hpPublished} 件`);
    lines.push("");

    if (ranking.length > 0) {
      lines.push("─────────────────────");
      lines.push("👥 セラピスト評価ランキング (3件以上)");
      lines.push("─────────────────────");
      ranking.slice(0, 10).forEach((t, i) => {
        lines.push(`${i + 1}. ${t.name} (${t.count}件) 平均 ${t.avg.toFixed(2)} / NPS ${t.nps.toFixed(0)}`);
      });
      lines.push("");
    }

    lines.push("─────────────────────");
    lines.push("詳細は管理画面でご確認ください:");
    lines.push("/survey-dashboard");

    const body = lines.join("\n");
    const subject = `【月次レポート】${lastMonthLabel} アンケート集計（${total}件・平均${avgRating.toFixed(2)}）`;

    // ─────────────────────────────────────
    // 6. 宛先取得 + メール送信
    // ─────────────────────────────────────
    const { data: settingsData } = await supabase
      .from("settings")
      .select("key,value")
      .in("key", ["smtp_from"]);
    const settingsMap: Record<string, string> = {};
    (settingsData || []).forEach((s) => { settingsMap[s.key] = s.value; });
    const recipient = settingsMap.smtp_from;

    if (!recipient) {
      return NextResponse.json({
        message: "月次レポート集計完了 (smtp_from 未設定のためメール送信なし)",
        period: lastMonthLabel,
        body,
      });
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://ange-spa.jp";
    const sendRes = await fetch(`${baseUrl}/api/deliver-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: recipient,
        subject,
        body,
      }),
    });

    return NextResponse.json({
      message: "月次レポート送信完了",
      period: lastMonthLabel,
      summary: { total, avgRating, nps, lowRating, hpPublished, couponsIssued, couponsUsed },
      emailSent: sendRes.ok,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "エラーが発生しました";
    console.error("[survey-monthly-report] error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
