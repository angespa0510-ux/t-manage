"use client";

import { useState, useEffect, useCallback, useRef, lazy, Suspense } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";
import { useTheme } from "../../lib/theme";
import { NavMenu } from "../../lib/nav-menu";
import { jsPDF } from "jspdf";
import { useToast } from "../../lib/toast";
import { useConfirm } from "../../components/useConfirm";
import { usePinKeyboard } from "../../lib/use-pin-keyboard";
import { useStaffSession } from "../../lib/staff-session";

const TherapistImportPanel = lazy(() => import("../../lib/therapist-import-panel"));

type Therapist = {
  id: number; created_at: string; name: string; phone: string; status: string;
  salary_type: string; salary_amount: number; age: number; interval_minutes: number; transport_fee: number;
  height_cm: number; bust: number; waist: number; hip: number; cup: string;
  photo_url: string; photo_width: number; photo_height: number; notes: string;
  email: string; email_verified: boolean; email_token: string;
  has_withholding: boolean;
  real_name: string; address: string; has_invoice: boolean; therapist_invoice_number: string; invoice_photo_url: string; license_photo_url: string; license_photo_url_back: string; birth_date: string; sort_order: number; entry_date: string; mynumber: string; mynumber_photo_url: string; mynumber_photo_url_back: string;
  deleted_at?: string | null;
  // ─── 公開HP (Ange Spa ange-spa.jp) 掲載用 ───
  is_public?: boolean; bio?: string; catchphrase?: string; specialty?: string; message?: string;
  tags?: string[]; body_type?: string; hair_style?: string; hair_color?: string;
  sub_photo_urls?: string[]; blog_url?: string; twitter_url?: string; instagram_url?: string;
  public_sort_order?: number; is_pickup?: boolean; is_newcomer?: boolean;
};

// ─── 公開HPで使うタイプタグ選択肢（現行HP準拠） ───
const TYPE_TAGS = ["カワイイ系", "キレイ系", "ロリ系", "ギャル系", "セクシー系", "人妻系"];
const PERSONALITY_TAGS = ["明るい", "おっとり", "癒し系", "甘えん坊", "天然", "恥ずかしがりや", "人懐っこい", "オタク", "上品", "小悪魔", "ツンデレ", "知的"];
const FEATURE_TAGS = ["現役学生", "OL", "マッサージ上手", "外部講習済", "素人", "経験豊富", "色白", "喫煙しない", "PICK UP", "鼠径部", "サービス精神抜群"];
const BODY_TYPES = ["", "モデル", "スレンダー", "標準", "グラマー", "ぽっちゃり"];
const HAIR_STYLES = ["", "ショート", "ミディアム", "ロング"];
const HAIR_COLORS = ["", "黒髪", "茶髪", "金髪", "派手髪"];

export default function TherapistManagement() {
  const router = useRouter();
  const { dark, toggle, T } = useTheme();
  const toast = useToast();
  const { activeStaff } = useStaffSession();
  const { confirm, ConfirmModalNode } = useConfirm();
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [storeInfo, setStoreInfo] = useState<{ company_name: string; company_address: string; company_phone: string; invoice_number: string } | null>(null);
  const [showPayroll, setShowPayroll] = useState(false);
  const [payrollYear, setPayrollYear] = useState(String(new Date().getFullYear()));
  const [payrollData, setPayrollData] = useState<{ id: number; name: string; address: string; gross: number; invoiceDed: number; tax: number; welfare: number; transport: number; total: number; days: number }[]>([]);
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
  const [addEntryDate, setAddEntryDate] = useState("");
  const [addLoginEmail, setAddLoginEmail] = useState("");
const [addLoginPassword, setAddLoginPassword] = useState("");
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
  const [editWelfareFee, setEditWelfareFee] = useState("500");
  const [editWelfareOrdersThreshold, setEditWelfareOrdersThreshold] = useState("0");
  const [editWelfareOrdersAmount, setEditWelfareOrdersAmount] = useState("0");
  const [editWelfarePayThreshold, setEditWelfarePayThreshold] = useState("0");
  const [editWelfarePayAmount, setEditWelfarePayAmount] = useState("0");
  const [editTab, setEditTab] = useState<"basic" | "personal" | "public">("basic");
  const [editPinInput, setEditPinInput] = useState("");
  const [editPinAuthed, setEditPinAuthed] = useState(false);
  const [editPinError, setEditPinError] = useState("");
  // personal タブ表示中で未認証のとき、PIN入力をキーボード対応
  usePinKeyboard(!editPinAuthed && editTab === "personal");
  // ─── 公開HP (Ange Spa) 用 state ───
  const [editIsPublic, setEditIsPublic] = useState(false);
  const [editBio, setEditBio] = useState("");
  const [editCatchphrase, setEditCatchphrase] = useState("");
  const [editSpecialty, setEditSpecialty] = useState("");
  const [editPublicMessage, setEditPublicMessage] = useState("");
  const [editTags, setEditTags] = useState<string[]>([]);
  const [editBodyType, setEditBodyType] = useState("");
  const [editHairStyle, setEditHairStyle] = useState("");
  const [editHairColor, setEditHairColor] = useState("");
  const [editSubPhotoUrls, setEditSubPhotoUrls] = useState<string[]>([]);
  const [editBlogUrl, setEditBlogUrl] = useState("");
  const [editTwitterUrl, setEditTwitterUrl] = useState("");
  const [editInstagramUrl, setEditInstagramUrl] = useState("");
  const [editPublicSortOrder, setEditPublicSortOrder] = useState("0");
  const [editIsPickup, setEditIsPickup] = useState(false);
  const [editIsNewcomer, setEditIsNewcomer] = useState(false);
  const [editSubPhotoFiles, setEditSubPhotoFiles] = useState<File[]>([]);
  const [editRealName, setEditRealName] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editHasInvoice, setEditHasInvoice] = useState(false);
  const [editInvoiceNum, setEditInvoiceNum] = useState("");
  const [editInvoicePhoto, setEditInvoicePhoto] = useState<File | null>(null);
  const [editLicensePhoto, setEditLicensePhoto] = useState<File | null>(null);
  const [editLicensePhotoBack, setEditLicensePhotoBack] = useState<File | null>(null);
  const [editBirthDate, setEditBirthDate] = useState("");
  const [editEntryDate, setEditEntryDate] = useState("");
  const [editMynumber, setEditMynumber] = useState("");
  const [editMynumberPhoto, setEditMynumberPhoto] = useState<File | null>(null);
  const [editMynumberPhotoBack, setEditMynumberPhotoBack] = useState<File | null>(null);
  const [mynumberReading, setMynumberReading] = useState(false);
  const [editPhotoFile, setEditPhotoFile] = useState<File | null>(null); const [editPhotoPreview, setEditPhotoPreview] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editLoginEmail, setEditLoginEmail] = useState("");
const [editLoginPassword, setEditLoginPassword] = useState("");
  const [editSaving, setEditSaving] = useState(false); const [editMsg, setEditMsg] = useState("");
  const editFileRef = useRef<HTMLInputElement>(null);

  // Detail
  const [detailTarget, setDetailTarget] = useState<Therapist | null>(null);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<Therapist | null>(null); const [deleting, setDeleting] = useState(false);
  const [contractInfo, setContractInfo] = useState<{ status: string; signature_url?: string; signed_at?: string; token?: string } | null>(null);
  const [contractUrl, setContractUrl] = useState("");
  const [contractsMap, setContractsMap] = useState<Record<number, { status: string; token: string }>>({});
  const [newcomerMonths, setNewcomerMonths] = useState(2);

  // NG登録
  type NgCustomer = { id: number; name: string; phone: string; rank: string };
  const [showNgRegister, setShowNgRegister] = useState(false);
  const [showThImport, setShowThImport] = useState(false);
  const [ngCustomers, setNgCustomers] = useState<NgCustomer[]>([]);
  const [ngCustSearch, setNgCustSearch] = useState("");
  const [ngSelectedCust, setNgSelectedCust] = useState<NgCustomer | null>(null);
  const [ngTherapistId, setNgTherapistId] = useState(0);
  const [ngReason, setNgReason] = useState("");
  const [ngSaving, setNgSaving] = useState(false);
  const [ngMsg, setNgMsg] = useState("");

  const openNgRegister = async () => {
    setShowNgRegister(true); setNgSelectedCust(null); setNgCustSearch(""); setNgTherapistId(0); setNgReason(""); setNgMsg("");
    const { data } = await supabase.from("customers").select("id,name,phone,rank").order("name");
    if (data) setNgCustomers(data);
  };

  const registerNg = async () => {
    if (!ngSelectedCust || !ngTherapistId) { setNgMsg("お客様とセラピストを選択してください"); return; }
    setNgSaving(true); setNgMsg("");
    const { data: existing } = await supabase.from("therapist_customer_notes").select("id").eq("customer_name", ngSelectedCust.name).eq("therapist_id", ngTherapistId).maybeSingle();
    if (existing) {
      await supabase.from("therapist_customer_notes").update({ is_ng: true, ng_reason: ngReason }).eq("id", existing.id);
    } else {
      await supabase.from("therapist_customer_notes").insert({ customer_name: ngSelectedCust.name, therapist_id: ngTherapistId, is_ng: true, ng_reason: ngReason, note: "", rating: 0 });
    }
    const { data: ngNotes } = await supabase.from("therapist_customer_notes").select("therapist_id").eq("customer_name", ngSelectedCust.name).eq("is_ng", true);
    const activeIds = new Set(therapists.filter(t => t.status === "active").map(t => t.id));
    const activeNgCount = (ngNotes || []).filter(n => activeIds.has(n.therapist_id)).length;
    let newRank: string | null = null;
    if (activeNgCount >= 5) newRank = "banned";
    else if (activeNgCount >= 3) newRank = "caution";
    if (newRank) {
      const { data: cust } = await supabase.from("customers").select("id,rank").eq("name", ngSelectedCust.name).maybeSingle();
      if (cust && cust.rank !== "banned") await supabase.from("customers").update({ rank: newRank }).eq("id", cust.id);
    }
    setNgSaving(false);
    const thName = therapists.find(t => t.id === ngTherapistId)?.name || "";
    setNgMsg(`✅ ${ngSelectedCust.name} 様を ${thName} のNGに登録しました${newRank ? ` → ${newRank === "banned" ? "出禁" : "要注意"}に自動変更` : ""}`);
    setNgTherapistId(0); setNgReason("");
  };

const generatePassword = () => {
    const chars = "abcdefghjkmnpqrstuvwxyz23456789";
    let pw = "";
    for (let i = 0; i < 8; i++) pw += chars[Math.floor(Math.random() * chars.length)];
    return pw;
  };

  const [showTrash, setShowTrash] = useState(false);
  const [trashItems, setTrashItems] = useState<Therapist[]>([]);

  const fetchTherapists = useCallback(async () => {
    const { data } = await supabase.from("therapists").select("*").is("deleted_at", null).order("sort_order", { ascending: true }).order("created_at", { ascending: false });
    if (data) setTherapists(data);
    // 全契約ステータスをロード
    const { data: contracts } = await supabase.from("contracts").select("therapist_id, status, token").order("created_at", { ascending: false });
    if (contracts) {
      const map: Record<number, { status: string; token: string }> = {};
      for (const c of contracts) { if (!map[c.therapist_id]) map[c.therapist_id] = { status: c.status, token: c.token }; }
      setContractsMap(map);
    }
  }, []);

  const fetchTrash = async () => {
    // 30日超過分を自動削除
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    await supabase.from("therapists").delete().not("deleted_at", "is", null).lt("deleted_at", cutoff);
    // 残りを取得
    const { data } = await supabase.from("therapists").select("*").not("deleted_at", "is", null).order("deleted_at", { ascending: false });
    if (data) setTrashItems(data);
  };

  const restoreTherapist = async (id: number) => {
    await supabase.from("therapists").update({ deleted_at: null }).eq("id", id);
    toast.show("復元しました！", "success");
    fetchTrash(); fetchTherapists();
  };

  const permanentDelete = async (id: number, name: string) => {
    const ok = await confirm({
      title: `${name} さんを完全に削除しますか？`,
      message: (
        <>
          この操作は <strong style={{ color: "#c45555" }}>取り消せません</strong>。<br />
          過去の予約履歴や売上データは残りますが、セラピスト情報は完全に失われます。
          <br /><br />
          本当に完全削除する場合は、セラピスト名をご入力ください。
        </>
      ),
      variant: "danger",
      confirmLabel: "完全に削除する",
      typeToConfirm: name,
    });
    if (!ok) return;
    await supabase.from("therapists").delete().eq("id", id);
    toast.show("完全に削除しました");
    fetchTrash();
  };

  const loadContract = async (therapistId: number) => {
    const { data } = await supabase.from("contracts").select("*").eq("therapist_id", therapistId).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (data) { setContractInfo(data); setContractUrl(`${window.location.origin}/contract-sign/${data.token}`); }
    else { setContractInfo(null); setContractUrl(""); }
  };

  const generateContractLink = async (therapistId: number) => {
    const token = `c_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    await supabase.from("contracts").insert({ therapist_id: therapistId, token, status: "pending", type: "contract" });
    const url = `${window.location.origin}/contract-sign/${token}`;
    setContractInfo({ status: "pending", token });
    setContractUrl(url);
    navigator.clipboard.writeText(url);
    toast.show("📝 契約書リンクをコピーしました", "success");
    fetchTherapists();
  };

  const generateLicenseLink = async (therapistId: number) => {
    const token = `l_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    await supabase.from("contracts").insert({ therapist_id: therapistId, token, status: "pending", type: "license" });
    const url = `${window.location.origin}/license-upload/${token}`;
    navigator.clipboard.writeText(url);
    toast.show("🪪 身分証リンクをコピーしました", "success");
    fetchTherapists();
  };

  const generateInvoiceLink = async (therapistId: number) => {
    const token = `i_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    await supabase.from("contracts").insert({ therapist_id: therapistId, token, status: "pending", type: "invoice" });
    const url = `${window.location.origin}/invoice-upload/${token}`;
    navigator.clipboard.writeText(url);
    toast.show("📋 適格事業者リンクをコピーしました", "success");
    fetchTherapists();
  };

  const [showBulkLinks, setShowBulkLinks] = useState(false);
  const [bulkLinks, setBulkLinks] = useState<{ id: number; name: string; contract?: string; license?: string; invoice?: string; mynumber?: string }[]>([]);
  const generateBulkLinks = async () => {
    const links: typeof bulkLinks = [];
    for (const t of therapists) {
      const entry: typeof bulkLinks[0] = { id: t.id, name: t.name };
      if (!contractsMap[t.id] || contractsMap[t.id].status !== "signed") {
        const tk = `c_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        await supabase.from("contracts").insert({ therapist_id: t.id, token: tk, status: "pending", type: "contract" });
        entry.contract = `${window.location.origin}/contract-sign/${tk}`;
      }
      if (!t.license_photo_url) {
        const tk = `l_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        await supabase.from("contracts").insert({ therapist_id: t.id, token: tk, status: "pending", type: "license" });
        entry.license = `${window.location.origin}/license-upload/${tk}`;
      }
      if (!t.has_invoice) {
        const tk = `i_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        await supabase.from("contracts").insert({ therapist_id: t.id, token: tk, status: "pending", type: "invoice" });
        entry.invoice = `${window.location.origin}/invoice-upload/${tk}`;
      }
      if (!(t as any).mynumber) {
        const tk = `m_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        await supabase.from("contracts").insert({ therapist_id: t.id, token: tk, status: "pending", type: "mynumber" });
        entry.mynumber = `${window.location.origin}/mynumber-upload/${tk}`;
      }
      if (entry.contract || entry.license || entry.invoice || entry.mynumber) links.push(entry);
    }
    setBulkLinks(links);
    setShowBulkLinks(true);
    fetchTherapists();
    toast.show(`${links.length}名分のリンクを発行しました`, "success");
  };

  useEffect(() => { const check = async () => { const { data: { user } } = await supabase.auth.getUser(); if (!user) router.push("/"); }; check(); fetchTherapists(); const fetchStore = async () => { const { data } = await supabase.from("stores").select("company_name, company_address, company_phone, invoice_number"); if (data?.[0]) setStoreInfo(data[0]); }; fetchStore(); const fetchNewcomer = async () => { const { data } = await supabase.from("store_settings").select("value").eq("key", "newcomer_duration_months").maybeSingle(); if (data) setNewcomerMonths(parseInt(data.value) || 2); }; fetchNewcomer(); }, [router, fetchTherapists]);

    const fetchPayroll = async () => {
    setPayrollLoading(true);
    const startDate = `${payrollYear}-01-01`;
    const endDate = `${payrollYear}-12-31`;
    const { data: settlements } = await supabase.from("therapist_daily_settlements").select("therapist_id, total_back, invoice_deduction, withholding_tax, adjustment, final_payment, transport_fee, welfare_fee").gte("date", startDate).lte("date", endDate).eq("is_settled", true);
    const thMap: Record<number, { name: string; address: string; gross: number; invoiceDed: number; tax: number; welfare: number; transport: number; final: number; days: number }> = {};
    (settlements || []).forEach(s => {
      if (!thMap[s.therapist_id]) {
        const th = therapists.find(t => t.id === s.therapist_id);
        thMap[s.therapist_id] = { name: th?.name || "不明", address: th?.address || "", gross: 0, invoiceDed: 0, tax: 0, welfare: 0, transport: 0, final: 0, days: 0 };
      }
      const th = therapists.find(t => t.id === s.therapist_id);
      const transportFee = s.transport_fee || th?.transport_fee || 0;
      const backAmt = (s.total_back || 0) + (s.adjustment || 0);
      const invDed = s.invoice_deduction || 0;
      const adjusted = backAmt - invDed + (s.adjustment || 0);
      let dayWT = s.withholding_tax || 0;
      if (dayWT === 0 && th && (th as any).has_withholding) {
        dayWT = Math.floor(Math.max(adjusted - 5000, 0) * 0.1021);
      }
      thMap[s.therapist_id].gross += backAmt;
      thMap[s.therapist_id].invoiceDed += (s.invoice_deduction || 0);
      thMap[s.therapist_id].tax += dayWT;
      thMap[s.therapist_id].welfare += (s.welfare_fee || 0);
      thMap[s.therapist_id].final += (s.final_payment || 0);
      thMap[s.therapist_id].transport += transportFee;
      thMap[s.therapist_id].days += 1;
    });
    const result = Object.entries(thMap).map(([id, d]) => ({ id: Number(id), name: d.name, address: d.address, gross: d.gross, invoiceDed: d.invoiceDed, tax: d.tax, welfare: d.welfare, transport: d.transport, total: d.final, days: d.days }));
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
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>支払調書_${payrollYear}_${realName}</title>
    <style>
      body{font-family:'Hiragino Sans','Yu Gothic','Meiryo',sans-serif;max-width:750px;margin:40px auto;padding:30px;color:#333}
      h1{text-align:center;font-size:20px;border-bottom:3px double #333;padding-bottom:10px;margin-bottom:5px;letter-spacing:4px}
      h2{text-align:center;font-size:12px;color:#888;font-weight:normal;margin-bottom:25px}
      table{width:100%;border-collapse:collapse;margin:15px 0}
      td,th{border:1px solid #ccc;padding:9px 14px;font-size:12px}
      th{background:#f5f0e8;text-align:left;width:38%}
      .right{text-align:right}
      .total-row{background:#f9f6f0;font-weight:bold;font-size:14px}
      .section{margin-top:25px;padding-top:15px;border-top:1px solid #ddd}
      .company{font-size:11px;line-height:2;color:#555}
      .note{font-size:9px;color:#888;margin-top:4px;line-height:1.8}
      .doc-title{font-size:9px;color:#999;text-align:right;margin-bottom:20px}
      .stamp-area{display:flex;justify-content:space-between;margin-top:40px}
      .stamp-box{border-top:1px solid #333;width:180px;text-align:center;padding-top:5px;font-size:10px;color:#888}
      @media print{body{margin:0;padding:20px}}
    </style></head><body>
    <p class="doc-title">報酬、料金、契約金及び賞金の支払調書</p>
    <h1>支　払　調　書</h1>
    <h2>対象期間：${payrollYear}年1月1日 〜 ${payrollYear}年12月31日</h2>

    <table>
    <tr><th>支払を受ける者（氏名）</th><td>${realName}</td></tr>
    ${realName !== row.name ? `<tr><th>業務上の名称</th><td>${row.name}</td></tr>` : ""}
    <tr><th>支払を受ける者（住所）</th><td>${th?.address || '<span style="color:#c45555">※未登録（税務署提出時は必須）</span>'}</td></tr>
    ${th?.birth_date ? `<tr><th>生年月日</th><td>${th.birth_date}</td></tr>` : ""}
    <tr><th>区分</th><td>${th?.has_withholding ? "報酬（所得税法第204条第1項第6号）" : "報酬（所得税法第204条第1項第1号）"}</td></tr>
    <tr><th>細目</th><td>${th?.has_withholding ? "ホステス等の業務に関する報酬" : "エステティック施術業務"}</td></tr>
    <tr><th>適格請求書発行事業者</th><td>${hasInvoice ? `登録あり（登録番号：${invoiceNum}）` : "未登録"}</td></tr>
    </table>

    <table>
    <tr><th style="width:45%">項目</th><th class="right" style="width:20%">金額</th><th style="width:35%">摘要</th></tr>
    <tr><td>稼働日数</td><td class="right">${row.days}日</td><td style="font-size:10px;color:#888">年間清算回数</td></tr>
    <tr><td><strong>支払金額（税込）</strong></td><td class="right"><strong>&yen;${row.gross.toLocaleString()}</strong></td><td style="font-size:10px;color:#888">業務委託報酬の年間合計<br>（基本バック＋指名料＋延長＋オプション）</td></tr>
    ${row.invoiceDed > 0 ? `<tr><td style="color:#c45555">仕入税額控除の経過措置</td><td class="right" style="color:#c45555">-&yen;${row.invoiceDed.toLocaleString()}</td><td style="font-size:10px;color:#888">適格請求書発行事業者以外からの<br>課税仕入れにつき、報酬額の10%を控除</td></tr>
    <tr style="background:#f9f6f0"><td>控除後の報酬額</td><td class="right">&yen;${(row.gross - row.invoiceDed).toLocaleString()}</td><td style="font-size:10px;color:#888">支払金額 − 仕入税額控除</td></tr>` : ""}
    ${row.tax > 0 ? `<tr><td style="color:#c45555">源泉徴収税額</td><td class="right" style="color:#c45555">-&yen;${row.tax.toLocaleString()}</td><td style="font-size:10px;color:#888">所得税及び復興特別所得税<br>${th?.has_withholding ? "（控除後報酬 − ¥5,000/日）× 10.21%<br>第6号：同一人に対し1回の支払ごとに<br>¥5,000を控除した残額に課税" : "控除後報酬 × 10.21%<br>の日次合計"}</td></tr>` : `<tr><td>源泉徴収税額</td><td class="right">&yen;0</td><td style="font-size:10px;color:#888">源泉徴収対象外</td></tr>`}
    ${row.welfare > 0 ? `<tr><td style="color:#c45555">備品・リネン代</td><td class="right" style="color:#c45555">-&yen;${row.welfare.toLocaleString()}</td><td style="font-size:10px;color:#888">&yen;500/日 × ${row.days}日<br>（備品・リネン代等）</td></tr>` : ""}
    ${row.transport > 0 ? `<tr><td>交通費（実費精算分）（実費精算分）</td><td class="right">&yen;${row.transport.toLocaleString()}</td><td style="font-size:10px;color:#888">&yen;${Math.round(row.transport / row.days).toLocaleString()}/日 × ${row.days}日<br>（実費精算・源泉対象外）</td></tr>` : ""}
    <tr class="total-row"><td>差引支払額</td><td class="right">&yen;${row.total.toLocaleString()}</td><td style="font-size:10px;color:#888">実際の年間支給額合計<br>（日次100円単位切上後）</td></tr>
    </table>

    <div style="margin-top:15px">
    <p class="note">※ 支払金額は全て税込（内税方式）で記載しています。消費税等の額についてはこの中に含まれます。</p>
    <p class="note">※ 源泉徴収税額は、所得税法第204条第1項${th?.has_withholding ? "第6号" : "第1号"}に基づき、日次清算時に控除済みです。${th?.has_withholding ? "1回の支払につき¥5,000を控除した残額に対し10.21%を適用。" : ""}</p>
    <p class="note">※ 本書は所得税法第225条第1項に基づく「報酬、料金、契約金及び賞金の支払調書」に準じて作成しています。</p>
    ${row.invoiceDed > 0 ? `<p class="note">※ 仕入税額控除の経過措置は、消費税法附則第52条・第53条に基づきます。</p>` : ""}
    </div>

    <div class="section">
      <p style="font-size:11px;color:#888;margin-bottom:8px">支払者</p>
      <div class="company">
        <p><strong>${store?.company_name || ""}</strong></p>
        <p>${store?.company_address || ""}</p>
        <p>TEL: ${store?.company_phone || ""}</p>
        ${store?.invoice_number ? `<p>適格請求書発行事業者登録番号: ${store.invoice_number}</p>` : ""}
      </div>
    </div>

    <div class="stamp-area">
      <div class="stamp-box">支払者（${store?.company_name || ""}）</div>
      <div class="stamp-box">支払を受ける者（${realName} 様）</div>
    </div>
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
      login_email: addLoginEmail.trim(), login_password: addLoginPassword,
      entry_date: addEntryDate || null,
    }).select().single();
    if (error) { setSaving(false); setMsg("登録失敗: " + error.message); return; }
    if (addPhotoFile && data) {
      const url = await uploadPhoto(addPhotoFile, data.id);
      if (url) await supabase.from("therapists").update({ photo_url: url }).eq("id", data.id);
    }
    setSaving(false); setMsg("登録しました！");
    setAddName(""); setAddPhone(""); setAddStatus("active"); setAddSalaryType("fixed"); setAddSalaryAmount(""); setAddAge(""); setAddInterval("10"); setAddTransport("0");
    setAddHeight(""); setAddBust(""); setAddWaist(""); setAddHip(""); setAddCup(""); setAddPhotoFile(null); setAddPhotoPreview(""); setAddPhotoW("400"); setAddPhotoH("600"); setAddNotes(""); setAddEmail(""); setAddLoginEmail(""); setAddLoginPassword("");
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
    setEditEntryDate(t.entry_date || "");
    setEditMynumber((t as any).mynumber || ""); setEditMynumberPhoto(null); setMynumberReading(false);
    setEditPhotoFile(null); setEditPhotoPreview(t.photo_url || ""); setEditNotes(t.notes || ""); setEditEmail(t.email || ""); setEditLoginEmail((t as any).login_email || ""); setEditLoginPassword((t as any).login_password || ""); setEditMsg("");
    setEditWelfareFee(String((t as any).welfare_fee ?? 500));
    setEditWelfareOrdersThreshold(String((t as any).welfare_fee_orders_threshold || 0));
    setEditWelfareOrdersAmount(String((t as any).welfare_fee_orders_amount || 0));
    setEditWelfarePayThreshold(String((t as any).welfare_fee_pay_threshold || 0));
    setEditWelfarePayAmount(String((t as any).welfare_fee_pay_amount || 0));
    // ─── 公開HP (Ange Spa) 用フィールド初期化 ───
    setEditIsPublic(t.is_public || false);
    setEditBio(t.bio || "");
    setEditCatchphrase(t.catchphrase || "");
    setEditSpecialty(t.specialty || "");
    setEditPublicMessage(t.message || "");
    setEditTags(Array.isArray(t.tags) ? t.tags : []);
    setEditBodyType(t.body_type || "");
    setEditHairStyle(t.hair_style || "");
    setEditHairColor(t.hair_color || "");
    setEditSubPhotoUrls(Array.isArray(t.sub_photo_urls) ? t.sub_photo_urls : []);
    setEditBlogUrl(t.blog_url || "");
    setEditTwitterUrl(t.twitter_url || "");
    setEditInstagramUrl(t.instagram_url || "");
    setEditPublicSortOrder(String(t.public_sort_order ?? 0));
    setEditIsPickup(t.is_pickup || false);
    setEditIsNewcomer(t.is_newcomer || false);
    setEditSubPhotoFiles([]);
  };

  const handleUpdate = async () => {
    if (!editTarget || !editName.trim()) { setEditMsg("名前を入力してください"); return; }
    setEditSaving(true); setEditMsg("");
    let photoUrl = editTarget.photo_url || "";
    if (editPhotoFile) { const url = await uploadPhoto(editPhotoFile, editTarget.id); if (url) photoUrl = url; }
    // サブ写真アップロード（追加分のみ）
    let finalSubPhotoUrls = [...editSubPhotoUrls];
    if (editSubPhotoFiles.length > 0) {
      const stamp = new Date().getTime();
      for (let i = 0; i < editSubPhotoFiles.length; i++) {
        const f = editSubPhotoFiles[i];
        const ext = f.name.split(".").pop() || "jpg";
        const fn = `therapist_sub_${editTarget.id}_${stamp}_${i}.${ext}`;
        const { error: upErr } = await supabase.storage.from("therapist-photos").upload(fn, f, { upsert: true });
        if (!upErr) {
          const { data: u } = supabase.storage.from("therapist-photos").getPublicUrl(fn);
          if (u?.publicUrl) finalSubPhotoUrls.push(u.publicUrl);
        }
      }
    }
    const { error } = await supabase.from("therapists").update({
      name: editName.trim(), phone: editPhone.trim(), status: editStatus,
      salary_type: editSalaryType, salary_amount: parseInt(editSalaryAmount) || 0,
      age: parseInt(editAge) || 0, interval_minutes: parseInt(editInterval) || 10, transport_fee: parseInt(editTransport) || 0,
      height_cm: parseInt(editHeight) || 0, bust: parseInt(editBust) || 0, waist: parseInt(editWaist) || 0, hip: parseInt(editHip) || 0, cup: editCup,
      photo_url: photoUrl, photo_width: parseInt(editPhotoW) || 400, photo_height: parseInt(editPhotoH) || 600,
      notes: editNotes.trim(),
      has_withholding: editWithholding,
      real_name: editRealName.trim(), address: editAddress.trim(), birth_date: editBirthDate, entry_date: editEntryDate || null, mynumber: editMynumber.trim(),
      has_invoice: editHasInvoice, therapist_invoice_number: editInvoiceNum.trim(),
      email: editEmail.trim(),
      login_email: editLoginEmail.trim(), login_password: editLoginPassword,
      welfare_fee: parseInt(editWelfareFee) || 500,
      welfare_fee_orders_threshold: parseInt(editWelfareOrdersThreshold) || 0,
      welfare_fee_orders_amount: parseInt(editWelfareOrdersAmount) || 0,
      welfare_fee_pay_threshold: parseInt(editWelfarePayThreshold) || 0,
      welfare_fee_pay_amount: parseInt(editWelfarePayAmount) || 0,
      // ─── 公開HP (Ange Spa) 用 ───
      is_public: editIsPublic,
      bio: editBio.trim(),
      catchphrase: editCatchphrase.trim(),
      specialty: editSpecialty.trim(),
      message: editPublicMessage.trim(),
      tags: editTags,
      body_type: editBodyType,
      hair_style: editHairStyle,
      hair_color: editHairColor,
      sub_photo_urls: finalSubPhotoUrls,
      blog_url: editBlogUrl.trim(),
      twitter_url: editTwitterUrl.trim(),
      instagram_url: editInstagramUrl.trim(),
      public_sort_order: parseInt(editPublicSortOrder) || 0,
      is_pickup: editIsPickup,
      is_newcomer: editIsNewcomer,
      ...(editEmail.trim() !== (editTarget.email || "") ? { email_verified: false, email_token: crypto.randomUUID() } : {}),
    }).eq("id", editTarget.id);
    setEditSaving(false);
    if (error) { setEditMsg("更新失敗: " + error.message); }
    else { setEditMsg("更新しました！"); fetchTherapists(); setTimeout(() => { setEditTarget(null); setEditMsg(""); }, 800);
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
  };

  const handleDelete = async () => { if (!deleteTarget) return; setDeleting(true); await supabase.from("therapists").update({ deleted_at: new Date().toISOString() }).eq("id", deleteTarget.id); setDeleting(false); setDeleteTarget(null); fetchTherapists(); toast.show("🗑️ ゴミ箱に移動しました（30日後に自動削除）", "success"); };

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
  const isNewcomer = (t: Therapist) => {
    if (!t.entry_date) return false;
    const diff = Date.now() - new Date(t.entry_date).getTime();
    return diff < newcomerMonths * 30 * 86400000;
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
      {ConfirmModalNode}
      {/* Header */}
      <div className="h-[64px] backdrop-blur-xl border-b flex items-center justify-between px-6 flex-shrink-0" style={{ backgroundColor: dark ? T.card + "cc" : "rgba(255,255,255,0.8)", borderColor: T.border }}>
        <div className="flex items-center gap-4">
          <NavMenu T={T} dark={dark} />
          <div><h1 className="text-[15px] font-medium">セラピスト管理</h1><p className="text-[11px]" style={{ color: T.textMuted }}>{therapists.length}名のセラピスト</p></div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={toggle} className="px-3 py-1.5 text-[10px] rounded-lg cursor-pointer border" style={{ borderColor: T.border, color: T.textSub }}>{dark ? "☀️ ライト" : "🌙 ダーク"}</button>
          <button onClick={openNgRegister} className="px-4 py-2 text-[11px] rounded-xl cursor-pointer font-medium" style={{ backgroundColor: "#c4555518", color: "#c45555", border: "1px solid #c4555544" }}>🚫 NG登録</button>
          <button onClick={() => setShowThImport(true)} className="px-4 py-2 text-[11px] rounded-xl cursor-pointer font-medium" style={{ backgroundColor: "#3b82f618", color: "#3b82f6", border: "1px solid #3b82f644" }}>📥 インポート</button>
          <button onClick={() => { setShowTrash(true); fetchTrash(); }} className="px-4 py-2 text-[11px] rounded-xl cursor-pointer font-medium" style={{ backgroundColor: "#88888818", color: "#888", border: "1px solid #88888844" }}>🗑️ ゴミ箱</button>
          <button onClick={generateBulkLinks} className="px-4 py-2 text-[11px] rounded-xl cursor-pointer font-medium" style={{ backgroundColor: "#c3a78218", color: "#c3a782", border: "1px solid #c3a78244" }}>📨 書類一括発行</button>
          <button onClick={() => { setShowAdd(true); setMsg(""); }} className="px-4 py-2 bg-gradient-to-r from-[#c3a782] to-[#b09672] text-white text-[11px] rounded-xl cursor-pointer">+ 新規登録</button>
        </div>
      </div>

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
                <div key={t.id} draggable onDragStart={(e) => { e.dataTransfer.setData("therapistId", String(t.id)); e.dataTransfer.setData("sortOrder", String(t.sort_order || i)); }} onDragOver={(e) => e.preventDefault()} onDrop={async (e) => { e.preventDefault(); const fromId = Number(e.dataTransfer.getData("therapistId")); if (fromId === t.id) return; const fromIdx = filtered.findIndex(x => x.id === fromId); const toIdx = filtered.findIndex(x => x.id === t.id); if (fromIdx < 0 || toIdx < 0) return; const reordered = [...filtered]; const [moved] = reordered.splice(fromIdx, 1); reordered.splice(toIdx, 0, moved); for (let j = 0; j < reordered.length; j++) { await supabase.from("therapists").update({ sort_order: j }).eq("id", reordered[j].id); } fetchTherapists(); }} className="rounded-xl border p-2.5 transition-all duration-200 cursor-grab active:cursor-grabbing hover:shadow-md" style={{ backgroundColor: T.card, borderColor: T.border }} onClick={() => { setDetailTarget(t); loadContract(t.id); }}>
                  <div className="flex items-center gap-2 mb-1.5">
                    {t.photo_url ? (
                      <img src={t.photo_url} alt={t.name} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] text-white font-medium flex-shrink-0" style={{ backgroundColor: colors[i % colors.length] }}>{t.name?.charAt(0)}</div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1"><p className="text-[11px] font-medium truncate">{t.name}</p>{isNewcomer(t) && <span className="px-1 py-0.5 rounded text-[7px] font-medium flex-shrink-0" style={{ backgroundColor: "#8b5cf618", color: "#8b5cf6" }}>NEW</span>}<span className="px-1.5 py-0.5 rounded text-[7px] font-medium flex-shrink-0" style={{ backgroundColor: st.bg, color: st.text }}>{st.label}</span></div>
                      <p className="text-[9px] truncate" style={{ color: T.textMuted }}>{t.phone || "電話番号なし"}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1 mb-1" onClick={(e) => e.stopPropagation()}>
                    {contractsMap[t.id]?.status === "signed" ? (
                      <span className="px-2 py-0.5 text-[9px] rounded-md font-medium" style={{ backgroundColor: "#22c55e18", color: "#22c55e" }}>✅ 契約済</span>
                    ) : (
                      <button onClick={async () => { await generateContractLink(t.id); }} className="px-2 py-0.5 text-[9px] rounded-md font-medium cursor-pointer" style={{ backgroundColor: "#c4555518", color: "#c45555", border: "none" }}>❌ 未契約</button>
                    )}
                    {t.license_photo_url ? (
                      <span className="px-2 py-0.5 text-[9px] rounded-md font-medium" style={{ backgroundColor: "#3b82f618", color: "#3b82f6" }}>✅ 身分証</span>
                    ) : (
                      <button onClick={async () => { await generateLicenseLink(t.id); }} className="px-2 py-0.5 text-[9px] rounded-md font-medium cursor-pointer" style={{ backgroundColor: "#c4555518", color: "#c45555", border: "none" }}>❌ 身分証</button>
                    )}
                    {t.has_invoice ? (
                      <span className="px-2 py-0.5 text-[9px] rounded-md font-medium" style={{ backgroundColor: "#a855f718", color: "#a855f7" }}>✅ 適格</span>
                    ) : (
                      <button onClick={async () => { await generateInvoiceLink(t.id); }} className="px-2 py-0.5 text-[9px] rounded-md font-medium cursor-pointer" style={{ backgroundColor: "#c4555518", color: "#c45555", border: "none" }}>❌ 適格</button>
                    )}
                    {(t as any).mynumber ? (
                      <span className="px-2 py-0.5 text-[9px] rounded-md font-medium" style={{ backgroundColor: "#f59e0b18", color: "#f59e0b" }}>✅ マイナ</span>
                    ) : (
                      <span className="px-2 py-0.5 text-[9px] rounded-md font-medium" style={{ backgroundColor: "#c4555518", color: "#c45555" }}>❌ マイナ</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-2 text-[8px] mb-1" style={{ color: T.textSub }}>
                    {t.age > 0 && <span>{t.age}歳</span>}
                    {t.interval_minutes > 0 && <span>{t.interval_minutes}分</span>}
                    {t.height_cm > 0 && <span>{t.height_cm}cm</span>}
                    {t.cup && <span>{t.cup}</span>}
                    {(() => { const amt = t.salary_amount || 0; if (amt === 0) return null; const brColor = amt >= 1500 ? "#d4a843" : amt >= 1000 ? "#8b5cf6" : amt >= 500 ? "#4a7c59" : T.textMuted; const icon = amt >= 1500 ? "👑" : amt >= 1000 ? "💎" : "⭐"; return <span style={{ color: brColor }}>{icon}+{amt.toLocaleString()}円</span>; })()}
                  </div>
                  <div className="flex items-center justify-between" onClick={(e) => e.stopPropagation()}>
                    <div className="flex gap-1 items-center">
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
                  <div className="flex items-center gap-2"><h2 className="text-[20px] font-medium">{detailTarget.name}</h2>{isNewcomer(detailTarget) && <span className="px-2 py-0.5 rounded-md text-[10px] font-medium" style={{ backgroundColor: "#8b5cf618", color: "#8b5cf6" }}>NEW</span>}<span className="px-2 py-0.5 rounded-md text-[10px] font-medium" style={{ backgroundColor: (statusMap[detailTarget.status] || statusMap.active).bg, color: (statusMap[detailTarget.status] || statusMap.active).text }}>{(statusMap[detailTarget.status] || statusMap.active).label}</span></div>
                  <p className="text-[12px]" style={{ color: T.textSub }}>{detailTarget.phone || "電話番号なし"}</p>
                  {detailTarget.email && <div className="flex items-center gap-2 mt-0.5"><p className="text-[11px]" style={{ color: T.textSub }}>✉️ {detailTarget.email}</p>{detailTarget.email_verified ? <span className="text-[8px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "#22c55e18", color: "#22c55e" }}>✅確認済み</span> : <span className="text-[8px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "#f59e0b18", color: "#f59e0b" }}>未確認</span>}</div>}
                </div>
              </div>
              <div className="space-y-3">
                {(() => { const amt = detailTarget.salary_amount || 0; const brColor = amt >= 1500 ? "#d4a843" : amt >= 1000 ? "#8b5cf6" : amt >= 500 ? "#4a7c59" : T.textMuted; const icon = amt >= 1500 ? "👑" : amt >= 1000 ? "💎" : amt >= 500 ? "⭐" : ""; const brLabel = getSalaryLabel(detailTarget) || "通常"; return <div className="flex justify-between text-[12px]"><span style={{ color: T.textMuted }}>バックレート</span><span className="font-medium" style={{ color: brColor }}>{icon} {brLabel}</span></div>; })()}
                {detailTarget.age > 0 && <div className="flex justify-between text-[12px]"><span style={{ color: T.textMuted }}>年齢</span><span>{detailTarget.age}歳</span></div>}
                {detailTarget.interval_minutes > 0 && <div className="flex justify-between text-[12px]"><span style={{ color: T.textMuted }}>インターバル</span><span>{detailTarget.interval_minutes}分</span></div>}
                {detailTarget.transport_fee > 0 && <div className="flex justify-between text-[12px]"><span style={{ color: T.textMuted }}>交通費（実費精算分）</span><span>¥{detailTarget.transport_fee.toLocaleString()}</span></div>}
                {detailTarget.height_cm > 0 && <div className="flex justify-between text-[12px]"><span style={{ color: T.textMuted }}>身長</span><span>{detailTarget.height_cm}cm</span></div>}
                {(detailTarget.bust > 0 || detailTarget.waist > 0 || detailTarget.hip > 0) && <div className="flex justify-between text-[12px]"><span style={{ color: T.textMuted }}>スリーサイズ</span><span>B{detailTarget.bust} W{detailTarget.waist} H{detailTarget.hip}</span></div>}
                {detailTarget.cup && <div className="flex justify-between text-[12px]"><span style={{ color: T.textMuted }}>カップ</span><span>{detailTarget.cup}カップ</span></div>}
                {detailTarget.notes && <div className="pt-2" style={{ borderTop: `1px solid ${T.cardAlt}` }}><p className="text-[11px] mb-1" style={{ color: T.textMuted }}>📝 備考・メモ</p><p className="text-[12px] whitespace-pre-wrap" style={{ color: T.textSub }}>{detailTarget.notes}</p></div>}

                {/* 契約書 */}
                <div className="pt-3 mt-2" style={{ borderTop: `1px solid ${T.cardAlt}` }}>
                  <p className="text-[11px] mb-2" style={{ color: T.textMuted }}>📝 業務委託契約書</p>
                  {contractInfo?.status === "signed" ? (
                    <div>
                      <span className="text-[10px] px-2 py-0.5 rounded" style={{ backgroundColor: "#22c55e18", color: "#22c55e" }}>✅ 契約済み</span>
                      <p className="text-[10px] mt-1" style={{ color: T.textMuted }}>{contractInfo.signed_at ? new Date(contractInfo.signed_at).toLocaleDateString("ja") + " 署名完了" : ""}</p>
                    </div>
                  ) : contractInfo?.status === "pending" ? (
                    <div>
                      <span className="text-[10px] px-2 py-0.5 rounded" style={{ backgroundColor: "#f59e0b18", color: "#f59e0b" }}>⏳ 署名待ち</span>
                      {contractUrl && (
                        <div className="mt-2 flex gap-2">
                          <button onClick={() => { navigator.clipboard.writeText(contractUrl); toast.show("URLをコピーしました", "success"); }} className="px-3 py-1.5 text-[10px] rounded-lg cursor-pointer" style={{ backgroundColor: "#3b82f618", color: "#3b82f6", border: "1px solid #3b82f644" }}>📋 URLコピー</button>
                          <button onClick={() => { loadContract(detailTarget.id); }} className="px-3 py-1.5 text-[10px] rounded-lg cursor-pointer" style={{ backgroundColor: T.cardAlt, color: T.textSub, border: `1px solid ${T.border}` }}>🔄 状態確認</button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <button onClick={() => generateContractLink(detailTarget.id)} className="px-3 py-1.5 text-[10px] rounded-lg cursor-pointer" style={{ backgroundColor: "#c3a78218", color: "#c3a782", border: "1px solid #c3a78244" }}>📝 契約書リンクを発行</button>
                  )}
                </div>

                {/* 免許証 */}
                <div className="pt-3 mt-2" style={{ borderTop: `1px solid ${T.cardAlt}` }}>
                  <p className="text-[11px] mb-2" style={{ color: T.textMuted }}>🪪 身分証</p>
                  {detailTarget.license_photo_url ? (
                    <div>
                      <span className="text-[10px] px-2 py-0.5 rounded" style={{ backgroundColor: "#3b82f618", color: "#3b82f6" }}>🪪 アップロード済み</span>
                      <div className="flex gap-2 mt-2">
                        <img src={detailTarget.license_photo_url} alt="表面" style={{ width: 100, height: 65, objectFit: "cover", borderRadius: 6, border: `1px solid ${T.border}` }} />
                        {detailTarget.license_photo_url_back && <img src={detailTarget.license_photo_url_back} alt="裏面" style={{ width: 100, height: 65, objectFit: "cover", borderRadius: 6, border: `1px solid ${T.border}` }} />}
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => generateLicenseLink(detailTarget.id)} className="px-3 py-1.5 text-[10px] rounded-lg cursor-pointer" style={{ backgroundColor: "#8b5cf618", color: "#8b5cf6", border: "1px solid #8b5cf644" }}>🪪 身分証リンクを発行</button>
                  )}
                </div>

                {/* 適格事業者 */}
                <div className="pt-3 mt-2" style={{ borderTop: `1px solid ${T.cardAlt}` }}>
                  <p className="text-[11px] mb-2" style={{ color: T.textMuted }}>📋 適格事業者登録通知書</p>
                  {detailTarget.has_invoice ? (
                    <div>
                      <span className="text-[10px] px-2 py-0.5 rounded" style={{ backgroundColor: "#a855f718", color: "#a855f7" }}>✅ 提出済み</span>
                      {detailTarget.therapist_invoice_number && <p className="text-[12px] font-mono mt-1" style={{ color: T.text }}>{detailTarget.therapist_invoice_number}</p>}
                      {detailTarget.invoice_photo_url && <img src={detailTarget.invoice_photo_url} alt="通知書" style={{ width: 100, height: 65, objectFit: "cover", borderRadius: 6, border: `1px solid ${T.border}`, marginTop: 4 }} />}
                    </div>
                  ) : (
                    <button onClick={() => generateInvoiceLink(detailTarget.id)} className="px-3 py-1.5 text-[10px] rounded-lg cursor-pointer" style={{ backgroundColor: "#a855f718", color: "#a855f7", border: "1px solid #a855f744" }}>📋 適格事業者リンクを発行</button>
                  )}
                </div>
              </div>

              {/* ── 証明書発行 ── */}
              <div className="pt-3 mt-3" style={{ borderTop: `1px solid ${T.border}` }}>
                <p className="text-[11px] mb-2" style={{ color: T.textMuted }}>📄 証明書発行</p>
                <a href="/tax-dashboard" onClick={() => setDetailTarget(null)} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] cursor-pointer" style={{ backgroundColor: "#c3a78212", color: "#c3a782", border: "1px solid #c3a78230", textDecoration: "none" }}>
                  📄 バックオフィスで証明書を発行 →
                </a>
                <p className="text-[9px] mt-1.5" style={{ color: T.textFaint }}>在籍証明・報酬支払証明・取引実績証明の発行はバックオフィスから行えます</p>
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
              <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>🆕 入店日</label><input type="date" value={addEntryDate} onChange={(e) => setAddEntryDate(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>名前 <span style={{ color: "#c49885" }}>*</span></label><input type="text" value={addName} onChange={(e) => setAddName(e.target.value)} placeholder="セラピスト名" className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} /></div>
                <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>電話番号</label><input type="tel" value={addPhone} onChange={(e) => setAddPhone(e.target.value)} placeholder="090-xxxx-xxxx" className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} /></div>
              </div>
              <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>✉️ メールアドレス</label><input type="email" value={addEmail} onChange={(e) => setAddEmail(e.target.value)} placeholder="example@gmail.com" className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} /></div>
              <div className="rounded-xl p-3" style={{ backgroundColor: T.cardAlt, border: `1px solid ${T.border}` }}>
                <p className="text-[11px] font-medium mb-2" style={{ color: "#85a8c4" }}>🔐 マイページログイン設定</p>
                <div className="space-y-2">
                  <div><label className="block text-[9px] mb-1" style={{ color: T.textMuted }}>ログイン用メール</label><input type="email" value={addLoginEmail} onChange={(e) => setAddLoginEmail(e.target.value)} placeholder="mypage@example.com" className="w-full px-3 py-2 rounded-xl text-[12px] outline-none" style={inputStyle} /></div>
                  <div><label className="block text-[9px] mb-1" style={{ color: T.textMuted }}>パスワード</label><div className="flex gap-2"><input type="text" value={addLoginPassword} onChange={(e) => setAddLoginPassword(e.target.value)} placeholder="パスワード" className="flex-1 px-3 py-2 rounded-xl text-[12px] outline-none font-mono" style={inputStyle} /><button type="button" onClick={() => setAddLoginPassword(generatePassword())} className="px-3 py-2 text-[10px] rounded-xl cursor-pointer whitespace-nowrap" style={{ backgroundColor: "#85a8c418", color: "#85a8c4", border: "1px solid #85a8c444" }}>🔄 自動生成</button></div></div>
                </div>
              </div>
              <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>ステータス</label><div className="flex gap-2">{Object.entries(statusMap).map(([key, val]) => (<button key={key} onClick={() => setAddStatus(key)} className={`px-3 py-1.5 rounded-xl text-[11px] cursor-pointer ${addStatus === key ? "ring-2 ring-offset-1" : "opacity-50"}`} style={{ backgroundColor: val.bg, color: val.text }}>{val.label}</button>))}</div></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>給料タイプ</label><select value={addSalaryType} onChange={(e) => setAddSalaryType(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none cursor-pointer" style={inputStyle}><option value="fixed">〇〇円UP</option><option value="percent">〇〇%UP</option></select></div>
                <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>金額/率</label><input type="text" inputMode="numeric" value={addSalaryAmount} onChange={(e) => setAddSalaryAmount(e.target.value.replace(/[^0-9]/g, ""))} placeholder={addSalaryType === "fixed" ? "500" : "5"} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} /></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>年齢</label><input type="text" inputMode="numeric" value={addAge} onChange={(e) => setAddAge(e.target.value.replace(/[^0-9]/g, ""))} placeholder="25" className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} /></div>
                <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>インターバル</label><select value={addInterval} onChange={(e) => setAddInterval(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none cursor-pointer" style={inputStyle}>{INTERVALS.map((m) => <option key={m} value={m}>{m}分</option>)}</select></div>
                <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>交通費（実費精算分）</label><select value={addTransport} onChange={(e) => setAddTransport(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none cursor-pointer" style={inputStyle}><option value="0">なし</option><option value="500">¥500</option><option value="1000">¥1,000</option><option value="1500">¥1,500</option><option value="2000">¥2,000</option><option value="2500">¥2,500</option><option value="3000">¥3,000</option></select></div>
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
              <button onClick={() => setEditTab("public")} className="px-4 py-1.5 rounded-lg text-[11px] cursor-pointer" style={{ backgroundColor: editTab === "public" ? "#e8849a22" : T.cardAlt, color: editTab === "public" ? "#e8849a" : T.textMuted, border: `1px solid ${editTab === "public" ? "#e8849a66" : T.border}`, fontWeight: editTab === "public" ? 700 : 400 }}>③ 公開HP 🌸</button>
            </div>

            {editTab === "basic" && (
            <div className="space-y-4">
              <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>🆕 入店日</label><input type="date" value={editEntryDate} onChange={(e) => setEditEntryDate(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} />{editEntryDate && (() => { const d = Math.floor((Date.now() - new Date(editEntryDate).getTime()) / 86400000); return <p className="text-[10px] mt-1" style={{ color: "#8b5cf6" }}>入店から{d}日（{Math.floor(d/30)}ヶ月）</p>; })()}</div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>名前 <span style={{ color: "#c49885" }}>*</span></label><input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} /></div>
                <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>電話番号</label><input type="tel" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} /></div>
              </div>
              <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>📧 メールアドレス {editTarget?.email_verified ? <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "#22c55e18", color: "#22c55e" }}>✅ 確認済み</span> : editTarget?.email ? <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "#f59e0b18", color: "#f59e0b" }}>未確認</span> : null}</label><input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} placeholder="example@gmail.com" className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} /></div>
              <div className="rounded-xl p-3" style={{ backgroundColor: T.cardAlt, border: `1px solid ${T.border}` }}>
                <p className="text-[11px] font-medium mb-2" style={{ color: "#85a8c4" }}>🔐 マイページログイン設定</p>
                <div className="space-y-2">
                  <div><label className="block text-[9px] mb-1" style={{ color: T.textMuted }}>ログイン用メール</label><input type="email" value={editLoginEmail} onChange={(e) => setEditLoginEmail(e.target.value)} placeholder="mypage@example.com" className="w-full px-3 py-2 rounded-xl text-[12px] outline-none" style={inputStyle} /></div>
                  <div><label className="block text-[9px] mb-1" style={{ color: T.textMuted }}>パスワード</label><div className="flex gap-2"><input type="text" value={editLoginPassword} onChange={(e) => setEditLoginPassword(e.target.value)} placeholder="パスワード" className="flex-1 px-3 py-2 rounded-xl text-[12px] outline-none font-mono" style={inputStyle} /><button type="button" onClick={() => setEditLoginPassword(generatePassword())} className="px-3 py-2 text-[10px] rounded-xl cursor-pointer whitespace-nowrap" style={{ backgroundColor: "#85a8c418", color: "#85a8c4", border: "1px solid #85a8c444" }}>🔄 自動生成</button></div></div>
                  {editLoginEmail && editLoginPassword && <div className="rounded-lg p-2 mt-1" style={{ backgroundColor: "#22c55e10" }}><p className="text-[9px]" style={{ color: "#22c55e" }}>✅ マイページURL: {typeof window !== "undefined" ? window.location.origin : ""}/mypage</p><p className="text-[9px]" style={{ color: T.textMuted }}>ID: {editLoginEmail} / PW: {editLoginPassword}</p><button type="button" onClick={() => { const url = typeof window !== "undefined" ? window.location.origin : ""; const text = `【チョップ マイページ】\n\nURL: ${url}/mypage\nメール: ${editLoginEmail}\nパスワード: ${editLoginPassword}\n\n上記でログインしてください✨`; navigator.clipboard.writeText(text); toast.show("ログイン情報をコピーしました！", "success"); }} className="mt-1.5 w-full py-2 text-[10px] rounded-lg cursor-pointer font-medium" style={{ backgroundColor: "#c3a78220", color: "#c3a782", border: "1px solid #c3a78244" }}>📋 ログイン情報をコピー（LINE送信用）</button></div>}
                </div>
              </div>
              <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>ステータス</label><div className="flex gap-2">{Object.entries(statusMap).map(([key, val]) => (<button key={key} onClick={() => setEditStatus(key)} className={`px-3 py-1.5 rounded-xl text-[11px] cursor-pointer ${editStatus === key ? "ring-2 ring-offset-1" : "opacity-50"}`} style={{ backgroundColor: val.bg, color: val.text }}>{val.label}</button>))}</div></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>給料タイプ</label><select value={editSalaryType} onChange={(e) => setEditSalaryType(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none cursor-pointer" style={inputStyle}><option value="fixed">〇〇円UP</option><option value="percent">〇%UP</option></select></div>
                <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>金額/率</label><input type="text" inputMode="numeric" value={editSalaryAmount} onChange={(e) => setEditSalaryAmount(e.target.value.replace(/[^0-9]/g, ""))} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} /></div>
              </div>
              {(() => { const amt = parseInt(editSalaryAmount) || 0; const brColor = amt >= 1500 ? "#d4a843" : amt >= 1000 ? "#8b5cf6" : amt >= 500 ? "#4a7c59" : T.textMuted; const brLabel = amt > 0 ? (editSalaryType === "percent" ? `${amt}%UP` : `+${amt.toLocaleString()}円UP`) : "通常（バックUPなし）"; return (
                <div className="rounded-xl p-3 flex items-center gap-3" style={{ backgroundColor: brColor + "12", border: `1px solid ${brColor}33` }}>
                  <span className="text-[18px]">{amt >= 1500 ? "👑" : amt >= 1000 ? "💎" : amt >= 500 ? "⭐" : "📋"}</span>
                  <div><p className="text-[12px] font-medium" style={{ color: brColor }}>現在のバックレート: {brLabel}</p><p className="text-[9px]" style={{ color: T.textMuted }}>バックレート自動計算により毎月更新されます</p></div>
                </div>
              ); })()}
              <div className="grid grid-cols-3 gap-3">
                <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>年齢</label><input type="text" inputMode="numeric" value={editAge} onChange={(e) => setEditAge(e.target.value.replace(/[^0-9]/g, ""))} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} /></div>
                <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>インターバル</label><select value={editInterval} onChange={(e) => setEditInterval(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none cursor-pointer" style={inputStyle}>{INTERVALS.map((m) => <option key={m} value={m}>{m}分</option>)}</select></div>
                <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>交通費（実費精算分）</label><select value={editTransport} onChange={(e) => setEditTransport(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none cursor-pointer" style={inputStyle}><option value="0">なし</option><option value="500">¥500</option><option value="1000">¥1,000</option><option value="1500">¥1,500</option><option value="2000">¥2,000</option><option value="2500">¥2,500</option><option value="3000">¥3,000</option></select></div>
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
              <div className="rounded-xl p-3" style={{ backgroundColor: T.cardAlt, border: `1px solid ${T.border}` }}>
                <p className="text-[11px] font-medium mb-2" style={{ color: T.textSub }}>🧹 備品・リネン代</p>
                <div className="space-y-2">
                  <div><label className="block text-[9px] mb-1" style={{ color: T.textMuted }}>基本金額（1本以上で適用）</label><input type="text" inputMode="numeric" value={editWelfareFee} onChange={(e) => setEditWelfareFee(e.target.value.replace(/[^0-9]/g, ""))} placeholder="500" className="w-full px-3 py-2 rounded-xl text-[12px] outline-none" style={inputStyle} /></div>
                  <div className="rounded-lg p-2.5" style={{ backgroundColor: dark ? "#ffffff06" : "#00000006" }}>
                    <p className="text-[9px] font-medium mb-1.5" style={{ color: "#f59e0b" }}>条件① 本数が一定以上の場合</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div><label className="block text-[8px] mb-0.5" style={{ color: T.textFaint }}>○本以上</label><input type="text" inputMode="numeric" value={editWelfareOrdersThreshold} onChange={(e) => setEditWelfareOrdersThreshold(e.target.value.replace(/[^0-9]/g, ""))} placeholder="0" className="w-full px-2 py-1.5 rounded-lg text-[11px] outline-none" style={inputStyle} /></div>
                      <div><label className="block text-[8px] mb-0.5" style={{ color: T.textFaint }}>→ 金額</label><input type="text" inputMode="numeric" value={editWelfareOrdersAmount} onChange={(e) => setEditWelfareOrdersAmount(e.target.value.replace(/[^0-9]/g, ""))} placeholder="0" className="w-full px-2 py-1.5 rounded-lg text-[11px] outline-none" style={inputStyle} /></div>
                    </div>
                  </div>
                  <div className="rounded-lg p-2.5" style={{ backgroundColor: dark ? "#ffffff06" : "#00000006" }}>
                    <p className="text-[9px] font-medium mb-1.5" style={{ color: "#a855f7" }}>条件② 給料が一定以上の場合（優先）</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div><label className="block text-[8px] mb-0.5" style={{ color: T.textFaint }}>¥○以上</label><input type="text" inputMode="numeric" value={editWelfarePayThreshold} onChange={(e) => setEditWelfarePayThreshold(e.target.value.replace(/[^0-9]/g, ""))} placeholder="0" className="w-full px-2 py-1.5 rounded-lg text-[11px] outline-none" style={inputStyle} /></div>
                      <div><label className="block text-[8px] mb-0.5" style={{ color: T.textFaint }}>→ 金額</label><input type="text" inputMode="numeric" value={editWelfarePayAmount} onChange={(e) => setEditWelfarePayAmount(e.target.value.replace(/[^0-9]/g, ""))} placeholder="0" className="w-full px-2 py-1.5 rounded-lg text-[11px] outline-none" style={inputStyle} /></div>
                    </div>
                  </div>
                  <p className="text-[8px]" style={{ color: T.textFaint }}>※ 条件②（給料）→ 条件①（本数）→ 基本金額 の優先順で判定</p>
                </div>
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
                    }} data-pin-key={n === "del" ? "del" : String(n)} className="h-12 rounded-xl text-[16px] font-medium cursor-pointer" style={{ backgroundColor: T.cardAlt, color: n === "del" ? "#c45555" : T.text, border: `1px solid ${T.border}` }}>{n === "del" ? "⌫" : n}</button>);
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

                {/* マイナンバー */}
                <div>
                  <label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>🔢 マイナンバー（個人番号）</label>
                  <div className="p-3 rounded-xl" style={{ backgroundColor: "#f59e0b08", border: "1px solid #f59e0b33" }}>
                    <div className="mb-2">
                      <input type="text" value={editMynumber} onChange={(e) => { const v = e.target.value.replace(/[^0-9]/g, "").slice(0, 12); setEditMynumber(v); }}
                        placeholder="12桁の番号を入力" maxLength={12}
                        className="w-full px-3 py-2.5 rounded-xl text-[14px] font-mono tracking-widest outline-none text-center"
                        style={{ ...inputStyle, letterSpacing: "0.2em" }} />
                      {editMynumber && <p className="text-[9px] mt-1 text-center" style={{ color: editMynumber.length === 12 ? "#22c55e" : "#f59e0b" }}>
                        {editMynumber.length}/12桁 {editMynumber.length === 12 ? "✅" : ""}
                      </p>}
                    </div>
                    <div className="rounded-xl p-2.5" style={{ backgroundColor: T.cardAlt }}>
                      <p className="text-[10px] font-medium mb-1.5" style={{ color: T.textSub }}>📷 マイナンバーカード表面</p>
                      {editTarget?.mynumber_photo_url && (
                        <a href={editTarget.mynumber_photo_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 mb-1.5 px-2 py-1 rounded-lg"
                          style={{ backgroundColor: "#f59e0b12", border: "1px solid #f59e0b33" }}>
                          <img src={editTarget.mynumber_photo_url} alt="マイナンバー" className="rounded" style={{ width: 60, height: 38, objectFit: "cover" }} />
                          <span className="text-[9px]" style={{ color: "#f59e0b" }}>📄 カードを表示</span>
                        </a>
                      )}
                      <div className="flex items-center gap-2 flex-wrap">
                        <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[10px] cursor-pointer font-medium"
                          style={{ backgroundColor: "#f59e0b18", color: "#f59e0b", border: "1px solid #f59e0b44" }}>
                          📷 カードを撮影/選択
                          <input type="file" accept="image/*" capture="environment" onChange={async (e) => {
                            const file = e.target.files?.[0]; if (!file) return;
                            setEditMynumberPhoto(file);
                            // AI読取で番号を自動入力
                            setMynumberReading(true);
                            try {
                              const reader = new FileReader();
                              const base64 = await new Promise<string>((resolve) => { reader.onload = () => resolve((reader.result as string).split(",")[1]); reader.readAsDataURL(file); });
                              const res = await fetch("/api/receipt-analyze", { method: "POST", headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ imageBase64: base64, mediaType: file.type,
                                  customPrompt: "このマイナンバーカードの画像から個人番号（12桁の数字）を読み取ってください。JSON形式のみで返してください：{\"mynumber\":\"123456789012\"} 読み取れない場合は{\"mynumber\":\"\"}" }) });
                              const data = await res.json();
                              if (data.ok && data.result?.mynumber) { setEditMynumber(data.result.mynumber.replace(/[^0-9]/g, "").slice(0, 12)); }
                            } catch { /* 手動入力にフォールバック */ }
                            setMynumberReading(false);
                          }} className="hidden" />
                        </label>
                        {mynumberReading && <span className="text-[9px] animate-pulse" style={{ color: "#f59e0b" }}>🤖 番号読取中...</span>}
                        {editMynumberPhoto && !mynumberReading && <span className="text-[9px]" style={{ color: "#22c55e" }}>✅ {editMynumberPhoto.name}</span>}
                      </div>
                      {editMynumberPhoto && (
                        <button onClick={async () => {
                          if (!editTarget || !editMynumberPhoto) return;
                          const ext = editMynumberPhoto.name.split(".").pop();
                          const fn = `therapist_mynumber_${editTarget.id}.${ext}`;
                          await supabase.storage.from("therapist-photos").upload(fn, editMynumberPhoto, { upsert: true });
                          const { data: u } = supabase.storage.from("therapist-photos").getPublicUrl(fn);
                          await supabase.from("therapists").update({ mynumber_photo_url: u.publicUrl }).eq("id", editTarget.id);
                          setEditMynumberPhoto(null); fetchTherapists(); toast.show("マイナンバーカードを保存しました", "success");
                        }} className="mt-1.5 px-3 py-1.5 rounded-lg text-[9px] cursor-pointer"
                          style={{ backgroundColor: "#22c55e22", color: "#22c55e", border: "1px solid #22c55e44" }}>💾 表面を保存</button>
                      )}
                    </div>
                    {/* 裏面 */}
                    <div className="rounded-xl p-2.5 mt-2" style={{ backgroundColor: T.cardAlt }}>
                      <p className="text-[10px] font-medium mb-1.5" style={{ color: T.textSub }}>📷 マイナンバーカード裏面</p>
                      {editTarget?.mynumber_photo_url_back && (
                        <a href={editTarget.mynumber_photo_url_back} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 mb-1.5 px-2 py-1 rounded-lg"
                          style={{ backgroundColor: "#f59e0b12", border: "1px solid #f59e0b33" }}>
                          <img src={editTarget.mynumber_photo_url_back} alt="マイナンバー裏面" className="rounded" style={{ width: 60, height: 38, objectFit: "cover" }} />
                          <span className="text-[9px]" style={{ color: "#f59e0b" }}>📄 裏面を表示</span>
                        </a>
                      )}
                      <div className="flex items-center gap-2 flex-wrap">
                        <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[10px] cursor-pointer font-medium"
                          style={{ backgroundColor: "#f59e0b18", color: "#f59e0b", border: "1px solid #f59e0b44" }}>
                          📷 裏面を撮影/選択
                          <input type="file" accept="image/*" capture="environment" onChange={(e) => { setEditMynumberPhotoBack(e.target.files?.[0] || null); }} className="hidden" />
                        </label>
                        {editMynumberPhotoBack && <span className="text-[9px]" style={{ color: "#22c55e" }}>✅ {editMynumberPhotoBack.name}</span>}
                      </div>
                      {editMynumberPhotoBack && (
                        <button onClick={async () => {
                          if (!editTarget || !editMynumberPhotoBack) return;
                          const ext = editMynumberPhotoBack.name.split(".").pop();
                          const fn = `therapist_mynumber_back_${editTarget.id}.${ext}`;
                          await supabase.storage.from("therapist-photos").upload(fn, editMynumberPhotoBack, { upsert: true });
                          const { data: u } = supabase.storage.from("therapist-photos").getPublicUrl(fn);
                          await supabase.from("therapists").update({ mynumber_photo_url_back: u.publicUrl }).eq("id", editTarget.id);
                          setEditMynumberPhotoBack(null); fetchTherapists(); toast.show("裏面を保存しました", "success");
                        }} className="mt-1.5 px-3 py-1.5 rounded-lg text-[9px] cursor-pointer"
                          style={{ backgroundColor: "#22c55e22", color: "#22c55e", border: "1px solid #22c55e44" }}>💾 裏面を保存</button>
                      )}
                    </div>
                    <p className="text-[8px] mt-2" style={{ color: T.textFaint }}>⚠️ マイナンバーは厳重に管理されます。源泉徴収・支払調書の作成にのみ使用します。</p>
                  </div>
                </div>

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

                <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>🪪 身分証アップロード</label>
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

            {editTab === "public" && (
              <div className="space-y-4">
                {/* 公開/非公開トグル（最重要） */}
                <div className="rounded-xl p-4" style={{ backgroundColor: editIsPublic ? "#e8849a15" : T.cardAlt, border: `1px solid ${editIsPublic ? "#e8849a55" : T.border}` }}>
                  <button type="button" onClick={() => setEditIsPublic(!editIsPublic)} className="w-full flex items-center justify-between cursor-pointer">
                    <div className="flex items-center gap-3">
                      <span className="text-[22px]">{editIsPublic ? "🌸" : "🔒"}</span>
                      <div className="text-left">
                        <div className="text-[13px] font-medium" style={{ color: editIsPublic ? "#e8849a" : T.text }}>
                          {editIsPublic ? "公式HPに掲載中" : "公式HPに非掲載"}
                        </div>
                        <div className="text-[10px]" style={{ color: T.textMuted }}>
                          {editIsPublic ? "Ange Spa 公式サイトで表示されています" : "タップして公開"}
                        </div>
                      </div>
                    </div>
                    <div className="w-11 h-6 rounded-full relative" style={{ backgroundColor: editIsPublic ? "#e8849a" : T.border }}>
                      <div className="w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all" style={{ left: editIsPublic ? "22px" : "2px" }} />
                    </div>
                  </button>
                </div>

                {/* キャッチコピー */}
                <div>
                  <label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>🏷 キャッチコピー <span className="text-[9px]" style={{ color: T.textMuted }}>（一覧カードの上に帯で表示）</span></label>
                  <input type="text" value={editCatchphrase} onChange={(e) => setEditCatchphrase(e.target.value)} placeholder="♡ 高リピート率 ♡" className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} />
                  <p className="text-[9px] mt-1" style={{ color: T.textMuted }}>例: 「▷確変中◁正直やり過ぎました割適応！」「☆ 指名数上昇中 ☆」</p>
                </div>

                {/* 自己紹介 */}
                <div>
                  <label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>💬 自己紹介文</label>
                  <textarea value={editBio} onChange={(e) => setEditBio(e.target.value)} rows={5} placeholder="はじめまして✨ &#13;&#10;皆さまの日頃の疲れを癒す、お手伝いが出来たら嬉しいです♪" className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none resize-none" style={inputStyle} />
                  <p className="text-[9px] mt-1 text-right" style={{ color: T.textMuted }}>{editBio.length} 文字</p>
                </div>

                {/* 得意な施術 */}
                <div>
                  <label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>💆 得意な施術・コース</label>
                  <input type="text" value={editSpecialty} onChange={(e) => setEditSpecialty(e.target.value)} placeholder="アロマ / リンパ / ディープティシュー 等" className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} />
                </div>

                {/* お客様メッセージ */}
                <div>
                  <label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>💌 お客様へのメッセージ</label>
                  <textarea value={editPublicMessage} onChange={(e) => setEditPublicMessage(e.target.value)} rows={3} placeholder="会いに来てくださったら嬉しいです♡" className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none resize-none" style={inputStyle} />
                </div>

                {/* タイプタグ */}
                <div>
                  <label className="block text-[11px] mb-2" style={{ color: T.textSub }}>🎀 タイプ <span className="text-[9px]" style={{ color: T.textMuted }}>（複数選択可）</span></label>
                  <div className="flex flex-wrap gap-1.5">
                    {TYPE_TAGS.map((tag) => {
                      const on = editTags.includes(tag);
                      return (
                        <button key={tag} type="button" onClick={() => setEditTags(on ? editTags.filter((t) => t !== tag) : [...editTags, tag])} className="px-3 py-1.5 rounded-full text-[11px] cursor-pointer transition-all" style={{ backgroundColor: on ? "#e8849a22" : T.cardAlt, color: on ? "#e8849a" : T.textMuted, border: `1px solid ${on ? "#e8849a66" : T.border}` }}>
                          {on ? "✓ " : ""}{tag}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 性格タグ */}
                <div>
                  <label className="block text-[11px] mb-2" style={{ color: T.textSub }}>💗 性格</label>
                  <div className="flex flex-wrap gap-1.5">
                    {PERSONALITY_TAGS.map((tag) => {
                      const on = editTags.includes(tag);
                      return (
                        <button key={tag} type="button" onClick={() => setEditTags(on ? editTags.filter((t) => t !== tag) : [...editTags, tag])} className="px-3 py-1.5 rounded-full text-[11px] cursor-pointer transition-all" style={{ backgroundColor: on ? "#c3a78222" : T.cardAlt, color: on ? "#c3a782" : T.textMuted, border: `1px solid ${on ? "#c3a78266" : T.border}` }}>
                          {on ? "✓ " : ""}{tag}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 特徴タグ */}
                <div>
                  <label className="block text-[11px] mb-2" style={{ color: T.textSub }}>✨ 特徴・PR</label>
                  <div className="flex flex-wrap gap-1.5">
                    {FEATURE_TAGS.map((tag) => {
                      const on = editTags.includes(tag);
                      return (
                        <button key={tag} type="button" onClick={() => setEditTags(on ? editTags.filter((t) => t !== tag) : [...editTags, tag])} className="px-3 py-1.5 rounded-full text-[11px] cursor-pointer transition-all" style={{ backgroundColor: on ? "#85a8c422" : T.cardAlt, color: on ? "#85a8c4" : T.textMuted, border: `1px solid ${on ? "#85a8c466" : T.border}` }}>
                          {on ? "✓ " : ""}{tag}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 体型・髪型・髪色 */}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>👗 体型</label>
                    <select value={editBodyType} onChange={(e) => setEditBodyType(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none cursor-pointer" style={inputStyle}>
                      {BODY_TYPES.map((v) => <option key={v} value={v}>{v || "（未設定）"}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>💇 髪型</label>
                    <select value={editHairStyle} onChange={(e) => setEditHairStyle(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none cursor-pointer" style={inputStyle}>
                      {HAIR_STYLES.map((v) => <option key={v} value={v}>{v || "（未設定）"}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>🎨 髪色</label>
                    <select value={editHairColor} onChange={(e) => setEditHairColor(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none cursor-pointer" style={inputStyle}>
                      {HAIR_COLORS.map((v) => <option key={v} value={v}>{v || "（未設定）"}</option>)}
                    </select>
                  </div>
                </div>

                {/* サブ写真ギャラリー */}
                <div>
                  <label className="block text-[11px] mb-2" style={{ color: T.textSub }}>📸 サブ写真 <span className="text-[9px]" style={{ color: T.textMuted }}>（詳細ページでギャラリー表示）</span></label>
                  <div className="grid grid-cols-4 gap-2 mb-2">
                    {editSubPhotoUrls.map((url, i) => (
                      <div key={i} className="relative aspect-[3/4] rounded-lg overflow-hidden border" style={{ borderColor: T.border }}>
                        <img src={url} alt={`sub-${i}`} className="w-full h-full object-cover" />
                        <button type="button" onClick={() => setEditSubPhotoUrls(editSubPhotoUrls.filter((_, idx) => idx !== i))} className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] cursor-pointer" style={{ backgroundColor: "rgba(0,0,0,0.6)", color: "#fff" }}>✕</button>
                      </div>
                    ))}
                    {editSubPhotoFiles.map((f, i) => (
                      <div key={`new-${i}`} className="relative aspect-[3/4] rounded-lg overflow-hidden border" style={{ borderColor: "#e8849a66", backgroundColor: "#e8849a08" }}>
                        <div className="w-full h-full flex flex-col items-center justify-center gap-1 p-1">
                          <span className="text-[16px]">📸</span>
                          <span className="text-[8px] text-center leading-tight truncate w-full" style={{ color: "#e8849a" }}>{f.name}</span>
                        </div>
                        <button type="button" onClick={() => setEditSubPhotoFiles(editSubPhotoFiles.filter((_, idx) => idx !== i))} className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] cursor-pointer" style={{ backgroundColor: "rgba(0,0,0,0.6)", color: "#fff" }}>✕</button>
                      </div>
                    ))}
                    <label className="aspect-[3/4] rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-1 cursor-pointer transition-all hover:bg-white/5" style={{ borderColor: T.border }}>
                      <span className="text-[20px]">＋</span>
                      <span className="text-[9px]" style={{ color: T.textMuted }}>追加</span>
                      <input type="file" accept="image/*" multiple onChange={(e) => { const files = Array.from(e.target.files || []); setEditSubPhotoFiles([...editSubPhotoFiles, ...files]); }} className="hidden" />
                    </label>
                  </div>
                  {editSubPhotoFiles.length > 0 && <p className="text-[9px]" style={{ color: "#e8849a" }}>📸 {editSubPhotoFiles.length}件が「更新する」押下時にアップロードされます</p>}
                </div>

                {/* SNS・ブログリンク */}
                <div className="rounded-xl p-3" style={{ backgroundColor: T.cardAlt, border: `1px solid ${T.border}` }}>
                  <label className="block text-[11px] mb-2 font-medium" style={{ color: T.textSub }}>🔗 外部リンク</label>
                  <div className="space-y-2">
                    <div>
                      <label className="block text-[9px] mb-0.5" style={{ color: T.textMuted }}>📝 写メ日記 URL</label>
                      <input type="url" value={editBlogUrl} onChange={(e) => setEditBlogUrl(e.target.value)} placeholder="https://ranking-deli.jp/..." className="w-full px-3 py-2 rounded-lg text-[11px] outline-none" style={inputStyle} />
                    </div>
                    <div>
                      <label className="block text-[9px] mb-0.5" style={{ color: T.textMuted }}>🐦 Twitter / X URL</label>
                      <input type="url" value={editTwitterUrl} onChange={(e) => setEditTwitterUrl(e.target.value)} placeholder="https://twitter.com/..." className="w-full px-3 py-2 rounded-lg text-[11px] outline-none" style={inputStyle} />
                    </div>
                    <div>
                      <label className="block text-[9px] mb-0.5" style={{ color: T.textMuted }}>📷 Instagram URL</label>
                      <input type="url" value={editInstagramUrl} onChange={(e) => setEditInstagramUrl(e.target.value)} placeholder="https://instagram.com/..." className="w-full px-3 py-2 rounded-lg text-[11px] outline-none" style={inputStyle} />
                    </div>
                  </div>
                </div>

                {/* 公開設定（ソート順・PICK UP・新人） */}
                <div className="rounded-xl p-3" style={{ backgroundColor: T.cardAlt, border: `1px solid ${T.border}` }}>
                  <label className="block text-[11px] mb-2 font-medium" style={{ color: T.textSub }}>⚙️ 公開設定</label>
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px]" style={{ color: T.text }}>🏆 PICK UP（TOP掲載）</label>
                      <button type="button" onClick={() => setEditIsPickup(!editIsPickup)} className="w-10 h-5 rounded-full relative cursor-pointer" style={{ backgroundColor: editIsPickup ? "#e8849a" : T.border }}>
                        <div className="w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all" style={{ left: editIsPickup ? "22px" : "2px" }} />
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <label className="text-[11px]" style={{ color: T.text }}>🌟 NEW バッジ強制表示</label>
                      <button type="button" onClick={() => setEditIsNewcomer(!editIsNewcomer)} className="w-10 h-5 rounded-full relative cursor-pointer" style={{ backgroundColor: editIsNewcomer ? "#e8849a" : T.border }}>
                        <div className="w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all" style={{ left: editIsNewcomer ? "22px" : "2px" }} />
                      </button>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <label className="text-[11px] flex-1" style={{ color: T.text }}>📊 表示順<span className="text-[9px] ml-1" style={{ color: T.textMuted }}>（小さい順に表示）</span></label>
                      <input type="number" value={editPublicSortOrder} onChange={(e) => setEditPublicSortOrder(e.target.value)} className="w-20 px-2 py-1.5 rounded-lg text-[11px] outline-none text-right" style={inputStyle} />
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
            <h3 className="text-[15px] font-medium mb-2">セラピストをゴミ箱に移動しますか？</h3>
            <p className="text-[12px] mb-6" style={{ color: T.textMuted }}>「{deleteTarget.name}」をゴミ箱に移動します。30日以内なら復元できます。</p>
            <div className="flex gap-3 justify-center">
              <button onClick={handleDelete} disabled={deleting} className="px-6 py-2.5 bg-[#c45555] text-white text-[12px] rounded-xl cursor-pointer disabled:opacity-60">{deleting ? "移動中..." : "🗑️ ゴミ箱に移動"}</button>
              <button onClick={() => setDeleteTarget(null)} className="px-6 py-2.5 border text-[12px] rounded-xl cursor-pointer" style={{ borderColor: T.border, color: T.textSub }}>キャンセル</button>
            </div>
          </div>
        </div>
      )}

      {/* 書類一括発行モーダル */}
      {showBulkLinks && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowBulkLinks(false)}>
          <div className="rounded-2xl border w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col animate-[fadeIn_0.25s]" style={{ backgroundColor: T.card, borderColor: T.border }} onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: `1px solid ${T.border}` }}>
              <div>
                <h2 className="text-[15px] font-medium">📨 書類一括発行</h2>
                <p className="text-[10px]" style={{ color: T.textMuted }}>「📋 LINE用メッセージをコピー」でそのままLINEに貼り付けて送れます</p>
              </div>
              <button onClick={() => setShowBulkLinks(false)} className="text-[18px] cursor-pointer p-1" style={{ color: T.textSub, background: "none", border: "none" }}>✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {bulkLinks.length === 0 ? (
                <div className="text-center py-10" style={{ color: T.textMuted }}>
                  <div className="text-[40px] mb-2">✅</div>
                  <p className="text-[13px]">全員の書類が提出済みです！</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {bulkLinks.map((link, idx) => {
                    const buildMessage = () => {
                      let msg = `${link.name}さん\n\nお疲れ様です🌸\nアンジュスパです。\n\n入店にあたりまして、下記の書類のご提出をお願いしております。\nお手数をおかけしますが、それぞれURLを開いて、署名・写真のアップロードをお願いいたします✨\n\nお預かりした個人情報は適切に管理いたしますので、ご安心ください。\n`;
                      if (link.contract) msg += `\n📝 業務委託契約書（署名）\n${link.contract}\n`;
                      if (link.license) msg += `\n🪪 身分証明書（写真アップロード）\n${link.license}\n`;
                      if (link.invoice) msg += `\n📋 適格事業者登録通知書（※任意）\n登録番号の入力＋写真アップロード\n${link.invoice}\n`;
                      if (link.mynumber) msg += `\n🔢 マイナンバー（個人番号）の提出\n源泉徴収の届出に必要となります\n${link.mynumber}\n`;
                      msg += `\nご不明な点がございましたら、お気軽にご連絡くださいね😊\nよろしくお願いいたします🙏`;
                      return msg;
                    };
                    return (
                      <div key={idx} className="rounded-xl border overflow-hidden" style={{ backgroundColor: T.cardAlt, borderColor: T.border }}>
                        <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: `1px solid ${T.border}` }}>
                          <p className="text-[13px] font-medium" style={{ color: T.text }}>👤 {link.name}</p>
                          <button onClick={async () => {
                            const msg = buildMessage();
                            navigator.clipboard.writeText(msg);
                            try {
                              await supabase.from("notification_logs").insert({
                                channel: "therapist_line",
                                recipient_type: "therapist",
                                recipient_name: link.name,
                                therapist_id: link.id || null,
                                message_type: "contract_docs",
                                body: msg,
                                body_preview: msg.slice(0, 100),
                                sent_by_staff_id: activeStaff?.id || null,
                                sent_by_name: activeStaff?.name || "",
                                status: "copied",
                              });
                            } catch (e) { console.error("通知ログ記録失敗:", e); }
                            toast.show(`${link.name}さんへのメッセージをコピーしました`, "success");
                          }}
                            className="px-3 py-1.5 text-[11px] rounded-lg cursor-pointer font-medium"
                            style={{ background: "linear-gradient(135deg, #c3a782, #a8895e)", color: "#fff", border: "none" }}>
                            📋 LINE用メッセージをコピー
                          </button>
                        </div>
                        <div className="px-4 py-3 text-[11px] whitespace-pre-wrap leading-relaxed" style={{ color: T.textSub, fontFamily: "var(--font-mono, monospace)", maxHeight: 150, overflowY: "auto" }}>
                          {buildMessage()}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ゴミ箱モーダル */}
      {showTrash && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowTrash(false)}>
          <div className="rounded-2xl border w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col animate-[fadeIn_0.25s]" style={{ backgroundColor: T.card, borderColor: T.border }} onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: `1px solid ${T.border}` }}>
              <div>
                <h2 className="text-[15px] font-medium">🗑️ ゴミ箱</h2>
                <p className="text-[10px]" style={{ color: T.textMuted }}>削除から30日後に自動的に完全削除されます</p>
              </div>
              <button onClick={() => setShowTrash(false)} className="text-[18px] cursor-pointer p-1" style={{ color: T.textSub, background: "none", border: "none" }}>✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {trashItems.length === 0 ? (
                <div className="text-center py-10" style={{ color: T.textMuted }}>
                  <div className="text-[40px] mb-2">🗑️</div>
                  <p className="text-[13px]">ゴミ箱は空です</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {trashItems.map(t => {
                    const deletedDate = t.deleted_at ? new Date(t.deleted_at) : new Date();
                    const daysLeft = Math.max(0, 30 - Math.floor((Date.now() - deletedDate.getTime()) / (1000 * 60 * 60 * 24)));
                    return (
                      <div key={t.id} className="rounded-xl border p-3 flex items-center gap-3" style={{ backgroundColor: T.cardAlt, borderColor: T.border }}>
                        <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0" style={{ backgroundColor: T.bg }}>
                          {t.photo_url ? <img src={t.photo_url} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-[14px]">👤</div>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-medium" style={{ color: T.text }}>{t.name}</p>
                          <p className="text-[10px]" style={{ color: T.textMuted }}>
                            削除日: {deletedDate.toLocaleDateString("ja")} ・ 残り{daysLeft}日で完全削除
                          </p>
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                          <button onClick={() => restoreTherapist(t.id)} className="px-3 py-1.5 text-[10px] rounded-lg cursor-pointer" style={{ backgroundColor: "#22c55e18", color: "#22c55e", border: "1px solid #22c55e44" }}>🔄 復元</button>
                          <button onClick={() => permanentDelete(t.id, t.name)} className="px-3 py-1.5 text-[10px] rounded-lg cursor-pointer" style={{ backgroundColor: "#c4555518", color: "#c45555", border: "1px solid #c4555544" }}>完全削除</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* NG登録モーダル */}
      {showNgRegister && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowNgRegister(false)}>
          <div className="rounded-2xl w-full max-w-md animate-[fadeIn_0.25s]" style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }} onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: `1px solid ${T.border}` }}>
              <h2 className="text-[16px] font-medium" style={{ color: "#c45555" }}>🚫 NG登録</h2>
              <button onClick={() => setShowNgRegister(false)} className="text-[14px] cursor-pointer p-2" style={{ color: T.textSub, background: "none", border: "none" }}>✕</button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="rounded-xl p-3" style={{ backgroundColor: "#85a8c410", border: "1px solid #85a8c430" }}>
                <p className="text-[10px] leading-relaxed" style={{ color: T.textSub }}>
                  🛡️ NG登録されたお客様は、ネット予約時にそのセラピストの出勤枠が<span style={{ color: "#c45555", fontWeight: 600 }}>すべてお休み表示</span>になります。
                  タイムチャートでのオーダー登録時もセラピスト名の横に<span style={{ color: "#c45555", fontWeight: 600 }}>⚠️NG</span>と表示されます。
                </p>
                <p className="text-[10px] mt-1" style={{ color: T.textMuted }}>稼働中セラピストのNG登録が<span style={{ color: "#f59e0b", fontWeight: 600 }}>3件で要注意</span>、<span style={{ color: "#c45555", fontWeight: 600 }}>5件以上で出禁</span>に自動変更されます（休止・退職セラピストは除外）。</p>
              </div>
              {/* セラピスト選択 */}
              <div>
                <label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>セラピストを選択</label>
                <select value={ngTherapistId} onChange={e => setNgTherapistId(Number(e.target.value))} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none cursor-pointer" style={inputStyle}>
                  <option value={0}>— セラピストを選択 —</option>
                  {therapists.filter(t => t.status === "active").map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>

              {/* お客様選択 */}
              <div>
                <label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>お客様を検索・選択</label>
                {ngSelectedCust ? (
                  <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl" style={{ backgroundColor: "#c4555512", border: "1px solid #c4555544" }}>
                    <span className="text-[13px] font-medium flex-1" style={{ color: "#c45555" }}>{ngSelectedCust.name}</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ backgroundColor: ngSelectedCust.rank === "banned" ? "#c4555518" : ngSelectedCust.rank === "caution" ? "#f59e0b18" : ngSelectedCust.rank === "good" ? "#4a7c5918" : "#88878018", color: ngSelectedCust.rank === "banned" ? "#c45555" : ngSelectedCust.rank === "caution" ? "#f59e0b" : ngSelectedCust.rank === "good" ? "#4a7c59" : "#888780" }}>{ngSelectedCust.rank === "banned" ? "出禁" : ngSelectedCust.rank === "caution" ? "要注意" : ngSelectedCust.rank === "good" ? "善良" : "普通"}</span>
                    <button onClick={() => { setNgSelectedCust(null); setNgCustSearch(""); }} className="text-[11px] cursor-pointer" style={{ color: "#c45555", background: "none", border: "none" }}>✕</button>
                  </div>
                ) : (
                  <>
                    <input type="text" placeholder="名前・電話番号で検索" value={ngCustSearch} onChange={e => setNgCustSearch(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} />
                    {ngCustSearch.length >= 1 && (
                      <div className="mt-1 max-h-[150px] overflow-y-auto rounded-xl border" style={{ borderColor: T.border }}>
                        {ngCustomers.filter(c => c.name?.includes(ngCustSearch) || c.phone?.includes(ngCustSearch)).slice(0, 10).map(c => (
                          <button key={c.id} onClick={() => { setNgSelectedCust(c); setNgCustSearch(""); }} className="w-full text-left px-3 py-2 text-[12px] cursor-pointer flex items-center gap-2" style={{ borderBottom: `1px solid ${T.border}`, backgroundColor: T.cardAlt, color: T.text }}>
                            <span>{c.name}</span>
                            {c.phone && <span className="text-[10px]" style={{ color: T.textMuted }}>{c.phone}</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* NG理由 */}
              <div>
                <label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>NG理由（任意）</label>
                <textarea value={ngReason} onChange={e => setNgReason(e.target.value)} placeholder="理由を入力（任意）" rows={2} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none resize-none" style={inputStyle} />
              </div>

              {ngMsg && <div className="px-4 py-3 rounded-xl text-[12px]" style={{ backgroundColor: ngMsg.startsWith("✅") ? "#4a7c5918" : "#c4555518", color: ngMsg.startsWith("✅") ? "#4a7c59" : "#c45555" }}>{ngMsg}</div>}

              <div className="flex gap-3">
                <button onClick={registerNg} disabled={ngSaving || !ngSelectedCust || !ngTherapistId} className="px-6 py-3 rounded-xl text-[13px] font-medium cursor-pointer text-white disabled:opacity-50" style={{ backgroundColor: "#c45555" }}>
                  {ngSaving ? "登録中..." : "🚫 NG登録する"}
                </button>
                <button onClick={() => setShowNgRegister(false)} className="px-6 py-3 border text-[13px] rounded-xl cursor-pointer" style={{ borderColor: T.border, color: T.textSub }}>閉じる</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* セラピストインポート */}
      {showThImport && (
        <Suspense fallback={null}>
          <TherapistImportPanel T={T} onClose={() => setShowThImport(false)} onComplete={fetchTherapists} />
        </Suspense>
      )}

      <style jsx global>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  );
}
