"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";

type Faq = { id: number; category: string; question: string; answer: string };

export default function FaqPage() {
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [openId, setOpenId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.from("corporate_faqs").select("*").eq("is_published", true).order("sort_order");
        if (data) setFaqs(data);
      } catch (e) { console.log("faqs fetch error:", e); }
      setLoading(false);
    })();
  }, []);

  const cats = Array.from(new Set(faqs.map(f => f.category)));
  const filtered = filter === "all" ? faqs : faqs.filter(f => f.category === filter);

  return (
    <div style={{ fontFamily: "'Noto Sans JP','Helvetica Neue',sans-serif", color: "#f8fafc", background: "#020617", minHeight: "100vh" }}>
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@300;400;500;700;900&family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />
      <style>{`*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}html{scroll-behavior:smooth}a{color:inherit;text-decoration:none}@keyframes fadeIn{from{opacity:0}to{opacity:1}}`}</style>

      {/* Nav */}
      <nav style={{ position:"sticky",top:0,zIndex:50,background:"rgba(2,6,23,0.88)",backdropFilter:"blur(20px)",borderBottom:"1px solid rgba(96,165,250,0.08)" }}>
        <div style={{ maxWidth:1100,margin:"0 auto",padding:"0 24px",display:"flex",alignItems:"center",justifyContent:"space-between",height:56 }}>
          <Link href="/corporate" style={{ display:"flex",alignItems:"center",gap:8 }}>
            <div style={{ width:28,height:28,borderRadius:6,background:"linear-gradient(135deg,#2563eb,#06b6d4)",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:800,fontSize:10,fontFamily:"Inter" }}>TL</div>
            <span style={{ fontSize:12,fontWeight:600,color:"#94a3b8" }}>← TOPに戻る</span>
          </Link>
          <span style={{ fontSize:11,fontWeight:700,color:"#7c3aed",letterSpacing:1 }}>FAQ</span>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ padding:"80px 24px 40px",background:"radial-gradient(ellipse at 50% 0%,rgba(124,58,237,0.12),#020617 70%)",textAlign:"center" }}>
        <span style={{ display:"inline-block",fontSize:11,fontWeight:700,color:"#7c3aed",letterSpacing:3,marginBottom:12 }}>FAQ</span>
        <h1 style={{ fontFamily:"Inter,'Noto Sans JP'",fontSize:"clamp(28px,4.5vw,44px)",fontWeight:900,letterSpacing:-.5 }}>よくあるご質問</h1>
        <p style={{ fontSize:14,color:"#94a3b8",marginTop:16 }}>お問い合わせの前にご確認ください</p>
      </section>

      {/* Content */}
      <section style={{ padding:"20px 24px 80px",maxWidth:820,margin:"0 auto" }}>
        {cats.length > 1 && (
          <div style={{ display:"flex",gap:8,justifyContent:"center",flexWrap:"wrap",marginBottom:32 }}>
            <button onClick={() => setFilter("all")} style={{ padding:"6px 16px",borderRadius:20,border:`1px solid ${filter==="all"?"#7c3aed":"rgba(148,163,184,0.2)"}`,background:filter==="all"?"rgba(124,58,237,0.15)":"transparent",color:filter==="all"?"#a78bfa":"#94a3b8",fontSize:11,fontWeight:600,cursor:"pointer" }}>すべて</button>
            {cats.map(c => (
              <button key={c} onClick={() => setFilter(c)} style={{ padding:"6px 16px",borderRadius:20,border:`1px solid ${filter===c?"#7c3aed":"rgba(148,163,184,0.2)"}`,background:filter===c?"rgba(124,58,237,0.15)":"transparent",color:filter===c?"#a78bfa":"#94a3b8",fontSize:11,fontWeight:600,cursor:"pointer" }}>{c}</button>
            ))}
          </div>
        )}

        {loading ? (
          <div style={{ textAlign:"center",padding:"60px 0",color:"#475569" }}>読み込み中...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign:"center",padding:"60px 0",color:"#475569" }}>FAQはまだ登録されていません</div>
        ) : (
          <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
            {filtered.map(f => (
              <div key={f.id} style={{ borderRadius:12,border:"1px solid rgba(255,255,255,0.08)",background:"rgba(255,255,255,0.02)",overflow:"hidden" }}>
                <button onClick={() => setOpenId(openId === f.id ? null : f.id)} style={{ width:"100%",padding:"18px 22px",background:"none",border:"none",cursor:"pointer",display:"flex",alignItems:"center",gap:14,textAlign:"left",color:"#f8fafc" }}>
                  <span style={{ fontSize:14,fontWeight:800,color:"#7c3aed",fontFamily:"Inter",flexShrink:0 }}>Q.</span>
                  <span style={{ flex:1,fontSize:14,fontWeight:500,lineHeight:1.6 }}>{f.question}</span>
                  <span style={{ fontSize:18,color:"#64748b",transform:openId===f.id?"rotate(180deg)":"rotate(0)",transition:"transform .25s" }}>⌄</span>
                </button>
                {openId === f.id && (
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
        )}

        {/* CTA */}
        <div style={{ marginTop:48,padding:"32px",borderRadius:16,background:"linear-gradient(135deg,rgba(37,99,235,0.08),rgba(6,182,212,0.06))",border:"1px solid rgba(96,165,250,0.15)",textAlign:"center" }}>
          <h3 style={{ fontSize:16,fontWeight:700,color:"#f8fafc",marginBottom:8 }}>解決しない場合は</h3>
          <p style={{ fontSize:12,color:"#94a3b8",marginBottom:20 }}>お気軽にお問い合わせください</p>
          <Link href="/corporate#contact" style={{ display:"inline-flex",alignItems:"center",gap:6,padding:"12px 32px",borderRadius:10,background:"linear-gradient(135deg,#2563eb,#1d4ed8)",color:"#fff",fontSize:13,fontWeight:700,boxShadow:"0 0 24px rgba(37,99,235,0.3)" }}>お問い合わせ →</Link>
        </div>
      </section>

      <footer style={{ padding:"28px 24px",background:"#020617",borderTop:"1px solid rgba(96,165,250,0.06)",textAlign:"center" }}>
        <p style={{ fontSize:11,color:"#334155" }}>© {new Date().getFullYear()} 合同会社テラスライフ. All rights reserved.</p>
      </footer>
    </div>
  );
}
