"use client";

/**
 * ═══════════════════════════════════════════════════════════
 * セラピスト用「お客様の声」タブ
 *
 * 場所: /cast → ワーク → 🌸 お客様の声
 *
 * 機能:
 *  - 自分宛のHP掲載承認済みアンケート一覧
 *  - 各レビューに返信フォーム（任意）
 *  - 返信済みは編集可
 *  - 返信時にお客様にプッシュ通知が飛ぶ
 *
 * 設計書: docs/14_REVIEW_SYSTEM.md
 * ═══════════════════════════════════════════════════════════
 */

import { useState, useEffect } from "react";

type Review = {
  id: number;
  rating: number;
  highlights: string[];
  goodPoints: string;
  improvementPoints: string;
  therapistMessage: string;
  finalReviewText: string;
  displayName: string;
  approvedAt: string | null;
  therapistReply: string | null;
  therapistReplyAt: string | null;
  notifiedAt: string | null;
  submittedAt: string;
};

type T = {
  bg: string; card: string; cardAlt: string; border: string;
  text: string; textSub: string; textMuted: string; textFaint: string;
  accent: string; accentBg: string; accentDeep: string;
};

export default function CastReviewsTab({ therapistId, T, FONT_SERIF, FONT_DISPLAY }: {
  therapistId: number;
  T: T;
  FONT_SERIF: string;
  FONT_DISPLAY: string;
}) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (therapistId) void fetchReviews();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [therapistId]);

  const fetchReviews = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/survey/therapist-list?therapistId=${therapistId}`);
      const data = await res.json();
      setReviews(data.reviews || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <p style={{ textAlign: "center", padding: 32, color: T.textMuted, fontSize: 12 }}>読み込み中…</p>;
  }

  if (reviews.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: 48 }}>
        <p style={{ fontSize: 14, color: T.text, marginBottom: 8 }}>まだ承認済みのご感想はありません</p>
        <p style={{ fontSize: 11, color: T.textMuted, lineHeight: 1.7 }}>
          お客様からアンケートをいただき、<br />
          スタッフがHP掲載を承認すると、<br />
          ここに表示されます🌸
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* 見出し */}
      <div style={{ textAlign: "center", marginBottom: 8 }}>
        <p style={{ margin: 0, fontFamily: FONT_DISPLAY, fontSize: 11, letterSpacing: "0.25em", color: T.accent, textTransform: "uppercase" }}>
          GUEST VOICES
        </p>
        <h2 style={{ margin: "8px 0 0", fontFamily: FONT_DISPLAY, fontSize: 22, fontWeight: 400, letterSpacing: "0.1em", color: T.text }}>
          お客様の声
        </h2>
        <div style={{ width: 32, height: 1, backgroundColor: T.accent, margin: "12px auto" }} />
        <p style={{ fontSize: 11, color: T.textMuted, lineHeight: 1.7, maxWidth: 320, margin: "0 auto" }}>
          HP掲載承認済みのご感想です。<br />
          ぜひお客様にお返事を送ってあげてください💌
        </p>
      </div>

      {reviews.map((r) => (
        <div key={r.id}>
          <ReviewItem
            review={r}
            therapistId={therapistId}
            onSaved={fetchReviews}
            T={T}
            FONT_SERIF={FONT_SERIF}
            FONT_DISPLAY={FONT_DISPLAY}
          />
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────
// 1件のレビュー（返信フォーム付き）
// ─────────────────────────────────────

function ReviewItem({
  review, therapistId, onSaved, T, FONT_SERIF, FONT_DISPLAY,
}: {
  review: Review;
  therapistId: number;
  onSaved: () => void;
  T: T;
  FONT_SERIF: string;
  FONT_DISPLAY: string;
}) {
  const [reply, setReply] = useState(review.therapistReply || "");
  const [editing, setEditing] = useState(!review.therapistReply);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const hasReply = Boolean(review.therapistReply);
  const isModified = reply.trim() !== (review.therapistReply || "").trim();

  const handleSave = async () => {
    if (!reply.trim()) return;
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/survey/therapist-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          surveyId: review.id,
          therapistId,
          reply: reply.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(`❌ ${data.error || "送信失敗"}`);
      } else {
        setMessage(`✓ ${data.message}`);
        setEditing(false);
        setTimeout(() => setMessage(""), 3000);
        onSaved();
      }
    } catch (e) {
      console.error(e);
      setMessage("❌ 通信エラー");
    } finally {
      setSaving(false);
    }
  };

  const date = review.approvedAt
    ? new Date(review.approvedAt).toLocaleDateString("ja-JP", { month: "long", day: "numeric" })
    : "";

  return (
    <div
      style={{
        padding: 18,
        backgroundColor: T.card,
        border: `1px solid ${T.border}`,
        borderRadius: 6,
      }}
    >
      {/* ヘッダー */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <span style={{ color: T.accent, fontSize: 16, letterSpacing: 2 }}>
          {"★".repeat(review.rating)}
          <span style={{ color: T.textFaint }}>{"★".repeat(5 - review.rating)}</span>
        </span>
        <span style={{ fontSize: 10, color: T.textMuted, fontFamily: FONT_DISPLAY }}>{date}</span>
      </div>

      {/* お客様（匿名） */}
      <p style={{ fontSize: 12, color: T.textSub, margin: 0, marginBottom: 12, fontFamily: FONT_SERIF }}>
        {review.displayName} より
      </p>

      {/* 担当へのメッセージ（最重要） */}
      {review.therapistMessage && (
        <div
          style={{
            padding: 14,
            backgroundColor: T.accentBg,
            border: `1px solid ${T.accent}33`,
            marginBottom: 12,
          }}
        >
          <p style={{ fontSize: 10, color: T.accent, fontFamily: FONT_DISPLAY, letterSpacing: 2, margin: 0, marginBottom: 6 }}>
            💌 MESSAGE FOR YOU
          </p>
          <p style={{ fontSize: 12.5, color: T.text, lineHeight: 1.85, fontFamily: FONT_SERIF, whiteSpace: "pre-wrap", margin: 0 }}>
            {review.therapistMessage}
          </p>
        </div>
      )}

      {/* 良かった点 */}
      {review.goodPoints && (
        <div style={{ marginBottom: 12 }}>
          <p style={{ fontSize: 10, color: T.textMuted, marginBottom: 4 }}>🌸 良かった点</p>
          <p style={{ fontSize: 12, color: T.text, lineHeight: 1.7, fontFamily: FONT_SERIF, margin: 0, whiteSpace: "pre-wrap" }}>
            {review.goodPoints}
          </p>
        </div>
      )}

      {/* 改善希望 */}
      {review.improvementPoints && (
        <div style={{ marginBottom: 12 }}>
          <p style={{ fontSize: 10, color: T.textMuted, marginBottom: 4 }}>✨ 改善希望</p>
          <p style={{ fontSize: 12, color: T.text, lineHeight: 1.7, fontFamily: FONT_SERIF, margin: 0, whiteSpace: "pre-wrap" }}>
            {review.improvementPoints}
          </p>
        </div>
      )}

      {/* ハイライト */}
      {review.highlights.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 14 }}>
          {review.highlights.map((h) => (
            <span
              key={h}
              style={{
                fontSize: 10,
                padding: "3px 8px",
                backgroundColor: T.accentBg,
                color: T.accent,
                border: `1px solid ${T.accent}33`,
              }}
            >
              {h}
            </span>
          ))}
        </div>
      )}

      {/* 返信エリア */}
      <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px dashed ${T.border}` }}>
        <p
          style={{
            fontFamily: FONT_DISPLAY,
            fontSize: 10,
            letterSpacing: 2,
            color: T.accent,
            textTransform: "uppercase",
            marginBottom: 8,
          }}
        >
          {hasReply ? "💌 YOUR REPLY" : "✏️ お返事を送る"}
        </p>

        {!editing && hasReply && (
          <div
            style={{
              padding: 12,
              backgroundColor: T.cardAlt,
              border: `1px solid ${T.border}`,
              fontSize: 12.5,
              color: T.text,
              fontFamily: FONT_SERIF,
              lineHeight: 1.85,
              whiteSpace: "pre-wrap",
              marginBottom: 8,
            }}
          >
            {review.therapistReply}
          </div>
        )}

        {!editing && hasReply ? (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 10, color: T.textMuted }}>
              送信日:{" "}
              {review.therapistReplyAt
                ? new Date(review.therapistReplyAt).toLocaleString("ja-JP")
                : ""}
            </span>
            <button
              onClick={() => setEditing(true)}
              style={{
                padding: "6px 14px",
                fontSize: 11,
                backgroundColor: "transparent",
                color: T.accent,
                border: `1px solid ${T.accent}66`,
                cursor: "pointer",
                fontFamily: FONT_SERIF,
              }}
            >
              編集する
            </button>
          </div>
        ) : (
          <>
            <textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder="お客様にお返事を送りましょう🌸 ご来店ありがとうございました、また会えるのを楽しみに…など"
              maxLength={1000}
              rows={4}
              style={{
                width: "100%",
                padding: 12,
                fontSize: 13,
                backgroundColor: T.cardAlt,
                border: `1px solid ${T.border}`,
                color: T.text,
                fontFamily: FONT_SERIF,
                lineHeight: 1.7,
                resize: "vertical",
                outline: "none",
                marginBottom: 8,
              }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 10, color: T.textMuted }}>{reply.length} / 1000</span>
              <div style={{ display: "flex", gap: 8 }}>
                {hasReply && (
                  <button
                    onClick={() => {
                      setReply(review.therapistReply || "");
                      setEditing(false);
                    }}
                    style={{
                      padding: "8px 16px",
                      fontSize: 11,
                      backgroundColor: "transparent",
                      color: T.textSub,
                      border: `1px solid ${T.border}`,
                      cursor: "pointer",
                      fontFamily: FONT_SERIF,
                    }}
                  >
                    キャンセル
                  </button>
                )}
                <button
                  onClick={handleSave}
                  disabled={saving || !reply.trim() || !isModified}
                  style={{
                    padding: "10px 20px",
                    fontSize: 12,
                    backgroundColor: T.accent,
                    color: "#fff",
                    border: "none",
                    cursor: saving || !reply.trim() ? "not-allowed" : "pointer",
                    opacity: saving || !reply.trim() || !isModified ? 0.5 : 1,
                    fontFamily: FONT_SERIF,
                    letterSpacing: 1,
                  }}
                >
                  {saving ? "送信中…" : hasReply ? "更新する" : "💌 送信"}
                </button>
              </div>
            </div>
            <p style={{ fontSize: 10, color: T.textMuted, marginTop: 8, lineHeight: 1.6 }}>
              ※ 送信するとお客様にプッシュ通知が届き、HPの「お客様の声」にも自動反映されます。
            </p>
          </>
        )}

        {message && (
          <p
            style={{
              marginTop: 8,
              fontSize: 11,
              color: message.startsWith("✓") ? "#22c55e" : "#c45555",
            }}
          >
            {message}
          </p>
        )}
      </div>
    </div>
  );
}
