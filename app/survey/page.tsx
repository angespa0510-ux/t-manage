"use client";

/**
 * ═══════════════════════════════════════════════════════════
 * HP 非会員アンケートエントリページ
 *
 * URL: /survey
 *
 * 用途:
 *   マイページ未登録のお客様も電話番号で本人確認のうえ
 *   アンケートに回答してクーポンを受け取れるようにする。
 *
 * フロー:
 *   Phase 1: 電話番号入力 → 認証
 *   Phase 2: 該当する未回答予約が複数あれば選択
 *   Phase 3: アンケート回答 (SurveyForm 共通コンポーネント)
 *   Phase 4: 完了 + クーポン表示 + マイページ登録誘導
 *
 * 設計: docs/14_REVIEW_SYSTEM.md
 * ═══════════════════════════════════════════════════════════
 */

import { useState } from "react";
import Link from "next/link";
import {
  SurveyForm,
  C,
  FONT_SERIF,
  FONT_DISPLAY,
  containerStyle,
  cardStyle,
  inputStyle,
  primaryButton,
  disabledButton,
  type SurveyFormReservation,
} from "@/components/survey/SurveyForm";

// ────────────────────────────────────────────────────────
// 型
// ────────────────────────────────────────────────────────

type PendingReservation = {
  reservationId: number;
  date: string;
  startTime: string;
  course: string;
  therapistId: number;
  therapistName: string;
};

type Phase = "auth" | "select" | "answer";

// ────────────────────────────────────────────────────────
// メイン
// ────────────────────────────────────────────────────────

export default function SurveyEntryPage() {
  const [phase, setPhase] = useState<Phase>("auth");

  // 認証フォーム
  const [phone, setPhone] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  // 認証成功後
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [customerNameMasked, setCustomerNameMasked] = useState("");
  const [pendingReservations, setPendingReservations] = useState<PendingReservation[]>([]);
  const [selectedReservation, setSelectedReservation] = useState<PendingReservation | null>(null);

  const handleAuth = async () => {
    setAuthError("");
    setAuthLoading(true);

    try {
      const res = await fetch("/api/survey/find-by-phone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();

      if (!res.ok) {
        setAuthError(data.error || "予約が見つかりません");
        setAuthLoading(false);
        return;
      }

      setCustomerId(data.customerId);
      setCustomerNameMasked(data.customerNameMasked || "");
      setPendingReservations(data.pending || []);

      // 1件のみなら即フォームへ、複数なら選択画面へ
      if (data.pending.length === 1) {
        setSelectedReservation(data.pending[0]);
        setPhase("answer");
      } else {
        setPhase("select");
      }
    } catch (e) {
      console.error(e);
      setAuthError("通信エラーが発生しました。時間をおいてお試しください。");
    } finally {
      setAuthLoading(false);
    }
  };

  // ─────────────────────────────────────
  // Phase 3: アンケート回答
  // ─────────────────────────────────────
  if (phase === "answer" && selectedReservation && customerId) {
    return (
      <div style={containerStyle}>
        <SurveyHeader />
        <SurveyForm
          reservation={
            {
              id: selectedReservation.reservationId,
              date: selectedReservation.date,
              startTime: selectedReservation.startTime,
              course: selectedReservation.course,
              therapistId: selectedReservation.therapistId,
              therapistName: selectedReservation.therapistName,
            } satisfies SurveyFormReservation
          }
          customerId={customerId}
          backLinkHref="/"
          backLinkLabel="トップに戻る"
          resultExtraMessage={<RegisterPromotion />}
        />
      </div>
    );
  }

  // ─────────────────────────────────────
  // Phase 2: 予約選択
  // ─────────────────────────────────────
  if (phase === "select") {
    return (
      <div style={containerStyle}>
        <SurveyHeader />
        <p style={{ fontSize: 12, color: C.textSub, marginBottom: 8 }}>
          {customerNameMasked} 様
        </p>
        <p style={{ fontSize: 12, color: C.text, marginBottom: 16, lineHeight: 1.7 }}>
          複数のご来店履歴がございます。<br />
          ご回答いただきたいご予約を1件選択してください。
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {pendingReservations.map((r) => (
            <button
              key={r.reservationId}
              onClick={() => {
                setSelectedReservation(r);
                setPhase("answer");
              }}
              style={{
                padding: 14,
                backgroundColor: "#fff",
                border: `1px solid ${C.borderPink}`,
                cursor: "pointer",
                textAlign: "left",
                fontFamily: FONT_SERIF,
              }}
            >
              <p style={{ fontSize: 13, color: C.text, margin: 0, marginBottom: 4 }}>
                {r.date} {r.startTime}〜
              </p>
              {r.therapistName && (
                <p style={{ fontSize: 11, color: C.accentDark, margin: 0, marginBottom: 2 }}>
                  担当: {r.therapistName}
                </p>
              )}
              <p style={{ fontSize: 11, color: C.textMuted, margin: 0 }}>{r.course}</p>
            </button>
          ))}
        </div>
        <button
          onClick={() => {
            setPhase("auth");
            setPhone("");
            setAuthError("");
          }}
          style={{
            marginTop: 16,
            padding: "12px",
            background: "transparent",
            border: "none",
            fontSize: 11,
            color: C.textMuted,
            cursor: "pointer",
            fontFamily: FONT_SERIF,
            width: "100%",
          }}
        >
          ← 別の番号で確認する
        </button>
      </div>
    );
  }

  // ─────────────────────────────────────
  // Phase 1: 電話番号認証
  // ─────────────────────────────────────
  return (
    <div style={containerStyle}>
      <SurveyHeader />

      <div style={{ ...cardStyle, marginBottom: 16, backgroundColor: C.accentBg, borderColor: C.borderPink }}>
        <p style={{ fontSize: 13, color: C.text, lineHeight: 1.7, margin: 0 }}>
          🌸 ご来店ありがとうございました。<br />
          1分のアンケートにご協力いただいた方に
          <strong style={{ color: C.accentDark }}> 1,000円OFFクーポン</strong>を発行いたします。
        </p>
        <p style={{ fontSize: 11, color: C.textSub, lineHeight: 1.7, marginTop: 12, marginBottom: 0 }}>
          ご予約時にお伺いしたお電話番号で本人確認させていただきます。
        </p>
      </div>

      <div style={cardStyle}>
        <label style={{ display: "block", fontSize: 12, color: C.text, marginBottom: 8, fontWeight: 500 }}>
          お電話番号
        </label>
        <input
          type="tel"
          inputMode="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="例: 09012345678"
          style={inputStyle}
          disabled={authLoading}
          onKeyDown={(e) => {
            if (e.key === "Enter" && phone.length >= 8) handleAuth();
          }}
        />
        <p style={{ fontSize: 10, color: C.textMuted, marginTop: 6, lineHeight: 1.5 }}>
          ハイフンの有無は問いません。ご予約時にお伺いした番号をご入力ください。
        </p>

        {authError && (
          <div
            style={{
              marginTop: 12,
              padding: "10px 12px",
              backgroundColor: "#fff5f7",
              border: `1px solid ${C.borderPink}`,
              fontSize: 12,
              color: C.accentDark,
              lineHeight: 1.6,
            }}
          >
            {authError}
          </div>
        )}

        <div style={{ marginTop: 20, display: "flex", gap: 8 }}>
          <button
            onClick={handleAuth}
            disabled={authLoading || phone.length < 8}
            style={authLoading || phone.length < 8 ? disabledButton : primaryButton}
          >
            {authLoading ? "確認中…" : "確認する"}
          </button>
        </div>
      </div>

      {/* お問い合わせ */}
      <div style={{ ...cardStyle, marginTop: 16, textAlign: "center" }}>
        <p style={{ fontSize: 11, color: C.textMuted, lineHeight: 1.7, marginBottom: 8 }}>
          うまく見つからない場合は、お電話で承ります
        </p>
        <a
          href="tel:0701675590"
          style={{
            display: "inline-block",
            fontSize: 14,
            color: C.accentDark,
            textDecoration: "none",
            fontFamily: FONT_DISPLAY,
            letterSpacing: 1,
          }}
        >
          📞 070-1675-5900
        </a>
      </div>

      <Link
        href="/"
        style={{
          display: "block",
          marginTop: 24,
          textAlign: "center",
          fontSize: 11,
          color: C.textMuted,
          textDecoration: "none",
          fontFamily: FONT_SERIF,
        }}
      >
        ← トップページに戻る
      </Link>
    </div>
  );
}

// ────────────────────────────────────────────────────────
// ヘッダー
// ────────────────────────────────────────────────────────

function SurveyHeader() {
  return (
    <div style={{ marginBottom: 24 }}>
      <p style={{ fontFamily: FONT_DISPLAY, fontSize: 12, color: C.accent, letterSpacing: 2, marginBottom: 4 }}>
        CUSTOMER SURVEY
      </p>
      <h1 style={{ fontSize: 22, color: C.text, fontWeight: 500, margin: 0 }}>ご感想をお聞かせください</h1>
      <div style={{ width: 32, height: 1, backgroundColor: C.accent, margin: "12px 0" }} />
      <p style={{ fontSize: 12, color: C.textSub, lineHeight: 1.7 }}>
        所要 2〜3分。最後まで完了で <strong style={{ color: C.accentDark }}>1,000円OFFクーポン</strong> をプレゼント🎁
      </p>
    </div>
  );
}

// ────────────────────────────────────────────────────────
// マイページ登録の誘導（完了画面に表示）
// ────────────────────────────────────────────────────────

function RegisterPromotion() {
  return (
    <div
      style={{
        padding: 16,
        backgroundColor: C.cardAlt,
        border: `1px solid ${C.borderPink}`,
      }}
    >
      <p style={{ fontSize: 12, color: C.text, lineHeight: 1.7, marginBottom: 8 }}>
        ✨ <strong style={{ color: C.accentDark }}>マイページにご登録いただくと…</strong>
      </p>
      <ul style={{ fontSize: 11, color: C.textSub, lineHeight: 1.8, paddingLeft: 16, marginBottom: 12 }}>
        <li>クーポンが自動で「マイクーポン」に保存されます</li>
        <li>ご予約・お気に入り・ポイント管理がスマホで完結</li>
        <li>限定キャンペーン情報をお届け</li>
      </ul>
      <Link
        href="/mypage?register=1"
        style={{
          display: "inline-block",
          padding: "10px 16px",
          fontSize: 11,
          backgroundColor: C.accentDark,
          color: "#fff",
          textDecoration: "none",
          fontFamily: FONT_SERIF,
          letterSpacing: 1,
        }}
      >
        🌸 マイページに登録する
      </Link>
    </div>
  );
}
