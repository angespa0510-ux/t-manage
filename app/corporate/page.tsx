"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "../../lib/supabase";

/* ═══════════════════════════════════════════
   合同会社テラスライフ — コーポレートサイト v3
   DB連携 / 代表挨拶 / お知らせ / 地図 / FAQ
   ═══════════════════════════════════════════ */

type CompanyInfo = {
  company_name: string;
  company_name_en: string;
  company_address: string;
  company_phone: string;
  company_email: string;
  company_established: string;
  company_capital: string;
  company_fiscal: string;
  company_business: string;
  company_tagline: string;
  company_employees: string;
  company_main_bank: string;
  company_website_url: string;
  company_map_embed: string;
  representative_name: string;
  representative_name_kana: string;
  representative_title: string;
  representative_photo_url: string;
  representative_message: string;
};

type NewsItem = { id: number; title: string; category: string; body: string; link_url: string; published_at: string };
type FaqItem = { id: number; category: string; question: string; answer: string };

const DEFAULT_CO: CompanyInfo = {
  company_name: "合同会社テラスライフ",
  company_name_en: "Terrace Life LLC",
  company_address: "愛知県安城市",
  company_phone: "",
  company_email: "",
  company_established: "",
  company_capital: "",
  company_fiscal: "3月決算",
  company_business: "AIソリューション開発、Webデザイン・システム開発、DX推進支援",
  company_tagline: "テクノロジーで、ビジネスの未来をデザインする。",
  company_employees: "",
  company_main_bank: "",
  company_website_url: "",
  company_map_embed: "",
  representative_name: "",
  representative_name_kana: "",
  representative_title: "代表社員",
  representative_photo_url: "",
  representative_message: "",
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
  const [hoveredTech, setHoveredTech] = useState<string | null>(null);
  const [CO, setCO] = useState<CompanyInfo>(DEFAULT_CO);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [faqs, setFaqs] = useState<FaqItem[]>([]);
  const [faqCategory, setFaqCategory] = useState<string>("all");
  const [openFaqId, setOpenFaqId] = useState<number | null>(null);

  // ── DB連携: 会社情報、お知らせ、FAQ を読込 ──
  useEffect(() => {
    (async () => {
      try {
        const { data: store } = await supabase.from("stores").select("*").order("id").limit(1).single();
        if (store) {
          setCO({
            company_name: store.company_name || DEFAULT_CO.company_name,
            company_name_en: store.company_name_en || DEFAULT_CO.company_name_en,
            company_address: store.company_address || DEFAULT_CO.company_address,
            company_phone: store.company_phone || DEFAULT_CO.company_phone,
            company_email: store.company_email || DEFAULT_CO.company_email,
            company_established: store.company_established || DEFAULT_CO.company_established,
            company_capital: store.company_capital || DEFAULT_CO.company_capital,
            company_fiscal: store.company_fiscal || DEFAULT_CO.company_fiscal,
            company_business: store.company_business || DEFAULT_CO.company_business,
            company_tagline: store.company_tagline || DEFAULT_CO.company_tagline,
            company_employees: store.company_employees || "",
            company_main_bank: store.company_main_bank || "",
            company_website_url: store.company_website_url || "",
            company_map_embed: store.company_map_embed || "",
            representative_name: store.representative_name || "",
            representative_name_kana: store.representative_name_kana || "",
            representative_title: store.representative_title || "代表社員",
            representative_photo_url: store.representative_photo_url || "",
            representative_message: store.representative_message || "",
          });
        }
      } catch (e) { console.log("stores not yet migrated:", e); }
      try {
        const { data: n } = await supabase.from("corporate_news").select("*").eq("is_published", true).order("published_at", { ascending: false }).limit(5);
        if (n) setNews(n);
      } catch (e) { console.log("corporate_news not yet created:", e); }
      try {
        const { data: f } = await supabase.from("corporate_faqs").select("*").eq("is_published", true).order("sort_order");
        if (f) setFaqs(f);
      } catch (e) { console.log("corporate_faqs not yet created:", e); }
    })();
  }, []);

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
    { id: "products", label: "プロダクト" },
    { id: "stats", label: "実績" },
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
        .sh{opacity:0;transform:translateX(80px);transition:opacity .7s cubic-bezier(.22,1,.36,1),transform .7s cubic-bezier(.22,1,.36,1)}
        .sh.on{opacity:1;transform:translateX(0)}
        .sh2{opacity:0;transform:translateX(80px);transition:opacity .7s cubic-bezier(.22,1,.36,1) .15s,transform .7s cubic-bezier(.22,1,.36,1) .15s}
        .sh2.on{opacity:1;transform:translateX(0)}
        .sh3{opacity:0;transform:translateX(80px);transition:opacity .7s cubic-bezier(.22,1,.36,1) .3s,transform .7s cubic-bezier(.22,1,.36,1) .3s}
        .sh3.on{opacity:1;transform:translateX(0)}
        .sline{width:0;transition:width .8s cubic-bezier(.22,1,.36,1) .4s}
        .sline.on{width:60px}
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
      <section id="hero" style={{ position:"relative",minHeight:"100vh",background:"#020617",display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden" }}>
        {/* Background video + image fallback */}
        <video autoPlay muted loop playsInline style={{ position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",opacity:0.35,zIndex:0 }} poster="/corporate/hero-bg.jpg">
          <source src="/corporate/hero-bg.mp4" type="video/mp4"/>
        </video>
        {/* Darkening overlay */}
        <div style={{ position:"absolute",inset:0,background:"linear-gradient(180deg, rgba(2,6,23,0.5) 0%, rgba(2,6,23,0.3) 50%, rgba(2,6,23,0.7) 100%)",zIndex:1 }}/>
        {/* Grid */}
        <div style={{ position:"absolute",inset:0,opacity:0.05,zIndex:2 }}>
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
      <section id="service" data-a style={{ position:"relative",padding:"100px 24px",background:"#020617",overflow:"hidden" }}>
        <video autoPlay muted loop playsInline style={{ position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",opacity:0.2,zIndex:0 }}>
          <source src="/corporate/services-bg.mp4" type="video/mp4"/>
        </video>
        <div style={{ position:"absolute",inset:0,background:"linear-gradient(180deg,rgba(2,6,23,0.6) 0%,rgba(2,6,23,0.3) 50%,rgba(2,6,23,0.6) 100%)",zIndex:1 }}/>
        <div className={`fu ${show("service")?"on":""}`} style={{ maxWidth:1100,margin:"0 auto",position:"relative",zIndex:2 }}>
          <div style={{ textAlign:"center",marginBottom:64 }}>
            <span className={`sh ${show("service")?"on":""}`} style={{ display:"inline-block",fontSize:11,fontWeight:700,color:"#2563eb",letterSpacing:3 }}>SERVICES</span>
            <h2 className={`sh2 ${show("service")?"on":""}`} style={{ fontFamily:"Inter,'Noto Sans JP'",fontSize:"clamp(26px,4vw,40px)",fontWeight:800,marginTop:14,color:"#f8fafc",letterSpacing:-.5 }}>事業内容</h2>
            <div className={`sline ${show("service")?"on":""}`} style={{ height:3,borderRadius:2,background:"linear-gradient(90deg,#2563eb,#06b6d4)",margin:"16px auto 0" }}/>
          </div>
          <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(300px,1fr))",gap:24 }}>
            {[
              { title:"AIソリューション開発",sub:"AI Solutions",grad:"135deg,#1e3a5f,#0c1929",desc:"業務特化型AIチャットボット、自動分類・レコメンドエンジン、データ分析AI。お客様の課題に合わせたAIソリューションを設計・開発します。",tags:["業務特化AI","自動分析","予測モデル","業務自動化"],ic:"#3b82f6",icon:"/corporate/icon-ai.png" },
              { title:"Webデザイン・システム開発",sub:"Web Design & Dev",grad:"135deg,#1a2e4a,#0c1929",desc:"予約管理・顧客管理・業務効率化システムの設計から開発、運用まで。モダンな技術スタックで高速かつ美しいWebアプリケーションを構築。",tags:["業務システム","予約管理","モバイルUI","リアルタイム"],ic:"#06b6d4",icon:"/corporate/icon-web.png" },
              { title:"DX推進支援",sub:"Digital Transformation",grad:"135deg,#1a2340,#0c1929",desc:"紙やExcelの業務をデジタル化。クラウドシステム導入から社内教育まで、DX推進をトータルサポートします。",tags:["プロセス改善","クラウド移行","データ可視化","DX教育"],ic:"#7c3aed",icon:"/corporate/icon-dx.png" },
            ].map((s,i) => (
              <div key={i} className="ch" style={{ background:`linear-gradient(${s.grad})`,borderRadius:18,border:"1px solid rgba(96,165,250,0.1)",padding:"36px 28px",display:"flex",flexDirection:"column",transition:"all .4s",transitionDelay:`${i*80}ms` }}>
                <div style={{ width:96,height:96,borderRadius:20,background:`radial-gradient(circle at 30% 30%,${s.ic}20,transparent 70%)`,border:`1px solid ${s.ic}25`,display:"flex",alignItems:"center",justifyContent:"center",marginBottom:24,animation:"glow 4s ease-in-out infinite",overflow:"hidden" }}>
                  <img src={s.icon} alt={s.sub} style={{ width:"90%",height:"90%",objectFit:"contain",filter:`drop-shadow(0 0 12px ${s.ic}60)` }}/>
                </div>
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

      {/* ══════════ PRODUCTS (3 cards → detail pages) ══════════ */}
      <section id="products" data-a style={{ position:"relative",padding:"100px 24px",background:"#020617",overflow:"hidden" }}>
        <video autoPlay muted loop playsInline style={{ position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",opacity:0.15,zIndex:0 }}><source src="/corporate/products-bg.mp4" type="video/mp4"/></video>
        <div style={{ position:"absolute",inset:0,background:"linear-gradient(180deg,rgba(2,6,23,0.7) 0%,rgba(2,6,23,0.3) 50%,rgba(2,6,23,0.7) 100%)",zIndex:1 }}/>
        <div className={`fu ${show("products")?"on":""}`} style={{ maxWidth:1100,margin:"0 auto",position:"relative",zIndex:2 }}>
          <div style={{ textAlign:"center",marginBottom:64 }}>
            <span className={`sh ${show("products")?"on":""}`} style={{ display:"inline-block",fontSize:11,fontWeight:700,color:"#06b6d4",letterSpacing:3 }}>PRODUCTS</span>
            <h2 className={`sh2 ${show("products")?"on":""}`} style={{ fontFamily:"Inter,'Noto Sans JP'",fontSize:"clamp(26px,4vw,40px)",fontWeight:800,marginTop:14,color:"#f8fafc",letterSpacing:-.5 }}>プロダクト</h2>
            <div className={`sline ${show("products")?"on":""}`} style={{ height:3,borderRadius:2,background:"linear-gradient(90deg,#06b6d4,#7c3aed)",margin:"16px auto 0" }}/>
            <p className={`sh3 ${show("products")?"on":""}`} style={{ fontSize:14,color:"#94a3b8",marginTop:16,lineHeight:1.8 }}>現場の課題から生まれた、3つのプロダクト</p>
          </div>

          <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(320px,1fr))",gap:24 }}>
            {[
              {
                name: "TERA AI",
                tagline: "AI 業務支援プラットフォーム",
                desc: "社内ナレッジをAIが学習し、スタッフの問い合わせに24時間自動応答。書類のAI読取・自動分類、データ分析による経営予測まで。業務のあらゆる場面にAIを。",
                features: ["社内AIチャットボット","書類AI読取・自動分類","売上予測・データ分析"],
                color: "#3b82f6",
                href: "/corporate/products/ai",
                badge: "AI",
                img: "/corporate/product-ai.jpg",
              },
              {
                name: "TERA Cloud",
                tagline: "クラウド業務管理システム",
                desc: "予約管理・シフト・売上・顧客情報を一元化。リアルタイム同期でどこからでもアクセス。スマホ対応のお客様ポータルで、予約・通知・履歴管理をセルフサービス化。",
                features: ["予約・シフト・売上管理","リアルタイム同期","顧客ポータル"],
                color: "#06b6d4",
                href: "/corporate/products/web",
                badge: "Cloud",
                img: "/corporate/product-cloud.jpg",
              },
              {
                name: "TERA DX",
                tagline: "DX 推進パッケージ",
                desc: "紙の契約書を電子署名に。手書き帳簿をAI自動記帳に。属人的なノウハウをナレッジベースに。御社のアナログ業務をゼロから再設計します。",
                features: ["電子契約・書類管理","AI帳簿・税務支援","ナレッジベース構築"],
                color: "#7c3aed",
                href: "/corporate/products/dx",
                badge: "DX",
                img: "/corporate/product-dx.jpg",
              },
            ].map((p,i) => (
              <a key={i} href={p.href} className="ch" style={{
                display:"block",textDecoration:"none",
                background:"linear-gradient(135deg,rgba(15,28,47,0.9),rgba(10,22,40,0.95))",
                borderRadius:20,border:"1px solid rgba(96,165,250,0.08)",
                overflow:"hidden",transition:"all .4s",cursor:"pointer",
              }}>
                {/* Top accent bar */}
                <div style={{ height:3,background:`linear-gradient(90deg,${p.color},${p.color}80)` }}/>
                {/* Product screenshot */}
                <div style={{ padding:"16px 16px 0",overflow:"hidden" }}>
                  <img src={p.img} alt={p.name} style={{ width:"100%",height:180,objectFit:"cover",borderRadius:10,border:"1px solid rgba(96,165,250,0.1)" }}/>
                </div>
                <div style={{ padding:"32px 28px" }}>
                  {/* Badge + tagline */}
                  <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:20 }}>
                    <span style={{
                      fontSize:10,fontWeight:800,padding:"4px 10px",borderRadius:6,
                      background:`${p.color}15`,color:p.color,border:`1px solid ${p.color}30`,
                      letterSpacing:1.5,
                    }}>{p.badge}</span>
                    <span style={{ fontSize:10,fontWeight:600,color:"#94a3b8",letterSpacing:1 }}>{p.tagline}</span>
                  </div>
                  {/* Product name */}
                  <h3 style={{ fontSize:28,fontWeight:900,color:"#f8fafc",fontFamily:"Inter,'Noto Sans JP'",letterSpacing:-0.5,marginBottom:16 }}>{p.name}</h3>
                  {/* Description */}
                  <p style={{ fontSize:13,lineHeight:1.85,color:"#94a3b8",marginBottom:24 }}>{p.desc}</p>
                  {/* Features */}
                  <div style={{ display:"flex",flexDirection:"column",gap:8,marginBottom:24 }}>
                    {p.features.map(f => (
                      <div key={f} style={{ display:"flex",alignItems:"center",gap:10 }}>
                        <div style={{ width:6,height:6,borderRadius:"50%",background:p.color,boxShadow:`0 0 8px ${p.color}50`,flexShrink:0 }}/>
                        <span style={{ fontSize:12,fontWeight:500,color:"#cbd5e1" }}>{f}</span>
                      </div>
                    ))}
                  </div>
                  {/* CTA */}
                  <div style={{
                    display:"flex",alignItems:"center",justifyContent:"center",gap:8,
                    padding:"12px 0",borderRadius:10,
                    background:`${p.color}10`,border:`1px solid ${p.color}25`,
                    fontSize:13,fontWeight:700,color:p.color,letterSpacing:.5,
                    transition:"all .3s",
                  }}>
                    詳しく見る →
                  </div>
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>

      <section id="stats" data-a style={{ position:"relative",padding:"80px 24px",background:"linear-gradient(180deg,#020617,#0a1628,#020617)",overflow:"hidden" }}>
        <video autoPlay muted loop playsInline style={{ position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",opacity:0.2,zIndex:0 }}><source src="/corporate/stats-bg.mp4" type="video/mp4"/></video>
        <div style={{ position:"absolute",inset:0,background:"linear-gradient(180deg,rgba(2,6,23,0.6) 0%,rgba(2,6,23,0.3) 50%,rgba(2,6,23,0.6) 100%)",zIndex:1 }}/>
        <div className={`fu ${show("stats")?"on":""}`} style={{ maxWidth:1000,margin:"0 auto",position:"relative",zIndex:2 }}>
          <div style={{ textAlign:"center",marginBottom:48 }}>
            <span className={`sh ${show("stats")?"on":""}`} style={{ display:"inline-block",fontSize:11,fontWeight:700,color:"#06b6d4",letterSpacing:3 }}>ACHIEVEMENTS</span>
            <h2 className={`sh2 ${show("stats")?"on":""}`} style={{ fontFamily:"Inter,'Noto Sans JP'",fontSize:"clamp(24px,3.5vw,36px)",fontWeight:800,marginTop:12,color:"#f8fafc" }}>数字で見る実績</h2>
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

          {/* ── 導入企業ロゴ ── */}
          <div style={{ marginTop:56,textAlign:"center" }}>
            <p className={`sh3 ${show("stats")?"on":""}`} style={{ fontSize:11,fontWeight:600,color:"#475569",letterSpacing:2,marginBottom:28 }}>TRUSTED BY</p>
            <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:"20px 24px",maxWidth:900,margin:"0 auto" }}>
              {[
                { name:"東海フーズ", sub:"TOKAI FOODS", logo:"/corporate/logo-tokai.png" },
                { name:"サクラメディカル", sub:"SAKURA MEDICAL", logo:"/corporate/logo-sakura.png" },
                { name:"ネクストワン", sub:"NEXT ONE", logo:"/corporate/logo-nextone.png" },
                { name:"グローバルエステート", sub:"GLOBAL ESTATE", logo:"/corporate/logo-global.png" },
                { name:"中部ロジスティクス", sub:"CHUBU LOGISTICS", logo:"/corporate/logo-chubu.png" },
              ].map((c, i) => (
                <div key={i} style={{ display:"flex",alignItems:"center",gap:12,opacity:0.6,transition:"opacity .3s",cursor:"default" }}
                  onMouseEnter={e => e.currentTarget.style.opacity = "1"}
                  onMouseLeave={e => e.currentTarget.style.opacity = "0.6"}
                >
                  <img src={c.logo} alt={c.name} style={{ width:40,height:40,objectFit:"contain",borderRadius:6 }}/>
                  <div style={{ textAlign:"left" }}>
                    <div style={{ fontSize:13,fontWeight:700,color:"#cbd5e1",letterSpacing:.3 }}>{c.name}</div>
                    <div style={{ fontSize:9,fontWeight:500,color:"#475569",letterSpacing:1.5 }}>{c.sub}</div>
                  </div>
                </div>
              ))}
            </div>
            <p style={{ fontSize:10,color:"#334155",marginTop:20 }}>※ 一部企業のみ掲載（許可をいただいた企業様）</p>
          </div>
        </div>
      </section>

      {/* ── Divider ── */}
      <div style={{ height:1,background:"linear-gradient(90deg,transparent,rgba(37,99,235,0.3),rgba(6,182,212,0.2),transparent)" }}/>

      {/* ══════════ TECH ══════════ */}
      <section id="tech" data-a style={{ position:"relative",padding:"80px 24px",background:"#020617",overflow:"hidden" }}>
        <video autoPlay muted loop playsInline style={{ position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",opacity:0.15,zIndex:0 }}><source src="/corporate/tech-bg.mp4" type="video/mp4"/></video>
        <div style={{ position:"absolute",inset:0,background:"linear-gradient(180deg,rgba(2,6,23,0.6) 0%,rgba(2,6,23,0.3) 50%,rgba(2,6,23,0.6) 100%)",zIndex:1 }}/>
        <div className={`fu ${show("tech")?"on":""}`} style={{ maxWidth:1100,margin:"0 auto",position:"relative",zIndex:2 }}>
          <div style={{ textAlign:"center",marginBottom:56 }}>
            <span className={`sh ${show("tech")?"on":""}`} style={{ display:"inline-block",fontSize:11,fontWeight:700,color:"#2563eb",letterSpacing:3 }}>TECHNOLOGY</span>
            <h2 className={`sh2 ${show("tech")?"on":""}`} style={{ fontFamily:"Inter,'Noto Sans JP'",fontSize:"clamp(24px,3.5vw,36px)",fontWeight:800,marginTop:12,color:"#f8fafc" }}>技術スタック</h2>
            <div className={`sline ${show("tech")?"on":""}`} style={{ height:3,borderRadius:2,background:"linear-gradient(90deg,#2563eb,#06b6d4)",margin:"16px auto 0" }}/>
            <p className={`sh3 ${show("tech")?"on":""}`} style={{ fontSize:12,color:"#64748b",marginTop:14 }}>各技術にカーソルを合わせると詳細が表示されます</p>
          </div>
          <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(230px,1fr))",gap:16 }}>
            {([
              { cat:"Frontend",color:"#3b82f6",icon:"◈",items:[
                { name:"Next.js (React)", tip:"Reactベースのフルスタックフレームワーク。サーバーサイドレンダリング（SSR）とスタティック生成（SSG）を自動最適化し、SEOと表示速度を両立。App Routerによるファイルベースのルーティングで、開発効率も抜群です。" },
                { name:"TypeScript", tip:"JavaScriptに「型」を加えた言語。コードを書いている段階でエラーを検出できるため、バグの発生率を大幅に低減。チーム開発でもコードの意図が明確になり、保守性が飛躍的に向上します。" },
                { name:"Tailwind CSS", tip:"ユーティリティファーストのCSSフレームワーク。クラス名を組み合わせるだけで美しいUIを高速構築。デザインの一貫性を保ちながら、カスタムデザインの自由度も確保。ファイルサイズも最小限に最適化されます。" },
              ]},
              { cat:"Backend / DB",color:"#06b6d4",icon:"◇",items:[
                { name:"Supabase (PostgreSQL)", tip:"Firebase代替のオープンソースBaaS。世界最高峰のリレーショナルDB「PostgreSQL」をベースに、認証・ストレージ・リアルタイム同期をワンパッケージで提供。SQL の柔軟性とNoSQLの手軽さを両立します。" },
                { name:"Edge Functions", tip:"ユーザーに最も近いサーバーでコードを実行する技術。APIのレスポンスが従来の1/3〜1/5に高速化。サーバーレスなのでインフラ管理不要、アクセス増にも自動スケール対応です。" },
                { name:"Realtime", tip:"WebSocketを活用したリアルタイムデータ同期。DBの変更が全クライアントに瞬時に反映されるため、予約の変更やチャットメッセージが即座に画面に表示。複数人同時操作でもデータの整合性を保証します。" },
              ]},
              { cat:"AI / ML",color:"#7c3aed",icon:"◆",items:[
                { name:"Anthropic Claude API", tip:"世界最高水準のAIモデル「Claude」のAPI。日本語理解力が非常に高く、長文の文脈把握やニュアンスの理解に優れています。安全性に特化した設計で、ビジネス用途に最適。当社の全AIプロダクトのエンジンです。" },
                { name:"自然言語処理 (NLP)", tip:"人間が普段使う言葉（自然言語）をAIに理解させる技術。「売上の推移を教えて」のような曖昧な質問でも、意図を正確に解釈してデータを取得・回答。専門用語や業界固有の表現にも対応できるよう学習させています。" },
                { name:"RAG 構築", tip:"Retrieval-Augmented Generation（検索拡張生成）。AIが回答する際に、まず社内データベースから関連情報を検索し、その情報を根拠にして回答を生成する技術。「AIの幻覚（ハルシネーション）」を防ぎ、正確で信頼できる回答を実現します。" },
              ]},
              { cat:"Infrastructure",color:"#059669",icon:"▣",items:[
                { name:"Vercel", tip:"Next.jsの開発元が運営するホスティングプラットフォーム。GitHubにコードをプッシュするだけで自動デプロイ。世界中のCDNで配信されるため、日本からも海外からも高速アクセス。SSL証明書も自動設定でセキュリティ万全。" },
                { name:"GitHub CI/CD", tip:"コードの変更を自動でテスト・デプロイする仕組み。開発者がコードを書いてプッシュすると、自動テスト→ビルド→本番反映まで完全自動化。人為的なデプロイミスをゼロにし、リリースサイクルを高速化します。" },
                { name:"CDN 配信", tip:"Content Delivery Network。世界中に分散配置されたサーバーから、ユーザーに最も近い拠点からコンテンツを配信。ページの読み込み速度を劇的に向上させ、アクセス集中時にもサーバーダウンしない高い可用性を実現します。" },
              ]},
            ] as const).map((t,i) => (
              <div key={i} className="ch" style={{ background:"rgba(255,255,255,0.02)",borderRadius:14,padding:"28px 22px",border:"1px solid rgba(255,255,255,0.06)",transition:"all .35s" }}>
                <div style={{ fontSize:10,fontWeight:800,color:t.color,letterSpacing:2,textTransform:"uppercase",marginBottom:16,paddingBottom:12,borderBottom:`2px solid ${t.color}20`,display:"flex",alignItems:"center",gap:8 }}>
                  <span style={{ fontSize:14,filter:`drop-shadow(0 0 4px ${t.color})` }}>{t.icon}</span>{t.cat}
                </div>
                {t.items.map((item) => (
                  <div key={item.name} style={{ position:"relative" }}
                    onMouseEnter={() => setHoveredTech(item.name)}
                    onMouseLeave={() => setHoveredTech(null)}
                  >
                    <div style={{
                      fontSize:13,fontWeight:500,color:hoveredTech === item.name ? "#f8fafc" : "#cbd5e1",
                      padding:"10px 8px",borderBottom:"1px solid rgba(255,255,255,0.04)",
                      display:"flex",alignItems:"center",gap:10,cursor:"pointer",
                      borderRadius:8,transition:"all .25s",
                      background:hoveredTech === item.name ? `${t.color}12` : "transparent",
                    }}>
                      <div style={{ width:6,height:6,borderRadius:"50%",background:t.color,boxShadow:hoveredTech === item.name ? `0 0 12px ${t.color}` : `0 0 6px ${t.color}60`,transition:"all .25s",flexShrink:0 }}/>
                      {item.name}
                      <span style={{ marginLeft:"auto",fontSize:10,color:hoveredTech === item.name ? t.color : "#475569",transition:"color .25s" }}>ⓘ</span>
                    </div>
                    {/* Tooltip */}
                    {hoveredTech === item.name && (
                      <div style={{
                        position:"absolute",left:0,right:0,top:"100%",zIndex:30,
                        marginTop:4,padding:"16px 18px",borderRadius:14,
                        background:"rgba(15,23,42,0.97)",backdropFilter:"blur(16px)",
                        border:`1px solid ${t.color}30`,
                        boxShadow:`0 12px 40px rgba(0,0,0,0.5), 0 0 20px ${t.color}15`,
                        animation:"fadeUp .25s ease both",
                      }}>
                        <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:10 }}>
                          <div style={{ width:8,height:8,borderRadius:"50%",background:t.color,boxShadow:`0 0 10px ${t.color}` }}/>
                          <span style={{ fontSize:12,fontWeight:700,color:t.color }}>{item.name}</span>
                        </div>
                        <p style={{ fontSize:12,lineHeight:1.85,color:"#cbd5e1" }}>{item.tip}</p>
                        <div style={{ marginTop:10,display:"flex",alignItems:"center",gap:6 }}>
                          <div style={{ flex:1,height:2,borderRadius:1,background:`linear-gradient(90deg,${t.color}40,transparent)` }}/>
                          <span style={{ fontSize:9,color:"#475569",fontWeight:600,letterSpacing:1 }}>{t.cat}</span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Banner ── */}
      <div style={{ padding:"56px 24px",background:"linear-gradient(135deg,rgba(37,99,235,0.08),rgba(6,182,212,0.06),rgba(124,58,237,0.05))",borderTop:"1px solid rgba(37,99,235,0.1)",borderBottom:"1px solid rgba(37,99,235,0.1)" }}>
        <div style={{ maxWidth:700,margin:"0 auto",textAlign:"center" }}>
          <p style={{ fontSize:"clamp(18px,3vw,24px)",fontWeight:800,color:"#f8fafc",lineHeight:1.5,fontFamily:"Inter,'Noto Sans JP'" }}>まずはお気軽にご相談ください</p>
          <p style={{ fontSize:13,color:"#94a3b8",marginTop:12,lineHeight:1.8 }}>課題のヒアリングからお見積もりまで無料です。お気軽にお問い合わせください。</p>
          <div style={{ marginTop:28,display:"flex",gap:14,justifyContent:"center",flexWrap:"wrap" }}>
            <button onClick={() => go("contact")} style={{ padding:"14px 36px",borderRadius:10,border:"none",cursor:"pointer",background:"linear-gradient(135deg,#2563eb,#1d4ed8)",color:"#fff",fontSize:13,fontWeight:700,letterSpacing:.5,boxShadow:"0 0 30px rgba(37,99,235,0.3)",transition:"all .3s" }}
              onMouseEnter={(e) => { e.currentTarget.style.transform="translateY(-2px)"; e.currentTarget.style.boxShadow="0 0 50px rgba(37,99,235,0.4)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform="translateY(0)"; e.currentTarget.style.boxShadow="0 0 30px rgba(37,99,235,0.3)"; }}
            >お問い合わせ →</button>
            <button onClick={() => go("faq")} style={{ padding:"14px 36px",borderRadius:10,cursor:"pointer",background:"transparent",border:"1px solid rgba(148,163,184,0.2)",color:"#94a3b8",fontSize:13,fontWeight:600,transition:"all .3s" }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor="rgba(96,165,250,0.4)"; e.currentTarget.style.color="#60a5fa"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor="rgba(148,163,184,0.2)"; e.currentTarget.style.color="#94a3b8"; }}
            >よくある質問を見る</button>
          </div>
        </div>
      </div>

      {/* ── Divider ── */}
      <div style={{ height:1,background:"linear-gradient(90deg,transparent,rgba(124,58,237,0.3),rgba(37,99,235,0.3),transparent)" }}/>

      {/* ══════════ NEWS (お知らせ) ══════════ */}
      <section id="news" data-a style={{ padding:"80px 24px",background:"linear-gradient(180deg,#020617,#0a1628)" }}>
        <div className={`fu ${show("news")?"on":""}`} style={{ maxWidth:900,margin:"0 auto" }}>
          <div style={{ textAlign:"center",marginBottom:48 }}>
            <span className={`sh ${show("news")?"on":""}`} style={{ display:"inline-block",fontSize:11,fontWeight:700,color:"#06b6d4",letterSpacing:3 }}>NEWS</span>
            <h2 className={`sh2 ${show("news")?"on":""}`} style={{ fontFamily:"Inter,'Noto Sans JP'",fontSize:"clamp(24px,3.5vw,36px)",fontWeight:800,marginTop:12,color:"#f8fafc" }}>お知らせ</h2>
            <div className={`sline ${show("news")?"on":""}`} style={{ height:3,borderRadius:2,background:"linear-gradient(90deg,#06b6d4,#7c3aed)",margin:"16px auto 0" }}/>
          </div>
          {news.length === 0 ? (
            <div style={{ textAlign:"center",padding:"40px 0",color:"#475569",fontSize:13 }}>現在お知らせはありません</div>
          ) : (
            <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
              {news.map((n) => {
                const cat = n.category === "press" ? { label:"プレス", color:"#f59e0b" } :
                            n.category === "event" ? { label:"イベント", color:"#22c55e" } :
                            n.category === "update" ? { label:"更新", color:"#06b6d4" } :
                            { label:"お知らせ", color:"#60a5fa" };
                const dateStr = n.published_at ? new Date(n.published_at).toLocaleDateString("ja-JP", { year:"numeric", month:"2-digit", day:"2-digit" }) : "";
                return (
                  <div key={n.id} className="ch" style={{ padding:"20px 24px",background:"rgba(255,255,255,0.02)",borderRadius:12,border:"1px solid rgba(255,255,255,0.06)",display:"flex",gap:20,alignItems:"flex-start",flexWrap:"wrap",transition:"all .3s" }}>
                    <div style={{ display:"flex",flexDirection:"column",alignItems:"flex-start",gap:6,minWidth:140 }}>
                      <span style={{ fontSize:12,color:"#94a3b8",fontFamily:"Inter",fontWeight:500 }}>{dateStr}</span>
                      <span style={{ fontSize:10,fontWeight:700,padding:"3px 10px",borderRadius:4,background:`${cat.color}15`,color:cat.color,border:`1px solid ${cat.color}30`,letterSpacing:1 }}>{cat.label}</span>
                    </div>
                    <div style={{ flex:1,minWidth:200 }}>
                      <h3 style={{ fontSize:15,fontWeight:700,color:"#f8fafc",marginBottom:6,lineHeight:1.5 }}>{n.title}</h3>
                      {n.body && <p style={{ fontSize:12,lineHeight:1.8,color:"#94a3b8" }}>{n.body.length > 120 ? n.body.slice(0, 120) + "…" : n.body}</p>}
                      {n.link_url && <a href={n.link_url} target="_blank" rel="noopener noreferrer" style={{ display:"inline-block",marginTop:8,fontSize:11,color:"#60a5fa",fontWeight:600 }}>詳しく見る →</a>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div style={{ textAlign:"center",marginTop:28 }}>
            <a href="/corporate/news" style={{ display:"inline-flex",alignItems:"center",gap:6,padding:"10px 24px",borderRadius:8,border:"1px solid rgba(96,165,250,0.25)",background:"rgba(37,99,235,0.08)",color:"#60a5fa",fontSize:12,fontWeight:600,letterSpacing:.5 }}>すべてのお知らせ →</a>
          </div>
        </div>
      </section>

      {/* ── Divider ── */}
      <div style={{ height:1,background:"linear-gradient(90deg,transparent,rgba(124,58,237,0.3),rgba(37,99,235,0.3),transparent)" }}/>

      {/* ── Divider ── */}
      <div style={{ height:1,background:"linear-gradient(90deg,transparent,rgba(37,99,235,0.3),rgba(6,182,212,0.3),transparent)" }}/>

      {/* ══════════ MESSAGE (代表挨拶) ══════════ */}
      <section id="message" data-a style={{ padding:"100px 24px",background:"radial-gradient(ellipse at 30% 50%,#0f2847,#020617 70%)",position:"relative",overflow:"hidden" }}>
        <div style={{ position:"absolute",width:400,height:400,borderRadius:"50%",background:"radial-gradient(circle,rgba(37,99,235,0.1),transparent 70%)",top:"10%",right:"10%",animation:"orbFloat 14s ease-in-out infinite" }}/>
        <div className={`fu ${show("message")?"on":""}`} style={{ maxWidth:1000,margin:"0 auto",position:"relative",zIndex:2 }}>
          <div style={{ textAlign:"center",marginBottom:56 }}>
            <span className={`sh ${show("message")?"on":""}`} style={{ display:"inline-block",fontSize:11,fontWeight:700,color:"#60a5fa",letterSpacing:3 }}>MESSAGE</span>
            <h2 className={`sh2 ${show("message")?"on":""}`} style={{ fontFamily:"Inter,'Noto Sans JP'",fontSize:"clamp(24px,3.5vw,36px)",fontWeight:800,marginTop:12,color:"#f8fafc" }}>代表挨拶</h2>
            <div className={`sline ${show("message")?"on":""}`} style={{ height:3,borderRadius:2,background:"linear-gradient(90deg,#2563eb,#06b6d4)",margin:"16px auto 0" }}/>
          </div>
          <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:48,alignItems:"center" }}>
            {/* 代表者写真 */}
            <div style={{ display:"flex",flexDirection:"column",alignItems:"center",gap:16 }}>
              <div style={{ position:"relative",width:260,height:260,borderRadius:"50%",padding:4,background:"linear-gradient(135deg,#2563eb,#06b6d4,#7c3aed)",boxShadow:"0 0 40px rgba(37,99,235,0.3)" }}>
                {CO.representative_photo_url ? (
                  <img src={CO.representative_photo_url} alt={CO.representative_name} style={{ width:"100%",height:"100%",borderRadius:"50%",objectFit:"cover",border:"4px solid #020617" }}/>
                ) : (
                  <div style={{ width:"100%",height:"100%",borderRadius:"50%",background:"linear-gradient(135deg,#0f2847,#020617)",border:"4px solid #020617",display:"flex",alignItems:"center",justifyContent:"center",fontSize:64,color:"#334155" }}>👤</div>
                )}
              </div>
              <div style={{ textAlign:"center" }}>
                <div style={{ fontSize:11,fontWeight:600,color:"#60a5fa",letterSpacing:2,marginBottom:4 }}>{CO.representative_title || "代表社員"}</div>
                <div style={{ fontSize:20,fontWeight:800,color:"#f8fafc",fontFamily:"Inter,'Noto Sans JP'",letterSpacing:.5 }}>{CO.representative_name || "氏名未設定"}</div>
                {CO.representative_name_kana && <div style={{ fontSize:11,color:"#64748b",marginTop:2,letterSpacing:1 }}>{CO.representative_name_kana}</div>}
              </div>
            </div>
            {/* 挨拶文 */}
            <div style={{ padding:"32px 0" }}>
              <div style={{ fontSize:48,color:"#60a5fa",lineHeight:1,marginBottom:12,opacity:.4,fontFamily:"serif" }}>&ldquo;</div>
              <p style={{ fontSize:15,lineHeight:2.1,color:"#cbd5e1",whiteSpace:"pre-wrap" }}>
                {CO.representative_message || "代表メッセージを設定してください。スタッフページの「会社情報」タブから編集できます。"}
              </p>
              <div style={{ marginTop:28,display:"flex",alignItems:"center",gap:12 }}>
                <div style={{ flex:1,height:1,background:"linear-gradient(90deg,rgba(96,165,250,0.3),transparent)" }}/>
                <span style={{ fontSize:11,fontWeight:600,color:"#94a3b8",letterSpacing:1 }}>{CO.company_name}　{CO.representative_title} {CO.representative_name}</span>
              </div>
            </div>
          </div>
        </div>
      </section>



      {/* ══════════ COMPANY ══════════ */}
      <section id="company" data-a style={{ position:"relative",padding:"80px 24px",background:"#020617",overflow:"hidden" }}>
        <video autoPlay muted loop playsInline style={{ position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",opacity:0.15,zIndex:0 }}><source src="/corporate/company-bg.mp4" type="video/mp4"/></video>
        <div style={{ position:"absolute",inset:0,background:"linear-gradient(180deg,rgba(2,6,23,0.6) 0%,rgba(2,6,23,0.3) 50%,rgba(2,6,23,0.7) 100%)",zIndex:1 }}/>
        <div className={`fu ${show("company")?"on":""}`} style={{ maxWidth:900,margin:"0 auto",position:"relative",zIndex:2 }}>
          <div style={{ textAlign:"center",marginBottom:56 }}>
            <span className={`sh ${show("company")?"on":""}`} style={{ display:"inline-block",fontSize:11,fontWeight:700,color:"#2563eb",letterSpacing:3 }}>COMPANY</span>
            <h2 className={`sh2 ${show("company")?"on":""}`} style={{ fontFamily:"Inter,'Noto Sans JP'",fontSize:"clamp(24px,3.5vw,36px)",fontWeight:800,marginTop:12,color:"#f8fafc" }}>会社概要</h2>
          </div>
          <div style={{ borderRadius:18,overflow:"hidden",border:"1px solid rgba(96,165,250,0.12)",boxShadow:"0 8px 40px rgba(0,0,0,0.3)",animation:"borderGlow 6s ease-in-out infinite" }}>
            <div style={{ padding:"36px 40px",background:"linear-gradient(135deg,#0f2847,#0a1628)",display:"flex",alignItems:"center",gap:20,borderBottom:"1px solid rgba(96,165,250,0.1)" }}>
              <div style={{ width:60,height:60,borderRadius:14,background:"linear-gradient(135deg,#2563eb,#06b6d4)",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:900,fontSize:24,fontFamily:"Inter",boxShadow:"0 0 30px rgba(37,99,235,0.3)",flexShrink:0 }}>TL</div>
              <div>
                <div style={{ fontSize:22,fontWeight:800,color:"#f8fafc",letterSpacing:.5 }}>{CO.company_name}</div>
                <div style={{ fontSize:12,color:"#60a5fa",letterSpacing:2,marginTop:3,fontWeight:600 }}>{CO.company_name_en}</div>
              </div>
            </div>
            <div style={{ padding:"0 40px",background:"rgba(10,22,40,0.5)" }}>
              {[
                { l:"商号", v:CO.company_name },
                { l:"代表者", v:CO.representative_name ? `${CO.representative_title} ${CO.representative_name}${CO.representative_name_kana ? `（${CO.representative_name_kana}）` : ""}` : "未設定" },
                { l:"所在地", v:CO.company_address || "未設定" },
                { l:"設立", v:CO.company_established || "未設定" },
                { l:"資本金", v:CO.company_capital || "未設定" },
                { l:"決算期", v:CO.company_fiscal },
                { l:"従業員数", v:CO.company_employees || "—" },
                { l:"事業内容", v:CO.company_business },
                { l:"取引銀行", v:CO.company_main_bank || "—" },
                { l:"メール", v:CO.company_email || "—" },
                { l:"電話", v:CO.company_phone || "—" },
                { l:"URL", v:CO.company_website_url || "https://ange-spa.com" },
              ].filter(r => r.v && r.v !== "—" || ["取引銀行","従業員数","メール","電話"].includes(r.l)).map((r,i) => (
                <div key={i} style={{ display:"flex",padding:"18px 0",borderBottom:"1px solid rgba(255,255,255,0.04)",gap:24,alignItems:"baseline" }}>
                  <span style={{ fontSize:12,fontWeight:700,color:"#60a5fa",minWidth:80,flexShrink:0,letterSpacing:.5 }}>{r.l}</span>
                  <span style={{ fontSize:14,fontWeight:500,color:"#e2e8f0",lineHeight:1.6 }}>{r.v}</span>
                </div>
              ))}
            </div>
            <div style={{ height:20,background:"rgba(10,22,40,0.5)" }}/>
          </div>

          {/* ── Googleマップ ── */}
          {CO.company_map_embed && (
            <div style={{ marginTop:32,borderRadius:18,overflow:"hidden",border:"1px solid rgba(96,165,250,0.12)",boxShadow:"0 8px 40px rgba(0,0,0,0.3)" }}>
              <div style={{ padding:"14px 20px",background:"linear-gradient(135deg,#0f2847,#0a1628)",display:"flex",alignItems:"center",gap:10,borderBottom:"1px solid rgba(96,165,250,0.08)" }}>
                <span style={{ fontSize:16 }}>📍</span>
                <span style={{ fontSize:12,fontWeight:700,color:"#60a5fa",letterSpacing:1 }}>ACCESS MAP</span>
              </div>
              <div style={{ position:"relative",paddingBottom:"50%",height:0,overflow:"hidden",background:"#0a1628" }}>
                <iframe src={CO.company_map_embed} style={{ position:"absolute",top:0,left:0,width:"100%",height:"100%",border:0,filter:"grayscale(20%) contrast(1.1) brightness(.85)" }} loading="lazy" referrerPolicy="no-referrer-when-downgrade" title="所在地"/>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── Divider ── */}
      <div style={{ height:1,background:"linear-gradient(90deg,transparent,rgba(124,58,237,0.3),rgba(37,99,235,0.3),transparent)" }}/>

      {/* ══════════ FAQ ══════════ */}
      <section id="faq" data-a style={{ padding:"80px 24px",background:"linear-gradient(180deg,#020617,#0a1628,#020617)" }}>
        <div className={`fu ${show("faq")?"on":""}`} style={{ maxWidth:820,margin:"0 auto" }}>
          <div style={{ textAlign:"center",marginBottom:48 }}>
            <span className={`sh ${show("faq")?"on":""}`} style={{ display:"inline-block",fontSize:11,fontWeight:700,color:"#7c3aed",letterSpacing:3 }}>FAQ</span>
            <h2 className={`sh2 ${show("faq")?"on":""}`} style={{ fontFamily:"Inter,'Noto Sans JP'",fontSize:"clamp(24px,3.5vw,36px)",fontWeight:800,marginTop:12,color:"#f8fafc" }}>よくあるご質問</h2>
            <div className={`sline ${show("faq")?"on":""}`} style={{ height:3,borderRadius:2,background:"linear-gradient(90deg,#7c3aed,#06b6d4)",margin:"16px auto 0" }}/>
          </div>
          {faqs.length === 0 ? (
            <div style={{ textAlign:"center",padding:"40px 0",color:"#475569",fontSize:13 }}>FAQ準備中</div>
          ) : (
            <>
              {/* カテゴリフィルタ */}
              <div style={{ display:"flex",gap:8,justifyContent:"center",flexWrap:"wrap",marginBottom:24 }}>
                {["all", ...Array.from(new Set(faqs.map(f => f.category)))].map(c => (
                  <button key={c} onClick={() => setFaqCategory(c)} style={{
                    padding:"6px 16px",borderRadius:20,border:`1px solid ${faqCategory===c?"#7c3aed":"rgba(148,163,184,0.2)"}`,
                    background:faqCategory===c?"rgba(124,58,237,0.15)":"transparent",
                    color:faqCategory===c?"#a78bfa":"#94a3b8",
                    fontSize:11,fontWeight:600,cursor:"pointer",letterSpacing:.5,transition:"all .25s"
                  }}>{c === "all" ? "すべて" : c}</button>
                ))}
              </div>
              {/* FAQ リスト（アコーディオン） */}
              <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
                {faqs.filter(f => faqCategory === "all" || f.category === faqCategory).map((f) => (
                  <div key={f.id} style={{ borderRadius:12,border:"1px solid rgba(255,255,255,0.08)",background:"rgba(255,255,255,0.02)",overflow:"hidden",transition:"border-color .25s" }}>
                    <button onClick={() => setOpenFaqId(openFaqId === f.id ? null : f.id)} style={{
                      width:"100%",padding:"18px 22px",background:"none",border:"none",cursor:"pointer",
                      display:"flex",alignItems:"center",gap:14,textAlign:"left",color:"#f8fafc"
                    }}>
                      <span style={{ fontSize:14,fontWeight:800,color:"#7c3aed",fontFamily:"Inter",flexShrink:0 }}>Q.</span>
                      <span style={{ flex:1,fontSize:14,fontWeight:500,lineHeight:1.6 }}>{f.question}</span>
                      <span style={{ fontSize:18,color:"#64748b",transform:openFaqId===f.id?"rotate(180deg)":"rotate(0)",transition:"transform .25s",flexShrink:0 }}>⌄</span>
                    </button>
                    {openFaqId === f.id && (
                      <div style={{ padding:"0 22px 22px 22px",animation:"fadeIn .3s ease" }}>
                        <div style={{ display:"flex",gap:14,paddingTop:14,borderTop:"1px solid rgba(255,255,255,0.05)" }}>
                          <span style={{ fontSize:14,fontWeight:800,color:"#06b6d4",fontFamily:"Inter",flexShrink:0 }}>A.</span>
                          <p style={{ fontSize:13,lineHeight:1.95,color:"#cbd5e1",whiteSpace:"pre-wrap" }}>{f.answer}</p>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
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
            <span className={`sh ${show("contact")?"on":""}`} style={{ display:"inline-block",fontSize:11,fontWeight:700,color:"#60a5fa",letterSpacing:3 }}>CONTACT</span>
            <h2 className={`sh2 ${show("contact")?"on":""}`} style={{ fontFamily:"Inter,'Noto Sans JP'",fontSize:"clamp(24px,3.5vw,36px)",fontWeight:800,marginTop:12,color:"#f8fafc" }}>お問い合わせ</h2>
            <p className={`sh3 ${show("contact")?"on":""}`} style={{ fontSize:14,color:"#94a3b8",marginTop:14,lineHeight:1.8 }}>ご相談・お見積もりなど、お気軽にご連絡ください。</p>
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
              <p style={{ fontSize:10,color:"#475569",textAlign:"center",marginTop:12,lineHeight:1.8 }}>送信することで<a href="/corporate/privacy" style={{ color:"#60a5fa",textDecoration:"underline" }}>プライバシーポリシー</a>に同意したものとみなします。</p>
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

      {/* ══════════ RPG CHARACTERS ══════════ */}
      <RPGCharacters />

      {/* ══════════ FOOTER ══════════ */}
      <footer style={{ padding:"56px 24px 28px",background:"#020617",borderTop:"1px solid rgba(96,165,250,0.08)" }}>
        <div style={{ maxWidth:1100,margin:"0 auto" }}>
          {/* Top grid */}
          <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:40,marginBottom:40 }}>
            {/* Brand */}
            <div>
              <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:14 }}>
                <div style={{ width:36,height:36,borderRadius:8,background:"linear-gradient(135deg,#2563eb,#06b6d4)",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:800,fontSize:12,fontFamily:"Inter",boxShadow:"0 0 20px rgba(37,99,235,0.3)" }}>TL</div>
                <div>
                  <div style={{ fontSize:13,fontWeight:700,color:"#cbd5e1",letterSpacing:1,fontFamily:"Inter" }}>TERRACE LIFE</div>
                  <div style={{ fontSize:8,color:"#60a5fa",letterSpacing:2.5,fontWeight:600 }}>AI · DESIGN · DX</div>
                </div>
              </div>
              <p style={{ fontSize:11,color:"#64748b",lineHeight:1.8,marginTop:14 }}>{CO.company_name}<br/>{CO.company_address}</p>
              {CO.company_phone && <p style={{ fontSize:11,color:"#64748b",marginTop:10 }}>TEL: {CO.company_phone}</p>}
              {CO.company_email && <p style={{ fontSize:11,color:"#64748b",marginTop:4 }}>Mail: {CO.company_email}</p>}
            </div>
            {/* Services */}
            <div>
              <h4 style={{ fontSize:10,fontWeight:800,color:"#60a5fa",letterSpacing:2,marginBottom:14 }}>SERVICES</h4>
              <ul style={{ listStyle:"none",display:"flex",flexDirection:"column",gap:8 }}>
                <li><a href="/corporate/products/ai" style={{ fontSize:12,color:"#94a3b8",transition:"color .2s" }} onMouseEnter={e => e.currentTarget.style.color="#60a5fa"} onMouseLeave={e => e.currentTarget.style.color="#94a3b8"}>TERA AI</a></li>
                <li><a href="/corporate/products/web" style={{ fontSize:12,color:"#94a3b8",transition:"color .2s" }} onMouseEnter={e => e.currentTarget.style.color="#60a5fa"} onMouseLeave={e => e.currentTarget.style.color="#94a3b8"}>TERA Cloud</a></li>
                <li><a href="/corporate/products/dx" style={{ fontSize:12,color:"#94a3b8",transition:"color .2s" }} onMouseEnter={e => e.currentTarget.style.color="#60a5fa"} onMouseLeave={e => e.currentTarget.style.color="#94a3b8"}>TERA DX</a></li>
                <li style={{ paddingTop:8,marginTop:4,borderTop:"1px solid rgba(255,255,255,0.04)" }}><a href="/corporate/services/dx-implementation-flow" style={{ fontSize:12,color:"#94a3b8",transition:"color .2s" }} onMouseEnter={e => e.currentTarget.style.color="#4dd6e8"} onMouseLeave={e => e.currentTarget.style.color="#94a3b8"}>DX導入フロー →</a></li>
              </ul>
            </div>
            {/* Company */}
            <div>
              <h4 style={{ fontSize:10,fontWeight:800,color:"#60a5fa",letterSpacing:2,marginBottom:14 }}>COMPANY</h4>
              <ul style={{ listStyle:"none",display:"flex",flexDirection:"column",gap:8 }}>
                <li><a href="/corporate#message" style={{ fontSize:12,color:"#94a3b8" }}>代表挨拶</a></li>
                <li><a href="/corporate#company" style={{ fontSize:12,color:"#94a3b8" }}>会社概要</a></li>
                <li><a href="/corporate/news" style={{ fontSize:12,color:"#94a3b8" }}>お知らせ</a></li>
                <li><a href="/corporate/careers" style={{ fontSize:12,color:"#94a3b8" }}>採用情報</a></li>
              </ul>
            </div>
            {/* Support */}
            <div>
              <h4 style={{ fontSize:10,fontWeight:800,color:"#60a5fa",letterSpacing:2,marginBottom:14 }}>SUPPORT</h4>
              <ul style={{ listStyle:"none",display:"flex",flexDirection:"column",gap:8 }}>
                <li><a href="/corporate#contact" style={{ fontSize:12,color:"#94a3b8" }}>お問い合わせ</a></li>
                <li><a href="/corporate/faq" style={{ fontSize:12,color:"#94a3b8" }}>よくあるご質問</a></li>
                <li><a href="/corporate/privacy" style={{ fontSize:12,color:"#94a3b8" }}>プライバシーポリシー</a></li>
                <li><a href="/corporate/legal" style={{ fontSize:12,color:"#94a3b8" }}>特定商取引法表記</a></li>
              </ul>
            </div>
          </div>
          {/* Bottom */}
          <div style={{ display:"flex",flexWrap:"wrap",justifyContent:"space-between",alignItems:"center",gap:14,paddingTop:24,borderTop:"1px solid rgba(255,255,255,0.04)" }}>
            <p style={{ fontSize:11,color:"#334155" }}>© {new Date().getFullYear()} {CO.company_name}. All rights reserved.</p>
            <div style={{ display:"flex",gap:20,alignItems:"center" }}>
              <span style={{ fontSize:10,color:"#334155" }}>🔒 SSL Secured</span>
              <span style={{ fontSize:10,color:"#334155" }}>🛡 個人情報保護法準拠</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ══════════ RPG Battle Characters ══════════ */
function RPGCharacters() {
  const [s, setS] = useState({
    hx: 200, hy: 400, tx: 600, ty: 800, hdir: 1, hface: "front" as string, walk: false,
    sx: -200, sy: -200, salive: false, shp: 5, sMaxHp: 5,
    hhp: 15, hMaxHp: 15,
    phase: "wander" as string, ptick: 0, tick: 0, nextSpawn: 200,
    dmgs: [] as { id: number; x: number; y: number; txt: string; color: string; t: number; sz?: number }[],
    // Attack motion
    atkOff: 0, swordAng: 0, slashVis: false, sparkVis: false,
    sJump: 0, sAtkOff: 0, sSquish: false,
    heroFlash: false, heroDead: false,
    heroKB: 0, slimeKB: 0, heroPain: false, slimePain: false,
    cape: 0, idleCount: 0, idleAnim: 0 as number, // 0=stand 1=lookR 2=lookL 3=sit
    sectionReact: "" as string, reactTimer: 0,
  });
  const ref = useRef(s); ref.current = s;
  const idRef = useRef(0);

  useEffect(() => {
    let raf = 0;
    const ad = (x: number, y: number, txt: string, color: string, sz?: number) => {
      idRef.current++;
      ref.current.dmgs = [...ref.current.dmgs, { id: idRef.current, x, y, txt, color, t: 55, sz }];
    };
    const pick = () => { const r = ref.current; r.tx = 60 + Math.random() * (window.innerWidth - 160); r.ty = 120 + Math.random() * Math.min(document.body.scrollHeight - 160, 4500); r.idleCount = 0; r.idleAnim = 0; };
    pick();

    // ── クリックで勇者が歩いてくる ──
    const onClick = (e: MouseEvent) => {
      const r = ref.current;
      if (r.phase !== "wander" && r.phase !== "cooldown") return;
      r.tx = e.pageX; r.ty = e.pageY;
      r.idleCount = 0; r.idleAnim = 0;
    };
    document.addEventListener("click", onClick);

    const loop = () => {
      const r = { ...ref.current };
      r.tick++;
      r.cape = Math.sin(r.tick * 0.08) * 6;
      r.dmgs = r.dmgs.map(d => ({ ...d, y: d.y - 0.6, t: d.t - 1 })).filter(d => d.t > 0);
      if (r.reactTimer > 0) r.reactTimer--;

      const dist2 = (ax: number, ay: number, bx: number, by: number) => Math.sqrt((ax-bx)**2 + (ay-by)**2);
      const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
      const ease = (t: number) => t < 0.5 ? 2*t*t : 1 - (-2*t+2)**2/2;
      // PC（幅広い画面）ではゆっくり、スマホはそのまま
      const spd = window.innerWidth > 900 ? 0.18 : 0.4;
      // 攻撃モーションもPCではゆっくり（2フレームに1回進行）
      const atkRate = window.innerWidth > 900 ? 2 : 1;
      const btl = r.tick % atkRate === 0; // バトル進行フレームか
      const faceDir = (dx: number, dy: number) => {
        const ang = Math.atan2(dy, dx) * 180 / Math.PI;
        if (ang > -45 && ang <= 45) return { hdir: 1, hface: "side" };
        if (ang > 45 && ang <= 135) return { hdir: 1, hface: "front" };
        if (ang > -135 && ang <= -45) return { hdir: 1, hface: "back" };
        return { hdir: -1, hface: "side" };
      };

      // ── セクション検知 ──
      if (r.phase === "wander" && r.reactTimer <= 0) {
        const secs = [
          { id: "service", emoji: "💡", text: "良いサービス..." },
          { id: "products", emoji: "📦", text: "すごい製品だ！" },
          { id: "stats", emoji: "📊", text: "実績すごいな" },
          { id: "tech", emoji: "⚡", text: "最新技術！" },
          { id: "news", emoji: "📰", text: "最新ニュース！" },
          { id: "message", emoji: "👤", text: "代表の想い..." },
          { id: "company", emoji: "🏢", text: "しっかりした会社" },
          { id: "faq", emoji: "❓", text: "よくある質問か" },
          { id: "contact", emoji: "✉️", text: "お問い合わせ..." },
        ];
        for (const sec of secs) {
          const el = document.getElementById(sec.id);
          if (!el) continue;
          const top = el.offsetTop;
          if (Math.abs(r.hy - top) < 40 && Math.abs(r.hx - el.offsetWidth / 2) < 300) {
            r.sectionReact = `${sec.emoji} ${sec.text}`;
            r.reactTimer = 120;
            break;
          }
        }
      }

      if (r.phase === "wander") {
        if (r.heroDead) { r.heroDead = false; r.hhp = r.hMaxHp; }
        const dx = r.tx - r.hx, dy = r.ty - r.hy, d = dist2(r.hx,r.hy,r.tx,r.ty);
        if (d < 10) {
          r.walk = false;
          r.idleCount++;
          // ── アイドルモーション ──
          if (r.idleCount === 30) r.idleAnim = 1; // look right
          else if (r.idleCount === 55) r.idleAnim = 2; // look left
          else if (r.idleCount === 80) r.idleAnim = 1; // look right again
          else if (r.idleCount === 100) r.idleAnim = 3; // sit down
          else if (r.idleCount === 180) r.idleAnim = 0; // stand up
          else if (r.idleCount > 200) { pick(); }
        } else {
          r.hx += (dx/d)*spd; r.hy += (dy/d)*spd;
          const f = faceDir(dx, dy); r.hdir = f.hdir; r.hface = f.hface;
          r.walk = true; r.idleCount = 0; r.idleAnim = 0;
        }
        r.nextSpawn--;
        if (r.nextSpawn <= 0) {
          r.phase = "encounter"; r.ptick = 0;
          const side = Math.random() > 0.5 ? 1 : -1;
          r.sx = r.hx + side * (140 + Math.random()*60);
          r.sy = r.hy + (Math.random()-0.5)*60;
          r.salive = true; r.shp = r.sMaxHp; r.sSquish = false; r.sJump = 0; r.sAtkOff = 0;
        }
      }
      else if (r.phase === "encounter") {
        if(btl) r.ptick++;
        const dx = r.sx - r.hx, d = dist2(r.hx,r.hy,r.sx,r.sy);
        const f = faceDir(dx, r.sy - r.hy); r.hdir = f.hdir; r.hface = "side"; r.walk = true;
        if (d > 80) { r.hx += (dx/d)*(spd*1.8); r.hy += ((r.sy-r.hy)/d)*(spd*1.8); }
        if (r.ptick > 40 || d <= 80) { r.phase = Math.random() > 0.45 ? "hero_atk" : "slime_atk"; r.ptick = 0; r.walk = false; r.atkOff = 0; r.swordAng = 0; }
      }
      // ── HERO ATTACK: lunge + big sword swing ──
      else if (r.phase === "hero_atk") {
        if(btl) r.ptick++;
        const lungeMax = 35;
        if (r.ptick <= 12) {
          // Lunge forward toward slime
          r.atkOff = lerp(0, lungeMax, ease(r.ptick / 12));
          r.swordAng = lerp(0, -120, ease(r.ptick / 12)); // Wind up
        } else if (r.ptick <= 20) {
          // Sword swing down!
          r.atkOff = lungeMax;
          r.swordAng = lerp(-120, 60, ease((r.ptick - 12) / 8));
        } else if (r.ptick === 21) {
          // HIT!
          r.slashVis = true; r.sparkVis = true; r.sSquish = true;
          r.slimePain = true; r.slimeKB = 18;
          const crit = Math.random() > 0.75;
          const dmg = crit ? 6 + Math.floor(Math.random()*3) : 2 + Math.floor(Math.random()*3);
          r.shp = Math.max(0, r.shp - dmg);
          if (crit) { ad(r.sx+5, r.sy-35, "CRITICAL!", "#f59e0b", 18); ad(r.sx+15, r.sy-15, `${dmg}`, "#FFD700", 22); }
          else ad(r.sx+10, r.sy-25, `${dmg}`, "#FFD700", 20);
        } else if (r.ptick <= 30) {
          r.swordAng = 60;
          r.slimeKB = Math.max(0, r.slimeKB - 1.2);
          if (r.ptick === 26) { r.slashVis = false; r.sparkVis = false; r.sSquish = false; }
          if (r.ptick === 28) r.slimePain = false;
        } else if (r.ptick <= 45) {
          // Return
          r.atkOff = lerp(lungeMax, 0, ease((r.ptick - 30) / 15));
          r.swordAng = lerp(60, 0, ease((r.ptick - 30) / 15));
        }
        if (r.ptick > 50) {
          r.atkOff = 0; r.swordAng = 0;
          if (r.shp <= 0) { r.phase = "slime_die"; r.ptick = 0; }
          else { r.phase = "slime_atk"; r.ptick = 0; }
        }
      }
      // ── SLIME ATTACK: sqush → big jump → body slam ──
      else if (r.phase === "slime_atk") {
        if(btl) r.ptick++;
        const distToH = r.hdir === 1 ? r.sx - r.hx : r.hx - r.sx;
        if (r.ptick <= 10) {
          // Squish down (prepare)
          r.sSquish = true;
        } else if (r.ptick <= 28) {
          // Jump arc toward hero
          r.sSquish = false;
          const t = (r.ptick - 10) / 18;
          r.sAtkOff = lerp(0, distToH * 0.7, ease(t));
          r.sJump = Math.sin(t * Math.PI) * 80; // Big arc!
        } else if (r.ptick === 29) {
          // SLAM!
          r.sSquish = true; r.heroFlash = true; r.heroPain = true; r.heroKB = 20;
          const dmg = 2 + Math.floor(Math.random() * 3);
          r.hhp = Math.max(0, r.hhp - dmg);
          ad(r.hx + 10, r.hy - 20, `${dmg}`, "#ef4444", 20);
          if (Math.random() > 0.6) ad(r.hx + 30, r.hy - 5, "痛っ！", "#fca5a5", 12);
        } else if (r.ptick <= 38) {
          // Bounce back
          r.sSquish = r.ptick < 33;
          r.heroKB = Math.max(0, r.heroKB - 2.2);
          const t = (r.ptick - 29) / 9;
          r.sAtkOff = lerp(distToH * 0.7, 0, ease(t));
          r.sJump = lerp(0, 0, t);
        } else if (r.ptick === 39) {
          r.heroFlash = false; r.heroPain = false; r.heroKB = 0;
          r.sJump = 0; r.sAtkOff = 0;
        }
        if (r.ptick > 50) {
          r.sAtkOff = 0; r.sJump = 0; r.sSquish = false;
          if (r.hhp <= 0) { r.phase = "hero_die"; r.ptick = 0; }
          else if (r.shp > 2 && Math.random() > 0.55) {
            r.phase = "slime_atk"; r.ptick = 0;
            ad(r.sx, r.sy - 35, "連続攻撃！", "#22d3ee", 13);
          } else { r.phase = "hero_atk"; r.ptick = 0; }
        }
      }
      // ── SLIME DIE ──
      else if (r.phase === "slime_die") {
        if(btl) r.ptick++;
        if (r.ptick === 1) ad(r.sx, r.sy - 10, "✦", "#67e8f9", 24);
        if (r.ptick === 18) { ad(r.sx - 15, r.sy - 35, "EXP +15", "#22c55e", 13); ad(r.sx + 20, r.sy - 20, "Gold +8", "#fbbf24", 13); }
        if (r.ptick > 55) {
          r.salive = false; r.phase = "cooldown"; r.ptick = 0;
          r.hhp = Math.min(r.hMaxHp, r.hhp + 5);
          ad(r.hx, r.hy - 25, "HP回復 +5", "#34d399", 12);
        }
      }
      // ── HERO DIE ──
      else if (r.phase === "hero_die") {
        if(btl) r.ptick++;
        r.heroDead = true; r.walk = false;
        if (r.ptick === 10) ad(r.hx - 10, r.hy - 30, "やられた…", "#94a3b8", 16);
        if (r.ptick === 40) ad(r.hx - 5, r.hy - 45, "GAME OVER", "#ef4444", 18);
        if (r.ptick > 180) {
          // Respawn!
          r.heroDead = false; r.hhp = r.hMaxHp; r.salive = false;
          r.phase = "cooldown"; r.ptick = 0;
          ad(r.hx, r.hy - 30, "✦ 復活！", "#60a5fa", 16);
        }
      }
      // ── COOLDOWN ──
      else if (r.phase === "cooldown") {
        if(btl) r.ptick++;
        const dx = r.tx - r.hx, d = dist2(r.hx,r.hy,r.tx,r.ty);
        if (d > 10) { r.hx += (dx/d)*spd; r.hy += ((r.ty-r.hy)/d)*spd; const f = faceDir(dx, r.ty-r.hy); r.hdir = f.hdir; r.hface = f.hface; r.walk = true; }
        else r.walk = false;
        if (r.ptick > 200) { r.phase = "wander"; r.ptick = 0; r.nextSpawn = 500 + Math.floor(Math.random() * 500); pick(); }
      }

      setS(r);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); document.removeEventListener("click", onClick); };
  }, []);

  const isSitting = s.idleAnim === 3 && !s.walk && s.phase === "wander";
  const bobY = s.walk ? Math.sin(s.tick * 0.15) * 2.5 : (isSitting ? 12 : 0);
  const walkCycle = s.walk ? Math.sin(s.tick * 0.15) : 0; // -1 to 1
  const stepFwd = walkCycle * 5; // for side view legs
  const stepBack = -walkCycle * 5;
  const eyeShiftX = s.idleAnim === 1 ? 2.5 : s.idleAnim === 2 ? -2.5 : 0;
  const slimeBob = s.salive && !s.sSquish ? Math.sin(s.tick * 0.1) * 3 : 0;
  const dieScale = s.phase === "slime_die" ? Math.max(0, 1 - s.ptick / 45) : 1;
  const dieRot = s.phase === "slime_die" ? s.ptick * 10 : 0;
  const heroAtkX = s.atkOff * s.hdir - s.heroKB * s.hdir;
  const slimeAtkX = (s.phase === "slime_atk" ? -s.sAtkOff * s.hdir : 0) + s.slimeKB * s.hdir;
  const heroDieRot = s.heroDead ? Math.min(90, s.ptick * 3) : 0;
  const heroDieOp = s.heroDead && s.ptick > 140 ? Math.max(0, 1 - (s.ptick - 140) / 40) : 1;

  return (
    <>
      <style>{`
        @keyframes sparkle{0%{opacity:1;transform:scale(1)}100%{opacity:0;transform:scale(2.5)}}
        @keyframes slimeWobble{0%,100%{transform:scaleX(1) scaleY(1)}50%{transform:scaleX(1.08) scaleY(0.92)}}
        .fx-slash{animation:sparkle .35s ease-out both}
      `}</style>

      {/* ══ HERO ══ */}
      <div style={{
        position:"absolute", left: s.hx - 30 + heroAtkX, top: s.hy - 40 + bobY,
        width: 60, height: 80, pointerEvents:"none", zIndex: 42,
        transform: `scaleX(${s.hface === "side" ? s.hdir : 1}) rotate(${heroDieRot}deg)`,
        transformOrigin: "center bottom", opacity: heroDieOp,
        filter: s.heroFlash ? "brightness(2) drop-shadow(0 0 14px rgba(239,68,68,0.9))" : "drop-shadow(2px 3px 4px rgba(0,0,0,0.5))",
        transition: s.heroDead ? "transform 0.5s ease-in, opacity 0.5s" : "filter 0.12s",
      }}>
        <svg viewBox="0 0 60 80" width="60" height="80" fill="none">
          {/* ── SIDE VIEW ── */}
          {(s.hface === "side" || s.phase === "hero_atk" || s.phase === "encounter") && (<>
            <path d={`M24 30 Q16 ${44+s.cape} ${10+s.cape*0.4} ${60+s.cape*0.4} L24 56 Z`} fill="#dc2626" opacity="0.9"/>
            <path d={`M24 32 Q14 ${48+s.cape} ${8+s.cape*0.5} ${62+s.cape*0.3} L${10+s.cape*0.4} ${60+s.cape*0.4} Q16 ${44+s.cape} 24 30Z`} fill="#991b1b" opacity="0.5"/>
            <rect x="28" y="54" width="7" height="14" rx="3.5" fill="#162d50" transform={`translate(${stepBack}, 0)`}/>
            <ellipse cx={31.5+stepBack} cy="68" rx="5" ry="3" fill="#3d1f00"/>
            <rect x="24" y="30" width="16" height="26" rx="4" fill="#2563eb"/>
            <rect x="26" y="32" width="12" height="8" rx="2" fill="#3b82f6"/>
            <rect x="24" y="48" width="16" height="4" rx="1" fill="#8B6914"/>
            <rect x="30" y="47" width="4" height="6" rx="1.5" fill="#FFD700"/>
            <ellipse cx="38" cy="33" rx="5" ry="4" fill="#3b82f6"/>
            <rect x="30" y="54" width="7" height="14" rx="3.5" fill="#1e3a5f" transform={`translate(${stepFwd}, 0)`}/>
            <ellipse cx={33.5+stepFwd} cy="68" rx="5" ry="3" fill="#5C3317"/>
            <circle cx="32" cy="18" r="11" fill="#FDBCB4"/>
            {s.heroPain || s.heroDead ? (<><line x1="33" y1="15" x2="38" y2="19" stroke="#0f172a" strokeWidth="2" strokeLinecap="round"/><line x1="38" y1="15" x2="33" y2="19" stroke="#0f172a" strokeWidth="2" strokeLinecap="round"/></>) : (<><ellipse cx="36" cy="17" rx="2" ry="2.5" fill="#0f172a"/><circle cx="37" cy="16" r="0.8" fill="white"/></>)}
            <path d={s.heroPain ? "M34 23 Q37 21 39 23" : "M34 22 Q37 24 39 22"} stroke="#c4786a" strokeWidth="1" fill="none"/>
            {s.heroPain && <path d="M40 10 Q42 15 40 17 Q38 15 40 10Z" fill="#60a5fa" opacity="0.7"/>}
            <ellipse cx="39" cy="20" rx="2" ry="1" fill="#f4a0a0" opacity="0.4"/>
            <path d="M22 12 L22 7 L26 9 L30 5 L34 9 L38 5 L42 9 L42 12Z" fill="#FFD700"/>
            <path d="M22 12 L42 12 L42 13.5 Q32 15 22 13.5Z" fill="#DAA520"/>
            <circle cx="30" cy="7" r="1.5" fill="#dc2626"/><circle cx="36" cy="7.5" r="1.3" fill="#3b82f6"/>
            <path d="M22 14 Q20 8 24 10 L22 6Z" fill="#8B5E3C"/>
            <g transform={`rotate(${s.swordAng} 42 34)`}><rect x="43" y="12" width="3.5" height="22" rx="1.5" fill="#B0B8C8"/><rect x="43" y="12" width="3.5" height="7" rx="1.5" fill="#E0E8FF"/><rect x="41" y="32" width="7.5" height="4.5" rx="2" fill="#FFD700"/><rect x="43.5" y="36.5" width="2.5" height="7" rx="1" fill="#8B6914"/><circle cx="44.8" cy="14" r="1" fill="#fff" opacity="0.6"/></g>
          </>)}
          {/* ── FRONT VIEW (walking down / idle) ── */}
          {s.hface === "front" && !["hero_atk","encounter","slime_atk"].includes(s.phase) && (<>
            <path d="M22 30 Q20 50 18 62 L30 60 L42 62 Q40 50 38 30Z" fill="#dc2626" opacity="0.6"/>
            {/* Legs — sitting or walking */}
            {isSitting ? (<>
              <rect x="18" y="52" width="14" height="6" rx="3" fill="#1e3a5f"/>
              <rect x="28" y="52" width="14" height="6" rx="3" fill="#1e3a5f"/>
              <ellipse cx="17" cy="56" rx="4" ry="3" fill="#5C3317"/>
              <ellipse cx="43" cy="56" rx="4" ry="3" fill="#5C3317"/>
            </>) : (<>
              <rect x="22" y="54" width="7" height="14" rx="3.5" fill="#1e3a5f" transform={`translate(${stepFwd*0.6}, 0)`}/>
              <rect x="31" y="54" width="7" height="14" rx="3.5" fill="#1e3a5f" transform={`translate(${stepBack*0.6}, 0)`}/>
              <ellipse cx={25.5+stepFwd*0.6} cy="68" rx="5" ry="3" fill="#5C3317"/>
              <ellipse cx={34.5+stepBack*0.6} cy="68" rx="5" ry="3" fill="#5C3317"/>
            </>)}
            <rect x="20" y="30" width="20" height="26" rx="4" fill="#2563eb"/>
            <rect x="22" y="32" width="16" height="10" rx="2" fill="#3b82f6"/>
            <rect x="20" y="48" width="20" height="4" rx="1" fill="#8B6914"/>
            <rect x="28" y="47" width="5" height="6" rx="1.5" fill="#FFD700"/>
            <ellipse cx="20" cy="33" rx="5" ry="4" fill="#3b82f6"/>
            <ellipse cx="40" cy="33" rx="5" ry="4" fill="#3b82f6"/>
            <circle cx="30" cy="18" r="12" fill="#FDBCB4"/>
            {/* Eyes — shift with idle look direction */}
            <ellipse cx={26+eyeShiftX} cy="17" rx="2" ry={isSitting ? 1.5 : 2.5} fill="#0f172a"/>
            <ellipse cx={34+eyeShiftX} cy="17" rx="2" ry={isSitting ? 1.5 : 2.5} fill="#0f172a"/>
            <circle cx={27+eyeShiftX} cy="16" r="0.8" fill="white"/>
            <circle cx={35+eyeShiftX} cy="16" r="0.8" fill="white"/>
            <path d={isSitting ? "M27 22 Q30 23 33 22" : "M27 22 Q30 25 33 22"} stroke="#c4786a" strokeWidth="1" fill="none"/>
            <ellipse cx="23" cy="20" rx="2.5" ry="1.2" fill="#f4a0a0" opacity="0.4"/>
            <ellipse cx="37" cy="20" rx="2.5" ry="1.2" fill="#f4a0a0" opacity="0.4"/>
            <path d="M18 12 L18 6 L22 9 L26 4 L30 8 L34 4 L38 9 L42 6 L42 12Z" fill="#FFD700"/>
            <path d="M18 12 L42 12 L42 14 Q30 16 18 14Z" fill="#DAA520"/>
            <circle cx="26" cy="8" r="1.5" fill="#dc2626"/><circle cx="34" cy="8" r="1.5" fill="#3b82f6"/><circle cx="30" cy="6" r="1.8" fill="#22c55e"/>
            <path d="M18 14 Q18 8 22 10 L18 6Z" fill="#8B5E3C"/><path d="M42 14 Q42 8 38 10 L42 6Z" fill="#8B5E3C"/>
            {/* Sword — laid down when sitting */}
            {isSitting ? (<>
              <rect x="10" y="60" width="18" height="3" rx="1" fill="#B0B8C8" transform="rotate(-15 10 60)"/>
              <rect x="26" y="58" width="5" height="4" rx="1.5" fill="#FFD700"/>
            </>) : (<>
              <rect x="44" y="30" width="3" height="18" rx="1" fill="#B0B8C8"/><rect x="44" y="30" width="3" height="5" rx="1" fill="#E0E8FF"/><rect x="42.5" y="46" width="6" height="4" rx="1.5" fill="#FFD700"/>
            </>)}
          </>)}
          {/* ── BACK VIEW (walking up) ── */}
          {s.hface === "back" && !["hero_atk","encounter","slime_atk"].includes(s.phase) && (<>
            <path d={`M20 28 Q15 ${48+s.cape} ${10+s.cape*0.5} ${64+s.cape*0.3} L30 62 L${50-s.cape*0.5} ${64-s.cape*0.3} Q45 ${48-s.cape} 40 28Z`} fill="#dc2626" opacity="0.9"/>
            <path d={`M22 30 Q18 ${46+s.cape*0.8} ${14+s.cape*0.3} ${60+s.cape*0.4} L30 58 L${46-s.cape*0.3} ${60-s.cape*0.4} Q42 ${46-s.cape*0.8} 38 30Z`} fill="#b91c1c" opacity="0.5"/>
            <rect x="22" y="54" width="7" height="14" rx="3.5" fill="#1e3a5f" transform={`translate(${stepFwd*0.6}, 0)`}/>
            <rect x="31" y="54" width="7" height="14" rx="3.5" fill="#1e3a5f" transform={`translate(${stepBack*0.6}, 0)`}/>
            <ellipse cx={25.5+stepFwd*0.6} cy="68" rx="5" ry="3" fill="#5C3317"/>
            <ellipse cx={34.5+stepBack*0.6} cy="68" rx="5" ry="3" fill="#5C3317"/>
            <rect x="20" y="30" width="20" height="26" rx="4" fill="#2563eb"/>
            <rect x="22" y="32" width="16" height="8" rx="2" fill="#1d4ed8"/>
            <rect x="20" y="48" width="20" height="4" rx="1" fill="#8B6914"/>
            <ellipse cx="20" cy="33" rx="5" ry="4" fill="#3b82f6"/><ellipse cx="40" cy="33" rx="5" ry="4" fill="#3b82f6"/>
            <circle cx="30" cy="18" r="12" fill="#8B5E3C"/><circle cx="30" cy="19" r="10" fill="#6B4226"/>
            <path d="M18 12 L18 6 L22 9 L26 4 L30 8 L34 4 L38 9 L42 6 L42 12Z" fill="#FFD700"/>
            <path d="M18 12 L42 12 L42 14 Q30 16 18 14Z" fill="#DAA520"/>
            <rect x="42" y="18" width="3" height="28" rx="1" fill="#B0B8C8" opacity="0.8" transform="rotate(10 42 18)"/>
            <rect x="40" y="44" width="6" height="4" rx="1.5" fill="#FFD700" opacity="0.8"/>
          </>)}
        </svg>
      </div>

      {/* ══ IDLE THOUGHT BUBBLES ══ */}
      {!s.walk && s.phase === "wander" && s.idleAnim > 0 && !s.heroDead && (
        <div style={{
          position:"absolute", left: s.hx - 5, top: s.hy - 65 + bobY,
          fontSize: 14, fontWeight: 700, color: "#94a3b8", pointerEvents:"none", zIndex: 52,
          textShadow: "0 1px 3px rgba(0,0,0,0.8)",
          opacity: 0.9, whiteSpace: "nowrap",
        }}>
          {s.idleAnim === 1 || s.idleAnim === 2 ? "❓" : ""}
          {isSitting && (
            <span style={{ fontSize: 13, letterSpacing: 2 }}>
              {s.tick % 60 < 20 ? "z" : s.tick % 60 < 40 ? "zZ" : "zZz"}
            </span>
          )}
        </div>
      )}

      {/* ══ SECTION REACTION BUBBLE ══ */}
      {s.sectionReact && s.reactTimer > 0 && (
        <div style={{
          position:"absolute", left: s.hx + 25, top: s.hy - 60,
          padding: "6px 12px", borderRadius: 12, fontSize: 12, fontWeight: 600,
          background: "rgba(15,23,42,0.9)", border: "1px solid rgba(96,165,250,0.2)",
          color: "#e2e8f0", pointerEvents:"none", zIndex: 52, whiteSpace: "nowrap",
          opacity: s.reactTimer < 20 ? s.reactTimer / 20 : 1,
          boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
        }}>
          {s.sectionReact}
          <div style={{
            position:"absolute", left: -6, top: "50%", marginTop: -4,
            width: 0, height: 0, borderRight: "6px solid rgba(15,23,42,0.9)",
            borderTop: "4px solid transparent", borderBottom: "4px solid transparent",
          }}/>
        </div>
      )}

      {/* Hero HP */}
      {!s.heroDead && <div style={{ position:"absolute", left:s.hx-22+heroAtkX, top:s.hy-52, width:44, height:6, background:"rgba(0,0,0,0.5)", borderRadius:3, zIndex:50, pointerEvents:"none", border:"1px solid rgba(255,255,255,0.15)" }}>
        <div style={{ width:`${(s.hhp/s.hMaxHp)*100}%`, height:"100%", borderRadius:2, background: s.hhp > 8 ? "linear-gradient(90deg,#22c55e,#4ade80)" : s.hhp > 4 ? "linear-gradient(90deg,#eab308,#facc15)" : "linear-gradient(90deg,#dc2626,#ef4444)", transition:"width 0.3s" }}/>
      </div>}

      {/* ══ SLIME ══ */}
      {s.salive && (
        <div style={{
          position:"absolute", left: s.sx - 25 + slimeAtkX, top: s.sy - 20 + slimeBob - s.sJump,
          width: 50, height: 44, pointerEvents:"none", zIndex: 41,
          transform: `scale(${dieScale}) rotate(${dieRot}deg) ${s.sSquish ? "scaleX(1.25) scaleY(0.75)" : ""}`,
          transformOrigin: "center bottom",
          opacity: s.phase === "slime_die" ? Math.max(0, 1 - s.ptick/40) : 1,
          filter: "drop-shadow(2px 3px 4px rgba(0,0,0,0.4)) drop-shadow(0 0 8px rgba(6,182,212,0.2))",
          transition: s.phase === "slime_die" ? "none" : "transform 0.12s ease-out",
          animation: s.phase !== "slime_die" && s.phase !== "hero_atk" && s.phase !== "slime_atk" ? "slimeWobble 1.2s ease-in-out infinite" : "none",
        }}>
          <svg viewBox="0 0 50 44" width="50" height="44" fill="none">
            <defs>
              <radialGradient id="sg" cx="40%" cy="35%"><stop offset="0%" stopColor="#67e8f9"/><stop offset="50%" stopColor="#22d3ee"/><stop offset="100%" stopColor="#0891b2"/></radialGradient>
              <radialGradient id="ss" cx="30%" cy="25%"><stop offset="0%" stopColor="white" stopOpacity="0.5"/><stop offset="100%" stopColor="white" stopOpacity="0"/></radialGradient>
            </defs>
            <path d="M6 36 Q2 36 4 28 Q4 16 12 10 Q18 4 25 4 Q32 4 38 10 Q46 16 46 28 Q48 36 44 36Z" fill="url(#sg)"/>
            <ellipse cx="18" cy="16" rx="8" ry="6" fill="url(#ss)"/>
            <path d="M6 36 Q2 36 4 28 Q4 16 12 10 Q18 4 25 4 Q32 4 38 10 Q46 16 46 28 Q48 36 44 36Z" stroke="#0e7490" strokeWidth="1.2" fill="none"/>
            {/* Eyes — pain or normal */}
            {s.slimePain ? (
              <>{/* Squeezed eyes */}
                <line x1="14" y1="22" x2="22" y2="22" stroke="#0e7490" strokeWidth="2.5" strokeLinecap="round"/>
                <line x1="30" y1="22" x2="38" y2="22" stroke="#0e7490" strokeWidth="2.5" strokeLinecap="round"/>
              </>
            ) : (
              <>{/* Normal eyes */}
                <ellipse cx="18" cy="22" rx="4" ry="5" fill="white"/><ellipse cx="34" cy="22" rx="4" ry="5" fill="white"/>
                <ellipse cx="19" cy="23" rx="2.5" ry="3" fill="#0f172a"/><ellipse cx="35" cy="23" rx="2.5" ry="3" fill="#0f172a"/>
                <circle cx="20" cy="21.5" r="1.2" fill="white"/><circle cx="36" cy="21.5" r="1.2" fill="white"/>
              </>
            )}
            {/* Mouth — pain or normal */}
            {s.slimePain ? (
              <ellipse cx="25" cy="31" rx="4" ry="3" fill="#0e7490" opacity="0.8"/>
            ) : (
              <path d="M22 30 Q25 34 28 30" stroke="#0e7490" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
            )}
            {/* Sweat when hit */}
            {s.slimePain && <path d="M40 12 Q42 17 40 19 Q38 17 40 12Z" fill="#60a5fa" opacity="0.6"/>}
            <ellipse cx="13" cy="28" rx="3" ry="1.5" fill="#f0abfc" opacity="0.35"/>
            <ellipse cx="39" cy="28" rx="3" ry="1.5" fill="#f0abfc" opacity="0.35"/>
          </svg>
        </div>
      )}

      {/* Slime HP */}
      {s.salive && s.phase !== "slime_die" && (
        <div style={{ position:"absolute", left:s.sx-18+slimeAtkX, top:s.sy-30+slimeBob-s.sJump, width:36, height:5, background:"rgba(0,0,0,0.5)", borderRadius:3, zIndex:50, pointerEvents:"none", border:"1px solid rgba(255,255,255,0.12)" }}>
          <div style={{ width:`${(s.shp/s.sMaxHp)*100}%`, height:"100%", borderRadius:2, background:"linear-gradient(90deg,#06b6d4,#22d3ee)", transition:"width 0.3s" }}/>
        </div>
      )}

      {/* Slime shadow */}
      {s.salive && s.phase !== "slime_die" && (
        <div style={{ position:"absolute", left:s.sx-14+slimeAtkX, top:s.sy+22, width:28, height:6, borderRadius:"50%", background:"rgba(0,0,0,0.2)", zIndex:39, pointerEvents:"none", transform:`scaleX(${1+s.sJump*0.005}) scaleY(${Math.max(0.3,1-s.sJump*0.008)})` }}/>
      )}

      {/* Slash effect */}
      {s.slashVis && (
        <div className="fx-slash" style={{ position:"absolute", left:s.sx-30+slimeAtkX, top:s.sy-40, width:70, height:70, zIndex:52, pointerEvents:"none" }}>
          <svg viewBox="0 0 70 70" width="70" height="70">
            <path d="M10 60 Q35 25 60 5" stroke="#FFD700" strokeWidth="4" fill="none" strokeLinecap="round" opacity="0.9"/>
            <path d="M15 55 Q38 28 58 10" stroke="#FEF3C7" strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.7"/>
            <path d="M8 58 Q32 30 55 8" stroke="#fff" strokeWidth="1" fill="none" strokeLinecap="round" opacity="0.4"/>
          </svg>
        </div>
      )}

      {/* Spark */}
      {s.sparkVis && (
        <div className="fx-slash" style={{ position:"absolute", left:s.sx-15, top:s.sy-15, width:40, height:40, zIndex:52, pointerEvents:"none" }}>
          <svg viewBox="0 0 40 40" width="40" height="40">
            {[0,45,90,135,180,225,270,315].map(a => (
              <line key={a} x1="20" y1="20" x2={20+Math.cos(a*Math.PI/180)*18} y2={20+Math.sin(a*Math.PI/180)*18} stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" opacity="0.8"/>
            ))}
            <circle cx="20" cy="20" r="5" fill="#fff" opacity="0.6"/>
          </svg>
        </div>
      )}

      {/* Damage numbers */}
      {s.dmgs.map(d => (
        <div key={d.id} style={{
          position:"absolute", left:d.x, top:d.y,
          fontSize: d.sz || 14, fontWeight:900, fontFamily:"Inter,sans-serif", color:d.color,
          textShadow:`0 1px 3px rgba(0,0,0,0.9), 0 0 12px ${d.color}50`,
          pointerEvents:"none", zIndex:55, opacity:Math.min(1, d.t/12),
          whiteSpace:"nowrap", letterSpacing:0.5,
        }}>{d.txt}</div>
      ))}
    </>
  );
}
