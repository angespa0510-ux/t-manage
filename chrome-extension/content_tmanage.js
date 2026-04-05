// T-MANAGE Content Script
// 通知ポップアップに「自動入力」ボタンを追加

(function () {
  "use strict";

  const observer = new MutationObserver(() => { enhanceNotifyPopup(); });
  observer.observe(document.body, { childList: true, subtree: true });

  // LINE URLをページのdata属性から取得
  function getLineUrl(account) {
    if (account === "staff") {
      return document.body.dataset.lineUrlStaff || "";
    }
    return document.body.dataset.lineUrlCustomer || "";
  }

  // 通知ポップアップから顧客名を取得
  function getCustomerName() {
    const els = document.querySelectorAll("[style*='color']");
    for (const el of els) {
      const t = el.textContent || "";
      const m = t.match(/^(.+?)\s*様\s*\|/);
      if (m) return m[1].replace(/\s*L$/i, "").trim();
    }
    const h2s = document.querySelectorAll("h2");
    for (const h2 of h2s) {
      if (h2.textContent.includes("予約確認通知")) {
        const p = h2.closest("div")?.querySelector("p");
        if (p) {
          const m = (p.textContent || "").match(/^(.+?)\s*様/);
          if (m) return m[1].replace(/\s*L$/i, "").trim();
        }
      }
    }
    return "";
  }

  function enhanceNotifyPopup() {
    const buttons = document.querySelectorAll("button");

    buttons.forEach((btn) => {
      const text = btn.textContent || "";

      if (text.includes("LINE用テキストをコピー") && !btn.dataset.tmEnhanced) {
        btn.dataset.tmEnhanced = "true";
        addAutoButton(btn, "line_customer", "🚀 LINE自動入力", "#06C755");
      }

      if (text.includes("セラピストLINE用コピー") && !btn.dataset.tmEnhanced) {
        btn.dataset.tmEnhanced = "true";
        addAutoButton(btn, "line_staff", "🚀 セラピストLINE自動入力", "#85a8c4");
      }

      if (text.includes("SMS用コピー") && !btn.dataset.tmEnhanced) {
        btn.dataset.tmEnhanced = "true";
        const phoneMatch = text.match(/[\d\-]+/);
        const phone = phoneMatch ? phoneMatch[0].replace(/\D/g, "") : "";
        addAutoButton(btn, "sms", "🚀 SMS自動入力", "#f59e0b", phone);
      }
    });
  }

  function addAutoButton(refBtn, type, label, color, phone) {
    const autoBtn = document.createElement("button");
    autoBtn.textContent = label;
    autoBtn.style.cssText = `
      width: 100%; padding: 12px; border-radius: 12px; font-size: 13px;
      font-weight: 500; cursor: pointer; margin-top: 6px;
      background-color: ${color}; color: white; border: none;
      transition: opacity 0.2s;
    `;
    autoBtn.onmouseover = () => autoBtn.style.opacity = "0.85";
    autoBtn.onmouseout = () => autoBtn.style.opacity = "1";

    autoBtn.addEventListener("click", () => {
      const previewEl = document.querySelector('[style*="font-family"][style*="monospace"]');
      const msgText = previewEl ? previewEl.textContent : "";
      if (!msgText) { showToast("メッセージが取得できませんでした", "error"); return; }

      const custName = getCustomerName();

      if (type === "line_customer" || type === "line_staff") {
        const account = type === "line_staff" ? "staff" : "customer";
        const lineUrl = getLineUrl(account);

        if (!lineUrl) {
          showToast("LINE URLが未設定です。システム設定で設定してください。", "error");
          return;
        }

        chrome.runtime.sendMessage({
          action: "open_line",
          text: msgText,
          target: custName,
          account: account,
          lineUrl: lineUrl
        }, (res) => {
          if (res && res.ok) showToast("LINEを開いています...", "success");
        });
      } else if (type === "sms") {
        chrome.runtime.sendMessage({
          action: "open_sms",
          text: msgText,
          phone: phone || ""
        }, (res) => {
          if (res && res.ok) showToast("Googleメッセージを開いています...", "success");
        });
      }
    });

    refBtn.parentNode.insertBefore(autoBtn, refBtn.nextSibling);
  }

  function showToast(msg, type) {
    const toast = document.createElement("div");
    toast.textContent = msg;
    toast.style.cssText = `
      position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
      padding: 12px 24px; border-radius: 12px; font-size: 13px; z-index: 99999;
      background-color: ${type === "success" ? "#22c55e" : "#ef4444"}; color: white;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15); animation: fadeInUp 0.3s;
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }
})();
