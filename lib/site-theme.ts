/**
 * ═══════════════════════════════════════════════════════════
 * Ange Spa 公式HP デザインシステム
 *
 * 方針（プロジェクト仕様 ■19・■20 準拠）:
 *  - ベース: ホワイト（清潔感・清楚感）
 *  - カラー: ピンク + 白 + ベージュ + ダークグレー の4色以内
 *  - タイポグラフィ: Noto Serif JP 統一（見出しも本文も明朝）
 *  - 絵文字・アイコンは使用しない
 *  - グラデーション・過度な影は使用しない
 *  - 余白・罫線・タイポで世界観を作る
 * ═══════════════════════════════════════════════════════════
 */

// ─── カラー（4色以内の原則に従う） ───────────────────────
export const SITE_COLORS = {
  // ベース（ホワイト基調）
  bg:          "#ffffff",
  bgSoft:      "#fdfaf7",
  surface:     "#ffffff",
  surfaceAlt:  "#faf6f1",

  // ブランド ピンク（3階調）
  pink:        "#e8849a",
  pinkDeep:    "#c96b83",
  pinkSoft:    "#f7e3e7",

  // ダークグレー（テキスト系）
  text:        "#2b2b2b",
  textSub:     "#555555",
  textMuted:   "#8a8a8a",
  textFaint:   "#b5b5b5",

  // 罫線
  border:      "#e5ded6",
  borderPink:  "#ead3da",
  borderSoft:  "#f0ebe4",
} as const;

export const SITE = {
  color: SITE_COLORS,

  font: {
    serif:    "'Noto Serif JP', 'Yu Mincho', 'Hiragino Mincho ProN', serif",
    display:  "'Cormorant Garamond', 'Noto Serif JP', 'Yu Mincho', serif",
  },

  fs: {
    hero:     "clamp(28px, 6vw, 52px)",
    h1:       "clamp(28px, 4.5vw, 44px)",
    h2:       "clamp(22px, 3.5vw, 32px)",
    h3:       "clamp(18px, 2.5vw, 22px)",
    lead:     "clamp(15px, 2vw, 17px)",
    body:     "14px",
    bodyLg:   "15px",
    sm:       "12px",
    xs:       "11px",
    tiny:     "10px",
  },

  lh: {
    heading: 1.5,
    body:    1.9,
    loose:   2.2,
  },

  ls: {
    tight:  "0em",
    normal: "0.02em",
    loose:  "0.08em",
    wide:   "0.15em",
    wider:  "0.25em",
  },

  bp: {
    sm:  "480px",
    md:  "768px",
    lg:  "1024px",
    xl:  "1280px",
  },

  sp: {
    xs:  "4px",
    sm:  "8px",
    md:  "16px",
    lg:  "24px",
    xl:  "40px",
    xxl: "64px",
    xxxl:"96px",
    section:   "clamp(64px, 12vw, 160px)",
    sectionSm: "clamp(40px, 8vw, 96px)",
  },

  radius: {
    sm: "2px",
    md: "4px",
    lg: "8px",
    xl: "12px",
    pill: "999px",
  },

  shadow: {
    none: "none",
    soft: "0 1px 2px rgba(0,0,0,0.04)",
    card: "0 2px 8px rgba(0,0,0,0.04)",
  },

  transition: {
    fast:   "all 0.2s ease",
    base:   "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
    slow:   "all 0.6s cubic-bezier(0.4, 0, 0.2, 1)",
  },

  z: {
    base:       1,
    sticky:    20,
    overlay:   30,
    modal:     40,
    top:      100,
  },

  layout: {
    maxWidth:       "1200px",
    maxWidthNarrow: "880px",
    maxWidthText:   "640px",
    headerHeight:   "76px",
    headerHeightSp: "60px",
  },

  accent: {
    underlineW: "40px",
    underlineH: "1px",
  },
} as const;

export const MQ = {
  sm: `@media (min-width: ${SITE.bp.sm})`,
  md: `@media (min-width: ${SITE.bp.md})`,
  lg: `@media (min-width: ${SITE.bp.lg})`,
  xl: `@media (min-width: ${SITE.bp.xl})`,
  mobileOnly: `@media (max-width: calc(${SITE.bp.md} - 1px))`,
  desktopOnly:`@media (min-width: ${SITE.bp.md})`,
} as const;

export type SiteColorKey = keyof typeof SITE_COLORS;
