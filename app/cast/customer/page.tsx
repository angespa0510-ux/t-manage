"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "../../../lib/supabase";
import GuidePageHero, { GUIDE_T as T, GUIDE_FONT_SERIF as FONT_SERIF, GUIDE_FONT_DISPLAY as FONT_DISPLAY, GUIDE_FONT_SANS as FONT_SANS } from "../../../components/mypage/GuidePageHero";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

const fmt = (n: number) => "¥" + (n || 0).toLocaleString();

function CustomerDetailInner() {
  const searchParams = useSearchParams();
  const custName = searchParams.get("name") || "";

  const [therapistId, setTherapistId] = useState<number | null>(null);
  const [therapistName, setTherapistName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Data
  type Reservation = { id: number; customer_name: string; date: string; start_time: string; end_time: string; course: string; total_price: number; nomination: string; nomination_fee: number; options_text: string; extension_name: string; status: string; therapist_id: number };
  type CustomerNote = { id: number; therapist_id: number; customer_name: string; note: string; is_ng: boolean; ng_reason: string; rating: number };
  type CustomerInfo = { id: number; name: string; self_name: string; phone: string; birthday: string; login_email: string; total_visits: number; total_spent: number; rank: string };
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

  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [allTherapistRes, setAllTherapistRes] = useState<Reservation[]>([]);
  const [note, setNote] = useState<CustomerNote | null>(null);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [totalVisitsAllTherapists, setTotalVisitsAllTherapists] = useState(0);

  // カルテ・健康プロファイル
  const [healthProfile, setHealthProfile] = useState<HealthProfile | null>(null);
  const [charts, setCharts] = useState<TreatmentChart[]>([]);
  const [chartsExpanded, setChartsExpanded] = useState<Record<number, boolean>>({});
  const [reviewingHealth, setReviewingHealth] = useState(false);

  // Note edit
  const [editNote, setEditNote] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [noteRating, setNoteRating] = useState(0);
  const [noteNg, setNoteNg] = useState(false);
  const [noteNgReason, setNoteNgReason] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);

  const fetchData = useCallback(async () => {
    if (!therapistId || !custName) return;
    setLoading(true);

    // この セラピストとお客様の予約履歴
    const { data: res } = await supabase.from("reservations").select("*")
      .eq("therapist_id", therapistId).eq("customer_name", custName).eq("status", "completed")
      .order("date", { ascending: false });
    if (res) setAllTherapistRes(res);

    // 直近の予約（全セラピスト）
    const { data: allRes } = await supabase.from("reservations").select("*")
      .eq("customer_name", custName).eq("status", "completed")
      .order("date", { ascending: false }).limit(30);
    if (allRes) { setReservations(allRes); setTotalVisitsAllTherapists(allRes.length); }

    // セラピストメモ
    const { data: cn } = await supabase.from("therapist_customer_notes").select("*")
      .eq("therapist_id", therapistId).eq("customer_name", custName).maybeSingle();
    if (cn) { setNote(cn); setNoteText(cn.note || ""); setNoteRating(cn.rating || 0); setNoteNg(cn.is_ng || false); setNoteNgReason(cn.ng_reason || ""); }
    else { setNote(null); setNoteText(""); setNoteRating(0); setNoteNg(false); setNoteNgReason(""); }

    // 顧客マスタ情報（名前で検索）
    const cleanName = custName.replace(/\s*L$/i, "").replace(/\s+\d+～\d+歳$/, "").trim();
    const { data: ci } = await supabase.from("customers").select("id,name,self_name,phone,birthday,login_email,total_visits,total_spent,rank")
      .or(`name.eq.${cleanName},name.eq.${custName}`).limit(1).maybeSingle();
    if (ci) setCustomerInfo(ci);

    // 健康プロファイル取得 (customer_id 必須なので、customers が見つかった場合のみ)
    if (ci?.id) {
      const { data: hp } = await supabase.from("customer_health_profiles").select("*").eq("customer_id", ci.id).maybeSingle();
      if (hp) setHealthProfile(hp);
      else setHealthProfile(null);
    } else {
      setHealthProfile(null);
    }

    // 施術カルテ取得 — 2系統で取得して重複排除:
    //   ① customer_id で取得 (新しいカルテはこちらに紐付く想定)
    //   ② このお客様の予約 (allRes) の reservation_id 経由で取得 (customer_id 未補完カルテ救済)
    const chartMap = new Map<number, TreatmentChart>();
    if (ci?.id) {
      const { data: c1 } = await supabase.from("treatment_charts").select("*").eq("customer_id", ci.id).order("created_at", { ascending: false });
      (c1 as TreatmentChart[] | null)?.forEach(c => chartMap.set(c.id, c));
    }
    const allReservationIds = (allRes as Reservation[] | null)?.map(r => r.id) || [];
    if (allReservationIds.length > 0) {
      const { data: c2 } = await supabase.from("treatment_charts").select("*").in("reservation_id", allReservationIds).order("created_at", { ascending: false });
      (c2 as TreatmentChart[] | null)?.forEach(c => chartMap.set(c.id, c));
    }
    const allCharts = Array.from(chartMap.values()).sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
    setCharts(allCharts);

    setLoading(false);
  }, [therapistId, custName]);

  // ログインチェック
  useEffect(() => {
    const session = localStorage.getItem("therapist_session");
    if (session) {
      const { id } = JSON.parse(session);
      setTherapistId(id);
      supabase.from("therapists").select("name").eq("id", id).maybeSingle().then(({ data }) => {
        if (data) setTherapistName(data.name);
        else setError("セラピスト情報が取得できませんでした");
      });
    } else {
      setError("ログインが必要です。マイページからログインしてください。");
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (therapistId && custName) fetchData(); }, [therapistId, custName, fetchData]);

  const saveNote = async () => {
    if (!therapistId) return;
    setNoteSaving(true);
    if (note) {
      await supabase.from("therapist_customer_notes").update({ note: noteText, rating: noteRating, is_ng: noteNg, ng_reason: noteNgReason, updated_at: new Date().toISOString() }).eq("id", note.id);
    } else {
      await supabase.from("therapist_customer_notes").insert({ therapist_id: therapistId, customer_name: custName, note: noteText, rating: noteRating, is_ng: noteNg, ng_reason: noteNgReason });
    }
    setNoteSaving(false);
    setEditNote(false);
    fetchData();
  };

  // 健康プロファイル「確認しました」ボタン (last_reviewed_at を now() に更新)
  const reviewHealthProfile = async () => {
    if (!healthProfile) return;
    setReviewingHealth(true);
    const { error } = await supabase.from("customer_health_profiles").update({ last_reviewed_at: new Date().toISOString() }).eq("id", healthProfile.id);
    if (error) {
      alert("更新エラー: " + error.message);
      setReviewingHealth(false);
      return;
    }
    setReviewingHealth(false);
    fetchData();
  };

  const RANK_LABELS: Record<string, string> = { normal: "一般", silver: "シルバー", gold: "ゴールド", platinum: "プラチナ" };
  const RANK_COLORS: Record<string, string> = { normal: "#888", silver: "#94a3b8", gold: "#d4a843", platinum: "#a78bfa" };

  if (error) return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: T.bg, color: T.text }}>
      <div className="rounded-2xl border p-8 text-center max-w-sm w-full" style={{ backgroundColor: T.card, borderColor: T.border }}>
        <p className="text-[40px] mb-4">🔒</p>
        <p className="text-[14px] font-medium mb-2">{error}</p>
        <a href="/cast" className="inline-block mt-4 px-6 py-2.5 rounded-xl text-[12px] text-white" style={{ background: "linear-gradient(135deg, #e8849a, #d4687e)" }}>マイページへ</a>
      </div>
    </div>
  );

  if (!custName) return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: T.bg, color: T.text }}>
      <div className="rounded-2xl border p-8 text-center max-w-sm w-full" style={{ backgroundColor: T.card, borderColor: T.border }}>
        <p className="text-[14px]" style={{ color: T.textMuted }}>お客様名が指定されていません</p>
        <a href="/cast" className="inline-block mt-4 px-6 py-2.5 rounded-xl text-[12px] text-white" style={{ background: "linear-gradient(135deg, #e8849a, #d4687e)" }}>マイページへ</a>
      </div>
    </div>
  );

  const cleanDisplayName = custName.replace(/\s*L$/i, "").replace(/\s+\d+～\d+歳$/, "");
  const myVisits = allTherapistRes.length;
  const myNomVisits = allTherapistRes.filter(r => r.nomination === "本指名").length;

  return (
    <div className="min-h-screen" style={{ backgroundColor: T.bg, color: T.text, fontFamily: FONT_SERIF }}>
      <GuidePageHero
        label="CUSTOMER"
        title={`👤 ${cleanDisplayName} 様`}
        subtitle={`${therapistName} のメモ・履歴`}
        marble="soft"
      />

      {loading ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "80px 0" }}>
          <p style={{ fontSize: 12, color: T.textMuted, letterSpacing: "0.05em" }}>読み込み中...</p>
        </div>
      ) : (
        <div style={{ maxWidth: 520, margin: "0 auto", padding: "24px 16px 60px", display: "flex", flexDirection: "column", gap: 16 }}>

          {/* サマリーカード */}
          <div className="rounded-2xl border p-5" style={{ backgroundColor: T.card, borderColor: T.border }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full flex items-center justify-center text-[20px]" style={{ backgroundColor: "#e8849a18" }}>👤</div>
              <div className="flex-1">
                <h2 className="text-[16px] font-medium">{cleanDisplayName}</h2>
                <div className="flex items-center gap-2 mt-0.5">
                  {customerInfo?.rank && <span className="px-2 py-0.5 rounded-full text-[9px] font-medium" style={{ backgroundColor: (RANK_COLORS[customerInfo.rank] || "#888") + "18", color: RANK_COLORS[customerInfo.rank] || "#888" }}>{RANK_LABELS[customerInfo.rank] || customerInfo.rank}</span>}
                  {customerInfo?.login_email && <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "#3b82f612", color: "#3b82f6" }}>マイページ会員</span>}
                  {note?.is_ng && <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "#c96b8318", color: "#c96b83" }}>🚫 NG</span>}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl p-3 text-center" style={{ backgroundColor: T.cardAlt }}>
                <p className="text-[9px]" style={{ color: T.textMuted }}>総来店数</p>
                <p className="text-[18px] font-bold" style={{ color: "#e8849a" }}>{customerInfo?.total_visits || totalVisitsAllTherapists}</p>
                <p className="text-[8px]" style={{ color: T.textFaint }}>回</p>
              </div>
              <div className="rounded-xl p-3 text-center" style={{ backgroundColor: T.cardAlt }}>
                <p className="text-[9px]" style={{ color: T.textMuted }}>あなた担当</p>
                <p className="text-[18px] font-bold" style={{ color: "#d4a843" }}>{myVisits}</p>
                <p className="text-[8px]" style={{ color: T.textFaint }}>回（本指名{myNomVisits}）</p>
              </div>
              <div className="rounded-xl p-3 text-center" style={{ backgroundColor: T.cardAlt }}>
                <p className="text-[9px]" style={{ color: T.textMuted }}>評価</p>
                <p className="text-[16px]" style={{ color: "#b38419" }}>{note?.rating ? "★".repeat(note.rating) + "☆".repeat(5 - note.rating) : "—"}</p>
              </div>
            </div>

            {/* 基本情報 */}
            {customerInfo && (
              <div className="mt-4 space-y-1.5 text-[11px]">
                {customerInfo.phone && <div className="flex items-center gap-2"><span style={{ color: T.textMuted }}>📱 電話:</span><span>{customerInfo.phone}</span></div>}
                {customerInfo.birthday && <div className="flex items-center gap-2"><span style={{ color: T.textMuted }}>🎂 誕生日:</span><span>{customerInfo.birthday}</span></div>}
                {customerInfo.self_name && customerInfo.self_name !== customerInfo.name && <div className="flex items-center gap-2"><span style={{ color: T.textMuted }}>📝 登録名:</span><span>{customerInfo.self_name}</span></div>}
              </div>
            )}
          </div>

          {/* セラピストメモ */}
          <div className="rounded-2xl border p-5" style={{ backgroundColor: T.card, borderColor: T.border }}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[13px] font-medium">📝 あなたのメモ</h3>
              <button onClick={() => setEditNote(!editNote)} className="px-3 py-1 text-[10px] rounded-lg cursor-pointer" style={{ backgroundColor: "#e8849a18", color: "#e8849a" }}>{editNote ? "✕ 閉じる" : "✏️ 編集"}</button>
            </div>

            {editNote ? (
              <div className="space-y-3">
                <textarea value={noteText} onChange={e => setNoteText(e.target.value)} rows={4} placeholder="このお客様についてのメモ..."
                  className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none resize-y" style={{ backgroundColor: T.cardAlt, color: T.text, border: `1px solid ${T.border}` }} />
                <div>
                  <label className="block text-[10px] mb-1" style={{ color: T.textMuted }}>評価</label>
                  <div className="flex gap-1">{[1,2,3,4,5].map(s => (
                    <button key={s} onClick={() => setNoteRating(noteRating === s ? 0 : s)} className="text-[20px] cursor-pointer" style={{ color: s <= noteRating ? "#b38419" : T.textFaint, background: "none", border: "none" }}>{s <= noteRating ? "★" : "☆"}</button>
                  ))}</div>
                </div>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={noteNg} onChange={e => setNoteNg(e.target.checked)} className="cursor-pointer" />
                    <span className="text-[11px]" style={{ color: "#c96b83" }}>🚫 NG登録</span>
                  </label>
                  {noteNg && <input type="text" value={noteNgReason} onChange={e => setNoteNgReason(e.target.value)} placeholder="NG理由" className="flex-1 px-3 py-1.5 rounded-lg text-[11px] outline-none" style={{ backgroundColor: T.cardAlt, color: T.text, border: `1px solid ${T.border}` }} />}
                </div>
                <button onClick={saveNote} disabled={noteSaving} className="px-5 py-2 rounded-xl text-[11px] text-white cursor-pointer disabled:opacity-50" style={{ background: "linear-gradient(135deg, #e8849a, #d4687e)" }}>{noteSaving ? "保存中..." : "💾 保存"}</button>
              </div>
            ) : (
              <div>
                {note ? (
                  <div className="space-y-2">
                    {note.note && <p className="text-[12px] whitespace-pre-wrap leading-relaxed rounded-xl p-3" style={{ backgroundColor: T.cardAlt, color: T.textSub }}>{note.note}</p>}
                    {note.is_ng && <div className="rounded-xl p-3" style={{ backgroundColor: "#c96b8310", border: "1px solid #c96b8330" }}><p className="text-[11px]" style={{ color: "#c96b83" }}>🚫 NG: {note.ng_reason || "理由未記入"}</p></div>}
                    {!note.note && !note.is_ng && <p className="text-[11px]" style={{ color: T.textFaint }}>メモなし（編集ボタンで追加）</p>}
                  </div>
                ) : (
                  <p className="text-[11px]" style={{ color: T.textFaint }}>まだメモがありません。「編集」から追加できます。</p>
                )}
              </div>
            )}
          </div>

          {/* ═══ 🩺 健康プロファイル (customer_health_profiles) ═══ */}
          {healthProfile && (
            <div className="rounded-2xl border p-5" style={{ backgroundColor: T.card, borderColor: T.border }}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-[13px] font-medium">🩺 健康プロファイル</h3>
                  <span className="text-[8px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "#c96b8318", color: "#c96b83", letterSpacing: "0.05em" }}>要配慮個人情報</span>
                </div>
                <button onClick={reviewHealthProfile} disabled={reviewingHealth} className="px-3 py-1 text-[10px] rounded-lg cursor-pointer disabled:opacity-50" style={{ backgroundColor: "#6b9b7e18", color: "#6b9b7e" }}>
                  {reviewingHealth ? "..." : "✓ 確認しました"}
                </button>
              </div>

              {/* 同意状況 */}
              {healthProfile.consent_given_at ? (
                <div className="mb-3 px-3 py-2 rounded-xl text-[10px]" style={{ backgroundColor: "#6b9b7e10", color: "#6b9b7e", border: "1px solid #6b9b7e33" }}>
                  ✓ お客様より健康情報の取得同意取得済 <span style={{ color: T.textMuted, marginLeft: 8 }}>（{new Date(healthProfile.consent_given_at).toLocaleDateString("ja-JP")} · {healthProfile.consent_source || "—"}）</span>
                </div>
              ) : (
                <div className="mb-3 px-3 py-2 rounded-xl text-[10px]" style={{ backgroundColor: "#b3841910", color: "#b38419", border: "1px solid #b3841933" }}>
                  ⚠ 同意未取得 — お客様マイページから健康情報取得の同意をお取りいただく必要があります
                </div>
              )}

              {/* 重要情報を上部に */}
              <div className="space-y-2">
                {healthProfile.allergies && (
                  <div className="rounded-xl p-3" style={{ backgroundColor: "#c96b8310", border: "1px solid #c96b8330" }}>
                    <p className="text-[10px] mb-1" style={{ color: "#c96b83", letterSpacing: "0.1em" }}>⚠ アレルギー</p>
                    <p className="text-[12px] whitespace-pre-wrap" style={{ color: T.text }}>{healthProfile.allergies}</p>
                  </div>
                )}
                {healthProfile.caution_notes && (
                  <div className="rounded-xl p-3" style={{ backgroundColor: "#b3841910", border: "1px solid #b3841930" }}>
                    <p className="text-[10px] mb-1" style={{ color: "#b38419", letterSpacing: "0.1em" }}>⚠ 注意事項</p>
                    <p className="text-[12px] whitespace-pre-wrap" style={{ color: T.text }}>{healthProfile.caution_notes}</p>
                  </div>
                )}
                {healthProfile.health_conditions && (
                  <div className="rounded-xl p-3" style={{ backgroundColor: T.cardAlt }}>
                    <p className="text-[10px] mb-1" style={{ color: T.textMuted, letterSpacing: "0.1em" }}>既往症・健康状態</p>
                    <p className="text-[11px] whitespace-pre-wrap" style={{ color: T.textSub }}>{healthProfile.health_conditions}</p>
                  </div>
                )}
                {healthProfile.current_medications && (
                  <div className="rounded-xl p-3" style={{ backgroundColor: T.cardAlt }}>
                    <p className="text-[10px] mb-1" style={{ color: T.textMuted, letterSpacing: "0.1em" }}>服用中の薬</p>
                    <p className="text-[11px] whitespace-pre-wrap" style={{ color: T.textSub }}>{healthProfile.current_medications}</p>
                  </div>
                )}
              </div>

              {/* 体質・好み */}
              <div className="mt-3 grid grid-cols-2 gap-2 text-[10px]">
                {healthProfile.skin_sensitivity && (
                  <div className="rounded-lg p-2" style={{ backgroundColor: T.cardAlt }}>
                    <p style={{ color: T.textMuted }}>肌の敏感度</p>
                    <p style={{ color: T.text, fontWeight: 500 }}>
                      {healthProfile.skin_sensitivity === "normal" ? "普通" :
                       healthProfile.skin_sensitivity === "sensitive" ? "敏感" :
                       healthProfile.skin_sensitivity === "very_sensitive" ? "非常に敏感" : healthProfile.skin_sensitivity}
                    </p>
                  </div>
                )}
                {healthProfile.preferred_pressure && (
                  <div className="rounded-lg p-2" style={{ backgroundColor: T.cardAlt }}>
                    <p style={{ color: T.textMuted }}>好みの圧</p>
                    <p style={{ color: T.text, fontWeight: 500 }}>
                      {healthProfile.preferred_pressure === "soft" ? "ソフト" :
                       healthProfile.preferred_pressure === "medium" ? "標準" :
                       healthProfile.preferred_pressure === "firm" ? "しっかり" :
                       healthProfile.preferred_pressure === "extra_firm" ? "強め" : healthProfile.preferred_pressure}
                    </p>
                  </div>
                )}
              </div>

              {/* タグ系 */}
              {healthProfile.chronic_issues && healthProfile.chronic_issues.length > 0 && (
                <div className="mt-3">
                  <p className="text-[10px] mb-1.5" style={{ color: T.textMuted, letterSpacing: "0.1em" }}>慢性的な不調</p>
                  <div className="flex flex-wrap gap-1.5">
                    {healthProfile.chronic_issues.map((t, i) => (
                      <span key={i} className="text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: "#8b6cb718", color: "#8b6cb7" }}>{t}</span>
                    ))}
                  </div>
                </div>
              )}
              {healthProfile.preferred_oils && healthProfile.preferred_oils.length > 0 && (
                <div className="mt-3">
                  <p className="text-[10px] mb-1.5" style={{ color: T.textMuted, letterSpacing: "0.1em" }}>好みのオイル</p>
                  <div className="flex flex-wrap gap-1.5">
                    {healthProfile.preferred_oils.map((t, i) => (
                      <span key={i} className="text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: "#6b9b7e18", color: "#6b9b7e" }}>🌿 {t}</span>
                    ))}
                  </div>
                </div>
              )}
              {healthProfile.avoided_techniques && healthProfile.avoided_techniques.length > 0 && (
                <div className="mt-3">
                  <p className="text-[10px] mb-1.5" style={{ color: T.textMuted, letterSpacing: "0.1em" }}>避けたい技法</p>
                  <div className="flex flex-wrap gap-1.5">
                    {healthProfile.avoided_techniques.map((t, i) => (
                      <span key={i} className="text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: "#c96b8318", color: "#c96b83" }}>✕ {t}</span>
                    ))}
                  </div>
                </div>
              )}
              {healthProfile.posture_notes && (
                <div className="mt-3">
                  <p className="text-[10px] mb-1" style={{ color: T.textMuted, letterSpacing: "0.1em" }}>姿勢の特徴</p>
                  <p className="text-[11px] whitespace-pre-wrap" style={{ color: T.textSub }}>{healthProfile.posture_notes}</p>
                </div>
              )}

              {/* 最終確認日 */}
              <div className="mt-3 pt-3 border-t flex items-center justify-between text-[9px]" style={{ borderColor: T.border, color: T.textFaint }}>
                <span>最終確認: {healthProfile.last_reviewed_at ? new Date(healthProfile.last_reviewed_at).toLocaleString("ja-JP") : "—"}</span>
                <span>更新: {new Date(healthProfile.updated_at).toLocaleDateString("ja-JP")}</span>
              </div>
            </div>
          )}

          {/* 健康プロファイル未登録のヒント */}
          {customerInfo && !healthProfile && customerInfo.login_email && (
            <div className="rounded-2xl border p-4" style={{ backgroundColor: T.cardAlt, borderColor: T.border, borderStyle: "dashed" }}>
              <p className="text-[11px]" style={{ color: T.textMuted, lineHeight: 1.7 }}>
                🩺 <strong style={{ color: T.textSub }}>健康プロファイル未登録</strong><br />
                お客様マイページから健康情報を入力していただけると、より安全で適切な施術が提供できます。施術前にお声かけしてみましょう。
              </p>
            </div>
          )}

          {/* ═══ 📋 カルテ履歴 (treatment_charts) ═══ */}
          {charts.length > 0 && (
            <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: T.card, borderColor: T.border }}>
              <div className="px-5 py-3 border-b flex items-center justify-between" style={{ borderColor: T.border }}>
                <h3 className="text-[13px] font-medium">📋 施術カルテ履歴（{charts.length}件）</h3>
                <span className="text-[9px]" style={{ color: T.textMuted }}>契約書 第11条</span>
              </div>
              {charts.map((c, i) => {
                const isMine = c.therapist_id === therapistId;
                const isExpanded = !!chartsExpanded[c.id];
                const matchingRes = (c.reservation_id != null) ? (allTherapistRes.find(r => r.id === c.reservation_id) || reservations.find(r => r.id === c.reservation_id)) : undefined;
                const dateStr = matchingRes
                  ? (() => {
                      const d = new Date(matchingRes.date + "T00:00:00");
                      const days = ["日","月","火","水","木","金","土"];
                      return `${d.getMonth()+1}/${d.getDate()}(${days[d.getDay()]})`;
                    })()
                  : new Date(c.created_at).toLocaleDateString("ja-JP");
                const pressureLabel: Record<string, string> = { soft: "ソフト", medium: "標準", firm: "しっかり", extra_firm: "強め" };

                return (
                  <div key={c.id} style={{ borderTop: i > 0 ? `1px solid ${T.border}` : "none", backgroundColor: isMine ? "#e8849a06" : "transparent" }}>
                    <button
                      onClick={() => setChartsExpanded(prev => ({ ...prev, [c.id]: !prev[c.id] }))}
                      className="w-full px-5 py-3 text-left cursor-pointer"
                      style={{ background: "none", border: "none" }}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[11px] font-medium">{dateStr}</span>
                          {matchingRes?.start_time && <span className="text-[10px]" style={{ color: T.textMuted }}>{matchingRes.start_time.slice(0,5)}〜</span>}
                          {matchingRes?.course && <span className="text-[9px]" style={{ color: T.textMuted }}>📋 {matchingRes.course}</span>}
                        </div>
                        <div className="flex items-center gap-1.5">
                          {isMine && <span className="text-[8px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "#e8849a18", color: "#e8849a" }}>あなた</span>}
                          {!isMine && <span className="text-[8px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "#88888818", color: T.textMuted }}>他セラピスト</span>}
                          {c.is_finalized ? (
                            <span className="text-[8px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "#6b9b7e18", color: "#6b9b7e" }}>確定</span>
                          ) : (
                            <span className="text-[8px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "#b3841918", color: "#b38419" }}>下書き</span>
                          )}
                          <span className="text-[10px]" style={{ color: T.textFaint }}>{isExpanded ? "▲" : "▼"}</span>
                        </div>
                      </div>

                      {/* タグ・サマリー (折りたたみ時の概要) */}
                      <div className="flex items-center gap-2 text-[9px] flex-wrap" style={{ color: T.textSub }}>
                        {c.pressure_level && <span>圧: {pressureLabel[c.pressure_level] || c.pressure_level}</span>}
                        {c.body_parts && c.body_parts.length > 0 && <span>部位: {c.body_parts.slice(0, 3).join("・")}{c.body_parts.length > 3 ? "…" : ""}</span>}
                        {c.oils_used && c.oils_used.length > 0 && <span>🌿 {c.oils_used.slice(0, 2).join("・")}</span>}
                      </div>
                    </button>

                    {/* 詳細展開 */}
                    {isExpanded && (
                      <div className="px-5 pb-4 space-y-2.5 text-[11px]">
                        {/* 施術前カウンセリング */}
                        {(c.pre_condition || c.pre_concern || c.pre_request) && (
                          <div>
                            <p className="text-[9px] mb-1" style={{ color: T.textMuted, letterSpacing: "0.15em" }}>PRE-COUNSELING — 施術前</p>
                            <div className="space-y-1.5 rounded-xl p-2.5" style={{ backgroundColor: T.cardAlt }}>
                              {c.pre_condition && <div><span style={{ color: T.textMuted }}>体調:</span> {c.pre_condition}</div>}
                              {c.pre_concern && <div><span style={{ color: T.textMuted }}>気になる箇所:</span> {c.pre_concern}</div>}
                              {c.pre_request && <div><span style={{ color: T.textMuted }}>ご希望:</span> {c.pre_request}</div>}
                            </div>
                          </div>
                        )}

                        {/* 施術内容 */}
                        {(c.body_parts?.length || c.oils_used?.length || c.techniques_used?.length || c.pressure_level) && (
                          <div>
                            <p className="text-[9px] mb-1" style={{ color: T.textMuted, letterSpacing: "0.15em" }}>TREATMENT — 施術内容</p>
                            <div className="space-y-1.5">
                              {c.body_parts && c.body_parts.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                  <span style={{ color: T.textMuted }}>部位:</span>
                                  {c.body_parts.map((t, idx) => <span key={idx} className="px-1.5 py-0.5 rounded text-[10px]" style={{ backgroundColor: "#8b6cb718", color: "#8b6cb7" }}>{t}</span>)}
                                </div>
                              )}
                              {c.oils_used && c.oils_used.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                  <span style={{ color: T.textMuted }}>オイル:</span>
                                  {c.oils_used.map((t, idx) => <span key={idx} className="px-1.5 py-0.5 rounded text-[10px]" style={{ backgroundColor: "#6b9b7e18", color: "#6b9b7e" }}>🌿 {t}</span>)}
                                </div>
                              )}
                              {c.techniques_used && c.techniques_used.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                  <span style={{ color: T.textMuted }}>技法:</span>
                                  {c.techniques_used.map((t, idx) => <span key={idx} className="px-1.5 py-0.5 rounded text-[10px]" style={{ backgroundColor: "#3b82f618", color: "#3b82f6" }}>{t}</span>)}
                                </div>
                              )}
                              {c.pressure_level && (
                                <div><span style={{ color: T.textMuted }}>圧:</span> <span className="px-1.5 py-0.5 rounded text-[10px]" style={{ backgroundColor: "#e8849a18", color: "#e8849a" }}>{pressureLabel[c.pressure_level] || c.pressure_level}</span></div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* 所見 */}
                        {(c.treatment_notes || c.customer_reaction) && (
                          <div>
                            <p className="text-[9px] mb-1" style={{ color: T.textMuted, letterSpacing: "0.15em" }}>OBSERVATION — 所見</p>
                            <div className="space-y-1.5 rounded-xl p-2.5" style={{ backgroundColor: T.cardAlt }}>
                              {c.treatment_notes && <div><span style={{ color: T.textMuted }}>気付き:</span><br />{c.treatment_notes}</div>}
                              {c.customer_reaction && <div className="mt-1.5"><span style={{ color: T.textMuted }}>お客様の反応:</span><br />{c.customer_reaction}</div>}
                            </div>
                          </div>
                        )}

                        {/* 次回提案 */}
                        {(c.next_recommendation || c.recommended_interval) && (
                          <div>
                            <p className="text-[9px] mb-1" style={{ color: T.textMuted, letterSpacing: "0.15em" }}>NEXT — 次回提案</p>
                            <div className="space-y-1.5 rounded-xl p-2.5" style={{ backgroundColor: "#e8849a08", border: "1px solid #e8849a22" }}>
                              {c.recommended_interval && <div><span style={{ color: T.textMuted }}>推奨間隔:</span> {c.recommended_interval}</div>}
                              {c.next_recommendation && <div><span style={{ color: T.textMuted }}>提案内容:</span><br />{c.next_recommendation}</div>}
                            </div>
                          </div>
                        )}

                        {/* メタ */}
                        <div className="pt-2 border-t flex items-center justify-between text-[9px]" style={{ borderColor: T.border, color: T.textFaint }}>
                          <span>記入: {new Date(c.created_at).toLocaleString("ja-JP", { dateStyle: "short", timeStyle: "short" })}</span>
                          {c.updated_at !== c.created_at && <span>更新: {new Date(c.updated_at).toLocaleString("ja-JP", { dateStyle: "short", timeStyle: "short" })}</span>}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* カルテ未記入のヒント */}
          {charts.length === 0 && allTherapistRes.length > 0 && (
            <div className="rounded-2xl border p-4" style={{ backgroundColor: T.cardAlt, borderColor: T.border, borderStyle: "dashed" }}>
              <p className="text-[11px]" style={{ color: T.textMuted, lineHeight: 1.7 }}>
                📋 <strong style={{ color: T.textSub }}>カルテ未記入</strong><br />
                このお客様のカルテはまだ記入されていません。マイページの「本日のオーダー」から各予約のカルテをご記入ください。<br />
                <span className="text-[10px]" style={{ color: T.textFaint }}>※ 業務委託契約書 第11条によりカルテの記録は受託業務の一部です。</span>
              </p>
            </div>
          )}

          {/* あなたとの来店履歴 */}
          <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: T.card, borderColor: T.border }}>
            <div className="px-5 py-3 border-b" style={{ borderColor: T.border }}>
              <h3 className="text-[13px] font-medium">📋 あなたとの来店履歴（{myVisits}回）</h3>
            </div>
            {allTherapistRes.length === 0 ? (
              <p className="text-[12px] text-center py-6" style={{ color: T.textFaint }}>履歴なし</p>
            ) : allTherapistRes.map((r, i) => {
              const d = new Date(r.date + "T00:00:00"); const days = ["日","月","火","水","木","金","土"];
              return (
                <div key={r.id} className="px-5 py-3" style={{ borderTop: i > 0 ? `1px solid ${T.border}` : "none" }}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-medium">{d.getMonth()+1}/{d.getDate()}({days[d.getDay()]})</span>
                      <span className="text-[10px]" style={{ color: T.textMuted }}>{r.start_time?.slice(0,5)}〜{r.end_time?.slice(0,5)}</span>
                    </div>
                    <span className="text-[12px] font-medium" style={{ color: "#e8849a" }}>{fmt(r.total_price)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[9px] flex-wrap" style={{ color: T.textSub }}>
                    <span>📋 {r.course}</span>
                    {r.nomination && r.nomination !== "フリー" && <span style={{ color: "#e8849a" }}>指名:{r.nomination}</span>}
                    {r.options_text && <span style={{ color: "#8b6cb7" }}>OP:{r.options_text}</span>}
                    {r.extension_name && <span style={{ color: "#8b5cf6" }}>延長:{r.extension_name}</span>}
                  </div>
                </div>
              );
            })}
          </div>

          {/* 全セラピスト来店履歴（直近） */}
          {reservations.length > 0 && (
            <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: T.card, borderColor: T.border }}>
              <div className="px-5 py-3 border-b" style={{ borderColor: T.border }}>
                <h3 className="text-[13px] font-medium">🏪 全体の来店履歴（直近{Math.min(reservations.length, 30)}件）</h3>
              </div>
              {reservations.map((r, i) => {
                const d = new Date(r.date + "T00:00:00"); const days = ["日","月","火","水","木","金","土"];
                const isMe = r.therapist_id === therapistId;
                return (
                  <div key={r.id} className="px-5 py-2.5" style={{ borderTop: i > 0 ? `1px solid ${T.border}` : "none", backgroundColor: isMe ? "#e8849a06" : "transparent" }}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px]">{d.getMonth()+1}/{d.getDate()}({days[d.getDay()]})</span>
                        <span className="text-[10px]" style={{ color: T.textMuted }}>{r.start_time?.slice(0,5)}</span>
                        <span className="text-[9px]" style={{ color: T.textMuted }}>{r.course}</span>
                        {r.nomination && r.nomination !== "フリー" && <span className="text-[9px]" style={{ color: "#e8849a" }}>{r.nomination}</span>}
                      </div>
                      {isMe && <span className="text-[8px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "#e8849a18", color: "#e8849a" }}>あなた</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* マイページへ戻る */}
          <div className="text-center py-4">
            <a href="/cast" className="text-[11px] underline" style={{ color: T.textMuted }}>← マイページに戻る</a>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CustomerDetailPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><p>読み込み中...</p></div>}>
      <CustomerDetailInner />
    </Suspense>
  );
}
