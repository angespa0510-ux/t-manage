"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";

type Job = { id: number; title: string; job_type: string; summary: string; description: string; requirements: string; salary_range: string; location: string };

export default function CareersPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [openId, setOpenId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.from("corporate_jobs").select("*").eq("is_open", true).order("sort_order");
        if (data) setJobs(data);
      } catch (e) { console.log("jobs fetch error:", e); }
      setLoading(false);
    })();
  }, []);

  const typeLabel = (t: string) => t === "full_time" ? "正社員" : t === "part_time" ? "パート" : t === "contract" ? "業務委託" : t === "intern" ? "インターン" : "その他";
  const typeColor = (t: string) => t === "full_time" ? "#22c55e" : t === "part_time" ? "#06b6d4" : t === "contract" ? "#f59e0b" : "#a78bfa";

  return (
    <div style={{ fontFamily: "'Noto Sans JP','Helvetica Neue',sans-serif", color: "#f8fafc", background: "#020617", minHeight: "100vh" }}>
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@300;400;500;700;900&family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />
      <style>{`*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}a{color:inherit;text-decoration:none}@keyframes fadeIn{from{opacity:0}to{opacity:1}}`}</style>

      <nav style={{ position:"sticky",top:0,zIndex:50,background:"rgba(2,6,23,0.88)",backdropFilter:"blur(20px)",borderBottom:"1px solid rgba(96,165,250,0.08)" }}>
        <div style={{ maxWidth:1100,margin:"0 auto",padding:"0 24px",display:"flex",alignItems:"center",justifyContent:"space-between",height:56 }}>
          <Link href="/corporate" style={{ display:"flex",alignItems:"center",gap:8 }}>
            <div style={{ width:28,height:28,borderRadius:6,background:"linear-gradient(135deg,#2563eb,#06b6d4)",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:800,fontSize:10,fontFamily:"Inter" }}>TL</div>
            <span style={{ fontSize:12,fontWeight:600,color:"#94a3b8" }}>← TOPに戻る</span>
          </Link>
          <span style={{ fontSize:11,fontWeight:700,color:"#22c55e",letterSpacing:1 }}>CAREERS</span>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ padding:"80px 24px 60px",background:"radial-gradient(ellipse at 50% 0%,rgba(34,197,94,0.1),#020617 70%)",textAlign:"center" }}>
        <span style={{ display:"inline-block",fontSize:11,fontWeight:700,color:"#22c55e",letterSpacing:3,marginBottom:12 }}>CAREERS</span>
        <h1 style={{ fontFamily:"Inter,'Noto Sans JP'",fontSize:"clamp(28px,4.5vw,44px)",fontWeight:900,letterSpacing:-.5 }}>採用情報</h1>
        <p style={{ fontSize:14,color:"#94a3b8",marginTop:16,maxWidth:600,margin:"16px auto 0",lineHeight:1.8 }}>
          「現場で役立つテクノロジー」を一緒に作る仲間を募集しています。<br/>
          地方発信で、日本中の中小企業のDXを支える。そんなチャレンジに興味がある方、お待ちしております。
        </p>
      </section>

      {/* Our Values */}
      <section style={{ padding:"20px 24px 40px",maxWidth:900,margin:"0 auto" }}>
        <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",gap:16,marginBottom:48 }}>
          {[
            { icon:"🎯", title:"現場志向", desc:"エンジニアリングのための開発ではなく、お客様の業務課題を解決する開発を大切にします。" },
            { icon:"🏡", title:"リモートワーク可", desc:"リモート中心の働き方を推奨。働く場所より、アウトプットを重視します。" },
            { icon:"🌱", title:"成長環境", desc:"AI・最新技術のキャッチアップ、書籍・セミナー代補助、勉強会開催を支援します。" },
          ].map((v,i) => (
            <div key={i} style={{ padding:"24px 22px",background:"rgba(255,255,255,0.02)",borderRadius:14,border:"1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ fontSize:32,marginBottom:12 }}>{v.icon}</div>
              <h3 style={{ fontSize:14,fontWeight:700,color:"#f8fafc",marginBottom:8 }}>{v.title}</h3>
              <p style={{ fontSize:12,lineHeight:1.85,color:"#94a3b8" }}>{v.desc}</p>
            </div>
          ))}
        </div>

        {/* Open Positions */}
        <h2 style={{ fontSize:20,fontWeight:800,color:"#f8fafc",marginBottom:20,fontFamily:"Inter,'Noto Sans JP'" }}>OPEN POSITIONS</h2>
        {loading ? (
          <div style={{ textAlign:"center",padding:"60px 0",color:"#475569" }}>読み込み中...</div>
        ) : jobs.length === 0 ? (
          <div style={{ padding:"40px 24px",background:"rgba(255,255,255,0.02)",borderRadius:14,border:"1px solid rgba(255,255,255,0.06)",textAlign:"center" }}>
            <p style={{ fontSize:14,color:"#94a3b8",marginBottom:16 }}>現在、募集中のポジションはありません</p>
            <p style={{ fontSize:12,color:"#64748b",lineHeight:1.8 }}>将来的に当社で働くことにご興味がある方は、<br/>下記のお問い合わせよりお気軽にご連絡ください。</p>
          </div>
        ) : (
          <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
            {jobs.map(j => (
              <div key={j.id} style={{ borderRadius:14,border:"1px solid rgba(255,255,255,0.08)",background:"rgba(255,255,255,0.02)",overflow:"hidden" }}>
                <button onClick={() => setOpenId(openId === j.id ? null : j.id)} style={{ width:"100%",padding:"24px 28px",background:"none",border:"none",cursor:"pointer",textAlign:"left",color:"#f8fafc",display:"flex",flexDirection:"column",gap:12 }}>
                  <div style={{ display:"flex",alignItems:"center",gap:10,flexWrap:"wrap" }}>
                    <span style={{ fontSize:10,fontWeight:700,padding:"3px 10px",borderRadius:4,background:`${typeColor(j.job_type)}18`,color:typeColor(j.job_type),border:`1px solid ${typeColor(j.job_type)}30`,letterSpacing:1 }}>{typeLabel(j.job_type)}</span>
                    {j.salary_range && <span style={{ fontSize:11,color:"#f59e0b" }}>💰 {j.salary_range}</span>}
                    {j.location && <span style={{ fontSize:11,color:"#94a3b8" }}>📍 {j.location}</span>}
                    <span style={{ marginLeft:"auto",fontSize:18,color:"#64748b",transform:openId===j.id?"rotate(180deg)":"rotate(0)",transition:"transform .25s" }}>⌄</span>
                  </div>
                  <h3 style={{ fontSize:17,fontWeight:700,color:"#f8fafc",lineHeight:1.5 }}>{j.title}</h3>
                  {j.summary && <p style={{ fontSize:12,lineHeight:1.85,color:"#94a3b8" }}>{j.summary}</p>}
                </button>
                {openId === j.id && (
                  <div style={{ padding:"0 28px 24px 28px",animation:"fadeIn .3s ease" }}>
                    <div style={{ borderTop:"1px solid rgba(255,255,255,0.05)",paddingTop:20,display:"flex",flexDirection:"column",gap:20 }}>
                      {j.description && (
                        <div>
                          <h4 style={{ fontSize:11,fontWeight:800,color:"#22c55e",letterSpacing:1.5,marginBottom:8 }}>仕事内容</h4>
                          <p style={{ fontSize:13,lineHeight:1.95,color:"#cbd5e1",whiteSpace:"pre-wrap" }}>{j.description}</p>
                        </div>
                      )}
                      {j.requirements && (
                        <div>
                          <h4 style={{ fontSize:11,fontWeight:800,color:"#06b6d4",letterSpacing:1.5,marginBottom:8 }}>応募要件</h4>
                          <p style={{ fontSize:13,lineHeight:1.95,color:"#cbd5e1",whiteSpace:"pre-wrap" }}>{j.requirements}</p>
                        </div>
                      )}
                      <Link href="/corporate#contact" style={{ marginTop:6,padding:"12px 24px",borderRadius:10,background:"linear-gradient(135deg,#22c55e,#16a34a)",color:"#fff",fontSize:13,fontWeight:700,textAlign:"center",boxShadow:"0 0 20px rgba(34,197,94,0.3)" }}>応募する →</Link>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* CTA */}
        <div style={{ marginTop:48,padding:"32px",borderRadius:16,background:"linear-gradient(135deg,rgba(34,197,94,0.08),rgba(6,182,212,0.06))",border:"1px solid rgba(34,197,94,0.15)",textAlign:"center" }}>
          <h3 style={{ fontSize:16,fontWeight:700,color:"#f8fafc",marginBottom:8 }}>カジュアル面談も歓迎</h3>
          <p style={{ fontSize:12,color:"#94a3b8",marginBottom:20 }}>まずはお話するだけでもOKです。お気軽にご連絡ください。</p>
          <Link href="/corporate#contact" style={{ display:"inline-flex",alignItems:"center",gap:6,padding:"12px 32px",borderRadius:10,background:"linear-gradient(135deg,#22c55e,#16a34a)",color:"#fff",fontSize:13,fontWeight:700,boxShadow:"0 0 24px rgba(34,197,94,0.3)" }}>お問い合わせ →</Link>
        </div>
      </section>

      <footer style={{ padding:"28px 24px",background:"#020617",borderTop:"1px solid rgba(96,165,250,0.06)",textAlign:"center" }}>
        <p style={{ fontSize:11,color:"#334155" }}>© {new Date().getFullYear()} 合同会社テラスライフ. All rights reserved.</p>
      </footer>
    </div>
  );
}
