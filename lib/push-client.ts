"use client";

/**
 * プッシュ通知の登録・解除ユーティリティ
 *
 * - Service Worker 経由で Push API を使用
 * - iOS は 16.4+ かつ「ホーム画面に追加」されたPWAのみ動作
 * - Android Chrome は Android 5.0+ で動作
 */

export type UserType = "customer" | "therapist" | "staff";

/**
 * プッシュ通知対応をチェック
 */
export function isPushSupported(): boolean {
  if (typeof window === "undefined") return false;
  return (
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/**
 * iOS PWA 判定 (ホーム画面追加済みかどうか)
 * iOS Safari で true になるのはホーム画面追加時のみ
 */
export function isIosPwa(): boolean {
  if (typeof window === "undefined") return false;
  // iOS Safari: standalone
  type IosWindow = Window & { navigator: Navigator & { standalone?: boolean } };
  return (window as IosWindow).navigator.standalone === true;
}

/**
 * スタンドアロン PWA として開かれているか (全 OS)
 */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  if (isIosPwa()) return true;
  return window.matchMedia?.("(display-mode: standalone)").matches || false;
}

/**
 * 現在の通知許可状態を取得
 */
export function getPermissionState(): NotificationPermission | "unsupported" {
  if (!isPushSupported()) return "unsupported";
  return Notification.permission;
}

/**
 * Base64 URL Safe → Uint8Array (applicationServerKey 用)
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}

/**
 * Service Worker の ready を待つ
 */
async function getRegistration(): Promise<ServiceWorkerRegistration> {
  return await navigator.serviceWorker.ready;
}

/**
 * VAPID 公開鍵をサーバーから取得
 */
async function fetchVapidPublicKey(): Promise<string> {
  const res = await fetch("/api/push/vapid-public", { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch VAPID public key");
  const data = await res.json();
  if (!data.publicKey) throw new Error("VAPID key not configured");
  return data.publicKey;
}

/**
 * 通知を有効化
 * 1. 通知許可を要求
 * 2. PushManager で subscribe
 * 3. サーバーに登録
 */
export async function enablePushNotifications(
  userType: UserType,
  userId: number
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!isPushSupported()) {
      return { success: false, error: "お使いのブラウザは通知に対応していません" };
    }

    // iPhone は PWA インストールが必要
    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent);
    if (isIos && !isStandalone()) {
      return {
        success: false,
        error: "iPhoneでは「ホーム画面に追加」してから通知を有効にしてください",
      };
    }

    // 1. 通知許可
    let permission = Notification.permission;
    if (permission === "default") {
      permission = await Notification.requestPermission();
    }
    if (permission !== "granted") {
      return { success: false, error: "通知の許可が得られませんでした" };
    }

    // 2. Service Worker 確認
    const registration = await getRegistration();

    // 3. 既存subscription があれば使い回す
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      // VAPID 公開鍵取得
      const vapidPublicKey = await fetchVapidPublicKey();
      const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);

      // 新規サブスクリプション
      // Note: Uint8Array<ArrayBufferLike> → BufferSource への暗黙変換がTS5.x系で厳しくなったので .buffer で明示
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey.buffer as ArrayBuffer,
      });
    }

    // 4. サーバーに登録
    const deviceInfo = buildDeviceInfo();
    const subJson = subscription.toJSON();
    const res = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "subscribe",
        userType,
        userId,
        subscription: {
          endpoint: subJson.endpoint,
          keys: subJson.keys,
        },
        deviceInfo,
      }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return { success: false, error: errData.error || "サーバー登録に失敗しました" };
    }

    return { success: true };
  } catch (e: unknown) {
    const err = e as { message?: string };
    console.error("[push] enable error:", err);
    return { success: false, error: err.message || "通知の有効化に失敗しました" };
  }
}

/**
 * 通知を無効化
 */
export async function disablePushNotifications(
  userType: UserType,
  userId: number
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!isPushSupported()) {
      return { success: false, error: "未対応ブラウザ" };
    }
    const registration = await getRegistration();
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      return { success: true };
    }
    const endpoint = subscription.endpoint;

    // サーバー側を先に無効化
    await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "unsubscribe",
        userType,
        userId,
        endpoint,
      }),
    });

    // ブラウザ側も解除
    await subscription.unsubscribe();

    return { success: true };
  } catch (e: unknown) {
    const err = e as { message?: string };
    console.error("[push] disable error:", err);
    return { success: false, error: err.message || "通知の無効化に失敗しました" };
  }
}

/**
 * 現在購読中かどうか (ブラウザ側 + サーバー側の両方を確認)
 */
export async function isSubscribed(): Promise<boolean> {
  if (!isPushSupported()) return false;
  try {
    const registration = await getRegistration();
    const subscription = await registration.pushManager.getSubscription();
    return !!subscription;
  } catch {
    return false;
  }
}

/**
 * UA から簡易なデバイス情報文字列を作る
 */
function buildDeviceInfo(): string {
  if (typeof navigator === "undefined") return "";
  const ua = navigator.userAgent;
  let os = "Unknown";
  if (/iPhone|iPad|iPod/.test(ua)) os = "iOS";
  else if (/Android/.test(ua)) os = "Android";
  else if (/Windows/.test(ua)) os = "Windows";
  else if (/Mac OS X/.test(ua)) os = "macOS";

  let browser = "Unknown";
  if (/Edg\//.test(ua)) browser = "Edge";
  else if (/Chrome\//.test(ua)) browser = "Chrome";
  else if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) browser = "Safari";
  else if (/Firefox\//.test(ua)) browser = "Firefox";

  return `${os} / ${browser}`;
}
