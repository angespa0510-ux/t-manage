import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// VAPID 設定 (プッシュ通知送信の署名用)
const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:info@terrace-life.co.jp";

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
}

type SendRequest = {
  // 送信先の指定方法（いずれか）
  userType?: "customer" | "therapist" | "staff";
  userId?: number;                // 単一ユーザー
  userIds?: number[];             // 複数ユーザー
  broadcast?: boolean;            // 全員
  // 通知内容
  title: string;
  body: string;
  url?: string;                   // クリック時の遷移先
  icon?: string;
  tag?: string;
  requireInteraction?: boolean;
  actions?: { action: string; title: string }[];
};

type PushSubscription = {
  id: number;
  user_type: string;
  user_id: number;
  endpoint: string;
  p256dh: string;
  auth: string;
};

type WebPushError = {
  statusCode?: number;
  message?: string;
};

// 通知送信
export async function POST(req: Request) {
  try {
    if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
      return NextResponse.json(
        { error: "VAPID keys not configured. Set NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY." },
        { status: 500 }
      );
    }

    const body = (await req.json()) as SendRequest;
    if (!body.title) {
      return NextResponse.json({ error: "title required" }, { status: 400 });
    }

    // 送信対象のサブスクリプションを取得
    let query = supabase.from("push_subscriptions").select("*").eq("is_active", true);

    if (body.broadcast) {
      if (body.userType) query = query.eq("user_type", body.userType);
    } else if (body.userId) {
      if (!body.userType) {
        return NextResponse.json({ error: "userType required with userId" }, { status: 400 });
      }
      query = query.eq("user_type", body.userType).eq("user_id", body.userId);
    } else if (body.userIds && body.userIds.length > 0) {
      if (!body.userType) {
        return NextResponse.json({ error: "userType required with userIds" }, { status: 400 });
      }
      query = query.eq("user_type", body.userType).in("user_id", body.userIds);
    } else {
      return NextResponse.json(
        { error: "Specify userId, userIds or broadcast=true" },
        { status: 400 }
      );
    }

    const { data: subs, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!subs || subs.length === 0) {
      return NextResponse.json({ success: true, sent: 0, failed: 0, note: "No subscribers" });
    }

    // ペイロード (Service Worker の 'push' イベントで受け取る内容)
    const payload = JSON.stringify({
      title: body.title,
      body: body.body || "",
      url: body.url || "/",
      icon: body.icon || "/icons/icon-192.png",
      tag: body.tag,
      requireInteraction: body.requireInteraction,
      actions: body.actions,
    });

    // 並列送信 + ログ記録
    let sent = 0;
    let failed = 0;
    const deadEndpoints: number[] = [];
    const logEntries: Record<string, unknown>[] = [];

    await Promise.all(
      (subs as PushSubscription[]).map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            payload
          );
          sent++;
          logEntries.push({
            subscription_id: sub.id,
            user_type: sub.user_type,
            user_id: sub.user_id,
            title: body.title,
            body: body.body || "",
            url: body.url || "/",
            status: "sent",
          });
        } catch (err: unknown) {
          failed++;
          const e = err as WebPushError;
          // 410 Gone / 404 Not Found: エンドポイント失効
          if (e.statusCode === 410 || e.statusCode === 404) {
            deadEndpoints.push(sub.id);
          }
          logEntries.push({
            subscription_id: sub.id,
            user_type: sub.user_type,
            user_id: sub.user_id,
            title: body.title,
            body: body.body || "",
            url: body.url || "/",
            status: e.statusCode === 410 || e.statusCode === 404 ? "expired" : "failed",
            error_message: `${e.statusCode || ""} ${e.message || ""}`.trim(),
          });
        }
      })
    );

    // 失効したサブスクリプションは is_active=false に
    if (deadEndpoints.length > 0) {
      await supabase
        .from("push_subscriptions")
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .in("id", deadEndpoints);
    }

    // 送信ログを一括insert (失敗しても本体処理には影響させない)
    if (logEntries.length > 0) {
      const { error: logErr } = await supabase.from("push_send_logs").insert(logEntries);
      if (logErr) console.error("[push/send] log insert error:", logErr);
    }

    // last_used_at 更新 (成功分のみ)
    const successIds = (subs as PushSubscription[])
      .filter((_, i) => !deadEndpoints.includes((subs as PushSubscription[])[i].id))
      .map((s) => s.id);
    if (successIds.length > 0) {
      await supabase
        .from("push_subscriptions")
        .update({ last_used_at: new Date().toISOString() })
        .in("id", successIds);
    }

    return NextResponse.json({
      success: true,
      sent,
      failed,
      expired: deadEndpoints.length,
      total: subs.length,
    });
  } catch (e: unknown) {
    const err = e as { message?: string };
    console.error("[push/send] exception:", err);
    return NextResponse.json({ error: err.message || "server error" }, { status: 500 });
  }
}
