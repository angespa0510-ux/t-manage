import { NextResponse } from "next/server";

// OAuth2コールバック — 認証コードを受け取ってフロントへリダイレクト
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(new URL(`/contact-sync?error=${encodeURIComponent(error)}`, req.url));
  }

  if (!code) {
    return NextResponse.redirect(new URL("/contact-sync?error=no_code", req.url));
  }

  // 認証コードをフロントに渡す（フロント側でトークン交換）
  return NextResponse.redirect(new URL(`/contact-sync?code=${encodeURIComponent(code)}`, req.url));
}
