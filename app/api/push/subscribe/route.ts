import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

type SubscribeBody = {
  action: "subscribe" | "unsubscribe";
  userType: "customer" | "therapist" | "staff";
  userId: number;
  subscription?: {
    endpoint: string;
    keys: { p256dh: string; auth: string };
  };
  endpoint?: string;       // unsubscribe 時のみ使用
  deviceInfo?: string;
};

// プッシュ通知の登録・解除
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as SubscribeBody;

    if (!body.action || !body.userType || !body.userId) {
      return NextResponse.json(
        { error: "action, userType, userId are required" },
        { status: 400 }
      );
    }

    // 登録
    if (body.action === "subscribe") {
      if (!body.subscription?.endpoint || !body.subscription?.keys) {
        return NextResponse.json(
          { error: "subscription.endpoint and keys required" },
          { status: 400 }
        );
      }

      const row = {
        user_type: body.userType,
        user_id: body.userId,
        endpoint: body.subscription.endpoint,
        p256dh: body.subscription.keys.p256dh,
        auth: body.subscription.keys.auth,
        device_info: body.deviceInfo || "",
        is_active: true,
        last_used_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // upsert: 同じ(user_type, user_id, endpoint)があれば上書き
      const { data, error } = await supabase
        .from("push_subscriptions")
        .upsert(row, { onConflict: "user_type,user_id,endpoint" })
        .select()
        .single();

      if (error) {
        console.error("[push/subscribe] upsert error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true, id: data.id });
    }

    // 解除
    if (body.action === "unsubscribe") {
      const endpoint = body.endpoint || body.subscription?.endpoint;
      if (!endpoint) {
        return NextResponse.json(
          { error: "endpoint required for unsubscribe" },
          { status: 400 }
        );
      }

      const { error } = await supabase
        .from("push_subscriptions")
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq("user_type", body.userType)
        .eq("user_id", body.userId)
        .eq("endpoint", endpoint);

      if (error) {
        console.error("[push/subscribe] unsubscribe error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "invalid action" }, { status: 400 });
  } catch (e: unknown) {
    const err = e as { message?: string };
    console.error("[push/subscribe] exception:", err);
    return NextResponse.json({ error: err.message || "server error" }, { status: 500 });
  }
}

// 自分の登録状況を確認 (optional)
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userType = searchParams.get("userType");
    const userId = searchParams.get("userId");

    if (!userType || !userId) {
      return NextResponse.json({ error: "userType, userId required" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, device_info, created_at, last_used_at")
      .eq("user_type", userType)
      .eq("user_id", parseInt(userId))
      .eq("is_active", true);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ subscriptions: data || [] });
  } catch (e: unknown) {
    const err = e as { message?: string };
    return NextResponse.json({ error: err.message || "server error" }, { status: 500 });
  }
}
