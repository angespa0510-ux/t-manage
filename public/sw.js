// T-MANAGE Service Worker
// Version: 1.0.0
// プッシュ通知受信 + 最低限のオフライン対応

const CACHE_VERSION = "tmanage-v1";

// インストール時: skipWaiting で即座に新SWを有効化
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

// アクティベート時: 古いキャッシュをクリア
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// プッシュ通知受信
self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload = {};
  try {
    payload = event.data.json();
  } catch (e) {
    payload = { title: "T-MANAGE", body: event.data.text() };
  }

  const title = payload.title || "T-MANAGE";
  const options = {
    body: payload.body || "",
    icon: payload.icon || "/icons/icon-192.png",
    badge: payload.badge || "/icons/icon-192.png",
    tag: payload.tag || "tmanage-notification",
    data: {
      url: payload.url || "/",
      ...payload.data,
    },
    // 同じタグだと上書きされる (通知スパム防止)
    renotify: payload.renotify || false,
    // 振動パターン (Android のみ)
    vibrate: payload.vibrate || [100, 50, 100],
    // アクションボタン (最大2つ)
    actions: payload.actions || [],
    // 既読にしないとリングが消えない
    requireInteraction: payload.requireInteraction || false,
    // 静音モード
    silent: payload.silent || false,
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// 通知クリック時: 指定URLを開く or アプリにフォーカス
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url = event.notification.data?.url || "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // すでに開いているタブがあればそれをフォーカス
      for (const client of clientList) {
        const clientUrl = new URL(client.url);
        if (clientUrl.pathname === url && "focus" in client) {
          return client.focus();
        }
      }
      // なければ新しいウィンドウを開く
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

// 通知を閉じたとき (任意、統計用)
self.addEventListener("notificationclose", (event) => {
  // 将来ここで統計送信可能
});

// フェッチイベント (最低限の処理、オフライン対応は将来拡張)
self.addEventListener("fetch", (event) => {
  // Next.js の SPA 動作を邪魔しないため、現状は素通し
  // 将来、画像等のキャッシュ戦略を追加する場合はここに
  return;
});
