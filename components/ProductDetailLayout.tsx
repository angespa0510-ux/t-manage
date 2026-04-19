"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";

type SubProduct = {
  name: string;
  tagline: string;
  desc: string;
  features: string[];
  challenge: string;
  devVoice: string;
  clientVoice: { text: string; attr: string };
  demoImage?: string;       // デモ画像パス（/public 配下）
  demoCaption?: string;     // 画像下のキャプション
  demoOrientation?: "portrait" | "landscape"; // 既定: portrait（スマホモック用 / 縦長）
};

type Props = {
  badge: string;
  badgeColor: string;
  name: string;
  tagline: string;
  heroDesc: string;
  keyFeatures: { icon: string; title: string; desc: string; image?: string }[];
  subProducts: SubProduct[];
  techStack: string[];
};

export default function ProductDetailLayout({ badge, badgeColor, name, tagline, heroDesc, keyFeatures, subProducts, techStack }: Props) {
  const [vis, setVis] = useState<Set<string>>(new Set());
  useEffect(() => {
    const obs = new IntersectionObserver(
      (es) => es.forEach((e) => { if (e.isIntersecting) setVis((p) => new Set(p).add(e.target.id)); }),
      { threshold: 0.1 }
    );
    document.querySelectorAll("[data-a]").forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);
  const show = (id: string) => vis.has(id);

  return (
    <div style={{ fontFamily: "'Noto Sans JP','Helvetica Neue',sans-serif", color: "#f8fafc", background: "#020617", minHeight: "100vh" }}>
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@300;400;500;700;900&family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />
      <style>{`
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        html{scroll-behavior:smooth}a{color:inherit;text-decoration:none}
        @keyframes fadeUp{from{opacity:0;transform:translateY(36px)}to{opacity:1;transform:translateY(0)}}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        @keyframes floatY{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
        .fu{opacity:0;transform:translateY(36px);transition:opacity .8s cubic-bezier(.22,1,.36,1),transform .8s cubic-bezier(.22,1,.36,1)}
        .fu.on{opacity:1;transform:translateY(0)}
        .ch{transition:transform .3s,box-shadow .3s,border-color .3s}
        .ch:hover{transform:translateY(-4px);box-shadow:0 20px 60px rgba(37,99,235,0.12);border-color:rgba(96,165,250,0.3)!important}
        .demo-shell{position:relative;display:flex;align-items:flex-start;justify-content:center}
        .demo-shell::before{content:"";position:absolute;inset:-40px;border-radius:40px;background:radial-gradient(ellipse at center,var(--glow,rgba(59,130,246,0.25)),transparent 65%);filter:blur(30px);z-index:0;pointer-events:none}
        .demo-frame{position:relative;z-index:1;border-radius:22px;overflow:hidden;background:#0b1220;box-shadow:0 30px 80px rgba(0,0,0,0.45),0 0 0 1px rgba(255,255,255,0.06) inset;animation:floatY 6s ease-in-out infinite}
        .demo-frame img{display:block;width:100%;height:auto}
        .demo-frame.portrait{max-width:340px;width:100%}
        .demo-frame.landscape{max-width:100%;width:100%;border-radius:14px}
        .demo-frame.landscape::before{content:"";position:absolute;top:0;left:0;right:0;height:24px;background:linear-gradient(180deg,rgba(255,255,255,0.04),transparent);z-index:2;pointer-events:none}
        .sp-grid{display:grid;gap:36px;align-items:start}
        .sp-grid.portrait{grid-template-columns:1.15fr 0.85fr}
        .sp-grid.landscape{grid-template-columns:0.75fr 1.25fr}
        .sp-voices{display:grid;grid-template-columns:1fr;gap:12px}
        @media (max-width:860px){
          .sp-grid.portrait,.sp-grid.landscape{grid-template-columns:1fr;gap:28px}
          .sp-voices{grid-template-columns:1fr}
          .demo-shell::before{inset:-20px}
        }
      `}</style>

      {/* ── NAV ── */}
      <nav style={{ position:"sticky",top:0,zIndex:50,background:"rgba(2,6,23,0.88)",backdropFilter:"blur(20px)",borderBottom:"1px solid rgba(96,165,250,0.08)" }}>
        <div style={{ maxWidth:1100,margin:"0 auto",padding:"0 24px",display:"flex",alignItems:"center",justifyContent:"space-between",height:56 }}>
          <Link href="/corporate" style={{ display:"flex",alignItems:"center",gap:8,textDecoration:"none" }}>
            <div style={{ width:28,height:28,borderRadius:6,background:"linear-gradient(135deg,#2563eb,#06b6d4)",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:800,fontSize:10,fontFamily:"Inter" }}>TL</div>
            <span style={{ fontSize:12,fontWeight:600,color:"#94a3b8",letterSpacing:.5 }}>← TOPに戻る</span>
          </Link>
          <span style={{ fontSize:11,fontWeight:700,color:badgeColor,letterSpacing:1 }}>{name}</span>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section style={{ padding:"80px 24px 60px",background:`radial-gradient(ellipse at 50% 0%,${badgeColor}15,#020617 70%)`,textAlign:"center" }}>
        <div style={{ maxWidth:700,margin:"0 auto",animation:"fadeUp .9s ease .2s both" }}>
          <span style={{ display:"inline-block",fontSize:10,fontWeight:800,padding:"5px 14px",borderRadius:6,background:`${badgeColor}15`,color:badgeColor,border:`1px solid ${badgeColor}30`,letterSpacing:2,marginBottom:24 }}>{badge}</span>
          <h1 style={{ fontFamily:"Inter,'Noto Sans JP'",fontSize:"clamp(32px,5vw,52px)",fontWeight:900,letterSpacing:-1,lineHeight:1.15 }}>{name}</h1>
          <p style={{ fontSize:16,fontWeight:500,color:badgeColor,marginTop:10,letterSpacing:.5 }}>{tagline}</p>
          <p style={{ fontSize:14,lineHeight:1.9,color:"#94a3b8",marginTop:24 }}>{heroDesc}</p>
        </div>
      </section>

      {/* ── KEY FEATURES ── */}
      <section id="kf" data-a style={{ padding:"60px 24px",background:"#020617" }}>
        <div className={`fu ${show("kf")?"on":""}`} style={{ maxWidth:1200,margin:"0 auto" }}>
          <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(320px,1fr))",gap:24 }}>
            {keyFeatures.map((f,i) => (
              <div key={i} style={{ borderRadius:16,background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.06)",overflow:"hidden",transition:"transform .3s,border-color .3s,box-shadow .3s" }}
                onMouseEnter={(e) => { e.currentTarget.style.transform="translateY(-4px)"; e.currentTarget.style.borderColor=`${badgeColor}60`; e.currentTarget.style.boxShadow=`0 20px 40px -20px ${badgeColor}30`; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform="translateY(0)"; e.currentTarget.style.borderColor="rgba(255,255,255,0.06)"; e.currentTarget.style.boxShadow="none"; }}
              >
                {f.image ? (
                  <div style={{ position:"relative",width:"100%",aspectRatio:"16 / 9",background:"#0a1628",overflow:"hidden",borderBottom:`1px solid ${badgeColor}20` }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={f.image} alt={f.title} style={{ width:"100%",height:"100%",objectFit:"cover",display:"block" }}/>
                    {/* 上端からのグラデで暗色背景と馴染ませる */}
                    <div style={{ position:"absolute",inset:0,background:`linear-gradient(180deg,transparent 0%,transparent 70%,rgba(2,6,23,0.6) 100%)`,pointerEvents:"none" }}/>
                  </div>
                ) : (
                  <div style={{ fontSize:32,padding:"28px 24px 0" }}>{f.icon}</div>
                )}
                <div style={{ padding:"22px 24px 26px" }}>
                  <h3 style={{ fontSize:16,fontWeight:700,color:"#f8fafc",marginBottom:10,display:"flex",alignItems:"center",gap:10 }}>
                    {f.image && <span style={{ width:6,height:6,borderRadius:"50%",background:badgeColor,boxShadow:`0 0 8px ${badgeColor}` }}/>}
                    {f.title}
                  </h3>
                  <p style={{ fontSize:13,lineHeight:1.8,color:"#94a3b8" }}>{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Divider ── */}
      <div style={{ height:1,background:`linear-gradient(90deg,transparent,${badgeColor}40,transparent)` }}/>

      {/* ── SUB PRODUCTS ── */}
      <section id="sp" data-a style={{ padding:"80px 24px",background:"linear-gradient(180deg,#020617,#060e1f,#020617)" }}>
        <div className={`fu ${show("sp")?"on":""}`} style={{ maxWidth:1100,margin:"0 auto" }}>
          <div style={{ textAlign:"center",marginBottom:56 }}>
            <span style={{ fontSize:11,fontWeight:700,color:badgeColor,letterSpacing:3 }}>LINEUP</span>
            <h2 style={{ fontFamily:"Inter,'Noto Sans JP'",fontSize:"clamp(22px,3.5vw,32px)",fontWeight:800,marginTop:12,color:"#f8fafc" }}>製品ラインナップ</h2>
          </div>

          <div style={{ display:"flex",flexDirection:"column",gap:32 }}>
            {subProducts.map((p,i) => (
              <div key={i} className="ch" style={{ display:"grid",gridTemplateColumns:"1fr",gap:0,borderRadius:20,overflow:"hidden",background:"linear-gradient(135deg,rgba(15,28,47,0.9),rgba(10,22,40,0.95))",border:"1px solid rgba(96,165,250,0.08)",transition:"all .4s" }}>
                <div style={{ padding:"32px 32px 28px" }}>
                  <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:14 }}>
                    <div style={{ width:8,height:8,borderRadius:"50%",background:badgeColor,boxShadow:`0 0 10px ${badgeColor}60` }}/>
                    <span style={{ fontSize:10,fontWeight:700,color:badgeColor,letterSpacing:1.5 }}>{p.tagline}</span>
                  </div>
                  <h3 style={{ fontSize:24,fontWeight:800,color:"#f8fafc",fontFamily:"Inter,'Noto Sans JP'",letterSpacing:-.3,marginBottom:14 }}>{p.name}</h3>
                  <p style={{ fontSize:13,lineHeight:1.85,color:"#94a3b8",marginBottom:20 }}>{p.desc}</p>

                  {/* Features grid */}
                  <div style={{ display:"flex",flexWrap:"wrap",gap:8,marginBottom:24 }}>
                    {p.features.map(f => (
                      <div key={f} style={{ display:"flex",alignItems:"center",gap:6,padding:"6px 12px",borderRadius:8,background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)" }}>
                        <div style={{ width:4,height:4,borderRadius:"50%",background:badgeColor }}/>
                        <span style={{ fontSize:11,fontWeight:500,color:"#cbd5e1" }}>{f}</span>
                      </div>
                    ))}
                  </div>

                  {p.demoImage ? (
                    /* 2カラム: 左=声カード縦積み / 右=デモ画像（portrait=縦長スマホ / landscape=横長管理画面） */
                    <div className={`sp-grid ${p.demoOrientation === "landscape" ? "landscape" : "portrait"}`}>
                      <div className="sp-voices">
                        <div style={{ padding:"14px 16px",borderRadius:12,background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.04)" }}>
                          <p style={{ fontSize:9,fontWeight:800,color:"#f59e0b",letterSpacing:1.5,marginBottom:8 }}>CHALLENGE</p>
                          <p style={{ fontSize:11,lineHeight:1.75,color:"#cbd5e1" }}>{p.challenge}</p>
                        </div>
                        <div style={{ padding:"14px 16px",borderRadius:12,background:`${badgeColor}06`,border:`1px solid ${badgeColor}12` }}>
                          <p style={{ fontSize:9,fontWeight:800,color:badgeColor,letterSpacing:1.5,marginBottom:8 }}>開発者の声</p>
                          <p style={{ fontSize:11,lineHeight:1.75,color:"#cbd5e1",fontStyle:"italic" }}>&ldquo;{p.devVoice}&rdquo;</p>
                        </div>
                        <div style={{ padding:"14px 16px",borderRadius:12,background:"rgba(34,197,94,0.04)",border:"1px solid rgba(34,197,94,0.08)" }}>
                          <p style={{ fontSize:9,fontWeight:800,color:"#22c55e",letterSpacing:1.5,marginBottom:8 }}>導入企業の声</p>
                          <p style={{ fontSize:11,lineHeight:1.75,color:"#cbd5e1",fontStyle:"italic" }}>&ldquo;{p.clientVoice.text}&rdquo;</p>
                          <p style={{ fontSize:10,color:"#64748b",marginTop:6,textAlign:"right" }}>— {p.clientVoice.attr}</p>
                        </div>
                      </div>
                      <div className="demo-shell" style={{ ["--glow" as string]: `${badgeColor}33` } as React.CSSProperties}>
                        <div className={`demo-frame ${p.demoOrientation === "landscape" ? "landscape" : "portrait"}`}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={p.demoImage} alt={`${p.name} プレビュー`} loading="lazy" />
                        </div>
                        {p.demoCaption && (
                          <p style={{ position:"absolute",bottom:-28,left:0,right:0,textAlign:"center",fontSize:10,color:"#64748b",letterSpacing:1,zIndex:1 }}>{p.demoCaption}</p>
                        )}
                      </div>
                    </div>
                  ) : (
                    /* 従来: 3カラム声カード */
                    <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:12 }}>
                      <div style={{ padding:"14px 16px",borderRadius:12,background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.04)" }}>
                        <p style={{ fontSize:9,fontWeight:800,color:"#f59e0b",letterSpacing:1.5,marginBottom:8 }}>CHALLENGE</p>
                        <p style={{ fontSize:11,lineHeight:1.75,color:"#cbd5e1" }}>{p.challenge}</p>
                      </div>
                      <div style={{ padding:"14px 16px",borderRadius:12,background:`${badgeColor}06`,border:`1px solid ${badgeColor}12` }}>
                        <p style={{ fontSize:9,fontWeight:800,color:badgeColor,letterSpacing:1.5,marginBottom:8 }}>開発者の声</p>
                        <p style={{ fontSize:11,lineHeight:1.75,color:"#cbd5e1",fontStyle:"italic" }}>&ldquo;{p.devVoice}&rdquo;</p>
                      </div>
                      <div style={{ padding:"14px 16px",borderRadius:12,background:"rgba(34,197,94,0.04)",border:"1px solid rgba(34,197,94,0.08)" }}>
                        <p style={{ fontSize:9,fontWeight:800,color:"#22c55e",letterSpacing:1.5,marginBottom:8 }}>導入企業の声</p>
                        <p style={{ fontSize:11,lineHeight:1.75,color:"#cbd5e1",fontStyle:"italic" }}>&ldquo;{p.clientVoice.text}&rdquo;</p>
                        <p style={{ fontSize:10,color:"#64748b",marginTop:6,textAlign:"right" }}>— {p.clientVoice.attr}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TECH ── */}
      <section style={{ padding:"60px 24px",background:"#020617" }}>
        <div style={{ maxWidth:800,margin:"0 auto",textAlign:"center" }}>
          <span style={{ fontSize:11,fontWeight:700,color:"#475569",letterSpacing:3 }}>TECH STACK</span>
          <div style={{ display:"flex",flexWrap:"wrap",justifyContent:"center",gap:10,marginTop:20 }}>
            {techStack.map(t => (
              <span key={t} style={{ fontSize:11,fontWeight:600,padding:"6px 16px",borderRadius:8,background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)",color:"#94a3b8" }}>{t}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{ padding:"60px 24px 80px",background:`radial-gradient(ellipse at 50% 100%,${badgeColor}10,#020617 70%)`,textAlign:"center" }}>
        <h2 style={{ fontSize:24,fontWeight:800,color:"#f8fafc",marginBottom:12 }}>導入のご相談はお気軽に</h2>
        <p style={{ fontSize:13,color:"#94a3b8",marginBottom:28 }}>御社の課題に合わせた最適なソリューションをご提案します</p>
        <div style={{ display:"flex",gap:14,justifyContent:"center",flexWrap:"wrap" }}>
          <Link href="/corporate#contact" style={{ padding:"14px 36px",borderRadius:10,background:`linear-gradient(135deg,${badgeColor},${badgeColor}cc)`,color:"#fff",fontSize:14,fontWeight:700,boxShadow:`0 0 24px ${badgeColor}30`,textDecoration:"none" }}>
            お問い合わせ →
          </Link>
          <Link href="/corporate" style={{ padding:"14px 36px",borderRadius:10,background:"transparent",border:"1px solid rgba(148,163,184,0.25)",color:"#cbd5e1",fontSize:14,fontWeight:600,textDecoration:"none" }}>
            TOPに戻る
          </Link>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ padding:"28px 24px",background:"#020617",borderTop:"1px solid rgba(96,165,250,0.06)",textAlign:"center" }}>
        <p style={{ fontSize:11,color:"#334155" }}>© {new Date().getFullYear()} 合同会社テラスライフ. All rights reserved.</p>
      </footer>
    </div>
  );
}
