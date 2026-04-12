// ============================================
// Google Sites コンテンツ抽出スクリプト
// 使い方:
// 1. Google Sitesの記事ページを開く
// 2. F12 で開発者ツールを開く
// 3. Console タブに以下を貼り付けてEnter
// 4. 結果がクリップボードにコピーされます
// ============================================

(function() {
  // メインコンテンツエリアを取得
  const main = document.querySelector('[role="main"]') || document.querySelector('main') || document.body;
  
  // タイトル取得
  const titleEl = main.querySelector('h1') || document.querySelector('h1');
  const title = titleEl ? titleEl.textContent.trim() : document.title.replace(' - セラピストマニュアル', '').trim();
  
  let markdown = `# ${title}\n\n`;
  
  // コンテンツ部分を取得（ナビゲーションを除外）
  const contentSections = main.querySelectorAll('[data-has-non-mobile-size]') || main.querySelectorAll('section');
  
  // 全ての要素を走査してマークダウンに変換
  function processNode(node) {
    let result = '';
    
    for (const child of node.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) {
        const text = child.textContent.trim();
        if (text) result += text;
        continue;
      }
      
      if (child.nodeType !== Node.ELEMENT_NODE) continue;
      
      const tag = child.tagName.toLowerCase();
      const text = child.textContent.trim();
      
      // スキップ: ナビゲーション、メニュー
      if (child.getAttribute('role') === 'navigation') continue;
      if (child.classList.contains('navigation-widget')) continue;
      
      // 見出し
      if (tag === 'h1') { result += `\n## ${text}\n\n`; continue; }
      if (tag === 'h2') { result += `\n## ${text}\n\n`; continue; }
      if (tag === 'h3') { result += `\n### ${text}\n\n`; continue; }
      
      // 画像
      if (tag === 'img') {
        const src = child.src || child.getAttribute('data-src') || '';
        if (src && !src.includes('icon') && !src.includes('favicon')) {
          result += `\n![画像](${src})\n\n`;
        }
        continue;
      }
      
      // リスト
      if (tag === 'ul' || tag === 'ol') {
        const items = child.querySelectorAll('li');
        items.forEach((li, i) => {
          const prefix = tag === 'ol' ? `${i + 1}. ` : '- ';
          result += `${prefix}${li.textContent.trim()}\n`;
        });
        result += '\n';
        continue;
      }
      
      // リンク
      if (tag === 'a') {
        const href = child.href || '';
        if (text && href && !href.includes('sites.google.com')) {
          result += `[${text}](${href})`;
        } else {
          result += text;
        }
        continue;
      }
      
      // 太字
      if (tag === 'b' || tag === 'strong') {
        result += `**${text}**`;
        continue;
      }
      
      // 段落・div
      if (tag === 'p' || tag === 'div') {
        // 中に画像があるか確認
        const imgs = child.querySelectorAll('img');
        if (imgs.length > 0) {
          imgs.forEach(img => {
            const src = img.src || img.getAttribute('data-src') || '';
            if (src && src.length > 20) {
              result += `\n![画像](${src})\n\n`;
            }
          });
        }
        
        // テキストコンテンツ
        const childText = child.textContent.trim();
        if (childText && !child.querySelector('img')) {
          // 子要素を再帰処理
          const inner = processNode(child);
          if (inner.trim()) {
            result += inner + '\n\n';
          }
        } else if (childText && child.querySelector('img')) {
          // テキスト+画像の混在
          const pureText = Array.from(child.childNodes)
            .filter(n => n.nodeType === Node.TEXT_NODE)
            .map(n => n.textContent.trim())
            .filter(t => t)
            .join(' ');
          if (pureText) result += pureText + '\n\n';
        }
        continue;
      }
      
      // その他: 再帰処理
      if (child.children && child.children.length > 0) {
        result += processNode(child);
      } else if (text) {
        result += text + '\n';
      }
    }
    
    return result;
  }
  
  // メインコンテンツからテキスト+画像を抽出
  if (contentSections.length > 0) {
    contentSections.forEach(section => {
      markdown += processNode(section);
    });
  } else {
    markdown += processNode(main);
  }
  
  // 画像URLを別途収集（Google Sites専用の複数パターンで検索）
  const imageUrls = [];
  
  // パターン1: 通常のimgタグ
  main.querySelectorAll('img').forEach(img => {
    const src = img.src || img.getAttribute('data-src') || img.getAttribute('data-image') || '';
    if (src && src.length > 50 && !imageUrls.includes(src)) {
      imageUrls.push(src);
    }
  });
  
  // パターン2: background-imageスタイル
  main.querySelectorAll('[style*="background"]').forEach(el => {
    const style = el.getAttribute('style') || '';
    const match = style.match(/url\(['"]?(https?:\/\/[^'")\s]+)['"]?\)/);
    if (match && match[1] && !imageUrls.includes(match[1])) {
      imageUrls.push(match[1]);
    }
  });
  
  // パターン3: data属性にある画像URL
  main.querySelectorAll('[data-image-url], [data-src], [data-original-src]').forEach(el => {
    const src = el.getAttribute('data-image-url') || el.getAttribute('data-src') || el.getAttribute('data-original-src') || '';
    if (src && src.length > 50 && !imageUrls.includes(src)) {
      imageUrls.push(src);
    }
  });
  
  // パターン4: Google Sites特有の画像コンテナ（全属性からURL検索）
  main.querySelectorAll('*').forEach(el => {
    for (const attr of el.attributes || []) {
      if (attr.value && attr.value.includes('googleusercontent.com') && !imageUrls.includes(attr.value)) {
        const urlMatch = attr.value.match(/(https:\/\/lh[0-9]*\.googleusercontent\.com\/[^\s'"<>]+)/);
        if (urlMatch) imageUrls.push(urlMatch[1]);
      }
    }
  });
  
  // パターン5: ページ全体のHTMLソースからgoogleusercontent URLを検索
  const htmlSource = main.innerHTML;
  const googleImgRegex = /https:\/\/lh[0-9]*\.googleusercontent\.com\/[^"'\s<>)]+/g;
  let urlMatch;
  while ((urlMatch = googleImgRegex.exec(htmlSource)) !== null) {
    if (!imageUrls.includes(urlMatch[0]) && urlMatch[0].length > 60) {
      imageUrls.push(urlMatch[0]);
    }
  }
  
  if (imageUrls.length > 0) {
    markdown += '\n\n---\n## 📸 このページの画像URL一覧\n\n';
    imageUrls.forEach((url, i) => {
      markdown += `${i + 1}. ![画像${i + 1}](${url})\n\n`;
    });
  }
  
  // クリーンアップ
  markdown = markdown
    .replace(/\n{3,}/g, '\n\n')
    .replace(/セラピストマニュアル\n/g, '')
    .replace(/Search this site\n/g, '')
    .replace(/Embedded Files\n/g, '')
    .replace(/Skip to main content\n/g, '')
    .replace(/Skip to navigation\n/g, '')
    .replace(/Report abuse\n/g, '')
    .replace(/Page details\n/g, '')
    .replace(/Page updated\n/g, '')
    .replace(/Google Sites\n/g, '')
    .trim();
  
  // クリップボードにコピー
  navigator.clipboard.writeText(markdown).then(() => {
    alert(`✅ コピー完了！\n\nタイトル: ${title}\n文字数: ${markdown.length}文字\n画像: ${imageUrls.length}枚\n\nT-MANAGEの管理画面で「本文」に貼り付けてください。`);
  }).catch(() => {
    // クリップボード失敗時はプロンプトで表示
    const w = window.open('', '_blank', 'width=800,height=600');
    w.document.write(`<pre style="white-space:pre-wrap;font-size:12px;padding:20px;">${markdown.replace(/</g, '&lt;')}</pre>`);
    w.document.title = `${title} - 抽出結果`;
    alert(`📋 新しいウィンドウに結果を表示しました。\nCtrl+A → Ctrl+C でコピーしてください。`);
  });
  
  console.log('=== 抽出結果 ===');
  console.log(markdown);
  console.log(`\n画像URL: ${imageUrls.length}件`);
  imageUrls.forEach((url, i) => console.log(`  ${i + 1}. ${url}`));
})();
