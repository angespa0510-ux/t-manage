"use client";

import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

const FONT_SERIF = "'Noto Serif JP', 'Yu Mincho', 'Hiragino Mincho ProN', serif";
const FONT_DISPLAY = "'Cormorant Garamond', 'Noto Serif JP', 'Yu Mincho', serif";

const MARBLE_BG = {
  background: `
    radial-gradient(at 20% 15%, rgba(232,132,154,0.10) 0, transparent 50%),
    radial-gradient(at 85% 20%, rgba(196,162,138,0.08) 0, transparent 50%),
    radial-gradient(at 40% 85%, rgba(247,227,231,0.6) 0, transparent 50%),
    linear-gradient(180deg, #fbf7f3 0%, #f8f2ec 100%)
  `,
};

function ConfirmContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<"loading" | "success" | "error" | "already">("loading");
  const [name, setName] = useState("");

  useEffect(() => {
    const verify = async () => {
      if (!token) { setStatus("error"); return; }
      const { data } = await supabase.from("therapists").select("id, name, email_verified").eq("email_token", token).maybeSingle();
      if (!data) { setStatus("error"); return; }
      if (data.email_verified) { setName(data.name); setStatus("already"); return; }
      await supabase.from("therapists").update({ email_verified: true }).eq("id", data.id);
      setName(data.name);
      setStatus("success");
    };
    verify();
  }, [token]);

  const iconBg =
    status === "success" || status === "already" ? "rgba(107,155,126,0.12)"
    : status === "error" ? "rgba(201,107,131,0.12)"
    : "rgba(232,132,154,0.12)";
  const iconBorder =
    status === "success" || status === "already" ? "#6b9b7e"
    : status === "error" ? "#c96b83"
    : "#e8849a";

  const englishLabel =
    status === "loading" ? "VERIFYING"
    : status === "success" ? "VERIFIED"
    : status === "already" ? "ALREADY VERIFIED"
    : "ERROR";

  return (
    <div style={{ minHeight: "100vh", ...MARBLE_BG, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: FONT_SERIF, color: "#2b2b2b" }}>
      <div style={{ width: "100%", maxWidth: 400, padding: "40px 32px", backgroundColor: "#ffffff", border: "1px solid #e5ded6", textAlign: "center" }}>
        {/* 装飾細線 */}
        <div style={{ width: 1, height: 28, backgroundColor: "#e8849a", margin: "0 auto 18px" }} />

        {/* アイコン円 */}
        <div style={{ width: 64, height: 64, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 18px", backgroundColor: iconBg, border: `1px solid ${iconBorder}44` }}>
          <span style={{ fontSize: 26 }}>
            {status === "loading" ? "⏳" : status === "success" ? "✅" : status === "already" ? "✅" : "❌"}
          </span>
        </div>

        {/* 英文ラベル */}
        <p style={{ margin: 0, fontFamily: FONT_DISPLAY, fontSize: 11, letterSpacing: "0.3em", color: iconBorder, fontWeight: 500 }}>{englishLabel}</p>

        {/* 和文メッセージ */}
        {status === "loading" && (
          <>
            <h1 style={{ margin: "8px 0 6px", fontSize: 17, fontWeight: 500, letterSpacing: "0.1em", color: "#2b2b2b" }}>確認中…</h1>
            <div style={{ width: 24, height: 1, backgroundColor: "#e8849a", margin: "0 auto 10px" }} />
            <p style={{ margin: 0, fontSize: 12, color: "#8a8a8a", letterSpacing: "0.08em" }}>少々お待ちください</p>
          </>
        )}
        {status === "success" && (
          <>
            <h1 style={{ margin: "8px 0 6px", fontSize: 17, fontWeight: 500, letterSpacing: "0.1em", color: "#2b2b2b" }}>確認完了</h1>
            <div style={{ width: 24, height: 1, backgroundColor: "#6b9b7e", margin: "0 auto 10px" }} />
            <p style={{ margin: 0, fontSize: 12, color: "#555555", letterSpacing: "0.05em", lineHeight: 1.9 }}>{name} 様のメールアドレスが<br />確認されました</p>
            <p style={{ margin: "14px 0 0", fontSize: 11, color: "#b5b5b5", letterSpacing: "0.08em" }}>このページを閉じてください</p>
          </>
        )}
        {status === "already" && (
          <>
            <h1 style={{ margin: "8px 0 6px", fontSize: 17, fontWeight: 500, letterSpacing: "0.1em", color: "#2b2b2b" }}>確認済みです</h1>
            <div style={{ width: 24, height: 1, backgroundColor: "#6b9b7e", margin: "0 auto 10px" }} />
            <p style={{ margin: 0, fontSize: 12, color: "#555555", letterSpacing: "0.05em", lineHeight: 1.9 }}>{name} 様のメールアドレスは<br />既に確認されています</p>
          </>
        )}
        {status === "error" && (
          <>
            <h1 style={{ margin: "8px 0 6px", fontSize: 17, fontWeight: 500, letterSpacing: "0.1em", color: "#2b2b2b" }}>確認できませんでした</h1>
            <div style={{ width: 24, height: 1, backgroundColor: "#c96b83", margin: "0 auto 10px" }} />
            <p style={{ margin: 0, fontSize: 12, color: "#555555", letterSpacing: "0.05em", lineHeight: 1.9 }}>リンクが無効か、<br />期限が切れている可能性があります</p>
          </>
        )}

        {/* フッター */}
        <div style={{ marginTop: 28, paddingTop: 20, borderTop: "1px solid #e5ded6" }}>
          <p style={{ margin: 0, fontFamily: FONT_DISPLAY, fontSize: 10, letterSpacing: "0.3em", color: "#8a8a8a", fontWeight: 500 }}>ANGE SPA</p>
          <p style={{ margin: "3px 0 0", fontSize: 10, color: "#b5b5b5", letterSpacing: "0.1em" }}>Ange Spa salon management</p>
        </div>
      </div>
    </div>
  );
}

export default function ConfirmEmailPage() {
  return (
    <Suspense
      fallback={
        <div style={{ minHeight: "100vh", ...MARBLE_BG, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT_SERIF }}>
          <p style={{ fontSize: 12, color: "#8a8a8a", letterSpacing: "0.15em" }}>読み込み中…</p>
        </div>
      }
    >
      <ConfirmContent />
    </Suspense>
  );
}
