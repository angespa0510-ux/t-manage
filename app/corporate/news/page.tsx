"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";

type News = { id: number; title: string; category: string; body: string; link_url: string; published_at: string };

export default function NewsListPage() {
  const [news, setNews] = useState<News[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.from("corporate_news").select("*").eq("is_published", true).order("published_at", { ascending: false });
        if (data) setNews(data);
      } catch (e) { console.log("news fetch error:", e); }
      setLoading(false);
    })();
  }, []);

  const cats = Array.from(new Set(news.map(n => n.category)));
  const filtered = filter === "all" ? news : news.filter(n => n.category === filter);
  const catLabel = (c: string) => c === "press" ? "プレス" : c === "event" ? "イベント" : c === "update" ? "更新" : "お知らせ";
  const catColor = (c: string) => c === "press" ? "#f59e0b" : c === "event" ? "#22c55e" : c === "update" ? "#06b6d4" : "#60a5fa";

  return (
    <div style={{ fontFamily: "'Noto Sans JP','Helvetica Neue',sans-serif", color: "#f8fafc", background: "#020617", minHeight: "100vh" }}>
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@300;400;500;700;900&family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />
      <style>{`*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}html{scroll-behavior:smooth}a{color:inherit;text-decoration:none}`}</style>

      {/* Nav */}
      <nav style={{ position:"sticky",top:0,zIndex:50,background:"rgba(2,6,23,0.88)",backdropFilter:"blur(20px)",borderBottom:"1px solid rgba(96,165,250,0.08)" }}>
        <div style={{ maxWidth:1100,margin:"0 auto",padding:"0 24px",display:"flex",alignItems:"center",justifyContent:"space-between",height:56 }}>
          <Link href="/corporate" style={{ display:"flex",alignItems:"center",gap:8 }}>
            <div style={{ width:28,height:28,borderRadius:6,background:"linear-gradient(135deg,#2563eb,#06b6d4)",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:800,fontSize:10,fontFamily:"Inter" }}>TL</div>
            <span style={{ fontSize:12,fontWeight:600,color:"#94a3b8" }}>← TOPに戻る</span>
          </Link>
          <span style={{ fontSize:11,fontWeight:700,color:"#06b6d4",letterSpacing:1 }}>NEWS</span>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ padding:"80px 24px 40px",background:"radial-gradient(ellipse at 50% 0%,rgba(6,182,212,0.12),#020617 70%)",textAlign:"center" }}>
        <span style={{ display:"inline-block",fontSize:11,fontWeight:700,color:"#06b6d4",letterSpacing:3,marginBottom:12 }}>NEWS</span>
        <h1 style={{ fontFamily:"Inter,'Noto Sans JP'",fontSize:"clamp(28px,4.5vw,44px)",fontWeight:900,letterSpacing:-.5 }}>お知らせ</h1>
        <p style={{ fontSize:14,color:"#94a3b8",marginTop:16 }}>当社からの最新情報をお届けします</p>
      </section>

      {/* Content */}
      <section style={{ padding:"40px 24px 80px",maxWidth:900,margin:"0 auto" }}>
        {/* Filter */}
        {cats.length > 1 && (
          <div style={{ display:"flex",gap:8,justifyContent:"center",flexWrap:"wrap",marginBottom:32 }}>
            <button onClick={() => setFilter("all")} style={{ padding:"6px 16px",borderRadius:20,border:`1px solid ${filter==="all"?"#60a5fa":"rgba(148,163,184,0.2)"}`,background:filter==="all"?"rgba(37,99,235,0.15)":"transparent",color:filter==="all"?"#60a5fa":"#94a3b8",fontSize:11,fontWeight:600,cursor:"pointer" }}>すべて</button>
            {cats.map(c => (
              <button key={c} onClick={() => setFilter(c)} style={{ padding:"6px 16px",borderRadius:20,border:`1px solid ${filter===c?catColor(c):"rgba(148,163,184,0.2)"}`,background:filter===c?`${catColor(c)}20`:"transparent",color:filter===c?catColor(c):"#94a3b8",fontSize:11,fontWeight:600,cursor:"pointer" }}>{catLabel(c)}</button>
            ))}
          </div>
        )}

        {loading ? (
          <div style={{ textAlign:"center",padding:"60px 0",color:"#475569" }}>読み込み中...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign:"center",padding:"60px 0",color:"#475569" }}>お知らせはありません</div>
        ) : (
          <div style={{ display:"flex",flexDirection:"column",gap:14 }}>
            {filtered.map(n => {
              const dateStr = new Date(n.published_at).toLocaleDateString("ja-JP", { year:"numeric", month:"2-digit", day:"2-digit" });
              return (
                <article key={n.id} style={{ padding:"24px 28px",background:"rgba(255,255,255,0.02)",borderRadius:14,border:"1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ display:"flex",alignItems:"center",gap:12,marginBottom:12,flexWrap:"wrap" }}>
                    <span style={{ fontSize:12,color:"#94a3b8",fontFamily:"Inter",fontWeight:500 }}>{dateStr}</span>
                    <span style={{ fontSize:10,fontWeight:700,padding:"3px 10px",borderRadius:4,background:`${catColor(n.category)}15`,color:catColor(n.category),border:`1px solid ${catColor(n.category)}30`,letterSpacing:1 }}>{catLabel(n.category)}</span>
                  </div>
                  <h2 style={{ fontSize:16,fontWeight:700,color:"#f8fafc",marginBottom:10,lineHeight:1.55 }}>{n.title}</h2>
                  {n.body && <p style={{ fontSize:13,lineHeight:1.9,color:"#cbd5e1",whiteSpace:"pre-wrap" }}>{n.body}</p>}
                  {n.link_url && <a href={n.link_url} target="_blank" rel="noopener noreferrer" style={{ display:"inline-block",marginTop:12,fontSize:12,color:"#60a5fa",fontWeight:600 }}>詳しく見る →</a>}
                </article>
              );
            })}
          </div>
        )}

        {/* Back to home */}
        <div style={{ textAlign:"center",marginTop:40 }}>
          <Link href="/corporate" style={{ display:"inline-flex",alignItems:"center",gap:6,padding:"10px 28px",borderRadius:8,border:"1px solid rgba(148,163,184,0.25)",color:"#cbd5e1",fontSize:12,fontWeight:600 }}>← TOPに戻る</Link>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ padding:"28px 24px",background:"#020617",borderTop:"1px solid rgba(96,165,250,0.06)",textAlign:"center" }}>
        <p style={{ fontSize:11,color:"#334155" }}>© {new Date().getFullYear()} 合同会社テラスライフ. All rights reserved.</p>
      </footer>
    </div>
  );
}
