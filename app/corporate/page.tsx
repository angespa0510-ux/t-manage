"use client";

import { useState, useEffect, useRef } from "react";

/* ═══════════════════════════════════════════
   合同会社テラスライフ — コーポレートサイト v2
   攻めのデザイン：光ビーム / パーティクル / グロー
   ═══════════════════════════════════════════ */

const CO = {
  name: "合同会社テラスライフ",
  nameEn: "Terrace Life LLC",
  rep: "●● ●●",
  addr: "愛知県安城市●●町●-●-●",
  est: "20●●年●月",
  capital: "●●●万円",
  fiscal: "3月決算",
  email: "info@example.com",
  tel: "0566-●●-●●●●",
};

/* ── AnimatedCounter ── */
function Counter({ target, suffix = "", duration = 2000 }: { target: number; suffix?: string; duration?: number }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !started.current) {
        started.current = true;
        const s = performance.now();
        const step = (now: number) => {
          const p = Math.min((now - s) / duration, 1);
          setCount(Math.floor(target * (1 - Math.pow(1 - p, 3))));
          if (p < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      }
    }, { threshold: 0.3 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [target, duration]);
  return <span ref={ref}>{count.toLocaleString()}{suffix}</span>;
}

export default function CorporatePage() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", body: "" });
  const [sent, setSent] = useState(false);
  const [vis, setVis] = useState<Set<string>>(new Set());
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  useEffect(() => {
    const obs = new IntersectionObserver(
      (es) => es.forEach((e) => { if (e.isIntersecting) setVis((p) => new Set(p).add(e.target.id)); }),
      { threshold: 0.1 }
    );
    document.querySelectorAll("[data-a]").forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const fn = (e: MouseEvent) => setMousePos({ x: e.clientX, y: e.clientY });
    window.addEventListener("mousemove", fn, { passive: true });
    return () => window.removeEventListener("mousemove", fn);
  }, []);

  const show = (id: string) => vis.has(id);
  const go = (id: string) => { setMenuOpen(false); document.getElementById(id)?.scrollIntoView({ behavior: "smooth" }); };
  const submit = () => { if (form.name && form.email && form.body) setSent(true); };

  const NAV = [
    { id: "service", label: "事業内容" },
    { id: "stats", label: "実績" },
    { id: "tech", label: "技術" },
    { id: "company", label: "会社概要" },
    { id: "contact", label: "お問い合わせ" },
  ];

  return (
    <div style={{ fontFamily: "'Noto Sans JP','Helvetica Neue',sans-serif", color: "#0f172a", background: "#020617", overflowX: "hidden" }}>
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@300;400;500;700;900&family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />

      <style>{`
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        html{scroll-behavior:smooth}a{color:inherit;text-decoration:none}
        @keyframes fadeUp{from{opacity:0;transform:translateY(40px)}to{opacity:1;transform:translateY(0)}}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        @keyframes slideRight{from{transform:translateX(-120%)}to{transform:translateX(120vw)}}
        @keyframes pulse{0%,100%{opacity:.3}50%{opacity:.7}}
        @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-18px)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes beam{0%{transform:translateX(-200%) rotate(35deg);opacity:0}10%{opacity:1}90%{opacity:1}100%{transform:translateX(200%) rotate(35deg);opacity:0}}
        @keyframes glow{0%,100%{box-shadow:0 0 20px rgba(37,99,235,0.08)}50%{box-shadow:0 0 40px rgba(37,99,235,0.2)}}
        @keyframes borderGlow{0%{border-color:rgba(37,99,235,0.15)}50%{border-color:rgba(96,165,250,0.4)}100%{border-color:rgba(37,99,235,0.15)}}
        @keyframes textShimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
        @keyframes orbFloat{0%{transform:translate(0,0) scale(1)}33%{transform:translate(30px,-20px) scale(1.1)}66%{transform:translate(-20px,15px) scale(.95)}100%{transform:translate(0,0) scale(1)}}
        .fu{opacity:0;transform:translateY(40px);transition:opacity .8s cubic-bezier(.22,1,.36,1),transform .8s cubic-bezier(.22,1,.36,1)}
        .fu.on{opacity:1;transform:translateY(0)}
        .ch{transition:transform .35s,box-shadow .35s,border-color .35s}
        .ch:hover{transform:translateY(-6px) scale(1.01);box-shadow:0 24px 80px rgba(37,99,235,0.18);border-color:rgba(96,165,250,0.4)!important}
        .shimmer-text{background:linear-gradient(90deg,#f8fafc 0%,#60a5fa 25%,#f8fafc 50%,#93c5fd 75%,#f8fafc 100%);background-size:200% auto;-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;animation:textShimmer 5s linear infinite}
        .light-beam{position:absolute;width:300px;height:2px;background:linear-gradient(90deg,transparent,rgba(96,165,250,0.6),rgba(6,182,212,0.4),transparent);animation:beam 4s ease-in-out infinite;pointer-events:none}
        @media(max-width:768px){.nav-links{display:none!important}.nav-toggle{display:block!important}.hero-h1{font-size:32px!important}.stats-grid{grid-template-columns:1fr 1fr!important}}
      `}</style>

      {/* ══════════ NAV ══════════ */}
      <nav style={{ position:"fixed",top:0,left:0,right:0,zIndex:100,background:scrolled?"rgba(2,6,23,0.85)":"transparent",backdropFilter:scrolled?"blur(20px) saturate(1.4)":"none",borderBottom:scrolled?"1px solid rgba(96,165,250,0.1)":"1px solid transparent",transition:"all .4s" }}>
        <div style={{ maxWidth:1100,margin:"0 auto",padding:"0 24px",display:"flex",alignItems:"center",justifyContent:"space-between",height:64 }}>
          <div style={{ display:"flex",alignItems:"center",gap:10,cursor:"pointer" }} onClick={() => go("hero")}>
            <div style={{ width:36,height:36,borderRadius:8,background:"linear-gradient(135deg,#2563eb,#06b6d4)",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:800,fontSize:14,fontFamily:"Inter",boxShadow:"0 0 20px rgba(37,99,235,0.3)" }}>TL</div>
            <div>
              <div style={{ fontSize:14,fontWeight:700,color:"#f8fafc",letterSpacing:1,fontFamily:"Inter" }}>TERRACE LIFE</div>
              <div style={{ fontSize:8,color:"#60a5fa",letterSpacing:2.5,fontWeight:600 }}>AI · DESIGN · DX</div>
            </div>
          </div>
          <div className="nav-links" style={{ display:"flex",gap:28,alignItems:"center" }}>
            {NAV.map((n) => (
              <button key={n.id} onClick={() => go(n.id)} style={{ background:"none",border:"none",cursor:"pointer",fontSize:12,fontWeight:500,letterSpacing:.8,color:"rgba(248,250,252,0.7)",transition:"color .3s" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#60a5fa")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(248,250,252,0.7)")}
              >{n.label}</button>
            ))}
          </div>
          <button className="nav-toggle" onClick={() => setMenuOpen(!menuOpen)} style={{ display:"none",background:"none",border:"none",cursor:"pointer",color:"#f8fafc",fontSize:22 }}>{menuOpen ? "✕" : "☰"}</button>
        </div>
        {menuOpen && (
          <div style={{ background:"rgba(2,6,23,0.95)",backdropFilter:"blur(20px)",padding:"12px 24px",borderTop:"1px solid rgba(96,165,250,0.1)" }}>
            {NAV.map((n) => (<button key={n.id} onClick={() => go(n.id)} style={{ display:"block",width:"100%",textAlign:"left",padding:"14px 0",background:"none",border:"none",borderBottom:"1px solid rgba(255,255,255,0.05)",fontSize:14,fontWeight:500,color:"#cbd5e1",cursor:"pointer" }}>{n.label}</button>))}
          </div>
        )}
      </nav>

      {/* ══════════ HERO ══════════ */}
      <section id="hero" style={{ position:"relative",minHeight:"100vh",background:"radial-gradient(ellipse at 50% 0%,#0f2847 0%,#0c1929 40%,#020617 100%)",display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden" }}>
        {/* Grid */}
        <div style={{ position:"absolute",inset:0,opacity:0.05 }}>
          <svg width="100%" height="100%"><defs><pattern id="g" width="80" height="80" patternUnits="userSpaceOnUse"><path d="M 80 0 L 0 0 0 80" fill="none" stroke="#60a5fa" strokeWidth="0.5"/></pattern></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>
        </div>
        {/* Perspective floor */}
        <div style={{ position:"absolute",bottom:0,left:0,right:0,height:"40%",background:"linear-gradient(to top,rgba(37,99,235,0.03),transparent)",transform:"perspective(600px) rotateX(45deg)",transformOrigin:"bottom" }}>
          <svg width="100%" height="100%" style={{ opacity:0.15 }}><defs><pattern id="fg" width="60" height="60" patternUnits="userSpaceOnUse"><path d="M 60 0 L 0 0 0 60" fill="none" stroke="#2563eb" strokeWidth="0.5"/></pattern></defs><rect width="100%" height="100%" fill="url(#fg)"/></svg>
        </div>
        {/* Orbs */}
        <div style={{ position:"absolute",width:600,height:600,borderRadius:"50%",background:"radial-gradient(circle,rgba(37,99,235,0.18),transparent 65%)",top:"-15%",right:"-10%",animation:"orbFloat 12s ease-in-out infinite" }}/>
        <div style={{ position:"absolute",width:500,height:500,borderRadius:"50%",background:"radial-gradient(circle,rgba(6,182,212,0.12),transparent 65%)",bottom:"5%",left:"-8%",animation:"orbFloat 15s ease-in-out infinite 3s" }}/>
        <div style={{ position:"absolute",width:300,height:300,borderRadius:"50%",background:"radial-gradient(circle,rgba(124,58,237,0.1),transparent 65%)",top:"30%",left:"50%",animation:"orbFloat 10s ease-in-out infinite 5s" }}/>
        {/* Light beams */}
        <div className="light-beam" style={{ top:"20%",animationDelay:"0s",animationDuration:"3.5s" }}/>
        <div className="light-beam" style={{ top:"45%",animationDelay:"1.5s",animationDuration:"4s",background:"linear-gradient(90deg,transparent,rgba(6,182,212,0.5),rgba(124,58,237,0.3),transparent)" }}/>
        <div className="light-beam" style={{ top:"70%",animationDelay:"3s",animationDuration:"5s" }}/>
        {/* Particles */}
        {[...Array(12)].map((_, i) => (
          <div key={i} style={{ position:"absolute",width:2+(i%4),height:2+(i%4),borderRadius:"50%",background:i%3===0?"#60a5fa":i%3===1?"#06b6d4":"#a78bfa",opacity:0.3+(i%3)*0.15,top:`${8+i*7.5}%`,left:`${5+((i*17)%90)}%`,animation:`float ${3+(i%4)}s ease-in-out infinite ${i*0.4}s`,boxShadow:`0 0 ${6+i*2}px currentColor` }}/>
        ))}
        {/* Mouse glow */}
        <div style={{ position:"fixed",width:400,height:400,borderRadius:"50%",background:"radial-gradient(circle,rgba(37,99,235,0.06),transparent 70%)",left:mousePos.x-200,top:mousePos.y-200,pointerEvents:"none",transition:"left .3s ease-out,top .3s ease-out",zIndex:1 }}/>

        {/* Content */}
        <div style={{ position:"relative",zIndex:2,textAlign:"center",padding:"0 24px",maxWidth:900 }}>
          <div style={{ display:"inline-flex",alignItems:"center",gap:8,padding:"8px 24px",borderRadius:24,border:"1px solid rgba(96,165,250,0.25)",background:"rgba(37,99,235,0.08)",backdropFilter:"blur(10px)",fontSize:11,fontWeight:600,color:"#93c5fd",letterSpacing:2,marginBottom:32,animation:"fadeIn 1s ease .3s both" }}>
            <span style={{ width:6,height:6,borderRadius:"50%",background:"#22c55e",boxShadow:"0 0 8px #22c55e",animation:"pulse 2s infinite" }}/>
            AI-POWERED SOLUTIONS
          </div>
          <h1 className="hero-h1" style={{ fontFamily:"Inter,'Noto Sans JP'",fontSize:"clamp(32px,5.5vw,60px)",fontWeight:900,lineHeight:1.15,letterSpacing:-1,animation:"fadeUp 1s ease .5s both" }}>
            <span className="shimmer-text">テクノロジーで、</span><br/>
            <span style={{ color:"#f8fafc" }}>ビジネスの未来を</span><br/>
            <span style={{ background:"linear-gradient(135deg,#2563eb,#06b6d4,#7c3aed)",WebkitBackgroundClip:"text",backgroundClip:"text",WebkitTextFillColor:"transparent" }}>デザインする。</span>
          </h1>
          <p style={{ fontSize:"clamp(14px,1.8vw,17px)",lineHeight:1.9,color:"#94a3b8",marginTop:28,maxWidth:560,marginLeft:"auto",marginRight:"auto",animation:"fadeUp 1s ease .75s both" }}>
            AIソリューション開発、Webシステム構築、DX推進支援。<br/>最先端の技術力で、お客様の課題を解決します。
          </p>
          <div style={{ marginTop:44,display:"flex",gap:16,justifyContent:"center",flexWrap:"wrap",animation:"fadeUp 1s ease 1s both" }}>
            <button onClick={() => go("service")} style={{ padding:"16px 40px",borderRadius:10,border:"none",cursor:"pointer",background:"linear-gradient(135deg,#2563eb,#1d4ed8)",color:"#fff",fontSize:14,fontWeight:700,letterSpacing:.8,boxShadow:"0 0 30px rgba(37,99,235,0.4),0 8px 32px rgba(37,99,235,0.2)",transition:"all .3s" }}
              onMouseEnter={(e) => { e.currentTarget.style.boxShadow="0 0 50px rgba(37,99,235,0.5),0 12px 40px rgba(37,99,235,0.3)"; e.currentTarget.style.transform="translateY(-2px)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.boxShadow="0 0 30px rgba(37,99,235,0.4),0 8px 32px rgba(37,99,235,0.2)"; e.currentTarget.style.transform="translateY(0)"; }}
            >事業内容を見る →</button>
            <button onClick={() => go("contact")} style={{ padding:"16px 40px",borderRadius:10,cursor:"pointer",background:"rgba(255,255,255,0.03)",backdropFilter:"blur(10px)",border:"1px solid rgba(148,163,184,0.25)",color:"#cbd5e1",fontSize:14,fontWeight:600,letterSpacing:.8,transition:"all .3s" }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor="rgba(96,165,250,0.5)"; e.currentTarget.style.color="#60a5fa"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor="rgba(148,163,184,0.25)"; e.currentTarget.style.color="#cbd5e1"; }}
            >お問い合わせ</button>
          </div>
        </div>
        {/* Scroll indicator */}
        <div style={{ position:"absolute",bottom:28,left:"50%",transform:"translateX(-50%)",display:"flex",flexDirection:"column",alignItems:"center",gap:8,animation:"fadeIn 1s ease 1.8s both" }}>
          <span style={{ fontSize:9,color:"#475569",letterSpacing:3,fontWeight:600 }}>SCROLL</span>
          <div style={{ width:20,height:32,borderRadius:10,border:"1px solid #334155",display:"flex",justifyContent:"center",paddingTop:6 }}>
            <div style={{ width:3,height:8,borderRadius:2,background:"#60a5fa",animation:"float 1.5s ease-in-out infinite" }}/>
          </div>
        </div>
      </section>

      {/* ── Divider ── */}
      <div style={{ height:1,background:"linear-gradient(90deg,transparent,rgba(37,99,235,0.3),rgba(6,182,212,0.3),transparent)",position:"relative" }}>
        <div style={{ position:"absolute",top:-12,left:0,right:0,height:24,background:"radial-gradient(ellipse at 50% 50%,rgba(37,99,235,0.08),transparent 70%)" }}/>
      </div>

      {/* ══════════ SERVICES ══════════ */}
      <section id="service" data-a style={{ padding:"100px 24px",background:"#020617" }}>
        <div className={`fu ${show("service")?"on":""}`} style={{ maxWidth:1100,margin:"0 auto" }}>
          <div style={{ textAlign:"center",marginBottom:64 }}>
            <span style={{ fontSize:11,fontWeight:700,color:"#2563eb",letterSpacing:3 }}>SERVICES</span>
            <h2 style={{ fontFamily:"Inter,'Noto Sans JP'",fontSize:"clamp(26px,4vw,40px)",fontWeight:800,marginTop:14,color:"#f8fafc",letterSpacing:-.5 }}>事業内容</h2>
            <div style={{ width:60,height:3,borderRadius:2,background:"linear-gradient(90deg,#2563eb,#06b6d4)",margin:"16px auto 0" }}/>
          </div>
          <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(300px,1fr))",gap:24 }}>
            {[
              { title:"AIソリューション開発",sub:"AI Solutions",grad:"135deg,#1e3a5f,#0c1929",desc:"業務特化型AIチャットボット、自動分類・レコメンドエンジン、データ分析AI。お客様の課題に合わせたAIソリューションを設計・開発します。",tags:["業務特化AI","自動分析","予測モデル","業務自動化"],ic:"#3b82f6",
                svg:<svg width="48" height="48" viewBox="0 0 48 48" fill="none"><rect x="8" y="12" width="32" height="24" rx="5" stroke="#3b82f6" strokeWidth="1.5"/><circle cx="19" cy="24" r="4" stroke="#60a5fa" strokeWidth="1.5"/><circle cx="29" cy="24" r="4" stroke="#60a5fa" strokeWidth="1.5"/><path d="M16 32h16" stroke="#06b6d4" strokeWidth="2" strokeLinecap="round"/><path d="M24 6v6" stroke="#60a5fa" strokeWidth="1.5" strokeLinecap="round"/><circle cx="24" cy="5" r="2.5" fill="#2563eb" opacity=".4" stroke="#2563eb" strokeWidth="1"/><path d="M19 24h10" stroke="#2563eb" strokeWidth="1" strokeDasharray="2 2" opacity=".5"/></svg> },
              { title:"Webデザイン・システム開発",sub:"Web Design & Dev",grad:"135deg,#1a2e4a,#0c1929",desc:"予約管理・顧客管理・業務効率化システムの設計から開発、運用まで。モダンな技術スタックで高速かつ美しいWebアプリケーションを構築。",tags:["業務システム","予約管理","モバイルUI","リアルタイム"],ic:"#06b6d4",
                svg:<svg width="48" height="48" viewBox="0 0 48 48" fill="none"><rect x="8" y="8" width="32" height="32" rx="4" stroke="#06b6d4" strokeWidth="1.5"/><rect x="12" y="13" width="12" height="8" rx="2" fill="#06b6d4" opacity=".15" stroke="#06b6d4" strokeWidth="1"/><rect x="12" y="25" width="24" height="3" rx="1.5" fill="#64748b" opacity=".3"/><rect x="12" y="32" width="16" height="3" rx="1.5" fill="#64748b" opacity=".2"/><path d="M28 13l6 4-6 4" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg> },
              { title:"DX推進支援",sub:"Digital Transformation",grad:"135deg,#1a2340,#0c1929",desc:"紙やExcelの業務をデジタル化。クラウドシステム導入から社内教育まで、DX推進をトータルサポートします。",tags:["プロセス改善","クラウド移行","データ可視化","DX教育"],ic:"#7c3aed",
                svg:<svg width="48" height="48" viewBox="0 0 48 48" fill="none"><rect x="10" y="24" width="8" height="16" rx="2" fill="#7c3aed" opacity=".2" stroke="#7c3aed" strokeWidth="1"/><rect x="20" y="16" width="8" height="24" rx="2" fill="#3b82f6" opacity=".2" stroke="#3b82f6" strokeWidth="1"/><rect x="30" y="10" width="8" height="30" rx="2" fill="#06b6d4" opacity=".2" stroke="#06b6d4" strokeWidth="1"/><path d="M12 12l10 6 10-4 10 2" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><circle cx="12" cy="12" r="2.5" fill="#7c3aed"/><circle cx="22" cy="18" r="2.5" fill="#3b82f6"/><circle cx="32" cy="14" r="2.5" fill="#06b6d4"/></svg> },
            ].map((s,i) => (
              <div key={i} className="ch" style={{ background:`linear-gradient(${s.grad})`,borderRadius:18,border:"1px solid rgba(96,165,250,0.1)",padding:"36px 28px",display:"flex",flexDirection:"column",transition:"all .4s",transitionDelay:`${i*80}ms` }}>
                <div style={{ width:72,height:72,borderRadius:16,background:`radial-gradient(circle at 30% 30%,${s.ic}15,transparent)`,border:`1px solid ${s.ic}25`,display:"flex",alignItems:"center",justifyContent:"center",marginBottom:24,animation:"glow 4s ease-in-out infinite" }}>{s.svg}</div>
                <span style={{ fontSize:10,fontWeight:700,color:s.ic,letterSpacing:2.5,textTransform:"uppercase" }}>{s.sub}</span>
                <h3 style={{ fontSize:21,fontWeight:800,marginTop:8,color:"#f8fafc",fontFamily:"Inter,'Noto Sans JP'" }}>{s.title}</h3>
                <p style={{ fontSize:13,lineHeight:1.85,color:"#94a3b8",marginTop:14,flex:1 }}>{s.desc}</p>
                <div style={{ display:"flex",flexWrap:"wrap",gap:6,marginTop:22 }}>
                  {s.tags.map((t) => (<span key={t} style={{ fontSize:10,fontWeight:600,padding:"5px 12px",borderRadius:6,background:`${s.ic}12`,color:s.ic,border:`1px solid ${s.ic}20` }}>{t}</span>))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Divider ── */}
      <div style={{ height:1,background:"linear-gradient(90deg,transparent,rgba(6,182,212,0.3),rgba(124,58,237,0.3),transparent)" }}/>

      {/* ══════════ STATS ══════════ */}
      <section id="stats" data-a style={{ padding:"80px 24px",background:"linear-gradient(180deg,#020617,#0a1628,#020617)" }}>
        <div className={`fu ${show("stats")?"on":""}`} style={{ maxWidth:1000,margin:"0 auto" }}>
          <div style={{ textAlign:"center",marginBottom:48 }}>
            <span style={{ fontSize:11,fontWeight:700,color:"#06b6d4",letterSpacing:3 }}>ACHIEVEMENTS</span>
            <h2 style={{ fontFamily:"Inter,'Noto Sans JP'",fontSize:"clamp(24px,3.5vw,36px)",fontWeight:800,marginTop:12,color:"#f8fafc" }}>数字で見る実績</h2>
          </div>
          <div className="stats-grid" style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:20 }}>
            {[
              { num:50,suffix:"+",label:"開発プロジェクト",color:"#2563eb" },
              { num:99,suffix:"%",label:"システム稼働率",color:"#06b6d4" },
              { num:30,suffix:"+",label:"導入企業数",color:"#7c3aed" },
              { num:24,suffix:"h",label:"サポート対応",color:"#059669" },
            ].map((s,i) => (
              <div key={i} style={{ textAlign:"center",padding:"32px 16px",borderRadius:16,background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.06)",transition:"border-color .4s,box-shadow .4s" }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor=`${s.color}40`; e.currentTarget.style.boxShadow=`0 0 30px ${s.color}15`; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor="rgba(255,255,255,0.06)"; e.currentTarget.style.boxShadow="none"; }}
              >
                <div style={{ fontSize:"clamp(32px,4vw,48px)",fontWeight:900,fontFamily:"Inter",color:s.color,lineHeight:1 }}><Counter target={s.num} suffix={s.suffix}/></div>
                <div style={{ fontSize:12,color:"#64748b",marginTop:10,fontWeight:500,letterSpacing:.5 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Divider ── */}
      <div style={{ height:1,background:"linear-gradient(90deg,transparent,rgba(37,99,235,0.3),rgba(6,182,212,0.2),transparent)" }}/>

      {/* ══════════ TECH ══════════ */}
      <section id="tech" data-a style={{ padding:"80px 24px",background:"#020617" }}>
        <div className={`fu ${show("tech")?"on":""}`} style={{ maxWidth:1100,margin:"0 auto" }}>
          <div style={{ textAlign:"center",marginBottom:56 }}>
            <span style={{ fontSize:11,fontWeight:700,color:"#2563eb",letterSpacing:3 }}>TECHNOLOGY</span>
            <h2 style={{ fontFamily:"Inter,'Noto Sans JP'",fontSize:"clamp(24px,3.5vw,36px)",fontWeight:800,marginTop:12,color:"#f8fafc" }}>技術スタック</h2>
            <div style={{ width:60,height:3,borderRadius:2,background:"linear-gradient(90deg,#2563eb,#06b6d4)",margin:"16px auto 0" }}/>
          </div>
          <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(230px,1fr))",gap:16 }}>
            {[
              { cat:"Frontend",items:["Next.js (React)","TypeScript","Tailwind CSS"],color:"#3b82f6",icon:"◈" },
              { cat:"Backend / DB",items:["Supabase (PostgreSQL)","Edge Functions","Realtime"],color:"#06b6d4",icon:"◇" },
              { cat:"AI / ML",items:["Anthropic Claude API","自然言語処理 (NLP)","RAG 構築"],color:"#7c3aed",icon:"◆" },
              { cat:"Infrastructure",items:["Vercel","GitHub CI/CD","CDN 配信"],color:"#059669",icon:"▣" },
            ].map((t,i) => (
              <div key={i} className="ch" style={{ background:"rgba(255,255,255,0.02)",borderRadius:14,padding:"28px 22px",border:"1px solid rgba(255,255,255,0.06)",transition:"all .35s" }}>
                <div style={{ fontSize:10,fontWeight:800,color:t.color,letterSpacing:2,textTransform:"uppercase",marginBottom:16,paddingBottom:12,borderBottom:`2px solid ${t.color}20`,display:"flex",alignItems:"center",gap:8 }}>
                  <span style={{ fontSize:14,filter:`drop-shadow(0 0 4px ${t.color})` }}>{t.icon}</span>{t.cat}
                </div>
                {t.items.map((item) => (
                  <div key={item} style={{ fontSize:13,fontWeight:500,color:"#cbd5e1",padding:"9px 0",borderBottom:"1px solid rgba(255,255,255,0.04)",display:"flex",alignItems:"center",gap:10 }}>
                    <div style={{ width:5,height:5,borderRadius:"50%",background:t.color,boxShadow:`0 0 6px ${t.color}60` }}/>{item}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Divider ── */}
      <div style={{ height:1,background:"linear-gradient(90deg,transparent,rgba(124,58,237,0.3),rgba(37,99,235,0.3),transparent)" }}/>

      {/* ══════════ COMPANY ══════════ */}
      <section id="company" data-a style={{ padding:"80px 24px",background:"#020617" }}>
        <div className={`fu ${show("company")?"on":""}`} style={{ maxWidth:900,margin:"0 auto" }}>
          <div style={{ textAlign:"center",marginBottom:56 }}>
            <span style={{ fontSize:11,fontWeight:700,color:"#2563eb",letterSpacing:3 }}>COMPANY</span>
            <h2 style={{ fontFamily:"Inter,'Noto Sans JP'",fontSize:"clamp(24px,3.5vw,36px)",fontWeight:800,marginTop:12,color:"#f8fafc" }}>会社概要</h2>
          </div>
          <div style={{ borderRadius:18,overflow:"hidden",border:"1px solid rgba(96,165,250,0.12)",boxShadow:"0 8px 40px rgba(0,0,0,0.3)",animation:"borderGlow 6s ease-in-out infinite" }}>
            <div style={{ padding:"36px 40px",background:"linear-gradient(135deg,#0f2847,#0a1628)",display:"flex",alignItems:"center",gap:20,borderBottom:"1px solid rgba(96,165,250,0.1)" }}>
              <div style={{ width:60,height:60,borderRadius:14,background:"linear-gradient(135deg,#2563eb,#06b6d4)",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:900,fontSize:24,fontFamily:"Inter",boxShadow:"0 0 30px rgba(37,99,235,0.3)",flexShrink:0 }}>TL</div>
              <div>
                <div style={{ fontSize:22,fontWeight:800,color:"#f8fafc",letterSpacing:.5 }}>{CO.name}</div>
                <div style={{ fontSize:12,color:"#60a5fa",letterSpacing:2,marginTop:3,fontWeight:600 }}>{CO.nameEn}</div>
              </div>
            </div>
            <div style={{ padding:"0 40px",background:"rgba(10,22,40,0.5)" }}>
              {[
                { l:"商号",v:CO.name },{ l:"代表者",v:CO.rep },{ l:"所在地",v:CO.addr },
                { l:"設立",v:CO.est },{ l:"資本金",v:CO.capital },{ l:"決算期",v:CO.fiscal },
                { l:"事業内容",v:"AIソリューション開発、Webデザイン・システム開発、DX推進支援" },
                { l:"メール",v:CO.email },{ l:"電話",v:CO.tel },
              ].map((r,i) => (
                <div key={i} style={{ display:"flex",padding:"18px 0",borderBottom:"1px solid rgba(255,255,255,0.04)",gap:24,alignItems:"baseline" }}>
                  <span style={{ fontSize:12,fontWeight:700,color:"#60a5fa",minWidth:80,flexShrink:0,letterSpacing:.5 }}>{r.l}</span>
                  <span style={{ fontSize:14,fontWeight:500,color:"#e2e8f0",lineHeight:1.6 }}>{r.v}</span>
                </div>
              ))}
            </div>
            <div style={{ height:20,background:"rgba(10,22,40,0.5)" }}/>
          </div>
        </div>
      </section>

      {/* ── Animated divider ── */}
      <div style={{ height:1,background:"linear-gradient(90deg,transparent,rgba(37,99,235,0.4),rgba(6,182,212,0.4),transparent)",position:"relative",overflow:"hidden" }}>
        <div style={{ position:"absolute",top:0,left:0,width:"30%",height:"100%",background:"linear-gradient(90deg,transparent,rgba(255,255,255,0.3),transparent)",animation:"slideRight 3s linear infinite" }}/>
      </div>

      {/* ══════════ CONTACT ══════════ */}
      <section id="contact" data-a style={{ padding:"80px 24px",background:"radial-gradient(ellipse at 50% 0%,#0f2847,#020617 70%)" }}>
        <div className={`fu ${show("contact")?"on":""}`} style={{ maxWidth:640,margin:"0 auto" }}>
          <div style={{ textAlign:"center",marginBottom:48 }}>
            <span style={{ fontSize:11,fontWeight:700,color:"#60a5fa",letterSpacing:3 }}>CONTACT</span>
            <h2 style={{ fontFamily:"Inter,'Noto Sans JP'",fontSize:"clamp(24px,3.5vw,36px)",fontWeight:800,marginTop:12,color:"#f8fafc" }}>お問い合わせ</h2>
            <p style={{ fontSize:14,color:"#94a3b8",marginTop:14,lineHeight:1.8 }}>ご相談・お見積もりなど、お気軽にご連絡ください。</p>
          </div>
          {!sent ? (
            <div style={{ background:"rgba(255,255,255,0.02)",borderRadius:18,border:"1px solid rgba(96,165,250,0.1)",padding:40,backdropFilter:"blur(8px)" }}>
              {([{key:"name" as const,label:"お名前",type:"text",ph:"山田 太郎"},{key:"email" as const,label:"メールアドレス",type:"email",ph:"example@email.com"}]).map((f) => (
                <div key={f.key} style={{ marginBottom:22 }}>
                  <label style={{ display:"block",fontSize:11,fontWeight:700,color:"#60a5fa",marginBottom:8,letterSpacing:1 }}>{f.label}</label>
                  <input type={f.type} value={form[f.key]} onChange={(e) => setForm({...form,[f.key]:e.target.value})} placeholder={f.ph}
                    style={{ width:"100%",padding:"14px 18px",borderRadius:10,border:"1px solid rgba(96,165,250,0.15)",background:"rgba(255,255,255,0.03)",color:"#f8fafc",fontSize:14,outline:"none",transition:"border-color .3s,box-shadow .3s" }}
                    onFocus={(e) => { e.currentTarget.style.borderColor="rgba(37,99,235,0.5)"; e.currentTarget.style.boxShadow="0 0 20px rgba(37,99,235,0.1)"; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor="rgba(96,165,250,0.15)"; e.currentTarget.style.boxShadow="none"; }}
                  />
                </div>
              ))}
              <div style={{ marginBottom:28 }}>
                <label style={{ display:"block",fontSize:11,fontWeight:700,color:"#60a5fa",marginBottom:8,letterSpacing:1 }}>お問い合わせ内容</label>
                <textarea value={form.body} onChange={(e) => setForm({...form,body:e.target.value})} placeholder="ご相談内容をご記入ください" rows={5}
                  style={{ width:"100%",padding:"14px 18px",borderRadius:10,border:"1px solid rgba(96,165,250,0.15)",background:"rgba(255,255,255,0.03)",color:"#f8fafc",fontSize:14,outline:"none",resize:"vertical",transition:"border-color .3s,box-shadow .3s" }}
                  onFocus={(e) => { e.currentTarget.style.borderColor="rgba(37,99,235,0.5)"; e.currentTarget.style.boxShadow="0 0 20px rgba(37,99,235,0.1)"; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor="rgba(96,165,250,0.15)"; e.currentTarget.style.boxShadow="none"; }}
                />
              </div>
              <button onClick={submit} style={{ width:"100%",padding:"16px 0",borderRadius:10,border:"none",cursor:"pointer",background:form.name&&form.email&&form.body?"linear-gradient(135deg,#2563eb,#1d4ed8)":"#1e293b",color:"#fff",fontSize:14,fontWeight:700,letterSpacing:1,boxShadow:form.name&&form.email&&form.body?"0 0 40px rgba(37,99,235,0.3)":"none",transition:"all .3s" }}>送信する</button>
            </div>
          ) : (
            <div style={{ background:"rgba(255,255,255,0.02)",borderRadius:18,border:"1px solid rgba(34,197,94,0.2)",padding:"56px 36px",textAlign:"center",backdropFilter:"blur(8px)" }}>
              <div style={{ width:64,height:64,borderRadius:"50%",background:"rgba(34,197,94,0.1)",border:"2px solid rgba(34,197,94,0.3)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 20px",fontSize:28,boxShadow:"0 0 30px rgba(34,197,94,0.15)" }}>✓</div>
              <p style={{ fontSize:20,fontWeight:700,color:"#f8fafc" }}>送信完了しました</p>
              <p style={{ fontSize:14,color:"#94a3b8",marginTop:10 }}>内容を確認のうえ、折り返しご連絡いたします。</p>
            </div>
          )}
        </div>
      </section>

      {/* ══════════ FOOTER ══════════ */}
      <footer style={{ padding:"40px 24px 28px",background:"#020617",borderTop:"1px solid rgba(96,165,250,0.08)" }}>
        <div style={{ maxWidth:1100,margin:"0 auto",display:"flex",flexWrap:"wrap",justifyContent:"space-between",alignItems:"center",gap:20 }}>
          <div style={{ display:"flex",alignItems:"center",gap:10 }}>
            <div style={{ width:28,height:28,borderRadius:6,background:"linear-gradient(135deg,#2563eb,#06b6d4)",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:800,fontSize:10,fontFamily:"Inter" }}>TL</div>
            <div><div style={{ fontSize:11,fontWeight:700,color:"#64748b",letterSpacing:1 }}>TERRACE LIFE</div><div style={{ fontSize:9,color:"#334155" }}>{CO.name}</div></div>
          </div>
          <p style={{ fontSize:11,color:"#334155" }}>© {new Date().getFullYear()} {CO.name}. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
