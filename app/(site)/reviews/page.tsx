"use client";

/**
 * ═══════════════════════════════════════════════════════════
 * HP公開「お客様の声」ページ（リニューアル版）
 *
 * URL: /reviews
 *
 * 機能:
 *  - hp_published=true のみ表示
 *  - セラピストサムネイル + 名前 + 詳細リンク
 *  - セラピスト絞り込み（写真付きピル）
 *  - 印象ポイントタグ
 *  - セラピスト返信（吹き出し風）
 *  - 評価サマリー強化
 *  - お客様名はイニシャル＋年代表記
 *  - ヘッダー動画 voices.mp4
 *
 * 設計書の絶対原則: 身バレリスクへの最大限の配慮
 * ═══════════════════════════════════════════════════════════
 */

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { SITE } from "../../../lib/site-theme";
import SectionHeading from "../../../components/site/SectionHeading";
import { PageHero, LoadingBlock } from "../../../components/site/SiteLayoutParts";

type Review = {
  id: number;
  displayName: string;
  rating: number;
  reviewText: string;
  highlights: string[];
  publishedAt: string;
  therapistId: number | null;
  therapistName: string;
  therapistPhotoUrl: string | null;
  therapistReply: string | null;
  therapistReplyAt: string | null;
};

type TherapistSummary = {
  id: number;
  name: string;
  photoUrl: string | null;
  reviewCount: number;
  avgRating: number;
};

const PAGE_SIZE = 12;

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [therapists, setTherapists] = useState<TherapistSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [therapistFilter, setTherapistFilter] = useState<number>(0);

  useEffect(() => {
    void Promise.all([fetchReviews(0, 0), fetchTherapists()]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void fetchReviews(0, therapistFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [therapistFilter]);

  const fetchReviews = async (offset: number, thId: number) => {
    if (offset === 0) setLoading(true);
    else setLoadingMore(true);
    try {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) });
      if (thId) params.set("therapistId", String(thId));
      const res = await fetch(`/api/reviews/public?${params.toString()}`);
      const data = await res.json();
      if (offset === 0) setReviews(data.reviews || []);
      else setReviews((prev) => [...prev, ...(data.reviews || [])]);
      setTotal(data.total || 0);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const fetchTherapists = async () => {
    try {
      const res = await fetch("/api/reviews/therapists");
      const data = await res.json();
      setTherapists(data.therapists || []);
    } catch (e) {
      console.error(e);
    }
  };

  const hasMore = reviews.length < total;

  const avgRating = useMemo(() => {
    if (reviews.length === 0) return 0;
    return reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
  }, [reviews]);

  return (
    <div style={{ backgroundColor: SITE.color.bg, color: SITE.color.text, minHeight: "100vh" }}>
      <PageHero
        label="VOICES"
        title="お客様の声"
        subtitle="施術後にご回答いただいたアンケートから、ご同意いただいたご感想を掲載しております。"
        bgVideo="/videos/voices.mp4"
      />

      <main style={{ maxWidth: 1080, margin: "0 auto", padding: "32px 16px 80px" }}>
        {/* サマリーカード */}
        {!loading && reviews.length > 0 && (
          <SummaryCard total={total} avgRating={avgRating} />
        )}

        {/* セラピスト絞り込み */}
        {therapists.length > 0 && (
          <TherapistFilter
            therapists={therapists}
            selected={therapistFilter}
            onChange={setTherapistFilter}
          />
        )}

        {/* レビュー一覧 */}
        {loading ? (
          <LoadingBlock />
        ) : reviews.length === 0 ? (
          <EmptyState filtered={therapistFilter > 0} />
        ) : (
          <>
            <SectionHeading
              label="REVIEWS"
              title={therapistFilter > 0
                ? `${therapists.find((t) => t.id === therapistFilter)?.name || ""}へのご感想`
                : "ご感想"}
            />
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
                gap: 20,
                marginBottom: 32,
              }}
            >
              {reviews.map((r) => (
                <div key={r.id}>
                  <ReviewCard review={r} />
                </div>
              ))}
            </div>

            {hasMore && (
              <div style={{ textAlign: "center" }}>
                <button
                  onClick={() => void fetchReviews(reviews.length, therapistFilter)}
                  disabled={loadingMore}
                  style={{
                    padding: "14px 32px",
                    fontSize: 12,
                    backgroundColor: SITE.color.pink,
                    color: "#fff",
                    border: "none",
                    cursor: loadingMore ? "wait" : "pointer",
                    fontFamily: SITE.font.serif,
                    letterSpacing: 2,
                  }}
                >
                  {loadingMore ? "読み込み中…" : `もっと見る（残り ${total - reviews.length} 件）`}
                </button>
              </div>
            )}
          </>
        )}

        {/* お客様への投稿のお願い */}
        <CallToActionCard />
      </main>
    </div>
  );
}

// ─────────────────────────────────────
// サマリーカード（強化版）
// ─────────────────────────────────────

function SummaryCard({ total, avgRating }: { total: number; avgRating: number }) {
  return (
    <div
      style={{
        padding: "32px 24px",
        backgroundColor: "#fff",
        background: `linear-gradient(135deg, ${SITE.color.pinkSoft} 0%, #fff 100%)`,
        border: `1px solid ${SITE.color.borderPink}`,
        marginBottom: 32,
        textAlign: "center",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* 装飾 */}
      <div
        style={{
          position: "absolute",
          top: -20,
          right: -20,
          width: 120,
          height: 120,
          borderRadius: "50%",
          backgroundColor: SITE.color.pinkSoft,
          opacity: 0.4,
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: -30,
          left: -30,
          width: 80,
          height: 80,
          borderRadius: "50%",
          backgroundColor: SITE.color.pinkSoft,
          opacity: 0.3,
        }}
      />

      <div style={{ position: "relative" }}>
        <p
          style={{
            fontFamily: SITE.font.display,
            fontSize: 11,
            color: SITE.color.pink,
            letterSpacing: 4,
            marginBottom: 8,
          }}
        >
          OVERALL RATING
        </p>
        <p style={{ fontSize: 11, color: SITE.color.textMuted, marginBottom: 12 }}>
          掲載中のご感想 <strong style={{ color: SITE.color.text }}>{total}</strong> 件 の平均評価
        </p>
        <div style={{ marginBottom: 8 }}>
          <span
            style={{
              color: SITE.color.pink,
              fontSize: 32,
              letterSpacing: 6,
              lineHeight: 1,
              textShadow: `0 2px 8px ${SITE.color.borderPink}`,
            }}
          >
            {"★".repeat(Math.round(avgRating))}
            <span style={{ color: SITE.color.borderPink }}>{"★".repeat(5 - Math.round(avgRating))}</span>
          </span>
        </div>
        <p
          style={{
            fontFamily: SITE.font.display,
            fontSize: 36,
            color: SITE.color.text,
            margin: 0,
            fontWeight: 300,
            letterSpacing: 2,
          }}
        >
          {avgRating.toFixed(2)}
          <span style={{ fontSize: 14, color: SITE.color.textMuted, marginLeft: 6 }}>/ 5.00</span>
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────
// セラピスト絞り込み（写真付きピル）
// ─────────────────────────────────────

function TherapistFilter({
  therapists,
  selected,
  onChange,
}: {
  therapists: TherapistSummary[];
  selected: number;
  onChange: (id: number) => void;
}) {
  return (
    <div style={{ marginBottom: 32 }}>
      <p
        style={{
          fontFamily: SITE.font.display,
          fontSize: 10,
          color: SITE.color.pink,
          letterSpacing: 3,
          marginBottom: 12,
          textAlign: "center",
        }}
      >
        FILTER BY THERAPIST
      </p>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          justifyContent: "center",
          overflowX: "auto",
          paddingBottom: 8,
        }}
      >
        <button
          onClick={() => onChange(0)}
          style={pillStyle(selected === 0)}
        >
          すべて（{therapists.reduce((s, t) => s + t.reviewCount, 0)}）
        </button>
        {therapists.map((t) => (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            style={{ ...pillStyle(selected === t.id), padding: "4px 14px 4px 4px" }}
          >
            <span
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                backgroundColor: SITE.color.pinkSoft,
                backgroundImage: t.photoUrl ? `url(${t.photoUrl})` : undefined,
                backgroundSize: "cover",
                backgroundPosition: "center",
                marginRight: 8,
                flexShrink: 0,
                border: selected === t.id ? `2px solid #fff` : `1px solid ${SITE.color.borderPink}`,
                display: "inline-block",
                verticalAlign: "middle",
              }}
            />
            <span style={{ verticalAlign: "middle" }}>
              {t.name}
              <span style={{ fontSize: 10, opacity: 0.7, marginLeft: 4 }}>({t.reviewCount})</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function pillStyle(selected: boolean): React.CSSProperties {
  return {
    padding: "6px 14px",
    fontSize: 12,
    backgroundColor: selected ? SITE.color.pink : "#fff",
    color: selected ? "#fff" : SITE.color.text,
    border: `1px solid ${selected ? SITE.color.pink : SITE.color.borderPink}`,
    cursor: "pointer",
    fontFamily: SITE.font.serif,
    transition: "all 0.2s",
    whiteSpace: "nowrap",
    display: "inline-flex",
    alignItems: "center",
  };
}

// ─────────────────────────────────────
// レビューカード（強化版）
// ─────────────────────────────────────

function ReviewCard({ review }: { review: Review }) {
  const date = review.publishedAt
    ? new Date(review.publishedAt).toLocaleDateString("ja-JP", { year: "numeric", month: "long" })
    : "";

  return (
    <article
      style={{
        backgroundColor: "#fff",
        border: `1px solid ${SITE.color.border}`,
        position: "relative",
        transition: "transform 0.2s, box-shadow 0.2s",
        display: "flex",
        flexDirection: "column",
        height: "100%",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.boxShadow = `0 8px 24px ${SITE.color.borderPink}40`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      {/* 評価ヘッダー */}
      <div
        style={{
          padding: "16px 20px",
          backgroundColor: SITE.color.pinkSoft,
          borderBottom: `1px solid ${SITE.color.borderPink}`,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span style={{ color: SITE.color.pinkDeep, fontSize: 16, letterSpacing: 2 }}>
          {"★".repeat(review.rating)}
          <span style={{ color: SITE.color.borderPink }}>{"★".repeat(5 - review.rating)}</span>
        </span>
        {date && (
          <span style={{ fontSize: 10, color: SITE.color.textMuted, fontFamily: SITE.font.display, letterSpacing: 1 }}>
            {date}
          </span>
        )}
      </div>

      {/* セラピスト情報 */}
      {review.therapistId && (
        <Link
          href={`/therapist/${review.therapistId}`}
          style={{
            padding: "14px 20px",
            display: "flex",
            alignItems: "center",
            gap: 12,
            borderBottom: `1px dashed ${SITE.color.border}`,
            textDecoration: "none",
            color: SITE.color.text,
            transition: "background-color 0.15s",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = SITE.color.surfaceAlt; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
        >
          <span
            style={{
              width: 44,
              height: 44,
              borderRadius: "50%",
              backgroundColor: SITE.color.pinkSoft,
              backgroundImage: review.therapistPhotoUrl ? `url(${review.therapistPhotoUrl})` : undefined,
              backgroundSize: "cover",
              backgroundPosition: "center",
              flexShrink: 0,
              border: `2px solid ${SITE.color.borderPink}`,
            }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 11, color: SITE.color.textMuted, margin: 0, marginBottom: 2 }}>
              担当セラピスト
            </p>
            <p style={{ fontSize: 14, color: SITE.color.text, margin: 0, fontFamily: SITE.font.serif, fontWeight: 500 }}>
              {review.therapistName}
              <span style={{ fontSize: 10, color: SITE.color.pink, marginLeft: 6 }}>→ プロフィール</span>
            </p>
          </div>
        </Link>
      )}

      {/* 本文 */}
      <div style={{ padding: 20, flex: 1, display: "flex", flexDirection: "column", gap: 14 }}>
        <p
          style={{
            fontSize: 13,
            lineHeight: 1.95,
            color: SITE.color.text,
            margin: 0,
            fontFamily: SITE.font.serif,
            whiteSpace: "pre-wrap",
            flex: 1,
          }}
        >
          {review.reviewText || <span style={{ color: SITE.color.textMuted }}>（自由記述なし／★評価のみ）</span>}
        </p>

        {/* ハイライト */}
        {review.highlights.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {review.highlights.slice(0, 5).map((h) => (
              <span
                key={h}
                style={{
                  fontSize: 10,
                  padding: "3px 8px",
                  backgroundColor: SITE.color.pinkSoft,
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

        {/* 投稿者 */}
        <div
          style={{
            paddingTop: 12,
            borderTop: `1px dashed ${SITE.color.border}`,
            fontSize: 11,
            color: SITE.color.textMuted,
            fontFamily: SITE.font.serif,
          }}
        >
          {review.displayName}
        </div>
      </div>

      {/* セラピスト返信（あれば吹き出し） */}
      {review.therapistReply && (
        <div
          style={{
            margin: "0 20px 20px",
            padding: "14px 16px",
            backgroundColor: SITE.color.surfaceAlt,
            border: `1px solid ${SITE.color.borderPink}`,
            position: "relative",
            borderRadius: 4,
          }}
        >
          {/* 吹き出しの三角 */}
          <div
            style={{
              position: "absolute",
              top: -6,
              left: 24,
              width: 12,
              height: 12,
              backgroundColor: SITE.color.surfaceAlt,
              borderTop: `1px solid ${SITE.color.borderPink}`,
              borderLeft: `1px solid ${SITE.color.borderPink}`,
              transform: "rotate(45deg)",
            }}
          />
          <p
            style={{
              fontSize: 10,
              color: SITE.color.pink,
              fontFamily: SITE.font.display,
              letterSpacing: 2,
              margin: 0,
              marginBottom: 6,
            }}
          >
            REPLY FROM {review.therapistName.toUpperCase()}
          </p>
          <p
            style={{
              fontSize: 12,
              lineHeight: 1.85,
              color: SITE.color.text,
              fontFamily: SITE.font.serif,
              margin: 0,
              whiteSpace: "pre-wrap",
            }}
          >
            {review.therapistReply}
          </p>
        </div>
      )}
    </article>
  );
}

// ─────────────────────────────────────
// 空状態
// ─────────────────────────────────────

function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <div style={{ textAlign: "center", padding: "64px 16px" }}>
      <p style={{ color: SITE.color.text, fontSize: 14, marginBottom: 8 }}>
        {filtered ? "該当のご感想はまだございません" : "まだご感想の掲載はございません"}
      </p>
      <p style={{ color: SITE.color.textMuted, fontSize: 12 }}>
        アンケートにご協力いただいたお客様、ありがとうございます🌸
      </p>
    </div>
  );
}

// ─────────────────────────────────────
// CTA
// ─────────────────────────────────────

function CallToActionCard() {
  return (
    <div
      style={{
        marginTop: 64,
        padding: "32px 24px",
        backgroundColor: SITE.color.pinkSoft,
        border: `1px solid ${SITE.color.borderPink}`,
        textAlign: "center",
      }}
    >
      <p
        style={{
          fontFamily: SITE.font.display,
          fontSize: 11,
          color: SITE.color.pink,
          letterSpacing: 4,
          marginBottom: 8,
        }}
      >
        FOR OUR GUESTS
      </p>
      <h3 style={{ fontSize: 18, color: SITE.color.text, margin: 0, marginBottom: 12, fontWeight: 500, fontFamily: SITE.font.serif }}>
        ご来店いただいたお客様へ
      </h3>
      <p style={{ fontSize: 13, color: SITE.color.textSub, lineHeight: 1.9, marginBottom: 20, fontFamily: SITE.font.serif }}>
        ご感想・ご要望をお聞かせください。<br />
        ご回答いただいた方には、次回ご来店時に1,000円OFFを自動適用いたします🌸
      </p>
      <Link
        href="/survey"
        style={{
          display: "inline-block",
          padding: "14px 32px",
          fontSize: 13,
          backgroundColor: SITE.color.pinkDeep,
          color: "#fff",
          textDecoration: "none",
          fontFamily: SITE.font.serif,
          letterSpacing: 2,
        }}
      >
        🌸 アンケートに回答する
      </Link>
    </div>
  );
}
