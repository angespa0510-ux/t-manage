// video-automation/test-mail.js
// メール送信テスト — node test-mail.js で実行
require("dotenv").config();
const nodemailer = require("nodemailer");
const config = require("./config");

async function testMail() {
  const user = process.env.GMAIL_USER || config.mail.auth.user;
  const pass = process.env.GMAIL_APP_PASS || config.mail.auth.pass;

  console.log("📧 メール送信テスト");
  console.log(`  送信元: ${user || "(未設定)"}`);
  console.log(`  パスワード: ${pass ? "✅ 設定済み(" + pass.length + "文字)" : "❌ 未設定"}`);

  if (!user || !pass) {
    console.log("\n❌ .env に GMAIL_USER と GMAIL_APP_PASS を設定してください");
    return;
  }

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: { user, pass },
  });

  try {
    const now = new Date();
    const dateStr = `${now.getFullYear()}/${String(now.getMonth()+1).padStart(2,"0")}/${String(now.getDate()).padStart(2,"0")} ${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;
    const driveUrl = "https://drive.google.com/drive/my-drive";

    await transporter.sendMail({
      from: user,
      to: user,
      subject: "✅ 動画生成完了 - テストセラピスト（テスト送信）",
      text: [
        `動画生成が完了しました。`,
        ``,
        `━━━━━━━━━━━━━━━━━━━━`,
        `📅 生成日時: ${dateStr}`,
        `💆 セラピスト: テストセラピスト`,
        `🎬 動きの印象: AIにお任せ`,
        `📁 ファイル名: テスト_AIにお任せ_${now.toISOString().slice(0,19).replace(/:/g,"-")}.mp4`,
        `━━━━━━━━━━━━━━━━━━━━`,
        ``,
        `📂 Googleドライブで確認:`,
        `${driveUrl}`,
        `（フォルダ「AI動画生成」内）`,
        ``,
        `※ Googleドライブへのアップロード直後はファイルが反映されるまで`,
        `  数分かかる場合があります。表示されない場合は少し時間をおいてから`,
        `  再度ご確認ください。`,
        ``,
        `— T-MANAGE AI動画生成システム`,
      ].join("\n"),
    });
    console.log("\n🎉 送信成功！ 受信トレイを確認してください");
  } catch (err) {
    console.log(`\n❌ 送信失敗: ${err.message}`);
    if (err.message.includes("Username and Password not accepted")) {
      console.log("\n💡 アプリパスワードが正しくない可能性があります:");
      console.log("  1. https://myaccount.google.com/apppasswords で新しく作成");
      console.log("  2. .env の GMAIL_APP_PASS をスペースなしで更新");
      console.log("  3. 2段階認証が有効か確認");
    }
  }
}

testMail();
