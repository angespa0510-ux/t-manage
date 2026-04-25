"use client";

import { useState, useEffect, useRef, useCallback, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Room, RemoteVideoTrack, RemoteAudioTrack, RemoteTrackPublication, RemoteParticipant, Track } from "livekit-client";
import { SITE, MARBLE } from "../../../../../lib/site-theme";
import GiftModal from "../../../../../components/gift-modal";
import type { GiftKind } from "../../../../../lib/gift-catalog";
import { useCustomerAuth, displayName as displayNameOf } from "../../../../../lib/customer-auth-context";

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

  // 会員情報 (HP 共通の CustomerAuthContext から取得)
  // 旧実装は localStorage('customer_session_v1') を見ていたが、HP 全体は
  // 'customer_mypage_id' キーを使う設計なので常にログアウト扱いになり、
  // ログイン中なのに「投げ銭には会員ログインが必要」が出るバグがあった。
  const { customer: authCustomer, refreshSummary } = useCustomerAuth();
  const memberId: number | null = authCustomer?.id ?? null;
  const memberName: string = displayNameOf(authCustomer);
  // join API が返す displayName (鈴木 → 鈴●など)。コメント送信時の表示名に使う
  const [serverDisplayName, setServerDisplayName] = useState<string>("");

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

  // ギフト
  const [giftModalOpen, setGiftModalOpen] = useState(false);
  type FloatingGift = { id: number; emoji: string; size: number; x: number; message: string | null; senderName: string };
  const [floatingGifts, setFloatingGifts] = useState<FloatingGift[]>([]);
  const giftIdRef = useRef(0);
  const [recentGifts, setRecentGifts] = useState<{ id: number; senderName: string; emoji: string; pointAmount: number; message: string | null }[]>([]);
  const [lastGiftAt, setLastGiftAt] = useState<string | null>(null);

  // コメント
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentInput, setCommentInput] = useState("");
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [lastCommentAt, setLastCommentAt] = useState<string | null>(null);

  // ─────────────────────────────────────────────
  // 会員セッションは CustomerAuthContext が読み込み済み
  // (旧実装のここで localStorage('customer_session_v1') を読んでいたが、
  //  そのキーは存在せず常にログアウト扱いになっていたため Context 化)
  // ─────────────────────────────────────────────

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

      setStreamInfo({ title: joinData.title, therapistName: joinData.therapistName });
      setServerDisplayName(joinData.displayName || "");

      // 2. LiveKit Room 接続
      const room = new Room({ adaptiveStream: true, dynacast: true });
      roomRef.current = room;

      // 動画トラックを attach するヘルパー (要素がまだ無い場合は短くリトライ)
      const attachVideo = (track: RemoteVideoTrack, retry = 0) => {
        if (videoEl.current) {
          try {
            track.attach(videoEl.current);
          } catch (e) {
            console.warn("video attach failed:", e);
          }
        } else if (retry < 20) {
          // 最大 20回 × 50ms = 1秒待つ
          setTimeout(() => attachVideo(track, retry + 1), 50);
        } else {
          console.error("videoEl.current が用意されないまま 1秒経過");
        }
      };
      const attachAudio = (track: RemoteAudioTrack, retry = 0) => {
        if (audioEl.current) {
          try {
            track.attach(audioEl.current);
          } catch (e) {
            console.warn("audio attach failed:", e);
          }
        } else if (retry < 20) {
          setTimeout(() => attachAudio(track, retry + 1), 50);
        }
      };

      room.on("trackSubscribed", (track, _publication, _participant) => {
        if (track.kind === Track.Kind.Video) {
          attachVideo(track as RemoteVideoTrack);
        } else if (track.kind === Track.Kind.Audio) {
          attachAudio(track as RemoteAudioTrack);
        }
      });

      room.on("trackUnsubscribed", (track) => {
        track.detach();
      });

      room.on("participantConnected", () => {
        setViewerCount(Math.max(0, room.numParticipants - 1));
      });
      room.on("participantDisconnected", () => {
        setViewerCount(Math.max(0, room.numParticipants - 1));
      });
      room.on("disconnected", () => {
        // 配信者が切断したら ended に
        setPhase("ended");
      });

      // ★ 重要: LiveKit 接続 & attach の前に phase='live' にして
      //   video/audio 要素を DOM に出しておく。
      //   旧実装では setPhase('live') が attach の後だったため、
      //   videoEl.current=null で attach が無視され画面が真っ黒になる
      //   バグがあった (配信側の startCamera と同種の DOM タイミング問題)。
      setPhase("live");

      // React のレンダリング完了を確実に待つ
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      await new Promise<void>((resolve) => setTimeout(resolve, 50));

      await room.connect(joinData.wsUrl, joinData.accessToken);

      // 既存 publication を attach (room.connect 後)
      // attachVideo / attachAudio ヘルパーを使い、要素がまだ無くてもリトライさせる
      room.remoteParticipants.forEach((p: RemoteParticipant) => {
        p.trackPublications.forEach((pub: RemoteTrackPublication) => {
          if (pub.track) {
            if (pub.track.kind === Track.Kind.Video) {
              attachVideo(pub.track as RemoteVideoTrack);
            } else if (pub.track.kind === Track.Kind.Audio) {
              attachAudio(pub.track as RemoteAudioTrack);
            }
          }
        });
      });

      setViewerCount(Math.max(0, room.numParticipants - 1));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "視聴開始エラー";
      setErrorMsg(msg);
      setPhase("error");
      try { roomRef.current?.disconnect(); } catch {}
      roomRef.current = null;
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
  // ギフト処理
  // ─────────────────────────────────────────────
  const onGiftSent = (sentGift: { kind: GiftKind; emoji: string; pointAmount: number; message: string | null }) => {
    // 自分のギフトを画面に演出
    showFloatingGift(
      sentGift.emoji,
      sentGift.pointAmount,
      sentGift.message,
      serverDisplayName || memberName || "あなた"
    );
    // ヘッダーのポイント残高を即時更新
    refreshSummary().catch(() => {});
  };

  const showFloatingGift = (emoji: string, pointAmount: number, message: string | null, senderName: string) => {
    const id = giftIdRef.current++;
    const size = pointAmount >= 1000 ? 80 : pointAmount >= 300 ? 60 : pointAmount >= 100 ? 48 : 36;
    const x = 25 + Math.random() * 50;
    setFloatingGifts((prev) => [...prev, { id, emoji, size, x, message, senderName }]);
    // 3秒後に削除 (ギフトはハートより長く表示)
    setTimeout(() => {
      setFloatingGifts((prev) => prev.filter((g) => g.id !== id));
    }, 3500);
    // recent list にも追加 (右側表示用)
    setRecentGifts((prev) => [...prev, { id, senderName, emoji, pointAmount, message }].slice(-5));
    setTimeout(() => {
      setRecentGifts((prev) => prev.filter((g) => g.id !== id));
    }, 6000);
  };

  // 他人のギフトをポーリング (5秒ごと、since以降増分)
  useEffect(() => {
    if (phase !== "live") return;
    const fetchGifts = async () => {
      try {
        const url = lastGiftAt
          ? `/api/gift/list?sourceType=live&sourceId=${streamId}&since=${encodeURIComponent(lastGiftAt)}`
          : `/api/gift/list?sourceType=live&sourceId=${streamId}&limit=10`;
        const res = await fetch(url);
        const data = await res.json();
        if (res.ok && Array.isArray(data.gifts) && data.gifts.length > 0) {
          for (const g of data.gifts) {
            // 自分が送ったギフトは onGiftSent で既に表示済みなのでスキップ
            if (g.sender.id === memberId) continue;
            showFloatingGift(g.gift.emoji || "🎁", g.gift.pointAmount, g.message, g.sender.displayName);
          }
          setLastGiftAt(data.gifts[data.gifts.length - 1].createdAt);
        }
      } catch {}
    };
    fetchGifts();
    const t = setInterval(fetchGifts, 5000);
    return () => clearInterval(t);
  }, [phase, streamId, lastGiftAt, memberId]);

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
            {/* フローティングギフト (ハートより大きく長く) */}
            {floatingGifts.map((g) => (
              <div
                key={`gift-${g.id}`}
                style={{
                  position: "absolute",
                  bottom: 100,
                  left: `${g.x}%`,
                  textAlign: "center",
                  animation: "floatUpBig 3.5s ease-out forwards",
                  pointerEvents: "none",
                }}
              >
                <div style={{ fontSize: g.size }}>{g.emoji}</div>
                <div style={{ fontSize: 10, color: SITE.color.pink, fontWeight: 500, marginTop: 4, textShadow: "0 1px 3px rgba(0,0,0,0.6)" }}>
                  {g.senderName}
                </div>
              </div>
            ))}
          </div>

          {/* 直近ギフト表示 (右側) */}
          {recentGifts.length > 0 && (
            <div style={{ position: "absolute", right: 14, bottom: 160, maxWidth: 200, display: "flex", flexDirection: "column", gap: 4, pointerEvents: "none" }}>
              {recentGifts.map((g) => (
                <div key={`recent-${g.id}`} style={{ padding: "5px 10px", backgroundColor: "rgba(0,0,0,0.65)", border: `1px solid rgba(255,255,255,0.15)`, animation: "fadeInRight 0.3s ease-out" }}>
                  <p style={{ fontSize: 9, color: SITE.color.pink, fontFamily: FONT_DISPLAY, letterSpacing: "0.05em", marginBottom: 1 }}>
                    {g.senderName}
                  </p>
                  <p style={{ fontSize: 11, color: "#fff" }}>
                    <span style={{ fontSize: 14, marginRight: 4 }}>{g.emoji}</span>
                    <span style={{ color: "#ffd668", fontVariantNumeric: "tabular-nums" }}>+{g.pointAmount}pt</span>
                  </p>
                  {g.message && (
                    <p style={{ fontSize: 10, color: "#ddd", marginTop: 2 }}>“{g.message}”</p>
                  )}
                </div>
              ))}
            </div>
          )}

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

          {/* 右下: ギフト&ハートボタン (縦並び) */}
          <div style={{ position: "absolute", right: 14, bottom: 80, display: "flex", flexDirection: "column", gap: 10 }}>
            <button
              onClick={() => setGiftModalOpen(true)}
              title="投げ銭を送る"
              style={{
                width: 60,
                height: 60,
                borderRadius: "50%",
                border: "none",
                background: "linear-gradient(135deg, #ffd668 0%, #ff9844 100%)",
                color: "#fff",
                fontSize: 26,
                cursor: "pointer",
                boxShadow: "0 4px 12px rgba(255, 152, 68, 0.45)",
              }}
            >
              🎁
            </button>
            <button
              onClick={sendHeart}
              style={{
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
          </div>

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
        @keyframes floatUpBig {
          0% {
            transform: translateY(0) scale(0.5);
            opacity: 0;
          }
          15% {
            transform: translateY(-30px) scale(1.2);
            opacity: 1;
          }
          50% {
            transform: translateY(-180px) scale(1);
            opacity: 1;
          }
          100% {
            transform: translateY(-380px) scale(0.7);
            opacity: 0;
          }
        }
        @keyframes fadeInRight {
          0% {
            transform: translateX(20px);
            opacity: 0;
          }
          100% {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>

      {/* 投げ銭モーダル */}
      <GiftModal
        open={giftModalOpen}
        onClose={() => setGiftModalOpen(false)}
        customerId={memberId}
        sourceType="live"
        sourceId={streamId}
        recipientName={streamInfo?.therapistName}
        onSent={onGiftSent}
      />
    </main>
  );
}
