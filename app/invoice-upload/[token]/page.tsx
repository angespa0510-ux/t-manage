"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../lib/supabase";

const FONT_SERIF = "'Noto Serif JP', 'Yu Mincho', 'Hiragino Mincho ProN', serif";
const FONT_DISPLAY = "'Cormorant Garamond', 'Noto Serif JP', 'Yu Mincho', serif";
const FONT_SANS = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif";

const MARBLE_BG = {
  background: `
    radial-gradient(at 20% 15%, rgba(232,132,154,0.10) 0, transparent 50%),
    radial-gradient(at 85% 20%, rgba(196,162,138,0.08) 0, transparent 50%),
    radial-gradient(at 40% 85%, rgba(247,227,231,0.6) 0, transparent 50%),
    linear-gradient(180deg, #fbf7f3 0%, #f8f2ec 100%)
  `,
};

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

  // ─── Loading / Error / Done 画面 ───
  if (loading) {
    return (
      <div style={{ minHeight: "100vh", ...MARBLE_BG, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT_SERIF }}>
        <p style={{ color: "#8a8a8a", fontSize: 12, letterSpacing: "0.15em" }}>読み込み中…</p>
      </div>
    );
  }
  if (error) {
    return (
      <div style={{ minHeight: "100vh", ...MARBLE_BG, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: FONT_SERIF }}>
        <div style={{ width: "100%", maxWidth: 400, padding: "40px 32px", backgroundColor: "#ffffff", border: "1px solid #e5ded6", textAlign: "center" }}>
          <div style={{ fontSize: 36, marginBottom: 14 }}>⚠️</div>
          <p style={{ margin: 0, fontFamily: FONT_DISPLAY, fontSize: 11, letterSpacing: "0.3em", color: "#c96b83", fontWeight: 500 }}>ERROR</p>
          <p style={{ margin: "10px 0 0", fontSize: 13, color: "#555555", letterSpacing: "0.05em", lineHeight: 1.9 }}>{error}</p>
        </div>
      </div>
    );
  }
  if (done) {
    return (
      <div style={{ minHeight: "100vh", ...MARBLE_BG, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: FONT_SERIF }}>
        <div style={{ width: "100%", maxWidth: 400, padding: "40px 32px", backgroundColor: "#ffffff", border: "1px solid #e5ded6", textAlign: "center" }}>
          <div style={{ width: 1, height: 28, backgroundColor: "#6b9b7e", margin: "0 auto 18px" }} />
          <div style={{ fontSize: 36, marginBottom: 14 }}>✅</div>
          <p style={{ margin: 0, fontFamily: FONT_DISPLAY, fontSize: 11, letterSpacing: "0.3em", color: "#6b9b7e", fontWeight: 500 }}>COMPLETED</p>
          <h2 style={{ margin: "6px 0 10px", fontSize: 17, fontWeight: 500, letterSpacing: "0.1em", color: "#2b2b2b" }}>提出完了</h2>
          <div style={{ width: 24, height: 1, backgroundColor: "#6b9b7e", margin: "0 auto 10px" }} />
          <p style={{ margin: 0, fontSize: 12, color: "#555555", letterSpacing: "0.05em", lineHeight: 1.9 }}>適格事業者登録通知書の提出が<br />完了しました。</p>
          <p style={{ margin: "14px 0 0", fontSize: 11, color: "#b5b5b5", letterSpacing: "0.08em" }}>このページを閉じてください</p>
        </div>
      </div>
    );
  }

  // ─── メイン画面 ───
  return (
    <div style={{ minHeight: "100vh", ...MARBLE_BG, paddingBottom: 40, fontFamily: FONT_SERIF, color: "#2b2b2b" }}>
      {/* ヘッダー（大理石 + 装飾細線） */}
      <div style={{ padding: "36px 20px 24px", textAlign: "center", borderBottom: "1px solid #e5ded6", backgroundColor: "rgba(255,255,255,0.5)", backdropFilter: "blur(6px)" }}>
        <div style={{ width: 1, height: 24, backgroundColor: "#e8849a", margin: "0 auto 12px" }} />
        <p style={{ margin: 0, fontFamily: FONT_DISPLAY, fontSize: 10, letterSpacing: "0.3em", color: "#c96b83", fontWeight: 500 }}>INVOICE REGISTRATION</p>
        <h1 style={{ margin: "6px 0 8px", fontFamily: FONT_SERIF, fontSize: 16, fontWeight: 500, letterSpacing: "0.12em" }}>📋 適格事業者登録通知書</h1>
        <div style={{ width: 30, height: 1, backgroundColor: "#e8849a", margin: "0 auto 8px" }} />
        <p style={{ margin: 0, fontFamily: FONT_DISPLAY, fontSize: 10, letterSpacing: "0.3em", color: "#8a8a8a" }}>ANGE SPA</p>
      </div>

      <div style={{ maxWidth: 480, margin: "0 auto", padding: "24px 16px" }}>
        {/* 対象セラピスト */}
        {therapistName && (
          <div style={{ padding: "14px 18px", backgroundColor: "#ffffff", border: "1px solid #e5ded6", marginBottom: 16 }}>
            <p style={{ margin: 0, fontFamily: FONT_DISPLAY, fontSize: 10, letterSpacing: "0.2em", color: "#8a8a8a", fontWeight: 500 }}>THERAPIST</p>
            <p style={{ margin: "3px 0 0", fontSize: 15, fontWeight: 500, color: "#2b2b2b", letterSpacing: "0.05em" }}>{therapistName}</p>
          </div>
        )}

        {/* 登録番号入力 */}
        <div style={{ padding: "18px 18px", backgroundColor: "#ffffff", border: "1px solid #e5ded6", marginBottom: 16 }}>
          <label style={{ display: "block", marginBottom: 6 }}>
            <span style={{ fontFamily: FONT_DISPLAY, fontSize: 10, letterSpacing: "0.2em", color: "#c96b83", fontWeight: 500 }}>REGISTRATION NO.</span>
          </label>
          <p style={{ margin: "0 0 4px", fontSize: 12, color: "#2b2b2b", fontWeight: 500, letterSpacing: "0.05em" }}>適格事業者登録番号 <span style={{ color: "#c96b83" }}>*</span></p>
          <p style={{ margin: "0 0 10px", fontSize: 10, color: "#8a8a8a", letterSpacing: "0.03em", lineHeight: 1.7 }}>T から始まる 13 桁の番号を入力してください（例: T1234567890123）</p>
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
              width: "100%", padding: "12px 14px", fontSize: 18, fontWeight: 500,
              fontFamily: FONT_SANS, letterSpacing: 2, textAlign: "center",
              border: isValidNumber ? "1px solid #6b9b7e" : "1px solid #e5ded6",
              outline: "none", color: "#2b2b2b", backgroundColor: "#faf6f1",
              boxSizing: "border-box",
            }}
          />
          <div style={{ textAlign: "center", marginTop: 8 }}>
            {isValidNumber ? (
              <span style={{ fontSize: 11, color: "#6b9b7e", letterSpacing: "0.05em" }}>✅ 正しい形式です</span>
            ) : (
              <span style={{ fontSize: 11, color: "#b38419", letterSpacing: "0.03em" }}>T + 数字 13 桁で入力してください（残り {Math.max(0, 13 - (invoiceNumber.length - 1))} 桁）</span>
            )}
          </div>
        </div>

        {/* 画像アップロード */}
        <div style={{ padding: "18px 18px", backgroundColor: "#ffffff", border: "1px solid #e5ded6", marginBottom: 18 }}>
          <label style={{ display: "block", marginBottom: 6 }}>
            <span style={{ fontFamily: FONT_DISPLAY, fontSize: 10, letterSpacing: "0.2em", color: "#c96b83", fontWeight: 500 }}>PHOTO</span>
          </label>
          <p style={{ margin: "0 0 4px", fontSize: 12, color: "#2b2b2b", fontWeight: 500, letterSpacing: "0.05em" }}>📄 通知書の写真 <span style={{ color: "#c96b83" }}>*</span></p>
          <p style={{ margin: "0 0 10px", fontSize: 10, color: "#8a8a8a", letterSpacing: "0.03em", lineHeight: 1.7 }}>適格事業者登録通知書を撮影またはファイルから選択してください</p>
          <div style={{ border: preview ? "1px solid #e8849a" : "1px dashed #d0c8bf", overflow: "hidden", backgroundColor: "#faf6f1" }}>
            {preview ? (
              <div style={{ position: "relative" }}>
                <img src={preview} alt="通知書" style={{ width: "100%", maxHeight: 300, objectFit: "contain", display: "block" }} />
                <button onClick={() => { setPreview(""); fileRef.current = null; }}
                  style={{ position: "absolute", top: 8, right: 8, backgroundColor: "rgba(43,43,43,0.7)", color: "#fff", border: "none", width: 28, height: 28, cursor: "pointer", fontSize: 13, fontFamily: FONT_SERIF }}>✕</button>
              </div>
            ) : (
              <label style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "36px 16px", cursor: "pointer" }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>📷</div>
                <p style={{ margin: 0, fontSize: 12, color: "#555555", letterSpacing: "0.05em" }}>タップして撮影・選択</p>
                <input type="file" accept="image/*" capture="environment" style={{ display: "none" }}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
              </label>
            )}
          </div>
        </div>

        <button onClick={handleSubmit} disabled={!isValidNumber || !preview || submitting}
          style={{
            width: "100%", padding: "14px 22px", border: "none",
            backgroundColor: (!isValidNumber || !preview) ? "#d5d0ca" : "#c96b83",
            color: (!isValidNumber || !preview) ? "#8a8a8a" : "#ffffff",
            fontSize: 13, fontFamily: FONT_SERIF, fontWeight: 500, letterSpacing: "0.2em",
            cursor: (!isValidNumber || !preview) ? "not-allowed" : "pointer",
          }}>
          {submitting ? "送信中…" : "📋 提出する"}
        </button>
        {!isValidNumber && <p style={{ margin: "10px 0 0", fontSize: 10, color: "#c96b83", textAlign: "center", letterSpacing: "0.03em" }}>※ 登録番号を正しく入力してください</p>}
        {isValidNumber && !preview && <p style={{ margin: "10px 0 0", fontSize: 10, color: "#c96b83", textAlign: "center", letterSpacing: "0.03em" }}>※ 通知書の写真をアップロードしてください</p>}
      </div>
    </div>
  );
}
