// LINE Business Chat (chat.line.biz) Content Script
// メッセージ入力欄に自動入力

(function () {
  "use strict";

  // ページ読み込み後に保留メッセージをチェック
  let checkCount = 0;
  const maxChecks = 30; // 最大15秒待つ

  function checkPendingMessage() {
    chrome.runtime.sendMessage({ action: "get_pending" }, (data) => {
      if (chrome.runtime.lastError) return;
      if (data && data.pending_type === "line" && data.pending_message) {
        tryFillMessage(data.pending_message, data.pending_account);
      }
    });
  }

  // ページ読み込み完了を待ってからチェック
  function waitAndCheck() {
    checkCount++;
    if (checkCount > maxChecks) return;

    const textarea = findTextarea();
    if (textarea) {
      checkPendingMessage();
    } else {
      setTimeout(waitAndCheck, 500);
    }
  }

  // LINE Bizのテキスト入力欄を探す
  function findTextarea() {
    // LINE Biz chatの入力欄（複数の候補）
    const selectors = [
      'textarea[placeholder]',
      '.message-input textarea',
      '[contenteditable="true"]',
      'div[role="textbox"]',
      '.input-area textarea',
      '#message-input'
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) return el;
    }
    return null;
  }

  // アカウント判定（業務 or お客様）
  function getAccountType() {
    const accountNameEl = document.querySelector(".account-name, [class*='account-name']");
    if (accountNameEl) {
      return accountNameEl.textContent.includes("業務") ? "staff" : "customer";
    }
    return "unknown";
  }

  // メッセージを入力欄にセット
  function tryFillMessage(text, targetAccount) {
    const textarea = findTextarea();
    if (!textarea) {
      showIndicator("⚠️ 入力欄が見つかりません。チャット画面を開いてください。", "warning");
      return;
    }

    // アカウント確認
    const currentAccount = getAccountType();
    if (targetAccount && currentAccount !== "unknown" && targetAccount !== currentAccount) {
      showIndicator(`⚠️ ${targetAccount === "staff" ? "業務用" : "お客様用"}アカウントに切り替えてください`, "warning");
      return;
    }

    // テキスト入力（React対応）
    if (textarea.tagName === "TEXTAREA" || textarea.tagName === "INPUT") {
      setNativeValue(textarea, text);
    } else if (textarea.getAttribute("contenteditable") === "true" || textarea.getAttribute("role") === "textbox") {
      textarea.focus();
      textarea.innerHTML = "";
      // 改行をbrに変換
      const lines = text.split("\n");
      lines.forEach((line, i) => {
        textarea.appendChild(document.createTextNode(line));
        if (i < lines.length - 1) textarea.appendChild(document.createElement("br"));
      });
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    }

    showIndicator("✅ メッセージを入力しました！内容を確認して送信してください。", "success");

    // 保留メッセージをクリア
    chrome.runtime.sendMessage({ action: "clear_pending" });
  }

  // React製の入力欄にネイティブに値をセット
  function setNativeValue(el, value) {
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype, "value"
    )?.set || Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype, "value"
    )?.set;

    if (nativeInputValueSetter) {
      nativeInputValueSetter.call(el, value);
    } else {
      el.value = value;
    }

    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  // インジケーター表示
  function showIndicator(msg, type) {
    // 既存のインジケーターを削除
    const existing = document.getElementById("tm-indicator");
    if (existing) existing.remove();

    const div = document.createElement("div");
    div.id = "tm-indicator";
    const bgColor = type === "success" ? "#22c55e" : type === "warning" ? "#f59e0b" : "#ef4444";
    div.style.cssText = `
      position: fixed; top: 10px; right: 10px; z-index: 99999;
      padding: 12px 20px; border-radius: 12px; font-size: 13px;
      background-color: ${bgColor}; color: white; max-width: 350px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      animation: slideIn 0.3s ease-out;
    `;
    div.innerHTML = `<div style="display:flex;align-items:center;gap:8px"><span>${msg}</span><button id="tm-close" style="background:none;border:none;color:white;cursor:pointer;font-size:16px;padding:0 4px">✕</button></div>`;
    document.body.appendChild(div);

    div.querySelector("#tm-close").addEventListener("click", () => div.remove());
    if (type === "success") setTimeout(() => div.remove(), 5000);
  }

  // バックグラウンドからのメッセージを受信
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === "fill_line") {
      tryFillMessage(msg.text, msg.account);
      sendResponse({ ok: true });
    }
  });

  // CSS アニメーション追加
  const style = document.createElement("style");
  style.textContent = `@keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }`;
  document.head.appendChild(style);

  // 初回チェック（ページ読み込み後）
  setTimeout(waitAndCheck, 1000);
})();
