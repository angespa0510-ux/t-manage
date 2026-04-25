/**
 * ═══════════════════════════════════════════════════════════
 * マイページ用 線画SVGアイコンセット
 *
 * 方針:
 *  - 絵文字の代替として、明朝デザインと調和する細線SVG
 *  - stroke-width: 1.2（繊細）／ stroke: currentColor（色は親から継承）
 *  - すべて 24x24 viewBox
 *  - size prop で表示サイズ変更可
 * ═══════════════════════════════════════════════════════════
 */

import React from "react";

type IconProps = {
  size?: number;
  color?: string;
  strokeWidth?: number;
  fill?: string;
  className?: string;
  style?: React.CSSProperties;
};

const base = (size: number, style?: React.CSSProperties): React.SVGProps<SVGSVGElement> => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  xmlns: "http://www.w3.org/2000/svg",
  style: { display: "inline-block", verticalAlign: "middle", ...style },
});

export function IconHome({ size = 18, color = "currentColor", strokeWidth = 1.2, style, className }: IconProps) {
  return (
    <svg {...base(size, style)} stroke={color} strokeWidth={strokeWidth} className={className}>
      <path d="M3 10l9-7 9 7v10a1 1 0 01-1 1h-5v-7h-6v7H4a1 1 0 01-1-1V10z" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export function IconCalendar({ size = 18, color = "currentColor", strokeWidth = 1.2, style, className }: IconProps) {
  return (
    <svg {...base(size, style)} stroke={color} strokeWidth={strokeWidth} className={className}>
      <rect x="3" y="4.5" width="18" height="16" rx="1" strokeLinecap="round"/>
      <path d="M3 9h18M8 2.5v4M16 2.5v4" strokeLinecap="round"/>
    </svg>
  );
}

export function IconHeart({ size = 18, color = "currentColor", strokeWidth = 1.2, fill = "none", style, className }: IconProps) {
  return (
    <svg {...base(size, style)} stroke={color} strokeWidth={strokeWidth} fill={fill} className={className}>
      <path d="M12 20.5s-7.5-4.5-9.5-10A5 5 0 0112 5a5 5 0 019.5 5.5c-2 5.5-9.5 10-9.5 10z" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export function IconBell({ size = 18, color = "currentColor", strokeWidth = 1.2, style, className }: IconProps) {
  return (
    <svg {...base(size, style)} stroke={color} strokeWidth={strokeWidth} className={className}>
      <path d="M6 9a6 6 0 0112 0v4l2 3H4l2-3V9z" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M10 19a2 2 0 004 0" strokeLinecap="round"/>
    </svg>
  );
}

export function IconSettings({ size = 18, color = "currentColor", strokeWidth = 1.2, style, className }: IconProps) {
  return (
    <svg {...base(size, style)} stroke={color} strokeWidth={strokeWidth} className={className}>
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3h.1a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8v.1a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export function IconUser({ size = 18, color = "currentColor", strokeWidth = 1.2, style, className }: IconProps) {
  return (
    <svg {...base(size, style)} stroke={color} strokeWidth={strokeWidth} className={className}>
      <circle cx="12" cy="8" r="4"/>
      <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" strokeLinecap="round"/>
    </svg>
  );
}

export function IconStar({ size = 14, color = "currentColor", strokeWidth = 1.2, fill = "none", style, className }: IconProps) {
  return (
    <svg {...base(size, style)} stroke={color} strokeWidth={strokeWidth} fill={fill} className={className}>
      <path d="M12 2.5l2.9 6.1 6.6.7-4.9 4.5 1.4 6.5L12 17l-5.9 3.3 1.4-6.5L2.5 9.3l6.6-.7L12 2.5z" strokeLinejoin="round"/>
    </svg>
  );
}

export function IconPhone({ size = 16, color = "currentColor", strokeWidth = 1.2, style, className }: IconProps) {
  return (
    <svg {...base(size, style)} stroke={color} strokeWidth={strokeWidth} className={className}>
      <path d="M5 4h4l1.5 4-2 1.5a11 11 0 006 6l1.5-2 4 1.5v4c0 .6-.4 1-1 1A18 18 0 013 5c0-.6.4-1 1-1z" strokeLinejoin="round"/>
    </svg>
  );
}

export function IconGift({ size = 18, color = "currentColor", strokeWidth = 1.2, style, className }: IconProps) {
  return (
    <svg {...base(size, style)} stroke={color} strokeWidth={strokeWidth} className={className}>
      <rect x="3.5" y="8.5" width="17" height="12" rx="0.5"/>
      <path d="M3.5 8.5h17M12 8.5v12M12 8.5s-3-5-5-5a2 2 0 00 0 5M12 8.5s3-5 5-5a2 2 0 010 5" strokeLinejoin="round"/>
    </svg>
  );
}

export function IconSparkle({ size = 16, color = "currentColor", strokeWidth = 1.2, style, className }: IconProps) {
  return (
    <svg {...base(size, style)} stroke={color} strokeWidth={strokeWidth} className={className}>
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.5 5.5l2.8 2.8M15.7 15.7l2.8 2.8M5.5 18.5l2.8-2.8M15.7 8.3l2.8-2.8" strokeLinecap="round"/>
    </svg>
  );
}

export function IconCheck({ size = 16, color = "currentColor", strokeWidth = 1.4, style, className }: IconProps) {
  return (
    <svg {...base(size, style)} stroke={color} strokeWidth={strokeWidth} className={className}>
      <path d="M5 12.5l4.5 4.5L19 7" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export function IconClose({ size = 14, color = "currentColor", strokeWidth = 1.2, style, className }: IconProps) {
  return (
    <svg {...base(size, style)} stroke={color} strokeWidth={strokeWidth} className={className}>
      <path d="M5 5l14 14M19 5L5 19" strokeLinecap="round"/>
    </svg>
  );
}

export function IconEdit({ size = 14, color = "currentColor", strokeWidth = 1.2, style, className }: IconProps) {
  return (
    <svg {...base(size, style)} stroke={color} strokeWidth={strokeWidth} className={className}>
      <path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4 12.5-12.5z" strokeLinejoin="round"/>
    </svg>
  );
}

export function IconClock({ size = 16, color = "currentColor", strokeWidth = 1.2, style, className }: IconProps) {
  return (
    <svg {...base(size, style)} stroke={color} strokeWidth={strokeWidth} className={className}>
      <circle cx="12" cy="12" r="9"/>
      <path d="M12 7v5l3.5 2" strokeLinecap="round"/>
    </svg>
  );
}

export function IconMapPin({ size = 16, color = "currentColor", strokeWidth = 1.2, style, className }: IconProps) {
  return (
    <svg {...base(size, style)} stroke={color} strokeWidth={strokeWidth} className={className}>
      <path d="M12 21s7-6 7-11a7 7 0 10-14 0c0 5 7 11 7 11z" strokeLinejoin="round"/>
      <circle cx="12" cy="10" r="2.5"/>
    </svg>
  );
}

export function IconWarning({ size = 16, color = "currentColor", strokeWidth = 1.2, style, className }: IconProps) {
  return (
    <svg {...base(size, style)} stroke={color} strokeWidth={strokeWidth} className={className}>
      <path d="M12 3L2 20h20L12 3z" strokeLinejoin="round"/>
      <path d="M12 10v4M12 17.5v.5" strokeLinecap="round"/>
    </svg>
  );
}

export function IconCard({ size = 18, color = "currentColor", strokeWidth = 1.2, style, className }: IconProps) {
  return (
    <svg {...base(size, style)} stroke={color} strokeWidth={strokeWidth} className={className}>
      <rect x="2.5" y="5.5" width="19" height="13" rx="1"/>
      <path d="M2.5 10h19" strokeLinecap="round"/>
    </svg>
  );
}

export function IconSearch({ size = 16, color = "currentColor", strokeWidth = 1.2, style, className }: IconProps) {
  return (
    <svg {...base(size, style)} stroke={color} strokeWidth={strokeWidth} className={className}>
      <circle cx="11" cy="11" r="7"/>
      <path d="M16 16l5 5" strokeLinecap="round"/>
    </svg>
  );
}

export function IconSpa({ size = 18, color = "currentColor", strokeWidth = 1.2, style, className }: IconProps) {
  return (
    <svg {...base(size, style)} stroke={color} strokeWidth={strokeWidth} className={className}>
      <path d="M12 4c2 3 2 7 0 10-2-3-2-7 0-10zM12 14c-3 1-6 0-8-3 3-1 6 0 8 3zM12 14c3 1 6 0 8-3-3-1-6 0-8 3zM12 14v6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export function IconNote({ size = 16, color = "currentColor", strokeWidth = 1.2, style, className }: IconProps) {
  return (
    <svg {...base(size, style)} stroke={color} strokeWidth={strokeWidth} className={className}>
      <path d="M5 3h10l4 4v14H5V3z" strokeLinejoin="round"/>
      <path d="M15 3v4h4M8 12h8M8 16h5" strokeLinecap="round"/>
    </svg>
  );
}

export function IconCamera({ size = 18, color = "currentColor", strokeWidth = 1.2, style, className }: IconProps) {
  return (
    <svg {...base(size, style)} stroke={color} strokeWidth={strokeWidth} className={className}>
      <path d="M3 7h3l2-3h8l2 3h3v13H3V7z" strokeLinejoin="round"/>
      <circle cx="12" cy="13" r="4"/>
    </svg>
  );
}

export function IconLogout({ size = 16, color = "currentColor", strokeWidth = 1.2, style, className }: IconProps) {
  return (
    <svg {...base(size, style)} stroke={color} strokeWidth={strokeWidth} className={className}>
      <path d="M9 4H5a1 1 0 00-1 1v14a1 1 0 001 1h4M15 8l4 4-4 4M19 12H9" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export function IconPencil({ size = 14, color = "currentColor", strokeWidth = 1.2, style, className }: IconProps) {
  return <IconEdit size={size} color={color} strokeWidth={strokeWidth} style={style} className={className} />;
}

export function IconArrowRight({ size = 14, color = "currentColor", strokeWidth = 1.2, style, className }: IconProps) {
  return (
    <svg {...base(size, style)} stroke={color} strokeWidth={strokeWidth} className={className}>
      <path d="M5 12h14M14 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export function IconArrowLeft({ size = 14, color = "currentColor", strokeWidth = 1.2, style, className }: IconProps) {
  return (
    <svg {...base(size, style)} stroke={color} strokeWidth={strokeWidth} className={className}>
      <path d="M19 12H5M10 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export function IconPlus({ size = 14, color = "currentColor", strokeWidth = 1.2, style, className }: IconProps) {
  return (
    <svg {...base(size, style)} stroke={color} strokeWidth={strokeWidth} className={className}>
      <path d="M12 5v14M5 12h14" strokeLinecap="round"/>
    </svg>
  );
}

export function IconMinus({ size = 14, color = "currentColor", strokeWidth = 1.2, style, className }: IconProps) {
  return (
    <svg {...base(size, style)} stroke={color} strokeWidth={strokeWidth} className={className}>
      <path d="M5 12h14" strokeLinecap="round"/>
    </svg>
  );
}

export function IconEye({ size = 16, color = "currentColor", strokeWidth = 1.2, style, className }: IconProps) {
  return (
    <svg {...base(size, style)} stroke={color} strokeWidth={strokeWidth} className={className}>
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" strokeLinejoin="round"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  );
}

export function IconEyeOff({ size = 16, color = "currentColor", strokeWidth = 1.2, style, className }: IconProps) {
  return (
    <svg {...base(size, style)} stroke={color} strokeWidth={strokeWidth} className={className}>
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24M1 1l22 22" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// 評価の星表示（5段階）— SVGの組み合わせ
export function StarRating({ rating, size = 12, filledColor = "#e8849a", emptyColor = "#d9d0c6" }: {
  rating: number; size?: number; filledColor?: string; emptyColor?: string;
}) {
  return (
    <span style={{ display: "inline-flex", gap: 2, alignItems: "center" }}>
      {[1, 2, 3, 4, 5].map(i => (
        <IconStar
          key={i}
          size={size}
          color={i <= rating ? filledColor : emptyColor}
          fill={i <= rating ? filledColor : "none"}
        />
      ))}
    </span>
  );
}

// 未読バッジ付きベル
export function BellWithBadge({ count, size = 20, color = "currentColor", badgeColor = "#c96b83" }: {
  count: number; size?: number; color?: string; badgeColor?: string;
}) {
  return (
    <span style={{ position: "relative", display: "inline-block", lineHeight: 0 }}>
      <IconBell size={size} color={color} />
      {count > 0 && (
        <span style={{
          position: "absolute",
          top: -4,
          right: -4,
          minWidth: 16,
          height: 16,
          padding: "0 4px",
          borderRadius: 8,
          backgroundColor: badgeColor,
          color: "#fff",
          fontSize: 9,
          fontWeight: 500,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "'Cormorant Garamond', serif",
          letterSpacing: 0,
        }}>{count > 99 ? "99+" : count}</span>
      )}
    </span>
  );
}
