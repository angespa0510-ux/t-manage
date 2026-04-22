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

export default function MynumberUpload() {
  const params = useParams();
  const token = params.token as string;
  const [therapistId, setTherapistId] = useState<number | null>(null);
  const [therapistName, setTherapistName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [preview, setPreview] = useState("");
  const [mynumber, setMynumber] = useState("");
  const [aiReading, setAiReading] = useState(false);
  const fileRef = useRef<File | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data: c } = await supabase.from("contracts").select("*").eq("token", token).eq("type", "mynumber").maybeSingle();
      if (!c) { setError("リンクが無効です。URLを確認してください。"); setLoading(false); return; }
      if (c.status === "signed") { setDone(true); setLoading(false); return; }
      setTherapistId(c.therapist_id);
      const { data: t } = await supabase.from("therapists").select("id, name").eq("id", c.therapist_id).maybeSingle();
      if (t) setTherapistName(t.name);
      setLoading(false);
    };
    if (token) load();
  }, [token]);

  const handleFile = async (file: File) => {
    fileRef.current = file;
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(file);

    setAiReading(true);
    try {
      const base64 = await new Promise<string>((resolve) => {
        const r = new FileReader();
        r.onload = () => resolve((r.result as string).split(",")[1]);
        r.readAsDataURL(file);
      });
      const res = await fetch("/api/receipt-analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: base64, mediaType: file.type,
          customPrompt: "このマイナンバーカードの画像から個人番号（12桁の数字）を読み取ってください。JSON形式のみで返してください：{\"mynumber\":\"123456789012\"} 読み取れない場合は{\"mynumber\":\"\"}"
        }),
      });
      const data = await res.json();
      if (data.ok && data.result?.mynumber) {
        const num = data.result.mynumber.replace(/[^0-9]/g, "").slice(0, 12);
        if (num.length === 12) setMynumber(num);
      }
    } catch { /* 手動入力にフォールバック */ }
    setAiReading(false);
  };

  const handleSubmit = async () => {
    if (!therapistId || !mynumber || mynumber.length !== 12) return;
    setSubmitting(true);

    let photoUrl = "";
    if (fileRef.current) {
      const ext = fileRef.current.name.split(".").pop() || "jpg";
      const fn = `mynumber_${therapistId}_${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("therapist-photos").upload(fn, fileRef.current, { upsert: true, contentType: fileRef.current.type });
      if (!upErr) {
        const { data } = supabase.storage.from("therapist-photos").getPublicUrl(fn);
        photoUrl = data.publicUrl;
      }
    }

    const updates: Record<string, string> = { mynumber };
    if (photoUrl) updates.mynumber_photo_url = photoUrl;

    await supabase.from("therapists").update(updates).eq("id", therapistId);
    await supabase.from("contracts").update({ status: "signed", signed_at: new Date().toISOString() }).eq("token", token);

    setDone(true);
    setSubmitting(false);
  };

  if (loading) return (
    <div style={{ minHeight: "100vh", ...MARBLE_BG, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT_SERIF }}>
      <p style={{ color: "#8a8a8a", fontSize: 12, letterSpacing: "0.15em" }}>読み込み中…</p>
    </div>
  );
  if (error) return (
    <div style={{ minHeight: "100vh", ...MARBLE_BG, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: FONT_SERIF }}>
      <div style={{ width: "100%", maxWidth: 400, padding: "40px 32px", backgroundColor: "#ffffff", border: "1px solid #e5ded6", textAlign: "center" }}>
        <div style={{ fontSize: 36, marginBottom: 14 }}>⚠️</div>
        <p style={{ margin: 0, fontFamily: FONT_DISPLAY, fontSize: 11, letterSpacing: "0.3em", color: "#c96b83", fontWeight: 500 }}>ERROR</p>
        <p style={{ margin: "10px 0 0", fontSize: 13, color: "#555555", letterSpacing: "0.05em", lineHeight: 1.9 }}>{error}</p>
      </div>
    </div>
  );
  if (done) return (
    <div style={{ minHeight: "100vh", ...MARBLE_BG, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: FONT_SERIF }}>
      <div style={{ width: "100%", maxWidth: 400, padding: "40px 32px", backgroundColor: "#ffffff", border: "1px solid #e5ded6", textAlign: "center" }}>
        <div style={{ width: 1, height: 28, backgroundColor: "#6b9b7e", margin: "0 auto 18px" }} />
        <div style={{ fontSize: 36, marginBottom: 14 }}>✅</div>
        <p style={{ margin: 0, fontFamily: FONT_DISPLAY, fontSize: 11, letterSpacing: "0.3em", color: "#6b9b7e", fontWeight: 500 }}>COMPLETED</p>
        <h2 style={{ margin: "6px 0 10px", fontSize: 17, fontWeight: 500, letterSpacing: "0.1em", color: "#2b2b2b" }}>提出完了</h2>
        <div style={{ width: 24, height: 1, backgroundColor: "#6b9b7e", margin: "0 auto 10px" }} />
        <p style={{ margin: 0, fontSize: 12, color: "#555555", letterSpacing: "0.05em", lineHeight: 1.9 }}>マイナンバーの提出が<br />完了しました。</p>
        <p style={{ margin: "14px 0 0", fontSize: 11, color: "#b5b5b5", letterSpacing: "0.08em" }}>このページを閉じてください</p>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", ...MARBLE_BG, paddingBottom: 40, fontFamily: FONT_SERIF, color: "#2b2b2b" }}>
      {/* ヘッダー */}
      <div style={{ padding: "36px 20px 24px", textAlign: "center", borderBottom: "1px solid #e5ded6", backgroundColor: "rgba(255,255,255,0.5)", backdropFilter: "blur(6px)" }}>
        <div style={{ width: 1, height: 24, backgroundColor: "#e8849a", margin: "0 auto 12px" }} />
        <p style={{ margin: 0, fontFamily: FONT_DISPLAY, fontSize: 10, letterSpacing: "0.3em", color: "#c96b83", fontWeight: 500 }}>MY NUMBER</p>
        <h1 style={{ margin: "6px 0 8px", fontFamily: FONT_SERIF, fontSize: 16, fontWeight: 500, letterSpacing: "0.12em" }}>🔢 マイナンバー提出</h1>
        <div style={{ width: 30, height: 1, backgroundColor: "#e8849a", margin: "0 auto 8px" }} />
        <p style={{ margin: 0, fontFamily: FONT_DISPLAY, fontSize: 10, letterSpacing: "0.3em", color: "#8a8a8a" }}>ANGE SPA</p>
      </div>

      <div style={{ maxWidth: 440, margin: "0 auto", padding: "24px 16px" }}>
        {/* セラピスト表示 */}
        {therapistName && (
          <div style={{ padding: "14px 18px", backgroundColor: "#ffffff", border: "1px solid #e5ded6", marginBottom: 16 }}>
            <p style={{ margin: 0, fontFamily: FONT_DISPLAY, fontSize: 10, letterSpacing: "0.2em", color: "#8a8a8a", fontWeight: 500 }}>THERAPIST</p>
            <p style={{ margin: "3px 0 0", fontSize: 15, fontWeight: 500, color: "#2b2b2b", letterSpacing: "0.05em" }}>{therapistName}</p>
          </div>
        )}

        {/* 説明 */}
        <div style={{ padding: "14px 18px", backgroundColor: "rgba(179,132,25,0.06)", border: "1px solid #b3841944", marginBottom: 18 }}>
          <p style={{ margin: "0 0 6px", fontFamily: FONT_DISPLAY, fontSize: 10, letterSpacing: "0.2em", color: "#b38419", fontWeight: 500 }}>⚠️ IMPORTANT</p>
          <p style={{ margin: "0 0 4px", fontSize: 12, color: "#b38419", fontWeight: 500, letterSpacing: "0.03em" }}>マイナンバーについて</p>
          <p style={{ margin: 0, fontSize: 11, color: "#555555", lineHeight: 1.9, letterSpacing: "0.02em" }}>
            源泉徴収の届出（支払調書）に個人番号の記載が法律で義務付けられております。お預かりした情報は税務手続きにのみ使用し、厳重に管理いたします。
          </p>
        </div>

        {/* カード写真 */}
        <div style={{ padding: "18px 18px", backgroundColor: "#ffffff", border: "1px solid #e5ded6", marginBottom: 16 }}>
          <label style={{ display: "block", marginBottom: 6 }}>
            <span style={{ fontFamily: FONT_DISPLAY, fontSize: 10, letterSpacing: "0.2em", color: "#c96b83", fontWeight: 500 }}>PHOTO</span>
          </label>
          <p style={{ margin: "0 0 10px", fontSize: 12, color: "#2b2b2b", fontWeight: 500, letterSpacing: "0.05em" }}>📷 マイナンバーカード写真 <span style={{ color: "#8a8a8a", fontSize: 10, fontWeight: 400 }}>（任意）</span></p>
          <div style={{ border: preview ? "1px solid #e8849a" : "1px dashed #d0c8bf", overflow: "hidden", backgroundColor: "#faf6f1" }}>
            {preview ? (
              <div style={{ position: "relative" }}>
                <img src={preview} alt="マイナンバーカード" style={{ width: "100%", display: "block" }} />
                <button onClick={() => { setPreview(""); fileRef.current = null; }}
                  style={{ position: "absolute", top: 8, right: 8, width: 28, height: 28, backgroundColor: "rgba(43,43,43,0.7)", color: "#fff", border: "none", cursor: "pointer", fontSize: 13, fontFamily: FONT_SERIF }}>✕</button>
              </div>
            ) : (
              <label style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "32px 20px", cursor: "pointer" }}>
                <div style={{ fontSize: 30, marginBottom: 10 }}>📷</div>
                <p style={{ margin: 0, fontSize: 12, color: "#555555", letterSpacing: "0.05em" }}>タップしてカードを撮影</p>
                <p style={{ margin: "4px 0 0", fontSize: 10, color: "#b5b5b5", letterSpacing: "0.03em" }}>番号が見える面を撮影してください</p>
                <input type="file" accept="image/*" capture="environment" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} style={{ display: "none" }} />
              </label>
            )}
          </div>
          {aiReading && <p style={{ margin: "10px 0 0", fontSize: 11, color: "#c96b83", textAlign: "center", letterSpacing: "0.05em", animation: "pulse 1.5s infinite" }}>🤖 カードから番号を読み取り中…</p>}
        </div>

        {/* 番号入力 */}
        <div style={{ padding: "18px 18px", backgroundColor: "#ffffff", border: "1px solid #e5ded6", marginBottom: 18 }}>
          <label style={{ display: "block", marginBottom: 6 }}>
            <span style={{ fontFamily: FONT_DISPLAY, fontSize: 10, letterSpacing: "0.2em", color: "#c96b83", fontWeight: 500 }}>MY NUMBER</span>
          </label>
          <p style={{ margin: "0 0 10px", fontSize: 12, color: "#2b2b2b", fontWeight: 500, letterSpacing: "0.05em" }}>🔢 個人番号（12桁） <span style={{ color: "#c96b83" }}>*</span></p>
          <input type="text" inputMode="numeric" value={mynumber} onChange={(e) => setMynumber(e.target.value.replace(/[^0-9]/g, "").slice(0, 12))}
            placeholder="マイナンバー 12 桁を入力" maxLength={12}
            style={{ width: "100%", padding: "14px 16px", border: `1px solid ${mynumber.length === 12 ? "#6b9b7e" : "#e5ded6"}`, fontSize: 18, fontFamily: FONT_SANS, fontWeight: 500, letterSpacing: "0.15em", textAlign: "center", outline: "none", backgroundColor: "#faf6f1", boxSizing: "border-box", color: "#2b2b2b" }} />
          <p style={{ margin: "8px 0 0", fontSize: 11, textAlign: "center", color: mynumber.length === 12 ? "#6b9b7e" : "#8a8a8a", letterSpacing: "0.05em" }}>
            <span style={{ fontFamily: FONT_SANS }}>{mynumber.length}/12</span> 桁 {mynumber.length === 12 ? "✅ OK" : ""}
          </p>
        </div>

        {/* 提出ボタン */}
        <button onClick={handleSubmit} disabled={submitting || mynumber.length !== 12}
          style={{
            width: "100%", padding: "14px 22px", border: "none",
            backgroundColor: mynumber.length === 12 ? "#c96b83" : "#d5d0ca",
            color: mynumber.length === 12 ? "#ffffff" : "#8a8a8a",
            fontSize: 13, fontFamily: FONT_SERIF, fontWeight: 500, letterSpacing: "0.2em",
            cursor: mynumber.length === 12 ? "pointer" : "default", opacity: submitting ? 0.6 : 1,
          }}>
          {submitting ? "送信中…" : "提出する"}
        </button>

        {/* 注意事項 */}
        <div style={{ marginTop: 20, padding: "12px 14px", backgroundColor: "#faf6f1", border: "1px solid #e5ded6" }}>
          <p style={{ margin: 0, fontSize: 10, color: "#8a8a8a", lineHeight: 1.8, letterSpacing: "0.02em" }}>
            ※ お預かりした個人番号は、所得税法に基づく支払調書の作成にのみ使用いたします。個人情報保護法およびマイナンバー法に基づき、適切に管理いたします。第三者に開示・提供することはございません。
          </p>
        </div>
      </div>
    </div>
  );
}
