// Popup Script

const LINE_BIZ_URL = "https://chat.line.biz/U944f60d894a65c333120a9cd1c300904/";

// タブ接続状態チェック
function checkStatus() {
  chrome.tabs.query({}, (tabs) => {
    const hasTmanage = tabs.some(t => t.url && t.url.includes("t-manage.vercel.app"));
    const hasLine = tabs.some(t => t.url && t.url.includes("chat.line.biz"));
    const hasSms = tabs.some(t => t.url && t.url.includes("messages.google.com"));

    setDot("dot-tmanage", hasTmanage ? "green" : "red");
    setDot("dot-line", hasLine ? "green" : "yellow");
    setDot("dot-sms", hasSms ? "green" : "yellow");
  });
}

function setDot(id, color) {
  const dot = document.getElementById(id);
  dot.className = "dot " + color;
}

// 保留メッセージチェック
function checkPending() {
  chrome.runtime.sendMessage({ action: "get_pending" }, (data) => {
    if (data && data.pending_message) {
      document.getElementById("pending-section").style.display = "block";
      const typeLabel = data.pending_type === "line" ? "💬 LINE" : "📱 SMS";
      const targetLabel = data.pending_target ? ` → ${data.pending_target}` : "";
      document.getElementById("pending-info").textContent = `${typeLabel}${targetLabel}`;
      document.getElementById("pending-text").textContent = data.pending_message.slice(0, 200) + (data.pending_message.length > 200 ? "..." : "");
    } else {
      document.getElementById("pending-section").style.display = "none";
    }
  });
}

// クリアボタン
document.getElementById("btn-clear").addEventListener("click", () => {
  chrome.runtime.sendMessage({ action: "clear_pending" }, () => {
    checkPending();
  });
});

// LINE を開く
document.getElementById("btn-open-line").addEventListener("click", () => {
  chrome.tabs.query({ url: "https://chat.line.biz/*" }, (tabs) => {
    if (tabs.length > 0) {
      chrome.tabs.update(tabs[0].id, { active: true });
    } else {
      chrome.tabs.create({ url: LINE_BIZ_URL });
    }
  });
  window.close();
});

// SMS を開く
document.getElementById("btn-open-sms").addEventListener("click", () => {
  chrome.tabs.query({ url: "https://messages.google.com/*" }, (tabs) => {
    if (tabs.length > 0) {
      chrome.tabs.update(tabs[0].id, { active: true });
    } else {
      chrome.tabs.create({ url: "https://messages.google.com/web/conversations" });
    }
  });
  window.close();
});

// 初期化
checkStatus();
checkPending();
