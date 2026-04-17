import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "合同会社テラスライフ | AI・デザイン・DXソリューション",
  description: "AIソリューション開発、Webデザイン・システム開発、DX推進支援を提供する合同会社テラスライフの公式サイトです。",
  openGraph: {
    title: "合同会社テラスライフ | AI・デザイン・DXソリューション",
    description: "AIソリューション開発、Webデザイン・システム開発、DX推進支援を提供する合同会社テラスライフの公式サイトです。",
    type: "website",
  },
};

export default function CorporateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
