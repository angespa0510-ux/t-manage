// T-MANAGE Content Script v2.0
// 通知ポップアップに「自動入力」ボタンを追加 + LINE URL管理
//
// 役割:
//   ① 通知ポップアップを監視してLINE/SMS自動入力ボタンを追加
//   ② LINE URL（お客様用/セラピスト用）をchrome.storageに同期
//   ③ 顧客名・セラピスト名を抽出してbackground.jsに送信

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
      chrome.storage.local.set(data, () => {
        console.log('[T-MANAGE] LINE URL同期:', data);
      });
    }
  }

  // data属性が設定されるまで少し待って同期
  setTimeout(syncLineUrls, 2000);
  // ページ遷移にも対応（SPAなので定期チェック）
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
      // メッセージテキストを取得（プレビュー欄 or コピーボタンの近くのpre/code要素）
      const msgText = getMessageText(refBtn);
      if (!msgText) {
        showToast('メッセージが取得できませんでした', 'error');
        return;
      }

      if (type === 'line_customer') {
        const custName = getTargetName('customer');
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
        const therapistName = getTargetName('therapist');
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
        const phone = getPhoneNumber(refBtn);
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
  //  通知ポップアップのプレビュー欄からテキストを取得
  // ============================================================
  function getMessageText(refBtn) {
    // 方法1: ボタンの近くにある monospace プレビュー欄
    const popup = refBtn.closest('[style*="position"]') || refBtn.closest('div[class*="popup"]') || refBtn.parentElement?.parentElement;
    if (popup) {
      const previewEl = popup.querySelector('[style*="font-family"][style*="monospace"]')
        || popup.querySelector('pre')
        || popup.querySelector('[style*="white-space"][style*="pre"]');
      if (previewEl) return previewEl.textContent?.trim() || '';
    }

    // 方法2: ページ全体から monospace テキストを探す
    const allPreviews = document.querySelectorAll('[style*="font-family"][style*="monospace"]');
    for (const el of allPreviews) {
      const t = el.textContent?.trim();
      if (t && t.length > 10) return t;
    }

    // 方法3: コピーボタンがコピーしたテキストをクリップボードから読む（フォールバック）
    // → セキュリティ制約があるため、コピーボタンを先にクリックしてからクリップボード読み取り
    return '';
  }

  // ============================================================
  //  ターゲット名取得（お客様 or セラピスト）
  // ============================================================
  function getTargetName(targetType) {
    if (targetType === 'customer') {
      return getCustomerName();
    } else {
      return getTherapistName();
    }
  }

  // お客様名を取得
  function getCustomerName() {
    // パターン1: 「XXX 様 |」 形式のヘッダー
    const allEls = document.querySelectorAll('div, span, p, h2, h3');
    for (const el of allEls) {
      if (el.children.length > 5) continue; // 子要素が多すぎるコンテナはスキップ
      const t = (el.textContent || '').trim();
      const m = t.match(/^(.+?)\s*様\s*[|\-]/);
      if (m) {
        return m[1].replace(/\s*L$/i, '').trim();
      }
    }

    // パターン2: 「予約確認通知」の近くのお客様名
    const h2s = document.querySelectorAll('h2, h3, div[style*="font-weight"]');
    for (const h2 of h2s) {
      if ((h2.textContent || '').includes('予約確認') || (h2.textContent || '').includes('通知')) {
        const container = h2.closest('div');
        if (container) {
          const p = container.querySelector('p, span');
          if (p) {
            const m = (p.textContent || '').match(/^(.+?)\s*様/);
            if (m) return m[1].replace(/\s*L$/i, '').trim();
          }
        }
      }
    }

    // パターン3: 通知テキスト内の「○○様」
    const allText = document.querySelectorAll('[style*="monospace"], pre');
    for (const el of allText) {
      const t = el.textContent || '';
      const m = t.match(/^(.+?)様/m);
      if (m && m[1].length <= 20) return m[1].replace(/\s*L$/i, '').trim();
    }

    return '';
  }

  // セラピスト名を取得
  function getTherapistName() {
    // 通知ポップアップの「セラピスト向け」タブ内の宛先名を探す

    // パターン1: セラピスト名が「宛先:」や「○○さん」形式で表示
    const allEls = document.querySelectorAll('div, span, p');
    for (const el of allEls) {
      if (el.children.length > 5) continue;
      const t = (el.textContent || '').trim();
      // 「セラピスト: XXX」パターン
      const m1 = t.match(/セラピスト[：:]\s*(.+)/);
      if (m1) return m1[1].trim();
      // 「担当: XXX」パターン
      const m2 = t.match(/担当[：:]\s*(.+)/);
      if (m2) return m2[1].trim();
    }

    // パターン2: 通知テンプレート内の「○○さん」（先頭行）
    const allText = document.querySelectorAll('[style*="monospace"], pre');
    for (const el of allText) {
      const t = el.textContent || '';
      const m = t.match(/^(.+?)さん/m);
      if (m && m[1].length <= 20) return m[1].trim();
    }

    // パターン3: セラピスト欄のセレクトボックスの選択値
    const selects = document.querySelectorAll('select');
    for (const sel of selects) {
      const label = sel.closest('label, div')?.textContent || '';
      if (label.includes('セラピスト') || label.includes('担当')) {
        if (sel.value) return sel.value;
      }
    }

    return '';
  }

  // ============================================================
  //  電話番号取得
  // ============================================================
  function getPhoneNumber(refBtn) {
    // ボタンテキストから電話番号を抽出
    const btnText = refBtn.textContent || '';
    const m1 = btnText.match(/[\d\-]{10,}/);
    if (m1) return m1[0].replace(/\D/g, '');

    // ボタン近くの要素から電話番号を探す
    const container = refBtn.closest('div');
    if (container) {
      const t = container.textContent || '';
      const m2 = t.match(/0\d{1,4}[\-\s]?\d{1,4}[\-\s]?\d{3,4}/);
      if (m2) return m2[0].replace(/\D/g, '');
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

  console.log('[T-MANAGE] content_tmanage.js v2.0 loaded');
})();
