"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";
import { useTheme } from "../../lib/theme";
import { NavMenu } from "../../lib/nav-menu";

type Nomination = { id: number; name: string; price: number; therapist_back: number };
type Discount = { id: number; name: string; amount: number; type: string };
type Extension = { id: number; name: string; duration: number; price: number; therapist_back: number };
type Option = { id: number; name: string; price: number; therapist_back: number };

type Tab = "nomination" | "discount" | "extension" | "option";

const fmt = (n: number) => "¥" + (n || 0).toLocaleString();

export default function ServiceSettings() {
  const router = useRouter();
  const { dark, toggle, T } = useTheme();
  const [tab, setTab] = useState<Tab>("nomination");

  const [nominations, setNominations] = useState<Nomination[]>([]);
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [extensions, setExtensions] = useState<Extension[]>([]);
  const [options, setOptions] = useState<Option[]>([]);

  // Add states
  const [addName, setAddName] = useState("");
  const [addPrice, setAddPrice] = useState("");
  const [addBack, setAddBack] = useState("");
  const [addDuration, setAddDuration] = useState("30");
  const [addAmount, setAddAmount] = useState("");
  const [addDiscountType, setAddDiscountType] = useState("fixed");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  // Edit states
  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editBack, setEditBack] = useState("");
  const [editDuration, setEditDuration] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editDiscountType, setEditDiscountType] = useState("fixed");

  const fetchData = useCallback(async () => {
    const { data: n } = await supabase.from("nominations").select("*").order("id"); if (n) setNominations(n);
    const { data: d } = await supabase.from("discounts").select("*").order("id"); if (d) setDiscounts(d);
    const { data: e } = await supabase.from("extensions").select("*").order("duration"); if (e) setExtensions(e);
    const { data: o } = await supabase.from("options").select("*").order("id"); if (o) setOptions(o);
  }, []);

  useEffect(() => { const check = async () => { const { data: { user } } = await supabase.auth.getUser(); if (!user) router.push("/"); }; check(); fetchData(); }, [router, fetchData]);

  const resetAdd = () => { setAddName(""); setAddPrice(""); setAddBack(""); setAddDuration("30"); setAddAmount(""); setAddDiscountType("fixed"); setMsg(""); };
  const resetEdit = () => { setEditId(null); setEditName(""); setEditPrice(""); setEditBack(""); setEditDuration(""); setEditAmount(""); setEditDiscountType("fixed"); };

  // ===== Add =====
  const handleAdd = async () => {
    if (!addName.trim()) { setMsg("名前を入力してください"); return; }
    setSaving(true); setMsg("");
    let error = null;
    if (tab === "nomination") {
      ({ error } = await supabase.from("nominations").insert({ name: addName.trim(), price: parseInt(addPrice) || 0, therapist_back: parseInt(addBack) || 0 }));
    } else if (tab === "discount") {
      ({ error } = await supabase.from("discounts").insert({ name: addName.trim(), amount: parseInt(addAmount) || 0, type: addDiscountType }));
    } else if (tab === "extension") {
      ({ error } = await supabase.from("extensions").insert({ name: addName.trim(), duration: parseInt(addDuration) || 30, price: parseInt(addPrice) || 0, therapist_back: parseInt(addBack) || 0 }));
    } else if (tab === "option") {
      ({ error } = await supabase.from("options").insert({ name: addName.trim(), price: parseInt(addPrice) || 0, therapist_back: parseInt(addBack) || 0 }));
    }
    setSaving(false);
    if (error) { setMsg("登録失敗: " + error.message); }
    else { setMsg("登録しました！"); resetAdd(); fetchData(); setTimeout(() => setMsg(""), 1000); }
  };

  // ===== Update =====
  const handleUpdate = async () => {
    if (!editId || !editName.trim()) return;
    if (tab === "nomination") {
      await supabase.from("nominations").update({ name: editName.trim(), price: parseInt(editPrice) || 0, therapist_back: parseInt(editBack) || 0 }).eq("id", editId);
    } else if (tab === "discount") {
      await supabase.from("discounts").update({ name: editName.trim(), amount: parseInt(editAmount) || 0, type: editDiscountType }).eq("id", editId);
    } else if (tab === "extension") {
      await supabase.from("extensions").update({ name: editName.trim(), duration: parseInt(editDuration) || 30, price: parseInt(editPrice) || 0, therapist_back: parseInt(editBack) || 0 }).eq("id", editId);
    } else if (tab === "option") {
      await supabase.from("options").update({ name: editName.trim(), price: parseInt(editPrice) || 0, therapist_back: parseInt(editBack) || 0 }).eq("id", editId);
    }
    resetEdit(); fetchData();
  };

  // ===== Delete =====
  const handleDelete = async (id: number) => {
    if (!confirm("削除しますか？")) return;
    const table = tab === "nomination" ? "nominations" : tab === "discount" ? "discounts" : tab === "extension" ? "extensions" : "options";
    await supabase.from(table).delete().eq("id", id);
    fetchData();
  };

  const inputStyle = { backgroundColor: T.cardAlt, color: T.text, border: "1px solid transparent" };

  const tabs: { key: Tab; label: string; color: string; count: number }[] = [
    { key: "nomination", label: "指名", color: "#c3a782", count: nominations.length },
    { key: "extension", label: "延長", color: "#85a8c4", count: extensions.length },
    { key: "option", label: "オプション", color: "#7ab88f", count: options.length },
    { key: "discount", label: "割引", color: "#c49885", count: discounts.length },
  ];

  const currentTab = tabs.find((t) => t.key === tab)!;

  return (
    <div className="h-screen flex flex-col" style={{ backgroundColor: T.bg, color: T.text }}>
      {/* Header */}
      <div className="h-[56px] flex items-center justify-between px-4 flex-shrink-0 border-b" style={{ backgroundColor: T.card, borderColor: T.border }}>
        <div className="flex items-center gap-3">
          <NavMenu T={T} dark={dark} />
          <button onClick={() => router.push("/dashboard")} className="p-2 rounded-lg cursor-pointer" style={{ color: T.textSub }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="15 18 9 12 15 6"/></svg></button>
          <h1 className="text-[14px] font-medium">サービス設定</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={toggle} className="px-2.5 py-1.5 text-[10px] rounded-lg cursor-pointer border" style={{ borderColor: T.border, color: T.textSub }}>{dark ? "☀️ ライト" : "🌙 ダーク"}</button>
          <button onClick={() => router.push("/courses")} className="px-2.5 py-1.5 text-[10px] rounded-lg cursor-pointer border" style={{ borderColor: T.border, color: T.textSub }}>コース管理</button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 px-4 py-2 border-b flex-shrink-0" style={{ backgroundColor: T.card, borderColor: T.border }}>
        {tabs.map((t) => (
          <button key={t.key} onClick={() => { setTab(t.key); resetAdd(); resetEdit(); }} className="px-3 py-1.5 text-[11px] rounded-lg cursor-pointer transition-all flex items-center gap-1.5"
            style={{ backgroundColor: tab === t.key ? t.color + "18" : "transparent", color: tab === t.key ? t.color : T.textMuted, fontWeight: tab === t.key ? 600 : 400 }}>
            {t.label}
            <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: tab === t.key ? t.color + "22" : T.cardAlt, color: tab === t.key ? t.color : T.textFaint }}>{t.count}</span>
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-[700px] mx-auto animate-[fadeIn_0.3s]">

          {/* Add Form */}
          <div className="rounded-2xl border p-5 mb-6" style={{ backgroundColor: T.card, borderColor: T.border }}>
            <p className="text-[13px] font-medium mb-3">{currentTab.label}を追加</p>
            <div className="flex flex-wrap gap-3 items-end">
              <div className="flex-1 min-w-[140px]">
                <label className="block text-[10px] mb-1" style={{ color: T.textSub }}>名前 *</label>
                <input type="text" value={addName} onChange={(e) => setAddName(e.target.value)} placeholder={`${currentTab.label}名`}
                  className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle}
                  onKeyDown={(e) => e.key === "Enter" && handleAdd()} />
              </div>

              {tab === "nomination" && (<>
                <div className="w-[120px]">
                  <label className="block text-[10px] mb-1" style={{ color: T.textSub }}>料金</label>
                  <input type="text" inputMode="numeric" value={addPrice} onChange={(e) => setAddPrice(e.target.value.replace(/[^0-9]/g, ""))} placeholder="2000"
                    className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} />
                </div>
                
              <div className="w-[120px]">
                  <label className="block text-[10px] mb-1" style={{ color: T.textSub }}>バック</label>
                  <input type="text" inputMode="numeric" value={addBack} onChange={(e) => setAddBack(e.target.value.replace(/[^0-9]/g, ""))} placeholder="1000"
                    className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} />
                </div>
              </>)}

              {tab === "discount" && (<>
                <div className="w-[120px]">
                  <label className="block text-[10px] mb-1" style={{ color: T.textSub }}>金額/率</label>
                  <input type="text" inputMode="numeric" value={addAmount} onChange={(e) => setAddAmount(e.target.value.replace(/[^0-9]/g, ""))} placeholder="1000"
                    className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} />
                </div>
                <div className="w-[100px]">
                  <label className="block text-[10px] mb-1" style={{ color: T.textSub }}>種類</label>
                  <select value={addDiscountType} onChange={(e) => setAddDiscountType(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none cursor-pointer" style={inputStyle}>
                    <option value="fixed">固定額</option>
                    <option value="percent">%割引</option>
                  </select>
                </div>
              </>)}

              {tab === "extension" && (<>
                <div className="w-[90px]">
                  <label className="block text-[10px] mb-1" style={{ color: T.textSub }}>時間(分)</label>
                  <select value={addDuration} onChange={(e) => setAddDuration(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none cursor-pointer" style={inputStyle}>
                    {[10, 15, 20, 30, 40, 50, 60].map((m) => (<option key={m} value={m}>{m}分</option>))}
                  </select>
                </div>
                <div className="w-[100px]">
                  <label className="block text-[10px] mb-1" style={{ color: T.textSub }}>料金</label>
                  <input type="text" inputMode="numeric" value={addPrice} onChange={(e) => setAddPrice(e.target.value.replace(/[^0-9]/g, ""))} placeholder="3000"
                    className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} />
                </div>
                <div className="w-[100px]">
                  <label className="block text-[10px] mb-1" style={{ color: T.textSub }}>バック</label>
                  <input type="text" inputMode="numeric" value={addBack} onChange={(e) => setAddBack(e.target.value.replace(/[^0-9]/g, ""))} placeholder="1000"
                    className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} />
                </div>
              </>)}

              {tab === "option" && (<>
                <div className="w-[100px]">
                  <label className="block text-[10px] mb-1" style={{ color: T.textSub }}>料金</label>
                  <input type="text" inputMode="numeric" value={addPrice} onChange={(e) => setAddPrice(e.target.value.replace(/[^0-9]/g, ""))} placeholder="1000"
                    className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} />
                </div>
                <div className="w-[100px]">
                  <label className="block text-[10px] mb-1" style={{ color: T.textSub }}>バック</label>
                  <input type="text" inputMode="numeric" value={addBack} onChange={(e) => setAddBack(e.target.value.replace(/[^0-9]/g, ""))} placeholder="500"
                    className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} />
                </div>
              </>)}

              <button onClick={handleAdd} disabled={saving} className="px-4 py-2.5 text-white text-[11px] rounded-xl cursor-pointer disabled:opacity-60"
                style={{ backgroundColor: currentTab.color }}>{saving ? "登録中..." : "追加"}</button>
            </div>
            {msg && <p className="text-[11px] mt-2" style={{ color: msg.includes("失敗") || msg.includes("入力") ? "#c45555" : "#4a7c59" }}>{msg}</p>}
          </div>

          {/* List */}
          <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: T.card, borderColor: T.border }}>
            {/* 指名 */}
            {tab === "nomination" && (
              nominations.length === 0 ? <p className="text-[12px] text-center py-8" style={{ color: T.textFaint }}>指名が登録されていません</p> : (
                <table className="w-full text-[12px]">
                  <thead><tr style={{ borderBottom: `1px solid ${T.border}` }}>
                    {["指名名", "料金", "操作"].map((h) => (<th key={h} className="py-3 px-4 text-left font-normal text-[11px]" style={{ color: T.textMuted }}>{h}</th>))}
                  </tr></thead>
                  <tbody>{nominations.map((n) => (
                    <tr key={n.id} style={{ borderBottom: `1px solid ${T.border}` }}>
                      {editId === n.id ? (<>
                        <td className="py-2 px-4"><input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="px-2 py-1 rounded text-[12px] outline-none w-full" style={inputStyle} /></td>
                        <td className="py-2 px-4"><input type="text" inputMode="numeric" value={editPrice} onChange={(e) => setEditPrice(e.target.value.replace(/[^0-9]/g, ""))} className="px-2 py-1 rounded text-[12px] outline-none w-20" style={inputStyle} /></td>
                        <td className="py-2 px-4"><input type="text" inputMode="numeric" value={editBack} onChange={(e) => setEditBack(e.target.value.replace(/[^0-9]/g, ""))} className="px-2 py-1 rounded text-[12px] outline-none w-20" style={inputStyle} /></td>
                        <td></td>
                        <td className="py-2 px-4"><div className="flex gap-1"><button onClick={handleUpdate} className="px-2 py-1 text-[10px] rounded cursor-pointer" style={{ color: "#4a7c59", backgroundColor: "#4a7c5918" }}>保存</button><button onClick={resetEdit} className="px-2 py-1 text-[10px] rounded cursor-pointer" style={{ color: T.textMuted }}>取消</button></div></td>
                      </>) : (<>
                        <td className="py-3 px-4 font-medium">{n.name}</td>
                        <td className="py-3 px-4" style={{ color: currentTab.color }}>{fmt(n.price)}</td>
                        <td className="py-3 px-4" style={{ color: "#c3a782" }}>{fmt(n.therapist_back || 0)}</td>
                        <td className="py-3 px-4" style={{ color: "#4a7c59" }}>{fmt(n.price - (n.therapist_back || 0))}</td>
                        <td className="py-3 px-4"><div className="flex gap-1"><button onClick={() => { setEditId(n.id); setEditName(n.name); setEditPrice(String(n.price)); setEditBack(String(n.therapist_back || 0)); }} className="px-2 py-1 text-[10px] rounded cursor-pointer" style={{ color: "#3d6b9f", backgroundColor: "#3d6b9f18" }}>編集</button><button onClick={() => handleDelete(n.id)} className="px-2 py-1 text-[10px] rounded cursor-pointer" style={{ color: "#c45555", backgroundColor: "#c4555518" }}>削除</button></div></td>
                      </>)}
                    </tr>
                  ))}</tbody>
                </table>
              )
            )}

            {/* 割引 */}
            {tab === "discount" && (
              discounts.length === 0 ? <p className="text-[12px] text-center py-8" style={{ color: T.textFaint }}>割引が登録されていません</p> : (
                <table className="w-full text-[12px]">
                  <thead><tr style={{ borderBottom: `1px solid ${T.border}` }}>
                    {["割引名", "金額/率", "種類", "操作"].map((h) => (<th key={h} className="py-3 px-4 text-left font-normal text-[11px]" style={{ color: T.textMuted }}>{h}</th>))}
                  </tr></thead>
                  <tbody>{discounts.map((d) => (
                    <tr key={d.id} style={{ borderBottom: `1px solid ${T.border}` }}>
                      {editId === d.id ? (<>
                        <td className="py-2 px-4"><input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="px-2 py-1 rounded text-[12px] outline-none w-full" style={inputStyle} /></td>
                        <td className="py-2 px-4"><input type="text" inputMode="numeric" value={editAmount} onChange={(e) => setEditAmount(e.target.value.replace(/[^0-9]/g, ""))} className="px-2 py-1 rounded text-[12px] outline-none w-20" style={inputStyle} /></td>
                        <td className="py-2 px-4"><select value={editDiscountType} onChange={(e) => setEditDiscountType(e.target.value)} className="px-2 py-1 rounded text-[12px] outline-none cursor-pointer" style={inputStyle}><option value="fixed">固定額</option><option value="percent">%</option></select></td>
                        <td className="py-2 px-4"><div className="flex gap-1"><button onClick={handleUpdate} className="px-2 py-1 text-[10px] rounded cursor-pointer" style={{ color: "#4a7c59", backgroundColor: "#4a7c5918" }}>保存</button><button onClick={resetEdit} className="px-2 py-1 text-[10px] rounded cursor-pointer" style={{ color: T.textMuted }}>取消</button></div></td>
                      </>) : (<>
                        <td className="py-3 px-4 font-medium">{d.name}</td>
                        <td className="py-3 px-4" style={{ color: currentTab.color }}>{d.type === "percent" ? `${d.amount}%` : fmt(d.amount)}</td>
                        <td className="py-3 px-4" style={{ color: T.textSub }}>{d.type === "percent" ? "%割引" : "固定額"}</td>
                        <td className="py-3 px-4"><div className="flex gap-1"><button onClick={() => { setEditId(d.id); setEditName(d.name); setEditAmount(String(d.amount)); setEditDiscountType(d.type); }} className="px-2 py-1 text-[10px] rounded cursor-pointer" style={{ color: "#3d6b9f", backgroundColor: "#3d6b9f18" }}>編集</button><button onClick={() => handleDelete(d.id)} className="px-2 py-1 text-[10px] rounded cursor-pointer" style={{ color: "#c45555", backgroundColor: "#c4555518" }}>削除</button></div></td>
                      </>)}
                    </tr>
                  ))}</tbody>
                </table>
              )
            )}

            {/* 延長 */}
            {tab === "extension" && (
              extensions.length === 0 ? <p className="text-[12px] text-center py-8" style={{ color: T.textFaint }}>延長が登録されていません</p> : (
                <table className="w-full text-[12px]">
                  <thead><tr style={{ borderBottom: `1px solid ${T.border}` }}>
                    {["延長名", "時間", "料金", "バック", "利益", "操作"].map((h) => (<th key={h} className="py-3 px-4 text-left font-normal text-[11px]" style={{ color: T.textMuted }}>{h}</th>))}
                  </tr></thead>
                  <tbody>{extensions.map((e) => (
                    <tr key={e.id} style={{ borderBottom: `1px solid ${T.border}` }}>
                      {editId === e.id ? (<>
                        <td className="py-2 px-4"><input type="text" value={editName} onChange={(ev) => setEditName(ev.target.value)} className="px-2 py-1 rounded text-[12px] outline-none w-full" style={inputStyle} /></td>
                        <td className="py-2 px-4"><select value={editDuration} onChange={(ev) => setEditDuration(ev.target.value)} className="px-2 py-1 rounded text-[12px] outline-none cursor-pointer" style={inputStyle}>{[10,15,20,30,40,50,60].map((m) => <option key={m} value={m}>{m}分</option>)}</select></td>
                        <td className="py-2 px-4"><input type="text" inputMode="numeric" value={editPrice} onChange={(ev) => setEditPrice(ev.target.value.replace(/[^0-9]/g, ""))} className="px-2 py-1 rounded text-[12px] outline-none w-20" style={inputStyle} /></td>
                        <td className="py-2 px-4"><input type="text" inputMode="numeric" value={editBack} onChange={(ev) => setEditBack(ev.target.value.replace(/[^0-9]/g, ""))} className="px-2 py-1 rounded text-[12px] outline-none w-20" style={inputStyle} /></td>
                        <td className="py-2 px-4" />
                        <td className="py-2 px-4"><div className="flex gap-1"><button onClick={handleUpdate} className="px-2 py-1 text-[10px] rounded cursor-pointer" style={{ color: "#4a7c59", backgroundColor: "#4a7c5918" }}>保存</button><button onClick={resetEdit} className="px-2 py-1 text-[10px] rounded cursor-pointer" style={{ color: T.textMuted }}>取消</button></div></td>
                      </>) : (<>
                        <td className="py-3 px-4 font-medium">{e.name}</td>
                        <td className="py-3 px-4" style={{ color: T.textSub }}>{e.duration}分</td>
                        <td className="py-3 px-4" style={{ color: currentTab.color }}>{fmt(e.price)}</td>
                        <td className="py-3 px-4" style={{ color: "#7ab88f" }}>{fmt(e.therapist_back)}</td>
                        <td className="py-3 px-4">{fmt(e.price - e.therapist_back)}</td>
                        <td className="py-3 px-4"><div className="flex gap-1"><button onClick={() => { setEditId(e.id); setEditName(e.name); setEditDuration(String(e.duration)); setEditPrice(String(e.price)); setEditBack(String(e.therapist_back)); }} className="px-2 py-1 text-[10px] rounded cursor-pointer" style={{ color: "#3d6b9f", backgroundColor: "#3d6b9f18" }}>編集</button><button onClick={() => handleDelete(e.id)} className="px-2 py-1 text-[10px] rounded cursor-pointer" style={{ color: "#c45555", backgroundColor: "#c4555518" }}>削除</button></div></td>
                      </>)}
                    </tr>
                  ))}</tbody>
                </table>
              )
            )}

            {/* オプション */}
            {tab === "option" && (
              options.length === 0 ? <p className="text-[12px] text-center py-8" style={{ color: T.textFaint }}>オプションが登録されていません</p> : (
                <table className="w-full text-[12px]">
                  <thead><tr style={{ borderBottom: `1px solid ${T.border}` }}>
                    {["オプション名", "料金", "バック", "利益", "操作"].map((h) => (<th key={h} className="py-3 px-4 text-left font-normal text-[11px]" style={{ color: T.textMuted }}>{h}</th>))}
                  </tr></thead>
                  <tbody>{options.map((o) => (
                    <tr key={o.id} style={{ borderBottom: `1px solid ${T.border}` }}>
                      {editId === o.id ? (<>
                        <td className="py-2 px-4"><input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="px-2 py-1 rounded text-[12px] outline-none w-full" style={inputStyle} /></td>
                        <td className="py-2 px-4"><input type="text" inputMode="numeric" value={editPrice} onChange={(e) => setEditPrice(e.target.value.replace(/[^0-9]/g, ""))} className="px-2 py-1 rounded text-[12px] outline-none w-20" style={inputStyle} /></td>
                        <td className="py-2 px-4"><input type="text" inputMode="numeric" value={editBack} onChange={(e) => setEditBack(e.target.value.replace(/[^0-9]/g, ""))} className="px-2 py-1 rounded text-[12px] outline-none w-20" style={inputStyle} /></td>
                        <td className="py-2 px-4" />
                        <td className="py-2 px-4"><div className="flex gap-1"><button onClick={handleUpdate} className="px-2 py-1 text-[10px] rounded cursor-pointer" style={{ color: "#4a7c59", backgroundColor: "#4a7c5918" }}>保存</button><button onClick={resetEdit} className="px-2 py-1 text-[10px] rounded cursor-pointer" style={{ color: T.textMuted }}>取消</button></div></td>
                      </>) : (<>
                        <td className="py-3 px-4 font-medium">{o.name}</td>
                        <td className="py-3 px-4" style={{ color: currentTab.color }}>{fmt(o.price)}</td>
                        <td className="py-3 px-4" style={{ color: "#7ab88f" }}>{fmt(o.therapist_back)}</td>
                        <td className="py-3 px-4">{fmt(o.price - o.therapist_back)}</td>
                        <td className="py-3 px-4"><div className="flex gap-1"><button onClick={() => { setEditId(o.id); setEditName(o.name); setEditPrice(String(o.price)); setEditBack(String(o.therapist_back)); }} className="px-2 py-1 text-[10px] rounded cursor-pointer" style={{ color: "#3d6b9f", backgroundColor: "#3d6b9f18" }}>編集</button><button onClick={() => handleDelete(o.id)} className="px-2 py-1 text-[10px] rounded cursor-pointer" style={{ color: "#c45555", backgroundColor: "#c4555518" }}>削除</button></div></td>
                      </>)}
                    </tr>
                  ))}</tbody>
                </table>
              )
            )}
          </div>
        </div>
      </div>

      <style jsx global>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  );
}
