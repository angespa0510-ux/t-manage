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
  //  通知ポップアップ監視（デバウンス + 再入防止）
  // ============================================================
  let debounceTimer = null;
  let isEnhancing = false;

  const observer = new MutationObserver(() => {
    if (isEnhancing) return; // 自分のDOM変更は無視
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(enhanceNotifyPopup, 300);
  });
  observer.observe(document.body, { childList: true, subtree: true });

  function enhanceNotifyPopup() {
    const popup = document.querySelector('[data-tm-notify="true"]');
    if (!popup) return;

    // 現在のコピーボタンを確認
    const buttons = popup.querySelectorAll('button');
    let needsCustomer = false;
    let needsTherapist = false;
    let needsSms = false;

    buttons.forEach((btn) => {
      const text = btn.textContent || '';
      if (text.includes('LINE用テキストをコピー') && !text.includes('セラピスト')) needsCustomer = true;
      if (text.includes('セラピストLINE用コピー')) needsTherapist = true;
      if (text.includes('SMS用コピー')) needsSms = true;
    });

    // 既に正しい自動ボタンが存在するかチェック
    const existingAutos = document.querySelectorAll('[data-tm-auto]');
    const existingTypes = new Set();
    existingAutos.forEach(btn => existingTypes.add(btn.getAttribute('data-tm-auto')));

    const correctAlready =
      (needsCustomer === existingTypes.has('line_customer')) &&
      (needsTherapist === existingTypes.has('line_therapist')) &&
      (needsSms === existingTypes.has('sms')) &&
      existingTypes.size === (needsCustomer ? 1 : 0) + (needsTherapist ? 1 : 0) + (needsSms ? 1 : 0);

    if (correctAlready) return; // 変更不要

    // DOM変更開始 — Observerを一時停止
    isEnhancing = true;

    // 古いボタンを削除
    existingAutos.forEach(btn => btn.remove());

    // 新しいボタンを追加
    buttons.forEach((btn) => {
      const text = btn.textContent || '';
      if (text.includes('LINE用テキストをコピー') && !text.includes('セラピスト')) {
        addAutoButton(btn, 'line_customer', '🚀 お客様LINE自動入力', '#06C755');
      }
      if (text.includes('セラピストLINE用コピー')) {
        addAutoButton(btn, 'line_therapist', '🚀 セラピストLINE自動入力', '#85a8c4');
      }
      if (text.includes('SMS用コピー')) {
        addAutoButton(btn, 'sms', '🚀 SMS自動入力', '#f59e0b');
      }
    });

    // DOM変更完了 — 少し待ってからObserverを再開
    setTimeout(() => { isEnhancing = false; }, 200);
  }

  // ============================================================
  //  自動入力ボタンを追加（data-tm-auto属性付き）
  // ============================================================
  function addAutoButton(refBtn, type, label, color) {
    const autoBtn = document.createElement('button');
    autoBtn.textContent = label;
    autoBtn.setAttribute('data-tm-auto', type); // 識別用属性
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

      console.log('[T-MANAGE] ボタン種別:', type, '| お客様名:', custName, '| セラピスト名:', therapistName, '| 電話:', phone);

      if (type === 'line_customer') {
        if (!custName) {
          showToast('お客様名が取得できませんでした', 'error');
          return;
        }
        showToast(`🔍 ${custName} をお客様LINEで検索します...`, 'success');
        safeSendMessage({
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
        showToast(`🔍 ${therapistName} をセラピストLINEで検索します...`, 'success');
        safeSendMessage({
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
        safeSendMessage({
          type: 'OPEN_SMS',
          phone: phone,
          template: msgText
        });
      }
    });

    refBtn.parentNode.insertBefore(autoBtn, refBtn.nextSibling);
  }

  // ============================================================
  //  メッセージ送信（Service Workerスリープ対応のリトライ付き）
  // ============================================================
  function safeSendMessage(msg, retryCount = 0) {
    try {
      chrome.runtime.sendMessage(msg, (response) => {
        if (chrome.runtime.lastError) {
          console.log('[T-MANAGE] sendMessage error:', chrome.runtime.lastError.message);
          if (retryCount < 2) {
            // Service Workerがスリープ中の可能性 → 少し待ってリトライ
            setTimeout(() => safeSendMessage(msg, retryCount + 1), 500);
          } else {
            showToast('⚠️ 拡張機能との通信に失敗しました。ページをリロードしてください。', 'error');
          }
        }
      });
    } catch (e) {
      console.error('[T-MANAGE] sendMessage exception:', e);
      if (retryCount < 2) {
        setTimeout(() => safeSendMessage(msg, retryCount + 1), 500);
      }
    }
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
