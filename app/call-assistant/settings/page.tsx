"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import { useStaffSession } from "../../../lib/staff-session";
import { useTheme } from "../../../lib/theme";
import { NavMenu } from "../../../lib/nav-menu";

type CallAiSettings = {
  id: number;

  // 録音対象
  record_new_customer: boolean;
  record_repeat_2_3: boolean;
  record_regular: boolean;
  record_manual_only: boolean;
  record_new_staff: boolean;

  // エスカレーション条件
  escalate_on_claim: boolean;
  escalate_on_long_call: boolean;
  escalate_on_negative: boolean;
  escalate_on_vip: boolean;
  escalate_on_blacklist: boolean;

  // モデル設定
  default_model: string;
  escalation_model: string;

  // 予算制限
  monthly_budget_jpy: number;
  daily_limit_count: number;
  max_duration_sec: number;

  // 保存期間
  retention_days: number;

  // 全体ON/OFF
  enabled: boolean;

  // メタ
  updated_at: string | null;
  updated_by_name: string;
};

const MODEL_OPTIONS = [
  { value: "claude-sonnet-4-6", label: "Claude Sonnet 4.6（標準・推奨）" },
  { value: "claude-opus-4-7", label: "Claude Opus 4.7（最高精度・高コスト）" },
  { value: "claude-opus-4-6", label: "Claude Opus 4.6（旧Opus）" },
  { value: "claude-sonnet-4-5", label: "Claude Sonnet 4.5（旧Sonnet）" },
];

export default function CallAssistantSettingsPage() {
  const router = useRouter();
  const { activeStaff, canAccessCallAssistant } = useStaffSession();
  const { T, dark } = useTheme();

  const [settings, setSettings] = useState<CallAiSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  // 今月の使用量サマリー
  type MonthlyUsage = {
    total_call_count: number;
    total_escalation_count: number;
    total_whisper_seconds: number;
    total_whisper_cost_usd: number;
    total_sonnet_cost_usd: number;
    total_opus_cost_usd: number;
  };
  const [monthlyUsage, setMonthlyUsage] = useState<MonthlyUsage | null>(null);

  // 日次使用量（グラフ用・直近30日）
  type DailyUsage = {
    usage_date: string;
    whisper_cost_usd: number;
    sonnet_cost_usd: number;
    opus_cost_usd: number;
    call_count: number;
    total_cost_usd: number;
  };
  const [dailyUsage, setDailyUsage] = useState<DailyUsage[]>([]);

  // 今月の告知遵守率 (Session 62)
  type ConsentStats = {
    total_count: number;
    notified_count: number;
    not_notified_count: number;
    rate_percent: number;
  };
  const [consentStats, setConsentStats] = useState<ConsentStats | null>(null);

  // アクセス権チェック
  useEffect(() => {
    if (activeStaff === null) return;
    if (!canAccessCallAssistant) {
      router.push("/dashboard");
    }
  }, [activeStaff, canAccessCallAssistant, router]);

  // 設定読み込み
  const loadSettings = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("call_ai_settings")
      .select("*")
      .order("id", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("[settings] load error:", error);
      alert("設定の読み込みに失敗しました: " + error.message);
    } else if (data) {
      setSettings(data as CallAiSettings);
    }
    setLoading(false);
  }, []);

  // 今月の使用量読み込み
  const loadMonthlyUsage = useCallback(async () => {
    // 今月1日〜今日までの範囲
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const monthStart = `${year}-${month}-01`;

    const { data, error } = await supabase
      .from("call_usage_logs")
      .select("*")
      .gte("usage_date", monthStart);

    if (error) {
      console.error("[settings] usage load error:", error);
      return;
    }

    const rows = (data || []) as Array<Record<string, unknown>>;
    const sum: MonthlyUsage = {
      total_call_count: 0,
      total_escalation_count: 0,
      total_whisper_seconds: 0,
      total_whisper_cost_usd: 0,
      total_sonnet_cost_usd: 0,
      total_opus_cost_usd: 0,
    };
    for (const r of rows) {
      sum.total_call_count += Number(r.call_count || 0);
      sum.total_escalation_count += Number(r.escalation_count || 0);
      sum.total_whisper_seconds += Number(r.whisper_seconds || 0);
      sum.total_whisper_cost_usd += Number(r.whisper_cost_usd || 0);
      sum.total_sonnet_cost_usd += Number(r.sonnet_cost_usd || 0);
      sum.total_opus_cost_usd += Number(r.opus_cost_usd || 0);
    }
    setMonthlyUsage(sum);
  }, []);

  // 日次使用量読み込み（直近30日、空の日は 0 で埋める）
  const loadDailyUsage = useCallback(async () => {
    const now = new Date();
    const end = new Date(now);
    const start = new Date(now);
    start.setDate(start.getDate() - 29); // 30日前から今日まで
    const startStr = start.toISOString().split("T")[0];

    const { data, error } = await supabase
      .from("call_usage_logs")
      .select("*")
      .gte("usage_date", startStr)
      .order("usage_date", { ascending: true });

    if (error) {
      console.error("[settings] daily usage load error:", error);
      return;
    }

    // データのある日を Map に
    const byDate = new Map<string, Record<string, unknown>>();
    for (const r of (data || []) as Array<Record<string, unknown>>) {
      byDate.set(String(r.usage_date), r);
    }

    // 30日分の配列を生成（空の日も 0 で埋める）
    const result: DailyUsage[] = [];
    const cursor = new Date(start);
    while (cursor <= end) {
      const dateStr = cursor.toISOString().split("T")[0];
      const row = byDate.get(dateStr);
      const whisper = Number(row?.whisper_cost_usd || 0);
      const sonnet = Number(row?.sonnet_cost_usd || 0);
      const opus = Number(row?.opus_cost_usd || 0);
      result.push({
        usage_date: dateStr,
        whisper_cost_usd: whisper,
        sonnet_cost_usd: sonnet,
        opus_cost_usd: opus,
        call_count: Number(row?.call_count || 0),
        total_cost_usd: whisper + sonnet + opus,
      });
      cursor.setDate(cursor.getDate() + 1);
    }

    setDailyUsage(result);
  }, []);

  // 今月の告知遵守率読み込み (Session 62)
  const loadConsentStats = useCallback(async () => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString()
      .split("T")[0];

    const { data, error } = await supabase
      .from("call_transcripts")
      .select("consent_notified")
      .gte("started_at", firstDay + "T00:00:00+09:00");

    if (error) {
      console.error("[settings] consent stats load error:", error);
      return;
    }

    const rows = (data || []) as Array<{ consent_notified: boolean | null }>;
    const total = rows.length;
    const notified = rows.filter((r) => r.consent_notified === true).length;
    const notNotified = rows.filter(
      (r) => r.consent_notified === false
    ).length;
    const rate = total > 0 ? Math.round((notified / total) * 100) : 0;

    setConsentStats({
      total_count: total,
      notified_count: notified,
      not_notified_count: notNotified,
      rate_percent: rate,
    });
  }, []);

  useEffect(() => {
    if (canAccessCallAssistant) {
      loadSettings();
      loadMonthlyUsage();
      loadDailyUsage();
      loadConsentStats();
    }
  }, [
    canAccessCallAssistant,
    loadSettings,
    loadMonthlyUsage,
    loadDailyUsage,
    loadConsentStats,
  ]);

  // 値の更新ヘルパー
  const updateField = <K extends keyof CallAiSettings>(
    key: K,
    value: CallAiSettings[K]
  ) => {
    if (!settings) return;
    setSettings({ ...settings, [key]: value });
    setDirty(true);
    setSaveMessage("");
  };

  // 保存
  const handleSave = async () => {
    if (!settings || !activeStaff) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("call_ai_settings")
        .update({
          record_new_customer: settings.record_new_customer,
          record_repeat_2_3: settings.record_repeat_2_3,
          record_regular: settings.record_regular,
          record_manual_only: settings.record_manual_only,
          record_new_staff: settings.record_new_staff,
          escalate_on_claim: settings.escalate_on_claim,
          escalate_on_long_call: settings.escalate_on_long_call,
          escalate_on_negative: settings.escalate_on_negative,
          escalate_on_vip: settings.escalate_on_vip,
          escalate_on_blacklist: settings.escalate_on_blacklist,
          default_model: settings.default_model,
          escalation_model: settings.escalation_model,
          monthly_budget_jpy: settings.monthly_budget_jpy,
          daily_limit_count: settings.daily_limit_count,
          max_duration_sec: settings.max_duration_sec,
          retention_days: settings.retention_days,
          enabled: settings.enabled,
          updated_at: new Date().toISOString(),
          updated_by_name: activeStaff.name,
        })
        .eq("id", settings.id);

      if (error) {
        console.error("[settings] save error:", error);
        setSaveMessage("❌ 保存失敗: " + error.message);
      } else {
        setDirty(false);
        setSaveMessage("✅ 保存しました");
        await loadSettings(); // 最新の updated_at を反映
      }
    } catch (e) {
      console.error("[settings] exception:", e);
      setSaveMessage("❌ エラーが発生しました");
    } finally {
      setSaving(false);
    }
  };

  // アクセス権チェック中
  if (activeStaff === null) {
    return (
      <div className="p-8" style={{ color: T.textSub }}>
        読み込み中...
      </div>
    );
  }

  if (!canAccessCallAssistant) {
    return null;
  }

  if (loading || !settings) {
    return (
      <div className="p-8" style={{ color: T.textSub }}>
        設定を読み込み中...
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24" style={{ backgroundColor: T.bg }}>
      <div className="max-w-[900px] mx-auto p-4 md:p-6">
        {/* ヘッダー */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <NavMenu T={T} dark={dark} />
            <div>
              <h1
                className="text-[20px] md:text-[24px] font-medium mb-1"
                style={{ color: T.text }}
              >
                ⚙️ 通話AI 設定
              </h1>
              <p className="text-[11px]" style={{ color: T.textSub }}>
                録音対象・エスカレーション条件・予算などを管理
              </p>
            </div>
          </div>
          <button
            onClick={() => router.push("/call-test")}
            className="text-[11px] px-3 py-2 rounded-xl cursor-pointer"
            style={{ backgroundColor: T.cardAlt, color: T.textSub }}
          >
            ← 通話AIへ戻る
          </button>
        </div>

        {/* === 全体設定 === */}
        <SettingSection title="🎙 全体設定" T={T}>
          <ToggleRow
            label="通話AI機能を有効化"
            description="OFF の場合、録音ボタンを押しても動作しません"
            value={settings.enabled}
            onChange={(v) => updateField("enabled", v)}
            T={T}
            emphasize
          />
          <SelectRow
            label="標準モデル"
            description="通常の分析に使うモデル"
            value={settings.default_model}
            options={MODEL_OPTIONS}
            onChange={(v) => updateField("default_model", v)}
            T={T}
          />
          <SelectRow
            label="エスカレーション先"
            description="クレーム時など高精度が必要な場合に使用"
            value={settings.escalation_model}
            options={MODEL_OPTIONS}
            onChange={(v) => updateField("escalation_model", v)}
            T={T}
          />
        </SettingSection>

        {/* === 録音対象 === */}
        <SettingSection title="📋 録音対象の条件" T={T}>
          <p
            className="text-[11px] mb-3 px-3"
            style={{ color: T.textSub }}
          >
            どんな通話を録音するか。ONにした条件に該当する場合だけ録音されます。
          </p>
          <ToggleRow
            label="新規顧客の通話"
            description="初回のお客様との通話"
            value={settings.record_new_customer}
            onChange={(v) => updateField("record_new_customer", v)}
            T={T}
          />
          <ToggleRow
            label="リピーター（2〜3回目）"
            description="再来のお客様との通話"
            value={settings.record_repeat_2_3}
            onChange={(v) => updateField("record_repeat_2_3", v)}
            T={T}
          />
          <ToggleRow
            label="常連様（4回以上）"
            description="来店歴の多いお客様との通話"
            value={settings.record_regular}
            onChange={(v) => updateField("record_regular", v)}
            T={T}
          />
          <ToggleRow
            label="手動録音ボタン"
            description="スタッフが手動で録音開始した場合"
            value={settings.record_manual_only}
            onChange={(v) => updateField("record_manual_only", v)}
            T={T}
          />
          <ToggleRow
            label="新人スタッフ対応時"
            description="入社3ヶ月以内のスタッフが対応した通話"
            value={settings.record_new_staff}
            onChange={(v) => updateField("record_new_staff", v)}
            T={T}
          />
        </SettingSection>

        {/* === エスカレーション === */}
        <SettingSection title="🚨 Opus エスカレーション条件" T={T}>
          <p
            className="text-[11px] mb-3 px-3"
            style={{ color: T.textSub }}
          >
            以下の条件に該当したら自動で Opus で再分析します（API費用増）。
          </p>
          <ToggleRow
            label="クレームキーワード検知"
            description="「怒」「納得」「困る」などの検出時"
            value={settings.escalate_on_claim}
            onChange={(v) => updateField("escalate_on_claim", v)}
            T={T}
          />
          <ToggleRow
            label="10分以上の通話"
            description="長時間通話は重要な可能性が高い"
            value={settings.escalate_on_long_call}
            onChange={(v) => updateField("escalate_on_long_call", v)}
            T={T}
          />
          <ToggleRow
            label="感情ネガティブ検知"
            description="Sonnetが sentiment=negative と判定した時"
            value={settings.escalate_on_negative}
            onChange={(v) => updateField("escalate_on_negative", v)}
            T={T}
          />
          <ToggleRow
            label="VIP顧客（常時）"
            description="customers.rank=vip のお客様"
            value={settings.escalate_on_vip}
            onChange={(v) => updateField("escalate_on_vip", v)}
            T={T}
          />
          <ToggleRow
            label="ブラックリスト顧客"
            description="customers.rank=banned 等のお客様"
            value={settings.escalate_on_blacklist}
            onChange={(v) => updateField("escalate_on_blacklist", v)}
            T={T}
          />
        </SettingSection>

        {/* === 今月の使用量サマリー === */}
        {monthlyUsage && (() => {
          const totalUsd =
            monthlyUsage.total_whisper_cost_usd +
            monthlyUsage.total_sonnet_cost_usd +
            monthlyUsage.total_opus_cost_usd;
          // 1USD = 155円として概算（相場変動あるが参考値）
          const totalJpy = Math.round(totalUsd * 155);
          const budget = settings.monthly_budget_jpy;
          const percent = budget > 0 ? Math.min(100, (totalJpy / budget) * 100) : 0;
          const isWarning = percent >= 80;
          const isDanger = percent >= 100;

          const barColor = isDanger
            ? "#c45555"
            : isWarning
              ? "#f59e0b"
              : "#22c55e";

          return (
            <div
              className="rounded-2xl p-5 border mb-4"
              style={{ backgroundColor: T.card, borderColor: T.border }}
            >
              <h2
                className="text-[14px] font-medium mb-4 pb-3 border-b"
                style={{ color: T.text, borderColor: T.border }}
              >
                📊 今月の使用量
              </h2>

              {/* 予算進捗バー */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px]" style={{ color: T.textSub }}>
                    月間予算の消化
                  </span>
                  <span
                    className="text-[12px] font-medium"
                    style={{
                      color: isDanger
                        ? "#c45555"
                        : isWarning
                          ? "#f59e0b"
                          : T.text,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    ¥{totalJpy.toLocaleString()} / ¥{budget.toLocaleString()} ({percent.toFixed(1)}%)
                  </span>
                </div>
                <div
                  className="w-full h-2 rounded-full overflow-hidden"
                  style={{ backgroundColor: T.cardAlt }}
                >
                  <div
                    className="h-full transition-all"
                    style={{
                      width: `${percent}%`,
                      backgroundColor: barColor,
                    }}
                  />
                </div>
                {isDanger && (
                  <p
                    className="text-[10px] mt-2"
                    style={{ color: "#c45555" }}
                  >
                    ⚠️ 月間予算を超過しています
                  </p>
                )}
                {isWarning && !isDanger && (
                  <p
                    className="text-[10px] mt-2"
                    style={{ color: "#f59e0b" }}
                  >
                    ⚠️ 月間予算の80%を超えています
                  </p>
                )}
              </div>

              {/* コスト内訳 */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                <div
                  className="p-3 rounded-xl text-center"
                  style={{ backgroundColor: T.cardAlt }}
                >
                  <p className="text-[9px]" style={{ color: T.textMuted }}>
                    Whisper
                  </p>
                  <p
                    className="text-[13px] font-medium mt-1"
                    style={{
                      color: T.text,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    ${monthlyUsage.total_whisper_cost_usd.toFixed(3)}
                  </p>
                  <p className="text-[9px] mt-1" style={{ color: T.textMuted }}>
                    {Math.round(monthlyUsage.total_whisper_seconds / 60)}分
                  </p>
                </div>
                <div
                  className="p-3 rounded-xl text-center"
                  style={{ backgroundColor: T.cardAlt }}
                >
                  <p className="text-[9px]" style={{ color: T.textMuted }}>
                    Sonnet
                  </p>
                  <p
                    className="text-[13px] font-medium mt-1"
                    style={{
                      color: T.text,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    ${monthlyUsage.total_sonnet_cost_usd.toFixed(3)}
                  </p>
                </div>
                <div
                  className="p-3 rounded-xl text-center"
                  style={{ backgroundColor: T.cardAlt }}
                >
                  <p className="text-[9px]" style={{ color: T.textMuted }}>
                    Opus
                  </p>
                  <p
                    className="text-[13px] font-medium mt-1"
                    style={{
                      color: T.text,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    ${monthlyUsage.total_opus_cost_usd.toFixed(3)}
                  </p>
                </div>
              </div>

              {/* 件数 */}
              <div className="grid grid-cols-2 gap-2">
                <div
                  className="p-3 rounded-xl text-center"
                  style={{ backgroundColor: T.cardAlt }}
                >
                  <p className="text-[9px]" style={{ color: T.textMuted }}>
                    通話件数
                  </p>
                  <p
                    className="text-[16px] font-medium mt-1"
                    style={{
                      color: T.text,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {monthlyUsage.total_call_count}
                  </p>
                </div>
                <div
                  className="p-3 rounded-xl text-center"
                  style={{ backgroundColor: T.cardAlt }}
                >
                  <p className="text-[9px]" style={{ color: T.textMuted }}>
                    Opusエスカレ
                  </p>
                  <p
                    className="text-[16px] font-medium mt-1"
                    style={{
                      color: T.text,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {monthlyUsage.total_escalation_count}
                  </p>
                </div>
              </div>

              <p
                className="text-[9px] mt-3 text-center"
                style={{ color: T.textMuted }}
              >
                ※ ¥換算は1USD=155円で概算
              </p>
            </div>
          );
        })()}

        {/* === 告知遵守率 (Session 62) === */}
        {consentStats && consentStats.total_count > 0 && (() => {
          const rate = consentStats.rate_percent;
          const rateColor =
            rate >= 95
              ? "#22c55e"
              : rate >= 80
              ? "#b38419"
              : "#c45555";
          const emoji =
            rate >= 95 ? "🟢" : rate >= 80 ? "🟡" : "🔴";
          return (
            <div
              className="rounded-2xl p-4 md:p-5 border mb-4"
              style={{ backgroundColor: T.card, borderColor: T.border }}
            >
              <h2
                className="text-[14px] font-medium mb-3"
                style={{ color: T.text }}
              >
                📢 今月の告知遵守率
              </h2>
              <div className="flex items-center gap-4 mb-3">
                <div className="flex-1">
                  <div
                    className="h-3 rounded-full overflow-hidden"
                    style={{ backgroundColor: T.cardAlt }}
                  >
                    <div
                      className="h-full transition-all"
                      style={{
                        width: `${rate}%`,
                        backgroundColor: rateColor,
                      }}
                    />
                  </div>
                </div>
                <div
                  className="text-[28px] font-medium flex-shrink-0"
                  style={{
                    color: rateColor,
                    fontVariantNumeric: "tabular-nums",
                    lineHeight: 1,
                  }}
                >
                  {emoji} {rate}%
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div
                  className="p-2 rounded-lg text-center"
                  style={{ backgroundColor: T.cardAlt }}
                >
                  <p className="text-[9px]" style={{ color: T.textMuted }}>
                    録音件数
                  </p>
                  <p
                    className="text-[14px] font-medium mt-0.5"
                    style={{
                      color: T.text,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {consentStats.total_count}
                  </p>
                </div>
                <div
                  className="p-2 rounded-lg text-center"
                  style={{ backgroundColor: "#22c55e10" }}
                >
                  <p className="text-[9px]" style={{ color: T.textMuted }}>
                    告知済
                  </p>
                  <p
                    className="text-[14px] font-medium mt-0.5"
                    style={{
                      color: "#22c55e",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {consentStats.notified_count}
                  </p>
                </div>
                <div
                  className="p-2 rounded-lg text-center"
                  style={{ backgroundColor: "#c4555510" }}
                >
                  <p className="text-[9px]" style={{ color: T.textMuted }}>
                    告知なし
                  </p>
                  <p
                    className="text-[14px] font-medium mt-0.5"
                    style={{
                      color: "#c45555",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {consentStats.not_notified_count}
                  </p>
                </div>
              </div>
              <p
                className="text-[10px] mt-3"
                style={{ color: T.textSub, lineHeight: 1.6 }}
              >
                {rate >= 95
                  ? "✅ しっかり告知できています。この調子で運用してください。"
                  : rate >= 80
                  ? "⚠ 告知忘れが散見されます。スタッフに再徹底しましょう。"
                  : "🚨 告知遵守率が低いです。トラブル防止のため、早急に改善が必要です。"}
              </p>
            </div>
          );
        })()}

        {/* === 日次使用量グラフ === */}
        {dailyUsage.length > 0 && (() => {
          const maxCost = Math.max(
            0.01,
            ...dailyUsage.map((d) => d.total_cost_usd)
          );
          const chartHeight = 140;
          const today = new Date().toISOString().split("T")[0];

          return (
            <div
              className="rounded-2xl p-5 border mb-4"
              style={{ backgroundColor: T.card, borderColor: T.border }}
            >
              <h2
                className="text-[14px] font-medium mb-4 pb-3 border-b flex items-center justify-between"
                style={{ color: T.text, borderColor: T.border }}
              >
                <span>📈 日次使用量（直近30日）</span>
                <span className="text-[10px] font-normal" style={{ color: T.textMuted }}>
                  積み上げ: Whisper + Sonnet + Opus
                </span>
              </h2>

              {/* SVG バーチャート */}
              <div className="overflow-x-auto">
                <svg
                  width="100%"
                  height={chartHeight + 40}
                  viewBox={`0 0 ${dailyUsage.length * 24} ${chartHeight + 40}`}
                  preserveAspectRatio="none"
                  style={{ minWidth: `${dailyUsage.length * 16}px` }}
                >
                  {/* Y軸の目盛線（4段階） */}
                  {[0.25, 0.5, 0.75, 1].map((ratio) => (
                    <line
                      key={ratio}
                      x1={0}
                      x2={dailyUsage.length * 24}
                      y1={chartHeight - chartHeight * ratio}
                      y2={chartHeight - chartHeight * ratio}
                      stroke={T.border}
                      strokeDasharray="2,2"
                      strokeWidth={1}
                    />
                  ))}

                  {/* バー */}
                  {dailyUsage.map((d, i) => {
                    const totalRatio = d.total_cost_usd / maxCost;
                    const totalH = totalRatio * chartHeight;
                    // 積み上げ順: Whisper (下) → Sonnet → Opus (上)
                    const whisperH = (d.whisper_cost_usd / maxCost) * chartHeight;
                    const sonnetH = (d.sonnet_cost_usd / maxCost) * chartHeight;
                    const opusH = (d.opus_cost_usd / maxCost) * chartHeight;
                    const x = i * 24 + 4;
                    const barW = 16;
                    const isToday = d.usage_date === today;
                    const isWeekend = (() => {
                      const wd = new Date(d.usage_date).getDay();
                      return wd === 0 || wd === 6;
                    })();

                    return (
                      <g key={d.usage_date}>
                        {/* 週末はうっすら背景 */}
                        {isWeekend && (
                          <rect
                            x={x - 2}
                            y={0}
                            width={barW + 4}
                            height={chartHeight}
                            fill={T.cardAlt}
                            opacity={0.5}
                          />
                        )}
                        {/* Whisper (水色) */}
                        {whisperH > 0 && (
                          <rect
                            x={x}
                            y={chartHeight - whisperH}
                            width={barW}
                            height={whisperH}
                            fill="#4a7ca0"
                          >
                            <title>
                              {d.usage_date} Whisper: ${d.whisper_cost_usd.toFixed(4)}
                            </title>
                          </rect>
                        )}
                        {/* Sonnet (ベージュ) */}
                        {sonnetH > 0 && (
                          <rect
                            x={x}
                            y={chartHeight - whisperH - sonnetH}
                            width={barW}
                            height={sonnetH}
                            fill="#c3a782"
                          >
                            <title>
                              {d.usage_date} Sonnet: ${d.sonnet_cost_usd.toFixed(4)}
                            </title>
                          </rect>
                        )}
                        {/* Opus (ピンク) */}
                        {opusH > 0 && (
                          <rect
                            x={x}
                            y={chartHeight - whisperH - sonnetH - opusH}
                            width={barW}
                            height={opusH}
                            fill="#d4687e"
                          >
                            <title>
                              {d.usage_date} Opus: ${d.opus_cost_usd.toFixed(4)}
                            </title>
                          </rect>
                        )}
                        {/* 今日マーカー */}
                        {isToday && (
                          <rect
                            x={x - 1}
                            y={chartHeight - totalH - 3}
                            width={barW + 2}
                            height={2}
                            fill={T.accent}
                          />
                        )}
                        {/* 日付ラベル (5日ごと + 今日) */}
                        {(i % 5 === 0 || isToday) && (
                          <text
                            x={x + barW / 2}
                            y={chartHeight + 14}
                            textAnchor="middle"
                            fontSize="9"
                            fill={isToday ? T.accent : T.textMuted}
                            fontWeight={isToday ? "bold" : "normal"}
                          >
                            {d.usage_date.slice(5)}
                          </text>
                        )}
                        {/* 件数ラベル (バーの上、0以外) */}
                        {d.call_count > 0 && (
                          <text
                            x={x + barW / 2}
                            y={chartHeight - totalH - 6}
                            textAnchor="middle"
                            fontSize="8"
                            fill={T.textMuted}
                          >
                            {d.call_count}
                          </text>
                        )}
                      </g>
                    );
                  })}
                </svg>
              </div>

              {/* 凡例 */}
              <div className="flex items-center gap-4 justify-center mt-3 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <span
                    className="w-3 h-3 rounded-sm"
                    style={{ backgroundColor: "#4a7ca0" }}
                  />
                  <span className="text-[10px]" style={{ color: T.textSub }}>
                    Whisper
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span
                    className="w-3 h-3 rounded-sm"
                    style={{ backgroundColor: "#c3a782" }}
                  />
                  <span className="text-[10px]" style={{ color: T.textSub }}>
                    Sonnet
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span
                    className="w-3 h-3 rounded-sm"
                    style={{ backgroundColor: "#d4687e" }}
                  />
                  <span className="text-[10px]" style={{ color: T.textSub }}>
                    Opus
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span
                    className="text-[10px]"
                    style={{ color: T.textMuted }}
                  >
                    バー上の数字 = 件数
                  </span>
                </div>
              </div>
              <p
                className="text-[9px] mt-2 text-center"
                style={{ color: T.textMuted }}
              >
                💡 バーにホバーすると各カテゴリの詳細コストが表示されます
              </p>
            </div>
          );
        })()}

        {/* === 予算・制限 === */}
        <SettingSection title="💰 予算・使用量制限" T={T}>
          <NumberRow
            label="月間予算上限"
            description="想定超過時に警告を表示（OpenAI + Anthropic 合計）"
            value={settings.monthly_budget_jpy}
            unit="円"
            min={500}
            max={100000}
            step={500}
            onChange={(v) => updateField("monthly_budget_jpy", v)}
            T={T}
          />
          <NumberRow
            label="1日の録音件数上限"
            description="これを超えたら録音をブロック"
            value={settings.daily_limit_count}
            unit="件"
            min={10}
            max={500}
            step={10}
            onChange={(v) => updateField("daily_limit_count", v)}
            T={T}
          />
          <NumberRow
            label="1通話の最大録音時間"
            description="長時間通話の上限（Whisper API のコスト制御）"
            value={settings.max_duration_sec}
            unit="秒"
            min={60}
            max={3600}
            step={30}
            onChange={(v) => updateField("max_duration_sec", v)}
            T={T}
            hint={`= ${Math.floor(settings.max_duration_sec / 60)}分${settings.max_duration_sec % 60}秒`}
          />
        </SettingSection>

        {/* === データ保持 === */}
        <SettingSection title="🗄 データ保持設定" T={T}>
          <NumberRow
            label="テキスト保存期間"
            description="保存期間を過ぎた文字起こしは自動削除（音声は元々保存していません）"
            value={settings.retention_days}
            unit="日"
            min={7}
            max={365}
            step={7}
            onChange={(v) => updateField("retention_days", v)}
            T={T}
          />
        </SettingSection>

        {/* === 同意・セリフ設定 === */}
        <ConsentScriptsSection T={T} updatedByName={activeStaff?.name || ""} />

        {/* 最終更新情報 */}
        {settings.updated_at && (
          <div
            className="mt-6 p-3 rounded-xl text-[10px]"
            style={{
              backgroundColor: T.cardAlt,
              color: T.textMuted,
            }}
          >
            最終更新: {new Date(settings.updated_at).toLocaleString("ja-JP")}
            {settings.updated_by_name && ` by ${settings.updated_by_name}`}
          </div>
        )}
      </div>

      {/* 固定保存バー */}
      <div
        className="fixed bottom-0 left-0 right-0 border-t p-4 z-50"
        style={{
          backgroundColor: T.card,
          borderColor: T.border,
          backdropFilter: "blur(8px)",
        }}
      >
        <div className="max-w-[900px] mx-auto flex items-center justify-between gap-3">
          <div className="flex-1">
            {saveMessage && (
              <p
                className="text-[12px]"
                style={{
                  color: saveMessage.startsWith("✅") ? "#22c55e" : "#c45555",
                }}
              >
                {saveMessage}
              </p>
            )}
            {!saveMessage && dirty && (
              <p className="text-[11px]" style={{ color: T.textSub }}>
                未保存の変更があります
              </p>
            )}
          </div>
          <button
            onClick={handleSave}
            disabled={!dirty || saving}
            className="px-6 py-2.5 rounded-xl text-[13px] font-medium cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              backgroundColor: T.accent,
              color: "#ffffff",
            }}
          >
            {saving ? "保存中..." : "💾 保存する"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ======================================================
// 下請けコンポーネント
// ======================================================

type ThemeColors = {
  bg: string;
  card: string;
  cardAlt: string;
  border: string;
  text: string;
  textSub: string;
  textMuted: string;
  accent: string;
};

function SettingSection({
  title,
  children,
  T,
}: {
  title: string;
  children: React.ReactNode;
  T: ThemeColors;
}) {
  return (
    <div
      className="rounded-2xl p-4 md:p-5 border mb-4"
      style={{ backgroundColor: T.card, borderColor: T.border }}
    >
      <h2
        className="text-[14px] font-medium mb-4 pb-3 border-b"
        style={{ color: T.text, borderColor: T.border }}
      >
        {title}
      </h2>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function ToggleRow({
  label,
  description,
  value,
  onChange,
  T,
  emphasize = false,
}: {
  label: string;
  description?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  T: ThemeColors;
  emphasize?: boolean;
}) {
  // emphasize=true (全体ON/OFFなど) は色を明確に分けて視認性を優先
  const toggleBg = emphasize
    ? value
      ? "#22c55e" // ON: 明確な緑
      : "#b4b2a9" // OFF: 明確なグレー（T.textMutedより濃い）
    : value
      ? T.accent // 通常: ベージュ
      : T.border;

  // emphasize は少し大きめで、ボーダーも付けて目立たせる
  const toggleSize = emphasize ? "w-14 h-8" : "w-12 h-7";
  const knobSize = emphasize ? "w-6 h-6" : "w-5 h-5";
  const knobLeft = emphasize
    ? value
      ? "28px"
      : "4px"
    : value
      ? "26px"
      : "4px";

  return (
    <div
      className="flex items-start justify-between gap-3 py-3 px-3 rounded-xl cursor-pointer hover:opacity-80"
      style={{
        backgroundColor: emphasize
          ? value
            ? "rgba(34,197,94,0.08)"
            : "rgba(180,178,169,0.12)"
          : "transparent",
      }}
      onClick={() => onChange(!value)}
    >
      <div className="flex-1">
        <p
          className="text-[13px] font-medium"
          style={{ color: T.text }}
        >
          {label}
        </p>
        {description && (
          <p className="text-[10px] mt-0.5" style={{ color: T.textSub }}>
            {description}
          </p>
        )}
        {emphasize && (
          <p
            className="text-[11px] mt-2 font-medium"
            style={{ color: value ? "#22c55e" : "#888780" }}
          >
            現在: {value ? "🟢 有効" : "⚪ 無効"}
          </p>
        )}
      </div>
      <button
        className={`relative ${toggleSize} rounded-full transition-colors flex-shrink-0 shadow-inner`}
        style={{
          backgroundColor: toggleBg,
          border: emphasize ? "2px solid rgba(0,0,0,0.05)" : "none",
        }}
        type="button"
      >
        <span
          className={`absolute top-1 rounded-full transition-all ${knobSize} shadow-sm`}
          style={{
            left: knobLeft,
            backgroundColor: "#ffffff",
          }}
        />
      </button>
    </div>
  );
}

function SelectRow({
  label,
  description,
  value,
  options,
  onChange,
  T,
}: {
  label: string;
  description?: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  T: ThemeColors;
}) {
  return (
    <div className="py-3 px-3">
      <p className="text-[13px] font-medium mb-0.5" style={{ color: T.text }}>
        {label}
      </p>
      {description && (
        <p className="text-[10px] mb-2" style={{ color: T.textSub }}>
          {description}
        </p>
      )}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-xl text-[12px] border cursor-pointer"
        style={{
          backgroundColor: T.cardAlt,
          color: T.text,
          borderColor: T.border,
        }}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function NumberRow({
  label,
  description,
  value,
  unit,
  min,
  max,
  step,
  onChange,
  T,
  hint,
}: {
  label: string;
  description?: string;
  value: number;
  unit: string;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  T: ThemeColors;
  hint?: string;
}) {
  return (
    <div className="py-3 px-3">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex-1">
          <p
            className="text-[13px] font-medium"
            style={{ color: T.text }}
          >
            {label}
          </p>
          {description && (
            <p className="text-[10px] mt-0.5" style={{ color: T.textSub }}>
              {description}
            </p>
          )}
        </div>
        <div
          className="text-[14px] font-medium flex-shrink-0"
          style={{
            color: T.text,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {value.toLocaleString()}
          <span
            className="text-[10px] ml-1"
            style={{ color: T.textSub }}
          >
            {unit}
          </span>
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full cursor-pointer"
        style={{ accentColor: T.accent }}
      />
      <div
        className="flex justify-between text-[9px] mt-1"
        style={{ color: T.textMuted }}
      >
        <span>{min.toLocaleString()}{unit}</span>
        {hint && <span style={{ color: T.textSub }}>{hint}</span>}
        <span>{max.toLocaleString()}{unit}</span>
      </div>
    </div>
  );
}

// ========================================
// 同意セリフ設定セクション（独立保存）
// ========================================

type ConsentScript = {
  id: number;
  script_key: string;
  title: string;
  description: string;
  script_text: string;
  customer_type: string;
  sort_order: number;
  is_active: boolean;
};

function ConsentScriptsSection({
  T,
  updatedByName,
}: {
  T: ThemeColors;
  updatedByName: string;
}) {
  const [scripts, setScripts] = useState<ConsentScript[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Record<number, boolean>>({});
  const [editValues, setEditValues] = useState<Record<number, string>>({});
  const [savedMessage, setSavedMessage] = useState<Record<number, string>>({});

  const loadScripts = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("call_consent_scripts")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });
    if (!error && data) {
      setScripts(data);
      const initial: Record<number, string> = {};
      data.forEach((s: ConsentScript) => {
        initial[s.id] = s.script_text;
      });
      setEditValues(initial);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadScripts();
  }, [loadScripts]);

  const handleSave = async (script: ConsentScript) => {
    const newText = editValues[script.id];
    if (!newText || newText.trim() === "") {
      setSavedMessage((prev) => ({ ...prev, [script.id]: "❌ 空にできません" }));
      return;
    }
    if (newText === script.script_text) {
      return; // 変更なし
    }
    setSaving((prev) => ({ ...prev, [script.id]: true }));
    const { error } = await supabase
      .from("call_consent_scripts")
      .update({
        script_text: newText.trim(),
        updated_at: new Date().toISOString(),
        updated_by_name: updatedByName,
      })
      .eq("id", script.id);

    if (error) {
      setSavedMessage((prev) => ({
        ...prev,
        [script.id]: `❌ ${error.message}`,
      }));
    } else {
      setSavedMessage((prev) => ({ ...prev, [script.id]: "✅ 保存しました" }));
      await loadScripts();
      setTimeout(() => {
        setSavedMessage((prev) => {
          const next = { ...prev };
          delete next[script.id];
          return next;
        });
      }, 2500);
    }
    setSaving((prev) => ({ ...prev, [script.id]: false }));
  };

  const handleReset = (script: ConsentScript) => {
    setEditValues((prev) => ({ ...prev, [script.id]: script.script_text }));
    setSavedMessage((prev) => {
      const next = { ...prev };
      delete next[script.id];
      return next;
    });
  };

  const customerTypeLabel = (type: string) => {
    switch (type) {
      case "new":
        return { label: "🆕 新規", color: "#c96b83" };
      case "repeat":
        return { label: "🔁 リピーター", color: "#4a7c59" };
      case "vip":
        return { label: "⭐ VIP", color: "#b38419" };
      case "caution":
        return { label: "⚠ 要注意", color: "#c45555" };
      case "all":
      default:
        return { label: "全般", color: "#888780" };
    }
  };

  return (
    <SettingSection title="💬 同意・セリフ設定" T={T}>
      <p
        className="text-[11px] mb-4 p-3 rounded-xl"
        style={{
          color: T.textSub,
          backgroundColor: T.cardAlt,
        }}
      >
        録音開始時にスタッフがお客様にお伝えするセリフです。
        録音ボタン押下時やCTI着信時にポップアップで表示されます。
        状況に応じて編集してください。
      </p>

      {loading && (
        <p
          className="text-[11px] py-4 text-center"
          style={{ color: T.textMuted }}
        >
          読み込み中...
        </p>
      )}

      {!loading && scripts.length === 0 && (
        <p
          className="text-[11px] py-4 text-center"
          style={{ color: T.textMuted }}
        >
          セリフが登録されていません。session62_call_consent.sql を実行してください。
        </p>
      )}

      <div className="space-y-4">
        {scripts.map((script) => {
          const typeInfo = customerTypeLabel(script.customer_type);
          const currentValue = editValues[script.id] ?? script.script_text;
          const isDirty = currentValue !== script.script_text;
          const msg = savedMessage[script.id];
          return (
            <div
              key={script.id}
              className="p-4 rounded-xl border"
              style={{
                backgroundColor: T.cardAlt,
                borderColor: isDirty ? T.accent : T.border,
              }}
            >
              {/* ヘッダー */}
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span
                  className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                  style={{
                    backgroundColor: typeInfo.color + "22",
                    color: typeInfo.color,
                  }}
                >
                  {typeInfo.label}
                </span>
                <h4
                  className="text-[13px] font-medium"
                  style={{ color: T.text }}
                >
                  {script.title}
                </h4>
              </div>

              {/* 説明 */}
              {script.description && (
                <p
                  className="text-[10px] mb-2"
                  style={{ color: T.textSub }}
                >
                  {script.description}
                </p>
              )}

              {/* 編集エリア */}
              <textarea
                value={currentValue}
                onChange={(e) =>
                  setEditValues((prev) => ({
                    ...prev,
                    [script.id]: e.target.value,
                  }))
                }
                rows={3}
                className="w-full px-3 py-2 rounded-lg text-[12px] border resize-y"
                style={{
                  backgroundColor: T.card,
                  borderColor: T.border,
                  color: T.text,
                  fontFamily: "inherit",
                  lineHeight: 1.6,
                }}
                placeholder="セリフを入力..."
              />

              {/* アクション */}
              <div className="flex items-center justify-between mt-2 gap-2 flex-wrap">
                <div className="text-[10px]" style={{ color: T.textMuted }}>
                  {currentValue.length} 文字
                  {msg && (
                    <span
                      className="ml-3 font-medium"
                      style={{
                        color: msg.startsWith("✅") ? "#22c55e" : "#c45555",
                      }}
                    >
                      {msg}
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  {isDirty && (
                    <button
                      onClick={() => handleReset(script)}
                      className="px-3 py-1.5 rounded-lg text-[11px] border cursor-pointer"
                      style={{
                        backgroundColor: T.card,
                        color: T.textSub,
                        borderColor: T.border,
                      }}
                    >
                      元に戻す
                    </button>
                  )}
                  <button
                    onClick={() => handleSave(script)}
                    disabled={!isDirty || saving[script.id]}
                    className="px-4 py-1.5 rounded-lg text-[11px] font-medium cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{
                      backgroundColor: isDirty ? T.accent : T.cardAlt,
                      color: isDirty ? "#ffffff" : T.textMuted,
                      border: isDirty ? "none" : `1px solid ${T.border}`,
                    }}
                  >
                    {saving[script.id] ? "保存中..." : "💾 保存"}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </SettingSection>
  );
}
