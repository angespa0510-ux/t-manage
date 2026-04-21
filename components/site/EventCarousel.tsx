"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { SITE } from "../../lib/site-theme";
import { Event, fetchActiveEvents, formatEventPeriod, isEndingSoon } from "../../lib/events";

/**
 * ═══════════════════════════════════════════════════════════
 * EventCarousel — HP トップページのイベント枠
 *
 * 方針（■19・■20 準拠）:
 *  - ホワイト基調、明朝体（Noto Serif JP）
 *  - ピンク + 白 + ベージュ + ダークグレーの範囲内
 *  - 絵文字・アイコン非使用
 *  - 横スクロール + 左右矢印（スマホはスワイプ）
 *
 * データ: events テーブル (show_on_hp = true かつ期間内)
 * ═══════════════════════════════════════════════════════════
 */

export default function EventCarousel() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    (async () => {
      const es = await fetchActiveEvents("hp");
      setEvents(es);
      setLoading(false);
    })();
  }, []);

  if (loading) return null;
  if (events.length === 0) return null;

  const scroll = (dir: "prev" | "next") => {
    const el = scrollRef.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>("[data-event-card]");
    const step = card ? card.offsetWidth + 24 : 360;
    el.scrollBy({ left: dir === "next" ? step : -step, behavior: "smooth" });
  };

  return (
    <section
      style={{
        background: SITE.color.bgSoft,
        padding: `${SITE.sp.sectionSm} 0`,
        borderBottom: `1px solid ${SITE.color.borderSoft}`,
      }}
    >
      <div
        style={{
          maxWidth: SITE.layout.maxWidth,
          margin: "0 auto",
          padding: `0 ${SITE.sp.lg}`,
        }}
      >
        {/* ── ヘッダー ── */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: 16,
            marginBottom: SITE.sp.xl,
            flexWrap: "wrap",
          }}
        >
          <div>
            <p
              style={{
                fontFamily: SITE.font.display,
                fontSize: "11px",
                letterSpacing: SITE.ls.wide,
                color: SITE.color.pink,
                marginBottom: 8,
              }}
            >
              EVENTS
            </p>
            <h2
              style={{
                fontFamily: SITE.font.serif,
                fontSize: SITE.fs.h3,
                fontWeight: 500,
                letterSpacing: SITE.ls.loose,
                color: SITE.color.text,
                margin: 0,
              }}
            >
              開催中のイベント
            </h2>
          </div>

          {/* ナビ */}
          {events.length > 1 && (
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => scroll("prev")}
                aria-label="前へ"
                className="event-nav-btn"
                style={navBtnStyle}
              >
                ←
              </button>
              <button
                onClick={() => scroll("next")}
                aria-label="次へ"
                className="event-nav-btn"
                style={navBtnStyle}
              >
                →
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── カルーセル本体（フル幅スクロール） ── */}
      <div
        ref={scrollRef}
        className="event-scroll"
        style={{
          display: "flex",
          gap: 24,
          overflowX: "auto",
          scrollSnapType: "x mandatory",
          scrollPaddingLeft: "24px",
          padding: `4px ${SITE.sp.lg}`,
          paddingRight: "calc(100vw - 100%)",
          WebkitOverflowScrolling: "touch",
          maxWidth: SITE.layout.maxWidth,
          margin: "0 auto",
        }}
      >
        {events.map((e) => (
          <EventCardWithLink key={e.id} event={e} />
        ))}

        {/* 右端スペーサー */}
        <div style={{ flex: "0 0 1px" }} />
      </div>

      <style>{`
        .event-scroll::-webkit-scrollbar { display: none; }
        .event-scroll { scrollbar-width: none; }
        .event-nav-btn:hover {
          border-color: ${SITE.color.pink} !important;
          color: ${SITE.color.pink} !important;
        }
        .event-card:hover {
          border-color: ${SITE.color.borderPink} !important;
        }
        .event-card:hover .event-card-image {
          transform: scale(1.02);
        }
      `}</style>
    </section>
  );
}

// ─── カード ───────────────────────────────────────────────
function EventCardWithLink({ event }: { event: Event }) {
  const card = <EventCard event={event} />;
  if (event.cta_url) {
    const isExternal = /^https?:\/\//.test(event.cta_url);
    if (isExternal) {
      return (
        <a
          href={event.cta_url}
          target="_blank"
          rel="noopener noreferrer"
          style={{ textDecoration: "none", color: "inherit", display: "contents" }}
        >
          {card}
        </a>
      );
    }
    return (
      <Link
        href={event.cta_url}
        style={{ textDecoration: "none", color: "inherit", display: "contents" }}
      >
        {card}
      </Link>
    );
  }
  return card;
}

function EventCard({ event }: { event: Event }) {
  const hasImage = !!event.image_url;
  const accent = event.accent_color || SITE.color.pink;
  const ending = isEndingSoon(event);
  const period = formatEventPeriod(event);

  return (
    <article
      data-event-card
      className="event-card"
      style={{
        flex: "0 0 auto",
        width: "min(86vw, 360px)",
        scrollSnapAlign: "start",
        background: SITE.color.surface,
        border: `1px solid ${SITE.color.border}`,
        textDecoration: "none",
        color: SITE.color.text,
        display: "flex",
        flexDirection: "column",
        transition: SITE.transition.base,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* ── 画像部 ── */}
      <div
        style={{
          position: "relative",
          width: "100%",
          aspectRatio: "16 / 10",
          background: hasImage ? SITE.color.surfaceAlt : SITE.color.pinkSoft,
          overflow: "hidden",
        }}
      >
        {hasImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={event.image_url}
            alt={event.title}
            className="event-card-image"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
              transition: "transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)",
            }}
          />
        ) : (
          // 画像未設定のときは明朝の大きなピンク字で代用
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: SITE.font.display,
              fontSize: "34px",
              color: SITE.color.pink,
              letterSpacing: SITE.ls.wide,
              fontWeight: 500,
            }}
          >
            EVENT
          </div>
        )}

        {/* バッジ */}
        {event.badge_label && (
          <div
            style={{
              position: "absolute",
              top: 14,
              left: 14,
              padding: "5px 12px",
              background: accent,
              color: "#fff",
              fontSize: "10px",
              letterSpacing: SITE.ls.wide,
              fontFamily: SITE.font.display,
              fontWeight: 500,
            }}
          >
            {event.badge_label}
          </div>
        )}

        {/* 期間 / 残りわずか */}
        {period && (
          <div
            style={{
              position: "absolute",
              bottom: 14,
              right: 14,
              padding: "4px 10px",
              background: ending ? accent : "rgba(255,255,255,0.92)",
              color: ending ? "#fff" : SITE.color.text,
              fontSize: "11px",
              letterSpacing: SITE.ls.loose,
              fontFamily: SITE.font.serif,
              border: ending ? "none" : `1px solid ${SITE.color.border}`,
            }}
          >
            {ending ? `まもなく終了・${period}` : period}
          </div>
        )}
      </div>

      {/* ── テキスト部 ── */}
      <div
        style={{
          padding: SITE.sp.lg,
          display: "flex",
          flexDirection: "column",
          flex: 1,
          gap: 10,
        }}
      >
        {event.subtitle && (
          <p
            style={{
              fontFamily: SITE.font.display,
              fontSize: "11px",
              letterSpacing: SITE.ls.wide,
              color: accent,
              margin: 0,
            }}
          >
            {event.subtitle}
          </p>
        )}

        <h3
          style={{
            fontFamily: SITE.font.serif,
            fontSize: "17px",
            fontWeight: 500,
            letterSpacing: SITE.ls.loose,
            lineHeight: 1.5,
            color: SITE.color.text,
            margin: 0,
          }}
        >
          {event.title}
        </h3>

        {event.description && (
          <p
            style={{
              fontFamily: SITE.font.serif,
              fontSize: "12px",
              letterSpacing: SITE.ls.normal,
              lineHeight: 1.8,
              color: SITE.color.textSub,
              margin: 0,
              display: "-webkit-box",
              WebkitLineClamp: 3,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {event.description}
          </p>
        )}

        {/* CTA */}
        {event.cta_label && (
          <div
            style={{
              marginTop: "auto",
              paddingTop: 12,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
              borderTop: `1px solid ${SITE.color.borderSoft}`,
            }}
          >
            <span
              style={{
                fontFamily: SITE.font.serif,
                fontSize: "12px",
                color: accent,
                letterSpacing: SITE.ls.loose,
                fontWeight: 500,
              }}
            >
              {event.cta_label}
            </span>
            <span
              style={{
                fontFamily: SITE.font.display,
                fontSize: "14px",
                color: accent,
                letterSpacing: SITE.ls.wide,
              }}
            >
              →
            </span>
          </div>
        )}
      </div>
    </article>
  );
}

// ─── ナビボタンスタイル ──────────────────────────────────
const navBtnStyle = {
  width: 40,
  height: 40,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  border: `1px solid ${SITE.color.border}`,
  background: "transparent",
  color: SITE.color.textSub,
  fontSize: "16px",
  fontFamily: SITE.font.serif,
  cursor: "pointer",
  transition: SITE.transition.fast,
  lineHeight: 1,
} as const;
