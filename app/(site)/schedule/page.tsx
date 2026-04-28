"use client";

import { useState, useEffect, useMemo, type CSSProperties } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";
import { SITE, MARBLE } from "../../../lib/site-theme";
import { PageHero, LoadingBlock, EmptyBlock } from "../../../components/site/SiteLayoutParts";
import TherapistCard from "../../../components/site/TherapistCard";

/**
 * /schedule — 出勤スケジュールページ
 *
 * 構成:
 *  - 0. ヘッダ（PageHero）
 *  - 1. ビュー切替タブ「日付で見る／セラピスト別に見る」
 *  - 2. 日付タブ（本日〜6日後）/ 店舗フィルタ
 *  - 3. カード横スクロール（その日の出勤メンバー、ビューAのみ）
 *  - 4. マトリクス（時間×セラピスト、15分刻み、ビューA）
 *     or ウィークリー（セラピスト×7日、ビューB）
 *  - 5. CTA（電話 / LINE）
 *
 * セル状態:
 *  - 出勤外（—）
 *  - 過去（×）
 *  - 予約済み（塗り）
 *  - 空き（○）
 *  - 90分連続空きの始点（●）
 *
 * セラピスト指定モード（?therapist=ID）:
 *  - その人の選択日空き枠グリッドのみ表示（旧仕様継続）
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

type ViewMode = "matrix" | "weekly";
type WorkStatus = "working" | "upcoming" | "finished" | null;

// ─── 表示設定 ─────────────────────────────────────
const SLOT_MIN = 15;            // スロット刻み（分）
const RANGE_START = 11 * 60 + 30;   // 11:30 = 690 分
const RANGE_END   = 26 * 60 + 30;   // 26:30 = 1590 分
const COURSE_MIN = 90;          // ●判定: 90分連続空き
const COURSE_SLOTS = COURSE_MIN / SLOT_MIN; // = 6

// ─── ユーティリティ ─────────────────────────────
const todayStr = () => new Date().toISOString().split("T")[0];

// 時刻 → 分（営業時間 11:30〜深夜26:30 を想定し、9時未満は翌日扱いで +24h）
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
const getWorkStatus = (shift: Shift, isToday: boolean): WorkStatus => {
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

// ─── スロット計算（共通） ──────────────────────
type SlotState = "off" | "past" | "busy" | "avail";
type Slot = {
  startMin: number;       // 分（営業日内、24:00超もある）
  state: SlotState;
  isCourseStart: boolean; // ● 90分連続空き始点
};

/**
 * 1セラピスト × 1日 のスロット配列を返す。
 * 11:30〜26:30 を 15分刻み = 60コマ。
 */
function buildSlots(
  therapistId: number,
  date: string,
  shifts: Shift[],
  reservations: Reservation[],
  isToday: boolean,
  nowMin: number
): Slot[] {
  const shift = shifts.find((s) => s.therapist_id === therapistId && s.date === date);
  const slots: Slot[] = [];

  // 出勤情報
  let shiftStart = -1;
  let shiftEnd = -1;
  if (shift) {
    shiftStart = timeToMin(shift.start_time);
    shiftEnd = timeToMin(shift.end_time);
  }

  // 予約情報
  const ress = shift
    ? reservations.filter((r) => r.therapist_id === therapistId && r.date === date)
    : [];

  // 1段階目: state を決める
  for (let m = RANGE_START; m < RANGE_END; m += SLOT_MIN) {
    let state: SlotState;
    if (!shift || m < shiftStart || m >= shiftEnd) {
      state = "off";
    } else if (isToday && m < nowMin) {
      state = "past";
    } else {
      const busy = ress.some((r) => {
        const rs = timeToMin(r.start_time);
        const re = timeToMin(r.end_time);
        return m < re && m + SLOT_MIN > rs;
      });
      state = busy ? "busy" : "avail";
    }
    slots.push({ startMin: m, state, isCourseStart: false });
  }

  // 2段階目: ● 90分連続空き始点判定
  for (let i = 0; i < slots.length; i++) {
    if (slots[i].state !== "avail") continue;
    let ok = true;
    for (let k = 0; k < COURSE_SLOTS; k++) {
      const j = i + k;
      if (j >= slots.length || slots[j].state !== "avail") {
        ok = false;
        break;
      }
    }
    if (ok) slots[i].isCourseStart = true;
  }

  return slots;
}

// ─── ページコンポーネント ─────────────────────────
export default function SchedulePage() {
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string>(todayStr());
  const [storeFilter, setStoreFilter] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("matrix");

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
      const storesData = (stResp.data && stResp.data.length > 0)
        ? stResp.data
        : (await supabase.from("stores").select("id,name,shop_display_name,shop_is_public")).data || [];
      setStores(storesData);
      setLoading(false);
    })();
  }, [dateTabs]);

  // 現在分（マトリクスの "past" 判定用）
  const nowMin = useMemo(() => {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  // 選択日の出勤セラピスト（カード横スクロール用 + マトリクス列）
  const therapistsOfDay = useMemo(() => {
    const isToday = selectedDate === todayStr();
    const shiftsOfDay = shifts
      .filter((s) => s.date === selectedDate)
      .filter((s) => storeFilter === null || s.store_id === storeFilter);
    const shiftById: Record<number, Shift> = {};
    for (const s of shiftsOfDay) shiftById[s.therapist_id] = s;
    return therapists
      .filter((t) => shiftById[t.id])
      .map((t) => ({
        therapist: t,
        shift: shiftById[t.id],
        status: getWorkStatus(shiftById[t.id], isToday),
      }))
      .sort((a, b) => a.shift.start_time.localeCompare(b.shift.start_time));
  }, [therapists, shifts, selectedDate, storeFilter]);

  // マトリクス用 全セラピスト × 全スロット
  const matrixSlotsByTherapist = useMemo(() => {
    const isToday = selectedDate === todayStr();
    const map: Record<number, Slot[]> = {};
    for (const { therapist } of therapistsOfDay) {
      map[therapist.id] = buildSlots(
        therapist.id,
        selectedDate,
        shifts,
        reservations,
        isToday,
        nowMin
      );
    }
    return map;
  }, [therapistsOfDay, selectedDate, shifts, reservations, nowMin]);

  // ウィークリー用 セラピスト × 日付 のシフトマップ
  const weeklyMap = useMemo(() => {
    const m: Record<number, Record<string, Shift>> = {};
    for (const s of shifts) {
      if (storeFilter !== null && s.store_id !== storeFilter) continue;
      if (!m[s.therapist_id]) m[s.therapist_id] = {};
      m[s.therapist_id][s.date] = s;
    }
    return m;
  }, [shifts, storeFilter]);

  // ウィークリーで表示するセラピスト = 期間中に1日以上出勤するセラピスト（早出順）
  const weeklyTherapists = useMemo(() => {
    const list = therapists.filter((t) => {
      const sm = weeklyMap[t.id];
      return sm && Object.keys(sm).length > 0;
    });
    return list.sort((a, b) => {
      const sa = weeklyMap[a.id];
      const sb = weeklyMap[b.id];
      const ea = Math.min(...Object.values(sa || {}).map((s) => timeToMin(s.start_time)));
      const eb = Math.min(...Object.values(sb || {}).map((s) => timeToMin(s.start_time)));
      return ea - eb;
    });
  }, [therapists, weeklyMap]);

  // セラピスト指定モード時の選択日空き時間スロット（旧仕様継続）
  const selectedTherapistSlots = useMemo(() => {
    if (!selectedTherapist) return [];
    const isToday = selectedDate === todayStr();
    return buildSlots(
      selectedTherapist.id,
      selectedDate,
      shifts,
      reservations,
      isToday,
      nowMin
    ).filter((s) => s.state !== "off");
  }, [selectedTherapist, shifts, reservations, selectedDate, nowMin]);

  // 7日分の出勤日（指定セラピスト用）
  const selectedTherapistShiftDates = useMemo(() => {
    if (!selectedTherapist) return new Set<string>();
    return new Set(
      shifts
        .filter((s) => s.therapist_id === selectedTherapist.id)
        .map((s) => s.date)
    );
  }, [selectedTherapist, shifts]);

  const getStoreName = (sid: number) =>
    stores.find((s) => s.id === sid)?.shop_display_name ||
    stores.find((s) => s.id === sid)?.name ||
    "";

  // ウィークリーセルクリック → マトリクスへ切替 + その日付に
  const onWeeklyCellClick = (date: string) => {
    setSelectedDate(date);
    setViewMode("matrix");
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 200, behavior: "smooth" });
    }
  };

  // 全スロット行（マトリクス表示用、時間軸）
  const allSlotMins = useMemo(() => {
    const out: number[] = [];
    for (let m = RANGE_START; m < RANGE_END; m += SLOT_MIN) out.push(m);
    return out;
  }, []);

  return (
    <>
      {selectedTherapist ? (
        <SingleTherapistHero therapist={selectedTherapist} />
      ) : (
        <PageHero
          label="SCHEDULE"
          title="出勤スケジュール"
          subtitle="本日から1週間分のセラピスト出勤スケジュールをご確認いただけます。"
          bgVideo="/videos/schedule.mp4"
          bgVideoPoster="/videos/schedule-poster.jpg"
        />
      )}

      {/* ─── ビュー切替タブ（指定モード時は非表示） ─── */}
      {!selectedTherapist && (
        <section
          style={{
            padding: `${SITE.sp.lg} ${SITE.sp.lg} 0`,
            backgroundColor: SITE.color.surface,
          }}
        >
          <div style={{ maxWidth: SITE.layout.maxWidth, margin: "0 auto" }}>
            <div
              style={{
                display: "flex",
                border: `1px solid ${SITE.color.borderPink}`,
                backgroundColor: SITE.color.surface,
              }}
            >
              <button
                onClick={() => setViewMode("matrix")}
                style={{
                  flex: 1,
                  padding: "14px 8px",
                  border: "none",
                  background: viewMode === "matrix" ? SITE.color.pinkDeep : "transparent",
                  color: viewMode === "matrix" ? "#ffffff" : SITE.color.textSub,
                  fontFamily: SITE.font.serif,
                  fontSize: 13,
                  letterSpacing: SITE.ls.loose,
                  cursor: "pointer",
                  transition: SITE.transition.base,
                }}
              >
                日付で見る
              </button>
              <button
                onClick={() => setViewMode("weekly")}
                style={{
                  flex: 1,
                  padding: "14px 8px",
                  border: "none",
                  background: viewMode === "weekly" ? SITE.color.pinkDeep : "transparent",
                  color: viewMode === "weekly" ? "#ffffff" : SITE.color.textSub,
                  fontFamily: SITE.font.serif,
                  fontSize: 13,
                  letterSpacing: SITE.ls.loose,
                  cursor: "pointer",
                  transition: SITE.transition.base,
                }}
              >
                セラピスト別に見る
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ─── 日付タブ（マトリクスビュー or 指定モード時のみ） ─── */}
      {(viewMode === "matrix" || selectedTherapist) && (
        <section
          style={{
            padding: `${SITE.sp.lg} 0 0`,
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
                const hasShift = selectedTherapist ? selectedTherapistShiftDates.has(d) : true;
                return (
                  <button
                    key={d}
                    onClick={() => setSelectedDate(d)}
                    style={{
                      flex: "0 0 auto",
                      minWidth: 80,
                      padding: "12px 16px 14px",
                      border: "none",
                      borderBottom: active
                        ? `2px solid ${SITE.color.pinkDeep}`
                        : "2px solid transparent",
                      background: "transparent",
                      cursor: "pointer",
                      fontFamily: SITE.font.serif,
                      transition: SITE.transition.base,
                      opacity: !selectedTherapist || hasShift ? 1 : 0.4,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 16,
                        color: active
                          ? SITE.color.pinkDeep
                          : isSunday
                          ? "#d85a30"
                          : isSaturday
                          ? "#3784c0"
                          : SITE.color.text,
                        letterSpacing: SITE.ls.normal,
                        marginBottom: 2,
                      }}
                    >
                      {f.md}
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        color: active
                          ? SITE.color.pinkDeep
                          : isSunday
                          ? "#d85a30"
                          : isSaturday
                          ? "#3784c0"
                          : SITE.color.textMuted,
                        letterSpacing: SITE.ls.wide,
                      }}
                    >
                      {isToday ? "本日" : `(${f.wd})`}
                    </div>
                    {!selectedTherapist && (
                      <div
                        style={{
                          fontSize: 10,
                          color: SITE.color.textMuted,
                          marginTop: 4,
                          letterSpacing: SITE.ls.normal,
                        }}
                      >
                        {count}人
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ─── 店舗フィルタ（一覧モードのみ） ─── */}
      {!selectedTherapist && stores.length > 1 && (
        <section
          style={{
            padding: `${SITE.sp.md} ${SITE.sp.lg}`,
            backgroundColor: SITE.color.bgSoft,
            borderBottom: `1px solid ${SITE.color.border}`,
          }}
        >
          <div
            style={{
              maxWidth: SITE.layout.maxWidth,
              margin: "0 auto",
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
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
                border: `1px solid ${storeFilter === null ? SITE.color.pink : SITE.color.border}`,
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
                  border: `1px solid ${storeFilter === s.id ? SITE.color.pink : SITE.color.border}`,
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

      {/* ─── メインコンテンツ ─── */}
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
            <SingleTherapistSlots
              therapist={selectedTherapist}
              selectedDate={selectedDate}
              hasShift={selectedTherapistShiftDates.has(selectedDate)}
              slots={selectedTherapistSlots}
            />
          ) : viewMode === "matrix" ? (
            therapistsOfDay.length === 0 ? (
              <EmptyBlock
                title="この日の出勤セラピストはまだ登録されていません"
                sub="別の日付をお選びください。"
              />
            ) : (
              <>
                {/* カード横スクロール（その日の出勤メンバー） */}
                <TherapistCardsScroll
                  items={therapistsOfDay}
                  getStoreName={getStoreName}
                />
                {/* マトリクス */}
                <ScheduleMatrix
                  therapistsOfDay={therapistsOfDay}
                  matrixSlotsByTherapist={matrixSlotsByTherapist}
                  selectedDate={selectedDate}
                  allSlotMins={allSlotMins}
                />
              </>
            )
          ) : (
            // ─── ウィークリー ───
            weeklyTherapists.length === 0 ? (
              <EmptyBlock
                title="出勤予定のあるセラピストがいません"
                sub="少しお待ちいただくか、お電話・LINEでご相談ください。"
              />
            ) : (
              <ScheduleWeekly
                therapists={weeklyTherapists}
                weeklyMap={weeklyMap}
                dateTabs={dateTabs}
                onCellClick={onWeeklyCellClick}
              />
            )
          )}
        </div>
      </section>

      {/* ─── CTA ─── */}
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
            ○マークから直接ご予約いただけます。<br />
            その他のご相談はお電話・LINEにて承っております。
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
        .site-card-scroll::-webkit-scrollbar { height: 6px; }
        .site-card-scroll::-webkit-scrollbar-thumb { background: ${SITE.color.borderPink}; border-radius: 3px; }
        .site-matrix-scroll::-webkit-scrollbar { height: 8px; width: 8px; }
        .site-matrix-scroll::-webkit-scrollbar-thumb { background: ${SITE.color.borderPink}; border-radius: 4px; }
        .site-matrix-scroll::-webkit-scrollbar-track { background: transparent; }

        /* マトリクス: ホバー */
        .site-cell-avail:hover { background-color: ${SITE.color.pinkSoft} !important; }
        .site-cell-course:hover { background-color: ${SITE.color.pink} !important; color: #ffffff !important; }

        /* ウィークリー: ホバー */
        .site-weekly-cell-shift:hover { background-color: ${SITE.color.pinkSoft} !important; }
      `}</style>
    </>
  );
}

// ═══════════════════════════════════════════════════════════
// サブコンポーネント
// ═══════════════════════════════════════════════════════════

// ─── セラピスト指定モード ヒーロー ─────────────────────
function SingleTherapistHero({ therapist }: { therapist: Therapist }) {
  return (
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
          {therapist.photo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={therapist.photo_url}
              alt={therapist.name}
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
              {therapist.name}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── セラピスト指定モード スロットグリッド ─────────
function SingleTherapistSlots({
  therapist,
  selectedDate,
  hasShift,
  slots,
}: {
  therapist: Therapist;
  selectedDate: string;
  hasShift: boolean;
  slots: Slot[];
}) {
  if (!hasShift) {
    return <EmptyBlock title="この日は出勤予定がありません" sub="別の日付をお選びください。" />;
  }
  if (slots.length === 0) {
    return <EmptyBlock title="ご予約可能な時間がありません" sub="別の日付をご確認ください。" />;
  }
  return (
    <div style={{ maxWidth: SITE.layout.maxWidthText, margin: "0 auto" }}>
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
          gridTemplateColumns: "repeat(auto-fill, minmax(72px, 1fr))",
          gap: 6,
          marginBottom: SITE.sp.xl,
        }}
      >
        {slots.map((slot) => {
          const time = minToTime(slot.startMin);
          const disabled = slot.state === "past" || slot.state === "busy";
          const label =
            slot.state === "past"
              ? "終了"
              : slot.state === "busy"
              ? "満"
              : slot.isCourseStart
              ? "○ 90分OK"
              : "○";
          return (
            <a
              key={slot.startMin}
              href={
                disabled
                  ? undefined
                  : `/mypage?book=${therapist.id}&date=${selectedDate}&time=${time}`
              }
              aria-disabled={disabled}
              onClick={(e) => {
                if (disabled) e.preventDefault();
              }}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "12px 4px",
                backgroundColor: disabled
                  ? SITE.color.bgSoft
                  : slot.isCourseStart
                  ? SITE.color.pinkSoft
                  : "#ffffff",
                border: `1px solid ${disabled ? SITE.color.border : SITE.color.pink}`,
                color: disabled ? SITE.color.textMuted : SITE.color.pinkDeep,
                cursor: disabled ? "not-allowed" : "pointer",
                textDecoration: "none",
                fontFamily: SITE.font.serif,
                transition: SITE.transition.base,
                opacity: disabled ? 0.5 : 1,
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 500, letterSpacing: SITE.ls.loose }}>
                {time}
              </span>
              <span style={{ fontSize: 10, marginTop: 2, letterSpacing: SITE.ls.wide }}>
                {label}
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
    </div>
  );
}

// ─── カード横スクロール ─────────────────────────────
function TherapistCardsScroll({
  items,
  getStoreName,
}: {
  items: { therapist: Therapist; shift: Shift; status: WorkStatus }[];
  getStoreName: (sid: number) => string;
}) {
  return (
    <div style={{ marginBottom: SITE.sp.xl }}>
      <p
        style={{
          fontFamily: SITE.font.display,
          fontSize: "11px",
          color: SITE.color.textSub,
          letterSpacing: SITE.ls.wide,
          marginBottom: SITE.sp.md,
          textAlign: "center",
        }}
      >
        {items.length} THERAPISTS
      </p>
      <div
        className="site-card-scroll"
        style={{
          overflowX: "auto",
          paddingBottom: 8,
          margin: `0 -${SITE.sp.lg}`,
          padding: `0 ${SITE.sp.lg} 8px`,
        }}
      >
        <div
          style={{
            display: "inline-flex",
            gap: SITE.sp.md,
          }}
        >
          {items.map(({ therapist, shift, status }) => (
            <div
              key={therapist.id}
              style={{ flex: "0 0 auto", width: 168 }}
            >
              <TherapistCard
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
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── マトリクス（時間×セラピスト） ───────────────
function ScheduleMatrix({
  therapistsOfDay,
  matrixSlotsByTherapist,
  selectedDate,
  allSlotMins,
}: {
  therapistsOfDay: { therapist: Therapist; shift: Shift; status: WorkStatus }[];
  matrixSlotsByTherapist: Record<number, Slot[]>;
  selectedDate: string;
  allSlotMins: number[];
}) {
  const TIME_COL_W = 56;
  const COL_W = 72;
  const ROW_H = 22;

  return (
    <div style={{ marginBottom: SITE.sp.xl }}>
      <div
        className="site-matrix-scroll"
        style={{
          overflowX: "auto",
          backgroundColor: "#ffffff",
          border: `1px solid ${SITE.color.border}`,
        }}
      >
        <table
          style={{
            borderCollapse: "collapse",
            fontSize: 11,
            minWidth: TIME_COL_W + therapistsOfDay.length * COL_W,
          }}
        >
          <thead>
            <tr>
              <th
                style={{
                  position: "sticky",
                  left: 0,
                  zIndex: 3,
                  backgroundColor: "#ffffff",
                  width: TIME_COL_W,
                  minWidth: TIME_COL_W,
                  borderBottom: `1px solid ${SITE.color.borderPink}`,
                  borderRight: `1px solid ${SITE.color.borderPink}`,
                }}
              />
              {therapistsOfDay.map(({ therapist, shift, status }) => (
                <th
                  key={therapist.id}
                  style={{
                    width: COL_W,
                    minWidth: COL_W,
                    padding: "10px 4px 8px",
                    backgroundColor: "#ffffff",
                    borderBottom: `1px solid ${SITE.color.borderPink}`,
                    borderLeft: `1px solid ${SITE.color.borderSoft}`,
                    verticalAlign: "top",
                  }}
                >
                  <Link
                    href={`/therapist/${therapist.id}`}
                    style={{ textDecoration: "none", color: "inherit" }}
                  >
                    <div
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: "50%",
                        margin: "0 auto 4px",
                        backgroundColor: SITE.color.surfaceAlt,
                        backgroundImage: therapist.photo_url
                          ? `url(${therapist.photo_url})`
                          : "none",
                        backgroundSize: "cover",
                        backgroundPosition: "center top",
                        border: `1px solid ${SITE.color.borderPink}`,
                      }}
                    />
                    <div
                      style={{
                        fontFamily: SITE.font.serif,
                        fontSize: 12,
                        color: SITE.color.text,
                        lineHeight: 1.3,
                        letterSpacing: SITE.ls.normal,
                        textAlign: "center",
                      }}
                    >
                      {therapist.name}
                    </div>
                    <div
                      style={{
                        fontSize: 9,
                        color: SITE.color.textMuted,
                        marginTop: 2,
                        letterSpacing: SITE.ls.normal,
                        fontFamily: SITE.font.serif,
                        textAlign: "center",
                      }}
                    >
                      {timeHM(shift.start_time)}〜{timeHM(shift.end_time)}
                    </div>
                    {status === "working" && (
                      <div
                        style={{
                          display: "inline-block",
                          marginTop: 4,
                          padding: "1px 6px",
                          backgroundColor: SITE.color.pinkDeep,
                          color: "#ffffff",
                          fontSize: 9,
                          letterSpacing: SITE.ls.loose,
                          fontFamily: SITE.font.serif,
                        }}
                      >
                        出勤中
                      </div>
                    )}
                  </Link>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {allSlotMins.map((m) => {
              const isHour = m % 60 === 0;
              const isHalf = m % 30 === 0 && !isHour;
              const time = minToTime(m);
              return (
                <tr key={m}>
                  <td
                    style={{
                      position: "sticky",
                      left: 0,
                      zIndex: 2,
                      backgroundColor: isHour
                        ? SITE.color.surfaceAlt
                        : isHalf
                        ? "#fbf6f3"
                        : "#ffffff",
                      width: TIME_COL_W,
                      minWidth: TIME_COL_W,
                      height: ROW_H,
                      padding: "0 6px",
                      textAlign: "right",
                      fontFamily: SITE.font.serif,
                      fontSize: isHour ? 11 : 9,
                      color: isHour ? SITE.color.textSub : SITE.color.textFaint,
                      borderRight: `1px solid ${SITE.color.borderPink}`,
                      borderBottom: `1px solid ${
                        isHour ? SITE.color.borderPink : SITE.color.borderSoft
                      }`,
                      letterSpacing: SITE.ls.normal,
                    }}
                  >
                    {isHour || isHalf ? time : ""}
                  </td>
                  {therapistsOfDay.map(({ therapist }) => {
                    const slots = matrixSlotsByTherapist[therapist.id] || [];
                    const slot = slots.find((s) => s.startMin === m);
                    return (
                      <MatrixCell
                        key={therapist.id}
                        slot={slot}
                        therapistId={therapist.id}
                        date={selectedDate}
                        isHour={isHour}
                        time={time}
                        height={ROW_H}
                      />
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 凡例 */}
      <div
        style={{
          marginTop: SITE.sp.md,
          display: "flex",
          flexWrap: "wrap",
          gap: 16,
          fontSize: 11,
          color: SITE.color.textSub,
          fontFamily: SITE.font.serif,
          letterSpacing: SITE.ls.normal,
          alignItems: "center",
        }}
      >
        <LegendChip label="● 90分OKの空き" bg={SITE.color.pinkSoft} mark="●" markColor={SITE.color.pinkDeep} />
        <LegendChip label="○ 空き" bg="#ffffff" mark="○" markColor={SITE.color.pinkDeep} />
        <LegendChip label="予約済み" bg={SITE.color.borderSoft} mark="" />
        <LegendChip label="— 出勤外" bg={SITE.color.bgSoft} mark="—" markColor={SITE.color.textFaint} />
      </div>
    </div>
  );
}

function LegendChip({
  label,
  bg,
  mark,
  markColor,
}: {
  label: string;
  bg: string;
  mark: string;
  markColor?: string;
}) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 20,
          height: 20,
          backgroundColor: bg,
          border: `1px solid ${SITE.color.border}`,
          color: markColor || "transparent",
          fontSize: 11,
          fontFamily: SITE.font.serif,
        }}
      >
        {mark}
      </span>
      {label}
    </span>
  );
}

// ─── マトリクス1セル ───────────────────────────────
function MatrixCell({
  slot,
  therapistId,
  date,
  isHour,
  time,
  height,
}: {
  slot?: Slot;
  therapistId: number;
  date: string;
  isHour: boolean;
  time: string;
  height: number;
}) {
  const baseTd: CSSProperties = {
    height,
    padding: 0,
    textAlign: "center",
    borderLeft: `1px solid ${SITE.color.borderSoft}`,
    borderBottom: `1px solid ${isHour ? SITE.color.borderPink : SITE.color.borderSoft}`,
    fontSize: 11,
    fontFamily: SITE.font.serif,
    letterSpacing: SITE.ls.normal,
  };

  if (!slot || slot.state === "off") {
    return (
      <td
        style={{
          ...baseTd,
          backgroundColor: SITE.color.bgSoft,
          color: SITE.color.textFaint,
          fontSize: 9,
        }}
      >
        —
      </td>
    );
  }
  if (slot.state === "past") {
    return (
      <td
        style={{
          ...baseTd,
          backgroundColor: "#f5f0ed",
          color: SITE.color.textFaint,
          fontSize: 9,
        }}
      >
        ×
      </td>
    );
  }
  if (slot.state === "busy") {
    return (
      <td
        style={{
          ...baseTd,
          backgroundColor: SITE.color.borderSoft,
          color: "transparent",
        }}
      />
    );
  }
  // available
  const isCourse = slot.isCourseStart;
  return (
    <td style={baseTd}>
      <Link
        href={`/mypage?book=${therapistId}&date=${date}&time=${time}`}
        className={isCourse ? "site-cell-course" : "site-cell-avail"}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          height: "100%",
          backgroundColor: isCourse ? SITE.color.pinkSoft : "#ffffff",
          color: SITE.color.pinkDeep,
          textDecoration: "none",
          transition: SITE.transition.fast,
          fontWeight: isCourse ? 500 : 400,
        }}
      >
        {isCourse ? "●" : "○"}
      </Link>
    </td>
  );
}

// ─── ウィークリー（セラピスト×7日） ─────────────
function ScheduleWeekly({
  therapists,
  weeklyMap,
  dateTabs,
  onCellClick,
}: {
  therapists: Therapist[];
  weeklyMap: Record<number, Record<string, Shift>>;
  dateTabs: string[];
  onCellClick: (date: string) => void;
}) {
  return (
    <div
      className="site-matrix-scroll"
      style={{
        overflowX: "auto",
        backgroundColor: "#ffffff",
        border: `1px solid ${SITE.color.border}`,
      }}
    >
      <table
        style={{
          borderCollapse: "collapse",
          fontSize: 11,
          width: "100%",
          minWidth: 720,
          fontFamily: SITE.font.serif,
        }}
      >
        <thead>
          <tr>
            <th
              style={{
                position: "sticky",
                left: 0,
                zIndex: 3,
                backgroundColor: SITE.color.surfaceAlt,
                width: 110,
                minWidth: 110,
                padding: "10px 8px",
                borderBottom: `1px solid ${SITE.color.borderPink}`,
                borderRight: `1px solid ${SITE.color.borderPink}`,
                textAlign: "left",
                fontSize: 11,
                color: SITE.color.textSub,
                letterSpacing: SITE.ls.loose,
                fontWeight: 400,
              }}
            >
              セラピスト
            </th>
            {dateTabs.map((d) => {
              const f = fmtDate(d);
              const isSunday = new Date(d + "T00:00:00").getDay() === 0;
              const isSaturday = new Date(d + "T00:00:00").getDay() === 6;
              const isToday = d === todayStr();
              return (
                <th
                  key={d}
                  style={{
                    minWidth: 96,
                    padding: "10px 4px",
                    backgroundColor: SITE.color.surfaceAlt,
                    borderBottom: `1px solid ${SITE.color.borderPink}`,
                    borderLeft: `1px solid ${SITE.color.borderSoft}`,
                    textAlign: "center",
                    fontSize: 11,
                    color: isSunday ? "#d85a30" : isSaturday ? "#3784c0" : SITE.color.textSub,
                    letterSpacing: SITE.ls.normal,
                    fontWeight: 400,
                  }}
                >
                  <div style={{ fontSize: 13 }}>{f.md}</div>
                  <div style={{ fontSize: 10, marginTop: 2 }}>
                    {isToday ? "本日" : `(${f.wd})`}
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {therapists.map((t) => (
            <tr key={t.id}>
              <th
                style={{
                  position: "sticky",
                  left: 0,
                  zIndex: 2,
                  backgroundColor: "#ffffff",
                  padding: "8px",
                  borderBottom: `1px solid ${SITE.color.borderSoft}`,
                  borderRight: `1px solid ${SITE.color.borderPink}`,
                  textAlign: "left",
                  fontWeight: 400,
                }}
              >
                <Link
                  href={`/therapist/${t.id}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    textDecoration: "none",
                    color: "inherit",
                  }}
                >
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: "50%",
                      backgroundColor: SITE.color.surfaceAlt,
                      backgroundImage: t.photo_url ? `url(${t.photo_url})` : "none",
                      backgroundSize: "cover",
                      backgroundPosition: "center top",
                      border: `1px solid ${SITE.color.borderPink}`,
                      flexShrink: 0,
                    }}
                  />
                  <div
                    style={{
                      fontSize: 12,
                      color: SITE.color.text,
                      lineHeight: 1.3,
                      letterSpacing: SITE.ls.normal,
                    }}
                  >
                    {t.name}
                  </div>
                </Link>
              </th>
              {dateTabs.map((d) => {
                const sh = weeklyMap[t.id]?.[d];
                if (!sh) {
                  return (
                    <td
                      key={d}
                      style={{
                        padding: "12px 4px",
                        textAlign: "center",
                        borderBottom: `1px solid ${SITE.color.borderSoft}`,
                        borderLeft: `1px solid ${SITE.color.borderSoft}`,
                        color: SITE.color.textFaint,
                        fontSize: 11,
                      }}
                    >
                      —
                    </td>
                  );
                }
                return (
                  <td
                    key={d}
                    onClick={() => onCellClick(d)}
                    className="site-weekly-cell-shift"
                    style={{
                      padding: "10px 4px",
                      textAlign: "center",
                      borderBottom: `1px solid ${SITE.color.borderSoft}`,
                      borderLeft: `1px solid ${SITE.color.borderSoft}`,
                      color: SITE.color.pinkDeep,
                      fontSize: 11,
                      cursor: "pointer",
                      transition: SITE.transition.fast,
                      lineHeight: 1.5,
                    }}
                  >
                    <div style={{ fontFamily: SITE.font.serif, letterSpacing: SITE.ls.normal }}>
                      {timeHM(sh.start_time)}
                    </div>
                    <div style={{ fontSize: 9, color: SITE.color.textMuted }}>〜</div>
                    <div style={{ fontFamily: SITE.font.serif, letterSpacing: SITE.ls.normal }}>
                      {timeHM(sh.end_time)}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
