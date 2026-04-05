// Google Messages (messages.google.com) Content Script v2.0
// SMS送信の自動入力
//
// 役割:
//   ① 電話番号で会話を検索
//   ② メッセージ入力欄にテキストを自動入力
//   ③ 新規会話の作成（電話番号入力）

(function () {
  'use strict';

  // ============================================================
  //  CSS アニメーション
  // ============================================================
  const style = document.createElement('style');
  style.textContent = `@keyframes tmSlideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }`;
  document.head.appendChild(style);

  // ============================================================
  //  メッセージ受信ハンドラ
  // ============================================================
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'FILL_SMS' || msg.action === 'fill_sms') {
      const phone = msg.phone || msg.pending_target || '';
      const template = msg.template || msg.text || '';
      handleSmsInput(phone, template);
      sendResponse({ ok: true });
    }
    if (msg.type === 'PING') {
      sendResponse({ type: 'PONG', alive: true });
    }
  });

  // ============================================================
  //  起動時: 保留メッセージ確認
  // ============================================================
  function checkPendingOnLoad() {
    let attempts = 0;

    function tryCheck() {
      attempts++;
      // Google Messagesが読み込まれたか確認
      const main = document.querySelector('mws-conversations-list, mw-conversation-container, [role="main"]');
      if (main) {
        chrome.runtime.sendMessage({ action: 'get_pending' }, (data) => {
          if (chrome.runtime.lastError) return;
          if (data && data.pending_type === 'sms' && data.pending_message) {
            handleSmsInput(data.pending_target || '', data.pending_message);
          }
        });
      } else if (attempts < 30) {
        setTimeout(tryCheck, 500);
      }
    }
    setTimeout(tryCheck, 1000);
  }

  checkPendingOnLoad();

  // ============================================================
  //  SMS入力処理
  // ============================================================
  function handleSmsInput(phone, template) {
    if (!phone) {
      showIndicator('⚠️ 電話番号が指定されていません', 'warning');
      return;
    }

    showIndicator(`📱 ${formatPhone(phone)} を検索中...`, 'info');

    // 方法1: 「新しい会話」ボタンを探してクリック → 電話番号入力
    tryStartNewConversation(phone, template);
  }

  // ============================================================
  //  新しい会話を開始して電話番号を入力
  // ============================================================
  function tryStartNewConversation(phone, template) {
    // Google Messagesの「新しい会話」ボタンを探す
    const newChatBtn = document.querySelector('[data-e2e-new-conversation]')
      || document.querySelector('a[href*="new"]')
      || findButtonByText('新しい会話')
      || findButtonByText('Start chat')
      || findButtonByText('New conversation');

    if (newChatBtn) {
      newChatBtn.click();
      // 電話番号入力欄が表示されるまで待つ
      setTimeout(() => typePhoneNumber(phone, template), 800);
    } else {
      // 既存の会話リストから電話番号で検索
      searchInConversationList(phone, template);
    }
  }

  // ボタンをテキストで検索
  function findButtonByText(text) {
    const buttons = document.querySelectorAll('button, a, [role="button"]');
    for (const btn of buttons) {
      if ((btn.textContent || '').includes(text)) return btn;
    }
    return null;
  }

  // 電話番号を入力
  function typePhoneNumber(phone, template) {
    // 宛先入力欄を探す
    const phoneInput = document.querySelector('input[type="tel"]')
      || document.querySelector('input[placeholder*="番号"]')
      || document.querySelector('input[placeholder*="number"]')
      || document.querySelector('input[placeholder*="名前"]')
      || document.querySelector('input[placeholder*="name"]')
      || document.querySelector('[contenteditable="true"]');

    if (phoneInput) {
      phoneInput.focus();
      if (phoneInput.tagName === 'INPUT' || phoneInput.tagName === 'TEXTAREA') {
        setNativeValue(phoneInput, phone);
      } else {
        phoneInput.textContent = phone;
        phoneInput.dispatchEvent(new Event('input', { bubbles: true }));
      }

      // 検索結果を待って選択
      setTimeout(() => {
        selectPhoneResult(phone, template);
      }, 1500);
    } else {
      showIndicator('⚠️ 電話番号入力欄が見つかりません', 'warning');
      // フォールバック: テキストのみクリップボードにコピー
      copyToClipboard(template);
    }
  }

  // 検索結果から電話番号を選択
  function selectPhoneResult(phone, template) {
    const cleanPhone = phone.replace(/\D/g, '');
    const results = document.querySelectorAll('[role="listitem"], [role="option"], mws-contact-list-item');

    let found = false;
    for (const r of results) {
      const txt = (r.textContent || '').replace(/\D/g, '');
      if (txt.includes(cleanPhone)) {
        r.click();
        found = true;
        break;
      }
    }

    if (!found) {
      // 電話番号テキストでエンターキーを送信
      const activeInput = document.activeElement;
      if (activeInput) {
        activeInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      }
    }

    // メッセージ入力
    setTimeout(() => fillMessageInput(template, 0), 1500);
  }

  // 既存の会話リストから検索
  function searchInConversationList(phone, template) {
    const cleanPhone = phone.replace(/\D/g, '');

    // 検索入力欄を探す
    const searchInput = document.querySelector('input[placeholder*="検索"]')
      || document.querySelector('input[placeholder*="Search"]')
      || document.querySelector('input[aria-label*="検索"]');

    if (searchInput) {
      searchInput.focus();
      setNativeValue(searchInput, phone);

      setTimeout(() => {
        // 検索結果から選択
        const items = document.querySelectorAll('[role="listitem"], mws-conversation-list-item');
        for (const item of items) {
          const txt = (item.textContent || '').replace(/\D/g, '');
          if (txt.includes(cleanPhone)) {
            item.click();
            setTimeout(() => fillMessageInput(template, 0), 1500);
            return;
          }
        }
        // 見つからない → 新規会話を試みる
        showIndicator(`📱 ${formatPhone(phone)} の会話が見つかりません。テキストをコピーしました。`, 'warning');
        copyToClipboard(template);
      }, 1500);
    } else {
      showIndicator('⚠️ 検索欄が見つかりません', 'warning');
      copyToClipboard(template);
    }
  }

  // ============================================================
  //  メッセージ入力欄にテキストをセット
  // ============================================================
  function fillMessageInput(template, retryCount) {
    const textarea = findMessageInput();

    if (!textarea) {
      if (retryCount < 10) {
        setTimeout(() => fillMessageInput(template, retryCount + 1), 500);
      } else {
        showIndicator('⚠️ メッセージ入力欄が見つかりません。テキストをコピーしました。', 'warning');
        copyToClipboard(template);
      }
      return;
    }

    textarea.focus();

    if (textarea.tagName === 'TEXTAREA' || textarea.tagName === 'INPUT') {
      setNativeValue(textarea, template);
    } else if (textarea.getAttribute('contenteditable') === 'true' || textarea.getAttribute('role') === 'textbox') {
      textarea.innerHTML = '';
      const lines = template.split('\n');
      lines.forEach((line, i) => {
        textarea.appendChild(document.createTextNode(line));
        if (i < lines.length - 1) textarea.appendChild(document.createElement('br'));
      });
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    }

    showIndicator('✅ メッセージを入力しました！内容を確認して送信してください。', 'success');
    chrome.runtime.sendMessage({ action: 'clear_pending' });
  }

  // メッセージ入力欄を探す
  function findMessageInput() {
    const selectors = [
      'mws-autosize-textarea textarea',
      'textarea[placeholder*="メッセージ"]',
      'textarea[placeholder*="Text message"]',
      'textarea[placeholder*="テキスト"]',
      '[contenteditable="true"][role="textbox"]',
      '.input-box textarea',
      'textarea'
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el && isVisible(el)) return el;
    }
    return null;
  }

  // ============================================================
  //  ユーティリティ
  // ============================================================
  function setNativeValue(el, value) {
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement : HTMLInputElement;
    const nativeSetter = Object.getOwnPropertyDescriptor(proto.prototype, 'value')?.set;
    if (nativeSetter) {
      nativeSetter.call(el, value);
    } else {
      el.value = value;
    }
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function isVisible(el) {
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function formatPhone(phone) {
    const clean = phone.replace(/\D/g, '');
    if (clean.length === 11) {
      return `${clean.slice(0, 3)}-${clean.slice(3, 7)}-${clean.slice(7)}`;
    }
    return phone;
  }

  function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
      showIndicator('📋 テキストをクリップボードにコピーしました。貼り付けてください。', 'info');
    }).catch(() => {});
  }

  // ============================================================
  //  インジケーター表示
  // ============================================================
  function showIndicator(msg, type) {
    const existing = document.getElementById('tm-indicator');
    if (existing) existing.remove();

    const div = document.createElement('div');
    div.id = 'tm-indicator';
    const colors = {
      success: '#22c55e',
      warning: '#f59e0b',
      info: '#3b82f6',
      error: '#ef4444'
    };
    div.style.cssText = `
      position: fixed; top: 10px; right: 10px; z-index: 99999;
      padding: 12px 20px; border-radius: 12px; font-size: 13px;
      background-color: ${colors[type] || colors.info}; color: white; max-width: 350px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      animation: tmSlideIn 0.3s ease-out;
    `;
    div.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px">
        <span>${msg}</span>
        <button id="tm-close" style="background:none;border:none;color:white;cursor:pointer;font-size:16px;padding:0 4px">✕</button>
      </div>
    `;
    document.body.appendChild(div);
    div.querySelector('#tm-close')?.addEventListener('click', () => div.remove());

    if (type === 'success' || type === 'info') setTimeout(() => div.remove(), 5000);
    if (type === 'warning') setTimeout(() => div.remove(), 10000);
  }

  console.log('[T-MANAGE] content_sms.js v2.0 loaded');
})();
