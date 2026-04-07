// =============================================
// T-MANAGE エステ魂自動投稿 — background.js
// Service Worker: 画像取得 & タブ管理
// =============================================

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // ange-spa.com からセラピスト画像を取得（CORS回避）
  if (msg.type === 'FETCH_SCHEDULE_IMAGES') {
    fetchScheduleImages(msg.roomKey)
      .then(images => sendResponse({ ok: true, images }))
      .catch(err => sendResponse({ ok: false, error: err.message }));
    return true; // 非同期レスポンス
  }

  // 指定URLの画像をbase64取得（T-MANAGEセラピスト画像用）
  if (msg.type === 'FETCH_IMAGE_URLS') {
    fetchImageUrls(msg.urls || [])
      .then(images => sendResponse({ ok: true, images }))
      .catch(err => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  // ブリッジタブを閉じて → ログアウト → ログインを開く
  if (msg.type === 'OPEN_ESTAMA_LOGIN') {
    const bridgeTabId = sender.tab?.id;
    if (bridgeTabId) chrome.tabs.remove(bridgeTabId);

    // ① まずログアウトタブを開いてセッションクリア
    const logoutUrl = 'https://estama.jp/post/logout/';
    chrome.tabs.create({ url: logoutUrl, active: false }, (logoutTab) => {
      const logoutTabId = logoutTab.id;

      // ② ログアウト完了を待つ（ページ読み込み完了 or 2秒タイムアウト）
      let resolved = false;
      const finish = () => {
        if (resolved) return;
        resolved = true;
        // ログアウトタブを閉じる
        try { chrome.tabs.remove(logoutTabId); } catch (e) {}
        // ③ ログインページを開く
        chrome.tabs.create({ url: 'https://estama.jp/login/?r=/admin/blog_edit/' });
      };

      // ページ読み込み完了で発火
      chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
        if (tabId === logoutTabId && info.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          setTimeout(finish, 300); // 少し待ってからログインページへ
        }
      });

      // タイムアウト（2秒）
      setTimeout(finish, 2000);
    });

    sendResponse({ ok: true });
    return true;
  }
});

// =============================================
// ange-spa.com から画像取得
// =============================================
async function fetchScheduleImages(roomKey) {
  try {
    const res = await fetch('https://ange-spa.com/schedule.php');
    const html = await res.text();

    // roomKeyに応じたalt属性でフィルタ
    const altText = roomKey === 'toyohashi' ? '豊橋ルーム' : '三河安城ルーム';

    // <li>ブロックを抽出
    const liBlocks = html.match(/<li>[\s\S]*?<\/li>/gi) || [];
    const matchedImages = [];

    for (const li of liBlocks) {
      // ルーム判定
      if (!li.includes(`alt="${altText}"`)) continue;
      // セラピスト画像を抽出
      const imgMatch = li.match(/<img[^>]+src="([^"]*images_staff[^"]*)"/i);
      if (imgMatch) {
        let url = imgMatch[1];
        if (!url.startsWith('http')) url = 'https://ange-spa.com' + url;
        matchedImages.push(url);
      }
    }

    if (matchedImages.length === 0) return [];

    // シャッフルして最大3枚選択
    const shuffled = matchedImages.sort(() => Math.random() - 0.5).slice(0, 3);

    // base64に変換
    const results = [];
    for (const url of shuffled) {
      try {
        const imgRes = await fetch(url);
        const buf = await imgRes.arrayBuffer();
        const bytes = new Uint8Array(buf);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        const base64 = btoa(binary);
        const contentType = imgRes.headers.get('content-type') || 'image/jpeg';
        results.push({
          base64: `data:${contentType};base64,${base64}`,
          url: url
        });
      } catch (e) {
        console.warn('[エステ魂拡張] 画像取得失敗:', url, e);
      }
    }
    return results;
  } catch (e) {
    console.error('[エステ魂拡張] schedule.php取得失敗:', e);
    return [];
  }
}

// =============================================
// 指定URLの画像を取得（T-MANAGEセラピスト画像用）
// =============================================
async function fetchImageUrls(urls) {
  const results = [];
  for (const url of urls.slice(0, 3)) {
    try {
      const imgRes = await fetch(url);
      const buf = await imgRes.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      const base64 = btoa(binary);
      const contentType = imgRes.headers.get('content-type') || 'image/jpeg';
      results.push({
        base64: `data:${contentType};base64,${base64}`,
        url: url
      });
      console.log('[エステ魂拡張] 画像取得OK:', url.substring(0, 60) + '...');
    } catch (e) {
      console.warn('[エステ魂拡張] 画像取得失敗:', url, e);
    }
  }
  return results;
}
