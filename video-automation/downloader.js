// video-automation/downloader.js
const fs = require("fs");
const https = require("https");
const http = require("http");

/**
 * URLから画像をダウンロードしてローカルに保存
 */
function downloadImage(url, destPath) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https") ? https : http;
    const file = fs.createWriteStream(destPath);

    client.get(url, { headers: { "User-Agent": "Mozilla/5.0" } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        // リダイレクト対応
        downloadImage(res.headers.location, destPath).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}: ${url}`));
        return;
      }
      res.pipe(file);
      file.on("finish", () => { file.close(); resolve(destPath); });
      file.on("error", (err) => { fs.unlink(destPath, () => {}); reject(err); });
    }).on("error", reject);
  });
}

module.exports = { downloadImage };
