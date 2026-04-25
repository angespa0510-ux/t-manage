"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { SITE } from "../../lib/site-theme";
import { useCustomerAuth } from "../../lib/customer-auth-context";

/**
 * 写メ日記 個別記事ページ用 コメントセクション
 *
 * 機能:
 *   - コメント一覧表示
 *   - セラピストの返信表示 (インデント)
 *   - 会員のみ投稿可
 *   - 自分のコメント削除可
 */

type Comment = {
  id: number;
  body: string;
  author: { id: number; displayName: string };
  isHidden: boolean;
  isReplied: boolean;
  replyBody: string | null;
  replyAt: string | null;
  createdAt: string;
};

type Props = {
  entryId: number;
  therapistName: string;
};

const MAX_COMMENT = 500;

export default function DiaryComments({ entryId, therapistName }: Props) {
  const { customer } = useCustomerAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // ════════════════════════════════════════════════════
  const fetchComments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/diary/comment?entryId=${entryId}&limit=50`);
      const data = await res.json();
      if (res.ok) {
        setComments(data.comments || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [entryId]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  // ════════════════════════════════════════════════════
  const submitComment = async () => {
    setErrorMsg(null);
    if (!customer) {
      window.location.href = "/login";
      return;
    }
    const trimmed = body.trim();
    if (!trimmed) {
      setErrorMsg("コメントを入力してください");
      return;
    }
    if (trimmed.length > MAX_COMMENT) {
      setErrorMsg(`${MAX_COMMENT}文字以内にしてください`);
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/diary/comment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryId, customerId: customer.id, body: trimmed }),
      });
      const data = await res.json();
      if (res.ok) {
        setBody("");
        await fetchComments();
      } else {
        setErrorMsg(data.error || "投稿失敗");
      }
    } catch {
      setErrorMsg("通信エラー");
    } finally {
      setSubmitting(false);
    }
  };

  const deleteComment = async (commentId: number) => {
    if (!customer) return;
    if (!confirm("このコメントを削除しますか?")) return;
    setDeletingId(commentId);
    try {
      const res = await fetch("/api/diary/comment", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commentId, customerId: customer.id }),
      });
      if (res.ok) {
        await fetchComments();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setDeletingId(null);
    }
  };

  // ════════════════════════════════════════════════════
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
    <section style={{ marginTop: 48, paddingTop: 28, borderTop: `1px solid ${SITE.color.border}` }}>
      <p
        style={{
          fontFamily: SITE.font.display,
          fontSize: SITE.fs.tiny,
          letterSpacing: SITE.ls.wider,
          color: SITE.color.pinkDeep,
          marginBottom: 8,
          fontWeight: 500,
          textAlign: "center",
        }}
      >
        COMMENTS
      </p>
      <p
        style={{
          fontFamily: SITE.font.serif,
          fontSize: SITE.fs.lead,
          color: SITE.color.text,
          fontWeight: 500,
          letterSpacing: SITE.ls.loose,
          textAlign: "center",
          marginBottom: 24,
        }}
      >
        コメント ({comments.length})
      </p>

      {/* 投稿フォーム */}
      {customer ? (
        <div style={{ marginBottom: 28, padding: 18, backgroundColor: SITE.color.surfaceAlt, border: `1px solid ${SITE.color.border}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
            <p style={{ fontSize: SITE.fs.xs, color: SITE.color.textSub, fontFamily: SITE.font.serif }}>
              {customer.self_name || `${customer.name?.charAt(0) || ""}***`} さん
            </p>
            <p style={{ fontSize: 10, color: body.length > MAX_COMMENT ? "#c45555" : SITE.color.textMuted, fontFamily: SITE.font.display, fontVariantNumeric: "tabular-nums" }}>
              {body.length}/{MAX_COMMENT}
            </p>
          </div>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={`${therapistName}さんにコメントを送る...`}
            rows={3}
            style={{
              width: "100%",
              padding: "10px 12px",
              fontSize: SITE.fs.sm,
              border: `1px solid ${SITE.color.border}`,
              backgroundColor: SITE.color.surface,
              color: SITE.color.text,
              fontFamily: SITE.font.serif,
              outline: "none",
              resize: "vertical",
              lineHeight: 1.7,
              letterSpacing: SITE.ls.normal,
            }}
          />
          {errorMsg && (
            <p style={{ fontSize: SITE.fs.xs, color: "#c45555", marginTop: 6, fontFamily: SITE.font.serif }}>
              {errorMsg}
            </p>
          )}
          <div style={{ marginTop: 10, textAlign: "right" }}>
            <button
              onClick={submitComment}
              disabled={submitting || !body.trim()}
              style={{
                padding: "8px 24px",
                fontSize: SITE.fs.sm,
                cursor: submitting || !body.trim() ? "not-allowed" : "pointer",
                backgroundColor: SITE.color.pink,
                color: "#fff",
                border: "none",
                fontFamily: SITE.font.serif,
                letterSpacing: SITE.ls.loose,
                opacity: submitting || !body.trim() ? 0.5 : 1,
              }}
            >
              {submitting ? "投稿中..." : "コメントする"}
            </button>
          </div>
        </div>
      ) : (
        <div
          style={{
            marginBottom: 28,
            padding: 18,
            backgroundColor: SITE.color.surfaceAlt,
            border: `1px solid ${SITE.color.borderPink}`,
            textAlign: "center",
          }}
        >
          <p style={{ fontSize: SITE.fs.sm, color: SITE.color.textSub, marginBottom: 12, fontFamily: SITE.font.serif, lineHeight: SITE.lh.body }}>
            会員登録するとコメントできます
          </p>
          <Link
            href="/login"
            style={{
              display: "inline-block",
              padding: "8px 22px",
              fontSize: SITE.fs.sm,
              backgroundColor: SITE.color.pink,
              color: "#fff",
              textDecoration: "none",
              fontFamily: SITE.font.serif,
              letterSpacing: SITE.ls.loose,
            }}
          >
            ログイン / 会員登録
          </Link>
        </div>
      )}

      {/* コメント一覧 */}
      {loading ? (
        <p style={{ textAlign: "center", padding: 20, color: SITE.color.textMuted, fontSize: SITE.fs.sm, fontFamily: SITE.font.serif }}>
          読み込み中...
        </p>
      ) : comments.length === 0 ? (
        <p style={{ textAlign: "center", padding: 20, color: SITE.color.textMuted, fontSize: SITE.fs.sm, fontFamily: SITE.font.serif }}>
          まだコメントがありません
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {comments.map((comment) => (
            <div key={comment.id} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {/* お客様コメント */}
              <div
                style={{
                  padding: 14,
                  backgroundColor: SITE.color.surface,
                  border: `1px solid ${SITE.color.border}`,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                  <p style={{ fontSize: SITE.fs.xs, color: SITE.color.textSub, fontWeight: 500, fontFamily: SITE.font.serif }}>
                    {comment.author.displayName}
                  </p>
                  <p style={{ fontSize: 10, color: SITE.color.textMuted, fontFamily: SITE.font.display, letterSpacing: SITE.ls.normal }}>
                    {fmtDateTime(comment.createdAt)}
                  </p>
                </div>
                <p style={{ fontSize: SITE.fs.sm, color: SITE.color.text, lineHeight: 1.7, whiteSpace: "pre-wrap", fontFamily: SITE.font.serif, letterSpacing: SITE.ls.normal }}>
                  {comment.body}
                </p>
                {customer && customer.id === comment.author.id && (
                  <div style={{ marginTop: 8, textAlign: "right" }}>
                    <button
                      onClick={() => deleteComment(comment.id)}
                      disabled={deletingId === comment.id}
                      style={{
                        padding: "3px 10px",
                        fontSize: 10,
                        cursor: deletingId === comment.id ? "wait" : "pointer",
                        backgroundColor: "transparent",
                        color: SITE.color.textMuted,
                        border: `1px solid ${SITE.color.border}`,
                        fontFamily: SITE.font.serif,
                        letterSpacing: SITE.ls.normal,
                      }}
                    >
                      {deletingId === comment.id ? "削除中..." : "削除"}
                    </button>
                  </div>
                )}
              </div>

              {/* セラピスト返信 */}
              {comment.isReplied && comment.replyBody && (
                <div
                  style={{
                    marginLeft: 24,
                    padding: 14,
                    backgroundColor: SITE.color.pinkSoft,
                    border: `1px solid ${SITE.color.borderPink}`,
                    position: "relative",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                    <p
                      style={{
                        fontSize: SITE.fs.xs,
                        color: SITE.color.pinkDeep,
                        fontWeight: 500,
                        fontFamily: SITE.font.display,
                        letterSpacing: SITE.ls.wide,
                      }}
                    >
                      ↳ {therapistName} より
                    </p>
                    {comment.replyAt && (
                      <p style={{ fontSize: 10, color: SITE.color.textMuted, fontFamily: SITE.font.display, letterSpacing: SITE.ls.normal }}>
                        {fmtDateTime(comment.replyAt)}
                      </p>
                    )}
                  </div>
                  <p style={{ fontSize: SITE.fs.sm, color: SITE.color.text, lineHeight: 1.7, whiteSpace: "pre-wrap", fontFamily: SITE.font.serif, letterSpacing: SITE.ls.normal }}>
                    {comment.replyBody}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
