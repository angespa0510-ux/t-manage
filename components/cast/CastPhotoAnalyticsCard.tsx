"use client";

import { useEffect, useState } from "react";

type ViewCount = {
  photo_index: number;
  view_count: number;
  view_count_member: number;
  view_count_public: number;
  thumb_click_count: number;
  cta_click_count: number;
  last_viewed_at: string | null;
};

type ColorTheme = {
  card: string;
  cardAlt: string;
  border: string;
  text: string;
  textSub: string;
  textMuted: string;
  textFaint: string;
  accent: string;
};

/**
 * セラピストマイページ HOME 用の写真分析カード
 *
 * 各サブ写真（最大5枚）について、HPでの閲覧数をシンプルに表示する。
 * 5枚目は会員限定写真で、CTA クリック数も併記。
 */
export default function CastPhotoAnalyticsCard({
  therapistId,
  subPhotoUrls,
  C,
  FONT_SERIF,
  FONT_DISPLAY,
}: {
  therapistId: number;
  subPhotoUrls: string[];
  C: ColorTheme;
  FONT_SERIF: string;
  FONT_DISPLAY: string;
}) {
  const [counts, setCounts] = useState<ViewCount[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!therapistId) return;
    setLoading(true);
    fetch(`/api/therapist-photo-view?therapist_id=${therapistId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data?.counts) setCounts(data.counts);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [therapistId]);

  // 写真がなければカード自体を非表示
  if (subPhotoUrls.length === 0 && !loading) return null;

  const totalViews = counts.reduce(
    (s, c) => s + (c.view_count || 0) + (c.thumb_click_count || 0),
    0
  );
  const totalCta = counts.reduce((s, c) => s + (c.cta_click_count || 0), 0);

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* セクション見出し */}
      <div style={{ textAlign: "center" }}>
        <p
          style={{
            fontFamily: FONT_DISPLAY,
            fontSize: 10,
            letterSpacing: "0.2em",
            color: C.textMuted,
            marginBottom: 6,
            fontWeight: 500,
          }}
        >
          PHOTO ANALYTICS
        </p>
        <p
          style={{
            fontFamily: FONT_SERIF,
            fontSize: 13,
            letterSpacing: "0.08em",
            color: C.text,
            fontWeight: 500,
          }}
        >
          📊 私の写真の人気度
        </p>
      </div>

      {/* サマリー */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 8,
        }}
      >
        <div
          style={{
            padding: "12px",
            backgroundColor: C.card,
            border: `1px solid ${C.border}`,
            textAlign: "center",
          }}
        >
          <p style={{ fontSize: 9, color: C.textMuted, fontFamily: FONT_DISPLAY, letterSpacing: "0.15em", marginBottom: 4 }}>
            TOTAL VIEWS
          </p>
          <p style={{ fontSize: 22, color: C.text, fontFamily: FONT_SERIF, fontWeight: 500 }}>
            {totalViews >= 1000 ? `${(totalViews / 1000).toFixed(1)}k` : totalViews}
          </p>
          <p style={{ fontSize: 9, color: C.textMuted, marginTop: 2 }}>累計閲覧</p>
        </div>
        <div
          style={{
            padding: "12px",
            backgroundColor: C.card,
            border: `1px solid ${C.border}`,
            textAlign: "center",
          }}
        >
          <p style={{ fontSize: 9, color: C.textMuted, fontFamily: FONT_DISPLAY, letterSpacing: "0.15em", marginBottom: 4 }}>
            MEMBER CTA
          </p>
          <p style={{ fontSize: 22, color: C.accent, fontFamily: FONT_SERIF, fontWeight: 500 }}>
            {totalCta}
          </p>
          <p style={{ fontSize: 9, color: C.textMuted, marginTop: 2 }}>会員登録誘導</p>
        </div>
      </div>

      {/* 写真ごと閲覧数 */}
      {subPhotoUrls.length > 0 && (
        <div
          style={{
            backgroundColor: C.card,
            border: `1px solid ${C.border}`,
            padding: "12px",
          }}
        >
          <p
            style={{
              fontSize: 10,
              color: C.textSub,
              marginBottom: 10,
              fontFamily: FONT_SERIF,
              letterSpacing: "0.05em",
            }}
          >
            写真ごとの閲覧数
          </p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${Math.min(subPhotoUrls.length, 5)}, 1fr)`,
              gap: 6,
            }}
          >
            {subPhotoUrls.slice(0, 5).map((url, i) => {
              const stat = counts.find((c) => c.photo_index === i);
              const total = (stat?.view_count || 0) + (stat?.thumb_click_count || 0);
              const isMembers = i === 4;
              return (
                <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <div
                    style={{
                      position: "relative",
                      width: "100%",
                      aspectRatio: "3 / 4",
                      overflow: "hidden",
                      border: `1px solid ${isMembers ? "#e8849a88" : C.border}`,
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt={`photo-${i}`}
                      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                    />
                    {isMembers && (
                      <span
                        style={{
                          position: "absolute",
                          top: 2,
                          left: 2,
                          fontSize: 8,
                          padding: "1px 5px",
                          backgroundColor: "#e8849a",
                          color: "#fff",
                          fontWeight: 600,
                          letterSpacing: 0,
                        }}
                      >
                        🔒
                      </span>
                    )}
                  </div>
                  <p
                    style={{
                      fontSize: 11,
                      color: C.text,
                      fontFamily: FONT_SERIF,
                      fontWeight: 500,
                      marginTop: 6,
                    }}
                  >
                    👁️ {total}
                  </p>
                  {isMembers && stat && stat.cta_click_count > 0 && (
                    <p
                      style={{
                        fontSize: 9,
                        color: C.accent,
                        fontFamily: FONT_SERIF,
                        marginTop: 1,
                      }}
                    >
                      CTA {stat.cta_click_count}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
          <p
            style={{
              fontSize: 9,
              color: C.textMuted,
              marginTop: 10,
              lineHeight: 1.7,
              fontFamily: FONT_SERIF,
            }}
          >
            ※ HPセラピスト詳細ページでの表示・サムネクリックの合計数。5枚目は会員限定写真で、CTA は会員登録ボタンへの誘導クリック数。
          </p>
        </div>
      )}

      {loading && counts.length === 0 && (
        <p style={{ fontSize: 10, color: C.textMuted, textAlign: "center", fontFamily: FONT_SERIF }}>
          読み込み中...
        </p>
      )}
    </section>
  );
}
