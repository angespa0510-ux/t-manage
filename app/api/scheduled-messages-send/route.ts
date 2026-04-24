import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * ═══════════════════════════════════════════════════════════
 * /api/scheduled-messages-send
 *
 * Vercel Cron で10分おきに実行される予約メッセージ送信バッチ。
 *
 * 処理:
 *   1. chat_scheduled_messages から scheduled_at <= NOW() && status='pending' を取得
 *   2. chat_messages に INSERT
 *   3. 添付がある場合は chat_attachments にも登録（15日カウント開始）
 *   4. chat_conversations.last_message_at / last_message_preview を更新
 *   5. chat_scheduled_messages.status = 'sent' / sent_at / sent_message_id を更新
 *   6. エラー時は status='failed' + error_message
 *
 * セキュリティ: Vercel Cron の Authorization: Bearer {CRON_SECRET}
 * 手動実行も可能（管理画面から / POST）
 * ═══════════════════════════════════════════════════════════
 */

const CRON_SECRET = process.env.CRON_SECRET || "";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export async function GET(request: NextRequest) {
  return handle(request, "cron");
}

export async function POST(request: NextRequest) {
  return handle(request, "manual");
}

async function handle(request: NextRequest, triggeredBy: string) {
  // Cron 認証
  const auth = request.headers.get("authorization") || "";
  if (triggeredBy === "cron" && (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return NextResponse.json({ error: "Supabase credentials missing" }, { status: 500 });
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const nowIso = new Date().toISOString();

  // 送信対象取得（期限切れ pending）
  const { data: targets, error: fetchErr } = await sb
    .from("chat_scheduled_messages")
    .select("*")
    .lte("scheduled_at", nowIso)
    .eq("status", "pending")
    .order("scheduled_at", { ascending: true })
    .limit(100);

  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }

  if (!targets || targets.length === 0) {
    return NextResponse.json({
      status: "success",
      sent_count: 0,
      message: "送信対象なし",
    });
  }

  let sentCount = 0;
  let failedCount = 0;
  const errors: string[] = [];

  for (const s of targets) {
    try {
      // ① chat_messages に挿入
      const messageType = s.attachment_url
        ? s.attachment_type?.startsWith("image/")
          ? "image"
          : s.attachment_type?.startsWith("video/")
          ? "video"
          : "file"
        : "text";

      const { data: inserted, error: msgErr } = await sb
        .from("chat_messages")
        .insert({
          conversation_id: s.conversation_id,
          sender_type: s.sender_type || "staff",
          sender_id: s.sender_id,
          sender_name: s.sender_name,
          content: s.content || "",
          message_type: messageType,
          attachment_url: s.attachment_url || null,
          attachment_type: s.attachment_type || null,
        })
        .select()
        .single();

      if (msgErr || !inserted) {
        throw new Error(msgErr?.message || "insert message failed");
      }

      // ② 添付があれば chat_attachments に登録（送信時点から15日カウント）
      if (s.attachment_storage_path && s.attachment_url && s.attachment_type) {
        await sb.from("chat_attachments").insert({
          conversation_id: s.conversation_id,
          message_id: inserted.id,
          storage_path: s.attachment_storage_path,
          file_url: s.attachment_url,
          file_type: s.attachment_type,
          file_size: s.attachment_size || 0,
          uploaded_by_type: s.sender_type || "staff",
          uploaded_by_id: s.sender_id,
          expires_at: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
        });
      }

      // ③ 会話の last_message_at 更新
      const preview = s.content
        ? String(s.content).slice(0, 80)
        : s.attachment_type?.startsWith("image/")
        ? "📷 画像を送信"
        : s.attachment_type?.startsWith("video/")
        ? "🎬 動画を送信"
        : "📎 添付";
      await sb
        .from("chat_conversations")
        .update({
          last_message_at: new Date().toISOString(),
          last_message_preview: preview,
        })
        .eq("id", s.conversation_id);

      // ④ 予約を 'sent' に更新
      await sb
        .from("chat_scheduled_messages")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          sent_message_id: inserted.id,
        })
        .eq("id", s.id);

      sentCount++;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`id=${s.id}: ${msg}`);
      await sb
        .from("chat_scheduled_messages")
        .update({
          status: "failed",
          error_message: msg.slice(0, 500),
        })
        .eq("id", s.id);
      failedCount++;
    }
  }

  return NextResponse.json({
    status: failedCount > 0 ? "partial" : "success",
    total: targets.length,
    sent_count: sentCount,
    failed_count: failedCount,
    errors: errors.length > 0 ? errors : undefined,
  });
}
