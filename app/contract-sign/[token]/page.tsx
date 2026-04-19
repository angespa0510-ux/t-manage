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

          <p>合同会社テラスライフ（屋号：Ange Spa。以下「甲」という）と、受託者（以下「乙」という）は、甲が運営する店舗におけるセラピー業務等の委託に関して、以下の通り契約を締結する。</p>

          <h3 style={{ fontSize: 12, fontWeight: 600, marginTop: 16, marginBottom: 4, color: "#1a1a2e" }}>第1条（業務の内容）</h3>
          <p>乙は、甲の委託を受け、以下の業務を行うものとする。</p>
          <ol style={{ paddingLeft: 22, margin: "4px 0" }}>
            <li>顧客へのエステ・セラピーサービスの提供</li>
            <li>顧客からの代金の受領、代金の管理</li>
            <li>乙が使用した施術ルームおよび備品の清掃、整理整頓</li>
            <li>店舗運営に付随する事務連絡への対応</li>
            <li>前各号に付随する一切の業務</li>
          </ol>

          <h3 style={{ fontSize: 12, fontWeight: 600, marginTop: 16, marginBottom: 4, color: "#1a1a2e" }}>第2条（業務の実施）</h3>
          <ol style={{ paddingLeft: 22, margin: "4px 0" }}>
            <li>乙は、甲との合意の上、自己の裁量により業務日時を設定するものとする。ただし、一度確定した予約またはシフトに関しては、正当な理由なく中止・遅延してはならない。</li>
            <li>やむを得ぬ理由で業務に従事できない場合は、直ちに甲に通知し、承認を得るものとする。</li>
          </ol>

          <h3 style={{ fontSize: 12, fontWeight: 600, marginTop: 16, marginBottom: 4, color: "#1a1a2e" }}>第3条（委託料の支払い）</h3>
          <ol style={{ paddingLeft: 22, margin: "4px 0" }}>
            <li>甲は、乙に対し、当日の業務終了後に規定の委託料を現金または振込にて支払うものとする。</li>
            <li>オプション料金等に関しては、乙の自己管理とし、甲はこれに関与せず、一切の責任を負わない。</li>
            <li>報酬額は消費税相当額を含むものとする。ただし、乙が適格請求書発行事業者でない場合、甲が被る消費税の仕入税額控除の制限相当額について、甲乙協議の上、報酬額を調整できるものとする。</li>
          </ol>

          <h3 style={{ fontSize: 12, fontWeight: 600, marginTop: 16, marginBottom: 4, color: "#1a1a2e" }}>第4条（費用負担）</h3>
          <p>業務遂行に要する消耗品（オイル、タオル等）の費用、および店舗設備の使用料については、別途甲乙間で定める規則に従うものとする。</p>

          <h3 style={{ fontSize: 12, fontWeight: 600, marginTop: 16, marginBottom: 4, color: "#1a1a2e" }}>第5条（禁止事項）</h3>
          <p>乙は、以下の行為を行ってはならない。</p>
          <ol style={{ paddingLeft: 22, margin: "4px 0" }}>
            <li>接客において、風俗行為・売春行為を行うこと、またはそれを助長すること。</li>
            <li>宣伝・集客活動において、風俗行為を想起させる文言・画像を使用すること。</li>
            <li>甲の許可なく、同業他社との兼業（掛け持ち）を行うこと。</li>
            <li>本契約に基づき知り得た顧客との私的な接触、私的な金銭の授受、または他社への勧誘。</li>
            <li>甲の名誉や信用を毀損する行為。</li>
          </ol>

          <h3 style={{ fontSize: 12, fontWeight: 600, marginTop: 16, marginBottom: 4, color: "#1a1a2e" }}>第6条（肖像の利用およびプライバシーへの配慮）</h3>
          <ol style={{ paddingLeft: 22, margin: "4px 0" }}>
            <li>乙は、甲が店舗の宣伝・広告（ウェブサイト、SNS、広告媒体等）を目的として、乙の容姿を撮影した写真または動画等を利用することを承諾する。ただし、撮影および掲載にあたっては、乙の希望する露出範囲（顔出しの有無、加工の程度等）を事前に確認し、乙のプライバシーおよび身分秘匿に十分配慮するものとする。</li>
            <li>甲は、前項の目的の範囲内において、乙の肖像を改変（加工・修正・スタンプ等による顔隠し等）して利用することができる。</li>
            <li>乙は、事前に合意した範囲内での利用である限り、甲による肖像の利用に関し、肖像権、パブリシティ権、著作者人格権等の権利を行使しないものとする。</li>
            <li>本契約が終了した場合、甲は甲が管理・運用する媒体（公式サイト、自社SNS等）から、速やかに乙の肖像を削除するものとする。</li>
            <li>甲の管理下にない外部ポータルサイト、検索エンジン、キャッシュ等に掲載された情報について、甲は契約終了後、速やかに当該媒体運営者に対し削除依頼等の可能な限りの措置を講じるものとする。ただし、外部媒体の性質上、完全な削除を保証するものではなく、甲の責めに帰すべき事由によらず削除がなされない場合、甲はその責任を負わないものとする。</li>
          </ol>

          <h3 style={{ fontSize: 12, fontWeight: 600, marginTop: 16, marginBottom: 4, color: "#1a1a2e" }}>第7条（秘密保持）</h3>
          <p>甲および乙は、本契約の履行過程で知り得た相手方の機密情報（顧客情報、運営ノウハウ等を含む）を、第三者に開示・漏洩してはならない。本条の義務は本契約終了後も存続する。</p>

          <h3 style={{ fontSize: 12, fontWeight: 600, marginTop: 16, marginBottom: 4, color: "#1a1a2e" }}>第8条（引き抜き等の禁止）</h3>
          <p>乙は、本契約期間中および本契約終了後2年間、甲の事前の承諾なく以下の行為を行ってはならない。</p>
          <ol style={{ paddingLeft: 22, margin: "4px 0" }}>
            <li>甲の顧客に対し、甲を介さず直接連絡を取り、施術等のサービスを提供すること。</li>
            <li>甲の他のセラピストや従業員を、他店や自己の事業へ勧誘すること。</li>
          </ol>

          <h3 style={{ fontSize: 12, fontWeight: 600, marginTop: 16, marginBottom: 4, color: "#1a1a2e" }}>第9条（反社会的勢力の排除）</h3>
          <ol style={{ paddingLeft: 22, margin: "4px 0" }}>
            <li>甲および乙は、自らが暴力団、暴力団員、暴力団関係企業、総会屋、その他これらに準ずる反社会的勢力に該当しないことを表明し、将来にわたっても該当しないことを確約する。</li>
            <li>一方が前項に違反した場合、相手方は何ら催告を要せず、直ちに本契約を解除することができる。</li>
          </ol>

          <h3 style={{ fontSize: 12, fontWeight: 600, marginTop: 16, marginBottom: 4, color: "#1a1a2e" }}>第10条（契約期間・解除）</h3>
          <ol style={{ paddingLeft: 22, margin: "4px 0" }}>
            <li>本契約の有効期間は、契約締結日から1ヶ月間とする。期間満了の2週間前までに甲乙いずれからも申し出がない限り、同一条件で1ヶ月ごとに自動更新されるものとする。</li>
            <li>甲は、乙が本契約の条項に違反した場合、何ら催告を要せず直ちに本契約を解除できるものとする。</li>
          </ol>

          <h3 style={{ fontSize: 12, fontWeight: 600, marginTop: 16, marginBottom: 4, color: "#1a1a2e" }}>第11条（損害賠償）</h3>
          <p>甲または乙は、本契約の義務に違反し、相手方に損害を与えた場合、その損害を賠償する責任を負う。乙の不注意により顧客に怪我を負わせる等、甲に損害が生じた場合も同様とする。</p>

          <h3 style={{ fontSize: 12, fontWeight: 600, marginTop: 16, marginBottom: 4, color: "#1a1a2e" }}>第12条（合意管轄）</h3>
          <p>本契約に関する紛争については、名古屋地方裁判所を第一審の専属的合意管轄裁判所とする。</p>

          <p style={{ marginTop: 16 }}>本契約は、乙が甲の管理するオンラインシステム（T-MANAGE）上で電子署名を行うことにより締結される。署名済み契約書は甲のシステム内に電磁的に保管され、甲乙双方がいつでも閲覧できるものとする。本書2通の作成および記名押印による交付は要しない。</p>

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
