import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * ═══════════════════════════════════════════════════════════
 * セラピスト返信API
 *
 * POST /api/survey/therapist-reply
 *
 * Body:
 *   - surveyId: number
 *   - therapistId: number (本人確認用)
 *   - reply: string (返信内容)
 *
 * 処理:
 *   1. customer_surveys.therapist_reply / therapist_reply_at 更新
 *   2. お客様の customer_id があれば customer_notifications にプッシュ通知
 *   3. HP /reviews に自動反映（hp_published のレビューに対する返信）
 * ═══════════════════════════════════════════════════════════
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://cbewozzdyjqmhzkxsjqo.supabase.co";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { surveyId, therapistId, reply } = body;

    if (!surveyId || !therapistId || !reply || !reply.trim()) {
      return NextResponse.json({ error: "必須項目が不足しています" }, { status: 400 });
    }

    if (reply.length > 1000) {
      return NextResponse.json({ error: "返信は1000文字以内にしてください" }, { status: 400 });
    }

    // 本人確認: 該当アンケートのセラピストか
    const { data: survey } = await supabase
      .from("customer_surveys")
      .select("id, therapist_id, customer_id, hp_published, rating_overall")
      .eq("id", surveyId)
      .maybeSingle();

    if (!survey) {
      return NextResponse.json({ error: "アンケートが見つかりません" }, { status: 404 });
    }
    if (survey.therapist_id !== therapistId) {
      return NextResponse.json({ error: "返信権限がありません" }, { status: 403 });
    }

    // 返信を保存
    const { error: updateErr } = await supabase
      .from("customer_surveys")
      .update({
        therapist_reply: reply.trim(),
        therapist_reply_at: new Date().toISOString(),
      })
      .eq("id", surveyId);

    if (updateErr) {
      console.error("[therapist-reply] update error:", updateErr);
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    // セラピスト名を取得
    const { data: therapist } = await supabase
      .from("therapists")
      .select("name")
      .eq("id", therapistId)
      .maybeSingle();
    const therapistName = therapist?.name || "セラピスト";

    // お客様にプッシュ通知（マイページ会員のみ）
    if (survey.customer_id) {
      const replySnippet = reply.trim().slice(0, 80);
      await supabase.from("customer_notifications").insert({
        title: `💌 ${therapistName} よりお返事が届きました`,
        body: `${replySnippet}${replySnippet.length >= 80 ? "…" : ""}\n\nお客様の声ページでご確認いただけます🌸`,
        type: "campaign",
        target_customer_id: survey.customer_id,
      });
    }

    return NextResponse.json({
      success: true,
      published: Boolean(survey.hp_published),
      message: survey.hp_published
        ? "返信を保存しました。HPに反映されます。"
        : "返信を保存しました。",
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "エラーが発生しました";
    console.error("[therapist-reply] error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
