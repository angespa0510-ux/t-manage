"use client";
import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from "react";
import { supabase } from "./supabase";

type ActiveStaff = {
  id: number;
  name: string;
  role: string;
  company_position: string;
  pin_updated_at: string | null;
  override_is_manager: boolean | null;
  override_can_tax_portal: boolean | null;
  override_can_cash_dashboard: boolean | null;
} | null;

type LoginResult = { ok: boolean; staff: ActiveStaff };
type ChangePinResult = { ok: boolean; error?: string };

const STORAGE_KEY = "t-manage-staff";
const ACTIVITY_KEY = "t-manage-last-activity";

// アイドルタイムアウト（分）— ロールごと
const IDLE_MIN_TAX_ACCOUNTANT = 60;    // 税理士: 1 時間
const IDLE_MIN_MANAGER = 120;          // owner / manager: 2 時間
const IDLE_MIN_DEFAULT = 240;          // その他（leader・一般スタッフ）: 4 時間

// 弱い PIN（推測されやすいもの） — changePin で拒否
const WEAK_PINS = new Set([
  "0000", "1111", "2222", "3333", "4444", "5555", "6666", "7777", "8888", "9999",
  "1234", "4321", "0123", "3210", "1212", "2121", "1122", "2211", "1010", "0101",
  "1357", "2468", "6969", "0911", "1999", "2000", "2024", "2025", "2026",
]);

function getIdleTimeoutMs(staff: ActiveStaff): number {
  if (!staff) return IDLE_MIN_DEFAULT * 60 * 1000;
  if (staff.company_position === "税理士") return IDLE_MIN_TAX_ACCOUNTANT * 60 * 1000;
  if (staff.role === "owner" || staff.role === "manager") return IDLE_MIN_MANAGER * 60 * 1000;
  return IDLE_MIN_DEFAULT * 60 * 1000;
}

const StaffSessionCtx = createContext<{
  activeStaff: ActiveStaff;
  isManager: boolean;
  canAccessTaxPortal: boolean;
  canAccessCashDashboard: boolean;
  needsPinChange: boolean;
  login: (pin: string) => Promise<LoginResult>;
  logout: () => void;
  changePin: (currentPin: string, newPin: string) => Promise<ChangePinResult>;
  dismissPinChangeTemporarily: () => void;
}>({
  activeStaff: null,
  isManager: false,
  canAccessTaxPortal: false,
  canAccessCashDashboard: false,
  needsPinChange: false,
  login: async () => ({ ok: false, staff: null }),
  logout: () => {},
  changePin: async () => ({ ok: false }),
  dismissPinChangeTemporarily: () => {},
});

export function StaffSessionProvider({ children }: { children: ReactNode }) {
  const [activeStaff, setActiveStaff] = useState<ActiveStaff>(null);
  // PIN 変更モーダルを「このセッション中だけ後回しにする」フラグ（localStorage には保存しない）
  const [pinChangeDismissed, setPinChangeDismissed] = useState(false);
  const activeStaffRef = useRef<ActiveStaff>(null);
  activeStaffRef.current = activeStaff;

  // アクティビティ記録（localStorage に最終操作時刻を保存）
  const updateActivity = useCallback(() => {
    try {
      localStorage.setItem(ACTIVITY_KEY, String(Date.now()));
    } catch {}
  }, []);

  // アイドル判定とログアウト処理
  const forceLogout = useCallback((idleLogout: boolean) => {
    const st = activeStaffRef.current;
    if (st) {
      // ログアウトログ記録（失敗しても無視）
      try {
        supabase.from("staff_login_logs").insert({
          staff_id: st.id,
          staff_name: st.name,
          logout_at: new Date().toISOString(),
          idle_logout: idleLogout,
          user_agent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 200) : "",
        }).then(() => {});
      } catch {}
    }
    setActiveStaff(null);
    setPinChangeDismissed(false);
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(ACTIVITY_KEY);
    } catch {}
  }, []);

  // マウント時: セッション復元（+ アイドル時間チェック）
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved) as ActiveStaff;
      if (!parsed) return;

      // アイドル時間が許容を超えていたら復元せずログアウト扱い
      const lastStr = localStorage.getItem(ACTIVITY_KEY);
      const lastActivity = lastStr ? parseInt(lastStr, 10) : Date.now();
      const idleMs = Date.now() - lastActivity;
      const timeoutMs = getIdleTimeoutMs(parsed);
      if (idleMs > timeoutMs) {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(ACTIVITY_KEY);
        return;
      }

      setActiveStaff(parsed);
      updateActivity();

      // 旧形式セッション（pin_updated_at / company_position / override_* 欠落）を DB から補完
      if (parsed && parsed.id && (parsed.pin_updated_at === undefined || parsed.company_position === undefined || parsed.override_is_manager === undefined)) {
        supabase
          .from("staff")
          .select("company_position,pin_updated_at,override_is_manager,override_can_tax_portal,override_can_cash_dashboard")
          .eq("id", parsed.id)
          .maybeSingle()
          .then(({ data }) => {
            if (data) {
              const updated: ActiveStaff = {
                ...parsed,
                company_position: data.company_position || "",
                pin_updated_at: data.pin_updated_at || null,
                override_is_manager: data.override_is_manager ?? null,
                override_can_tax_portal: data.override_can_tax_portal ?? null,
                override_can_cash_dashboard: data.override_can_cash_dashboard ?? null,
              };
              setActiveStaff(updated);
              try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
              } catch {}
            }
          });
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // アクティビティ監視 + アイドル自動ログアウト
  useEffect(() => {
    if (!activeStaff) return;

    const handler = () => updateActivity();
    window.addEventListener("click", handler, { passive: true });
    window.addEventListener("keydown", handler, { passive: true });
    window.addEventListener("touchstart", handler, { passive: true });
    window.addEventListener("scroll", handler, { passive: true });
    // 他タブでログアウトされたら反映
    const storageHandler = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue === null) {
        setActiveStaff(null);
        setPinChangeDismissed(false);
      }
    };
    window.addEventListener("storage", storageHandler);

    // 定期チェック（30 秒ごと） — アイドル超過で自動ログアウト
    const interval = setInterval(() => {
      const st = activeStaffRef.current;
      if (!st) return;
      const lastStr = localStorage.getItem(ACTIVITY_KEY);
      const lastActivity = lastStr ? parseInt(lastStr, 10) : Date.now();
      const idleMs = Date.now() - lastActivity;
      const timeoutMs = getIdleTimeoutMs(st);
      if (idleMs > timeoutMs) {
        forceLogout(true);
      }
    }, 30 * 1000);

    return () => {
      window.removeEventListener("click", handler);
      window.removeEventListener("keydown", handler);
      window.removeEventListener("touchstart", handler);
      window.removeEventListener("scroll", handler);
      window.removeEventListener("storage", storageHandler);
      clearInterval(interval);
    };
  }, [activeStaff, updateActivity, forceLogout]);

  const login = async (pin: string): Promise<LoginResult> => {
    if (!pin || pin.length !== 4) return { ok: false, staff: null };
    const { data } = await supabase
      .from("staff")
      .select("id,name,role,company_position,pin_updated_at,override_is_manager,override_can_tax_portal,override_can_cash_dashboard")
      .eq("pin", pin)
      .eq("status", "active")
      .maybeSingle();
    if (!data) return { ok: false, staff: null };
    const staff: ActiveStaff = {
      id: data.id,
      name: data.name,
      role: data.role,
      company_position: data.company_position || "",
      pin_updated_at: data.pin_updated_at || null,
      override_is_manager: data.override_is_manager ?? null,
      override_can_tax_portal: data.override_can_tax_portal ?? null,
      override_can_cash_dashboard: data.override_can_cash_dashboard ?? null,
    };
    setActiveStaff(staff);
    setPinChangeDismissed(false);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(staff));
    } catch {}
    updateActivity();

    // ログイン履歴を記録（失敗しても無視）
    try {
      supabase.from("staff_login_logs").insert({
        staff_id: staff!.id,
        staff_name: staff!.name,
        user_agent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 200) : "",
      }).then(() => {});
    } catch {}

    return { ok: true, staff };
  };

  const logout = () => {
    forceLogout(false);
  };

  const changePin = async (currentPin: string, newPin: string): Promise<ChangePinResult> => {
    if (!activeStaff) return { ok: false, error: "ログインしていません" };
    if (!/^\d{4}$/.test(newPin)) return { ok: false, error: "新しい PIN は 4 桁の数字で入力してください" };
    if (currentPin === newPin) return { ok: false, error: "現在の PIN と同じものは使えません" };
    if (WEAK_PINS.has(newPin)) return { ok: false, error: "推測されやすい PIN です（連番・ゾロ目・年号など）。別の PIN を入力してください" };

    // 現在の PIN を検証
    const { data: check } = await supabase
      .from("staff")
      .select("id")
      .eq("id", activeStaff.id)
      .eq("pin", currentPin)
      .maybeSingle();
    if (!check) return { ok: false, error: "現在の PIN が一致しません" };

    // 重複チェック（他スタッフが同じ PIN を使っていたら拒否）
    const { data: dup } = await supabase
      .from("staff")
      .select("id")
      .eq("pin", newPin)
      .neq("id", activeStaff.id)
      .maybeSingle();
    if (dup) return { ok: false, error: "この PIN は他のスタッフが使用中です。別の PIN を選んでください" };

    const now = new Date().toISOString();
    const { error } = await supabase
      .from("staff")
      .update({ pin: newPin, pin_updated_at: now })
      .eq("id", activeStaff.id);
    if (error) return { ok: false, error: error.message };

    const updated: ActiveStaff = { ...activeStaff, pin_updated_at: now };
    setActiveStaff(updated);
    setPinChangeDismissed(false);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {}
    return { ok: true };
  };

  // 「今は後回し」ボタンで一時的にモーダルを閉じる（次回ログインでは再表示される）
  const dismissPinChangeTemporarily = () => setPinChangeDismissed(true);

  // === 権限判定 ===
  // 各権限は「個別上書き (override_*) が設定されていればそれを優先、
  // NULL ならロール/法人ポジションベースのデフォルト判定」で決まる。

  // 管理系操作: デフォルトで全ログインスタッフが有効 (基本みんなできる)
  const defaultIsManager = !!activeStaff;

  // 税理士ポータル: 社長/経営責任者/税理士、または responsible(supervisor) ロール
  const defaultCanTaxPortal =
    activeStaff?.company_position === "社長" ||
    activeStaff?.company_position === "経営責任者" ||
    activeStaff?.company_position === "税理士" ||
    activeStaff?.role === "supervisor";

  // 資金管理: 社長/経営責任者のみ (税理士は除外)
  const defaultCanCashDashboard =
    activeStaff?.company_position === "社長" ||
    activeStaff?.company_position === "経営責任者";

  const isManager = activeStaff?.override_is_manager ?? defaultIsManager;
  const canAccessTaxPortal = activeStaff?.override_can_tax_portal ?? defaultCanTaxPortal;
  const canAccessCashDashboard = activeStaff?.override_can_cash_dashboard ?? defaultCanCashDashboard;

  // PIN 未変更 = pin_updated_at が NULL（初期 PIN のまま）
  const needsPinChange = !!activeStaff && !activeStaff.pin_updated_at && !pinChangeDismissed;

  return (
    <StaffSessionCtx.Provider
      value={{
        activeStaff,
        isManager,
        canAccessTaxPortal,
        canAccessCashDashboard,
        needsPinChange,
        login,
        logout,
        changePin,
        dismissPinChangeTemporarily,
      }}
    >
      {children}
    </StaffSessionCtx.Provider>
  );
}

export const useStaffSession = () => useContext(StaffSessionCtx);
