// video-automation/watcher.js
// ── Supabaseポーリング型ウォッチャー ──
// 日次制限（2回/日）を管理し、キューから順番に処理

require("dotenv").config();  // ← 最初に読み込む！

const { createClient } = require("@supabase/supabase-js");
const config = require("./config");
const { processRequest } = require("./processor");

const supabase = createClient(
  config.supabase.url,
  process.env.SUPABASE_ANON_KEY || config.supabase.anonKey
);

const DAILY_LIMIT = 2;
let processing = false;
let lastRandomDate = ""; // ランダム生成を1日1回だけにする

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

/** ランダム自動生成（設定ONの場合、1日1回だけ実行） */
async function tryRandomAutoGenerate(slotsLeft) {
  const todayStr = getTodayStr();
  if (lastRandomDate === todayStr) return; // 今日は既に実行済み

  // 設定を確認
  const { data: setting } = await supabase
    .from("store_settings")
    .select("value")
    .eq("key", "vg_random_auto")
    .single();

  if (!setting || setting.value !== "true") return;

  console.log("🎲 ランダム自動生成を実行中...");
  lastRandomDate = todayStr;

  try {
    // HPからセラピスト一覧を取得
    const https = require("https");
    const html = await new Promise((resolve, reject) => {
      https.get("https://ange-spa.com/staff.php", {
        headers: { "User-Agent": "Mozilla/5.0" }
      }, (res) => {
        let data = "";
        res.on("data", chunk => data += chunk);
        res.on("end", () => resolve(data));
      }).on("error", reject);
    });

    // <li>ブロックからセラピスト情報を抽出
    const blocks = html.split(/<li[^>]*>/i).slice(1);
    const therapists = [];

    for (const block of blocks) {
      const sidMatch = block.match(/profile\.php\?sid=(\d+)/);
      if (!sidMatch) continue;

      const nameMatch = block.match(/<img[^>]*alt="([^"]+)"[^>]*src="[^"]*images_staff/i)
        || block.match(/<img[^>]*alt="([^"]+)"/i);
      const imgMatch = block.match(/src="((?:https?:\/\/ange-spa\.com\/)?images_staff\/[^"]+)"/i);
      const textContent = block.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
      const ageMatch = textContent.match(/(\d+)\s*歳/);
      const heightMatch = textContent.match(/(\d{2,3})\s*cm/i);
      const cupMatch = textContent.match(/([A-K])\s*cup/i);

      const name = nameMatch ? nameMatch[1].trim() : "";
      let imageUrl = imgMatch ? imgMatch[1] : "";
      if (imageUrl && !imageUrl.startsWith("http")) imageUrl = `https://ange-spa.com/${imageUrl}`;

      if (name && sidMatch[1]) {
        therapists.push({
          sid: sidMatch[1], name, imageUrl,
          age: ageMatch ? ageMatch[1] : "",
          height: heightMatch ? heightMatch[1] : "",
          cup: cupMatch ? cupMatch[1].toUpperCase() : "",
        });
      }
    }

    if (therapists.length === 0) {
      console.log("  ⚠️ セラピストが取得できませんでした");
      return;
    }

    // 過去に生成済みのセラピストを避ける（直近7日）
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const { data: recentLogs } = await supabase
      .from("video_generation_logs")
      .select("therapist_sid")
      .gte("created_at", weekAgo)
      .in("result", ["success", "queued", "pending", "processing"]);

    const recentSids = new Set((recentLogs || []).map(l => l.therapist_sid));
    const candidates = therapists.filter(t => !recentSids.has(t.sid));
    const pool = candidates.length > 0 ? candidates : therapists;

    // ランダムに選択（枠数分）
    const count = Math.min(slotsLeft, pool.length, DAILY_LIMIT);
    const shuffled = pool.sort(() => Math.random() - 0.5);
    const picked = shuffled.slice(0, count);

    const motions = ["AIにお任せ", "親しみやすさ", "リラックス感", "上品さ", "華やかさ"];

    const requests = picked.map(th => ({
      therapist_name: th.name,
      therapist_sid: th.sid,
      therapist_age: th.age,
      therapist_height: th.height,
      therapist_cup: th.cup,
      image_url: th.imageUrl,
      all_image_urls: [th.imageUrl],
      motion_category: motions[Math.floor(Math.random() * motions.length)],
      prompt_used: "",
      result: "queued",
      retry_count: 0,
      liked: false,
      video_filename: "",
      gdrive_path: "",
    }));

    const { error } = await supabase.from("video_generation_logs").insert(requests);
    if (error) {
      console.log(`  ❌ ランダム生成エラー: ${error.message}`);
    } else {
      console.log(`  🎲 ${picked.length}件をランダム追加: ${picked.map(t => t.name).join(", ")}`);
    }
  } catch (err) {
    console.log(`  ❌ ランダム生成エラー: ${err.message}`);
  }
}

async function checkAndProcess() {
  if (processing) return;

  try {
    // 1. 今日の残り枠を確認
    const todayDone = await getTodayCount();
    const slotsLeft = DAILY_LIMIT - todayDone;

    if (slotsLeft <= 0) return;

    // 2. キューに何もなければランダム自動生成を検討
    const { data: existingQueue } = await supabase
      .from("video_generation_logs")
      .select("id")
      .in("result", ["queued", "pending", "processing"])
      .limit(1);

    if ((!existingQueue || existingQueue.length === 0) && slotsLeft > 0) {
      await tryRandomAutoGenerate(slotsLeft);
    }

    // 3. "queued" → "pending" に昇格（枠分だけ）
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

    // 4. "pending" を1件取得して処理
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
