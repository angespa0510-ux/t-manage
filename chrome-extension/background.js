// T-MANAGE 通知アシスタント v2.0 — Background Service Worker
// S-MANAGEの実績あるアーキテクチャに基づく実装
//
// 役割:
//   ① LINEタブを探してアクティブにする（account-name で業務用/お客様用を識別）
//   ② MAIN worldでVue操作を実行する（router.push, Shadow DOM突破）
//   ③ content_line.js との橋渡し（PING, 再インジェクト）

// ============================================================
//  メッセージルーティング
// ============================================================
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {

  // ----------------------------------------------------------
  //  LINE検索: お客様用
  // ----------------------------------------------------------
  if (msg.type === 'SEARCH_LINE_CUSTOMER') {
    handleSearchLine('customer', msg.name, msg.template, sendResponse);
    return true; // 非同期
  }

  // ----------------------------------------------------------
  //  LINE検索: セラピスト（業務）用
  // ----------------------------------------------------------
  if (msg.type === 'SEARCH_LINE_THERAPIST') {
    handleSearchLine('therapist', msg.name, msg.template, sendResponse);
    return true;
  }

  // ----------------------------------------------------------
  //  MAIN worldでVue操作実行（content_line.jsから依頼）
  // ----------------------------------------------------------
  if (msg.type === 'EXECUTE_IN_MAIN_WORLD') {
    executeInMainWorld(msg.tabId || sender.tab?.id, msg.name, msg.template, sendResponse);
    return true;
  }

  // ----------------------------------------------------------
  //  PING応答確認
  // ----------------------------------------------------------
  if (msg.type === 'PONG') {
    sendResponse({ ok: true });
    return false;
  }

  // ----------------------------------------------------------
  //  SMS自動入力
  // ----------------------------------------------------------
  if (msg.type === 'OPEN_SMS') {
    handleOpenSms(msg.phone, msg.template, sendResponse);
    return true;
  }

  // ----------------------------------------------------------
  //  保留メッセージ取得/クリア（popup.js用, 後方互換）
  // ----------------------------------------------------------
  if (msg.action === 'get_pending') {
    chrome.storage.local.get(['pending_message', 'pending_target', 'pending_type', 'pending_account'], (data) => {
      sendResponse(data);
    });
    return true;
  }
  if (msg.action === 'clear_pending') {
    chrome.storage.local.remove(['pending_message', 'pending_target', 'pending_type', 'pending_account']);
    sendResponse({ ok: true });
    return true;
  }
});

// ============================================================
//  LINE タブ検索 → アクティブ化 → content_line.js に検索依頼
// ============================================================
async function handleSearchLine(accountType, name, template, sendResponse) {
  try {
    const tabs = await chrome.tabs.query({ url: 'https://chat.line.biz/*' });

    if (tabs.length === 0) {
      // LINEタブが無い → 設定URLで新規タブを開く
      const url = await getLineUrl(accountType);
      if (url) {
        await chrome.tabs.create({ url });
        sendResponse({ ok: true, status: 'opened_new_tab' });
      } else {
        sendResponse({ ok: false, error: 'LINE URLが未設定です' });
      }
      return;
    }

    // 各タブのアカウント名を取得して識別
    let targetTab = null;
    for (const tab of tabs) {
      try {
        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            const el = document.querySelector('div.account-name');
            return el ? el.innerText.trim() : '';
          }
        });
        const accountName = results?.[0]?.result || '';
        const isTherapist = accountName.includes('業務');

        if (accountType === 'therapist' && isTherapist) {
          targetTab = tab;
          break;
        }
        if (accountType === 'customer' && !isTherapist) {
          targetTab = tab;
          break;
        }
      } catch (e) {
        console.log('[T-MANAGE] アカウント名取得失敗:', tab.id, e.message);
      }
    }

    // 見つからなかった場合: 設定URLで新規タブを開く
    if (!targetTab) {
      const url = await getLineUrl(accountType);
      if (url) {
        const newTab = await chrome.tabs.create({ url });
        // 新規タブが読み込まれたらcontent scriptが自動実行される
        // storage経由で保留データを渡す
        await chrome.storage.local.set({
          pending_message: template,
          pending_target: name,
          pending_type: 'line',
          pending_account: accountType
        });
        sendResponse({ ok: true, status: 'opened_correct_account' });
      } else {
        // URL未設定 → 既存タブの1つ目を使う（フォールバック）
        targetTab = tabs[0];
      }
    }

    if (!targetTab) return;

    // タブをアクティブにする
    await chrome.tabs.update(targetTab.id, { active: true });
    if (targetTab.windowId) {
      await chrome.windows.update(targetTab.windowId, { focused: true });
    }

    // content_line.js にPINGして生存確認
    const alive = await pingContentScript(targetTab.id);

    if (!alive) {
      // 再インジェクト
      console.log('[T-MANAGE] content_line.js 再インジェクト');
      await chrome.scripting.executeScript({
        target: { tabId: targetTab.id },
        files: ['content_line.js']
      });
      // 少し待ってから再度PING
      await sleep(800);
    }

    // TYPE_IN_LINE_SEARCH を送信
    chrome.tabs.sendMessage(targetTab.id, {
      type: 'TYPE_IN_LINE_SEARCH',
      name: name,
      template: template,
      tabId: targetTab.id
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.log('[T-MANAGE] TYPE_IN_LINE_SEARCH送信失敗:', chrome.runtime.lastError.message);
      }
    });

    sendResponse({ ok: true, status: 'search_started' });

  } catch (err) {
    console.error('[T-MANAGE] handleSearchLine error:', err);
    sendResponse({ ok: false, error: err.message });
  }
}

// ============================================================
//  MAIN world でVue操作実行
//  chatId取得 → router.push → チャット読み込み待ち → テキスト入力
// ============================================================
async function executeInMainWorld(tabId, searchName, template, sendResponse) {
  if (!tabId) {
    sendResponse?.({ ok: false, error: 'tabId missing' });
    return;
  }

  try {
    // Step 1: チャット一覧からchatIdを取得 + 遷移 + テキスト入力（全部MAIN worldで）
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: mainWorldOperation,
      args: [searchName, template]
    });

    const result = results?.[0]?.result;
    sendResponse?.({ ok: true, result });

  } catch (err) {
    console.error('[T-MANAGE] MAIN world実行エラー:', err);
    sendResponse?.({ ok: false, error: err.message });
  }
}

// ============================================================
//  ⭐ MAIN worldで実行される関数
//  （Vue instance, $router, Shadow DOM にアクセス可能）
// ============================================================
function mainWorldOperation(searchName, template) {
  return new Promise((resolve) => {
    // --- 名前クリーニング ---
    const cleanStr = s => s.replace(/[●◆★☆【】\[\]「」\/\s]/g, '').replace(/在$|在勤$/, '');
    const cleanSearch = cleanStr(searchName);

    // --- Step 1: チャット一覧から最良マッチを探す ---
    function tryStep1(retryCount) {
      const items = document.querySelectorAll('.list-group-item-chat');
      console.log(`[T-MANAGE MAIN] items: ${items.length}, retry: ${retryCount}`);

      if (items.length === 0) {
        if (retryCount < 15) {
          setTimeout(() => tryStep1(retryCount + 1), 800);
        } else {
          fireEvent('tmanage_error', 'チャット一覧が取得できません');
          resolve({ error: 'no_items' });
        }
        return;
      }

      let bestEl = null;
      let bestScore = -1;

      items.forEach(el => {
        const vm = el.__vue__;
        if (!vm) return;

        // 名前取得: markタグ（検索ハイライト）の親テキスト、またはdisplayNameなど
        let itemName = '';
        const mark = el.querySelector('mark');
        if (mark) {
          itemName = mark.parentElement?.innerText?.trim() || '';
        } else {
          // Vue propsから名前を取得
          itemName = vm?.$props?.chatModel?.payload?.profile?.displayName || '';
          if (!itemName) {
            // DOM内のテキストから名前っぽいものを取得
            const nameEl = el.querySelector('.chat-name, .display-name, [class*="name"]');
            itemName = nameEl?.innerText?.trim() || '';
          }
        }
        if (!itemName) return;

        const cleanItem = cleanStr(itemName);
        let score = 0;

        if (cleanItem === cleanSearch) {
          score = 3; // 完全一致
        } else if (cleanItem.startsWith(cleanSearch)) {
          const nextChar = cleanItem[cleanSearch.length];
          // 次の文字がひらがな・カタカナなら別の名前（まり→まりや）
          const isContinued = nextChar && /[ぁ-んァ-ヶー]/.test(nextChar);
          score = isContinued ? 0 : 2;
        } else if (cleanItem.includes(cleanSearch)) {
          score = 1; // 部分一致
        }

        if (score > bestScore) {
          bestScore = score;
          bestEl = el;
        }
      });

      if (!bestEl || bestScore < 1) {
        fireEvent('tmanage_error', `「${searchName}」が見つかりません`);
        resolve({ error: 'not_found' });
        return;
      }

      // --- Step 2: chatIdを取得してrouter.pushで遷移 ---
      const vm = bestEl.__vue__;
      const chatId = vm?.$props?.chatModel?.payload?.chatId;

      if (!chatId) {
        fireEvent('tmanage_error', 'chatIdが取得できません');
        resolve({ error: 'no_chatId' });
        return;
      }

      // accountId = URLの最初のパス部分
      const accountId = location.pathname.split('/')[1];

      // Vue Routerを取得
      let router = null;
      const appEl = document.querySelector('#app') || document.querySelector('[data-v-app]') || document.querySelector('*');
      if (appEl?.__vue_app__) {
        // Vue 3
        router = appEl.__vue_app__.config.globalProperties.$router;
      }
      if (!router) {
        // Vue 2: 任意の要素から$routerを辿る
        const anyEl = document.querySelector('.list-group-item-chat');
        router = anyEl?.__vue__?.$router;
      }

      if (!router) {
        fireEvent('tmanage_error', 'Vue Router が見つかりません');
        resolve({ error: 'no_router' });
        return;
      }

      console.log(`[T-MANAGE MAIN] 遷移: /${accountId}/chat/${chatId}`);
      router.push(`/${accountId}/chat/${chatId}`);

      // --- Step 3: チャット読み込みを待ってテキスト入力 ---
      let pollCount = 0;
      const pollChat = () => {
        const nowPath = location.pathname;
        const msgs = document.querySelectorAll('div.chat-content');

        if (nowPath.includes(chatId) && msgs.length > 0) {
          // 読み込み完了 → テキスト入力
          tryInsertText(12);
        } else if (pollCount++ < 30) {
          setTimeout(pollChat, 400); // 400ms × 30 = 最大12秒
        } else {
          fireEvent('tmanage_error', 'チャット画面の読み込みタイムアウト');
          resolve({ error: 'poll_timeout' });
        }
      };
      setTimeout(pollChat, 500);
    }

    // --- テキスト入力（Shadow DOM突破） ---
    function tryInsertText(retryCount) {
      const taEx = document.querySelector('textarea-ex');
      const inner = taEx?.shadowRoot?.querySelector('textarea');

      if (!inner) {
        if (retryCount > 0) {
          setTimeout(() => tryInsertText(retryCount - 1), 600);
        } else {
          fireEvent('tmanage_error', 'テキスト入力欄が見つかりません');
          // クリップボードにコピー（フォールバック）
          navigator.clipboard.writeText(template).catch(() => {});
          resolve({ error: 'no_textarea' });
        }
        return;
      }

      inner.focus();
      document.execCommand('insertText', false, template);
      inner.dispatchEvent(new Event('input', { bubbles: true }));

      console.log('[T-MANAGE MAIN] テキスト入力完了');
      fireEvent('tmanage_success', 'テキストを入力しました');
      resolve({ success: true });
    }

    // --- CustomEvent発火（MAIN → ISOLATED worldへの通知） ---
    function fireEvent(eventName, detail) {
      document.dispatchEvent(new CustomEvent(eventName, { detail }));
    }

    // --- 実行開始 ---
    tryStep1(0);
  });
}

// ============================================================
//  SMS: Google Messages タブ管理
// ============================================================
async function handleOpenSms(phone, template, sendResponse) {
  try {
    // 保留データをstorageに保存（content_sms.jsが読み取る）
    await chrome.storage.local.set({
      pending_message: template,
      pending_target: phone || '',
      pending_type: 'sms'
    });

    const tabs = await chrome.tabs.query({ url: 'https://messages.google.com/*' });
    if (tabs.length > 0) {
      await chrome.tabs.update(tabs[0].id, { active: true });
      if (tabs[0].windowId) {
        await chrome.windows.update(tabs[0].windowId, { focused: true });
      }
      // content_sms.jsにメッセージ送信
      chrome.tabs.sendMessage(tabs[0].id, {
        type: 'FILL_SMS',
        phone: phone,
        template: template
      });
    } else {
      await chrome.tabs.create({ url: 'https://messages.google.com/web/conversations' });
    }
    sendResponse({ ok: true });
  } catch (err) {
    sendResponse({ ok: false, error: err.message });
  }
}

// ============================================================
//  ユーティリティ
// ============================================================

// content_line.js にPINGしてISOLATED worldが生きているか確認
function pingContentScript(tabId) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, { type: 'PING' }, (response) => {
      if (chrome.runtime.lastError || !response) {
        resolve(false);
      } else {
        resolve(true);
      }
    });
  });
}

// LINE URLをstorageから取得
function getLineUrl(accountType) {
  return new Promise((resolve) => {
    chrome.storage.local.get(['line_url_customer', 'line_url_therapist'], (data) => {
      if (accountType === 'therapist') {
        resolve(data.line_url_therapist || '');
      } else {
        resolve(data.line_url_customer || '');
      }
    });
  });
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}
