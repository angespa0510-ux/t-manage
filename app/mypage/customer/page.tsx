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

  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [allTherapistRes, setAllTherapistRes] = useState<Reservation[]>([]);
  const [note, setNote] = useState<CustomerNote | null>(null);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [totalVisitsAllTherapists, setTotalVisitsAllTherapists] = useState(0);

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

  const RANK_LABELS: Record<string, string> = { normal: "一般", silver: "シルバー", gold: "ゴールド", platinum: "プラチナ" };
  const RANK_COLORS: Record<string, string> = { normal: "#888", silver: "#94a3b8", gold: "#d4a843", platinum: "#a78bfa" };

  if (error) return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: T.bg, color: T.text }}>
      <div className="rounded-2xl border p-8 text-center max-w-sm w-full" style={{ backgroundColor: T.card, borderColor: T.border }}>
        <p className="text-[40px] mb-4">🔒</p>
        <p className="text-[14px] font-medium mb-2">{error}</p>
        <a href="/mypage" className="inline-block mt-4 px-6 py-2.5 rounded-xl text-[12px] text-white" style={{ background: "linear-gradient(135deg, #e8849a, #d4687e)" }}>マイページへ</a>
      </div>
    </div>
  );

  if (!custName) return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: T.bg, color: T.text }}>
      <div className="rounded-2xl border p-8 text-center max-w-sm w-full" style={{ backgroundColor: T.card, borderColor: T.border }}>
        <p className="text-[14px]" style={{ color: T.textMuted }}>お客様名が指定されていません</p>
        <a href="/mypage" className="inline-block mt-4 px-6 py-2.5 rounded-xl text-[12px] text-white" style={{ background: "linear-gradient(135deg, #e8849a, #d4687e)" }}>マイページへ</a>
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
            <a href="/mypage" className="text-[11px] underline" style={{ color: T.textMuted }}>← マイページに戻る</a>
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
