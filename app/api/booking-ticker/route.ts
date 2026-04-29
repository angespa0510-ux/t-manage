import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * ═══════════════════════════════════════════════════════════
 * Booking Ticker API（公開HP のライブ予約状況ティッカー用）
 *
 * GET /api/booking-ticker
 *
 * 仕様:
 *   - 直近 24 時間（前日 + 当日）の予約から取得
 *   - status='cancelled' は除外
 *   - 同一セラピストは「直近の 1 件」のみ採用（人気者の連続表示を回避）
 *   - HP 非公開（is_public=false）・退店済み（deleted_at）セラピストの源氏名は除外
 *   - 顧客名は頭文字のみに匿名化（「田 様」「S 様」など）
 *   - 最大 12 件
 *
 * ティッカー表示の variant:
 *   - 'reserved'  予約が入った状態
 *   - 'serving'   現在接客中（customer_status / therapist_status='serving'）
 * ═══════════════════════════════════════════════════════════
 */

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://cbewozzdyjqmhzkxsjqo.supabase.co";
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "";
const supabase = createClient(supabaseUrl, supabaseKey);

type TickerItem = {
  id: number;
  time: string;
  customerInitial: string;
  course: string;
  therapistName: string;
  isNomination: boolean;
  variant: "reserved" | "serving";
};

export const revalidate = 0;

export async function GET() {
  try {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const todayStr = today.toISOString().slice(0, 10);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);

    const { data, error } = await supabase
      .from("reservations")
      .select(
        `
          id,
          customer_name,
          start_time,
          course,
          nomination_fee,
          status,
          customer_status,
          therapist_status,
          date,
          therapist_id,
          therapists ( name, is_public, deleted_at )
        `
      )
      .in("date", [yesterdayStr, todayStr])
      .neq("status", "cancelled")
      .order("date", { ascending: false })
      .order("start_time", { ascending: false })
      .limit(80);

    if (error || !data) {
      return NextResponse.json({ items: [] });
    }

    const seen = new Set<number>();
    const items: TickerItem[] = [];

    for (const r of data as unknown as Array<{
      id: number;
      customer_name: string | null;
      start_time: string | null;
      course: string | null;
      nomination_fee: number | null;
      status: string | null;
      customer_status: string | null;
      therapist_status: string | null;
      date: string;
      therapist_id: number | null;
      therapists:
        | { name: string | null; is_public: boolean | null; deleted_at: string | null }
        | { name: string | null; is_public: boolean | null; deleted_at: string | null }[]
        | null;
    }>) {
      if (!r.therapist_id || seen.has(r.therapist_id)) continue;

      // therapists は単数形 join なので object のはずだが、型ゆれに備えて両対応
      const t = Array.isArray(r.therapists) ? r.therapists[0] : r.therapists;
      if (!t) continue;
      if (t.is_public === false || t.deleted_at) continue;

      const therapistName = (t.name ?? "").trim();
      if (!therapistName) continue;

      const isServing =
        r.customer_status === "serving" || r.therapist_status === "serving";

      items.push({
        id: r.id,
        time: (r.start_time ?? "").slice(0, 5),
        customerInitial: getInitial(r.customer_name ?? ""),
        course: (r.course ?? "").trim(),
        therapistName,
        isNomination: Boolean(r.nomination_fee && r.nomination_fee > 0),
        variant: isServing ? "serving" : "reserved",
      });

      seen.add(r.therapist_id);
      if (items.length >= 12) break;
    }

    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ items: [] });
  }
}

/**
 * 顧客名 → 頭文字 1 文字（匿名化）
 *   - 漢字/ひらがな/カタカナ: 先頭 1 文字をそのまま
 *   - 英字: 大文字化
 *   - 空: 'A'
 */
function getInitial(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "A";
  const first = Array.from(trimmed)[0];
  if (/[a-zA-Z]/.test(first)) return first.toUpperCase();
  return first;
}
