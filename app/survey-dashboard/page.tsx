"use client";

/**
 * ═══════════════════════════════════════════════════════════
 * アンケート管理ダッシュボード
 *
 * URL: /survey-dashboard
 *
 * 5タブ構成:
 *   1. 📊 list      - 回答一覧（最近の回答、フィルタ）
 *   2. ⚠️ alerts    - 低評価アラート (rating <= 3)
 *   3. ✅ approval  - HP掲載承認待ち
 *   4. 📈 trends    - トレンド分析 (NPS推移、平均評価)
 *   5. ⚙️ settings  - 設定 (クーポン金額・有効期限・Google URL)
 *
 * 認証: useStaffSession (アクティブスタッフのみ)
 * 設計: docs/14_REVIEW_SYSTEM.md
 * ═══════════════════════════════════════════════════════════
 */

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { useTheme } from "../../lib/theme";
import { NavMenu } from "../../lib/nav-menu";
import { useStaffSession } from "../../lib/staff-session";

// ─────────────────────────────────────
// 型
// ─────────────────────────────────────

type Survey = {
  id: number;
  customer_id: number | null;
  reservation_id: number | null;
  therapist_id: number | null;
  rating_overall: number | null;
  rating_therapist: string | null;
  rating_service: string | null;
  rating_atmosphere: string | null;
  rating_cleanliness: string | null;
  rating_course: string | null;
  highlights: string[] | null;
  highlights_custom: string | null;
  good_points: string | null;
  improvement_points: string | null;
  therapist_message: string | null;
  final_review_text: string | null;
  ai_generated_text: string | null;
  hp_publish_consent: boolean;
  hp_published: boolean;
  hp_display_name: string | null;
  coupon_issued: boolean;
  coupon_id: number | null;
  submitted_at: string;
  submitted_from: string | null;
};

type Therapist = { id: number; name: string };
type CustomerLite = { id: number; name: string };
type Store = { id: number; name: string; google_review_url: string | null; google_place_id: string | null };
type PointSettings = {
  hp_publish_bonus: number;
  survey_coupon_amount: number;
  survey_coupon_valid_months: number;
};

type Tab = "list" | "alerts" | "approval" | "trends" | "settings";

const TABS: { key: Tab; label: string; emoji: string }[] = [
  { key: "list",     label: "一覧",        emoji: "📊" },
  { key: "alerts",   label: "低評価",      emoji: "⚠️" },
  { key: "approval", label: "HP掲載承認",  emoji: "✅" },
  { key: "trends",   label: "トレンド",    emoji: "📈" },
  { key: "settings", label: "設定",        emoji: "⚙️" },
];

// ─────────────────────────────────────
// メイン
// ─────────────────────────────────────

export default function SurveyDashboardPage() {
  const router = useRouter();
  const { dark, T } = useTheme();
  const { activeStaff, isRestored, isManager } = useStaffSession();

  const [tab, setTab] = useState<Tab>("list");
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [customers, setCustomers] = useState<CustomerLite[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [pointSettings, setPointSettings] = useState<PointSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedSurvey, setSelectedSurvey] = useState<Survey | null>(null);
  const [savingHpPublish, setSavingHpPublish] = useState(false);

  // JST 基準での日付（UTC とのズレで「今日」がずれないように）
  const todayJst = () => {
    const now = new Date();
    const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    return jst.toISOString().split("T")[0];
  };

  // フィルタ
  const [dateFrom, setDateFrom] = useState(() => {
    const now = new Date();
    const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    jst.setDate(jst.getDate() - 30);
    return jst.toISOString().split("T")[0];
  });
  const [dateTo, setDateTo] = useState(() => todayJst());
  const [therapistFilter, setTherapistFilter] = useState<number>(0);

  // 認証 (セッション復元後にチェック)
  useEffect(() => {
    if (!isRestored) return; // localStorage からの復元中は待つ
    if (!activeStaff) {
      router.push("/admin");
      return;
    }
  }, [activeStaff, isRestored, router]);

  // データ取得
  useEffect(() => {
    if (!isRestored || !activeStaff) return;
    fetchAllData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStaff, isRestored, dateFrom, dateTo]);

  const fetchAllData = async () => {
    setLoading(true);
    // JST タイムゾーンを明示してUTC変換（日付の境界ズレを防ぐ）
    const fromIso = new Date(`${dateFrom}T00:00:00+09:00`).toISOString();
    const toIso = new Date(`${dateTo}T23:59:59+09:00`).toISOString();

    const [surveysRes, thRes, custRes, storesRes, ptRes] = await Promise.all([
      supabase
        .from("customer_surveys")
        .select("*")
        .gte("submitted_at", fromIso)
        .lte("submitted_at", toIso)
        .order("submitted_at", { ascending: false })
        .limit(500),
      supabase.from("therapists").select("id,name").order("sort_order"),
      supabase.from("customers").select("id,name").limit(2000),
      supabase.from("stores").select("id,name,google_review_url,google_place_id").order("id"),
      supabase.from("point_settings").select("hp_publish_bonus,survey_coupon_amount,survey_coupon_valid_months").maybeSingle(),
    ]);

    if (surveysRes.data) setSurveys(surveysRes.data as Survey[]);
    if (thRes.data) setTherapists(thRes.data);
    if (custRes.data) setCustomers(custRes.data);
    if (storesRes.data) setStores(storesRes.data);
    if (ptRes.data) setPointSettings(ptRes.data);
    setLoading(false);
  };

  // ヘルパー
  const therapistName = (id: number | null) =>
    id ? therapists.find((t) => t.id === id)?.name || "" : "";
  const customerName = (id: number | null) =>
    id ? customers.find((c) => c.id === id)?.name || "" : "";

  // フィルタ済み
  const filteredSurveys = useMemo(() => {
    return surveys.filter((s) => {
      if (therapistFilter && s.therapist_id !== therapistFilter) return false;
      return true;
    });
  }, [surveys, therapistFilter]);

  const lowRatingSurveys = useMemo(
    () => surveys.filter((s) => (s.rating_overall || 0) > 0 && (s.rating_overall || 0) <= 3),
    [surveys]
  );
  const pendingApprovalSurveys = useMemo(
    () => surveys.filter((s) => s.hp_publish_consent && !s.hp_published),
    [surveys]
  );

  // HP掲載承認/却下
  const handleHpPublish = async (surveyId: number, publish: boolean) => {
    if (!activeStaff) return;
    setSavingHpPublish(true);

    // 承認時: hp_display_name を自動生成（未設定の場合）
    let displayNameToSet: string | null = null;
    if (publish) {
      const targetSurvey = surveys.find((s) => s.id === surveyId);
      if (targetSurvey && !targetSurvey.hp_display_name) {
        // 顧客の生年月日から年代を判定
        let ageGroup = "";
        if (targetSurvey.customer_id) {
          const { data: cust } = await supabase
            .from("customers")
            .select("birthday")
            .eq("id", targetSurvey.customer_id)
            .maybeSingle();
          if (cust?.birthday) {
            const age = Math.floor(
              (Date.now() - new Date(cust.birthday).getTime()) / (1000 * 60 * 60 * 24 * 365.25)
            );
            ageGroup = age < 30 ? "20代" : age < 40 ? "30代" : age < 50 ? "40代" : age < 60 ? "50代" : "60代";
          }
        }
        const initial = String.fromCharCode(65 + Math.floor(Math.random() * 26));
        displayNameToSet = `${ageGroup}男性 ${initial}さん`.trim();
      }
    }

    const updatePayload: Record<string, unknown> = {
      hp_published: publish,
      hp_publish_approved_at: publish ? new Date().toISOString() : null,
      hp_publish_approved_by: publish ? activeStaff.id : null,
    };
    if (displayNameToSet) {
      updatePayload.hp_display_name = displayNameToSet;
    }

    const { error } = await supabase
      .from("customer_surveys")
      .update(updatePayload)
      .eq("id", surveyId);

    setSavingHpPublish(false);

    if (error) {
      console.error("[handleHpPublish] update error:", error);
      alert(`更新失敗: ${error.message}`);
      return;
    }

    if (selectedSurvey?.id === surveyId) {
      setSelectedSurvey({ ...selectedSurvey, hp_published: publish });
    }
    await fetchAllData();
  };

  // ─────────────────────────────────────
  // レンダリング
  // ─────────────────────────────────────

  if (!isRestored) {
    return <div style={{ padding: 24, color: "#888" }}>読み込み中...</div>;
  }

  if (!activeStaff) {
    return <div style={{ padding: 24, color: T.textMuted }}>ログインが必要です。リダイレクトしています...</div>;
  }

  return (
    <div style={{ minHeight: "100vh", backgroundColor: T.bg, color: T.text, fontFamily: "Inter, system-ui, sans-serif" }}>
      {/* ヘッダー */}
      <header
        style={{
          borderBottom: `1px solid ${T.border}`,
          padding: "12px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          backgroundColor: T.card,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <NavMenu T={T} dark={dark} />
          <h1 style={{ fontSize: 18, fontWeight: 500, margin: 0 }}>🌸 アンケート管理</h1>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: T.textMuted }}>
          <span>合計 {surveys.length}件</span>
          <span>•</span>
          <span style={{ color: lowRatingSurveys.length > 0 ? "#c45555" : T.textMuted }}>
            低評価 {lowRatingSurveys.length}件
          </span>
        </div>
      </header>

      {/* タブ */}
      <div
        style={{
          display: "flex",
          gap: 0,
          borderBottom: `1px solid ${T.border}`,
          backgroundColor: T.card,
          overflowX: "auto",
        }}
      >
        {TABS.map((t) => {
          const active = tab === t.key;
          let badge = 0;
          if (t.key === "alerts") badge = lowRatingSurveys.length;
          if (t.key === "approval") badge = pendingApprovalSurveys.length;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                padding: "12px 20px",
                fontSize: 12,
                background: "transparent",
                border: "none",
                borderBottom: active ? `2px solid ${T.accent}` : "2px solid transparent",
                color: active ? T.text : T.textSub,
                cursor: "pointer",
                whiteSpace: "nowrap",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span>{t.emoji}</span>
              <span>{t.label}</span>
              {badge > 0 && (
                <span
                  style={{
                    fontSize: 9,
                    padding: "2px 6px",
                    backgroundColor: t.key === "alerts" ? "#c45555" : T.accent,
                    color: "#fff",
                    borderRadius: 8,
                    minWidth: 16,
                    textAlign: "center",
                  }}
                >
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 期間フィルタ（trends と settings 以外で表示） */}
      {tab !== "settings" && (
        <div
          style={{
            padding: "12px 16px",
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
            borderBottom: `1px solid ${T.border}`,
            backgroundColor: T.cardAlt,
          }}
        >
          <span style={{ fontSize: 11, color: T.textSub }}>期間:</span>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            style={inputStyle(T)}
          />
          <span style={{ fontSize: 11, color: T.textMuted }}>〜</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            style={inputStyle(T)}
          />
          {tab === "list" && (
            <select
              value={therapistFilter}
              onChange={(e) => setTherapistFilter(Number(e.target.value))}
              style={inputStyle(T)}
            >
              <option value={0}>セラピスト全員</option>
              {therapists.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* タブコンテンツ */}
      <main style={{ padding: 16 }}>
        {loading && <p style={{ color: T.textMuted, textAlign: "center" }}>読み込み中...</p>}
        {!loading && tab === "list" && (
          <SurveyListView
            surveys={filteredSurveys}
            therapistName={therapistName}
            customerName={customerName}
            onSelect={setSelectedSurvey}
            T={T}
          />
        )}
        {!loading && tab === "alerts" && (
          <AlertsView
            surveys={lowRatingSurveys}
            therapistName={therapistName}
            customerName={customerName}
            onSelect={setSelectedSurvey}
            T={T}
          />
        )}
        {!loading && tab === "approval" && (
          <ApprovalView
            surveys={pendingApprovalSurveys}
            therapistName={therapistName}
            customerName={customerName}
            onSelect={setSelectedSurvey}
            onPublish={handleHpPublish}
            saving={savingHpPublish}
            T={T}
          />
        )}
        {!loading && tab === "trends" && (
          <TrendsView surveys={surveys} therapists={therapists} T={T} />
        )}
        {!loading && tab === "settings" && (
          <SettingsView
            pointSettings={pointSettings}
            stores={stores}
            isManager={isManager}
            onSaved={fetchAllData}
            T={T}
          />
        )}
      </main>

      {/* 詳細モーダル */}
      {selectedSurvey && (
        <SurveyDetailModal
          survey={selectedSurvey}
          therapistName={therapistName}
          customerName={customerName}
          onClose={() => setSelectedSurvey(null)}
          onPublish={handleHpPublish}
          saving={savingHpPublish}
          T={T}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────
// タブビュー: 一覧
// ─────────────────────────────────────

function SurveyListView({
  surveys, therapistName, customerName, onSelect, T,
}: {
  surveys: Survey[];
  therapistName: (id: number | null) => string;
  customerName: (id: number | null) => string;
  onSelect: (s: Survey) => void;
  T: any;
}) {
  if (surveys.length === 0) {
    return <p style={{ color: T.textMuted, textAlign: "center", padding: 32 }}>該当のアンケートはありません</p>;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {surveys.map((s) => (
        <div key={s.id}>
          <SurveyRow s={s} therapistName={therapistName} customerName={customerName} onSelect={onSelect} T={T} />
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────
// タブビュー: 低評価アラート
// ─────────────────────────────────────

function AlertsView({
  surveys, therapistName, customerName, onSelect, T,
}: {
  surveys: Survey[];
  therapistName: (id: number | null) => string;
  customerName: (id: number | null) => string;
  onSelect: (s: Survey) => void;
  T: any;
}) {
  if (surveys.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: 32 }}>
        <p style={{ color: T.text, fontSize: 14, marginBottom: 4 }}>👏 低評価アラートはありません</p>
        <p style={{ color: T.textMuted, fontSize: 11 }}>素晴らしいサービスを継続中です</p>
      </div>
    );
  }
  return (
    <>
      <div
        style={{
          padding: 12,
          backgroundColor: "#fff5f5",
          border: "1px solid #f5c6c6",
          color: "#c45555",
          fontSize: 12,
          marginBottom: 12,
          lineHeight: 1.6,
        }}
      >
        ⚠️ 評価3以下のご回答が {surveys.length} 件あります。改善検討にお役立てください。
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {surveys.map((s) => (
          <div key={s.id}>
            <SurveyRow s={s} therapistName={therapistName} customerName={customerName} onSelect={onSelect} T={T} alert />
          </div>
        ))}
      </div>
    </>
  );
}

// ─────────────────────────────────────
// タブビュー: HP掲載承認
// ─────────────────────────────────────

function ApprovalView({
  surveys, therapistName, customerName, onSelect, onPublish, saving, T,
}: {
  surveys: Survey[];
  therapistName: (id: number | null) => string;
  customerName: (id: number | null) => string;
  onSelect: (s: Survey) => void;
  onPublish: (id: number, publish: boolean) => Promise<void>;
  saving: boolean;
  T: any;
}) {
  if (surveys.length === 0) {
    return <p style={{ color: T.textMuted, textAlign: "center", padding: 32 }}>承認待ちのご感想はありません</p>;
  }
  return (
    <>
      <div
        style={{
          padding: 12,
          backgroundColor: "#fffbf0",
          border: "1px solid #f5d96a",
          color: "#7c5a30",
          fontSize: 12,
          marginBottom: 12,
          lineHeight: 1.6,
        }}
      >
        ✅ HP掲載に同意いただいたご感想です。内容を確認のうえ「掲載」を押すと公開されます。
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {surveys.map((s) => {
          const reviewText = s.final_review_text || s.good_points || "";
          return (
            <div
              key={s.id}
              style={{
                padding: 14,
                backgroundColor: T.card,
                border: `1px solid ${T.border}`,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 11, color: T.textMuted }}>
                <span>
                  {customerName(s.customer_id) || "お客様"}様 ・ {new Date(s.submitted_at).toLocaleDateString("ja-JP")}
                  {s.therapist_id && <span style={{ marginLeft: 8 }}>担当: {therapistName(s.therapist_id)}</span>}
                </span>
                <span style={{ color: T.accent }}>{"★".repeat(s.rating_overall || 0)}</span>
              </div>
              <div
                style={{
                  padding: 12,
                  backgroundColor: T.cardAlt,
                  fontSize: 12,
                  lineHeight: 1.7,
                  whiteSpace: "pre-wrap",
                  color: T.text,
                  marginBottom: 10,
                  maxHeight: 200,
                  overflowY: "auto",
                }}
              >
                {reviewText || "（自由記述なし）"}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => onSelect(s)} style={btnSecondary(T)}>
                  詳細を見る
                </button>
                <button
                  onClick={() => onPublish(s.id, true)}
                  disabled={saving}
                  style={btnPrimary(T)}
                >
                  ✓ HPに掲載する
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

// ─────────────────────────────────────
// タブビュー: トレンド
// ─────────────────────────────────────

function TrendsView({ surveys, therapists, T }: { surveys: Survey[]; therapists: Therapist[]; T: any }) {
  // 30日推移用の集計
  const dailyData = useMemo(() => {
    const map: Record<string, { date: string; count: number; ratingSum: number }> = {};
    surveys.forEach((s) => {
      const day = s.submitted_at.split("T")[0];
      if (!map[day]) map[day] = { date: day, count: 0, ratingSum: 0 };
      map[day].count++;
      map[day].ratingSum += s.rating_overall || 0;
    });
    return Object.values(map).sort((a, b) => a.date.localeCompare(b.date));
  }, [surveys]);

  // セラピスト別の集計
  const therapistStats = useMemo(() => {
    const map: Record<number, { id: number; count: number; ratingSum: number; promoters: number; detractors: number }> = {};
    surveys.forEach((s) => {
      if (!s.therapist_id || !s.rating_overall) return;
      if (!map[s.therapist_id]) map[s.therapist_id] = { id: s.therapist_id, count: 0, ratingSum: 0, promoters: 0, detractors: 0 };
      const m = map[s.therapist_id];
      m.count++;
      m.ratingSum += s.rating_overall;
      if (s.rating_overall === 5) m.promoters++;
      if (s.rating_overall <= 2) m.detractors++;
    });
    return Object.values(map)
      .map((m) => ({
        ...m,
        name: therapists.find((t) => t.id === m.id)?.name || "?",
        avg: m.count > 0 ? m.ratingSum / m.count : 0,
        nps: m.count > 0 ? ((m.promoters - m.detractors) / m.count) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count);
  }, [surveys, therapists]);

  // KPIカード
  const totalCount = surveys.length;
  const avgRating = surveys.length > 0
    ? surveys.reduce((s, x) => s + (x.rating_overall || 0), 0) / surveys.length
    : 0;
  const promoters = surveys.filter((s) => s.rating_overall === 5).length;
  const detractors = surveys.filter((s) => (s.rating_overall || 0) > 0 && (s.rating_overall || 0) <= 2).length;
  const nps = totalCount > 0 ? ((promoters - detractors) / totalCount) * 100 : 0;
  const hpConsentRate = totalCount > 0 ? (surveys.filter((s) => s.hp_publish_consent).length / totalCount) * 100 : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* KPI */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8 }}>
        <KpiCard T={T} label="ご回答数" value={String(totalCount)} unit="件" />
        <KpiCard T={T} label="平均満足度" value={avgRating.toFixed(2)} unit="/ 5" emphasis={avgRating >= 4.5} />
        <KpiCard T={T} label="NPS" value={nps.toFixed(0)} unit="" emphasis={nps >= 50} subInfo={`推奨${promoters} / 批判${detractors}`} />
        <KpiCard T={T} label="HP掲載同意率" value={hpConsentRate.toFixed(0)} unit="%" />
      </div>

      {/* 日次推移グラフ（簡易SVG） */}
      <div style={{ padding: 16, backgroundColor: T.card, border: `1px solid ${T.border}` }}>
        <h3 style={{ fontSize: 13, fontWeight: 500, marginBottom: 12, marginTop: 0, color: T.text }}>
          📈 日次ご回答数の推移
        </h3>
        {dailyData.length === 0 ? (
          <p style={{ color: T.textMuted, fontSize: 11 }}>データなし</p>
        ) : (
          <DailyChart data={dailyData} T={T} />
        )}
      </div>

      {/* セラピスト別 */}
      <div style={{ padding: 16, backgroundColor: T.card, border: `1px solid ${T.border}` }}>
        <h3 style={{ fontSize: 13, fontWeight: 500, marginBottom: 12, marginTop: 0, color: T.text }}>
          👥 セラピスト別評価
        </h3>
        {therapistStats.length === 0 ? (
          <p style={{ color: T.textMuted, fontSize: 11 }}>データなし</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                  <th style={{ padding: 8, textAlign: "left", color: T.textSub }}>セラピスト</th>
                  <th style={{ padding: 8, textAlign: "right", color: T.textSub }}>件数</th>
                  <th style={{ padding: 8, textAlign: "right", color: T.textSub }}>平均</th>
                  <th style={{ padding: 8, textAlign: "right", color: T.textSub }}>NPS</th>
                  <th style={{ padding: 8, textAlign: "right", color: T.textSub }}>推奨/批判</th>
                </tr>
              </thead>
              <tbody>
                {therapistStats.map((t) => (
                  <tr key={t.id} style={{ borderBottom: `1px solid ${T.border}` }}>
                    <td style={{ padding: 8, color: T.text }}>{t.name}</td>
                    <td style={{ padding: 8, textAlign: "right", color: T.text }}>{t.count}</td>
                    <td style={{ padding: 8, textAlign: "right", color: t.avg >= 4.5 ? "#22c55e" : T.text }}>{t.avg.toFixed(2)}</td>
                    <td style={{ padding: 8, textAlign: "right", color: t.nps >= 50 ? "#22c55e" : t.nps < 0 ? "#c45555" : T.text }}>
                      {t.nps.toFixed(0)}
                    </td>
                    <td style={{ padding: 8, textAlign: "right", fontSize: 10, color: T.textMuted }}>
                      {t.promoters}/{t.detractors}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function DailyChart({ data, T }: { data: { date: string; count: number; ratingSum: number }[]; T: any }) {
  const W = 600;
  const H = 120;
  const max = Math.max(...data.map((d) => d.count), 1);
  const barW = (W - 16) / data.length;
  return (
    <svg viewBox={`0 0 ${W} ${H + 30}`} style={{ width: "100%", maxHeight: 180 }}>
      {data.map((d, i) => {
        const h = (d.count / max) * H;
        const x = 8 + i * barW;
        const y = H - h + 10;
        return (
          <g key={d.date}>
            <rect x={x} y={y} width={barW * 0.7} height={h} fill={T.accent} opacity={0.8} />
            {i % Math.ceil(data.length / 8) === 0 && (
              <text x={x} y={H + 25} fontSize={9} fill={T.textMuted}>
                {d.date.slice(5)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ─────────────────────────────────────
// タブビュー: 設定
// ─────────────────────────────────────

function SettingsView({
  pointSettings, stores, isManager, onSaved, T,
}: {
  pointSettings: PointSettings | null;
  stores: Store[];
  isManager: boolean;
  onSaved: () => void;
  T: any;
}) {
  const [couponAmount, setCouponAmount] = useState(pointSettings?.survey_coupon_amount || 1000);
  const [validMonths, setValidMonths] = useState(pointSettings?.survey_coupon_valid_months || 3);
  const [hpBonus, setHpBonus] = useState(pointSettings?.hp_publish_bonus || 500);
  const [storeUrls, setStoreUrls] = useState<Record<number, string>>(
    Object.fromEntries(stores.map((s) => [s.id, s.google_review_url || ""]))
  );
  const [storePlaceIds, setStorePlaceIds] = useState<Record<number, string>>(
    Object.fromEntries(stores.map((s) => [s.id, s.google_place_id || ""]))
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  // 手動リマインダ送信
  const [reminding, setReminding] = useState(false);
  const [reminderResult, setReminderResult] = useState<string>("");

  const handleManualReminder = async () => {
    setReminding(true);
    setReminderResult("");
    try {
      const res = await fetch("/api/cron/survey-reminder");
      const data = await res.json();
      if (!res.ok) {
        setReminderResult(`❌ エラー: ${data.error || "不明"}`);
      } else {
        const s = data.stats || {};
        setReminderResult(
          `✓ 完了: 候補 ${s.candidates}件 / 送信 ${s.sent}件 / 既回答 ${s.skippedAlreadyResponded}件 / 既送信 ${s.skippedAlreadyNotified}件 / 非会員 ${s.skippedNoMypage}件 / オプトアウト ${s.skippedOptedOut}件`
        );
      }
    } catch (e) {
      console.error(e);
      setReminderResult("❌ 通信エラー");
    } finally {
      setReminding(false);
    }
  };

  // 手動月次レポート送信
  const [reporting, setReporting] = useState(false);
  const [reportResult, setReportResult] = useState<string>("");

  const handleManualReport = async () => {
    setReporting(true);
    setReportResult("");
    try {
      const res = await fetch("/api/cron/survey-monthly-report");
      const data = await res.json();
      if (!res.ok) {
        setReportResult(`❌ エラー: ${data.error || "不明"}`);
      } else if (data.summary) {
        setReportResult(
          `✓ ${data.period} 集計: ${data.summary.total}件 / 平均${data.summary.avgRating.toFixed(2)} / NPS${data.summary.nps.toFixed(0)} ${data.emailSent ? "(メール送信済み)" : "(メール宛先未設定)"}`
        );
      } else {
        setReportResult(data.message || "完了");
      }
    } catch (e) {
      console.error(e);
      setReportResult("❌ 通信エラー");
    } finally {
      setReporting(false);
    }
  };

  useEffect(() => {
    setCouponAmount(pointSettings?.survey_coupon_amount || 1000);
    setValidMonths(pointSettings?.survey_coupon_valid_months || 3);
    setHpBonus(pointSettings?.hp_publish_bonus || 500);
  }, [pointSettings]);

  useEffect(() => {
    setStoreUrls(Object.fromEntries(stores.map((s) => [s.id, s.google_review_url || ""])));
    setStorePlaceIds(Object.fromEntries(stores.map((s) => [s.id, s.google_place_id || ""])));
  }, [stores]);

  const save = async () => {
    if (!isManager) return;
    setSaving(true);
    setMessage("");

    // point_settings 更新
    await supabase
      .from("point_settings")
      .update({
        survey_coupon_amount: couponAmount,
        survey_coupon_valid_months: validMonths,
      })
      .gt("id", 0);

    // 各店舗の URL/place_id を更新
    for (const s of stores) {
      await supabase
        .from("stores")
        .update({
          google_review_url: storeUrls[s.id] || null,
          google_place_id: storePlaceIds[s.id] || null,
        })
        .eq("id", s.id);
    }

    setSaving(false);
    setMessage("✓ 保存しました");
    setTimeout(() => setMessage(""), 2500);
    onSaved();
  };

  if (!isManager) {
    return (
      <div style={{ padding: 24, textAlign: "center" }}>
        <p style={{ color: T.textMuted }}>管理者権限が必要です</p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 720 }}>
      {/* クーポン設定 */}
      <section style={{ padding: 16, backgroundColor: T.card, border: `1px solid ${T.border}` }}>
        <h3 style={{ fontSize: 13, fontWeight: 500, marginBottom: 12, marginTop: 0 }}>🎁 アンケート回答クーポン</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
          <div>
            <label style={labelStyle(T)}>クーポン金額（円OFF）</label>
            <input
              type="number"
              value={couponAmount}
              onChange={(e) => setCouponAmount(Number(e.target.value))}
              style={inputStyle(T)}
            />
          </div>
          <div>
            <label style={labelStyle(T)}>有効期限（ヶ月）</label>
            <input
              type="number"
              value={validMonths}
              onChange={(e) => setValidMonths(Number(e.target.value))}
              style={inputStyle(T)}
            />
          </div>
        </div>
        <p style={{ fontSize: 10, color: T.textMuted, marginTop: 8, lineHeight: 1.6 }}>
          ※ 90分以上のコース限定・1予約に1枚まで・既存の割引と併用可（仕様）
        </p>
      </section>

      {/* Google レビューURL */}
      <section style={{ padding: 16, backgroundColor: T.card, border: `1px solid ${T.border}` }}>
        <h3 style={{ fontSize: 13, fontWeight: 500, marginBottom: 12, marginTop: 0 }}>🌟 Google レビュー URL（店舗ごと）</h3>
        <p style={{ fontSize: 11, color: T.textMuted, marginBottom: 12, lineHeight: 1.6 }}>
          アンケート完了画面で「Googleレビューを書く」ボタンに遷移するURL。<br />
          形式例: <code style={{ fontSize: 10, color: T.text }}>https://search.google.com/local/writereview?placeid=XXXXXXX</code>
        </p>
        {stores.map((s) => (
          <div key={s.id} style={{ marginBottom: 12 }}>
            <p style={{ fontSize: 12, fontWeight: 500, marginBottom: 6, color: T.text }}>{s.name}</p>
            <input
              type="url"
              value={storeUrls[s.id] || ""}
              onChange={(e) => setStoreUrls({ ...storeUrls, [s.id]: e.target.value })}
              placeholder="https://search.google.com/local/writereview?placeid=..."
              style={{ ...inputStyle(T), marginBottom: 4 }}
            />
            <input
              type="text"
              value={storePlaceIds[s.id] || ""}
              onChange={(e) => setStorePlaceIds({ ...storePlaceIds, [s.id]: e.target.value })}
              placeholder="Google Place ID（任意）"
              style={inputStyle(T)}
            />
          </div>
        ))}
      </section>

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          onClick={save}
          disabled={saving}
          style={{
            padding: "12px 24px",
            fontSize: 12,
            backgroundColor: T.accent,
            color: "#fff",
            border: "none",
            cursor: saving ? "wait" : "pointer",
            letterSpacing: 1,
          }}
        >
          {saving ? "保存中…" : "💾 保存"}
        </button>
        {message && <span style={{ color: "#22c55e", fontSize: 11 }}>{message}</span>}
      </div>

      {/* 手動リマインダ送信 */}
      <section style={{ padding: 16, backgroundColor: T.card, border: `1px solid ${T.border}` }}>
        <h3 style={{ fontSize: 13, fontWeight: 500, marginBottom: 12, marginTop: 0 }}>
          🔔 アンケートリマインダ通知
        </h3>
        <p style={{ fontSize: 11, color: T.textMuted, marginBottom: 12, lineHeight: 1.7 }}>
          施術完了から2〜7日前のご予約で、まだアンケートにご回答いただいていない<strong style={{ color: T.text }}>マイページ会員様</strong>に、マイページのプッシュ通知をお送りします。
          <br />
          通常は毎日 朝10時 (JST) に自動実行されます。下のボタンで手動でも即時実行できます。
        </p>
        <p style={{ fontSize: 10, color: T.textMuted, marginBottom: 12, lineHeight: 1.6 }}>
          スキップ条件: 既回答 / 既送信 / マイページ未登録 / 配信停止希望
        </p>
        <button
          onClick={handleManualReminder}
          disabled={reminding}
          style={{
            padding: "10px 20px",
            fontSize: 12,
            backgroundColor: reminding ? T.textMuted : T.cardAlt,
            color: T.text,
            border: `1px solid ${T.border}`,
            cursor: reminding ? "wait" : "pointer",
            letterSpacing: 0.5,
          }}
        >
          {reminding ? "送信中…" : "🔔 リマインダを今すぐ送る"}
        </button>
        {reminderResult && (
          <p
            style={{
              marginTop: 12,
              padding: 10,
              fontSize: 11,
              backgroundColor: T.cardAlt,
              border: `1px solid ${T.border}`,
              color: T.text,
              lineHeight: 1.6,
            }}
          >
            {reminderResult}
          </p>
        )}
      </section>

      {/* 月次レポート + 低評価アラート (Phase 4B) */}
      <section style={{ padding: 16, backgroundColor: T.card, border: `1px solid ${T.border}` }}>
        <h3 style={{ fontSize: 13, fontWeight: 500, marginBottom: 12, marginTop: 0 }}>
          📧 メール通知
        </h3>

        <div style={{ marginBottom: 16 }}>
          <p style={{ fontSize: 12, color: T.text, marginBottom: 4, fontWeight: 500 }}>
            ⚠️ 低評価アラート（即時送信）
          </p>
          <p style={{ fontSize: 11, color: T.textMuted, marginBottom: 0, lineHeight: 1.7 }}>
            評価3以下のアンケートが届いた瞬間に、設定済みの管理者メール宛 (smtp_from)
            に自動送信されます。設定不要・常時稼働中。
          </p>
        </div>

        <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 16 }}>
          <p style={{ fontSize: 12, color: T.text, marginBottom: 4, fontWeight: 500 }}>
            📊 月次レポート
          </p>
          <p style={{ fontSize: 11, color: T.textMuted, marginBottom: 12, lineHeight: 1.7 }}>
            毎月1日 朝9時 (JST) に自動送信。前月の件数・平均評価・NPS・セラピストランキング・
            クーポン使用数等のサマリー。下のボタンで即時実行できます。
          </p>
          <button
            onClick={handleManualReport}
            disabled={reporting}
            style={{
              padding: "10px 20px",
              fontSize: 12,
              backgroundColor: reporting ? T.textMuted : T.cardAlt,
              color: T.text,
              border: `1px solid ${T.border}`,
              cursor: reporting ? "wait" : "pointer",
              letterSpacing: 0.5,
            }}
          >
            {reporting ? "送信中…" : "📊 前月レポートを今すぐ送る"}
          </button>
          {reportResult && (
            <p
              style={{
                marginTop: 12,
                padding: 10,
                fontSize: 11,
                backgroundColor: T.cardAlt,
                border: `1px solid ${T.border}`,
                color: T.text,
                lineHeight: 1.6,
              }}
            >
              {reportResult}
            </p>
          )}
        </div>

        <p style={{ fontSize: 10, color: T.textMuted, marginTop: 16, lineHeight: 1.6 }}>
          ※ メール送信先は SMTP 設定の送信元アドレス (smtp_from) になります。
          <br />
          設定: システム設定 → SMTP 設定
        </p>
      </section>
    </div>
  );
}

// ─────────────────────────────────────
// 共通: 一覧の行
// ─────────────────────────────────────

function SurveyRow({
  s, therapistName, customerName, onSelect, T, alert,
}: {
  s: Survey;
  therapistName: (id: number | null) => string;
  customerName: (id: number | null) => string;
  onSelect: (s: Survey) => void;
  T: any;
  alert?: boolean;
}) {
  const rating = s.rating_overall || 0;
  return (
    <button
      onClick={() => onSelect(s)}
      style={{
        padding: 12,
        backgroundColor: T.card,
        border: `1px solid ${alert ? "#f5c6c6" : T.border}`,
        cursor: "pointer",
        textAlign: "left",
        display: "block",
        width: "100%",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
            <span style={{ color: rating >= 4 ? T.accent : rating === 3 ? "#f59e0b" : "#c45555", fontSize: 13 }}>
              {"★".repeat(rating)}{"☆".repeat(5 - rating)}
            </span>
            <span style={{ fontSize: 10, color: T.textMuted }}>
              {new Date(s.submitted_at).toLocaleDateString("ja-JP")}
            </span>
            {s.submitted_from && (
              <span style={{ fontSize: 9, padding: "1px 5px", backgroundColor: T.cardAlt, color: T.textMuted }}>
                {s.submitted_from === "qr" ? "📱QR" : s.submitted_from === "mypage" ? "💻Mypage" : s.submitted_from}
              </span>
            )}
          </div>
          <p style={{ fontSize: 12, color: T.text, margin: 0, marginBottom: 2 }}>
            {customerName(s.customer_id) || "お客様"}様
            {s.therapist_id && <span style={{ color: T.textSub, marginLeft: 8 }}>担当: {therapistName(s.therapist_id)}</span>}
          </p>
          {(s.good_points || s.final_review_text) && (
            <p
              style={{
                fontSize: 11,
                color: T.textSub,
                margin: 0,
                marginTop: 4,
                overflow: "hidden",
                textOverflow: "ellipsis",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
              }}
            >
              {s.final_review_text || s.good_points}
            </p>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, flexShrink: 0, alignItems: "flex-end" }}>
          {s.coupon_issued && <Badge color={T.accent} bg={T.cardAlt}>クーポン発行</Badge>}
          {s.hp_publish_consent && !s.hp_published && <Badge color="#f59e0b" bg="#fffbf0">承認待ち</Badge>}
          {s.hp_published && <Badge color="#22c55e" bg="#f0fdf4">HP掲載中</Badge>}
        </div>
      </div>
    </button>
  );
}

function Badge({ children, color, bg }: { children: React.ReactNode; color: string; bg: string }) {
  return (
    <span style={{ fontSize: 9, padding: "2px 6px", backgroundColor: bg, color, border: `1px solid ${color}33` }}>
      {children}
    </span>
  );
}

function KpiCard({ T, label, value, unit, emphasis, subInfo }: { T: any; label: string; value: string; unit: string; emphasis?: boolean; subInfo?: string }) {
  return (
    <div
      style={{
        padding: 14,
        backgroundColor: T.card,
        border: `1px solid ${T.border}`,
      }}
    >
      <p style={{ fontSize: 10, color: T.textSub, marginBottom: 4, marginTop: 0 }}>{label}</p>
      <p style={{ fontSize: 22, fontWeight: 500, color: emphasis ? "#22c55e" : T.text, margin: 0, lineHeight: 1 }}>
        {value}
        <span style={{ fontSize: 10, color: T.textMuted, marginLeft: 4 }}>{unit}</span>
      </p>
      {subInfo && <p style={{ fontSize: 9, color: T.textMuted, marginTop: 4, marginBottom: 0 }}>{subInfo}</p>}
    </div>
  );
}

// ─────────────────────────────────────
// 詳細モーダル
// ─────────────────────────────────────

function SurveyDetailModal({
  survey, therapistName, customerName, onClose, onPublish, saving, T,
}: {
  survey: Survey;
  therapistName: (id: number | null) => string;
  customerName: (id: number | null) => string;
  onClose: () => void;
  onPublish: (id: number, publish: boolean) => Promise<void>;
  saving: boolean;
  T: any;
}) {
  const ratingLabel = (v: string | null) => v === "good" ? "👍 よかった" : v === "normal" ? "😊 ふつう" : v === "bad" ? "🌱 改善希望" : null;
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.5)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 1000,
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: T.card,
          border: `1px solid ${T.border}`,
          maxWidth: 640,
          width: "100%",
          maxHeight: "90vh",
          overflowY: "auto",
          padding: 24,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <div>
            <p style={{ fontSize: 11, color: T.textMuted, margin: 0, marginBottom: 4 }}>
              {new Date(survey.submitted_at).toLocaleString("ja-JP")} ご回答
            </p>
            <h2 style={{ fontSize: 16, fontWeight: 500, margin: 0, color: T.text }}>
              {customerName(survey.customer_id) || "お客様"}様
              {survey.therapist_id && (
                <span style={{ color: T.textSub, marginLeft: 12, fontSize: 13 }}>
                  担当: {therapistName(survey.therapist_id)}
                </span>
              )}
            </h2>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", fontSize: 20, color: T.textMuted, cursor: "pointer" }}>
            ×
          </button>
        </div>

        {/* 評価 */}
        <div style={{ marginBottom: 16, padding: 12, backgroundColor: T.cardAlt }}>
          <p style={{ fontSize: 11, color: T.textSub, margin: 0, marginBottom: 6 }}>総合満足度</p>
          <p style={{ fontSize: 20, color: T.accent, margin: 0, letterSpacing: 2 }}>
            {"★".repeat(survey.rating_overall || 0)}{"☆".repeat(5 - (survey.rating_overall || 0))}
          </p>
        </div>

        {/* 各項目 */}
        {[
          { l: "セラピストの技術", v: survey.rating_therapist },
          { l: "サービス全体", v: survey.rating_service },
          { l: "雰囲気", v: survey.rating_atmosphere },
          { l: "清潔感", v: survey.rating_cleanliness },
          { l: "コース内容", v: survey.rating_course },
        ].map(({ l, v }) => {
          const label = ratingLabel(v);
          if (!label) return null;
          return (
            <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${T.border}`, fontSize: 12 }}>
              <span style={{ color: T.textSub }}>{l}</span>
              <span style={{ color: T.text }}>{label}</span>
            </div>
          );
        })}

        {/* 印象ポイント */}
        {survey.highlights && survey.highlights.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <p style={{ fontSize: 11, color: T.textSub, margin: 0, marginBottom: 6 }}>印象に残ったポイント</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {survey.highlights.map((h) => (
                <span key={h} style={{ fontSize: 10, padding: "3px 8px", backgroundColor: T.cardAlt, color: T.text, border: `1px solid ${T.border}` }}>
                  {h}
                </span>
              ))}
              {survey.highlights_custom && (
                <span style={{ fontSize: 10, padding: "3px 8px", backgroundColor: T.cardAlt, color: T.textSub, fontStyle: "italic" }}>
                  {survey.highlights_custom}
                </span>
              )}
            </div>
          </div>
        )}

        {/* 自由記述 */}
        {survey.good_points && (
          <div style={{ marginTop: 16 }}>
            <p style={{ fontSize: 11, color: T.textSub, margin: 0, marginBottom: 4 }}>🌸 良かった点</p>
            <p style={{ fontSize: 12, color: T.text, lineHeight: 1.7, whiteSpace: "pre-wrap", margin: 0 }}>{survey.good_points}</p>
          </div>
        )}
        {survey.improvement_points && (
          <div style={{ marginTop: 12 }}>
            <p style={{ fontSize: 11, color: T.textSub, margin: 0, marginBottom: 4 }}>✨ 改善希望</p>
            <p style={{ fontSize: 12, color: T.text, lineHeight: 1.7, whiteSpace: "pre-wrap", margin: 0 }}>{survey.improvement_points}</p>
          </div>
        )}
        {survey.therapist_message && (
          <div style={{ marginTop: 12 }}>
            <p style={{ fontSize: 11, color: T.textSub, margin: 0, marginBottom: 4 }}>💌 担当へのメッセージ</p>
            <p style={{ fontSize: 12, color: T.text, lineHeight: 1.7, whiteSpace: "pre-wrap", margin: 0 }}>{survey.therapist_message}</p>
          </div>
        )}
        {survey.final_review_text && (
          <div style={{ marginTop: 12, padding: 12, backgroundColor: T.cardAlt, border: `1px solid ${T.border}` }}>
            <p style={{ fontSize: 11, color: T.textSub, margin: 0, marginBottom: 4 }}>
              {survey.ai_generated_text ? "✨ AI言語化文章" : "📝 まとめ文章"}
            </p>
            <p style={{ fontSize: 12, color: T.text, lineHeight: 1.7, whiteSpace: "pre-wrap", margin: 0 }}>{survey.final_review_text}</p>
          </div>
        )}

        {/* HP掲載アクション */}
        {survey.hp_publish_consent && (
          <div style={{ marginTop: 20, padding: 12, backgroundColor: "#fffbf0", border: "1px solid #f5d96a" }}>
            <p style={{ fontSize: 12, fontWeight: 500, color: "#7c5a30", margin: 0, marginBottom: 8 }}>
              ✅ HP掲載に同意いただいています
            </p>
            <p style={{ fontSize: 10, color: "#7c5a30", margin: 0, marginBottom: 12, lineHeight: 1.6 }}>
              掲載: {survey.hp_published ? "公開中" : "未公開"}
              {survey.hp_display_name && <span style={{ marginLeft: 8 }}>表示名: {survey.hp_display_name}</span>}
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              {!survey.hp_published ? (
                <button onClick={() => onPublish(survey.id, true)} disabled={saving} style={btnPrimary(T)}>
                  ✓ HPに掲載する
                </button>
              ) : (
                <button onClick={() => onPublish(survey.id, false)} disabled={saving} style={btnSecondary(T)}>
                  非公開にする
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────
// スタイルヘルパー
// ─────────────────────────────────────

function inputStyle(T: any): React.CSSProperties {
  return {
    padding: "8px 10px",
    fontSize: 12,
    border: `1px solid ${T.border}`,
    backgroundColor: T.cardAlt,
    color: T.text,
    width: "100%",
    outline: "none",
  };
}

function labelStyle(T: any): React.CSSProperties {
  return {
    display: "block",
    fontSize: 10,
    color: T.textSub,
    marginBottom: 4,
  };
}

function btnPrimary(T: any): React.CSSProperties {
  return {
    padding: "10px 16px",
    fontSize: 12,
    backgroundColor: T.accent,
    color: "#fff",
    border: "none",
    cursor: "pointer",
    letterSpacing: 0.5,
  };
}

function btnSecondary(T: any): React.CSSProperties {
  return {
    padding: "10px 16px",
    fontSize: 12,
    backgroundColor: "transparent",
    color: T.textSub,
    border: `1px solid ${T.border}`,
    cursor: "pointer",
  };
}
