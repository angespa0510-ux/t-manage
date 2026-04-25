"use client";

import { useState, useEffect, useCallback } from "react";

/**
 * セラピストマイページ用 コメント返信セクション
 *
 * 自分の記事に届いた未返信コメントを一覧 → その場で返信できる
 */

type ColorTheme = {
  bg: string;
  card: string;
  cardAlt: string;
  border: string;
  text: string;
  textSub: string;
  textMuted: string;
  textFaint: string;
  accent: string;
  accentBg: string;
  accentDeep: string;
};

type CommentItem = {
  id: number;
  entryId: number;
  entryTitle: string;
  body: string;
  author: { id: number; displayName: string };
  isReplied: boolean;
  replyBody: string | null;
  replyAt: string | null;
  createdAt: string;
};

type Stats = {
  unrepliedCount: number;
  totalComments: number;
};

type Props = {
  therapistId: number;
  authToken: string;
  C: ColorTheme;
  FONT_SERIF: string;
  FONT_DISPLAY: string;
  FONT_SANS: string;
};

const MAX_REPLY = 500;

export default function TherapistCommentReplySection({
  therapistId,
  authToken,
  C,
  FONT_SERIF,
  FONT_DISPLAY,
  FONT_SANS,
}: Props) {
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"unreplied" | "replied" | "all">("unreplied");
  const [replyDrafts, setReplyDrafts] = useState<Record<number, string>>({});
  const [replyingId, setReplyingId] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // ════════════════════════════════════════════════════
  const fetchComments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/diary/comment/my-replies?therapistId=${therapistId}&authToken=${encodeURIComponent(authToken)}&filter=${filter}`
      );
      const data = await res.json();
      if (res.ok) {
        setComments(data.comments || []);
        setStats(data.stats || null);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [therapistId, authToken, filter]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  // ════════════════════════════════════════════════════
  const submitReply = async (commentId: number) => {
    setErrorMsg(null);
    const draft = (replyDrafts[commentId] || "").trim();
    if (!draft) {
      setErrorMsg("返信内容を入力してください");
      return;
    }
    if (draft.length > MAX_REPLY) {
      setErrorMsg(`${MAX_REPLY}文字以内にしてください`);
      return;
    }
    setReplyingId(commentId);
    try {
      const res = await fetch("/api/diary/comment", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          commentId,
          replyBody: draft,
          therapistId,
          authToken,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccessMsg("✨ 返信しました");
        setReplyDrafts((prev) => {
          const next = { ...prev };
          delete next[commentId];
          return next;
        });
        await fetchComments();
        setTimeout(() => setSuccessMsg(null), 3000);
      } else {
        setErrorMsg(data.error || "返信失敗");
      }
    } catch {
      setErrorMsg("通信エラー");
    } finally {
      setReplyingId(null);
    }
  };

  const fmtDateTime = (iso: string) => {
    const d = new Date(iso);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) {
      return `今日 ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    }
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  // ════════════════════════════════════════════════════
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, fontFamily: FONT_SERIF }}>
      {/* セクション見出し */}
      <div style={{ textAlign: "center", marginBottom: 4 }}>
        <p style={{ fontFamily: FONT_DISPLAY, fontSize: 11, letterSpacing: "0.25em", color: C.accent, marginBottom: 6, fontWeight: 500 }}>
          COMMENTS
        </p>
        <p style={{ fontFamily: FONT_SERIF, fontSize: 13, letterSpacing: "0.08em", color: C.text, fontWeight: 500, marginBottom: 8 }}>
          💬 コメントへの返信
          {stats && stats.unrepliedCount > 0 && (
            <span style={{ marginLeft: 8, fontSize: 10, padding: "2px 8px", backgroundColor: "#c45555", color: "#fff", verticalAlign: "middle" }}>
              未返信 {stats.unrepliedCount}
            </span>
          )}
        </p>
        <div style={{ width: 24, height: 1, backgroundColor: C.accent, margin: "0 auto" }} />
      </div>

      {successMsg && (
        <div style={{ padding: 10, backgroundColor: "#f0f7f1", border: `1px solid #6b9b7e`, fontSize: 11, color: "#3d6149", textAlign: "center" }}>
          {successMsg}
        </div>
      )}

      {/* フィルタ */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 0, border: `1px solid ${C.border}`, backgroundColor: C.card }}>
        {[
          { key: "unreplied" as const, label: "未返信" },
          { key: "replied" as const, label: "返信済み" },
          { key: "all" as const, label: "全て" },
        ].map((f, i) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            style={{
              padding: "8px 4px",
              fontSize: 11,
              cursor: "pointer",
              border: "none",
              borderLeft: i > 0 ? `1px solid ${C.border}` : "none",
              backgroundColor: filter === f.key ? C.accent : "transparent",
              color: filter === f.key ? "#fff" : C.textSub,
              fontFamily: FONT_SERIF,
              letterSpacing: "0.08em",
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* リスト */}
      {loading ? (
        <p style={{ textAlign: "center", padding: 20, color: C.textMuted, fontSize: 11 }}>読み込み中...</p>
      ) : comments.length === 0 ? (
        <div style={{ padding: 24, textAlign: "center", backgroundColor: C.card, border: `1px solid ${C.border}` }}>
          <p style={{ fontSize: 11, color: C.textSub, lineHeight: 1.6 }}>
            {filter === "unreplied" ? "未返信のコメントはありません" : "コメントはありません"}
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {comments.map((c) => (
            <div key={c.id} style={{ padding: 12, backgroundColor: C.card, border: `1px solid ${C.border}` }}>
              {/* 記事タイトル */}
              <p style={{ fontSize: 9, color: C.textMuted, marginBottom: 6, fontFamily: FONT_DISPLAY, letterSpacing: "0.1em" }}>
                記事: <span style={{ color: C.textSub }}>{c.entryTitle}</span>
              </p>
              {/* お客様コメント */}
              <div style={{ marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                  <p style={{ fontSize: 11, color: C.text, fontWeight: 500 }}>
                    {c.author.displayName}
                  </p>
                  <p style={{ fontSize: 9, color: C.textMuted, fontFamily: FONT_DISPLAY, fontVariantNumeric: "tabular-nums" }}>
                    {fmtDateTime(c.createdAt)}
                  </p>
                </div>
                <p style={{ fontSize: 12, color: C.textSub, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                  {c.body}
                </p>
              </div>

              {/* 返信フォーム or 既存返信 */}
              {c.isReplied && c.replyBody ? (
                <div style={{ padding: 10, marginLeft: 16, backgroundColor: C.accentBg, border: `1px solid ${C.accent}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                    <p style={{ fontSize: 10, color: C.accentDeep, fontWeight: 500, fontFamily: FONT_DISPLAY, letterSpacing: "0.1em" }}>
                      ↳ あなたの返信
                    </p>
                    {c.replyAt && (
                      <p style={{ fontSize: 9, color: C.textMuted, fontFamily: FONT_DISPLAY }}>
                        {fmtDateTime(c.replyAt)}
                      </p>
                    )}
                  </div>
                  <p style={{ fontSize: 11, color: C.text, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                    {c.replyBody}
                  </p>
                </div>
              ) : (
                <div style={{ marginLeft: 16, padding: 10, backgroundColor: C.cardAlt, border: `1px dashed ${C.border}` }}>
                  <p style={{ fontSize: 10, color: C.textSub, marginBottom: 6, fontFamily: FONT_DISPLAY, letterSpacing: "0.1em" }}>
                    ↳ 返信を書く
                  </p>
                  <textarea
                    value={replyDrafts[c.id] || ""}
                    onChange={(e) => setReplyDrafts((prev) => ({ ...prev, [c.id]: e.target.value }))}
                    placeholder="お返事を書いてみましょう♡"
                    rows={3}
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      fontSize: 12,
                      border: `1px solid ${C.border}`,
                      backgroundColor: C.bg,
                      color: C.text,
                      fontFamily: FONT_SERIF,
                      outline: "none",
                      resize: "vertical",
                      lineHeight: 1.6,
                    }}
                  />
                  {errorMsg && replyingId === c.id && (
                    <p style={{ fontSize: 10, color: "#c45555", marginTop: 4 }}>{errorMsg}</p>
                  )}
                  <div style={{ marginTop: 6, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <p style={{ fontSize: 9, color: (replyDrafts[c.id]?.length || 0) > MAX_REPLY ? "#c45555" : C.textMuted, fontFamily: FONT_SANS, fontVariantNumeric: "tabular-nums" }}>
                      {replyDrafts[c.id]?.length || 0}/{MAX_REPLY}
                    </p>
                    <button
                      onClick={() => submitReply(c.id)}
                      disabled={replyingId === c.id || !(replyDrafts[c.id] || "").trim()}
                      style={{
                        padding: "5px 14px",
                        fontSize: 11,
                        cursor: replyingId === c.id ? "wait" : "pointer",
                        backgroundColor: C.accent,
                        color: "#fff",
                        border: "none",
                        fontFamily: FONT_SERIF,
                        letterSpacing: "0.1em",
                        opacity: replyingId === c.id || !(replyDrafts[c.id] || "").trim() ? 0.5 : 1,
                      }}
                    >
                      {replyingId === c.id ? "返信中..." : "返信する"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
