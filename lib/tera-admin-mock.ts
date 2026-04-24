// TERA-MANAGE マスター管理画面用のダミーデータ
// Phase 5 で実装される tmanage_instances テーブルの設計に沿って作成
// 実際のDB接続は Phase 2 以降で実装

// ============================================
// 準備タスクの型定義（status === "preparing" 時に表示）
// ============================================

export type PreparationTaskCategory =
  | "contract"      // 契約・法務
  | "data"          // データ準備
  | "system"        // システム設定
  | "content"       // コンテンツ準備
  | "test"          // テスト
  | "launch";       // 稼働準備

export type PreparationTaskStatus = "done" | "in_progress" | "pending" | "blocked";

export type PreparationTask = {
  id: string;
  category: PreparationTaskCategory;
  title: string;
  description?: string;
  status: PreparationTaskStatus;
  assignee?: "terasu_life" | "instance_side" | "both";  // 担当
  due_date?: string;
  progress?: { current: number; total: number };  // 進捗がある場合
  completed_at?: string;
};

export const CATEGORY_INFO: Record<PreparationTaskCategory, { label: string; icon: string; color: string }> = {
  contract: { label: "契約・法務", icon: "📋", color: "#8b7355" },
  data: { label: "データ準備", icon: "💾", color: "#4a7c9c" },
  system: { label: "システム設定", icon: "⚙️", color: "#c96b83" },
  content: { label: "コンテンツ準備", icon: "🎨", color: "#b38419" },
  test: { label: "テスト", icon: "🧪", color: "#6b9b7e" },
  launch: { label: "稼働準備", icon: "🚀", color: "#c45555" },
};

export const STATUS_INFO: Record<PreparationTaskStatus, { label: string; color: string; icon: string }> = {
  done: { label: "完了", color: "#6b9b7e", icon: "✅" },
  in_progress: { label: "進行中", color: "#b38419", icon: "🔄" },
  pending: { label: "未着手", color: "#888780", icon: "⏳" },
  blocked: { label: "ブロック中", color: "#c45555", icon: "🚫" },
};

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
  preparation_tasks?: PreparationTask[];
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
    theme_color_primary: "#5d0015",
    theme_color_accent: "#a82c45",
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
    preparation_tasks: [
      // 契約・法務
      { id: "t1", category: "contract", title: "業務委託契約書の内容合意", description: "甲乙間で業務範囲・責任分界点を確認", status: "done", assignee: "both", completed_at: "2026-04-24T15:00:00Z" },
      { id: "t2", category: "contract", title: "書面での正式契約締結", description: "社長同士で対面にて記名押印", status: "done", assignee: "both", completed_at: "2026-04-24T15:30:00Z" },
      { id: "t3", category: "contract", title: "契約書テンプレートの弁護士レビュー", description: "今後の他店舗展開用として精査", status: "pending", assignee: "terasu_life", due_date: "2026-05-31" },

      // データ準備
      { id: "t4", category: "data", title: "セラピスト情報の受領", description: "リゼクシー社長から既存セラピスト112名分のデータを直接受領", status: "pending", assignee: "instance_side", due_date: "2026-11-30", progress: { current: 0, total: 112 } },
      { id: "t5", category: "data", title: "セラピスト写真の転送", description: "既存HPから写真を取得（肖像権クリア済み）", status: "pending", assignee: "terasu_life", due_date: "2026-11-30", progress: { current: 0, total: 112 } },
      { id: "t6", category: "data", title: "コース・料金表の整理", description: "リゼクシーの既存メニューを T-MANAGE 形式で登録", status: "pending", assignee: "both", due_date: "2026-11-30" },
      { id: "t7", category: "data", title: "出張コース料金体系の確定", description: "出張○○分コースとして登録する料金設定", status: "pending", assignee: "instance_side", due_date: "2026-10-31" },

      // システム設定
      { id: "t8", category: "system", title: "Supabase Pro プラン移行", description: "Free → Pro ($25/月) にアップグレード", status: "pending", assignee: "terasu_life", due_date: "2026-05-20" },
      { id: "t9", category: "system", title: "マルチインスタンス基盤実装（Phase 2〜4）", description: "instance_id カラム追加・backfill・ラッパー関数", status: "pending", assignee: "terasu_life", due_date: "2026-11-30" },
      { id: "t10", category: "system", title: "リゼクシー専用インスタンス発行", description: "resexy.t-manage.jp の発行処理", status: "pending", assignee: "terasu_life", due_date: "2026-12-05" },
      { id: "t11", category: "system", title: "サブドメイン設定（resexy.t-manage.jp）", description: "Vercel にドメイン追加・SSL発行", status: "pending", assignee: "terasu_life", due_date: "2026-12-05" },
      { id: "t12", category: "system", title: "電子契約モジュール実装", description: "e_contract モジュールの開発", status: "pending", assignee: "terasu_life", due_date: "2026-12-20" },

      // コンテンツ準備
      { id: "t13", category: "content", title: "新HPのデザインテーマ確認", description: "ワインレッド系のブランディング最終確認", status: "pending", assignee: "both", due_date: "2026-11-30" },
      { id: "t14", category: "content", title: "HPコンテンツ作成", description: "店舗紹介・アクセス・料金・FAQページ", status: "pending", assignee: "terasu_life", due_date: "2026-12-15" },
      { id: "t15", category: "content", title: "既存HP（resexy.info）の DNS 移行準備", description: "DNS切替のタイミング調整", status: "pending", assignee: "instance_side", due_date: "2027-01-15" },

      // テスト
      { id: "t16", category: "test", title: "ステージング環境でのテスト運用", description: "2026/12月中にテスト運用実施", status: "pending", assignee: "both", due_date: "2026-12-25" },
      { id: "t17", category: "test", title: "CTI連携の動作確認", description: "電話着信ポップアップの実機テスト", status: "pending", assignee: "both", due_date: "2026-12-25" },
      { id: "t18", category: "test", title: "セラピストマイページの動作確認", description: "シフト提出・給与明細表示のテスト", status: "pending", assignee: "both", due_date: "2026-12-28" },
      { id: "t19", category: "test", title: "決済手数料計算のテスト", description: "カード・PayPay・LINE Pay 全10%の計算確認", status: "pending", assignee: "terasu_life", due_date: "2026-12-28" },

      // 稼働準備
      { id: "t20", category: "launch", title: "スタッフ研修", description: "Shop Manage からの運用移行サポート", status: "pending", assignee: "both", due_date: "2026-12-28" },
      { id: "t21", category: "launch", title: "プラチナマガジン告知文面準備", description: "リゼクシー側に一任、稼働後1ヶ月で配信", status: "pending", assignee: "instance_side", due_date: "2027-02-01" },
      { id: "t22", category: "launch", title: "IoT機材（カメラ・鍵管理）選定", description: "導入判断はリゼクシー側に一任", status: "pending", assignee: "instance_side", due_date: "2027-01-15" },
      { id: "t23", category: "launch", title: "2027/1/1 本格稼働", description: "月初スタートで経理の区切りを明確化", status: "pending", assignee: "both", due_date: "2027-01-01" },
    ],
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
    preparation_tasks: [
      { id: "l1", category: "contract", title: "法人情報確定", description: "運営法人の決定", status: "pending", assignee: "instance_side" },
      { id: "l2", category: "contract", title: "契約書締結", description: "弁護士レビュー済みテンプレートで締結", status: "pending", assignee: "both" },
      { id: "l3", category: "data", title: "セラピスト情報受領", description: "既存セラピスト一覧の提供", status: "pending", assignee: "instance_side" },
      { id: "l4", category: "system", title: "インスタンス発行", description: "leon.t-manage.jp 発行", status: "pending", assignee: "terasu_life" },
      { id: "l5", category: "launch", title: "2027/4/1 稼働開始", status: "pending", assignee: "both", due_date: "2027-04-01" },
    ],
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

// ============================================
// 準備タスク関連ヘルパー
// ============================================

export function getTaskStats(tasks?: PreparationTask[]): {
  total: number;
  done: number;
  in_progress: number;
  pending: number;
  blocked: number;
  progressPct: number;
} {
  if (!tasks || tasks.length === 0) {
    return { total: 0, done: 0, in_progress: 0, pending: 0, blocked: 0, progressPct: 0 };
  }
  const total = tasks.length;
  const done = tasks.filter((t) => t.status === "done").length;
  const in_progress = tasks.filter((t) => t.status === "in_progress").length;
  const pending = tasks.filter((t) => t.status === "pending").length;
  const blocked = tasks.filter((t) => t.status === "blocked").length;
  const progressPct = Math.round((done / total) * 100);
  return { total, done, in_progress, pending, blocked, progressPct };
}

export function getAssigneeLabel(assignee?: PreparationTask["assignee"]): string {
  switch (assignee) {
    case "terasu_life": return "テラスライフ側";
    case "instance_side": return "店舗側";
    case "both": return "双方";
    default: return "-";
  }
}

export function groupTasksByCategory(
  tasks: PreparationTask[]
): Record<PreparationTaskCategory, PreparationTask[]> {
  const grouped: Record<PreparationTaskCategory, PreparationTask[]> = {
    contract: [],
    data: [],
    system: [],
    content: [],
    test: [],
    launch: [],
  };
  for (const task of tasks) {
    grouped[task.category].push(task);
  }
  return grouped;
}
