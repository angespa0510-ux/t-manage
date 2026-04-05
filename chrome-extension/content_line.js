// T-MANAGE LINE Business Chat Content Script v2.0
// ISOLATED world で動作（通常のcontent script）
//
// 役割:
//   ① 検索欄（input.chatlist-search）に名前を1文字ずつ入力
//   ② background.js に MAIN world実行を依頼
//   ③ CustomEvent で MAIN world からの完了/エラー通知を受信
//
// ⚠️ chat.line.biz は Vue.js SPA のため:
//   - DOM クリックでは遷移できない → router.push() が必要（MAIN world）
//   - textarea は Shadow DOM（textarea-ex）内 → MAIN world でアクセス
//   - Vue instance は MAIN world でしか取得できない

(function () {
  'use strict';

  let isRunning = false;
  let pendingSendResponse = null;

  // ============================================================
  //  CSS アニメーション
  // ============================================================
  const style = document.createElement('style');
  style.textContent = `
    @keyframes tmSlideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
    @keyframes tmPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
  `;
  document.head.appendChild(style);

  // ============================================================
  //  メッセージ受信ハンドラ
  // ============================================================
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {

    // PING応答（生存確認）
    if (msg.type === 'PING') {
      sendResponse({ type: 'PONG', alive: true });
      return false;
    }

    // 検索→MAIN world実行の依頼
    if (msg.type === 'TYPE_IN_LINE_SEARCH') {
      if (isRunning) {
        sendResponse({ ok: false, reason: 'already_running' });
        return false;
      }
      isRunning = true;
      const name = msg.name || '';
      const template = msg.template || '';
      const tabId = msg.tabId;

      showIndicator(`🔍 「${name}」を検索中...`, 'info');
      typeInSearch(name, template, tabId);
      sendResponse({ ok: true });
      return false;
    }

    // background.jsからのfill_line（後方互換: pending経由）
    if (msg.action === 'fill_line') {
      if (msg.target) {
        isRunning = true;
        showIndicator(`🔍 「${msg.target}」を検索中...`, 'info');
        // tabIdが不明な場合、background.jsに問い合わせるか、現在のタブIDを推測
        typeInSearch(msg.target, msg.text, null);
      }
      sendResponse({ ok: true });
      return false;
    }
  });

  // ============================================================
  //  CustomEvent リスナー（MAIN world → ISOLATED world 通知）
  // ============================================================
  document.addEventListener('tmanage_success', (e) => {
    const detail = e.detail || 'メッセージを入力しました';
    showIndicator(`✅ ${detail}！内容を確認して送信してください。`, 'success');
    isRunning = false;
    chrome.runtime.sendMessage({ action: 'clear_pending' });
  });

  document.addEventListener('tmanage_error', (e) => {
    const detail = e.detail || 'エラーが発生しました';
    showIndicator(`⚠️ ${detail}`, 'warning');
    isRunning = false;
  });

  document.addEventListener('tmanage_already_sent', () => {
    showIndicator('ℹ️ このメッセージは送信済みです', 'info');
    isRunning = false;
    chrome.runtime.sendMessage({ action: 'clear_pending' });
  });

  // ============================================================
  //  検索欄に名前を1文字ずつ入力
  //  ⚠️ execCommand('insertText') で1文字ずつ入力しないとVueが反応しない
  // ============================================================
  function typeInSearch(name, template, tabId) {
    // 検索欄を探す
    const searchInput = document.querySelector('input.chatlist-search')
      || document.querySelector('input[placeholder*="検索"]')
      || document.querySelector('input[placeholder*="Search"]');

    if (!searchInput) {
      showIndicator('⚠️ 検索欄が見つかりません。ページを再読み込みしてください。', 'warning');
      isRunning = false;
      return;
    }

    // 既存の検索テキストをクリア
    searchInput.focus();
    searchInput.select();
    document.execCommand('delete');

    // 1文字ずつ入力（60ms間隔）
    const chars = name.split('');
    let i = 0;

    function typeNext() {
      if (i < chars.length) {
        searchInput.focus();
        document.execCommand('insertText', false, chars[i]);
        i++;
        setTimeout(typeNext, 60);
      } else {
        // 入力完了 → 検索結果表示を待つ（1500ms）
        showIndicator(`🔍 「${name}」の検索結果を待っています...`, 'info');
        setTimeout(() => {
          requestMainWorldExecution(name, template, tabId);
        }, 1500);
      }
    }
    typeNext();
  }

  // ============================================================
  //  background.js に MAIN world 実行を依頼
  // ============================================================
  function requestMainWorldExecution(name, template, tabId) {
    showIndicator(`📋 「${name}」のチャットを開いています...`, 'info');

    chrome.runtime.sendMessage({
      type: 'EXECUTE_IN_MAIN_WORLD',
      name: name,
      template: template,
      tabId: tabId
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.log('[T-MANAGE LINE] MAIN world依頼失敗:', chrome.runtime.lastError.message);
        showIndicator('⚠️ MAIN world実行に失敗しました。ページを再読み込みしてください。', 'warning');
        isRunning = false;
        return;
      }
      // 結果はCustomEvent経由で受け取る
      // ここでは依頼が受け付けられたことだけ確認
      if (response && !response.ok) {
        showIndicator(`⚠️ ${response.error || 'エラー'}`, 'warning');
        isRunning = false;
      }
    });
  }

  // ============================================================
  //  起動時: 保留メッセージの確認
  // ============================================================
  function checkPendingOnLoad() {
    let attempts = 0;
    const maxAttempts = 30;

    function tryCheck() {
      attempts++;
      // 検索欄が表示されるまで待つ
      const searchInput = document.querySelector('input.chatlist-search')
        || document.querySelector('input[placeholder*="検索"]');

      if (searchInput) {
        chrome.runtime.sendMessage({ action: 'get_pending' }, (data) => {
          if (chrome.runtime.lastError) return;
          if (data && data.pending_type === 'line' && data.pending_message && data.pending_target) {
            isRunning = true;
            showIndicator(`🔍 保留: 「${data.pending_target}」を検索中...`, 'info');
            typeInSearch(data.pending_target, data.pending_message, null);
          }
        });
      } else if (attempts < maxAttempts) {
        setTimeout(tryCheck, 500);
      }
    }
    setTimeout(tryCheck, 1000);
  }

  checkPendingOnLoad();

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
      background-color: ${colors[type] || colors.info}; color: white; max-width: 400px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      animation: tmSlideIn 0.3s ease-out;
      ${type === 'info' ? 'animation: tmSlideIn 0.3s ease-out, tmPulse 1.5s infinite;' : ''}
    `;
    div.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px">
        <span>${msg}</span>
        <button id="tm-close" style="background:none;border:none;color:white;cursor:pointer;font-size:16px;padding:0 4px;flex-shrink:0">✕</button>
      </div>
    `;
    document.body.appendChild(div);
    div.querySelector('#tm-close')?.addEventListener('click', () => div.remove());

    // 成功メッセージは5秒後に消す
    if (type === 'success') {
      setTimeout(() => div.remove(), 5000);
    }
    // 警告は10秒後に消す
    if (type === 'warning') {
      setTimeout(() => div.remove(), 10000);
    }
  }

  console.log('[T-MANAGE] content_line.js v2.0 loaded');
})();
