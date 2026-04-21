import type { MetadataRoute } from "next";

/**
 * robots.txt — 公開HPはクロール許可、管理画面は除外
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
          "/customer-mypage",
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
        ],
      },
    ],
    sitemap: "https://t-manage.vercel.app/sitemap.xml",
  };
}
