"use client";

/**
 * 管理者向け 顧客のカルテ・健康プロファイル表示コンポーネント
 *
 * dashboard の顧客詳細モーダル内で使用。
 * セラピストの cast/customer/page.tsx と同様の表示を、
 * 管理者用ダーク/ライトテーマで実装。
 *
 * 関連:
 *   docs/22_CONTRACT_REDESIGN.md  第11条 施術カルテ
 *   docs/23_TREATMENT_CHART.md
 *   sql/session90_treatment_charts.sql
 *   sql/session97_treatment_charts_auto_backfill.sql
 */

import { useState, useEffect, useCallback } from "react";
import { supabase } from "../../lib/supabase";

type TreatmentChart = {
  id: number;
  reservation_id: number | null;
  customer_id: number | null;
  therapist_id: number | null;
  pre_condition: string | null; pre_concern: string | null; pre_request: string | null;
  body_parts: string[] | null; oils_used: string[] | null; techniques_used: string[] | null;
  pressure_level: string | null;
  treatment_notes: string | null; customer_reaction: string | null;
  next_recommendation: string | null; recommended_interval: string | null;
  is_finalized: boolean;
  created_at: string; updated_at: string;
};

type HealthProfile = {
  id: number; customer_id: number;
  allergies: string | null;
  skin_sensitivity: string | null;
  health_conditions: string | null;
  current_medications: string | null;
  posture_notes: string | null;
  chronic_issues: string[] | null;
  preferred_pressure: string | null;
  preferred_oils: string[] | null;
  avoided_techniques: string[] | null;
  caution_notes: string | null;
  consent_given_at: string | null;
  consent_source: string | null;
  last_reviewed_at: string | null;
  created_at: string; updated_at: string;
};

type ThemeColors = {
  bg: string; card: string; cardAlt: string; border: string;
  text: string; textSub: string; textMuted: string; textFaint: string;
  accent: string;
};

type Therapist = { id: number; name: string };

type Reservation = { id: number; customer_name: string; date: string; start_time: string; course: string };

interface Props {
  customerId: number;
  customerName: string;
  therapists: Therapist[];
  T: ThemeColors;
}

export default function CustomerHealthCharts({ customerId, customerName, therapists, T }: Props) {
  const [healthProfile, setHealthProfile] = useState<HealthProfile | null>(null);
  const [charts, setCharts] = useState<TreatmentChart[]>([]);
  const [chartReservations, setChartReservations] = useState<Map<number, Reservation>>(new Map());
  const [loading, setLoading] = useState(true);
  const [chartsExpanded, setChartsExpanded] = useState<Record<number, boolean>>({});

  const fetchData = useCallback(async () => {
    setLoading(true);

    // 健康プロファイル取得
    const { data: hp } = await supabase.from("customer_health_profiles").select("*").eq("customer_id", customerId).maybeSingle();
    setHealthProfile(hp || null);

    // カルテ取得 (customer_id 経由 + reservation_id 経由の二系統)
    const chartMap = new Map<number, TreatmentChart>();
    const { data: c1 } = await supabase.from("treatment_charts").select("*").eq("customer_id", customerId).order("created_at", { ascending: false });
    (c1 as TreatmentChart[] | null)?.forEach(c => chartMap.set(c.id, c));

    // customer_id 未補完のカルテも customer_name 経由で reservations から逆引き
    const { data: resList } = await supabase.from("reservations").select("id,customer_name,date,start_time,course").eq("customer_name", customerName);
    const resIds = (resList as Reservation[] | null)?.map(r => r.id) || [];
    if (resIds.length > 0) {
      const { data: c2 } = await supabase.from("treatment_charts").select("*").in("reservation_id", resIds).order("created_at", { ascending: false });
      (c2 as TreatmentChart[] | null)?.forEach(c => chartMap.set(c.id, c));
    }
    const allCharts = Array.from(chartMap.values()).sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
    setCharts(allCharts);

    // 予約情報の map (カルテに対応する予約日付の表示用)
    const resMap = new Map<number, Reservation>();
    (resList as Reservation[] | null)?.forEach(r => resMap.set(r.id, r));
    setChartReservations(resMap);

    setLoading(false);
  }, [customerId, customerName]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const pressureLabel: Record<string, string> = { soft: "ソフト", medium: "標準", firm: "しっかり", extra_firm: "強め" };
  const sensLabel: Record<string, string> = { normal: "普通", sensitive: "敏感", very_sensitive: "非常に敏感" };

  const getTherapistName = (tid: number | null) => {
    if (tid == null) return "—";
    return therapists.find(t => t.id === tid)?.name || `ID:${tid}`;
  };

  if (loading) {
    return (
      <div className="rounded-xl border p-4 mb-4 text-center" style={{ backgroundColor: T.cardAlt, borderColor: T.border }}>
        <p className="text-[11px]" style={{ color: T.textMuted }}>読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 🩺 健康プロファイル */}
      {healthProfile ? (
        <div className="rounded-xl border p-4" style={{ borderColor: T.border, backgroundColor: T.card }}>
          <div className="flex items-center gap-2 mb-3">
            <h3 className="text-[14px] font-medium">🩺 健康プロファイル</h3>
            <span className="text-[8px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "#c96b8318", color: "#c96b83" }}>要配慮個人情報</span>
            <span className="text-[8px] ml-auto" style={{ color: T.textMuted }}>
              {healthProfile.consent_given_at && `同意 ${new Date(healthProfile.consent_given_at).toLocaleDateString("ja-JP")}`}
            </span>
          </div>

          <div className="space-y-2">
            {healthProfile.allergies && (
              <div className="rounded-lg p-2.5" style={{ backgroundColor: "#c96b8310", border: "1px solid #c96b8330" }}>
                <p className="text-[10px] mb-0.5" style={{ color: "#c96b83", letterSpacing: "0.05em" }}>⚠ アレルギー</p>
                <p className="text-[12px] whitespace-pre-wrap" style={{ color: T.text }}>{healthProfile.allergies}</p>
              </div>
            )}
            {healthProfile.caution_notes && (
              <div className="rounded-lg p-2.5" style={{ backgroundColor: "#b3841910", border: "1px solid #b3841930" }}>
                <p className="text-[10px] mb-0.5" style={{ color: "#b38419", letterSpacing: "0.05em" }}>⚠ 注意事項</p>
                <p className="text-[12px] whitespace-pre-wrap" style={{ color: T.text }}>{healthProfile.caution_notes}</p>
              </div>
            )}
            {healthProfile.health_conditions && (
              <div className="rounded-lg p-2.5" style={{ backgroundColor: T.cardAlt }}>
                <p className="text-[10px] mb-0.5" style={{ color: T.textMuted }}>既往症・健康状態</p>
                <p className="text-[11px] whitespace-pre-wrap" style={{ color: T.textSub }}>{healthProfile.health_conditions}</p>
              </div>
            )}
            {healthProfile.current_medications && (
              <div className="rounded-lg p-2.5" style={{ backgroundColor: T.cardAlt }}>
                <p className="text-[10px] mb-0.5" style={{ color: T.textMuted }}>服用中の薬</p>
                <p className="text-[11px] whitespace-pre-wrap" style={{ color: T.textSub }}>{healthProfile.current_medications}</p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 mt-2 text-[10px]">
            {healthProfile.skin_sensitivity && (
              <div className="rounded-lg p-2" style={{ backgroundColor: T.cardAlt }}>
                <p style={{ color: T.textMuted }}>肌の敏感度</p>
                <p style={{ color: T.text, fontWeight: 500 }}>{sensLabel[healthProfile.skin_sensitivity] || healthProfile.skin_sensitivity}</p>
              </div>
            )}
            {healthProfile.preferred_pressure && (
              <div className="rounded-lg p-2" style={{ backgroundColor: T.cardAlt }}>
                <p style={{ color: T.textMuted }}>好みの圧</p>
                <p style={{ color: T.text, fontWeight: 500 }}>{pressureLabel[healthProfile.preferred_pressure] || healthProfile.preferred_pressure}</p>
              </div>
            )}
          </div>

          {healthProfile.chronic_issues && healthProfile.chronic_issues.length > 0 && (
            <div className="mt-2">
              <p className="text-[10px] mb-1" style={{ color: T.textMuted }}>慢性的な不調</p>
              <div className="flex flex-wrap gap-1">
                {healthProfile.chronic_issues.map((t, i) => (
                  <span key={i} className="text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: "#8b6cb718", color: "#8b6cb7" }}>{t}</span>
                ))}
              </div>
            </div>
          )}
          {healthProfile.preferred_oils && healthProfile.preferred_oils.length > 0 && (
            <div className="mt-2">
              <p className="text-[10px] mb-1" style={{ color: T.textMuted }}>好みのオイル</p>
              <div className="flex flex-wrap gap-1">
                {healthProfile.preferred_oils.map((t, i) => (
                  <span key={i} className="text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: "#6b9b7e18", color: "#6b9b7e" }}>🌿 {t}</span>
                ))}
              </div>
            </div>
          )}
          {healthProfile.avoided_techniques && healthProfile.avoided_techniques.length > 0 && (
            <div className="mt-2">
              <p className="text-[10px] mb-1" style={{ color: T.textMuted }}>避けたい技法</p>
              <div className="flex flex-wrap gap-1">
                {healthProfile.avoided_techniques.map((t, i) => (
                  <span key={i} className="text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: "#c96b8318", color: "#c96b83" }}>✕ {t}</span>
                ))}
              </div>
            </div>
          )}
          {healthProfile.posture_notes && (
            <div className="mt-2 rounded-lg p-2" style={{ backgroundColor: T.cardAlt }}>
              <p className="text-[10px] mb-0.5" style={{ color: T.textMuted }}>姿勢の特徴</p>
              <p className="text-[11px] whitespace-pre-wrap" style={{ color: T.textSub }}>{healthProfile.posture_notes}</p>
            </div>
          )}

          <div className="mt-3 pt-2 border-t flex items-center justify-between text-[9px]" style={{ borderColor: T.border, color: T.textFaint }}>
            <span>最終確認: {healthProfile.last_reviewed_at ? new Date(healthProfile.last_reviewed_at).toLocaleString("ja-JP") : "—"}</span>
            <span>更新: {new Date(healthProfile.updated_at).toLocaleDateString("ja-JP")}</span>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed p-3 text-[11px]" style={{ borderColor: T.border, color: T.textMuted, backgroundColor: T.cardAlt }}>
          🩺 <strong>健康プロファイル未登録</strong> · お客様マイページから入力していただく必要があります。
        </div>
      )}

      {/* 📋 カルテ履歴 */}
      {charts.length > 0 ? (
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: T.border, backgroundColor: T.card }}>
          <div className="px-4 py-2.5 border-b flex items-center justify-between" style={{ borderColor: T.border }}>
            <h3 className="text-[14px] font-medium">📋 施術カルテ履歴（{charts.length}件）</h3>
            <span className="text-[9px]" style={{ color: T.textMuted }}>契約書 第11条</span>
          </div>
          {charts.map((c, i) => {
            const isExpanded = !!chartsExpanded[c.id];
            const matchingRes = c.reservation_id != null ? chartReservations.get(c.reservation_id) : undefined;
            const dateStr = matchingRes
              ? (() => {
                  const d = new Date(matchingRes.date + "T00:00:00");
                  const days = ["日","月","火","水","木","金","土"];
                  return `${d.getMonth()+1}/${d.getDate()}(${days[d.getDay()]})`;
                })()
              : new Date(c.created_at).toLocaleDateString("ja-JP");
            const therapistName = getTherapistName(c.therapist_id);

            return (
              <div key={c.id} style={{ borderTop: i > 0 ? `1px solid ${T.border}` : "none" }}>
                <button
                  onClick={() => setChartsExpanded(prev => ({ ...prev, [c.id]: !prev[c.id] }))}
                  className="w-full px-4 py-2.5 text-left cursor-pointer"
                  style={{ background: "none", border: "none" }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] font-medium" style={{ color: T.text }}>{dateStr}</span>
                      {matchingRes?.start_time && <span className="text-[10px]" style={{ color: T.textMuted }}>{matchingRes.start_time.slice(0,5)}〜</span>}
                      {matchingRes?.course && <span className="text-[9px]" style={{ color: T.textMuted }}>📋 {matchingRes.course}</span>}
                      <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "#3b82f618", color: "#3b82f6" }}>💆 {therapistName}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {c.is_finalized ? (
                        <span className="text-[8px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "#6b9b7e18", color: "#6b9b7e" }}>確定</span>
                      ) : (
                        <span className="text-[8px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "#b3841918", color: "#b38419" }}>下書き</span>
                      )}
                      <span className="text-[10px]" style={{ color: T.textFaint }}>{isExpanded ? "▲" : "▼"}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-[9px] flex-wrap" style={{ color: T.textSub }}>
                    {c.pressure_level && <span>圧: {pressureLabel[c.pressure_level] || c.pressure_level}</span>}
                    {c.body_parts && c.body_parts.length > 0 && <span>部位: {c.body_parts.slice(0, 3).join("・")}{c.body_parts.length > 3 ? "…" : ""}</span>}
                    {c.oils_used && c.oils_used.length > 0 && <span>🌿 {c.oils_used.slice(0, 2).join("・")}</span>}
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-3 space-y-2 text-[11px]">
                    {(c.pre_condition || c.pre_concern || c.pre_request) && (
                      <div>
                        <p className="text-[9px] mb-1" style={{ color: T.textMuted, letterSpacing: "0.1em" }}>PRE-COUNSELING — 施術前</p>
                        <div className="space-y-1 rounded-lg p-2" style={{ backgroundColor: T.cardAlt }}>
                          {c.pre_condition && <div style={{ color: T.text }}><span style={{ color: T.textMuted }}>体調:</span> {c.pre_condition}</div>}
                          {c.pre_concern && <div style={{ color: T.text }}><span style={{ color: T.textMuted }}>気になる箇所:</span> {c.pre_concern}</div>}
                          {c.pre_request && <div style={{ color: T.text }}><span style={{ color: T.textMuted }}>ご希望:</span> {c.pre_request}</div>}
                        </div>
                      </div>
                    )}

                    {(c.body_parts?.length || c.oils_used?.length || c.techniques_used?.length || c.pressure_level) && (
                      <div>
                        <p className="text-[9px] mb-1" style={{ color: T.textMuted, letterSpacing: "0.1em" }}>TREATMENT — 施術内容</p>
                        <div className="space-y-1">
                          {c.body_parts && c.body_parts.length > 0 && (
                            <div className="flex flex-wrap gap-1 items-center">
                              <span style={{ color: T.textMuted }}>部位:</span>
                              {c.body_parts.map((t, idx) => <span key={idx} className="px-1.5 py-0.5 rounded text-[10px]" style={{ backgroundColor: "#8b6cb718", color: "#8b6cb7" }}>{t}</span>)}
                            </div>
                          )}
                          {c.oils_used && c.oils_used.length > 0 && (
                            <div className="flex flex-wrap gap-1 items-center">
                              <span style={{ color: T.textMuted }}>オイル:</span>
                              {c.oils_used.map((t, idx) => <span key={idx} className="px-1.5 py-0.5 rounded text-[10px]" style={{ backgroundColor: "#6b9b7e18", color: "#6b9b7e" }}>🌿 {t}</span>)}
                            </div>
                          )}
                          {c.techniques_used && c.techniques_used.length > 0 && (
                            <div className="flex flex-wrap gap-1 items-center">
                              <span style={{ color: T.textMuted }}>技法:</span>
                              {c.techniques_used.map((t, idx) => <span key={idx} className="px-1.5 py-0.5 rounded text-[10px]" style={{ backgroundColor: "#3b82f618", color: "#3b82f6" }}>{t}</span>)}
                            </div>
                          )}
                          {c.pressure_level && (
                            <div style={{ color: T.text }}><span style={{ color: T.textMuted }}>圧:</span> <span className="px-1.5 py-0.5 rounded text-[10px]" style={{ backgroundColor: "#e8849a18", color: "#e8849a" }}>{pressureLabel[c.pressure_level] || c.pressure_level}</span></div>
                          )}
                        </div>
                      </div>
                    )}

                    {(c.treatment_notes || c.customer_reaction) && (
                      <div>
                        <p className="text-[9px] mb-1" style={{ color: T.textMuted, letterSpacing: "0.1em" }}>OBSERVATION — 所見</p>
                        <div className="space-y-1 rounded-lg p-2" style={{ backgroundColor: T.cardAlt }}>
                          {c.treatment_notes && <div style={{ color: T.text }}><span style={{ color: T.textMuted }}>気付き:</span> {c.treatment_notes}</div>}
                          {c.customer_reaction && <div style={{ color: T.text }}><span style={{ color: T.textMuted }}>お客様の反応:</span> {c.customer_reaction}</div>}
                        </div>
                      </div>
                    )}

                    {(c.next_recommendation || c.recommended_interval) && (
                      <div>
                        <p className="text-[9px] mb-1" style={{ color: T.textMuted, letterSpacing: "0.1em" }}>NEXT — 次回提案</p>
                        <div className="space-y-1 rounded-lg p-2" style={{ backgroundColor: "#e8849a08", border: "1px solid #e8849a22" }}>
                          {c.recommended_interval && <div style={{ color: T.text }}><span style={{ color: T.textMuted }}>推奨間隔:</span> {c.recommended_interval}</div>}
                          {c.next_recommendation && <div style={{ color: T.text }}><span style={{ color: T.textMuted }}>提案内容:</span> {c.next_recommendation}</div>}
                        </div>
                      </div>
                    )}

                    <div className="pt-1.5 border-t flex items-center justify-between text-[9px]" style={{ borderColor: T.border, color: T.textFaint }}>
                      <span>記入: {new Date(c.created_at).toLocaleString("ja-JP", { dateStyle: "short", timeStyle: "short" })}</span>
                      {c.updated_at !== c.created_at && <span>更新: {new Date(c.updated_at).toLocaleString("ja-JP", { dateStyle: "short", timeStyle: "short" })}</span>}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed p-3 text-[11px]" style={{ borderColor: T.border, color: T.textMuted, backgroundColor: T.cardAlt }}>
          📋 <strong>施術カルテなし</strong> · このお客様のカルテはまだ記入されていません。
        </div>
      )}
    </div>
  );
}
