// T-MANAGE SMS② Background Service Worker

// メッセージ受信 → Googleメッセージを開く
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "openGoogleMessages") {
    const { phone, body } = msg;

    // storageに保存（content-messages.jsが読み取る）
    chrome.storage.local.set({
      sms_phone: phone,
      sms_body: body,
      sms_timestamp: Date.now()
    }, () => {
      // Googleメッセージの新規チャット画面を開く
      chrome.tabs.create({
        url: "https://messages.google.com/web/conversations/new"
      }, (tab) => {
        sendResponse({ ok: true, tabId: tab.id });
      });
    });

    return true; // 非同期レスポンス
  }
});

console.log("[T-MANAGE SMS②] Background worker ready");
