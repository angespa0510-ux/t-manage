// =============================================
// T-MANAGE エステ魂自動投稿 — content-login.js v2
// ログインページで: ① セッションクリア → ② リロード → ③ フォーム入力
// =============================================

(function () {
  console.log('[エステ魂拡張] ログインページ検出');

  chrome.storage.local.get('estamaPost', async (data) => {
    const post = data.estamaPost;
    if (!post || !post.estamaId || !post.estamaPw) {
      console.log('[エステ魂拡張] 投稿データなし、スキップ');
      return;
    }

    if (Date.now() - post.timestamp > 5 * 60 * 1000) {
      console.log('[エステ魂拡張] 古いデータ、スキップ');
      return;
    }

    // ===== ① まずセッションをクリア（同一オリジンfetch）=====
    // 2回目（リロード後）はスキップ
    const RELOADED_KEY = 'estama_ext_session_cleared';
    if (!sessionStorage.getItem(RELOADED_KEY)) {
      console.log('[エステ魂拡張] セッションクリア中...');
      sessionStorage.setItem(RELOADED_KEY, '1');
      try {
        await fetch('/post/logout/', { credentials: 'same-origin' });
      } catch (e) {
        console.warn('[エステ魂拡張] logout fetch失敗:', e);
      }
      // リロードして新しいCSRFトークンを取得
      setTimeout(() => {
        window.location.href = 'https://estama.jp/login/?r=/admin/blog_edit/';
      }, 300);
      return;
    }

    // ===== ② リロード後 → フォーム入力 =====
    sessionStorage.removeItem(RELOADED_KEY);
    console.log('[エステ魂拡張] セッションクリア済 → フォーム入力開始');

    let attempts = 0;
    const maxAttempts = 30;

    const tryFill = setInterval(() => {
      attempts++;
      const emailInput = document.querySelector('input[name="mail"]') || document.getElementById('inputEmail');
      const pwInput = document.querySelector('input[name="password"]') || document.getElementById('inputPassword');

      if (!emailInput || !pwInput) {
        if (attempts >= maxAttempts) {
          clearInterval(tryFill);
          console.warn('[エステ魂拡張] ログインフォームが見つかりません');
        }
        return;
      }

      clearInterval(tryFill);

      // フォーム入力
      emailInput.focus();
      emailInput.value = post.estamaId;
      emailInput.dispatchEvent(new Event('input', { bubbles: true }));
      emailInput.dispatchEvent(new Event('change', { bubbles: true }));
      emailInput.blur();

      pwInput.focus();
      pwInput.value = post.estamaPw;
      pwInput.dispatchEvent(new Event('input', { bubbles: true }));
      pwInput.dispatchEvent(new Event('change', { bubbles: true }));
      pwInput.blur();

      // rパラメータを blog_edit に設定
      const rInput = document.querySelector('input[name="r"]');
      if (rInput) rInput.value = '/admin/blog_edit/';

      console.log('[エステ魂拡張] ID/PW入力完了:', post.estamaId);

      // バナー表示
      const banner = document.createElement('div');
      banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;background:linear-gradient(135deg,#ec4899,#a855f7);color:white;text-align:center;padding:16px;font-size:16px;font-weight:bold;box-shadow:0 4px 20px rgba(0,0,0,0.3);';
      banner.innerHTML = '💅 エステ魂自動投稿 — <span style="font-size:20px">ログインボタンを押してください！</span>';
      document.body.prepend(banner);

    }, 300);
  });
})();
