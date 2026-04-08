import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "WEB予約 | チョップ",
  description: "チョップのWEB予約ページです。出勤セラピストのスケジュールを確認してオンラインでご予約いただけます。",
  openGraph: {
    title: "WEB予約 | チョップ",
    description: "チョップのWEB予約ページです。出勤セラピストのスケジュールを確認してオンラインでご予約いただけます。",
  },
};

export default function PublicScheduleLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
