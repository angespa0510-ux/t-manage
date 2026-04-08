import { NextResponse } from "next/server";

const SCOPES = "https://www.googleapis.com/auth/contacts";

// GET: OAuth認証URL生成
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get("client_id");
  const redirectUri = searchParams.get("redirect_uri");

  if (!clientId || !redirectUri) {
    return NextResponse.json({ error: "client_id and redirect_uri required" }, { status: 400 });
  }

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${encodeURIComponent(clientId)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=code` +
    `&scope=${encodeURIComponent(SCOPES)}` +
    `&access_type=offline` +
    `&prompt=consent`;

  return NextResponse.json({ authUrl });
}

// POST: 認証コード→トークン交換 / トークンリフレッシュ
export async function POST(req: Request) {
  const body = await req.json();
  const { action, clientId, clientSecret, code, redirectUri, refreshToken } = body;

  if (action === "exchange") {
    // 認証コード→アクセストークン+リフレッシュトークン
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });
    const data = await res.json();
    if (data.error) {
      return NextResponse.json({ error: data.error_description || data.error }, { status: 400 });
    }
    return NextResponse.json({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_in: data.expires_in,
    });
  }

  if (action === "refresh") {
    // リフレッシュトークン→新しいアクセストークン
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "refresh_token",
      }),
    });
    const data = await res.json();
    if (data.error) {
      return NextResponse.json({ error: data.error_description || data.error }, { status: 400 });
    }
    return NextResponse.json({
      access_token: data.access_token,
      expires_in: data.expires_in,
    });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
