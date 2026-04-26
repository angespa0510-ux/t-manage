/**
 * Google Analytics 4 Data API クライアント
 *
 * サービスアカウント認証で GA4 のデータを取得する。
 *
 * ========== Vercel 環境変数 ==========
 *
 *   GA4_PROPERTY_ID                  GA4プロパティID（数字のみ、例: 14589300799）
 *   GA4_SERVICE_ACCOUNT_EMAIL        サービスアカウントのメール
 *   GA4_SERVICE_ACCOUNT_PRIVATE_KEY  秘密鍵（JSON内の "private_key"、改行を \n のままで）
 *
 * ========== 認証フロー ==========
 *
 * 1. 秘密鍵で JWT を作成
 * 2. JWT で OAuth トークン取得
 * 3. トークンで Analytics Data API を呼び出し
 *
 * Google公式SDKを使わず素のfetchで実装（Vercel Edge Runtime互換）。
 *
 * @see https://developers.google.com/analytics/devguides/reporting/data/v1
 */

import * as crypto from "crypto";

// ───────── 型定義 ─────────

export type Ga4Summary = {
  date: string;                              // 対象日（YYYY-MM-DD）
  totalUsers: number;
  newUsers: number;
  sessions: number;
  pageViews: number;
  averageSessionDuration: number;            // 秒
  bounceRate: number;                        // 0.0〜1.0
  topPages: { path: string; views: number }[];
  topReferrers: { source: string; users: number }[];
  trafficByChannel: { channel: string; users: number }[];
  deviceBreakdown: { device: string; users: number }[];
};

// ───────── JWT トークン取得 ─────────

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  // キャッシュ確認（10分キャッシュ）
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.token;
  }

  const email = process.env.GA4_SERVICE_ACCOUNT_EMAIL;
  const privateKeyRaw = process.env.GA4_SERVICE_ACCOUNT_PRIVATE_KEY;
  if (!email || !privateKeyRaw) {
    throw new Error("GA4 サービスアカウント認証情報が未設定（GA4_SERVICE_ACCOUNT_EMAIL / PRIVATE_KEY）");
  }

  // 改行を実際の改行に変換（環境変数の \n 表記対応）
  const privateKey = privateKeyRaw.replace(/\\n/g, "\n");

  // JWT ヘッダー
  const header = { alg: "RS256", typ: "JWT" };
  const headerB64 = Buffer.from(JSON.stringify(header)).toString("base64url");

  // JWT クレーム
  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: email,
    scope: "https://www.googleapis.com/auth/analytics.readonly",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };
  const claimB64 = Buffer.from(JSON.stringify(claim)).toString("base64url");

  // 署名
  const signInput = `${headerB64}.${claimB64}`;
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(signInput);
  signer.end();
  const signature = signer.sign(privateKey).toString("base64url");
  const jwt = `${signInput}.${signature}`;

  // OAuth トークン取得
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GA4 OAuthトークン取得失敗: ${res.status} ${text}`);
  }

  const data = await res.json();
  const token = data.access_token as string;
  cachedToken = { token, expiresAt: Date.now() + 50 * 60 * 1000 }; // 50分キャッシュ
  return token;
}

// ───────── runReport API 呼び出し ─────────

async function runReport(propertyId: string, body: Record<string, unknown>): Promise<{ rows?: { dimensionValues?: { value: string }[]; metricValues?: { value: string }[] }[] }> {
  const token = await getAccessToken();
  const url = `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GA4 runReport 失敗: ${res.status} ${text}`);
  }

  return res.json();
}

// ───────── 公開関数: 1日分のサマリー取得 ─────────

/**
 * 指定日の GA4 サマリーを取得
 *
 * @param date YYYY-MM-DD 形式（昨日の日付を渡すのが基本）
 */
export async function fetchGa4Summary(date: string): Promise<Ga4Summary> {
  const propertyId = process.env.GA4_PROPERTY_ID;
  if (!propertyId) {
    throw new Error("GA4_PROPERTY_ID が未設定");
  }

  const dateRange = { startDate: date, endDate: date };

  // ── 並行で複数レポートを取得 ──
  const [
    overview,
    topPages,
    topReferrers,
    trafficByChannel,
    deviceBreakdown,
  ] = await Promise.all([
    // 全体サマリー
    runReport(propertyId, {
      dateRanges: [dateRange],
      metrics: [
        { name: "totalUsers" },
        { name: "newUsers" },
        { name: "sessions" },
        { name: "screenPageViews" },
        { name: "averageSessionDuration" },
        { name: "bounceRate" },
      ],
    }),
    // 人気ページTOP10
    runReport(propertyId, {
      dateRanges: [dateRange],
      dimensions: [{ name: "pagePath" }],
      metrics: [{ name: "screenPageViews" }],
      orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
      limit: 10,
    }),
    // 流入元TOP10
    runReport(propertyId, {
      dateRanges: [dateRange],
      dimensions: [{ name: "sessionSource" }],
      metrics: [{ name: "totalUsers" }],
      orderBys: [{ metric: { metricName: "totalUsers" }, desc: true }],
      limit: 10,
    }),
    // チャネル別
    runReport(propertyId, {
      dateRanges: [dateRange],
      dimensions: [{ name: "sessionDefaultChannelGroup" }],
      metrics: [{ name: "totalUsers" }],
      orderBys: [{ metric: { metricName: "totalUsers" }, desc: true }],
    }),
    // デバイス別
    runReport(propertyId, {
      dateRanges: [dateRange],
      dimensions: [{ name: "deviceCategory" }],
      metrics: [{ name: "totalUsers" }],
    }),
  ]);

  // ── パース ──
  const overviewRow = overview.rows?.[0]?.metricValues || [];
  const num = (i: number) => Number(overviewRow[i]?.value ?? 0);

  return {
    date,
    totalUsers: num(0),
    newUsers: num(1),
    sessions: num(2),
    pageViews: num(3),
    averageSessionDuration: num(4),
    bounceRate: num(5),
    topPages: (topPages.rows || []).map((r) => ({
      path: r.dimensionValues?.[0]?.value ?? "",
      views: Number(r.metricValues?.[0]?.value ?? 0),
    })),
    topReferrers: (topReferrers.rows || []).map((r) => ({
      source: r.dimensionValues?.[0]?.value ?? "",
      users: Number(r.metricValues?.[0]?.value ?? 0),
    })),
    trafficByChannel: (trafficByChannel.rows || []).map((r) => ({
      channel: r.dimensionValues?.[0]?.value ?? "",
      users: Number(r.metricValues?.[0]?.value ?? 0),
    })),
    deviceBreakdown: (deviceBreakdown.rows || []).map((r) => ({
      device: r.dimensionValues?.[0]?.value ?? "",
      users: Number(r.metricValues?.[0]?.value ?? 0),
    })),
  };
}
