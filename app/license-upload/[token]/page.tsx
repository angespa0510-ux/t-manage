"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../lib/supabase";

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

  if (loading) return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#faf9f7" }}><p style={{ color: "#999", fontSize: 14 }}>読み込み中...</p></div>;
  if (error) return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#faf9f7", padding: 20 }}><div style={{ textAlign: "center" }}><div style={{ fontSize: 48, marginBottom: 12 }}>⚠️</div><p style={{ color: "#c45555", fontSize: 14 }}>{error}</p></div></div>;
  if (done) return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#faf9f7", padding: 20 }}><div style={{ textAlign: "center" }}><div style={{ fontSize: 48, marginBottom: 12 }}>✅</div><h2 style={{ fontSize: 18, fontWeight: 700, color: "#1a1a2e", marginBottom: 8 }}>アップロード完了</h2><p style={{ fontSize: 13, color: "#666" }}>免許証のアップロードが完了しました。</p><p style={{ fontSize: 12, color: "#999", marginTop: 8 }}>このページを閉じてください。</p></div></div>;

  const photoBox = (side: "front" | "back", label: string, preview: string, required: boolean) => (
    <div style={{ marginBottom: 16 }}>
      <label style={{ fontSize: 12, color: "#333", display: "block", marginBottom: 6, fontWeight: 500 }}>{label}{required && <span style={{ color: "#c45555" }}> *</span>}</label>
      <div style={{ border: preview ? "2px solid #c3a782" : "2px dashed #ddd", borderRadius: 12, overflow: "hidden", backgroundColor: "#fefefe", position: "relative" }}>
        {preview ? (
          <div style={{ position: "relative" }}>
            <img src={preview} alt={label} style={{ width: "100%", maxHeight: 250, objectFit: "contain" }} />
            <button onClick={() => { if (side === "front") { setFrontPreview(""); frontFile.current = null; } else { setBackPreview(""); backFile.current = null; } }}
              style={{ position: "absolute", top: 8, right: 8, background: "rgba(0,0,0,0.5)", color: "#fff", border: "none", borderRadius: "50%", width: 28, height: 28, cursor: "pointer", fontSize: 14 }}>✕</button>
          </div>
        ) : (
          <label style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "30px 16px", cursor: "pointer" }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>📷</div>
            <p style={{ fontSize: 13, color: "#666", marginBottom: 4 }}>タップして撮影・選択</p>
            <p style={{ fontSize: 10, color: "#bbb" }}>カメラまたはファイルから選択</p>
            <input type="file" accept="image/*" capture="environment" style={{ display: "none" }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f, side); }} />
          </label>
        )}
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#faf9f7", paddingBottom: 40 }}>
      <div style={{ backgroundColor: "#1a1a2e", color: "#fff", padding: "16px 20px", textAlign: "center" }}>
        <p style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", letterSpacing: 2 }}>RELAXATION SALON</p>
        <h1 style={{ fontSize: 16, fontWeight: 600, margin: "4px 0" }}>🪪 免許証アップロード</h1>
        <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>Chop（チョップ）</p>
      </div>

      <div style={{ maxWidth: 480, margin: "0 auto", padding: "20px 16px" }}>
        {therapistName && (
          <div style={{ padding: "12px 16px", borderRadius: 12, backgroundColor: "#fff", border: "1px solid #e8e4de", marginBottom: 16 }}>
            <p style={{ fontSize: 11, color: "#999" }}>対象セラピスト</p>
            <p style={{ fontSize: 15, fontWeight: 600, color: "#1a1a2e" }}>{therapistName}</p>
          </div>
        )}

        <div style={{ padding: "16px", borderRadius: 12, backgroundColor: "#fff", border: "1px solid #e8e4de", marginBottom: 16 }}>
          <p style={{ fontSize: 12, color: "#666", marginBottom: 16, lineHeight: 1.6 }}>
            本人確認のため、運転免許証（または身分証明書）の表面と裏面を撮影してアップロードしてください。
          </p>
          {photoBox("front", "📄 表面（顔写真側）", frontPreview, true)}
          {photoBox("back", "📄 裏面", backPreview, false)}
        </div>

        <button onClick={handleSubmit} disabled={!frontPreview || submitting}
          style={{
            width: "100%", padding: "16px", borderRadius: 12, border: "none",
            background: !frontPreview ? "#ddd" : "linear-gradient(135deg, #c3a782, #a8895e)",
            color: !frontPreview ? "#999" : "#fff",
            fontSize: 15, fontWeight: 600, cursor: !frontPreview ? "not-allowed" : "pointer",
          }}>
          {submitting ? "アップロード中..." : "🪪 アップロードする"}
        </button>
        {!frontPreview && <p style={{ fontSize: 10, color: "#c45555", textAlign: "center", marginTop: 8 }}>※ 表面の写真は必須です</p>}
      </div>
    </div>
  );
}
