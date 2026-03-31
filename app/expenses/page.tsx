"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";
import { useTheme } from "../../lib/theme";
import { NavMenu } from "../../lib/nav-menu";
import { jsPDF } from "jspdf";

type Expense = {
  id: number; date: string; category: string; name: string; amount: number;
  store_id: number; is_recurring: boolean; notes: string; type: string;
  receipt_url: string; receipt_name: string; receipt_thumb_url: string;
};
type Store = { id: number; name: string };

const CATEGORIES: Record<string, { label: string; color: string; icon: string }> = {
  rent: { label: "家賃", color: "#c49885", icon: "🏠" },
  utilities: { label: "光熱費", color: "#f59e0b", icon: "💡" },
  supplies: { label: "消耗品・備品", color: "#85a8c4", icon: "📦" },
  transport: { label: "交通費", color: "#7ab88f", icon: "🚗" },
  advertising: { label: "広告費", color: "#a885c4", icon: "📢" },
  therapist_back: { label: "セラピストバック", color: "#c3a782", icon: "💆" },
  income: { label: "入金", color: "#22c55e", icon: "💰" },
  other: { label: "その他", color: "#888780", icon: "📄" },
};

const fmt = (n: number) => "¥" + (n || 0).toLocaleString();

export default function ExpensesPage() {
  const router = useRouter();
  const { dark, toggle, T } = useTheme();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; });
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterType, setFilterType] = useState("all");

  // Add
  const [showAdd, setShowAdd] = useState(false);
  const [addType, setAddType] = useState("expense");
  const [addDate, setAddDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [addCategory, setAddCategory] = useState("other");
  const [addName, setAddName] = useState("");
  const [addAmount, setAddAmount] = useState("");
  const [addStoreId, setAddStoreId] = useState(0);
  const [addRecurring, setAddRecurring] = useState(false);
  const [addNotes, setAddNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  // Edit
  const [editTarget, setEditTarget] = useState<Expense | null>(null);
  const [editType, setEditType] = useState("expense");
  const [editDate, setEditDate] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editName, setEditName] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editStoreId, setEditStoreId] = useState(0);
  const [editRecurring, setEditRecurring] = useState(false);
  const [editNotes, setEditNotes] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [addReceiptFile, setAddReceiptFile] = useState<File | null>(null);
  const [editReceiptFile, setEditReceiptFile] = useState<File | null>(null);
  const [editMsg, setEditMsg] = useState("");

  const [smYear, smMonth] = selectedMonth.split("-").map(Number);
  const daysInMonth = new Date(smYear, smMonth, 0).getDate();

  const fetchData = useCallback(async () => {
    const startDate = `${selectedMonth}-01`;
    const endDate = `${selectedMonth}-${String(daysInMonth).padStart(2, "0")}`;
    const { data: e } = await supabase.from("expenses").select("*").gte("date", startDate).lte("date", endDate).order("date", { ascending: false });
    if (e) setExpenses(e);
    const { data: s } = await supabase.from("stores").select("*").order("id");
    if (s) setStores(s);
  }, [selectedMonth, daysInMonth]);

  useEffect(() => { const check = async () => { const { data: { user } } = await supabase.auth.getUser(); if (!user) router.push("/"); }; check(); fetchData(); }, [router, fetchData]);

  const uploadReceipt = async (file: File, expenseId: number, meta: { date: string; category: string; name: string }): Promise<{ url: string; name: string; thumbUrl: string }> => {
    const img = new Image();
    const reader = new FileReader();
    const dataUrl = await new Promise<string>((resolve) => { reader.onload = () => resolve(reader.result as string); reader.readAsDataURL(file); });
    await new Promise<void>((resolve) => { img.onload = () => resolve(); img.src = dataUrl; });
    const catLabel = CATEGORIES[meta.category]?.label || meta.category;
    const headerH = 80;
    const pW = Math.max(img.width, 600);
    const pH = img.height + headerH;
    const pdf = new jsPDF({ orientation: pW > pH ? "landscape" : "portrait", unit: "px", format: [pW, pH] });
    pdf.setFontSize(18); pdf.setTextColor(60, 60, 60);
    pdf.text(`${catLabel}`, 20, 30);
    pdf.setFontSize(14); pdf.setTextColor(100, 100, 100);
    pdf.text(`${meta.name}`, 20, 52);
    pdf.setFontSize(11); pdf.setTextColor(150, 150, 150);
    pdf.text(`日付: ${meta.date}`, 20, 70);
    pdf.addImage(dataUrl, "JPEG", 0, headerH, img.width, img.height);
    const pdfBlob = pdf.output("blob");
    const ts = Date.now();
    const pdfName = `receipt_${meta.date}_${expenseId}.pdf`;
    const thumbName = `thumb_${meta.date}_${expenseId}.jpg`;
    await supabase.storage.from("receipts").upload(pdfName, pdfBlob, { contentType: "application/pdf", upsert: true });
    const thumbBlob = await new Promise<Blob>((resolve) => { const c = document.createElement("canvas"); const ctx = c.getContext("2d")!; const scale = 200 / Math.max(img.width, img.height); c.width = img.width * scale; c.height = img.height * scale; ctx.drawImage(img, 0, 0, c.width, c.height); c.toBlob(b => resolve(b!), "image/jpeg", 0.7); });
    await supabase.storage.from("receipts").upload(thumbName, thumbBlob, { contentType: "image/jpeg", upsert: true });
    const { data: pdfUrl } = supabase.storage.from("receipts").getPublicUrl(pdfName);
    const { data: thumbUrl } = supabase.storage.from("receipts").getPublicUrl(thumbName);
    return { url: pdfUrl.publicUrl, name: file.name, thumbUrl: thumbUrl.publicUrl };
  };

  const handleAdd = async () => {
    if (!addName.trim() || !addAmount) { setMsg("名目と金額を入力してください"); return; }
    setSaving(true); setMsg("");
    const { error } = await supabase.from("expenses").insert({
      date: addDate, category: addType === "income" ? "income" : addCategory, name: addName.trim(),
      amount: parseInt(addAmount) || 0, store_id: addStoreId || 0, is_recurring: addRecurring,
      notes: addNotes.trim(), type: addType,
    });
    setSaving(false);
    if (error) { setMsg("登録失敗: " + error.message); }
    else {
      setMsg("登録しました！"); if (addReceiptFile) {
        const { data: latest } = await supabase.from("expenses").select("id").order("id", { ascending: false }).limit(1).single();
        if (latest) { try { const r = await uploadReceipt(addReceiptFile, latest.id, { date: addDate, category: addType === "income" ? "income" : addCategory, name: addName.trim() }); await supabase.from("expenses").update({ receipt_url: r.url, receipt_name: `${addDate}_${addName.trim()}`, receipt_thumb_url: r.thumbUrl }).eq("id", latest.id); } catch (e) { console.error(e); } }
      }
      setAddName(""); setAddAmount(""); setAddNotes(""); setAddRecurring(false); setAddReceiptFile(null);
      fetchData(); setTimeout(() => { setShowAdd(false); setMsg(""); }, 600);
    }
  };

  const startEdit = (e: Expense) => {
    setEditTarget(e); setEditType(e.type || "expense"); setEditDate(e.date); setEditCategory(e.category);
    setEditName(e.name); setEditAmount(String(e.amount)); setEditStoreId(e.store_id);
    setEditRecurring(e.is_recurring); setEditNotes(e.notes || ""); setEditMsg("");
  };

  const handleUpdate = async () => {
    if (!editTarget || !editName.trim()) return;
    setEditSaving(true); setEditMsg("");
    const { error } = await supabase.from("expenses").update({
      date: editDate, category: editType === "income" ? "income" : editCategory, name: editName.trim(),
      amount: parseInt(editAmount) || 0, store_id: editStoreId || 0, is_recurring: editRecurring,
      notes: editNotes.trim(), type: editType,
    }).eq("id", editTarget.id);
    setEditSaving(false);
    if (error) { setEditMsg("更新失敗: " + error.message); }
    else { setEditMsg("更新しました！"); if (editReceiptFile) { try { const r = await uploadReceipt(editReceiptFile, editTarget.id, { date: editDate, category: editType === "income" ? "income" : editCategory, name: editName.trim() }); await supabase.from("expenses").update({ receipt_url: r.url, receipt_name: `${editDate}_${editName.trim()}`, receipt_thumb_url: r.thumbUrl }).eq("id", editTarget.id); } catch (e) { console.error(e); } }
      fetchData(); setTimeout(() => { setEditTarget(null); setEditMsg(""); }, 600); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("削除しますか？")) return;
    await supabase.from("expenses").delete().eq("id", id);
    fetchData();
  };

  const filtered = expenses.filter((e) => {
    const matchCat = filterCategory === "all" || e.category === filterCategory;
    const matchType = filterType === "all" || e.type === filterType;
    return matchCat && matchType;
  });

  const totalExpense = expenses.filter((e) => e.type !== "income").reduce((s, e) => s + e.amount, 0);
  const totalIncome = expenses.filter((e) => e.type === "income").reduce((s, e) => s + e.amount, 0);
  const balance = totalIncome - totalExpense;

  // カテゴリ別集計
  const categoryTotals = Object.entries(CATEGORIES).map(([key, val]) => {
    const total = expenses.filter((e) => e.category === key).reduce((s, e) => s + e.amount, 0);
    return { key, ...val, total };
  }).filter((c) => c.total > 0).sort((a, b) => b.total - a.total);

  const prevMonth = () => { const d = new Date(smYear, smMonth - 2, 1); setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`); };
  const nextMonth = () => { const d = new Date(smYear, smMonth, 1); setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`); };

  const inputStyle = { backgroundColor: T.cardAlt, color: T.text, border: "1px solid transparent" };
  const getStoreName = (id: number) => stores.find((s) => s.id === id)?.name || "";

  return (
    <div className="h-screen flex flex-col" style={{ backgroundColor: T.bg, color: T.text }}>
      {/* Header */}
      <div className="h-[56px] flex items-center justify-between px-4 flex-shrink-0 border-b" style={{ backgroundColor: T.card, borderColor: T.border }}>
        <div className="flex items-center gap-3">
          <NavMenu T={T} dark={dark} />
          <h1 className="text-[14px] font-medium">経費管理</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={toggle} className="px-2.5 py-1.5 text-[10px] rounded-lg cursor-pointer border" style={{ borderColor: T.border, color: T.textSub }}>{dark ? "☀️ ライト" : "🌙 ダーク"}</button>
          <button onClick={() => { setShowAdd(true); setAddType("expense"); setMsg(""); }} className="px-3 py-1.5 text-[10px] rounded-lg cursor-pointer text-white" style={{ backgroundColor: "#c45555" }}>+ 経費</button>
          <button onClick={() => { setShowAdd(true); setAddType("income"); setMsg(""); }} className="px-3 py-1.5 text-[10px] rounded-lg cursor-pointer text-white" style={{ backgroundColor: "#22c55e" }}>+ 入金</button>
        </div>
      </div>

      {/* Month Nav */}
      <div className="h-[48px] flex items-center justify-center gap-4 flex-shrink-0 border-b" style={{ backgroundColor: T.card, borderColor: T.border }}>
        <button onClick={prevMonth} className="p-1 cursor-pointer" style={{ color: T.textSub }}>◀</button>
        <span className="text-[14px] font-medium">{smYear}年{smMonth}月</span>
        <button onClick={nextMonth} className="p-1 cursor-pointer" style={{ color: T.textSub }}>▶</button>
      </div>

      {/* Summary Cards */}
      <div className="px-4 py-3 flex gap-3 flex-shrink-0 overflow-x-auto" style={{ backgroundColor: T.cardAlt }}>
        {[
          { label: "経費合計", value: fmt(totalExpense), color: "#c45555" },
          { label: "入金合計", value: fmt(totalIncome), color: "#22c55e" },
          { label: "収支", value: fmt(balance), color: balance >= 0 ? "#22c55e" : "#c45555" },
          { label: "件数", value: `${expenses.length}件`, color: "#85a8c4" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl px-4 py-3 border min-w-[130px]" style={{ backgroundColor: T.card, borderColor: T.border }}>
            <p className="text-[9px] mb-1" style={{ color: T.textMuted }}>{s.label}</p>
            <p className="text-[18px] font-light" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="px-4 py-2 flex items-center gap-2 flex-wrap flex-shrink-0 border-b" style={{ borderColor: T.border }}>
        <button onClick={() => setFilterType("all")} className="px-2 py-1 rounded text-[9px] cursor-pointer border" style={{ borderColor: filterType === "all" ? T.accent : T.border, color: filterType === "all" ? T.accent : T.textMuted, fontWeight: filterType === "all" ? 600 : 400 }}>全て</button>
        <button onClick={() => setFilterType(filterType === "expense" ? "all" : "expense")} className="px-2 py-1 rounded text-[9px] cursor-pointer border" style={{ borderColor: filterType === "expense" ? "#c45555" : T.border, color: filterType === "expense" ? "#c45555" : T.textMuted }}>経費のみ</button>
        <button onClick={() => setFilterType(filterType === "income" ? "all" : "income")} className="px-2 py-1 rounded text-[9px] cursor-pointer border" style={{ borderColor: filterType === "income" ? "#22c55e" : T.border, color: filterType === "income" ? "#22c55e" : T.textMuted }}>入金のみ</button>
        <div className="w-px h-4 mx-1" style={{ backgroundColor: T.border }} />
        {categoryTotals.slice(0, 6).map((c) => (
          <button key={c.key} onClick={() => setFilterCategory(filterCategory === c.key ? "all" : c.key)} className="px-2 py-1 rounded text-[9px] cursor-pointer border"
            style={{ borderColor: filterCategory === c.key ? c.color : T.border, color: filterCategory === c.key ? c.color : T.textMuted }}>
            {c.icon} {c.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[900px] mx-auto p-4">
          {/* Category Breakdown */}
          {categoryTotals.length > 0 && (
            <div className="rounded-2xl border p-4 mb-4" style={{ backgroundColor: T.card, borderColor: T.border }}>
              <p className="text-[12px] font-medium mb-3">カテゴリ別内訳</p>
              <div className="space-y-2">
                {categoryTotals.map((c) => {
                  const maxTotal = categoryTotals[0]?.total || 1;
                  return (
                    <div key={c.key}>
                      <div className="flex items-center justify-between text-[11px] mb-1">
                        <span>{c.icon} {c.label}</span>
                        <span className="font-medium" style={{ color: c.color }}>{fmt(c.total)}</span>
                      </div>
                      <div className="w-full rounded-full h-2" style={{ backgroundColor: T.cardAlt }}>
                        <div className="rounded-full h-2" style={{ width: `${(c.total / maxTotal) * 100}%`, backgroundColor: c.color }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* List */}
          <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: T.card, borderColor: T.border }}>
            {filtered.length === 0 ? (
              <p className="text-[12px] text-center py-12" style={{ color: T.textFaint }}>データがありません</p>
            ) : (
              <table className="w-full text-[12px]">
                <thead><tr style={{ borderBottom: `1px solid ${T.border}` }}>
                  {["日付", "種別", "カテゴリ", "名目", "金額", "店舗", "操作"].map((h) => (
                    <th key={h} className="py-2.5 px-3 text-left font-normal text-[10px]" style={{ color: T.textMuted }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {filtered.map((e) => {
                    const cat = CATEGORIES[e.category] || CATEGORIES.other;
                    const isIncome = e.type === "income";
                    return (
                      <tr key={e.id} style={{ borderBottom: `1px solid ${T.border}` }}>
                        <td className="py-2.5 px-3">{e.date}</td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded text-[9px] font-medium" style={{ backgroundColor: isIncome ? "#22c55e18" : "#c4555518", color: isIncome ? "#22c55e" : "#c45555" }}>
                            {isIncome ? "入金" : "経費"}
                          </span>
                        </td>
                        <td className="py-2.5 px-3"><span className="text-[11px]">{cat.icon} {cat.label}</span></td>
                        <td className="py-2.5 px-3 font-medium">
                          {e.name}{e.receipt_url && <a href={e.receipt_url} target="_blank" rel="noreferrer" className="ml-2 inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "#85a8c418", color: "#85a8c4" }}>{e.receipt_thumb_url ? <img src={e.receipt_thumb_url} alt="レシート" className="inline-block rounded" style={{ width: 28, height: 28, objectFit: "cover" }} /> : "📄"}PDF</a>}
                          {e.is_recurring && <span className="ml-1 text-[8px] px-1 py-0.5 rounded" style={{ backgroundColor: "#f59e0b18", color: "#f59e0b" }}>固定</span>}
                        </td>
                        <td className="py-2.5 px-3 font-medium" style={{ color: isIncome ? "#22c55e" : "#c45555" }}>
                          {isIncome ? "+" : "-"}{fmt(e.amount)}
                        </td>
                        <td className="py-2.5 px-3" style={{ color: T.textMuted }}>{getStoreName(e.store_id) || "—"}</td>
                        <td className="py-2.5 px-3">
                          <div className="flex gap-1">
                            <button onClick={() => startEdit(e)} className="px-2 py-1 text-[9px] rounded cursor-pointer" style={{ color: "#3d6b9f", backgroundColor: "#3d6b9f18" }}>編集</button>
                            <button onClick={() => handleDelete(e.id)} className="px-2 py-1 text-[9px] rounded cursor-pointer" style={{ color: "#c45555", backgroundColor: "#c4555518" }}>削除</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Add Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowAdd(false)}>
          <div className="rounded-2xl border p-6 w-full max-w-md max-h-[90vh] overflow-y-auto animate-[fadeIn_0.25s]" style={{ backgroundColor: T.card, borderColor: T.border }} onClick={(e) => e.stopPropagation()}>
            <h2 className="text-[15px] font-medium mb-1">{addType === "income" ? "💰 入金登録" : "📝 経費登録"}</h2>
            <p className="text-[11px] mb-5" style={{ color: T.textFaint }}>{addType === "income" ? "入金を記録します" : "経費を記録します"}</p>
            <div className="space-y-4">
              <div className="flex gap-2">
                <button onClick={() => setAddType("expense")} className={`px-4 py-2 rounded-xl text-[11px] cursor-pointer ${addType === "expense" ? "ring-2 ring-offset-1" : "opacity-50"}`} style={{ backgroundColor: "#c4555518", color: "#c45555" }}>経費</button>
                <button onClick={() => setAddType("income")} className={`px-4 py-2 rounded-xl text-[11px] cursor-pointer ${addType === "income" ? "ring-2 ring-offset-1" : "opacity-50"}`} style={{ backgroundColor: "#22c55e18", color: "#22c55e" }}>入金</button>
              </div>
              <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>日付 *</label><input type="date" value={addDate} onChange={(e) => setAddDate(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} /></div>
              {addType !== "income" && (
                <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>カテゴリ</label>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(CATEGORIES).filter(([k]) => k !== "income").map(([key, val]) => (
                      <button key={key} onClick={() => setAddCategory(key)} className={`px-3 py-1.5 rounded-xl text-[10px] cursor-pointer ${addCategory === key ? "ring-2 ring-offset-1" : "opacity-50"}`}
                        style={{ backgroundColor: val.color + "18", color: val.color }}>{val.icon} {val.label}</button>
                    ))}
                  </div>
                </div>
              )}
              <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>名目 *</label><input type="text" value={addName} onChange={(e) => setAddName(e.target.value)} placeholder={addType === "income" ? "例: カード売上入金" : "例: オフィス家賃"} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} /></div>
              <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>金額 *</label><input type="text" inputMode="numeric" value={addAmount} onChange={(e) => setAddAmount(e.target.value.replace(/[^0-9]/g, ""))} placeholder="50000" className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} /></div>
              <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>店舗</label><select value={addStoreId} onChange={(e) => setAddStoreId(Number(e.target.value))} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none cursor-pointer" style={inputStyle}><option value={0}>全店舗共通</option>{stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
              <div className="flex items-center gap-3">
                <button onClick={() => setAddRecurring(!addRecurring)} className="px-3 py-1.5 rounded-xl text-[11px] cursor-pointer border" style={{ borderColor: addRecurring ? "#f59e0b" : T.border, backgroundColor: addRecurring ? "#f59e0b18" : "transparent", color: addRecurring ? "#f59e0b" : T.textMuted }}>{addRecurring ? "✅ 毎月固定" : "毎月固定"}</button>
              </div>
              <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>メモ</label><input type="text" value={addNotes} onChange={(e) => setAddNotes(e.target.value)} placeholder="メモ" className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} /></div>
              <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>📸 レシート写真</label><input type="file" accept="image/*" capture="environment" onChange={(e) => setAddReceiptFile(e.target.files?.[0] || null)} className="w-full text-[11px]" style={{ color: T.textSub }} />{addReceiptFile && <p className="text-[10px] mt-1" style={{ color: "#22c55e" }}>✅ {addReceiptFile.name}</p>}</div>
              {msg && <div className="px-4 py-3 rounded-xl text-[12px]" style={{ backgroundColor: msg.includes("失敗") || msg.includes("入力") ? "#c4988518" : "#7ab88f18", color: msg.includes("失敗") || msg.includes("入力") ? "#c49885" : "#5a9e6f" }}>{msg}</div>}
              <div className="flex gap-3 pt-2">
                <button onClick={handleAdd} disabled={saving} className="px-6 py-2.5 text-white text-[12px] rounded-xl cursor-pointer disabled:opacity-60" style={{ backgroundColor: addType === "income" ? "#22c55e" : "#c3a782" }}>{saving ? "登録中..." : "登録する"}</button>
                <button onClick={() => { setShowAdd(false); setMsg(""); }} className="px-6 py-2.5 border text-[12px] rounded-xl cursor-pointer" style={{ borderColor: T.border, color: T.textSub }}>キャンセル</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editTarget && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setEditTarget(null)}>
          <div className="rounded-2xl border p-6 w-full max-w-md max-h-[90vh] overflow-y-auto animate-[fadeIn_0.25s]" style={{ backgroundColor: T.card, borderColor: T.border }} onClick={(e) => e.stopPropagation()}>
            <h2 className="text-[15px] font-medium mb-4">編集</h2>
            <div className="space-y-4">
              <div className="flex gap-2">
                <button onClick={() => setEditType("expense")} className={`px-4 py-2 rounded-xl text-[11px] cursor-pointer ${editType === "expense" ? "ring-2 ring-offset-1" : "opacity-50"}`} style={{ backgroundColor: "#c4555518", color: "#c45555" }}>経費</button>
                <button onClick={() => setEditType("income")} className={`px-4 py-2 rounded-xl text-[11px] cursor-pointer ${editType === "income" ? "ring-2 ring-offset-1" : "opacity-50"}`} style={{ backgroundColor: "#22c55e18", color: "#22c55e" }}>入金</button>
              </div>
              <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>日付</label><input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} /></div>
              {editType !== "income" && (
                <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>カテゴリ</label>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(CATEGORIES).filter(([k]) => k !== "income").map(([key, val]) => (
                      <button key={key} onClick={() => setEditCategory(key)} className={`px-3 py-1.5 rounded-xl text-[10px] cursor-pointer ${editCategory === key ? "ring-2 ring-offset-1" : "opacity-50"}`}
                        style={{ backgroundColor: val.color + "18", color: val.color }}>{val.icon} {val.label}</button>
                    ))}
                  </div>
                </div>
              )}
              <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>名目</label><input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} /></div>
              <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>金額</label><input type="text" inputMode="numeric" value={editAmount} onChange={(e) => setEditAmount(e.target.value.replace(/[^0-9]/g, ""))} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} /></div>
              <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>店舗</label><select value={editStoreId} onChange={(e) => setEditStoreId(Number(e.target.value))} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none cursor-pointer" style={inputStyle}><option value={0}>全店舗共通</option>{stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
              <div className="flex items-center gap-3">
                <button onClick={() => setEditRecurring(!editRecurring)} className="px-3 py-1.5 rounded-xl text-[11px] cursor-pointer border" style={{ borderColor: editRecurring ? "#f59e0b" : T.border, backgroundColor: editRecurring ? "#f59e0b18" : "transparent", color: editRecurring ? "#f59e0b" : T.textMuted }}>{editRecurring ? "✅ 毎月固定" : "毎月固定"}</button>
              </div>
              <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>メモ</label><input type="text" value={editNotes} onChange={(e) => setEditNotes(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} /></div>
              <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>📸 レシート写真</label>{editTarget?.receipt_url && <a href={editTarget.receipt_url} target="_blank" rel="noreferrer" className="text-[10px] underline mb-1 block" style={{ color: "#85a8c4" }}>📄 現在のレシート: {editTarget.receipt_name || "PDF"}</a>}<input type="file" accept="image/*" capture="environment" onChange={(e) => setEditReceiptFile(e.target.files?.[0] || null)} className="w-full text-[11px]" style={{ color: T.textSub }} />{editReceiptFile && <p className="text-[10px] mt-1" style={{ color: "#22c55e" }}>✅ {editReceiptFile.name}（新しいレシート）</p>}</div>
              {editMsg && <div className="px-4 py-3 rounded-xl text-[12px]" style={{ backgroundColor: editMsg.includes("失敗") ? "#c4988518" : "#7ab88f18", color: editMsg.includes("失敗") ? "#c49885" : "#5a9e6f" }}>{editMsg}</div>}
              <div className="flex gap-3 pt-2">
                <button onClick={handleUpdate} disabled={editSaving} className="px-6 py-2.5 bg-gradient-to-r from-[#c3a782] to-[#b09672] text-white text-[12px] rounded-xl cursor-pointer disabled:opacity-60">{editSaving ? "更新中..." : "更新する"}</button>
                <button onClick={() => setEditTarget(null)} className="px-6 py-2.5 border text-[12px] rounded-xl cursor-pointer" style={{ borderColor: T.border, color: T.textSub }}>キャンセル</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  );
}
