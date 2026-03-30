"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";

const NAV_ITEMS = [
  { label: "HOME", path: "/dashboard" },
  { label: "タイムチャート", path: "/timechart" },
  { label: "部屋割り管理", path: "/room-assignments" },
  { label: "セラピスト勤怠", path: "/shifts" },
  { label: "売上分析", path: "/analytics" },
  { label: "経費管理", path: "/expenses" },
  { label: "税務報告", path: "/tax-dashboard" },
  { label: "スタッフ設定", path: "/staff" },
  { label: "顧客一覧", path: "DASHBOARD_PAGE:顧客一覧" },
  { label: "顧客登録", path: "DASHBOARD_PAGE:顧客登録" },
  { label: "セラピスト登録", path: "/therapists" },
  { label: "コース登録", path: "/courses" },
  { label: "利用場所登録", path: "/rooms" },
  { label: "サービス設定", path: "/service-settings" },
];

const ICONS: Record<string, string> = {
  "HOME": "🏠", "タイムチャート": "📅", "部屋割り管理": "🏢", "セラピスト勤怠": "⏰",
  "売上分析": "📊", "顧客一覧": "👥", "顧客登録": "📝", "セラピスト登録": "💆",
  "コース登録": "📋", "利用場所登録": "🔑", "サービス設定": "⚙️", "経費管理": "💰", "税務報告": "📑", "スタッフ設定": "👥",
};

function SidebarPortal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted || !open) return null;

  const handleClick = (item: typeof NAV_ITEMS[0]) => {
    if (item.path.startsWith("DASHBOARD_PAGE:")) {
      const page = item.path.split(":")[1];
      if (window.location.pathname === "/dashboard") {
        window.dispatchEvent(new CustomEvent("dashboardPage", { detail: page }));
      } else {
        router.push(`/dashboard?page=${encodeURIComponent(page)}`);
      }
    } else {
      router.push(item.path);
    }
    onClose();
  };

  return createPortal(
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 99999 }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)" }} onClick={onClose} />
      <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: 260, backgroundColor: "#1a1a2e", display: "flex", flexDirection: "column", boxShadow: "4px 0 20px rgba(0,0,0,0.3)" }}>
        <div style={{ height: 64, display: "flex", alignItems: "center", padding: "0 20px", borderBottom: "1px solid rgba(255,255,255,0.04)", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg, #c3a782, #a8895e)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ color: "white", fontSize: 12, fontWeight: 600 }}>C</span>
            </div>
            <div>
              <p style={{ fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,0.9)", margin: 0 }}>チョップ</p>
              <p style={{ fontSize: 8, color: "rgba(255,255,255,0.25)", letterSpacing: 2, margin: 0 }}>SALON MANAGEMENT</p>
            </div>
          </div>
          <button onClick={onClose} style={{ color: "rgba(255,255,255,0.3)", cursor: "pointer", padding: 4, fontSize: 18, background: "none", border: "none", lineHeight: 1 }}>✕</button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 12px" }}>
          {NAV_ITEMS.map((item) => (
            <button key={item.label} onClick={() => handleClick(item)}
              style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", fontSize: 13, borderRadius: 8, cursor: "pointer", color: "rgba(255,255,255,0.6)", background: "none", border: "none", textAlign: "left", marginBottom: 2 }}>
              <span style={{ fontSize: 16, width: 24, textAlign: "center" }}>{ICONS[item.label] || "📄"}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}

export function NavMenu({ T }: { T: Record<string, string>; dark?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className="p-2 rounded-lg cursor-pointer" style={{ color: T.textSub }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/><line x1="3" y1="18" x2="18" y2="18"/>
        </svg>
      </button>
      <SidebarPortal open={open} onClose={() => setOpen(false)} />
    </>
  );
}