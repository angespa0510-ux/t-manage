"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { useTheme } from "../../lib/theme";
import { NavMenu } from "../../lib/nav-menu";
import { useToast } from "../../lib/toast";

type Staff = { id: number; name: string; phone: string; email: string; role: string; address: string; transport_fee: number; id_photo_url: string; status: string };
type Store = { id: number; name: string; invoice_number: string; company_name: string; company_address: string; company_phone: string };

export default function StaffPage() {
  const router = useRouter();
  const { dark, toggle, T } = useTheme();
  const toast = useToast();
  const [tab, setTab] = useState<"staff" | "company">("staff");
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [storeInfo, setStoreInfo] = useState<Store | null>(null);

  const [showAdd, setShowAdd] = useState(false);
  const [addName, setAddName] = useState("");
  const [addPhone, setAddPhone] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [addRole, setAddRole] = useState("staff");
  const [addAddress, setAddAddress] = useState("");
  const [addTransport, setAddTransport] = useState("0");

  const [editStaff, setEditStaff] = useState<Staff | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editRole, setEditRole] = useState("staff");
  const [editAddress, setEditAddress] = useState("");
  const [editTransport, setEditTransport] = useState("0");

  const [companyName, setCompanyName] = useState("");
  const [companyAddress, setCompanyAddress] = useState("");
  const [companyPhone, setCompanyPhone] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");

  const inputStyle = { backgroundColor: T.cardAlt, color: T.text, border: "1px solid transparent" };

  const fetchData = useCallback(async () => {
    const { data: s } = await supabase.from("staff").select("*").order("id");
    if (s) setStaffList(s);
    const { data: st } = await supabase.from("stores").select("*").limit(1).single();
    if (st) { setStoreInfo(st); setCompanyName(st.company_name || ""); setCompanyAddress(st.company_address || ""); setCompanyPhone(st.company_phone || ""); setInvoiceNumber(st.invoice_number || ""); }
  }, []);

  useEffect(() => { const check = async () => { const { data: { user } } = await supabase.auth.getUser(); if (!user) router.push("/"); }; check(); fetchData(); }, [router, fetchData]);

  const addStaff = async () => {
    if (!addName.trim()) return;
    await supabase.from("staff").insert({ name: addName.trim(), phone: addPhone.trim(), email: addEmail.trim(), role: addRole, address: addAddress.trim(), transport_fee: parseInt(addTransport) || 0, status: "active" });
    toast.show("スタッフを登録しました", "success");
    setShowAdd(false); setAddName(""); setAddPhone(""); setAddEmail(""); setAddRole("staff"); setAddAddress(""); setAddTransport("0");
    fetchData();
  };

  const updateStaff = async () => {
    if (!editStaff) return;
    await supabase.from("staff").update({ name: editName.trim(), phone: editPhone.trim(), email: editEmail.trim(), role: editRole, address: editAddress.trim(), transport_fee: parseInt(editTransport) || 0 }).eq("id", editStaff.id);
    toast.show("スタッフ情報を更新しました", "success");
    setEditStaff(null); fetchData();
  };

  const deleteStaff = async (id: number, name: string) => {
    if (!confirm(`${name}を削除しますか？`)) return;
    await supabase.from("staff").delete().eq("id", id);
    toast.show("スタッフを削除しました", "info");
    fetchData();
  };

  const saveCompany = async () => {
    if (!storeInfo) return;
    await supabase.from("stores").update({ company_name: companyName.trim(), company_address: companyAddress.trim(), company_phone: companyPhone.trim(), invoice_number: invoiceNumber.trim() }).eq("id", storeInfo.id);
    toast.show("会社情報を更新しました", "success");
    fetchData();
  };

  const roleColors: Record<string, string> = { owner: "#c3a782", manager: "#85a8c4", staff: "#22c55e" };
  const roleLabels: Record<string, string> = { owner: "オーナー", manager: "マネージャー", staff: "スタッフ" };

  return (
    <div className="min-h-screen" style={{ backgroundColor: T.bg, color: T.text }}>
      <div className="h-[64px] backdrop-blur-xl border-b flex items-center justify-between px-6" style={{ backgroundColor: dark ? T.card + "cc" : "rgba(255,255,255,0.8)", borderColor: T.border }}>
        <div className="flex items-center gap-4">
          <NavMenu T={T} dark={dark} />
          <h1 className="text-[18px] font-medium">内勤スタッフ設定</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={toggle} className="px-3 py-1.5 text-[10px] rounded-lg cursor-pointer border" style={{ borderColor: T.border, color: T.textSub }}>{dark ? "☀️ ライト" : "🌙 ダーク"}</button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-6">
        <div className="flex gap-2 mb-6">
          {(["staff", "company"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} className="px-4 py-2 rounded-xl text-[12px] cursor-pointer" style={{ backgroundColor: tab === t ? "#c3a78222" : T.cardAlt, color: tab === t ? "#c3a782" : T.textMuted, border: `1px solid ${tab === t ? "#c3a782" : T.border}`, fontWeight: tab === t ? 700 : 400 }}>
              {t === "staff" ? "👥 スタッフ管理" : "🏢 会社情報"}
            </button>
          ))}
        </div>

        {tab === "staff" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-[13px]" style={{ color: T.textMuted }}>登録済み: {staffList.length}名</p>
              <button onClick={() => setShowAdd(true)} className="px-4 py-2 bg-gradient-to-r from-[#c3a782] to-[#b09672] text-white text-[11px] rounded-xl cursor-pointer">+ スタッフ追加</button>
            </div>

            {staffList.map(s => (
              <div key={s.id} className="rounded-xl border p-4 flex items-center justify-between" style={{ backgroundColor: T.card, borderColor: T.border }}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-[14px] text-white font-medium" style={{ backgroundColor: roleColors[s.role] || "#888" }}>{s.name.charAt(0)}</div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-medium">{s.name}</span>
                      <span className="text-[9px] px-2 py-0.5 rounded" style={{ backgroundColor: (roleColors[s.role] || "#888") + "22", color: roleColors[s.role] || "#888" }}>{roleLabels[s.role] || s.role}</span>
                    </div>
                    <div className="flex items-center gap-3 text-[10px]" style={{ color: T.textMuted }}>
                      {s.phone && <span>📞 {s.phone}</span>}
                      {s.email && <span>✉ {s.email}</span>}
                      {s.transport_fee > 0 && <span>🚗 ¥{s.transport_fee.toLocaleString()}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { setEditStaff(s); setEditName(s.name); setEditPhone(s.phone || ""); setEditEmail(s.email || ""); setEditRole(s.role); setEditAddress(s.address || ""); setEditTransport(String(s.transport_fee || 0)); }} className="text-[10px] px-3 py-1.5 rounded-lg cursor-pointer border" style={{ borderColor: T.border, color: T.textSub }}>編集</button>
                  <button onClick={() => deleteStaff(s.id, s.name)} className="text-[10px] px-3 py-1.5 rounded-lg cursor-pointer" style={{ backgroundColor: "#c4555512", color: "#c45555" }}>削除</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "company" && (
          <div className="rounded-xl border p-6 space-y-4" style={{ backgroundColor: T.card, borderColor: T.border }}>
            <h2 className="text-[15px] font-medium">🏢 会社情報</h2>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>会社名</label><input type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} /></div>
              <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>電話番号</label><input type="text" value={companyPhone} onChange={(e) => setCompanyPhone(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} /></div>
            </div>
            <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>住所</label><input type="text" value={companyAddress} onChange={(e) => setCompanyAddress(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} /></div>
            <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>適格事業者番号</label><input type="text" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} placeholder="T1234567890123" className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} /></div>
            <button onClick={saveCompany} className="px-6 py-2.5 bg-gradient-to-r from-[#c3a782] to-[#b09672] text-white text-[11px] rounded-xl cursor-pointer">保存する</button>
          </div>
        )}
      </div>

      {/* Add Staff Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowAdd(false)}>
          <div className="rounded-2xl border p-6 w-full max-w-md max-h-[90vh] overflow-y-auto animate-[fadeIn_0.25s]" style={{ backgroundColor: T.card, borderColor: T.border }} onClick={(e) => e.stopPropagation()}>
            <h2 className="text-[15px] font-medium mb-4">スタッフ追加</h2>
            <div className="space-y-3">
              <div><label className="block text-[11px] mb-1" style={{ color: T.textSub }}>名前 *</label><input type="text" value={addName} onChange={(e) => setAddName(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-[11px] mb-1" style={{ color: T.textSub }}>電話番号</label><input type="tel" value={addPhone} onChange={(e) => setAddPhone(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} /></div>
                <div><label className="block text-[11px] mb-1" style={{ color: T.textSub }}>メール</label><input type="email" value={addEmail} onChange={(e) => setAddEmail(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} /></div>
              </div>
              <div><label className="block text-[11px] mb-1" style={{ color: T.textSub }}>住所</label><input type="text" value={addAddress} onChange={(e) => setAddAddress(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-[11px] mb-1" style={{ color: T.textSub }}>役割</label><select value={addRole} onChange={(e) => setAddRole(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none cursor-pointer" style={inputStyle}><option value="owner">オーナー</option><option value="manager">マネージャー</option><option value="staff">スタッフ</option></select></div>
                <div><label className="block text-[11px] mb-1" style={{ color: T.textSub }}>交通費</label><select value={addTransport} onChange={(e) => setAddTransport(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none cursor-pointer" style={inputStyle}><option value="0">なし</option><option value="500">¥500</option><option value="1000">¥1,000</option><option value="1500">¥1,500</option><option value="2000">¥2,000</option></select></div>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={addStaff} className="px-5 py-2.5 bg-gradient-to-r from-[#c3a782] to-[#b09672] text-white text-[11px] rounded-xl cursor-pointer">登録する</button>
                <button onClick={() => setShowAdd(false)} className="px-5 py-2.5 border text-[11px] rounded-xl cursor-pointer" style={{ borderColor: T.border, color: T.textSub }}>キャンセル</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Staff Modal */}
      {editStaff && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setEditStaff(null)}>
          <div className="rounded-2xl border p-6 w-full max-w-md max-h-[90vh] overflow-y-auto animate-[fadeIn_0.25s]" style={{ backgroundColor: T.card, borderColor: T.border }} onClick={(e) => e.stopPropagation()}>
            <h2 className="text-[15px] font-medium mb-4">スタッフ編集</h2>
            <div className="space-y-3">
              <div><label className="block text-[11px] mb-1" style={{ color: T.textSub }}>名前 *</label><input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-[11px] mb-1" style={{ color: T.textSub }}>電話番号</label><input type="tel" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} /></div>
                <div><label className="block text-[11px] mb-1" style={{ color: T.textSub }}>メール</label><input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} /></div>
              </div>
              <div><label className="block text-[11px] mb-1" style={{ color: T.textSub }}>住所</label><input type="text" value={editAddress} onChange={(e) => setEditAddress(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-[11px] mb-1" style={{ color: T.textSub }}>役割</label><select value={editRole} onChange={(e) => setEditRole(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none cursor-pointer" style={inputStyle}><option value="owner">オーナー</option><option value="manager">マネージャー</option><option value="staff">スタッフ</option></select></div>
                <div><label className="block text-[11px] mb-1" style={{ color: T.textSub }}>交通費</label><select value={editTransport} onChange={(e) => setEditTransport(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none cursor-pointer" style={inputStyle}><option value="0">なし</option><option value="500">¥500</option><option value="1000">¥1,000</option><option value="1500">¥1,500</option><option value="2000">¥2,000</option></select></div>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={updateStaff} className="px-5 py-2.5 bg-gradient-to-r from-[#c3a782] to-[#b09672] text-white text-[11px] rounded-xl cursor-pointer">更新する</button>
                <button onClick={() => setEditStaff(null)} className="px-5 py-2.5 border text-[11px] rounded-xl cursor-pointer" style={{ borderColor: T.border, color: T.textSub }}>キャンセル</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  );
}