import { NextResponse } from "next/server";
import * as cheerio from "cheerio";

const HP_BASE = "https://ange-spa.com/pwc-admin";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";

// ============================================================
//  HP ログイン
// ============================================================
async function hpLogin(loginId: string, loginPass: string): Promise<string> {
  // Step 1: GET login page → PHPSESSID取得
  const getRes = await fetch(`${HP_BASE}/login.php`, {
    headers: { "User-Agent": UA },
    redirect: "manual",
  });
  const setCookie1 = getRes.headers.get("set-cookie") || "";
  const sessMatch = setCookie1.match(/PHPSESSID=([^;]+)/);
  const sessId = sessMatch ? sessMatch[1] : "";
  if (!sessId) throw new Error("PHPSESSID取得失敗");

  // Step 2: POST login → logined Cookie取得
  const postRes = await fetch(`${HP_BASE}/login.php`, {
    method: "POST",
    headers: {
      "User-Agent": UA,
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: `PHPSESSID=${sessId}`,
    },
    body: `login_id=${encodeURIComponent(loginId)}&login_pass=${encodeURIComponent(loginPass)}`,
    redirect: "manual",
  });
  const setCookie2 = postRes.headers.get("set-cookie") || "";
  const loginedMatch = setCookie2.match(/logined=([^;]+)/);
  const logined = loginedMatch ? loginedMatch[1] : "";
  if (!logined) throw new Error("ログイン失敗（ID/パスワードを確認してください）");

  return `PHPSESSID=${sessId}; logined=${logined}`;
}

// ============================================================
//  週オフセット計算（HPは水曜始まり）
// ============================================================
function calcWeekOffset(dateKey: string): number {
  // dateKey = "20260402" 形式
  const y = parseInt(dateKey.substring(0, 4));
  const m = parseInt(dateKey.substring(4, 6)) - 1;
  const d = parseInt(dateKey.substring(6, 8));
  const target = new Date(y, m, d);
  const now = new Date();

  // 今週の水曜日を求める
  const nowDay = now.getDay(); // 0=日〜6=土
  const wednesdayOffset = nowDay >= 3 ? nowDay - 3 : nowDay + 4;
  const thisWed = new Date(now);
  thisWed.setDate(now.getDate() - wednesdayOffset);
  thisWed.setHours(0, 0, 0, 0);

  const diffDays = Math.floor((target.getTime() - thisWed.getTime()) / (1000 * 60 * 60 * 24));
  const weekOffset = Math.floor(diffDays / 7) + 1;
  return Math.max(1, weekOffset);
}

// ============================================================
//  セラピストID検索
// ============================================================
async function searchTherapistId(
  cookie: string,
  searchName: string
): Promise<{ id: number; foundName: string } | null> {
  const url = `${HP_BASE}/staff/?search_name=${encodeURIComponent(searchName)}&staff_search=${encodeURIComponent("検索")}&p=1`;
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Cookie: cookie },
  });
  const html = await res.text();
  const $ = cheerio.load(html);

  let result: { id: number; foundName: string } | null = null;

  $("table tr").each((_, row) => {
    const text = $(row).text();
    const idMatch = text.match(/ID\s*[:：]\s*(\d+)/);
    const nameMatch = text.match(/名前\s*[:：]\s*([^\s年]+)/);
    if (idMatch && nameMatch) {
      const id = parseInt(idMatch[1]);
      const foundName = nameMatch[1].trim();
      // 完全一致を優先
      if (foundName === searchName) {
        result = { id, foundName };
        return false; // break
      }
      // 最初の結果をフォールバック
      if (!result) {
        result = { id, foundName };
      }
    }
  });

  return result;
}

// ============================================================
//  スケジュール更新
// ============================================================
async function updateSchedule(
  cookie: string,
  therapistId: number,
  dateKey: string, // "20260402"
  startTime: string, // "13:00"
  endTime: string, // "21:00"
  storeName: string // "三河安城ルーム" or "豊橋ルーム"
): Promise<{ success: boolean; message: string }> {
  const weekOffset = calcWeekOffset(dateKey);

  // スケジュールページ取得
  const schUrl = `${HP_BASE}/staff/sch.php?id=${therapistId}&p=1&w=${weekOffset}`;
  const schRes = await fetch(schUrl, {
    headers: { "User-Agent": UA, Cookie: cookie },
  });
  const schHtml = await schRes.text();

  if (schHtml.includes("login.php") || schHtml.includes("ログイン")) {
    return { success: false, message: "セッション切れ" };
  }

  const $ = cheerio.load(schHtml);
  const targetSuffix = `[${dateKey}][${therapistId}]`;

  // ① 全フォームフィールドを収集
  const fields: [string, string][] = [];

  // hidden inputs
  $("input[type='hidden']").each((_, el) => {
    const name = $(el).attr("name") || "";
    const value = $(el).attr("value") || "";
    if (name) fields.push([name, value]);
  });

  // selects
  $("select").each((_, el) => {
    const name = $(el).attr("name") || "";
    if (!name) return;
    const selectedVal = $(el).find("option:selected").attr("value") || $(el).find("option:selected").text() || "";
    fields.push([name, selectedVal]);
  });

  // checkboxes (checked only)
  $("input[type='checkbox']:checked").each((_, el) => {
    const name = $(el).attr("name") || "";
    const value = $(el).attr("value") || "on";
    if (name) fields.push([name, value]);
  });

  // text inputs
  $("input[type='text']").each((_, el) => {
    const name = $(el).attr("name") || "";
    const value = $(el).attr("value") || "";
    if (name) fields.push([name, value]);
  });

  // ② 対象セラピスト・対象日のフィールドを除外
  const filtered = fields.filter(([n]) => {
    if (n.includes(targetSuffix)) return false;
    return true;
  });

  // ③ 新しい時間を追加
  const [sH, sM] = startTime.split(":").map(Number);
  const [eHRaw, eM] = endTime.split(":").map(Number);
  // 深夜帯: HP形式に変換（0:00→24:00, 1:00→25:00, etc.）
  let eH = eHRaw;
  if (eH < 9) eH += 24;

  filtered.push([`going_hour${targetSuffix}`, String(sH)]);
  filtered.push([`going_min${targetSuffix}`, String(sM).padStart(2, "0")]);

  // ④ LAST判定（26:30以降）
  if (eH > 26 || (eH === 26 && eM > 30)) {
    filtered.push([`leave_hour${targetSuffix}`, "26"]);
    filtered.push([`leave_min${targetSuffix}`, "30"]);
    filtered.push([`allow_mode${targetSuffix}[]`, "LAST"]);
  } else {
    filtered.push([`leave_hour${targetSuffix}`, String(eH)]);
    filtered.push([`leave_min${targetSuffix}`, String(eM).padStart(2, "0")]);
  }

  // ⑤ 店舗チェック
  $(`input[name="shop_flg${targetSuffix}[]"]`).each((_, el) => {
    const label = $(el).parent().text().replace(/\s/g, "");
    if (label.includes(storeName)) {
      filtered.push([`shop_flg${targetSuffix}[]`, $(el).attr("value") || ""]);
    }
  });

  // ⑥ お休みは追加しない → 自動的にお休み解除

  // ⑦ POSTで送信
  const postData = new URLSearchParams();
  for (const [k, v] of filtered) {
    postData.append(k, v);
  }

  const postRes = await fetch(schUrl, {
    method: "POST",
    headers: {
      "User-Agent": UA,
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: cookie,
    },
    body: postData.toString(),
    redirect: "manual",
  });

  if (postRes.status >= 200 && postRes.status < 400) {
    return { success: true, message: "更新成功" };
  } else {
    return { success: false, message: `HTTP ${postRes.status}` };
  }
}

// ============================================================
//  店舗マッピング
// ============================================================
function getHpStoreName(buildingName: string): string {
  if (!buildingName) return "三河安城ルーム";
  const lower = buildingName.toLowerCase();
  if (lower.includes("ring") || lower.includes("リング") || lower.includes("豊橋")) return "豊橋ルーム";
  return "三河安城ルーム";
}

// ============================================================
//  POST: HP出力メイン処理
// ============================================================
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action } = body;

    // ----------------------------------------------------------
    //  ログインテスト
    // ----------------------------------------------------------
    if (action === "login_test") {
      const { loginId, loginPass } = body;
      if (!loginId || !loginPass) {
        return NextResponse.json({ error: "ID/パスワードが未入力です" }, { status: 400 });
      }
      const cookie = await hpLogin(loginId, loginPass);
      return NextResponse.json({ success: true, cookie });
    }

    // ----------------------------------------------------------
    //  セラピストID検索
    // ----------------------------------------------------------
    if (action === "search_therapist") {
      const { cookie, searchName } = body;
      if (!cookie || !searchName) {
        return NextResponse.json({ error: "パラメータ不足" }, { status: 400 });
      }
      const result = await searchTherapistId(cookie, searchName);
      if (result) {
        return NextResponse.json({ success: true, ...result });
      }
      return NextResponse.json({ success: false, message: `「${searchName}」がHPに見つかりません` });
    }

    // ----------------------------------------------------------
    //  スケジュール更新（単一）
    // ----------------------------------------------------------
    if (action === "update_schedule") {
      const { cookie, therapistId, dateKey, startTime, endTime, buildingName } = body;
      if (!cookie || !therapistId || !dateKey || !startTime || !endTime) {
        return NextResponse.json({ error: "パラメータ不足" }, { status: 400 });
      }
      const storeName = getHpStoreName(buildingName || "");
      const result = await updateSchedule(cookie, therapistId, dateKey, startTime, endTime, storeName);
      return NextResponse.json(result);
    }

    // ----------------------------------------------------------
    //  一括更新
    // ----------------------------------------------------------
    if (action === "bulk_update") {
      const { loginId, loginPass, assignments, hpNameMap } = body;
      // assignments: [{therapistName, date, startTime, endTime, buildingName}]
      // hpNameMap: {smanageName: hpName}

      const cookie = await hpLogin(loginId, loginPass);
      const results: { therapistName: string; date: string; status: string; message: string }[] = [];
      const idCache = new Map<string, number>();

      for (const a of assignments) {
        try {
          const searchName = hpNameMap?.[a.therapistName] || a.therapistName;

          // IDキャッシュ
          let hpId = idCache.get(searchName);
          if (!hpId) {
            const found = await searchTherapistId(cookie, searchName);
            if (!found) {
              results.push({ therapistName: a.therapistName, date: a.date, status: "error", message: `HP未検出(${searchName})` });
              continue;
            }
            hpId = found.id;
            idCache.set(searchName, hpId);
          }

          // dateをdateKey形式に変換: "2026-04-02" → "20260402"
          const dateKey = a.date.replace(/-/g, "");
          const storeName = getHpStoreName(a.buildingName || "");
          const result = await updateSchedule(cookie, hpId, dateKey, a.startTime, a.endTime, storeName);
          results.push({
            therapistName: a.therapistName,
            date: a.date,
            status: result.success ? "success" : "error",
            message: result.message,
          });
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "不明なエラー";
          results.push({ therapistName: a.therapistName, date: a.date, status: "error", message: msg });
        }
      }

      return NextResponse.json({ success: true, results });
    }

    return NextResponse.json({ error: "不明なアクション" }, { status: 400 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "HP連携エラー";
    console.error("HP update error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
