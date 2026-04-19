import ProductDetailLayout from "../../../../components/ProductDetailLayout";

export default function AIProductPage() {
  return (
    <ProductDetailLayout
      badge="AI SOLUTIONS"
      badgeColor="#3b82f6"
      name="TERA AI"
      tagline="AI 業務支援プラットフォーム"
      heroDesc="社内ナレッジの自動学習から、書類のAI読取、経営データの予測分析まで。御社の業務にAIを組み込み、人が本来やるべき仕事に集中できる環境をつくります。"
      keyFeatures={[
        { icon: "💬", image: "/corporate/features/ai-chat.png", title: "社内AIアシスタント", desc: "業務マニュアル・社内規程・FAQをAIが学習。スタッフの「これどうやるの？」に24時間即答。問い合わせ工数を大幅削減。" },
        { icon: "📄", image: "/corporate/features/ai-scan.png", title: "書類AI読取・自動分類", desc: "スキャン画像やFAXをAIが読み取り、書類種別の判定・ファイル名の自動付与・PDF変換まで一括処理。" },
        { icon: "📊", image: "/corporate/features/ai-analytics.png", title: "データ分析・予測", desc: "蓄積されたデータからトレンド分析・需要予測・最適なリソース配置をAIが提案。経営判断をデータドリブンに。" },
      ]}
      subProducts={[
        {
          name: "TERA AI Chat",
          tagline: "業務特化型AIチャットボット",
          desc: "社内のマニュアル・規程・ノウハウをRAG構造でAIに学習させ、スタッフからの質問に自動応答。一般的なChatGPTとは異なり、御社固有の情報に基づいた正確な回答を返します。回答の評価機能（👍👎）で精度を継続改善。",
          features: ["RAG構造","回答評価機能","利用回数制御","マルチカテゴリ対応"],
          challenge: "汎用AIでは社内固有の手順を正確に回答できません。マニュアル記事の構造化と、質問パターンの分析を繰り返し、回答精度を実用レベルまで引き上げるのに3ヶ月を要しました。",
          devVoice: "AIに聞けば分かるという安心感が、スタッフの自立を促します。管理者への問い合わせ件数は導入前の1/3に減少しました。",
          clientVoice: { text: "新人教育のコストが劇的に下がりました。OJTで先輩が付きっきりだった時間がほぼゼロに。", attr: "サービス業 A社 マネージャー" },
          demoImage: "/corporate/demos/chat-demo.jpg",
          demoCaption: "CHAT INTERFACE PREVIEW",
          demoOrientation: "landscape",
        },
        {
          name: "TERA AI Scan",
          tagline: "AI書類読取 & 自動分類エンジン",
          desc: "スマホで撮影した書類やFAX画像をAIが瞬時に解析。領収書・請求書・契約書・身分証など書類の種別を自動判定し、適切なファイル名を付与してPDF化。バラバラだった書類管理を完全に自動化します。",
          features: ["画像認識・OCR","カテゴリ自動判定","自動リネーム","複数ページ統合"],
          challenge: "書類の種類は数十種に及び、斜め撮影やFAXの低画質にも対応する必要がありました。プロンプト調整を50回以上繰り返し、認識率95%以上を達成。",
          devVoice: "月次の書類整理に3時間かかっていた作業が10分に短縮。ファイル名の命名規則も統一され、検索性が飛躍的に向上しました。",
          clientVoice: { text: "経理部門の残業が月10時間減りました。紙の山から解放されて本当に助かっています。", attr: "物流業 B社 経理部長" },
          demoImage: "/corporate/demos/scan-demo.jpg",
          demoCaption: "DASHBOARD PREVIEW",
          demoOrientation: "landscape",
        },
        {
          name: "TERA AI Analytics",
          tagline: "AI売上予測 & 経営分析",
          desc: "予約・売上・稼働率・顧客データを統合分析し、来月の売上予測、最適な人員配置、顧客の離脱リスクをAIが算出。ダッシュボードで経営状況を一目で把握できます。",
          features: ["売上予測モデル","最適シフト提案","顧客離脱予測","ダッシュボード"],
          challenge: "データ蓄積が少ない導入初期の予測精度が課題でした。季節変動・曜日特性・イベント影響など変数が多く、半年分のデータが溜まってようやく実用レベルに到達。",
          devVoice: "感覚でやっていたシフト調整が数字で裏付けられるようになり、人件費の最適化に直結しました。",
          clientVoice: { text: "来週の繁忙予測が出るので、事前にスタッフを増員できるようになりました。機会損失が確実に減っています。", attr: "飲食業 C社 店長" },
          demoImage: "/corporate/demos/analytics-demo.jpg",
          demoCaption: "ANALYTICS PORTAL PREVIEW",
          demoOrientation: "landscape",
        },
      ]}
      techStack={["Anthropic Claude API", "RAG (Retrieval-Augmented Generation)", "Supabase", "Next.js", "TypeScript", "Edge Functions", "Vision API"]}
    />
  );
}
