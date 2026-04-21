"use client";

import { SITE } from "../../../lib/site-theme";
import SectionHeading from "../../../components/site/SectionHeading";
import { PageHero } from "../../../components/site/SiteLayoutParts";

/**
 * /contact — お問い合わせページ
 *
 * 3つの連絡手段:
 *  - 電話（主回線 / 予備回線）
 *  - LINE公式
 *  - メール（mailto: リンク）
 *
 * 目的別のご案内（予約 / 求人 / その他）を明示。
 */

const CHANNELS = [
  {
    label: "TEL",
    title: "お電話",
    desc: "ご予約・お問い合わせを24時間承ります",
    value: "070-1675-5900",
    sub: "予備回線：080-9486-2282",
    href: "tel:07016755900",
    subHref: "tel:08094862282",
    note: "電話受付 11:00 — 翌 03:00",
  },
  {
    label: "LINE",
    title: "LINE公式",
    desc: "ご予約・ご相談・求人応募にどうぞ",
    value: "@angespa",
    href: "https://lin.ee/tJtwJL9",
    note: "24時間受付（返信は営業時間内）",
    external: true,
  },
  {
    label: "MAIL",
    title: "メール",
    desc: "公式サイトへのお問い合わせ・取材依頼など",
    value: "info@ange-spa.com",
    href: "mailto:info@ange-spa.com",
    note: "2営業日以内にご返信いたします",
  },
];

const PURPOSES = [
  {
    label: "ご予約について",
    desc: "当日予約も承っております。お電話・LINEよりお気軽にお問い合わせください。",
  },
  {
    label: "セラピスト求人について",
    desc: "面接・見学のお問い合わせはお電話・LINEにて。詳しくは求人ページをご覧ください。",
  },
  {
    label: "取材・提携について",
    desc: "公式サイトへのご取材・業務提携のお問い合わせはメールにて承ります。",
  },
  {
    label: "その他",
    desc: "サービス内容・ご意見・ご要望など、お気軽にお問い合わせください。",
  },
];

export default function ContactPage() {
  return (
    <>
      <PageHero
        label="CONTACT"
        title="お問い合わせ"
        subtitle="ご予約・ご質問・求人応募など、お気軽にお問い合わせください。"
      />

      {/* ───── CHANNELS ───── */}
      <section style={{ padding: `${SITE.sp.section} ${SITE.sp.lg}` }}>
        <div style={{ maxWidth: SITE.layout.maxWidth, margin: "0 auto" }}>
          <SectionHeading
            label="CHANNEL"
            title="お問い合わせ方法"
            subtitle="3つの方法からお選びいただけます。"
          />
          <div
            className="site-contact-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "1fr",
              gap: SITE.sp.md,
              marginTop: SITE.sp.xl,
            }}
          >
            {CHANNELS.map((c) => (
              <div
                key={c.label}
                style={{
                  padding: SITE.sp.xl,
                  backgroundColor: SITE.color.surface,
                  border: `1px solid ${SITE.color.border}`,
                  textAlign: "center",
                }}
              >
                <p
                  style={{
                    fontFamily: SITE.font.display,
                    fontSize: "11px",
                    letterSpacing: SITE.ls.wide,
                    color: SITE.color.pink,
                    marginBottom: 8,
                    fontWeight: 500,
                  }}
                >
                  {c.label}
                </p>
                <h3
                  style={{
                    fontFamily: SITE.font.serif,
                    fontSize: "17px",
                    fontWeight: 500,
                    marginBottom: 12,
                    letterSpacing: SITE.ls.loose,
                  }}
                >
                  {c.title}
                </h3>
                <div
                  style={{
                    width: 24,
                    height: 1,
                    backgroundColor: SITE.color.pink,
                    margin: "0 auto 20px",
                  }}
                />
                <p
                  style={{
                    fontSize: "12px",
                    color: SITE.color.textSub,
                    lineHeight: SITE.lh.body,
                    marginBottom: 20,
                    letterSpacing: SITE.ls.normal,
                  }}
                >
                  {c.desc}
                </p>
                <a
                  href={c.href}
                  target={c.external ? "_blank" : undefined}
                  rel={c.external ? "noopener noreferrer" : undefined}
                  style={{
                    display: "inline-block",
                    padding: "14px 28px",
                    backgroundColor: SITE.color.pink,
                    color: "#ffffff",
                    fontFamily: SITE.font.display,
                    fontSize: "16px",
                    letterSpacing: SITE.ls.loose,
                    textDecoration: "none",
                    transition: SITE.transition.base,
                    fontWeight: 500,
                  }}
                  className="site-cta-primary"
                >
                  {c.value}
                </a>
                {c.sub && c.subHref && (
                  <p style={{ marginTop: 12 }}>
                    <a
                      href={c.subHref}
                      style={{
                        fontFamily: SITE.font.display,
                        fontSize: "12px",
                        color: SITE.color.textSub,
                        textDecoration: "none",
                        letterSpacing: SITE.ls.loose,
                      }}
                    >
                      {c.sub}
                    </a>
                  </p>
                )}
                {c.note && (
                  <p
                    style={{
                      marginTop: 14,
                      fontSize: "11px",
                      color: SITE.color.textMuted,
                      letterSpacing: SITE.ls.loose,
                      lineHeight: SITE.lh.body,
                    }}
                  >
                    {c.note}
                  </p>
                )}
              </div>
            ))}
          </div>
          <style>{`
            @media (min-width: 768px) {
              .site-contact-grid {
                grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
              }
            }
          `}</style>
        </div>
      </section>

      {/* ───── PURPOSES ───── */}
      <section
        style={{
          padding: `${SITE.sp.section} ${SITE.sp.lg}`,
          backgroundColor: SITE.color.bgSoft,
        }}
      >
        <div style={{ maxWidth: SITE.layout.maxWidthNarrow, margin: "0 auto" }}>
          <SectionHeading label="PURPOSE" title="お問い合わせの内容について" />
          <div
            style={{
              borderTop: `1px solid ${SITE.color.border}`,
            }}
          >
            {PURPOSES.map((p) => (
              <div
                key={p.label}
                style={{
                  padding: "20px 0",
                  borderBottom: `1px solid ${SITE.color.border}`,
                  display: "grid",
                  gridTemplateColumns: "1fr",
                  gap: 8,
                }}
                className="site-purpose-row"
              >
                <h4
                  style={{
                    fontFamily: SITE.font.serif,
                    fontSize: "14px",
                    fontWeight: 500,
                    color: SITE.color.text,
                    letterSpacing: SITE.ls.loose,
                  }}
                >
                  {p.label}
                </h4>
                <p
                  style={{
                    fontFamily: SITE.font.serif,
                    fontSize: "13px",
                    lineHeight: SITE.lh.body,
                    color: SITE.color.textSub,
                    letterSpacing: SITE.ls.normal,
                  }}
                >
                  {p.desc}
                </p>
              </div>
            ))}
          </div>
          <style>{`
            @media (min-width: 640px) {
              .site-purpose-row {
                grid-template-columns: 200px 1fr !important;
                gap: ${SITE.sp.lg} !important;
                align-items: baseline;
              }
            }
          `}</style>
        </div>
      </section>

      {/* ───── BUSINESS HOURS ───── */}
      <section style={{ padding: `${SITE.sp.section} ${SITE.sp.lg}` }}>
        <div
          style={{
            maxWidth: SITE.layout.maxWidthText,
            margin: "0 auto",
            textAlign: "center",
          }}
        >
          <SectionHeading label="HOURS" title="営業時間" />
          <div
            style={{
              padding: SITE.sp.xl,
              border: `1px solid ${SITE.color.border}`,
              backgroundColor: SITE.color.surface,
            }}
          >
            <p
              style={{
                fontFamily: SITE.font.display,
                fontSize: "22px",
                color: SITE.color.pink,
                letterSpacing: SITE.ls.loose,
                marginBottom: 16,
                fontWeight: 500,
              }}
            >
              12:00 — 27:00
            </p>
            <p
              style={{
                fontFamily: SITE.font.serif,
                fontSize: "13px",
                color: SITE.color.textSub,
                lineHeight: SITE.lh.body,
                letterSpacing: SITE.ls.loose,
              }}
            >
              最終受付 26:00<br />
              電話受付 11:00 — 翌 03:00<br />
              定休日 なし（年中無休）
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
