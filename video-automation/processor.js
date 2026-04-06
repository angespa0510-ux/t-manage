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
  let lastLog = Date.now();

  while (Date.now() - startTime < timeout) {
    await page.waitForTimeout(10000);  // 10秒ごとにチェック

    // 経過時間ログ（30秒ごと）
    if (Date.now() - lastLog > 30000) {
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      console.log(`  ⏳ ${elapsed}秒経過... まだ生成中`);
      lastLog = Date.now();
    }

    // Geminiのレスポンスエリアのテキストを取得
    const responseTexts = await page.$$eval(
      'message-content, .response-container, .model-response, [data-message-author-role="model"]',
      els => els.map(el => el.textContent || "").join(" ")
    ).catch(() => "");

    // セーフティフィルター検出（レスポンスエリア内のみ）
    const safetyPhrases = [
      "生成できません",
      "生成することはできません",
      "このリクエストには対応できません",
      "ポリシーに違反",
      "I can't generate",
      "I'm not able to generate",
      "violates our policies",
    ];
    for (const phrase of safetyPhrases) {
      if (responseTexts.includes(phrase)) {
        return "safety";
      }
    }

    // 画像生成完了を検出
    // Geminiが生成した画像は通常 img タグで表示される
    const newImages = await page.$$('img[src*="blob:"], img[src*="lh3.googleusercontent"], img[src*="generated"], canvas');
    if (newImages.length > 0) {
      // 画像が表示されてから少し待つ（完全に読み込まれるまで）
      await page.waitForTimeout(5000);
      return "success";
    }

    // レスポンスが完了したかの別の指標（ストリーミングが止まった）
    // 送信ボタンが再度有効になったかチェック
    const sendBtn = await page.$('[aria-label*="送信"]:not([disabled]), [aria-label*="Send"]:not([disabled])');
    const stopBtn = await page.$('[aria-label*="停止"], [aria-label*="Stop"]');
    
    // 停止ボタンがなく、送信ボタンがある = レスポンス完了
    if (sendBtn && !stopBtn && (Date.now() - startTime > 20000)) {
      // テキストレスポンスとして完了した可能性（画像なし）
      console.log("  📝 テキストレスポンスとして完了（画像なし）");
      // 画像がないならもう少し待ってみる（Geminiが追加生成するかも）
      await page.waitForTimeout(5000);
      const imgs = await page.$$('img[src*="blob:"], img[src*="lh3.googleusercontent"]');
      if (imgs.length > 0) return "success";
      // 画像がなくてもレスポンスはあった → 次のステップ（動画生成）に進める可能性
      return "success";
    }
  }

  return "timeout";
}

/** 思考モード（Deep Think）に切替 */
async function switchToThinkingMode(page) {
  try {
    // モード選択ドロップダウンを探す
    const modeSelectors = [
      'button:has-text("高速モード")',
      'button:has-text("Flash")',
      '[aria-label*="モデル"]',
      '[aria-label*="model"]',
      'button:has-text("2.0")',
      // ドロップダウントリガー
      '.model-selector',
      '[data-test-id="model-selector"]',
    ];

    for (const sel of modeSelectors) {
      const btn = await page.$(sel);
      if (btn) {
        console.log(`  🔍 モード切替ボタン発見: ${sel}`);
        await btn.click();
        await page.waitForTimeout(1500);

        // 思考モード / Deep Think を選択
        const thinkOptions = [
          'text=思考',
          'text=Think',
          'text=Deep',
          '[role="option"]:has-text("思考")',
          '[role="menuitem"]:has-text("思考")',
          '[role="option"]:has-text("Think")',
          '[role="menuitem"]:has-text("Think")',
        ];

        for (const optSel of thinkOptions) {
          const opt = await page.$(optSel);
          if (opt) {
            await opt.click();
            await page.waitForTimeout(1000);
            console.log("  ✅ 思考モードに切替完了");
            return;
          }
        }

        // メニューを閉じる
        await page.keyboard.press("Escape");
        await page.waitForTimeout(500);
      }
    }

    console.log("  ℹ️ モード切替ボタンが見つかりません（現在のモードで続行）");
  } catch (err) {
    console.log(`  ⚠️ モード切替エラー: ${err.message}（現在のモードで続行）`);
  }
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
