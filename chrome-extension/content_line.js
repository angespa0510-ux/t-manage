// LINE Business Chat (chat.line.biz) Content Script
// 顧客を検索 → チャットを開く → メッセージを自動入力

(function () {
  "use strict";

  let checkCount = 0;
  const maxChecks = 30;

  // ページ読み込み後に保留メッセージをチェック
  function checkPendingMessage() {
    chrome.runtime.sendMessage({ action: "get_pending" }, (data) => {
      if (chrome.runtime.lastError) return;
      if (data && data.pending_type === "line" && data.pending_message) {
        const target = data.pending_target || "";
        if (target) {
          searchAndFill(target, data.pending_message);
        } else {
          tryFillMessage(data.pending_message);
        }
      }
    });
  }

  function waitAndCheck() {
    checkCount++;
    if (checkCount > maxChecks) return;
    // LINE Biz Chatの検索欄が表示されるのを待つ
    const searchInput = findSearchInput();
    if (searchInput) {
      setTimeout(checkPendingMessage, 500);
    } else {
      setTimeout(waitAndCheck, 500);
    }
  }

  // ===== 検索 → クリック → メッセージ入力 =====
  function searchAndFill(customerName, messageText) {
    showIndicator(`🔍 「${customerName}」を検索中...`, "info");

    const searchInput = findSearchInput();
    if (!searchInput) {
      showIndicator("⚠️ 検索欄が見つかりません。ページを再読み込みしてください。", "warning");
      return;
    }

    // 検索欄にフォーカスして入力
    searchInput.focus();
    searchInput.value = "";
    setNativeValue(searchInput, customerName);

    // 検索結果が表示されるのを待つ
    let waitCount = 0;
    const waitForResults = () => {
      waitCount++;
      if (waitCount > 20) {
        showIndicator(`⚠️ 「${customerName}」が見つかりません。手動で選択してください。`, "warning");
        // テキストはクリップボードに入れておく
        navigator.clipboard.writeText(messageText);
        chrome.runtime.sendMessage({ action: "clear_pending" });
        return;
      }

      // チャットリストから該当する顧客を探す
      const match = findCustomerInList(customerName);
      if (match) {
        showIndicator(`✅ 「${customerName}」を見つけました！`, "success");
        match.click();

        // チャット画面が開くのを待ってメッセージ入力
        setTimeout(() => {
          tryFillMessage(messageText);
        }, 1500);
      } else {
        setTimeout(waitForResults, 500);
      }
    };

    setTimeout(waitForResults, 800);
  }

  // 検索欄を探す
  function findSearchInput() {
    const selectors = [
      'input[placeholder*="検索"]',
      'input[placeholder*="Search"]',
      '.search-input input',
      '[class*="search"] input',
      'input[type="text"]'
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el && isVisible(el)) return el;
    }
    return null;
  }

  // 要素が表示されているかチェック
  function isVisible(el) {
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  // チャットリストから顧客を探す
  function findCustomerInList(name) {
    // LINEのチャットリスト内の各アイテムを走査
    const listItems = document.querySelectorAll(
      '[class*="chatlist"] [class*="item"], ' +
      '[class*="chat-list"] a, ' +
      '[class*="conversation"] a, ' +
      'li[class*="chat"], ' +
      'a[href*="/chat/"]'
    );

    for (const item of listItems) {
      const text = item.textContent || "";
      if (text.includes(name)) return item;
    }

    // フォールバック: 全リンクから探す
    const links = document.querySelectorAll("a");
    for (const link of links) {
      const text = link.textContent || "";
      // 顧客名を含むリンクを探す（完全一致に近いもの）
      if (text.includes(name) && link.href && link.href.includes("/chat/")) {
        return link;
      }
    }

    // さらにフォールバック: divやspanで顧客名を含むクリック可能な要素
    const all = document.querySelectorAll("[class*='name'], [class*='title'], span, div");
    for (const el of all) {
      if (el.children.length > 3) continue; // テキストノードに近い要素のみ
      const t = (el.textContent || "").trim();
      if (t === name || t.startsWith(name)) {
        // クリック可能な親要素を探す
        const clickable = el.closest("a, button, [role='button'], [onclick], li");
        if (clickable) return clickable;
        return el;
      }
    }

    return null;
  }

  // メッセージ入力欄にテキストをセット
  function tryFillMessage(text) {
    const textarea = findTextarea();
    if (!textarea) {
      // リトライ
      let retry = 0;
      const interval = setInterval(() => {
        retry++;
        const ta = findTextarea();
        if (ta) {
          clearInterval(interval);
          doFill(ta, text);
        } else if (retry > 10) {
          clearInterval(interval);
          showIndicator("⚠️ 入力欄が見つかりません。チャットを開いてから貼り付けてください。", "warning");
          navigator.clipboard.writeText(text);
        }
      }, 500);
      return;
    }
    doFill(textarea, text);
  }

  function doFill(el, text) {
    el.focus();

    if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") {
      setNativeValue(el, text);
    } else if (el.getAttribute("contenteditable") === "true" || el.getAttribute("role") === "textbox") {
      el.innerHTML = "";
      const lines = text.split("\n");
      lines.forEach((line, i) => {
        el.appendChild(document.createTextNode(line));
        if (i < lines.length - 1) el.appendChild(document.createElement("br"));
      });
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }

    showIndicator("✅ メッセージを入力しました！内容を確認して送信してください。", "success");
    chrome.runtime.sendMessage({ action: "clear_pending" });
  }

  // LINE Bizのテキスト入力欄を探す
  function findTextarea() {
    const selectors = [
      'textarea[placeholder*="Ctrl"]',
      'textarea[placeholder*="Enter"]',
      'textarea[placeholder*="送信"]',
      'textarea[placeholder*="メッセージ"]',
      '.message-input textarea',
      '[contenteditable="true"]',
      'div[role="textbox"]',
      'textarea'
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el && isVisible(el)) return el;
    }
    return null;
  }

  // React製入力欄にネイティブ値セット
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
      background-color: ${bgColor}; color: white; max-width: 400px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      animation: slideIn 0.3s ease-out;
    `;
    div.innerHTML = `<div style="display:flex;align-items:center;gap:8px"><span>${msg}</span><button id="tm-close" style="background:none;border:none;color:white;cursor:pointer;font-size:16px;padding:0 4px">✕</button></div>`;
    document.body.appendChild(div);
    div.querySelector("#tm-close").addEventListener("click", () => div.remove());
    if (type === "success" || type === "info") setTimeout(() => div.remove(), 5000);
  }

  // バックグラウンドからのメッセージ受信
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === "fill_line") {
      if (msg.target) {
        searchAndFill(msg.target, msg.text);
      } else {
        tryFillMessage(msg.text);
      }
      sendResponse({ ok: true });
    }
  });

  // CSS アニメーション
  const style = document.createElement("style");
  style.textContent = `@keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }`;
  document.head.appendChild(style);

  // 初回チェック
  setTimeout(waitAndCheck, 1000);
})();
