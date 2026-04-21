import type { MetadataRoute } from "next";

/**
 * sitemap.xml — Next.js App Router の generateSitemap 機能で動的生成
 *
 * 公開HPの主要ページのみ。管理画面(/dashboard, /staff-login 等) は含めない。
 */

const SITE_URL = "https://t-manage.vercel.app"; // TODO: 独自ドメイン取得後は差し替え

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const paths: Array<{ path: string; priority: number; changeFreq: "daily" | "weekly" | "monthly" }> = [
    { path: "/",          priority: 1.0, changeFreq: "daily" },
    { path: "/system",    priority: 0.9, changeFreq: "monthly" },
    { path: "/therapist", priority: 0.9, changeFreq: "daily" },
    { path: "/schedule",  priority: 1.0, changeFreq: "daily" },
    { path: "/access",    priority: 0.8, changeFreq: "monthly" },
    { path: "/recruit",   priority: 0.7, changeFreq: "monthly" },
    { path: "/contact",   priority: 0.6, changeFreq: "monthly" },
  ];

  return paths.map((p) => ({
    url: `${SITE_URL}${p.path}`,
    lastModified: now,
    changeFrequency: p.changeFreq,
    priority: p.priority,
  }));
}
