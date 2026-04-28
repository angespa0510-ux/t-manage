"use client";
import { useState, useEffect, useCallback } from "react";

/* ── 型定義 ── */
type ThemeColors = { bg: string; card: string; cardAlt: string; text: string; textSub: string; textMuted: string; textFaint: string; border: string; [key: string]: string };
type TaxProfile = {
  isSubJob: boolean | null;       // 副業？
  annualIncome: string;           // 年間収入
  hasSpouse: boolean | null;      // 配偶者あり？
  spouseIncome: string;           // 配偶者控除判定用
  mainJobIncome: string;          // 本業収入（副業の場合）
  hasKaigyou: boolean | null;     // 開業届提出済み？
  isAoiro: boolean | null;        // 青色申告？
  hasInvoice: boolean | null;     // インボイス登録済み？
  shopRequiresInvoice: boolean | null; // 店がインボイス求めてる？
  isStudent: boolean | null;      // 学生？
  isDependent: boolean | null;    // 家族の扶養に入っている？
  isSingleParent: boolean | null; // ひとり親？（シングルマザー/ファザー）
};
type StepStatus = { [key: number]: "done" | "skip" | null };

const STORAGE_KEY = "tax_support_progress";
const PROFILE_KEY = "tax_support_profile";

const defaultProfile: TaxProfile = {
  isSubJob: null, annualIncome: "", hasSpouse: null, spouseIncome: "",
  mainJobIncome: "", hasKaigyou: null, isAoiro: null, hasInvoice: null, shopRequiresInvoice: null,
  isStudent: null, isDependent: null, isSingleParent: null,
};

/* ── メインコンポーネント ── */
export default function TaxSupportWizard({ T, therapistId, onGoToLedger }: { T: ThemeColors; therapistId: number; onGoToLedger?: () => void }) {
  const [step, setStep] = useState(0);
  const [profile, setProfile] = useState<TaxProfile>(defaultProfile);
  const [stepStatus, setStepStatus] = useState<StepStatus>({});
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const [showCalc, setShowCalc] = useState(false);
  const [calcIncome, setCalcIncome] = useState("");
  const [calcExpense, setCalcExpense] = useState("");
  const [calcDays, setCalcDays] = useState("");
  const [calcHasInvoice, setCalcHasInvoice] = useState(false);
  const [checklist, setChecklist] = useState<{ [key: string]: boolean }>({});
  const [showDetail, setShowDetail] = useState<string | null>(null);

  // ── LocalStorage 読み書き ──
  const storageId = `${STORAGE_KEY}_${therapistId}`;
  const profileId = `${PROFILE_KEY}_${therapistId}`;
  const checklistId = `tax_checklist_${therapistId}`;

  useEffect(() => {
    try {
      const s = localStorage.getItem(storageId);
      if (s) setStepStatus(JSON.parse(s));
      const p = localStorage.getItem(profileId);
      if (p) setProfile(JSON.parse(p));
      const c = localStorage.getItem(checklistId);
      if (c) setChecklist(JSON.parse(c));
    } catch { /* ignore */ }
  }, [storageId, profileId, checklistId]);

  const saveStatus = useCallback((s: StepStatus) => { setStepStatus(s); localStorage.setItem(storageId, JSON.stringify(s)); }, [storageId]);
  const saveProfile = useCallback((p: TaxProfile) => { setProfile(p); localStorage.setItem(profileId, JSON.stringify(p)); }, [profileId]);
  const saveChecklist = useCallback((c: { [key: string]: boolean }) => { setChecklist(c); localStorage.setItem(checklistId, JSON.stringify(c)); }, [checklistId]);
  const toggleCheck = (key: string) => { const c = { ...checklist, [key]: !checklist[key] }; saveChecklist(c); };

  // ── スタイル（HPトーンで統一） ──
  const pink = "#c96b83";
  const pinkLight = "#f7e3e7";
  const pinkBorder = "#e8849a55";
  const green = "#6b9b7e";
  const orange = "#b38419";
  const red = "#c96b83";

  // HP と揃える（角丸最小、フラットなボーダー）
  const cardBase = { backgroundColor: T.card, border: `1px solid ${T.border}` };
  const altCard = { backgroundColor: T.cardAlt, border: `1px solid ${T.border}`, padding: "14px" };
  const btnPink = { background: pink, color: "#fff", border: "none", padding: "11px 22px", fontSize: "12px", cursor: "pointer", fontWeight: 500, letterSpacing: "0.1em" };
  const btnOutline = { backgroundColor: "transparent", color: T.textSub, border: `1px solid ${T.border}`, padding: "11px 22px", fontSize: "12px", cursor: "pointer", letterSpacing: "0.05em" };
  const yesNoBtn = (active: boolean | null, target: boolean) => ({
    backgroundColor: active === target ? (target ? green + "18" : red + "18") : "transparent",
    color: active === target ? (target ? green : red) : T.textMuted,
    border: `1px solid ${active === target ? (target ? green : red) : T.border}`,
    padding: "11px 26px", fontSize: "12px", cursor: "pointer", fontWeight: active === target ? 500 : 400, letterSpacing: "0.05em",
  });

  // ── ステップ定義 ──
  const STEPS = [
    { icon: "🏠", label: "はじめに" },
    { icon: "📋", label: "状況確認" },
    { icon: "📝", label: "開業届" },
    { icon: "📘", label: "青色/白色" },
    { icon: "🧾", label: "インボイス" },
    { icon: "💰", label: "経費整理" },
    { icon: "📄", label: "申告・提出" },
  ];

  const completedSteps = Object.values(stepStatus).filter(v => v === "done").length;
  const progressPct = Math.round((completedSteps / STEPS.length) * 100);

  // ── 節税計算 ──
  // Ange Spa は施術業として業務委託契約しているため、源泉徴収なしで運用 (契約書 v3.0 第3条)。
  // セラピストは個人事業主として自分で確定申告・納税する必要があり、経費を計上することで
  // 納税額を最小化できる ── というのがこのシミュレーターの主目的。
  const calcSaving = () => {
    const income = parseInt(calcIncome) || 0;
    const expense = parseInt(calcExpense) || 0;
    const days = parseInt(calcDays) || 0;
    // インボイス控除（未登録の場合バック×10%が天引き／Ange Spa の運用）
    const invoiceDed = calcHasInvoice ? 0 : Math.round(income * 0.1);
    const adjustedIncome = income - invoiceDed;
    // 源泉徴収は Ange Spa では行われない (将来切替時の備えとして変数は残す)
    const dailyAdj = days > 0 ? adjustedIncome / days : 0;
    const withheld = 0;
    // 厚生費（500円×出勤日数）
    const welfareFee = days > 0 ? 500 * days : 0;
    // 交通費支給（2000円×出勤日数）
    const transportIncome = days > 0 ? 2000 * days : 0;
    // 総収入（手取りベースではなくバック総額＋交通費）
    const totalIncome = income + transportIncome;
    // 総経費（自己負担＋厚生費＋交通費実費）
    const totalExpense = expense + welfareFee + (days > 0 ? 2000 * days : 0);
    const profit = Math.max(0, totalIncome - totalExpense);
    const aoiroIncome = Math.max(0, profit - 650000);
    const baseTax = (n: number) => {
      if (n <= 0) return 0;
      // 2025年分以降：基礎控除95万円（合計所得132万以下）、それ以上は58万円
      const kiso = n <= 1320000 ? 950000 : 580000;
      const taxable = Math.max(0, n - kiso);
      if (taxable <= 1950000) return Math.floor(taxable * 0.05);
      if (taxable <= 3300000) return Math.floor(taxable * 0.10 - 97500);
      if (taxable <= 6950000) return Math.floor(taxable * 0.20 - 427500);
      return Math.floor(taxable * 0.23 - 636000);
    };
    const aoiroTax = baseTax(aoiroIncome);
    const aoiroTotal = aoiroTax + Math.floor(aoiroTax * 0.021);
    // 「経費を一切計上しない場合」の納税額 (比較用 = もし申告しなかったらいくら払うことになるか)
    const noExpenseProfit = Math.max(0, adjustedIncome + transportIncome);
    const noExpenseBase = baseTax(noExpenseProfit);
    const noExpenseTotal = noExpenseBase + Math.floor(noExpenseBase * 0.021);
    // 節税額 = 経費なしの税額 − 経費・控除を計上した税額
    const taxSaving = Math.max(0, noExpenseTotal - aoiroTotal);
    // 還付金は Ange Spa では発生しない (源泉なしのため)。
    // 他店で源泉徴収されている場合のみ意味を持つので 0 に。変数は互換のため残す。
    const refund = 0;
    const healthSaving = Math.floor(profit * 0.10) - Math.floor(aoiroIncome * 0.10);
    return { income, expense, days, dailyAdj, invoiceDed, adjustedIncome, withheld, welfareFee, transportIncome, totalIncome, totalExpense, profit, aoiroIncome, aoiroTax, aoiroTotal, noExpenseTotal, taxSaving, refund, healthSaving, totalBenefit: taxSaving + healthSaving };
  };

  const fmt = (n: number) => "¥" + n.toLocaleString();

  // ── 経費リスト（リラクゼーションセラピスト特化）──
  const expenseCategories = [
    { cat: "💄 美容関連", items: ["美容院代", "ネイル代", "マツエク", "スキンケア用品", "化粧品", "サプリメント", "ボディケア用品"], note: "施術業務に必要な場合、全額〜一部が経費に" },
    { cat: "👗 衣装・備品", items: ["施術用衣装", "ルームウェア", "ストッキング", "下着", "タオル", "シーツ", "アロマオイル", "マッサージオイル"], note: "仕事専用のものは全額経費" },
    { cat: "🧴 洗濯・消耗品", items: ["洗剤・柔軟剤（仕事用）", "コインランドリー代", "除菌スプレー", "ウェットティッシュ", "消臭剤", "ゴミ袋", "ボディソープ・シャンプー（業務用）"], note: "お客様対応に使う消耗品" },
    { cat: "🚃 交通費", items: ["電車・バス代", "タクシー代", "駐車場代（月極含む）", "ガソリン代（按分）", "高速道路代"], note: "通勤・移動にかかる費用" },
    { cat: "📱 通信費", items: ["携帯電話代（按分）", "Wi-Fi代（按分）", "仕事用アプリ課金"], note: "プライベートと兼用の場合は仕事割合で按分" },
    { cat: "☕ カフェ・食事", items: ["待機中のカフェ代", "出勤前の食事"], note: "待機時間中のカフェ代は経費にできる場合あり" },
    { cat: "📚 研修・勉強", items: ["マッサージ講習費", "セミナー参加費", "参考書籍", "アロマ資格講座"], note: "スキルアップのための費用" },
    { cat: "📸 宣伝・広告", items: ["プロフィール写真撮影費", "名刺印刷代", "SNS広告費"], note: "集客・ブランディングに関する費用" },
    { cat: "🛡️ 保険・健康", items: ["施術賠償保険", "健康診断費用"], note: "施術トラブルに備える保険や仕事に必要な健診" },
    { cat: "🏠 家賃（在宅の場合）", items: ["家賃の一部（按分）", "水道光熱費（按分）"], note: "自宅で施術する場合のみ" },
  ];

  // ── FAQ ──
  const faqs = [
    {
      q: "🔒 副業がバレない方法は？【超重要】",
      a: `本業がある方にとって最も大事なポイントです。以下を守れば、基本的にバレません。

━━━ 最重要 ━━━
✅ 確定申告書 第二表の「住民税の徴収方法」で
　「自分で納付（普通徴収）」にチェック！

これをしないと、副業分の住民税が本業の会社の給料から天引き（特別徴収）されて、会社に「この人、他の収入がある」と通知されてバレます。

━━━ なぜバレるのか？ ━━━
① 住民税は「全ての所得」を合算して計算される
② 通常、住民税は会社の給料から天引き（特別徴収）
③ 副業収入があると住民税が増える
④ 会社の経理が「あれ？給料に対して住民税が高い」と気づく
→ バレる！

━━━ 普通徴収にすると ━━━
① 副業分の住民税だけ「自分で納付」に分離される
② 自宅に納付書が届く（年4回）
③ 自分で銀行・コンビニで支払う
④ 会社には本業分の住民税だけが通知される
→ バレない！

━━━ 納付書を自宅以外に届けたい場合 ━━━
家族と同居していて自宅に届くと困る場合：
✅ 市区町村の税務課に「送付先変更依頼書」を提出すれば、勤務先のお店など別の住所に届けてもらえます。
• 窓口、郵送、またはオンラインで手続き可能（市区町村による）
• 本人確認書類が必要
• お店のオーナーに相談して送付先にしてもらうのが安心

━━━ SNSでの宣伝について ━━━
お仕事の宣伝は大事！でも以下の対策を：
✅ 顔写真にはスタンプやモザイクを使う
✅ 本名は絶対に出さない（源氏名のみ）
✅ プライベートアカウントとは完全に分ける
✅ 位置情報をオフにする
✅ 本業の同僚・上司にフォローされないアカウントで
✅ 本業の会社名・制服等が映り込まないよう注意

━━━ 帳簿・確定申告書での書き方 ━━━
確定申告書や帳簿には、職業・収入を記載しますが：
✅ 職業欄 →「ボディケア業」「施術業」など
✅ 収入の摘要 →「業務委託報酬」が最も安全
❌ 源氏名やお店の名前は書かない
❌「マッサージ」は法律上の資格名（あん摩マッサージ指圧師）なので避ける
⭕「施術業務報酬」「ボディケア施術報酬」「業務委託報酬」がおすすめ

━━━ その他の注意点 ━━━
• 普通徴収の選択欄は「確定申告書 第二表」の下の方にあります
• 市区町村によっては普通徴収に対応しない場合もあるので、事前に市役所に電話確認を
• ふるさと納税の「ワンストップ特例」は使わない（確定申告で一括処理する）
• 本業の会社に提出する年末調整では、副業の情報は書かない`,
    },
    {
      q: "💑 配偶者控除はどうなる？",
      a: `配偶者控除を受けるための条件：
• あなた（または配偶者）の合計所得が48万円以下
• 控除を受ける側の合計所得が1,000万円以下

配偶者特別控除：合計所得48万円超〜133万円以下なら段階的に控除あり

⚠️ よくある誤解：
「年収103万円の壁」は給与所得の話。個人事業主の場合は「所得（収入−経費）」で判定します。
経費をしっかり計上すれば、収入が多くても所得を抑えられます。`,
    },
    {
      q: "😰 確定申告しないとどうなる？",
      a: `❌ 無申告のリスク：
• 無申告加算税：本来の税額に15〜20%上乗せ
• 延滞税：年利最大14.6%
• 悪質な場合は重加算税（35〜40%）
• 5年間は遡って調査される可能性
• 住宅ローンが組めない
• 国民健康保険料が高くなる（所得不明で最高額に）

✅ 申告するメリット：
• 正しい税額を納められる（払いすぎ防止）
• 経費計上で大幅節税
• 社会的信用（ローン審査、賃貸審査）
• 国民健康保険料が適正額になる`,
    },
    {
      q: "📅 いつまでに何をすればいい？",
      a: `確定申告のスケジュール：
• 1月〜12月：日々の収入・経費を記録
• 1月中旬〜：前年分の収支を集計
• 2月16日〜3月15日：確定申告書の提出期間
• 3月15日まで：所得税の納付期限
• 4月以降：住民税・国民健康保険料の決定通知

💡 開業届・青色申告承認申請書は「開業日から2ヶ月以内」に提出！
（1月1日〜1月15日開業の場合は3月15日まで）`,
    },
    {
      q: "🤷 白色でいいんじゃない？",
      a: `白色申告は手軽ですが、損をしています：

白色申告のデメリット：
• 特別控除なし（青色なら最大65万円控除）
• 赤字の繰越しができない
• 家族への給与を経費にできない

例えば年間所得300万円の場合：
• 白色：所得税+住民税 約30万円
• 青色65万円控除：所得税+住民税 約20万円
→ 年間約10万円の差！

青色申告は「複式簿記」が必要ですが、
T-MANAGEの帳簿機能が自動で複式簿記に対応しています。別途会計ソフトを契約する必要はありません！`,
    },
    {
      q: "💳 経費のレシートがない場合は？",
      a: `レシートがなくても経費にできる場合があります：

• 交通系ICカードの利用履歴
• クレジットカード明細
• 銀行の振込記録
• 出金伝票（自分で記録）

💡 コツ：
• 今日からでもレシートを取っておく
• スマホで写真を撮る習慣をつける
• 交通費は「出発地→目的地」をメモ
• 100均でレシート入れを用意するだけでOK`,
    },
    {
      q: "🏦 口座は分けた方がいい？",
      a: `結論：仕事用の口座を分けるのが理想的です。

メリット：
• 収入・経費の管理が楽になる
• 確定申告の時に仕分けが不要
• 会計ソフトとの連携が簡単

おすすめ：
• ネット銀行（楽天銀行、PayPay銀行など）で無料開設
• 仕事の入金はすべてこの口座に
• 経費もこの口座から支払い`,
    },
    {
      q: "💼 他の仕事と掛け持ちしている場合は？",
      a: `当店では同業種（リラクゼーション・エステ等）での掛け持ちは禁止です。
ここでは、飲食店・派遣・アルバイトなど別業種の仕事と掛け持ちしている場合の確定申告についてまとめます。

━━━ 確定申告はどうなる？ ━━━
✅ 全ての仕事の収入を合算して1つの確定申告書で申告します。
• 当店の業務委託報酬 ＋ 他の仕事の給料やバイト代をまとめて申告
• 各勤務先から「源泉徴収票」や「支払調書」をもらえれば収入把握が楽に
• T-MANAGEの帳簿には当店の清算データが自動反映されますが、他の仕事の収入は手動で追加してください

━━━ 書類の集め方 ━━━
• 当店 → 支払調書（バックオフィスから出力可能）
• アルバイト・パート先 → 「源泉徴収票」を年末〜1月にもらう
• 派遣会社 → 「源泉徴収票」または「支払調書」をもらう
• もらえない場合は、自分の給料明細や振込記録で代用可能

━━━ 経費の按分（あんぶん） ━━━
当店の仕事と他の仕事で共通して使う経費は「按分」が必要です：
• 交通費 → 仕事ごとに分けて記録するのがベスト
• 携帯電話 → 仕事で使う割合を決めて計上（例：仕事70%）
• 衣装 → 当店専用なら全額経費OK
• 按分の根拠（出勤日数の比率など）をメモしておくと安心

━━━ 扶養・社会保険への影響 ━━━
⚠️ 全ての仕事の合計収入で判定されます：
• 年間所得48万円超 → 配偶者控除から外れる可能性
• 年間収入130万円超 → 社会保険の扶養から外れる可能性
• 家族の扶養に入っている方は要注意！

━━━ 申告の注意点 ━━━
• 当店の報酬（業務委託）→ 事業所得 or 雑所得として申告
• アルバイト・パート（雇用契約）→ 給与所得として申告
• 両方ある場合は、それぞれ別の欄に記入します
• 住民税の「普通徴収」を選べば、当店での仕事が他の勤務先に知られません

━━━ 帳簿のつけ方 ━━━
✅ 収入源ごとに分けて記録すると管理が楽です：
• T-MANAGEの帳簿 → 当店の収入は自動記録
• 他の仕事の収入 → 「その他収入」として手動で追加
• 摘要欄に「○○（飲食バイト）」などと記載すると分かりやすい`,
    },
  ];

  // ── 必要書類チェックリスト ──
  const documents = [
    { key: "mynumber", label: "マイナンバーカード（または通知カード＋身分証明書）" },
    { key: "bank", label: "納付・還付用の口座情報（通帳やキャッシュカード）" },
    { key: "income_record", label: "1年間の収入記録（給料明細・振込記録）" },
    { key: "expense_receipts", label: "経費のレシート・領収書" },
    { key: "insurance", label: "国民健康保険の納付証明書" },
    { key: "pension", label: "国民年金の控除証明書" },
    { key: "seimei_hoken", label: "生命保険料の控除証明書（加入している場合）" },
    { key: "ideco", label: "iDeCo等の控除証明書（加入している場合）" },
    { key: "furusato", label: "ふるさと納税の受領証明書（利用した場合）" },
    { key: "kaigyou_copy", label: "開業届の控え" },
    { key: "aoiro_copy", label: "青色申告承認申請書の控え（青色の場合）" },
  ];

  /* ================================================================
     レンダリング
     ================================================================ */
  return (
    <div className="space-y-4 pb-20">
      {/* ── 進捗バー ── */}
      <div style={{ ...cardBase, padding: "16px" }}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[13px] font-medium" style={{ color: T.text }}>📊 確定申告サポート</span>
          <span className="text-[10px] font-medium" style={{ color: pink }}>{progressPct}% 完了</span>
        </div>
        <div style={{ height: "6px", borderRadius: "3px", backgroundColor: T.cardAlt, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${progressPct}%`, borderRadius: "3px", background: `linear-gradient(90deg, ${pink}, #d4687e)`, transition: "width 0.5s ease" }} />
        </div>
        <div className="flex gap-1 mt-3 overflow-x-auto pb-1">
          {STEPS.map((s, i) => (
            <button key={i} onClick={() => setStep(i)}
              className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg cursor-pointer flex-shrink-0 transition-all"
              style={{
                backgroundColor: step === i ? pinkLight : stepStatus[i] === "done" ? green + "10" : "transparent",
                border: `1px solid ${step === i ? pink : stepStatus[i] === "done" ? green + "44" : T.border}`,
                minWidth: "52px"
              }}>
              <span className="text-[14px]">{stepStatus[i] === "done" ? "✅" : s.icon}</span>
              <span className="text-[8px]" style={{ color: step === i ? pink : stepStatus[i] === "done" ? green : T.textMuted }}>{s.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ============== Step 0: はじめに ============== */}
      {step === 0 && (
        <div className="space-y-3">
          <div style={{ ...cardBase, padding: "20px" }}>
            <h2 className="text-[14px] font-medium mb-3" style={{ color: T.text }}>🌸 はじめに — なぜ確定申告するの？</h2>

            {/* 核心の説明 */}
            <div className="p-4 rounded-2xl mb-4" style={{ background: `linear-gradient(135deg, ${pink}15, ${pink}05)`, border: `1px solid ${pinkBorder}` }}>
              <p className="text-[12px] font-medium mb-2" style={{ color: pink }}>💡 一番大事なこと</p>
              <p className="text-[11px] leading-relaxed" style={{ color: T.textSub }}>
                Ange Spa はあなたを<b>個人事業主</b>として業務委託しています。お給料からの<b style={{ color: green }}>源泉徴収はありません</b>。
                つまり、<b style={{ color: red }}>自分で確定申告して所得税を納める必要があります</b>。
              </p>
              <p className="text-[11px] leading-relaxed mt-2" style={{ color: T.textSub }}>
                でも安心してください。美容費・衣装代・交通費など<b style={{ color: green }}>たくさんの経費</b>がかかっていますよね？
                確定申告で経費をしっかり申告すれば、<b style={{ color: green }}>納税額を最小化</b>できます。
                やらないのは大損です。
              </p>
            </div>

            {/* 図解：お金の流れ */}
            <div style={{ ...altCard, marginBottom: "12px" }}>
              <p className="text-[11px] font-medium mb-3" style={{ color: T.text }}>📊 お金の流れ（図解）</p>
              <div className="space-y-2">
                {/* 申告しない場合 */}
                <div className="p-3 rounded-xl" style={{ backgroundColor: red + "08", border: `1px solid ${red}33` }}>
                  <p className="text-[10px] font-medium mb-1" style={{ color: red }}>❌ 申告しない場合（無申告）</p>
                  <div className="space-y-1 text-[9px]" style={{ color: T.textSub }}>
                    <p>年間報酬 ¥3,600,000（日バック¥20,000 × 月15日 × 12ヶ月）</p>
                    <p style={{ color: red }}>　→ 税務署から見て「経費ゼロ」の扱い</p>
                    <p style={{ color: red }}>　→ 無申告がバレた場合、加算税15〜20% + 延滞税</p>
                    <p style={{ color: red }}>　→ 国民健康保険料が「所得不明 = 最高額」に</p>
                    <p style={{ color: T.textMuted }}>　→ <b>美容費・衣装代・交通費などの経費は一切考慮されない！</b></p>
                  </div>
                </div>
                {/* 申告した場合 */}
                <div className="p-3 rounded-xl" style={{ backgroundColor: green + "08", border: `1px solid ${green}33` }}>
                  <p className="text-[10px] font-medium mb-1" style={{ color: green }}>✅ 確定申告すると</p>
                  <div className="space-y-1 text-[9px]" style={{ color: T.textSub }}>
                    <p>年間報酬 ¥3,600,000（日バック¥20,000 × 月15日 × 12ヶ月）</p>
                    <p style={{ color: green }}>　→ 自己負担経費を引く（美容・衣装等 −¥500,000）</p>
                    <p style={{ color: green }}>　→ 備品・リネン代を引く（¥500×180日 = −¥90,000）</p>
                    <p style={{ color: green }}>　→ 青色控除を引く（−¥650,000）</p>
                    <p style={{ color: green }}>　→ 基礎控除を引く（−¥950,000〜）</p>
                    <p>　→ 課税所得は<b style={{ color: green }}>大幅に圧縮</b></p>
                    <p>　→ 所得税は<b style={{ color: green }}>10万円以下</b>に収まることも</p>
                    <p className="mt-1 text-[10px] font-medium" style={{ color: green }}>
                      💰 経費をしっかり計上すれば、納税額は最小化できる！
                    </p>
                  </div>
                </div>
              </div>
              <p className="text-[8px] mt-2" style={{ color: T.textMuted }}>
                ※ 上記は概算例です。実際の金額はあなたの収入・経費・控除によって変わります。
              </p>
            </div>

            {/* メリット一覧 */}
            <div style={{ ...altCard, marginBottom: "12px" }}>
              <p className="text-[11px] font-medium mb-2" style={{ color: green }}>✅ 確定申告するメリット</p>
              <ul className="space-y-1.5">
                {[
                  "経費を引いて「本来の税額」で計算される（節税できる）",
                  "青色申告なら最大65万円の追加控除",
                  "国民健康保険料が安くなる（所得が下がるため）",
                  "社会的信用UP（ローン・賃貸審査が通りやすい）",
                  "他店で源泉徴収されていれば、還付金が戻る場合も",
                  "無申告のペナルティ（加算税・延滞税）を避けられる",
                ].map((t, i) => (
                  <li key={i} className="text-[11px] flex gap-1.5" style={{ color: T.textSub }}>
                    <span style={{ color: green }}>✓</span>{t}
                  </li>
                ))}
              </ul>
            </div>

            <div style={{ ...altCard, marginBottom: "12px", borderLeft: `3px solid ${red}` }}>
              <p className="text-[11px] font-medium mb-2" style={{ color: red }}>❌ 申告しないとどうなる？</p>
              <ul className="space-y-1.5">
                {[
                  "「経費ゼロ」前提の税額がそのまま請求される（大損！）",
                  "無申告がバレると加算税15〜20% + 延滞税",
                  "国民健康保険料が所得不明で最高額に",
                  "住宅ローン・クレジットカードの審査に不利",
                ].map((t, i) => (
                  <li key={i} className="text-[11px] flex gap-1.5" style={{ color: T.textSub }}>
                    <span style={{ color: red }}>✗</span>{t}
                  </li>
                ))}
              </ul>
            </div>

            {/* 節税シミュレーター */}
            <button onClick={() => setShowCalc(!showCalc)} style={{ ...altCard, width: "100%", cursor: "pointer", textAlign: "left", border: `1px solid ${green}44` }}>
              <p className="text-[12px] font-medium" style={{ color: green }}>💰 節税シミュレーター {showCalc ? "▲" : "▼"}</p>
              <p className="text-[10px] mt-0.5" style={{ color: T.textMuted }}>あなたの収入と経費を入力すると、節税額の目安が分かります！</p>
            </button>
            {showCalc && (
              <div className="mt-3 space-y-3" style={{ ...altCard, border: `1px solid ${green}44` }}>
                <div>
                  <label className="block text-[10px] mb-1" style={{ color: T.textSub }}>年間の報酬合計（お店からもらうバックの合計）</label>
                  <div className="flex gap-2 flex-wrap">
                    {[1500000, 2000000, 3000000, 4000000, 5000000].map(v => (
                      <button key={v} onClick={() => setCalcIncome(String(v))} className="px-2 py-1 text-[9px] rounded-lg cursor-pointer"
                        style={{ backgroundColor: calcIncome === String(v) ? pinkLight : T.card, color: calcIncome === String(v) ? pink : T.textMuted, border: `1px solid ${calcIncome === String(v) ? pink : T.border}` }}>
                        {(v/10000).toFixed(0)}万円
                      </button>
                    ))}
                  </div>
                  <input type="number" value={calcIncome} onChange={e => setCalcIncome(e.target.value)} placeholder="直接入力も可（例: 3000000）"
                    className="w-full px-3 py-2 rounded-xl text-[12px] outline-none mt-1" style={{ backgroundColor: T.card, color: T.text, border: `1px solid ${T.border}` }} />
                </div>
                <div>
                  <label className="block text-[10px] mb-1" style={{ color: T.textSub }}>年間の出勤日数</label>
                  <div className="flex gap-2 flex-wrap">
                    {[120, 150, 180, 200, 240].map(v => (
                      <button key={v} onClick={() => setCalcDays(String(v))} className="px-2 py-1 text-[9px] rounded-lg cursor-pointer"
                        style={{ backgroundColor: calcDays === String(v) ? pinkLight : T.card, color: calcDays === String(v) ? pink : T.textMuted, border: `1px solid ${calcDays === String(v) ? pink : T.border}` }}>
                        {v}日（月{Math.round(v/12)}日）
                      </button>
                    ))}
                  </div>
                  <input type="number" value={calcDays} onChange={e => setCalcDays(e.target.value)} placeholder="直接入力も可（例: 180）"
                    className="w-full px-3 py-2 rounded-xl text-[12px] outline-none mt-1" style={{ backgroundColor: T.card, color: T.text, border: `1px solid ${T.border}` }} />
                </div>
                <div>
                  <label className="block text-[10px] mb-1" style={{ color: T.textSub }}>年間の自己負担経費（美容費・衣装代など。厚生費・交通費は自動計算）</label>
                  <div className="flex gap-2 flex-wrap">
                    {[200000, 300000, 500000, 800000, 1000000].map(v => (
                      <button key={v} onClick={() => setCalcExpense(String(v))} className="px-2 py-1 text-[9px] rounded-lg cursor-pointer"
                        style={{ backgroundColor: calcExpense === String(v) ? pinkLight : T.card, color: calcExpense === String(v) ? pink : T.textMuted, border: `1px solid ${calcExpense === String(v) ? pink : T.border}` }}>
                        {(v/10000).toFixed(0)}万円
                      </button>
                    ))}
                  </div>
                  <input type="number" value={calcExpense} onChange={e => setCalcExpense(e.target.value)} placeholder="直接入力も可（例: 500000）"
                    className="w-full px-3 py-2 rounded-xl text-[12px] outline-none mt-1" style={{ backgroundColor: T.card, color: T.text, border: `1px solid ${T.border}` }} />
                </div>
                <div>
                  <label className="block text-[10px] mb-1" style={{ color: T.textSub }}>インボイス登録していますか？</label>
                  <div className="flex gap-2">
                    <button onClick={() => setCalcHasInvoice(true)} className="px-3 py-1.5 text-[10px] rounded-lg cursor-pointer"
                      style={{ backgroundColor: calcHasInvoice ? green + "20" : "transparent", color: calcHasInvoice ? green : T.textMuted, border: `1px solid ${calcHasInvoice ? green : T.border}` }}>登録済み</button>
                    <button onClick={() => setCalcHasInvoice(false)} className="px-3 py-1.5 text-[10px] rounded-lg cursor-pointer"
                      style={{ backgroundColor: !calcHasInvoice ? red + "20" : "transparent", color: !calcHasInvoice ? red : T.textMuted, border: `1px solid ${!calcHasInvoice ? red : T.border}` }}>未登録（バック10%が控除されている）</button>
                  </div>
                </div>
                {calcIncome && (() => {
                  const c = calcSaving();
                  return (
                    <div className="space-y-2">
                      {/* お店からの天引き合計 (Ange Spa は源泉なし、インボイス控除のみ) */}
                      {c.invoiceDed > 0 ? (
                        <div className="p-3 rounded-xl" style={{ backgroundColor: red + "08", border: `1px solid ${red}33` }}>
                          <p className="text-[9px] mb-1" style={{ color: T.textMuted }}>お店から天引きされている分</p>
                          <p className="text-[8px]" style={{ color: T.textMuted }}>インボイス控除（10%）: {fmt(c.invoiceDed)}</p>
                          <p className="text-[8px]" style={{ color: T.textMuted }}>源泉徴収: ¥0（Ange Spa は源泉徴収なし）</p>
                          <p className="text-[16px] font-medium mt-1" style={{ color: red }}>天引き合計 {fmt(c.invoiceDed)}</p>
                          <p className="text-[8px] mt-1" style={{ color: T.textMuted }}>
                            ※ インボイスに登録すると、この10%控除はなくなります（2割特例で実質2%）
                          </p>
                        </div>
                      ) : (
                        <div className="p-3 rounded-xl" style={{ backgroundColor: green + "08", border: `1px solid ${green}33` }}>
                          <p className="text-[9px] mb-1" style={{ color: T.textMuted }}>お店から天引きされている分</p>
                          <p className="text-[8px]" style={{ color: T.textMuted }}>インボイス控除: ¥0（登録済み）</p>
                          <p className="text-[8px]" style={{ color: T.textMuted }}>源泉徴収: ¥0（Ange Spa は源泉徴収なし）</p>
                          <p className="text-[14px] font-medium mt-1" style={{ color: green }}>天引きはありません</p>
                        </div>
                      )}
                      {/* 計算過程 */}
                      <div className="space-y-1">
                        {[
                          ["報酬合計", fmt(c.income), T.text],
                          ...(c.days > 0 ? [["＋ 交通費支給（¥2,000×" + c.days + "日）", fmt(c.transportIncome), T.text]] : []),
                          ["＝ 総収入", fmt(c.totalIncome), T.text],
                          ["", "", ""],
                          ["自己負担経費", "−" + fmt(c.expense), red],
                          ...(c.days > 0 ? [["備品・リネン代（¥500×" + c.days + "日）", "−" + fmt(c.welfareFee), red]] : []),
                          ...(c.days > 0 ? [["交通費（実費¥2,000×" + c.days + "日）", "−" + fmt(c.days * 2000), red]] : []),
                          ["＝ 経費合計", "−" + fmt(c.totalExpense), red],
                          ["", "", ""],
                          ["差引金額（総収入−経費）", fmt(c.profit), T.text],
                          ["− 青色申告特別控除", "−¥650,000", green],
                          ["− 基礎控除", "−¥480,000", green],
                          ["＝ 本来の税額（所得税＋復興税）", fmt(c.aoiroTotal), T.text],
                        ].filter(([l]) => l !== undefined).map(([label, val, color], i) => (
                          label === "" ? <div key={i} style={{ height: "4px" }} /> :
                          <div key={i} className="flex justify-between py-0.5" style={{ borderBottom: `1px solid ${T.border}08` }}>
                            <span className="text-[9px]" style={{ color: T.textSub }}>{label}</span>
                            <span className="text-[9px] font-medium" style={{ color: color as string }}>{val}</span>
                          </div>
                        ))}
                      </div>
                      {/* 節税効果 */}
                      <div className="rounded-2xl p-4 text-center" style={{ background: `linear-gradient(135deg, ${green}20, ${green}08)`, border: `1px solid ${green}44` }}>
                        <p className="text-[9px]" style={{ color: T.textMuted }}>申告しない場合の税額 {fmt(c.noExpenseTotal)} − 経費計上した税額 {fmt(c.aoiroTotal)}</p>
                        <p className="text-[10px] mt-1" style={{ color: green }}>💰 経費を計上することによる節税額</p>
                        <p className="text-[28px] font-medium" style={{ color: green }}>{fmt(c.taxSaving)}</p>
                        <p className="text-[9px] mt-1" style={{ color: T.text }}>
                          → 実際の納税額：<b style={{ color: green }}>{fmt(c.aoiroTotal)}</b>
                        </p>
                        {c.healthSaving > 0 && (
                          <p className="text-[9px] mt-1" style={{ color: T.textMuted }}>
                            ＋ 国民健康保険料も約{fmt(c.healthSaving)}安くなる → 合計 <b style={{ color: green }}>{fmt(c.totalBenefit)}お得！</b>
                          </p>
                        )}
                      </div>
                      {c.taxSaving > 0 && (
                        <p className="text-[10px] text-center" style={{ color: T.textMuted }}>
                          月に換算すると約<b style={{ color: green }}>{fmt(Math.round(c.taxSaving / 12))}</b>の節税！
                        </p>
                      )}
                      {profile.isSingleParent && (
                        <div className="rounded-xl p-3 mt-2" style={{ backgroundColor: "#0d948810", border: "1px solid #0d948833" }}>
                          <p className="text-[9px] font-medium" style={{ color: "#0d9488" }}>
                            🌸 さらに「ひとり親控除」で所得税・住民税合わせて約5〜8万円/年の追加節税！
                          </p>
                          <p className="text-[8px]" style={{ color: T.textMuted }}>
                            上記の節税額に加え、ひとり親控除（所得税38万円＋住民税33万円）で追加の節税が見込めます。
                          </p>
                        </div>
                      )}
                      <p className="text-[7px]" style={{ color: T.textMuted }}>※概算です。社会保険料控除等は含みません。実際はT-MANAGEの帳簿データに基づいて正確に計算されます。他店で源泉徴収されている場合、その分は還付として戻ってくる可能性があります。</p>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>

          {/* ガイドページへの誘導 */}
          <div style={{ ...cardBase, padding: "16px" }}>
            <p className="text-[11px] font-medium mb-2" style={{ color: T.text }}>📚 詳しくはガイドページもご覧ください</p>
            <div className="space-y-1.5">
              {[
                { href: "/mypage/tax-guide", icon: "🔒", label: "副業がバレない 完全ガイド", color: pink },
                { href: "/mypage/spouse-guide", icon: "💑", label: "配偶者控除・扶養 完全ガイド", color: "#8b6cb7" },
                { href: "/mypage/invoice-guide", icon: "💎", label: "インボイス登録ガイド", color: "#c3a782" },
                { href: "/mypage/single-mother-guide", icon: "🌸", label: "シングルマザー 完全サポートガイド", color: "#0d9488" },
              ].map((g) => (
                <a key={g.href} href={g.href} className="flex items-center gap-2 p-2 rounded-lg cursor-pointer" style={{ backgroundColor: g.color + "10", border: `1px solid ${g.color}33`, textDecoration: "none" }}>
                  <span style={{ fontSize: 16 }}>{g.icon}</span>
                  <span className="text-[10px] font-medium" style={{ color: g.color }}>{g.label}</span>
                  <span className="ml-auto text-[10px]" style={{ color: g.color }}>→</span>
                </a>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <button onClick={() => { saveStatus({ ...stepStatus, 0: "done" }); setStep(1); }} style={btnPink}>理解した！次へ →</button>
          </div>
        </div>
      )}

      {/* ============== Step 1: 状況確認 ============== */}
      {step === 1 && (
        <div className="space-y-3">
          <div style={{ ...cardBase, padding: "20px" }}>
            <h2 className="text-[14px] font-medium mb-1" style={{ color: T.text }}>📋 あなたの状況を教えてください</h2>
            <p className="text-[10px] mb-4" style={{ color: T.textMuted }}>回答に応じて、必要な手続きをご案内します</p>

            {/* Q1: 副業？ */}
            <div className="mb-4">
              <p className="text-[12px] font-medium mb-2" style={{ color: T.text }}>Q1. セラピストの仕事は副業ですか？</p>
              <div className="flex gap-2">
                <button onClick={() => saveProfile({ ...profile, isSubJob: true })} style={yesNoBtn(profile.isSubJob, true)}>はい（副業）</button>
                <button onClick={() => saveProfile({ ...profile, isSubJob: false })} style={yesNoBtn(profile.isSubJob, false)}>いいえ（本業）</button>
              </div>
              {profile.isSubJob === true && (
                <div className="mt-2 p-3 rounded-xl" style={{ backgroundColor: orange + "10", border: `1px solid ${orange}33` }}>
                  <button onClick={() => setExpandedFaq(0)} className="w-full text-left text-[10px] cursor-pointer" style={{ color: orange, background: "none", border: "none", padding: 0 }}>⚠️ 副業の場合は「住民税の普通徴収」が重要です！（<u>タップしてFAQを見る</u>）</button>
                </div>
              )}
            </div>

            {/* Q2: 年間収入 */}
            <div className="mb-4">
              <p className="text-[12px] font-medium mb-2" style={{ color: T.text }}>Q2. セラピストの年間収入は？（おおよそ）</p>
              <div className="flex flex-wrap gap-1.5">
                {["〜48万", "48〜100万", "100〜300万", "300〜500万", "500万〜"].map(v => (
                  <button key={v} onClick={() => saveProfile({ ...profile, annualIncome: v })}
                    className="px-3 py-2 text-[11px] rounded-xl cursor-pointer"
                    style={{ backgroundColor: profile.annualIncome === v ? pinkLight : "transparent", color: profile.annualIncome === v ? pink : T.textMuted, border: `1px solid ${profile.annualIncome === v ? pink : T.border}` }}>
                    {v}
                  </button>
                ))}
              </div>
              {profile.annualIncome === "〜48万" && (
                <p className="text-[10px] mt-2" style={{ color: green }}>
                  ✅ 所得48万円以下の場合、確定申告は不要ですが、住民税の申告は必要です。経費を引いて48万以下なら所得税は0円です。
                </p>
              )}
            </div>

            {/* Q3: 副業の場合の本業収入 */}
            {profile.isSubJob === true && (
              <div className="mb-4">
                <p className="text-[12px] font-medium mb-2" style={{ color: T.text }}>Q3. 本業の年収は？（副業バレ判定用）</p>
                <div className="flex flex-wrap gap-1.5">
                  {["〜500万", "500〜900万", "900万〜"].map(v => (
                    <button key={v} onClick={() => saveProfile({ ...profile, mainJobIncome: v })}
                      className="px-3 py-2 text-[11px] rounded-xl cursor-pointer"
                      style={{ backgroundColor: profile.mainJobIncome === v ? pinkLight : "transparent", color: profile.mainJobIncome === v ? pink : T.textMuted, border: `1px solid ${profile.mainJobIncome === v ? pink : T.border}` }}>
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Q4: 配偶者 */}
            <div className="mb-4">
              <p className="text-[12px] font-medium mb-2" style={{ color: T.text }}>{profile.isSubJob ? "Q4" : "Q3"}. 配偶者（パートナー）はいますか？</p>
              <div className="flex gap-2">
                <button onClick={() => saveProfile({ ...profile, hasSpouse: true })} style={yesNoBtn(profile.hasSpouse, true)}>はい</button>
                <button onClick={() => saveProfile({ ...profile, hasSpouse: false })} style={yesNoBtn(profile.hasSpouse, false)}>いいえ</button>
              </div>
              {profile.hasSpouse === true && (
                <div className="mt-2 p-3 rounded-xl" style={{ backgroundColor: T.cardAlt }}>
                  <p className="text-[10px] mb-1" style={{ color: T.textSub }}>配偶者の扶養に入っている場合、所得が増えると外れる可能性があります。</p>
                  <p className="text-[10px]" style={{ color: orange }}>→ 経費をしっかり計上すれば、収入が多くても所得を抑えられます！</p>
                </div>
              )}
            </div>

            {/* Q: 学生？ */}
            <div className="mb-4">
              <p className="text-[12px] font-medium mb-2" style={{ color: T.text }}>学生ですか？</p>
              <div className="flex gap-2">
                <button onClick={() => saveProfile({ ...profile, isStudent: true })} style={yesNoBtn(profile.isStudent, true)}>はい（学生）</button>
                <button onClick={() => saveProfile({ ...profile, isStudent: false })} style={yesNoBtn(profile.isStudent, false)}>いいえ</button>
              </div>
            </div>

            {/* Q: 家族の扶養に入っている？ */}
            <div className="mb-4">
              <p className="text-[12px] font-medium mb-2" style={{ color: T.text }}>家族の扶養（ふよう）に入っていますか？</p>
              <p className="text-[9px] mb-2" style={{ color: T.textMuted }}>親・配偶者・家族の健康保険に入っている、または税金の扶養控除の対象になっている場合</p>
              <div className="flex gap-2">
                <button onClick={() => saveProfile({ ...profile, isDependent: true })} style={yesNoBtn(profile.isDependent, true)}>はい（扶養内）</button>
                <button onClick={() => saveProfile({ ...profile, isDependent: false })} style={yesNoBtn(profile.isDependent, false)}>いいえ / わからない</button>
              </div>
              {profile.isDependent === true && (
                <div className="mt-3 p-3 rounded-xl" style={{ backgroundColor: orange + "10", border: `1px solid ${orange}33` }}>
                  <p className="text-[11px] font-medium mb-2" style={{ color: orange }}>⚠️ 扶養に入っている方の注意点</p>
                  <div className="space-y-2">
                    <div className="p-2 rounded-lg" style={{ backgroundColor: T.card }}>
                      <p className="text-[9px] font-medium" style={{ color: red }}>🔴 税金の扶養（扶養控除）</p>
                      <p className="text-[9px]" style={{ color: T.textSub }}>
                        あなたの<b>合計所得（収入−経費）が48万円</b>を超えると、親や配偶者の扶養控除から外れます。
                        外れると、親や配偶者の税金が増えます。
                      </p>
                      <p className="text-[8px] mt-1" style={{ color: green }}>💡 経費をしっかり計上すれば「収入が多くても所得は48万以下」にできることも！</p>
                    </div>
                    <div className="p-2 rounded-lg" style={{ backgroundColor: T.card }}>
                      <p className="text-[9px] font-medium" style={{ color: red }}>🔴 健康保険の扶養（社会保険）</p>
                      <p className="text-[9px]" style={{ color: T.textSub }}>
                        年間収入が<b>130万円</b>を超えると、家族の社会保険の扶養から外れ、自分で国民健康保険に加入する必要があります。
                      </p>
                      <p className="text-[8px] mt-1" style={{ color: T.textMuted }}>※健康保険組合によって基準が異なる場合があります。事前に確認を。</p>
                    </div>
                    {profile.isStudent && (
                      <div className="p-2 rounded-lg" style={{ backgroundColor: T.card }}>
                        <p className="text-[9px] font-medium" style={{ color: "#2563eb" }}>📚 学生の場合の特別ルール</p>
                        <p className="text-[9px]" style={{ color: T.textSub }}>
                          「勤労学生控除（27万円）」がありますが、セラピストの収入は<b>事業所得</b>のため、事業所得が10万円を超えると使えません。
                        </p>
                        <p className="text-[8px] mt-1" style={{ color: T.textSub }}>
                          学生さんが扶養内で働くなら：<b style={{ color: green }}>収入−経費 ≤ 48万円</b> を目安にしましょう。
                        </p>
                      </div>
                    )}
                    <div className="p-2.5 rounded-lg" style={{ backgroundColor: green + "10" }}>
                      <p className="text-[9px] font-medium" style={{ color: green }}>✅ 結論：扶養内で働きたい場合</p>
                      <p className="text-[9px]" style={{ color: T.textSub }}>
                        ① 年間の収入から経費を引いた「所得」を<b>48万円以下</b>に抑える{"\n"}
                        ② 経費をしっかり記録・計上する（美容費・衣装代・交通費など）{"\n"}
                        ③ 健康保険の扶養は<b>年間収入130万円</b>が目安{"\n"}
                        ④ 確定申告は必須（Ange Spaは源泉徴収なしのため、自分で納税）
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Q: ひとり親？（シングルマザー/ファザー） */}
            <div className="mb-4">
              <p className="text-[12px] font-medium mb-2" style={{ color: T.text }}>ひとり親（シングルマザー/ファザー）ですか？</p>
              <p className="text-[9px] mb-2" style={{ color: T.textMuted }}>お子さんを一人で育てている場合、「ひとり親控除」や手当が受けられます</p>
              <div className="flex gap-2">
                <button onClick={() => saveProfile({ ...profile, isSingleParent: true })} style={yesNoBtn(profile.isSingleParent, true)}>はい</button>
                <button onClick={() => saveProfile({ ...profile, isSingleParent: false })} style={yesNoBtn(profile.isSingleParent, false)}>いいえ</button>
              </div>
              {profile.isSingleParent === true && (
                <div className="mt-3 p-3 rounded-xl" style={{ backgroundColor: "#0d948810", border: "1px solid #0d948833" }}>
                  <p className="text-[11px] font-medium mb-2" style={{ color: "#0d9488" }}>🌸 ひとり親のあなたへ — 使える制度がたくさんあります！</p>
                  <div className="space-y-2">
                    <div className="p-2 rounded-lg" style={{ backgroundColor: T.card }}>
                      <p className="text-[9px] font-medium" style={{ color: green }}>💰 ひとり親控除（2026年〜拡充）</p>
                      <p className="text-[9px]" style={{ color: T.textSub }}>
                        所得税<b>38万円</b>＋住民税<b>33万円</b>が控除されます。{"\n"}
                        確定申告で申告するだけで<b>年間約5〜8万円の節税</b>に！{"\n"}
                        所得要件も<b>1,000万円以下</b>に緩和されました。
                      </p>
                    </div>
                    <div className="p-2 rounded-lg" style={{ backgroundColor: T.card }}>
                      <p className="text-[9px] font-medium" style={{ color: pink }}>👶 児童扶養手当（国の制度）</p>
                      <p className="text-[9px]" style={{ color: T.textSub }}>
                        子ども1人で最大<b>月48,050円</b>支給。{"\n"}
                        経費をしっかり計上して所得を下げれば受給額UP！
                      </p>
                    </div>
                    <div className="p-2 rounded-lg" style={{ backgroundColor: T.card }}>
                      <p className="text-[9px] font-medium" style={{ color: orange }}>🏛️ 愛知県遺児手当 + 市の手当</p>
                      <p className="text-[9px]" style={{ color: T.textSub }}>
                        愛知県遺児手当（月4,350円〜）＋市独自の手当も。{"\n"}
                        児童扶養手当と<b>同時に受給OK</b>！
                      </p>
                    </div>
                    <div className="p-2 rounded-lg" style={{ backgroundColor: T.card }}>
                      <p className="text-[9px] font-medium" style={{ color: red }}>🏥 医療費助成 + 保育料無償化</p>
                      <p className="text-[9px]" style={{ color: T.textSub }}>
                        ひとり親家庭の医療費助成、3〜5歳の保育料無料、{"\n"}
                        国民年金の免除制度なども利用できます。
                      </p>
                    </div>
                    <a href="/mypage/single-mother-guide" className="flex items-center gap-2 p-2.5 rounded-lg cursor-pointer" style={{ backgroundColor: "#0d948815", border: "1px solid #0d948833", textDecoration: "none" }}>
                      <span style={{ fontSize: 16 }}>🌸</span>
                      <span className="text-[10px] font-medium" style={{ color: "#0d9488" }}>シングルマザー完全サポートガイドを見る</span>
                      <span className="ml-auto text-[10px]" style={{ color: "#0d9488" }}>→</span>
                    </a>
                  </div>
                </div>
              )}
            </div>

            {/* Q: 開業届 */}
            <div className="mb-4">
              <p className="text-[12px] font-medium mb-2" style={{ color: T.text }}>開業届は出していますか？</p>
              <div className="flex gap-2">
                <button onClick={() => saveProfile({ ...profile, hasKaigyou: true })} style={yesNoBtn(profile.hasKaigyou, true)}>出した</button>
                <button onClick={() => saveProfile({ ...profile, hasKaigyou: false })} style={yesNoBtn(profile.hasKaigyou, false)}>まだ</button>
              </div>
            </div>

            {/* 判定結果 */}
            {profile.annualIncome && profile.hasKaigyou !== null && (
              <div className="mt-4 p-4 rounded-2xl" style={{ background: `linear-gradient(135deg, ${pink}10, ${pink}05)`, border: `1px solid ${pinkBorder}` }}>
                <p className="text-[12px] font-medium mb-2" style={{ color: pink }}>📌 あなたに必要な手続き</p>
                <div className="space-y-1.5">
                  {!profile.hasKaigyou && (
                    <button onClick={() => setStep(2)} className="w-full text-left text-[11px] flex gap-1.5 py-1 cursor-pointer" style={{ color: T.textSub, background: "none", border: "none" }}>
                      <span style={{ color: red }}>●</span> <b>開業届の提出</b>が必要です → <u style={{ color: pink }}>開業届ステップへ</u>
                    </button>
                  )}
                  <button onClick={() => setStep(3)} className="w-full text-left text-[11px] flex gap-1.5 py-1 cursor-pointer" style={{ color: T.textSub, background: "none", border: "none" }}>
                    <span style={{ color: orange }}>●</span> <b>青色申告</b>がおすすめ → <u style={{ color: pink }}>青色/白色ステップへ</u>
                  </button>
                  <button onClick={() => setStep(5)} className="w-full text-left text-[11px] flex gap-1.5 py-1 cursor-pointer" style={{ color: T.textSub, background: "none", border: "none" }}>
                    <span style={{ color: pink }}>●</span> <b>経費の整理</b>をしましょう → <u style={{ color: pink }}>経費整理ステップへ</u>
                  </button>
                  {profile.isSubJob && (
                    <button onClick={() => setExpandedFaq(0)} className="w-full text-left text-[11px] flex gap-1.5 py-1 cursor-pointer" style={{ color: T.textSub, background: "none", border: "none" }}>
                      <span style={{ color: green }}>●</span> <b>住民税は普通徴収</b>で会社バレ防止 → <u style={{ color: pink }}>FAQを見る</u>
                    </button>
                  )}
                  {profile.isDependent && (
                    <button onClick={() => setStep(5)} className="w-full text-left text-[11px] flex gap-1.5 py-1 cursor-pointer" style={{ color: T.textSub, background: "none", border: "none" }}>
                      <span style={{ color: orange }}>●</span> <b>扶養内で働くなら所得48万円以下</b>を意識 → <u style={{ color: pink }}>経費整理で節税</u>
                    </button>
                  )}
                  {profile.isStudent && (
                    <button onClick={() => setExpandedFaq(1)} className="w-full text-left text-[11px] flex gap-1.5 py-1 cursor-pointer" style={{ color: T.textSub, background: "none", border: "none" }}>
                      <span style={{ color: "#2563eb" }}>●</span> <b>学生</b>：扶養控除の条件を確認 → <u style={{ color: pink }}>FAQで詳しく</u>
                    </button>
                  )}
                  {profile.isSingleParent && (
                    <a href="/mypage/single-mother-guide" className="w-full text-left text-[11px] flex gap-1.5 py-1 cursor-pointer" style={{ color: T.textSub, background: "none", border: "none", textDecoration: "none" }}>
                      <span style={{ color: "#0d9488" }}>●</span> <b>ひとり親控除38万円</b> + 手当の申請を → <u style={{ color: "#0d9488" }}>サポートガイドへ</u>
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={() => setStep(0)} style={btnOutline}>← 戻る</button>
            <button onClick={() => { saveStatus({ ...stepStatus, 1: "done" }); setStep(profile.hasKaigyou ? 3 : 2); }} style={btnPink}>
              {profile.hasKaigyou ? "開業届済み → 青色/白色へ" : "次へ →"}
            </button>
          </div>
        </div>
      )}

      {/* ============== Step 2: 開業届 ============== */}
      {step === 2 && (
        <div className="space-y-3">
          <div style={{ ...cardBase, padding: "20px" }}>
            <h2 className="text-[14px] font-medium mb-1" style={{ color: T.text }}>📝 開業届の出し方</h2>
            <p className="text-[10px] mb-4" style={{ color: T.textMuted }}>個人事業を始めたら原則1ヶ月以内に提出。でも遅れても罰則なし！今からでもOK</p>

            {/* ダウンロードボタン */}
            <div className="space-y-2 mb-4">
              <a href="https://www.nta.go.jp/taxes/tetsuzuki/shinsei/annai/shinkoku/pdf/h28/05.pdf" target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 rounded-xl cursor-pointer" style={{ backgroundColor: "#dc262620", border: "1px solid #dc262644", textDecoration: "none" }}>
                <span className="text-[24px]">📄</span>
                <div className="flex-1">
                  <p className="text-[11px] font-medium" style={{ color: "#dc2626" }}>開業届 PDFダウンロード</p>
                  <p className="text-[8px]" style={{ color: T.textMuted }}>国税庁公式「個人事業の開業・廃業等届出書」</p>
                </div>
                <span className="text-[10px]" style={{ color: "#dc2626" }}>↗</span>
              </a>
              <a href="https://www.nta.go.jp/taxes/tetsuzuki/shinsei/annai/shinkoku/annai/09.htm" target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 rounded-xl cursor-pointer" style={{ backgroundColor: "#2563eb20", border: "1px solid #2563eb44", textDecoration: "none" }}>
                <span className="text-[24px]">📘</span>
                <div className="flex-1">
                  <p className="text-[11px] font-medium" style={{ color: "#2563eb" }}>青色申告承認申請書 PDFダウンロード</p>
                  <p className="text-[8px]" style={{ color: T.textMuted }}>開業届と一緒に提出がベスト！</p>
                </div>
                <span className="text-[10px]" style={{ color: "#2563eb" }}>↗</span>
              </a>
              <a href="https://www.e-tax.nta.go.jp/" target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 rounded-xl cursor-pointer" style={{ backgroundColor: green + "15", border: `1px solid ${green}44`, textDecoration: "none" }}>
                <span className="text-[24px]">💻</span>
                <div className="flex-1">
                  <p className="text-[11px] font-medium" style={{ color: green }}>e-Tax（電子申告）で提出</p>
                  <p className="text-[8px]" style={{ color: T.textMuted }}>マイナンバーカード＋スマホで自宅から提出可能（おすすめ！）</p>
                </div>
                <span className="text-[10px]" style={{ color: green }}>↗</span>
              </a>
            </div>

            {/* 必要なもの */}
            <div style={altCard} className="mb-3">
              <p className="text-[11px] font-medium mb-2" style={{ color: T.text }}>📋 必要なもの</p>
              <ul className="space-y-1">
                {["マイナンバーカード（または通知カード＋身分証明書）", "印鑑（認印でOK・e-Taxなら不要）", "開業届の用紙（上のボタンからDL or 税務署で入手）"].map((t, i) => (
                  <li key={i} className="text-[10px] flex gap-1.5" style={{ color: T.textSub }}><span style={{ color: pink }}>•</span>{t}</li>
                ))}
              </ul>
            </div>

            {/* ===== 開業届の記入ガイド ===== */}
            <div style={{ ...altCard, border: `1px solid ${pink}44` }} className="mb-3">
              <p className="text-[12px] font-medium mb-3" style={{ color: pink }}>✍️ 開業届の記入ガイド（セラピスト用）</p>
              <p className="text-[9px] mb-3" style={{ color: T.textMuted }}>「個人事業の開業・廃業等届出書」の各項目の書き方です</p>

              {/* フォーム風ビジュアル */}
              <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${T.border}`, backgroundColor: T.card }}>
                {/* ヘッダー */}
                <div className="p-2 text-center" style={{ backgroundColor: "#f8f0f2", borderBottom: `1px solid ${T.border}` }}>
                  <p className="text-[10px] font-medium" style={{ color: "#333" }}>個人事業の開業・廃業等届出書</p>
                  <p className="text-[7px]" style={{ color: "#999" }}>（正式名称）</p>
                </div>

                {/* 各項目 */}
                {[
                  { num: "①", field: "提出先", example: "○○税務署長", guide: "自宅住所を管轄する税務署名を記入", tip: "国税庁HPの「税務署の所在地」で検索できます" },
                  { num: "②", field: "提出日", example: "令和○年○月○日", guide: "届出書を提出する日を記入", tip: "" },
                  { num: "③", field: "納税地", example: "自宅の住所", guide: "住所（自宅）を記入。事業所がある場合はそちらでもOK", tip: "基本は自宅住所でOK" },
                  { num: "④", field: "氏名・生年月日", example: "本名を記入", guide: "戸籍上の本名・フリガナ・生年月日を記入", tip: "源氏名ではなく本名で" },
                  { num: "⑤", field: "個人番号", example: "マイナンバー12桁", guide: "マイナンバーカードまたは通知カードの番号", tip: "" },
                  { num: "⑥", field: "職業", example: "リラクゼーション業", guide: "自由記述。下記の例から選んでください", tip: "「エステティシャン」「ボディケア業」「リラクゼーション業」など" },
                  { num: "⑦", field: "屆出の区分", example: "開業 にチェック ✓", guide: "「開業」にチェックを入れる", tip: "" },
                  { num: "⑧", field: "所得の種類", example: "事業所得 にチェック ✓", guide: "「事業（農業）所得」にチェック", tip: "" },
                  { num: "⑨", field: "開業日", example: "令和○年○月○日", guide: "実際に働き始めた日（過去の日付でもOK）", tip: "正確に覚えてなければ大体の日で大丈夫" },
                  { num: "⑩", field: "事業の概要", example: "ボディケア施術の提供", guide: "どんな仕事をするか簡単に記入", tip: "「ボディケア・トリートメント施術の提供」など" },
                  { num: "⑪", field: "青色申告の有無", example: "有 にチェック ✓", guide: "「有」にチェック → 青色申告承認申請書も一緒に提出！", tip: "65万円控除を受けるには「有」が必須" },
                  { num: "⑫", field: "給与の支払", example: "無 にチェック ✓", guide: "従業員がいなければ「無」でOK", tip: "" },
                ].map((item, i) => (
                  <div key={i} className="p-2.5" style={{ borderBottom: `1px solid ${T.border}` }}>
                    <div className="flex items-start gap-2">
                      <span className="text-[10px] font-medium flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: pink, color: "#fff" }}>{item.num}</span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[10px] font-medium" style={{ color: T.text }}>{item.field}</span>
                          <span className="text-[8px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "#f0f0f0", color: "#666" }}>記入例: {item.example}</span>
                        </div>
                        <p className="text-[9px]" style={{ color: T.textSub }}>{item.guide}</p>
                        {item.tip && <p className="text-[8px] mt-0.5" style={{ color: pink }}>💡 {item.tip}</p>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 提出方法 */}
            <div style={altCard} className="mb-3">
              <p className="text-[11px] font-medium mb-2" style={{ color: T.text }}>📤 提出方法（3つ）</p>
              <div className="space-y-2">
                <div className="p-2.5 rounded-lg" style={{ backgroundColor: green + "10", border: `1px solid ${green}33` }}>
                  <p className="text-[11px] font-medium" style={{ color: green }}>① e-Tax（おすすめ！）</p>
                  <p className="text-[9px]" style={{ color: T.textSub }}>マイナンバーカード＋スマホで自宅から提出。2025年から紙の収受印が廃止されたため、e-Taxが最も確実な提出証明になります。</p>
                </div>
                <div className="p-2 rounded-lg" style={{ backgroundColor: T.card }}>
                  <p className="text-[11px] font-medium" style={{ color: T.text }}>② 税務署に持参</p>
                  <p className="text-[9px]" style={{ color: T.textMuted }}>最寄りの税務署に直接提出。受付リーフレットをもらいましょう。</p>
                </div>
                <div className="p-2 rounded-lg" style={{ backgroundColor: T.card }}>
                  <p className="text-[11px] font-medium" style={{ color: T.text }}>③ 郵送</p>
                  <p className="text-[9px]" style={{ color: T.textMuted }}>税務署宛てに郵送。提出証明が残りにくいので注意。</p>
                </div>
              </div>
            </div>

            <div className="p-3 rounded-xl" style={{ backgroundColor: green + "10", border: `1px solid ${green}33` }}>
              <p className="text-[10px]" style={{ color: green }}>
                💡 開業届と一緒に「青色申告承認申請書」も提出するのがベスト！次のステップで説明します。
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setStep(1)} style={btnOutline}>← 戻る</button>
            <button onClick={() => { saveStatus({ ...stepStatus, 2: "done" }); saveProfile({ ...profile, hasKaigyou: true }); setStep(3); }} style={btnPink}>開業届を理解した → 次へ</button>
          </div>
        </div>
      )}

      {/* ============== Step 3: 青色/白色 ============== */}
      {step === 3 && (
        <div className="space-y-3">
          <div style={{ ...cardBase, padding: "20px" }}>
            <h2 className="text-[14px] font-medium mb-1" style={{ color: T.text }}>📘 青色申告 vs 白色申告</h2>
            <p className="text-[10px] mb-4" style={{ color: T.textMuted }}>結論：<b style={{ color: green }}>青色申告（65万円控除）</b>が圧倒的におすすめ！</p>

            {/* DLボタン */}
            <div className="space-y-2 mb-4">
              <a href="https://www.nta.go.jp/taxes/tetsuzuki/shinsei/annai/shinkoku/pdf/h28/10.pdf" target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 rounded-xl cursor-pointer" style={{ backgroundColor: "#2563eb20", border: "1px solid #2563eb44", textDecoration: "none" }}>
                <span className="text-[24px]">📘</span>
                <div className="flex-1">
                  <p className="text-[11px] font-medium" style={{ color: "#2563eb" }}>青色申告承認申請書 PDFダウンロード</p>
                  <p className="text-[8px]" style={{ color: T.textMuted }}>国税庁公式「所得税の青色申告承認申請書」</p>
                </div>
                <span className="text-[10px]" style={{ color: "#2563eb" }}>↗</span>
              </a>
            </div>

            {/* 比較表 */}
            <div className="rounded-xl overflow-hidden mb-4" style={{ border: `1px solid ${T.border}` }}>
              <div className="grid grid-cols-3 text-center">
                <div className="p-2" style={{ backgroundColor: T.cardAlt }}><span className="text-[9px]" style={{ color: T.textMuted }}>&nbsp;</span></div>
                <div className="p-2" style={{ backgroundColor: T.cardAlt }}><span className="text-[10px] font-medium" style={{ color: T.text }}>白色申告</span></div>
                <div className="p-2" style={{ backgroundColor: green + "15" }}><span className="text-[10px] font-medium" style={{ color: green }}>青色申告 ★</span></div>
              </div>
              {[
                ["特別控除", "なし", "最大65万円"],
                ["記帳方法", "単式簿記", "複式簿記"],
                ["帳簿の難易度", "簡単", "T-MANAGEで自動！"],
                ["赤字繰越し", "できない", "3年間OK"],
                ["家族の給与", "経費不可", "経費にできる"],
                ["事前届出", "不要", "要（開業2ヶ月以内）"],
                ["節税効果", "低い", "かなり大きい"],
              ].map(([label, white, blue], i) => (
                <div key={i} className="grid grid-cols-3 text-center" style={{ borderTop: `1px solid ${T.border}` }}>
                  <div className="p-2"><span className="text-[9px]" style={{ color: T.textSub }}>{label}</span></div>
                  <div className="p-2"><span className="text-[9px]" style={{ color: T.textMuted }}>{white}</span></div>
                  <div className="p-2" style={{ backgroundColor: green + "05" }}><span className="text-[9px] font-medium" style={{ color: green }}>{blue}</span></div>
                </div>
              ))}
            </div>

            {/* 具体的な節税額の例 */}
            <div className="p-3 rounded-xl mb-4" style={{ background: `linear-gradient(135deg, ${green}10, ${green}05)`, border: `1px solid ${green}33` }}>
              <p className="text-[11px] font-medium mb-2" style={{ color: green }}>💰 青色申告でどれくらい得する？（具体例）</p>
              <div className="space-y-1.5">
                {[
                  { income: "年収200万", white: "約7.2万", blue: "約3.9万", save: "約3.3万" },
                  { income: "年収300万", white: "約15.2万", blue: "約8.7万", save: "約6.5万" },
                  { income: "年収500万", white: "約37.2万", blue: "約24.5万", save: "約12.7万" },
                ].map((row, i) => (
                  <div key={i} className="flex items-center gap-2 text-[9px]">
                    <span className="font-medium" style={{ color: T.text, minWidth: "60px" }}>{row.income}</span>
                    <span style={{ color: red }}>白色 {row.white}</span>
                    <span>→</span>
                    <span style={{ color: green }}>青色 {row.blue}</span>
                    <span className="font-medium" style={{ color: green }}>（{row.save}お得！）</span>
                  </div>
                ))}
              </div>
              <p className="text-[7px] mt-1" style={{ color: T.textMuted }}>※経費50万円、基礎控除のみの概算。社会保険料等は含まず</p>
            </div>

            {/* 65万控除の3つの条件 */}
            <div style={{ ...altCard, border: `1px solid ${green}33` }} className="mb-3">
              <p className="text-[11px] font-medium mb-2" style={{ color: green }}>✅ 青色申告特別控除 3つのランク</p>
              <div className="space-y-2">
                {[
                  { num: "10万円", title: "簡易簿記で記帳", desc: "単式簿記（お小遣い帳レベル）でもOK。でも控除額は最少", color: T.textMuted },
                  { num: "55万円", title: "複式簿記 ＋ 紙で提出", desc: "複式簿記で記帳し、紙で申告した場合", color: orange },
                  { num: "65万円", title: "複式簿記 ＋ e-Tax提出", desc: "複式簿記で記帳し、e-Taxで電子申告した場合 ★最大控除！", color: green },
                ].map((item, i) => (
                  <div key={i} className="flex gap-2 items-start p-2 rounded-lg" style={{ backgroundColor: T.card }}>
                    <span className="text-[12px] font-medium flex-shrink-0" style={{ color: item.color }}>{item.num}</span>
                    <div>
                      <p className="text-[10px] font-medium" style={{ color: T.text }}>{item.title}</p>
                      <p className="text-[9px]" style={{ color: T.textSub }}>{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-[9px] mt-2" style={{ color: green }}>💡 T-MANAGEは複式簿記に自動対応。e-Taxで提出すれば最大65万円控除！</p>
            </div>

            {/* 青色申告承認申請書 記入ガイド */}
            <div style={{ ...altCard, border: `1px solid #2563eb33` }} className="mb-3">
              <p className="text-[12px] font-medium mb-3" style={{ color: "#2563eb" }}>✍️ 青色申告承認申請書 記入ガイド</p>
              <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${T.border}`, backgroundColor: T.card }}>
                <div className="p-2 text-center" style={{ backgroundColor: "#eef2ff", borderBottom: `1px solid ${T.border}` }}>
                  <p className="text-[10px] font-medium" style={{ color: "#333" }}>所得税の青色申告承認申請書</p>
                </div>
                {[
                  { num: "①", field: "提出先・提出日", example: "○○税務署長 / 提出日", guide: "開業届と同じ税務署名・提出する日を記入" },
                  { num: "②", field: "納税地・氏名", example: "開業届と同じ内容", guide: "開業届と同じ住所・氏名・生年月日・電話番号を記入" },
                  { num: "③", field: "職業", example: "リラクゼーション業", guide: "開業届と同じ職業名を記入" },
                  { num: "④", field: "青色申告開始年分", example: "令和○年分", guide: "青色申告を始めたい年を記入", tip: "開業した年を記入すればOK" },
                  { num: "⑤", field: "所得の種類", example: "事業所得 にチェック ✓", guide: "「事業所得」にチェックを入れる" },
                  { num: "⑥", field: "過去の青色申告", example: "無 にチェック ✓", guide: "初めてなら「無」にチェック" },
                  { num: "⑦", field: "開業日", example: "令和○年○月○日", guide: "1月16日以降に開業した場合のみ記入（開業届と同じ日）" },
                  { num: "⑧", field: "簿記方式", example: "複式簿記 にチェック ✓", guide: "65万円控除には「複式簿記」を選択！", tip: "T-MANAGEが自動で複式簿記の帳簿を作成します" },
                  { num: "⑨", field: "備付帳簿名", example: "仕訳帳・総勘定元帳", guide: "「仕訳帳」と「総勘定元帳」にチェック", tip: "この2つは必須。T-MANAGEで自動生成されます" },
                ].map((item, i) => (
                  <div key={i} className="p-2.5" style={{ borderBottom: `1px solid ${T.border}` }}>
                    <div className="flex items-start gap-2">
                      <span className="text-[10px] font-medium flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: "#2563eb", color: "#fff" }}>{item.num}</span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[10px] font-medium" style={{ color: T.text }}>{item.field}</span>
                          <span className="text-[8px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "#f0f0f0", color: "#666" }}>{item.example}</span>
                        </div>
                        <p className="text-[9px]" style={{ color: T.textSub }}>{item.guide}</p>
                        {item.tip && <p className="text-[8px] mt-0.5" style={{ color: "#2563eb" }}>💡 {item.tip}</p>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 提出期限 */}
            <div className="p-3 rounded-xl mb-3" style={{ backgroundColor: red + "08", border: `1px solid ${red}33` }}>
              <p className="text-[11px] font-medium" style={{ color: red }}>⏰ 提出期限に注意！</p>
              <div className="mt-2 space-y-1">
                <p className="text-[9px]" style={{ color: T.textSub }}>• <b>新規開業の場合</b>：開業日から2ヶ月以内</p>
                <p className="text-[9px]" style={{ color: T.textSub }}>• <b>既に開業済みの場合</b>：その年の3月15日まで（翌年分から適用）</p>
                <p className="text-[9px]" style={{ color: T.textSub }}>• 提出を忘れると自動的に「白色申告」になります</p>
              </div>
            </div>

            <div className="p-3 rounded-xl" style={{ backgroundColor: orange + "10", border: `1px solid ${orange}33` }}>
              <p className="text-[11px] font-medium" style={{ color: orange }}>💡 「複式簿記」は怖くない！</p>
              <p className="text-[10px] mt-1" style={{ color: T.textSub }}>
                T-MANAGEの帳簿機能が自動的に複式簿記（借方・貸方）で記帳します。
                仕訳帳・総勘定元帳もPDFで出力可能。わざわざ会計ソフトを別に契約する必要はありません！
              </p>
            </div>

            <div className="mt-3">
              <p className="text-[12px] font-medium mb-2" style={{ color: T.text }}>あなたはどちらにしますか？</p>
              <div className="flex gap-2">
                <button onClick={() => saveProfile({ ...profile, isAoiro: true })} style={yesNoBtn(profile.isAoiro, true)}>💙 青色申告</button>
                <button onClick={() => saveProfile({ ...profile, isAoiro: false })} style={yesNoBtn(profile.isAoiro, false)}>📄 白色申告</button>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setStep(profile.hasKaigyou ? 1 : 2)} style={btnOutline}>← 戻る</button>
            <button onClick={() => { saveStatus({ ...stepStatus, 3: "done" }); setStep(4); }} style={btnPink}>次へ →</button>
          </div>
        </div>
      )}

      {/* ============== Step 4: インボイス ============== */}
      {step === 4 && (
        <div className="space-y-3">
          <div style={{ ...cardBase, padding: "20px" }}>
            <h2 className="text-[14px] font-medium mb-1" style={{ color: T.text }}>🧾 インボイス制度</h2>
            <p className="text-[10px] mb-4" style={{ color: T.textMuted }}>2023年10月開始。お店との関係で登録が必要かどうか変わります</p>

            {/* DLボタン */}
            <div className="space-y-2 mb-4">
              <a href="https://www.e-tax.nta.go.jp/" target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 rounded-xl cursor-pointer" style={{ backgroundColor: green + "15", border: `1px solid ${green}44`, textDecoration: "none" }}>
                <span className="text-[24px]">💻</span>
                <div className="flex-1">
                  <p className="text-[11px] font-medium" style={{ color: green }}>e-Taxでインボイス登録申請</p>
                  <p className="text-[8px]" style={{ color: T.textMuted }}>オンラインで登録申請が可能（おすすめ）</p>
                </div>
                <span className="text-[10px]" style={{ color: green }}>↗</span>
              </a>
              <a href="https://www.nta.go.jp/taxes/tetsuzuki/shinsei/annai/shohi/annai/0023006-001.htm" target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 rounded-xl cursor-pointer" style={{ backgroundColor: orange + "15", border: `1px solid ${orange}44`, textDecoration: "none" }}>
                <span className="text-[24px]">📄</span>
                <div className="flex-1">
                  <p className="text-[11px] font-medium" style={{ color: orange }}>インボイス登録申請書 ダウンロード</p>
                  <p className="text-[8px]" style={{ color: T.textMuted }}>国税庁「適格請求書発行事業者の登録申請書」</p>
                </div>
                <span className="text-[10px]" style={{ color: orange }}>↗</span>
              </a>
              <a href="https://www.invoice-kohyo.nta.go.jp/" target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 rounded-xl cursor-pointer" style={{ backgroundColor: "#2563eb20", border: "1px solid #2563eb44", textDecoration: "none" }}>
                <span className="text-[24px]">🔍</span>
                <div className="flex-1">
                  <p className="text-[11px] font-medium" style={{ color: "#2563eb" }}>インボイス登録番号を検索</p>
                  <p className="text-[8px]" style={{ color: T.textMuted }}>国税庁公表サイトで登録済みか確認</p>
                </div>
                <span className="text-[10px]" style={{ color: "#2563eb" }}>↗</span>
              </a>
            </div>

            {/* そもそもインボイスとは？ */}
            <div style={{ ...altCard, border: `1px solid ${orange}33` }} className="mb-3">
              <p className="text-[12px] font-medium mb-2" style={{ color: orange }}>🧾 そもそもインボイスって何？</p>
              <div className="space-y-2">
                <p className="text-[10px]" style={{ color: T.textSub }}>
                  インボイス＝「適格請求書」のこと。消費税の仕入税額控除を受けるために必要な書類です。
                </p>
                <div className="p-2.5 rounded-lg" style={{ backgroundColor: T.card }}>
                  <p className="text-[9px] font-medium mb-1" style={{ color: T.text }}>セラピストにとっての影響</p>
                  <p className="text-[9px]" style={{ color: T.textSub }}>
                    お店側があなたに支払う報酬の消費税分を、お店の経費（仕入税額控除）として計上するには、
                    あなたが「インボイス登録事業者」である必要があります。
                  </p>
                </div>
                <div className="p-2.5 rounded-lg" style={{ backgroundColor: T.card }}>
                  <p className="text-[9px] font-medium mb-1" style={{ color: T.text }}>登録しないとどうなる？</p>
                  <p className="text-[9px]" style={{ color: T.textSub }}>
                    お店があなたの消費税分を控除できなくなる → お店の負担が増える → 報酬が下がる可能性があります。
                    ただし2031年10月まで段階的に経過措置があります（80%→70%→50%→30%→0%）。
                  </p>
                </div>
              </div>
            </div>

            {/* 判定フロー → Ange Spa推奨スタンス */}
            <div style={altCard} className="mb-3">
              <div className="p-3 rounded-xl mb-2" style={{ backgroundColor: "#c3a78220", border: "1px solid #c3a78266" }}>
                <p className="text-[11px] font-medium mb-1" style={{ color: "#c3a782" }}>💎 Ange Spaからのお知らせ</p>
                <p className="text-[9px]" style={{ color: T.textSub }}>
                  Ange Spaではセラピストさんのインボイス登録を<b>推奨</b>しています。
                  未登録の場合はバック額の10%を控除していますが、登録すればこの控除がなくなり<b>毎月の手取りが増えます</b>。
                </p>
                <a href="/mypage/invoice-guide" style={{ color: "#c3a782", fontSize: "10px", textDecoration: "underline", display: "inline-block", marginTop: 4 }}>📖 詳しい手取りシミュレーション付きガイドはこちら</a>
              </div>

              <p className="text-[11px] font-medium mb-2" style={{ color: T.text }}>🔀 お店からインボイス登録を求められていますか？</p>
              <div className="flex gap-2 mb-3">
                <button onClick={() => saveProfile({ ...profile, shopRequiresInvoice: true })} style={yesNoBtn(profile.shopRequiresInvoice, true)}>求められている</button>
                <button onClick={() => saveProfile({ ...profile, shopRequiresInvoice: false })} style={yesNoBtn(profile.shopRequiresInvoice, false)}>特に言われてない</button>
              </div>

              {profile.shopRequiresInvoice === true && (
                <div className="space-y-2">
                  <div className="p-3 rounded-xl" style={{ backgroundColor: orange + "10", border: `1px solid ${orange}33` }}>
                    <p className="text-[10px] font-medium mb-2" style={{ color: orange }}>📝 登録が必要な場合の手順</p>
                    <div className="space-y-2">
                      {[
                        { step: "①", title: "登録申請書を提出", desc: "e-Taxまたは郵送で「適格請求書発行事業者の登録申請書」を提出" },
                        { step: "②", title: "登録番号を取得", desc: "「T＋13桁の数字」形式の番号が届きます（例: T1234567890123）" },
                        { step: "③", title: "お店に番号を伝える", desc: "登録番号をお店に連絡 → 翌月からインボイス控除がなくなります" },
                        { step: "④", title: "消費税の申告が必要に", desc: "2割特例（売上の約1.8%）で負担は軽い。詳細はインボイスガイドで" },
                      ].map((item, i) => (
                        <div key={i} className="flex gap-2 items-start">
                          <span className="text-[10px] font-medium flex-shrink-0" style={{ color: orange }}>{item.step}</span>
                          <div>
                            <p className="text-[9px] font-medium" style={{ color: T.text }}>{item.title}</p>
                            <p className="text-[8px]" style={{ color: T.textSub }}>{item.desc}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 消費税の計算方法 */}
                  <div className="p-3 rounded-xl" style={{ backgroundColor: "#2563eb10", border: "1px solid #2563eb33" }}>
                    <p className="text-[10px] font-medium mb-2" style={{ color: "#2563eb" }}>💰 消費税の納め方（セラピスト向け）</p>
                    <div className="space-y-2">
                      <div className="p-2 rounded-lg" style={{ backgroundColor: T.card }}>
                        <p className="text-[9px] font-medium" style={{ color: green }}>★ おすすめ：2割特例（2026年分まで）</p>
                        <p className="text-[8px]" style={{ color: T.textSub }}>
                          売上の消費税の<b>2割だけ</b>を納付すればOK。届出不要で確定申告時に選択するだけ。
                        </p>
                        <p className="text-[8px] mt-1" style={{ color: green }}>例：年間売上300万 → 消費税30万の2割 = <b>6万円</b>の納付</p>
                      </div>
                      <div className="p-2 rounded-lg" style={{ backgroundColor: T.card }}>
                        <p className="text-[9px] font-medium" style={{ color: "#2563eb" }}>3割特例（2027〜2028年分・個人事業主限定）</p>
                        <p className="text-[8px]" style={{ color: T.textSub }}>
                          2割特例終了後のソフトランディング措置。売上消費税の<b>3割</b>を納付。届出不要。
                        </p>
                      </div>
                      <div className="p-2 rounded-lg" style={{ backgroundColor: T.card }}>
                        <p className="text-[9px] font-medium" style={{ color: T.text }}>簡易課税制度（2029年以降も使える）</p>
                        <p className="text-[8px]" style={{ color: T.textSub }}>
                          セラピストはサービス業（第5種：50%）。売上消費税の<b>50%を控除</b>。事前届出が必要。
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {profile.shopRequiresInvoice === false && (
                <div className="space-y-2">
                  <div className="p-3 rounded-xl" style={{ backgroundColor: "#c3a78215", border: "1px solid #c3a78244" }}>
                    <p className="text-[10px] font-medium mb-1" style={{ color: "#c3a782" }}>💎 Ange Spaでは登録をおすすめしています</p>
                    <p className="text-[9px]" style={{ color: T.textSub }}>
                      現在、インボイス未登録のセラピストさんからはバック額の10%を控除しています。
                      登録すればこの控除がなくなり、<b>手取りが増えます</b>。
                    </p>
                    <p className="text-[9px] mt-1" style={{ color: T.textSub }}>
                      2割特例（売上の約1.8%を納税するだけ）を使えば、10%控除より<b>ずっとお得</b>です。
                    </p>
                    <a href="/mypage/invoice-guide" className="inline-block mt-2 text-[10px] px-3 py-1.5 rounded-lg" style={{ background: "linear-gradient(135deg, #c3a782, #b09672)", color: "#fff", fontWeight: 500, textDecoration: "none" }}>💎 インボイス登録ガイドを見る →</a>
                  </div>
                  <div className="p-2 rounded-lg" style={{ backgroundColor: T.card }}>
                    <p className="text-[8px]" style={{ color: T.textMuted }}>
                      ※ 免税事業者からの仕入控除経過措置は2031年10月完全終了予定。今後インボイス登録の重要性は増していきます。
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* 登録状況 */}
            <div style={altCard} className="mb-3">
              <p className="text-[11px] font-medium mb-2" style={{ color: T.text }}>📌 あなたのインボイス登録状況</p>
              <div className="flex gap-2">
                <button onClick={() => saveProfile({ ...profile, hasInvoice: true })} style={yesNoBtn(profile.hasInvoice, true)}>登録済み</button>
                <button onClick={() => saveProfile({ ...profile, hasInvoice: false })} style={yesNoBtn(profile.hasInvoice, false)}>まだ未登録</button>
              </div>
              {profile.hasInvoice === true && (
                <p className="text-[9px] mt-2" style={{ color: green }}>✅ 登録済み！毎年の確定申告で消費税の申告もお忘れなく。帳簿タブの「📄 申告」で消費税も自動計算されます。</p>
              )}
              {profile.hasInvoice === false && (
                <p className="text-[9px] mt-2" style={{ color: "#c3a782" }}>💎 登録すると毎月の手取りが増えます。<a href="/mypage/invoice-guide" style={{ color: "#c3a782", textDecoration: "underline" }}>詳しくはこちら</a></p>
              )}
            </div>

            {/* メリット・デメリット比較 */}
            <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${T.border}` }}>
              <div className="grid grid-cols-2 text-center">
                <div className="p-2" style={{ backgroundColor: green + "15" }}><span className="text-[9px] font-medium" style={{ color: green }}>登録するメリット</span></div>
                <div className="p-2" style={{ backgroundColor: red + "10" }}><span className="text-[9px] font-medium" style={{ color: red }}>登録するデメリット</span></div>
              </div>
              {[
                ["お店の控除10%がなくなり手取りUP", "消費税の申告・納付が必要"],
                ["2割特例で負担は売上の約1.8%", "帳簿の管理が少し増える"],
                ["プロとしての信頼性UP", "登録から2年は免税に戻れない"],
              ].map(([pro, con], i) => (
                <div key={i} className="grid grid-cols-2" style={{ borderTop: `1px solid ${T.border}` }}>
                  <div className="p-2"><span className="text-[8px]" style={{ color: T.textSub }}>{pro}</span></div>
                  <div className="p-2"><span className="text-[8px]" style={{ color: T.textMuted }}>{con}</span></div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setStep(3)} style={btnOutline}>← 戻る</button>
            <button onClick={() => { saveStatus({ ...stepStatus, 4: "done" }); setStep(5); }} style={btnPink}>次へ →</button>
          </div>
        </div>
      )}

      {/* ============== Step 5: 経費の整理 ============== */}
      {step === 5 && (
        <div className="space-y-3">
          <div style={{ ...cardBase, padding: "20px" }}>
            <h2 className="text-[14px] font-medium mb-1" style={{ color: T.text }}>💰 経費の整理</h2>
            <p className="text-[10px] mb-4" style={{ color: T.textMuted }}>セラピストならではの経費をしっかり計上して節税しましょう！</p>

            <div className="p-3 rounded-xl mb-4" style={{ background: `linear-gradient(135deg, ${pink}15, ${pink}05)`, border: `1px solid ${pinkBorder}` }}>
              <p className="text-[11px] font-medium" style={{ color: pink }}>💡 経費のポイント</p>
              <p className="text-[10px] mt-1" style={{ color: T.textSub }}>
                「仕事に必要な出費」はすべて経費になります。
                セラピストは見た目も含めた「商品力」が重要なので、美容系の経費が認められやすい職種です。
              </p>
            </div>

            <div className="space-y-2">
              {expenseCategories.map((cat, i) => (
                <button key={i} onClick={() => setShowDetail(showDetail === cat.cat ? null : cat.cat)}
                  className="w-full text-left" style={{ ...altCard, cursor: "pointer", border: `1px solid ${showDetail === cat.cat ? pinkBorder : "transparent"}` }}>
                  <div className="flex justify-between items-center">
                    <p className="text-[11px] font-medium" style={{ color: T.text }}>{cat.cat}</p>
                    <span className="text-[10px]" style={{ color: T.textMuted }}>{showDetail === cat.cat ? "▲" : "▼"}</span>
                  </div>
                  {showDetail === cat.cat && (
                    <div className="mt-2 space-y-1">
                      {cat.items.map((item, j) => (
                        <p key={j} className="text-[10px] flex gap-1.5" style={{ color: T.textSub }}>
                          <span style={{ color: pink }}>•</span>{item}
                        </p>
                      ))}
                      <p className="text-[9px] mt-2 italic" style={{ color: T.textMuted }}>💡 {cat.note}</p>
                    </div>
                  )}
                </button>
              ))}
            </div>

            <div className="mt-4" style={altCard}>
              <p className="text-[11px] font-medium mb-2" style={{ color: T.text }}>📱 レシート管理のコツ</p>
              <div className="space-y-1.5">
                {[
                  "レシートをもらったらすぐスマホで撮影📸",
                  "月ごとに封筒やジップロックに分けて保管",
                  "レシートがない場合はメモや出金伝票で代用",
                  "交通費は日付・行き先・金額をメモ",
                  "T-MANAGEの「帳簿・経費管理」でレシート撮影→AI自動仕分け",
                ].map((t, i) => (
                  <p key={i} className="text-[10px] flex gap-1.5" style={{ color: T.textSub }}>
                    <span style={{ color: green }}>✓</span>{t}
                  </p>
                ))}
              </div>
            </div>

            <div className="mt-3 p-3 rounded-xl" style={{ backgroundColor: orange + "10", border: `1px solid ${orange}33` }}>
              <p className="text-[10px] font-medium" style={{ color: orange }}>⚠️ 按分（あんぶん）について</p>
              <p className="text-[9px] mt-1" style={{ color: T.textSub }}>
                プライベートと仕事で兼用するもの（スマホ代、美容費など）は「仕事で使う割合」で経費にします。
                例：スマホを仕事50%で使用 → 月額1万円の50%＝5,000円が経費。合理的な割合で按分しましょう。
              </p>
            </div>

            <div className="mt-3 p-3 rounded-xl" style={{ backgroundColor: "#2563eb10", border: "1px solid #2563eb33" }}>
              <p className="text-[10px] font-medium" style={{ color: "#2563eb" }}>💡 レシートに「適格事業者番号（T番号）」や「税率」は必要？</p>
              <p className="text-[9px] mt-1" style={{ color: T.textSub }}>
                <b style={{ color: green }}>ほとんどのセラピストさんは不要です！</b>
                <br />
                消費税の「2割特例」「3割特例」「簡易課税」を使う場合、経費のインボイス番号は<b>計算に使いません</b>（売上だけで税額が決まるため）。
              </p>
              <p className="text-[9px] mt-1" style={{ color: T.textSub }}>
                レシートに必要なのは<b>日付・金額・お店の名前・何を買ったか</b>が分かればOK。
                普通のコンビニやドラッグストアのレシートで十分です。
              </p>
              <p className="text-[8px] mt-1" style={{ color: T.textMuted }}>
                ※「原則課税」を選ぶ場合のみインボイス番号が必要ですが、セラピストには非推奨です。
              </p>
            </div>
          </div>
          {onGoToLedger && (
            <button onClick={onGoToLedger} className="w-full py-3 rounded-xl text-[11px] cursor-pointer"
              style={{ backgroundColor: "#22c55e15", color: "#22c55e", border: "1px solid #22c55e44", fontWeight: 500 }}>
              📒 帳簿・経費管理を開く（レシート登録・帳簿ダウンロード）
            </button>
          )}
          <div className="flex gap-2">
            <button onClick={() => setStep(4)} style={btnOutline}>← 戻る</button>
            <button onClick={() => { saveStatus({ ...stepStatus, 5: "done" }); setStep(6); }} style={btnPink}>次へ →</button>
          </div>
        </div>
      )}

      {/* ============== Step 6: 申告書作成・提出 ============== */}
      {step === 6 && (
        <div className="space-y-3">
          <div style={{ ...cardBase, padding: "20px" }}>
            <h2 className="text-[14px] font-medium mb-1" style={{ color: T.text }}>📄 確定申告書の作成・提出</h2>
            <p className="text-[10px] mb-4" style={{ color: T.textMuted }}>いよいよ最終ステップ！e-Taxで簡単に提出できます</p>

            {/* 提出までの流れ */}
            <div className="space-y-2 mb-4">
              {[
                { num: "①", title: "収入を集計", desc: "1年間（1月〜12月）にお店から受け取った報酬の合計", icon: "💵" },
                { num: "②", title: "経費を集計", desc: "レシート・領収書をもとに経費を項目ごとに合計", icon: "🧾" },
                { num: "③", title: "収支内訳書を作成", desc: profile.isAoiro ? "青色申告決算書（複式簿記）を作成" : "収支内訳書（白色）を作成", icon: "📊" },
                { num: "④", title: "確定申告書を作成", desc: "国税庁の「確定申告書等作成コーナー」で入力", icon: "📝" },
                { num: "⑤", title: "提出！", desc: "e-Tax（スマホ or PC）で送信 → 完了！", icon: "🎉" },
              ].map((s, i) => (
                <div key={i} className="flex gap-3 items-start p-3 rounded-xl" style={{ backgroundColor: T.cardAlt }}>
                  <span className="text-[18px] flex-shrink-0">{s.icon}</span>
                  <div>
                    <p className="text-[11px] font-medium" style={{ color: T.text }}>{s.num} {s.title}</p>
                    <p className="text-[9px]" style={{ color: T.textSub }}>{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* 必要書類チェックリスト */}
            <div style={altCard}>
              <p className="text-[11px] font-medium mb-3" style={{ color: T.text }}>📋 必要書類チェックリスト</p>
              <div className="space-y-2">
                {documents.map((doc) => (
                  <button key={doc.key} onClick={() => toggleCheck(doc.key)}
                    className="w-full flex items-start gap-2 text-left cursor-pointer"
                    style={{ background: "none", border: "none", padding: "4px 0" }}>
                    <span className="text-[14px] flex-shrink-0 mt-[-1px]">{checklist[doc.key] ? "☑️" : "⬜"}</span>
                    <span className="text-[10px]" style={{ color: checklist[doc.key] ? green : T.textSub, textDecoration: checklist[doc.key] ? "line-through" : "none" }}>
                      {doc.label}
                    </span>
                  </button>
                ))}
              </div>
              <div className="mt-3 flex justify-between items-center pt-2" style={{ borderTop: `1px solid ${T.border}` }}>
                <span className="text-[10px]" style={{ color: T.textMuted }}>
                  {Object.values(checklist).filter(Boolean).length}/{documents.length} 準備完了
                </span>
                <button onClick={() => saveChecklist({})} className="text-[9px] cursor-pointer" style={{ color: T.textMuted, background: "none", border: "none", textDecoration: "underline" }}>
                  リセット
                </button>
              </div>
            </div>

            {/* e-Tax案内 */}
            <div className="mt-3" style={altCard}>
              <p className="text-[11px] font-medium mb-2" style={{ color: T.text }}>💻 e-Tax（電子申告）のやり方</p>
              <div className="space-y-1.5">
                {[
                  "国税庁「確定申告書等作成コーナー」にアクセス",
                  "マイナンバーカード ＋ スマホでログイン",
                  "画面の案内に沿って収入・経費を入力",
                  "自動計算された税額を確認",
                  "送信ボタンで提出完了！",
                ].map((t, i) => (
                  <p key={i} className="text-[10px] flex gap-1.5" style={{ color: T.textSub }}>
                    <span className="font-medium" style={{ color: pink }}>{i + 1}.</span>{t}
                  </p>
                ))}
              </div>
            </div>

            {/* e-Tax・確定申告コーナー リンク */}
            <div className="mt-3 space-y-2">
              <a href="https://www.keisan.nta.go.jp/" target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 rounded-xl cursor-pointer" style={{ backgroundColor: green + "15", border: `1px solid ${green}44`, textDecoration: "none" }}>
                <span className="text-[24px]">📝</span>
                <div className="flex-1">
                  <p className="text-[11px] font-medium" style={{ color: green }}>確定申告書等作成コーナー</p>
                  <p className="text-[8px]" style={{ color: T.textMuted }}>国税庁公式。ここから申告書を作成・e-Tax送信できます</p>
                </div>
                <span className="text-[10px]" style={{ color: green }}>↗</span>
              </a>
              <a href="https://www.e-tax.nta.go.jp/" target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 rounded-xl cursor-pointer" style={{ backgroundColor: "#2563eb20", border: "1px solid #2563eb44", textDecoration: "none" }}>
                <span className="text-[24px]">💻</span>
                <div className="flex-1">
                  <p className="text-[11px] font-medium" style={{ color: "#2563eb" }}>e-Tax公式サイト</p>
                  <p className="text-[8px]" style={{ color: T.textMuted }}>初めての方はこちらで利用者登録から</p>
                </div>
                <span className="text-[10px]" style={{ color: "#2563eb" }}>↗</span>
              </a>
            </div>

            {/* 副業の場合の注意点 */}
            {profile.isSubJob && (
              <div className="mt-3 p-3 rounded-xl" style={{ backgroundColor: red + "08", border: `1px solid ${red}33` }}>
                <p className="text-[11px] font-medium" style={{ color: red }}>🔒 【超重要】副業バレ防止</p>
                <p className="text-[10px] mt-1" style={{ color: T.textSub }}>
                  確定申告書 第二表の「住民税の徴収方法」欄で、必ず<b style={{ color: red }}>「自分で納付（普通徴収）」</b>にチェック！
                </p>
                <p className="text-[9px] mt-1" style={{ color: T.textMuted }}>
                  これを忘れると、副業分の住民税が本業の会社に通知されてバレる原因になります。
                </p>
              </div>
            )}

            {/* 提出期限 */}
            <div className="mt-3 p-3 rounded-xl" style={{ background: `linear-gradient(135deg, ${pink}15, ${pink}05)`, border: `1px solid ${pinkBorder}` }}>
              <p className="text-[12px] font-medium text-center" style={{ color: pink }}>📅 提出期限</p>
              <p className="text-[20px] font-medium text-center mt-1" style={{ color: T.text }}>毎年 2月16日 〜 3月15日</p>
              <p className="text-[9px] text-center mt-1" style={{ color: T.textMuted }}>※他店で源泉徴収されていて還付申告となる場合は、1月1日から提出可能</p>
            </div>

            {/* T-MANAGEデータの使い方 */}
            <div className="mt-3" style={{ ...altCard, border: `1px solid ${pink}44` }}>
              <p className="text-[11px] font-medium mb-2" style={{ color: pink }}>📒 T-MANAGEの帳簿データの使い方</p>
              <div className="space-y-1.5">
                {[
                  "「帳簿・経費管理」→「📄 申告」タブで年間の収入・経費・所得を確認",
                  "「📥 出力」タブでPDF/CSVをダウンロード",
                  "確定申告書等作成コーナーで、ダウンロードした数値を画面に入力",
                  "収入金額 → T-MANAGEの「事業収入」の金額を入力",
                  "経費 → 勘定科目ごとの金額を入力（PDFに一覧あり）",
                ].map((t, i) => (
                  <p key={i} className="text-[10px] flex gap-1.5" style={{ color: T.textSub }}>
                    <span className="font-medium" style={{ color: pink }}>{i + 1}.</span>{t}
                  </p>
                ))}
              </div>
            </div>

            {/* 💰 納税方法 */}
            <div className="mt-3" style={{ ...altCard, border: `1px solid ${green}33` }}>
              <p className="text-[12px] font-medium mb-3" style={{ color: green }}>💰 税金の納め方（所得税）</p>
              <p className="text-[9px] mb-3" style={{ color: T.textMuted }}>Ange Spa は源泉徴収なしのため、確定申告では基本的に「納付」となります。3月15日までに以下の方法で納付してください。他店で源泉徴収されていて差額が還付になる場合は、約1〜2ヶ月で指定口座に振り込まれます。</p>
              <div className="space-y-2">
                <div className="p-2.5 rounded-lg" style={{ backgroundColor: green + "10", border: `1px solid ${green}33` }}>
                  <p className="text-[10px] font-medium" style={{ color: green }}>★ おすすめ：振替納税（口座引き落とし）</p>
                  <p className="text-[9px]" style={{ color: T.textSub }}>
                    銀行口座から自動引き落とし。一度設定すれば毎年自動。引き落とし日は4月中旬〜下旬（約1ヶ月の猶予あり）。
                  </p>
                  <p className="text-[8px] mt-1" style={{ color: T.textMuted }}>設定方法：e-Taxで電子申告時に「振替納税」を選択 → 口座情報を入力するだけ</p>
                </div>
                <div className="p-2 rounded-lg" style={{ backgroundColor: T.card }}>
                  <p className="text-[10px] font-medium" style={{ color: T.text }}>② クレジットカード納付</p>
                  <p className="text-[9px]" style={{ color: T.textSub }}>国税クレジットカードお支払サイトから納付。手数料がかかります（税額1万円につき約83円）。</p>
                </div>
                <div className="p-2 rounded-lg" style={{ backgroundColor: T.card }}>
                  <p className="text-[10px] font-medium" style={{ color: T.text }}>③ スマホアプリ納付（PayPay等）</p>
                  <p className="text-[9px]" style={{ color: T.textSub }}>Pay払い（PayPay、d払い、au PAY、楽天ペイ等）で30万円以下なら納付可能。手数料無料。</p>
                </div>
                <div className="p-2 rounded-lg" style={{ backgroundColor: T.card }}>
                  <p className="text-[10px] font-medium" style={{ color: T.text }}>④ コンビニ納付（QRコード）</p>
                  <p className="text-[9px]" style={{ color: T.textSub }}>確定申告書等作成コーナーでQRコードを作成 → コンビニのレジで納付。30万円以下。</p>
                </div>
                <div className="p-2 rounded-lg" style={{ backgroundColor: T.card }}>
                  <p className="text-[10px] font-medium" style={{ color: T.text }}>⑤ 銀行窓口・ダイレクト納付</p>
                  <p className="text-[9px]" style={{ color: T.textSub }}>銀行窓口で納付書を使って納付。またはe-Taxからのダイレクト納付（事前届出が必要）。</p>
                </div>
              </div>
            </div>

            {/* 申告後の流れ */}
            <div className="mt-3" style={{ ...altCard, border: `1px solid ${orange}33` }}>
              <p className="text-[12px] font-medium mb-3" style={{ color: orange }}>📅 申告後のスケジュール</p>
              <div className="space-y-2">
                {[
                  { when: "3月15日", what: "所得税の納付期限", desc: "振替納税の場合は4月中旬〜下旬に引き落とし", icon: "💴" },
                  { when: "1〜2ヶ月後", what: "還付金の振込（該当者のみ）", desc: "他店で源泉徴収されていて還付になる場合、申告書に書いた口座に振り込まれます。Ange Spa のみの場合は通常該当しません。", icon: "💰" },
                  { when: "6月頃", what: "住民税の通知", desc: "市区町村から「住民税の決定通知書」が届きます。年4回に分けて納付（6月・8月・10月・1月）", icon: "📬" },
                  { when: "6〜7月頃", what: "国民健康保険料の通知", desc: "確定申告の所得に基づいて保険料が決定されます。経費をしっかり申告すると保険料も下がります！", icon: "🏥" },
                  { when: "翌年8月〜", what: "予定納税（該当者のみ）", desc: "前年の所得税が15万円以上の場合、翌年分の所得税を前払い（7月・11月に各1/3ずつ）", icon: "📊" },
                ].map((item, i) => (
                  <div key={i} className="flex gap-2 items-start p-2 rounded-lg" style={{ backgroundColor: T.card }}>
                    <span className="text-[14px] flex-shrink-0">{item.icon}</span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[8px] px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: orange + "20", color: orange }}>{item.when}</span>
                        <span className="text-[10px] font-medium" style={{ color: T.text }}>{item.what}</span>
                      </div>
                      <p className="text-[8px] mt-0.5" style={{ color: T.textSub }}>{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 住民税の納付方法 */}
            <div className="mt-3" style={altCard}>
              <p className="text-[11px] font-medium mb-2" style={{ color: T.text }}>🏛 住民税の納め方</p>
              <p className="text-[9px] mb-2" style={{ color: T.textSub }}>
                住民税は確定申告とは別に、お住まいの市区町村に納付します。確定申告すると自動的に住民税も計算されます。
              </p>
              <div className="space-y-1">
                <p className="text-[9px] flex gap-1" style={{ color: T.textSub }}><span style={{ color: green }}>✓</span> <b>普通徴収</b>：納付書が届くので、銀行・コンビニ・口座振替で納付（年4回）</p>
                <p className="text-[9px] flex gap-1" style={{ color: T.textSub }}><span style={{ color: green }}>✓</span> <b>口座振替</b>：市区町村の窓口で手続きすれば自動引き落としに変更可能</p>
              </div>
              {profile.isSubJob && (
                <div className="mt-2 p-2 rounded-lg" style={{ backgroundColor: red + "08" }}>
                  <p className="text-[8px] font-medium" style={{ color: red }}>⚠️ 副業の方は「普通徴収」を必ず選択！（確定申告書で選択済みのはず）</p>
                </div>
              )}
            </div>
          </div>
          {onGoToLedger && (
            <button onClick={onGoToLedger} className="w-full py-3 rounded-xl text-[11px] cursor-pointer"
              style={{ backgroundColor: "#22c55e15", color: "#22c55e", border: "1px solid #22c55e44", fontWeight: 500 }}>
              📒 帳簿を開いてCSVダウンロード → 確定申告に使える！
            </button>
          )}
          <div className="flex gap-2">
            <button onClick={() => setStep(5)} style={btnOutline}>← 戻る</button>
            <button onClick={() => { saveStatus({ ...stepStatus, 6: "done" }); }} style={btnPink}>すべて理解した！ ✅</button>
          </div>
        </div>
      )}

      {/* ============== FAQ セクション（常時表示） ============== */}
      <div style={{ ...cardBase, padding: "20px" }}>
        <h2 className="text-[14px] font-medium mb-3" style={{ color: T.text }}>❓ よくある質問・不安解消</h2>
        <div className="space-y-2">
          {faqs.map((faq, i) => (
            <button key={i} onClick={() => setExpandedFaq(expandedFaq === i ? null : i)}
              className="w-full text-left cursor-pointer" style={{ ...altCard, border: `1px solid ${expandedFaq === i ? pinkBorder : "transparent"}` }}>
              <div className="flex justify-between items-center">
                <p className="text-[11px] font-medium" style={{ color: T.text }}>{faq.q}</p>
                <span className="text-[10px] flex-shrink-0 ml-2" style={{ color: T.textMuted }}>{expandedFaq === i ? "▲" : "▼"}</span>
              </div>
              {expandedFaq === i && (
                <p className="text-[10px] mt-3 whitespace-pre-line leading-relaxed" style={{ color: T.textSub }}>{faq.a}</p>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ============== 進捗サマリー（常時表示） ============== */}
      <div style={{ ...cardBase, padding: "20px" }}>
        <h2 className="text-[14px] font-medium mb-3" style={{ color: T.text }}>📈 あなたの進捗状況</h2>
        <div className="space-y-2">
          {STEPS.map((s, i) => (
            <div key={i} className="flex items-center gap-3 p-2 rounded-xl cursor-pointer"
              onClick={() => setStep(i)}
              style={{ backgroundColor: stepStatus[i] === "done" ? green + "08" : T.cardAlt }}>
              <span className="text-[16px]">{stepStatus[i] === "done" ? "✅" : "⬜"}</span>
              <div className="flex-1">
                <p className="text-[11px] font-medium" style={{ color: stepStatus[i] === "done" ? green : T.text }}>{s.icon} {s.label}</p>
              </div>
              <span className="text-[9px]" style={{ color: T.textMuted }}>{stepStatus[i] === "done" ? "完了" : "未完了"}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 text-center">
          <p className="text-[10px]" style={{ color: T.textMuted }}>
            {completedSteps === STEPS.length
              ? "🎉 すべてのステップが完了しました！確定申告の準備はバッチリです！"
              : `あと${STEPS.length - completedSteps}ステップで完了です！`}
          </p>
        </div>
        {completedSteps > 0 && (
          <button onClick={() => { saveStatus({}); saveChecklist({}); }}
            className="mt-2 text-[9px] cursor-pointer w-full text-center"
            style={{ color: T.textMuted, background: "none", border: "none", textDecoration: "underline" }}>
            進捗をリセット
          </button>
        )}
      </div>

      {/* ============== 免責事項 ============== */}
      <div className="p-3 rounded-xl" style={{ backgroundColor: T.cardAlt }}>
        <p className="text-[8px] leading-relaxed" style={{ color: T.textMuted }}>
          ⚠️ 注意事項：このページの内容は一般的な税務知識の提供を目的としたものであり、個別の税務相談・税務申告書の作成を行うものではありません。
          具体的な税務判断については、税理士にご相談ください。税額の計算結果は概算であり、実際の金額とは異なる場合があります。
        </p>
      </div>
    </div>
  );
}
