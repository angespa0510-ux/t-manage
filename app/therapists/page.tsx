"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";
import { useTheme } from "../../lib/theme";
import { NavMenu } from "../../lib/nav-menu";
import { jsPDF } from "jspdf";
import { useToast } from "../../lib/toast";

type Therapist = {
  id: number; created_at: string; name: string; phone: string; status: string;
  salary_type: string; salary_amount: number; age: number; interval_minutes: number; transport_fee: number;
  height_cm: number; bust: number; waist: number; hip: number; cup: string;
  photo_url: string; photo_width: number; photo_height: number; notes: string;
  email: string; email_verified: boolean; email_token: string;
  has_withholding: boolean;
  real_name: string; address: string; has_invoice: boolean; therapist_invoice_number: string; invoice_photo_url: string; license_photo_url: string; license_photo_url_back: string; birth_date: string; sort_order: number;
};

export default function TherapistManagement() {
  const router = useRouter();
  const { dark, toggle, T } = useTheme();
  const toast = useToast();
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [storeInfo, setStoreInfo] = useState<{ company_name: string; company_address: string; company_phone: string; invoice_number: string } | null>(null);
  const [showPayroll, setShowPayroll] = useState(false);
  const [payrollYear, setPayrollYear] = useState(String(new Date().getFullYear()));
  const [payrollData, setPayrollData] = useState<{ id: number; name: string; address: string; total: number; tax: number; transport: number; days: number }[]>([]);
  const [payrollLoading, setPayrollLoading] = useState(false);

  // Add
  const [showAdd, setShowAdd] = useState(false);
  const [addName, setAddName] = useState(""); const [addPhone, setAddPhone] = useState(""); const [addStatus, setAddStatus] = useState("active");
  const [addSalaryType, setAddSalaryType] = useState("fixed"); const [addSalaryAmount, setAddSalaryAmount] = useState("");
  const [addAge, setAddAge] = useState(""); const [addInterval, setAddInterval] = useState("10"); const [addTransport, setAddTransport] = useState("0");
  const [addHeight, setAddHeight] = useState(""); const [addBust, setAddBust] = useState(""); const [addWaist, setAddWaist] = useState(""); const [addHip, setAddHip] = useState(""); const [addCup, setAddCup] = useState("");
  const [addPhotoW, setAddPhotoW] = useState("400"); const [addPhotoH, setAddPhotoH] = useState("600");
  const [addPhotoFile, setAddPhotoFile] = useState<File | null>(null); const [addPhotoPreview, setAddPhotoPreview] = useState("");
  const [addNotes, setAddNotes] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [saving, setSaving] = useState(false); const [msg, setMsg] = useState("");
  const addFileRef = useRef<HTMLInputElement>(null);

  // Edit
  const [editTarget, setEditTarget] = useState<Therapist | null>(null);
  const [editName, setEditName] = useState(""); const [editPhone, setEditPhone] = useState(""); const [editStatus, setEditStatus] = useState("");
  const [editSalaryType, setEditSalaryType] = useState("fixed"); const [editSalaryAmount, setEditSalaryAmount] = useState("");
  const [editAge, setEditAge] = useState(""); const [editInterval, setEditInterval] = useState("10"); const [editTransport, setEditTransport] = useState("0");
  const [editHeight, setEditHeight] = useState(""); const [editBust, setEditBust] = useState(""); const [editWaist, setEditWaist] = useState(""); const [editHip, setEditHip] = useState(""); const [editCup, setEditCup] = useState("");
  const [editPhotoW, setEditPhotoW] = useState("400"); const [editPhotoH, setEditPhotoH] = useState("600");
  const [editWithholding, setEditWithholding] = useState(false);
  const [editTab, setEditTab] = useState<"basic" | "personal">("basic");
  const [editPinInput, setEditPinInput] = useState("");
  const [editPinAuthed, setEditPinAuthed] = useState(false);
  const [editPinError, setEditPinError] = useState("");
  const [editRealName, setEditRealName] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editHasInvoice, setEditHasInvoice] = useState(false);
  const [editInvoiceNum, setEditInvoiceNum] = useState("");
  const [editInvoicePhoto, setEditInvoicePhoto] = useState<File | null>(null);
  const [editLicensePhoto, setEditLicensePhoto] = useState<File | null>(null);
  const [editLicensePhotoBack, setEditLicensePhotoBack] = useState<File | null>(null);
  const [editBirthDate, setEditBirthDate] = useState("");
  const [editPhotoFile, setEditPhotoFile] = useState<File | null>(null); const [editPhotoPreview, setEditPhotoPreview] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editSaving, setEditSaving] = useState(false); const [editMsg, setEditMsg] = useState("");
  const editFileRef = useRef<HTMLInputElement>(null);

  // Detail
  const [detailTarget, setDetailTarget] = useState<Therapist | null>(null);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<Therapist | null>(null); const [deleting, setDeleting] = useState(false);

  const fetchTherapists = useCallback(async () => {
    const { data } = await supabase.from("therapists").select("*").order("sort_order", { ascending: true }).order("created_at", { ascending: false });
    if (data) setTherapists(data);
  }, []);

  useEffect(() => { const check = async () => { const { data: { user } } = await supabase.auth.getUser(); if (!user) router.push("/"); }; check(); fetchTherapists(); const fetchStore = async () => { const { data } = await supabase.from("stores").select("company_name, company_address, company_phone, invoice_number"); if (data?.[0]) setStoreInfo(data[0]); }; fetchStore(); }, [router, fetchTherapists]);

    const fetchPayroll = async () => {
    setPayrollLoading(true);
    const startDate = `${payrollYear}-01-01`;
    const endDate = `${payrollYear}-12-31`;
    const { data: settlements } = await supabase.from("therapist_daily_settlements").select("therapist_id, total_back, invoice_deduction, withholding_tax, adjustment, total_sales, total_cash, total_card, total_paypay").gte("date", startDate).lte("date", endDate).eq("is_settled", true);
    const thMap: Record<number, { name: string; address: string; gross: number; tax: number; transport: number; days: number }> = {};
    (settlements || []).forEach(s => {
      if (!thMap[s.therapist_id]) {
        const th = therapists.find(t => t.id === s.therapist_id);
        thMap[s.therapist_id] = { name: th?.name || "不明", address: th?.address || "", gross: 0, tax: 0, transport: 0, days: 0 };
      }
      const th = therapists.find(t => t.id === s.therapist_id);
      const transportFee = th?.transport_fee || 0;
      const backAmt = (s.total_back || 0) + (s.adjustment || 0);
      const invDed = s.invoice_deduction || 0;
      const adjusted = backAmt - invDed + (s.adjustment || 0);
      let dayWT = s.withholding_tax || 0;
      if (dayWT === 0 && th && (th as any).has_withholding) {
        dayWT = Math.floor(Math.max(adjusted - 5000, 0) * 0.1021);
      }
      thMap[s.therapist_id].gross += backAmt;
      thMap[s.therapist_id].tax += dayWT;
      thMap[s.therapist_id].transport += transportFee;
      thMap[s.therapist_id].days += 1;
    });
    const result = Object.entries(thMap).map(([id, d]) => ({ id: Number(id), name: d.name, address: d.address, total: d.gross, tax: d.tax, transport: d.transport, days: d.days }));
    result.sort((a, b) => b.total - a.total);
    setPayrollData(result);
    setPayrollLoading(false);
  };

  const openPayrollPDF = (row: typeof payrollData[0]) => {
    const store = storeInfo;
    const th = therapists.find(t => t.id === row.id);
    const realName = th?.real_name || row.name;
    const hasInvoice = th?.has_invoice || false;
    const invoiceNum = (th as any)?.therapist_invoice_number || "";
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>支払調書_${payrollYear}_${realName}</title><style>body{font-family:'Hiragino Sans','Yu Gothic','Meiryo',sans-serif;max-width:700px;margin:40px auto;padding:30px;color:#333}h1{text-align:center;font-size:22px;border-bottom:3px double #333;padding-bottom:10px;margin-bottom:5px}h2{text-align:center;font-size:12px;color:#888;font-weight:normal;margin-bottom:30px}table{width:100%;border-collapse:collapse;margin:20px 0}td,th{border:1px solid #ccc;padding:10px 14px;font-size:13px}th{background:#f5f0e8;text-align:left;width:40%}.right{text-align:right}.total-row{background:#f9f6f0;font-weight:bold;font-size:15px}.section{margin-top:30px;padding-top:15px;border-top:1px solid #ddd}.company{font-size:11px;line-height:2;color:#555}.note{font-size:10px;color:#888;margin-top:5px}@media print{body{margin:0;padding:20px}}</style></head><body>
    <h1>支払調書</h1>
    <h2>${payrollYear}年1月1日 〜 ${payrollYear}年12月31日</h2>
    <table>
    <tr><th>支払先（氏名）</th><td>${realName}</td></tr>
    <tr><th>源氏名</th><td>${row.name}</td></tr>
    ${th?.address ? `<tr><th>住所</th><td>${th.address}</td></tr>` : ""}
    <tr><th>区分</th><td>セラピスト（業務委託）</td></tr>
    <tr><th>適格事業者</th><td>${hasInvoice ? `登録あり（${invoiceNum}）` : "未登録"}</td></tr>
    </table>
    <table>
    <tr><th>項目</th><th class="right">金額</th><th>備考</th></tr>
    <tr><td>稼働日数</td><td class="right">${row.days}日</td><td style="font-size:11px;color:#888">年間清算回数</td></tr>
    <tr><td>支払金額（税込）</td><td class="right">&yen;${row.total.toLocaleString()}</td><td style="font-size:11px;color:#888">年間バック合計（税込・源泉前）</td></tr>
    ${row.transport > 0 ? `<tr><td>うち交通費（非課税）</td><td class="right">&yen;${row.transport.toLocaleString()}</td><td style="font-size:11px;color:#888">&yen;${Math.round(row.transport / row.days).toLocaleString()}/日 × ${row.days}日</td></tr>` : ""}
    ${row.tax > 0 ? `<tr><td style="color:#c45555">源泉徴収税額（清算時控除済）</td><td class="right" style="color:#c45555">&yen;${row.tax.toLocaleString()}</td><td style="font-size:11px;color:#888">日次清算で差し引き済み</td></tr>` : `<tr><td>源泉徴収</td><td class="right">なし</td><td style="font-size:11px;color:#888">源泉徴収対象外</td></tr>`}
    <tr class="total-row"><td>差引支払額</td><td class="right">&yen;${(row.total - row.tax).toLocaleString()}</td><td></td></tr>
    </table>
    <p class="note">※ 支払金額は全て税込（内税方式）で記載しています。</p>
    <p class="note">※ 本書は所得税法第225条に基づく「報酬、料金、契約金及び賞金の支払調書」に準じて発行しています。</p>
    <div class="section"><p style="font-size:12px;color:#888">支払者</p><div class="company"><p><strong>${store?.company_name || ""}</strong></p><p>${store?.company_address || ""}</p><p>TEL: ${store?.company_phone || ""}</p>${store?.invoice_number ? `<p>適格事業者番号: ${store.invoice_number}</p>` : ""}</div></div>
    </body></html>`);
    w.document.close();
  };

  const uploadPhoto = async (file: File, therapistId: number): Promise<string> => {
    const ext = file.name.split(".").pop(); const fileName = `${therapistId}_${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("therapist-photos").upload(fileName, file, { upsert: true });
    if (error) { console.error("Upload error:", error); return ""; }
    const { data } = supabase.storage.from("therapist-photos").getPublicUrl(fileName);
    return data.publicUrl;
  };

  const handleAdd = async () => {
    if (!addName.trim()) { setMsg("名前を入力してください"); return; }
    setSaving(true); setMsg("");
    const { data, error } = await supabase.from("therapists").insert({
      name: addName.trim(), phone: addPhone.trim(), status: addStatus,
      salary_type: addSalaryType, salary_amount: parseInt(addSalaryAmount) || 0,
      age: parseInt(addAge) || 0, interval_minutes: parseInt(addInterval) || 10, transport_fee: parseInt(addTransport) || 0,
      height_cm: parseInt(addHeight) || 0, bust: parseInt(addBust) || 0, waist: parseInt(addWaist) || 0, hip: parseInt(addHip) || 0, cup: addCup,
      photo_width: parseInt(addPhotoW) || 400, photo_height: parseInt(addPhotoH) || 600,
      notes: addNotes.trim(),
      email: addEmail.trim(), email_verified: false, email_token: crypto.randomUUID(),
    }).select().single();
    if (error) { setSaving(false); setMsg("登録失敗: " + error.message); return; }
    if (addPhotoFile && data) {
      const url = await uploadPhoto(addPhotoFile, data.id);
      if (url) await supabase.from("therapists").update({ photo_url: url }).eq("id", data.id);
    }
    setSaving(false); setMsg("登録しました！");
    setAddName(""); setAddPhone(""); setAddStatus("active"); setAddSalaryType("fixed"); setAddSalaryAmount(""); setAddAge(""); setAddInterval("10"); setAddTransport("0");
    setAddHeight(""); setAddBust(""); setAddWaist(""); setAddHip(""); setAddCup(""); setAddPhotoFile(null); setAddPhotoPreview(""); setAddPhotoW("400"); setAddPhotoH("600"); setAddNotes(""); setAddEmail("");
    fetchTherapists(); setTimeout(() => { setShowAdd(false); setMsg(""); }, 800);
  };

  const startEdit = (t: Therapist) => {
    setEditTarget(t); setEditName(t.name || ""); setEditPhone(t.phone || ""); setEditStatus(t.status || "active");
    setEditSalaryType(t.salary_type || "fixed"); setEditSalaryAmount(String(t.salary_amount || 0)); setEditTransport(String(t.transport_fee || 0));
    setEditAge(String(t.age || "")); setEditInterval(String(t.interval_minutes || 10));
    setEditHeight(String(t.height_cm || "")); setEditBust(String(t.bust || "")); setEditWaist(String(t.waist || "")); setEditHip(String(t.hip || "")); setEditCup(t.cup || "");
    setEditPhotoW(String(t.photo_width || 400)); setEditPhotoH(String(t.photo_height || 600));
    setEditWithholding(t.has_withholding || false);
    setEditTab("basic"); setEditPinAuthed(false); setEditPinInput(""); setEditPinError("");
    setEditRealName(t.real_name || ""); setEditAddress(t.address || "");
    setEditHasInvoice(t.has_invoice || false); setEditInvoiceNum(t.therapist_invoice_number || "");
    setEditInvoicePhoto(null); setEditLicensePhoto(null); setEditLicensePhotoBack(null);
    setEditBirthDate(t.birth_date || "");
    setEditPhotoFile(null); setEditPhotoPreview(t.photo_url || ""); setEditNotes(t.notes || ""); setEditEmail(t.email || ""); setEditMsg("");
  };

  const handleUpdate = async () => {
    if (!editTarget || !editName.trim()) { setEditMsg("名前を入力してください"); return; }
    setEditSaving(true); setEditMsg("");
    let photoUrl = editTarget.photo_url || "";
    if (editPhotoFile) { const url = await uploadPhoto(editPhotoFile, editTarget.id); if (url) photoUrl = url; }
    const { error } = await supabase.from("therapists").update({
      name: editName.trim(), phone: editPhone.trim(), status: editStatus,
      salary_type: editSalaryType, salary_amount: parseInt(editSalaryAmount) || 0,
      age: parseInt(editAge) || 0, interval_minutes: parseInt(editInterval) || 10, transport_fee: parseInt(editTransport) || 0,
      height_cm: parseInt(editHeight) || 0, bust: parseInt(editBust) || 0, waist: parseInt(editWaist) || 0, hip: parseInt(editHip) || 0, cup: editCup,
      photo_url: photoUrl, photo_width: parseInt(editPhotoW) || 400, photo_height: parseInt(editPhotoH) || 600,
      notes: editNotes.trim(),
      has_withholding: editWithholding,
      real_name: editRealName.trim(), address: editAddress.trim(), birth_date: editBirthDate,
      has_invoice: editHasInvoice, therapist_invoice_number: editInvoiceNum.trim(),
      email: editEmail.trim(),
      ...(editEmail.trim() !== (editTarget.email || "") ? { email_verified: false, email_token: crypto.randomUUID() } : {}),
    }).eq("id", editTarget.id);
    setEditSaving(false);
    if (error) { setEditMsg("更新失敗: " + error.message); }
    else { setEditMsg("更新しました！"); fetchTherapists(); setTimeout(() => { setEditTarget(null); setEditMsg(""); }, 800); }
  const now = new Date();
      const dateStr = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,"0")}${String(now.getDate()).padStart(2,"0")}`;
      const uploadDocPDF = async (file: File, label: string, idNum: number): Promise<string> => {
        const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
        const canvas = document.createElement("canvas");
        canvas.width = bmp.width; canvas.height = bmp.height;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(bmp, 0, 0);
        bmp.close();
        const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
        const img = { width: canvas.width, height: canvas.height };
        const headerH = 40;
        const isLicense = label.includes("license");
        const pageW = isLicense ? Math.max(img.width, img.height, 800) : Math.max(img.width, 500);
        const pageH = (isLicense ? Math.min(img.width, img.height) : img.height) + headerH;
        const pdf = new jsPDF({ orientation: isLicense ? "landscape" : (img.width > img.height ? "landscape" : "portrait"), unit: "px", format: isLicense ? [pageH, pageW] : (img.width > img.height ? [pageH, pageW] : [pageW, pageH]) });
        pdf.setFontSize(14); pdf.setTextColor(80,80,80); pdf.text(label, 15, 25);
        pdf.setFontSize(10); pdf.setTextColor(130,130,130); pdf.text(`${editName.trim()} - ${dateStr}`, 15, 45);
        const drawW = isLicense ? Math.max(img.width, img.height) : img.width;
        const drawH = isLicense ? Math.min(img.width, img.height) : img.height;
        pdf.addImage(dataUrl, "JPEG", 0, headerH, drawW, drawH);
        const pdfBlob = pdf.output("blob");
        const fileName = `therapist_${label}_${idNum}_${dateStr}.pdf`;
        await supabase.storage.from("therapist-photos").upload(fileName, pdfBlob, { contentType: "application/pdf", upsert: true });
        const { data: urlData } = supabase.storage.from("therapist-photos").getPublicUrl(fileName);
        return urlData.publicUrl;
      };
      try {
        if (editInvoicePhoto && editTarget) {
          const url = await uploadDocPDF(editInvoicePhoto, "invoice", editTarget.id);
          await supabase.from("therapists").update({ invoice_photo_url: url }).eq("id", editTarget.id);
        }
        if (editLicensePhoto && editTarget) {
          const url = await uploadDocPDF(editLicensePhoto, "license_front", editTarget.id);
          await supabase.from("therapists").update({ license_photo_url: url }).eq("id", editTarget.id);
        }
        if (editLicensePhotoBack && editTarget) {
          const url = await uploadDocPDF(editLicensePhotoBack, "license_back", editTarget.id);
          await supabase.from("therapists").update({ license_photo_url_back: url }).eq("id", editTarget.id);
        }
      } catch (e) { console.error("upload error:", e); }
      fetchTherapists();
    }

  const handleDelete = async () => { if (!deleteTarget) return; setDeleting(true); await supabase.from("therapists").delete().eq("id", deleteTarget.id); setDeleting(false); setDeleteTarget(null); fetchTherapists(); };

  const sendConfirmEmail = async (t: Therapist) => {
    let token = t.email_token;
    if (!token) { token = crypto.randomUUID(); await supabase.from("therapists").update({ email_token: token }).eq("id", t.id); }
    const confirmUrl = `${window.location.origin}/confirm-email?token=${token}`;
    const subject = encodeURIComponent("【チョップ】メールアドレス確認のお願い");
    const body = encodeURIComponent(`${t.name} 様\n\nチョップからのメールアドレス確認です。\n以下のリンクをクリックして確認を完了してください。\n\n${confirmUrl}\n\n※このリンクはお一人様専用です。\n\nよろしくお願いいたします。\nチョップ`);
    window.open(`https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(t.email)}&su=${subject}&body=${body}`, "_blank");
  };

  const handleFileChange = (file: File | null, isEdit: boolean) => {
    if (!file) return;
    if (isEdit) { setEditPhotoFile(file); setEditPhotoPreview(URL.createObjectURL(file)); }
    else { setAddPhotoFile(file); setAddPhotoPreview(URL.createObjectURL(file)); }
  };

  const filtered = therapists.filter((t) => {
    const q = searchQuery.toLowerCase();
    const matchSearch = t.name?.toLowerCase().includes(q) || t.phone?.includes(q);
    const matchStatus = filterStatus === "all" || t.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const statusMap: Record<string, { bg: string; text: string; label: string }> = {
    active: { bg: "#4a7c5918", text: "#4a7c59", label: "稼働中" },
    inactive: { bg: "#88878018", text: "#888780", label: "休止中" },
    retired: { bg: "#c4555518", text: "#c45555", label: "退職" },
  };
  const colors = ["#c3a782", "#7ab88f", "#85a8c4", "#c49885", "#a885c4", "#85c4b8", "#c4a685", "#8599c4"];
  const inputStyle = { backgroundColor: T.cardAlt, color: T.text, border: "1px solid transparent" };
  const CUPS = ["", "A", "B", "C", "D", "E", "F", "G", "H", "I"];
  const INTERVALS = ["5", "10", "15", "20", "25", "30"];

  const getSalaryLabel = (t: Therapist) => {
    if (!t.salary_amount) return "";
    return t.salary_type === "percent" ? `${t.salary_amount}%UP` : `${t.salary_amount.toLocaleString()}円UP`;
  };

  const PhotoField = ({ preview, fileRef, onFileChange, width, height, onWidthChange, onHeightChange }: { preview: string; fileRef: React.RefObject<HTMLInputElement | null>; onFileChange: (f: File | null) => void; width: string; height: string; onWidthChange: (v: string) => void; onHeightChange: (v: string) => void }) => (
    <div>
      <label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>写真</label>
      <div className="flex gap-3 items-start">
        <div onClick={() => fileRef.current?.click()} className="rounded-xl border-2 border-dashed flex items-center justify-center cursor-pointer overflow-hidden" style={{ width: 80, height: 100, borderColor: preview ? "transparent" : T.border, backgroundColor: T.cardAlt }}>
          {preview ? <img src={preview} alt="" style={{ width: 80, height: 100, objectFit: "cover" }} /> : <span className="text-[20px]" style={{ color: T.textFaint }}>+</span>}
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFileChange(e.target.files?.[0] || null)} />
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <label className="text-[9px]" style={{ color: T.textMuted }}>幅</label>
            <input type="text" inputMode="numeric" value={width} onChange={(e) => onWidthChange(e.target.value.replace(/[^0-9]/g, ""))} className="w-16 px-2 py-1 rounded text-[11px] outline-none" style={inputStyle} />
            <span className="text-[9px]" style={{ color: T.textFaint }}>px</span>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[9px]" style={{ color: T.textMuted }}>高</label>
            <input type="text" inputMode="numeric" value={height} onChange={(e) => onHeightChange(e.target.value.replace(/[^0-9]/g, ""))} className="w-16 px-2 py-1 rounded text-[11px] outline-none" style={inputStyle} />
            <span className="text-[9px]" style={{ color: T.textFaint }}>px</span>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="h-screen flex flex-col" style={{ backgroundColor: T.bg, color: T.text }}>
      {/* Header */}
      <div className="h-[64px] backdrop-blur-xl border-b flex items-center justify-between px-6 flex-shrink-0" style={{ backgroundColor: dark ? T.card + "cc" : "rgba(255,255,255,0.8)", borderColor: T.border }}>
        <div className="flex items-center gap-4">
          <NavMenu T={T} dark={dark} />
          <div><h1 className="text-[15px] font-medium">セラピスト管理</h1><p className="text-[11px]" style={{ color: T.textMuted }}>{therapists.length}名のセラピスト</p></div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={toggle} className="px-3 py-1.5 text-[10px] rounded-lg cursor-pointer border" style={{ borderColor: T.border, color: T.textSub }}>{dark ? "☀️ ライト" : "🌙 ダーク"}</button>
          <button onClick={() => setShowPayroll(!showPayroll)} className="px-3 py-1.5 text-[10px] rounded-lg cursor-pointer border" style={{ borderColor: "#85a8c444", color: "#85a8c4" }}>📑 支払調書</button>
          <button onClick={() => { setShowAdd(true); setMsg(""); }} className="px-4 py-2 bg-gradient-to-r from-[#c3a782] to-[#b09672] text-white text-[11px] rounded-xl cursor-pointer">+ 新規登録</button>
        </div>
      </div>

      {showPayroll && (
        <div className="mx-6 mt-4 rounded-2xl p-5" style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}>
          <h2 className="text-[14px] font-medium mb-3">📑 セラピスト支払調書</h2>
          <div className="flex items-center gap-3 mb-4">
            <select value={payrollYear} onChange={(e) => setPayrollYear(e.target.value)} className="px-3 py-2 rounded-xl text-[12px] outline-none cursor-pointer border" style={{ backgroundColor: T.cardAlt, borderColor: T.border, color: T.text }}>
              {[...Array(5)].map((_, i) => { const y = new Date().getFullYear() - i; return <option key={y} value={String(y)}>{y}年</option>; })}
            </select>
            <button onClick={fetchPayroll} className="px-4 py-2 bg-gradient-to-r from-[#c3a782] to-[#b09672] text-white text-[11px] rounded-xl cursor-pointer">{payrollLoading ? "読込中..." : "生成する"}</button>
            {payrollData.length > 0 && <button onClick={() => payrollData.forEach(r => openPayrollPDF(r))} className="px-3 py-1.5 border text-[10px] rounded-xl cursor-pointer" style={{ borderColor: "#85a8c444", color: "#85a8c4" }}>📥 全員分表示</button>}
          </div>
          {payrollData.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px]" style={{ color: T.textMuted }}>{payrollYear}年 — {payrollData.length}名</p>
              {payrollData.map((row, i) => (
                <div key={i} className="rounded-xl p-3 flex items-center justify-between" style={{ backgroundColor: T.cardAlt }}>
                  <div>
                    <span className="text-[13px] font-medium">{row.name}</span>
                    <div className="flex gap-4 mt-1">
                      <span className="text-[11px]" style={{ color: T.textMuted }}>{row.days}日</span>
                      <span className="text-[11px]" style={{ color: T.textMuted }}>支払: <span style={{ color: T.text }}>¥{row.total.toLocaleString()}</span></span>
                      {row.transport > 0 && <span className="text-[11px]" style={{ color: T.textMuted }}>交通費: ¥{row.transport.toLocaleString()}</span>}
                      {row.tax > 0 && <span className="text-[11px]" style={{ color: "#c45555" }}>源泉: ¥{row.tax.toLocaleString()}</span>}
                      <span className="text-[11px] font-medium" style={{ color: "#22c55e" }}>差引: ¥{(row.total - row.tax).toLocaleString()}</span>
                    </div>
                  </div>
                  <button onClick={() => openPayrollPDF(row)} className="px-3 py-1.5 rounded-lg text-[10px] cursor-pointer" style={{ backgroundColor: "#85a8c418", color: "#85a8c4", border: "1px solid #85a8c444" }}>📄 表示</button>
                </div>
              ))}
              <div className="rounded-xl p-3 mt-2" style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}>
                <div className="flex justify-between text-[12px] font-medium"><span>合計支払額</span><span>¥{payrollData.reduce((s, r) => s + r.total, 0).toLocaleString()}</span></div>
                <div className="flex justify-between text-[11px] mt-1" style={{ color: "#c45555" }}><span>合計源泉徴収</span><span>¥{payrollData.reduce((s, r) => s + r.tax, 0).toLocaleString()}</span></div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Search + Filter */}
      <div className="border-b px-6 py-3 flex items-center gap-4 flex-wrap" style={{ backgroundColor: T.card, borderColor: T.border }}>
        <div className="relative max-w-sm flex-1">
          <input type="text" placeholder="名前・電話番号で検索" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} />
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.textFaint} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        </div>
        <div className="flex gap-1.5">
          <button onClick={() => setFilterStatus("all")} className="px-2.5 py-1.5 rounded-lg text-[10px] cursor-pointer border" style={{ borderColor: filterStatus === "all" ? T.accent : T.border, backgroundColor: filterStatus === "all" ? T.accent + "18" : "transparent", color: filterStatus === "all" ? T.accent : T.textMuted, fontWeight: filterStatus === "all" ? 600 : 400 }}>全て {therapists.length}</button>
          {Object.entries(statusMap).map(([key, val]) => (
            <button key={key} onClick={() => setFilterStatus(filterStatus === key ? "all" : key)} className="px-2.5 py-1.5 rounded-lg text-[10px] cursor-pointer border"
              style={{ borderColor: filterStatus === key ? val.text : T.border, backgroundColor: filterStatus === key ? val.bg : "transparent", color: filterStatus === key ? val.text : T.textMuted, fontWeight: filterStatus === key ? 600 : 400 }}>
              {val.label} {therapists.filter((t) => t.status === key).length}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-6">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full">
            <p className="text-[14px]" style={{ color: T.textMuted }}>{therapists.length === 0 ? "セラピストが登録されていません" : "検索結果がありません"}</p>
            {therapists.length === 0 && <button onClick={() => setShowAdd(true)} className="mt-4 px-5 py-2.5 bg-gradient-to-r from-[#c3a782] to-[#b09672] text-white text-[12px] rounded-xl cursor-pointer">+ セラピストを登録</button>}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2">
            {filtered.map((t, i) => {
              const st = statusMap[t.status] || statusMap.active;
              return (
                <div key={t.id} draggable onDragStart={(e) => { e.dataTransfer.setData("therapistId", String(t.id)); e.dataTransfer.setData("sortOrder", String(t.sort_order || i)); }} onDragOver={(e) => e.preventDefault()} onDrop={async (e) => { e.preventDefault(); const fromId = Number(e.dataTransfer.getData("therapistId")); if (fromId === t.id) return; const fromIdx = filtered.findIndex(x => x.id === fromId); const toIdx = filtered.findIndex(x => x.id === t.id); if (fromIdx < 0 || toIdx < 0) return; const reordered = [...filtered]; const [moved] = reordered.splice(fromIdx, 1); reordered.splice(toIdx, 0, moved); for (let j = 0; j < reordered.length; j++) { await supabase.from("therapists").update({ sort_order: j }).eq("id", reordered[j].id); } fetchTherapists(); }} className="rounded-xl border p-2.5 transition-all duration-200 cursor-grab active:cursor-grabbing hover:shadow-md" style={{ backgroundColor: T.card, borderColor: T.border }} onClick={() => setDetailTarget(t)}>
                  <div className="flex items-center gap-2 mb-1.5">
                    {t.photo_url ? (
                      <img src={t.photo_url} alt={t.name} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] text-white font-medium flex-shrink-0" style={{ backgroundColor: colors[i % colors.length] }}>{t.name?.charAt(0)}</div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1"><p className="text-[11px] font-medium truncate">{t.name}</p><span className="px-1.5 py-0.5 rounded text-[7px] font-medium flex-shrink-0" style={{ backgroundColor: st.bg, color: st.text }}>{st.label}</span></div>
                      <p className="text-[9px] truncate" style={{ color: T.textMuted }}>{t.phone || "電話番号なし"}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-x-2 text-[8px] mb-1" style={{ color: T.textSub }}>
                    {t.age > 0 && <span>{t.age}歳</span>}
                    {t.interval_minutes > 0 && <span>{t.interval_minutes}分</span>}
                    {t.height_cm > 0 && <span>{t.height_cm}cm</span>}
                    {t.cup && <span>{t.cup}</span>}
                  </div>
                  <div className="flex items-center justify-between" onClick={(e) => e.stopPropagation()}>
                    <div className="flex gap-1">
                      <button onClick={() => startEdit(t)} className="px-2 py-1 text-[8px] rounded cursor-pointer" style={{ color: "#3d6b9f", backgroundColor: "#3d6b9f18" }}>編集</button>
                      <button onClick={() => setDeleteTarget(t)} className="px-2 py-1 text-[8px] rounded cursor-pointer" style={{ color: "#c45555", backgroundColor: "#c4555518" }}>削除</button>
                    </div>
                    <span className="text-[7px]" style={{ color: T.textFaint }}>⋮⋮</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Summary */}
      <div className="border-t p-4 flex-shrink-0" style={{ backgroundColor: T.card, borderColor: T.border }}>
        <div className="flex items-center gap-6 text-[11px]" style={{ color: T.textSub }}>
          <span>合計: <strong style={{ color: T.text }}>{therapists.length}</strong>名</span>
          <span>稼働中: <strong style={{ color: "#4a7c59" }}>{therapists.filter((t) => t.status === "active").length}</strong>名</span>
          <span>休止中: <strong style={{ color: T.textSub }}>{therapists.filter((t) => t.status === "inactive").length}</strong>名</span>
          <span>退職: <strong style={{ color: "#c45555" }}>{therapists.filter((t) => t.status === "retired").length}</strong>名</span>
        </div>
      </div>

      {/* Detail Modal */}
      {detailTarget && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setDetailTarget(null)}>
          <div className="rounded-2xl border w-full max-w-md max-h-[90vh] overflow-y-auto animate-[fadeIn_0.25s]" style={{ backgroundColor: T.card, borderColor: T.border }} onClick={(e) => e.stopPropagation()}>
            {detailTarget.photo_url && (
              <div className="flex justify-center pt-6">
                <img src={detailTarget.photo_url} alt={detailTarget.name} className="rounded-xl object-cover" style={{ width: detailTarget.photo_width || 400, height: detailTarget.photo_height || 600, maxWidth: "100%", maxHeight: 400 }} />
              </div>
            )}
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                {!detailTarget.photo_url && <div className="w-16 h-16 rounded-full flex items-center justify-center text-[22px] text-white font-medium" style={{ backgroundColor: colors[therapists.indexOf(detailTarget) % colors.length] }}>{detailTarget.name?.charAt(0)}</div>}
                <div>
                  <div className="flex items-center gap-2"><h2 className="text-[20px] font-medium">{detailTarget.name}</h2><span className="px-2 py-0.5 rounded-md text-[10px] font-medium" style={{ backgroundColor: (statusMap[detailTarget.status] || statusMap.active).bg, color: (statusMap[detailTarget.status] || statusMap.active).text }}>{(statusMap[detailTarget.status] || statusMap.active).label}</span></div>
                  <p className="text-[12px]" style={{ color: T.textSub }}>{detailTarget.phone || "電話番号なし"}</p>
                  {detailTarget.email && <div className="flex items-center gap-2 mt-0.5"><p className="text-[11px]" style={{ color: T.textSub }}>✉️ {detailTarget.email}</p>{detailTarget.email_verified ? <span className="text-[8px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "#22c55e18", color: "#22c55e" }}>✅確認済み</span> : <span className="text-[8px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "#f59e0b18", color: "#f59e0b" }}>未確認</span>}</div>}
                </div>
              </div>
              <div className="space-y-3">
                {getSalaryLabel(detailTarget) && <div className="flex justify-between text-[12px]"><span style={{ color: T.textMuted }}>給料ランク</span><span className="font-medium" style={{ color: "#c3a782" }}>{getSalaryLabel(detailTarget)}</span></div>}
                {detailTarget.age > 0 && <div className="flex justify-between text-[12px]"><span style={{ color: T.textMuted }}>年齢</span><span>{detailTarget.age}歳</span></div>}
                {detailTarget.interval_minutes > 0 && <div className="flex justify-between text-[12px]"><span style={{ color: T.textMuted }}>インターバル</span><span>{detailTarget.interval_minutes}分</span></div>}
                {detailTarget.transport_fee > 0 && <div className="flex justify-between text-[12px]"><span style={{ color: T.textMuted }}>交通費</span><span>¥{detailTarget.transport_fee.toLocaleString()}</span></div>}
                {detailTarget.height_cm > 0 && <div className="flex justify-between text-[12px]"><span style={{ color: T.textMuted }}>身長</span><span>{detailTarget.height_cm}cm</span></div>}
                {(detailTarget.bust > 0 || detailTarget.waist > 0 || detailTarget.hip > 0) && <div className="flex justify-between text-[12px]"><span style={{ color: T.textMuted }}>スリーサイズ</span><span>B{detailTarget.bust} W{detailTarget.waist} H{detailTarget.hip}</span></div>}
                {detailTarget.cup && <div className="flex justify-between text-[12px]"><span style={{ color: T.textMuted }}>カップ</span><span>{detailTarget.cup}カップ</span></div>}
                {detailTarget.notes && <div className="pt-2" style={{ borderTop: `1px solid ${T.cardAlt}` }}><p className="text-[11px] mb-1" style={{ color: T.textMuted }}>📝 備考・メモ</p><p className="text-[12px] whitespace-pre-wrap" style={{ color: T.textSub }}>{detailTarget.notes}</p></div>}
              </div>
              <div className="flex gap-3 mt-6 flex-wrap">
                <button onClick={() => { setDetailTarget(null); startEdit(detailTarget); }} className="px-5 py-2.5 bg-gradient-to-r from-[#c3a782] to-[#b09672] text-white text-[12px] rounded-xl cursor-pointer">編集する</button>
                {detailTarget.email && !detailTarget.email_verified && <button onClick={() => sendConfirmEmail(detailTarget)} className="px-4 py-2.5 text-[12px] rounded-xl cursor-pointer" style={{ backgroundColor: "#3b82f618", color: "#3b82f6", border: "1px solid #3b82f644" }}>📧 確認メール送信</button>}
                <button onClick={() => setDetailTarget(null)} className="px-5 py-2.5 border text-[12px] rounded-xl cursor-pointer" style={{ borderColor: T.border, color: T.textSub }}>閉じる</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowAdd(false)}>
          <div className="rounded-2xl border p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto animate-[fadeIn_0.25s]" style={{ backgroundColor: T.card, borderColor: T.border }} onClick={(e) => e.stopPropagation()}>
            <h2 className="text-[16px] font-medium mb-1">セラピスト登録</h2>
            <p className="text-[11px] mb-5" style={{ color: T.textFaint }}>新しいセラピストを登録します</p>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>名前 <span style={{ color: "#c49885" }}>*</span></label><input type="text" value={addName} onChange={(e) => setAddName(e.target.value)} placeholder="セラピスト名" className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} /></div>
                <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>電話番号</label><input type="tel" value={addPhone} onChange={(e) => setAddPhone(e.target.value)} placeholder="090-xxxx-xxxx" className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} /></div>
              </div>
              <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>✉️ メールアドレス</label><input type="email" value={addEmail} onChange={(e) => setAddEmail(e.target.value)} placeholder="example@gmail.com" className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} /></div>
              <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>ステータス</label><div className="flex gap-2">{Object.entries(statusMap).map(([key, val]) => (<button key={key} onClick={() => setAddStatus(key)} className={`px-3 py-1.5 rounded-xl text-[11px] cursor-pointer ${addStatus === key ? "ring-2 ring-offset-1" : "opacity-50"}`} style={{ backgroundColor: val.bg, color: val.text }}>{val.label}</button>))}</div></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>給料タイプ</label><select value={addSalaryType} onChange={(e) => setAddSalaryType(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none cursor-pointer" style={inputStyle}><option value="fixed">〇〇円UP</option><option value="percent">〇〇%UP</option></select></div>
                <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>金額/率</label><input type="text" inputMode="numeric" value={addSalaryAmount} onChange={(e) => setAddSalaryAmount(e.target.value.replace(/[^0-9]/g, ""))} placeholder={addSalaryType === "fixed" ? "500" : "5"} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} /></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>年齢</label><input type="text" inputMode="numeric" value={addAge} onChange={(e) => setAddAge(e.target.value.replace(/[^0-9]/g, ""))} placeholder="25" className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} /></div>
                <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>インターバル</label><select value={addInterval} onChange={(e) => setAddInterval(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none cursor-pointer" style={inputStyle}>{INTERVALS.map((m) => <option key={m} value={m}>{m}分</option>)}</select></div>
                <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>交通費</label><select value={addTransport} onChange={(e) => setAddTransport(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none cursor-pointer" style={inputStyle}><option value="0">なし</option><option value="500">¥500</option><option value="1000">¥1,000</option><option value="1500">¥1,500</option><option value="2000">¥2,000</option><option value="2500">¥2,500</option><option value="3000">¥3,000</option></select></div>
                <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>身長</label><input type="text" inputMode="numeric" value={addHeight} onChange={(e) => setAddHeight(e.target.value.replace(/[^0-9]/g, ""))} placeholder="160" className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} /></div>
              </div>
              <div className="grid grid-cols-4 gap-3">
                <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>バスト</label><input type="text" inputMode="numeric" value={addBust} onChange={(e) => setAddBust(e.target.value.replace(/[^0-9]/g, ""))} placeholder="84" className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} /></div>
                <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>ウエスト</label><input type="text" inputMode="numeric" value={addWaist} onChange={(e) => setAddWaist(e.target.value.replace(/[^0-9]/g, ""))} placeholder="58" className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} /></div>
                <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>ヒップ</label><input type="text" inputMode="numeric" value={addHip} onChange={(e) => setAddHip(e.target.value.replace(/[^0-9]/g, ""))} placeholder="86" className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} /></div>
                <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>カップ</label><select value={addCup} onChange={(e) => setAddCup(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none cursor-pointer" style={inputStyle}>{CUPS.map((c) => <option key={c} value={c}>{c || "—"}</option>)}</select></div>
              </div>
              <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>📝 備考・メモ</label><textarea value={addNotes} onChange={(e) => setAddNotes(e.target.value)} placeholder="セラピストの備考を入力" rows={2} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none resize-none" style={inputStyle} /></div>
              <PhotoField preview={addPhotoPreview} fileRef={addFileRef} onFileChange={(f) => handleFileChange(f, false)} width={addPhotoW} height={addPhotoH} onWidthChange={setAddPhotoW} onHeightChange={setAddPhotoH} />
              {msg && <div className="px-4 py-3 rounded-xl text-[12px]" style={{ backgroundColor: msg.includes("失敗") || msg.includes("入力") ? "#c4988518" : "#7ab88f18", color: msg.includes("失敗") || msg.includes("入力") ? "#c49885" : "#5a9e6f" }}>{msg}</div>}
              <div className="flex gap-3 pt-2">
                <button onClick={handleAdd} disabled={saving} className="px-7 py-3 bg-gradient-to-r from-[#c3a782] to-[#b09672] text-white text-[12px] rounded-xl cursor-pointer disabled:opacity-60">{saving ? "登録中..." : "登録する"}</button>
                <button onClick={() => { setShowAdd(false); setMsg(""); }} className="px-7 py-3 border text-[12px] rounded-xl cursor-pointer" style={{ borderColor: T.border, color: T.textSub }}>キャンセル</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editTarget && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setEditTarget(null)}>
          <div className="rounded-2xl border p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto animate-[fadeIn_0.25s]" style={{ backgroundColor: T.card, borderColor: T.border }} onClick={(e) => e.stopPropagation()}>
            <h2 className="text-[16px] font-medium mb-1">セラピスト編集</h2>
            <div className="flex gap-2 mb-5">
              <button onClick={() => setEditTab("basic")} className="px-4 py-1.5 rounded-lg text-[11px] cursor-pointer" style={{ backgroundColor: editTab === "basic" ? "#c3a78222" : T.cardAlt, color: editTab === "basic" ? "#c3a782" : T.textMuted, border: `1px solid ${editTab === "basic" ? "#c3a78244" : T.border}`, fontWeight: editTab === "basic" ? 700 : 400 }}>① 基本情報</button>
              <button onClick={() => setEditTab("personal")} className="px-4 py-1.5 rounded-lg text-[11px] cursor-pointer" style={{ backgroundColor: editTab === "personal" ? "#85a8c422" : T.cardAlt, color: editTab === "personal" ? "#85a8c4" : T.textMuted, border: `1px solid ${editTab === "personal" ? "#85a8c444" : T.border}`, fontWeight: editTab === "personal" ? 700 : 400 }}>② 個人情報 🔒</button>
            </div>

            {editTab === "basic" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>名前 <span style={{ color: "#c49885" }}>*</span></label><input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} /></div>
                <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>電話番号</label><input type="tel" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} /></div>
              </div>
              <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>📧 メールアドレス {editTarget?.email_verified ? <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "#22c55e18", color: "#22c55e" }}>✅ 確認済み</span> : editTarget?.email ? <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "#f59e0b18", color: "#f59e0b" }}>未確認</span> : null}</label><input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} placeholder="example@gmail.com" className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} /></div>
              <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>ステータス</label><div className="flex gap-2">{Object.entries(statusMap).map(([key, val]) => (<button key={key} onClick={() => setEditStatus(key)} className={`px-3 py-1.5 rounded-xl text-[11px] cursor-pointer ${editStatus === key ? "ring-2 ring-offset-1" : "opacity-50"}`} style={{ backgroundColor: val.bg, color: val.text }}>{val.label}</button>))}</div></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>給料タイプ</label><select value={editSalaryType} onChange={(e) => setEditSalaryType(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none cursor-pointer" style={inputStyle}><option value="fixed">〇〇円UP</option><option value="percent">〇%UP</option></select></div>
                <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>金額/率</label><input type="text" inputMode="numeric" value={editSalaryAmount} onChange={(e) => setEditSalaryAmount(e.target.value.replace(/[^0-9]/g, ""))} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} /></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>年齢</label><input type="text" inputMode="numeric" value={editAge} onChange={(e) => setEditAge(e.target.value.replace(/[^0-9]/g, ""))} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} /></div>
                <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>インターバル</label><select value={editInterval} onChange={(e) => setEditInterval(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none cursor-pointer" style={inputStyle}>{INTERVALS.map((m) => <option key={m} value={m}>{m}分</option>)}</select></div>
                <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>交通費</label><select value={editTransport} onChange={(e) => setEditTransport(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none cursor-pointer" style={inputStyle}><option value="0">なし</option><option value="500">¥500</option><option value="1000">¥1,000</option><option value="1500">¥1,500</option><option value="2000">¥2,000</option><option value="2500">¥2,500</option><option value="3000">¥3,000</option></select></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>身長</label><input type="text" inputMode="numeric" value={editHeight} onChange={(e) => setEditHeight(e.target.value.replace(/[^0-9]/g, ""))} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} /></div>
              </div>
              <div className="grid grid-cols-4 gap-3">
                <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>バスト</label><input type="text" inputMode="numeric" value={editBust} onChange={(e) => setEditBust(e.target.value.replace(/[^0-9]/g, ""))} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} /></div>
                <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>ウエスト</label><input type="text" inputMode="numeric" value={editWaist} onChange={(e) => setEditWaist(e.target.value.replace(/[^0-9]/g, ""))} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} /></div>
                <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>ヒップ</label><input type="text" inputMode="numeric" value={editHip} onChange={(e) => setEditHip(e.target.value.replace(/[^0-9]/g, ""))} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} /></div>
                <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>カップ</label><select value={editCup} onChange={(e) => setEditCup(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none cursor-pointer" style={inputStyle}>{CUPS.map((c) => <option key={c} value={c}>{c || "—"}</option>)}</select></div>
              </div>
              <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>📝 備考・メモ</label><textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} placeholder="セラピストの備考を入力" rows={2} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none resize-none" style={inputStyle} /></div>
              <PhotoField preview={editPhotoPreview} fileRef={editFileRef} onFileChange={(f) => handleFileChange(f, true)} width={editPhotoW} height={editPhotoH} onWidthChange={setEditPhotoW} onHeightChange={setEditPhotoH} />
            </div>
            )}

            {editTab === "personal" && !editPinAuthed && (
              <div className="py-8">
                <p className="text-[12px] text-center mb-1" style={{ color: T.textSub }}>🔒 個人情報を編集するにはPINコードが必要です</p>
                <p className="text-[10px] text-center mb-5" style={{ color: T.textFaint }}>管理者PINコード（4桁）を入力</p>
                <div className="flex justify-center gap-2 mb-4">
                  {[0,1,2,3].map(i => (<div key={i} className="w-12 h-14 rounded-xl flex items-center justify-center text-[22px] font-bold" style={{ backgroundColor: T.cardAlt, color: editPinInput[i] ? T.text : T.textFaint, border: `2px solid ${editPinInput.length === i ? "#c3a782" : T.border}` }}>{editPinInput[i] ? "●" : ""}</div>))}
                </div>
                <div className="grid grid-cols-3 gap-2 max-w-[240px] mx-auto mb-3">
                  {[1,2,3,4,5,6,7,8,9,null,0,"del"].map((n, i) => {
                    if (n === null) return <div key={i} />;
                    return (<button key={i} onClick={async () => {
                      if (n === "del") { setEditPinInput(prev => prev.slice(0,-1)); setEditPinError(""); return; }
                      const next = editPinInput + String(n);
                      if (next.length > 4) return;
                      setEditPinInput(next); setEditPinError("");
                      if (next.length === 4) {
                        const { data } = await supabase.from("staff").select("role").eq("pin", next).eq("status", "active").maybeSingle();
                        if (data && (data.role === "owner" || data.role === "manager")) { setEditPinAuthed(true); }
                        else { setEditPinError("管理者PINが一致しません"); setEditPinInput(""); }
                      }
                    }} className="h-12 rounded-xl text-[16px] font-medium cursor-pointer" style={{ backgroundColor: T.cardAlt, color: n === "del" ? "#c45555" : T.text, border: `1px solid ${T.border}` }}>{n === "del" ? "⌫" : n}</button>);
                  })}
                </div>
                {editPinError && <p className="text-[11px] text-center" style={{ color: "#c45555" }}>{editPinError}</p>}
              </div>
            )}

                        {editTab === "personal" && editPinAuthed && (
              <div className="space-y-4">
                <div className="rounded-xl p-3 mb-2" style={{ backgroundColor: "#22c55e12", border: "1px solid #22c55e33" }}><p className="text-[10px] text-center" style={{ color: "#22c55e" }}>🔓 管理者認証済み — 個人情報を編集できます</p></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>本名（実名）</label><input type="text" value={editRealName} onChange={(e) => setEditRealName(e.target.value)} placeholder="山田 太郎" className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} /></div>
                  <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>源泉徴収</label><button type="button" onClick={() => setEditWithholding(!editWithholding)} className="w-full px-3 py-2.5 rounded-xl text-[12px] text-left cursor-pointer" style={{ backgroundColor: editWithholding ? "#c4555522" : "#22c55e22", color: editWithholding ? "#c45555" : "#22c55e", border: `1px solid ${editWithholding ? "#c4555544" : "#22c55e44"}` }}>{editWithholding ? "✅ 源泉徴収あり（10.21%）" : "⬜ 源泉徴収なし"}</button></div>
                </div>
                <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>🎂 生年月日</label><input type="date" value={editBirthDate} onChange={(e) => { setEditBirthDate(e.target.value); if (e.target.value) { const b = new Date(e.target.value); const today = new Date(); let age = today.getFullYear() - b.getFullYear(); if (today.getMonth() < b.getMonth() || (today.getMonth() === b.getMonth() && today.getDate() < b.getDate())) age--; setEditAge(String(age)); } }} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} />{editBirthDate && <p className="text-[10px] mt-1" style={{ color: "#c3a782" }}>現在 {(() => { const b = new Date(editBirthDate); const today = new Date(); let age = today.getFullYear() - b.getFullYear(); if (today.getMonth() < b.getMonth() || (today.getMonth() === b.getMonth() && today.getDate() < b.getDate())) age--; return age; })()}歳</p>}</div>
                <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>住所</label><input type="text" value={editAddress} onChange={(e) => setEditAddress(e.target.value)} placeholder="愛知県安城市..." className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} /></div>

                <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>📋 適格事業者登録</label>
                  <button type="button" onClick={() => setEditHasInvoice(!editHasInvoice)} className="w-full px-3 py-2.5 rounded-xl text-[12px] text-left cursor-pointer mb-2" style={{ backgroundColor: editHasInvoice ? "#22c55e22" : "#88878022", color: editHasInvoice ? "#22c55e" : "#888780", border: `1px solid ${editHasInvoice ? "#22c55e44" : "#88878044"}` }}>{editHasInvoice ? "✅ 適格事業者登録あり" : "⬜ 適格事業者登録なし"}</button>
                  {editHasInvoice && <div className="space-y-2">
                    <input type="text" value={editInvoiceNum} onChange={(e) => setEditInvoiceNum(e.target.value)} placeholder="T1234567890123" className="w-full px-3 py-2 rounded-xl text-[11px] outline-none" style={inputStyle} />
                    <div className="rounded-xl p-2.5" style={{ backgroundColor: T.cardAlt }}>
                      <p className="text-[10px] font-medium mb-1.5" style={{ color: T.textSub }}>📎 適格事業者証明</p>
                      {editTarget?.invoice_photo_url && <a href={editTarget.invoice_photo_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 mb-1.5 px-2 py-1 rounded-lg" style={{ backgroundColor: "#85a8c412", border: "1px solid #85a8c433" }}><img src={editTarget.invoice_photo_url} alt="適格事業者" className="rounded" style={{ width: 48, height: 48, objectFit: "cover" }} /><span className="text-[9px]" style={{ color: "#85a8c4" }}>📄 証明書を表示</span></a>}
                      <div className="flex items-center gap-2">
                        <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[10px] cursor-pointer font-medium" style={{ backgroundColor: "#85a8c418", color: "#85a8c4", border: "1px solid #85a8c444" }}>📎 写真を選択<input type="file" accept="image/*" onChange={(e) => setEditInvoicePhoto(e.target.files?.[0] || null)} className="hidden" /></label>
                        {editInvoicePhoto && <><span className="text-[9px]" style={{ color: "#22c55e" }}>✅ {editInvoicePhoto.name}</span><button onClick={async () => { if (!editTarget || !editInvoicePhoto) return; const ext = editInvoicePhoto.name.split(".").pop(); const now = new Date(); const ds = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,"0")}${String(now.getDate()).padStart(2,"0")}`; const fn = `therapist_invoice_${editTarget.id}_${ds}.${ext}`; await supabase.storage.from("therapist-photos").upload(fn, editInvoicePhoto, { upsert: true }); const { data: u } = supabase.storage.from("therapist-photos").getPublicUrl(fn); await supabase.from("therapists").update({ invoice_photo_url: u.publicUrl }).eq("id", editTarget.id); setEditInvoicePhoto(null); fetchTherapists(); toast.show("適格事業者証明を保存しました", "success"); }} className="px-2 py-1 rounded text-[9px] cursor-pointer" style={{ backgroundColor: "#22c55e22", color: "#22c55e", border: "1px solid #22c55e44" }}>💾 保存</button></>}
                      </div>
                    </div>
                  </div>}
                </div>

                <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>🪪 免許証アップロード</label>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl p-2.5" style={{ backgroundColor: T.cardAlt }}>
                      <p className="text-[10px] font-medium mb-1.5" style={{ color: T.textSub }}>📋 表面</p>
                      {editTarget?.license_photo_url && <a href={editTarget.license_photo_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 mb-1.5 px-2 py-1 rounded-lg" style={{ backgroundColor: "#85a8c412", border: "1px solid #85a8c433" }}><img src={editTarget.license_photo_url} alt="免許証表面" className="rounded" style={{ width: 60, height: 38, objectFit: "cover" }} /><span className="text-[9px]" style={{ color: "#85a8c4" }}>📄 表面を表示</span></a>}
                      <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[10px] cursor-pointer font-medium" style={{ backgroundColor: "#85a8c418", color: "#85a8c4", border: "1px solid #85a8c444" }}>📎 表面を選択<input type="file" accept="image/*" onChange={(e) => setEditLicensePhoto(e.target.files?.[0] || null)} className="hidden" /></label>
                      {editLicensePhoto && <div className="flex items-center gap-2 mt-1"><span className="text-[9px]" style={{ color: "#22c55e" }}>✅ {editLicensePhoto.name}</span><button onClick={async () => { if (!editTarget || !editLicensePhoto) return; const ext = editLicensePhoto.name.split(".").pop(); const now = new Date(); const ds = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,"0")}${String(now.getDate()).padStart(2,"0")}`; const fn = `therapist_license_front_${editTarget.id}_${ds}.${ext}`; await supabase.storage.from("therapist-photos").upload(fn, editLicensePhoto, { upsert: true }); const { data: u } = supabase.storage.from("therapist-photos").getPublicUrl(fn); await supabase.from("therapists").update({ license_photo_url: u.publicUrl }).eq("id", editTarget.id); setEditLicensePhoto(null); fetchTherapists(); toast.show("免許証（表面）を保存しました", "success"); }} className="px-2 py-1 rounded text-[9px] cursor-pointer" style={{ backgroundColor: "#22c55e22", color: "#22c55e", border: "1px solid #22c55e44" }}>💾 保存</button></div>}
                    </div>
                    <div className="rounded-xl p-2.5" style={{ backgroundColor: T.cardAlt }}>
                      <p className="text-[10px] font-medium mb-1.5" style={{ color: T.textSub }}>📋 裏面</p>
                      {editTarget?.license_photo_url_back && <a href={editTarget.license_photo_url_back} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 mb-1.5 px-2 py-1 rounded-lg" style={{ backgroundColor: "#85a8c412", border: "1px solid #85a8c433" }}><img src={editTarget.license_photo_url_back} alt="免許証裏面" className="rounded" style={{ width: 60, height: 38, objectFit: "cover" }} /><span className="text-[9px]" style={{ color: "#85a8c4" }}>📄 裏面を表示</span></a>}
                      <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[10px] cursor-pointer font-medium" style={{ backgroundColor: "#85a8c418", color: "#85a8c4", border: "1px solid #85a8c444" }}>📎 裏面を選択<input type="file" accept="image/*" onChange={(e) => setEditLicensePhotoBack(e.target.files?.[0] || null)} className="hidden" /></label>
                      {editLicensePhotoBack && <div className="flex items-center gap-2 mt-1"><span className="text-[9px]" style={{ color: "#22c55e" }}>✅ {editLicensePhotoBack.name}</span><button onClick={async () => { if (!editTarget || !editLicensePhotoBack) return; const ext = editLicensePhotoBack.name.split(".").pop(); const now = new Date(); const ds = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,"0")}${String(now.getDate()).padStart(2,"0")}`; const fn = `therapist_license_back_${editTarget.id}_${ds}.${ext}`; await supabase.storage.from("therapist-photos").upload(fn, editLicensePhotoBack, { upsert: true }); const { data: u } = supabase.storage.from("therapist-photos").getPublicUrl(fn); await supabase.from("therapists").update({ license_photo_url_back: u.publicUrl }).eq("id", editTarget.id); setEditLicensePhotoBack(null); fetchTherapists(); toast.show("免許証（裏面）を保存しました", "success"); }} className="px-2 py-1 rounded text-[9px] cursor-pointer" style={{ backgroundColor: "#22c55e22", color: "#22c55e", border: "1px solid #22c55e44" }}>💾 保存</button></div>}
                    </div>
                  </div>
                </div>
              </div>
            )}
            {editMsg && <div className="px-4 py-3 rounded-xl text-[12px] mt-4" style={{ backgroundColor: editMsg.includes("失敗") ? "#c4988518" : "#7ab88f18", color: editMsg.includes("失敗") ? "#c49885" : "#5a9e6f" }}>{editMsg}</div>}
            <div className="flex gap-3 pt-4">
              <button onClick={handleUpdate} disabled={editSaving} className="px-7 py-3 bg-gradient-to-r from-[#c3a782] to-[#b09672] text-white text-[12px] rounded-xl cursor-pointer disabled:opacity-60">{editSaving ? "更新中..." : "更新する"}</button>
              <button onClick={() => setEditTarget(null)} className="px-7 py-3 border text-[12px] rounded-xl cursor-pointer" style={{ borderColor: T.border, color: T.textSub }}>キャンセル</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setDeleteTarget(null)}>
          <div className="rounded-2xl border p-8 w-full max-w-sm text-center animate-[fadeIn_0.25s]" style={{ backgroundColor: T.card, borderColor: T.border }} onClick={(e) => e.stopPropagation()}>
            <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-5" style={{ backgroundColor: "#c4555518" }}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#c45555" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></div>
            <h3 className="text-[15px] font-medium mb-2">セラピストを削除しますか？</h3>
            <p className="text-[12px] mb-6" style={{ color: T.textMuted }}>「{deleteTarget.name}」を削除すると元に戻せません</p>
            <div className="flex gap-3 justify-center">
              <button onClick={handleDelete} disabled={deleting} className="px-6 py-2.5 bg-[#c45555] text-white text-[12px] rounded-xl cursor-pointer disabled:opacity-60">{deleting ? "削除中..." : "削除する"}</button>
              <button onClick={() => setDeleteTarget(null)} className="px-6 py-2.5 border text-[12px] rounded-xl cursor-pointer" style={{ borderColor: T.border, color: T.textSub }}>キャンセル</button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  );
}
