import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://cbewozzdyjqmhzkxsjqo.supabase.co";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNiZXdvenpkeWpxbWh6a3hzanFvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyNjU2MzYsImV4cCI6MjA4OTg0MTYzNn0.cddSSXx6OqOKNTc-WlaHTusK67sFgi8QwETnGaVGgIw";
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * 書類メール配信API
 *
 * スタッフ/取引先宛てに件名・本文・添付URLを指定してメールを送信する。
 * 送信後、document_deliveries の delivery_id が指定されていれば
 * status='sent' / delivered_at を更新する。
 *
 * Body:
 *   - to: string (必須) 送信先メールアドレス
 *   - subject: string (必須) 件名
 *   - body: string (必須) 本文（プレーンテキスト or HTMLどちらも可、改行は <br> に変換）
 *   - attachment_url: string (任意) 添付ファイルURL（本文にリンクとして挿入）
 *   - attachment_name: string (任意) 添付ファイル名（表示用）
 *   - delivery_id: number (任意) document_deliveries.id（成功時に status 更新）
 */
export async function POST(req: Request) {
  let deliveryId: number | undefined;
  try {
    const { to, subject, body, attachment_url, attachment_name, delivery_id } = await req.json();
    deliveryId = delivery_id;

    if (!to || !to.trim()) return NextResponse.json({ error: "宛先メールアドレスが指定されていません" }, { status: 400 });
    if (!subject || !subject.trim()) return NextResponse.json({ error: "件名が指定されていません" }, { status: 400 });
    if (!body || !body.trim()) return NextResponse.json({ error: "本文が指定されていません" }, { status: 400 });

    // SMTP設定を settings から読む
    const { data: settings } = await supabase.from("settings").select("key, value")
      .in("key", ["smtp_host", "smtp_port", "smtp_user", "smtp_pass", "smtp_from", "store_name"]);
    const map: Record<string, string> = {};
    if (settings) for (const s of settings) map[s.key] = s.value;

    const smtpHost = map.smtp_host || "smtp.gmail.com";
    const smtpPort = parseInt(map.smtp_port || "587");
    const smtpUser = map.smtp_user || "";
    const smtpPass = map.smtp_pass || "";
    const smtpFrom = map.smtp_from || smtpUser;
    const storeName = map.store_name || "チョップ";

    if (!smtpUser || !smtpPass) {
      if (deliveryId) await markFailed(deliveryId, "SMTP設定が未登録");
      return NextResponse.json({ error: "SMTP設定が登録されていません。システム設定から Gmail アプリパスワードを登録してください。" }, { status: 500 });
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost, port: smtpPort, secure: smtpPort === 465,
      auth: { user: smtpUser, pass: smtpPass },
    });

    // 本文構築（HTML化）
    const bodyHtml = body.replace(/\n/g, "<br>");
    const attachmentBlock = attachment_url ? `
      <div style="margin: 16px 0; padding: 12px 16px; background: #f8f6f3; border-left: 3px solid #c3a782; border-radius: 4px;">
        <p style="margin: 0 0 6px 0; font-size: 12px; color: #6a6a6a;">📎 添付ファイル</p>
        <p style="margin: 0;">
          <a href="${attachment_url}" style="color: #c3a782; font-weight: 500; text-decoration: none;" target="_blank">
            ${attachment_name || "ファイルを開く"}
          </a>
        </p>
      </div>
    ` : "";

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #2c2c2a;">
        <h2 style="color: #c3a782; font-size: 16px; margin-top: 0;">${escapeHtml(subject)}</h2>
        <div style="font-size: 13px; line-height: 1.7;">${bodyHtml}</div>
        ${attachmentBlock}
        <hr style="border: none; border-top: 1px solid #e8e4df; margin: 24px 0;">
        <p style="font-size: 11px; color: #888780; margin: 0;">
          このメールは ${storeName} の業務管理システムから自動送信されています。<br>
          ご不明な点がございましたらご連絡ください。
        </p>
      </div>
    `;

    await transporter.sendMail({
      from: `"${storeName}" <${smtpFrom}>`,
      to: to.trim(),
      subject: subject,
      html: html,
    });

    // 配信ログを成功に更新
    if (deliveryId) {
      await supabase.from("document_deliveries")
        .update({ status: "sent", delivered_at: new Date().toISOString() })
        .eq("id", deliveryId);
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    if (deliveryId) await markFailed(deliveryId, e.message || String(e));
    return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
  }
}

async function markFailed(deliveryId: number, msg: string) {
  await supabase.from("document_deliveries")
    .update({ status: "failed", error_message: msg.slice(0, 500) })
    .eq("id", deliveryId);
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
