"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";
import { useTheme } from "../../lib/theme";
import { NavMenu } from "../../lib/nav-menu";
import { useStaffSession } from "../../lib/staff-session";
import { useToast } from "../../lib/toast";
import { generateContractCertificate, generatePaymentCertificate, generateTransactionCertificate, generatePaymentCertificateHtml } from "../../lib/certificate-pdf";
import JSZip from "jszip";
import { useConfirm } from "../../components/useConfirm";

export default function TaxDashboard() {
  const router = useRouter();
  const toast = useToast();
  const { dark, toggle, T } = useTheme();
  const { confirm, ConfirmModalNode } = useConfirm();
  const { activeStaff, canAccessCashDashboard } = useStaffSession();

  const [dashTab, setDashTab] = useState<"company" | "mynumber" | "certificate" | "vendors" | "documents" | "delivery">("certificate");
  const [companyName, setCompanyName] = useState(""); const [companyAddress, setCompanyAddress] = useState(""); const [companyPhone, setCompanyPhone] = useState(""); const [invoiceNumber, setInvoiceNumber] = useState(""); const [companyStoreId, setCompanyStoreId] = useState<number>(0);
  const [corporateNumber, setCorporateNumber] = useState(""); const [fiscalMonth, setFiscalMonth] = useState(3); const [representativeName, setRepresentativeName] = useState(""); const [entityType, setEntityType] = useState("llc"); const [taxOffice, setTaxOffice] = useState(""); const [taxAccountantName, setTaxAccountantName] = useState(""); const [taxAccountantPhone, setTaxAccountantPhone] = useState(""); const [taxAccountantAddress, setTaxAccountantAddress] = useState(""); const [laborConsultantName, setLaborConsultantName] = useState(""); const [laborConsultantPhone, setLaborConsultantPhone] = useState("");
  // コーポレートサイト用
  const [companyNameEn, setCompanyNameEn] = useState("");
  const [companyEstablished, setCompanyEstablished] = useState("");
  const [companyCapital, setCompanyCapital] = useState("");
  const [companyFiscal, setCompanyFiscal] = useState("3月決算");
  const [companyEmail, setCompanyEmail] = useState("");
  const [companyBusiness, setCompanyBusiness] = useState("");
  const [companyTagline, setCompanyTagline] = useState("");
  const [companyEmployees, setCompanyEmployees] = useState("");
  const [companyMainBank, setCompanyMainBank] = useState("");
  const [companyWebsiteUrl, setCompanyWebsiteUrl] = useState("");
  const [companyMapEmbed, setCompanyMapEmbed] = useState("");
  const [representativeNameKana, setRepresentativeNameKana] = useState("");
  const [representativeTitle, setRepresentativeTitle] = useState("代表社員");
  const [representativeMessage, setRepresentativeMessage] = useState("");
  const [representativePhotoUrl, setRepresentativePhotoUrl] = useState("");
  const [representativePhotoFile, setRepresentativePhotoFile] = useState<File | null>(null);

  const fetchData = useCallback(async () => {
    const { data: s } = await supabase.from("stores").select("*"); if (s && s[0]) { setCompanyName(s[0].company_name || ""); setCompanyAddress(s[0].company_address || ""); setCompanyPhone(s[0].company_phone || ""); setInvoiceNumber(s[0].invoice_number || ""); setCompanyStoreId(s[0].id); setCorporateNumber(s[0].corporate_number || ""); setFiscalMonth(s[0].fiscal_month || 3); setRepresentativeName(s[0].representative_name || ""); setEntityType(s[0].entity_type || "llc"); setTaxOffice(s[0].tax_office || ""); setTaxAccountantName(s[0].tax_accountant_name || ""); setTaxAccountantPhone(s[0].tax_accountant_phone || ""); setTaxAccountantAddress(s[0].tax_accountant_address || ""); setLaborConsultantName(s[0].labor_consultant_name || ""); setLaborConsultantPhone(s[0].labor_consultant_phone || ""); setCompanyNameEn(s[0].company_name_en || ""); setCompanyEstablished(s[0].company_established || ""); setCompanyCapital(s[0].company_capital || ""); setCompanyFiscal(s[0].company_fiscal || "3月決算"); setCompanyEmail(s[0].company_email || ""); setCompanyBusiness(s[0].company_business || ""); setCompanyTagline(s[0].company_tagline || ""); setCompanyEmployees(s[0].company_employees || ""); setCompanyMainBank(s[0].company_main_bank || ""); setCompanyWebsiteUrl(s[0].company_website_url || ""); setCompanyMapEmbed(s[0].company_map_embed || ""); setRepresentativeNameKana(s[0].representative_name_kana || ""); setRepresentativeTitle(s[0].representative_title || "代表社員"); setRepresentativeMessage(s[0].representative_message || ""); setRepresentativePhotoUrl(s[0].representative_photo_url || ""); }
  }, []);

  useEffect(() => {
    const check = async () => { const { data: { user } } = await supabase.auth.getUser(); if (!user) router.push("/"); };
    check(); fetchData();
  }, [router, fetchData]);

  // 権限チェック — 社長・経営責任者のみ（資金管理と同じ基準）
  if (!activeStaff) return <div className="h-screen flex items-center justify-center" style={{ backgroundColor: T.bg, color: T.text }}><p className="text-[14px]" style={{ color: T.textMuted }}>読み込み中...</p></div>;
  if (!canAccessCashDashboard) return (
    <div className="h-screen flex flex-col items-center justify-center" style={{ backgroundColor: T.bg, color: T.text }}>
      <div className="text-[48px] mb-4">🔒</div>
      <h2 className="text-[18px] font-medium mb-2">アクセス権限がありません</h2>
      <p className="text-[13px] mb-6" style={{ color: T.textMuted }}>このページは社長・経営責任者のみアクセスできます</p>
      <button onClick={() => router.push("/dashboard")} className="px-6 py-3 bg-gradient-to-r from-[#c3a782] to-[#b09672] text-white text-[12px] rounded-xl cursor-pointer">HOMEに戻る</button>
    </div>
  );

  return (
    <div className="h-screen flex flex-col" style={{ backgroundColor: T.bg, color: T.text }}>
      {ConfirmModalNode}
      {/* Header */}
      <div className="h-[56px] flex items-center justify-between px-4 flex-shrink-0 border-b" style={{ backgroundColor: T.card, borderColor: T.border }}>
        <div className="flex items-center gap-3">
          <NavMenu T={T} dark={dark} />
          <h1 className="text-[14px] font-medium">バックオフィス</h1>
          </div>
        <div className="flex items-center gap-2">
          {[{k:"certificate",l:"📄 証明書発行"},{k:"delivery",l:"📨 書類配信"},{k:"vendors",l:"💼 取引先"},{k:"documents",l:"📋 書類テンプレ"},{k:"company",l:"🏢 会社情報"},{k:"mynumber",l:"🔒 マイナンバー"}].map(t => (
            <button key={t.k} onClick={() => setDashTab(t.k as any)} className="px-3 py-1.5 text-[10px] rounded-lg cursor-pointer" style={{ backgroundColor: dashTab === t.k ? "#c3a78222" : "transparent", color: dashTab === t.k ? "#c3a782" : T.textMuted, fontWeight: dashTab === t.k ? 700 : 400, border: `1px solid ${dashTab === t.k ? "#c3a78244" : T.border}` }}>{t.l}</button>
          ))}
        </div>
        <div className="flex items-center gap-2">
        <span className="px-2 py-0.5 rounded text-[9px] font-medium" style={{ backgroundColor: "#c4555518", color: "#c45555" }}>🔒 社長・経営責任者のみ</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={toggle} className="px-2.5 py-1.5 text-[10px] rounded-lg cursor-pointer border" style={{ borderColor: T.border, color: T.textSub }}>{dark ? "☀️ ライト" : "🌙 ダーク"}</button>
        </div>
      </div>

      {dashTab === "certificate" && (
        <div className="flex-1 overflow-y-auto p-4">
          <CertificateManager T={T} />
        </div>
      )}
      {dashTab === "vendors" && (
        <div className="flex-1 overflow-y-auto p-4">
          <VendorsManager T={T} />
        </div>
      )}
      {dashTab === "documents" && (
        <div className="flex-1 overflow-y-auto p-4">
          <DocumentTemplatesManager T={T} activeStaff={activeStaff} />
        </div>
      )}
      {dashTab === "delivery" && (
        <div className="flex-1 overflow-y-auto p-4">
          <DocumentDeliveryManager T={T} activeStaff={activeStaff} />
        </div>
      )}
      {dashTab === "company" && (
        <div className="flex-1 overflow-y-auto p-4">
          <div className="max-w-[700px] mx-auto space-y-6">
            {/* 法人形態の選択 */}
            <div className="rounded-2xl border p-6" style={{ backgroundColor: T.card, borderColor: T.border }}>
              <h2 className="text-[15px] font-medium mb-3">🏢 事業形態</h2>
              <div className="flex gap-2">
                {([["llc","合同会社"],["corp","株式会社"],["sole","個人事業主"]] as const).map(([k,l]) => (
                  <button key={k} onClick={() => setEntityType(k)} className="flex-1 py-3 rounded-xl text-[12px] cursor-pointer font-medium" style={{ backgroundColor: entityType === k ? "#c3a78222" : T.cardAlt, color: entityType === k ? "#c3a782" : T.textMuted, border: `1px solid ${entityType === k ? "#c3a782" : T.border}` }}>{l}</button>
                ))}
              </div>
            </div>

            {/* 基本情報 */}
            <div className="rounded-2xl border p-6 space-y-4" style={{ backgroundColor: T.card, borderColor: T.border }}>
              <h2 className="text-[15px] font-medium">📋 基本情報</h2>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>{entityType === "sole" ? "屋号" : "会社名"}</label><input type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={{ backgroundColor: T.cardAlt, border: `1px solid ${T.border}`, color: T.text }} /></div>
                <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>{entityType === "sole" ? "事業主名" : "代表者名"}</label><input type="text" value={representativeName} onChange={(e) => setRepresentativeName(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={{ backgroundColor: T.cardAlt, border: `1px solid ${T.border}`, color: T.text }} /></div>
              </div>
              <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>{entityType === "sole" ? "事業所住所" : "本店所在地"}</label><input type="text" value={companyAddress} onChange={(e) => setCompanyAddress(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={{ backgroundColor: T.cardAlt, border: `1px solid ${T.border}`, color: T.text }} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>電話番号</label><input type="text" value={companyPhone} onChange={(e) => setCompanyPhone(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={{ backgroundColor: T.cardAlt, border: `1px solid ${T.border}`, color: T.text }} /></div>
                <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>決算月</label>
                  <select value={fiscalMonth} onChange={(e) => setFiscalMonth(Number(e.target.value))} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none cursor-pointer" style={{ backgroundColor: T.cardAlt, border: `1px solid ${T.border}`, color: T.text }}>
                    {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => <option key={m} value={m}>{m}月</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* 法人番号・インボイス */}
            <div className="rounded-2xl border p-6 space-y-4" style={{ backgroundColor: T.card, borderColor: T.border }}>
              <h2 className="text-[15px] font-medium">🔢 番号・届出</h2>
              {entityType !== "sole" && (
                <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>法人番号（13桁・Tなし）</label><input type="text" value={corporateNumber} onChange={(e) => setCorporateNumber(e.target.value.replace(/[^0-9]/g, "").slice(0, 13))} placeholder="1234567890123" className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={{ backgroundColor: T.cardAlt, border: `1px solid ${T.border}`, color: T.text }} /><p className="text-[9px] mt-1" style={{ color: T.textFaint }}>法人税申告書・届出書に記載。国税庁の法人番号公表サイトで確認できます。</p></div>
              )}
              <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>適格請求書発行事業者番号（インボイス番号）</label><input type="text" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} placeholder="T1234567890123" className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={{ backgroundColor: T.cardAlt, border: `1px solid ${T.border}`, color: T.text }} /><p className="text-[9px] mt-1" style={{ color: T.textFaint }}>{entityType === "sole" ? "Tの後にマイナンバー13桁、または届出番号" : "T + 法人番号13桁"}</p></div>
              <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>管轄税務署</label><input type="text" value={taxOffice} onChange={(e) => setTaxOffice(e.target.value)} placeholder="名古屋中税務署" className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={{ backgroundColor: T.cardAlt, border: `1px solid ${T.border}`, color: T.text }} /></div>
            </div>

            {/* 税理士・社労士 */}
            <div className="rounded-2xl border p-6 space-y-4" style={{ backgroundColor: T.card, borderColor: T.border }}>
              <h2 className="text-[15px] font-medium">👥 顧問の先生</h2>
              <div className="rounded-xl p-4 space-y-3" style={{ backgroundColor: T.cardAlt }}>
                <p className="text-[11px] font-medium" style={{ color: "#85a8c4" }}>📝 税理士</p>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="block text-[9px] mb-1" style={{ color: T.textMuted }}>名前</label><input type="text" value={taxAccountantName} onChange={(e) => setTaxAccountantName(e.target.value)} placeholder="江坂留衣" className="w-full px-3 py-2 rounded-lg text-[12px] outline-none" style={{ backgroundColor: T.card, border: `1px solid ${T.border}`, color: T.text }} /></div>
                  <div><label className="block text-[9px] mb-1" style={{ color: T.textMuted }}>電話番号</label><input type="text" value={taxAccountantPhone} onChange={(e) => setTaxAccountantPhone(e.target.value)} placeholder="0564-83-5731" className="w-full px-3 py-2 rounded-lg text-[12px] outline-none" style={{ backgroundColor: T.card, border: `1px solid ${T.border}`, color: T.text }} /></div>
                </div>
                <div><label className="block text-[9px] mb-1" style={{ color: T.textMuted }}>事務所住所</label><input type="text" value={taxAccountantAddress} onChange={(e) => setTaxAccountantAddress(e.target.value)} placeholder="愛知県岡崎市藤川町一里山南13" className="w-full px-3 py-2 rounded-lg text-[12px] outline-none" style={{ backgroundColor: T.card, border: `1px solid ${T.border}`, color: T.text }} /></div>
              </div>
              <div className="rounded-xl p-4 space-y-3" style={{ backgroundColor: T.cardAlt }}>
                <p className="text-[11px] font-medium" style={{ color: "#22c55e" }}>🏥 社労士</p>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="block text-[9px] mb-1" style={{ color: T.textMuted }}>名前</label><input type="text" value={laborConsultantName} onChange={(e) => setLaborConsultantName(e.target.value)} placeholder="大石さん" className="w-full px-3 py-2 rounded-lg text-[12px] outline-none" style={{ backgroundColor: T.card, border: `1px solid ${T.border}`, color: T.text }} /></div>
                  <div><label className="block text-[9px] mb-1" style={{ color: T.textMuted }}>電話番号</label><input type="text" value={laborConsultantPhone} onChange={(e) => setLaborConsultantPhone(e.target.value)} className="w-full px-3 py-2 rounded-lg text-[12px] outline-none" style={{ backgroundColor: T.card, border: `1px solid ${T.border}`, color: T.text }} /></div>
                </div>
              </div>
            </div>

            {/* 保存ボタン（税務用） */}
            <button onClick={async () => {
              if (!companyStoreId) return;
              let photoUrl = representativePhotoUrl;
              if (representativePhotoFile) {
                try {
                  const ext = representativePhotoFile.name.split('.').pop() || 'jpg';
                  const fileName = `representative_${Date.now()}.${ext}`;
                  const { error: upErr } = await supabase.storage.from("staff-docs").upload(fileName, representativePhotoFile, { contentType: representativePhotoFile.type, upsert: true });
                  if (!upErr) {
                    const { data } = supabase.storage.from("staff-docs").getPublicUrl(fileName);
                    photoUrl = data.publicUrl;
                  }
                } catch (e) { console.error("代表者写真アップロードエラー:", e); }
              }
              await supabase.from("stores").update({
                company_name: companyName.trim(), company_address: companyAddress.trim(), company_phone: companyPhone.trim(), invoice_number: invoiceNumber.trim(), corporate_number: corporateNumber.trim(), fiscal_month: fiscalMonth, representative_name: representativeName.trim(), entity_type: entityType, tax_office: taxOffice.trim(), tax_accountant_name: taxAccountantName.trim(), tax_accountant_phone: taxAccountantPhone.trim(), tax_accountant_address: taxAccountantAddress.trim(), labor_consultant_name: laborConsultantName.trim(), labor_consultant_phone: laborConsultantPhone.trim(),
                // コーポレートサイト用
                company_name_en: companyNameEn.trim(), company_established: companyEstablished.trim(), company_capital: companyCapital.trim(), company_fiscal: companyFiscal.trim(), company_email: companyEmail.trim(), company_business: companyBusiness.trim(), company_tagline: companyTagline.trim(), company_employees: companyEmployees.trim(), company_main_bank: companyMainBank.trim(), company_website_url: companyWebsiteUrl.trim(), company_map_embed: companyMapEmbed.trim(), representative_name_kana: representativeNameKana.trim(), representative_title: representativeTitle.trim(), representative_message: representativeMessage.trim(), representative_photo_url: photoUrl,
              }).eq("id", companyStoreId);
              toast.show("会社情報を保存しました", "success");
              setRepresentativePhotoFile(null);
              fetchData();
            }} className="w-full py-3 bg-gradient-to-r from-[#c3a782] to-[#b09672] text-white text-[12px] rounded-xl cursor-pointer font-medium">💾 保存する</button>

            {/* ══════════ コーポレートサイト用セクション ══════════ */}
            <div className="rounded-2xl border p-5" style={{ backgroundColor: "#2563eb11", borderColor: "#2563eb55" }}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[16px]">🌐</span>
                <h3 className="text-[13px] font-medium" style={{ color: "#60a5fa" }}>コーポレートサイト用設定</h3>
              </div>
              <p className="text-[10px] leading-relaxed" style={{ color: T.textSub }}>
                以下は <a href="/corporate" target="_blank" className="underline" style={{ color: "#60a5fa" }}>コーポレートサイト（/corporate）</a> に反映される情報です。代表挨拶・会社概要・地図などがここから動的表示されます。
              </p>
            </div>

            {/* コーポレート基本情報 */}
            <div className="rounded-2xl border p-6 space-y-4" style={{ backgroundColor: T.card, borderColor: T.border }}>
              <h2 className="text-[15px] font-medium">🌐 コーポレート基本情報</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>会社名（英語）</label>
                  <input type="text" value={companyNameEn} onChange={e => setCompanyNameEn(e.target.value)} placeholder="Terrace Life LLC" className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={{ backgroundColor: T.cardAlt, border: `1px solid ${T.border}`, color: T.text }}/>
                </div>
                <div>
                  <label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>設立</label>
                  <input type="text" value={companyEstablished} onChange={e => setCompanyEstablished(e.target.value)} placeholder="2020年4月" className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={{ backgroundColor: T.cardAlt, border: `1px solid ${T.border}`, color: T.text }}/>
                </div>
                <div>
                  <label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>資本金</label>
                  <input type="text" value={companyCapital} onChange={e => setCompanyCapital(e.target.value)} placeholder="100万円" className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={{ backgroundColor: T.cardAlt, border: `1px solid ${T.border}`, color: T.text }}/>
                </div>
                <div>
                  <label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>決算期（表示用）</label>
                  <input type="text" value={companyFiscal} onChange={e => setCompanyFiscal(e.target.value)} placeholder="3月決算" className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={{ backgroundColor: T.cardAlt, border: `1px solid ${T.border}`, color: T.text }}/>
                </div>
                <div>
                  <label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>従業員数</label>
                  <input type="text" value={companyEmployees} onChange={e => setCompanyEmployees(e.target.value)} placeholder="5名（2025年4月時点）" className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={{ backgroundColor: T.cardAlt, border: `1px solid ${T.border}`, color: T.text }}/>
                </div>
                <div>
                  <label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>メールアドレス</label>
                  <input type="email" value={companyEmail} onChange={e => setCompanyEmail(e.target.value)} placeholder="info@terrace-life.co.jp" className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={{ backgroundColor: T.cardAlt, border: `1px solid ${T.border}`, color: T.text }}/>
                </div>
              </div>
              <div>
                <label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>Webサイト</label>
                <input type="url" value={companyWebsiteUrl} onChange={e => setCompanyWebsiteUrl(e.target.value)} placeholder="https://ange-spa.com" className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={{ backgroundColor: T.cardAlt, border: `1px solid ${T.border}`, color: T.text }}/>
              </div>
              <div>
                <label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>取引銀行</label>
                <input type="text" value={companyMainBank} onChange={e => setCompanyMainBank(e.target.value)} placeholder="◯◯銀行 安城支店" className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={{ backgroundColor: T.cardAlt, border: `1px solid ${T.border}`, color: T.text }}/>
              </div>
              <div>
                <label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>事業内容</label>
                <textarea value={companyBusiness} onChange={e => setCompanyBusiness(e.target.value)} rows={2} placeholder="AIソリューション開発、Webデザイン・システム開発、DX推進支援" className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={{ backgroundColor: T.cardAlt, border: `1px solid ${T.border}`, color: T.text }}/>
              </div>
              <div>
                <label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>キャッチコピー</label>
                <input type="text" value={companyTagline} onChange={e => setCompanyTagline(e.target.value)} placeholder="テクノロジーで、ビジネスの未来をデザインする。" className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={{ backgroundColor: T.cardAlt, border: `1px solid ${T.border}`, color: T.text }}/>
              </div>
            </div>

            {/* 代表者情報 */}
            <div className="rounded-2xl border p-6 space-y-4" style={{ backgroundColor: T.card, borderColor: T.border }}>
              <h2 className="text-[15px] font-medium">👔 代表者情報（HP用）</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* 写真 */}
                <div className="md:col-span-1">
                  <label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>代表者写真</label>
                  <div className="flex flex-col items-center gap-3 p-4 rounded-xl" style={{ backgroundColor: T.cardAlt, border: `1px dashed ${T.border}` }}>
                    {(representativePhotoFile || representativePhotoUrl) ? (
                      <img src={representativePhotoFile ? URL.createObjectURL(representativePhotoFile) : representativePhotoUrl} alt="代表者" className="w-32 h-32 rounded-full object-cover" style={{ border: "3px solid #c3a782" }}/>
                    ) : (
                      <div className="w-32 h-32 rounded-full flex items-center justify-center text-[40px]" style={{ backgroundColor: T.card, border: `2px dashed ${T.border}`, color: T.textFaint }}>👤</div>
                    )}
                    <input type="file" accept="image/*" onChange={e => setRepresentativePhotoFile(e.target.files?.[0] || null)} className="text-[10px]" style={{ color: T.textSub }}/>
                    <p className="text-[9px] text-center" style={{ color: T.textFaint }}>正方形推奨（800×800px）<br/>保存時にアップロード</p>
                  </div>
                </div>
                {/* 代表者情報 */}
                <div className="md:col-span-2 space-y-3">
                  <div>
                    <label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>役職</label>
                    <input type="text" value={representativeTitle} onChange={e => setRepresentativeTitle(e.target.value)} placeholder="代表社員" className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={{ backgroundColor: T.cardAlt, border: `1px solid ${T.border}`, color: T.text }}/>
                  </div>
                  <div>
                    <label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>氏名カナ</label>
                    <input type="text" value={representativeNameKana} onChange={e => setRepresentativeNameKana(e.target.value)} placeholder="やまだ たろう" className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={{ backgroundColor: T.cardAlt, border: `1px solid ${T.border}`, color: T.text }}/>
                  </div>
                  <p className="text-[10px]" style={{ color: T.textFaint }}>※ 氏名は上の「基本情報」の代表者名が使用されます</p>
                </div>
              </div>
              <div>
                <label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>代表挨拶文</label>
                <textarea value={representativeMessage} onChange={e => setRepresentativeMessage(e.target.value)} rows={8} placeholder="テラスライフは「現場で役立つテクノロジー」を信条に..." className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={{ backgroundColor: T.cardAlt, border: `1px solid ${T.border}`, color: T.text }}/>
                <p className="text-[9px] mt-1" style={{ color: T.textFaint }}>改行も反映されます。200〜400字程度が適切です。</p>
              </div>
            </div>

            {/* Googleマップ */}
            <div className="rounded-2xl border p-6 space-y-4" style={{ backgroundColor: T.card, borderColor: T.border }}>
              <h2 className="text-[15px] font-medium">📍 Googleマップ埋込</h2>
              <div>
                <label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>Googleマップ埋込URL</label>
                <textarea value={companyMapEmbed} onChange={e => setCompanyMapEmbed(e.target.value)} rows={3} placeholder="https://www.google.com/maps/embed?pb=..." className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={{ backgroundColor: T.cardAlt, border: `1px solid ${T.border}`, color: T.text }}/>
                <div className="mt-2 p-3 rounded-xl text-[10px] leading-relaxed" style={{ backgroundColor: T.cardAlt, color: T.textSub }}>
                  <strong>埋込URL取得方法:</strong><br/>
                  1. <a href="https://www.google.com/maps" target="_blank" className="underline" style={{ color: "#c3a782" }}>Googleマップ</a>で所在地を検索<br/>
                  2. 「共有」→「地図を埋め込む」→「HTMLをコピー」<br/>
                  3. コピーしたHTMLの <code>src=&quot;...&quot;</code> の中身（https://〜 で始まる部分）だけを貼り付け
                </div>
              </div>
              {companyMapEmbed && (
                <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${T.border}` }}>
                  <div style={{ position: "relative", paddingBottom: "50%", height: 0 }}>
                    <iframe src={companyMapEmbed} style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: 0 }} loading="lazy" title="プレビュー"/>
                  </div>
                </div>
              )}
            </div>

            {/* もう一度保存ボタン（コーポレート設定直下） */}
            <button onClick={async () => {
              if (!companyStoreId) return;
              let photoUrl = representativePhotoUrl;
              if (representativePhotoFile) {
                try {
                  const ext = representativePhotoFile.name.split('.').pop() || 'jpg';
                  const fileName = `representative_${Date.now()}.${ext}`;
                  const { error: upErr } = await supabase.storage.from("staff-docs").upload(fileName, representativePhotoFile, { contentType: representativePhotoFile.type, upsert: true });
                  if (!upErr) {
                    const { data } = supabase.storage.from("staff-docs").getPublicUrl(fileName);
                    photoUrl = data.publicUrl;
                  }
                } catch (e) { console.error("代表者写真アップロードエラー:", e); }
              }
              await supabase.from("stores").update({
                company_name: companyName.trim(), company_address: companyAddress.trim(), company_phone: companyPhone.trim(), invoice_number: invoiceNumber.trim(), corporate_number: corporateNumber.trim(), fiscal_month: fiscalMonth, representative_name: representativeName.trim(), entity_type: entityType, tax_office: taxOffice.trim(), tax_accountant_name: taxAccountantName.trim(), tax_accountant_phone: taxAccountantPhone.trim(), tax_accountant_address: taxAccountantAddress.trim(), labor_consultant_name: laborConsultantName.trim(), labor_consultant_phone: laborConsultantPhone.trim(),
                company_name_en: companyNameEn.trim(), company_established: companyEstablished.trim(), company_capital: companyCapital.trim(), company_fiscal: companyFiscal.trim(), company_email: companyEmail.trim(), company_business: companyBusiness.trim(), company_tagline: companyTagline.trim(), company_employees: companyEmployees.trim(), company_main_bank: companyMainBank.trim(), company_website_url: companyWebsiteUrl.trim(), company_map_embed: companyMapEmbed.trim(), representative_name_kana: representativeNameKana.trim(), representative_title: representativeTitle.trim(), representative_message: representativeMessage.trim(), representative_photo_url: photoUrl,
              }).eq("id", companyStoreId);
              toast.show("会社情報を保存しました", "success");
              setRepresentativePhotoFile(null);
              fetchData();
            }} className="w-full py-3 bg-gradient-to-r from-[#2563eb] to-[#06b6d4] text-white text-[12px] rounded-xl cursor-pointer font-medium">🌐 コーポレート情報を含めて保存</button>

            {/* 利用先の説明 */}
            <div className="rounded-2xl border p-5" style={{ backgroundColor: T.card, borderColor: T.border }}>
              <h3 className="text-[13px] font-medium mb-3" style={{ color: T.text }}>📋 この情報が使われる場所</h3>
              <div className="space-y-2 text-[11px]" style={{ color: T.textSub }}>
                <div className="flex items-start gap-2"><span style={{ color: "#c3a782" }}>📑</span><span>セラピスト・スタッフの<strong>支払調書PDF</strong>の支払者欄</span></div>
                <div className="flex items-start gap-2"><span style={{ color: "#c3a782" }}>💰</span><span><strong>源泉徴収納付集計表</strong>の事業者情報</span></div>
                <div className="flex items-start gap-2"><span style={{ color: "#c3a782" }}>🧾</span><span>セラピストへの<strong>日次清算の支払通知書</strong></span></div>
                <div className="flex items-start gap-2"><span style={{ color: "#c3a782" }}>📆</span><span><strong>税理士ポータルの年間スケジュール</strong>の決算月・顧問連絡先</span></div>
                <div className="flex items-start gap-2"><span style={{ color: "#c3a782" }}>📊</span><span>税理士さんへの<strong>各種報告書類</strong></span></div>
              </div>
            </div>
          </div>
        </div>
      )}
      {dashTab === "mynumber" && (
        <div className="flex-1 overflow-y-auto p-4">
          <MyNumberManager T={T} />
        </div>
      )}
      <style jsx global>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  );
}

function MyNumberManager({ T }: { T: any }) {
  const { activeStaff } = useStaffSession();
  const toast = useToast();
  const { confirm, ConfirmModalNode } = useConfirm();
  const staffName = activeStaff?.name || "不明";
  const [therapists, setTherapists] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [saving, setSaving] = useState<number | null>(null);
  const [bulkSaving, setBulkSaving] = useState<string>("");
  const [saveMethod, setSaveMethod] = useState<"zip" | "folder">("zip");
  const [showLogs, setShowLogs] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);
  const folderHandleRef = useRef<any>(null);

  const fetchTherapists = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("therapists").select("id, name, real_name, entry_date, mynumber, mynumber_photo_url, mynumber_photo_url_back, status, mynumber_downloaded_at, mynumber_downloaded_by").order("sort_order");
    if (data) setTherapists(data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchTherapists(); }, [fetchTherapists]);

  const submitted = therapists.filter(t => t.mynumber || t.mynumber_photo_url);
  const notSubmitted = therapists.filter(t => !t.mynumber && !t.mynumber_photo_url && t.status === "active");
  const daysSince = (iso: string | null) => iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 86400000) : Infinity;
  const needsDL = submitted.filter(t => !t.mynumber_downloaded_at || daysSince(t.mynumber_downloaded_at) >= 30);

  // ====== ログ記録 ======
  const logAction = async (params: { action: string; therapistId?: number | null; targetNames?: string; targetCount?: number; method?: string; note?: string }) => {
    await supabase.from("mynumber_access_logs").insert({
      action: params.action,
      therapist_id: params.therapistId ?? null,
      target_names: params.targetNames || "",
      target_count: params.targetCount ?? 1,
      save_method: params.method || "",
      staff_name: staffName,
      note: params.note || "",
    });
  };

  // ====== ヘルパー ======
  const today = () => new Date().toISOString().split("T")[0].replace(/-/g, "");
  const escapeHTML = (s: string) => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] || c));
  const safeName = (s: string) => s.replace(/[\\/:*?"<>|]/g, "_").replace(/\s+/g, "_");

  const fetchImageBlob = async (url: string): Promise<{ blob: Blob; ext: string } | null> => {
    if (!url) return null;
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) return null;
      const blob = await res.blob();
      let ext = "jpg";
      const u = url.split("?")[0].toLowerCase();
      const m = u.match(/\.(jpg|jpeg|png|gif|webp|heic)$/);
      if (m) ext = m[1] === "jpeg" ? "jpg" : m[1];
      else if (blob.type === "image/png") ext = "png";
      else if (blob.type === "image/webp") ext = "webp";
      return { blob, ext };
    } catch {
      return null;
    }
  };

  const buildLedgerHTML = (t: any, frontFile: string | null, backFile: string | null): string => {
    return `<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8"><title>マイナンバー管理台帳_${escapeHTML(t.real_name || t.name)}</title>
<style>body{font-family:'Hiragino Sans','Yu Gothic','Meiryo',sans-serif;max-width:720px;margin:40px auto;padding:30px;color:#333}h1{text-align:center;font-size:20px;border-bottom:3px double #333;padding-bottom:10px;margin-bottom:25px}table{width:100%;border-collapse:collapse;margin:15px 0}td,th{border:1px solid #ccc;padding:10px 14px;font-size:13px}th{background:#f5f0e8;text-align:left;width:35%}.photos{display:flex;gap:20px;margin:25px 0}.photo-box{flex:1;text-align:center}.photo-box img{max-width:100%;max-height:400px;border:1px solid #ddd;border-radius:8px}.photo-label{font-size:11px;color:#888;margin-bottom:8px}.meta{font-size:10px;color:#888;margin-top:20px;padding-top:15px;border-top:1px solid #eee}.note{font-size:10px;color:#c45555;margin-top:15px;padding:12px;background:#fff5f5;border:1px solid #fecaca;border-radius:8px;line-height:1.7}@media print{body{margin:0;padding:15px}}</style>
</head><body>
<h1>マイナンバー管理台帳</h1>
<table>
<tr><th>源氏名</th><td>${escapeHTML(t.name)}</td></tr>
<tr><th>本名</th><td>${escapeHTML(t.real_name || "未登録")}</td></tr>
<tr><th>入店日</th><td>${t.entry_date || "未登録"}</td></tr>
<tr><th>個人番号</th><td style="font-family:monospace;font-size:16px;letter-spacing:3px">${escapeHTML(t.mynumber || "未登録（写真のみ）")}</td></tr>
</table>
<div class="photos">
${frontFile ? `<div class="photo-box"><p class="photo-label">表面</p><img src="${frontFile}" /></div>` : '<div class="photo-box"><p class="photo-label">表面</p><p style="color:#c45555;padding:60px">未アップロード</p></div>'}
${backFile ? `<div class="photo-box"><p class="photo-label">裏面</p><img src="${backFile}" /></div>` : '<div class="photo-box"><p class="photo-label">裏面</p><p style="color:#c45555;padding:60px">未アップロード</p></div>'}
</div>
<div class="meta">出力日時: ${new Date().toLocaleString("ja-JP")} ／ 出力担当: ${escapeHTML(staffName)}</div>
<div class="note">⚠️ この書類は番号法（行政手続における特定の個人を識別するための番号の利用等に関する法律）に基づき厳重に管理してください。目的外の利用、第三者への開示は固く禁じられています。不要になった場合は速やかに物理的破棄または完全消去してください。</div>
</body></html>`;
  };

  const buildFilesForTherapist = async (t: any): Promise<{ name: string; blob: Blob }[]> => {
    const files: { name: string; blob: Blob }[] = [];
    let frontName: string | null = null;
    let backName: string | null = null;
    if (t.mynumber_photo_url) {
      const f = await fetchImageBlob(t.mynumber_photo_url);
      if (f) { frontName = `表面.${f.ext}`; files.push({ name: frontName, blob: f.blob }); }
    }
    if (t.mynumber_photo_url_back) {
      const b = await fetchImageBlob(t.mynumber_photo_url_back);
      if (b) { backName = `裏面.${b.ext}`; files.push({ name: backName, blob: b.blob }); }
    }
    const html = buildLedgerHTML(t, frontName, backName);
    files.push({ name: "管理台帳.html", blob: new Blob([html], { type: "text/html;charset=utf-8" }) });
    return files;
  };

  const triggerDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
  };

  // ====== Directory Picker ======
  const pickOrReuseDirectory = async (): Promise<any> => {
    // @ts-ignore
    if (typeof window.showDirectoryPicker !== "function") {
      throw new Error("このブラウザはフォルダ保存に対応していません。「ZIP」方式を選んでください（Chrome/Edgeの最新版が必要です）");
    }
    if (folderHandleRef.current) {
      try {
        const perm = await folderHandleRef.current.queryPermission?.({ mode: "readwrite" });
        if (perm === "granted") return folderHandleRef.current;
        const req = await folderHandleRef.current.requestPermission?.({ mode: "readwrite" });
        if (req === "granted") return folderHandleRef.current;
      } catch { /* fallthrough */ }
    }
    // @ts-ignore
    const h = await window.showDirectoryPicker({ mode: "readwrite" });
    folderHandleRef.current = h;
    return h;
  };

  const writeFilesToDir = async (dirHandle: any, files: { name: string; blob: Blob }[]) => {
    for (const f of files) {
      const fh = await dirHandle.getFileHandle(f.name, { create: true });
      const w = await fh.createWritable();
      await w.write(f.blob);
      await w.close();
    }
  };

  // ====== 個別保存 ======
  const downloadOne = async (t: any) => {
    if (saving || bulkSaving) return;
    setSaving(t.id);
    try {
      const files = await buildFilesForTherapist(t);
      if (files.length <= 1) { toast.show("ダウンロードできる画像がありません", "error"); setSaving(null); return; }
      const baseName = `マイナンバー_${safeName(t.real_name || t.name)}_${today()}`;

      if (saveMethod === "folder") {
        const parent = await pickOrReuseDirectory();
        const dir = await parent.getDirectoryHandle(baseName, { create: true });
        await writeFilesToDir(dir, files);
      } else {
        const zip = new JSZip();
        const folder = zip.folder(baseName)!;
        for (const f of files) folder.file(f.name, f.blob);
        const zipBlob = await zip.generateAsync({ type: "blob" });
        triggerDownload(zipBlob, `${baseName}.zip`);
      }

      const now = new Date().toISOString();
      await supabase.from("therapists").update({ mynumber_downloaded_at: now, mynumber_downloaded_by: staffName }).eq("id", t.id);
      await logAction({ action: "download", therapistId: t.id, targetNames: t.real_name || t.name, method: saveMethod });
      toast.show(`${t.name} のマイナンバーを保存しました`, "success");
      fetchTherapists();
    } catch (err: any) {
      if (err?.name === "AbortError") return;
      console.error(err);
      toast.show(`保存に失敗: ${err?.message || err}`, "error");
    } finally {
      setSaving(null);
    }
  };

  // ====== 一括保存 ======
  const bulkDownload = async (targets: any[], label: string) => {
    if (saving || bulkSaving || targets.length === 0) return;
    const ok = await confirm({
      title: `${targets.length}名分のマイナンバーを保存しますか？`,
      message: `保存先: ${saveMethod === "folder" ? "指定フォルダ" : "ZIPファイル"}\n対象: ${targets.map(t => t.name).slice(0, 5).join("、")}${targets.length > 5 ? ` ほか${targets.length - 5}名` : ""}\n\n⚠️ 番号法遵守のため、保存後は暗号化USB等の安全な場所で管理してください。`,
      variant: "warning",
      confirmLabel: "保存する",
      icon: "🔢",
    });
    if (!ok) return;
    setBulkSaving(label);
    try {
      const rootName = `マイナンバー_${label}_${today()}_${safeName(staffName)}`;
      const csvHeader = "源氏名,本名,入店日,個人番号,表面写真,裏面写真,出力日時,出力担当\n";
      const csvRows = targets.map(t => `"${t.name}","${t.real_name || ""}","${t.entry_date || ""}","${t.mynumber ? "登録済" : "未登録"}","${t.mynumber_photo_url ? "あり" : "なし"}","${t.mynumber_photo_url_back ? "あり" : "なし"}","${new Date().toLocaleString("ja-JP")}","${staffName}"`).join("\n");
      const csv = "\uFEFF" + csvHeader + csvRows;

      if (saveMethod === "folder") {
        const parent = await pickOrReuseDirectory();
        const rootDir = await parent.getDirectoryHandle(rootName, { create: true });
        let idx = 0;
        for (const t of targets) {
          idx++;
          const sub = `${String(idx).padStart(2, "0")}_${safeName(t.real_name || t.name)}_${t.id}`;
          const subDir = await rootDir.getDirectoryHandle(sub, { create: true });
          const files = await buildFilesForTherapist(t);
          await writeFilesToDir(subDir, files);
        }
        const csvHandle = await rootDir.getFileHandle("_DL履歴.csv", { create: true });
        const w = await csvHandle.createWritable();
        await w.write(new Blob([csv], { type: "text/csv;charset=utf-8" }));
        await w.close();
      } else {
        const zip = new JSZip();
        const root = zip.folder(rootName)!;
        let idx = 0;
        for (const t of targets) {
          idx++;
          const sub = `${String(idx).padStart(2, "0")}_${safeName(t.real_name || t.name)}_${t.id}`;
          const subFolder = root.folder(sub)!;
          const files = await buildFilesForTherapist(t);
          for (const f of files) subFolder.file(f.name, f.blob);
        }
        root.file("_DL履歴.csv", csv);
        const blob = await zip.generateAsync({ type: "blob" });
        triggerDownload(blob, `${rootName}.zip`);
      }

      const now = new Date().toISOString();
      await supabase.from("therapists").update({ mynumber_downloaded_at: now, mynumber_downloaded_by: staffName }).in("id", targets.map(t => t.id));
      await logAction({
        action: "bulk_download",
        targetNames: targets.map(t => t.real_name || t.name).join("、"),
        targetCount: targets.length,
        method: saveMethod,
        note: label,
      });
      toast.show(`${targets.length}名分を一括保存しました`, "success");
      fetchTherapists();
    } catch (err: any) {
      if (err?.name === "AbortError") return;
      console.error(err);
      toast.show(`一括保存に失敗: ${err?.message || err}`, "error");
    } finally {
      setBulkSaving("");
    }
  };

  // ====== 既存: PDF表示（印刷プレビュー） ======
  const openPDF = async (t: any) => {
    const w = window.open("", "_blank"); if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>マイナンバー_${escapeHTML(t.real_name || t.name)}</title>
<style>body{font-family:'Hiragino Sans','Yu Gothic','Meiryo',sans-serif;max-width:700px;margin:40px auto;padding:30px;color:#333}h1{text-align:center;font-size:18px;border-bottom:2px solid #333;padding-bottom:8px;margin-bottom:20px}table{width:100%;border-collapse:collapse;margin:15px 0}td,th{border:1px solid #ccc;padding:10px 14px;font-size:13px}th{background:#f5f0e8;text-align:left;width:35%}.photos{display:flex;gap:20px;margin:20px 0}.photo-box{flex:1;text-align:center}.photo-box img{max-width:100%;max-height:300px;border:1px solid #ddd;border-radius:8px}.photo-label{font-size:11px;color:#888;margin-bottom:5px}.note{font-size:10px;color:#c45555;margin-top:20px;padding:10px;background:#fff5f5;border:1px solid #fecaca;border-radius:8px}@media print{body{margin:0;padding:15px}.note{break-inside:avoid}}</style></head><body>
<h1>マイナンバー管理台帳</h1>
<table>
<tr><th>源氏名</th><td>${escapeHTML(t.name)}</td></tr>
<tr><th>本名</th><td>${escapeHTML(t.real_name || "未登録")}</td></tr>
<tr><th>入店日</th><td>${t.entry_date || "未登録"}</td></tr>
<tr><th>個人番号</th><td style="font-family:monospace;font-size:16px;letter-spacing:2px">${escapeHTML(t.mynumber || "未登録")}</td></tr>
</table>
<div class="photos">
${t.mynumber_photo_url ? `<div class="photo-box"><p class="photo-label">表面</p><img src="${t.mynumber_photo_url}" /></div>` : '<div class="photo-box"><p class="photo-label">表面</p><p style="color:#c45555;padding:40px">未アップロード</p></div>'}
${t.mynumber_photo_url_back ? `<div class="photo-box"><p class="photo-label">裏面</p><img src="${t.mynumber_photo_url_back}" /></div>` : '<div class="photo-box"><p class="photo-label">裏面</p><p style="color:#c45555;padding:40px">未アップロード</p></div>'}
</div>
<div class="note">⚠️ この書類はマイナンバー法に基づき厳重に管理してください。目的外利用は禁止されています。不要になった場合は速やかに破棄してください。</div>
</body></html>`);
    w.document.close();
    await logAction({ action: "view", therapistId: t.id, targetNames: t.real_name || t.name });
  };

  // ====== 既存: クラウドから削除 ======
  const deleteFromCloud = async (t: any) => {
    const ok = await confirm({
      title: `${t.name} のマイナンバーデータをクラウドから削除しますか？`,
      message: "削除されるもの:\n• 個人番号（数字）\n• カード写真（表面・裏面）\n\n⚠️ 事前にローカルに保存しておくことを強く推奨します。",
      variant: "danger",
      confirmLabel: "クラウドから削除",
      icon: "🗑️",
    });
    if (!ok) return;
    setDeleting(t.id);
    const updates: any = { mynumber: "", mynumber_photo_url: "", mynumber_photo_url_back: "" };
    try {
      await supabase.storage.from("therapist-photos").remove([`therapist_mynumber_${t.id}.jpg`, `therapist_mynumber_${t.id}.png`, `therapist_mynumber_${t.id}.jpeg`, `therapist_mynumber_back_${t.id}.jpg`, `therapist_mynumber_back_${t.id}.png`, `therapist_mynumber_back_${t.id}.jpeg`]);
    } catch { /* ファイルが存在しない場合は無視 */ }
    await supabase.from("therapists").update(updates).eq("id", t.id);
    await logAction({ action: "delete", therapistId: t.id, targetNames: t.real_name || t.name });
    setTherapists(prev => prev.map(p => p.id === t.id ? { ...p, ...updates } : p));
    setDeleting(null);
    toast.show(`${t.name} のマイナンバーをクラウドから削除しました`, "success");
  };

  // ====== ログ閲覧 ======
  const loadLogs = async () => {
    const { data } = await supabase.from("mynumber_access_logs").select("*").order("created_at", { ascending: false }).limit(500);
    if (data) setLogs(data);
    setShowLogs(true);
  };
  const actionLabel: Record<string, string> = { download: "📥 個別保存", bulk_download: "📦 一括保存", view: "👁 表示", delete: "🗑 クラウド削除" };

  return (
    <div className="max-w-[960px] mx-auto">
      {ConfirmModalNode}
      {/* 注意事項 */}
      <div className="rounded-xl p-4 mb-4" style={{ backgroundColor: "#c4555512", border: "1px solid #c4555533" }}>
        <p className="text-[11px] font-medium" style={{ color: "#c45555" }}>🔒 マイナンバー管理について（番号法遵守）</p>
        <p className="text-[10px] mt-1" style={{ color: T.textSub }}>マイナンバーは番号法で厳格な管理が義務付けられています。<strong>必ずローカル保存</strong>して安全な場所で保管し、<strong>クラウドからは速やかに削除</strong>してください。全ての保存・閲覧・削除操作は自動的に記録されます。</p>
      </div>

      {/* サマリーカード */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        <div className="rounded-2xl border p-4 text-center" style={{ backgroundColor: T.card, borderColor: T.border }}>
          <p className="text-[10px] mb-1" style={{ color: T.textMuted }}>提出済</p>
          <p className="text-[22px] font-light" style={{ color: "#22c55e" }}>{submitted.length}</p>
        </div>
        <div className="rounded-2xl border p-4 text-center" style={{ backgroundColor: T.card, borderColor: T.border }}>
          <p className="text-[10px] mb-1" style={{ color: T.textMuted }}>未提出</p>
          <p className="text-[22px] font-light" style={{ color: notSubmitted.length > 0 ? "#f59e0b" : T.textFaint }}>{notSubmitted.length}</p>
        </div>
        <div className="rounded-2xl border p-4 text-center" style={{ backgroundColor: T.card, borderColor: T.border }}>
          <p className="text-[10px] mb-1" style={{ color: T.textMuted }}>要DL（未DL/30日超）</p>
          <p className="text-[22px] font-light" style={{ color: needsDL.length > 0 ? "#c45555" : "#22c55e" }}>{needsDL.length}</p>
        </div>
        <div className="rounded-2xl border p-4 text-center" style={{ backgroundColor: T.card, borderColor: T.border }}>
          <p className="text-[10px] mb-1" style={{ color: T.textMuted }}>稼働中セラピスト</p>
          <p className="text-[22px] font-light" style={{ color: T.text }}>{therapists.filter(t => t.status === "active").length}</p>
        </div>
      </div>

      {/* 保存方式選択 + ログボタン */}
      <div className="rounded-2xl border p-4 mb-5" style={{ backgroundColor: T.card, borderColor: T.border }}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-medium" style={{ color: T.textSub }}>💾 保存方式:</span>
            <label className="flex items-center gap-1.5 cursor-pointer text-[11px]" style={{ color: saveMethod === "zip" ? "#c3a782" : T.textMuted }}>
              <input type="radio" name="saveMethod" value="zip" checked={saveMethod === "zip"} onChange={() => setSaveMethod("zip")} className="cursor-pointer accent-[#c3a782]" />
              <span className="font-medium">📦 ZIPで保存</span>
              <span className="text-[9px]" style={{ color: T.textFaint }}>（ダウンロードフォルダに保存）</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer text-[11px]" style={{ color: saveMethod === "folder" ? "#c3a782" : T.textMuted }}>
              <input type="radio" name="saveMethod" value="folder" checked={saveMethod === "folder"} onChange={() => setSaveMethod("folder")} className="cursor-pointer accent-[#c3a782]" />
              <span className="font-medium">📁 フォルダ指定</span>
              <span className="text-[9px]" style={{ color: T.textFaint }}>（保存先フォルダを毎回選択）</span>
            </label>
          </div>
          <button onClick={loadLogs} className="px-3 py-1.5 text-[10px] rounded-lg cursor-pointer" style={{ backgroundColor: "#85a8c418", color: "#85a8c4", border: "1px solid #85a8c433" }}>📋 操作履歴を見る</button>
        </div>
        {saveMethod === "folder" && (
          <p className="text-[9px] mt-2 px-2" style={{ color: T.textFaint }}>※ Chrome / Edge の最新版でのみ対応。初回のみ保存先を選択、以降は同じフォルダに書き込みます。</p>
        )}
      </div>

      {/* 一括保存ボタン */}
      {submitted.length > 0 && (
        <div className="grid grid-cols-2 gap-3 mb-5">
          <button disabled={!!bulkSaving || !!saving || needsDL.length === 0} onClick={() => bulkDownload(needsDL, "未DL")} className="py-3 rounded-xl text-[11px] cursor-pointer font-medium text-white disabled:opacity-40" style={{ backgroundColor: "#c45555" }}>
            {bulkSaving === "未DL" ? "保存中..." : `📦 未DL・30日超を一括保存（${needsDL.length}名）`}
          </button>
          <button disabled={!!bulkSaving || !!saving} onClick={() => bulkDownload(submitted, "全員")} className="py-3 rounded-xl text-[11px] cursor-pointer font-medium text-white disabled:opacity-40" style={{ backgroundColor: "#c3a782" }}>
            {bulkSaving === "全員" ? "保存中..." : `📦 提出済み全員を一括保存（${submitted.length}名）`}
          </button>
        </div>
      )}

      {loading ? <p className="text-center py-12 text-[12px]" style={{ color: T.textFaint }}>読み込み中...</p> : (<>
        {/* 提出済み */}
        {submitted.length > 0 && (
          <div className="rounded-2xl border overflow-hidden mb-6" style={{ backgroundColor: T.card, borderColor: T.border }}>
            <div className="px-5 py-3" style={{ borderBottom: `1px solid ${T.border}` }}>
              <h2 className="text-[13px] font-medium">✅ 提出済み（{submitted.length}名）</h2>
            </div>
            {submitted.map(t => {
              const d = daysSince(t.mynumber_downloaded_at);
              const isOld = !t.mynumber_downloaded_at || d >= 30;
              return (
                <div key={t.id} className="flex items-center justify-between px-5 py-3 gap-3 flex-wrap" style={{ borderBottom: `1px solid ${T.border}` }}>
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-[12px] font-medium">{t.name}</span>
                    {t.real_name && <span className="text-[10px]" style={{ color: T.textMuted }}>（{t.real_name}）</span>}
                    <div className="flex gap-1">
                      {t.mynumber && <span className="text-[8px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "#22c55e18", color: "#22c55e" }}>番号✓</span>}
                      {t.mynumber_photo_url && <span className="text-[8px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "#85a8c418", color: "#85a8c4" }}>表面✓</span>}
                      {t.mynumber_photo_url_back && <span className="text-[8px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "#85a8c418", color: "#85a8c4" }}>裏面✓</span>}
                    </div>
                    {t.mynumber_downloaded_at ? (
                      <span className="text-[9px]" style={{ color: isOld ? "#c45555" : T.textMuted }}>
                        📥 最終DL: {new Date(t.mynumber_downloaded_at).toLocaleDateString("ja-JP")}（{t.mynumber_downloaded_by || "不明"}）{isOld && ` ・${d}日前`}
                      </span>
                    ) : (
                      <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "#c4555518", color: "#c45555" }}>🆕 未DL</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => openPDF(t)} className="px-3 py-1.5 text-[9px] rounded-lg cursor-pointer" style={{ backgroundColor: "#85a8c418", color: "#85a8c4", border: "1px solid #85a8c433" }}>👁 表示</button>
                    <button onClick={() => downloadOne(t)} disabled={saving === t.id || !!bulkSaving} className="px-3 py-1.5 text-[9px] rounded-lg cursor-pointer disabled:opacity-40" style={{ backgroundColor: "#c3a78218", color: "#c3a782", border: "1px solid #c3a78233" }}>{saving === t.id ? "保存中..." : "📥 ローカル保存"}</button>
                    <button onClick={() => deleteFromCloud(t)} disabled={deleting === t.id} className="px-3 py-1.5 text-[9px] rounded-lg cursor-pointer disabled:opacity-40" style={{ backgroundColor: "#c4555518", color: "#c45555", border: "1px solid #c4555533" }}>{deleting === t.id ? "削除中..." : "🗑 クラウド削除"}</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 未提出 */}
        {notSubmitted.length > 0 && (
          <div className="rounded-2xl border overflow-hidden mb-6" style={{ backgroundColor: T.card, borderColor: T.border }}>
            <div className="px-5 py-3" style={{ borderBottom: `1px solid ${T.border}` }}>
              <h2 className="text-[13px] font-medium" style={{ color: "#f59e0b" }}>⚠️ 未提出（{notSubmitted.length}名）</h2>
            </div>
            {notSubmitted.map(t => (
              <div key={t.id} className="flex items-center justify-between px-5 py-3" style={{ borderBottom: `1px solid ${T.border}` }}>
                <div className="flex items-center gap-3">
                  <span className="text-[12px] font-medium">{t.name}</span>
                  {t.real_name && <span className="text-[10px]" style={{ color: T.textMuted }}>（{t.real_name}）</span>}
                </div>
                <span className="text-[9px]" style={{ color: "#f59e0b" }}>セラピスト管理からアップロードしてください</span>
              </div>
            ))}
          </div>
        )}

        {submitted.length === 0 && notSubmitted.length === 0 && (
          <p className="text-center py-12 text-[12px]" style={{ color: T.textFaint }}>セラピストデータがありません</p>
        )}

        {/* 運用ガイド */}
        <div className="rounded-2xl border p-5" style={{ backgroundColor: T.card, borderColor: T.border }}>
          <h3 className="text-[13px] font-medium mb-3" style={{ color: T.text }}>📋 マイナンバー管理の流れ（番号法遵守）</h3>
          <div className="space-y-2 text-[10px]" style={{ color: T.textSub }}>
            <div className="flex items-start gap-2"><span className="flex-shrink-0" style={{ color: "#c3a782" }}>①</span><span>セラピストからLINE等でマイナンバーカードの写真（表面・裏面）をもらう</span></div>
            <div className="flex items-start gap-2"><span className="flex-shrink-0" style={{ color: "#c3a782" }}>②</span><span><strong>セラピスト管理</strong>ページで各セラピストの編集画面からアップロード</span></div>
            <div className="flex items-start gap-2"><span className="flex-shrink-0" style={{ color: "#c3a782" }}>③</span><span>このページで<strong>「📥 ローカル保存」</strong>→ 暗号化USBや業務PC内の安全なフォルダに保管</span></div>
            <div className="flex items-start gap-2"><span className="flex-shrink-0" style={{ color: "#c3a782" }}>④</span><span>保存確認できたら<strong>「🗑 クラウド削除」</strong>で T-MANAGE 上のデータを速やかに消去</span></div>
            <div className="flex items-start gap-2"><span className="flex-shrink-0" style={{ color: "#c3a782" }}>⑤</span><span>退職・不要時はローカル側も<strong>物理的破棄または完全消去</strong>（番号法 第20条）</span></div>
          </div>
        </div>
      </>)}

      {/* 操作履歴モーダル */}
      {showLogs && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowLogs(false)}>
          <div className="rounded-2xl border p-5 w-full max-w-[760px] max-h-[85vh] overflow-y-auto" style={{ backgroundColor: T.card, borderColor: T.border }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[14px] font-medium">📋 操作履歴（直近500件）</h2>
              <button onClick={() => setShowLogs(false)} className="px-3 py-1.5 text-[10px] rounded-lg cursor-pointer border" style={{ borderColor: T.border, color: T.textSub }}>閉じる</button>
            </div>
            {logs.length === 0 ? (
              <p className="text-center py-10 text-[11px]" style={{ color: T.textFaint }}>履歴がありません</p>
            ) : (
              <div className="rounded-xl border overflow-hidden" style={{ borderColor: T.border }}>
                <table className="w-full text-[10px]" style={{ borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ backgroundColor: T.cardAlt }}>
                      <th className="text-left p-2" style={{ color: T.textSub, borderBottom: `1px solid ${T.border}` }}>日時</th>
                      <th className="text-left p-2" style={{ color: T.textSub, borderBottom: `1px solid ${T.border}` }}>操作</th>
                      <th className="text-left p-2" style={{ color: T.textSub, borderBottom: `1px solid ${T.border}` }}>担当</th>
                      <th className="text-left p-2" style={{ color: T.textSub, borderBottom: `1px solid ${T.border}` }}>対象</th>
                      <th className="text-left p-2" style={{ color: T.textSub, borderBottom: `1px solid ${T.border}` }}>方式</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map(l => (
                      <tr key={l.id}>
                        <td className="p-2" style={{ color: T.text, borderBottom: `1px solid ${T.border}`, whiteSpace: "nowrap" }}>{new Date(l.created_at).toLocaleString("ja-JP")}</td>
                        <td className="p-2" style={{ color: T.text, borderBottom: `1px solid ${T.border}`, whiteSpace: "nowrap" }}>{actionLabel[l.action] || l.action}</td>
                        <td className="p-2" style={{ color: T.text, borderBottom: `1px solid ${T.border}`, whiteSpace: "nowrap" }}>{l.staff_name || "不明"}</td>
                        <td className="p-2" style={{ color: T.text, borderBottom: `1px solid ${T.border}` }}>
                          {l.action === "bulk_download" ? (
                            <span>{l.target_count}名（{l.note}）<span className="block text-[8px]" style={{ color: T.textFaint }}>{l.target_names}</span></span>
                          ) : (l.target_names || "-")}
                        </td>
                        <td className="p-2" style={{ color: T.text, borderBottom: `1px solid ${T.border}` }}>{l.save_method === "zip" ? "ZIP" : l.save_method === "folder" ? "フォルダ" : "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


function CertificateManager({ T }: { T: any }) {
  // セラピスト / スタッフ のタブ切替
  const [kind, setKind] = useState<"therapist" | "staff">("therapist");

  // セラピスト側データ
  const [therapists, setTherapists] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [thTotalDaysMap, setThTotalDaysMap] = useState<Record<number, number>>({});
  const [thRecentMap, setThRecentMap] = useState<Record<number, boolean>>({});

  // スタッフ側データ
  const [staffs, setStaffs] = useState<any[]>([]);
  const [stTotalDaysMap, setStTotalDaysMap] = useState<Record<number, number>>({});
  const [stRecentMap, setStRecentMap] = useState<Record<number, boolean>>({});

  // 共通
  const [storeInfo, setStoreInfo] = useState<any>(null);
  const [selectedId, setSelectedId] = useState<number>(0);
  const [certYear, setCertYear] = useState(new Date().getFullYear());
  const [search, setSearch] = useState("");
  const [issuing, setIssuing] = useState(false);
  const toast = useToast();

  // タブ切替時は選択と検索をリセット
  useEffect(() => { setSelectedId(0); setSearch(""); }, [kind]);

  useEffect(() => {
    const f = async () => {
      // 会社情報
      const { data: st } = await supabase.from("stores").select("company_name, company_address, company_phone"); if (st?.[0]) setStoreInfo(st[0]);

      // セラピスト本体＋契約＋出勤集計
      const { data: th } = await supabase.from("therapists").select("id, name, real_name, address, entry_date, status, phone, license_photo_url").neq("status", "trash").order("sort_order");
      if (th) setTherapists(th);
      const { data: ct } = await supabase.from("contracts").select("therapist_id, status"); if (ct) setContracts(ct);
      const { data: thSett } = await supabase.from("therapist_daily_settlements").select("therapist_id, date").eq("is_settled", true);
      if (thSett) {
        const dm: Record<number, number> = {};
        const rm: Record<number, boolean> = {};
        const now = new Date();
        const three = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate()).toISOString().slice(0, 10);
        thSett.forEach((s: any) => { dm[s.therapist_id] = (dm[s.therapist_id] || 0) + 1; if (s.date >= three) rm[s.therapist_id] = true; });
        setThTotalDaysMap(dm); setThRecentMap(rm);
      }

      // スタッフ本体＋出勤集計
      const { data: stfData } = await supabase.from("staff").select("id, name, real_name, address, entry_date, status, phone, id_doc_url, id_photo_url").neq("status", "trash").order("id");
      if (stfData) setStaffs(stfData);
      const { data: stSch } = await supabase.from("staff_schedules").select("staff_id, date").eq("status", "completed");
      if (stSch) {
        const dm: Record<number, number> = {};
        const rm: Record<number, boolean> = {};
        const now = new Date();
        const three = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate()).toISOString().slice(0, 10);
        stSch.forEach((s: any) => { dm[s.staff_id] = (dm[s.staff_id] || 0) + 1; if (s.date >= three) rm[s.staff_id] = true; });
        setStTotalDaysMap(dm); setStRecentMap(rm);
      }
    }; f();
  }, []);

  // 現在のkindに応じた一覧・マップ
  const people: any[] = kind === "therapist" ? therapists : staffs;
  const totalDaysMap = kind === "therapist" ? thTotalDaysMap : stTotalDaysMap;
  const recentMap = kind === "therapist" ? thRecentMap : stRecentMap;

  const selected = people.find(p => p.id === selectedId);
  const filtered = people.filter(p => !search || p.name.includes(search) || (p.real_name || "").includes(search));

  const getChecks = (p: any) => {
    const totalDays = totalDaysMap[p.id] || 0;
    const hasRecent = recentMap[p.id] || false;
    if (kind === "therapist") {
      const contract = contracts.find(c => c.therapist_id === p.id && c.status === "signed");
      return [
        { label: "身分証提出済み", ok: !!p.license_photo_url, required: true },
        { label: "業務委託契約署名済み", ok: !!contract, required: true },
        { label: "本名登録済み", ok: !!(p.real_name && p.real_name.trim()), required: true },
        { label: "住所登録済み", ok: !!(p.address && p.address.trim()), required: true },
        { label: `総出勤30日以上（現在${totalDays}日）`, ok: totalDays >= 30, required: true },
        { label: "直近3ヶ月以内の出勤あり", ok: hasRecent, required: false },
        { label: "ステータスが稼働中", ok: p.status === "active", required: false },
      ];
    }
    // スタッフ: 契約書署名フローが無いので契約開始日で代替
    return [
      { label: "身分証提出済み", ok: !!(p.id_doc_url || p.id_photo_url), required: true },
      { label: "契約開始日登録済み", ok: !!p.entry_date, required: true },
      { label: "本名登録済み", ok: !!(p.real_name && p.real_name.trim()), required: true },
      { label: "住所登録済み", ok: !!(p.address && p.address.trim()), required: true },
      { label: `総出勤30日以上（現在${totalDays}日）`, ok: totalDays >= 30, required: true },
      { label: "直近3ヶ月以内の出勤あり", ok: hasRecent, required: false },
      { label: "ステータスが稼働中", ok: p.status === "active", required: false },
    ];
  };

  const getStore = () => ({ company_name: storeInfo?.company_name || "", company_address: storeInfo?.company_address || "", company_phone: storeInfo?.company_phone || "" });
  const getPersonInfo = (p: any) => ({ real_name: p.real_name || p.name, name: p.name, address: p.address || "", entry_date: p.entry_date || "" });

  const fetchPayment = async (personId: number) => {
    const months: { month: number; amount: number; days: number }[] = [];
    if (kind === "therapist") {
      const { data: sett } = await supabase.from("therapist_daily_settlements").select("date, total_back").eq("therapist_id", personId).gte("date", `${certYear}-01-01`).lte("date", `${certYear}-12-31`);
      for (let m = 1; m <= 12; m++) {
        const ms = (sett || []).filter((s: any) => new Date(s.date).getMonth() + 1 === m);
        months.push({ month: m, amount: ms.reduce((a: number, s: any) => a + (s.total_back || 0), 0), days: ms.length });
      }
    } else {
      // スタッフ: コミッション＋夜勤手当＋免許手当を合算（交通費は実費のため除外）
      const { data: sch } = await supabase.from("staff_schedules").select("date, commission_fee, night_premium, license_premium").eq("staff_id", personId).eq("status", "completed").gte("date", `${certYear}-01-01`).lte("date", `${certYear}-12-31`);
      for (let m = 1; m <= 12; m++) {
        const ms = (sch || []).filter((s: any) => new Date(s.date).getMonth() + 1 === m);
        months.push({
          month: m,
          amount: ms.reduce((a: number, s: any) => a + (s.commission_fee || 0) + (s.night_premium || 0) + (s.license_premium || 0), 0),
          days: ms.length,
        });
      }
    }
    return { year: certYear, totalGross: months.reduce((a, m) => a + m.amount, 0), totalDays: months.reduce((a, m) => a + m.days, 0), months };
  };

  const issue = async (type: "contract" | "payment" | "transaction") => {
    if (!selected || !storeInfo) { toast.show(`${kind === "therapist" ? "セラピスト" : "スタッフ"}を選択してください`, "error"); return; }
    setIssuing(true);
    try {
      if (type === "contract") { generateContractCertificate(getStore(), getPersonInfo(selected), kind); }
      else { const payment = await fetchPayment(selected.id); if (type === "payment") generatePaymentCertificate(getStore(), getPersonInfo(selected), payment, kind); else generateTransactionCertificate(getStore(), getPersonInfo(selected), payment, kind); }
      toast.show("証明書を発行しました", "success");
    } catch { toast.show("発行に失敗しました", "error"); }
    setIssuing(false);
  };

  const statusMap: Record<string, { label: string; color: string }> = { active: { label: "稼働中", color: "#22c55e" }, inactive: { label: "休止中", color: "#f59e0b" }, retired: { label: "退職", color: "#888780" } };
  const checks = selected ? getChecks(selected) : [];
  const hasRequiredFail = checks.some(c => c.required && !c.ok);
  const personLabel = kind === "therapist" ? "セラピスト" : "スタッフ";

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", animation: "fadeIn 0.3s" }}>
      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-[16px] font-medium">📄 証明書発行</h2>
        <span className="text-[10px] px-2 py-0.5 rounded" style={{ backgroundColor: "#c3a78218", color: "#c3a782" }}>会社印が必要な書類</span>
      </div>

      {/* セラピスト / スタッフ タブ */}
      <div className="flex items-center gap-1 mb-4">
        {([["therapist", "💆 セラピスト"], ["staff", "👥 スタッフ"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setKind(k as any)} className="px-4 py-2 rounded-xl text-[11px] cursor-pointer font-medium" style={{ backgroundColor: kind === k ? "#c3a78218" : "transparent", color: kind === k ? "#c3a782" : T.textMuted, border: `1px solid ${kind === k ? "#c3a78244" : T.border}` }}>{l}</button>
        ))}
        <span className="ml-3 text-[10px]" style={{ color: T.textFaint }}>対象者は業務委託契約に基づき発行します</span>
      </div>

      {/* 発行ポリシー説明 */}
      <div className="rounded-xl border p-4 mb-4" style={{ backgroundColor: T.cardAlt, borderColor: T.border }}>
        <p className="text-[11px] font-medium mb-2">📋 証明書発行ポリシー</p>
        <p className="text-[10px] mb-2" style={{ color: T.textMuted }}>証明書は会社の信用を担保に発行する公式書類です。以下の条件を確認してから発行してください。</p>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1">
          {(kind === "therapist" ? [
            { label: "身分証が提出済みであること", tag: "必須" },
            { label: "業務委託契約書に署名済みであること", tag: "必須" },
            { label: "本名・住所が登録されていること", tag: "必須" },
            { label: "総出勤日数が30日以上であること", tag: "必須" },
            { label: "直近3ヶ月以内に出勤実績があること", tag: "推奨" },
            { label: "ステータスが「稼働中」であること", tag: "推奨" },
          ] : [
            { label: "身分証が提出済みであること", tag: "必須" },
            { label: "契約開始日が登録されていること", tag: "必須" },
            { label: "本名・住所が登録されていること", tag: "必須" },
            { label: "総出勤日数が30日以上であること", tag: "必須" },
            { label: "直近3ヶ月以内に出勤実績があること", tag: "推奨" },
            { label: "ステータスが「稼働中」であること", tag: "推奨" },
          ]).map((r, i) => (
            <p key={i} className="text-[10px] flex items-center gap-2" style={{ color: T.textMuted }}>
              <span className="text-[8px] px-1.5 py-0.5 rounded" style={{ backgroundColor: r.tag === "必須" ? "#c4555518" : "#f59e0b18", color: r.tag === "必須" ? "#c45555" : "#f59e0b" }}>{r.tag}</span>
              {r.label}
            </p>
          ))}
        </div>
        <p className="text-[9px] mt-2" style={{ color: T.textFaint }}>※ バックオフィスでは警告表示の上で発行可能です。{kind === "therapist" ? "セラピストマイページ" : "スタッフ側画面"}では必須条件を満たさない場合は発行できません。</p>
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: "320px 1fr" }}>
        {/* Left */}
        <div className="rounded-xl border p-4" style={{ backgroundColor: T.card, borderColor: T.border }}>
          <p className="text-[11px] font-medium mb-3">{personLabel}を選択</p>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 名前で検索" className="w-full px-3 py-2 rounded-lg text-[11px] outline-none mb-3 border" style={{ backgroundColor: T.cardAlt, borderColor: T.border, color: T.text }} />
          <div className="space-y-1 overflow-y-auto" style={{ maxHeight: 400 }}>
            {filtered.length === 0 && <p className="text-[10px] text-center py-6" style={{ color: T.textFaint }}>該当する{personLabel}がいません</p>}
            {filtered.map(p => {
              const st = statusMap[p.status] || statusMap.active;
              const pChecks = getChecks(p);
              const pWarn = pChecks.filter(c => !c.ok && c.required).length;
              return (
                <button key={p.id} onClick={() => setSelectedId(p.id)} className="w-full text-left px-3 py-2.5 rounded-lg text-[11px] cursor-pointer flex items-center justify-between" style={{ backgroundColor: selectedId === p.id ? "#c3a78215" : "transparent", color: T.text, border: `1px solid ${selectedId === p.id ? "#c3a78244" : "transparent"}` }}>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{p.name}</span>
                    {pWarn > 0 && <span className="text-[8px] px-1 py-0.5 rounded" style={{ backgroundColor: "#c4555518", color: "#c45555" }}>⚠{pWarn}</span>}
                  </div>
                  <span className="text-[8px] px-1.5 py-0.5 rounded" style={{ backgroundColor: st.color + "18", color: st.color }}>{st.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right */}
        <div className="space-y-4">
          {selected ? (<>
            {/* Requirement checks */}
            <div className="rounded-xl border p-4" style={{ backgroundColor: T.card, borderColor: T.border }}>
              <p className="text-[11px] font-medium mb-3">{selected.name} の発行条件チェック</p>
              <div className="grid grid-cols-2 gap-2">
                {checks.map((c, i) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg text-[10px]" style={{ backgroundColor: c.ok ? "#22c55e08" : "#c4555508", border: `1px solid ${c.ok ? "#22c55e20" : "#c4555520"}` }}>
                    <span style={{ color: c.ok ? "#22c55e" : "#c45555" }}>{c.ok ? "✅" : "❌"}</span>
                    <span style={{ color: c.ok ? T.textMuted : "#c45555" }}>{c.label}</span>
                    {c.required && !c.ok && <span className="text-[8px] px-1 rounded" style={{ backgroundColor: "#c4555518", color: "#c45555", marginLeft: "auto" }}>必須</span>}
                  </div>
                ))}
              </div>
              {hasRequiredFail && (
                <div className="mt-3 px-3 py-2 rounded-lg" style={{ backgroundColor: "#f59e0b0c", border: "1px solid #f59e0b25" }}>
                  <p className="text-[10px]" style={{ color: "#f59e0b" }}>⚠️ 必須条件を満たしていませんが、バックオフィスでは発行可能です。発行する場合は内容を十分に確認してください。</p>
                </div>
              )}
            </div>

            {/* Certificate cards */}
            <div className="rounded-xl border p-4" style={{ backgroundColor: T.card, borderColor: T.border }}>
              <div className="flex items-center justify-between mb-4">
                <p className="text-[13px] font-medium">発行する証明書を選択</p>
                <div className="flex items-center gap-2">
                  <span className="text-[10px]" style={{ color: T.textMuted }}>対象年度</span>
                  <select value={certYear} onChange={e => setCertYear(Number(e.target.value))} className="px-2 py-1 rounded-lg text-[11px] outline-none cursor-pointer border" style={{ backgroundColor: T.cardAlt, borderColor: T.border, color: T.text }}>
                    {[2026, 2025, 2024, 2023].map(y => <option key={y} value={y}>{y}年</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <button onClick={() => issue("contract")} disabled={issuing} className="rounded-xl border p-4 text-left cursor-pointer" style={{ backgroundColor: "#2563eb08", borderColor: "#2563eb30" }}>
                  <div className="text-[20px] mb-2">📝</div>
                  <p className="text-[12px] font-medium" style={{ color: "#2563eb" }}>業務委託契約証明書</p>
                  <p className="text-[9px] mt-1" style={{ color: T.textMuted }}>在籍証明。賃貸契約・保育園申請に。</p>
                </button>
                <button onClick={() => issue("payment")} disabled={issuing} className="rounded-xl border p-4 text-left cursor-pointer" style={{ backgroundColor: "#06b6d408", borderColor: "#06b6d430" }}>
                  <div className="text-[20px] mb-2">💰</div>
                  <p className="text-[12px] font-medium" style={{ color: "#06b6d4" }}>報酬支払証明書</p>
                  <p className="text-[9px] mt-1" style={{ color: T.textMuted }}>収入証明。ローン・カード審査に。</p>
                </button>
                <button onClick={() => issue("transaction")} disabled={issuing} className="rounded-xl border p-4 text-left cursor-pointer" style={{ backgroundColor: "#7c3aed08", borderColor: "#7c3aed30" }}>
                  <div className="text-[20px] mb-2">📊</div>
                  <p className="text-[12px] font-medium" style={{ color: "#7c3aed" }}>取引実績証明書</p>
                  <p className="text-[9px] mt-1" style={{ color: T.textMuted }}>融資・補助金申請に。</p>
                </button>
              </div>
              {kind === "staff" && (
                <p className="text-[9px] mt-3" style={{ color: T.textFaint }}>※ スタッフの報酬合計は「コミッション + 夜勤手当 + 免許手当」です。交通費（実費精算分）は含まれません。</p>
              )}
            </div>

            {/* 注意事項 */}
            <div className="rounded-xl border p-4" style={{ backgroundColor: T.cardAlt, borderColor: T.border }}>
              <p className="text-[11px] font-medium mb-2">⚠️ 発行後の手順</p>
              <div className="space-y-1">
                {["証明書を印刷（Ctrl+P → PDF保存も可）", "代表印（実印）を押印", `${personLabel}に手渡しまたはPDF送付`, "控えを会社で保管"].map((t, i) => (
                  <p key={i} className="text-[10px] flex gap-2" style={{ color: T.textMuted }}><span style={{ color: "#c3a782" }}>{i + 1}.</span>{t}</p>
                ))}
              </div>
            </div>
          </>) : (
            <div className="rounded-xl border p-8 text-center" style={{ backgroundColor: T.card, borderColor: T.border }}>
              <p className="text-[32px] mb-3">📄</p>
              <p className="text-[14px] font-medium mb-2">{personLabel}を選択してください</p>
              <p className="text-[11px]" style={{ color: T.textMuted }}>左のリストから証明書を発行する{personLabel}を選択してください。</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function VendorsManager({ T }: { T: any }) {
  type Vendor = {
    id: number;
    name: string;
    kana: string;
    invoice_number: string;
    has_invoice: boolean;
    category: string;
    address: string;
    phone: string;
    email: string;
    website: string;
    payment_bank: string;
    payment_account: string;
    payment_account_name: string;
    notes: string;
    started_at: string | null;
    ended_at: string | null;
    status: string;
  };

  const toast = useToast();
  const { confirm, ConfirmModalNode } = useConfirm();

  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [invoiceFilter, setInvoiceFilter] = useState<"all" | "registered" | "unregistered">("all");
  const [showArchived, setShowArchived] = useState(false);

  // 追加・編集モーダル
  const [modalMode, setModalMode] = useState<"closed" | "add" | "edit">("closed");
  const [editingId, setEditingId] = useState<number>(0);
  const [form, setForm] = useState<Omit<Vendor, "id" | "status">>({
    name: "", kana: "", invoice_number: "", has_invoice: false, category: "",
    address: "", phone: "", email: "", website: "",
    payment_bank: "", payment_account: "", payment_account_name: "",
    notes: "", started_at: null, ended_at: null,
  });

  // 取引先ごとの年間取引額集計（現在年度のexpensesから集計）
  const [vendorSummary, setVendorSummary] = useState<Record<number, { amount: number; count: number }>>({});
  const [summaryYear, setSummaryYear] = useState(new Date().getFullYear());

  const fetchVendors = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from("vendors").select("*").order("kana", { ascending: true }).order("name", { ascending: true });
    if (error) { toast.show("取引先の取得に失敗しました", "error"); setLoading(false); return; }
    setVendors((data || []) as Vendor[]);
    setLoading(false);
  }, [toast]);

  // 年間取引額の逆引き
  const fetchVendorSummary = useCallback(async (year: number) => {
    const { data } = await supabase
      .from("expenses")
      .select("vendor_id, amount")
      .gte("date", `${year}-01-01`)
      .lte("date", `${year}-12-31`)
      .not("vendor_id", "is", null);
    const map: Record<number, { amount: number; count: number }> = {};
    (data || []).forEach((e: any) => {
      if (!e.vendor_id) return;
      if (!map[e.vendor_id]) map[e.vendor_id] = { amount: 0, count: 0 };
      map[e.vendor_id].amount += e.amount || 0;
      map[e.vendor_id].count += 1;
    });
    setVendorSummary(map);
  }, []);

  useEffect(() => { fetchVendors(); }, [fetchVendors]);
  useEffect(() => { fetchVendorSummary(summaryYear); }, [fetchVendorSummary, summaryYear]);

  // カテゴリ候補（動的に生成＋デフォルト）
  const DEFAULT_CATEGORIES = ["仕入（備品・オイル）", "仕入（消耗品）", "地代家賃", "水道光熱費", "通信費", "リース料", "保険料", "専門家（税理士・社労士）", "広告宣伝", "修繕", "その他"];
  const allCategories = Array.from(new Set([...DEFAULT_CATEGORIES, ...vendors.map(v => v.category).filter(Boolean)]));

  // フィルタ適用
  const filtered = vendors.filter(v => {
    if (!showArchived && v.status === "archived") return false;
    if (categoryFilter !== "all" && v.category !== categoryFilter) return false;
    if (invoiceFilter === "registered" && !v.has_invoice) return false;
    if (invoiceFilter === "unregistered" && v.has_invoice) return false;
    if (search) {
      const q = search.toLowerCase();
      const hit = v.name.toLowerCase().includes(q) || v.kana.toLowerCase().includes(q) || v.invoice_number.toLowerCase().includes(q) || v.category.toLowerCase().includes(q);
      if (!hit) return false;
    }
    return true;
  });

  // インボイス番号のバリデーション: T + 13桁の数字
  const isValidInvoiceNumber = (num: string) => /^T\d{13}$/.test(num);

  // インボイス番号入力時、正しいフォーマットなら自動で has_invoice を true に
  const onInvoiceNumberChange = (val: string) => {
    const cleaned = val.trim().toUpperCase();
    const newHasInvoice = isValidInvoiceNumber(cleaned);
    setForm(f => ({ ...f, invoice_number: cleaned, has_invoice: newHasInvoice || f.has_invoice }));
  };

  const openAdd = () => {
    setForm({
      name: "", kana: "", invoice_number: "", has_invoice: false, category: "",
      address: "", phone: "", email: "", website: "",
      payment_bank: "", payment_account: "", payment_account_name: "",
      notes: "", started_at: null, ended_at: null,
    });
    setEditingId(0);
    setModalMode("add");
  };

  const openEdit = (v: Vendor) => {
    setForm({
      name: v.name, kana: v.kana || "", invoice_number: v.invoice_number || "", has_invoice: v.has_invoice,
      category: v.category || "", address: v.address || "", phone: v.phone || "", email: v.email || "",
      website: v.website || "", payment_bank: v.payment_bank || "", payment_account: v.payment_account || "",
      payment_account_name: v.payment_account_name || "", notes: v.notes || "",
      started_at: v.started_at, ended_at: v.ended_at,
    });
    setEditingId(v.id);
    setModalMode("edit");
  };

  const closeModal = () => { setModalMode("closed"); setEditingId(0); };

  const save = async () => {
    if (!form.name.trim()) { toast.show("取引先名を入力してください", "error"); return; }
    if (form.invoice_number && !isValidInvoiceNumber(form.invoice_number)) {
      toast.show("インボイス番号は T + 13桁の数字で入力してください（例: T1234567890123）", "error");
      return;
    }
    const payload = {
      name: form.name.trim(), kana: form.kana.trim(), invoice_number: form.invoice_number.trim(),
      has_invoice: form.has_invoice, category: form.category.trim(),
      address: form.address.trim(), phone: form.phone.trim(), email: form.email.trim(), website: form.website.trim(),
      payment_bank: form.payment_bank.trim(), payment_account: form.payment_account.trim(), payment_account_name: form.payment_account_name.trim(),
      notes: form.notes.trim(), started_at: form.started_at, ended_at: form.ended_at,
    };
    if (modalMode === "add") {
      const { error } = await supabase.from("vendors").insert({ ...payload, status: "active" });
      if (error) { toast.show(`追加に失敗しました: ${error.message}`, "error"); return; }
      toast.show(`「${form.name}」を追加しました`, "success");
    } else {
      const { error } = await supabase.from("vendors").update(payload).eq("id", editingId);
      if (error) { toast.show(`更新に失敗しました: ${error.message}`, "error"); return; }
      toast.show(`「${form.name}」を更新しました`, "success");
    }
    closeModal();
    fetchVendors();
  };

  const archive = async (v: Vendor) => {
    const ok = await confirm({ title: "取引先をアーカイブ", message: `「${v.name}」をアーカイブします。過去データは保持され、デフォルトの一覧からは非表示になります。よろしいですか？`, variant: "warning", confirmLabel: "アーカイブ", cancelLabel: "キャンセル" });
    if (!ok) return;
    const { error } = await supabase.from("vendors").update({ status: "archived", ended_at: v.ended_at || new Date().toISOString().slice(0, 10) }).eq("id", v.id);
    if (error) { toast.show(`アーカイブに失敗しました: ${error.message}`, "error"); return; }
    toast.show("アーカイブしました", "success");
    fetchVendors();
  };

  const unarchive = async (v: Vendor) => {
    const { error } = await supabase.from("vendors").update({ status: "active" }).eq("id", v.id);
    if (error) { toast.show(`復元に失敗しました: ${error.message}`, "error"); return; }
    toast.show("復元しました", "success");
    fetchVendors();
  };

  const hardDelete = async (v: Vendor) => {
    const ok = await confirm({ title: "取引先を完全削除", message: `「${v.name}」を完全に削除します。この操作は元に戻せません。よろしいですか？`, variant: "danger", confirmLabel: "削除する", cancelLabel: "キャンセル" });
    if (!ok) return;
    const { error } = await supabase.from("vendors").delete().eq("id", v.id);
    if (error) { toast.show(`削除に失敗しました: ${error.message}`, "error"); return; }
    toast.show("削除しました", "success");
    fetchVendors();
  };

  // 統計
  const activeVendors = vendors.filter(v => v.status === "active");
  const registeredCount = activeVendors.filter(v => v.has_invoice).length;
  const unregisteredCount = activeVendors.filter(v => !v.has_invoice).length;
  const registeredRate = activeVendors.length > 0 ? Math.round((registeredCount / activeVendors.length) * 100) : 0;

  // 取引額ベースの統計（summaryYear年のexpenses.vendor_idから逆引き集計）
  const summaryList: { amount: number; count: number }[] = Object.values(vendorSummary);
  const totalCount = summaryList.reduce((a, s) => a + s.count, 0);
  const totalAmount = summaryList.reduce((a, s) => a + s.amount, 0);
  const registeredAmount = vendors.filter(v => v.has_invoice).reduce((a, v) => a + (vendorSummary[v.id]?.amount || 0), 0);
  const unregisteredAmount = vendors.filter(v => !v.has_invoice).reduce((a, v) => a + (vendorSummary[v.id]?.amount || 0), 0);

  const inputStyle: React.CSSProperties = { backgroundColor: T.cardAlt, border: `1px solid ${T.border}`, color: T.text };

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", animation: "fadeIn 0.3s" }}>
      {ConfirmModalNode}

      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-[16px] font-medium">💼 取引先マスター</h2>
          <p className="text-[10px] mt-0.5" style={{ color: T.textMuted }}>経費・仕入の支払先と適格請求書発行事業者番号を一元管理</p>
        </div>
        <button onClick={openAdd} className="px-4 py-2 rounded-xl text-[12px] cursor-pointer font-medium text-white" style={{ backgroundColor: "#c3a782" }}>+ 取引先を追加</button>
      </div>

      {/* サマリー */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div className="rounded-xl p-4 border" style={{ backgroundColor: T.card, borderColor: T.border }}>
          <p className="text-[10px] mb-1" style={{ color: T.textMuted }}>登録数（稼働中）</p>
          <p className="text-[20px] font-medium">{activeVendors.length}</p>
        </div>
        <div className="rounded-xl p-4 border" style={{ backgroundColor: T.card, borderColor: T.border }}>
          <p className="text-[10px] mb-1" style={{ color: T.textMuted }}>インボイス登録済</p>
          <p className="text-[20px] font-medium" style={{ color: "#22c55e" }}>{registeredCount}</p>
        </div>
        <div className="rounded-xl p-4 border" style={{ backgroundColor: T.card, borderColor: T.border }}>
          <p className="text-[10px] mb-1" style={{ color: T.textMuted }}>未登録</p>
          <p className="text-[20px] font-medium" style={{ color: "#c45555" }}>{unregisteredCount}</p>
        </div>
        <div className="rounded-xl p-4 border" style={{ backgroundColor: T.card, borderColor: T.border }}>
          <p className="text-[10px] mb-1" style={{ color: T.textMuted }}>登録率</p>
          <p className="text-[20px] font-medium" style={{ color: registeredRate >= 80 ? "#22c55e" : registeredRate >= 50 ? "#f59e0b" : "#c45555" }}>{registeredRate}%</p>
        </div>
      </div>

      {/* 取引額ベースのサマリー */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <div className="rounded-xl p-4 border" style={{ backgroundColor: T.card, borderColor: T.border }}>
          <p className="text-[10px] mb-1" style={{ color: T.textMuted }}>{summaryYear}年 総取引額（紐付済のみ）</p>
          <p className="text-[18px] font-medium">¥{totalAmount.toLocaleString()}</p>
          <p className="text-[9px] mt-1" style={{ color: T.textFaint }}>{totalCount}件の経費が取引先に紐付いています</p>
        </div>
        <div className="rounded-xl p-4 border" style={{ backgroundColor: T.card, borderColor: T.border }}>
          <p className="text-[10px] mb-1" style={{ color: T.textMuted }}>✓ インボイス登録済への支払</p>
          <p className="text-[18px] font-medium" style={{ color: "#22c55e" }}>¥{registeredAmount.toLocaleString()}</p>
          <p className="text-[9px] mt-1" style={{ color: T.textFaint }}>仕入税額控除の対象</p>
        </div>
        <div className="rounded-xl p-4 border" style={{ backgroundColor: T.card, borderColor: T.border }}>
          <p className="text-[10px] mb-1" style={{ color: T.textMuted }}>⚠ 未登録先への支払</p>
          <p className="text-[18px] font-medium" style={{ color: "#c45555" }}>¥{unregisteredAmount.toLocaleString()}</p>
          <p className="text-[9px] mt-1" style={{ color: T.textFaint }}>仕入税額控除できない（10%相当 約¥{Math.round(unregisteredAmount / 11).toLocaleString()} 増税インパクト）</p>
        </div>
      </div>

      {/* フィルタ */}
      <div className="rounded-xl border p-3 mb-3 flex items-center gap-3 flex-wrap" style={{ backgroundColor: T.card, borderColor: T.border }}>
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 名前・フリガナ・インボイス番号で検索" className="flex-1 min-w-[200px] px-3 py-2 rounded-lg text-[12px] outline-none" style={inputStyle} />
        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="px-3 py-2 rounded-lg text-[11px] outline-none cursor-pointer" style={inputStyle}>
          <option value="all">すべてのカテゴリ</option>
          {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <div className="flex items-center gap-1 rounded-lg p-1 border" style={{ borderColor: T.border }}>
          {([["all", "全て"], ["registered", "登録済"], ["unregistered", "未登録"]] as const).map(([k, l]) => (
            <button key={k} onClick={() => setInvoiceFilter(k)} className="px-3 py-1 rounded text-[10px] cursor-pointer" style={{ backgroundColor: invoiceFilter === k ? "#c3a78218" : "transparent", color: invoiceFilter === k ? "#c3a782" : T.textMuted }}>{l}</button>
          ))}
        </div>
        <label className="flex items-center gap-1.5 text-[11px] cursor-pointer" style={{ color: T.textSub }}>
          <input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)} />
          アーカイブ表示
        </label>
      </div>

      {/* 一覧 */}
      <div className="flex items-center justify-between mb-2">
        <p className="text-[11px]" style={{ color: T.textMuted }}>{filtered.length}件の取引先</p>
        <div className="flex items-center gap-2">
          <span className="text-[10px]" style={{ color: T.textMuted }}>年間取引額の対象年</span>
          <select value={summaryYear} onChange={e => setSummaryYear(Number(e.target.value))} className="px-2 py-1 rounded-lg text-[11px] outline-none cursor-pointer" style={inputStyle}>
            {[2026, 2025, 2024, 2023].map(y => <option key={y} value={y}>{y}年</option>)}
          </select>
        </div>
      </div>
      <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: T.card, borderColor: T.border }}>
        {loading ? (
          <p className="text-[12px] text-center py-8" style={{ color: T.textMuted }}>読み込み中...</p>
        ) : filtered.length === 0 ? (
          <p className="text-[12px] text-center py-8" style={{ color: T.textFaint }}>該当する取引先がいません</p>
        ) : (
          <table className="w-full" style={{ fontSize: 12 }}>
            <thead style={{ backgroundColor: T.cardAlt, color: T.textSub, fontSize: 11 }}>
              <tr>
                <th style={{ padding: "8px 10px", textAlign: "left", borderBottom: `1px solid ${T.border}` }}>取引先名</th>
                <th style={{ padding: "8px 10px", textAlign: "left", borderBottom: `1px solid ${T.border}`, width: 120 }}>カテゴリ</th>
                <th style={{ padding: "8px 10px", textAlign: "center", borderBottom: `1px solid ${T.border}`, width: 90 }}>インボイス</th>
                <th style={{ padding: "8px 10px", textAlign: "left", borderBottom: `1px solid ${T.border}`, width: 170 }}>登録番号</th>
                <th style={{ padding: "8px 10px", textAlign: "right", borderBottom: `1px solid ${T.border}`, width: 140 }}>{summaryYear}年取引額</th>
                <th style={{ padding: "8px 10px", textAlign: "left", borderBottom: `1px solid ${T.border}`, width: 110 }}>取引開始</th>
                <th style={{ padding: "8px 10px", textAlign: "center", borderBottom: `1px solid ${T.border}`, width: 120 }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((v, i) => {
                const s = vendorSummary[v.id] || { amount: 0, count: 0 };
                return (
                <tr key={v.id} style={{ borderTop: i === 0 ? "none" : `1px solid ${T.border}`, opacity: v.status === "archived" ? 0.5 : 1 }}>
                  <td style={{ padding: "8px 10px" }}>
                    <div style={{ fontWeight: 500 }}>{v.name}</div>
                    {v.kana && <div className="text-[9px]" style={{ color: T.textFaint }}>{v.kana}</div>}
                    {v.status === "archived" && <span className="text-[8px] px-1.5 py-0.5 rounded mt-0.5 inline-block" style={{ backgroundColor: "#88878018", color: "#888780" }}>アーカイブ</span>}
                  </td>
                  <td style={{ padding: "8px 10px", color: T.textSub, fontSize: 11 }}>{v.category || "—"}</td>
                  <td style={{ padding: "8px 10px", textAlign: "center" }}>
                    {v.has_invoice ? (
                      <span className="text-[9px] px-2 py-0.5 rounded" style={{ backgroundColor: "#22c55e18", color: "#22c55e" }}>✓ 登録済</span>
                    ) : (
                      <span className="text-[9px] px-2 py-0.5 rounded" style={{ backgroundColor: "#c4555518", color: "#c45555" }}>未登録</span>
                    )}
                  </td>
                  <td style={{ padding: "8px 10px", fontFamily: "monospace", fontSize: 11, color: v.has_invoice ? T.text : T.textFaint }}>{v.invoice_number || "—"}</td>
                  <td style={{ padding: "8px 10px", textAlign: "right", fontSize: 11 }}>
                    {s.count > 0 ? (
                      <div>
                        <div style={{ fontWeight: 500, color: T.text }}>¥{s.amount.toLocaleString()}</div>
                        <div className="text-[9px]" style={{ color: T.textFaint }}>{s.count}件</div>
                      </div>
                    ) : (
                      <span style={{ color: T.textFaint }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: "8px 10px", color: T.textSub, fontSize: 11 }}>{v.started_at || "—"}</td>
                  <td style={{ padding: "8px 10px", textAlign: "center" }}>
                    <div className="flex gap-1 justify-center">
                      <button onClick={() => openEdit(v)} className="text-[10px] px-2 py-1 rounded cursor-pointer border" style={{ borderColor: T.border, color: T.textSub }}>編集</button>
                      {v.status === "active" ? (
                        <button onClick={() => archive(v)} className="text-[10px] px-2 py-1 rounded cursor-pointer" style={{ backgroundColor: "#f59e0b12", color: "#f59e0b" }}>🗃 保管</button>
                      ) : (
                        <>
                          <button onClick={() => unarchive(v)} className="text-[10px] px-2 py-1 rounded cursor-pointer" style={{ backgroundColor: "#22c55e12", color: "#22c55e" }}>↩ 復元</button>
                          <button onClick={() => hardDelete(v)} className="text-[10px] px-2 py-1 rounded cursor-pointer" style={{ backgroundColor: "#c4555512", color: "#c45555" }}>削除</button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* 参考情報 */}
      <div className="rounded-xl p-4 mt-4" style={{ backgroundColor: "#c3a78210", border: "1px solid #c3a78233" }}>
        <p className="text-[11px] font-medium mb-1" style={{ color: "#c3a782" }}>💡 インボイス登録番号について</p>
        <div className="text-[10px] leading-relaxed space-y-1" style={{ color: T.textSub }}>
          <p>• 適格請求書発行事業者番号は「T + 13桁の数字」で、インボイス番号を入力すると自動でインボイス登録済として扱います。</p>
          <p>• <strong>登録済</strong>の取引先: 仕入税額控除OK。経費100円につき約9.1円分を消費税から差し引ける（原則課税の場合）。</p>
          <p>• <strong>未登録</strong>の取引先: 仕入税額控除できない。実質負担が1割増える。大口の未登録先は登録依頼の優先対象。</p>
          <p>• 国税庁の適格請求書発行事業者公表サイトで登録番号を確認できます: <a href="https://www.invoice-kohyo.nta.go.jp/" target="_blank" rel="noopener noreferrer" style={{ color: "#c3a782", textDecoration: "underline" }}>invoice-kohyo.nta.go.jp</a></p>
        </div>
      </div>

      {/* 追加・編集モーダル */}
      {modalMode !== "closed" && (
        <div onClick={closeModal} className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.4)" }}>
          <div onClick={e => e.stopPropagation()} className="rounded-2xl border p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-[fadeIn_0.25s]" style={{ backgroundColor: T.card, borderColor: T.border }}>
            <h2 className="text-[15px] font-medium mb-4">{modalMode === "add" ? "取引先を追加" : "取引先を編集"}</h2>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] mb-1" style={{ color: T.textSub }}>取引先名 *</label>
                  <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="株式会社〇〇" className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} />
                </div>
                <div>
                  <label className="block text-[11px] mb-1" style={{ color: T.textSub }}>フリガナ</label>
                  <input type="text" value={form.kana} onChange={e => setForm(f => ({ ...f, kana: e.target.value }))} placeholder="カブシキガイシャマルマル" className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} />
                </div>
              </div>

              <div>
                <label className="block text-[11px] mb-1" style={{ color: T.textSub }}>カテゴリ</label>
                <input type="text" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} list="vendor-categories" placeholder="例: 仕入（備品・オイル）" className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} />
                <datalist id="vendor-categories">
                  {allCategories.map(c => <option key={c} value={c} />)}
                </datalist>
              </div>

              <div className="rounded-xl p-4" style={{ backgroundColor: T.cardAlt, border: `1px solid ${T.border}` }}>
                <p className="text-[11px] font-medium mb-2">🧾 インボイス情報</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] mb-1" style={{ color: T.textMuted }}>登録番号</label>
                    <input type="text" value={form.invoice_number} onChange={e => onInvoiceNumberChange(e.target.value)} placeholder="T1234567890123" className="w-full px-3 py-2 rounded-lg text-[12px] outline-none" style={{ ...inputStyle, fontFamily: "monospace", backgroundColor: T.card }} />
                    <p className="text-[9px] mt-1" style={{ color: form.invoice_number && !isValidInvoiceNumber(form.invoice_number) ? "#c45555" : T.textFaint }}>
                      {form.invoice_number && !isValidInvoiceNumber(form.invoice_number) ? "⚠ T + 13桁の数字で入力してください" : "形式: T + 13桁の数字"}
                    </p>
                  </div>
                  <div className="flex items-center">
                    <label className="flex items-center gap-2 text-[11px] cursor-pointer" style={{ color: T.textSub }}>
                      <input type="checkbox" checked={form.has_invoice} onChange={e => setForm(f => ({ ...f, has_invoice: e.target.checked }))} />
                      インボイス登録済み事業者
                    </label>
                  </div>
                </div>
              </div>

              <div className="rounded-xl p-4" style={{ backgroundColor: T.cardAlt, border: `1px solid ${T.border}` }}>
                <p className="text-[11px] font-medium mb-2">📍 連絡先・取引期間</p>
                <div className="space-y-2">
                  <input type="text" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="住所" className="w-full px-3 py-2 rounded-lg text-[12px] outline-none" style={{ ...inputStyle, backgroundColor: T.card }} />
                  <div className="grid grid-cols-2 gap-2">
                    <input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="電話番号" className="px-3 py-2 rounded-lg text-[12px] outline-none" style={{ ...inputStyle, backgroundColor: T.card }} />
                    <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="メール" className="px-3 py-2 rounded-lg text-[12px] outline-none" style={{ ...inputStyle, backgroundColor: T.card }} />
                  </div>
                  <input type="text" value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))} placeholder="サイトURL" className="w-full px-3 py-2 rounded-lg text-[12px] outline-none" style={{ ...inputStyle, backgroundColor: T.card }} />
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] mb-0.5" style={{ color: T.textMuted }}>取引開始日</label>
                      <input type="date" value={form.started_at || ""} onChange={e => setForm(f => ({ ...f, started_at: e.target.value || null }))} className="w-full px-3 py-2 rounded-lg text-[12px] outline-none" style={{ ...inputStyle, backgroundColor: T.card }} />
                    </div>
                    <div>
                      <label className="block text-[10px] mb-0.5" style={{ color: T.textMuted }}>取引終了日</label>
                      <input type="date" value={form.ended_at || ""} onChange={e => setForm(f => ({ ...f, ended_at: e.target.value || null }))} className="w-full px-3 py-2 rounded-lg text-[12px] outline-none" style={{ ...inputStyle, backgroundColor: T.card }} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-xl p-4" style={{ backgroundColor: T.cardAlt, border: `1px solid ${T.border}` }}>
                <p className="text-[11px] font-medium mb-2">🏦 支払先口座（任意）</p>
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <input type="text" value={form.payment_bank} onChange={e => setForm(f => ({ ...f, payment_bank: e.target.value }))} placeholder="銀行名・支店（例: 三井住友銀行 栄支店）" className="px-3 py-2 rounded-lg text-[12px] outline-none" style={{ ...inputStyle, backgroundColor: T.card }} />
                    <input type="text" value={form.payment_account} onChange={e => setForm(f => ({ ...f, payment_account: e.target.value }))} placeholder="口座（例: 普通 1234567）" className="px-3 py-2 rounded-lg text-[12px] outline-none" style={{ ...inputStyle, backgroundColor: T.card }} />
                  </div>
                  <input type="text" value={form.payment_account_name} onChange={e => setForm(f => ({ ...f, payment_account_name: e.target.value }))} placeholder="口座名義（カナ）" className="w-full px-3 py-2 rounded-lg text-[12px] outline-none" style={{ ...inputStyle, backgroundColor: T.card }} />
                </div>
              </div>

              <div>
                <label className="block text-[11px] mb-1" style={{ color: T.textSub }}>メモ</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="取引の経緯・窓口担当者・契約条件など" className="w-full px-3 py-2 rounded-xl text-[12px] outline-none resize-none" style={inputStyle} />
              </div>
            </div>

            <div className="flex gap-2 mt-5">
              <button onClick={closeModal} className="flex-1 px-4 py-2.5 rounded-xl text-[12px] cursor-pointer border" style={{ borderColor: T.border, color: T.textSub }}>キャンセル</button>
              <button onClick={save} className="flex-[2] px-4 py-2.5 rounded-xl text-[12px] cursor-pointer text-white font-medium" style={{ backgroundColor: "#c3a782" }}>{modalMode === "add" ? "追加する" : "保存する"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DocumentTemplatesManager({ T, activeStaff }: { T: any; activeStaff: any }) {
  type Template = {
    id: number;
    name: string;
    category: string;
    description: string;
    target_kind: string;
    status: string;
    created_by_name: string;
    created_at: string;
    updated_at: string;
  };
  type TemplateVersion = {
    id: number;
    template_id: number;
    version: string;
    file_url: string;
    file_path: string;
    file_name: string;
    file_size: number;
    mime_type: string;
    change_note: string;
    effective_from: string | null;
    is_current: boolean;
    uploaded_by_name: string;
    uploaded_at: string;
  };

  const toast = useToast();
  const { confirm, ConfirmModalNode } = useConfirm();

  const [templates, setTemplates] = useState<Template[]>([]);
  const [versionsByTemplate, setVersionsByTemplate] = useState<Record<number, TemplateVersion[]>>({});
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [targetFilter, setTargetFilter] = useState<"all" | "therapist" | "staff" | "both" | "vendor" | "customer" | "internal">("all");
  const [showArchived, setShowArchived] = useState(false);

  // 追加・編集モーダル
  const [modalMode, setModalMode] = useState<"closed" | "add" | "edit">("closed");
  const [editingId, setEditingId] = useState<number>(0);
  const [form, setForm] = useState({ name: "", category: "契約書", description: "", target_kind: "therapist" });

  // 初回バージョンアップロード用
  const [initialFile, setInitialFile] = useState<File | null>(null);
  const [initialVersion, setInitialVersion] = useState("1.0");
  const [initialChangeNote, setInitialChangeNote] = useState("");

  // バージョン詳細モーダル
  const [versionModalTemplate, setVersionModalTemplate] = useState<Template | null>(null);
  const [newVersionFile, setNewVersionFile] = useState<File | null>(null);
  const [newVersionStr, setNewVersionStr] = useState("");
  const [newVersionChangeNote, setNewVersionChangeNote] = useState("");
  const [newVersionEffectiveFrom, setNewVersionEffectiveFrom] = useState("");
  const [uploading, setUploading] = useState(false);

  const CATEGORIES = ["契約書", "誓約書", "同意書", "業務マニュアル", "社内規程", "雛形書類", "その他"];
  const TARGET_LABELS: Record<string, { label: string; color: string }> = {
    therapist: { label: "💆 セラピスト", color: "#c3a782" },
    staff: { label: "👥 スタッフ", color: "#85a8c4" },
    both: { label: "🧑‍🤝‍🧑 両方", color: "#a855f7" },
    vendor: { label: "💼 取引先", color: "#06b6d4" },
    customer: { label: "👤 お客様", color: "#d4687e" },
    internal: { label: "🏢 社内", color: "#888780" },
  };

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const { data: tpls, error: te } = await supabase.from("document_templates").select("*").order("category").order("name");
    if (te) { toast.show(`取得失敗: ${te.message}`, "error"); setLoading(false); return; }
    setTemplates((tpls || []) as Template[]);
    const { data: vers, error: ve } = await supabase.from("document_template_versions").select("*").order("uploaded_at", { ascending: false });
    if (ve) { toast.show(`バージョン取得失敗: ${ve.message}`, "error"); setLoading(false); return; }
    const grouped: Record<number, TemplateVersion[]> = {};
    (vers || []).forEach((v: any) => {
      if (!grouped[v.template_id]) grouped[v.template_id] = [];
      grouped[v.template_id].push(v as TemplateVersion);
    });
    setVersionsByTemplate(grouped);
    setLoading(false);
  }, [toast]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const filtered = templates.filter(t => {
    if (!showArchived && t.status === "archived") return false;
    if (categoryFilter !== "all" && t.category !== categoryFilter) return false;
    if (targetFilter !== "all" && t.target_kind !== targetFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!t.name.toLowerCase().includes(q) && !t.description.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const getCurrent = (tId: number): TemplateVersion | undefined => (versionsByTemplate[tId] || []).find(v => v.is_current);
  const getVersionCount = (tId: number) => (versionsByTemplate[tId] || []).length;

  const openAdd = () => {
    setForm({ name: "", category: "契約書", description: "", target_kind: "therapist" });
    setInitialFile(null); setInitialVersion("1.0"); setInitialChangeNote("");
    setEditingId(0);
    setModalMode("add");
  };

  const openEdit = (t: Template) => {
    setForm({ name: t.name, category: t.category || "契約書", description: t.description || "", target_kind: t.target_kind || "therapist" });
    setEditingId(t.id);
    setModalMode("edit");
  };

  const closeModal = () => {
    setModalMode("closed"); setEditingId(0);
    setInitialFile(null); setInitialVersion("1.0"); setInitialChangeNote("");
  };

  const uploadFile = async (file: File, templateId: number): Promise<{ path: string; publicUrl: string } | null> => {
    const ext = file.name.split(".").pop() || "bin";
    const path = `${templateId}/${Date.now()}_${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("document-templates").upload(path, file, { upsert: false, contentType: file.type });
    if (error) {
      toast.show(`ファイルアップロード失敗: ${error.message}`, "error");
      return null;
    }
    const { data } = supabase.storage.from("document-templates").getPublicUrl(path);
    return { path, publicUrl: data.publicUrl };
  };

  const save = async () => {
    if (!form.name.trim()) { toast.show("テンプレート名を入力してください", "error"); return; }
    if (modalMode === "add" && !initialFile) { toast.show("最初のバージョンのファイルをアップロードしてください", "error"); return; }

    setUploading(true);
    const payload = {
      name: form.name.trim(), category: form.category, description: form.description.trim(),
      target_kind: form.target_kind,
    };

    if (modalMode === "add") {
      const { data: inserted, error } = await supabase.from("document_templates").insert({ ...payload, status: "active", created_by_name: activeStaff?.name || "" }).select("*").single();
      if (error || !inserted) { toast.show(`追加失敗: ${error?.message}`, "error"); setUploading(false); return; }

      // 初回バージョンアップロード
      if (initialFile) {
        const up = await uploadFile(initialFile, inserted.id);
        if (!up) { setUploading(false); return; }
        const { error: ve } = await supabase.from("document_template_versions").insert({
          template_id: inserted.id,
          version: initialVersion.trim() || "1.0",
          file_url: up.publicUrl, file_path: up.path, file_name: initialFile.name,
          file_size: initialFile.size, mime_type: initialFile.type,
          change_note: initialChangeNote.trim() || "初版",
          effective_from: new Date().toISOString().slice(0, 10),
          is_current: true,
          uploaded_by_name: activeStaff?.name || "",
        });
        if (ve) { toast.show(`バージョン追加失敗: ${ve.message}`, "error"); setUploading(false); return; }
      }
      toast.show(`「${form.name}」を追加しました`, "success");
    } else {
      const { error } = await supabase.from("document_templates").update(payload).eq("id", editingId);
      if (error) { toast.show(`更新失敗: ${error.message}`, "error"); setUploading(false); return; }
      toast.show(`「${form.name}」を更新しました`, "success");
    }

    setUploading(false);
    closeModal();
    fetchAll();
  };

  const openVersionModal = (t: Template) => {
    setVersionModalTemplate(t);
    setNewVersionFile(null);
    // 現行版から次バージョン案を提案（"1.0" → "1.1"、"1.5" → "1.6"）
    const cur = getCurrent(t.id);
    if (cur) {
      const parts = cur.version.split(".").map(x => parseInt(x) || 0);
      if (parts.length >= 2) parts[parts.length - 1] += 1;
      else parts.push(1);
      setNewVersionStr(parts.join("."));
    } else {
      setNewVersionStr("1.0");
    }
    setNewVersionChangeNote("");
    setNewVersionEffectiveFrom(new Date().toISOString().slice(0, 10));
  };

  const closeVersionModal = () => {
    setVersionModalTemplate(null);
    setNewVersionFile(null); setNewVersionStr(""); setNewVersionChangeNote(""); setNewVersionEffectiveFrom("");
  };

  const addVersion = async () => {
    if (!versionModalTemplate || !newVersionFile) { toast.show("ファイルを選択してください", "error"); return; }
    if (!newVersionStr.trim()) { toast.show("バージョン番号を入力してください", "error"); return; }
    setUploading(true);
    const up = await uploadFile(newVersionFile, versionModalTemplate.id);
    if (!up) { setUploading(false); return; }
    const { error } = await supabase.from("document_template_versions").insert({
      template_id: versionModalTemplate.id,
      version: newVersionStr.trim(),
      file_url: up.publicUrl, file_path: up.path, file_name: newVersionFile.name,
      file_size: newVersionFile.size, mime_type: newVersionFile.type,
      change_note: newVersionChangeNote.trim(),
      effective_from: newVersionEffectiveFrom || null,
      is_current: true, // 新しいバージョンは自動で現行版に（DBトリガーで他はfalseに）
      uploaded_by_name: activeStaff?.name || "",
    });
    setUploading(false);
    if (error) { toast.show(`追加失敗: ${error.message}`, "error"); return; }
    toast.show(`v${newVersionStr} をアップロードしました`, "success");
    closeVersionModal();
    fetchAll();
  };

  const setAsCurrent = async (ver: TemplateVersion) => {
    const ok = await confirm({
      title: "現行版を切り替え", message: `v${ver.version} を現行版にします。既存の現行版は履歴として残ります。`,
      variant: "info", confirmLabel: "切り替え", cancelLabel: "キャンセル",
    });
    if (!ok) return;
    const { error } = await supabase.from("document_template_versions").update({ is_current: true }).eq("id", ver.id);
    if (error) { toast.show(`切り替え失敗: ${error.message}`, "error"); return; }
    toast.show(`v${ver.version} を現行版にしました`, "success");
    fetchAll();
  };

  const deleteVersion = async (ver: TemplateVersion) => {
    const ok = await confirm({
      title: "バージョンを削除", message: `v${ver.version} を完全に削除します。ファイルもStorageから削除されます。元に戻せません。`,
      variant: "danger", confirmLabel: "削除する", cancelLabel: "キャンセル",
    });
    if (!ok) return;
    if (ver.file_path) await supabase.storage.from("document-templates").remove([ver.file_path]);
    const { error } = await supabase.from("document_template_versions").delete().eq("id", ver.id);
    if (error) { toast.show(`削除失敗: ${error.message}`, "error"); return; }
    toast.show("削除しました", "success");
    fetchAll();
  };

  const archiveTemplate = async (t: Template) => {
    const ok = await confirm({
      title: "テンプレートをアーカイブ", message: `「${t.name}」をアーカイブします。過去のバージョン履歴は保持されます。`,
      variant: "warning", confirmLabel: "アーカイブ", cancelLabel: "キャンセル",
    });
    if (!ok) return;
    const { error } = await supabase.from("document_templates").update({ status: "archived" }).eq("id", t.id);
    if (error) { toast.show(`失敗: ${error.message}`, "error"); return; }
    toast.show("アーカイブしました", "success");
    fetchAll();
  };

  const unarchiveTemplate = async (t: Template) => {
    const { error } = await supabase.from("document_templates").update({ status: "active" }).eq("id", t.id);
    if (error) { toast.show(`失敗: ${error.message}`, "error"); return; }
    toast.show("復元しました", "success");
    fetchAll();
  };

  const hardDeleteTemplate = async (t: Template) => {
    const ok = await confirm({
      title: "テンプレートを完全削除", message: `「${t.name}」と全バージョンを完全削除します。Storageのファイルも削除されます。元に戻せません。`,
      variant: "danger", confirmLabel: "削除する", cancelLabel: "キャンセル",
    });
    if (!ok) return;
    // バージョン側のファイルをStorageから削除
    const vers = versionsByTemplate[t.id] || [];
    const paths = vers.map(v => v.file_path).filter(Boolean);
    if (paths.length > 0) await supabase.storage.from("document-templates").remove(paths);
    // テーブル削除（CASCADE で versions も消える）
    const { error } = await supabase.from("document_templates").delete().eq("id", t.id);
    if (error) { toast.show(`削除失敗: ${error.message}`, "error"); return; }
    toast.show("完全削除しました", "success");
    fetchAll();
  };

  const fmtBytes = (n: number) => {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / 1024 / 1024).toFixed(1)} MB`;
  };

  const inputStyle: React.CSSProperties = { backgroundColor: T.cardAlt, border: `1px solid ${T.border}`, color: T.text };

  // 統計
  const activeCount = templates.filter(t => t.status === "active").length;
  const totalVersions = (Object.values(versionsByTemplate) as TemplateVersion[][]).reduce((a, arr) => a + arr.length, 0);

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", animation: "fadeIn 0.3s" }}>
      {ConfirmModalNode}

      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-[16px] font-medium">📋 書類テンプレート管理</h2>
          <p className="text-[10px] mt-0.5" style={{ color: T.textMuted }}>契約書・誓約書などのテンプレートをバージョン管理</p>
        </div>
        <button onClick={openAdd} className="px-4 py-2 rounded-xl text-[12px] cursor-pointer font-medium text-white" style={{ backgroundColor: "#c3a782" }}>+ テンプレートを追加</button>
      </div>

      {/* サマリー */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div className="rounded-xl p-4 border" style={{ backgroundColor: T.card, borderColor: T.border }}>
          <p className="text-[10px] mb-1" style={{ color: T.textMuted }}>テンプレ数（稼働中）</p>
          <p className="text-[20px] font-medium">{activeCount}</p>
        </div>
        <div className="rounded-xl p-4 border" style={{ backgroundColor: T.card, borderColor: T.border }}>
          <p className="text-[10px] mb-1" style={{ color: T.textMuted }}>総バージョン数</p>
          <p className="text-[20px] font-medium" style={{ color: "#c3a782" }}>{totalVersions}</p>
        </div>
        <div className="rounded-xl p-4 border" style={{ backgroundColor: T.card, borderColor: T.border }}>
          <p className="text-[10px] mb-1" style={{ color: T.textMuted }}>カテゴリ数</p>
          <p className="text-[20px] font-medium">{new Set(templates.filter(t => t.status === "active").map(t => t.category)).size}</p>
        </div>
        <div className="rounded-xl p-4 border" style={{ backgroundColor: T.card, borderColor: T.border }}>
          <p className="text-[10px] mb-1" style={{ color: T.textMuted }}>アーカイブ</p>
          <p className="text-[20px] font-medium" style={{ color: "#888780" }}>{templates.filter(t => t.status === "archived").length}</p>
        </div>
      </div>

      {/* フィルタ */}
      <div className="rounded-xl border p-3 mb-3 flex items-center gap-3 flex-wrap" style={{ backgroundColor: T.card, borderColor: T.border }}>
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 テンプレ名・説明で検索" className="flex-1 min-w-[200px] px-3 py-2 rounded-lg text-[12px] outline-none" style={inputStyle} />
        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="px-3 py-2 rounded-lg text-[11px] outline-none cursor-pointer" style={inputStyle}>
          <option value="all">すべてのカテゴリ</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={targetFilter} onChange={e => setTargetFilter(e.target.value as any)} className="px-3 py-2 rounded-lg text-[11px] outline-none cursor-pointer" style={inputStyle}>
          <option value="all">すべての対象者</option>
          {Object.entries(TARGET_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <label className="flex items-center gap-1.5 text-[11px] cursor-pointer" style={{ color: T.textSub }}>
          <input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)} />
          アーカイブ表示
        </label>
      </div>

      {/* 一覧 */}
      <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: T.card, borderColor: T.border }}>
        {loading ? (
          <p className="text-[12px] text-center py-8" style={{ color: T.textMuted }}>読み込み中...</p>
        ) : filtered.length === 0 ? (
          <p className="text-[12px] text-center py-8" style={{ color: T.textFaint }}>該当するテンプレートがありません</p>
        ) : (
          <table className="w-full" style={{ fontSize: 12 }}>
            <thead style={{ backgroundColor: T.cardAlt, color: T.textSub, fontSize: 11 }}>
              <tr>
                <th style={{ padding: "8px 10px", textAlign: "left", borderBottom: `1px solid ${T.border}` }}>テンプレート名</th>
                <th style={{ padding: "8px 10px", textAlign: "left", borderBottom: `1px solid ${T.border}`, width: 110 }}>カテゴリ</th>
                <th style={{ padding: "8px 10px", textAlign: "left", borderBottom: `1px solid ${T.border}`, width: 120 }}>対象者</th>
                <th style={{ padding: "8px 10px", textAlign: "left", borderBottom: `1px solid ${T.border}`, width: 110 }}>現行版</th>
                <th style={{ padding: "8px 10px", textAlign: "left", borderBottom: `1px solid ${T.border}`, width: 110 }}>適用開始</th>
                <th style={{ padding: "8px 10px", textAlign: "center", borderBottom: `1px solid ${T.border}`, width: 200 }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t, i) => {
                const cur = getCurrent(t.id);
                const vCount = getVersionCount(t.id);
                const tgt = TARGET_LABELS[t.target_kind] || TARGET_LABELS.internal;
                return (
                  <tr key={t.id} style={{ borderTop: i === 0 ? "none" : `1px solid ${T.border}`, opacity: t.status === "archived" ? 0.5 : 1 }}>
                    <td style={{ padding: "8px 10px" }}>
                      <div style={{ fontWeight: 500 }}>{t.name}</div>
                      {t.description && <div className="text-[9px] mt-0.5" style={{ color: T.textFaint }}>{t.description}</div>}
                      {t.status === "archived" && <span className="text-[8px] px-1.5 py-0.5 rounded mt-0.5 inline-block" style={{ backgroundColor: "#88878018", color: "#888780" }}>アーカイブ</span>}
                    </td>
                    <td style={{ padding: "8px 10px", color: T.textSub, fontSize: 11 }}>{t.category}</td>
                    <td style={{ padding: "8px 10px" }}>
                      <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ backgroundColor: tgt.color + "18", color: tgt.color }}>{tgt.label}</span>
                    </td>
                    <td style={{ padding: "8px 10px" }}>
                      {cur ? (
                        <div>
                          <span className="text-[10px] px-1.5 py-0.5 rounded mr-1" style={{ backgroundColor: "#c3a78218", color: "#c3a782", fontFamily: "monospace" }}>v{cur.version}</span>
                          <span className="text-[9px]" style={{ color: T.textFaint }}>{vCount}版</span>
                        </div>
                      ) : (
                        <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "#c4555518", color: "#c45555" }}>ファイル未登録</span>
                      )}
                    </td>
                    <td style={{ padding: "8px 10px", color: T.textSub, fontSize: 11 }}>{cur?.effective_from || "—"}</td>
                    <td style={{ padding: "8px 10px", textAlign: "center" }}>
                      <div className="flex gap-1 justify-center flex-wrap">
                        {cur && (
                          <a href={cur.file_url} target="_blank" rel="noopener noreferrer" className="text-[10px] px-2 py-1 rounded cursor-pointer" style={{ backgroundColor: "#c3a78218", color: "#c3a782" }}>📥 DL</a>
                        )}
                        <button onClick={() => openVersionModal(t)} className="text-[10px] px-2 py-1 rounded cursor-pointer" style={{ backgroundColor: "#85a8c418", color: "#85a8c4" }}>📜 履歴</button>
                        <button onClick={() => openEdit(t)} className="text-[10px] px-2 py-1 rounded cursor-pointer border" style={{ borderColor: T.border, color: T.textSub }}>編集</button>
                        {t.status === "active" ? (
                          <button onClick={() => archiveTemplate(t)} className="text-[10px] px-2 py-1 rounded cursor-pointer" style={{ backgroundColor: "#f59e0b12", color: "#f59e0b" }}>🗃</button>
                        ) : (
                          <>
                            <button onClick={() => unarchiveTemplate(t)} className="text-[10px] px-2 py-1 rounded cursor-pointer" style={{ backgroundColor: "#22c55e12", color: "#22c55e" }}>↩</button>
                            <button onClick={() => hardDeleteTemplate(t)} className="text-[10px] px-2 py-1 rounded cursor-pointer" style={{ backgroundColor: "#c4555512", color: "#c45555" }}>削除</button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* 参考情報 */}
      <div className="rounded-xl p-4 mt-4" style={{ backgroundColor: "#c3a78210", border: "1px solid #c3a78233" }}>
        <p className="text-[11px] font-medium mb-1" style={{ color: "#c3a782" }}>💡 バージョン管理の使い方</p>
        <div className="text-[10px] leading-relaxed space-y-1" style={{ color: T.textSub }}>
          <p>• 法改正や社内規程変更で書類を更新する際は、「📜 履歴」から新バージョンをアップロード。</p>
          <p>• 過去のバージョンも保持されるので、「このセラピストと契約した時の契約書」の復元が可能。</p>
          <p>• 対応ファイル形式: PDF / Word / Excel / テキスト / 画像（最大10MB目安）。</p>
          <p>• 誤ってアップロードした場合は「📜 履歴」から個別削除可能。</p>
        </div>
      </div>

      {/* 追加・編集モーダル */}
      {modalMode !== "closed" && (
        <div onClick={closeModal} className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.4)" }}>
          <div onClick={e => e.stopPropagation()} className="rounded-2xl border p-6 w-full max-w-xl max-h-[90vh] overflow-y-auto animate-[fadeIn_0.25s]" style={{ backgroundColor: T.card, borderColor: T.border }}>
            <h2 className="text-[15px] font-medium mb-4">{modalMode === "add" ? "テンプレートを追加" : "テンプレートを編集"}</h2>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] mb-1" style={{ color: T.textSub }}>テンプレート名 *</label>
                <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="例: 業務委託契約書、誓約書、マイナンバー取扱同意書" className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] mb-1" style={{ color: T.textSub }}>カテゴリ</label>
                  <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none cursor-pointer" style={inputStyle}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] mb-1" style={{ color: T.textSub }}>対象者</label>
                  <select value={form.target_kind} onChange={e => setForm(f => ({ ...f, target_kind: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none cursor-pointer" style={inputStyle}>
                    {Object.entries(TARGET_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] mb-1" style={{ color: T.textSub }}>説明</label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} placeholder="どんな書類か、使用場面などをメモ" className="w-full px-3 py-2 rounded-xl text-[12px] outline-none resize-none" style={inputStyle} />
              </div>

              {/* 新規時のみ: 初回バージョンアップロード */}
              {modalMode === "add" && (
                <div className="rounded-xl p-4 space-y-2" style={{ backgroundColor: T.cardAlt, border: `1px solid ${T.border}` }}>
                  <p className="text-[11px] font-medium">📎 最初のバージョンをアップロード</p>
                  <div>
                    <label className="block text-[10px] mb-1" style={{ color: T.textMuted }}>ファイル *</label>
                    <input type="file" onChange={e => setInitialFile(e.target.files?.[0] || null)} accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.png,.jpg,.jpeg" className="w-full text-[11px]" style={{ color: T.text }} />
                    {initialFile && <p className="text-[9px] mt-1" style={{ color: T.textFaint }}>{initialFile.name} ({fmtBytes(initialFile.size)})</p>}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] mb-1" style={{ color: T.textMuted }}>バージョン番号</label>
                      <input type="text" value={initialVersion} onChange={e => setInitialVersion(e.target.value)} placeholder="1.0" className="w-full px-3 py-2 rounded-lg text-[12px] outline-none" style={{ ...inputStyle, backgroundColor: T.card, fontFamily: "monospace" }} />
                    </div>
                    <div>
                      <label className="block text-[10px] mb-1" style={{ color: T.textMuted }}>変更内容（任意）</label>
                      <input type="text" value={initialChangeNote} onChange={e => setInitialChangeNote(e.target.value)} placeholder="初版" className="w-full px-3 py-2 rounded-lg text-[12px] outline-none" style={{ ...inputStyle, backgroundColor: T.card }} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2 mt-5">
              <button onClick={closeModal} disabled={uploading} className="flex-1 px-4 py-2.5 rounded-xl text-[12px] cursor-pointer border" style={{ borderColor: T.border, color: T.textSub }}>キャンセル</button>
              <button onClick={save} disabled={uploading} className="flex-[2] px-4 py-2.5 rounded-xl text-[12px] cursor-pointer text-white font-medium" style={{ backgroundColor: "#c3a782", opacity: uploading ? 0.6 : 1 }}>{uploading ? "処理中..." : modalMode === "add" ? "追加する" : "保存する"}</button>
            </div>
          </div>
        </div>
      )}

      {/* バージョン履歴モーダル */}
      {versionModalTemplate && (
        <div onClick={closeVersionModal} className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.4)" }}>
          <div onClick={e => e.stopPropagation()} className="rounded-2xl border p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto animate-[fadeIn_0.25s]" style={{ backgroundColor: T.card, borderColor: T.border }}>
            <div className="mb-4">
              <h2 className="text-[15px] font-medium">📜 バージョン履歴</h2>
              <p className="text-[12px] mt-1" style={{ color: T.textMuted }}>{versionModalTemplate.name}</p>
            </div>

            {/* 新バージョンアップロード */}
            <div className="rounded-xl p-4 mb-4" style={{ backgroundColor: T.cardAlt, border: `1px solid ${T.border}` }}>
              <p className="text-[11px] font-medium mb-2">📎 新しいバージョンをアップロード</p>
              <div className="space-y-2">
                <input type="file" onChange={e => setNewVersionFile(e.target.files?.[0] || null)} accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.png,.jpg,.jpeg" className="w-full text-[11px]" style={{ color: T.text }} />
                {newVersionFile && <p className="text-[9px]" style={{ color: T.textFaint }}>{newVersionFile.name} ({fmtBytes(newVersionFile.size)})</p>}
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] mb-0.5" style={{ color: T.textMuted }}>バージョン *</label>
                    <input type="text" value={newVersionStr} onChange={e => setNewVersionStr(e.target.value)} placeholder="1.1" className="w-full px-2 py-1.5 rounded text-[12px] outline-none" style={{ ...inputStyle, backgroundColor: T.card, fontFamily: "monospace" }} />
                  </div>
                  <div>
                    <label className="block text-[10px] mb-0.5" style={{ color: T.textMuted }}>適用開始日</label>
                    <input type="date" value={newVersionEffectiveFrom} onChange={e => setNewVersionEffectiveFrom(e.target.value)} className="w-full px-2 py-1.5 rounded text-[12px] outline-none" style={{ ...inputStyle, backgroundColor: T.card }} />
                  </div>
                  <div>
                    <label className="block text-[10px] mb-0.5" style={{ color: T.textMuted }}>変更内容</label>
                    <input type="text" value={newVersionChangeNote} onChange={e => setNewVersionChangeNote(e.target.value)} placeholder="例: 税率改定に対応" className="w-full px-2 py-1.5 rounded text-[12px] outline-none" style={{ ...inputStyle, backgroundColor: T.card }} />
                  </div>
                </div>
                <button onClick={addVersion} disabled={uploading || !newVersionFile} className="w-full px-3 py-2 rounded-lg text-[11px] cursor-pointer text-white font-medium" style={{ backgroundColor: "#c3a782", opacity: uploading || !newVersionFile ? 0.5 : 1 }}>
                  {uploading ? "アップロード中..." : "🚀 アップロードして現行版にする"}
                </button>
              </div>
            </div>

            {/* 履歴一覧 */}
            <div className="space-y-2">
              {(versionsByTemplate[versionModalTemplate.id] || []).length === 0 ? (
                <p className="text-[11px] text-center py-4" style={{ color: T.textFaint }}>まだバージョンが登録されていません</p>
              ) : (
                (versionsByTemplate[versionModalTemplate.id] || []).sort((a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime()).map(ver => (
                  <div key={ver.id} className="rounded-xl p-3 border" style={{ backgroundColor: ver.is_current ? "#c3a78208" : T.card, borderColor: ver.is_current ? "#c3a78255" : T.border }}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[12px] font-medium px-2 py-0.5 rounded" style={{ backgroundColor: ver.is_current ? "#c3a78222" : T.cardAlt, color: ver.is_current ? "#c3a782" : T.text, fontFamily: "monospace" }}>v{ver.version}</span>
                        {ver.is_current && <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "#22c55e18", color: "#22c55e" }}>✓ 現行版</span>}
                        <span className="text-[10px]" style={{ color: T.textSub }}>{ver.file_name}</span>
                        <span className="text-[9px]" style={{ color: T.textFaint }}>{fmtBytes(ver.file_size)}</span>
                      </div>
                      <div className="flex gap-1">
                        <a href={ver.file_url} target="_blank" rel="noopener noreferrer" className="text-[10px] px-2 py-1 rounded cursor-pointer" style={{ backgroundColor: "#c3a78218", color: "#c3a782" }}>📥 DL</a>
                        {!ver.is_current && <button onClick={() => setAsCurrent(ver)} className="text-[10px] px-2 py-1 rounded cursor-pointer" style={{ backgroundColor: "#85a8c418", color: "#85a8c4" }}>現行版にする</button>}
                        <button onClick={() => deleteVersion(ver)} className="text-[10px] px-2 py-1 rounded cursor-pointer" style={{ backgroundColor: "#c4555512", color: "#c45555" }}>削除</button>
                      </div>
                    </div>
                    {ver.change_note && <p className="text-[10px] mt-1.5" style={{ color: T.textSub }}>📝 {ver.change_note}</p>}
                    <div className="flex items-center gap-3 mt-1 text-[9px]" style={{ color: T.textFaint }}>
                      {ver.effective_from && <span>適用開始: {ver.effective_from}</span>}
                      <span>アップロード: {new Date(ver.uploaded_at).toLocaleDateString("ja-JP")}{ver.uploaded_by_name ? ` by ${ver.uploaded_by_name}` : ""}</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="mt-5">
              <button onClick={closeVersionModal} className="w-full px-4 py-2.5 rounded-xl text-[12px] cursor-pointer border" style={{ borderColor: T.border, color: T.textSub }}>閉じる</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DocumentDeliveryManager({ T, activeStaff }: { T: any; activeStaff: any }) {
  type Recipient = {
    id: number;
    name: string;
    real_name: string | null;
    address: string | null;
    entry_date: string | null;
    login_email?: string | null;   // セラピストのみ
    email?: string | null;         // スタッフの場合
    status: string;
  };
  type Delivery = {
    id: number;
    recipient_kind: string;
    recipient_id: number;
    recipient_name: string;
    recipient_email: string;
    document_kind: string;
    target_year: number | null;
    subject: string;
    message: string;
    attachment_url: string;
    attachment_name: string;
    delivery_channel: string;
    status: string;
    error_message: string;
    delivered_at: string | null;
    batch_id: string | null;
    created_by_name: string;
    created_at: string;
  };

  const toast = useToast();
  const { confirm, ConfirmModalNode } = useConfirm();

  const [kind, setKind] = useState<"therapist" | "staff">("therapist");
  const [deliveryMode, setDeliveryMode] = useState<"payment" | "template">("payment");
  const [therapists, setTherapists] = useState<Recipient[]>([]);
  const [staffs, setStaffs] = useState<Recipient[]>([]);
  const [storeInfo, setStoreInfo] = useState<any>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [search, setSearch] = useState("");
  const [year, setYear] = useState(new Date().getFullYear() - 1); // 前年がデフォルト（年明けの配信想定）

  // テンプレ配信モード用
  const [templates, setTemplates] = useState<any[]>([]);
  const [templateVersions, setTemplateVersions] = useState<Record<number, any[]>>({});
  const [selectedTemplateId, setSelectedTemplateId] = useState<number>(0);
  const [selectedVersionId, setSelectedVersionId] = useState<number>(0);

  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number; success: number; failed: number } | null>(null);

  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [historyFilter, setHistoryFilter] = useState<"all" | "sent" | "failed" | "pending">("all");
  const [resending, setResending] = useState<number | null>(null);

  useEffect(() => { setSelectedIds([]); setSearch(""); setSelectedTemplateId(0); setSelectedVersionId(0); }, [kind]);
  useEffect(() => { setSelectedTemplateId(0); setSelectedVersionId(0); setSubject(""); setMessage(""); }, [deliveryMode]);

  const fetchAll = useCallback(async () => {
    const { data: th } = await supabase.from("therapists").select("id, name, real_name, address, entry_date, login_email, status").neq("status", "trash").order("sort_order");
    if (th) setTherapists(th as Recipient[]);
    const { data: st } = await supabase.from("staff").select("id, name, real_name, address, entry_date, email, status").neq("status", "trash").order("id");
    if (st) setStaffs(st as Recipient[]);
    const { data: si } = await supabase.from("stores").select("company_name, company_address, company_phone, representative_name");
    if (si?.[0]) setStoreInfo({
      company_name: si[0].company_name || "",
      company_address: si[0].company_address || "",
      company_phone: si[0].company_phone || "",
      representative: si[0].representative_name || "",
    });
    const { data: d } = await supabase.from("document_deliveries").select("*").order("created_at", { ascending: false }).limit(100);
    if (d) setDeliveries(d as Delivery[]);
    // テンプレート情報取得（稼働中のみ）
    const { data: tpls } = await supabase.from("document_templates").select("*").eq("status", "active").order("category").order("name");
    if (tpls) setTemplates(tpls);
    const { data: vers } = await supabase.from("document_template_versions").select("*").order("uploaded_at", { ascending: false });
    if (vers) {
      const grouped: Record<number, any[]> = {};
      (vers || []).forEach((v: any) => {
        if (!grouped[v.template_id]) grouped[v.template_id] = [];
        grouped[v.template_id].push(v);
      });
      setTemplateVersions(grouped);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const people = kind === "therapist" ? therapists : staffs;
  const filtered = people.filter(p => !search || p.name.includes(search) || (p.real_name || "").includes(search));

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };
  const selectAll = () => setSelectedIds(filtered.filter(p => p.status === "active").map(p => p.id));
  const clearAll = () => setSelectedIds([]);

  // 支払合計を取得（セラピスト/スタッフ別）
  const fetchPayment = async (personId: number, targetYear: number) => {
    const months: { month: number; amount: number; days: number }[] = [];
    if (kind === "therapist") {
      const { data: sett } = await supabase.from("therapist_daily_settlements").select("date, total_back").eq("therapist_id", personId).gte("date", `${targetYear}-01-01`).lte("date", `${targetYear}-12-31`);
      for (let m = 1; m <= 12; m++) {
        const ms = (sett || []).filter((s: any) => new Date(s.date).getMonth() + 1 === m);
        months.push({ month: m, amount: ms.reduce((a: number, s: any) => a + (s.total_back || 0), 0), days: ms.length });
      }
    } else {
      const { data: sch } = await supabase.from("staff_schedules").select("date, commission_fee, night_premium, license_premium").eq("staff_id", personId).eq("status", "completed").gte("date", `${targetYear}-01-01`).lte("date", `${targetYear}-12-31`);
      for (let m = 1; m <= 12; m++) {
        const ms = (sch || []).filter((s: any) => new Date(s.date).getMonth() + 1 === m);
        months.push({
          month: m,
          amount: ms.reduce((a: number, s: any) => a + (s.commission_fee || 0) + (s.night_premium || 0) + (s.license_premium || 0), 0),
          days: ms.length,
        });
      }
    }
    return { year: targetYear, totalGross: months.reduce((a, m) => a + m.amount, 0), totalDays: months.reduce((a, m) => a + m.days, 0), months };
  };

  // HTMLをStorageにアップロード → 公開URL取得
  const uploadHtml = async (htmlContent: string, fileName: string): Promise<{ url: string; path: string } | null> => {
    const blob = new Blob([htmlContent], { type: "text/html;charset=utf-8" });
    const path = `payment-certificates/${year}/${Date.now()}_${crypto.randomUUID()}.html`;
    const { error } = await supabase.storage.from("tax-documents").upload(path, blob, { upsert: false, contentType: "text/html" });
    if (error) return null;
    const { data } = supabase.storage.from("tax-documents").getPublicUrl(path);
    return { url: data.publicUrl, path };
  };

  // 単一対象への配信処理（共通ヘルパー。モードに関わらず使う）
  // attachmentUrl/Name と件名/本文は呼び出し側で事前に準備済みの想定
  const sendOneDelivery = async (
    recipient: Recipient,
    batchId: string,
    docKind: string,
    subj: string,
    msg: string,
    attachUrl: string,
    attachName: string,
    targetYear: number | null,
    templateIdFk: number | null,
    templateVersionIdFk: number | null,
  ): Promise<{ ok: boolean; error?: string }> => {
    const recipientEmail = (kind === "therapist" ? recipient.login_email : recipient.email) || "";
    try {
      // 配信ログを pending で先に作成
      const { data: delivery, error: de } = await supabase.from("document_deliveries").insert({
        recipient_kind: kind,
        recipient_id: recipient.id,
        recipient_name: recipient.real_name || recipient.name,
        recipient_email: recipientEmail,
        document_kind: docKind,
        document_template_id: templateIdFk,
        document_template_version_id: templateVersionIdFk,
        target_year: targetYear,
        subject: subj,
        message: msg,
        attachment_url: attachUrl,
        attachment_name: attachName,
        delivery_channel: kind === "therapist" ? "notification" : "email",
        status: "pending",
        batch_id: batchId,
        created_by_name: activeStaff?.name || "",
      }).select("id").single();
      if (de || !delivery) throw new Error(de?.message || "配信ログ作成失敗");

      if (kind === "therapist") {
        // セラピスト: マイページ通知
        const bodyWithLink = attachUrl
          ? `${msg}\n\n📎 ${attachName}\n${attachUrl}`
          : msg;
        const { error: ne } = await supabase.from("therapist_notifications").insert({
          title: subj, body: bodyWithLink, type: "info",
          target_therapist_id: recipient.id,
        });
        if (ne) throw new Error(ne.message);
        await supabase.from("document_deliveries")
          .update({ status: "sent", delivered_at: new Date().toISOString() })
          .eq("id", delivery.id);
      } else {
        // スタッフ: メール送信
        if (!recipientEmail) throw new Error("メールアドレスが登録されていません");
        const res = await fetch("/api/deliver-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: recipientEmail,
            subject: subj,
            body: msg,
            attachment_url: attachUrl,
            attachment_name: attachName,
            delivery_id: delivery.id,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "不明なエラー" }));
          throw new Error(err.error || "メール送信失敗");
        }
      }
      return { ok: true };
    } catch (e: any) {
      // エラー時も配信ログに記録
      await supabase.from("document_deliveries").insert({
        recipient_kind: kind,
        recipient_id: recipient.id,
        recipient_name: recipient.real_name || recipient.name,
        recipient_email: recipientEmail,
        document_kind: docKind,
        document_template_id: templateIdFk,
        document_template_version_id: templateVersionIdFk,
        target_year: targetYear,
        subject: subj,
        message: msg,
        attachment_url: attachUrl,
        attachment_name: attachName,
        delivery_channel: kind === "therapist" ? "notification" : "email",
        status: "failed",
        error_message: (e.message || String(e)).slice(0, 500),
        batch_id: batchId,
        created_by_name: activeStaff?.name || "",
      });
      return { ok: false, error: e.message || String(e) };
    }
  };

  // 一括配信実行
  const executeDelivery = async () => {
    if (selectedIds.length === 0) { toast.show("配信対象を選択してください", "error"); return; }
    if (!subject.trim()) { toast.show("件名を入力してください", "error"); return; }

    if (deliveryMode === "payment" && !storeInfo) {
      toast.show("会社情報が読み込めていません", "error"); return;
    }

    // テンプレモードの事前チェック
    let selectedTemplate: any = null;
    let selectedVersion: any = null;
    if (deliveryMode === "template") {
      if (!selectedTemplateId) { toast.show("配信するテンプレートを選択してください", "error"); return; }
      if (!selectedVersionId) { toast.show("使用するバージョンを選択してください", "error"); return; }
      selectedTemplate = templates.find(t => t.id === selectedTemplateId);
      selectedVersion = (templateVersions[selectedTemplateId] || []).find((v: any) => v.id === selectedVersionId);
      if (!selectedTemplate || !selectedVersion) { toast.show("選択したテンプレート情報が見つかりません", "error"); return; }
    }

    const modeLabel = deliveryMode === "payment" ? `${year}年分 支払調書` : `「${selectedTemplate?.name}」v${selectedVersion?.version}`;
    const ok = await confirm({
      title: `${selectedIds.length}名に配信しますか？`,
      message: `配信内容: ${modeLabel}\n配信チャネル: ${kind === "therapist" ? "📱 マイページ通知" : "📧 メール送信"}\n\n実行すると全員に一斉に配信されます。この操作は取り消せません。`,
      variant: "warning",
      confirmLabel: `${selectedIds.length}名に配信`,
      cancelLabel: "キャンセル",
    });
    if (!ok) return;

    setSending(true);
    const batchId = crypto.randomUUID();
    const targets = people.filter(p => selectedIds.includes(p.id));
    setProgress({ current: 0, total: targets.length, success: 0, failed: 0 });

    let successCount = 0;
    let failedCount = 0;

    for (let i = 0; i < targets.length; i++) {
      const p = targets[i];
      setProgress({ current: i + 1, total: targets.length, success: successCount, failed: failedCount });

      if (deliveryMode === "payment") {
        // ===== 支払調書モード =====
        try {
          const payment = await fetchPayment(p.id, year);
          const th = { real_name: p.real_name || p.name, name: p.name, address: p.address || "", entry_date: p.entry_date || "" };
          const html = generatePaymentCertificateHtml(storeInfo, th, payment, kind);
          const up = await uploadHtml(html, `支払調書_${year}_${p.real_name || p.name}.html`);
          if (!up) throw new Error("Storageアップロード失敗");
          const attachName = `支払調書_${year}_${p.real_name || p.name}.html`;
          const defaultMsg = kind === "therapist"
            ? `${year}年分の支払調書をお送りいたします。詳細は添付ファイルをご確認ください。`
            : `${p.real_name || p.name} 様\n\n${year}年分の支払調書をお送りいたします。\nリンクをクリックして内容をご確認ください。必要に応じて印刷・PDF保存してください。`;
          const r = await sendOneDelivery(
            p, batchId, "payment_certificate",
            subject.trim(), message.trim() || defaultMsg,
            up.url, attachName, year, null, null,
          );
          if (r.ok) successCount++; else failedCount++;
        } catch (e: any) {
          failedCount++;
          // HTML生成・アップロード失敗時も失敗ログ記録
          await supabase.from("document_deliveries").insert({
            recipient_kind: kind, recipient_id: p.id,
            recipient_name: p.real_name || p.name,
            recipient_email: (kind === "therapist" ? p.login_email : p.email) || "",
            document_kind: "payment_certificate",
            target_year: year, subject: subject.trim(), message: message.trim(),
            delivery_channel: kind === "therapist" ? "notification" : "email",
            status: "failed", error_message: (e.message || String(e)).slice(0, 500),
            batch_id: batchId, created_by_name: activeStaff?.name || "",
          });
        }
      } else {
        // ===== テンプレ配信モード =====
        const attachName = `${selectedTemplate.name}_v${selectedVersion.version}_${selectedVersion.file_name}`;
        const defaultMsg = kind === "therapist"
          ? `${selectedTemplate.name}（v${selectedVersion.version}）をお送りします。添付のリンクからダウンロードしてください。`
          : `${p.real_name || p.name} 様\n\n${selectedTemplate.name}（v${selectedVersion.version}）をお送りします。\n添付のリンクからダウンロードしてください。`;
        const r = await sendOneDelivery(
          p, batchId, "template",
          subject.trim(), message.trim() || defaultMsg,
          selectedVersion.file_url, attachName, null,
          selectedTemplate.id, selectedVersion.id,
        );
        if (r.ok) successCount++; else failedCount++;
      }
    }

    setProgress({ current: targets.length, total: targets.length, success: successCount, failed: failedCount });
    setSending(false);
    toast.show(`配信完了: 成功 ${successCount}件 / 失敗 ${failedCount}件`, failedCount === 0 ? "success" : "error");
    setSelectedIds([]);
    await fetchAll();
  };

  // 配信履歴から再送
  const resendDelivery = async (d: Delivery) => {
    const ok = await confirm({
      title: "この配信を再送しますか？",
      message: `対象: ${d.recipient_name}\n内容: ${d.subject}\nチャネル: ${d.delivery_channel === "email" ? "📧 メール送信" : "📱 マイページ通知"}\n\n新しい配信として記録されます（元の履歴は残ります）。`,
      variant: "info",
      confirmLabel: "再送する",
      cancelLabel: "キャンセル",
    });
    if (!ok) return;
    setResending(d.id);
    const batchId = crypto.randomUUID();
    const originalKind = kind;
    // 一時的に配信先の種別に切り替える（セラピスト履歴からの再送ならtherapistにする必要あり）
    // ただし sendOneDelivery は kind state に依存しているので、ここで切り替える
    const needKindSwitch = d.recipient_kind !== kind;
    if (needKindSwitch) setKind(d.recipient_kind as "therapist" | "staff");

    // state 切替は非同期なので、recipient を改めて取得
    // d.recipient_kind を信じて直接処理するために、擬似recipientを作る
    const pseudo: Recipient = d.recipient_kind === "therapist"
      ? ({
          id: d.recipient_id, name: d.recipient_name, real_name: d.recipient_name,
          address: null, entry_date: null, login_email: d.recipient_email, status: "active",
        } as any)
      : ({
          id: d.recipient_id, name: d.recipient_name, real_name: d.recipient_name,
          address: null, entry_date: null, email: d.recipient_email, status: "active",
        } as any);

    // 直接 supabase で再送処理（sendOneDelivery は kind state を見るので使えない）
    try {
      if (d.recipient_kind === "therapist") {
        const bodyWithLink = d.attachment_url
          ? `${d.message}\n\n📎 ${d.attachment_name}\n${d.attachment_url}`
          : d.message;
        const { data: newDelivery, error: de } = await supabase.from("document_deliveries").insert({
          recipient_kind: "therapist", recipient_id: d.recipient_id,
          recipient_name: d.recipient_name, recipient_email: d.recipient_email,
          document_kind: d.document_kind, target_year: d.target_year,
          subject: d.subject, message: d.message,
          attachment_url: d.attachment_url, attachment_name: d.attachment_name,
          delivery_channel: "notification", status: "pending",
          batch_id: batchId, created_by_name: activeStaff?.name || "",
        }).select("id").single();
        if (de || !newDelivery) throw new Error(de?.message || "配信ログ作成失敗");
        const { error: ne } = await supabase.from("therapist_notifications").insert({
          title: d.subject, body: bodyWithLink, type: "info",
          target_therapist_id: d.recipient_id,
        });
        if (ne) throw new Error(ne.message);
        await supabase.from("document_deliveries")
          .update({ status: "sent", delivered_at: new Date().toISOString() })
          .eq("id", newDelivery.id);
        toast.show(`${d.recipient_name} に再送しました`, "success");
      } else {
        if (!d.recipient_email) throw new Error("メールアドレスが記録されていません");
        const { data: newDelivery, error: de } = await supabase.from("document_deliveries").insert({
          recipient_kind: "staff", recipient_id: d.recipient_id,
          recipient_name: d.recipient_name, recipient_email: d.recipient_email,
          document_kind: d.document_kind, target_year: d.target_year,
          subject: d.subject, message: d.message,
          attachment_url: d.attachment_url, attachment_name: d.attachment_name,
          delivery_channel: "email", status: "pending",
          batch_id: batchId, created_by_name: activeStaff?.name || "",
        }).select("id").single();
        if (de || !newDelivery) throw new Error(de?.message || "配信ログ作成失敗");
        const res = await fetch("/api/deliver-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: d.recipient_email, subject: d.subject, body: d.message,
            attachment_url: d.attachment_url, attachment_name: d.attachment_name,
            delivery_id: newDelivery.id,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "不明なエラー" }));
          throw new Error(err.error || "メール送信失敗");
        }
        toast.show(`${d.recipient_name} に再送しました`, "success");
      }
    } catch (e: any) {
      toast.show(`再送失敗: ${e.message}`, "error");
      await supabase.from("document_deliveries").insert({
        recipient_kind: d.recipient_kind, recipient_id: d.recipient_id,
        recipient_name: d.recipient_name, recipient_email: d.recipient_email,
        document_kind: d.document_kind, target_year: d.target_year,
        subject: d.subject, message: d.message,
        attachment_url: d.attachment_url, attachment_name: d.attachment_name,
        delivery_channel: d.delivery_channel, status: "failed",
        error_message: (e.message || String(e)).slice(0, 500),
        batch_id: batchId, created_by_name: activeStaff?.name || "",
      });
    }
    if (needKindSwitch) setKind(originalKind);
    setResending(null);
    fetchAll();
  };

  const filteredDeliveries = deliveries.filter(d => historyFilter === "all" || d.status === historyFilter);

  const DOC_KIND_LABELS: Record<string, string> = {
    payment_certificate: "💰 支払調書",
    contract_certificate: "📝 業務委託契約証明",
    transaction_certificate: "📊 取引実績証明",
    template: "📋 テンプレート",
    custom: "✉️ カスタム",
  };
  const STATUS_LABELS: Record<string, { label: string; color: string }> = {
    pending: { label: "送信中", color: "#f59e0b" },
    sent: { label: "✓ 送信済", color: "#22c55e" },
    failed: { label: "✕ 失敗", color: "#c45555" },
  };

  const inputStyle: React.CSSProperties = { backgroundColor: T.cardAlt, border: `1px solid ${T.border}`, color: T.text };

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", animation: "fadeIn 0.3s" }}>
      {ConfirmModalNode}

      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-[16px] font-medium">📨 書類の一括配信</h2>
          <p className="text-[10px] mt-0.5" style={{ color: T.textMuted }}>支払調書などの個人向け書類を複数人に一斉送信</p>
        </div>
        <div className="flex items-center gap-3">
          {deliveryMode === "payment" && (
            <label className="flex items-center gap-2 text-[11px]" style={{ color: T.textSub }}>
              対象年度
              <select value={year} onChange={e => setYear(Number(e.target.value))} className="px-2 py-1 rounded-lg text-[11px] outline-none cursor-pointer" style={inputStyle}>
                {[2026, 2025, 2024, 2023].map(y => <option key={y} value={y}>{y}年</option>)}
              </select>
            </label>
          )}
        </div>
      </div>

      {/* 配信対象タブ */}
      <div className="flex items-center gap-1 mb-3">
        {([["therapist", "💆 セラピストへ（マイページ通知）"], ["staff", "👥 スタッフへ（メール送信）"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setKind(k as any)} disabled={sending} className="px-4 py-2 rounded-xl text-[11px] cursor-pointer font-medium" style={{ backgroundColor: kind === k ? "#c3a78218" : "transparent", color: kind === k ? "#c3a782" : T.textMuted, border: `1px solid ${kind === k ? "#c3a78244" : T.border}`, opacity: sending ? 0.5 : 1 }}>{l}</button>
        ))}
      </div>

      {/* 配信モード切替 */}
      <div className="flex items-center gap-1 mb-4">
        <span className="text-[10px] mr-2" style={{ color: T.textMuted }}>配信内容:</span>
        {([["payment", "💰 支払調書（自動生成）"], ["template", "📋 書類テンプレート"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setDeliveryMode(k as any)} disabled={sending} className="px-3 py-1.5 rounded-lg text-[11px] cursor-pointer" style={{ backgroundColor: deliveryMode === k ? "#85a8c418" : "transparent", color: deliveryMode === k ? "#85a8c4" : T.textMuted, border: `1px solid ${deliveryMode === k ? "#85a8c444" : T.border}`, opacity: sending ? 0.5 : 1 }}>{l}</button>
        ))}
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: "380px 1fr" }}>
        {/* 対象者選択 */}
        <div className="rounded-xl border p-4" style={{ backgroundColor: T.card, borderColor: T.border }}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] font-medium">配信対象（{selectedIds.length}名選択中）</p>
            <div className="flex gap-1">
              <button onClick={selectAll} disabled={sending} className="text-[9px] px-2 py-0.5 rounded cursor-pointer" style={{ backgroundColor: "#c3a78218", color: "#c3a782" }}>全選択</button>
              <button onClick={clearAll} disabled={sending} className="text-[9px] px-2 py-0.5 rounded cursor-pointer" style={{ color: T.textFaint, backgroundColor: T.cardAlt }}>クリア</button>
            </div>
          </div>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 名前で検索" className="w-full px-3 py-2 rounded-lg text-[11px] outline-none mb-3" style={inputStyle} />
          <div className="space-y-1 overflow-y-auto" style={{ maxHeight: 380 }}>
            {filtered.length === 0 && <p className="text-[10px] text-center py-6" style={{ color: T.textFaint }}>該当者なし</p>}
            {filtered.map(p => {
              const email = kind === "therapist" ? p.login_email : p.email;
              const canDeliver = kind === "therapist" ? true : !!email;
              return (
                <label key={p.id} className="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer text-[11px]" style={{ backgroundColor: selectedIds.includes(p.id) ? "#c3a78215" : "transparent", opacity: canDeliver ? 1 : 0.4 }}>
                  <input type="checkbox" checked={selectedIds.includes(p.id)} onChange={() => toggleSelect(p.id)} disabled={!canDeliver || sending} />
                  <span style={{ fontWeight: 500 }}>{p.name}</span>
                  {p.real_name && p.real_name !== p.name && <span className="text-[9px]" style={{ color: T.textFaint }}>({p.real_name})</span>}
                  <span className="ml-auto text-[8px]" style={{ color: email ? T.textSub : "#c45555" }}>
                    {kind === "therapist" ? "📱" : (email ? "📧" : "📧なし")}
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        {/* メッセージ編集と配信実行 */}
        <div className="space-y-3">
          <div className="rounded-xl border p-4" style={{ backgroundColor: T.card, borderColor: T.border }}>
            <p className="text-[11px] font-medium mb-3">📝 配信内容（全員に同じ内容が送信されます）</p>
            <div className="space-y-2">
              {/* テンプレ配信モード: テンプレート選択UI */}
              {deliveryMode === "template" && (() => {
                const eligibleTemplates = templates.filter(t => t.target_kind === kind || t.target_kind === "both");
                const availableVersions = selectedTemplateId ? (templateVersions[selectedTemplateId] || []) : [];
                return (
                  <div className="rounded-lg p-3 space-y-2" style={{ backgroundColor: T.cardAlt, border: `1px solid ${T.border}` }}>
                    <p className="text-[10px] font-medium" style={{ color: T.textSub }}>📋 配信する書類テンプレート</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] mb-0.5" style={{ color: T.textMuted }}>テンプレート</label>
                        <select value={selectedTemplateId} onChange={e => { setSelectedTemplateId(Number(e.target.value)); setSelectedVersionId(0); }} className="w-full px-2 py-1.5 rounded text-[12px] outline-none cursor-pointer" style={{ ...inputStyle, backgroundColor: T.card }}>
                          <option value={0}>— 選択してください —</option>
                          {eligibleTemplates.length === 0 && <option value={0} disabled>対象{kind === "therapist" ? "セラピスト" : "スタッフ"}向けのテンプレなし</option>}
                          {eligibleTemplates.map(t => (
                            <option key={t.id} value={t.id}>{t.category}: {t.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] mb-0.5" style={{ color: T.textMuted }}>使用バージョン</label>
                        <select value={selectedVersionId} onChange={e => setSelectedVersionId(Number(e.target.value))} disabled={!selectedTemplateId} className="w-full px-2 py-1.5 rounded text-[12px] outline-none cursor-pointer" style={{ ...inputStyle, backgroundColor: T.card, opacity: selectedTemplateId ? 1 : 0.5 }}>
                          <option value={0}>— バージョンを選択 —</option>
                          {availableVersions.map((v: any) => (
                            <option key={v.id} value={v.id}>v{v.version}{v.is_current ? "（現行版）" : ""}{v.effective_from ? ` - ${v.effective_from}〜` : ""}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    {selectedTemplateId > 0 && availableVersions.length === 0 && (
                      <p className="text-[9px]" style={{ color: "#c45555" }}>⚠ このテンプレートにはまだファイルがアップロードされていません。</p>
                    )}
                    {eligibleTemplates.length === 0 && (
                      <p className="text-[9px]" style={{ color: T.textFaint }}>💡 バックオフィス →「📋 書類テンプレ」から {kind === "therapist" ? "セラピスト" : "スタッフ"} 向けまたは両方向けのテンプレを登録すると表示されます。</p>
                    )}
                  </div>
                );
              })()}

              <div>
                <label className="block text-[10px] mb-1" style={{ color: T.textSub }}>件名 *</label>
                <input type="text" value={subject} onChange={e => setSubject(e.target.value)} placeholder={deliveryMode === "payment" ? `例: ${year}年分 支払調書のご送付` : `例: 新しい業務委託契約書のご送付`} className="w-full px-3 py-2 rounded-lg text-[12px] outline-none" style={inputStyle} />
                <div className="flex gap-1 mt-1 flex-wrap">
                  {deliveryMode === "payment" ? (
                    <>
                      <button onClick={() => setSubject(`【重要】${year}年分 支払調書のご送付`)} className="text-[9px] px-2 py-0.5 rounded cursor-pointer" style={{ backgroundColor: T.cardAlt, color: T.textMuted }}>テンプレ: 重要</button>
                      <button onClick={() => setSubject(`${year}年分 報酬支払証明書のご案内`)} className="text-[9px] px-2 py-0.5 rounded cursor-pointer" style={{ backgroundColor: T.cardAlt, color: T.textMuted }}>テンプレ: 通常</button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => { const t = templates.find(x => x.id === selectedTemplateId); if (t) setSubject(`【重要】${t.name}のご送付`); }} disabled={!selectedTemplateId} className="text-[9px] px-2 py-0.5 rounded cursor-pointer" style={{ backgroundColor: T.cardAlt, color: T.textMuted, opacity: selectedTemplateId ? 1 : 0.5 }}>テンプレ: 重要</button>
                      <button onClick={() => { const t = templates.find(x => x.id === selectedTemplateId); if (t) setSubject(`${t.name}をお送りします`); }} disabled={!selectedTemplateId} className="text-[9px] px-2 py-0.5 rounded cursor-pointer" style={{ backgroundColor: T.cardAlt, color: T.textMuted, opacity: selectedTemplateId ? 1 : 0.5 }}>テンプレ: 通常</button>
                    </>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-[10px] mb-1" style={{ color: T.textSub }}>本文</label>
                <textarea value={message} onChange={e => setMessage(e.target.value)} rows={6} placeholder={deliveryMode === "payment" ? `${year}年分の支払調書をお送りいたします。\n添付のリンクから内容をご確認ください。\n確定申告の際にご利用ください。\n\nご不明な点がございましたらお気軽にお問い合わせください。` : `お世話になっております。\n最新版の書類をお送りいたします。\nご確認のほどよろしくお願いいたします。`} className="w-full px-3 py-2 rounded-lg text-[12px] outline-none resize-none" style={inputStyle} />
                <p className="text-[9px] mt-1" style={{ color: T.textFaint }}>💡 空欄の場合は既定の文面が自動挿入されます。{kind === "staff" ? "メール末尾に添付リンクが自動付与されます。" : "通知末尾にファイルURLが自動付与されます。"}</p>
              </div>
            </div>
          </div>

          {/* 進捗表示 */}
          {progress && (
            <div className="rounded-xl border p-4" style={{ backgroundColor: T.card, borderColor: T.border }}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-medium">{sending ? "⏳ 配信中..." : "✅ 配信完了"}</p>
                <p className="text-[10px]" style={{ color: T.textMuted }}>{progress.current} / {progress.total}</p>
              </div>
              <div className="w-full h-2 rounded overflow-hidden mb-2" style={{ backgroundColor: T.cardAlt }}>
                <div style={{ width: `${(progress.current / progress.total) * 100}%`, height: "100%", backgroundColor: "#c3a782", transition: "width 0.3s" }} />
              </div>
              <div className="flex gap-4 text-[10px]" style={{ color: T.textSub }}>
                <span style={{ color: "#22c55e" }}>✓ 成功 {progress.success}</span>
                {progress.failed > 0 && <span style={{ color: "#c45555" }}>✕ 失敗 {progress.failed}</span>}
              </div>
            </div>
          )}

          {/* 実行ボタン */}
          <div className="rounded-xl border p-4" style={{ backgroundColor: T.card, borderColor: T.border }}>
            {(() => {
              const tplMissing = deliveryMode === "template" && (!selectedTemplateId || !selectedVersionId);
              const disabled = sending || selectedIds.length === 0 || !subject.trim() || tplMissing;
              const selTpl = deliveryMode === "template" ? templates.find(t => t.id === selectedTemplateId) : null;
              const selVer = deliveryMode === "template" && selectedTemplateId ? (templateVersions[selectedTemplateId] || []).find((v: any) => v.id === selectedVersionId) : null;
              const label = deliveryMode === "payment"
                ? `🚀 ${selectedIds.length}名に${year}年分 支払調書を配信`
                : (selTpl && selVer ? `🚀 ${selectedIds.length}名に「${selTpl.name}」v${selVer.version} を配信` : `🚀 ${selectedIds.length}名に配信`);
              return (
                <button onClick={executeDelivery} disabled={disabled} className="w-full px-6 py-3 rounded-xl text-[13px] cursor-pointer text-white font-medium" style={{ backgroundColor: "#c3a782", opacity: disabled ? 0.4 : 1 }}>
                  {sending ? "配信中..." : label}
                </button>
              );
            })()}
            <p className="text-[9px] mt-2 text-center" style={{ color: T.textFaint }}>
              {kind === "therapist"
                ? `セラピストのマイページに通知が届き、リンクから${deliveryMode === "payment" ? "支払調書" : "ファイル"}を閲覧できます`
                : `スタッフの登録メールアドレスに本文とリンクが送信されます`}
            </p>
          </div>
        </div>
      </div>

      {/* 配信履歴 */}
      <div className="mt-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[13px] font-medium">📋 配信履歴（直近100件）</h3>
          <div className="flex items-center gap-1 rounded border p-0.5" style={{ borderColor: T.border }}>
            {([["all", "全て"], ["sent", "✓送信済"], ["failed", "✕失敗"], ["pending", "送信中"]] as const).map(([k, l]) => (
              <button key={k} onClick={() => setHistoryFilter(k)} className="px-2 py-0.5 rounded text-[10px] cursor-pointer" style={{ backgroundColor: historyFilter === k ? "#c3a78218" : "transparent", color: historyFilter === k ? "#c3a782" : T.textMuted }}>{l}</button>
            ))}
          </div>
        </div>
        <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: T.card, borderColor: T.border }}>
          {filteredDeliveries.length === 0 ? (
            <p className="text-[11px] text-center py-6" style={{ color: T.textFaint }}>配信履歴がまだありません</p>
          ) : (
            <table className="w-full" style={{ fontSize: 11 }}>
              <thead style={{ backgroundColor: T.cardAlt, color: T.textSub, fontSize: 10 }}>
                <tr>
                  <th style={{ padding: "6px 10px", textAlign: "left", borderBottom: `1px solid ${T.border}` }}>日時</th>
                  <th style={{ padding: "6px 10px", textAlign: "left", borderBottom: `1px solid ${T.border}` }}>対象</th>
                  <th style={{ padding: "6px 10px", textAlign: "left", borderBottom: `1px solid ${T.border}` }}>書類</th>
                  <th style={{ padding: "6px 10px", textAlign: "left", borderBottom: `1px solid ${T.border}` }}>件名</th>
                  <th style={{ padding: "6px 10px", textAlign: "center", borderBottom: `1px solid ${T.border}`, width: 90 }}>状態</th>
                  <th style={{ padding: "6px 10px", textAlign: "center", borderBottom: `1px solid ${T.border}`, width: 70 }}>添付</th>
                  <th style={{ padding: "6px 10px", textAlign: "center", borderBottom: `1px solid ${T.border}`, width: 80 }}>再送</th>
                </tr>
              </thead>
              <tbody>
                {filteredDeliveries.map(d => {
                  const st = STATUS_LABELS[d.status] || STATUS_LABELS.pending;
                  const dt = new Date(d.created_at);
                  const canResend = d.status !== "pending" && !!d.attachment_url;
                  return (
                    <tr key={d.id} style={{ borderTop: `1px solid ${T.border}` }}>
                      <td style={{ padding: "6px 10px", color: T.textSub, fontSize: 10, whiteSpace: "nowrap" }}>
                        {dt.getMonth() + 1}/{dt.getDate()} {String(dt.getHours()).padStart(2, "0")}:{String(dt.getMinutes()).padStart(2, "0")}
                      </td>
                      <td style={{ padding: "6px 10px" }}>
                        <span>{d.recipient_name}</span>
                        <span className="text-[9px] ml-1" style={{ color: T.textFaint }}>
                          {d.delivery_channel === "email" ? "📧" : "📱"}
                        </span>
                      </td>
                      <td style={{ padding: "6px 10px", color: T.textSub, fontSize: 10 }}>
                        {DOC_KIND_LABELS[d.document_kind] || d.document_kind}
                        {d.target_year && <span className="text-[9px] ml-1" style={{ color: T.textFaint }}>({d.target_year}年)</span>}
                      </td>
                      <td style={{ padding: "6px 10px", color: T.textSub, fontSize: 10 }}>{d.subject}</td>
                      <td style={{ padding: "6px 10px", textAlign: "center" }}>
                        <span className="text-[9px] px-2 py-0.5 rounded" style={{ backgroundColor: st.color + "18", color: st.color }} title={d.error_message || ""}>
                          {st.label}
                        </span>
                      </td>
                      <td style={{ padding: "6px 10px", textAlign: "center" }}>
                        {d.attachment_url ? (
                          <a href={d.attachment_url} target="_blank" rel="noopener noreferrer" className="text-[10px] px-2 py-0.5 rounded cursor-pointer" style={{ backgroundColor: "#c3a78218", color: "#c3a782" }}>開く</a>
                        ) : "—"}
                      </td>
                      <td style={{ padding: "6px 10px", textAlign: "center" }}>
                        {canResend ? (
                          <button onClick={() => resendDelivery(d)} disabled={resending === d.id} className="text-[10px] px-2 py-0.5 rounded cursor-pointer" style={{ backgroundColor: "#85a8c418", color: "#85a8c4", opacity: resending === d.id ? 0.5 : 1 }} title="同じ内容で再送信">
                            {resending === d.id ? "..." : "🔄 再送"}
                          </button>
                        ) : (
                          <span className="text-[9px]" style={{ color: T.textFaint }}>—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* 注意事項 */}
      <div className="rounded-xl p-4 mt-4" style={{ backgroundColor: "#c3a78210", border: "1px solid #c3a78233" }}>
        <p className="text-[11px] font-medium mb-1" style={{ color: "#c3a782" }}>💡 一括配信の使い方</p>
        <div className="text-[10px] leading-relaxed space-y-1" style={{ color: T.textSub }}>
          <p>• 支払調書を配信する前に、対象年度の売上データが集計済みであることを確認してください。</p>
          <p>• セラピストには各自のマイページに通知として届き、本文のリンクから支払調書HTMLを開けます。</p>
          <p>• スタッフには登録メールアドレスに本文＋リンクが送られます。<strong>メール未登録のスタッフは配信できません</strong>。</p>
          <p>• 添付ファイルは HTML 形式で、受信者側でブラウザで開き、必要に応じて Ctrl+P → PDF 保存できます。</p>
          <p>• 失敗した配信は履歴から確認できます。再配信する場合は「対象者選択」からやり直してください。</p>
        </div>
      </div>
    </div>
  );
}
