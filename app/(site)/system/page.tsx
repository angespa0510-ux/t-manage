"use client";

import { useState, useEffect } from "react";
import { supabase } from "../../../lib/supabase";
import { SITE } from "../../../lib/site-theme";
import SectionHeading from "../../../components/site/SectionHeading";
import {
  PageHero,
  LoadingBlock,
} from "../../../components/site/SiteLayoutParts";

/**
 * /system — 料金・コースページ
 *
 * データソース:
 *  - courses   (id, name, duration, price, therapist_back, description)
 *  - nominations (id, name, price)
 *  - options   (id, name, price)
 *  - extensions (id, name, duration, price)
 *  - discounts (id, name, amount, type, web_available)
 *
 * 方針:
 *  - 白基調、明朝体、絵文字なし
 *  - 金額は表形式で整列
 *  - セクションごとに罫線で区切る
 *  - お支払い方法・注意事項は静的テキスト
 */

type Course = {
  id: number;
  name: string;
  duration: number;
  price: number;
  description?: string;
};
type Nomination = { id: number; name: string; price: number };
type OptionItem = { id: number; name: string; price: number };
type Extension = { id: number; name: string; duration: number; price: number };
type Discount = {
  id: number;
  name: string;
  amount: number;
  type: string;
  web_available?: boolean;
  newcomer_only?: boolean;
};

const fmt = (n: number) => "¥" + (n || 0).toLocaleString();

export default function SystemPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [nominations, setNominations] = useState<Nomination[]>([]);
  const [options, setOptions] = useState<OptionItem[]>([]);
  const [extensions, setExtensions] = useState<Extension[]>([]);
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [c, n, o, e, d] = await Promise.all([
        supabase.from("courses").select("*").order("duration", { ascending: true }),
        supabase.from("nominations").select("*").order("price", { ascending: true }),
        supabase.from("options").select("*").order("price", { ascending: true }),
        supabase.from("extensions").select("*").order("duration", { ascending: true }),
        supabase.from("discounts").select("*").eq("web_available", true),
      ]);
      setCourses(c.data || []);
      setNominations(n.data || []);
      setOptions(o.data || []);
      setExtensions(e.data || []);
      setDiscounts(d.data || []);
      setLoading(false);
    })();
  }, []);

  return (
    <>
      <PageHero
        label="SYSTEM"
        title="料金・コース"
        subtitle="Ange Spa の各コース料金・オプション・お支払いについてご案内いたします。"
        bgImage="/images/placeholder/system.jpg"
      />

      {loading ? (
        <section style={{ padding: SITE.sp.section }}>
          <LoadingBlock />
        </section>
      ) : (
        <>
          {/* ───────── COURSE ───────── */}
          <section style={{ padding: `${SITE.sp.section} ${SITE.sp.lg}` }}>
            <div style={{ maxWidth: SITE.layout.maxWidthNarrow, margin: "0 auto" }}>
              <SectionHeading
                label="COURSE"
                title="コース料金"
                subtitle="全コース、指名料・交通費等は別途必要です。"
              />

              {courses.length === 0 ? (
                <p
                  style={{
                    textAlign: "center",
                    color: SITE.color.textMuted,
                    fontSize: "13px",
                    padding: SITE.sp.xl,
                  }}
                >
                  準備中
                </p>
              ) : (
                <PriceTable
                  rows={courses.map((c) => ({
                    label: c.name,
                    meta: c.duration ? `${c.duration}分` : "",
                    price: c.price,
                    description: c.description,
                  }))}
                />
              )}
            </div>
          </section>

          {/* ───────── NOMINATION ───────── */}
          {nominations.length > 0 && (
            <section
              style={{
                padding: `${SITE.sp.section} ${SITE.sp.lg}`,
                backgroundColor: SITE.color.bgSoft,
              }}
            >
              <div
                style={{
                  maxWidth: SITE.layout.maxWidthNarrow,
                  margin: "0 auto",
                }}
              >
                <SectionHeading label="NOMINATION" title="指名料" />
                <PriceTable
                  rows={nominations.map((n) => ({
                    label: n.name,
                    price: n.price,
                  }))}
                />
              </div>
            </section>
          )}

          {/* ───────── OPTION ───────── */}
          {options.length > 0 && (
            <section style={{ padding: `${SITE.sp.section} ${SITE.sp.lg}` }}>
              <div
                style={{
                  maxWidth: SITE.layout.maxWidthNarrow,
                  margin: "0 auto",
                }}
              >
                <SectionHeading
                  label="OPTION"
                  title="オプション"
                  subtitle="コースに追加できる各種オプションをご用意しております。"
                />
                <PriceTable
                  rows={options.map((o) => ({ label: o.name, price: o.price }))}
                  twoColumns
                />
              </div>
            </section>
          )}

          {/* ───────── EXTENSION ───────── */}
          {extensions.length > 0 && (
            <section
              style={{
                padding: `${SITE.sp.section} ${SITE.sp.lg}`,
                backgroundColor: SITE.color.bgSoft,
              }}
            >
              <div
                style={{
                  maxWidth: SITE.layout.maxWidthNarrow,
                  margin: "0 auto",
                }}
              >
                <SectionHeading
                  label="EXTENSION"
                  title="延長料金"
                  subtitle="コース中の延長も承っております。"
                />
                <PriceTable
                  rows={extensions.map((e) => ({
                    label: e.name,
                    meta: e.duration ? `${e.duration}分` : "",
                    price: e.price,
                  }))}
                />
              </div>
            </section>
          )}

          {/* ───────── DISCOUNT ───────── */}
          {discounts.length > 0 && (
            <section style={{ padding: `${SITE.sp.section} ${SITE.sp.lg}` }}>
              <div
                style={{
                  maxWidth: SITE.layout.maxWidthNarrow,
                  margin: "0 auto",
                }}
              >
                <SectionHeading label="DISCOUNT" title="割引・キャンペーン" />
                <div
                  style={{
                    display: "grid",
                    gap: SITE.sp.md,
                    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                  }}
                >
                  {discounts.map((d) => (
                    <div
                      key={d.id}
                      style={{
                        padding: SITE.sp.lg,
                        border: `1px solid ${SITE.color.borderPink}`,
                        backgroundColor: SITE.color.surface,
                      }}
                    >
                      <p
                        style={{
                          fontFamily: SITE.font.serif,
                          fontSize: "15px",
                          fontWeight: 500,
                          color: SITE.color.text,
                          marginBottom: 8,
                          letterSpacing: SITE.ls.loose,
                        }}
                      >
                        {d.name}
                      </p>
                      <p
                        style={{
                          fontFamily: SITE.font.display,
                          fontSize: "22px",
                          color: SITE.color.pink,
                          fontWeight: 500,
                          letterSpacing: SITE.ls.loose,
                        }}
                      >
                        {d.type === "percent"
                          ? `${d.amount}% OFF`
                          : `${fmt(d.amount)} OFF`}
                      </p>
                      {d.newcomer_only && (
                        <p
                          style={{
                            marginTop: 8,
                            fontSize: "11px",
                            color: SITE.color.textMuted,
                            letterSpacing: SITE.ls.loose,
                          }}
                        >
                          新規のお客様限定
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* ───────── PAYMENT ───────── */}
          <section
            style={{
              padding: `${SITE.sp.section} ${SITE.sp.lg}`,
              backgroundColor: SITE.color.bgSoft,
            }}
          >
            <div
              style={{
                maxWidth: SITE.layout.maxWidthNarrow,
                margin: "0 auto",
              }}
            >
              <SectionHeading label="PAYMENT" title="お支払い方法" />
              <div
                style={{
                  display: "grid",
                  gap: SITE.sp.md,
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                }}
              >
                {[
                  { t: "現金", d: "日本円のみ" },
                  { t: "クレジットカード", d: "VISA / Master / JCB / AMEX / Diners" },
                  { t: "PayPay", d: "QRコード決済" },
                ].map((p) => (
                  <div
                    key={p.t}
                    style={{
                      padding: SITE.sp.lg,
                      border: `1px solid ${SITE.color.border}`,
                      backgroundColor: SITE.color.surface,
                      textAlign: "center",
                    }}
                  >
                    <p
                      style={{
                        fontFamily: SITE.font.serif,
                        fontSize: "15px",
                        fontWeight: 500,
                        marginBottom: 6,
                        letterSpacing: SITE.ls.loose,
                      }}
                    >
                      {p.t}
                    </p>
                    <p
                      style={{
                        fontSize: "11px",
                        color: SITE.color.textMuted,
                        letterSpacing: SITE.ls.normal,
                      }}
                    >
                      {p.d}
                    </p>
                  </div>
                ))}
              </div>
              <p
                style={{
                  marginTop: SITE.sp.xl,
                  fontSize: "12px",
                  color: SITE.color.textSub,
                  textAlign: "center",
                  lineHeight: SITE.lh.body,
                  letterSpacing: SITE.ls.normal,
                }}
              >
                領収書の発行も可能です。<br />
                詳細はスタッフまでお気軽にお申し付けください。
              </p>
            </div>
          </section>

          {/* ───────── NOTICE ───────── */}
          <section style={{ padding: `${SITE.sp.section} ${SITE.sp.lg}` }}>
            <div
              style={{
                maxWidth: SITE.layout.maxWidthText,
                margin: "0 auto",
                padding: SITE.sp.xl,
                border: `1px solid ${SITE.color.border}`,
                backgroundColor: SITE.color.surface,
              }}
            >
              <p
                style={{
                  fontFamily: SITE.font.display,
                  fontSize: "11px",
                  letterSpacing: SITE.ls.wide,
                  color: SITE.color.pink,
                  marginBottom: 12,
                  textAlign: "center",
                }}
              >
                NOTICE
              </p>
              <h3
                style={{
                  fontFamily: SITE.font.serif,
                  fontSize: "16px",
                  fontWeight: 500,
                  textAlign: "center",
                  marginBottom: 24,
                  letterSpacing: SITE.ls.loose,
                }}
              >
                ご利用にあたって
              </h3>
              <ul
                style={{
                  listStyle: "none",
                  padding: 0,
                  margin: 0,
                  fontSize: "13px",
                  color: SITE.color.textSub,
                  lineHeight: SITE.lh.body,
                  letterSpacing: SITE.ls.normal,
                }}
              >
                {[
                  "表示料金は全て税込金額です。",
                  "コース開始時刻から料金が発生いたします。",
                  "お客様都合によるキャンセルの場合、キャンセル料を頂戴する場合がございます。",
                  "セラピストへの過度な接触はご遠慮ください。",
                  "泥酔状態・体調不良の方はご利用をお断りする場合がございます。",
                  "18歳未満の方はご利用いただけません。",
                ].map((line) => (
                  <li
                    key={line}
                    style={{
                      padding: "10px 0",
                      borderBottom: `1px solid ${SITE.color.borderSoft}`,
                    }}
                  >
                    {line}
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </>
      )}
    </>
  );
}

// ─── 料金表共通コンポーネント ─────────────────────────
function PriceTable({
  rows,
  twoColumns,
}: {
  rows: { label: string; meta?: string; price: number; description?: string }[];
  twoColumns?: boolean;
}) {
  if (twoColumns) {
    return (
      <div
        style={{
          display: "grid",
          gap: "0",
          gridTemplateColumns: "1fr",
          borderTop: `1px solid ${SITE.color.border}`,
        }}
        className="site-price-twocol"
      >
        {rows.map((r, i) => (
          <PriceRow key={i} {...r} compact />
        ))}
        <style>{`
          @media (min-width: 768px) {
            .site-price-twocol {
              grid-template-columns: 1fr 1fr !important;
              column-gap: ${SITE.sp.xl};
            }
          }
        `}</style>
      </div>
    );
  }
  return (
    <div
      style={{
        borderTop: `1px solid ${SITE.color.border}`,
      }}
    >
      {rows.map((r, i) => (
        <PriceRow key={i} {...r} />
      ))}
    </div>
  );
}

function PriceRow({
  label,
  meta,
  price,
  description,
  compact,
}: {
  label: string;
  meta?: string;
  price: number;
  description?: string;
  compact?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        padding: compact ? "14px 8px" : "20px 8px",
        borderBottom: `1px solid ${SITE.color.border}`,
        gap: 16,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            fontFamily: SITE.font.serif,
            fontSize: compact ? "14px" : "15px",
            fontWeight: 500,
            color: SITE.color.text,
            marginBottom: description ? 4 : 0,
            letterSpacing: SITE.ls.loose,
          }}
        >
          {label}
          {meta && (
            <span
              style={{
                marginLeft: 12,
                fontFamily: SITE.font.display,
                fontSize: "11px",
                color: SITE.color.textMuted,
                letterSpacing: SITE.ls.loose,
                fontWeight: 400,
              }}
            >
              {meta}
            </span>
          )}
        </p>
        {description && (
          <p
            style={{
              fontSize: "11px",
              color: SITE.color.textMuted,
              lineHeight: SITE.lh.body,
              letterSpacing: SITE.ls.normal,
            }}
          >
            {description}
          </p>
        )}
      </div>
      <p
        style={{
          fontFamily: SITE.font.display,
          fontSize: compact ? "15px" : "17px",
          color: SITE.color.pink,
          fontWeight: 500,
          letterSpacing: SITE.ls.loose,
          flexShrink: 0,
        }}
      >
        {fmt(price)}
      </p>
    </div>
  );
}
