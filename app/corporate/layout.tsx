import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "合同会社テラスライフ | AI・デザイン・DXソリューション",
  description: "AIソリューション開発、Webデザイン・システム開発、DX推進支援を提供する合同会社テラスライフの公式サイトです。",
  openGraph: {
    title: "合同会社テラスライフ | AI・デザイン・DXソリューション",
    description: "AIソリューション開発、Webデザイン・システム開発、DX推進支援を提供する合同会社テラスライフの公式サイトです。",
    type: "website",
    images: [{ url: "/corporate/ogp.jpg", width: 1200, height: 630, alt: "TERRACE LIFE - 合同会社テラスライフ" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "合同会社テラスライフ | AI・デザイン・DXソリューション",
    description: "AI・デザイン・DX — 最先端の技術力で課題を解決",
    images: ["/corporate/ogp.jpg"],
  },
};

export default function CorporateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
