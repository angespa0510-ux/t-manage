"use client";

import { useState, useEffect } from "react";
import { supabase } from "./supabase";

export type Role = "owner" | "manager" | "staff";

export function useRole() {
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRole = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setRole(null); setLoading(false); return; }
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id).single();
      setRole((data?.role as Role) || "staff");
      setLoading(false);
    };
    fetchRole();
  }, []);

  const isOwner = role === "owner";
  const isManager = role === "owner" || role === "manager";
  const isStaff = role === "owner" || role === "manager" || role === "staff";

  return { role, loading, isOwner, isManager, isStaff };
}