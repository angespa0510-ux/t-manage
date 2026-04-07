// =============================================
// T-MANAGE エステ魂自動投稿 — content-redirect.js
// ログイン後に blog_edit 以外に飛んだ場合のリダイレクト
// =============================================

(function () {
  chrome.storage.local.get('estamaPost', (data) => {
    if (data.estamaPost && data.estamaPost.title) {
      console.log('[エステ魂拡張] 投稿データあり → blog_edit へリダイレクト');
      window.location.href = 'https://estama.jp/admin/blog_edit/';
    }
  });
})();
