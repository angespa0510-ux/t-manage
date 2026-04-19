/* ═══════════════════════════════════════════
   DX導入フロー コンテンツデータ
   claude.ai/design の生成物をベースに
   TERA AI / DX / Cloud の文脈に合わせてカスタマイズ
   ═══════════════════════════════════════════ */

export type Step = {
  id: string;
  num: string;
  code: string;
  title: string;
  en: string;
  summary: string;
  duration: string;
  deliverables: string[];
  tasks: { t: string; d: string }[];
  metric: { label: string; value: string; note: string };
  color: "cyan" | "lime";
  relatedProducts?: string[]; // 関連プロダクト
};

export const DX_STEPS: Step[] = [
  {
    id: "step-01",
    num: "01",
    code: "PHASE_01",
    title: "ヒアリング",
    en: "Discovery",
    summary:
      "経営層・現場・既存システムの3方向から現状を立体的に把握。「何をDXするか」を一緒に定義します。テクノロジーありきではなく、御社の本当の課題に向き合う時間です。",
    duration: "2週間",
    deliverables: ["現状業務フロー図", "課題インサイトレポート", "ゴール定義書(3年)"],
    tasks: [
      { t: "経営層インタビュー", d: "3年後の事業像とKGIを言語化(90分×2回)" },
      { t: "現場メンバー同行", d: "実務に張り付いて非効率を観察・計測" },
      { t: "既存システム棚卸し", d: "SaaS/社内システム/Excel資産をマップ化" },
      { t: "KPI仮説設計", d: "削減工数・売上・満足度の候補を抽出" },
    ],
    metric: { label: "対話時間", value: "16h+", note: "経営層・現場合算" },
    color: "cyan",
  },
  {
    id: "step-02",
    num: "02",
    code: "PHASE_02",
    title: "分析",
    en: "Analysis",
    summary:
      "ヒアリング結果をデータで裏付け。ROIが高い領域を特定し、投資すべき順番を決めます。TERA AI Analytics の需要予測モデルも、この段階で試験適用可能。",
    duration: "3週間",
    deliverables: ["業務分析レポート", "ROI試算モデル", "優先度マトリクス"],
    tasks: [
      { t: "業務プロセス分解", d: "作業を秒単位まで分解し頻度×時間で計測" },
      { t: "ボトルネック特定", d: "属人化・二重入力・承認滞留を発見" },
      { t: "ROI試算", d: "工数削減×単価×頻度で年間効果を数値化" },
      { t: "優先度マッピング", d: "インパクト × 実現性の2軸で順序決定" },
    ],
    metric: { label: "想定効果", value: "¥8.4M", note: "年間削減額(中央値)" },
    color: "cyan",
    relatedProducts: ["TERA AI Analytics"],
  },
  {
    id: "step-03",
    num: "03",
    code: "PHASE_03",
    title: "提案",
    en: "Proposal",
    summary:
      "TERA AI / TERA DX / TERA Cloud を御社の課題に合わせて組み合わせ、Lite/Std/Pro の3案を提示。コスト・スピード・拡張性のトレードオフを明確に。",
    duration: "2週間",
    deliverables: ["導入計画書(3案)", "ツール構成表", "見積・ロードマップ"],
    tasks: [
      { t: "ソリューション設計", d: "自社プロダクト + 外部SaaSをハイブリッド設計" },
      { t: "プロダクト選定", d: "TERA AI/DX/Cloud の中から必要な機能だけ選定" },
      { t: "移行シナリオ策定", d: "段階移行計画とリスク対応策を明文化" },
      { t: "稟議サポート", d: "経営会議で通る意思決定資料を共同作成" },
    ],
    metric: { label: "提案パターン", value: "3案", note: "Lite/Std/Pro" },
    color: "lime",
    relatedProducts: ["TERA AI", "TERA DX", "TERA Cloud"],
  },
  {
    id: "step-04",
    num: "04",
    code: "PHASE_04",
    title: "実装",
    en: "Implementation",
    summary:
      "「入れて終わり」を避け、現場が翌月から使いこなせる状態まで伴走します。TERA Knowledge で操作マニュアルも内製化し、属人化を根本から断ち切ります。",
    duration: "2〜3ヶ月",
    deliverables: ["本番環境", "業務別マニュアル", "研修動画・記録"],
    tasks: [
      { t: "環境構築・設定", d: "SaaS初期設定・API連携・権限設計" },
      { t: "データ移行", d: "既存データのクレンジングと段階的投入" },
      { t: "受入テスト", d: "現場と一緒に業務シナリオで検証" },
      { t: "教育・研修", d: "TERA Knowledge に手順書を蓄積・配信" },
    ],
    metric: { label: "定着率", value: "94%", note: "導入3ヶ月後" },
    color: "lime",
    relatedProducts: ["TERA Knowledge", "TERA Cloud Core"],
  },
  {
    id: "step-05",
    num: "05",
    code: "PHASE_05",
    title: "運用",
    en: "Operations",
    summary:
      "月次の定例と改善サイクルで、DXを一過性ではなく文化として根付かせます。TERA AI Chat が社内FAQを学習し、日常の問い合わせに自動回答するところまで設計。",
    duration: "継続(12ヶ月〜)",
    deliverables: ["月次KPIレポート", "改善提案書", "次期ロードマップ"],
    tasks: [
      { t: "KPIダッシュボード運用", d: "削減工数・売上・満足度を可視化" },
      { t: "月次定例", d: "90分/月で課題抽出と打ち手を決定" },
      { t: "機能追加・改善", d: "現場FBに基づく小さな改善を高速実施" },
      { t: "次フェーズ提案", d: "AI活用・自動化など次の一手を提案" },
    ],
    metric: { label: "平均継続", value: "26ヶ月", note: "契約期間" },
    color: "cyan",
    relatedProducts: ["TERA AI Chat", "TERA AI Analytics"],
  },
];

// 工数推移データ(月次) / 導入前100を基準
export const DX_TRENDS = {
  months: ["M0", "M1", "M2", "M3", "M4", "M5", "M6", "M7", "M8", "M9", "M10", "M11", "M12"],
  workload: [100, 98, 92, 80, 66, 54, 48, 44, 42, 40, 38, 37, 36],
  errorRate: [100, 95, 88, 76, 62, 50, 42, 35, 30, 26, 22, 20, 18],
  satisfaction: [42, 44, 48, 55, 62, 68, 73, 77, 80, 82, 84, 86, 88],
  phases: [
    { label: "Phase 01-02\nヒアリング・分析", from: 0, to: 2 },
    { label: "Phase 03\n提案", from: 2, to: 3 },
    { label: "Phase 04\n実装", from: 3, to: 6 },
    { label: "Phase 05\n運用・改善", from: 6, to: 12 },
  ],
};

// コスト/効果比較
export const DX_COST = {
  investment: [
    { label: "初期費用", value: 180, unit: "万円", note: "Phase 01〜03" },
    { label: "実装コスト", value: 240, unit: "万円", note: "Phase 04" },
    { label: "月額運用", value: 18, unit: "万円/月", note: "Phase 05〜" },
  ],
  roi: [
    { label: "12ヶ月", value: 1.4, note: "投資回収点" },
    { label: "24ヶ月", value: 3.2, note: "累積ROI" },
    { label: "36ヶ月", value: 5.8, note: "累積ROI" },
  ],
};

// 支援実績 — プロダクト名を実際に差し込み
export const DX_CASES = [
  {
    industry: "製造業",
    size: "従業員 85名",
    title: "受発注書類の電子化と自動仕分け",
    before: "FAX/電話受注、Excel転記で月次140時間",
    after: "TERA AI Scan + TERA Contract で月次28時間",
    effect: "-80%",
    metric: "年間1,344h削減 / 誤発注ほぼゼロ",
    products: ["TERA AI Scan", "TERA Contract"],
    color: "cyan" as const,
  },
  {
    industry: "卸売業",
    size: "従業員 42名",
    title: "在庫・予約のリアルタイム管理",
    before: "拠点ごとの台帳管理・月末棚卸集計で3日",
    after: "TERA Cloud Core でリアルタイム同期+自動発注",
    effect: "-62%",
    metric: "欠品率 8.2% → 1.1%",
    products: ["TERA Cloud Core", "TERA AI Analytics"],
    color: "lime" as const,
  },
  {
    industry: "サービス業",
    size: "従業員 120名",
    title: "顧客対応とシフト管理の刷新",
    before: "紙+Excel集計3日、シフト調整は属人化",
    after: "TERA Cloud Portal + AIシフト最適化で集計3時間",
    effect: "-94%",
    metric: "残業時間 23% 削減 / 満足度 +18pt",
    products: ["TERA Cloud Portal", "TERA AI Analytics"],
    color: "cyan" as const,
  },
];

// FAQ
export const DX_FAQ = [
  {
    q: "社内にITに詳しい人がいないのですが、進められますか?",
    a: "はい、むしろそういった中小企業こそ主な支援対象です。専門用語を翻訳しながら伴走し、現場の方が無理なく使える形まで一緒に作ります。TERA Knowledge に操作手順をまとめることで、担当者が不在でも誰でも扱える体制を構築できます。",
  },
  {
    q: "費用感はどのくらい見ておけば良いですか?",
    a: "Phase 01〜03の診断・提案で180万円前後、実装は規模により240〜800万円、運用は月額18万円〜が目安です。プロダクトは必要な機能だけ選んで導入できるので、初期費用を抑えてスタートすることも可能です。",
  },
  {
    q: "どのくらいの期間で効果が出ますか?",
    a: "実装完了から3ヶ月で定着し、6ヶ月で工数が半減、12ヶ月で投資回収というのが平均的な推移です。生産効率は業務ごとに20%〜最大70%の改善が目安です。",
  },
  {
    q: "既存のシステムは使えなくなりますか?",
    a: "いいえ。既存資産は極力活かす方針です。API連携やデータ移行で「捨てる」「活かす」を切り分けて設計します。TERA Cloud は既存システムとの共存を前提に作られています。",
  },
  {
    q: "補助金は使えますか?",
    a: "IT導入補助金・事業再構築補助金などの活用を前提に、申請書類作成まで一貫してサポートします。弊社プロダクトはIT導入補助金の対象ツールとして申請可能です。",
  },
];

// ===== 3プロダクトラインナップ =====
export type ProductLine = {
  line: string;
  tagline: string;
  accent: "cyan" | "lime" | "magenta";
  href: string;
  sub: { name: string; desc: string }[];
  lead: string;
};

export const DX_PRODUCTS: ProductLine[] = [
  {
    line: "TERA AI",
    tagline: "判断・読取・予測を自動化",
    accent: "cyan",
    href: "/corporate/products/ai",
    lead: "社内のマニュアル・書類・データをAIが学習。繰り返し判断や書類処理から人を解放します。",
    sub: [
      { name: "TERA AI Chat", desc: "業務特化型AIチャットボット" },
      { name: "TERA AI Scan", desc: "AI書類読取 & 自動分類" },
      { name: "TERA AI Analytics", desc: "AI売上予測 & 経営分析" },
    ],
  },
  {
    line: "TERA DX",
    tagline: "契約・経理・ナレッジを電子化",
    accent: "lime",
    href: "/corporate/products/dx",
    lead: "紙とExcelで動いていた業務を電子化。法的要件を満たしつつ、現場の使いやすさを両立します。",
    sub: [
      { name: "TERA Contract", desc: "電子契約 & デジタル書類管理" },
      { name: "TERA Tax", desc: "AI税務・経理支援システム" },
      { name: "TERA Knowledge", desc: "ナレッジベース & AIサポート" },
    ],
  },
  {
    line: "TERA Cloud",
    tagline: "予約・リソース・顧客接点を統合",
    accent: "magenta",
    href: "/corporate/products/web",
    lead: "リアルタイム同期でどこからでも。現場オーナーが自ら開発した実戦仕様のプラットフォーム。",
    sub: [
      { name: "TERA Cloud Core", desc: "統合業務管理プラットフォーム" },
      { name: "TERA Cloud Space", desc: "リアルタイム リソース配置管理" },
      { name: "TERA Cloud Portal", desc: "顧客セルフサービスポータル" },
    ],
  },
];
