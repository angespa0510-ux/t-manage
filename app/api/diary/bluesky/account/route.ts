import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSession } from "../../../../../lib/bluesky-client";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://cbewozzdyjqmhzkxsjqo.supabase.co";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Bluesky アカウント設定
 *
 * GET ?therapistId=xx&authToken=xx (セラピスト本人) | ?therapistId=xx&staffId=xx (スタッフ代行)
 *   現在の接続状況を取得
 *
 * POST { therapistId, handle, appPassword, authToken? or staffId?, autoPostEnabled? includeImage? }
 *   接続テスト + 保存
 *
 * PATCH { therapistId, autoPostEnabled? includeImage? dailyPostLimit? authToken? staffId? }
 *   設定変更 (パスワードは触らない)
 *
 * DELETE { therapistId, authToken? staffId? }
 *   接続解除 (DBから削除)
 */

async function verifyTherapist(therapistId: number, authToken: string): Promise<boolean> {
  const { data } = await supabase
    .from("therapists")
    .select("id, login_password, status")
    .eq("id", therapistId)
    .maybeSingle();
  return !!data && data.login_password === authToken && data.status === "active";
}

async function verifyStaff(staffId: number): Promise<boolean> {
  const { data } = await supabase
    .from("staff")
    .select("id, role, status")
    .eq("id", staffId)
    .maybeSingle();
  return !!data && data.status === "active" && ["owner", "manager", "leader"].includes(data.role);
}

async function authorize(
  therapistId: number,
  authToken?: string,
  staffId?: number
): Promise<{ ok: boolean; setupBy: "self" | "staff"; staffId: number | null }> {
  if (staffId) {
    const ok = await verifyStaff(staffId);
    return { ok, setupBy: "staff", staffId };
  }
  if (authToken) {
    const ok = await verifyTherapist(therapistId, authToken);
    return { ok, setupBy: "self", staffId: null };
  }
  return { ok: false, setupBy: "self", staffId: null };
}

// ════════════════════════════════════════════════════════════
// GET: 現在の接続状況取得
// ════════════════════════════════════════════════════════════
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const therapistIdStr = url.searchParams.get("therapistId");
    const authToken = url.searchParams.get("authToken");
    const staffIdStr = url.searchParams.get("staffId");

    if (!therapistIdStr) {
      return NextResponse.json({ error: "therapistId が必要です" }, { status: 400 });
    }
    const therapistId = parseInt(therapistIdStr);
    const staffId = staffIdStr ? parseInt(staffIdStr) : undefined;

    const auth = await authorize(therapistId, authToken || undefined, staffId);
    if (!auth.ok) {
      return NextResponse.json({ error: "認証エラー" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("therapist_bluesky_accounts")
      .select(
        "handle, did, active, auto_post_enabled, include_image, daily_post_limit, post_count_today, last_count_reset_date, last_posted_at, setup_by, last_test_status, last_test_at, last_error"
      )
      .eq("therapist_id", therapistId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ connected: false });
    }

    return NextResponse.json({
      connected: true,
      account: {
        handle: data.handle,
        did: data.did,
        active: data.active,
        autoPostEnabled: data.auto_post_enabled,
        includeImage: data.include_image,
        dailyPostLimit: data.daily_post_limit,
        postCountToday: data.post_count_today,
        lastCountResetDate: data.last_count_reset_date,
        lastPostedAt: data.last_posted_at,
        setupBy: data.setup_by,
        lastTestStatus: data.last_test_status,
        lastTestAt: data.last_test_at,
        lastError: data.last_error,
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "不明なエラー";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ════════════════════════════════════════════════════════════
// POST: 接続テスト + 保存
// ════════════════════════════════════════════════════════════
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      therapistId,
      handle,
      appPassword,
      authToken,
      staffId,
      autoPostEnabled = true,
      includeImage = true,
    } = body;

    if (!therapistId || !handle || !appPassword) {
      return NextResponse.json({ error: "therapistId / handle / appPassword が必要です" }, { status: 400 });
    }

    const auth = await authorize(therapistId, authToken, staffId);
    if (!auth.ok) {
      return NextResponse.json({ error: "認証エラー" }, { status: 401 });
    }

    // Blueskyに実際にログインしてみて検証
    let session;
    try {
      session = await createSession(handle, appPassword);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Bluesky認証エラー";
      return NextResponse.json({
        error: `Blueskyへの接続に失敗しました: ${msg}`,
        hint: "ハンドル(例: yume.bsky.social) と App Password(例: xxxx-xxxx-xxxx-xxxx) を確認してください。App PasswordはBlueskyアプリの「設定 → 高度な設定 → アプリパスワード」で発行できます。",
      }, { status: 400 });
    }

    // 保存 (UPSERT)
    const { error: upsertErr } = await supabase
      .from("therapist_bluesky_accounts")
      .upsert(
        {
          therapist_id: therapistId,
          handle: session.handle, // 正規化された handle
          app_password: appPassword,
          did: session.did,
          active: true,
          auto_post_enabled: autoPostEnabled,
          include_image: includeImage,
          setup_by: auth.setupBy,
          setup_by_staff_id: auth.staffId,
          last_test_status: "success",
          last_test_at: new Date().toISOString(),
          last_error: null,
        },
        { onConflict: "therapist_id" }
      );

    if (upsertErr) {
      return NextResponse.json({ error: upsertErr.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      handle: session.handle,
      did: session.did,
      message: "Blueskyアカウントを連携しました",
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "不明なエラー";
    console.error("/api/diary/bluesky/account POST error:", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ════════════════════════════════════════════════════════════
// PATCH: 設定変更 (パスワードは触らない)
// ════════════════════════════════════════════════════════════
export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { therapistId, authToken, staffId, autoPostEnabled, includeImage, dailyPostLimit, active } = body;

    if (!therapistId) {
      return NextResponse.json({ error: "therapistId が必要です" }, { status: 400 });
    }

    const auth = await authorize(therapistId, authToken, staffId);
    if (!auth.ok) {
      return NextResponse.json({ error: "認証エラー" }, { status: 401 });
    }

    const updates: Record<string, unknown> = {};
    if (typeof autoPostEnabled === "boolean") updates.auto_post_enabled = autoPostEnabled;
    if (typeof includeImage === "boolean") updates.include_image = includeImage;
    if (typeof active === "boolean") updates.active = active;
    if (typeof dailyPostLimit === "number" && dailyPostLimit >= 1 && dailyPostLimit <= 20) {
      updates.daily_post_limit = dailyPostLimit;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "更新項目がありません" }, { status: 400 });
    }

    const { error } = await supabase
      .from("therapist_bluesky_accounts")
      .update(updates)
      .eq("therapist_id", therapistId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "不明なエラー";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ════════════════════════════════════════════════════════════
// DELETE: 接続解除
// ════════════════════════════════════════════════════════════
export async function DELETE(req: Request) {
  try {
    const body = await req.json();
    const { therapistId, authToken, staffId } = body;

    if (!therapistId) {
      return NextResponse.json({ error: "therapistId が必要です" }, { status: 400 });
    }

    const auth = await authorize(therapistId, authToken, staffId);
    if (!auth.ok) {
      return NextResponse.json({ error: "認証エラー" }, { status: 401 });
    }

    await supabase
      .from("therapist_bluesky_accounts")
      .delete()
      .eq("therapist_id", therapistId);

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "不明なエラー";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
