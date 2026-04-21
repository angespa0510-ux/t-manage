"use client";

import Link from "next/link";
import { SITE } from "../../lib/site-theme";

/**
 * Ange Spa 公式HP 共通フッター
 *
 * - ナビ再掲（SEO / ユーザビリティ）
 * - 店舗情報（NAP: Name / Address / Phone）
 * - 特商法・プライバシー等のリーガルリンク
 * - 著作権表記
 */

const FOOTER_NAV = [
  { en: "HOME",      jp: "トップ",        path: "/" },
  { en: "SYSTEM",    jp: "料金",          path: "/system" },
  { en: "THERAPIST", jp: "セラピスト",    path: "/therapist" },
  { en: "SCHEDULE",  jp: "スケジュール",  path: "/schedule" },
  { en: "ACCESS",    jp: "アクセス",      path: "/access" },
  { en: "RECRUIT",   jp: "求人",          path: "/recruit" },
];

const LEGAL_NAV = [
  { label: "特定商取引法",       path: "/corporate/legal" },
  { label: "プライバシーポリシー", path: "/corporate/privacy" },
  { label: "会員ページ",          path: "/customer-mypage" },
];

const TEL_PRIMARY = "070-1675-5900";
const TEL_SECONDARY = "080-9486-2282";

export default function SiteFooter() {
  return (
    <footer
      style={{
        marginTop: SITE.sp.xxxl,
        paddingTop: SITE.sp.xxl,
        paddingBottom: SITE.sp.xl,
        background: `linear-gradient(180deg, transparent 0%, rgba(15,10,13,0.8) 100%)`,
        borderTop: `1px solid ${SITE.color.borderSoft}`,
      }}
    >
      <div
        style={{
          maxWidth: SITE.layout.maxWidth,
          margin: "0 auto",
          padding: `0 ${SITE.sp.md}`,
        }}
      >
        {/* ── 上段: ロゴ + ナビ ── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr",
            gap: SITE.sp.xl,
            paddingBottom: SITE.sp.xl,
            borderBottom: `1px solid ${SITE.color.borderSoft}`,
          }}
          className="site-footer-grid"
        >
          {/* ロゴ + キャッチ */}
          <div>
            <div
              style={{
                fontFamily: SITE.font.display,
                fontSize: "28px",
                fontWeight: 600,
                letterSpacing: "0.08em",
                color: SITE.color.pink,
                lineHeight: 1,
                marginBottom: "12px",
              }}
            >
              Ange Spa
            </div>
            <p
              style={{
                fontFamily: SITE.font.serif,
                fontSize: "13px",
                color: SITE.color.textSub,
                letterSpacing: "0.05em",
                lineHeight: 1.8,
                marginBottom: SITE.sp.md,
              }}
            >
              可愛らしい女の子と<br />
              癒しのひと時を。
            </p>
            <p
              style={{
                fontSize: "11px",
                color: SITE.color.textMuted,
                lineHeight: 1.8,
              }}
            >
              名古屋・三河安城・豊橋エリアの<br />
              メンズリラクゼーションサロン
            </p>
          </div>

          {/* ナビ */}
          <div>
            <h3
              style={{
                fontFamily: SITE.font.display,
                fontSize: "12px",
                letterSpacing: "0.15em",
                color: SITE.color.pink,
                marginBottom: SITE.sp.md,
              }}
            >
              MENU
            </h3>
            <ul
              style={{
                listStyle: "none",
                padding: 0,
                margin: 0,
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "10px 20px",
              }}
            >
              {FOOTER_NAV.map((item) => (
                <li key={item.path}>
                  <Link
                    href={item.path}
                    style={{
                      color: SITE.color.text,
                      textDecoration: "none",
                      fontSize: "12px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "2px",
                      transition: SITE.transition.fast,
                    }}
                  >
                    <span
                      style={{
                        fontFamily: SITE.font.display,
                        letterSpacing: "0.1em",
                      }}
                    >
                      {item.en}
                    </span>
                    <span style={{ fontSize: "10px", color: SITE.color.textMuted }}>
                      {item.jp}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* 連絡先 */}
          <div>
            <h3
              style={{
                fontFamily: SITE.font.display,
                fontSize: "12px",
                letterSpacing: "0.15em",
                color: SITE.color.pink,
                marginBottom: SITE.sp.md,
              }}
            >
              CONTACT
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <a
                href={`tel:${TEL_PRIMARY}`}
                style={{
                  fontFamily: SITE.font.display,
                  fontSize: "18px",
                  color: SITE.color.text,
                  textDecoration: "none",
                  letterSpacing: "0.05em",
                }}
              >
                📞 {TEL_PRIMARY}
              </a>
              <a
                href={`tel:${TEL_SECONDARY}`}
                style={{
                  fontFamily: SITE.font.display,
                  fontSize: "14px",
                  color: SITE.color.textSub,
                  textDecoration: "none",
                  letterSpacing: "0.05em",
                }}
              >
                📞 {TEL_SECONDARY}
                <span
                  style={{
                    fontSize: "10px",
                    color: SITE.color.textMuted,
                    marginLeft: "6px",
                  }}
                >
                  予備回線
                </span>
              </a>
              <p
                style={{
                  fontSize: "11px",
                  color: SITE.color.textMuted,
                  marginTop: "8px",
                  lineHeight: 1.8,
                }}
              >
                営業時間 12:00 – 深夜27:00<br />
                最終受付 26:00（電話 11:00 –）
              </p>
            </div>
          </div>
        </div>

        {/* ── 中段: リーガルリンク ── */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "20px",
            justifyContent: "center",
            padding: `${SITE.sp.lg} 0`,
          }}
        >
          {LEGAL_NAV.map((item) => (
            <Link
              key={item.path}
              href={item.path}
              style={{
                color: SITE.color.textSub,
                fontSize: "11px",
                textDecoration: "none",
                transition: SITE.transition.fast,
              }}
            >
              {item.label}
            </Link>
          ))}
          <Link
            href="/staff-login"
            style={{
              color: SITE.color.textFaint,
              fontSize: "10px",
              textDecoration: "none",
              transition: SITE.transition.fast,
              letterSpacing: "0.1em",
            }}
          >
            STAFF
          </Link>
        </div>

        {/* ── 下段: 18禁 + 著作権 ── */}
        <div
          style={{
            textAlign: "center",
            paddingTop: SITE.sp.md,
            borderTop: `1px solid ${SITE.color.borderSoft}`,
          }}
        >
          <p
            style={{
              fontSize: "10px",
              color: SITE.color.textMuted,
              letterSpacing: "0.1em",
              marginBottom: "8px",
            }}
          >
            © {new Date().getFullYear()} Ange Spa〜アンジュスパ. All rights reserved.
          </p>
        </div>
      </div>

      <style>{`
        @media (min-width: 768px) {
          .site-footer-grid {
            grid-template-columns: 1.5fr 1fr 1fr !important;
          }
        }
        footer a:hover {
          color: ${SITE.color.pink} !important;
        }
      `}</style>
    </footer>
  );
}
