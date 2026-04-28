"use client";

/**
 * 研修受講率レポート (管理者向け)
 *
 * セラピスト全体の研修進捗を一覧化し、業務委託契約書 第10条 (研修受講義務)
 * の運用管理を支援するダッシュボード。
 *
 * 関連:
 *   docs/22_CONTRACT_REDESIGN.md  第10条 研修受講義務
 *   docs/24_THERAPIST_TRAINING.md  Phase 2 研修受講率レポート
 *   sql/session91_therapist_training.sql
 *   sql/session94_intermediate_curriculum.sql
 *   sql/session95_advanced_curriculum.sql
 *
 * 機能:
 *   1. 全体KPI: 必須5全修了者数 / 平均完了モジュール / 全体進捗率
 *   2. セラピスト × カテゴリ マトリクス
 *   3. カテゴリ別統計
 *   4. 要フォローアップ: 在籍2ヶ月以上で必須5未完了
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "../../lib/supabase";
import { useTheme } from "../../lib/theme";
import { NavMenu } from "../../lib/nav-menu";
import { useStaffSession } from "../../lib/staff-session";
import { generateCategoryCertificate, generateMasterCertificate } from "../../lib/training-certificate-pdf";

type Therapist = {
  id: number;
  name: string;
  real_name: string | null;
  status: string;
  entry_date: string | null;
  deleted_at: string | null;
};

type StoreInfo = {
  company_name?: string;
  representative_name?: string;
};

type TrainingCategory = {
  id: number;
  name: string;
  slug: string;
  level: string;
  emoji: string | null;
  is_required: boolean;
  sort_order: number;
};

type TrainingModule = {
  id: number;
  category_id: number;
  title: string;
  duration_minutes: number;
  is_required: boolean;
  sort_order: number;
};

type TrainingRecord = {
  id: number;
  therapist_id: number;
  module_id: number;
  status: string; // 'not_started' | 'in_progress' | 'completed'
  started_at: string | null;
  completed_at: string | null;
  updated_at: string;
};

type SkillBadge = {
  id: number;
  therapist_id: number;
  category_id: number;
  level: string;
  acquired_at: string;
};

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  active:      { label: "在籍中",  color: "#4a7c59", bg: "#4a7c5918" },
  休止:        { label: "休止",    color: "#888", bg: "#88888818" },
  退職:        { label: "退職",    color: "#c45555", bg: "#c4555518" },
};

export default function TrainingReportPage() {
  const { dark, toggle, T } = useTheme();
  const { activeStaff } = useStaffSession();

  const [loading, setLoading] = useState(true);
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [categories, setCategories] = useState<TrainingCategory[]>([]);
  const [modules, setModules] = useState<TrainingModule[]>([]);
  const [records, setRecords] = useState<TrainingRecord[]>([]);
  const [badges, setBadges] = useState<SkillBadge[]>([]);
  const [storeInfo, setStoreInfo] = useState<StoreInfo>({});

  // フィルタ
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"active" | "all">("active");
  const [filterLevel, setFilterLevel] = useState<"basic" | "intermediate" | "advanced" | "all">("all");

  const fetchData = useCallback(async () => {
    setLoading(true);

    const [tRes, cRes, mRes, rRes, bRes, sRes] = await Promise.all([
      supabase.from("therapists").select("id,name,real_name,status,entry_date,deleted_at").is("deleted_at", null),
      supabase.from("training_categories").select("id,name,slug,level,emoji,is_required,sort_order").order("sort_order"),
      supabase.from("training_modules").select("id,category_id,title,duration_minutes,is_required,sort_order"),
      supabase.from("therapist_training_records").select("id,therapist_id,module_id,status,started_at,completed_at,updated_at"),
      supabase.from("therapist_skill_badges").select("id,therapist_id,category_id,level,acquired_at"),
      supabase.from("stores").select("company_name,representative_name").limit(1).maybeSingle(),
    ]);

    setTherapists((tRes.data as Therapist[]) || []);
    setCategories((cRes.data as TrainingCategory[]) || []);
    setModules((mRes.data as TrainingModule[]) || []);
    setRecords((rRes.data as TrainingRecord[]) || []);
    setBadges((bRes.data as SkillBadge[]) || []);
    if (sRes.data) setStoreInfo(sRes.data as StoreInfo);

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /* ─────────────────────────────────────────────────────────────
   * 修了証発行ハンドラ
   * ───────────────────────────────────────────────────────────── */
  const companyForCert = useMemo(() => ({
    company_name: storeInfo.company_name || "合同会社テラスライフ",
    brand_name: storeInfo.company_name?.includes("テラスライフ") ? "Ange Spa" : undefined,
    representative: storeInfo.representative_name || "",
  }), [storeInfo]);

  // カテゴリ別修了証
  const issueCategoryCert = useCallback((therapist: Therapist, categoryId: number) => {
    const cat = categories.find(c => c.id === categoryId);
    if (!cat) return;
    const badge = badges.find(b => b.therapist_id === therapist.id && b.category_id === categoryId);
    if (!badge) {
      alert("バッジが取得されていないため、修了証を発行できません。");
      return;
    }
    const catModules = modules
      .filter(m => m.category_id === categoryId)
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    const moduleInfos = catModules.map(m => {
      const rec = records.find(r => r.therapist_id === therapist.id && r.module_id === m.id);
      return {
        id: m.id,
        title: m.title,
        duration_minutes: m.duration_minutes,
        completed_at: rec?.completed_at || badge.acquired_at,
      };
    });
    generateCategoryCertificate({
      company: companyForCert,
      therapist: {
        id: therapist.id,
        real_name: therapist.real_name || therapist.name,
      },
      category: {
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
        emoji: cat.emoji || undefined,
        level: cat.level || "basic",
      },
      badge: {
        id: badge.id,
        acquired_at: badge.acquired_at,
        level: badge.level || "basic",
      },
      modules: moduleInfos,
    });
  }, [categories, badges, modules, records, companyForCert]);

  // 必須5総合修了証
  const issueMasterCert = useCallback((therapist: Therapist) => {
    const basicCats = categories.filter(c => c.level === "basic");
    const basicBadges = badges.filter(b => {
      if (b.therapist_id !== therapist.id) return false;
      const cat = categories.find(c => c.id === b.category_id);
      return cat?.level === "basic";
    });
    if (basicCats.length === 0 || basicBadges.length < basicCats.length) {
      alert("必須5カリキュラムを全修了していないため、総合修了証を発行できません。");
      return;
    }
    const allBasicModules = modules.filter(m => {
      const cat = categories.find(c => c.id === m.category_id);
      return cat?.level === "basic";
    });
    const masterMinutes = allBasicModules.reduce((s, m) => s + (m.duration_minutes || 0), 0);
    const sortedDates = basicBadges.map(b => b.acquired_at).sort();

    generateMasterCertificate({
      company: companyForCert,
      therapist: {
        id: therapist.id,
        real_name: therapist.real_name || therapist.name,
      },
      basicCategories: basicCats.map(c => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        emoji: c.emoji || undefined,
        level: c.level || "basic",
      })),
      basicBadges: basicBadges.map(b => ({
        id: b.id,
        acquired_at: b.acquired_at,
        level: b.level || "basic",
        category_id: b.category_id,
      } as unknown as { id: number; acquired_at: string; level: string })),
      totalModules: allBasicModules.length,
      totalHours: parseFloat((masterMinutes / 60).toFixed(1)),
      earliestDate: sortedDates[0] || "",
      latestDate: sortedDates[sortedDates.length - 1] || "",
    });
  }, [categories, badges, modules, companyForCert]);

  /* ─────────────────────────────────────────────────────────────
   * 集計ロジック
   * ───────────────────────────────────────────────────────────── */

  // フィルタ後のセラピスト
  const filteredTherapists = useMemo(() => {
    let list = therapists;
    if (filterStatus === "active") {
      list = list.filter(t => t.status === "active");
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(t =>
        t.name?.toLowerCase().includes(q) ||
        t.real_name?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [therapists, filterStatus, searchQuery]);

  // フィルタ後のカテゴリ
  const filteredCategories = useMemo(() => {
    if (filterLevel === "all") return categories;
    return categories.filter(c => c.level === filterLevel);
  }, [categories, filterLevel]);

  // 全カテゴリ別モジュール数マップ
  const moduleCountByCategory = useMemo(() => {
    const map = new Map<number, number>();
    for (const m of modules) {
      map.set(m.category_id, (map.get(m.category_id) || 0) + 1);
    }
    return map;
  }, [modules]);

  // セラピストごとのカテゴリ進捗 (completed module 数)
  const completedCountByTherapistCategory = useMemo(() => {
    const map = new Map<string, number>(); // key: `${therapist_id}:${category_id}`
    for (const r of records) {
      if (r.status !== "completed") continue;
      const m = modules.find(mm => mm.id === r.module_id);
      if (!m) continue;
      const key = `${r.therapist_id}:${m.category_id}`;
      map.set(key, (map.get(key) || 0) + 1);
    }
    return map;
  }, [records, modules]);

  // セラピストごとのバッジ取得カテゴリセット
  const badgesByTherapist = useMemo(() => {
    const map = new Map<number, Set<number>>();
    for (const b of badges) {
      if (!map.has(b.therapist_id)) map.set(b.therapist_id, new Set());
      map.get(b.therapist_id)!.add(b.category_id);
    }
    return map;
  }, [badges]);

  // 必須5全修了の判定
  const basicCategoryIds = useMemo(() =>
    new Set(categories.filter(c => c.level === "basic").map(c => c.id)),
    [categories]
  );

  const isMasterEligible = useCallback((therapistId: number) => {
    if (basicCategoryIds.size === 0) return false;
    const got = badgesByTherapist.get(therapistId) || new Set();
    for (const id of basicCategoryIds) {
      if (!got.has(id)) return false;
    }
    return true;
  }, [basicCategoryIds, badgesByTherapist]);

  // 全体KPI
  const overallKpi = useMemo(() => {
    const activeT = therapists.filter(t => t.status === "active");
    const masterCount = activeT.filter(t => isMasterEligible(t.id)).length;
    const totalModules = modules.length;
    const totalRequiredModules = modules.filter(m => {
      const cat = categories.find(c => c.id === m.category_id);
      return cat?.level === "basic";
    }).length;

    const completedByT = new Map<number, number>();
    for (const r of records) {
      if (r.status !== "completed") continue;
      completedByT.set(r.therapist_id, (completedByT.get(r.therapist_id) || 0) + 1);
    }
    const totalCompleted = activeT.reduce((s, t) => s + (completedByT.get(t.id) || 0), 0);
    const avgCompleted = activeT.length > 0 ? (totalCompleted / activeT.length) : 0;
    const overallProgress = activeT.length > 0 && totalRequiredModules > 0
      ? Math.round((activeT.reduce((s, t) => {
          let cnt = 0;
          for (const r of records) {
            if (r.therapist_id !== t.id || r.status !== "completed") continue;
            const m = modules.find(mm => mm.id === r.module_id);
            const cat = m ? categories.find(c => c.id === m.category_id) : null;
            if (cat?.level === "basic") cnt++;
          }
          return s + Math.min(cnt, totalRequiredModules);
        }, 0) / (activeT.length * totalRequiredModules)) * 100)
      : 0;

    return {
      activeCount: activeT.length,
      masterCount,
      masterRate: activeT.length > 0 ? Math.round((masterCount / activeT.length) * 100) : 0,
      avgCompleted: avgCompleted.toFixed(1),
      totalModules,
      overallProgress,
    };
  }, [therapists, modules, records, categories, isMasterEligible]);

  // カテゴリ別統計
  const categoryStats = useMemo(() => {
    const activeT = therapists.filter(t => t.status === "active");
    return categories.map(cat => {
      const totalModules = moduleCountByCategory.get(cat.id) || 0;
      let badgeCount = 0;
      let totalCompleted = 0;
      for (const t of activeT) {
        if (badgesByTherapist.get(t.id)?.has(cat.id)) badgeCount++;
        const completed = completedCountByTherapistCategory.get(`${t.id}:${cat.id}`) || 0;
        totalCompleted += completed;
      }
      const totalPossible = activeT.length * totalModules;
      const progressRate = totalPossible > 0 ? Math.round((totalCompleted / totalPossible) * 100) : 0;
      const badgeRate = activeT.length > 0 ? Math.round((badgeCount / activeT.length) * 100) : 0;
      return {
        category: cat,
        totalModules,
        badgeCount,
        progressRate,
        badgeRate,
      };
    });
  }, [categories, moduleCountByCategory, badgesByTherapist, completedCountByTherapistCategory, therapists]);

  // 要フォローアップ (在籍2ヶ月以上で必須5未完了)
  const followUpList = useMemo(() => {
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - 2);
    return therapists.filter(t => {
      if (t.status !== "active") return false;
      if (isMasterEligible(t.id)) return false;
      if (!t.entry_date) return false;
      return new Date(t.entry_date) <= cutoff;
    }).map(t => {
      const got = badgesByTherapist.get(t.id) || new Set();
      const basicGot = Array.from(got).filter(id => basicCategoryIds.has(id)).length;
      const totalBasic = basicCategoryIds.size;
      return {
        therapist: t,
        basicGot,
        totalBasic,
        daysSinceEntry: t.entry_date
          ? Math.floor((Date.now() - new Date(t.entry_date).getTime()) / (1000 * 60 * 60 * 24))
          : 0,
      };
    }).sort((a, b) => b.daysSinceEntry - a.daysSinceEntry);
  }, [therapists, isMasterEligible, badgesByTherapist, basicCategoryIds]);

  /* ─────────────────────────────────────────────────────────────
   * UIレンダリング
   * ───────────────────────────────────────────────────────────── */

  if (!activeStaff) {
    return (
      <div className="h-screen flex items-center justify-center" style={{ backgroundColor: T.bg, color: T.text }}>
        <p className="text-[14px]">スタッフログインが必要です</p>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col" style={{ backgroundColor: T.bg, color: T.text }}>
      {/* Header */}
      <div className="h-[64px] backdrop-blur-xl border-b flex items-center justify-between px-6 flex-shrink-0" style={{ backgroundColor: dark ? T.card + "cc" : "rgba(255,255,255,0.8)", borderColor: T.border }}>
        <div className="flex items-center gap-4">
          <NavMenu T={T} dark={dark} />
          <div>
            <h1 className="text-[15px] font-medium">📊 研修受講率レポート</h1>
            <p className="text-[11px]" style={{ color: T.textMuted }}>業務委託契約書 第10条 運用管理</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={toggle} className="px-3 py-1.5 text-[10px] rounded-lg cursor-pointer border" style={{ borderColor: T.border, color: T.textSub }}>{dark ? "☀️ ライト" : "🌙 ダーク"}</button>
          <button onClick={fetchData} className="px-4 py-2 text-[11px] rounded-xl cursor-pointer font-medium" style={{ backgroundColor: T.accent + "18", color: T.accent, border: `1px solid ${T.accent}44` }}>🔄 更新</button>
        </div>
      </div>

      {/* スクロール領域 */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <p className="text-[12px]" style={{ color: T.textMuted }}>読み込み中...</p>
            </div>
          ) : (
            <>
              {/* 全体KPI */}
              <section>
                <h2 className="text-[12px] font-medium mb-3" style={{ color: T.textSub, letterSpacing: "0.05em" }}>📈 全体サマリー</h2>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {[
                    { label: "在籍セラピスト", value: String(overallKpi.activeCount), unit: "名", color: "#3b82f6" },
                    { label: "必須5全修了", value: String(overallKpi.masterCount), unit: `名 (${overallKpi.masterRate}%)`, color: "#4a7c59", highlight: overallKpi.masterRate < 50 },
                    { label: "平均完了モジュール", value: overallKpi.avgCompleted, unit: "本/人", color: "#8b6cb7" },
                    { label: "全モジュール数", value: String(overallKpi.totalModules), unit: "本", color: "#888" },
                    { label: "必須課程の進捗率", value: String(overallKpi.overallProgress), unit: "%", color: "#e8849a", highlight: overallKpi.overallProgress < 50 },
                  ].map((kpi, i) => (
                    <div key={i} className="rounded-xl border p-4" style={{
                      backgroundColor: T.card,
                      borderColor: kpi.highlight ? "#c4555544" : T.border,
                    }}>
                      <p className="text-[10px] mb-1" style={{ color: T.textMuted, letterSpacing: "0.05em" }}>{kpi.label}</p>
                      <p className="text-[24px] font-bold" style={{ color: kpi.color }}>{kpi.value}<span className="text-[10px] ml-1" style={{ color: T.textFaint }}>{kpi.unit}</span></p>
                    </div>
                  ))}
                </div>
              </section>

              {/* カテゴリ別統計 */}
              <section>
                <h2 className="text-[12px] font-medium mb-3" style={{ color: T.textSub, letterSpacing: "0.05em" }}>📚 カテゴリ別統計（在籍中セラピスト基準）</h2>
                <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: T.card, borderColor: T.border }}>
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr style={{ backgroundColor: T.cardAlt }}>
                        <th className="text-left px-4 py-2.5 font-medium" style={{ color: T.textSub }}>カテゴリ</th>
                        <th className="text-center px-3 py-2.5 font-medium" style={{ color: T.textSub }}>レベル</th>
                        <th className="text-right px-3 py-2.5 font-medium" style={{ color: T.textSub }}>モジュール数</th>
                        <th className="text-right px-3 py-2.5 font-medium" style={{ color: T.textSub }}>完了率</th>
                        <th className="text-right px-3 py-2.5 font-medium" style={{ color: T.textSub }}>バッジ取得</th>
                      </tr>
                    </thead>
                    <tbody>
                      {categoryStats.map(stat => (
                        <tr key={stat.category.id} style={{ borderTop: `1px solid ${T.border}` }}>
                          <td className="px-4 py-2.5">
                            <span className="mr-2">{stat.category.emoji || "📘"}</span>
                            <span style={{ color: T.text }}>{stat.category.name}</span>
                            {stat.category.is_required && <span className="ml-2 text-[8px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "#c96b8318", color: "#c96b83" }}>必須</span>}
                          </td>
                          <td className="text-center px-3 py-2.5">
                            <span className="text-[9px] px-2 py-0.5 rounded" style={{
                              backgroundColor: stat.category.level === "basic" ? "#c96b8318" : stat.category.level === "intermediate" ? "#3b82f618" : "#8b6cb718",
                              color: stat.category.level === "basic" ? "#c96b83" : stat.category.level === "intermediate" ? "#3b82f6" : "#8b6cb7",
                            }}>
                              {stat.category.level === "basic" ? "必須" : stat.category.level === "intermediate" ? "中級" : stat.category.level === "advanced" ? "上級" : stat.category.level}
                            </span>
                          </td>
                          <td className="text-right px-3 py-2.5" style={{ color: T.textSub }}>{stat.totalModules}</td>
                          <td className="text-right px-3 py-2.5">
                            <div className="inline-flex items-center gap-2">
                              <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: T.cardAlt }}>
                                <div className="h-full" style={{ width: `${stat.progressRate}%`, backgroundColor: stat.progressRate >= 80 ? "#4a7c59" : stat.progressRate >= 40 ? "#b38419" : "#c45555" }} />
                              </div>
                              <span style={{ color: T.text, minWidth: 36, textAlign: "right" }}>{stat.progressRate}%</span>
                            </div>
                          </td>
                          <td className="text-right px-3 py-2.5" style={{ color: T.text }}>
                            <strong>{stat.badgeCount}</strong>
                            <span className="text-[9px] ml-1" style={{ color: T.textMuted }}>名 ({stat.badgeRate}%)</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* 要フォローアップ */}
              {followUpList.length > 0 && (
                <section>
                  <h2 className="text-[12px] font-medium mb-3" style={{ color: T.textSub, letterSpacing: "0.05em" }}>⚠️ 要フォローアップ（在籍2ヶ月以上で必須5未完了）</h2>
                  <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: T.card, borderColor: "#c4555544" }}>
                    <div className="px-4 py-2.5 border-b text-[10px]" style={{ backgroundColor: "#c4555510", color: "#c45555", borderColor: "#c4555533" }}>
                      🚨 {followUpList.length}名のセラピストが要フォロー対象です
                    </div>
                    <table className="w-full text-[11px]">
                      <thead>
                        <tr style={{ backgroundColor: T.cardAlt }}>
                          <th className="text-left px-4 py-2.5 font-medium" style={{ color: T.textSub }}>セラピスト</th>
                          <th className="text-right px-3 py-2.5 font-medium" style={{ color: T.textSub }}>入店から</th>
                          <th className="text-right px-3 py-2.5 font-medium" style={{ color: T.textSub }}>必須完了</th>
                          <th className="text-right px-3 py-2.5 font-medium" style={{ color: T.textSub }}>進捗</th>
                        </tr>
                      </thead>
                      <tbody>
                        {followUpList.map(f => (
                          <tr key={f.therapist.id} style={{ borderTop: `1px solid ${T.border}` }}>
                            <td className="px-4 py-2.5">
                              <span style={{ color: T.text }}>{f.therapist.name}</span>
                              {f.therapist.real_name && f.therapist.real_name !== f.therapist.name && (
                                <span className="text-[9px] ml-2" style={{ color: T.textMuted }}>({f.therapist.real_name})</span>
                              )}
                            </td>
                            <td className="text-right px-3 py-2.5" style={{ color: T.textSub }}>{f.daysSinceEntry}日</td>
                            <td className="text-right px-3 py-2.5">
                              <span style={{ color: f.basicGot === 0 ? "#c45555" : "#b38419" }}>
                                {f.basicGot} / {f.totalBasic}
                              </span>
                            </td>
                            <td className="text-right px-3 py-2.5">
                              <div className="inline-flex items-center gap-2">
                                <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: T.cardAlt }}>
                                  <div className="h-full" style={{
                                    width: `${f.totalBasic > 0 ? (f.basicGot / f.totalBasic) * 100 : 0}%`,
                                    backgroundColor: f.basicGot === 0 ? "#c45555" : "#b38419",
                                  }} />
                                </div>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              {/* セラピスト × カテゴリ マトリクス */}
              <section>
                <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
                  <h2 className="text-[12px] font-medium" style={{ color: T.textSub, letterSpacing: "0.05em" }}>🎯 セラピスト × カテゴリ マトリクス</h2>
                  <div className="flex items-center gap-2 flex-wrap">
                    <input
                      type="text"
                      placeholder="セラピスト名検索"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="px-3 py-1.5 rounded-lg text-[11px] outline-none border"
                      style={{ backgroundColor: T.card, borderColor: T.border, color: T.text }}
                    />
                    <div className="flex gap-1">
                      {[
                        { key: "active", label: "在籍中" },
                        { key: "all", label: "全て" },
                      ].map(b => (
                        <button
                          key={b.key}
                          onClick={() => setFilterStatus(b.key as "active" | "all")}
                          className="px-2.5 py-1.5 rounded-lg text-[10px] cursor-pointer border"
                          style={{
                            borderColor: filterStatus === b.key ? T.accent : T.border,
                            backgroundColor: filterStatus === b.key ? T.accent + "18" : "transparent",
                            color: filterStatus === b.key ? T.accent : T.textMuted,
                            fontWeight: filterStatus === b.key ? 600 : 400,
                          }}
                        >
                          {b.label}
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-1">
                      {[
                        { key: "all", label: "全レベル" },
                        { key: "basic", label: "必須" },
                        { key: "intermediate", label: "中級" },
                        { key: "advanced", label: "上級" },
                      ].map(b => (
                        <button
                          key={b.key}
                          onClick={() => setFilterLevel(b.key as typeof filterLevel)}
                          className="px-2.5 py-1.5 rounded-lg text-[10px] cursor-pointer border"
                          style={{
                            borderColor: filterLevel === b.key ? "#8b6cb7" : T.border,
                            backgroundColor: filterLevel === b.key ? "#8b6cb718" : "transparent",
                            color: filterLevel === b.key ? "#8b6cb7" : T.textMuted,
                            fontWeight: filterLevel === b.key ? 600 : 400,
                          }}
                        >
                          {b.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border overflow-x-auto" style={{ backgroundColor: T.card, borderColor: T.border }}>
                  <table className="w-full text-[11px]" style={{ minWidth: 800 }}>
                    <thead>
                      <tr style={{ backgroundColor: T.cardAlt }}>
                        <th className="text-left px-3 py-2.5 font-medium sticky left-0" style={{ color: T.textSub, backgroundColor: T.cardAlt, minWidth: 140 }}>セラピスト</th>
                        <th className="text-center px-2 py-2.5 font-medium" style={{ color: T.textSub, minWidth: 60 }}>修了</th>
                        {filteredCategories.map(cat => (
                          <th key={cat.id} className="text-center px-2 py-2.5 font-medium" style={{ color: T.textSub, minWidth: 80 }}>
                            <div className="flex flex-col items-center gap-0.5">
                              <span className="text-[14px]">{cat.emoji || "📘"}</span>
                              <span className="text-[9px]" style={{ color: T.textMuted }}>{cat.name.length > 8 ? cat.name.slice(0, 7) + "…" : cat.name}</span>
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTherapists.length === 0 ? (
                        <tr>
                          <td colSpan={filteredCategories.length + 2} className="text-center py-8" style={{ color: T.textFaint }}>
                            該当するセラピストがいません
                          </td>
                        </tr>
                      ) : filteredTherapists.map(t => {
                        const isMaster = isMasterEligible(t.id);
                        const status = STATUS_LABELS[t.status] || { label: t.status, color: T.textMuted, bg: "transparent" };
                        return (
                          <tr key={t.id} style={{ borderTop: `1px solid ${T.border}` }}>
                            <td className="px-3 py-2.5 sticky left-0" style={{ backgroundColor: T.card }}>
                              <div className="flex items-center gap-2">
                                <span style={{ color: T.text }}>{t.name}</span>
                                {t.status !== "active" && (
                                  <span className="text-[8px] px-1.5 py-0.5 rounded" style={{ backgroundColor: status.bg, color: status.color }}>{status.label}</span>
                                )}
                              </div>
                              {t.real_name && t.real_name !== t.name && (
                                <p className="text-[9px] mt-0.5" style={{ color: T.textMuted }}>{t.real_name}</p>
                              )}
                            </td>
                            <td className="text-center px-2 py-2.5">
                              {isMaster ? (
                                <button
                                  onClick={() => issueMasterCert(t)}
                                  title="必須5全修了 — クリックで総合修了証を発行"
                                  className="inline-block text-[18px] cursor-pointer hover:scale-110 transition-transform"
                                  style={{ background: "none", border: "none", padding: 0 }}
                                >
                                  🎓
                                </button>
                              ) : (
                                <span className="text-[9px]" style={{ color: T.textFaint }}>—</span>
                              )}
                            </td>
                            {filteredCategories.map(cat => {
                              const total = moduleCountByCategory.get(cat.id) || 0;
                              const completed = completedCountByTherapistCategory.get(`${t.id}:${cat.id}`) || 0;
                              const hasBadge = badgesByTherapist.get(t.id)?.has(cat.id) || false;
                              const rate = total > 0 ? Math.round((completed / total) * 100) : 0;

                              if (hasBadge) {
                                return (
                                  <td key={cat.id} className="text-center px-2 py-2.5">
                                    <button
                                      onClick={() => issueCategoryCert(t, cat.id)}
                                      title={`${cat.name} 修了証を発行`}
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] cursor-pointer hover:opacity-80 transition-opacity"
                                      style={{ backgroundColor: "#4a7c5918", color: "#4a7c59", border: "none" }}
                                    >
                                      ✓ 修了 📜
                                    </button>
                                  </td>
                                );
                              }
                              if (completed === 0) {
                                return (
                                  <td key={cat.id} className="text-center px-2 py-2.5">
                                    <span className="text-[9px]" style={{ color: T.textFaint }}>未着手</span>
                                  </td>
                                );
                              }
                              return (
                                <td key={cat.id} className="text-center px-2 py-2.5">
                                  <div className="inline-flex flex-col items-center gap-0.5">
                                    <span className="text-[9px]" style={{ color: T.textSub }}>{completed}/{total}</span>
                                    <div className="w-12 h-1 rounded-full overflow-hidden" style={{ backgroundColor: T.cardAlt }}>
                                      <div className="h-full" style={{ width: `${rate}%`, backgroundColor: rate >= 80 ? "#4a7c59" : rate >= 40 ? "#b38419" : "#c45555" }} />
                                    </div>
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* 凡例 */}
                <div className="mt-3 px-4 py-2.5 rounded-xl border text-[10px] flex flex-wrap items-center gap-4" style={{ backgroundColor: T.card, borderColor: T.border, color: T.textMuted }}>
                  <span>凡例:</span>
                  <span><span className="inline-block text-[14px] mr-1">🎓</span>必須5全修了 (クリックで総合修了証発行)</span>
                  <span><span className="inline-block px-1.5 py-0.5 rounded text-[9px] mr-1" style={{ backgroundColor: "#4a7c5918", color: "#4a7c59" }}>✓ 修了 📜</span>カテゴリ別修了証発行</span>
                  <span><span className="inline-block w-12 h-1 rounded-full mr-1" style={{ backgroundColor: T.cardAlt, position: "relative", verticalAlign: "middle" }}><span className="absolute left-0 top-0 h-full" style={{ width: "60%", backgroundColor: "#b38419" }} /></span>進捗中</span>
                  <span style={{ color: T.textFaint }}>未着手 = 1モジュールも完了していない</span>
                </div>
              </section>

              {/* フッター注記 */}
              <div className="px-4 py-3 rounded-xl border text-[10px]" style={{ backgroundColor: T.cardAlt, borderColor: T.border, color: T.textMuted, lineHeight: 1.7 }}>
                💡 <strong style={{ color: T.textSub }}>本レポートについて</strong> · 業務委託契約書 第10条（研修受講義務）の運用管理用です。要フォローアップに該当するセラピストには、定期面談時に研修進捗の確認をお願いします。研修コンテンツの追加・修正は SQL（session91/94/95）から行います。
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
