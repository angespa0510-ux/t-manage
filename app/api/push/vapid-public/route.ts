import { NextResponse } from "next/server";

// クライアント（ブラウザ）にVAPID公開鍵を配布する
// 秘密鍵は絶対にクライアントに渡さない
export async function GET() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY;
  if (!publicKey) {
    return NextResponse.json(
      { error: "VAPID public key not configured" },
      { status: 500 }
    );
  }
  return NextResponse.json({ publicKey });
}
