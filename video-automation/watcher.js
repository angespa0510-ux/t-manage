// video-automation/watcher.js
// ── Supabaseポーリング型ウォッチャー ──
// 日次制限（2回/日）を管理し、キューから順番に処理

const { createClient } = require("@supabase/supabase-js");
const config = require("./config");
const { processRequest } = require("./processor");

require("dotenv").config();

const supabase = createClient(
  config.supabase.url,
  process.env.SUPABASE_ANON_KEY || config.supabase.anonKey
);

const DAILY_LIMIT = 2;
let processing = false;

/** 今日の日付文字列（JST, 0-5時は前日扱い） */
function getTodayStr() {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60000);
  if (jst.getUTCHours() < 6) jst.setUTCDate(jst.getUTCDate() - 1);
  return jst.toISOString().slice(0, 10);
}

/** 今日の処理済み件数を取得 */
async function getTodayCount() {
  const todayStr = getTodayStr();
  const { data } = await supabase
    .from("video_generation_logs")
    .select("id")
    .in("result", ["success", "processing"])
    .gte("created_at", `${todayStr}T00:00:00+09:00`)
    .lt("created_at", `${todayStr}T23:59:59+09:00`);
  return data?.length || 0;
}

async function checkAndProcess() {
  if (processing) return;

  try {
    // 1. 今日の残り枠を確認
    const todayDone = await getTodayCount();
    const slotsLeft = DAILY_LIMIT - todayDone;

    if (slotsLeft <= 0) {
      // 日次制限に達している → 何もしない
      return;
    }

    // 2. "queued" → "pending" に昇格（枠分だけ）
    const { data: queued } = await supabase
      .from("video_generation_logs")
      .select("id")
      .eq("result", "queued")
      .order("created_at", { ascending: true })
      .limit(slotsLeft);

    if (queued && queued.length > 0) {
      for (const q of queued) {
        await supabase
          .from("video_generation_logs")
          .update({ result: "pending" })
          .eq("id", q.id);
      }
      console.log(`📋 ${queued.length}件をキューから準備中に昇格`);
    }

    // 3. "pending" を1件取得して処理
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
      console.log(`🎬 処理開始: #${job.id} ${job.therapist_name}`);
      console.log(`   印象: ${job.motion_category}`);
      console.log(`   本日: ${todayDone + 1}/${DAILY_LIMIT}`);
      console.log(`${"═".repeat(50)}`);

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
console.log("╔══════════════════════════════════════════╗");
console.log("║  T-MANAGE AI動画生成 ウォッチャー v2     ║");
console.log("╚══════════════════════════════════════════╝");
console.log(`⏱️  ポーリング: ${config.watcher.pollIntervalMs / 1000}秒`);
console.log(`🔢 日次制限: ${DAILY_LIMIT}回/日`);
console.log(`📁 保存先: ${config.output.desktopPath}`);
console.log(`📁 GDrive: ${config.output.gdrivePath}`);
console.log("⏳ キューを監視中...\n");

checkAndProcess();
setInterval(checkAndProcess, config.watcher.pollIntervalMs);

process.on("SIGINT", () => {
  console.log("\n👋 ウォッチャーを停止します");
  process.exit(0);
});
