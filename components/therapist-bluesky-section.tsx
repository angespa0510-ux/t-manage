"use client";

import { useState, useEffect, useCallback } from "react";

/**
 * セラピストマイページ用 Bluesky連携セクション
 *
 * 機能:
 *   - 接続済みの場合: 状態表示 + 設定変更 + 解除
 *   - 未接続の場合: ハンドル + App Password 入力 → テスト&保存
 *   - 投稿履歴 (直近10件)
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

type Account = {
  handle: string;
  did: string | null;
  active: boolean;
  autoPostEnabled: boolean;
  includeImage: boolean;
  dailyPostLimit: number;
  postCountToday: number;
  lastCountResetDate: string | null;
  lastPostedAt: string | null;
  setupBy: string;
  lastTestStatus: string | null;
  lastTestAt: string | null;
  lastError: string | null;
};

type HistoryItem = {
  id: number;
  entryId: number;
  entryTitle: string;
  status: string;
  blueskyPostUrl: string | null;
  postedText: string | null;
  errorMessage: string | null;
  skipReason: string | null;
  postedAt: string | null;
  createdAt: string;
};

type Props = {
  therapistId: number;
  authToken: string;
  C: ColorTheme;
  FONT_SERIF: string;
  FONT_DISPLAY: string;
  FONT_SANS: string;
};

export default function TherapistBlueskySection({
  therapistId,
  authToken,
  C,
  FONT_SERIF,
  FONT_DISPLAY,
  FONT_SANS,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [account, setAccount] = useState<Account | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  const [showSetup, setShowSetup] = useState(false);
  const [handle, setHandle] = useState("");
  const [appPassword, setAppPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [showDisconnect, setShowDisconnect] = useState(false);

  // ════════════════════════════════════════════════════
  const fetchAccount = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/diary/bluesky/account?therapistId=${therapistId}&authToken=${encodeURIComponent(authToken)}`
      );
      const data = await res.json();
      if (res.ok) {
        if (data.connected) {
          setAccount(data.account);
        } else {
          setAccount(null);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [therapistId, authToken]);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch(`/api/diary/bluesky/history?therapistId=${therapistId}&limit=10`);
      const data = await res.json();
      if (res.ok) {
        setHistory(data.posts || []);
      }
    } catch (e) {
      console.error(e);
    }
  }, [therapistId]);

  useEffect(() => {
    fetchAccount();
    fetchHistory();
  }, [fetchAccount, fetchHistory]);

  // ════════════════════════════════════════════════════
  const submitConnect = async () => {
    setErrorMsg(null);
    setHint(null);
    if (!handle.trim() || !appPassword.trim()) {
      setErrorMsg("ハンドルとApp Passwordを入力してください");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/diary/bluesky/account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          therapistId,
          authToken,
          handle: handle.trim(),
          appPassword: appPassword.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "接続失敗");
        if (data.hint) setHint(data.hint);
      } else {
        setSuccessMsg(`✨ ${data.handle} と連携しました!`);
        setHandle("");
        setAppPassword("");
        setShowSetup(false);
        await fetchAccount();
        await fetchHistory();
        setTimeout(() => setSuccessMsg(null), 4000);
      }
    } catch {
      setErrorMsg("通信エラー");
    } finally {
      setSubmitting(false);
    }
  };

  const updateSetting = async (
    key: "autoPostEnabled" | "includeImage" | "active",
    value: boolean
  ) => {
    try {
      await fetch("/api/diary/bluesky/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ therapistId, authToken, [key]: value }),
      });
      await fetchAccount();
    } catch (e) {
      console.error(e);
    }
  };

  const disconnect = async () => {
    try {
      const res = await fetch("/api/diary/bluesky/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ therapistId, authToken }),
      });
      if (res.ok) {
        setSuccessMsg("Bluesky連携を解除しました");
        setShowDisconnect(false);
        await fetchAccount();
        setTimeout(() => setSuccessMsg(null), 3000);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // ════════════════════════════════════════════════════
  const fmtDateTime = (iso: string | null) => {
    if (!iso) return "—";
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  // ════════════════════════════════════════════════════
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, fontFamily: FONT_SERIF }}>
      {/* セクション見出し */}
      <div style={{ textAlign: "center", marginBottom: 4 }}>
        <p style={{ fontFamily: FONT_DISPLAY, fontSize: 11, letterSpacing: "0.25em", color: C.accent, marginBottom: 6, fontWeight: 500 }}>
          BLUESKY
        </p>
        <p style={{ fontFamily: FONT_SERIF, fontSize: 13, letterSpacing: "0.08em", color: C.text, fontWeight: 500, marginBottom: 8 }}>
          🦋 Bluesky 自動投稿
          {account?.autoPostEnabled && account?.active && (
            <span style={{ marginLeft: 8, fontSize: 10, padding: "2px 8px", backgroundColor: "#6b9b7e", color: "#fff", verticalAlign: "middle" }}>
              連携中
            </span>
          )}
        </p>
        <div style={{ width: 24, height: 1, backgroundColor: C.accent, margin: "0 auto" }} />
      </div>

      {successMsg && (
        <div style={{ padding: 10, backgroundColor: "#f0f7f1", border: `1px solid #6b9b7e`, fontSize: 11, color: "#3d6149", textAlign: "center" }}>
          {successMsg}
        </div>
      )}

      {loading ? (
        <p style={{ textAlign: "center", padding: 20, color: C.textMuted, fontSize: 11 }}>読み込み中...</p>
      ) : !account ? (
        // ─────────── 未連携 ───────────
        showSetup ? (
          <div style={{ padding: 14, backgroundColor: C.card, border: `1px solid ${C.border}` }}>
            <p style={{ fontSize: 11, color: C.textSub, marginBottom: 12, lineHeight: 1.7 }}>
              Blueskyの<strong style={{ color: C.text }}>ハンドル</strong>と<strong style={{ color: C.text }}>App Password</strong>を入力してください。
              <br />
              ※ App Password は通常のログインパスワードではなく、専用に発行するものです (Blueskyアプリの「設定 → プライバシーとセキュリティ → アプリパスワード」で発行)。
            </p>

            <div style={{ marginBottom: 10 }}>
              <p style={{ fontSize: 10, color: C.textSub, marginBottom: 4, fontFamily: FONT_DISPLAY, letterSpacing: "0.1em" }}>HANDLE</p>
              <input
                type="text"
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                placeholder="例: yume.bsky.social"
                style={{ width: "100%", padding: "10px 12px", fontSize: 12, border: `1px solid ${C.border}`, backgroundColor: C.bg, color: C.text, fontFamily: FONT_SERIF, outline: "none" }}
              />
            </div>

            <div style={{ marginBottom: 10 }}>
              <p style={{ fontSize: 10, color: C.textSub, marginBottom: 4, fontFamily: FONT_DISPLAY, letterSpacing: "0.1em" }}>APP PASSWORD</p>
              <input
                type="password"
                value={appPassword}
                onChange={(e) => setAppPassword(e.target.value)}
                placeholder="xxxx-xxxx-xxxx-xxxx"
                style={{ width: "100%", padding: "10px 12px", fontSize: 12, border: `1px solid ${C.border}`, backgroundColor: C.bg, color: C.text, fontFamily: FONT_SERIF, outline: "none" }}
              />
            </div>

            {errorMsg && (
              <div style={{ padding: 8, backgroundColor: "#fef2f2", border: `1px solid #c45555`, fontSize: 11, color: "#7a2929", marginBottom: 10 }}>
                {errorMsg}
                {hint && <p style={{ fontSize: 10, marginTop: 4, color: "#5a3535" }}>{hint}</p>}
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <button
                onClick={() => { setShowSetup(false); setErrorMsg(null); setHint(null); }}
                style={{ padding: "10px", fontSize: 12, cursor: "pointer", backgroundColor: "transparent", border: `1px solid ${C.border}`, color: C.textSub, fontFamily: FONT_SERIF }}
              >
                キャンセル
              </button>
              <button
                onClick={submitConnect}
                disabled={submitting}
                style={{
                  padding: "10px",
                  fontSize: 12,
                  cursor: submitting ? "wait" : "pointer",
                  backgroundColor: C.accent,
                  color: "#fff",
                  border: "none",
                  fontFamily: FONT_SERIF,
                  letterSpacing: "0.08em",
                  fontWeight: 500,
                  opacity: submitting ? 0.5 : 1,
                }}
              >
                {submitting ? "確認中..." : "接続テスト&保存"}
              </button>
            </div>
          </div>
        ) : (
          <div style={{ padding: 14, backgroundColor: C.card, border: `1px dashed ${C.border}` }}>
            <p style={{ fontSize: 12, color: C.textSub, marginBottom: 6, lineHeight: 1.7 }}>
              🦋 Blueskyと連携すると、新しい日記を投稿したときに自動で
              <br />
              「タイトル + HPリンク」がBlueskyにも投稿されます。
            </p>
            <p style={{ fontSize: 10, color: C.textMuted, marginBottom: 10, lineHeight: 1.5 }}>
              本文は転載しないので、安心して使えます。1日3回までの自動投稿で頻度も控えめです。
            </p>
            <button
              onClick={() => setShowSetup(true)}
              style={{
                width: "100%",
                padding: "10px",
                fontSize: 12,
                cursor: "pointer",
                backgroundColor: "transparent",
                color: C.accent,
                border: `1px solid ${C.accent}`,
                fontFamily: FONT_SERIF,
                letterSpacing: "0.1em",
                fontWeight: 500,
              }}
            >
              🦋 Bluesky と連携する
            </button>
          </div>
        )
      ) : (
        // ─────────── 連携済み ───────────
        <>
          <div style={{ padding: 14, backgroundColor: C.card, border: `1px solid ${C.border}`, display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <p style={{ fontSize: 11, color: C.textMuted, fontFamily: FONT_DISPLAY, letterSpacing: "0.1em" }}>HANDLE</p>
                <p style={{ fontSize: 13, color: C.text, fontWeight: 500 }}>@{account.handle}</p>
              </div>
              <a
                href={`https://bsky.app/profile/${account.handle}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: 10, color: C.accent, textDecoration: "none", fontFamily: FONT_SERIF }}
              >
                プロフィールを見る ↗
              </a>
            </div>

            {/* 今日の投稿数 */}
            <div style={{ padding: 8, backgroundColor: C.cardAlt, fontSize: 11, color: C.textSub, fontFamily: FONT_SERIF }}>
              📊 今日の投稿数: <span style={{ color: account.postCountToday >= account.dailyPostLimit ? "#c45555" : C.text, fontWeight: 500 }}>{account.postCountToday} / {account.dailyPostLimit}</span>
            </div>

            {/* スイッチ */}
            <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={account.autoPostEnabled}
                onChange={(e) => updateSetting("autoPostEnabled", e.target.checked)}
              />
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 11, color: C.text, fontWeight: 500 }}>新しい日記を自動投稿する</p>
                <p style={{ fontSize: 9, color: C.textMuted }}>OFFにすると当面の自動投稿を停止できます</p>
              </div>
            </label>

            <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={account.includeImage}
                onChange={(e) => updateSetting("includeImage", e.target.checked)}
              />
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 11, color: C.text, fontWeight: 500 }}>カバー画像を添付する</p>
                <p style={{ fontSize: 9, color: C.textMuted }}>OFFにするとテキストのみの投稿になります</p>
              </div>
            </label>

            {account.lastError && (
              <div style={{ padding: 8, backgroundColor: "#fef2f2", border: `1px solid #c45555`, fontSize: 10, color: "#7a2929" }}>
                ⚠ 直近のエラー: {account.lastError}
              </div>
            )}

            <button
              onClick={() => setShowDisconnect(true)}
              style={{ alignSelf: "flex-end", padding: "5px 12px", fontSize: 10, cursor: "pointer", backgroundColor: "transparent", color: C.textMuted, border: `1px solid ${C.border}`, fontFamily: FONT_SERIF }}
            >
              🔌 連携を解除
            </button>
          </div>

          {/* 投稿履歴 */}
          {history.length > 0 && (
            <div>
              <p style={{ fontSize: 10, color: C.textSub, marginBottom: 8, fontFamily: FONT_DISPLAY, letterSpacing: "0.1em" }}>
                📜 投稿履歴 (直近{history.length}件)
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {history.map((h) => (
                  <div
                    key={h.id}
                    style={{
                      padding: 10,
                      backgroundColor: C.card,
                      border: `1px solid ${C.border}`,
                      fontSize: 10,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                      <span style={{ fontSize: 9, padding: "2px 6px", backgroundColor: h.status === "posted" ? "#6b9b7e" : h.status === "skipped" ? "#888" : "#c45555", color: "#fff", fontFamily: FONT_DISPLAY, letterSpacing: "0.05em" }}>
                        {h.status === "posted" ? "投稿済" : h.status === "skipped" ? "スキップ" : "失敗"}
                      </span>
                      <span style={{ color: C.textMuted, fontFamily: FONT_DISPLAY }}>{fmtDateTime(h.createdAt)}</span>
                    </div>
                    <p style={{ color: C.text, marginBottom: 2, lineHeight: 1.5 }}>{h.entryTitle}</p>
                    {h.status === "posted" && h.blueskyPostUrl && (
                      <a
                        href={h.blueskyPostUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: C.accent, fontSize: 10, textDecoration: "none" }}
                      >
                        Blueskyで開く ↗
                      </a>
                    )}
                    {h.status === "skipped" && h.skipReason && (
                      <p style={{ color: C.textMuted, fontSize: 9 }}>
                        理由: {h.skipReason === "daily_limit" ? "1日の上限に到達" : h.skipReason === "auto_disabled" ? "自動投稿OFF" : h.skipReason === "not_public" ? "会員限定記事" : h.skipReason === "no_account" ? "アカウント未連携" : h.skipReason}
                      </p>
                    )}
                    {h.status === "failed" && h.errorMessage && (
                      <p style={{ color: "#c45555", fontSize: 9 }}>{h.errorMessage}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* 解除確認 */}
      {showDisconnect && (
        <div
          style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowDisconnect(false); }}
        >
          <div style={{ width: "100%", maxWidth: 360, backgroundColor: C.card, padding: 20, fontFamily: FONT_SERIF }}>
            <p style={{ fontSize: 14, color: C.text, fontWeight: 500, marginBottom: 8, textAlign: "center" }}>🔌 Bluesky連携を解除しますか?</p>
            <p style={{ fontSize: 11, color: C.textMuted, marginBottom: 16, textAlign: "center", lineHeight: 1.6 }}>
              自動投稿が停止されます。再度連携には接続情報の入力が必要です。
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <button onClick={() => setShowDisconnect(false)} style={{ padding: 12, fontSize: 12, cursor: "pointer", backgroundColor: "transparent", border: `1px solid ${C.border}`, color: C.textSub, fontFamily: FONT_SERIF }}>
                キャンセル
              </button>
              <button onClick={disconnect} style={{ padding: 12, fontSize: 12, cursor: "pointer", backgroundColor: "#c45555", color: "#fff", border: "none", fontFamily: FONT_SERIF, fontWeight: 500 }}>
                解除する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
