"use client";

import { SITE } from "../../lib/site-theme";

/**
 * SectionHeading — 全ページ共通のセクション見出し
 *
 * 仕様 ■20 準拠:
 *  - 英文ラベル（小さなピンク、wide letter-spacing）
 *  - 和文タイトル（明朝、ゆとりある字間）
 *  - 下に40px × 1pxのピンク細罫線
 *  - badge で件数などをインライン表示可
 */
export default function SectionHeading({
  label,
  title,
  subtitle,
  badge,
  align = "center",
}: {
  label: string;
  title: string;
  subtitle?: string;
  badge?: string;
  align?: "center" | "left";
}) {
  const textAlign = align;
  const isLeft = align === "left";

  return (
    <div style={{ textAlign, marginBottom: SITE.sp.xl }}>
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
        {label}
      </p>
      <h2
        style={{
          fontFamily: SITE.font.serif,
          fontSize: SITE.fs.h2,
          color: SITE.color.text,
          letterSpacing: SITE.ls.loose,
          fontWeight: 500,
          marginBottom: 16,
          display: isLeft ? "flex" : "inline-flex",
          alignItems: "center",
          gap: 16,
          flexWrap: "wrap",
          justifyContent: isLeft ? "flex-start" : "center",
        }}
      >
        {title}
        {badge && (
          <span
            style={{
              fontFamily: SITE.font.display,
              fontSize: "12px",
              letterSpacing: SITE.ls.loose,
              color: SITE.color.pink,
              padding: "3px 14px",
              border: `1px solid ${SITE.color.borderPink}`,
              fontWeight: 400,
            }}
          >
            {badge}
          </span>
        )}
      </h2>
      <div
        style={{
          width: SITE.accent.underlineW,
          height: SITE.accent.underlineH,
          backgroundColor: SITE.color.pink,
          margin: isLeft ? "0" : "0 auto",
        }}
      />
      {subtitle && (
        <p
          style={{
            marginTop: SITE.sp.md,
            fontFamily: SITE.font.serif,
            fontSize: SITE.fs.sm,
            color: SITE.color.textSub,
            letterSpacing: SITE.ls.loose,
            lineHeight: SITE.lh.body,
          }}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
}
