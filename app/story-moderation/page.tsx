"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useStaffSession } from "../../lib/staff-session";
import { useTheme } from "../../lib/theme";
import { useToast } from "../../lib/toast";

/**
 * ライブストーリー監視画面
 *
 * 機能:
 *   - 公開中の全ストーリーをグリッド表示
 *   - 通報優先・新着順
 *   - サムネクリックで原寸プレビュー
 *   - 即時削除
 *   - 自動更新 (30秒ごと)
 *   - 統計サマリ
 *
 * 権限: isManager (owner/manager/leader)
 */

type FilterType = "active" | "reported" | "expired" | "deleted" | "all";

type Story = {
  id: number;
  therapist: { id: number; name: string; status: string };
  mediaType: "image" | "video";
  mediaUrl: string | null;
  thumbnailUrl: string | null;
  caption: string | null;
  visibility: string;
  status: string;
  viewCount: number;
  uniqueViewerCount: number;
  reactionCount: number;
  isReported: boolean;
  reportCount: number;
  publishedAt: string;
  expiresAt: string;
  expiresInMs: number;
  deletedAt: string | null;
  deleteReason: string | null;
  storageDeletedAt: string | null;
};

type Stats = {
  activeCount: number;
  reportedCount: number;
  todayPostsCount: number;
};

const FILTER_LABELS: { key: FilterType; label: string; icon: string }[] = [
  { key: "active",    label: "公開中",    icon: "🟢" },
  { key: "reported",  label: "通報あり",  icon: "🚨" },
  { key: "expired",   label: "期限切れ",  icon: "⏰" },
  { key: "deleted",   label: "削除済み",  icon: "🗑" },
  { key: "all",       label: "全て",      icon: "📊" },
];

export default function StoryModerationPage() {
  const { activeStaff, isManager, isRestored } = useStaffSession();
  const { dark, toggle, T } = useTheme();
  const { show: pushToast } = useToast();

  const [stories, setStories] = useState<Story[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>("active");
  const [searchQ, setSearchQ] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastFetchTime, setLastFetchTime] = useState<Date | null>(null);

  // モーダル
  const [previewStory, setPreviewStory] = useState<Story | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Story | null>(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [deleteReasonChoice, setDeleteReasonChoice] = useState("不適切な内容");
  const [deleting, setDeleting] = useState(false);

  const refreshTimer = useRef<NodeJS.Timeout | null>(null);

  const DELETE_REASONS = ["不適切な内容", "通報対応", "セラピスト退職", "本人都合", "その他"];

  // ════════════════════════════════════════════════════════
  // データ取得
  // ════════════════════════════════════════════════════════
  const fetchStories = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("filter", filter);
      params.set("limit", "100");
      if (searchQ.trim()) params.set("q", searchQ.trim());

      const res = await fetch(`/api/diary/story/admin-list?${params.toString()}`);
      const data = await res.json();
      if (res.ok) {
        setStories(data.stories || []);
        setStats(data.stats || null);
        setLastFetchTime(new Date());
      } else {
        pushToast(data.error || "取得失敗", "error");
      }
    } catch {
      pushToast("通信エラー", "error");
    } finally {
      setLoading(false);
    }
  }, [filter, searchQ, pushToast]);

  useEffect(() => {
    if (isRestored && isManager) {
      fetchStories();
    }
  }, [fetchStories, isRestored, isManager]);

  // 自動更新 (30秒ごと)
  useEffect(() => {
    if (refreshTimer.current) {
      clearInterval(refreshTimer.current);
      refreshTimer.current = null;
    }
    if (autoRefresh && isRestored && isManager) {
      refreshTimer.current = setInterval(() => {
        fetchStories();
      }, 30 * 1000);
    }
    return () => {
      if (refreshTimer.current) clearInterval(refreshTimer.current);
    };
  }, [autoRefresh, fetchStories, isRestored, isManager]);

  // 1分おきに残り時間表示更新 (state ダミー再描画)
  useEffect(() => {
    const t = setInterval(() => {
      setStories((prev) => [...prev]);
    }, 60 * 1000);
    return () => clearInterval(t);
  }, []);

  const submitSearch = () => {
    setSearchQ(searchInput.trim());
  };

  // ════════════════════════════════════════════════════════
  // 削除
  // ════════════════════════════════════════════════════════
  const submitDelete = async () => {
    if (!deleteTarget || !activeStaff) return;
    setDeleting(true);
    try {
      const reason = deleteReasonChoice === "その他" ? deleteReason : deleteReasonChoice;
      const res = await fetch("/api/diary/story/my", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storyId: deleteTarget.id, staffId: activeStaff.id, deleteReason: reason }),
      });
      const data = await res.json();
      if (res.ok) {
        pushToast("削除しました", "success");
        setDeleteTarget(null);
        setDeleteReason("");
        setDeleteReasonChoice("不適切な内容");
        await fetchStories();
      } else {
        pushToast(data.error || "削除失敗", "error");
      }
    } catch {
      pushToast("通信エラー", "error");
    } finally {
      setDeleting(false);
    }
  };

  // ════════════════════════════════════════════════════════
  // ヘルパー
  // ════════════════════════════════════════════════════════
  const fmtDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  const fmtRemaining = (ms: number) => {
    if (ms <= 0) return "終了";
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    if (hours > 0) return `あと${hours}時間${minutes}分`;
    return `あと${minutes}分`;
  };

  // ════════════════════════════════════════════════════════
  // 権限チェック
  // ════════════════════════════════════════════════════════
  if (!isRestored) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: T.textMuted, backgroundColor: T.bg, minHeight: "100vh" }}>
        読み込み中...
      </div>
    );
  }

  if (!activeStaff || !isManager) {
    return (
      <div style={{ padding: 40, textAlign: "center", backgroundColor: T.bg, minHeight: "100vh", color: T.text }}>
        <p style={{ fontSize: 14, marginBottom: 16 }}>このページにアクセスする権限がありません</p>
        <Link href="/dashboard" style={{ fontSize: 12, color: T.accent, textDecoration: "none" }}>
          ← HOMEに戻る
        </Link>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════
  // レンダリング
  // ════════════════════════════════════════════════════════
  return (
    <div style={{ minHeight: "100vh", backgroundColor: T.bg, color: T.text, padding: 16 }}>
      {/* ヘッダ */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 500, marginBottom: 4 }}>📡 ライブストーリー監視</h1>
          <p style={{ fontSize: 11, color: T.textMuted }}>
            公開中の全ストーリーを監視・即時削除できます
            {lastFetchTime && (
              <span style={{ marginLeft: 8 }}>
                ・最終更新 {String(lastFetchTime.getHours()).padStart(2, "0")}:{String(lastFetchTime.getMinutes()).padStart(2, "0")}:{String(lastFetchTime.getSeconds()).padStart(2, "0")}
              </span>
            )}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: T.textSub, cursor: "pointer" }}>
            <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} />
            自動更新 (30秒)
          </label>
          <button onClick={fetchStories} style={{ padding: "6px 10px", fontSize: 11, cursor: "pointer", backgroundColor: "transparent", border: `1px solid ${T.border}`, color: T.textSub }}>
            🔄 更新
          </button>
          <button onClick={toggle} style={{ padding: "6px 10px", fontSize: 11, cursor: "pointer", backgroundColor: "transparent", border: `1px solid ${T.border}`, color: T.textSub }}>
            {dark ? "☀️" : "🌙"}
          </button>
          <Link href="/diary-moderation" style={{ padding: "6px 10px", fontSize: 11, backgroundColor: "transparent", border: `1px solid ${T.border}`, color: T.textSub, textDecoration: "none" }}>
            📸 写メ日記管理
          </Link>
          <Link href="/dashboard" style={{ padding: "6px 10px", fontSize: 11, backgroundColor: "transparent", border: `1px solid ${T.border}`, color: T.textSub, textDecoration: "none" }}>
            ← HOME
          </Link>
        </div>
      </div>

      {/* 統計サマリ */}
      {stats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 0, border: `1px solid ${T.border}`, backgroundColor: T.card, marginBottom: 16 }}>
          <div style={{ padding: 14, textAlign: "center", borderRight: `1px solid ${T.border}` }}>
            <p style={{ fontSize: 9, letterSpacing: "0.15em", color: T.textMuted, marginBottom: 4 }}>🟢 公開中</p>
            <p style={{ fontSize: 22, fontWeight: 500, color: "#6b9b7e", fontVariantNumeric: "tabular-nums" }}>{stats.activeCount}</p>
          </div>
          <div style={{ padding: 14, textAlign: "center", borderRight: `1px solid ${T.border}` }}>
            <p style={{ fontSize: 9, letterSpacing: "0.15em", color: T.textMuted, marginBottom: 4 }}>🚨 通報あり</p>
            <p style={{ fontSize: 22, fontWeight: 500, color: stats.reportedCount > 0 ? "#c45555" : T.text, fontVariantNumeric: "tabular-nums" }}>{stats.reportedCount}</p>
          </div>
          <div style={{ padding: 14, textAlign: "center" }}>
            <p style={{ fontSize: 9, letterSpacing: "0.15em", color: T.textMuted, marginBottom: 4 }}>📅 今日の投稿</p>
            <p style={{ fontSize: 22, fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>{stats.todayPostsCount}</p>
          </div>
        </div>
      )}

      {/* フィルタ */}
      <div style={{ marginBottom: 16, padding: 12, backgroundColor: T.card, border: `1px solid ${T.border}` }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
          {FILTER_LABELS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              style={{
                padding: "5px 10px",
                fontSize: 11,
                cursor: "pointer",
                backgroundColor: filter === f.key ? T.accent : "transparent",
                color: filter === f.key ? "#fff" : T.textSub,
                border: `1px solid ${filter === f.key ? T.accent : T.border}`,
              }}
            >
              {f.icon} {f.label}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") submitSearch(); }}
            placeholder="🔍 キャプションで検索"
            style={{ flex: 1, padding: "6px 10px", fontSize: 11, border: `1px solid ${T.border}`, backgroundColor: T.bg, color: T.text, outline: "none" }}
          />
          <button onClick={submitSearch} style={{ padding: "6px 14px", fontSize: 11, cursor: "pointer", backgroundColor: T.accent, color: "#fff", border: "none" }}>
            検索
          </button>
        </div>
      </div>

      {/* グリッド */}
      {loading && stories.length === 0 ? (
        <p style={{ textAlign: "center", padding: 40, color: T.textMuted }}>読み込み中...</p>
      ) : stories.length === 0 ? (
        <div style={{ padding: 40, textAlign: "center", backgroundColor: T.card, border: `1px solid ${T.border}` }}>
          <p style={{ fontSize: 28, marginBottom: 8 }}>📭</p>
          <p style={{ fontSize: 12, color: T.textSub }}>該当するストーリーがありません</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10 }}>
          {stories.map((story) => (
            <div
              key={story.id}
              style={{
                backgroundColor: story.deletedAt ? T.cardAlt : T.card,
                border: `1px solid ${story.isReported ? "#c45555" : story.deletedAt ? T.textMuted : T.border}`,
                opacity: story.deletedAt ? 0.6 : 1,
                display: "flex",
                flexDirection: "column",
              }}
            >
              {/* メディア */}
              <div
                onClick={() => !story.storageDeletedAt && setPreviewStory(story)}
                style={{
                  width: "100%",
                  aspectRatio: "9/16",
                  backgroundColor: T.cardAlt,
                  backgroundImage: !story.storageDeletedAt && story.thumbnailUrl
                    ? `url(${story.thumbnailUrl})`
                    : !story.storageDeletedAt && story.mediaType === "image" && story.mediaUrl
                    ? `url(${story.mediaUrl})`
                    : undefined,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  position: "relative",
                  cursor: !story.storageDeletedAt ? "pointer" : "default",
                }}
              >
                {/* オーバーレイバッジ */}
                {story.isReported && (
                  <span style={{ position: "absolute", top: 4, left: 4, fontSize: 9, padding: "2px 5px", backgroundColor: "#c45555", color: "#fff" }}>
                    🚨{story.reportCount}
                  </span>
                )}
                {story.mediaType === "video" && (
                  <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", color: "#fff", fontSize: 24, textShadow: "0 1px 4px rgba(0,0,0,0.6)" }}>
                    ▶
                  </div>
                )}
                {story.visibility === "members_only" && (
                  <span style={{ position: "absolute", top: 4, right: 4, fontSize: 9, padding: "2px 5px", backgroundColor: T.accent, color: "#fff" }}>
                    限定
                  </span>
                )}
                {story.deletedAt && (
                  <div style={{ position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 11, fontWeight: 500 }}>
                    削除済
                  </div>
                )}
                {story.storageDeletedAt && (
                  <div style={{ position: "absolute", inset: 0, backgroundColor: T.cardAlt, display: "flex", alignItems: "center", justifyContent: "center", color: T.textMuted, fontSize: 10 }}>
                    メディア削除済
                  </div>
                )}
              </div>

              {/* メタ */}
              <div style={{ padding: "6px 8px 8px", display: "flex", flexDirection: "column", gap: 3, flex: 1 }}>
                <p style={{ fontSize: 10, color: T.text, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {story.therapist.name}
                </p>
                {story.caption && (
                  <p style={{ fontSize: 9, color: T.textSub, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", lineHeight: 1.4 }}>
                    {story.caption}
                  </p>
                )}
                <div style={{ display: "flex", gap: 6, fontSize: 9, color: T.textMuted, fontVariantNumeric: "tabular-nums" }}>
                  <span>👀{story.uniqueViewerCount}</span>
                  {story.expiresInMs > 0 ? (
                    <span style={{ color: story.expiresInMs < 3600000 ? "#c45555" : T.textMuted }}>
                      {fmtRemaining(story.expiresInMs)}
                    </span>
                  ) : (
                    <span style={{ color: T.textMuted }}>期限切れ</span>
                  )}
                </div>
                <p style={{ fontSize: 8, color: T.textFaint, marginTop: 2 }}>
                  {fmtDate(story.publishedAt)}
                </p>
                {!story.deletedAt && (
                  <button
                    onClick={() => setDeleteTarget(story)}
                    style={{
                      marginTop: 4,
                      padding: "3px 0",
                      fontSize: 9,
                      cursor: "pointer",
                      backgroundColor: "transparent",
                      border: `1px solid #c45555`,
                      color: "#c45555",
                      fontWeight: 500,
                    }}
                  >
                    🗑 即時削除
                  </button>
                )}
                {story.deleteReason && (
                  <p style={{ fontSize: 8, color: T.textMuted, fontStyle: "italic" }}>
                    {story.deleteReason}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* プレビューモーダル */}
      {previewStory && (
        <div
          style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.85)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onClick={(e) => { if (e.target === e.currentTarget) setPreviewStory(null); }}
        >
          <div style={{ position: "relative", maxWidth: 480, maxHeight: "90vh", display: "flex", flexDirection: "column" }}>
            <button
              onClick={() => setPreviewStory(null)}
              style={{ position: "absolute", top: -36, right: 0, padding: "6px 14px", fontSize: 12, cursor: "pointer", backgroundColor: "transparent", color: "#fff", border: "1px solid rgba(255,255,255,0.4)" }}
            >
              ✕ 閉じる
            </button>
            {previewStory.mediaType === "image" && previewStory.mediaUrl ? (
              <img src={previewStory.mediaUrl} alt="" style={{ maxWidth: "100%", maxHeight: "80vh", objectFit: "contain" }} />
            ) : previewStory.mediaType === "video" && previewStory.mediaUrl ? (
              <video src={previewStory.mediaUrl} controls autoPlay style={{ maxWidth: "100%", maxHeight: "80vh" }} />
            ) : null}
            {previewStory.caption && (
              <div style={{ padding: 12, backgroundColor: "rgba(0,0,0,0.7)", color: "#fff", fontSize: 13 }}>
                {previewStory.caption}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 削除モーダル */}
      {deleteTarget && (
        <div
          style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
          onClick={(e) => { if (e.target === e.currentTarget) setDeleteTarget(null); }}
        >
          <div style={{ width: "100%", maxWidth: 400, backgroundColor: T.card, padding: 20, color: T.text }}>
            <p style={{ fontSize: 14, fontWeight: 500, marginBottom: 8, textAlign: "center" }}>🗑 ストーリーを即時削除</p>
            <p style={{ fontSize: 11, color: T.textMuted, marginBottom: 12, textAlign: "center", lineHeight: 1.6 }}>
              「{deleteTarget.therapist.name}」のストーリー<br />
              即時削除します (元に戻せません)
            </p>
            <p style={{ fontSize: 10, color: T.textSub, marginBottom: 4 }}>削除理由</p>
            <select
              value={deleteReasonChoice}
              onChange={(e) => setDeleteReasonChoice(e.target.value)}
              style={{ width: "100%", padding: "8px 10px", fontSize: 11, border: `1px solid ${T.border}`, backgroundColor: T.bg, color: T.text, marginBottom: 8, outline: "none" }}
            >
              {DELETE_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            {deleteReasonChoice === "その他" && (
              <input
                type="text"
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                placeholder="理由を入力"
                style={{ width: "100%", padding: "8px 10px", fontSize: 11, border: `1px solid ${T.border}`, backgroundColor: T.bg, color: T.text, marginBottom: 12, outline: "none" }}
              />
            )}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <button onClick={() => setDeleteTarget(null)} style={{ padding: 10, fontSize: 12, cursor: "pointer", backgroundColor: "transparent", border: `1px solid ${T.border}`, color: T.textSub }}>
                キャンセル
              </button>
              <button onClick={submitDelete} disabled={deleting} style={{ padding: 10, fontSize: 12, cursor: deleting ? "not-allowed" : "pointer", backgroundColor: "#c45555", color: "#fff", border: "none", opacity: deleting ? 0.5 : 1 }}>
                {deleting ? "削除中..." : "即時削除"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
