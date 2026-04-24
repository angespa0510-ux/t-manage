import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://cbewozzdyjqmhzkxsjqo.supabase.co",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
);

/** 評価・FAQクリックログ・CTA 表示/クリック */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = body.action as string;

    // 回答への 👍👎 評価
    if (action === "rate_answer") {
      const logId = Number(body.log_id);
      const rating = Number(body.rating); // 1 or -1
      if (!logId) return NextResponse.json({ error: "log_id required" }, { status: 400 });
      await supabase.from("hp_chatbot_logs").update({ rating }).eq("id", logId);
      return NextResponse.json({ ok: true });
    }

    // FAQ をクリックした
    if (action === "faq_click") {
      const faqId = Number(body.faq_id);
      if (!faqId) return NextResponse.json({ error: "faq_id required" }, { status: 400 });
      const { data: current } = await supabase
        .from("hp_chatbot_faqs")
        .select("view_count")
        .eq("id", faqId)
        .maybeSingle();
      await supabase
        .from("hp_chatbot_faqs")
        .update({ view_count: (current?.view_count || 0) + 1 })
        .eq("id", faqId);
      return NextResponse.json({ ok: true });
    }

    // FAQ への 役立った / 役立たなかった
    if (action === "faq_feedback") {
      const faqId = Number(body.faq_id);
      const helpful = Boolean(body.helpful);
      if (!faqId) return NextResponse.json({ error: "faq_id required" }, { status: 400 });
      const col = helpful ? "helpful_count" : "unhelpful_count";
      const { data: current } = await supabase
        .from("hp_chatbot_faqs")
        .select(col)
        .eq("id", faqId)
        .maybeSingle();
      const currentVal = (current as Record<string, number> | null)?.[col] || 0;
      await supabase
        .from("hp_chatbot_faqs")
        .update({ [col]: currentVal + 1 })
        .eq("id", faqId);
      return NextResponse.json({ ok: true });
    }

    // 写真 CTA 表示/クリックログ
    if (action === "photo_cta") {
      const photoId = Number(body.photo_id);
      const sessionId = (body.session_id || "").toString();
      const viewType = (body.view_type || "cta_shown").toString(); // 'cta_shown' | 'cta_clicked'
      if (!photoId) return NextResponse.json({ error: "photo_id required" }, { status: 400 });
      await supabase.from("hp_photo_views").insert({
        photo_id: photoId,
        session_id: sessionId,
        is_member: false,
        view_type: viewType,
      });
      // CTA 表示回数を写真側にも加算
      if (viewType === "cta_shown") {
        const { data: current } = await supabase
          .from("hp_photos")
          .select("member_cta_shown_count")
          .eq("id", photoId)
          .maybeSingle();
        await supabase
          .from("hp_photos")
          .update({ member_cta_shown_count: (current?.member_cta_shown_count || 0) + 1 })
          .eq("id", photoId);
      }
      return NextResponse.json({ ok: true });
    }

    // 写真 閲覧ログ
    if (action === "photo_view") {
      const photoId = Number(body.photo_id);
      const therapistId = body.therapist_id ? Number(body.therapist_id) : null;
      const sessionId = (body.session_id || "").toString();
      const customerId = body.customer_id ? Number(body.customer_id) : null;
      const isMember = Boolean(body.is_member);
      if (!photoId) return NextResponse.json({ error: "photo_id required" }, { status: 400 });
      await supabase.from("hp_photo_views").insert({
        photo_id: photoId,
        therapist_id: therapistId,
        session_id: sessionId,
        customer_id: customerId,
        is_member: isMember,
        view_type: "view",
      });
      const col = isMember ? "view_count_member" : "view_count_public";
      const { data: current } = await supabase
        .from("hp_photos")
        .select(col)
        .eq("id", photoId)
        .maybeSingle();
      const currentVal = (current as Record<string, number> | null)?.[col] || 0;
      await supabase
        .from("hp_photos")
        .update({ [col]: currentVal + 1 })
        .eq("id", photoId);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "unknown action" }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "unknown error" }, { status: 500 });
  }
}
