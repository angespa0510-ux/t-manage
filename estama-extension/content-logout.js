// =============================================
// T-MANAGE エステ魂自動投稿 — content-logout.js
// ログアウト後 → ログインページへ自動リダイレクト
// =============================================

(function () {
  chrome.storage.local.get('estamaPost', (data) => {
    if (data.estamaPost && data.estamaPost.title) {
      console.log('[エステ魂拡張] ログアウト完了 → ログインページへリダイレクト');
      // 少し待ってからログインページへ（セッションクリア確認）
      setTimeout(() => {
        window.location.href = 'https://estama.jp/login/?r=/admin/blog_edit/';
      }, 500);
    }
  });
})();
