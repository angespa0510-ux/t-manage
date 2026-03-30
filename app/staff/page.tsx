"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { useTheme } from "../../lib/theme";
import { NavMenu } from "../../lib/nav-menu";
import { useToast } from "../../lib/toast";

type Staff = { id: number; name: string; phone: string; email: string; role: string; address: string; transport_fee: number; id_photo_url: string; status: string; unit_price: number; pin: string };
type Store = { id: number; name: string; invoice_number: string; company_name: string; company_address: string; company_phone: string };
type Schedule = { id: number; staff_id: number; date: string; start_time: string; end_time: string; unit_price: number; units: number; commission_fee: number; transport_fee: number; total_payment: number; status: string; notes: string; is_paid: boolean };

export default function StaffPage() {
  const router = useRouter();
  const { dark, toggle, T } = useTheme();
  const toast = useToast();
  const [tab, setTab] = useState<"staff" | "schedule" | "company">("staff");
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [storeInfo, setStoreInfo] = useState<Store | null>(null);

  // Staff CRUD states
  const [showAdd, setShowAdd] = useState(false);
  const [addName, setAddName] = useState("");
  const [addPhone, setAddPhone] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [addRole, setAddRole] = useState("staff");
  const [addAddress, setAddAddress] = useState("");
  const [addTransport, setAddTransport] = useState("0");
  const [addUnitPrice, setAddUnitPrice] = useState("1200");
  const [addPin, setAddPin] = useState("");

  const [editStaff, setEditStaff] = useState<Staff | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editRole, setEditRole] = useState("staff");
  const [editAddress, setEditAddress] = useState("");
  const [editTransport, setEditTransport] = useState("0");
  const [editUnitPrice, setEditUnitPrice] = useState("1200");
  const [editPin, setEditPin] = useState("");

  // Company states
  const [companyName, setCompanyName] = useState("");
  const [companyAddress, setCompanyAddress] = useState("");
  const [companyPhone, setCompanyPhone] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");

  // Schedule states
  const [scheduleDate, setScheduleDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [showAddSchedule, setShowAddSchedule] = useState(false);
  const [schStaffId, setSchStaffId] = useState(0);
  const [schStart, setSchStart] = useState("10:00");
  const [schEnd, setSchEnd] = useState("19:00");
  const [schNotes, setSchNotes] = useState("");
  const [editSchedule, setEditSchedule] = useState<Schedule | null>(null);
  const [eschStart, setEschStart] = useState("");
  const [eschEnd, setEschEnd] = useState("");
  const [eschNotes, setEschNotes] = useState("");
  const [eschStatus, setEschStatus] = useState("scheduled");
  const [showMonthly, setShowMonthly] = useState(false);
  const [monthlyData, setMonthlyData] = useState<{ staff_id: number; name: string; days: number; total_units: number; total_commission: number; total_transport: number; total_payment: number }[]>([]);
  const [monthlyMonth, setMonthlyMonth] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; });

  const inputStyle = { backgroundColor: T.cardAlt, color: T.text, border: "1px solid transparent" };
  const fmt = (n: number) => "¥" + (n || 0).toLocaleString();

  const TIMES_30MIN: string[] = [];
  for (let h = 6; h <= 23; h++) { TIMES_30MIN.push(`${String(h).padStart(2, "0")}:00`); TIMES_30MIN.push(`${String(h).padStart(2, "0")}:30`); }

  const calcUnits = (start: string, end: string) => {
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    const diff = (eh * 60 + em) - (sh * 60 + sm);
    return Math.max(0, Math.round(diff / 6) / 10); // 0.1単位
  };

  const fetchData = useCallback(async () => {
    const { data: s } = await supabase.from("staff").select("*").order("id");
    if (s) setStaffList(s);
    const { data: st } = await supabase.from("stores").select("*").limit(1).single();
    if (st) { setStoreInfo(st); setCompanyName(st.company_name || ""); setCompanyAddress(st.company_address || ""); setCompanyPhone(st.company_phone || ""); setInvoiceNumber(st.invoice_number || ""); }
  }, []);

  const fetchSchedules = useCallback(async () => {
    const { data: sch } = await supabase.from("staff_schedules").select("*").eq("date", scheduleDate).order("start_time");
    if (sch) setSchedules(sch);
  }, [scheduleDate]);

  useEffect(() => { const check = async () => { const { data: { user } } = await supabase.auth.getUser(); if (!user) router.push("/"); }; check(); fetchData(); }, [router, fetchData]);
  useEffect(() => { fetchSchedules(); }, [fetchSchedules]);

  // Staff CRUD
  const addStaffFn = async () => {
    if (!addName.trim()) return;
    await supabase.from("staff").insert({ name: addName.trim(), phone: addPhone.trim(), email: addEmail.trim(), role: addRole, address: addAddress.trim(), transport_fee: parseInt(addTransport) || 0, unit_price: parseInt(addUnitPrice) || 1200, pin: addPin.trim(), status: "active" });
    toast.show("スタッフを登録しました", "success");
    setShowAdd(false); setAddName(""); setAddPhone(""); setAddEmail(""); setAddRole("staff"); setAddAddress(""); setAddTransport("0"); setAddUnitPrice("1200"); setAddPin("");
    fetchData();
  };

  const updateStaffFn = async () => {
    if (!editStaff) return;
    await supabase.from("staff").update({ name: editName.trim(), phone: editPhone.trim(), email: editEmail.trim(), role: editRole, address: editAddress.trim(), transport_fee: parseInt(editTransport) || 0, unit_price: parseInt(editUnitPrice) || 1200, pin: editPin.trim() }).eq("id", editStaff.id);
    toast.show("スタッフ情報を更新しました", "success");
    setEditStaff(null); fetchData();
  };

  const deleteStaffFn = async (id: number, name: string) => {
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

  // Schedule CRUD
  const addScheduleFn = async () => {
    if (!schStaffId) return;
    const staff = staffList.find(s => s.id === schStaffId);
    const unitPrice = staff?.unit_price || 1200;
    const units = calcUnits(schStart, schEnd);
    const commission = Math.round(unitPrice * units);
    const transport = staff?.transport_fee || 0;
    const total = commission + transport;
    await supabase.from("staff_schedules").insert({ staff_id: schStaffId, date: scheduleDate, start_time: schStart, end_time: schEnd, unit_price: unitPrice, units, commission_fee: commission, transport_fee: transport, total_payment: total, status: "scheduled", notes: schNotes.trim() });
    toast.show("稼働予定を登録しました", "success");
    setShowAddSchedule(false); setSchStaffId(0); setSchStart("10:00"); setSchEnd("19:00"); setSchNotes("");
    fetchSchedules();
  };

  const updateScheduleFn = async () => {
    if (!editSchedule) return;
    const staff = staffList.find(s => s.id === editSchedule.staff_id);
    const unitPrice = staff?.unit_price || editSchedule.unit_price;
    const units = calcUnits(eschStart, eschEnd);
    const commission = Math.round(unitPrice * units);
    const transport = staff?.transport_fee || 0;
    const total = commission + transport;
    await supabase.from("staff_schedules").update({ start_time: eschStart, end_time: eschEnd, units, commission_fee: commission, transport_fee: transport, total_payment: total, status: eschStatus, notes: eschNotes.trim() }).eq("id", editSchedule.id);
    toast.show("稼働予定を更新しました", "success");
    setEditSchedule(null); fetchSchedules();
  };

  const markCompleted = async (sch: Schedule) => {
    await supabase.from("staff_schedules").update({ status: "completed" }).eq("id", sch.id);
    toast.show("業務完了を記録しました", "success");
    fetchSchedules();
  };

  const deleteScheduleFn = async (id: number) => {
    if (!confirm("この稼働予定を削除しますか？")) return;
    await supabase.from("staff_schedules").delete().eq("id", id);
    toast.show("稼働予定を削除しました", "info");
    fetchSchedules();
  };

  const fetchMonthly = async () => {
    const [y, m] = monthlyMonth.split("-").map(Number);
    const startDate = `${y}-${String(m).padStart(2, "0")}-01`;
    const endDate = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
    const { data } = await supabase.from("staff_schedules").select("*").gte("date", startDate).lt("date", endDate);
    if (!data) return;
    const map = new Map<number, { days: number; total_units: number; total_commission: number; total_transport: number; total_payment: number }>();
    for (const d of data) {
      const cur = map.get(d.staff_id) || { days: 0, total_units: 0, total_commission: 0, total_transport: 0, total_payment: 0 };
      cur.days++; cur.total_units += d.units; cur.total_commission += d.commission_fee; cur.total_transport += d.transport_fee; cur.total_payment += d.total_payment;
      map.set(d.staff_id, cur);
    }
    const result = Array.from(map.entries()).map(([sid, vals]) => {
      const st = staffList.find(s => s.id === sid);
      return { staff_id: sid, name: st?.name || "不明", ...vals };
    });
    setMonthlyData(result);
    setShowMonthly(true);
  };

  const openPaymentStatement = (sch: Schedule) => {
    const staff = staffList.find(s => s.id === sch.staff_id);
    const store = storeInfo;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>支払明細書</title><style>body{font-family:'Hiragino Sans','Yu Gothic',sans-serif;max-width:700px;margin:40px auto;padding:20px;color:#333}h1{text-align:center;font-size:20px;border-bottom:3px double #333;padding-bottom:10px;margin-bottom:30px}table{width:100%;border-collapse:collapse;margin:15px 0}td,th{border:1px solid #ccc;padding:8px 12px;font-size:13px}th{background:#f5f0e8;text-align:left;width:40%}.right{text-align:right}.total{font-size:16px;font-weight:bold;color:#c3a782}.header-info{display:flex;justify-content:space-between;margin-bottom:20px;font-size:12px}.company{text-align:right;font-size:11px;line-height:1.8}.sign{margin-top:50px;display:flex;justify-content:space-between}.sign-box{border-top:1px solid #333;width:200px;text-align:center;padding-top:5px;font-size:11px}@media print{body{margin:0;padding:20px}}</style></head><body>
    <h1>支払明細書（業務委託費）</h1>
    <div class="header-info">
      <div>
        <p><strong>支払先：</strong>${staff?.name || ""} 様</p>
        <p><strong>業務実施日：</strong>${sch.date}</p>
        <p><strong>業務内容：</strong>店舗管理・受付業務一式</p>
      </div>
      <div class="company">
        <p><strong>${store?.company_name || ""}</strong></p>
        <p>${store?.company_address || ""}</p>
        <p>TEL: ${store?.company_phone || ""}</p>
        ${store?.invoice_number ? `<p>適格事業者番号: ${store.invoice_number}</p>` : ""}
      </div>
    </div>
    <table>
      <tr><th>項目</th><th class="right">金額</th><th>備考</th></tr>
      <tr><td>業務委託費</td><td class="right">&yen;${sch.commission_fee.toLocaleString()}</td><td style="font-size:11px;color:#888">業務単価 &yen;${sch.unit_price.toLocaleString()} × ${sch.units}ユニット</td></tr>
      <tr><td>業務時間</td><td class="right">${sch.start_time}〜${sch.end_time}</td><td style="font-size:11px;color:#888">${sch.units}ユニット相当</td></tr>
      ${sch.transport_fee > 0 ? `<tr><td>交通費（非課税）</td><td class="right">&yen;${sch.transport_fee.toLocaleString()}</td><td style="font-size:11px;color:#888">実費精算</td></tr>` : ""}
      <tr style="background:#f9f6f0"><td><strong>合計支払額</strong></td><td class="right total">&yen;${sch.total_payment.toLocaleString()}</td><td></td></tr>
    </table>
    ${sch.notes ? `<p style="font-size:12px;margin-top:15px"><strong>備考：</strong>${sch.notes}</p>` : ""}
    <p style="font-size:11px;margin-top:20px;color:#888">上記の通り、${sch.date}の店舗管理・受付業務一式の完了を確認し、業務委託費としてお支払いいたします。</p>
    <div class="sign">
      <div class="sign-box">支払者（${store?.company_name || ""}）</div>
      <div class="sign-box">受領者（${staff?.name || ""} 様）</div>
    </div>
    </body></html>`);
    w.document.close();
  };

  const roleColors: Record<string, string> = { owner: "#c3a782", manager: "#85a8c4", staff: "#22c55e" };
  const roleLabels: Record<string, string> = { owner: "オーナー", manager: "マネージャー", staff: "スタッフ" };
  const statusColors: Record<string, string> = { scheduled: "#85a8c4", completed: "#22c55e", cancelled: "#c45555" };
  const statusLabels: Record<string, string> = { scheduled: "予定", completed: "完了", cancelled: "キャンセル" };

  const prevDay = () => { const d = new Date(scheduleDate); d.setDate(d.getDate() - 1); setScheduleDate(d.toISOString().split("T")[0]); };
  const nextDay = () => { const d = new Date(scheduleDate); d.setDate(d.getDate() + 1); setScheduleDate(d.toISOString().split("T")[0]); };
  const dateDisplay = (() => { const d = new Date(scheduleDate + "T00:00:00"); const days = ["日", "月", "火", "水", "木", "金", "土"]; return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日（${days[d.getDay()]}）`; })();

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
          {(["staff", "schedule", "company"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} className="px-4 py-2 rounded-xl text-[12px] cursor-pointer" style={{ backgroundColor: tab === t ? "#c3a78222" : T.cardAlt, color: tab === t ? "#c3a782" : T.textMuted, border: `1px solid ${tab === t ? "#c3a782" : T.border}`, fontWeight: tab === t ? 700 : 400 }}>
              {t === "staff" ? "👥 スタッフ管理" : t === "schedule" ? "📅 業務稼働予定" : "🏢 会社情報"}
            </button>
          ))}
        </div>

        {/* ========== Tab 1: Staff Management ========== */}
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
                      {s.transport_fee > 0 && <span>🚗 {fmt(s.transport_fee)}</span>}
                      <span>💰 {fmt(s.unit_price || 1200)}/ユニット</span>
                      {s.pin ? <span style={{ color: "#22c55e" }}>🔑 設定済</span> : <span style={{ color: "#c45555" }}>🔑 未設定</span>}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { setEditStaff(s); setEditName(s.name); setEditPhone(s.phone || ""); setEditEmail(s.email || ""); setEditRole(s.role); setEditAddress(s.address || ""); setEditTransport(String(s.transport_fee || 0)); setEditUnitPrice(String(s.unit_price || 1200)); setEditPin(s.pin || ""); }} className="text-[10px] px-3 py-1.5 rounded-lg cursor-pointer border" style={{ borderColor: T.border, color: T.textSub }}>編集</button>
                  <button onClick={() => deleteStaffFn(s.id, s.name)} className="text-[10px] px-3 py-1.5 rounded-lg cursor-pointer" style={{ backgroundColor: "#c4555512", color: "#c45555" }}>削除</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ========== Tab 2: Schedule (業務稼働予定) ========== */}
        {tab === "schedule" && (
          <div className="space-y-4">
            {/* Date Nav */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button onClick={prevDay} className="p-1.5 rounded-lg cursor-pointer" style={{ color: T.textSub }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="15 18 9 12 15 6"/></svg></button>
                <button onClick={() => setScheduleDate(new Date().toISOString().split("T")[0])} className="px-3 py-1 text-[11px] border rounded-lg cursor-pointer" style={{ borderColor: T.border, color: T.textSub }}>今日</button>
                <span className="text-[14px] font-medium">{dateDisplay}</span>
                <input type="date" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)} className="text-[12px] border rounded-lg px-2 py-1 outline-none cursor-pointer" style={{ borderColor: T.border, color: T.textSub, backgroundColor: T.card }} />
                <button onClick={nextDay} className="p-1.5 rounded-lg cursor-pointer" style={{ color: T.textSub }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="9 18 15 12 9 6"/></svg></button>
              </div>
              <div className="flex gap-2">
                <button onClick={() => { fetchMonthly(); }} className="px-3 py-2 border text-[11px] rounded-xl cursor-pointer" style={{ borderColor: "#c3a78244", color: "#c3a782" }}>📊 月次集計</button>
                <button onClick={() => { setShowAddSchedule(true); setSchStaffId(0); setSchStart("10:00"); setSchEnd("19:00"); setSchNotes(""); }} className="px-4 py-2 bg-gradient-to-r from-[#c3a782] to-[#b09672] text-white text-[11px] rounded-xl cursor-pointer">+ 稼働追加</button>
              </div>
            </div>

            {/* Schedule List */}
            {schedules.length === 0 ? (
              <div className="rounded-xl border p-8 text-center" style={{ backgroundColor: T.card, borderColor: T.border }}>
                <p className="text-[13px]" style={{ color: T.textFaint }}>この日の稼働予定はありません</p>
              </div>
            ) : (
              <div className="space-y-3">
                {schedules.map(sch => {
                  const staff = staffList.find(s => s.id === sch.staff_id);
                  return (
                    <div key={sch.id} className="rounded-xl border p-4" style={{ backgroundColor: T.card, borderColor: T.border }}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full flex items-center justify-center text-[13px] text-white font-medium" style={{ backgroundColor: roleColors[staff?.role || "staff"] || "#888" }}>{staff?.name?.charAt(0) || "?"}</div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-[13px] font-medium">{staff?.name || "不明"}</span>
                              <span className="text-[9px] px-2 py-0.5 rounded" style={{ backgroundColor: statusColors[sch.status] + "22", color: statusColors[sch.status] }}>{statusLabels[sch.status]}</span>
                              {sch.is_paid && <span className="text-[9px] px-2 py-0.5 rounded" style={{ backgroundColor: "#c3a78222", color: "#c3a782" }}>支払済</span>}
                            </div>
                            <p className="text-[10px]" style={{ color: T.textMuted }}>⏰ {sch.start_time}〜{sch.end_time}（{sch.units}ユニット）</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-[15px] font-bold" style={{ color: "#c3a782" }}>{fmt(sch.total_payment)}</p>
                          <p className="text-[9px]" style={{ color: T.textMuted }}>委託費{fmt(sch.commission_fee)}{sch.transport_fee > 0 ? ` + 交通費${fmt(sch.transport_fee)}` : ""}</p>
                        </div>
                      </div>
                      {sch.notes && <p className="text-[10px] mb-2 px-2 py-1.5 rounded-lg" style={{ backgroundColor: T.cardAlt, color: "#f59e0b" }}>📝 {sch.notes}</p>}
                      <div className="flex gap-2">
                        {sch.status === "scheduled" && <button onClick={() => markCompleted(sch)} className="px-3 py-1.5 rounded-lg text-[10px] cursor-pointer" style={{ backgroundColor: "#22c55e18", color: "#22c55e", border: "1px solid #22c55e44" }}>✅ 業務完了</button>}
                        <button onClick={() => openPaymentStatement(sch)} className="px-3 py-1.5 rounded-lg text-[10px] cursor-pointer" style={{ backgroundColor: "#85a8c418", color: "#85a8c4", border: "1px solid #85a8c444" }}>📄 支払明細書</button>
                        <button onClick={() => { setEditSchedule(sch); setEschStart(sch.start_time); setEschEnd(sch.end_time); setEschNotes(sch.notes || ""); setEschStatus(sch.status); }} className="px-3 py-1.5 rounded-lg text-[10px] cursor-pointer border" style={{ borderColor: T.border, color: T.textSub }}>編集</button>
                        <button onClick={() => deleteScheduleFn(sch.id)} className="px-3 py-1.5 rounded-lg text-[10px] cursor-pointer" style={{ backgroundColor: "#c4555512", color: "#c45555" }}>削除</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Daily Summary */}
            {schedules.length > 0 && (
              <div className="rounded-xl p-4" style={{ backgroundColor: "#c3a78212", border: "1px solid #c3a78233" }}>
                <div className="flex justify-between text-[12px]">
                  <span style={{ color: T.textSub }}>本日の稼働: <strong>{schedules.length}名</strong></span>
                  <span style={{ color: T.textSub }}>委託費合計: <strong style={{ color: "#c3a782" }}>{fmt(schedules.reduce((s, x) => s + x.commission_fee, 0))}</strong></span>
                  <span style={{ color: T.textSub }}>交通費合計: <strong>{fmt(schedules.reduce((s, x) => s + x.transport_fee, 0))}</strong></span>
                  <span style={{ color: "#c3a782" }}>支払合計: <strong>{fmt(schedules.reduce((s, x) => s + x.total_payment, 0))}</strong></span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========== Tab 3: Company Info ========== */}
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

      {/* ===== Add Staff Modal ===== */}
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
              <div className="grid grid-cols-3 gap-3">
                <div><label className="block text-[11px] mb-1" style={{ color: T.textSub }}>役割</label><select value={addRole} onChange={(e) => setAddRole(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none cursor-pointer" style={inputStyle}><option value="owner">オーナー</option><option value="manager">マネージャー</option><option value="staff">スタッフ</option></select></div>
                <div><label className="block text-[11px] mb-1" style={{ color: T.textSub }}>交通費</label><select value={addTransport} onChange={(e) => setAddTransport(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none cursor-pointer" style={inputStyle}><option value="0">なし</option><option value="500">¥500</option><option value="1000">¥1,000</option><option value="1500">¥1,500</option><option value="2000">¥2,000</option></select></div>
                <div><label className="block text-[11px] mb-1" style={{ color: T.textSub }}>業務単価</label><input type="text" inputMode="numeric" value={addUnitPrice} onChange={(e) => setAddUnitPrice(e.target.value.replace(/[^0-9]/g, ""))} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} /></div>
              </div>
              <div><label className="block text-[11px] mb-1" style={{ color: T.textSub }}>🔑 PINコード（4桁）</label><input type="text" inputMode="numeric" maxLength={4} value={addPin} onChange={(e) => setAddPin(e.target.value.replace(/[^0-9]/g, "").slice(0, 4))} placeholder="4桁の数字" className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none tracking-[0.5em] text-center font-bold" style={inputStyle} /><p className="text-[9px] mt-1" style={{ color: T.textFaint }}>部屋割り管理でのログインに使用</p></div>
              <div className="flex gap-3 pt-2">
                <button onClick={addStaffFn} className="px-5 py-2.5 bg-gradient-to-r from-[#c3a782] to-[#b09672] text-white text-[11px] rounded-xl cursor-pointer">登録する</button>
                <button onClick={() => setShowAdd(false)} className="px-5 py-2.5 border text-[11px] rounded-xl cursor-pointer" style={{ borderColor: T.border, color: T.textSub }}>キャンセル</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== Edit Staff Modal ===== */}
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
              <div className="grid grid-cols-3 gap-3">
                <div><label className="block text-[11px] mb-1" style={{ color: T.textSub }}>役割</label><select value={editRole} onChange={(e) => setEditRole(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none cursor-pointer" style={inputStyle}><option value="owner">オーナー</option><option value="manager">マネージャー</option><option value="staff">スタッフ</option></select></div>
                <div><label className="block text-[11px] mb-1" style={{ color: T.textSub }}>交通費</label><select value={editTransport} onChange={(e) => setEditTransport(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none cursor-pointer" style={inputStyle}><option value="0">なし</option><option value="500">¥500</option><option value="1000">¥1,000</option><option value="1500">¥1,500</option><option value="2000">¥2,000</option></select></div>
                <div><label className="block text-[11px] mb-1" style={{ color: T.textSub }}>業務単価</label><input type="text" inputMode="numeric" value={editUnitPrice} onChange={(e) => setEditUnitPrice(e.target.value.replace(/[^0-9]/g, ""))} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} /></div>
              </div>
              <div><label className="block text-[11px] mb-1" style={{ color: T.textSub }}>🔑 PINコード（4桁）</label><input type="text" inputMode="numeric" maxLength={4} value={editPin} onChange={(e) => setEditPin(e.target.value.replace(/[^0-9]/g, "").slice(0, 4))} placeholder="4桁の数字" className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none tracking-[0.5em] text-center font-bold" style={inputStyle} /></div>
              <div className="flex gap-3 pt-2">
                <button onClick={updateStaffFn} className="px-5 py-2.5 bg-gradient-to-r from-[#c3a782] to-[#b09672] text-white text-[11px] rounded-xl cursor-pointer">更新する</button>
                <button onClick={() => setEditStaff(null)} className="px-5 py-2.5 border text-[11px] rounded-xl cursor-pointer" style={{ borderColor: T.border, color: T.textSub }}>キャンセル</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== Add Schedule Modal ===== */}
      {showAddSchedule && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowAddSchedule(false)}>
          <div className="rounded-2xl border p-6 w-full max-w-sm animate-[fadeIn_0.25s]" style={{ backgroundColor: T.card, borderColor: T.border }} onClick={(e) => e.stopPropagation()}>
            <h2 className="text-[15px] font-medium mb-1">稼働予定追加</h2>
            <p className="text-[11px] mb-4" style={{ color: T.textFaint }}>{dateDisplay}</p>
            <div className="space-y-3">
              <div><label className="block text-[10px] mb-1" style={{ color: T.textSub }}>スタッフ *</label><select value={schStaffId} onChange={(e) => setSchStaffId(Number(e.target.value))} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none cursor-pointer" style={inputStyle}><option value={0}>選択</option>{staffList.filter(s => s.status === "active").map(s => <option key={s.id} value={s.id}>{s.name}（{fmt(s.unit_price || 1200)}/ユニット）</option>)}</select></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-[10px] mb-1" style={{ color: T.textSub }}>業務開始</label><select value={schStart} onChange={(e) => setSchStart(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none cursor-pointer" style={inputStyle}>{TIMES_30MIN.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
                <div><label className="block text-[10px] mb-1" style={{ color: T.textSub }}>業務終了</label><select value={schEnd} onChange={(e) => setSchEnd(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none cursor-pointer" style={inputStyle}>{TIMES_30MIN.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
              </div>
              {schStaffId > 0 && (() => {
                const st = staffList.find(s => s.id === schStaffId);
                const up = st?.unit_price || 1200;
                const u = calcUnits(schStart, schEnd);
                const comm = Math.round(up * u);
                const tr = st?.transport_fee || 0;
                return (
                <div className="rounded-xl p-3" style={{ backgroundColor: T.cardAlt }}>
                  <div className="space-y-1 text-[11px]">
                    <div className="flex justify-between"><span>業務単価 × ユニット数</span><span>{fmt(up)} × {u}</span></div>
                    <div className="flex justify-between"><span>業務委託費</span><span>{fmt(comm)}</span></div>
                    {tr > 0 && <div className="flex justify-between"><span>交通費（非課税）</span><span>+{fmt(tr)}</span></div>}
                    <div className="flex justify-between pt-1 font-bold" style={{ borderTop: `1px solid ${T.border}`, color: "#c3a782" }}><span>合計</span><span>{fmt(comm + tr)}</span></div>
                  </div>
                </div>);
              })()}
              <div><label className="block text-[10px] mb-1" style={{ color: T.textSub }}>備考</label><input type="text" value={schNotes} onChange={(e) => setSchNotes(e.target.value)} placeholder="業務内容のメモ" className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} /></div>
              <div className="flex gap-3 pt-2">
                <button onClick={addScheduleFn} className="px-5 py-2.5 bg-gradient-to-r from-[#c3a782] to-[#b09672] text-white text-[11px] rounded-xl cursor-pointer">登録する</button>
                <button onClick={() => setShowAddSchedule(false)} className="px-5 py-2.5 border text-[11px] rounded-xl cursor-pointer" style={{ borderColor: T.border, color: T.textSub }}>キャンセル</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== Edit Schedule Modal ===== */}
      {editSchedule && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setEditSchedule(null)}>
          <div className="rounded-2xl border p-6 w-full max-w-sm animate-[fadeIn_0.25s]" style={{ backgroundColor: T.card, borderColor: T.border }} onClick={(e) => e.stopPropagation()}>
            <h2 className="text-[15px] font-medium mb-1">稼働予定編集</h2>
            <p className="text-[11px] mb-4" style={{ color: T.textFaint }}>{staffList.find(s => s.id === editSchedule.staff_id)?.name} — {editSchedule.date}</p>
            <div className="space-y-3">
              <div className="flex flex-wrap gap-1.5">{(["scheduled", "completed", "cancelled"] as const).map(st => (<button key={st} onClick={() => setEschStatus(st)} className="px-3 py-1.5 rounded-lg text-[10px] cursor-pointer" style={{ backgroundColor: eschStatus === st ? statusColors[st] + "22" : T.cardAlt, color: eschStatus === st ? statusColors[st] : T.textMuted, border: `1px solid ${eschStatus === st ? statusColors[st] : T.border}`, fontWeight: eschStatus === st ? 700 : 400 }}>{statusLabels[st]}</button>))}</div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-[10px] mb-1" style={{ color: T.textSub }}>業務開始</label><select value={eschStart} onChange={(e) => setEschStart(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none cursor-pointer" style={inputStyle}>{TIMES_30MIN.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
                <div><label className="block text-[10px] mb-1" style={{ color: T.textSub }}>業務終了</label><select value={eschEnd} onChange={(e) => setEschEnd(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none cursor-pointer" style={inputStyle}>{TIMES_30MIN.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
              </div>
              {(() => {
                const st = staffList.find(s => s.id === editSchedule.staff_id);
                const up = st?.unit_price || editSchedule.unit_price;
                const u = calcUnits(eschStart, eschEnd);
                const comm = Math.round(up * u);
                const tr = st?.transport_fee || 0;
                return (
                <div className="rounded-xl p-3" style={{ backgroundColor: T.cardAlt }}>
                  <div className="space-y-1 text-[11px]">
                    <div className="flex justify-between"><span>業務単価 × ユニット</span><span>{fmt(up)} × {u}</span></div>
                    <div className="flex justify-between font-bold" style={{ color: "#c3a782" }}><span>合計</span><span>{fmt(comm + tr)}</span></div>
                  </div>
                </div>);
              })()}
              <div><label className="block text-[10px] mb-1" style={{ color: T.textSub }}>備考</label><input type="text" value={eschNotes} onChange={(e) => setEschNotes(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} /></div>
              <div className="flex gap-3 pt-2">
                <button onClick={updateScheduleFn} className="px-5 py-2.5 bg-gradient-to-r from-[#c3a782] to-[#b09672] text-white text-[11px] rounded-xl cursor-pointer">更新する</button>
                <button onClick={() => setEditSchedule(null)} className="px-5 py-2.5 border text-[11px] rounded-xl cursor-pointer" style={{ borderColor: T.border, color: T.textSub }}>キャンセル</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== Monthly Summary Modal ===== */}
      {showMonthly && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowMonthly(false)}>
          <div className="rounded-2xl border p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto animate-[fadeIn_0.25s]" style={{ backgroundColor: T.card, borderColor: T.border }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[16px] font-medium">📊 月次集計</h2>
              <button onClick={() => setShowMonthly(false)} className="text-[18px] cursor-pointer" style={{ color: T.textMuted, background: "none", border: "none" }}>&times;</button>
            </div>
            <div className="flex items-center gap-3 mb-4">
              <input type="month" value={monthlyMonth} onChange={(e) => setMonthlyMonth(e.target.value)} className="px-3 py-2 rounded-xl text-[12px] outline-none cursor-pointer" style={inputStyle} />
              <button onClick={fetchMonthly} className="px-4 py-2 bg-gradient-to-r from-[#c3a782] to-[#b09672] text-white text-[11px] rounded-xl cursor-pointer">集計</button>
            </div>
            {monthlyData.length === 0 ? <p className="text-[12px] text-center py-6" style={{ color: T.textFaint }}>データがありません</p> : (
              <div className="space-y-3">
                {monthlyData.map(d => (
                  <div key={d.staff_id} className="rounded-xl p-4" style={{ backgroundColor: T.cardAlt }}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[13px] font-medium">{d.name}</span>
                      <span className="text-[15px] font-bold" style={{ color: "#c3a782" }}>{fmt(d.total_payment)}</span>
                    </div>
                    <div className="flex gap-4 text-[10px]" style={{ color: T.textMuted }}>
                      <span>稼働: {d.days}日</span>
                      <span>ユニット: {d.total_units}</span>
                      <span>委託費: {fmt(d.total_commission)}</span>
                      <span>交通費: {fmt(d.total_transport)}</span>
                    </div>
                  </div>
                ))}
                <div className="rounded-xl p-4" style={{ backgroundColor: "#c3a78212", border: "1px solid #c3a78233" }}>
                  <div className="flex justify-between text-[13px] font-bold" style={{ color: "#c3a782" }}>
                    <span>月間合計</span>
                    <span>{fmt(monthlyData.reduce((s, d) => s + d.total_payment, 0))}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <style jsx global>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  );
}
