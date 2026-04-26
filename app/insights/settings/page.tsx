"use client";

import { useEffect, useState, useCallback } from "react";
import { useTheme } from "../../../lib/theme";
import { useToast } from "../../../lib/toast";
import { useStaffSession } from "../../../lib/staff-session";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Settings = {
  mode_a_enabled: boolean;
  mode_b_enabled: boolean;
  cron_hour: number;
  ai_model: string;
  email_notifications: boolean;
  notification_emails: string[] | null;
  notify_only_on_warnings: boolean;
  use_ga4: boolean;
  use_clarity: boolean;
  use_tmanage_db: boolean;
  monthly_budget_usd: number;
  monthly_spent_usd: number;
};

export default function InsightsSettingsPage() {
  const { T } = useTheme();
  const { show: toast } = useToast();
  const { activeStaff: staff, isManager } = useStaffSession();
  const router = useRouter();

  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [emailsText, setEmailsText] = useState("");

  useEffect(() => {
    if (staff && !isManager) {
      toast("社長・経営責任者のみ設定可能です", "error");
      router.push("/admin/dashboard");
    }
  }, [staff, isManager, router, toast]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/insights/settings").then((r) => r.json());
      setSettings(res.settings);
      setEmailsText((res.settings?.notification_emails || []).join("\n"));
    } catch (e) {
      toast("設定読み込み失敗", "error");
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const emails = emailsText
        .split(/[\n,]/)
        .map((e) => e.trim())
        .filter(Boolean);

      const res = await fetch("/api/insights/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...settings,
          notification_emails: emails,
          updated_by: staff?.name || null,
        }),
      });
      if (!res.ok) throw new Error("保存失敗");
      toast("保存しました", "success");
      await load();
    } catch (e) {
      toast("保存に失敗しました", "error");
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  if (loading || !settings) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: T.bg, color: T.textSub }}>
        読み込み中...
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: T.bg, color: T.text }}>
      <div className="px-4 py-3 sticky top-0 z-10 border-b" style={{ backgroundColor: T.card, borderColor: T.border }}>
        <div className="flex items-center justify-between max-w-3xl mx-auto">
          <Link href="/admin/insights" className="text-sm" style={{ color: T.textSub }}>← 解析画面に戻る</Link>
          <h1 className="text-base font-semibold">⚙ Insights 設定</h1>
        </div>
      </div>

      <div className="max-w-3xl mx-auto p-4 space-y-4">
        {/* モード設定 */}
        <Section title="🔀 分析モード" T={T}>
          <Toggle
            label="Mode A: 手動分析（Maxプラン使用）"
            description="claude.ai に貼り付けて対話形式で分析。月額0円。"
            checked={settings.mode_a_enabled}
            onChange={(v) => setSettings({ ...settings, mode_a_enabled: v })}
            T={T}
          />
          <Toggle
            label="Mode B: 自動分析（Claude API）"
            description="毎朝Vercel Cronで自動レポート生成。月額約550円。"
            checked={settings.mode_b_enabled}
            onChange={(v) => setSettings({ ...settings, mode_b_enabled: v })}
            T={T}
          />
        </Section>

        {/* Mode B 詳細 */}
        {settings.mode_b_enabled && (
          <>
            <Section title="🤖 Mode B 詳細" T={T}>
              <Field label="生成時刻（毎日）" T={T}>
                <select
                  value={settings.cron_hour}
                  onChange={(e) => setSettings({ ...settings, cron_hour: Number(e.target.value) })}
                  className="px-2 py-1 rounded text-sm"
                  style={{ backgroundColor: T.cardAlt, color: T.text, border: `1px solid ${T.border}` }}
                >
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={i} value={i}>{i}時</option>
                  ))}
                </select>
              </Field>
              <Field label="使用モデル" T={T}>
                <select
                  value={settings.ai_model}
                  onChange={(e) => setSettings({ ...settings, ai_model: e.target.value })}
                  className="px-2 py-1 rounded text-sm"
                  style={{ backgroundColor: T.cardAlt, color: T.text, border: `1px solid ${T.border}` }}
                >
                  <option value="claude-sonnet-4-6">Claude Sonnet 4.6（推奨）</option>
                  <option value="claude-opus-4-7">Claude Opus 4.7（高精度・高コスト）</option>
                  <option value="claude-haiku-4-5-20251001">Claude Haiku 4.5（低コスト）</option>
                </select>
              </Field>
              <Field label={`月間予算: $${settings.monthly_budget_usd.toFixed(2)} （今月: $${Number(settings.monthly_spent_usd).toFixed(4)}）`} T={T}>
                <input
                  type="number"
                  step="0.5"
                  value={settings.monthly_budget_usd}
                  onChange={(e) => setSettings({ ...settings, monthly_budget_usd: Number(e.target.value) })}
                  className="px-2 py-1 rounded text-sm w-24"
                  style={{ backgroundColor: T.cardAlt, color: T.text, border: `1px solid ${T.border}` }}
                />
              </Field>
            </Section>

            <Section title="📧 Gmail 通知" T={T}>
              <Toggle
                label="メール通知を有効化"
                checked={settings.email_notifications}
                onChange={(v) => setSettings({ ...settings, email_notifications: v })}
                T={T}
              />
              <Toggle
                label="重大警告がある日のみ通知"
                description="毎日通知ではなく、severity=high の警告がある時だけ送信"
                checked={settings.notify_only_on_warnings}
                onChange={(v) => setSettings({ ...settings, notify_only_on_warnings: v })}
                T={T}
              />
              <Field label="通知先メールアドレス（改行で複数可）" T={T}>
                <textarea
                  value={emailsText}
                  onChange={(e) => setEmailsText(e.target.value)}
                  rows={3}
                  className="w-full px-2 py-1 rounded text-sm"
                  style={{ backgroundColor: T.cardAlt, color: T.text, border: `1px solid ${T.border}` }}
                  placeholder="owner@example.com"
                />
              </Field>
            </Section>
          </>
        )}

        {/* データソース */}
        <Section title="📡 データソース" T={T}>
          <Toggle label="GA4" checked={settings.use_ga4} onChange={(v) => setSettings({ ...settings, use_ga4: v })} T={T} />
          <Toggle label="Microsoft Clarity" checked={settings.use_clarity} onChange={(v) => setSettings({ ...settings, use_clarity: v })} T={T} />
          <Toggle label="T-MANAGE DB" checked={settings.use_tmanage_db} onChange={(v) => setSettings({ ...settings, use_tmanage_db: v })} T={T} />
        </Section>

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full px-4 py-3 rounded-lg font-medium text-sm disabled:opacity-50"
          style={{ backgroundColor: "#c3a782", color: "#fff" }}
        >
          {saving ? "保存中..." : "💾 設定を保存"}
        </button>

        {/* 環境変数の確認説明 */}
        <div className="rounded-lg p-3 text-xs" style={{ backgroundColor: T.cardAlt, color: T.textSub }}>
          <p className="font-semibold mb-1">📌 必要なVercel環境変数</p>
          <ul className="space-y-1">
            <li>• <code>GA4_PROPERTY_ID</code>（GA4プロパティID 例: 14589300799）</li>
            <li>• <code>GA4_SERVICE_ACCOUNT_EMAIL</code>（サービスアカウント email）</li>
            <li>• <code>GA4_SERVICE_ACCOUNT_PRIVATE_KEY</code>（JSON内の private_key）</li>
            <li>• <code>CLARITY_API_TOKEN</code>（Clarity APIトークン）</li>
            <li>• <code>ANTHROPIC_API_KEY</code>（Mode B用、設定済み）</li>
            <li>• <code>CRON_SECRET</code>（Vercel Cron認証用、自動生成）</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

// ─── 子コンポーネント ────────────────────────────

type Theme = ReturnType<typeof useTheme>["T"];

function Section({ title, children, T }: { title: string; children: React.ReactNode; T: Theme }) {
  return (
    <div className="rounded-lg p-4 space-y-2" style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}>
      <h2 className="font-semibold mb-2">{title}</h2>
      {children}
    </div>
  );
}

function Toggle({ label, description, checked, onChange, T }: { label: string; description?: string; checked: boolean; onChange: (v: boolean) => void; T: Theme }) {
  return (
    <label className="flex items-start gap-3 py-1 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1"
      />
      <div className="flex-1">
        <p className="text-sm">{label}</p>
        {description && <p className="text-[11px]" style={{ color: T.textSub }}>{description}</p>}
      </div>
    </label>
  );
}

function Field({ label, children, T }: { label: string; children: React.ReactNode; T: Theme }) {
  return (
    <div className="py-2">
      <p className="text-xs mb-1" style={{ color: T.textSub }}>{label}</p>
      {children}
    </div>
  );
}
