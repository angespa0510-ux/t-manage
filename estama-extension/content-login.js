// =============================================
// T-MANAGE エステ魂自動投稿 — content-login.js v4
// フォーム入力＆自動ログイン（セッションクリアはbackground.jsが処理済）
// =============================================

(function () {
  console.log('[エステ魂拡張] ログインページ検出');

  chrome.storage.local.get('estamaPost', (data) => {
    const post = data.estamaPost;
    if (!post || !post.estamaId || !post.estamaPw) {
      console.log('[エステ魂拡張] 投稿データなし、スキップ');
      return;
    }

    if (Date.now() - post.timestamp > 5 * 60 * 1000) {
      console.log('[エステ魂拡張] 古いデータ、スキップ');
      return;
    }

    // バナー表示
    const banner = document.createElement('div');
    banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;background:linear-gradient(135deg,#ec4899,#a855f7);color:white;text-align:center;padding:14px;font-size:15px;font-weight:bold;box-shadow:0 4px 20px rgba(0,0,0,0.3);';
    banner.textContent = '💅 エステ魂自動投稿 — ログイン中...';
    document.body.prepend(banner);

    let attempts = 0;
    const tryLogin = setInterval(() => {
      attempts++;
      const emailInput = document.querySelector('input[name="mail"]') || document.getElementById('inputEmail');
      const pwInput = document.querySelector('input[name="password"]') || document.getElementById('inputPassword');

      if (!emailInput || !pwInput) {
        if (attempts >= 30) {
          clearInterval(tryLogin);
          banner.textContent = '❌ ログインフォームが見つかりません';
        }
        return;
      }
      clearInterval(tryLogin);

      // フォーム入力
      emailInput.value = post.estamaId;
      emailInput.dispatchEvent(new Event('input', { bubbles: true }));
      pwInput.value = post.estamaPw;
      pwInput.dispatchEvent(new Event('input', { bubbles: true }));
      const rInput = document.querySelector('input[name="r"]');
      if (rInput) rInput.value = '/admin/blog_edit/';

      console.log('[エステ魂拡張] フォーム入力完了:', post.estamaId);

      // 自動ログイン（500ms後）
      setTimeout(() => {
        // 戦略1: ログインボタンをクリック
        const loginBtn = findLoginButton();
        if (loginBtn) {
          console.log('[エステ魂拡張] ログインボタンクリック');
          loginBtn.click();
          // 2秒後にまだログインページなら戦略2
          setTimeout(() => {
            if (window.location.pathname.includes('/login')) {
              tryUrlLogin(emailInput, pwInput);
            }
          }, 2000);
        } else {
          tryUrlLogin(emailInput, pwInput);
        }
      }, 500);
    }, 300);

    function findLoginButton() {
      const all = [
        ...document.querySelectorAll('input[type="submit"]'),
        ...document.querySelectorAll('button[type="submit"]'),
        ...document.querySelectorAll('button'),
        ...document.querySelectorAll('a'),
        ...document.querySelectorAll('input[type="button"]'),
      ];
      for (const el of all) {
        const text = (el.textContent || el.value || '').trim();
        if (text.includes('ログイン')) return el;
      }
      return null;
    }

    function tryUrlLogin(emailInput, pwInput) {
      console.log('[エステ魂拡張] URL直接遷移でログイン');
      const ctk = (document.getElementById('csrf_footer') || document.querySelector('input[name="ctk"]') || {}).value || '';
      const url = 'https://estama.jp/login/?mail=' + encodeURIComponent(emailInput.value)
        + '&password=' + encodeURIComponent(pwInput.value)
        + '&r=' + encodeURIComponent('/admin/blog_edit/')
        + '&ctk=' + encodeURIComponent(ctk);
      window.location.href = url;
    }
  });
})();
