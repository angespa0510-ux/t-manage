// T-MANAGE 通知アシスタント — Background Service Worker

// LINE業務アカウントURL
const LINE_BIZ_URL = "https://chat.line.biz/U944f60d894a65c333120a9cd1c300904/";

// メッセージ受信: T-MANAGEからのアクション
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {

  // LINE自動入力リクエスト
  if (msg.action === "open_line") {
    chrome.storage.local.set({
      pending_message: msg.text,
      pending_target: msg.target || "",
      pending_type: "line",
      pending_account: msg.account || "customer" // "staff" or "customer"
    }, () => {
      // LINE Bizのタブがすでにあればそこへ、なければ新規
      chrome.tabs.query({ url: "https://chat.line.biz/*" }, (tabs) => {
        if (tabs.length > 0) {
          chrome.tabs.update(tabs[0].id, { active: true });
          chrome.tabs.sendMessage(tabs[0].id, { action: "fill_line", text: msg.text, target: msg.target });
        } else {
          chrome.tabs.create({ url: LINE_BIZ_URL });
        }
      });
      sendResponse({ ok: true });
    });
    return true;
  }

  // SMS自動入力リクエスト
  if (msg.action === "open_sms") {
    chrome.storage.local.set({
      pending_message: msg.text,
      pending_target: msg.phone || "",
      pending_type: "sms"
    }, () => {
      chrome.tabs.query({ url: "https://messages.google.com/*" }, (tabs) => {
        if (tabs.length > 0) {
          chrome.tabs.update(tabs[0].id, { active: true });
          chrome.tabs.sendMessage(tabs[0].id, { action: "fill_sms", text: msg.text, phone: msg.phone });
        } else {
          chrome.tabs.create({ url: "https://messages.google.com/web/conversations" });
        }
      });
      sendResponse({ ok: true });
    });
    return true;
  }

  // ストレージの保留メッセージを取得
  if (msg.action === "get_pending") {
    chrome.storage.local.get(["pending_message", "pending_target", "pending_type", "pending_account"], (data) => {
      sendResponse(data);
    });
    return true;
  }

  // 保留メッセージをクリア
  if (msg.action === "clear_pending") {
    chrome.storage.local.remove(["pending_message", "pending_target", "pending_type", "pending_account"]);
    sendResponse({ ok: true });
    return true;
  }
});
