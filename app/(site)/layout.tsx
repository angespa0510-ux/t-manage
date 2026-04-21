import type { Metadata } from "next";
import { Noto_Serif_JP, Noto_Sans_JP, Cormorant_Garamond } from "next/font/google";
import { SITE } from "../../lib/site-theme";
import SiteHeader from "../../components/site/SiteHeader";
import SiteFooter from "../../components/site/SiteFooter";

/**
 * ═══════════════════════════════════════════════════════════
 * Ange Spa 公式HP 共通レイアウト
 *
 * Next.js のルートグループ (site) により、新HP群のページだけ
 * にこのレイアウトを適用する。URL には (site) は含まれない。
 *
 * 対象ページ:
 *   /            ← app/(site)/page.tsx（HOME、コミット #7 で実装）
 *   /system      ← app/(site)/system/page.tsx（コミット #8）
 *   /therapist   ← app/(site)/therapist/page.tsx（コミット #9）
 *   /schedule    ← app/(site)/schedule/page.tsx（コミット #11）
 *   /access      ← app/(site)/access/page.tsx（コミット #12）
 *   /recruit     ← app/(site)/recruit/page.tsx（コミット #12）
 *
 * このレイアウトは app/layout.tsx（ルート）の内側に入るため、
 * ThemeProvider 等の管理系プロバイダーは継承される。
 * HP側で useTheme / useStaffSession を呼ばなければ無害。
 *
 * ヘッダー・フッター・ハンバーガー等の UI コンポーネントは
 * コミット #4 で追加予定。このファイルは骨組みのみ。
 * ═══════════════════════════════════════════════════════════
 */

// フォント読み込み（新HP専用、Google Fonts から）
const serifJP = Noto_Serif_JP({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-serif-jp",
  display: "swap",
});

const sansJP = Noto_Sans_JP({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-sans-jp",
  display: "swap",
});

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

// このルートグループのデフォルト metadata
// 各ページで個別に上書き可
export const metadata: Metadata = {
  title: {
    default: "Ange Spa〜アンジュスパ｜名古屋・三河安城・豊橋メンズエステ",
    template: "%s ｜ Ange Spa",
  },
  description:
    "名古屋・三河安城・豊橋エリアで展開するメンズリラクゼーションサロン「Ange Spa〜アンジュスパ」公式サイト。可愛らしい女の子と癒しのひと時を。",
  openGraph: {
    title: "Ange Spa〜アンジュスパ",
    description: "名古屋・三河安城・豊橋のメンズリラクゼーションサロン",
    locale: "ja_JP",
    type: "website",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`${serifJP.variable} ${sansJP.variable} ${cormorant.variable}`}
      style={{
        minHeight: "100vh",
        backgroundColor: SITE.color.bg,
        background: `linear-gradient(180deg, ${SITE.color.bgGrad1} 0%, ${SITE.color.bgGrad2} 100%)`,
        color: SITE.color.text,
        fontFamily: SITE.font.sans,
        fontSize: SITE.fs.body,
        lineHeight: 1.8,
      }}
    >
      {/* 共通ヘッダー */}
      <SiteHeader />

      <main
        style={{
          minHeight: "calc(100vh - 200px)",
          paddingTop: SITE.layout.headerHeightSp,
        }}
      >
        {children}
      </main>

      {/* 共通フッター */}
      <SiteFooter />
    </div>
  );
}
