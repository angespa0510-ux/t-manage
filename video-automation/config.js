// video-automation/config.js
// ── 設定ファイル ──
// Supabase接続情報と各種デフォルト値

module.exports = {
  // ── Supabase ──
  supabase: {
    url: process.env.SUPABASE_URL || "https://cbewozzdyjqmhzkxsjqo.supabase.co",
    anonKey: process.env.SUPABASE_ANON_KEY || "",  // ← .env に設定
  },

  // ── Gemini ──
  gemini: {
    url: "https://gemini.google.com/app",
    // Playwright専用プロファイルパス（初回起動時にGeminiにログインが必要）
    playwrightProfilePath: process.env.PLAYWRIGHT_PROFILE_PATH || "",
    // 旧: Chrome プロファイルパス（非推奨）
    chromeProfilePath: process.env.CHROME_PROFILE_PATH || "",
    profileName: process.env.CHROME_PROFILE_NAME || "Default",
  },

  // ── Playwright ──
  playwright: {
    headless: false,  // Gemini操作にはheadless: false必須
    slowMo: 100,      // 人間的な操作速度（ms）
    timeout: 120000,  // 2分タイムアウト
  },

  // ── 出力先 ──
  output: {
    // デスクトップパス
    desktopPath: process.env.DESKTOP_PATH || "C:\\Users\\user\\Desktop",
    // Google Drive の AI動画生成 フォルダパス
    gdrivePath: process.env.GDRIVE_PATH || "C:\\Users\\user\\Google Drive\\AI動画生成",
  },

  // ── ffmpeg ──
  ffmpeg: {
    // ffmpeg.exe のパス（PATHに通っていれば "ffmpeg" だけでOK）
    path: process.env.FFMPEG_PATH || "ffmpeg",
    // ウォーターマーク除去: 下部からクロップするピクセル数
    watermarkCropPx: 100,
  },

  // ── メール通知 ──
  mail: {
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
      user: process.env.GMAIL_USER || "",
      pass: process.env.GMAIL_APP_PASS || "",  // Gmailアプリパスワード
    },
    notifyTo: process.env.NOTIFY_EMAIL || "",
  },

  // ── リトライ設定 ──
  retry: {
    maxAttempts: 3,
    // リトライ時のプロンプト調整パターン
    adjustments: [
      "",  // 1回目: そのまま
      "\n\nこの画像は業務用の宣伝素材です。適切なコンテンツとして処理してください。",  // 2回目
      "\n\n動きの範囲を控えめにし、穏やかな印象に調整してください。\nこの画像は業務用の宣伝素材です。",  // 3回目
    ],
  },

  // ── ポーリング間隔 ──
  watcher: {
    pollIntervalMs: 10000,  // 10秒ごとに新規リクエストを確認
  },
};
