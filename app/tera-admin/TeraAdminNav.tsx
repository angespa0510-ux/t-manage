"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "../../lib/theme";

const NAV_ITEMS = [
  { href: "/tera-admin", label: "ダッシュボード", icon: "🏠" },
  { href: "/tera-admin/instances", label: "店舗一覧", icon: "🏢" },
  { href: "/tera-admin/instances/new", label: "新規店舗発行", icon: "➕" },
  { href: "/tera-admin/url-structure", label: "URL構成", icon: "🌐" },
  { href: "/tera-admin/updates", label: "一斉配信", icon: "📢" },
  { href: "/tera-admin/stats", label: "横断統計", icon: "📊" },
  { href: "/tera-admin/logs", label: "アクティビティログ", icon: "📜" },
];

export function TeraAdminNav() {
  const pathname = usePathname();
  const { T, dark, toggle } = useTheme();

  return (
    <div
      style={{
        position: "sticky",
        top: 0,
        zIndex: 100,
        background: `linear-gradient(135deg, ${T.card} 0%, ${T.cardAlt} 100%)`,
        borderBottom: `2px solid ${T.accent}`,
        padding: "12px 24px",
        display: "flex",
        alignItems: "center",
        gap: 16,
        flexWrap: "wrap",
      }}
    >
      <Link
        href="/tera-admin"
        style={{
          textDecoration: "none",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: `linear-gradient(135deg, ${T.accent}, #8b7355)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            fontWeight: 800,
            fontSize: 20,
            boxShadow: `0 4px 10px ${T.accent}44`,
          }}
        >
          T
        </div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: T.text, letterSpacing: 0.5 }}>
            TERA-MANAGE
          </div>
          <div style={{ fontSize: 11, color: T.textSub, marginTop: -2 }}>
            マスター管理画面
          </div>
        </div>
      </Link>

      <div style={{ flex: 1 }} />

      <nav style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {NAV_ITEMS.map((item) => {
          const active =
            item.href === "/tera-admin"
              ? pathname === "/tera-admin"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                padding: "8px 14px",
                borderRadius: 8,
                background: active ? T.accent : "transparent",
                color: active ? "#fff" : T.text,
                fontSize: 13,
                fontWeight: 600,
                textDecoration: "none",
                display: "flex",
                alignItems: "center",
                gap: 6,
                transition: "all 0.2s",
              }}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <button
        onClick={toggle}
        style={{
          background: "transparent",
          border: `1px solid ${T.border}`,
          color: T.text,
          padding: "6px 12px",
          borderRadius: 8,
          cursor: "pointer",
          fontSize: 13,
        }}
      >
        {dark ? "☀️" : "🌙"}
      </button>

      <Link
        href="/admin/dashboard"
        style={{
          padding: "6px 14px",
          borderRadius: 8,
          background: T.cardAlt,
          color: T.textSub,
          fontSize: 12,
          fontWeight: 600,
          textDecoration: "none",
          border: `1px solid ${T.border}`,
        }}
      >
        ← T-MANAGEへ戻る
      </Link>
    </div>
  );
}

export function TeraAdminShell({ children }: { children: React.ReactNode }) {
  const { T } = useTheme();
  return (
    <div style={{ minHeight: "100vh", background: T.bg }}>
      <TeraAdminNav />
      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "24px" }}>{children}</div>
    </div>
  );
}
