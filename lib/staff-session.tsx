"use client";
import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "./supabase";

type ActiveStaff = { id: number; name: string; role: string } | null;

const StaffSessionCtx = createContext<{
  activeStaff: ActiveStaff;
  isManager: boolean;
  login: (pin: string) => Promise<boolean>;
  logout: () => void;
}>({ activeStaff: null, isManager: false, login: async () => false, logout: () => {} });

export function StaffSessionProvider({ children }: { children: ReactNode }) {
  const [activeStaff, setActiveStaff] = useState<ActiveStaff>(null);

  // セッション復元
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem("t-manage-staff");
      if (saved) setActiveStaff(JSON.parse(saved));
    } catch {}
  }, []);

  const login = async (pin: string): Promise<boolean> => {
    if (!pin || pin.length !== 4) return false;
    const { data } = await supabase.from("staff").select("id,name,role").eq("pin", pin).eq("status", "active").maybeSingle();
    if (!data) return false;
    const staff = { id: data.id, name: data.name, role: data.role };
    setActiveStaff(staff);
    sessionStorage.setItem("t-manage-staff", JSON.stringify(staff));
    return true;
  };

  const logout = () => {
    setActiveStaff(null);
    sessionStorage.removeItem("t-manage-staff");
  };

  const isManager = activeStaff?.role === "owner" || activeStaff?.role === "manager";

  return (
    <StaffSessionCtx.Provider value={{ activeStaff, isManager, login, logout }}>
      {children}
    </StaffSessionCtx.Provider>
  );
}

export const useStaffSession = () => useContext(StaffSessionCtx);
