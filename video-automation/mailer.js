// video-automation/mailer.js
const nodemailer = require("nodemailer");
const config = require("./config");

/**
 * 生成結果をメールで通知
 * @param {"success"|"failed"} status
 * @param {object} job - video_generation_logs レコード
 * @param {object} dbSettings - DB設定
 */
async function sendNotification(status, job, dbSettings = {}) {
  const toEmail = dbSettings.notifyEmail || config.mail.notifyTo;
  if (!toEmail) {
    console.log("  📧 通知メール: 送信先未設定 → スキップ");
    return;
  }

  const gmailUser = process.env.GMAIL_USER || config.mail.auth.user;
  const gmailPass = process.env.GMAIL_APP_PASS || config.mail.auth.pass;
  if (!gmailUser || !gmailPass) {
    console.log("  📧 通知メール: Gmail認証情報未設定 → スキップ");
    return;
  }

  const transporter = nodemailer.createTransport({
    host: config.mail.host,
    port: config.mail.port,
    secure: config.mail.secure,
    auth: { user: gmailUser, pass: gmailPass },
  });

  let subject, body;
  const now = new Date();
  const dateStr = `${now.getFullYear()}/${String(now.getMonth()+1).padStart(2,"0")}/${String(now.getDate()).padStart(2,"0")} ${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;
  const driveUrl = dbSettings.gdriveFolderUrl || "https://drive.google.com/drive/my-drive";
  const driveFolderName = dbSettings.gdriveFolder || "AI動画生成";

  if (status === "success") {
    subject = `✅ 動画生成完了 - ${job.therapist_name}`;
    body = [
      `動画生成が完了しました。`,
      ``,
      `━━━━━━━━━━━━━━━━━━━━`,
      `📅 生成日時: ${dateStr}`,
      `💆 セラピスト: ${job.therapist_name}`,
      `🎬 動きの印象: ${job.motion_category}`,
      `📁 ファイル名: ${job.video_filename || "(不明)"}`,
      `━━━━━━━━━━━━━━━━━━━━`,
      ``,
      `📂 Googleドライブで確認:`,
      `${driveUrl}`,
      `（フォルダ「${driveFolderName}」内）`,
      ``,
      `※ Googleドライブへのアップロード直後はファイルが反映されるまで`,
      `  数分かかる場合があります。表示されない場合は少し時間をおいてから`,
      `  再度ご確認ください。`,
      ``,
      `— T-MANAGE AI動画生成システム`,
    ].join("\n");
  } else {
    subject = `❌ 動画生成失敗 - ${job.therapist_name}`;
    body = [
      `動画生成に失敗しました。`,
      ``,
      `━━━━━━━━━━━━━━━━━━━━`,
      `📅 日時: ${dateStr}`,
      `💆 セラピスト: ${job.therapist_name}`,
      `🎬 動きの印象: ${job.motion_category}`,
      `❌ 失敗理由: ${job.error_message || "セーフティフィルターで拒否 or タイムアウト"}`,
      `🔄 リトライ回数: ${job.retry_count || 0}回`,
      `━━━━━━━━━━━━━━━━━━━━`,
      ``,
      `T-MANAGEの生成履歴ページで詳細を確認できます。`,
      ``,
      `— T-MANAGE AI動画生成システム`,
    ].join("\n");
  }

  try {
    await transporter.sendMail({
      from: gmailUser,
      to: toEmail,
      subject,
      text: body,
    });
    console.log(`  📧 通知メール送信: ${toEmail}`);
  } catch (err) {
    console.error(`  ❌ メール送信エラー: ${err.message}`);
  }
}

module.exports = { sendNotification };
