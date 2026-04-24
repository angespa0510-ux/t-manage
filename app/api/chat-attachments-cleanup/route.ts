import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * ═══════════════════════════════════════════════════════════
 * /api/chat-attachments-cleanup
 *
 * 週1回（日曜深夜 Cron）で実行される、期限切れ添付ファイルの削除バッチ。
 *
 * 処理:
 *   1. chat_attachments から expires_at <= NOW() && deleted_at IS NULL を取得
 *   2. Supabase Storage から該当ファイルを削除
 *   3. chat_attachments.deleted_at を更新
 *
 * セキュリティ: Vercel Cron の Bearer Token 認証
 * 手動実行も可能（管理画面から）
 * ═══════════════════════════════════════════════════════════
 */

const CRON_SECRET = process.env.CRON_SECRET || "";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export async function GET(request: NextRequest) {
  return handle(request, "cron");
}

export async function POST(request: NextRequest) {
  return handle(request, "manual");
}

async function handle(request: NextRequest, triggeredBy: string) {
  const auth = request.headers.get("authorization") || "";
  if (triggeredBy === "cron" && (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return NextResponse.json({ error: "Supabase credentials missing" }, { status: 500 });
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const nowIso = new Date().toISOString();

  // 期限切れ対象を取得
  const { data: targets, error: fetchErr } = await sb
    .from("chat_attachments")
    .select("id, storage_path, file_size")
    .lte("expires_at", nowIso)
    .is("deleted_at", null)
    .limit(500);

  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }

  if (!targets || targets.length === 0) {
    return NextResponse.json({
      status: "success",
      deleted_count: 0,
      message: "削除対象なし",
    });
  }

  // Storage から削除（最大100件ずつバッチ処理）
  const paths = targets.map((t) => t.storage_path);
  const batchSize = 100;
  const failures: string[] = [];
  let totalDeleted = 0;
  let totalSizeFreed = 0;

  for (let i = 0; i < paths.length; i += batchSize) {
    const batch = paths.slice(i, i + batchSize);
    const { error: rmErr } = await sb.storage.from("chat-attachments").remove(batch);
    if (rmErr) {
      failures.push(`batch ${i}: ${rmErr.message}`);
      continue;
    }
    totalDeleted += batch.length;
  }

  // DB 側を deleted_at で更新
  const succeededIds = targets
    .filter((t, idx) => !failures.some((f) => f.includes(`batch ${Math.floor(idx / batchSize) * batchSize}`)))
    .map((t) => t.id);

  if (succeededIds.length > 0) {
    await sb
      .from("chat_attachments")
      .update({ deleted_at: nowIso })
      .in("id", succeededIds);
    totalSizeFreed = targets
      .filter((t) => succeededIds.includes(t.id))
      .reduce((sum, t) => sum + (t.file_size || 0), 0);
  }

  return NextResponse.json({
    status: failures.length > 0 ? "partial" : "success",
    total_targets: targets.length,
    deleted_count: totalDeleted,
    size_freed_mb: Math.round((totalSizeFreed / 1024 / 1024) * 100) / 100,
    failures: failures.length > 0 ? failures : undefined,
  });
}
