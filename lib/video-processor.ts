/**
 * 動画リエンコード ライブラリ
 *
 * Vercel Pro (300秒・3GB メモリ) で動作する設計
 * @ffmpeg-installer/ffmpeg を使ってバイナリを同梱
 *
 * 主な責務:
 *   - 動画のメタデータ取得 (ffprobe)
 *   - リエンコード (H.264 + AAC、9:16 or 元比率)
 *   - サムネイル生成 (1秒目のフレーム)
 */

import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "@ffmpeg-installer/ffmpeg";
import ffprobePath from "@ffprobe-installer/ffprobe";
import { promises as fs } from "fs";
import path from "path";
import os from "os";
import crypto from "crypto";

// ffmpeg バイナリのパスを fluent-ffmpeg に渡す
ffmpeg.setFfmpegPath(ffmpegPath.path);
ffmpeg.setFfprobePath(ffprobePath.path);

export type VideoMetadata = {
  durationSec: number;
  width: number;
  height: number;
  codec: string;
  framerate: number;
  audioCodec: string | null;
  bitrate: number;
};

/**
 * 動画のメタデータを取得 (ffprobe)
 */
export function probeVideo(filePath: string): Promise<VideoMetadata> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, data) => {
      if (err) {
        reject(new Error(`動画解析エラー: ${err.message}`));
        return;
      }
      const videoStream = data.streams.find((s) => s.codec_type === "video");
      const audioStream = data.streams.find((s) => s.codec_type === "audio");

      if (!videoStream) {
        reject(new Error("動画ストリームが見つかりません"));
        return;
      }

      // framerate は "30/1" の形式
      let framerate = 30;
      if (videoStream.r_frame_rate) {
        const [num, den] = videoStream.r_frame_rate.split("/").map(Number);
        if (den && !isNaN(num) && !isNaN(den)) framerate = num / den;
      }

      resolve({
        durationSec: parseFloat(String(data.format.duration || "0")),
        width: videoStream.width || 0,
        height: videoStream.height || 0,
        codec: videoStream.codec_name || "unknown",
        framerate: Math.round(framerate * 100) / 100,
        audioCodec: audioStream?.codec_name || null,
        bitrate: parseInt(String(data.format.bit_rate || "0")),
      });
    });
  });
}

export type ReencodeOptions = {
  inputPath: string;
  outputPath: string;
  /** 9:16 (縦動画ストーリー), 16:9 (横動画), original (元比率維持) */
  aspect?: "9:16" | "16:9" | "original";
  /** 最大高さ. 元動画より大きくはしない */
  maxHeight?: number;
  /** 動画ビットレート, 例 "2M" */
  videoBitrate?: string;
  /** 音声ビットレート, 例 "128k" */
  audioBitrate?: string;
  /** フレームレート, デフォルト30 */
  fps?: number;
  /** 進捗コールバック (0-100) */
  onProgress?: (percent: number) => void;
};

/**
 * 動画をリエンコード (MP4 + H.264 + AAC)
 *
 * Vercel Pro 環境では /tmp に書き出す前提
 */
export async function reencodeVideo(opts: ReencodeOptions): Promise<void> {
  const {
    inputPath,
    outputPath,
    aspect = "original",
    maxHeight = 1080,
    videoBitrate = "2M",
    audioBitrate = "128k",
    fps = 30,
    onProgress,
  } = opts;

  // メタデータ取得 (回転対応や元解像度確認用)
  const meta = await probeVideo(inputPath);

  // 出力解像度を決定
  let scaleFilter: string;
  if (aspect === "9:16") {
    // 9:16 縦動画 = 縦長 (例: 720x1280)
    const targetH = Math.min(maxHeight, 1280);
    const targetW = Math.round((targetH * 9) / 16);
    // 入力に対して center crop + scale
    scaleFilter = `crop='min(iw,ih*9/16)':'min(ih,iw*16/9)',scale=${targetW}:${targetH}`;
  } else if (aspect === "16:9") {
    const targetH = Math.min(maxHeight, 720);
    const targetW = Math.round((targetH * 16) / 9);
    scaleFilter = `crop='min(iw,ih*16/9)':'min(ih,iw*9/16)',scale=${targetW}:${targetH}`;
  } else {
    // original: 縦が maxHeight 超えてればリサイズ (アスペクト維持)
    if (meta.height > maxHeight) {
      scaleFilter = `scale=-2:${maxHeight}`;
    } else if (meta.width > 1920) {
      scaleFilter = `scale=1920:-2`;
    } else {
      scaleFilter = ""; // リサイズ不要
    }
  }

  return new Promise((resolve, reject) => {
    let cmd = ffmpeg(inputPath)
      .videoCodec("libx264")
      .audioCodec("aac")
      .videoBitrate(videoBitrate)
      .audioBitrate(audioBitrate)
      .fps(fps)
      .outputOptions([
        "-preset", "medium",      // 速度と品質のバランス
        "-pix_fmt", "yuv420p",    // 互換性
        "-movflags", "+faststart", // ストリーミング再生用
        "-profile:v", "main",
        "-level", "4.0",
      ])
      .format("mp4");

    if (scaleFilter) {
      cmd = cmd.videoFilter(scaleFilter);
    }

    if (onProgress) {
      cmd.on("progress", (p) => {
        if (typeof p.percent === "number") {
          onProgress(Math.min(100, Math.max(0, p.percent)));
        }
      });
    }

    cmd
      .on("error", (err) => {
        reject(new Error(`ffmpegエラー: ${err.message}`));
      })
      .on("end", () => {
        resolve();
      })
      .save(outputPath);
  });
}

/**
 * サムネイル生成 (動画の1秒目のフレームを抽出)
 */
export function generateThumbnail(
  videoPath: string,
  thumbnailPath: string,
  opts: { atSec?: number; width?: number } = {}
): Promise<void> {
  const { atSec = 1, width = 720 } = opts;
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .seekInput(atSec)
      .frames(1)
      .videoFilter(`scale=${width}:-2`)
      .outputOptions(["-q:v", "3"]) // JPEG品質 (1=最高、31=最低)
      .save(thumbnailPath)
      .on("end", () => resolve())
      .on("error", (err) => reject(new Error(`サムネ生成エラー: ${err.message}`)));
  });
}

/**
 * Vercel /tmp にユニーク名で一時ファイルパスを生成
 */
export function makeTmpPath(extension: string): string {
  const id = crypto.randomBytes(8).toString("hex");
  return path.join(os.tmpdir(), `vid_${Date.now()}_${id}${extension}`);
}

/**
 * 後始末
 */
export async function cleanupTmpFiles(...paths: string[]): Promise<void> {
  for (const p of paths) {
    try {
      await fs.unlink(p);
    } catch {
      // 削除失敗は無視
    }
  }
}

/**
 * URLから一時ファイルへダウンロード
 */
export async function downloadToTmp(
  url: string,
  extension: string
): Promise<string> {
  const tmpPath = makeTmpPath(extension);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`ダウンロード失敗 (${res.status})`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  await fs.writeFile(tmpPath, buffer);
  return tmpPath;
}
