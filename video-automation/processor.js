// video-automation/processor.js
// ── メインプロセッサー ──
// 1つのリクエストを受け取り、全ワークフローを実行

const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");
const config = require("./config");
const { downloadImage } = require("./downloader");
const { removeWatermark, renameAndCopy } = require("./ffmpeg-utils");
const { sendNotification } = require("./mailer");

/**
 * リクエスト処理のメインフロー
 */
async function processRequest(job, supabase) {
  const startTime = Date.now();
  let browser = null;

  try {
    // ── 設定をDBから取得（Web UIで変更された値を反映） ──
    const dbSettings = await loadSettings(supabase);

    // ── ブラウザ起動 ──
    console.log("🌐 ブラウザを起動中...");

    // Playwright専用プロファイル（Chromeのデフォルトとは別）
    const profileDir = config.gemini.playwrightProfilePath
      || path.join(require("os").homedir(), ".playwright-gemini-profile");

    // プロファイルディレクトリが無ければ作成
    if (!fs.existsSync(profileDir)) {
      fs.mkdirSync(profileDir, { recursive: true });
      console.log(`  📁 Playwright専用プロファイルを作成: ${profileDir}`);
      console.log("  ⚠️ 初回起動: ブラウザが開いたらGeminiにログインしてください");
      console.log("  ⚠️ ログイン後、ウォッチャーを Ctrl+C で止めて再起動してください");
    }

    browser = await chromium.launchPersistentContext(
      profileDir,
      {
        headless: false,  // Gemini操作は常にheadless: false
        slowMo: config.playwright.slowMo,
        args: [
          "--no-sandbox",
          "--disable-blink-features=AutomationControlled",
        ],
        viewport: { width: 1280, height: 900 },
        channel: "chrome",
        timeout: 60000,
      }
    );

    const page = browser.pages()[0] || await browser.newPage();

    // ── STEP 1: 画像をローカルにダウンロード ──
    console.log("📥 画像をダウンロード中...");
    const imageUrls = job.all_image_urls || [job.image_url];
    const localImages = [];
    for (let i = 0; i < imageUrls.length; i++) {
      const imgPath = path.join(config.output.desktopPath, `_vg_temp_${i}.png`);
      await downloadImage(imageUrls[i], imgPath);
      localImages.push(imgPath);
      console.log(`  ✅ 画像${i + 1}: ${path.basename(imgPath)}`);
    }

    // ── STEP 2: Geminiにアクセス ──
    console.log("🤖 Geminiにアクセス中...");
    await page.goto(dbSettings.geminiUrl || config.gemini.url, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForTimeout(3000);

    // ── STEP 3: いいねログから参考プロンプトを取得 ──
    let likedExamples = "";
    const { data: likedLogs } = await supabase
      .from("video_generation_logs")
      .select("prompt_used, motion_category")
      .eq("liked", true)
      .eq("motion_category", job.motion_category)
      .limit(3);

    if (likedLogs && likedLogs.length > 0) {
      likedExamples = "\n\n【過去に良い結果が出た参考プロンプト】\n" +
        likedLogs.map((l, i) => `参考${i + 1}: ${l.prompt_used.slice(0, 200)}...`).join("\n");
    }

    // ── STEP 4: 画像生成プロンプトを構築 ──
    let imagePrompt = (dbSettings.imagePrompt || config.defaultImagePrompt || "")
      .replace("{age}", job.therapist_age || "不明")
      .replace("{height}", job.therapist_height || "不明")
      .replace("{cup}", job.therapist_cup || "不明")
      .replace("{motionCategory}", job.motion_category)
      .replace("{likedPromptExamples}", likedExamples);

    // 「AIにお任せ」の場合、AIが自動で最適な動きを判断するプロンプトを追加
    if (job.motion_category === "AIにお任せ") {
      imagePrompt = imagePrompt.replace(
        "「AIにお任せ」を感じる自然な動きを加えた",
        "あなたが最適だと判断する、魅力的で自然な動きを加えた"
      ) + `\n\nあなたはプロの映像ディレクターです。\n添付画像の人物の衣装、ポーズ、表情、雰囲気を分析し、\nこの人物に最も似合う、魅力的で自然な動きやしぐさを\nあなた自身で考案してください。\n\n以下を考慮して最適な動きを選んでください：\n- 衣装のタイプに合った動き\n- 現在のポーズから自然に繋がる動作\n- その人物の雰囲気に最もマッチする印象\n- 見る人を惹きつける個性的なしぐさ\n\nテンプレート的な動きは避け、この画像だけの特別な動きにしてください。`;
    }

    // ── STEP 5: セーフティリトライ付き画像生成 ──
    let imageGenSuccess = false;
    let retryCount = 0;
    const maxRetries = dbSettings.maxRetries || config.retry.maxAttempts;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      retryCount = attempt;
      const adjustment = config.retry.adjustments[attempt] || "";
      const fullPrompt = imagePrompt + adjustment;

      console.log(`\n📸 画像生成 試行${attempt + 1}/${maxRetries}...`);

      try {
        // 画像をアップロード
        const uploaded = await uploadImageToGemini(page, localImages[0]);
        if (!uploaded) {
          console.log("  ⚠️ 画像アップロード失敗 → リトライ");
          continue;
        }

        // プロンプトを送信
        await typePromptInGemini(page, fullPrompt);
        await page.waitForTimeout(2000);

        // 送信ボタンをクリック
        await clickSendButton(page);

        // 生成完了を待機（最大2分）
        console.log("  ⏳ 画像生成を待機中...");
        const result = await waitForGeminiResponse(page, 120000);

        if (result === "success") {
          imageGenSuccess = true;
          console.log("  ✅ 画像生成成功！");
          break;
        } else if (result === "safety") {
          console.log("  ⚠️ セーフティフィルター → リトライ");
          // 新しいチャットを開始
          await page.goto(dbSettings.geminiUrl || config.gemini.url, { waitUntil: "domcontentloaded", timeout: 90000 });
          await page.waitForTimeout(3000);
        }
      } catch (err) {
        console.log(`  ⚠️ エラー: ${err.message}`);
      }
    }

    if (!imageGenSuccess) {
      await supabase.from("video_generation_logs").update({
        result: "safety_rejected",
        retry_count: retryCount + 1,
        prompt_used: imagePrompt,
        error_message: `${maxRetries}回のリトライ後もセーフティフィルターで拒否`,
      }).eq("id", job.id);

      await sendNotification("failed", job, dbSettings);
      cleanupTempFiles(localImages);
      return;
    }

    // ── STEP 6: 動画生成プロンプト送信 ──
    console.log("\n🎥 動画生成プロンプトを送信中...");
    const videoPrompt = dbSettings.videoPrompt || config.defaultVideoPrompt || "";
    await typePromptInGemini(page, videoPrompt);
    await clickSendButton(page);

    // VEO生成待機（最大5分）
    console.log("  ⏳ 動画生成を待機中（1〜3分）...");
    const videoResult = await waitForVideoGeneration(page, 300000);

    if (videoResult !== "success") {
      await supabase.from("video_generation_logs").update({
        result: "failed",
        retry_count: retryCount + 1,
        prompt_used: imagePrompt,
        error_message: "動画生成に失敗",
      }).eq("id", job.id);

      await sendNotification("failed", job, dbSettings);
      cleanupTempFiles(localImages);
      return;
    }

    // ── STEP 7: 動画ダウンロード ──
    console.log("📥 動画をダウンロード中...");
    const rawVideoPath = path.join(config.output.desktopPath, `_vg_raw_${job.id}.mp4`);
    await downloadVideoFromGemini(page, rawVideoPath);

    // ── STEP 8: ffmpegでウォーターマーク除去 ──
    const cropPx = dbSettings.watermarkCropPx || config.ffmpeg.watermarkCropPx;
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const finalFilename = `${job.therapist_name}_${job.motion_category}_${timestamp}.mp4`;
    const finalPath = path.join(config.output.desktopPath, finalFilename);

    console.log("✂️ ウォーターマーク除去中...");
    await removeWatermark(rawVideoPath, finalPath, cropPx);

    // ── STEP 9: Googleドライブにコピー ──
    if (dbSettings.autoSaveGdrive) {
      const gdriveDest = path.join(
        config.output.gdrivePath || dbSettings.gdriveFolder,
        finalFilename
      );
      await renameAndCopy(finalPath, gdriveDest);
      console.log(`📁 GDriveにコピー: ${gdriveDest}`);
    }

    // ── STEP 10: Supabase更新 ──
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    await supabase.from("video_generation_logs").update({
      result: "success",
      retry_count: retryCount,
      prompt_used: imagePrompt,
      video_filename: finalFilename,
      gdrive_path: dbSettings.gdriveFolder || config.output.gdrivePath,
    }).eq("id", job.id);

    console.log(`\n🎉 完了！ ${finalFilename} (${elapsed}秒)`);

    // ── STEP 11: 成功メール通知 ──
    await sendNotification("success", { ...job, video_filename: finalFilename }, dbSettings);

    // 一時ファイル削除
    cleanupTempFiles([...localImages, rawVideoPath]);

  } catch (err) {
    console.error("❌ 致命的エラー:", err);
    await supabase.from("video_generation_logs").update({
      result: "failed",
      error_message: err.message,
    }).eq("id", job.id);
    throw err;
  } finally {
    if (browser) {
      try { await browser.close(); } catch { /* ignore */ }
    }
  }
}

// ═══════════════════════════════════════════
// Gemini操作ヘルパー関数
// ※ GeminiのDOM構造は変更される可能性あり
// ※ セレクタが変わった場合はここだけ修正
// ═══════════════════════════════════════════

/** 画像をGeminiにアップロード */
async function uploadImageToGemini(page, imagePath) {
  try {
    // ファイル入力を探す（hidden input[type=file]）
    const fileInput = await page.$('input[type="file"]');
    if (fileInput) {
      await fileInput.setInputFiles(imagePath);
      await page.waitForTimeout(3000);
      console.log("  📎 setInputFiles() で画像アップロード成功");
      return true;
    }

    // 添付ボタンをクリックしてファイルダイアログを開く
    const attachBtn = await page.$('[aria-label*="添付"], [aria-label*="Attach"], [data-tooltip*="ファイル"]');
    if (attachBtn) {
      const [fileChooser] = await Promise.all([
        page.waitForEvent("filechooser", { timeout: 5000 }),
        attachBtn.click(),
      ]);
      await fileChooser.setFiles(imagePath);
      await page.waitForTimeout(3000);
      console.log("  📎 filechooser で画像アップロード成功");
      return true;
    }

    console.log("  ⚠️ ファイルアップロード要素が見つかりません");
    return false;
  } catch (err) {
    console.log(`  ⚠️ アップロードエラー: ${err.message}`);
    return false;
  }
}

/** Geminiのテキストエリアにプロンプトを入力 */
async function typePromptInGemini(page, prompt) {
  // テキスト入力エリアを探す
  const selectors = [
    '.ql-editor[contenteditable="true"]',
    '[contenteditable="true"][role="textbox"]',
    'rich-textarea [contenteditable="true"]',
    'textarea',
    '[aria-label*="プロンプト"]',
    '[aria-label*="prompt"]',
  ];

  for (const sel of selectors) {
    const el = await page.$(sel);
    if (el) {
      await el.click();
      await page.waitForTimeout(300);
      // 既存テキストをクリア
      await page.keyboard.press("Control+a");
      await page.keyboard.press("Backspace");
      await page.waitForTimeout(200);
      // テキストを入力
      await el.fill(prompt);
      await page.waitForTimeout(500);
      return;
    }
  }
  throw new Error("テキスト入力エリアが見つかりません");
}

/** 送信ボタンをクリック */
async function clickSendButton(page) {
  const selectors = [
    '[aria-label*="送信"], [aria-label*="Send"]',
    'button[data-tooltip*="送信"]',
    '.send-button',
    'button:has(svg path[d*="M2 21l21-9L2 3"])',  // 紙飛行機アイコン
  ];

  for (const sel of selectors) {
    const btn = await page.$(sel);
    if (btn) {
      await btn.click();
      await page.waitForTimeout(1000);
      return;
    }
  }

  // フォールバック: Enterキー
  await page.keyboard.press("Enter");
  await page.waitForTimeout(1000);
}

/** Geminiのレスポンスを待機 */
async function waitForGeminiResponse(page, timeout) {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    await page.waitForTimeout(5000);

    // セーフティフィルター検出
    const safetyTexts = ["安全性", "ポリシー", "生成できません", "I can't", "safety", "policy"];
    const pageText = await page.textContent("body");
    for (const st of safetyTexts) {
      if (pageText && pageText.includes(st)) {
        return "safety";
      }
    }

    // 画像生成完了を検出（新しい画像が表示されたか）
    const images = await page.$$('img[src*="blob:"], img[src*="data:image"], img[src*="generated"]');
    if (images.length > 0) {
      return "success";
    }

    // レスポンスの「完了」を検出
    const responseComplete = await page.$('.response-complete, [data-complete="true"]');
    if (responseComplete) {
      return "success";
    }
  }

  return "timeout";
}

/** 動画生成の完了を待機 */
async function waitForVideoGeneration(page, timeout) {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    await page.waitForTimeout(10000);  // 10秒ごとにチェック

    // 動画プレーヤーの出現を検出
    const videoEl = await page.$("video, [data-video-id]");
    if (videoEl) {
      await page.waitForTimeout(3000);  // 動画の読み込み完了を待つ
      return "success";
    }

    // エラー検出
    const pageText = await page.textContent("body");
    if (pageText && (pageText.includes("生成できません") || pageText.includes("エラー"))) {
      return "failed";
    }
  }

  return "timeout";
}

/** Geminiから動画をダウンロード */
async function downloadVideoFromGemini(page, savePath) {
  // ダウンロードイベントを監視
  const downloadPromise = page.waitForEvent("download", { timeout: 30000 });

  // ダウンロードボタンを探してクリック
  const dlSelectors = [
    '[aria-label*="ダウンロード"], [aria-label*="Download"]',
    'button:has(svg path[d*="M19 9h-4V3H9v6H5l7 7"])',  // ダウンロードアイコン
    '[data-tooltip*="ダウンロード"]',
  ];

  let clicked = false;
  for (const sel of dlSelectors) {
    const btn = await page.$(sel);
    if (btn) {
      await btn.click();
      clicked = true;
      break;
    }
  }

  if (!clicked) {
    // 動画要素を右クリック → 保存
    const video = await page.$("video");
    if (video) {
      const src = await video.getAttribute("src");
      if (src) {
        const response = await page.request.get(src);
        const buffer = await response.body();
        fs.writeFileSync(savePath, buffer);
        console.log("  📥 video src から直接ダウンロード");
        return;
      }
    }
    throw new Error("ダウンロードボタンが見つかりません");
  }

  const download = await downloadPromise;
  await download.saveAs(savePath);
  console.log(`  📥 ダウンロード完了: ${path.basename(savePath)}`);
}

// ═══════════════════════════════════════════
// ユーティリティ
// ═══════════════════════════════════════════

/** DB設定を読み込み */
async function loadSettings(supabase) {
  const { data } = await supabase
    .from("store_settings")
    .select("key, value")
    .like("key", "vg_%");

  const s = {};
  if (data) {
    data.forEach(row => {
      const k = row.key.replace("vg_", "");
      if (k === "image_prompt") s.imagePrompt = row.value;
      else if (k === "video_prompt") s.videoPrompt = row.value;
      else if (k === "notify_email") s.notifyEmail = row.value;
      else if (k === "gdrive_folder") s.gdriveFolder = row.value;
      else if (k === "max_retries") s.maxRetries = parseInt(row.value) || 3;
      else if (k === "watermark_crop_px") s.watermarkCropPx = parseInt(row.value) || 100;
      else if (k === "gemini_url") s.geminiUrl = row.value;
      else if (k === "headless") s.headless = row.value === "true";
      else if (k === "auto_save_gdrive") s.autoSaveGdrive = row.value !== "false";
    });
  }
  return s;
}

/** 一時ファイルの削除 */
function cleanupTempFiles(files) {
  for (const f of files) {
    try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch { /* ignore */ }
  }
}

module.exports = { processRequest };
