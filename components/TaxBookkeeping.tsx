"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../lib/supabase";

/* ── 型定義 ── */
type T = { [key: string]: string };
type Settlement = {
  id: number; therapist_id: number; date: string; total_sales: number; total_back: number;
  order_count: number; adjustment: number; adjustment_note: string; invoice_deduction: number;
  withholding_tax: number; welfare_fee: number; transport_fee: number; final_payment: number;
  is_settled: boolean;
};
type Expense = {
  id: number; therapist_id: number; date: string; category: string; subcategory: string;
  account_item: string; description: string; amount: number; receipt_url: string;
  receipt_thumb_url: string; memo: string; created_at: string;
};
type LedgerEntry = {
  date: string; type: "income" | "expense"; category: string; account_item: string;
  description: string; income: number; expense: number; id: string; receipt_url?: string;
};

/* ── 定数 ── */
const CATEGORIES = [
  { icon: "💄", label: "美容費", account: "消耗品費", subs: ["美容院", "ネイル", "マツエク", "スキンケア", "化粧品", "サプリ"] },
  { icon: "👗", label: "衣装・備品", account: "消耗品費", subs: ["衣装", "ルームウェア", "ストッキング", "タオル", "オイル", "備品"] },
  { icon: "🚃", label: "交通費", account: "旅費交通費", subs: ["電車・バス", "タクシー", "駐車場", "ガソリン"] },
  { icon: "📱", label: "通信費", account: "通信費", subs: ["携帯電話", "Wi-Fi", "アプリ"] },
  { icon: "☕", label: "カフェ・食事", account: "雑費", subs: ["待機カフェ", "食事", "飲料"] },
  { icon: "📚", label: "研修・勉強", account: "研修費", subs: ["講習", "セミナー", "書籍"] },
  { icon: "🏥", label: "医療・健康", account: "福利厚生費", subs: ["検査", "健康診断", "医療費"] },
  { icon: "🛒", label: "その他", account: "雑費", subs: ["雑費", "その他"] },
];
const ACCOUNT_ITEMS = ["消耗品費", "旅費交通費", "通信費", "接待交際費", "研修費", "福利厚生費", "地代家賃", "広告宣伝費", "雑費"];
const fmt = (n: number) => "¥" + (n || 0).toLocaleString();

/* ── メインコンポーネント ── */
export default function TaxBookkeeping({ T, therapistId }: { T: T; therapistId: number }) {
  const [subTab, setSubTab] = useState<"ledger" | "add" | "download">("ledger");
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [month, setMonth] = useState(() => new Date().getMonth() + 1);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [tableReady, setTableReady] = useState<boolean | null>(null);
  const [setupMsg, setSetupMsg] = useState("");
  const [setupSql, setSetupSql] = useState("");
  const [loading, setLoading] = useState(true);

  // 経費入力フォーム
  const [form, setForm] = useState({ date: new Date().toISOString().split("T")[0], category: "", subcategory: "", account_item: "", description: "", amount: "", memo: "" });
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState("");
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [aiResult, setAiResult] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [editId, setEditId] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const pink = "#e8849a";
  const pinkLight = "#e8849a20";
  const pinkBorder = "#e8849a44";
  const green = "#22c55e";
  const red = "#ef4444";
  const orange = "#f59e0b";

  const cardBase = { backgroundColor: T.card, borderColor: T.border, borderRadius: "16px", border: `1px solid ${T.border}` };
  const altCard = { backgroundColor: T.cardAlt, borderRadius: "12px", padding: "12px" };
  const btnPink = { background: `linear-gradient(135deg, ${pink}, #d4687e)`, color: "#fff", border: "none", borderRadius: "12px", padding: "10px 20px", fontSize: "12px", cursor: "pointer", fontWeight: 600 };

  const monthKey = `${year}-${String(month).padStart(2, "0")}`;
  const dim = new Date(year, month, 0).getDate();

  /* ── テーブル存在チェック ── */
  const checkTable = useCallback(async () => {
    const { error } = await supabase.from("therapist_expenses").select("id").limit(1);
    if (error && (error.message.includes("does not exist") || error.message.includes("relation") || error.code === "42P01")) {
      setTableReady(false);
    } else {
      setTableReady(true);
    }
  }, []);

  /* ── テーブル作成 ── */
  const setupTable = async () => {
    setSetupMsg("作成中...");
    try {
      const res = await fetch("/api/tax-init", { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        setTableReady(true); setSetupMsg("✅ 完了！");
      } else {
        setSetupMsg(data.message || "手動作成が必要です");
        if (data.sql) setSetupSql(data.sql);
      }
    } catch { setSetupMsg("エラーが発生しました"); }
  };

  /* ── データ取得 ── */
  const fetchData = useCallback(async () => {
    if (!tableReady) return;
    setLoading(true);
    const startDate = `${monthKey}-01`;
    const endDate = `${monthKey}-${String(dim).padStart(2, "0")}`;

    const [{ data: stl }, { data: exp }] = await Promise.all([
      supabase.from("therapist_daily_settlements").select("*").eq("therapist_id", therapistId).gte("date", startDate).lte("date", endDate).eq("is_settled", true).order("date"),
      supabase.from("therapist_expenses").select("*").eq("therapist_id", therapistId).gte("date", startDate).lte("date", endDate).order("date"),
    ]);
    setSettlements(stl || []);
    setExpenses(exp || []);
    setLoading(false);
  }, [tableReady, therapistId, monthKey, dim]);

  useEffect(() => { checkTable(); }, [checkTable]);
  useEffect(() => { fetchData(); }, [fetchData]);

  /* ── 帳簿データ生成 ── */
  const generateLedger = (): LedgerEntry[] => {
    const entries: LedgerEntry[] = [];
    // 収入（精算データ）
    settlements.forEach(s => {
      entries.push({
        date: s.date, type: "income", category: "売上（施術報酬）", account_item: "売上高",
        description: `${s.order_count}件施術 バック${fmt(s.total_back)}${s.transport_fee > 0 ? ` 交通費${fmt(s.transport_fee)}` : ""}`,
        income: s.final_payment, expense: 0, id: `stl-${s.id}`,
      });
    });
    // 経費
    expenses.forEach(e => {
      entries.push({
        date: e.date, type: "expense", category: e.category, account_item: e.account_item,
        description: `${e.subcategory ? e.subcategory + " " : ""}${e.description}`,
        income: 0, expense: e.amount, id: `exp-${e.id}`, receipt_url: e.receipt_url,
      });
    });
    return entries.sort((a, b) => a.date.localeCompare(b.date));
  };

  const ledger = generateLedger();
  const totalIncome = ledger.reduce((s, e) => s + e.income, 0);
  const totalExpense = ledger.reduce((s, e) => s + e.expense, 0);
  const profit = totalIncome - totalExpense;

  /* ── レシートAI解析 ── */
  const analyzeReceipt = async (file: File) => {
    setAiAnalyzing(true); setAiResult("");
    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve) => {
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.readAsDataURL(file);
      });
      const res = await fetch("/api/receipt-analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64, mediaType: file.type }),
      });
      const data = await res.json();
      if (data.ok && data.result) {
        const r = data.result;
        setForm(prev => ({
          ...prev,
          date: r.date || prev.date,
          description: r.items || r.store || "",
          amount: r.amount ? String(r.amount) : prev.amount,
          category: r.category || prev.category,
          account_item: r.account_item || prev.account_item,
          memo: r.store ? `店舗: ${r.store}` : prev.memo,
        }));
        // カテゴリに合致するsubcategoryを設定
        const cat = CATEGORIES.find(c => c.label === r.category);
        if (cat) setForm(prev => ({ ...prev, subcategory: cat.subs[0] || "" }));
        setAiResult("✅ レシート読み取り完了！内容を確認してください");
      } else {
        setAiResult("⚠️ 読み取りに失敗しました。手動で入力してください");
      }
    } catch { setAiResult("⚠️ エラーが発生しました"); }
    setAiAnalyzing(false);
  };

  /* ── レシート画像選択 ── */
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setReceiptFile(file);
    const reader = new FileReader();
    reader.onload = () => setReceiptPreview(reader.result as string);
    reader.readAsDataURL(file);
    analyzeReceipt(file);
  };

  /* ── 経費保存 ── */
  const saveExpense = async () => {
    if (!form.amount || parseInt(form.amount) <= 0) { setSaveMsg("金額を入力してください"); return; }
    if (!form.category) { setSaveMsg("カテゴリを選択してください"); return; }
    setSaving(true); setSaveMsg("");

    let receiptUrl = "";
    let thumbUrl = "";

    // レシート画像アップロード
    if (receiptFile) {
      const ts = Date.now();
      const fileName = `therapist_${therapistId}/${form.date}_${ts}.${receiptFile.name.split(".").pop()}`;
      const { error: upErr } = await supabase.storage.from("receipts").upload(fileName, receiptFile, { contentType: receiptFile.type, upsert: true });
      if (!upErr) {
        const { data: urlData } = supabase.storage.from("receipts").getPublicUrl(fileName);
        receiptUrl = urlData.publicUrl;

        // サムネイル生成
        try {
          const img = new Image();
          const dataUrl = await new Promise<string>((resolve) => { const r = new FileReader(); r.onload = () => resolve(r.result as string); r.readAsDataURL(receiptFile); });
          await new Promise<void>((resolve) => { img.onload = () => resolve(); img.src = dataUrl; });
          const c = document.createElement("canvas"); const ctx = c.getContext("2d")!;
          const scale = 150 / Math.max(img.width, img.height);
          c.width = img.width * scale; c.height = img.height * scale;
          ctx.drawImage(img, 0, 0, c.width, c.height);
          const thumbBlob = await new Promise<Blob>((resolve) => c.toBlob((b) => resolve(b!), "image/jpeg", 0.6));
          const thumbName = `therapist_${therapistId}/thumb_${form.date}_${ts}.jpg`;
          await supabase.storage.from("receipts").upload(thumbName, thumbBlob, { contentType: "image/jpeg", upsert: true });
          const { data: tUrl } = supabase.storage.from("receipts").getPublicUrl(thumbName);
          thumbUrl = tUrl.publicUrl;
        } catch { /* thumb optional */ }
      }
    }

    const row = {
      therapist_id: therapistId,
      date: form.date,
      category: form.category,
      subcategory: form.subcategory,
      account_item: form.account_item,
      description: form.description,
      amount: parseInt(form.amount) || 0,
      receipt_url: receiptUrl,
      receipt_thumb_url: thumbUrl,
      memo: form.memo,
    };

    if (editId) {
      const { error } = await supabase.from("therapist_expenses").update(row).eq("id", editId);
      if (error) { setSaveMsg("保存失敗: " + error.message); } else { setSaveMsg("✅ 更新しました"); }
    } else {
      const { error } = await supabase.from("therapist_expenses").insert(row);
      if (error) { setSaveMsg("保存失敗: " + error.message); } else { setSaveMsg("✅ 保存しました"); }
    }

    setSaving(false);
    setForm({ date: new Date().toISOString().split("T")[0], category: "", subcategory: "", account_item: "", description: "", amount: "", memo: "" });
    setReceiptFile(null); setReceiptPreview(""); setAiResult(""); setEditId(null);
    fetchData();
  };

  /* ── 経費削除 ── */
  const deleteExpense = async (id: number) => {
    if (!confirm("この経費を削除しますか？")) return;
    await supabase.from("therapist_expenses").delete().eq("id", id);
    fetchData();
  };

  /* ── 経費編集 ── */
  const startEdit = (e: Expense) => {
    setEditId(e.id);
    setForm({ date: e.date, category: e.category, subcategory: e.subcategory, account_item: e.account_item, description: e.description, amount: String(e.amount), memo: e.memo });
    setSubTab("add");
  };

  /* ── CSVダウンロード ── */
  const downloadCSV = () => {
    const bom = "\uFEFF";
    const header = "日付,種別,カテゴリ,勘定科目,摘要,収入,支出\n";
    const rows = ledger.map(e =>
      `${e.date},${e.type === "income" ? "収入" : "支出"},${e.category},${e.account_item},"${e.description}",${e.income || ""},${e.expense || ""}`
    ).join("\n");
    const summary = `\n\n月間サマリー（${monthKey}）\n収入合計,${totalIncome}\n経費合計,${totalExpense}\n所得（収入−経費）,${profit}`;

    // 勘定科目別集計
    const byAccount: { [k: string]: number } = {};
    ledger.filter(e => e.type === "expense").forEach(e => { byAccount[e.account_item] = (byAccount[e.account_item] || 0) + e.expense; });
    const accountSummary = "\n\n勘定科目別経費\n" + Object.entries(byAccount).map(([k, v]) => `${k},${v}`).join("\n");

    const blob = new Blob([bom + header + rows + summary + accountSummary], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `帳簿_${monthKey}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  /* ── 年間CSV ── */
  const downloadYearCSV = () => {
    // 全年間データを取得してDL（非同期）
    (async () => {
      const startDate = `${year}-01-01`;
      const endDate = `${year}-12-31`;
      const [{ data: stl }, { data: exp }] = await Promise.all([
        supabase.from("therapist_daily_settlements").select("*").eq("therapist_id", therapistId).gte("date", startDate).lte("date", endDate).eq("is_settled", true).order("date"),
        supabase.from("therapist_expenses").select("*").eq("therapist_id", therapistId).gte("date", startDate).lte("date", endDate).order("date"),
      ]);
      const entries: LedgerEntry[] = [];
      (stl || []).forEach((s: Settlement) => {
        entries.push({ date: s.date, type: "income", category: "売上（施術報酬）", account_item: "売上高", description: `${s.order_count}件施術`, income: s.final_payment, expense: 0, id: `stl-${s.id}` });
      });
      (exp || []).forEach((e: Expense) => {
        entries.push({ date: e.date, type: "expense", category: e.category, account_item: e.account_item, description: `${e.subcategory} ${e.description}`, income: 0, expense: e.amount, id: `exp-${e.id}` });
      });
      entries.sort((a, b) => a.date.localeCompare(b.date));

      const bom = "\uFEFF";
      const header = "日付,種別,カテゴリ,勘定科目,摘要,収入,支出\n";
      const rows = entries.map(e => `${e.date},${e.type === "income" ? "収入" : "支出"},${e.category},${e.account_item},"${e.description}",${e.income || ""},${e.expense || ""}`).join("\n");
      const tIncome = entries.reduce((s, e) => s + e.income, 0);
      const tExpense = entries.reduce((s, e) => s + e.expense, 0);
      const summary = `\n\n年間サマリー（${year}年）\n収入合計,${tIncome}\n経費合計,${tExpense}\n所得,${tIncome - tExpense}`;

      const byAccount: { [k: string]: number } = {};
      entries.filter(e => e.type === "expense").forEach(e => { byAccount[e.account_item] = (byAccount[e.account_item] || 0) + e.expense; });
      const acSummary = "\n\n勘定科目別経費\n" + Object.entries(byAccount).map(([k, v]) => `${k},${v}`).join("\n");

      // 月別サマリー
      const byMonth: { [m: string]: { income: number; expense: number } } = {};
      for (let m = 1; m <= 12; m++) {
        const mk = `${year}-${String(m).padStart(2, "0")}`;
        byMonth[mk] = { income: 0, expense: 0 };
      }
      entries.forEach(e => {
        const mk = e.date.slice(0, 7);
        if (byMonth[mk]) { byMonth[mk].income += e.income; byMonth[mk].expense += e.expense; }
      });
      const monthSummary = "\n\n月別サマリー\n月,収入,経費,所得\n" + Object.entries(byMonth).map(([m, v]) => `${m},${v.income},${v.expense},${v.income - v.expense}`).join("\n");

      const blob = new Blob([bom + header + rows + summary + acSummary + monthSummary], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `帳簿_${year}年_年間.csv`; a.click();
      URL.revokeObjectURL(url);
    })();
  };

  /* ── 収支内訳書用データダウンロード ── */
  const downloadSyuushiCSV = () => {
    (async () => {
      const startDate = `${year}-01-01`;
      const endDate = `${year}-12-31`;
      const [{ data: stl }, { data: exp }] = await Promise.all([
        supabase.from("therapist_daily_settlements").select("*").eq("therapist_id", therapistId).gte("date", startDate).lte("date", endDate).eq("is_settled", true),
        supabase.from("therapist_expenses").select("*").eq("therapist_id", therapistId).gte("date", startDate).lte("date", endDate),
      ]);
      const tIncome = (stl || []).reduce((s: number, r: Settlement) => s + r.final_payment, 0);
      const byAccount: { [k: string]: number } = {};
      (exp || []).forEach((e: Expense) => { byAccount[e.account_item] = (byAccount[e.account_item] || 0) + e.amount; });
      const tExpense = Object.values(byAccount).reduce((s, v) => s + v, 0);

      const bom = "\uFEFF";
      let csv = bom;
      csv += `収支内訳書用データ（${year}年分）\n\n`;
      csv += `■ 収入\n`;
      csv += `事業収入（施術報酬）,${tIncome}\n\n`;
      csv += `■ 経費\n`;
      Object.entries(byAccount).sort().forEach(([k, v]) => { csv += `${k},${v}\n`; });
      csv += `経費合計,${tExpense}\n\n`;
      csv += `■ 所得\n`;
      csv += `事業所得（収入−経費）,${tIncome - tExpense}\n`;

      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `収支内訳書_${year}年.csv`; a.click();
      URL.revokeObjectURL(url);
    })();
  };

  /* ================================================================
     レンダリング
     ================================================================ */

  // テーブル未作成
  if (tableReady === false) {
    return (
      <div style={{ ...cardBase, padding: "20px" }}>
        <h2 className="text-[14px] font-bold mb-3" style={{ color: T.text }}>📒 帳簿機能セットアップ</h2>
        <p className="text-[11px] mb-4" style={{ color: T.textSub }}>帳簿機能を使うには、初回セットアップが必要です。</p>
        <button onClick={setupTable} style={btnPink}>🔧 セットアップ開始</button>
        {setupMsg && <p className="text-[11px] mt-3" style={{ color: setupMsg.includes("✅") ? green : orange }}>{setupMsg}</p>}
        {setupSql && (
          <div className="mt-3">
            <p className="text-[10px] mb-1" style={{ color: T.textMuted }}>Supabase SQL Editorで以下を実行：</p>
            <pre className="text-[8px] p-3 rounded-xl overflow-x-auto" style={{ backgroundColor: T.cardAlt, color: T.textSub }}>{setupSql}</pre>
          </div>
        )}
      </div>
    );
  }

  if (tableReady === null) {
    return <div className="text-center py-8"><p className="text-[11px]" style={{ color: T.textMuted }}>読み込み中...</p></div>;
  }

  return (
    <div className="space-y-3 pb-10">
      {/* ── サブタブ ── */}
      <div className="flex gap-1.5">
        {([["ledger", "📒 帳簿"], ["add", "➕ 経費入力"], ["download", "📥 ダウンロード"]] as const).map(([key, label]) => (
          <button key={key} onClick={() => setSubTab(key)}
            className="px-3 py-1.5 text-[10px] rounded-lg cursor-pointer border whitespace-nowrap"
            style={{ backgroundColor: subTab === key ? pinkLight : "transparent", color: subTab === key ? pink : T.textMuted, borderColor: subTab === key ? pink : T.border }}>
            {label}
          </button>
        ))}
      </div>

      {/* ── 月選択 ── */}
      <div className="flex items-center gap-2">
        <button onClick={() => { if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); }}
          className="px-2 py-1 rounded cursor-pointer" style={{ backgroundColor: T.cardAlt, color: T.textSub, border: "none" }}>◀</button>
        <span className="text-[13px] font-bold flex-1 text-center" style={{ color: T.text }}>{year}年{month}月</span>
        <button onClick={() => { if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1); }}
          className="px-2 py-1 rounded cursor-pointer" style={{ backgroundColor: T.cardAlt, color: T.textSub, border: "none" }}>▶</button>
      </div>

      {/* ── 月間サマリー ── */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl p-3 text-center" style={{ backgroundColor: green + "10", border: `1px solid ${green}33` }}>
          <p className="text-[8px]" style={{ color: green }}>収入</p>
          <p className="text-[13px] font-bold" style={{ color: green }}>{fmt(totalIncome)}</p>
        </div>
        <div className="rounded-xl p-3 text-center" style={{ backgroundColor: red + "10", border: `1px solid ${red}33` }}>
          <p className="text-[8px]" style={{ color: red }}>経費</p>
          <p className="text-[13px] font-bold" style={{ color: red }}>{fmt(totalExpense)}</p>
        </div>
        <div className="rounded-xl p-3 text-center" style={{ backgroundColor: profit >= 0 ? green + "10" : red + "10", border: `1px solid ${profit >= 0 ? green : red}33` }}>
          <p className="text-[8px]" style={{ color: T.textMuted }}>所得</p>
          <p className="text-[13px] font-bold" style={{ color: profit >= 0 ? green : red }}>{fmt(profit)}</p>
        </div>
      </div>

      {/* ============== 帳簿一覧 ============== */}
      {subTab === "ledger" && (
        <div style={{ ...cardBase, overflow: "hidden" }}>
          <div className="px-4 py-2.5 flex justify-between items-center" style={{ borderBottom: `1px solid ${T.border}`, backgroundColor: T.cardAlt }}>
            <span className="text-[11px] font-bold" style={{ color: T.text }}>📒 帳簿一覧（{monthKey}）</span>
            <span className="text-[9px]" style={{ color: T.textMuted }}>{ledger.length}件</span>
          </div>
          {loading ? (
            <p className="text-center py-6 text-[11px]" style={{ color: T.textMuted }}>読み込み中...</p>
          ) : ledger.length === 0 ? (
            <p className="text-center py-8 text-[11px]" style={{ color: T.textFaint }}>この月のデータはありません</p>
          ) : (
            <div>
              {/* ヘッダー */}
              <div className="grid grid-cols-12 gap-1 px-3 py-1.5 text-[8px] font-bold" style={{ borderBottom: `1px solid ${T.border}`, color: T.textMuted }}>
                <div className="col-span-2">日付</div>
                <div className="col-span-3">勘定科目</div>
                <div className="col-span-4">摘要</div>
                <div className="col-span-1 text-right">収入</div>
                <div className="col-span-1 text-right">支出</div>
                <div className="col-span-1"></div>
              </div>
              {ledger.map(entry => (
                <div key={entry.id} className="grid grid-cols-12 gap-1 px-3 py-2 items-center" style={{ borderBottom: `1px solid ${T.border}08` }}>
                  <div className="col-span-2 text-[9px]" style={{ color: T.textSub }}>{entry.date.slice(5)}</div>
                  <div className="col-span-3 text-[8px]" style={{ color: entry.type === "income" ? green : T.textSub }}>
                    {entry.account_item}
                  </div>
                  <div className="col-span-4 text-[8px] truncate" style={{ color: T.textSub }}>
                    {entry.receipt_url && <span style={{ color: orange }}>📎</span>}
                    {entry.description}
                  </div>
                  <div className="col-span-1 text-[9px] text-right font-medium" style={{ color: green }}>
                    {entry.income > 0 ? fmt(entry.income) : ""}
                  </div>
                  <div className="col-span-1 text-[9px] text-right font-medium" style={{ color: red }}>
                    {entry.expense > 0 ? fmt(entry.expense) : ""}
                  </div>
                  <div className="col-span-1 text-right">
                    {entry.type === "expense" && (
                      <div className="flex gap-0.5 justify-end">
                        <button onClick={() => startEdit(expenses.find(e => e.id === parseInt(entry.id.replace("exp-", "")))!)}
                          className="text-[8px] cursor-pointer" style={{ color: T.textMuted, background: "none", border: "none" }}>✏️</button>
                        <button onClick={() => deleteExpense(parseInt(entry.id.replace("exp-", "")))}
                          className="text-[8px] cursor-pointer" style={{ color: T.textMuted, background: "none", border: "none" }}>🗑</button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {/* 合計行 */}
              <div className="grid grid-cols-12 gap-1 px-3 py-2.5 font-bold" style={{ backgroundColor: T.cardAlt }}>
                <div className="col-span-2 text-[9px]" style={{ color: T.text }}>合計</div>
                <div className="col-span-3"></div>
                <div className="col-span-4"></div>
                <div className="col-span-1 text-[10px] text-right" style={{ color: green }}>{fmt(totalIncome)}</div>
                <div className="col-span-1 text-[10px] text-right" style={{ color: red }}>{fmt(totalExpense)}</div>
                <div className="col-span-1"></div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============== 経費入力 ============== */}
      {subTab === "add" && (
        <div className="space-y-3">
          {/* レシートアップロード */}
          <div style={{ ...cardBase, padding: "16px" }}>
            <p className="text-[12px] font-bold mb-2" style={{ color: T.text }}>📷 レシート撮影・アップロード</p>
            <p className="text-[9px] mb-3" style={{ color: T.textMuted }}>写真を撮るとAIが自動で読み取ります</p>
            <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handleFileChange} className="hidden" />
            <div className="flex gap-2">
              <button onClick={() => fileRef.current?.click()}
                className="flex-1 py-3 rounded-xl text-[11px] cursor-pointer"
                style={{ backgroundColor: pinkLight, color: pink, border: `1px dashed ${pink}`, fontWeight: 600 }}>
                📷 レシートを撮影
              </button>
              <button onClick={() => { const input = document.createElement("input"); input.type = "file"; input.accept = "image/*"; input.onchange = (e) => handleFileChange(e as unknown as React.ChangeEvent<HTMLInputElement>); input.click(); }}
                className="flex-1 py-3 rounded-xl text-[11px] cursor-pointer"
                style={{ backgroundColor: T.cardAlt, color: T.textSub, border: `1px dashed ${T.border}` }}>
                📁 ファイル選択
              </button>
            </div>
            {receiptPreview && (
              <div className="mt-3 text-center">
                <img src={receiptPreview} alt="レシート" className="max-h-40 mx-auto rounded-xl" style={{ border: `1px solid ${T.border}` }} />
              </div>
            )}
            {aiAnalyzing && (
              <div className="mt-2 text-center">
                <p className="text-[10px] animate-pulse" style={{ color: pink }}>🤖 AIが読み取り中...</p>
              </div>
            )}
            {aiResult && <p className="text-[10px] mt-2 text-center" style={{ color: aiResult.includes("✅") ? green : orange }}>{aiResult}</p>}
          </div>

          {/* カテゴリ選択 */}
          <div style={{ ...cardBase, padding: "16px" }}>
            <p className="text-[12px] font-bold mb-2" style={{ color: T.text }}>📂 カテゴリ</p>
            <div className="grid grid-cols-4 gap-1.5">
              {CATEGORIES.map(cat => (
                <button key={cat.label} onClick={() => setForm(prev => ({ ...prev, category: cat.label, account_item: cat.account, subcategory: "" }))}
                  className="flex flex-col items-center gap-0.5 py-2 rounded-xl cursor-pointer"
                  style={{ backgroundColor: form.category === cat.label ? pinkLight : T.cardAlt, border: `1px solid ${form.category === cat.label ? pink : "transparent"}` }}>
                  <span className="text-[16px]">{cat.icon}</span>
                  <span className="text-[8px]" style={{ color: form.category === cat.label ? pink : T.textMuted }}>{cat.label}</span>
                </button>
              ))}
            </div>

            {/* サブカテゴリ */}
            {form.category && (() => {
              const cat = CATEGORIES.find(c => c.label === form.category);
              return cat ? (
                <div className="mt-2 flex flex-wrap gap-1">
                  {cat.subs.map(sub => (
                    <button key={sub} onClick={() => setForm(prev => ({ ...prev, subcategory: sub }))}
                      className="px-2.5 py-1 text-[9px] rounded-lg cursor-pointer"
                      style={{ backgroundColor: form.subcategory === sub ? pink + "20" : "transparent", color: form.subcategory === sub ? pink : T.textMuted, border: `1px solid ${form.subcategory === sub ? pink : T.border}` }}>
                      {sub}
                    </button>
                  ))}
                </div>
              ) : null;
            })()}
          </div>

          {/* 入力フォーム */}
          <div style={{ ...cardBase, padding: "16px" }}>
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] mb-1" style={{ color: T.textSub }}>日付</label>
                <input type="date" value={form.date} onChange={e => setForm(prev => ({ ...prev, date: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={{ backgroundColor: T.cardAlt, color: T.text, border: `1px solid ${T.border}` }} />
              </div>
              <div>
                <label className="block text-[10px] mb-1" style={{ color: T.textSub }}>金額（税込）</label>
                <input type="number" inputMode="numeric" value={form.amount} onChange={e => setForm(prev => ({ ...prev, amount: e.target.value }))}
                  placeholder="例: 1500" className="w-full px-3 py-2.5 rounded-xl text-[14px] font-bold outline-none"
                  style={{ backgroundColor: T.cardAlt, color: T.text, border: `1px solid ${T.border}` }} />
              </div>
              <div>
                <label className="block text-[10px] mb-1" style={{ color: T.textSub }}>内容・品目</label>
                <input type="text" value={form.description} onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="例: ネイル代、電車代" className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none"
                  style={{ backgroundColor: T.cardAlt, color: T.text, border: `1px solid ${T.border}` }} />
              </div>
              <div>
                <label className="block text-[10px] mb-1" style={{ color: T.textSub }}>勘定科目</label>
                <div className="flex flex-wrap gap-1">
                  {ACCOUNT_ITEMS.map(item => (
                    <button key={item} onClick={() => setForm(prev => ({ ...prev, account_item: item }))}
                      className="px-2.5 py-1.5 text-[9px] rounded-lg cursor-pointer"
                      style={{ backgroundColor: form.account_item === item ? green + "20" : "transparent", color: form.account_item === item ? green : T.textMuted, border: `1px solid ${form.account_item === item ? green : T.border}` }}>
                      {item}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-[10px] mb-1" style={{ color: T.textSub }}>メモ（任意）</label>
                <input type="text" value={form.memo} onChange={e => setForm(prev => ({ ...prev, memo: e.target.value }))}
                  placeholder="店舗名や補足情報" className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none"
                  style={{ backgroundColor: T.cardAlt, color: T.text, border: `1px solid ${T.border}` }} />
              </div>

              <button onClick={saveExpense} disabled={saving}
                className="w-full py-3 rounded-xl text-[12px] cursor-pointer"
                style={{ ...btnPink, opacity: saving ? 0.6 : 1 }}>
                {saving ? "保存中..." : editId ? "✏️ 更新する" : "💾 経費を保存"}
              </button>
              {editId && (
                <button onClick={() => { setEditId(null); setForm({ date: new Date().toISOString().split("T")[0], category: "", subcategory: "", account_item: "", description: "", amount: "", memo: "" }); }}
                  className="w-full py-2 text-[11px] rounded-xl cursor-pointer" style={{ backgroundColor: "transparent", color: T.textMuted, border: `1px solid ${T.border}` }}>
                  キャンセル
                </button>
              )}
              {saveMsg && <p className="text-[10px] text-center" style={{ color: saveMsg.includes("✅") ? green : red }}>{saveMsg}</p>}
            </div>
          </div>

          {/* 今月の経費一覧 */}
          {expenses.length > 0 && (
            <div style={{ ...cardBase, overflow: "hidden" }}>
              <div className="px-4 py-2.5" style={{ borderBottom: `1px solid ${T.border}`, backgroundColor: T.cardAlt }}>
                <span className="text-[11px] font-bold" style={{ color: T.text }}>📝 今月の経費（{expenses.length}件 / {fmt(expenses.reduce((s, e) => s + e.amount, 0))}）</span>
              </div>
              {expenses.map(e => (
                <div key={e.id} className="px-4 py-2.5 flex items-center gap-2" style={{ borderBottom: `1px solid ${T.border}08` }}>
                  {e.receipt_thumb_url ? (
                    <a href={e.receipt_url} target="_blank" rel="noopener noreferrer">
                      <img src={e.receipt_thumb_url} alt="" className="w-8 h-8 rounded object-cover" style={{ border: `1px solid ${T.border}` }} />
                    </a>
                  ) : (
                    <div className="w-8 h-8 rounded flex items-center justify-center text-[10px]" style={{ backgroundColor: T.cardAlt }}>
                      {CATEGORIES.find(c => c.label === e.category)?.icon || "🛒"}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="text-[10px]" style={{ color: T.textSub }}>{e.date.slice(5)}</span>
                      <span className="text-[8px] px-1 rounded" style={{ backgroundColor: pinkLight, color: pink }}>{e.category}</span>
                    </div>
                    <p className="text-[10px] truncate" style={{ color: T.text }}>{e.subcategory} {e.description}</p>
                  </div>
                  <span className="text-[12px] font-bold flex-shrink-0" style={{ color: red }}>{fmt(e.amount)}</span>
                  <div className="flex flex-col gap-0.5">
                    <button onClick={() => startEdit(e)} className="text-[10px] cursor-pointer" style={{ color: T.textMuted, background: "none", border: "none" }}>✏️</button>
                    <button onClick={() => deleteExpense(e.id)} className="text-[10px] cursor-pointer" style={{ color: T.textMuted, background: "none", border: "none" }}>🗑</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ============== ダウンロード ============== */}
      {subTab === "download" && (
        <div className="space-y-3">
          <div style={{ ...cardBase, padding: "20px" }}>
            <h2 className="text-[14px] font-bold mb-4" style={{ color: T.text }}>📥 帳簿ダウンロード</h2>
            <div className="space-y-3">
              {/* 月間帳簿 */}
              <button onClick={downloadCSV} className="w-full p-4 rounded-xl text-left cursor-pointer" style={{ ...altCard, border: `1px solid ${pinkBorder}` }}>
                <div className="flex items-center gap-3">
                  <span className="text-[24px]">📒</span>
                  <div>
                    <p className="text-[12px] font-bold" style={{ color: T.text }}>月間帳簿（{monthKey}）</p>
                    <p className="text-[9px]" style={{ color: T.textMuted }}>CSV形式 / 収入{fmt(totalIncome)} 経費{fmt(totalExpense)}</p>
                  </div>
                </div>
              </button>

              {/* 年間帳簿 */}
              <button onClick={downloadYearCSV} className="w-full p-4 rounded-xl text-left cursor-pointer" style={{ ...altCard, border: `1px solid ${green}33` }}>
                <div className="flex items-center gap-3">
                  <span className="text-[24px]">📊</span>
                  <div>
                    <p className="text-[12px] font-bold" style={{ color: T.text }}>年間帳簿（{year}年）</p>
                    <p className="text-[9px]" style={{ color: T.textMuted }}>CSV形式 / 月別サマリー・勘定科目別集計付き</p>
                  </div>
                </div>
              </button>

              {/* 収支内訳書 */}
              <button onClick={downloadSyuushiCSV} className="w-full p-4 rounded-xl text-left cursor-pointer" style={{ ...altCard, border: `1px solid ${orange}33` }}>
                <div className="flex items-center gap-3">
                  <span className="text-[24px]">📄</span>
                  <div>
                    <p className="text-[12px] font-bold" style={{ color: T.text }}>収支内訳書用データ（{year}年）</p>
                    <p className="text-[9px]" style={{ color: T.textMuted }}>確定申告書に転記するための収支サマリー</p>
                  </div>
                </div>
              </button>
            </div>

            <div className="mt-4 p-3 rounded-xl" style={{ backgroundColor: T.cardAlt }}>
              <p className="text-[10px] font-bold mb-1" style={{ color: T.text }}>💡 ダウンロードしたCSVの使い方</p>
              <div className="space-y-1">
                {[
                  "Excelやスプレッドシートで開いて内容確認",
                  "税理士さんに渡す資料として活用",
                  "確定申告書への転記に使用",
                  "帳簿保存義務（7年間）の記録として保管",
                ].map((t, i) => (
                  <p key={i} className="text-[9px] flex gap-1" style={{ color: T.textSub }}>
                    <span style={{ color: green }}>✓</span>{t}
                  </p>
                ))}
              </div>
            </div>
          </div>

          {/* 年選択 */}
          <div className="flex items-center justify-center gap-3">
            <button onClick={() => setYear(y => y - 1)} className="px-3 py-1.5 rounded-lg cursor-pointer text-[11px]" style={{ backgroundColor: T.cardAlt, color: T.textSub, border: "none" }}>◀ {year - 1}年</button>
            <span className="text-[12px] font-bold" style={{ color: T.text }}>{year}年</span>
            <button onClick={() => setYear(y => y + 1)} className="px-3 py-1.5 rounded-lg cursor-pointer text-[11px]" style={{ backgroundColor: T.cardAlt, color: T.textSub, border: "none" }}>{year + 1}年 ▶</button>
          </div>
        </div>
      )}

      {/* ── 帳簿の保管に関する注意 ── */}
      <div className="p-3 rounded-xl" style={{ backgroundColor: T.cardAlt }}>
        <p className="text-[8px] leading-relaxed" style={{ color: T.textMuted }}>
          📋 帳簿の保存義務：個人事業主は帳簿を原則7年間保存する義務があります。このアプリのデータに加え、CSVダウンロードしたファイルも保管してください。
          レシート原本も可能な限り保管しましょう。
        </p>
      </div>
    </div>
  );
}
