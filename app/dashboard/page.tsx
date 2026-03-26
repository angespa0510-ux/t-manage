"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";

type Customer = {
  id: number;
  created_at: string;
  name: string;
  phone: string;
  email: string;
  notes: string;
  user_id: string;
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
  const [userId, setUserId] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [openMenus, setOpenMenus] = useState<string[]>(["HOME"]);
  const [activePage, setActivePage] = useState("HOME");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [custName, setCustName] = useState("");
  const [custPhone, setCustPhone] = useState("");
  const [custEmail, setCustEmail] = useState("");
  const [custNotes, setCustNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Edit state
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editMsg, setEditMsg] = useState("");

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchCustomers = useCallback(async () => {
    const { data } = await supabase
      .from("customers")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setCustomers(data);
  }, []);

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/"); } else { setUserEmail(user.email || ""); setUserId(user.id); }
    };
    checkUser();
    fetchCustomers();
  }, [router, fetchCustomers]);

  // Register
  const handleRegister = async () => {
    if (!custName.trim()) { setSaveMsg("名前を入力してください"); return; }
    setSaving(true);
    setSaveMsg("");
    const { error } = await supabase.from("customers").insert({
      name: custName.trim(), phone: custPhone.trim(), email: custEmail.trim(), notes: custNotes.trim(), user_id: userId,
    });
    setSaving(false);
    if (error) { setSaveMsg("登録に失敗しました: " + error.message); }
    else {
      setSaveMsg("登録しました！");
      setCustName(""); setCustPhone(""); setCustEmail(""); setCustNotes("");
      fetchCustomers();
      setTimeout(() => { setSaveMsg(""); setActivePage("顧客一覧"); }, 1000);
    }
  };

  // Edit
  const startEdit = (c: Customer) => {
    setEditingCustomer(c);
    setEditName(c.name || "");
    setEditPhone(c.phone || "");
    setEditEmail(c.email || "");
    setEditNotes(c.notes || "");
    setEditMsg("");
  };
  const handleUpdate = async () => {
    if (!editingCustomer || !editName.trim()) { setEditMsg("名前を入力してください"); return; }
    setEditSaving(true);
    setEditMsg("");
    const { error } = await supabase.from("customers").update({
      name: editName.trim(), phone: editPhone.trim(), email: editEmail.trim(), notes: editNotes.trim(),
    }).eq("id", editingCustomer.id);
    setEditSaving(false);
    if (error) { setEditMsg("更新に失敗しました: " + error.message); }
    else {
      setEditMsg("更新しました！");
      fetchCustomers();
      setTimeout(() => { setEditingCustomer(null); setEditMsg(""); }, 800);
    }
  };

  // Delete
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    await supabase.from("customers").delete().eq("id", deleteTarget.id);
    setDeleting(false);
    setDeleteTarget(null);
    fetchCustomers();
  };

  const handleLogout = async () => { await supabase.auth.signOut(); router.push("/"); };
  const toggleMenu = (label: string) => {
    setOpenMenus((prev) => prev.includes(label) ? prev.filter((m) => m !== label) : [...prev, label]);
  };
  const filteredCustomers = customers.filter((c) => {
    const q = searchQuery.toLowerCase();
    return c.name?.toLowerCase().includes(q) || c.phone?.includes(q) || c.email?.toLowerCase().includes(q);
  });

  const today = new Date();
  const dateStr = `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日`;
  const dayNames = ["日", "月", "火", "水", "木", "金", "土"];
  const dayStr = dayNames[today.getDay()];
  const hours = today.getHours();
  const greeting = hours < 12 ? "おはようございます" : hours < 18 ? "こんにちは" : "お疲れ様です";

  return (
    <div className="flex h-screen bg-[#f8f6f3]">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? "w-[260px]" : "w-0 overflow-hidden"} bg-[#1a1a2e] flex flex-col transition-all duration-500 ease-in-out flex-shrink-0`}>
        <div className="h-[72px] flex items-center px-6 border-b border-white/[0.04]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-[10px] bg-gradient-to-br from-[#c3a782] to-[#a8895e] flex items-center justify-center shadow-[0_2px_8px_rgba(195,167,130,0.3)]">
              <span className="text-white text-[13px] font-semibold tracking-wider">C</span>
            </div>
            <div>
              <p className="text-[14px] font-medium text-white/90 tracking-wide">チョップ</p>
              <p className="text-[9px] text-white/25 tracking-[2px] uppercase">salon management</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto py-5 px-3">
          <p className="text-[9px] text-white/20 tracking-[2px] uppercase px-3 mb-3">メニュー</p>
          {menuItems.map((item) => (
            <div key={item.label} className="mb-0.5">
              <button onClick={() => { item.sub.length === 0 ? setActivePage(item.label) : toggleMenu(item.label); }}
                className={`w-full flex items-center gap-3 px-3 py-[10px] text-[13px] rounded-lg transition-all duration-200 cursor-pointer group ${
                  activePage === item.label || (item.sub.length > 0 && item.sub.includes(activePage))
                    ? "text-[#c3a782] bg-[#c3a782]/[0.08]" : "text-white/40 hover:text-white/70 hover:bg-white/[0.03]"
                }`}>
                <span className={`transition-colors duration-200 ${activePage === item.label || (item.sub.length > 0 && item.sub.includes(activePage)) ? "text-[#c3a782]" : "text-white/25 group-hover:text-white/50"}`}><Icon name={item.icon} size={17} /></span>
                <span className="flex-1 text-left">{item.label}</span>
                {item.sub.length > 0 && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`transition-transform duration-300 opacity-40 ${openMenus.includes(item.label) ? "rotate-180" : ""}`}><polyline points="6 9 12 15 18 9"/></svg>
                )}
              </button>
              {item.sub.length > 0 && openMenus.includes(item.label) && (
                <div className="ml-[18px] pl-4 border-l border-white/[0.04] my-1">
                  {item.sub.map((sub) => (
                    <button key={sub} onClick={() => sub === "タイムチャート" ? router.push("/timechart") : sub === "利用場所登録" ? router.push("/rooms") : sub === "セラピスト勤怠" ? router.push("/shifts") : sub === "セラピスト登録" ? router.push("/therapists") : sub === "コース登録" ? router.push("/courses") : sub === "利用場所登録" ? router.push("/rooms") : sub === "部屋割り管理" ? router.push("/room-assignments") : setActivePage(sub)} className={`w-full text-left px-3 py-[7px] text-[12px] rounded-md transition-all duration-200 cursor-pointer ${activePage === sub ? "text-[#c3a782] bg-[#c3a782]/[0.06]" : "text-white/25 hover:text-white/50 hover:bg-white/[0.02]"}`}>{sub}</button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>
        <div className="border-t border-white/[0.04] p-4 mx-3 mb-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#c3a782]/30 to-[#c3a782]/10 flex items-center justify-center text-[#c3a782] text-[12px] font-medium ring-1 ring-[#c3a782]/10">{userEmail.charAt(0).toUpperCase()}</div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-white/60 truncate">{userEmail}</p>
              <p className="text-[9px] text-white/20 tracking-[1px]">スタッフ</p>
            </div>
            <button onClick={handleLogout} className="text-white/15 hover:text-white/40 transition-colors cursor-pointer p-1" title="ログアウト">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-[72px] bg-white/80 backdrop-blur-xl border-b border-[#e8e4df] flex items-center justify-between px-8 flex-shrink-0">
          <div className="flex items-center gap-5">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 rounded-lg hover:bg-[#f8f6f3] transition-colors cursor-pointer">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9c9a92" strokeWidth="1.5" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/><line x1="3" y1="18" x2="18" y2="18"/></svg>
            </button>
            <div>
              <h1 className="text-[16px] font-medium text-[#2c2c2a] tracking-tight">{activePage}</h1>
              <p className="text-[11px] text-[#b4b2a9]">{dateStr}（{dayStr}）</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-px h-5 bg-[#e8e4df]" />
            <button onClick={handleLogout} className="text-[11px] text-[#b4b2a9] hover:text-[#888780] transition-colors cursor-pointer tracking-wide">ログアウト</button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-8">
          {/* HOME */}
          {activePage === "HOME" && (
            <div className="animate-[fadeIn_0.4s_ease-out]">
              <div className="mb-8">
                <h2 className="text-[22px] font-medium text-[#2c2c2a] tracking-tight">{greeting}</h2>
                <p className="text-[13px] text-[#b4b2a9] mt-1">{dateStr}（{dayStr}）の業務状況</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
                {[
                  { label: "本日の予約", value: "0", unit: "件", accent: "#c3a782" },
                  { label: "本日の売上", value: "¥0", unit: "", accent: "#7ab88f" },
                  { label: "出勤セラピスト", value: "0", unit: "名", accent: "#85a8c4" },
                  { label: "総顧客数", value: String(customers.length), unit: "名", accent: "#c49885" },
                ].map((stat) => (
                  <div key={stat.label} className="bg-white rounded-2xl p-6 border border-[#f0ece4] hover:border-[#e0dbd2] transition-all duration-300 hover:shadow-[0_4px_20px_rgba(0,0,0,0.03)] cursor-default">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-[11px] text-[#b4b2a9] tracking-wide">{stat.label}</span>
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: stat.accent, opacity: 0.5 }} />
                    </div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-[32px] font-light text-[#2c2c2a] tracking-tight leading-none">{stat.value}</span>
                      <span className="text-[12px] text-[#d3d1c7]">{stat.unit}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-2xl border border-[#f0ece4] overflow-hidden">
                  <div className="px-6 py-5 border-b border-[#f8f6f3] flex items-center justify-between">
                    <h3 className="text-[13px] font-medium text-[#2c2c2a]">本日の予約一覧</h3>
                    <button onClick={() => router.push("/timechart")} className="text-[11px] text-[#c3a782] hover:text-[#b09672] transition-colors cursor-pointer">すべて見る →</button>
                  </div>
                  <div className="flex flex-col items-center justify-center h-[180px]">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#e0dbd2" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    <p className="text-[12px] text-[#d3d1c7] mt-3">予約データがありません</p>
                  </div>
                </div>
                <div className="bg-white rounded-2xl border border-[#f0ece4] overflow-hidden">
                  <div className="px-6 py-5 border-b border-[#f8f6f3] flex items-center justify-between">
                    <h3 className="text-[13px] font-medium text-[#2c2c2a]">最近の顧客登録</h3>
                    <button onClick={() => setActivePage("顧客一覧")} className="text-[11px] text-[#c3a782] hover:text-[#b09672] transition-colors cursor-pointer">すべて見る →</button>
                  </div>
                  {customers.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-[180px]">
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#e0dbd2" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                      <p className="text-[12px] text-[#d3d1c7] mt-3">顧客データがありません</p>
                    </div>
                  ) : (
                    <div className="p-4">
                      {customers.slice(0, 5).map((c) => (
                        <div key={c.id} className="flex items-center gap-3 py-2.5 px-2 rounded-lg hover:bg-[#f8f6f3] transition-colors">
                          <div className="w-8 h-8 rounded-full bg-[#f0ece4] flex items-center justify-center text-[11px] text-[#888780] font-medium">{c.name?.charAt(0)}</div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[12px] text-[#2c2c2a] truncate">{c.name}</p>
                            <p className="text-[10px] text-[#d3d1c7]">{c.phone || "電話番号なし"}</p>
                          </div>
                          <p className="text-[10px] text-[#d3d1c7]">{new Date(c.created_at).toLocaleDateString("ja-JP")}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="mt-8">
                <p className="text-[11px] text-[#b4b2a9] tracking-wide mb-4">クイックアクション</p>
                <div className="flex flex-wrap gap-3">
                  {["顧客登録", "タイムチャート", "日別分析", "セラピスト登録"].map((action) => (
                    <button key={action} onClick={() => setActivePage(action)} className="px-5 py-2.5 bg-white border border-[#f0ece4] rounded-xl text-[12px] text-[#888780] hover:border-[#c3a782]/30 hover:text-[#c3a782] hover:shadow-[0_2px_12px_rgba(195,167,130,0.08)] transition-all duration-300 cursor-pointer">{action}</button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 顧客一覧 */}
          {activePage === "顧客一覧" && (
            <div className="animate-[fadeIn_0.4s_ease-out]">
              <div className="bg-white rounded-2xl border border-[#f0ece4] overflow-hidden">
                <div className="px-6 py-5 border-b border-[#f8f6f3] flex items-center justify-between">
                  <div>
                    <h2 className="text-[15px] font-medium text-[#2c2c2a]">顧客一覧</h2>
                    <p className="text-[11px] text-[#d3d1c7] mt-0.5">{customers.length}件の顧客情報</p>
                  </div>
                  <button onClick={() => setActivePage("顧客登録")} className="px-5 py-2.5 bg-gradient-to-r from-[#c3a782] to-[#b09672] text-white text-[12px] rounded-xl hover:shadow-[0_4px_16px_rgba(195,167,130,0.25)] transition-all duration-300 cursor-pointer tracking-wide">+ 新規登録</button>
                </div>
                <div className="px-6 py-4 border-b border-[#f8f6f3]">
                  <div className="relative max-w-sm">
                    <input type="text" placeholder="名前・電話番号で検索" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-[#f8f6f3] border border-transparent rounded-xl text-[12px] outline-none focus:border-[#c3a782]/30 focus:bg-white transition-all placeholder-[#d3d1c7]" />
                    <svg className="absolute left-3.5 top-1/2 -translate-y-1/2" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d3d1c7" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-[12px]">
                    <thead>
                      <tr className="border-b border-[#f8f6f3]">
                        {["名前", "電話番号", "メール", "備考", "登録日", "操作"].map((h) => (
                          <th key={h} className="text-left py-3.5 px-6 text-[#b4b2a9] font-normal tracking-wide text-[11px]">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCustomers.length === 0 ? (
                        <tr><td colSpan={6} className="text-center py-16 text-[#d3d1c7] text-[12px]">
                          {customers.length === 0 ? "顧客データがありません。「新規登録」から追加してください。" : "検索結果がありません"}
                        </td></tr>
                      ) : (
                        filteredCustomers.map((c) => (
                          <tr key={c.id} className="border-b border-[#f8f6f3] hover:bg-[#faf9f7] transition-colors">
                            <td className="py-3.5 px-6">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-[#f0ece4] flex items-center justify-center text-[11px] text-[#888780] font-medium flex-shrink-0">{c.name?.charAt(0)}</div>
                                <span className="text-[#2c2c2a] font-medium">{c.name}</span>
                              </div>
                            </td>
                            <td className="py-3.5 px-6 text-[#888780]">{c.phone || "—"}</td>
                            <td className="py-3.5 px-6 text-[#888780]">{c.email || "—"}</td>
                            <td className="py-3.5 px-6 text-[#b4b2a9] max-w-[200px] truncate">{c.notes || "—"}</td>
                            <td className="py-3.5 px-6 text-[#b4b2a9]">{new Date(c.created_at).toLocaleDateString("ja-JP")}</td>
                            <td className="py-3.5 px-6">
                              <div className="flex items-center gap-2">
                                <button onClick={() => startEdit(c)} className="px-3 py-1.5 text-[11px] text-[#3d6b9f] bg-[#e4eef7] rounded-lg hover:bg-[#d4e4f4] transition-colors cursor-pointer">編集</button>
                                <button onClick={() => setDeleteTarget(c)} className="px-3 py-1.5 text-[11px] text-[#c45555] bg-[#fce8e8] rounded-lg hover:bg-[#f8d4d4] transition-colors cursor-pointer">削除</button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* 顧客登録 */}
          {activePage === "顧客登録" && (
            <div className="animate-[fadeIn_0.4s_ease-out] max-w-xl">
              <div className="bg-white rounded-2xl border border-[#f0ece4] p-8">
                <div className="mb-8">
                  <h2 className="text-[16px] font-medium text-[#2c2c2a]">顧客登録</h2>
                  <p className="text-[11px] text-[#d3d1c7] mt-1">新しい顧客情報を登録します</p>
                </div>
                <div className="space-y-5">
                  <div>
                    <label className="block text-[11px] text-[#888780] mb-1.5 tracking-wide">名前 <span className="text-[#c49885]">*</span></label>
                    <input type="text" placeholder="山田 太郎" value={custName} onChange={(e) => setCustName(e.target.value)}
                      className="w-full px-4 py-3 bg-[#f8f6f3] border border-transparent rounded-xl text-[13px] outline-none focus:border-[#c3a782]/30 focus:bg-white transition-all placeholder-[#d3d1c7]" />
                  </div>
                  <div>
                    <label className="block text-[11px] text-[#888780] mb-1.5 tracking-wide">電話番号</label>
                    <input type="tel" placeholder="090-1234-5678" value={custPhone} onChange={(e) => setCustPhone(e.target.value)}
                      className="w-full px-4 py-3 bg-[#f8f6f3] border border-transparent rounded-xl text-[13px] outline-none focus:border-[#c3a782]/30 focus:bg-white transition-all placeholder-[#d3d1c7]" />
                  </div>
                  <div>
                    <label className="block text-[11px] text-[#888780] mb-1.5 tracking-wide">メールアドレス</label>
                    <input type="email" placeholder="example@email.com" value={custEmail} onChange={(e) => setCustEmail(e.target.value)}
                      className="w-full px-4 py-3 bg-[#f8f6f3] border border-transparent rounded-xl text-[13px] outline-none focus:border-[#c3a782]/30 focus:bg-white transition-all placeholder-[#d3d1c7]" />
                  </div>
                  <div>
                    <label className="block text-[11px] text-[#888780] mb-1.5 tracking-wide">備考</label>
                    <textarea placeholder="メモ・備考を入力" rows={3} value={custNotes} onChange={(e) => setCustNotes(e.target.value)}
                      className="w-full px-4 py-3 bg-[#f8f6f3] border border-transparent rounded-xl text-[13px] outline-none focus:border-[#c3a782]/30 focus:bg-white transition-all resize-none placeholder-[#d3d1c7]" />
                  </div>
                  {saveMsg && (
                    <div className={`px-4 py-3 rounded-xl text-[12px] ${saveMsg.includes("失敗") || saveMsg.includes("入力") ? "bg-[#c49885]/10 text-[#c49885] border border-[#c49885]/15" : "bg-[#7ab88f]/10 text-[#5a9e6f] border border-[#7ab88f]/15"}`}>{saveMsg}</div>
                  )}
                  <div className="flex gap-3 pt-3">
                    <button onClick={handleRegister} disabled={saving} className="px-7 py-3 bg-gradient-to-r from-[#c3a782] to-[#b09672] text-white text-[12px] rounded-xl hover:shadow-[0_4px_16px_rgba(195,167,130,0.25)] transition-all duration-300 cursor-pointer tracking-wide disabled:opacity-60">{saving ? "登録中..." : "登録する"}</button>
                    <button onClick={() => { setActivePage("顧客一覧"); setSaveMsg(""); }} className="px-7 py-3 border border-[#f0ece4] text-[#888780] text-[12px] rounded-xl hover:bg-[#f8f6f3] transition-all cursor-pointer">キャンセル</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Other pages */}
          {activePage !== "HOME" && activePage !== "顧客一覧" && activePage !== "顧客登録" && (
            <div className="animate-[fadeIn_0.4s_ease-out]">
              <div className="bg-white rounded-2xl border border-[#f0ece4] p-8">
                <div className="flex flex-col items-center justify-center py-20">
                  <div className="w-[72px] h-[72px] rounded-2xl bg-[#f8f6f3] flex items-center justify-center mb-5">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#d3d1c7" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
                  </div>
                  <h3 className="text-[15px] text-[#888780] mb-1.5">{activePage}</h3>
                  <p className="text-[12px] text-[#d3d1c7]">この機能は次のステップで実装します</p>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Edit Modal */}
      {editingCustomer && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setEditingCustomer(null)}>
          <div className="bg-white rounded-2xl border border-[#f0ece4] p-8 w-full max-w-lg animate-[fadeIn_0.25s_ease-out]" onClick={(e) => e.stopPropagation()}>
            <div className="mb-6">
              <h2 className="text-[16px] font-medium text-[#2c2c2a]">顧客情報を編集</h2>
              <p className="text-[11px] text-[#d3d1c7] mt-1">変更したい項目を修正してください</p>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-[11px] text-[#888780] mb-1.5">名前 <span className="text-[#c49885]">*</span></label>
                <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-4 py-3 bg-[#f8f6f3] border border-transparent rounded-xl text-[13px] outline-none focus:border-[#c3a782]/30 focus:bg-white transition-all" />
              </div>
              <div>
                <label className="block text-[11px] text-[#888780] mb-1.5">電話番号</label>
                <input type="tel" value={editPhone} onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full px-4 py-3 bg-[#f8f6f3] border border-transparent rounded-xl text-[13px] outline-none focus:border-[#c3a782]/30 focus:bg-white transition-all" />
              </div>
              <div>
                <label className="block text-[11px] text-[#888780] mb-1.5">メールアドレス</label>
                <input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-[#f8f6f3] border border-transparent rounded-xl text-[13px] outline-none focus:border-[#c3a782]/30 focus:bg-white transition-all" />
              </div>
              <div>
                <label className="block text-[11px] text-[#888780] mb-1.5">備考</label>
                <textarea rows={3} value={editNotes} onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full px-4 py-3 bg-[#f8f6f3] border border-transparent rounded-xl text-[13px] outline-none focus:border-[#c3a782]/30 focus:bg-white transition-all resize-none" />
              </div>
              {editMsg && (
                <div className={`px-4 py-3 rounded-xl text-[12px] ${editMsg.includes("失敗") || editMsg.includes("入力") ? "bg-[#c49885]/10 text-[#c49885]" : "bg-[#7ab88f]/10 text-[#5a9e6f]"}`}>{editMsg}</div>
              )}
              <div className="flex gap-3 pt-2">
                <button onClick={handleUpdate} disabled={editSaving} className="px-7 py-3 bg-gradient-to-r from-[#c3a782] to-[#b09672] text-white text-[12px] rounded-xl hover:shadow-[0_4px_16px_rgba(195,167,130,0.25)] transition-all cursor-pointer disabled:opacity-60">{editSaving ? "更新中..." : "更新する"}</button>
                <button onClick={() => setEditingCustomer(null)} className="px-7 py-3 border border-[#f0ece4] text-[#888780] text-[12px] rounded-xl hover:bg-[#f8f6f3] transition-all cursor-pointer">キャンセル</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setDeleteTarget(null)}>
          <div className="bg-white rounded-2xl border border-[#f0ece4] p-8 w-full max-w-sm text-center animate-[fadeIn_0.25s_ease-out]" onClick={(e) => e.stopPropagation()}>
            <div className="w-14 h-14 rounded-full bg-[#fce8e8] flex items-center justify-center mx-auto mb-5">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#c45555" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </div>
            <h3 className="text-[15px] font-medium text-[#2c2c2a] mb-2">顧客を削除しますか？</h3>
            <p className="text-[12px] text-[#b4b2a9] mb-6">「{deleteTarget.name}」を削除すると元に戻せません</p>
            <div className="flex gap-3 justify-center">
              <button onClick={handleDelete} disabled={deleting} className="px-6 py-2.5 bg-[#c45555] text-white text-[12px] rounded-xl hover:bg-[#b04444] transition-colors cursor-pointer disabled:opacity-60">{deleting ? "削除中..." : "削除する"}</button>
              <button onClick={() => setDeleteTarget(null)} className="px-6 py-2.5 border border-[#f0ece4] text-[#888780] text-[12px] rounded-xl hover:bg-[#f8f6f3] transition-all cursor-pointer">キャンセル</button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
