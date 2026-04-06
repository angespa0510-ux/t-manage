// video-automation/watcher.js
// ── Supabaseポーリング型ウォッチャー ──
// pending状態のリクエストを検出して自動実行

const { createClient } = require("@supabase/supabase-js");
const config = require("./config");
const { processRequest } = require("./processor");

// .env 読み込み
require("dotenv").config();

const supabase = createClient(
  config.supabase.url,
  process.env.SUPABASE_ANON_KEY || config.supabase.anonKey
);

let processing = false;

async function checkForPending() {
  if (processing) return;

  try {
    const { data: pending } = await supabase
      .from("video_generation_logs")
      .select("*")
      .eq("result", "pending")
      .order("created_at", { ascending: true })
      .limit(1);

    if (pending && pending.length > 0) {
      const job = pending[0];
      processing = true;
      console.log(`\n${"═".repeat(50)}`);
      console.log(`🎬 新規リクエスト検出: #${job.id} ${job.therapist_name}`);
      console.log(`   印象: ${job.motion_category}`);
      console.log(`${"═".repeat(50)}`);

      // ステータスを processing に更新
      await supabase
        .from("video_generation_logs")
        .update({ result: "processing" })
        .eq("id", job.id);

      try {
        await processRequest(job, supabase);
      } catch (err) {
        console.error("❌ 処理エラー:", err.message);
        await supabase
          .from("video_generation_logs")
          .update({ result: "failed", error_message: err.message })
          .eq("id", job.id);
      }

      processing = false;
    }
  } catch (err) {
    console.error("ポーリングエラー:", err.message);
  }
}

// ── メインループ ──
console.log("╔══════════════════════════════════════╗");
console.log("║  T-MANAGE AI動画生成 ウォッチャー    ║");
console.log("╚══════════════════════════════════════╝");
console.log(`⏱️  ポーリング間隔: ${config.watcher.pollIntervalMs / 1000}秒`);
console.log(`📁 保存先: ${config.output.desktopPath}`);
console.log(`📁 GDrive: ${config.output.gdrivePath}`);
console.log("⏳ 新規リクエストを待機中...\n");

// 初回即実行
checkForPending();

// 定期ポーリング
setInterval(checkForPending, config.watcher.pollIntervalMs);

// 終了ハンドリング
process.on("SIGINT", () => {
  console.log("\n👋 ウォッチャーを停止します");
  process.exit(0);
});
