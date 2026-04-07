// T-MANAGE SMS② Background Service Worker

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "openGoogleMessages") {
    const { phone, body } = msg;

    // storageに保存
    chrome.storage.local.set({
      sms_phone: phone,
      sms_body: body,
      sms_timestamp: Date.now()
    }, () => {
      // Googleメッセージを開く
      chrome.tabs.create({
        url: "https://messages.google.com/web/conversations/new"
      }, () => {
        // ブリッジタブを閉じる
        if (sender.tab && sender.tab.id) {
          chrome.tabs.remove(sender.tab.id);
        }
        sendResponse({ ok: true });
      });
    });

    return true; // 非同期
  }
});

console.log("[T-MANAGE SMS②] Background ready");
