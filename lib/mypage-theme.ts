/**
 * ═══════════════════════════════════════════════════════════
 * Ange Spa お客様マイページ デザインシステム
 *
 * 方針:
 *  - HPの SITE テーマを継承（色・フォント・余白）
 *  - ただしマイページは「使う」画面なので、HPよりも情報密度を許容
 *  - 機能を補助する絵文字は SVGアイコン（線画）に置換
 *  - ピンク基調 + ホワイト基調 + 明朝見出し
 * ═══════════════════════════════════════════════════════════
 */

import { SITE, SITE_COLORS } from "./site-theme";

export const MYPAGE = {
  // HPテーマを継承
  color: {
    ...SITE_COLORS,

    // マイページ特有：機能的な意味を持つ色（最小限）
    success:     "#6b9b7e",   // 確定済み
    warning:     "#d4a574",   // 注意・警告（ベージュ系で世界観を壊さない）
    danger:      "#c96b83",   // エラー（HPのpinkDeepを流用）

    // 背景グラデ（ごく淡い）
    bgGradient:  "linear-gradient(180deg, #ffffff 0%, #fdfaf7 100%)",
    pinkGradient: "linear-gradient(135deg, #e8849a 0%, #c96b83 100%)",
  },

  font: SITE.font,
  fs: SITE.fs,
  lh: SITE.lh,
  ls: SITE.ls,
  bp: SITE.bp,
  sp: SITE.sp,

  // マイページ専用：やや丸みのある角丸（機能性寄り）
  radius: {
    none: "0",
    sm:   "2px",
    md:   "4px",
    lg:   "8px",
    xl:   "12px",
    pill: "9999px",
  },

  // 罫線スタイル
  border: {
    hairline:  `1px solid ${SITE_COLORS.border}`,
    soft:      `1px solid ${SITE_COLORS.borderSoft}`,
    pink:      `1px solid ${SITE_COLORS.borderPink}`,
    accent:    `1px solid ${SITE_COLORS.pink}`,
  },

  // シャドウ（極めて控えめ）
  shadow: {
    none: "none",
    soft: "0 1px 3px rgba(0,0,0,0.04)",
    card: "0 2px 12px rgba(0,0,0,0.04)",
  },

  // 画像スロット（/public/mypage/ に配置予定）
  // 存在しなければフォールバック表示
  images: {
    heroLogin:       "/mypage/hero-login.jpg",          // ログイン画面背景
    heroHome:        "/mypage/hero-home.jpg",           // ホーム上部装飾
    emptyReservation: "/mypage/empty-reservation.jpg",  // 次回予約なし
    emptyFavorite:   "/mypage/empty-favorite.jpg",      // お気に入りなし
    emptyNotification: "/mypage/empty-notification.jpg",// お知らせなし
    welcomeLoop:     "/mypage/welcome-loop.mp4",        // ホーム動画
  },
} as const;

// ─── 共通スタイル片 ───────────────────────
export const MYPAGE_STYLES = {
  // ページ全体の背景
  pageBg: {
    minHeight: "100vh",
    backgroundColor: MYPAGE.color.bg,
    color: MYPAGE.color.text,
    fontFamily: MYPAGE.font.serif,
  } as const,

  // カード
  card: {
    backgroundColor: MYPAGE.color.surface,
    border: MYPAGE.border.hairline,
    borderRadius: MYPAGE.radius.lg,
  } as const,

  // 見出し（明朝・大きめ・余白）
  heading: {
    fontFamily: MYPAGE.font.display,
    fontSize: MYPAGE.fs.h3,
    fontWeight: 400,
    letterSpacing: MYPAGE.ls.loose,
    color: MYPAGE.color.text,
  } as const,

  // 小見出し（英字キャプション）
  kicker: {
    fontFamily: MYPAGE.font.display,
    fontSize: MYPAGE.fs.tiny,
    fontWeight: 400,
    letterSpacing: MYPAGE.ls.wider,
    color: MYPAGE.color.pink,
    textTransform: "uppercase" as const,
  } as const,

  // 本文
  body: {
    fontSize: MYPAGE.fs.sm,
    lineHeight: MYPAGE.lh.body,
    color: MYPAGE.color.textSub,
  } as const,

  // ピンクのプライマリボタン
  primaryButton: {
    backgroundColor: MYPAGE.color.pink,
    color: "#ffffff",
    border: "none",
    borderRadius: MYPAGE.radius.md,
    padding: "12px 24px",
    fontFamily: MYPAGE.font.serif,
    fontSize: MYPAGE.fs.sm,
    letterSpacing: MYPAGE.ls.loose,
    cursor: "pointer",
  } as const,

  // アウトラインボタン
  outlineButton: {
    backgroundColor: "transparent",
    color: MYPAGE.color.pink,
    border: MYPAGE.border.accent,
    borderRadius: MYPAGE.radius.md,
    padding: "11px 24px",
    fontFamily: MYPAGE.font.serif,
    fontSize: MYPAGE.fs.sm,
    letterSpacing: MYPAGE.ls.loose,
    cursor: "pointer",
  } as const,

  // セクション区切り線（HP風）
  divider: {
    height: "1px",
    backgroundColor: MYPAGE.color.border,
    border: "none",
    margin: `${MYPAGE.sp.lg} 0`,
  } as const,
};

export default MYPAGE;
