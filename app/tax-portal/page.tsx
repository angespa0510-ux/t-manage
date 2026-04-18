"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";
import { useTheme } from "../../lib/theme";
import { NavMenu } from "../../lib/nav-menu";
import { useStaffSession } from "../../lib/staff-session";
import { useBackNav } from "../../lib/use-back-nav";

type Reservation = { id: number; customer_name: string; therapist_id: number; date: string; start_time: string; end_time: string; course: string; notes: string };
type Course = { id: number; name: string; duration: number; price: number; therapist_back: number };
type Expense = { id: number; date: string; category: string; name: string; amount: number; store_id: number; is_recurring: boolean; notes: string; type: string; receipt_url?: string; receipt_thumb_url?: string; receipt_name?: string; payment_method?: string; needs_review?: boolean; review_note?: string; flagged_by_name?: string; flagged_at?: string | null };
type Store = { id: number; name: string; company_name?: string; fiscal_month?: number };
type Therapist = { id: number; name: string; real_name?: string; has_withholding?: boolean; has_invoice?: boolean; therapist_invoice_number?: string; transport_fee?: number; address?: string };
type Settlement = { therapist_id: number; date: string; total_back: number; invoice_deduction: number; withholding_tax: number; adjustment: number; final_payment: number; transport_fee: number; welfare_fee: number };
type TaxDoc = { id: number; category: string; file_name: string; file_url: string; file_path: string; file_size: number; fiscal_period: string; uploaded_by_name: string; notes: string; created_at: string; target_person_name?: string };
type TaxTaskStatus = { id: number; task_id: string; fiscal_year: number; status: string; note: string; updated_by_name: string; updated_at: string };
type TaxTask = { id: string; timing: string; month: number; title: string; description: string; assignee: "税理士" | "会社" | "社労士" | "共同"; deadline: string; category: string; importance: "high" | "medium" | "low" };

type BankTransaction = { id?: number; transaction_date: string; transaction_time: string; order_no: string; description: string; debit_amount: number; credit_amount: number; balance: number; memo: string; account_category: string; account_label: string; is_expense: boolean; is_confirmed: boolean; confirmed_expense_id?: number | null; imported_at?: string; imported_by_name?: string; _tempId?: string };
type BankRule = { id: number; pattern: string; account_category: string; account_label: string; is_expense: boolean; priority: number; hit_count: number };

// 勘定科目リスト（expenses.category と対応）
const EXPENSE_CATEGORIES: { value: string; label: string }[] = [
  // 収益
  { value: "income", label: "売上入金" },
  { value: "misc_income", label: "雑収入（受取利息等）" },
  // 固定費系
  { value: "rent", label: "地代家賃" },
  { value: "utilities", label: "水道光熱費" },
  { value: "communication", label: "通信費" },
  { value: "insurance", label: "保険料" },
  { value: "lease", label: "リース料" },
  // 消耗品・衛生系
  { value: "supplies", label: "消耗品費" },
  { value: "sanitary", label: "衛生費" },
  // 移動・交通
  { value: "transport", label: "旅費交通費" },
  { value: "vehicle", label: "車両費" },
  // 広告・営業
  { value: "advertising", label: "広告宣伝費" },
  { value: "entertainment", label: "接待交際費" },
  { value: "meeting", label: "会議費" },
  // 人件費・外注系
  { value: "therapist_back", label: "外注費（セラピスト）" },
  { value: "outsource", label: "外注費（業務委託スタッフ）" },
  { value: "welfare", label: "福利厚生費" },
  { value: "training", label: "研修費" },
  // 専門・諸経費
  { value: "professional", label: "支払報酬（税理士・社労士等）" },
  { value: "fee", label: "支払手数料" },
  { value: "tax_pub", label: "租税公課" },
  { value: "books", label: "新聞図書費" },
  { value: "repair", label: "修繕費" },
  { value: "depreciation", label: "減価償却費" },
  // 汎用
  { value: "other", label: "雑費" },
];

// 3月決算法人の年間税務タスクリスト
const TAX_TASKS: TaxTask[] = [
  // 毎月の業務
  { id: "monthly-payroll", timing: "毎月", month: 0, title: "給与計算・給与振込", description: "スタッフ・社員の給与計算と振込処理", assignee: "会社", deadline: "月末", category: "給与", importance: "high" },
  { id: "monthly-shakai", timing: "毎月", month: 0, title: "社会保険料納付", description: "健康保険・厚生年金の納付（翌月末）", assignee: "会社", deadline: "翌月末", category: "社保", importance: "high" },
  { id: "monthly-kessai", timing: "毎月", month: 0, title: "決済明細の取得・保管", description: "前月分の決済明細PDFを各社管理画面からダウンロードして、書類庫「決済明細」カテゴリに保管:\n□ スターペイメント（カード決済明細）\n　　https://pay2-admin.star-pay.jp/kanri/index.php\n□ PayPay（QR決済明細）\n　　https://www.paypay.ne.jp/portal/oauth2/sign-in?client_id=pay2-merchant-panel-client\n\nファイル名の例: 2026-03_スターペイメント_カード決済明細.pdf\n※ 売上計上と入金の突合に必須の書類。税理士の月次仕訳でも使用。", assignee: "会社", deadline: "毎月10日頃", category: "経理", importance: "medium" },
  { id: "monthly-trial", timing: "毎月", month: 0, title: "月次資料を税理士に提出", description: "前月の売上・経費・銀行明細を税理士ポータルで確認できる状態にして、税理士に試算表作成を依頼（📊 月次サマリーから「月次試算表（管理用）」をPDF出力して送るとスムーズ）", assignee: "共同", deadline: "翌月15日目安", category: "経理", importance: "medium" },
  // 1月
  { id: "jan-withhold-h2", timing: "1月", month: 1, title: "源泉所得税納付（納特・下半期）", description: "7〜12月分の源泉所得税をまとめて納付", assignee: "会社", deadline: "1/20", category: "源泉", importance: "high" },
  { id: "jan-shiharai-chosho", timing: "1月", month: 1, title: "法定調書合計表・支払調書提出", description: "セラピスト等への支払調書と法定調書を税務署に提出", assignee: "税理士", deadline: "1/31", category: "源泉", importance: "high" },
  { id: "jan-kyuyo-hokoku", timing: "1月", month: 1, title: "給与支払報告書提出", description: "社員の前年給与を市区町村に報告（住民税用）", assignee: "税理士", deadline: "1/31", category: "住民税", importance: "high" },
  { id: "jan-shoukyaku", timing: "1月", month: 1, title: "償却資産税申告", description: "該当資産がある場合、市区町村に申告", assignee: "税理士", deadline: "1/31", category: "固定資産", importance: "medium" },
  // 3月
  { id: "mar-tanaoroshi", timing: "3月末", month: 3, title: "棚卸実施", description: "3/31時点の在庫を店舗別に棚卸し。T-MANAGE「📦 棚卸管理」ページで実施:\n□ アンジュスパ三河安城の棚卸（全品目の数量をカウント）\n□ アンジュスパ豊橋の棚卸（全品目の数量をカウント）\n□ 棚卸表PDFを出力\n□ 書類庫の「決算書」カテゴリに保管（ファイル名例: 第3期末_棚卸表_アンジュスパ三河安城.pdf）\n\n※ 税理士への提出も忘れずに。期末の在庫資産金額として決算書に反映されます。", assignee: "会社", deadline: "3/31", category: "決算", importance: "high" },
  { id: "mar-kessan", timing: "3月末", month: 3, title: "決算日（期末）", description: "期末日 - 決算整理スタート", assignee: "共同", deadline: "3/31", category: "決算", importance: "high" },
  { id: "mar-kotei", timing: "3〜4月", month: 3, title: "固定資産台帳更新", description: "減価償却計算と台帳更新", assignee: "税理士", deadline: "4月上旬", category: "固定資産", importance: "high" },
  // 5月
  { id: "may-houjinzei", timing: "5月末", month: 5, title: "法人税・消費税・住民税・事業税申告", description: "決算から2ヶ月以内に確定申告・納税（最重要）", assignee: "税理士", deadline: "5/31", category: "法人税", importance: "high" },
  { id: "may-kessan-doc", timing: "5月末", month: 5, title: "決算書・申告書の完成・保管", description: "完成した決算書・申告書を書類庫にアップ", assignee: "税理士", deadline: "5/31", category: "決算", importance: "high" },
  { id: "may-sokai", timing: "5月", month: 5, title: "社員総会・期末報告", description: "合同会社の場合は年次報告", assignee: "会社", deadline: "5月中", category: "その他", importance: "medium" },
  // 6月
  { id: "jun-juminzei", timing: "6月", month: 6, title: "住民税特別徴収 年度切替", description: "新年度の住民税を給与から天引き開始", assignee: "会社", deadline: "6月給与", category: "住民税", importance: "high" },
  { id: "jun-roudou", timing: "6〜7月", month: 6, title: "労働保険年度更新", description: "労災・雇用保険の概算・確定申告", assignee: "社労士", deadline: "7/10", category: "労保", importance: "high" },
  // 7月
  { id: "jul-withhold-h1", timing: "7月", month: 7, title: "源泉所得税納付（納特・上半期）", description: "1〜6月分の源泉所得税をまとめて納付", assignee: "会社", deadline: "7/10", category: "源泉", importance: "high" },
  { id: "jul-santei", timing: "7月", month: 7, title: "社会保険算定基礎届提出", description: "標準報酬月額の定時決定届", assignee: "社労士", deadline: "7/10", category: "社保", importance: "high" },
  // 11月
  { id: "nov-chukan", timing: "11月", month: 11, title: "法人税・消費税中間申告", description: "前期税額が一定以上なら中間申告・納付", assignee: "税理士", deadline: "11/30", category: "法人税", importance: "high" },
  { id: "nov-nenchou-prep", timing: "11月", month: 11, title: "年末調整の書類回収開始", description: "役員・社員から以下の書類を回収して書類庫「個人確定申告」カテゴリに保管 → 税理士に共有:\n□ 生命保険料控除証明書（10〜11月に各保険会社から郵送）\n□ 地震保険料控除証明書\n□ 社会保険料控除証明書（国民年金等を個人で払っている場合）\n□ iDeCo等の小規模企業共済等掛金払込証明書\n□ 住宅ローン控除関係書類（初年度のみ）\n□ 扶養控除等異動申告書（扶養家族に変化があった場合）", assignee: "共同", deadline: "11月末", category: "源泉", importance: "high" },
  // 12月
  { id: "dec-nenchou", timing: "12月", month: 12, title: "年末調整", description: "11月に回収した書類をもとに、役員・社員の年末調整を実施。12月給与で還付 or 追加徴収の精算。翌年1月に源泉徴収票を発行。\n※ 2社以上から役員報酬を受けている場合は「主たる給与」のみで年末調整し、全体の精算は2〜3月の役員個人の確定申告で行う。", assignee: "税理士", deadline: "12月給与", category: "源泉", importance: "high" },
  { id: "dec-shoyo", timing: "12月", month: 12, title: "賞与計算・源泉徴収", description: "冬季賞与の計算と源泉処理", assignee: "会社", deadline: "12月支給時", category: "給与", importance: "medium" },
  // 2月
  { id: "feb-kojin-shinkoku", timing: "2〜3月", month: 2, title: "役員個人の確定申告（該当者のみ）", description: "以下に該当する場合は役員個人の確定申告が必要:\n□ 役員報酬が年2,000万円超 → 必須\n□ 2社以上から役員報酬を受けている → 必須\n□ ふるさと納税を6自治体超（ワンストップ特例が使えない）\n□ 医療費が年10万円超（医療費控除）\n□ 住宅ローン控除の初年度\n□ 役員報酬以外の所得（不動産・副業等）あり\n→ 該当書類（寄附金受領証明書・医療費明細等）を書類庫に保管して税理士に提出", assignee: "税理士", deadline: "3/15", category: "源泉", importance: "high" },
];

const DOC_CATEGORIES = ["決算書", "申告書", "契約書", "固定資産", "支払調書", "決済明細", "借入・融資", "保険", "納税通知", "個人確定申告", "その他"];

// 会計ソフト形式
type AccFormat = "general" | "yayoi" | "freee" | "mf";
const ACC_FORMAT_LABELS: Record<AccFormat, string> = {
  general: "汎用CSV",
  yayoi: "弥生会計",
  freee: "freee",
  mf: "MFクラウド",
};

// CSVエスケープ処理
const csvEscape = (v: unknown): string => {
  const s = String(v ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
};

// CSVダウンロード（UTF-8 BOM付き・Excel互換）
const downloadCSV = (rows: (string | number)[][], filename: string) => {
  const bom = "\uFEFF";
  const csv = bom + rows.map(r => r.map(csvEscape).join(",")).join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
};

// Supabase Storageはパスに日本語が使えないため、英語キーにマッピング
const CATEGORY_PATH: Record<string, string> = {
  "決算書": "kessan",
  "申告書": "shinkoku",
  "契約書": "keiyaku",
  "固定資産": "kotei",
  "支払調書": "shiharai",
  "決済明細": "kessai",
  "借入・融資": "shakkin",
  "保険": "hoken",
  "納税通知": "nouzei",
  "個人確定申告": "kojin",
  "その他": "other",
};

// カテゴリ別の入力プレースホルダー（命名ルールガイド）
const NAME_PLACEHOLDER: Record<string, string> = {
  "決算書": "例: 第3期 決算書",
  "申告書": "例: 第3期 法人税申告書",
  "契約書": "例: 本店賃貸借契約書（オアシス）",
  "固定資産": "例: 固定資産台帳 第3期",
  "支払調書": "例: 2025年分 支払調書",
  "決済明細": "例: 2026-03 スターペイメント カード決済明細",
  "借入・融資": "例: 〇〇銀行 返済予定表 2026年4月",
  "保険": "例: 火災保険証券（店舗）",
  "納税通知": "例: 2025年度 固定資産税通知",
  "個人確定申告": "例: 2025年分 生命保険料控除証明書（〇〇生命）",
  "その他": "例: ファイル名",
};
const PERIOD_PLACEHOLDER: Record<string, string> = {
  "契約書": "全期共通",
  "保険": "全期共通",
  "借入・融資": "例: 第3期",
  "納税通知": "例: 第3期",
};
const NOTES_PLACEHOLDER: Record<string, string> = {
  "決算書": "例: 2024年度",
  "契約書": "例: 本店・2024/4契約 / 車両リース",
  "借入・融資": "例: 残高○○万円",
  "保険": "例: 契約期間2025-2027",
  "納税通知": "例: 年税額○○円 4期分納",
};

const ACCOUNT_MAP: Record<string, string> = {
  // 収益
  income: "売上高", misc_income: "雑収入",
  // 固定費
  rent: "地代家賃", utilities: "水道光熱費", communication: "通信費",
  insurance: "保険料", lease: "リース料",
  // 消耗品・衛生
  supplies: "消耗品費", sanitary: "衛生費",
  // 移動
  transport: "旅費交通費", vehicle: "車両費",
  // 広告・営業
  advertising: "広告宣伝費", entertainment: "接待交際費", meeting: "会議費",
  // 人件費・外注
  therapist_back: "外注費", outsource: "外注費",
  welfare: "福利厚生費", training: "研修費",
  // 専門・諸経費
  professional: "支払報酬", fee: "支払手数料", tax_pub: "租税公課",
  books: "新聞図書費", repair: "修繕費", depreciation: "減価償却費",
  // 汎用
  other: "雑費",
};

const fmt = (n: number) => "¥" + (n || 0).toLocaleString();

type SheetKey = "summary" | "sales" | "expense" | "therapist" | "invoice" | "schedule" | "docs" | "bank";

export default function TaxPortal() {
  const router = useRouter();
  const { dark, toggle, T } = useTheme();
  const { activeStaff, canAccessTaxPortal } = useStaffSession();

  const [sheet, setSheet] = useState<SheetKey>("summary");
  const [selectedMonth, setSelectedMonth] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; });
  const [viewMode, setViewMode] = useState<"monthly" | "yearly">("monthly");
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());

  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [staffList, setStaffList] = useState<{ id: number; name: string }[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [companyName, setCompanyName] = useState("合同会社テラスライフ");
  const [fiscalMonth, setFiscalMonth] = useState(3);

  // 書類庫
  const [taxDocs, setTaxDocs] = useState<TaxDoc[]>([]);
  const [docFilter, setDocFilter] = useState<string>("all");
  const [docPeriodFilter, setDocPeriodFilter] = useState<string>("all");
  const [uploadCategory, setUploadCategory] = useState<string>("決算書");
  const [uploadPeriod, setUploadPeriod] = useState<string>("");
  const [uploadDisplayName, setUploadDisplayName] = useState<string>("");
  const [uploadNotes, setUploadNotes] = useState<string>("");
  const [uploadTargetPerson, setUploadTargetPerson] = useState<string>("");
  const [docPersonFilter, setDocPersonFilter] = useState<string>("all");
  const [uploading, setUploading] = useState(false);
  const [editingDocId, setEditingDocId] = useState<number | null>(null);
  const [editingFileName, setEditingFileName] = useState<string>("");

  // 会計ソフト出力形式
  const [accFormat, setAccFormat] = useState<AccFormat>("general");

  // 年間スケジュール
  const [taskStatuses, setTaskStatuses] = useState<TaxTaskStatus[]>([]);
  const [scheduleFilter, setScheduleFilter] = useState<string>("all"); // all/税理士/会社/社労士/共同
  const [scheduleMonthFilter, setScheduleMonthFilter] = useState<string>("all");

  // 銀行取込
  const [bankTxs, setBankTxs] = useState<BankTransaction[]>([]);
  const [bankRules, setBankRules] = useState<BankRule[]>([]);

  // 経費シート拡張（Session 47）
  const [receiptModal, setReceiptModal] = useState<Expense | null>(null);
  const [reviewModal, setReviewModal] = useState<Expense | null>(null);
  const [reviewNoteInput, setReviewNoteInput] = useState<string>("");
  const [onlyReviewFilter, setOnlyReviewFilter] = useState<boolean>(false);
  const [onlyNoReceiptFilter, setOnlyNoReceiptFilter] = useState<boolean>(false);
  const [bulkDLModal, setBulkDLModal] = useState<boolean>(false);
  const [bulkDLMonth, setBulkDLMonth] = useState<string>(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; });
  const [bulkDLCategory, setBulkDLCategory] = useState<string>("all");
  const [bulkDLLoading, setBulkDLLoading] = useState<boolean>(false);
  const [bankParsing, setBankParsing] = useState(false);
  const [bankStagedTxs, setBankStagedTxs] = useState<BankTransaction[]>([]);  // アップ後・確定前
  const [bankFilter, setBankFilter] = useState<"all" | "unconfirmed" | "confirmed">("unconfirmed");
  // ルール編集
  const [editingRuleId, setEditingRuleId] = useState<number | null>(null);
  const [editRulePattern, setEditRulePattern] = useState("");
  const [editRuleCategory, setEditRuleCategory] = useState("other");
  const [editRuleLabel, setEditRuleLabel] = useState("");
  const [editRulePriority, setEditRulePriority] = useState(50);
  // 新規ルール追加
  const [showNewRule, setShowNewRule] = useState(false);
  const [newRulePattern, setNewRulePattern] = useState("");
  const [newRuleCategory, setNewRuleCategory] = useState("other");
  const [newRuleLabel, setNewRuleLabel] = useState("");
  const [newRulePriority, setNewRulePriority] = useState(50);

  const [smYear, smMonth] = selectedMonth.split("-").map(Number);

  // マウス戻るボタン対応: モーダル → シート → 前のページ
  useBackNav(
    sheet,
    setSheet,
    [
      { isOpen: showNewRule, close: () => setShowNewRule(false) },
      { isOpen: editingRuleId !== null, close: () => setEditingRuleId(null) },
      { isOpen: editingDocId !== null, close: () => setEditingDocId(null) },
      { isOpen: receiptModal !== null, close: () => setReceiptModal(null) },
      { isOpen: reviewModal !== null, close: () => { setReviewModal(null); setReviewNoteInput(""); } },
      { isOpen: bulkDLModal, close: () => setBulkDLModal(false) },
    ],
    !!activeStaff && canAccessTaxPortal,
  );

  // 認証・権限チェック
  useEffect(() => {
    if (!activeStaff) { router.push("/dashboard"); return; }
    if (!canAccessTaxPortal) { router.push("/dashboard"); return; }
  }, [activeStaff, canAccessTaxPortal, router]);

  const fetchData = useCallback(async () => {
    const { data: c } = await supabase.from("courses").select("*"); if (c) setCourses(c);
    const { data: s } = await supabase.from("stores").select("*");
    if (s) {
      setStores(s);
      if (s[0]) {
        setCompanyName(s[0].company_name || "合同会社テラスライフ");
        setFiscalMonth(s[0].fiscal_month || 3);
      }
    }

    let startDate: string, endDate: string;
    if (viewMode === "monthly") {
      const dim = new Date(smYear, smMonth, 0).getDate();
      startDate = `${selectedMonth}-01`; endDate = `${selectedMonth}-${String(dim).padStart(2, "0")}`;
    } else {
      startDate = `${selectedYear}-01-01`; endDate = `${selectedYear}-12-31`;
    }

    const { data: r } = await supabase.from("reservations").select("*").gte("date", startDate).lte("date", endDate).order("date");
    if (r) setReservations(r);
    const { data: e } = await supabase.from("expenses").select("*").gte("date", startDate).lte("date", endDate).order("date");
    if (e) setExpenses(e);

    // セラピスト一覧
    const { data: th } = await supabase.from("therapists").select("id,name,real_name,has_withholding,has_invoice,therapist_invoice_number,transport_fee,address");
    if (th) setTherapists(th);

    // スタッフ一覧（書類庫の対象者サジェスト用）
    const { data: st } = await supabase.from("staff").select("id,name").eq("status", "active").order("name");
    if (st) setStaffList(st);

    // 期間内のセラピスト日次清算
    const { data: sts } = await supabase.from("therapist_daily_settlements")
      .select("therapist_id,date,total_back,invoice_deduction,withholding_tax,adjustment,final_payment,transport_fee,welfare_fee")
      .gte("date", startDate).lte("date", endDate).eq("is_settled", true);
    if (sts) setSettlements(sts);
  }, [viewMode, selectedMonth, selectedYear, smYear, smMonth]);

  useEffect(() => { if (canAccessTaxPortal) fetchData(); }, [fetchData, canAccessTaxPortal]);

  // 書類一覧のfetch（期間に依存しないため別で管理）
  const fetchDocs = useCallback(async () => {
    const { data } = await supabase.from("tax_documents").select("*").order("created_at", { ascending: false });
    if (data) setTaxDocs(data);
  }, []);
  useEffect(() => { if (canAccessTaxPortal) fetchDocs(); }, [fetchDocs, canAccessTaxPortal]);

  // 期の算出（3月決算 = 4月始まり）
  const getCurrentFiscalYear = useCallback(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    return currentMonth > fiscalMonth ? currentYear + 1 : currentYear;
  }, [fiscalMonth]);

  // タスクステータスのfetch（選択期分）
  const fetchTaskStatuses = useCallback(async () => {
    const fy = getCurrentFiscalYear();
    const { data } = await supabase.from("tax_task_statuses").select("*").eq("fiscal_year", fy);
    if (data) setTaskStatuses(data);
  }, [getCurrentFiscalYear]);
  useEffect(() => { if (canAccessTaxPortal) fetchTaskStatuses(); }, [fetchTaskStatuses, canAccessTaxPortal]);

  // タスクステータス取得
  const getTaskStatus = (taskId: string): string => {
    const fy = getCurrentFiscalYear();
    return taskStatuses.find(s => s.task_id === taskId && s.fiscal_year === fy)?.status || "pending";
  };

  // タスクステータス変更
  const updateTaskStatus = async (taskId: string, newStatus: string) => {
    if (!activeStaff) return;
    const fy = getCurrentFiscalYear();
    const existing = taskStatuses.find(s => s.task_id === taskId && s.fiscal_year === fy);
    if (existing) {
      await supabase.from("tax_task_statuses").update({ status: newStatus, updated_by_name: activeStaff.name, updated_at: new Date().toISOString() }).eq("id", existing.id);
    } else {
      await supabase.from("tax_task_statuses").insert({ task_id: taskId, fiscal_year: fy, status: newStatus, updated_by_name: activeStaff.name });
    }
    fetchTaskStatuses();
  };

  // ────────────────────────────────────────
  // 銀行取込機能
  // ────────────────────────────────────────
  const fetchBankData = useCallback(async () => {
    const { data: txs } = await supabase.from("bank_transactions").select("*").order("transaction_date", { ascending: false }).limit(500);
    if (txs) setBankTxs(txs);
    const { data: rules } = await supabase.from("bank_category_rules").select("*").order("priority", { ascending: false });
    if (rules) setBankRules(rules);
  }, []);
  useEffect(() => { if (canAccessTaxPortal) fetchBankData(); }, [fetchBankData, canAccessTaxPortal]);

  // 摘要 → 勘定科目の自動判定
  const classifyTx = useCallback((description: string, isExpense: boolean): { category: string; label: string } => {
    // ルールを優先度順にマッチ
    for (const rule of bankRules) {
      if (description.includes(rule.pattern)) {
        return { category: rule.account_category, label: rule.account_label || EXPENSE_CATEGORIES.find(c => c.value === rule.account_category)?.label || rule.account_category };
      }
    }
    // デフォルト: 出金=雑費、入金=売上入金
    if (isExpense) return { category: "other", label: "雑費（要確認）" };
    return { category: "income", label: "売上入金（要確認）" };
  }, [bankRules]);

  // PayPay銀行CSVパーサー（Shift-JIS対応）
  const parsePayPayCSV = async (file: File) => {
    setBankParsing(true);
    try {
      const buffer = await file.arrayBuffer();
      // Shift-JIS として読み込み
      const decoder = new TextDecoder("shift-jis");
      const text = decoder.decode(buffer);
      const lines = text.split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 2) { alert("データが空です"); return; }

      // ヘッダー行をスキップ、2行目以降を処理
      const txs: BankTransaction[] = [];
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        // CSVをパース（ダブルクォート対応）
        const cells: string[] = [];
        let cur = "", inQuote = false;
        for (let j = 0; j < line.length; j++) {
          const ch = line[j];
          if (ch === '"') { inQuote = !inQuote; continue; }
          if (ch === "," && !inQuote) { cells.push(cur); cur = ""; continue; }
          cur += ch;
        }
        cells.push(cur);

        if (cells.length < 11) continue;
        const [year, month, day, hour, min, sec, orderNo, desc, debitStr, creditStr, balanceStr, memo] = cells;
        if (!year || !month || !day || !desc) continue;

        const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        const timeStr = `${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
        const debit = parseInt(debitStr?.replace(/,/g, "") || "0") || 0;
        const credit = parseInt(creditStr?.replace(/,/g, "") || "0") || 0;
        const balance = parseInt(balanceStr?.replace(/,/g, "") || "0") || 0;
        const isExpense = debit > 0;
        const classified = classifyTx(desc, isExpense);

        txs.push({
          transaction_date: dateStr,
          transaction_time: timeStr,
          order_no: orderNo || "",
          description: desc,
          debit_amount: debit,
          credit_amount: credit,
          balance: balance,
          memo: memo || "",
          account_category: classified.category,
          account_label: classified.label,
          is_expense: isExpense,
          is_confirmed: false,
          _tempId: crypto.randomUUID(),
        });
      }

      if (txs.length === 0) { alert("取引データが見つかりませんでした"); return; }
      setBankStagedTxs(txs);
      alert(`${txs.length}件の取引を読み込みました。内容を確認して「取込確定」ボタンを押してください。`);
    } catch (err) {
      alert("CSV読込エラー: " + String(err));
    } finally {
      setBankParsing(false);
    }
  };

  // ステージング中の取引の勘定科目変更
  const updateStagedCategory = (tempId: string, category: string) => {
    setBankStagedTxs(prev => prev.map(t => {
      if (t._tempId !== tempId) return t;
      const label = EXPENSE_CATEGORIES.find(c => c.value === category)?.label || category;
      return { ...t, account_category: category, account_label: label };
    }));
  };

  // ステージング取引をDBに確定（重複は UNIQUE制約でスキップ）
  const confirmStagedTxs = async () => {
    if (bankStagedTxs.length === 0) return;
    if (!confirm(`${bankStagedTxs.length}件の取引を取り込みますか？（重複行は自動スキップ）`)) return;

    const rows = bankStagedTxs.map(t => ({
      transaction_date: t.transaction_date,
      transaction_time: t.transaction_time,
      order_no: t.order_no,
      description: t.description,
      debit_amount: t.debit_amount,
      credit_amount: t.credit_amount,
      balance: t.balance,
      memo: t.memo,
      account_category: t.account_category,
      account_label: t.account_label,
      is_expense: t.is_expense,
      imported_by_name: activeStaff?.name || "",
    }));

    // 500件ずつバッチ挿入
    let ok = 0, ng = 0;
    for (let i = 0; i < rows.length; i += 100) {
      const batch = rows.slice(i, i + 100);
      const { error } = await supabase.from("bank_transactions").upsert(batch, { onConflict: "transaction_date,order_no,description,debit_amount,credit_amount", ignoreDuplicates: true });
      if (error) { ng += batch.length; console.error(error); }
      else ok += batch.length;
    }

    alert(`取込完了: ${ok}件\n${ng > 0 ? `失敗: ${ng}件` : ""}`);
    setBankStagedTxs([]);
    fetchBankData();
  };

  // 登録済み取引の勘定科目変更
  const updateTxCategory = async (txId: number, category: string) => {
    const label = EXPENSE_CATEGORIES.find(c => c.value === category)?.label || category;
    await supabase.from("bank_transactions").update({ account_category: category, account_label: label }).eq("id", txId);
    fetchBankData();
  };

  // 取引を経費として確定（expenses テーブルに登録）
  const confirmExpense = async (tx: BankTransaction) => {
    if (!tx.id || tx.is_confirmed) return;
    if (tx.is_expense && tx.debit_amount > 0) {
      const { data: newExp } = await supabase.from("expenses").insert({
        date: tx.transaction_date,
        category: tx.account_category,
        name: tx.account_label || tx.description.slice(0, 40),
        amount: tx.debit_amount,
        notes: `[銀行取込] ${tx.description}`,
        is_recurring: false,
        type: "expense",
      }).select().single();
      if (newExp) {
        await supabase.from("bank_transactions").update({ is_confirmed: true, confirmed_expense_id: newExp.id }).eq("id", tx.id);
      }
    } else if (!tx.is_expense && tx.credit_amount > 0) {
      // 入金は expenses テーブルに type=income として登録
      const { data: newInc } = await supabase.from("expenses").insert({
        date: tx.transaction_date,
        category: "income",
        name: tx.account_label || tx.description.slice(0, 40),
        amount: tx.credit_amount,
        notes: `[銀行取込] ${tx.description}`,
        is_recurring: false,
        type: "income",
      }).select().single();
      if (newInc) {
        await supabase.from("bank_transactions").update({ is_confirmed: true, confirmed_expense_id: newInc.id }).eq("id", tx.id);
      }
    }
    fetchBankData();
    fetchData(); // 経費シートのデータも更新
  };

  // 一括経費登録
  const confirmAllExpenses = async () => {
    const unconfirmed = bankTxs.filter(t => !t.is_confirmed);
    if (unconfirmed.length === 0) { alert("未確定の取引がありません"); return; }
    if (!confirm(`${unconfirmed.length}件の取引を経費/売上として一括登録しますか？`)) return;
    for (const tx of unconfirmed) { await confirmExpense(tx); }
    alert(`${unconfirmed.length}件を登録しました`);
  };

  // 摘要→勘定科目をルールとして学習
  const learnRule = async (description: string, category: string) => {
    // 摘要の先頭・識別可能な部分を抽出（例: "Vデビット Amazon..." → "Amazon"）
    const suggested = prompt("このルールのマッチ文字列を入力してください（摘要に含まれる部分を指定）:", description.slice(0, 20));
    if (!suggested || !suggested.trim()) return;
    const label = EXPENSE_CATEGORIES.find(c => c.value === category)?.label || category;
    await supabase.from("bank_category_rules").insert({
      pattern: suggested.trim(),
      account_category: category,
      account_label: label,
      is_expense: category !== "income",
      priority: 50,
      created_by_name: activeStaff?.name || "",
    });
    alert(`ルール「${suggested.trim()} → ${label}」を登録しました。次回から自動で分類されます。`);
    fetchBankData();
  };

  const deleteRule = async (id: number) => {
    if (!confirm("このルールを削除しますか？")) return;
    await supabase.from("bank_category_rules").delete().eq("id", id);
    fetchBankData();
  };

  // ルール編集開始
  const startEditRule = (r: BankRule) => {
    setEditingRuleId(r.id);
    setEditRulePattern(r.pattern);
    setEditRuleCategory(r.account_category);
    setEditRuleLabel(r.account_label || "");
    setEditRulePriority(r.priority);
  };

  // ルール編集保存
  const saveEditRule = async () => {
    if (!editingRuleId || !editRulePattern.trim()) { alert("マッチ文字列を入力してください"); return; }
    const label = editRuleLabel.trim() || EXPENSE_CATEGORIES.find(c => c.value === editRuleCategory)?.label || editRuleCategory;
    const { error } = await supabase.from("bank_category_rules").update({
      pattern: editRulePattern.trim(),
      account_category: editRuleCategory,
      account_label: label,
      is_expense: editRuleCategory !== "income",
      priority: editRulePriority,
    }).eq("id", editingRuleId);
    if (error) { alert("エラー: " + error.message); return; }
    setEditingRuleId(null);
    fetchBankData();
  };

  // 新規ルール追加
  const addNewRule = async () => {
    if (!newRulePattern.trim()) { alert("マッチ文字列を入力してください"); return; }
    const label = newRuleLabel.trim() || EXPENSE_CATEGORIES.find(c => c.value === newRuleCategory)?.label || newRuleCategory;
    const { error } = await supabase.from("bank_category_rules").insert({
      pattern: newRulePattern.trim(),
      account_category: newRuleCategory,
      account_label: label,
      is_expense: newRuleCategory !== "income",
      priority: newRulePriority,
      created_by_name: activeStaff?.name || "",
    });
    if (error) { alert("エラー: " + error.message + "（同じマッチ文字列のルールが既に存在する可能性があります）"); return; }
    setNewRulePattern(""); setNewRuleLabel(""); setNewRuleCategory("other"); setNewRulePriority(50);
    setShowNewRule(false);
    fetchBankData();
  };

  // 書類アップロード
  const uploadDoc = async (file: File) => {
    if (!file || !activeStaff) return;
    if (file.size > 20 * 1024 * 1024) { alert("ファイルサイズは20MB以下にしてください"); return; }
    setUploading(true);
    try {
      const ext = (file.name.split(".").pop() || "").replace(/[^a-zA-Z0-9]/g, "").toLowerCase() || "bin";
      const uuid = crypto.randomUUID();
      // Storageパスは英数字のみ（日本語NG）。カテゴリは英語キーに変換
      const pathCat = CATEGORY_PATH[uploadCategory] || "other";
      const path = `${pathCat}/${uuid}.${ext}`;
      const { error: upErr } = await supabase.storage.from("tax-documents").upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) { alert("アップロードに失敗しました: " + upErr.message); setUploading(false); return; }
      const { data: pu } = supabase.storage.from("tax-documents").getPublicUrl(path);
      // 表示名: 入力があれば拡張子付きでその名前、なければ元のファイル名
      let displayName = uploadDisplayName.trim();
      if (displayName && !displayName.toLowerCase().endsWith(`.${ext}`)) {
        displayName = `${displayName}.${ext}`;
      }
      const finalName = displayName || file.name;
      await supabase.from("tax_documents").insert({
        category: uploadCategory,
        file_name: finalName,
        file_url: pu.publicUrl,
        file_path: path,
        file_size: file.size,
        fiscal_period: uploadPeriod.trim(),
        uploaded_by_id: activeStaff.id,
        uploaded_by_name: activeStaff.name,
        notes: uploadNotes.trim(),
        target_person_name: uploadTargetPerson.trim(),
      });
      setUploadPeriod(""); setUploadNotes(""); setUploadDisplayName(""); setUploadTargetPerson("");
      fetchDocs();
    } catch (err) {
      alert("エラー: " + String(err));
    } finally {
      setUploading(false);
    }
  };

  // ファイル名更新
  const saveDocName = async (doc: TaxDoc) => {
    const newName = editingFileName.trim();
    if (!newName) { alert("ファイル名を入力してください"); return; }
    // 元の拡張子を保持する（なければ自動付与）
    const origExt = doc.file_name.includes(".") ? doc.file_name.split(".").pop() : "";
    let finalName = newName;
    if (origExt && !newName.toLowerCase().endsWith(`.${origExt.toLowerCase()}`)) {
      finalName = `${newName}.${origExt}`;
    }
    await supabase.from("tax_documents").update({ file_name: finalName }).eq("id", doc.id);
    setEditingDocId(null);
    setEditingFileName("");
    fetchDocs();
  };

  // 書類削除
  const deleteDoc = async (doc: TaxDoc) => {
    if (!confirm(`「${doc.file_name}」を削除しますか？（元に戻せません）`)) return;
    if (doc.file_path) {
      await supabase.storage.from("tax-documents").remove([doc.file_path]);
    }
    await supabase.from("tax_documents").delete().eq("id", doc.id);
    fetchDocs();
  };

  // 期間ラベル
  const periodLabel = viewMode === "monthly" ? selectedMonth : `${selectedYear}年`;

  // 売上明細CSV出力
  const exportSalesCSV = () => {
    const rows: (string | number)[][] = [];
    if (accFormat === "general") {
      rows.push(["日付", "開始時刻", "終了時刻", "顧客名", "コース", "金額", "バック"]);
      reservations.forEach(r => rows.push([r.date, r.start_time?.slice(0,5) || "", r.end_time?.slice(0,5) || "", r.customer_name || "", r.course || "", getPrice(r), getBack(r)]));
      rows.push(["合計", "", "", "", `${reservations.length}件`, totalSales, totalBack]);
    } else if (accFormat === "yayoi") {
      // 弥生会計・仕訳インポート形式（簡易版）
      rows.push(["取引日付", "借方勘定科目", "借方金額", "貸方勘定科目", "貸方金額", "摘要"]);
      reservations.forEach(r => {
        const price = getPrice(r);
        if (price > 0) rows.push([r.date, "売掛金", price, "売上高", price, `${r.customer_name || ""} ${r.course || ""}`]);
      });
    } else if (accFormat === "freee") {
      // freee 取引インポート形式（収入）
      rows.push(["発生日", "勘定科目", "税区分", "金額", "取引先", "備考"]);
      reservations.forEach(r => {
        const price = getPrice(r);
        if (price > 0) rows.push([r.date, "売上高", "課税売上10%", price, r.customer_name || "", r.course || ""]);
      });
    } else if (accFormat === "mf") {
      // MFクラウド・仕訳インポート形式（簡易版）
      rows.push(["取引日", "借方勘定科目", "借方金額(円)", "貸方勘定科目", "貸方金額(円)", "摘要"]);
      reservations.forEach(r => {
        const price = getPrice(r);
        if (price > 0) rows.push([r.date, "売掛金", price, "売上高", price, `${r.customer_name || ""} ${r.course || ""}`]);
      });
    }
    downloadCSV(rows, `売上_${periodLabel}_${accFormat}.csv`);
  };

  // 🚩 要確認トグル（税理士が経費1件に要確認マーク）
  const toggleExpenseReview = async (exp: Expense, note: string) => {
    const isFlagging = !exp.needs_review; // 現在OFFなら今からONにする
    const updates = isFlagging
      ? {
          needs_review: true,
          review_note: note || "",
          flagged_by_name: activeStaff?.name || "",
          flagged_at: new Date().toISOString(),
        }
      : {
          needs_review: false,
          review_note: "",
          flagged_by_name: "",
          flagged_at: null,
        };
    const { error } = await supabase.from("expenses").update(updates).eq("id", exp.id);
    if (error) { alert("更新に失敗しました: " + error.message); return; }
    setExpenses(prev => prev.map(e => (e.id === exp.id ? { ...e, ...updates } : e)));
    setReviewModal(null);
    setReviewNoteInput("");
  };

  // 📦 領収書一括ZIPダウンロード
  const downloadReceiptsZip = async () => {
    setBulkDLLoading(true);
    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();

      // 対象月の経費を全件取得（現在画面に表示中でなくても取れるように）
      const [y, m] = bulkDLMonth.split("-").map(Number);
      const dim = new Date(y, m, 0).getDate();
      const startDate = `${bulkDLMonth}-01`;
      const endDate = `${bulkDLMonth}-${String(dim).padStart(2, "0")}`;
      let query = supabase.from("expenses").select("*").gte("date", startDate).lte("date", endDate).neq("type", "income").order("date");
      if (bulkDLCategory !== "all") query = query.eq("category", bulkDLCategory);
      const { data: targetExpenses, error } = await query;
      if (error) { alert("データ取得エラー: " + error.message); setBulkDLLoading(false); return; }
      if (!targetExpenses || targetExpenses.length === 0) { alert("対象の経費がありません"); setBulkDLLoading(false); return; }

      const withReceipt = targetExpenses.filter(e => e.receipt_url);
      const withoutReceipt = targetExpenses.filter(e => !e.receipt_url);

      // 集計CSV
      const csvRows: string[] = ["No,日付,勘定科目,項目,金額,備考,領収書ファイル名"];
      for (let i = 0; i < targetExpenses.length; i++) {
        const e = targetExpenses[i];
        const acc = (ACCOUNT_MAP[e.category] || "雑費").replace(/,/g, "_");
        const name = (e.name || "").replace(/,/g, "_");
        const notes = (e.notes || "").replace(/,/g, "_");
        const fileName = e.receipt_url ? `${String(i + 1).padStart(3, "0")}_${e.date}_${e.amount}_${(e.name || "receipt").replace(/[\\/:*?"<>|]/g, "_").slice(0, 20)}` : "";
        csvRows.push([String(i + 1), e.date, acc, name, String(e.amount), notes, fileName].join(","));
      }
      csvRows.push("");
      csvRows.push(`合計件数,${targetExpenses.length}`);
      csvRows.push(`領収書あり,${withReceipt.length}`);
      csvRows.push(`領収書なし,${withoutReceipt.length}`);
      csvRows.push(`合計金額,${targetExpenses.reduce((s, e) => s + (e.amount || 0), 0)}`);
      zip.file("_集計表.csv", "\uFEFF" + csvRows.join("\n")); // BOM付きでExcel文字化け防止

      // 領収書画像を取得してZIPに追加
      let successCount = 0;
      let failCount = 0;
      for (let i = 0; i < withReceipt.length; i++) {
        const e = withReceipt[i];
        try {
          const res = await fetch(e.receipt_url as string);
          if (!res.ok) { failCount++; continue; }
          const blob = await res.blob();
          const ext = (e.receipt_url as string).split(".").pop()?.split("?")[0]?.toLowerCase() || "jpg";
          const safeName = (e.name || "receipt").replace(/[\\/:*?"<>|]/g, "_").slice(0, 20);
          const fileName = `${String(i + 1).padStart(3, "0")}_${e.date}_${e.amount}_${safeName}.${ext}`;
          zip.file(fileName, blob);
          successCount++;
        } catch {
          failCount++;
        }
      }

      // 領収書なしリストをテキストで同梱
      if (withoutReceipt.length > 0) {
        const lines = ["【領収書が登録されていない経費】", ""];
        withoutReceipt.forEach((e, idx) => {
          lines.push(`${idx + 1}. ${e.date}  ${fmt(e.amount)}  ${e.name || ""}  (${ACCOUNT_MAP[e.category] || "雑費"})`);
        });
        zip.file("_領収書なし一覧.txt", lines.join("\n"));
      }

      const zipBlob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = url;
      const catLabel = bulkDLCategory === "all" ? "全カテゴリ" : (ACCOUNT_MAP[bulkDLCategory] || bulkDLCategory);
      a.download = `領収書_${bulkDLMonth}_${catLabel}.zip`;
      a.click();
      URL.revokeObjectURL(url);

      alert(`✅ ダウンロード完了\n\n対象: ${targetExpenses.length}件\n領収書DL成功: ${successCount}件\n領収書なし: ${withoutReceipt.length}件${failCount > 0 ? `\n⚠️ 取得失敗: ${failCount}件` : ""}`);
      setBulkDLModal(false);
    } catch (e: unknown) {
      alert("エラーが発生しました: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBulkDLLoading(false);
    }
  };

  // 📄 支払調書HTMLを生成（1セラピスト分）
  const buildShiharaiHtml = (p: { id: number; name: string; realName: string; hasWithholding: boolean; hasInvoice: boolean; invoiceNum: string; gross: number; invoiceDed: number; tax: number; welfare: number; transport: number; final: number; days: number }) => {
    const th = therapists.find(t => t.id === p.id);
    const store = stores.find(s => !!s.company_name) || stores[0];
    const y = viewMode === "monthly" ? parseInt(selectedMonth.split("-")[0]) : selectedYear;
    const periodLabel = viewMode === "monthly" ? selectedMonth : `${y}年`;
    const thAny = th as unknown as { address?: string; birth_date?: string } | undefined;
    const storeAny = store as unknown as { company_name?: string; company_address?: string; company_phone?: string; invoice_number?: string } | undefined;
    return `<div class="page">
<p class="doc-title">報酬、料金、契約金及び賞金の支払調書</p>
<h1>支　払　調　書</h1>
<h2>対象期間：${y}年1月1日 〜 ${y}年12月31日${viewMode === "monthly" ? `（表示: ${periodLabel}）` : ""}</h2>

<table>
  <tr><th>支払を受ける者（氏名）</th><td>${p.realName}</td></tr>
  ${p.realName !== p.name ? `<tr><th>業務上の名称</th><td>${p.name}</td></tr>` : ""}
  <tr><th>支払を受ける者（住所）</th><td>${thAny?.address || '<span style="color:#c45555">※未登録</span>'}</td></tr>
  ${thAny?.birth_date ? `<tr><th>生年月日</th><td>${thAny.birth_date}</td></tr>` : ""}
  <tr><th>区分</th><td>${p.hasWithholding ? "報酬（所得税法第204条第1項第6号）" : "報酬（所得税法第204条第1項第1号）"}</td></tr>
  <tr><th>細目</th><td>${p.hasWithholding ? "ホステス等の業務に関する報酬" : "マッサージ施術業務"}</td></tr>
  <tr><th>適格請求書発行事業者</th><td>${p.hasInvoice ? `登録あり（登録番号：${p.invoiceNum}）` : "未登録"}</td></tr>
</table>

<table>
  <tr><th style="width:45%">項目</th><th class="right" style="width:20%">金額</th><th style="width:35%">摘要</th></tr>
  <tr><td>稼働日数</td><td class="right">${p.days}日</td><td class="small">年間清算回数</td></tr>
  <tr><td><strong>支払金額（税込）</strong></td><td class="right"><strong>&yen;${p.gross.toLocaleString()}</strong></td><td class="small">業務委託報酬の年間合計</td></tr>
  ${p.invoiceDed > 0 ? `
    <tr><td class="red">仕入税額控除の経過措置</td><td class="right red">-&yen;${p.invoiceDed.toLocaleString()}</td><td class="small">報酬額の10%を控除</td></tr>
    <tr style="background:#f9f6f0"><td>控除後の報酬額</td><td class="right">&yen;${(p.gross - p.invoiceDed).toLocaleString()}</td><td class="small">支払金額 − 仕入税額控除</td></tr>
  ` : ""}
  ${p.tax > 0
    ? `<tr><td class="red">源泉徴収税額</td><td class="right red">-&yen;${p.tax.toLocaleString()}</td><td class="small">所得税及び復興特別所得税</td></tr>`
    : `<tr><td>源泉徴収税額</td><td class="right">&yen;0</td><td class="small">源泉徴収対象外</td></tr>`}
  ${p.welfare > 0 ? `<tr><td class="red">備品代・リネン代</td><td class="right red">-&yen;${p.welfare.toLocaleString()}</td><td class="small">&yen;${p.days > 0 ? Math.round(p.welfare / p.days).toLocaleString() : 0}/日 × ${p.days}日</td></tr>` : ""}
  ${p.transport > 0 ? `<tr><td>交通費（実費精算分）</td><td class="right">&yen;${p.transport.toLocaleString()}</td><td class="small">&yen;${p.days > 0 ? Math.round(p.transport / p.days).toLocaleString() : 0}/日 × ${p.days}日</td></tr>` : ""}
  <tr class="total-row"><td>差引支払額</td><td class="right">&yen;${p.final.toLocaleString()}</td><td class="small">年間支給額合計</td></tr>
</table>

<div style="margin-top:15px">
  <p class="note">※ 支払金額は全て税込（内税方式）で記載。</p>
  <p class="note">※ 源泉徴収税額は所得税法第204条第1項${p.hasWithholding ? "第6号" : "第1号"}に基づき日次清算時に控除済み。</p>
  <p class="note">※ 本書は所得税法第225条第1項に基づく支払調書に準じて作成。</p>
</div>

<div class="section">
  <p style="font-size:11px;color:#888;margin-bottom:8px">支払者</p>
  <div class="company">
    <p><strong>${storeAny?.company_name || ""}</strong></p>
    <p>${storeAny?.company_address || ""}</p>
    <p>TEL: ${storeAny?.company_phone || ""}</p>
    ${storeAny?.invoice_number ? `<p>適格請求書発行事業者登録番号: ${storeAny.invoice_number}</p>` : ""}
  </div>
</div>

<div class="stamp-area">
  <div class="stamp-box">支払者（${storeAny?.company_name || ""}）</div>
  <div class="stamp-box">支払を受ける者（${p.realName} 様）</div>
</div>
</div>`;
  };

  // 📄 支払調書のHTML共通ラッパー
  const buildShiharaiWrapperHtml = (innerHtml: string, title: string) => `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<title>${title}</title>
<style>
body{font-family:'Hiragino Sans','Yu Gothic','Meiryo',sans-serif;margin:0;padding:0;color:#333;background:#f4f4f4}
.page{max-width:750px;margin:20px auto;padding:30px;background:#fff;page-break-after:always;box-shadow:0 2px 8px rgba(0,0,0,0.08)}
.page:last-child{page-break-after:auto}
h1{text-align:center;font-size:20px;border-bottom:3px double #333;padding-bottom:10px;margin-bottom:5px;letter-spacing:4px}
h2{text-align:center;font-size:12px;color:#888;font-weight:normal;margin-bottom:25px}
table{width:100%;border-collapse:collapse;margin:15px 0}
td,th{border:1px solid #ccc;padding:9px 14px;font-size:12px;vertical-align:top}
th{background:#f5f0e8;text-align:left;width:38%}
.right{text-align:right}
.total-row{background:#f9f6f0;font-weight:bold;font-size:14px}
.section{margin-top:25px;padding-top:15px;border-top:1px solid #ddd}
.company{font-size:11px;line-height:2;color:#555}
.note{font-size:9px;color:#888;margin-top:4px;line-height:1.8}
.doc-title{font-size:9px;color:#999;text-align:right;margin-bottom:20px}
.stamp-area{display:flex;justify-content:space-between;margin-top:40px}
.stamp-box{border-top:1px solid #333;width:180px;text-align:center;padding-top:5px;font-size:10px;color:#888}
.small{font-size:10px;color:#888}
.red{color:#c45555}
.print-bar{position:sticky;top:0;z-index:999;background:#c3a782;color:#fff;padding:12px 20px;display:flex;justify-content:space-between;align-items:center;box-shadow:0 2px 6px rgba(0,0,0,0.15)}
.print-bar button{background:#fff;color:#c3a782;border:none;padding:8px 20px;border-radius:4px;cursor:pointer;font-weight:500;font-size:13px;font-family:inherit}
.print-bar button:hover{background:#f5f2ec}
@media print{
  body{background:#fff}
  .page{margin:0;padding:20mm 15mm;box-shadow:none;max-width:none}
  .print-bar{display:none}
}
</style>
</head>
<body>
<div class="print-bar">
  <span>${title}</span>
  <button onclick="window.print()">🖨 印刷 / PDFで保存</button>
</div>
${innerHtml}
</body>
</html>`;

  // 📄 1セラピスト分の支払調書を開く
  const openSingleShiharai = (p: { id: number; name: string; realName: string; hasWithholding: boolean; hasInvoice: boolean; invoiceNum: string; gross: number; invoiceDed: number; tax: number; welfare: number; transport: number; final: number; days: number }) => {
    const html = buildShiharaiWrapperHtml(buildShiharaiHtml(p), `支払調書_${viewMode === "monthly" ? selectedMonth : selectedYear}_${p.realName}`);
    const w = window.open("", "_blank");
    if (!w) { alert("ポップアップがブロックされました。ブラウザ設定を確認してください。"); return; }
    w.document.write(html);
    w.document.close();
  };

  // 📦 全セラピスト分の支払調書を1つの窓にまとめて開く
  const openAllShiharai = () => {
    if (therapistPayroll.length === 0) { alert("対象セラピストがいません"); return; }
    // 5万円超の人（税務署提出対象）と以下の人を分けて案内
    const over5 = therapistPayroll.filter(p => p.gross > 50000);
    const under5 = therapistPayroll.filter(p => p.gross <= 50000);
    const inner = therapistPayroll.map(p => buildShiharaiHtml(p)).join("\n");
    const periodLabel = viewMode === "monthly" ? selectedMonth : `${selectedYear}年`;
    const noticeHtml = `<div class="page" style="page-break-after:always">
<h1 style="letter-spacing:0;font-size:18px">支払調書 一覧（${periodLabel}）</h1>
<p style="text-align:center;color:#888;font-size:11px;margin-bottom:25px">T-MANAGE自動生成 / 合計 ${therapistPayroll.length}名</p>

<table>
  <tr><th style="width:50%;background:#fffceb">📋 税務署提出対象（年間支払額5万円超）</th><td class="right"><strong>${over5.length}名</strong></td></tr>
  <tr><th style="width:50%;background:#f5f2ec">本人交付のみ（年間支払額5万円以下）</th><td class="right">${under5.length}名</td></tr>
</table>

<div style="margin-top:20px">
  <p style="font-size:11px;margin-bottom:10px"><strong>【税務署提出対象のセラピスト】</strong></p>
  <table>
    <tr><th style="width:10%">No</th><th style="width:30%">氏名</th><th class="right" style="width:20%">年間支払額</th><th class="right" style="width:20%">源泉徴収</th><th class="right" style="width:20%">差引支払</th></tr>
    ${over5.length === 0 ? `<tr><td colspan="5" class="small" style="text-align:center">該当なし</td></tr>` : over5.map((p, i) => `<tr><td>${i + 1}</td><td>${p.realName}${p.name !== p.realName ? `<span class="small">（${p.name}）</span>` : ""}</td><td class="right">&yen;${p.gross.toLocaleString()}</td><td class="right red">-&yen;${p.tax.toLocaleString()}</td><td class="right">&yen;${p.final.toLocaleString()}</td></tr>`).join("")}
  </table>
</div>

${under5.length > 0 ? `<div style="margin-top:20px">
  <p style="font-size:11px;margin-bottom:10px"><strong>【本人交付のみのセラピスト（5万円以下）】</strong></p>
  <table>
    <tr><th style="width:10%">No</th><th style="width:30%">氏名</th><th class="right" style="width:20%">年間支払額</th><th class="right" style="width:20%">源泉徴収</th><th class="right" style="width:20%">差引支払</th></tr>
    ${under5.map((p, i) => `<tr><td>${i + 1}</td><td>${p.realName}${p.name !== p.realName ? `<span class="small">（${p.name}）</span>` : ""}</td><td class="right">&yen;${p.gross.toLocaleString()}</td><td class="right">${p.tax > 0 ? `-&yen;${p.tax.toLocaleString()}` : "&yen;0"}</td><td class="right">&yen;${p.final.toLocaleString()}</td></tr>`).join("")}
  </table>
</div>` : ""}

<div style="margin-top:30px;padding:12px;background:#fffceb;border-left:3px solid #c3a782;font-size:10px;line-height:1.8;color:#555">
  <strong>📋 法定調書提出について</strong><br>
  ・年間支払額が5万円を超えるセラピストのみ、税務署への支払調書提出が必要です。<br>
  ・5万円以下のセラピストにも、確定申告用として本人交付は必要です。<br>
  ・提出期限: 翌年1月31日（e-Tax推奨）。<br>
  ・マイナンバー未回収のセラピストがいる場合、提出前に回収してください。
</div>
</div>
`;
    const html = buildShiharaiWrapperHtml(noticeHtml + inner, `支払調書_全員分_${periodLabel}`);
    const w = window.open("", "_blank");
    if (!w) { alert("ポップアップがブロックされました。ブラウザ設定を確認してください。"); return; }
    w.document.write(html);
    w.document.close();
  };

  // 📊 月次試算表（管理用）を新窓で開いて印刷
  const openMonthlyTrialBalance = () => {
    const periodLabel = viewMode === "monthly"
      ? `${selectedMonth.split("-")[0]}年${parseInt(selectedMonth.split("-")[1])}月`
      : `${selectedYear}年`;
    const today = new Date();
    const todayStr = `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日`;

    // 売上内訳
    const cardSales = reservations.reduce((s, r) => {
      const card = (r as unknown as { card_amount?: number }).card_amount || 0;
      return s + card;
    }, 0);
    const paypaySales = reservations.reduce((s, r) => {
      const p = (r as unknown as { paypay_amount?: number }).paypay_amount || 0;
      return s + p;
    }, 0);
    const cashSales = reservations.reduce((s, r) => {
      const c = (r as unknown as { cash_amount?: number }).cash_amount || 0;
      return s + c;
    }, 0);
    const otherIncome = expenses.filter(e => e.type === "income").reduce((s, e) => s + (e.amount || 0), 0);

    // 経費の勘定科目別 (accountSummary をそのまま使う)
    // therapist_back は外注費として別枠表示

    // HTMLを生成
    const rows = accountSummary.filter(a => a.category !== "therapist_back").map(a => {
      const pct = totalExpenseAll > 0 ? Math.round((a.amount / totalExpenseAll) * 100) : 0;
      return `<tr><td class="l">${a.account}</td><td class="r">${fmt(a.amount)}</td><td class="r sub">${pct}%</td></tr>`;
    }).join("");
    const backPct = totalExpenseAll > 0 ? Math.round((totalBack / totalExpenseAll) * 100) : 0;
    const outsourcingRow = totalBack > 0 ? `<tr><td class="l">外注費（業務委託）</td><td class="r">${fmt(totalBack)}</td><td class="r sub">${backPct}%</td></tr>` : "";

    const html = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <title>月次試算表_${periodLabel}_${companyName}</title>
  <style>
    @page { size: A4; margin: 15mm; }
    * { box-sizing: border-box; }
    body { font-family: "Hiragino Sans","Yu Gothic","Meiryo",sans-serif; color: #1a1a1a; font-size: 11pt; line-height: 1.5; margin: 0; padding: 20px; background: #fafafa; }
    .sheet { max-width: 800px; margin: 0 auto; background: #fff; padding: 30px 35px; border: 1px solid #ddd; }
    h1 { font-size: 20pt; text-align: center; margin: 0 0 8px 0; font-weight: 500; letter-spacing: 2px; }
    .subtitle { text-align: center; font-size: 10pt; color: #666; margin-bottom: 25px; }
    .meta { display: flex; justify-content: space-between; margin-bottom: 20px; font-size: 10pt; }
    .meta-block { flex: 1; }
    .meta-block strong { display: inline-block; min-width: 70px; color: #666; font-weight: normal; }
    h2 { font-size: 13pt; border-left: 4px solid #c3a782; padding-left: 10px; margin: 25px 0 10px 0; font-weight: 500; }
    h3 { font-size: 11pt; color: #555; margin: 15px 0 6px 0; font-weight: 500; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 10px; font-size: 10pt; }
    th { background: #f5f2ec; color: #555; padding: 8px 10px; text-align: left; border-bottom: 1px solid #d4c9b0; font-weight: 500; font-size: 9pt; }
    th.r { text-align: right; }
    td { padding: 6px 10px; border-bottom: 1px solid #eee; }
    td.l { text-align: left; }
    td.r { text-align: right; font-variant-numeric: tabular-nums; }
    td.sub { color: #999; font-size: 9pt; }
    tr.total td { background: #fafafa; border-top: 2px solid #888; border-bottom: 2px solid #888; font-weight: 500; padding: 8px 10px; }
    tr.grand td { background: #c3a78215; border-top: 2px solid #c3a782; border-bottom: 3px double #c3a782; font-weight: 500; padding: 10px; font-size: 11pt; }
    tr.profit td { background: ${netProfit >= 0 ? "#22c55e15" : "#c4555515"}; font-weight: 500; color: ${netProfit >= 0 ? "#15803d" : "#9b1c1c"}; }
    tr.sub-row td { padding-left: 25px; color: #555; font-size: 9.5pt; }
    tr.sub-row td.l::before { content: "└ "; color: #aaa; }
    .note { margin-top: 30px; padding: 12px 15px; background: #fffef0; border-left: 3px solid #c3a782; font-size: 9pt; line-height: 1.7; color: #555; }
    .footer { margin-top: 25px; text-align: center; font-size: 9pt; color: #888; padding-top: 15px; border-top: 1px solid #eee; }
    .print-btn { display: block; margin: 20px auto; padding: 10px 30px; background: #c3a782; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 11pt; font-family: inherit; }
    .print-btn:hover { background: #b09672; }
    @media print {
      body { background: white; padding: 0; }
      .sheet { border: none; padding: 0; max-width: none; }
      .print-btn { display: none; }
    }
  </style>
</head>
<body>
  <div class="sheet">
    <h1>月 次 試 算 表</h1>
    <p class="subtitle">（管理用・T-MANAGE自動生成）</p>

    <div class="meta">
      <div class="meta-block">
        <p><strong>会社名</strong>${companyName}</p>
        <p><strong>対象期間</strong>${periodLabel}</p>
      </div>
      <div class="meta-block" style="text-align: right">
        <p><strong>作成日</strong>${todayStr}</p>
      </div>
    </div>

    <h2>Ⅰ 損益計算書</h2>

    <h3>◆ 収益の部</h3>
    <table>
      <thead>
        <tr><th>項目</th><th class="r">金額</th><th class="r">補足</th></tr>
      </thead>
      <tbody>
        <tr><td class="l">売上高（サービス売上）</td><td class="r">${fmt(totalSales)}</td><td class="r sub">${reservations.length}件</td></tr>
        ${cardSales > 0 ? `<tr class="sub-row"><td class="l">カード決済</td><td class="r">${fmt(cardSales)}</td><td></td></tr>` : ""}
        ${paypaySales > 0 ? `<tr class="sub-row"><td class="l">PayPay決済</td><td class="r">${fmt(paypaySales)}</td><td></td></tr>` : ""}
        ${cashSales > 0 ? `<tr class="sub-row"><td class="l">現金売上</td><td class="r">${fmt(cashSales)}</td><td></td></tr>` : ""}
        ${otherIncome > 0 ? `<tr><td class="l">その他収入（雑収入等）</td><td class="r">${fmt(otherIncome)}</td><td class="r sub">—</td></tr>` : ""}
        <tr class="total"><td class="l">収益 合計</td><td class="r">${fmt(grossRevenue)}</td><td></td></tr>
      </tbody>
    </table>

    <h3>◆ 費用の部</h3>
    <table>
      <thead>
        <tr><th>勘定科目</th><th class="r">金額</th><th class="r">構成比</th></tr>
      </thead>
      <tbody>
        ${outsourcingRow}
        ${rows || `<tr><td class="l" colspan="3" style="text-align:center; color:#999">経費データがありません</td></tr>`}
        <tr class="total"><td class="l">費用 合計</td><td class="r">${fmt(totalExpenseAll)}</td><td class="r">100%</td></tr>
      </tbody>
    </table>

    <h3>◆ 差引利益</h3>
    <table>
      <tbody>
        <tr class="grand"><td class="l">収益 合計</td><td class="r">${fmt(grossRevenue)}</td><td></td></tr>
        <tr class="grand"><td class="l">費用 合計</td><td class="r">△ ${fmt(totalExpenseAll)}</td><td></td></tr>
        <tr class="profit grand"><td class="l">${netProfit >= 0 ? "当期純利益" : "当期純損失"}</td><td class="r">${netProfit < 0 ? "△ " : ""}${fmt(Math.abs(netProfit))}</td><td></td></tr>
      </tbody>
    </table>

    <div class="note">
      <strong>💡 本書類について</strong><br>
      本書類は T-MANAGE により自動生成された<strong>管理用の月次サマリー</strong>です。<br>
      ・科目の分類はサロン側の登録内容に基づいており、会計基準上の正式な科目と異なる場合があります。<br>
      ・貸借対照表（BS）は税理士先生が仕訳確定後に作成します。<br>
      ・<strong>正式な月次試算表</strong>は、本資料・銀行明細・領収書等を元に顧問税理士が作成します。<br>
      ・税務署提出や融資申請に使用する資料としては、税理士作成版をご利用ください。
    </div>

    <div class="footer">
      合同会社テラスライフ T-MANAGE / Generated on ${todayStr}
    </div>

    <button class="print-btn" onclick="window.print()">🖨 印刷 / PDFで保存</button>
  </div>
</body>
</html>`;

    const w = window.open("", "_blank");
    if (!w) { alert("ポップアップがブロックされました。ブラウザ設定を確認してください。"); return; }
    w.document.write(html);
    w.document.close();
  };

  // 経費明細CSV出力
  const exportExpenseCSV = () => {
    const items = expenses.filter(e => e.type !== "income");
    const rows: (string | number)[][] = [];
    if (accFormat === "general") {
      rows.push(["日付", "勘定科目", "項目", "店舗", "金額", "備考"]);
      items.forEach(e => rows.push([e.date, ACCOUNT_MAP[e.category] || "雑費", e.name || "", getStoreName(e.store_id) || "", e.amount, e.notes || ""]));
      rows.push(["合計", "", "", "", totalExpenseOnly, ""]);
    } else if (accFormat === "yayoi") {
      rows.push(["取引日付", "借方勘定科目", "借方金額", "貸方勘定科目", "貸方金額", "摘要"]);
      items.forEach(e => rows.push([e.date, ACCOUNT_MAP[e.category] || "雑費", e.amount, "現金", e.amount, `${e.name || ""} ${e.notes || ""}`.trim()]));
    } else if (accFormat === "freee") {
      rows.push(["発生日", "勘定科目", "税区分", "金額", "取引先", "備考"]);
      items.forEach(e => rows.push([e.date, ACCOUNT_MAP[e.category] || "雑費", "課対仕入10%", e.amount, getStoreName(e.store_id) || "", `${e.name || ""} ${e.notes || ""}`.trim()]));
    } else if (accFormat === "mf") {
      rows.push(["取引日", "借方勘定科目", "借方金額(円)", "貸方勘定科目", "貸方金額(円)", "摘要"]);
      items.forEach(e => rows.push([e.date, ACCOUNT_MAP[e.category] || "雑費", e.amount, "現金", e.amount, `${e.name || ""} ${e.notes || ""}`.trim()]));
    }
    downloadCSV(rows, `経費_${periodLabel}_${accFormat}.csv`);
  };

  // セラピスト支払CSV出力
  const exportTherapistCSV = () => {
    const rows: (string | number)[][] = [];
    if (accFormat === "general") {
      rows.push(["氏名", "源泉対象", "インボイス", "登録番号", "出勤日数", "報酬総額", "インボイス控除", "源泉徴収", "実支給額"]);
      therapistPayroll.forEach(p => rows.push([p.realName, p.hasWithholding ? "対象" : "対象外", p.hasInvoice ? "登録済" : "未登録", p.invoiceNum, p.days, p.gross, p.invoiceDed, p.tax, p.final]));
      rows.push(["合計", "", "", "", "", totalTherapistGross, totalInvoiceDed, totalWithholding, therapistPayroll.reduce((s, p) => s + p.final, 0)]);
    } else if (accFormat === "yayoi" || accFormat === "mf") {
      const dateCol = accFormat === "yayoi" ? "取引日付" : "取引日";
      const debitAmtCol = accFormat === "yayoi" ? "借方金額" : "借方金額(円)";
      const creditAmtCol = accFormat === "yayoi" ? "貸方金額" : "貸方金額(円)";
      rows.push([dateCol, "借方勘定科目", debitAmtCol, "貸方勘定科目", creditAmtCol, "摘要"]);
      const lastDay = viewMode === "monthly" ? `${selectedMonth}-${new Date(smYear, smMonth, 0).getDate()}` : `${selectedYear}-12-31`;
      therapistPayroll.forEach(p => {
        // 外注費 / 現金 + 源泉預り金
        rows.push([lastDay, "外注費", p.gross, "現金", p.final, `${p.realName} 報酬`]);
        if (p.tax > 0) rows.push([lastDay, "", "", "預り金", p.tax, `${p.realName} 源泉徴収`]);
      });
    } else if (accFormat === "freee") {
      rows.push(["発生日", "勘定科目", "税区分", "金額", "取引先", "備考"]);
      const lastDay = viewMode === "monthly" ? `${selectedMonth}-${new Date(smYear, smMonth, 0).getDate()}` : `${selectedYear}-12-31`;
      therapistPayroll.forEach(p => {
        rows.push([lastDay, "外注費", p.hasInvoice ? "課対仕入10%" : "対象外", p.gross, p.realName, `${p.days}日出勤`]);
      });
    }
    downloadCSV(rows, `セラピスト支払_${periodLabel}_${accFormat}.csv`);
  };

  // 勘定科目集計CSV出力（月次サマリー用）
  const exportSummaryCSV = () => {
    const rows: (string | number)[][] = [];
    rows.push(["勘定科目", "種別", "金額", "構成比(%)"]);
    accountSummary.forEach(a => rows.push([a.account, a.category === "therapist_back" ? "外注（セラピスト）" : a.category, a.amount, totalExpenseAll > 0 ? Math.round(a.amount / totalExpenseAll * 100) : 0]));
    rows.push(["経費合計", "", totalExpenseAll, 100]);
    rows.push([]);
    rows.push(["総売上", "", grossRevenue, ""]);
    rows.push(["経費合計", "", totalExpenseAll, ""]);
    rows.push(["差引利益", "", netProfit, ""]);
    downloadCSV(rows, `月次サマリー_${periodLabel}.csv`);
  };

  const getCourse = (name: string) => courses.find((c) => c.name === name);
  const getPrice = (r: Reservation) => getCourse(r.course)?.price || 0;
  const getBack = (r: Reservation) => getCourse(r.course)?.therapist_back || 0;
  const getStoreName = (id: number) => stores.find(s => s.id === id)?.name || "";

  // 集計
  const totalSales = reservations.reduce((s, r) => s + getPrice(r), 0);
  const totalBack = reservations.reduce((s, r) => s + getBack(r), 0);
  const totalExpenseOnly = expenses.filter((e) => e.type !== "income").reduce((s, e) => s + e.amount, 0);
  const totalIncomeExtra = expenses.filter((e) => e.type === "income").reduce((s, e) => s + e.amount, 0);
  const totalExpenseAll = totalExpenseOnly + totalBack;
  const grossRevenue = totalSales + totalIncomeExtra;
  const netProfit = grossRevenue - totalExpenseAll;

  // 勘定科目別集計
  const accountSummary = (() => {
    const map = new Map<string, number>();
    if (totalBack > 0) map.set("therapist_back", totalBack);
    for (const e of expenses) {
      if (e.type === "income") continue;
      const cat = e.category || "other";
      map.set(cat, (map.get(cat) || 0) + e.amount);
    }
    return Array.from(map.entries()).map(([cat, amount]) => ({
      category: cat, account: ACCOUNT_MAP[cat] || "雑費", amount,
    })).sort((a, b) => b.amount - a.amount);
  })();

  // セラピスト支払・源泉徴収集計（期間内）
  const therapistPayroll = (() => {
    const map: Record<number, { name: string; realName: string; hasWithholding: boolean; hasInvoice: boolean; invoiceNum: string; gross: number; invoiceDed: number; tax: number; welfare: number; transport: number; final: number; days: number }> = {};
    settlements.forEach(s => {
      const th = therapists.find(t => t.id === s.therapist_id);
      if (!map[s.therapist_id]) {
        map[s.therapist_id] = {
          name: th?.name || "不明",
          realName: th?.real_name || th?.name || "不明",
          hasWithholding: !!th?.has_withholding,
          hasInvoice: !!th?.has_invoice,
          invoiceNum: th?.therapist_invoice_number || "",
          gross: 0, invoiceDed: 0, tax: 0, welfare: 0, transport: 0, final: 0, days: 0,
        };
      }
      const backAmt = (s.total_back || 0) + (s.adjustment || 0);
      const transportFee = s.transport_fee || th?.transport_fee || 0;
      let dayWT = s.withholding_tax || 0;
      // 源泉徴収税額の自動計算（204条1項6号: (報酬 - インボイス控除 - 5000) * 10.21%）
      if (dayWT === 0 && th?.has_withholding) {
        dayWT = Math.floor(Math.max(backAmt - (s.invoice_deduction || 0) - 5000, 0) * 0.1021);
      }
      map[s.therapist_id].gross += backAmt;
      map[s.therapist_id].invoiceDed += (s.invoice_deduction || 0);
      map[s.therapist_id].tax += dayWT;
      map[s.therapist_id].welfare += (s.welfare_fee || 0);
      map[s.therapist_id].transport += transportFee;
      map[s.therapist_id].final += (s.final_payment || 0);
      map[s.therapist_id].days += 1;
    });
    return Object.entries(map).map(([id, d]) => ({ id: Number(id), ...d })).sort((a, b) => b.gross - a.gross);
  })();

  const totalTherapistGross = therapistPayroll.reduce((s, p) => s + p.gross, 0);
  const totalWithholding = therapistPayroll.reduce((s, p) => s + p.tax, 0);
  const totalInvoiceDed = therapistPayroll.reduce((s, p) => s + p.invoiceDed, 0);

  if (!activeStaff || !canAccessTaxPortal) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: T.bg, color: T.text }}>
        <p className="text-[13px]" style={{ color: T.textMuted }}>認証中...</p>
      </div>
    );
  }

  const inputStyle = { backgroundColor: T.cardAlt, color: T.text, border: `1px solid ${T.border}` };
  const gridBorder = `1px solid ${T.border}`;

  return (
    <div className="h-screen flex flex-col" style={{ backgroundColor: T.bg, color: T.text }}>
      {/* ── Header ── */}
      <div className="h-[64px] backdrop-blur-xl border-b flex items-center justify-between px-6 flex-shrink-0" style={{ backgroundColor: dark ? T.card + "cc" : "rgba(255,255,255,0.8)", borderColor: T.border }}>
        <div className="flex items-center gap-4">
          <NavMenu T={T} dark={dark} />
          <button onClick={() => router.push("/dashboard")} className="p-2 rounded-lg cursor-pointer" style={{ color: T.textSub }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <div>
            <h1 className="text-[15px] font-medium">📒 税理士ポータル</h1>
            <p className="text-[11px]" style={{ color: T.textMuted }}>{companyName} · 税務専用画面</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] px-2 py-1 rounded" style={{ backgroundColor: "#c3a78218", color: "#c3a782" }}>{activeStaff.name} ({activeStaff.company_position})</span>
          <button onClick={toggle} className="px-3 py-1.5 text-[10px] rounded-lg cursor-pointer border" style={{ borderColor: T.border, color: T.textSub }}>{dark ? "☀️ ライト" : "🌙 ダーク"}</button>
        </div>
      </div>

      {/* ── Top Bar: 会社情報・期間 ── */}
      <div className="flex items-center gap-3 px-6 py-2.5 border-b flex-wrap" style={{ borderColor: T.border, backgroundColor: T.card }}>
        <span className="text-[11px]" style={{ color: T.textSub }}>会社</span>
        <div className="px-3 py-1.5 rounded-lg text-[12px]" style={{ backgroundColor: T.cardAlt, color: T.text, border: `1px solid ${T.border}` }}>
          {companyName}（{fiscalMonth}月決算）
        </div>
        <span className="text-[11px] ml-3" style={{ color: T.textSub }}>表示</span>
        <div className="flex gap-1">
          <button onClick={() => setViewMode("monthly")} className="px-3 py-1.5 text-[11px] rounded-lg cursor-pointer" style={{ backgroundColor: viewMode === "monthly" ? "#c3a782" : T.cardAlt, color: viewMode === "monthly" ? "white" : T.textSub, border: `1px solid ${viewMode === "monthly" ? "#c3a782" : T.border}` }}>月次</button>
          <button onClick={() => setViewMode("yearly")} className="px-3 py-1.5 text-[11px] rounded-lg cursor-pointer" style={{ backgroundColor: viewMode === "yearly" ? "#c3a782" : T.cardAlt, color: viewMode === "yearly" ? "white" : T.textSub, border: `1px solid ${viewMode === "yearly" ? "#c3a782" : T.border}` }}>年次</button>
        </div>
        {viewMode === "monthly" ? (
          <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="px-3 py-1.5 rounded-lg text-[12px] outline-none" style={inputStyle} />
        ) : (
          <select value={selectedYear} onChange={(e) => setSelectedYear(parseInt(e.target.value))} className="px-3 py-1.5 rounded-lg text-[12px] outline-none cursor-pointer" style={inputStyle}>
            {[0,1,2].map(i => { const y = new Date().getFullYear() - i; return <option key={y} value={y}>{y}年</option>; })}
          </select>
        )}
        <div className="flex-1"></div>
        <span className="text-[11px]" style={{ color: T.textSub }}>CSV形式:</span>
        <select value={accFormat} onChange={(e) => setAccFormat(e.target.value as AccFormat)} className="px-3 py-1.5 rounded-lg text-[11px] outline-none cursor-pointer" style={inputStyle}>
          {(Object.keys(ACC_FORMAT_LABELS) as AccFormat[]).map(f => <option key={f} value={f}>{ACC_FORMAT_LABELS[f]}</option>)}
        </select>
        <span className="text-[10px]" style={{ color: T.textFaint }}>今期: 第{getCurrentFiscalYear() - 2023}期</span>
      </div>

      {/* ── Body: Sheet Content ── */}
      <div className="flex-1 overflow-y-auto" style={{ backgroundColor: T.bg }}>
        <div className="p-6">

          {/* ── Sheet: 月次サマリー ── */}
          {sheet === "summary" && (
            <div className="space-y-4 animate-[fadeIn_0.3s]">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { l: "総売上", v: fmt(grossRevenue), sub: `予約 ${fmt(totalSales)}${totalIncomeExtra > 0 ? ` + 入金 ${fmt(totalIncomeExtra)}` : ""}`, c: "#22c55e" },
                  { l: "経費合計", v: fmt(totalExpenseAll), sub: `うち外注費 ${fmt(totalBack)}`, c: "#c45555" },
                  { l: "業務委託費", v: fmt(totalBack), sub: `${reservations.length}件のバック`, c: "#e091a8" },
                  { l: "差引利益", v: fmt(netProfit), sub: netProfit >= 0 ? "黒字" : "赤字", c: netProfit >= 0 ? "#22c55e" : "#c45555" },
                ].map(s => (
                  <div key={s.l} className="rounded-xl p-4" style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}>
                    <p className="text-[10px] mb-1" style={{ color: T.textMuted }}>{s.l}</p>
                    <p className="text-[18px] font-medium" style={{ color: s.c }}>{s.v}</p>
                    <p className="text-[9px] mt-0.5" style={{ color: T.textFaint }}>{s.sub}</p>
                  </div>
                ))}
              </div>

              <div className="rounded-xl overflow-hidden" style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}>
                <div className="px-4 py-2.5 flex items-center justify-between flex-wrap gap-2" style={{ backgroundColor: T.cardAlt, borderBottom: gridBorder }}>
                  <span className="text-[12px] font-medium">📊 勘定科目別集計（{viewMode === "monthly" ? selectedMonth : `${selectedYear}年`}）</span>
                  <div className="flex items-center gap-2">
                    <button onClick={openMonthlyTrialBalance} className="text-[10px] px-2.5 py-1 rounded cursor-pointer" style={{ backgroundColor: "#c3a78218", color: "#c3a782", border: "none" }}>📄 月次試算表（管理用）を出力</button>
                    <button onClick={exportSummaryCSV} className="text-[10px] px-2.5 py-1 rounded cursor-pointer" style={{ backgroundColor: "#22c55e18", color: "#22c55e", border: "none" }}>💾 CSV出力</button>
                    <span className="text-[10px]" style={{ color: T.textFaint }}>{accountSummary.length}科目</span>
                  </div>
                </div>
                <table className="w-full" style={{ fontSize: 12 }}>
                  <thead>
                    <tr style={{ backgroundColor: T.cardAlt, color: T.textSub, fontSize: 11 }}>
                      <th style={{ padding: "6px 10px", textAlign: "center", width: 40, borderRight: gridBorder }}></th>
                      <th style={{ padding: "6px 10px", textAlign: "left", borderRight: gridBorder }}>勘定科目</th>
                      <th style={{ padding: "6px 10px", textAlign: "left", borderRight: gridBorder }}>種別</th>
                      <th style={{ padding: "6px 10px", textAlign: "right", borderRight: gridBorder }}>金額</th>
                      <th style={{ padding: "6px 10px", textAlign: "right" }}>構成比</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accountSummary.length === 0 && (
                      <tr><td colSpan={5} style={{ padding: "24px", textAlign: "center", color: T.textFaint, fontSize: 11 }}>データがありません</td></tr>
                    )}
                    {accountSummary.map((a, i) => (
                      <tr key={a.category} style={{ borderTop: gridBorder, backgroundColor: i % 2 === 0 ? "transparent" : T.cardAlt + "40" }}>
                        <td style={{ padding: "6px 10px", textAlign: "center", color: T.textFaint, fontSize: 10, borderRight: gridBorder }}>{i + 1}</td>
                        <td style={{ padding: "6px 10px", borderRight: gridBorder }}>{a.account}</td>
                        <td style={{ padding: "6px 10px", borderRight: gridBorder, color: T.textMuted, fontSize: 11 }}>{a.category === "therapist_back" ? "外注（セラピスト）" : a.category}</td>
                        <td style={{ padding: "6px 10px", textAlign: "right", fontVariantNumeric: "tabular-nums", borderRight: gridBorder }}>{fmt(a.amount)}</td>
                        <td style={{ padding: "6px 10px", textAlign: "right", fontVariantNumeric: "tabular-nums", color: T.textSub }}>{totalExpenseAll > 0 ? Math.round(a.amount / totalExpenseAll * 100) : 0}%</td>
                      </tr>
                    ))}
                    {accountSummary.length > 0 && (
                      <tr style={{ borderTop: `2px solid ${T.border}`, backgroundColor: "#22c55e10", fontWeight: 500 }}>
                        <td style={{ padding: "8px 10px", textAlign: "center", borderRight: gridBorder }}></td>
                        <td style={{ padding: "8px 10px", borderRight: gridBorder }}>経費合計</td>
                        <td style={{ padding: "8px 10px", borderRight: gridBorder }}></td>
                        <td style={{ padding: "8px 10px", textAlign: "right", fontVariantNumeric: "tabular-nums", borderRight: gridBorder, color: "#22c55e" }}>{fmt(totalExpenseAll)}</td>
                        <td style={{ padding: "8px 10px", textAlign: "right", fontVariantNumeric: "tabular-nums", color: "#22c55e" }}>100%</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="rounded-xl p-4" style={{ backgroundColor: "#c3a78210", border: "1px solid #c3a78233" }}>
                <p className="text-[11px] font-medium mb-1" style={{ color: "#c3a782" }}>💡 このページについて</p>
                <p className="text-[11px] leading-relaxed" style={{ color: T.textSub }}>
                  税理士ポータルは税務関連データの共有画面です。税理士の先生・社長・経営責任者のみアクセス可能です。<br/>
                  月次サマリー・売上・経費・セラピスト支払/源泉徴収・インボイス・年間スケジュール・書類庫 の<strong>7シートすべて実装完了</strong>。<br/>
                  CSV出力は4形式（汎用・弥生・freee・MFクラウド）に対応、会計ソフトが変わっても柔軟に対応できます。
                </p>
              </div>
            </div>
          )}

          {/* ── Sheet: 売上 ── */}
          {sheet === "sales" && (
            <div className="space-y-4 animate-[fadeIn_0.3s]">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div className="rounded-xl p-4" style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}>
                  <p className="text-[10px] mb-1" style={{ color: T.textMuted }}>予約数</p>
                  <p className="text-[18px] font-medium">{reservations.length}件</p>
                </div>
                <div className="rounded-xl p-4" style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}>
                  <p className="text-[10px] mb-1" style={{ color: T.textMuted }}>売上合計</p>
                  <p className="text-[18px] font-medium" style={{ color: "#22c55e" }}>{fmt(totalSales)}</p>
                </div>
                <div className="rounded-xl p-4" style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}>
                  <p className="text-[10px] mb-1" style={{ color: T.textMuted }}>平均単価</p>
                  <p className="text-[18px] font-medium">{fmt(reservations.length > 0 ? Math.round(totalSales / reservations.length) : 0)}</p>
                </div>
              </div>

              <div className="rounded-xl overflow-hidden" style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}>
                <div className="px-4 py-2.5 flex items-center justify-between" style={{ backgroundColor: T.cardAlt, borderBottom: gridBorder }}>
                  <span className="text-[12px] font-medium">💰 売上明細（{viewMode === "monthly" ? selectedMonth : `${selectedYear}年`}）</span>
                  <div className="flex items-center gap-2">
                    <button onClick={exportSalesCSV} className="text-[10px] px-2.5 py-1 rounded cursor-pointer" style={{ backgroundColor: "#22c55e18", color: "#22c55e", border: "none" }}>💾 {ACC_FORMAT_LABELS[accFormat]}でCSV出力</button>
                    <span className="text-[10px]" style={{ color: T.textFaint }}>{reservations.length}件</span>
                  </div>
                </div>
                <div style={{ maxHeight: 500, overflowY: "auto" }}>
                  <table className="w-full" style={{ fontSize: 12 }}>
                    <thead style={{ position: "sticky", top: 0, backgroundColor: T.cardAlt }}>
                      <tr style={{ color: T.textSub, fontSize: 11 }}>
                        <th style={{ padding: "6px 10px", textAlign: "center", width: 40, borderRight: gridBorder, borderBottom: gridBorder }}></th>
                        <th style={{ padding: "6px 10px", textAlign: "left", borderRight: gridBorder, borderBottom: gridBorder }}>日付</th>
                        <th style={{ padding: "6px 10px", textAlign: "left", borderRight: gridBorder, borderBottom: gridBorder }}>時間</th>
                        <th style={{ padding: "6px 10px", textAlign: "left", borderRight: gridBorder, borderBottom: gridBorder }}>顧客名</th>
                        <th style={{ padding: "6px 10px", textAlign: "left", borderRight: gridBorder, borderBottom: gridBorder }}>コース</th>
                        <th style={{ padding: "6px 10px", textAlign: "right", borderRight: gridBorder, borderBottom: gridBorder }}>金額</th>
                        <th style={{ padding: "6px 10px", textAlign: "right", borderBottom: gridBorder }}>バック</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reservations.length === 0 && (
                        <tr><td colSpan={7} style={{ padding: "24px", textAlign: "center", color: T.textFaint, fontSize: 11 }}>予約データがありません</td></tr>
                      )}
                      {reservations.map((r, i) => (
                        <tr key={r.id} style={{ borderTop: gridBorder, backgroundColor: i % 2 === 0 ? "transparent" : T.cardAlt + "40" }}>
                          <td style={{ padding: "5px 10px", textAlign: "center", color: T.textFaint, fontSize: 10, borderRight: gridBorder }}>{i + 1}</td>
                          <td style={{ padding: "5px 10px", borderRight: gridBorder, fontVariantNumeric: "tabular-nums" }}>{r.date}</td>
                          <td style={{ padding: "5px 10px", borderRight: gridBorder, fontVariantNumeric: "tabular-nums", color: T.textSub }}>{r.start_time?.slice(0,5)}〜{r.end_time?.slice(0,5)}</td>
                          <td style={{ padding: "5px 10px", borderRight: gridBorder }}>{r.customer_name || "—"}</td>
                          <td style={{ padding: "5px 10px", borderRight: gridBorder, color: T.textSub, fontSize: 11 }}>{r.course || "—"}</td>
                          <td style={{ padding: "5px 10px", textAlign: "right", borderRight: gridBorder, fontVariantNumeric: "tabular-nums" }}>{fmt(getPrice(r))}</td>
                          <td style={{ padding: "5px 10px", textAlign: "right", fontVariantNumeric: "tabular-nums", color: "#e091a8" }}>{fmt(getBack(r))}</td>
                        </tr>
                      ))}
                      {reservations.length > 0 && (
                        <tr style={{ borderTop: `2px solid ${T.border}`, backgroundColor: "#22c55e10", fontWeight: 500, position: "sticky", bottom: 0 }}>
                          <td style={{ padding: "8px 10px", borderRight: gridBorder }}></td>
                          <td colSpan={4} style={{ padding: "8px 10px", borderRight: gridBorder }}>合計（{reservations.length}件）</td>
                          <td style={{ padding: "8px 10px", textAlign: "right", fontVariantNumeric: "tabular-nums", borderRight: gridBorder, color: "#22c55e" }}>{fmt(totalSales)}</td>
                          <td style={{ padding: "8px 10px", textAlign: "right", fontVariantNumeric: "tabular-nums", color: "#e091a8" }}>{fmt(totalBack)}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── Sheet: 経費 ── */}
          {sheet === "expense" && (() => {
            // 経費フィルタリング（要確認のみ / 領収書なしのみ）
            const allExpenses = expenses.filter(e => e.type !== "income");
            const noReceiptCount = allExpenses.filter(e => !e.receipt_url).length;
            const needsReviewCount = allExpenses.filter(e => e.needs_review).length;
            let displayExpenses = allExpenses;
            if (onlyReviewFilter) displayExpenses = displayExpenses.filter(e => e.needs_review);
            if (onlyNoReceiptFilter) displayExpenses = displayExpenses.filter(e => !e.receipt_url);
            const displayTotal = displayExpenses.filter(e => e.category !== "outsourcing").reduce((s, e) => s + (e.amount || 0), 0);

            return (
            <div className="space-y-4 animate-[fadeIn_0.3s]">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="rounded-xl p-4" style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}>
                  <p className="text-[10px] mb-1" style={{ color: T.textMuted }}>経費件数</p>
                  <p className="text-[18px] font-medium">{allExpenses.length}件</p>
                </div>
                <div className="rounded-xl p-4" style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}>
                  <p className="text-[10px] mb-1" style={{ color: T.textMuted }}>経費合計（外注費除く）</p>
                  <p className="text-[18px] font-medium" style={{ color: "#c45555" }}>{fmt(totalExpenseOnly)}</p>
                </div>
                <div className="rounded-xl p-4" style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}>
                  <p className="text-[10px] mb-1" style={{ color: T.textMuted }}>📎 領収書なし</p>
                  <p className="text-[18px] font-medium" style={{ color: noReceiptCount > 0 ? "#f59e0b" : T.textSub }}>{noReceiptCount}件</p>
                </div>
                <div className="rounded-xl p-4" style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}>
                  <p className="text-[10px] mb-1" style={{ color: T.textMuted }}>🚩 要確認</p>
                  <p className="text-[18px] font-medium" style={{ color: needsReviewCount > 0 ? "#c45555" : T.textSub }}>{needsReviewCount}件</p>
                </div>
              </div>

              <div className="rounded-xl overflow-hidden" style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}>
                <div className="px-4 py-2.5 flex items-center justify-between flex-wrap gap-2" style={{ backgroundColor: T.cardAlt, borderBottom: gridBorder }}>
                  <span className="text-[12px] font-medium">💸 経費明細（{viewMode === "monthly" ? selectedMonth : `${selectedYear}年`}）</span>
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* フィルタ */}
                    <label className="flex items-center gap-1 text-[10px] cursor-pointer" style={{ color: onlyReviewFilter ? "#c45555" : T.textSub }}>
                      <input type="checkbox" checked={onlyReviewFilter} onChange={e => setOnlyReviewFilter(e.target.checked)} style={{ cursor: "pointer" }} />
                      🚩 要確認のみ
                    </label>
                    <label className="flex items-center gap-1 text-[10px] cursor-pointer" style={{ color: onlyNoReceiptFilter ? "#f59e0b" : T.textSub }}>
                      <input type="checkbox" checked={onlyNoReceiptFilter} onChange={e => setOnlyNoReceiptFilter(e.target.checked)} style={{ cursor: "pointer" }} />
                      📎 領収書なしのみ
                    </label>
                    <button onClick={() => setBulkDLModal(true)} className="text-[10px] px-2.5 py-1 rounded cursor-pointer" style={{ backgroundColor: "#4a7c5918", color: "#4a7c59", border: "none" }}>📦 領収書ZIP一括DL</button>
                    <button onClick={exportExpenseCSV} className="text-[10px] px-2.5 py-1 rounded cursor-pointer" style={{ backgroundColor: "#22c55e18", color: "#22c55e", border: "none" }}>💾 {ACC_FORMAT_LABELS[accFormat]}でCSV出力</button>
                    <span className="text-[10px]" style={{ color: T.textFaint }}>表示 {displayExpenses.length}/{allExpenses.length}件</span>
                  </div>
                </div>
                <div style={{ maxHeight: 500, overflowY: "auto" }}>
                  <table className="w-full" style={{ fontSize: 12 }}>
                    <thead style={{ position: "sticky", top: 0, backgroundColor: T.cardAlt }}>
                      <tr style={{ color: T.textSub, fontSize: 11 }}>
                        <th style={{ padding: "6px 6px", textAlign: "center", width: 32, borderRight: gridBorder, borderBottom: gridBorder }}></th>
                        <th style={{ padding: "6px 6px", textAlign: "center", width: 34, borderRight: gridBorder, borderBottom: gridBorder }} title="領収書">📎</th>
                        <th style={{ padding: "6px 6px", textAlign: "center", width: 34, borderRight: gridBorder, borderBottom: gridBorder }} title="要確認">🚩</th>
                        <th style={{ padding: "6px 10px", textAlign: "left", borderRight: gridBorder, borderBottom: gridBorder }}>日付</th>
                        <th style={{ padding: "6px 10px", textAlign: "left", borderRight: gridBorder, borderBottom: gridBorder }}>勘定科目</th>
                        <th style={{ padding: "6px 10px", textAlign: "left", borderRight: gridBorder, borderBottom: gridBorder }}>項目</th>
                        <th style={{ padding: "6px 10px", textAlign: "left", borderRight: gridBorder, borderBottom: gridBorder }}>店舗</th>
                        <th style={{ padding: "6px 10px", textAlign: "left", borderRight: gridBorder, borderBottom: gridBorder }}>備考</th>
                        <th style={{ padding: "6px 10px", textAlign: "right", borderBottom: gridBorder }}>金額</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayExpenses.length === 0 && (
                        <tr><td colSpan={9} style={{ padding: "24px", textAlign: "center", color: T.textFaint, fontSize: 11 }}>
                          {allExpenses.length === 0 ? "経費データがありません" : "フィルタ条件に該当する経費がありません"}
                        </td></tr>
                      )}
                      {displayExpenses.map((e, i) => {
                        const hasReceipt = !!e.receipt_url;
                        const isFlagged = !!e.needs_review;
                        // 行の背景色（要確認 > 領収書なし > 通常）
                        const rowBg = isFlagged
                          ? "#c4555512"
                          : !hasReceipt
                          ? "#f59e0b0f"
                          : i % 2 === 0 ? "transparent" : T.cardAlt + "40";
                        return (
                        <tr key={e.id} style={{ borderTop: gridBorder, backgroundColor: rowBg }}>
                          <td style={{ padding: "5px 6px", textAlign: "center", color: T.textFaint, fontSize: 10, borderRight: gridBorder }}>{i + 1}</td>
                          {/* 領収書アイコン */}
                          <td style={{ padding: "2px 6px", textAlign: "center", borderRight: gridBorder }}>
                            {hasReceipt ? (
                              <button
                                onClick={() => setReceiptModal(e)}
                                title="領収書を表示"
                                style={{ background: "transparent", border: "none", cursor: "pointer", padding: "2px 4px", borderRadius: 4, fontSize: 14 }}
                              >📎</button>
                            ) : (
                              <span title="領収書なし" style={{ fontSize: 12, color: "#f59e0b" }}>⚠️</span>
                            )}
                          </td>
                          {/* 要確認アイコン */}
                          <td style={{ padding: "2px 6px", textAlign: "center", borderRight: gridBorder }}>
                            <button
                              onClick={() => {
                                setReviewModal(e);
                                setReviewNoteInput(e.review_note || "");
                              }}
                              title={isFlagged ? `要確認: ${e.review_note || "（理由なし）"}\n${e.flagged_by_name || ""}` : "要確認マークを付ける"}
                              style={{ background: "transparent", border: "none", cursor: "pointer", padding: "2px 4px", borderRadius: 4, fontSize: 14, opacity: isFlagged ? 1 : 0.25 }}
                            >🚩</button>
                          </td>
                          <td style={{ padding: "5px 10px", borderRight: gridBorder, fontVariantNumeric: "tabular-nums" }}>{e.date}</td>
                          <td style={{ padding: "5px 10px", borderRight: gridBorder, color: T.textSub, fontSize: 11 }}>{ACCOUNT_MAP[e.category] || "雑費"}</td>
                          <td style={{ padding: "5px 10px", borderRight: gridBorder }}>{e.name || "—"}</td>
                          <td style={{ padding: "5px 10px", borderRight: gridBorder, color: T.textMuted, fontSize: 11 }}>{getStoreName(e.store_id) || "—"}</td>
                          <td style={{ padding: "5px 10px", borderRight: gridBorder, color: T.textMuted, fontSize: 10 }}>
                            {e.notes || ""}
                            {isFlagged && e.review_note && (
                              <span style={{ display: "block", color: "#c45555", fontSize: 9, marginTop: 2 }}>🚩 {e.review_note}</span>
                            )}
                          </td>
                          <td style={{ padding: "5px 10px", textAlign: "right", fontVariantNumeric: "tabular-nums", color: "#c45555" }}>{fmt(e.amount)}</td>
                        </tr>
                        );
                      })}
                      {displayExpenses.length > 0 && (
                        <tr style={{ borderTop: `2px solid ${T.border}`, backgroundColor: "#c4555510", fontWeight: 500 }}>
                          <td colSpan={3} style={{ padding: "8px 10px", borderRight: gridBorder }}></td>
                          <td colSpan={5} style={{ padding: "8px 10px", borderRight: gridBorder }}>
                            {(onlyReviewFilter || onlyNoReceiptFilter) ? "表示中の合計（外注費除く）" : "経費合計（外注費除く）"}
                          </td>
                          <td style={{ padding: "8px 10px", textAlign: "right", fontVariantNumeric: "tabular-nums", color: "#c45555" }}>
                            {fmt((onlyReviewFilter || onlyNoReceiptFilter) ? displayTotal : totalExpenseOnly)}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            );
          })()}

          {/* ── Sheet: セラピスト支払・源泉徴収 ── */}
          {sheet === "therapist" && (
            <div className="space-y-4 animate-[fadeIn_0.3s]">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="rounded-xl p-4" style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}>
                  <p className="text-[10px] mb-1" style={{ color: T.textMuted }}>対象セラピスト</p>
                  <p className="text-[18px] font-medium">{therapistPayroll.length}名</p>
                </div>
                <div className="rounded-xl p-4" style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}>
                  <p className="text-[10px] mb-1" style={{ color: T.textMuted }}>報酬総額（支払総額）</p>
                  <p className="text-[18px] font-medium" style={{ color: "#e091a8" }}>{fmt(totalTherapistGross)}</p>
                </div>
                <div className="rounded-xl p-4" style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}>
                  <p className="text-[10px] mb-1" style={{ color: T.textMuted }}>源泉徴収税額</p>
                  <p className="text-[18px] font-medium" style={{ color: "#f59e0b" }}>{fmt(totalWithholding)}</p>
                </div>
                <div className="rounded-xl p-4" style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}>
                  <p className="text-[10px] mb-1" style={{ color: T.textMuted }}>インボイス控除額</p>
                  <p className="text-[18px] font-medium" style={{ color: "#85a8c4" }}>{fmt(totalInvoiceDed)}</p>
                </div>
              </div>

              <div className="rounded-xl overflow-hidden" style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}>
                <div className="px-4 py-2.5 flex items-center justify-between flex-wrap gap-2" style={{ backgroundColor: T.cardAlt, borderBottom: gridBorder }}>
                  <div>
                    <span className="text-[12px] font-medium">👥 セラピスト支払・源泉徴収集計（{viewMode === "monthly" ? selectedMonth : `${selectedYear}年`}）</span>
                    <p className="text-[9px] mt-0.5" style={{ color: T.textFaint }}>根拠: 所得税法204条1項6号 / 月額5,000円控除 / 税率10.21%</p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button onClick={openAllShiharai} className="text-[10px] px-2.5 py-1 rounded cursor-pointer" style={{ backgroundColor: "#c3a78218", color: "#c3a782", border: "none" }}>📦 全員の支払調書をまとめて出力</button>
                    <button onClick={exportTherapistCSV} className="text-[10px] px-2.5 py-1 rounded cursor-pointer" style={{ backgroundColor: "#22c55e18", color: "#22c55e", border: "none" }}>💾 {ACC_FORMAT_LABELS[accFormat]}でCSV出力</button>
                    <span className="text-[10px]" style={{ color: T.textFaint }}>{therapistPayroll.length}名</span>
                  </div>
                </div>
                <div style={{ maxHeight: 500, overflowY: "auto" }}>
                  <table className="w-full" style={{ fontSize: 12 }}>
                    <thead style={{ position: "sticky", top: 0, backgroundColor: T.cardAlt }}>
                      <tr style={{ color: T.textSub, fontSize: 11 }}>
                        <th style={{ padding: "6px 10px", textAlign: "center", width: 40, borderRight: gridBorder, borderBottom: gridBorder }}></th>
                        <th style={{ padding: "6px 10px", textAlign: "left", borderRight: gridBorder, borderBottom: gridBorder }}>氏名</th>
                        <th style={{ padding: "6px 10px", textAlign: "center", borderRight: gridBorder, borderBottom: gridBorder }}>源泉</th>
                        <th style={{ padding: "6px 10px", textAlign: "center", borderRight: gridBorder, borderBottom: gridBorder }}>インボイス</th>
                        <th style={{ padding: "6px 10px", textAlign: "right", borderRight: gridBorder, borderBottom: gridBorder }}>出勤日数</th>
                        <th style={{ padding: "6px 10px", textAlign: "right", borderRight: gridBorder, borderBottom: gridBorder }}>報酬総額</th>
                        <th style={{ padding: "6px 10px", textAlign: "right", borderRight: gridBorder, borderBottom: gridBorder }}>インボイス控除</th>
                        <th style={{ padding: "6px 10px", textAlign: "right", borderRight: gridBorder, borderBottom: gridBorder }}>源泉徴収</th>
                        <th style={{ padding: "6px 10px", textAlign: "right", borderRight: gridBorder, borderBottom: gridBorder }}>実支給額</th>
                        <th style={{ padding: "6px 6px", textAlign: "center", width: 70, borderBottom: gridBorder }}>支払調書</th>
                      </tr>
                    </thead>
                    <tbody>
                      {therapistPayroll.length === 0 && (
                        <tr><td colSpan={10} style={{ padding: "24px", textAlign: "center", color: T.textFaint, fontSize: 11 }}>対象期間の清算データがありません</td></tr>
                      )}
                      {therapistPayroll.map((p, i) => (
                        <tr key={p.id} style={{ borderTop: gridBorder, backgroundColor: i % 2 === 0 ? "transparent" : T.cardAlt + "40" }}>
                          <td style={{ padding: "5px 10px", textAlign: "center", color: T.textFaint, fontSize: 10, borderRight: gridBorder }}>{i + 1}</td>
                          <td style={{ padding: "5px 10px", borderRight: gridBorder }}>
                            <div>{p.realName}</div>
                            {p.name !== p.realName && <div className="text-[9px]" style={{ color: T.textFaint }}>(源氏名: {p.name})</div>}
                          </td>
                          <td style={{ padding: "5px 10px", textAlign: "center", borderRight: gridBorder }}>
                            {p.hasWithholding ? <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "#f59e0b18", color: "#f59e0b" }}>対象</span> : <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ backgroundColor: T.cardAlt, color: T.textFaint }}>対象外</span>}
                          </td>
                          <td style={{ padding: "5px 10px", textAlign: "center", borderRight: gridBorder }}>
                            {p.hasInvoice ? <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "#22c55e18", color: "#22c55e" }} title={p.invoiceNum}>登録済</span> : <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "#c4555518", color: "#c45555" }}>未登録</span>}
                          </td>
                          <td style={{ padding: "5px 10px", textAlign: "right", fontVariantNumeric: "tabular-nums", borderRight: gridBorder, color: T.textSub }}>{p.days}日</td>
                          <td style={{ padding: "5px 10px", textAlign: "right", fontVariantNumeric: "tabular-nums", borderRight: gridBorder }}>{fmt(p.gross)}</td>
                          <td style={{ padding: "5px 10px", textAlign: "right", fontVariantNumeric: "tabular-nums", borderRight: gridBorder, color: "#85a8c4" }}>{fmt(p.invoiceDed)}</td>
                          <td style={{ padding: "5px 10px", textAlign: "right", fontVariantNumeric: "tabular-nums", borderRight: gridBorder, color: "#f59e0b" }}>{fmt(p.tax)}</td>
                          <td style={{ padding: "5px 10px", textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 500, borderRight: gridBorder }}>{fmt(p.final)}</td>
                          <td style={{ padding: "2px 6px", textAlign: "center" }}>
                            <button
                              onClick={() => openSingleShiharai(p)}
                              title={`${p.realName} の支払調書を出力${p.gross > 50000 ? "\n（税務署提出対象）" : "\n（本人交付のみ）"}`}
                              className="text-[10px] px-2 py-1 rounded cursor-pointer"
                              style={{ backgroundColor: p.gross > 50000 ? "#c3a782" : T.cardAlt, color: p.gross > 50000 ? "#fff" : T.textSub, border: `1px solid ${p.gross > 50000 ? "#c3a782" : T.border}` }}
                            >📄</button>
                          </td>
                        </tr>
                      ))}
                      {therapistPayroll.length > 0 && (
                        <tr style={{ borderTop: `2px solid ${T.border}`, backgroundColor: "#e091a810", fontWeight: 500 }}>
                          <td style={{ padding: "8px 10px", borderRight: gridBorder }}></td>
                          <td colSpan={4} style={{ padding: "8px 10px", borderRight: gridBorder }}>合計（{therapistPayroll.length}名）</td>
                          <td style={{ padding: "8px 10px", textAlign: "right", fontVariantNumeric: "tabular-nums", borderRight: gridBorder, color: "#e091a8" }}>{fmt(totalTherapistGross)}</td>
                          <td style={{ padding: "8px 10px", textAlign: "right", fontVariantNumeric: "tabular-nums", borderRight: gridBorder, color: "#85a8c4" }}>{fmt(totalInvoiceDed)}</td>
                          <td style={{ padding: "8px 10px", textAlign: "right", fontVariantNumeric: "tabular-nums", borderRight: gridBorder, color: "#f59e0b" }}>{fmt(totalWithholding)}</td>
                          <td style={{ padding: "8px 10px", textAlign: "right", fontVariantNumeric: "tabular-nums", borderRight: gridBorder }}>{fmt(therapistPayroll.reduce((s, p) => s + p.final, 0))}</td>
                          <td style={{ padding: "8px 6px" }}></td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── Sheet: インボイス ── */}
          {sheet === "invoice" && (
            <div className="space-y-4 animate-[fadeIn_0.3s]">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="rounded-xl p-4" style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}>
                  <p className="text-[10px] mb-1" style={{ color: T.textMuted }}>登録済セラピスト</p>
                  <p className="text-[18px] font-medium" style={{ color: "#22c55e" }}>{therapistPayroll.filter(p => p.hasInvoice).length}名</p>
                </div>
                <div className="rounded-xl p-4" style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}>
                  <p className="text-[10px] mb-1" style={{ color: T.textMuted }}>未登録セラピスト</p>
                  <p className="text-[18px] font-medium" style={{ color: "#c45555" }}>{therapistPayroll.filter(p => !p.hasInvoice).length}名</p>
                </div>
                <div className="rounded-xl p-4" style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}>
                  <p className="text-[10px] mb-1" style={{ color: T.textMuted }}>登録済への支払</p>
                  <p className="text-[18px] font-medium" style={{ color: "#22c55e" }}>{fmt(therapistPayroll.filter(p => p.hasInvoice).reduce((s, p) => s + p.gross, 0))}</p>
                </div>
                <div className="rounded-xl p-4" style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}>
                  <p className="text-[10px] mb-1" style={{ color: T.textMuted }}>未登録への支払（2割特例対象）</p>
                  <p className="text-[18px] font-medium" style={{ color: "#f59e0b" }}>{fmt(therapistPayroll.filter(p => !p.hasInvoice).reduce((s, p) => s + p.gross, 0))}</p>
                </div>
              </div>

              <div className="rounded-xl overflow-hidden" style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}>
                <div className="px-4 py-2.5 flex items-center justify-between" style={{ backgroundColor: T.cardAlt, borderBottom: gridBorder }}>
                  <div>
                    <span className="text-[12px] font-medium">🧾 インボイス登録状況・2割特例控除（{viewMode === "monthly" ? selectedMonth : `${selectedYear}年`}）</span>
                    <p className="text-[9px] mt-0.5" style={{ color: T.textFaint }}>インボイス未登録のセラピストへの支払は、買手側で仕入税額控除が制限されます（経過措置: 2026年9月まで80%控除可）</p>
                  </div>
                  <span className="text-[10px]" style={{ color: T.textFaint }}>{therapistPayroll.length}名</span>
                </div>
                <div style={{ maxHeight: 500, overflowY: "auto" }}>
                  <table className="w-full" style={{ fontSize: 12 }}>
                    <thead style={{ position: "sticky", top: 0, backgroundColor: T.cardAlt }}>
                      <tr style={{ color: T.textSub, fontSize: 11 }}>
                        <th style={{ padding: "6px 10px", textAlign: "center", width: 40, borderRight: gridBorder, borderBottom: gridBorder }}></th>
                        <th style={{ padding: "6px 10px", textAlign: "left", borderRight: gridBorder, borderBottom: gridBorder }}>氏名</th>
                        <th style={{ padding: "6px 10px", textAlign: "center", borderRight: gridBorder, borderBottom: gridBorder }}>ステータス</th>
                        <th style={{ padding: "6px 10px", textAlign: "left", borderRight: gridBorder, borderBottom: gridBorder }}>登録番号</th>
                        <th style={{ padding: "6px 10px", textAlign: "right", borderRight: gridBorder, borderBottom: gridBorder }}>支払総額</th>
                        <th style={{ padding: "6px 10px", textAlign: "right", borderRight: gridBorder, borderBottom: gridBorder }}>内消費税(10/110)</th>
                        <th style={{ padding: "6px 10px", textAlign: "right", borderBottom: gridBorder }}>仕入控除可能額</th>
                      </tr>
                    </thead>
                    <tbody>
                      {therapistPayroll.length === 0 && (
                        <tr><td colSpan={7} style={{ padding: "24px", textAlign: "center", color: T.textFaint, fontSize: 11 }}>対象期間のデータがありません</td></tr>
                      )}
                      {therapistPayroll.map((p, i) => {
                        const includedTax = Math.floor(p.gross * 10 / 110);
                        const deductible = p.hasInvoice ? includedTax : Math.floor(includedTax * 0.8); // 経過措置80%
                        return (
                          <tr key={p.id} style={{ borderTop: gridBorder, backgroundColor: i % 2 === 0 ? "transparent" : T.cardAlt + "40" }}>
                            <td style={{ padding: "5px 10px", textAlign: "center", color: T.textFaint, fontSize: 10, borderRight: gridBorder }}>{i + 1}</td>
                            <td style={{ padding: "5px 10px", borderRight: gridBorder }}>{p.realName}</td>
                            <td style={{ padding: "5px 10px", textAlign: "center", borderRight: gridBorder }}>
                              {p.hasInvoice ? <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "#22c55e18", color: "#22c55e" }}>✓ 適格</span> : <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "#c4555518", color: "#c45555" }}>未登録</span>}
                            </td>
                            <td style={{ padding: "5px 10px", borderRight: gridBorder, fontFamily: "monospace", fontSize: 10, color: T.textMuted }}>{p.invoiceNum || "—"}</td>
                            <td style={{ padding: "5px 10px", textAlign: "right", fontVariantNumeric: "tabular-nums", borderRight: gridBorder }}>{fmt(p.gross)}</td>
                            <td style={{ padding: "5px 10px", textAlign: "right", fontVariantNumeric: "tabular-nums", borderRight: gridBorder, color: T.textSub }}>{fmt(includedTax)}</td>
                            <td style={{ padding: "5px 10px", textAlign: "right", fontVariantNumeric: "tabular-nums", color: p.hasInvoice ? "#22c55e" : "#f59e0b" }}>{fmt(deductible)}{!p.hasInvoice && <span className="text-[9px] ml-1" style={{ color: T.textFaint }}>(80%)</span>}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-xl p-4" style={{ backgroundColor: "#f59e0b10", border: "1px solid #f59e0b33" }}>
                <p className="text-[11px] font-medium mb-1" style={{ color: "#f59e0b" }}>💡 インボイス経過措置について</p>
                <p className="text-[11px] leading-relaxed" style={{ color: T.textSub }}>
                  2026年10月1日〜2029年9月30日は、未登録事業者からの仕入について<strong>50%控除</strong>の経過措置期間に入ります。<br/>
                  現在（2026年9月30日まで）は<strong>80%控除</strong>が適用可能です。未登録セラピストには早めの登録を案内することで、会社側の仕入控除を維持できます。
                </p>
              </div>
            </div>
          )}

          {/* ── Sheet: 銀行取込（PayPay銀行） ── */}
          {sheet === "bank" && (
            <div className="space-y-4 animate-[fadeIn_0.3s]">
              {/* サマリーカード */}
              {(() => {
                const unconfirmed = bankTxs.filter(t => !t.is_confirmed).length;
                const confirmed = bankTxs.filter(t => t.is_confirmed).length;
                const totalDebit = bankTxs.reduce((s, t) => s + (t.debit_amount || 0), 0);
                const totalCredit = bankTxs.reduce((s, t) => s + (t.credit_amount || 0), 0);
                return (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="rounded-xl p-4" style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}>
                      <p className="text-[10px] mb-1" style={{ color: T.textMuted }}>登録取引数</p>
                      <p className="text-[18px] font-medium">{bankTxs.length}件</p>
                    </div>
                    <div className="rounded-xl p-4" style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}>
                      <p className="text-[10px] mb-1" style={{ color: T.textMuted }}>未確定</p>
                      <p className="text-[18px] font-medium" style={{ color: "#f59e0b" }}>{unconfirmed}件</p>
                    </div>
                    <div className="rounded-xl p-4" style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}>
                      <p className="text-[10px] mb-1" style={{ color: T.textMuted }}>出金合計</p>
                      <p className="text-[18px] font-medium" style={{ color: "#c45555" }}>{fmt(totalDebit)}</p>
                    </div>
                    <div className="rounded-xl p-4" style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}>
                      <p className="text-[10px] mb-1" style={{ color: T.textMuted }}>入金合計</p>
                      <p className="text-[18px] font-medium" style={{ color: "#22c55e" }}>{fmt(totalCredit)}</p>
                    </div>
                  </div>
                );
              })()}

              {/* CSVアップロード */}
              <div className="rounded-xl p-5" style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}>
                <p className="text-[13px] font-medium mb-2">🏦 PayPay銀行CSV取込</p>
                <p className="text-[10px] mb-3" style={{ color: T.textMuted }}>PayPay銀行の「明細ダウンロード」で出力したCSV（Shift-JIS）をアップロードしてください。学習済みルールで自動仕訳されます。</p>
                <label className="block cursor-pointer">
                  <input type="file" accept=".csv" className="hidden" disabled={bankParsing} onChange={(e) => { const f = e.target.files?.[0]; if (f) { parsePayPayCSV(f); e.target.value = ""; } }} />
                  <div className="rounded-lg py-8 text-center transition-colors" style={{ border: `2px dashed ${T.border}`, backgroundColor: bankParsing ? T.cardAlt : "transparent" }}>
                    {bankParsing ? (
                      <p className="text-[12px]" style={{ color: "#c3a782" }}>📥 読込中...</p>
                    ) : (
                      <>
                        <p className="text-[12px]" style={{ color: T.textSub }}>📎 クリックしてPayPay銀行CSVを選択</p>
                        <p className="text-[10px] mt-1" style={{ color: T.textFaint }}>Shift-JIS形式・12列（操作日/摘要/お支払金額/お預り金額/残高等）</p>
                      </>
                    )}
                  </div>
                </label>
              </div>

              {/* ステージング（取込前プレビュー） */}
              {bankStagedTxs.length > 0 && (
                <div className="rounded-xl overflow-hidden" style={{ backgroundColor: T.card, border: `2px solid #f59e0b` }}>
                  <div className="px-4 py-2.5 flex items-center justify-between" style={{ backgroundColor: "#f59e0b18", borderBottom: gridBorder }}>
                    <div>
                      <span className="text-[12px] font-medium" style={{ color: "#f59e0b" }}>⚠️ 取込確認: {bankStagedTxs.length}件の取引</span>
                      <p className="text-[9px] mt-0.5" style={{ color: T.textSub }}>自動仕訳結果を確認して「取込確定」を押してください。勘定科目はクリックで変更できます。</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setBankStagedTxs([])} className="text-[11px] px-3 py-1.5 rounded cursor-pointer" style={{ backgroundColor: T.cardAlt, color: T.textSub, border: "none" }}>キャンセル</button>
                      <button onClick={confirmStagedTxs} className="text-[11px] px-3 py-1.5 rounded cursor-pointer font-medium" style={{ backgroundColor: "#22c55e", color: "white", border: "none" }}>✓ 取込確定（{bankStagedTxs.length}件）</button>
                    </div>
                  </div>
                  <div style={{ maxHeight: 400, overflowY: "auto" }}>
                    <table className="w-full" style={{ fontSize: 11 }}>
                      <thead style={{ position: "sticky", top: 0, backgroundColor: T.cardAlt }}>
                        <tr style={{ color: T.textSub, fontSize: 10 }}>
                          <th style={{ padding: "5px 8px", textAlign: "left", borderRight: gridBorder, borderBottom: gridBorder, width: 80 }}>日付</th>
                          <th style={{ padding: "5px 8px", textAlign: "left", borderRight: gridBorder, borderBottom: gridBorder }}>摘要</th>
                          <th style={{ padding: "5px 8px", textAlign: "right", borderRight: gridBorder, borderBottom: gridBorder, width: 90 }}>出金</th>
                          <th style={{ padding: "5px 8px", textAlign: "right", borderRight: gridBorder, borderBottom: gridBorder, width: 90 }}>入金</th>
                          <th style={{ padding: "5px 8px", textAlign: "left", borderBottom: gridBorder, width: 160 }}>勘定科目</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bankStagedTxs.map((t, i) => (
                          <tr key={t._tempId} style={{ borderTop: gridBorder, backgroundColor: i % 2 === 0 ? "transparent" : T.cardAlt + "40" }}>
                            <td style={{ padding: "4px 8px", borderRight: gridBorder, fontVariantNumeric: "tabular-nums" }}>{t.transaction_date.slice(5)}</td>
                            <td style={{ padding: "4px 8px", borderRight: gridBorder, fontSize: 10, maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={t.description}>{t.description}</td>
                            <td style={{ padding: "4px 8px", textAlign: "right", borderRight: gridBorder, fontVariantNumeric: "tabular-nums", color: t.debit_amount > 0 ? "#c45555" : T.textFaint }}>{t.debit_amount > 0 ? fmt(t.debit_amount) : "—"}</td>
                            <td style={{ padding: "4px 8px", textAlign: "right", borderRight: gridBorder, fontVariantNumeric: "tabular-nums", color: t.credit_amount > 0 ? "#22c55e" : T.textFaint }}>{t.credit_amount > 0 ? fmt(t.credit_amount) : "—"}</td>
                            <td style={{ padding: "4px 8px" }}>
                              <select value={t.account_category} onChange={(e) => updateStagedCategory(t._tempId!, e.target.value)} className="w-full px-2 py-1 rounded text-[10px] outline-none cursor-pointer" style={inputStyle}>
                                {EXPENSE_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                              </select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* 登録済み取引一覧 */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px]" style={{ color: T.textSub }}>表示:</span>
                {[
                  { v: "unconfirmed", l: `未確定 (${bankTxs.filter(t => !t.is_confirmed).length})` },
                  { v: "confirmed", l: `確定済 (${bankTxs.filter(t => t.is_confirmed).length})` },
                  { v: "all", l: `すべて (${bankTxs.length})` },
                ].map(o => (
                  <button key={o.v} onClick={() => setBankFilter(o.v as "all" | "unconfirmed" | "confirmed")} className="px-3 py-1 text-[10px] rounded-lg cursor-pointer" style={{ backgroundColor: bankFilter === o.v ? "#c3a782" : T.cardAlt, color: bankFilter === o.v ? "white" : T.textSub, border: `1px solid ${bankFilter === o.v ? "#c3a782" : T.border}` }}>{o.l}</button>
                ))}
                <div className="flex-1"></div>
                {bankTxs.filter(t => !t.is_confirmed).length > 0 && (
                  <button onClick={confirmAllExpenses} className="text-[11px] px-3 py-1.5 rounded cursor-pointer font-medium" style={{ backgroundColor: "#22c55e", color: "white", border: "none" }}>✓ 未確定分を一括で経費/売上登録</button>
                )}
              </div>

              <div className="rounded-xl overflow-hidden" style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}>
                <div className="px-4 py-2.5 flex items-center justify-between" style={{ backgroundColor: T.cardAlt, borderBottom: gridBorder }}>
                  <span className="text-[12px] font-medium">💳 銀行取引一覧</span>
                  <span className="text-[10px]" style={{ color: T.textFaint }}>{(() => { const f = bankTxs.filter(t => bankFilter === "all" || (bankFilter === "unconfirmed" && !t.is_confirmed) || (bankFilter === "confirmed" && t.is_confirmed)); return `${f.length}件表示中`; })()}</span>
                </div>
                <div style={{ maxHeight: 500, overflowY: "auto" }}>
                  <table className="w-full" style={{ fontSize: 11 }}>
                    <thead style={{ position: "sticky", top: 0, backgroundColor: T.cardAlt }}>
                      <tr style={{ color: T.textSub, fontSize: 10 }}>
                        <th style={{ padding: "5px 8px", textAlign: "left", borderRight: gridBorder, borderBottom: gridBorder, width: 80 }}>日付</th>
                        <th style={{ padding: "5px 8px", textAlign: "left", borderRight: gridBorder, borderBottom: gridBorder }}>摘要</th>
                        <th style={{ padding: "5px 8px", textAlign: "right", borderRight: gridBorder, borderBottom: gridBorder, width: 90 }}>出金</th>
                        <th style={{ padding: "5px 8px", textAlign: "right", borderRight: gridBorder, borderBottom: gridBorder, width: 90 }}>入金</th>
                        <th style={{ padding: "5px 8px", textAlign: "left", borderRight: gridBorder, borderBottom: gridBorder, width: 160 }}>勘定科目</th>
                        <th style={{ padding: "5px 8px", textAlign: "center", borderBottom: gridBorder, width: 180 }}>操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const filtered = bankTxs.filter(t => bankFilter === "all" || (bankFilter === "unconfirmed" && !t.is_confirmed) || (bankFilter === "confirmed" && t.is_confirmed));
                        if (filtered.length === 0) return <tr><td colSpan={6} style={{ padding: "24px", textAlign: "center", color: T.textFaint, fontSize: 11 }}>取引がありません。CSVをアップロードしてください。</td></tr>;
                        return filtered.map((t, i) => (
                          <tr key={t.id} style={{ borderTop: gridBorder, backgroundColor: i % 2 === 0 ? "transparent" : T.cardAlt + "40", opacity: t.is_confirmed ? 0.7 : 1 }}>
                            <td style={{ padding: "4px 8px", borderRight: gridBorder, fontVariantNumeric: "tabular-nums" }}>{t.transaction_date.slice(5)}</td>
                            <td style={{ padding: "4px 8px", borderRight: gridBorder, fontSize: 10, maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={t.description}>{t.description}</td>
                            <td style={{ padding: "4px 8px", textAlign: "right", borderRight: gridBorder, fontVariantNumeric: "tabular-nums", color: t.debit_amount > 0 ? "#c45555" : T.textFaint }}>{t.debit_amount > 0 ? fmt(t.debit_amount) : "—"}</td>
                            <td style={{ padding: "4px 8px", textAlign: "right", borderRight: gridBorder, fontVariantNumeric: "tabular-nums", color: t.credit_amount > 0 ? "#22c55e" : T.textFaint }}>{t.credit_amount > 0 ? fmt(t.credit_amount) : "—"}</td>
                            <td style={{ padding: "4px 8px", borderRight: gridBorder }}>
                              {t.is_confirmed ? (
                                <span className="text-[10px]">{t.account_label || EXPENSE_CATEGORIES.find(c => c.value === t.account_category)?.label}</span>
                              ) : (
                                <select value={t.account_category} onChange={(e) => t.id && updateTxCategory(t.id, e.target.value)} className="w-full px-2 py-1 rounded text-[10px] outline-none cursor-pointer" style={inputStyle}>
                                  {EXPENSE_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                                </select>
                              )}
                            </td>
                            <td style={{ padding: "4px 8px", textAlign: "center", whiteSpace: "nowrap" }}>
                              {t.is_confirmed ? (
                                <span className="text-[9px] px-2 py-0.5 rounded" style={{ backgroundColor: "#22c55e18", color: "#22c55e" }}>✓ 登録済</span>
                              ) : (
                                <>
                                  <button onClick={() => confirmExpense(t)} className="text-[9px] px-2 py-0.5 rounded cursor-pointer mr-1" style={{ backgroundColor: "#22c55e18", color: "#22c55e", border: "none" }}>✓ 登録</button>
                                  <button onClick={() => learnRule(t.description, t.account_category)} className="text-[9px] px-2 py-0.5 rounded cursor-pointer" style={{ backgroundColor: "#85a8c418", color: "#85a8c4", border: "none" }} title="この摘要のルールを学習">📝 学習</button>
                                </>
                              )}
                            </td>
                          </tr>
                        ));
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 学習済みルール */}
              <div className="rounded-xl overflow-hidden" style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}>
                <div className="px-4 py-2.5 flex items-center justify-between" style={{ backgroundColor: T.cardAlt, borderBottom: gridBorder }}>
                  <div>
                    <span className="text-[12px] font-medium">🧠 学習済み仕訳ルール（{bankRules.length}件）</span>
                    <p className="text-[9px] mt-0.5" style={{ color: T.textFaint }}>摘要マッチで自動分類 / 優先度が高い方が先に適用されます</p>
                  </div>
                  <button onClick={() => setShowNewRule(!showNewRule)} className="text-[11px] px-3 py-1.5 rounded cursor-pointer font-medium" style={{ backgroundColor: showNewRule ? T.cardAlt : "#22c55e", color: showNewRule ? T.textSub : "white", border: "none" }}>
                    {showNewRule ? "✕ キャンセル" : "＋ 新規ルール追加"}
                  </button>
                </div>

                {/* 新規追加フォーム */}
                {showNewRule && (
                  <div className="p-4" style={{ backgroundColor: "#22c55e10", borderBottom: gridBorder }}>
                    <p className="text-[11px] font-medium mb-3" style={{ color: "#22c55e" }}>＋ 新規ルール作成</p>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3">
                      <div>
                        <label className="block text-[10px] mb-1" style={{ color: T.textSub }}>マッチ文字列（摘要に含まれる部分）</label>
                        <input type="text" value={newRulePattern} onChange={(e) => setNewRulePattern(e.target.value)} placeholder="例: スギ薬局 / カ）◯◯" className="w-full px-3 py-2 rounded-lg text-[12px] outline-none" style={inputStyle} />
                      </div>
                      <div>
                        <label className="block text-[10px] mb-1" style={{ color: T.textSub }}>勘定科目</label>
                        <select value={newRuleCategory} onChange={(e) => setNewRuleCategory(e.target.value)} className="w-full px-3 py-2 rounded-lg text-[12px] outline-none cursor-pointer" style={inputStyle}>
                          {EXPENSE_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] mb-1" style={{ color: T.textSub }}>表示ラベル（任意）</label>
                        <input type="text" value={newRuleLabel} onChange={(e) => setNewRuleLabel(e.target.value)} placeholder="例: 消耗品費（薬局）" className="w-full px-3 py-2 rounded-lg text-[12px] outline-none" style={inputStyle} />
                      </div>
                      <div>
                        <label className="block text-[10px] mb-1" style={{ color: T.textSub }}>優先度（0-100）</label>
                        <input type="number" min="0" max="100" value={newRulePriority} onChange={(e) => setNewRulePriority(parseInt(e.target.value) || 50)} className="w-full px-3 py-2 rounded-lg text-[12px] outline-none" style={inputStyle} />
                      </div>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => { setShowNewRule(false); setNewRulePattern(""); setNewRuleLabel(""); }} className="text-[11px] px-3 py-1.5 rounded cursor-pointer" style={{ backgroundColor: T.cardAlt, color: T.textSub, border: "none" }}>キャンセル</button>
                      <button onClick={addNewRule} className="text-[11px] px-3 py-1.5 rounded cursor-pointer font-medium" style={{ backgroundColor: "#22c55e", color: "white", border: "none" }}>✓ ルール追加</button>
                    </div>
                  </div>
                )}

                <div style={{ maxHeight: 400, overflowY: "auto" }}>
                  <table className="w-full" style={{ fontSize: 11 }}>
                    <thead style={{ position: "sticky", top: 0, backgroundColor: T.cardAlt }}>
                      <tr style={{ color: T.textSub, fontSize: 10 }}>
                        <th style={{ padding: "5px 8px", textAlign: "left", borderRight: gridBorder, borderBottom: gridBorder }}>マッチ文字列</th>
                        <th style={{ padding: "5px 8px", textAlign: "left", borderRight: gridBorder, borderBottom: gridBorder }}>勘定科目</th>
                        <th style={{ padding: "5px 8px", textAlign: "left", borderRight: gridBorder, borderBottom: gridBorder }}>表示ラベル</th>
                        <th style={{ padding: "5px 8px", textAlign: "right", borderRight: gridBorder, borderBottom: gridBorder, width: 60 }}>優先度</th>
                        <th style={{ padding: "5px 8px", textAlign: "center", borderBottom: gridBorder, width: 140 }}>操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bankRules.length === 0 && <tr><td colSpan={5} style={{ padding: "16px", textAlign: "center", color: T.textFaint, fontSize: 10 }}>ルールがありません。「＋ 新規ルール追加」から作成してください。</td></tr>}
                      {bankRules.map((r, i) => {
                        const isEditing = editingRuleId === r.id;
                        return (
                          <tr key={r.id} style={{ borderTop: gridBorder, backgroundColor: isEditing ? "#c3a78218" : (i % 2 === 0 ? "transparent" : T.cardAlt + "40") }}>
                            {isEditing ? (
                              <>
                                <td style={{ padding: "4px 8px", borderRight: gridBorder }}>
                                  <input type="text" value={editRulePattern} onChange={(e) => setEditRulePattern(e.target.value)} className="w-full px-2 py-1 rounded text-[11px] outline-none" style={{ backgroundColor: T.bg, color: T.text, border: `1px solid #c3a782` }} autoFocus />
                                </td>
                                <td style={{ padding: "4px 8px", borderRight: gridBorder }}>
                                  <select value={editRuleCategory} onChange={(e) => setEditRuleCategory(e.target.value)} className="w-full px-2 py-1 rounded text-[11px] outline-none cursor-pointer" style={{ backgroundColor: T.bg, color: T.text, border: `1px solid #c3a782` }}>
                                    {EXPENSE_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                                  </select>
                                </td>
                                <td style={{ padding: "4px 8px", borderRight: gridBorder }}>
                                  <input type="text" value={editRuleLabel} onChange={(e) => setEditRuleLabel(e.target.value)} placeholder="表示ラベル" className="w-full px-2 py-1 rounded text-[11px] outline-none" style={{ backgroundColor: T.bg, color: T.text, border: `1px solid #c3a782` }} />
                                </td>
                                <td style={{ padding: "4px 8px", borderRight: gridBorder }}>
                                  <input type="number" min="0" max="100" value={editRulePriority} onChange={(e) => setEditRulePriority(parseInt(e.target.value) || 50)} className="w-full px-2 py-1 rounded text-[11px] outline-none text-right" style={{ backgroundColor: T.bg, color: T.text, border: `1px solid #c3a782` }} />
                                </td>
                                <td style={{ padding: "4px 8px", textAlign: "center", whiteSpace: "nowrap" }}>
                                  <button onClick={saveEditRule} className="text-[10px] px-2 py-1 rounded cursor-pointer mr-1" style={{ backgroundColor: "#22c55e", color: "white", border: "none" }}>✓ 保存</button>
                                  <button onClick={() => setEditingRuleId(null)} className="text-[10px] px-2 py-1 rounded cursor-pointer" style={{ backgroundColor: T.cardAlt, color: T.textSub, border: "none" }}>✕</button>
                                </td>
                              </>
                            ) : (
                              <>
                                <td style={{ padding: "4px 8px", borderRight: gridBorder, fontSize: 10 }}>{r.pattern}</td>
                                <td style={{ padding: "4px 8px", borderRight: gridBorder, fontSize: 10 }}>{EXPENSE_CATEGORIES.find(c => c.value === r.account_category)?.label || r.account_category}</td>
                                <td style={{ padding: "4px 8px", borderRight: gridBorder, fontSize: 10, color: T.textSub }}>{r.account_label || "—"}</td>
                                <td style={{ padding: "4px 8px", borderRight: gridBorder, textAlign: "right", color: T.textSub }}>{r.priority}</td>
                                <td style={{ padding: "4px 8px", textAlign: "center", whiteSpace: "nowrap" }}>
                                  <button onClick={() => startEditRule(r)} className="text-[10px] px-2 py-0.5 rounded cursor-pointer mr-1" style={{ backgroundColor: "#c3a78218", color: "#c3a782", border: "none" }}>✏️ 編集</button>
                                  <button onClick={() => deleteRule(r.id)} className="text-[10px] px-2 py-0.5 rounded cursor-pointer" style={{ backgroundColor: "#c4555518", color: "#c45555", border: "none" }}>🗑</button>
                                </td>
                              </>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 使い方ガイド */}
              <div className="rounded-xl p-5" style={{ backgroundColor: "#85a8c410", border: "1px solid #85a8c433" }}>
                <p className="text-[13px] font-medium mb-3" style={{ color: "#85a8c4" }}>📖 使い方ガイド</p>

                {/* 毎月の運用フロー */}
                <div className="mb-5">
                  <p className="text-[12px] font-medium mb-2" style={{ color: T.text }}>🔄 毎月の運用フロー（3〜5分で完了）</p>
                  <div className="rounded-lg p-3" style={{ backgroundColor: T.cardAlt }}>
                    <ol className="text-[11px] leading-relaxed" style={{ color: T.textSub, paddingLeft: 20 }}>
                      <li className="mb-1.5"><strong style={{ color: T.text }}>PayPay銀行から明細CSVをDL</strong> → マイページ → 入出金明細 → CSV出力（1ヶ月分）</li>
                      <li className="mb-1.5"><strong style={{ color: T.text }}>「🏦 銀行取込」シートにアップ</strong> → ドロップゾーンにファイルを選択</li>
                      <li className="mb-1.5"><strong style={{ color: T.text }}>プレビューで自動仕訳を確認</strong> → 50ルールが適用済みなので大半は緑色で表示される</li>
                      <li className="mb-1.5"><strong style={{ color: T.text }}>「雑費（要確認）」だけ手動で勘定科目を変更</strong> → 新規取引先のみ対応</li>
                      <li className="mb-1.5"><strong style={{ color: T.text }}>「✓ 取込確定」ボタン</strong> → 一覧に登録（同じCSVを2回入れても重複はスキップされる）</li>
                      <li className="mb-1.5"><strong style={{ color: T.text }}>「✓ 未確定分を一括で経費/売上登録」</strong> → expensesテーブルに反映 → 月次サマリー・経費シートで自動集計</li>
                      <li><strong style={{ color: T.text }}>新規取引先は「📝 学習」で記憶</strong> → 次回から自動仕訳される</li>
                    </ol>
                  </div>
                </div>

                {/* ルール管理のコツ */}
                <div className="mb-5">
                  <p className="text-[12px] font-medium mb-2" style={{ color: T.text }}>🎯 ルール管理のコツ</p>
                  <div className="rounded-lg p-3 mb-2" style={{ backgroundColor: T.cardAlt }}>
                    <p className="text-[11px] font-medium mb-1" style={{ color: "#c3a782" }}>優先度の使い分け</p>
                    <table className="w-full text-[10px]" style={{ color: T.textSub }}>
                      <tbody>
                        <tr><td style={{ padding: "2px 8px", color: T.textFaint, width: 70 }}>100</td><td>必ず最優先（振込手数料・受取利息など明確なもの）</td></tr>
                        <tr><td style={{ padding: "2px 8px", color: T.textFaint }}>85〜90</td><td>個人名・具体的取引先（誤マッチリスク低）</td></tr>
                        <tr><td style={{ padding: "2px 8px", color: T.textFaint }}>70〜80</td><td>会社名・一般的なサービス名（Amazon、Google等）</td></tr>
                        <tr><td style={{ padding: "2px 8px", color: T.textFaint }}>60〜70</td><td>カテゴリ判定したい広めのパターン</td></tr>
                        <tr><td style={{ padding: "2px 8px", color: T.textFaint }}>50以下</td><td>汎用パターン（誤マッチの可能性あり）</td></tr>
                      </tbody>
                    </table>
                  </div>
                  <div className="rounded-lg p-3 mb-2" style={{ backgroundColor: T.cardAlt }}>
                    <p className="text-[11px] font-medium mb-1" style={{ color: "#c3a782" }}>マッチ文字列の書き方</p>
                    <ul className="text-[10px] leading-relaxed" style={{ color: T.textSub, paddingLeft: 18, listStyleType: "disc" }}>
                      <li className="mb-0.5"><strong>姓名間は全角スペース</strong>（CSVの表示そのまま）。例：<code style={{ backgroundColor: T.bg, padding: "1px 4px", borderRadius: 3 }}>フクナガ　テツオ</code></li>
                      <li className="mb-0.5"><strong>部分マッチで動作</strong>。長い文字列より、ユニークで短い部分を指定する方が安全</li>
                      <li className="mb-0.5">半角カタカナ・全角カタカナ・英数字はCSVの表示に合わせる必要あり</li>
                      <li>誤マッチ発見時は✏️編集で修正。削除より編集が推奨</li>
                    </ul>
                  </div>
                  <div className="rounded-lg p-3" style={{ backgroundColor: T.cardAlt }}>
                    <p className="text-[11px] font-medium mb-1" style={{ color: "#c3a782" }}>同じ取引先が複数カテゴリにまたがる場合</p>
                    <p className="text-[10px] leading-relaxed" style={{ color: T.textSub }}>
                      例：「イズオカ ノブヒロ」は家賃、「イズオカ レイア」は水道代 → <strong>姓名まで含めて登録</strong>することで区別可能。「イズオカ」だけだと両方が同じ科目になってしまいます。
                    </p>
                  </div>
                </div>

                {/* トラブルシューティング */}
                <div className="mb-5">
                  <p className="text-[12px] font-medium mb-2" style={{ color: T.text }}>🔧 こんな時は</p>
                  <div className="rounded-lg p-3 space-y-2" style={{ backgroundColor: T.cardAlt }}>
                    <div>
                      <p className="text-[11px] font-medium" style={{ color: "#f59e0b" }}>Q. 自動仕訳されず「雑費（要確認）」になる</p>
                      <p className="text-[10px]" style={{ color: T.textSub, paddingLeft: 14 }}>→ マッチするルールがない状態。手動で勘定科目を選んで「📝 学習」ボタンで記憶させる。次回から自動化されます。</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-medium" style={{ color: "#f59e0b" }}>Q. 違う勘定科目に自動仕訳されてしまう</p>
                      <p className="text-[10px]" style={{ color: T.textSub, paddingLeft: 14 }}>→ 既存ルールの誤マッチ。学習済みルール一覧から該当ルールを✏️編集して修正するか、優先度を下げる。</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-medium" style={{ color: "#f59e0b" }}>Q. 確定済み取引を修正したい</p>
                      <p className="text-[10px]" style={{ color: T.textSub, paddingLeft: 14 }}>→ 経費シート（/tax-dashboard のバックオフィス）から該当レコードを直接編集。銀行取込画面では確定済みは編集不可（二重操作防止のため）。</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-medium" style={{ color: "#f59e0b" }}>Q. 同じCSVを2回アップロードしてしまった</p>
                      <p className="text-[10px]" style={{ color: T.textSub, paddingLeft: 14 }}>→ DB側でUNIQUE制約あり。日付・順番号・摘要・金額が同じ取引は自動スキップされるので安心してください。</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-medium" style={{ color: "#f59e0b" }}>Q. 業務委託スタッフとセラピストを区別したい</p>
                      <p className="text-[10px]" style={{ color: T.textSub, paddingLeft: 14 }}>→ 両方とも勘定科目は「外注費」だが、表示ラベルで区別（例：「外注費（業務委託スタッフ）」「外注費（セラピスト）」）。源泉徴収の有無は別途、セラピスト支払・源泉シートで管理。</p>
                    </div>
                  </div>
                </div>

                {/* 重要な注意事項 */}
                <div>
                  <p className="text-[12px] font-medium mb-2" style={{ color: T.text }}>⚠️ 重要な注意事項</p>
                  <div className="rounded-lg p-3" style={{ backgroundColor: "#c4555510", border: "1px solid #c4555533" }}>
                    <ul className="text-[10px] leading-relaxed space-y-1" style={{ color: T.textSub, paddingLeft: 18, listStyleType: "disc" }}>
                      <li><strong style={{ color: "#c45555" }}>セラピスト支払は別管理が推奨</strong>：銀行取込でセラピストへの振込が混入した場合、セラピスト支払・源泉シートと二重計上にならないよう注意（源泉徴収計算は日次精算ベースで自動算出）</li>
                      <li><strong style={{ color: "#c45555" }}>ATMからの現金入金</strong>：売上入金として登録されるが、実際はレジ売上の銀行預入。売上データと重複しないよう、経理上は「現金→預金」の振替仕訳として税理士さんに伝える</li>
                      <li><strong style={{ color: "#c45555" }}>個人口座との混在に注意</strong>：法人口座のみを取込む。代表者個人の取引が含まれていないか確認</li>
                      <li><strong style={{ color: "#c45555" }}>確定前に必ずプレビュー確認</strong>：自動仕訳が間違っていても画面上では気づかないことがある。特に新規取引先は要注意</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}
          {sheet === "docs" && (
            <div className="space-y-4 animate-[fadeIn_0.3s]">
              {/* サマリーカード */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="rounded-xl p-4" style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}>
                  <p className="text-[10px] mb-1" style={{ color: T.textMuted }}>登録書類数</p>
                  <p className="text-[18px] font-medium">{taxDocs.length}件</p>
                </div>
                <div className="rounded-xl p-4" style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}>
                  <p className="text-[10px] mb-1" style={{ color: T.textMuted }}>決算書</p>
                  <p className="text-[18px] font-medium" style={{ color: "#c3a782" }}>{taxDocs.filter(d => d.category === "決算書").length}件</p>
                </div>
                <div className="rounded-xl p-4" style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}>
                  <p className="text-[10px] mb-1" style={{ color: T.textMuted }}>申告書</p>
                  <p className="text-[18px] font-medium" style={{ color: "#85a8c4" }}>{taxDocs.filter(d => d.category === "申告書").length}件</p>
                </div>
                <div className="rounded-xl p-4" style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}>
                  <p className="text-[10px] mb-1" style={{ color: T.textMuted }}>総容量</p>
                  <p className="text-[18px] font-medium">{(taxDocs.reduce((s, d) => s + (d.file_size || 0), 0) / 1024 / 1024).toFixed(1)}MB</p>
                </div>
              </div>

              {/* アップロードエリア */}
              <div className="rounded-xl p-5" style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}>
                <p className="text-[13px] font-medium mb-3">📤 書類アップロード</p>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3">
                  <div>
                    <label className="block text-[10px] mb-1" style={{ color: T.textSub }}>カテゴリ</label>
                    <select value={uploadCategory} onChange={(e) => setUploadCategory(e.target.value)} className="w-full px-3 py-2 rounded-lg text-[12px] outline-none cursor-pointer" style={inputStyle}>
                      {DOC_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] mb-1" style={{ color: T.textSub }}>ファイル名（任意）</label>
                    <input type="text" value={uploadDisplayName} onChange={(e) => setUploadDisplayName(e.target.value)} placeholder={NAME_PLACEHOLDER[uploadCategory] || "例: ファイル名"} className="w-full px-3 py-2 rounded-lg text-[12px] outline-none" style={inputStyle} />
                  </div>
                  <div>
                    <label className="block text-[10px] mb-1" style={{ color: T.textSub }}>期（任意）</label>
                    <input type="text" value={uploadPeriod} onChange={(e) => setUploadPeriod(e.target.value)} placeholder={PERIOD_PLACEHOLDER[uploadCategory] || "例: 第3期 / 2025年分"} className="w-full px-3 py-2 rounded-lg text-[12px] outline-none" style={inputStyle} />
                  </div>
                  <div>
                    <label className="block text-[10px] mb-1" style={{ color: T.textSub }}>
                      対象者（{uploadCategory === "個人確定申告" ? "個人書類は必須" : "任意"}）
                    </label>
                    <input
                      type="text"
                      value={uploadTargetPerson}
                      onChange={(e) => setUploadTargetPerson(e.target.value)}
                      list="staff-suggestions"
                      placeholder={uploadCategory === "個人確定申告" ? "例: 田中社長" : "会社書類なら空欄でOK"}
                      className="w-full px-3 py-2 rounded-lg text-[12px] outline-none"
                      style={inputStyle}
                    />
                    <datalist id="staff-suggestions">
                      {(staffList || []).map(s => <option key={s.id} value={s.name} />)}
                    </datalist>
                  </div>
                  <div className="md:col-span-4">
                    <label className="block text-[10px] mb-1" style={{ color: T.textSub }}>備考（任意）</label>
                    <input type="text" value={uploadNotes} onChange={(e) => setUploadNotes(e.target.value)} placeholder={NOTES_PLACEHOLDER[uploadCategory] || "メモ"} className="w-full px-3 py-2 rounded-lg text-[12px] outline-none" style={inputStyle} />
                  </div>
                </div>
                <label className="block cursor-pointer">
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png,.csv,.xlsx,.xls,.docx,.doc" className="hidden" disabled={uploading} onChange={(e) => { const f = e.target.files?.[0]; if (f) { uploadDoc(f); e.target.value = ""; } }} />
                  <div className="rounded-lg py-8 text-center transition-colors" style={{ border: `2px dashed ${T.border}`, backgroundColor: uploading ? T.cardAlt : "transparent" }}>
                    {uploading ? (
                      <p className="text-[12px]" style={{ color: "#c3a782" }}>📤 アップロード中...</p>
                    ) : (
                      <>
                        <p className="text-[12px]" style={{ color: T.textSub }}>📎 クリックしてファイルを選択</p>
                        <p className="text-[10px] mt-1" style={{ color: T.textFaint }}>PDF・JPG・PNG・CSV・Excel・Word（最大20MB）</p>
                        <p className="text-[9px] mt-1" style={{ color: T.textFaint }}>※ ファイル名が空欄の場合は元のファイル名のまま保存されます</p>
                      </>
                    )}
                  </div>
                </label>
              </div>

              {/* フィルター */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px]" style={{ color: T.textSub }}>カテゴリ:</span>
                <button onClick={() => setDocFilter("all")} className="px-3 py-1 text-[10px] rounded-lg cursor-pointer" style={{ backgroundColor: docFilter === "all" ? "#c3a782" : T.cardAlt, color: docFilter === "all" ? "white" : T.textSub, border: `1px solid ${docFilter === "all" ? "#c3a782" : T.border}` }}>すべて ({taxDocs.length})</button>
                {DOC_CATEGORIES.map(c => {
                  const count = taxDocs.filter(d => d.category === c).length;
                  if (count === 0) return null;
                  return <button key={c} onClick={() => setDocFilter(c)} className="px-3 py-1 text-[10px] rounded-lg cursor-pointer" style={{ backgroundColor: docFilter === c ? "#c3a782" : T.cardAlt, color: docFilter === c ? "white" : T.textSub, border: `1px solid ${docFilter === c ? "#c3a782" : T.border}` }}>{c} ({count})</button>;
                })}
                {(() => {
                  const periods = Array.from(new Set(taxDocs.map(d => d.fiscal_period).filter(p => p)));
                  if (periods.length === 0) return null;
                  return (
                    <>
                      <span className="text-[11px] ml-3" style={{ color: T.textSub }}>期:</span>
                      <select value={docPeriodFilter} onChange={(e) => setDocPeriodFilter(e.target.value)} className="px-2 py-1 text-[10px] rounded-lg outline-none cursor-pointer" style={inputStyle}>
                        <option value="all">すべて</option>
                        {periods.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </>
                  );
                })()}
                {(() => {
                  const persons = Array.from(new Set(taxDocs.map(d => d.target_person_name).filter((p): p is string => !!p)));
                  if (persons.length === 0) return null;
                  return (
                    <>
                      <span className="text-[11px] ml-3" style={{ color: T.textSub }}>対象者:</span>
                      <select value={docPersonFilter} onChange={(e) => setDocPersonFilter(e.target.value)} className="px-2 py-1 text-[10px] rounded-lg outline-none cursor-pointer" style={inputStyle}>
                        <option value="all">すべて</option>
                        <option value="__company__">会社書類のみ（対象者なし）</option>
                        {persons.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </>
                  );
                })()}
              </div>

              {/* 書類一覧 */}
              <div className="rounded-xl overflow-hidden" style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}>
                <div className="px-4 py-2.5 flex items-center justify-between" style={{ backgroundColor: T.cardAlt, borderBottom: gridBorder }}>
                  <span className="text-[12px] font-medium">📁 書類一覧</span>
                  <span className="text-[10px]" style={{ color: T.textFaint }}>
                    {(() => {
                      const filtered = taxDocs.filter(d =>
                        (docFilter === "all" || d.category === docFilter) &&
                        (docPeriodFilter === "all" || d.fiscal_period === docPeriodFilter) &&
                        (docPersonFilter === "all" || (docPersonFilter === "__company__" ? !d.target_person_name : d.target_person_name === docPersonFilter))
                      );
                      return `${filtered.length}件表示中`;
                    })()}
                  </span>
                </div>
                <div style={{ maxHeight: 500, overflowY: "auto" }}>
                  <table className="w-full" style={{ fontSize: 12 }}>
                    <thead style={{ position: "sticky", top: 0, backgroundColor: T.cardAlt }}>
                      <tr style={{ color: T.textSub, fontSize: 11 }}>
                        <th style={{ padding: "6px 10px", textAlign: "center", width: 40, borderRight: gridBorder, borderBottom: gridBorder }}></th>
                        <th style={{ padding: "6px 10px", textAlign: "left", borderRight: gridBorder, borderBottom: gridBorder }}>カテゴリ</th>
                        <th style={{ padding: "6px 10px", textAlign: "left", borderRight: gridBorder, borderBottom: gridBorder }}>ファイル名</th>
                        <th style={{ padding: "6px 10px", textAlign: "left", borderRight: gridBorder, borderBottom: gridBorder }}>対象者</th>
                        <th style={{ padding: "6px 10px", textAlign: "left", borderRight: gridBorder, borderBottom: gridBorder }}>期</th>
                        <th style={{ padding: "6px 10px", textAlign: "left", borderRight: gridBorder, borderBottom: gridBorder }}>備考</th>
                        <th style={{ padding: "6px 10px", textAlign: "left", borderRight: gridBorder, borderBottom: gridBorder }}>アップ者</th>
                        <th style={{ padding: "6px 10px", textAlign: "left", borderRight: gridBorder, borderBottom: gridBorder }}>アップ日</th>
                        <th style={{ padding: "6px 10px", textAlign: "right", borderRight: gridBorder, borderBottom: gridBorder }}>サイズ</th>
                        <th style={{ padding: "6px 10px", textAlign: "center", borderBottom: gridBorder, width: 180 }}>操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const filtered = taxDocs.filter(d =>
                          (docFilter === "all" || d.category === docFilter) &&
                          (docPeriodFilter === "all" || d.fiscal_period === docPeriodFilter) &&
                          (docPersonFilter === "all" || (docPersonFilter === "__company__" ? !d.target_person_name : d.target_person_name === docPersonFilter))
                        );
                        if (filtered.length === 0) return <tr><td colSpan={10} style={{ padding: "24px", textAlign: "center", color: T.textFaint, fontSize: 11 }}>書類が登録されていません</td></tr>;
                        const catColors: Record<string, string> = { "決算書": "#c3a782", "申告書": "#85a8c4", "契約書": "#7ab88f", "固定資産": "#a885c4", "支払調書": "#e091a8", "決済明細": "#4a7c9f", "借入・融資": "#c45555", "保険": "#5aa8a8", "納税通知": "#c4a555", "個人確定申告": "#d97757", "その他": "#888780" };
                        return filtered.map((d, i) => (
                          <tr key={d.id} style={{ borderTop: gridBorder, backgroundColor: i % 2 === 0 ? "transparent" : T.cardAlt + "40" }}>
                            <td style={{ padding: "5px 10px", textAlign: "center", color: T.textFaint, fontSize: 10, borderRight: gridBorder }}>{i + 1}</td>
                            <td style={{ padding: "5px 10px", borderRight: gridBorder }}>
                              <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ backgroundColor: (catColors[d.category] || "#888") + "22", color: catColors[d.category] || "#888" }}>{d.category}</span>
                            </td>
                            <td style={{ padding: "5px 10px", borderRight: gridBorder, maxWidth: 260 }}>
                              {editingDocId === d.id ? (
                                <input
                                  type="text"
                                  autoFocus
                                  value={editingFileName}
                                  onChange={(e) => setEditingFileName(e.target.value)}
                                  onKeyDown={(e) => { if (e.key === "Enter") saveDocName(d); if (e.key === "Escape") { setEditingDocId(null); setEditingFileName(""); } }}
                                  className="w-full px-2 py-1 rounded text-[12px] outline-none"
                                  style={{ backgroundColor: T.bg, color: T.text, border: `1px solid #c3a782` }}
                                />
                              ) : (
                                <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={d.file_name}>{d.file_name}</div>
                              )}
                            </td>
                            <td style={{ padding: "5px 10px", borderRight: gridBorder, fontSize: 11 }}>
                              {d.target_person_name
                                ? <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "#85a8c422", color: "#85a8c4" }}>👤 {d.target_person_name}</span>
                                : <span style={{ color: T.textFaint, fontSize: 10 }}>—</span>}
                            </td>
                            <td style={{ padding: "5px 10px", borderRight: gridBorder, color: T.textSub, fontSize: 11 }}>{d.fiscal_period || "—"}</td>
                            <td style={{ padding: "5px 10px", borderRight: gridBorder, color: T.textMuted, fontSize: 10, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={d.notes}>{d.notes || ""}</td>
                            <td style={{ padding: "5px 10px", borderRight: gridBorder, color: T.textMuted, fontSize: 11 }}>{d.uploaded_by_name || "—"}</td>
                            <td style={{ padding: "5px 10px", borderRight: gridBorder, color: T.textMuted, fontSize: 11, fontVariantNumeric: "tabular-nums" }}>{d.created_at?.slice(0, 10) || "—"}</td>
                            <td style={{ padding: "5px 10px", textAlign: "right", fontVariantNumeric: "tabular-nums", color: T.textSub, borderRight: gridBorder, fontSize: 11 }}>{((d.file_size || 0) / 1024).toFixed(0)}KB</td>
                            <td style={{ padding: "5px 10px", textAlign: "center", whiteSpace: "nowrap" }}>
                              {editingDocId === d.id ? (
                                <>
                                  <button onClick={() => saveDocName(d)} className="text-[10px] px-2 py-1 rounded cursor-pointer mr-1" style={{ backgroundColor: "#22c55e18", color: "#22c55e", border: "none" }}>✓ 保存</button>
                                  <button onClick={() => { setEditingDocId(null); setEditingFileName(""); }} className="text-[10px] px-2 py-1 rounded cursor-pointer" style={{ backgroundColor: T.cardAlt, color: T.textSub, border: "none" }}>✕</button>
                                </>
                              ) : (
                                <>
                                  <button onClick={() => { setEditingDocId(d.id); setEditingFileName(d.file_name.replace(/\.[^.]+$/, "")); }} className="text-[10px] px-2 py-1 rounded cursor-pointer mr-1" style={{ backgroundColor: "#c3a78218", color: "#c3a782", border: "none" }}>✏️</button>
                                  <a href={d.file_url} target="_blank" rel="noopener noreferrer" className="text-[10px] px-2 py-1 rounded cursor-pointer mr-1" style={{ backgroundColor: "#85a8c418", color: "#85a8c4", textDecoration: "none" }}>📄 開く</a>
                                  <button onClick={() => deleteDoc(d)} className="text-[10px] px-2 py-1 rounded cursor-pointer" style={{ backgroundColor: "#c4555518", color: "#c45555", border: "none" }}>🗑</button>
                                </>
                              )}
                            </td>
                          </tr>
                        ));
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-xl p-4" style={{ backgroundColor: "#85a8c410", border: "1px solid #85a8c433" }}>
                <p className="text-[11px] font-medium mb-2" style={{ color: "#85a8c4" }}>💡 書類庫の使い方</p>
                <p className="text-[11px] leading-relaxed mb-3" style={{ color: T.textSub }}>
                  税理士・社長・経営責任者のみアップロード/閲覧/削除が可能です。ファイル名はUUIDでランダム化されて保存されます。1ファイル最大20MB。
                </p>
                <p className="text-[11px] font-medium mb-2" style={{ color: "#85a8c4" }}>📝 カテゴリ別おすすめ命名ルール</p>
                <div className="rounded-lg overflow-hidden" style={{ border: `1px solid ${T.border}` }}>
                  <table className="w-full" style={{ fontSize: 11 }}>
                    <thead>
                      <tr style={{ backgroundColor: T.cardAlt, color: T.textSub, fontSize: 10 }}>
                        <th style={{ padding: "6px 10px", textAlign: "left", borderRight: gridBorder }}>カテゴリ</th>
                        <th style={{ padding: "6px 10px", textAlign: "left", borderRight: gridBorder }}>入れるもの</th>
                        <th style={{ padding: "6px 10px", textAlign: "left", borderRight: gridBorder }}>ファイル名例</th>
                        <th style={{ padding: "6px 10px", textAlign: "left", borderRight: gridBorder }}>期の例</th>
                        <th style={{ padding: "6px 10px", textAlign: "left" }}>備考の例</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { c: "決算書", w: "決算書・事業概況・勘定科目内訳", n: "第2期 決算書", p: "第2期", m: "2024年度" },
                        { c: "申告書", w: "法人税・消費税・住民税申告書", n: "第2期 法人税申告書", p: "第2期", m: "電子申告済" },
                        { c: "契約書", w: "賃貸借・リース・業務委託など", n: "本店賃貸借契約書（オアシス）", p: "全期共通", m: "2024/4契約" },
                        { c: "固定資産", w: "固定資産台帳、減価償却資料", n: "固定資産台帳 第3期", p: "第3期", m: "期末時点" },
                        { c: "支払調書", w: "セラピスト・外注先の支払調書", n: "2025年分 支払調書", p: "2025年分", m: "全セラピスト分" },
                        { c: "借入・融資", w: "借入契約書、返済予定表", n: "〇〇銀行 返済予定表 2026年4月", p: "第3期", m: "残高○○万円" },
                        { c: "保険", w: "法人保険証券、節税保険、火災保険", n: "火災保険証券（店舗）", p: "全期共通", m: "契約2025-2027" },
                        { c: "納税通知", w: "固定資産税・住民税・事業税など", n: "2025年度 固定資産税通知", p: "第3期", m: "年税額○○円" },
                        { c: "その他", w: "上記に当てはまらないもの", n: "任意", p: "任意", m: "自由" },
                      ].map((r, i) => {
                        const catColors: Record<string, string> = { "決算書": "#c3a782", "申告書": "#85a8c4", "契約書": "#7ab88f", "固定資産": "#a885c4", "支払調書": "#e091a8", "決済明細": "#4a7c9f", "借入・融資": "#c45555", "保険": "#5aa8a8", "納税通知": "#c4a555", "個人確定申告": "#d97757", "その他": "#888780" };
                        return (
                          <tr key={r.c} style={{ borderTop: gridBorder, backgroundColor: i % 2 === 0 ? "transparent" : T.cardAlt + "40" }}>
                            <td style={{ padding: "5px 10px", borderRight: gridBorder }}>
                              <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ backgroundColor: catColors[r.c] + "22", color: catColors[r.c] }}>{r.c}</span>
                            </td>
                            <td style={{ padding: "5px 10px", borderRight: gridBorder, color: T.textSub, fontSize: 10 }}>{r.w}</td>
                            <td style={{ padding: "5px 10px", borderRight: gridBorder, fontSize: 10 }}>{r.n}</td>
                            <td style={{ padding: "5px 10px", borderRight: gridBorder, color: T.textMuted, fontSize: 10 }}>{r.p}</td>
                            <td style={{ padding: "5px 10px", color: T.textMuted, fontSize: 10 }}>{r.m}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="text-[10px] mt-3" style={{ color: T.textFaint }}>
                  💡 <strong>毎年増える書類（借入返済表・保険証券・納税通知など）</strong>は、アップ時に<strong>年月を入れる</strong>と更新履歴として管理できます。<br/>
                  💡 カテゴリを選ぶとファイル名欄に命名例が表示されます（例に沿って入れると検索しやすくなります）。
                </p>
              </div>
            </div>
          )}

          {/* ── Sheet: 年間税務スケジュール ── */}
          {sheet === "schedule" && (
            <div className="space-y-4 animate-[fadeIn_0.3s]">
              {(() => {
                const fy = getCurrentFiscalYear();
                const allTasks = TAX_TASKS;
                const filteredTasks = allTasks.filter(t => {
                  if (scheduleFilter !== "all" && t.assignee !== scheduleFilter) return false;
                  if (scheduleMonthFilter !== "all") {
                    if (scheduleMonthFilter === "monthly" && t.month !== 0) return false;
                    if (scheduleMonthFilter !== "monthly" && t.month !== parseInt(scheduleMonthFilter)) return false;
                  }
                  return true;
                });
                const doneCount = allTasks.filter(t => getTaskStatus(t.id) === "done").length;
                const inProgressCount = allTasks.filter(t => getTaskStatus(t.id) === "in_progress").length;
                const pendingCount = allTasks.length - doneCount - inProgressCount;

                return (
                  <>
                    {/* サマリーカード */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="rounded-xl p-4" style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}>
                        <p className="text-[10px] mb-1" style={{ color: T.textMuted }}>全タスク数</p>
                        <p className="text-[18px] font-medium">{allTasks.length}件</p>
                      </div>
                      <div className="rounded-xl p-4" style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}>
                        <p className="text-[10px] mb-1" style={{ color: T.textMuted }}>完了</p>
                        <p className="text-[18px] font-medium" style={{ color: "#22c55e" }}>{doneCount}件</p>
                      </div>
                      <div className="rounded-xl p-4" style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}>
                        <p className="text-[10px] mb-1" style={{ color: T.textMuted }}>準備中</p>
                        <p className="text-[18px] font-medium" style={{ color: "#f59e0b" }}>{inProgressCount}件</p>
                      </div>
                      <div className="rounded-xl p-4" style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}>
                        <p className="text-[10px] mb-1" style={{ color: T.textMuted }}>未着手</p>
                        <p className="text-[18px] font-medium" style={{ color: "#c45555" }}>{pendingCount}件</p>
                      </div>
                    </div>

                    {/* フィルター */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px]" style={{ color: T.textSub }}>担当:</span>
                      {["all", "税理士", "会社", "社労士", "共同"].map(a => (
                        <button key={a} onClick={() => setScheduleFilter(a)} className="px-3 py-1 text-[10px] rounded-lg cursor-pointer" style={{ backgroundColor: scheduleFilter === a ? "#c3a782" : T.cardAlt, color: scheduleFilter === a ? "white" : T.textSub, border: `1px solid ${scheduleFilter === a ? "#c3a782" : T.border}` }}>
                          {a === "all" ? `すべて (${allTasks.length})` : `${a} (${allTasks.filter(t => t.assignee === a).length})`}
                        </button>
                      ))}
                      <span className="text-[11px] ml-3" style={{ color: T.textSub }}>時期:</span>
                      <select value={scheduleMonthFilter} onChange={(e) => setScheduleMonthFilter(e.target.value)} className="px-2 py-1 text-[10px] rounded-lg outline-none cursor-pointer" style={inputStyle}>
                        <option value="all">すべて</option>
                        <option value="monthly">毎月</option>
                        {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => <option key={m} value={m}>{m}月</option>)}
                      </select>
                    </div>

                    {/* タスク一覧 */}
                    <div className="rounded-xl overflow-hidden" style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}>
                      <div className="px-4 py-2.5 flex items-center justify-between" style={{ backgroundColor: T.cardAlt, borderBottom: gridBorder }}>
                        <div>
                          <span className="text-[12px] font-medium">📅 年間税務スケジュール（第{fy - 2023}期 / 3月決算）</span>
                          <p className="text-[9px] mt-0.5" style={{ color: T.textFaint }}>ステータス更新は画面上でクリックするだけ。第{fy - 2023}期分として記録されます。</p>
                        </div>
                        <span className="text-[10px]" style={{ color: T.textFaint }}>{filteredTasks.length}件表示中</span>
                      </div>
                      <div style={{ maxHeight: 600, overflowY: "auto" }}>
                        <table className="w-full" style={{ fontSize: 12 }}>
                          <thead style={{ position: "sticky", top: 0, backgroundColor: T.cardAlt }}>
                            <tr style={{ color: T.textSub, fontSize: 11 }}>
                              <th style={{ padding: "6px 10px", textAlign: "center", width: 40, borderRight: gridBorder, borderBottom: gridBorder }}></th>
                              <th style={{ padding: "6px 10px", textAlign: "left", borderRight: gridBorder, borderBottom: gridBorder, width: 90 }}>時期</th>
                              <th style={{ padding: "6px 10px", textAlign: "left", borderRight: gridBorder, borderBottom: gridBorder }}>タスク</th>
                              <th style={{ padding: "6px 10px", textAlign: "center", borderRight: gridBorder, borderBottom: gridBorder, width: 80 }}>担当</th>
                              <th style={{ padding: "6px 10px", textAlign: "center", borderRight: gridBorder, borderBottom: gridBorder, width: 80 }}>カテゴリ</th>
                              <th style={{ padding: "6px 10px", textAlign: "center", borderRight: gridBorder, borderBottom: gridBorder, width: 90 }}>期限</th>
                              <th style={{ padding: "6px 10px", textAlign: "center", borderBottom: gridBorder, width: 140 }}>ステータス</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredTasks.length === 0 && (
                              <tr><td colSpan={7} style={{ padding: "24px", textAlign: "center", color: T.textFaint, fontSize: 11 }}>該当するタスクがありません</td></tr>
                            )}
                            {filteredTasks.map((t, i) => {
                              const status = getTaskStatus(t.id);
                              const assigneeColors: Record<string, string> = { "税理士": "#85a8c4", "会社": "#c3a782", "社労士": "#7ab88f", "共同": "#a885c4" };
                              const categoryColors: Record<string, string> = { "法人税": "#85a8c4", "消費税": "#85a8c4", "源泉": "#f59e0b", "社保": "#7ab88f", "労保": "#7ab88f", "住民税": "#c4a555", "決算": "#c3a782", "固定資産": "#a885c4", "給与": "#e091a8", "経理": "#888780", "その他": "#888780" };
                              return (
                                <tr key={t.id} style={{ borderTop: gridBorder, backgroundColor: i % 2 === 0 ? "transparent" : T.cardAlt + "40", opacity: status === "done" ? 0.6 : 1 }}>
                                  <td style={{ padding: "5px 10px", textAlign: "center", color: T.textFaint, fontSize: 10, borderRight: gridBorder }}>{i + 1}</td>
                                  <td style={{ padding: "5px 10px", borderRight: gridBorder, fontSize: 11, color: T.textSub }}>{t.timing}</td>
                                  <td style={{ padding: "5px 10px", borderRight: gridBorder }}>
                                    <div style={{ fontWeight: 500, textDecoration: status === "done" ? "line-through" : "none" }}>{t.title}</div>
                                    <div className="text-[10px]" style={{ color: T.textMuted, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
                                      {t.description.split(/(https?:\/\/[^\s　]+)/g).map((part, idx) => {
                                        if (/^https?:\/\//.test(part)) {
                                          return (
                                            <a
                                              key={idx}
                                              href={part}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              style={{ color: "#4a7c9f", textDecoration: "underline", wordBreak: "break-all" }}
                                              onClick={(e) => e.stopPropagation()}
                                            >{part}</a>
                                          );
                                        }
                                        return <span key={idx}>{part}</span>;
                                      })}
                                    </div>
                                  </td>
                                  <td style={{ padding: "5px 10px", textAlign: "center", borderRight: gridBorder }}>
                                    <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ backgroundColor: (assigneeColors[t.assignee] || "#888") + "22", color: assigneeColors[t.assignee] || "#888" }}>{t.assignee}</span>
                                  </td>
                                  <td style={{ padding: "5px 10px", textAlign: "center", borderRight: gridBorder }}>
                                    <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ backgroundColor: (categoryColors[t.category] || "#888") + "18", color: categoryColors[t.category] || "#888" }}>{t.category}</span>
                                  </td>
                                  <td style={{ padding: "5px 10px", textAlign: "center", borderRight: gridBorder, fontSize: 11, fontWeight: 500, color: t.importance === "high" ? "#c45555" : T.textSub }}>{t.deadline}</td>
                                  <td style={{ padding: "5px 10px", textAlign: "center" }}>
                                    <div className="flex gap-1 justify-center">
                                      <button onClick={() => updateTaskStatus(t.id, "pending")} className="text-[9px] px-1.5 py-0.5 rounded cursor-pointer" style={{ backgroundColor: status === "pending" ? "#c45555" : T.cardAlt, color: status === "pending" ? "white" : T.textFaint, border: "none" }}>未着手</button>
                                      <button onClick={() => updateTaskStatus(t.id, "in_progress")} className="text-[9px] px-1.5 py-0.5 rounded cursor-pointer" style={{ backgroundColor: status === "in_progress" ? "#f59e0b" : T.cardAlt, color: status === "in_progress" ? "white" : T.textFaint, border: "none" }}>準備中</button>
                                      <button onClick={() => updateTaskStatus(t.id, "done")} className="text-[9px] px-1.5 py-0.5 rounded cursor-pointer" style={{ backgroundColor: status === "done" ? "#22c55e" : T.cardAlt, color: status === "done" ? "white" : T.textFaint, border: "none" }}>完了</button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* 案内 */}
                    <div className="rounded-xl p-4" style={{ backgroundColor: "#c3a78210", border: "1px solid #c3a78233" }}>
                      <p className="text-[11px] font-medium mb-1" style={{ color: "#c3a782" }}>💡 年間スケジュールについて</p>
                      <p className="text-[11px] leading-relaxed" style={{ color: T.textSub }}>
                        このスケジュールは<strong>3月決算法人</strong>（合同会社テラスライフ/チョップ）向けです。<br/>
                        ステータスは<strong>期ごと</strong>に別々に記録されるので、毎年リセットされます（タスク一覧は固定）。<br/>
                        <strong>担当別の役割分担:</strong> 税理士=江坂先生 / 社労士=大石さん / 会社=社内対応 / 共同=決算など連携が必要なもの<br/>
                        重要度が高いタスクの期限は赤字で表示されます。
                      </p>
                    </div>
                  </>
                );
              })()}
            </div>
          )}

        </div>
      </div>

      {/* ── Bottom Sheet Tabs（エクセル風） ── */}
      <div className="flex-shrink-0 border-t flex items-stretch overflow-x-auto" style={{ borderColor: T.border, backgroundColor: T.cardAlt }}>
        {[
          { k: "summary" as SheetKey, l: "月次サマリー", icon: "📊", ready: true },
          { k: "sales" as SheetKey, l: "売上", icon: "💰", ready: true },
          { k: "expense" as SheetKey, l: "経費", icon: "💸", ready: true },
          { k: "therapist" as SheetKey, l: "セラピスト支払・源泉", icon: "👥", ready: true },
          { k: "invoice" as SheetKey, l: "インボイス", icon: "🧾", ready: true },
          { k: "schedule" as SheetKey, l: "年間スケジュール", icon: "📅", ready: true },
          { k: "docs" as SheetKey, l: "書類庫", icon: "📁", ready: true },
          { k: "bank" as SheetKey, l: "銀行取込", icon: "🏦", ready: true },
        ].map(t => {
          const active = sheet === t.k;
          return (
            <button
              key={t.k}
              onClick={() => setSheet(t.k)}
              className="px-5 py-2.5 text-[11px] cursor-pointer whitespace-nowrap transition-colors flex items-center gap-1.5"
              style={{
                backgroundColor: active ? T.card : "transparent",
                color: active ? T.text : t.ready ? T.textSub : T.textFaint,
                borderTop: active ? "2px solid #c3a782" : "2px solid transparent",
                borderRight: `1px solid ${T.border}`,
                fontWeight: active ? 500 : 400,
              }}
            >
              <span>{t.icon}</span>
              <span>{t.l}</span>
              {!t.ready && <span className="text-[8px] px-1 py-0.5 rounded" style={{ backgroundColor: T.cardAlt, color: T.textFaint }}>P2</span>}
            </button>
          );
        })}
      </div>

      <style jsx global>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }`}</style>

      {/* ── Modal: 領収書表示 ── */}
      {receiptModal && (
        <div
          onClick={() => setReceiptModal(null)}
          style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="rounded-2xl overflow-hidden flex flex-col"
            style={{ backgroundColor: T.card, border: `1px solid ${T.border}`, maxWidth: 720, width: "100%", maxHeight: "90vh" }}
          >
            <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: `1px solid ${T.border}`, backgroundColor: T.cardAlt }}>
              <div>
                <p className="text-[13px] font-medium">📎 領収書</p>
                <p className="text-[10px]" style={{ color: T.textMuted }}>
                  {receiptModal.date}　{ACCOUNT_MAP[receiptModal.category] || "雑費"}　{fmt(receiptModal.amount)}　{receiptModal.name || ""}
                </p>
              </div>
              <button onClick={() => setReceiptModal(null)} className="text-[14px] cursor-pointer px-2" style={{ background: "transparent", border: "none", color: T.textSub }}>×</button>
            </div>
            <div className="flex-1 overflow-auto flex items-center justify-center p-4" style={{ backgroundColor: T.cardAlt }}>
              {receiptModal.receipt_url && (receiptModal.receipt_url.toLowerCase().endsWith(".pdf") ? (
                <iframe src={receiptModal.receipt_url} style={{ width: "100%", height: "70vh", border: "none", backgroundColor: "#fff" }} />
              ) : (
                <img src={receiptModal.receipt_url} alt="領収書" style={{ maxWidth: "100%", maxHeight: "75vh", objectFit: "contain" }} />
              ))}
            </div>
            <div className="px-5 py-3 flex items-center justify-between" style={{ borderTop: `1px solid ${T.border}` }}>
              <a href={receiptModal.receipt_url} target="_blank" rel="noopener noreferrer" className="text-[11px]" style={{ color: "#4a7c9f", textDecoration: "underline" }}>
                新しいタブで開く
              </a>
              <button onClick={() => setReceiptModal(null)} className="text-[11px] px-3 py-1.5 rounded cursor-pointer" style={{ backgroundColor: T.cardAlt, border: `1px solid ${T.border}`, color: T.text }}>閉じる</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: 要確認マーク ── */}
      {reviewModal && (
        <div
          onClick={() => { setReviewModal(null); setReviewNoteInput(""); }}
          style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="rounded-2xl overflow-hidden"
            style={{ backgroundColor: T.card, border: `1px solid ${T.border}`, maxWidth: 480, width: "100%" }}
          >
            <div className="px-5 py-3" style={{ borderBottom: `1px solid ${T.border}`, backgroundColor: T.cardAlt }}>
              <p className="text-[13px] font-medium">🚩 要確認マーク</p>
              <p className="text-[10px] mt-1" style={{ color: T.textMuted }}>
                {reviewModal.date}　{ACCOUNT_MAP[reviewModal.category] || "雑費"}　{fmt(reviewModal.amount)}　{reviewModal.name || ""}
              </p>
            </div>
            <div className="p-5 space-y-3">
              {reviewModal.needs_review ? (
                <>
                  <p className="text-[11px]" style={{ color: T.textSub }}>
                    この経費には現在、要確認マークが付いています。
                    {reviewModal.flagged_by_name && (
                      <span style={{ display: "block", fontSize: 10, color: T.textMuted, marginTop: 4 }}>
                        フラグ付与: {reviewModal.flagged_by_name}　{reviewModal.flagged_at ? new Date(reviewModal.flagged_at).toLocaleString("ja-JP") : ""}
                      </span>
                    )}
                  </p>
                  <div>
                    <p className="text-[10px] mb-1" style={{ color: T.textMuted }}>理由・メモ</p>
                    <textarea
                      value={reviewNoteInput}
                      onChange={e => setReviewNoteInput(e.target.value)}
                      rows={3}
                      placeholder="領収書の金額が読めない / 勘定科目の確認が必要 など"
                      className="w-full rounded p-2 text-[12px]"
                      style={{ backgroundColor: T.cardAlt, border: `1px solid ${T.border}`, color: T.text }}
                    />
                  </div>
                </>
              ) : (
                <>
                  <p className="text-[11px]" style={{ color: T.textSub }}>
                    この経費に要確認マークを付けますか？<br />
                    後で見返す時に目印になります。
                  </p>
                  <div>
                    <p className="text-[10px] mb-1" style={{ color: T.textMuted }}>理由・メモ（任意）</p>
                    <textarea
                      value={reviewNoteInput}
                      onChange={e => setReviewNoteInput(e.target.value)}
                      rows={3}
                      placeholder="領収書の金額が読めない / 勘定科目の確認が必要 など"
                      className="w-full rounded p-2 text-[12px]"
                      style={{ backgroundColor: T.cardAlt, border: `1px solid ${T.border}`, color: T.text }}
                    />
                  </div>
                </>
              )}
            </div>
            <div className="px-5 py-3 flex items-center justify-between gap-2" style={{ borderTop: `1px solid ${T.border}` }}>
              <button onClick={() => { setReviewModal(null); setReviewNoteInput(""); }} className="text-[11px] px-3 py-1.5 rounded cursor-pointer" style={{ backgroundColor: T.cardAlt, border: `1px solid ${T.border}`, color: T.text }}>キャンセル</button>
              <div className="flex items-center gap-2">
                {reviewModal.needs_review && (
                  <button
                    onClick={() => toggleExpenseReview(reviewModal, "")}
                    className="text-[11px] px-3 py-1.5 rounded cursor-pointer"
                    style={{ backgroundColor: "#22c55e18", color: "#22c55e", border: "none" }}
                  >✓ マークを外す</button>
                )}
                {reviewModal.needs_review ? (
                  <button
                    onClick={() => toggleExpenseReview({ ...reviewModal, needs_review: false }, reviewNoteInput)}
                    className="text-[11px] px-3 py-1.5 rounded cursor-pointer"
                    style={{ backgroundColor: "#c45555", color: "#fff", border: "none" }}
                  >🚩 メモを更新</button>
                ) : (
                  <button
                    onClick={() => toggleExpenseReview(reviewModal, reviewNoteInput)}
                    className="text-[11px] px-3 py-1.5 rounded cursor-pointer"
                    style={{ backgroundColor: "#c45555", color: "#fff", border: "none" }}
                  >🚩 要確認マークを付ける</button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: 領収書ZIP一括ダウンロード ── */}
      {bulkDLModal && (
        <div
          onClick={() => !bulkDLLoading && setBulkDLModal(false)}
          style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="rounded-2xl overflow-hidden"
            style={{ backgroundColor: T.card, border: `1px solid ${T.border}`, maxWidth: 480, width: "100%" }}
          >
            <div className="px-5 py-3" style={{ borderBottom: `1px solid ${T.border}`, backgroundColor: T.cardAlt }}>
              <p className="text-[13px] font-medium">📦 領収書をまとめてダウンロード</p>
              <p className="text-[10px] mt-1" style={{ color: T.textMuted }}>指定期間・カテゴリの領収書画像をZIPで一括取得します</p>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <p className="text-[10px] mb-1" style={{ color: T.textMuted }}>対象月</p>
                <input
                  type="month"
                  value={bulkDLMonth}
                  onChange={e => setBulkDLMonth(e.target.value)}
                  className="w-full rounded p-2 text-[12px]"
                  style={{ backgroundColor: T.cardAlt, border: `1px solid ${T.border}`, color: T.text }}
                />
              </div>
              <div>
                <p className="text-[10px] mb-1" style={{ color: T.textMuted }}>勘定科目</p>
                <select
                  value={bulkDLCategory}
                  onChange={e => setBulkDLCategory(e.target.value)}
                  className="w-full rounded p-2 text-[12px] cursor-pointer"
                  style={{ backgroundColor: T.cardAlt, border: `1px solid ${T.border}`, color: T.text }}
                >
                  <option value="all">すべて</option>
                  {EXPENSE_CATEGORIES.filter(c => c.value !== "income" && c.value !== "misc_income").map(c => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div className="rounded p-3" style={{ backgroundColor: T.cardAlt, border: `1px dashed ${T.border}` }}>
                <p className="text-[10px]" style={{ color: T.textMuted }}>
                  📁 ZIP内の構成:<br />
                  　_集計表.csv（全件の一覧・BOM付き）<br />
                  　_領収書なし一覧.txt（領収書未登録の経費）<br />
                  　001_日付_金額_項目.jpg / .pdf ...
                </p>
              </div>
            </div>
            <div className="px-5 py-3 flex items-center justify-between gap-2" style={{ borderTop: `1px solid ${T.border}` }}>
              <button
                onClick={() => setBulkDLModal(false)}
                disabled={bulkDLLoading}
                className="text-[11px] px-3 py-1.5 rounded"
                style={{ backgroundColor: T.cardAlt, border: `1px solid ${T.border}`, color: T.text, cursor: bulkDLLoading ? "not-allowed" : "pointer", opacity: bulkDLLoading ? 0.5 : 1 }}
              >キャンセル</button>
              <button
                onClick={downloadReceiptsZip}
                disabled={bulkDLLoading}
                className="text-[11px] px-4 py-1.5 rounded"
                style={{ backgroundColor: "#4a7c59", color: "#fff", border: "none", cursor: bulkDLLoading ? "wait" : "pointer", opacity: bulkDLLoading ? 0.6 : 1 }}
              >{bulkDLLoading ? "⏳ 処理中..." : "📦 ZIPでダウンロード"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
