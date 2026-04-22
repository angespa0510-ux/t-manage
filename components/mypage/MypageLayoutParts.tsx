"use client";
/**
 * ═══════════════════════════════════════════════════════════
 * マイページ共通レイアウトパーツ
 *
 * HPの SiteLayoutParts と同じ思想で、マイページ側にも
 * 統一された見出し・エンプティ表示・罫線などを提供する。
 * ═══════════════════════════════════════════════════════════
 */

import React, { useState } from "react";
import { MYPAGE } from "../../lib/mypage-theme";

const C = MYPAGE.color;

/* ═══════════════════════════════════════════════════════════
 * SectionHeading — 見出し
 *   - kicker（英字小見出し）+ title（明朝タイトル）+ 下線
 *   - HP の SectionHeading と同じ世界観
 * ═══════════════════════════════════════════════════════════ */
export function SectionHeading({
  kicker,
  title,
  align = "left",
  size = "md",
}: {
  kicker?: string;
  title?: string;
  align?: "left" | "center";
  size?: "sm" | "md" | "lg";
}) {
  const fs = size === "lg" ? MYPAGE.fs.h2 : size === "sm" ? MYPAGE.fs.h3 : "22px";
  return (
    <div style={{ textAlign: align, marginBottom: 16 }}>
      {kicker && (
        <p style={{
          margin: 0,
          fontFamily: MYPAGE.font.display,
          fontSize: MYPAGE.fs.tiny,
          letterSpacing: MYPAGE.ls.wider,
          color: C.pink,
          textTransform: "uppercase",
          fontWeight: 400,
        }}>
          {kicker}
        </p>
      )}
      {title && (
        <h2 style={{
          margin: kicker ? "6px 0 0 0" : 0,
          fontFamily: MYPAGE.font.display,
          fontSize: fs,
          fontWeight: 400,
          letterSpacing: MYPAGE.ls.loose,
          color: C.text,
          lineHeight: 1.4,
        }}>
          {title}
        </h2>
      )}
      {/* HPらしい罫線アクセント */}
      <div style={{
        marginTop: 10,
        display: "flex",
        justifyContent: align === "center" ? "center" : "flex-start",
      }}>
        <div style={{ width: 40, height: 1, backgroundColor: C.pink }} />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
 * Divider — HP風の細い区切り線
 * ═══════════════════════════════════════════════════════════ */
export function Divider({ spacing = 24 }: { spacing?: number }) {
  return (
    <div style={{
      height: 1,
      backgroundColor: C.borderSoft,
      margin: `${spacing}px 0`,
    }} />
  );
}

/* ═══════════════════════════════════════════════════════════
 * EmptyBlock — エンプティステート
 *   - 画像があれば画像、なければ細線の花のSVGイラスト
 *   - HP風の明朝 + 余白でスカスカに見えても格を保つ
 * ═══════════════════════════════════════════════════════════ */
export function EmptyBlock({
  title,
  subtitle,
  imageSrc,
  imageAspect = "square",
}: {
  title: string;
  subtitle?: string;
  imageSrc?: string;
  imageAspect?: "square" | "landscape";
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = imageSrc && !imageFailed;

  return (
    <div style={{
      padding: "48px 24px",
      textAlign: "center",
      backgroundColor: C.surface,
      border: MYPAGE.border.hairline,
      borderRadius: MYPAGE.radius.lg,
    }}>
      {showImage ? (
        <div style={{
          width: "100%",
          maxWidth: imageAspect === "landscape" ? 320 : 180,
          aspectRatio: imageAspect === "landscape" ? "4/3" : "1/1",
          margin: "0 auto 24px",
          overflow: "hidden",
          borderRadius: MYPAGE.radius.md,
        }}>
          <img
            src={imageSrc}
            alt=""
            style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.85 }}
            onError={() => setImageFailed(true)}
          />
        </div>
      ) : (
        <DecorativeFlower />
      )}

      <h3 style={{
        margin: 0,
        fontFamily: MYPAGE.font.display,
        fontSize: MYPAGE.fs.h3,
        fontWeight: 400,
        letterSpacing: MYPAGE.ls.loose,
        color: C.text,
      }}>
        {title}
      </h3>
      {subtitle && (
        <p style={{
          margin: "10px 0 0",
          fontSize: MYPAGE.fs.sm,
          lineHeight: MYPAGE.lh.body,
          color: C.textMuted,
          letterSpacing: MYPAGE.ls.normal,
        }}>
          {subtitle}
        </p>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
 * DecorativeFlower — 画像がない時のフォールバック装飾
 *   細線のピーニーイラスト
 * ═══════════════════════════════════════════════════════════ */
export function DecorativeFlower({ size = 56, color = MYPAGE.color.pink }: { size?: number; color?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 80 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: "block", margin: "0 auto 20px", opacity: 0.6 }}
    >
      {/* 花弁（円を重ねた簡易ピーニー） */}
      <circle cx="40" cy="40" r="8" stroke={color} strokeWidth="0.8" fill="none" />
      <circle cx="40" cy="32" r="6" stroke={color} strokeWidth="0.8" fill="none" />
      <circle cx="40" cy="48" r="6" stroke={color} strokeWidth="0.8" fill="none" />
      <circle cx="32" cy="40" r="6" stroke={color} strokeWidth="0.8" fill="none" />
      <circle cx="48" cy="40" r="6" stroke={color} strokeWidth="0.8" fill="none" />
      <circle cx="34" cy="34" r="5" stroke={color} strokeWidth="0.8" fill="none" />
      <circle cx="46" cy="34" r="5" stroke={color} strokeWidth="0.8" fill="none" />
      <circle cx="34" cy="46" r="5" stroke={color} strokeWidth="0.8" fill="none" />
      <circle cx="46" cy="46" r="5" stroke={color} strokeWidth="0.8" fill="none" />
      <circle cx="40" cy="40" r="3" stroke={color} strokeWidth="0.8" fill="none" />
      {/* 茎 */}
      <path d="M40 55 Q40 65 45 72" stroke={color} strokeWidth="0.8" fill="none" strokeLinecap="round" />
      <path d="M43 63 Q50 60 53 57" stroke={color} strokeWidth="0.8" fill="none" strokeLinecap="round" />
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════
 * PageHero — タブ上部のミニヒーロー
 *   - 画像 + 明朝見出しで、そのタブの世界観を作る
 *   - 画像がない時は罫線と余白で代替
 * ═══════════════════════════════════════════════════════════ */
export function PageHero({
  kicker,
  title,
  subtitle,
  imageSrc,
  height = 180,
}: {
  kicker?: string;
  title: string;
  subtitle?: string;
  imageSrc?: string;
  height?: number;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = imageSrc && !imageFailed;

  return (
    <div style={{
      position: "relative",
      width: "100%",
      height,
      overflow: "hidden",
      backgroundColor: C.bgSoft,
      marginBottom: 24,
    }}>
      {showImage && (
        <>
          <img
            src={imageSrc}
            alt=""
            onError={() => setImageFailed(true)}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "center 40%",
              // 右下の透かしを隠すために少し拡大
              transform: "scale(1.06)",
              transformOrigin: "center left",
            }}
          />
          {/* 白いオーバーレイで読みやすく */}
          <div style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(180deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.85) 100%)",
          }} />
        </>
      )}
      <div style={{
        position: "relative",
        zIndex: 1,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        padding: "24px 20px",
        textAlign: "center",
      }}>
        {kicker && (
          <p style={{
            margin: 0,
            fontFamily: MYPAGE.font.display,
            fontSize: MYPAGE.fs.tiny,
            letterSpacing: MYPAGE.ls.wider,
            color: C.pink,
            textTransform: "uppercase",
          }}>
            {kicker}
          </p>
        )}
        <h1 style={{
          margin: kicker ? "8px 0 0" : 0,
          fontFamily: MYPAGE.font.display,
          fontSize: "clamp(22px, 5vw, 30px)",
          fontWeight: 400,
          letterSpacing: MYPAGE.ls.loose,
          color: C.text,
          lineHeight: 1.3,
        }}>
          {title}
        </h1>
        <div style={{ width: 32, height: 1, backgroundColor: C.pink, margin: "12px 0" }} />
        {subtitle && (
          <p style={{
            margin: 0,
            fontSize: MYPAGE.fs.sm,
            letterSpacing: MYPAGE.ls.loose,
            color: C.textSub,
            lineHeight: 1.7,
          }}>
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
 * Card — 統一カード
 * ═══════════════════════════════════════════════════════════ */
export function Card({
  children,
  padding = 20,
  accent = false,
  style,
}: {
  children: React.ReactNode;
  padding?: number;
  accent?: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <div style={{
      backgroundColor: accent ? C.pinkSoft : C.surface,
      border: accent ? MYPAGE.border.pink : MYPAGE.border.hairline,
      borderRadius: MYPAGE.radius.lg,
      padding,
      ...style,
    }}>
      {children}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
 * InfoRow — 2カラムの情報行
 *   定型的に「ラベル / 値」を綺麗に並べる
 * ═══════════════════════════════════════════════════════════ */
export function InfoRow({
  label,
  value,
  muted = false,
}: {
  label: string;
  value: React.ReactNode;
  muted?: boolean;
}) {
  return (
    <div style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "baseline",
      padding: "10px 0",
      borderBottom: `1px solid ${C.borderSoft}`,
      gap: 12,
    }}>
      <span style={{
        fontSize: MYPAGE.fs.xs,
        letterSpacing: MYPAGE.ls.loose,
        color: C.textMuted,
      }}>{label}</span>
      <span style={{
        fontSize: MYPAGE.fs.sm,
        fontFamily: muted ? MYPAGE.font.serif : MYPAGE.font.display,
        color: muted ? C.textSub : C.text,
        textAlign: "right",
        letterSpacing: MYPAGE.ls.normal,
      }}>{value}</span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
 * Pill — 小さなピンクのピル/タグ
 * ═══════════════════════════════════════════════════════════ */
export function Pill({
  children,
  tone = "pink",
}: {
  children: React.ReactNode;
  tone?: "pink" | "neutral" | "success" | "warning";
}) {
  const tones = {
    pink: { bg: C.pinkSoft, color: C.pinkDeep, border: C.borderPink },
    neutral: { bg: C.surfaceAlt, color: C.textSub, border: C.border },
    success: { bg: "#edf3ee", color: "#5a8770", border: "#cadbcf" },
    warning: { bg: "#faf3e8", color: "#b0864e", border: "#e8dcc5" },
  }[tone];
  return (
    <span style={{
      display: "inline-block",
      padding: "3px 10px",
      fontSize: MYPAGE.fs.tiny,
      letterSpacing: MYPAGE.ls.loose,
      borderRadius: MYPAGE.radius.pill,
      backgroundColor: tones.bg,
      color: tones.color,
      border: `1px solid ${tones.border}`,
      fontFamily: MYPAGE.font.serif,
    }}>{children}</span>
  );
}

/* ═══════════════════════════════════════════════════════════
 * PrimaryButton / OutlineButton — HP風の細ボタン
 * ═══════════════════════════════════════════════════════════ */
export function PrimaryButton({
  children,
  onClick,
  disabled,
  fullWidth = true,
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  fullWidth?: boolean;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        width: fullWidth ? "100%" : undefined,
        padding: "14px 28px",
        fontFamily: MYPAGE.font.serif,
        fontSize: MYPAGE.fs.sm,
        letterSpacing: MYPAGE.ls.loose,
        fontWeight: 400,
        color: "#fff",
        backgroundColor: disabled ? C.textFaint : C.pink,
        border: "none",
        borderRadius: MYPAGE.radius.md,
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "background-color .2s ease",
      }}
    >
      {children}
    </button>
  );
}

export function OutlineButton({
  children,
  onClick,
  disabled,
  fullWidth = true,
  href,
  target,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  fullWidth?: boolean;
  href?: string;
  target?: string;
}) {
  const style: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    width: fullWidth ? "100%" : undefined,
    padding: "12px 24px",
    fontFamily: MYPAGE.font.serif,
    fontSize: MYPAGE.fs.sm,
    letterSpacing: MYPAGE.ls.loose,
    fontWeight: 400,
    color: C.text,
    backgroundColor: "transparent",
    border: `1px solid ${C.border}`,
    borderRadius: MYPAGE.radius.md,
    cursor: disabled ? "not-allowed" : "pointer",
    textDecoration: "none",
    transition: "border-color .2s ease, color .2s ease",
    opacity: disabled ? 0.5 : 1,
  };
  if (href) {
    return <a href={href} target={target} rel={target === "_blank" ? "noopener noreferrer" : undefined} style={style}>{children}</a>;
  }
  return <button type="button" onClick={onClick} disabled={disabled} style={style}>{children}</button>;
}
