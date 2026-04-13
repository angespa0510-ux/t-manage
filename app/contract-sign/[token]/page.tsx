"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../lib/supabase";

type Contract = { id: number; therapist_id: number; token: string; status: string; signer_name: string; signer_address: string; signature_url: string; signed_at: string; created_at: string };
type Therapist = { id: number; name: string };

export default function ContractSign() {
  const params = useParams();
  const token = params.token as string;
  const [contract, setContract] = useState<Contract | null>(null);
  const [therapist, setTherapist] = useState<Therapist | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [signerName, setSignerName] = useState("");
  const [signerAddress, setSignerAddress] = useState("");
  const [signed, setSigned] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data: c } = await supabase.from("contracts").select("*").eq("token", token).maybeSingle();
      if (!c) { setError("契約書が見つかりません。URLを確認してください。"); setLoading(false); return; }
      if (c.status === "signed") { setDone(true); setContract(c); setLoading(false); return; }
      setContract(c);
      const { data: t } = await supabase.from("therapists").select("id, name").eq("id", c.therapist_id).maybeSingle();
      if (t) setTherapist(t);
      setLoading(false);
    };
    if (token) load();
  }, [token]);

  // Canvas setup
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = canvas.offsetWidth * 2;
    canvas.height = canvas.offsetHeight * 2;
    ctx.scale(2, 2);
    ctx.strokeStyle = "#1a1a2e";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, [loading, done]);

  const getPos = (e: React.TouchEvent | React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if ("touches" in e) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
  };

  const startDraw = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    drawing.current = true;
    lastPos.current = getPos(e);
    setSigned(true);
  };

  const moveDraw = (e: React.TouchEvent | React.MouseEvent) => {
    if (!drawing.current || !lastPos.current) return;
    e.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPos.current = pos;
  };

  const endDraw = () => { drawing.current = false; lastPos.current = null; };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setSigned(false);
  };

  const handleSubmit = async () => {
    if (!contract || !signerName.trim() || !signed) return;
    setSubmitting(true);

    // Canvas → Blob → Supabase Storage
    const canvas = canvasRef.current;
    if (!canvas) return;
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/png"));
    if (!blob) { setSubmitting(false); return; }

    const fileName = `contract_sig_${contract.id}_${Date.now()}.png`;
    const { error: upErr } = await supabase.storage.from("manual-images").upload(fileName, blob, { contentType: "image/png" });
    if (upErr) { alert("署名アップロードエラー: " + upErr.message); setSubmitting(false); return; }
    const { data: urlData } = supabase.storage.from("manual-images").getPublicUrl(fileName);

    await supabase.from("contracts").update({
      status: "signed",
      signer_name: signerName.trim(),
      signer_address: signerAddress.trim(),
      signature_url: urlData.publicUrl,
      signed_at: new Date().toISOString(),
    }).eq("id", contract.id);

    setDone(true);
    setSubmitting(false);
  };

  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#faf9f7" }}>
      <p style={{ color: "#999", fontSize: 14 }}>読み込み中...</p>
    </div>
  );

  if (error) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#faf9f7", padding: 20 }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>⚠️</div>
        <p style={{ color: "#c45555", fontSize: 14 }}>{error}</p>
      </div>
    </div>
  );

  if (done) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#faf9f7", padding: 20 }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1a1a2e", marginBottom: 8 }}>署名完了</h2>
        <p style={{ fontSize: 13, color: "#666" }}>業務委託契約書の署名が完了しました。</p>
        <p style={{ fontSize: 12, color: "#999", marginTop: 8 }}>このページを閉じてください。</p>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#faf9f7", paddingBottom: 40 }}>
      {/* ヘッダー */}
      <div style={{ backgroundColor: "#1a1a2e", color: "#fff", padding: "16px 20px", textAlign: "center" }}>
        <p style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", letterSpacing: 2 }}>RELAXATION SALON</p>
        <h1 style={{ fontSize: 16, fontWeight: 600, margin: "4px 0" }}>業務委託契約書</h1>
        <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>Ange Spa（アンジュスパ）</p>
      </div>

      <div style={{ maxWidth: 480, margin: "0 auto", padding: "20px 16px" }}>
        {/* 契約者情報 */}
        {therapist && (
          <div style={{ padding: "12px 16px", borderRadius: 12, backgroundColor: "#fff", border: "1px solid #e8e4de", marginBottom: 16 }}>
            <p style={{ fontSize: 11, color: "#999" }}>契約対象セラピスト</p>
            <p style={{ fontSize: 15, fontWeight: 600, color: "#1a1a2e" }}>{therapist.name}</p>
          </div>
        )}

        {/* 契約書本文 */}
        <div style={{ padding: "20px 16px", borderRadius: 12, backgroundColor: "#fff", border: "1px solid #e8e4de", marginBottom: 16, fontSize: 12, lineHeight: 1.8, color: "#333" }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, textAlign: "center", marginBottom: 16, color: "#1a1a2e" }}>業務委託契約書</h2>

          <p>株式会社アンジュスパ（以下「甲」という）と、署名者（以下「乙」という）は、以下のとおり業務委託契約を締結する。</p>

          <h3 style={{ fontSize: 12, fontWeight: 600, marginTop: 16, marginBottom: 4, color: "#1a1a2e" }}>第1条（委託業務）</h3>
          <p>甲は乙に対し、リラクゼーション施術業務を委託し、乙はこれを受託する。</p>

          <h3 style={{ fontSize: 12, fontWeight: 600, marginTop: 16, marginBottom: 4, color: "#1a1a2e" }}>第2条（業務遂行）</h3>
          <p>乙は、甲の定める施術基準及びマニュアルに従い、誠実に業務を遂行するものとする。</p>

          <h3 style={{ fontSize: 12, fontWeight: 600, marginTop: 16, marginBottom: 4, color: "#1a1a2e" }}>第3条（報酬）</h3>
          <p>甲は乙に対し、別途定める報酬規定に基づき、業務委託報酬を支払うものとする。</p>

          <h3 style={{ fontSize: 12, fontWeight: 600, marginTop: 16, marginBottom: 4, color: "#1a1a2e" }}>第4条（秘密保持）</h3>
          <p>乙は、業務上知り得た甲の顧客情報、営業秘密その他の機密情報を第三者に開示・漏洩してはならない。本契約終了後も同様とする。</p>

          <h3 style={{ fontSize: 12, fontWeight: 600, marginTop: 16, marginBottom: 4, color: "#1a1a2e" }}>第5条（契約期間）</h3>
          <p>本契約の有効期間は、契約締結日より1年間とする。期間満了の1ヶ月前までに甲乙いずれからも書面による解約の申し出がない場合、同一条件でさらに1年間自動更新されるものとする。</p>

          <h3 style={{ fontSize: 12, fontWeight: 600, marginTop: 16, marginBottom: 4, color: "#1a1a2e" }}>第6条（解除）</h3>
          <p>甲又は乙は、相手方が本契約に違反した場合、催告のうえ本契約を解除することができる。</p>

          <p style={{ marginTop: 20, fontSize: 11, color: "#666", textAlign: "center" }}>以上の内容に同意のうえ、以下に署名してください。</p>
        </div>

        {/* 入力フォーム */}
        <div style={{ padding: "16px", borderRadius: 12, backgroundColor: "#fff", border: "1px solid #e8e4de", marginBottom: 16 }}>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, color: "#666", display: "block", marginBottom: 4 }}>氏名（必須）</label>
            <input type="text" value={signerName} onChange={e => setSignerName(e.target.value)}
              placeholder="山田 花子" style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid #e8e4de", fontSize: 14, outline: "none" }} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: "#666", display: "block", marginBottom: 4 }}>住所</label>
            <input type="text" value={signerAddress} onChange={e => setSignerAddress(e.target.value)}
              placeholder="愛知県安城市..." style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid #e8e4de", fontSize: 14, outline: "none" }} />
          </div>
        </div>

        {/* 署名エリア */}
        <div style={{ padding: "16px", borderRadius: 12, backgroundColor: "#fff", border: "1px solid #e8e4de", marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <label style={{ fontSize: 11, color: "#666" }}>✍️ 署名（指でなぞってください）</label>
            <button onClick={clearCanvas} style={{ fontSize: 10, color: "#c45555", background: "none", border: "1px solid #c4555544", borderRadius: 6, padding: "2px 8px", cursor: "pointer" }}>クリア</button>
          </div>
          <canvas
            ref={canvasRef}
            onTouchStart={startDraw}
            onTouchMove={moveDraw}
            onTouchEnd={endDraw}
            onMouseDown={startDraw}
            onMouseMove={moveDraw}
            onMouseUp={endDraw}
            onMouseLeave={endDraw}
            style={{
              width: "100%", height: 150, borderRadius: 8,
              border: signed ? "2px solid #c3a782" : "2px dashed #ddd",
              backgroundColor: "#fefefe", touchAction: "none", cursor: "crosshair",
            }}
          />
          {!signed && <p style={{ fontSize: 10, color: "#bbb", textAlign: "center", marginTop: 4 }}>↑ ここに指で署名</p>}
        </div>

        {/* 署名日 */}
        <div style={{ padding: "12px 16px", borderRadius: 12, backgroundColor: "#fff", border: "1px solid #e8e4de", marginBottom: 20, fontSize: 12, color: "#666" }}>
          <span>署名日: </span>
          <span style={{ fontWeight: 600, color: "#1a1a2e" }}>{new Date().toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" })}</span>
        </div>

        {/* 送信ボタン */}
        <button
          onClick={handleSubmit}
          disabled={!signerName.trim() || !signed || submitting}
          style={{
            width: "100%", padding: "16px", borderRadius: 12, border: "none",
            background: (!signerName.trim() || !signed) ? "#ddd" : "linear-gradient(135deg, #c3a782, #a8895e)",
            color: (!signerName.trim() || !signed) ? "#999" : "#fff",
            fontSize: 15, fontWeight: 600, cursor: (!signerName.trim() || !signed) ? "not-allowed" : "pointer",
          }}
        >
          {submitting ? "送信中..." : "✍️ 署名して契約に同意する"}
        </button>

        {!signerName.trim() && <p style={{ fontSize: 10, color: "#c45555", textAlign: "center", marginTop: 8 }}>※ 氏名を入力してください</p>}
        {signerName.trim() && !signed && <p style={{ fontSize: 10, color: "#c45555", textAlign: "center", marginTop: 8 }}>※ 署名エリアに署名してください</p>}
      </div>
    </div>
  );
}
