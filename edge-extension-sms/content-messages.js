// T-MANAGE SMS② — Googleメッセージ自動入力 v4
// 複数クリック戦略 + キーボード選択

(function () {
  "use strict";

  const LOG = "[T-MANAGE SMS②]";
  function log(msg) { console.log(`${LOG} ${msg}`); }
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  function waitFor(fn, timeout = 15000) {
    return new Promise((resolve, reject) => {
      const t0 = Date.now();
      const tick = () => {
        const el = fn();
        if (el) return resolve(el);
        if (Date.now() - t0 > timeout) return reject(new Error("timeout"));
        setTimeout(tick, 300);
      };
      tick();
    });
  }

  // input にテキスト設定
  function setInputValue(el, text) {
    el.focus();
    if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
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

  // 全力クリック: .click() + 合成イベント + PointerEvent + 祖先5階層
  function forceClick(el) {
    log(`forceClick: tag=${el.tagName} class="${el.className}" text="${(el.textContent || "").slice(0, 30)}"`);

    // 戦略A: ネイティブ .click()
    el.click();

    // 戦略B: PointerEvent + MouseEvent
    const rect = el.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const opts = { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0, view: window };

    el.dispatchEvent(new PointerEvent("pointerdown", { ...opts, pointerId: 1 }));
    el.dispatchEvent(new MouseEvent("mousedown", opts));
    el.dispatchEvent(new PointerEvent("pointerup", { ...opts, pointerId: 1 }));
    el.dispatchEvent(new MouseEvent("mouseup", opts));
    el.dispatchEvent(new MouseEvent("click", opts));

    // 祖先にも .click() を伝播
    let parent = el.parentElement;
    for (let i = 0; i < 5 && parent; i++) {
      parent.click();
      parent = parent.parentElement;
    }
  }

  // テキストを含む要素を全DOM走査（最小サイズ優先）
  function findByText(text) {
    let best = null;
    let bestLen = Infinity;
    for (const el of document.querySelectorAll("*")) {
      if (el.offsetParent === null && el.style?.display !== "contents") continue;
      const t = el.textContent || "";
      if (!t.includes(text)) continue;
      const rect = el.getBoundingClientRect();
      if (rect.height < 15 || rect.height > 200 || rect.width < 30) continue;
      if (t.length < bestLen) { bestLen = t.length; best = el; }
    }
    return best;
  }

  // バナー
  function banner(msg, type = "info") {
    let b = document.getElementById("tm-sms-banner");
    if (!b) {
      b = document.createElement("div");
      b.id = "tm-sms-banner";
      b.style.cssText = `
        position:fixed;top:0;left:0;right:0;z-index:99999;
        padding:10px 20px;font-size:13px;font-weight:600;
        text-align:center;font-family:'Hiragino Sans',sans-serif;
        box-shadow:0 2px 12px rgba(0,0,0,.3);
      `;
      document.body.appendChild(b);
    }
    const C = { info: "#8b5cf6", success: "#22c55e", error: "#ef4444" };
    b.style.backgroundColor = C[type] || C.info;
    b.style.color = "#fff";
    b.textContent = msg;
    b.style.display = "block";
    if (type === "success") setTimeout(() => b.style.display = "none", 8000);
  }

  // ===== メイン =====
  async function run() {
    const data = await new Promise(r =>
      chrome.storage.local.get(["sms_phone", "sms_body", "sms_timestamp"], r)
    );
    if (!data.sms_phone) return;
    if (data.sms_timestamp && Date.now() - data.sms_timestamp > 5 * 60000) {
      chrome.storage.local.remove(["sms_phone", "sms_body", "sms_timestamp"]);
      return;
    }

    const phone = data.sms_phone;
    const body = data.sms_body;
    log(`Start: phone=${phone}`);
    banner(`📲 ${phone} に自動入力中...`);

    try {
      // ========== STEP 1: 宛先に電話番号入力 ==========
      const recipientInput = await waitFor(() => {
        for (const inp of document.querySelectorAll("input")) {
          if (inp.offsetParent !== null && inp.type !== "hidden") return inp;
        }
        return null;
      });

      setInputValue(recipientInput, phone);
      banner(`🔍 ${phone} を検索中...`);
      await sleep(3000); // 検索結果表示まで十分待つ

      // ========== STEP 2: 検索結果をクリック ==========
      log("STEP2: click search result");
      banner("🔍 検索結果を選択中...");

      let conversationOpened = false;

      // --- 試行A: 「宛に送信」要素を全DOM走査で探してクリック ---
      const sendToEl = findByText("宛に送信");
      if (sendToEl) {
        log("STEP2-A: found '宛に送信', force-clicking");
        forceClick(sendToEl);
        await sleep(2000);

        // 遷移したか確認
        if (!window.location.href.includes("/conversations/new")) {
          conversationOpened = true;
          log("STEP2-A: navigation detected!");
        }
      }

      // --- 試行B: まだ /new にいるならキーボード操作 ---
      if (!conversationOpened) {
        log("STEP2-B: trying keyboard Enter on input");
        recipientInput.focus();
        // Enter キーイベント（複数パターン）
        const enterOpts = { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true, cancelable: true };
        recipientInput.dispatchEvent(new KeyboardEvent("keydown", enterOpts));
        recipientInput.dispatchEvent(new KeyboardEvent("keypress", enterOpts));
        recipientInput.dispatchEvent(new KeyboardEvent("keyup", enterOpts));
        await sleep(2000);
      }

      // --- 試行C: まだ /new にいるなら座標クリック ---
      if (window.location.href.includes("/conversations/new")) {
        log("STEP2-C: trying coordinate-based click");
        // 「宛に送信」の座標を取得して document.elementFromPoint でクリック
        const el2 = findByText("宛に送信");
        if (el2) {
          const r = el2.getBoundingClientRect();
          const target = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          if (target) {
            log(`STEP2-C: elementFromPoint found: ${target.tagName}.${target.className}`);
            target.click();
            forceClick(target);
          }
        }
        await sleep(2000);
      }

      // --- 試行D: まだ /new ならDown Arrow + Enter ---
      if (window.location.href.includes("/conversations/new")) {
        log("STEP2-D: trying ArrowDown + Enter");
        recipientInput.focus();
        const arrowOpts = { key: "ArrowDown", code: "ArrowDown", keyCode: 40, which: 40, bubbles: true };
        recipientInput.dispatchEvent(new KeyboardEvent("keydown", arrowOpts));
        recipientInput.dispatchEvent(new KeyboardEvent("keyup", arrowOpts));
        await sleep(500);
        const enterOpts2 = { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true };
        recipientInput.dispatchEvent(new KeyboardEvent("keydown", enterOpts2));
        recipientInput.dispatchEvent(new KeyboardEvent("keyup", enterOpts2));
        await sleep(2000);
      }

      // --- 試行E: DOM属性を詳細ログ ---
      if (window.location.href.includes("/conversations/new")) {
        log("STEP2-E: dumping '宛に送信' element info for debugging");
        const debugEl = findByText("宛に送信");
        if (debugEl) {
          log(`  tag: ${debugEl.tagName}`);
          log(`  id: ${debugEl.id}`);
          log(`  class: ${debugEl.className}`);
          log(`  role: ${debugEl.getAttribute("role")}`);
          log(`  tabindex: ${debugEl.getAttribute("tabindex")}`);
          log(`  outerHTML preview: ${debugEl.outerHTML.slice(0, 300)}`);
          // 親要素も
          let p = debugEl.parentElement;
          for (let i = 0; i < 3 && p; i++) {
            log(`  parent${i+1}: ${p.tagName}.${(p.className||"").slice(0,50)} role=${p.getAttribute("role")} tabindex=${p.getAttribute("tabindex")}`);
            p = p.parentElement;
          }
        }
      }

      // ========== STEP 3: メッセージ入力 ==========
      log("STEP3: message input");
      banner("📝 メッセージを入力中...");

      const msgInput = await waitFor(() => {
        const editables = document.querySelectorAll('[contenteditable="true"]');
        for (const ed of editables) {
          if (ed.offsetParent === null) continue;
          const label = (ed.getAttribute("aria-label") || "") +
                        (ed.getAttribute("data-placeholder") || "");
          if (/メッセージ|message|sms|テキスト/i.test(label)) return ed;
        }
        for (const ed of editables) {
          if (ed.offsetParent === null) continue;
          const rect = ed.getBoundingClientRect();
          if (rect.top > window.innerHeight * 0.4) return ed;
        }
        for (const ta of document.querySelectorAll("textarea")) {
          if (ta.offsetParent !== null) return ta;
        }
        return null;
      }, 10000);

      log("STEP3: typing message");
      setInputValue(msgInput, body);
      msgInput.dispatchEvent(new InputEvent("input", {
        bubbles: true, composed: true, data: body, inputType: "insertText"
      }));

      banner("✅ 自動入力完了！ 内容を確認して送信してください", "success");
      log("Done!");
      chrome.storage.local.remove(["sms_phone", "sms_body", "sms_timestamp"]);

    } catch (err) {
      log(`Error: ${err.message}`);
      try { await navigator.clipboard.writeText(body); } catch {}
      banner("⚠️ 自動入力失敗 — メッセージはコピー済（Ctrl+V で貼り付け）", "error");
    }
  }

  function init() {
    if (!window.location.href.includes("conversations")) return;
    setTimeout(run, 2500);
  }

  if (document.readyState === "complete") init();
  else window.addEventListener("load", init);
  log("Content script v4 loaded");
})();
