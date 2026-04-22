"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../lib/supabase";

// 現行の契約書バージョン — 条項を改訂したら必ず更新すること
// v1.0 = 6条版(株式会社アンジュスパ表記) / v2.0 = 12条版(合同会社テラスライフ)
const CURRENT_CONTRACT_VERSION = "v2.0";

type Contract = { id: number; therapist_id: number; token: string; status: string; signer_name: string; signer_address: string; signature_url: string; signed_at: string; created_at: string; contract_version: string | null };
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
    ctx.strokeStyle = "#2b2b2b";
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
      contract_version: CURRENT_CONTRACT_VERSION,
    }).eq("id", contract.id);

    setDone(true);
    setSubmitting(false);
  };

  // HP世界観のためのフォント・背景定数
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
        <p style={{ margin: 0, fontFamily: FONT_DISPLAY, fontSize: 11, letterSpacing: "0.3em", color: "#6b9b7e", fontWeight: 500 }}>SIGNED</p>
        <h2 style={{ margin: "6px 0 10px", fontSize: 17, fontWeight: 500, letterSpacing: "0.1em", color: "#2b2b2b" }}>署名完了</h2>
        <div style={{ width: 24, height: 1, backgroundColor: "#6b9b7e", margin: "0 auto 10px" }} />
        <p style={{ margin: 0, fontSize: 12, color: "#555555", letterSpacing: "0.05em", lineHeight: 1.9 }}>業務委託契約書の署名が<br />完了しました。</p>
        <p style={{ margin: "14px 0 0", fontSize: 11, color: "#b5b5b5", letterSpacing: "0.08em" }}>このページを閉じてください</p>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", ...MARBLE_BG, paddingBottom: 40, fontFamily: FONT_SERIF, color: "#2b2b2b" }}>
      {/* ヘッダー */}
      <div style={{ padding: "36px 20px 24px", textAlign: "center", borderBottom: "1px solid #e5ded6", backgroundColor: "rgba(255,255,255,0.5)", backdropFilter: "blur(6px)" }}>
        <div style={{ width: 1, height: 24, backgroundColor: "#e8849a", margin: "0 auto 12px" }} />
        <p style={{ margin: 0, fontFamily: FONT_DISPLAY, fontSize: 10, letterSpacing: "0.3em", color: "#c96b83", fontWeight: 500 }}>CONTRACT</p>
        <h1 style={{ margin: "6px 0 8px", fontFamily: FONT_SERIF, fontSize: 16, fontWeight: 500, letterSpacing: "0.12em" }}>業務委託契約書</h1>
        <div style={{ width: 30, height: 1, backgroundColor: "#e8849a", margin: "0 auto 8px" }} />
        <p style={{ margin: 0, fontFamily: FONT_DISPLAY, fontSize: 10, letterSpacing: "0.3em", color: "#8a8a8a" }}>ANGE SPA</p>
      </div>

      <div style={{ maxWidth: 480, margin: "0 auto", padding: "24px 16px" }}>
        {/* 契約者情報 */}
        {therapist && (
          <div style={{ padding: "14px 18px", backgroundColor: "#ffffff", border: "1px solid #e5ded6", marginBottom: 16 }}>
            <p style={{ margin: 0, fontFamily: FONT_DISPLAY, fontSize: 10, letterSpacing: "0.2em", color: "#8a8a8a", fontWeight: 500 }}>THERAPIST</p>
            <p style={{ margin: "3px 0 0", fontSize: 15, fontWeight: 500, color: "#2b2b2b", letterSpacing: "0.05em" }}>{therapist.name}</p>
          </div>
        )}

        {/* 契約書本文 */}
        <div style={{ padding: "22px 20px", backgroundColor: "#ffffff", border: "1px solid #e5ded6", marginBottom: 16, fontSize: 12, lineHeight: 2.0, color: "#2b2b2b", letterSpacing: "0.02em" }}>
          <div style={{ textAlign: "center", marginBottom: 18, paddingBottom: 14, borderBottom: "1px solid #e5ded6" }}>
            <p style={{ margin: 0, fontFamily: FONT_DISPLAY, fontSize: 10, letterSpacing: "0.25em", color: "#c96b83", fontWeight: 500 }}>AGREEMENT</p>
            <h2 style={{ margin: "4px 0 6px", fontSize: 14, fontWeight: 500, letterSpacing: "0.12em", color: "#2b2b2b" }}>業務委託契約書</h2>
            <div style={{ width: 24, height: 1, backgroundColor: "#e8849a", margin: "0 auto 6px" }} />
            <p style={{ margin: 0, fontFamily: "'Inter', sans-serif", fontSize: 10, color: "#b5b5b5", letterSpacing: "0.1em" }}>Version {CURRENT_CONTRACT_VERSION}</p>
          </div>

          <p>合同会社テラスライフ（屋号：Ange Spa。以下「甲」という）と、受託者（以下「乙」という）は、甲が運営する店舗におけるセラピー業務等の委託に関して、以下の通り契約を締結する。</p>

          <h3 style={{ fontSize: 12, fontWeight: 500, marginTop: 18, marginBottom: 6, color: "#c96b83", letterSpacing: "0.08em" }}>第1条（業務の内容）</h3>
          <p>乙は、甲の委託を受け、以下の業務を行うものとする。</p>
          <ol style={{ paddingLeft: 22, margin: "4px 0" }}>
            <li>顧客へのエステ・セラピーサービスの提供</li>
            <li>顧客からの代金の受領、代金の管理</li>
            <li>乙が使用した施術ルームおよび備品の清掃、整理整頓</li>
            <li>店舗運営に付随する事務連絡への対応</li>
            <li>前各号に付随する一切の業務</li>
          </ol>

          <h3 style={{ fontSize: 12, fontWeight: 500, marginTop: 18, marginBottom: 6, color: "#c96b83", letterSpacing: "0.08em" }}>第2条（業務の実施）</h3>
          <ol style={{ paddingLeft: 22, margin: "4px 0" }}>
            <li>乙は、甲との合意の上、自己の裁量により業務日時を設定するものとする。ただし、一度確定した予約またはシフトに関しては、正当な理由なく中止・遅延してはならない。</li>
            <li>やむを得ぬ理由で業務に従事できない場合は、直ちに甲に通知し、承認を得るものとする。</li>
          </ol>

          <h3 style={{ fontSize: 12, fontWeight: 500, marginTop: 18, marginBottom: 6, color: "#c96b83", letterSpacing: "0.08em" }}>第3条（委託料の支払い）</h3>
          <ol style={{ paddingLeft: 22, margin: "4px 0" }}>
            <li>甲は、乙に対し、当日の業務終了後に規定の委託料を現金または振込にて支払うものとする。</li>
            <li>オプション料金等に関しては、乙の自己管理とし、甲はこれに関与せず、一切の責任を負わない。</li>
            <li>報酬額は消費税相当額を含むものとする。ただし、乙が適格請求書発行事業者でない場合、甲が被る消費税の仕入税額控除の制限相当額について、甲乙協議の上、報酬額を調整できるものとする。</li>
          </ol>

          <h3 style={{ fontSize: 12, fontWeight: 500, marginTop: 18, marginBottom: 6, color: "#c96b83", letterSpacing: "0.08em" }}>第4条（費用負担）</h3>
          <p>業務遂行に要する消耗品（オイル、タオル等）の費用、および店舗設備の使用料については、別途甲乙間で定める規則に従うものとする。</p>

          <h3 style={{ fontSize: 12, fontWeight: 500, marginTop: 18, marginBottom: 6, color: "#c96b83", letterSpacing: "0.08em" }}>第5条（禁止事項）</h3>
          <p>乙は、以下の行為を行ってはならない。</p>
          <ol style={{ paddingLeft: 22, margin: "4px 0" }}>
            <li>接客において、風俗行為・売春行為を行うこと、またはそれを助長すること。</li>
            <li>宣伝・集客活動において、風俗行為を想起させる文言・画像を使用すること。</li>
            <li>甲の許可なく、同業他社との兼業（掛け持ち）を行うこと。</li>
            <li>本契約に基づき知り得た顧客との私的な接触、私的な金銭の授受、または他社への勧誘。</li>
            <li>甲の名誉や信用を毀損する行為。</li>
          </ol>

          <h3 style={{ fontSize: 12, fontWeight: 500, marginTop: 18, marginBottom: 6, color: "#c96b83", letterSpacing: "0.08em" }}>第6条（肖像の利用およびプライバシーへの配慮）</h3>
          <ol style={{ paddingLeft: 22, margin: "4px 0" }}>
            <li>乙は、甲が店舗の宣伝・広告（ウェブサイト、SNS、広告媒体等）を目的として、乙の容姿を撮影した写真または動画等を利用することを承諾する。ただし、撮影および掲載にあたっては、乙の希望する露出範囲（顔出しの有無、加工の程度等）を事前に確認し、乙のプライバシーおよび身分秘匿に十分配慮するものとする。</li>
            <li>甲は、前項の目的の範囲内において、乙の肖像を改変（加工・修正・スタンプ等による顔隠し等）して利用することができる。</li>
            <li>乙は、事前に合意した範囲内での利用である限り、甲による肖像の利用に関し、肖像権、パブリシティ権、著作者人格権等の権利を行使しないものとする。</li>
            <li>本契約が終了した場合、甲は甲が管理・運用する媒体（公式サイト、自社SNS等）から、速やかに乙の肖像を削除するものとする。</li>
            <li>甲の管理下にない外部ポータルサイト、検索エンジン、キャッシュ等に掲載された情報について、甲は契約終了後、速やかに当該媒体運営者に対し削除依頼等の可能な限りの措置を講じるものとする。ただし、外部媒体の性質上、完全な削除を保証するものではなく、甲の責めに帰すべき事由によらず削除がなされない場合、甲はその責任を負わないものとする。</li>
          </ol>

          <h3 style={{ fontSize: 12, fontWeight: 500, marginTop: 18, marginBottom: 6, color: "#c96b83", letterSpacing: "0.08em" }}>第7条（秘密保持）</h3>
          <p>甲および乙は、本契約の履行過程で知り得た相手方の機密情報（顧客情報、運営ノウハウ等を含む）を、第三者に開示・漏洩してはならない。本条の義務は本契約終了後も存続する。</p>

          <h3 style={{ fontSize: 12, fontWeight: 500, marginTop: 18, marginBottom: 6, color: "#c96b83", letterSpacing: "0.08em" }}>第8条（引き抜き等の禁止）</h3>
          <p>乙は、本契約期間中および本契約終了後2年間、甲の事前の承諾なく以下の行為を行ってはならない。</p>
          <ol style={{ paddingLeft: 22, margin: "4px 0" }}>
            <li>甲の顧客に対し、甲を介さず直接連絡を取り、施術等のサービスを提供すること。</li>
            <li>甲の他のセラピストや従業員を、他店や自己の事業へ勧誘すること。</li>
          </ol>

          <h3 style={{ fontSize: 12, fontWeight: 500, marginTop: 18, marginBottom: 6, color: "#c96b83", letterSpacing: "0.08em" }}>第9条（反社会的勢力の排除）</h3>
          <ol style={{ paddingLeft: 22, margin: "4px 0" }}>
            <li>甲および乙は、自らが暴力団、暴力団員、暴力団関係企業、総会屋、その他これらに準ずる反社会的勢力に該当しないことを表明し、将来にわたっても該当しないことを確約する。</li>
            <li>一方が前項に違反した場合、相手方は何ら催告を要せず、直ちに本契約を解除することができる。</li>
          </ol>

          <h3 style={{ fontSize: 12, fontWeight: 500, marginTop: 18, marginBottom: 6, color: "#c96b83", letterSpacing: "0.08em" }}>第10条（契約期間・解除）</h3>
          <ol style={{ paddingLeft: 22, margin: "4px 0" }}>
            <li>本契約の有効期間は、契約締結日から1ヶ月間とする。期間満了の2週間前までに甲乙いずれからも申し出がない限り、同一条件で1ヶ月ごとに自動更新されるものとする。</li>
            <li>甲は、乙が本契約の条項に違反した場合、何ら催告を要せず直ちに本契約を解除できるものとする。</li>
          </ol>

          <h3 style={{ fontSize: 12, fontWeight: 500, marginTop: 18, marginBottom: 6, color: "#c96b83", letterSpacing: "0.08em" }}>第11条（損害賠償）</h3>
          <p>甲または乙は、本契約の義務に違反し、相手方に損害を与えた場合、その損害を賠償する責任を負う。乙の不注意により顧客に怪我を負わせる等、甲に損害が生じた場合も同様とする。</p>

          <h3 style={{ fontSize: 12, fontWeight: 500, marginTop: 18, marginBottom: 6, color: "#c96b83", letterSpacing: "0.08em" }}>第12条（合意管轄）</h3>
          <p>本契約に関する紛争については、名古屋地方裁判所を第一審の専属的合意管轄裁判所とする。</p>

          <p style={{ marginTop: 16 }}>本契約は、乙が甲の管理するオンラインシステム（T-MANAGE）上で電子署名を行うことにより締結される。署名済み契約書は甲のシステム内に電磁的に保管され、甲乙双方がいつでも閲覧できるものとする。本書2通の作成および記名押印による交付は要しない。</p>

          <p style={{ marginTop: 22, paddingTop: 14, borderTop: "1px solid #e5ded6", fontSize: 11, color: "#555555", textAlign: "center", letterSpacing: "0.05em", lineHeight: 1.9 }}>以上の内容に同意のうえ、<br />以下に署名してください。</p>
        </div>

        {/* 入力フォーム */}
        <div style={{ padding: "18px 18px", backgroundColor: "#ffffff", border: "1px solid #e5ded6", marginBottom: 16 }}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", marginBottom: 6 }}>
              <span style={{ fontFamily: FONT_DISPLAY, fontSize: 10, letterSpacing: "0.2em", color: "#c96b83", fontWeight: 500 }}>NAME</span>
            </label>
            <p style={{ margin: "0 0 6px", fontSize: 11, color: "#555555", letterSpacing: "0.03em" }}>氏名 <span style={{ color: "#c96b83" }}>*</span></p>
            <input type="text" value={signerName} onChange={e => setSignerName(e.target.value)}
              placeholder="山田 花子"
              style={{ width: "100%", padding: "11px 14px", border: "1px solid #e5ded6", fontSize: 14, outline: "none", backgroundColor: "#faf6f1", fontFamily: FONT_SERIF, color: "#2b2b2b", boxSizing: "border-box", letterSpacing: "0.03em" }} />
          </div>
          <div>
            <label style={{ display: "block", marginBottom: 6 }}>
              <span style={{ fontFamily: FONT_DISPLAY, fontSize: 10, letterSpacing: "0.2em", color: "#c96b83", fontWeight: 500 }}>ADDRESS</span>
            </label>
            <p style={{ margin: "0 0 6px", fontSize: 11, color: "#555555", letterSpacing: "0.03em" }}>住所</p>
            <input type="text" value={signerAddress} onChange={e => setSignerAddress(e.target.value)}
              placeholder="愛知県安城市…"
              style={{ width: "100%", padding: "11px 14px", border: "1px solid #e5ded6", fontSize: 14, outline: "none", backgroundColor: "#faf6f1", fontFamily: FONT_SERIF, color: "#2b2b2b", boxSizing: "border-box", letterSpacing: "0.03em" }} />
          </div>
        </div>

        {/* 署名エリア */}
        <div style={{ padding: "18px 18px", backgroundColor: "#ffffff", border: "1px solid #e5ded6", marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div>
              <span style={{ fontFamily: FONT_DISPLAY, fontSize: 10, letterSpacing: "0.2em", color: "#c96b83", fontWeight: 500 }}>SIGNATURE</span>
              <p style={{ margin: "2px 0 0", fontSize: 11, color: "#555555", letterSpacing: "0.03em" }}>✍️ 署名（指でなぞってください）</p>
            </div>
            <button onClick={clearCanvas} style={{ fontSize: 10, color: "#c96b83", backgroundColor: "transparent", border: "1px solid #c96b83", padding: "4px 10px", cursor: "pointer", fontFamily: FONT_SERIF, letterSpacing: "0.05em" }}>クリア</button>
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
              width: "100%", height: 150,
              border: signed ? "1px solid #e8849a" : "1px dashed #d0c8bf",
              backgroundColor: "#faf6f1", touchAction: "none", cursor: "crosshair",
              display: "block",
            }}
          />
          {!signed && <p style={{ fontSize: 10, color: "#b5b5b5", textAlign: "center", marginTop: 6, letterSpacing: "0.05em" }}>↑ ここに指で署名</p>}
        </div>

        {/* 署名日 */}
        <div style={{ padding: "14px 18px", backgroundColor: "#ffffff", border: "1px solid #e5ded6", marginBottom: 20, fontSize: 12, color: "#555555", letterSpacing: "0.05em", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <p style={{ margin: 0, fontFamily: FONT_DISPLAY, fontSize: 10, letterSpacing: "0.2em", color: "#8a8a8a", fontWeight: 500 }}>DATE</p>
            <p style={{ margin: "2px 0 0", fontSize: 11 }}>署名日</p>
          </div>
          <span style={{ fontWeight: 500, color: "#2b2b2b", letterSpacing: "0.03em", fontSize: 13 }}>{new Date().toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" })}</span>
        </div>

        {/* 送信ボタン */}
        <button
          onClick={handleSubmit}
          disabled={!signerName.trim() || !signed || submitting}
          style={{
            width: "100%", padding: "14px 22px", border: "none",
            backgroundColor: (!signerName.trim() || !signed) ? "#d5d0ca" : "#c96b83",
            color: (!signerName.trim() || !signed) ? "#8a8a8a" : "#ffffff",
            fontSize: 13, fontFamily: FONT_SERIF, fontWeight: 500, letterSpacing: "0.2em",
            cursor: (!signerName.trim() || !signed) ? "not-allowed" : "pointer",
          }}
        >
          {submitting ? "送信中…" : "✍️ 署名して契約に同意する"}
        </button>

        {!signerName.trim() && <p style={{ margin: "10px 0 0", fontSize: 10, color: "#c96b83", textAlign: "center", letterSpacing: "0.03em" }}>※ 氏名を入力してください</p>}
        {signerName.trim() && !signed && <p style={{ margin: "10px 0 0", fontSize: 10, color: "#c96b83", textAlign: "center", letterSpacing: "0.03em" }}>※ 署名エリアに署名してください</p>}
      </div>
    </div>
  );
}
