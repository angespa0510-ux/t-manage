"use client";

import { useState, useEffect } from "react";
import { supabase } from "../../../lib/supabase";
import { SITE } from "../../../lib/site-theme";
import SectionHeading from "../../../components/site/SectionHeading";
import { PageHero, LoadingBlock } from "../../../components/site/SiteLayoutParts";

/**
 * /access — 店舗情報・アクセスページ
 *
 * データソース: stores (shop_is_public=true)
 * カラム: shop_display_name, shop_address, shop_phone, shop_phone_secondary,
 *        shop_hours, shop_reception_hours, shop_holiday, shop_access,
 *        shop_map_embed, shop_image_url, shop_description, shop_sort_order
 */

type Store = {
  id: number;
  name: string;
  shop_display_name?: string;
  shop_address?: string;
  shop_phone?: string;
  shop_phone_secondary?: string;
  shop_hours?: string;
  shop_reception_hours?: string;
  shop_holiday?: string;
  shop_access?: string;
  shop_map_embed?: string;
  shop_image_url?: string;
  shop_description?: string;
  shop_sort_order?: number;
};

export default function AccessPage() {
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("stores")
        .select("*")
        .eq("shop_is_public", true)
        .order("shop_sort_order", { ascending: true })
        .order("id", { ascending: true });
      setStores(data || []);
      setLoading(false);
    })();
  }, []);

  return (
    <>
      <PageHero
        label="ACCESS"
        title="店舗・アクセス"
        subtitle="名古屋・三河安城・豊橋エリアに展開する Ange Spa 各店舗のご案内です。"
        bgImage="/images/placeholder/access.jpg"
      />

      {loading ? (
        <section style={{ padding: SITE.sp.section }}>
          <LoadingBlock />
        </section>
      ) : stores.length === 0 ? (
        <section style={{ padding: `${SITE.sp.section} ${SITE.sp.lg}` }}>
          <div
            style={{
              maxWidth: SITE.layout.maxWidthNarrow,
              margin: "0 auto",
              textAlign: "center",
              padding: SITE.sp.xxl,
              border: `1px solid ${SITE.color.border}`,
              backgroundColor: SITE.color.surface,
            }}
          >
            <p style={{ color: SITE.color.textSub, fontSize: "14px" }}>
              店舗情報の公開準備中です
            </p>
          </div>
        </section>
      ) : (
        <>
          {/* 店舗一覧ナビ */}
          <section
            style={{
              padding: `${SITE.sp.xl} ${SITE.sp.lg} 0`,
              position: "sticky",
              top: SITE.layout.headerHeightSp,
              zIndex: 10,
              backgroundColor: "rgba(255,255,255,0.92)",
              backdropFilter: "blur(10px)",
              WebkitBackdropFilter: "blur(10px)",
              borderBottom: `1px solid ${SITE.color.border}`,
            }}
          >
            <div
              style={{
                maxWidth: SITE.layout.maxWidth,
                margin: "0 auto",
                display: "flex",
                gap: 4,
                flexWrap: "wrap",
                justifyContent: "center",
              }}
            >
              {stores.map((s) => (
                <a
                  key={s.id}
                  href={`#store-${s.id}`}
                  style={{
                    padding: "14px 24px",
                    color: SITE.color.text,
                    textDecoration: "none",
                    fontFamily: SITE.font.serif,
                    fontSize: "13px",
                    letterSpacing: SITE.ls.loose,
                    transition: SITE.transition.fast,
                  }}
                  className="site-access-tab"
                >
                  {s.shop_display_name || s.name}
                </a>
              ))}
            </div>
          </section>

          {/* 各店舗ブロック */}
          {stores.map((s, idx) => (
            <section
              key={s.id}
              id={`store-${s.id}`}
              style={{
                padding: `${SITE.sp.section} ${SITE.sp.lg}`,
                backgroundColor:
                  idx % 2 === 0 ? SITE.color.bg : SITE.color.bgSoft,
                scrollMarginTop: "120px",
              }}
            >
              <div style={{ maxWidth: SITE.layout.maxWidth, margin: "0 auto" }}>
                <SectionHeading
                  label={`SHOP ${String(idx + 1).padStart(2, "0")}`}
                  title={s.shop_display_name || s.name}
                />

                <div
                  className="site-access-grid"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr",
                    gap: SITE.sp.xl,
                    marginTop: SITE.sp.xl,
                  }}
                >
                  {/* 画像 */}
                  <div>
                    <div
                      style={{
                        width: "100%",
                        aspectRatio: "3 / 2",
                        backgroundColor: SITE.color.surfaceAlt,
                        overflow: "hidden",
                      }}
                    >
                      {s.shop_image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={s.shop_image_url}
                          alt={s.shop_display_name || s.name}
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                            display: "block",
                          }}
                          loading="lazy"
                        />
                      ) : (
                        <div
                          style={{
                            width: "100%",
                            height: "100%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: SITE.color.textFaint,
                            fontFamily: SITE.font.display,
                            fontSize: "11px",
                            letterSpacing: SITE.ls.wide,
                          }}
                        >
                          NO IMAGE
                        </div>
                      )}
                    </div>
                    {s.shop_description && (
                      <p
                        style={{
                          marginTop: SITE.sp.md,
                          fontFamily: SITE.font.serif,
                          fontSize: "13px",
                          lineHeight: SITE.lh.body,
                          color: SITE.color.textSub,
                          letterSpacing: SITE.ls.loose,
                          whiteSpace: "pre-wrap",
                        }}
                      >
                        {s.shop_description}
                      </p>
                    )}
                  </div>

                  {/* 情報 */}
                  <div>
                    <dl
                      style={{
                        margin: 0,
                        padding: 0,
                        borderTop: `1px solid ${SITE.color.border}`,
                      }}
                    >
                      {[
                        { k: "住所", v: s.shop_address },
                        {
                          k: "電話",
                          v: s.shop_phone,
                          tel: s.shop_phone,
                        },
                        s.shop_phone_secondary
                          ? {
                              k: "予備回線",
                              v: s.shop_phone_secondary,
                              tel: s.shop_phone_secondary,
                            }
                          : null,
                        { k: "営業", v: s.shop_hours },
                        { k: "受付", v: s.shop_reception_hours },
                        { k: "定休日", v: s.shop_holiday },
                        { k: "アクセス", v: s.shop_access },
                      ]
                        .filter((r): r is { k: string; v: string; tel?: string } =>
                          r !== null && !!r.v
                        )
                        .map((row) => (
                          <div
                            key={row.k}
                            style={{
                              display: "grid",
                              gridTemplateColumns: "80px 1fr",
                              gap: SITE.sp.md,
                              padding: "14px 0",
                              borderBottom: `1px solid ${SITE.color.border}`,
                            }}
                          >
                            <dt
                              style={{
                                fontFamily: SITE.font.serif,
                                fontSize: "12px",
                                color: SITE.color.textMuted,
                                letterSpacing: SITE.ls.loose,
                                fontWeight: 500,
                              }}
                            >
                              {row.k}：
                            </dt>
                            <dd
                              style={{
                                margin: 0,
                                fontFamily: SITE.font.serif,
                                fontSize: "13px",
                                color: SITE.color.text,
                                lineHeight: SITE.lh.body,
                                letterSpacing: SITE.ls.normal,
                                whiteSpace: "pre-wrap",
                              }}
                            >
                              {row.tel ? (
                                <a
                                  href={`tel:${row.tel.replace(/[^0-9]/g, "")}`}
                                  style={{
                                    color: SITE.color.pink,
                                    textDecoration: "none",
                                    fontFamily: SITE.font.display,
                                    fontSize: "15px",
                                    letterSpacing: SITE.ls.loose,
                                  }}
                                >
                                  {row.v}
                                </a>
                              ) : (
                                row.v
                              )}
                            </dd>
                          </div>
                        ))}
                    </dl>

                    {/* CTAボタン */}
                    <div
                      style={{
                        marginTop: SITE.sp.xl,
                        display: "flex",
                        flexDirection: "column",
                        gap: 10,
                      }}
                    >
                      {s.shop_phone && (
                        <a
                          href={`tel:${s.shop_phone.replace(/[^0-9]/g, "")}`}
                          style={{
                            display: "block",
                            padding: "14px 24px",
                            backgroundColor: SITE.color.pink,
                            color: "#ffffff",
                            fontFamily: SITE.font.display,
                            fontSize: "14px",
                            letterSpacing: SITE.ls.wide,
                            textDecoration: "none",
                            textAlign: "center",
                          }}
                          className="site-cta-primary"
                        >
                          電話 {s.shop_phone}
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                {/* 地図 */}
                {s.shop_map_embed && (
                  <div
                    style={{
                      marginTop: SITE.sp.xl,
                      width: "100%",
                      aspectRatio: "16 / 9",
                      border: `1px solid ${SITE.color.border}`,
                      overflow: "hidden",
                    }}
                    dangerouslySetInnerHTML={{
                      __html: s.shop_map_embed.includes("<iframe")
                        ? s.shop_map_embed
                        : `<iframe src="${s.shop_map_embed}" width="100%" height="100%" style="border:0;" allowfullscreen loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>`,
                    }}
                  />
                )}
              </div>
            </section>
          ))}

          <style>{`
            .site-access-tab:hover { color: ${SITE.color.pink} !important; }
            @media (min-width: 768px) {
              .site-access-grid {
                grid-template-columns: 5fr 4fr !important;
                gap: ${SITE.sp.xxl} !important;
              }
            }
          `}</style>
        </>
      )}
    </>
  );
}
