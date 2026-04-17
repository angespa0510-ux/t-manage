"use client";
import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "./supabase";

type ActiveStaff = { id: number; name: string; role: string; company_position: string } | null;

const StaffSessionCtx = createContext<{
  activeStaff: ActiveStaff;
  isManager: boolean;
  canAccessTaxPortal: boolean;
  login: (pin: string) => Promise<boolean>;
  logout: () => void;
}>({ activeStaff: null, isManager: false, canAccessTaxPortal: false, login: async () => false, logout: () => {} });

export function StaffSessionProvider({ children }: { children: ReactNode }) {
  const [activeStaff, setActiveStaff] = useState<ActiveStaff>(null);

  // セッション復元（旧形式のセッションの場合はcompany_positionを自動補完）
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem("t-manage-staff");
      if (!saved) return;
      const parsed = JSON.parse(saved);
      setActiveStaff(parsed);
      // company_positionが欠けている旧形式のセッションの場合、DBから再取得
      if (parsed && parsed.id && parsed.company_position === undefined) {
        supabase.from("staff").select("company_position").eq("id", parsed.id).maybeSingle().then(({ data }) => {
          if (data) {
            const updated = { ...parsed, company_position: data.company_position || "" };
            setActiveStaff(updated);
            sessionStorage.setItem("t-manage-staff", JSON.stringify(updated));
          }
        });
      }
    } catch {}
  }, []);

  const login = async (pin: string): Promise<boolean> => {
    if (!pin || pin.length !== 4) return false;
    const { data } = await supabase.from("staff").select("id,name,role,company_position").eq("pin", pin).eq("status", "active").maybeSingle();
    if (!data) return false;
    const staff = { id: data.id, name: data.name, role: data.role, company_position: data.company_position || "" };
    setActiveStaff(staff);
    sessionStorage.setItem("t-manage-staff", JSON.stringify(staff));
    return true;
  };

  const logout = () => {
    setActiveStaff(null);
    sessionStorage.removeItem("t-manage-staff");
  };

  const isManager = activeStaff?.role === "owner" || activeStaff?.role === "manager" || activeStaff?.role === "leader";
  // 税理士ポータル閲覧可: 社長・経営責任者・税理士のみ
  const canAccessTaxPortal = activeStaff?.company_position === "社長" || activeStaff?.company_position === "経営責任者" || activeStaff?.company_position === "税理士";

  return (
    <StaffSessionCtx.Provider value={{ activeStaff, isManager, canAccessTaxPortal, login, logout }}>
      {children}
    </StaffSessionCtx.Provider>
  );
}

export const useStaffSession = () => useContext(StaffSessionCtx);
