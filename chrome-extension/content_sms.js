// Google Messages (messages.google.com) Content Script
// SMS送信の自動入力

(function () {
  "use strict";

  let checkCount = 0;
  const maxChecks = 30;

  function checkPendingMessage() {
    chrome.runtime.sendMessage({ action: "get_pending" }, (data) => {
      if (chrome.runtime.lastError) return;
      if (data && data.pending_type === "sms" && data.pending_message) {
        trySearchAndFill(data.pending_message, data.pending_target);
      }
    });
  }

  function waitAndCheck() {
    checkCount++;
    if (checkCount > maxChecks) return;

    // Google Messagesのメインコンテンツが読み込まれたかチェック
    const main = document.querySelector("mws-conversations-list, mw-conversation-container, [role='main']");
    if (main) {
      checkPendingMessage();
    } else {
      setTimeout(waitAndCheck, 500);
    }
  }

  // 電話番号で連絡先を検索
  function trySearchAndFill(text, phone) {
    if (!phone) {
      showIndicator("⚠️ 電話番号が指定されていません", "warning");
      return;
    }

    // 検索入力欄を探す
    const searchInput = findSearchInput();
    if (searchInput) {
      showIndicator(`📱 ${phone} を検索中...`, "info");
      setNativeValue(searchInput, phone);
      searchInput.focus();

      // 検索結果が表示されるまで待つ
      setTimeout(() => {
        const result = findSearchResult(phone);
        if (result) {
          result.click();
          // チャット画面が開くのを待ってからメッセージ入力
          setTimeout(() => fillMessageInput(text), 1500);
        } else {
          // 新規メッセージとして作成
          showIndicator(`📱 連絡先が見つかりません。新規メッセージで ${phone} に送信してください。`, "warning");
          fillMessageInput(text);
        }
      }, 1500);
    } else {
      // 検索欄が見つからない → 直接メッセージ入力を試みる
      fillMessageInput(text);
    }
  }

  // 検索入力欄を探す
  function findSearchInput() {
    const selectors = [
      'input[placeholder*="検索"]',
      'input[placeholder*="Search"]',
      'input[placeholder*="名前"]',
      'input[aria-label*="検索"]',
      'input[aria-label*="Search"]',
      'mws-search-input input',
      '[data-e2e-search-input] input'
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) return el;
    }
    return null;
  }

  // 検索結果から該当する連絡先を見つける
  function findSearchResult(phone) {
    // 電話番号の各フォーマットで検索
    const cleanPhone = phone.replace(/\D/g, "");
    const results = document.querySelectorAll("[role='listitem'], mws-conversation-list-item, [class*='conversation']");
    for (const r of results) {
      const txt = r.textContent || "";
      if (txt.includes(cleanPhone) || txt.includes(formatPhone(cleanPhone))) {
        return r;
      }
    }
    return null;
  }

  // 電話番号をフォーマット
  function formatPhone(phone) {
    if (phone.length === 11) {
      return `${phone.slice(0, 3)}-${phone.slice(3, 7)}-${phone.slice(7)}`;
    }
    return phone;
  }

  // メッセージ入力欄にテキストをセット
  function fillMessageInput(text) {
    const textarea = findMessageInput();
    if (!textarea) {
      // 少し待ってリトライ
      setTimeout(() => {
        const ta2 = findMessageInput();
        if (ta2) {
          doFill(ta2, text);
        } else {
          showIndicator("⚠️ メッセージ入力欄が見つかりません。会話を開いてください。", "warning");
          // クリップボードにコピーしておく
          navigator.clipboard.writeText(text).then(() => {
            showIndicator("📋 テキストをクリップボードにコピーしました。貼り付けてください。", "info");
          });
        }
      }, 1000);
      return;
    }
    doFill(textarea, text);
  }

  function doFill(textarea, text) {
    if (textarea.tagName === "TEXTAREA" || textarea.tagName === "INPUT") {
      setNativeValue(textarea, text);
    } else if (textarea.getAttribute("contenteditable") === "true" || textarea.getAttribute("role") === "textbox") {
      textarea.focus();
      textarea.innerHTML = "";
      const lines = text.split("\n");
      lines.forEach((line, i) => {
        textarea.appendChild(document.createTextNode(line));
        if (i < lines.length - 1) textarea.appendChild(document.createElement("br"));
      });
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    }

    showIndicator("✅ メッセージを入力しました！内容を確認して送信してください。", "success");
    chrome.runtime.sendMessage({ action: "clear_pending" });
  }

  // メッセージ入力欄を探す
  function findMessageInput() {
    const selectors = [
      'textarea[placeholder*="メッセージ"]',
      'textarea[placeholder*="テキスト"]',
      'textarea[placeholder*="Text message"]',
      '[contenteditable="true"][role="textbox"]',
      'mws-autosize-textarea textarea',
      '.input-box textarea',
      '[aria-label*="message"] textarea',
      '[aria-label*="メッセージ"]'
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) return el;
    }
    return null;
  }

  // React製の入力欄にネイティブに値をセット
  function setNativeValue(el, value) {
    const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement : HTMLInputElement;
    const nativeSetter = Object.getOwnPropertyDescriptor(proto.prototype, "value")?.set;
    if (nativeSetter) {
      nativeSetter.call(el, value);
    } else {
      el.value = value;
    }
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  // インジケーター表示
  function showIndicator(msg, type) {
    const existing = document.getElementById("tm-indicator");
    if (existing) existing.remove();

    const div = document.createElement("div");
    div.id = "tm-indicator";
    const bgColor = type === "success" ? "#22c55e" : type === "warning" ? "#f59e0b" : type === "info" ? "#3b82f6" : "#ef4444";
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
    if (type === "success" || type === "info") setTimeout(() => div.remove(), 5000);
  }

  // バックグラウンドからのメッセージを受信
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === "fill_sms") {
      trySearchAndFill(msg.text, msg.phone);
      sendResponse({ ok: true });
    }
  });

  // CSS アニメーション追加
  const style = document.createElement("style");
  style.textContent = `@keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }`;
  document.head.appendChild(style);

  // 初回チェック
  setTimeout(waitAndCheck, 1000);
})();
