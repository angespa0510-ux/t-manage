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
  video_url?: string | null;
  video_poster_url?: string | null;
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
  const [reviews, setReviews] = useState<Array<{
    id: number;
    displayName: string;
    rating: number;
    reviewText: string;
    highlights: string[];
    publishedAt: string | null;
    therapistReply: string | null;
    therapistReplyAt: string | null;
  }>>([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  // 🌿 取得バッジ (公開HPでセラピストの専門性を表示するため、Phase 2 機能を一部前倒し)
  type PublicBadge = { id: number; level: string | null; category_name: string; category_emoji: string | null };
  const [skillBadges, setSkillBadges] = useState<PublicBadge[]>([]);
  const { customer, isLoggedIn } = useCustomerAuth();
  const isMember = isLoggedIn && !!customer;

  // レビュー取得（このセラピストへの公開レビューのみ）
  useEffect(() => {
    if (!therapistId) return;
    setReviewsLoading(true);
    fetch(`/api/reviews/public?therapistId=${therapistId}&limit=10`)
      .then((r) => r.json())
      .then((data) => {
        if (data?.reviews) setReviews(data.reviews);
      })
      .catch(() => {})
      .finally(() => setReviewsLoading(false));
  }, [therapistId]);

  // ページ表示時の最初の写真ビュー記録（重複防止のため初回のみ）
  const [didLogInitialView, setDidLogInitialView] = useState(false);
  useEffect(() => {
    if (!therapistId || !therapist || didLogInitialView) return;
    const photoCount = (therapist.sub_photo_urls || []).length || (therapist.photo_url ? 1 : 0);
    if (photoCount === 0) return;
    setDidLogInitialView(true);
    // セッションIDを取得 or 生成
    let sessionId = "";
    try {
      sessionId = sessionStorage.getItem("hp_session_id") || "";
      if (!sessionId) {
        sessionId = Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
        sessionStorage.setItem("hp_session_id", sessionId);
      }
    } catch {}
    fetch("/api/therapist-photo-view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        therapist_id: therapistId,
        photo_index: 0,
        view_type: "view",
        is_member: isMember,
        customer_id: customer?.id || null,
        session_id: sessionId,
      }),
    }).catch(() => {});
  }, [therapistId, therapist, isMember, customer, didLogInitialView]);

  // 写真クリック時のログ送信ヘルパー
  const logPhotoView = (photoIndex: number, viewType: "view" | "thumb_click" | "cta_clicked") => {
    if (!therapistId) return;
    let sessionId = "";
    try { sessionId = sessionStorage.getItem("hp_session_id") || ""; } catch {}
    fetch("/api/therapist-photo-view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        therapist_id: therapistId,
        photo_index: photoIndex,
        view_type: viewType,
        is_member: isMember,
        customer_id: customer?.id || null,
        session_id: sessionId,
      }),
    }).catch(() => {});
  };

  useEffect(() => {
    (async () => {
      if (!therapistId) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      const today = new Date().toISOString().split("T")[0];
      const weekLater = new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0];
      const [tResp, sResp, stResp, pResp, bResp] = await Promise.all([
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
        // 🌿 取得スキルバッジ (training_categories と JOIN)
        supabase
          .from("therapist_skill_badges")
          .select("id, level, training_categories(name, emoji, sort_order)")
          .eq("therapist_id", therapistId)
          .order("acquired_at", { ascending: false }),
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
      // 🌿 取得バッジを公開HP用の形式に整形 (training_categories は JOIN で配列or単一オブジェクトで返る)
      if (bResp.data) {
        const badges: PublicBadge[] = bResp.data.flatMap((b: any) => {
          const cat = Array.isArray(b.training_categories) ? b.training_categories[0] : b.training_categories;
          if (!cat) return [];
          return [{
            id: b.id,
            level: b.level,
            category_name: cat.name,
            category_emoji: cat.emoji,
          }];
        });
        setSkillBadges(badges);
      }
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
                            // 写真アクセス分析（sub_photo_urls の通し index = 4）
                            logPhotoView(i, "cta_clicked");
                            // 既存のチャットボット計測（後方互換）
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
                        onClick={() => {
                          setMainImage(p.url);
                          logPhotoView(i, "thumb_click");
                        }}
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

              {/* 🌿 取得スキル (研修修了バッジ) — 施術業の専門性を顧客に提示 */}
              {skillBadges.length > 0 && (
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
                    SKILLS
                  </p>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {skillBadges.map((b) => (
                      <span
                        key={b.id}
                        title={`${b.category_name} (${(b.level || "BASIC").toUpperCase()})`}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 5,
                          padding: "5px 11px",
                          border: `1px solid ${SITE.color.borderPink}`,
                          backgroundColor: "rgba(232,132,154,0.06)",
                          color: SITE.color.textSub,
                          fontFamily: SITE.font.serif,
                          fontSize: "11px",
                          letterSpacing: SITE.ls.loose,
                        }}
                      >
                        <span style={{ fontSize: "13px", lineHeight: 1 }}>{b.category_emoji || "🏆"}</span>
                        <span>{b.category_name}</span>
                      </span>
                    ))}
                  </div>
                  <p style={{ marginTop: 8, fontSize: "10px", color: SITE.color.textMuted, letterSpacing: SITE.ls.normal, fontFamily: SITE.font.serif, lineHeight: 1.7 }}>
                    所定の社内研修プログラムを修了した証です。
                  </p>
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

      {/* ───── VIDEO / セラピスト紹介動画 ───── */}
      {t.video_url && (
        <section
          style={{
            padding: `${SITE.sp.section} ${SITE.sp.lg}`,
            backgroundColor: SITE.color.bgSoft,
          }}
        >
          <div style={{ maxWidth: SITE.layout.maxWidthNarrow, margin: "0 auto" }}>
            <SectionHeading label="VIDEO" title="セラピスト紹介動画" />
            <div
              style={{
                backgroundColor: "#000",
                aspectRatio: "9 / 16",
                maxWidth: 420,
                margin: "0 auto",
                overflow: "hidden",
                position: "relative",
              }}
            >
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <video
                src={t.video_url}
                poster={t.video_poster_url || undefined}
                controls
                playsInline
                preload="metadata"
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  display: "block",
                }}
              />
            </div>
            <p
              style={{
                marginTop: SITE.sp.md,
                textAlign: "center",
                fontSize: 11,
                color: SITE.color.textMuted,
                fontFamily: SITE.font.serif,
                letterSpacing: SITE.ls.loose,
              }}
            >
              {t.name} さんからのメッセージ動画
            </p>
          </div>
        </section>
      )}

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

      {/* ───── お客様の声（このセラピスト宛のレビュー） ───── */}
      {(reviewsLoading || reviews.length > 0) && (
        <section
          style={{
            padding: `${SITE.sp.section} ${SITE.sp.lg}`,
            backgroundColor: SITE.color.surface,
          }}
        >
          <div style={{ maxWidth: SITE.layout.maxWidthNarrow, margin: "0 auto" }}>
            <SectionHeading label="VOICES" title="お客様の声" />
            {reviewsLoading ? (
              <p
                style={{
                  textAlign: "center",
                  color: SITE.color.textMuted,
                  fontSize: "13px",
                  padding: SITE.sp.xl,
                }}
              >
                読み込み中...
              </p>
            ) : (
              <>
                {/* 平均評価 */}
                {reviews.length > 0 && (() => {
                  const avg = reviews.reduce((s, r) => s + (r.rating || 0), 0) / reviews.length;
                  return (
                    <div
                      style={{
                        textAlign: "center",
                        marginBottom: SITE.sp.xl,
                        padding: `${SITE.sp.md} ${SITE.sp.lg}`,
                        backgroundColor: SITE.color.pinkSoft,
                        border: `1px solid ${SITE.color.borderPink}`,
                      }}
                    >
                      <p
                        style={{
                          fontFamily: SITE.font.display,
                          fontSize: 11,
                          color: SITE.color.textMuted,
                          letterSpacing: SITE.ls.wide,
                          marginBottom: 6,
                        }}
                      >
                        AVERAGE RATING
                      </p>
                      <p
                        style={{
                          color: SITE.color.pinkDeep,
                          fontSize: 22,
                          letterSpacing: 3,
                          marginBottom: 4,
                        }}
                      >
                        {"★".repeat(Math.round(avg))}
                        <span style={{ color: SITE.color.borderPink }}>
                          {"★".repeat(5 - Math.round(avg))}
                        </span>
                      </p>
                      <p style={{ fontSize: 12, color: SITE.color.text, fontFamily: SITE.font.serif }}>
                        {avg.toFixed(1)} <span style={{ fontSize: 10, color: SITE.color.textMuted }}>({reviews.length}件)</span>
                      </p>
                    </div>
                  );
                })()}
                {/* レビュー一覧 */}
                <div style={{ display: "flex", flexDirection: "column", gap: SITE.sp.md }}>
                  {reviews.map((rv) => {
                    const date = rv.publishedAt
                      ? new Date(rv.publishedAt).toLocaleDateString("ja-JP", { year: "numeric", month: "short", day: "numeric" })
                      : null;
                    return (
                      <div
                        key={rv.id}
                        style={{
                          backgroundColor: SITE.color.surfaceAlt,
                          border: `1px solid ${SITE.color.border}`,
                          padding: 0,
                        }}
                      >
                        {/* ヘッダー：星評価＋日付 */}
                        <div
                          style={{
                            padding: "12px 16px",
                            backgroundColor: SITE.color.pinkSoft,
                            borderBottom: `1px solid ${SITE.color.borderPink}`,
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          <span style={{ color: SITE.color.pinkDeep, fontSize: 14, letterSpacing: 2 }}>
                            {"★".repeat(rv.rating)}
                            <span style={{ color: SITE.color.borderPink }}>{"★".repeat(5 - rv.rating)}</span>
                          </span>
                          {date && (
                            <span style={{ fontSize: 10, color: SITE.color.textMuted, fontFamily: SITE.font.display, letterSpacing: 1 }}>
                              {date}
                            </span>
                          )}
                        </div>
                        {/* 本文 */}
                        <div style={{ padding: 16 }}>
                          {rv.reviewText && (
                            <p
                              style={{
                                fontSize: 13,
                                lineHeight: 1.85,
                                color: SITE.color.text,
                                margin: 0,
                                marginBottom: 10,
                                fontFamily: SITE.font.serif,
                                whiteSpace: "pre-wrap",
                              }}
                            >
                              {rv.reviewText}
                            </p>
                          )}
                          {rv.highlights.length > 0 && (
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 10 }}>
                              {rv.highlights.slice(0, 5).map((h) => (
                                <span
                                  key={h}
                                  style={{
                                    fontSize: 10,
                                    padding: "2px 8px",
                                    backgroundColor: SITE.color.surface,
                                    color: SITE.color.pinkDeep,
                                    border: `1px solid ${SITE.color.borderPink}`,
                                    fontFamily: SITE.font.serif,
                                  }}
                                >
                                  {h}
                                </span>
                              ))}
                            </div>
                          )}
                          <p
                            style={{
                              fontSize: 11,
                              color: SITE.color.textMuted,
                              margin: 0,
                              fontFamily: SITE.font.serif,
                              paddingTop: 10,
                              borderTop: `1px dashed ${SITE.color.border}`,
                            }}
                          >
                            {rv.displayName}
                          </p>
                        </div>
                        {/* セラピスト返信 */}
                        {rv.therapistReply && (
                          <div
                            style={{
                              margin: "0 16px 16px",
                              padding: "12px 14px",
                              backgroundColor: SITE.color.surface,
                              border: `1px dashed ${SITE.color.borderPink}`,
                              fontSize: 12,
                              color: SITE.color.text,
                              fontFamily: SITE.font.serif,
                              lineHeight: 1.8,
                              whiteSpace: "pre-wrap",
                            }}
                          >
                            <p style={{ margin: 0, marginBottom: 6, fontSize: 10, color: SITE.color.pinkDeep, letterSpacing: SITE.ls.wide }}>
                              {therapist.name} からの返信
                            </p>
                            {rv.therapistReply}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {/* もっと見る */}
                <div style={{ textAlign: "center", marginTop: SITE.sp.xl }}>
                  <Link
                    href="/reviews"
                    style={{
                      display: "inline-block",
                      padding: "10px 28px",
                      border: `1px solid ${SITE.color.pink}`,
                      color: SITE.color.pink,
                      fontFamily: SITE.font.serif,
                      fontSize: "12px",
                      letterSpacing: SITE.ls.wide,
                      textDecoration: "none",
                    }}
                  >
                    全セラピストのお客様の声を見る
                  </Link>
                </div>
              </>
            )}
          </div>
        </section>
      )}
    </>
  );
}
