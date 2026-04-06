// video-automation/login.js
// ── Geminiログイン用ヘルパー ──
// ブラウザを開いてGeminiにログインしてもらう

require("dotenv").config();
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");
const os = require("os");

async function main() {
  const profileDir = process.env.PLAYWRIGHT_PROFILE_PATH
    || path.join(os.homedir(), ".playwright-gemini-profile");

  if (!fs.existsSync(profileDir)) {
    fs.mkdirSync(profileDir, { recursive: true });
  }

  console.log("🌐 ブラウザを起動中...");
  console.log(`📁 プロファイル: ${profileDir}`);

  const browser = await chromium.launchPersistentContext(profileDir, {
    headless: false,
    args: ["--no-sandbox", "--disable-blink-features=AutomationControlled"],
    viewport: { width: 1280, height: 900 },
    channel: "chrome",
  });

  const page = browser.pages()[0] || await browser.newPage();
  await page.goto("https://gemini.google.com/app", { waitUntil: "networkidle", timeout: 30000 });

  console.log("");
  console.log("═══════════════════════════════════════════");
  console.log("  ブラウザが開きました！");
  console.log("  → Googleアカウントでログインしてください");
  console.log("  → Geminiのチャット画面が表示されたらOK");
  console.log("  → ログイン完了後、ここでEnterキーを押してください");
  console.log("═══════════════════════════════════════════");

  // ユーザーがEnterを押すまで待機
  await new Promise(resolve => {
    process.stdin.once("data", resolve);
  });

  console.log("✅ ログイン状態を保存しました！");
  console.log("   次回からウォッチャー(npm run watch)で自動ログインされます。");

  await browser.close();
}

main().catch(err => {
  console.error("エラー:", err.message);
  process.exit(1);
});
