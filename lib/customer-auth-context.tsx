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

type Ctx = {
  /** ログイン中のお客様レコード。未ログインなら null。初期化前は undefined */
  customer: CustomerAuth | null | undefined;
  /** customer !== null */
  isLoggedIn: boolean;
  /** 初期化中（localStorage を読んで DB 問い合わせ中）なら true */
  loading: boolean;
  /** 最新情報を再取得 */
  refresh: () => Promise<void>;
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
          // best effort: 最終ログイン時刻の更新（DB 側失敗は無視）
          supabase.from("customers").update({ last_login_at: new Date().toISOString() }).eq("id", id).then(() => {});
        }
      } catch {
        setCustomer(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [load]);

  // 他タブでのログイン/ログアウトに追随
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onStorage = async (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      if (!e.newValue) {
        setCustomer(null);
        return;
      }
      const id = Number(e.newValue);
      if (!id) return;
      const c = await load(id);
      setCustomer(c);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [load]);

  const refresh = useCallback(async () => {
    const raw = typeof window === "undefined" ? null : localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      setCustomer(null);
      return;
    }
    const id = Number(raw);
    if (!id) {
      setCustomer(null);
      return;
    }
    const c = await load(id);
    setCustomer(c);
  }, [load]);

  const logout = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
    setCustomer(null);
  }, []);

  const hydrate = useCallback((c: CustomerAuth) => {
    try {
      localStorage.setItem(STORAGE_KEY, String(c.id));
    } catch {}
    setCustomer(c);
  }, []);

  return (
    <CustomerAuthContext.Provider
      value={{
        customer,
        isLoggedIn: !!customer,
        loading,
        refresh,
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
      refresh: async () => {},
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
