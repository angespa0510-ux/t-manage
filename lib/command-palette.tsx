"use client";

import { Command } from "cmdk";
import { useRouter, usePathname } from "next/navigation";
import { createPortal } from "react-dom";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { NAV_ITEMS, type NavItem } from "./nav-menu";
import { useStaffSession } from "./staff-session";

const RECENT_KEY = "tm_palette_recent_v1";
const RECENT_MAX = 5;

type Ctx = {
  open: boolean;
  setOpen: (v: boolean) => void;
  toggle: () => void;
};

const CommandPaletteContext = createContext<Ctx | null>(null);

export function useCommandPalette() {
  const ctx = useContext(CommandPaletteContext);
  if (!ctx) throw new Error("useCommandPalette must be used inside CommandPaletteProvider");
  return ctx;
}

function loadRecent(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((s) => typeof s === "string").slice(0, RECENT_MAX) : [];
  } catch {
    return [];
  }
}

function saveRecent(label: string) {
  if (typeof window === "undefined") return;
  try {
    const cur = loadRecent().filter((l) => l !== label);
    cur.unshift(label);
    localStorage.setItem(RECENT_KEY, JSON.stringify(cur.slice(0, RECENT_MAX)));
  } catch {
    // ignore
  }
}

export function CommandPaletteProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const toggle = useCallback(() => setOpen((v) => !v), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isCmdK = (e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K");
      if (isCmdK) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <CommandPaletteContext.Provider value={{ open, setOpen, toggle }}>
      {children}
      <CommandPaletteDialog />
    </CommandPaletteContext.Provider>
  );
}

function CommandPaletteDialog() {
  const { open, setOpen } = useCommandPalette();
  const router = useRouter();
  const pathname = usePathname();
  const session = useStaffSession();
  const [search, setSearch] = useState("");
  const [mounted, setMounted] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (open) {
      setRecent(loadRecent());
      setSearch("");
    }
  }, [open]);

  const visibleItems = useMemo<NavItem[]>(() => {
    return NAV_ITEMS.filter((item) => {
      if (item.requiresTaxPortal && !session.canAccessTaxPortal) return false;
      if (item.requiresCashDashboard && !session.canAccessCashDashboard) return false;
      if (item.requiresManager && !session.isManager) return false;
      if (item.requiresCallAssistant && !session.canAccessCallAssistant) return false;
      return true;
    });
  }, [session.canAccessTaxPortal, session.canAccessCashDashboard, session.isManager, session.canAccessCallAssistant]);

  const recentItems = useMemo(() => {
    if (recent.length === 0) return [];
    const byLabel = new Map(visibleItems.map((it) => [it.label, it]));
    return recent.map((l) => byLabel.get(l)).filter((x): x is NavItem => Boolean(x));
  }, [recent, visibleItems]);

  const grouped = useMemo(() => {
    const map = new Map<string, NavItem[]>();
    for (const item of visibleItems) {
      const arr = map.get(item.category) ?? [];
      arr.push(item);
      map.set(item.category, arr);
    }
    return Array.from(map.entries());
  }, [visibleItems]);

  const handleSelect = useCallback(
    (item: NavItem) => {
      saveRecent(item.label);
      setOpen(false);
      if (item.path.startsWith("DASHBOARD_PAGE:")) {
        const page = item.path.split(":")[1];
        const onDashboard =
          window.location.pathname === "/admin/dashboard" ||
          window.location.pathname === "/dashboard";
        if (onDashboard) {
          window.dispatchEvent(new CustomEvent("dashboardPage", { detail: page }));
        } else {
          router.push(`/admin/dashboard?page=${encodeURIComponent(page)}`);
        }
      } else {
        router.push(item.path);
      }
    },
    [router, setOpen]
  );

  if (!mounted || !open) return null;

  return createPortal(
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 100000,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: "10vh",
      }}
      onClick={() => setOpen(false)}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: "rgba(0,0,0,0.6)",
          backdropFilter: "blur(4px)",
        }}
      />
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "relative",
          width: "min(640px, 92vw)",
          maxHeight: "70vh",
          backgroundColor: "#1a1a2e",
          borderRadius: 12,
          boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
          border: "1px solid rgba(255,255,255,0.08)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <Command
          shouldFilter
          loop
          label="機能を検索"
          style={{ display: "flex", flexDirection: "column", minHeight: 0, flex: 1 }}
        >
          <div
            style={{
              padding: "14px 16px",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <span style={{ fontSize: 16, color: "rgba(255,255,255,0.4)" }}>🔍</span>
            <Command.Input
              autoFocus
              value={search}
              onValueChange={setSearch}
              placeholder="機能を検索 ・・・ (例：「せい」で営業締め)"
              style={{
                flex: 1,
                background: "transparent",
                border: "none",
                outline: "none",
                color: "rgba(255,255,255,0.95)",
                fontSize: 15,
              }}
            />
            <span
              style={{
                fontSize: 11,
                color: "rgba(255,255,255,0.3)",
                border: "1px solid rgba(255,255,255,0.15)",
                borderRadius: 4,
                padding: "2px 6px",
              }}
            >
              esc
            </span>
          </div>

          <Command.List
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "8px 8px 12px",
              minHeight: 0,
            }}
          >
            <Command.Empty
              style={{ padding: "32px 16px", textAlign: "center", color: "rgba(255,255,255,0.4)", fontSize: 13 }}
            >
              該当する機能が見つかりません
            </Command.Empty>

            {recentItems.length > 0 && search === "" && (
              <Command.Group
                heading="最近使ったもの"
                className="t-cmdk-group"
              >
                {recentItems.map((item) => (
                  <PaletteItem
                    key={`recent-${item.label}`}
                    item={item}
                    pathname={pathname}
                    onSelect={() => handleSelect(item)}
                    valueOverride={`recent-${item.label}`}
                  />
                ))}
              </Command.Group>
            )}

            {grouped.map(([category, items]) => (
              <Command.Group key={category} heading={category} className="t-cmdk-group">
                {items.map((item) => (
                  <PaletteItem
                    key={item.label}
                    item={item}
                    pathname={pathname}
                    onSelect={() => handleSelect(item)}
                  />
                ))}
              </Command.Group>
            ))}
          </Command.List>

          <div
            style={{
              padding: "8px 14px",
              borderTop: "1px solid rgba(255,255,255,0.06)",
              fontSize: 11,
              color: "rgba(255,255,255,0.35)",
              display: "flex",
              gap: 14,
              flexShrink: 0,
            }}
          >
            <span>↑↓ 移動</span>
            <span>⏎ 開く</span>
            <span>esc 閉じる</span>
            <span style={{ marginLeft: "auto" }}>⌘K でいつでも呼び出し</span>
          </div>
        </Command>
      </div>

      <style>{`
        .t-cmdk-group [cmdk-group-heading] {
          font-size: 10px;
          letter-spacing: 1.5px;
          color: rgba(255,255,255,0.3);
          font-weight: 600;
          padding: 10px 10px 4px;
          text-transform: uppercase;
        }
        [cmdk-item] {
          cursor: pointer;
        }
        [cmdk-item][data-selected="true"] {
          background-color: rgba(201,107,131,0.15) !important;
        }
      `}</style>
    </div>,
    document.body
  );
}

function PaletteItem({
  item,
  pathname,
  onSelect,
  valueOverride,
}: {
  item: NavItem;
  pathname: string | null;
  onSelect: () => void;
  valueOverride?: string;
}) {
  const isActive = !item.path.startsWith("DASHBOARD_PAGE:") && pathname === item.path;
  const value = valueOverride ?? `${item.category} ${item.label} ${item.path}`;

  return (
    <Command.Item
      value={value}
      onSelect={onSelect}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "9px 12px",
        borderRadius: 6,
        color: "rgba(255,255,255,0.85)",
        fontSize: 13,
      }}
    >
      <span style={{ fontSize: 16, width: 22, textAlign: "center" }}>{item.icon}</span>
      <span style={{ flex: 1 }}>{item.label}</span>
      {isActive && (
        <span
          style={{
            fontSize: 10,
            color: "rgba(201,107,131,0.9)",
            border: "1px solid rgba(201,107,131,0.4)",
            borderRadius: 4,
            padding: "1px 6px",
          }}
        >
          現在地
        </span>
      )}
      <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>{item.category}</span>
    </Command.Item>
  );
}

export function CommandPaletteButton({ T }: { T?: Record<string, string> }) {
  const { setOpen } = useCommandPalette();
  return (
    <button
      onClick={() => setOpen(true)}
      title="機能を検索 (⌘K)"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 10px",
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 8,
        color: T?.textSub ?? "rgba(255,255,255,0.5)",
        fontSize: 12,
        cursor: "pointer",
      }}
    >
      <span>🔍</span>
      <span>検索</span>
      <span
        style={{
          fontSize: 10,
          border: "1px solid rgba(255,255,255,0.15)",
          borderRadius: 4,
          padding: "1px 5px",
          marginLeft: 4,
        }}
      >
        ⌘K
      </span>
    </button>
  );
}
