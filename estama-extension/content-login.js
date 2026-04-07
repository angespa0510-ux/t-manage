// =============================================
// T-MANAGE エステ魂自動投稿 — content-login.js v3
// 自動ログイン: セッションクリア → フォーム入力 → 自動送信
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

    // ===== ① セッションクリア（初回のみ）=====
    const RELOADED_KEY = 'estama_ext_session_cleared';
    if (!sessionStorage.getItem(RELOADED_KEY)) {
      console.log('[エステ魂拡張] セッションクリア中...');
      sessionStorage.setItem(RELOADED_KEY, '1');
      try {
        await fetch('/post/logout/', { credentials: 'same-origin' });
      } catch (e) {
        console.warn('[エステ魂拡張] logout fetch失敗:', e);
      }
      setTimeout(() => {
        window.location.href = 'https://estama.jp/login/?r=/admin/blog_edit/';
      }, 300);
      return;
    }

    // ===== ② リロード後 → フォーム入力＆自動ログイン =====
    sessionStorage.removeItem(RELOADED_KEY);
    console.log('[エステ魂拡張] フォーム入力＆自動ログイン開始');

    // バナー表示
    const banner = document.createElement('div');
    banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;background:linear-gradient(135deg,#ec4899,#a855f7);color:white;text-align:center;padding:14px;font-size:15px;font-weight:bold;box-shadow:0 4px 20px rgba(0,0,0,0.3);';
    banner.textContent = '💅 エステ魂自動投稿 — ログイン中...';
    document.body.prepend(banner);

    // フォーム要素待機
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

      // ===== ③ 自動ログイン（3段階戦略）=====
      setTimeout(() => {
        // 戦略1: ログインボタンをクリック
        const loginBtn = findLoginButton();
        if (loginBtn) {
          console.log('[エステ魂拡張] 戦略1: ログインボタンクリック');
          loginBtn.click();
          // 2秒後にまだ同じページにいたら戦略2へ
          setTimeout(() => {
            if (window.location.pathname.includes('/login')) {
              tryDirectNavigation(emailInput, pwInput);
            }
          }, 2000);
        } else {
          // ボタンが見つからない → 戦略2へ
          tryDirectNavigation(emailInput, pwInput);
        }
      }, 500);

    }, 300);

    function findLoginButton() {
      // ログインボタンを複数の方法で検索
      const candidates = [
        ...document.querySelectorAll('input[type="submit"]'),
        ...document.querySelectorAll('button[type="submit"]'),
        ...document.querySelectorAll('a.btn, a.button, button'),
        ...document.querySelectorAll('input[type="button"]'),
      ];
      for (const el of candidates) {
        const text = (el.textContent || el.value || '').trim();
        if (text.includes('ログイン') || text.includes('login') || text.includes('Login')) {
          return el;
        }
      }
      // CSSクラスでも探す
      const byClass = document.querySelector('.login-btn, .btn-login, .submit-btn, [class*="login"]');
      if (byClass) return byClass;
      return null;
    }

    function tryDirectNavigation(emailInput, pwInput) {
      // 戦略2: GETフォームの値でURL直接遷移
      console.log('[エステ魂拡張] 戦略2: URL直接遷移');
      const ctk = (document.getElementById('csrf_footer') || document.querySelector('input[name="ctk"]') || {}).value || '';
      const mail = encodeURIComponent(emailInput.value);
      const pw = encodeURIComponent(pwInput.value);
      const r = encodeURIComponent('/admin/blog_edit/');
      const url = 'https://estama.jp/login/?mail=' + mail + '&password=' + pw + '&r=' + r + '&ctk=' + encodeURIComponent(ctk);
      window.location.href = url;
    }
  });
})();
