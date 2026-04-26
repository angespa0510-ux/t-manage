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

type Reservation = {
  id: number;
  therapist_id: number;
  date: string;
  start_time: string;
  end_time: string;
  status: string;
};

const todayStr = () => new Date().toISOString().split("T")[0];

// 時刻 → 分（営業時間 12:00〜27:00 を想定し、9時未満は翌日扱いで +24h）
const timeToMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return (h < 9 ? h + 24 : h) * 60 + m;
};
const minToTime = (m: number) => {
  const h = Math.floor(m / 60);
  const mi = m % 60;
  return `${String(h >= 24 ? h - 24 : h).padStart(2, "0")}:${String(mi).padStart(2, "0")}`;
};
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
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string>(todayStr());
  const [storeFilter, setStoreFilter] = useState<number | null>(null);

  // セラピスト指定モード（?therapist=ID で起動）
  const [therapistIdParam, setTherapistIdParam] = useState<number | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const tid = params.get("therapist");
    if (tid && /^\d+$/.test(tid)) setTherapistIdParam(Number(tid));
  }, []);
  const selectedTherapist = useMemo(
    () => (therapistIdParam ? therapists.find((t) => t.id === therapistIdParam) || null : null),
    [therapistIdParam, therapists]
  );

  // 日付リスト（本日〜6日後）
  const dateTabs = useMemo(() => {
    const today = todayStr();
    return Array.from({ length: 7 }, (_, i) => addDays(today, i));
  }, []);

  useEffect(() => {
    (async () => {
      const start = dateTabs[0];
      const end = dateTabs[dateTabs.length - 1];
      const [tResp, sResp, stResp, rResp] = await Promise.all([
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
        supabase
          .from("reservations")
          .select("id,therapist_id,date,start_time,end_time,status")
          .gte("date", start)
          .lte("date", end)
          .not("status", "eq", "cancelled"),
      ]);
      setTherapists(tResp.data || []);
      setShifts(sResp.data || []);
      setReservations(rResp.data || []);
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

  // セラピスト指定モード時の選択日空き時間スロット
  // 30分刻みで、シフトの中で予約と被らない時間を空きとする
  const selectedTherapistSlots = useMemo(() => {
    if (!selectedTherapist) return [];
    const shift = shifts.find(
      (s) => s.therapist_id === selectedTherapist.id && s.date === selectedDate
    );
    if (!shift) return [];
    const ss = timeToMin(shift.start_time);
    const se = timeToMin(shift.end_time);
    const ress = reservations.filter(
      (r) => r.therapist_id === selectedTherapist.id && r.date === selectedDate
    );
    // 「今より過去」は予約不可
    const isToday = selectedDate === todayStr();
    const now = new Date();
    const nowMin = isToday ? timeToMin(`${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`) : -1;

    const slots: { time: string; available: boolean; past: boolean }[] = [];
    for (let m = ss; m < se; m += 30) {
      const t = minToTime(m);
      const busy = ress.some((r) => {
        const rs = timeToMin(r.start_time);
        const re = timeToMin(r.end_time);
        // 30分先まで連続で空いているかをチェック
        return m < re && m + 30 > rs;
      });
      const past = isToday && m < nowMin;
      slots.push({ time: t, available: !busy, past });
    }
    return slots;
  }, [selectedTherapist, shifts, reservations, selectedDate]);

  // 7日分の出勤日（指定セラピスト用）
  const selectedTherapistShiftDates = useMemo(() => {
    if (!selectedTherapist) return new Set<string>();
    return new Set(
      shifts
        .filter((s) => s.therapist_id === selectedTherapist.id)
        .map((s) => s.date)
    );
  }, [selectedTherapist, shifts]);

  return (
    <>
      {selectedTherapist ? (
        // ───────────── セラピスト指定モード（HP「このセラピストで予約する」経由） ─────────────
        <section
          style={{
            padding: `${SITE.sp.xl} ${SITE.sp.lg} ${SITE.sp.lg}`,
            backgroundColor: SITE.color.bgSoft,
            borderBottom: `1px solid ${SITE.color.border}`,
          }}
        >
          <div style={{ maxWidth: SITE.layout.maxWidthText, margin: "0 auto" }}>
            <p
              style={{
                fontFamily: SITE.font.display,
                fontSize: 11,
                color: SITE.color.pink,
                letterSpacing: SITE.ls.wide,
                textAlign: "center",
                marginBottom: 8,
              }}
            >
              WEB RESERVATION
            </p>
            <p
              style={{
                fontFamily: SITE.font.serif,
                fontSize: 13,
                color: SITE.color.textSub,
                letterSpacing: SITE.ls.loose,
                textAlign: "center",
                marginBottom: SITE.sp.lg,
              }}
            >
              空き時間を選んでご予約へお進みください
            </p>
            <div
              style={{
                display: "flex",
                gap: 16,
                alignItems: "center",
                justifyContent: "center",
                padding: SITE.sp.md,
                backgroundColor: "#ffffff",
                border: `1px solid ${SITE.color.border}`,
              }}
            >
              {selectedTherapist.photo_url && (
                <img
                  src={selectedTherapist.photo_url}
                  alt={selectedTherapist.name}
                  style={{
                    width: 64,
                    height: 64,
                    objectFit: "cover",
                    borderRadius: "50%",
                    flexShrink: 0,
                  }}
                />
              )}
              <div>
                <p
                  style={{
                    fontFamily: SITE.font.display,
                    fontSize: 10,
                    color: SITE.color.textMuted,
                    letterSpacing: SITE.ls.wide,
                    marginBottom: 4,
                  }}
                >
                  THERAPIST
                </p>
                <p
                  style={{
                    fontFamily: SITE.font.serif,
                    fontSize: 18,
                    color: SITE.color.text,
                    letterSpacing: SITE.ls.loose,
                  }}
                >
                  {selectedTherapist.name}
                </p>
              </div>
            </div>
          </div>
        </section>
      ) : (
        <PageHero
          label="SCHEDULE"
          title="出勤スケジュール"
          subtitle="本日から1週間分のセラピスト出勤スケジュールをご確認いただけます。"
          bgVideo="/videos/schedule.mp4"
          bgVideoPoster="/videos/schedule-poster.jpg"
        />
      )}

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
                        ? "#c96b83"
                        : isSaturday
                        ? "#6b8ba8"
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

      {/* 店舗フィルタ（セラピスト指定モード時は非表示） */}
      {!selectedTherapist && stores.length > 1 && (
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

      {/* セラピスト指定モード時は店舗フィルタを非表示（既に1人に絞られているため） */}
      {/* 出勤セラピスト or 空き時間グリッド */}
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
          ) : selectedTherapist ? (
            // ───────── セラピスト指定モード：空き時間グリッド ─────────
            <div style={{ maxWidth: SITE.layout.maxWidthText, margin: "0 auto" }}>
              {!selectedTherapistShiftDates.has(selectedDate) ? (
                <EmptyBlock
                  title="この日は出勤予定がありません"
                  sub="別の日付をお選びください。"
                />
              ) : selectedTherapistSlots.length === 0 ? (
                <EmptyBlock
                  title="ご予約可能な時間がありません"
                  sub="別の日付をご確認ください。"
                />
              ) : (
                <>
                  <p
                    style={{
                      fontFamily: SITE.font.display,
                      fontSize: 11,
                      color: SITE.color.textSub,
                      letterSpacing: SITE.ls.wide,
                      marginBottom: SITE.sp.lg,
                      textAlign: "center",
                    }}
                  >
                    AVAILABLE TIME / 空き時間
                  </p>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))",
                      gap: 8,
                      marginBottom: SITE.sp.xl,
                    }}
                  >
                    {selectedTherapistSlots.map((slot) => {
                      const disabled = !slot.available || slot.past;
                      return (
                        <a
                          key={slot.time}
                          href={
                            disabled
                              ? undefined
                              : `/mypage?book=${selectedTherapist.id}&date=${selectedDate}&time=${slot.time}`
                          }
                          aria-disabled={disabled}
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            padding: "14px 4px",
                            backgroundColor: disabled ? SITE.color.bgSoft : "#ffffff",
                            border: `1px solid ${disabled ? SITE.color.border : SITE.color.pink}`,
                            color: disabled ? SITE.color.textMuted : SITE.color.pink,
                            cursor: disabled ? "not-allowed" : "pointer",
                            textDecoration: "none",
                            fontFamily: SITE.font.serif,
                            transition: SITE.transition.base,
                            opacity: disabled ? 0.5 : 1,
                          }}
                          onClick={(e) => {
                            if (disabled) e.preventDefault();
                          }}
                        >
                          <span style={{ fontSize: 14, fontWeight: 500, letterSpacing: SITE.ls.loose }}>
                            {slot.time}
                          </span>
                          <span style={{ fontSize: 10, marginTop: 2, letterSpacing: SITE.ls.wide }}>
                            {slot.past ? "終了" : slot.available ? "空き" : "満"}
                          </span>
                        </a>
                      );
                    })}
                  </div>
                  <div
                    style={{
                      padding: SITE.sp.md,
                      backgroundColor: "#ffffff",
                      border: `1px solid ${SITE.color.border}`,
                      textAlign: "center",
                    }}
                  >
                    <p
                      style={{
                        fontFamily: SITE.font.serif,
                        fontSize: 11,
                        color: SITE.color.textMuted,
                        letterSpacing: SITE.ls.loose,
                        lineHeight: 1.7,
                      }}
                    >
                      ご希望の時間をタップすると<br />
                      会員ページでコース・指名を選んでご予約いただけます。
                    </p>
                  </div>
                </>
              )}
            </div>
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
            {selectedTherapist ? (
              <>
                空き時間からの予約以外は<br />
                お電話またはLINEにて承っております
              </>
            ) : (
              <>
                ご予約・ご相談は<br />
                お電話またはLINEにて承っております
              </>
            )}
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
                fontFamily: '-apple-system, BlinkMacSystemFont, "Hiragino Sans", "Noto Sans JP", "Yu Gothic", sans-serif',
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
