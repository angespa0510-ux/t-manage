// T-MANAGE 通知アシスタント — Background Service Worker

// デフォルトLINE URL（設定がない場合のフォールバック）
const DEFAULT_LINE_URL = "https://chat.line.biz/";

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {

  // LINE自動入力リクエスト
  if (msg.action === "open_line") {
    const lineUrl = msg.lineUrl || DEFAULT_LINE_URL;
    chrome.storage.local.set({
      pending_message: msg.text,
      pending_target: msg.target || "",
      pending_type: "line",
      pending_account: msg.account || "customer"
    }, () => {
      chrome.tabs.query({ url: "https://chat.line.biz/*" }, (tabs) => {
        // 指定URLに一致するタブを探す
        const matchTab = tabs.find(t => t.url && t.url.includes(lineUrl.replace("https://", "")));
        if (matchTab) {
          chrome.tabs.update(matchTab.id, { active: true });
          chrome.tabs.sendMessage(matchTab.id, { action: "fill_line", text: msg.text, target: msg.target });
        } else if (tabs.length > 0 && !lineUrl.includes("/U")) {
          // URLが未設定の場合は既存タブを使う
          chrome.tabs.update(tabs[0].id, { active: true });
          chrome.tabs.sendMessage(tabs[0].id, { action: "fill_line", text: msg.text, target: msg.target });
        } else {
          chrome.tabs.create({ url: lineUrl });
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
