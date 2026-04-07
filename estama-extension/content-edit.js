// =============================================
// T-MANAGE エステ魂自動投稿 — content-edit.js
// estama.jp/admin/blog_edit フォーム自動入力＆画像アップロード
// =============================================

(function () {
  console.log('[エステ魂拡張] 投稿ページ検出');

  chrome.storage.local.get('estamaPost', async (data) => {
    const post = data.estamaPost;
    if (!post || !post.title || !post.content) {
      console.log('[エステ魂拡張] 投稿データなし、スキップ');
      return;
    }

    // 古いデータ（10分以上前）はスキップ
    if (Date.now() - post.timestamp > 10 * 60 * 1000) {
      console.log('[エステ魂拡張] 古いデータ、スキップ');
      chrome.storage.local.remove('estamaPost');
      return;
    }

    console.log('[エステ魂拡張] フォーム自動入力開始');

    // フォーム要素の読み込み待機
    await waitForElement('#PostTitle', 5000);

    // ===== 1. カテゴリ選択: ご案内状況 (value=11) =====
    const categoryRadio = document.querySelector('input[name="main[category_id]"][value="11"]');
    if (categoryRadio) {
      categoryRadio.checked = true;
      categoryRadio.dispatchEvent(new Event('change', { bubbles: true }));
      categoryRadio.click();
      console.log('[エステ魂拡張] カテゴリ: ご案内状況');
    }

    // ===== 2. タイトル入力 =====
    const titleInput = document.getElementById('PostTitle');
    if (titleInput) {
      titleInput.value = post.title;
      titleInput.dispatchEvent(new Event('input', { bubbles: true }));
      titleInput.dispatchEvent(new Event('change', { bubbles: true }));
      console.log('[エステ魂拡張] タイトル:', post.title);
    }

    // ===== 3. 本文入力 =====
    const contentArea = document.getElementById('PostContent');
    if (contentArea) {
      contentArea.value = post.content;
      contentArea.dispatchEvent(new Event('input', { bubbles: true }));
      contentArea.dispatchEvent(new Event('change', { bubbles: true }));
      console.log('[エステ魂拡張] 本文入力完了（', post.content.length, '文字）');
    }

    // ===== 4. 設置するボタン: 公式HP (value=3) =====
    const blogTypeRadio = document.querySelector('input[name="main[blog_type]"][value="3"]');
    if (blogTypeRadio) {
      blogTypeRadio.checked = true;
      blogTypeRadio.dispatchEvent(new Event('change', { bubbles: true }));
      blogTypeRadio.click();
      console.log('[エステ魂拡張] ボタン: 公式HP');
    }

    // ===== 5. 投稿日時: すぐ公開する (value=0) =====
    const postTimingRadio = document.querySelector('input[name="future[post]"][value="0"]');
    if (postTimingRadio) {
      postTimingRadio.checked = true;
      postTimingRadio.dispatchEvent(new Event('change', { bubbles: true }));
      postTimingRadio.click();
      console.log('[エステ魂拡張] 投稿: すぐ公開');
    }

    // ===== 6. 画像アップロード =====
    showBanner('💅 フォーム入力完了 — 画像を設定中...');

    try {
      let response;
      if (post.imageUrls && post.imageUrls.length > 0) {
        console.log('[エステ魂拡張] T-MANAGE画像URLs:', post.imageUrls.length, '枚');
        response = await new Promise((resolve) => {
          chrome.runtime.sendMessage({ type: 'FETCH_IMAGE_URLS', urls: post.imageUrls }, resolve);
        });
      } else {
        response = await new Promise((resolve) => {
          chrome.runtime.sendMessage({ type: 'FETCH_SCHEDULE_IMAGES', roomKey: post.room }, resolve);
        });
      }

      if (response && response.ok && response.images && response.images.length > 0) {
        console.log('[エステ魂拡張] 画像取得成功:', response.images.length, '枚');

        for (let i = 0; i < Math.min(response.images.length, 3); i++) {
          const img = response.images[i];
          const fileInputId = `blog_icon_${i + 1}-imgupload_imgUploadField`;
          const fileInput = document.getElementById(fileInputId);

          if (!fileInput) {
            console.warn('[エステ魂拡張] ファイル入力欄が見つかりません:', fileInputId);
            continue;
          }

          try {
            // base64 → File変換
            const file = base64ToFile(img.base64, `therapist_${i + 1}.jpg`);

            // DataTransfer でファイルをセット
            const dt = new DataTransfer();
            dt.items.add(file);
            fileInput.files = dt.files;

            // changeイベントを発火（estama.jpのアップロードJSをトリガー）
            fileInput.dispatchEvent(new Event('change', { bubbles: true }));
            console.log('[エステ魂拡張] 画像', i + 1, 'をファイル入力にセット');

            // 次の画像まで少し待つ（サーバー処理のため）
            await new Promise(r => setTimeout(r, 1500));
          } catch (e) {
            console.warn('[エステ魂拡張] 画像', i + 1, 'セット失敗:', e);
          }
        }
        showBanner('✅ 入力＆画像アップロード完了 — 投稿ボタンを押してください！');
      } else {
        console.log('[エステ魂拡張] 画像なしまたは取得失敗:', response);
        showBanner('✅ フォーム入力完了 — 投稿ボタンを押してください！');
      }
    } catch (e) {
      console.warn('[エステ魂拡張] 画像処理エラー:', e);
      showBanner('✅ フォーム入力完了（画像なし） — 投稿ボタンを押してください！');
    }

    // 投稿データをクリア
    chrome.storage.local.remove('estamaPost');
  });

  // =============================================
  // ユーティリティ関数
  // =============================================

  function waitForElement(selector, timeout = 5000) {
    return new Promise((resolve) => {
      const el = document.querySelector(selector);
      if (el) return resolve(el);
      const start = Date.now();
      const check = setInterval(() => {
        const el2 = document.querySelector(selector);
        if (el2 || Date.now() - start > timeout) {
          clearInterval(check);
          resolve(el2);
        }
      }, 200);
    });
  }

  function getCsrf() {
    const el = document.getElementById('csrf_footer');
    return el ? el.value : '';
  }

  function showBanner(text) {
    let banner = document.getElementById('estama-ext-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'estama-ext-banner';
      banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;background:linear-gradient(135deg,#ec4899,#a855f7);color:white;text-align:center;padding:14px;font-size:15px;font-weight:bold;box-shadow:0 4px 20px rgba(0,0,0,0.3);transition:opacity 0.3s;';
      document.body.prepend(banner);
    }
    banner.textContent = text;
  }

  function base64ToFile(base64Data, fileName) {
    const parts = base64Data.split(',');
    const mime = parts[0].match(/:(.*?);/)[1];
    const binary = atob(parts[1]);
    const arr = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
    return new File([arr], fileName, { type: mime });
  }
})();
