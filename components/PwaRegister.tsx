"use client";

import { useEffect } from "react";

/**
 * T-MANAGE PWA Service Worker 登録コンポーネント
 *
 * - 起動時に一度だけ /sw.js を登録
 * - 更新時は自動で新SWに切り替え (skipWaiting)
 * - プッシュ通知のサブスク管理は別コンポーネントで
 */
export default function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    // 既存SWがあればスキップ (二重登録防止)
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((registration) => {
        console.log("[PWA] Service Worker registered:", registration.scope);

        // 新しいSWが見つかったら即反映
        registration.addEventListener("updatefound", () => {
          const newSW = registration.installing;
          if (!newSW) return;
          newSW.addEventListener("statechange", () => {
            if (newSW.state === "activated") {
              console.log("[PWA] Service Worker updated");
            }
          });
        });
      })
      .catch((err) => {
        console.warn("[PWA] Service Worker registration failed:", err);
      });
  }, []);

  return null;
}
