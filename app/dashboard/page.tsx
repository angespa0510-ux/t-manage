"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";
import { useTheme } from "../../lib/theme";
import { NavMenu } from "../../lib/nav-menu";

type Customer = {
  id: number; created_at: string; name: string; phone: string; phone2: string; phone3: string;
  email: string; notes: string; user_id: string; rank: string;
};
type Visit = {
  id: number; customer_id: number; date: string; start_time: string; end_time: string;
  therapist_id: number; store_id: number; course_name: string; price: number;
  therapist_back: number; nomination: string; options: string; discount: number;
  total: number; payment_method: string; notes: string;
};
type Therapist = { id: number; name: string };
type Store = { id: number; name: string };
type Course = { id: number; name: string; duration: number; price: number; therapist_back: number };

const RANKS: Record<string, { label: string; color: string; bg: string; desc: string }> = {
  banned: { label: "出禁", color: "#c45555", bg: "#c4555518", desc: "一切当店の利用を禁止" },
  caution: { label: "要注意", color: "#f59e0b", bg: "#f59e0b18", desc: "予約を取る際は注意" },
  normal: { label: "普通", color: "#888780", bg: "#88878018", desc: "デフォルト" },
  good: { label: "善良", color: "#4a7c59", bg: "#4a7c5918", desc: "とても良いお客様" },
};

const menuItems = [
  { label: "HOME", icon: "home", sub: [] },
  { label: "顧客管理", icon: "users", sub: ["顧客一覧", "顧客登録"] },
  { label: "予約管理", icon: "calendar", sub: ["タイムチャート", "オーダー一覧", "SMS送信履歴一覧"] },
  { label: "勤怠管理", icon: "clock", sub: ["セラピスト勤怠", "スタッフ勤怠", "部屋割り管理"] },
  { label: "売上分析", icon: "chart", sub: ["年別分析", "月別分析", "日別分析"] },
  { label: "面接管理", icon: "clipboard", sub: ["面接管理"] },
  { label: "メッセージ", icon: "mail", sub: [] },
  { label: "設定", icon: "settings", sub: ["セラピスト登録", "スタッフ登録", "コース登録", "利用場所登録", "指名登録", "延長登録", "オプション登録", "割引登録", "営業時間設定"] },
];

function Icon({ name, size = 18 }: { name: string; size?: number }) {
  const p = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (name) {
    case "home": return <svg {...p}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>;
    case "users": return <svg {...p}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
    case "calendar": return <svg {...p}><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>;
    case "clock": return <svg {...p}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;
    case "chart": return <svg {...p}><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>;
    case "clipboard": return <svg {...p}><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>;
    case "mail": return <svg {...p}><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 7l-10 6L2 7"/></svg>;
    case "settings": return <svg {...p}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>;
    default: return null;
  }
}

export default function Dashboard() {
  const router = useRouter();
  const { dark, toggle, T } = useTheme();
  const [userId, setUserId] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [openMenus, setOpenMenus] = useState<string[]>(["HOME"]);
  const [activePage, setActivePage] = useState("HOME");
  useEffect(() => { const p = new URLSearchParams(window.location.search).get("page"); if (p) setActivePage(p); }, []);
  useEffect(() => { const h = (e: Event) => setActivePage((e as CustomEvent).detail); window.addEventListener("dashboardPage", h); return () => window.removeEventListener("dashboardPage", h); }, []);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [storesList, setStoresList] = useState<Store[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterRank, setFilterRank] = useState<string>("all");

  // Register
  const [custName, setCustName] = useState(""); const [custPhone, setCustPhone] = useState(""); const [custPhone2, setCustPhone2] = useState(""); const [custPhone3, setCustPhone3] = useState("");
  const [custEmail, setCustEmail] = useState(""); const [custNotes, setCustNotes] = useState(""); const [custRank, setCustRank] = useState("normal");
  const [saving, setSaving] = useState(false); const [saveMsg, setSaveMsg] = useState("");

  // Edit
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [editName, setEditName] = useState(""); const [editPhone, setEditPhone] = useState(""); const [editPhone2, setEditPhone2] = useState(""); const [editPhone3, setEditPhone3] = useState("");
  const [editEmail, setEditEmail] = useState(""); const [editNotes, setEditNotes] = useState(""); const [editRank, setEditRank] = useState("normal");
  const [editSaving, setEditSaving] = useState(false); const [editMsg, setEditMsg] = useState("");

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null); const [deleting, setDeleting] = useState(false);

  // Detail / History
  const [detailCustomer, setDetailCustomer] = useState<Customer | null>(null);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [showAddVisit, setShowAddVisit] = useState(false);
  const [vDate, setVDate] = useState(""); const [vStart, setVStart] = useState("12:00"); const [vEnd, setVEnd] = useState("13:00");
  const [vTherapistId, setVTherapistId] = useState(0); const [vStoreId, setVStoreId] = useState(0);
  const [vCourseId, setVCourseId] = useState(0); const [vNomination, setVNomination] = useState(""); const [vOptions, setVOptions] = useState("");
  const [vDiscount, setVDiscount] = useState("0"); const [vPayment, setVPayment] = useState(""); const [vNotes, setVNotes] = useState("");
  const [vSaving, setVSaving] = useState(false);

  const fetchCustomers = useCallback(async () => {
    const { data } = await supabase.from("customers").select("*").order("created_at", { ascending: false }); if (data) setCustomers(data);
  }, []);

  const fetchMaster = useCallback(async () => {
    const { data: t } = await supabase.from("therapists").select("*").order("id"); if (t) setTherapists(t);
    const { data: s } = await supabase.from("stores").select("*").order("id"); if (s) setStoresList(s);
    const { data: c } = await supabase.from("courses").select("*").order("duration"); if (c) setCourses(c);
  }, []);

  const fetchVisits = useCallback(async (custId: number) => {
    const { data } = await supabase.from("customer_visits").select("*").eq("customer_id", custId).order("date", { ascending: false }); if (data) setVisits(data);
  }, []);

  useEffect(() => {
    const checkUser = async () => { const { data: { user } } = await supabase.auth.getUser(); if (!user) { router.push("/"); } else { setUserEmail(user.email || ""); setUserId(user.id); } };
    checkUser(); fetchCustomers(); fetchMaster();
  }, [router, fetchCustomers, fetchMaster]);

  // Register
  const handleRegister = async () => {
    if (!custName.trim()) { setSaveMsg("名前を入力してください"); return; }
    setSaving(true); setSaveMsg("");
    const { error } = await supabase.from("customers").insert({ name: custName.trim(), phone: custPhone.trim(), phone2: custPhone2.trim(), phone3: custPhone3.trim(), email: custEmail.trim(), notes: custNotes.trim(), rank: custRank, user_id: userId });
    setSaving(false);
    if (error) { setSaveMsg("登録に失敗しました: " + error.message); }
    else { setSaveMsg("登録しました！"); setCustName(""); setCustPhone(""); setCustPhone2(""); setCustPhone3(""); setCustEmail(""); setCustNotes(""); setCustRank("normal"); fetchCustomers(); setTimeout(() => { setSaveMsg(""); setActivePage("顧客一覧"); }, 1000); }
  };

  // Edit
  const startEdit = (c: Customer) => { setEditingCustomer(c); setEditName(c.name || ""); setEditPhone(c.phone || ""); setEditPhone2(c.phone2 || ""); setEditPhone3(c.phone3 || ""); setEditEmail(c.email || ""); setEditNotes(c.notes || ""); setEditRank(c.rank || "normal"); setEditMsg(""); };
  const handleUpdate = async () => {
    if (!editingCustomer || !editName.trim()) { setEditMsg("名前を入力してください"); return; }
    setEditSaving(true); setEditMsg("");
    const { error } = await supabase.from("customers").update({ name: editName.trim(), phone: editPhone.trim(), phone2: editPhone2.trim(), phone3: editPhone3.trim(), email: editEmail.trim(), notes: editNotes.trim(), rank: editRank }).eq("id", editingCustomer.id);
    setEditSaving(false);
    if (error) { setEditMsg("更新に失敗しました: " + error.message); }
    else { setEditMsg("更新しました！"); fetchCustomers(); setTimeout(() => { setEditingCustomer(null); setEditMsg(""); }, 800); }
  };
  const handleDelete = async () => { if (!deleteTarget) return; setDeleting(true); await supabase.from("customers").delete().eq("id", deleteTarget.id); setDeleting(false); setDeleteTarget(null); fetchCustomers(); };

  // Detail
  const openDetail = (c: Customer) => { setDetailCustomer(c); fetchVisits(c.id); };

  // Add Visit
  const handleAddVisit = async () => {
    if (!detailCustomer || !vDate) return;
    setVSaving(true);
    const course = courses.find((c) => c.id === vCourseId);
    const price = course?.price || 0; const tb = course?.therapist_back || 0;
    const disc = parseInt(vDiscount) || 0; const total = price - disc;
    await supabase.from("customer_visits").insert({ customer_id: detailCustomer.id, date: vDate, start_time: vStart, end_time: vEnd, therapist_id: vTherapistId || null, store_id: vStoreId || null, course_name: course?.name || "", price, therapist_back: tb, nomination: vNomination, options: vOptions, discount: disc, total, payment_method: vPayment, notes: vNotes });
    setVSaving(false); setShowAddVisit(false);
    setVDate(""); setVStart("12:00"); setVEnd("13:00"); setVTherapistId(0); setVStoreId(0); setVCourseId(0); setVNomination(""); setVOptions(""); setVDiscount("0"); setVPayment(""); setVNotes("");
    fetchVisits(detailCustomer.id);
  };
  const deleteVisit = async (id: number) => { if (!detailCustomer) return; await supabase.from("customer_visits").delete().eq("id", id); fetchVisits(detailCustomer.id); };

  const handleLogout = async () => { await supabase.auth.signOut(); router.push("/"); };
  const toggleMenu = (label: string) => { setOpenMenus((prev) => prev.includes(label) ? prev.filter((m) => m !== label) : [...prev, label]); };
  const filteredCustomers = customers.filter((c) => { const q = searchQuery.toLowerCase(); const matchSearch = c.name?.toLowerCase().includes(q) || c.phone?.includes(q) || c.phone2?.includes(q) || c.phone3?.includes(q) || c.email?.toLowerCase().includes(q); const matchRank = filterRank === "all" || (c.rank || "normal") === filterRank; return matchSearch && matchRank; });

  const today = new Date(); const dateStr = `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日`; const dayNames = ["日", "月", "火", "水", "木", "金", "土"]; const dayStr = dayNames[today.getDay()];
  const hours = today.getHours(); const greeting = hours < 12 ? "おはようございます" : hours < 18 ? "こんにちは" : "お疲れ様です";
  const getTherapistName = (id: number) => therapists.find((t) => t.id === id)?.name || "—";
  const getStoreName = (id: number) => storesList.find((s) => s.id === id)?.name || "—";
  const fmt = (n: number) => "¥" + (n || 0).toLocaleString();

  const SB = { bg: "#1a1a2e", border: "rgba(255,255,255,0.04)", textActive: "#c3a782", textActiveBg: "rgba(195,167,130,0.08)", text: "rgba(255,255,255,0.40)", textFaint: "rgba(255,255,255,0.25)", textIcon: "rgba(255,255,255,0.25)" };
  const inputStyle = { backgroundColor: T.cardAlt, color: T.text, border: "1px solid transparent" };
  const TIMES = ["09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00","19:00","20:00","21:00","22:00","23:00","00:00","01:00","02:00","03:00"];

  const RankBadge = ({ rank }: { rank: string }) => { const r = RANKS[rank] || RANKS.normal; return <span className="px-2 py-0.5 rounded-md text-[10px] font-medium" style={{ backgroundColor: r.bg, color: r.color }}>{r.label}</span>; };
  const RankSelector = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <div className="flex gap-2 flex-wrap">{Object.entries(RANKS).map(([key, val]) => (
      <button key={key} onClick={() => onChange(key)} className={`px-3 py-1.5 rounded-xl text-[11px] cursor-pointer transition-all ${value === key ? "ring-2 ring-offset-1" : "opacity-50"}`}
        style={{ backgroundColor: val.bg, color: val.color }} title={val.desc}>{val.label}</button>
    ))}</div>
  );

  return (
    <div className="flex h-screen" style={{ backgroundColor: T.bg, color: T.text }}>
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? "w-[260px]" : "w-0 overflow-hidden"} flex flex-col transition-all duration-500 flex-shrink-0`} style={{ backgroundColor: SB.bg }}>
        <div className="h-[72px] flex items-center px-6" style={{ borderBottom: `1px solid ${SB.border}` }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-[10px] bg-gradient-to-br from-[#c3a782] to-[#a8895e] flex items-center justify-center shadow-[0_2px_8px_rgba(195,167,130,0.3)]"><span className="text-white text-[13px] font-semibold">C</span></div>
            <div><p className="text-[14px] font-medium text-white/90">チョップ</p><p className="text-[9px] text-white/25 tracking-[2px] uppercase">salon management</p></div>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto py-5 px-3">
          <p className="text-[9px] text-white/20 tracking-[2px] uppercase px-3 mb-3">メニュー</p>
          {menuItems.map((item) => (
            <div key={item.label} className="mb-0.5">
              <button onClick={() => { item.sub.length === 0 ? setActivePage(item.label) : toggleMenu(item.label); }}
                className="w-full flex items-center gap-3 px-3 py-[10px] text-[13px] rounded-lg transition-all cursor-pointer group"
                style={{ color: activePage === item.label || (item.sub.length > 0 && item.sub.includes(activePage)) ? SB.textActive : SB.text, backgroundColor: activePage === item.label || (item.sub.length > 0 && item.sub.includes(activePage)) ? SB.textActiveBg : "transparent" }}>
                <span style={{ color: activePage === item.label || (item.sub.length > 0 && item.sub.includes(activePage)) ? SB.textActive : SB.textIcon }}><Icon name={item.icon} size={17} /></span>
                <span className="flex-1 text-left">{item.label}</span>
                {item.sub.length > 0 && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`transition-transform duration-300 opacity-40 ${openMenus.includes(item.label) ? "rotate-180" : ""}`}><polyline points="6 9 12 15 18 9"/></svg>}
              </button>
              {item.sub.length > 0 && openMenus.includes(item.label) && (
                <div className="ml-[18px] pl-4 my-1" style={{ borderLeft: `1px solid ${SB.border}` }}>
                  {item.sub.map((sub) => (
                    <button key={sub} onClick={() => sub === "タイムチャート" ? router.push("/timechart") : sub === "利用場所登録" ? router.push("/rooms") : sub === "セラピスト勤怠" ? router.push("/shifts") : sub === "セラピスト登録" ? router.push("/therapists") : sub === "コース登録" ? router.push("/courses") : sub === "部屋割り管理" ? router.push("/room-assignments") : sub === "年別分析" || sub === "月別分析" || sub === "日別分析" ? router.push("/analytics") : sub === "指名登録" || sub === "延長登録" || sub === "オプション登録" || sub === "割引登録" ? router.push("/service-settings") : setActivePage(sub)}
                      className="w-full text-left px-3 py-[7px] text-[12px] rounded-md transition-all cursor-pointer"
                      style={{ color: activePage === sub ? SB.textActive : SB.textFaint, backgroundColor: activePage === sub ? "rgba(195,167,130,0.06)" : "transparent" }}>{sub}</button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>
        <div className="p-4 mx-3 mb-3" style={{ borderTop: `1px solid ${SB.border}` }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#c3a782]/30 to-[#c3a782]/10 flex items-center justify-center text-[#c3a782] text-[12px] font-medium">{userEmail.charAt(0).toUpperCase()}</div>
            <div className="flex-1 min-w-0"><p className="text-[11px] text-white/60 truncate">{userEmail}</p><p className="text-[9px] text-white/20">スタッフ</p></div>
            <button onClick={handleLogout} className="text-white/15 hover:text-white/40 cursor-pointer p-1"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg></button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-[72px] backdrop-blur-xl flex items-center justify-between px-8 flex-shrink-0 border-b" style={{ backgroundColor: dark ? T.card + "cc" : "rgba(255,255,255,0.8)", borderColor: T.border }}>
          <div className="flex items-center gap-5">
            <NavMenu T={T} dark={dark} />
            <div><h1 className="text-[16px] font-medium">{activePage}</h1><p className="text-[11px]" style={{ color: T.textMuted }}>{dateStr}（{dayStr}）</p></div>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={toggle} className="px-3 py-1.5 text-[11px] rounded-lg cursor-pointer border" style={{ borderColor: T.border, color: T.textSub }}>{dark ? "☀️ ライト" : "🌙 ダーク"}</button>
            <div className="w-px h-5" style={{ backgroundColor: T.border }} />
            <button onClick={handleLogout} className="text-[11px] cursor-pointer" style={{ color: T.textMuted }}>ログアウト</button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-8">
          {/* Loading */}
          {activePage === "" && null}
          {/* HOME */}
          {activePage === "HOME" && (
            <div className="animate-[fadeIn_0.4s]">
              <div className="mb-8"><h2 className="text-[22px] font-medium">{greeting}</h2><p className="text-[13px] mt-1" style={{ color: T.textMuted }}>{dateStr}（{dayStr}）の業務状況</p></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
                {[{ label: "本日の予約", value: "0", unit: "件", accent: "#c3a782" }, { label: "本日の売上", value: "¥0", unit: "", accent: "#7ab88f" }, { label: "出勤セラピスト", value: "0", unit: "名", accent: "#85a8c4" }, { label: "総顧客数", value: String(customers.length), unit: "名", accent: "#c49885" }].map((stat) => (
                  <div key={stat.label} className="rounded-2xl p-6 border cursor-default" style={{ backgroundColor: T.card, borderColor: T.border }}>
                    <div className="flex items-center justify-between mb-4"><span className="text-[11px]" style={{ color: T.textMuted }}>{stat.label}</span><div className="w-2 h-2 rounded-full" style={{ backgroundColor: stat.accent, opacity: 0.5 }} /></div>
                    <div className="flex items-baseline gap-1.5"><span className="text-[32px] font-light tracking-tight leading-none">{stat.value}</span><span className="text-[12px]" style={{ color: T.textFaint }}>{stat.unit}</span></div>
                  </div>
                ))}
              </div>
              <div className="mt-8"><p className="text-[11px] mb-4" style={{ color: T.textMuted }}>クイックアクション</p>
                <div className="flex flex-wrap gap-3">{["顧客登録", "タイムチャート", "日別分析", "セラピスト登録"].map((a) => (<button key={a} onClick={() => a === "タイムチャート" ? router.push("/timechart") : setActivePage(a)} className="px-5 py-2.5 border rounded-xl text-[12px] cursor-pointer" style={{ backgroundColor: T.card, borderColor: T.border, color: T.textSub }}>{a}</button>))}</div>
              </div>
            </div>
          )}

          {/* 顧客一覧 */}
          {activePage === "顧客一覧" && (
            <div className="animate-[fadeIn_0.4s]">
              <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: T.card, borderColor: T.border }}>
                <div className="px-6 py-5 flex items-center justify-between" style={{ borderBottom: `1px solid ${T.cardAlt}` }}>
                  <div><h2 className="text-[15px] font-medium">顧客一覧</h2><p className="text-[11px] mt-0.5" style={{ color: T.textFaint }}>{customers.length}件の顧客情報</p></div>
                  <button onClick={() => setActivePage("顧客登録")} className="px-5 py-2.5 bg-gradient-to-r from-[#c3a782] to-[#b09672] text-white text-[12px] rounded-xl cursor-pointer">+ 新規登録</button>
                </div>
                <div className="px-6 py-4" style={{ borderBottom: `1px solid ${T.cardAlt}` }}>
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="relative max-w-sm flex-1">
                      <input type="text" placeholder="名前・電話番号で検索" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} />
                      <svg className="absolute left-3.5 top-1/2 -translate-y-1/2" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.textFaint} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => setFilterRank("all")} className="px-2.5 py-1.5 rounded-lg text-[10px] cursor-pointer border" style={{ borderColor: filterRank === "all" ? T.accent : T.border, backgroundColor: filterRank === "all" ? T.accent + "18" : "transparent", color: filterRank === "all" ? T.accent : T.textMuted, fontWeight: filterRank === "all" ? 600 : 400 }}>全て</button>
                      {Object.entries(RANKS).map(([key, val]) => (<button key={key} onClick={() => setFilterRank(filterRank === key ? "all" : key)} className="px-2.5 py-1.5 rounded-lg text-[10px] cursor-pointer border" style={{ borderColor: filterRank === key ? val.color : T.border, backgroundColor: filterRank === key ? val.bg : "transparent", color: filterRank === key ? val.color : T.textMuted, fontWeight: filterRank === key ? 600 : 400 }}>{val.label} {filterRank === "all" ? customers.filter((c) => (c.rank || "normal") === key).length : ""}</button>))}
                    </div>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-[12px]">
                    <thead><tr style={{ borderBottom: `1px solid ${T.cardAlt}` }}>
                      {["ランク", "名前", "電話番号", "備考", "登録日", "操作"].map((h) => (<th key={h} className="text-left py-3.5 px-4 font-normal text-[11px]" style={{ color: T.textMuted }}>{h}</th>))}
                    </tr></thead>
                    <tbody>
                      {filteredCustomers.length === 0 ? (
                        <tr><td colSpan={6} className="text-center py-16 text-[12px]" style={{ color: T.textFaint }}>{customers.length === 0 ? "顧客データがありません" : "検索結果がありません"}</td></tr>
                      ) : filteredCustomers.map((c) => {
                        const phones = [c.phone, c.phone2, c.phone3].filter(Boolean);
                        return (
                          <tr key={c.id} className="transition-colors cursor-pointer" style={{ borderBottom: `1px solid ${T.cardAlt}` }} onClick={() => openDetail(c)}>
                            <td className="py-3 px-4"><RankBadge rank={c.rank || "normal"} /></td>
                            <td className="py-3 px-4"><div className="flex items-center gap-3"><div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-medium flex-shrink-0" style={{ backgroundColor: T.cardAlt, color: T.textSub }}>{c.name?.charAt(0)}</div><span className="font-medium">{c.name}</span></div></td>
                            <td className="py-3 px-4" style={{ color: T.textSub }}>
                              {phones.length === 0 ? "—" : phones.map((p, i) => (<span key={i} className="block text-[11px]">{p}</span>))}
                            </td>
                            <td className="py-3 px-4 max-w-[200px] truncate" style={{ color: T.textMuted }}>{c.notes || "—"}</td>
                            <td className="py-3 px-4" style={{ color: T.textMuted }}>{new Date(c.created_at).toLocaleDateString("ja-JP")}</td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                <button onClick={() => openDetail(c)} className="px-3 py-1.5 text-[11px] rounded-lg cursor-pointer" style={{ color: "#c3a782", backgroundColor: "#c3a78218" }}>オーダー</button>
                                <button onClick={() => startEdit(c)} className="px-3 py-1.5 text-[11px] rounded-lg cursor-pointer" style={{ color: "#3d6b9f", backgroundColor: "#3d6b9f18" }}>編集</button>
                                <button onClick={() => setDeleteTarget(c)} className="px-3 py-1.5 text-[11px] rounded-lg cursor-pointer" style={{ color: "#c45555", backgroundColor: "#c4555518" }}>削除</button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* 顧客登録 */}
          {activePage === "顧客登録" && (
            <div className="animate-[fadeIn_0.4s] max-w-xl">
              <div className="rounded-2xl border p-8" style={{ backgroundColor: T.card, borderColor: T.border }}>
                <div className="mb-8"><h2 className="text-[16px] font-medium">顧客登録</h2><p className="text-[11px] mt-1" style={{ color: T.textFaint }}>新しい顧客情報を登録します</p></div>
                <div className="space-y-5">
                  <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>名前 <span style={{ color: "#c49885" }}>*</span></label><input type="text" placeholder="山田 太郎" value={custName} onChange={(e) => setCustName(e.target.value)} className="w-full px-4 py-3 rounded-xl text-[13px] outline-none" style={inputStyle} /></div>
                  <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>電話番号①</label><input type="tel" placeholder="090-1234-5678" value={custPhone} onChange={(e) => setCustPhone(e.target.value)} className="w-full px-4 py-3 rounded-xl text-[13px] outline-none" style={inputStyle} /></div>
                  <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>電話番号②</label><input type="tel" placeholder="2つ目の電話番号（任意）" value={custPhone2} onChange={(e) => setCustPhone2(e.target.value)} className="w-full px-4 py-3 rounded-xl text-[13px] outline-none" style={inputStyle} /></div>
                  <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>電話番号③</label><input type="tel" placeholder="3つ目の電話番号（任意）" value={custPhone3} onChange={(e) => setCustPhone3(e.target.value)} className="w-full px-4 py-3 rounded-xl text-[13px] outline-none" style={inputStyle} /></div>
                  <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>メールアドレス</label><input type="email" placeholder="example@email.com" value={custEmail} onChange={(e) => setCustEmail(e.target.value)} className="w-full px-4 py-3 rounded-xl text-[13px] outline-none" style={inputStyle} /></div>
                  <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>お客様ランク</label><RankSelector value={custRank} onChange={setCustRank} /></div>
                  <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>備考</label><textarea placeholder="メモ・備考を入力" rows={3} value={custNotes} onChange={(e) => setCustNotes(e.target.value)} className="w-full px-4 py-3 rounded-xl text-[13px] outline-none resize-none" style={inputStyle} /></div>
                  {saveMsg && <div className="px-4 py-3 rounded-xl text-[12px]" style={{ backgroundColor: saveMsg.includes("失敗") || saveMsg.includes("入力") ? "#c4988518" : "#7ab88f18", color: saveMsg.includes("失敗") || saveMsg.includes("入力") ? "#c49885" : "#5a9e6f" }}>{saveMsg}</div>}
                  <div className="flex gap-3 pt-3">
                    <button onClick={handleRegister} disabled={saving} className="px-7 py-3 bg-gradient-to-r from-[#c3a782] to-[#b09672] text-white text-[12px] rounded-xl cursor-pointer disabled:opacity-60">{saving ? "登録中..." : "登録する"}</button>
                    <button onClick={() => { setActivePage("顧客一覧"); setSaveMsg(""); }} className="px-7 py-3 border text-[12px] rounded-xl cursor-pointer" style={{ borderColor: T.border, color: T.textSub }}>キャンセル</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Other pages */}
          {activePage !== "HOME" && activePage !== "顧客一覧" && activePage !== "顧客登録" && (
            <div className="animate-[fadeIn_0.4s]">
              <div className="rounded-2xl border p-8" style={{ backgroundColor: T.card, borderColor: T.border }}>
                <div className="flex flex-col items-center justify-center py-20">
                  <div className="w-[72px] h-[72px] rounded-2xl flex items-center justify-center mb-5" style={{ backgroundColor: T.cardAlt }}><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={T.textFaint} strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg></div>
                  <h3 className="text-[15px] mb-1.5" style={{ color: T.textSub }}>{activePage}</h3>
                  <p className="text-[12px]" style={{ color: T.textFaint }}>この機能は次のステップで実装します</p>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Edit Modal */}
      {editingCustomer && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setEditingCustomer(null)}>
          <div className="rounded-2xl border p-8 w-full max-w-lg max-h-[90vh] overflow-y-auto animate-[fadeIn_0.25s]" style={{ backgroundColor: T.card, borderColor: T.border }} onClick={(e) => e.stopPropagation()}>
            <div className="mb-6"><h2 className="text-[16px] font-medium">顧客情報を編集</h2></div>
            <div className="space-y-4">
              <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>名前 <span style={{ color: "#c49885" }}>*</span></label><input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full px-4 py-3 rounded-xl text-[13px] outline-none" style={inputStyle} /></div>
              <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>電話番号①</label><input type="tel" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} className="w-full px-4 py-3 rounded-xl text-[13px] outline-none" style={inputStyle} /></div>
              <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>電話番号②</label><input type="tel" value={editPhone2} onChange={(e) => setEditPhone2(e.target.value)} className="w-full px-4 py-3 rounded-xl text-[13px] outline-none" style={inputStyle} /></div>
              <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>電話番号③</label><input type="tel" value={editPhone3} onChange={(e) => setEditPhone3(e.target.value)} className="w-full px-4 py-3 rounded-xl text-[13px] outline-none" style={inputStyle} /></div>
              <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>メールアドレス</label><input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} className="w-full px-4 py-3 rounded-xl text-[13px] outline-none" style={inputStyle} /></div>
              <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>お客様ランク</label><RankSelector value={editRank} onChange={setEditRank} /></div>
              <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>備考</label><textarea rows={3} value={editNotes} onChange={(e) => setEditNotes(e.target.value)} className="w-full px-4 py-3 rounded-xl text-[13px] outline-none resize-none" style={inputStyle} /></div>
              {editMsg && <div className="px-4 py-3 rounded-xl text-[12px]" style={{ backgroundColor: editMsg.includes("失敗") || editMsg.includes("入力") ? "#c4988518" : "#7ab88f18", color: editMsg.includes("失敗") || editMsg.includes("入力") ? "#c49885" : "#5a9e6f" }}>{editMsg}</div>}
              <div className="flex gap-3 pt-2">
                <button onClick={handleUpdate} disabled={editSaving} className="px-7 py-3 bg-gradient-to-r from-[#c3a782] to-[#b09672] text-white text-[12px] rounded-xl cursor-pointer disabled:opacity-60">{editSaving ? "更新中..." : "更新する"}</button>
                <button onClick={() => setEditingCustomer(null)} className="px-7 py-3 border text-[12px] rounded-xl cursor-pointer" style={{ borderColor: T.border, color: T.textSub }}>キャンセル</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setDeleteTarget(null)}>
          <div className="rounded-2xl border p-8 w-full max-w-sm text-center animate-[fadeIn_0.25s]" style={{ backgroundColor: T.card, borderColor: T.border }} onClick={(e) => e.stopPropagation()}>
            <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-5" style={{ backgroundColor: "#c4555518" }}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#c45555" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></div>
            <h3 className="text-[15px] font-medium mb-2">顧客を削除しますか？</h3>
            <p className="text-[12px] mb-6" style={{ color: T.textMuted }}>「{deleteTarget.name}」を削除すると元に戻せません</p>
            <div className="flex gap-3 justify-center">
              <button onClick={handleDelete} disabled={deleting} className="px-6 py-2.5 bg-[#c45555] text-white text-[12px] rounded-xl cursor-pointer disabled:opacity-60">{deleting ? "削除中..." : "削除する"}</button>
              <button onClick={() => setDeleteTarget(null)} className="px-6 py-2.5 border text-[12px] rounded-xl cursor-pointer" style={{ borderColor: T.border, color: T.textSub }}>キャンセル</button>
            </div>
          </div>
        </div>
      )}

      {/* Detail + History Modal */}
      {detailCustomer && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setDetailCustomer(null)}>
          <div className="rounded-2xl border w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-[fadeIn_0.25s]" style={{ backgroundColor: T.card, borderColor: T.border }} onClick={(e) => e.stopPropagation()}>
            {/* Customer Info */}
            <div className="px-6 py-5" style={{ borderBottom: `1px solid ${T.border}` }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full flex items-center justify-center text-[18px] font-medium" style={{ backgroundColor: T.cardAlt, color: T.textSub }}>{detailCustomer.name?.charAt(0)}</div>
                  <div>
                    <div className="flex items-center gap-2"><h2 className="text-[18px] font-medium">{detailCustomer.name}</h2><RankBadge rank={detailCustomer.rank || "normal"} /></div>
                    <div className="flex flex-wrap gap-3 mt-1 text-[12px]" style={{ color: T.textSub }}>
                      {detailCustomer.phone && <span>📱 {detailCustomer.phone}</span>}
                      {detailCustomer.phone2 && <span>📱 {detailCustomer.phone2}</span>}
                      {detailCustomer.phone3 && <span>📱 {detailCustomer.phone3}</span>}
                      {detailCustomer.email && <span>✉ {detailCustomer.email}</span>}
                    </div>
                    {detailCustomer.notes && <p className="text-[11px] mt-1" style={{ color: T.textMuted }}>📝 {detailCustomer.notes}</p>}
                  </div>
                </div>
                <button onClick={() => setDetailCustomer(null)} className="text-[14px] cursor-pointer p-2" style={{ color: T.textSub }}>✕</button>
              </div>
            </div>

            {/* Visit History */}
            <div className="px-6 py-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[14px] font-medium">利用履歴（{visits.length}件）</h3>
                <button onClick={() => { setShowAddVisit(true); setVDate(new Date().toISOString().split("T")[0]); }} className="px-3 py-1.5 bg-gradient-to-r from-[#c3a782] to-[#b09672] text-white text-[10px] rounded-lg cursor-pointer">+ オーダー登録</button>
              </div>

              {visits.length === 0 ? (
                <p className="text-[12px] text-center py-8" style={{ color: T.textFaint }}>利用履歴がありません</p>
              ) : (
                <div className="space-y-2">
                  {visits.map((v) => (
                    <div key={v.id} className="rounded-xl p-4 border" style={{ borderColor: T.border, backgroundColor: T.cardAlt }}>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-1.5">
                            <span className="text-[13px] font-medium" style={{ color: T.accent }}>{v.date}</span>
                            {v.start_time && <span className="text-[11px]" style={{ color: T.textSub }}>{v.start_time}〜{v.end_time}</span>}
                          </div>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px]" style={{ color: T.textSub }}>
                            {v.therapist_id > 0 && <span>💆 {getTherapistName(v.therapist_id)}</span>}
                            {v.store_id > 0 && <span>🏠 {getStoreName(v.store_id)}</span>}
                            {v.course_name && <span>📋 {v.course_name}</span>}
                            {v.nomination && <span>⭐ {v.nomination}</span>}
                          </div>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-[11px]">
                            {v.price > 0 && <span style={{ color: T.text }}>料金: {fmt(v.price)}</span>}
                            {v.discount > 0 && <span style={{ color: "#c45555" }}>割引: -{fmt(v.discount)}</span>}
                            {v.total > 0 && <span className="font-medium" style={{ color: T.accent }}>合計: {fmt(v.total)}</span>}
                            {v.payment_method && <span style={{ color: T.textMuted }}>💳 {v.payment_method}</span>}
                          </div>
                          {v.options && <p className="text-[10px] mt-1" style={{ color: T.textMuted }}>オプション: {v.options}</p>}
                          {v.notes && <p className="text-[10px] mt-1" style={{ color: T.textMuted }}>📝 {v.notes}</p>}
                        </div>
                        <button onClick={() => deleteVisit(v.id)} className="text-[10px] px-2 py-1 rounded cursor-pointer" style={{ color: "#c45555", backgroundColor: "#c4555512" }}>削除</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add Visit Modal */}
      {showAddVisit && detailCustomer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4" onClick={() => setShowAddVisit(false)}>
          <div className="rounded-2xl border p-6 w-full max-w-md max-h-[85vh] overflow-y-auto animate-[fadeIn_0.25s]" style={{ backgroundColor: T.card, borderColor: T.border }} onClick={(e) => e.stopPropagation()}>
            <h2 className="text-[15px] font-medium mb-4">オーダー登録</h2>
            <div className="space-y-3">
              <div><label className="block text-[10px] mb-1" style={{ color: T.textSub }}>日付 *</label><input type="date" value={vDate} onChange={(e) => setVDate(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="block text-[10px] mb-1" style={{ color: T.textSub }}>開始時間</label><select value={vStart} onChange={(e) => setVStart(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none cursor-pointer" style={inputStyle}>{TIMES.map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
                <div><label className="block text-[10px] mb-1" style={{ color: T.textSub }}>終了時間</label><select value={vEnd} onChange={(e) => setVEnd(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none cursor-pointer" style={inputStyle}>{TIMES.map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
              </div>
              <div><label className="block text-[10px] mb-1" style={{ color: T.textSub }}>セラピスト</label><select value={vTherapistId} onChange={(e) => setVTherapistId(Number(e.target.value))} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none cursor-pointer" style={inputStyle}><option value={0}>選択なし</option>{therapists.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
              <div><label className="block text-[10px] mb-1" style={{ color: T.textSub }}>ルーム</label><select value={vStoreId} onChange={(e) => setVStoreId(Number(e.target.value))} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none cursor-pointer" style={inputStyle}><option value={0}>選択なし</option>{storesList.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
              <div><label className="block text-[10px] mb-1" style={{ color: T.textSub }}>コース</label><select value={vCourseId} onChange={(e) => setVCourseId(Number(e.target.value))} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none cursor-pointer" style={inputStyle}><option value={0}>選択なし</option>{courses.map((c) => <option key={c.id} value={c.id}>{c.name}（{fmt(c.price)}）</option>)}</select></div>
              <div><label className="block text-[10px] mb-1" style={{ color: T.textSub }}>指名種別</label><input type="text" value={vNomination} onChange={(e) => setVNomination(e.target.value)} placeholder="本指名/写真指名/フリー" className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} /></div>
              <div><label className="block text-[10px] mb-1" style={{ color: T.textSub }}>オプション</label><input type="text" value={vOptions} onChange={(e) => setVOptions(e.target.value)} placeholder="オプション内容" className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} /></div>
              <div><label className="block text-[10px] mb-1" style={{ color: T.textSub }}>割引額</label><input type="text" inputMode="numeric" value={vDiscount} onChange={(e) => setVDiscount(e.target.value.replace(/[^0-9]/g, ""))} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} /></div>
              <div><label className="block text-[10px] mb-1" style={{ color: T.textSub }}>支払方法</label><input type="text" value={vPayment} onChange={(e) => setVPayment(e.target.value)} placeholder="現金/カード" className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} /></div>
              <div><label className="block text-[10px] mb-1" style={{ color: T.textSub }}>メモ</label><input type="text" value={vNotes} onChange={(e) => setVNotes(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} /></div>
              <div className="flex gap-3 pt-2">
                <button onClick={handleAddVisit} disabled={vSaving} className="px-6 py-2.5 bg-gradient-to-r from-[#c3a782] to-[#b09672] text-white text-[11px] rounded-xl cursor-pointer disabled:opacity-60">{vSaving ? "登録中..." : "登録する"}</button>
                <button onClick={() => setShowAddVisit(false)} className="px-6 py-2.5 border text-[11px] rounded-xl cursor-pointer" style={{ borderColor: T.border, color: T.textSub }}>キャンセル</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  );
}
