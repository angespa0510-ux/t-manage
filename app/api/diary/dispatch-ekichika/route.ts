import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://cbewozzdyjqmhzkxsjqo.supabase.co";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

const MAX_TOTAL_ATTACHMENT_BYTES = 20 * 1024 * 1024; // 駅ちか上限想定: 20MB

/**
 * 本文整形: T-MANAGE独自記法を除去
 */
function formatBodyForEkichika(body: string): string {
  return body
    .replace(/\[link:[^\]]+\]/g, "")
    .replace(/\[catlink:[^\]]+\]/g, "")
    .replace(/\[page:[^\]]+\]/g, "")
    .replace(/\[button:[^\]]+\]/g, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .trim();
}

/**
 * Storage URLからファイルパスを抽出
 * URL例: https://xxx.supabase.co/storage/v1/object/public/therapist-diary/123/456/789_0.webp
 */
function extractStoragePath(url: string): string | null {
  const m = url.match(/\/therapist-diary\/(.+)$/);
  return m ? m[1] : null;
}

/**
 * SMTP 設定取得 (store_settings テーブル)
 */
async function getSmtpSettings() {
  const { data: rows } = await supabase
    .from("store_settings")
    .select("key, value")
    .in("key", ["smtp_host", "smtp_port", "smtp_user", "smtp_pass", "smtp_from", "store_name"]);
  const m: Record<string, string> = {};
  if (rows) for (const r of rows) m[r.key] = r.value;
  return {
    host: m.smtp_host || "smtp.gmail.com",
    port: parseInt(m.smtp_port || "587"),
    user: m.smtp_user || process.env.GMAIL_USER || "",
    pass: m.smtp_pass || process.env.GMAIL_APP_PASSWORD || "",
    from: m.smtp_from || m.smtp_user || process.env.GMAIL_USER || "",
    storeName: m.store_name || "Ange Spa",
  };
}

export async function POST(req: Request) {
  let entryId: number | null = null;
  try {
    const body = await req.json();
    entryId = body.entryId as number;

    if (!entryId) {
      return NextResponse.json({ error: "entryId が必要です" }, { status: 400 });
    }

    // 1. エントリ取得
    const { data: entry, error: entryErr } = await supabase
      .from("therapist_diary_entries")
      .select("id, therapist_id, title, body, visibility, send_to_ekichika, deleted_at")
      .eq("id", entryId)
      .maybeSingle();

    if (entryErr || !entry) {
      return NextResponse.json({ error: "投稿が見つかりません" }, { status: 404 });
    }

    if (entry.deleted_at) {
      return NextResponse.json({ error: "削除済みの投稿です" }, { status: 400 });
    }

    if (entry.visibility !== "public") {
      // 会員限定 → 送信スキップ
      await supabase
        .from("therapist_diary_entries")
        .update({ ekichika_dispatch_status: "skipped" })
        .eq("id", entryId);
      return NextResponse.json({ skipped: true, reason: "会員限定のため駅ちか送信なし" });
    }

    if (!entry.send_to_ekichika) {
      await supabase
        .from("therapist_diary_entries")
        .update({ ekichika_dispatch_status: "skipped" })
        .eq("id", entryId);
      return NextResponse.json({ skipped: true, reason: "駅ちか送信フラグOFF" });
    }

    // 2. 駅ちか設定取得
    const { data: settings } = await supabase
      .from("ekichika_post_settings")
      .select("*")
      .eq("therapist_id", entry.therapist_id)
      .maybeSingle();

    if (!settings) {
      await supabase
        .from("therapist_diary_entries")
        .update({
          ekichika_dispatch_status: "skipped",
          ekichika_error_message: "駅ちかメアド未設定",
        })
        .eq("id", entryId);
      return NextResponse.json({ skipped: true, reason: "駅ちかメアド未設定" });
    }

    if (!settings.is_active) {
      await supabase
        .from("therapist_diary_entries")
        .update({
          ekichika_dispatch_status: "skipped",
          ekichika_error_message: "駅ちか設定が無効",
        })
        .eq("id", entryId);
      return NextResponse.json({ skipped: true, reason: "is_active=false" });
    }

    // 3. 画像取得 (sort_order順)
    const { data: images } = await supabase
      .from("therapist_diary_images")
      .select("image_url, sort_order")
      .eq("entry_id", entryId)
      .order("sort_order", { ascending: true });

    const attachments: { filename: string; content: Buffer; contentType: string }[] = [];
    let totalBytes = 0;

    if (images) {
      for (let i = 0; i < images.length; i++) {
        const img = images[i];
        const path = extractStoragePath(img.image_url);
        if (!path) continue;

        const { data: blob, error: dlErr } = await supabase.storage
          .from("therapist-diary")
          .download(path);

        if (dlErr || !blob) {
          console.error(`画像DL失敗 ${path}:`, dlErr);
          continue;
        }

        const arrayBuf = await blob.arrayBuffer();
        const buffer = Buffer.from(arrayBuf);

        if (totalBytes + buffer.length > MAX_TOTAL_ATTACHMENT_BYTES) {
          console.warn(`添付サイズ上限 ${MAX_TOTAL_ATTACHMENT_BYTES} 到達。${i}枚目以降はスキップ`);
          break;
        }

        attachments.push({
          filename: `image_${i + 1}.webp`,
          content: buffer,
          contentType: "image/webp",
        });
        totalBytes += buffer.length;
      }
    }

    // 4. SMTP取得 + 送信
    const smtp = await getSmtpSettings();
    if (!smtp.user || !smtp.pass) {
      const errMsg = "SMTP設定がありません (store_settings or env)";
      await supabase
        .from("therapist_diary_entries")
        .update({
          ekichika_dispatch_status: "failed",
          ekichika_error_message: errMsg,
        })
        .eq("id", entryId);
      await supabase.from("ekichika_dispatch_logs").insert({
        entry_id: entryId,
        therapist_id: entry.therapist_id,
        ekichika_email: settings.ekichika_email,
        subject: entry.title,
        body_text: entry.body,
        image_count: attachments.length,
        total_size_bytes: totalBytes,
        status: "failed",
        error_message: errMsg,
      });
      return NextResponse.json({ error: errMsg }, { status: 500 });
    }

    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.port === 465,
      auth: { user: smtp.user, pass: smtp.pass },
    });

    const formattedBody = formatBodyForEkichika(entry.body);

    try {
      const info = await transporter.sendMail({
        from: `"${smtp.storeName}" <${smtp.from}>`,
        to: settings.ekichika_email,
        subject: entry.title,
        text: formattedBody,
        attachments,
      });

      // 5. 成功記録
      const now = new Date().toISOString();
      await supabase.from("ekichika_dispatch_logs").insert({
        entry_id: entryId,
        therapist_id: entry.therapist_id,
        ekichika_email: settings.ekichika_email,
        subject: entry.title,
        body_text: formattedBody,
        image_count: attachments.length,
        total_size_bytes: totalBytes,
        status: "sent",
        smtp_response: info.response || "ok",
        sent_at: now,
      });

      await supabase
        .from("therapist_diary_entries")
        .update({
          ekichika_dispatch_status: "sent",
          ekichika_dispatched_at: now,
          ekichika_error_message: null,
        })
        .eq("id", entryId);

      await supabase
        .from("ekichika_post_settings")
        .update({
          last_sent_at: now,
          total_sent_count: (settings.total_sent_count || 0) + 1,
          updated_at: now,
        })
        .eq("id", settings.id);

      return NextResponse.json({
        success: true,
        messageId: info.messageId,
        attachmentCount: attachments.length,
        totalBytes,
      });
    } catch (sendErr: unknown) {
      const errMsg = sendErr instanceof Error ? sendErr.message : "送信エラー";
      console.error("ekichika send error:", sendErr);

      await supabase.from("ekichika_dispatch_logs").insert({
        entry_id: entryId,
        therapist_id: entry.therapist_id,
        ekichika_email: settings.ekichika_email,
        subject: entry.title,
        body_text: formattedBody,
        image_count: attachments.length,
        total_size_bytes: totalBytes,
        status: "failed",
        error_message: errMsg,
      });

      await supabase
        .from("therapist_diary_entries")
        .update({
          ekichika_dispatch_status: "failed",
          ekichika_error_message: errMsg,
        })
        .eq("id", entryId);

      await supabase
        .from("ekichika_post_settings")
        .update({
          total_failed_count: (settings.total_failed_count || 0) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", settings.id);

      return NextResponse.json({ error: errMsg }, { status: 500 });
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "不明なエラー";
    console.error("/api/diary/dispatch-ekichika error:", e);
    if (entryId) {
      await supabase
        .from("therapist_diary_entries")
        .update({
          ekichika_dispatch_status: "failed",
          ekichika_error_message: msg,
        })
        .eq("id", entryId);
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
