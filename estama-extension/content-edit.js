// =============================================
// T-MANAGE エステ魂自動投稿 — content-edit.js v3
// API直接アップロード方式（クロップダイアログをバイパス）
// =============================================

(function () {
  console.log('[エステ魂拡張] 投稿ページ検出');

  chrome.storage.local.get('estamaPost', async (data) => {
    const post = data.estamaPost;
    if (!post || !post.title || !post.content) {
      console.log('[エステ魂拡張] 投稿データなし、スキップ');
      return;
    }
    if (Date.now() - post.timestamp > 10 * 60 * 1000) {
      console.log('[エステ魂拡張] 古いデータ、スキップ');
      chrome.storage.local.remove('estamaPost');
      return;
    }

    console.log('[エステ魂拡張] フォーム自動入力開始');
    await waitForElement('#PostTitle', 5000);

    // ===== 1. カテゴリ: ご案内状況 =====
    clickRadio('input[name="main[category_id]"][value="11"]');
    // ===== 2. タイトル =====
    setInputValue('PostTitle', post.title);
    // ===== 3. 本文 =====
    setInputValue('PostContent', post.content);
    // ===== 4. ボタン: 公式HP =====
    clickRadio('input[name="main[blog_type]"][value="3"]');
    // ===== 5. 投稿: すぐ公開 =====
    clickRadio('input[name="future[post]"][value="0"]');

    console.log('[エステ魂拡張] フォーム入力完了');

    // ===== 6. 画像アップロード（API直接方式）=====
    showBanner('💅 フォーム入力完了 — 画像をアップロード中...');

    try {
      let response;
      if (post.imageUrls && post.imageUrls.length > 0) {
        response = await new Promise(r => chrome.runtime.sendMessage({ type: 'FETCH_IMAGE_URLS', urls: post.imageUrls }, r));
      } else {
        response = await new Promise(r => chrome.runtime.sendMessage({ type: 'FETCH_SCHEDULE_IMAGES', roomKey: post.room }, r));
      }

      if (response && response.ok && response.images && response.images.length > 0) {
        const csrf = getCsrf();
        let ok = 0;

        for (let i = 0; i < Math.min(response.images.length, 3); i++) {
          showBanner(`💅 画像 ${i + 1}/${Math.min(response.images.length, 3)} アップロード中...`);
          const uploadId = `blog_icon_${i + 1}-imgupload`;
          try {
            const croppedUrl = await uploadAndCrop(response.images[i].base64, uploadId, csrf);
            if (croppedUrl) {
              updateImagePreview(uploadId, croppedUrl);
              ok++;
              console.log('[エステ魂拡張] 画像', i + 1, '完了:', croppedUrl);
            }
          } catch (e) {
            console.warn('[エステ魂拡張] 画像', i + 1, '失敗:', e.message);
          }
        }
        showBanner(ok > 0
          ? `✅ ${ok}枚の画像＆フォーム入力完了 — 投稿ボタンを押してください！`
          : '✅ フォーム入力完了 — 投稿ボタンを押してください！');
      } else {
        showBanner('✅ フォーム入力完了 — 投稿ボタンを押してください！');
      }
    } catch (e) {
      console.warn('[エステ魂拡張] 画像エラー:', e);
      showBanner('✅ フォーム入力完了 — 投稿ボタンを押してください！');
    }

    chrome.storage.local.remove('estamaPost');
  });

  // =============================================
  // API直接アップロード（uptemp → cropping）
  // =============================================
  async function uploadAndCrop(base64Data, uploadId, csrf) {
    // base64 → File
    const parts = base64Data.split(',');
    const mime = parts[0].match(/:(.*?);/)[1];
    const bin = atob(parts[1]);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    const file = new File([arr], 'photo.jpg', { type: mime });

    // Step 1: uptemp
    const fd1 = new FormData();
    fd1.append('img', file);
    fd1.append('upload_id', uploadId);
    fd1.append('text', 'test');
    fd1.append('ctk', csrf);

    console.log('[エステ魂拡張] uptemp送信:', uploadId);
    const res1 = await fetch('/post/uptemp/', { method: 'POST', body: fd1, credentials: 'same-origin' });
    const json1 = await res1.json();
    console.log('[エステ魂拡張] uptemp応答:', JSON.stringify(json1));
    if (json1.status !== 'success') throw new Error('uptemp: ' + JSON.stringify(json1));

    const tempUrl = json1.url;
    const W = json1.width;
    const H = json1.height;

    // Step 2: cropping（400x400正方形センタークロップ）
    let imgW, imgH, x1, y1;
    if (W > H) {
      imgH = 400; imgW = Math.round(W * 400 / H);
      x1 = Math.round((imgW - 400) / 2); y1 = 0;
    } else {
      imgW = 400; imgH = Math.round(H * 400 / W);
      x1 = 0; y1 = Math.round((imgH - 400) / 2);
    }

    const fd2 = new FormData();
    fd2.append('imgUrl', tempUrl);
    fd2.append('imgInitW', String(W));
    fd2.append('imgInitH', String(H));
    fd2.append('imgW', String(imgW));
    fd2.append('imgH', String(imgH));
    fd2.append('imgY1', String(y1));
    fd2.append('imgX1', String(x1));
    fd2.append('cropH', '400');
    fd2.append('cropW', '400');
    fd2.append('rotation', '0');
    fd2.append('upload_id', uploadId);
    fd2.append('text', 'test');
    fd2.append('ctk', csrf);

    console.log('[エステ魂拡張] cropping送信:', uploadId);
    const res2 = await fetch('/post/cropping/', { method: 'POST', body: fd2, credentials: 'same-origin' });
    const json2 = await res2.json();
    console.log('[エステ魂拡張] cropping応答:', JSON.stringify(json2));
    if (json2.status !== 'success') throw new Error('crop: ' + JSON.stringify(json2));

    return json2.url; // /temp/cropped_xxx.jpg
  }

  // =============================================
  // UIプレビュー更新（アップロード済み画像をフォームに表示）
  // =============================================
  function updateImagePreview(uploadId, croppedUrl) {
    // upload_id = "blog_icon_1-imgupload" → コンテナを探す
    const container = document.getElementById(uploadId);
    if (container) {
      // コンテナ内をクロップ済み画像に差し替え
      const imgUrl = croppedUrl.startsWith('http') ? croppedUrl : 'https://estama.jp' + croppedUrl;
      container.innerHTML = `<img src="${imgUrl}" style="width:100%;height:auto;border-radius:4px;">`;
      console.log('[エステ魂拡張] プレビュー更新:', uploadId);
    } else {
      // IDで見つからない場合、番号から推測
      const num = uploadId.replace('blog_icon_', '').replace('-imgupload', '');
      const wrapper = document.querySelector(`[id*="blog_icon_${num}"]`);
      if (wrapper) {
        const img = document.createElement('img');
        img.src = croppedUrl.startsWith('http') ? croppedUrl : 'https://estama.jp' + croppedUrl;
        img.style.cssText = 'width:100%;height:auto;border-radius:4px;';
        wrapper.innerHTML = '';
        wrapper.appendChild(img);
      }
    }
  }

  // =============================================
  // ユーティリティ
  // =============================================
  function waitForElement(sel, timeout = 5000) {
    return new Promise(resolve => {
      const el = document.querySelector(sel);
      if (el) return resolve(el);
      const t = Date.now();
      const iv = setInterval(() => {
        const e = document.querySelector(sel);
        if (e || Date.now() - t > timeout) { clearInterval(iv); resolve(e); }
      }, 200);
    });
  }

  function getCsrf() {
    return (document.getElementById('csrf_footer') || document.querySelector('input[name="ctk"]') || {}).value || '';
  }

  function setInputValue(id, val) {
    const el = document.getElementById(id);
    if (el) { el.value = val; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }
  }

  function clickRadio(sel) {
    const el = document.querySelector(sel);
    if (el) { el.checked = true; el.dispatchEvent(new Event('change', { bubbles: true })); el.click(); }
  }

  function showBanner(text) {
    let b = document.getElementById('estama-ext-banner');
    if (!b) {
      b = document.createElement('div');
      b.id = 'estama-ext-banner';
      b.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;background:linear-gradient(135deg,#ec4899,#a855f7);color:white;text-align:center;padding:14px;font-size:15px;font-weight:bold;box-shadow:0 4px 20px rgba(0,0,0,0.3);';
      document.body.prepend(b);
    }
    b.textContent = text;
  }
})();
