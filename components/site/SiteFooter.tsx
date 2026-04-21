"use client";

import Link from "next/link";
import { SITE } from "../../lib/site-theme";

/**
 * Ange Spa 公式HP 共通フッター
 *
 * 方針（■19・■20 準拠）:
 *  - 絵文字非使用、SNSはテキストリンク
 *  - 店舗情報は「住所：／電話：／営業：」のラベル方式
 *  - 白基調、細い罫線
 */

const FOOTER_NAV = [
  { label: "トップ",       path: "/" },
  { label: "料金",         path: "/system" },
  { label: "セラピスト",   path: "/therapist" },
  { label: "スケジュール", path: "/schedule" },
  { label: "アクセス",     path: "/access" },
  { label: "求人",         path: "/recruit" },
];

const LEGAL_NAV = [
  { label: "特定商取引法",        path: "/corporate/legal" },
  { label: "プライバシーポリシー", path: "/corporate/privacy" },
  { label: "会員ページ",           path: "/customer-mypage" },
  { label: "STAFF",                path: "/staff-login" },
];

const TEL_PRIMARY   = "070-1675-5900";
const TEL_SECONDARY = "080-9486-2282";

export default function SiteFooter() {
  return (
    <footer
      style={{
        marginTop: SITE.sp.section,
        paddingTop: SITE.sp.xxl,
        paddingBottom: SITE.sp.xl,
        background: SITE.color.bgSoft,
        borderTop: `1px solid ${SITE.color.border}`,
      }}
    >
      <div
        style={{
          maxWidth: SITE.layout.maxWidth,
          margin: "0 auto",
          padding: `0 ${SITE.sp.lg}`,
        }}
      >
        {/* ── 上段: ロゴ / ナビ / 連絡先 ── */}
        <div
          className="site-footer-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr",
            gap: SITE.sp.xl,
            paddingBottom: SITE.sp.xl,
            borderBottom: `1px solid ${SITE.color.border}`,
          }}
        >
          {/* ロゴ + キャッチ */}
          <div>
            <div
              style={{
                fontFamily: SITE.font.display,
                fontSize: "26px",
                fontWeight: 500,
                letterSpacing: SITE.ls.loose,
                color: SITE.color.pink,
                lineHeight: 1,
                marginBottom: 12,
              }}
            >
              Ange Spa
            </div>
            <p
              style={{
                fontFamily: SITE.font.serif,
                fontSize: "13px",
                color: SITE.color.textSub,
                letterSpacing: SITE.ls.normal,
                lineHeight: SITE.lh.body,
                marginBottom: SITE.sp.md,
              }}
            >
              可愛らしい女の子と<br />
              癒しのひと時を、、
            </p>
            <p
              style={{
                fontSize: "11px",
                color: SITE.color.textMuted,
                lineHeight: SITE.lh.body,
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
                fontSize: "11px",
                letterSpacing: SITE.ls.wide,
                color: SITE.color.pink,
                marginBottom: SITE.sp.md,
                fontWeight: 500,
              }}
            >
              MENU
            </h3>
            <ul
              style={{
                listStyle: "none",
                padding: 0,
                margin: 0,
                display: "flex",
                flexDirection: "column",
                gap: "12px",
              }}
            >
              {FOOTER_NAV.map((item) => (
                <li key={item.path}>
                  <Link
                    href={item.path}
                    style={{
                      color: SITE.color.text,
                      textDecoration: "none",
                      fontSize: "13px",
                      fontFamily: SITE.font.serif,
                      letterSpacing: SITE.ls.loose,
                      transition: SITE.transition.fast,
                    }}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* 連絡先（ラベル方式、絵文字なし） */}
          <div>
            <h3
              style={{
                fontFamily: SITE.font.display,
                fontSize: "11px",
                letterSpacing: SITE.ls.wide,
                color: SITE.color.pink,
                marginBottom: SITE.sp.md,
                fontWeight: 500,
              }}
            >
              CONTACT
            </h3>
            <dl style={{ margin: 0, padding: 0 }}>
              <dt
                style={{
                  fontSize: "11px",
                  color: SITE.color.textMuted,
                  letterSpacing: SITE.ls.loose,
                  marginBottom: 4,
                }}
              >
                電話：
              </dt>
              <dd style={{ margin: "0 0 10px 0" }}>
                <a
                  href={`tel:${TEL_PRIMARY}`}
                  style={{
                    fontFamily: SITE.font.display,
                    fontSize: "18px",
                    color: SITE.color.text,
                    textDecoration: "none",
                    letterSpacing: SITE.ls.loose,
                    lineHeight: 1.4,
                  }}
                >
                  {TEL_PRIMARY}
                </a>
              </dd>
              <dt
                style={{
                  fontSize: "11px",
                  color: SITE.color.textMuted,
                  letterSpacing: SITE.ls.loose,
                  marginBottom: 4,
                }}
              >
                予備回線：
              </dt>
              <dd style={{ margin: "0 0 16px 0" }}>
                <a
                  href={`tel:${TEL_SECONDARY}`}
                  style={{
                    fontFamily: SITE.font.display,
                    fontSize: "14px",
                    color: SITE.color.textSub,
                    textDecoration: "none",
                    letterSpacing: SITE.ls.loose,
                  }}
                >
                  {TEL_SECONDARY}
                </a>
              </dd>
              <dt
                style={{
                  fontSize: "11px",
                  color: SITE.color.textMuted,
                  letterSpacing: SITE.ls.loose,
                  marginBottom: 4,
                }}
              >
                営業：
              </dt>
              <dd
                style={{
                  margin: 0,
                  fontSize: "12px",
                  color: SITE.color.textSub,
                  lineHeight: SITE.lh.body,
                }}
              >
                12:00 — 深夜 27:00<br />
                最終受付 26:00
              </dd>
            </dl>
          </div>
        </div>

        {/* ── 中段: リーガルリンク ── */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "16px 28px",
            justifyContent: "center",
            padding: `${SITE.sp.lg} 0`,
          }}
        >
          {LEGAL_NAV.map((item) => (
            <Link
              key={item.path}
              href={item.path}
              style={{
                color: SITE.color.textMuted,
                fontSize: "11px",
                textDecoration: "none",
                fontFamily: SITE.font.serif,
                letterSpacing: SITE.ls.loose,
                transition: SITE.transition.fast,
              }}
            >
              {item.label}
            </Link>
          ))}
        </div>

        {/* ── 下段: 著作権表記 ── */}
        <div
          style={{
            textAlign: "center",
            paddingTop: SITE.sp.md,
            borderTop: `1px solid ${SITE.color.borderSoft}`,
          }}
        >
          <p
            style={{
              fontFamily: SITE.font.display,
              fontSize: "10px",
              color: SITE.color.textMuted,
              letterSpacing: SITE.ls.wide,
            }}
          >
            &copy; {new Date().getFullYear()} Ange Spa. All rights reserved.
          </p>
        </div>
      </div>

      <style>{`
        @media (min-width: 768px) {
          .site-footer-grid {
            grid-template-columns: 1.4fr 1fr 1fr !important;
          }
        }
        footer a:hover {
          color: ${SITE.color.pink} !important;
        }
      `}</style>
    </footer>
  );
}
