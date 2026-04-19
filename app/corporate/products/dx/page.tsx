import ProductDetailLayout from "../../../../components/ProductDetailLayout";

export default function DXProductPage() {
  return (
    <ProductDetailLayout
      badge="DIGITAL TRANSFORMATION"
      badgeColor="#7c3aed"
      name="TERA DX"
      tagline="DX推進パッケージ"
      heroDesc="紙の契約書、手書きの帳簿、属人的なノウハウ——アナログ業務を一つずつデジタルに置き換え、業務効率と正確性を飛躍的に向上させます。"
      keyFeatures={[
        { icon: "✍️", image: "/corporate/features/dx-contract.png", title: "電子契約・書類管理", desc: "契約書の電子署名、身分証のデジタル提出、各種届出書のペーパーレス化。LINEやメール経由でスマホから完結。" },
        { icon: "🧾", image: "/corporate/features/dx-tax.png", title: "AI帳簿・税務支援", desc: "経費のAI自動仕分け、源泉徴収の自動計算、支払調書のPDF生成。確定申告をステップガイドで完全サポート。" },
        { icon: "📚", image: "/corporate/features/dx-knowledge.png", title: "ナレッジベース構築", desc: "業務マニュアル・手順書・ノウハウをデジタル化。AIチャットによる質疑応答で、新人教育コストを大幅削減。" },
      ]}
      subProducts={[
        {
          name: "TERA Contract",
          tagline: "電子契約 & デジタル書類管理",
          desc: "業務委託契約書の電子署名、本人確認書類のアップロード、各種届出書の提出をすべてスマホで完結。管理画面からリンクを一括発行し、LINEやメールで送信するだけで手続きが完了します。",
          features: ["電子署名","身分証アップロード","一括リンク発行","提出ステータス管理"],
          challenge: "法的有効性を満たす電子署名の要件を調査しつつ、ITに不慣れな方でも迷わない操作性を追求。実際に5名のテストユーザーで検証し、つまずくポイントを1つずつ解消していきました。",
          devVoice: "以前は書類を印刷→記入→回収→スキャン→保存で1人30分。今はリンクを送るだけで全工程が完了します。年間の紙代・印刷代もゼロに。",
          clientVoice: { text: "遠方のスタッフとの契約手続きがオンラインで完結するようになり、採用リードタイムが1週間短縮されました。", attr: "人材派遣業 G社 人事部" },
          demoImage: "/corporate/demos/contract-demo.jpg",
          demoCaption: "ADMIN CONSOLE PREVIEW",
          demoOrientation: "landscape",
        },
        {
          name: "TERA Tax",
          tagline: "AI税務・経理支援システム",
          desc: "個人事業主・フリーランスの確定申告を7ステップで完全ガイド。収支の自動集計、経費のAI仕分け、源泉徴収の計算、支払調書PDF生成まで一気通貫。2026年税制改正にも随時対応。",
          features: ["確定申告ステップガイド","AI経費仕分け","源泉徴収自動計算","支払調書PDF"],
          challenge: "税制は毎年変わるため、情報の鮮度維持が最大の課題。基礎控除の引き上げ、ひとり親控除の拡充など、改正のたびにロジックを更新。税理士の監修を受けながら正確性を担保しています。",
          devVoice: "確定申告が難しいと感じていた方が、ステップを追うだけで自力でe-Tax申告できるようになった時が一番嬉しい瞬間です。",
          clientVoice: { text: "業務委託スタッフの確定申告サポートに使っています。源泉徴収の計算ミスがなくなり、経理の負担が大幅に減りました。", attr: "IT業 H社 管理部門" },
          demoImage: "/corporate/demos/tax-demo.jpg",
          demoCaption: "TAX FILING GUIDE PREVIEW",
          demoOrientation: "landscape",
        },
        {
          name: "TERA Knowledge",
          tagline: "ナレッジベース & AIサポート",
          desc: "業務マニュアル・手順書・ノウハウをカテゴリ別に整理し、スタッフが自分で学べるナレッジベースを構築。記事の並び替え・画像挿入・相互リンク・AIチャットによる質疑応答を統合した、次世代の社内Wiki。",
          features: ["カテゴリ管理","ドラッグ並び替え","画像挿入","AI質疑応答"],
          challenge: "ナレッジベースを作っても読まれなければ意味がありません。その解決策がAIチャット連携。記事の内容をAIが学習し、自然言語で質問するだけで該当箇所を引用付きで回答してくれます。",
          devVoice: "新人教育の時間が約60%短縮。先輩スタッフが付きっきりで教える必要がなくなり、組織全体の生産性が向上しました。",
          clientVoice: { text: "ベテランの退職時にノウハウが失われる問題が解消。暗黙知がデジタル化され、組織としての知識資産が積み上がっています。", attr: "製造業 I社 業務改善部" },
          demoImage: "/corporate/demos/knowledge-demo.jpg",
          demoCaption: "KNOWLEDGE BASE PREVIEW",
          demoOrientation: "landscape",
        },
      ]}
      techStack={["電子署名 (Canvas API)", "PDF生成 (jsPDF)", "Anthropic Claude API", "Supabase Storage", "LINE Messaging API", "e-Tax連携", "Markdown Parser"]}
    />
  );
}
