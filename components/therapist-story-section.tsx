"use client";

import { useState, useRef, useEffect, useCallback } from "react";

/**
 * セラピスト用 ストーリー機能
 *
 * 構成:
 *   - 公開中ストーリーの一覧 (サムネ + 残り時間 + 閲覧数)
 *   - 「📱 ストーリー投稿」ボタン → モーダルで画像/動画選択 + キャプション
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

type MyStory = {
  id: number;
  mediaType: string;
  mediaUrl: string | null;
  thumbnailUrl: string | null;
  caption: string | null;
  visibility: string;
  status: string;
  viewCount: number;
  uniqueViewerCount: number;
  reactionCount: number;
  publishedAt: string;
  expiresAt: string;
  videoDurationSec: number | null;
  isExpired: boolean;
};

type Props = {
  therapistId: number;
  authToken: string;
  C: ColorTheme;
  FONT_SERIF: string;
  FONT_DISPLAY: string;
  FONT_SANS: string;
};

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_VIDEO_BYTES = 20 * 1024 * 1024;
const MAX_VIDEO_SECONDS = 15;
const MAX_CAPTION = 200;

export default function TherapistStorySection({
  therapistId,
  authToken,
  C,
  FONT_SERIF,
  FONT_DISPLAY,
  FONT_SANS,
}: Props) {
  const [stories, setStories] = useState<MyStory[]>([]);
  const [loading, setLoading] = useState(true);
  const [composerOpen, setComposerOpen] = useState(false);

  // フォーム状態
  const [mediaType, setMediaType] = useState<"image" | "video" | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string>("");
  const [mediaBase64, setMediaBase64] = useState<string>("");
  const [mediaContentType, setMediaContentType] = useState<string>("");
  const [videoDuration, setVideoDuration] = useState<number>(0);
  const [caption, setCaption] = useState("");
  const [visibility, setVisibility] = useState<"public" | "members_only">("public");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ════════════════════════════════════════════════════
  // データ取得
  // ════════════════════════════════════════════════════
  const fetchStories = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/diary/story/my?therapistId=${therapistId}&authToken=${encodeURIComponent(authToken)}`
      );
      const data = await res.json();
      if (res.ok && data.stories) {
        setStories(data.stories);
      }
    } catch (e) {
      console.error("fetch stories:", e);
    } finally {
      setLoading(false);
    }
  }, [therapistId, authToken]);

  useEffect(() => {
    fetchStories();
  }, [fetchStories]);

  // 1分ごとに残り時間更新のため再取得 (軽量版: ローカル時間計算)
  useEffect(() => {
    const t = setInterval(() => {
      // 状態更新だけしてre-render促す (新規fetchは不要)
      setStories((prev) => [...prev]);
    }, 60000);
    return () => clearInterval(t);
  }, []);

  // 動画処理中のストーリーがあれば30秒ごとに状態確認 (処理完了検知)
  useEffect(() => {
    const hasProcessing = stories.some(
      (s) => s.mediaType === "video" && s.mediaUrl && s.mediaUrl.includes("therapist-videos-raw")
    );
    if (!hasProcessing) return;
    const t = setInterval(() => {
      fetchStories();
    }, 30000);
    return () => clearInterval(t);
  }, [stories, fetchStories]);

  // ════════════════════════════════════════════════════
  // ファイル選択
  // ════════════════════════════════════════════════════
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");

    if (!isImage && !isVideo) {
      setErrorMsg("画像または動画ファイルを選んでください");
      return;
    }

    if (isImage && file.size > MAX_IMAGE_BYTES) {
      setErrorMsg(`画像は ${MAX_IMAGE_BYTES / 1024 / 1024}MB 以内にしてください`);
      return;
    }

    if (isVideo && file.size > MAX_VIDEO_BYTES) {
      setErrorMsg(`動画は ${MAX_VIDEO_BYTES / 1024 / 1024}MB 以内にしてください`);
      return;
    }

    if (isVideo && !["video/mp4", "video/quicktime", "video/x-m4v"].includes(file.type)) {
      setErrorMsg("動画は MP4 または MOV (iPhone標準) のみ対応しています");
      return;
    }

    // base64化
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("読み込みエラー"));
      reader.readAsDataURL(file);
    });

    // 動画の長さチェック
    if (isVideo) {
      const duration = await new Promise<number>((resolve) => {
        const video = document.createElement("video");
        video.onloadedmetadata = () => resolve(video.duration || 0);
        video.onerror = () => resolve(0);
        video.src = URL.createObjectURL(file);
      });
      if (duration > MAX_VIDEO_SECONDS) {
        setErrorMsg(`動画は ${MAX_VIDEO_SECONDS} 秒以内にしてください (この動画: ${Math.round(duration)}秒)`);
        return;
      }
      setVideoDuration(Math.round(duration));
    }

    setMediaType(isImage ? "image" : "video");
    setMediaContentType(file.type);
    setMediaBase64(base64);
    setMediaPreview(base64);
  };

  const resetForm = () => {
    setMediaType(null);
    setMediaPreview("");
    setMediaBase64("");
    setMediaContentType("");
    setVideoDuration(0);
    setCaption("");
    setVisibility("public");
    setErrorMsg(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const closeComposer = () => {
    setComposerOpen(false);
    resetForm();
  };

  // ════════════════════════════════════════════════════
  // 投稿
  // ════════════════════════════════════════════════════
  const handleSubmit = async () => {
    setErrorMsg(null);

    if (!mediaBase64 || !mediaType) {
      setErrorMsg("画像または動画を選択してください");
      return;
    }
    if (caption.length > MAX_CAPTION) {
      setErrorMsg(`キャプションは ${MAX_CAPTION} 文字以内です`);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/diary/story/post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          therapistId,
          authToken,
          mediaType,
          mediaBase64,
          mediaContentType,
          caption: caption.trim() || undefined,
          visibility,
          videoDurationSec: mediaType === "video" ? videoDuration : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "投稿に失敗しました");
      } else {
        if (data.isProcessingVideo) {
          setSuccessMsg("✨ 動画を処理中です(数十秒〜1分)。完了次第ストーリーに反映されます");
        } else {
          setSuccessMsg("✨ ストーリーを投稿しました! 24時間後に消えます");
        }
        closeComposer();
        await fetchStories();
        setTimeout(() => setSuccessMsg(null), 5000);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "通信エラー";
      setErrorMsg(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // ════════════════════════════════════════════════════
  // 削除
  // ════════════════════════════════════════════════════
  const handleDelete = async (storyId: number) => {
    try {
      const res = await fetch("/api/diary/story/my", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storyId,
          therapistId,
          authToken,
          deleteReason: "セラピスト本人による削除",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "削除失敗");
      } else {
        setSuccessMsg("削除しました");
        setDeleteTargetId(null);
        await fetchStories();
        setTimeout(() => setSuccessMsg(null), 3000);
      }
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "通信エラー");
    }
  };

  // ════════════════════════════════════════════════════
  // ヘルパー
  // ════════════════════════════════════════════════════
  const formatRemaining = (expiresAt: string) => {
    const ms = new Date(expiresAt).getTime() - Date.now();
    if (ms <= 0) return "終了";
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    if (hours > 0) return `あと ${hours}時間 ${minutes}分`;
    return `あと ${minutes}分`;
  };

  const activeStories = stories.filter((s) => !s.isExpired);
  const expiredStories = stories.filter((s) => s.isExpired);

  // ════════════════════════════════════════════════════
  // レンダリング
  // ════════════════════════════════════════════════════
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* セクション見出し */}
      <div style={{ textAlign: "center", marginBottom: 4 }}>
        <p style={{ fontFamily: FONT_DISPLAY, fontSize: 11, letterSpacing: "0.25em", color: C.accent, marginBottom: 6, fontWeight: 500 }}>STORIES</p>
        <p style={{ fontFamily: FONT_SERIF, fontSize: 13, letterSpacing: "0.08em", color: C.text, fontWeight: 500, marginBottom: 8 }}>📱 24時間ストーリー</p>
        <div style={{ width: 24, height: 1, backgroundColor: C.accent, margin: "0 auto" }} />
      </div>

      {/* 成功メッセージ */}
      {successMsg && (
        <div style={{ padding: 10, backgroundColor: "#f0f7f1", border: `1px solid #6b9b7e`, fontSize: 11, color: "#3d6149", textAlign: "center", fontFamily: FONT_SERIF }}>
          {successMsg}
        </div>
      )}

      {/* 投稿ボタン */}
      <button
        onClick={() => setComposerOpen(true)}
        style={{
          width: "100%",
          padding: "12px",
          fontSize: 12,
          cursor: "pointer",
          backgroundColor: "transparent",
          color: C.accent,
          border: `1px solid ${C.accent}`,
          fontFamily: FONT_SERIF,
          letterSpacing: "0.1em",
          fontWeight: 500,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
        }}
      >
        📱 ストーリーを投稿
      </button>

      {/* 公開中ストーリー一覧 */}
      {activeStories.length > 0 && (
        <div>
          <p style={{ fontSize: 10, letterSpacing: "0.15em", color: C.textSub, marginBottom: 8, fontFamily: FONT_DISPLAY }}>
            🔴 公開中 ({activeStories.length})
          </p>
          <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4 }}>
            {activeStories.map((story) => (
              <div
                key={story.id}
                style={{
                  flexShrink: 0,
                  width: 110,
                  backgroundColor: C.card,
                  border: `1px solid ${C.border}`,
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                {/* メディアプレビュー */}
                <div
                  style={{
                    width: "100%",
                    aspectRatio: "9/16",
                    backgroundColor: C.cardAlt,
                    backgroundImage: story.mediaType === "image" && story.mediaUrl ? `url(${story.mediaUrl})` : undefined,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    position: "relative",
                  }}
                >
                  {story.mediaType === "video" && (
                    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 22, backgroundColor: "rgba(0,0,0,0.3)" }}>
                      ▶
                    </div>
                  )}
                  {story.visibility === "members_only" && (
                    <span style={{ position: "absolute", top: 4, left: 4, fontSize: 8, padding: "2px 5px", backgroundColor: C.accentDeep, color: "#fff", fontFamily: FONT_SERIF }}>
                      限定
                    </span>
                  )}
                </div>
                {/* メタ */}
                <div style={{ padding: "6px 8px 8px" }}>
                  <p style={{ fontSize: 9, color: C.accent, fontFamily: FONT_DISPLAY, letterSpacing: "0.1em", marginBottom: 2, fontWeight: 500 }}>
                    {formatRemaining(story.expiresAt)}
                  </p>
                  <div style={{ display: "flex", gap: 6, fontSize: 9, color: C.textMuted, fontFamily: FONT_SANS, fontVariantNumeric: "tabular-nums" }}>
                    <span>👀 {story.uniqueViewerCount}</span>
                  </div>
                  <button
                    onClick={() => setDeleteTargetId(story.id)}
                    style={{ marginTop: 6, width: "100%", padding: "4px 0", fontSize: 9, cursor: "pointer", backgroundColor: "transparent", border: `1px solid ${C.border}`, color: C.textMuted, fontFamily: FONT_SERIF }}
                  >
                    🗑 削除
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 過去ストーリー (期限切れ、参考表示) */}
      {expiredStories.length > 0 && (
        <details>
          <summary style={{ fontSize: 10, color: C.textMuted, cursor: "pointer", fontFamily: FONT_SERIF, letterSpacing: "0.05em" }}>
            過去のストーリー ({expiredStories.length})
          </summary>
          <p style={{ fontSize: 10, color: C.textMuted, marginTop: 6, fontFamily: FONT_SERIF, lineHeight: 1.6 }}>
            ※ 期限切れのストーリーは画像・動画が削除されています。閲覧数の記録のみ残ります。
          </p>
        </details>
      )}

      {/* ════════════════════════════════════════════════
          投稿モーダル
          ════════════════════════════════════════════════ */}
      {composerOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            zIndex: 9999,
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "center",
            overflow: "auto",
          }}
          onClick={(e) => { if (e.target === e.currentTarget) closeComposer(); }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 480,
              minHeight: "100vh",
              backgroundColor: C.bg,
              padding: "16px 14px 80px",
              fontFamily: FONT_SERIF,
            }}
          >
            {/* ヘッダ */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, paddingBottom: 10, borderBottom: `1px solid ${C.border}` }}>
              <button onClick={closeComposer} style={{ padding: "6px 10px", fontSize: 11, cursor: "pointer", backgroundColor: "transparent", border: "none", color: C.textSub, fontFamily: FONT_SERIF }}>
                ← 戻る
              </button>
              <p style={{ fontSize: 13, fontWeight: 500, color: C.text, letterSpacing: "0.08em" }}>📱 ストーリー投稿</p>
              <div style={{ width: 50 }} />
            </div>

            {errorMsg && (
              <div style={{ padding: 10, backgroundColor: "#fef2f2", border: `1px solid #c45555`, fontSize: 11, color: "#7a2929", marginBottom: 14, fontFamily: FONT_SERIF }}>
                {errorMsg}
              </div>
            )}

            {/* メディア選択/プレビュー */}
            <div style={{ marginBottom: 18 }}>
              <p style={{ fontSize: 10, letterSpacing: "0.15em", color: C.textSub, marginBottom: 8, fontFamily: FONT_DISPLAY }}>
                MEDIA · 画像または動画
              </p>

              {!mediaPreview ? (
                <div>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      width: "100%",
                      aspectRatio: "9/16",
                      maxHeight: 400,
                      border: `2px dashed ${C.border}`,
                      backgroundColor: C.cardAlt,
                      cursor: "pointer",
                      color: C.textMuted,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      fontFamily: FONT_SERIF,
                    }}
                  >
                    <span style={{ fontSize: 36 }}>📷</span>
                    <span style={{ fontSize: 12 }}>タップして選択</span>
                    <span style={{ fontSize: 10, color: C.textFaint, lineHeight: 1.5, textAlign: "center" }}>
                      画像: 5MB以下<br />
                      動画: 15秒/20MB以下 (MP4 / MOV)
                    </span>
                  </button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*,video/mp4,video/quicktime"
                    onChange={handleFileSelect}
                    style={{ display: "none" }}
                  />
                </div>
              ) : (
                <div style={{ position: "relative" }}>
                  {mediaType === "image" ? (
                    <img
                      src={mediaPreview}
                      alt="プレビュー"
                      style={{ width: "100%", maxHeight: 500, objectFit: "contain", backgroundColor: "#000", border: `1px solid ${C.border}` }}
                    />
                  ) : (
                    <video
                      src={mediaPreview}
                      controls
                      style={{ width: "100%", maxHeight: 500, backgroundColor: "#000", border: `1px solid ${C.border}` }}
                    />
                  )}
                  {mediaType === "video" && videoDuration > 0 && (
                    <p style={{ fontSize: 10, color: C.textMuted, marginTop: 6, fontFamily: FONT_SERIF }}>
                      動画の長さ: {videoDuration}秒
                    </p>
                  )}
                  <button
                    onClick={resetForm}
                    style={{ marginTop: 8, padding: "6px 12px", fontSize: 11, cursor: "pointer", backgroundColor: "transparent", border: `1px solid ${C.border}`, color: C.textSub, fontFamily: FONT_SERIF }}
                  >
                    別のファイルを選ぶ
                  </button>
                </div>
              )}
            </div>

            {/* キャプション */}
            <div style={{ marginBottom: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                <p style={{ fontSize: 10, letterSpacing: "0.15em", color: C.textSub, fontFamily: FONT_DISPLAY }}>CAPTION · キャプション(任意)</p>
                <p style={{ fontSize: 9, color: caption.length > MAX_CAPTION ? "#c45555" : C.textMuted, fontFamily: FONT_SANS }}>{caption.length}/{MAX_CAPTION}</p>
              </div>
              <input
                type="text"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="例: お気に入りのカフェにて"
                style={{ width: "100%", padding: "10px 12px", fontSize: 12, border: `1px solid ${C.border}`, backgroundColor: C.card, color: C.text, fontFamily: FONT_SERIF, outline: "none" }}
              />
            </div>

            {/* 公開範囲 */}
            <div style={{ marginBottom: 18 }}>
              <p style={{ fontSize: 10, letterSpacing: "0.15em", color: C.textSub, marginBottom: 8, fontFamily: FONT_DISPLAY }}>VISIBILITY · 公開範囲</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 10, padding: 10, border: `1px solid ${visibility === "public" ? C.accent : C.border}`, backgroundColor: visibility === "public" ? "#fef7f9" : C.card, cursor: "pointer", fontFamily: FONT_SERIF }}>
                  <input type="radio" checked={visibility === "public"} onChange={() => setVisibility("public")} />
                  <div>
                    <p style={{ fontSize: 11, color: C.text, fontWeight: 500 }}>🌐 全公開</p>
                    <p style={{ fontSize: 9, color: C.textMuted }}>HPで誰でも見られます</p>
                  </div>
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 10, padding: 10, border: `1px solid ${visibility === "members_only" ? C.accent : C.border}`, backgroundColor: visibility === "members_only" ? "#fef7f9" : C.card, cursor: "pointer", fontFamily: FONT_SERIF }}>
                  <input type="radio" checked={visibility === "members_only"} onChange={() => setVisibility("members_only")} />
                  <div>
                    <p style={{ fontSize: 11, color: C.text, fontWeight: 500 }}>🔒 会員限定</p>
                    <p style={{ fontSize: 9, color: C.textMuted }}>会員様のみ閲覧可能</p>
                  </div>
                </label>
              </div>
            </div>

            {/* 注意書き */}
            <div style={{ padding: 10, backgroundColor: "#fef7d4", border: "1px solid #b38419", marginBottom: 14, fontSize: 10, color: "#7a5a0e", fontFamily: FONT_SERIF, lineHeight: 1.6 }}>
              ⏰ ストーリーは投稿から <strong>24時間後に自動で消えます</strong><br />
              💾 削除されると元には戻せません
            </div>

            {/* 投稿ボタン */}
            <button
              onClick={handleSubmit}
              disabled={submitting || !mediaBase64}
              style={{
                width: "100%",
                padding: "14px",
                fontSize: 13,
                cursor: submitting || !mediaBase64 ? "not-allowed" : "pointer",
                backgroundColor: C.accent,
                color: "#fff",
                border: "none",
                fontFamily: FONT_SERIF,
                letterSpacing: "0.1em",
                fontWeight: 500,
                opacity: submitting || !mediaBase64 ? 0.5 : 1,
              }}
            >
              {submitting ? "投稿中..." : "📤 投稿する"}
            </button>
          </div>
        </div>
      )}

      {/* 削除確認 */}
      {deleteTargetId !== null && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setDeleteTargetId(null); }}
        >
          <div style={{ width: "100%", maxWidth: 360, backgroundColor: C.card, padding: 20, fontFamily: FONT_SERIF }}>
            <p style={{ fontSize: 14, color: C.text, fontWeight: 500, marginBottom: 8, textAlign: "center" }}>🗑 ストーリーを削除しますか?</p>
            <p style={{ fontSize: 11, color: C.textMuted, marginBottom: 16, textAlign: "center", lineHeight: 1.6 }}>
              削除すると元には戻せません
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <button onClick={() => setDeleteTargetId(null)} style={{ padding: 12, fontSize: 12, cursor: "pointer", backgroundColor: "transparent", border: `1px solid ${C.border}`, color: C.textSub, fontFamily: FONT_SERIF }}>
                キャンセル
              </button>
              <button onClick={() => handleDelete(deleteTargetId)} style={{ padding: 12, fontSize: 12, cursor: "pointer", backgroundColor: "#c45555", color: "#fff", border: "none", fontFamily: FONT_SERIF, fontWeight: 500 }}>
                削除する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
