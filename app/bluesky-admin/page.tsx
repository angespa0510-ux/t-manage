"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useStaffSession } from "../../lib/staff-session";
import { useTheme } from "../../lib/theme";
import { useToast } from "../../lib/toast";
import { supabase } from "../../lib/supabase";

/**
 * Bluesky連携 管理画面 (スタッフ代行)
 *
 * 機能:
 *   - 全セラピストのBluesky連携状態一覧
 *   - スタッフがセラピストに代わって連携設定
 *   - 代行で連携解除も可能
 *   - 投稿履歴 (全セラピスト)
 *
 * 権限: isManager (owner/manager/leader)
 */

type TherapistRow = {
  id: number;
  name: string;
  status: string;
  has_account: boolean;
  active: boolean | null;
  auto_post_enabled: boolean | null;
  handle: string | null;
  post_count_today: number | null;
  daily_post_limit: number | null;
  last_posted_at: string | null;
  last_test_status: string | null;
  last_error: string | null;
  setup_by: string | null;
};

type HistoryItem = {
  id: number;
  entryTitle: string;
  therapist: { id: number; name: string };
  status: string;
  blueskyPostUrl: string | null;
  postedText: string | null;
  errorMessage: string | null;
  skipReason: string | null;
  postedAt: string | null;
  createdAt: string;
};

export default function BlueskyAdminPage() {
  const { activeStaff, isManager, isRestored } = useStaffSession();
  const { dark, toggle, T } = useTheme();
  const { show: pushToast } = useToast();

  const [therapists, setTherapists] = useState<TherapistRow[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"accounts" | "history">("accounts");

  // 設定モーダル
  const [setupTarget, setSetupTarget] = useState<TherapistRow | null>(null);
  const [handleInput, setHandleInput] = useState("");
  const [appPasswordInput, setAppPasswordInput] = useState("");
  const [setupSubmitting, setSetupSubmitting] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [setupHint, setSetupHint] = useState<string | null>(null);

  // 解除確認
  const [disconnectTarget, setDisconnectTarget] = useState<TherapistRow | null>(null);

  // ════════════════════════════════════════════════════════
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // セラピスト一覧 (active のみ)
      const { data: therapistList } = await supabase
        .from("therapists")
        .select("id, name, status")
        .eq("status", "active")
        .is("deleted_at", null)
        .order("name", { ascending: true });

      // Bluesky アカウント一覧
      const { data: accounts } = await supabase
        .from("therapist_bluesky_accounts")
        .select("therapist_id, handle, active, auto_post_enabled, post_count_today, daily_post_limit, last_posted_at, last_test_status, last_error, setup_by");

      type AccountRow = {
        therapist_id: number;
        handle: string;
        active: boolean;
        auto_post_enabled: boolean;
        post_count_today: number;
        daily_post_limit: number;
        last_posted_at: string | null;
        last_test_status: string | null;
        last_error: string | null;
        setup_by: string;
      };
      const accountMap = new Map<number, AccountRow>();
      for (const a of (accounts || []) as AccountRow[]) {
        accountMap.set(a.therapist_id, a);
      }

      type Therapist = { id: number; name: string; status: string };
      const merged: TherapistRow[] = ((therapistList || []) as Therapist[]).map((t) => {
        const a = accountMap.get(t.id);
        return {
          id: t.id,
          name: t.name,
          status: t.status,
          has_account: !!a,
          active: a?.active ?? null,
          auto_post_enabled: a?.auto_post_enabled ?? null,
          handle: a?.handle || null,
          post_count_today: a?.post_count_today ?? null,
          daily_post_limit: a?.daily_post_limit ?? null,
          last_posted_at: a?.last_posted_at || null,
          last_test_status: a?.last_test_status || null,
          last_error: a?.last_error || null,
          setup_by: a?.setup_by || null,
        };
      });
      setTherapists(merged);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/diary/bluesky/history?staff=1&limit=100");
      const data = await res.json();
      if (res.ok) {
        setHistory(data.posts || []);
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    if (isRestored && isManager) {
      fetchData();
      fetchHistory();
    }
  }, [isRestored, isManager, fetchData, fetchHistory]);

  // ════════════════════════════════════════════════════════
  const submitSetup = async () => {
    if (!setupTarget || !activeStaff) return;
    setSetupError(null);
    setSetupHint(null);
    if (!handleInput.trim() || !appPasswordInput.trim()) {
      setSetupError("ハンドルとApp Passwordを入力してください");
      return;
    }
    setSetupSubmitting(true);
    try {
      const res = await fetch("/api/diary/bluesky/account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          therapistId: setupTarget.id,
          staffId: activeStaff.id,
          handle: handleInput.trim(),
          appPassword: appPasswordInput.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSetupError(data.error || "設定失敗");
        if (data.hint) setSetupHint(data.hint);
      } else {
        pushToast(`${data.handle} と連携しました`, "success");
        closeSetup();
        await fetchData();
      }
    } catch {
      setSetupError("通信エラー");
    } finally {
      setSetupSubmitting(false);
    }
  };

  const closeSetup = () => {
    setSetupTarget(null);
    setHandleInput("");
    setAppPasswordInput("");
    setSetupError(null);
    setSetupHint(null);
  };

  const submitDisconnect = async () => {
    if (!disconnectTarget || !activeStaff) return;
    try {
      const res = await fetch("/api/diary/bluesky/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          therapistId: disconnectTarget.id,
          staffId: activeStaff.id,
        }),
      });
      if (res.ok) {
        pushToast("解除しました", "success");
        setDisconnectTarget(null);
        await fetchData();
      }
    } catch {
      pushToast("通信エラー", "error");
    }
  };

  const toggleAutoPost = async (t: TherapistRow) => {
    if (!activeStaff) return;
    try {
      await fetch("/api/diary/bluesky/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          therapistId: t.id,
          staffId: activeStaff.id,
          autoPostEnabled: !t.auto_post_enabled,
        }),
      });
      await fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  const fmtDateTime = (iso: string | null) => {
    if (!iso) return "—";
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

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
        <p style={{ fontSize: 14, marginBottom: 16 }}>権限がありません</p>
        <Link href="/dashboard" style={{ fontSize: 12, color: T.accent, textDecoration: "none" }}>← HOMEに戻る</Link>
      </div>
    );
  }

  const stats = {
    total: therapists.length,
    connected: therapists.filter((t) => t.has_account).length,
    autoOn: therapists.filter((t) => t.auto_post_enabled).length,
    error: therapists.filter((t) => t.last_test_status === "failed").length,
  };

  // ════════════════════════════════════════════════════════
  return (
    <div style={{ minHeight: "100vh", backgroundColor: T.bg, color: T.text, padding: 16 }}>
      {/* ヘッダ */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 500, marginBottom: 4 }}>🦋 Bluesky 連携管理</h1>
          <p style={{ fontSize: 11, color: T.textMuted }}>
            セラピストの Bluesky 自動投稿設定をスタッフが代行できます
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => { fetchData(); fetchHistory(); }} style={{ padding: "6px 10px", fontSize: 11, cursor: "pointer", backgroundColor: "transparent", border: `1px solid ${T.border}`, color: T.textSub }}>
            🔄 更新
          </button>
          <button onClick={toggle} style={{ padding: "6px 10px", fontSize: 11, cursor: "pointer", backgroundColor: "transparent", border: `1px solid ${T.border}`, color: T.textSub }}>
            {dark ? "☀️" : "🌙"}
          </button>
          <Link href="/dashboard" style={{ padding: "6px 10px", fontSize: 11, backgroundColor: "transparent", border: `1px solid ${T.border}`, color: T.textSub, textDecoration: "none" }}>
            ← HOME
          </Link>
        </div>
      </div>

      {/* 統計 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 0, border: `1px solid ${T.border}`, backgroundColor: T.card, marginBottom: 16 }}>
        <div style={{ padding: 12, textAlign: "center", borderRight: `1px solid ${T.border}` }}>
          <p style={{ fontSize: 9, color: T.textMuted, marginBottom: 4 }}>セラピスト総数</p>
          <p style={{ fontSize: 22, fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>{stats.total}</p>
        </div>
        <div style={{ padding: 12, textAlign: "center", borderRight: `1px solid ${T.border}` }}>
          <p style={{ fontSize: 9, color: T.textMuted, marginBottom: 4 }}>連携済み</p>
          <p style={{ fontSize: 22, fontWeight: 500, color: "#6b9b7e", fontVariantNumeric: "tabular-nums" }}>{stats.connected}</p>
        </div>
        <div style={{ padding: 12, textAlign: "center", borderRight: `1px solid ${T.border}` }}>
          <p style={{ fontSize: 9, color: T.textMuted, marginBottom: 4 }}>自動投稿ON</p>
          <p style={{ fontSize: 22, fontWeight: 500, color: T.accent, fontVariantNumeric: "tabular-nums" }}>{stats.autoOn}</p>
        </div>
        <div style={{ padding: 12, textAlign: "center" }}>
          <p style={{ fontSize: 9, color: T.textMuted, marginBottom: 4 }}>エラーあり</p>
          <p style={{ fontSize: 22, fontWeight: 500, color: stats.error > 0 ? "#c45555" : T.text, fontVariantNumeric: "tabular-nums" }}>{stats.error}</p>
        </div>
      </div>

      {/* タブ切替 */}
      <div style={{ display: "flex", gap: 0, marginBottom: 14, border: `1px solid ${T.border}`, backgroundColor: T.card }}>
        {[
          { key: "accounts" as const, label: "👥 セラピスト一覧" },
          { key: "history" as const, label: "📜 投稿履歴" },
        ].map((t, i) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              flex: 1,
              padding: 10,
              fontSize: 12,
              cursor: "pointer",
              backgroundColor: tab === t.key ? T.accent : "transparent",
              color: tab === t.key ? "#fff" : T.textSub,
              border: "none",
              borderLeft: i > 0 ? `1px solid ${T.border}` : "none",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* セラピスト一覧 */}
      {tab === "accounts" && (
        loading ? (
          <p style={{ textAlign: "center", padding: 30, color: T.textMuted }}>読み込み中...</p>
        ) : (
          <div style={{ overflowX: "auto", border: `1px solid ${T.border}` }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, backgroundColor: T.card }}>
              <thead>
                <tr style={{ backgroundColor: T.cardAlt }}>
                  <th style={{ padding: 8, textAlign: "left", borderBottom: `1px solid ${T.border}` }}>セラピスト</th>
                  <th style={{ padding: 8, textAlign: "left", borderBottom: `1px solid ${T.border}` }}>連携状態</th>
                  <th style={{ padding: 8, textAlign: "left", borderBottom: `1px solid ${T.border}` }}>ハンドル</th>
                  <th style={{ padding: 8, textAlign: "left", borderBottom: `1px solid ${T.border}` }}>自動投稿</th>
                  <th style={{ padding: 8, textAlign: "left", borderBottom: `1px solid ${T.border}` }}>本日</th>
                  <th style={{ padding: 8, textAlign: "left", borderBottom: `1px solid ${T.border}` }}>最終投稿</th>
                  <th style={{ padding: 8, textAlign: "left", borderBottom: `1px solid ${T.border}` }}>設定者</th>
                  <th style={{ padding: 8, textAlign: "center", borderBottom: `1px solid ${T.border}` }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {therapists.map((t) => (
                  <tr key={t.id} style={{ borderBottom: `1px solid ${T.border}` }}>
                    <td style={{ padding: 8 }}>{t.name}</td>
                    <td style={{ padding: 8 }}>
                      {!t.has_account ? (
                        <span style={{ fontSize: 9, padding: "2px 6px", backgroundColor: T.cardAlt, color: T.textMuted }}>未連携</span>
                      ) : t.last_test_status === "failed" ? (
                        <span style={{ fontSize: 9, padding: "2px 6px", backgroundColor: "#c45555", color: "#fff" }}>エラー</span>
                      ) : (
                        <span style={{ fontSize: 9, padding: "2px 6px", backgroundColor: "#6b9b7e", color: "#fff" }}>連携中</span>
                      )}
                    </td>
                    <td style={{ padding: 8, color: T.textSub }}>{t.handle ? `@${t.handle}` : "—"}</td>
                    <td style={{ padding: 8 }}>
                      {t.has_account ? (
                        <button
                          onClick={() => toggleAutoPost(t)}
                          style={{
                            padding: "2px 8px",
                            fontSize: 10,
                            cursor: "pointer",
                            backgroundColor: t.auto_post_enabled ? "#6b9b7e" : T.cardAlt,
                            color: t.auto_post_enabled ? "#fff" : T.textMuted,
                            border: `1px solid ${t.auto_post_enabled ? "#6b9b7e" : T.border}`,
                          }}
                        >
                          {t.auto_post_enabled ? "ON" : "OFF"}
                        </button>
                      ) : "—"}
                    </td>
                    <td style={{ padding: 8, fontSize: 10, color: T.textSub, fontVariantNumeric: "tabular-nums" }}>
                      {t.has_account ? `${t.post_count_today ?? 0} / ${t.daily_post_limit ?? 3}` : "—"}
                    </td>
                    <td style={{ padding: 8, fontSize: 10, color: T.textMuted }}>
                      {fmtDateTime(t.last_posted_at)}
                    </td>
                    <td style={{ padding: 8, fontSize: 10, color: T.textMuted }}>
                      {t.setup_by === "self" ? "本人" : t.setup_by === "staff" ? "スタッフ" : "—"}
                    </td>
                    <td style={{ padding: 8, textAlign: "center" }}>
                      {t.has_account ? (
                        <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
                          <button onClick={() => setSetupTarget(t)} style={{ padding: "3px 8px", fontSize: 10, cursor: "pointer", backgroundColor: "transparent", border: `1px solid ${T.border}`, color: T.textSub }}>
                            再設定
                          </button>
                          <button onClick={() => setDisconnectTarget(t)} style={{ padding: "3px 8px", fontSize: 10, cursor: "pointer", backgroundColor: "transparent", border: `1px solid #c45555`, color: "#c45555" }}>
                            解除
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => setSetupTarget(t)} style={{ padding: "3px 10px", fontSize: 10, cursor: "pointer", backgroundColor: T.accent, color: "#fff", border: "none" }}>
                          🦋 連携
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* 投稿履歴 */}
      {tab === "history" && (
        loading ? (
          <p style={{ textAlign: "center", padding: 30, color: T.textMuted }}>読み込み中...</p>
        ) : history.length === 0 ? (
          <p style={{ textAlign: "center", padding: 30, color: T.textMuted, fontSize: 12 }}>投稿履歴はまだありません</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {history.map((h) => (
              <div key={h.id} style={{ padding: 10, backgroundColor: T.card, border: `1px solid ${T.border}`, fontSize: 11 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                    <span style={{ fontSize: 9, padding: "2px 6px", backgroundColor: h.status === "posted" ? "#6b9b7e" : h.status === "skipped" ? "#888" : "#c45555", color: "#fff" }}>
                      {h.status === "posted" ? "投稿" : h.status === "skipped" ? "スキップ" : "失敗"}
                    </span>
                    <span style={{ color: T.text, fontWeight: 500 }}>{h.therapist.name}</span>
                  </div>
                  <span style={{ color: T.textMuted, fontSize: 10 }}>{fmtDateTime(h.createdAt)}</span>
                </div>
                <p style={{ color: T.textSub, marginBottom: 4 }}>📝 {h.entryTitle}</p>
                {h.status === "posted" && h.blueskyPostUrl && (
                  <a href={h.blueskyPostUrl} target="_blank" rel="noopener noreferrer" style={{ color: T.accent, fontSize: 10, textDecoration: "none" }}>
                    Blueskyで開く ↗
                  </a>
                )}
                {h.status === "skipped" && h.skipReason && (
                  <p style={{ color: T.textMuted, fontSize: 10 }}>理由: {h.skipReason}</p>
                )}
                {h.status === "failed" && h.errorMessage && (
                  <p style={{ color: "#c45555", fontSize: 10 }}>{h.errorMessage}</p>
                )}
              </div>
            ))}
          </div>
        )
      )}

      {/* 設定モーダル */}
      {setupTarget && (
        <div
          style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
          onClick={(e) => { if (e.target === e.currentTarget) closeSetup(); }}
        >
          <div style={{ width: "100%", maxWidth: 440, backgroundColor: T.card, padding: 20, color: T.text }}>
            <p style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>🦋 {setupTarget.name} のBluesky連携</p>
            <p style={{ fontSize: 11, color: T.textMuted, marginBottom: 16, lineHeight: 1.6 }}>
              ハンドルとApp Passwordを入力してください。
              <br />
              ※ App Password は通常のログインパスワードではなく、Blueskyアプリの「設定 → プライバシー → アプリパスワード」で発行する専用パスワードです。
            </p>

            <div style={{ marginBottom: 10 }}>
              <p style={{ fontSize: 10, color: T.textSub, marginBottom: 4 }}>HANDLE</p>
              <input
                type="text"
                value={handleInput}
                onChange={(e) => setHandleInput(e.target.value)}
                placeholder="例: yume.bsky.social"
                style={{ width: "100%", padding: "8px 10px", fontSize: 12, border: `1px solid ${T.border}`, backgroundColor: T.bg, color: T.text, outline: "none" }}
              />
            </div>

            <div style={{ marginBottom: 12 }}>
              <p style={{ fontSize: 10, color: T.textSub, marginBottom: 4 }}>APP PASSWORD</p>
              <input
                type="password"
                value={appPasswordInput}
                onChange={(e) => setAppPasswordInput(e.target.value)}
                placeholder="xxxx-xxxx-xxxx-xxxx"
                style={{ width: "100%", padding: "8px 10px", fontSize: 12, border: `1px solid ${T.border}`, backgroundColor: T.bg, color: T.text, outline: "none" }}
              />
            </div>

            {setupError && (
              <div style={{ padding: 8, backgroundColor: "#fef2f2", border: `1px solid #c45555`, fontSize: 11, color: "#7a2929", marginBottom: 12 }}>
                {setupError}
                {setupHint && <p style={{ fontSize: 10, marginTop: 4, color: "#5a3535" }}>{setupHint}</p>}
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <button onClick={closeSetup} style={{ padding: 10, fontSize: 12, cursor: "pointer", backgroundColor: "transparent", border: `1px solid ${T.border}`, color: T.textSub }}>
                キャンセル
              </button>
              <button onClick={submitSetup} disabled={setupSubmitting} style={{ padding: 10, fontSize: 12, cursor: setupSubmitting ? "wait" : "pointer", backgroundColor: T.accent, color: "#fff", border: "none", opacity: setupSubmitting ? 0.5 : 1 }}>
                {setupSubmitting ? "確認中..." : "接続&保存"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 解除確認 */}
      {disconnectTarget && (
        <div
          style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
          onClick={(e) => { if (e.target === e.currentTarget) setDisconnectTarget(null); }}
        >
          <div style={{ width: "100%", maxWidth: 360, backgroundColor: T.card, padding: 20, color: T.text }}>
            <p style={{ fontSize: 14, fontWeight: 500, marginBottom: 8, textAlign: "center" }}>🔌 {disconnectTarget.name} の連携解除</p>
            <p style={{ fontSize: 11, color: T.textMuted, marginBottom: 16, textAlign: "center", lineHeight: 1.6 }}>
              自動投稿が停止されます
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <button onClick={() => setDisconnectTarget(null)} style={{ padding: 10, fontSize: 12, cursor: "pointer", backgroundColor: "transparent", border: `1px solid ${T.border}`, color: T.textSub }}>
                キャンセル
              </button>
              <button onClick={submitDisconnect} style={{ padding: 10, fontSize: 12, cursor: "pointer", backgroundColor: "#c45555", color: "#fff", border: "none" }}>
                解除する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
