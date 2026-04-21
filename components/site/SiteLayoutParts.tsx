"use client";

import Link from "next/link";
import { SITE } from "../../lib/site-theme";

/**
 * TherapistGrid — レスポンシブ2/3/4列グリッド
 */
export function TherapistGrid({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="site-therapist-grid"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
        gap: SITE.sp.md,
      }}
    >
      {children}
      <style>{`
        @media (min-width: 520px) {
          .site-therapist-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
        }
        @media (min-width: 768px) {
          .site-therapist-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); gap: ${SITE.sp.lg}; }
        }
      `}</style>
    </div>
  );
}

/**
 * ViewMoreButton — 「VIEW ALL ◯◯」やセクションの続きを見るボタン
 */
export function ViewMoreButton({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  return (
    <div style={{ textAlign: "center", marginTop: SITE.sp.xl }}>
      <Link
        href={href}
        style={{
          display: "inline-block",
          padding: "14px 40px",
          background: "transparent",
          border: `1px solid ${SITE.color.pink}`,
          color: SITE.color.pink,
          fontFamily: SITE.font.serif,
          fontSize: "13px",
          letterSpacing: SITE.ls.wide,
          textDecoration: "none",
          transition: SITE.transition.base,
        }}
        className="site-cta-secondary"
      >
        {label}
      </Link>
    </div>
  );
}

/**
 * PageHero — 下層ページの共通上部ヒーロー
 *
 * 背景画像 + 英文ラベル + 和文タイトル + 下に細罫線
 * bgVideo が指定されたらそちらを優先して動画背景で表示
 */
export function PageHero({
  label,
  title,
  subtitle,
  bgImage,
  bgVideo,
  bgVideoPoster,
}: {
  label: string;
  title: string;
  subtitle?: string;
  bgImage?: string;
  bgVideo?: string;
  bgVideoPoster?: string;
}) {
  return (
    <section
      style={{
        position: "relative",
        minHeight: "clamp(240px, 40vh, 420px)",
        marginTop: `calc(-1 * ${SITE.layout.headerHeightSp})`,
        paddingTop: SITE.layout.headerHeightSp,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        backgroundColor: SITE.color.bgSoft,
      }}
    >
      {bgVideo ? (
        <>
          <video
            src={bgVideo}
            poster={bgVideoPoster}
            autoPlay
            loop
            muted
            playsInline
            preload="metadata"
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.80) 100%)",
            }}
          />
        </>
      ) : bgImage ? (
        <>
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage: `url("${bgImage}")`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0.75) 100%)",
            }}
          />
        </>
      ) : null}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          textAlign: "center",
          padding: `${SITE.sp.xl} ${SITE.sp.lg}`,
          animation: "siteFadeUp 1s cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      >
        <p
          style={{
            fontFamily: SITE.font.display,
            fontSize: "11px",
            letterSpacing: SITE.ls.wide,
            color: SITE.color.pink,
            marginBottom: 16,
            fontWeight: 500,
          }}
        >
          {label}
        </p>
        <h1
          style={{
            fontFamily: SITE.font.serif,
            fontSize: SITE.fs.h1,
            color: SITE.color.text,
            letterSpacing: SITE.ls.loose,
            fontWeight: 500,
            marginBottom: 20,
            lineHeight: SITE.lh.heading,
          }}
        >
          {title}
        </h1>
        <div
          style={{
            width: SITE.accent.underlineW,
            height: SITE.accent.underlineH,
            backgroundColor: SITE.color.pink,
            margin: "0 auto",
          }}
        />
        {subtitle && (
          <p
            style={{
              marginTop: 24,
              maxWidth: 560,
              fontFamily: SITE.font.serif,
              fontSize: "13px",
              color: SITE.color.textSub,
              letterSpacing: SITE.ls.loose,
              lineHeight: SITE.lh.body,
            }}
          >
            {subtitle}
          </p>
        )}
      </div>
      <style>{`
        @keyframes siteFadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </section>
  );
}

/**
 * LoadingBlock / EmptyBlock — 状態表示
 */
export function LoadingBlock() {
  return (
    <div
      style={{
        padding: SITE.sp.xxl,
        textAlign: "center",
        color: SITE.color.textMuted,
        fontFamily: SITE.font.display,
        fontSize: "11px",
        letterSpacing: SITE.ls.wide,
      }}
    >
      LOADING
    </div>
  );
}

export function EmptyBlock({
  title,
  sub,
  link,
}: {
  title: string;
  sub?: string;
  link?: { href: string; label: string };
}) {
  return (
    <div
      style={{
        padding: `${SITE.sp.xxl} ${SITE.sp.lg}`,
        textAlign: "center",
        backgroundColor: SITE.color.surface,
        border: `1px solid ${SITE.color.border}`,
      }}
    >
      <p
        style={{
          fontFamily: SITE.font.serif,
          fontSize: "14px",
          color: SITE.color.text,
          marginBottom: sub ? 8 : 20,
          letterSpacing: SITE.ls.loose,
        }}
      >
        {title}
      </p>
      {sub && (
        <p
          style={{
            fontSize: "12px",
            color: SITE.color.textMuted,
            marginBottom: 24,
            letterSpacing: SITE.ls.normal,
          }}
        >
          {sub}
        </p>
      )}
      {link && (
        <Link
          href={link.href}
          style={{
            display: "inline-block",
            padding: "12px 32px",
            border: `1px solid ${SITE.color.pink}`,
            color: SITE.color.pink,
            fontFamily: SITE.font.serif,
            fontSize: "12px",
            letterSpacing: SITE.ls.wide,
            textDecoration: "none",
            transition: SITE.transition.base,
          }}
          className="site-cta-secondary"
        >
          {link.label}
        </Link>
      )}
    </div>
  );
}
