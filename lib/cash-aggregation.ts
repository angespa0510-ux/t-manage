/**
 * 金庫フロー集計の SSOT (Single Source of Truth)
 *
 * therapist_daily_settlements の safe_deposited / safe_collected_date
 * フラグに基づく集計ロジックを集約する。
 *
 * 旧式は app/dashboard/page.tsx の 2 箇所で約 200 文字 × 2 のインラインで
 * 完全に同じ集計処理が重複していた。
 *
 * 健康診断レポート 2026-04-26 「重要度: 中 - 金庫フロー集計ロジックが
 * 3 ファイルに分散」対応。
 */

import { supabase } from "./supabase";

/* ─── 述語関数（配列の filter 用、SSOT） ─── */

/** 金庫投函済み・未回収（金庫内に現金が残っている状態） */
export function isSafeUncollected<T extends { safe_deposited?: boolean | null; safe_collected_date?: string | null }>(s: T): boolean {
  return !!s.safe_deposited && !s.safe_collected_date;
}

/** 金庫投函済み・回収済み（履歴扱い） */
export function isSafeCollected<T extends { safe_deposited?: boolean | null; safe_collected_date?: string | null }>(s: T): boolean {
  return !!s.safe_deposited && !!s.safe_collected_date;
}

/* ─── 集約フェッチ関数（dashboard 用、SSOT） ─── */

export type SafeListItem = {
  id: number;
  date: string;
  total_cash: number;
  final_payment: number;
  room_id: number;
  therapist_name: string;
  room_label: string;
  replenish: number;
};

export type SafeHistoryItem = SafeListItem & {
  safe_collected_date: string;
};

/**
 * 金庫モーダル用の未回収・回収履歴を一括取得する。
 *
 * 旧式は dashboard/page.tsx の 2 箇所 (URL params openSafe ロード時 / 金庫ボタン)
 * で約 200 文字のインライン処理が完全に重複していた。
 * 共通関数化して保守性を確保。
 *
 * NOTE: 各 settlement に紐づく room_cash_replenishments を取得する処理は
 *       現状 N+1 になっている。Fix #9 で一括取得 + クライアントマージに最適化予定。
 */
export async function fetchSafeListData(): Promise<{
  uncollected: SafeListItem[];
  history: SafeHistoryItem[];
}> {
  // マスタを並列取得
  const [roomsRes, bldsRes, thRes, sfRes, sfHRes] = await Promise.all([
    supabase.from("rooms").select("*"),
    supabase.from("buildings").select("*"),
    supabase.from("therapists").select("id,name"),
    supabase.from("therapist_daily_settlements")
      .select("*")
      .eq("safe_deposited", true)
      .is("safe_collected_date", null),
    supabase.from("therapist_daily_settlements")
      .select("*")
      .eq("safe_deposited", true)
      .not("safe_collected_date", "is", null)
      .order("safe_collected_date", { ascending: false })
      .limit(20),
  ]);

  const rooms = roomsRes.data || [];
  const blds = bldsRes.data || [];
  const ths = thRes.data || [];
  const sfList = sfRes.data || [];
  const sfHList = sfHRes.data || [];

  const getName = (id: number) => ths.find((t: any) => t.id === id)?.name || "不明";
  const getRoomLabel = (roomId: number): string => {
    const rm = rooms.find((r: any) => r.id === roomId);
    if (!rm) return "";
    const bl = blds.find((b: any) => b.id === rm.building_id);
    return (bl?.name || "") + (rm.name || "");
  };

  // 各 settlement 行に対する釣銭補充額の取得（現状 N+1。Fix #9 で最適化予定）
  const buildItem = async (s: any): Promise<SafeListItem> => {
    const { data: rep } = await supabase
      .from("room_cash_replenishments")
      .select("amount")
      .eq("room_id", s.room_id)
      .eq("date", s.date);
    const repAmt = (rep || []).reduce((sum: number, r: any) => sum + (r.amount || 0), 0);
    return {
      id: s.id,
      date: s.date,
      total_cash: s.total_cash || 0,
      final_payment: s.final_payment || 0,
      room_id: s.room_id,
      therapist_name: getName(s.therapist_id),
      room_label: getRoomLabel(s.room_id),
      replenish: repAmt,
    };
  };

  // 並列に釣銭額を引く（Promise.all で順次でなく同時実行）
  const [uncollected, history] = await Promise.all([
    Promise.all(sfList.map(buildItem)),
    Promise.all(sfHList.map(async (s: any): Promise<SafeHistoryItem> => {
      const base = await buildItem(s);
      return { ...base, safe_collected_date: s.safe_collected_date };
    })),
  ]);

  return { uncollected, history };
}
