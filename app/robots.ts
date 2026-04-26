import type { MetadataRoute } from "next";
import { PUBLIC_HP_URL } from "../lib/site-urls";

/**
 * robots.txt — 公開HP（ange-spa.jp）の SEO 設定
 *
 * この robots.txt は ange-spa.jp でアクセスされた時にクロール許可するページを制御する。
 * 管理画面系のパスは disallow して検索結果に出さない。
 *
 * 注: ange-spa.t-manage.jp（管理画面ドメイン）は、別途 meta robots noindex か、
 *     host ベースのミドルウェアで処理する想定。
 */

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: [
          "/",
          "/system",
          "/therapist",
          "/schedule",
          "/access",
          "/recruit",
          "/contact",
        ],
        disallow: [
          "/staff-login",
          "/dashboard",
          "/timechart",
          "/therapists",
          "/rooms",
          "/courses",
          "/shifts",
          "/staff",
          "/mypage",
          "/mypage",
          "/api/",
          "/tax-portal",
          "/cash-dashboard",
          "/tax-dashboard",
          "/expenses",
          "/analytics",
          "/manual",
          "/operations-manual",
          "/camera",
          "/iot-settings",
          "/contact-sync",
          "/web-booking-settings",
          "/service-settings",
          "/system-setup",
          "/video-generator",
          "/room-assignments",
          "/notification-post",
          "/therapist-notification-post",
          "/staff-attendance",
          "/estama-bridge",
          "/sms-bridge",
          "/contract-sign/",
          "/invoice-upload/",
          "/license-upload/",
          "/mynumber-upload/",
          "/tera-admin",
          "/call-assistant",
          "/call-test",
          "/chat",
          "/chat-insights",
          "/cti-monitor",
          "/hp-chatbot-admin",
          "/hp-photos-admin",
          "/install-guide",
          "/inventory",
          "/notification-dashboard",
          "/sales",
        ],
      },
    ],
    sitemap: `${PUBLIC_HP_URL}/sitemap.xml`,
  };
}
