"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../lib/supabase";

const FONT_SERIF = "'Noto Serif JP', 'Yu Mincho', 'Hiragino Mincho ProN', serif";
const FONT_DISPLAY = "'Cormorant Garamond', 'Noto Serif JP', 'Yu Mincho', serif";

const MARBLE_BG = {
  background: `
    radial-gradient(at 20% 15%, rgba(232,132,154,0.10) 0, transparent 50%),
    radial-gradient(at 85% 20%, rgba(196,162,138,0.08) 0, transparent 50%),
    radial-gradient(at 40% 85%, rgba(247,227,231,0.6) 0, transparent 50%),
    linear-gradient(180deg, #fbf7f3 0%, #f8f2ec 100%)
  `,
};

export default function LicenseUpload() {
  const params = useParams();
  const token = params.token as string;
  const [therapistId, setTherapistId] = useState<number | null>(null);
  const [therapistName, setTherapistName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [frontPreview, setFrontPreview] = useState("");
  const [backPreview, setBackPreview] = useState("");
  const frontFile = useRef<File | null>(null);
  const backFile = useRef<File | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data: c } = await supabase.from("contracts").select("*").eq("token", token).eq("type", "license").maybeSingle();
      if (!c) { setError("リンクが無効です。URLを確認してください。"); setLoading(false); return; }
      if (c.status === "signed") { setDone(true); setLoading(false); return; }
      setTherapistId(c.therapist_id);
      const { data: t } = await supabase.from("therapists").select("id, name").eq("id", c.therapist_id).maybeSingle();
      if (t) setTherapistName(t.name);
      setLoading(false);
    };
    if (token) load();
  }, [token]);

  const handleFile = (file: File, side: "front" | "back") => {
    const reader = new FileReader();
    reader.onload = (e) => {
      if (side === "front") { setFrontPreview(e.target?.result as string); frontFile.current = file; }
      else { setBackPreview(e.target?.result as string); backFile.current = file; }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (!therapistId || !frontFile.current) return;
    setSubmitting(true);

    const upload = async (file: File, prefix: string) => {
      const ext = file.name.split(".").pop() || "jpg";
      const fn = `${prefix}_${therapistId}_${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("therapist-photos").upload(fn, file, { upsert: true, contentType: file.type });
      if (error) { alert("アップロードエラー: " + error.message); return ""; }
      const { data } = supabase.storage.from("therapist-photos").getPublicUrl(fn);
      return data.publicUrl;
    };

    const frontUrl = await upload(frontFile.current, "license_front");
    if (!frontUrl) { setSubmitting(false); return; }

    const updates: Record<string, string> = { license_photo_url: frontUrl };
    if (backFile.current) {
      const backUrl = await upload(backFile.current, "license_back");
      if (backUrl) updates.license_photo_url_back = backUrl;
    }

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
        <h2 style={{ margin: "6px 0 10px", fontSize: 17, fontWeight: 500, letterSpacing: "0.1em", color: "#2b2b2b" }}>アップロード完了</h2>
        <div style={{ width: 24, height: 1, backgroundColor: "#6b9b7e", margin: "0 auto 10px" }} />
        <p style={{ margin: 0, fontSize: 12, color: "#555555", letterSpacing: "0.05em", lineHeight: 1.9 }}>身分証のアップロードが<br />完了しました。</p>
        <p style={{ margin: "14px 0 0", fontSize: 11, color: "#b5b5b5", letterSpacing: "0.08em" }}>このページを閉じてください</p>
      </div>
    </div>
  );

  const photoBox = (side: "front" | "back", label: string, preview: string, required: boolean) => (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: "block", marginBottom: 8 }}>
        <span style={{ fontFamily: FONT_DISPLAY, fontSize: 10, letterSpacing: "0.2em", color: "#c96b83", fontWeight: 500 }}>{side === "front" ? "FRONT" : "BACK"}</span>
      </label>
      <p style={{ margin: "0 0 10px", fontSize: 12, color: "#2b2b2b", fontWeight: 500, letterSpacing: "0.05em" }}>{label}{required && <span style={{ color: "#c96b83" }}> *</span>}</p>
      <div style={{ border: preview ? "1px solid #e8849a" : "1px dashed #d0c8bf", overflow: "hidden", backgroundColor: "#faf6f1", position: "relative" }}>
        {preview ? (
          <div style={{ position: "relative" }}>
            <img src={preview} alt={label} style={{ width: "100%", maxHeight: 260, objectFit: "contain", display: "block" }} />
            <button onClick={() => { if (side === "front") { setFrontPreview(""); frontFile.current = null; } else { setBackPreview(""); backFile.current = null; } }}
              style={{ position: "absolute", top: 8, right: 8, backgroundColor: "rgba(43,43,43,0.7)", color: "#fff", border: "none", width: 28, height: 28, cursor: "pointer", fontSize: 13, fontFamily: FONT_SERIF }}>✕</button>
          </div>
        ) : (
          <label style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "32px 16px", cursor: "pointer" }}>
            <div style={{ fontSize: 30, marginBottom: 10 }}>📷</div>
            <p style={{ margin: 0, fontSize: 12, color: "#555555", letterSpacing: "0.05em" }}>タップして撮影・選択</p>
            <p style={{ margin: "4px 0 0", fontSize: 10, color: "#b5b5b5", letterSpacing: "0.03em" }}>カメラまたはファイルから選択</p>
            <input type="file" accept="image/*" capture="environment" style={{ display: "none" }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f, side); }} />
          </label>
        )}
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", ...MARBLE_BG, paddingBottom: 40, fontFamily: FONT_SERIF, color: "#2b2b2b" }}>
      <div style={{ padding: "36px 20px 24px", textAlign: "center", borderBottom: "1px solid #e5ded6", backgroundColor: "rgba(255,255,255,0.5)", backdropFilter: "blur(6px)" }}>
        <div style={{ width: 1, height: 24, backgroundColor: "#e8849a", margin: "0 auto 12px" }} />
        <p style={{ margin: 0, fontFamily: FONT_DISPLAY, fontSize: 10, letterSpacing: "0.3em", color: "#c96b83", fontWeight: 500 }}>ID VERIFICATION</p>
        <h1 style={{ margin: "6px 0 8px", fontFamily: FONT_SERIF, fontSize: 16, fontWeight: 500, letterSpacing: "0.12em" }}>🪪 身分証アップロード</h1>
        <div style={{ width: 30, height: 1, backgroundColor: "#e8849a", margin: "0 auto 8px" }} />
        <p style={{ margin: 0, fontFamily: FONT_DISPLAY, fontSize: 10, letterSpacing: "0.3em", color: "#8a8a8a" }}>ANGE SPA</p>
      </div>

      <div style={{ maxWidth: 480, margin: "0 auto", padding: "24px 16px" }}>
        {therapistName && (
          <div style={{ padding: "14px 18px", backgroundColor: "#ffffff", border: "1px solid #e5ded6", marginBottom: 16 }}>
            <p style={{ margin: 0, fontFamily: FONT_DISPLAY, fontSize: 10, letterSpacing: "0.2em", color: "#8a8a8a", fontWeight: 500 }}>THERAPIST</p>
            <p style={{ margin: "3px 0 0", fontSize: 15, fontWeight: 500, color: "#2b2b2b", letterSpacing: "0.05em" }}>{therapistName}</p>
          </div>
        )}

        <div style={{ padding: "18px 18px", backgroundColor: "#ffffff", border: "1px solid #e5ded6", marginBottom: 18 }}>
          <p style={{ margin: "0 0 18px", fontSize: 12, color: "#555555", lineHeight: 1.9, letterSpacing: "0.03em" }}>
            本人確認のため、身分証明書（運転免許証など）の表面と裏面を撮影してアップロードしてください。
          </p>
          {photoBox("front", "📄 表面（顔写真側）", frontPreview, true)}
          {photoBox("back", "📄 裏面", backPreview, false)}
        </div>

        <button onClick={handleSubmit} disabled={!frontPreview || submitting}
          style={{
            width: "100%", padding: "14px 22px", border: "none",
            backgroundColor: !frontPreview ? "#d5d0ca" : "#c96b83",
            color: !frontPreview ? "#8a8a8a" : "#ffffff",
            fontSize: 13, fontFamily: FONT_SERIF, fontWeight: 500, letterSpacing: "0.2em",
            cursor: !frontPreview ? "not-allowed" : "pointer",
          }}>
          {submitting ? "アップロード中…" : "🪪 アップロードする"}
        </button>
        {!frontPreview && <p style={{ margin: "10px 0 0", fontSize: 10, color: "#c96b83", textAlign: "center", letterSpacing: "0.03em" }}>※ 表面の写真は必須です</p>}
      </div>
    </div>
  );
}
