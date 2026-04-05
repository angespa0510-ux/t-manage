// T-MANAGE Content Script v3.0
// 通知ポップアップに「自動入力」ボタンを追加 + LINE URL管理
//
// v3.0: data属性方式に全面切り替え
//   T-MANAGEのタイムチャートが以下のdata属性をポップアップに埋め込む:
//     data-tm-notify="true"     — ポップアップ識別
//     data-tm-custname="名前"    — お客様名
//     data-tm-therapist="名前"  — セラピスト名
//     data-tm-phone="電話番号"   — 電話番号
//     data-tm-preview="true"    — メッセージプレビュー欄

(function () {
  'use strict';

  // ============================================================
  //  LINE URL をページの data属性 → chrome.storage に同期
  // ============================================================
  function syncLineUrls() {
    const urlCustomer = document.body.dataset.lineUrlCustomer || '';
    const urlStaff = document.body.dataset.lineUrlStaff || '';
    if (urlCustomer || urlStaff) {
      const data = {};
      if (urlCustomer) data.line_url_customer = urlCustomer;
      if (urlStaff) data.line_url_therapist = urlStaff;
      chrome.storage.local.set(data);
    }
  }
  setTimeout(syncLineUrls, 2000);
  setInterval(syncLineUrls, 10000);

  // ============================================================
  //  通知ポップアップ監視
  // ============================================================
  const observer = new MutationObserver(() => { enhanceNotifyPopup(); });
  observer.observe(document.body, { childList: true, subtree: true });

  function enhanceNotifyPopup() {
    const buttons = document.querySelectorAll('button');

    buttons.forEach((btn) => {
      const text = btn.textContent || '';

      // お客様向けLINEボタン
      if (text.includes('LINE用テキストをコピー') && !btn.dataset.tmEnhanced) {
        btn.dataset.tmEnhanced = 'true';
        addAutoButton(btn, 'line_customer', '🚀 LINE自動入力', '#06C755');
      }

      // セラピスト向けLINEボタン
      if (text.includes('セラピストLINE用コピー') && !btn.dataset.tmEnhanced) {
        btn.dataset.tmEnhanced = 'true';
        addAutoButton(btn, 'line_therapist', '🚀 セラピストLINE自動入力', '#85a8c4');
      }

      // SMS送信ボタン
      if (text.includes('SMS用コピー') && !btn.dataset.tmEnhanced) {
        btn.dataset.tmEnhanced = 'true';
        addAutoButton(btn, 'sms', '🚀 SMS自動入力', '#f59e0b');
      }
    });
  }

  // ============================================================
  //  自動入力ボタンを追加
  // ============================================================
  function addAutoButton(refBtn, type, label, color) {
    const autoBtn = document.createElement('button');
    autoBtn.textContent = label;
    autoBtn.style.cssText = `
      width: 100%; padding: 12px; border-radius: 12px; font-size: 13px;
      font-weight: 500; cursor: pointer; margin-top: 6px;
      background-color: ${color}; color: white; border: none;
      transition: opacity 0.2s;
    `;
    autoBtn.onmouseover = () => autoBtn.style.opacity = '0.85';
    autoBtn.onmouseout = () => autoBtn.style.opacity = '1';

    autoBtn.addEventListener('click', () => {
      // ① メッセージテキスト取得（data-tm-preview属性）
      const msgText = getMessageText();
      if (!msgText) {
        showToast('メッセージが取得できませんでした', 'error');
        return;
      }

      // ② data属性から名前・電話番号を取得
      const popup = document.querySelector('[data-tm-notify="true"]');
      const custName = popup?.getAttribute('data-tm-custname') || '';
      const therapistName = popup?.getAttribute('data-tm-therapist') || '';
      const phone = (popup?.getAttribute('data-tm-phone') || '').replace(/\D/g, '');

      if (type === 'line_customer') {
        if (!custName) {
          showToast('お客様名が取得できませんでした', 'error');
          return;
        }
        showToast(`🔍 ${custName} をLINEで検索します...`, 'success');
        chrome.runtime.sendMessage({
          type: 'SEARCH_LINE_CUSTOMER',
          name: custName,
          template: msgText
        });
      }

      else if (type === 'line_therapist') {
        if (!therapistName) {
          showToast('セラピスト名が取得できませんでした', 'error');
          return;
        }
        showToast(`🔍 ${therapistName} をLINEで検索します...`, 'success');
        chrome.runtime.sendMessage({
          type: 'SEARCH_LINE_THERAPIST',
          name: therapistName,
          template: msgText
        });
      }

      else if (type === 'sms') {
        if (!phone) {
          showToast('電話番号が取得できませんでした', 'error');
          return;
        }
        showToast(`📱 ${phone} にSMSを送ります...`, 'success');
        chrome.runtime.sendMessage({
          type: 'OPEN_SMS',
          phone: phone,
          template: msgText
        });
      }
    });

    refBtn.parentNode.insertBefore(autoBtn, refBtn.nextSibling);
  }

  // ============================================================
  //  メッセージテキスト取得
  // ============================================================
  function getMessageText() {
    // 方法1: data-tm-preview 属性で確実に取得
    const preview = document.querySelector('[data-tm-preview="true"]');
    if (preview) {
      const t = preview.textContent?.trim();
      if (t && t.length > 10) return t;
    }

    // 方法2: フォールバック — monospace スタイルのプレビュー欄
    const popup = document.querySelector('[data-tm-notify="true"]');
    if (popup) {
      const divs = popup.querySelectorAll('div');
      for (const div of divs) {
        const style = div.getAttribute('style') || '';
        if (style.includes('monospace') || style.includes('font-mono')) {
          const t = div.textContent?.trim();
          if (t && t.length > 10) return t;
        }
      }
    }

    return '';
  }

  // ============================================================
  //  トースト通知
  // ============================================================
  function showToast(msg, type) {
    const existing = document.querySelector('.tm-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'tm-toast';
    toast.textContent = msg;
    toast.style.cssText = `
      position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
      padding: 12px 24px; border-radius: 12px; font-size: 13px; z-index: 99999;
      background-color: ${type === 'success' ? '#22c55e' : type === 'error' ? '#ef4444' : '#3b82f6'}; color: white;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }

  console.log('[T-MANAGE] content_tmanage.js v3.0 loaded');
})();
