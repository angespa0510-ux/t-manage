"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";
import { useTheme } from "../../lib/theme";
import { NavMenu } from "../../lib/nav-menu";
import { useBackNav } from "../../lib/use-back-nav";
import { jsPDF } from "jspdf";

/* ───────── 型定義 ───────── */
type Expense = {
  id: number; date: string; name: string; amount: number; type: string;
  category: string; store_id: number; is_recurring: boolean; notes: string;
  receipt_url: string; receipt_name: string; receipt_thumb_url: string;
  payment_method: string; keyword: string; counterpart: string; account_item: string;
  tax_rate: string; has_invoice: boolean; invoice_number: string;
  has_withholding: boolean; receipt_number: string;
};
type Keyword = {
  id: number; name: string; account_item: string;
  default_tax_rate: string; default_invoice: boolean; default_withholding: boolean; sort_order: number;
};
type Store = { id: number; name: string };

/* ───────── 定数 ───────── */
const ACCOUNT_ITEMS = [
  "消耗品費", "水道光熱費", "通信費", "旅費交通費", "広告宣伝費", "接待交際費",
  "地代家賃", "保険料", "租税公課", "支払手数料", "外注費", "雑費",
];
const TAX_RATES = ["10%", "8%", "対象外"];
const fmt = (n: number) => "¥" + (n || 0).toLocaleString();

/* ───────── 空フォーム ───────── */
const emptyForm = {
  date: new Date().toISOString().split("T")[0],
  amount: "", payment_method: "cash" as string, keyword: "",
  counterpart: "", name: "", account_item: "", tax_rate: "10%",
  has_invoice: true, invoice_number: "", has_withholding: false, receipt_number: "",
  type: "expense", store_id: 0, notes: "",
};

export default function ExpensesPage() {
  const router = useRouter();
  const { dark, toggle, T } = useTheme();

  /* ───── データ ───── */
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  /* ───── UI状態 ───── */
  const [tab, setTab] = useState<"list" | "keywords">("list");
  const [filterType, setFilterType] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<Expense | null>(null);

  // マウス戻るボタン対応: モーダル → タブ → 前のページ
  useBackNav(tab, setTab, [
    { isOpen: showForm, close: () => setShowForm(false) },
    { isOpen: !!editTarget, close: () => setEditTarget(null) },
  ]);

  const [form, setForm] = useState({ ...emptyForm });
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [keywordHistory, setKeywordHistory] = useState<Expense[]>([]);

  /* ───── キーワード設定用 ───── */
  const [kwForm, setKwForm] = useState({ name: "", account_item: "", default_tax_rate: "10%", default_invoice: true, default_withholding: false });
  const [editKw, setEditKw] = useState<Keyword | null>(null);
  const [kwMsg, setKwMsg] = useState("");
  const kwFormRef = useRef<HTMLDivElement>(null);

  const [smYear, smMonth] = selectedMonth.split("-").map(Number);
  const daysInMonth = new Date(smYear, smMonth, 0).getDate();

  /* ───── データ取得 ───── */
  const fetchData = useCallback(async () => {
    const startDate = `${selectedMonth}-01`;
    const endDate = `${selectedMonth}-${String(daysInMonth).padStart(2, "0")}`;
    const [{ data: e }, { data: k }, { data: s }] = await Promise.all([
      supabase.from("expenses").select("*").gte("date", startDate).lte("date", endDate).order("date", { ascending: false }),
      supabase.from("expense_keywords").select("*").order("sort_order").order("name"),
      supabase.from("stores").select("*").order("id"),
    ]);
    if (e) setExpenses(e);
    if (k) setKeywords(k);
    if (s) setStores(s);
  }, [selectedMonth, daysInMonth]);

  useEffect(() => {
    const check = async () => { const { data: { user } } = await supabase.auth.getUser(); if (!user) router.push("/"); };
    check(); fetchData();
  }, [router, fetchData]);

  /* ───── 証憑番号の自動生成 ───── */
  const generateReceiptNumber = async () => {
    const year = new Date(form.date || new Date()).getFullYear();
    const { data } = await supabase
      .from("expenses").select("receipt_number")
      .like("receipt_number", `${year}-%`)
      .order("receipt_number", { ascending: false }).limit(1);
    if (data && data.length > 0 && data[0].receipt_number) {
      const last = parseInt(data[0].receipt_number.split("-")[1]) || 0;
      return `${year}-${String(last + 1).padStart(4, "0")}`;
    }
    return `${year}-0001`;
  };

  /* ───── レシートアップロード（PDF変換＋サムネイル） ───── */
  const uploadReceipt = async (
    file: File, expenseId: number,
    meta: { date: string; receipt_number: string; keyword: string; name: string; account_item: string }
  ): Promise<{ url: string; name: string; thumbUrl: string }> => {
    const img = new Image();
    const reader = new FileReader();
    const dataUrl = await new Promise<string>((resolve) => {
      reader.onload = () => resolve(reader.result as string); reader.readAsDataURL(file);
    });
    await new Promise<void>((resolve) => { img.onload = () => resolve(); img.src = dataUrl; });

    // PDF生成（ヘッダーに証憑番号・日付・キーワード・勘定項目）
    const headerH = 100;
    const pW = Math.max(img.width, 600);
    const pH = img.height + headerH;
    const pdf = new jsPDF({ orientation: pW > pH ? "landscape" : "portrait", unit: "px", format: [pW, pH] });
    pdf.setFontSize(20); pdf.setTextColor(60, 60, 60);
    pdf.text(`[${meta.receipt_number}]`, 20, 30);
    pdf.setFontSize(14); pdf.setTextColor(80, 80, 80);
    pdf.text(`${meta.keyword || ""}${meta.keyword && meta.name ? " / " : ""}${meta.name}`, 20, 52);
    pdf.setFontSize(11); pdf.setTextColor(130, 130, 130);
    pdf.text(`date: ${meta.date}  account: ${meta.account_item || "---"}`, 20, 72);
    pdf.addImage(dataUrl, "JPEG", 0, headerH, img.width, img.height);
    const pdfBlob = pdf.output("blob");

    // ファイル名: 証憑番号_日付_キーワード.pdf
    const safeName = (meta.keyword || meta.name || "receipt").replace(/[^a-zA-Z0-9\u3000-\u9FFF\u4E00-\u9FAF\u3040-\u309F\u30A0-\u30FF]/g, "_").slice(0, 30);
    const pdfName = `${meta.receipt_number}_${meta.date}_${safeName}.pdf`;
    const thumbName = `thumb_${meta.receipt_number}_${meta.date}.jpg`;

    await supabase.storage.from("receipts").upload(pdfName, pdfBlob, { contentType: "application/pdf", upsert: true });

    // サムネイル生成
    const thumbBlob = await new Promise<Blob>((resolve) => {
      const c = document.createElement("canvas"); const ctx = c.getContext("2d")!;
      const scale = 200 / Math.max(img.width, img.height);
      c.width = img.width * scale; c.height = img.height * scale;
      ctx.drawImage(img, 0, 0, c.width, c.height);
      c.toBlob((b) => resolve(b!), "image/jpeg", 0.7);
    });
    await supabase.storage.from("receipts").upload(thumbName, thumbBlob, { contentType: "image/jpeg", upsert: true });

    const { data: pdfUrl } = supabase.storage.from("receipts").getPublicUrl(pdfName);
    const { data: thumbUrl } = supabase.storage.from("receipts").getPublicUrl(thumbName);
    return { url: pdfUrl.publicUrl, name: pdfName, thumbUrl: thumbUrl.publicUrl };
  };

  /* ───── キーワード選択 → 自動入力 + 履歴取得 ───── */
  const handleKeywordSelect = async (kwName: string) => {
    const kw = keywords.find((k) => k.name === kwName);
    if (kw) {
      setForm((p) => ({
        ...p, keyword: kw.name, account_item: kw.account_item,
        tax_rate: kw.default_tax_rate, has_invoice: kw.default_invoice, has_withholding: kw.default_withholding,
      }));
    } else {
      setForm((p) => ({ ...p, keyword: kwName }));
    }
    // 過去履歴を取得（同じキーワードの直近10件）
    const { data } = await supabase.from("expenses").select("*")
      .eq("keyword", kwName).order("date", { ascending: false }).limit(10);
    setKeywordHistory(data || []);
  };

  /* ───── 新規登録を開く ───── */
  const openAdd = async (type: string) => {
    const rn = await generateReceiptNumber();
    setForm({ ...emptyForm, type, receipt_number: rn });
    setEditTarget(null); setReceiptFile(null); setKeywordHistory([]); setShowForm(true); setMsg("");
  };

  /* ───── 編集を開く ───── */
  const openEdit = (e: Expense) => {
    setEditTarget(e);
    setForm({
      date: e.date, amount: String(e.amount), payment_method: e.payment_method || "cash",
      keyword: e.keyword || "", counterpart: e.counterpart || "", name: e.name, account_item: e.account_item || "",
      tax_rate: e.tax_rate || "10%", has_invoice: e.has_invoice ?? true,
      invoice_number: e.invoice_number || "",
      has_withholding: e.has_withholding ?? false, receipt_number: e.receipt_number || "",
      type: e.type || "expense", store_id: e.store_id || 0, notes: e.notes || "",
    });
    setReceiptFile(null); setKeywordHistory([]); setShowForm(true); setMsg("");
  };

  /* ───── 保存（新規 / 更新） ───── */
  const handleSave = async () => {
    if (!form.name.trim() || !form.amount) { setMsg("内容と金額を入力してください"); return; }
    setSaving(true); setMsg("");
    const payload = {
      date: form.date, name: form.name.trim(), amount: parseInt(form.amount) || 0,
      type: form.type, category: form.type === "income" ? "income" : "other",
      payment_method: form.payment_method, keyword: form.keyword, counterpart: form.counterpart.trim(),
      account_item: form.account_item,
      tax_rate: form.tax_rate, has_invoice: form.has_invoice,
      invoice_number: form.has_invoice ? form.invoice_number : "",
      has_withholding: form.has_withholding,
      receipt_number: form.receipt_number, store_id: form.store_id || 0, notes: form.notes.trim(),
    };
    let error;
    let savedId: number | null = null;
    if (editTarget) {
      ({ error } = await supabase.from("expenses").update(payload).eq("id", editTarget.id));
      savedId = editTarget.id;
    } else {
      ({ error } = await supabase.from("expenses").insert(payload));
      if (!error) {
        const { data: latest } = await supabase.from("expenses").select("id").order("id", { ascending: false }).limit(1).single();
        if (latest) savedId = latest.id;
      }
    }
    // レシートアップロード
    if (!error && receiptFile && savedId) {
      try {
        const r = await uploadReceipt(receiptFile, savedId, {
          date: form.date, receipt_number: form.receipt_number,
          keyword: form.keyword, name: form.name.trim(), account_item: form.account_item,
        });
        await supabase.from("expenses").update({
          receipt_url: r.url, receipt_name: r.name, receipt_thumb_url: r.thumbUrl,
        }).eq("id", savedId);
      } catch (e) { console.error("レシートアップロードエラー:", e); }
    }
    setSaving(false);
    if (error) { setMsg("保存失敗: " + error.message); }
    else {
      setMsg(editTarget ? "更新しました！" : "登録しました！");
      fetchData(); setTimeout(() => { setShowForm(false); setMsg(""); }, 600);
    }
  };

  /* ───── 削除 ───── */
  const handleDelete = async (id: number) => {
    if (!confirm("この経費を削除しますか？")) return;
    await supabase.from("expenses").delete().eq("id", id);
    fetchData();
  };

  /* ───── レシート削除 ───── */
  const handleDeleteReceipt = async (expense: Expense) => {
    if (!confirm("このレシートを削除しますか？")) return;
    // Storage からファイル削除
    if (expense.receipt_name) {
      await supabase.storage.from("receipts").remove([expense.receipt_name]);
    }
    const thumbKey = expense.receipt_thumb_url?.split("/").pop();
    if (thumbKey) {
      await supabase.storage.from("receipts").remove([thumbKey]);
    }
    // DB更新
    await supabase.from("expenses").update({
      receipt_url: "", receipt_name: "", receipt_thumb_url: "",
    }).eq("id", expense.id);
    // editTarget更新
    setEditTarget({ ...expense, receipt_url: "", receipt_name: "", receipt_thumb_url: "" });
    fetchData();
  };

  /* ───── キーワードCRUD ───── */
  const saveKeyword = async () => {
    if (!kwForm.name.trim()) { setKwMsg("キーワード名を入力してください"); return; }
    let error;
    if (editKw) {
      ({ error } = await supabase.from("expense_keywords").update({
        name: kwForm.name.trim(), account_item: kwForm.account_item,
        default_tax_rate: kwForm.default_tax_rate, default_invoice: kwForm.default_invoice,
        default_withholding: kwForm.default_withholding,
      }).eq("id", editKw.id));
    } else {
      ({ error } = await supabase.from("expense_keywords").insert({
        name: kwForm.name.trim(), account_item: kwForm.account_item,
        default_tax_rate: kwForm.default_tax_rate, default_invoice: kwForm.default_invoice,
        default_withholding: kwForm.default_withholding,
      }));
    }
    if (error) { setKwMsg("保存失敗: " + error.message); }
    else {
      setKwMsg(""); setEditKw(null);
      setKwForm({ name: "", account_item: "", default_tax_rate: "10%", default_invoice: true, default_withholding: false });
      fetchData();
    }
  };

  const deleteKeyword = async (id: number) => {
    if (!confirm("このキーワードを削除しますか？")) return;
    await supabase.from("expense_keywords").delete().eq("id", id);
    fetchData();
  };

  const startEditKw = (kw: Keyword) => {
    setEditKw(kw);
    setKwForm({
      name: kw.name, account_item: kw.account_item,
      default_tax_rate: kw.default_tax_rate, default_invoice: kw.default_invoice,
      default_withholding: kw.default_withholding,
    });
    setTimeout(() => kwFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
  };

  /* ───── フィルタ・集計 ───── */
  const filtered = expenses.filter((e) => filterType === "all" || e.type === filterType);
  const totalExpense = expenses.filter((e) => e.type !== "income").reduce((s, e) => s + e.amount, 0);
  const totalIncome = expenses.filter((e) => e.type === "income").reduce((s, e) => s + e.amount, 0);

  const prevMonth = () => { const d = new Date(smYear, smMonth - 2, 1); setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`); };
  const nextMonth = () => { const d = new Date(smYear, smMonth, 1); setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`); };

  const inputStyle = { backgroundColor: T.cardAlt, color: T.text, border: "1px solid transparent" };
  const chipStyle = (active: boolean, color: string) => ({
    backgroundColor: active ? color + "20" : "transparent",
    color: active ? color : T.textMuted,
    borderColor: active ? color : T.border,
  });

  return (
    <div className="h-screen flex flex-col" style={{ backgroundColor: T.bg, color: T.text }}>
      {/* ═══ Header ═══ */}
      <div className="h-[56px] flex items-center justify-between px-4 flex-shrink-0 border-b" style={{ backgroundColor: T.card, borderColor: T.border }}>
        <div className="flex items-center gap-3">
          <NavMenu T={T} dark={dark} />
          <h1 className="text-[14px] font-medium">💰 経費管理</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={toggle} className="px-2.5 py-1.5 text-[10px] rounded-lg cursor-pointer border" style={{ borderColor: T.border, color: T.textSub }}>{dark ? "☀️ ライト" : "🌙 ダーク"}</button>
          <button onClick={() => openAdd("expense")} className="px-3 py-1.5 text-[10px] rounded-lg cursor-pointer text-white" style={{ backgroundColor: "#c45555" }}>+ 経費</button>
          <button onClick={() => openAdd("income")} className="px-3 py-1.5 text-[10px] rounded-lg cursor-pointer text-white" style={{ backgroundColor: "#22c55e" }}>+ 入金</button>
        </div>
      </div>

      {/* ═══ タブ切替 ═══ */}
      <div className="h-[44px] flex items-center px-4 gap-1 flex-shrink-0 border-b" style={{ backgroundColor: T.card, borderColor: T.border }}>
        {[
          { key: "list" as const, label: "📋 経費一覧" },
          { key: "keywords" as const, label: "⚙️ キーワード設定" },
        ].map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className="px-4 py-1.5 text-[11px] rounded-lg cursor-pointer border"
            style={chipStyle(tab === t.key, "#c3a782")}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ═══════════════ 経費一覧タブ ═══════════════ */}
      {tab === "list" && (
        <>
          {/* Month Nav */}
          <div className="h-[48px] flex items-center justify-center gap-4 flex-shrink-0 border-b" style={{ backgroundColor: T.card, borderColor: T.border }}>
            <button onClick={prevMonth} className="p-1 cursor-pointer" style={{ color: T.textSub }}>◀</button>
            <span className="text-[14px] font-medium">{smYear}年{smMonth}月</span>
            <button onClick={nextMonth} className="p-1 cursor-pointer" style={{ color: T.textSub }}>▶</button>
          </div>

          {/* Summary */}
          <div className="px-4 py-3 flex gap-3 flex-shrink-0 overflow-x-auto" style={{ backgroundColor: T.cardAlt }}>
            {[
              { label: "経費合計", value: fmt(totalExpense), color: "#c45555" },
              { label: "入金合計", value: fmt(totalIncome), color: "#22c55e" },
              { label: "収支", value: fmt(totalIncome - totalExpense), color: totalIncome - totalExpense >= 0 ? "#22c55e" : "#c45555" },
              { label: "件数", value: `${expenses.length}件`, color: "#85a8c4" },
            ].map((s) => (
              <div key={s.label} className="rounded-xl px-4 py-3 border min-w-[120px]" style={{ backgroundColor: T.card, borderColor: T.border }}>
                <p className="text-[9px] mb-1" style={{ color: T.textMuted }}>{s.label}</p>
                <p className="text-[18px] font-light" style={{ color: s.color }}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Filter */}
          <div className="px-4 py-2 flex items-center gap-2 flex-shrink-0 border-b" style={{ borderColor: T.border }}>
            {[
              { key: "all", label: "全て", color: T.accent || "#c3a782" },
              { key: "expense", label: "経費", color: "#c45555" },
              { key: "income", label: "入金", color: "#22c55e" },
            ].map((f) => (
              <button key={f.key} onClick={() => setFilterType(filterType === f.key ? "all" : f.key)}
                className="px-2.5 py-1 rounded text-[10px] cursor-pointer border"
                style={chipStyle(filterType === f.key, f.color)}>
                {f.label}
              </button>
            ))}
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-[1200px] mx-auto p-4">
              <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: T.card, borderColor: T.border }}>
                {filtered.length === 0 ? (
                  <p className="text-[12px] text-center py-12" style={{ color: T.textFaint }}>データがありません</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-[11px] min-w-[1100px]">
                      <thead><tr style={{ borderBottom: `1px solid ${T.border}` }}>
                        {["証憑No", "日付", "決済", "KW", "相手先", "内容", "勘定項目", "税率", "INV", "源泉", "金額", "証憑", "操作"].map((h) => (
                          <th key={h} className="py-2.5 px-2 text-left font-normal text-[9px] whitespace-nowrap" style={{ color: T.textMuted }}>{h}</th>
                        ))}
                      </tr></thead>
                      <tbody>
                        {filtered.map((e) => {
                          const isIncome = e.type === "income";
                          return (
                            <tr key={e.id} className="hover:opacity-80" style={{ borderBottom: `1px solid ${T.border}` }}>
                              <td className="py-2 px-2 font-mono text-[10px]" style={{ color: T.textMuted }}>{e.receipt_number || "—"}</td>
                              <td className="py-2 px-2 whitespace-nowrap">{e.date}</td>
                              <td className="py-2 px-2">
                                <span className="px-1.5 py-0.5 rounded text-[9px]" style={{
                                  backgroundColor: e.payment_method === "card" ? "#85a8c418" : "#c3a78218",
                                  color: e.payment_method === "card" ? "#85a8c4" : "#c3a782",
                                }}>{e.payment_method === "card" ? "💳" : "💴"}</span>
                              </td>
                              <td className="py-2 px-2 text-[10px]" style={{ color: "#c3a782" }}>{e.keyword || "—"}</td>
                              <td className="py-2 px-2 text-[10px]" style={{ color: "#85a8c4" }}>{e.counterpart || "—"}</td>
                              <td className="py-2 px-2 font-medium max-w-[150px] truncate">{e.name}</td>
                              <td className="py-2 px-2 text-[10px]" style={{ color: T.textSub }}>{e.account_item || "—"}</td>
                              <td className="py-2 px-2 text-[10px]">{e.tax_rate || "—"}</td>
                              <td className="py-2 px-2 text-[10px]">
                                {e.has_invoice ? (
                                  <span title={e.invoice_number || "番号未入力"} className="cursor-help">
                                    ✅{e.invoice_number && <span className="ml-0.5 text-[8px]" style={{ color: "#22c55e" }}>📋</span>}
                                  </span>
                                ) : "—"}
                              </td>
                              <td className="py-2 px-2 text-[10px]">{e.has_withholding ? "✅" : "—"}</td>
                              <td className="py-2 px-2 font-medium whitespace-nowrap" style={{ color: isIncome ? "#22c55e" : "#c45555" }}>
                                {isIncome ? "+" : "-"}{fmt(e.amount)}
                              </td>
                              <td className="py-2 px-2">
                                {e.receipt_url ? (
                                  <a href={e.receipt_url} target="_blank" rel="noreferrer"
                                    className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded"
                                    style={{ backgroundColor: "#85a8c418", color: "#85a8c4" }}>
                                    {e.receipt_thumb_url ? (
                                      <img src={e.receipt_thumb_url} alt="証憑" className="inline-block rounded" style={{ width: 28, height: 28, objectFit: "cover" }} />
                                    ) : "📄"}PDF
                                  </a>
                                ) : <span style={{ color: T.textFaint }}>—</span>}
                              </td>
                              <td className="py-2 px-2">
                                <div className="flex gap-1">
                                  <button onClick={() => openEdit(e)} className="px-2 py-1 text-[9px] rounded cursor-pointer" style={{ color: "#3d6b9f", backgroundColor: "#3d6b9f18" }}>編集</button>
                                  <button onClick={() => handleDelete(e.id)} className="px-2 py-1 text-[9px] rounded cursor-pointer" style={{ color: "#c45555", backgroundColor: "#c4555518" }}>削除</button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ═══════════════ キーワード設定タブ ═══════════════ */}
      {tab === "keywords" && (
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-[700px] mx-auto p-4 space-y-4">
            {/* 登録フォーム */}
            <div ref={kwFormRef} className="rounded-2xl border p-5" style={{ backgroundColor: T.card, borderColor: T.border }}>
              <h3 className="text-[13px] font-medium mb-4">{editKw ? "✏️ キーワード編集" : "➕ キーワード登録"}</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] mb-1" style={{ color: T.textSub }}>キーワード名 *</label>
                  <input type="text" value={kwForm.name} onChange={(e) => setKwForm({ ...kwForm, name: e.target.value })}
                    placeholder="例: タオル仕入、電気代、交通費" className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} />
                </div>
                <div>
                  <label className="block text-[10px] mb-1" style={{ color: T.textSub }}>デフォルト勘定項目</label>
                  <select value={kwForm.account_item} onChange={(e) => setKwForm({ ...kwForm, account_item: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none cursor-pointer" style={inputStyle}>
                    <option value="">選択してください</option>
                    {ACCOUNT_ITEMS.map((a) => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
                <div className="flex gap-4 flex-wrap">
                  <div>
                    <label className="block text-[10px] mb-1" style={{ color: T.textSub }}>消費税率</label>
                    <div className="flex gap-1">
                      {TAX_RATES.map((r) => (
                        <button key={r} onClick={() => setKwForm({ ...kwForm, default_tax_rate: r })}
                          className="px-3 py-1.5 rounded-lg text-[10px] cursor-pointer border"
                          style={chipStyle(kwForm.default_tax_rate === r, "#c3a782")}>{r}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] mb-1" style={{ color: T.textSub }}>インボイス</label>
                    <button onClick={() => setKwForm({ ...kwForm, default_invoice: !kwForm.default_invoice })}
                      className="px-3 py-1.5 rounded-lg text-[10px] cursor-pointer border"
                      style={chipStyle(kwForm.default_invoice, "#22c55e")}>{kwForm.default_invoice ? "✅ あり" : "なし"}</button>
                  </div>
                  <div>
                    <label className="block text-[10px] mb-1" style={{ color: T.textSub }}>源泉徴収</label>
                    <button onClick={() => setKwForm({ ...kwForm, default_withholding: !kwForm.default_withholding })}
                      className="px-3 py-1.5 rounded-lg text-[10px] cursor-pointer border"
                      style={chipStyle(kwForm.default_withholding, "#f59e0b")}>{kwForm.default_withholding ? "✅ あり" : "なし"}</button>
                  </div>
                </div>
                {kwMsg && <p className="text-[11px]" style={{ color: "#c45555" }}>{kwMsg}</p>}
                <div className="flex gap-2 pt-1">
                  <button onClick={saveKeyword} className="px-5 py-2 text-white text-[11px] rounded-xl cursor-pointer" style={{ backgroundColor: "#c3a782" }}>
                    {editKw ? "更新" : "登録"}
                  </button>
                  {editKw && (
                    <button onClick={() => { setEditKw(null); setKwForm({ name: "", account_item: "", default_tax_rate: "10%", default_invoice: true, default_withholding: false }); }}
                      className="px-5 py-2 text-[11px] rounded-xl cursor-pointer border" style={{ borderColor: T.border, color: T.textSub }}>キャンセル</button>
                  )}
                </div>
              </div>
            </div>

            {/* 登録済みキーワード一覧 */}
            <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: T.card, borderColor: T.border }}>
              <div className="px-5 py-3 border-b" style={{ borderColor: T.border }}>
                <h3 className="text-[13px] font-medium">登録済みキーワード（{keywords.length}件）</h3>
              </div>
              {keywords.length === 0 ? (
                <p className="text-[12px] text-center py-8" style={{ color: T.textFaint }}>キーワードが未登録です</p>
              ) : (
                <div className="divide-y" style={{ borderColor: T.border }}>
                  {keywords.map((kw) => (
                    <div key={kw.id} className="px-5 py-3 flex items-center justify-between" style={{ borderColor: T.border }}>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-medium">{kw.name}</p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          {kw.account_item && <span className="text-[9px] px-2 py-0.5 rounded" style={{ backgroundColor: "#c3a78218", color: "#c3a782" }}>{kw.account_item}</span>}
                          <span className="text-[9px] px-2 py-0.5 rounded" style={{ backgroundColor: T.cardAlt, color: T.textMuted }}>{kw.default_tax_rate}</span>
                          {kw.default_invoice && <span className="text-[9px] px-2 py-0.5 rounded" style={{ backgroundColor: "#22c55e18", color: "#22c55e" }}>INV</span>}
                          {kw.default_withholding && <span className="text-[9px] px-2 py-0.5 rounded" style={{ backgroundColor: "#f59e0b18", color: "#f59e0b" }}>源泉</span>}
                        </div>
                      </div>
                      <div className="flex gap-1 ml-3">
                        <button onClick={() => startEditKw(kw)} className="px-2 py-1 text-[9px] rounded cursor-pointer" style={{ color: "#3d6b9f", backgroundColor: "#3d6b9f18" }}>編集</button>
                        <button onClick={() => deleteKeyword(kw.id)} className="px-2 py-1 text-[9px] rounded cursor-pointer" style={{ color: "#c45555", backgroundColor: "#c4555518" }}>削除</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ 経費登録/編集モーダル ═══════════════ */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowForm(false)}>
          <div className="rounded-2xl border p-5 w-full max-w-lg max-h-[92vh] overflow-y-auto animate-[fadeIn_0.25s]"
            style={{ backgroundColor: T.card, borderColor: T.border }} onClick={(e) => e.stopPropagation()}>
            <h2 className="text-[15px] font-medium mb-1">
              {editTarget ? "✏️ 経費編集" : form.type === "income" ? "💰 入金登録" : "📝 経費登録"}
            </h2>
            <p className="text-[10px] mb-4" style={{ color: T.textFaint }}>
              {form.receipt_number && `証憑番号: ${form.receipt_number}`}
            </p>

            <div className="space-y-3">
              {/* 種別 */}
              <div className="flex gap-2">
                <button onClick={() => setForm({ ...form, type: "expense" })} className="px-4 py-2 rounded-xl text-[11px] cursor-pointer border"
                  style={chipStyle(form.type === "expense", "#c45555")}>経費</button>
                <button onClick={() => setForm({ ...form, type: "income" })} className="px-4 py-2 rounded-xl text-[11px] cursor-pointer border"
                  style={chipStyle(form.type === "income", "#22c55e")}>入金</button>
              </div>

              {/* ① 日付 */}
              <div>
                <label className="block text-[10px] mb-1" style={{ color: T.textSub }}>① 日付 *</label>
                <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} />
              </div>

              {/* ② 金額 */}
              <div>
                <label className="block text-[10px] mb-1" style={{ color: T.textSub }}>② 支払い金額（税込）*</label>
                <input type="text" inputMode="numeric" value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value.replace(/[^0-9]/g, "") })}
                  placeholder="50000" className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} />
              </div>

              {/* ③ 決済手段 */}
              <div>
                <label className="block text-[10px] mb-1" style={{ color: T.textSub }}>③ 決済手段</label>
                <div className="flex gap-2">
                  {[{ v: "cash", l: "💴 現金" }, { v: "card", l: "💳 カード" }].map((m) => (
                    <button key={m.v} onClick={() => setForm({ ...form, payment_method: m.v })}
                      className="px-4 py-2 rounded-xl text-[11px] cursor-pointer border"
                      style={chipStyle(form.payment_method === m.v, "#c3a782")}>{m.l}</button>
                  ))}
                </div>
              </div>

              {/* ④ キーワード */}
              {form.type !== "income" && (
                <div>
                  <label className="block text-[10px] mb-1" style={{ color: T.textSub }}>④ キーワード（選択で自動入力）</label>
                  {keywords.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {keywords.map((kw) => (
                        <button key={kw.id} onClick={() => handleKeywordSelect(kw.name)}
                          className="px-3 py-1.5 rounded-xl text-[10px] cursor-pointer border"
                          style={chipStyle(form.keyword === kw.name, "#c3a782")}>{kw.name}</button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[10px] mb-2" style={{ color: T.textFaint }}>※ キーワード未登録（「キーワード設定」タブで登録）</p>
                  )}
                  <input type="text" value={form.keyword} onChange={(e) => setForm({ ...form, keyword: e.target.value })}
                    placeholder="手入力も可" className="w-full px-3 py-2 rounded-xl text-[12px] outline-none" style={inputStyle} />
                  {/* キーワード過去履歴 */}
                  {keywordHistory.length > 0 && (
                    <div className="mt-2 rounded-lg border p-2" style={{ backgroundColor: T.cardAlt, borderColor: T.border }}>
                      <p className="text-[9px] font-medium mb-1.5" style={{ color: "#c3a782" }}>📋 過去の履歴（直近{keywordHistory.length}件）— タップで個別反映 / 一括で日時以外すべて反映</p>
                      <div className="max-h-[240px] overflow-y-auto">
                        {keywordHistory.map((h) => (
                          <div key={h.id} className="py-1.5 text-[10px]" style={{ borderBottom: `1px solid ${T.border}` }}>
                            <div className="flex items-center gap-1 flex-wrap">
                              <span className="flex-shrink-0" style={{ color: T.textMuted }}>{h.date}</span>
                              <span className="px-1 rounded cursor-pointer hover:opacity-70"
                                onClick={() => setForm((p) => ({ ...p, payment_method: h.payment_method || "cash" }))}
                                style={{ backgroundColor: h.payment_method === "card" ? "#85a8c418" : "#c3a78218", color: h.payment_method === "card" ? "#85a8c4" : "#c3a782" }}>
                                {h.payment_method === "card" ? "💳" : "💴"}
                              </span>
                              {h.counterpart && (
                                <span className="px-1 rounded cursor-pointer hover:opacity-70"
                                  onClick={() => setForm((p) => ({ ...p, counterpart: h.counterpart }))}
                                  style={{ color: "#85a8c4", backgroundColor: "#85a8c418" }}>{h.counterpart}</span>
                              )}
                              <span className="flex-1 truncate cursor-pointer hover:opacity-70"
                                onClick={() => setForm((p) => ({ ...p, name: h.name }))}>{h.name}</span>
                              <span className="font-medium cursor-pointer hover:opacity-70"
                                onClick={() => setForm((p) => ({ ...p, amount: String(h.amount) }))}
                                style={{ color: "#c45555" }}>{fmt(h.amount)}</span>
                            </div>
                            <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                              {h.account_item && <span className="text-[8px] px-1 rounded" style={{ backgroundColor: "#c3a78215", color: T.textMuted }}>{h.account_item}</span>}
                              <span className="text-[8px] px-1 rounded" style={{ backgroundColor: T.bg, color: T.textMuted }}>{h.tax_rate || "10%"}</span>
                              {h.has_invoice && <span className="text-[8px] px-1 rounded" style={{ color: "#22c55e" }}>INV{h.invoice_number ? ` ${h.invoice_number}` : ""}</span>}
                              {h.has_withholding && <span className="text-[8px] px-1 rounded" style={{ color: "#f59e0b" }}>源泉</span>}
                              <button
                                onClick={() => setForm((p) => ({
                                  ...p,
                                  amount: String(h.amount), payment_method: h.payment_method || "cash",
                                  counterpart: h.counterpart || "", name: h.name,
                                  account_item: h.account_item || "", tax_rate: h.tax_rate || "10%",
                                  has_invoice: h.has_invoice ?? true, invoice_number: h.invoice_number || "",
                                  has_withholding: h.has_withholding ?? false, notes: h.notes || "",
                                }))}
                                className="ml-auto text-[8px] px-2 py-0.5 rounded cursor-pointer"
                                style={{ backgroundColor: "#c3a78225", color: "#c3a782" }}>
                                📥 一括反映
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ⑤ 相手先 */}
              <div>
                <label className="block text-[10px] mb-1" style={{ color: T.textSub }}>⑤ 相手先</label>
                <input type="text" value={form.counterpart} onChange={(e) => setForm({ ...form, counterpart: e.target.value })}
                  placeholder="例: 株式会社○○、ダイソー、中部電力" className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} />
              </div>

              {/* ⑥ 内容 */}
              <div>
                <label className="block text-[10px] mb-1" style={{ color: T.textSub }}>⑥ 内容（メモ・詳細）*</label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="例: 業務用タオル 50枚" className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} />
              </div>

              {/* ⑦ 勘定項目 */}
              {form.type !== "income" && (
                <div>
                  <label className="block text-[10px] mb-1" style={{ color: T.textSub }}>⑦ 勘定項目{form.keyword ? "（自動セット済）" : ""}</label>
                  <select value={form.account_item} onChange={(e) => setForm({ ...form, account_item: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none cursor-pointer" style={inputStyle}>
                    <option value="">選択してください</option>
                    {ACCOUNT_ITEMS.map((a) => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
              )}

              {/* ⑧⑨⑩ 消費税・インボイス・源泉 */}
              {form.type !== "income" && (
                <div className="flex gap-4 flex-wrap">
                  <div>
                    <label className="block text-[10px] mb-1" style={{ color: T.textSub }}>⑧ 消費税</label>
                    <div className="flex gap-1">
                      {TAX_RATES.map((r) => (
                        <button key={r} onClick={() => setForm({ ...form, tax_rate: r })}
                          className="px-3 py-1.5 rounded-lg text-[10px] cursor-pointer border"
                          style={chipStyle(form.tax_rate === r, "#c3a782")}>{r}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] mb-1" style={{ color: T.textSub }}>⑨ インボイス</label>
                    <button onClick={() => setForm({ ...form, has_invoice: !form.has_invoice })}
                      className="px-3 py-1.5 rounded-lg text-[10px] cursor-pointer border"
                      style={chipStyle(form.has_invoice, "#22c55e")}>{form.has_invoice ? "✅ あり" : "なし（免税）"}</button>
                  </div>
                  <div>
                    <label className="block text-[10px] mb-1" style={{ color: T.textSub }}>⑩ 源泉徴収</label>
                    <button onClick={() => setForm({ ...form, has_withholding: !form.has_withholding })}
                      className="px-3 py-1.5 rounded-lg text-[10px] cursor-pointer border"
                      style={chipStyle(form.has_withholding, "#f59e0b")}>{form.has_withholding ? "✅ あり" : "なし"}</button>
                  </div>
                </div>
              )}

              {/* ⑨-b インボイス登録番号（T+13桁） */}
              {form.type !== "income" && form.has_invoice && (
                <div>
                  <label className="block text-[10px] mb-1" style={{ color: T.textSub }}>登録番号（T＋13桁）</label>
                  <div className="flex items-center gap-1">
                    <span className="text-[13px] font-mono font-bold" style={{ color: "#22c55e" }}>T</span>
                    <input type="text" inputMode="numeric" value={form.invoice_number.replace(/^T/, "")}
                      onChange={(e) => {
                        const v = e.target.value.replace(/[^0-9]/g, "").slice(0, 13);
                        setForm({ ...form, invoice_number: v ? `T${v}` : "" });
                      }}
                      placeholder="1234567890123" maxLength={13}
                      className="flex-1 px-3 py-2.5 rounded-xl text-[12px] outline-none font-mono tracking-wider" style={inputStyle} />
                  </div>
                  {form.invoice_number && form.invoice_number.length !== 14 && (
                    <p className="text-[9px] mt-1" style={{ color: "#f59e0b" }}>※ T＋13桁で入力してください（現在 {form.invoice_number.length - 1}桁）</p>
                  )}
                </div>
              )}

              {/* ⑪ 証憑番号 */}
              <div>
                <label className="block text-[10px] mb-1" style={{ color: T.textSub }}>⑪ 証憑番号（自動連番）</label>
                <input type="text" value={form.receipt_number} onChange={(e) => setForm({ ...form, receipt_number: e.target.value })}
                  placeholder="2026-0001" className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none font-mono" style={inputStyle} />
              </div>

              {/* 📸 レシート / 領収書 */}
              <div>
                <label className="block text-[10px] mb-2" style={{ color: T.textSub }}>📸 レシート / 領収書</label>
                <div className="rounded-xl border p-4" style={{ backgroundColor: T.cardAlt, borderColor: T.border }}>
                  {/* 既存レシート表示 */}
                  {editTarget?.receipt_url && (
                    <div className="mb-3">
                      <div className="flex items-center gap-3 p-2 rounded-lg" style={{ backgroundColor: "#22c55e15" }}>
                        <a href={editTarget.receipt_url} target="_blank" rel="noreferrer" className="flex items-center gap-3 flex-1 min-w-0">
                          {editTarget.receipt_thumb_url ? (
                            <img src={editTarget.receipt_thumb_url} alt="証憑" className="rounded-lg" style={{ width: 48, height: 48, objectFit: "cover", border: "1px solid rgba(255,255,255,0.1)" }} />
                          ) : (
                            <div className="flex items-center justify-center rounded-lg" style={{ width: 48, height: 48, backgroundColor: "#85a8c420" }}>📄</div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-medium truncate" style={{ color: "#22c55e" }}>✅ 証憑PDF登録済み</p>
                            <p className="text-[9px] truncate" style={{ color: T.textMuted }}>{editTarget.receipt_name || "PDF"}</p>
                          </div>
                        </a>
                        <button onClick={() => handleDeleteReceipt(editTarget)}
                          className="px-2.5 py-1.5 rounded-lg text-[10px] cursor-pointer flex-shrink-0"
                          style={{ backgroundColor: "#c4555520", color: "#c45555" }}>
                          🗑 削除
                        </button>
                      </div>
                    </div>
                  )}

                  {/* 新規アップロード */}
                  {receiptFile ? (
                    <div className="flex items-center gap-3 p-2 rounded-lg" style={{ backgroundColor: "#22c55e15" }}>
                      <div className="flex items-center justify-center rounded-lg" style={{ width: 48, height: 48, backgroundColor: "#22c55e20" }}>
                        <span className="text-[20px]">📷</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-medium" style={{ color: "#22c55e" }}>✅ {receiptFile.name}</p>
                        <p className="text-[9px]" style={{ color: T.textMuted }}>保存時にPDF変換されます</p>
                      </div>
                      <button onClick={() => setReceiptFile(null)}
                        className="px-2.5 py-1.5 rounded-lg text-[10px] cursor-pointer flex-shrink-0"
                        style={{ backgroundColor: "#c4555520", color: "#c45555" }}>
                        ✕ 取消
                      </button>
                    </div>
                  ) : (
                    <label className="flex items-center justify-center gap-2 py-3 rounded-xl cursor-pointer border-2 border-dashed transition-opacity hover:opacity-80"
                      style={{ borderColor: "#22c55e50", color: "#22c55e" }}>
                      <span className="text-[16px]">📷</span>
                      <span className="text-[12px] font-medium">写真を選択</span>
                      <input type="file" accept="image/*" capture="environment" className="hidden"
                        onChange={(e) => setReceiptFile(e.target.files?.[0] || null)} />
                    </label>
                  )}

                  <p className="text-[8px] mt-2" style={{ color: T.textFaint }}>
                    保存名: {form.receipt_number}_{form.date}_{form.keyword || form.name || "receipt"}.pdf
                  </p>
                </div>
              </div>

              {/* 備考 */}
              <div>
                <label className="block text-[10px] mb-1" style={{ color: T.textSub }}>備考</label>
                <input type="text" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="メモ" className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} />
              </div>

              {/* メッセージ */}
              {msg && (
                <div className="px-4 py-3 rounded-xl text-[12px]" style={{
                  backgroundColor: msg.includes("失敗") || msg.includes("入力") ? "#c4988518" : "#7ab88f18",
                  color: msg.includes("失敗") || msg.includes("入力") ? "#c49885" : "#5a9e6f",
                }}>{msg}</div>
              )}

              {/* ボタン */}
              <div className="flex gap-3 pt-2">
                <button onClick={handleSave} disabled={saving}
                  className="px-6 py-2.5 text-white text-[12px] rounded-xl cursor-pointer disabled:opacity-60"
                  style={{ backgroundColor: form.type === "income" ? "#22c55e" : "#c3a782" }}>
                  {saving ? "保存中..." : editTarget ? "更新する" : "登録する"}
                </button>
                <button onClick={() => { setShowForm(false); setMsg(""); }}
                  className="px-6 py-2.5 border text-[12px] rounded-xl cursor-pointer" style={{ borderColor: T.border, color: T.textSub }}>キャンセル</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  );
}
