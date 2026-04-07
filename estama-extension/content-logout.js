// =============================================
// T-MANAGE エステ魂自動投稿 — content-logout.js
// ログアウト完了検知 → ログインページへリダイレクト
// estama.jp/post/logout, /login（ログアウト後リダイレクト先）両方で動作
// =============================================

(function () {
  // ログアウトURLにいる場合 → 待ってからログインページへ
  if (window.location.href.includes('/logout')) {
    chrome.storage.local.get('estamaPost', (data) => {
      if (data.estamaPost && data.estamaPost.title) {
        console.log('[エステ魂拡張] ログアウトページ検出 → 1秒後にログインへ');
        setTimeout(() => {
          window.location.href = 'https://estama.jp/login/?r=/admin/blog_edit/';
        }, 1000);
      }
    });
  }
})();
