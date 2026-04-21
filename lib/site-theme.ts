/**
 * ═══════════════════════════════════════════════════════════
 * Ange Spa 公式HP デザインシステム
 *
 * T-MANAGE 内で動く公開サイト（/ /system /therapist /schedule
 * /access /recruit）共通のカラー・タイポ・余白のトークン定義。
 *
 * 管理画面側の lib/theme.tsx（ダーク/ライト切替）とは独立。
 * 公開HPは「ピンク × ダーク × ゴールド」の常時固定配色で、
 * 現行HP (ange-spa.com) の世界観を踏襲する。
 *
 * 使い方:
 *   import { SITE } from "@/lib/site-theme";
 *   <div style={{ backgroundColor: SITE.color.bg }} />
 * ═══════════════════════════════════════════════════════════
 */

// ─── カラーパレット ───────────────────────────────────────
export const SITE_COLORS = {
  // ブランド ピンク
  pink:        "#e8849a",  // メインピンク（見出し・CTA）
  pinkDeep:    "#c96b83",  // 濃ピンク（ホバー・強調）
  pinkSoft:    "#f5d5dd",  // 淡ピンク（背景アクセント）
  pinkGhost:   "rgba(232,132,154,0.08)", // ごく淡い背景オーバーレイ

  // ブランド ゴールド（既存T-MANAGEと統一、上品さの担保）
  gold:        "#c3a782",
  goldDeep:    "#a88d68",
  goldSoft:    "rgba(195,167,130,0.15)",

  // ベース
  bg:          "#0f0a0d",  // 最暗 背景（ダーク基調）
  bgGrad1:     "#1a0f14",  // グラデ用（上）
  bgGrad2:     "#0f0a0d",  // グラデ用（下）
  surface:     "#1a1318",  // カード背景
  surfaceAlt:  "#231820",  // サブカード・ホバー
  border:      "#3a2830",  // 枠線
  borderSoft:  "#2a1e25",  // 弱い枠線

  // テキスト
  text:        "#f5ebea",  // 本文メイン
  textSub:     "#bfa8a8",  // サブテキスト
  textMuted:   "#8a7275",  // 薄めテキスト
  textFaint:   "#5a4548",  // ごく薄いテキスト

  // 機能色
  success:     "#7ab88f",
  warning:     "#f5b86b",
  danger:      "#d4736c",
  info:        "#85a8c4",

  // オーバーレイ
  overlay:     "rgba(0,0,0,0.6)",
  overlayLight:"rgba(0,0,0,0.3)",
} as const;

// ─── カラー（別名エクスポート、読みやすさのため） ───────
export const SITE = {
  color: SITE_COLORS,

  // ─── タイポグラフィ ───────────────────────────────
  font: {
    // 見出しは明朝で上品さを演出
    serif:    "'Noto Serif JP', 'Shippori Mincho', 'Hiragino Mincho ProN', 'Yu Mincho', serif",
    // 本文は Sans（既存T-MANAGEで読み込み済の Geist も流用可）
    sans:     "'Noto Sans JP', 'Hiragino Kaku Gothic ProN', 'Yu Gothic', system-ui, sans-serif",
    // アルファベット・数字用（ロゴ・時刻表示）
    display:  "'Cormorant Garamond', 'Noto Serif JP', serif",
  },

  // ─── フォントサイズ ───────────────────────────────
  fs: {
    hero:     "clamp(32px, 7vw, 64px)",   // メインビジュアル見出し
    h1:       "clamp(24px, 4vw, 36px)",
    h2:       "clamp(20px, 3vw, 28px)",
    h3:       "18px",
    body:     "14px",
    bodyLg:   "15px",
    sm:       "12px",
    xs:       "11px",
    tiny:     "10px",
  },

  // ─── ブレイクポイント（スマホファースト） ───────
  bp: {
    sm:  "480px",
    md:  "768px",
    lg:  "1024px",
    xl:  "1280px",
  },

  // ─── 余白（8px グリッド） ─────────────────────────
  sp: {
    xs: "4px",
    sm: "8px",
    md: "16px",
    lg: "24px",
    xl: "40px",
    xxl:"64px",
    xxxl:"96px",
  },

  // ─── 角丸 ─────────────────────────────────────────
  radius: {
    sm: "6px",
    md: "10px",
    lg: "16px",
    xl: "24px",
    pill: "999px",
  },

  // ─── シャドウ ─────────────────────────────────────
  shadow: {
    sm:   "0 2px 8px rgba(0,0,0,0.3)",
    md:   "0 8px 24px rgba(0,0,0,0.4)",
    lg:   "0 16px 48px rgba(0,0,0,0.5)",
    pink: "0 8px 32px rgba(232,132,154,0.25)",
    gold: "0 8px 32px rgba(195,167,130,0.25)",
  },

  // ─── トランジション ───────────────────────────────
  transition: {
    fast:   "all 0.2s ease",
    base:   "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
    slow:   "all 0.6s cubic-bezier(0.4, 0, 0.2, 1)",
  },

  // ─── z-index 階層 ─────────────────────────────────
  z: {
    base:       1,
    dropdown:  10,
    sticky:    20,
    overlay:   30,
    modal:     40,
    toast:     50,
    top:      100,
  },

  // ─── レイアウト ───────────────────────────────────
  layout: {
    maxWidth:      "1280px",   // コンテンツ最大幅
    maxWidthNarrow:"960px",    // テキスト主体ページ向け
    headerHeight:  "72px",     // PCヘッダー
    headerHeightSp:"56px",     // スマホヘッダー
    footerHeight:  "auto",
  },
} as const;

// ─── ユーティリティ: 画面幅判定用メディアクエリ文字列 ───
export const MQ = {
  sm: `@media (min-width: ${SITE.bp.sm})`,
  md: `@media (min-width: ${SITE.bp.md})`,
  lg: `@media (min-width: ${SITE.bp.lg})`,
  xl: `@media (min-width: ${SITE.bp.xl})`,
  // スマホのみ・タブレット以上の出し分け
  mobileOnly: `@media (max-width: calc(${SITE.bp.md} - 1px))`,
  desktopOnly:`@media (min-width: ${SITE.bp.md})`,
} as const;

// ─── 型エクスポート ───────────────────────────────────────
export type SiteColorKey = keyof typeof SITE_COLORS;
