"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "../../../../lib/theme";
import { TeraAdminShell } from "../../TeraAdminNav";
import { MODULE_LABELS, type ModuleKey } from "../../../../lib/tera-admin-mock";

type WizardStep = "corporation" | "basic" | "branding" | "modules" | "settings" | "confirm";

const STEPS: { key: WizardStep; label: string; icon: string }[] = [
  { key: "corporation", label: "法人情報", icon: "🏢" },
  { key: "basic", label: "基本情報", icon: "📝" },
  { key: "branding", label: "ブランディング", icon: "🎨" },
  { key: "modules", label: "モジュール選択", icon: "🧩" },
  { key: "settings", label: "独自設定", icon: "⚙️" },
  { key: "confirm", label: "確認・発行", icon: "🚀" },
];

export default function NewInstanceWizard() {
  const { T } = useTheme();
  const router = useRouter();
  const [step, setStep] = useState<WizardStep>("corporation");

  // フォーム状態
  const [form, setForm] = useState({
    // 法人情報
    corporation_name: "",
    fiscal_month: 3,
    representative_name: "",
    tax_accountant_name: "江坂瑠衣",
    // 基本情報
    name: "",
    name_en: "",
    shop_type: "メンズエステ",
    subdomain: "",
    custom_domain: "",
    concept: "",
    plan: "full" as "light" | "standard" | "full",
    operation_type: "external" as "self" | "external",
    go_live_date: "",
    contract_type: "free" as "paid" | "free" | "trial",
    // ブランディング
    theme_color_primary: "#c3a782",
    theme_color_accent: "#8b7355",
    logo_url: "",
    // モジュール
    modules: {
      hp: true, external_hp: false, customer_mypage: true, ai_video: false,
      point_management: true, mail_marketing: true, tax: true, cti: true,
      iot_integration: false, chrome_extensions: true, notification: true,
      ranking: false, e_contract: true,
    } as Record<ModuleKey, boolean>,
    // 設定
    payment_fee_card: 10,
    payment_fee_paypay: 10,
    payment_fee_line_pay: 10,
    payment_fee_cash: 0,
    has_reserve_fund: false,
    daily_close_required: true,
  });

  const currentStepIndex = STEPS.findIndex((s) => s.key === step);
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === STEPS.length - 1;

  const goNext = () => {
    if (!isLastStep) {
      setStep(STEPS[currentStepIndex + 1].key);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };
  const goPrev = () => {
    if (!isFirstStep) {
      setStep(STEPS[currentStepIndex - 1].key);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleSubmit = () => {
    alert(
      "🚀 インスタンス発行処理が実行されます（Phase 5 で実装）\n\n" +
      "現在はUIプロトタイプのため、ダッシュボードに戻ります。"
    );
    router.push("/tera-admin");
  };

  return (
    <TeraAdminShell>
      {/* パンくず */}
      <div style={{ fontSize: 12, color: T.textSub, marginBottom: 16 }}>
        <Link href="/tera-admin" style={{ color: T.textSub, textDecoration: "none" }}>
          ダッシュボード
        </Link>
        {" / "}
        <span style={{ color: T.text }}>新規店舗を発行</span>
      </div>

      <h1 style={{ fontSize: 26, fontWeight: 800, color: T.text, marginBottom: 8 }}>
        🏗️ 新しい T-MANAGE インスタンスを発行
      </h1>
      <p style={{ color: T.textSub, fontSize: 14, marginBottom: 28 }}>
        新規店舗の T-MANAGE を発行します。発行には約1〜2分かかります。
      </p>

      {/* ステッパー */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 28,
          gap: 4,
        }}
      >
        {STEPS.map((s, i) => {
          const isActive = s.key === step;
          const isCompleted = i < currentStepIndex;
          return (
            <div
              key={s.key}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 6,
                position: "relative",
              }}
            >
              {i < STEPS.length - 1 && (
                <div
                  style={{
                    position: "absolute",
                    top: 22,
                    left: "60%",
                    right: "-40%",
                    height: 2,
                    background: isCompleted ? T.accent : T.border,
                    zIndex: 0,
                  }}
                />
              )}
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: "50%",
                  background: isActive ? T.accent : isCompleted ? `${T.accent}44` : T.cardAlt,
                  border: `2px solid ${isActive ? T.accent : isCompleted ? T.accent : T.border}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: isActive ? "#fff" : T.text,
                  fontSize: 20,
                  zIndex: 1,
                  transition: "all 0.2s",
                }}
              >
                {isCompleted ? "✓" : s.icon}
              </div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: isActive ? 700 : 500,
                  color: isActive ? T.text : T.textSub,
                  textAlign: "center",
                }}
              >
                {s.label}
              </div>
            </div>
          );
        })}
      </div>

      {/* フォームコンテンツ */}
      <div
        style={{
          background: T.card,
          border: `1px solid ${T.border}`,
          borderRadius: 14,
          padding: 28,
          marginBottom: 20,
        }}
      >
        {step === "corporation" && <CorporationStep T={T} form={form} setForm={setForm} />}
        {step === "basic" && <BasicStep T={T} form={form} setForm={setForm} />}
        {step === "branding" && <BrandingStep T={T} form={form} setForm={setForm} />}
        {step === "modules" && <ModulesStep T={T} form={form} setForm={setForm} />}
        {step === "settings" && <SettingsStep T={T} form={form} setForm={setForm} />}
        {step === "confirm" && <ConfirmStep T={T} form={form} />}
      </div>

      {/* ナビゲーションボタン */}
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <button
          onClick={goPrev}
          disabled={isFirstStep}
          style={{
            padding: "12px 24px",
            background: T.cardAlt,
            border: `1px solid ${T.border}`,
            borderRadius: 8,
            color: isFirstStep ? T.textMuted : T.text,
            fontSize: 14,
            fontWeight: 600,
            cursor: isFirstStep ? "not-allowed" : "pointer",
            opacity: isFirstStep ? 0.5 : 1,
          }}
        >
          ← 戻る
        </button>

        {isLastStep ? (
          <button
            onClick={handleSubmit}
            style={{
              padding: "12px 28px",
              background: T.accent,
              border: "none",
              borderRadius: 8,
              color: "#fff",
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: `0 4px 12px ${T.accent}55`,
            }}
          >
            🚀 インスタンスを発行
          </button>
        ) : (
          <button
            onClick={goNext}
            style={{
              padding: "12px 28px",
              background: T.accent,
              border: "none",
              borderRadius: 8,
              color: "#fff",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            次へ →
          </button>
        )}
      </div>
    </TeraAdminShell>
  );
}

// ============================================
// 各ステップのコンポーネント
// ============================================

function CorporationStep({ T, form, setForm }: any) {
  return (
    <div>
      <h3 style={{ fontSize: 18, fontWeight: 700, color: T.text, marginTop: 0, marginBottom: 14 }}>
        🏢 法人情報を入力
      </h3>
      <p style={{ fontSize: 13, color: T.textSub, marginBottom: 24 }}>
        このインスタンスを運営する法人の情報を入力してください。既存の法人を選択するか、新規登録します。
      </p>

      <FormRow T={T} label="法人名（必須）">
        <Input T={T} value={form.corporation_name} onChange={(v) => setForm({ ...form, corporation_name: v })} placeholder="例: 合同会社ライフテラス" />
      </FormRow>

      <FormRow T={T} label="代表者名">
        <Input T={T} value={form.representative_name} onChange={(v) => setForm({ ...form, representative_name: v })} placeholder="例: 山田 太郎" />
      </FormRow>

      <FormRow T={T} label="決算月">
        <select
          value={form.fiscal_month}
          onChange={(e) => setForm({ ...form, fiscal_month: parseInt(e.target.value) })}
          style={{ ...inputStyle(T), width: 200 }}
        >
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
            <option key={m} value={m}>
              {m}月
            </option>
          ))}
        </select>
      </FormRow>

      <FormRow T={T} label="顧問税理士">
        <Input T={T} value={form.tax_accountant_name} onChange={(v) => setForm({ ...form, tax_accountant_name: v })} placeholder="例: 江坂瑠衣" />
      </FormRow>
    </div>
  );
}

function BasicStep({ T, form, setForm }: any) {
  return (
    <div>
      <h3 style={{ fontSize: 18, fontWeight: 700, color: T.text, marginTop: 0, marginBottom: 14 }}>
        📝 基本情報を入力
      </h3>

      <FormRow T={T} label="店舗名（屋号）（必須）">
        <Input T={T} value={form.name} onChange={(v) => setForm({ ...form, name: v })} placeholder="例: RESEXY〜リゼクシー" />
      </FormRow>

      <FormRow T={T} label="英語名">
        <Input T={T} value={form.name_en} onChange={(v) => setForm({ ...form, name_en: v })} placeholder="例: RESEXY" />
      </FormRow>

      <FormRow T={T} label="業種">
        <Input T={T} value={form.shop_type} onChange={(v) => setForm({ ...form, shop_type: v })} placeholder="例: メンズエステ" />
      </FormRow>

      <FormRow T={T} label="サブドメイン（必須）">
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Input T={T} value={form.subdomain} onChange={(v) => setForm({ ...form, subdomain: v })} placeholder="resexy" />
          <span style={{ color: T.textSub, fontSize: 13 }}>.t-manage.jp</span>
        </div>
        <div style={{ fontSize: 11, color: T.textMuted, marginTop: 4 }}>
          半角英数字とハイフンのみ。このサブドメインで店舗にアクセスできます。
        </div>
      </FormRow>

      <FormRow T={T} label="独自ドメイン（任意）">
        <Input T={T} value={form.custom_domain} onChange={(v) => setForm({ ...form, custom_domain: v })} placeholder="例: resexy.info（任意）" />
      </FormRow>

      <FormRow T={T} label="コンセプト">
        <Input T={T} value={form.concept} onChange={(v) => setForm({ ...form, concept: v })} placeholder="例: 大型グループサロン" />
      </FormRow>

      <FormRow T={T} label="プラン">
        <div style={{ display: "flex", gap: 10 }}>
          {(["light", "standard", "full"] as const).map((plan) => (
            <button
              key={plan}
              onClick={() => setForm({ ...form, plan })}
              style={{
                flex: 1,
                padding: 14,
                background: form.plan === plan ? `${T.accent}22` : T.cardAlt,
                border: `2px solid ${form.plan === plan ? T.accent : T.border}`,
                borderRadius: 8,
                cursor: "pointer",
                color: T.text,
              }}
            >
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>
                {plan === "light" && "ライト"}
                {plan === "standard" && "スタンダード"}
                {plan === "full" && "フル"}
              </div>
              <div style={{ fontSize: 11, color: T.textSub }}>
                {plan === "light" && "Tier1 + Tier2"}
                {plan === "standard" && "+ HP + お客様マイページ"}
                {plan === "full" && "全モジュールON"}
              </div>
            </button>
          ))}
        </div>
      </FormRow>

      <FormRow T={T} label="運用形態">
        <div style={{ display: "flex", gap: 10 }}>
          {(["self", "external"] as const).map((type) => (
            <button
              key={type}
              onClick={() => setForm({ ...form, operation_type: type })}
              style={{
                flex: 1,
                padding: 12,
                background: form.operation_type === type ? `${T.accent}22` : T.cardAlt,
                border: `2px solid ${form.operation_type === type ? T.accent : T.border}`,
                borderRadius: 8,
                cursor: "pointer",
                color: T.text,
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              {type === "self" ? "🏠 自社運用" : "🤝 外部提供"}
            </button>
          ))}
        </div>
      </FormRow>

      <FormRow T={T} label="契約種別">
        <div style={{ display: "flex", gap: 10 }}>
          {(["paid", "free", "trial"] as const).map((type) => (
            <button
              key={type}
              onClick={() => setForm({ ...form, contract_type: type })}
              style={{
                flex: 1,
                padding: 12,
                background: form.contract_type === type ? `${T.accent}22` : T.cardAlt,
                border: `2px solid ${form.contract_type === type ? T.accent : T.border}`,
                borderRadius: 8,
                cursor: "pointer",
                color: T.text,
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              {type === "paid" && "💰 有償"}
              {type === "free" && "🎁 無償"}
              {type === "trial" && "🧪 試用"}
            </button>
          ))}
        </div>
      </FormRow>

      <FormRow T={T} label="稼働予定日">
        <input
          type="date"
          value={form.go_live_date}
          onChange={(e) => setForm({ ...form, go_live_date: e.target.value })}
          style={{ ...inputStyle(T), width: 220 }}
        />
      </FormRow>
    </div>
  );
}

function BrandingStep({ T, form, setForm }: any) {
  return (
    <div>
      <h3 style={{ fontSize: 18, fontWeight: 700, color: T.text, marginTop: 0, marginBottom: 14 }}>
        🎨 ブランディング設定
      </h3>
      <p style={{ fontSize: 13, color: T.textSub, marginBottom: 24 }}>
        この店舗固有のテーマカラーとロゴを設定します。HP・お客様マイページ・セラピストマイページに反映されます。
      </p>

      <FormRow T={T} label="プライマリカラー">
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <input
            type="color"
            value={form.theme_color_primary}
            onChange={(e) => setForm({ ...form, theme_color_primary: e.target.value })}
            style={{ width: 60, height: 40, borderRadius: 8, border: `1px solid ${T.border}`, cursor: "pointer" }}
          />
          <Input T={T} value={form.theme_color_primary} onChange={(v) => setForm({ ...form, theme_color_primary: v })} placeholder="#c3a782" />
        </div>
      </FormRow>

      <FormRow T={T} label="アクセントカラー">
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <input
            type="color"
            value={form.theme_color_accent}
            onChange={(e) => setForm({ ...form, theme_color_accent: e.target.value })}
            style={{ width: 60, height: 40, borderRadius: 8, border: `1px solid ${T.border}`, cursor: "pointer" }}
          />
          <Input T={T} value={form.theme_color_accent} onChange={(v) => setForm({ ...form, theme_color_accent: v })} placeholder="#8b7355" />
        </div>
      </FormRow>

      {/* プレビュー */}
      <div style={{ marginTop: 30 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: T.textSub, marginBottom: 10 }}>プレビュー</div>
        <div
          style={{
            padding: 20,
            borderRadius: 12,
            background: `linear-gradient(135deg, ${form.theme_color_primary}, ${form.theme_color_accent})`,
            color: "#fff",
            minHeight: 140,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>{form.name || "店舗名"}</div>
          <div style={{ fontSize: 13, opacity: 0.9 }}>{form.concept || "コンセプト"}</div>
          <div style={{ fontSize: 11, marginTop: 12, opacity: 0.7 }}>
            https://{form.subdomain || "subdomain"}.t-manage.jp
          </div>
        </div>
      </div>

      <div
        style={{
          marginTop: 20,
          padding: 14,
          background: `${T.accent}11`,
          border: `1px solid ${T.accent}44`,
          borderRadius: 8,
          fontSize: 12,
          color: T.textSub,
        }}
      >
        💡 <strong>ロゴアップロード</strong>は Phase 7 で追加予定（現在は Gemini API で自動生成も検討中）
      </div>
    </div>
  );
}

function ModulesStep({ T, form, setForm }: any) {
  const toggleModule = (key: ModuleKey) => {
    setForm({ ...form, modules: { ...form.modules, [key]: !form.modules[key] } });
  };

  const enabledCount = Object.values(form.modules).filter(Boolean).length;

  return (
    <div>
      <h3 style={{ fontSize: 18, fontWeight: 700, color: T.text, marginTop: 0, marginBottom: 14 }}>
        🧩 Tier 3 オプションモジュール
      </h3>
      <p style={{ fontSize: 13, color: T.textSub, marginBottom: 20 }}>
        この店舗で有効にする機能を選択してください。後から変更も可能です。
      </p>

      <div
        style={{
          marginBottom: 20,
          padding: "10px 14px",
          background: T.cardAlt,
          borderRadius: 8,
          fontSize: 13,
          color: T.text,
        }}
      >
        選択中: <strong>{enabledCount} / 13 モジュール</strong>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12 }}>
        {(Object.keys(MODULE_LABELS) as ModuleKey[]).map((key) => {
          const enabled = form.modules[key];
          const info = MODULE_LABELS[key];
          return (
            <div
              key={key}
              onClick={() => toggleModule(key)}
              style={{
                padding: 16,
                background: enabled ? `${T.accent}11` : T.cardAlt,
                border: `2px solid ${enabled ? T.accent : T.border}`,
                borderRadius: 10,
                cursor: "pointer",
                display: "flex",
                gap: 14,
                alignItems: "flex-start",
                transition: "all 0.2s",
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 4 }}>
                  {info.name}
                </div>
                <div style={{ fontSize: 11, color: T.textSub, lineHeight: 1.4, marginBottom: 4 }}>
                  {info.description}
                </div>
                <code style={{ fontSize: 10, color: T.textMuted }}>{key}</code>
              </div>
              <div
                style={{
                  width: 40,
                  height: 22,
                  borderRadius: 11,
                  background: enabled ? T.accent : T.border,
                  position: "relative",
                  flexShrink: 0,
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    top: 2,
                    left: enabled ? 20 : 2,
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    background: "#fff",
                    transition: "all 0.2s",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.15)",
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SettingsStep({ T, form, setForm }: any) {
  return (
    <div>
      <h3 style={{ fontSize: 18, fontWeight: 700, color: T.text, marginTop: 0, marginBottom: 14 }}>
        ⚙️ 独自設定
      </h3>
      <p style={{ fontSize: 13, color: T.textSub, marginBottom: 24 }}>
        この店舗特有の設定を調整します。後からでも変更可能です。
      </p>

      <div style={{ marginBottom: 30 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 14 }}>💳 決済手数料</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          <FeeInput T={T} label="クレジット" value={form.payment_fee_card} onChange={(v) => setForm({ ...form, payment_fee_card: v })} />
          <FeeInput T={T} label="PayPay" value={form.payment_fee_paypay} onChange={(v) => setForm({ ...form, payment_fee_paypay: v })} />
          <FeeInput T={T} label="LINE Pay" value={form.payment_fee_line_pay} onChange={(v) => setForm({ ...form, payment_fee_line_pay: v })} />
          <FeeInput T={T} label="現金" value={form.payment_fee_cash} onChange={(v) => setForm({ ...form, payment_fee_cash: v })} />
        </div>
      </div>

      <div style={{ marginBottom: 30 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 14 }}>💰 資金管理</div>
        <CheckboxRow
          T={T}
          checked={form.has_reserve_fund}
          onChange={(v) => setForm({ ...form, has_reserve_fund: v })}
          label="予備金制度を使用する"
          description="複数拠点での資金移動管理で使用"
        />
        <CheckboxRow
          T={T}
          checked={form.daily_close_required}
          onChange={(v) => setForm({ ...form, daily_close_required: v })}
          label="当日締めを必須にする"
          description="翌日への持ち越しを禁止"
        />
      </div>
    </div>
  );
}

function ConfirmStep({ T, form }: any) {
  const enabledModules = (Object.keys(form.modules) as ModuleKey[]).filter((k) => form.modules[k]);

  return (
    <div>
      <h3 style={{ fontSize: 18, fontWeight: 700, color: T.text, marginTop: 0, marginBottom: 14 }}>
        🚀 内容確認
      </h3>
      <p style={{ fontSize: 13, color: T.textSub, marginBottom: 24 }}>
        以下の内容でインスタンスを発行します。確認して「発行」ボタンを押してください。
      </p>

      {/* プレビューカード */}
      <div
        style={{
          background: T.card,
          border: `2px solid ${T.accent}`,
          borderRadius: 14,
          overflow: "hidden",
          marginBottom: 24,
        }}
      >
        <div
          style={{
            height: 6,
            background: `linear-gradient(90deg, ${form.theme_color_primary}, ${form.theme_color_accent})`,
          }}
        />
        <div style={{ padding: 20 }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: T.text, marginBottom: 6 }}>
            {form.name || "（店舗名未入力）"}
          </div>
          <div style={{ fontSize: 13, color: T.textSub, marginBottom: 12 }}>
            {form.corporation_name} / {form.shop_type}
          </div>
          <div
            style={{
              padding: "8px 12px",
              background: T.cardAlt,
              borderRadius: 6,
              fontSize: 13,
              fontFamily: "ui-monospace, monospace",
              color: T.text,
            }}
          >
            🌐 {form.subdomain || "subdomain"}.t-manage.jp
          </div>
        </div>
      </div>

      <SummarySection T={T} title="📝 基本情報">
        <SummaryRow T={T} label="法人" value={form.corporation_name || "（未入力）"} />
        <SummaryRow T={T} label="店舗名" value={form.name || "（未入力）"} />
        <SummaryRow T={T} label="サブドメイン" value={`${form.subdomain || "未入力"}.t-manage.jp`} />
        <SummaryRow T={T} label="プラン" value={form.plan} />
        <SummaryRow T={T} label="運用形態" value={form.operation_type === "self" ? "自社運用" : "外部提供"} />
        <SummaryRow T={T} label="契約種別" value={form.contract_type} />
        <SummaryRow T={T} label="稼働予定" value={form.go_live_date || "未定"} />
      </SummarySection>

      <SummarySection T={T} title="🧩 有効モジュール">
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {enabledModules.length === 0 ? (
            <span style={{ fontSize: 13, color: T.textMuted }}>選択なし</span>
          ) : (
            enabledModules.map((key) => (
              <span
                key={key}
                style={{
                  padding: "4px 10px",
                  background: `${T.accent}22`,
                  color: T.accent,
                  borderRadius: 12,
                  fontSize: 11,
                  fontWeight: 600,
                }}
              >
                {MODULE_LABELS[key].name}
              </span>
            ))
          )}
        </div>
      </SummarySection>

      <SummarySection T={T} title="💳 決済手数料">
        <SummaryRow T={T} label="クレジット" value={`${form.payment_fee_card}%`} />
        <SummaryRow T={T} label="PayPay" value={`${form.payment_fee_paypay}%`} />
        <SummaryRow T={T} label="LINE Pay" value={`${form.payment_fee_line_pay}%`} />
        <SummaryRow T={T} label="現金" value={`${form.payment_fee_cash}%`} />
      </SummarySection>

      <div
        style={{
          padding: 14,
          background: `#b3841911`,
          border: `1px solid #b3841944`,
          borderRadius: 8,
          fontSize: 12,
          color: "#8b6818",
          marginTop: 20,
        }}
      >
        ⚠️ 発行後、以下の初期セットアップが自動実行されます：
        <ul style={{ margin: "8px 0 0 20px", padding: 0 }}>
          <li>Supabase: corporations と tmanage_instances にレコード作成</li>
          <li>Vercel: サブドメインを追加・SSL証明書発行</li>
          <li>Storage: セラピスト写真用バケット作成</li>
          <li>モジュール: 選択したモジュールをinstance_modulesに登録</li>
          <li>初期管理者アカウント作成用のメール送信</li>
        </ul>
      </div>
    </div>
  );
}

// ============================================
// 共通UIパーツ
// ============================================

const inputStyle = (T: any) => ({
  padding: "10px 12px",
  background: T.cardAlt,
  border: `1px solid ${T.border}`,
  borderRadius: 6,
  color: T.text,
  fontSize: 13,
  width: "100%",
  outline: "none",
  boxSizing: "border-box" as const,
});

function FormRow({ T, label, children }: { T: any; label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: T.text, marginBottom: 6 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function Input({ T, value, onChange, placeholder }: any) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={inputStyle(T)}
    />
  );
}

function FeeInput({ T, label, value, onChange }: any) {
  return (
    <div>
      <div style={{ fontSize: 11, color: T.textSub, marginBottom: 4 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          style={{ ...inputStyle(T), textAlign: "right" }}
          min="0"
          max="100"
          step="0.5"
        />
        <span style={{ color: T.textSub }}>%</span>
      </div>
    </div>
  );
}

function CheckboxRow({ T, checked, onChange, label, description }: any) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        padding: 12,
        cursor: "pointer",
        borderRadius: 8,
        background: checked ? `${T.accent}11` : "transparent",
        marginBottom: 8,
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ marginTop: 3, width: 18, height: 18, cursor: "pointer" }}
      />
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{label}</div>
        <div style={{ fontSize: 11, color: T.textSub }}>{description}</div>
      </div>
    </label>
  );
}

function SummarySection({ T, title, children }: { T: any; title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 10 }}>{title}</div>
      <div style={{ padding: 14, background: T.cardAlt, borderRadius: 8 }}>{children}</div>
    </div>
  );
}

function SummaryRow({ T, label, value }: { T: any; label: string; value: string }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "140px 1fr",
        gap: 8,
        padding: "4px 0",
        fontSize: 12,
      }}
    >
      <div style={{ color: T.textSub }}>{label}</div>
      <div style={{ color: T.text, fontWeight: 600 }}>{value}</div>
    </div>
  );
}
