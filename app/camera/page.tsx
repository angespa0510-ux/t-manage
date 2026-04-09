"use client";

import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";
import { useTheme } from "../../lib/theme";
import { NavMenu } from "../../lib/nav-menu";

export default function CameraPage() {
  const router = useRouter();
  const { dark, toggle, T } = useTheme();

  const [cfTunnelUrl, setCfTunnelUrl] = useState("");
  const [camName, setCamName] = useState("カメラ");
  const [sbToken, setSbToken] = useState("");
  const [sbSecret, setSbSecret] = useState("");
  const [sbLockId, setSbLockId] = useState("");
  const [sbLockName, setSbLockName] = useState("スマートロック");
  const [gdriveFolder, setGdriveFolder] = useState("");

  const [lockStatus, setLockStatus] = useState<"locked" | "unlocked" | "unknown">("unknown");
  const [lockLoading, setLockLoading] = useState(false);
  const [lockMsg, setLockMsg] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [streamLoaded, setStreamLoaded] = useState(false);

  useEffect(() => {
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) router.push("/");
    };
    check();
    loadSettings();
  }, [router]);

  const loadSettings = async () => {
    const keys = ["iot_cf_tunnel_url", "iot_cam_name", "iot_sb_token", "iot_sb_secret", "iot_sb_lock_id", "iot_sb_lock_name", "iot_gdrive_folder"];
    const { data } = await supabase.from("store_settings").select("key,value").in("key", keys);
    if (data) {
      for (const s of data) {
        if (s.key === "iot_cf_tunnel_url") setCfTunnelUrl(s.value);
        if (s.key === "iot_cam_name") setCamName(s.value || "カメラ");
        if (s.key === "iot_sb_token") setSbToken(s.value);
        if (s.key === "iot_sb_secret") setSbSecret(s.value);
        if (s.key === "iot_sb_lock_id") setSbLockId(s.value);
        if (s.key === "iot_sb_lock_name") setSbLockName(s.value || "スマートロック");
        if (s.key === "iot_gdrive_folder") setGdriveFolder(s.value);
      }
    }
  };

  // SwitchBot API call helper (v1.1 requires HMAC signature)
  const callSwitchBotApi = async (action: "lock" | "unlock") => {
    if (!sbToken || !sbLockId) return;
    setLockLoading(true);
    setLockMsg("");

    try {
      const t = Date.now().toString();
      const nonce = crypto.randomUUID();

      // v1.1 requires HMAC-SHA256 signature
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey("raw", encoder.encode(sbSecret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
      const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(sbToken + t + nonce));
      const sign = btoa(String.fromCharCode(...new Uint8Array(signature)));

      const res = await fetch(`https://api.switch-bot.com/v1.1/devices/${sbLockId}/commands`, {
        method: "POST",
        headers: {
          "Authorization": sbToken,
          "sign": sign,
          "nonce": nonce,
          "t": t,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          command: action,
          parameter: "default",
          commandType: "command",
        }),
      });

      const result = await res.json();
      if (result.statusCode === 100) {
        setLockStatus(action === "lock" ? "locked" : "unlocked");
        setLockMsg(action === "lock" ? "🔒 施錠しました" : "🔓 解錠しました");

        // Log to Supabase
        await supabase.from("iot_logs").insert({
          device_type: "lock",
          device_id: sbLockId,
          action: action,
          result: "success",
          detail: JSON.stringify(result),
        });
      } else {
        setLockMsg(`⚠️ エラー: ${result.message || "不明なエラー"}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "通信エラー";
      setLockMsg(`❌ ${msg}`);
    } finally {
      setLockLoading(false);
      setTimeout(() => setLockMsg(""), 5000);
    }
  };

  const streamUrl = cfTunnelUrl ? `${cfTunnelUrl.replace(/\/$/, "")}/stream.html?src=shop_camera` : "";

  return (
    <div style={{ minHeight: "100vh", backgroundColor: T.bg, color: T.text }}>
      {/* Header */}
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: `1px solid ${T.border}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <NavMenu T={T} />
          <h1 style={{ fontSize: 16, fontWeight: 700 }}>📺 カメラ・ロック管理</h1>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => router.push("/iot-settings")} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer" }}>⚙️</button>
          <button onClick={toggle} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer" }}>{dark ? "☀️" : "🌙"}</button>
        </div>
      </header>

      <div style={{ padding: "12px 16px 80px" }}>

        {/* ── カメラ映像 ── */}
        <div style={{ borderRadius: 12, overflow: "hidden", backgroundColor: "#000", marginBottom: 12, position: "relative" }}>
          {cfTunnelUrl ? (
            <>
              <iframe
                src={streamUrl}
                style={{ width: "100%", height: "min(56.25vw, 400px)", border: "none", display: streamLoaded ? "block" : "none" }}
                onLoad={() => setStreamLoaded(true)}
                allow="autoplay"
              />
              {!streamLoaded && (
                <div style={{ width: "100%", height: "min(56.25vw, 400px)", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 8 }}>
                  <div style={{ width: 40, height: 40, border: "3px solid rgba(195,167,130,0.3)", borderTop: "3px solid #c3a782", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
                  <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 12 }}>映像を読み込み中...</p>
                </div>
              )}
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </>
          ) : (
            <div style={{ width: "100%", height: 250, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12, padding: 24 }}>
              <span style={{ fontSize: 48, opacity: 0.3 }}>📷</span>
              <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 14, textAlign: "center" }}>カメラ映像を表示するには<br />IoT設定でCloudflare Tunnel URLを入力してください</p>
              <button onClick={() => router.push("/iot-settings")} style={{
                padding: "8px 20px", borderRadius: 8, border: "none", cursor: "pointer",
                background: "linear-gradient(135deg, #c3a782, #a8895e)", color: "#fff", fontSize: 13, fontWeight: 600,
              }}>
                ⚙️ IoT設定を開く
              </button>
            </div>
          )}
        </div>

        {/* カメラ名 + 録画ボタン */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: cfTunnelUrl ? "#4caf50" : "#666" }} />
            <span style={{ fontSize: 14, fontWeight: 600 }}>{camName}</span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => setIsRecording(!isRecording)}
              disabled={!cfTunnelUrl}
              style={{
                padding: "6px 14px", borderRadius: 20, border: "none", cursor: cfTunnelUrl ? "pointer" : "not-allowed",
                backgroundColor: isRecording ? "#f44336" : (dark ? "#2a2a3e" : "#f0f0f0"),
                color: isRecording ? "#fff" : T.textSub, fontSize: 12, fontWeight: 600,
                display: "flex", alignItems: "center", gap: 4,
              }}
            >
              {isRecording ? "⏹ 録画停止" : "⏺ 録画開始"}
            </button>
            {gdriveFolder && (
              <a href={gdriveFolder} target="_blank" rel="noopener noreferrer" style={{
                padding: "6px 14px", borderRadius: 20, border: "none", cursor: "pointer",
                backgroundColor: dark ? "#2a2a3e" : "#f0f0f0", color: T.textSub, fontSize: 12, fontWeight: 600,
                textDecoration: "none", display: "flex", alignItems: "center", gap: 4,
              }}>
                📁 録画一覧
              </a>
            )}
          </div>
        </div>

        {/* ── スマートロック操作 ── */}
        <div style={{ padding: 16, borderRadius: 12, backgroundColor: T.card, marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700 }}>🔐 {sbLockName}</h3>
            <div style={{
              padding: "4px 12px", borderRadius: 12, fontSize: 11, fontWeight: 600,
              backgroundColor: lockStatus === "locked" ? "rgba(76,175,80,0.1)" : lockStatus === "unlocked" ? "rgba(244,67,54,0.1)" : "rgba(158,158,158,0.1)",
              color: lockStatus === "locked" ? "#4caf50" : lockStatus === "unlocked" ? "#f44336" : "#999",
            }}>
              {lockStatus === "locked" ? "🔒 施錠中" : lockStatus === "unlocked" ? "🔓 解錠中" : "❓ 不明"}
            </div>
          </div>

          {sbToken && sbLockId ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <button
                onClick={() => callSwitchBotApi("unlock")}
                disabled={lockLoading}
                style={{
                  padding: "14px", borderRadius: 10, border: "none", cursor: lockLoading ? "wait" : "pointer",
                  background: "linear-gradient(135deg, #4caf50, #388e3c)", color: "#fff",
                  fontSize: 15, fontWeight: 700, opacity: lockLoading ? 0.6 : 1,
                }}
              >
                🔓 解錠
              </button>
              <button
                onClick={() => callSwitchBotApi("lock")}
                disabled={lockLoading}
                style={{
                  padding: "14px", borderRadius: 10, border: "none", cursor: lockLoading ? "wait" : "pointer",
                  background: "linear-gradient(135deg, #f44336, #d32f2f)", color: "#fff",
                  fontSize: 15, fontWeight: 700, opacity: lockLoading ? 0.6 : 1,
                }}
              >
                🔒 施錠
              </button>
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: 16 }}>
              <p style={{ fontSize: 12, color: T.textSub, marginBottom: 8 }}>SwitchBot APIの設定が必要です</p>
              <button onClick={() => router.push("/iot-settings")} style={{
                padding: "8px 20px", borderRadius: 8, border: "none", cursor: "pointer",
                background: "linear-gradient(135deg, #c3a782, #a8895e)", color: "#fff", fontSize: 13, fontWeight: 600,
              }}>
                ⚙️ IoT設定を開く
              </button>
            </div>
          )}

          {lockMsg && (
            <p style={{ textAlign: "center", fontSize: 13, marginTop: 10, fontWeight: 600, color: lockMsg.includes("⚠️") || lockMsg.includes("❌") ? "#f44336" : "#4caf50" }}>
              {lockMsg}
            </p>
          )}
        </div>

        {/* ── 操作ログ ── */}
        <div style={{ padding: 16, borderRadius: 12, backgroundColor: T.card }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>📋 最近の操作ログ</h3>
          <p style={{ fontSize: 12, color: T.textSub, textAlign: "center", padding: 16 }}>
            ロック操作を行うと、ここに履歴が表示されます
          </p>
        </div>
      </div>
    </div>
  );
}
