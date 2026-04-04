"use client";
import { useState, useEffect } from "react";
import { supabase } from "../../../lib/supabase";

const C = { bg: "#faf8f5", card: "#ffffff", border: "#e8e3db", accent: "#c3a782", accentDark: "#b09672", accentBg: "#c3a78218", text: "#2d2a24", textSub: "#6b6860", textMuted: "#9e9a91", green: "#4a7c59", red: "#c45555" };
const fmt = (n: number) => "¥" + (n || 0).toLocaleString();
const dateFmt = (d: string) => { const dt = new Date(d + "T00:00:00"); const days = ["日", "月", "火", "水", "木", "金", "土"]; return `${dt.getFullYear()}年${dt.getMonth() + 1}月${dt.getDate()}日(${days[dt.getDay()]})`; };

type Reservation = { id: number; customer_name: string; therapist_id: number; date: string; start_time: string; end_time: string; course: string; total_price: number; nomination: string; nomination_fee: number; options_text: string; extension_name: string; extension_price: number; discount_name: string; discount_amount: number; status: string; customer_confirmed_at: string | null };
type Therapist = { id: number; name: string };

export default function ConfirmReservation() {
  const [status, setStatus] = useState<"loading" | "found" | "confirmed" | "already" | "error">("loading");
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    if (!token) { setStatus("error"); return; }
    (async () => {
      const { data: t } = await supabase.from("therapists").select("id,name"); if (t) setTherapists(t);
      const { data, error } = await supabase.from("reservations").select("*").eq("confirmation_token", token).single();
      if (error || !data) { setStatus("error"); return; }
      setReservation(data);
      if (data.status === "customer_confirmed" || data.customer_confirmed_at) { setStatus("already"); }
      else { setStatus("found"); }
    })();
  }, []);

  const confirmReservation = async () => {
    if (!reservation) return;
    setConfirming(true);
    await supabase.from("reservations").update({ status: "customer_confirmed", customer_confirmed_at: new Date().toISOString() }).eq("id", reservation.id);
    setConfirming(false);
    setStatus("confirmed");
  };

  const getTherapistName = (id: number) => therapists.find(t => t.id === id)?.name || "—";

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8" style={{ backgroundColor: C.bg }}>
      <div className="w-full max-w-[440px]">
        {/* ブランド */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 mx-auto mb-3 rounded-2xl flex items-center justify-center text-[20px] font-bold text-white" style={{ background: `linear-gradient(135deg, ${C.accent}, ${C.accentDark})` }}>C</div>
          <h1 className="text-[24px] font-light tracking-[2px]" style={{ color: C.text }}>チョップ</h1>
          <p className="text-[12px] mt-1" style={{ color: C.textMuted }}>ご予約の確認</p>
        </div>

        {/* ローディング */}
        {status === "loading" && (
          <div className="rounded-2xl border p-8 text-center" style={{ backgroundColor: C.card, borderColor: C.border }}>
            <p className="text-[14px]" style={{ color: C.textMuted }}>読み込み中...</p>
          </div>
        )}

        {/* エラー */}
        {status === "error" && (
          <div className="rounded-2xl border p-8 text-center" style={{ backgroundColor: C.card, borderColor: C.border }}>
            <p className="text-[32px] mb-3">❌</p>
            <h2 className="text-[16px] font-medium mb-2">予約が見つかりません</h2>
            <p className="text-[12px]" style={{ color: C.textMuted }}>リンクが無効か、期限切れの可能性があります。</p>
            <p className="text-[12px] mt-2" style={{ color: C.textMuted }}>お店にお問い合わせください。</p>
          </div>
        )}

        {/* 確認画面 */}
        {status === "found" && reservation && (
          <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: C.card, borderColor: C.border }}>
            <div className="px-6 py-4 text-center" style={{ borderBottom: `1px solid ${C.border}`, backgroundColor: C.accentBg }}>
              <p className="text-[13px] font-medium" style={{ color: C.accent }}>以下の予約内容をご確認ください</p>
            </div>
            <div className="px-6 py-5 space-y-3">
              <div className="flex justify-between text-[13px]"><span style={{ color: C.textSub }}>日時</span><span className="font-medium">{dateFmt(reservation.date)}</span></div>
              <div className="flex justify-between text-[13px]"><span style={{ color: C.textSub }}>時間</span><span className="font-medium">{reservation.start_time} 〜 {reservation.end_time}</span></div>
              {reservation.therapist_id > 0 && <div className="flex justify-between text-[13px]"><span style={{ color: C.textSub }}>セラピスト</span><span className="font-medium">{getTherapistName(reservation.therapist_id)}</span></div>}
              {reservation.nomination && <div className="flex justify-between text-[13px]"><span style={{ color: C.textSub }}>指名</span><span className="font-medium">{reservation.nomination}</span></div>}
              <div className="flex justify-between text-[13px]"><span style={{ color: C.textSub }}>コース</span><span className="font-medium">{reservation.course}</span></div>
              {reservation.options_text && <div className="flex justify-between text-[13px]"><span style={{ color: C.textSub }}>オプション</span><span className="font-medium">{reservation.options_text}</span></div>}
              {reservation.extension_name && <div className="flex justify-between text-[13px]"><span style={{ color: C.textSub }}>延長</span><span className="font-medium">{reservation.extension_name}</span></div>}
              {reservation.discount_name && <div className="flex justify-between text-[13px]"><span style={{ color: C.textSub }}>割引</span><span className="font-medium" style={{ color: C.red }}>-{fmt(reservation.discount_amount)}</span></div>}
              <div className="flex justify-between text-[15px] font-bold pt-2 mt-2" style={{ borderTop: `1px solid ${C.border}`, color: C.accent }}><span>合計</span><span>{fmt(reservation.total_price)}</span></div>
            </div>
            <div className="px-6 pb-6">
              <button onClick={confirmReservation} disabled={confirming} className="w-full py-4 rounded-xl text-[15px] font-medium cursor-pointer text-white disabled:opacity-60" style={{ background: `linear-gradient(135deg, ${C.accent}, ${C.accentDark})` }}>
                {confirming ? "確定中..." : "✅ 予約を確定する"}
              </button>
              <p className="text-[10px] text-center mt-3" style={{ color: C.textMuted }}>ボタンを押すと予約が確定されます</p>
            </div>
          </div>
        )}

        {/* 確定完了 */}
        {status === "confirmed" && reservation && (
          <div className="rounded-2xl border p-8 text-center" style={{ backgroundColor: C.card, borderColor: C.border }}>
            <p className="text-[48px] mb-3">✅</p>
            <h2 className="text-[18px] font-medium mb-2" style={{ color: C.green }}>ご予約が確定しました！</h2>
            <p className="text-[13px] mb-1" style={{ color: C.text }}>{dateFmt(reservation.date)} {reservation.start_time}〜</p>
            {reservation.therapist_id > 0 && <p className="text-[12px]" style={{ color: C.textSub }}>👤 {getTherapistName(reservation.therapist_id)}</p>}
            <p className="text-[12px] mt-1" style={{ color: C.textSub }}>💆 {reservation.course}</p>
            <div className="mt-4 p-4 rounded-xl" style={{ backgroundColor: C.accentBg }}>
              <p className="text-[11px]" style={{ color: C.textSub }}>翌日以降のご予約はお部屋が確定していないため、前日の夜もしくは当日の朝11時までに、ルーム詳細をメールでお送りいたします。</p>
            </div>
            <a href="/customer-mypage" className="inline-block mt-4 px-6 py-2.5 rounded-xl text-[12px] font-medium text-white" style={{ background: `linear-gradient(135deg, ${C.accent}, ${C.accentDark})` }}>マイページへ</a>
          </div>
        )}

        {/* 既に確定済み */}
        {status === "already" && reservation && (
          <div className="rounded-2xl border p-8 text-center" style={{ backgroundColor: C.card, borderColor: C.border }}>
            <p className="text-[48px] mb-3">✅</p>
            <h2 className="text-[16px] font-medium mb-2">この予約は既に確定済みです</h2>
            <p className="text-[13px]" style={{ color: C.textSub }}>{dateFmt(reservation.date)} {reservation.start_time}〜</p>
            <a href="/customer-mypage" className="inline-block mt-4 px-6 py-2.5 rounded-xl text-[12px] font-medium text-white" style={{ background: `linear-gradient(135deg, ${C.accent}, ${C.accentDark})` }}>マイページへ</a>
          </div>
        )}
      </div>
    </div>
  );
}
