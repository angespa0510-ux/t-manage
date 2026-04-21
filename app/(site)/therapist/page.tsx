"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "../../../lib/supabase";
import { SITE } from "../../../lib/site-theme";
import { PageHero, LoadingBlock, EmptyBlock } from "../../../components/site/SiteLayoutParts";
import TherapistCard from "../../../components/site/TherapistCard";

/**
 * /therapist — セラピスト一覧（絞り込み機能付き）
 *
 * 絞り込み条件（現行HP同等）:
 *  - 店舗（store）
 *  - 年齢帯（〜20代前半、20代後半、30代〜）
 *  - 身長帯（〜155, 155-160, 160-165, 165〜）
 *  - カップ
 *  - 体型（body_type）
 *  - タイプタグ（tags 内 TYPE）
 *  - 髪型 / 髪色
 *  - NEW / PICK UP
 *
 * データは therapists (is_public=true) から取得。
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
  tags?: string[];
  body_type?: string;
  hair_style?: string;
  hair_color?: string;
  is_pickup?: boolean;
  is_newcomer?: boolean;
  public_sort_order?: number;
  specialty?: string;
};

type Shift = {
  therapist_id: number;
  store_id: number;
  date: string;
};

type Store = { id: number; name: string; shop_display_name?: string };

type Filters = {
  storeId: number | null;
  ageRange: string | null;      // 'teens' | 'early20s' | 'late20s' | '30plus'
  heightRange: string | null;   // 'u155' | '155-160' | '160-165' | 'o165'
  cup: string | null;
  bodyType: string | null;
  hairStyle: string | null;
  hairColor: string | null;
  typeTag: string | null;
  onlyNew: boolean;
  onlyPickup: boolean;
};

const initialFilters: Filters = {
  storeId: null,
  ageRange: null,
  heightRange: null,
  cup: null,
  bodyType: null,
  hairStyle: null,
  hairColor: null,
  typeTag: null,
  onlyNew: false,
  onlyPickup: false,
};

const AGE_RANGES = [
  { v: "teens", label: "〜19歳" },
  { v: "early20s", label: "20代前半" },
  { v: "late20s", label: "20代後半" },
  { v: "30plus", label: "30代〜" },
];
const HEIGHT_RANGES = [
  { v: "u155", label: "〜155cm" },
  { v: "155-160", label: "155〜160cm" },
  { v: "160-165", label: "160〜165cm" },
  { v: "o165", label: "165cm〜" },
];
const CUPS = ["A", "B", "C", "D", "E", "F", "G", "H"];
const BODY_TYPES = ["スリム", "標準", "グラマー", "ムチムチ"];
const HAIR_STYLES = ["ロング", "ミディアム", "ショート", "ボブ"];
const HAIR_COLORS = ["黒髪", "暗めブラウン", "ブラウン", "明るめブラウン"];
const TYPE_TAGS = ["清楚系", "お姉さん系", "キレカワ系", "ギャル系", "ロリ系", "モデル系"];

const isNewcomerByDate = (entry?: string) => {
  if (!entry) return false;
  const d = new Date(entry).getTime();
  if (!d) return false;
  const diff = new Date().getTime() - d;
  return diff >= 0 && diff < 90 * 24 * 60 * 60 * 1000;
};

const matchAgeRange = (age: number, r: string | null) => {
  if (!r || !age) return true;
  if (r === "teens") return age < 20;
  if (r === "early20s") return age >= 20 && age < 25;
  if (r === "late20s") return age >= 25 && age < 30;
  if (r === "30plus") return age >= 30;
  return true;
};
const matchHeightRange = (h: number, r: string | null) => {
  if (!r || !h) return true;
  if (r === "u155") return h < 155;
  if (r === "155-160") return h >= 155 && h < 160;
  if (r === "160-165") return h >= 160 && h < 165;
  if (r === "o165") return h >= 165;
  return true;
};

export default function TherapistListPage() {
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [therapistStores, setTherapistStores] = useState<Record<number, Set<number>>>({});
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [filterOpen, setFilterOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const [tResp, sResp, shResp] = await Promise.all([
        supabase
          .from("therapists")
          .select("*")
          .eq("is_public", true)
          .eq("status", "active")
          .is("deleted_at", null)
          .order("public_sort_order", { ascending: true })
          .order("id", { ascending: false }),
        supabase.from("stores").select("id,name,shop_display_name"),
        // 過去30日・今後30日のシフトを取得して所属店舗判定
        supabase
          .from("shifts")
          .select("therapist_id,store_id,date")
          .gte("date", new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10))
          .lte("date", new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)),
      ]);
      setTherapists(tResp.data || []);
      setStores(sResp.data || []);
      const map: Record<number, Set<number>> = {};
      (shResp.data as Shift[] | null || []).forEach((sh) => {
        if (!map[sh.therapist_id]) map[sh.therapist_id] = new Set();
        if (sh.store_id) map[sh.therapist_id].add(sh.store_id);
      });
      setTherapistStores(map);
      setLoading(false);
    })();
  }, []);

  // フィルタリング
  const filtered = useMemo(() => {
    return therapists.filter((t) => {
      if (filters.storeId !== null) {
        const stSet = therapistStores[t.id];
        if (!stSet || !stSet.has(filters.storeId)) return false;
      }
      if (!matchAgeRange(t.age, filters.ageRange)) return false;
      if (!matchHeightRange(t.height_cm, filters.heightRange)) return false;
      if (filters.cup && t.cup !== filters.cup) return false;
      if (filters.bodyType && t.body_type !== filters.bodyType) return false;
      if (filters.hairStyle && t.hair_style !== filters.hairStyle) return false;
      if (filters.hairColor && t.hair_color !== filters.hairColor) return false;
      if (filters.typeTag) {
        if (!t.tags || !t.tags.includes(filters.typeTag)) return false;
      }
      if (filters.onlyNew && !(t.is_newcomer || isNewcomerByDate(t.entry_date))) return false;
      if (filters.onlyPickup && !t.is_pickup) return false;
      return true;
    });
  }, [therapists, therapistStores, filters]);

  const activeCount = Object.values(filters).filter((v) =>
    typeof v === "boolean" ? v : v !== null
  ).length;

  return (
    <>
      <PageHero
        label="THERAPIST"
        title="セラピスト一覧"
        subtitle="在籍セラピストの一覧です。条件を絞り込んでお好みのセラピストを探せます。"
        bgVideo="/videos/therapist.mp4"
        bgVideoPoster="/videos/therapist-poster.jpg"
      />

      <section
        style={{
          padding: `${SITE.sp.xxl} ${SITE.sp.lg} ${SITE.sp.section}`,
          backgroundColor: "#fdf5f7",
          backgroundImage: "url('/patterns/marble-bg.webp')",
          backgroundSize: "600px 600px",
          backgroundRepeat: "repeat",
          backgroundAttachment: "fixed",
          marginBottom: `calc(-1 * ${SITE.sp.section})`,
          minHeight: "60vh",
        }}
      >
        <div style={{ maxWidth: SITE.layout.maxWidth, margin: "0 auto" }}>
          {/* フィルタトグル */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: SITE.sp.lg,
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            <p
              style={{
                fontFamily: SITE.font.display,
                fontSize: "12px",
                letterSpacing: SITE.ls.wide,
                color: SITE.color.textSub,
              }}
            >
              {loading ? "LOADING" : `${filtered.length} / ${therapists.length} THERAPISTS`}
            </p>
            <button
              onClick={() => setFilterOpen((v) => !v)}
              style={{
                padding: "10px 24px",
                background: filterOpen ? SITE.color.pink : "transparent",
                border: `1px solid ${SITE.color.pink}`,
                color: filterOpen ? "#ffffff" : SITE.color.pink,
                fontFamily: SITE.font.serif,
                fontSize: "12px",
                letterSpacing: SITE.ls.loose,
                cursor: "pointer",
                transition: SITE.transition.base,
              }}
            >
              絞り込み{activeCount > 0 ? `（${activeCount}）` : ""}
              <span style={{ marginLeft: 8, fontSize: "10px" }}>
                {filterOpen ? "−" : "＋"}
              </span>
            </button>
          </div>

          {/* フィルタパネル */}
          {filterOpen && (
            <div
              style={{
                marginBottom: SITE.sp.xl,
                padding: SITE.sp.lg,
                border: `1px solid ${SITE.color.border}`,
                backgroundColor: SITE.color.bgSoft,
              }}
            >
              <FilterRow label="店舗">
                <ChipGroup
                  options={stores.map((s) => ({
                    v: s.id,
                    label: s.shop_display_name || s.name,
                  }))}
                  value={filters.storeId}
                  onChange={(v) => setFilters({ ...filters, storeId: v as number | null })}
                />
              </FilterRow>
              <FilterRow label="年齢">
                <ChipGroup
                  options={AGE_RANGES.map((a) => ({ v: a.v, label: a.label }))}
                  value={filters.ageRange}
                  onChange={(v) => setFilters({ ...filters, ageRange: v as string | null })}
                />
              </FilterRow>
              <FilterRow label="身長">
                <ChipGroup
                  options={HEIGHT_RANGES.map((h) => ({ v: h.v, label: h.label }))}
                  value={filters.heightRange}
                  onChange={(v) =>
                    setFilters({ ...filters, heightRange: v as string | null })
                  }
                />
              </FilterRow>
              <FilterRow label="カップ">
                <ChipGroup
                  options={CUPS.map((c) => ({ v: c, label: c }))}
                  value={filters.cup}
                  onChange={(v) => setFilters({ ...filters, cup: v as string | null })}
                />
              </FilterRow>
              <FilterRow label="体型">
                <ChipGroup
                  options={BODY_TYPES.map((b) => ({ v: b, label: b }))}
                  value={filters.bodyType}
                  onChange={(v) => setFilters({ ...filters, bodyType: v as string | null })}
                />
              </FilterRow>
              <FilterRow label="タイプ">
                <ChipGroup
                  options={TYPE_TAGS.map((t) => ({ v: t, label: t }))}
                  value={filters.typeTag}
                  onChange={(v) => setFilters({ ...filters, typeTag: v as string | null })}
                />
              </FilterRow>
              <FilterRow label="髪型">
                <ChipGroup
                  options={HAIR_STYLES.map((h) => ({ v: h, label: h }))}
                  value={filters.hairStyle}
                  onChange={(v) =>
                    setFilters({ ...filters, hairStyle: v as string | null })
                  }
                />
              </FilterRow>
              <FilterRow label="髪色">
                <ChipGroup
                  options={HAIR_COLORS.map((h) => ({ v: h, label: h }))}
                  value={filters.hairColor}
                  onChange={(v) =>
                    setFilters({ ...filters, hairColor: v as string | null })
                  }
                />
              </FilterRow>
              <FilterRow label="その他">
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <ToggleChip
                    label="新人のみ"
                    active={filters.onlyNew}
                    onClick={() =>
                      setFilters({ ...filters, onlyNew: !filters.onlyNew })
                    }
                  />
                  <ToggleChip
                    label="注目のみ"
                    active={filters.onlyPickup}
                    onClick={() =>
                      setFilters({ ...filters, onlyPickup: !filters.onlyPickup })
                    }
                  />
                </div>
              </FilterRow>
              {activeCount > 0 && (
                <div style={{ textAlign: "center", marginTop: SITE.sp.lg }}>
                  <button
                    onClick={() => setFilters(initialFilters)}
                    style={{
                      padding: "10px 24px",
                      background: "transparent",
                      border: `1px solid ${SITE.color.border}`,
                      color: SITE.color.textSub,
                      fontFamily: SITE.font.serif,
                      fontSize: "12px",
                      letterSpacing: SITE.ls.loose,
                      cursor: "pointer",
                    }}
                  >
                    すべて解除
                  </button>
                </div>
              )}
            </div>
          )}

          {/* グリッド */}
          {loading ? (
            <LoadingBlock />
          ) : filtered.length === 0 ? (
            <EmptyBlock
              title={
                therapists.length === 0
                  ? "公開中のセラピストはまだいません"
                  : "条件に一致するセラピストが見つかりませんでした"
              }
              sub={therapists.length > 0 ? "条件を変更してお試しください。" : undefined}
            />
          ) : (
            <div
              className="site-therapist-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(min(160px, 100%), 1fr))",
                gap: SITE.sp.md,
                justifyContent: "center",
              }}
            >
              {filtered.map((t) => (
                <TherapistCard
                  key={t.id}
                  therapist={t}
                  newBadge={t.is_newcomer || isNewcomerByDate(t.entry_date)}
                  pickup={t.is_pickup}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      <style>{`
        @media (min-width: 520px) {
          .site-therapist-grid { grid-template-columns: repeat(auto-fit, minmax(180px, 240px)) !important; }
        }
        @media (min-width: 768px) {
          .site-therapist-grid { grid-template-columns: repeat(auto-fit, minmax(220px, 260px)) !important; gap: ${SITE.sp.lg}; }
        }
        @media (min-width: 1024px) {
          .site-therapist-grid { grid-template-columns: repeat(auto-fit, minmax(220px, 240px)) !important; }
        }
      `}</style>
    </>
  );
}

// ─── フィルタUI ───────────────────────────────────────
function FilterRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        padding: "12px 0",
        borderBottom: `1px solid ${SITE.color.borderSoft}`,
        display: "grid",
        gridTemplateColumns: "80px 1fr",
        gap: SITE.sp.md,
        alignItems: "center",
      }}
    >
      <p
        style={{
          fontFamily: SITE.font.serif,
          fontSize: "12px",
          color: SITE.color.textSub,
          letterSpacing: SITE.ls.loose,
          fontWeight: 500,
        }}
      >
        {label}
      </p>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{children}</div>
    </div>
  );
}

function ChipGroup<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { v: T; label: string }[];
  value: T | null;
  onChange: (v: T | null) => void;
}) {
  return (
    <>
      {options.map((o) => {
        const active = value === o.v;
        return (
          <button
            key={String(o.v)}
            onClick={() => onChange(active ? null : o.v)}
            style={{
              padding: "6px 14px",
              background: active ? SITE.color.pink : "transparent",
              border: `1px solid ${active ? SITE.color.pink : SITE.color.border}`,
              color: active ? "#ffffff" : SITE.color.textSub,
              fontFamily: SITE.font.serif,
              fontSize: "11px",
              letterSpacing: SITE.ls.loose,
              cursor: "pointer",
              transition: SITE.transition.fast,
            }}
          >
            {o.label}
          </button>
        );
      })}
    </>
  );
}

function ToggleChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "6px 14px",
        background: active ? SITE.color.pink : "transparent",
        border: `1px solid ${active ? SITE.color.pink : SITE.color.border}`,
        color: active ? "#ffffff" : SITE.color.textSub,
        fontFamily: SITE.font.serif,
        fontSize: "11px",
        letterSpacing: SITE.ls.loose,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}
