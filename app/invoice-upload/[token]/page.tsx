"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../lib/supabase";

export default function InvoiceUpload() {
  const params = useParams();
  const token = params.token as string;
  const [therapistId, setTherapistId] = useState<number | null>(null);
  const [therapistName, setTherapistName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [invoiceNumber, setInvoiceNumber] = useState("T");
  const [preview, setPreview] = useState("");
  const fileRef = useRef<File | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data: c } = await supabase.from("contracts").select("*").eq("token", token).eq("type", "invoice").maybeSingle();
      if (!c) { setError("リンクが無効です。URLを確認してください。"); setLoading(false); return; }
      if (c.status === "signed") { setDone(true); setLoading(false); return; }
      setTherapistId(c.therapist_id);
      const { data: t } = await supabase.from("therapists").select("id, name").eq("id", c.therapist_id).maybeSingle();
      if (t) setTherapistName(t.name);
      setLoading(false);
    };
    if (token) load();
  }, [token]);

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => { setPreview(e.target?.result as string); fileRef.current = file; };
    reader.readAsDataURL(file);
  };

  const isValidNumber = invoiceNumber.match(/^T\d{13}$/);

  const handleSubmit = async () => {
    if (!therapistId || !fileRef.current || !isValidNumber) return;
    setSubmitting(true);

    const ext = fileRef.current.name.split(".").pop() || "jpg";
    const fn = `invoice_${therapistId}_${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("therapist-photos").upload(fn, fileRef.current, { upsert: true, contentType: fileRef.current.type });
    if (upErr) { alert("アップロードエラー: " + upErr.message); setSubmitting(false); return; }
    const { data } = supabase.storage.from("therapist-photos").getPublicUrl(fn);

    await supabase.from("therapists").update({
      invoice_photo_url: data.publicUrl,
      therapist_invoice_number: invoiceNumber,
      has_invoice: true,
    }).eq("id", therapistId);

    await supabase.from("contracts").update({ status: "signed", signed_at: new Date().toISOString() }).eq("token", token);

    setDone(true);
    setSubmitting(false);
  };

  if (loading) return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#faf9f7" }}><p style={{ color: "#999", fontSize: 14 }}>読み込み中...</p></div>;
  if (error) return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#faf9f7", padding: 20 }}><div style={{ textAlign: "center" }}><div style={{ fontSize: 48, marginBottom: 12 }}>⚠️</div><p style={{ color: "#c45555", fontSize: 14 }}>{error}</p></div></div>;
  if (done) return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#faf9f7", padding: 20 }}><div style={{ textAlign: "center" }}><div style={{ fontSize: 48, marginBottom: 12 }}>✅</div><h2 style={{ fontSize: 18, fontWeight: 700, color: "#1a1a2e", marginBottom: 8 }}>提出完了</h2><p style={{ fontSize: 13, color: "#666" }}>適格事業者登録通知書の提出が完了しました。</p><p style={{ fontSize: 12, color: "#999", marginTop: 8 }}>このページを閉じてください。</p></div></div>;

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#faf9f7", paddingBottom: 40 }}>
      <div style={{ backgroundColor: "#1a1a2e", color: "#fff", padding: "16px 20px", textAlign: "center" }}>
        <p style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", letterSpacing: 2 }}>RELAXATION SALON</p>
        <h1 style={{ fontSize: 15, fontWeight: 600, margin: "4px 0" }}>📋 適格事業者登録通知書</h1>
        <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>Chop（チョップ）</p>
      </div>

      <div style={{ maxWidth: 480, margin: "0 auto", padding: "20px 16px" }}>
        {therapistName && (
          <div style={{ padding: "12px 16px", borderRadius: 12, backgroundColor: "#fff", border: "1px solid #e8e4de", marginBottom: 16 }}>
            <p style={{ fontSize: 11, color: "#999" }}>対象セラピスト</p>
            <p style={{ fontSize: 15, fontWeight: 600, color: "#1a1a2e" }}>{therapistName}</p>
          </div>
        )}

        {/* 登録番号入力 */}
        <div style={{ padding: "16px", borderRadius: 12, backgroundColor: "#fff", border: "1px solid #e8e4de", marginBottom: 16 }}>
          <label style={{ fontSize: 12, color: "#333", display: "block", marginBottom: 6, fontWeight: 500 }}>
            適格事業者登録番号 <span style={{ color: "#c45555" }}>*</span>
          </label>
          <p style={{ fontSize: 10, color: "#999", marginBottom: 8 }}>Tから始まる13桁の番号を入力してください（例: T1234567890123）</p>
          <input
            type="text"
            value={invoiceNumber}
            onChange={e => {
              let v = e.target.value.toUpperCase();
              if (!v.startsWith("T")) v = "T" + v.replace(/^T/i, "");
              v = "T" + v.slice(1).replace(/\D/g, "").slice(0, 13);
              setInvoiceNumber(v);
            }}
            placeholder="T1234567890123"
            style={{
              width: "100%", padding: "12px 14px", borderRadius: 8, fontSize: 18, fontWeight: 600,
              fontFamily: "monospace", letterSpacing: 2, textAlign: "center",
              border: isValidNumber ? "2px solid #22c55e" : "2px solid #e8e4de",
              outline: "none", color: "#1a1a2e",
            }}
          />
          <div style={{ textAlign: "center", marginTop: 6 }}>
            {isValidNumber ? (
              <span style={{ fontSize: 11, color: "#22c55e" }}>✅ 正しい形式です</span>
            ) : (
              <span style={{ fontSize: 11, color: "#f59e0b" }}>T + 数字13桁で入力してください（残り{Math.max(0, 13 - (invoiceNumber.length - 1))}桁）</span>
            )}
          </div>
        </div>

        {/* 画像アップロード */}
        <div style={{ padding: "16px", borderRadius: 12, backgroundColor: "#fff", border: "1px solid #e8e4de", marginBottom: 16 }}>
          <label style={{ fontSize: 12, color: "#333", display: "block", marginBottom: 6, fontWeight: 500 }}>
            📄 通知書の写真 <span style={{ color: "#c45555" }}>*</span>
          </label>
          <p style={{ fontSize: 10, color: "#999", marginBottom: 8 }}>適格事業者登録通知書を撮影またはファイルから選択してください</p>
          <div style={{ border: preview ? "2px solid #c3a782" : "2px dashed #ddd", borderRadius: 12, overflow: "hidden", backgroundColor: "#fefefe" }}>
            {preview ? (
              <div style={{ position: "relative" }}>
                <img src={preview} alt="通知書" style={{ width: "100%", maxHeight: 300, objectFit: "contain" }} />
                <button onClick={() => { setPreview(""); fileRef.current = null; }}
                  style={{ position: "absolute", top: 8, right: 8, background: "rgba(0,0,0,0.5)", color: "#fff", border: "none", borderRadius: "50%", width: 28, height: 28, cursor: "pointer", fontSize: 14 }}>✕</button>
              </div>
            ) : (
              <label style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "30px 16px", cursor: "pointer" }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>📷</div>
                <p style={{ fontSize: 13, color: "#666", marginBottom: 4 }}>タップして撮影・選択</p>
                <input type="file" accept="image/*" capture="environment" style={{ display: "none" }}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
              </label>
            )}
          </div>
        </div>

        <button onClick={handleSubmit} disabled={!isValidNumber || !preview || submitting}
          style={{
            width: "100%", padding: "16px", borderRadius: 12, border: "none",
            background: (!isValidNumber || !preview) ? "#ddd" : "linear-gradient(135deg, #c3a782, #a8895e)",
            color: (!isValidNumber || !preview) ? "#999" : "#fff",
            fontSize: 15, fontWeight: 600, cursor: (!isValidNumber || !preview) ? "not-allowed" : "pointer",
          }}>
          {submitting ? "送信中..." : "📋 提出する"}
        </button>
        {!isValidNumber && <p style={{ fontSize: 10, color: "#c45555", textAlign: "center", marginTop: 8 }}>※ 登録番号を正しく入力してください</p>}
        {isValidNumber && !preview && <p style={{ fontSize: 10, color: "#c45555", textAlign: "center", marginTop: 8 }}>※ 通知書の写真をアップロードしてください</p>}
      </div>
    </div>
  );
}
