"use client";
import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { useTheme } from "../../lib/theme";
import { NavMenu } from "../../lib/nav-menu";
import { jsPDF } from "jspdf";
import { useToast } from "../../lib/toast";
import { useStaffSession } from "../../lib/staff-session";
import { usePinKeyboard } from "../../lib/use-pin-keyboard";
import { isAdvanceEligible, runAutoSettlementIfDue, type StaffAdvance } from "../../lib/staff-advances";
import { useConfirm } from "../../components/useConfirm";

type Staff = { id: number; name: string; phone: string; email: string; role: string; address: string; transport_fee: number; id_photo_url: string; status: string; unit_price: number; pin: string; pin_updated_at: string | null; has_license: boolean; company_position: string; email_verified: boolean; email_token: string; id_doc_url: string; id_doc_name: string; id_doc_url_back: string; id_doc_name_back: string; license_number: string; oiri_bonus: number; night_start_time: string; night_end_time: string; night_unit_price: number; has_invoice: boolean; invoice_number: string; invoice_photo_url: string; has_withholding: boolean; override_is_manager: boolean | null; override_can_tax_portal: boolean | null; override_can_cash_dashboard: boolean | null; advance_preset_amount: number | null };
type Store = { id: number; name: string; invoice_number: string; company_name: string; company_address: string; company_phone: string; license_unit_price: number };
type Schedule = { id: number; staff_id: number; date: string; start_time: string; end_time: string; unit_price: number; units: number; commission_fee: number; transport_fee: number; total_payment: number; status: string; notes: string; is_paid: boolean; night_premium: number; license_premium: number; oiri_amount: number; break_minutes: number };
type OiriSetting = { id: number; sales_threshold: number; count_threshold: number; bonus_amount: number; is_active: boolean };

export default function StaffPage() {
  return <Suspense fallback={<div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}><p>読み込み中...</p></div>}><StaffPageInner /></Suspense>;
}

function StaffPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { dark, toggle, T } = useTheme();
  const toast = useToast();
  const { activeStaff, isManager, login, logout } = useStaffSession();
  const { confirm, ConfirmModalNode } = useConfirm();
  // URL ?tab=advances 等で初期タブを指定可能
  const initialTab = (() => {
    const t = searchParams?.get("tab");
    if (t === "advances" || t === "permissions" || t === "schedule" || t === "oiri" || t === "license") return t;
    return "staff";
  })();
  const [tab, setTab] = useState<"staff" | "schedule" | "oiri" | "license" | "permissions" | "advances">(initialTab);
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
  const [addAdvanceAmount, setAddAdvanceAmount] = useState("0");

  const [editStaff, setEditStaff] = useState<Staff | null>(null);
  const [editName, setEditName] = useState(""); const [editPhone, setEditPhone] = useState(""); const [editEmail, setEditEmail] = useState("");
  const [editRole, setEditRole] = useState("staff"); const [editPosition, setEditPosition] = useState("業務委託"); const [editAddress, setEditAddress] = useState(""); const [editTransport, setEditTransport] = useState("0");
  const [editUnitPrice, setEditUnitPrice] = useState("1200"); const [editPin, setEditPin] = useState(""); const [editLicense, setEditLicense] = useState(false);
  const [editLicenseNum, setEditLicenseNum] = useState(""); const [editOiriBonus, setEditOiriBonus] = useState("0");
  const [editAdvanceAmount, setEditAdvanceAmount] = useState("0");

  // Company states
  const [companyName, setCompanyName] = useState(""); const [companyAddress, setCompanyAddress] = useState(""); const [companyPhone, setCompanyPhone] = useState(""); const [invoiceNumber, setInvoiceNumber] = useState(""); const [licenseUnitPrice, setLicenseUnitPrice] = useState("50");

  // Schedule states
  const [scheduleDate, setScheduleDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [schPositionFilter, setSchPositionFilter] = useState("all");
  const [showAddSchedule, setShowAddSchedule] = useState(false);
  const [schStaffId, setSchStaffId] = useState(0); const [schStart, setSchStart] = useState("10:00"); const [schEnd, setSchEnd] = useState("19:00"); const [schNotes, setSchNotes] = useState(""); const [schBreak, setSchBreak] = useState("0");
  const [editSchedule, setEditSchedule] = useState<Schedule | null>(null);
  const [eschStart, setEschStart] = useState(""); const [eschEnd, setEschEnd] = useState(""); const [eschNotes, setEschNotes] = useState(""); const [eschStatus, setEschStatus] = useState("scheduled"); const [eschBreak, setEschBreak] = useState("0");
  const [addWithholding, setAddWithholding] = useState(false);
  const [addNightStart, setAddNightStart] = useState("00:00");
  const [addNightEnd, setAddNightEnd] = useState("05:00");
  const [addNightPrice, setAddNightPrice] = useState("100");
  const [addHasInvoice, setAddHasInvoice] = useState(false);
  const [addInvoiceNum, setAddInvoiceNum] = useState("");
  const [editWithholding, setEditWithholding] = useState(false);
  const [editNightStart, setEditNightStart] = useState("00:00");
  const [editNightEnd, setEditNightEnd] = useState("05:00");
  const [editNightPrice, setEditNightPrice] = useState("100");
  const [editHasInvoice, setEditHasInvoice] = useState(false);
  const [editInvoiceNum, setEditInvoiceNum] = useState("");
  const [editInvoicePhoto, setEditInvoicePhoto] = useState<File | null>(null);
  const [payrollYear, setPayrollYear] = useState(String(new Date().getFullYear()));
  const [payrollData, setPayrollData] = useState<{ type: string; id: number; name: string; address: string; total: number; tax: number }[]>([]);
  const [payrollLoading, setPayrollLoading] = useState(false);
  const [payrollFilter, setPayrollFilter] = useState("all");

  // ========== 前借り (staff_advances) ==========
  const [advMonth, setAdvMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [advMonthList, setAdvMonthList] = useState<StaffAdvance[]>([]);
  const [advToday, setAdvToday] = useState<StaffAdvance[]>([]);
  const [advTodayDate, setAdvTodayDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [advMonthlySchedules, setAdvMonthlySchedules] = useState<{ staff_id: number; date: string; total_payment: number }[]>([]);
  const [advTodayWorkingStaffIds, setAdvTodayWorkingStaffIds] = useState<number[]>([]);
  const [advEditModal, setAdvEditModal] = useState<{ staff: Staff; defaultAmount: number } | null>(null);
  const [advEditAmount, setAdvEditAmount] = useState("");
  const [advEditReason, setAdvEditReason] = useState("");
  const [advAutoSettleInfo, setAdvAutoSettleInfo] = useState<{ settled: number; month: string | null } | null>(null);

  const fetchAdvances = useCallback(async () => {
    // 当月分
    const [y, m] = advMonth.split("-");
    const firstDay = `${advMonth}-01`;
    const lastDay = new Date(parseInt(y), parseInt(m), 0).toISOString().split("T")[0];
    const { data: monthly } = await supabase
      .from("staff_advances").select("*")
      .gte("advance_date", firstDay).lte("advance_date", lastDay)
      .order("advance_date", { ascending: false });
    setAdvMonthList((monthly || []) as StaffAdvance[]);

    // 当月のスタッフ稼働報酬見込 (status問わず)
    const { data: scheds } = await supabase.from("staff_schedules")
      .select("staff_id, date, total_payment")
      .gte("date", firstDay).lte("date", lastDay);
    setAdvMonthlySchedules(scheds || []);
  }, [advMonth]);

  const fetchAdvTodayData = useCallback(async () => {
    // 本日分の前借り記録
    const { data: todays } = await supabase
      .from("staff_advances").select("*")
      .eq("advance_date", advTodayDate)
      .order("created_at", { ascending: true });
    setAdvToday((todays || []) as StaffAdvance[]);

    // 本日出勤予定のスタッフID一覧
    const { data: todaySchs } = await supabase.from("staff_schedules")
      .select("staff_id").eq("date", advTodayDate);
    const ids = Array.from(new Set((todaySchs || []).map((s: any) => s.staff_id)));
    setAdvTodayWorkingStaffIds(ids);
  }, [advTodayDate]);

  // タブ初回アクセス時に自動精算チェック
  useEffect(() => {
    if (tab !== "advances") return;
    runAutoSettlementIfDue().then(result => {
      if (result.settled > 0) {
        setAdvAutoSettleInfo(result);
        toast.show(`${result.month} の前借り ${result.settled} 件を外注費へ自動精算しました`, "success");
      }
      fetchAdvances();
      fetchAdvTodayData();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  useEffect(() => { if (tab === "advances") fetchAdvances(); }, [advMonth, tab, fetchAdvances]);
  useEffect(() => { if (tab === "advances") fetchAdvTodayData(); }, [advTodayDate, tab, fetchAdvTodayData]);

  // ワンクリック記録
  const recordAdvance = async (staff: Staff, amount: number, reason: string = "") => {
    const { error } = await supabase.from("staff_advances").insert({
      staff_id: staff.id,
      advance_date: advTodayDate,
      amount,
      reason,
      status: "pending",
      recorded_by_name: activeStaff?.name || "",
    });
    if (error) {
      console.error("[recordAdvance] insert failed:", error);
      toast.show(`前借り記録に失敗: ${error.message}`, "error");
      return;
    }
    toast.show(`${staff.name} ¥${amount.toLocaleString()} を記録しました`, "success");
    fetchAdvTodayData();
    fetchAdvances();
  };

  // 「当日なし」記録
  const recordSkip = async (staff: Staff) => {
    const { error } = await supabase.from("staff_advances").insert({
      staff_id: staff.id,
      advance_date: advTodayDate,
      amount: 0,
      reason: "当日なし",
      status: "skipped",
      recorded_by_name: activeStaff?.name || "",
    });
    if (error) {
      console.error("[recordSkip] insert failed:", error);
      toast.show(`記録に失敗: ${error.message}`, "error");
      return;
    }
    toast.show(`${staff.name} 当日なしを記録`, "info");
    fetchAdvTodayData();
    fetchAdvances();
  };

  // 削除 (pending/skipped のみ可)
  const deleteAdvance = async (id: number) => {
    const ok = await confirm({ title: "この前借り記録を削除しますか？", variant: "danger", confirmLabel: "削除" });
    if (!ok) return;
    const { error } = await supabase.from("staff_advances").delete().eq("id", id);
    if (error) {
      console.error("[deleteAdvance] delete failed:", error);
      toast.show(`削除に失敗: ${error.message}`, "error");
      return;
    }
    toast.show("削除しました", "success");
    fetchAdvTodayData();
    fetchAdvances();
  };

  const fetchPayroll = async () => {
    setPayrollLoading(true);
    const year = payrollYear;
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;

    // セラピスト支払調書
    const { data: settlements } = await supabase.from("therapist_daily_settlements").select("therapist_id, total_back, invoice_deduction, withholding_tax").gte("date", startDate).lte("date", endDate).eq("is_settled", true);
    const { data: therapists } = await supabase.from("therapists").select("id, name, has_withholding, address");
    const thMap: Record<number, { name: string; address: string; total: number; tax: number }> = {};
    (settlements || []).forEach(s => {
      if (!thMap[s.therapist_id]) {
        const th = (therapists || []).find(t => t.id === s.therapist_id);
        thMap[s.therapist_id] = { name: th?.name || "不明", address: th?.address || "", total: 0, tax: 0 };
      }
      thMap[s.therapist_id].total += s.total_back || 0;
      const th2 = (therapists || []).find(t => t.id === s.therapist_id);
      if (th2 && (th2 as any).has_withholding) {
        const backAmt = s.total_back || 0;
        const invDed = s.invoice_deduction || 0;
        const adjusted = backAmt - invDed;
        const wBase = Math.max(adjusted - 5000, 0);
        thMap[s.therapist_id].tax += Math.floor(wBase * 0.1021);
      }
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
  const calcNightUnits = (start: string, end: string, nightStartTime: string = "00:00", nightEndTime: string = "05:00") => {
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    // 24時間に正規化（0-5は24-29として扱う）
    const sMin = (sh < 6 ? sh + 24 : sh) * 60 + sm;
    const eMin = (eh < 6 ? eh + 24 : eh) * 60 + em;
    // 深夜帯: 24:00(1440) ～ 29:00(1740)
    const [nsh, nsm] = nightStartTime.split(":").map(Number);
    const [neh, nem] = nightEndTime.split(":").map(Number);
    const nightStart = (nsh < 6 ? nsh + 24 : nsh) * 60 + nsm;
    const nightEnd = (neh < 6 ? neh + 24 : neh) * 60 + nem;
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
    const nightUnits = calcNightUnits(start, end, staff?.night_start_time || "00:00", staff?.night_end_time || "05:00");
    const biz = isBizCommission(staff?.company_position || "業務委託");
    const up = staff?.unit_price || 1200;
    const commission = biz ? Math.round(up * units) : 0;
    const nightPrice = staff?.night_unit_price || 100;
    const nightPremium = biz ? Math.round(nightPrice * nightUnits) : 0;
    const licPrice = storeInfo?.license_unit_price || 50;
    const licensePremium = biz && staff?.has_license ? Math.round(licPrice * units) : 0;
    const transport = staff?.transport_fee || 0;
    const total = commission + nightPremium + licensePremium + transport;
    return { units, nightUnits, commission, nightPremium, licensePremium, transport, total };
  };

  const fetchData = useCallback(async () => {
    const { data: s } = await supabase.from("staff").select("*").order("id"); if (s) setStaffList(s);
    const { data: st } = await supabase.from("stores").select("*").limit(1).single();
    if (st) { setStoreInfo(st); setCompanyName(st.company_name || ""); setCompanyAddress(st.company_address || ""); setCompanyPhone(st.company_phone || ""); setInvoiceNumber(st.invoice_number || ""); setLicenseUnitPrice(String(st.license_unit_price || 50)); }
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
    await supabase.from("staff").insert({ name: addName.trim(), phone: addPhone.trim(), email: addEmail.trim(), role: addRole, company_position: addPosition, address: addAddress.trim(), transport_fee: parseInt(addTransport) || 0, unit_price: parseInt(addUnitPrice) || 1200, pin: addPin.trim(), has_license: addLicenseNum.trim().length === 12 ? true : addLicense, license_number: addLicenseNum.trim(), oiri_bonus: parseInt(addOiriBonus) || 0, has_withholding: addWithholding, night_start_time: addNightStart, night_end_time: addNightEnd, night_unit_price: parseInt(addNightPrice) || 100, has_invoice: addHasInvoice, invoice_number: addInvoiceNum.trim(), advance_preset_amount: (parseInt(addAdvanceAmount) || 0) || null, email_verified: false, email_token: crypto.randomUUID(), status: "active" });
    toast.show("スタッフを登録しました", "success");
    setShowAdd(false); setAddName(""); setAddPhone(""); setAddEmail(""); setAddRole("staff"); setAddPosition("業務委託"); setAddAddress(""); setAddTransport("0"); setAddUnitPrice("1200"); setAddPin(""); setAddLicense(false); setAddLicenseNum(""); setAddOiriBonus("0"); setAddAdvanceAmount("0");
    fetchData();
  };
  const updateStaffFn = async () => {
    if (!editStaff) return;
    await supabase.from("staff").update({ name: editName.trim(), phone: editPhone.trim(), email: editEmail.trim(), role: editRole, company_position: editPosition, address: editAddress.trim(), transport_fee: parseInt(editTransport) || 0, unit_price: parseInt(editUnitPrice) || 1200, pin: editPin.trim(), has_license: editLicenseNum.trim().length === 12 ? true : editLicense, license_number: editLicenseNum.trim(), oiri_bonus: parseInt(editOiriBonus) || 0, has_withholding: editWithholding, night_start_time: editNightStart, night_end_time: editNightEnd, night_unit_price: parseInt(editNightPrice) || 100, has_invoice: editHasInvoice, invoice_number: editInvoiceNum.trim(), advance_preset_amount: (parseInt(editAdvanceAmount) || 0) || null, ...(editEmail.trim() !== (editStaff?.email || "") ? { email_verified: false, email_token: crypto.randomUUID() } : {}) }).eq("id", editStaff.id);
    if (editInvoicePhoto && editStaff) {
      try {
        const file = editInvoicePhoto;
        const img = new Image();
        const reader = new FileReader();
        const dataUrl = await new Promise<string>((resolve) => { reader.onload = () => resolve(reader.result as string); reader.readAsDataURL(file); });
        await new Promise<void>((resolve) => { img.onload = () => resolve(); img.src = dataUrl; });
        const now = new Date();
        const dateStr = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,"0")}${String(now.getDate()).padStart(2,"0")}`;
        const headerH = 60;
        const pW = Math.max(img.width, 500);
        const pH = img.height + headerH;
        const pdf = new jsPDF({ orientation: pW > pH ? "landscape" : "portrait", unit: "px", format: [pW, pH] });
        pdf.setFontSize(14); pdf.setTextColor(80, 80, 80);
        pdf.text(`Invoice: ${editInvoiceNum.trim() || "N/A"}`, 15, 25);
        pdf.setFontSize(10); pdf.setTextColor(130, 130, 130);
        pdf.text(`${editName.trim()} - ${dateStr}`, 15, 45);
        pdf.addImage(dataUrl, "JPEG", 0, headerH, img.width, img.height);
        const pdfBlob = pdf.output("blob");
        const pdfName = `invoice_${editStaff.id}_${dateStr}.pdf`;
        const thumbName = `invoice_thumb_${editStaff.id}_${dateStr}.jpg`;
        await supabase.storage.from("staff-docs").upload(pdfName, pdfBlob, { contentType: "application/pdf", upsert: true });
        const thumbBlob = await new Promise<Blob>((resolve) => { const c = document.createElement("canvas"); const ctx = c.getContext("2d")!; const scale = 200 / Math.max(img.width, img.height); c.width = img.width * scale; c.height = img.height * scale; ctx.drawImage(img, 0, 0, c.width, c.height); c.toBlob(b => resolve(b!), "image/jpeg", 0.7); });
        await supabase.storage.from("staff-docs").upload(thumbName, thumbBlob, { contentType: "image/jpeg", upsert: true });
        const { data: pdfUrl } = supabase.storage.from("staff-docs").getPublicUrl(pdfName);
        await supabase.from("staff").update({ invoice_photo_url: pdfUrl.publicUrl }).eq("id", editStaff.id);
      } catch (e) { console.error("適格事業者写真アップロードエラー:", e); }
    }
    toast.show("スタッフ情報を更新しました", "success"); setEditStaff(null); fetchData();
  };
  const deleteStaffFn = async (id: number, name: string) => {
    const ok = await confirm({
      title: `${name} さんを削除しますか？`,
      message: (
        <>
          この操作は <strong style={{ color: "#c45555" }}>取り消せません</strong>。<br />
          勤怠履歴や過去の稼働予定もすべて参照できなくなります。
          <br /><br />
          本当に削除する場合は、確認のためスタッフ名をご入力ください。
        </>
      ),
      variant: "danger",
      confirmLabel: "削除する",
      typeToConfirm: name,
    });
    if (!ok) return;
    await supabase.from("staff").delete().eq("id", id);
    toast.show("スタッフを削除しました", "info");
    fetchData();
  };
  const saveCompany = async () => { if (!storeInfo) return; await supabase.from("stores").update({ company_name: companyName.trim(), company_address: companyAddress.trim(), company_phone: companyPhone.trim(), invoice_number: invoiceNumber.trim(), license_unit_price: parseInt(licenseUnitPrice) || 50 }).eq("id", storeInfo.id); toast.show("会社情報を更新しました", "success"); fetchData(); };
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
  const deleteScheduleFn = async (id: number) => {
    const ok = await confirm({
      title: "この稼働予定を削除しますか？",
      message: "この操作は取り消せません。",
      variant: "danger",
      confirmLabel: "削除する",
    });
    if (!ok) return;
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
    const subtotal = sch.commission_fee + (sch.night_premium||0) + (sch.license_premium||0);
    const hasInv = staff?.has_invoice || false;
    const invDed = hasInv ? 0 : Math.round(subtotal * 0.1);
    const adjusted = subtotal - invDed;
    const hasWT = staff?.has_withholding || false;
    const wtTax = hasWT ? Math.floor(adjusted * 0.1021) : 0;
    const finalTotalRaw = adjusted - wtTax + (sch.transport_fee||0);
    const finalTotal = Math.ceil(finalTotalRaw / 100) * 100;
    const roundUp = finalTotal - finalTotalRaw;
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>支払明細書</title><style>body{font-family:'Hiragino Sans','Yu Gothic','Meiryo',sans-serif;max-width:700px;margin:40px auto;padding:20px;color:#333}h1{text-align:center;font-size:20px;border-bottom:3px double #333;padding-bottom:10px;margin-bottom:30px}table{width:100%;border-collapse:collapse;margin:15px 0}td,th{border:1px solid #ccc;padding:8px 12px;font-size:13px}th{background:#f5f0e8;text-align:left;width:35%}.right{text-align:right}.total{font-size:16px;font-weight:bold;color:#c3a782}.header-info{display:flex;justify-content:space-between;margin-bottom:20px;font-size:12px}.company{text-align:right;font-size:11px;line-height:1.8}.sign{margin-top:50px;display:flex;justify-content:space-between}.sign-box{border-top:1px solid #333;width:200px;text-align:center;padding-top:5px;font-size:11px}@media print{body{margin:0;padding:20px}}</style></head><body>
    <h1>支払明細書（業務委託費）</h1>
    <div class="header-info"><div><p><strong>支払先：</strong>${staff?.name||""} 様</p><p><strong>業務実施日：</strong>${sch.date}</p><p><strong>業務内容：</strong>店舗管理・受付業務一式</p></div><div class="company"><p><strong>${store?.company_name||""}</strong></p><p>${store?.company_address||""}</p><p>TEL: ${store?.company_phone||""}</p>${store?.invoice_number?`<p>適格事業者番号: ${store.invoice_number}</p>`:""}</div></div>
    <table><tr><th>項目</th><th class="right">金額</th><th>備考</th></tr>
    <tr><td>業務委託費（基本）</td><td class="right">&yen;${sch.commission_fee.toLocaleString()}</td><td style="font-size:11px;color:#888">業務単価 &yen;${sch.unit_price.toLocaleString()}（税込） × ${sch.units}ユニット</td></tr>
    ${(sch.night_premium||0)>0?`<tr><td>深夜時間帯業務加算</td><td class="right">&yen;${sch.night_premium.toLocaleString()}</td><td style="font-size:11px;color:#888">${staff?.night_start_time||"00:00"}〜${staff?.night_end_time||"05:00"} +&yen;${staff?.night_unit_price||100}/ユニット</td></tr>`:""}
    ${(sch.license_premium||0)>0?`<tr><td>免許資格業務加算</td><td class="right">&yen;${sch.license_premium.toLocaleString()}</td><td style="font-size:11px;color:#888">+&yen;${storeInfo?.license_unit_price||50}（税込）/ユニット</td></tr>`:""}
    <tr style="background:#f9f6f0"><td><strong>小計（額面・税込）</strong></td><td class="right"><strong>&yen;${subtotal.toLocaleString()}</strong></td><td></td></tr>
    ${invDed>0?`<tr><td style="color:#c45555">インボイス未登録調整</td><td class="right" style="color:#c45555">-&yen;${invDed.toLocaleString()}</td><td style="font-size:11px;color:#888">小計の10%</td></tr>`:`<tr><td style="color:#22c55e">適格事業者登録あり</td><td class="right" style="color:#22c55e">控除なし</td><td style="font-size:11px;color:#888">${staff?.invoice_number||""}</td></tr>`}
    ${hasWT?`<tr><td style="color:#c45555">源泉徴収税（10.21%）</td><td class="right" style="color:#c45555">-&yen;${wtTax.toLocaleString()}</td><td style="font-size:11px;color:#888">(&yen;${subtotal.toLocaleString()} - &yen;${invDed.toLocaleString()}) = &yen;${adjusted.toLocaleString()} × 10.21%</td></tr>`:`<tr><td>源泉徴収</td><td class="right">なし</td><td style="font-size:11px;color:#888">源泉徴収対象外</td></tr>`}
    ${sch.transport_fee>0?`<tr><td>交通費（実費精算分）</td><td class="right">&yen;${sch.transport_fee.toLocaleString()}</td><td style="font-size:11px;color:#888">※源泉対象外</td></tr>`:""}
    ${roundUp>0?`<tr><td>端数調整（切り上げ）</td><td class="right">&yen;${roundUp.toLocaleString()}</td><td style="font-size:11px;color:#888">100円単位調整分</td></tr>`:""}
    <tr style="background:#f9f6f0"><td><strong>合計支払額</strong></td><td class="right total">&yen;${finalTotal.toLocaleString()}</td><td></td></tr></table>
    <div class="sign"><div class="sign-box">支払者（${store?.company_name||""}）</div><div class="sign-box">受領者（${staff?.name||""} 様）</div></div></body></html>`);
    w.document.close();
  };

  const roleColors: Record<string, string> = { owner: "#c3a782", manager: "#85a8c4", leader: "#a855f7", supervisor: "#e8849a", staff: "#22c55e" };
  const roleLabels: Record<string, string> = { owner: "オーナー", manager: "店長", leader: "店長", supervisor: "責任者", staff: "スタッフ" };
  const POSITIONS = ["社長", "経営責任者", "社員", "契約社員", "業務委託", "税理士"];
  const statusColors: Record<string, string> = { scheduled: "#85a8c4", completed: "#22c55e", cancelled: "#c45555" };
  const statusLabels: Record<string, string> = { scheduled: "予定", completed: "完了", cancelled: "キャンセル" };

  const prevDay = () => { const d = new Date(scheduleDate); d.setDate(d.getDate() - 1); setScheduleDate(d.toISOString().split("T")[0]); };
  const nextDay = () => { const d = new Date(scheduleDate); d.setDate(d.getDate() + 1); setScheduleDate(d.toISOString().split("T")[0]); };
  const dateDisplay = (() => { const d = new Date(scheduleDate + "T00:00:00"); const days = ["日", "月", "火", "水", "木", "金", "土"]; return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日（${days[d.getDay()]}）`; })();

  // ★ アクセスゲート: このページ専用の認証（毎回manager/owner PINが必要）
  // F5 リロード対策: sessionStorage に 2 時間有効で保存
  const STAFF_GATE_KEY = "t-manage-staff-gate";
  const STAFF_GATE_EXPIRY_MS = 2 * 60 * 60 * 1000; // 2 時間
  const [pageAuthed, setPageAuthed] = useState(false);
  const [pageAuthName, setPageAuthName] = useState("");

  // マウント時: 2 時間以内の認証が残っていれば復元（F5 対策）
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(STAFF_GATE_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved) as { authedAt: number; authedName: string };
      if (parsed && Date.now() - parsed.authedAt < STAFF_GATE_EXPIRY_MS) {
        setPageAuthed(true);
        setPageAuthName(parsed.authedName || "");
      } else {
        sessionStorage.removeItem(STAFF_GATE_KEY);
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // PIN 入力中はキーボードで打てるように
  usePinKeyboard(!pageAuthed);

  // ===== ブラウザ戻る（マウスサイドボタン/スワイプバック）対応 =====
  // モーダル → タブ → 前のページの順で一段ずつ戻る
  const [tabHistory, setTabHistory] = useState<(typeof tab)[]>([]);
  const tabRef = useRef(tab);
  const prevTabRef = useRef(tab);
  const tabHistoryRef = useRef(tabHistory);
  const showAddRef = useRef(showAdd);
  const editStaffRef = useRef(editStaff);
  const showAddScheduleRef = useRef(showAddSchedule);
  const editScheduleRef = useRef(editSchedule);
  const pageAuthedRef = useRef(pageAuthed);
  const isPopstateRef = useRef(false);
  const prevShowAddRef = useRef(showAdd);
  const prevEditStaffRef = useRef(editStaff);
  const prevShowAddScheduleRef = useRef(showAddSchedule);
  const prevEditScheduleRef = useRef(editSchedule);

  // 最新状態をrefに同期（popstateハンドラ等から参照される）
  useEffect(() => {
    tabRef.current = tab;
    tabHistoryRef.current = tabHistory;
    showAddRef.current = showAdd;
    editStaffRef.current = editStaff;
    showAddScheduleRef.current = showAddSchedule;
    editScheduleRef.current = editSchedule;
    pageAuthedRef.current = pageAuthed;
  });

  // タブ切替時に履歴スタックにpush
  useEffect(() => {
    if (!pageAuthedRef.current) { prevTabRef.current = tab; return; }
    const prev = prevTabRef.current;
    if (prev !== tab) {
      if (isPopstateRef.current) {
        // popstateによる変更なので履歴には積まない
        isPopstateRef.current = false;
      } else {
        setTabHistory(h => [...h, prev]);
        window.history.pushState({ staffTab: tab }, "");
      }
      prevTabRef.current = tab;
    }
  }, [tab]);

  // モーダルopen時に履歴にpush（ユーザー操作のみ検知）
  useEffect(() => {
    if (!pageAuthedRef.current) { prevShowAddRef.current = showAdd; return; }
    if (!prevShowAddRef.current && showAdd) {
      window.history.pushState({ staffModal: "add" }, "");
    }
    prevShowAddRef.current = showAdd;
  }, [showAdd]);

  useEffect(() => {
    if (!pageAuthedRef.current) { prevEditStaffRef.current = editStaff; return; }
    if (!prevEditStaffRef.current && editStaff) {
      window.history.pushState({ staffModal: "edit" }, "");
    }
    prevEditStaffRef.current = editStaff;
  }, [editStaff]);

  useEffect(() => {
    if (!pageAuthedRef.current) { prevShowAddScheduleRef.current = showAddSchedule; return; }
    if (!prevShowAddScheduleRef.current && showAddSchedule) {
      window.history.pushState({ staffModal: "addSchedule" }, "");
    }
    prevShowAddScheduleRef.current = showAddSchedule;
  }, [showAddSchedule]);

  useEffect(() => {
    if (!pageAuthedRef.current) { prevEditScheduleRef.current = editSchedule; return; }
    if (!prevEditScheduleRef.current && editSchedule) {
      window.history.pushState({ staffModal: "editSchedule" }, "");
    }
    prevEditScheduleRef.current = editSchedule;
  }, [editSchedule]);

  // popstate: モーダル → タブ → 前のページ の順で一段ずつ戻す
  useEffect(() => {
    const handlePopState = () => {
      if (!pageAuthedRef.current) return;
      // Priority 1: モーダルが開いていれば閉じる
      if (showAddRef.current) { setShowAdd(false); return; }
      if (editStaffRef.current) { setEditStaff(null); return; }
      if (showAddScheduleRef.current) { setShowAddSchedule(false); return; }
      if (editScheduleRef.current) { setEditSchedule(null); return; }
      // Priority 2: タブ履歴があれば1つ戻す
      const history = tabHistoryRef.current;
      if (history.length > 0) {
        const prev = history[history.length - 1];
        setTabHistory(h => h.slice(0, -1));
        isPopstateRef.current = true;
        setTab(prev);
        return;
      }
      // それ以外はブラウザに任せる（前のページへ遷移）
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

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
                    else if (data.role !== "owner" && data.role !== "manager" && data.role !== "leader" && data.role !== "supervisor") { setPinError("責任者以上の権限が必要です"); setPinInput(""); }
                    else {
                      setPageAuthed(true); setPageAuthName(data.name); login(next);
                      try {
                        sessionStorage.setItem(STAFF_GATE_KEY, JSON.stringify({ authedAt: Date.now(), authedName: data.name }));
                      } catch {}
                    }
                  }
                }} data-pin-key={n === "del" ? "del" : String(n)} className="h-12 rounded-xl text-[16px] font-medium cursor-pointer" style={{ backgroundColor: T.cardAlt, color: n === "del" ? "#c45555" : T.text, border: `1px solid ${T.border}` }}>
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
      {ConfirmModalNode}
      <div className="h-[64px] backdrop-blur-xl border-b flex items-center justify-between px-6" style={{ backgroundColor: dark ? T.card + "cc" : "rgba(255,255,255,0.8)", borderColor: T.border }}>
        <div className="flex items-center gap-4">
          <NavMenu T={T} dark={dark} />
          <h1 className="text-[18px] font-medium">内勤スタッフ設定</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={toggle} className="px-3 py-1.5 text-[10px] rounded-lg cursor-pointer border" style={{ borderColor: T.border, color: T.textSub }}>{dark ? "☀️ ライト" : "🌙 ダーク"}</button>
          <button onClick={() => { logout(); setPageAuthed(false); try { sessionStorage.removeItem(STAFF_GATE_KEY); } catch {} }} className="px-3 py-1.5 text-[10px] rounded-lg cursor-pointer" style={{ backgroundColor: "#c3a78222", color: "#c3a782", border: "1px solid #c3a78244" }}>👤 {pageAuthName} ログアウト</button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-6">
        <div className="flex gap-2 mb-6 flex-wrap">
          {(["staff", "permissions", "advances", "schedule", "oiri", "license"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} className="px-4 py-2 rounded-xl text-[12px] cursor-pointer" style={{ backgroundColor: tab === t ? "#c3a78222" : T.cardAlt, color: tab === t ? "#c3a782" : T.textMuted, border: `1px solid ${tab === t ? "#c3a782" : T.border}`, fontWeight: tab === t ? 700 : 400 }}>
              {t === "staff" ? "👥 スタッフ管理" : t === "permissions" ? "🔐 権限マトリクス" : t === "advances" ? "💸 前借り" : t === "schedule" ? "📅 業務稼働予定" : t === "oiri" ? "🎉 大入り設定" : "🚗 免許資格単価設定"}
            </button>
          ))}
        </div>

        {/* ========== Tab 1: Staff Management ========== */}
        {tab === "staff" && (
          <div className="space-y-4">
            {/* PIN 未変更スタッフ警告（active で pin あり かつ pin_updated_at が NULL） */}
            {(() => {
              const unchangedPinStaffs = staffList.filter(s => s.status === "active" && s.pin && !s.pin_updated_at);
              if (unchangedPinStaffs.length === 0) return null;
              return (
                <div className="rounded-xl p-4" style={{ backgroundColor: "#c4555512", border: "1px solid #c4555533" }}>
                  <div className="flex items-start gap-3">
                    <span className="text-[20px] leading-none">⚠️</span>
                    <div className="flex-1">
                      <p className="text-[12px] font-medium mb-1" style={{ color: "#c45555" }}>
                        初期 PIN のまま未変更のスタッフが {unchangedPinStaffs.length} 名います
                      </p>
                      <p className="text-[10px] leading-relaxed mb-2" style={{ color: T.textSub }}>
                        セキュリティのため、6/1 本番運用開始までに全員の PIN 変更が必要です。
                        該当スタッフが次回 PIN ログインした際に、PIN 変更画面が自動表示されます。
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {unchangedPinStaffs.map(s => (
                          <span
                            key={s.id}
                            className="text-[10px] px-2 py-1 rounded"
                            style={{ backgroundColor: "#c4555522", color: "#c45555", border: "1px solid #c4555533" }}
                          >
                            {s.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

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
                      {s.pin ? (
                        s.pin_updated_at ? (
                          <span style={{ color: "#22c55e" }}>🔑 設定済</span>
                        ) : (
                          <span style={{ color: "#c45555", fontWeight: 600 }} title="初回ログイン時の PIN が未変更です。セキュリティのためスタッフ本人に変更してもらってください">⚠️ 初期PIN</span>
                        )
                      ) : (
                        <span style={{ color: "#c45555" }}>🔑 未設定</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  {s.email && !s.email_verified && <button onClick={() => sendStaffConfirmEmail(s)} className="text-[10px] px-3 py-1.5 rounded-lg cursor-pointer" style={{ color: "#3b82f6", backgroundColor: "#3b82f618" }}>📧 確認</button>}
                  <button onClick={() => { setEditStaff(s); setEditName(s.name); setEditPhone(s.phone||""); setEditEmail(s.email||""); setEditRole(s.role); setEditPosition(s.company_position||"業務委託"); setEditAddress(s.address||""); setEditTransport(String(s.transport_fee||0)); setEditUnitPrice(String(s.unit_price||1200)); setEditPin(s.pin||""); setEditLicense(!!s.has_license); setEditLicenseNum(s.license_number||""); setEditOiriBonus(String(s.oiri_bonus||0)); setEditWithholding(!!s.has_withholding); setEditNightStart(s.night_start_time||"00:00"); setEditNightEnd(s.night_end_time||"05:00"); setEditNightPrice(String(s.night_unit_price||100)); setEditHasInvoice(!!s.has_invoice); setEditInvoiceNum(s.invoice_number||""); setEditAdvanceAmount(String(s.advance_preset_amount||0)); setEditInvoicePhoto(null); }} className="text-[10px] px-3 py-1.5 rounded-lg cursor-pointer border" style={{ borderColor: T.border, color: T.textSub }}>編集</button>
                  <button onClick={() => deleteStaffFn(s.id, s.name)} className="text-[10px] px-3 py-1.5 rounded-lg cursor-pointer" style={{ backgroundColor: "#c4555512", color: "#c45555" }}>削除</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ========== Tab: Advances (前借り) ========== */}
        {tab === "advances" && (() => {
          const fmtC = (n: number) => "¥" + (n || 0).toLocaleString();
          const activeTargetStaffs = staffList.filter(s => s.status === "active" && isAdvanceEligible(s));

          // 当月サマリー集計
          const monthSummary = activeTargetStaffs.map(s => {
            const myScheds = advMonthlySchedules.filter(x => x.staff_id === s.id);
            const workDays = new Set(myScheds.map(x => x.date)).size;
            const expectedPay = myScheds.reduce((sum, x) => sum + (x.total_payment || 0), 0);
            const myAdvs = advMonthList.filter(a => a.staff_id === s.id && a.status !== "skipped");
            const advanceTotal = myAdvs.reduce((sum, a) => sum + (a.amount || 0), 0);
            const pendingCount = myAdvs.filter(a => a.status === "pending").length;
            const settledCount = myAdvs.filter(a => a.status === "settled").length;
            return { staff: s, workDays, expectedPay, advanceTotal, pendingCount, settledCount, diff: expectedPay - advanceTotal };
          });

          // 本日の記録状況
          const todayStatus = activeTargetStaffs.map(s => {
            const myToday = advToday.filter(a => a.staff_id === s.id);
            const hasRecord = myToday.length > 0;
            const isSkipped = myToday.some(a => a.status === "skipped");
            const isRecorded = myToday.some(a => a.status === "pending");
            const isWorking = advTodayWorkingStaffIds.includes(s.id);
            return { staff: s, myToday, hasRecord, isSkipped, isRecorded, isWorking };
          });

          const todayRecordedList = todayStatus.filter(x => x.isRecorded);
          const todaySkippedList = todayStatus.filter(x => x.isSkipped && !x.isRecorded);
          // 未記録かつ出勤予定のスタッフが優先、次に対象外の出勤外スタッフ
          const todayUnrecordedWorking = todayStatus.filter(x => !x.hasRecord && x.isWorking);
          const todayUnrecordedOther = todayStatus.filter(x => !x.hasRecord && !x.isWorking);

          const todayAmountTotal = advToday.filter(a => a.status === "pending").reduce((s, a) => s + a.amount, 0);

          return (
            <div className="space-y-5">
              {/* 自動精算通知 */}
              {advAutoSettleInfo && advAutoSettleInfo.settled > 0 && (
                <div className="rounded-xl p-4" style={{ backgroundColor: "#22c55e18", border: "1px solid #22c55e44" }}>
                  <p className="text-[12px] font-medium" style={{ color: "#22c55e" }}>✅ 月末自動精算実行</p>
                  <p className="text-[10px] mt-1" style={{ color: T.textSub }}>{advAutoSettleInfo.month} 分の前借り {advAutoSettleInfo.settled} 件を外注費へ自動計上しました。</p>
                </div>
              )}

              {/* 説明 */}
              <div className="rounded-xl p-4" style={{ backgroundColor: "#d4687e12", border: "1px solid #d4687e33" }}>
                <div className="flex items-start gap-3">
                  <span className="text-[18px]">💸</span>
                  <div>
                    <p className="text-[12px] font-medium mb-1" style={{ color: "#d4687e" }}>前借りの仕組み</p>
                    <p className="text-[10px] leading-relaxed" style={{ color: T.textSub }}>
                      出勤スタッフへの日次前借りを記録します。営業締めで管理者金庫から差し引かれ、毎月第1月曜12:00 以降に自動で外注費へ振替されます。
                    </p>
                    <ul className="text-[10px] mt-2 space-y-0.5" style={{ color: T.textSub }}>
                      <li>・<strong>対象</strong>: 前借りプリセットが設定されているスタッフ（スタッフ管理から編集）</li>
                      <li>・<strong>運用</strong>: 「¥3,000 前借り」または「✕ なし」をワンクリック記録</li>
                      <li>・<strong>金額変更</strong>: 金額ボタンを長押しまたは金額カードクリックで編集可能</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* ========== 本日の記録 ========== */}
              <div className="rounded-xl p-4" style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <p className="text-[13px] font-medium">🗓 本日の前借り</p>
                    <input type="date" value={advTodayDate} onChange={e => setAdvTodayDate(e.target.value)} className="px-2 py-1 rounded text-[11px] outline-none" style={{ backgroundColor: T.cardAlt, color: T.text, border: `1px solid ${T.border}` }} />
                  </div>
                  <p className="text-[11px]" style={{ color: T.textSub }}>合計 <span className="text-[14px] font-medium tabular-nums" style={{ color: "#d4687e" }}>-{fmtC(todayAmountTotal)}</span></p>
                </div>

                {/* 未記録チェック */}
                {todayUnrecordedWorking.length > 0 && (
                  <div className="rounded-lg p-2.5 mb-3" style={{ backgroundColor: "#f59e0b18", border: "1px solid #f59e0b44" }}>
                    <p className="text-[11px] font-medium" style={{ color: "#f59e0b" }}>⚠️ あと {todayUnrecordedWorking.length} 名未記録（本日出勤予定）</p>
                    <p className="text-[9px] mt-0.5" style={{ color: T.textFaint }}>{todayUnrecordedWorking.map(x => x.staff.name).join("・")}</p>
                  </div>
                )}

                {/* 記録済み */}
                {todayRecordedList.length > 0 && (
                  <div className="mb-3">
                    <p className="text-[10px] mb-1.5" style={{ color: "#22c55e" }}>🟢 記録済み ({todayRecordedList.length})</p>
                    <div className="space-y-1">
                      {todayRecordedList.map(x => {
                        const rec = x.myToday.find(a => a.status === "pending");
                        if (!rec) return null;
                        return (
                          <div key={x.staff.id} className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ backgroundColor: T.cardAlt }}>
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] text-white font-medium" style={{ backgroundColor: "#22c55e" }}>{x.staff.name.charAt(0)}</div>
                              <span className="text-[11px]">{x.staff.name}</span>
                              {rec.reason && <span className="text-[9px]" style={{ color: T.textFaint }}>({rec.reason})</span>}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[12px] font-medium tabular-nums" style={{ color: "#d4687e" }}>-{fmtC(rec.amount)}</span>
                              <button onClick={() => deleteAdvance(rec.id)} className="text-[9px] px-2 py-0.5 rounded cursor-pointer" style={{ backgroundColor: "#c4555512", color: "#c45555" }}>取消</button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 未記録（出勤予定） */}
                {todayUnrecordedWorking.length > 0 && (
                  <div className="mb-3">
                    <p className="text-[10px] mb-1.5" style={{ color: T.textSub }}>⚪ 未記録（出勤予定）</p>
                    <div className="space-y-1">
                      {todayUnrecordedWorking.map(x => {
                        const preset = x.staff.advance_preset_amount || 3000;
                        return (
                          <div key={x.staff.id} className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ backgroundColor: T.cardAlt }}>
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] text-white font-medium" style={{ backgroundColor: roleColors[x.staff.role] || "#888" }}>{x.staff.name.charAt(0)}</div>
                              <span className="text-[11px]">{x.staff.name}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <button onClick={() => recordAdvance(x.staff, preset)} className="text-[10px] px-2.5 py-1 rounded cursor-pointer font-medium" style={{ backgroundColor: "#d4687e", color: "#fff" }}>{fmtC(preset)} 前借り</button>
                              <button onClick={() => { setAdvEditModal({ staff: x.staff, defaultAmount: preset }); setAdvEditAmount(String(preset)); setAdvEditReason(""); }} className="text-[10px] px-2 py-1 rounded cursor-pointer border" style={{ borderColor: T.border, color: T.textSub }}>金額変更</button>
                              <button onClick={() => recordSkip(x.staff)} className="text-[10px] px-2 py-1 rounded cursor-pointer" style={{ backgroundColor: T.cardAlt, color: T.textMuted, border: `1px solid ${T.border}` }}>✕ なし</button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* スキップ済み */}
                {todaySkippedList.length > 0 && (
                  <div className="mb-3">
                    <p className="text-[10px] mb-1.5" style={{ color: T.textMuted }}>🚫 本日なし ({todaySkippedList.length})</p>
                    <div className="space-y-1">
                      {todaySkippedList.map(x => {
                        const skip = x.myToday.find(a => a.status === "skipped");
                        if (!skip) return null;
                        return (
                          <div key={x.staff.id} className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ backgroundColor: T.cardAlt, opacity: 0.6 }}>
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] text-white font-medium" style={{ backgroundColor: "#888" }}>{x.staff.name.charAt(0)}</div>
                              <span className="text-[11px]">{x.staff.name}</span>
                              <span className="text-[9px]" style={{ color: T.textFaint }}>なし記録</span>
                            </div>
                            <button onClick={() => deleteAdvance(skip.id)} className="text-[9px] px-2 py-0.5 rounded cursor-pointer" style={{ backgroundColor: "#c4555512", color: "#c45555" }}>取消</button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 未記録（出勤外） */}
                {todayUnrecordedOther.length > 0 && (
                  <details className="mt-3">
                    <summary className="text-[10px] cursor-pointer" style={{ color: T.textFaint }}>
                      ▶ 出勤予定外のスタッフ ({todayUnrecordedOther.length}) — 必要なら手動で記録可能
                    </summary>
                    <div className="space-y-1 mt-2">
                      {todayUnrecordedOther.map(x => {
                        const preset = x.staff.advance_preset_amount || 3000;
                        return (
                          <div key={x.staff.id} className="flex items-center justify-between px-3 py-1.5 rounded-lg" style={{ backgroundColor: T.cardAlt, opacity: 0.6 }}>
                            <span className="text-[10px]">{x.staff.name}</span>
                            <button onClick={() => { setAdvEditModal({ staff: x.staff, defaultAmount: preset }); setAdvEditAmount(String(preset)); setAdvEditReason(""); }} className="text-[9px] px-2 py-0.5 rounded cursor-pointer border" style={{ borderColor: T.border, color: T.textSub }}>記録する</button>
                          </div>
                        );
                      })}
                    </div>
                  </details>
                )}

                {activeTargetStaffs.length === 0 && (
                  <p className="text-center py-6 text-[11px]" style={{ color: T.textMuted }}>
                    前借り対象のスタッフがいません。<br />
                    スタッフ管理 → 編集 → 💸 前借りプリセットに金額を設定してください。
                  </p>
                )}
              </div>

              {/* ========== 当月サマリー ========== */}
              <div className="rounded-xl p-4" style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[13px] font-medium">📊 当月サマリー</p>
                  <input type="month" value={advMonth} onChange={e => setAdvMonth(e.target.value)} className="px-2 py-1 rounded text-[11px] outline-none" style={{ backgroundColor: T.cardAlt, color: T.text, border: `1px solid ${T.border}` }} />
                </div>
                {monthSummary.length === 0 ? (
                  <p className="text-center py-6 text-[11px]" style={{ color: T.textMuted }}>対象スタッフなし</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-[11px]" style={{ borderCollapse: "separate", borderSpacing: 0, minWidth: 560 }}>
                      <thead>
                        <tr style={{ backgroundColor: T.cardAlt }}>
                          <th className="text-left px-3 py-2 font-medium" style={{ color: T.textSub, borderBottom: `1px solid ${T.border}` }}>スタッフ</th>
                          <th className="text-right px-3 py-2 font-medium" style={{ color: T.textSub, borderBottom: `1px solid ${T.border}` }}>稼働日</th>
                          <th className="text-right px-3 py-2 font-medium" style={{ color: T.textSub, borderBottom: `1px solid ${T.border}` }}>稼働報酬見込</th>
                          <th className="text-right px-3 py-2 font-medium" style={{ color: T.textSub, borderBottom: `1px solid ${T.border}` }}>前借り合計</th>
                          <th className="text-right px-3 py-2 font-medium" style={{ color: T.textSub, borderBottom: `1px solid ${T.border}` }}>差額(支給予定)</th>
                          <th className="text-center px-3 py-2 font-medium" style={{ color: T.textSub, borderBottom: `1px solid ${T.border}` }}>状態</th>
                        </tr>
                      </thead>
                      <tbody>
                        {monthSummary.map((x, idx) => (
                          <tr key={x.staff.id} style={{ backgroundColor: idx % 2 === 0 ? "transparent" : (dark ? T.cardAlt : "#f8f6f3") }}>
                            <td className="px-3 py-2" style={{ borderBottom: `1px solid ${T.border}` }}>
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] text-white font-medium" style={{ backgroundColor: roleColors[x.staff.role] || "#888" }}>{x.staff.name.charAt(0)}</div>
                                <span className="text-[11px]">{x.staff.name}</span>
                              </div>
                            </td>
                            <td className="text-right px-3 py-2 tabular-nums" style={{ borderBottom: `1px solid ${T.border}` }}>{x.workDays}日</td>
                            <td className="text-right px-3 py-2 tabular-nums" style={{ borderBottom: `1px solid ${T.border}` }}>{fmtC(x.expectedPay)}</td>
                            <td className="text-right px-3 py-2 tabular-nums" style={{ color: "#d4687e", borderBottom: `1px solid ${T.border}` }}>-{fmtC(x.advanceTotal)}</td>
                            <td className="text-right px-3 py-2 tabular-nums font-medium" style={{ color: x.diff >= 0 ? "#22c55e" : "#c45555", borderBottom: `1px solid ${T.border}` }}>{fmtC(x.diff)}</td>
                            <td className="text-center px-3 py-2 text-[9px]" style={{ borderBottom: `1px solid ${T.border}` }}>
                              {x.pendingCount > 0 && <span className="inline-block px-1.5 py-0.5 rounded mr-1" style={{ backgroundColor: "#f59e0b22", color: "#f59e0b" }}>未精算 {x.pendingCount}</span>}
                              {x.settledCount > 0 && <span className="inline-block px-1.5 py-0.5 rounded" style={{ backgroundColor: "#22c55e22", color: "#22c55e" }}>精算済 {x.settledCount}</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* ========== 全履歴 ========== */}
              <div className="rounded-xl p-4" style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}>
                <p className="text-[13px] font-medium mb-3">📋 {advMonth} 全履歴</p>
                {advMonthList.length === 0 ? (
                  <p className="text-center py-6 text-[11px]" style={{ color: T.textMuted }}>記録なし</p>
                ) : (
                  <div className="space-y-1">
                    {advMonthList.map(a => {
                      const s = staffList.find(x => x.id === a.staff_id);
                      const statusLabel = a.status === "pending" ? "🟡 未精算" : a.status === "settled" ? "✅ 精算済" : "🚫 なし";
                      const statusColor = a.status === "pending" ? "#f59e0b" : a.status === "settled" ? "#22c55e" : "#888";
                      return (
                        <div key={a.id} className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ backgroundColor: T.cardAlt }}>
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="text-[10px] tabular-nums" style={{ color: T.textSub, minWidth: 60 }}>{a.advance_date.slice(5)}</span>
                            <span className="text-[11px] truncate">{s?.name || "不明"}</span>
                            {a.reason && <span className="text-[9px]" style={{ color: T.textFaint }}>({a.reason})</span>}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-medium tabular-nums" style={{ color: a.status === "skipped" ? T.textFaint : "#d4687e" }}>
                              {a.status === "skipped" ? "—" : "-" + fmtC(a.amount)}
                            </span>
                            <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ backgroundColor: statusColor + "22", color: statusColor }}>{statusLabel}</span>
                            {a.status !== "settled" && (
                              <button onClick={() => deleteAdvance(a.id)} className="text-[9px] px-1.5 py-0.5 rounded cursor-pointer" style={{ backgroundColor: "#c4555512", color: "#c45555" }}>削除</button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* ========== Tab: Permissions Matrix ========== */}
        {tab === "permissions" && (() => {
          // 権限定義 — staff-session.tsx のロジックと完全に同期すること
          // デフォルト判定（ロール/法人ポジションベース）
          const defaultIsManagerFn = (_s: Staff) => true; // 管理系操作は基本みんなできる
          const defaultCanTaxFn = (s: Staff) =>
            s.company_position === "社長" ||
            s.company_position === "経営責任者" ||
            s.company_position === "税理士" ||
            s.role === "supervisor";
          const defaultCanCashFn = (s: Staff) =>
            s.company_position === "社長" ||
            s.company_position === "経営責任者";

          // 実効権限（override があればそれを優先）
          const effIsManager = (s: Staff) => s.override_is_manager ?? defaultIsManagerFn(s);
          const effCanTax = (s: Staff) => s.override_can_tax_portal ?? defaultCanTaxFn(s);
          const effCanCash = (s: Staff) => s.override_can_cash_dashboard ?? defaultCanCashFn(s);

          // 社長（canEdit = 編集可能）
          const isPresident = activeStaff?.company_position === "社長";
          const activeStaffs = staffList.filter(s => s.status === "active");

          type Feature = {
            key: string;
            label: string;
            icon: string;
            eff: (s: Staff) => boolean;
            def: (s: Staff) => boolean;
            overrideKey: "override_is_manager" | "override_can_tax_portal" | "override_can_cash_dashboard";
            hint: string;
          };
          const features: Feature[] = [
            { key: "manage", label: "管理系操作",     icon: "📅", eff: effIsManager, def: defaultIsManagerFn, overrideKey: "override_is_manager",         hint: "タイムチャート編集・営業締め・精算・金庫など" },
            { key: "tax",    label: "税理士ポータル", icon: "📒", eff: effCanTax,    def: defaultCanTaxFn,    overrideKey: "override_can_tax_portal",     hint: "売上/経費/セラピスト支払/書類庫/銀行取込 など" },
            { key: "cash",   label: "資金管理",       icon: "💴", eff: effCanCash,   def: defaultCanCashFn,   overrideKey: "override_can_cash_dashboard", hint: "5財布のリアルタイム表示・ATM預入・豊橋予備金管理" },
          ];

          const roleLabelFn: Record<string, string> = { owner: "社長(owner)", manager: "経営責任者(manager)", leader: "店長(leader)", supervisor: "責任者(supervisor)", staff: "スタッフ(staff)" };
          const posOptions = ["社長", "経営責任者", "税理士", "店長", "業務委託", "パート", "正社員", "アルバイト"];
          const roleOptions = ["owner", "manager", "leader", "supervisor", "staff"];

          // 権限セルクリック: デフォルト → 強制ON → 強制OFF → デフォルト のサイクル
          const cyclePermission = async (s: Staff, f: Feature) => {
            const cur = s[f.overrideKey]; // null | true | false
            let next: boolean | null;
            if (cur === null || cur === undefined) next = true;
            else if (cur === true) next = false;
            else next = null;
            await supabase.from("staff").update({ [f.overrideKey]: next }).eq("id", s.id);
            toast.show(`${s.name} の ${f.label} を ${next === null ? "ロール既定に戻しました" : next ? "強制ON" : "強制OFF"}`, "success");
            fetchData();
          };

          return (
            <div className="space-y-4">
              {/* 説明 */}
              <div className="rounded-xl p-4" style={{ backgroundColor: "#85a8c412", border: "1px solid #85a8c433" }}>
                <div className="flex items-start gap-3">
                  <span className="text-[18px]">ℹ️</span>
                  <div>
                    <p className="text-[12px] font-medium mb-1" style={{ color: "#85a8c4" }}>権限の仕組み</p>
                    <p className="text-[10px] leading-relaxed" style={{ color: T.textSub }}>
                      権限は <strong>ロール既定</strong> で自動判定され、社長が必要に応じて <strong>個別に上書き</strong> できます。
                    </p>
                    <ul className="text-[10px] mt-2 space-y-0.5" style={{ color: T.textSub }}>
                      <li>・<strong>📅 管理系操作</strong>: 既定は <strong>全ロール有効</strong>（基本みんなできる）</li>
                      <li>・<strong>📒 税理士ポータル</strong>: 既定は法人ポジションが 社長 / 経営責任者 / 税理士、またはロールが <strong>責任者(supervisor)</strong></li>
                      <li>・<strong>💴 資金管理</strong>: 既定は法人ポジションが 社長 / 経営責任者（税理士は除外）</li>
                    </ul>
                    {isPresident ? (
                      <p className="text-[10px] mt-2" style={{ color: "#22c55e" }}>
                        💡 権限セルをクリックで「強制ON → 強制OFF → 既定」を切り替え。<strong>🔒 マーク</strong>が付いたものが個別上書き中です。
                      </p>
                    ) : (
                      <p className="text-[10px] mt-2" style={{ color: "#f59e0b" }}>
                        🔒 権限の編集は社長のみ可能です。閲覧のみ表示しています。
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* マトリクス */}
              <div className="rounded-xl border overflow-x-auto" style={{ backgroundColor: T.card, borderColor: T.border }}>
                <table className="w-full text-[11px]" style={{ borderCollapse: "separate", borderSpacing: 0, minWidth: 760 }}>
                  <thead>
                    <tr style={{ backgroundColor: T.cardAlt }}>
                      <th className="text-left px-3 py-2.5 font-medium sticky left-0" style={{ color: T.textSub, backgroundColor: T.cardAlt, borderBottom: `1px solid ${T.border}`, minWidth: 120 }}>スタッフ</th>
                      <th className="text-left px-3 py-2.5 font-medium" style={{ color: T.textSub, borderBottom: `1px solid ${T.border}`, minWidth: 140 }}>ロール</th>
                      <th className="text-left px-3 py-2.5 font-medium" style={{ color: T.textSub, borderBottom: `1px solid ${T.border}`, minWidth: 120 }}>法人ポジション</th>
                      {features.map(f => (
                        <th key={f.key} className="text-center px-3 py-2.5 font-medium" style={{ color: T.textSub, borderBottom: `1px solid ${T.border}`, minWidth: 110 }} title={f.hint}>
                          <div>{f.icon} {f.label}</div>
                        </th>
                      ))}
                      {isPresident && (
                        <th className="text-center px-3 py-2.5 font-medium" style={{ color: T.textSub, borderBottom: `1px solid ${T.border}`, minWidth: 70 }}></th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {activeStaffs.length === 0 && (
                      <tr>
                        <td colSpan={3 + features.length + (isPresident ? 1 : 0)} className="text-center py-6 text-[11px]" style={{ color: T.textMuted }}>
                          アクティブなスタッフがいません
                        </td>
                      </tr>
                    )}
                    {activeStaffs.map((s, idx) => {
                      const isMe = activeStaff?.id === s.id;
                      const canEditRow = isPresident && !isMe;  // 社長は自分の権限は変更できない（ガード）
                      return (
                        <tr key={s.id} style={{ backgroundColor: idx % 2 === 0 ? "transparent" : (dark ? T.cardAlt : "#f8f6f3") }}>
                          <td className="px-3 py-2 sticky left-0" style={{ backgroundColor: idx % 2 === 0 ? T.card : (dark ? T.cardAlt : "#f8f6f3"), borderBottom: `1px solid ${T.border}` }}>
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] text-white font-medium flex-shrink-0" style={{ backgroundColor: roleColors[s.role] || "#888" }}>
                                {s.name.charAt(0)}
                              </div>
                              <div className="min-w-0">
                                <div className="text-[11px] font-medium truncate">{s.name}</div>
                                {isMe && <span className="text-[8px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "#c3a78222", color: "#c3a782" }}>自分</span>}
                              </div>
                            </div>
                          </td>
                          {/* ロール */}
                          <td className="px-3 py-2" style={{ borderBottom: `1px solid ${T.border}` }}>
                            {canEditRow ? (
                              <select
                                value={s.role}
                                onChange={async (e) => {
                                  const newRole = e.target.value;
                                  await supabase.from("staff").update({ role: newRole }).eq("id", s.id);
                                  toast.show(`${s.name} のロールを変更しました`, "success");
                                  fetchData();
                                }}
                                className="px-2 py-1 rounded text-[10px] cursor-pointer outline-none"
                                style={{ backgroundColor: T.cardAlt, color: T.text, border: `1px solid ${T.border}` }}
                              >
                                {roleOptions.map(r => <option key={r} value={r}>{roleLabelFn[r] || r}</option>)}
                              </select>
                            ) : (
                              <span className="text-[10px] px-2 py-0.5 rounded" style={{ backgroundColor: (roleColors[s.role] || "#888") + "22", color: roleColors[s.role] || "#888" }}>
                                {roleLabelFn[s.role] || s.role}
                              </span>
                            )}
                          </td>
                          {/* 法人ポジション */}
                          <td className="px-3 py-2" style={{ borderBottom: `1px solid ${T.border}` }}>
                            {canEditRow ? (
                              <select
                                value={s.company_position || ""}
                                onChange={async (e) => {
                                  const newPos = e.target.value;
                                  await supabase.from("staff").update({ company_position: newPos }).eq("id", s.id);
                                  toast.show(`${s.name} の法人ポジションを変更しました`, "success");
                                  fetchData();
                                }}
                                className="px-2 py-1 rounded text-[10px] cursor-pointer outline-none"
                                style={{ backgroundColor: T.cardAlt, color: T.text, border: `1px solid ${T.border}` }}
                              >
                                <option value="">—</option>
                                {posOptions.map(p => <option key={p} value={p}>{p}</option>)}
                              </select>
                            ) : (
                              <span className="text-[10px]" style={{ color: T.textSub }}>{s.company_position || "—"}</span>
                            )}
                          </td>
                          {/* 権限セル（クリックで override サイクル） */}
                          {features.map(f => {
                            const has = f.eff(s);
                            const ov = s[f.overrideKey]; // null/true/false
                            const isOverridden = ov === true || ov === false;
                            const cellContent = has ? (
                              <span className="inline-flex items-center justify-center w-7 h-7 rounded-full" style={{ backgroundColor: "#22c55e18", color: "#22c55e" }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                              </span>
                            ) : (
                              <span className="inline-flex items-center justify-center w-7 h-7 rounded-full" style={{ backgroundColor: T.cardAlt, color: T.textFaint }}>
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12"/></svg>
                              </span>
                            );
                            return (
                              <td key={f.key} className="px-3 py-2 text-center" style={{ borderBottom: `1px solid ${T.border}` }}>
                                {canEditRow ? (
                                  <button
                                    onClick={() => cyclePermission(s, f)}
                                    className="relative inline-block cursor-pointer"
                                    title={isOverridden ? `個別上書き中 (${ov ? "強制ON" : "強制OFF"}) — クリックで切替` : "既定値 — クリックで強制ONに切替"}
                                  >
                                    {cellContent}
                                    {isOverridden && (
                                      <span className="absolute -top-1 -right-1 text-[8px] leading-none px-1 py-0.5 rounded" style={{ backgroundColor: ov ? "#22c55e" : "#c45555", color: "#fff" }}>
                                        🔒
                                      </span>
                                    )}
                                  </button>
                                ) : (
                                  <span className="relative inline-block" title={isOverridden ? `個別上書き中 (${ov ? "強制ON" : "強制OFF"})` : "既定値"}>
                                    {cellContent}
                                    {isOverridden && (
                                      <span className="absolute -top-1 -right-1 text-[8px] leading-none px-1 py-0.5 rounded" style={{ backgroundColor: ov ? "#22c55e" : "#c45555", color: "#fff" }}>
                                        🔒
                                      </span>
                                    )}
                                  </span>
                                )}
                              </td>
                            );
                          })}
                          {/* 編集ボタン */}
                          {isPresident && (
                            <td className="px-3 py-2 text-center" style={{ borderBottom: `1px solid ${T.border}` }}>
                              <button
                                onClick={() => {
                                  setEditStaff(s); setEditName(s.name); setEditPhone(s.phone||""); setEditEmail(s.email||""); setEditRole(s.role); setEditPosition(s.company_position||"業務委託"); setEditAddress(s.address||""); setEditTransport(String(s.transport_fee||0)); setEditUnitPrice(String(s.unit_price||1200)); setEditPin(s.pin||""); setEditLicense(!!s.has_license); setEditLicenseNum(s.license_number||""); setEditOiriBonus(String(s.oiri_bonus||0)); setEditWithholding(!!s.has_withholding); setEditNightStart(s.night_start_time||"00:00"); setEditNightEnd(s.night_end_time||"05:00"); setEditNightPrice(String(s.night_unit_price||100)); setEditHasInvoice(!!s.has_invoice); setEditInvoiceNum(s.invoice_number||""); setEditAdvanceAmount(String(s.advance_preset_amount||0)); setEditInvoicePhoto(null);
                                }}
                                className="text-[10px] px-2 py-1 rounded cursor-pointer border"
                                style={{ borderColor: T.border, color: T.textSub }}
                                title="編集モーダルを開く"
                              >
                                編集
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* サマリー */}
              <div className="grid grid-cols-3 gap-3">
                {features.map(f => {
                  const count = activeStaffs.filter(f.eff).length;
                  const overriddenCount = activeStaffs.filter(s => {
                    const ov = s[f.overrideKey];
                    return ov === true || ov === false;
                  }).length;
                  return (
                    <div key={f.key} className="rounded-xl p-4" style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}>
                      <p className="text-[10px] mb-1" style={{ color: T.textMuted }}>{f.icon} {f.label}</p>
                      <p className="text-[22px] font-medium tabular-nums" style={{ color: T.text }}>{count}<span className="text-[11px] font-normal ml-1" style={{ color: T.textMuted }}>/ {activeStaffs.length} 名</span></p>
                      <p className="text-[9px] mt-1 leading-relaxed" style={{ color: T.textFaint }}>{f.hint}</p>
                      {overriddenCount > 0 && (
                        <p className="text-[9px] mt-1" style={{ color: "#f59e0b" }}>🔒 個別上書き {overriddenCount} 名</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

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
        
        {tab === "license" && (
          <div className="rounded-xl border p-6 space-y-4" style={{ backgroundColor: T.card, borderColor: T.border }}>
            <h2 className="text-[15px] font-medium">🚗 免許資格単価設定</h2>
            <p className="text-[10px]" style={{ color: T.textMuted }}>免許（普通自動車免許等）を所持しているスタッフに対して、業務稼働時に加算される単価です。</p>
              <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>免許資格単価（全スタッフ共通）</label><div className="flex items-center gap-2"><input type="text" inputMode="numeric" value={licenseUnitPrice} onChange={(e) => setLicenseUnitPrice(e.target.value.replace(/[^0-9]/g, ""))} className="w-24 px-3 py-2.5 rounded-xl text-[12px] outline-none text-center" style={inputStyle} /><span className="text-[11px]" style={{ color: T.textMuted }}>円/ユニット（免許所持スタッフに加算）</span></div><p className="text-[9px] mt-1" style={{ color: T.textFaint }}>デフォルト: ¥50/u</p></div>
            <button onClick={async () => { if (!storeInfo) return; await supabase.from("stores").update({ license_unit_price: parseInt(licenseUnitPrice) || 50 }).eq("id", storeInfo.id); toast.show("免許資格単価を更新しました", "success"); fetchData(); }} className="px-6 py-2.5 bg-gradient-to-r from-[#c3a782] to-[#b09672] text-white text-[11px] rounded-xl cursor-pointer">保存する</button>
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
                <div><label className="block text-[11px] mb-1" style={{ color: T.textSub }}>システムロール</label><select value={addRole} onChange={(e) => setAddRole(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none cursor-pointer" style={inputStyle}><option value="owner">社長(owner)</option><option value="manager">経営責任者(manager)</option><option value="leader">店長(leader)</option><option value="supervisor">責任者(supervisor)</option><option value="staff">スタッフ(staff)</option></select></div>
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
              <div><label className="block text-[11px] mb-1" style={{ color: T.textSub }}>💸 前借りプリセット</label><input type="text" inputMode="numeric" value={addAdvanceAmount} onChange={(e) => setAddAdvanceAmount(e.target.value.replace(/[^0-9]/g, ""))} placeholder="3000" className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} /><p className="text-[9px] mt-0.5" style={{ color: T.textFaint }}>0 = 前借り対象外（業務委託のみ運用）</p></div>
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
                <div><label className="block text-[11px] mb-1" style={{ color: T.textSub }}>システムロール</label><select value={editRole} onChange={(e) => setEditRole(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none cursor-pointer" style={inputStyle}><option value="owner">社長(owner)</option><option value="manager">経営責任者(manager)</option><option value="leader">店長(leader)</option><option value="supervisor">責任者(supervisor)</option><option value="staff">スタッフ(staff)</option></select></div>
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
              <div><label className="block text-[11px] mb-1" style={{ color: T.textSub }}>💸 前借りプリセット</label><input type="text" inputMode="numeric" value={editAdvanceAmount} onChange={(e) => setEditAdvanceAmount(e.target.value.replace(/[^0-9]/g, ""))} placeholder="3000" className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} /><p className="text-[9px] mt-0.5" style={{ color: T.textFaint }}>0 = 前借り対象外</p></div>
              <div><label className="block text-[11px] mb-1" style={{ color: T.textSub }}>源泉徴収</label><button type="button" onClick={() => setEditWithholding(!editWithholding)} className="w-full px-3 py-2.5 rounded-xl text-[12px] text-left cursor-pointer" style={{ backgroundColor: editWithholding ? "#c4555522" : "#22c55e22", color: editWithholding ? "#c45555" : "#22c55e", border: `1px solid ${editWithholding ? "#c4555544" : "#22c55e44"}` }}>{editWithholding ? "✅ 源泉徴収あり（10.21%）" : "⬜ 源泉徴収なし"}</button></div>
              <div><label className="block text-[11px] mb-1" style={{ color: T.textSub }}>🌙 深夜時間帯単価</label><div className="flex gap-2 items-center"><select value={editNightStart} onChange={(e) => setEditNightStart(e.target.value)} className="px-2 py-2 rounded-xl text-[11px] outline-none cursor-pointer" style={inputStyle}>{TIMES_15MIN.filter(t => t >= "20:00" || t <= "06:00").map(t => <option key={t} value={t}>{t}</option>)}</select><span className="text-[10px]" style={{ color: T.textFaint }}>〜</span><select value={editNightEnd} onChange={(e) => setEditNightEnd(e.target.value)} className="px-2 py-2 rounded-xl text-[11px] outline-none cursor-pointer" style={inputStyle}>{TIMES_15MIN.filter(t => t >= "00:00" && t <= "08:00").map(t => <option key={t} value={t}>{t}</option>)}</select><span className="text-[10px]" style={{ color: T.textFaint }}>+</span><input type="text" inputMode="numeric" value={editNightPrice} onChange={(e) => setEditNightPrice(e.target.value.replace(/[^0-9]/g, ""))} className="w-20 px-2 py-2 rounded-xl text-[11px] outline-none text-center" style={inputStyle} /><span className="text-[10px]" style={{ color: T.textFaint }}>円/u</span></div></div>
              <div><label className="block text-[11px] mb-1" style={{ color: T.textSub }}>📋 適格事業者登録</label><button type="button" onClick={() => setEditHasInvoice(!editHasInvoice)} className="w-full px-3 py-2.5 rounded-xl text-[12px] text-left cursor-pointer mb-2" style={{ backgroundColor: editHasInvoice ? "#22c55e22" : "#88878022", color: editHasInvoice ? "#22c55e" : "#888780", border: `1px solid ${editHasInvoice ? "#22c55e44" : "#88878044"}` }}>{editHasInvoice ? "✅ 適格事業者登録あり" : "⬜ 適格事業者登録なし"}</button>{editHasInvoice && <div className="space-y-2"><input type="text" value={editInvoiceNum} onChange={(e) => setEditInvoiceNum(e.target.value)} placeholder="T1234567890123" className="w-full px-3 py-2 rounded-xl text-[11px] outline-none" style={inputStyle} /><label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[10px] cursor-pointer font-medium" style={{ backgroundColor: "#85a8c418", color: "#85a8c4", border: "1px solid #85a8c444" }}>📎 写真をアップロード<input type="file" accept="image/*" onChange={(e) => setEditInvoicePhoto(e.target.files?.[0] || null)} className="hidden" /></label>{editInvoicePhoto && <span className="text-[10px] ml-2" style={{ color: "#22c55e" }}>✅ {editInvoicePhoto.name}</span>}{editStaff?.invoice_photo_url && <a href={editStaff.invoice_photo_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 px-2 py-1.5 rounded-lg" style={{ backgroundColor: "#85a8c412", border: "1px solid #85a8c433" }}><img src={editStaff.invoice_photo_url.replace("invoice_", "invoice_thumb_").replace(".pdf", ".jpg")} alt="適格事業者" className="rounded" style={{ width: 40, height: 40, objectFit: "cover" }} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} /><span className="text-[10px]" style={{ color: "#85a8c4" }}>📄 適格事業者証明を表示</span></a>}</div>}</div>
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

      {/* 前借り金額変更モーダル */}
      {advEditModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <div className="rounded-2xl p-5 w-full max-w-sm" style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}>
            <p className="text-[14px] font-medium mb-1">💸 前借り金額変更</p>
            <p className="text-[11px] mb-4" style={{ color: T.textSub }}>{advEditModal.staff.name}</p>
            <div className="mb-3">
              <label className="block text-[11px] mb-1" style={{ color: T.textSub }}>金額</label>
              <input type="text" inputMode="numeric" value={advEditAmount} onChange={e => setAdvEditAmount(e.target.value.replace(/[^0-9]/g, ""))} placeholder="3000" className="w-full px-3 py-2.5 rounded-xl text-[13px] outline-none tabular-nums text-right" style={{ backgroundColor: T.cardAlt, color: T.text, border: `1px solid ${T.border}` }} autoFocus />
              <div className="flex gap-1 mt-2">
                {[1000, 2000, 3000, 5000].map(v => (
                  <button key={v} onClick={() => setAdvEditAmount(String(v))} className="flex-1 px-2 py-1 rounded text-[10px] cursor-pointer" style={{ backgroundColor: T.cardAlt, color: T.textSub, border: `1px solid ${T.border}` }}>¥{v.toLocaleString()}</button>
                ))}
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-[11px] mb-1" style={{ color: T.textSub }}>理由（任意）</label>
              <input type="text" value={advEditReason} onChange={e => setAdvEditReason(e.target.value)} placeholder="例: 短時間勤務のため" className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={{ backgroundColor: T.cardAlt, color: T.text, border: `1px solid ${T.border}` }} />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setAdvEditModal(null)} className="flex-1 px-3 py-2 rounded-xl text-[11px] cursor-pointer border" style={{ borderColor: T.border, color: T.textSub }}>キャンセル</button>
              <button onClick={async () => {
                const amt = parseInt(advEditAmount) || 0;
                if (amt <= 0) { toast.show("金額を入力してください", "error"); return; }
                await recordAdvance(advEditModal.staff, amt, advEditReason.trim());
                setAdvEditModal(null);
              }} className="flex-1 px-3 py-2 rounded-xl text-[11px] cursor-pointer font-medium" style={{ backgroundColor: "#d4687e", color: "#fff" }}>記録する</button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  );
}
