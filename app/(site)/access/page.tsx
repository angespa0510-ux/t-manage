"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";
import { SITE, MARBLE } from "../../../lib/site-theme";
import SectionHeading from "../../../components/site/SectionHeading";
import { PageHero, LoadingBlock } from "../../../components/site/SiteLayoutParts";

/**
 * /access — 店舗・アクセスページ
 *
 * データソース: buildings (shop_is_public=true) + 親 stores
 *
 * 設計:
 *   - 各「建物」を /access の1カードとして表示
 *   - 住所・電話・地図・写真等は buildings 側
 *   - 営業時間・受付時間・定休日は親 stores から継承
 *
 * 構成:
 *   1. PageHero
 *   2. HOURS / 営業・予約クイックインフォ
 *   3. 建物タブ（sticky）
 *   4. 各建物ブロック（写真ギャラリー / 情報 / 3 CTA / 地図）
 *   5. VISIT / 来店までの流れ（4ステップ）
 *   6. RESERVE / 下部 CTA
 *   7. LocalBusiness JSON-LD（SEO）
 */

type ParentStore = {
  id: number;
  name: string;
  shop_hours?: string;
  shop_reception_hours?: string;
  shop_holiday?: string;
};

type Building = {
  id: number;
  store_id: number;
  name: string;
  shop_display_name?: string;
  shop_address?: string;
  shop_phone?: string;
  shop_phone_secondary?: string;
  shop_access?: string;
  shop_map_embed?: string;
  shop_image_url?: string;
  shop_sub_image_urls?: string[];
  shop_description?: string;
  shop_sort_order?: number;
  // クライアント側で merge
  store?: ParentStore;
};

const VISIT_STEPS = [
  {
    no: "01",
    label: "RESERVE",
    title: "ご予約",
    desc: "WEB予約・お電話・LINEからご希望のセラピストとお時間をご予約ください。当日予約も承ります。",
  },
  {
    no: "02",
    label: "ARRIVE",
    title: "店舗付近へ到着",
    desc: "ご予約のお時間にあわせて、店舗付近までお越しください。最寄駅から徒歩5〜9分、無料駐車場もご用意しています。",
  },
  {
    no: "03",
    label: "CALL",
    title: "到着のお電話",
    desc: "お部屋の準備とプライバシー保護のため、到着されましたら一度お電話にてご一報ください。",
  },
  {
    no: "04",
    label: "WELCOME",
    title: "スタッフがご案内",
    desc: "スタッフがお部屋までご案内いたします。最高のひとときをお楽しみください。",
  },
];

export default function AccessPage() {
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedBuildingId, setCopiedBuildingId] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      // 公開建物 + 親ストアを並列取得し、クライアントで merge
      const [bRes, sRes] = await Promise.all([
        supabase
          .from("buildings")
          .select("*")
          .eq("shop_is_public", true)
          .order("shop_sort_order", { ascending: true })
          .order("id", { ascending: true }),
        supabase
          .from("stores")
          .select("id, name, shop_hours, shop_reception_hours, shop_holiday"),
      ]);
      const storeMap = new Map<number, ParentStore>(
        (sRes.data || []).map((s: ParentStore) => [s.id, s])
      );
      const merged: Building[] = (bRes.data || []).map((b: Building) => ({
        ...b,
        store: storeMap.get(b.store_id),
      }));
      setBuildings(merged);
      setLoading(false);
    })();
  }, []);

  const handleCopyAddress = async (buildingId: number, address: string) => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(address);
      } else {
        // フォールバック: 古いブラウザ向け
        const ta = document.createElement("textarea");
        ta.value = address;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCopiedBuildingId(buildingId);
      setTimeout(() => setCopiedBuildingId(null), 2000);
    } catch {
      // 失敗時は何もしない（ユーザーは手動で住所行を選択可能）
    }
  };

  const mapsLink = (address: string) =>
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;

  return (
    <>
      <PageHero
        label="ACCESS"
        title="店舗・アクセス"
        subtitle="名古屋・三河安城・豊橋エリアに展開する Ange Spa 各店舗のご案内です。"
        bgVideo="/videos/access.mp4"
        bgVideoPoster="/videos/access-poster.jpg"
      />

      <div
        style={{
          ...MARBLE.beige,
          marginBottom: `calc(-1 * ${SITE.sp.section})`,
          paddingBottom: SITE.sp.section,
          minHeight: "60vh",
        }}
      >
      {loading ? (
        <section style={{ padding: SITE.sp.section }}>
          <LoadingBlock />
        </section>
      ) : buildings.length === 0 ? (
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
          {/* ───── 営業時間・予約クイックインフォ ───── */}
          <section style={{ padding: `${SITE.sp.sectionSm} ${SITE.sp.lg} 0` }}>
            <div
              style={{
                maxWidth: SITE.layout.maxWidthNarrow,
                margin: "0 auto",
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
                  marginBottom: 12,
                  fontWeight: 500,
                }}
              >
                HOURS
              </p>
              <p
                style={{
                  fontFamily: SITE.font.display,
                  fontSize: "26px",
                  color: SITE.color.text,
                  letterSpacing: SITE.ls.loose,
                  marginBottom: 12,
                  fontWeight: 500,
                }}
              >
                12:00 — 27:00
              </p>
              <div
                style={{
                  width: 32,
                  height: 1,
                  backgroundColor: SITE.color.pink,
                  margin: "0 auto 16px",
                }}
              />
              <p
                style={{
                  fontFamily: SITE.font.serif,
                  fontSize: "13px",
                  color: SITE.color.textSub,
                  lineHeight: SITE.lh.body,
                  letterSpacing: SITE.ls.loose,
                  marginBottom: SITE.sp.xl,
                }}
              >
                最終受付 26:00　／　電話受付 11:00 — 翌 03:00　／　年中無休
              </p>

              <div
                className="site-quick-cta"
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr",
                  gap: 10,
                  maxWidth: 480,
                  margin: "0 auto",
                }}
              >
                <Link
                  href="/schedule"
                  style={{
                    display: "block",
                    padding: "16px 24px",
                    backgroundColor: SITE.color.pink,
                    color: "#ffffff",
                    fontFamily: SITE.font.serif,
                    fontSize: "14px",
                    fontWeight: 500,
                    letterSpacing: SITE.ls.wide,
                    textDecoration: "none",
                    textAlign: "center",
                    transition: SITE.transition.base,
                  }}
                  className="site-cta-primary"
                >
                  WEB予約をする
                </Link>
                <a
                  href="tel:07016755900"
                  style={{
                    display: "block",
                    padding: "16px 24px",
                    backgroundColor: SITE.color.surface,
                    border: `1px solid ${SITE.color.pink}`,
                    color: SITE.color.pink,
                    fontFamily:
                      '-apple-system, BlinkMacSystemFont, "Hiragino Sans", "Noto Sans JP", "Yu Gothic", sans-serif',
                    fontSize: "16px",
                    fontWeight: 500,
                    letterSpacing: SITE.ls.normal,
                    textDecoration: "none",
                    textAlign: "center",
                    transition: SITE.transition.base,
                  }}
                  className="site-cta-secondary"
                >
                  お電話 070-1675-5900
                </a>
              </div>
            </div>
          </section>

          {/* ───── 店舗タブ（sticky） ───── */}
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
              {buildings.map((b) => (
                <a
                  key={b.id}
                  href={`#store-${b.id}`}
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
                  {b.shop_display_name || b.name}
                </a>
              ))}
            </div>
          </section>

          {/* ───── 各建物ブロック ───── */}
          {buildings.map((b, idx) => {
            const displayName = b.shop_display_name || b.name;
            const parentStoreName = b.store?.name || "";
            const subImages = (b.shop_sub_image_urls || []).filter(Boolean);
            const allImages = [
              b.shop_image_url,
              ...subImages,
            ].filter((u): u is string => !!u);
            const tel = (b.shop_phone || "").replace(/[^0-9]/g, "");
            const telSecondary = (b.shop_phone_secondary || "").replace(
              /[^0-9]/g,
              ""
            );

            return (
              <section
                key={b.id}
                id={`store-${b.id}`}
                style={{
                  padding: `${SITE.sp.section} ${SITE.sp.lg}`,
                  backgroundColor:
                    idx % 2 === 0 ? "transparent" : "rgba(255,255,255,0.55)",
                  scrollMarginTop: "120px",
                }}
              >
                <div
                  style={{ maxWidth: SITE.layout.maxWidth, margin: "0 auto" }}
                >
                  <SectionHeading
                    label={`SHOP ${String(idx + 1).padStart(2, "0")}`}
                    title={displayName}
                    subtitle={parentStoreName || undefined}
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
                    {/* ─── 写真ギャラリー ─── */}
                    <div>
                      <div
                        style={{
                          width: "100%",
                          aspectRatio: "3 / 2",
                          backgroundColor: SITE.color.surfaceAlt,
                          overflow: "hidden",
                        }}
                      >
                        {allImages[0] ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={allImages[0]}
                            alt={`${displayName} 外観`}
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

                      {/* サブ写真サムネイル */}
                      {allImages.length > 1 && (
                        <div
                          style={{
                            marginTop: 8,
                            display: "grid",
                            gridTemplateColumns: `repeat(${Math.min(
                              allImages.length - 1,
                              4
                            )}, 1fr)`,
                            gap: 8,
                          }}
                        >
                          {allImages.slice(1, 5).map((url, i) => (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                              key={i}
                              src={url}
                              alt={`${displayName} 写真 ${i + 2}`}
                              style={{
                                width: "100%",
                                aspectRatio: "1 / 1",
                                objectFit: "cover",
                                display: "block",
                                backgroundColor: SITE.color.surfaceAlt,
                              }}
                              loading="lazy"
                            />
                          ))}
                        </div>
                      )}

                      {b.shop_description && (
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
                          {b.shop_description}
                        </p>
                      )}
                    </div>

                    {/* ─── 情報 + CTA ─── */}
                    <div>
                      <dl
                        style={{
                          margin: 0,
                          padding: 0,
                          borderTop: `1px solid ${SITE.color.border}`,
                        }}
                      >
                        {[
                          { k: "住所", v: b.shop_address },
                          {
                            k: "電話",
                            v: b.shop_phone,
                            tel: b.shop_phone,
                          },
                          b.shop_phone_secondary
                            ? {
                                k: "予備回線",
                                v: b.shop_phone_secondary,
                                tel: b.shop_phone_secondary,
                              }
                            : null,
                          { k: "営業", v: b.store?.shop_hours },
                          { k: "受付", v: b.store?.shop_reception_hours },
                          { k: "定休日", v: b.store?.shop_holiday },
                          { k: "アクセス", v: b.shop_access },
                        ]
                          .filter(
                            (
                              r
                            ): r is { k: string; v: string; tel?: string } =>
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
                                    href={`tel:${row.tel.replace(
                                      /[^0-9]/g,
                                      ""
                                    )}`}
                                    style={{
                                      color: SITE.color.pink,
                                      textDecoration: "none",
                                      fontFamily:
                                        '-apple-system, BlinkMacSystemFont, "Hiragino Sans", "Noto Sans JP", "Yu Gothic", sans-serif',
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

                      {/* 注意書き */}
                      <p
                        style={{
                          marginTop: SITE.sp.md,
                          padding: "12px 14px",
                          backgroundColor: SITE.color.pinkSoft,
                          borderLeft: `2px solid ${SITE.color.pink}`,
                          fontFamily: SITE.font.serif,
                          fontSize: "12px",
                          color: SITE.color.text,
                          lineHeight: SITE.lh.body,
                          letterSpacing: SITE.ls.normal,
                        }}
                      >
                        到着されましたら、お部屋のご準備とプライバシー保護のため、一度お電話にてご一報ください。
                      </p>

                      {/* 3 CTAボタン */}
                      <div
                        style={{
                          marginTop: SITE.sp.xl,
                          display: "flex",
                          flexDirection: "column",
                          gap: 10,
                        }}
                      >
                        {tel && (
                          <a
                            href={`tel:${tel}`}
                            style={{
                              display: "block",
                              padding: "16px 24px",
                              backgroundColor: SITE.color.pink,
                              color: "#ffffff",
                              fontFamily:
                                '-apple-system, BlinkMacSystemFont, "Hiragino Sans", "Noto Sans JP", "Yu Gothic", sans-serif',
                              fontSize: "16px",
                              fontWeight: 500,
                              letterSpacing: SITE.ls.normal,
                              textDecoration: "none",
                              textAlign: "center",
                              transition: SITE.transition.base,
                            }}
                            className="site-cta-primary"
                          >
                            電話する　{b.shop_phone}
                          </a>
                        )}

                        {b.shop_address && (
                          <div
                            className="site-access-cta-row"
                            style={{
                              display: "grid",
                              gridTemplateColumns: "1fr 1fr",
                              gap: 10,
                            }}
                          >
                            <a
                              href={mapsLink(b.shop_address)}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                display: "block",
                                padding: "14px 16px",
                                backgroundColor: SITE.color.surface,
                                border: `1px solid ${SITE.color.pink}`,
                                color: SITE.color.pink,
                                fontFamily: SITE.font.serif,
                                fontSize: "13px",
                                fontWeight: 500,
                                letterSpacing: SITE.ls.loose,
                                textDecoration: "none",
                                textAlign: "center",
                                transition: SITE.transition.base,
                              }}
                              className="site-cta-secondary"
                            >
                              Mapで開く
                            </a>
                            <button
                              type="button"
                              onClick={() =>
                                handleCopyAddress(b.id, b.shop_address!)
                              }
                              style={{
                                display: "block",
                                padding: "14px 16px",
                                backgroundColor: SITE.color.surface,
                                border: `1px solid ${SITE.color.border}`,
                                color:
                                  copiedBuildingId === b.id
                                    ? SITE.color.pink
                                    : SITE.color.text,
                                fontFamily: SITE.font.serif,
                                fontSize: "13px",
                                fontWeight: 500,
                                letterSpacing: SITE.ls.loose,
                                cursor: "pointer",
                                textAlign: "center",
                                transition: SITE.transition.base,
                              }}
                              className="site-access-copy-btn"
                            >
                              {copiedBuildingId === b.id
                                ? "コピーしました"
                                : "住所をコピー"}
                            </button>
                          </div>
                        )}

                        {telSecondary && telSecondary !== tel && (
                          <a
                            href={`tel:${telSecondary}`}
                            style={{
                              display: "block",
                              padding: "12px 24px",
                              color: SITE.color.textSub,
                              fontFamily: SITE.font.serif,
                              fontSize: "12px",
                              letterSpacing: SITE.ls.loose,
                              textDecoration: "none",
                              textAlign: "center",
                            }}
                          >
                            予備回線：{b.shop_phone_secondary}
                          </a>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* ─── 地図 ─── */}
                  {b.shop_map_embed && (
                    <div
                      style={{
                        marginTop: SITE.sp.xl,
                        width: "100%",
                        aspectRatio: "16 / 9",
                        border: `1px solid ${SITE.color.border}`,
                        overflow: "hidden",
                      }}
                      dangerouslySetInnerHTML={{
                        __html: b.shop_map_embed.includes("<iframe")
                          ? b.shop_map_embed
                          : `<iframe src="${b.shop_map_embed}" width="100%" height="100%" style="border:0;" allowfullscreen loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>`,
                      }}
                    />
                  )}
                </div>
              </section>
            );
          })}

          {/* ───── 来店までの流れ ───── */}
          <section
            style={{
              padding: `${SITE.sp.section} ${SITE.sp.lg}`,
              backgroundColor: "rgba(255,255,255,0.55)",
            }}
          >
            <div
              style={{ maxWidth: SITE.layout.maxWidth, margin: "0 auto" }}
            >
              <SectionHeading
                label="VISIT"
                title="来店までの流れ"
                subtitle="初めてのご来店でも安心してお越しいただけるよう、シンプルな4ステップでご案内しています。"
              />
              <div
                className="site-visit-flow"
                style={{
                  marginTop: SITE.sp.xl,
                  display: "grid",
                  gridTemplateColumns: "1fr",
                  gap: SITE.sp.md,
                }}
              >
                {VISIT_STEPS.map((step) => (
                  <div
                    key={step.no}
                    style={{
                      padding: SITE.sp.xl,
                      backgroundColor: SITE.color.surface,
                      border: `1px solid ${SITE.color.border}`,
                      display: "grid",
                      gridTemplateColumns: "auto 1fr",
                      gap: SITE.sp.lg,
                      alignItems: "start",
                    }}
                  >
                    <div
                      style={{
                        fontFamily: SITE.font.display,
                        fontSize: "32px",
                        color: SITE.color.pink,
                        letterSpacing: SITE.ls.loose,
                        fontWeight: 400,
                        lineHeight: 1,
                        minWidth: 56,
                      }}
                    >
                      {step.no}
                    </div>
                    <div>
                      <p
                        style={{
                          fontFamily: SITE.font.display,
                          fontSize: "10px",
                          letterSpacing: SITE.ls.wide,
                          color: SITE.color.pink,
                          marginBottom: 6,
                          fontWeight: 500,
                        }}
                      >
                        {step.label}
                      </p>
                      <h3
                        style={{
                          fontFamily: SITE.font.serif,
                          fontSize: "16px",
                          fontWeight: 500,
                          color: SITE.color.text,
                          letterSpacing: SITE.ls.loose,
                          marginBottom: 8,
                        }}
                      >
                        {step.title}
                      </h3>
                      <p
                        style={{
                          fontFamily: SITE.font.serif,
                          fontSize: "13px",
                          lineHeight: SITE.lh.body,
                          color: SITE.color.textSub,
                          letterSpacing: SITE.ls.normal,
                        }}
                      >
                        {step.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ───── 下部 RESERVE CTA ───── */}
          <section style={{ padding: `${SITE.sp.section} ${SITE.sp.lg} 0` }}>
            <div
              style={{
                maxWidth: SITE.layout.maxWidthNarrow,
                margin: "0 auto",
                padding: SITE.sp.xxl,
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
                  marginBottom: 14,
                  fontWeight: 500,
                }}
              >
                RESERVE
              </p>
              <h2
                style={{
                  fontFamily: SITE.font.serif,
                  fontSize: SITE.fs.h2,
                  color: SITE.color.text,
                  letterSpacing: SITE.ls.loose,
                  fontWeight: 500,
                  marginBottom: 16,
                  lineHeight: SITE.lh.heading,
                }}
              >
                ご予約はこちらから
              </h2>
              <div
                style={{
                  width: SITE.accent.underlineW,
                  height: SITE.accent.underlineH,
                  backgroundColor: SITE.color.pink,
                  margin: "0 auto",
                }}
              />
              <p
                style={{
                  marginTop: 24,
                  fontFamily: SITE.font.serif,
                  fontSize: "13px",
                  color: SITE.color.textSub,
                  lineHeight: SITE.lh.body,
                  letterSpacing: SITE.ls.loose,
                  marginBottom: SITE.sp.xl,
                }}
              >
                お好きなセラピストとお時間をお選びいただけます。
                <br />
                当日予約も承っております。
              </p>
              <div
                className="site-bottom-cta"
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr",
                  gap: 10,
                  maxWidth: 480,
                  margin: "0 auto",
                }}
              >
                <Link
                  href="/schedule"
                  style={{
                    display: "block",
                    padding: "18px 24px",
                    backgroundColor: SITE.color.pink,
                    color: "#ffffff",
                    fontFamily: SITE.font.serif,
                    fontSize: "14px",
                    fontWeight: 500,
                    letterSpacing: SITE.ls.wide,
                    textDecoration: "none",
                    textAlign: "center",
                    transition: SITE.transition.base,
                  }}
                  className="site-cta-primary"
                >
                  WEB予約をする
                </Link>
                <a
                  href="tel:07016755900"
                  style={{
                    display: "block",
                    padding: "18px 24px",
                    backgroundColor: SITE.color.surface,
                    border: `1px solid ${SITE.color.pink}`,
                    color: SITE.color.pink,
                    fontFamily:
                      '-apple-system, BlinkMacSystemFont, "Hiragino Sans", "Noto Sans JP", "Yu Gothic", sans-serif',
                    fontSize: "16px",
                    fontWeight: 500,
                    letterSpacing: SITE.ls.normal,
                    textDecoration: "none",
                    textAlign: "center",
                    transition: SITE.transition.base,
                  }}
                  className="site-cta-secondary"
                >
                  お電話 070-1675-5900
                </a>
              </div>
            </div>
          </section>

          {/* ───── LocalBusiness JSON-LD（SEO） ───── */}
          {buildings.map((b) => {
            const displayName = b.shop_display_name || b.name;
            const phones = [b.shop_phone, b.shop_phone_secondary].filter(
              (p): p is string => !!p
            );
            const ld: Record<string, unknown> = {
              "@context": "https://schema.org",
              "@type": "HealthAndBeautyBusiness",
              name: `Ange Spa ${displayName}`,
              ...(b.shop_address && { address: b.shop_address }),
              ...(phones.length > 0 && { telephone: phones[0] }),
              openingHours: "Mo-Su 12:00-27:00",
              ...(b.shop_image_url && { image: b.shop_image_url }),
              ...(b.shop_description && { description: b.shop_description }),
              url: `https://ange-spa.jp/access#store-${b.id}`,
            };
            return (
              <script
                key={`ld-${b.id}`}
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }}
              />
            );
          })}

          <style>{`
            .site-access-tab:hover { color: ${SITE.color.pink} !important; }
            .site-access-copy-btn:hover {
              border-color: ${SITE.color.pink} !important;
              color: ${SITE.color.pink} !important;
            }
            @media (min-width: 768px) {
              .site-access-grid {
                grid-template-columns: 5fr 4fr !important;
                gap: ${SITE.sp.xxl} !important;
              }
              .site-quick-cta,
              .site-bottom-cta {
                grid-template-columns: 1fr 1fr !important;
              }
              .site-visit-flow {
                grid-template-columns: repeat(2, 1fr) !important;
                gap: ${SITE.sp.lg} !important;
              }
            }
            @media (min-width: 1024px) {
              .site-visit-flow {
                grid-template-columns: repeat(4, 1fr) !important;
              }
            }
          `}</style>
        </>
      )}
      </div>
    </>
  );
}
