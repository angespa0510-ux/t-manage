"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../lib/supabase";

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

    // AI読取
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

  const pink = "#e8849a";

  if (loading) return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#faf9f7" }}><p style={{ color: "#999", fontSize: 14 }}>読み込み中...</p></div>;
  if (error) return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#faf9f7", padding: 20 }}><div style={{ textAlign: "center" }}><div style={{ fontSize: 48, marginBottom: 12 }}>⚠️</div><p style={{ color: "#c45555", fontSize: 14 }}>{error}</p></div></div>;
  if (done) return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#faf9f7", padding: 20 }}><div style={{ textAlign: "center" }}><div style={{ fontSize: 48, marginBottom: 12 }}>✅</div><h2 style={{ fontSize: 18, fontWeight: 700, color: "#1a1a2e", marginBottom: 8 }}>提出完了</h2><p style={{ fontSize: 13, color: "#666" }}>マイナンバーの提出が完了しました。</p><p style={{ fontSize: 12, color: "#999", marginTop: 8 }}>このページを閉じてください。</p></div></div>;

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#faf9f7", padding: "20px 16px" }}>
      <div style={{ maxWidth: 440, margin: "0 auto" }}>
        {/* ヘッダー */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🔢</div>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: "#1a1a2e", marginBottom: 4 }}>マイナンバー提出</h1>
          <p style={{ fontSize: 12, color: "#888" }}>{therapistName}さん</p>
        </div>

        {/* 説明 */}
        <div style={{ backgroundColor: "#f59e0b10", border: "1px solid #f59e0b33", borderRadius: 12, padding: 14, marginBottom: 20 }}>
          <p style={{ fontSize: 11, color: "#92400e", fontWeight: 600, marginBottom: 6 }}>⚠️ マイナンバーについて</p>
          <p style={{ fontSize: 10, color: "#666", lineHeight: 1.6 }}>
            源泉徴収の届出（支払調書）に個人番号の記載が法律で義務付けられております。
            お預かりした情報は税務手続きにのみ使用し、厳重に管理いたします。
          </p>
        </div>

        {/* カード写真 */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 12, color: "#333", display: "block", marginBottom: 6, fontWeight: 500 }}>📷 マイナンバーカード写真 <span style={{ color: "#999", fontSize: 10 }}>（任意）</span></label>
          <div style={{ border: preview ? `2px solid ${pink}` : "2px dashed #ddd", borderRadius: 12, overflow: "hidden", backgroundColor: "#fefefe" }}>
            {preview ? (
              <div style={{ position: "relative" }}>
                <img src={preview} alt="マイナンバーカード" style={{ width: "100%", display: "block" }} />
                <button onClick={() => { setPreview(""); fileRef.current = null; }}
                  style={{ position: "absolute", top: 8, right: 8, width: 28, height: 28, borderRadius: "50%", backgroundColor: "rgba(0,0,0,0.5)", color: "#fff", border: "none", cursor: "pointer", fontSize: 14 }}>✕</button>
              </div>
            ) : (
              <label style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "30px 20px", cursor: "pointer" }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📷</div>
                <p style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>タップしてカードを撮影</p>
                <p style={{ fontSize: 10, color: "#bbb" }}>番号が見える面を撮影してください</p>
                <input type="file" accept="image/*" capture="environment" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} style={{ display: "none" }} />
              </label>
            )}
          </div>
          {aiReading && <p style={{ fontSize: 11, color: pink, textAlign: "center", marginTop: 8, animation: "pulse 1.5s infinite" }}>🤖 カードから番号を読み取り中...</p>}
        </div>

        {/* 番号入力 */}
        <div style={{ marginBottom: 24 }}>
          <label style={{ fontSize: 12, color: "#333", display: "block", marginBottom: 6, fontWeight: 500 }}>🔢 個人番号（12桁） <span style={{ color: "#c45555" }}>*</span></label>
          <input type="text" inputMode="numeric" value={mynumber} onChange={(e) => setMynumber(e.target.value.replace(/[^0-9]/g, "").slice(0, 12))}
            placeholder="マイナンバー12桁を入力" maxLength={12}
            style={{ width: "100%", padding: "14px 16px", borderRadius: 12, border: `2px solid ${mynumber.length === 12 ? "#22c55e" : "#ddd"}`, fontSize: 18, fontFamily: "monospace", letterSpacing: "0.15em", textAlign: "center", outline: "none", backgroundColor: "#fff", boxSizing: "border-box" }} />
          <p style={{ fontSize: 10, textAlign: "center", marginTop: 6, color: mynumber.length === 12 ? "#22c55e" : "#999" }}>
            {mynumber.length}/12桁 {mynumber.length === 12 ? "✅ OK" : ""}
          </p>
        </div>

        {/* 提出ボタン */}
        <button onClick={handleSubmit} disabled={submitting || mynumber.length !== 12}
          style={{ width: "100%", padding: "14px", borderRadius: 12, border: "none", background: mynumber.length === 12 ? `linear-gradient(135deg, ${pink}, #d4687e)` : "#ddd", color: mynumber.length === 12 ? "#fff" : "#999", fontSize: 14, fontWeight: 700, cursor: mynumber.length === 12 ? "pointer" : "default", opacity: submitting ? 0.6 : 1 }}>
          {submitting ? "送信中..." : "提出する"}
        </button>

        {/* 注意事項 */}
        <div style={{ marginTop: 20, padding: 12, backgroundColor: "#f5f5f4", borderRadius: 10 }}>
          <p style={{ fontSize: 9, color: "#999", lineHeight: 1.6 }}>
            ※ お預かりした個人番号は、所得税法に基づく支払調書の作成にのみ使用いたします。
            個人情報保護法およびマイナンバー法に基づき、適切に管理いたします。
            第三者に開示・提供することはございません。
          </p>
        </div>
      </div>
    </div>
  );
}
