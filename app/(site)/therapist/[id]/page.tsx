"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { supabase } from "../../../../lib/supabase";
import { SITE } from "../../../../lib/site-theme";
import SectionHeading from "../../../../components/site/SectionHeading";
import { LoadingBlock, EmptyBlock } from "../../../../components/site/SiteLayoutParts";
import { useCustomerAuth } from "../../../../lib/customer-auth-context";

type HpPhoto = {
  id: number;
  therapist_id: number;
  photo_url: string;
  caption: string | null;
  visibility: "public" | "member_only";
  display_order: number;
  is_main: boolean;
};

/**
 * /therapist/[id] — セラピスト詳細ページ
 *
 * 表示要素:
 *  - メイン写真 + サブ写真
 *  - キャッチコピー + 名前 + 基本情報
 *  - タグ / 特徴
 *  - 自己紹介 / メッセージ
 *  - 近日出勤予定（shifts から取得）
 *  - SNSリンク
 *  - 予約CTA
 */

type Therapist = {
  id: number;
  name: string;
  age: number;
  height_cm: number;
  bust: number;
  cup: string;
  photo_url: string;
  sub_photo_urls?: string[];
  status: string;
  entry_date: string;
  catchphrase?: string;
  bio?: string;
  specialty?: string;
  message?: string;
  tags?: string[];
  body_type?: string;
  hair_style?: string;
  hair_color?: string;
  is_pickup?: boolean;
  is_newcomer?: boolean;
  blog_url?: string;
  twitter_url?: string;
  instagram_url?: string;
};

type Shift = {
  id: number;
  therapist_id: number;
  date: string;
  start_time: string;
  end_time: string;
  store_id: number;
};

type Store = { id: number; name: string; shop_display_name?: string };

const timeHM = (t: string) => (t || "").slice(0, 5);
const weekday = (d: string) => {
  const days = ["日", "月", "火", "水", "木", "金", "土"];
  return days[new Date(d + "T00:00:00").getDay()];
};
const fmtDate = (d: string) => {
  const dt = new Date(d + "T00:00:00");
  return `${dt.getMonth() + 1}/${dt.getDate()}(${weekday(d)})`;
};

export default function TherapistDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const therapistId = Number(id);
  const [therapist, setTherapist] = useState<Therapist | null>(null);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mainImage, setMainImage] = useState<string>("");
  const [hpPhotos, setHpPhotos] = useState<HpPhoto[]>([]);
  const [selectedPhoto, setSelectedPhoto] = useState<HpPhoto | null>(null);
  const { customer, isLoggedIn } = useCustomerAuth();
  const isMember = isLoggedIn && !!customer;

  useEffect(() => {
    (async () => {
      if (!therapistId) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      const today = new Date().toISOString().split("T")[0];
      const weekLater = new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0];
      const [tResp, sResp, stResp, pResp] = await Promise.all([
        supabase
          .from("therapists")
          .select("*")
          .eq("id", therapistId)
          .eq("is_public", true)
          .is("deleted_at", null)
          .maybeSingle(),
        supabase
          .from("shifts")
          .select("*")
          .eq("therapist_id", therapistId)
          .gte("date", today)
          .lte("date", weekLater)
          .order("date", { ascending: true }),
        supabase.from("stores").select("id,name,shop_display_name"),
        supabase
          .from("hp_photos")
          .select("*")
          .eq("therapist_id", therapistId)
          .eq("is_active", true)
          .order("display_order", { ascending: true }),
      ]);
      if (!tResp.data) {
        setNotFound(true);
      } else {
        setTherapist(tResp.data);
        // メイン表示用画像: sub_photo_urls[0] 優先、なければ photo_url
        const firstSub = (tResp.data.sub_photo_urls || [])[0];
        setMainImage(firstSub || tResp.data.photo_url || "");
      }
      setShifts(sResp.data || []);
      setStores(stResp.data || []);
      setHpPhotos(pResp.data || []);
      setLoading(false);
    })();
  }, [therapistId]);

  // 会員限定写真 CTA 表示ログ
  useEffect(() => {
    if (!therapistId || isMember || hpPhotos.length === 0) return;
    const memberOnlyCount = hpPhotos.filter((p) => p.visibility === "member_only").length;
    if (memberOnlyCount === 0) return;
    fetch("/api/hp-chatbot-event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "photo_cta",
        view_type: "cta_shown",
        therapist_id: therapistId,
        photo_id: hpPhotos.find((p) => p.visibility === "member_only")?.id,
      }),
    }).catch(() => {});
  }, [therapistId, isMember, hpPhotos]);

  if (loading) {
    return (
      <section style={{ padding: SITE.sp.section }}>
        <LoadingBlock />
      </section>
    );
  }
  if (notFound || !therapist) {
    return (
      <section style={{ padding: `${SITE.sp.section} ${SITE.sp.lg}` }}>
        <div style={{ maxWidth: SITE.layout.maxWidthNarrow, margin: "0 auto" }}>
          <EmptyBlock
            title="セラピストが見つかりません"
            sub="削除された、または公開停止中の可能性があります。"
            link={{ href: "/therapist", label: "セラピスト一覧へ戻る" }}
          />
        </div>
      </section>
    );
  }

  const t = therapist;
  // 表示写真 = sub_photo_urls 最大5枚。データがない場合は photo_url にフォールバック。
  const displayPhotos: { url: string; isMembersOnly: boolean }[] = (() => {
    const subs = (t.sub_photo_urls || []).slice(0, 5);
    let arr: string[] = subs;
    if (arr.length === 0 && t.photo_url) arr = [t.photo_url];
    return arr.map((url, i) => ({
      url,
      // 5枚目（index=4）のみ会員限定。1〜4枚目は誰でも閲覧可。
      isMembersOnly: i === 4,
    }));
  })();
  const subPhotos = displayPhotos.map((p) => p.url);
  const getStoreName = (sid: number) =>
    stores.find((s) => s.id === sid)?.shop_display_name ||
    stores.find((s) => s.id === sid)?.name ||
    "";

  return (
    <>
      {/* ───── HERO 2カラム ───── */}
      <section
        style={{
          padding: `${SITE.sp.section} ${SITE.sp.lg} ${SITE.sp.xxl}`,
          backgroundColor: SITE.color.bgSoft,
        }}
      >
        <div style={{ maxWidth: SITE.layout.maxWidth, margin: "0 auto" }}>
          {/* パンくず */}
          <p
            style={{
              fontFamily: SITE.font.serif,
              fontSize: "11px",
              color: SITE.color.textMuted,
              marginBottom: SITE.sp.lg,
              letterSpacing: SITE.ls.loose,
            }}
          >
            <Link
              href="/"
              style={{ color: SITE.color.textMuted, textDecoration: "none" }}
            >
              トップ
            </Link>
            <span style={{ margin: "0 8px" }}>/</span>
            <Link
              href="/therapist"
              style={{ color: SITE.color.textMuted, textDecoration: "none" }}
            >
              セラピスト
            </Link>
            <span style={{ margin: "0 8px" }}>/</span>
            <span style={{ color: SITE.color.text }}>{t.name}</span>
          </p>

          <div
            className="site-therapist-hero"
            style={{
              display: "grid",
              gridTemplateColumns: "1fr",
              gap: SITE.sp.xl,
            }}
          >
            {/* 写真カラム */}
            <div>
              {/* メイン写真 */}
              {t.catchphrase && (
                <p
                  style={{
                    fontFamily: SITE.font.serif,
                    fontSize: "13px",
                    color: SITE.color.pink,
                    textAlign: "center",
                    marginBottom: 12,
                    letterSpacing: SITE.ls.loose,
                  }}
                >
                  {t.catchphrase}
                </p>
              )}
              <div
                style={{
                  aspectRatio: "3 / 4",
                  backgroundColor: SITE.color.surfaceAlt,
                  overflow: "hidden",
                  marginBottom: 8,
                }}
              >
                {mainImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={mainImage}
                    alt={t.name}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      display: "block",
                    }}
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
                    }}
                  >
                    NO IMAGE
                  </div>
                )}
              </div>
              {/* サブ写真サムネ（最大5枚、5枚目は会員限定モザイク） */}
              {displayPhotos.length > 1 && (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: `repeat(${Math.min(displayPhotos.length, 5)}, 1fr)`,
                    gap: 6,
                  }}
                >
                  {displayPhotos.map((p, i) => {
                    const locked = p.isMembersOnly && !isMember;
                    const active = !locked && mainImage === p.url;
                    if (locked) {
                      return (
                        <Link
                          key={i}
                          href="/mypage?register=1"
                          aria-label="会員限定写真：会員登録で閲覧"
                          style={{
                            position: "relative",
                            display: "block",
                            border: `1px solid ${SITE.color.border}`,
                            aspectRatio: "1 / 1",
                            overflow: "hidden",
                            cursor: "pointer",
                            textDecoration: "none",
                          }}
                          onClick={() => {
                            // CTAクリック計測（既存APIを再利用、photo_id は 0 = sub_photo_urls 5枚目を意味する目印）
                            fetch("/api/hp-chatbot-event", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                action: "photo_cta",
                                view_type: "cta_clicked",
                                therapist_id: therapistId,
                                photo_id: 0,
                              }),
                            }).catch(() => {});
                          }}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={p.url}
                            alt=""
                            style={{
                              width: "100%",
                              height: "100%",
                              objectFit: "cover",
                              display: "block",
                              filter: "blur(14px) brightness(0.85)",
                              transform: "scale(1.2)",
                            }}
                          />
                          <div
                            style={{
                              position: "absolute",
                              inset: 0,
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: 4,
                              background: "rgba(0,0,0,0.18)",
                            }}
                          >
                            <span style={{ fontSize: 18, color: "#ffffff", textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}>🔒</span>
                            <span
                              style={{
                                fontFamily: SITE.font.display,
                                fontSize: 8,
                                color: "#ffffff",
                                letterSpacing: SITE.ls.wide,
                                textShadow: "0 1px 2px rgba(0,0,0,0.5)",
                              }}
                            >
                              MEMBERS
                            </span>
                          </div>
                        </Link>
                      );
                    }
                    return (
                      <button
                        key={i}
                        onClick={() => setMainImage(p.url)}
                        style={{
                          padding: 0,
                          border: active
                            ? `1px solid ${SITE.color.pink}`
                            : `1px solid ${SITE.color.border}`,
                          background: "transparent",
                          cursor: "pointer",
                          aspectRatio: "1 / 1",
                          overflow: "hidden",
                        }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={p.url}
                          alt=""
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                            display: "block",
                          }}
                        />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* プロフィールカラム */}
            <div>
              {/* バッジ */}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
                {t.is_newcomer && (
                  <span
                    style={{
                      padding: "3px 12px",
                      backgroundColor: SITE.color.pink,
                      color: "#ffffff",
                      fontFamily: SITE.font.display,
                      fontSize: "10px",
                      letterSpacing: SITE.ls.wide,
                    }}
                  >
                    NEW
                  </span>
                )}
                {t.is_pickup && (
                  <span
                    style={{
                      padding: "3px 12px",
                      backgroundColor: SITE.color.text,
                      color: "#ffffff",
                      fontFamily: SITE.font.display,
                      fontSize: "10px",
                      letterSpacing: SITE.ls.wide,
                    }}
                  >
                    PICK UP
                  </span>
                )}
              </div>

              <h1
                style={{
                  fontFamily: SITE.font.serif,
                  fontSize: SITE.fs.h1,
                  fontWeight: 500,
                  letterSpacing: SITE.ls.loose,
                  marginBottom: 12,
                  color: SITE.color.text,
                }}
              >
                {t.name}
              </h1>

              {t.specialty && (
                <p
                  style={{
                    fontFamily: SITE.font.serif,
                    fontSize: "14px",
                    color: SITE.color.pink,
                    marginBottom: SITE.sp.lg,
                    letterSpacing: SITE.ls.loose,
                  }}
                >
                  {t.specialty}
                </p>
              )}

              {/* 基本情報テーブル */}
              <dl
                style={{
                  margin: `${SITE.sp.md} 0 ${SITE.sp.xl}`,
                  padding: 0,
                  borderTop: `1px solid ${SITE.color.border}`,
                }}
              >
                {[
                  { k: "年齢", v: t.age ? `${t.age}歳` : "-" },
                  { k: "身長", v: t.height_cm ? `${t.height_cm}cm` : "-" },
                  { k: "カップ", v: t.cup ? `${t.cup}cup` : "-" },
                  { k: "体型", v: t.body_type || "-" },
                  { k: "髪型", v: t.hair_style || "-" },
                  { k: "髪色", v: t.hair_color || "-" },
                ].map((row) => (
                  <div
                    key={row.k}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "80px 1fr",
                      padding: "10px 0",
                      borderBottom: `1px solid ${SITE.color.border}`,
                      fontSize: "13px",
                      letterSpacing: SITE.ls.normal,
                    }}
                  >
                    <dt
                      style={{
                        color: SITE.color.textMuted,
                        fontFamily: SITE.font.serif,
                        fontWeight: 500,
                      }}
                    >
                      {row.k}：
                    </dt>
                    <dd
                      style={{
                        margin: 0,
                        color: SITE.color.text,
                        fontFamily: SITE.font.serif,
                      }}
                    >
                      {row.v}
                    </dd>
                  </div>
                ))}
              </dl>

              {/* タグ */}
              {t.tags && t.tags.length > 0 && (
                <div style={{ marginBottom: SITE.sp.xl }}>
                  <p
                    style={{
                      fontFamily: SITE.font.display,
                      fontSize: "11px",
                      letterSpacing: SITE.ls.wide,
                      color: SITE.color.pink,
                      marginBottom: 10,
                    }}
                  >
                    TAGS
                  </p>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {t.tags.map((tag) => (
                      <span
                        key={tag}
                        style={{
                          padding: "4px 12px",
                          border: `1px solid ${SITE.color.borderPink}`,
                          color: SITE.color.textSub,
                          fontFamily: SITE.font.serif,
                          fontSize: "11px",
                          letterSpacing: SITE.ls.loose,
                        }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* 予約CTA */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  marginBottom: SITE.sp.lg,
                }}
              >
                <Link
                  href={`/schedule?therapist=${t.id}`}
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
                  このセラピストで予約する
                </Link>
                <a
                  href="tel:070-1675-5900"
                  style={{
                    display: "block",
                    padding: "14px 24px",
                    border: `1px solid ${SITE.color.pink}`,
                    color: SITE.color.pink,
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Hiragino Sans", "Noto Sans JP", "Yu Gothic", sans-serif',
                    fontSize: "13px",
                    letterSpacing: SITE.ls.loose,
                    textDecoration: "none",
                    textAlign: "center",
                  }}
                >
                  電話で予約 070-1675-5900
                </a>
              </div>

              {/* SNSリンク（テキストのみ） */}
              {(t.blog_url || t.twitter_url || t.instagram_url) && (
                <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                  {t.blog_url && (
                    <a
                      href={t.blog_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        fontFamily: SITE.font.serif,
                        fontSize: "12px",
                        color: SITE.color.textSub,
                        letterSpacing: SITE.ls.loose,
                        textDecoration: "underline",
                        textUnderlineOffset: 4,
                      }}
                    >
                      写メ日記
                    </a>
                  )}
                  {t.twitter_url && (
                    <a
                      href={t.twitter_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        fontFamily: SITE.font.serif,
                        fontSize: "12px",
                        color: SITE.color.textSub,
                        letterSpacing: SITE.ls.loose,
                        textDecoration: "underline",
                        textUnderlineOffset: 4,
                      }}
                    >
                      X（旧Twitter）
                    </a>
                  )}
                  {t.instagram_url && (
                    <a
                      href={t.instagram_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        fontFamily: SITE.font.serif,
                        fontSize: "12px",
                        color: SITE.color.textSub,
                        letterSpacing: SITE.ls.loose,
                        textDecoration: "underline",
                        textUnderlineOffset: 4,
                      }}
                    >
                      Instagram
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>

          <style>{`
            @media (min-width: 768px) {
              .site-therapist-hero {
                grid-template-columns: 1fr 1fr !important;
                gap: ${SITE.sp.xxl} !important;
              }
            }
          `}</style>
        </div>
      </section>

      {/* ───── GALLERY / 会員限定写真 ───── */}
      {hpPhotos.length > 0 && (
        <section
          style={{
            padding: `${SITE.sp.section} ${SITE.sp.lg}`,
            backgroundColor: "#ffffff",
          }}
        >
          <div style={{ maxWidth: SITE.layout.maxWidth, margin: "0 auto" }}>
            <SectionHeading label="GALLERY" title="フォトギャラリー" />
            <div
              className="site-therapist-gallery"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, 1fr)",
                gap: 8,
                marginTop: SITE.sp.xl,
              }}
            >
              {hpPhotos.map((p) => {
                const locked = p.visibility === "member_only" && !isMember;
                return (
                  <button
                    key={p.id}
                    onClick={() => {
                      if (locked) {
                        // CTAクリックログ
                        fetch("/api/hp-chatbot-event", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            action: "photo_cta", view_type: "cta_clicked",
                            therapist_id: therapistId,
                            photo_id: p.id,
                          }),
                        }).catch(() => {});
                        return;
                      }
                      setSelectedPhoto(p);
                      // 閲覧ログ
                      fetch("/api/hp-chatbot-event", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          action: "photo_view",
                          therapist_id: therapistId,
                          photo_id: p.id,
                          customer_id: customer?.id || null,
                          is_member: isMember,
                        }),
                      }).catch(() => {});
                    }}
                    style={{
                      position: "relative",
                      padding: 0,
                      border: "none",
                      background: "transparent",
                      cursor: locked ? "default" : "zoom-in",
                      aspectRatio: "3 / 4",
                      overflow: "hidden",
                      display: "block",
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.photo_url}
                      alt={p.caption || "photo"}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        display: "block",
                        filter: locked ? "blur(24px) brightness(0.85)" : "none",
                        transform: locked ? "scale(1.15)" : "none",
                        transition: "filter 0.3s",
                      }}
                    />
                    {locked && (
                      <Link
                        href="/mypage"
                        style={{
                          position: "absolute",
                          inset: 0,
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 10,
                          textDecoration: "none",
                          background: "rgba(0,0,0,0.25)",
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          fetch("/api/hp-chatbot-event", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              action: "photo_cta", view_type: "cta_clicked",
                              therapist_id: therapistId,
                              photo_id: p.id,
                            }),
                          }).catch(() => {});
                        }}
                      >
                        <span
                          style={{
                            color: "#ffffff",
                            fontFamily: SITE.font.display,
                            fontSize: "11px",
                            letterSpacing: SITE.ls.wide,
                            textShadow: "0 1px 2px rgba(0,0,0,0.3)",
                          }}
                        >
                          MEMBERS ONLY
                        </span>
                        <span
                          style={{
                            padding: "8px 20px",
                            backgroundColor: SITE.color.pink,
                            color: "#ffffff",
                            fontFamily: SITE.font.serif,
                            fontSize: "11px",
                            letterSpacing: SITE.ls.wide,
                          }}
                        >
                          会員登録して見る
                        </span>
                      </Link>
                    )}
                  </button>
                );
              })}
            </div>

            {/* 非会員向け誘導バナー */}
            {!isMember && hpPhotos.some((p) => p.visibility === "member_only") && (
              <div
                style={{
                  marginTop: SITE.sp.xl,
                  padding: SITE.sp.xl,
                  backgroundColor: SITE.color.pinkSoft,
                  textAlign: "center",
                }}
              >
                <p
                  style={{
                    fontFamily: SITE.font.serif,
                    fontSize: "13px",
                    color: SITE.color.text,
                    marginBottom: 12,
                    letterSpacing: SITE.ls.loose,
                    lineHeight: 1.8,
                  }}
                >
                  会員登録すると、非公開の特別な写真をご覧いただけます
                </p>
                <Link
                  href="/mypage"
                  style={{
                    display: "inline-block",
                    padding: "12px 32px",
                    backgroundColor: SITE.color.pinkDeep,
                    color: "#ffffff",
                    fontFamily: SITE.font.serif,
                    fontSize: "12px",
                    letterSpacing: SITE.ls.wide,
                    textDecoration: "none",
                  }}
                >
                  無料会員登録 / ログイン
                </Link>
              </div>
            )}

            <style>{`
              @media (min-width: ${SITE.bp.md}) {
                .site-therapist-gallery {
                  grid-template-columns: repeat(3, 1fr) !important;
                  gap: 10px !important;
                }
              }
              @media (min-width: ${SITE.bp.lg}) {
                .site-therapist-gallery {
                  grid-template-columns: repeat(4, 1fr) !important;
                }
              }
            `}</style>
          </div>
        </section>
      )}

      {/* ───── 写真拡大モーダル ───── */}
      {selectedPhoto && (
        <div
          onClick={() => setSelectedPhoto(null)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            backgroundColor: "rgba(0,0,0,0.85)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
            cursor: "zoom-out",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={selectedPhoto.photo_url}
            alt={selectedPhoto.caption || ""}
            style={{
              maxWidth: "100%",
              maxHeight: "85vh",
              objectFit: "contain",
              display: "block",
            }}
          />
          {selectedPhoto.caption && (
            <p
              style={{
                position: "absolute",
                bottom: 30,
                left: 0,
                right: 0,
                textAlign: "center",
                color: "#ffffff",
                fontFamily: SITE.font.serif,
                fontSize: "13px",
                letterSpacing: SITE.ls.loose,
                padding: "0 20px",
              }}
            >
              {selectedPhoto.caption}
            </p>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setSelectedPhoto(null);
            }}
            style={{
              position: "absolute",
              top: 20,
              right: 20,
              width: 40,
              height: 40,
              borderRadius: "50%",
              border: "1px solid rgba(255,255,255,0.6)",
              background: "transparent",
              color: "#ffffff",
              fontSize: 20,
              cursor: "pointer",
            }}
          >
            ×
          </button>
        </div>
      )}

      {/* ───── 自己紹介 / メッセージ ───── */}
      {(t.bio || t.message) && (
        <section style={{ padding: `${SITE.sp.section} ${SITE.sp.lg}` }}>
          <div style={{ maxWidth: SITE.layout.maxWidthText, margin: "0 auto" }}>
            {t.bio && (
              <>
                <SectionHeading label="PROFILE" title="自己紹介" />
                <p
                  style={{
                    fontFamily: SITE.font.serif,
                    fontSize: "14px",
                    lineHeight: SITE.lh.loose,
                    color: SITE.color.textSub,
                    letterSpacing: SITE.ls.loose,
                    whiteSpace: "pre-wrap",
                    marginBottom: t.message ? SITE.sp.xxl : 0,
                  }}
                >
                  {t.bio}
                </p>
              </>
            )}
            {t.message && (
              <>
                <SectionHeading label="MESSAGE" title="メッセージ" />
                <p
                  style={{
                    fontFamily: SITE.font.serif,
                    fontSize: "14px",
                    lineHeight: SITE.lh.loose,
                    color: SITE.color.textSub,
                    letterSpacing: SITE.ls.loose,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {t.message}
                </p>
              </>
            )}
          </div>
        </section>
      )}

      {/* ───── 出勤予定 ───── */}
      <section
        style={{
          padding: `${SITE.sp.section} ${SITE.sp.lg}`,
          backgroundColor: SITE.color.bgSoft,
        }}
      >
        <div style={{ maxWidth: SITE.layout.maxWidthNarrow, margin: "0 auto" }}>
          <SectionHeading label="SCHEDULE" title="近日の出勤予定" />
          {shifts.length === 0 ? (
            <p
              style={{
                textAlign: "center",
                color: SITE.color.textMuted,
                fontSize: "13px",
                padding: SITE.sp.xl,
              }}
            >
              今後2週間の出勤予定はまだ登録されていません
            </p>
          ) : (
            <div
              style={{
                backgroundColor: SITE.color.surface,
                border: `1px solid ${SITE.color.border}`,
              }}
            >
              {shifts.map((s, i) => (
                <div
                  key={s.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "90px 1fr auto",
                    gap: 16,
                    padding: "16px 20px",
                    borderBottom:
                      i < shifts.length - 1
                        ? `1px solid ${SITE.color.borderSoft}`
                        : "none",
                    alignItems: "center",
                  }}
                >
                  <p
                    style={{
                      fontFamily: SITE.font.serif,
                      fontSize: "14px",
                      fontWeight: 500,
                      color: SITE.color.text,
                      letterSpacing: SITE.ls.loose,
                    }}
                  >
                    {fmtDate(s.date)}
                  </p>
                  <p
                    style={{
                      fontFamily: SITE.font.display,
                      fontSize: "13px",
                      color: SITE.color.pink,
                      letterSpacing: SITE.ls.loose,
                      fontWeight: 500,
                    }}
                  >
                    {timeHM(s.start_time)} — {timeHM(s.end_time)}
                  </p>
                  <p
                    style={{
                      fontSize: "11px",
                      color: SITE.color.textMuted,
                      letterSpacing: SITE.ls.loose,
                    }}
                  >
                    {getStoreName(s.store_id)}
                  </p>
                </div>
              ))}
            </div>
          )}
          <div style={{ textAlign: "center", marginTop: SITE.sp.xl }}>
            <Link
              href="/schedule"
              style={{
                display: "inline-block",
                padding: "12px 32px",
                border: `1px solid ${SITE.color.pink}`,
                color: SITE.color.pink,
                fontFamily: SITE.font.serif,
                fontSize: "12px",
                letterSpacing: SITE.ls.wide,
                textDecoration: "none",
              }}
              className="site-cta-secondary"
            >
              全セラピストのスケジュールを見る
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
