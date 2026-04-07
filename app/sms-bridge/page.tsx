"use client";
import { useEffect, useState, useCallback } from "react";

export default function SmsBridgePage() {
  const [phone, setPhone] = useState("");
  const [body, setBody] = useState("");
  const [status, setStatus] = useState<"loading" | "ready" | "sent" | "error">("loading");
  const [copied, setCopied] = useState(false);
  const [autoTriggered, setAutoTriggered] = useState(false);

  useEffect(() => {
    try {
      const hash = window.location.hash.slice(1);
      const params = new URLSearchParams(hash);
      const p = params.get("phone") || "";
      const b = params.get("body") || "";
      if (!p) { setStatus("error"); return; }
      setPhone(p);
      setBody(decodeURIComponent(b));
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, []);

  // Auto-trigger sms: protocol on ready
  useEffect(() => {
    if (status === "ready" && phone && !autoTriggered) {
      setAutoTriggered(true);
      // Small delay so user sees the UI
      const timer = setTimeout(() => {
        triggerSms();
      }, 800);
      return () => clearTimeout(timer);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, phone, autoTriggered]);

  const triggerSms = useCallback(() => {
    const smsUrl = `sms:${phone}?body=${encodeURIComponent(body)}`;
    window.location.href = smsUrl;
    setStatus("sent");
  }, [phone, body]);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(body);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const ta = document.createElement("textarea");
      ta.value = body;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
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
          <span style={{ fontSize: "24px" }}>📱</span>
          <div>
            <h1 style={{ fontSize: "16px", fontWeight: 600, margin: 0, color: "#e8e6e2" }}>
              SMS送信ブリッジ
            </h1>
            <p style={{ fontSize: "11px", color: "#6a6860", margin: 0 }}>
              T-MANAGE — Edge経由SMS送信
            </p>
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: "20px 24px" }}>
          {status === "loading" && (
            <p style={{ textAlign: "center", color: "#9a9890", fontSize: "13px" }}>
              読み込み中...
            </p>
          )}

          {status === "error" && (
            <div style={{
              textAlign: "center",
              padding: "20px",
            }}>
              <p style={{ fontSize: "32px", marginBottom: "12px" }}>⚠️</p>
              <p style={{ color: "#c45555", fontSize: "13px", fontWeight: 500 }}>
                パラメータが不正です
              </p>
              <p style={{ color: "#6a6860", fontSize: "11px", marginTop: "8px" }}>
                通知ポップアップからSMS②ボタンを押してください
              </p>
            </div>
          )}

          {(status === "ready" || status === "sent") && (
            <>
              {/* Phone number */}
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "12px 16px",
                backgroundColor: "#1e1e24",
                borderRadius: "12px",
                marginBottom: "12px",
              }}>
                <span style={{ fontSize: "14px" }}>📞</span>
                <span style={{ fontSize: "15px", fontWeight: 600, color: "#c3a782", letterSpacing: "1px" }}>
                  {phone}
                </span>
              </div>

              {/* Message preview */}
              <div style={{
                backgroundColor: "#1e1e24",
                borderRadius: "12px",
                padding: "16px",
                marginBottom: "16px",
                maxHeight: "300px",
                overflowY: "auto",
              }}>
                <p style={{
                  fontSize: "10px",
                  color: "#6a6860",
                  marginBottom: "8px",
                  fontWeight: 500,
                }}>
                  メッセージ内容
                </p>
                <pre style={{
                  fontSize: "11px",
                  color: "#9a9890",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-all",
                  lineHeight: 1.6,
                  margin: 0,
                  fontFamily: "inherit",
                }}>
                  {body}
                </pre>
              </div>

              {/* Status message */}
              {status === "sent" && (
                <div style={{
                  padding: "10px 16px",
                  backgroundColor: "#22c55e12",
                  border: "1px solid #22c55e33",
                  borderRadius: "10px",
                  marginBottom: "12px",
                  textAlign: "center",
                }}>
                  <p style={{ fontSize: "11px", color: "#22c55e", margin: 0 }}>
                    ✅ SMS送信画面を起動しました
                  </p>
                  <p style={{ fontSize: "10px", color: "#22c55e88", margin: "4px 0 0", lineHeight: 1.4 }}>
                    Phone Linkアプリが開かない場合は下のボタンから再試行してください
                  </p>
                </div>
              )}

              {/* Action buttons */}
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <button
                  onClick={triggerSms}
                  style={{
                    width: "100%",
                    padding: "14px",
                    borderRadius: "12px",
                    border: "1px solid #f59e0b44",
                    backgroundColor: "#f59e0b18",
                    color: "#f59e0b",
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  📱 SMSアプリを起動する
                </button>

                <button
                  onClick={copyToClipboard}
                  style={{
                    width: "100%",
                    padding: "12px",
                    borderRadius: "12px",
                    border: "none",
                    backgroundColor: "#1e1e24",
                    color: copied ? "#22c55e" : "#9a9890",
                    fontSize: "11px",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    transition: "color 0.2s",
                  }}
                >
                  {copied ? "✅ コピーしました！" : "📋 メッセージをコピー"}
                </button>
              </div>

              {/* Help text */}
              <div style={{
                marginTop: "16px",
                padding: "12px",
                backgroundColor: "#1e1e24",
                borderRadius: "10px",
              }}>
                <p style={{ fontSize: "10px", color: "#6a6860", margin: 0, lineHeight: 1.6 }}>
                  💡 <strong style={{ color: "#9a9890" }}>SMSが送れない場合</strong><br />
                  ① Windows設定 → Phone Link が有効か確認<br />
                  ② 「メッセージをコピー」→ メッセージアプリに手動貼り付け<br />
                  ③ SMS①（コピー方式）に切り替えてください
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Footer */}
      <p style={{ fontSize: "9px", color: "#4a4a44", marginTop: "16px" }}>
        T-MANAGE SMS Bridge — このページは自動的にSMSアプリを起動します
      </p>
    </div>
  );
}
