// =============================================
// T-MANAGE エステ魂自動投稿 — content-login.js
// estama.jp/login ログインフォーム自動入力
// =============================================

(function () {
  console.log('[エステ魂拡張] ログインページ検出');

  chrome.storage.local.get('estamaPost', (data) => {
    const post = data.estamaPost;
    if (!post || !post.estamaId || !post.estamaPw) {
      console.log('[エステ魂拡張] 投稿データなし、スキップ');
      return;
    }

    // 古いデータ（5分以上前）はスキップ
    if (Date.now() - post.timestamp > 5 * 60 * 1000) {
      console.log('[エステ魂拡張] 古いデータ、スキップ');
      return;
    }

    console.log('[エステ魂拡張] ログイン情報入力開始');

    // ログインフォームの入力欄をポーリング
    let attempts = 0;
    const maxAttempts = 30;

    const tryFill = setInterval(() => {
      attempts++;
      const emailInput = document.getElementById('inputEmail');
      const pwInput = document.getElementById('inputPassword');

      if (!emailInput || !pwInput) {
        if (attempts >= maxAttempts) {
          clearInterval(tryFill);
          console.warn('[エステ魂拡張] ログインフォームが見つかりません');
        }
        return;
      }

      clearInterval(tryFill);

      // Native setter で値を設定（React/Angular対応）
      const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      nativeSetter.call(emailInput, post.estamaId);
      emailInput.dispatchEvent(new Event('input', { bubbles: true }));
      emailInput.dispatchEvent(new Event('change', { bubbles: true }));

      nativeSetter.call(pwInput, post.estamaPw);
      pwInput.dispatchEvent(new Event('input', { bubbles: true }));
      pwInput.dispatchEvent(new Event('change', { bubbles: true }));

      // rパラメータを blog_edit に設定
      const rInput = document.querySelector('input[name="r"]');
      if (rInput) {
        nativeSetter.call(rInput, '/admin/blog_edit/');
        rInput.dispatchEvent(new Event('change', { bubbles: true }));
      }

      console.log('[エステ魂拡張] ID/PW入力完了');

      // バナー表示
      const banner = document.createElement('div');
      banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;background:linear-gradient(135deg,#ec4899,#a855f7);color:white;text-align:center;padding:16px;font-size:16px;font-weight:bold;box-shadow:0 4px 20px rgba(0,0,0,0.3);';
      banner.innerHTML = '💅 エステ魂自動投稿 — <span style="font-size:20px">ログインボタンを押してください！</span>';
      document.body.prepend(banner);

    }, 300);
  });
})();
