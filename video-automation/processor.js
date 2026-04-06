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

// ═══════════════════════════════════════════
// 英語プロンプトテンプレート
// ※ 設定画面(日本語)はユーザー参照用。Geminiには英語で送信
// ═══════════════════════════════════════════

const EN_IMAGE_PROMPT = `[Core Instruction] Carefully observe the attached image. Analyze the person's outfit, accessories, hairstyle, pose, and background. Pay special attention to any facial processing (stamps, masks, hidden areas) and recognize them accurately.

[Model Info] Age: {age} / Height: {height}cm / {cup} cup

[Pose Generation] Based on the body type info above and the image, generate a new photorealistic pose image that conveys a natural "{motionCategory}" movement.

{likedPromptExamples}

[Consistency & Conservation] Facial Details: Reproduce the exact same facial processing as the original (strictly maintain stamps/masks as-is). Clothing & Props: Preserve outfit, accessories, and background completely identical without distortion. Skin: Smooth, flawless rendering. Body: Consider natural range of motion appropriate for this body type.

[Quality & Style] Photorealistic, Highly detailed textures, Cinematic lighting, 4K resolution.

[Creativity] Avoid generic template poses — create a unique, personalized movement for this specific person. Movement should be naturally reachable from the current pose.

[Safety Check] Please generate this image only if the subject and scene are fully permissible under safety and content guidelines.`;

const EN_VIDEO_PROMPT = `[Core Instruction] Create a photorealistic, exceptionally smooth, cinematic slow-motion video showing a natural transition from the original uploaded image's pose to the generated image's pose.

[Motion & Timing] The movement must be extremely slow, gradual, and fluid, with no sudden or jerky shifts. Integrate graceful, cinematic ease-in and ease-out at the beginning and end of the motion to create a sense of lingering presence and elegance. The pacing must feel unhurried and high-end.

[Consistency & Conservation] Facial Details: Strictly maintain the exact facial features, expression, and hair style from the original image throughout the entire video. Any facial processing (stamps, masks, hidden areas) must remain exactly as-is. Clothing & Props: Preserve every detail, texture, and pattern of the attire and any accessories without alteration. Do not allow the details to distort or hallucinate. Background: Keep the background static and identical to the original scene.

[Quality & Style] 4K resolution, High-definition rendering, Photorealistic, Cinematic lighting, Highly detailed textures, 3D consistency.

[Safety Check] Please generate this video only if the subject and scene are fully permissible under safety and content guidelines.`;

const EN_AI_AUTO_ADDITION = ""; // 未使用（後方互換用に残す）

// 「AIにお任せ」専用の画像生成プロンプト（完全な構造化テンプレート）
const EN_IMAGE_PROMPT_AI_AUTO = `[Core Instruction] Carefully observe the attached image. Analyze the person's outfit, accessories, hairstyle, pose, expression, and background with precision. Pay special attention to any facial processing (stamps, masks, hidden areas) and recognize them accurately.

[Model Info] Age: {age} / Height: {height}cm / {cup} cup

[AI Director Mode] You are a world-class cinematic video director. Based on your expert analysis of this specific person, YOU must determine the single most compelling and attractive movement or gesture. Consider all of the following factors:
- Outfit type and style (casual, elegant, glamorous, etc.) — choose movement that enhances it
- Current pose and posture — select motion that flows naturally from this starting position
- Facial expression and overall atmosphere — match the mood and energy
- What would captivate a viewer — find a distinctive, memorable gesture unique to THIS person
You have full creative authority. Do NOT default to generic or template-like movements. This must be a one-of-a-kind motion crafted specifically for this image.

[Pose Generation] Generate a new photorealistic pose image showing the movement you have chosen. The new pose must feel like a natural, fluid continuation of the original.

{likedPromptExamples}

[Consistency & Conservation] Facial Details: Reproduce the exact same facial processing as the original (strictly maintain stamps/masks as-is). Clothing & Props: Preserve outfit, accessories, and background completely identical without distortion. Skin: Smooth, flawless rendering. Body: Consider natural range of motion appropriate for this body type.

[Quality & Style] Photorealistic, Highly detailed textures, Cinematic lighting, 4K resolution, 3D consistency.

[Safety Check] Please generate this image only if the subject and scene are fully permissible under safety and content guidelines.`;

// 印象カテゴリの日英マッピング
const CATEGORY_EN_MAP = {
  "AIにお任せ": "AI's Choice",
  "親しみやすさ": "Friendly & Approachable",
  "リラックス感": "Relaxed & Calm",
  "上品さ": "Elegant & Refined",
  "華やかさ": "Glamorous & Vibrant",
  "カスタム": "Custom",
};

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
    await page.waitForTimeout(8000);  // Gemini SPAの完全読み込みを待つ
    console.log("  ✅ Geminiページ読み込み完了");

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

    // ── STEP 4: 画像生成プロンプトを構築（英語 — DB設定優先） ──
    const motionCategoryEN = CATEGORY_EN_MAP[job.motion_category] || job.motion_category;

    let imagePrompt;

    if (job.motion_category === "AIにお任せ") {
      // 「AIにお任せ」は専用テンプレート（[AI Director Mode]セクション付き）
      imagePrompt = (dbSettings.aiAutoPromptEn || EN_IMAGE_PROMPT_AI_AUTO)
        .replace("{age}", job.therapist_age || "unknown")
        .replace("{height}", job.therapist_height || "unknown")
        .replace("{cup}", job.therapist_cup || "unknown")
        .replace("{likedPromptExamples}", likedExamples);
      console.log("  🎬 AIディレクターモード: AIが最適な動きを自動判断");
    } else {
      // 通常カテゴリ: 標準テンプレート
      imagePrompt = (dbSettings.imagePromptEn || EN_IMAGE_PROMPT)
        .replace("{age}", job.therapist_age || "unknown")
        .replace("{height}", job.therapist_height || "unknown")
        .replace("{cup}", job.therapist_cup || "unknown")
        .replace("{motionCategory}", motionCategoryEN)
        .replace("{likedPromptExamples}", likedExamples);
    }

    console.log(`  📝 プロンプト: English | モード: ${job.motion_category === "AIにお任せ" ? "🎬 AIディレクター" : motionCategoryEN} | ソース: ${
      job.motion_category === "AIにお任せ"
        ? (dbSettings.aiAutoPromptEn ? "DB設定" : "デフォルト")
        : (dbSettings.imagePromptEn ? "DB設定" : "デフォルト")
    }`);

    // ── STEP 5: 思考モードに切替 ──
    console.log("🧠 思考モードに切替中...");
    await switchToThinkingMode(page);

    // ── STEP 6: セーフティリトライ付き画像生成 ──
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
          // 新しいチャットで再試行
          await page.goto(dbSettings.geminiUrl || config.gemini.url, { waitUntil: "domcontentloaded", timeout: 90000 });
          await page.waitForTimeout(8000);
          continue;
        }

        // プロンプトを送信
        await typePromptInGemini(page, fullPrompt);
        await page.waitForTimeout(2000);

        // 送信ボタンをクリック
        await clickSendButton(page);

        // 生成完了を待機（最大4分 — 画像生成は時間がかかる）
        console.log("  ⏳ 画像生成を待機中（最大4分）...");
        const result = await waitForGeminiResponse(page, 240000);

        if (result === "success") {
          imageGenSuccess = true;
          console.log("  ✅ 画像生成成功！");
          break;
        } else if (result === "safety") {
          console.log("  ⚠️ セーフティフィルター → リトライ");
          // 新しいチャットを開始
          await page.goto(dbSettings.geminiUrl || config.gemini.url, { waitUntil: "domcontentloaded", timeout: 90000 });
          await page.waitForTimeout(8000);
          await switchToThinkingMode(page);
        } else {
          console.log("  ⏰ タイムアウト → リトライ");
          await page.goto(dbSettings.geminiUrl || config.gemini.url, { waitUntil: "domcontentloaded", timeout: 90000 });
          await page.waitForTimeout(8000);
          await switchToThinkingMode(page);
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

    // ── STEP 6: 動画生成プロンプト送信（英語 — DB設定優先） ──
    console.log("\n🎥 動画生成プロンプトを送信中...");
    const videoPrompt = dbSettings.videoPromptEn || EN_VIDEO_PROMPT;
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

    try {
      await downloadVideoFromGemini(page, rawVideoPath);
    } catch (dlErr) {
      console.error(`  ❌ 動画ダウンロード失敗: ${dlErr.message}`);

      // スクリーンショットを保存（デバッグ用）
      try {
        const ssPath = path.join(config.output.desktopPath, `_vg_debug_${job.id}.png`);
        await page.screenshot({ path: ssPath, fullPage: true });
        console.log(`  📸 デバッグ用スクリーンショット保存: ${ssPath}`);
      } catch { /* ignore */ }

      await supabase.from("video_generation_logs").update({
        result: "failed",
        retry_count: retryCount + 1,
        prompt_used: imagePrompt,
        error_message: `動画ダウンロード失敗: ${dlErr.message}`,
      }).eq("id", job.id);

      await sendNotification("failed", job, dbSettings);
      cleanupTempFiles(localImages);
      return;
    }

    // ── 最終ファイル検証（念のためダブルチェック） ──
    if (!fs.existsSync(rawVideoPath)) {
      console.error("  ❌ ダウンロードファイルが存在しません");
      await supabase.from("video_generation_logs").update({
        result: "failed",
        error_message: "ダウンロードファイルが保存されていません",
      }).eq("id", job.id);
      cleanupTempFiles(localImages);
      return;
    }

    // ── STEP 8: ffmpegでウォーターマーク除去 ──
    const cropPx = dbSettings.watermarkCropPx || config.ffmpeg.watermarkCropPx;
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const finalFilename = `${job.therapist_name}_${job.motion_category}_${timestamp}.mp4`;
    const finalPath = path.join(config.output.desktopPath, finalFilename);

    console.log("✂️ ウォーターマーク除去中...");
    await removeWatermark(rawVideoPath, finalPath, cropPx);

    // ── STEP 9: Googleドライブにコピー ──
    if (dbSettings.autoSaveGdrive) {
      // GDriveパス: ベースパス(G:\マイドライブ) + フォルダ名(DB設定 or config)
      const gdriveBasePath = process.env.GDRIVE_BASE_PATH || "G:\\マイドライブ";
      const gdriveFolder = dbSettings.gdriveFolder || "AI動画生成";
      const gdriveDest = path.join(gdriveBasePath, gdriveFolder, finalFilename);

      try {
        // フォルダが無ければ作成
        const gdriveDir = path.join(gdriveBasePath, gdriveFolder);
        if (!fs.existsSync(gdriveDir)) {
          fs.mkdirSync(gdriveDir, { recursive: true });
          console.log(`  📁 GDriveフォルダ作成: ${gdriveDir}`);
        }
        await renameAndCopy(finalPath, gdriveDest);
        console.log(`📁 GDriveにコピー: ${gdriveDest}`);
      } catch (gdriveErr) {
        console.log(`  ⚠️ GDriveコピー失敗: ${gdriveErr.message}（デスクトップのファイルは正常）`);
      }
    }

    // ── STEP 10: Supabase更新 ──
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    await supabase.from("video_generation_logs").update({
      result: "success",
      retry_count: retryCount,
      prompt_used: imagePrompt,
      video_filename: finalFilename,
      gdrive_path: dbSettings.autoSaveGdrive
        ? `G:\\マイドライブ\\${dbSettings.gdriveFolder || "AI動画生成"}`
        : null,
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
    // ── 方法1: hidden input[type="file"] を探す（ページ全体から） ──
    const fileInputs = await page.$$('input[type="file"]');
    for (const fi of fileInputs) {
      try {
        await fi.setInputFiles(imagePath);
        await page.waitForTimeout(3000);
        console.log("  📎 hidden input[type=file] で画像アップロード成功");
        return true;
      } catch { /* この要素では無理 → 次を試す */ }
    }

    // ── 方法2: 「+」ボタンをクリックしてメニューを開く ──
    console.log("  🔍 添付ボタンを検索中...");
    const plusSelectors = [
      // Geminiの「+」アイコンボタン（入力欄の左側）
      'button[aria-label*="添付"]',
      'button[aria-label*="ファイル"]',
      'button[aria-label*="Attach"]',
      'button[aria-label*="Upload"]',
      'button[aria-label*="Add"]',
      '[data-tooltip*="添付"]',
      '[data-tooltip*="ファイル"]',
      // 「+」テキストを含むボタン
      'button:has(span.material-symbols-outlined)',
    ];

    for (const sel of plusSelectors) {
      const btn = await page.$(sel);
      if (btn) {
        console.log(`  🔍 添付ボタン発見: ${sel}`);
        await btn.click();
        await page.waitForTimeout(2000);

        // メニューが開いたら「ファイルをアップロード」を探す
        const uploadOption = await page.$('text=ファイルをアップロード') 
          || await page.$('text=Upload file')
          || await page.$('[role="menuitem"]:has-text("ファイル")')
          || await page.$('[role="menuitem"]:has-text("アップロード")');

        if (uploadOption) {
          const [fileChooser] = await Promise.all([
            page.waitForEvent("filechooser", { timeout: 10000 }),
            uploadOption.click(),
          ]);
          await fileChooser.setFiles(imagePath);
          await page.waitForTimeout(3000);
          console.log("  📎 メニュー経由で画像アップロード成功");
          return true;
        }

        // メニューではなく直接filechooserが開く場合
        try {
          const [fileChooser] = await Promise.all([
            page.waitForEvent("filechooser", { timeout: 5000 }),
          ]);
          await fileChooser.setFiles(imagePath);
          await page.waitForTimeout(3000);
          console.log("  📎 直接filechooser で画像アップロード成功");
          return true;
        } catch { /* filechooserは開かなかった */ }

        // Escでメニューを閉じる
        await page.keyboard.press("Escape");
        await page.waitForTimeout(500);
      }
    }

    // ── 方法3: ドラッグ&ドロップエリアに直接ファイルを設定 ──
    // ページ上の全てのinput[type="file"]を再チェック（メニュー操作後に出現する場合）
    const fileInputs2 = await page.$$('input[type="file"]');
    if (fileInputs2.length > 0) {
      for (const fi of fileInputs2) {
        try {
          await fi.setInputFiles(imagePath);
          await page.waitForTimeout(3000);
          console.log("  📎 再チェックのinput[type=file] で画像アップロード成功");
          return true;
        } catch { /* next */ }
      }
    }

    // ── 方法4: テキスト入力欄にフォーカスしてからクリップボード貼り付け ──
    // （一部のGemini UIではペーストで画像を受け付ける）

    // ── デバッグ: ページ上の全ボタンをログ出力 ──
    console.log("  🔍 ページ上のボタン一覧（デバッグ）:");
    const buttons = await page.$$eval('button', btns => 
      btns.slice(0, 15).map(b => ({
        text: b.textContent?.trim().slice(0, 40),
        ariaLabel: b.getAttribute('aria-label'),
        className: b.className?.slice(0, 50),
      }))
    );
    buttons.forEach((b, i) => console.log(`    [${i}] label="${b.ariaLabel}" text="${b.text}" class="${b.className}"`));

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
  const MIN_WAIT = 60000;  // 最低60秒は待つ（早期判定を防ぐ）

  console.log("  ⏳ 最低60秒待機してからチェック開始...");

  while (Date.now() - startTime < timeout) {
    await page.waitForTimeout(10000);

    const elapsed = Math.round((Date.now() - startTime) / 1000);

    // 最低待機時間が経過するまではチェックしない
    if (Date.now() - startTime < MIN_WAIT) {
      if (elapsed % 30 === 0) console.log(`  ⏳ ${elapsed}秒経過... 待機中`);
      continue;
    }

    // 経過ログ（30秒ごと）
    if (elapsed % 30 === 0) console.log(`  ⏳ ${elapsed}秒経過... チェック中`);

    // セーフティフィルター検出（レスポンスエリア内のみ）
    const responseTexts = await page.$$eval(
      'message-content, .response-container, .model-response, [data-message-author-role="model"]',
      els => els.map(el => el.textContent || "").join(" ")
    ).catch(() => "");

    const safetyPhrases = [
      "生成できません",
      "生成することはできません",
      "このリクエストには対応できません",
      "ポリシーに違反",
      "I can't generate",
      "I'm not able to generate",
    ];
    for (const phrase of safetyPhrases) {
      if (responseTexts.includes(phrase)) {
        return "safety";
      }
    }

    // 「この回答を停止しました」検出 → 再送信が必要
    const pageText = await page.textContent("body").catch(() => "");
    if (pageText && pageText.includes("この回答を停止しました")) {
      console.log("  ⚠️ 回答が停止されました");
      return "timeout";  // リトライさせる
    }

    // 停止ボタンがまだある = まだ生成中 → 待ち続ける
    const stopBtn = await page.$('[aria-label*="停止"], [aria-label*="Stop"], button:has-text("停止")');
    if (stopBtn) {
      continue;  // まだ生成中
    }

    // 停止ボタンが消えた = 生成完了の可能性
    // 画像が表示されたかチェック
    const newImages = await page.$$('img[src*="blob:"], img[src*="lh3.googleusercontent"], canvas');
    if (newImages.length > 0) {
      await page.waitForTimeout(5000);
      console.log("  🖼️ 画像を検出！");
      return "success";
    }

    // 画像はないがレスポンスは完了している
    // もう少し待って最終チェック
    await page.waitForTimeout(10000);
    const imgs2 = await page.$$('img[src*="blob:"], img[src*="lh3.googleusercontent"], canvas');
    if (imgs2.length > 0) {
      console.log("  🖼️ 画像を検出！");
      return "success";
    }

    // テキストだけのレスポンスで完了
    console.log("  📝 テキストレスポンスで完了（画像なし）");
    return "success";
  }

  return "timeout";
}

/** 思考モード（Deep Think）に切替 */
async function switchToThinkingMode(page) {
  try {
    // ── まず現在のモード表示を確認 ──
    const currentModeText = await page.evaluate(() => {
      // モデル選択UIのテキストを探す（ドロップダウン/ボタンなど）
      const candidates = document.querySelectorAll(
        'button, [role="combobox"], [role="listbox"], .model-selector, [class*="model"]'
      );
      const results = [];
      for (const el of candidates) {
        const text = el.textContent?.trim() || "";
        if (text.length > 0 && text.length < 50 &&
            (text.includes("Flash") || text.includes("Pro") || text.includes("思考") ||
             text.includes("Think") || text.includes("2.0") || text.includes("2.5") ||
             text.includes("モデル") || text.includes("mode") || text.includes("高速"))) {
          results.push({ text, tag: el.tagName, ariaLabel: el.getAttribute("aria-label") || "" });
        }
      }
      return results;
    }).catch(() => []);

    if (currentModeText.length > 0) {
      console.log("  📋 現在のモード関連UI:");
      currentModeText.forEach(m => console.log(`    ${m.tag} label="${m.ariaLabel}" text="${m.text}"`));
    }

    // ── すでに思考モードなら何もしない ──
    const alreadyThinking = currentModeText.some(m =>
      m.text.includes("思考") || m.text.includes("Think") || m.text.includes("Deep")
    );
    if (alreadyThinking) {
      console.log("  ✅ すでに思考モードです");
      return;
    }

    // ── モード切替ドロップダウンを探してクリック ──
    const modeSelectors = [
      'button:has-text("高速モード")',
      'button:has-text("Flash")',
      'button:has-text("2.0 Flash")',
      'button:has-text("2.5 Flash")',
      'button:has-text("Gemini")',
      '[aria-label*="モデル"]',
      '[aria-label*="model"]',
      '[aria-label*="Model"]',
      'button:has-text("2.0")',
      'button:has-text("2.5")',
      '.model-selector',
      '[data-test-id="model-selector"]',
      // ドロップダウントリガー（モデル名を含むボタン）
      'button:has-text("Pro")',
    ];

    for (const sel of modeSelectors) {
      const btn = await page.$(sel);
      if (btn) {
        const btnText = await btn.textContent().catch(() => "");
        console.log(`  🔍 モード切替ボタン発見: ${sel} → "${btnText.trim().slice(0, 40)}"`);
        await btn.click();
        await page.waitForTimeout(2000);

        // ── ドロップダウンメニュー内のオプションをデバッグ表示 ──
        const menuItems = await page.$$eval(
          '[role="option"], [role="menuitem"], [role="menuitemradio"], li, .option',
          els => els.map(el => ({
            text: el.textContent?.trim().slice(0, 60) || "",
            role: el.getAttribute("role") || "",
          })).filter(e => e.text.length > 0 && e.text.length < 60)
        ).catch(() => []);

        if (menuItems.length > 0) {
          console.log("  📋 ドロップダウン内の選択肢:");
          menuItems.forEach(m => console.log(`    [${m.role}] "${m.text}"`));
        }

        // ── 思考モード / Deep Think を選択 ──
        const thinkOptions = [
          'text=思考',
          'text=Think',
          'text=Deep Think',
          'text=Deep Research',
          '[role="option"]:has-text("思考")',
          '[role="menuitem"]:has-text("思考")',
          '[role="menuitemradio"]:has-text("思考")',
          '[role="option"]:has-text("Think")',
          '[role="menuitem"]:has-text("Think")',
          '[role="menuitemradio"]:has-text("Think")',
          // テキスト部分一致
          ':text("思考モード")',
        ];

        for (const optSel of thinkOptions) {
          const opt = await page.$(optSel);
          if (opt) {
            const optText = await opt.textContent().catch(() => "");
            await opt.click();
            await page.waitForTimeout(1500);
            console.log(`  ✅ 思考モードに切替完了: "${optText.trim().slice(0, 40)}"`);
            return;
          }
        }

        // 思考モードが見つからない場合 → メニューを閉じる
        console.log("  ⚠️ 思考モードの選択肢が見つかりません");
        await page.keyboard.press("Escape");
        await page.waitForTimeout(500);
      }
    }

    console.log("  ℹ️ モード切替ボタンが見つかりません（現在のモードで続行）");
    console.log("  💡 ヒント: Geminiを手動で開いて思考モードに切替後、watcher再起動も可");
  } catch (err) {
    console.log(`  ⚠️ モード切替エラー: ${err.message}（現在のモードで続行）`);
  }
}

/** 動画生成の完了を待機（VEO動画は1〜3分かかる） */
async function waitForVideoGeneration(page, timeout) {
  const startTime = Date.now();
  const MIN_WAIT = 90000;  // 最低90秒は待つ（VEO生成には時間がかかる）

  // ── 開始前: 現在ページ上にある画像・動画の数を記録（誤検出防止） ──
  const existingVideos = await page.$$("video").then(els => els.length).catch(() => 0);
  const existingImages = await page.$$('img[src*="blob:"], img[src*="lh3.googleusercontent"]')
    .then(els => els.length).catch(() => 0);
  console.log(`  📊 開始時点: video=${existingVideos}, img=${existingImages}`);

  console.log("  ⏳ 最低90秒待機してからチェック開始...");

  while (Date.now() - startTime < timeout) {
    await page.waitForTimeout(10000);  // 10秒ごとにチェック

    const elapsed = Math.round((Date.now() - startTime) / 1000);

    // ── 最低待機時間が経過するまではチェックしない ──
    if (Date.now() - startTime < MIN_WAIT) {
      if (elapsed % 30 === 0) console.log(`  ⏳ ${elapsed}秒経過... 待機中`);
      continue;
    }

    // 経過ログ（30秒ごと）
    if (elapsed % 30 === 0) console.log(`  ⏳ ${elapsed}秒経過... チェック中`);

    // ── セーフティフィルター & エラー検出 ──
    const responseTexts = await page.$$eval(
      'message-content, .response-container, .model-response, [data-message-author-role="model"]',
      els => els.map(el => el.textContent || "").join(" ")
    ).catch(() => "");

    const errorPhrases = [
      "生成できません", "生成することはできません",
      "このリクエストには対応できません", "ポリシーに違反",
      "I can't generate", "I'm not able to generate",
      "動画を生成できません", "この動画は",
    ];
    for (const phrase of errorPhrases) {
      if (responseTexts.includes(phrase)) {
        console.log(`  ⚠️ エラー検出: "${phrase}"`);
        return "failed";
      }
    }

    // ── 停止ボタンがまだある = まだ生成中 → 待ち続ける ──
    const stopBtn = await page.$('[aria-label*="停止"], [aria-label*="Stop"], button:has-text("停止")');
    if (stopBtn) {
      continue;  // まだ生成中
    }

    // ── 新しい <video> 要素の出現を検出 ──
    const currentVideos = await page.$$("video").then(els => els.length).catch(() => 0);
    if (currentVideos > existingVideos) {
      console.log(`  🎥 新しいvideo要素を検出！ (${existingVideos} → ${currentVideos})`);

      // 動画のsrcが設定されるまで少し待つ
      await page.waitForTimeout(5000);

      // video要素にsrcがあるか確認
      const videoInfo = await page.$$eval("video", videos => {
        const last = videos[videos.length - 1];
        if (!last) return null;
        const src = last.src || last.querySelector("source")?.src || "";
        return {
          src: src,
          duration: last.duration || 0,
          readyState: last.readyState || 0,
        };
      }).catch(() => null);

      if (videoInfo) {
        console.log(`  📹 動画情報: src=${videoInfo.src ? "あり" : "なし"}, ` +
          `duration=${videoInfo.duration}, readyState=${videoInfo.readyState}`);
      }

      // srcがまだない場合はもう少し待つ
      if (!videoInfo?.src) {
        console.log("  ⏳ 動画srcの読み込みを待機中...");
        await page.waitForTimeout(10000);
      }

      return "success";
    }

    // ── [data-video-id] 等の代替検出 ──
    const altVideoEl = await page.$('[data-video-id], [data-video-src]');
    if (altVideoEl) {
      console.log("  🎥 動画要素（data属性）を検出！");
      await page.waitForTimeout(5000);
      return "success";
    }

    // ── 回答停止の検出 ──
    const pageText = await page.textContent("body").catch(() => "");
    if (pageText && pageText.includes("この回答を停止しました")) {
      console.log("  ⚠️ 回答が停止されました");
      return "failed";
    }
  }

  console.log(`  ⏰ タイムアウト (${Math.round(timeout / 1000)}秒)`);
  return "timeout";
}

/** Geminiから動画をダウンロード（改善版） */
async function downloadVideoFromGemini(page, savePath) {
  // ── 方法1: <video>要素のsrcから直接ダウンロード（最も確実） ──
  console.log("  🔍 動画要素のsrcを取得中...");

  const videoSrc = await page.$$eval("video", videos => {
    // 最後の（最新の）video要素を取得
    const video = videos[videos.length - 1];
    if (!video) return null;

    // video.src または <source>のsrcを取得
    let src = video.src || "";
    if (!src) {
      const source = video.querySelector("source");
      if (source) src = source.src || "";
    }
    return src || null;
  }).catch(() => null);

  if (videoSrc) {
    console.log(`  📹 動画src取得: ${videoSrc.slice(0, 80)}...`);

    try {
      if (videoSrc.startsWith("blob:")) {
        // blob URLの場合: ページコンテキスト内でfetchしてArrayBufferに変換
        console.log("  📥 blob URLから動画をダウンロード中...");
        const base64Data = await page.evaluate(async (blobUrl) => {
          const response = await fetch(blobUrl);
          const blob = await response.blob();
          return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result.split(",")[1]);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        }, videoSrc);

        const buffer = Buffer.from(base64Data, "base64");
        fs.writeFileSync(savePath, buffer);
        console.log(`  📥 blob経由ダウンロード完了: ${path.basename(savePath)} (${(buffer.length / 1024 / 1024).toFixed(1)}MB)`);
      } else {
        // 通常URLの場合: Playwrightのrequestで取得
        const response = await page.request.get(videoSrc);
        const buffer = await response.body();
        fs.writeFileSync(savePath, buffer);
        console.log(`  📥 URL直接ダウンロード完了: ${path.basename(savePath)} (${(buffer.length / 1024 / 1024).toFixed(1)}MB)`);
      }

      // ── ダウンロード後の検証 ──
      const isValid = await validateVideoFile(savePath);
      if (isValid) return;

      console.log("  ⚠️ src経由でダウンロードしたファイルが動画ではありません → 方法2へ");
    } catch (err) {
      console.log(`  ⚠️ src経由ダウンロードエラー: ${err.message} → 方法2へ`);
    }
  }

  // ── 方法2: 動画要素のダウンロードボタンをクリック ──
  console.log("  🔍 動画のダウンロードボタンを検索中...");

  // まず動画要素の近くにあるダウンロードボタンを探す
  const dlBtn = await page.evaluate(() => {
    const videos = document.querySelectorAll("video");
    if (videos.length === 0) return null;

    const lastVideo = videos[videos.length - 1];
    // video要素の親要素を辿ってダウンロードボタンを探す
    let container = lastVideo.parentElement;
    for (let i = 0; i < 6; i++) {
      if (!container) break;
      const btns = container.querySelectorAll("button");
      for (const btn of btns) {
        const label = btn.getAttribute("aria-label") || "";
        const tooltip = btn.getAttribute("data-tooltip") || "";
        const text = btn.textContent || "";
        if (label.includes("ダウンロード") || label.includes("Download") ||
            tooltip.includes("ダウンロード") || tooltip.includes("Download") ||
            text.includes("download")) {
          // ボタンにIDがなければユニーク属性を付ける
          btn.setAttribute("data-tm-dl-target", "true");
          return true;
        }
      }
      container = container.parentElement;
    }
    return null;
  }).catch(() => null);

  if (dlBtn) {
    try {
      const downloadPromise = page.waitForEvent("download", { timeout: 30000 });
      await page.click('[data-tm-dl-target="true"]');
      const download = await downloadPromise;

      // ダウンロードのMIMEタイプを確認
      const suggestedName = download.suggestedFilename();
      console.log(`  📥 ダウンロード開始: ${suggestedName}`);

      await download.saveAs(savePath);
      console.log(`  📥 ダウンロードボタン経由完了: ${path.basename(savePath)}`);

      const isValid = await validateVideoFile(savePath);
      if (isValid) return;

      console.log("  ⚠️ ダウンロードボタン経由のファイルが動画ではありません → 方法3へ");
    } catch (err) {
      console.log(`  ⚠️ ダウンロードボタンエラー: ${err.message} → 方法3へ`);
    }
  }

  // ── 方法3: ページ内の全ダウンロードボタンから動画っぽいものを探す ──
  console.log("  🔍 フォールバック: 全ダウンロードボタンを検索...");
  const dlSelectors = [
    '[aria-label*="ダウンロード"]',
    '[aria-label*="Download"]',
    '[data-tooltip*="ダウンロード"]',
    '[data-tooltip*="Download"]',
  ];

  for (const sel of dlSelectors) {
    const btns = await page.$$(sel);
    // 最後のボタンが動画用の可能性が高い（動画は最後に生成される）
    const btn = btns[btns.length - 1];
    if (!btn) continue;

    try {
      const downloadPromise = page.waitForEvent("download", { timeout: 15000 });
      await btn.click();
      const download = await downloadPromise;
      const suggestedName = download.suggestedFilename();
      console.log(`  📥 フォールバックDL: ${suggestedName}`);

      await download.saveAs(savePath);

      const isValid = await validateVideoFile(savePath);
      if (isValid) return;

      console.log(`  ⚠️ ${suggestedName} は動画ではありません → 次のボタンへ`);
    } catch { /* next */ }
  }

  throw new Error("動画のダウンロードに失敗しました（すべての方法を試行済み）");
}

/** ダウンロードしたファイルが本当に動画かを検証 */
async function validateVideoFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      console.log("  ❌ ファイルが存在しません");
      return false;
    }

    const stats = fs.statSync(filePath);
    const sizeMB = stats.size / 1024 / 1024;

    // ── サイズチェック: 動画は通常500KB以上 ──
    if (stats.size < 500 * 1024) {
      console.log(`  ❌ ファイルサイズが小さすぎます: ${(stats.size / 1024).toFixed(0)}KB（動画は通常500KB以上）`);
      return false;
    }

    // ── マジックバイトチェック ──
    const fd = fs.openSync(filePath, "r");
    const header = Buffer.alloc(12);
    fs.readSync(fd, header, 0, 12, 0);
    fs.closeSync(fd);

    // MP4: ftyp signature at offset 4
    const isMp4 = header.slice(4, 8).toString("ascii") === "ftyp";
    // WebM: 0x1A45DFA3
    const isWebm = header[0] === 0x1A && header[1] === 0x45 && header[2] === 0xDF && header[3] === 0xA3;

    if (!isMp4 && !isWebm) {
      // ファイルの先頭を16進数で表示（デバッグ用）
      console.log(`  ❌ 動画フォーマットではありません: ${header.toString("hex").slice(0, 24)}`);
      console.log(`     ファイルサイズ: ${sizeMB.toFixed(1)}MB`);

      // JPEG/PNG判定
      if (header[0] === 0xFF && header[1] === 0xD8) {
        console.log("  ℹ️ これはJPEG画像です");
      } else if (header[0] === 0x89 && header.slice(1, 4).toString("ascii") === "PNG") {
        console.log("  ℹ️ これはPNG画像です");
      }
      return false;
    }

    console.log(`  ✅ 動画ファイル検証OK: ${isMp4 ? "MP4" : "WebM"}, ${sizeMB.toFixed(1)}MB`);
    return true;
  } catch (err) {
    console.log(`  ⚠️ ファイル検証エラー: ${err.message}`);
    return false;
  }
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
      else if (k === "image_prompt_en") s.imagePromptEn = row.value;
      else if (k === "video_prompt_en") s.videoPromptEn = row.value;
      else if (k === "ai_auto_prompt_en") s.aiAutoPromptEn = row.value;
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
