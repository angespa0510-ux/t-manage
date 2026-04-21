"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { SITE } from "../../lib/site-theme";

/**
 * ═══════════════════════════════════════════════════════════
 * Ange Spa 公式HP — HOME
 *
 * 方針（■19・■20 準拠）:
 *  - ホワイト基調、清潔感・清楚感
 *  - 絵文字・アイコン非使用
 *  - 明朝体（Noto Serif JP）統一
 *  - 余白・罫線・タイポグラフィで世界観を構築
 *  - 画像は next/image + プレースホルダーで管理
 *
 * 構成:
 *  1. メインビジュアル（プレースホルダー画像 + キャッチ）
 *  2. CONCEPT — 私たちについて
 *  3. TODAY'S SCHEDULE — 本日の出勤ダイジェスト
 *  4. PICK UP — 注目セラピスト
 *  5. NEW FACE — 新人セラピスト
 *  6. RECRUIT — 求人案内
 *  7. CONTENTS — 各ページへの導線
 *  8. MESSAGE — 店からのメッセージ
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
  const normEnd = endMin < startMin ? endMin + 24 * 60 : endMin;
  const normNow = nowMin < startMin ? nowMin + 24 * 60 : nowMin;
  if (normNow >= startMin && normNow <= normEnd) return "working";
  if (normNow < startMin) return "upcoming";
  return "finished";
};

// ─── ページ本体 ─────────────────────────────────────────────
export default function HomePage() {
  const router = useRouter();
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);

  // PWA 自動リダイレクト
  useEffect(() => {
    if (typeof window === "undefined") return;
    type IosWindow = Window & { navigator: Navigator & { standalone?: boolean } };
    const isStandalone =
      (window as IosWindow).navigator.standalone === true ||
      window.matchMedia?.("(display-mode: standalone)").matches;
    if (!isStandalone) return;
    try {
      if (localStorage.getItem("therapist_session")) {
        router.replace("/mypage");
        return;
      }
      if (localStorage.getItem("customer_mypage_id")) {
        router.replace("/customer-mypage");
        return;
      }
      if (sessionStorage.getItem("t-manage-staff")) {
        router.replace("/dashboard");
        return;
      }
    } catch {}
  }, [router]);

  // データ取得
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
      {/* image: トップメインビジュアル / 1920x1080 / ピンク基調・上品・柔らかい自然光 / alt="Ange Spa トップビジュアル" */}
      <section
        style={{
          position: "relative",
          minHeight: `calc(100vh - ${SITE.layout.headerHeightSp})`,
          marginTop: `calc(-1 * ${SITE.layout.headerHeightSp})`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          backgroundColor: SITE.color.bgSoft,
        }}
      >
        {/* 背景画像（プレースホルダー） */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 0,
          }}
        >
          <Image
            src="/images/placeholder/top-hero.jpg"
            alt="Ange Spa トップビジュアル"
            fill
            priority
            style={{
              objectFit: "cover",
              opacity: 0.9,
            }}
            sizes="100vw"
          />
          {/* 白の薄いオーバーレイ（文字の可読性確保） */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.75) 100%)",
            }}
          />
        </div>

        {/* 中央コンテンツ */}
        <div
          style={{
            position: "relative",
            zIndex: 1,
            textAlign: "center",
            padding: "120px 24px 80px",
            maxWidth: 720,
            animation: "siteFadeUp 1.2s cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        >
          {/* 装飾細線 */}
          <div
            style={{
              width: 1,
              height: 48,
              backgroundColor: SITE.color.pink,
              margin: "0 auto 40px",
            }}
          />

          {/* ブランドロゴ */}
          <h1
            style={{
              fontFamily: SITE.font.display,
              fontSize: "clamp(44px, 10vw, 84px)",
              fontWeight: 500,
              letterSpacing: SITE.ls.loose,
              color: SITE.color.pink,
              lineHeight: 1,
              marginBottom: 16,
            }}
          >
            Ange Spa
          </h1>
          <p
            style={{
              fontFamily: SITE.font.serif,
              fontSize: "clamp(12px, 2vw, 15px)",
              letterSpacing: "0.5em",
              color: SITE.color.textSub,
              marginBottom: 56,
              paddingLeft: "0.5em",
              fontWeight: 400,
            }}
          >
            アンジュスパ
          </p>

          {/* キャッチコピー */}
          <p
            style={{
              fontFamily: SITE.font.serif,
              fontSize: SITE.fs.hero,
              lineHeight: SITE.lh.loose,
              color: SITE.color.text,
              letterSpacing: SITE.ls.loose,
              marginBottom: 48,
              fontWeight: 500,
            }}
          >
            可愛らしい女の子と<br />
            癒しのひと時を、、
          </p>

          {/* エリア */}
          <p
            style={{
              fontFamily: SITE.font.display,
              fontSize: "11px",
              letterSpacing: SITE.ls.wider,
              color: SITE.color.textMuted,
              marginBottom: 48,
            }}
          >
            NAGOYA &nbsp;/&nbsp; MIKAWA-ANJO &nbsp;/&nbsp; TOYOHASHI
          </p>

          {/* CTA */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
              alignItems: "stretch",
              maxWidth: 320,
              margin: "0 auto",
            }}
          >
            <Link
              href="/schedule"
              style={{
                display: "block",
                padding: "18px 24px",
                backgroundColor: SITE.color.pink,
                color: "#ffffff",
                fontFamily: SITE.font.serif,
                fontSize: "14px",
                fontWeight: 500,
                letterSpacing: SITE.ls.wide,
                textDecoration: "none",
                textAlign: "center",
                transition: SITE.transition.base,
              }}
              className="site-cta-primary"
            >
              WEB予約をする
            </Link>
            <a
              href="tel:070-1675-5900"
              style={{
                display: "block",
                padding: "16px 24px",
                backgroundColor: "transparent",
                border: `1px solid ${SITE.color.pink}`,
                color: SITE.color.pink,
                fontFamily: SITE.font.display,
                fontSize: "14px",
                letterSpacing: SITE.ls.loose,
                textDecoration: "none",
                textAlign: "center",
                transition: SITE.transition.base,
              }}
              className="site-cta-secondary"
            >
              電話 070-1675-5900
            </a>
          </div>

          {/* 営業時間 */}
          <p
            style={{
              marginTop: 48,
              fontSize: "11px",
              letterSpacing: SITE.ls.loose,
              color: SITE.color.textMuted,
              lineHeight: SITE.lh.body,
            }}
          >
            営業 12:00 — 深夜 27:00 ／ 最終受付 26:00
          </p>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════
          ② CONCEPT
          ═══════════════════════════════════════════════ */}
      <SectionBlock label="CONCEPT" title="私たちについて">
        <div
          style={{
            textAlign: "center",
            maxWidth: SITE.layout.maxWidthText,
            margin: "0 auto",
          }}
        >
          <p
            style={{
              fontFamily: SITE.font.serif,
              fontSize: SITE.fs.lead,
              lineHeight: SITE.lh.loose,
              color: SITE.color.text,
              letterSpacing: SITE.ls.loose,
              marginBottom: 40,
              fontWeight: 400,
            }}
          >
            清楚で可憐な彼女たちは<br />
            ビジュアル面でも目を引きますが<br />
            それ以上に最高のマナーを兼ね備え<br />
            <span style={{ color: SITE.color.pink }}>安らぎと癒し</span>を運びます
          </p>
          <p
            style={{
              fontFamily: SITE.font.display,
              fontSize: "11px",
              letterSpacing: SITE.ls.wide,
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
          ③ TODAY'S SCHEDULE
          ═══════════════════════════════════════════════ */}
      <section
        style={{
          padding: `${SITE.sp.section} ${SITE.sp.lg}`,
          backgroundColor: SITE.color.bgSoft,
        }}
      >
        <div style={{ maxWidth: SITE.layout.maxWidth, margin: "0 auto" }}>
          <SectionHeading
            label="TODAY'S SCHEDULE"
            title="本日の出勤セラピスト"
            badge={loading ? undefined : `${workingToday.length}名`}
          />
          {loading ? (
            <LoadingBlock />
          ) : workingToday.length === 0 ? (
            <EmptyBlock
              title="本日出勤予定のセラピストはまだ公開されていません"
              sub="明日以降のスケジュールも順次公開されます"
              link={{ href: "/schedule", label: "スケジュールを見る" }}
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
                        shift
                          ? `${timeHM(shift.start_time)} — ${timeHM(shift.end_time)}`
                          : ""
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
                      storeName={shift ? getStoreName(shift.store_id) : ""}
                    />
                  );
                })}
              </TherapistGrid>
              <ViewMoreButton href="/schedule" label="スケジュールをすべて見る" />
            </>
          )}
        </div>
      </section>

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
        <section
          style={{
            padding: `${SITE.sp.section} ${SITE.sp.lg}`,
            backgroundColor: SITE.color.bgSoft,
          }}
        >
          <div style={{ maxWidth: SITE.layout.maxWidth, margin: "0 auto" }}>
            <SectionHeading label="NEW FACE" title="新人セラピスト" />
            <TherapistGrid>
              {newcomers.map((t) => (
                <TherapistCard key={t.id} therapist={t} newBadge />
              ))}
            </TherapistGrid>
            <ViewMoreButton href="/therapist" label="セラピスト一覧を見る" />
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════════════
          ⑥ RECRUIT
          ═══════════════════════════════════════════════ */}
      <SectionBlock label="RECRUIT" title="セラピストさん大募集">
        <div
          style={{
            maxWidth: SITE.layout.maxWidthNarrow,
            margin: "0 auto",
            display: "grid",
            gridTemplateColumns: "1fr",
            gap: 0,
            border: `1px solid ${SITE.color.border}`,
          }}
          className="site-recruit-grid"
        >
          {/* image: 求人バナー / 1200x800 / ピンク基調・明るく前向き / alt="Ange Spa 求人バナー" */}
          <div
            style={{
              position: "relative",
              aspectRatio: "16 / 10",
              backgroundColor: SITE.color.surfaceAlt,
            }}
          >
            <Image
              src="/images/placeholder/recruit.jpg"
              alt="Ange Spa 求人案内"
              fill
              style={{ objectFit: "cover" }}
              sizes="(min-width: 768px) 50vw, 100vw"
            />
          </div>
          <div
            style={{
              padding: `${SITE.sp.xl} ${SITE.sp.lg}`,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              backgroundColor: SITE.color.surface,
            }}
          >
            <p
              style={{
                fontFamily: SITE.font.display,
                fontSize: "11px",
                letterSpacing: SITE.ls.wide,
                color: SITE.color.pink,
                marginBottom: 16,
              }}
            >
              JOIN US
            </p>
            <h3
              style={{
                fontFamily: SITE.font.serif,
                fontSize: SITE.fs.h3,
                lineHeight: SITE.lh.heading,
                letterSpacing: SITE.ls.loose,
                marginBottom: 20,
                fontWeight: 500,
              }}
            >
              一緒に働いてくれる<br />
              仲間を募集しています
            </h3>
            <p
              style={{
                fontSize: "13px",
                lineHeight: SITE.lh.body,
                color: SITE.color.textSub,
                letterSpacing: SITE.ls.normal,
                marginBottom: 28,
              }}
            >
              未経験の方も大歓迎。<br />
              スタッフが丁寧にサポートいたします。
            </p>
            <Link
              href="/recruit"
              style={{
                alignSelf: "flex-start",
                padding: "12px 32px",
                backgroundColor: SITE.color.pink,
                color: "#ffffff",
                fontFamily: SITE.font.serif,
                fontSize: "13px",
                letterSpacing: SITE.ls.loose,
                textDecoration: "none",
                transition: SITE.transition.base,
              }}
              className="site-cta-primary"
            >
              求人情報を見る
            </Link>
          </div>
        </div>
      </SectionBlock>

      {/* ═══════════════════════════════════════════════
          ⑦ CONTENTS
          ═══════════════════════════════════════════════ */}
      <section
        style={{
          padding: `${SITE.sp.section} ${SITE.sp.lg}`,
          backgroundColor: SITE.color.bgSoft,
        }}
      >
        <div style={{ maxWidth: SITE.layout.maxWidth, margin: "0 auto" }}>
          <SectionHeading label="CONTENTS" title="サービス案内" />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: SITE.sp.md,
            }}
          >
            {[
              { en: "SYSTEM",  jp: "料金・コース",       href: "/system" },
              { en: "ACCESS",  jp: "店舗・アクセス",     href: "/access" },
              { en: "RESERVE", jp: "WEB予約",           href: "/schedule" },
              { en: "CONTACT", jp: "お問い合わせ",       href: "/contact" },
            ].map((c) => (
              <Link
                key={c.href}
                href={c.href}
                className="site-content-card"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 12,
                  padding: `${SITE.sp.xl} ${SITE.sp.lg}`,
                  backgroundColor: SITE.color.surface,
                  border: `1px solid ${SITE.color.border}`,
                  color: SITE.color.text,
                  textDecoration: "none",
                  textAlign: "center",
                  transition: SITE.transition.base,
                }}
              >
                <span
                  style={{
                    fontFamily: SITE.font.display,
                    fontSize: "20px",
                    fontWeight: 500,
                    letterSpacing: SITE.ls.wide,
                    color: SITE.color.pink,
                  }}
                >
                  {c.en}
                </span>
                <span
                  style={{
                    width: 24,
                    height: 1,
                    backgroundColor: SITE.color.border,
                  }}
                />
                <span
                  style={{
                    fontSize: "13px",
                    fontFamily: SITE.font.serif,
                    color: SITE.color.textSub,
                    letterSpacing: SITE.ls.loose,
                  }}
                >
                  {c.jp}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════
          ⑧ MESSAGE
          ═══════════════════════════════════════════════ */}
      <section style={{ padding: `${SITE.sp.section} ${SITE.sp.lg}` }}>
        <div
          style={{
            maxWidth: SITE.layout.maxWidthText,
            margin: "0 auto",
            textAlign: "center",
          }}
        >
          <p
            style={{
              fontFamily: SITE.font.display,
              fontSize: "11px",
              letterSpacing: SITE.ls.wide,
              color: SITE.color.pink,
              marginBottom: 16,
            }}
          >
            MESSAGE
          </p>
          <h2
            style={{
              fontFamily: SITE.font.serif,
              fontSize: SITE.fs.h3,
              letterSpacing: SITE.ls.loose,
              marginBottom: 32,
              fontWeight: 500,
            }}
          >
            当店から皆様へ
          </h2>
          <div
            style={{
              width: SITE.accent.underlineW,
              height: SITE.accent.underlineH,
              backgroundColor: SITE.color.pink,
              margin: `0 auto ${SITE.sp.xl}`,
            }}
          />
          <p
            style={{
              fontFamily: SITE.font.serif,
              fontSize: SITE.fs.bodyLg,
              lineHeight: SITE.lh.loose,
              color: SITE.color.textSub,
              letterSpacing: SITE.ls.loose,
            }}
          >
            Ange Spa ではマッサージ技術だけでなく<br />
            接客指導にも力を入れております。<br />
            皆様の日頃の疲れを癒やすお手伝いが<br />
            出来ましたら幸いです。
          </p>
        </div>
      </section>

      {/* ─── アニメーション・ホバー ─── */}
      <style>{`
        @keyframes siteFadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .site-cta-primary:hover {
          background-color: ${SITE.color.pinkDeep} !important;
        }
        .site-cta-secondary:hover {
          background-color: ${SITE.color.pinkSoft} !important;
        }
        .site-content-card:hover {
          border-color: ${SITE.color.pink} !important;
        }
        .site-therapist-card:hover .site-therapist-img-wrap {
          opacity: 0.85;
        }
        @media (min-width: 768px) {
          .site-recruit-grid {
            grid-template-columns: 1fr 1fr !important;
          }
        }
      `}</style>
    </>
  );
}

// ═══════════════════════════════════════════════════════════
// サブコンポーネント
// ═══════════════════════════════════════════════════════════

function SectionBlock({
  label,
  title,
  children,
}: {
  label: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{ padding: `${SITE.sp.section} ${SITE.sp.lg}` }}>
      <div style={{ maxWidth: SITE.layout.maxWidth, margin: "0 auto" }}>
        <SectionHeading label={label} title={title} />
        {children}
      </div>
    </section>
  );
}

function SectionHeading({
  label,
  title,
  badge,
}: {
  label: string;
  title: string;
  badge?: string;
}) {
  return (
    <div style={{ textAlign: "center", marginBottom: SITE.sp.xl }}>
      <p
        style={{
          fontFamily: SITE.font.display,
          fontSize: "11px",
          letterSpacing: SITE.ls.wide,
          color: SITE.color.pink,
          marginBottom: 12,
          fontWeight: 500,
        }}
      >
        {label}
      </p>
      <h2
        style={{
          fontFamily: SITE.font.serif,
          fontSize: SITE.fs.h2,
          color: SITE.color.text,
          letterSpacing: SITE.ls.loose,
          fontWeight: 500,
          marginBottom: 16,
          display: "inline-flex",
          alignItems: "center",
          gap: 16,
          flexWrap: "wrap",
          justifyContent: "center",
        }}
      >
        {title}
        {badge && (
          <span
            style={{
              fontFamily: SITE.font.display,
              fontSize: "12px",
              letterSpacing: SITE.ls.loose,
              color: SITE.color.pink,
              padding: "3px 14px",
              border: `1px solid ${SITE.color.borderPink}`,
              fontWeight: 400,
            }}
          >
            {badge}
          </span>
        )}
      </h2>
      <div
        style={{
          width: SITE.accent.underlineW,
          height: SITE.accent.underlineH,
          backgroundColor: SITE.color.pink,
          margin: "0 auto",
        }}
      />
    </div>
  );
}

function TherapistGrid({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="site-therapist-grid"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
        gap: SITE.sp.md,
      }}
    >
      {children}
      <style>{`
        @media (min-width: 520px) {
          .site-therapist-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
        }
        @media (min-width: 768px) {
          .site-therapist-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); gap: ${SITE.sp.lg}; }
        }
      `}</style>
    </div>
  );
}

function TherapistCard({
  therapist,
  timeLabel,
  statusLabel,
  storeName,
  pickup,
  newBadge,
}: {
  therapist: Therapist;
  timeLabel?: string;
  statusLabel?: string;
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
        backgroundColor: SITE.color.surface,
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
            padding: "6px 10px",
            fontFamily: SITE.font.serif,
            fontSize: "10px",
            letterSpacing: SITE.ls.loose,
            backgroundColor: SITE.color.pink,
            color: "#ffffff",
            textAlign: "center",
            lineHeight: 1.4,
            fontWeight: 400,
          }}
        >
          {t.catchphrase}
        </div>
      )}

      {/* 写真 */}
      <div
        className="site-therapist-img-wrap"
        style={{
          width: "100%",
          aspectRatio: "3 / 4",
          position: "relative",
          backgroundColor: SITE.color.surfaceAlt,
          transition: SITE.transition.base,
        }}
      >
        {t.photo_url ? (
          // セラピスト写真は外部URL（Supabase Storage）なので next/image ではなく <img> を使用
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={t.photo_url}
            alt={t.name}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
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
              color: SITE.color.textFaint,
              fontFamily: SITE.font.display,
              fontSize: "11px",
              letterSpacing: SITE.ls.wide,
            }}
          >
            NO IMAGE
          </div>
        )}

        {/* バッジ（左下） */}
        {(newBadge || pickup || statusLabel) && (
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
                  padding: "3px 10px",
                  backgroundColor: SITE.color.pink,
                  color: "#ffffff",
                  fontFamily: SITE.font.display,
                  fontSize: "10px",
                  letterSpacing: SITE.ls.wide,
                  fontWeight: 500,
                }}
              >
                NEW
              </span>
            )}
            {pickup && (
              <span
                style={{
                  padding: "3px 10px",
                  backgroundColor: "rgba(43,43,43,0.85)",
                  color: "#ffffff",
                  fontFamily: SITE.font.display,
                  fontSize: "10px",
                  letterSpacing: SITE.ls.wide,
                  fontWeight: 500,
                }}
              >
                PICK UP
              </span>
            )}
            {statusLabel && (
              <span
                style={{
                  padding: "3px 10px",
                  backgroundColor: "rgba(255,255,255,0.92)",
                  color: SITE.color.text,
                  fontFamily: SITE.font.serif,
                  fontSize: "10px",
                  letterSpacing: SITE.ls.loose,
                  fontWeight: 500,
                  border: `1px solid ${SITE.color.border}`,
                }}
              >
                {statusLabel}
              </span>
            )}
          </div>
        )}
      </div>

      {/* 情報 */}
      <div style={{ padding: "14px 4px 20px" }}>
        <div
          style={{
            fontFamily: SITE.font.serif,
            fontSize: "15px",
            fontWeight: 500,
            color: SITE.color.text,
            marginBottom: 6,
            letterSpacing: SITE.ls.loose,
          }}
        >
          {t.name}
        </div>
        <div
          style={{
            fontFamily: SITE.font.display,
            fontSize: "11px",
            color: SITE.color.textMuted,
            letterSpacing: SITE.ls.loose,
            marginBottom: timeLabel || storeName ? 8 : 0,
          }}
        >
          {[
            t.age ? `${t.age}歳` : null,
            t.height_cm ? `${t.height_cm}cm` : null,
            t.cup ? `${t.cup}cup` : null,
          ]
            .filter(Boolean)
            .join(" ／ ")}
        </div>
        {timeLabel && (
          <div
            style={{
              fontFamily: SITE.font.display,
              fontSize: "12px",
              color: SITE.color.pink,
              letterSpacing: SITE.ls.loose,
              fontWeight: 500,
            }}
          >
            {timeLabel}
          </div>
        )}
        {storeName && (
          <div
            style={{
              fontSize: "10px",
              color: SITE.color.textMuted,
              marginTop: 4,
              letterSpacing: SITE.ls.loose,
            }}
          >
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
          display: "inline-block",
          padding: "14px 40px",
          background: "transparent",
          border: `1px solid ${SITE.color.pink}`,
          color: SITE.color.pink,
          fontFamily: SITE.font.serif,
          fontSize: "13px",
          letterSpacing: SITE.ls.wide,
          textDecoration: "none",
          transition: SITE.transition.base,
        }}
        className="site-cta-secondary"
      >
        {label}
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
        fontFamily: SITE.font.display,
        fontSize: "11px",
        letterSpacing: SITE.ls.wide,
      }}
    >
      LOADING
    </div>
  );
}

function EmptyBlock({
  title,
  sub,
  link,
}: {
  title: string;
  sub?: string;
  link?: { href: string; label: string };
}) {
  return (
    <div
      style={{
        padding: `${SITE.sp.xxl} ${SITE.sp.lg}`,
        textAlign: "center",
        backgroundColor: SITE.color.surface,
        border: `1px solid ${SITE.color.border}`,
      }}
    >
      <p
        style={{
          fontFamily: SITE.font.serif,
          fontSize: "14px",
          color: SITE.color.text,
          marginBottom: sub ? 8 : 20,
          letterSpacing: SITE.ls.loose,
        }}
      >
        {title}
      </p>
      {sub && (
        <p
          style={{
            fontSize: "12px",
            color: SITE.color.textMuted,
            marginBottom: 24,
            letterSpacing: SITE.ls.normal,
          }}
        >
          {sub}
        </p>
      )}
      {link && (
        <Link
          href={link.href}
          style={{
            display: "inline-block",
            padding: "12px 32px",
            border: `1px solid ${SITE.color.pink}`,
            color: SITE.color.pink,
            fontFamily: SITE.font.serif,
            fontSize: "12px",
            letterSpacing: SITE.ls.wide,
            textDecoration: "none",
            transition: SITE.transition.base,
          }}
          className="site-cta-secondary"
        >
          {link.label}
        </Link>
      )}
    </div>
  );
}
