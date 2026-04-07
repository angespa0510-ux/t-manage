// T-MANAGE SMS② — ブリッジページ自動通過スクリプト
// ページ表示と同時にデータを読み取り→Googleメッセージを起動→ブリッジタブを自動で閉じる

(function () {
  "use strict";

  function getHashParams() {
    try {
      const hash = window.location.hash.slice(1);
      const params = new URLSearchParams(hash);
      return {
        phone: params.get("phone") || "",
        body: params.get("body") || ""
      };
    } catch {
      return { phone: "", body: "" };
    }
  }

  const { phone, body } = getHashParams();
  if (!phone) return;

  console.log("[T-MANAGE SMS②] Bridge: auto-passing to Google Messages...");

  // background にメッセージ送信 → Googleメッセージを開く＆このタブを閉じる
  chrome.runtime.sendMessage({
    action: "openGoogleMessages",
    phone: phone,
    body: body
  }, (response) => {
    if (!response || !response.ok) {
      // フォールバック: 手動でGoogleメッセージを開く
      console.log("[T-MANAGE SMS②] Bridge: fallback - opening manually");
      chrome.storage.local.set({
        sms_phone: phone,
        sms_body: body,
        sms_timestamp: Date.now()
      }, () => {
        window.location.href = "https://messages.google.com/web/conversations/new";
      });
    }
  });
})();
