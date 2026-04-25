"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import TherapistStorySection from "./therapist-story-section";
import TherapistCommentReplySection from "./therapist-comment-reply-section";

/**
 * ═══════════════════════════════════════════════════════════
 * セラピストマイページ用 写メ日記タブ
 *
 * 機能:
 *   - 写メ日記投稿 (画像複数枚 + タイトル + 本文 + タグ + 公開範囲)
 *   - 過去の投稿一覧表示 (編集/削除)
 *   - 投稿統計表示
 *
 * API:
 *   - POST   /api/diary/post
 *   - GET    /api/diary/my-entries
 *   - PATCH  /api/diary/[id]
 *   - DELETE /api/diary/[id]
 *   - GET    /api/diary/tags/popular
 *
 * 認証: therapist の login_password を authToken として使用 (Phase 1 簡易方式)
 * ═══════════════════════════════════════════════════════════
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

type DiaryEntry = {
  id: number;
  title: string;
  bodyPreview: string;
  coverImageUrl: string | null;
  visibility: "public" | "members_only";
  status: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  publishedAt: string;
  ekichikaDispatchStatus: string | null;
  ekichikaDispatchedAt: string | null;
  ekichikaErrorMessage: string | null;
  deletedAt: string | null;
};

type PopularTag = {
  id: number;
  name: string;
  displayName: string;
  color: string | null;
  isFeatured: boolean;
};

type ImageInput = {
  base64: string;
  mediaType: string;
  preview: string;
};

type Props = {
  therapistId: number;
  therapistName: string;
  authToken: string; // login_password を使う (Phase 1)
  C: ColorTheme;
  FONT_SERIF: string;
  FONT_DISPLAY: string;
  FONT_SANS: string;
};

const MAX_IMAGES = 10;
const MAX_TITLE = 80;
const MAX_BODY = 2000;
const MAX_TAGS = 10;

export default function TherapistDiaryTab({
  therapistId,
  therapistName,
  authToken,
  C,
  FONT_SERIF,
  FONT_DISPLAY,
  FONT_SANS,
}: Props) {
  // 過去投稿一覧
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [loadingList, setLoadingList] = useState(true);

  // 投稿モーダル
  const [composerOpen, setComposerOpen] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState<number | null>(null);

  // 投稿フォーム
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [images, setImages] = useState<ImageInput[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [customTagInput, setCustomTagInput] = useState("");
  const [visibility, setVisibility] = useState<"public" | "members_only">("public");
  const [sendToEkichika, setSendToEkichika] = useState(true);

  // 人気タグ
  const [popularTags, setPopularTags] = useState<PopularTag[]>([]);

  // 状態
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // 削除確認
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ═══════════════════════════════════════════════════════════
  // データ取得
  // ═══════════════════════════════════════════════════════════
  const fetchMyEntries = useCallback(async () => {
    setLoadingList(true);
    try {
      const res = await fetch(
        `/api/diary/my-entries?therapistId=${therapistId}&authToken=${encodeURIComponent(authToken)}`
      );
      const data = await res.json();
      if (res.ok && data.entries) {
        setEntries(data.entries);
      }
    } catch (e) {
      console.error("fetch entries failed:", e);
    } finally {
      setLoadingList(false);
    }
  }, [therapistId, authToken]);

  const fetchPopularTags = useCallback(async () => {
    try {
      const res = await fetch("/api/diary/tags/popular?limit=15");
      const data = await res.json();
      if (res.ok && data.tags) {
        setPopularTags(data.tags);
      }
    } catch (e) {
      console.error("fetch tags failed:", e);
    }
  }, []);

  useEffect(() => {
    fetchMyEntries();
    fetchPopularTags();
  }, [fetchMyEntries, fetchPopularTags]);

  // ═══════════════════════════════════════════════════════════
  // 統計値計算
  // ═══════════════════════════════════════════════════════════
  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const thisMonthEntries = entries.filter(
    (e) => !e.deletedAt && e.publishedAt >= thisMonthStart
  );
  const thisMonthCount = thisMonthEntries.length;
  const thisMonthViews = thisMonthEntries.reduce((s, e) => s + e.viewCount, 0);
  const thisMonthLikes = thisMonthEntries.reduce((s, e) => s + e.likeCount, 0);

  // ═══════════════════════════════════════════════════════════
  // フォームリセット
  // ═══════════════════════════════════════════════════════════
  const resetForm = () => {
    setTitle("");
    setBody("");
    setImages([]);
    setSelectedTags([]);
    setCustomTagInput("");
    setVisibility("public");
    setSendToEkichika(true);
    setEditingEntryId(null);
    setErrorMsg(null);
  };

  const openComposer = () => {
    resetForm();
    setComposerOpen(true);
  };

  const closeComposer = () => {
    setComposerOpen(false);
    resetForm();
  };

  // ═══════════════════════════════════════════════════════════
  // 画像処理
  // ═══════════════════════════════════════════════════════════
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const remaining = MAX_IMAGES - images.length;
    if (remaining <= 0) {
      setErrorMsg(`写真は最大${MAX_IMAGES}枚までです`);
      return;
    }

    const filesToProcess = Array.from(files).slice(0, remaining);
    const newImages: ImageInput[] = [];

    for (const file of filesToProcess) {
      if (!file.type.startsWith("image/")) {
        setErrorMsg("画像ファイルのみアップロードできます");
        continue;
      }
      if (file.size > 10 * 1024 * 1024) {
        setErrorMsg(`${file.name}は10MBを超えています`);
        continue;
      }
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("読み込みエラー"));
        reader.readAsDataURL(file);
      });
      newImages.push({
        base64,
        mediaType: file.type,
        preview: base64,
      });
    }

    setImages([...images, ...newImages]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
  };

  const moveImage = (from: number, to: number) => {
    if (to < 0 || to >= images.length) return;
    const next = [...images];
    const [m] = next.splice(from, 1);
    next.splice(to, 0, m);
    setImages(next);
  };

  // ═══════════════════════════════════════════════════════════
  // タグ処理
  // ═══════════════════════════════════════════════════════════
  const toggleTag = (tagName: string) => {
    const clean = tagName.replace(/^#/, "");
    if (selectedTags.includes(clean)) {
      setSelectedTags(selectedTags.filter((t) => t !== clean));
    } else {
      if (selectedTags.length >= MAX_TAGS) {
        setErrorMsg(`タグは最大${MAX_TAGS}個までです`);
        return;
      }
      setSelectedTags([...selectedTags, clean]);
    }
  };

  const addCustomTag = () => {
    const clean = customTagInput.replace(/^#/, "").trim();
    if (!clean) return;
    if (selectedTags.includes(clean)) {
      setCustomTagInput("");
      return;
    }
    if (selectedTags.length >= MAX_TAGS) {
      setErrorMsg(`タグは最大${MAX_TAGS}個までです`);
      return;
    }
    setSelectedTags([...selectedTags, clean]);
    setCustomTagInput("");
  };

  // ═══════════════════════════════════════════════════════════
  // 投稿
  // ═══════════════════════════════════════════════════════════
  const handleSubmit = async () => {
    setErrorMsg(null);

    if (!title.trim()) {
      setErrorMsg("タイトルを入力してください");
      return;
    }
    if (title.length > MAX_TITLE) {
      setErrorMsg(`タイトルは${MAX_TITLE}文字以内です`);
      return;
    }
    if (!body.trim()) {
      setErrorMsg("本文を入力してください");
      return;
    }
    if (body.length > MAX_BODY) {
      setErrorMsg(`本文は${MAX_BODY}文字以内です`);
      return;
    }
    if (images.length === 0) {
      setErrorMsg("写真を1枚以上添付してください");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/diary/post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          therapistId,
          authToken,
          title: title.trim(),
          body: body.trim(),
          visibility,
          images: images.map((img) => ({
            base64: img.base64,
            mediaType: img.mediaType,
          })),
          tags: selectedTags,
          sendToEkichika: visibility === "public" ? sendToEkichika : false,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "投稿に失敗しました");
      } else {
        setSuccessMsg(
          visibility === "public" && sendToEkichika
            ? "✨ 投稿しました!駅ちかへの自動送信も開始しました"
            : "✨ 投稿しました!"
        );
        closeComposer();
        await fetchMyEntries();
        // 3秒後にメッセージ消す
        setTimeout(() => setSuccessMsg(null), 3000);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "通信エラー";
      setErrorMsg(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // ═══════════════════════════════════════════════════════════
  // 削除
  // ═══════════════════════════════════════════════════════════
  const handleDelete = async (id: number) => {
    try {
      const res = await fetch(`/api/diary/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          therapistId,
          authToken,
          deleteReason: "セラピスト本人による削除",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "削除に失敗しました");
      } else {
        setSuccessMsg("削除しました");
        setDeleteTargetId(null);
        await fetchMyEntries();
        setTimeout(() => setSuccessMsg(null), 3000);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "通信エラー";
      setErrorMsg(msg);
    }
  };

  // ═══════════════════════════════════════════════════════════
  // ヘルパー
  // ═══════════════════════════════════════════════════════════
  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  const dispatchStatusLabel = (status: string | null) => {
    if (!status) return "";
    if (status === "sent") return "✅ 駅ちか送信済";
    if (status === "pending") return "⏳ 駅ちか送信中";
    if (status === "failed") return "❌ 駅ちか送信失敗";
    if (status === "skipped") return "— 駅ちか送信なし";
    return status;
  };

  const dispatchStatusColor = (status: string | null) => {
    if (status === "sent") return "#6b9b7e";
    if (status === "failed") return "#c45555";
    if (status === "pending") return "#b38419";
    return C.textMuted;
  };

  // ═══════════════════════════════════════════════════════════
  // レンダリング
  // ═══════════════════════════════════════════════════════════
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, fontFamily: FONT_SERIF }}>
      {/* セクション見出し */}
      <div style={{ textAlign: "center" }}>
        <p style={{ fontFamily: FONT_DISPLAY, fontSize: 11, letterSpacing: "0.25em", color: C.accent, marginBottom: 6, fontWeight: 500 }}>DIARY</p>
        <p style={{ fontFamily: FONT_SERIF, fontSize: 15, letterSpacing: "0.08em", color: C.text, fontWeight: 500, marginBottom: 10 }}>📸 写メ日記</p>
        <div style={{ width: 30, height: 1, backgroundColor: C.accent, margin: "0 auto" }} />
      </div>

      {/* 成功メッセージ */}
      {successMsg && (
        <div style={{ padding: 12, backgroundColor: "#f0f7f1", border: `1px solid #6b9b7e`, fontSize: 12, color: "#3d6149", textAlign: "center", fontFamily: FONT_SERIF }}>
          {successMsg}
        </div>
      )}

      {/* 投稿ボタン */}
      <button
        onClick={openComposer}
        style={{
          width: "100%",
          padding: "16px 12px",
          fontSize: 13,
          cursor: "pointer",
          backgroundColor: C.accent,
          color: "#fff",
          border: "none",
          fontFamily: FONT_SERIF,
          letterSpacing: "0.1em",
          fontWeight: 500,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
        }}
      >
        ✏️ 新しい日記を書く
      </button>

      {/* 統計サマリー */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 0, border: `1px solid ${C.border}`, backgroundColor: C.card }}>
        <div style={{ padding: "14px 8px", textAlign: "center", borderRight: `1px solid ${C.border}` }}>
          <p style={{ fontSize: 9, letterSpacing: "0.15em", color: C.textMuted, marginBottom: 4, fontFamily: FONT_DISPLAY }}>POSTS</p>
          <p style={{ fontSize: 22, fontWeight: 500, color: C.text, fontFamily: FONT_SANS, fontVariantNumeric: "tabular-nums" }}>{thisMonthCount}</p>
          <p style={{ fontSize: 9, color: C.textMuted, fontFamily: FONT_SERIF, marginTop: 2 }}>今月の投稿</p>
        </div>
        <div style={{ padding: "14px 8px", textAlign: "center", borderRight: `1px solid ${C.border}` }}>
          <p style={{ fontSize: 9, letterSpacing: "0.15em", color: C.textMuted, marginBottom: 4, fontFamily: FONT_DISPLAY }}>VIEWS</p>
          <p style={{ fontSize: 22, fontWeight: 500, color: C.text, fontFamily: FONT_SANS, fontVariantNumeric: "tabular-nums" }}>{thisMonthViews.toLocaleString()}</p>
          <p style={{ fontSize: 9, color: C.textMuted, fontFamily: FONT_SERIF, marginTop: 2 }}>今月の閲覧</p>
        </div>
        <div style={{ padding: "14px 8px", textAlign: "center" }}>
          <p style={{ fontSize: 9, letterSpacing: "0.15em", color: C.textMuted, marginBottom: 4, fontFamily: FONT_DISPLAY }}>LIKES</p>
          <p style={{ fontSize: 22, fontWeight: 500, color: C.text, fontFamily: FONT_SANS, fontVariantNumeric: "tabular-nums" }}>{thisMonthLikes.toLocaleString()}</p>
          <p style={{ fontSize: 9, color: C.textMuted, fontFamily: FONT_SERIF, marginTop: 2 }}>今月のいいね</p>
        </div>
      </div>

      {/* ストーリーズ セクション (24時間で消える) */}
      <TherapistStorySection
        therapistId={therapistId}
        authToken={authToken}
        C={C}
        FONT_SERIF={FONT_SERIF}
        FONT_DISPLAY={FONT_DISPLAY}
        FONT_SANS={FONT_SANS}
      />

      {/* コメントへの返信セクション */}
      <TherapistCommentReplySection
        therapistId={therapistId}
        authToken={authToken}
        C={C}
        FONT_SERIF={FONT_SERIF}
        FONT_DISPLAY={FONT_DISPLAY}
        FONT_SANS={FONT_SANS}
      />

      {/* 過去投稿一覧 */}
      <div>
        <p style={{ fontSize: 11, letterSpacing: "0.15em", color: C.textSub, marginBottom: 10, fontFamily: FONT_DISPLAY, fontWeight: 500 }}>HISTORY · 投稿一覧</p>

        {loadingList ? (
          <p style={{ fontSize: 11, color: C.textMuted, textAlign: "center", padding: 20, fontFamily: FONT_SERIF }}>読み込み中...</p>
        ) : entries.filter((e) => !e.deletedAt).length === 0 ? (
          <div style={{ padding: 30, textAlign: "center", backgroundColor: C.cardAlt, border: `1px solid ${C.border}` }}>
            <p style={{ fontSize: 28, marginBottom: 8 }}>📸</p>
            <p style={{ fontSize: 12, color: C.textSub, fontFamily: FONT_SERIF, lineHeight: 1.6 }}>
              まだ投稿がありません<br />
              最初の写メ日記を書いてみましょう
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {entries.filter((e) => !e.deletedAt).map((entry) => (
              <div key={entry.id} style={{ display: "flex", gap: 10, padding: 10, backgroundColor: C.card, border: `1px solid ${C.border}` }}>
                {entry.coverImageUrl ? (
                  <div style={{ width: 80, height: 80, flexShrink: 0, backgroundImage: `url(${entry.coverImageUrl})`, backgroundSize: "cover", backgroundPosition: "center" }} />
                ) : (
                  <div style={{ width: 80, height: 80, flexShrink: 0, backgroundColor: C.cardAlt, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, color: C.textMuted }}>📷</div>
                )}
                <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 500, color: C.text, fontFamily: FONT_SERIF, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {entry.title}
                    </p>
                    <p style={{ fontSize: 10, color: C.textMuted, fontFamily: FONT_SERIF, lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                      {entry.bodyPreview}
                    </p>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, fontSize: 9, color: C.textMuted, fontFamily: FONT_SANS, fontVariantNumeric: "tabular-nums", marginTop: 4 }}>
                    <span>{entry.visibility === "members_only" ? "🔒 限定" : "🌐 全公開"}</span>
                    <span>👀 {entry.viewCount}</span>
                    <span>❤️ {entry.likeCount}</span>
                    <span>💬 {entry.commentCount}</span>
                    <span style={{ color: dispatchStatusColor(entry.ekichikaDispatchStatus) }}>
                      {dispatchStatusLabel(entry.ekichikaDispatchStatus)}
                    </span>
                    <span>{formatDate(entry.publishedAt)}</span>
                  </div>
                </div>
                <button
                  onClick={() => setDeleteTargetId(entry.id)}
                  style={{ padding: "4px 8px", fontSize: 10, cursor: "pointer", backgroundColor: "transparent", border: `1px solid ${C.border}`, color: C.textMuted, fontFamily: FONT_SERIF, alignSelf: "flex-start" }}
                  title="削除"
                >
                  🗑
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════
          投稿モーダル
          ═══════════════════════════════════════════════════════════ */}
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
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, paddingBottom: 12, borderBottom: `1px solid ${C.border}` }}>
              <button onClick={closeComposer} style={{ padding: "6px 10px", fontSize: 11, cursor: "pointer", backgroundColor: "transparent", border: "none", color: C.textSub, fontFamily: FONT_SERIF }}>
                ← 戻る
              </button>
              <p style={{ fontSize: 13, fontWeight: 500, color: C.text, fontFamily: FONT_SERIF, letterSpacing: "0.08em" }}>📸 新しい日記</p>
              <div style={{ width: 50 }} />
            </div>

            {/* エラー */}
            {errorMsg && (
              <div style={{ padding: 10, backgroundColor: "#fef2f2", border: `1px solid #c45555`, fontSize: 11, color: "#7a2929", marginBottom: 14, fontFamily: FONT_SERIF }}>
                {errorMsg}
              </div>
            )}

            {/* 画像 */}
            <div style={{ marginBottom: 18 }}>
              <p style={{ fontSize: 10, letterSpacing: "0.15em", color: C.textSub, marginBottom: 8, fontFamily: FONT_DISPLAY }}>PHOTOS · 写真 ({images.length}/{MAX_IMAGES})</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                {images.map((img, i) => (
                  <div key={i} style={{ position: "relative", aspectRatio: "1", backgroundImage: `url(${img.preview})`, backgroundSize: "cover", backgroundPosition: "center", border: i === 0 ? `2px solid ${C.accent}` : `1px solid ${C.border}` }}>
                    {i === 0 && (
                      <span style={{ position: "absolute", top: 4, left: 4, fontSize: 9, padding: "2px 5px", backgroundColor: C.accent, color: "#fff", fontFamily: FONT_SERIF, letterSpacing: "0.05em" }}>カバー</span>
                    )}
                    <div style={{ position: "absolute", top: 4, right: 4, display: "flex", gap: 4 }}>
                      {i > 0 && (
                        <button onClick={() => moveImage(i, i - 1)} style={{ width: 20, height: 20, fontSize: 10, cursor: "pointer", backgroundColor: "rgba(0,0,0,0.6)", color: "#fff", border: "none" }} title="前へ">←</button>
                      )}
                      {i < images.length - 1 && (
                        <button onClick={() => moveImage(i, i + 1)} style={{ width: 20, height: 20, fontSize: 10, cursor: "pointer", backgroundColor: "rgba(0,0,0,0.6)", color: "#fff", border: "none" }} title="次へ">→</button>
                      )}
                      <button onClick={() => removeImage(i)} style={{ width: 20, height: 20, fontSize: 10, cursor: "pointer", backgroundColor: "rgba(196,85,85,0.9)", color: "#fff", border: "none" }} title="削除">×</button>
                    </div>
                  </div>
                ))}
                {images.length < MAX_IMAGES && (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    style={{ aspectRatio: "1", border: `1px dashed ${C.border}`, backgroundColor: C.cardAlt, fontSize: 22, cursor: "pointer", color: C.textMuted, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 2 }}
                  >
                    <span>+</span>
                    <span style={{ fontSize: 9, fontFamily: FONT_SERIF }}>写真追加</span>
                  </button>
                )}
              </div>
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                multiple
                onChange={handleFileSelect}
                style={{ display: "none" }}
              />
              <p style={{ fontSize: 9, color: C.textMuted, marginTop: 6, fontFamily: FONT_SERIF }}>
                ※ 最初の1枚がカバー画像になります(矢印で並べ替え可能)
              </p>
            </div>

            {/* タイトル */}
            <div style={{ marginBottom: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                <p style={{ fontSize: 10, letterSpacing: "0.15em", color: C.textSub, fontFamily: FONT_DISPLAY }}>TITLE · タイトル</p>
                <p style={{ fontSize: 9, color: title.length > MAX_TITLE ? "#c45555" : C.textMuted, fontFamily: FONT_SANS }}>{title.length}/{MAX_TITLE}</p>
              </div>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="例: 久しぶりの出勤です♪"
                maxLength={MAX_TITLE + 10}
                style={{ width: "100%", padding: "10px 12px", fontSize: 13, border: `1px solid ${C.border}`, backgroundColor: C.card, color: C.text, fontFamily: FONT_SERIF, outline: "none" }}
              />
            </div>

            {/* 本文 */}
            <div style={{ marginBottom: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                <p style={{ fontSize: 10, letterSpacing: "0.15em", color: C.textSub, fontFamily: FONT_DISPLAY }}>BODY · 本文</p>
                <p style={{ fontSize: 9, color: body.length > MAX_BODY ? "#c45555" : C.textMuted, fontFamily: FONT_SANS }}>{body.length}/{MAX_BODY}</p>
              </div>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="今日のお話を書いてみましょう♡"
                rows={8}
                style={{ width: "100%", padding: "10px 12px", fontSize: 13, border: `1px solid ${C.border}`, backgroundColor: C.card, color: C.text, fontFamily: FONT_SERIF, outline: "none", resize: "vertical", lineHeight: 1.6 }}
              />
            </div>

            {/* タグ */}
            <div style={{ marginBottom: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                <p style={{ fontSize: 10, letterSpacing: "0.15em", color: C.textSub, fontFamily: FONT_DISPLAY }}>TAGS · ハッシュタグ ({selectedTags.length}/{MAX_TAGS})</p>
              </div>

              {/* 選択中のタグ */}
              {selectedTags.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                  {selectedTags.map((tag) => (
                    <button
                      key={tag}
                      onClick={() => toggleTag(tag)}
                      style={{ padding: "4px 10px", fontSize: 11, cursor: "pointer", backgroundColor: C.accent, color: "#fff", border: "none", fontFamily: FONT_SERIF, display: "flex", alignItems: "center", gap: 4 }}
                    >
                      #{tag} <span style={{ opacity: 0.7 }}>×</span>
                    </button>
                  ))}
                </div>
              )}

              {/* 人気タグ */}
              {popularTags.length > 0 && (
                <div style={{ marginBottom: 8 }}>
                  <p style={{ fontSize: 9, color: C.textMuted, marginBottom: 6, fontFamily: FONT_SERIF }}>よく使うタグ</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {popularTags.filter(t => !selectedTags.includes(t.name)).slice(0, 12).map((tag) => (
                      <button
                        key={tag.id}
                        onClick={() => toggleTag(tag.name)}
                        style={{ padding: "4px 10px", fontSize: 11, cursor: "pointer", backgroundColor: "transparent", color: C.textSub, border: `1px solid ${C.border}`, fontFamily: FONT_SERIF }}
                      >
                        {tag.displayName}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* カスタムタグ追加 */}
              <div style={{ display: "flex", gap: 6 }}>
                <input
                  type="text"
                  value={customTagInput}
                  onChange={(e) => setCustomTagInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomTag(); } }}
                  placeholder="自分でタグを追加"
                  style={{ flex: 1, padding: "8px 10px", fontSize: 11, border: `1px solid ${C.border}`, backgroundColor: C.card, color: C.text, fontFamily: FONT_SERIF, outline: "none" }}
                />
                <button
                  onClick={addCustomTag}
                  disabled={!customTagInput.trim()}
                  style={{ padding: "8px 14px", fontSize: 11, cursor: "pointer", backgroundColor: "transparent", border: `1px solid ${C.accent}`, color: C.accent, fontFamily: FONT_SERIF, opacity: !customTagInput.trim() ? 0.5 : 1 }}
                >
                  +追加
                </button>
              </div>
            </div>

            {/* 公開範囲 */}
            <div style={{ marginBottom: 18 }}>
              <p style={{ fontSize: 10, letterSpacing: "0.15em", color: C.textSub, marginBottom: 8, fontFamily: FONT_DISPLAY }}>VISIBILITY · 公開範囲</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <label style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: 12, border: `1px solid ${visibility === "public" ? C.accent : C.border}`, backgroundColor: visibility === "public" ? "#fef7f9" : C.card, cursor: "pointer", fontFamily: FONT_SERIF }}>
                  <input
                    type="radio"
                    name="visibility"
                    checked={visibility === "public"}
                    onChange={() => setVisibility("public")}
                    style={{ marginTop: 2 }}
                  />
                  <div>
                    <p style={{ fontSize: 12, color: C.text, fontWeight: 500, marginBottom: 2 }}>🌐 全公開</p>
                    <p style={{ fontSize: 10, color: C.textMuted, lineHeight: 1.5 }}>HP・駅ちかなど誰でも見られます</p>
                  </div>
                </label>
                <label style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: 12, border: `1px solid ${visibility === "members_only" ? C.accent : C.border}`, backgroundColor: visibility === "members_only" ? "#fef7f9" : C.card, cursor: "pointer", fontFamily: FONT_SERIF }}>
                  <input
                    type="radio"
                    name="visibility"
                    checked={visibility === "members_only"}
                    onChange={() => { setVisibility("members_only"); setSendToEkichika(false); }}
                    style={{ marginTop: 2 }}
                  />
                  <div>
                    <p style={{ fontSize: 12, color: C.text, fontWeight: 500, marginBottom: 2 }}>🔒 会員限定</p>
                    <p style={{ fontSize: 10, color: C.textMuted, lineHeight: 1.5 }}>HPの会員ページのみ。駅ちかには送りません</p>
                  </div>
                </label>
              </div>
            </div>

            {/* 駅ちか連携 */}
            {visibility === "public" && (
              <div style={{ marginBottom: 18 }}>
                <p style={{ fontSize: 10, letterSpacing: "0.15em", color: C.textSub, marginBottom: 8, fontFamily: FONT_DISPLAY }}>EKICHIKA · 駅ちか同時投稿</p>
                <label style={{ display: "flex", alignItems: "center", gap: 10, padding: 10, border: `1px solid ${C.border}`, backgroundColor: C.cardAlt, cursor: "pointer", fontFamily: FONT_SERIF }}>
                  <input
                    type="checkbox"
                    checked={sendToEkichika}
                    onChange={(e) => setSendToEkichika(e.target.checked)}
                  />
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 11, color: C.text, fontWeight: 500, marginBottom: 2 }}>📧 駅ちか + 6サイトに同時投稿</p>
                    <p style={{ fontSize: 9, color: C.textMuted, lineHeight: 1.5 }}>メンエスマップ、口コミ情報局など6つのポータルへ自動転送</p>
                  </div>
                </label>
              </div>
            )}

            {/* 投稿ボタン */}
            <button
              onClick={handleSubmit}
              disabled={submitting || images.length === 0 || !title.trim() || !body.trim()}
              style={{
                width: "100%",
                padding: "16px 12px",
                fontSize: 13,
                cursor: submitting || images.length === 0 || !title.trim() || !body.trim() ? "not-allowed" : "pointer",
                backgroundColor: C.accent,
                color: "#fff",
                border: "none",
                fontFamily: FONT_SERIF,
                letterSpacing: "0.1em",
                fontWeight: 500,
                opacity: submitting || images.length === 0 || !title.trim() || !body.trim() ? 0.5 : 1,
              }}
            >
              {submitting ? "投稿中..." : "📤 投稿する"}
            </button>
          </div>
        </div>
      )}

      {/* 削除確認モーダル */}
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
            <p style={{ fontSize: 14, color: C.text, fontWeight: 500, marginBottom: 8, textAlign: "center" }}>🗑 削除しますか?</p>
            <p style={{ fontSize: 11, color: C.textMuted, marginBottom: 16, textAlign: "center", lineHeight: 1.6 }}>
              削除した投稿は元に戻せません。<br />
              ※駅ちか側からは自動削除されません
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <button
                onClick={() => setDeleteTargetId(null)}
                style={{ padding: 12, fontSize: 12, cursor: "pointer", backgroundColor: "transparent", border: `1px solid ${C.border}`, color: C.textSub, fontFamily: FONT_SERIF }}
              >
                キャンセル
              </button>
              <button
                onClick={() => handleDelete(deleteTargetId)}
                style={{ padding: 12, fontSize: 12, cursor: "pointer", backgroundColor: "#c45555", color: "#fff", border: "none", fontFamily: FONT_SERIF, fontWeight: 500 }}
              >
                削除する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
