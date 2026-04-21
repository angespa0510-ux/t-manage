"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { SITE } from "../../lib/site-theme";

/**
 * ═══════════════════════════════════════════════════════════
 * Ange Spa 公式HP — HOME
 *
 * 現行HP (ange-spa.com) のレイアウト構成を踏襲:
 *   1. メインビジュアル（フルスクリーン、ロゴ+キャッチ+CTA）
 *   2. Our Concept
 *   3. Today's Schedule（本日の出勤ダイジェスト）
 *   4. PICK UP（is_pickup=true）
 *   5. NEW FACE（is_newcomer=true or entry_date が直近90日）
 *   6. RECRUIT
 *   7. CONTENTS（料金・アクセス・予約への導線）
 *   8. メッセージ
 *
 * ルートグループ (site) の layout.tsx により、ヘッダー・フッターは
 * 自動で表示される。このページ本体は main コンテンツのみ。
 * ═══════════════════════════════════════════════════════════
 */

// ─── 型 ─────────────────────────────────────────────────────
type Therapist = {
  id: number;
  name: string;
  age: number;
  height_cm: number;
  bust: number;
  cup: string;
  photo_url: string;
  status: string;
  entry_date: string;
  catchphrase?: string;
  specialty?: string;
  tags?: string[];
  is_pickup?: boolean;
  is_newcomer?: boolean;
  public_sort_order?: number;
  blog_url?: string;
  twitter_url?: string;
};

type Shift = {
  id: number;
  therapist_id: number;
  date: string;
  start_time: string;
  end_time: string;
  store_id: number;
};

type Store = {
  id: number;
  name: string;
  shop_display_name?: string;
  shop_is_public?: boolean;
};

// ─── ユーティリティ ─────────────────────────────────────────
const todayStr = () => new Date().toISOString().split("T")[0];
const timeHM = (t: string) => (t || "").slice(0, 5);
const isNewcomerByDate = (entry?: string) => {
  if (!entry) return false;
  const d = new Date(entry).getTime();
  if (!d) return false;
  const diff = new Date().getTime() - d;
  return diff >= 0 && diff < 90 * 24 * 60 * 60 * 1000;
};
const getWorkStatus = (shift: Shift | undefined) => {
  if (!shift) return null;
  const now = new Date();
  const [sh, sm] = shift.start_time.split(":").map(Number);
  const [eh, em] = shift.end_time.split(":").map(Number);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const startMin = sh * 60 + sm;
  const endMin = eh * 60 + em;
  // 深夜跨ぎ対応
  const normEnd = endMin < startMin ? endMin + 24 * 60 : endMin;
  const normNow = nowMin < startMin ? nowMin + 24 * 60 : nowMin;
  if (normNow >= startMin && normNow <= normEnd) return "working"; // 出勤中
  if (normNow < startMin) return "upcoming"; // 出勤前
  return "finished"; // 終了
};

// ─── ページ本体 ─────────────────────────────────────────────
export default function HomePage() {
  const router = useRouter();
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);

  // ─── PWA 自動リダイレクト（ホーム画面起動のスタッフ/顧客を即遷移） ───
  useEffect(() => {
    if (typeof window === "undefined") return;
    type IosWindow = Window & { navigator: Navigator & { standalone?: boolean } };
    const isStandalone =
      (window as IosWindow).navigator.standalone === true ||
      window.matchMedia?.("(display-mode: standalone)").matches;
    if (!isStandalone) return;

    try {
      // 優先: セラピスト > お客様 > スタッフ
      const therapistSession = localStorage.getItem("therapist_session");
      if (therapistSession) {
        router.replace("/mypage");
        return;
      }
      const customerId = localStorage.getItem("customer_mypage_id");
      if (customerId) {
        router.replace("/customer-mypage");
        return;
      }
      const staffSession = sessionStorage.getItem("t-manage-staff");
      if (staffSession) {
        router.replace("/dashboard");
        return;
      }
    } catch {
      // localStorage アクセス失敗時は通常表示
    }
  }, [router]);

  // ─── データ取得 ───
  useEffect(() => {
    (async () => {
      const t = todayStr();
      const [tResp, sResp, stResp] = await Promise.all([
        supabase
          .from("therapists")
          .select("*")
          .eq("is_public", true)
          .eq("status", "active")
          .is("deleted_at", null)
          .order("public_sort_order", { ascending: true })
          .order("id", { ascending: false }),
        supabase.from("shifts").select("*").eq("date", t),
        supabase.from("stores").select("id,name,shop_display_name,shop_is_public"),
      ]);
      setTherapists(tResp.data || []);
      setShifts(sResp.data || []);
      setStores(stResp.data || []);
      setLoading(false);
    })();
  }, []);

  // ─── セグメント計算 ───
  const shiftByTherapist: Record<number, Shift | undefined> = {};
  for (const s of shifts) shiftByTherapist[s.therapist_id] = s;

  const workingToday = therapists
    .filter((t) => shiftByTherapist[t.id])
    .sort((a, b) => {
      const sa = shiftByTherapist[a.id]?.start_time || "99:99";
      const sb = shiftByTherapist[b.id]?.start_time || "99:99";
      return sa.localeCompare(sb);
    })
    .slice(0, 8);

  const pickups = therapists.filter((t) => t.is_pickup).slice(0, 6);
  const newcomers = therapists
    .filter((t) => t.is_newcomer || isNewcomerByDate(t.entry_date))
    .slice(0, 12);

  const getStoreName = (sid: number) => {
    const s = stores.find((x) => x.id === sid);
    return s?.shop_display_name || s?.name || "";
  };

  return (
    <>
      {/* ═══════════════════════════════════════════════
          ① メインビジュアル
          ═══════════════════════════════════════════════ */}
      <section
        style={{
          position: "relative",
          minHeight: "calc(100vh - 56px)",
          marginTop: `calc(-1 * ${SITE.layout.headerHeightSp})`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          padding: "60px 20px",
        }}
      >
        {/* 背景グラデ + ラジアル */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `
              radial-gradient(ellipse at 30% 20%, rgba(232,132,154,0.18) 0%, transparent 50%),
              radial-gradient(ellipse at 70% 80%, rgba(195,167,130,0.12) 0%, transparent 50%),
              linear-gradient(180deg, #1a0f14 0%, #0f0a0d 100%)
            `,
          }}
        />

        {/* 薄いテクスチャ（ノイズ） */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: 0.03,
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
          }}
        />

        {/* 中央コンテンツ */}
        <div
          style={{
            position: "relative",
            zIndex: 1,
            textAlign: "center",
            maxWidth: 720,
            animation: "siteFadeUp 1.2s cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        >
          {/* 装飾ライン */}
          <div
            style={{
              width: 1,
              height: 60,
              background: `linear-gradient(180deg, transparent, ${SITE.color.pink})`,
              margin: "0 auto 32px",
            }}
          />

          {/* ブランドロゴ（テキスト） */}
          <h1
            style={{
              fontFamily: SITE.font.display,
              fontSize: "clamp(48px, 12vw, 96px)",
              fontWeight: 500,
              letterSpacing: "0.12em",
              color: SITE.color.pink,
              lineHeight: 1,
              marginBottom: 12,
              textShadow: "0 4px 24px rgba(232,132,154,0.3)",
            }}
          >
            Ange Spa
          </h1>
          <p
            style={{
              fontFamily: SITE.font.serif,
              fontSize: "clamp(13px, 2.5vw, 16px)",
              letterSpacing: "0.5em",
              color: SITE.color.textSub,
              marginBottom: 48,
              paddingLeft: "0.5em",
            }}
          >
            アンジュスパ
          </p>

          {/* キャッチコピー */}
          <p
            style={{
              fontFamily: SITE.font.serif,
              fontSize: "clamp(16px, 3.5vw, 22px)",
              lineHeight: 2.2,
              color: SITE.color.text,
              letterSpacing: "0.1em",
              marginBottom: 40,
            }}
          >
            可愛らしい女の子と<br />
            癒しのひと時を、、
          </p>

          {/* エリア表記 */}
          <p
            style={{
              fontFamily: SITE.font.display,
              fontSize: "11px",
              letterSpacing: "0.3em",
              color: SITE.color.textMuted,
              marginBottom: 48,
            }}
          >
            NAGOYA × MIKAWA-ANJO × TOYOHASHI
          </p>

          {/* CTA */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 12,
              alignItems: "center",
              maxWidth: 320,
              margin: "0 auto",
            }}
          >
            <Link
              href="/schedule"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                width: "100%",
                padding: "16px 32px",
                borderRadius: SITE.radius.pill,
                background: `linear-gradient(135deg, ${SITE.color.pink} 0%, ${SITE.color.pinkDeep} 100%)`,
                color: "#fff",
                fontSize: "14px",
                fontWeight: 600,
                letterSpacing: "0.15em",
                textDecoration: "none",
                boxShadow: SITE.shadow.pink,
                transition: SITE.transition.base,
              }}
            >
              <span style={{ fontFamily: SITE.font.display }}>WEB RESERVE</span>
              <span style={{ fontSize: 16 }}>→</span>
            </Link>
            <a
              href="tel:070-1675-5900"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                width: "100%",
                padding: "14px 28px",
                borderRadius: SITE.radius.pill,
                background: "transparent",
                border: `1px solid ${SITE.color.pink}88`,
                color: SITE.color.pink,
                fontSize: "13px",
                letterSpacing: "0.1em",
                textDecoration: "none",
                fontFamily: SITE.font.display,
              }}
            >
              📞 070-1675-5900
            </a>
          </div>

          {/* 営業時間 */}
          <p
            style={{
              marginTop: 40,
              fontSize: "11px",
              letterSpacing: "0.1em",
              color: SITE.color.textMuted,
              fontFamily: SITE.font.display,
            }}
          >
            OPEN 12:00 — LAST 27:00 ／ RECEPTION UNTIL 26:00
          </p>
        </div>

        {/* スクロール誘導 */}
        <div
          style={{
            position: "absolute",
            bottom: 20,
            left: "50%",
            transform: "translateX(-50%)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 6,
            color: SITE.color.textMuted,
            animation: "siteBounce 2.4s ease-in-out infinite",
          }}
        >
          <span
            style={{
              fontFamily: SITE.font.display,
              fontSize: 9,
              letterSpacing: "0.3em",
            }}
          >
            SCROLL
          </span>
          <span style={{ fontSize: 16 }}>↓</span>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════
          ② Our Concept
          ═══════════════════════════════════════════════ */}
      <SectionBlock label="CONCEPT" title="私たちについて">
        <div
          style={{
            textAlign: "center",
            maxWidth: 640,
            margin: "0 auto",
            padding: `${SITE.sp.xl} 0`,
          }}
        >
          <p
            style={{
              fontFamily: SITE.font.serif,
              fontSize: "clamp(16px, 3vw, 20px)",
              lineHeight: 2.5,
              color: SITE.color.text,
              letterSpacing: "0.1em",
              marginBottom: 32,
            }}
          >
            清楚で可憐な彼女たちは<br />
            ビジュアル面でも目を引きますが<br />
            それ以上に最高のマナーを兼ね備え<br />
            <span style={{ color: SITE.color.pink }}>安らぎと癒し</span>
            を運びます
          </p>
          <p
            style={{
              fontFamily: SITE.font.display,
              fontSize: 11,
              letterSpacing: "0.2em",
              color: SITE.color.textMuted,
              lineHeight: 2,
            }}
          >
            Please spend a relaxing time<br />
            with a pretty girl.
          </p>
        </div>
      </SectionBlock>

      {/* ═══════════════════════════════════════════════
          ③ 本日の出勤
          ═══════════════════════════════════════════════ */}
      <SectionBlock
        label="TODAY'S SCHEDULE"
        title="本日の出勤セラピスト"
        badge={loading ? undefined : `${workingToday.length}名`}
      >
        {loading ? (
          <LoadingBlock />
        ) : workingToday.length === 0 ? (
          <EmptyBlock
            emoji="🌸"
            title="本日出勤予定のセラピストはまだ公開されていません"
            sub="明日以降のスケジュールも順次公開されます"
            link={{ href: "/schedule", label: "スケジュールを見る →" }}
          />
        ) : (
          <>
            <TherapistGrid>
              {workingToday.map((t) => {
                const shift = shiftByTherapist[t.id];
                const work = getWorkStatus(shift);
                return (
                  <TherapistCard
                    key={t.id}
                    therapist={t}
                    timeLabel={
                      shift ? `${timeHM(shift.start_time)} — ${timeHM(shift.end_time)}` : ""
                    }
                    statusLabel={
                      work === "working"
                        ? "出勤中"
                        : work === "upcoming"
                        ? "出勤前"
                        : work === "finished"
                        ? "本日終了"
                        : ""
                    }
                    statusColor={
                      work === "working"
                        ? SITE.color.success
                        : work === "upcoming"
                        ? SITE.color.pink
                        : SITE.color.textMuted
                    }
                    storeName={shift ? getStoreName(shift.store_id) : ""}
                  />
                );
              })}
            </TherapistGrid>
            <ViewMoreButton href="/schedule" label="VIEW ALL SCHEDULE" />
          </>
        )}
      </SectionBlock>

      {/* ═══════════════════════════════════════════════
          ④ PICK UP
          ═══════════════════════════════════════════════ */}
      {!loading && pickups.length > 0 && (
        <SectionBlock label="PICK UP" title="注目のセラピスト">
          <TherapistGrid>
            {pickups.map((t) => (
              <TherapistCard key={t.id} therapist={t} pickup />
            ))}
          </TherapistGrid>
        </SectionBlock>
      )}

      {/* ═══════════════════════════════════════════════
          ⑤ NEW FACE
          ═══════════════════════════════════════════════ */}
      {!loading && newcomers.length > 0 && (
        <SectionBlock label="NEW FACE" title="新人セラピスト">
          <TherapistGrid>
            {newcomers.map((t) => (
              <TherapistCard key={t.id} therapist={t} newBadge />
            ))}
          </TherapistGrid>
          <ViewMoreButton href="/therapist" label="VIEW ALL THERAPIST" />
        </SectionBlock>
      )}

      {/* ═══════════════════════════════════════════════
          ⑥ RECRUIT
          ═══════════════════════════════════════════════ */}
      <SectionBlock label="RECRUIT" title="セラピストさん大募集">
        <div
          style={{
            maxWidth: 720,
            margin: "0 auto",
            padding: `${SITE.sp.xl} ${SITE.sp.md}`,
            borderRadius: SITE.radius.lg,
            background: `linear-gradient(135deg, ${SITE.color.surface} 0%, ${SITE.color.surfaceAlt} 100%)`,
            border: `1px solid ${SITE.color.border}`,
            textAlign: "center",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: -80,
              right: -80,
              width: 200,
              height: 200,
              borderRadius: "50%",
              background: `radial-gradient(circle, ${SITE.color.pink}33 0%, transparent 70%)`,
            }}
          />
          <p
            style={{
              fontFamily: SITE.font.serif,
              fontSize: "clamp(15px, 3vw, 18px)",
              lineHeight: 2,
              color: SITE.color.text,
              marginBottom: 24,
              position: "relative",
            }}
          >
            一緒に働いてくれる仲間を<br />
            募集しています
          </p>
          <Link
            href="/recruit"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "12px 32px",
              borderRadius: SITE.radius.pill,
              background: SITE.color.pink,
              color: "#fff",
              fontSize: 13,
              fontFamily: SITE.font.display,
              letterSpacing: "0.2em",
              textDecoration: "none",
              boxShadow: SITE.shadow.pink,
            }}
          >
            VIEW MORE <span>→</span>
          </Link>
        </div>
      </SectionBlock>

      {/* ═══════════════════════════════════════════════
          ⑦ CONTENTS（各ページへの導線）
          ═══════════════════════════════════════════════ */}
      <SectionBlock label="CONTENTS" title="サービス案内">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: SITE.sp.md,
            maxWidth: SITE.layout.maxWidth,
            margin: "0 auto",
          }}
        >
          {[
            { en: "SYSTEM", jp: "料金・コース", href: "/system", icon: "💴" },
            { en: "ACCESS", jp: "アクセス", href: "/access", icon: "📍" },
            { en: "RESERVE", jp: "WEB予約", href: "/schedule", icon: "📅" },
            { en: "CONTACT", jp: "お問い合わせ", href: "/contact", icon: "💌" },
          ].map((c) => (
            <Link
              key={c.href}
              href={c.href}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 10,
                padding: `${SITE.sp.xl} ${SITE.sp.md}`,
                borderRadius: SITE.radius.lg,
                background: SITE.color.surface,
                border: `1px solid ${SITE.color.border}`,
                color: SITE.color.text,
                textDecoration: "none",
                textAlign: "center",
                transition: SITE.transition.base,
              }}
              className="site-content-card"
            >
              <span style={{ fontSize: 32 }}>{c.icon}</span>
              <span
                style={{
                  fontFamily: SITE.font.display,
                  fontSize: 14,
                  letterSpacing: "0.2em",
                  color: SITE.color.pink,
                }}
              >
                {c.en}
              </span>
              <span style={{ fontSize: 11, color: SITE.color.textSub }}>{c.jp}</span>
            </Link>
          ))}
        </div>
      </SectionBlock>

      {/* ═══════════════════════════════════════════════
          ⑧ メッセージ
          ═══════════════════════════════════════════════ */}
      <section style={{ padding: `${SITE.sp.xxxl} ${SITE.sp.md}` }}>
        <div
          style={{
            maxWidth: 640,
            margin: "0 auto",
            textAlign: "center",
            padding: SITE.sp.xl,
          }}
        >
          <p
            style={{
              fontFamily: SITE.font.display,
              fontSize: 11,
              letterSpacing: "0.3em",
              color: SITE.color.pink,
              marginBottom: 24,
            }}
          >
            MESSAGE
          </p>
          <p
            style={{
              fontFamily: SITE.font.serif,
              fontSize: "clamp(13px, 2.5vw, 15px)",
              lineHeight: 2.4,
              color: SITE.color.textSub,
              letterSpacing: "0.08em",
            }}
          >
            Ange Spa ではマッサージ技術だけでなく<br />
            接客指導に力を入れております。<br />
            皆様の日頃の疲れを癒やすお手伝いが<br />
            出来れば幸いです。
          </p>
        </div>
      </section>

      {/* ─── アニメーション定義 ─── */}
      <style>{`
        @keyframes siteFadeUp {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes siteBounce {
          0%, 100% { transform: translateX(-50%) translateY(0); opacity: 0.5; }
          50% { transform: translateX(-50%) translateY(6px); opacity: 1; }
        }
        @keyframes siteFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .site-content-card {
          transition: ${SITE.transition.base};
        }
        .site-content-card:hover {
          transform: translateY(-4px);
          border-color: ${SITE.color.pink}66 !important;
          box-shadow: ${SITE.shadow.pink};
        }
        .site-therapist-card {
          transition: ${SITE.transition.base};
        }
        .site-therapist-card:hover {
          transform: translateY(-4px);
        }
        .site-therapist-card:hover .site-therapist-img {
          transform: scale(1.05);
        }
      `}</style>
    </>
  );
}

// ═══════════════════════════════════════════════════════════
// サブコンポーネント群
// ═══════════════════════════════════════════════════════════

function SectionBlock({
  label,
  title,
  badge,
  children,
}: {
  label: string;
  title: string;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{ padding: `${SITE.sp.xxl} ${SITE.sp.md}` }}>
      <div style={{ maxWidth: SITE.layout.maxWidth, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: SITE.sp.xl }}>
          <p
            style={{
              fontFamily: SITE.font.display,
              fontSize: 11,
              letterSpacing: "0.3em",
              color: SITE.color.pink,
              marginBottom: 8,
            }}
          >
            {label}
          </p>
          <h2
            style={{
              fontFamily: SITE.font.serif,
              fontSize: SITE.fs.h2,
              color: SITE.color.text,
              letterSpacing: "0.08em",
              display: "inline-flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            {title}
            {badge && (
              <span
                style={{
                  fontFamily: SITE.font.display,
                  fontSize: 12,
                  letterSpacing: "0.1em",
                  color: SITE.color.pink,
                  padding: "4px 12px",
                  borderRadius: SITE.radius.pill,
                  background: SITE.color.pinkGhost,
                  border: `1px solid ${SITE.color.pink}44`,
                }}
              >
                {badge}
              </span>
            )}
          </h2>
          <div
            style={{
              width: 40,
              height: 1,
              background: SITE.color.pink,
              margin: `${SITE.sp.md} auto 0`,
            }}
          />
        </div>
        {children}
      </div>
    </section>
  );
}

function TherapistGrid({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
        gap: SITE.sp.md,
      }}
      className="site-therapist-grid"
    >
      {children}
      <style>{`
        @media (min-width: 520px) {
          .site-therapist-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
        }
        @media (min-width: 768px) {
          .site-therapist-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
        }
      `}</style>
    </div>
  );
}

function TherapistCard({
  therapist,
  timeLabel,
  statusLabel,
  statusColor,
  storeName,
  pickup,
  newBadge,
}: {
  therapist: Therapist;
  timeLabel?: string;
  statusLabel?: string;
  statusColor?: string;
  storeName?: string;
  pickup?: boolean;
  newBadge?: boolean;
}) {
  const t = therapist;
  return (
    <Link
      href={`/therapist/${t.id}`}
      className="site-therapist-card"
      style={{
        display: "flex",
        flexDirection: "column",
        borderRadius: SITE.radius.md,
        background: SITE.color.surface,
        border: `1px solid ${SITE.color.border}`,
        overflow: "hidden",
        textDecoration: "none",
        color: SITE.color.text,
        position: "relative",
      }}
    >
      {/* キャッチコピー帯 */}
      {t.catchphrase && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            zIndex: 2,
            padding: "6px 8px",
            fontSize: 9,
            fontWeight: 500,
            letterSpacing: "0.05em",
            background: "linear-gradient(180deg, rgba(232,132,154,0.95), rgba(201,107,131,0.85))",
            color: "#fff",
            textAlign: "center",
            lineHeight: 1.4,
          }}
        >
          {t.catchphrase}
        </div>
      )}

      {/* 写真 */}
      <div
        style={{
          width: "100%",
          aspectRatio: "3 / 4",
          overflow: "hidden",
          position: "relative",
          background: SITE.color.surfaceAlt,
        }}
      >
        {t.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={t.photo_url}
            alt={t.name}
            className="site-therapist-img"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              transition: SITE.transition.slow,
            }}
            loading="lazy"
          />
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: SITE.color.textMuted,
              fontSize: 28,
            }}
          >
            🌸
          </div>
        )}

        {/* バッジ */}
        <div
          style={{
            position: "absolute",
            bottom: 8,
            left: 8,
            display: "flex",
            gap: 4,
            flexWrap: "wrap",
          }}
        >
          {newBadge && (
            <span
              style={{
                padding: "3px 8px",
                borderRadius: SITE.radius.pill,
                background: SITE.color.pink,
                color: "#fff",
                fontSize: 9,
                fontWeight: 600,
                letterSpacing: "0.1em",
                boxShadow: SITE.shadow.pink,
              }}
            >
              NEW
            </span>
          )}
          {pickup && (
            <span
              style={{
                padding: "3px 8px",
                borderRadius: SITE.radius.pill,
                background: SITE.color.gold,
                color: "#fff",
                fontSize: 9,
                fontWeight: 600,
                letterSpacing: "0.1em",
              }}
            >
              PICK UP
            </span>
          )}
          {statusLabel && (
            <span
              style={{
                padding: "3px 8px",
                borderRadius: SITE.radius.pill,
                background: "rgba(0,0,0,0.7)",
                color: statusColor || SITE.color.text,
                fontSize: 9,
                fontWeight: 600,
                letterSpacing: "0.1em",
                backdropFilter: "blur(4px)",
              }}
            >
              {statusLabel}
            </span>
          )}
        </div>
      </div>

      {/* 情報 */}
      <div style={{ padding: "12px 12px 14px" }}>
        <div
          style={{
            fontFamily: SITE.font.serif,
            fontSize: 15,
            fontWeight: 500,
            color: SITE.color.text,
            marginBottom: 4,
            letterSpacing: "0.05em",
          }}
        >
          {t.name}
        </div>
        <div
          style={{
            fontFamily: SITE.font.display,
            fontSize: 10,
            color: SITE.color.textSub,
            letterSpacing: "0.08em",
            marginBottom: timeLabel || storeName ? 8 : 0,
          }}
        >
          {t.age ? `${t.age}歳` : ""}
          {t.height_cm ? ` · ${t.height_cm}cm` : ""}
          {t.cup ? ` · ${t.cup}cup` : ""}
        </div>
        {timeLabel && (
          <div
            style={{
              fontFamily: SITE.font.display,
              fontSize: 11,
              color: SITE.color.pink,
              letterSpacing: "0.1em",
              fontWeight: 500,
            }}
          >
            {timeLabel}
          </div>
        )}
        {storeName && !timeLabel && (
          <div style={{ fontSize: 10, color: SITE.color.textMuted }}>{storeName}</div>
        )}
        {storeName && timeLabel && (
          <div style={{ fontSize: 10, color: SITE.color.textMuted, marginTop: 4 }}>
            {storeName}
          </div>
        )}
      </div>
    </Link>
  );
}

function ViewMoreButton({ href, label }: { href: string; label: string }) {
  return (
    <div style={{ textAlign: "center", marginTop: SITE.sp.xl }}>
      <Link
        href={href}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 10,
          padding: "12px 32px",
          borderRadius: SITE.radius.pill,
          background: "transparent",
          border: `1px solid ${SITE.color.pink}66`,
          color: SITE.color.pink,
          fontFamily: SITE.font.display,
          fontSize: 12,
          letterSpacing: "0.25em",
          textDecoration: "none",
          transition: SITE.transition.base,
        }}
      >
        {label} <span>→</span>
      </Link>
    </div>
  );
}

function LoadingBlock() {
  return (
    <div
      style={{
        padding: SITE.sp.xxl,
        textAlign: "center",
        color: SITE.color.textMuted,
        fontSize: 12,
        letterSpacing: "0.1em",
      }}
    >
      Loading...
    </div>
  );
}

function EmptyBlock({
  emoji,
  title,
  sub,
  link,
}: {
  emoji: string;
  title: string;
  sub?: string;
  link?: { href: string; label: string };
}) {
  return (
    <div
      style={{
        padding: `${SITE.sp.xxl} ${SITE.sp.md}`,
        textAlign: "center",
        borderRadius: SITE.radius.lg,
        background: SITE.color.surface,
        border: `1px solid ${SITE.color.border}`,
      }}
    >
      <div style={{ fontSize: 40, marginBottom: 12 }}>{emoji}</div>
      <p
        style={{
          fontSize: 13,
          color: SITE.color.text,
          marginBottom: 6,
          letterSpacing: "0.05em",
        }}
      >
        {title}
      </p>
      {sub && (
        <p style={{ fontSize: 11, color: SITE.color.textMuted, marginBottom: 20 }}>{sub}</p>
      )}
      {link && (
        <Link
          href={link.href}
          style={{
            display: "inline-block",
            padding: "10px 24px",
            borderRadius: SITE.radius.pill,
            border: `1px solid ${SITE.color.pink}66`,
            color: SITE.color.pink,
            fontFamily: SITE.font.display,
            fontSize: 11,
            letterSpacing: "0.2em",
            textDecoration: "none",
          }}
        >
          {link.label}
        </Link>
      )}
    </div>
  );
}
