"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { useTheme } from "../../lib/theme";
import { NavMenu } from "../../lib/nav-menu";
import { jsPDF } from "jspdf";
import { useToast } from "../../lib/toast";
import { useStaffSession } from "../../lib/staff-session";

type Staff = { id: number; name: string; phone: string; email: string; role: string; address: string; transport_fee: number; id_photo_url: string; status: string; unit_price: number; pin: string; has_license: boolean; company_position: string; email_verified: boolean; email_token: string; id_doc_url: string; id_doc_name: string; id_doc_url_back: string; id_doc_name_back: string; license_number: string; oiri_bonus: number };
type Store = { id: number; name: string; invoice_number: string; company_name: string; company_address: string; company_phone: string };
type Schedule = { id: number; staff_id: number; date: string; start_time: string; end_time: string; unit_price: number; units: number; commission_fee: number; transport_fee: number; total_payment: number; status: string; notes: string; is_paid: boolean; night_premium: number; license_premium: number; oiri_amount: number; break_minutes: number };
type OiriSetting = { id: number; sales_threshold: number; count_threshold: number; bonus_amount: number; is_active: boolean };

export default function StaffPage() {
  const router = useRouter();
  const { dark, toggle, T } = useTheme();
  const toast = useToast();
  const { activeStaff, isManager, login, logout } = useStaffSession();
  const [tab, setTab] = useState<"staff" | "schedule" | "oiri" | "company" | "payroll">("staff");
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [storeInfo, setStoreInfo] = useState<Store | null>(null);

  // PIN login states (for access gate)
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState("");

  // Staff CRUD states
  const [showAdd, setShowAdd] = useState(false);
  const [addName, setAddName] = useState(""); const [addPhone, setAddPhone] = useState(""); const [addEmail, setAddEmail] = useState("");
  const [addRole, setAddRole] = useState("staff"); const [addPosition, setAddPosition] = useState("業務委託"); const [addAddress, setAddAddress] = useState(""); const [addTransport, setAddTransport] = useState("0");
  const [addUnitPrice, setAddUnitPrice] = useState("1200"); const [addPin, setAddPin] = useState(""); const [addLicense, setAddLicense] = useState(false);
  const [addLicenseNum, setAddLicenseNum] = useState(""); const [addOiriBonus, setAddOiriBonus] = useState("0");

  const [editStaff, setEditStaff] = useState<Staff | null>(null);
  const [editName, setEditName] = useState(""); const [editPhone, setEditPhone] = useState(""); const [editEmail, setEditEmail] = useState("");
  const [editRole, setEditRole] = useState("staff"); const [editPosition, setEditPosition] = useState("業務委託"); const [editAddress, setEditAddress] = useState(""); const [editTransport, setEditTransport] = useState("0");
  const [editUnitPrice, setEditUnitPrice] = useState("1200"); const [editPin, setEditPin] = useState(""); const [editLicense, setEditLicense] = useState(false);
  const [editLicenseNum, setEditLicenseNum] = useState(""); const [editOiriBonus, setEditOiriBonus] = useState("0");

  // Company states
  const [companyName, setCompanyName] = useState(""); const [companyAddress, setCompanyAddress] = useState(""); const [companyPhone, setCompanyPhone] = useState(""); const [invoiceNumber, setInvoiceNumber] = useState("");

  // Schedule states
  const [scheduleDate, setScheduleDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [schPositionFilter, setSchPositionFilter] = useState("all");
  const [showAddSchedule, setShowAddSchedule] = useState(false);
  const [schStaffId, setSchStaffId] = useState(0); const [schStart, setSchStart] = useState("10:00"); const [schEnd, setSchEnd] = useState("19:00"); const [schNotes, setSchNotes] = useState(""); const [schBreak, setSchBreak] = useState("0");
  const [editSchedule, setEditSchedule] = useState<Schedule | null>(null);
  const [eschStart, setEschStart] = useState(""); const [eschEnd, setEschEnd] = useState(""); const [eschNotes, setEschNotes] = useState(""); const [eschStatus, setEschStatus] = useState("scheduled"); const [eschBreak, setEschBreak] = useState("0");
  const [addWithholding, setAddWithholding] = useState(false);
  const [editWithholding, setEditWithholding] = useState(false);
  const [payrollYear, setPayrollYear] = useState(String(new Date().getFullYear()));
  const [payrollData, setPayrollData] = useState<{ type: string; id: number; name: string; address: string; total: number; tax: number }[]>([]);
  const [payrollLoading, setPayrollLoading] = useState(false);
  const [payrollFilter, setPayrollFilter] = useState("all");

  const fetchPayroll = async () => {
    setPayrollLoading(true);
    const year = payrollYear;
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;

    // セラピスト支払調書
    const { data: settlements } = await supabase.from("therapist_daily_settlements").select("therapist_id, total_back, invoice_deduction").gte("date", startDate).lte("date", endDate).eq("is_settled", true);
    const { data: therapists } = await supabase.from("therapists").select("id, name");
    const thMap: Record<number, { name: string; address: string; total: number; tax: number }> = {};
    (settlements || []).forEach(s => {
      if (!thMap[s.therapist_id]) {
        const th = (therapists || []).find(t => t.id === s.therapist_id);
        thMap[s.therapist_id] = { name: th?.name || "不明", address: th?.address || "", total: 0, tax: 0 };
      }
      thMap[s.therapist_id].total += s.total_back || 0;
      thMap[s.therapist_id].tax += s.invoice_deduction || 0;
    });

    // 内勤スタッフ支払調書
    const { data: staffScheds } = await supabase.from("staff_schedules").select("staff_id, total_payment").gte("date", startDate).lte("date", endDate).eq("status", "completed");
    const stMap: Record<number, { name: string; address: string; total: number }> = {};
    (staffScheds || []).forEach(s => {
      const st = staffList.find(x => x.id === s.staff_id);
      if (!st || !isBizCommission(st.company_position || "")) return;
      if (!stMap[s.staff_id]) {
        stMap[s.staff_id] = { name: st.name || "不明", address: st.address || "", total: 0 };
      }
      stMap[s.staff_id].total += s.total_payment || 0;
    });

    const result: typeof payrollData = [];
    Object.entries(thMap).forEach(([id, d]) => result.push({ type: "セラピスト", id: Number(id), name: d.name, address: d.address, total: d.total, tax: d.tax }));
    Object.entries(stMap).forEach(([id, d]) => result.push({ type: "内勤スタッフ", id: Number(id), name: d.name, address: d.address, total: d.total, tax: 0 }));
    result.sort((a, b) => b.total - a.total);
    setPayrollData(result);
    setPayrollLoading(false);
  };

  const downloadPayrollPDF = (row: typeof payrollData[0]) => {
    const store = storeInfo;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>支払調書_${payrollYear}_${row.name}</title><style>body{font-family:'Hiragino Sans','Yu Gothic','Meiryo',sans-serif;max-width:700px;margin:40px auto;padding:30px;color:#333}h1{text-align:center;font-size:22px;border-bottom:3px double #333;padding-bottom:10px;margin-bottom:5px}h2{text-align:center;font-size:12px;color:#888;font-weight:normal;margin-bottom:30px}table{width:100%;border-collapse:collapse;margin:20px 0}td,th{border:1px solid #ccc;padding:10px 14px;font-size:13px}th{background:#f5f0e8;text-align:left;width:40%}.right{text-align:right}.total-row{background:#f9f6f0;font-weight:bold;font-size:15px}.section{margin-top:30px;padding-top:15px;border-top:1px solid #ddd}.company{font-size:11px;line-height:2;color:#555}@media print{body{margin:0;padding:20px}}</style></head><body>
    <h1>支払調書</h1>
    <h2>${payrollYear}年1月1日 〜 ${payrollYear}年12月31日</h2>
    <table>
    <tr><th>支払先（氏名）</th><td>${row.name}</td></tr>
    ${row.address ? `<tr><th>住所</th><td>${row.address}</td></tr>` : ""}
    <tr><th>区分</th><td>${row.type}</td></tr>
    </table>
    <table>
    <tr><th>項目</th><th class="right">金額</th></tr>
    <tr><td>支払金額</td><td class="right">¥${row.total.toLocaleString()}</td></tr>
    ${row.tax > 0 ? `<tr><td>源泉徴収税額</td><td class="right" style="color:#c45555">¥${row.tax.toLocaleString()}</td></tr>` : ""}
    <tr class="total-row"><td>差引支払額</td><td class="right">¥${(row.total - row.tax).toLocaleString()}</td></tr>
    </table>
    <div class="section"><p style="font-size:12px;color:#888">支払者</p><div class="company"><p><strong>${store?.company_name || ""}</strong></p><p>${store?.company_address || ""}</p><p>TEL: ${store?.company_phone || ""}</p>${store?.invoice_number ? `<p>適格事業者番号: ${store.invoice_number}</p>` : ""}</div></div>
    </body></html>`);
    w.document.close();
  };

  const downloadAllPayrollPDF = () => {
    payrollData.forEach(row => downloadPayrollPDF(row));
  };

  const [showMonthly, setShowMonthly] = useState(false);
  const [monthlyData, setMonthlyData] = useState<{ staff_id: number; name: string; days: number; total_units: number; total_commission: number; total_transport: number; total_night: number; total_license: number; total_oiri: number; total_payment: number }[]>([]);
  const [monthlyMonth, setMonthlyMonth] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; });

  // Oiri states
  const [oiriSettings, setOiriSettings] = useState<OiriSetting | null>(null);
  const [oiriSales, setOiriSales] = useState(""); const [oiriCount, setOiriCount] = useState(""); const [oiriBonus, setOiriBonus] = useState("");

  const isBizCommission = (pos: string) => pos === "業務委託";

  const sendStaffConfirmEmail = async (s: Staff) => {
    let token = s.email_token;
    if (!token) { token = crypto.randomUUID(); await supabase.from("staff").update({ email_token: token }).eq("id", s.id); }
    const confirmUrl = `${window.location.origin}/confirm-staff-email?token=${token}`;
    const subject = encodeURIComponent("【チョップ】メールアドレス確認のお願い");
    const body = encodeURIComponent(`${s.name} 様\n\nチョップからのメールアドレス確認です。\n以下のリンクをクリックして確認を完了してください。\n\n${confirmUrl}\n\n※このリンクはお一人様専用です。\n\nよろしくお願いいたします。\nチョップ`);
    window.open(`https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(s.email)}&su=${subject}&body=${body}`, "_blank");
  };

  const inputStyle = { backgroundColor: T.cardAlt, color: T.text, border: "1px solid transparent" };
  const fmt = (n: number) => "¥" + (n || 0).toLocaleString();

  const TIMES_15MIN: string[] = [];
  for (let h = 6; h <= 23; h++) { TIMES_15MIN.push(`${String(h).padStart(2, "0")}:00`); TIMES_15MIN.push(`${String(h).padStart(2, "0")}:15`); TIMES_15MIN.push(`${String(h).padStart(2, "0")}:30`); TIMES_15MIN.push(`${String(h).padStart(2, "0")}:45`); }
  for (let h = 0; h <= 5; h++) { TIMES_15MIN.push(`${String(h).padStart(2, "0")}:00`); TIMES_15MIN.push(`${String(h).padStart(2, "0")}:15`); TIMES_15MIN.push(`${String(h).padStart(2, "0")}:30`); TIMES_15MIN.push(`${String(h).padStart(2, "0")}:45`); }

  // 深夜帯(0:00-5:00)のユニット数を計算
  const calcNightUnits = (start: string, end: string) => {
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    // 24時間に正規化（0-5は24-29として扱う）
    const sMin = (sh < 6 ? sh + 24 : sh) * 60 + sm;
    const eMin = (eh < 6 ? eh + 24 : eh) * 60 + em;
    // 深夜帯: 24:00(1440) ～ 29:00(1740)
    const nightStart = 24 * 60;
    const nightEnd = 29 * 60;
    const overlapStart = Math.max(sMin, nightStart);
    const overlapEnd = Math.min(eMin, nightEnd);
    if (overlapStart >= overlapEnd) return 0;
    const diff = overlapEnd - overlapStart;
    return Math.max(0, Math.floor(diff / 15) * 0.25);
  };

  const calcUnits = (start: string, end: string, breakMin: number = 0) => {
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    const sMin = (sh < 6 ? sh + 24 : sh) * 60 + sm;
    const eMin = (eh < 6 ? eh + 24 : eh) * 60 + em;
    const diff = eMin - sMin - breakMin;
    return Math.max(0, Math.floor(diff / 15) * 0.25);
  };

  const calcFullPayment = (start: string, end: string, staff: Staff | undefined, breakMin: number = 0) => {
    const units = calcUnits(start, end, breakMin);
    const nightUnits = calcNightUnits(start, end);
    const biz = isBizCommission(staff?.company_position || "業務委託");
    const up = staff?.unit_price || 1200;
    const commission = biz ? Math.round(up * units) : 0;
    const nightPremium = biz ? Math.round(100 * nightUnits) : 0;
    const licensePremium = biz && staff?.has_license ? Math.round(50 * units) : 0;
    const transport = staff?.transport_fee || 0;
    const total = commission + nightPremium + licensePremium + transport;
    return { units, nightUnits, commission, nightPremium, licensePremium, transport, total };
  };

  const fetchData = useCallback(async () => {
    const { data: s } = await supabase.from("staff").select("*").order("id"); if (s) setStaffList(s);
    const { data: st } = await supabase.from("stores").select("*").limit(1).single();
    if (st) { setStoreInfo(st); setCompanyName(st.company_name || ""); setCompanyAddress(st.company_address || ""); setCompanyPhone(st.company_phone || ""); setInvoiceNumber(st.invoice_number || ""); }
    const { data: oi } = await supabase.from("oiri_settings").select("*").eq("is_active", true).limit(1).single();
    if (oi) { setOiriSettings(oi); setOiriSales(String(oi.sales_threshold)); setOiriCount(String(oi.count_threshold)); setOiriBonus(String(oi.bonus_amount)); }
  }, []);

  const fetchSchedules = useCallback(async () => {
    const { data: sch } = await supabase.from("staff_schedules").select("*").eq("date", scheduleDate).order("start_time"); if (sch) setSchedules(sch);
  }, [scheduleDate]);

  useEffect(() => { const check = async () => { const { data: { user } } = await supabase.auth.getUser(); if (!user) router.push("/"); }; check(); fetchData(); }, [router, fetchData]);
  useEffect(() => { fetchSchedules(); }, [fetchSchedules]);

  // Staff CRUD
  const addStaffFn = async () => {
    if (!addName.trim()) return;
    await supabase.from("staff").insert({ name: addName.trim(), phone: addPhone.trim(), email: addEmail.trim(), role: addRole, company_position: addPosition, address: addAddress.trim(), transport_fee: parseInt(addTransport) || 0, unit_price: parseInt(addUnitPrice) || 1200, pin: addPin.trim(), has_license: addLicenseNum.trim().length === 12 ? true : addLicense, license_number: addLicenseNum.trim(), oiri_bonus: parseInt(addOiriBonus) || 0, has_withholding: addWithholding, email_verified: false, email_token: crypto.randomUUID(), status: "active" });
    toast.show("スタッフを登録しました", "success");
    setShowAdd(false); setAddName(""); setAddPhone(""); setAddEmail(""); setAddRole("staff"); setAddPosition("業務委託"); setAddAddress(""); setAddTransport("0"); setAddUnitPrice("1200"); setAddPin(""); setAddLicense(false); setAddLicenseNum(""); setAddOiriBonus("0");
    fetchData();
  };
  const updateStaffFn = async () => {
    if (!editStaff) return;
    await supabase.from("staff").update({ name: editName.trim(), phone: editPhone.trim(), email: editEmail.trim(), role: editRole, company_position: editPosition, address: editAddress.trim(), transport_fee: parseInt(editTransport) || 0, unit_price: parseInt(editUnitPrice) || 1200, pin: editPin.trim(), has_license: editLicenseNum.trim().length === 12 ? true : editLicense, license_number: editLicenseNum.trim(), oiri_bonus: parseInt(editOiriBonus) || 0, has_withholding: editWithholding, ...(editEmail.trim() !== (editStaff?.email || "") ? { email_verified: false, email_token: crypto.randomUUID() } : {}) }).eq("id", editStaff.id);
    toast.show("スタッフ情報を更新しました", "success"); setEditStaff(null); fetchData();
  };
  const deleteStaffFn = async (id: number, name: string) => { if (!confirm(`${name}を削除しますか？`)) return; await supabase.from("staff").delete().eq("id", id); toast.show("スタッフを削除しました", "info"); fetchData(); };
  const saveCompany = async () => { if (!storeInfo) return; await supabase.from("stores").update({ company_name: companyName.trim(), company_address: companyAddress.trim(), company_phone: companyPhone.trim(), invoice_number: invoiceNumber.trim() }).eq("id", storeInfo.id); toast.show("会社情報を更新しました", "success"); fetchData(); };
  const saveOiri = async () => {
    const data = { sales_threshold: parseInt(oiriSales) || 0, count_threshold: parseInt(oiriCount) || 0, bonus_amount: parseInt(oiriBonus) || 1000 };
    if (oiriSettings) { await supabase.from("oiri_settings").update(data).eq("id", oiriSettings.id); }
    else { await supabase.from("oiri_settings").insert({ ...data, is_active: true }); }
    toast.show("大入り設定を保存しました", "success"); fetchData();
  };

  // Schedule CRUD
  const addScheduleFn = async () => {
    if (!schStaffId) return;
    const staff = staffList.find(s => s.id === schStaffId);
    const calc = calcFullPayment(schStart, schEnd, staff, parseInt(schBreak) || 0);
    await supabase.from("staff_schedules").insert({ staff_id: schStaffId, date: scheduleDate, start_time: schStart, end_time: schEnd, unit_price: staff?.unit_price || 1200, units: calc.units, commission_fee: calc.commission, transport_fee: calc.transport, night_premium: calc.nightPremium, license_premium: calc.licensePremium, total_payment: calc.total, status: "scheduled", notes: schNotes.trim(), break_minutes: parseInt(schBreak) || 0 });
    toast.show("稼働予定を登録しました", "success"); setShowAddSchedule(false); setSchStaffId(0); setSchStart("10:00"); setSchEnd("19:00"); setSchNotes(""); setSchBreak("0"); fetchSchedules();
  };
  const updateScheduleFn = async () => {
    if (!editSchedule) return;
    const staff = staffList.find(s => s.id === editSchedule.staff_id);
    const calc = calcFullPayment(eschStart, eschEnd, staff, parseInt(eschBreak) || 0);
    await supabase.from("staff_schedules").update({ start_time: eschStart, end_time: eschEnd, units: calc.units, commission_fee: calc.commission, transport_fee: calc.transport, night_premium: calc.nightPremium, license_premium: calc.licensePremium, total_payment: calc.total, status: eschStatus, notes: eschNotes.trim(), break_minutes: parseInt(eschBreak) || 0 }).eq("id", editSchedule.id);
    toast.show("稼働予定を更新しました", "success"); setEditSchedule(null); fetchSchedules();
  };
  const markCompleted = async (sch: Schedule) => { await supabase.from("staff_schedules").update({ status: "completed" }).eq("id", sch.id); toast.show("業務完了を記録しました", "success"); fetchSchedules(); };
  const deleteScheduleFn = async (id: number) => { if (!confirm("この稼働予定を削除しますか？")) return; await supabase.from("staff_schedules").delete().eq("id", id); toast.show("稼働予定を削除しました", "info"); fetchSchedules(); };

  const fetchMonthly = async () => {
    const [y, m] = monthlyMonth.split("-").map(Number);
    const startDate = `${y}-${String(m).padStart(2, "0")}-01`;
    const endDate = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
    const { data } = await supabase.from("staff_schedules").select("*").gte("date", startDate).lt("date", endDate);
    if (!data) return;
    const map = new Map<number, { days: number; total_units: number; total_commission: number; total_transport: number; total_night: number; total_license: number; total_oiri: number; total_payment: number }>();
    for (const d of data) {
      const cur = map.get(d.staff_id) || { days: 0, total_units: 0, total_commission: 0, total_transport: 0, total_night: 0, total_license: 0, total_oiri: 0, total_payment: 0 };
      cur.days++; cur.total_units += d.units; cur.total_commission += d.commission_fee; cur.total_transport += d.transport_fee;
      cur.total_night += (d.night_premium || 0); cur.total_license += (d.license_premium || 0); cur.total_oiri += (d.oiri_amount || 0);
      cur.total_payment += d.total_payment + (d.oiri_amount || 0);
      map.set(d.staff_id, cur);
    }
    setMonthlyData(Array.from(map.entries()).map(([sid, vals]) => ({ staff_id: sid, name: staffList.find(s => s.id === sid)?.name || "不明", ...vals })));
    setShowMonthly(true);
  };

  const openPaymentStatement = (sch: Schedule) => {
    const staff = staffList.find(s => s.id === sch.staff_id); const store = storeInfo;
    const w = window.open("", "_blank"); if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>支払明細書</title><style>body{font-family:'Hiragino Sans','Yu Gothic',sans-serif;max-width:700px;margin:40px auto;padding:20px;color:#333}h1{text-align:center;font-size:20px;border-bottom:3px double #333;padding-bottom:10px;margin-bottom:30px}table{width:100%;border-collapse:collapse;margin:15px 0}td,th{border:1px solid #ccc;padding:8px 12px;font-size:13px}th{background:#f5f0e8;text-align:left;width:40%}.right{text-align:right}.total{font-size:16px;font-weight:bold;color:#c3a782}.header-info{display:flex;justify-content:space-between;margin-bottom:20px;font-size:12px}.company{text-align:right;font-size:11px;line-height:1.8}.sign{margin-top:50px;display:flex;justify-content:space-between}.sign-box{border-top:1px solid #333;width:200px;text-align:center;padding-top:5px;font-size:11px}@media print{body{margin:0;padding:20px}}</style></head><body>
    <h1>支払明細書（業務委託費）</h1><div class="header-info"><div><p><strong>支払先：</strong>${staff?.name||""} 様</p><p><strong>業務実施日：</strong>${sch.date}</p><p><strong>業務内容：</strong>店舗管理・受付業務一式</p></div><div class="company"><p><strong>${store?.company_name||""}</strong></p><p>${store?.company_address||""}</p><p>TEL: ${store?.company_phone||""}</p>${store?.invoice_number?`<p>適格事業者番号: ${store.invoice_number}</p>`:""}</div></div>
    <table><tr><th>項目</th><th class="right">金額</th><th>備考</th></tr>
    <tr><td>業務委託費</td><td class="right">&yen;${sch.commission_fee.toLocaleString()}</td><td style="font-size:11px;color:#888">業務単価 &yen;${sch.unit_price.toLocaleString()} × ${sch.units}ユニット</td></tr>
    ${(sch.night_premium||0)>0?`<tr><td>深夜手当</td><td class="right">&yen;${sch.night_premium.toLocaleString()}</td><td style="font-size:11px;color:#888">24:00〜5:00 +¥100/ユニット</td></tr>`:""}
    ${(sch.license_premium||0)>0?`<tr><td>免許手当</td><td class="right">&yen;${sch.license_premium.toLocaleString()}</td><td style="font-size:11px;color:#888">+¥50/ユニット</td></tr>`:""}
    ${sch.transport_fee>0?`<tr><td>交通費（非課税）</td><td class="right">&yen;${sch.transport_fee.toLocaleString()}</td><td style="font-size:11px;color:#888">実費精算</td></tr>`:""}
    <tr style="background:#f9f6f0"><td><strong>合計支払額</strong></td><td class="right total">&yen;${sch.total_payment.toLocaleString()}</td><td></td></tr></table>
    <div class="sign"><div class="sign-box">支払者（${store?.company_name||""}）</div><div class="sign-box">受領者（${staff?.name||""} 様）</div></div></body></html>`);
    w.document.close();
  };

  const roleColors: Record<string, string> = { owner: "#c3a782", manager: "#85a8c4", leader: "#a855f7", staff: "#22c55e" };
  const roleLabels: Record<string, string> = { owner: "オーナー", manager: "店長", leader: "責任者", staff: "スタッフ" };
  const POSITIONS = ["社長", "経営責任者", "社員", "契約社員", "業務委託"];
  const statusColors: Record<string, string> = { scheduled: "#85a8c4", completed: "#22c55e", cancelled: "#c45555" };
  const statusLabels: Record<string, string> = { scheduled: "予定", completed: "完了", cancelled: "キャンセル" };

  const prevDay = () => { const d = new Date(scheduleDate); d.setDate(d.getDate() - 1); setScheduleDate(d.toISOString().split("T")[0]); };
  const nextDay = () => { const d = new Date(scheduleDate); d.setDate(d.getDate() + 1); setScheduleDate(d.toISOString().split("T")[0]); };
  const dateDisplay = (() => { const d = new Date(scheduleDate + "T00:00:00"); const days = ["日", "月", "火", "水", "木", "金", "土"]; return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日（${days[d.getDay()]}）`; })();

  // ★ アクセスゲート: このページ専用の認証（毎回manager/owner PINが必要）
  const [pageAuthed, setPageAuthed] = useState(false);
  const [pageAuthName, setPageAuthName] = useState("");

  if (!pageAuthed) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: T.bg, color: T.text }}>
        <div className="w-full max-w-[320px] p-6 rounded-2xl" style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}>
          <h2 className="text-[16px] font-medium text-center mb-1">🔒 内勤スタッフ設定</h2>
          <p className="text-[11px] text-center mb-5" style={{ color: T.textFaint }}>管理者PINコード（4桁）を入力</p>
          <div className="flex justify-center gap-2 mb-4">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="w-12 h-14 rounded-xl flex items-center justify-center text-[22px] font-bold" style={{ backgroundColor: T.cardAlt, color: pinInput[i] ? T.text : T.textFaint, border: `2px solid ${pinInput.length === i ? "#c3a782" : T.border}` }}>
                {pinInput[i] ? "●" : ""}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2 mb-3">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, null, 0, "del"].map((n, i) => {
              if (n === null) return <div key={i} />;
              return (
                <button key={i} onClick={async () => {
                  if (n === "del") { setPinInput(prev => prev.slice(0, -1)); setPinError(""); return; }
                  const next = pinInput + String(n);
                  if (next.length > 4) return;
                  setPinInput(next); setPinError("");
                  if (next.length === 4) {
                    const { data } = await supabase.from("staff").select("id,name,role").eq("pin", next).eq("status", "active").maybeSingle();
                    if (!data) { setPinError("PINが一致しません"); setPinInput(""); }
                    else if (data.role !== "owner" && data.role !== "manager" && data.role !== "leader") { setPinError("責任者以上の権限が必要です"); setPinInput(""); }
                    else { setPageAuthed(true); setPageAuthName(data.name); login(next); }
                  }
                }} className="h-12 rounded-xl text-[16px] font-medium cursor-pointer" style={{ backgroundColor: T.cardAlt, color: n === "del" ? "#c45555" : T.text, border: `1px solid ${T.border}` }}>
                  {n === "del" ? "⌫" : n}
                </button>
              );
            })}
          </div>
          {pinError && <p className="text-[11px] text-center mb-2" style={{ color: "#c45555" }}>{pinError}</p>}
          <button onClick={() => router.push("/room-assignments")} className="w-full mt-2 py-2 text-[11px] rounded-xl cursor-pointer border" style={{ borderColor: T.border, color: T.textSub }}>← 部屋割りに戻る</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: T.bg, color: T.text }}>
      <div className="h-[64px] backdrop-blur-xl border-b flex items-center justify-between px-6" style={{ backgroundColor: dark ? T.card + "cc" : "rgba(255,255,255,0.8)", borderColor: T.border }}>
        <div className="flex items-center gap-4">
          <NavMenu T={T} dark={dark} />
          <h1 className="text-[18px] font-medium">内勤スタッフ設定</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={toggle} className="px-3 py-1.5 text-[10px] rounded-lg cursor-pointer border" style={{ borderColor: T.border, color: T.textSub }}>{dark ? "☀️ ライト" : "🌙 ダーク"}</button>
          <button onClick={() => { logout(); setPageAuthed(false); }} className="px-3 py-1.5 text-[10px] rounded-lg cursor-pointer" style={{ backgroundColor: "#c3a78222", color: "#c3a782", border: "1px solid #c3a78244" }}>👤 {pageAuthName} ログアウト</button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-6">
        <div className="flex gap-2 mb-6 flex-wrap">
          {(["staff", "schedule", "oiri", "company", "payroll"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} className="px-4 py-2 rounded-xl text-[12px] cursor-pointer" style={{ backgroundColor: tab === t ? "#c3a78222" : T.cardAlt, color: tab === t ? "#c3a782" : T.textMuted, border: `1px solid ${tab === t ? "#c3a782" : T.border}`, fontWeight: tab === t ? 700 : 400 }}>
              {t === "staff" ? "👥 スタッフ管理" : t === "schedule" ? "📅 業務稼働予定" : t === "oiri" ? "🎉 大入り設定" : t === "company" ? "🏢 会社情報" : "📑 支払調書"}
            </button>
          ))}
        </div>

        {/* ========== Tab 1: Staff Management ========== */}
        {tab === "staff" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-[13px]" style={{ color: T.textMuted }}>登録済み: {staffList.length}名</p>
              <button onClick={() => { setShowAdd(true); setAddLicense(false); }} className="px-4 py-2 bg-gradient-to-r from-[#c3a782] to-[#b09672] text-white text-[11px] rounded-xl cursor-pointer">+ スタッフ追加</button>
            </div>
            {staffList.map(s => (
              <div key={s.id} className="rounded-xl border p-4 flex items-center justify-between" style={{ backgroundColor: T.card, borderColor: T.border }}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-[14px] text-white font-medium" style={{ backgroundColor: roleColors[s.role] || "#888" }}>{s.name.charAt(0)}</div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-medium">{s.name}</span>
                      <span className="text-[9px] px-2 py-0.5 rounded" style={{ backgroundColor: (roleColors[s.role] || "#888") + "22", color: roleColors[s.role] || "#888" }}>{roleLabels[s.role] || s.role}</span>
                      {s.company_position && <span className="text-[9px] px-2 py-0.5 rounded" style={{ backgroundColor: "#88878018", color: "#888780" }}>{s.company_position}</span>}
                      {s.has_license && <span className="text-[9px] px-2 py-0.5 rounded" style={{ backgroundColor: "#3b82f622", color: "#3b82f6" }}>🚗 免許</span>}
                    </div>
                    <div className="flex items-center gap-3 text-[10px]" style={{ color: T.textMuted }}>
                      {s.phone && <span>📞 {s.phone}</span>}
                      {s.email && <span className="flex items-center gap-1">✉️ {s.email} {s.email_verified ? <span style={{ color: "#22c55e", fontSize: 8 }}>✅</span> : <span style={{ color: "#f59e0b", fontSize: 8 }}>⏳</span>}</span>}
                      {isBizCommission(s.company_position) && <span>💰 {fmt(s.unit_price || 1200)}/u</span>}
                      {s.oiri_bonus > 0 && <span style={{ color: "#f59e0b" }}>🎉 {fmt(s.oiri_bonus)}</span>}
                      {s.pin ? <span style={{ color: "#22c55e" }}>🔑 設定済</span> : <span style={{ color: "#c45555" }}>🔑 未設定</span>}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  {s.email && !s.email_verified && <button onClick={() => sendStaffConfirmEmail(s)} className="text-[10px] px-3 py-1.5 rounded-lg cursor-pointer" style={{ color: "#3b82f6", backgroundColor: "#3b82f618" }}>📧 確認</button>}
                  <button onClick={() => { setEditStaff(s); setEditName(s.name); setEditPhone(s.phone||""); setEditEmail(s.email||""); setEditRole(s.role); setEditPosition(s.company_position||"業務委託"); setEditAddress(s.address||""); setEditTransport(String(s.transport_fee||0)); setEditUnitPrice(String(s.unit_price||1200)); setEditPin(s.pin||""); setEditLicense(!!s.has_license); setEditLicenseNum(s.license_number||""); setEditOiriBonus(String(s.oiri_bonus||0)); setEditWithholding(!!s.has_withholding); }} className="text-[10px] px-3 py-1.5 rounded-lg cursor-pointer border" style={{ borderColor: T.border, color: T.textSub }}>編集</button>
                  <button onClick={() => deleteStaffFn(s.id, s.name)} className="text-[10px] px-3 py-1.5 rounded-lg cursor-pointer" style={{ backgroundColor: "#c4555512", color: "#c45555" }}>削除</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ========== Tab 2: Schedule ========== */}
        {tab === "schedule" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button onClick={prevDay} className="p-1.5 rounded-lg cursor-pointer" style={{ color: T.textSub }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="15 18 9 12 15 6"/></svg></button>
                <button onClick={() => setScheduleDate(new Date().toISOString().split("T")[0])} className="px-3 py-1 text-[11px] border rounded-lg cursor-pointer" style={{ borderColor: T.border, color: T.textSub }}>今日</button>
                <span className="text-[14px] font-medium">{dateDisplay}</span>
                <input type="date" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)} className="text-[12px] border rounded-lg px-2 py-1 outline-none cursor-pointer" style={{ borderColor: T.border, color: T.textSub, backgroundColor: T.card }} />
                <button onClick={nextDay} className="p-1.5 rounded-lg cursor-pointer" style={{ color: T.textSub }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="9 18 15 12 9 6"/></svg></button>
              </div>
              <div className="flex gap-2">
                <button onClick={fetchMonthly} className="px-3 py-2 border text-[11px] rounded-xl cursor-pointer" style={{ borderColor: "#c3a78244", color: "#c3a782" }}>📊 月次集計</button>
                <button onClick={() => { setShowAddSchedule(true); setSchStaffId(0); setSchStart("10:00"); setSchEnd("19:00"); setSchNotes(""); setSchBreak("0"); }} className="px-4 py-2 bg-gradient-to-r from-[#c3a782] to-[#b09672] text-white text-[11px] rounded-xl cursor-pointer">+ 稼働追加</button>
              </div>
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {[["all", "全て"], ["業務委託", "業務委託"], ["社長", "社長"], ["経営責任者", "経営責任者"], ["社員", "社員"], ["契約社員", "契約社員"]].map(([key, label]) => { const count = key === "all" ? schedules.length : schedules.filter(x => { const st = staffList.find(s => s.id === x.staff_id); return (st?.company_position || "業務委託") === key; }).length; return (
                <button key={key} onClick={() => setSchPositionFilter(key)} className="px-2.5 py-1.5 rounded-lg text-[10px] cursor-pointer border" style={{ borderColor: schPositionFilter === key ? "#c3a782" : T.border, backgroundColor: schPositionFilter === key ? "#c3a78218" : "transparent", color: schPositionFilter === key ? "#c3a782" : T.textMuted, fontWeight: schPositionFilter === key ? 600 : 400 }}>{label} {count > 0 ? count : ""}</button>
              ); })}
            </div>
            {(() => { const filtered = schPositionFilter === "all" ? schedules : schedules.filter(x => { const st = staffList.find(s => s.id === x.staff_id); return (st?.company_position || "業務委託") === schPositionFilter; }); return filtered.length === 0 ? <div className="rounded-xl border p-8 text-center" style={{ backgroundColor: T.card, borderColor: T.border }}><p className="text-[13px]" style={{ color: T.textFaint }}>この日の稼働予定はありません</p></div> : (
              <div className="space-y-3">{filtered.map(sch => { const staff = staffList.find(s => s.id === sch.staff_id); const biz = isBizCommission(staff?.company_position || "業務委託"); return (
                <div key={sch.id} className="rounded-xl border p-4" style={{ backgroundColor: T.card, borderColor: T.border }}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-[13px] text-white font-medium" style={{ backgroundColor: roleColors[staff?.role||"staff"]||"#888" }}>{staff?.name?.charAt(0)||"?"}</div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-medium">{staff?.name||"不明"}</span>
                          <span className="text-[9px] px-2 py-0.5 rounded" style={{ backgroundColor: statusColors[sch.status]+"22", color: statusColors[sch.status] }}>{statusLabels[sch.status]}</span>
                          {staff?.has_license && <span className="text-[8px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "#3b82f618", color: "#3b82f6" }}>🚗</span>}
                          {!biz && <span className="text-[8px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "#88878018", color: "#888780" }}>{staff?.company_position}</span>}
                        </div>
                        <p className="text-[10px]" style={{ color: T.textMuted }}>⏰ {sch.start_time}〜{sch.end_time}（{sch.units}u）{(sch.break_minutes||0) > 0 && <span style={{ color: "#f59e0b" }}> 休憩{sch.break_minutes}分</span>}</p>
                      </div>
                    </div>
                    {biz && <div className="text-right">
                      <p className="text-[15px] font-bold" style={{ color: "#c3a782" }}>{fmt(sch.total_payment)}</p>
                      <div className="text-[8px]" style={{ color: T.textMuted }}>
                        <span>委託{fmt(sch.commission_fee)}</span>
                        {(sch.night_premium||0)>0 && <span> 🌙{fmt(sch.night_premium)}</span>}
                        {(sch.license_premium||0)>0 && <span> 🚗{fmt(sch.license_premium)}</span>}
                        {sch.transport_fee>0 && <span> 交{fmt(sch.transport_fee)}</span>}
                      </div>
                    </div>}
                  </div>
                  <div className="flex gap-2">
                    {sch.status === "scheduled" && <button onClick={() => markCompleted(sch)} className="px-3 py-1.5 rounded-lg text-[10px] cursor-pointer" style={{ backgroundColor: "#22c55e18", color: "#22c55e", border: "1px solid #22c55e44" }}>✅ 業務完了</button>}
                    {biz && <button onClick={() => openPaymentStatement(sch)} className="px-3 py-1.5 rounded-lg text-[10px] cursor-pointer" style={{ backgroundColor: "#85a8c418", color: "#85a8c4", border: "1px solid #85a8c444" }}>📄 支払明細書</button>}
                    <button onClick={() => { setEditSchedule(sch); setEschStart(sch.start_time); setEschEnd(sch.end_time); setEschNotes(sch.notes||""); setEschStatus(sch.status); setEschBreak(String(sch.break_minutes||0)); }} className="px-3 py-1.5 rounded-lg text-[10px] cursor-pointer border" style={{ borderColor: T.border, color: T.textSub }}>編集</button>
                    <button onClick={() => deleteScheduleFn(sch.id)} className="px-3 py-1.5 rounded-lg text-[10px] cursor-pointer" style={{ backgroundColor: "#c4555512", color: "#c45555" }}>削除</button>
                  </div>
                </div>); })}</div>
            ); })()}
            {schedules.length > 0 && (() => { const bizSchedules = schedules.filter(x => { const st = staffList.find(s => s.id === x.staff_id); return isBizCommission(st?.company_position || "業務委託"); }); return (
              <div className="rounded-xl p-4" style={{ backgroundColor: "#c3a78212", border: "1px solid #c3a78233" }}>
                <div className="flex justify-between flex-wrap gap-2 text-[12px]">
                  <span style={{ color: T.textSub }}>稼働: <strong>{schedules.length}名</strong>（委託: {bizSchedules.length}名）</span>
                  {bizSchedules.length > 0 && <span style={{ color: T.textSub }}>委託費: <strong>{fmt(bizSchedules.reduce((s,x)=>s+x.commission_fee,0))}</strong></span>}
                  {bizSchedules.reduce((s,x)=>s+(x.night_premium||0),0) > 0 && <span style={{ color: T.textSub }}>🌙深夜: <strong>{fmt(bizSchedules.reduce((s,x)=>s+(x.night_premium||0),0))}</strong></span>}
                  {bizSchedules.length > 0 && <span style={{ color: "#c3a782" }}>合計: <strong>{fmt(bizSchedules.reduce((s,x)=>s+x.total_payment,0))}</strong></span>}
                </div>
              </div>); })()}
          </div>
        )}

        {/* ========== Tab 3: Oiri Settings ========== */}
        {tab === "oiri" && (
          <div className="space-y-4">
            <div className="rounded-xl border p-6" style={{ backgroundColor: T.card, borderColor: T.border }}>
              <h2 className="text-[15px] font-medium mb-4">🎉 大入り設定</h2>
              <p className="text-[11px] mb-4" style={{ color: T.textFaint }}>売上と本数が条件を超えた日に、Amazonギフトカードとして自動判定されます</p>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>売上条件（以上）</label><input type="text" inputMode="numeric" value={oiriSales} onChange={(e) => setOiriSales(e.target.value.replace(/[^0-9]/g, ""))} placeholder="150000" className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} /><p className="text-[9px] mt-1" style={{ color: T.textFaint }}>{parseInt(oiriSales) > 0 ? `${fmt(parseInt(oiriSales))} 以上` : "未設定"}</p></div>
                  <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>本数条件（以上）</label><input type="text" inputMode="numeric" value={oiriCount} onChange={(e) => setOiriCount(e.target.value.replace(/[^0-9]/g, ""))} placeholder="10" className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} /><p className="text-[9px] mt-1" style={{ color: T.textFaint }}>{parseInt(oiriCount) > 0 ? `${oiriCount}本 以上` : "未設定"}</p></div>
                </div>
                <div className="rounded-xl p-4" style={{ backgroundColor: T.cardAlt }}>
                  <p className="text-[11px]" style={{ color: T.textSub }}>現在の設定:</p>
                  <p className="text-[13px] font-medium mt-1" style={{ color: "#c3a782" }}>売上 {fmt(parseInt(oiriSales)||0)} 以上 かつ {oiriCount||0}本以上</p>
                  <p className="text-[9px] mt-1" style={{ color: T.textFaint }}>※ 金額はスタッフごとに個別設定（スタッフ編集画面の「🎉 大入り金額」）</p>
                </div>
                <button onClick={saveOiri} className="px-6 py-2.5 bg-gradient-to-r from-[#c3a782] to-[#b09672] text-white text-[11px] rounded-xl cursor-pointer">保存する</button>
              </div>
            </div>
          </div>
        )}

        {/* ========== Tab 4: Company Info ========== */}
        {tab === "payroll" && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <select value={payrollYear} onChange={(e) => setPayrollYear(e.target.value)} className="px-3 py-2 rounded-xl text-[12px] outline-none cursor-pointer border" style={{ backgroundColor: T.card, borderColor: T.border, color: T.text }}>
                {[...Array(5)].map((_, i) => { const y = new Date().getFullYear() - i; return <option key={y} value={String(y)}>{y}年</option>; })}
              </select>
              <button onClick={fetchPayroll} className="px-4 py-2 bg-gradient-to-r from-[#c3a782] to-[#b09672] text-white text-[11px] rounded-xl cursor-pointer">{payrollLoading ? "読込中..." : "📑 支払調書を生成"}</button>
              {payrollData.length > 0 && <button onClick={downloadAllPayrollPDF} className="px-4 py-2 border text-[11px] rounded-xl cursor-pointer" style={{ borderColor: "#85a8c444", color: "#85a8c4" }}>📥 全員分ダウンロード</button>}
            </div>
            {payrollData.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <p className="text-[11px]" style={{ color: T.textMuted }}>{payrollYear}年 — {payrollData.length}名</p>
                  {["all", "セラピスト", "内勤スタッフ"].map(f => (
                    <button key={f} onClick={() => setPayrollFilter(f)} className="px-2.5 py-1 rounded-lg text-[10px] cursor-pointer" style={{ backgroundColor: payrollFilter === f ? (f === "セラピスト" ? "#c3a78222" : f === "内勤スタッフ" ? "#85a8c422" : T.cardAlt) : T.cardAlt, color: payrollFilter === f ? (f === "セラピスト" ? "#c3a782" : f === "内勤スタッフ" ? "#85a8c4" : T.text) : T.textMuted, border: `1px solid ${payrollFilter === f ? (f === "セラピスト" ? "#c3a78244" : f === "内勤スタッフ" ? "#85a8c444" : T.border) : T.border}` }}>{f === "all" ? "全て" : f}</button>
                  ))}
                </div>
                {payrollData.filter(r => payrollFilter === "all" || r.type === payrollFilter).map((row, i) => (
                  <div key={i} className="rounded-xl p-4 flex items-center justify-between" style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] px-2 py-0.5 rounded" style={{ backgroundColor: row.type === "セラピスト" ? "#c3a78222" : "#85a8c422", color: row.type === "セラピスト" ? "#c3a782" : "#85a8c4" }}>{row.type}</span>
                        <span className="text-[13px] font-medium">{row.name}</span>
                      </div>
                      <div className="flex gap-4 mt-1">
                        <span className="text-[11px]" style={{ color: T.textMuted }}>支払金額: <span style={{ color: T.text }}>{fmt(row.total)}</span></span>
                        {row.tax > 0 && <span className="text-[11px]" style={{ color: "#c45555" }}>源泉徴収: {fmt(row.tax)}</span>}
                        <span className="text-[11px] font-medium" style={{ color: "#22c55e" }}>差引: {fmt(row.total - row.tax)}</span>
                      </div>
                    </div>
                    <button onClick={() => downloadPayrollPDF(row)} className="px-3 py-1.5 rounded-lg text-[10px] cursor-pointer" style={{ backgroundColor: "#85a8c418", color: "#85a8c4", border: "1px solid #85a8c444" }}>📄 PDF</button>
                  </div>
                ))}
                <div className="rounded-xl p-4 mt-2" style={{ backgroundColor: T.cardAlt }}>
                  <div className="flex justify-between text-[12px] font-medium">
                    <span>合計支払額</span><span>{fmt(payrollData.reduce((s, r) => s + r.total, 0))}</span>
                  </div>
                  <div className="flex justify-between text-[11px] mt-1" style={{ color: "#c45555" }}>
                    <span>合計源泉徴収</span><span>{fmt(payrollData.reduce((s, r) => s + r.tax, 0))}</span>
                  </div>
                </div>
              </div>
            )}
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
                <div><label className="block text-[11px] mb-1" style={{ color: T.textSub }}>システムロール</label><select value={addRole} onChange={(e) => setAddRole(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none cursor-pointer" style={inputStyle}><option value="owner">オーナー</option><option value="manager">店長</option><option value="leader">責任者</option><option value="staff">スタッフ</option></select></div>
                <div><label className="block text-[11px] mb-1" style={{ color: T.textSub }}>会社役職</label><select value={addPosition} onChange={(e) => setAddPosition(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none cursor-pointer" style={inputStyle}>{POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}</select></div>
                <div><label className="block text-[11px] mb-1" style={{ color: T.textSub }}>交通費</label><select value={addTransport} onChange={(e) => setAddTransport(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none cursor-pointer" style={inputStyle}><option value="0">なし</option><option value="500">¥500</option><option value="1000">¥1,000</option><option value="1500">¥1,500</option><option value="2000">¥2,000</option></select></div>
                {isBizCommission(addPosition) && <div><label className="block text-[11px] mb-1" style={{ color: T.textSub }}>業務単価</label><input type="text" inputMode="numeric" value={addUnitPrice} onChange={(e) => setAddUnitPrice(e.target.value.replace(/[^0-9]/g, ""))} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} /></div>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-[11px] mb-1" style={{ color: T.textSub }}>🔑 PINコード（4桁）</label><input type="text" inputMode="numeric" maxLength={4} value={addPin} onChange={(e) => setAddPin(e.target.value.replace(/[^0-9]/g, "").slice(0,4))} placeholder="4桁" className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none tracking-[0.5em] text-center font-bold" style={inputStyle} /></div>
                <div><label className="block text-[11px] mb-1" style={{ color: T.textSub }}>🚗 免許</label><div className="w-full px-3 py-2.5 rounded-xl text-[12px]" style={{ backgroundColor: addLicenseNum.trim().length === 12 ? "#3b82f618" : T.cardAlt, color: addLicenseNum.trim().length === 12 ? "#3b82f6" : T.textMuted, border: `1px solid ${addLicenseNum.trim().length === 12 ? "#3b82f6" : T.border}`, fontWeight: addLicenseNum.trim().length === 12 ? 700 : 400 }}>{addLicenseNum.trim().length === 12 ? "✅ 免許あり（+¥50/u）" : "免許なし（番号入力で自動切替）"}</div></div>
              </div>
              <div>
                <label className="block text-[11px] mb-1" style={{ color: T.textSub }}>🪪 免許証番号（12桁）</label>
                <div className="flex items-center gap-1.5">
                  <span className="text-[13px] font-medium" style={{ color: T.textSub }}>第</span>
                  <input type="text" inputMode="numeric" maxLength={12} value={addLicenseNum} onChange={(e) => { const v = e.target.value.replace(/[^0-9]/g, "").slice(0, 12); setAddLicenseNum(v); if (v.length === 12) setAddLicense(true); }} placeholder="123456789012" className="flex-1 px-3 py-2.5 rounded-xl text-[12px] outline-none tracking-[0.15em] text-center font-bold" style={inputStyle} />
                  <span className="text-[13px] font-medium" style={{ color: T.textSub }}>号</span>
                </div>
                {addLicenseNum.length > 0 && addLicenseNum.length !== 12 && <p className="text-[9px] mt-1" style={{ color: "#c45555" }}>⚠ 免許証番号は12桁です（現在{addLicenseNum.length}桁）</p>}
                {addLicenseNum.length === 12 && <p className="text-[9px] mt-1" style={{ color: "#22c55e" }}>✅ 12桁 OK</p>}
              </div>
              <div><label className="block text-[11px] mb-1" style={{ color: T.textSub }}>🎉 大入り金額</label><input type="text" inputMode="numeric" value={addOiriBonus} onChange={(e) => setAddOiriBonus(e.target.value.replace(/[^0-9]/g, ""))} placeholder="1000" className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} /><p className="text-[9px] mt-0.5" style={{ color: T.textFaint }}>個人別のAmazonギフト額</p></div>
              <div><label className="block text-[11px] mb-1" style={{ color: T.textSub }}>源泉徴収</label><button type="button" onClick={() => setAddWithholding(!addWithholding)} className="w-full px-3 py-2.5 rounded-xl text-[12px] text-left cursor-pointer" style={{ backgroundColor: addWithholding ? "#c4555522" : "#22c55e22", color: addWithholding ? "#c45555" : "#22c55e", border: `1px solid ${addWithholding ? "#c4555544" : "#22c55e44"}` }}>{addWithholding ? "✅ 源泉徴収あり（10.21%）" : "⬜ 源泉徴収なし"}</button></div>
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
                <div><label className="block text-[11px] mb-1" style={{ color: T.textSub }}>システムロール</label><select value={editRole} onChange={(e) => setEditRole(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none cursor-pointer" style={inputStyle}><option value="owner">オーナー</option><option value="manager">店長</option><option value="leader">責任者</option><option value="staff">スタッフ</option></select></div>
                <div><label className="block text-[11px] mb-1" style={{ color: T.textSub }}>会社役職</label><select value={editPosition} onChange={(e) => setEditPosition(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none cursor-pointer" style={inputStyle}>{POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}</select></div>
                <div><label className="block text-[11px] mb-1" style={{ color: T.textSub }}>交通費</label><select value={editTransport} onChange={(e) => setEditTransport(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none cursor-pointer" style={inputStyle}><option value="0">なし</option><option value="500">¥500</option><option value="1000">¥1,000</option><option value="1500">¥1,500</option><option value="2000">¥2,000</option></select></div>
                {isBizCommission(editPosition) && <div><label className="block text-[11px] mb-1" style={{ color: T.textSub }}>業務単価</label><input type="text" inputMode="numeric" value={editUnitPrice} onChange={(e) => setEditUnitPrice(e.target.value.replace(/[^0-9]/g, ""))} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} /></div>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-[11px] mb-1" style={{ color: T.textSub }}>🔑 PINコード（4桁）</label><input type="text" inputMode="numeric" maxLength={4} value={editPin} onChange={(e) => setEditPin(e.target.value.replace(/[^0-9]/g, "").slice(0,4))} placeholder="4桁" className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none tracking-[0.5em] text-center font-bold" style={inputStyle} /></div>
                <div><label className="block text-[11px] mb-1" style={{ color: T.textSub }}>🚗 免許</label><div className="w-full px-3 py-2.5 rounded-xl text-[12px]" style={{ backgroundColor: editLicenseNum.trim().length === 12 ? "#3b82f618" : T.cardAlt, color: editLicenseNum.trim().length === 12 ? "#3b82f6" : T.textMuted, border: `1px solid ${editLicenseNum.trim().length === 12 ? "#3b82f6" : T.border}`, fontWeight: editLicenseNum.trim().length === 12 ? 700 : 400 }}>{editLicenseNum.trim().length === 12 ? "✅ 免許あり（+¥50/u）" : "免許なし（番号入力で自動切替）"}</div></div>
              </div>
              <div>
                <label className="block text-[11px] mb-1" style={{ color: T.textSub }}>🪪 免許証番号（12桁）</label>
                <div className="flex items-center gap-1.5">
                  <span className="text-[13px] font-medium" style={{ color: T.textSub }}>第</span>
                  <input type="text" inputMode="numeric" maxLength={12} value={editLicenseNum} onChange={(e) => { const v = e.target.value.replace(/[^0-9]/g, "").slice(0, 12); setEditLicenseNum(v); if (v.length === 12) setEditLicense(true); }} placeholder="123456789012" className="flex-1 px-3 py-2.5 rounded-xl text-[12px] outline-none tracking-[0.15em] text-center font-bold" style={inputStyle} />
                  <span className="text-[13px] font-medium" style={{ color: T.textSub }}>号</span>
                </div>
                {editLicenseNum.length > 0 && editLicenseNum.length !== 12 && <p className="text-[9px] mt-1" style={{ color: "#c45555" }}>⚠ 免許証番号は12桁です（現在{editLicenseNum.length}桁）</p>}
                {editLicenseNum.length === 12 && <p className="text-[9px] mt-1" style={{ color: "#22c55e" }}>✅ 12桁 OK</p>}
              </div>
              <div><label className="block text-[11px] mb-1" style={{ color: T.textSub }}>🎉 大入り金額</label><input type="text" inputMode="numeric" value={editOiriBonus} onChange={(e) => setEditOiriBonus(e.target.value.replace(/[^0-9]/g, ""))} placeholder="1000" className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} /><p className="text-[9px] mt-0.5" style={{ color: T.textFaint }}>個人別のAmazonギフト額</p></div>
              <div><label className="block text-[11px] mb-1" style={{ color: T.textSub }}>源泉徴収</label><button type="button" onClick={() => setEditWithholding(!editWithholding)} className="w-full px-3 py-2.5 rounded-xl text-[12px] text-left cursor-pointer" style={{ backgroundColor: editWithholding ? "#c4555522" : "#22c55e22", color: editWithholding ? "#c45555" : "#22c55e", border: `1px solid ${editWithholding ? "#c4555544" : "#22c55e44"}` }}>{editWithholding ? "✅ 源泉徴収あり（10.21%）" : "⬜ 源泉徴収なし"}</button></div>
              {/* 身分証アップロード（表・裏） */}
              <div>
                <label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>🪪 身分証アップロード</label>
                <div className="grid grid-cols-2 gap-3">
                  {/* 表面 */}
                  <div className="rounded-xl p-2.5" style={{ backgroundColor: T.cardAlt }}>
                    <p className="text-[10px] font-medium mb-1.5" style={{ color: T.textSub }}>📄 表面</p>
                    {editStaff?.id_doc_url ? (
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-[9px] flex-1 truncate" style={{ color: "#22c55e" }}>✅ アップロード済</span>
                        <a href={editStaff.id_doc_url} target="_blank" rel="noopener noreferrer" className="text-[9px] px-1.5 py-0.5 rounded cursor-pointer" style={{ color: "#3b82f6", backgroundColor: "#3b82f618" }}>表示</a>
                      </div>
                    ) : <p className="text-[9px] mb-1.5" style={{ color: T.textFaint }}>未アップロード</p>}
                    <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[10px] cursor-pointer font-medium" style={{ backgroundColor: "#85a8c418", color: "#85a8c4", border: "1px solid #85a8c444" }}>
                      📎 表面を選択
                      <input type="file" accept="image/*,.pdf" className="hidden" onChange={async (e) => {
                        const file = e.target.files?.[0]; if (!file || !editStaff) return;
                        toast.show("表面アップロード中...", "info");
                        const now = new Date(); const dateStr = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,"0")}${String(now.getDate()).padStart(2,"0")}`;
                        const docName = `${dateStr}_${editName.trim()}_第${editLicenseNum.trim() || "未登録"}号_表`;
                        const ext = file.name.split(".").pop(); const fileName = `id-docs/${editStaff.id}_front_${dateStr}_${Date.now()}.${ext}`;
                        const { error } = await supabase.storage.from("therapist-photos").upload(fileName, file, { upsert: true });
                        if (error) { toast.show("アップロード失敗: " + error.message, "error"); return; }
                        const { data: urlData } = supabase.storage.from("therapist-photos").getPublicUrl(fileName);
                        await supabase.from("staff").update({ id_doc_url: urlData.publicUrl, id_doc_name: docName }).eq("id", editStaff.id);
                        toast.show("表面をアップロードしました", "success"); fetchData();
                        setEditStaff({ ...editStaff, id_doc_url: urlData.publicUrl, id_doc_name: docName });
                      }} />
                    </label>
                  </div>
                  {/* 裏面 */}
                  <div className="rounded-xl p-2.5" style={{ backgroundColor: T.cardAlt }}>
                    <p className="text-[10px] font-medium mb-1.5" style={{ color: T.textSub }}>📄 裏面</p>
                    {editStaff?.id_doc_url_back ? (
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-[9px] flex-1 truncate" style={{ color: "#22c55e" }}>✅ アップロード済</span>
                        <a href={editStaff.id_doc_url_back} target="_blank" rel="noopener noreferrer" className="text-[9px] px-1.5 py-0.5 rounded cursor-pointer" style={{ color: "#3b82f6", backgroundColor: "#3b82f618" }}>表示</a>
                      </div>
                    ) : <p className="text-[9px] mb-1.5" style={{ color: T.textFaint }}>未アップロード</p>}
                    <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[10px] cursor-pointer font-medium" style={{ backgroundColor: "#85a8c418", color: "#85a8c4", border: "1px solid #85a8c444" }}>
                      📎 裏面を選択
                      <input type="file" accept="image/*,.pdf" className="hidden" onChange={async (e) => {
                        const file = e.target.files?.[0]; if (!file || !editStaff) return;
                        toast.show("裏面アップロード中...", "info");
                        const now = new Date(); const dateStr = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,"0")}${String(now.getDate()).padStart(2,"0")}`;
                        const docName = `${dateStr}_${editName.trim()}_第${editLicenseNum.trim() || "未登録"}号_裏`;
                        const ext = file.name.split(".").pop(); const fileName = `id-docs/${editStaff.id}_back_${dateStr}_${Date.now()}.${ext}`;
                        const { error } = await supabase.storage.from("therapist-photos").upload(fileName, file, { upsert: true });
                        if (error) { toast.show("アップロード失敗: " + error.message, "error"); return; }
                        const { data: urlData } = supabase.storage.from("therapist-photos").getPublicUrl(fileName);
                        await supabase.from("staff").update({ id_doc_url_back: urlData.publicUrl, id_doc_name_back: docName }).eq("id", editStaff.id);
                        toast.show("裏面をアップロードしました", "success"); fetchData();
                        setEditStaff({ ...editStaff, id_doc_url_back: urlData.publicUrl, id_doc_name_back: docName });
                      }} />
                    </label>
                  </div>
                </div>
              </div>
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
              <div><label className="block text-[10px] mb-1" style={{ color: T.textSub }}>スタッフ *</label><select value={schStaffId} onChange={(e) => setSchStaffId(Number(e.target.value))} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none cursor-pointer" style={inputStyle}><option value={0}>選択</option>{staffList.filter(s => s.status === "active").map(s => <option key={s.id} value={s.id}>{s.name}（{fmt(s.unit_price||1200)}/u）{s.has_license ? " 🚗" : ""}</option>)}</select></div>
              <div className="grid grid-cols-3 gap-3">
                <div><label className="block text-[10px] mb-1" style={{ color: T.textSub }}>業務開始</label><select value={schStart} onChange={(e) => setSchStart(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none cursor-pointer" style={inputStyle}>{TIMES_15MIN.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
                <div><label className="block text-[10px] mb-1" style={{ color: T.textSub }}>業務終了</label><select value={schEnd} onChange={(e) => setSchEnd(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none cursor-pointer" style={inputStyle}>{TIMES_15MIN.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
                <div><label className="block text-[10px] mb-1" style={{ color: T.textSub }}>☕ 休憩</label><select value={schBreak} onChange={(e) => setSchBreak(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none cursor-pointer" style={inputStyle}><option value="0">なし</option><option value="15">15分</option><option value="30">30分</option><option value="45">45分</option><option value="60">60分</option><option value="75">75分</option><option value="90">90分</option><option value="105">105分</option><option value="120">120分</option></select></div>
              </div>
              {schStaffId > 0 && (() => {
                const st = staffList.find(s => s.id === schStaffId);
                const calc = calcFullPayment(schStart, schEnd, st, parseInt(schBreak) || 0);
                return (
                <div className="rounded-xl p-3" style={{ backgroundColor: T.cardAlt }}>
                  <div className="space-y-1 text-[11px]">
                    <div className="flex justify-between"><span>業務単価 × ユニット</span><span>{fmt(st?.unit_price||1200)} × {calc.units}</span></div>
                    <div className="flex justify-between"><span>業務委託費</span><span>{fmt(calc.commission)}</span></div>
                    {calc.nightPremium > 0 && <div className="flex justify-between" style={{ color: "#a855f7" }}><span>🌙 深夜手当（{calc.nightUnits}u × ¥100）</span><span>+{fmt(calc.nightPremium)}</span></div>}
                    {calc.licensePremium > 0 && <div className="flex justify-between" style={{ color: "#3b82f6" }}><span>🚗 免許手当（{calc.units}u × ¥50）</span><span>+{fmt(calc.licensePremium)}</span></div>}
                    {calc.transport > 0 && <div className="flex justify-between"><span>交通費</span><span>+{fmt(calc.transport)}</span></div>}
                    <div className="flex justify-between pt-1 font-bold" style={{ borderTop: `1px solid ${T.border}`, color: "#c3a782" }}><span>合計</span><span>{fmt(calc.total)}</span></div>
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
              <div className="flex flex-wrap gap-1.5">{(["scheduled","completed","cancelled"] as const).map(st => (<button key={st} onClick={() => setEschStatus(st)} className="px-3 py-1.5 rounded-lg text-[10px] cursor-pointer" style={{ backgroundColor: eschStatus===st ? statusColors[st]+"22" : T.cardAlt, color: eschStatus===st ? statusColors[st] : T.textMuted, border: `1px solid ${eschStatus===st ? statusColors[st] : T.border}`, fontWeight: eschStatus===st ? 700 : 400 }}>{statusLabels[st]}</button>))}</div>
              <div className="grid grid-cols-3 gap-3">
                <div><label className="block text-[10px] mb-1" style={{ color: T.textSub }}>業務開始</label><select value={eschStart} onChange={(e) => setEschStart(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none cursor-pointer" style={inputStyle}>{TIMES_15MIN.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
                <div><label className="block text-[10px] mb-1" style={{ color: T.textSub }}>業務終了</label><select value={eschEnd} onChange={(e) => setEschEnd(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none cursor-pointer" style={inputStyle}>{TIMES_15MIN.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
                <div><label className="block text-[10px] mb-1" style={{ color: T.textSub }}>☕ 休憩</label><select value={eschBreak} onChange={(e) => setEschBreak(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none cursor-pointer" style={inputStyle}><option value="0">なし</option><option value="15">15分</option><option value="30">30分</option><option value="45">45分</option><option value="60">60分</option><option value="75">75分</option><option value="90">90分</option><option value="105">105分</option><option value="120">120分</option></select></div>
              </div>
              {(() => { const st = staffList.find(s => s.id === editSchedule.staff_id); const calc = calcFullPayment(eschStart, eschEnd, st, parseInt(eschBreak) || 0); return (
                <div className="rounded-xl p-3" style={{ backgroundColor: T.cardAlt }}>
                  <div className="space-y-1 text-[11px]">
                    <div className="flex justify-between"><span>委託費</span><span>{fmt(calc.commission)}</span></div>
                    {calc.nightPremium > 0 && <div className="flex justify-between" style={{ color: "#a855f7" }}><span>🌙 深夜</span><span>+{fmt(calc.nightPremium)}</span></div>}
                    {calc.licensePremium > 0 && <div className="flex justify-between" style={{ color: "#3b82f6" }}><span>🚗 免許</span><span>+{fmt(calc.licensePremium)}</span></div>}
                    <div className="flex justify-between font-bold" style={{ color: "#c3a782" }}><span>合計</span><span>{fmt(calc.total)}</span></div>
                  </div>
                </div>); })()}
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
                {monthlyData.map(d => { const staff = staffList.find(s => s.id === d.staff_id); const biz = isBizCommission(staff?.company_position || "業務委託"); return (
                  <div key={d.staff_id} className="rounded-xl p-4" style={{ backgroundColor: T.cardAlt }}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2"><span className="text-[13px] font-medium">{d.name}</span>{!biz && <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "#88878018", color: "#888780" }}>{staff?.company_position}</span>}</div>
                      {biz && <span className="text-[15px] font-bold" style={{ color: "#c3a782" }}>{fmt(d.total_payment)}</span>}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px]" style={{ color: T.textMuted }}>
                      <span>稼働: {d.days}日</span><span>ユニット: {d.total_units}</span>
                      {biz && <span>委託費: {fmt(d.total_commission)}</span>}
                      {biz && d.total_night > 0 && <span style={{ color: "#a855f7" }}>🌙深夜: {fmt(d.total_night)}</span>}
                      {biz && d.total_license > 0 && <span style={{ color: "#3b82f6" }}>🚗免許: {fmt(d.total_license)}</span>}
                      {biz && <span>交通費: {fmt(d.total_transport)}</span>}
                      {biz && d.total_oiri > 0 && <span style={{ color: "#f59e0b" }}>🎉大入: {fmt(d.total_oiri)}</span>}
                    </div>
                  </div>); })}
                <div className="rounded-xl p-4" style={{ backgroundColor: "#c3a78212", border: "1px solid #c3a78233" }}>
                  <div className="flex justify-between text-[13px] font-bold" style={{ color: "#c3a782" }}><span>月間合計（業務委託のみ）</span><span>{fmt(monthlyData.filter(d => { const st = staffList.find(s => s.id === d.staff_id); return isBizCommission(st?.company_position || "業務委託"); }).reduce((s,d)=>s+d.total_payment,0))}</span></div>
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
