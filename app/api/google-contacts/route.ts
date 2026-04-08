import { NextResponse } from "next/server";

const API_BASE = "https://people.googleapis.com/v1";

// ============================================================
//  ヘルパー: アクセストークン取得（リフレッシュ対応）
// ============================================================
async function getAccessToken(settings: Record<string, string>): Promise<string> {
  const { google_access_token, google_refresh_token, google_client_id, google_client_secret } = settings;

  // まずアクセストークンを試す
  if (google_access_token) {
    const testRes = await fetch(`${API_BASE}/people/me?personFields=names`, {
      headers: { Authorization: `Bearer ${google_access_token}` },
    });
    if (testRes.ok) return google_access_token;
  }

  // リフレッシュ
  if (!google_refresh_token || !google_client_id || !google_client_secret) {
    throw new Error("Google認証が設定されていません");
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: google_refresh_token,
      client_id: google_client_id,
      client_secret: google_client_secret,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(`トークンリフレッシュ失敗: ${data.error}`);
  return data.access_token;
}

// ============================================================
//  コンタクトグループ管理
// ============================================================
async function getOrCreateGroup(token: string, groupName: string): Promise<string> {
  // 既存グループ検索
  const listRes = await fetch(`${API_BASE}/contactGroups?pageSize=100`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const listData = await listRes.json();
  const groups = listData.contactGroups || [];
  const existing = groups.find((g: { name: string }) => g.name === groupName);
  if (existing) return existing.resourceName;

  // 新規作成
  const createRes = await fetch(`${API_BASE}/contactGroups`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ contactGroup: { name: groupName } }),
  });
  const createData = await createRes.json();
  return createData.resourceName;
}

// ============================================================
//  連絡先検索（電話番号で）
// ============================================================
async function searchByPhone(token: string, phone: string): Promise<string | null> {
  if (!phone) return null;
  const cleanPhone = phone.replace(/[-\s　()（）]/g, "");
  const res = await fetch(`${API_BASE}/people:searchContacts?query=${encodeURIComponent(cleanPhone)}&readMask=phoneNumbers,names&pageSize=5`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  const results = data.results || [];
  for (const r of results) {
    const phones = r.person?.phoneNumbers || [];
    for (const p of phones) {
      const pClean = (p.value || "").replace(/[-\s　()（）+]/g, "");
      if (pClean.includes(cleanPhone) || cleanPhone.includes(pClean)) {
        return r.person.resourceName;
      }
    }
  }
  return null;
}

// ============================================================
//  連絡先作成
// ============================================================
async function createContact(token: string, name: string, phone: string, groupResourceName: string, memo?: string): Promise<string> {
  const body: Record<string, unknown> = {
    names: [{ givenName: name }],
    phoneNumbers: phone ? [{ value: phone, type: "mobile" }] : [],
    memberships: [{ contactGroupMembership: { contactGroupResourceName: groupResourceName } }],
  };
  if (memo) {
    body.biographies = [{ value: memo, contentType: "TEXT_PLAIN" }];
  }

  const res = await fetch(`${API_BASE}/people:createContact?personFields=names,phoneNumbers,memberships`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.resourceName;
}

// ============================================================
//  連絡先更新
// ============================================================
async function updateContact(token: string, resourceName: string, name: string, phone: string, memo?: string, overwriteName?: boolean): Promise<void> {
  // 現在の連絡先取得
  const getRes = await fetch(`${API_BASE}/${resourceName}?personFields=names,phoneNumbers,biographies,memberships,metadata`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const person = await getRes.json();
  const etag = person.etag;

  const updateBody: Record<string, unknown> = { etag };
  const updateFields: string[] = [];

  if (overwriteName && name) {
    updateBody.names = [{ givenName: name }];
    updateFields.push("names");
  }

  if (phone) {
    updateBody.phoneNumbers = [{ value: phone, type: "mobile" }];
    updateFields.push("phoneNumbers");
  }

  if (memo !== undefined) {
    updateBody.biographies = [{ value: memo, contentType: "TEXT_PLAIN" }];
    updateFields.push("biographies");
  }

  if (updateFields.length === 0) return;

  await fetch(`${API_BASE}/${resourceName}:updateContact?updatePersonFields=${updateFields.join(",")}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(updateBody),
  });
}

// ============================================================
//  連絡先のグループ変更
// ============================================================
async function modifyGroupMembership(token: string, resourceName: string, addGroup: string, removeGroups: string[]): Promise<void> {
  // グループメンバー追加
  if (addGroup) {
    await fetch(`${API_BASE}/${addGroup}/members:modify`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ resourceNamesToAdd: [resourceName] }),
    });
  }

  // 旧グループから削除
  for (const rg of removeGroups) {
    if (rg && rg !== addGroup) {
      await fetch(`${API_BASE}/${rg}/members:modify`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ resourceNamesToRemove: [resourceName] }),
      });
    }
  }
}

// ============================================================
//  連絡先削除
// ============================================================
async function deleteContact(token: string, resourceName: string): Promise<void> {
  await fetch(`${API_BASE}/${resourceName}:deleteContact`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
}

// ============================================================
//  POST: メイン処理
// ============================================================
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, settings } = body;

    const token = await getAccessToken(settings);

    // ----------------------------------------------------------
    //  グループ一覧取得（初期化確認用）
    // ----------------------------------------------------------
    if (action === "list_groups") {
      const res = await fetch(`${API_BASE}/contactGroups?pageSize=100`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      const userGroups = (data.contactGroups || []).filter((g: { groupType: string }) => g.groupType === "USER_CONTACT_GROUP");
      return NextResponse.json({ groups: userGroups.map((g: { name: string; resourceName: string; memberCount: number }) => ({ name: g.name, resourceName: g.resourceName, memberCount: g.memberCount || 0 })) });
    }

    // ----------------------------------------------------------
    //  グループ初期化（T-MANAGEグループを一括作成）
    // ----------------------------------------------------------
    if (action === "init_groups") {
      const groupNames = [
        "T-MANAGE 顧客", "T-MANAGE 要注意", "T-MANAGE 出禁",
        "T-MANAGE セラピスト", "T-MANAGE セラピスト休止", "T-MANAGE セラピスト退職",
        "T-MANAGE スタッフ",
      ];
      const results: { name: string; resourceName: string }[] = [];
      for (const name of groupNames) {
        const rn = await getOrCreateGroup(token, name);
        results.push({ name, resourceName: rn });
      }
      return NextResponse.json({ groups: results });
    }

    // ----------------------------------------------------------
    //  連絡先同期（単一）
    // ----------------------------------------------------------
    if (action === "sync_contact") {
      const { name, phone, groupName, memo, overwriteName } = body;
      const groupRN = await getOrCreateGroup(token, groupName);

      // 電話番号で既存検索
      const existing = phone ? await searchByPhone(token, phone) : null;

      if (existing) {
        await updateContact(token, existing, name, phone, memo, overwriteName);
        await modifyGroupMembership(token, existing, groupRN, []);
        return NextResponse.json({ status: "updated", resourceName: existing });
      } else {
        const rn = await createContact(token, name, phone, groupRN, memo);
        return NextResponse.json({ status: "created", resourceName: rn });
      }
    }

    // ----------------------------------------------------------
    //  グループ変更（ランク変更・ステータス変更時）
    // ----------------------------------------------------------
    if (action === "change_group") {
      const { phone, newGroupName, oldGroupNames } = body;
      if (!phone) return NextResponse.json({ error: "電話番号が必要です" }, { status: 400 });

      const existing = await searchByPhone(token, phone);
      if (!existing) return NextResponse.json({ status: "not_found" });

      const newGroupRN = await getOrCreateGroup(token, newGroupName);
      const oldGroupRNs: string[] = [];
      for (const ogn of (oldGroupNames || [])) {
        oldGroupRNs.push(await getOrCreateGroup(token, ogn));
      }
      await modifyGroupMembership(token, existing, newGroupRN, oldGroupRNs);

      return NextResponse.json({ status: "moved" });
    }

    // ----------------------------------------------------------
    //  メモ更新（NG情報等）
    // ----------------------------------------------------------
    if (action === "update_memo") {
      const { phone, memo } = body;
      if (!phone) return NextResponse.json({ error: "電話番号が必要です" }, { status: 400 });

      const existing = await searchByPhone(token, phone);
      if (!existing) return NextResponse.json({ status: "not_found" });

      await updateContact(token, existing, "", "", memo, false);
      return NextResponse.json({ status: "updated" });
    }

    // ----------------------------------------------------------
    //  連絡先削除
    // ----------------------------------------------------------
    if (action === "delete_contact") {
      const { phone } = body;
      if (!phone) return NextResponse.json({ error: "電話番号が必要です" }, { status: 400 });

      const existing = await searchByPhone(token, phone);
      if (!existing) return NextResponse.json({ status: "not_found" });

      await deleteContact(token, existing);
      return NextResponse.json({ status: "deleted" });
    }

    // ----------------------------------------------------------
    //  一括同期
    // ----------------------------------------------------------
    if (action === "bulk_sync") {
      const { contacts, overwriteName } = body;
      // contacts: [{ name, phone, groupName, memo }]
      const results: { name: string; status: string; error?: string }[] = [];

      for (const c of contacts) {
        try {
          const groupRN = await getOrCreateGroup(token, c.groupName);
          const existing = c.phone ? await searchByPhone(token, c.phone) : null;

          if (existing) {
            await updateContact(token, existing, c.name, c.phone, c.memo, overwriteName);
            await modifyGroupMembership(token, existing, groupRN, []);
            results.push({ name: c.name, status: "updated" });
          } else if (c.phone) {
            await createContact(token, c.name, c.phone, groupRN, c.memo);
            results.push({ name: c.name, status: "created" });
          } else {
            results.push({ name: c.name, status: "skipped", error: "電話番号なし" });
          }
          // API制限対策
          await new Promise(r => setTimeout(r, 200));
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "エラー";
          results.push({ name: c.name, status: "error", error: msg });
        }
      }

      return NextResponse.json({ results });
    }

    // ----------------------------------------------------------
    //  接続テスト
    // ----------------------------------------------------------
    if (action === "test_connection") {
      const res = await fetch(`${API_BASE}/people/me?personFields=names`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      const displayName = data.names?.[0]?.displayName || "不明";
      return NextResponse.json({ success: true, accountName: displayName });
    }

    return NextResponse.json({ error: "不明なアクション" }, { status: 400 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Google Contacts API エラー";
    console.error("Google Contacts error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
