"use client";
import { supabase } from "./supabase";

// ======================================================================
// スタッフ前借り 共通ロジック
// ======================================================================

export type StaffAdvance = {
  id: number;
  staff_id: number;
  advance_date: string;
  amount: number;
  reason: string;
  status: "pending" | "settled" | "skipped";
  settled_month: string | null;
  settled_at: string | null;
  settled_expense_id: number | null;
  recorded_by_name: string;
  created_at: string;
};

// 「前借り対象」の判定
// staff.advance_preset_amount が NULL/0 の場合は対象外
export function isAdvanceEligible(staff: { advance_preset_amount?: number | null }): boolean {
  return !!(staff.advance_preset_amount && staff.advance_preset_amount > 0);
}

// ======================================================================
// 月末自動精算ロジック
// ======================================================================
// 毎月「第1月曜12:00」以降に初めてアクセスした時に実行される
// 前月分の pending を settled に変更し、同時に expenses へ外注費として計上
// ======================================================================

// 「前月末を過ぎ、かつ今月の第1月曜12:00 以降か？」判定
// 対象月 = 前月 (例: 5/20 に実行 → 4月分を精算)
export function getTargetSettlementMonth(now: Date = new Date()): string | null {
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-based
  // 今月の第1月曜を計算
  const firstOfMonth = new Date(year, month, 1);
  const firstDay = firstOfMonth.getDay(); // 0=Sun, 1=Mon, ...
  const daysUntilMonday = firstDay === 0 ? 1 : (firstDay === 1 ? 0 : 8 - firstDay);
  const firstMonday = new Date(year, month, 1 + daysUntilMonday, 12, 0, 0);

  if (now < firstMonday) return null; // まだ第1月曜12時前

  // 前月の YYYY-MM を返す
  const targetYear = month === 0 ? year - 1 : year;
  const targetMonth = month === 0 ? 12 : month;
  return `${targetYear}-${String(targetMonth).padStart(2, "0")}`;
}

// グローバルに一度だけ実行するためのガード (タブリロードで再実行はする)
let autoSettlementChecked = false;

// 月末自動精算を実行 (冪等: 既に settled のものは再処理しない)
export async function runAutoSettlementIfDue(): Promise<{ settled: number; month: string | null }> {
  if (autoSettlementChecked) return { settled: 0, month: null };
  autoSettlementChecked = true;

  const targetMonth = getTargetSettlementMonth();
  if (!targetMonth) return { settled: 0, month: null };

  // 対象月の初日〜末日
  const [yStr, mStr] = targetMonth.split("-");
  const y = parseInt(yStr, 10);
  const m = parseInt(mStr, 10);
  const firstDay = `${yStr}-${mStr}-01`;
  const lastDay = new Date(y, m, 0).toISOString().split("T")[0]; // m月の0日 = 前月末

  // 対象月の pending な前借りを取得
  const { data: pendings } = await supabase
    .from("staff_advances")
    .select("*")
    .eq("status", "pending")
    .gte("advance_date", firstDay)
    .lte("advance_date", lastDay);

  if (!pendings || pendings.length === 0) return { settled: 0, month: targetMonth };

  // スタッフ別に集計
  const byStaff: Record<number, { total: number; ids: number[] }> = {};
  for (const p of pendings) {
    if (!byStaff[p.staff_id]) byStaff[p.staff_id] = { total: 0, ids: [] };
    byStaff[p.staff_id].total += p.amount;
    byStaff[p.staff_id].ids.push(p.id);
  }

  // スタッフ名取得
  const staffIds = Object.keys(byStaff).map(Number);
  const { data: staffList } = await supabase
    .from("staff")
    .select("id,name")
    .in("id", staffIds);
  const staffNameMap: Record<number, string> = {};
  (staffList || []).forEach(s => { staffNameMap[s.id] = s.name; });

  const nowIso = new Date().toISOString();
  let totalSettled = 0;

  // スタッフ別に expense 作成 + staff_advances を settled 更新
  for (const [sidStr, info] of Object.entries(byStaff)) {
    const sid = parseInt(sidStr, 10);
    const name = staffNameMap[sid] || `ID:${sid}`;

    // expenses に自動insert
    const { data: expenseData } = await supabase
      .from("expenses")
      .insert({
        date: lastDay,
        type: "expense",
        category: "外注費",
        subcategory: "スタッフ報酬前借り精算",
        amount: info.total,
        payment_method: "cash",
        description: `${targetMonth} スタッフ前借り精算（${name}）`,
        auto_generated: true,
        auto_source: "staff_advance_settlement",
      })
      .select("id")
      .maybeSingle();

    const expenseId = expenseData?.id || null;

    // staff_advances を settled に更新
    await supabase
      .from("staff_advances")
      .update({
        status: "settled",
        settled_month: targetMonth,
        settled_at: nowIso,
        settled_expense_id: expenseId,
      })
      .in("id", info.ids);

    totalSettled += info.ids.length;
  }

  return { settled: totalSettled, month: targetMonth };
}

// ======================================================================
// 当日の前借り取得ヘルパー
// ======================================================================

export async function fetchTodayAdvances(date: string): Promise<StaffAdvance[]> {
  const { data } = await supabase
    .from("staff_advances")
    .select("*")
    .eq("advance_date", date)
    .order("created_at", { ascending: true });
  return (data || []) as StaffAdvance[];
}

// ======================================================================
// 全期間 pending 取得 (管理者金庫計算用)
// ======================================================================

export async function fetchPendingAdvancesTotal(): Promise<number> {
  const { data } = await supabase
    .from("staff_advances")
    .select("amount")
    .eq("status", "pending");
  return (data || []).reduce((s, a) => s + (a.amount || 0), 0);
}
