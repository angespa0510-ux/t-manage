// T-MANAGE Content Script v2.1
// 通知ポップアップに「自動入力」ボタンを追加 + LINE URL管理
//
// ⚠️ v2.0バグ修正: ページ全体を検索していたため、タイムチャートのテキストが
//    検索欄に入力されていた。v2.1ではすべての抽出を通知ポップアップ内に限定。

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

  // ============================================================
  //  通知ポップアップを特定する
  //  構造: div.fixed > div.rounded-2xl > (header with 📩 予約確認通知) + (body)
  // ============================================================
  function findNotifyPopup() {
    // h2 に「予約確認通知」があるポップアップを探す
    const headings = document.querySelectorAll('h2');
    for (const h2 of headings) {
      if ((h2.textContent || '').includes('予約確認通知')) {
        // h2 → header div → card div → overlay div
        const card = h2.closest('div[class*="rounded"]') || h2.closest('div')?.parentElement;
        if (card) return card;
      }
    }
    return null;
  }

  // ============================================================
  //  ポップアップ内でお客様名を取得
  //  ヘッダーの <p> に「{名前} 様 | {日付}〜」形式で表示されている
  // ============================================================
  function getCustomerName(popup) {
    if (!popup) return '';

    // パターン1: ポップアップ内の「XXX 様 |」パターン（ヘッダーのp要素）
    const allEls = popup.querySelectorAll('p, span, div');
    for (const el of allEls) {
      if (el.children.length > 3) continue;
      const t = (el.textContent || '').trim();
      // 「名前 様 | 日付」形式にマッチ
      const m = t.match(/^(.+?)\s*様\s*[|｜]/);
      if (m) {
        return m[1].replace(/\s*L$/i, '').trim();
      }
    }

    // パターン2: 「予約確認通知」h2の直後のp要素
    const h2s = popup.querySelectorAll('h2');
    for (const h2 of h2s) {
      if ((h2.textContent || '').includes('予約確認通知')) {
        const container = h2.parentElement;
        if (container) {
          const p = container.querySelector('p');
          if (p) {
            const m = (p.textContent || '').match(/^(.+?)\s*様/);
            if (m) return m[1].replace(/\s*L$/i, '').trim();
          }
        }
      }
    }

    return '';
  }

  // ============================================================
  //  ポップアップ内でセラピスト名を取得
  //  セラピスト向けテンプレート内の「{名前}さん」パターン
  // ============================================================
  function getTherapistName(popup) {
    if (!popup) return '';

    // 方法1: セラピスト向けメッセージ内の「○○さん」（先頭行）
    // セラピスト向けタブが表示中の場合、monospace内にスタッフメッセージが表示
    const monospaceEls = popup.querySelectorAll('[style*="monospace"], [style*="font-family"]');
    for (const el of monospaceEls) {
      const t = el.textContent || '';
      // 「お疲れ様です」で始まるならセラピスト向けテンプレート
      // 「お客様 : XXX」の行からお客様名ではなく、宛先のセラピスト名が必要
      // テンプレートの最初の行のパターンで判定
      const lines = t.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        // 「XXXさん」パターン（メッセージ冒頭の呼びかけ）
        if (trimmed.match(/^(.{1,15})さん[、！!]?$/)) {
          const m = trimmed.match(/^(.+?)さん/);
          if (m) return m[1].trim();
        }
      }
    }

    // 方法2: ポップアップ内のヘッダーからセラピスト名
    // 「セラピスト: XXX」形式
    const allText = popup.querySelectorAll('p, span, div, label');
    for (const el of allText) {
      if (el.children.length > 3) continue;
      const t = (el.textContent || '').trim();
      const m1 = t.match(/セラピスト[：:]\s*(.+)/);
      if (m1) return m1[1].trim();
      const m2 = t.match(/担当[：:]\s*(.+)/);
      if (m2) return m2[1].trim();
    }

    return '';
  }

  // ============================================================
  //  ポップアップ内でメッセージテキスト取得
  //  monospace フォントのプレビュー div 内のテキスト
  // ============================================================
  function getMessageText(popup) {
    if (!popup) return '';

    // monospace スタイルのプレビュー div を探す
    // T-MANAGEの通知ポップアップは fontFamily: "var(--font-mono, monospace)" でプレビュー表示
    const allDivs = popup.querySelectorAll('div');
    for (const div of allDivs) {
      const style = div.getAttribute('style') || '';
      const cls = div.getAttribute('class') || '';
      // monospace フォントかつ white-space: pre-wrap のプレビュー欄
      if ((style.includes('monospace') || style.includes('font-mono')) &&
          (style.includes('white-space') || cls.includes('whitespace-pre'))) {
        const t = div.textContent?.trim();
        if (t && t.length > 10) return t;
      }
    }

    // フォールバック: style に font-family が含まれる要素
    for (const div of allDivs) {
      const style = div.getAttribute('style') || '';
      if (style.includes('font-family') && (style.includes('mono') || style.includes('Mono'))) {
        const t = div.textContent?.trim();
        if (t && t.length > 10) return t;
      }
    }

    // フォールバック2: computed style で monospace を探す
    for (const div of allDivs) {
      try {
        const cs = window.getComputedStyle(div);
        if (cs.fontFamily && cs.fontFamily.includes('monospace') && cs.whiteSpace.includes('pre')) {
          const t = div.textContent?.trim();
          if (t && t.length > 10) return t;
        }
      } catch (e) { /* ignore */ }
    }

    return '';
  }

  // ============================================================
  //  電話番号取得
  // ============================================================
  function getPhoneNumber(popup, refBtn) {
    // ボタンテキストから電話番号を抽出（「SMS用コピー（09012345678）」）
    const btnText = refBtn.textContent || '';
    const m1 = btnText.match(/[0\d][\d\-]{9,}/);
    if (m1) return m1[0].replace(/\D/g, '');

    // ポップアップ内のSMS対象バッジから電話番号を探す
    if (popup) {
      const badges = popup.querySelectorAll('[style*="f59e0b"], [style*="SMS"]');
      for (const badge of badges) {
        const t = badge.textContent || '';
        const m = t.match(/[\d\-]{10,}/);
        if (m) return m[0].replace(/\D/g, '');
      }
      // バッジ全般から電話番号を探す
      const allSpans = popup.querySelectorAll('span, div');
      for (const el of allSpans) {
        const t = (el.textContent || '').trim();
        if (t.includes('SMS') || t.includes('📱')) {
          const m = t.match(/0\d{1,4}[\-]?\d{1,4}[\-]?\d{3,4}/);
          if (m) return m[0].replace(/\D/g, '');
        }
      }
    }

    return '';
  }

  // ============================================================
  //  ポップアップ内のボタン強化
  // ============================================================
  function enhanceNotifyPopup() {
    const popup = findNotifyPopup();
    if (!popup) return;

    const buttons = popup.querySelectorAll('button');

    buttons.forEach((btn) => {
      const text = btn.textContent || '';

      // お客様向けLINEボタン
      if (text.includes('LINE用テキストをコピー') && !btn.dataset.tmEnhanced) {
        btn.dataset.tmEnhanced = 'true';
        addAutoButton(btn, 'line_customer', '🚀 LINE自動入力', '#06C755', popup);
      }

      // セラピスト向けLINEボタン
      if (text.includes('セラピストLINE用コピー') && !btn.dataset.tmEnhanced) {
        btn.dataset.tmEnhanced = 'true';
        addAutoButton(btn, 'line_therapist', '🚀 セラピストLINE自動入力', '#85a8c4', popup);
      }

      // SMS送信ボタン
      if (text.includes('SMS用コピー') && !btn.dataset.tmEnhanced) {
        btn.dataset.tmEnhanced = 'true';
        addAutoButton(btn, 'sms', '🚀 SMS自動入力', '#f59e0b', popup);
      }
    });
  }

  // ============================================================
  //  自動入力ボタンを追加
  // ============================================================
  function addAutoButton(refBtn, type, label, color, popup) {
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
      // ⭐ ポップアップを再取得（DOMが変わっている可能性があるため）
      const currentPopup = findNotifyPopup();
      if (!currentPopup) {
        showToast('通知ポップアップが見つかりません', 'error');
        return;
      }

      // メッセージテキストを取得
      const msgText = getMessageText(currentPopup);
      if (!msgText) {
        showToast('メッセージが取得できませんでした', 'error');
        return;
      }

      if (type === 'line_customer') {
        const custName = getCustomerName(currentPopup);
        if (!custName) {
          showToast('お客様名が取得できませんでした', 'error');
          return;
        }
        console.log('[T-MANAGE] LINE検索: お客様名 =', custName);
        showToast(`🔍 ${custName} をLINEで検索します...`, 'success');
        chrome.runtime.sendMessage({
          type: 'SEARCH_LINE_CUSTOMER',
          name: custName,
          template: msgText
        });
      }

      else if (type === 'line_therapist') {
        const therapistName = getTherapistName(currentPopup);
        if (!therapistName) {
          showToast('セラピスト名が取得できませんでした。テンプレートに「○○さん」の呼びかけがあるか確認してください。', 'error');
          return;
        }
        console.log('[T-MANAGE] LINE検索: セラピスト名 =', therapistName);
        showToast(`🔍 ${therapistName} をLINEで検索します...`, 'success');
        chrome.runtime.sendMessage({
          type: 'SEARCH_LINE_THERAPIST',
          name: therapistName,
          template: msgText
        });
      }

      else if (type === 'sms') {
        const phone = getPhoneNumber(currentPopup, refBtn);
        if (!phone) {
          showToast('電話番号が取得できませんでした', 'error');
          return;
        }
        console.log('[T-MANAGE] SMS送信: 電話番号 =', phone);
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

  console.log('[T-MANAGE] content_tmanage.js v2.1 loaded');
})();
