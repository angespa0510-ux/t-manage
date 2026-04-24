import type { Metadata } from "next";
import { Noto_Serif_JP, Cormorant_Garamond } from "next/font/google";
import { SITE } from "../../lib/site-theme";
import SiteHeader from "../../components/site/SiteHeader";
import SiteFooter from "../../components/site/SiteFooter";
import ChatbotWidget from "../../components/site/ChatbotWidget";
import { CustomerAuthProvider } from "../../lib/customer-auth-context";

/**
 * Ange Spa 公式HP 共通レイアウト
 *
 * 方針（■19・■20 準拠）:
 *  - ホワイト基調
 *  - Noto Serif JP 統一（サンセリフ原則使用しない）
 *  - 絵文字・アイコン非使用
 */

const serifJP = Noto_Serif_JP({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-serif-jp",
  display: "swap",
});

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Ange Spa｜名古屋・三河安城・豊橋メンズエステ",
    template: "%s｜Ange Spa",
  },
  description:
    "名古屋・三河安城・豊橋エリアで展開するメンズリラクゼーションサロン「Ange Spa（アンジュスパ）」公式サイト。清楚で可憐なセラピストによる癒しのひと時を。",
  openGraph: {
    title: "Ange Spa",
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
    <CustomerAuthProvider>
      <div
        className={`${serifJP.variable} ${cormorant.variable}`}
        style={{
          minHeight: "100vh",
          backgroundColor: SITE.color.bg,
          color: SITE.color.text,
          fontFamily: SITE.font.serif,
          fontSize: SITE.fs.body,
          lineHeight: SITE.lh.body,
          fontWeight: 400,
          WebkitFontSmoothing: "antialiased",
          MozOsxFontSmoothing: "grayscale",
        }}
      >
        <SiteHeader />

        <main style={{ paddingTop: SITE.layout.headerHeightSp }}>{children}</main>

        <SiteFooter />

        <ChatbotWidget />
      </div>
    </CustomerAuthProvider>
  );
}
