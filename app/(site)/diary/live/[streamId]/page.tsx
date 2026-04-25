"use client";

import { useState, useEffect, useRef, useCallback, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Room, RemoteVideoTrack, RemoteAudioTrack, RemoteTrackPublication, RemoteParticipant, Track } from "livekit-client";
import { SITE, MARBLE } from "../../../../../lib/site-theme";

const FONT_SERIF = "'Noto Serif JP', 'Yu Mincho', 'Hiragino Mincho ProN', serif";
const FONT_DISPLAY = "'Cormorant Garamond', 'Noto Serif JP', 'Yu Mincho', serif";

type Comment = {
  id: number;
  author: { id: number | null; displayName: string };
  body: string;
  createdAt: string;
};

type FloatingHeart = {
  id: number;
  x: number;
  emoji: string;
};

/**
 * ライブ視聴ページ
 *
 * URL: /diary/live/[streamId]
 *
 * 機能:
 *   - /api/diary/live/join で視聴トークン取得 (会員ログイン or ゲスト)
 *   - LiveKit に subscribe で参加 → 配信動画+音声をHTML video/audioで再生
 *   - ハート連打: タップで💗が画面下から上に飛ぶアニメーション
 *     - 連打時はバッファして1秒ごと/api/diary/live/heart に送信
 *   - コメント: 会員のみ投稿、3秒ごとポーリングで取得 (sinceで増分)
 */
export default function LiveViewPage({ params }: { params: Promise<{ streamId: string }> }) {
  const router = useRouter();
  const { streamId: streamIdStr } = use(params);
  const streamId = parseInt(streamIdStr);

  const [phase, setPhase] = useState<"loading" | "joining" | "live" | "ended" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [streamInfo, setStreamInfo] = useState<{ title: string; therapistName?: string } | null>(null);

  // 会員情報
  const [memberId, setMemberId] = useState<number | null>(null);
  const [memberAuth, setMemberAuth] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string>("");

  // LiveKit
  const roomRef = useRef<Room | null>(null);
  const videoEl = useRef<HTMLVideoElement>(null);
  const audioEl = useRef<HTMLAudioElement>(null);

  // 統計
  const [viewerCount, setViewerCount] = useState(0);

  // ハート関連
  const [floatingHearts, setFloatingHearts] = useState<FloatingHeart[]>([]);
  const heartBufferRef = useRef(0);
  const heartIdRef = useRef(0);

  // コメント
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentInput, setCommentInput] = useState("");
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [lastCommentAt, setLastCommentAt] = useState<string | null>(null);

  // ─────────────────────────────────────────────
  // 会員セッション読み込み
  // ─────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem("customer_session_v1");
      if (raw) {
        const session = JSON.parse(raw);
        if (session?.id && session?.authToken) {
          setMemberId(session.id);
          setMemberAuth(session.authToken);
        }
      }
    } catch {}
  }, []);

  // ─────────────────────────────────────────────
  // 参加 (joining)
  // ─────────────────────────────────────────────
  const joinStream = useCallback(async () => {
    if (!streamId || isNaN(streamId)) {
      setErrorMsg("URLが不正です");
      setPhase("error");
      return;
    }
    setPhase("joining");
    setErrorMsg(null);

    try {
      // 1. join API でトークン取得
      const joinRes = await fetch("/api/diary/live/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ streamId, customerId: memberId }),
      });
      const joinData = await joinRes.json();

      if (joinRes.status === 401 && joinData.requiresMembership) {
        setErrorMsg("この配信は会員限定です。マイページからログインしてください。");
        setPhase("error");
        return;
      }
      if (joinRes.status === 410) {
        setErrorMsg("配信は終了しました");
        setPhase("ended");
        return;
      }
      if (!joinRes.ok) {
        throw new Error(joinData.error || "視聴開始失敗");
      }

      setStreamInfo({ title: joinData.title });
      setDisplayName(joinData.displayName);

      // 2. LiveKit Room 接続
      const room = new Room({ adaptiveStream: true, dynacast: true });
      roomRef.current = room;

      room.on("trackSubscribed", (track, publication, participant) => {
        if (track.kind === Track.Kind.Video) {
          if (videoEl.current) {
            (track as RemoteVideoTrack).attach(videoEl.current);
          }
        } else if (track.kind === Track.Kind.Audio) {
          if (audioEl.current) {
            (track as RemoteAudioTrack).attach(audioEl.current);
          }
        }
      });

      room.on("trackUnsubscribed", (track) => {
        track.detach();
      });

      room.on("participantConnected", () => {
        setViewerCount(room.numParticipants - 1);
      });
      room.on("participantDisconnected", () => {
        setViewerCount(Math.max(0, room.numParticipants - 1));
      });
      room.on("disconnected", () => {
        // 配信者が切断したら ended に
        setPhase("ended");
      });

      await room.connect(joinData.wsUrl, joinData.accessToken);

      // 既存 publication を attach (room.connect 後)
      room.remoteParticipants.forEach((p: RemoteParticipant) => {
        p.trackPublications.forEach((pub: RemoteTrackPublication) => {
          if (pub.track) {
            if (pub.track.kind === Track.Kind.Video && videoEl.current) {
              (pub.track as RemoteVideoTrack).attach(videoEl.current);
            } else if (pub.track.kind === Track.Kind.Audio && audioEl.current) {
              (pub.track as RemoteAudioTrack).attach(audioEl.current);
            }
          }
        });
      });

      setViewerCount(Math.max(0, room.numParticipants - 1));
      setPhase("live");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "視聴開始エラー";
      setErrorMsg(msg);
      setPhase("error");
    }
  }, [streamId, memberId]);

  // ─────────────────────────────────────────────
  // 自動接続 (memberId/memberAuth 設定後 or なし状態確定後)
  // ─────────────────────────────────────────────
  useEffect(() => {
    // 一度だけ接続
    if (phase === "loading") {
      // メンバー情報が読み込み完了するのを少し待つ
      const t = setTimeout(() => {
        joinStream();
      }, 200);
      return () => clearTimeout(t);
    }
  }, [phase, joinStream]);

  // ─────────────────────────────────────────────
  // 切断時のクリーンアップ
  // ─────────────────────────────────────────────
  useEffect(() => {
    return () => {
      // 視聴離脱通知
      if (streamId) {
        fetch("/api/diary/live/join", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ streamId }),
        }).catch(() => {});
      }
      try { roomRef.current?.disconnect(); } catch {}
    };
  }, [streamId]);

  // ─────────────────────────────────────────────
  // ハート連打
  // ─────────────────────────────────────────────
  const heartEmojis = ["💗", "💕", "💖", "✨", "🌸"];
  const sendHeart = () => {
    if (phase !== "live") return;
    // フローティングハート追加
    const id = heartIdRef.current++;
    const x = 30 + Math.random() * 40; // 30-70%
    const emoji = heartEmojis[Math.floor(Math.random() * heartEmojis.length)];
    setFloatingHearts((prev) => [...prev, { id, x, emoji }]);
    // 2秒後に削除
    setTimeout(() => {
      setFloatingHearts((prev) => prev.filter((h) => h.id !== id));
    }, 2000);
    // バッファに加算
    heartBufferRef.current++;
  };

  // 1秒ごとにバッファをサーバーに送信
  useEffect(() => {
    if (phase !== "live") return;
    const t = setInterval(() => {
      if (heartBufferRef.current > 0) {
        const count = heartBufferRef.current;
        heartBufferRef.current = 0;
        fetch("/api/diary/live/heart", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ streamId, customerId: memberId, count }),
        }).catch(() => {});
      }
    }, 1000);
    return () => clearInterval(t);
  }, [phase, streamId, memberId]);

  // ─────────────────────────────────────────────
  // コメント取得 (3秒ごとポーリング、since以降増分のみ)
  // ─────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "live") return;
    const fetchComments = async () => {
      try {
        const url = lastCommentAt
          ? `/api/diary/live/comment?streamId=${streamId}&since=${encodeURIComponent(lastCommentAt)}`
          : `/api/diary/live/comment?streamId=${streamId}&limit=30`;
        const res = await fetch(url);
        const data = await res.json();
        if (res.ok && Array.isArray(data.comments) && data.comments.length > 0) {
          if (lastCommentAt) {
            setComments((prev) => [...prev, ...data.comments]);
          } else {
            setComments(data.comments);
          }
          setLastCommentAt(data.comments[data.comments.length - 1].createdAt);
        }
      } catch {}
    };
    fetchComments();
    const t = setInterval(fetchComments, 3000);
    return () => clearInterval(t);
  }, [phase, streamId, lastCommentAt]);

  // ─────────────────────────────────────────────
  // コメント投稿
  // ─────────────────────────────────────────────
  const submitComment = async () => {
    if (!commentInput.trim() || !memberId) return;
    setCommentSubmitting(true);
    try {
      const res = await fetch("/api/diary/live/comment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ streamId, customerId: memberId, body: commentInput.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setCommentInput("");
        // 自分のコメントを即時追加 (ポーリング待たずに)
        setComments((prev) => [...prev, {
          id: data.commentId,
          author: data.author,
          body: commentInput.trim(),
          createdAt: data.createdAt,
        }]);
        setLastCommentAt(data.createdAt);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setCommentSubmitting(false);
    }
  };

  // ═════════════════════════════════════════════
  // レンダリング
  // ═════════════════════════════════════════════
  return (
    <main style={{ minHeight: "100vh", backgroundColor: "#000", color: "#fff", fontFamily: FONT_SERIF, position: "relative", overflow: "hidden" }}>
      {/* 戻るボタン */}
      <Link href="/diary/live" style={{ position: "absolute", top: 14, left: 14, zIndex: 10, padding: "6px 12px", backgroundColor: "rgba(0,0,0,0.6)", color: "#fff", fontSize: 11, textDecoration: "none", border: `1px solid rgba(255,255,255,0.2)`, fontFamily: FONT_SERIF }}>
        ← 一覧
      </Link>

      {/* ─── loading / joining / error ─── */}
      {(phase === "loading" || phase === "joining") && (
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
          <div>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🎬</div>
            <p style={{ fontSize: 14, color: "#fff", marginBottom: 6 }}>配信に接続中...</p>
            <p style={{ fontSize: 10, color: "#aaa" }}>少々お待ちください</p>
          </div>
        </div>
      )}

      {phase === "error" && (
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ textAlign: "center", maxWidth: 360 }}>
            <p style={{ fontSize: 14, color: "#fff", marginBottom: 8 }}>⚠ 視聴できませんでした</p>
            <p style={{ fontSize: 11, color: "#ccc", lineHeight: 1.7, marginBottom: 16 }}>
              {errorMsg}
            </p>
            <button
              onClick={() => router.push("/customer-mypage")}
              style={{ padding: "10px 20px", fontSize: 12, cursor: "pointer", backgroundColor: SITE.color.pink, color: "#fff", border: "none", fontFamily: FONT_SERIF, marginRight: 8 }}
            >
              マイページへ
            </button>
            <Link href="/diary/live" style={{ padding: "10px 20px", fontSize: 12, backgroundColor: "transparent", color: "#fff", border: `1px solid #fff`, textDecoration: "none", fontFamily: FONT_SERIF }}>
              一覧へ戻る
            </Link>
          </div>
        </div>
      )}

      {phase === "ended" && (
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>👋</div>
            <p style={{ fontSize: 16, color: "#fff", marginBottom: 8 }}>配信は終了しました</p>
            <p style={{ fontSize: 12, color: "#aaa", marginBottom: 20 }}>ご視聴ありがとうございました</p>
            <Link href="/diary/live" style={{ padding: "10px 20px", fontSize: 12, backgroundColor: SITE.color.pink, color: "#fff", textDecoration: "none", fontFamily: FONT_SERIF }}>
              他のライブを見る →
            </Link>
          </div>
        </div>
      )}

      {/* ─── live ─── */}
      {phase === "live" && (
        <>
          {/* 動画 (フルスクリーン) */}
          <video
            ref={videoEl}
            autoPlay
            playsInline
            muted={false}
            style={{ width: "100%", height: "100vh", objectFit: "contain", backgroundColor: "#000" }}
          />
          <audio ref={audioEl} autoPlay />

          {/* オーバーレイ: タイトル */}
          <div style={{ position: "absolute", top: 14, right: 14, padding: "6px 12px", backgroundColor: "rgba(0,0,0,0.6)", fontSize: 11, fontFamily: FONT_SERIF }}>
            👥 {viewerCount}
          </div>
          {streamInfo && (
            <div style={{ position: "absolute", top: 56, left: 14, right: 14, padding: "8px 12px", backgroundColor: "rgba(0,0,0,0.5)", borderLeft: `2px solid ${SITE.color.pink}` }}>
              <p style={{ fontSize: 9, color: "#dc3250", fontWeight: 500, letterSpacing: "0.15em", marginBottom: 2, fontFamily: FONT_DISPLAY }}>🔴 LIVE</p>
              <p style={{ fontSize: 13, color: "#fff", fontWeight: 500 }}>{streamInfo.title}</p>
            </div>
          )}

          {/* フローティングハート */}
          <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
            {floatingHearts.map((h) => (
              <span
                key={h.id}
                style={{
                  position: "absolute",
                  bottom: 100,
                  left: `${h.x}%`,
                  fontSize: 28,
                  animation: "floatUp 2s ease-out forwards",
                }}
              >
                {h.emoji}
              </span>
            ))}
          </div>

          {/* 右側: コメント表示 (最新10件) */}
          <div style={{ position: "absolute", left: 14, right: 80, bottom: 70, maxHeight: 280, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4, pointerEvents: "none" }}>
            {comments.slice(-10).map((c) => (
              <div key={c.id} style={{ padding: "4px 10px", backgroundColor: "rgba(0,0,0,0.55)", maxWidth: "fit-content" }}>
                <span style={{ fontSize: 9, color: SITE.color.pink, fontFamily: FONT_DISPLAY, marginRight: 8, letterSpacing: "0.05em" }}>
                  {c.author.displayName}
                </span>
                <span style={{ fontSize: 11, color: "#fff" }}>{c.body}</span>
              </div>
            ))}
          </div>

          {/* 右下: ハートボタン */}
          <button
            onClick={sendHeart}
            style={{
              position: "absolute",
              right: 14,
              bottom: 80,
              width: 60,
              height: 60,
              borderRadius: "50%",
              border: "none",
              backgroundColor: "rgba(220, 50, 80, 0.85)",
              color: "#fff",
              fontSize: 28,
              cursor: "pointer",
              boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
            }}
          >
            💗
          </button>

          {/* 下部: コメント入力 */}
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: 10, backgroundColor: "rgba(0,0,0,0.7)", display: "flex", gap: 6, alignItems: "center" }}>
            {memberId ? (
              <>
                <input
                  type="text"
                  value={commentInput}
                  onChange={(e) => setCommentInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !commentSubmitting) submitComment(); }}
                  placeholder="コメントを送る..."
                  maxLength={100}
                  style={{
                    flex: 1,
                    padding: "8px 12px",
                    fontSize: 12,
                    border: "1px solid rgba(255,255,255,0.2)",
                    backgroundColor: "rgba(255,255,255,0.1)",
                    color: "#fff",
                    fontFamily: FONT_SERIF,
                    outline: "none",
                  }}
                />
                <button
                  onClick={submitComment}
                  disabled={!commentInput.trim() || commentSubmitting}
                  style={{
                    padding: "8px 14px",
                    fontSize: 12,
                    cursor: !commentInput.trim() || commentSubmitting ? "not-allowed" : "pointer",
                    backgroundColor: SITE.color.pink,
                    color: "#fff",
                    border: "none",
                    fontFamily: FONT_SERIF,
                    opacity: !commentInput.trim() || commentSubmitting ? 0.5 : 1,
                  }}
                >
                  送信
                </button>
              </>
            ) : (
              <p style={{ flex: 1, fontSize: 11, color: "#bbb", textAlign: "center", padding: 8 }}>
                💗 コメントには会員ログインが必要です
              </p>
            )}
          </div>
        </>
      )}

      <style>{`
        @keyframes floatUp {
          0% {
            transform: translateY(0) scale(1);
            opacity: 1;
          }
          100% {
            transform: translateY(-300px) scale(1.5) rotate(${Math.random() * 60 - 30}deg);
            opacity: 0;
          }
        }
      `}</style>
    </main>
  );
}
