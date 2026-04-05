// Google Messages (messages.google.com) Content Script v3.0
// S-MANAGEの実績あるSMS実装ガイドに基づく
//
// 4ステップ:
//   STEP1: 「チャットを開始」ボタンをクリック
//   STEP2: 宛先フィールドに電話番号を1文字ずつ入力
//   STEP3: Enterキーで会話開始
//   STEP4: mws-message-compose textarea にテンプレート入力
//
// ⚠️ LINEと違いShadow DOMではないため querySelector('textarea') で取得可能

// シングルトン管理（多重インジェクト防止）
if (window._tmanageSmsV1) {
  console.log('[T-MANAGE SMS] 既にロード済み — スキップ');
} else {
  window._tmanageSmsV1 = true;
  window._tmanageSmsRunning = false;

(function () {
  'use strict';

  // CSS
  const style = document.createElement('style');
  style.textContent = `
    @keyframes tmSlideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
  `;
  document.head.appendChild(style);

  // ============================================================
  //  メッセージ受信
  // ============================================================
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'PING') {
      sendResponse({ type: 'PONG', alive: true });
      return false;
    }
    if (msg.type === 'FILL_SMS' || msg.action === 'fill_sms') {
      const phone = msg.phone || msg.pending_target || '';
      const template = msg.template || msg.text || '';
      if (phone && template) {
        startSmsFlow(phone, template);
      }
      sendResponse({ ok: true });
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
      const main = document.querySelector('mws-conversations-list, mw-conversation-container, [role="main"], body');
      if (main && document.readyState === 'complete') {
        chrome.runtime.sendMessage({ action: 'get_pending' }, (data) => {
          if (chrome.runtime.lastError) return;
          if (data && data.pending_type === 'sms' && data.pending_message && data.pending_target) {
            // 少し待ってから実行（ページ完全読み込み）
            setTimeout(() => {
              startSmsFlow(data.pending_target, data.pending_message);
            }, 4000);
          }
        });
      } else if (attempts < 30) {
        setTimeout(tryCheck, 500);
      }
    }
    setTimeout(tryCheck, 3000);
  }

  checkPendingOnLoad();

  // ============================================================
  //  SMS送信フロー開始
  // ============================================================
  function startSmsFlow(phone, template) {
    if (window._tmanageSmsRunning) {
      console.log('[T-MANAGE SMS] 既に実行中 — スキップ');
      return;
    }
    window._tmanageSmsRunning = true;

    // 2重実行防止（30秒間）
    const execKey = 'tmanage_sms_executed';
    if (sessionStorage.getItem(execKey) === phone) {
      console.log('[T-MANAGE SMS] 既に実行済み — スキップ');
      window._tmanageSmsRunning = false;
      return;
    }
    sessionStorage.setItem(execKey, phone);
    setTimeout(() => sessionStorage.removeItem(execKey), 30000);

    showIndicator(`📱 ${formatPhone(phone)} にSMS送信を開始します...`, 'info');

    // STEP1: 「チャットを開始」ボタンをクリック
    step1_startChat(phone, template);
  }

  // ============================================================
  //  STEP1: 「チャットを開始」ボタンをクリック
  // ============================================================
  function step1_startChat(phone, template) {
    // 既に /conversations/new にいる場合はスキップ
    if (location.pathname.includes('/conversations/new')) {
      console.log('[T-MANAGE SMS] 既に新規会話画面 → STEP2へ');
      setTimeout(() => step2_typePhone(phone, template), 500);
      return;
    }

    // 「チャットを開始」ボタンを探す
    const startBtn = findButtonByText('チャットを開始')
      || findButtonByText('Start chat')
      || findButtonByText('新しい会話')
      || findButtonByText('New conversation');

    if (startBtn) {
      console.log('[T-MANAGE SMS] STEP1: チャット開始ボタンをクリック');
      startBtn.click();
      setTimeout(() => step2_typePhone(phone, template), 4000);
    } else {
      // ボタンが見つからない場合、URLで直接遷移
      console.log('[T-MANAGE SMS] STEP1: ボタン見つからず → URL遷移');
      location.href = 'https://messages.google.com/web/conversations/new';
      setTimeout(() => step2_typePhone(phone, template), 4000);
    }
  }

  // ============================================================
  //  STEP2: 宛先フィールドに電話番号を1文字ずつ入力
  // ============================================================
  function step2_typePhone(phone, template, retryCount = 0) {
    const input = document.querySelector('input[placeholder*="名前"]')
      || document.querySelector('input[placeholder*="電話"]')
      || document.querySelector('input[placeholder*="name"]')
      || document.querySelector('input[placeholder*="number"]')
      || document.querySelector('input[type="text"][aria-label]');

    if (!input) {
      if (retryCount < 15) {
        console.log(`[T-MANAGE SMS] STEP2: 宛先入力欄待ち (${retryCount}/15)`);
        setTimeout(() => step2_typePhone(phone, template, retryCount + 1), 800);
      } else {
        showIndicator('⚠️ 宛先入力欄が見つかりません。手動で電話番号を入力してください。', 'warning');
        window._tmanageSmsRunning = false;
      }
      return;
    }

    showIndicator(`📱 ${formatPhone(phone)} を入力中...`, 'info');

    // フォーカス＆クリア
    input.focus();
    input.value = '';
    input.dispatchEvent(new Event('input', { bubbles: true }));

    // 1文字ずつ入力（120ms間隔 — 安定性重視）
    const chars = phone.split('');
    let i = 0;

    function typeNext() {
      if (i < chars.length) {
        input.focus();
        document.execCommand('insertText', false, chars[i]);
        i++;
        setTimeout(typeNext, 120);
      } else {
        // 入力完了 → 検索結果を待つ（4秒）
        console.log('[T-MANAGE SMS] STEP2: 電話番号入力完了 → 5秒待機');
        showIndicator(`📱 ${formatPhone(phone)} の検索結果を待っています...`, 'info');
        setTimeout(() => step3_selectAndEnter(phone, template), 5000);
      }
    }
    typeNext();
  }

  // ============================================================
  //  STEP3: 候補を選択 or Enterキーで会話開始
  // ============================================================
  function step3_selectAndEnter(phone, template) {
    console.log('[T-MANAGE SMS] STEP3: 候補選択/Enter');

    // 電話番号の場合はEnterキーで直接会話開始
    const input = document.querySelector('input[placeholder*="名前"]')
      || document.querySelector('input[placeholder*="電話"]')
      || document.querySelector('input[placeholder*="name"]')
      || document.querySelector('input[placeholder*="number"]')
      || document.activeElement;

    if (input) {
      // まず候補リストを確認
      const candidates = document.querySelectorAll('[role="option"], mw-contact-row, [role="listbox"] [role="option"]');
      if (candidates.length > 0) {
        // 候補をクリック
        console.log(`[T-MANAGE SMS] STEP3: 候補 ${candidates.length}件 → 最初をクリック`);
        candidates[0].click();
        setTimeout(() => {
          // Enter確定
          input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true }));
          input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', keyCode: 13, bubbles: true }));
          setTimeout(() => step4_insertTemplate(template, 0), 4000);
        }, 2000);
      } else {
        // 候補なし → Enterで直接開始
        console.log('[T-MANAGE SMS] STEP3: 候補なし → Enter直接');
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true }));
        input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', keyCode: 13, bubbles: true }));
        setTimeout(() => step4_insertTemplate(template, 0), 4000);
      }
    } else {
      showIndicator('⚠️ 入力欄を見失いました。手動で操作してください。', 'warning');
      window._tmanageSmsRunning = false;
    }
  }

  // ============================================================
  //  STEP4: テンプレート入力
  //  mws-message-compose 内の textarea を取得
  // ============================================================
  function step4_insertTemplate(template, retryCount) {
    const compose = document.querySelector('mws-message-compose');
    const textarea = compose?.querySelector('textarea')
      || document.querySelector('mws-message-compose textarea')
      || document.querySelector('textarea[placeholder*="メッセージ"]')
      || document.querySelector('textarea[placeholder*="Text message"]')
      || document.querySelector('textarea[placeholder*="SMS"]');

    if (!textarea) {
      if (retryCount < 30) {
        setTimeout(() => step4_insertTemplate(template, retryCount + 1), 600);
      } else {
        showIndicator('⚠️ メッセージ入力欄が見つかりません。テキストはクリップボードにコピー済みです。Ctrl+Vで貼り付けてください。', 'warning');
        window._tmanageSmsRunning = false;
      }
      return;
    }

    console.log('[T-MANAGE SMS] STEP4: テンプレート入力');
    textarea.focus();
    document.execCommand('insertText', false, template);
    textarea.dispatchEvent(new Event('input', { bubbles: true }));

    showIndicator('✅ メッセージを入力しました！内容を確認して送信してください。', 'success');

    // 保留データをクリア
    chrome.runtime.sendMessage({ action: 'clear_pending' });
    window._tmanageSmsRunning = false;
  }

  // ============================================================
  //  ユーティリティ
  // ============================================================

  // テキストでボタンを検索
  function findButtonByText(text) {
    const els = document.querySelectorAll('button, a, [role="button"]');
    for (const el of els) {
      if ((el.textContent || '').trim().includes(text)) return el;
    }
    return null;
  }

  // 電話番号フォーマット
  function formatPhone(phone) {
    const clean = (phone || '').replace(/\D/g, '');
    if (clean.length === 11) {
      return `${clean.slice(0, 3)}-${clean.slice(3, 7)}-${clean.slice(7)}`;
    }
    return phone;
  }

  // インジケーター表示
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
      background-color: ${colors[type] || colors.info}; color: white; max-width: 400px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      animation: tmSlideIn 0.3s ease-out;
    `;
    div.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px">
        <span>${msg}</span>
        <button id="tm-close" style="background:none;border:none;color:white;cursor:pointer;font-size:16px;padding:0 4px;flex-shrink:0">✕</button>
      </div>
    `;
    document.body.appendChild(div);
    div.querySelector('#tm-close')?.addEventListener('click', () => div.remove());

    if (type === 'success') setTimeout(() => div.remove(), 8000);
    if (type === 'warning') setTimeout(() => div.remove(), 15000);
  }

  console.log('[T-MANAGE] content_sms.js v3.0 loaded');
})();

} // シングルトン管理の閉じ括弧
