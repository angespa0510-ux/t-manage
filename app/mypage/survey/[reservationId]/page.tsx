"use client";

/**
 * ═══════════════════════════════════════════════════════════
 * マイページからのアンケート回答画面
 *
 * URL: /mypage/survey/[reservationId]
 *
 * 認証: localStorage 'customer_mypage_id' で本人確認
 * フォーム本体: components/survey/SurveyForm を再利用（HP版と共通）
 *
 * 設計: docs/14_REVIEW_SYSTEM.md
 * ═══════════════════════════════════════════════════════════
 */

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import {
  SurveyForm,
  C,
  FONT_SERIF,
  FONT_DISPLAY,
  containerStyle,
  cardStyle,
  linkButton,
  type SurveyFormReservation,
} from "@/components/survey/SurveyForm";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://cbewozzdyjqmhzkxsjqo.supabase.co",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
);

type Reservation = {
  id: number;
  date: string;
  start_time: string;
  end_time: string;
  course: string;
  therapist_id: number;
  customer_name: string;
  customer_status: string;
};

export default function MypageSurveyPage() {
  const params = useParams<{ reservationId: string }>();
  const reservationId = parseInt(params?.reservationId || "0", 10);

  const [customerId, setCustomerId] = useState<number | null>(null);
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [therapistName, setTherapistName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;

    const savedId = localStorage.getItem("customer_mypage_id");
    if (!savedId) {
      setError("ログインが必要です。マイページからお進みください。");
      setLoading(false);
      return;
    }

    const cid = parseInt(savedId, 10);
    setCustomerId(cid);

    if (!reservationId) {
      setError("予約情報が見つかりません");
      setLoading(false);
      return;
    }

    (async () => {
      // 予約取得
      const { data: res } = await supabase
        .from("reservations")
        .select("*")
        .eq("id", reservationId)
        .maybeSingle();

      if (!res) {
        setError("ご予約が見つかりません");
        setLoading(false);
        return;
      }
      setReservation(res);

      // 本人確認
      const { data: cust } = await supabase
        .from("customers")
        .select("name")
        .eq("id", cid)
        .maybeSingle();

      if (!cust || cust.name !== res.customer_name) {
        setError("このご予約のアンケートにはアクセスできません");
        setLoading(false);
        return;
      }

      // 既回答チェック
      const { data: existing } = await supabase
        .from("customer_surveys")
        .select("id")
        .eq("reservation_id", reservationId)
        .maybeSingle();

      if (existing) {
        setError("このご予約のアンケートはご回答済みです");
        setLoading(false);
        return;
      }

      // セラピスト
      if (res.therapist_id) {
        const { data: th } = await supabase
          .from("therapists")
          .select("name")
          .eq("id", res.therapist_id)
          .maybeSingle();
        if (th) setTherapistName(th.name);
      }

      setLoading(false);
    })();
  }, [reservationId]);

  if (loading) {
    return (
      <div style={containerStyle}>
        <p style={{ textAlign: "center", color: C.textMuted }}>読み込み中…</p>
      </div>
    );
  }

  if (error || !reservation || !customerId) {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <p style={{ color: C.accentDark, marginBottom: 16 }}>{error}</p>
          <Link href="/mypage" style={linkButton}>
            マイページに戻る
          </Link>
        </div>
      </div>
    );
  }

  const surveyReservation: SurveyFormReservation = {
    id: reservation.id,
    date: reservation.date,
    startTime: reservation.start_time,
    course: reservation.course,
    therapistId: reservation.therapist_id,
    therapistName,
  };

  return (
    <div style={containerStyle}>
      {/* ヘッダー */}
      <div style={{ marginBottom: 24 }}>
        <p style={{ fontFamily: FONT_DISPLAY, fontSize: 12, color: C.accent, letterSpacing: 2, marginBottom: 4 }}>
          CUSTOMER SURVEY
        </p>
        <h1 style={{ fontSize: 22, color: C.text, fontWeight: 500, margin: 0 }}>ご感想をお聞かせください</h1>
        <div style={{ width: 32, height: 1, backgroundColor: C.accent, margin: "12px 0" }} />
        <p style={{ fontSize: 12, color: C.textSub, lineHeight: 1.7 }}>
          所要 2〜3分。最後まで完了で{" "}
          <strong style={{ color: C.accentDark }}>1,000円OFFクーポン</strong> をプレゼント🎁
        </p>
      </div>

      <SurveyForm
        reservation={surveyReservation}
        customerId={customerId}
        backLinkHref="/mypage"
        backLinkLabel="マイページに戻る"
      />
    </div>
  );
}
