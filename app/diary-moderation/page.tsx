"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useStaffSession } from "../../lib/staff-session";
import { useTheme } from "../../lib/theme";
import { useToast } from "../../lib/toast";
import { compareByReading } from "../../lib/sort-utils";

/**
 * 写メ日記モデレーション管理画面
 *
 * 機能:
 *   - 全セラピストの投稿一覧 (フィルタ: 公開/限定/削除済み/駅ちか失敗)
 *   - 投稿の詳細表示
 *   - スタッフによる編集・削除
 *   - 駅ちか送信失敗の手動リトライ (個別/一括)
 *   - 統計サマリ (今月の投稿数・送信成功率)
 *
 * 権限: isManager (owner/manager/leader)
 */

type FilterType = "all" | "active" | "deleted" | "public" | "members_only" | "ekichika_failed" | "ekichika_pending";

type Entry = {
  id: number;
  therapist: { id: number; name: string; status: string };
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
  editedAt: string | null;
  editedByStaffId: number | null;
  deletedAt: string | null;
  deletedByStaffId: number | null;
  deleteReason: string | null;
};

type Stats = {
  thisMonthTotal: number;
  thisMonthPublic: number;
  thisMonthMembers: number;
  thisMonthEkichikaFailed: number;
  thisMonthEkichikaSent: number;
};

type Therapist = { id: number; name: string };

const FILTER_LABELS: { key: FilterType; label: string; icon: string }[] = [
  { key: "active",          label: "公開中",        icon: "📋" },
  { key: "public",          label: "全公開",        icon: "🌐" },
  { key: "members_only",    label: "会員限定",      icon: "🔒" },
  { key: "ekichika_failed", label: "駅ちか失敗",    icon: "❌" },
  { key: "ekichika_pending",label: "駅ちか送信中",  icon: "⏳" },
  { key: "deleted",         label: "削除済み",      icon: "🗑" },
  { key: "all",             label: "全て",          icon: "📊" },
];

export default function DiaryModerationPage() {
  const { activeStaff, isManager, isRestored } = useStaffSession();
  const { dark, toggle, T } = useTheme();
  const { show: pushToast } = useToast();

  const [entries, setEntries] = useState<Entry[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>("active");
  const [searchQ, setSearchQ] = useState("");
  const [selectedTherapistId, setSelectedTherapistId] = useState<string>("");
  const [therapists, setTherapists] = useState<Therapist[]>([]);

  // 詳細モーダル
  const [detailEntry, setDetailEntry] = useState<Entry | null>(null);
  const [detailImages, setDetailImages] = useState<{ id: number; imageUrl: string; thumbnailUrl: string | null; sortOrder: number }[]>([]);

  // 編集モーダル
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [editVisibility, setEditVisibility] = useState<"public" | "members_only">("public");
  const [editing, setEditing] = useState(false);

  // 削除モーダル
  const [deleteTarget, setDeleteTarget] = useState<Entry | null>(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [deleteReasonChoice, setDeleteReasonChoice] = useState("不適切な内容");
  const [deleting, setDeleting] = useState(false);

  // 一括リトライ
  const [retrying, setRetrying] = useState(false);

  const DELETE_REASONS = ["不適切な内容", "セラピスト退職", "重複投稿", "写真の問題", "本人都合", "その他"];

  // ════════════════════════════════════════════════════════
  // データ取得
  // ════════════════════════════════════════════════════════
  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("filter", filter);
      params.set("limit", "100");
      if (searchQ.trim()) params.set("q", searchQ.trim());
      if (selectedTherapistId) params.set("therapistId", selectedTherapistId);

      const res = await fetch(`/api/diary/admin-list?${params.toString()}`);
      const data = await res.json();
      if (res.ok) {
        setEntries(data.entries || []);
        setStats(data.stats || null);
      } else {
        pushToast(data.error || "取得に失敗しました", "error");
      }
    } catch {
      pushToast("通信エラー", "error");
    } finally {
      setLoading(false);
    }
  }, [filter, searchQ, selectedTherapistId, pushToast]);

  const fetchTherapists = useCallback(async () => {
    try {
      const res = await fetch("/api/diary/admin-list?limit=1");
      const data = await res.json();
      if (res.ok && data.entries) {
        // 簡易: entriesから therapist 一覧を抽出 (本来は専用APIがほしいが、Phase 1ではこれで)
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    if (isRestored && isManager) {
      fetchEntries();
    }
  }, [fetchEntries, isRestored, isManager]);

  // セラピストリスト (filter dropdown用)
  // entries から therapist を抽出するヘルパー
  const therapistOptions = useMemo(() => {
    const map = new Map<number, string>();
    for (const e of entries) {
      if (!map.has(e.therapist.id)) map.set(e.therapist.id, e.therapist.name);
    }
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => compareByReading(a.name, b.name));
  }, [entries]);

  // ════════════════════════════════════════════════════════
  // 詳細表示
  // ════════════════════════════════════════════════════════
  const openDetail = async (entry: Entry) => {
    setDetailEntry(entry);
    setDetailImages([]);
    try {
      const res = await fetch(`/api/diary/${entry.id}?skipView=1`);
      const data = await res.json();
      if (res.ok && data.images) {
        setDetailImages(data.images);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // ════════════════════════════════════════════════════════
  // 編集
  // ════════════════════════════════════════════════════════
  const openEdit = (entry: Entry) => {
    setEditingEntry(entry);
    setEditTitle(entry.title);
    // bodyPreview は省略形なので、本物を取り直す必要がある
    fetch(`/api/diary/${entry.id}?skipView=1`)
      .then(r => r.json())
      .then(d => {
        if (d.entry) setEditBody(d.entry.body);
      });
    setEditVisibility(entry.visibility);
  };

  const submitEdit = async () => {
    if (!editingEntry || !activeStaff) return;
    setEditing(true);
    try {
      const res = await fetch(`/api/diary/${editingEntry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          staffId: activeStaff.id,
          title: editTitle,
          body: editBody,
          visibility: editVisibility,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        pushToast("編集しました", "success");
        setEditingEntry(null);
        await fetchEntries();
      } else {
        pushToast(data.error || "編集失敗", "error");
      }
    } catch {
      pushToast("通信エラー", "error");
    } finally {
      setEditing(false);
    }
  };

  // ════════════════════════════════════════════════════════
  // 削除
  // ════════════════════════════════════════════════════════
  const submitDelete = async () => {
    if (!deleteTarget || !activeStaff) return;
    setDeleting(true);
    try {
      const reason = deleteReasonChoice === "その他" ? deleteReason : deleteReasonChoice;
      const res = await fetch(`/api/diary/${deleteTarget.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staffId: activeStaff.id, deleteReason: reason }),
      });
      const data = await res.json();
      if (res.ok) {
        pushToast("削除しました", "success");
        setDeleteTarget(null);
        setDeleteReason("");
        setDeleteReasonChoice("不適切な内容");
        await fetchEntries();
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
  // 駅ちか送信再試行
  // ════════════════════════════════════════════════════════
  const retrySingle = async (entry: Entry) => {
    if (!activeStaff) return;
    try {
      pushToast(`「${entry.title}」を再送信中...`, "info");
      const res = await fetch("/api/diary/retry-dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryId: entry.id, staffId: activeStaff.id }),
      });
      const data = await res.json();
      if (res.ok) {
        if (data.succeeded > 0) {
          pushToast("再送信に成功しました", "success");
        } else {
          pushToast(`再送信失敗: ${data.results?.[0]?.error || "不明"}`, "error");
        }
        await fetchEntries();
      } else {
        pushToast(data.error || "再送信失敗", "error");
      }
    } catch {
      pushToast("通信エラー", "error");
    }
  };

  const retryAllFailed = async () => {
    if (!activeStaff) return;
    if (!confirm("駅ちか送信に失敗した全投稿を再送信しますか?")) return;
    setRetrying(true);
    try {
      const res = await fetch("/api/diary/retry-dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ retryAllFailed: true, staffId: activeStaff.id }),
      });
      const data = await res.json();
      if (res.ok) {
        pushToast(`${data.processed}件処理: 成功${data.succeeded} / 失敗${data.failed}`, "success");
        await fetchEntries();
      } else {
        pushToast(data.error || "失敗", "error");
      }
    } catch {
      pushToast("通信エラー", "error");
    } finally {
      setRetrying(false);
    }
  };

  // ════════════════════════════════════════════════════════
  // ヘルパー
  // ════════════════════════════════════════════════════════
  const fmtDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  const dispatchLabel = (status: string | null, dispatchedAt: string | null) => {
    if (!status) return "";
    if (status === "sent") return `✅ 送信済 ${dispatchedAt ? fmtDate(dispatchedAt) : ""}`;
    if (status === "pending") return "⏳ 送信中";
    if (status === "failed") return "❌ 送信失敗";
    if (status === "skipped") return "— 送信なし";
    return status;
  };

  const dispatchColor = (status: string | null) => {
    if (status === "sent") return "#6b9b7e";
    if (status === "failed") return "#c45555";
    if (status === "pending") return "#b38419";
    return T.textMuted;
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
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 500, color: T.text, marginBottom: 4 }}>📸 写メ日記モデレーション</h1>
          <p style={{ fontSize: 11, color: T.textMuted }}>セラピストの投稿を一覧・編集・削除できます</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={toggle} style={{ padding: "6px 10px", fontSize: 11, cursor: "pointer", backgroundColor: "transparent", border: `1px solid ${T.border}`, color: T.textSub }}>
            {dark ? "☀️" : "🌙"}
          </button>
          <Link href="/dashboard" style={{ padding: "6px 10px", fontSize: 11, backgroundColor: "transparent", border: `1px solid ${T.border}`, color: T.textSub, textDecoration: "none" }}>
            ← HOME
          </Link>
        </div>
      </div>

      {/* 統計サマリ */}
      {stats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 0, border: `1px solid ${T.border}`, backgroundColor: T.card, marginBottom: 16 }}>
          <div style={{ padding: 14, textAlign: "center", borderRight: `1px solid ${T.border}` }}>
            <p style={{ fontSize: 9, letterSpacing: "0.15em", color: T.textMuted, marginBottom: 4 }}>📝 今月の投稿</p>
            <p style={{ fontSize: 22, fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>{stats.thisMonthTotal.toLocaleString()}</p>
          </div>
          <div style={{ padding: 14, textAlign: "center", borderRight: `1px solid ${T.border}` }}>
            <p style={{ fontSize: 9, letterSpacing: "0.15em", color: T.textMuted, marginBottom: 4 }}>🌐 全公開</p>
            <p style={{ fontSize: 22, fontWeight: 500, color: "#6b9b7e", fontVariantNumeric: "tabular-nums" }}>{stats.thisMonthPublic.toLocaleString()}</p>
          </div>
          <div style={{ padding: 14, textAlign: "center", borderRight: `1px solid ${T.border}` }}>
            <p style={{ fontSize: 9, letterSpacing: "0.15em", color: T.textMuted, marginBottom: 4 }}>🔒 会員限定</p>
            <p style={{ fontSize: 22, fontWeight: 500, color: "#a855f7", fontVariantNumeric: "tabular-nums" }}>{stats.thisMonthMembers.toLocaleString()}</p>
          </div>
          <div style={{ padding: 14, textAlign: "center", borderRight: `1px solid ${T.border}` }}>
            <p style={{ fontSize: 9, letterSpacing: "0.15em", color: T.textMuted, marginBottom: 4 }}>📤 駅ちか送信成功率</p>
            <p style={{ fontSize: 22, fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>
              {stats.thisMonthEkichikaSent + stats.thisMonthEkichikaFailed > 0
                ? Math.round((stats.thisMonthEkichikaSent / (stats.thisMonthEkichikaSent + stats.thisMonthEkichikaFailed)) * 100)
                : 100}%
            </p>
            <p style={{ fontSize: 9, color: T.textMuted, marginTop: 2 }}>{stats.thisMonthEkichikaSent}/{stats.thisMonthEkichikaSent + stats.thisMonthEkichikaFailed}</p>
          </div>
          <div style={{ padding: 14, textAlign: "center" }}>
            <p style={{ fontSize: 9, letterSpacing: "0.15em", color: T.textMuted, marginBottom: 4 }}>⚠️ 送信失敗</p>
            <p style={{ fontSize: 22, fontWeight: 500, color: stats.thisMonthEkichikaFailed > 0 ? "#c45555" : T.text, fontVariantNumeric: "tabular-nums" }}>{stats.thisMonthEkichikaFailed}</p>
            {stats.thisMonthEkichikaFailed > 0 && (
              <button
                onClick={retryAllFailed}
                disabled={retrying}
                style={{ marginTop: 4, padding: "3px 8px", fontSize: 9, cursor: retrying ? "not-allowed" : "pointer", backgroundColor: "#c45555", color: "#fff", border: "none", opacity: retrying ? 0.5 : 1 }}
              >
                {retrying ? "処理中..." : "🔄 一括再送信"}
              </button>
            )}
          </div>
        </div>
      )}

      {/* フィルタバー */}
      <div style={{ marginBottom: 16, padding: 12, backgroundColor: T.card, border: `1px solid ${T.border}` }}>
        {/* 種別フィルタ */}
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
        {/* 検索 */}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="text"
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") fetchEntries(); }}
            placeholder="🔍 タイトル/本文で検索"
            style={{ flex: 1, padding: "6px 10px", fontSize: 11, border: `1px solid ${T.border}`, backgroundColor: T.bg, color: T.text, outline: "none" }}
          />
          {therapistOptions.length > 0 && (
            <select
              value={selectedTherapistId}
              onChange={(e) => setSelectedTherapistId(e.target.value)}
              style={{ padding: "6px 8px", fontSize: 11, border: `1px solid ${T.border}`, backgroundColor: T.bg, color: T.text, outline: "none" }}
            >
              <option value="">全員</option>
              {therapistOptions.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          )}
          <button onClick={fetchEntries} style={{ padding: "6px 14px", fontSize: 11, cursor: "pointer", backgroundColor: T.accent, color: "#fff", border: "none" }}>
            検索
          </button>
        </div>
      </div>

      {/* 投稿一覧 */}
      {loading ? (
        <p style={{ textAlign: "center", padding: 40, color: T.textMuted }}>読み込み中...</p>
      ) : entries.length === 0 ? (
        <div style={{ padding: 40, textAlign: "center", backgroundColor: T.card, border: `1px solid ${T.border}` }}>
          <p style={{ fontSize: 28, marginBottom: 8 }}>📭</p>
          <p style={{ fontSize: 12, color: T.textSub }}>該当する投稿がありません</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {entries.map((entry) => (
            <div
              key={entry.id}
              style={{
                display: "flex",
                gap: 12,
                padding: 12,
                backgroundColor: entry.deletedAt ? T.cardAlt : T.card,
                border: `1px solid ${entry.deletedAt ? "#c45555" : T.border}`,
                opacity: entry.deletedAt ? 0.6 : 1,
              }}
            >
              {/* カバー画像 */}
              {entry.coverImageUrl ? (
                <div
                  style={{ width: 90, height: 90, flexShrink: 0, backgroundImage: `url(${entry.coverImageUrl})`, backgroundSize: "cover", backgroundPosition: "center", cursor: "pointer" }}
                  onClick={() => openDetail(entry)}
                />
              ) : (
                <div style={{ width: 90, height: 90, flexShrink: 0, backgroundColor: T.cardAlt, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, color: T.textMuted }}>📷</div>
              )}

              {/* 本体 */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, flexWrap: "wrap" }}>
                  <p style={{ fontSize: 13, fontWeight: 500, color: T.text }}>{entry.title}</p>
                  {entry.deletedAt && <span style={{ fontSize: 9, padding: "2px 6px", backgroundColor: "#c45555", color: "#fff" }}>削除済</span>}
                  {entry.editedAt && <span style={{ fontSize: 9, padding: "2px 6px", backgroundColor: "#b38419", color: "#fff" }}>編集済</span>}
                  {entry.therapist.status === "retired" && <span style={{ fontSize: 9, padding: "2px 6px", backgroundColor: T.textMuted, color: "#fff" }}>退店</span>}
                  {entry.therapist.status === "inactive" && <span style={{ fontSize: 9, padding: "2px 6px", backgroundColor: T.textMuted, color: "#fff" }}>休止</span>}
                </div>
                <p style={{ fontSize: 11, color: T.textMuted, marginBottom: 6 }}>
                  by <span style={{ color: T.textSub, fontWeight: 500 }}>{entry.therapist.name}</span> · {fmtDate(entry.publishedAt)}
                </p>
                <p style={{ fontSize: 10, color: T.textSub, marginBottom: 8, lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                  {entry.bodyPreview}
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 12, fontSize: 10, color: T.textMuted, fontVariantNumeric: "tabular-nums", marginBottom: 8 }}>
                  <span>{entry.visibility === "members_only" ? "🔒 会員限定" : "🌐 全公開"}</span>
                  <span>👀 {entry.viewCount}</span>
                  <span>❤️ {entry.likeCount}</span>
                  <span>💬 {entry.commentCount}</span>
                  <span style={{ color: dispatchColor(entry.ekichikaDispatchStatus) }}>
                    {dispatchLabel(entry.ekichikaDispatchStatus, entry.ekichikaDispatchedAt)}
                  </span>
                </div>
                {entry.ekichikaErrorMessage && (
                  <p style={{ fontSize: 9, color: "#c45555", marginBottom: 6, padding: 4, backgroundColor: "#fef2f2", border: "1px solid #fecaca" }}>
                    エラー: {entry.ekichikaErrorMessage}
                  </p>
                )}
                {entry.deleteReason && (
                  <p style={{ fontSize: 9, color: T.textMuted, marginBottom: 6 }}>
                    削除理由: {entry.deleteReason}
                  </p>
                )}
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <button
                    onClick={() => openDetail(entry)}
                    style={{ padding: "4px 10px", fontSize: 10, cursor: "pointer", backgroundColor: "transparent", border: `1px solid ${T.border}`, color: T.textSub }}
                  >
                    👁️ 詳細
                  </button>
                  {!entry.deletedAt && (
                    <>
                      <button
                        onClick={() => openEdit(entry)}
                        style={{ padding: "4px 10px", fontSize: 10, cursor: "pointer", backgroundColor: "transparent", border: `1px solid ${T.border}`, color: T.textSub }}
                      >
                        ✏️ 編集
                      </button>
                      <button
                        onClick={() => setDeleteTarget(entry)}
                        style={{ padding: "4px 10px", fontSize: 10, cursor: "pointer", backgroundColor: "transparent", border: `1px solid #c45555`, color: "#c45555" }}
                      >
                        🗑 削除
                      </button>
                      {entry.ekichikaDispatchStatus === "failed" && (
                        <button
                          onClick={() => retrySingle(entry)}
                          style={{ padding: "4px 10px", fontSize: 10, cursor: "pointer", backgroundColor: "transparent", border: `1px solid #b38419`, color: "#b38419" }}
                        >
                          🔄 駅ちか再送
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 詳細モーダル */}
      {detailEntry && (
        <div
          style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 9999, display: "flex", alignItems: "flex-start", justifyContent: "center", overflow: "auto", padding: 20 }}
          onClick={(e) => { if (e.target === e.currentTarget) setDetailEntry(null); }}
        >
          <div style={{ width: "100%", maxWidth: 600, backgroundColor: T.card, padding: 20, color: T.text }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <p style={{ fontSize: 14, fontWeight: 500 }}>📄 投稿詳細</p>
              <button onClick={() => setDetailEntry(null)} style={{ padding: "4px 10px", fontSize: 11, cursor: "pointer", backgroundColor: "transparent", border: `1px solid ${T.border}`, color: T.textSub }}>閉じる</button>
            </div>
            <p style={{ fontSize: 16, fontWeight: 500, marginBottom: 8 }}>{detailEntry.title}</p>
            <p style={{ fontSize: 11, color: T.textMuted, marginBottom: 12 }}>
              by {detailEntry.therapist.name} · {fmtDate(detailEntry.publishedAt)} · ID: {detailEntry.id}
            </p>
            {detailImages.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 6, marginBottom: 12 }}>
                {detailImages.map((img) => (
                  <a key={img.id} href={img.imageUrl} target="_blank" rel="noopener noreferrer" style={{ aspectRatio: "1", backgroundImage: `url(${img.thumbnailUrl || img.imageUrl})`, backgroundSize: "cover", backgroundPosition: "center", border: `1px solid ${T.border}` }} />
                ))}
              </div>
            )}
            <p style={{ fontSize: 12, color: T.textSub, lineHeight: 1.7, whiteSpace: "pre-wrap", padding: 12, backgroundColor: T.cardAlt, border: `1px solid ${T.border}`, marginBottom: 12 }}>
              {detailEntry.bodyPreview}
            </p>
            <div style={{ fontSize: 11, color: T.textMuted, lineHeight: 1.8 }}>
              <p>👁️ 閲覧: {detailEntry.viewCount.toLocaleString()}</p>
              <p>❤️ いいね: {detailEntry.likeCount.toLocaleString()}</p>
              <p>💬 コメント: {detailEntry.commentCount.toLocaleString()}</p>
              <p>公開範囲: {detailEntry.visibility === "members_only" ? "🔒 会員限定" : "🌐 全公開"}</p>
              <p>駅ちか: <span style={{ color: dispatchColor(detailEntry.ekichikaDispatchStatus) }}>{dispatchLabel(detailEntry.ekichikaDispatchStatus, detailEntry.ekichikaDispatchedAt)}</span></p>
              {detailEntry.editedAt && <p style={{ color: "#b38419" }}>編集済 ({fmtDate(detailEntry.editedAt)})</p>}
              {detailEntry.deletedAt && <p style={{ color: "#c45555" }}>削除済 ({fmtDate(detailEntry.deletedAt)}) - 理由: {detailEntry.deleteReason || "なし"}</p>}
            </div>
          </div>
        </div>
      )}

      {/* 編集モーダル */}
      {editingEntry && (
        <div
          style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 9999, display: "flex", alignItems: "flex-start", justifyContent: "center", overflow: "auto", padding: 20 }}
          onClick={(e) => { if (e.target === e.currentTarget) setEditingEntry(null); }}
        >
          <div style={{ width: "100%", maxWidth: 500, backgroundColor: T.card, padding: 20, color: T.text }}>
            <div style={{ marginBottom: 14, padding: 8, backgroundColor: "#fef7d4", border: "1px solid #b38419" }}>
              <p style={{ fontSize: 11, color: "#7a5a0e", fontWeight: 500, marginBottom: 2 }}>⚠️ スタッフ編集モード</p>
              <p style={{ fontSize: 10, color: "#7a5a0e" }}>編集してもHPには即時反映されますが、駅ちか側には自動で反映されません。</p>
            </div>
            <p style={{ fontSize: 14, fontWeight: 500, marginBottom: 14 }}>✏️ 投稿を編集</p>
            <div style={{ marginBottom: 12 }}>
              <p style={{ fontSize: 10, color: T.textSub, marginBottom: 4 }}>タイトル ({editTitle.length}/80)</p>
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                style={{ width: "100%", padding: "8px 10px", fontSize: 12, border: `1px solid ${T.border}`, backgroundColor: T.bg, color: T.text, outline: "none" }}
              />
            </div>
            <div style={{ marginBottom: 12 }}>
              <p style={{ fontSize: 10, color: T.textSub, marginBottom: 4 }}>本文 ({editBody.length}/2000)</p>
              <textarea
                value={editBody}
                onChange={(e) => setEditBody(e.target.value)}
                rows={8}
                style={{ width: "100%", padding: "8px 10px", fontSize: 12, border: `1px solid ${T.border}`, backgroundColor: T.bg, color: T.text, outline: "none", resize: "vertical", lineHeight: 1.6 }}
              />
            </div>
            <div style={{ marginBottom: 14 }}>
              <p style={{ fontSize: 10, color: T.textSub, marginBottom: 4 }}>公開範囲</p>
              <div style={{ display: "flex", gap: 8 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, cursor: "pointer" }}>
                  <input type="radio" checked={editVisibility === "public"} onChange={() => setEditVisibility("public")} />
                  🌐 全公開
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, cursor: "pointer" }}>
                  <input type="radio" checked={editVisibility === "members_only"} onChange={() => setEditVisibility("members_only")} />
                  🔒 会員限定
                </label>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <button onClick={() => setEditingEntry(null)} style={{ padding: 10, fontSize: 12, cursor: "pointer", backgroundColor: "transparent", border: `1px solid ${T.border}`, color: T.textSub }}>
                キャンセル
              </button>
              <button onClick={submitEdit} disabled={editing} style={{ padding: 10, fontSize: 12, cursor: editing ? "not-allowed" : "pointer", backgroundColor: T.accent, color: "#fff", border: "none", opacity: editing ? 0.5 : 1 }}>
                {editing ? "保存中..." : "💾 保存"}
              </button>
            </div>
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
            <p style={{ fontSize: 14, fontWeight: 500, marginBottom: 8, textAlign: "center" }}>🗑 削除しますか?</p>
            <p style={{ fontSize: 11, color: T.textMuted, marginBottom: 12, textAlign: "center", lineHeight: 1.6 }}>
              「{deleteTarget.title}」を削除します。<br />
              ⚠️ 駅ちかには自動反映されません
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
                {deleting ? "削除中..." : "削除する"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
