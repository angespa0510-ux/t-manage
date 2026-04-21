"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SITE } from "../../lib/site-theme";

/**
 * Ange Spa 公式HP 共通ヘッダー
 *
 * 方針（■19・■20 準拠）:
 *  - 絵文字・三本線アイコン非使用（「メニュー」テキスト）
 *  - 白基調、細い罫線のみ、影ほぼなし
 *  - 明朝体（Noto Serif JP）
 *  - 活性状態はピンクの下線で表現
 */

const NAV_ITEMS = [
  { label: "トップ",           en: "HOME",       path: "/" },
  { label: "料金",             en: "SYSTEM",     path: "/system" },
  { label: "セラピスト",       en: "THERAPIST",  path: "/therapist" },
  { label: "スケジュール",     en: "SCHEDULE",   path: "/schedule" },
  { label: "アクセス",         en: "ACCESS",     path: "/access" },
  { label: "求人",             en: "RECRUIT",    path: "/recruit" },
];

const SUB_NAV_ITEMS = [
  { label: "WEB予約",       path: "/schedule" },
  { label: "お問い合わせ",  path: "/contact" },
  { label: "会員ページ",    path: "/customer-mypage" },
];

const TEL_PRIMARY   = "070-1675-5900";
const TEL_SECONDARY = "080-9486-2282";
const LINE_URL      = "https://lin.ee/tJtwJL9";

export default function SiteHeader() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  const isActive = (path: string) => {
    if (path === "/") return pathname === "/";
    return pathname.startsWith(path);
  };

  return (
    <>
      <header
        className="site-header"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: SITE.z.sticky,
          height: SITE.layout.headerHeightSp,
          backgroundColor: scrolled ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.75)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          borderBottom: scrolled ? `1px solid ${SITE.color.border}` : "1px solid transparent",
          transition: SITE.transition.base,
        }}
      >
        <div
          style={{
            maxWidth: SITE.layout.maxWidth,
            height: "100%",
            margin: "0 auto",
            padding: "0 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
          }}
        >
          {/* ── ロゴ（画像） ── */}
          <Link
            href="/"
            style={{
              display: "flex",
              alignItems: "center",
              textDecoration: "none",
              color: SITE.color.text,
              height: "100%",
              padding: "6px 0",
            }}
            aria-label="Ange Spa トップページ"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo/ange-spa-logo.png"
              alt="Ange Spa"
              style={{
                height: "100%",
                width: "auto",
                maxHeight: 44,
                objectFit: "contain",
                display: "block",
              }}
              className="site-header-logo"
            />
          </Link>

          {/* ── デスクトップナビ ── */}
          <nav className="site-header-nav" style={{ display: "none" }}>
            {NAV_ITEMS.map((item) => {
              const active = isActive(item.path);
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  style={{
                    display: "inline-block",
                    padding: "0 14px",
                    lineHeight: SITE.layout.headerHeight,
                    textDecoration: "none",
                    color: active ? SITE.color.pink : SITE.color.text,
                    fontSize: "13px",
                    fontFamily: SITE.font.serif,
                    fontWeight: 500,
                    letterSpacing: SITE.ls.loose,
                    borderBottom: active
                      ? `1px solid ${SITE.color.pink}`
                      : "1px solid transparent",
                    transition: SITE.transition.fast,
                  }}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* ── 右端アクション（メニューボタン） ── */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <a
              href={`tel:${TEL_PRIMARY}`}
              className="site-header-tel"
              style={{
                display: "none",
                alignItems: "center",
                padding: "8px 18px",
                border: `1px solid ${SITE.color.pink}`,
                color: SITE.color.pink,
                fontSize: "12px",
                fontFamily: SITE.font.display,
                letterSpacing: SITE.ls.loose,
                textDecoration: "none",
                transition: SITE.transition.fast,
              }}
            >
              {TEL_PRIMARY}
            </a>

            <button
              onClick={() => setMenuOpen(true)}
              aria-label="メニューを開く"
              style={{
                padding: "10px 18px",
                background: "transparent",
                border: `1px solid ${SITE.color.border}`,
                color: SITE.color.text,
                fontFamily: SITE.font.serif,
                fontSize: "11px",
                letterSpacing: SITE.ls.loose,
                cursor: "pointer",
                lineHeight: 1,
                transition: SITE.transition.fast,
              }}
            >
              メニュー
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
            background: "rgba(255,255,255,0.98)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            animation: "siteFade 0.3s ease",
            overflowY: "auto",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: "560px",
              margin: "0 auto",
              padding: "24px 28px 64px",
              minHeight: "100vh",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* クローズ */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 56,
                paddingBottom: 16,
                borderBottom: `1px solid ${SITE.color.border}`,
              }}
            >
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  height: 40,
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/logo/ange-spa-logo.png"
                  alt="Ange Spa"
                  style={{
                    height: "100%",
                    width: "auto",
                    objectFit: "contain",
                    display: "block",
                  }}
                />
              </span>
              <button
                onClick={() => setMenuOpen(false)}
                aria-label="メニューを閉じる"
                style={{
                  padding: "8px 16px",
                  background: "transparent",
                  border: `1px solid ${SITE.color.border}`,
                  color: SITE.color.text,
                  fontFamily: SITE.font.serif,
                  fontSize: "11px",
                  letterSpacing: SITE.ls.loose,
                  cursor: "pointer",
                  lineHeight: 1,
                }}
              >
                閉じる
              </button>
            </div>

            {/* メインナビ */}
            <nav style={{ display: "flex", flexDirection: "column" }}>
              {NAV_ITEMS.map((item, i) => (
                <Link
                  key={item.path}
                  href={item.path}
                  onClick={() => setMenuOpen(false)}
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    justifyContent: "space-between",
                    padding: "22px 0",
                    borderBottom: `1px solid ${SITE.color.borderSoft}`,
                    color: isActive(item.path) ? SITE.color.pink : SITE.color.text,
                    textDecoration: "none",
                    animation: `siteSlideIn 0.4s ease ${i * 0.04}s backwards`,
                  }}
                >
                  <span
                    style={{
                      fontFamily: SITE.font.serif,
                      fontSize: "22px",
                      fontWeight: 500,
                      letterSpacing: SITE.ls.loose,
                    }}
                  >
                    {item.label}
                  </span>
                  <span
                    style={{
                      fontFamily: SITE.font.display,
                      fontSize: "11px",
                      letterSpacing: SITE.ls.wide,
                      color: SITE.color.textMuted,
                    }}
                  >
                    {item.en}
                  </span>
                </Link>
              ))}
            </nav>

            {/* サブナビ */}
            <div style={{ marginTop: 40, display: "flex", flexDirection: "column", gap: 2 }}>
              {SUB_NAV_ITEMS.map((item) => (
                <Link
                  key={item.path}
                  href={item.path}
                  onClick={() => setMenuOpen(false)}
                  style={{
                    padding: "12px 0",
                    color: SITE.color.textSub,
                    textDecoration: "none",
                    fontSize: "13px",
                    fontFamily: SITE.font.serif,
                    letterSpacing: SITE.ls.loose,
                  }}
                >
                  {item.label}
                </Link>
              ))}
            </div>

            {/* CTAブロック */}
            <div
              style={{
                marginTop: 48,
                paddingTop: 32,
                borderTop: `1px solid ${SITE.color.border}`,
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              <a
                href={`tel:${TEL_PRIMARY}`}
                style={{
                  display: "block",
                  padding: "18px 24px",
                  background: SITE.color.pink,
                  color: "#ffffff",
                  textDecoration: "none",
                  textAlign: "center",
                  fontFamily: SITE.font.display,
                  fontSize: "15px",
                  letterSpacing: SITE.ls.wide,
                }}
              >
                電話 {TEL_PRIMARY}
              </a>
              <a
                href={`tel:${TEL_SECONDARY}`}
                style={{
                  display: "block",
                  padding: "16px 24px",
                  background: "transparent",
                  border: `1px solid ${SITE.color.pink}`,
                  color: SITE.color.pink,
                  textDecoration: "none",
                  textAlign: "center",
                  fontFamily: SITE.font.display,
                  fontSize: "14px",
                  letterSpacing: SITE.ls.loose,
                }}
              >
                予備回線 {TEL_SECONDARY}
              </a>
              <a
                href={LINE_URL}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "block",
                  padding: "16px 24px",
                  background: "transparent",
                  border: `1px solid ${SITE.color.border}`,
                  color: SITE.color.text,
                  textDecoration: "none",
                  textAlign: "center",
                  fontFamily: SITE.font.serif,
                  fontSize: "13px",
                  letterSpacing: SITE.ls.loose,
                }}
              >
                LINEで予約・相談
              </a>
              <p
                style={{
                  marginTop: 16,
                  fontSize: "11px",
                  color: SITE.color.textMuted,
                  textAlign: "center",
                  lineHeight: SITE.lh.body,
                  letterSpacing: SITE.ls.normal,
                }}
              >
                営業時間 12:00 — 深夜 27:00<br />
                最終受付 26:00（電話受付 11:00〜）
              </p>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes siteFade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes siteSlideIn {
          from { opacity: 0; transform: translateY(-6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @media (min-width: 768px) {
          .site-header {
            height: ${SITE.layout.headerHeight} !important;
          }
          .site-header-logo {
            max-height: 52px !important;
          }
          .site-header-nav {
            display: flex !important;
            align-items: center;
          }
          .site-header-tel {
            display: inline-flex !important;
          }
        }
        .site-header a:hover,
        .site-header button:hover {
          color: ${SITE.color.pink} !important;
          border-color: ${SITE.color.pink} !important;
        }
      `}</style>
    </>
  );
}
