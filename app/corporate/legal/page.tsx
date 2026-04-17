"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";

type Store = { company_name?: string; company_address?: string; company_phone?: string; company_email?: string; representative_name?: string; representative_title?: string };

export default function LegalPage() {
  const [co, setCo] = useState<Store>({});

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.from("stores").select("company_name,company_address,company_phone,company_email,representative_name,representative_title").order("id").limit(1).single();
        if (data) setCo(data);
      } catch (e) { console.log("legal fetch error:", e); }
    })();
  }, []);

  const rows = [
    { l: "販売事業者名", v: co.company_name || "合同会社テラスライフ" },
    { l: "代表者", v: co.representative_name ? `${co.representative_title || "代表社員"} ${co.representative_name}` : "—" },
    { l: "所在地", v: co.company_address || "愛知県安城市" },
    { l: "電話番号", v: co.company_phone || "—（お電話でのお問い合わせの受付は、メールにてご予約をお願いいたします）" },
    { l: "メール", v: co.company_email || "info@terrace-life.co.jp" },
    { l: "販売価格", v: "各サービスページに記載、または個別見積もり" },
    { l: "商品代金以外の必要料金", v: "振込手数料はお客様負担、消費税は別途" },
    { l: "代金の支払時期および方法", v: "請求書発行後、指定口座への銀行振込（原則、月末締め翌月末払い）" },
    { l: "役務の提供時期", v: "契約締結後、別途合意した開始日よりサービス提供を開始" },
    { l: "返品・キャンセルについて", v: "サービスの性質上、提供開始後のキャンセル・返品はお受けできません。契約前のキャンセルは可能です。詳細は個別契約書に従います。" },
    { l: "動作環境", v: "Webブラウザ: Google Chrome 最新版、Safari 最新版、Microsoft Edge 最新版を推奨" },
  ];

  return (
    <div style={{ fontFamily: "'Noto Sans JP','Helvetica Neue',sans-serif", color: "#f8fafc", background: "#020617", minHeight: "100vh" }}>
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@300;400;500;700;900&family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />
      <style>{`*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}a{color:inherit;text-decoration:none}`}</style>

      <nav style={{ position:"sticky",top:0,zIndex:50,background:"rgba(2,6,23,0.88)",backdropFilter:"blur(20px)",borderBottom:"1px solid rgba(96,165,250,0.08)" }}>
        <div style={{ maxWidth:1100,margin:"0 auto",padding:"0 24px",display:"flex",alignItems:"center",justifyContent:"space-between",height:56 }}>
          <Link href="/corporate" style={{ display:"flex",alignItems:"center",gap:8 }}>
            <div style={{ width:28,height:28,borderRadius:6,background:"linear-gradient(135deg,#2563eb,#06b6d4)",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:800,fontSize:10,fontFamily:"Inter" }}>TL</div>
            <span style={{ fontSize:12,fontWeight:600,color:"#94a3b8" }}>← TOPに戻る</span>
          </Link>
          <span style={{ fontSize:11,fontWeight:700,color:"#94a3b8",letterSpacing:1 }}>LEGAL</span>
        </div>
      </nav>

      <article style={{ maxWidth:800,margin:"0 auto",padding:"80px 24px" }}>
        <h1 style={{ fontFamily:"Inter,'Noto Sans JP'",fontSize:"clamp(24px,3.5vw,34px)",fontWeight:900,letterSpacing:-.5,marginBottom:16 }}>特定商取引法に基づく表記</h1>
        <p style={{ fontSize:13,color:"#94a3b8",marginBottom:40,lineHeight:1.8 }}>「特定商取引に関する法律」第11条（通信販売についての広告）に基づき、以下のとおり表記いたします。</p>

        <div style={{ borderRadius:14,overflow:"hidden",border:"1px solid rgba(96,165,250,0.12)",background:"rgba(10,22,40,0.5)" }}>
          {rows.map((r, i) => (
            <div key={i} style={{ display:"grid",gridTemplateColumns:"160px 1fr",gap:20,padding:"18px 24px",borderBottom:i === rows.length-1 ? "none" : "1px solid rgba(255,255,255,0.04)",alignItems:"baseline" }}>
              <span style={{ fontSize:12,fontWeight:700,color:"#60a5fa",letterSpacing:.5 }}>{r.l}</span>
              <span style={{ fontSize:13,color:"#e2e8f0",lineHeight:1.8,whiteSpace:"pre-wrap" }}>{r.v}</span>
            </div>
          ))}
        </div>

        <p style={{ fontSize:11,color:"#64748b",marginTop:24,lineHeight:1.8 }}>
          ※ 本表記の記載事項に関するお問い合わせ、または契約内容の確認等は、上記メールアドレスまでご連絡ください。
        </p>
      </article>

      <footer style={{ padding:"28px 24px",background:"#020617",borderTop:"1px solid rgba(96,165,250,0.06)",textAlign:"center" }}>
        <p style={{ fontSize:11,color:"#334155" }}>© {new Date().getFullYear()} 合同会社テラスライフ. All rights reserved.</p>
      </footer>
    </div>
  );
}
