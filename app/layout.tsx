import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "../lib/theme";
import { ToastProvider } from "../lib/toast";
import { StaffSessionProvider } from "../lib/staff-session";
import { CtiPopupProvider } from "../lib/cti-popup";
import { CommandPaletteProvider } from "../lib/command-palette";
import PinChangeModal from "../components/PinChangeModal";
import PwaRegister from "../components/PwaRegister";
import { VercelAnalyticsGate } from "../components/VercelAnalyticsGate";
import { ClarityScript } from "../components/ClarityScript";
import { GoogleAnalytics } from "../components/GoogleAnalytics";
import { METADATA_BASE_URL } from "../lib/site-urls";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(METADATA_BASE_URL),
  title: "T-MANAGE | Ange Spa",
  description: "リラクゼーションサロン「Ange Spa」の統合管理システム",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "T-MANAGE",
  },
  icons: {
    icon: [
      { url: "/icons/icon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#c96b83",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ja"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col" style={{ margin: 0 }}>
        <ThemeProvider><ToastProvider><StaffSessionProvider><CtiPopupProvider><CommandPaletteProvider>{children}<PinChangeModal /><PwaRegister /></CommandPaletteProvider></CtiPopupProvider></StaffSessionProvider></ToastProvider></ThemeProvider>
        <VercelAnalyticsGate />
        <ClarityScript />
        <GoogleAnalytics />
      </body>
    </html>
  );
}