import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://cbewozzdyjqmhzkxsjqo.supabase.co";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

function generatePassword(): string {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  let pw = "";
  for (let i = 0; i < 8; i++) pw += chars[Math.floor(Math.random() * chars.length)];
  return pw;
}

function normalizePhone(phone: string): string {
  return phone.replace(/[-\s　()（）+]/g, "");
}

export async function POST(req: Request) {
  try {
    const { phone, type } = await req.json();
    const isTherapist = type === "therapist";

    if (!phone || phone.trim().length < 8) {
      return NextResponse.json({ error: "電話番号を入力してください" }, { status: 400 });
    }

    const cleanPhone = normalizePhone(phone.trim());
    const table = isTherapist ? "therapists" : "customers";

    type UserRecord = { id: number; name: string; self_name?: string; phone: string; login_email: string; login_password: string };

    // 電話番号で検索
    let queryFilter = `phone.eq.${cleanPhone}`;
    if (!isTherapist) queryFilter += `,phone2.eq.${cleanPhone},phone3.eq.${cleanPhone}`;

    const { data: rawRecords } = await supabase
      .from(table)
      .select("id, name, " + (isTherapist ? "" : "self_name, ") + "phone, login_email, login_password")
      .or(queryFilter);

    const records = (rawRecords || []) as unknown as UserRecord[];

    if (records.length === 0) {
      return NextResponse.json({ error: "この電話番号は登録されていません" }, { status: 404 });
    }

    // マイページ登録済みを探す
    const record = records.find(r => r.login_email);

    if (!record || !record.login_email) {
      return NextResponse.json({ error: isTherapist ? "この電話番号にマイページ登録が見つかりません。オーナーにお問い合わせください。" : "この電話番号にマイページ登録が見つかりません。お店にお問い合わせください。" }, { status: 404 });
    }

    // 新しいパスワードを生成
    const newPassword = generatePassword();

    // パスワードを更新
    await supabase
      .from(table)
      .update({ login_password: newPassword })
      .eq("id", record.id);

    // メール送信用の設定を取得
    const { data: settings } = await supabase
      .from("store_settings")
      .select("key, value")
      .in("key", ["smtp_host", "smtp_port", "smtp_user", "smtp_pass", "smtp_from", "store_name"]);

    const settingsMap: Record<string, string> = {};
    if (settings) {
      for (const s of settings) settingsMap[s.key] = s.value;
    }

    // SMTP設定がない場合はGmail設定をチェック
    const smtpHost = settingsMap.smtp_host || "smtp.gmail.com";
    const smtpPort = parseInt(settingsMap.smtp_port || "587");
    const smtpUser = settingsMap.smtp_user || "";
    const smtpPass = settingsMap.smtp_pass || "";
    const smtpFrom = settingsMap.smtp_from || smtpUser;
    const storeName = settingsMap.store_name || "Ange Spa";

    if (!smtpUser || !smtpPass) {
      // SMTP設定がない場合、パスワードは更新するが、メール送信はスキップ
      return NextResponse.json({
        success: true,
        emailSent: false,
        message: "パスワードを再発行しました。メール送信設定がないため、お店にお問い合わせください。",
        maskedEmail: maskEmail(record.login_email),
      });
    }

    // メール送信
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: { user: smtpUser, pass: smtpPass },
    });

    const displayName = record.self_name || record.name || (isTherapist ? "セラピスト" : "お客様");

    await transporter.sendMail({
      from: `"${storeName}" <${smtpFrom}>`,
      to: record.login_email,
      subject: `【${storeName}】${isTherapist ? "セラピスト" : ""}マイページ パスワード再発行のお知らせ`,
      html: `
        <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #c3a782; font-size: 18px;">🔑 パスワード再発行</h2>
          <p>${displayName} 様</p>
          <p>マイページのパスワードを再発行しました。</p>
          <div style="background: #f5f0e8; border-radius: 12px; padding: 20px; margin: 20px 0; text-align: center;">
            <p style="margin: 0 0 8px 0; font-size: 13px; color: #888;">新しいパスワード</p>
            <p style="margin: 0; font-size: 24px; font-weight: bold; letter-spacing: 3px; color: #333; font-family: monospace;">${newPassword}</p>
          </div>
          <p style="font-size: 13px; color: #666;">ログイン後、設定画面からお好みのパスワードに変更してください。</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="font-size: 11px; color: #999;">このメールに心当たりがない場合は、そのまま無視してください。</p>
          <p style="font-size: 11px; color: #999;">${storeName}</p>
        </div>
      `,
    });

    return NextResponse.json({
      success: true,
      emailSent: true,
      message: "新しいパスワードをメールで送信しました",
      maskedEmail: maskEmail(record.login_email),
    });

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "エラーが発生しました";
    console.error("Password reset error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  const masked = local.length <= 2
    ? local[0] + "***"
    : local[0] + "***" + local[local.length - 1];
  return `${masked}@${domain}`;
}
