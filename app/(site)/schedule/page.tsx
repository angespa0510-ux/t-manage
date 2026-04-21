"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "../../../lib/supabase";
import { SITE, MARBLE } from "../../../lib/site-theme";
import { PageHero, LoadingBlock, EmptyBlock } from "../../../components/site/SiteLayoutParts";
import TherapistCard from "../../../components/site/TherapistCard";

/**
 * /schedule — 出勤スケジュールページ
 *
 * 機能:
 *  - 7日分の日付タブ（本日〜6日後）
 *  - 店舗フィルタ
 *  - 選んだ日の出勤セラピストをグリッド表示
 *  - 出勤中/出勤前/本日終了 を本日のみ表示
 *  - 時間帯クリックで電話予約CTA表示
 */

type Therapist = {
  id: number;
  name: string;
  age: number;
  height_cm: number;
  cup: string;
  photo_url: string;
  status: string;
  entry_date: string;
  catchphrase?: string;
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

type Store = { id: number; name: string; shop_display_name?: string; shop_is_public?: boolean };

const todayStr = () => new Date().toISOString().split("T")[0];
const timeHM = (t: string) => (t || "").slice(0, 5);
const weekday = (d: string) => {
  const days = ["日", "月", "火", "水", "木", "金", "土"];
  return days[new Date(d + "T00:00:00").getDay()];
};
const fmtDate = (d: string) => {
  const dt = new Date(d + "T00:00:00");
  return { md: `${dt.getMonth() + 1}/${dt.getDate()}`, wd: weekday(d) };
};
const addDays = (d: string, n: number) => {
  const dt = new Date(d + "T00:00:00");
  dt.setDate(dt.getDate() + n);
  return dt.toISOString().split("T")[0];
};
const isNewcomerByDate = (entry?: string) => {
  if (!entry) return false;
  const d = new Date(entry).getTime();
  if (!d) return false;
  const diff = new Date().getTime() - d;
  return diff >= 0 && diff < 90 * 24 * 60 * 60 * 1000;
};
const getWorkStatus = (shift: Shift, isToday: boolean) => {
  if (!isToday) return null;
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

export default function SchedulePage() {
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string>(todayStr());
  const [storeFilter, setStoreFilter] = useState<number | null>(null);

  // 日付リスト（本日〜6日後）
  const dateTabs = useMemo(() => {
    const today = todayStr();
    return Array.from({ length: 7 }, (_, i) => addDays(today, i));
  }, []);

  useEffect(() => {
    (async () => {
      const start = dateTabs[0];
      const end = dateTabs[dateTabs.length - 1];
      const [tResp, sResp, stResp] = await Promise.all([
        supabase
          .from("therapists")
          .select("*")
          .eq("is_public", true)
          .eq("status", "active")
          .is("deleted_at", null)
          .order("public_sort_order", { ascending: true })
          .order("id", { ascending: false }),
        supabase
          .from("shifts")
          .select("*")
          .gte("date", start)
          .lte("date", end),
        supabase
          .from("stores")
          .select("id,name,shop_display_name,shop_is_public")
          .eq("shop_is_public", true),
      ]);
      setTherapists(tResp.data || []);
      setShifts(sResp.data || []);
      // 公開店舗がない場合は全店舗表示
      const storesData = (stResp.data && stResp.data.length > 0)
        ? stResp.data
        : (await supabase.from("stores").select("id,name,shop_display_name,shop_is_public")).data || [];
      setStores(storesData);
      setLoading(false);
    })();
  }, [dateTabs]);

  // 選択日の出勤セラピスト
  const shiftsOfDay = useMemo(
    () =>
      shifts
        .filter((s) => s.date === selectedDate)
        .filter((s) => storeFilter === null || s.store_id === storeFilter),
    [shifts, selectedDate, storeFilter]
  );

  const therapistsOfDay = useMemo(() => {
    const shiftById: Record<number, Shift> = {};
    for (const s of shiftsOfDay) shiftById[s.therapist_id] = s;
    const isToday = selectedDate === todayStr();
    return therapists
      .filter((t) => shiftById[t.id])
      .map((t) => ({
        therapist: t,
        shift: shiftById[t.id],
        status: getWorkStatus(shiftById[t.id], isToday),
      }))
      .sort((a, b) => a.shift.start_time.localeCompare(b.shift.start_time));
  }, [therapists, shiftsOfDay, selectedDate]);

  const getStoreName = (sid: number) =>
    stores.find((s) => s.id === sid)?.shop_display_name ||
    stores.find((s) => s.id === sid)?.name ||
    "";

  return (
    <>
      <PageHero
        label="SCHEDULE"
        title="出勤スケジュール"
        subtitle="本日から1週間分のセラピスト出勤スケジュールをご確認いただけます。"
        bgImage="/images/placeholder/schedule.jpg"
      />

      {/* 日付タブ */}
      <section
        style={{
          padding: `${SITE.sp.xl} 0 0`,
          position: "sticky",
          top: SITE.layout.headerHeightSp,
          zIndex: 10,
          backgroundColor: "rgba(255,255,255,0.92)",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          borderBottom: `1px solid ${SITE.color.border}`,
        }}
      >
        <div
          style={{
            maxWidth: SITE.layout.maxWidth,
            margin: "0 auto",
            overflowX: "auto",
          }}
          className="site-date-scroll"
        >
          <div
            style={{
              display: "inline-flex",
              minWidth: "100%",
              padding: `0 ${SITE.sp.lg}`,
            }}
          >
            {dateTabs.map((d) => {
              const f = fmtDate(d);
              const active = d === selectedDate;
              const isToday = d === todayStr();
              const isSunday = new Date(d + "T00:00:00").getDay() === 0;
              const isSaturday = new Date(d + "T00:00:00").getDay() === 6;
              const count = shifts.filter(
                (s) => s.date === d && (storeFilter === null || s.store_id === storeFilter)
              ).length;
              return (
                <button
                  key={d}
                  onClick={() => setSelectedDate(d)}
                  style={{
                    flex: "0 0 auto",
                    minWidth: 88,
                    padding: "18px 12px",
                    background: "transparent",
                    border: "none",
                    borderBottom: active
                      ? `2px solid ${SITE.color.pink}`
                      : "2px solid transparent",
                    color: active ? SITE.color.pink : SITE.color.text,
                    fontFamily: SITE.font.serif,
                    cursor: "pointer",
                    transition: SITE.transition.fast,
                  }}
                >
                  <div
                    style={{
                      fontSize: "10px",
                      fontFamily: SITE.font.display,
                      letterSpacing: SITE.ls.wide,
                      color: isToday
                        ? SITE.color.pink
                        : isSunday
                        ? "#c45555"
                        : isSaturday
                        ? "#4a7ca0"
                        : SITE.color.textMuted,
                      marginBottom: 4,
                      fontWeight: isToday ? 600 : 400,
                    }}
                  >
                    {isToday ? "TODAY" : f.wd.toUpperCase()}
                  </div>
                  <div
                    style={{
                      fontSize: "18px",
                      fontWeight: 500,
                      letterSpacing: SITE.ls.loose,
                    }}
                  >
                    {f.md}
                  </div>
                  <div
                    style={{
                      marginTop: 6,
                      fontSize: "10px",
                      color: active ? SITE.color.pink : SITE.color.textMuted,
                      fontFamily: SITE.font.display,
                      letterSpacing: SITE.ls.loose,
                    }}
                  >
                    {count > 0 ? `${count}名` : "—"}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* 店舗フィルタ */}
      {stores.length > 1 && (
        <section
          style={{
            padding: `${SITE.sp.lg} ${SITE.sp.lg}`,
            borderBottom: `1px solid ${SITE.color.borderSoft}`,
          }}
        >
          <div
            style={{
              maxWidth: SITE.layout.maxWidth,
              margin: "0 auto",
              display: "flex",
              gap: 6,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <span
              style={{
                fontFamily: SITE.font.serif,
                fontSize: "12px",
                color: SITE.color.textSub,
                marginRight: 8,
                letterSpacing: SITE.ls.loose,
              }}
            >
              店舗：
            </span>
            <button
              onClick={() => setStoreFilter(null)}
              style={{
                padding: "6px 16px",
                background: storeFilter === null ? SITE.color.pink : "transparent",
                border: `1px solid ${
                  storeFilter === null ? SITE.color.pink : SITE.color.border
                }`,
                color: storeFilter === null ? "#ffffff" : SITE.color.textSub,
                fontFamily: SITE.font.serif,
                fontSize: "11px",
                letterSpacing: SITE.ls.loose,
                cursor: "pointer",
              }}
            >
              全店舗
            </button>
            {stores.map((s) => (
              <button
                key={s.id}
                onClick={() => setStoreFilter(s.id)}
                style={{
                  padding: "6px 16px",
                  background: storeFilter === s.id ? SITE.color.pink : "transparent",
                  border: `1px solid ${
                    storeFilter === s.id ? SITE.color.pink : SITE.color.border
                  }`,
                  color: storeFilter === s.id ? "#ffffff" : SITE.color.textSub,
                  fontFamily: SITE.font.serif,
                  fontSize: "11px",
                  letterSpacing: SITE.ls.loose,
                  cursor: "pointer",
                }}
              >
                {s.shop_display_name || s.name}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* 出勤セラピスト */}
      <section
        style={{
          ...MARBLE.blue,
          padding: `${SITE.sp.xxl} ${SITE.sp.lg}`,
          minHeight: "60vh",
        }}
      >
        <div style={{ maxWidth: SITE.layout.maxWidth, margin: "0 auto" }}>
          {loading ? (
            <LoadingBlock />
          ) : therapistsOfDay.length === 0 ? (
            <EmptyBlock
              title="この日の出勤セラピストはまだ登録されていません"
              sub="別の日付をお選びください。"
            />
          ) : (
            <>
              <p
                style={{
                  fontFamily: SITE.font.display,
                  fontSize: "11px",
                  color: SITE.color.textSub,
                  letterSpacing: SITE.ls.wide,
                  marginBottom: SITE.sp.lg,
                  textAlign: "center",
                }}
              >
                {therapistsOfDay.length} THERAPISTS
              </p>
              <div
                className="site-schedule-grid"
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(min(160px, 100%), 1fr))",
                  gap: SITE.sp.md,
                  justifyContent: "center",
                }}
              >
                {therapistsOfDay.map(({ therapist, shift, status }) => (
                  <TherapistCard
                    key={therapist.id}
                    therapist={therapist}
                    timeLabel={`${timeHM(shift.start_time)} — ${timeHM(shift.end_time)}`}
                    storeName={getStoreName(shift.store_id)}
                    statusLabel={
                      status === "working"
                        ? "出勤中"
                        : status === "upcoming"
                        ? "出勤前"
                        : status === "finished"
                        ? "本日終了"
                        : undefined
                    }
                    newBadge={therapist.is_newcomer || isNewcomerByDate(therapist.entry_date)}
                    pickup={therapist.is_pickup}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </section>

      {/* CTA */}
      <section
        style={{
          padding: `${SITE.sp.xxl} ${SITE.sp.lg}`,
          backgroundColor: SITE.color.bgSoft,
          borderTop: `1px solid ${SITE.color.border}`,
        }}
      >
        <div
          style={{
            maxWidth: SITE.layout.maxWidthText,
            margin: "0 auto",
            textAlign: "center",
          }}
        >
          <p
            style={{
              fontFamily: SITE.font.serif,
              fontSize: "14px",
              color: SITE.color.textSub,
              marginBottom: SITE.sp.lg,
              letterSpacing: SITE.ls.loose,
              lineHeight: SITE.lh.body,
            }}
          >
            ご予約・ご相談は<br />
            お電話またはLINEにて承っております
          </p>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
              maxWidth: 320,
              margin: "0 auto",
            }}
          >
            <a
              href="tel:070-1675-5900"
              style={{
                display: "block",
                padding: "16px 24px",
                backgroundColor: SITE.color.pink,
                color: "#ffffff",
                fontFamily: SITE.font.display,
                fontSize: "14px",
                letterSpacing: SITE.ls.wide,
                textDecoration: "none",
                textAlign: "center",
              }}
              className="site-cta-primary"
            >
              電話 070-1675-5900
            </a>
            <a
              href="https://lin.ee/tJtwJL9"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "block",
                padding: "14px 24px",
                border: `1px solid ${SITE.color.pink}`,
                color: SITE.color.pink,
                fontFamily: SITE.font.serif,
                fontSize: "13px",
                letterSpacing: SITE.ls.loose,
                textDecoration: "none",
                textAlign: "center",
              }}
              className="site-cta-secondary"
            >
              LINEで予約・相談
            </a>
          </div>
          <p
            style={{
              marginTop: SITE.sp.lg,
              fontSize: "11px",
              color: SITE.color.textMuted,
              letterSpacing: SITE.ls.loose,
              lineHeight: SITE.lh.body,
            }}
          >
            営業 12:00 — 深夜 27:00 ／ 最終受付 26:00
          </p>
        </div>
      </section>

      <style>{`
        .site-date-scroll::-webkit-scrollbar { height: 0; }
        @media (min-width: 520px) {
          .site-schedule-grid { grid-template-columns: repeat(auto-fit, minmax(180px, 240px)) !important; }
        }
        @media (min-width: 768px) {
          .site-schedule-grid { grid-template-columns: repeat(auto-fit, minmax(220px, 260px)) !important; gap: ${SITE.sp.lg}; }
        }
        @media (min-width: 1024px) {
          .site-schedule-grid { grid-template-columns: repeat(auto-fit, minmax(220px, 240px)) !important; }
        }
      `}</style>
    </>
  );
}
