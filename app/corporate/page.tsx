"use client";

import { useState, useEffect } from "react";

/* ═══════════════════════════════════════════
   合同会社テラスライフ — コーポレートサイト
   AI・デザイン・DXソリューション
   ブルー系 / 信頼・堅実
   ═══════════════════════════════════════════ */

/* ── 会社情報（★差し替えてください） ── */
const CO = {
  name: "合同会社テラスライフ",
  nameEn: "Terrace Life LLC",
  rep: "●● ●●",               // ← 代表者名
  addr: "愛知県安城市●●町●-●-●", // ← 住所
  est: "20●●年●月",             // ← 設立年月
  capital: "●●●万円",           // ← 資本金
  fiscal: "3月決算",
  email: "info@example.com",    // ← メール
  tel: "0566-●●-●●●●",         // ← 電話番号
};

export default function CorporatePage() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", body: "" });
  const [sent, setSent] = useState(false);
  const [visibleSections, setVisibleSections] = useState<Set<string>>(new Set());

  /* スクロール検知 */
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* IntersectionObserver でセクションフェードイン */
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            setVisibleSections((prev) => new Set(prev).add(e.target.id));
          }
        });
      },
      { threshold: 0.12 }
    );
    document.querySelectorAll("[data-anim]").forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  const vis = (id: string) => visibleSections.has(id);
  const scrollTo = (id: string) => {
    setMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  /* 送信ハンドラ（仮） */
  const handleSubmit = () => {
    if (!form.name || !form.email || !form.body) return;
    setSent(true);
  };

  const NAV = [
    { id: "service", label: "事業内容" },
    { id: "tech", label: "技術" },
    { id: "company", label: "会社概要" },
    { id: "contact", label: "お問い合わせ" },
  ];

  return (
    <div style={{ fontFamily: "'Noto Sans JP', 'Helvetica Neue', Arial, sans-serif", color: "#0f172a", background: "#fff", overflowX: "hidden" }}>
      {/* Google Fonts */}
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@300;400;500;700&family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />

      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(32px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes gridMove { from { transform: translateY(0); } to { transform: translateY(40px); } }
        @keyframes float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-12px); } }
        @keyframes pulse { 0%,100% { opacity: 0.4; } 50% { opacity: 0.8; } }
        .fade-up { opacity: 0; transform: translateY(32px); transition: opacity 0.7s cubic-bezier(0.22,1,0.36,1), transform 0.7s cubic-bezier(0.22,1,0.36,1); }
        .fade-up.show { opacity: 1; transform: translateY(0); }
        .card-hover { transition: transform 0.3s, box-shadow 0.3s; }
        .card-hover:hover { transform: translateY(-4px); box-shadow: 0 20px 60px rgba(37,99,235,0.12); }
        a { color: inherit; text-decoration: none; }
      `}</style>

      {/* ══════════ NAV ══════════ */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        background: scrolled ? "rgba(255,255,255,0.92)" : "transparent",
        backdropFilter: scrolled ? "blur(16px)" : "none",
        borderBottom: scrolled ? "1px solid #e2e8f0" : "1px solid transparent",
        transition: "all 0.35s ease",
      }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 64 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }} onClick={() => scrollTo("hero")}>
            {/* Logo mark */}
            <div style={{
              width: 36, height: 36, borderRadius: 8,
              background: "linear-gradient(135deg, #2563eb, #06b6d4)",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#fff", fontWeight: 700, fontSize: 16, fontFamily: "Inter, sans-serif",
            }}>TL</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: scrolled ? "#0f172a" : "#fff", transition: "color 0.35s", letterSpacing: 0.5 }}>
                TERRACE LIFE
              </div>
              <div style={{ fontSize: 9, color: scrolled ? "#64748b" : "rgba(255,255,255,0.7)", transition: "color 0.35s", letterSpacing: 1 }}>
                AI · DESIGN · DX
              </div>
            </div>
          </div>

          {/* Desktop nav */}
          <div style={{ display: "flex", gap: 32, alignItems: "center" }}>
            {NAV.map((n) => (
              <button key={n.id} onClick={() => scrollTo(n.id)} style={{
                background: "none", border: "none", cursor: "pointer",
                fontSize: 13, fontWeight: 500, letterSpacing: 0.5,
                color: scrolled ? "#334155" : "rgba(255,255,255,0.9)",
                transition: "color 0.35s",
              }}>
                {n.label}
              </button>
            ))}
          </div>

          {/* Mobile toggle */}
          <button onClick={() => setMenuOpen(!menuOpen)} style={{
            display: "none", background: "none", border: "none", cursor: "pointer",
            color: scrolled ? "#0f172a" : "#fff", fontSize: 24,
          }}>
            {menuOpen ? "✕" : "☰"}
          </button>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div style={{ background: "#fff", borderTop: "1px solid #e2e8f0", padding: "16px 24px" }}>
            {NAV.map((n) => (
              <button key={n.id} onClick={() => scrollTo(n.id)} style={{
                display: "block", width: "100%", textAlign: "left", padding: "12px 0",
                background: "none", border: "none", borderBottom: "1px solid #f1f5f9",
                fontSize: 14, fontWeight: 500, color: "#334155", cursor: "pointer",
              }}>
                {n.label}
              </button>
            ))}
          </div>
        )}
      </nav>

      {/* ══════════ HERO ══════════ */}
      <section id="hero" style={{
        position: "relative", minHeight: "100vh",
        background: "linear-gradient(165deg, #0c1929 0%, #132338 40%, #1a3050 70%, #1e3a5f 100%)",
        display: "flex", alignItems: "center", justifyContent: "center",
        overflow: "hidden",
      }}>
        {/* Grid pattern background */}
        <div style={{ position: "absolute", inset: 0, opacity: 0.06 }}>
          <svg width="100%" height="100%">
            <defs>
              <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
                <path d="M 60 0 L 0 0 0 60" fill="none" stroke="#60a5fa" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>

        {/* Glowing orbs */}
        <div style={{ position: "absolute", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, rgba(37,99,235,0.15), transparent 70%)", top: "-10%", right: "-10%", animation: "pulse 6s ease-in-out infinite" }} />
        <div style={{ position: "absolute", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(6,182,212,0.1), transparent 70%)", bottom: "-5%", left: "-5%", animation: "pulse 8s ease-in-out infinite 2s" }} />

        {/* Floating particles */}
        {[...Array(5)].map((_, i) => (
          <div key={i} style={{
            position: "absolute",
            width: 4 + i * 2, height: 4 + i * 2,
            borderRadius: "50%",
            background: i % 2 === 0 ? "rgba(96,165,250,0.3)" : "rgba(6,182,212,0.3)",
            top: `${15 + i * 16}%`,
            left: `${10 + i * 18}%`,
            animation: `float ${3 + i}s ease-in-out infinite ${i * 0.5}s`,
          }} />
        ))}

        {/* Hero content */}
        <div style={{ position: "relative", zIndex: 2, textAlign: "center", padding: "0 24px", maxWidth: 800 }}>
          <div style={{
            display: "inline-block", padding: "6px 20px", borderRadius: 24,
            border: "1px solid rgba(96,165,250,0.3)", background: "rgba(37,99,235,0.1)",
            fontSize: 12, fontWeight: 500, color: "#93c5fd", letterSpacing: 1.5,
            marginBottom: 28, animation: "fadeIn 1s ease 0.3s both",
          }}>
            AI · DESIGN · DX SOLUTIONS
          </div>

          <h1 style={{
            fontFamily: "Inter, 'Noto Sans JP', sans-serif",
            fontSize: "clamp(28px, 5vw, 52px)",
            fontWeight: 700, lineHeight: 1.2, color: "#f8fafc",
            letterSpacing: -0.5,
            animation: "fadeUp 0.9s ease 0.5s both",
          }}>
            テクノロジーで、<br />ビジネスの未来をデザインする。
          </h1>

          <p style={{
            fontSize: "clamp(14px, 2vw, 17px)",
            lineHeight: 1.8, color: "#94a3b8",
            marginTop: 24, maxWidth: 600, marginLeft: "auto", marginRight: "auto",
            animation: "fadeUp 0.9s ease 0.7s both",
          }}>
            AI ソリューション開発、Web システム構築、DX 推進支援。
            <br />
            私たちは最先端の技術力で、お客様の課題を解決します。
          </p>

          <div style={{ marginTop: 40, display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap", animation: "fadeUp 0.9s ease 0.9s both" }}>
            <button onClick={() => scrollTo("service")} style={{
              padding: "14px 36px", borderRadius: 8, border: "none", cursor: "pointer",
              background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
              color: "#fff", fontSize: 14, fontWeight: 600, letterSpacing: 0.5,
              boxShadow: "0 4px 24px rgba(37,99,235,0.3)",
              transition: "transform 0.2s, box-shadow 0.2s",
            }}>
              事業内容を見る
            </button>
            <button onClick={() => scrollTo("contact")} style={{
              padding: "14px 36px", borderRadius: 8, cursor: "pointer",
              background: "transparent",
              border: "1px solid rgba(148,163,184,0.4)",
              color: "#cbd5e1", fontSize: 14, fontWeight: 500, letterSpacing: 0.5,
              transition: "all 0.2s",
            }}>
              お問い合わせ
            </button>
          </div>
        </div>

        {/* Scroll indicator */}
        <div style={{
          position: "absolute", bottom: 32, left: "50%", transform: "translateX(-50%)",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
          animation: "fadeIn 1s ease 1.5s both",
        }}>
          <span style={{ fontSize: 10, color: "#64748b", letterSpacing: 2, fontWeight: 500 }}>SCROLL</span>
          <div style={{ width: 1, height: 28, background: "linear-gradient(to bottom, #475569, transparent)" }} />
        </div>
      </section>

      {/* ══════════ SERVICES ══════════ */}
      <section id="service" data-anim style={{ padding: "100px 24px", background: "#fff" }}>
        <div className={`fade-up ${vis("service") ? "show" : ""}`} style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 64 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#2563eb", letterSpacing: 2.5, textTransform: "uppercase" }}>Services</span>
            <h2 style={{ fontFamily: "Inter, 'Noto Sans JP', sans-serif", fontSize: "clamp(24px, 3.5vw, 36px)", fontWeight: 700, marginTop: 12, color: "#0f172a", letterSpacing: -0.3 }}>
              事業内容
            </h2>
            <p style={{ fontSize: 15, color: "#64748b", marginTop: 12, lineHeight: 1.7 }}>
              AIからDXまで、ビジネスの成長を支える3つのソリューション
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 28 }}>
            {[
              {
                title: "AIソリューション開発",
                sub: "AI Solutions",
                desc: "業務特化型AIチャットボット、自動分類・レコメンドエンジン、データ分析AIなど、お客様の業務課題に合わせたAIソリューションを設計・開発します。",
                tags: ["業務特化AI", "自動分析", "予測モデル", "業務自動化"],
                icon: (
                  <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
                    <rect x="4" y="9" width="36" height="26" rx="5" stroke="#2563eb" strokeWidth="1.5" />
                    <circle cx="16" cy="22" r="3.5" stroke="#3b82f6" strokeWidth="1.5" />
                    <circle cx="28" cy="22" r="3.5" stroke="#3b82f6" strokeWidth="1.5" />
                    <path d="M14 30h16" stroke="#06b6d4" strokeWidth="1.5" strokeLinecap="round" />
                    <path d="M22 4v5" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" />
                    <circle cx="22" cy="3" r="2" fill="#2563eb" opacity="0.3" stroke="#2563eb" strokeWidth="1" />
                  </svg>
                ),
              },
              {
                title: "Webデザイン・システム開発",
                sub: "Web Design & Development",
                desc: "予約管理・顧客管理・業務効率化システムの設計から開発、運用まで。モダンな技術スタックで高速かつ美しいWebアプリケーションを構築します。",
                tags: ["業務管理システム", "予約・顧客管理", "モバイル対応", "リアルタイム"],
                icon: (
                  <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
                    <rect x="6" y="6" width="32" height="32" rx="4" stroke="#2563eb" strokeWidth="1.5" />
                    <rect x="10" y="11" width="10" height="7" rx="1.5" fill="#06b6d4" opacity="0.2" stroke="#06b6d4" strokeWidth="1" />
                    <rect x="10" y="22" width="24" height="2.5" rx="1" fill="#94a3b8" opacity="0.35" />
                    <rect x="10" y="28" width="16" height="2.5" rx="1" fill="#94a3b8" opacity="0.2" />
                    <path d="M25 11l5 3.5-5 3.5" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ),
              },
              {
                title: "DX推進支援",
                sub: "Digital Transformation",
                desc: "紙やExcelで管理していた業務をデジタル化。クラウドベースのシステム導入から社内教育まで、DX推進をトータルサポートします。",
                tags: ["プロセス改善", "クラウド移行", "データ可視化", "DX教育"],
                icon: (
                  <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
                    <rect x="8" y="22" width="8" height="14" rx="1.5" fill="#2563eb" opacity="0.25" stroke="#2563eb" strokeWidth="1" />
                    <rect x="18" y="14" width="8" height="22" rx="1.5" fill="#06b6d4" opacity="0.25" stroke="#06b6d4" strokeWidth="1" />
                    <rect x="28" y="8" width="8" height="28" rx="1.5" fill="#3b82f6" opacity="0.25" stroke="#3b82f6" strokeWidth="1" />
                    <path d="M10 10l10 6 10-5 10 3" stroke="#60a5fa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    <circle cx="10" cy="10" r="2" fill="#2563eb" />
                    <circle cx="20" cy="16" r="2" fill="#06b6d4" />
                    <circle cx="30" cy="11" r="2" fill="#3b82f6" />
                  </svg>
                ),
              },
            ].map((s, i) => (
              <div key={i} className="card-hover" style={{
                background: "#fff", borderRadius: 16,
                border: "1px solid #e2e8f0",
                padding: 32, display: "flex", flexDirection: "column",
                transitionDelay: `${i * 100}ms`,
              }}>
                <div style={{
                  width: 64, height: 64, borderRadius: 14,
                  background: "linear-gradient(135deg, #eff6ff, #f0f9ff)",
                  border: "1px solid #dbeafe",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  marginBottom: 20,
                }}>
                  {s.icon}
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, color: "#2563eb", letterSpacing: 1.5, textTransform: "uppercase" }}>
                  {s.sub}
                </span>
                <h3 style={{ fontSize: 20, fontWeight: 700, marginTop: 6, color: "#0f172a" }}>{s.title}</h3>
                <p style={{ fontSize: 14, lineHeight: 1.8, color: "#475569", marginTop: 12, flex: 1 }}>{s.desc}</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 20 }}>
                  {s.tags.map((t) => (
                    <span key={t} style={{
                      fontSize: 11, fontWeight: 500, padding: "4px 12px", borderRadius: 6,
                      background: "#eff6ff", color: "#2563eb", border: "1px solid #dbeafe",
                    }}>
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════ TECH STACK ══════════ */}
      <section id="tech" data-anim style={{ padding: "80px 24px", background: "#f8fafc" }}>
        <div className={`fade-up ${vis("tech") ? "show" : ""}`} style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#2563eb", letterSpacing: 2.5, textTransform: "uppercase" }}>Technology</span>
            <h2 style={{ fontFamily: "Inter, 'Noto Sans JP', sans-serif", fontSize: "clamp(24px, 3.5vw, 36px)", fontWeight: 700, marginTop: 12, color: "#0f172a" }}>
              技術スタック
            </h2>
            <p style={{ fontSize: 15, color: "#64748b", marginTop: 12 }}>
              モダンで信頼性の高い技術基盤を採用しています
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 20 }}>
            {[
              { cat: "Frontend", items: ["Next.js (React)", "TypeScript", "Tailwind CSS"], color: "#2563eb" },
              { cat: "Backend / DB", items: ["Supabase (PostgreSQL)", "Edge Functions", "Realtime"], color: "#06b6d4" },
              { cat: "AI / ML", items: ["Anthropic Claude API", "自然言語処理", "RAG構築"], color: "#7c3aed" },
              { cat: "Infra / Deploy", items: ["Vercel", "GitHub CI/CD", "CDN配信"], color: "#059669" },
            ].map((t, i) => (
              <div key={i} style={{
                background: "#fff", borderRadius: 14, padding: "24px 20px",
                border: "1px solid #e2e8f0",
              }}>
                <div style={{
                  fontSize: 11, fontWeight: 700, color: t.color, letterSpacing: 1.5,
                  textTransform: "uppercase", marginBottom: 14,
                  paddingBottom: 10, borderBottom: `2px solid ${t.color}18`,
                }}>
                  {t.cat}
                </div>
                {t.items.map((item) => (
                  <div key={item} style={{
                    fontSize: 13, fontWeight: 500, color: "#334155",
                    padding: "8px 0",
                    borderBottom: "1px solid #f1f5f9",
                    display: "flex", alignItems: "center", gap: 8,
                  }}>
                    <div style={{ width: 5, height: 5, borderRadius: "50%", background: t.color, opacity: 0.5 }} />
                    {item}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════ COMPANY ══════════ */}
      <section id="company" data-anim style={{ padding: "80px 24px", background: "#fff" }}>
        <div className={`fade-up ${vis("company") ? "show" : ""}`} style={{ maxWidth: 900, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#2563eb", letterSpacing: 2.5, textTransform: "uppercase" }}>Company</span>
            <h2 style={{ fontFamily: "Inter, 'Noto Sans JP', sans-serif", fontSize: "clamp(24px, 3.5vw, 36px)", fontWeight: 700, marginTop: 12, color: "#0f172a" }}>
              会社概要
            </h2>
          </div>

          <div style={{
            background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0",
            overflow: "hidden", boxShadow: "0 4px 24px rgba(0,0,0,0.04)",
          }}>
            {/* Logo area */}
            <div style={{
              padding: "36px 40px",
              background: "linear-gradient(135deg, #0f172a, #1e3a5f)",
              display: "flex", alignItems: "center", gap: 20,
            }}>
              <div style={{
                width: 56, height: 56, borderRadius: 12,
                background: "linear-gradient(135deg, #2563eb, #06b6d4)",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#fff", fontWeight: 700, fontSize: 22, fontFamily: "Inter, sans-serif",
                flexShrink: 0,
              }}>TL</div>
              <div>
                <div style={{ fontSize: 20, fontWeight: 700, color: "#f8fafc", letterSpacing: 0.5 }}>{CO.name}</div>
                <div style={{ fontSize: 12, color: "#94a3b8", letterSpacing: 1.5, marginTop: 2 }}>{CO.nameEn}</div>
              </div>
            </div>

            {/* Info rows */}
            <div style={{ padding: "0 40px" }}>
              {[
                { label: "商号", value: CO.name },
                { label: "代表者", value: CO.rep },
                { label: "所在地", value: CO.addr },
                { label: "設立", value: CO.est },
                { label: "資本金", value: CO.capital },
                { label: "決算期", value: CO.fiscal },
                { label: "事業内容", value: "AIソリューション開発、Webデザイン・システム開発、DX推進支援" },
                { label: "メール", value: CO.email },
                { label: "電話", value: CO.tel },
              ].map((r, i) => (
                <div key={i} style={{
                  display: "flex", padding: "18px 0",
                  borderBottom: "1px solid #f1f5f9",
                  gap: 20, alignItems: "baseline",
                }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#64748b", minWidth: 80, flexShrink: 0 }}>
                    {r.label}
                  </span>
                  <span style={{ fontSize: 14, fontWeight: 500, color: "#0f172a", lineHeight: 1.6 }}>
                    {r.value}
                  </span>
                </div>
              ))}
            </div>
            <div style={{ height: 20 }} />
          </div>
        </div>
      </section>

      {/* ══════════ CONTACT ══════════ */}
      <section id="contact" data-anim style={{
        padding: "80px 24px",
        background: "linear-gradient(165deg, #0c1929, #132338, #1a3050)",
      }}>
        <div className={`fade-up ${vis("contact") ? "show" : ""}`} style={{ maxWidth: 640, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#60a5fa", letterSpacing: 2.5, textTransform: "uppercase" }}>Contact</span>
            <h2 style={{ fontFamily: "Inter, 'Noto Sans JP', sans-serif", fontSize: "clamp(24px, 3.5vw, 36px)", fontWeight: 700, marginTop: 12, color: "#f8fafc" }}>
              お問い合わせ
            </h2>
            <p style={{ fontSize: 14, color: "#94a3b8", marginTop: 12, lineHeight: 1.7 }}>
              ご相談・お見積もりなど、お気軽にお問い合わせください。
            </p>
          </div>

          {!sent ? (
            <div style={{
              background: "rgba(255,255,255,0.04)", borderRadius: 16,
              border: "1px solid rgba(148,163,184,0.15)", padding: 36,
            }}>
              {[
                { key: "name" as const, label: "お名前", type: "text", placeholder: "山田 太郎" },
                { key: "email" as const, label: "メールアドレス", type: "email", placeholder: "example@email.com" },
              ].map((f) => (
                <div key={f.key} style={{ marginBottom: 20 }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#94a3b8", marginBottom: 6, letterSpacing: 0.5 }}>
                    {f.label}
                  </label>
                  <input
                    type={f.type}
                    value={form[f.key]}
                    onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                    placeholder={f.placeholder}
                    style={{
                      width: "100%", padding: "12px 16px", borderRadius: 8,
                      border: "1px solid rgba(148,163,184,0.2)",
                      background: "rgba(255,255,255,0.04)", color: "#f8fafc",
                      fontSize: 14, outline: "none",
                    }}
                  />
                </div>
              ))}
              <div style={{ marginBottom: 24 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#94a3b8", marginBottom: 6, letterSpacing: 0.5 }}>
                  お問い合わせ内容
                </label>
                <textarea
                  value={form.body}
                  onChange={(e) => setForm({ ...form, body: e.target.value })}
                  placeholder="ご相談内容をご記入ください"
                  rows={5}
                  style={{
                    width: "100%", padding: "12px 16px", borderRadius: 8,
                    border: "1px solid rgba(148,163,184,0.2)",
                    background: "rgba(255,255,255,0.04)", color: "#f8fafc",
                    fontSize: 14, outline: "none", resize: "vertical",
                  }}
                />
              </div>
              <button onClick={handleSubmit} style={{
                width: "100%", padding: "14px 0", borderRadius: 8,
                border: "none", cursor: "pointer",
                background: form.name && form.email && form.body
                  ? "linear-gradient(135deg, #2563eb, #1d4ed8)"
                  : "#334155",
                color: "#fff", fontSize: 14, fontWeight: 600, letterSpacing: 0.5,
                boxShadow: form.name && form.email && form.body ? "0 4px 24px rgba(37,99,235,0.3)" : "none",
                transition: "all 0.2s",
              }}>
                送信する
              </button>
            </div>
          ) : (
            <div style={{
              background: "rgba(255,255,255,0.04)", borderRadius: 16,
              border: "1px solid rgba(34,197,94,0.3)", padding: "48px 36px",
              textAlign: "center",
            }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>✓</div>
              <p style={{ fontSize: 18, fontWeight: 600, color: "#f8fafc" }}>送信完了しました</p>
              <p style={{ fontSize: 14, color: "#94a3b8", marginTop: 8 }}>
                内容を確認のうえ、折り返しご連絡いたします。
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ══════════ FOOTER ══════════ */}
      <footer style={{
        padding: "40px 24px 28px",
        background: "#0a1321",
        borderTop: "1px solid rgba(148,163,184,0.1)",
      }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 6,
              background: "linear-gradient(135deg, #2563eb, #06b6d4)",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#fff", fontWeight: 700, fontSize: 11, fontFamily: "Inter, sans-serif",
            }}>TL</div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#94a3b8" }}>TERRACE LIFE</div>
              <div style={{ fontSize: 9, color: "#475569", letterSpacing: 0.5 }}>{CO.name}</div>
            </div>
          </div>
          <p style={{ fontSize: 11, color: "#475569" }}>
            © {new Date().getFullYear()} {CO.name}. All rights reserved.
          </p>
        </div>
      </footer>

      {/* レスポンシブ */}
      <style>{`
        @media (max-width: 768px) {
          nav > div > div:nth-child(2) { display: none !important; }
          nav > div > button:last-child { display: block !important; }
          #hero { padding-top: 80px; }
        }
      `}</style>
    </div>
  );
}
