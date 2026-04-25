"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Room,
  LocalVideoTrack,
  Track,
  ConnectionState,
} from "livekit-client";
import {
  initFaceLandmarker,
  applyFilter,
  canvasToMediaStream,
  STAMP_OPTIONS,
  type FilterMode,
  type StampKind,
  type MosaicTarget,
  type FilterOptions,
} from "../../../lib/live-filter-engine";
import { SITE } from "../../../lib/site-theme";

const FONT_SERIF = "'Noto Serif JP', 'Yu Mincho', 'Hiragino Mincho ProN', serif";
const FONT_DISPLAY = "'Cormorant Garamond', 'Noto Serif JP', 'Yu Mincho', serif";

const C = {
  bg: SITE.color.bg,
  card: SITE.color.surface,
  cardAlt: SITE.color.surfaceAlt,
  border: SITE.color.border,
  text: SITE.color.text,
  textSub: SITE.color.textSub,
  textMuted: SITE.color.textMuted,
  accent: SITE.color.pink,
  accentDeep: SITE.color.pinkDeep,
  accentBg: SITE.color.pinkSoft,
} as const;

/**
 * セラピスト配信ページ
 *
 * URL: /mypage/live-broadcast
 * クエリ: ?therapistId=xx&authToken=xx (マイページから遷移時に付与)
 *
 * 流れ:
 *   1. 設定画面 (タイトル・公開範囲・初期フィルター)
 *   2. プレビュー (カメラ起動 + フィルター調整)
 *   3. 配信開始ボタン → LiveKit publish 開始
 *   4. 配信中画面 (フィルター変更、視聴者数、コメント、ハート、終了)
 */

type Phase = "setup" | "preview" | "live";

type FaceLandmarkerType = Awaited<ReturnType<typeof initFaceLandmarker>>;
type FaceLandmarkerResult = ReturnType<FaceLandmarkerType["detectForVideo"]>;

export default function LiveBroadcastPage() {
  const router = useRouter();

  // ───── URL パラメータ
  const [therapistId, setTherapistId] = useState<number | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [therapistName, setTherapistName] = useState<string>("");

  useEffect(() => {
    const url = new URL(window.location.href);
    const t = parseInt(url.searchParams.get("therapistId") || "0");
    const a = url.searchParams.get("authToken");
    if (t && a) {
      setTherapistId(t);
      setAuthToken(a);
    } else {
      setErrorMsg("ログイン情報が必要です。マイページからアクセスしてください。");
    }
  }, []);

  // ───── 状態
  const [phase, setPhase] = useState<Phase>("setup");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // 設定
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"public" | "members_only">("members_only");

  // フィルター
  const [filterMode, setFilterMode] = useState<FilterMode>("none");
  const [stampKind, setStampKind] = useState<StampKind>("sakura");
  const [mosaicTarget, setMosaicTarget] = useState<MosaicTarget>("face");
  const [beautyStrength, setBeautyStrength] = useState(0.6);

  // スタンプ調整 (種類ごとに独立保持: 桜の調整→ハート切替→桜に戻ったら桜の調整値が復元)
  type StampAdjust = { size: number; offsetX: number; offsetY: number };
  const defaultAdjust: StampAdjust = { size: 1.0, offsetX: 0, offsetY: 0 };
  const [stampAdjustments, setStampAdjustments] = useState<Record<string, StampAdjust>>({});
  const currentAdjust = stampAdjustments[stampKind] || defaultAdjust;
  const updateAdjust = (patch: Partial<StampAdjust>) => {
    setStampAdjustments((prev) => ({
      ...prev,
      [stampKind]: { ...(prev[stampKind] || defaultAdjust), ...patch },
    }));
  };
  const resetAdjust = () => {
    setStampAdjustments((prev) => {
      const next = { ...prev };
      delete next[stampKind];
      return next;
    });
  };

  // LiveKit
  const [streamId, setStreamId] = useState<number | null>(null);
  const [roomName, setRoomName] = useState<string | null>(null);
  const roomRef = useRef<Room | null>(null);
  const localTrackRef = useRef<LocalVideoTrack | null>(null);

  // メディア
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const faceLandmarkerRef = useRef<FaceLandmarkerType | null>(null);

  // デバッグ情報 (iOS Safari 動作確認用)
  const [debugInfo, setDebugInfo] = useState<string>("");
  const lastVideoTimeRef = useRef(-1);

  // 統計
  const [viewerCount, setViewerCount] = useState(0);
  const [heartCount, setHeartCount] = useState(0);
  const [commentCount, setCommentCount] = useState(0);
  const [elapsedSec, setElapsedSec] = useState(0);

  // フィルター状態を ref に保持 (描画ループ内から最新値参照用)
  const filterOptionsRef = useRef<FilterOptions>({
    mode: "none",
    stamp: "sakura",
    mosaicTarget: "face",
    beautyStrength: 0.6,
    stampSize: 1.0,
    stampOffsetX: 0,
    stampOffsetY: 0,
  });
  useEffect(() => {
    filterOptionsRef.current = {
      mode: filterMode,
      stamp: stampKind,
      mosaicTarget,
      beautyStrength,
      stampSize: currentAdjust.size,
      stampOffsetX: currentAdjust.offsetX,
      stampOffsetY: currentAdjust.offsetY,
    };
  }, [filterMode, stampKind, mosaicTarget, beautyStrength, currentAdjust.size, currentAdjust.offsetX, currentAdjust.offsetY]);

  // ─────────────────────────────────────────────────────────
  // カメラ起動
  // ─────────────────────────────────────────────────────────
  const startCamera = async () => {
    try {
      setDebugInfo("カメラ起動中...");

      // iOS Safari互換: 最小限のconstraintsから始める
      // 厳しい指定 (frameRate等) を入れるとiOSで失敗することがある
      let cameraStream: MediaStream;
      try {
        cameraStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user" },
          audio: false,
        });
      } catch (e1) {
        // facingMode指定で失敗したらフォールバック
        console.warn("facingMode指定で失敗、フォールバック:", e1);
        cameraStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }

      const audioStream = await navigator.mediaDevices.getUserMedia({
        video: false,
        audio: true,
      });

      cameraStreamRef.current = cameraStream;
      audioStreamRef.current = audioStream;

      // トラック情報をデバッグ
      const vTracks = cameraStream.getVideoTracks();
      const vTrack = vTracks[0];
      const settings = vTrack?.getSettings?.();
      setDebugInfo(
        `track=${vTracks.length}個\n` +
        `live=${vTrack?.readyState}\n` +
        `${settings?.width}x${settings?.height}@${settings?.frameRate}fps\n` +
        `label=${vTrack?.label?.slice(0, 30) || "?"}`
      );

      if (videoRef.current) {
        const v = videoRef.current;
        v.srcObject = cameraStream;
        v.muted = true;
        v.setAttribute("playsinline", "true");
        v.setAttribute("webkit-playsinline", "true");
        v.setAttribute("autoplay", "true");

        // メタデータ読み込み完了を待つ
        await new Promise<void>((resolve) => {
          if (v.readyState >= 1) {
            resolve();
            return;
          }
          const onLoaded = () => {
            v.removeEventListener("loadedmetadata", onLoaded);
            resolve();
          };
          v.addEventListener("loadedmetadata", onLoaded);
          setTimeout(resolve, 5000);
        });

        // iOS Safariで複数回 play() を試す
        for (let i = 0; i < 3; i++) {
          try {
            await v.play();
            break;
          } catch (playErr) {
            console.warn(`video.play() attempt ${i + 1} failed:`, playErr);
            await new Promise(r => setTimeout(r, 200));
          }
        }
      } else {
        // ここに来るのはバグ。phase=preview になって video 要素が DOM にあるはず
        console.error("videoRef.current が null です。DOM レンダリング順序を確認してください。");
        throw new Error("video要素が見つかりません (DOM レンダリング待機失敗)");
      }

      // Face Landmarker 初期化 (失敗してもフィルター無しで配信可能)
      try {
        if (!faceLandmarkerRef.current) {
          faceLandmarkerRef.current = await initFaceLandmarker();
        }
      } catch (mpErr) {
        console.warn("Face Landmarker初期化失敗:", mpErr);
      }

      // 描画ループ開始
      startRenderLoop();
    } catch (e) {
      const msg = e instanceof Error ? `${e.name}: ${e.message}` : "カメラ起動エラー";
      setDebugInfo(`エラー: ${msg}`);
      setErrorMsg(`カメラ/マイクへのアクセスが必要です: ${msg}`);
      throw e;
    }
  };

  // ─────────────────────────────────────────────────────────
  // 描画ループ (毎フレーム)
  // ─────────────────────────────────────────────────────────
  const startRenderLoop = useCallback(() => {
    let frameCount = 0;
    let lastDebugUpdate = 0;
    const tick = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const fl = faceLandmarkerRef.current;
      frameCount++;

      // デバッグ情報を1秒に1回更新 (トラック情報の後に追記)
      const now = performance.now();
      if (now - lastDebugUpdate > 1000) {
        lastDebugUpdate = now;
        if (video) {
          const cs = cameraStreamRef.current;
          const vt = cs?.getVideoTracks?.()[0];
          setDebugInfo(
            `vw=${video.videoWidth} vh=${video.videoHeight}\n` +
            `rs=${video.readyState} paused=${video.paused}\n` +
            `t=${video.currentTime.toFixed(1)}s frames=${frameCount}\n` +
            `track=${vt?.readyState || "?"} muted=${vt?.muted}\n` +
            `enabled=${vt?.enabled}`
          );
        }
      }

      if (!video || !canvas) {
        animationFrameRef.current = requestAnimationFrame(tick);
        return;
      }

      // iOS Safari: video が止まっていたら再生し直す
      if (video.paused && cameraStreamRef.current) {
        video.play().catch(() => {});
      }

      // video の videoWidth が 0 = まだ準備できていない
      if (!video.videoWidth || !video.videoHeight) {
        animationFrameRef.current = requestAnimationFrame(tick);
        return;
      }

      // canvas サイズを video に合わせる (一度だけ)
      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        animationFrameRef.current = requestAnimationFrame(tick);
        return;
      }

      // FaceLandmarker でランドマーク検出 (新フレーム時のみ)
      let result: FaceLandmarkerResult | null = null;
      if (fl && video.currentTime !== lastVideoTimeRef.current) {
        lastVideoTimeRef.current = video.currentTime;
        try {
          result = fl.detectForVideo(video, performance.now());
        } catch {
          // 検出失敗時は素のvideoだけ描画
        }
      }

      // フィルター適用 (Face Landmarker無しでも素のvideoが描画される)
      try {
        applyFilter(ctx, video, result, filterOptionsRef.current);
      } catch {
        // フィルター失敗時は素のvideoを描画
        try { ctx.drawImage(video, 0, 0, canvas.width, canvas.height); } catch {}
      }

      animationFrameRef.current = requestAnimationFrame(tick);
    };
    animationFrameRef.current = requestAnimationFrame(tick);
  }, []);

  // ─────────────────────────────────────────────────────────
  // 設定 → プレビュー
  //
  // 重要: 先に setPhase("preview") して video/canvas を DOM に出してから
  // useEffect 経由で startCamera() を呼ぶ。
  // 旧実装では DOM レンダリング前に videoRef.current にアクセスしていたため
  // null チェックで弾かれて srcObject が設定されない不具合があった
  // (vw=0 vh=0 rs=0 だが frames だけカウントされる症状の原因)。
  // ─────────────────────────────────────────────────────────
  const proceedToPreview = () => {
    setErrorMsg(null);
    if (!title.trim()) {
      setErrorMsg("タイトルを入力してください");
      return;
    }
    setPhase("preview");
  };

  // phase が preview に変わったら video/canvas が DOM に出ているので
  // そこで初めて startCamera を実行する
  useEffect(() => {
    if (phase !== "preview") return;
    if (cameraStreamRef.current) return; // 既に起動済みなら何もしない
    setSubmitting(true);
    // 次のフレームを待ってから (DOM 反映を確実に)
    const timer = setTimeout(() => {
      startCamera()
        .catch((e) => {
          console.error("startCamera failed:", e);
          // エラー時は setup に戻す (errorMsg は startCamera 内で設定済み)
          setPhase("setup");
        })
        .finally(() => {
          setSubmitting(false);
        });
    }, 50);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // ─────────────────────────────────────────────────────────
  // プレビュー → 配信開始 (LiveKit接続 + publish)
  // ─────────────────────────────────────────────────────────
  const startBroadcast = async () => {
    if (!therapistId || !authToken) return;
    setErrorMsg(null);
    setSubmitting(true);
    try {
      // 1. start API でルーム作成 + トークン取得
      const startRes = await fetch("/api/diary/live/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          therapistId,
          authToken,
          title: title.trim(),
          description: description.trim(),
          visibility,
          filterMode,
          filterOptions: { stamp: stampKind, mosaicTarget, beautyStrength, stampSize: currentAdjust.size, stampOffsetX: currentAdjust.offsetX, stampOffsetY: currentAdjust.offsetY },
        }),
      });
      const startData = await startRes.json();
      if (!startRes.ok) {
        throw new Error(startData.error || "配信開始に失敗");
      }

      setStreamId(startData.streamId);
      setRoomName(startData.roomName);
      setTherapistName(startData.therapistName);

      // 2. LiveKit Room 接続
      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
        videoCaptureDefaults: {
          resolution: { width: 720, height: 1280, frameRate: 30 },
        },
      });

      await room.connect(startData.wsUrl, startData.accessToken);
      roomRef.current = room;

      // 3. canvas → MediaStream → LiveKit publish (動画)
      const canvas = canvasRef.current;
      if (!canvas) throw new Error("canvas が見つかりません");
      const canvasStream = canvasToMediaStream(canvas, 30);
      const videoTrackMS = canvasStream.getVideoTracks()[0];
      if (!videoTrackMS) throw new Error("canvas video track が取得できません");
      const localVideoTrack = new LocalVideoTrack(videoTrackMS, undefined);
      await room.localParticipant.publishTrack(localVideoTrack, {
        source: Track.Source.Camera,
        videoEncoding: { maxBitrate: 1_500_000, maxFramerate: 30 }, // 1.5Mbps
        simulcast: false,
      });
      localTrackRef.current = localVideoTrack;

      // 4. マイク publish
      if (audioStreamRef.current) {
        const audioTrack = audioStreamRef.current.getAudioTracks()[0];
        if (audioTrack) {
          await room.localParticipant.publishTrack(audioTrack, {
            source: Track.Source.Microphone,
          });
        }
      }

      // 5. 視聴者数更新リスナー
      room.on("participantConnected", () => {
        setViewerCount(room.numParticipants - 1);
      });
      room.on("participantDisconnected", () => {
        setViewerCount(Math.max(0, room.numParticipants - 1));
      });

      // 6. 状態を live に更新
      await fetch("/api/diary/live/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          streamId: startData.streamId,
          therapistId,
          authToken,
          status: "live",
        }),
      });

      setPhase("live");
    } catch (e) {
      const msg = e instanceof Error ? `${e.name}: ${e.message}` : "配信開始エラー";
      console.error("startBroadcast error:", e);
      setErrorMsg(`配信開始失敗: ${msg}`);
      // クリーンアップ
      try { await roomRef.current?.disconnect(); } catch {}
      roomRef.current = null;
    } finally {
      setSubmitting(false);
    }
  };

  // ─────────────────────────────────────────────────────────
  // 配信終了
  // ─────────────────────────────────────────────────────────
  const endBroadcast = async () => {
    if (!streamId || !therapistId || !authToken) return;
    if (!confirm("配信を終了しますか？")) return;
    try {
      // 状態更新
      await fetch("/api/diary/live/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          streamId,
          therapistId,
          authToken,
          status: "ended",
        }),
      });

      // LiveKit切断
      try {
        await roomRef.current?.disconnect();
      } catch {}
      roomRef.current = null;
      localTrackRef.current = null;

      // カメラ停止
      cameraStreamRef.current?.getTracks().forEach((t) => t.stop());
      audioStreamRef.current?.getTracks().forEach((t) => t.stop());
      cameraStreamRef.current = null;
      audioStreamRef.current = null;
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);

      // マイページへ戻る
      router.push("/mypage");
    } catch (e) {
      console.error(e);
    }
  };

  // ─────────────────────────────────────────────────────────
  // フィルターON時にライブ中ならサーバー側にも反映
  // ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "live" || !streamId || !therapistId || !authToken) return;
    const t = setTimeout(() => {
      fetch("/api/diary/live/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          streamId,
          therapistId,
          authToken,
          filterMode,
          filterOptions: { stamp: stampKind, mosaicTarget, beautyStrength, stampSize: currentAdjust.size, stampOffsetX: currentAdjust.offsetX, stampOffsetY: currentAdjust.offsetY },
        }),
      }).catch(() => {});
    }, 800); // デバウンス
    return () => clearTimeout(t);
  }, [filterMode, stampKind, mosaicTarget, beautyStrength, phase, streamId, therapistId, authToken]);

  // ─────────────────────────────────────────────────────────
  // 配信時間カウント
  // ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "live") return;
    const t = setInterval(() => setElapsedSec((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [phase]);

  // ─────────────────────────────────────────────────────────
  // 統計ポーリング (5秒ごと、ハート/コメント数)
  // ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "live" || !streamId) return;
    const fetchStats = async () => {
      try {
        const res = await fetch(`/api/diary/live/list?memberAuth=1&limit=50`);
        const data = await res.json();
        if (res.ok) {
          type S = { id: number; viewerCount: number };
          const me = (data.streams as S[]).find((s) => s.id === streamId);
          if (me) setViewerCount(me.viewerCount);
        }
      } catch {}
    };
    fetchStats();
    const t = setInterval(fetchStats, 5000);
    return () => clearInterval(t);
  }, [phase, streamId]);

  // ─────────────────────────────────────────────────────────
  // クリーンアップ
  // ─────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      cameraStreamRef.current?.getTracks().forEach((t) => t.stop());
      audioStreamRef.current?.getTracks().forEach((t) => t.stop());
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      try { roomRef.current?.disconnect(); } catch {}
    };
  }, []);

  // ─────────────────────────────────────────────────────────
  // フォーマッタ
  // ─────────────────────────────────────────────────────────
  const fmtElapsed = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
    return `${m}:${String(sec).padStart(2, "0")}`;
  };

  // ═════════════════════════════════════════════════════════
  // レンダリング
  // ═════════════════════════════════════════════════════════
  return (
    <div style={{ minHeight: "100vh", backgroundColor: C.bg, color: C.text, fontFamily: FONT_SERIF }}>
      {/* ヘッダ */}
      <div style={{ padding: 14, borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <button
          onClick={() => phase === "live" ? endBroadcast() : router.push("/mypage")}
          style={{ padding: "6px 10px", fontSize: 11, cursor: "pointer", backgroundColor: "transparent", border: `1px solid ${C.border}`, color: C.textSub, fontFamily: FONT_SERIF }}
        >
          {phase === "live" ? "✕ 配信終了" : "← マイページに戻る"}
        </button>
        <p style={{ fontFamily: FONT_DISPLAY, fontSize: 13, letterSpacing: "0.2em", color: C.accent, fontWeight: 500 }}>
          🔴 LIVE BROADCAST
        </p>
        <div style={{ width: 60 }} />
      </div>

      {/* エラー */}
      {errorMsg && (
        <div style={{ padding: 10, margin: 14, backgroundColor: "#fef2f2", border: `1px solid #c45555`, fontSize: 11, color: "#7a2929" }}>
          {errorMsg}
        </div>
      )}

      {/* ─────────── Phase: setup (タイトル等) ─────────── */}
      {phase === "setup" && (
        <div style={{ padding: 16, maxWidth: 540, margin: "0 auto" }}>
          <p style={{ fontFamily: FONT_DISPLAY, fontSize: 11, letterSpacing: "0.25em", color: C.accent, marginBottom: 6, textAlign: "center", fontWeight: 500 }}>
            STEP 1
          </p>
          <p style={{ fontSize: 16, color: C.text, fontWeight: 500, textAlign: "center", marginBottom: 20 }}>配信内容を入力</p>

          <div style={{ marginBottom: 14 }}>
            <p style={{ fontSize: 10, color: C.textSub, marginBottom: 4, fontFamily: FONT_DISPLAY, letterSpacing: "0.15em" }}>TITLE · タイトル</p>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例: 出勤前の少しお話タイム♡"
              maxLength={50}
              style={{ width: "100%", padding: "10px 12px", fontSize: 13, border: `1px solid ${C.border}`, backgroundColor: C.card, color: C.text, fontFamily: FONT_SERIF, outline: "none" }}
            />
          </div>

          <div style={{ marginBottom: 14 }}>
            <p style={{ fontSize: 10, color: C.textSub, marginBottom: 4, fontFamily: FONT_DISPLAY, letterSpacing: "0.15em" }}>DESCRIPTION · 説明 (任意)</p>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="今日の予定、コーディネート、好きな話題など"
              maxLength={200}
              rows={3}
              style={{ width: "100%", padding: "10px 12px", fontSize: 12, border: `1px solid ${C.border}`, backgroundColor: C.card, color: C.text, fontFamily: FONT_SERIF, outline: "none", resize: "vertical" }}
            />
          </div>

          <div style={{ marginBottom: 18 }}>
            <p style={{ fontSize: 10, color: C.textSub, marginBottom: 8, fontFamily: FONT_DISPLAY, letterSpacing: "0.15em" }}>VISIBILITY · 公開範囲</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <button
                onClick={() => setVisibility("members_only")}
                style={{
                  padding: "12px 8px",
                  fontSize: 12,
                  cursor: "pointer",
                  backgroundColor: visibility === "members_only" ? C.accent : C.card,
                  color: visibility === "members_only" ? "#fff" : C.textSub,
                  border: `1px solid ${visibility === "members_only" ? C.accent : C.border}`,
                  fontFamily: FONT_SERIF,
                  fontWeight: 500,
                }}
              >
                💗 会員限定<br /><span style={{ fontSize: 9, opacity: 0.85 }}>ログイン会員のみ視聴可</span>
              </button>
              <button
                onClick={() => setVisibility("public")}
                style={{
                  padding: "12px 8px",
                  fontSize: 12,
                  cursor: "pointer",
                  backgroundColor: visibility === "public" ? C.accent : C.card,
                  color: visibility === "public" ? "#fff" : C.textSub,
                  border: `1px solid ${visibility === "public" ? C.accent : C.border}`,
                  fontFamily: FONT_SERIF,
                  fontWeight: 500,
                }}
              >
                🌐 公開<br /><span style={{ fontSize: 9, opacity: 0.85 }}>誰でも視聴可 (集客重視)</span>
              </button>
            </div>
          </div>

          <button
            onClick={proceedToPreview}
            disabled={submitting || !title.trim()}
            style={{
              width: "100%",
              padding: 14,
              fontSize: 13,
              cursor: submitting || !title.trim() ? "not-allowed" : "pointer",
              backgroundColor: C.accent,
              color: "#fff",
              border: "none",
              fontFamily: FONT_SERIF,
              letterSpacing: "0.1em",
              fontWeight: 500,
              opacity: submitting || !title.trim() ? 0.5 : 1,
            }}
          >
            {submitting ? "カメラ起動中..." : "📸 カメラを起動してプレビュー →"}
          </button>
        </div>
      )}

      {/* ─────────── Phase: preview / live (共通の映像表示) ─────────── */}
      {(phase === "preview" || phase === "live") && (
        <div>
          {/* 映像 */}
          <div style={{ position: "relative", backgroundColor: "#000", maxWidth: 540, margin: "0 auto", aspectRatio: "9 / 16", overflow: "hidden" }}>
            <video
              ref={videoRef}
              muted
              playsInline
              autoPlay
              webkit-playsinline="true"
              x-webkit-airplay="deny"
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
                zIndex: 0,
                // opacity を 0 にしない (iOS Safari が再生を停止する)
                // 代わりに canvas を上に重ねて視覚的に隠す
                pointerEvents: "none",
                backgroundColor: "#000",
              }}
            />
            <canvas
              ref={canvasRef}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                display: "block",
                width: "100%",
                height: "100%",
                objectFit: "cover",
                backgroundColor: "transparent", // canvas未描画時は video が見える
                zIndex: 2,
                // canvas に何も描かれていない時は video が透けて見えるよう
                // pointer-events: none で操作も透過
                pointerEvents: "none",
              }}
            />
            {/* デバッグ情報 (iOS Safari 動作確認用) */}
            {debugInfo && (
              <div style={{
                position: "absolute", top: 50, left: 10,
                padding: "4px 8px", fontSize: 10, fontFamily: "monospace",
                backgroundColor: "rgba(0,0,0,0.7)", color: "#0f0",
                zIndex: 10, maxWidth: "calc(100% - 20px)", whiteSpace: "pre-line",
              }}>
                {debugInfo}
              </div>
            )}
            {/* オーバーレイ統計 (live時) */}
            {phase === "live" && (
              <>
                <div style={{ position: "absolute", top: 10, left: 10, padding: "4px 10px", backgroundColor: "rgba(220, 50, 80, 0.9)", color: "#fff", fontSize: 11, fontFamily: FONT_SERIF, fontWeight: 500, letterSpacing: "0.05em" }}>
                  🔴 LIVE
                </div>
                <div style={{ position: "absolute", top: 10, right: 10, padding: "4px 10px", backgroundColor: "rgba(0,0,0,0.6)", color: "#fff", fontSize: 11, fontFamily: FONT_SERIF, fontVariantNumeric: "tabular-nums" }}>
                  {fmtElapsed(elapsedSec)}
                </div>
                <div style={{ position: "absolute", bottom: 10, left: 10, display: "flex", gap: 8 }}>
                  <span style={{ padding: "4px 10px", backgroundColor: "rgba(0,0,0,0.6)", color: "#fff", fontSize: 11, fontFamily: FONT_SERIF }}>
                    👥 {viewerCount}
                  </span>
                  <span style={{ padding: "4px 10px", backgroundColor: "rgba(0,0,0,0.6)", color: "#fff", fontSize: 11, fontFamily: FONT_SERIF }}>
                    💗 {heartCount}
                  </span>
                  <span style={{ padding: "4px 10px", backgroundColor: "rgba(0,0,0,0.6)", color: "#fff", fontSize: 11, fontFamily: FONT_SERIF }}>
                    💬 {commentCount}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* フィルター操作パネル */}
          <div style={{ padding: 14, maxWidth: 540, margin: "0 auto" }}>
            <p style={{ fontSize: 10, letterSpacing: "0.15em", color: C.accent, marginBottom: 10, fontFamily: FONT_DISPLAY, fontWeight: 500, textAlign: "center" }}>
              FILTER · エフェクト
            </p>

            {/* モード切替 */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 6, marginBottom: 12 }}>
              {([
                { key: "none", label: "なし", emoji: "✋" },
                { key: "beauty", label: "美顔", emoji: "✨" },
                { key: "stamp", label: "スタンプ", emoji: "🌸" },
                { key: "mosaic", label: "モザイク", emoji: "🌫" },
              ] as const).map((m) => (
                <button
                  key={m.key}
                  onClick={() => setFilterMode(m.key)}
                  style={{
                    padding: "10px 4px",
                    fontSize: 10,
                    cursor: "pointer",
                    backgroundColor: filterMode === m.key ? C.accent : C.card,
                    color: filterMode === m.key ? "#fff" : C.textSub,
                    border: `1px solid ${filterMode === m.key ? C.accent : C.border}`,
                    fontFamily: FONT_SERIF,
                    fontWeight: 500,
                  }}
                >
                  <div style={{ fontSize: 16, marginBottom: 2 }}>{m.emoji}</div>
                  {m.label}
                </button>
              ))}
            </div>

            {/* 美顔の強さ */}
            {filterMode === "beauty" && (
              <div style={{ marginBottom: 12, padding: 10, backgroundColor: C.cardAlt, border: `1px solid ${C.border}` }}>
                <p style={{ fontSize: 10, color: C.textSub, marginBottom: 4, fontFamily: FONT_SERIF }}>強さ: {Math.round(beautyStrength * 100)}%</p>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.1}
                  value={beautyStrength}
                  onChange={(e) => setBeautyStrength(parseFloat(e.target.value))}
                  style={{ width: "100%" }}
                />
              </div>
            )}

            {/* スタンプ選択 (15種、5列×3行グリッド) */}
            {filterMode === "stamp" && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 5 }}>
                  {STAMP_OPTIONS.map((s) => (
                    <button
                      key={s.kind}
                      onClick={() => setStampKind(s.kind)}
                      title={s.description}
                      style={{
                        padding: "8px 2px",
                        fontSize: 9,
                        cursor: "pointer",
                        backgroundColor: stampKind === s.kind ? C.accentBg : C.card,
                        color: stampKind === s.kind ? C.accentDeep : C.textSub,
                        border: `1px solid ${stampKind === s.kind ? C.accent : C.border}`,
                        fontFamily: FONT_SERIF,
                        lineHeight: 1.2,
                      }}
                    >
                      <div style={{ fontSize: 18, marginBottom: 2 }}>{s.emoji}</div>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* スタンプ調整 (サイズ・位置)。fullblur は調整不要なので除外 */}
            {filterMode === "stamp" && stampKind !== "fullblur" && (
              <div style={{
                marginBottom: 12,
                padding: 10,
                backgroundColor: C.cardAlt,
                border: `1px solid ${C.border}`,
                borderRadius: 6,
              }}>
                <div style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 8,
                  fontSize: 10,
                  color: C.textSub,
                  fontFamily: FONT_SERIF,
                }}>
                  <span>✨ {STAMP_OPTIONS.find((s) => s.kind === stampKind)?.label} の調整</span>
                  <button
                    onClick={resetAdjust}
                    style={{
                      padding: "3px 8px",
                      fontSize: 9,
                      cursor: "pointer",
                      backgroundColor: "transparent",
                      color: C.textSub,
                      border: `1px solid ${C.border}`,
                      borderRadius: 4,
                      fontFamily: FONT_SERIF,
                    }}
                  >
                    🔄 リセット
                  </button>
                </div>

                {/* サイズスライダー */}
                <label style={{ display: "block", marginBottom: 6, fontSize: 9, color: C.textSub, fontFamily: FONT_SERIF }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                    <span>サイズ</span>
                    <span style={{ fontVariantNumeric: "tabular-nums" }}>{Math.round(currentAdjust.size * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="2.0"
                    step="0.05"
                    value={currentAdjust.size}
                    onChange={(e) => updateAdjust({ size: parseFloat(e.target.value) })}
                    style={{ width: "100%" }}
                  />
                </label>

                {/* 横位置スライダー */}
                <label style={{ display: "block", marginBottom: 6, fontSize: 9, color: C.textSub, fontFamily: FONT_SERIF }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                    <span>左右</span>
                    <span style={{ fontVariantNumeric: "tabular-nums" }}>
                      {currentAdjust.offsetX === 0 ? "中央" : (currentAdjust.offsetX > 0 ? "→ " : "← ") + Math.abs(Math.round(currentAdjust.offsetX * 100)) + "%"}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="-0.5"
                    max="0.5"
                    step="0.02"
                    value={currentAdjust.offsetX}
                    onChange={(e) => updateAdjust({ offsetX: parseFloat(e.target.value) })}
                    style={{ width: "100%" }}
                  />
                </label>

                {/* 縦位置スライダー */}
                <label style={{ display: "block", marginBottom: 0, fontSize: 9, color: C.textSub, fontFamily: FONT_SERIF }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                    <span>上下</span>
                    <span style={{ fontVariantNumeric: "tabular-nums" }}>
                      {currentAdjust.offsetY === 0 ? "中央" : (currentAdjust.offsetY > 0 ? "↓ " : "↑ ") + Math.abs(Math.round(currentAdjust.offsetY * 100)) + "%"}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="-0.5"
                    max="0.5"
                    step="0.02"
                    value={currentAdjust.offsetY}
                    onChange={(e) => updateAdjust({ offsetY: parseFloat(e.target.value) })}
                    style={{ width: "100%" }}
                  />
                </label>
              </div>
            )}

            {/* モザイク対象 */}
            {filterMode === "mosaic" && (
              <div style={{ marginBottom: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                {([
                  { key: "face", label: "顔全体", emoji: "🌫" },
                  { key: "eyes", label: "目元のみ", emoji: "👀" },
                ] as const).map((m) => (
                  <button
                    key={m.key}
                    onClick={() => setMosaicTarget(m.key)}
                    style={{
                      padding: "10px 4px",
                      fontSize: 11,
                      cursor: "pointer",
                      backgroundColor: mosaicTarget === m.key ? C.accentBg : C.card,
                      color: mosaicTarget === m.key ? C.accentDeep : C.textSub,
                      border: `1px solid ${mosaicTarget === m.key ? C.accent : C.border}`,
                      fontFamily: FONT_SERIF,
                    }}
                  >
                    <span style={{ fontSize: 16, marginRight: 4 }}>{m.emoji}</span>
                    {m.label}
                  </button>
                ))}
              </div>
            )}

            {/* 配信開始ボタン (preview時のみ) */}
            {phase === "preview" && (
              <button
                onClick={startBroadcast}
                disabled={submitting}
                style={{
                  width: "100%",
                  padding: 14,
                  fontSize: 14,
                  cursor: submitting ? "wait" : "pointer",
                  backgroundColor: "#dc3250",
                  color: "#fff",
                  border: "none",
                  fontFamily: FONT_SERIF,
                  letterSpacing: "0.1em",
                  fontWeight: 500,
                  marginTop: 10,
                  opacity: submitting ? 0.5 : 1,
                }}
              >
                {submitting ? "接続中..." : "🔴 ライブ配信を開始"}
              </button>
            )}

            {phase === "live" && (
              <button
                onClick={endBroadcast}
                style={{
                  width: "100%",
                  padding: 14,
                  fontSize: 13,
                  cursor: "pointer",
                  backgroundColor: "transparent",
                  color: "#dc3250",
                  border: `1px solid #dc3250`,
                  fontFamily: FONT_SERIF,
                  letterSpacing: "0.1em",
                  fontWeight: 500,
                  marginTop: 10,
                }}
              >
                ✕ 配信を終了する
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
