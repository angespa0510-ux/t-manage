"use client";

import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";

export default function StaffLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // PWA 起動時の自動リダイレクト
  // ホーム画面アイコンから開いた時、以前ログイン中だったマイページへ自動遷移
  useEffect(() => {
    if (typeof window === "undefined") return;

    // スタンドアロン PWA として起動されたかチェック
    type IosWindow = Window & { navigator: Navigator & { standalone?: boolean } };
    const isStandalone =
      (window as IosWindow).navigator.standalone === true ||
      window.matchMedia?.("(display-mode: standalone)").matches;

    if (!isStandalone) return;

    // 優先順位: セラピスト > お客様 > スタッフ (該当するものへ遷移)
    try {
      // セラピストセッション
      const therapistSession = localStorage.getItem("therapist_session");
      if (therapistSession) {
        router.replace("/mypage");
        return;
      }
      // お客様セッション
      const customerId = localStorage.getItem("customer_mypage_id");
      if (customerId) {
        router.replace("/customer-mypage");
        return;
      }
      // スタッフセッション (tab閉じで消えるが、稀にあるかも)
      const staffSession = sessionStorage.getItem("t-manage-staff");
      if (staffSession) {
        router.replace("/dashboard");
        return;
      }
    } catch {
      // localStorage/sessionStorage アクセス失敗時は何もしない
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
    <div className="min-h-screen bg-[#0c0b0f] flex items-center justify-center px-4 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-[-200px] right-[-100px] w-[600px] h-[600px] rounded-full bg-[#c3a782]/[0.06] blur-3xl animate-pulse" />
      <div className="absolute bottom-[-150px] left-[-100px] w-[500px] h-[500px] rounded-full bg-[#c3a782]/[0.04] blur-3xl animate-pulse delay-1000" />

      <div className="relative z-10 w-full max-w-[420px]">
        {/* Brand */}
        <div className="text-center mb-12">
          <div className="w-12 h-12 mx-auto mb-5 border border-[#c3a782]/30 rounded-xl flex items-center justify-center bg-[#c3a782]/[0.08]">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#c3a782"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="9.5" />
              <path d="M8 14s1.5 2 4 2 4-2 4-2" />
              <path d="M7.5 8.5C8.5 7 10 6 12 6s3.5 1 4.5 2.5" />
            </svg>
          </div>
          <p className="text-[11px] tracking-[4px] uppercase text-[#f0ece4]/30 mb-2 font-light">
            Chop
          </p>
          <h1 className="text-[32px] text-[#f0ece4] tracking-[2px] font-light">
            チョップ
          </h1>
          <p className="text-[12px] text-[#f0ece4]/50 mt-1.5 tracking-[3px] font-light">
            サロン管理システム
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-8 backdrop-blur-xl">
          {/* マイページへの直接アクセス（セラピスト/お客様用） */}
          <div className="mb-6 grid grid-cols-2 gap-2">
            <a
              href="/mypage"
              className="block rounded-lg border border-[#c3a782]/20 bg-[#c3a782]/[0.04] px-3 py-2.5 text-center transition-all hover:bg-[#c3a782]/[0.1] hover:border-[#c3a782]/40"
            >
              <div className="text-[10px] text-[#f0ece4]/40 mb-0.5 tracking-wider">THERAPIST</div>
              <div className="text-[12px] text-[#c3a782] font-medium">セラピスト</div>
            </a>
            <a
              href="/customer-mypage"
              className="block rounded-lg border border-[#e8849a]/20 bg-[#e8849a]/[0.04] px-3 py-2.5 text-center transition-all hover:bg-[#e8849a]/[0.1] hover:border-[#e8849a]/40"
            >
              <div className="text-[10px] text-[#f0ece4]/40 mb-0.5 tracking-wider">CUSTOMER</div>
              <div className="text-[12px] text-[#e8849a] font-medium">お客様</div>
            </a>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1 h-px bg-white/[0.06]" />
            <span className="text-[10px] tracking-[2px] uppercase text-[#f0ece4]/30">
              スタッフログイン
            </span>
            <div className="flex-1 h-px bg-white/[0.06]" />
          </div>

          {/* Form */}
          <form onSubmit={handleLogin}>
            {/* Email */}
            <div className="mb-5">
              <label className="block text-[11px] tracking-[1.5px] uppercase text-[#f0ece4]/50 mb-2">
                メールアドレス
              </label>
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="メールアドレスを入力"
                  required
                  className="w-full h-12 pl-11 pr-4 bg-white/[0.04] border border-white/[0.06] rounded-[10px] text-[#f0ece4] text-[14px] placeholder-[#f0ece4]/20 outline-none transition-all duration-300 focus:border-[#c3a782]/40 focus:bg-white/[0.05] focus:ring-2 focus:ring-[#c3a782]/15"
                />
                <svg
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#f0ece4]/20"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                  <path d="M22 7l-10 6L2 7" />
                </svg>
              </div>
            </div>

            {/* Password */}
            <div className="mb-6">
              <label className="block text-[11px] tracking-[1.5px] uppercase text-[#f0ece4]/50 mb-2">
                パスワード
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="パスワードを入力"
                  required
                  className="w-full h-12 pl-11 pr-11 bg-white/[0.04] border border-white/[0.06] rounded-[10px] text-[#f0ece4] text-[14px] placeholder-[#f0ece4]/20 outline-none transition-all duration-300 focus:border-[#c3a782]/40 focus:bg-white/[0.05] focus:ring-2 focus:ring-[#c3a782]/15"
                />
                <svg
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#f0ece4]/20"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 cursor-pointer"
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#f0ece4"
                    strokeOpacity="0.2"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
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
              className="w-full h-[50px] rounded-[10px] bg-gradient-to-br from-[#c3a782] to-[#a8895e] text-[#0c0b0f] text-[14px] font-medium tracking-[2px] cursor-pointer transition-all duration-400 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(195,167,130,0.2)] active:translate-y-0 disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-[#0c0b0f]/20 border-t-[#0c0b0f] rounded-full animate-spin mx-auto" />
              ) : (
                "ログイン"
              )}
            </button>

            {/* Error Message */}
            {error && (
              <div className="mt-4 px-4 py-3 bg-[#d4736c]/[0.08] border border-[#d4736c]/15 rounded-lg text-[13px] text-[#d4736c] flex items-center gap-2 animate-pulse">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
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
        <div className="text-center mt-8">
          <a href="/install-guide" className="inline-block mb-3 text-[11px] cursor-pointer" style={{ color: "#c3a782", textDecoration: "underline", textUnderlineOffset: 4 }}>
            📱 アプリとして使う方法
          </a>
          <p className="text-[11px] text-[#f0ece4]/20 font-light tracking-[0.5px]">
            &copy; 2026 チョップ. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
