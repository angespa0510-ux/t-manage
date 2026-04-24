// TERA-MANAGE マスター管理画面用のダミーデータ
// Phase 5 で実装される tmanage_instances テーブルの設計に沿って作成
// 実際のDB接続は Phase 2 以降で実装

export type TmanageInstance = {
  id: string;
  corporation_id: string;
  corporation_name: string;
  name: string;              // 屋号
  name_en?: string;
  shop_type?: string;
  concept?: string;
  description?: string;
  logo_url?: string;
  theme_color_primary?: string;
  theme_color_accent?: string;
  subdomain: string;
  custom_domain?: string;
  status: "active" | "suspended" | "archived" | "preparing";
  plan: "light" | "standard" | "full";
  operation_type: "self" | "external";
  group_tag?: string;
  created_at: string;
  go_live_date?: string;
  fiscal_month: number;
  tax_accountant_name?: string;
  contract_type?: "paid" | "free" | "trial";
  settings: {
    cash_management?: {
      wallets: string[];
      has_reserve_fund: boolean;
      reserve_fund_name?: string;
      has_room_uncollected: boolean;
      has_safe_uncollected: boolean;
      daily_close_required: boolean;
      carry_over_allowed: boolean;
    };
    payment_fees?: {
      card: number;
      paypay: number;
      line_pay: number;
      cash: number;
    };
    labels?: {
      welfare_fee: string;
      reserve_fund?: string;
    };
  };
  modules: Record<ModuleKey, boolean>;
  stats: {
    therapist_count: number;
    monthly_reservations: number;
    monthly_revenue: number;
    last_activity_at: string;
  };
};

export type ModuleKey =
  | "hp"
  | "external_hp"
  | "customer_mypage"
  | "ai_video"
  | "point_management"
  | "mail_marketing"
  | "tax"
  | "cti"
  | "iot_integration"
  | "chrome_extensions"
  | "notification"
  | "ranking"
  | "e_contract";

export const MODULE_LABELS: Record<ModuleKey, { name: string; description: string; tier: 3 }> = {
  hp: { name: "HP作成", description: "T-MANAGEで新規HPを生成", tier: 3 },
  external_hp: { name: "既存HP引用", description: "既存HPをT-MANAGEで引用表示", tier: 3 },
  customer_mypage: { name: "お客様マイページ", description: "会員登録・予約確認・ポイント", tier: 3 },
  ai_video: { name: "AI動画生成", description: "セラピスト紹介動画の自動生成", tier: 3 },
  point_management: { name: "ポイント管理", description: "顧客ポイントシステム", tier: 3 },
  mail_marketing: { name: "メール配信", description: "メルマガ・自動配信", tier: 3 },
  tax: { name: "税務機能", description: "税理士ポータル・源泉徴収・支払調書", tier: 3 },
  cti: { name: "CTI連携", description: "電話着信時に顧客情報ポップアップ", tier: 3 },
  iot_integration: { name: "IoT連携", description: "カメラ・鍵管理", tier: 3 },
  chrome_extensions: { name: "Chrome拡張", description: "LINE自動送信等", tier: 3 },
  notification: { name: "お知らせ投稿", description: "会員・セラピスト向けお知らせ", tier: 3 },
  ranking: { name: "売上ランキング", description: "セラピスト間の売上順位表示", tier: 3 },
  e_contract: { name: "電子契約", description: "契約書のオンライン署名", tier: 3 },
};

export const TIER1_MODULES = [
  "予約管理（タイムチャート）",
  "精算処理",
  "スタッフ管理",
  "営業締め・日次集計",
];

export const TIER2_MODULES = [
  "顧客カルテ",
  "セラピスト管理",
  "シフト管理",
  "セラピストマイページ",
  "スタッフ勤怠",
  "部屋割り管理",
  "経費管理",
  "売上分析",
  "マニュアル管理",
  "コース・指名・オプション設定",
  "書類提出",
];

// ============================================
// ダミーインスタンスデータ
// ============================================

export const DUMMY_INSTANCES: TmanageInstance[] = [
  {
    id: "inst-001",
    corporation_id: "corp-001",
    corporation_name: "合同会社テラスライフ",
    name: "アンジュスパ",
    name_en: "Ange Spa",
    shop_type: "メンズエステ",
    concept: "プライベートサロン",
    description: "完全個室のプライベートサロン。名古屋・三河安城・豊橋に展開",
    theme_color_primary: "#c3a782",
    theme_color_accent: "#8b7355",
    subdomain: "ange-spa",
    custom_domain: "ange-spa.com",
    status: "active",
    plan: "full",
    operation_type: "self",
    group_tag: "resexy",
    created_at: "2025-04-01T00:00:00Z",
    go_live_date: "2026-06-01",
    fiscal_month: 3,
    tax_accountant_name: "江坂瑠衣",
    contract_type: "paid",
    settings: {
      cash_management: {
        wallets: ["bank", "office_cash", "nagoya_cash", "mikawa_anjo_cash", "toyohashi_cash"],
        has_reserve_fund: true,
        reserve_fund_name: "豊橋予備金",
        has_room_uncollected: true,
        has_safe_uncollected: true,
        daily_close_required: true,
        carry_over_allowed: true,
      },
      payment_fees: { card: 10, paypay: 0, line_pay: 10, cash: 0 },
      labels: { welfare_fee: "備品・リネン代", reserve_fund: "豊橋予備金" },
    },
    modules: {
      hp: true, external_hp: false, customer_mypage: true, ai_video: true,
      point_management: true, mail_marketing: false, tax: true, cti: true,
      iot_integration: true, chrome_extensions: true, notification: true,
      ranking: true, e_contract: true,
    },
    stats: {
      therapist_count: 35,
      monthly_reservations: 1248,
      monthly_revenue: 18500000,
      last_activity_at: "2026-04-24T10:30:00Z",
    },
  },
  {
    id: "inst-002",
    corporation_id: "corp-002",
    corporation_name: "合同会社ライフテラス",
    name: "RESEXY〜リゼクシー",
    name_en: "RESEXY",
    shop_type: "メンズエステ",
    concept: "大型グループサロン",
    description: "100名超のセラピストが在籍するグループサロン",
    theme_color_primary: "#8b0020",
    theme_color_accent: "#d4a5a5",
    subdomain: "resexy",
    custom_domain: undefined,
    status: "preparing",
    plan: "full",
    operation_type: "external",
    group_tag: "resexy",
    created_at: "2026-04-24T00:00:00Z",
    go_live_date: "2027-01-01",
    fiscal_month: 9,
    tax_accountant_name: "江坂瑠衣",
    contract_type: "free",
    settings: {
      cash_management: {
        wallets: ["bank", "office_cash"],
        has_reserve_fund: false,
        has_room_uncollected: false,
        has_safe_uncollected: false,
        daily_close_required: true,
        carry_over_allowed: false,
      },
      payment_fees: { card: 10, paypay: 10, line_pay: 10, cash: 0 },
      labels: { welfare_fee: "備品・リネン代" },
    },
    modules: {
      hp: true, external_hp: false, customer_mypage: true, ai_video: false,
      point_management: true, mail_marketing: true, tax: true, cti: true,
      iot_integration: true, chrome_extensions: true, notification: true,
      ranking: false, e_contract: true,
    },
    stats: {
      therapist_count: 112,
      monthly_reservations: 0,
      monthly_revenue: 0,
      last_activity_at: "2026-04-24T14:00:00Z",
    },
  },
  // 将来予定の店舗（プレースホルダー）
  {
    id: "inst-003",
    corporation_id: "corp-003",
    corporation_name: "（未定）",
    name: "LEON",
    shop_type: "メンズエステ",
    concept: "RESEXY GROUP 3号店",
    subdomain: "leon",
    status: "preparing",
    plan: "full",
    operation_type: "external",
    group_tag: "resexy",
    created_at: "2027-03-01T00:00:00Z",
    go_live_date: "2027-04-01",
    fiscal_month: 9,
    theme_color_primary: "#2d3d66",
    theme_color_accent: "#8ab4e8",
    settings: {},
    modules: {
      hp: true, external_hp: false, customer_mypage: true, ai_video: false,
      point_management: true, mail_marketing: true, tax: true, cti: true,
      iot_integration: false, chrome_extensions: true, notification: true,
      ranking: false, e_contract: true,
    },
    stats: {
      therapist_count: 0,
      monthly_reservations: 0,
      monthly_revenue: 0,
      last_activity_at: "2027-03-01T00:00:00Z",
    },
  },
];

// ============================================
// ヘルパー関数
// ============================================

export function getInstanceById(id: string): TmanageInstance | undefined {
  return DUMMY_INSTANCES.find((i) => i.id === id);
}

export function getStatusLabel(status: TmanageInstance["status"]): { label: string; color: string } {
  switch (status) {
    case "active": return { label: "稼働中", color: "#6b9b7e" };
    case "preparing": return { label: "準備中", color: "#b38419" };
    case "suspended": return { label: "一時停止", color: "#8b7355" };
    case "archived": return { label: "アーカイブ", color: "#888" };
  }
}

export function getPlanLabel(plan: TmanageInstance["plan"]): string {
  switch (plan) {
    case "light": return "ライト";
    case "standard": return "スタンダード";
    case "full": return "フル";
  }
}

export function formatJPY(amount: number): string {
  if (amount === 0) return "¥0";
  if (amount >= 10000) return `¥${(amount / 10000).toFixed(1)}万`;
  return `¥${amount.toLocaleString()}`;
}

export function formatDateJP(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}

export function daysUntilGoLive(go_live_date?: string): number | null {
  if (!go_live_date) return null;
  const target = new Date(go_live_date);
  const now = new Date();
  const diff = target.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}
