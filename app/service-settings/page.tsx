"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";
import { useTheme } from "../../lib/theme";
import { NavMenu } from "../../lib/nav-menu";

type Nomination = { id: number; name: string; price: number; therapist_back: number };
type Discount = { id: number; name: string; amount: number; type: string; newcomer_only: boolean; web_available: boolean; valid_from: string | null; valid_until: string | null; combinable: boolean };
type Extension = { id: number; name: string; duration: number; price: number; therapist_back: number };
type Option = { id: number; name: string; price: number; therapist_back: number };
type PointSettings = {
  id: number; earn_per_yen: number; earn_points: number; discount_per_point: number;
  min_use_points: number; expiry_months: number; expiry_notify_days: number;
  registration_bonus: number; review_bonus: number;
  rainy_day_active: boolean; rainy_day_multiplier: number;
};
type BonusRule = {
  id: number; type: string; day_of_week: number | null; start_day: number | null;
  end_day: number | null; multiplier: number; label: string; is_active: boolean;
  start_time: string | null; end_time: string | null; weekdays: number[] | null;
};
type RankMultiplier = { id: number; rank_name: string; multiplier: number; min_visits_in_period: number; period_months: number; min_total_visits: number };
type BackRateRule = { id: number; min_sessions: number; min_nomination_rate: number; back_increase: number; salary_type: string; is_active: boolean; sort_order: number };

type Tab = "nomination" | "discount" | "extension" | "option" | "point" | "backrate" | "notify";
type NotifyTemplate = { id: number; template_key: string; body: string };
type NotifySubTab = "customer_url" | "customer_no_url" | "customer_detail_url" | "customer_detail_no_url" | "staff";

const fmt = (n: number) => "¥" + (n || 0).toLocaleString();
const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];
const RANK_LABELS: Record<string, string> = { normal: "一般", silver: "シルバー", gold: "ゴールド", platinum: "プラチナ" };

export default function ServiceSettings() {
  const router = useRouter();
  const { dark, toggle, T } = useTheme();
  const [tab, setTab] = useState<Tab>("nomination");

  const [nominations, setNominations] = useState<Nomination[]>([]);
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [extensions, setExtensions] = useState<Extension[]>([]);
  const [options, setOptions] = useState<Option[]>([]);

  // Point states
  const [pointSettings, setPointSettings] = useState<PointSettings | null>(null);
  const [bonusRules, setBonusRules] = useState<BonusRule[]>([]);
  const [rankMultipliers, setRankMultipliers] = useState<RankMultiplier[]>([]);
  const [ptSaving, setPtSaving] = useState(false);
  const [ptMsg, setPtMsg] = useState("");

  // Point settings edit
  const [ptEarnYen, setPtEarnYen] = useState("");
  const [ptEarnPts, setPtEarnPts] = useState("");
  const [ptDiscPer, setPtDiscPer] = useState("");
  const [ptMinUse, setPtMinUse] = useState("");
  const [ptExpiry, setPtExpiry] = useState("");
  const [ptNotify, setPtNotify] = useState("");
  const [ptRegBonus, setPtRegBonus] = useState("");
  const [ptReviewBonus, setPtReviewBonus] = useState("");
  const [ptRainyActive, setPtRainyActive] = useState(false);
  const [ptRainyMult, setPtRainyMult] = useState("");

  // Bonus rule add
  const [brType, setBrType] = useState("weekday");
  const [brDow, setBrDow] = useState(3);
  const [brStartDay, setBrStartDay] = useState("1");
  const [brEndDay, setBrEndDay] = useState("5");
  const [brMult, setBrMult] = useState("2.0");
  const [brLabel, setBrLabel] = useState("");
  const [brStartTime, setBrStartTime] = useState("12:00");
  const [brEndTime, setBrEndTime] = useState("15:00");
  const [brWeekdays, setBrWeekdays] = useState<number[]>([1, 2, 3, 4, 5]);

  // Point sub-section
  const [ptSection, setPtSection] = useState<"basic" | "bonus" | "rank">("basic");

  // Back rate states
  const [brRules, setBrRules] = useState<BackRateRule[]>([]);
  const [brAddSessions, setBrAddSessions] = useState("25");
  const [brAddRate, setBrAddRate] = useState("30");
  const [brAddIncrease, setBrAddIncrease] = useState("500");
  const [brAddType, setBrAddType] = useState("fixed");
  const [brSaving, setBrSaving] = useState(false);
  const [brMsg, setBrMsg] = useState("");
  const [newcomerMonths, setNewcomerMonths] = useState("2");
  type BrResult = { therapist_id: number; name: string; sessions: number; nom_sessions: number; nom_rate: number; absences: number; lates: number; early_leaves: number; work_days: number; back_increase: number; salary_type: string };
  const [brLastMonth, setBrLastMonth] = useState<BrResult[]>([]);
  const [brCurrentMonth, setBrCurrentMonth] = useState<BrResult[]>([]);
  const [brLastYM, setBrLastYM] = useState("");
  const [brCurrentYM, setBrCurrentYM] = useState("");
  const [brLoading, setBrLoading] = useState(false);
  const [brCopiedId, setBrCopiedId] = useState<number | null>(null);

  // Notification template states
  const [ntTemplates, setNtTemplates] = useState<NotifyTemplate[]>([]);
  const [ntSubTab, setNtSubTab] = useState<NotifySubTab>("customer_url");
  const [ntBody, setNtBody] = useState("");
  const [ntSaving, setNtSaving] = useState(false);
  const [ntMsg, setNtMsg] = useState("");
  const [ntUrlDays, setNtUrlDays] = useState("1");
  const [ntSenderDefault, setNtSenderDefault] = useState("");
  const [ntLocToyohashi, setNtLocToyohashi] = useState("");
  const [ntLocMycourt, setNtLocMycourt] = useState("");
  const [ntLocOasis, setNtLocOasis] = useState("");
  const [ntMapToyohashi, setNtMapToyohashi] = useState("");
  const [ntMapMycourt, setNtMapMycourt] = useState("");
  const [ntMapOasis, setNtMapOasis] = useState("");
  const [ntPreview, setNtPreview] = useState(false);

  // Add states
  const [addName, setAddName] = useState("");
  const [addPrice, setAddPrice] = useState("");
  const [addBack, setAddBack] = useState("");
  const [addDuration, setAddDuration] = useState("30");
  const [addAmount, setAddAmount] = useState("");
  const [addDiscountType, setAddDiscountType] = useState("fixed");
  const [addNewcomerOnly, setAddNewcomerOnly] = useState(false);
  const [addWebAvailable, setAddWebAvailable] = useState(true);
  const [addValidFrom, setAddValidFrom] = useState("");
  const [addValidUntil, setAddValidUntil] = useState("");
  const [addCombinable, setAddCombinable] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  // Edit states
  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editBack, setEditBack] = useState("");
  const [editDuration, setEditDuration] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editDiscountType, setEditDiscountType] = useState("fixed");
  const [editNewcomerOnly, setEditNewcomerOnly] = useState(false);
  const [editWebAvailable, setEditWebAvailable] = useState(true);
  const [editValidFrom, setEditValidFrom] = useState("");
  const [editValidUntil, setEditValidUntil] = useState("");
  const [editCombinable, setEditCombinable] = useState(true);

  const fetchData = useCallback(async () => {
    const { data: n } = await supabase.from("nominations").select("*").order("id"); if (n) setNominations(n);
    const { data: d } = await supabase.from("discounts").select("*").order("id"); if (d) setDiscounts(d);
    const { data: e } = await supabase.from("extensions").select("*").order("duration"); if (e) setExtensions(e);
    const { data: o } = await supabase.from("options").select("*").order("id"); if (o) setOptions(o);
    // Point data
    const { data: ps } = await supabase.from("point_settings").select("*").limit(1).single();
    if (ps) {
      setPointSettings(ps);
      setPtEarnYen(String(ps.earn_per_yen)); setPtEarnPts(String(ps.earn_points));
      setPtDiscPer(String(ps.discount_per_point)); setPtMinUse(String(ps.min_use_points));
      setPtExpiry(String(ps.expiry_months)); setPtNotify(String(ps.expiry_notify_days));
      setPtRegBonus(String(ps.registration_bonus)); setPtReviewBonus(String(ps.review_bonus || 50));
      setPtRainyActive(ps.rainy_day_active || false); setPtRainyMult(String(ps.rainy_day_multiplier || 2.0));
    }
    const { data: br } = await supabase.from("point_bonus_rules").select("*").order("id"); if (br) setBonusRules(br);
    const { data: rm } = await supabase.from("rank_point_multipliers").select("*").order("id"); if (rm) setRankMultipliers(rm);
    // Back rate rules
    const { data: brr } = await supabase.from("back_rate_rules").select("*").order("sort_order"); if (brr) setBrRules(brr);
    const { data: ss } = await supabase.from("store_settings").select("*").eq("key", "newcomer_duration_months").maybeSingle(); if (ss) setNewcomerMonths(ss.value);
    // Notification templates
    const { data: nts } = await supabase.from("notification_templates").select("*").order("id"); if (nts) setNtTemplates(nts);
    const ntKeys = ["notify_url_days", "notify_sender_default", "notify_loc_toyohashi", "notify_loc_mycourt", "notify_loc_oasis", "notify_map_toyohashi", "notify_map_mycourt", "notify_map_oasis"];
    const { data: ntSettings } = await supabase.from("store_settings").select("*").in("key", ntKeys);
    if (ntSettings) { for (const s of ntSettings) { if (s.key === "notify_url_days") setNtUrlDays(s.value); else if (s.key === "notify_sender_default") setNtSenderDefault(s.value); else if (s.key === "notify_loc_toyohashi") setNtLocToyohashi(s.value); else if (s.key === "notify_loc_mycourt") setNtLocMycourt(s.value); else if (s.key === "notify_loc_oasis") setNtLocOasis(s.value); else if (s.key === "notify_map_toyohashi") setNtMapToyohashi(s.value); else if (s.key === "notify_map_mycourt") setNtMapMycourt(s.value); else if (s.key === "notify_map_oasis") setNtMapOasis(s.value); } }
  }, []);

  useEffect(() => { const check = async () => { const { data: { user } } = await supabase.auth.getUser(); if (!user) router.push("/"); }; check(); fetchData(); }, [router, fetchData]);

  // Back rate data fetch
  const fetchBrData = useCallback(async () => {
    setBrLoading(true);
    const now = new Date();
    const { data: rules } = await supabase.from("back_rate_rules").select("*").eq("is_active", true).order("back_increase", { ascending: false });
    const { data: therapists } = await supabase.from("therapists").select("id,name").eq("status", "active");
    if (!therapists) { setBrLoading(false); return; }

    const calcMonth = async (year: number, month: number): Promise<BrResult[]> => {
      const ym = `${year}-${String(month + 1).padStart(2, "0")}`;
      const firstDay = `${ym}-01`;
      const lastDay = new Date(year, month + 1, 0).toISOString().split("T")[0];
      const { data: res } = await supabase.from("reservations").select("therapist_id,nomination").eq("status", "completed").gte("date", firstDay).lte("date", lastDay);
      const { data: absents } = await supabase.from("absent_records").select("therapist_id").gte("date", firstDay).lte("date", lastDay);
      const { data: assigns } = await supabase.from("room_assignments").select("therapist_id,attendance").gte("date", firstDay).lte("date", lastDay);
      const { data: shifts } = await supabase.from("shifts").select("therapist_id,date").eq("status", "approved").gte("date", firstDay).lte("date", lastDay);
      return therapists.map(t => {
        const tRes = (res || []).filter(r => r.therapist_id === t.id);
        const sessions = tRes.length;
        const nomSessions = tRes.filter(r => r.nomination === "本指名").length;
        const nomRate = sessions > 0 ? Math.round(nomSessions / sessions * 1000) / 10 : 0;
        const abs = (absents || []).filter(a => a.therapist_id === t.id).length;
        const tA = (assigns || []).filter(a => a.therapist_id === t.id);
        const lates = tA.filter(a => a.attendance?.includes("late")).length;
        const earlyLeaves = tA.filter(a => a.attendance?.includes("early_leave")).length;
        const workDays = new Set((shifts || []).filter(s => s.therapist_id === t.id).map(s => s.date)).size;
        let backIncrease = 0; let salaryType = "fixed";
        if (rules) for (const rule of rules) { if (sessions >= rule.min_sessions && nomRate >= rule.min_nomination_rate) { backIncrease = rule.back_increase; salaryType = rule.salary_type; break; } }
        return { therapist_id: t.id, name: t.name, sessions, nom_sessions: nomSessions, nom_rate: nomRate, absences: abs, lates, early_leaves: earlyLeaves, work_days: workDays, back_increase: backIncrease, salary_type: salaryType };
      });
    };

    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevYM = `${prev.getFullYear()}年${prev.getMonth() + 1}月`;
    const curYM = `${now.getFullYear()}年${now.getMonth() + 1}月`;
    setBrLastYM(prevYM); setBrCurrentYM(curYM);
    const lastResults = await calcMonth(prev.getFullYear(), prev.getMonth());
    setBrLastMonth(lastResults);
    const curResults = await calcMonth(now.getFullYear(), now.getMonth());
    setBrCurrentMonth(curResults);
    setBrLoading(false);
  }, []);

  useEffect(() => { if (tab === "backrate") fetchBrData(); }, [tab, fetchBrData]);
  useEffect(() => { const t = ntTemplates.find(t => t.template_key === ntSubTab); if (t) setNtBody(t.body); }, [ntSubTab, ntTemplates]);

  const copyBrLine = (r: BrResult, ym: string) => {
    const change = r.back_increase > 0;
    const backLabel = r.salary_type === "percent" ? `${r.back_increase}%UP` : `+${r.back_increase.toLocaleString()}円UP`;
    const footer = change ? `バックが ${backLabel} となりました🎉\n素晴らしい実績です！引き続きよろしくお願いします！` : `バックは基本レートとなります。\n来月もよろしくお願いします💪`;
    const msg = `${r.name}さん、お疲れ様です！\n${ym}の実績報告です📊\n\n出勤回数: ${r.work_days}日\n接客本数: ${r.sessions}本\n本指名率: ${r.nom_rate}%\n当日欠勤: ${r.absences}回\n遅刻: ${r.lates}回\n早退: ${r.early_leaves}回\n\n${footer}`;
    navigator.clipboard.writeText(msg); setBrCopiedId(r.therapist_id); setTimeout(() => setBrCopiedId(null), 2000);
  };

  const resetAdd = () => { setAddName(""); setAddPrice(""); setAddBack(""); setAddDuration("30"); setAddAmount(""); setAddDiscountType("fixed"); setAddNewcomerOnly(false); setAddWebAvailable(true); setAddValidFrom(""); setAddValidUntil(""); setAddCombinable(true); setMsg(""); };
  const resetEdit = () => { setEditId(null); setEditName(""); setEditPrice(""); setEditBack(""); setEditDuration(""); setEditAmount(""); setEditDiscountType("fixed"); setEditNewcomerOnly(false); setEditWebAvailable(true); setEditValidFrom(""); setEditValidUntil(""); setEditCombinable(true); };

  // ===== Add =====
  const handleAdd = async () => {
    if (!addName.trim()) { setMsg("名前を入力してください"); return; }
    setSaving(true); setMsg("");
    let error = null;
    if (tab === "nomination") {
      ({ error } = await supabase.from("nominations").insert({ name: addName.trim(), price: parseInt(addPrice) || 0, therapist_back: parseInt(addBack) || 0 }));
    } else if (tab === "discount") {
      ({ error } = await supabase.from("discounts").insert({ name: addName.trim(), amount: parseInt(addAmount) || 0, type: addDiscountType, newcomer_only: addNewcomerOnly, web_available: addWebAvailable, valid_from: addValidFrom || null, valid_until: addValidUntil || null, combinable: addCombinable }));
    } else if (tab === "extension") {
      ({ error } = await supabase.from("extensions").insert({ name: addName.trim(), duration: parseInt(addDuration) || 30, price: parseInt(addPrice) || 0, therapist_back: parseInt(addBack) || 0 }));
    } else if (tab === "option") {
      ({ error } = await supabase.from("options").insert({ name: addName.trim(), price: parseInt(addPrice) || 0, therapist_back: parseInt(addBack) || 0 }));
    }
    setSaving(false);
    if (error) { setMsg("登録失敗: " + error.message); }
    else { setMsg("登録しました！"); resetAdd(); fetchData(); setTimeout(() => setMsg(""), 1000); }
  };

  // ===== Update =====
  const handleUpdate = async () => {
    if (!editId || !editName.trim()) return;
    if (tab === "nomination") {
      await supabase.from("nominations").update({ name: editName.trim(), price: parseInt(editPrice) || 0, therapist_back: parseInt(editBack) || 0 }).eq("id", editId);
    } else if (tab === "discount") {
      await supabase.from("discounts").update({ name: editName.trim(), amount: parseInt(editAmount) || 0, type: editDiscountType, newcomer_only: editNewcomerOnly, web_available: editWebAvailable, valid_from: editValidFrom || null, valid_until: editValidUntil || null, combinable: editCombinable }).eq("id", editId);
    } else if (tab === "extension") {
      await supabase.from("extensions").update({ name: editName.trim(), duration: parseInt(editDuration) || 30, price: parseInt(editPrice) || 0, therapist_back: parseInt(editBack) || 0 }).eq("id", editId);
    } else if (tab === "option") {
      await supabase.from("options").update({ name: editName.trim(), price: parseInt(editPrice) || 0, therapist_back: parseInt(editBack) || 0 }).eq("id", editId);
    }
    resetEdit(); fetchData();
  };

  // ===== Delete =====
  const handleDelete = async (id: number) => {
    if (!confirm("削除しますか？")) return;
    const table = tab === "nomination" ? "nominations" : tab === "discount" ? "discounts" : tab === "extension" ? "extensions" : "options";
    await supabase.from(table).delete().eq("id", id);
    fetchData();
  };

  // ===== Point Settings Save =====
  const handleSavePointSettings = async () => {
    if (!pointSettings) return;
    setPtSaving(true); setPtMsg("");
    try {
      const { error } = await supabase.from("point_settings").update({
        earn_per_yen: parseInt(ptEarnYen) || 1000,
        earn_points: parseInt(ptEarnPts) || 20,
        discount_per_point: parseFloat(ptDiscPer) || 1,
        min_use_points: parseInt(ptMinUse) || 1000,
        expiry_months: parseInt(ptExpiry) || 12,
        expiry_notify_days: parseInt(ptNotify) || 30,
        registration_bonus: parseInt(ptRegBonus) || 0,
        review_bonus: parseInt(ptReviewBonus) || 0,
        rainy_day_active: ptRainyActive,
        rainy_day_multiplier: parseFloat(ptRainyMult) || 2.0,
        updated_at: new Date().toISOString(),
      }).eq("id", pointSettings.id);
      if (error) throw error;
      setPtMsg("保存しました！");
      fetchData();
      setTimeout(() => setPtMsg(""), 2000);
    } catch (e: unknown) {
      const err = e as { message?: string };
      setPtMsg("保存失敗: " + (err.message || ""));
    }
    setPtSaving(false);
  };

  // ===== Bonus Rule Add =====
  const handleAddBonusRule = async () => {
    const rule: Record<string, unknown> = {
      type: brType,
      multiplier: parseFloat(brMult) || 2.0,
      label: brLabel.trim() || null,
      is_active: true,
    };
    if (brType === "weekday") { rule.day_of_week = brDow; }
    else if (brType === "period") { rule.start_day = parseInt(brStartDay) || 1; rule.end_day = parseInt(brEndDay) || 5; }
    else if (brType === "birthday") { /* no extra fields */ }
    else if (brType === "idle_time") {
      rule.start_time = brStartTime; rule.end_time = brEndTime;
      rule.weekdays = brWeekdays;
    }
    try {
      const { error } = await supabase.from("point_bonus_rules").insert(rule);
      if (error) throw error;
      setBrLabel(""); setBrMult("2.0");
      fetchData();
    } catch (e: unknown) {
      const err = e as { message?: string };
      alert("追加失敗: " + (err.message || ""));
    }
  };

  // ===== Bonus Rule Toggle =====
  const toggleBonusRule = async (id: number, current: boolean) => {
    await supabase.from("point_bonus_rules").update({ is_active: !current }).eq("id", id);
    fetchData();
  };

  // ===== Bonus Rule Delete =====
  const deleteBonusRule = async (id: number) => {
    if (!confirm("このボーナスルールを削除しますか？")) return;
    await supabase.from("point_bonus_rules").delete().eq("id", id);
    fetchData();
  };

  // ===== Rank Multiplier Update =====
  const updateRankMult = async (id: number, mult: string) => {
    await supabase.from("rank_point_multipliers").update({ multiplier: parseFloat(mult) || 1.0 }).eq("id", id);
    fetchData();
  };

  const updateRankCondition = async (id: number, updates: Partial<{min_visits_in_period: number; period_months: number; min_total_visits: number}>) => {
    await supabase.from("rank_point_multipliers").update(updates).eq("id", id);
    fetchData();
  };

  // ===== Rainy Day Toggle =====
  const toggleRainyDay = async () => {
    if (!pointSettings) return;
    const newVal = !ptRainyActive;
    setPtRainyActive(newVal);
    await supabase.from("point_settings").update({ rainy_day_active: newVal }).eq("id", pointSettings.id);
    fetchData();
  };

  const inputStyle = { backgroundColor: T.cardAlt, color: T.text, border: "1px solid transparent" };
  const PT_COLOR = "#d4a843";

  const tabs: { key: Tab; label: string; color: string; count: number }[] = [
    { key: "nomination", label: "指名", color: "#c3a782", count: nominations.length },
    { key: "extension", label: "延長", color: "#85a8c4", count: extensions.length },
    { key: "option", label: "オプション", color: "#7ab88f", count: options.length },
    { key: "discount", label: "割引", color: "#c49885", count: discounts.length },
    { key: "point", label: "ポイント", color: PT_COLOR, count: bonusRules.filter(r => r.is_active).length },
    { key: "backrate", label: "バックレート", color: "#8b5cf6", count: brRules.filter(r => r.is_active).length },
    { key: "notify", label: "📩 通知テンプレート", color: "#3d6b9f", count: ntTemplates.length },
  ];

  const currentTab = tabs.find((t) => t.key === tab)!;

  const bonusTypeLabel = (type: string) => {
    if (type === "weekday") return "📅 曜日";
    if (type === "period") return "📆 期間";
    if (type === "birthday") return "🎂 誕生月";
    if (type === "idle_time") return "🕐 アイドルタイム";
    return type;
  };

  const bonusRuleDesc = (r: BonusRule) => {
    if (r.type === "weekday") return `毎週${WEEKDAY_LABELS[r.day_of_week || 0]}曜日`;
    if (r.type === "period") return `毎月${r.start_day}日〜${r.end_day}日`;
    if (r.type === "birthday") return "お客様の誕生月";
    if (r.type === "idle_time") {
      const days = (r.weekdays || []).map(d => WEEKDAY_LABELS[d]).join("・");
      return `${days} ${r.start_time}〜${r.end_time}`;
    }
    return "";
  };

  return (
    <div className="h-screen flex flex-col" style={{ backgroundColor: T.bg, color: T.text }}>
      {/* Header */}
      <div className="h-[56px] flex items-center justify-between px-4 flex-shrink-0 border-b" style={{ backgroundColor: T.card, borderColor: T.border }}>
        <div className="flex items-center gap-3">
          <NavMenu T={T} dark={dark} />
          <button onClick={() => router.push("/dashboard")} className="p-2 rounded-lg cursor-pointer" style={{ color: T.textSub }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="15 18 9 12 15 6"/></svg></button>
          <h1 className="text-[14px] font-medium">サービス設定</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={toggle} className="px-2.5 py-1.5 text-[10px] rounded-lg cursor-pointer border" style={{ borderColor: T.border, color: T.textSub }}>{dark ? "☀️ ライト" : "🌙 ダーク"}</button>
          <button onClick={() => router.push("/courses")} className="px-2.5 py-1.5 text-[10px] rounded-lg cursor-pointer border" style={{ borderColor: T.border, color: T.textSub }}>コース管理 →</button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 px-4 py-2 border-b flex-shrink-0 overflow-x-auto" style={{ backgroundColor: T.card, borderColor: T.border }}>
        {tabs.map((t) => (
          <button key={t.key} onClick={() => { setTab(t.key); resetAdd(); resetEdit(); }} className="px-3 py-1.5 text-[11px] rounded-lg cursor-pointer transition-all flex items-center gap-1.5 whitespace-nowrap"
            style={{ backgroundColor: tab === t.key ? t.color + "18" : "transparent", color: tab === t.key ? t.color : T.textMuted, fontWeight: tab === t.key ? 600 : 400 }}>
            {t.label}
            <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: tab === t.key ? t.color + "22" : T.cardAlt, color: tab === t.key ? t.color : T.textFaint }}>{t.count}</span>
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-[700px] mx-auto animate-[fadeIn_0.3s]">

          {/* ════════════ POINT TAB ════════════ */}
          {tab === "point" && pointSettings && (
            <div className="space-y-5">
              {/* Sub-tabs */}
              <div className="flex gap-2">
                {([["basic", "⚙️ 基本設定"], ["bonus", "🎁 ボーナスルール"], ["rank", "📈 会員ランク"]] as [typeof ptSection, string][]).map(([k, l]) => (
                  <button key={k} onClick={() => setPtSection(k)} className="px-4 py-2 text-[11px] rounded-xl cursor-pointer transition-all"
                    style={{ backgroundColor: ptSection === k ? PT_COLOR + "18" : T.cardAlt, color: ptSection === k ? PT_COLOR : T.textMuted, fontWeight: ptSection === k ? 600 : 400 }}>
                    {l}
                  </button>
                ))}
              </div>

              {/* ── 基本設定 ── */}
              {ptSection === "basic" && (
                <div className="space-y-5">
                  {/* ポイント付与ルール */}
                  <div className="rounded-2xl border p-5" style={{ backgroundColor: T.card, borderColor: T.border }}>
                    <p className="text-[13px] font-medium mb-4">💰 ポイント付与ルール</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] mb-1" style={{ color: T.textSub }}>金額（円）あたり</label>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px]" style={{ color: T.textMuted }}>¥</span>
                          <input type="text" inputMode="numeric" value={ptEarnYen} onChange={e => setPtEarnYen(e.target.value.replace(/[^0-9]/g, ""))}
                            className="flex-1 px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] mb-1" style={{ color: T.textSub }}>付与ポイント</label>
                        <div className="flex items-center gap-2">
                          <input type="text" inputMode="numeric" value={ptEarnPts} onChange={e => setPtEarnPts(e.target.value.replace(/[^0-9]/g, ""))}
                            className="flex-1 px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} />
                          <span className="text-[11px]" style={{ color: T.textMuted }}>pt</span>
                        </div>
                      </div>
                    </div>
                    <p className="text-[10px] mt-3 px-1" style={{ color: T.textFaint }}>
                      例: ¥{ptEarnYen || "1000"}利用ごとに{ptEarnPts || "20"}pt付与 → ¥10,000利用で{Math.floor(10000 / (parseInt(ptEarnYen) || 1000)) * (parseInt(ptEarnPts) || 20)}pt
                    </p>
                  </div>

                  {/* ポイント利用ルール */}
                  <div className="rounded-2xl border p-5" style={{ backgroundColor: T.card, borderColor: T.border }}>
                    <p className="text-[13px] font-medium mb-4">🏷 ポイント利用ルール</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] mb-1" style={{ color: T.textSub }}>1ptあたり割引額（円）</label>
                        <div className="flex items-center gap-2">
                          <input type="text" inputMode="numeric" value={ptDiscPer} onChange={e => setPtDiscPer(e.target.value.replace(/[^0-9.]/g, ""))}
                            className="flex-1 px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} />
                          <span className="text-[11px]" style={{ color: T.textMuted }}>円/pt</span>
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] mb-1" style={{ color: T.textSub }}>最低利用ポイント</label>
                        <div className="flex items-center gap-2">
                          <input type="text" inputMode="numeric" value={ptMinUse} onChange={e => setPtMinUse(e.target.value.replace(/[^0-9]/g, ""))}
                            className="flex-1 px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} />
                          <span className="text-[11px]" style={{ color: T.textMuted }}>pt〜</span>
                        </div>
                      </div>
                    </div>
                    <p className="text-[10px] mt-3 px-1" style={{ color: T.textFaint }}>
                      {ptMinUse || "1000"}pt以上で利用可能 → {ptMinUse || "1000"}pt = ¥{((parseInt(ptMinUse) || 1000) * (parseFloat(ptDiscPer) || 1)).toLocaleString()}OFF
                    </p>
                  </div>

                  {/* 有効期限 */}
                  <div className="rounded-2xl border p-5" style={{ backgroundColor: T.card, borderColor: T.border }}>
                    <p className="text-[13px] font-medium mb-4">⏰ 有効期限・通知</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] mb-1" style={{ color: T.textSub }}>有効期限</label>
                        <div className="flex items-center gap-2">
                          <input type="text" inputMode="numeric" value={ptExpiry} onChange={e => setPtExpiry(e.target.value.replace(/[^0-9]/g, ""))}
                            className="flex-1 px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} />
                          <span className="text-[11px]" style={{ color: T.textMuted }}>ヶ月</span>
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] mb-1" style={{ color: T.textSub }}>期限前通知</label>
                        <div className="flex items-center gap-2">
                          <input type="text" inputMode="numeric" value={ptNotify} onChange={e => setPtNotify(e.target.value.replace(/[^0-9]/g, ""))}
                            className="flex-1 px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} />
                          <span className="text-[11px]" style={{ color: T.textMuted }}>日前</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 特別ボーナス */}
                  <div className="rounded-2xl border p-5" style={{ backgroundColor: T.card, borderColor: T.border }}>
                    <p className="text-[13px] font-medium mb-4">🎁 特別ボーナス</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] mb-1" style={{ color: T.textSub }}>初回登録ボーナス</label>
                        <div className="flex items-center gap-2">
                          <input type="text" inputMode="numeric" value={ptRegBonus} onChange={e => setPtRegBonus(e.target.value.replace(/[^0-9]/g, ""))}
                            className="flex-1 px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} />
                          <span className="text-[11px]" style={{ color: T.textMuted }}>pt</span>
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] mb-1" style={{ color: T.textSub }}>アンケート回答ボーナス</label>
                        <div className="flex items-center gap-2">
                          <input type="text" inputMode="numeric" value={ptReviewBonus} onChange={e => setPtReviewBonus(e.target.value.replace(/[^0-9]/g, ""))}
                            className="flex-1 px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} />
                          <span className="text-[11px]" style={{ color: T.textMuted }}>pt</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 雨の日ボーナス */}
                  <div className="rounded-2xl border p-5" style={{ backgroundColor: T.card, borderColor: T.border }}>
                    <p className="text-[13px] font-medium mb-4">☔ 雨の日ボーナス</p>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[12px]">現在のステータス</span>
                      <button onClick={toggleRainyDay} className="px-4 py-2 rounded-xl text-[11px] font-medium cursor-pointer transition-all"
                        style={{ backgroundColor: ptRainyActive ? "#4a7c5920" : T.cardAlt, color: ptRainyActive ? "#4a7c59" : T.textMuted }}>
                        {ptRainyActive ? "☔ ON（本日ポイントUP中）" : "OFF"}
                      </button>
                    </div>
                    <div className="w-[200px]">
                      <label className="block text-[10px] mb-1" style={{ color: T.textSub }}>雨の日倍率</label>
                      <select value={ptRainyMult} onChange={e => setPtRainyMult(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none cursor-pointer" style={inputStyle}>
                        {["1.5", "2.0", "2.5", "3.0"].map(v => <option key={v} value={v}>{v}倍</option>)}
                      </select>
                    </div>
                  </div>

                  {/* 保存ボタン */}
                  <div className="flex items-center gap-3">
                    <button onClick={handleSavePointSettings} disabled={ptSaving}
                      className="px-6 py-3 text-white text-[12px] rounded-xl cursor-pointer disabled:opacity-60 font-medium"
                      style={{ backgroundColor: PT_COLOR }}>
                      {ptSaving ? "保存中..." : "💾 基本設定を保存"}
                    </button>
                    {ptMsg && <span className="text-[11px]" style={{ color: ptMsg.includes("失敗") ? "#c45555" : "#4a7c59" }}>{ptMsg}</span>}
                  </div>
                </div>
              )}

              {/* ── ボーナスルール ── */}
              {ptSection === "bonus" && (
                <div className="space-y-5">
                  {/* 追加フォーム */}
                  <div className="rounded-2xl border p-5" style={{ backgroundColor: T.card, borderColor: T.border }}>
                    <p className="text-[13px] font-medium mb-4">ボーナスルール追加</p>

                    <div className="flex flex-wrap gap-3 mb-4">
                      <div>
                        <label className="block text-[10px] mb-1" style={{ color: T.textSub }}>種類</label>
                        <select value={brType} onChange={e => setBrType(e.target.value)}
                          className="px-3 py-2.5 rounded-xl text-[12px] outline-none cursor-pointer" style={inputStyle}>
                          <option value="weekday">📅 曜日ボーナス</option>
                          <option value="period">📆 期間ボーナス</option>
                          <option value="birthday">🎂 誕生月ボーナス</option>
                          <option value="idle_time">🕐 アイドルタイム</option>
                        </select>
                      </div>

                      {brType === "weekday" && (
                        <div>
                          <label className="block text-[10px] mb-1" style={{ color: T.textSub }}>曜日</label>
                          <select value={brDow} onChange={e => setBrDow(parseInt(e.target.value))}
                            className="px-3 py-2.5 rounded-xl text-[12px] outline-none cursor-pointer" style={inputStyle}>
                            {WEEKDAY_LABELS.map((l, i) => <option key={i} value={i}>{l}曜日</option>)}
                          </select>
                        </div>
                      )}

                      {brType === "period" && (<>
                        <div>
                          <label className="block text-[10px] mb-1" style={{ color: T.textSub }}>開始日</label>
                          <input type="text" inputMode="numeric" value={brStartDay} onChange={e => setBrStartDay(e.target.value.replace(/[^0-9]/g, ""))}
                            className="w-[70px] px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} placeholder="1" />
                        </div>
                        <div>
                          <label className="block text-[10px] mb-1" style={{ color: T.textSub }}>終了日</label>
                          <input type="text" inputMode="numeric" value={brEndDay} onChange={e => setBrEndDay(e.target.value.replace(/[^0-9]/g, ""))}
                            className="w-[70px] px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} placeholder="5" />
                        </div>
                      </>)}

                      {brType === "idle_time" && (<>
                        <div>
                          <label className="block text-[10px] mb-1" style={{ color: T.textSub }}>開始時間</label>
                          <input type="time" value={brStartTime} onChange={e => setBrStartTime(e.target.value)}
                            className="px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} />
                        </div>
                        <div>
                          <label className="block text-[10px] mb-1" style={{ color: T.textSub }}>終了時間</label>
                          <input type="time" value={brEndTime} onChange={e => setBrEndTime(e.target.value)}
                            className="px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} />
                        </div>
                      </>)}

                      <div>
                        <label className="block text-[10px] mb-1" style={{ color: T.textSub }}>倍率</label>
                        <select value={brMult} onChange={e => setBrMult(e.target.value)}
                          className="px-3 py-2.5 rounded-xl text-[12px] outline-none cursor-pointer" style={inputStyle}>
                          {["1.5", "2.0", "2.5", "3.0", "5.0"].map(v => <option key={v} value={v}>{v}倍</option>)}
                        </select>
                      </div>

                      <div className="flex-1 min-w-[120px]">
                        <label className="block text-[10px] mb-1" style={{ color: T.textSub }}>ラベル（任意）</label>
                        <input type="text" value={brLabel} onChange={e => setBrLabel(e.target.value)} placeholder="例: 水曜ポイント2倍"
                          className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} />
                      </div>
                    </div>

                    {/* アイドルタイム曜日選択 */}
                    {brType === "idle_time" && (
                      <div className="mb-4">
                        <label className="block text-[10px] mb-2" style={{ color: T.textSub }}>対象曜日</label>
                        <div className="flex gap-2">
                          {WEEKDAY_LABELS.map((l, i) => (
                            <button key={i} onClick={() => setBrWeekdays(prev => prev.includes(i) ? prev.filter(d => d !== i) : [...prev, i])}
                              className="w-[36px] h-[36px] rounded-lg text-[11px] cursor-pointer transition-all"
                              style={{ backgroundColor: brWeekdays.includes(i) ? PT_COLOR + "25" : T.cardAlt, color: brWeekdays.includes(i) ? PT_COLOR : T.textMuted, fontWeight: brWeekdays.includes(i) ? 600 : 400 }}>
                              {l}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <button onClick={handleAddBonusRule} className="px-4 py-2.5 text-white text-[11px] rounded-xl cursor-pointer"
                      style={{ backgroundColor: PT_COLOR }}>追加</button>
                  </div>

                  {/* ルール一覧 */}
                  <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: T.card, borderColor: T.border }}>
                    <div className="px-5 py-3 border-b" style={{ borderColor: T.border }}>
                      <p className="text-[12px] font-medium">登録済みルール</p>
                    </div>
                    {bonusRules.length === 0 ? (
                      <p className="text-[12px] text-center py-8" style={{ color: T.textFaint }}>ボーナスルールが登録されていません</p>
                    ) : (
                      <div className="divide-y" style={{ borderColor: T.border }}>
                        {bonusRules.map(r => (
                          <div key={r.id} className="px-5 py-3 flex items-center justify-between" style={{ borderColor: T.border, opacity: r.is_active ? 1 : 0.5 }}>
                            <div className="flex items-center gap-3">
                              <span className="text-[11px] px-2 py-1 rounded-lg" style={{ backgroundColor: PT_COLOR + "15", color: PT_COLOR }}>{bonusTypeLabel(r.type)}</span>
                              <div>
                                <p className="text-[12px] font-medium">{r.label || bonusRuleDesc(r)}</p>
                                <p className="text-[10px]" style={{ color: T.textMuted }}>{bonusRuleDesc(r)} — ×{r.multiplier}倍</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button onClick={() => toggleBonusRule(r.id, r.is_active)} className="px-2.5 py-1 text-[10px] rounded-lg cursor-pointer"
                                style={{ color: r.is_active ? "#4a7c59" : T.textMuted, backgroundColor: r.is_active ? "#4a7c5918" : T.cardAlt }}>
                                {r.is_active ? "ON" : "OFF"}
                              </button>
                              <button onClick={() => deleteBonusRule(r.id)} className="px-2 py-1 text-[10px] rounded cursor-pointer"
                                style={{ color: "#c45555", backgroundColor: "#c4555518" }}>削除</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── 会員ランク ── */}
              {ptSection === "rank" && (
                <div className="space-y-4">
                  <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: T.card, borderColor: T.border }}>
                    <div className="px-5 py-3 border-b" style={{ borderColor: T.border }}>
                      <p className="text-[12px] font-medium">📈 会員ランク条件・倍率設定</p>
                      <p className="text-[10px] mt-1" style={{ color: T.textMuted }}>条件を満たすと自動的にランクアップします（予約終了時に判定）</p>
                    </div>
                    <div className="divide-y" style={{ borderColor: T.border }}>
                      {rankMultipliers.map(rm => {
                        const icon = rm.rank_name === "platinum" ? "💎" : rm.rank_name === "gold" ? "🥇" : rm.rank_name === "silver" ? "🥈" : "👤";
                        const isNormal = rm.rank_name === "normal";
                        return (
                        <div key={rm.id} className="px-5 py-4">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <span className="text-[20px]">{icon}</span>
                              <span className="text-[13px] font-medium">{RANK_LABELS[rm.rank_name] || rm.rank_name}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[11px]" style={{ color: T.textMuted }}>ポイント ×</span>
                              <select value={Number(rm.multiplier).toFixed(1)} onChange={e => updateRankMult(rm.id, e.target.value)}
                                className="px-3 py-2 rounded-xl text-[12px] outline-none cursor-pointer" style={inputStyle}>
                                {["1.0", "1.2", "1.5", "2.0", "2.5", "3.0"].map(v => <option key={v} value={v}>{v}倍</option>)}
                              </select>
                            </div>
                          </div>
                          {!isNormal && (
                            <div className="flex flex-wrap gap-3 items-end pl-8">
                              <div>
                                <label className="block text-[9px] mb-0.5" style={{ color: T.textMuted }}>直近</label>
                                <div className="flex items-center gap-1">
                                  <select value={String(rm.period_months)} onChange={e => updateRankCondition(rm.id, { period_months: parseInt(e.target.value) })}
                                    className="px-2 py-1.5 rounded-lg text-[11px] outline-none cursor-pointer" style={inputStyle}>
                                    {[1,2,3,6,12].map(v => <option key={v} value={v}>{v}</option>)}
                                  </select>
                                  <span className="text-[10px]" style={{ color: T.textMuted }}>ヶ月間に</span>
                                </div>
                              </div>
                              <div>
                                <label className="block text-[9px] mb-0.5" style={{ color: T.textMuted }}>来店回数</label>
                                <div className="flex items-center gap-1">
                                  <input type="text" inputMode="numeric" value={String(rm.min_visits_in_period)} onChange={e => updateRankCondition(rm.id, { min_visits_in_period: parseInt(e.target.value.replace(/[^0-9]/g, "")) || 0 })}
                                    className="w-[50px] px-2 py-1.5 rounded-lg text-[11px] outline-none text-center" style={inputStyle} />
                                  <span className="text-[10px]" style={{ color: T.textMuted }}>回以上</span>
                                </div>
                              </div>
                              <div className="text-[10px] py-1.5" style={{ color: T.textMuted }}>かつ</div>
                              <div>
                                <label className="block text-[9px] mb-0.5" style={{ color: T.textMuted }}>累計来店</label>
                                <div className="flex items-center gap-1">
                                  <input type="text" inputMode="numeric" value={String(rm.min_total_visits)} onChange={e => updateRankCondition(rm.id, { min_total_visits: parseInt(e.target.value.replace(/[^0-9]/g, "")) || 0 })}
                                    className="w-[60px] px-2 py-1.5 rounded-lg text-[11px] outline-none text-center" style={inputStyle} />
                                  <span className="text-[10px]" style={{ color: T.textMuted }}>回以上</span>
                                </div>
                              </div>
                            </div>
                          )}
                          {isNormal && <p className="text-[10px] pl-8" style={{ color: T.textFaint }}>条件なし（デフォルト）</p>}
                        </div>);
                      })}
                    </div>
                  </div>
                  <div className="rounded-xl p-4 text-[10px]" style={{ backgroundColor: T.cardAlt, color: T.textMuted }}>
                    💡 ランクは上位から判定されます（プラチナ→ゴールド→シルバー→一般）。条件を満たす最上位のランクが自動適用されます。
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ════════════ OTHER TABS — Add Form ════════════ */}
          {tab !== "point" && (
            <div className="rounded-2xl border p-5 mb-6" style={{ backgroundColor: T.card, borderColor: T.border }}>
              <p className="text-[13px] font-medium mb-3">{currentTab.label}を追加</p>
              <div className="flex flex-wrap gap-3 items-end">
                <div className="flex-1 min-w-[140px]">
                  <label className="block text-[10px] mb-1" style={{ color: T.textSub }}>名前 *</label>
                  <input type="text" value={addName} onChange={(e) => setAddName(e.target.value)} placeholder={`${currentTab.label}名`}
                    className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle}
                    onKeyDown={(e) => e.key === "Enter" && handleAdd()} />
                </div>

                {tab === "nomination" && (<>
                  <div className="w-[120px]">
                    <label className="block text-[10px] mb-1" style={{ color: T.textSub }}>料金</label>
                    <input type="text" inputMode="numeric" value={addPrice} onChange={(e) => setAddPrice(e.target.value.replace(/[^0-9]/g, ""))} placeholder="2000"
                      className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} />
                  </div>
                  <div className="w-[120px]">
                    <label className="block text-[10px] mb-1" style={{ color: T.textSub }}>バック</label>
                    <input type="text" inputMode="numeric" value={addBack} onChange={(e) => setAddBack(e.target.value.replace(/[^0-9]/g, ""))} placeholder="1000"
                      className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} />
                  </div>
                </>)}

                {tab === "discount" && (<>
                  <div className="w-[120px]">
                    <label className="block text-[10px] mb-1" style={{ color: T.textSub }}>金額/率</label>
                    <input type="text" inputMode="numeric" value={addAmount} onChange={(e) => setAddAmount(e.target.value.replace(/[^0-9]/g, ""))} placeholder="1000"
                      className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} />
                  </div>
                  <div className="w-[100px]">
                    <label className="block text-[10px] mb-1" style={{ color: T.textSub }}>種別</label>
                    <select value={addDiscountType} onChange={(e) => setAddDiscountType(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none cursor-pointer" style={inputStyle}>
                      <option value="fixed">固定額</option>
                      <option value="percent">%割引</option>
                    </select>
                  </div>
                </>)}

                {tab === "extension" && (<>
                  <div className="w-[90px]">
                    <label className="block text-[10px] mb-1" style={{ color: T.textSub }}>時間(分)</label>
                    <select value={addDuration} onChange={(e) => setAddDuration(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none cursor-pointer" style={inputStyle}>
                      {[10, 15, 20, 30, 40, 50, 60].map((m) => (<option key={m} value={m}>{m}分</option>))}
                    </select>
                  </div>
                  <div className="w-[100px]">
                    <label className="block text-[10px] mb-1" style={{ color: T.textSub }}>料金</label>
                    <input type="text" inputMode="numeric" value={addPrice} onChange={(e) => setAddPrice(e.target.value.replace(/[^0-9]/g, ""))} placeholder="3000"
                      className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} />
                  </div>
                  <div className="w-[100px]">
                    <label className="block text-[10px] mb-1" style={{ color: T.textSub }}>バック</label>
                    <input type="text" inputMode="numeric" value={addBack} onChange={(e) => setAddBack(e.target.value.replace(/[^0-9]/g, ""))} placeholder="1000"
                      className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} />
                  </div>
                </>)}

                {tab === "option" && (<>
                  <div className="w-[100px]">
                    <label className="block text-[10px] mb-1" style={{ color: T.textSub }}>料金</label>
                    <input type="text" inputMode="numeric" value={addPrice} onChange={(e) => setAddPrice(e.target.value.replace(/[^0-9]/g, ""))} placeholder="1000"
                      className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} />
                  </div>
                  <div className="w-[100px]">
                    <label className="block text-[10px] mb-1" style={{ color: T.textSub }}>バック</label>
                    <input type="text" inputMode="numeric" value={addBack} onChange={(e) => setAddBack(e.target.value.replace(/[^0-9]/g, ""))} placeholder="500"
                      className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} />
                  </div>
                </>)}

                <button onClick={handleAdd} disabled={saving} className="px-4 py-2.5 text-white text-[11px] rounded-xl cursor-pointer disabled:opacity-60"
                  style={{ backgroundColor: currentTab.color }}>{saving ? "登録中..." : "追加"}</button>
              </div>
              {/* 割引の追加オプション */}
              {tab === "discount" && (
                <div className="flex items-center gap-2 mt-3 flex-wrap">
                  <button onClick={() => setAddNewcomerOnly(!addNewcomerOnly)} className="px-2.5 py-1.5 rounded-lg text-[10px] cursor-pointer" style={{ backgroundColor: addNewcomerOnly ? "#8b5cf618" : T.cardAlt, color: addNewcomerOnly ? "#8b5cf6" : T.textMuted, border: `1px solid ${addNewcomerOnly ? "#8b5cf6" : T.border}` }}>{addNewcomerOnly ? "🌟 新人のみ" : "新人のみ"}</button>
                  <button onClick={() => setAddWebAvailable(!addWebAvailable)} className="px-2.5 py-1.5 rounded-lg text-[10px] cursor-pointer" style={{ backgroundColor: !addWebAvailable ? "#c4555518" : "#22c55e18", color: !addWebAvailable ? "#c45555" : "#22c55e", border: `1px solid ${!addWebAvailable ? "#c45555" : "#22c55e"}44` }}>{addWebAvailable ? "🌐 ネット予約可" : "🚫 ネット予約不可"}</button>
                  <button onClick={() => setAddCombinable(!addCombinable)} className="px-2.5 py-1.5 rounded-lg text-[10px] cursor-pointer" style={{ backgroundColor: !addCombinable ? "#f59e0b18" : T.cardAlt, color: !addCombinable ? "#f59e0b" : T.textMuted, border: `1px solid ${!addCombinable ? "#f59e0b" : T.border}` }}>{addCombinable ? "併用可" : "⚠ 併用不可"}</button>
                  <input type="date" value={addValidFrom} onChange={(e) => setAddValidFrom(e.target.value)} className="px-2 py-1.5 rounded-lg text-[10px] outline-none border" style={{ backgroundColor: T.cardAlt, borderColor: T.border, color: T.text }} />
                  <span className="text-[10px]" style={{ color: T.textMuted }}>〜</span>
                  <input type="date" value={addValidUntil} onChange={(e) => setAddValidUntil(e.target.value)} className="px-2 py-1.5 rounded-lg text-[10px] outline-none border" style={{ backgroundColor: T.cardAlt, borderColor: T.border, color: T.text }} />
                </div>
              )}
              {msg && <p className="text-[11px] mt-2" style={{ color: msg.includes("失敗") || msg.includes("入力") ? "#c45555" : "#4a7c59" }}>{msg}</p>}
            </div>
          )}

          {/* ════════════ OTHER TABS — List ════════════ */}
          {tab !== "point" && (
            <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: T.card, borderColor: T.border }}>
              {/* 指名 */}
              {tab === "nomination" && (
                nominations.length === 0 ? <p className="text-[12px] text-center py-8" style={{ color: T.textFaint }}>指名が登録されていません</p> : (
                  <table className="w-full text-[12px]">
                    <thead><tr style={{ borderBottom: `1px solid ${T.border}` }}>
                      {["指名名", "料金", "バック", "利益", "操作"].map((h) => (<th key={h} className="py-3 px-4 text-left font-normal text-[11px]" style={{ color: T.textMuted }}>{h}</th>))}
                    </tr></thead>
                    <tbody>{nominations.map((n) => (
                      <tr key={n.id} style={{ borderBottom: `1px solid ${T.border}` }}>
                        {editId === n.id ? (<>
                          <td className="py-2 px-4"><input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="px-2 py-1 rounded text-[12px] outline-none w-full" style={inputStyle} /></td>
                          <td className="py-2 px-4"><input type="text" inputMode="numeric" value={editPrice} onChange={(e) => setEditPrice(e.target.value.replace(/[^0-9]/g, ""))} className="px-2 py-1 rounded text-[12px] outline-none w-20" style={inputStyle} /></td>
                          <td className="py-2 px-4"><input type="text" inputMode="numeric" value={editBack} onChange={(e) => setEditBack(e.target.value.replace(/[^0-9]/g, ""))} className="px-2 py-1 rounded text-[12px] outline-none w-20" style={inputStyle} /></td>
                          <td></td>
                          <td className="py-2 px-4"><div className="flex gap-1"><button onClick={handleUpdate} className="px-2 py-1 text-[10px] rounded cursor-pointer" style={{ color: "#4a7c59", backgroundColor: "#4a7c5918" }}>保存</button><button onClick={resetEdit} className="px-2 py-1 text-[10px] rounded cursor-pointer" style={{ color: T.textMuted }}>取消</button></div></td>
                        </>) : (<>
                          <td className="py-3 px-4 font-medium">{n.name}</td>
                          <td className="py-3 px-4" style={{ color: currentTab.color }}>{fmt(n.price)}</td>
                          <td className="py-3 px-4" style={{ color: "#c3a782" }}>{fmt(n.therapist_back || 0)}</td>
                          <td className="py-3 px-4" style={{ color: "#4a7c59" }}>{fmt(n.price - (n.therapist_back || 0))}</td>
                          <td className="py-3 px-4"><div className="flex gap-1"><button onClick={() => { setEditId(n.id); setEditName(n.name); setEditPrice(String(n.price)); setEditBack(String(n.therapist_back || 0)); }} className="px-2 py-1 text-[10px] rounded cursor-pointer" style={{ color: "#3d6b9f", backgroundColor: "#3d6b9f18" }}>編集</button><button onClick={() => handleDelete(n.id)} className="px-2 py-1 text-[10px] rounded cursor-pointer" style={{ color: "#c45555", backgroundColor: "#c4555518" }}>削除</button></div></td>
                        </>)}
                      </tr>
                    ))}</tbody>
                  </table>
                )
              )}

              {/* 割引 */}
              {tab === "discount" && (
                discounts.length === 0 ? <p className="text-[12px] text-center py-8" style={{ color: T.textFaint }}>割引が登録されていません</p> : (
                  <div className="divide-y" style={{ borderColor: T.border }}>
                    {discounts.map((d) => (
                      <div key={d.id} className="px-4 py-3">
                        {editId === d.id ? (<div className="space-y-3">
                          <div className="flex items-center gap-3 flex-wrap">
                            <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="割引名" className="flex-1 min-w-[150px] px-3 py-2 rounded-xl text-[12px] outline-none" style={inputStyle} />
                            <input type="text" inputMode="numeric" value={editAmount} onChange={(e) => setEditAmount(e.target.value.replace(/[^0-9]/g, ""))} className="w-[100px] px-3 py-2 rounded-xl text-[12px] outline-none" style={inputStyle} />
                            <select value={editDiscountType} onChange={(e) => setEditDiscountType(e.target.value)} className="px-3 py-2 rounded-xl text-[12px] outline-none cursor-pointer" style={inputStyle}><option value="fixed">固定額</option><option value="percent">%</option></select>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <button onClick={() => setEditNewcomerOnly(!editNewcomerOnly)} className="px-2.5 py-1.5 rounded-lg text-[10px] cursor-pointer" style={{ backgroundColor: editNewcomerOnly ? "#8b5cf618" : T.cardAlt, color: editNewcomerOnly ? "#8b5cf6" : T.textMuted, border: `1px solid ${editNewcomerOnly ? "#8b5cf6" : T.border}` }}>{editNewcomerOnly ? "🌟 新人のみ" : "新人のみ"}</button>
                            <button onClick={() => setEditWebAvailable(!editWebAvailable)} className="px-2.5 py-1.5 rounded-lg text-[10px] cursor-pointer" style={{ backgroundColor: !editWebAvailable ? "#c4555518" : "#22c55e18", color: !editWebAvailable ? "#c45555" : "#22c55e", border: `1px solid ${!editWebAvailable ? "#c45555" : "#22c55e"}44` }}>{editWebAvailable ? "🌐 ネット予約可" : "🚫 ネット予約不可"}</button>
                            <button onClick={() => setEditCombinable(!editCombinable)} className="px-2.5 py-1.5 rounded-lg text-[10px] cursor-pointer" style={{ backgroundColor: !editCombinable ? "#f59e0b18" : T.cardAlt, color: !editCombinable ? "#f59e0b" : T.textMuted, border: `1px solid ${!editCombinable ? "#f59e0b" : T.border}` }}>{editCombinable ? "併用可" : "⚠ 併用不可"}</button>
                            <input type="date" value={editValidFrom} onChange={(e) => setEditValidFrom(e.target.value)} className="px-2 py-1.5 rounded-lg text-[10px] outline-none border" style={{ backgroundColor: T.cardAlt, borderColor: T.border, color: T.text }} />
                            <span className="text-[10px]" style={{ color: T.textMuted }}>〜</span>
                            <input type="date" value={editValidUntil} onChange={(e) => setEditValidUntil(e.target.value)} className="px-2 py-1.5 rounded-lg text-[10px] outline-none border" style={{ backgroundColor: T.cardAlt, borderColor: T.border, color: T.text }} />
                          </div>
                          <div className="flex gap-2">
                            <button onClick={handleUpdate} className="px-3 py-1.5 text-[10px] rounded-lg cursor-pointer" style={{ color: "#4a7c59", backgroundColor: "#4a7c5918" }}>保存</button>
                            <button onClick={resetEdit} className="px-3 py-1.5 text-[10px] rounded-lg cursor-pointer" style={{ color: T.textMuted }}>取消</button>
                          </div>
                        </div>) : (<div className="flex items-center justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[12px] font-medium">{d.name}</span>
                              <span className="text-[11px]" style={{ color: currentTab.color }}>{d.type === "percent" ? `${d.amount}%` : fmt(d.amount)}</span>
                              <span className="text-[10px]" style={{ color: T.textMuted }}>{d.type === "percent" ? "%割引" : "固定額"}</span>
                            </div>
                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                              {d.newcomer_only && <span className="text-[8px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "#8b5cf618", color: "#8b5cf6" }}>🌟 新人のみ</span>}
                              {!d.web_available && <span className="text-[8px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "#c4555518", color: "#c45555" }}>🚫 ネット予約不可</span>}
                              {d.web_available && <span className="text-[8px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "#22c55e18", color: "#22c55e" }}>🌐 ネット予約可</span>}
                              {!d.combinable && <span className="text-[8px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "#f59e0b18", color: "#f59e0b" }}>⚠ 併用不可</span>}
                              {(d.valid_from || d.valid_until) && <span className="text-[8px] px-1.5 py-0.5 rounded" style={{ backgroundColor: T.cardAlt, color: T.textMuted }}>📅 {d.valid_from || "?"} 〜 {d.valid_until || "?"}</span>}
                            </div>
                          </div>
                          <div className="flex gap-1 flex-shrink-0">
                            <button onClick={() => { setEditId(d.id); setEditName(d.name); setEditAmount(String(d.amount)); setEditDiscountType(d.type); setEditNewcomerOnly(d.newcomer_only || false); setEditWebAvailable(d.web_available !== false); setEditValidFrom(d.valid_from || ""); setEditValidUntil(d.valid_until || ""); setEditCombinable(d.combinable !== false); }} className="px-2 py-1 text-[10px] rounded cursor-pointer" style={{ color: "#3d6b9f", backgroundColor: "#3d6b9f18" }}>編集</button>
                            <button onClick={() => handleDelete(d.id)} className="px-2 py-1 text-[10px] rounded cursor-pointer" style={{ color: "#c45555", backgroundColor: "#c4555518" }}>削除</button>
                          </div>
                        </div>)}
                      </div>
                    ))}
                  </div>
                )
              )}

              {/* 延長 */}
              {tab === "extension" && (
                extensions.length === 0 ? <p className="text-[12px] text-center py-8" style={{ color: T.textFaint }}>延長が登録されていません</p> : (
                  <table className="w-full text-[12px]">
                    <thead><tr style={{ borderBottom: `1px solid ${T.border}` }}>
                      {["延長名", "時間", "料金", "バック", "利益", "操作"].map((h) => (<th key={h} className="py-3 px-4 text-left font-normal text-[11px]" style={{ color: T.textMuted }}>{h}</th>))}
                    </tr></thead>
                    <tbody>{extensions.map((e) => (
                      <tr key={e.id} style={{ borderBottom: `1px solid ${T.border}` }}>
                        {editId === e.id ? (<>
                          <td className="py-2 px-4"><input type="text" value={editName} onChange={(ev) => setEditName(ev.target.value)} className="px-2 py-1 rounded text-[12px] outline-none w-full" style={inputStyle} /></td>
                          <td className="py-2 px-4"><select value={editDuration} onChange={(ev) => setEditDuration(ev.target.value)} className="px-2 py-1 rounded text-[12px] outline-none cursor-pointer" style={inputStyle}>{[10,15,20,30,40,50,60].map((m) => <option key={m} value={m}>{m}分</option>)}</select></td>
                          <td className="py-2 px-4"><input type="text" inputMode="numeric" value={editPrice} onChange={(ev) => setEditPrice(ev.target.value.replace(/[^0-9]/g, ""))} className="px-2 py-1 rounded text-[12px] outline-none w-20" style={inputStyle} /></td>
                          <td className="py-2 px-4"><input type="text" inputMode="numeric" value={editBack} onChange={(ev) => setEditBack(ev.target.value.replace(/[^0-9]/g, ""))} className="px-2 py-1 rounded text-[12px] outline-none w-20" style={inputStyle} /></td>
                          <td className="py-2 px-4" />
                          <td className="py-2 px-4"><div className="flex gap-1"><button onClick={handleUpdate} className="px-2 py-1 text-[10px] rounded cursor-pointer" style={{ color: "#4a7c59", backgroundColor: "#4a7c5918" }}>保存</button><button onClick={resetEdit} className="px-2 py-1 text-[10px] rounded cursor-pointer" style={{ color: T.textMuted }}>取消</button></div></td>
                        </>) : (<>
                          <td className="py-3 px-4 font-medium">{e.name}</td>
                          <td className="py-3 px-4" style={{ color: T.textSub }}>{e.duration}分</td>
                          <td className="py-3 px-4" style={{ color: currentTab.color }}>{fmt(e.price)}</td>
                          <td className="py-3 px-4" style={{ color: "#7ab88f" }}>{fmt(e.therapist_back)}</td>
                          <td className="py-3 px-4">{fmt(e.price - e.therapist_back)}</td>
                          <td className="py-3 px-4"><div className="flex gap-1"><button onClick={() => { setEditId(e.id); setEditName(e.name); setEditDuration(String(e.duration)); setEditPrice(String(e.price)); setEditBack(String(e.therapist_back)); }} className="px-2 py-1 text-[10px] rounded cursor-pointer" style={{ color: "#3d6b9f", backgroundColor: "#3d6b9f18" }}>編集</button><button onClick={() => handleDelete(e.id)} className="px-2 py-1 text-[10px] rounded cursor-pointer" style={{ color: "#c45555", backgroundColor: "#c4555518" }}>削除</button></div></td>
                        </>)}
                      </tr>
                    ))}</tbody>
                  </table>
                )
              )}

              {/* オプション */}
              {tab === "option" && (
                options.length === 0 ? <p className="text-[12px] text-center py-8" style={{ color: T.textFaint }}>オプションが登録されていません</p> : (
                  <table className="w-full text-[12px]">
                    <thead><tr style={{ borderBottom: `1px solid ${T.border}` }}>
                      {["オプション名", "料金", "バック", "利益", "操作"].map((h) => (<th key={h} className="py-3 px-4 text-left font-normal text-[11px]" style={{ color: T.textMuted }}>{h}</th>))}
                    </tr></thead>
                    <tbody>{options.map((o) => (
                      <tr key={o.id} style={{ borderBottom: `1px solid ${T.border}` }}>
                        {editId === o.id ? (<>
                          <td className="py-2 px-4"><input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="px-2 py-1 rounded text-[12px] outline-none w-full" style={inputStyle} /></td>
                          <td className="py-2 px-4"><input type="text" inputMode="numeric" value={editPrice} onChange={(e) => setEditPrice(e.target.value.replace(/[^0-9]/g, ""))} className="px-2 py-1 rounded text-[12px] outline-none w-20" style={inputStyle} /></td>
                          <td className="py-2 px-4"><input type="text" inputMode="numeric" value={editBack} onChange={(e) => setEditBack(e.target.value.replace(/[^0-9]/g, ""))} className="px-2 py-1 rounded text-[12px] outline-none w-20" style={inputStyle} /></td>
                          <td className="py-2 px-4" />
                          <td className="py-2 px-4"><div className="flex gap-1"><button onClick={handleUpdate} className="px-2 py-1 text-[10px] rounded cursor-pointer" style={{ color: "#4a7c59", backgroundColor: "#4a7c5918" }}>保存</button><button onClick={resetEdit} className="px-2 py-1 text-[10px] rounded cursor-pointer" style={{ color: T.textMuted }}>取消</button></div></td>
                        </>) : (<>
                          <td className="py-3 px-4 font-medium">{o.name}</td>
                          <td className="py-3 px-4" style={{ color: currentTab.color }}>{fmt(o.price)}</td>
                          <td className="py-3 px-4" style={{ color: "#7ab88f" }}>{fmt(o.therapist_back)}</td>
                          <td className="py-3 px-4">{fmt(o.price - o.therapist_back)}</td>
                          <td className="py-3 px-4"><div className="flex gap-1"><button onClick={() => { setEditId(o.id); setEditName(o.name); setEditPrice(String(o.price)); setEditBack(String(o.therapist_back)); }} className="px-2 py-1 text-[10px] rounded cursor-pointer" style={{ color: "#3d6b9f", backgroundColor: "#3d6b9f18" }}>編集</button><button onClick={() => handleDelete(o.id)} className="px-2 py-1 text-[10px] rounded cursor-pointer" style={{ color: "#c45555", backgroundColor: "#c4555518" }}>削除</button></div></td>
                        </>)}
                      </tr>
                    ))}</tbody>
                  </table>
                )
              )}
            </div>
          )}

          {/* ═══ バックレートタブ ═══ */}
          {tab === "backrate" && (
            <div className="animate-[fadeIn_0.3s] space-y-6">
              {/* 新人期間設定 */}
              <div className="rounded-2xl border p-6" style={{ backgroundColor: T.card, borderColor: T.border }}>
                <h3 className="text-[14px] font-medium mb-4">🆕 新人マーク期間</h3>
                <div className="flex items-center gap-3">
                  <span className="text-[12px]" style={{ color: T.textSub }}>入店から</span>
                  <select value={newcomerMonths} onChange={async (e) => { setNewcomerMonths(e.target.value); await supabase.from("store_settings").upsert({ key: "newcomer_duration_months", value: e.target.value }, { onConflict: "key" }); }} className="px-3 py-2 rounded-xl text-[13px] outline-none cursor-pointer" style={inputStyle}>
                    <option value="1">1ヶ月</option><option value="2">2ヶ月</option><option value="3">3ヶ月</option><option value="6">6ヶ月</option>
                  </select>
                  <span className="text-[12px]" style={{ color: T.textSub }}>間は新人マーク表示</span>
                </div>
              </div>

              {/* ルール一覧 */}
              <div className="rounded-2xl border p-6" style={{ backgroundColor: T.card, borderColor: T.border }}>
                <h3 className="text-[14px] font-medium mb-1">📊 バックレート自動計算ルール</h3>
                <p className="text-[11px] mb-5" style={{ color: T.textFaint }}>条件を満たす中で最も高いルールが適用されます</p>
                {brRules.length > 0 && (
                  <div className="space-y-2 mb-5">
                    {brRules.map((r) => (
                      <div key={r.id} className="rounded-xl p-4 flex items-center justify-between" style={{ backgroundColor: T.cardAlt, opacity: r.is_active ? 1 : 0.5 }}>
                        <p className="text-[13px] font-medium">接客 {r.min_sessions}本以上 × 本指名率 {r.min_nomination_rate}%以上 → <span style={{ color: "#8b5cf6" }}>+{r.salary_type === "percent" ? `${r.back_increase}%` : `${r.back_increase.toLocaleString()}円`}UP</span></p>
                        <div className="flex items-center gap-2">
                          <button onClick={async () => { await supabase.from("back_rate_rules").update({ is_active: !r.is_active }).eq("id", r.id); fetchData(); }} className="px-2 py-1 text-[10px] rounded cursor-pointer" style={{ color: r.is_active ? "#4a7c59" : "#888", backgroundColor: r.is_active ? "#4a7c5918" : "#88888818" }}>{r.is_active ? "ON" : "OFF"}</button>
                          <button onClick={async () => { if (confirm("削除しますか？")) { await supabase.from("back_rate_rules").delete().eq("id", r.id); fetchData(); } }} className="px-2 py-1 text-[10px] rounded cursor-pointer" style={{ color: "#c45555", backgroundColor: "#c4555518" }}>削除</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="rounded-xl border p-4" style={{ borderColor: T.border, backgroundColor: T.cardAlt }}>
                  <p className="text-[11px] font-medium mb-3" style={{ color: "#8b5cf6" }}>➕ ルール追加</p>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div><label className="block text-[10px] mb-1" style={{ color: T.textMuted }}>最低接客本数</label><input type="number" value={brAddSessions} onChange={e => setBrAddSessions(e.target.value)} className="w-full px-3 py-2 rounded-lg text-[12px] outline-none" style={{ backgroundColor: T.card, color: T.text, border: `1px solid ${T.border}` }} /></div>
                    <div><label className="block text-[10px] mb-1" style={{ color: T.textMuted }}>本指名率（%以上）</label><input type="number" value={brAddRate} onChange={e => setBrAddRate(e.target.value)} className="w-full px-3 py-2 rounded-lg text-[12px] outline-none" style={{ backgroundColor: T.card, color: T.text, border: `1px solid ${T.border}` }} /></div>
                    <div><label className="block text-[10px] mb-1" style={{ color: T.textMuted }}>バックUP額</label><input type="number" value={brAddIncrease} onChange={e => setBrAddIncrease(e.target.value)} className="w-full px-3 py-2 rounded-lg text-[12px] outline-none" style={{ backgroundColor: T.card, color: T.text, border: `1px solid ${T.border}` }} /></div>
                    <div><label className="block text-[10px] mb-1" style={{ color: T.textMuted }}>タイプ</label><select value={brAddType} onChange={e => setBrAddType(e.target.value)} className="w-full px-3 py-2 rounded-lg text-[12px] outline-none cursor-pointer" style={{ backgroundColor: T.card, color: T.text, border: `1px solid ${T.border}` }}><option value="fixed">〇〇円UP</option><option value="percent">〇〇%UP</option></select></div>
                  </div>
                  {brMsg && <p className="text-[11px] mb-2" style={{ color: brMsg.includes("追加") ? "#4a7c59" : "#c45555" }}>{brMsg}</p>}
                  <button disabled={brSaving} onClick={async () => { setBrSaving(true); setBrMsg(""); const { error } = await supabase.from("back_rate_rules").insert({ min_sessions: parseInt(brAddSessions) || 25, min_nomination_rate: parseInt(brAddRate) || 30, back_increase: parseInt(brAddIncrease) || 500, salary_type: brAddType, sort_order: brRules.length }); setBrSaving(false); if (error) setBrMsg("追加失敗"); else { setBrMsg("追加しました！"); setBrAddSessions("25"); setBrAddRate("30"); setBrAddIncrease("500"); fetchData(); setTimeout(() => setBrMsg(""), 1500); } }} className="px-5 py-2 text-[11px] rounded-xl cursor-pointer text-white disabled:opacity-50" style={{ backgroundColor: "#8b5cf6" }}>{brSaving ? "..." : "追加"}</button>
                </div>
              </div>

              {/* 先月の結果 */}
              <div className="rounded-2xl border p-6" style={{ backgroundColor: T.card, borderColor: T.border }}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-[14px] font-medium">📋 {brLastYM || "先月"}の確定結果</h3>
                  <button onClick={fetchBrData} className="px-3 py-1.5 text-[10px] rounded-lg cursor-pointer" style={{ color: "#8b5cf6", backgroundColor: "#8b5cf618" }}>{brLoading ? "読込中..." : "🔄 更新"}</button>
                </div>
                {brLastMonth.length === 0 ? <p className="text-[12px] text-center py-6" style={{ color: T.textFaint }}>データなし</p> : (
                  <div className="space-y-2">
                    {brLastMonth.map(r => {
                      const brLabel = r.back_increase > 0 ? (r.salary_type === "percent" ? `${r.back_increase}%UP` : `+${r.back_increase.toLocaleString()}円UP`) : "通常";
                      const brColor = r.back_increase >= 1500 ? "#d4a843" : r.back_increase >= 1000 ? "#8b5cf6" : r.back_increase >= 500 ? "#4a7c59" : T.textMuted;
                      return (
                        <div key={r.therapist_id} className="rounded-xl p-3 flex items-center justify-between" style={{ backgroundColor: T.cardAlt }}>
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <span className="text-[13px] font-medium truncate">{r.name}</span>
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-medium flex-shrink-0" style={{ backgroundColor: brColor + "18", color: brColor }}>{brLabel}</span>
                          </div>
                          <div className="flex items-center gap-3 text-[10px] flex-shrink-0" style={{ color: T.textSub }}>
                            <span>{r.sessions}本</span><span>指名{r.nom_rate}%</span><span>出勤{r.work_days}日</span>
                            <span>当欠{r.absences}</span><span>遅刻{r.lates}</span><span>早退{r.early_leaves}</span>
                            <button onClick={() => copyBrLine(r, brLastYM)} className="px-2 py-1 rounded text-[9px] cursor-pointer" style={{ backgroundColor: "#06C75518", color: "#06C755" }}>{brCopiedId === r.therapist_id ? "✓" : "LINE"}</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 今月の現状 */}
              <div className="rounded-2xl border p-6" style={{ backgroundColor: T.card, borderColor: T.border }}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-[14px] font-medium">📈 {brCurrentYM || "今月"}の現状（リアルタイム）</h3>
                  <button onClick={fetchBrData} className="px-3 py-1.5 text-[10px] rounded-lg cursor-pointer" style={{ color: "#8b5cf6", backgroundColor: "#8b5cf618" }}>{brLoading ? "読込中..." : "🔄 更新"}</button>
                </div>
                {brCurrentMonth.length === 0 ? <p className="text-[12px] text-center py-6" style={{ color: T.textFaint }}>データなし</p> : (
                  <div className="space-y-2">
                    {brCurrentMonth.map(r => {
                      const brLabel = r.back_increase > 0 ? (r.salary_type === "percent" ? `${r.back_increase}%UP` : `+${r.back_increase.toLocaleString()}円UP`) : "通常";
                      const brColor = r.back_increase >= 1500 ? "#d4a843" : r.back_increase >= 1000 ? "#8b5cf6" : r.back_increase >= 500 ? "#4a7c59" : T.textMuted;
                      return (
                        <div key={r.therapist_id} className="rounded-xl p-3 flex items-center justify-between" style={{ backgroundColor: T.cardAlt }}>
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <span className="text-[13px] font-medium truncate">{r.name}</span>
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-medium flex-shrink-0" style={{ backgroundColor: brColor + "18", color: brColor }}>{brLabel}</span>
                          </div>
                          <div className="flex items-center gap-3 text-[10px] flex-shrink-0" style={{ color: T.textSub }}>
                            <span>{r.sessions}本</span><span>指名{r.nom_rate}%</span><span>出勤{r.work_days}日</span>
                            <span>当欠{r.absences}</span><span>遅刻{r.lates}</span><span>早退{r.early_leaves}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ════════════ NOTIFY TAB ════════════ */}
          {tab === "notify" && (
            <div className="animate-[fadeIn_0.3s] space-y-6">
              {/* Sub-tabs: 5テンプレート切替 */}
              <div className="flex gap-1.5 flex-wrap">
                {([["customer_url", "👤 概要 当日・翌日"], ["customer_no_url", "👤 概要 明後日以降"], ["customer_detail_url", "📋 詳細 当日・翌日"], ["customer_detail_no_url", "📋 詳細 明後日以降"], ["staff", "💼 セラピスト"]] as [NotifySubTab, string][]).map(([k, l]) => (
                  <button key={k} onClick={() => { setNtSubTab(k); setNtMsg(""); setNtPreview(false); }} className="px-3 py-2 text-[10px] rounded-xl cursor-pointer transition-all whitespace-nowrap"
                    style={{ backgroundColor: ntSubTab === k ? "#3d6b9f18" : T.cardAlt, color: ntSubTab === k ? "#3d6b9f" : T.textMuted, fontWeight: ntSubTab === k ? 600 : 400 }}>
                    {l}
                  </button>
                ))}
              </div>

              {/* テンプレート編集 */}
              <div className="rounded-2xl border p-6" style={{ backgroundColor: T.card, borderColor: T.border }}>
                <h3 className="text-[14px] font-medium mb-1">📝 テンプレート本文</h3>
                <p className="text-[11px] mb-4" style={{ color: T.textFaint }}>
                  {ntSubTab === "staff" ? "セラピストLINEに送る予約確認メッセージ" : ntSubTab === "customer_url" ? "概要通知（近い予約）確認リンク＋場所URL付き" : ntSubTab === "customer_no_url" ? "概要通知（先の予約）確認リンク付き・場所URLなし" : ntSubTab === "customer_detail_url" ? "詳細通知（前日/当日）ルーム・場所URL付き" : "詳細通知（場所未定）ルーム確定前の詳細連絡"}
                </p>

                {/* 変数挿入ボタン */}
                <div className="mb-3">
                  <p className="text-[10px] mb-2" style={{ color: T.textMuted }}>📌 変数を挿入（タップでカーソル位置に挿入）</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(ntSubTab === "staff"
                      ? ["{お客様名}","{日時}","{日付}","{開始時刻}","{終了時刻}","{コース}","{指名}","{割引}","{店舗名}","{金額}","{送信者}","{送信者行}","{お客様リンク}"]
                      : ntSubTab === "customer_detail_url"
                      ? ["{お客様名}","{日時}","{日付}","{開始時刻}","{終了時刻}","{コース}","{指名行}","{割引行}","{セラピスト行}","{店舗名}","{金額}","{場所URL}","{ルーム名}","{ビル名}"]
                      : ntSubTab === "customer_detail_no_url"
                      ? ["{お客様名}","{日時}","{日付}","{開始時刻}","{終了時刻}","{コース}","{指名行}","{割引行}","{セラピスト行}","{店舗名}","{金額}","{ルーム名}","{ビル名}"]
                      : ["{お客様名}","{日時}","{日付}","{開始時刻}","{終了時刻}","{コース}","{指名行}","{割引行}","{セラピスト行}","{店舗名}","{金額}","{場所URL}"]
                    ).map(v => (
                      <button key={v} onClick={() => {
                        const ta = document.getElementById("nt-body") as HTMLTextAreaElement;
                        if (ta) { const s = ta.selectionStart; const e = ta.selectionEnd; const newBody = ntBody.slice(0, s) + v + ntBody.slice(e); setNtBody(newBody); setTimeout(() => { ta.focus(); ta.selectionStart = ta.selectionEnd = s + v.length; }, 0); }
                        else setNtBody(ntBody + v);
                      }} className="px-2 py-1 text-[9px] rounded-lg cursor-pointer" style={{ backgroundColor: "#3d6b9f12", color: "#3d6b9f", border: "1px solid #3d6b9f33" }}>{v}</button>
                    ))}
                  </div>
                </div>

                {/* 変数説明 */}
                <details className="mb-3">
                  <summary className="text-[10px] cursor-pointer" style={{ color: T.textFaint }}>📖 変数の説明を見る</summary>
                  <div className="mt-2 rounded-xl p-3 text-[10px] space-y-1" style={{ backgroundColor: T.cardAlt, color: T.textSub }}>
                    <p><b>{"{お客様名}"}</b> — 顧客名（名前末尾のLや年齢情報は除去）</p>
                    <p><b>{"{日時}"}</b> — 2025年1月15日（水）形式</p>
                    <p><b>{"{日付}"}</b> — 01/15（水）形式</p>
                    <p><b>{"{開始時刻}"}</b> / <b>{"{終了時刻}"}</b> — 12:00 形式</p>
                    <p><b>{"{コース}"}</b> — コース名（延長含む）</p>
                    <p><b>{"{指名}"}</b> — 指名種別　<b>{"{指名行}"}</b> — フリー時は行ごと非表示</p>
                    <p><b>{"{割引}"}</b> — 割引名　<b>{"{割引行}"}</b> — 割引なし時は行ごと非表示</p>
                    <p><b>{"{セラピスト行}"}</b> — フリー時は行ごと非表示</p>
                    <p><b>{"{店舗名}"}</b> — 店舗名　<b>{"{金額}"}</b> — 合計金額</p>
                    <p><b>{"{送信者}"}</b> — 送信者名　<b>{"{送信者行}"}</b> — 未入力時は行ごと非表示</p>
                    <p><b>{"{場所URL}"}</b> — 店舗に応じた場所リンク（下の設定で変更可能）</p>
                    <p><b>{"{ルーム名}"}</b> — 部屋名（部屋割当が設定されている場合）</p>
                    <p><b>{"{ビル名}"}</b> — ビル名（部屋割当が設定されている場合）</p>
                    <p><b>{"{お客様リンク}"}</b> — セラピストマイページのお客様詳細ページURL</p>
                  </div>
                </details>

                <textarea id="nt-body" value={ntBody} onChange={e => setNtBody(e.target.value)} rows={14}
                  className="w-full px-4 py-3 rounded-xl text-[12px] outline-none leading-relaxed resize-none"
                  style={{ backgroundColor: T.cardAlt, color: T.text, border: `1px solid ${T.border}`, fontFamily: "var(--font-mono, monospace)" }} />

                {ntMsg && <p className="text-[11px] mt-2" style={{ color: ntMsg.includes("保存") || ntMsg.includes("リセット") ? "#4a7c59" : "#c45555" }}>{ntMsg}</p>}
                <div className="flex gap-2 mt-3">
                  <button disabled={ntSaving} onClick={async () => {
                    setNtSaving(true); setNtMsg("");
                    const existing = ntTemplates.find(t => t.template_key === ntSubTab);
                    if (existing) {
                      const { error } = await supabase.from("notification_templates").update({ body: ntBody, updated_at: new Date().toISOString() }).eq("id", existing.id);
                      if (error) setNtMsg("保存失敗: " + error.message); else { setNtMsg("✅ 保存しました！"); fetchData(); }
                    } else {
                      const { error } = await supabase.from("notification_templates").insert({ template_key: ntSubTab, body: ntBody });
                      if (error) setNtMsg("保存失敗: " + error.message); else { setNtMsg("✅ 保存しました！"); fetchData(); }
                    }
                    setNtSaving(false); setTimeout(() => setNtMsg(""), 2000);
                  }} className="px-6 py-2.5 text-[11px] rounded-xl cursor-pointer text-white disabled:opacity-50" style={{ backgroundColor: "#3d6b9f" }}>{ntSaving ? "保存中..." : "💾 保存"}</button>
                  <button onClick={() => setNtPreview(!ntPreview)} className="px-4 py-2.5 text-[11px] rounded-xl cursor-pointer" style={{ backgroundColor: ntPreview ? "#d4a84318" : T.cardAlt, color: ntPreview ? "#d4a843" : T.textMuted }}>{ntPreview ? "✕ プレビューを閉じる" : "👁 プレビュー"}</button>
                  <button onClick={() => { const t = ntTemplates.find(t => t.template_key === ntSubTab); if (t) { setNtBody(t.body); setNtMsg("リセットしました"); setTimeout(() => setNtMsg(""), 1500); } }} className="px-4 py-2.5 text-[11px] rounded-xl cursor-pointer" style={{ backgroundColor: T.cardAlt, color: T.textMuted }}>↩ リセット</button>
                </div>
              </div>

              {/* プレビュー */}
              {ntPreview && (
                <div className="rounded-2xl border p-6" style={{ backgroundColor: T.card, borderColor: T.border }}>
                  <h3 className="text-[14px] font-medium mb-3">👁 プレビュー（サンプルデータ）</h3>
                  <div className="rounded-xl p-4 text-[11px] whitespace-pre-wrap leading-relaxed" style={{ backgroundColor: T.cardAlt, color: T.textSub, fontFamily: "var(--font-mono, monospace)" }}>
                    {(() => {
                      let text = ntBody;
                      const sampleVars: Record<string, string> = {
                        "{お客様名}": "田中太郎", "{日時}": "2025年4月10日（木）", "{日付}": "04/10（木）",
                        "{開始時刻}": "13:00", "{終了時刻}": "14:30", "{コース}": "90分コース",
                        "{指名}": "本指名", "{割引}": "新規割引", "{店舗名}": "チョップ豊橋店",
                        "{金額}": "12,000", "{送信者}": "田中", "{セラピスト名}": "花子",
                        "{場所URL}": ntLocToyohashi || "https://example.com/location",
                        "{お客様リンク}": "https://t-manage.vercel.app/mypage/customer?name=田中太郎",
                        "{ルーム名}": "Room A", "{ビル名}": "豊橋ルーム",
                      };
                      text = text.replace(/\{指名行\}/g, "\n指名 : 本指名");
                      text = text.replace(/\{割引行\}/g, "\n割引 : 新規割引");
                      text = text.replace(/\{セラピスト行\}/g, "\n花子セラピスト");
                      text = text.replace(/\{送信者行\}/g, "\n\n送信者 : 田中");
                      for (const [k, v] of Object.entries(sampleVars)) text = text.replaceAll(k, v);
                      return text;
                    })()}
                  </div>
                  <p className="text-[9px] mt-2 text-center" style={{ color: T.textFaint }}>※ サンプルデータでの表示です。実際の送信時は予約データが入ります。</p>
                </div>
              )}

              {/* 場所URL設定 */}
              <div className="rounded-2xl border p-6" style={{ backgroundColor: T.card, borderColor: T.border }}>
                <h3 className="text-[14px] font-medium mb-1">📍 場所URL設定</h3>
                <p className="text-[11px] mb-4" style={{ color: T.textFaint }}>店舗・ビル名に応じて自動切替されるURLです</p>
                <div className="space-y-3">
                  {([["豊橋ルーム", ntLocToyohashi, setNtLocToyohashi, "notify_loc_toyohashi"],
                    ["マイコート", ntLocMycourt, setNtLocMycourt, "notify_loc_mycourt"],
                    ["オアシス等（その他）", ntLocOasis, setNtLocOasis, "notify_loc_oasis"]
                  ] as [string, string, (v: string) => void, string][]).map(([label, val, setter, key]) => (
                    <div key={key}>
                      <label className="block text-[10px] mb-1" style={{ color: T.textMuted }}>🏢 {label}</label>
                      <input type="text" value={val} onChange={e => setter(e.target.value)} onBlur={async () => { await supabase.from("store_settings").upsert({ key, value: val }, { onConflict: "key" }); }}
                        className="w-full px-3 py-2.5 rounded-xl text-[11px] outline-none" style={{ backgroundColor: T.cardAlt, color: T.text, border: `1px solid ${T.border}` }} placeholder="https://..." />
                    </div>
                  ))}
                </div>
                <p className="text-[9px] mt-3" style={{ color: T.textFaint }}>💡 判定: 店舗名に「豊橋」含む→豊橋URL / ビル名に「マイコート」含む→マイコートURL / それ以外→オアシスURL</p>
              </div>

              {/* 地図埋め込み設定 */}
              <div className="rounded-2xl border p-6" style={{ backgroundColor: T.card, borderColor: T.border }}>
                <h3 className="text-[14px] font-medium mb-1">🗺️ 地図埋め込み設定</h3>
                <p className="text-[11px] mb-4" style={{ color: T.textFaint }}>確認ページに表示するGoogleマップの埋め込みURLです。Googleマップ → 共有 → 「地図を埋め込む」からHTMLをコピーし、src=&quot;...&quot; のURL部分だけ貼り付けてください。</p>
                <div className="space-y-3">
                  {([["豊橋ルーム", ntMapToyohashi, setNtMapToyohashi, "notify_map_toyohashi"],
                    ["マイコート", ntMapMycourt, setNtMapMycourt, "notify_map_mycourt"],
                    ["オアシス等（その他）", ntMapOasis, setNtMapOasis, "notify_map_oasis"]
                  ] as [string, string, (v: string) => void, string][]).map(([label, val, setter, key]) => (
                    <div key={key}>
                      <label className="block text-[10px] mb-1" style={{ color: T.textMuted }}>🗺️ {label}</label>
                      <input type="text" value={val} onChange={e => setter(e.target.value)} onBlur={async () => { await supabase.from("store_settings").upsert({ key, value: val }, { onConflict: "key" }); }}
                        className="w-full px-3 py-2.5 rounded-xl text-[10px] outline-none" style={{ backgroundColor: T.cardAlt, color: T.text, border: `1px solid ${T.border}` }} placeholder="https://www.google.com/maps/embed?pb=..." />
                      {val && <div style={{ marginTop: 6, borderRadius: 8, overflow: "hidden" }}><iframe src={val} width="100%" height="120" style={{ border: 0 }} loading="lazy" /></div>}
                    </div>
                  ))}
                </div>
              </div>

              {/* 通知設定 */}
              <div className="rounded-2xl border p-6" style={{ backgroundColor: T.card, borderColor: T.border }}>
                <h3 className="text-[14px] font-medium mb-4">⚙️ 通知設定</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] mb-1" style={{ color: T.textMuted }}>📅 URL付きテンプレートの適用範囲</label>
                    <div className="flex items-center gap-2">
                      <span className="text-[12px]" style={{ color: T.textSub }}>予約日が</span>
                      <select value={ntUrlDays} onChange={async (e) => { setNtUrlDays(e.target.value); await supabase.from("store_settings").upsert({ key: "notify_url_days", value: e.target.value }, { onConflict: "key" }); }}
                        className="px-3 py-2 rounded-xl text-[12px] outline-none cursor-pointer" style={{ backgroundColor: T.cardAlt, color: T.text, border: `1px solid ${T.border}` }}>
                        <option value="0">当日のみ</option><option value="1">明日まで</option><option value="2">明後日まで</option><option value="3">3日後まで</option>
                      </select>
                      <span className="text-[12px]" style={{ color: T.textSub }}>→ URL付きテンプレート</span>
                    </div>
                    <p className="text-[9px] mt-1" style={{ color: T.textFaint }}>それ以降の日付は「URLなし」テンプレートが自動適用されます</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <style jsx global>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  );
}
