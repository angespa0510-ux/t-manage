"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../lib/supabase";
import { useStaffSession } from "../../lib/staff-session";
import { useTheme } from "../../lib/theme";
import { NavMenu } from "../../lib/nav-menu";
import { useBackNav } from "../../lib/use-back-nav";
import { useConfirm } from "../../components/useConfirm";

/* ─────────── 型定義 ─────────── */
type InventoryStore = { id: number; name: string; display_order: number; is_active: boolean };
type InventoryItem = { id: number; name: string; category: string; unit: string; default_unit_price: number; sort_order: number; is_active: boolean; notes: string };
type InventorySession = { id: number; count_date: string; store_id: number | null; store_name_snapshot: string; fiscal_period: string; status: string; total_amount: number; item_count: number; memo: string; counted_by_name: string; finalized_at: string | null };
type InventoryCount = { id: number; session_id: number | null; count_date: string; store_id: number | null; item_id: number | null; item_name_snapshot: string; category_snapshot: string; unit_snapshot: string; quantity: number; unit_price: number; subtotal: number; note: string; counted_by_name: string };

type Tab = "count" | "master" | "history";

const CATEGORY_ORDER = ["施術関連備品", "リビング周辺", "キッチン周り", "洗面台・洗濯機・バスルーム周り", "トイレ周り", "その他"];
const CATEGORY_COLORS: Record<string, string> = {
  "施術関連備品": "#c3a782",
  "リビング周辺": "#85a8c4",
  "キッチン周り": "#7ab88f",
  "洗面台・洗濯機・バスルーム周り": "#5aa8a8",
  "トイレ周り": "#a885c4",
  "その他": "#888780",
};
const UNIT_PRESETS = ["個", "本", "枚", "箱", "袋", "着", "セット", "L", "ml", "kg", "g", "ロール", "ペア"];

const fmt = (n: number) => "¥" + Math.round(n || 0).toLocaleString();

/* ─────────── メイン ─────────── */
export default function InventoryPage() {
  const router = useRouter();
  const { dark, toggle, T } = useTheme();
  const { confirm, ConfirmModalNode } = useConfirm();
  const { activeStaff, canAccessCashDashboard } = useStaffSession();

  const [tab, setTab] = useState<Tab>("count");
  const [stores, setStores] = useState<InventoryStore[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [sessions, setSessions] = useState<InventorySession[]>([]);
  const [currentCounts, setCurrentCounts] = useState<InventoryCount[]>([]);
  const [loading, setLoading] = useState(true);

  // 選択中の店舗
  const [selectedStoreId, setSelectedStoreId] = useState<number | null>(null);

  // 棚卸実施タブ: 棚卸日
  const [activeDate, setActiveDate] = useState<string>(() => {
    const d = new Date();
    const y = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
    return `${y}-03-31`;
  });

  // 現在のセッション情報
  const currentSession = useMemo(
    () => sessions.find(s => s.count_date === activeDate && s.store_id === selectedStoreId),
    [sessions, activeDate, selectedStoreId]
  );

  // 品目マスタータブ
  const [showNewItem, setShowNewItem] = useState(false);
  const [newItem, setNewItem] = useState({ name: "", category: "施術関連備品", unit: "個", default_unit_price: "", notes: "" });
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [editingItemData, setEditingItemData] = useState<Partial<InventoryItem>>({});
  const [masterCategoryFilter, setMasterCategoryFilter] = useState<string>("all");
  const [showInactive, setShowInactive] = useState(false);

  // 履歴タブ: 比較対象
  const [compareSessionAId, setCompareSessionAId] = useState<number | null>(null);
  const [compareSessionBId, setCompareSessionBId] = useState<number | null>(null);
  const [compareCountsA, setCompareCountsA] = useState<InventoryCount[]>([]);
  const [compareCountsB, setCompareCountsB] = useState<InventoryCount[]>([]);

  useBackNav(
    tab,
    setTab,
    [
      { isOpen: showNewItem, close: () => setShowNewItem(false) },
      { isOpen: editingItemId !== null, close: () => setEditingItemId(null) },
    ],
    !!activeStaff && canAccessCashDashboard,
  );

  // 権限チェック
  useEffect(() => {
    if (!activeStaff) { router.push("/dashboard"); return; }
    if (!canAccessCashDashboard) { router.push("/dashboard"); return; }
  }, [activeStaff, canAccessCashDashboard, router]);

  // データ取得
  const fetchData = useCallback(async () => {
    setLoading(true);
    const [{ data: storesData }, { data: itemsData }, { data: sessionsData }] = await Promise.all([
      supabase.from("inventory_stores").select("*").order("display_order", { ascending: true }),
      supabase.from("inventory_items").select("*").order("sort_order", { ascending: true }),
      supabase.from("inventory_sessions").select("*").order("count_date", { ascending: false }),
    ]);
    if (storesData) {
      setStores(storesData);
      if (!selectedStoreId && storesData.length > 0) setSelectedStoreId(storesData[0].id);
    }
    if (itemsData) setItems(itemsData);
    if (sessionsData) setSessions(sessionsData);
    setLoading(false);
  }, [selectedStoreId]);

  useEffect(() => { if (canAccessCashDashboard) fetchData(); }, [canAccessCashDashboard, fetchData]);

  // 現在セッションの実績を取得
  useEffect(() => {
    if (!currentSession) {
      if (currentCounts.length > 0) setCurrentCounts([]);
      return;
    }
    let cancelled = false;
    supabase.from("inventory_counts").select("*").eq("session_id", currentSession.id).then(({ data }) => {
      if (!cancelled) setCurrentCounts(data || []);
    });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSession]);

  // 比較データ取得: セレクト変更時に実行
  const loadCompareA = async (id: number | null) => {
    setCompareSessionAId(id);
    if (!id) { setCompareCountsA([]); return; }
    const { data } = await supabase.from("inventory_counts").select("*").eq("session_id", id);
    setCompareCountsA(data || []);
  };
  const loadCompareB = async (id: number | null) => {
    setCompareSessionBId(id);
    if (!id) { setCompareCountsB([]); return; }
    const { data } = await supabase.from("inventory_counts").select("*").eq("session_id", id);
    setCompareCountsB(data || []);
  };

  /* ─── 棚卸セッション操作 ─── */
  const ensureSession = useCallback(async (): Promise<InventorySession | null> => {
    if (currentSession) return currentSession;
    if (!selectedStoreId) return null;
    const store = stores.find(s => s.id === selectedStoreId);
    if (!store) return null;
    const { data, error } = await supabase.from("inventory_sessions").insert({
      count_date: activeDate,
      store_id: selectedStoreId,
      store_name_snapshot: store.name,
      counted_by_name: activeStaff?.name || "",
    }).select("*").single();
    if (error) { alert("セッション作成失敗: " + error.message); return null; }
    setSessions([data, ...sessions]);
    return data;
  }, [currentSession, selectedStoreId, stores, activeDate, activeStaff, sessions]);

  const saveCount = async (item: InventoryItem, quantity: number, unitPrice: number, note: string) => {
    const session = await ensureSession();
    if (!session) return;
    const subtotal = Math.round(quantity * unitPrice);
    const existing = currentCounts.find(c => c.item_id === item.id);
    if (quantity === 0 && !note.trim() && !existing) return; // 空のまま保存しない
    if (existing) {
      await supabase.from("inventory_counts").update({
        quantity, unit_price: unitPrice, subtotal, note,
        item_name_snapshot: item.name, category_snapshot: item.category, unit_snapshot: item.unit,
        counted_by_name: activeStaff?.name || "",
        updated_at: new Date().toISOString(),
      }).eq("id", existing.id);
    } else {
      await supabase.from("inventory_counts").insert({
        session_id: session.id,
        count_date: activeDate,
        store_id: selectedStoreId,
        item_id: item.id,
        item_name_snapshot: item.name,
        category_snapshot: item.category,
        unit_snapshot: item.unit,
        quantity, unit_price: unitPrice, subtotal, note,
        counted_by_name: activeStaff?.name || "",
      });
    }
    // 再取得
    const { data } = await supabase.from("inventory_counts").select("*").eq("session_id", session.id);
    setCurrentCounts(data || []);
    // セッションのtotal更新
    const total = (data || []).reduce((s, c) => s + Number(c.subtotal || 0), 0);
    await supabase.from("inventory_sessions").update({
      total_amount: Math.round(total),
      item_count: (data || []).length,
      updated_at: new Date().toISOString(),
    }).eq("id", session.id);
    // sessions reload
    const { data: newSessions } = await supabase.from("inventory_sessions").select("*").order("count_date", { ascending: false });
    if (newSessions) setSessions(newSessions);
  };

  const finalizeSession = async () => {
    if (!currentSession) { alert("まず実績を1件以上入力してください"); return; }
    const ok = await confirm({
      title: `${currentSession.count_date} ${currentSession.store_name_snapshot} の棚卸を確定しますか？`,
      message: "確定後も編集は可能ですが、「確定済み」としてマーク・タイムスタンプが記録されます。",
      variant: "warning",
      confirmLabel: "確定する",
      icon: "✅",
    });
    if (!ok) return;
    await supabase.from("inventory_sessions").update({
      status: "finalized",
      finalized_at: new Date().toISOString(),
      counted_by_name: activeStaff?.name || currentSession.counted_by_name,
    }).eq("id", currentSession.id);
    const { data: newSessions } = await supabase.from("inventory_sessions").select("*").order("count_date", { ascending: false });
    if (newSessions) setSessions(newSessions);
    alert("✅ 棚卸を確定しました");
  };

  const deleteSession = async (session: InventorySession) => {
    const ok = await confirm({
      title: `${session.count_date} ${session.store_name_snapshot} の棚卸を削除しますか？`,
      message: "関連する実績もすべて削除されます。元に戻せません。",
      variant: "danger",
      confirmLabel: "削除する",
    });
    if (!ok) return;
    await supabase.from("inventory_sessions").delete().eq("id", session.id);
    const { data: newSessions } = await supabase.from("inventory_sessions").select("*").order("count_date", { ascending: false });
    if (newSessions) setSessions(newSessions);
    if (currentSession?.id === session.id) setCurrentCounts([]);
  };

  /* ─── 品目マスター操作 ─── */
  const addItem = async () => {
    if (!newItem.name.trim()) { alert("品目名を入力してください"); return; }
    const sort = items.length > 0 ? Math.max(...items.map(i => i.sort_order || 0)) + 10 : 10;
    const { error } = await supabase.from("inventory_items").insert({
      name: newItem.name.trim(),
      category: newItem.category,
      unit: newItem.unit,
      default_unit_price: parseFloat(newItem.default_unit_price) || 0,
      sort_order: sort,
      notes: newItem.notes.trim(),
    });
    if (error) { alert("追加失敗: " + error.message); return; }
    setNewItem({ name: "", category: newItem.category, unit: newItem.unit, default_unit_price: "", notes: "" });
    setShowNewItem(false);
    fetchData();
  };

  const saveItemEdit = async () => {
    if (editingItemId === null) return;
    const updates: Record<string, unknown> = {};
    if (editingItemData.name !== undefined) updates.name = editingItemData.name;
    if (editingItemData.category !== undefined) updates.category = editingItemData.category;
    if (editingItemData.unit !== undefined) updates.unit = editingItemData.unit;
    if (editingItemData.default_unit_price !== undefined) updates.default_unit_price = editingItemData.default_unit_price;
    if (editingItemData.notes !== undefined) updates.notes = editingItemData.notes;
    const { error } = await supabase.from("inventory_items").update(updates).eq("id", editingItemId);
    if (error) { alert("保存失敗: " + error.message); return; }
    setEditingItemId(null);
    setEditingItemData({});
    fetchData();
  };

  const deleteItem = async (item: InventoryItem) => {
    const { count } = await supabase.from("inventory_counts").select("*", { count: "exact", head: true }).eq("item_id", item.id);
    if ((count || 0) > 0) {
      const ok = await confirm({
        title: `「${item.name}」は過去の棚卸で使用されています`,
        message: "廃番扱い（一覧から非表示）にしますか？ 過去の実績データは保持されます。",
        variant: "warning",
        confirmLabel: "廃番にする",
        icon: "📦",
      });
      if (!ok) return;
      await supabase.from("inventory_items").update({ is_active: false }).eq("id", item.id);
    } else {
      const ok = await confirm({
        title: `「${item.name}」を完全に削除しますか？`,
        message: "過去に使われていないため、完全削除が可能です。",
        variant: "danger",
        confirmLabel: "削除する",
      });
      if (!ok) return;
      const { error } = await supabase.from("inventory_items").delete().eq("id", item.id);
      if (error) { alert("削除失敗: " + error.message); return; }
    }
    fetchData();
  };

  const restoreItem = async (item: InventoryItem) => {
    await supabase.from("inventory_items").update({ is_active: true }).eq("id", item.id);
    fetchData();
  };

  /* ─── PDF出力 ─── */
  const exportPdf = (session: InventorySession, counts: InventoryCount[]) => {
    const byCategory: Record<string, InventoryCount[]> = {};
    CATEGORY_ORDER.forEach(c => { byCategory[c] = []; });
    counts.forEach(c => {
      const cat = c.category_snapshot || "その他";
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(c);
    });

    const total = counts.reduce((s, c) => s + Number(c.subtotal || 0), 0);

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>棚卸表 ${session.count_date} ${session.store_name_snapshot}</title>
<style>
  body { font-family: "Hiragino Sans","Yu Gothic","Meiryo",sans-serif; padding: 24px; color: #111; max-width: 820px; margin: 0 auto; font-size: 12px; }
  h1 { font-size: 18px; border-bottom: 2px solid #111; padding-bottom: 6px; margin: 0 0 12px; }
  .meta { display: flex; justify-content: space-between; font-size: 11px; color: #555; margin-bottom: 12px; }
  h2 { font-size: 13px; margin: 16px 0 6px; padding: 4px 8px; background: #f3f3f0; border-left: 3px solid #888; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th, td { border: 1px solid #ccc; padding: 4px 6px; }
  th { background: #f8f8f4; font-weight: 500; text-align: left; }
  td.num { text-align: right; font-variant-numeric: tabular-nums; }
  td.center { text-align: center; }
  .total-row { font-weight: bold; background: #eee9dd; }
  .grand-total { font-size: 16px; text-align: right; margin-top: 16px; padding: 10px; background: #f3f3f0; border: 2px solid #c3a782; }
  .note { font-size: 10px; color: #666; margin-top: 16px; padding: 8px; border: 1px dashed #ccc; }
  @media print { body { padding: 0; } }
</style></head><body>
<h1>📦 棚卸表</h1>
<div class="meta">
  <div>
    <strong>店舗:</strong> ${session.store_name_snapshot}<br>
    <strong>棚卸日:</strong> ${session.count_date}
  </div>
  <div>
    <strong>会計期:</strong> ${session.fiscal_period || "—"}<br>
    <strong>担当者:</strong> ${session.counted_by_name || "—"}<br>
    <strong>状態:</strong> ${session.status === "finalized" ? "✅ 確定済み" : "📝 下書き"}
  </div>
</div>
${CATEGORY_ORDER.map(cat => {
  const rows = byCategory[cat] || [];
  if (rows.length === 0) return "";
  const catTotal = rows.reduce((s, c) => s + Number(c.subtotal || 0), 0);
  return `<h2>${cat}</h2>
<table>
<thead><tr>
  <th style="width:40%">品目</th>
  <th style="width:10%" class="center">単位</th>
  <th style="width:12%" class="num">数量</th>
  <th style="width:12%" class="num">単価</th>
  <th style="width:14%" class="num">小計</th>
  <th style="width:12%">備考</th>
</tr></thead>
<tbody>
  ${rows.map(r => `<tr>
    <td>${r.item_name_snapshot}</td>
    <td class="center">${r.unit_snapshot || "—"}</td>
    <td class="num">${Number(r.quantity).toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
    <td class="num">¥${Number(r.unit_price).toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
    <td class="num">¥${Math.round(Number(r.subtotal)).toLocaleString()}</td>
    <td>${r.note || ""}</td>
  </tr>`).join("")}
  <tr class="total-row"><td colspan="4" style="text-align:right">小計</td><td class="num">¥${Math.round(catTotal).toLocaleString()}</td><td></td></tr>
</tbody></table>`;
}).join("")}
<div class="grand-total">棚卸合計金額: ¥${Math.round(total).toLocaleString()}（${counts.length}品目）</div>
<div class="note">
  本表は会計管理目的で作成されたもので、期末時点の在庫資産金額の根拠資料となります。<br>
  ${session.memo ? `メモ: ${session.memo}` : ""}
</div>
<script>window.onload = () => { window.print(); };</script>
</body></html>`;

    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); }
  };

  if (!activeStaff || !canAccessCashDashboard) return null;

  const bg = T.bg;
  const inputStyle: React.CSSProperties = { backgroundColor: T.card, color: T.text, border: `1px solid ${T.border}` };
  const gridBorder = `1px solid ${T.border}`;

  // 選択中店舗
  const selectedStore = stores.find(s => s.id === selectedStoreId);

  // 品目マスターフィルタ
  const filteredMasterItems = items.filter(i => {
    if (!showInactive && !i.is_active) return false;
    if (masterCategoryFilter !== "all" && i.category !== masterCategoryFilter) return false;
    return true;
  });

  // 棚卸実施: 現在セッションの履歴マップ
  const countMap = new Map<number, InventoryCount>();
  currentCounts.forEach(c => { if (c.item_id) countMap.set(c.item_id, c); });

  // カテゴリ別にitemをグループ
  const itemsByCategory: Record<string, InventoryItem[]> = {};
  CATEGORY_ORDER.forEach(c => { itemsByCategory[c] = []; });
  items.filter(i => i.is_active).forEach(i => {
    const cat = i.category || "その他";
    if (!itemsByCategory[cat]) itemsByCategory[cat] = [];
    itemsByCategory[cat].push(i);
  });

  const grandTotal = currentCounts.reduce((s, c) => s + Number(c.subtotal || 0), 0);

  return (
    <div className="min-h-screen" style={{ backgroundColor: bg, color: T.text }}>
      {ConfirmModalNode}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* ヘッダー */}
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <NavMenu T={T} dark={dark} />
            <Link href="/dashboard" className="text-[12px]" style={{ color: T.textSub }}>← HOME</Link>
            <h1 className="text-xl font-semibold">📦 棚卸管理</h1>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={toggle} className="text-[11px] px-3 py-1.5 rounded-lg cursor-pointer" style={{ backgroundColor: T.cardAlt, color: T.textSub, border: `1px solid ${T.border}` }}>{dark ? "☀️" : "🌙"}</button>
          </div>
        </div>

        {/* 店舗セレクタ */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <span className="text-[11px]" style={{ color: T.textSub }}>店舗:</span>
          {stores.map(store => (
            <button
              key={store.id}
              onClick={() => setSelectedStoreId(store.id)}
              className="px-4 py-1.5 text-[12px] rounded-lg cursor-pointer font-medium"
              style={{
                backgroundColor: selectedStoreId === store.id ? "#c3a782" : T.cardAlt,
                color: selectedStoreId === store.id ? "white" : T.textSub,
                border: `1px solid ${selectedStoreId === store.id ? "#c3a782" : T.border}`,
              }}
            >🏢 {store.name}</button>
          ))}
        </div>

        {/* サブタブ */}
        <div className="flex items-center gap-1 mb-4" style={{ borderBottom: `1px solid ${T.border}` }}>
          {[
            { k: "count" as Tab, l: "📅 棚卸実施" },
            { k: "master" as Tab, l: "📋 品目マスター" },
            { k: "history" as Tab, l: "📊 履歴・比較" },
          ].map(x => (
            <button
              key={x.k}
              onClick={() => setTab(x.k)}
              className="px-4 py-2 text-[12px] cursor-pointer"
              style={{
                backgroundColor: tab === x.k ? T.card : "transparent",
                color: tab === x.k ? T.text : T.textSub,
                borderBottom: tab === x.k ? "2px solid #c3a782" : "2px solid transparent",
                fontWeight: tab === x.k ? 500 : 400,
                marginBottom: -1,
              }}
            >{x.l}</button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-12" style={{ color: T.textFaint }}>読み込み中...</div>
        ) : !selectedStore ? (
          <div className="text-center py-12" style={{ color: T.textFaint }}>店舗を選択してください</div>
        ) : (
          <>
            {/* ─── 棚卸実施タブ ─── */}
            {tab === "count" && (
              <div className="space-y-3">
                {/* ヘッダーカード */}
                <div className="rounded-xl p-4" style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                    <div>
                      <label className="block text-[10px] mb-1" style={{ color: T.textSub }}>棚卸日</label>
                      <input type="date" value={activeDate} onChange={(e) => setActiveDate(e.target.value)} className="w-full px-3 py-2 rounded-lg text-[12px] outline-none" style={inputStyle} />
                    </div>
                    <div>
                      <label className="block text-[10px] mb-1" style={{ color: T.textSub }}>会計期（任意）</label>
                      <input
                        type="text"
                        placeholder="例: 第3期末"
                        value={currentSession?.fiscal_period || ""}
                        onChange={async (e) => {
                          const session = await ensureSession();
                          if (!session) return;
                          await supabase.from("inventory_sessions").update({ fiscal_period: e.target.value }).eq("id", session.id);
                          const { data } = await supabase.from("inventory_sessions").select("*").order("count_date", { ascending: false });
                          if (data) setSessions(data);
                        }}
                        className="w-full px-3 py-2 rounded-lg text-[12px] outline-none" style={inputStyle}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] mb-1" style={{ color: T.textSub }}>メモ（任意）</label>
                      <input
                        type="text"
                        placeholder="例: 大石社労士と棚卸"
                        value={currentSession?.memo || ""}
                        onChange={async (e) => {
                          const session = await ensureSession();
                          if (!session) return;
                          await supabase.from("inventory_sessions").update({ memo: e.target.value }).eq("id", session.id);
                          const { data } = await supabase.from("inventory_sessions").select("*").order("count_date", { ascending: false });
                          if (data) setSessions(data);
                        }}
                        className="w-full px-3 py-2 rounded-lg text-[12px] outline-none" style={inputStyle}
                      />
                    </div>
                    <div>
                      <div className="text-[10px]" style={{ color: T.textSub }}>状態</div>
                      {currentSession ? (
                        currentSession.status === "finalized" ? (
                          <div className="px-3 py-2 rounded-lg text-[12px]" style={{ backgroundColor: "#22c55e18", color: "#22c55e", border: "1px solid #22c55e33" }}>✅ 確定済み</div>
                        ) : (
                          <div className="px-3 py-2 rounded-lg text-[12px]" style={{ backgroundColor: "#f59e0b18", color: "#f59e0b", border: "1px solid #f59e0b33" }}>📝 下書き</div>
                        )
                      ) : (
                        <div className="px-3 py-2 rounded-lg text-[12px]" style={{ backgroundColor: T.cardAlt, color: T.textFaint, border: `1px solid ${T.border}` }}>未開始</div>
                      )}
                    </div>
                  </div>
                </div>

                {/* 品目カテゴリ別入力 */}
                {CATEGORY_ORDER.map(cat => {
                  const catItems = itemsByCategory[cat] || [];
                  if (catItems.length === 0) return null;
                  const catColor = CATEGORY_COLORS[cat] || "#888";
                  const catTotal = catItems.reduce((s, item) => {
                    const c = countMap.get(item.id);
                    return s + (c ? Number(c.subtotal || 0) : 0);
                  }, 0);
                  return (
                    <div key={cat} className="rounded-xl overflow-hidden" style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}>
                      <div className="px-4 py-2.5 flex items-center justify-between" style={{ backgroundColor: catColor + "15", borderBottom: gridBorder }}>
                        <span className="text-[12px] font-medium" style={{ color: catColor }}>📂 {cat}</span>
                        <span className="text-[11px] font-medium" style={{ color: catColor }}>小計 {fmt(catTotal)}</span>
                      </div>
                      <table className="w-full" style={{ fontSize: 12 }}>
                        <thead>
                          <tr style={{ color: T.textSub, fontSize: 11, backgroundColor: T.cardAlt + "60" }}>
                            <th style={{ padding: "6px 10px", textAlign: "left", borderBottom: gridBorder }}>品目</th>
                            <th style={{ padding: "6px 10px", textAlign: "center", borderLeft: gridBorder, borderBottom: gridBorder, width: 60 }}>単位</th>
                            <th style={{ padding: "6px 10px", textAlign: "right", borderLeft: gridBorder, borderBottom: gridBorder, width: 110 }}>数量</th>
                            <th style={{ padding: "6px 10px", textAlign: "right", borderLeft: gridBorder, borderBottom: gridBorder, width: 110 }}>単価</th>
                            <th style={{ padding: "6px 10px", textAlign: "right", borderLeft: gridBorder, borderBottom: gridBorder, width: 110 }}>小計</th>
                            <th style={{ padding: "6px 10px", textAlign: "left", borderLeft: gridBorder, borderBottom: gridBorder, width: 180 }}>備考</th>
                          </tr>
                        </thead>
                        <tbody>
                          {catItems.map((item, idx) => {
                            const count = countMap.get(item.id);
                            const qty = count?.quantity ?? 0;
                            const price = count?.unit_price ?? item.default_unit_price ?? 0;
                            const subtotal = count?.subtotal ?? 0;
                            return (
                              <tr key={item.id} style={{ borderTop: idx === 0 ? "none" : gridBorder, backgroundColor: idx % 2 === 0 ? "transparent" : T.cardAlt + "25" }}>
                                <td style={{ padding: "5px 10px", fontSize: 12 }}>
                                  {item.name}
                                </td>
                                <td style={{ padding: "5px 10px", textAlign: "center", borderLeft: gridBorder, color: T.textSub, fontSize: 11 }}>{item.unit}</td>
                                <td style={{ padding: "4px 6px", borderLeft: gridBorder }}>
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    defaultValue={qty || ""}
                                    onBlur={(e) => {
                                      const newQty = parseFloat(e.target.value) || 0;
                                      if (newQty !== qty) saveCount(item, newQty, Number(price), count?.note || "");
                                    }}
                                    className="w-full px-2 py-1 rounded text-[12px] outline-none text-right"
                                    style={{ backgroundColor: T.bg, color: T.text, border: `1px solid ${T.border}` }}
                                  />
                                </td>
                                <td style={{ padding: "4px 6px", borderLeft: gridBorder }}>
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    defaultValue={price || ""}
                                    onBlur={(e) => {
                                      const newPrice = parseFloat(e.target.value) || 0;
                                      if (newPrice !== Number(price) && qty > 0) saveCount(item, Number(qty), newPrice, count?.note || "");
                                    }}
                                    className="w-full px-2 py-1 rounded text-[12px] outline-none text-right"
                                    style={{ backgroundColor: T.bg, color: T.text, border: `1px solid ${T.border}` }}
                                  />
                                </td>
                                <td style={{ padding: "5px 10px", textAlign: "right", borderLeft: gridBorder, fontVariantNumeric: "tabular-nums", fontWeight: subtotal > 0 ? 500 : 400, color: subtotal > 0 ? T.text : T.textFaint }}>
                                  {subtotal > 0 ? fmt(Number(subtotal)) : "—"}
                                </td>
                                <td style={{ padding: "4px 6px", borderLeft: gridBorder }}>
                                  <input
                                    type="text"
                                    defaultValue={count?.note || ""}
                                    onBlur={(e) => {
                                      if ((e.target.value || "") !== (count?.note || "") && qty > 0) saveCount(item, Number(qty), Number(price), e.target.value);
                                    }}
                                    placeholder="—"
                                    className="w-full px-2 py-1 rounded text-[11px] outline-none"
                                    style={{ backgroundColor: T.bg, color: T.text, border: `1px solid ${T.border}` }}
                                  />
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  );
                })}

                {/* 合計 + アクション */}
                <div className="rounded-xl p-4 flex items-center justify-between flex-wrap gap-3" style={{ backgroundColor: "#c3a78215", border: "2px solid #c3a782" }}>
                  <div>
                    <div className="text-[10px]" style={{ color: T.textSub }}>棚卸合計金額</div>
                    <div className="text-2xl font-bold" style={{ color: "#c3a782" }}>{fmt(grandTotal)}</div>
                    <div className="text-[10px]" style={{ color: T.textFaint }}>{currentCounts.length} 品目 / 記入済み</div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {currentSession && currentCounts.length > 0 && (
                      <>
                        <button onClick={() => exportPdf(currentSession, currentCounts)} className="text-[12px] px-4 py-2 rounded-lg cursor-pointer font-medium" style={{ backgroundColor: "#85a8c4", color: "white", border: "none" }}>📄 棚卸表PDF出力</button>
                        {currentSession.status !== "finalized" && (
                          <button onClick={finalizeSession} className="text-[12px] px-4 py-2 rounded-lg cursor-pointer font-medium" style={{ backgroundColor: "#22c55e", color: "white", border: "none" }}>✅ 棚卸を確定</button>
                        )}
                      </>
                    )}
                  </div>
                </div>

                <div className="rounded-xl p-4" style={{ backgroundColor: "#85a8c410", border: "1px solid #85a8c433" }}>
                  <p className="text-[11px] leading-relaxed" style={{ color: T.textSub }}>
                    💡 <strong>使い方</strong>: 数量欄に実際の数を入力するとフォーカスを外した時点で自動保存されます。単価は品目マスターから自動セット（変更可能）。全品目の入力が完了したら「✅ 棚卸を確定」で確定できます。PDF出力後は書類庫（税理士ポータル）にアップロードしてください。
                  </p>
                </div>
              </div>
            )}

            {/* ─── 品目マスタータブ ─── */}
            {tab === "master" && (
              <div className="space-y-3">
                {/* フィルタ */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px]" style={{ color: T.textSub }}>カテゴリ:</span>
                  <button onClick={() => setMasterCategoryFilter("all")} className="px-3 py-1 text-[10px] rounded-lg cursor-pointer" style={{ backgroundColor: masterCategoryFilter === "all" ? "#c3a782" : T.cardAlt, color: masterCategoryFilter === "all" ? "white" : T.textSub, border: `1px solid ${masterCategoryFilter === "all" ? "#c3a782" : T.border}` }}>すべて ({items.filter(i => showInactive || i.is_active).length})</button>
                  {CATEGORY_ORDER.map(c => {
                    const count = items.filter(i => i.category === c && (showInactive || i.is_active)).length;
                    if (count === 0) return null;
                    return <button key={c} onClick={() => setMasterCategoryFilter(c)} className="px-3 py-1 text-[10px] rounded-lg cursor-pointer" style={{ backgroundColor: masterCategoryFilter === c ? "#c3a782" : T.cardAlt, color: masterCategoryFilter === c ? "white" : T.textSub, border: `1px solid ${masterCategoryFilter === c ? "#c3a782" : T.border}` }}>{c} ({count})</button>;
                  })}
                  <label className="flex items-center gap-1 ml-3 cursor-pointer">
                    <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} className="cursor-pointer" />
                    <span className="text-[10px]" style={{ color: T.textSub }}>廃番も表示</span>
                  </label>
                  <div className="flex-grow"></div>
                  <button onClick={() => setShowNewItem(!showNewItem)} className="px-3 py-1.5 text-[11px] rounded-lg cursor-pointer font-medium" style={{ backgroundColor: "#c3a782", color: "white", border: "none" }}>＋ 品目を追加</button>
                </div>

                {/* 新規追加フォーム */}
                {showNewItem && (
                  <div className="rounded-xl p-4" style={{ backgroundColor: T.card, border: `1px solid #c3a782` }}>
                    <div className="grid grid-cols-1 md:grid-cols-6 gap-2 items-end">
                      <div className="md:col-span-2">
                        <label className="block text-[10px] mb-1" style={{ color: T.textSub }}>品目名 *</label>
                        <input type="text" value={newItem.name} onChange={(e) => setNewItem({ ...newItem, name: e.target.value })} className="w-full px-2 py-1.5 rounded text-[12px] outline-none" style={inputStyle} />
                      </div>
                      <div>
                        <label className="block text-[10px] mb-1" style={{ color: T.textSub }}>カテゴリ</label>
                        <select value={newItem.category} onChange={(e) => setNewItem({ ...newItem, category: e.target.value })} className="w-full px-2 py-1.5 rounded text-[12px] outline-none cursor-pointer" style={inputStyle}>
                          {CATEGORY_ORDER.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] mb-1" style={{ color: T.textSub }}>単位</label>
                        <input type="text" list="unit-presets" value={newItem.unit} onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })} className="w-full px-2 py-1.5 rounded text-[12px] outline-none" style={inputStyle} />
                        <datalist id="unit-presets">{UNIT_PRESETS.map(u => <option key={u} value={u} />)}</datalist>
                      </div>
                      <div>
                        <label className="block text-[10px] mb-1" style={{ color: T.textSub }}>参考単価 (¥)</label>
                        <input type="number" step="0.01" min="0" value={newItem.default_unit_price} onChange={(e) => setNewItem({ ...newItem, default_unit_price: e.target.value })} className="w-full px-2 py-1.5 rounded text-[12px] outline-none text-right" style={inputStyle} />
                      </div>
                      <div className="flex gap-1">
                        <button onClick={addItem} className="flex-grow text-[11px] px-3 py-1.5 rounded cursor-pointer" style={{ backgroundColor: "#22c55e", color: "white", border: "none" }}>💾 追加</button>
                        <button onClick={() => setShowNewItem(false)} className="text-[11px] px-3 py-1.5 rounded cursor-pointer" style={{ backgroundColor: T.cardAlt, color: T.textSub, border: "none" }}>✕</button>
                      </div>
                    </div>
                  </div>
                )}

                {/* 品目一覧 */}
                <div className="rounded-xl overflow-hidden" style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}>
                  <div className="px-4 py-2.5" style={{ backgroundColor: T.cardAlt, borderBottom: gridBorder }}>
                    <span className="text-[12px] font-medium">📋 品目マスター（{filteredMasterItems.length}件）</span>
                  </div>
                  <table className="w-full" style={{ fontSize: 12 }}>
                    <thead style={{ backgroundColor: T.cardAlt + "60" }}>
                      <tr style={{ color: T.textSub, fontSize: 11 }}>
                        <th style={{ padding: "6px 10px", textAlign: "left", borderBottom: gridBorder }}>品目名</th>
                        <th style={{ padding: "6px 10px", textAlign: "left", borderLeft: gridBorder, borderBottom: gridBorder, width: 180 }}>カテゴリ</th>
                        <th style={{ padding: "6px 10px", textAlign: "center", borderLeft: gridBorder, borderBottom: gridBorder, width: 70 }}>単位</th>
                        <th style={{ padding: "6px 10px", textAlign: "right", borderLeft: gridBorder, borderBottom: gridBorder, width: 110 }}>参考単価</th>
                        <th style={{ padding: "6px 10px", textAlign: "center", borderLeft: gridBorder, borderBottom: gridBorder, width: 70 }}>状態</th>
                        <th style={{ padding: "6px 10px", textAlign: "center", borderLeft: gridBorder, borderBottom: gridBorder, width: 140 }}>操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredMasterItems.length === 0 ? (
                        <tr><td colSpan={6} style={{ padding: "24px", textAlign: "center", color: T.textFaint, fontSize: 11 }}>該当する品目がありません</td></tr>
                      ) : filteredMasterItems.map((item, i) => {
                        const editing = editingItemId === item.id;
                        const catColor = CATEGORY_COLORS[item.category] || "#888";
                        return (
                          <tr key={item.id} style={{ borderTop: gridBorder, backgroundColor: i % 2 === 0 ? "transparent" : T.cardAlt + "40", opacity: item.is_active ? 1 : 0.5 }}>
                            <td style={{ padding: "5px 10px" }}>
                              {editing ? (
                                <input type="text" autoFocus value={editingItemData.name ?? item.name} onChange={(e) => setEditingItemData({ ...editingItemData, name: e.target.value })} className="w-full px-2 py-1 rounded text-[12px] outline-none" style={{ backgroundColor: T.bg, color: T.text, border: "1px solid #c3a782" }} />
                              ) : item.name}
                            </td>
                            <td style={{ padding: "5px 10px", borderLeft: gridBorder }}>
                              {editing ? (
                                <select value={editingItemData.category ?? item.category} onChange={(e) => setEditingItemData({ ...editingItemData, category: e.target.value })} className="w-full px-2 py-1 rounded text-[12px] outline-none cursor-pointer" style={{ backgroundColor: T.bg, color: T.text, border: "1px solid #c3a782" }}>
                                  {CATEGORY_ORDER.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                              ) : (
                                <span className="text-[10px] px-2 py-0.5 rounded" style={{ backgroundColor: catColor + "22", color: catColor }}>{item.category}</span>
                              )}
                            </td>
                            <td style={{ padding: "5px 10px", textAlign: "center", borderLeft: gridBorder, color: T.textSub }}>
                              {editing ? (
                                <input type="text" list="unit-presets" value={editingItemData.unit ?? item.unit} onChange={(e) => setEditingItemData({ ...editingItemData, unit: e.target.value })} className="w-full px-2 py-1 rounded text-[12px] outline-none" style={{ backgroundColor: T.bg, color: T.text, border: "1px solid #c3a782" }} />
                              ) : item.unit}
                            </td>
                            <td style={{ padding: "5px 10px", textAlign: "right", borderLeft: gridBorder, fontVariantNumeric: "tabular-nums", color: T.textSub }}>
                              {editing ? (
                                <input type="number" step="0.01" min="0" value={editingItemData.default_unit_price ?? item.default_unit_price ?? 0} onChange={(e) => setEditingItemData({ ...editingItemData, default_unit_price: parseFloat(e.target.value) || 0 })} className="w-full px-2 py-1 rounded text-[12px] outline-none text-right" style={{ backgroundColor: T.bg, color: T.text, border: "1px solid #c3a782" }} />
                              ) : fmt(Number(item.default_unit_price))}
                            </td>
                            <td style={{ padding: "5px 10px", textAlign: "center", borderLeft: gridBorder }}>
                              {item.is_active ? (
                                <span className="text-[10px] px-2 py-0.5 rounded" style={{ backgroundColor: "#22c55e22", color: "#22c55e" }}>✓ 有効</span>
                              ) : (
                                <span className="text-[10px] px-2 py-0.5 rounded" style={{ backgroundColor: "#88878022", color: "#888780" }}>廃番</span>
                              )}
                            </td>
                            <td style={{ padding: "5px 10px", textAlign: "center", borderLeft: gridBorder }}>
                              {editing ? (
                                <>
                                  <button onClick={saveItemEdit} className="text-[10px] px-2 py-1 rounded cursor-pointer mr-1" style={{ backgroundColor: "#22c55e18", color: "#22c55e", border: "none" }}>✓ 保存</button>
                                  <button onClick={() => { setEditingItemId(null); setEditingItemData({}); }} className="text-[10px] px-2 py-1 rounded cursor-pointer" style={{ backgroundColor: T.cardAlt, color: T.textSub, border: "none" }}>✕</button>
                                </>
                              ) : (
                                <>
                                  <button onClick={() => { setEditingItemId(item.id); setEditingItemData({}); }} className="text-[10px] px-2 py-1 rounded cursor-pointer mr-1" style={{ backgroundColor: "#c3a78218", color: "#c3a782", border: "none" }}>✏️</button>
                                  {item.is_active ? (
                                    <button onClick={() => deleteItem(item)} className="text-[10px] px-2 py-1 rounded cursor-pointer" style={{ backgroundColor: "#c4555518", color: "#c45555", border: "none" }}>🗑</button>
                                  ) : (
                                    <button onClick={() => restoreItem(item)} className="text-[10px] px-2 py-1 rounded cursor-pointer" style={{ backgroundColor: "#22c55e18", color: "#22c55e", border: "none" }}>↩ 復活</button>
                                  )}
                                </>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ─── 履歴・比較タブ ─── */}
            {tab === "history" && (
              <div className="space-y-3">
                {/* 店舗別棚卸セッション一覧 */}
                <div className="rounded-xl overflow-hidden" style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}>
                  <div className="px-4 py-2.5" style={{ backgroundColor: T.cardAlt, borderBottom: gridBorder }}>
                    <span className="text-[12px] font-medium">📅 棚卸履歴（{selectedStore.name}）</span>
                  </div>
                  {(() => {
                    const storeSessions = sessions.filter(s => s.store_id === selectedStoreId);
                    if (storeSessions.length === 0) return <div style={{ padding: "24px", textAlign: "center", color: T.textFaint, fontSize: 11 }}>棚卸履歴がまだありません</div>;
                    return (
                      <table className="w-full" style={{ fontSize: 12 }}>
                        <thead style={{ backgroundColor: T.cardAlt + "60" }}>
                          <tr style={{ color: T.textSub, fontSize: 11 }}>
                            <th style={{ padding: "6px 10px", textAlign: "left", borderBottom: gridBorder }}>棚卸日</th>
                            <th style={{ padding: "6px 10px", textAlign: "left", borderLeft: gridBorder, borderBottom: gridBorder }}>会計期</th>
                            <th style={{ padding: "6px 10px", textAlign: "center", borderLeft: gridBorder, borderBottom: gridBorder, width: 90 }}>状態</th>
                            <th style={{ padding: "6px 10px", textAlign: "right", borderLeft: gridBorder, borderBottom: gridBorder, width: 100 }}>品目数</th>
                            <th style={{ padding: "6px 10px", textAlign: "right", borderLeft: gridBorder, borderBottom: gridBorder, width: 130 }}>合計金額</th>
                            <th style={{ padding: "6px 10px", textAlign: "left", borderLeft: gridBorder, borderBottom: gridBorder }}>メモ</th>
                            <th style={{ padding: "6px 10px", textAlign: "left", borderLeft: gridBorder, borderBottom: gridBorder, width: 100 }}>担当者</th>
                            <th style={{ padding: "6px 10px", textAlign: "center", borderLeft: gridBorder, borderBottom: gridBorder, width: 180 }}>操作</th>
                          </tr>
                        </thead>
                        <tbody>
                          {storeSessions.map((session, i) => (
                            <tr key={session.id} style={{ borderTop: gridBorder, backgroundColor: i % 2 === 0 ? "transparent" : T.cardAlt + "40" }}>
                              <td style={{ padding: "5px 10px", fontVariantNumeric: "tabular-nums" }}>{session.count_date}</td>
                              <td style={{ padding: "5px 10px", borderLeft: gridBorder, color: T.textSub }}>{session.fiscal_period || "—"}</td>
                              <td style={{ padding: "5px 10px", textAlign: "center", borderLeft: gridBorder }}>
                                {session.status === "finalized" ? (
                                  <span className="text-[10px] px-2 py-0.5 rounded" style={{ backgroundColor: "#22c55e22", color: "#22c55e" }}>✅ 確定</span>
                                ) : (
                                  <span className="text-[10px] px-2 py-0.5 rounded" style={{ backgroundColor: "#f59e0b22", color: "#f59e0b" }}>📝 下書き</span>
                                )}
                              </td>
                              <td style={{ padding: "5px 10px", textAlign: "right", borderLeft: gridBorder, fontVariantNumeric: "tabular-nums", color: T.textSub }}>{session.item_count}</td>
                              <td style={{ padding: "5px 10px", textAlign: "right", borderLeft: gridBorder, fontVariantNumeric: "tabular-nums", fontWeight: 500 }}>{fmt(session.total_amount)}</td>
                              <td style={{ padding: "5px 10px", borderLeft: gridBorder, color: T.textMuted, fontSize: 10 }}>{session.memo || ""}</td>
                              <td style={{ padding: "5px 10px", borderLeft: gridBorder, color: T.textMuted, fontSize: 10 }}>{session.counted_by_name || "—"}</td>
                              <td style={{ padding: "5px 10px", textAlign: "center", borderLeft: gridBorder, whiteSpace: "nowrap" }}>
                                <button onClick={async () => {
                                  const { data } = await supabase.from("inventory_counts").select("*").eq("session_id", session.id);
                                  exportPdf(session, data || []);
                                }} className="text-[10px] px-2 py-1 rounded cursor-pointer mr-1" style={{ backgroundColor: "#85a8c418", color: "#85a8c4", border: "none" }}>📄</button>
                                <button onClick={() => { setActiveDate(session.count_date); setTab("count"); }} className="text-[10px] px-2 py-1 rounded cursor-pointer mr-1" style={{ backgroundColor: "#c3a78218", color: "#c3a782", border: "none" }}>✏️</button>
                                <button onClick={() => deleteSession(session)} className="text-[10px] px-2 py-1 rounded cursor-pointer" style={{ backgroundColor: "#c4555518", color: "#c45555", border: "none" }}>🗑</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    );
                  })()}
                </div>

                {/* 比較ビュー */}
                <div className="rounded-xl p-4" style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}>
                  <div className="text-[12px] font-medium mb-3">🔍 棚卸比較（前年同期比 等）</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="block text-[10px] mb-1" style={{ color: T.textSub }}>A: 比較元</label>
                      <select value={compareSessionAId || ""} onChange={(e) => loadCompareA(e.target.value ? Number(e.target.value) : null)} className="w-full px-3 py-2 rounded-lg text-[12px] outline-none cursor-pointer" style={inputStyle}>
                        <option value="">選択してください</option>
                        {sessions.filter(s => s.store_id === selectedStoreId).map(s => (
                          <option key={s.id} value={s.id}>{s.count_date} {s.fiscal_period ? `(${s.fiscal_period})` : ""} 合計{fmt(s.total_amount)}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] mb-1" style={{ color: T.textSub }}>B: 比較先</label>
                      <select value={compareSessionBId || ""} onChange={(e) => loadCompareB(e.target.value ? Number(e.target.value) : null)} className="w-full px-3 py-2 rounded-lg text-[12px] outline-none cursor-pointer" style={inputStyle}>
                        <option value="">選択してください</option>
                        {sessions.filter(s => s.store_id === selectedStoreId).map(s => (
                          <option key={s.id} value={s.id}>{s.count_date} {s.fiscal_period ? `(${s.fiscal_period})` : ""} 合計{fmt(s.total_amount)}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {(compareCountsA.length > 0 || compareCountsB.length > 0) && (() => {
                    // 全品目ID集合
                    const itemIdSet = new Set<number>();
                    compareCountsA.forEach(c => c.item_id && itemIdSet.add(c.item_id));
                    compareCountsB.forEach(c => c.item_id && itemIdSet.add(c.item_id));
                    const mapA = new Map(compareCountsA.map(c => [c.item_id, c]));
                    const mapB = new Map(compareCountsB.map(c => [c.item_id, c]));
                    const rows = [...itemIdSet].map(id => {
                      const a = mapA.get(id);
                      const b = mapB.get(id);
                      const name = a?.item_name_snapshot || b?.item_name_snapshot || "";
                      const category = a?.category_snapshot || b?.category_snapshot || "その他";
                      const subA = Number(a?.subtotal || 0);
                      const subB = Number(b?.subtotal || 0);
                      return { id, name, category, subA, subB, diff: subB - subA };
                    }).sort((x, y) => Math.abs(y.diff) - Math.abs(x.diff));
                    const totalA = compareCountsA.reduce((s, c) => s + Number(c.subtotal || 0), 0);
                    const totalB = compareCountsB.reduce((s, c) => s + Number(c.subtotal || 0), 0);
                    return (
                      <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${T.border}` }}>
                        <table className="w-full" style={{ fontSize: 12 }}>
                          <thead style={{ backgroundColor: T.cardAlt }}>
                            <tr style={{ color: T.textSub, fontSize: 11 }}>
                              <th style={{ padding: "6px 10px", textAlign: "left", borderBottom: gridBorder }}>品目</th>
                              <th style={{ padding: "6px 10px", textAlign: "left", borderLeft: gridBorder, borderBottom: gridBorder, width: 150 }}>カテゴリ</th>
                              <th style={{ padding: "6px 10px", textAlign: "right", borderLeft: gridBorder, borderBottom: gridBorder, width: 120 }}>A</th>
                              <th style={{ padding: "6px 10px", textAlign: "right", borderLeft: gridBorder, borderBottom: gridBorder, width: 120 }}>B</th>
                              <th style={{ padding: "6px 10px", textAlign: "right", borderLeft: gridBorder, borderBottom: gridBorder, width: 130 }}>差額 (B-A)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map((r, i) => {
                              const catColor = CATEGORY_COLORS[r.category] || "#888";
                              const diffColor = r.diff > 0 ? "#22c55e" : r.diff < 0 ? "#c45555" : T.textFaint;
                              return (
                                <tr key={r.id} style={{ borderTop: gridBorder, backgroundColor: i % 2 === 0 ? "transparent" : T.cardAlt + "40" }}>
                                  <td style={{ padding: "5px 10px" }}>{r.name}</td>
                                  <td style={{ padding: "5px 10px", borderLeft: gridBorder }}>
                                    <span className="text-[10px] px-2 py-0.5 rounded" style={{ backgroundColor: catColor + "22", color: catColor }}>{r.category}</span>
                                  </td>
                                  <td style={{ padding: "5px 10px", textAlign: "right", borderLeft: gridBorder, fontVariantNumeric: "tabular-nums", color: r.subA > 0 ? T.text : T.textFaint }}>{r.subA > 0 ? fmt(r.subA) : "—"}</td>
                                  <td style={{ padding: "5px 10px", textAlign: "right", borderLeft: gridBorder, fontVariantNumeric: "tabular-nums", color: r.subB > 0 ? T.text : T.textFaint }}>{r.subB > 0 ? fmt(r.subB) : "—"}</td>
                                  <td style={{ padding: "5px 10px", textAlign: "right", borderLeft: gridBorder, fontVariantNumeric: "tabular-nums", color: diffColor, fontWeight: 500 }}>
                                    {r.diff > 0 ? "+" : ""}{fmt(r.diff)}
                                  </td>
                                </tr>
                              );
                            })}
                            <tr style={{ borderTop: `2px solid ${T.border}`, backgroundColor: "#c3a78215", fontWeight: 600 }}>
                              <td style={{ padding: "6px 10px" }} colSpan={2}>合計</td>
                              <td style={{ padding: "6px 10px", textAlign: "right", borderLeft: gridBorder, fontVariantNumeric: "tabular-nums" }}>{fmt(totalA)}</td>
                              <td style={{ padding: "6px 10px", textAlign: "right", borderLeft: gridBorder, fontVariantNumeric: "tabular-nums" }}>{fmt(totalB)}</td>
                              <td style={{ padding: "6px 10px", textAlign: "right", borderLeft: gridBorder, fontVariantNumeric: "tabular-nums", color: (totalB - totalA) > 0 ? "#22c55e" : (totalB - totalA) < 0 ? "#c45555" : T.textFaint }}>{(totalB - totalA) > 0 ? "+" : ""}{fmt(totalB - totalA)}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
