// video-automation/ffmpeg-utils.js
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const config = require("./config");

/**
 * ffmpegでウォーターマーク除去（下部クロップ）
 * @param {string} inputPath - 入力動画パス
 * @param {string} outputPath - 出力動画パス
 * @param {number} cropPx - 下部からクロップするピクセル数
 */
async function removeWatermark(inputPath, outputPath, cropPx = 100) {
  const ffmpeg = config.ffmpeg.path;

  // 動画の解像度を取得
  const probeCmd = `${ffmpeg} -i "${inputPath}" 2>&1`;
  let width = 1920, height = 1080;
  try {
    const probeOutput = execSync(probeCmd, { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] });
    const sizeMatch = probeOutput.match(/(\d{3,4})x(\d{3,4})/);
    if (sizeMatch) {
      width = parseInt(sizeMatch[1]);
      height = parseInt(sizeMatch[2]);
    }
  } catch (e) {
    // ffmpeg -i はエラーコードを返すが情報は取れる
    const output = e.stderr || e.stdout || "";
    const sizeMatch = output.match(/(\d{3,4})x(\d{3,4})/);
    if (sizeMatch) {
      width = parseInt(sizeMatch[1]);
      height = parseInt(sizeMatch[2]);
    }
  }

  const newHeight = height - cropPx;
  const cropFilter = `crop=${width}:${newHeight}:0:0`;

  const cmd = `${ffmpeg} -y -i "${inputPath}" -vf "${cropFilter}" -c:a copy "${outputPath}"`;
  console.log(`  🔧 ffmpeg: ${width}x${height} → ${width}x${newHeight} (下${cropPx}px除去)`);

  try {
    execSync(cmd, { stdio: "pipe" });
    console.log(`  ✅ ウォーターマーク除去完了: ${path.basename(outputPath)}`);
  } catch (err) {
    console.error(`  ❌ ffmpegエラー: ${err.message}`);
    // フォールバック: そのままコピー
    fs.copyFileSync(inputPath, outputPath);
    console.log("  ⚠️ フォールバック: 元動画をそのまま使用");
  }
}

/**
 * ファイルをリネームしてコピー
 */
async function renameAndCopy(srcPath, destPath) {
  const destDir = path.dirname(destPath);
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }
  fs.copyFileSync(srcPath, destPath);
}

module.exports = { removeWatermark, renameAndCopy };
