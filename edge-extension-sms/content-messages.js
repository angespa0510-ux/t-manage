// T-MANAGE SMS② — Googleメッセージ自動入力（検索→結果クリック→メッセージ入力）

(function () {
  "use strict";

  const LOG = "[T-MANAGE SMS②]";
  const MAX_WAIT = 15000;
  const POLL = 300;

  function log(msg) { console.log(`${LOG} ${msg}`); }

  // 要素待機（ポーリング）
  function waitFor(fn, timeout = MAX_WAIT) {
    return new Promise((resolve, reject) => {
      const t0 = Date.now();
      const tick = () => {
        const el = fn();
        if (el) return resolve(el);
        if (Date.now() - t0 > timeout) return reject(new Error("timeout"));
        setTimeout(tick, POLL);
      };
      tick();
    });
  }

  // 少し待つ
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  // input にテキストを設定（Angular/React対策: nativeSetter + イベント）
  function setInputValue(el, text) {
    el.focus();
    if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
      const proto = el.tagName === "INPUT"
        ? HTMLInputElement.prototype
        : HTMLTextAreaElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
      if (setter) setter.call(el, text);
      else el.value = text;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    } else if (el.contentEditable === "true") {
      el.focus();
      el.textContent = "";
      document.execCommand("insertText", false, text);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }

  // バナー表示
  function banner(msg, type = "info") {
    let b = document.getElementById("tm-sms-banner");
    if (!b) {
      b = document.createElement("div");
      b.id = "tm-sms-banner";
      b.style.cssText = `
        position:fixed;top:0;left:0;right:0;z-index:99999;
        padding:10px 20px;font-size:13px;font-weight:600;
        text-align:center;font-family:'Hiragino Sans',sans-serif;
        transition:all .3s;box-shadow:0 2px 12px rgba(0,0,0,.3);
      `;
      document.body.appendChild(b);
    }
    const C = { info:"#8b5cf6", success:"#22c55e", error:"#ef4444", waiting:"#f59e0b" };
    b.style.backgroundColor = C[type] || C.info;
    b.style.color = "#fff";
    b.textContent = msg;
    b.style.display = "block";
    if (type === "success") setTimeout(() => b.style.display = "none", 6000);
  }

  // ===== メイン =====
  async function run() {
    // storage からデータ取得
    const data = await new Promise(r =>
      chrome.storage.local.get(["sms_phone", "sms_body", "sms_timestamp"], r)
    );
    if (!data.sms_phone) { log("No data, skip"); return; }
    if (data.sms_timestamp && Date.now() - data.sms_timestamp > 5 * 60000) {
      log("Stale data, skip");
      chrome.storage.local.remove(["sms_phone", "sms_body", "sms_timestamp"]);
      return;
    }

    const phone = data.sms_phone;
    const body = data.sms_body;
    log(`Start: phone=${phone} body=${body.length}chars`);
    banner(`📲 ${phone} に自動入力中...`);

    try {
      // ========== STEP 1: 宛先入力欄を見つけて電話番号を入力 ==========
      log("STEP1: find recipient input");

      const recipientInput = await waitFor(() => {
        // 可視 input を全取得
        for (const inp of document.querySelectorAll("input")) {
          if (inp.offsetParent === null || inp.type === "hidden") continue;
          return inp;
        }
        return null;
      });

      log("STEP1: found → typing phone number");
      banner(`📲 宛先に ${phone} を入力中...`);
      setInputValue(recipientInput, phone);
      await sleep(2000); // 検索結果が出るまで待つ

      // ========== STEP 2: 検索結果をクリック ==========
      log("STEP2: find & click search result");
      banner("🔍 検索結果を選択中...");

      const resultClicked = await waitFor(() => {
        // 全テキストノードを走査して「宛に送信」を含む要素を探す
        const allEls = document.querySelectorAll("a, button, [role='option'], [role='listitem'], mws-contact-selector-button, li, div[tabindex]");
        for (const el of allEls) {
          if (el.offsetParent === null) continue;
          const text = el.textContent || "";
          // 「宛に送信」パターン（"XXX 宛に送信"）
          if (text.includes("宛に送信") && text.includes(phone.slice(-4))) {
            el.click();
            log("STEP2: clicked '宛に送信' item");
            return el;
          }
        }
        // フォールバック: 電話番号を含むクリック可能な要素
        for (const el of allEls) {
          if (el.offsetParent === null) continue;
          const text = el.textContent || "";
          const last4 = phone.replace(/\D/g, "").slice(-4);
          if (text.includes(phone) || text.includes(last4)) {
            // 宛先入力欄自体は除外
            if (el.tagName === "INPUT") continue;
            el.click();
            log("STEP2: clicked phone-matching item");
            return el;
          }
        }
        return null;
      }, 8000).catch(() => null);

      if (!resultClicked) {
        // 最後の手段: Enterキー
        log("STEP2: no result found, pressing Enter");
        recipientInput.focus();
        recipientInput.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", keyCode: 13, bubbles: true }));
        recipientInput.dispatchEvent(new KeyboardEvent("keyup", { key: "Enter", keyCode: 13, bubbles: true }));
      }

      await sleep(2000); // 会話画面が開くのを待つ

      // ========== STEP 3: メッセージ入力欄を見つけて入力 ==========
      log("STEP3: find message input");
      banner("📝 メッセージを入力中...");

      const msgInput = await waitFor(() => {
        // 戦略1: aria-label や placeholder で判定
        const editables = document.querySelectorAll('[contenteditable="true"]');
        for (const ed of editables) {
          if (ed.offsetParent === null) continue;
          const label = (ed.getAttribute("aria-label") || "") +
                        (ed.getAttribute("data-placeholder") || "") +
                        (ed.getAttribute("placeholder") || "");
          if (/メッセージ|message|sms|テキスト|text message/i.test(label)) {
            return ed;
          }
        }
        // 戦略2: 画面下部にある contenteditable（宛先入力とは別のもの）
        const allEditables = document.querySelectorAll('[contenteditable="true"]');
        for (const ed of allEditables) {
          if (ed.offsetParent === null) continue;
          const rect = ed.getBoundingClientRect();
          // 画面の下半分にある & 宛先入力欄ではない
          if (rect.top > window.innerHeight * 0.4 && rect.height < 200) {
            return ed;
          }
        }
        // 戦略3: textarea
        for (const ta of document.querySelectorAll("textarea")) {
          if (ta.offsetParent !== null) return ta;
        }
        return null;
      });

      log("STEP3: found → typing message");
      setInputValue(msgInput, body);
      // Angular 追加イベント
      msgInput.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
      msgInput.dispatchEvent(new InputEvent("input", { bubbles: true, data: body, inputType: "insertText" }));

      await sleep(300);

      // ========== 完了 ==========
      banner("✅ 自動入力完了！ 内容を確認して送信してください", "success");
      log("Done!");
      chrome.storage.local.remove(["sms_phone", "sms_body", "sms_timestamp"]);

    } catch (err) {
      log(`Error: ${err.message}`);
      // フォールバック: クリップボードにコピー
      try { await navigator.clipboard.writeText(body); } catch {}
      banner("⚠️ 自動入力失敗 — メッセージはコピー済（Ctrl+V で貼り付け）", "error");
    }
  }

  // init
  function init() {
    if (!window.location.href.includes("conversations")) return;
    // ページ描画を待つ
    setTimeout(run, 2500);
  }

  if (document.readyState === "complete") init();
  else window.addEventListener("load", init);

  log("Content script loaded");
})();
