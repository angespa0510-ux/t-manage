"use client";
import { useEffect, useState } from "react";

export default function SmsBridgePage() {
  const [phone, setPhone] = useState("");
  const [body, setBody] = useState("");
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [copied, setCopied] = useState(true); // SMS②ボタンから来た時点でコピー済み
  const [phoneCopied, setPhoneCopied] = useState(false);
  const [showSteps, setShowSteps] = useState(false);

  useEffect(() => {
    try {
      const hash = window.location.hash.slice(1);
      const params = new URLSearchParams(hash);
      const p = params.get("phone") || "";
      const b = params.get("body") || "";
      if (!p) { setStatus("error"); return; }
      setPhone(p);
      setBody(b);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, []);

  const copyBody = async () => {
    try {
      await navigator.clipboard.writeText(body);
      setCopied(true);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = body;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
    }
  };

  const copyPhone = async () => {
    try {
      await navigator.clipboard.writeText(phone);
      setPhoneCopied(true);
      setTimeout(() => setPhoneCopied(false), 2000);
    } catch { /* ignore */ }
  };

  return (
    <div style={{
      minHeight: "100vh",
      backgroundColor: "#1a1a1e",
      color: "#e8e6e2",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "20px",
      fontFamily: "'Hiragino Sans', 'Yu Gothic', 'Meiryo', sans-serif",
    }}>
      <div style={{
        width: "100%",
        maxWidth: "480px",
        backgroundColor: "#25252b",
        borderRadius: "16px",
        border: "1px solid #3a3a42",
        overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{
          padding: "20px 24px 16px",
          borderBottom: "1px solid #3a3a42",
          display: "flex",
          alignItems: "center",
          gap: "10px",
        }}>
          <span style={{ fontSize: "24px" }}>📲</span>
          <div>
            <h1 style={{ fontSize: "16px", fontWeight: 600, margin: 0, color: "#e8e6e2" }}>
              SMS② Edge送信
            </h1>
            <p style={{ fontSize: "11px", color: "#6a6860", margin: 0 }}>
              T-MANAGE — Phone Link でSMS送信
            </p>
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: "20px 24px" }}>
          {status === "loading" && (
            <p style={{ textAlign: "center", color: "#9a9890", fontSize: "13px" }}>読み込み中...</p>
          )}

          {status === "error" && (
            <div style={{ textAlign: "center", padding: "20px" }}>
              <p style={{ fontSize: "32px", marginBottom: "12px" }}>⚠️</p>
              <p style={{ color: "#c45555", fontSize: "13px", fontWeight: 500 }}>パラメータが不正です</p>
              <p style={{ color: "#6a6860", fontSize: "11px", marginTop: "8px" }}>通知ポップアップからSMS②ボタンを押してください</p>
            </div>
          )}

          {status === "ready" && (
            <>
              {/* ===== コピー済みバッジ ===== */}
              <div style={{
                backgroundColor: "#8b5cf608",
                border: "1px solid #8b5cf633",
                borderRadius: "12px",
                padding: "12px 16px",
                textAlign: "center",
                marginBottom: "16px",
              }}>
                <p style={{ fontSize: "12px", color: "#8b5cf6", margin: 0, fontWeight: 600 }}>
                  ✅ メッセージはコピー済みです
                </p>
                <p style={{ fontSize: "10px", color: "#8b5cf688", margin: "4px 0 0" }}>
                  Phone Link を開いて貼り付けてください
                </p>
              </div>

              {/* ===== 電話番号（タップでコピー） ===== */}
              <button
                onClick={copyPhone}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  padding: "14px 16px",
                  backgroundColor: "#1e1e24",
                  borderRadius: "12px",
                  marginBottom: "10px",
                  border: "1px solid #3a3a42",
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                <span style={{ fontSize: "14px" }}>📞</span>
                <span style={{ fontSize: "18px", fontWeight: 700, color: "#c3a782", letterSpacing: "2px" }}>
                  {phone}
                </span>
                <span style={{ fontSize: "10px", color: phoneCopied ? "#22c55e" : "#6a6860", marginLeft: "4px" }}>
                  {phoneCopied ? "✅コピー" : "📋コピー"}
                </span>
              </button>

              {/* ===== 送信先ボタン ===== */}
              <div style={{ display: "flex", gap: "8px", marginBottom: "10px" }}>
                <a
                  href="https://messages.google.com/web/conversations/new"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    flex: 1,
                    display: "block",
                    padding: "14px 8px",
                    borderRadius: "12px",
                    border: "1px solid #4285f444",
                    backgroundColor: "#4285f418",
                    color: "#4285f4",
                    fontSize: "12px",
                    fontWeight: 600,
                    textAlign: "center",
                    textDecoration: "none",
                    boxSizing: "border-box",
                  }}
                >
                  💬 Googleメッセージ
                </a>
                <a
                  href={`sms:${phone}`}
                  style={{
                    flex: 1,
                    display: "block",
                    padding: "14px 8px",
                    borderRadius: "12px",
                    border: "1px solid #f59e0b44",
                    backgroundColor: "#f59e0b18",
                    color: "#f59e0b",
                    fontSize: "12px",
                    fontWeight: 600,
                    textAlign: "center",
                    textDecoration: "none",
                    boxSizing: "border-box",
                  }}
                >
                  📱 Phone Link
                </a>
              </div>
              <p style={{ fontSize: "9px", color: "#6a6860", textAlign: "center", margin: "0 0 12px" }}>
                新規メッセージ → 宛先に上の番号を入力 → Ctrl+V で貼り付け
              </p>

              {/* ===== メッセージ再コピーボタン ===== */}
              <button
                onClick={copyBody}
                style={{
                  width: "100%",
                  padding: "12px",
                  borderRadius: "12px",
                  border: "none",
                  backgroundColor: copied ? "#22c55e12" : "#1e1e24",
                  color: copied ? "#22c55e" : "#9a9890",
                  fontSize: "11px",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  transition: "all 0.2s",
                  marginBottom: "8px",
                }}
              >
                {copied ? "✅ メッセージコピー済み（タップで再コピー）" : "📋 メッセージをコピー"}
              </button>

              {/* ===== メッセージ内容（折りたたみ） ===== */}
              <details style={{ marginBottom: "12px" }}>
                <summary style={{ fontSize: "10px", color: "#6a6860", cursor: "pointer", padding: "8px 0" }}>
                  📄 メッセージ内容を確認
                </summary>
                <div style={{
                  backgroundColor: "#1e1e24",
                  borderRadius: "10px",
                  padding: "12px",
                  marginTop: "4px",
                  maxHeight: "250px",
                  overflowY: "auto",
                }}>
                  <pre style={{
                    fontSize: "10px",
                    color: "#9a9890",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-all",
                    lineHeight: 1.5,
                    margin: 0,
                    fontFamily: "inherit",
                  }}>
                    {body}
                  </pre>
                </div>
              </details>

              {/* ===== Phone Link 手順ガイド ===== */}
              <button
                onClick={() => setShowSteps(!showSteps)}
                style={{
                  width: "100%",
                  padding: "12px",
                  borderRadius: showSteps ? "12px 12px 0 0" : "12px",
                  border: "1px solid #3a3a42",
                  backgroundColor: "#1e1e24",
                  color: "#9a9890",
                  fontSize: "11px",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  textAlign: "left",
                }}
              >
                {showSteps ? "▼" : "▶"} 💡 SMS送信の手順
              </button>
              {showSteps && (
                <div style={{
                  padding: "14px 16px",
                  backgroundColor: "#1e1e24",
                  borderRadius: "0 0 12px 12px",
                  borderTop: "none",
                  border: "1px solid #3a3a42",
                  borderTopColor: "transparent",
                }}>
                  <div style={{ fontSize: "11px", color: "#9a9890", lineHeight: 1.8 }}>
                    <p style={{ margin: "0 0 8px", fontWeight: 600, color: "#4285f4" }}>💬 Googleメッセージで送る</p>
                    <p style={{ margin: 0 }}>
                      ① 「Googleメッセージ」ボタンをタップ<br />
                      ② 「チャットを開始」→ 宛先に <strong style={{ color: "#c3a782" }}>{phone}</strong> を入力<br />
                      ③ メッセージ欄で <strong style={{ color: "#e8e6e2" }}>Ctrl+V</strong> で貼り付け → 送信
                    </p>
                    <div style={{ height: "1px", backgroundColor: "#3a3a42", margin: "12px 0" }} />
                    <p style={{ margin: "0 0 8px", fontWeight: 600, color: "#f59e0b" }}>📱 Phone Link で送る</p>
                    <p style={{ margin: 0 }}>
                      ① タスクバーの Phone Link（📱）を開く<br />
                      ② メッセージ → 新しいメッセージ → 宛先に <strong style={{ color: "#c3a782" }}>{phone}</strong><br />
                      ③ <strong style={{ color: "#e8e6e2" }}>Ctrl+V</strong> で貼り付け → 送信
                    </p>
                    <p style={{ margin: "12px 0 0", fontSize: "10px", color: "#6a6860" }}>
                      💡 Windows設定 →「既定のアプリ」→ SMSの既定を Phone Link に変更すると「Phone Link」ボタンで直接起動できます
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <p style={{ fontSize: "9px", color: "#4a4a44", marginTop: "16px" }}>
        T-MANAGE SMS② Bridge — メッセージをコピーしてPhone Linkで送信
      </p>
    </div>
  );
}
