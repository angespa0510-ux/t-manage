"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import TherapistStorySection from "./therapist-story-section";
import TherapistCommentReplySection from "./therapist-comment-reply-section";
import TherapistBlueskySection from "./therapist-bluesky-section";

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

  // ライブ配信許可
  const [liveStreamingEnabled, setLiveStreamingEnabled] = useState(false);

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

  // 予約投稿
  const [scheduledEnabled, setScheduledEnabled] = useState(false);
  const [scheduledDate, setScheduledDate] = useState(""); // YYYY-MM-DD
  const [scheduledTime, setScheduledTime] = useState(""); // HH:MM

  // 人気タグ
  const [popularTags, setPopularTags] = useState<PopularTag[]>([]);

  // 状態
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // 削除確認
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);

  // AIチェック
  type AICheckIssue = {
    type: string;
    location: string;
    original: string;
    reason: string;
    suggestion: string;
  };
  type AICheckResult = {
    severity: "ok" | "warn" | "ng";
    ok: boolean;
    issues: AICheckIssue[];
    advice: string;
    improvedTitle?: string | null;
    improvedBody?: string | null;
  };
  const [aiChecking, setAiChecking] = useState(false);
  const [aiCheckResult, setAiCheckResult] = useState<AICheckResult | null>(null);

  // AIサジェスト
  type AISuggestion = {
    tone: string;
    title: string;
    body: string;
    tags: string[];
  };
  const [suggestModalOpen, setSuggestModalOpen] = useState(false);
  const [suggestHint, setSuggestHint] = useState("");
  const [aiSuggesting, setAiSuggesting] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<AISuggestion[]>([]);
  const [suggestErrorMsg, setSuggestErrorMsg] = useState<string | null>(null);

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

  // ライブ配信許可フラグ取得
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { supabase } = await import("../lib/supabase");
        const { data } = await supabase
          .from("therapists")
          .select("live_streaming_enabled")
          .eq("id", therapistId)
          .maybeSingle();
        if (!cancelled && data) {
          setLiveStreamingEnabled(!!data.live_streaming_enabled);
        }
      } catch (e) {
        console.error("fetch live_streaming_enabled:", e);
      }
    })();
    return () => { cancelled = true; };
  }, [therapistId]);

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
    setAiCheckResult(null);
    setScheduledEnabled(false);
    setScheduledDate("");
    setScheduledTime("");
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

    const filesToProcess = (Array.from(files) as File[]).slice(0, remaining);
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
  // AIサジェスト (3パターン提案)
  // ═══════════════════════════════════════════════════════════
  const requestAISuggest = async () => {
    setSuggestErrorMsg(null);
    setAiSuggesting(true);
    setAiSuggestions([]);
    try {
      const res = await fetch("/api/diary/ai-suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          therapistId,
          authToken,
          hint: suggestHint.trim() || undefined,
          draftTitle: title.trim() || undefined,
          draftBody: body.trim() || undefined,
          tags: selectedTags.length > 0 ? selectedTags : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSuggestErrorMsg(data.error || "サジェストに失敗しました");
      } else if (data.suggestions && data.suggestions.length > 0) {
        setAiSuggestions(data.suggestions);
      } else {
        setSuggestErrorMsg(data.error || "提案を生成できませんでした");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "通信エラー";
      setSuggestErrorMsg(msg);
    } finally {
      setAiSuggesting(false);
    }
  };

  // 提案を採用してフォームに反映
  const applySuggestion = (s: AISuggestion) => {
    setTitle(s.title);
    setBody(s.body);
    // タグはマージ (既存のもあるので)
    const merged = Array.from(new Set([...selectedTags, ...s.tags])).slice(0, 5);
    setSelectedTags(merged);
    setSuggestModalOpen(false);
    setAiSuggestions([]);
    setAiCheckResult(null); // 内容変わったので再チェック促す
  };

  // ═══════════════════════════════════════════════════════════
  // AIチェック (投稿前にAIに内容確認してもらう)
  // ═══════════════════════════════════════════════════════════
  const handleAICheck = async () => {
    setErrorMsg(null);
    if (!title.trim()) {
      setErrorMsg("タイトルを入力してください");
      return;
    }
    if (!body.trim()) {
      setErrorMsg("本文を入力してください");
      return;
    }
    setAiChecking(true);
    setAiCheckResult(null);
    try {
      const res = await fetch("/api/diary/ai-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          body: body.trim(),
          sendToEkichika: visibility === "public" && sendToEkichika,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "AIチェックに失敗しました");
      } else {
        setAiCheckResult(data);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "通信エラー";
      setErrorMsg(msg);
    } finally {
      setAiChecking(false);
    }
  };

  // 改善版を採用
  const applyAISuggestion = () => {
    if (!aiCheckResult) return;
    if (aiCheckResult.improvedTitle) setTitle(aiCheckResult.improvedTitle);
    if (aiCheckResult.improvedBody) setBody(aiCheckResult.improvedBody);
    setAiCheckResult(null); // 再チェック促す
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
      // 予約日時を計算 (有効なときだけISO化)
      let scheduledAtIso: string | null = null;
      if (scheduledEnabled && scheduledDate && scheduledTime) {
        // ローカル日時として解釈 → ISO文字列化
        const local = new Date(`${scheduledDate}T${scheduledTime}:00`);
        if (!isNaN(local.getTime())) {
          scheduledAtIso = local.toISOString();
        }
      }

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
          scheduledAt: scheduledAtIso,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "投稿に失敗しました");
      } else {
        if (data.isScheduled) {
          const d = new Date(data.scheduledAt);
          const fmt = `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
          setSuccessMsg(`📅 ${fmt} に公開予約しました`);
        } else {
          setSuccessMsg(
            visibility === "public" && sendToEkichika
              ? "✨ 投稿しました!駅ちかへの自動送信も開始しました"
              : "✨ 投稿しました!"
          );
        }
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

      {/* ライブ配信ボタン (許可されたセラピストのみ表示) */}
      {liveStreamingEnabled && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ textAlign: "center", marginBottom: 8 }}>
            <p style={{ fontFamily: FONT_DISPLAY, fontSize: 11, letterSpacing: "0.25em", color: C.accent, marginBottom: 6, fontWeight: 500 }}>
              LIVE BROADCAST
            </p>
            <p style={{ fontFamily: FONT_SERIF, fontSize: 13, letterSpacing: "0.08em", color: C.text, fontWeight: 500, marginBottom: 8 }}>
              🔴 ライブ配信
            </p>
            <div style={{ width: 24, height: 1, backgroundColor: C.accent, margin: "0 auto 12px" }} />
          </div>
          <a
            href={`/mypage/live-broadcast?therapistId=${therapistId}&authToken=${encodeURIComponent(authToken)}`}
            style={{
              display: "block",
              padding: "12px",
              fontSize: 13,
              textAlign: "center",
              cursor: "pointer",
              background: "linear-gradient(135deg, #fef0f4 0%, #fde8ef 100%)",
              color: "#dc3250",
              border: `1px solid #dc3250`,
              fontFamily: FONT_SERIF,
              letterSpacing: "0.1em",
              fontWeight: 500,
              textDecoration: "none",
            }}
          >
            🎬 ライブ配信を始める
          </a>
          <p style={{ fontSize: 9, color: C.textMuted, marginTop: 4, textAlign: "center", fontFamily: FONT_SERIF, lineHeight: 1.5 }}>
            美顔・スタンプ・モザイクのフィルター付き♡ 別画面が開きます
          </p>
        </div>
      )}

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

      {/* Bluesky自動投稿セクション */}
      <TherapistBlueskySection
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

            {/* AIサジェストボタン */}
            <div style={{ marginBottom: 14 }}>
              <button
                onClick={() => { setSuggestModalOpen(true); setSuggestErrorMsg(null); setAiSuggestions([]); }}
                style={{
                  width: "100%",
                  padding: "10px",
                  fontSize: 12,
                  cursor: "pointer",
                  background: "linear-gradient(135deg, #fef7f9 0%, #fef0f4 100%)",
                  color: C.accentDeep,
                  border: `1px solid ${C.accent}`,
                  fontFamily: FONT_SERIF,
                  letterSpacing: "0.1em",
                  fontWeight: 500,
                }}
              >
                💡 AIに下書きを3パターン提案してもらう
              </button>
              <p style={{ fontSize: 9, color: C.textMuted, marginTop: 4, textAlign: "center", fontFamily: FONT_SERIF, lineHeight: 1.5 }}>
                何書こう...と迷ったら使ってね♡ 過去の投稿スタイルに合わせて提案します
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
                onChange={(e) => { setTitle(e.target.value); if (aiCheckResult) setAiCheckResult(null); }}
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
                onChange={(e) => { setBody(e.target.value); if (aiCheckResult) setAiCheckResult(null); }}
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

            {/* 予約投稿 */}
            <div style={{ marginBottom: 18 }}>
              <p style={{ fontSize: 10, letterSpacing: "0.15em", color: C.textSub, marginBottom: 8, fontFamily: FONT_DISPLAY }}>
                SCHEDULE · 投稿予約
              </p>
              <label style={{ display: "flex", alignItems: "center", gap: 10, padding: 10, border: `1px solid ${scheduledEnabled ? C.accent : C.border}`, backgroundColor: scheduledEnabled ? "#fef7f9" : C.cardAlt, cursor: "pointer", fontFamily: FONT_SERIF }}>
                <input
                  type="checkbox"
                  checked={scheduledEnabled}
                  onChange={(e) => {
                    setScheduledEnabled(e.target.checked);
                    if (e.target.checked && !scheduledDate) {
                      // デフォルト = 1時間後
                      const d = new Date(Date.now() + 60 * 60 * 1000);
                      const yyyy = d.getFullYear();
                      const mm = String(d.getMonth() + 1).padStart(2, "0");
                      const dd = String(d.getDate()).padStart(2, "0");
                      setScheduledDate(`${yyyy}-${mm}-${dd}`);
                      // 15分単位に丸める
                      const min = Math.ceil(d.getMinutes() / 15) * 15;
                      const h = (min === 60 ? d.getHours() + 1 : d.getHours()) % 24;
                      const m = min === 60 ? 0 : min;
                      setScheduledTime(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
                    }
                  }}
                />
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 11, color: C.text, fontWeight: 500, marginBottom: 2 }}>📅 指定日時に予約投稿する</p>
                  <p style={{ fontSize: 9, color: C.textMuted, lineHeight: 1.5 }}>
                    予約時刻になったら自動で公開・駅ちか送信・通知が走ります
                  </p>
                </div>
              </label>
              {scheduledEnabled && (
                <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <div>
                    <p style={{ fontSize: 9, color: C.textSub, marginBottom: 4, fontFamily: FONT_DISPLAY, letterSpacing: "0.1em" }}>日付</p>
                    <input
                      type="date"
                      value={scheduledDate}
                      onChange={(e) => setScheduledDate(e.target.value)}
                      min={new Date().toISOString().split("T")[0]}
                      style={{
                        width: "100%",
                        padding: "8px 10px",
                        fontSize: 12,
                        border: `1px solid ${C.border}`,
                        backgroundColor: C.bg,
                        color: C.text,
                        fontFamily: FONT_SERIF,
                        outline: "none",
                      }}
                    />
                  </div>
                  <div>
                    <p style={{ fontSize: 9, color: C.textSub, marginBottom: 4, fontFamily: FONT_DISPLAY, letterSpacing: "0.1em" }}>時刻 (15分単位推奨)</p>
                    <input
                      type="time"
                      value={scheduledTime}
                      onChange={(e) => setScheduledTime(e.target.value)}
                      step={900}
                      style={{
                        width: "100%",
                        padding: "8px 10px",
                        fontSize: 12,
                        border: `1px solid ${C.border}`,
                        backgroundColor: C.bg,
                        color: C.text,
                        fontFamily: FONT_SERIF,
                        outline: "none",
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* AIチェック結果 */}
            {aiCheckResult && (
              <div
                style={{
                  padding: 12,
                  marginBottom: 14,
                  border: `1px solid ${aiCheckResult.severity === "ng" ? "#c45555" : aiCheckResult.severity === "warn" ? "#b38419" : "#6b9b7e"}`,
                  backgroundColor: aiCheckResult.severity === "ng" ? "#fef2f2" : aiCheckResult.severity === "warn" ? "#fef7d4" : "#f0f7f1",
                  fontFamily: FONT_SERIF,
                }}
              >
                <p
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    marginBottom: 8,
                    color: aiCheckResult.severity === "ng" ? "#7a2929" : aiCheckResult.severity === "warn" ? "#7a5a0e" : "#3d6149",
                  }}
                >
                  {aiCheckResult.severity === "ng"
                    ? "🚨 投稿前に修正が必要です"
                    : aiCheckResult.severity === "warn"
                    ? "⚠️ 注意点があります"
                    : "✅ チェック完了"}
                </p>

                {/* 個別の指摘 */}
                {aiCheckResult.issues.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
                    {aiCheckResult.issues.map((issue, i) => (
                      <div
                        key={i}
                        style={{
                          padding: 8,
                          backgroundColor: "rgba(255,255,255,0.7)",
                          border: `1px solid ${C.border}`,
                        }}
                      >
                        <div style={{ display: "flex", gap: 6, marginBottom: 4, flexWrap: "wrap" }}>
                          <span
                            style={{
                              fontSize: 9,
                              padding: "2px 6px",
                              backgroundColor: issue.type === "個人情報" || issue.type === "NGワード" ? "#c45555" : issue.type === "改善提案" ? "#6b8ba8" : "#b38419",
                              color: "#fff",
                              fontFamily: FONT_DISPLAY,
                              letterSpacing: "0.05em",
                            }}
                          >
                            {issue.type}
                          </span>
                          <span style={{ fontSize: 9, color: C.textMuted }}>{issue.location}</span>
                        </div>
                        {issue.original && (
                          <p style={{ fontSize: 11, color: C.text, marginBottom: 4 }}>
                            「<span style={{ backgroundColor: "#fef2f2", padding: "0 4px" }}>{issue.original}</span>」
                          </p>
                        )}
                        <p style={{ fontSize: 10, color: C.textSub, lineHeight: 1.6, marginBottom: 4 }}>
                          {issue.reason}
                        </p>
                        <p style={{ fontSize: 11, color: C.text, lineHeight: 1.6 }}>
                          💡 <span style={{ color: C.accent, fontWeight: 500 }}>{issue.suggestion}</span>
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {/* 全体アドバイス */}
                {aiCheckResult.advice && (
                  <p style={{ fontSize: 11, color: C.text, marginBottom: 10, lineHeight: 1.6, padding: "8px 10px", backgroundColor: "rgba(255,255,255,0.5)" }}>
                    {aiCheckResult.advice}
                  </p>
                )}

                {/* 改善版採用ボタン */}
                {(aiCheckResult.improvedTitle || aiCheckResult.improvedBody) && (
                  <button
                    onClick={applyAISuggestion}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      fontSize: 12,
                      cursor: "pointer",
                      backgroundColor: C.accent,
                      color: "#fff",
                      border: "none",
                      fontFamily: FONT_SERIF,
                      letterSpacing: "0.1em",
                      fontWeight: 500,
                    }}
                  >
                    ✨ AI提案の改善版を採用する
                  </button>
                )}
              </div>
            )}

            {/* AIチェックボタン */}
            <button
              onClick={handleAICheck}
              disabled={aiChecking || !title.trim() || !body.trim()}
              style={{
                width: "100%",
                padding: "12px",
                fontSize: 12,
                cursor: aiChecking || !title.trim() || !body.trim() ? "not-allowed" : "pointer",
                backgroundColor: "transparent",
                color: C.accent,
                border: `1px solid ${C.accent}`,
                fontFamily: FONT_SERIF,
                letterSpacing: "0.1em",
                marginBottom: 8,
                opacity: aiChecking || !title.trim() || !body.trim() ? 0.5 : 1,
              }}
            >
              {aiChecking ? "AIチェック中..." : "🤖 投稿前にAIチェック"}
            </button>

            {/* 投稿ボタン */}
            <button
              onClick={handleSubmit}
              disabled={submitting || images.length === 0 || !title.trim() || !body.trim() || (aiCheckResult?.severity === "ng")}
              style={{
                width: "100%",
                padding: "16px 12px",
                fontSize: 13,
                cursor: submitting || images.length === 0 || !title.trim() || !body.trim() || aiCheckResult?.severity === "ng" ? "not-allowed" : "pointer",
                backgroundColor: aiCheckResult?.severity === "ng" ? C.textMuted : C.accent,
                color: "#fff",
                border: "none",
                fontFamily: FONT_SERIF,
                letterSpacing: "0.1em",
                fontWeight: 500,
                opacity: submitting || images.length === 0 || !title.trim() || !body.trim() || aiCheckResult?.severity === "ng" ? 0.5 : 1,
              }}
            >
              {submitting
                ? (scheduledEnabled ? "予約中..." : "投稿中...")
                : aiCheckResult?.severity === "ng"
                ? "🚨 NG項目を修正してください"
                : scheduledEnabled && scheduledDate && scheduledTime
                ? "📅 予約投稿する"
                : "📤 投稿する"}
            </button>
          </div>
        </div>
      )}

      {/* AIサジェストモーダル */}
      {suggestModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.55)",
            zIndex: 9999,
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "center",
            overflow: "auto",
          }}
          onClick={(e) => { if (e.target === e.currentTarget) { setSuggestModalOpen(false); setAiSuggestions([]); } }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 540,
              minHeight: "100vh",
              backgroundColor: C.bg,
              padding: "16px 14px 80px",
              fontFamily: FONT_SERIF,
            }}
          >
            {/* ヘッダ */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, paddingBottom: 10, borderBottom: `1px solid ${C.border}` }}>
              <button
                onClick={() => { setSuggestModalOpen(false); setAiSuggestions([]); }}
                style={{ padding: "6px 10px", fontSize: 11, cursor: "pointer", backgroundColor: "transparent", border: "none", color: C.textSub, fontFamily: FONT_SERIF }}
              >
                ← 戻る
              </button>
              <p style={{ fontSize: 13, fontWeight: 500, color: C.text, letterSpacing: "0.08em" }}>💡 AIサジェスト</p>
              <div style={{ width: 50 }} />
            </div>

            {/* ヒント入力 */}
            <div style={{ marginBottom: 14 }}>
              <p style={{ fontSize: 10, letterSpacing: "0.15em", color: C.textSub, marginBottom: 6, fontFamily: FONT_DISPLAY }}>
                HINT · ヒント (任意)
              </p>
              <textarea
                value={suggestHint}
                onChange={(e) => setSuggestHint(e.target.value)}
                placeholder={`例:\n・今日は出勤予定\n・髪を切りました\n・常連様にお花いただいた\n・最近お気に入りのカフェの話 など`}
                rows={3}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  fontSize: 12,
                  border: `1px solid ${C.border}`,
                  backgroundColor: C.card,
                  color: C.text,
                  fontFamily: FONT_SERIF,
                  outline: "none",
                  resize: "vertical",
                  lineHeight: 1.6,
                }}
              />
              <p style={{ fontSize: 9, color: C.textMuted, marginTop: 4, lineHeight: 1.5 }}>
                書きたいキーワードや出来事を入れると、より的確に提案できます
              </p>
            </div>

            {/* 既に書いてある内容の表示 */}
            {(title.trim() || body.trim() || selectedTags.length > 0) && (
              <div style={{ marginBottom: 14, padding: 10, backgroundColor: C.cardAlt, border: `1px solid ${C.border}` }}>
                <p style={{ fontSize: 10, color: C.textSub, marginBottom: 4, fontFamily: FONT_DISPLAY, letterSpacing: "0.1em" }}>
                  すでに入力済みの内容も参考にします
                </p>
                {title.trim() && <p style={{ fontSize: 11, color: C.text, marginTop: 4 }}>📝 {title.slice(0, 40)}{title.length > 40 ? "..." : ""}</p>}
                {body.trim() && <p style={{ fontSize: 10, color: C.textSub, marginTop: 4 }}>📄 {body.slice(0, 60)}{body.length > 60 ? "..." : ""}</p>}
                {selectedTags.length > 0 && <p style={{ fontSize: 10, color: C.textMuted, marginTop: 4 }}>🏷 {selectedTags.join(", ")}</p>}
              </div>
            )}

            {/* リクエストボタン */}
            <button
              onClick={requestAISuggest}
              disabled={aiSuggesting}
              style={{
                width: "100%",
                padding: "12px",
                fontSize: 13,
                cursor: aiSuggesting ? "wait" : "pointer",
                backgroundColor: C.accent,
                color: "#fff",
                border: "none",
                fontFamily: FONT_SERIF,
                letterSpacing: "0.1em",
                fontWeight: 500,
                marginBottom: 14,
                opacity: aiSuggesting ? 0.5 : 1,
              }}
            >
              {aiSuggesting ? "✨ AI考え中..." : "✨ 3パターン提案してもらう"}
            </button>

            {/* エラー表示 */}
            {suggestErrorMsg && (
              <div style={{ padding: 10, backgroundColor: "#fef2f2", border: `1px solid #c45555`, fontSize: 11, color: "#7a2929", marginBottom: 14, fontFamily: FONT_SERIF }}>
                {suggestErrorMsg}
              </div>
            )}

            {/* 提案リスト */}
            {aiSuggestions.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {aiSuggestions.map((s, i) => {
                  const toneEmoji = s.tone === "cheerful" ? "✨" : s.tone === "elegant" ? "🌸" : s.tone === "sweet" ? "💗" : "📝";
                  const toneLabel = s.tone === "cheerful" ? "元気系" : s.tone === "elegant" ? "上品系" : s.tone === "sweet" ? "甘え系" : s.tone;
                  return (
                    <div key={i} style={{ padding: 14, backgroundColor: C.card, border: `1px solid ${C.border}` }}>
                      <p style={{ fontSize: 10, color: C.accent, fontFamily: FONT_DISPLAY, letterSpacing: "0.15em", marginBottom: 8, fontWeight: 500 }}>
                        {toneEmoji} {toneLabel}
                      </p>
                      <p style={{ fontSize: 13, color: C.text, fontWeight: 500, marginBottom: 6, lineHeight: 1.6 }}>
                        {s.title}
                      </p>
                      <p style={{ fontSize: 11, color: C.textSub, marginBottom: 8, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
                        {s.body}
                      </p>
                      {s.tags.length > 0 && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 10 }}>
                          {s.tags.map((tag, j) => (
                            <span key={j} style={{ fontSize: 9, padding: "2px 6px", backgroundColor: C.accentBg, color: C.accentDeep, fontFamily: FONT_SERIF }}>
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}
                      <button
                        onClick={() => applySuggestion(s)}
                        style={{
                          width: "100%",
                          padding: "8px",
                          fontSize: 11,
                          cursor: "pointer",
                          backgroundColor: C.accent,
                          color: "#fff",
                          border: "none",
                          fontFamily: FONT_SERIF,
                          letterSpacing: "0.1em",
                          fontWeight: 500,
                        }}
                      >
                        この案を採用する →
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
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
