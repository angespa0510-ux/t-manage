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
};
type StepStatus = { [key: number]: "done" | "skip" | null };

const STORAGE_KEY = "tax_support_progress";
const PROFILE_KEY = "tax_support_profile";

const defaultProfile: TaxProfile = {
  isSubJob: null, annualIncome: "", hasSpouse: null, spouseIncome: "",
  mainJobIncome: "", hasKaigyou: null, isAoiro: null, hasInvoice: null, shopRequiresInvoice: null,
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

  // ── スタイル ──
  const pink = "#e8849a";
  const pinkLight = "#e8849a20";
  const pinkBorder = "#e8849a44";
  const green = "#22c55e";
  const orange = "#f59e0b";
  const red = "#ef4444";

  const cardBase = { backgroundColor: T.card, borderColor: T.border, borderRadius: "16px", border: `1px solid ${T.border}` };
  const altCard = { backgroundColor: T.cardAlt, borderRadius: "12px", padding: "12px" };
  const btnPink = { background: `linear-gradient(135deg, ${pink}, #d4687e)`, color: "#fff", border: "none", borderRadius: "12px", padding: "10px 20px", fontSize: "12px", cursor: "pointer", fontWeight: 600 };
  const btnOutline = { backgroundColor: "transparent", color: T.textSub, border: `1px solid ${T.border}`, borderRadius: "12px", padding: "10px 20px", fontSize: "12px", cursor: "pointer" };
  const yesNoBtn = (active: boolean | null, target: boolean) => ({
    backgroundColor: active === target ? (target ? green + "20" : red + "20") : "transparent",
    color: active === target ? (target ? green : red) : T.textMuted,
    border: `1px solid ${active === target ? (target ? green : red) : T.border}`,
    borderRadius: "12px", padding: "10px 24px", fontSize: "12px", cursor: "pointer", fontWeight: active === target ? 600 : 400,
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
  const calcSaving = () => {
    const income = parseInt(calcIncome) || 0;
    const expense = parseInt(calcExpense) || 0;
    const profit = Math.max(0, income - expense);
    const whiteIncome = profit; // 白色: 経費のみ控除
    const aoiroIncome = Math.max(0, profit - 650000); // 青色65万控除
    const baseTax = (n: number) => {
      if (n <= 0) return 0;
      const taxable = Math.max(0, n - 480000); // 基礎控除48万
      if (taxable <= 1950000) return Math.floor(taxable * 0.05);
      if (taxable <= 3300000) return Math.floor(taxable * 0.10 - 97500);
      if (taxable <= 6950000) return Math.floor(taxable * 0.20 - 427500);
      return Math.floor(taxable * 0.23 - 636000);
    };
    const whiteTax = baseTax(whiteIncome);
    const aoiroTax = baseTax(aoiroIncome);
    const saving = whiteTax - aoiroTax;
    const healthBase = (n: number) => Math.floor(n * 0.1); // 概算10%
    const healthSaving = healthBase(whiteIncome) - healthBase(aoiroIncome);
    return { profit, whiteTax, aoiroTax, saving, healthSaving, totalSaving: saving + healthSaving };
  };

  const fmt = (n: number) => "¥" + n.toLocaleString();

  // ── 経費リスト（業界特化）──
  const expenseCategories = [
    { cat: "💄 美容関連", items: ["美容院代", "ネイル代", "マツエク", "スキンケア用品", "化粧品", "サプリメント", "ボディケア用品"], note: "接客に必要な場合、全額〜一部が経費に" },
    { cat: "👗 衣装・備品", items: ["接客用衣装", "ルームウェア", "ストッキング", "下着", "タオル", "シーツ", "アロマオイル", "マッサージオイル"], note: "仕事専用のものは全額経費" },
    { cat: "🚃 交通費", items: ["電車・バス代", "タクシー代", "駐車場代", "ガソリン代（按分）"], note: "通勤・移動にかかる費用" },
    { cat: "📱 通信費", items: ["携帯電話代（按分）", "Wi-Fi代（按分）", "仕事用アプリ課金"], note: "プライベートと兼用の場合は仕事割合で按分" },
    { cat: "☕ カフェ・食事", items: ["待機中のカフェ代", "出勤前の食事"], note: "待機時間中のカフェ代は経費にできる場合あり" },
    { cat: "📚 研修・勉強", items: ["マッサージ講習費", "セミナー参加費", "参考書籍"], note: "スキルアップのための費用" },
    { cat: "🏥 医療・健康", items: ["性病検査費用", "健康診断費用"], note: "仕事に必要な検査費用" },
    { cat: "🏠 家賃（在宅の場合）", items: ["家賃の一部（按分）", "水道光熱費（按分）"], note: "自宅で施術する場合のみ" },
  ];

  // ── FAQ ──
  const faqs = [
    {
      q: "🔒 副業がバレない方法は？",
      a: `確定申告書の「住民税の徴収方法」で「自分で納付（普通徴収）」にチェックを入れてください。
こうすると、副業分の住民税が会社の給料から天引きされず、自分で支払うことになるので、会社に通知が行きません。

⚠️ 注意点：
• 確定申告書 第二表の下部にある選択欄です
• 市区町村によっては普通徴収に対応しない場合もあるので、事前に確認を
• ふるさと納税のワンストップ特例は使わない（確定申告で一括処理）`,
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
会計ソフト（freee、マネーフォワード等）を使えば簡単です。`,
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
  ];

  // ── 必要書類チェックリスト ──
  const documents = [
    { key: "mynumber", label: "マイナンバーカード（または通知カード＋身分証明書）" },
    { key: "bank", label: "還付用の口座情報（通帳やキャッシュカード）" },
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
          <span className="text-[13px] font-bold" style={{ color: T.text }}>📊 確定申告サポート</span>
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
            <h2 className="text-[15px] font-bold mb-3" style={{ color: T.text }}>🌸 はじめに</h2>
            <p className="text-[12px] leading-relaxed mb-4" style={{ color: T.textSub }}>
              セラピストとして働くあなたは<b>個人事業主</b>です。
              お店から受け取る報酬は「給料」ではなく「事業収入」。
              だから、<b style={{ color: pink }}>自分で確定申告する必要</b>があります。
            </p>

            <div style={{ ...altCard, marginBottom: "12px" }}>
              <p className="text-[11px] font-bold mb-2" style={{ color: green }}>✅ 確定申告すると...</p>
              <ul className="space-y-1.5">
                {["払いすぎた税金が戻ってくる（還付金💰）", "経費を引いて税金が安くなる", "国民健康保険料が適正額になる", "社会的信用UP（ローン・賃貸審査）", "将来の年金額にも影響"].map((t, i) => (
                  <li key={i} className="text-[11px] flex gap-1.5" style={{ color: T.textSub }}>
                    <span style={{ color: green }}>✓</span>{t}
                  </li>
                ))}
              </ul>
            </div>

            <div style={{ ...altCard, marginBottom: "12px", borderLeft: `3px solid ${red}` }}>
              <p className="text-[11px] font-bold mb-2" style={{ color: red }}>❌ しないと...</p>
              <ul className="space-y-1.5">
                {["無申告加算税（15〜20%の追加課税）", "延滞税（最大年利14.6%）", "国民健康保険が最高額に", "住宅ローンが組めない", "5年間遡って調査されるリスク"].map((t, i) => (
                  <li key={i} className="text-[11px] flex gap-1.5" style={{ color: T.textSub }}>
                    <span style={{ color: red }}>✗</span>{t}
                  </li>
                ))}
              </ul>
            </div>

            {/* 節税シミュレーター */}
            <button onClick={() => setShowCalc(!showCalc)} style={{ ...altCard, width: "100%", cursor: "pointer", textAlign: "left", border: `1px solid ${pinkBorder}` }}>
              <p className="text-[12px] font-bold" style={{ color: pink }}>🧮 節税シミュレーター {showCalc ? "▲" : "▼"}</p>
              <p className="text-[10px] mt-0.5" style={{ color: T.textMuted }}>収入と経費を入れると、青色申告でどれだけ節税できるか分かります</p>
            </button>
            {showCalc && (
              <div className="mt-3 space-y-3" style={{ ...altCard, border: `1px solid ${pinkBorder}` }}>
                <div>
                  <label className="block text-[10px] mb-1" style={{ color: T.textSub }}>年間の収入（税込）</label>
                  <input type="number" value={calcIncome} onChange={e => setCalcIncome(e.target.value)} placeholder="例: 3000000"
                    className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={{ backgroundColor: T.card, color: T.text, border: `1px solid ${T.border}` }} />
                </div>
                <div>
                  <label className="block text-[10px] mb-1" style={{ color: T.textSub }}>年間の経費合計</label>
                  <input type="number" value={calcExpense} onChange={e => setCalcExpense(e.target.value)} placeholder="例: 500000"
                    className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={{ backgroundColor: T.card, color: T.text, border: `1px solid ${T.border}` }} />
                </div>
                {calcIncome && (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center py-2" style={{ borderBottom: `1px solid ${T.border}` }}>
                      <span className="text-[11px]" style={{ color: T.textSub }}>所得（収入−経費）</span>
                      <span className="text-[12px] font-bold" style={{ color: T.text }}>{fmt(calcSaving().profit)}</span>
                    </div>
                    <div className="flex justify-between items-center py-2" style={{ borderBottom: `1px solid ${T.border}` }}>
                      <span className="text-[11px]" style={{ color: T.textSub }}>白色申告の税額（概算）</span>
                      <span className="text-[12px]" style={{ color: red }}>{fmt(calcSaving().whiteTax)}</span>
                    </div>
                    <div className="flex justify-between items-center py-2" style={{ borderBottom: `1px solid ${T.border}` }}>
                      <span className="text-[11px]" style={{ color: T.textSub }}>青色65万控除の税額（概算）</span>
                      <span className="text-[12px]" style={{ color: green }}>{fmt(calcSaving().aoiroTax)}</span>
                    </div>
                    <div className="rounded-xl p-3" style={{ background: `linear-gradient(135deg, ${green}15, ${green}05)`, border: `1px solid ${green}33` }}>
                      <p className="text-[10px]" style={{ color: green }}>💰 青色申告にすると...</p>
                      <p className="text-[18px] font-bold" style={{ color: green }}>年間 {fmt(calcSaving().totalSaving)} お得！</p>
                      <p className="text-[9px] mt-1" style={{ color: T.textMuted }}>所得税の差額 {fmt(calcSaving().saving)} ＋ 健康保険料の差額（概算） {fmt(calcSaving().healthSaving)}</p>
                    </div>
                  </div>
                )}
              </div>
            )}
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
            <h2 className="text-[15px] font-bold mb-1" style={{ color: T.text }}>📋 あなたの状況を教えてください</h2>
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
                  <p className="text-[10px]" style={{ color: orange }}>⚠️ 副業の場合は「住民税の普通徴収」が重要です！（Step 7で詳しく説明します）</p>
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

            {/* Q5: 開業届 */}
            <div className="mb-4">
              <p className="text-[12px] font-medium mb-2" style={{ color: T.text }}>{profile.isSubJob ? "Q5" : "Q4"}. 開業届は出していますか？</p>
              <div className="flex gap-2">
                <button onClick={() => saveProfile({ ...profile, hasKaigyou: true })} style={yesNoBtn(profile.hasKaigyou, true)}>出した</button>
                <button onClick={() => saveProfile({ ...profile, hasKaigyou: false })} style={yesNoBtn(profile.hasKaigyou, false)}>まだ</button>
              </div>
            </div>

            {/* 判定結果 */}
            {profile.annualIncome && profile.hasKaigyou !== null && (
              <div className="mt-4 p-4 rounded-2xl" style={{ background: `linear-gradient(135deg, ${pink}10, ${pink}05)`, border: `1px solid ${pinkBorder}` }}>
                <p className="text-[12px] font-bold mb-2" style={{ color: pink }}>📌 あなたに必要な手続き</p>
                <div className="space-y-1.5">
                  {!profile.hasKaigyou && (
                    <p className="text-[11px] flex gap-1.5" style={{ color: T.textSub }}>
                      <span style={{ color: red }}>●</span> <b>開業届の提出</b>が必要です → Step 3
                    </p>
                  )}
                  <p className="text-[11px] flex gap-1.5" style={{ color: T.textSub }}>
                    <span style={{ color: orange }}>●</span> <b>青色申告</b>がおすすめ → Step 4
                  </p>
                  <p className="text-[11px] flex gap-1.5" style={{ color: T.textSub }}>
                    <span style={{ color: pink }}>●</span> <b>経費の整理</b>をしましょう → Step 6
                  </p>
                  {profile.isSubJob && (
                    <p className="text-[11px] flex gap-1.5" style={{ color: T.textSub }}>
                      <span style={{ color: green }}>●</span> <b>住民税は普通徴収</b>で会社バレ防止 → FAQ
                    </p>
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
            <h2 className="text-[15px] font-bold mb-1" style={{ color: T.text }}>📝 開業届の出し方</h2>
            <p className="text-[10px] mb-4" style={{ color: T.textMuted }}>個人事業を始めたら原則1ヶ月以内に提出。でも遅れても罰則なし！今からでもOK</p>

            {/* ダウンロードボタン */}
            <div className="space-y-2 mb-4">
              <a href="https://www.nta.go.jp/taxes/tetsuzuki/shinsei/annai/shinkoku/pdf/h28/05.pdf" target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 rounded-xl cursor-pointer" style={{ backgroundColor: "#dc262620", border: "1px solid #dc262644", textDecoration: "none" }}>
                <span className="text-[24px]">📄</span>
                <div className="flex-1">
                  <p className="text-[11px] font-bold" style={{ color: "#dc2626" }}>開業届 PDFダウンロード</p>
                  <p className="text-[8px]" style={{ color: T.textMuted }}>国税庁公式「個人事業の開業・廃業等届出書」</p>
                </div>
                <span className="text-[10px]" style={{ color: "#dc2626" }}>↗</span>
              </a>
              <a href="https://www.nta.go.jp/taxes/tetsuzuki/shinsei/annai/shinkoku/annai/09.htm" target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 rounded-xl cursor-pointer" style={{ backgroundColor: "#2563eb20", border: "1px solid #2563eb44", textDecoration: "none" }}>
                <span className="text-[24px]">📘</span>
                <div className="flex-1">
                  <p className="text-[11px] font-bold" style={{ color: "#2563eb" }}>青色申告承認申請書 PDFダウンロード</p>
                  <p className="text-[8px]" style={{ color: T.textMuted }}>開業届と一緒に提出がベスト！</p>
                </div>
                <span className="text-[10px]" style={{ color: "#2563eb" }}>↗</span>
              </a>
              <a href="https://www.e-tax.nta.go.jp/" target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 rounded-xl cursor-pointer" style={{ backgroundColor: green + "15", border: `1px solid ${green}44`, textDecoration: "none" }}>
                <span className="text-[24px]">💻</span>
                <div className="flex-1">
                  <p className="text-[11px] font-bold" style={{ color: green }}>e-Tax（電子申告）で提出</p>
                  <p className="text-[8px]" style={{ color: T.textMuted }}>マイナンバーカード＋スマホで自宅から提出可能（おすすめ！）</p>
                </div>
                <span className="text-[10px]" style={{ color: green }}>↗</span>
              </a>
            </div>

            {/* 必要なもの */}
            <div style={altCard} className="mb-3">
              <p className="text-[11px] font-bold mb-2" style={{ color: T.text }}>📋 必要なもの</p>
              <ul className="space-y-1">
                {["マイナンバーカード（または通知カード＋身分証明書）", "印鑑（認印でOK・e-Taxなら不要）", "開業届の用紙（上のボタンからDL or 税務署で入手）"].map((t, i) => (
                  <li key={i} className="text-[10px] flex gap-1.5" style={{ color: T.textSub }}><span style={{ color: pink }}>•</span>{t}</li>
                ))}
              </ul>
            </div>

            {/* ===== 開業届の記入ガイド ===== */}
            <div style={{ ...altCard, border: `2px solid ${pink}44` }} className="mb-3">
              <p className="text-[12px] font-bold mb-3" style={{ color: pink }}>✍️ 開業届の記入ガイド（セラピスト用）</p>
              <p className="text-[9px] mb-3" style={{ color: T.textMuted }}>「個人事業の開業・廃業等届出書」の各項目の書き方です</p>

              {/* フォーム風ビジュアル */}
              <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${T.border}`, backgroundColor: T.card }}>
                {/* ヘッダー */}
                <div className="p-2 text-center" style={{ backgroundColor: "#f8f0f2", borderBottom: `1px solid ${T.border}` }}>
                  <p className="text-[10px] font-bold" style={{ color: "#333" }}>個人事業の開業・廃業等届出書</p>
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
                  { num: "⑩", field: "事業の概要", example: "リラクゼーション施術の提供", guide: "どんな仕事をするか簡単に記入", tip: "「アロマトリートメント・ボディケア施術の提供」など" },
                  { num: "⑪", field: "青色申告の有無", example: "有 にチェック ✓", guide: "「有」にチェック → 青色申告承認申請書も一緒に提出！", tip: "65万円控除を受けるには「有」が必須" },
                  { num: "⑫", field: "給与の支払", example: "無 にチェック ✓", guide: "従業員がいなければ「無」でOK", tip: "" },
                ].map((item, i) => (
                  <div key={i} className="p-2.5" style={{ borderBottom: `1px solid ${T.border}` }}>
                    <div className="flex items-start gap-2">
                      <span className="text-[10px] font-bold flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: pink, color: "#fff" }}>{item.num}</span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[10px] font-bold" style={{ color: T.text }}>{item.field}</span>
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
              <p className="text-[11px] font-bold mb-2" style={{ color: T.text }}>📤 提出方法（3つ）</p>
              <div className="space-y-2">
                <div className="p-2.5 rounded-lg" style={{ backgroundColor: green + "10", border: `1px solid ${green}33` }}>
                  <p className="text-[11px] font-bold" style={{ color: green }}>① e-Tax（おすすめ！）</p>
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
            <h2 className="text-[15px] font-bold mb-1" style={{ color: T.text }}>📘 青色申告 vs 白色申告</h2>
            <p className="text-[10px] mb-4" style={{ color: T.textMuted }}>結論：<b style={{ color: green }}>青色申告（65万円控除）</b>が圧倒的におすすめ！</p>

            {/* DLボタン */}
            <div className="space-y-2 mb-4">
              <a href="https://www.nta.go.jp/taxes/tetsuzuki/shinsei/annai/shinkoku/pdf/h28/10.pdf" target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 rounded-xl cursor-pointer" style={{ backgroundColor: "#2563eb20", border: "1px solid #2563eb44", textDecoration: "none" }}>
                <span className="text-[24px]">📘</span>
                <div className="flex-1">
                  <p className="text-[11px] font-bold" style={{ color: "#2563eb" }}>青色申告承認申請書 PDFダウンロード</p>
                  <p className="text-[8px]" style={{ color: T.textMuted }}>国税庁公式「所得税の青色申告承認申請書」</p>
                </div>
                <span className="text-[10px]" style={{ color: "#2563eb" }}>↗</span>
              </a>
            </div>

            {/* 比較表 */}
            <div className="rounded-xl overflow-hidden mb-4" style={{ border: `1px solid ${T.border}` }}>
              <div className="grid grid-cols-3 text-center">
                <div className="p-2" style={{ backgroundColor: T.cardAlt }}><span className="text-[9px]" style={{ color: T.textMuted }}>&nbsp;</span></div>
                <div className="p-2" style={{ backgroundColor: T.cardAlt }}><span className="text-[10px] font-bold" style={{ color: T.text }}>白色申告</span></div>
                <div className="p-2" style={{ backgroundColor: green + "15" }}><span className="text-[10px] font-bold" style={{ color: green }}>青色申告 ★</span></div>
              </div>
              {[
                ["特別控除", "なし", "最大65万円"],
                ["記帳方法", "単式簿記", "複式簿記"],
                ["帳簿の難易度", "簡単", "T-MANAGEで自動！"],
                ["赤字繰越し", "できない", "3年間OK"],
                ["家族の給与", "経費不可", "経費にできる"],
                ["30日以内届出", "不要", "要（申請書提出）"],
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
              <p className="text-[11px] font-bold mb-2" style={{ color: green }}>💰 青色申告でどれくらい得する？（具体例）</p>
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
                    <span className="font-bold" style={{ color: green }}>（{row.save}お得！）</span>
                  </div>
                ))}
              </div>
              <p className="text-[7px] mt-1" style={{ color: T.textMuted }}>※経費50万円、基礎控除のみの概算。社会保険料等は含まず</p>
            </div>

            {/* 65万控除の3つの条件 */}
            <div style={{ ...altCard, border: `2px solid ${green}33` }} className="mb-3">
              <p className="text-[11px] font-bold mb-2" style={{ color: green }}>✅ 65万円控除を受ける3つの条件</p>
              <div className="space-y-2">
                {[
                  { num: "❶", title: "複式簿記で記帳", desc: "T-MANAGEの帳簿機能が自動で対応！会計ソフト不要です", done: true },
                  { num: "❷", title: "e-Taxで電子申告", desc: "マイナンバーカード＋スマホでオンライン提出" },
                  { num: "❸", title: "期限内に申告", desc: "毎年3月15日までに提出すること" },
                ].map((item, i) => (
                  <div key={i} className="flex gap-2 items-start p-2 rounded-lg" style={{ backgroundColor: T.card }}>
                    <span className="text-[14px]">{item.num}</span>
                    <div>
                      <p className="text-[10px] font-bold" style={{ color: T.text }}>{item.title}</p>
                      <p className="text-[9px]" style={{ color: T.textSub }}>{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 青色申告承認申請書 記入ガイド */}
            <div style={{ ...altCard, border: `2px solid #2563eb33` }} className="mb-3">
              <p className="text-[12px] font-bold mb-3" style={{ color: "#2563eb" }}>✍️ 青色申告承認申請書 記入ガイド</p>
              <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${T.border}`, backgroundColor: T.card }}>
                <div className="p-2 text-center" style={{ backgroundColor: "#eef2ff", borderBottom: `1px solid ${T.border}` }}>
                  <p className="text-[10px] font-bold" style={{ color: "#333" }}>所得税の青色申告承認申請書</p>
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
                      <span className="text-[10px] font-bold flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: "#2563eb", color: "#fff" }}>{item.num}</span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[10px] font-bold" style={{ color: T.text }}>{item.field}</span>
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
              <p className="text-[11px] font-bold" style={{ color: red }}>⏰ 提出期限に注意！</p>
              <div className="mt-2 space-y-1">
                <p className="text-[9px]" style={{ color: T.textSub }}>• <b>新規開業の場合</b>：開業日から2ヶ月以内</p>
                <p className="text-[9px]" style={{ color: T.textSub }}>• <b>既に開業済みの場合</b>：その年の3月15日まで（翌年分から適用）</p>
                <p className="text-[9px]" style={{ color: T.textSub }}>• 提出を忘れると自動的に「白色申告」になります</p>
              </div>
            </div>

            <div className="p-3 rounded-xl" style={{ backgroundColor: orange + "10", border: `1px solid ${orange}33` }}>
              <p className="text-[11px] font-bold" style={{ color: orange }}>💡 「複式簿記」は怖くない！</p>
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
            <h2 className="text-[15px] font-bold mb-1" style={{ color: T.text }}>🧾 インボイス制度</h2>
            <p className="text-[10px] mb-4" style={{ color: T.textMuted }}>2023年10月開始。お店との関係で登録が必要かどうか変わります</p>

            {/* DLボタン */}
            <div className="space-y-2 mb-4">
              <a href="https://www.e-tax.nta.go.jp/" target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 rounded-xl cursor-pointer" style={{ backgroundColor: green + "15", border: `1px solid ${green}44`, textDecoration: "none" }}>
                <span className="text-[24px]">💻</span>
                <div className="flex-1">
                  <p className="text-[11px] font-bold" style={{ color: green }}>e-Taxでインボイス登録申請</p>
                  <p className="text-[8px]" style={{ color: T.textMuted }}>オンラインで登録申請が可能（おすすめ）</p>
                </div>
                <span className="text-[10px]" style={{ color: green }}>↗</span>
              </a>
              <a href="https://www.nta.go.jp/taxes/tetsuzuki/shinsei/annai/shohi/annai/0023006-001.htm" target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 rounded-xl cursor-pointer" style={{ backgroundColor: orange + "15", border: `1px solid ${orange}44`, textDecoration: "none" }}>
                <span className="text-[24px]">📄</span>
                <div className="flex-1">
                  <p className="text-[11px] font-bold" style={{ color: orange }}>インボイス登録申請書 ダウンロード</p>
                  <p className="text-[8px]" style={{ color: T.textMuted }}>国税庁「適格請求書発行事業者の登録申請書」</p>
                </div>
                <span className="text-[10px]" style={{ color: orange }}>↗</span>
              </a>
              <a href="https://www.invoice-kohyo.nta.go.jp/" target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 rounded-xl cursor-pointer" style={{ backgroundColor: "#2563eb20", border: "1px solid #2563eb44", textDecoration: "none" }}>
                <span className="text-[24px]">🔍</span>
                <div className="flex-1">
                  <p className="text-[11px] font-bold" style={{ color: "#2563eb" }}>インボイス登録番号を検索</p>
                  <p className="text-[8px]" style={{ color: T.textMuted }}>国税庁公表サイトで登録済みか確認</p>
                </div>
                <span className="text-[10px]" style={{ color: "#2563eb" }}>↗</span>
              </a>
            </div>

            {/* そもそもインボイスとは？ */}
            <div style={{ ...altCard, border: `2px solid ${orange}33` }} className="mb-3">
              <p className="text-[12px] font-bold mb-2" style={{ color: orange }}>🧾 そもそもインボイスって何？</p>
              <div className="space-y-2">
                <p className="text-[10px]" style={{ color: T.textSub }}>
                  インボイス＝「適格請求書」のこと。消費税の仕入税額控除を受けるために必要な書類です。
                </p>
                <div className="p-2.5 rounded-lg" style={{ backgroundColor: T.card }}>
                  <p className="text-[9px] font-bold mb-1" style={{ color: T.text }}>セラピストにとっての影響</p>
                  <p className="text-[9px]" style={{ color: T.textSub }}>
                    お店側があなたに支払う報酬の消費税分を、お店の経費（仕入税額控除）として計上するには、
                    あなたが「インボイス登録事業者」である必要があります。
                  </p>
                </div>
                <div className="p-2.5 rounded-lg" style={{ backgroundColor: T.card }}>
                  <p className="text-[9px] font-bold mb-1" style={{ color: T.text }}>登録しないとどうなる？</p>
                  <p className="text-[9px]" style={{ color: T.textSub }}>
                    お店があなたの消費税分を控除できなくなる → お店の負担が増える → 報酬が下がる可能性があります。
                    ただし2029年9月末まで段階的に経過措置があります。
                  </p>
                </div>
              </div>
            </div>

            {/* 判定フロー */}
            <div style={altCard} className="mb-3">
              <p className="text-[11px] font-bold mb-2" style={{ color: T.text }}>🔀 あなたはインボイス登録が必要？</p>
              <div className="flex gap-2 mb-3">
                <button onClick={() => saveProfile({ ...profile, shopRequiresInvoice: true })} style={yesNoBtn(profile.shopRequiresInvoice, true)}>求められている</button>
                <button onClick={() => saveProfile({ ...profile, shopRequiresInvoice: false })} style={yesNoBtn(profile.shopRequiresInvoice, false)}>言われてない</button>
              </div>

              {profile.shopRequiresInvoice === true && (
                <div className="space-y-2">
                  <div className="p-3 rounded-xl" style={{ backgroundColor: orange + "10", border: `1px solid ${orange}33` }}>
                    <p className="text-[10px] font-bold mb-2" style={{ color: orange }}>📝 登録が必要な場合の手順</p>
                    <div className="space-y-2">
                      {[
                        { step: "①", title: "登録申請書を提出", desc: "e-Taxまたは郵送で「適格請求書発行事業者の登録申請書」を提出" },
                        { step: "②", title: "登録番号を取得", desc: "「T＋13桁の数字」形式の番号が届きます（例: T1234567890123）" },
                        { step: "③", title: "お店に番号を伝える", desc: "登録番号をお店に連絡してください" },
                        { step: "④", title: "消費税の申告が必要に", desc: "確定申告に加えて消費税の申告・納付が必要になります" },
                      ].map((item, i) => (
                        <div key={i} className="flex gap-2 items-start">
                          <span className="text-[10px] font-bold flex-shrink-0" style={{ color: orange }}>{item.step}</span>
                          <div>
                            <p className="text-[9px] font-bold" style={{ color: T.text }}>{item.title}</p>
                            <p className="text-[8px]" style={{ color: T.textSub }}>{item.desc}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 消費税の計算方法 */}
                  <div className="p-3 rounded-xl" style={{ backgroundColor: "#2563eb10", border: "1px solid #2563eb33" }}>
                    <p className="text-[10px] font-bold mb-2" style={{ color: "#2563eb" }}>💰 消費税の納め方（セラピスト向け）</p>
                    <div className="space-y-2">
                      <div className="p-2 rounded-lg" style={{ backgroundColor: T.card }}>
                        <p className="text-[9px] font-bold" style={{ color: green }}>★ おすすめ：2割特例（2026年分まで）</p>
                        <p className="text-[8px]" style={{ color: T.textSub }}>
                          売上の消費税の<b>2割だけ</b>を納付すればOK。届出不要で確定申告時に選択するだけ。
                        </p>
                        <p className="text-[8px] mt-1" style={{ color: green }}>例：年間売上300万 → 消費税30万の2割 = <b>6万円</b>の納付</p>
                      </div>
                      <div className="p-2 rounded-lg" style={{ backgroundColor: T.card }}>
                        <p className="text-[9px] font-bold" style={{ color: T.text }}>簡易課税制度（2027年以降も使える）</p>
                        <p className="text-[8px]" style={{ color: T.textSub }}>
                          業種ごとの「みなし仕入率」で計算。セラピストはサービス業（第5種：50%）なので、売上消費税の<b>50%を控除</b>。事前届出が必要。
                        </p>
                        <p className="text-[8px] mt-1" style={{ color: T.textMuted }}>例：年間売上300万 → 消費税30万 − みなし仕入15万 = <b>15万円</b>の納付</p>
                      </div>
                      <div className="p-2 rounded-lg" style={{ backgroundColor: T.card }}>
                        <p className="text-[9px] font-bold" style={{ color: T.textMuted }}>原則課税（複雑）</p>
                        <p className="text-[8px]" style={{ color: T.textMuted }}>実際の経費の消費税分を差し引いて計算。帳簿が複雑になるのでセラピストには非推奨。</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {profile.shopRequiresInvoice === false && (
                <div className="p-3 rounded-xl" style={{ backgroundColor: green + "10", border: `1px solid ${green}33` }}>
                  <p className="text-[10px] font-bold mb-1" style={{ color: green }}>✅ 今は登録不要！</p>
                  <p className="text-[9px]" style={{ color: T.textSub }}>
                    年間売上1,000万円以下の「免税事業者」のままでOK。消費税の申告は不要です。
                  </p>
                  <div className="mt-2 p-2 rounded-lg" style={{ backgroundColor: T.card }}>
                    <p className="text-[8px] font-bold" style={{ color: orange }}>⚠️ ただし注意</p>
                    <p className="text-[8px]" style={{ color: T.textSub }}>
                      2029年10月以降は経過措置が終了するため、お店から登録を求められる可能性が高まります。状況を注視しましょう。
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* 登録状況 */}
            <div style={altCard} className="mb-3">
              <p className="text-[11px] font-bold mb-2" style={{ color: T.text }}>📌 あなたのインボイス登録状況</p>
              <div className="flex gap-2">
                <button onClick={() => saveProfile({ ...profile, hasInvoice: true })} style={yesNoBtn(profile.hasInvoice, true)}>登録済み</button>
                <button onClick={() => saveProfile({ ...profile, hasInvoice: false })} style={yesNoBtn(profile.hasInvoice, false)}>まだ/不要</button>
              </div>
              {profile.hasInvoice === true && (
                <p className="text-[9px] mt-2" style={{ color: green }}>✅ 登録済みの場合は、毎年の確定申告で消費税の申告もお忘れなく！</p>
              )}
            </div>

            {/* メリット・デメリット比較 */}
            <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${T.border}` }}>
              <div className="grid grid-cols-2 text-center">
                <div className="p-2" style={{ backgroundColor: green + "15" }}><span className="text-[9px] font-bold" style={{ color: green }}>登録するメリット</span></div>
                <div className="p-2" style={{ backgroundColor: red + "10" }}><span className="text-[9px] font-bold" style={{ color: red }}>登録するデメリット</span></div>
              </div>
              {[
                ["お店との取引がスムーズ", "消費税の申告・納付が必要"],
                ["報酬を下げられるリスク回避", "帳簿の管理が増える"],
                ["取引先の信頼性UP", "手取りが消費税分減る"],
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
            <h2 className="text-[15px] font-bold mb-1" style={{ color: T.text }}>💰 経費の整理</h2>
            <p className="text-[10px] mb-4" style={{ color: T.textMuted }}>セラピストならではの経費をしっかり計上して節税しましょう！</p>

            <div className="p-3 rounded-xl mb-4" style={{ background: `linear-gradient(135deg, ${pink}15, ${pink}05)`, border: `1px solid ${pinkBorder}` }}>
              <p className="text-[11px] font-bold" style={{ color: pink }}>💡 経費のポイント</p>
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
                    <p className="text-[11px] font-bold" style={{ color: T.text }}>{cat.cat}</p>
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
              <p className="text-[11px] font-bold mb-2" style={{ color: T.text }}>📱 レシート管理のコツ</p>
              <div className="space-y-1.5">
                {[
                  "レシートをもらったらすぐスマホで撮影📸",
                  "月ごとに封筒やジップロックに分けて保管",
                  "レシートがない場合はメモや出金伝票で代用",
                  "交通費は日付・行き先・金額をメモ",
                  "会計ソフトのアプリでレシート撮影→自動仕分け",
                ].map((t, i) => (
                  <p key={i} className="text-[10px] flex gap-1.5" style={{ color: T.textSub }}>
                    <span style={{ color: green }}>✓</span>{t}
                  </p>
                ))}
              </div>
            </div>

            <div className="mt-3 p-3 rounded-xl" style={{ backgroundColor: orange + "10", border: `1px solid ${orange}33` }}>
              <p className="text-[10px] font-bold" style={{ color: orange }}>⚠️ 按分（あんぶん）について</p>
              <p className="text-[9px] mt-1" style={{ color: T.textSub }}>
                プライベートと仕事で兼用するもの（スマホ代、美容費など）は「仕事で使う割合」で経費にします。
                例：スマホを仕事50%で使用 → 月額1万円の50%＝5,000円が経費。合理的な割合で按分しましょう。
              </p>
            </div>
          </div>
          {onGoToLedger && (
            <button onClick={onGoToLedger} className="w-full py-3 rounded-xl text-[11px] cursor-pointer"
              style={{ backgroundColor: "#22c55e15", color: "#22c55e", border: "1px solid #22c55e44", fontWeight: 600 }}>
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
            <h2 className="text-[15px] font-bold mb-1" style={{ color: T.text }}>📄 確定申告書の作成・提出</h2>
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
                    <p className="text-[11px] font-bold" style={{ color: T.text }}>{s.num} {s.title}</p>
                    <p className="text-[9px]" style={{ color: T.textSub }}>{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* 必要書類チェックリスト */}
            <div style={altCard}>
              <p className="text-[11px] font-bold mb-3" style={{ color: T.text }}>📋 必要書類チェックリスト</p>
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
              <p className="text-[11px] font-bold mb-2" style={{ color: T.text }}>💻 e-Tax（電子申告）のやり方</p>
              <div className="space-y-1.5">
                {[
                  "国税庁「確定申告書等作成コーナー」にアクセス",
                  "マイナンバーカード ＋ スマホでログイン",
                  "画面の案内に沿って収入・経費を入力",
                  "自動計算された税額を確認",
                  "送信ボタンで提出完了！",
                ].map((t, i) => (
                  <p key={i} className="text-[10px] flex gap-1.5" style={{ color: T.textSub }}>
                    <span className="font-bold" style={{ color: pink }}>{i + 1}.</span>{t}
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
                  <p className="text-[11px] font-bold" style={{ color: green }}>確定申告書等作成コーナー</p>
                  <p className="text-[8px]" style={{ color: T.textMuted }}>国税庁公式。ここから申告書を作成・e-Tax送信できます</p>
                </div>
                <span className="text-[10px]" style={{ color: green }}>↗</span>
              </a>
              <a href="https://www.e-tax.nta.go.jp/" target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 rounded-xl cursor-pointer" style={{ backgroundColor: "#2563eb20", border: "1px solid #2563eb44", textDecoration: "none" }}>
                <span className="text-[24px]">💻</span>
                <div className="flex-1">
                  <p className="text-[11px] font-bold" style={{ color: "#2563eb" }}>e-Tax公式サイト</p>
                  <p className="text-[8px]" style={{ color: T.textMuted }}>初めての方はこちらで利用者登録から</p>
                </div>
                <span className="text-[10px]" style={{ color: "#2563eb" }}>↗</span>
              </a>
            </div>

            {/* 副業の場合の注意点 */}
            {profile.isSubJob && (
              <div className="mt-3 p-3 rounded-xl" style={{ backgroundColor: red + "08", border: `1px solid ${red}33` }}>
                <p className="text-[11px] font-bold" style={{ color: red }}>🔒 【超重要】副業バレ防止</p>
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
              <p className="text-[12px] font-bold text-center" style={{ color: pink }}>📅 提出期限</p>
              <p className="text-[20px] font-bold text-center mt-1" style={{ color: T.text }}>毎年 2月16日 〜 3月15日</p>
              <p className="text-[9px] text-center mt-1" style={{ color: T.textMuted }}>※還付申告（税金が戻ってくる場合）は1月1日から提出可能</p>
            </div>
          </div>
          {onGoToLedger && (
            <button onClick={onGoToLedger} className="w-full py-3 rounded-xl text-[11px] cursor-pointer"
              style={{ backgroundColor: "#22c55e15", color: "#22c55e", border: "1px solid #22c55e44", fontWeight: 600 }}>
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
        <h2 className="text-[15px] font-bold mb-3" style={{ color: T.text }}>❓ よくある質問・不安解消</h2>
        <div className="space-y-2">
          {faqs.map((faq, i) => (
            <button key={i} onClick={() => setExpandedFaq(expandedFaq === i ? null : i)}
              className="w-full text-left cursor-pointer" style={{ ...altCard, border: `1px solid ${expandedFaq === i ? pinkBorder : "transparent"}` }}>
              <div className="flex justify-between items-center">
                <p className="text-[11px] font-bold" style={{ color: T.text }}>{faq.q}</p>
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
        <h2 className="text-[15px] font-bold mb-3" style={{ color: T.text }}>📈 あなたの進捗状況</h2>
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
