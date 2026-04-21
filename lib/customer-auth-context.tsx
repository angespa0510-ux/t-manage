"use client";

/**
 * ═══════════════════════════════════════════════════════════
 * お客様ログイン状態の共通 Context
 *
 * 目的:
 *   HP (app/(site)) と お客様マイページ (app/customer-mypage) で
 *   同一の会員ログイン状態を共有する。
 *
 * 現状の認証方式:
 *   - `customers` テーブルの login_email / login_password で認証
 *   - ログイン成功時 localStorage に `customer_mypage_id` を保存
 *   - ページ遷移ごとにそれを読み直して `customers` レコードを取得
 *
 * 将来（Phase B）:
 *   - Supabase Auth (auth.users) と二重認証にする
 *   - signInWithPassword 成功時に customers.supabase_user_id を紐付け
 *   - 本 Context がその切替ポイントになる
 *
 * 方針:
 *   - HP を SSR で重くしないため、Context は「購読のみ、取得は useEffect」の軽量設計
 *   - ログアウトは localStorage 削除 + state クリアのみ
 *   - 既存の app/customer-mypage/page.tsx は localStorage を直接読み書き
 *     しているが、本 Context も同じキーを参照するので共存可能
 * ═══════════════════════════════════════════════════════════
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from "react";
import { supabase } from "./supabase";

// ─── 型 ───────────────────────────────────────────────────
export type CustomerAuth = {
  id: number;
  name: string;
  self_name: string | null;
  phone: string | null;
  email: string | null;
  login_email: string | null;
  rank: string | null;
  birthday: string | null;
};

/**
 * ログイン会員の付随情報（軽量サマリー）。
 * HP 各所で「ポイント残高」「次回予約」「お気に入り数」を
 * ヘッダー等に表示するために共有する。
 */
export type CustomerSummary = {
  /** ポイント残高（有効期限切れ・使用済みを差し引いた残高） */
  pointBalance: number;
  /** 次回予約（昇順の先頭）。なければ null */
  nextReservation: {
    id: number;
    date: string;       // YYYY-MM-DD
    start_time: string; // HH:MM:SS
    end_time: string;
    course: string;
    therapist_id: number | null;
    total_price: number;
  } | null;
  /** お気に入りセラピスト数 */
  favoriteCount: number;
  /** 未読お知らせ件数 */
  unreadNotificationCount: number;
};

const emptySummary: CustomerSummary = {
  pointBalance: 0,
  nextReservation: null,
  favoriteCount: 0,
  unreadNotificationCount: 0,
};

type Ctx = {
  /** ログイン中のお客様レコード。未ログインなら null。初期化前は undefined */
  customer: CustomerAuth | null | undefined;
  /** customer !== null */
  isLoggedIn: boolean;
  /** 初期化中（localStorage を読んで DB 問い合わせ中）なら true */
  loading: boolean;
  /** 付随情報（ポイント・次回予約・お気に入り数） */
  summary: CustomerSummary;
  /** 最新情報を再取得 */
  refresh: () => Promise<void>;
  /** 付随情報だけを再取得（ポイント変動など） */
  refreshSummary: () => Promise<void>;
  /** クライアント側ログアウト（DB は更新しない） */
  logout: () => void;
  /** 外部（マイページ）でログイン成功したときに Context を即時更新するためのフック */
  hydrate: (c: CustomerAuth) => void;
};

const STORAGE_KEY = "customer_mypage_id";

const CustomerAuthContext = createContext<Ctx | null>(null);

// ─── Provider ─────────────────────────────────────────────
export function CustomerAuthProvider({ children }: { children: ReactNode }) {
  const [customer, setCustomer] = useState<CustomerAuth | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<CustomerSummary>(emptySummary);

  // customers レコードを id で再取得
  const load = useCallback(async (id: number): Promise<CustomerAuth | null> => {
    const { data, error } = await supabase
      .from("customers")
      .select("id,name,self_name,phone,email,login_email,rank,birthday")
      .eq("id", id)
      .maybeSingle();
    if (error || !data) return null;
    return data as CustomerAuth;
  }, []);

  // 付随情報をまとめて取得（ポイント・次回予約・お気に入り・未読件数）
  const loadSummary = useCallback(async (id: number): Promise<CustomerSummary> => {
    const today = new Date().toISOString().split("T")[0];
    const nowIso = new Date().toISOString();

    const [ptsResp, resResp, favResp, notifResp, readResp] = await Promise.all([
      // ポイント（有効期限切れを除外）
      supabase
        .from("customer_points")
        .select("amount,expires_at")
        .eq("customer_id", id),
      // 次回予約（今日以降、status がキャンセル以外）
      supabase
        .from("reservations")
        .select("id,date,start_time,end_time,course,therapist_id,total_price,status")
        .eq("customer_id", id)
        .gte("date", today)
        .order("date", { ascending: true })
        .order("start_time", { ascending: true })
        .limit(5),
      // お気に入り（セラピストのみカウント）
      supabase
        .from("customer_favorites")
        .select("id", { count: "exact", head: true })
        .eq("customer_id", id)
        .eq("type", "therapist"),
      // 全お知らせ（自分宛＋全員宛）
      supabase
        .from("customer_notifications")
        .select("id")
        .or(`target_customer_id.is.null,target_customer_id.eq.${id}`),
      // 既読ログ
      supabase
        .from("customer_notification_reads")
        .select("notification_id")
        .eq("customer_id", id),
    ]);

    // ポイント残高計算
    let pointBalance = 0;
    if (ptsResp.data) {
      for (const p of ptsResp.data) {
        // 有効期限切れマイナス付与は計算外
        if (p.expires_at && p.expires_at < nowIso && (p.amount ?? 0) > 0) continue;
        pointBalance += p.amount ?? 0;
      }
    }

    // 次回予約（キャンセル状態を除外）
    let nextReservation: CustomerSummary["nextReservation"] = null;
    if (resResp.data) {
      const future = resResp.data.find(
        (r) =>
          r.status !== "cancelled" &&
          r.status !== "canceled" &&
          r.status !== "no_show"
      );
      if (future) {
        nextReservation = {
          id: future.id,
          date: future.date,
          start_time: future.start_time,
          end_time: future.end_time,
          course: future.course || "",
          therapist_id: future.therapist_id ?? null,
          total_price: future.total_price ?? 0,
        };
      }
    }

    // 未読お知らせ件数
    const readIds = new Set((readResp.data || []).map((r) => r.notification_id));
    const unreadNotificationCount =
      (notifResp.data || []).filter((n) => !readIds.has(n.id)).length || 0;

    return {
      pointBalance: Math.max(0, pointBalance),
      nextReservation,
      favoriteCount: favResp.count ?? 0,
      unreadNotificationCount,
    };
  }, []);

  // 初期化
  useEffect(() => {
    (async () => {
      try {
        const raw = typeof window === "undefined" ? null : localStorage.getItem(STORAGE_KEY);
        if (!raw) {
          setCustomer(null);
          setLoading(false);
          return;
        }
        const id = Number(raw);
        if (!id) {
          setCustomer(null);
          setLoading(false);
          return;
        }
        const c = await load(id);
        if (!c) {
          // レコードが消えていた場合は localStorage もクリア
          try { localStorage.removeItem(STORAGE_KEY); } catch {}
          setCustomer(null);
        } else {
          setCustomer(c);
          // サマリーも取得
          loadSummary(id).then(setSummary).catch(() => {});
          // best effort: 最終ログイン時刻の更新（DB 側失敗は無視）
          supabase.from("customers").update({ last_login_at: new Date().toISOString() }).eq("id", id).then(() => {});
        }
      } catch {
        setCustomer(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [load, loadSummary]);

  // 他タブでのログイン/ログアウトに追随
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onStorage = async (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      if (!e.newValue) {
        setCustomer(null);
        setSummary(emptySummary);
        return;
      }
      const id = Number(e.newValue);
      if (!id) return;
      const c = await load(id);
      setCustomer(c);
      if (c) loadSummary(id).then(setSummary).catch(() => {});
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [load, loadSummary]);

  const refresh = useCallback(async () => {
    const raw = typeof window === "undefined" ? null : localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      setCustomer(null);
      setSummary(emptySummary);
      return;
    }
    const id = Number(raw);
    if (!id) {
      setCustomer(null);
      setSummary(emptySummary);
      return;
    }
    const c = await load(id);
    setCustomer(c);
    if (c) {
      const s = await loadSummary(id);
      setSummary(s);
    }
  }, [load, loadSummary]);

  const refreshSummary = useCallback(async () => {
    if (!customer) return;
    const s = await loadSummary(customer.id);
    setSummary(s);
  }, [customer, loadSummary]);

  const logout = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
    setCustomer(null);
    setSummary(emptySummary);
  }, []);

  const hydrate = useCallback((c: CustomerAuth) => {
    try {
      localStorage.setItem(STORAGE_KEY, String(c.id));
    } catch {}
    setCustomer(c);
    loadSummary(c.id).then(setSummary).catch(() => {});
  }, [loadSummary]);

  return (
    <CustomerAuthContext.Provider
      value={{
        customer,
        isLoggedIn: !!customer,
        loading,
        summary,
        refresh,
        refreshSummary,
        logout,
        hydrate,
      }}
    >
      {children}
    </CustomerAuthContext.Provider>
  );
}

// ─── フック ──────────────────────────────────────────────
export function useCustomerAuth(): Ctx {
  const ctx = useContext(CustomerAuthContext);
  if (!ctx) {
    // Provider で囲われていない場所で呼ばれた場合のフォールバック
    // （お客様マイページは独自実装のため Provider 外で呼ぶ可能性あり）
    return {
      customer: null,
      isLoggedIn: false,
      loading: false,
      summary: emptySummary,
      refresh: async () => {},
      refreshSummary: async () => {},
      logout: () => {},
      hydrate: () => {},
    };
  }
  return ctx;
}

/**
 * 表示名の取得（self_name > name > "お客様"）
 */
export function displayName(c: CustomerAuth | null | undefined): string {
  if (!c) return "";
  return (c.self_name || c.name || "").trim() || "お客様";
}
