// T-MANAGE SMS② — Googleメッセージ自動入力コンテンツスクリプト
// chrome.storage.localからphone/bodyを読み、電話番号検索→メッセージ入力まで自動化

(function () {
  "use strict";

  const LOG_PREFIX = "[T-MANAGE SMS②]";
  const MAX_WAIT = 15000; // 最大待機15秒
  const POLL = 300; // ポーリング間隔

  function log(msg) {
    console.log(`${LOG_PREFIX} ${msg}`);
  }

  // 要素が見つかるまで待機
  function waitForElement(selectorFn, timeout = MAX_WAIT) {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      const check = () => {
        const el = selectorFn();
        if (el) return resolve(el);
        if (Date.now() - start > timeout) return reject(new Error("Element not found"));
        setTimeout(check, POLL);
      };
      check();
    });
  }

  // テキストを1文字ずつ入力（Reactアプリ対策）
  function typeText(el, text) {
    el.focus();
    // input/textareaの場合
    if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
      // React/Angularのバリュー更新のため、nativeInputValueSetterを使用
      const nativeSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype, "value"
      )?.set || Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype, "value"
      )?.set;

      if (nativeSetter) {
        nativeSetter.call(el, text);
      } else {
        el.value = text;
      }
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    }
    // contenteditableの場合
    else if (el.contentEditable === "true") {
      el.focus();
      el.textContent = text;
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }

  // キーイベントを発火
  function pressKey(el, key, keyCode) {
    const opts = { key, keyCode, which: keyCode, bubbles: true };
    el.dispatchEvent(new KeyboardEvent("keydown", opts));
    el.dispatchEvent(new KeyboardEvent("keyup", opts));
  }

  // ステータスバナーを表示
  function showBanner(message, type = "info") {
    let banner = document.getElementById("tmanage-sms-banner");
    if (!banner) {
      banner = document.createElement("div");
      banner.id = "tmanage-sms-banner";
      banner.style.cssText = `
        position: fixed; top: 0; left: 0; right: 0; z-index: 99999;
        padding: 12px 20px; font-size: 14px; font-weight: 600;
        text-align: center; font-family: 'Hiragino Sans', sans-serif;
        transition: all 0.3s; box-shadow: 0 2px 12px rgba(0,0,0,0.3);
      `;
      document.body.appendChild(banner);
    }

    const colors = {
      info: { bg: "#8b5cf6", text: "#fff" },
      success: { bg: "#22c55e", text: "#fff" },
      error: { bg: "#ef4444", text: "#fff" },
      waiting: { bg: "#f59e0b", text: "#fff" },
    };
    const c = colors[type] || colors.info;
    banner.style.backgroundColor = c.bg;
    banner.style.color = c.text;
    banner.textContent = message;
    banner.style.display = "block";

    if (type === "success") {
      setTimeout(() => { banner.style.display = "none"; }, 5000);
    }
  }

  // メイン処理
  async function autoFill() {
    // storageからデータ取得
    const data = await new Promise(resolve => {
      chrome.storage.local.get(["sms_phone", "sms_body", "sms_timestamp"], resolve);
    });

    if (!data.sms_phone) {
      log("No SMS data in storage, skipping");
      return;
    }

    // 古いデータは無視（5分以上前）
    if (data.sms_timestamp && Date.now() - data.sms_timestamp > 5 * 60 * 1000) {
      log("SMS data is stale, skipping");
      chrome.storage.local.remove(["sms_phone", "sms_body", "sms_timestamp"]);
      return;
    }

    const phone = data.sms_phone;
    const body = data.sms_body;
    log(`Auto-filling: phone=${phone}, body length=${body.length}`);

    showBanner(`📲 T-MANAGE: ${phone} に自動入力中...`, "info");

    try {
      // ===== STEP 1: 宛先入力欄を探す =====
      log("Step 1: Looking for recipient input...");

      const recipientInput = await waitForElement(() => {
        // 戦略1: input[type=text] で placeholder が電話番号系
        const inputs = document.querySelectorAll('input[type="text"], input:not([type])');
        for (const inp of inputs) {
          const ph = (inp.placeholder || "").toLowerCase();
          const al = (inp.getAttribute("aria-label") || "").toLowerCase();
          if (ph.includes("名前") || ph.includes("電話") || ph.includes("番号") ||
              ph.includes("name") || ph.includes("phone") || ph.includes("number") ||
              ph.includes("person") || ph.includes("to") || ph.includes("recipient") ||
              al.includes("名前") || al.includes("phone") || al.includes("recipient") ||
              al.includes("to") || al.includes("検索")) {
            if (inp.offsetParent !== null) return inp; // 表示されている要素のみ
          }
        }
        // 戦略2: 新規チャット画面の最初の可視input
        const allInputs = document.querySelectorAll('input');
        for (const inp of allInputs) {
          if (inp.offsetParent !== null && inp.type !== "hidden" && !inp.readOnly) {
            return inp;
          }
        }
        // 戦略3: contenteditable
        const editables = document.querySelectorAll('[contenteditable="true"]');
        for (const ed of editables) {
          if (ed.offsetParent !== null && ed.offsetHeight < 100) return ed;
        }
        return null;
      });

      log("Step 1: Found recipient input");
      showBanner(`📲 電話番号を入力中: ${phone}`, "info");

      // 電話番号を入力
      typeText(recipientInput, phone);
      // 少し待ってからEnterを押す（検索結果が出るのを待つ）
      await new Promise(r => setTimeout(r, 1500));

      // ===== STEP 2: 検索結果をクリック or Enter =====
      log("Step 2: Looking for search results...");

      // 検索結果のリストアイテムを探す
      let resultClicked = false;

      // 戦略1: 電話番号を含むリスト項目を探す
      const listItems = document.querySelectorAll(
        'mws-contact-list-item, [role="option"], [role="listitem"], li, .contact-item, a[href*="conversation"]'
      );
      for (const item of listItems) {
        const text = item.textContent || "";
        // 電話番号の末尾4桁で照合（フォーマット違い対策）
        const last4 = phone.replace(/\D/g, "").slice(-4);
        if (text.includes(last4) || text.includes(phone)) {
          item.click();
          resultClicked = true;
          log("Step 2: Clicked matching contact");
          break;
        }
      }

      if (!resultClicked) {
        // Enterキーで最初の結果を選択
        pressKey(recipientInput, "Enter", 13);
        log("Step 2: Pressed Enter (no exact match found)");
      }

      await new Promise(r => setTimeout(r, 1500));

      // ===== STEP 3: メッセージ入力欄を探す =====
      log("Step 3: Looking for message input...");

      showBanner("📝 メッセージを入力中...", "info");

      const messageInput = await waitForElement(() => {
        // 戦略1: メッセージ入力エリアっぽいcontenteditable
        const editables = document.querySelectorAll('[contenteditable="true"]');
        for (const ed of editables) {
          if (ed.offsetParent === null) continue;
          const ph = ed.getAttribute("data-placeholder") || ed.getAttribute("aria-label") || "";
          if (ph.includes("メッセージ") || ph.includes("message") || ph.includes("SMS") ||
              ph.includes("テキスト") || ph.includes("text")) {
            return ed;
          }
        }
        // 戦略2: 高さが小さくない contenteditable（メッセージ入力は通常下部にある）
        for (const ed of editables) {
          if (ed.offsetParent === null) continue;
          const rect = ed.getBoundingClientRect();
          // 画面の下半分にある contenteditable
          if (rect.top > window.innerHeight * 0.3) return ed;
        }
        // 戦略3: textarea
        const textareas = document.querySelectorAll("textarea");
        for (const ta of textareas) {
          if (ta.offsetParent !== null) return ta;
        }
        return null;
      });

      log("Step 3: Found message input");

      // メッセージを入力
      typeText(messageInput, body);

      // もう一度 input イベントを発火（Angular対策）
      messageInput.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
      messageInput.dispatchEvent(new Event("change", { bubbles: true }));

      // ===== 完了 =====
      showBanner(`✅ 自動入力完了！ 内容を確認して送信してください`, "success");
      log("Auto-fill complete!");

      // storageをクリア
      chrome.storage.local.remove(["sms_phone", "sms_body", "sms_timestamp"]);

    } catch (err) {
      log(`Error: ${err.message}`);
      showBanner(`⚠️ 自動入力に失敗しました — 手動で入力してください`, "error");

      // クリップボードにメッセージをコピー（フォールバック）
      try {
        await navigator.clipboard.writeText(body);
        showBanner(`⚠️ 自動入力に失敗 — メッセージをコピーしました（Ctrl+V で貼り付け）`, "error");
      } catch { /* ignore */ }
    }
  }

  // ページ読み込み後に実行
  function init() {
    // /conversations/new ページでのみ実行
    if (window.location.href.includes("conversations")) {
      // ページの描画を待ってから開始
      setTimeout(autoFill, 2000);
    }
  }

  if (document.readyState === "complete") {
    init();
  } else {
    window.addEventListener("load", init);
  }

  log("Google Messages content script loaded");
})();
