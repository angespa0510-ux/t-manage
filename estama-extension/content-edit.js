// =============================================
// T-MANAGE エステ魂自動投稿 — content-edit.js v4
// API直接アップロード + DOM操作でフォームに画像登録
// =============================================

(function () {
  console.log('[エステ魂拡張] 投稿ページ検出');

  chrome.storage.local.get('estamaPost', async (data) => {
    const post = data.estamaPost;
    if (!post || !post.title || !post.content) return;
    if (Date.now() - post.timestamp > 10 * 60 * 1000) {
      chrome.storage.local.remove('estamaPost');
      return;
    }

    await waitForElement('#PostTitle', 5000);

    // フォーム入力
    clickRadio('input[name="main[category_id]"][value="11"]');
    setVal('PostTitle', post.title);
    setVal('PostContent', post.content);
    clickRadio('input[name="main[blog_type]"][value="3"]');
    clickRadio('input[name="future[post]"][value="0"]');
    console.log('[エステ魂拡張] フォーム入力完了');

    // ===== 画像アップロード =====
    showBanner('💅 画像をアップロード中...');

    try {
      let response;
      if (post.imageUrls && post.imageUrls.length > 0) {
        response = await new Promise(r => chrome.runtime.sendMessage({ type: 'FETCH_IMAGE_URLS', urls: post.imageUrls }, r));
      } else {
        response = await new Promise(r => chrome.runtime.sendMessage({ type: 'FETCH_SCHEDULE_IMAGES', roomKey: post.room }, r));
      }

      if (response && response.ok && response.images && response.images.length > 0) {
        let ok = 0;
        for (let i = 0; i < Math.min(response.images.length, 3); i++) {
          showBanner(`💅 画像 ${i + 1}/${Math.min(response.images.length, 3)} アップロード中...`);
          const uploadId = `blog_icon_${i + 1}-imgupload`;
          try {
            const croppedUrl = await uploadWithRetry(response.images[i].base64, uploadId, 3);
            if (croppedUrl) {
              insertImageDOM(i, uploadId, croppedUrl);
              ok++;
            }
          } catch (e) {
            console.warn('[エステ魂拡張] 画像', i + 1, '失敗:', e.message);
          }
        }
        showBanner(ok > 0
          ? `✅ ${ok}枚の画像＆入力完了 — 投稿ボタンを押してください！`
          : '✅ 入力完了 — 投稿ボタンを押してください！');
      } else {
        showBanner('✅ 入力完了 — 投稿ボタンを押してください！');
      }
    } catch (e) {
      console.warn('[エステ魂拡張] 画像エラー:', e);
      showBanner('✅ 入力完了 — 投稿ボタンを押してください！');
    }

    chrome.storage.local.remove('estamaPost');
  });

  // =============================================
  // アップロード（403リトライ付き）
  // =============================================
  async function uploadWithRetry(base64Data, uploadId, maxRetry) {
    for (let attempt = 0; attempt < maxRetry; attempt++) {
      try {
        const csrf = getCsrf(); // 毎回再取得
        const croppedUrl = await uploadAndCrop(base64Data, uploadId, csrf);
        return croppedUrl;
      } catch (e) {
        console.warn(`[エステ魂拡張] 試行${attempt + 1}失敗:`, e.message);
        if (attempt < maxRetry - 1) {
          const wait = (attempt + 1) * 800;
          console.log(`[エステ魂拡張] ${wait}ms後にリトライ...`);
          await new Promise(r => setTimeout(r, wait));
        } else {
          throw e;
        }
      }
    }
  }

  // =============================================
  // API直接アップロード（uptemp → cropping）
  // =============================================
  async function uploadAndCrop(base64Data, uploadId, csrf) {
    const parts = base64Data.split(',');
    const mime = parts[0].match(/:(.*?);/)[1];
    const bin = atob(parts[1]);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    const ext = mime.includes('png') ? 'png' : 'jpg';
    const file = new File([arr], `photo.${ext}`, { type: mime });
    console.log('[エステ魂拡張] 画像準備:', uploadId, 'size=' + file.size + 'bytes', 'type=' + mime, 'ext=' + ext);

    // Step 1: uptemp
    const fd1 = new FormData();
    fd1.append('img', file);
    fd1.append('upload_id', uploadId);
    fd1.append('text', 'test');
    fd1.append('ctk', csrf);

    const res1 = await fetch('/post/uptemp/', { method: 'POST', body: fd1, credentials: 'same-origin' });
    if (res1.status === 403) throw new Error('403 CSRF');
    const text1 = await res1.text();
    console.log('[エステ魂拡張] uptemp応答(raw):', text1.substring(0, 300));
    let json1;
    try { json1 = JSON.parse(text1); } catch (e) { throw new Error('uptemp parse失敗: ' + text1.substring(0, 100)); }
    console.log('[エステ魂拡張] uptemp:', JSON.stringify(json1));
    if (json1.status !== 'success') throw new Error('uptemp: ' + json1.status + ' ' + (json1.message || json1.error || ''));

    const W = json1.width, H = json1.height;

    // Step 2: cropping（正方形センタークロップ）
    let imgW, imgH, x1, y1;
    if (W > H) {
      imgH = 400; imgW = Math.round(W * 400 / H);
      x1 = Math.round((imgW - 400) / 2); y1 = 0;
    } else {
      imgW = 400; imgH = Math.round(H * 400 / W);
      x1 = 0; y1 = Math.round((imgH - 400) / 2);
    }

    const fd2 = new FormData();
    fd2.append('imgUrl', json1.url);
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

    const res2 = await fetch('/post/cropping/', { method: 'POST', body: fd2, credentials: 'same-origin' });
    if (res2.status === 403) throw new Error('403 CSRF crop');
    const json2 = await res2.json();
    console.log('[エステ魂拡張] crop:', JSON.stringify(json2));
    if (json2.status !== 'success') throw new Error('crop: ' + json2.status);

    return json2.url;
  }

  // =============================================
  // DOM操作: div.img_area にクロップ済み画像を挿入
  // =============================================
  function insertImageDOM(index, uploadId, croppedUrl) {
    const imgAreas = document.querySelectorAll('div.img_area');
    const target = imgAreas[index];

    if (target) {
      target.innerHTML = `
        <div class="up_items">
          <img src="${croppedUrl}">
          <a href="javascript:void(0)" class="temp-delete bc-delete">× キャンセル</a>
          <input name="${uploadId}" value="${croppedUrl}" type="hidden">
        </div>
      `;
      console.log('[エステ魂拡張] DOM挿入完了:', uploadId, '→ img_area[' + index + ']');
    } else {
      console.warn('[エステ魂拡張] img_area[' + index + '] が見つかりません。hidden inputのみ追加');
      // フォールバック: hidden inputだけ追加
      const form = document.querySelector('form') || document.body;
      const hidden = document.createElement('input');
      hidden.type = 'hidden';
      hidden.name = uploadId;
      hidden.value = croppedUrl;
      form.appendChild(hidden);
    }
  }

  // =============================================
  // ユーティリティ
  // =============================================
  function waitForElement(sel, t = 5000) {
    return new Promise(r => {
      const e = document.querySelector(sel);
      if (e) return r(e);
      const s = Date.now();
      const iv = setInterval(() => { const e2 = document.querySelector(sel); if (e2 || Date.now() - s > t) { clearInterval(iv); r(e2); } }, 200);
    });
  }
  function getCsrf() {
    return (document.getElementById('csrf_footer') || document.querySelector('input[name="ctk"]') || {}).value || '';
  }
  function setVal(id, v) {
    const el = document.getElementById(id);
    if (el) { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }
  }
  function clickRadio(sel) {
    const el = document.querySelector(sel);
    if (el) { el.checked = true; el.dispatchEvent(new Event('change', { bubbles: true })); el.click(); }
  }
  function showBanner(text) {
    let b = document.getElementById('estama-ext-banner');
    if (!b) { b = document.createElement('div'); b.id = 'estama-ext-banner'; b.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;background:linear-gradient(135deg,#ec4899,#a855f7);color:white;text-align:center;padding:14px;font-size:15px;font-weight:bold;box-shadow:0 4px 20px rgba(0,0,0,0.3);'; document.body.prepend(b); }
    b.textContent = text;
  }
})();
