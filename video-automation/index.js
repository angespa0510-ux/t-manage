// video-automation/index.js
// ── 手動実行用エントリーポイント ──
// 特定のリクエストIDを指定して1件だけ処理

require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");
const config = require("./config");
const { processRequest } = require("./processor");

const supabase = createClient(
  config.supabase.url,
  process.env.SUPABASE_ANON_KEY || config.supabase.anonKey
);

async function main() {
  const requestId = process.argv[2];

  if (!requestId) {
    console.log("使い方: node index.js <リクエストID>");
    console.log("例: node index.js 1");
    console.log("");
    console.log("自動監視モードは: npm run watch");
    return;
  }

  const { data: job, error } = await supabase
    .from("video_generation_logs")
    .select("*")
    .eq("id", parseInt(requestId))
    .single();

  if (error || !job) {
    console.error("リクエストが見つかりません:", requestId);
    return;
  }

  console.log(`🎬 リクエスト #${job.id}: ${job.therapist_name} (${job.motion_category})`);

  await supabase
    .from("video_generation_logs")
    .update({ result: "processing" })
    .eq("id", job.id);

  try {
    await processRequest(job, supabase);
  } catch (err) {
    console.error("❌ エラー:", err.message);
    await supabase
      .from("video_generation_logs")
      .update({ result: "failed", error_message: err.message })
      .eq("id", job.id);
  }
}

main();
