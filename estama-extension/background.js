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

  // ブリッジタブを閉じてエステ魂ログインを開く
  // ※ セッションクリアは content-login.js が自動処理
  if (msg.type === 'OPEN_ESTAMA_LOGIN') {
    const bridgeTabId = sender.tab?.id;
    const loginUrl = 'https://estama.jp/login/?r=/admin/blog_edit/';
    chrome.tabs.create({ url: loginUrl }, () => {
      if (bridgeTabId) chrome.tabs.remove(bridgeTabId);
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
