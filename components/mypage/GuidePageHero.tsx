"use client";

import Link from "next/link";
import { SITE, MARBLE } from "../../lib/site-theme";

/* ─────────────────────────────────────────────────────────────
 * Guide Page Hero — セラピストマイページのガイド共通ヘッダー
 *
 * HP (/app/(site)) の世界観を踏襲:
 *   - 大理石pink背景
 *   - 英文ラベル + 和文タイトル + ピンク細罫線
 *   - 装飾細線
 *   - 「← マイページに戻る」アウトラインボタン
 * ───────────────────────────────────────────────────────────── */

export const GUIDE_FONT_SERIF =
  "'Noto Serif JP', 'Yu Mincho', 'Hiragino Mincho ProN', serif";
export const GUIDE_FONT_DISPLAY =
  "'Cormorant Garamond', 'Noto Serif JP', 'Yu Mincho', serif";
export const GUIDE_FONT_SANS =
  "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Geist', system-ui, sans-serif";

export const GUIDE_T = {
  bg:         SITE.color.bg,
  card:       SITE.color.surface,
  cardAlt:    SITE.color.surfaceAlt,
  border:     SITE.color.border,
  text:       SITE.color.text,
  textSub:    SITE.color.textSub,
  textMuted:  SITE.color.textMuted,
  textFaint:  SITE.color.textFaint,
  accent:     SITE.color.pink,
  accentBg:   SITE.color.pinkSoft,
  accentDeep: SITE.color.pinkDeep,
} as const;

type MarbleKey = "pink" | "warm" | "beige" | "soft" | "blue";

export default function GuidePageHero({
  label,
  title,
  subtitle,
  marble = "pink",
  backHref = "/mypage",
  backLabel = "マイページに戻る",
}: {
  label: string;   // 英文ラベル (e.g. "TAX GUIDE")
  title: string;   // 和文タイトル
  subtitle?: string;
  marble?: MarbleKey;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <section
      style={{
        ...MARBLE[marble],
        padding: "48px 24px 56px",
        position: "relative",
      }}
    >
      <div style={{ maxWidth: 640, margin: "0 auto", position: "relative" }}>
        {/* 戻るリンク */}
        <Link
          href={backHref}
          style={{
            display: "inline-block",
            padding: "7px 14px",
            fontSize: 11,
            color: GUIDE_T.accent,
            border: `1px solid ${GUIDE_T.accent}`,
            backgroundColor: "rgba(255,255,255,0.7)",
            fontFamily: GUIDE_FONT_SERIF,
            letterSpacing: "0.08em",
            textDecoration: "none",
            marginBottom: 32,
            WebkitBackdropFilter: "blur(4px)",
            backdropFilter: "blur(4px)",
          }}
        >
          ← {backLabel}
        </Link>

        {/* 装飾細線 */}
        <div
          style={{
            width: 1,
            height: 36,
            backgroundColor: GUIDE_T.accent,
            marginBottom: 18,
          }}
        />

        {/* 英文ラベル */}
        <p
          style={{
            fontFamily: GUIDE_FONT_DISPLAY,
            fontSize: 11,
            letterSpacing: "0.25em",
            color: GUIDE_T.accent,
            marginBottom: 8,
            fontWeight: 500,
          }}
        >
          {label}
        </p>

        {/* 和文タイトル */}
        <h1
          style={{
            fontFamily: GUIDE_FONT_SERIF,
            fontSize: "clamp(22px, 5vw, 30px)",
            letterSpacing: "0.08em",
            color: GUIDE_T.text,
            fontWeight: 500,
            lineHeight: 1.5,
            marginBottom: 14,
          }}
        >
          {title}
        </h1>

        {/* ピンク細罫線 */}
        <div
          style={{
            width: 40,
            height: 1,
            backgroundColor: GUIDE_T.accent,
            marginBottom: subtitle ? 18 : 0,
          }}
        />

        {/* サブタイトル */}
        {subtitle && (
          <p
            style={{
              fontFamily: GUIDE_FONT_SERIF,
              fontSize: 13,
              color: GUIDE_T.textSub,
              lineHeight: 1.9,
              letterSpacing: "0.05em",
              maxWidth: 560,
            }}
          >
            {subtitle}
          </p>
        )}
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────
 * GuideSection — ガイドページ内のセクション見出し
 * ───────────────────────────────────────────────────────────── */
export function GuideSectionHeading({
  label,
  title,
  align = "center",
}: {
  label: string;
  title: string;
  align?: "center" | "left";
}) {
  const isLeft = align === "left";
  return (
    <div
      style={{
        textAlign: align,
        marginBottom: 24,
      }}
    >
      <p
        style={{
          fontFamily: GUIDE_FONT_DISPLAY,
          fontSize: 11,
          letterSpacing: "0.25em",
          color: GUIDE_T.accent,
          marginBottom: 6,
          fontWeight: 500,
        }}
      >
        {label}
      </p>
      <p
        style={{
          fontFamily: GUIDE_FONT_SERIF,
          fontSize: 16,
          letterSpacing: "0.08em",
          color: GUIDE_T.text,
          fontWeight: 500,
          marginBottom: 10,
        }}
      >
        {title}
      </p>
      <div
        style={{
          width: 30,
          height: 1,
          backgroundColor: GUIDE_T.accent,
          margin: isLeft ? "0" : "0 auto",
        }}
      />
    </div>
  );
}
