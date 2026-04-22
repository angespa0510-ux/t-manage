"use client";

import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";

const FONT_SERIF = "'Noto Serif JP', 'Yu Mincho', 'Hiragino Mincho ProN', serif";
const FONT_DISPLAY = "'Cormorant Garamond', 'Noto Serif JP', 'Yu Mincho', serif";
const FONT_SANS = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif";

const MARBLE_BG = {
  background: `
    radial-gradient(at 20% 15%, rgba(232,132,154,0.10) 0, transparent 50%),
    radial-gradient(at 85% 20%, rgba(196,162,138,0.08) 0, transparent 50%),
    radial-gradient(at 40% 85%, rgba(247,227,231,0.6) 0, transparent 50%),
    linear-gradient(180deg, #fbf7f3 0%, #f8f2ec 100%)
  `,
};

export default function StaffLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // PWA 起動時の自動リダイレクト
  useEffect(() => {
    if (typeof window === "undefined") return;

    type IosWindow = Window & { navigator: Navigator & { standalone?: boolean } };
    const isStandalone =
      (window as IosWindow).navigator.standalone === true ||
      window.matchMedia?.("(display-mode: standalone)").matches;

    if (!isStandalone) return;

    try {
      const therapistSession = localStorage.getItem("therapist_session");
      if (therapistSession) {
        router.replace("/mypage");
        return;
      }
      const customerId = localStorage.getItem("customer_mypage_id");
      if (customerId) {
        router.replace("/customer-mypage");
        return;
      }
      const staffSession = sessionStorage.getItem("t-manage-staff");
      if (staffSession) {
        router.replace("/dashboard");
        return;
      }
    } catch {
      // ignore
    }
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (authError) {
      setError("メールアドレスまたはパスワードが正しくありません");
    } else if (data.user) {
      router.push("/dashboard");
    }
  };

  return (
    <div style={{ minHeight: "100vh", ...MARBLE_BG, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px 16px", fontFamily: FONT_SERIF, color: "#2b2b2b" }}>
      <div style={{ position: "relative", zIndex: 10, width: "100%", maxWidth: 420 }}>
        {/* Brand */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          {/* 装飾細線 */}
          <div style={{ width: 1, height: 32, backgroundColor: "#e8849a", margin: "0 auto 18px" }} />

          {/* ブランドアイコン（円 + 笑顔） */}
          <div style={{ width: 48, height: 48, margin: "0 auto 14px", border: "1px solid #e8849a", backgroundColor: "rgba(232,132,154,0.08)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#c96b83" strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9.5" />
              <path d="M8 14s1.5 2 4 2 4-2 4-2" />
              <path d="M7.5 8.5C8.5 7 10 6 12 6s3.5 1 4.5 2.5" />
            </svg>
          </div>

          {/* 英文ロゴ */}
          <p style={{ margin: 0, fontFamily: FONT_DISPLAY, fontSize: 13, letterSpacing: "0.4em", color: "#c96b83", fontWeight: 500 }}>ANGE SPA</p>
          {/* 和文 */}
          <h1 style={{ margin: "10px 0 8px", fontFamily: FONT_SERIF, fontSize: 26, letterSpacing: "0.2em", color: "#2b2b2b", fontWeight: 500 }}>チョップ</h1>
          {/* ピンク細罫線 */}
          <div style={{ width: 32, height: 1, backgroundColor: "#e8849a", margin: "0 auto 10px" }} />
          <p style={{ margin: 0, fontSize: 11, color: "#8a8a8a", letterSpacing: "0.25em" }}>サロン管理システム</p>
        </div>

        {/* Login Card */}
        <div style={{ backgroundColor: "#ffffff", border: "1px solid #e5ded6", padding: 32 }}>
          {/* マイページへの直接アクセス */}
          <div style={{ marginBottom: 22, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <a
              href="/mypage"
              style={{ display: "block", border: "1px solid #c3a78255", backgroundColor: "rgba(195,167,130,0.04)", padding: "11px 10px", textAlign: "center", textDecoration: "none", fontFamily: FONT_SERIF }}
            >
              <div style={{ fontFamily: FONT_DISPLAY, fontSize: 10, color: "#8a8a8a", marginBottom: 3, letterSpacing: "0.2em", fontWeight: 500 }}>THERAPIST</div>
              <div style={{ fontSize: 12, color: "#c3a782", fontWeight: 500, letterSpacing: "0.05em" }}>セラピスト</div>
            </a>
            <a
              href="/customer-mypage"
              style={{ display: "block", border: "1px solid #e8849a55", backgroundColor: "rgba(232,132,154,0.04)", padding: "11px 10px", textAlign: "center", textDecoration: "none", fontFamily: FONT_SERIF }}
            >
              <div style={{ fontFamily: FONT_DISPLAY, fontSize: 10, color: "#8a8a8a", marginBottom: 3, letterSpacing: "0.2em", fontWeight: 500 }}>CUSTOMER</div>
              <div style={{ fontSize: 12, color: "#c96b83", fontWeight: 500, letterSpacing: "0.05em" }}>お客様</div>
            </a>
          </div>

          {/* Divider */}
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 24 }}>
            <div style={{ flex: 1, height: 1, backgroundColor: "#e5ded6" }} />
            <span style={{ fontFamily: FONT_DISPLAY, fontSize: 10, letterSpacing: "0.25em", textTransform: "uppercase", color: "#8a8a8a", fontWeight: 500 }}>
              STAFF LOGIN
            </span>
            <div style={{ flex: 1, height: 1, backgroundColor: "#e5ded6" }} />
          </div>

          {/* Form */}
          <form onSubmit={handleLogin}>
            {/* Email */}
            <div style={{ marginBottom: 18 }}>
              <label style={{ display: "block", marginBottom: 6 }}>
                <span style={{ fontFamily: FONT_DISPLAY, fontSize: 10, letterSpacing: "0.2em", color: "#c96b83", fontWeight: 500 }}>EMAIL</span>
              </label>
              <p style={{ margin: "0 0 6px", fontSize: 11, color: "#555555", letterSpacing: "0.03em" }}>メールアドレス</p>
              <div style={{ position: "relative" }}>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="staff@example.com"
                  required
                  style={{ width: "100%", height: 46, paddingLeft: 42, paddingRight: 14, backgroundColor: "#faf6f1", border: "1px solid #e5ded6", color: "#2b2b2b", fontSize: 14, outline: "none", fontFamily: FONT_SERIF, boxSizing: "border-box", letterSpacing: "0.03em" }}
                />
                <svg style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#b5b5b5" }}
                  width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                  <path d="M22 7l-10 6L2 7" />
                </svg>
              </div>
            </div>

            {/* Password */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: "block", marginBottom: 6 }}>
                <span style={{ fontFamily: FONT_DISPLAY, fontSize: 10, letterSpacing: "0.2em", color: "#c96b83", fontWeight: 500 }}>PASSWORD</span>
              </label>
              <p style={{ margin: "0 0 6px", fontSize: 11, color: "#555555", letterSpacing: "0.03em" }}>パスワード</p>
              <div style={{ position: "relative" }}>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  style={{ width: "100%", height: 46, paddingLeft: 42, paddingRight: 42, backgroundColor: "#faf6f1", border: "1px solid #e5ded6", color: "#2b2b2b", fontSize: 14, outline: "none", fontFamily: FONT_SERIF, boxSizing: "border-box", letterSpacing: "0.03em" }}
                />
                <svg style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#b5b5b5" }}
                  width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", padding: 4, cursor: "pointer", backgroundColor: "transparent", border: "none" }}
                >
                  <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#b5b5b5" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                    {showPassword ? (
                      <>
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </>
                    ) : (
                      <>
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </>
                    )}
                  </svg>
                </button>
              </div>
            </div>

            {/* Login Button */}
            <button
              type="submit"
              disabled={loading}
              style={{ width: "100%", height: 50, backgroundColor: loading ? "#d5d0ca" : "#c96b83", color: "#ffffff", fontSize: 13, fontFamily: FONT_SERIF, fontWeight: 500, letterSpacing: "0.25em", cursor: loading ? "not-allowed" : "pointer", border: "none", opacity: loading ? 0.7 : 1, transition: "all 0.2s" }}
            >
              {loading ? (
                <div style={{ width: 18, height: 18, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#ffffff", borderRadius: "50%", margin: "0 auto", animation: "spin 0.7s linear infinite" }} />
              ) : (
                "LOGIN"
              )}
            </button>

            {/* Error Message */}
            {error && (
              <div style={{ marginTop: 14, padding: "10px 14px", backgroundColor: "rgba(201,107,131,0.08)", border: "1px solid #c96b83", fontSize: 12, color: "#c96b83", display: "flex", alignItems: "center", gap: 8, letterSpacing: "0.03em", fontFamily: FONT_SERIF }}>
                <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
                {error}
              </div>
            )}
          </form>
        </div>

        {/* Footer */}
        <div style={{ textAlign: "center", marginTop: 28 }}>
          <a href="/install-guide" style={{ display: "inline-block", marginBottom: 10, fontSize: 11, cursor: "pointer", color: "#c96b83", textDecoration: "underline", textUnderlineOffset: 4, fontFamily: FONT_SERIF, letterSpacing: "0.05em" }}>
            📱 アプリとして使う方法
          </a>
          <div style={{ width: 20, height: 1, backgroundColor: "#e5ded6", margin: "10px auto 10px" }} />
          <p style={{ margin: 0, fontFamily: FONT_DISPLAY, fontSize: 10, color: "#b5b5b5", letterSpacing: "0.15em" }}>
            &copy; 2026 ANGE SPA · ALL RIGHTS RESERVED
          </p>
        </div>

        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}
