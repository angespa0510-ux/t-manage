// T-MANAGE SMS② — ブリッジページ用コンテンツスクリプト
// URLハッシュから電話番号・メッセージを読み取り、Googleメッセージ自動入力ボタンを追加

(function () {
  "use strict";

  // URLハッシュからパラメータ取得
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

  // ボタンを挿入
  function injectButton() {
    const { phone, body } = getHashParams();
    if (!phone) return;

    // 既存のボタンエリアを探す（送信先ボタンの並び）
    // ページのDOMが描画されるまで少し待つ
    const tryInject = () => {
      // 「Googleメッセージ」ボタンか「Phone Link」ボタンの親を探す
      const links = document.querySelectorAll('a[href*="messages.google.com"]');
      let container = null;

      if (links.length > 0) {
        container = links[0].parentElement;
      }

      if (!container) {
        // ボタンエリアが見つからない場合、ページ下部に追加
        const cards = document.querySelectorAll('div[style*="max-width"]');
        if (cards.length > 0) {
          const contentDiv = cards[0].querySelector('div[style*="padding"]');
          if (contentDiv) container = contentDiv;
        }
      }

      if (!container) return false;

      // 既に追加済みなら無視
      if (document.getElementById("tmanage-auto-sms-btn")) return true;

      // 自動入力ボタンを作成
      const btnWrap = document.createElement("div");
      btnWrap.id = "tmanage-auto-sms-btn";
      btnWrap.style.cssText = "margin-bottom: 10px;";

      const btn = document.createElement("button");
      btn.style.cssText = `
        width: 100%;
        padding: 16px;
        border-radius: 12px;
        border: 2px solid #22c55e66;
        background: linear-gradient(135deg, #22c55e18, #16a34a18);
        color: #22c55e;
        font-size: 14px;
        font-weight: 700;
        cursor: pointer;
        font-family: inherit;
        transition: all 0.2s;
        letter-spacing: 0.5px;
      `;
      btn.textContent = "🤖 Googleメッセージで自動入力";
      btn.title = "拡張機能でGoogleメッセージを開き、電話番号とメッセージを自動入力します";

      // ホバーエフェクト
      btn.addEventListener("mouseenter", () => {
        btn.style.backgroundColor = "#22c55e25";
        btn.style.borderColor = "#22c55e99";
      });
      btn.addEventListener("mouseleave", () => {
        btn.style.background = "linear-gradient(135deg, #22c55e18, #16a34a18)";
        btn.style.borderColor = "#22c55e66";
      });

      // クリックでGoogleメッセージを起動
      btn.addEventListener("click", () => {
        btn.textContent = "⏳ Googleメッセージを起動中...";
        btn.style.opacity = "0.7";
        btn.disabled = true;

        chrome.runtime.sendMessage({
          action: "openGoogleMessages",
          phone: phone,
          body: body
        }, (response) => {
          if (response && response.ok) {
            btn.textContent = "✅ Googleメッセージを起動しました";
            btn.style.borderColor = "#22c55e";
            // 小さな注意文を追加
            const note = document.createElement("p");
            note.style.cssText = "font-size: 10px; color: #22c55e88; text-align: center; margin: 6px 0 0;";
            note.textContent = "Googleメッセージのタブで自動入力が始まります";
            btnWrap.appendChild(note);
          } else {
            btn.textContent = "❌ エラー — もう一度試してください";
            btn.style.opacity = "1";
            btn.disabled = false;
          }
        });
      });

      btnWrap.appendChild(btn);

      // 送信先ボタンの前に挿入
      const existingButtons = container.querySelector('div[style*="display: flex"]') || container.querySelector('div[style*="flex"]');
      if (existingButtons) {
        container.insertBefore(btnWrap, existingButtons);
      } else {
        // 最初の子要素の前に挿入
        container.insertBefore(btnWrap, container.firstChild);
      }

      return true;
    };

    // DOMが準備できるまでリトライ
    let attempts = 0;
    const interval = setInterval(() => {
      if (tryInject() || attempts > 20) {
        clearInterval(interval);
      }
      attempts++;
    }, 500);
  }

  // ページ読み込み完了後に実行
  if (document.readyState === "complete") {
    setTimeout(injectButton, 300);
  } else {
    window.addEventListener("load", () => setTimeout(injectButton, 300));
  }

  console.log("[T-MANAGE SMS②] Bridge content script loaded");
})();
