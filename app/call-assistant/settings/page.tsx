"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import { useStaffSession } from "../../../lib/staff-session";
import { useTheme } from "../../../lib/theme";

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
  { value: "sonnet-4-6", label: "Sonnet 4.6（標準）" },
  { value: "opus-4-7", label: "Opus 4.7（最高精度）" },
];

export default function CallAssistantSettingsPage() {
  const router = useRouter();
  const { activeStaff, canAccessCallAssistant } = useStaffSession();
  const { T } = useTheme();

  const [settings, setSettings] = useState<CallAiSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

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

  useEffect(() => {
    if (canAccessCallAssistant) {
      loadSettings();
    }
  }, [canAccessCallAssistant, loadSettings]);

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
  return (
    <div
      className="flex items-start justify-between gap-3 py-3 px-3 rounded-xl cursor-pointer hover:opacity-80"
      style={{
        backgroundColor: emphasize && value ? "rgba(34,197,94,0.08)" : "transparent",
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
      </div>
      <button
        className="relative w-12 h-7 rounded-full transition-colors flex-shrink-0"
        style={{
          backgroundColor: value ? T.accent : T.border,
        }}
        type="button"
      >
        <span
          className="absolute top-1 rounded-full transition-all w-5 h-5"
          style={{
            left: value ? "26px" : "4px",
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
