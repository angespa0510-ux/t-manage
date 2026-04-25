import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://cbewozzdyjqmhzkxsjqo.supabase.co";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * スタッフ認証
 */
async function verifyStaff(staffId: number): Promise<boolean> {
  if (!staffId) return false;
  const { data } = await supabase
    .from("staff")
    .select("id, role, status")
    .eq("id", staffId)
    .maybeSingle();
  if (!data) return false;
  if (data.status !== "active") return false;
  return ["owner", "manager", "leader"].includes(data.role);
}

/**
 * メアド形式バリデーション (簡易)
 */
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * POST: 新規登録 or 更新 (upsert)
 */
export async function POST(req: Request) {
  try {
    const { staffId, therapistId, ekichikaEmail, isActive, note } = await req.json();

    if (!(await verifyStaff(staffId))) {
      return NextResponse.json({ error: "権限がありません" }, { status: 403 });
    }
    if (!therapistId) {
      return NextResponse.json({ error: "therapistIdが必要です" }, { status: 400 });
    }
    if (!ekichikaEmail || !isValidEmail(ekichikaEmail)) {
      return NextResponse.json({ error: "メールアドレスの形式が正しくありません" }, { status: 400 });
    }

    // 既存があれば update, なければ insert
    const { data: existing } = await supabase
      .from("ekichika_post_settings")
      .select("id")
      .eq("therapist_id", therapistId)
      .maybeSingle();

    const now = new Date().toISOString();
    if (existing) {
      const { error } = await supabase
        .from("ekichika_post_settings")
        .update({
          ekichika_email: ekichikaEmail.trim(),
          is_active: isActive !== false,
          note: note || null,
          updated_at: now,
        })
        .eq("id", existing.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true, action: "updated", id: existing.id });
    } else {
      const { data, error } = await supabase
        .from("ekichika_post_settings")
        .insert({
          therapist_id: therapistId,
          ekichika_email: ekichikaEmail.trim(),
          is_active: isActive !== false,
          note: note || null,
        })
        .select("id")
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true, action: "created", id: data?.id });
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "不明なエラー";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * DELETE: 削除
 */
export async function DELETE(req: Request) {
  try {
    const { staffId, therapistId } = await req.json();

    if (!(await verifyStaff(staffId))) {
      return NextResponse.json({ error: "権限がありません" }, { status: 403 });
    }
    if (!therapistId) {
      return NextResponse.json({ error: "therapistIdが必要です" }, { status: 400 });
    }

    const { error } = await supabase
      .from("ekichika_post_settings")
      .delete()
      .eq("therapist_id", therapistId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "不明なエラー";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
