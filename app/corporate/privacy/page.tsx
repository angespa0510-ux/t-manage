"use client";

import Link from "next/link";

export default function PrivacyPage() {
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
          <span style={{ fontSize:11,fontWeight:700,color:"#94a3b8",letterSpacing:1 }}>PRIVACY</span>
        </div>
      </nav>

      <article style={{ maxWidth:800,margin:"0 auto",padding:"80px 24px" }}>
        <h1 style={{ fontFamily:"Inter,'Noto Sans JP'",fontSize:"clamp(24px,3.5vw,34px)",fontWeight:900,letterSpacing:-.5,marginBottom:16 }}>プライバシーポリシー</h1>
        <p style={{ fontSize:12,color:"#64748b",marginBottom:40 }}>最終更新日: 2025年4月1日</p>

        <div style={{ fontSize:13,lineHeight:2,color:"#cbd5e1" }}>
          <p style={{ marginBottom:32 }}>合同会社テラスライフ（以下「当社」といいます）は、お客様の個人情報の重要性を認識し、個人情報の保護に関する法律（個人情報保護法）を遵守するとともに、以下のプライバシーポリシー（以下「本ポリシー」といいます）を定め、個人情報の保護に努めます。</p>

          {[
            {
              t: "第1条（個人情報の定義）",
              b: "本ポリシーにおいて「個人情報」とは、個人情報保護法第2条第1項により定義される個人情報を指し、生存する個人に関する情報であって、当該情報に含まれる氏名、生年月日、住所、電話番号、連絡先その他の記述等により特定の個人を識別できる情報を指します。"
            },
            {
              t: "第2条（個人情報の収集方法）",
              b: "当社は、お客様がサービスの利用登録・お問い合わせをされる際に、氏名、会社名、メールアドレス、電話番号等の個人情報をお尋ねすることがあります。また、お客様と提携先などとの間でなされたお客様の個人情報を含む取引記録や決済に関する情報を当社の提携先などから収集することがあります。"
            },
            {
              t: "第3条（個人情報を収集・利用する目的）",
              b: "当社が個人情報を収集・利用する目的は、以下のとおりです。\n1. 当社サービスの提供・運営のため\n2. お客様からのお問い合わせに回答するため\n3. 当社サービスに関する各種連絡（メンテナンス情報・重要なお知らせ等）のため\n4. 当社の新サービス・キャンペーン等のご案内のため\n5. 利用規約に違反したお客様の特定・対応のため\n6. 上記の利用目的に付随する目的"
            },
            {
              t: "第4条（利用目的の変更）",
              b: "当社は、利用目的が変更前と関連性を有すると合理的に認められる場合に限り、個人情報の利用目的を変更するものとします。利用目的の変更を行った場合には、変更後の目的について当社所定の方法により、お客様に通知し、または本ウェブサイト上に公表するものとします。"
            },
            {
              t: "第5条（個人情報の第三者提供）",
              b: "当社は、次に掲げる場合を除いて、あらかじめお客様の同意を得ることなく、第三者に個人情報を提供することはありません。ただし、個人情報保護法その他の法令で認められる場合を除きます。\n1. 法令に基づく場合\n2. 人の生命、身体または財産の保護のために必要がある場合であって、本人の同意を得ることが困難であるとき\n3. 公衆衛生の向上または児童の健全な育成の推進のために特に必要がある場合\n4. 国の機関もしくは地方公共団体またはその委託を受けた者が法令の定める事務を遂行することに対して協力する必要がある場合"
            },
            {
              t: "第6条（個人情報の開示）",
              b: "当社は、お客様本人から個人情報の開示を求められたときは、お客様本人に対し、遅滞なくこれを開示します。ただし、開示することにより次のいずれかに該当する場合は、その全部または一部を開示しないこともあり、開示しない決定をした場合には、その旨を遅滞なく通知します。\n1. 本人または第三者の生命、身体、財産その他の権利利益を害するおそれがある場合\n2. 当社の業務の適正な実施に著しい支障を及ぼすおそれがある場合\n3. その他法令に違反することとなる場合"
            },
            {
              t: "第7条（個人情報の訂正および削除）",
              b: "お客様は、当社の保有する自己の個人情報が誤った情報である場合には、当社が定める手続きにより、当社に対して個人情報の訂正、追加または削除（以下「訂正等」といいます）を請求することができます。当社は、お客様から訂正等の請求を受けてその請求に応じる必要があると判断した場合には、遅滞なく当該個人情報の訂正等を行うものとします。"
            },
            {
              t: "第8条（個人情報の利用停止等）",
              b: "当社は、本人から、個人情報が利用目的の範囲を超えて取り扱われているという理由、または不正の手段により取得されたものであるという理由により、その利用の停止または消去（以下「利用停止等」といいます）を求められた場合には、遅滞なく必要な調査を行い、その結果に基づき、個人情報の利用停止等を行い、その旨本人に通知します。"
            },
            {
              t: "第9条（セキュリティ対策）",
              b: "当社は、個人情報の漏洩・滅失・毀損を防止するため、適切な安全管理措置を講じます。具体的には、通信の暗号化（SSL/TLS）、データベースへのアクセス制御、アクセスログの記録・監視、定期的なセキュリティ監査などを実施しています。"
            },
            {
              t: "第10条（Cookie等の利用）",
              b: "当社のウェブサイトでは、より良いサービス提供のためCookieおよび類似技術を使用することがあります。Cookieは、お客様のブラウザ設定により無効化できますが、一部機能がご利用いただけなくなる場合があります。"
            },
            {
              t: "第11条（プライバシーポリシーの変更）",
              b: "本ポリシーの内容は、法令その他本ポリシーに別段の定めのある事項を除いて、お客様に通知することなく、変更することができるものとします。当社が別途定める場合を除いて、変更後のプライバシーポリシーは、本ウェブサイトに掲載したときから効力を生じるものとします。"
            },
            {
              t: "第12条（お問い合わせ窓口）",
              b: "本ポリシーに関するお問い合わせは、下記の窓口までお願いいたします。\n\n合同会社テラスライフ\n所在地：愛知県安城市\nメール：info@terrace-life.co.jp\n受付時間：平日10:00〜18:00（土日祝日・年末年始を除く）"
            }
          ].map((s, i) => (
            <section key={i} style={{ marginBottom:32 }}>
              <h2 style={{ fontSize:16,fontWeight:700,color:"#60a5fa",marginBottom:12,paddingBottom:8,borderBottom:"1px solid rgba(96,165,250,0.15)" }}>{s.t}</h2>
              <p style={{ whiteSpace:"pre-wrap" }}>{s.b}</p>
            </section>
          ))}
        </div>

        <div style={{ textAlign:"right",marginTop:40,fontSize:12,color:"#64748b" }}>
          <p>制定日: 2020年4月1日</p>
          <p>最終改訂日: 2025年4月1日</p>
          <p style={{ marginTop:8 }}>合同会社テラスライフ</p>
        </div>
      </article>

      <footer style={{ padding:"28px 24px",background:"#020617",borderTop:"1px solid rgba(96,165,250,0.06)",textAlign:"center" }}>
        <p style={{ fontSize:11,color:"#334155" }}>© {new Date().getFullYear()} 合同会社テラスライフ. All rights reserved.</p>
      </footer>
    </div>
  );
}
