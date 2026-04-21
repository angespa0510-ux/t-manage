import { supabase } from "./supabase";

/**
 * ═══════════════════════════════════════════════════════════
 * Event 型 & 取得ヘルパー
 *
 * events テーブルから「今有効なイベント」を取得する共通ロジック。
 * HP カルーセル / マイページで同一の条件を使う。
 * ═══════════════════════════════════════════════════════════
 */

export type Event = {
  id: number;
  title: string;
  subtitle: string;
  description: string;
  badge_label: string;
  image_url: string;
  accent_color: string;
  start_date: string | null;
  end_date: string | null;
  is_published: boolean;
  show_on_hp: boolean;
  show_on_mypage: boolean;
  members_only: boolean;
  cta_label: string;
  cta_url: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
  created_by_name: string;
};

const todayStr = () => new Date().toISOString().split("T")[0];

/**
 * 公開中かつ本日が期間内のイベントを取得
 *
 * @param target 取得対象 'hp' | 'mypage' | 'any'
 * @param opts.includeUpcoming trueなら開始前のイベントも含める（管理画面プレビュー用）
 */
export async function fetchActiveEvents(
  target: "hp" | "mypage" | "any" = "any",
  opts: { includeUpcoming?: boolean } = {}
): Promise<Event[]> {
  const today = todayStr();
  let q = supabase
    .from("events")
    .select("*")
    .eq("is_published", true)
    .order("sort_order", { ascending: true })
    .order("id", { ascending: false });

  if (target === "hp") q = q.eq("show_on_hp", true);
  if (target === "mypage") q = q.eq("show_on_mypage", true);

  const { data, error } = await q;
  if (error || !data) return [];

  return (data as Event[]).filter((e) => {
    // 終了日チェック
    if (e.end_date && e.end_date < today) return false;
    // 開始日チェック（未来開始は includeUpcoming 時のみ表示）
    if (!opts.includeUpcoming && e.start_date && e.start_date > today) return false;
    return true;
  });
}

/**
 * イベントの期間表示文字列
 */
export function formatEventPeriod(e: Event): string {
  const fmt = (d: string) => {
    const dt = new Date(d + "T00:00:00");
    return `${dt.getMonth() + 1}/${dt.getDate()}`;
  };
  if (e.start_date && e.end_date) return `${fmt(e.start_date)} 〜 ${fmt(e.end_date)}`;
  if (e.start_date) return `${fmt(e.start_date)} 〜`;
  if (e.end_date) return `〜 ${fmt(e.end_date)}`;
  return "";
}

/**
 * イベントが残りわずか（終了日まで3日以内）か
 */
export function isEndingSoon(e: Event): boolean {
  if (!e.end_date) return false;
  const today = new Date();
  const end = new Date(e.end_date + "T23:59:59");
  const diff = end.getTime() - today.getTime();
  const days = diff / (1000 * 60 * 60 * 24);
  return days >= 0 && days <= 3;
}
