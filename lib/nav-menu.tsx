"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { useStaffSession } from "./staff-session";

// ── メニュー定義 ──────────────────────────────────
// 並べ替えはここだけ変更すればOK
// path が "DASHBOARD_PAGE:xxx" → ダッシュボード内タブ切替
// category が変わる境目にセパレーターを自動表示
// requiresTaxPortal: true の項目は 社長・経営責任者・税理士 のみ表示
// requiresCashDashboard: true の項目は 社長・経営責任者 のみ表示 (税理士除外)
// requiresCallAssistant: true の項目は 社長・経営責任者 のみ表示 (通話AI)

export type NavItem = { icon: string; label: string; path: string; category: string; requiresTaxPortal?: boolean; requiresCashDashboard?: boolean; requiresManager?: boolean; requiresCallAssistant?: boolean };

export const NAV_ITEMS: NavItem[] = [
  // ── 日常業務（毎日使うもの）──
  { icon: "🏠", label: "HOME",        path: "/admin/dashboard",              category: "日常業務" },
  { icon: "📅", label: "タイムチャート", path: "/admin/timechart",              category: "日常業務" },
  { icon: "🏢", label: "部屋割り管理",  path: "/admin/room-assignments",       category: "日常業務" },
  { icon: "💰", label: "経費管理",      path: "/admin/expenses",               category: "日常業務" },
  { icon: "🔒", label: "営業締め",      path: "DASHBOARD_PAGE:営業締め",  category: "日常業務" },
  { icon: "🎙", label: "通話AI",       path: "/admin/call-test",              category: "日常業務", requiresCallAssistant: true },

  // ── 売上 ──
  { icon: "📊", label: "売上分析",  path: "/admin/analytics",      category: "売上" },
  { icon: "📈", label: "集客分析",  path: "/admin/marketing-analytics", category: "売上", requiresManager: true },
  { icon: "📋", label: "バックオフィス",  path: "/admin/tax-dashboard",  category: "売上", requiresCashDashboard: true },
  { icon: "💴", label: "資金管理", path: "/admin/cash-dashboard", category: "売上", requiresCashDashboard: true },
  { icon: "📦", label: "棚卸管理", path: "/admin/inventory", category: "売上", requiresCashDashboard: true },
  { icon: "📒", label: "税理士ポータル", path: "/admin/tax-portal", category: "売上", requiresTaxPortal: true },
  { icon: "🔍", label: "アクセス解析", path: "/admin/insights", category: "売上", requiresManager: true },

  // ── 顧客 ──
  { icon: "👥", label: "顧客一覧",       path: "DASHBOARD_PAGE:顧客一覧",    category: "顧客" },
  { icon: "📝", label: "顧客登録",       path: "DASHBOARD_PAGE:顧客登録",    category: "顧客" },
  { icon: "🎁", label: "ポイント管理",    path: "DASHBOARD_PAGE:ポイント管理", category: "顧客" },
  { icon: "🔔", label: "会員お知らせ投稿", path: "/admin/notification-post",         category: "顧客" },
  { icon: "📱", label: "お客様マイページ", path: "/mypage",           category: "顧客" },

  // ── セラピスト ──
  { icon: "⏰", label: "セラピスト勤怠",       path: "/admin/shifts",                       category: "セラピスト" },
  { icon: "💆", label: "セラピスト登録",       path: "/admin/therapists",                   category: "セラピスト" },
  { icon: "📢", label: "セラピストお知らせ投稿", path: "/admin/therapist-notification-post",  category: "セラピスト" },
  { icon: "👤", label: "セラピストマイページ",  path: "/cast",                       category: "セラピスト" },
  { icon: "🎬", label: "AI動画生成",           path: "/admin/video-generator",              category: "セラピスト" },
  { icon: "💬", label: "チャット",             path: "/admin/chat",                         category: "セラピスト" },
  { icon: "📖", label: "マニュアル管理",       path: "/admin/manual",                       category: "セラピスト" },
  { icon: "📸", label: "写メ日記管理",         path: "/admin/diary-moderation",             category: "セラピスト", requiresManager: true },
  { icon: "📡", label: "ストーリー監視",       path: "/admin/story-moderation",             category: "セラピスト", requiresManager: true },
  { icon: "🦋", label: "Bluesky連携",          path: "/admin/bluesky-admin",                category: "セラピスト", requiresManager: true },
  { icon: "🎬", label: "ライブ配信管理",        path: "/admin/live-admin",                   category: "セラピスト", requiresManager: true },
  { icon: "📧", label: "駅ちか設定",           path: "/admin/ekichika-settings",            category: "セラピスト", requiresManager: true },
  { icon: "📨", label: "通知ダッシュボード",    path: "/admin/notification-dashboard",       category: "セラピスト", requiresManager: true },

  // ── スタッフ ──
  { icon: "📊", label: "スタッフ勤怠",  path: "/admin/staff-attendance",  category: "スタッフ" },
  { icon: "👥", label: "スタッフ設定",  path: "/admin/staff",  category: "スタッフ" },

  // ── その他 ──
  { icon: "📺", label: "カメラ・ロック管理", path: "/admin/camera",        category: "その他" },
  { icon: "📡", label: "IoTデバイス設定",   path: "/admin/iot-settings",  category: "その他" },
  { icon: "📞", label: "CTI監視",          path: "/admin/cti-monitor",   category: "その他", requiresManager: true },
  { icon: "🤖", label: "HPチャットBOT",    path: "/admin/hp-chatbot-admin", category: "その他", requiresManager: true },
  { icon: "📸", label: "HP写真管理",       path: "/admin/hp-photos-admin", category: "その他", requiresManager: true },
  { icon: "🧠", label: "チャット分析",       path: "/admin/chat-insights",   category: "その他", requiresManager: true },

  // ── 登録・設定 ──
  { icon: "📋", label: "コース登録",    path: "/admin/courses",           category: "登録・設定" },
  { icon: "🔑", label: "利用場所登録",  path: "/admin/rooms",             category: "登録・設定" },
  { icon: "📱", label: "電話番号バックアップ", path: "/admin/contact-sync", category: "登録・設定" },
  { icon: "🌐", label: "WEB予約公開設定", path: "/admin/web-booking-settings", category: "登録・設定" },
  { icon: "⚙️", label: "サービス設定",  path: "/admin/service-settings",  category: "登録・設定" },
  { icon: "🛠️", label: "システム設定",  path: "/admin/system-setup",      category: "登録・設定" },

  // ── マニュアル ──
  { icon: "📖", label: "操作マニュアル", path: "/admin/operations-manual", category: "マニュアル" },
];

// ── サイドバー本体 ─────────────────────────────────

function SidebarPortal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const { canAccessTaxPortal, canAccessCashDashboard, canAccessCallAssistant, isManager } = useStaffSession();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted || !open) return null;

  // 権限に応じてメニューをフィルタリング
  const visibleItems = NAV_ITEMS.filter(item => {
    if (item.requiresTaxPortal && !canAccessTaxPortal) return false;
    if (item.requiresCashDashboard && !canAccessCashDashboard) return false;
    if (item.requiresManager && !isManager) return false;
    if (item.requiresCallAssistant && !canAccessCallAssistant) return false;
    return true;
  });

  const handleClick = (item: NavItem) => {
    if (item.path.startsWith("DASHBOARD_PAGE:")) {
      const page = item.path.split(":")[1];
      const onDashboard = window.location.pathname === "/admin/dashboard"
        || window.location.pathname === "/dashboard";
      if (onDashboard) {
        window.dispatchEvent(new CustomEvent("dashboardPage", { detail: page }));
      } else {
        router.push(`/admin/dashboard?page=${encodeURIComponent(page)}`);
      }
    } else {
      router.push(item.path);
    }
    onClose();
  };

  // カテゴリ境目を判定して見出しを表示
  let lastCategory = "";

  return createPortal(
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 99999 }}>
      {/* オーバーレイ */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)" }} onClick={onClose} />

      {/* サイドバー */}
      <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: 260, backgroundColor: "#1a1a2e", display: "flex", flexDirection: "column", boxShadow: "4px 0 20px rgba(0,0,0,0.3)" }}>

        {/* ヘッダー */}
        <div style={{ height: 64, display: "flex", alignItems: "center", padding: "0 20px", borderBottom: "1px solid rgba(255,255,255,0.04)", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1 }}>
            <div style={{ width: 32, height: 32, backgroundColor: "#c96b83", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ color: "white", fontSize: 12, fontWeight: 600 }}>C</span>
            </div>
            <div>
              <p style={{ fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,0.9)", margin: 0 }}>Ange Spa</p>
              <p style={{ fontSize: 8, color: "rgba(255,255,255,0.25)", letterSpacing: 2, margin: 0 }}>SALON MANAGEMENT</p>
            </div>
          </div>
          <button onClick={onClose} style={{ color: "rgba(255,255,255,0.3)", cursor: "pointer", padding: 4, fontSize: 18, background: "none", border: "none", lineHeight: 1 }}>✕</button>
        </div>

        {/* メニュー一覧 */}
        <div style={{ flex: 1, overflowY: "auto", padding: "8px 12px 16px" }}>
          {visibleItems.map((item) => {
            const showCategory = item.category !== lastCategory;
            lastCategory = item.category;
            return (
              <div key={item.label}>
                {showCategory && (
                  <p style={{
                    fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.25)",
                    letterSpacing: 1.5, margin: "14px 0 4px 12px",
                  }}>
                    {item.category}
                  </p>
                )}
                <button
                  onClick={() => handleClick(item)}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", gap: 12,
                    padding: "10px 12px", fontSize: 13, borderRadius: 8, cursor: "pointer",
                    color: "rgba(255,255,255,0.6)", background: "none", border: "none",
                    textAlign: "left", marginBottom: 2,
                  }}
                >
                  <span style={{ fontSize: 16, width: 24, textAlign: "center" }}>{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── ハンバーガーボタン（エクスポート） ──────────────

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
