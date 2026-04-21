"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SITE } from "../../lib/site-theme";

/**
 * Ange Spa 公式HP 共通ヘッダー
 *
 * デスクトップ: 横並びナビ + 右端に電話/LINE ボタン
 * モバイル: ハンバーガーメニュー（開くとフルスクリーンドロワー）
 *
 * スクロール時に半透明黒背景 + blur が乗って視認性を確保
 */

// ─── ナビ項目定義 ─────────────────────────────────
const NAV_ITEMS = [
  { en: "HOME",       jp: "トップ",           path: "/" },
  { en: "SYSTEM",     jp: "料金",             path: "/system" },
  { en: "THERAPIST",  jp: "セラピスト",       path: "/therapist" },
  { en: "SCHEDULE",   jp: "スケジュール",     path: "/schedule" },
  { en: "ACCESS",     jp: "アクセス",         path: "/access" },
  { en: "RECRUIT",    jp: "求人",             path: "/recruit" },
];

// サブナビ（ハンバーガー内のみ）
const SUB_NAV_ITEMS = [
  { en: "RESERVE",      jp: "WEB予約",       path: "/schedule" },
  { en: "CONTACT",      jp: "お問い合わせ",  path: "/contact" },
  { en: "MEMBER",       jp: "会員ページ",    path: "/customer-mypage" },
];

// 電話番号（DBから取るのはコミット #6 以降）
const TEL_PRIMARY = "070-1675-5900";
const TEL_SECONDARY = "080-9486-2282";
const LINE_URL = "https://lin.ee/tJtwJL9";

export default function SiteHeader() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // スクロール検知
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // メニュー開いてる時はbodyスクロール停止
  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  // ※ メニューのクローズは各 Link の onClick で実施（pathname 監視不要）

  const isActive = (path: string) => {
    if (path === "/") return pathname === "/";
    return pathname.startsWith(path);
  };

  return (
    <>
      {/* ── デスクトップ + モバイル共通ヘッダー ── */}
      <header
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: SITE.z.sticky,
          height: SITE.layout.headerHeightSp,
          backgroundColor: scrolled ? "rgba(15,10,13,0.85)" : "transparent",
          backdropFilter: scrolled ? "blur(16px)" : "none",
          WebkitBackdropFilter: scrolled ? "blur(16px)" : "none",
          borderBottom: scrolled ? `1px solid ${SITE.color.borderSoft}` : "1px solid transparent",
          transition: SITE.transition.base,
        }}
        className="site-header"
      >
        <div
          style={{
            maxWidth: SITE.layout.maxWidth,
            height: "100%",
            margin: "0 auto",
            padding: "0 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: SITE.sp.md,
          }}
        >
          {/* ── ロゴ ── */}
          <Link
            href="/"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              textDecoration: "none",
              color: SITE.color.text,
            }}
          >
            <span
              style={{
                fontFamily: SITE.font.display,
                fontSize: "22px",
                fontWeight: 600,
                letterSpacing: "0.08em",
                color: SITE.color.pink,
                lineHeight: 1,
              }}
            >
              Ange Spa
            </span>
            <span
              style={{
                fontFamily: SITE.font.serif,
                fontSize: "10px",
                color: SITE.color.textSub,
                letterSpacing: "0.1em",
                lineHeight: 1,
                display: "none",
              }}
              className="site-header-sub"
            >
              アンジュスパ
            </span>
          </Link>

          {/* ── デスクトップナビ（md以上で表示） ── */}
          <nav className="site-header-nav" style={{ display: "none" }}>
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.path}
                href={item.path}
                style={{
                  display: "inline-flex",
                  flexDirection: "column",
                  alignItems: "center",
                  padding: "0 12px",
                  textDecoration: "none",
                  color: isActive(item.path) ? SITE.color.pink : SITE.color.text,
                  transition: SITE.transition.fast,
                  borderBottom: isActive(item.path)
                    ? `2px solid ${SITE.color.pink}`
                    : "2px solid transparent",
                  height: SITE.layout.headerHeight,
                  justifyContent: "center",
                }}
              >
                <span
                  style={{
                    fontFamily: SITE.font.display,
                    fontSize: "12px",
                    letterSpacing: "0.15em",
                    fontWeight: 500,
                  }}
                >
                  {item.en}
                </span>
                <span
                  style={{
                    fontSize: "9px",
                    marginTop: "2px",
                    letterSpacing: "0.1em",
                    color: SITE.color.textMuted,
                  }}
                >
                  {item.jp}
                </span>
              </Link>
            ))}
          </nav>

          {/* ── 右端アクション ── */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {/* TEL（デスクトップのみ） */}
            <a
              href={`tel:${TEL_PRIMARY}`}
              className="site-header-tel"
              style={{
                display: "none",
                alignItems: "center",
                gap: "6px",
                padding: "8px 14px",
                borderRadius: SITE.radius.pill,
                border: `1px solid ${SITE.color.pink}66`,
                color: SITE.color.pink,
                fontSize: "12px",
                fontWeight: 500,
                textDecoration: "none",
                letterSpacing: "0.05em",
                transition: SITE.transition.fast,
              }}
            >
              <span>📞</span>
              <span style={{ fontFamily: SITE.font.display }}>{TEL_PRIMARY}</span>
            </a>

            {/* LINE（デスクトップのみ） */}
            <a
              href={LINE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="site-header-line"
              style={{
                display: "none",
                alignItems: "center",
                gap: "6px",
                padding: "8px 14px",
                borderRadius: SITE.radius.pill,
                background: "#06c755",
                color: "#fff",
                fontSize: "12px",
                fontWeight: 500,
                textDecoration: "none",
                letterSpacing: "0.05em",
                transition: SITE.transition.fast,
              }}
            >
              <span>💬</span>
              <span>LINE</span>
            </a>

            {/* ハンバーガーボタン（モバイル・デスクトップ両方） */}
            <button
              onClick={() => setMenuOpen(true)}
              aria-label="メニューを開く"
              style={{
                width: "42px",
                height: "42px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "5px",
                background: "transparent",
                border: `1px solid ${SITE.color.border}`,
                borderRadius: SITE.radius.md,
                cursor: "pointer",
                padding: 0,
              }}
            >
              <span
                style={{
                  width: "18px",
                  height: "1px",
                  backgroundColor: SITE.color.pink,
                  display: "block",
                }}
              />
              <span
                style={{
                  width: "18px",
                  height: "1px",
                  backgroundColor: SITE.color.pink,
                  display: "block",
                }}
              />
              <span
                style={{
                  width: "18px",
                  height: "1px",
                  backgroundColor: SITE.color.pink,
                  display: "block",
                }}
              />
            </button>
          </div>
        </div>
      </header>

      {/* ── フルスクリーンドロワー ── */}
      {menuOpen && (
        <div
          onClick={() => setMenuOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: SITE.z.modal,
            background: "rgba(15,10,13,0.97)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            animation: "site-fade-in 0.3s ease",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: "520px",
              margin: "0 auto",
              padding: "24px",
              minHeight: "100vh",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* クローズボタン */}
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "32px" }}>
              <button
                onClick={() => setMenuOpen(false)}
                aria-label="メニューを閉じる"
                style={{
                  width: "42px",
                  height: "42px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "transparent",
                  border: `1px solid ${SITE.color.border}`,
                  borderRadius: SITE.radius.md,
                  color: SITE.color.pink,
                  fontSize: "20px",
                  cursor: "pointer",
                }}
              >
                ✕
              </button>
            </div>

            {/* メインナビ */}
            <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: "4px" }}>
              {NAV_ITEMS.map((item, i) => (
                <Link
                  key={item.path}
                  href={item.path}
                  onClick={() => setMenuOpen(false)}
                  style={{
                    padding: "20px 16px",
                    borderBottom: `1px solid ${SITE.color.borderSoft}`,
                    color: isActive(item.path) ? SITE.color.pink : SITE.color.text,
                    textDecoration: "none",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    animation: `site-slide-in 0.4s ease ${i * 0.05}s backwards`,
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <span
                      style={{
                        fontFamily: SITE.font.display,
                        fontSize: "22px",
                        letterSpacing: "0.12em",
                        fontWeight: 500,
                      }}
                    >
                      {item.en}
                    </span>
                    <span
                      style={{
                        fontSize: "11px",
                        letterSpacing: "0.08em",
                        color: SITE.color.textSub,
                      }}
                    >
                      {item.jp}
                    </span>
                  </div>
                  <span style={{ color: SITE.color.pink, fontSize: "14px" }}>→</span>
                </Link>
              ))}

              {/* サブナビ */}
              <div style={{ marginTop: "32px", paddingTop: "20px", borderTop: `1px solid ${SITE.color.border}` }}>
                {SUB_NAV_ITEMS.map((item) => (
                  <Link
                    key={item.path}
                    href={item.path}
                    onClick={() => setMenuOpen(false)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "14px 16px",
                      color: SITE.color.textSub,
                      textDecoration: "none",
                      fontSize: "13px",
                    }}
                  >
                    <span style={{ fontFamily: SITE.font.display, letterSpacing: "0.1em" }}>
                      {item.en}
                    </span>
                    <span style={{ fontSize: "11px" }}>{item.jp}</span>
                  </Link>
                ))}
              </div>
            </nav>

            {/* CTA ボタン群 */}
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "24px" }}>
              <a
                href={`tel:${TEL_PRIMARY}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  padding: "16px",
                  borderRadius: SITE.radius.md,
                  background: `linear-gradient(135deg, ${SITE.color.pink} 0%, ${SITE.color.pinkDeep} 100%)`,
                  color: "#fff",
                  textDecoration: "none",
                  fontWeight: 600,
                  fontSize: "15px",
                  boxShadow: SITE.shadow.pink,
                }}
              >
                <span>📞</span>
                <span style={{ fontFamily: SITE.font.display, letterSpacing: "0.05em" }}>
                  {TEL_PRIMARY}
                </span>
              </a>
              <a
                href={`tel:${TEL_SECONDARY}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  padding: "14px",
                  borderRadius: SITE.radius.md,
                  background: "transparent",
                  border: `1px solid ${SITE.color.pink}66`,
                  color: SITE.color.pink,
                  textDecoration: "none",
                  fontSize: "13px",
                }}
              >
                <span>📞</span>
                <span style={{ fontFamily: SITE.font.display }}>
                  {TEL_SECONDARY}
                </span>
                <span style={{ fontSize: "10px", color: SITE.color.textMuted, marginLeft: "4px" }}>
                  予備回線
                </span>
              </a>
              <a
                href={LINE_URL}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  padding: "14px",
                  borderRadius: SITE.radius.md,
                  background: "#06c755",
                  color: "#fff",
                  textDecoration: "none",
                  fontWeight: 600,
                  fontSize: "14px",
                }}
              >
                <span>💬</span>
                <span>LINE で予約・相談</span>
              </a>
            </div>

            {/* 営業時間 */}
            <p
              style={{
                marginTop: "20px",
                fontSize: "10px",
                color: SITE.color.textMuted,
                textAlign: "center",
                letterSpacing: "0.08em",
              }}
            >
              営業時間 12:00 – 深夜27:00 ／ 最終受付 26:00
            </p>
          </div>
        </div>
      )}

      {/* ── レスポンシブ CSS（scoped） ── */}
      <style>{`
        @keyframes site-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes site-slide-in {
          from { opacity: 0; transform: translateX(-10px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @media (min-width: 768px) {
          .site-header {
            height: ${SITE.layout.headerHeight} !important;
          }
          .site-header-sub {
            display: inline !important;
          }
          .site-header-nav {
            display: flex !important;
            align-items: center;
          }
          .site-header-tel,
          .site-header-line {
            display: inline-flex !important;
          }
        }
      `}</style>
    </>
  );
}
