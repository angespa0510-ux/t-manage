"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useStaffSession } from "../../lib/staff-session";
import { useTheme } from "../../lib/theme";
import { useToast } from "../../lib/toast";

/**
 * 駅ちか設定画面
 *
 * 機能:
 *   - 各セラピストの駅ちか専用投稿メアドを管理
 *   - 一覧 (登録済み/未登録/有効/無効)
 *   - 新規登録・編集・削除
 *   - 有効/無効トグル
 *   - 送信統計表示 (送信数/失敗数/最終送信日時)
 *
 * 権限: isManager
 */

type Item = {
  therapist: { id: number; name: string; status: string };
  setting: {
    id: number;
    ekichikaEmail: string;
    isActive: boolean;
    lastSentAt: string | null;
    totalSentCount: number;
    totalFailedCount: number;
    note: string | null;
    updatedAt: string;
  } | null;
};

type Summary = {
  totalTherapists: number;
  configured: number;
  unconfigured: number;
  active: number;
};

type FilterMode = "all" | "configured" | "unconfigured" | "inactive";

export default function EkichikaSettingsPage() {
  const { activeStaff, isManager, isRestored } = useStaffSession();
  const { dark, toggle, T } = useTheme();
  const { show: pushToast } = useToast();

  const [items, setItems] = useState<Item[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterMode>("all");
  const [searchQ, setSearchQ] = useState("");

  // 編集モーダル
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [editEmail, setEditEmail] = useState("");
  const [editActive, setEditActive] = useState(true);
  const [editNote, setEditNote] = useState("");
  const [saving, setSaving] = useState(false);

  // 削除確認
  const [deleteTarget, setDeleteTarget] = useState<Item | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ════════════════════════════════════════════════════════
  // データ取得
  // ════════════════════════════════════════════════════════
  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/ekichika-settings/list");
      const data = await res.json();
      if (res.ok) {
        setItems(data.items || []);
        setSummary(data.summary || null);
      } else {
        pushToast(data.error || "取得失敗", "error");
      }
    } catch {
      pushToast("通信エラー", "error");
    } finally {
      setLoading(false);
    }
  }, [pushToast]);

  useEffect(() => {
    if (isRestored && isManager) {
      fetchList();
    }
  }, [fetchList, isRestored, isManager]);

  // ════════════════════════════════════════════════════════
  // フィルタ済みリスト
  // ════════════════════════════════════════════════════════
  const filteredItems = items.filter((item) => {
    // フィルタ
    if (filter === "configured" && !item.setting) return false;
    if (filter === "unconfigured" && item.setting) return false;
    if (filter === "inactive" && (!item.setting || item.setting.isActive)) return false;
    // 検索
    if (searchQ.trim() && !item.therapist.name.toLowerCase().includes(searchQ.toLowerCase())) {
      return false;
    }
    return true;
  });

  // ════════════════════════════════════════════════════════
  // 編集モーダル
  // ════════════════════════════════════════════════════════
  const openEdit = (item: Item) => {
    setEditingItem(item);
    setEditEmail(item.setting?.ekichikaEmail || "");
    setEditActive(item.setting?.isActive !== false);
    setEditNote(item.setting?.note || "");
  };

  const closeEdit = () => {
    setEditingItem(null);
    setEditEmail("");
    setEditActive(true);
    setEditNote("");
  };

  const saveEdit = async () => {
    if (!editingItem || !activeStaff) return;
    if (!editEmail.trim()) {
      pushToast("メアドを入力してください", "error");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/ekichika-settings/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          staffId: activeStaff.id,
          therapistId: editingItem.therapist.id,
          ekichikaEmail: editEmail.trim(),
          isActive: editActive,
          note: editNote.trim() || null,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        pushToast(data.action === "created" ? "登録しました" : "更新しました", "success");
        closeEdit();
        await fetchList();
      } else {
        pushToast(data.error || "保存失敗", "error");
      }
    } catch {
      pushToast("通信エラー", "error");
    } finally {
      setSaving(false);
    }
  };

  // ════════════════════════════════════════════════════════
  // 有効/無効トグル
  // ════════════════════════════════════════════════════════
  const toggleActive = async (item: Item) => {
    if (!item.setting || !activeStaff) return;
    try {
      const res = await fetch("/api/ekichika-settings/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          staffId: activeStaff.id,
          therapistId: item.therapist.id,
          ekichikaEmail: item.setting.ekichikaEmail,
          isActive: !item.setting.isActive,
          note: item.setting.note,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        pushToast(item.setting.isActive ? "無効にしました" : "有効にしました", "success");
        await fetchList();
      } else {
        pushToast(data.error || "失敗", "error");
      }
    } catch {
      pushToast("通信エラー", "error");
    }
  };

  // ════════════════════════════════════════════════════════
  // 削除
  // ════════════════════════════════════════════════════════
  const submitDelete = async () => {
    if (!deleteTarget || !activeStaff) return;
    setDeleting(true);
    try {
      const res = await fetch("/api/ekichika-settings/save", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          staffId: activeStaff.id,
          therapistId: deleteTarget.therapist.id,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        pushToast("削除しました", "success");
        setDeleteTarget(null);
        await fetchList();
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
  const fmtDate = (iso: string | null) => {
    if (!iso) return "-";
    const d = new Date(iso);
    return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  const maskEmail = (email: string) => {
    if (!email || email.length < 8) return email;
    const [local, domain] = email.split("@");
    if (local.length <= 4) return `${local}***@${domain}`;
    return `${local.slice(0, 4)}***${local.slice(-2)}@${domain}`;
  };

  const successRate = (item: Item) => {
    if (!item.setting) return null;
    const total = item.setting.totalSentCount + item.setting.totalFailedCount;
    if (total === 0) return null;
    return Math.round((item.setting.totalSentCount / total) * 100);
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
          <h1 style={{ fontSize: 18, fontWeight: 500, marginBottom: 4 }}>📧 駅ちか設定</h1>
          <p style={{ fontSize: 11, color: T.textMuted }}>セラピストの駅ちか専用投稿メアドを管理します</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
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

      {/* 説明バナー */}
      <div style={{ padding: 14, backgroundColor: "#fef7f9", border: `1px solid ${T.accent}`, marginBottom: 16 }}>
        <p style={{ fontSize: 12, color: T.text, fontWeight: 500, marginBottom: 6 }}>📝 駅ちか専用メアドの取得方法</p>
        <ol style={{ fontSize: 11, color: T.textSub, lineHeight: 1.7, marginLeft: 18 }}>
          <li>駅ちか管理画面にログイン</li>
          <li>各セラピストの「写メ日記投稿」ページを開く</li>
          <li>表示されるメールアドレスをコピー (例: 8f4cc...@shame.ranking-deli.jp)</li>
          <li>このページで対象セラピストに登録</li>
        </ol>
        <p style={{ fontSize: 10, color: "#c45555", marginTop: 8 }}>
          ⚠️ メアドが流出すると勝手に投稿される可能性があるため取扱注意
        </p>
      </div>

      {/* 統計サマリ */}
      {summary && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 0, border: `1px solid ${T.border}`, backgroundColor: T.card, marginBottom: 16 }}>
          <div style={{ padding: 14, textAlign: "center", borderRight: `1px solid ${T.border}` }}>
            <p style={{ fontSize: 9, letterSpacing: "0.15em", color: T.textMuted, marginBottom: 4 }}>👥 セラピスト数</p>
            <p style={{ fontSize: 22, fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>{summary.totalTherapists}</p>
          </div>
          <div style={{ padding: 14, textAlign: "center", borderRight: `1px solid ${T.border}` }}>
            <p style={{ fontSize: 9, letterSpacing: "0.15em", color: T.textMuted, marginBottom: 4 }}>📧 設定済み</p>
            <p style={{ fontSize: 22, fontWeight: 500, color: "#6b9b7e", fontVariantNumeric: "tabular-nums" }}>{summary.configured}</p>
          </div>
          <div style={{ padding: 14, textAlign: "center", borderRight: `1px solid ${T.border}` }}>
            <p style={{ fontSize: 9, letterSpacing: "0.15em", color: T.textMuted, marginBottom: 4 }}>✅ 有効</p>
            <p style={{ fontSize: 22, fontWeight: 500, color: T.accent, fontVariantNumeric: "tabular-nums" }}>{summary.active}</p>
          </div>
          <div style={{ padding: 14, textAlign: "center" }}>
            <p style={{ fontSize: 9, letterSpacing: "0.15em", color: T.textMuted, marginBottom: 4 }}>❌ 未設定</p>
            <p style={{ fontSize: 22, fontWeight: 500, color: summary.unconfigured > 0 ? "#c45555" : T.text, fontVariantNumeric: "tabular-nums" }}>{summary.unconfigured}</p>
          </div>
        </div>
      )}

      {/* フィルタ */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
        {[
          { key: "all" as const, label: "全て" },
          { key: "configured" as const, label: "設定済み" },
          { key: "unconfigured" as const, label: "未設定" },
          { key: "inactive" as const, label: "無効" },
        ].map((f) => (
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
            {f.label}
          </button>
        ))}
        <input
          type="text"
          value={searchQ}
          onChange={(e) => setSearchQ(e.target.value)}
          placeholder="🔍 セラピスト名で検索"
          style={{ flex: 1, minWidth: 200, padding: "5px 10px", fontSize: 11, border: `1px solid ${T.border}`, backgroundColor: T.bg, color: T.text, outline: "none" }}
        />
      </div>

      {/* リスト */}
      {loading ? (
        <p style={{ textAlign: "center", padding: 40, color: T.textMuted }}>読み込み中...</p>
      ) : filteredItems.length === 0 ? (
        <div style={{ padding: 40, textAlign: "center", backgroundColor: T.card, border: `1px solid ${T.border}` }}>
          <p style={{ fontSize: 12, color: T.textSub }}>該当するセラピストがいません</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {filteredItems.map((item) => {
            const rate = successRate(item);
            return (
              <div
                key={item.therapist.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto",
                  gap: 12,
                  padding: 12,
                  backgroundColor: T.card,
                  border: `1px solid ${item.setting?.isActive ? T.border : item.setting ? T.textMuted : "#c45555"}`,
                  alignItems: "center",
                }}
              >
                {/* 本体 */}
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                    <p style={{ fontSize: 13, fontWeight: 500 }}>{item.therapist.name}</p>
                    {item.setting ? (
                      item.setting.isActive ? (
                        <span style={{ fontSize: 9, padding: "2px 6px", backgroundColor: "#6b9b7e", color: "#fff" }}>✅ 有効</span>
                      ) : (
                        <span style={{ fontSize: 9, padding: "2px 6px", backgroundColor: T.textMuted, color: "#fff" }}>⏸ 無効</span>
                      )
                    ) : (
                      <span style={{ fontSize: 9, padding: "2px 6px", backgroundColor: "#c45555", color: "#fff" }}>❌ 未設定</span>
                    )}
                    {item.therapist.status === "inactive" && (
                      <span style={{ fontSize: 9, padding: "2px 6px", backgroundColor: T.textMuted, color: "#fff" }}>休止</span>
                    )}
                  </div>
                  {item.setting ? (
                    <>
                      <p style={{ fontSize: 11, color: T.textSub, fontFamily: "monospace", marginBottom: 4 }}>
                        {maskEmail(item.setting.ekichikaEmail)}
                      </p>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, fontSize: 10, color: T.textMuted, fontVariantNumeric: "tabular-nums" }}>
                        <span>📤 送信: {item.setting.totalSentCount.toLocaleString()}</span>
                        {item.setting.totalFailedCount > 0 && (
                          <span style={{ color: "#c45555" }}>❌ 失敗: {item.setting.totalFailedCount}</span>
                        )}
                        {rate !== null && (
                          <span>成功率: {rate}%</span>
                        )}
                        {item.setting.lastSentAt && (
                          <span>最終送信: {fmtDate(item.setting.lastSentAt)}</span>
                        )}
                      </div>
                      {item.setting.note && (
                        <p style={{ fontSize: 10, color: T.textMuted, marginTop: 4, fontStyle: "italic" }}>📝 {item.setting.note}</p>
                      )}
                    </>
                  ) : (
                    <p style={{ fontSize: 10, color: "#c45555" }}>
                      駅ちかメアドが未設定です。投稿しても駅ちかには送信されません。
                    </p>
                  )}
                </div>

                {/* アクション */}
                <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end" }}>
                  <button
                    onClick={() => openEdit(item)}
                    style={{ padding: "5px 12px", fontSize: 11, cursor: "pointer", backgroundColor: T.accent, color: "#fff", border: "none", whiteSpace: "nowrap" }}
                  >
                    {item.setting ? "✏️ 編集" : "+ 登録"}
                  </button>
                  {item.setting && (
                    <>
                      <button
                        onClick={() => toggleActive(item)}
                        style={{ padding: "4px 10px", fontSize: 10, cursor: "pointer", backgroundColor: "transparent", border: `1px solid ${T.border}`, color: T.textSub, whiteSpace: "nowrap" }}
                      >
                        {item.setting.isActive ? "⏸ 無効化" : "▶ 有効化"}
                      </button>
                      <button
                        onClick={() => setDeleteTarget(item)}
                        style={{ padding: "4px 10px", fontSize: 10, cursor: "pointer", backgroundColor: "transparent", border: `1px solid #c45555`, color: "#c45555", whiteSpace: "nowrap" }}
                      >
                        🗑 削除
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 編集モーダル */}
      {editingItem && (
        <div
          style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
          onClick={(e) => { if (e.target === e.currentTarget) closeEdit(); }}
        >
          <div style={{ width: "100%", maxWidth: 460, backgroundColor: T.card, padding: 20, color: T.text }}>
            <p style={{ fontSize: 14, fontWeight: 500, marginBottom: 12 }}>
              {editingItem.setting ? "✏️ 駅ちか設定を編集" : "+ 駅ちか設定を登録"}
            </p>
            <p style={{ fontSize: 11, color: T.textMuted, marginBottom: 14 }}>
              対象: <span style={{ color: T.text, fontWeight: 500 }}>{editingItem.therapist.name}</span>
            </p>

            <div style={{ marginBottom: 12 }}>
              <p style={{ fontSize: 10, color: T.textSub, marginBottom: 4 }}>駅ちか専用メアド *</p>
              <input
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                placeholder="例: 8f4cc8aa442c5208889b401b2da868ec4@shame.ranking-deli.jp"
                style={{ width: "100%", padding: "8px 10px", fontSize: 11, fontFamily: "monospace", border: `1px solid ${T.border}`, backgroundColor: T.bg, color: T.text, outline: "none" }}
              />
            </div>

            <div style={{ marginBottom: 12 }}>
              <p style={{ fontSize: 10, color: T.textSub, marginBottom: 4 }}>メモ (任意)</p>
              <input
                type="text"
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
                placeholder="例: 2026/4/25 取得"
                style={{ width: "100%", padding: "8px 10px", fontSize: 11, border: `1px solid ${T.border}`, backgroundColor: T.bg, color: T.text, outline: "none" }}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={editActive}
                  onChange={(e) => setEditActive(e.target.checked)}
                />
                <span>このメアドを有効にする (新規投稿時に自動送信)</span>
              </label>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <button onClick={closeEdit} style={{ padding: 10, fontSize: 12, cursor: "pointer", backgroundColor: "transparent", border: `1px solid ${T.border}`, color: T.textSub }}>
                キャンセル
              </button>
              <button
                onClick={saveEdit}
                disabled={saving || !editEmail.trim()}
                style={{ padding: 10, fontSize: 12, cursor: saving || !editEmail.trim() ? "not-allowed" : "pointer", backgroundColor: T.accent, color: "#fff", border: "none", opacity: saving || !editEmail.trim() ? 0.5 : 1 }}
              >
                {saving ? "保存中..." : "💾 保存"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 削除確認 */}
      {deleteTarget && (
        <div
          style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
          onClick={(e) => { if (e.target === e.currentTarget) setDeleteTarget(null); }}
        >
          <div style={{ width: "100%", maxWidth: 400, backgroundColor: T.card, padding: 20, color: T.text }}>
            <p style={{ fontSize: 14, fontWeight: 500, marginBottom: 8, textAlign: "center" }}>🗑 削除しますか?</p>
            <p style={{ fontSize: 11, color: T.textMuted, marginBottom: 16, textAlign: "center", lineHeight: 1.6 }}>
              「{deleteTarget.therapist.name}」の駅ちか設定を削除します。<br />
              削除後はこのセラピストの投稿は駅ちかへ送信されなくなります。
            </p>
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
