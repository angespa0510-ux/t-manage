import { NextRequest, NextResponse } from "next/server";

/**
 * ═══════════════════════════════════════════════════════════════
 *  T-MANAGE ドメイン分離 middleware
 *
 *  ange-spa.jp                  → アンジュスパ屋号(公開HP + /admin + /cast + /mypage)
 *  t-manage.jp                  → T-MANAGE 製品紹介LP
 *  {tenant}.t-manage.jp         → 独自ドメインなしテナント用(将来)
 *  tera-manage.jp               → TERA-MANAGE 法人サイト
 *  admin.tera-manage.jp         → SaaS 全体管理
 *  t-manage.vercel.app          → 開発・移行用(暫定で全機能アクセス可)
 * ═══════════════════════════════════════════════════════════════
 */

// 旧URL → 新URL の自動リダイレクト(ange-spa.jp で旧URLにアクセスされた時の互換用)
const LEGACY_REDIRECTS: Record<string, string> = {
  // 管理系 → /admin/*
  "/dashboard": "/admin/dashboard",
  "/timechart": "/admin/timechart",
  "/expenses": "/admin/expenses",
  "/cash-dashboard": "/admin/cash-dashboard",
  "/tax-portal": "/admin/tax-portal",
  "/tax-dashboard": "/admin/tax-dashboard",
  "/staff": "/admin/staff",
  "/staff-attendance": "/admin/staff-attendance",
  "/staff-login": "/admin",
  "/therapists": "/admin/therapists",
  "/shifts": "/admin/shifts",
  "/courses": "/admin/courses",
  "/rooms": "/admin/rooms",
  "/manual": "/admin/manual",
  "/operations-manual": "/admin/operations-manual",
  "/notification-post": "/admin/notification-post",
  "/therapist-notification-post": "/admin/therapist-notification-post",
  "/camera": "/admin/camera",
  "/iot-settings": "/admin/iot-settings",
  "/cti-monitor": "/admin/cti-monitor",
  "/contact-sync": "/admin/contact-sync",
  "/web-booking-settings": "/admin/web-booking-settings",
  "/service-settings": "/admin/service-settings",
  "/system-setup": "/admin/system-setup",
  "/video-generator": "/admin/video-generator",
  "/analytics": "/admin/analytics",
  "/marketing-analytics": "/admin/marketing-analytics",
  "/inventory": "/admin/inventory",
  "/room-assignments": "/admin/room-assignments",
  "/notification-dashboard": "/admin/notification-dashboard",
  "/survey-dashboard": "/admin/survey-dashboard",
  "/diary-moderation": "/admin/diary-moderation",
  "/story-moderation": "/admin/story-moderation",
  "/bluesky-admin": "/admin/bluesky-admin",
  "/live-admin": "/admin/live-admin",
  "/ekichika-settings": "/admin/ekichika-settings",
  "/hp-chatbot-admin": "/admin/hp-chatbot-admin",
  "/hp-photos-admin": "/admin/hp-photos-admin",
  "/chat": "/admin/chat",
  "/chat-insights": "/admin/chat-insights",
  "/sales": "/admin/sales",
  "/call-test": "/admin/call-test",
  "/call-assistant": "/admin/call-assistant",
  "/insights": "/admin/insights",
};

// /admin/X → /X の透過リライト対象パス(逆引き用)
const ADMIN_REWRITE_TARGETS = new Set(
  Object.values(LEGACY_REDIRECTS)
    .map((p) => p.replace(/^\/admin/, ""))
    .filter((p) => p && p !== "/")
);

function rewriteAdminPath(pathname: string): string | null {
  // /admin → /staff-login(ログインページ)
  if (pathname === "/admin" || pathname === "/admin/") {
    return "/staff-login";
  }
  // /admin/dashboard → /dashboard 等
  if (pathname.startsWith("/admin/")) {
    const sub = pathname.replace(/^\/admin/, "");
    if (ADMIN_REWRITE_TARGETS.has(sub) || ADMIN_REWRITE_TARGETS.has(sub.split("/")[0] ? "/" + sub.split("/")[1] : sub)) {
      return sub;
    }
    // 安全側:全部リライトする(子パス対応)
    return sub;
  }
  return null;
}

export function middleware(req: NextRequest) {
  const host = (req.headers.get("host") || "").toLowerCase();
  const url = req.nextUrl.clone();
  const path = url.pathname;

  // ──────── 1. ange-spa.jp(アンジュスパ屋号)────────
  if (host === "www.ange-spa.jp") {
    return NextResponse.redirect(`https://ange-spa.jp${path}${url.search}`, 301);
  }
  if (host === "ange-spa.jp") {
    // 1-a. 旧URL を新URL へ 301 リダイレクト(互換)
    if (LEGACY_REDIRECTS[path]) {
      url.pathname = LEGACY_REDIRECTS[path];
      return NextResponse.redirect(url, 301);
    }
    // 1-b. /admin/* を内部リライト(URL バーは /admin/* のまま、ファイルは旧パスを利用)
    const rewritten = rewriteAdminPath(path);
    if (rewritten) {
      url.pathname = rewritten;
      return NextResponse.rewrite(url);
    }
    // 1-c. 公開HP・/cast・/mypage はそのまま
    return NextResponse.next();
  }

  // ──────── 2. tera-manage.jp(法人サイト)────────
  if (host === "www.tera-manage.jp") {
    return NextResponse.redirect(`https://tera-manage.jp${path}${url.search}`, 301);
  }
  if (host === "tera-manage.jp") {
    // ルート → /corporate に rewrite(/corporate/* もそのまま rewrite)
    if (path === "/") {
      url.pathname = "/corporate";
    } else if (!path.startsWith("/corporate") && !path.startsWith("/api") && !path.startsWith("/_next")) {
      url.pathname = `/corporate${path}`;
    }
    return NextResponse.rewrite(url);
  }

  // ──────── 3. admin.tera-manage.jp(SaaS 全体管理)────────
  if (host === "admin.tera-manage.jp") {
    if (path === "/") {
      url.pathname = "/tera-admin";
    } else if (!path.startsWith("/tera-admin") && !path.startsWith("/api") && !path.startsWith("/_next")) {
      url.pathname = `/tera-admin${path}`;
    }
    return NextResponse.rewrite(url);
  }

  // ──────── 4. {tenant}.t-manage.jp(将来テナント用)────────
  if (
    host.endsWith(".t-manage.jp") &&
    !host.startsWith("www.") &&
    host !== "t-manage.jp"
  ) {
    const tenant = host.split(".")[0];
    // 将来:テナントごとのデータ振り分けはここで(x-tenant ヘッダ経由)
    const reqHeaders = new Headers(req.headers);
    reqHeaders.set("x-tenant", tenant);

    // {tenant}.t-manage.jp 配下も ange-spa.jp と同じパス構造
    if (LEGACY_REDIRECTS[path]) {
      url.pathname = LEGACY_REDIRECTS[path];
      return NextResponse.redirect(url, 301);
    }
    const rewritten = rewriteAdminPath(path);
    if (rewritten) {
      url.pathname = rewritten;
      return NextResponse.rewrite(url, { request: { headers: reqHeaders } });
    }
    return NextResponse.next({ request: { headers: reqHeaders } });
  }

  // ──────── 5. t-manage.jp(製品 LP)────────
  if (host === "www.t-manage.jp") {
    return NextResponse.redirect(`https://t-manage.jp${path}${url.search}`, 301);
  }
  if (host === "t-manage.jp") {
    if (path === "/") {
      url.pathname = "/t-manage-lp";
    } else if (
      !path.startsWith("/t-manage-lp") &&
      !path.startsWith("/api") &&
      !path.startsWith("/_next")
    ) {
      url.pathname = `/t-manage-lp${path}`;
    }
    return NextResponse.rewrite(url);
  }

  // ──────── 6. t-manage.vercel.app などのデフォルト ────────
  // 開発・移行用。ange-spa.jp と同じルーティングを適用して
  // 旧URLリダイレクト + /admin/* リライトが動くようにする。
  // 1-a. 旧URL を新URL へ 301 リダイレクト(互換)
  if (LEGACY_REDIRECTS[path]) {
    url.pathname = LEGACY_REDIRECTS[path];
    return NextResponse.redirect(url, 301);
  }
  // 1-b. /admin/* を内部リライト
  const rewrittenDefault = rewriteAdminPath(path);
  if (rewrittenDefault) {
    url.pathname = rewrittenDefault;
    return NextResponse.rewrite(url);
  }
  return NextResponse.next();
}

export const config = {
  // _next、api、静的ファイル(拡張子付き)は対象外
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
