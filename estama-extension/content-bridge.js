// =============================================
// T-MANAGE エステ魂自動投稿 — content-bridge.js
// ブリッジページ (t-manage.vercel.app/estama-bridge) 自動通過
// =============================================

(function () {
  console.log('[エステ魂拡張] ブリッジページ検出');

  // DOM読み込み待機
  function waitForData() {
    const el = document.getElementById('estama-bridge-data');
    if (!el) {
      setTimeout(waitForData, 200);
      return;
    }

    const room = el.dataset.room || '';
    const title = el.dataset.title || '';
    const content = el.dataset.content || '';
    const estamaId = el.dataset.estamaId || '';
    const estamaPw = el.dataset.estamaPw || '';
    let imageUrls = [];
    try { imageUrls = JSON.parse(el.dataset.imageUrls || '[]'); } catch (e) {}

    if (!title || !content) {
      console.warn('[エステ魂拡張] データ不足、手動モードにフォールバック');
      return;
    }

    console.log('[エステ魂拡張] データ読み取り完了:', { room, titleLen: title.length, images: imageUrls.length });

    // 拡張機能ステータスを表示
    const statusEl = document.getElementById('estama-bridge-status');
    if (statusEl) {
      statusEl.textContent = '✅ 拡張機能検出 — 自動通過中...';
      statusEl.style.color = '#22c55e';
    }

    // chrome.storage に保存
    chrome.storage.local.set({
      estamaPost: {
        room,
        title,
        content,
        estamaId,
        estamaPw,
        imageUrls,
        timestamp: Date.now()
      }
    }, () => {
      console.log('[エステ魂拡張] storage保存完了 → ログインページへ');
      // background.js に通知してタブ管理
      chrome.runtime.sendMessage({ type: 'OPEN_ESTAMA_LOGIN' });
    });
  }

  // ページ読み込み後に実行
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', waitForData);
  } else {
    waitForData();
  }
})();
