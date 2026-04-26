"use client";

/**
 * ═══════════════════════════════════════════════════════════
 * HP公開「お客様の声」ページ
 *
 * URL: /reviews
 *
 * - hp_published = true のレビューのみ表示
 * - 個人情報を含まない（hp_display_name のみ）
 * - HPテーマ統一（マーブルピンク・明朝体）
 * - 無限スクロール or もっと見るボタン
 *
 * 設計書の絶対原則:
 *   お客様の身バレリスクへの最大限の配慮
 * ═══════════════════════════════════════════════════════════
 */

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { SITE, MARBLE } from "../../../lib/site-theme";
import SectionHeading from "../../../components/site/SectionHeading";
import { PageHero, LoadingBlock } from "../../../components/site/SiteLayoutParts";

type Review = {
  id: number;
  displayName: string;
  rating: number;
  reviewText: string;
  highlights: string[];
  publishedAt: string;
  therapistName: string;
};

const PAGE_SIZE = 12;

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    void fetchReviews(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchReviews = async (offset: number) => {
    if (offset === 0) setLoading(true); else setLoadingMore(true);
    try {
      const res = await fetch(`/api/reviews/public?limit=${PAGE_SIZE}&offset=${offset}`);
      const data = await res.json();
      if (offset === 0) {
        setReviews(data.reviews || []);
      } else {
        setReviews((prev) => [...prev, ...(data.reviews || [])]);
      }
      setTotal(data.total || 0);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const hasMore = reviews.length < total;

  // 平均評価を計算
  const avgRating = useMemo(() => {
    if (reviews.length === 0) return 0;
    return reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
  }, [reviews]);

  return (
    <div style={{ backgroundColor: SITE.color.bg, color: SITE.color.text, minHeight: "100vh" }}>
      {/* ヒーロー */}
      <PageHero
        label="VOICES"
        title="お客様の声"
        subtitle="施術後にご回答いただいたアンケートから、ご同意いただいたご感想を掲載しております。"
      />

      <main style={{ maxWidth: 960, margin: "0 auto", padding: "32px 16px 80px" }}>
        {/* サマリー */}
        {!loading && reviews.length > 0 && (
          <div
            style={{
              padding: 20,
              backgroundColor: "#fff",
              border: `1px solid ${SITE.color.border}`,
              marginBottom: 24,
              textAlign: "center",
            }}
          >
            <p style={{ fontSize: 12, color: SITE.color.textMuted, marginBottom: 4 }}>
              掲載中のご感想（{total} 件）の平均評価
            </p>
            <p style={{ fontSize: 28, color: SITE.color.pink, letterSpacing: 4, margin: "8px 0" }}>
              {"★".repeat(Math.round(avgRating))}
              <span style={{ color: SITE.color.borderPink }}>{"★".repeat(5 - Math.round(avgRating))}</span>
            </p>
            <p style={{ fontSize: 14, color: SITE.color.text, margin: 0 }}>
              {avgRating.toFixed(2)} <span style={{ fontSize: 11, color: SITE.color.textMuted }}>/ 5.00</span>
            </p>
          </div>
        )}

        {/* レビュー一覧 */}
        {loading ? (
          <LoadingBlock />
        ) : reviews.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 16px" }}>
            <p style={{ color: SITE.color.textMuted, fontSize: 14 }}>
              まだご感想の掲載はございません
            </p>
            <p style={{ color: SITE.color.textMuted, fontSize: 12, marginTop: 8 }}>
              アンケートにご協力いただいたお客様、ありがとうございます🌸
            </p>
          </div>
        ) : (
          <>
            <SectionHeading label="REVIEWS" title="ご感想" />
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                gap: 16,
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
                  onClick={() => void fetchReviews(reviews.length)}
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

        {/* 投稿のお願い */}
        <div
          style={{
            marginTop: 64,
            padding: 24,
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
              letterSpacing: 3,
              marginBottom: 8,
            }}
          >
            FOR OUR GUESTS
          </p>
          <h3 style={{ fontSize: 16, color: SITE.color.text, margin: 0, marginBottom: 12, fontWeight: 500 }}>
            ご来店いただいたお客様へ
          </h3>
          <p style={{ fontSize: 12, color: SITE.color.textSub, lineHeight: 1.8, marginBottom: 16 }}>
            ご感想・ご要望をお聞かせください。<br />
            ご回答いただいた方には、次回ご来店時に1,000円OFFを自動適用いたします🌸
          </p>
          <Link
            href="/survey"
            style={{
              display: "inline-block",
              padding: "12px 24px",
              fontSize: 12,
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
      </main>
    </div>
  );
}

// ─────────────────────────────────────
// カード
// ─────────────────────────────────────

function ReviewCard({ review }: { review: Review }) {
  const date = review.publishedAt
    ? new Date(review.publishedAt).toLocaleDateString("ja-JP", { year: "numeric", month: "long" })
    : "";

  return (
    <article
      style={{
        padding: 20,
        backgroundColor: "#fff",
        border: `1px solid ${SITE.color.border}`,
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      {/* 評価 */}
      <div>
        <p
          style={{
            color: SITE.color.pink,
            fontSize: 16,
            letterSpacing: 2,
            margin: 0,
            lineHeight: 1,
          }}
        >
          {"★".repeat(review.rating)}
          <span style={{ color: SITE.color.borderPink }}>{"★".repeat(5 - review.rating)}</span>
        </p>
      </div>

      {/* 文章 */}
      <p
        style={{
          fontSize: 12.5,
          lineHeight: 1.9,
          color: SITE.color.text,
          margin: 0,
          fontFamily: SITE.font.serif,
          whiteSpace: "pre-wrap",
          flex: 1,
        }}
      >
        {review.reviewText}
      </p>

      {/* ハイライト */}
      {review.highlights && review.highlights.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {review.highlights.slice(0, 4).map((h) => (
            <span
              key={h}
              style={{
                fontSize: 10,
                padding: "3px 8px",
                backgroundColor: SITE.color.pinkSoft,
                color: SITE.color.pinkDeep,
                border: `1px solid ${SITE.color.borderPink}`,
              }}
            >
              {h}
            </span>
          ))}
        </div>
      )}

      {/* フッター */}
      <div
        style={{
          paddingTop: 12,
          borderTop: `1px dashed ${SITE.color.border}`,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: 11,
          color: SITE.color.textMuted,
        }}
      >
        <span style={{ color: SITE.color.text, fontFamily: SITE.font.serif }}>
          {review.displayName}
        </span>
        {date && <span>{date}</span>}
      </div>
    </article>
  );
}
