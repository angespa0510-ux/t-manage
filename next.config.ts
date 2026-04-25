import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ffmpeg のネイティブバイナリを Next.js のバンドル対象から外す
  // (Vercel の Lambda レイヤーで実行できるよう node_modules に残す)
  serverExternalPackages: [
    "@ffmpeg-installer/ffmpeg",
    "@ffprobe-installer/ffprobe",
    "fluent-ffmpeg",
    "sharp",
  ],
};

export default nextConfig;
