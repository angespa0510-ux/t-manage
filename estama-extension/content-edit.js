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
    showBanner('💅 フォーム入力完了 — 画像をアップロード中...');

    try {
      let response;
      if (post.imageUrls && post.imageUrls.length > 0) {
        // T-MANAGEセラピスト画像を使用
        console.log('[エステ魂拡張] T-MANAGE画像URLs:', post.imageUrls.length, '枚');
        response = await new Promise((resolve) => {
          chrome.runtime.sendMessage(
            { type: 'FETCH_IMAGE_URLS', urls: post.imageUrls },
            resolve
          );
        });
      } else {
        // フォールバック: ange-spa.comから取得
        response = await new Promise((resolve) => {
          chrome.runtime.sendMessage(
            { type: 'FETCH_SCHEDULE_IMAGES', roomKey: post.room },
            resolve
          );
        });
      }

      if (response && response.ok && response.images && response.images.length > 0) {
        console.log('[エステ魂拡張] 画像取得:', response.images.length, '枚');
        const csrf = getCsrf();

        for (let i = 0; i < Math.min(response.images.length, 3); i++) {
          const img = response.images[i];
          const uploadId = `blog_icon_${i + 1}-imgupload`;
          try {
            await uploadImage(img.base64, uploadId, csrf);
            console.log('[エステ魂拡張] 画像', i + 1, 'アップロード完了');
          } catch (e) {
            console.warn('[エステ魂拡張] 画像', i + 1, 'アップロード失敗:', e);
          }
        }
        showBanner('✅ 入力＆画像アップロード完了 — 投稿ボタンを押してください！');
      } else {
        console.log('[エステ魂拡張] 画像なし、テキストのみ');
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

  // =============================================
  // 画像アップロード (2段階: uptemp → cropping)
  // =============================================

  async function uploadImage(base64Data, uploadId, csrf) {
    // base64 → Blob
    const parts = base64Data.split(',');
    const mime = parts[0].match(/:(.*?);/)[1];
    const binary = atob(parts[1]);
    const arr = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
    const blob = new Blob([arr], { type: mime });
    const file = new File([blob], 'therapist.jpg', { type: mime });

    // Step 1: uptemp
    const fd1 = new FormData();
    fd1.append('img', file);
    fd1.append('upload_id', uploadId);
    fd1.append('text', 'test');
    fd1.append('ctk', csrf);

    const res1 = await fetch('/post/uptemp/', { method: 'POST', body: fd1 });
    const json1 = await res1.json();
    if (json1.status !== 'success') throw new Error('uptemp failed: ' + JSON.stringify(json1));

    const tempUrl = json1.url;
    const origW = json1.width;
    const origH = json1.height;

    // Step 2: cropping (正方形センタークロップ 400x400)
    let imgW, imgH, x1, y1;
    if (origW > origH) {
      // 横長
      imgH = 400;
      imgW = Math.round(origW * 400 / origH);
      x1 = Math.round((imgW - 400) / 2);
      y1 = 0;
    } else {
      // 縦長
      imgW = 400;
      imgH = Math.round(origH * 400 / origW);
      x1 = 0;
      y1 = Math.round((imgH - 400) / 2);
    }

    const fd2 = new FormData();
    fd2.append('imgUrl', tempUrl);
    fd2.append('imgInitW', origW);
    fd2.append('imgInitH', origH);
    fd2.append('imgW', imgW);
    fd2.append('imgH', imgH);
    fd2.append('imgY1', y1);
    fd2.append('imgX1', x1);
    fd2.append('cropH', 400);
    fd2.append('cropW', 400);
    fd2.append('rotation', 0);
    fd2.append('upload_id', uploadId);
    fd2.append('text', 'test');
    fd2.append('ctk', csrf);

    const res2 = await fetch('/post/cropping/', { method: 'POST', body: fd2 });
    const json2 = await res2.json();
    if (json2.status !== 'success') throw new Error('cropping failed: ' + JSON.stringify(json2));

    console.log('[エステ魂拡張] 画像クロップ完了:', json2.url);
    return json2;
  }
})();
