"use client";

/**
 * 業務委託契約書 v3.0 (施術業対応版 / 仕様書呼称 v2)
 *
 * 仕様書: docs/22_CONTRACT_REDESIGN.md
 * 関連メモ: docs/21_TREATMENT_BUSINESS_POSITIONING.md
 *
 * 設計の柱:
 *   1. 施術技術提供契約として表題・前文・第1条を再構成
 *   2. 禁止事項を厚く: 飲酒・同伴・アフター・店外接触の全面禁止
 *   3. 施術業の実態証跡: カルテ記録義務・研修受講義務を明記
 *   4. 業務委託性の補強: 受託者の裁量・自己責任を明確化
 *   5. 税務責任の明記: 源泉徴収なしの根拠と確定申告責任
 *
 * 弁護士レビュー前ドラフト。?preview=v3 クエリ時のみ表示される。
 * page.tsx の DEFAULT_VERSION を v3 に切り替えるとデフォルト適用。
 */

import { useState, useEffect, useRef } from "react";
import { supabase } from "./supabase";

export const CONTRACT_V3_VERSION = "v3.0";

type Contract = {
  id: number;
  therapist_id: number;
  token: string;
  status: string;
  signer_name: string;
  signer_address: string;
  signature_url: string;
  signed_at: string;
  created_at: string;
  contract_version: string | null;
};

type Therapist = { id: number; name: string };

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

// 共通スタイル
const ARTICLE_HEADING: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 500,
  marginTop: 18,
  marginBottom: 6,
  color: "#c96b83",
  letterSpacing: "0.08em",
};
const OL_STYLE: React.CSSProperties = { paddingLeft: 22, margin: "4px 0" };
const NEW_BADGE: React.CSSProperties = {
  display: "inline-block",
  marginLeft: 8,
  padding: "1px 6px",
  fontSize: 9,
  fontFamily: FONT_DISPLAY,
  letterSpacing: "0.15em",
  backgroundColor: "#e8849a",
  color: "#ffffff",
  borderRadius: 0,
  verticalAlign: "middle",
};

export function ContractV3({
  contract,
  therapist,
  onDone,
}: {
  contract: Contract;
  therapist: Therapist | null;
  onDone: () => void;
}) {
  const [signerName, setSignerName] = useState("");
  const [signerAddress, setSignerAddress] = useState("");
  const [signed, setSigned] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // 個別同意フラグ (仕様書 5節 contracts_v2_consents)
  const [consentResearchTraining, setConsentResearchTraining] = useState(false);
  const [consentChartRecord, setConsentChartRecord] = useState(false);
  const [consentNoAlcohol, setConsentNoAlcohol] = useState(false);
  const [consentNoOutsideContact, setConsentNoOutsideContact] = useState(false);
  const allConsentsChecked =
    consentResearchTraining &&
    consentChartRecord &&
    consentNoAlcohol &&
    consentNoOutsideContact;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

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
  }, []);

  const getPos = (e: React.TouchEvent | React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if ("touches" in e) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    }
    return {
      x: (e as React.MouseEvent).clientX - rect.left,
      y: (e as React.MouseEvent).clientY - rect.top,
    };
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

  const endDraw = () => {
    drawing.current = false;
    lastPos.current = null;
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setSigned(false);
  };

  const canSubmit =
    signerName.trim().length > 0 && signed && allConsentsChecked && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);

    // Canvas → Blob → Supabase Storage
    const canvas = canvasRef.current;
    if (!canvas) {
      setSubmitting(false);
      return;
    }
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/png")
    );
    if (!blob) {
      setSubmitting(false);
      return;
    }

    const fileName = `contract_sig_${contract.id}_v3_${Date.now()}.png`;
    const { error: upErr } = await supabase.storage
      .from("manual-images")
      .upload(fileName, blob, { contentType: "image/png" });
    if (upErr) {
      alert("署名アップロードエラー: " + upErr.message);
      setSubmitting(false);
      return;
    }
    const { data: urlData } = supabase.storage
      .from("manual-images")
      .getPublicUrl(fileName);

    // 1. contracts テーブル更新
    const { error: updErr } = await supabase
      .from("contracts")
      .update({
        status: "signed",
        signer_name: signerName.trim(),
        signer_address: signerAddress.trim(),
        signature_url: urlData.publicUrl,
        signed_at: new Date().toISOString(),
        contract_version: CONTRACT_V3_VERSION,
      })
      .eq("id", contract.id);
    if (updErr) {
      alert("契約書更新エラー: " + updErr.message);
      setSubmitting(false);
      return;
    }

    // 2. 個別同意フラグを contracts_v2_consents に記録
    //    (税務調査時の証跡として施術業実態を裏付ける)
    const { error: consentErr } = await supabase
      .from("contracts_v2_consents")
      .insert({
        contract_id: contract.id,
        consent_research_training: consentResearchTraining,
        consent_chart_record: consentChartRecord,
        consent_no_alcohol: consentNoAlcohol,
        consent_no_outside_contact: consentNoOutsideContact,
        agreed_at: new Date().toISOString(),
      });
    if (consentErr) {
      // 同意フラグ保存に失敗しても契約は成立済み。エラーは警告のみ。
      console.error("同意フラグ保存エラー:", consentErr);
    }

    setSubmitting(false);
    onDone();
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        ...MARBLE_BG,
        paddingBottom: 40,
        fontFamily: FONT_SERIF,
        color: "#2b2b2b",
      }}
    >
      {/* ⚠️ 弁護士レビュー前ドラフトバッジ */}
      <div
        style={{
          padding: "10px 16px",
          backgroundColor: "#fff8e7",
          borderBottom: "1px solid #e8b96b",
          textAlign: "center",
          fontSize: 11,
          color: "#8a6a2b",
          letterSpacing: "0.05em",
          lineHeight: 1.7,
        }}
      >
        ⚠️ 弁護士レビュー前ドラフト
        <br />
        <span style={{ fontSize: 10, color: "#a89070" }}>
          このバージョンは確認用です。正式版は弁護士レビュー後に公開されます。
        </span>
      </div>

      {/* ヘッダー */}
      <div
        style={{
          padding: "32px 20px 22px",
          textAlign: "center",
          borderBottom: "1px solid #e5ded6",
          backgroundColor: "rgba(255,255,255,0.5)",
          backdropFilter: "blur(6px)",
        }}
      >
        <div
          style={{
            width: 1,
            height: 24,
            backgroundColor: "#e8849a",
            margin: "0 auto 12px",
          }}
        />
        <p
          style={{
            margin: 0,
            fontFamily: FONT_DISPLAY,
            fontSize: 10,
            letterSpacing: "0.3em",
            color: "#c96b83",
            fontWeight: 500,
          }}
        >
          CONTRACT
        </p>
        <h1
          style={{
            margin: "6px 0 4px",
            fontFamily: FONT_SERIF,
            fontSize: 16,
            fontWeight: 500,
            letterSpacing: "0.12em",
          }}
        >
          業務委託契約書
        </h1>
        <p
          style={{
            margin: 0,
            fontSize: 10,
            color: "#8a8a8a",
            letterSpacing: "0.08em",
          }}
        >
          （施術技術提供契約）
        </p>
        <div
          style={{
            width: 30,
            height: 1,
            backgroundColor: "#e8849a",
            margin: "8px auto 8px",
          }}
        />
        <p
          style={{
            margin: 0,
            fontFamily: FONT_DISPLAY,
            fontSize: 10,
            letterSpacing: "0.3em",
            color: "#8a8a8a",
          }}
        >
          ANGE SPA
        </p>
      </div>

      <div style={{ maxWidth: 480, margin: "0 auto", padding: "24px 16px" }}>
        {/* 契約者情報 */}
        {therapist && (
          <div
            style={{
              padding: "14px 18px",
              backgroundColor: "#ffffff",
              border: "1px solid #e5ded6",
              marginBottom: 16,
            }}
          >
            <p
              style={{
                margin: 0,
                fontFamily: FONT_DISPLAY,
                fontSize: 10,
                letterSpacing: "0.2em",
                color: "#8a8a8a",
                fontWeight: 500,
              }}
            >
              THERAPIST
            </p>
            <p
              style={{
                margin: "3px 0 0",
                fontSize: 15,
                fontWeight: 500,
                color: "#2b2b2b",
                letterSpacing: "0.05em",
              }}
            >
              {therapist.name}
            </p>
          </div>
        )}

        {/* 主な変更点ハイライト (仕様書 3.3 同意フロー) */}
        <div
          style={{
            padding: "18px 20px",
            backgroundColor: "#fdf6f7",
            border: "1px solid #e8849a",
            marginBottom: 16,
          }}
        >
          <p
            style={{
              margin: 0,
              fontFamily: FONT_DISPLAY,
              fontSize: 10,
              letterSpacing: "0.25em",
              color: "#c96b83",
              fontWeight: 500,
            }}
          >
            HIGHLIGHTS
          </p>
          <h3
            style={{
              margin: "4px 0 12px",
              fontSize: 13,
              fontWeight: 500,
              letterSpacing: "0.06em",
              color: "#2b2b2b",
            }}
          >
            主な変更点
          </h3>
          <ul
            style={{
              margin: 0,
              paddingLeft: 18,
              fontSize: 12,
              lineHeight: 1.9,
              color: "#2b2b2b",
            }}
          >
            <li>
              <strong>第10条</strong> 施術技術研修の受講義務（新設）
            </li>
            <li>
              <strong>第11条</strong> 施術カルテの記録義務（新設）
            </li>
            <li>
              <strong>第5条</strong> 酒類提供・同伴・アフター・店外接触の全面禁止（明文化）
            </li>
            <li>
              <strong>第3条</strong> 源泉徴収なしの根拠と確定申告責任を明記
            </li>
          </ul>
          <p
            style={{
              margin: "10px 0 0",
              fontSize: 10,
              color: "#8a6680",
              letterSpacing: "0.02em",
              lineHeight: 1.7,
            }}
          >
            これらは「施術業」として税務上一貫したポジショニングを取るための重要な改訂です。
          </p>
        </div>

        {/* 契約書本文 */}
        <div
          style={{
            padding: "22px 20px",
            backgroundColor: "#ffffff",
            border: "1px solid #e5ded6",
            marginBottom: 16,
            fontSize: 12,
            lineHeight: 2.0,
            color: "#2b2b2b",
            letterSpacing: "0.02em",
          }}
        >
          <div
            style={{
              textAlign: "center",
              marginBottom: 18,
              paddingBottom: 14,
              borderBottom: "1px solid #e5ded6",
            }}
          >
            <p
              style={{
                margin: 0,
                fontFamily: FONT_DISPLAY,
                fontSize: 10,
                letterSpacing: "0.25em",
                color: "#c96b83",
                fontWeight: 500,
              }}
            >
              AGREEMENT
            </p>
            <h2
              style={{
                margin: "4px 0 4px",
                fontSize: 14,
                fontWeight: 500,
                letterSpacing: "0.08em",
                color: "#2b2b2b",
              }}
            >
              業務委託契約書（施術技術提供契約）
            </h2>
            <div
              style={{
                width: 24,
                height: 1,
                backgroundColor: "#e8849a",
                margin: "6px auto 6px",
              }}
            />
            <p
              style={{
                margin: 0,
                fontFamily: "'Inter', sans-serif",
                fontSize: 10,
                color: "#b5b5b5",
                letterSpacing: "0.1em",
              }}
            >
              Version {CONTRACT_V3_VERSION}
            </p>
          </div>

          {/* 前文 */}
          <p>
            合同会社テラスライフ（屋号：Ange Spa。以下「甲」という）と、受託者（以下「乙」という）は、甲が運営する店舗におけるリラクゼーション施術業務（ボディケア・アロマトリートメント・リンパケア等）の業務委託に関して、以下の通り契約を締結する。
          </p>
          <p>
            本契約は、乙が独立した個人事業主として、甲に対し施術技術を提供する業務委託契約であり、雇用関係を生じさせるものではない。
          </p>

          {/* 第1条 業務の内容 */}
          <h3 style={ARTICLE_HEADING}>第1条（業務の内容）</h3>
          <p>乙は、甲の委託を受け、以下の業務を行うものとする。</p>
          <ol style={OL_STYLE}>
            <li>
              リラクゼーション施術業務（ボディケア・アロマトリートメント・リンパケア・指圧・スウェディッシュ等の施術技術の提供）
            </li>
            <li>施術前の体調・希望のカウンセリング</li>
            <li>施術内容のカルテ記録</li>
            <li>顧客からの代金の受領、代金の管理</li>
            <li>乙が使用した施術ルームおよび備品の清掃、整理整頓</li>
            <li>店舗運営に付随する事務連絡への対応</li>
            <li>前各号に付随する一切の業務</li>
          </ol>

          {/* 第2条 業務の実施・受託者の裁量 */}
          <h3 style={ARTICLE_HEADING}>第2条（業務の実施・受託者の裁量）</h3>
          <ol style={OL_STYLE}>
            <li>
              乙は、自己の独立した事業として、自己の裁量により業務を遂行するものとする。
            </li>
            <li>
              乙は、自己の判断により、業務日時・出勤頻度を設定し、甲は乙に対し業務時間や勤務日数を強制しない。ただし、一度確定した予約またはシフトに関しては、正当な理由なく中止・遅延してはならない。
            </li>
            <li>
              乙は、提供する施術コースの種類について、自己の技術習熟度に応じて選択する裁量を有する。
            </li>
            <li>
              やむを得ぬ理由で業務に従事できない場合は、直ちに甲に通知するものとする。
            </li>
          </ol>

          {/* 第3条 委託料の支払いおよび税務 */}
          <h3 style={ARTICLE_HEADING}>第3条（委託料の支払いおよび税務）</h3>
          <ol style={OL_STYLE}>
            <li>
              甲は、乙に対し、当日の業務終了後に規定の委託料を現金または振込にて支払うものとする。委託料は、乙が提供した施術コースごとに算定する技術提供報酬とする。
            </li>
            <li>
              本契約に基づく報酬は、所得税法上、源泉徴収の対象となる業務に該当しないため、甲は乙の報酬から所得税の源泉徴収を行わない。乙は、自らの責任において確定申告を行うものとする。
            </li>
            <li>
              オプション料金等に関しては、乙の自己管理とし、甲はこれに関与せず、一切の責任を負わない。
            </li>
            <li>
              報酬額は消費税相当額を含むものとする。ただし、乙が適格請求書発行事業者でない場合、甲が被る消費税の仕入税額控除の制限相当額について、甲乙協議の上、報酬額を調整できるものとする。
            </li>
          </ol>

          {/* 第4条 費用負担 */}
          <h3 style={ARTICLE_HEADING}>第4条（費用負担）</h3>
          <p>
            業務遂行に要する消耗品（オイル、タオル、リネン等）の費用、および店舗設備の使用料については、別途甲乙間で定める規則に従うものとする。乙の業務遂行のために甲が提供する備品・リネン代は、委託料から控除する形で精算する。
          </p>

          {/* 第5条 禁止事項 */}
          <h3 style={ARTICLE_HEADING}>第5条（禁止事項）</h3>
          <p>乙は、以下の行為を行ってはならない。</p>
          <ol style={OL_STYLE}>
            <li>
              施術業務において、風俗行為・売春行為を行うこと、またはそれを助長すること。
            </li>
            <li>
              宣伝・集客活動において、風俗行為を想起させる文言・画像を使用すること。
            </li>
            <li>
              店舗内において、酒類の提供を受けること、または顧客と共に飲酒すること。
              <span style={NEW_BADGE}>NEW</span>
            </li>
            <li>
              顧客との店外での飲食、同伴、送迎、アフター（業務時間外の私的な交際）を行うこと。
              <span style={NEW_BADGE}>NEW</span>
            </li>
            <li>
              業務時間外に、顧客と私的な連絡（電話・SNS・メッセージ等）を取ること。
              <span style={NEW_BADGE}>NEW</span>
            </li>
            <li>甲の許可なく、同業他社との兼業（掛け持ち）を行うこと。</li>
            <li>
              本契約に基づき知り得た顧客との私的な接触、私的な金銭の授受、または他社への勧誘。
            </li>
            <li>甲の名誉や信用を毀損する行為。</li>
            <li>
              施術カルテへの記録を怠ること、または虚偽の記録を行うこと（第11条参照）。
            </li>
          </ol>

          {/* 第6条 肖像の利用 */}
          <h3 style={ARTICLE_HEADING}>第6条（肖像の利用およびプライバシーへの配慮）</h3>
          <ol style={OL_STYLE}>
            <li>
              乙は、甲が店舗の宣伝・広告（ウェブサイト、SNS、広告媒体等）を目的として、乙の容姿を撮影した写真または動画等を利用することを承諾する。ただし、撮影および掲載にあたっては、乙の希望する露出範囲（顔出しの有無、加工の程度等）を事前に確認し、乙のプライバシーおよび身分秘匿に十分配慮するものとする。
            </li>
            <li>
              甲は、前項の目的の範囲内において、乙の肖像を改変（加工・修正・スタンプ等による顔隠し等）して利用することができる。
            </li>
            <li>
              乙は、事前に合意した範囲内での利用である限り、甲による肖像の利用に関し、肖像権、パブリシティ権、著作者人格権等の権利を行使しないものとする。
            </li>
            <li>
              本契約が終了した場合、甲は甲が管理・運用する媒体（公式サイト、自社SNS等）から、速やかに乙の肖像を削除するものとする。
            </li>
            <li>
              甲の管理下にない外部ポータルサイト、検索エンジン、キャッシュ等に掲載された情報について、甲は契約終了後、速やかに当該媒体運営者に対し削除依頼等の可能な限りの措置を講じるものとする。ただし、外部媒体の性質上、完全な削除を保証するものではなく、甲の責めに帰すべき事由によらず削除がなされない場合、甲はその責任を負わないものとする。
            </li>
          </ol>

          {/* 第7条 秘密保持 */}
          <h3 style={ARTICLE_HEADING}>第7条（秘密保持）</h3>
          <p>
            甲および乙は、本契約の履行過程で知り得た相手方の機密情報（顧客情報、運営ノウハウ、施術技術等を含む）を、第三者に開示・漏洩してはならない。本条の義務は本契約終了後も存続する。
          </p>

          {/* 第8条 引き抜き等の禁止 */}
          <h3 style={ARTICLE_HEADING}>第8条（引き抜き等の禁止）</h3>
          <p>
            乙は、本契約期間中および本契約終了後2年間、甲の事前の承諾なく以下の行為を行ってはならない。
          </p>
          <ol style={OL_STYLE}>
            <li>
              甲の顧客に対し、甲を介さず直接連絡を取り、施術等のサービスを提供すること。
            </li>
            <li>
              甲の他のセラピストや従業員を、他店や自己の事業へ勧誘すること。
            </li>
          </ol>

          {/* 第9条 反社会的勢力の排除 */}
          <h3 style={ARTICLE_HEADING}>第9条（反社会的勢力の排除）</h3>
          <ol style={OL_STYLE}>
            <li>
              甲および乙は、自らが暴力団、暴力団員、暴力団関係企業、総会屋、その他これらに準ずる反社会的勢力に該当しないことを表明し、将来にわたっても該当しないことを確約する。
            </li>
            <li>
              一方が前項に違反した場合、相手方は何ら催告を要せず、直ちに本契約を解除することができる。
            </li>
          </ol>

          {/* 第10条 施術技術の研修受講義務 (新設) */}
          <h3 style={ARTICLE_HEADING}>
            第10条（施術技術の研修受講義務）
            <span style={NEW_BADGE}>NEW</span>
          </h3>
          <ol style={OL_STYLE}>
            <li>
              乙は、甲が定める施術技術研修プログラムを受講し、施術技術の習得・維持に努めるものとする。
            </li>
            <li>
              甲は、乙に対し、解剖学の基礎、リンパケア、オイルトリートメント等の施術技術に関する研修を提供する。
            </li>
            <li>
              研修の受講記録は、甲が管理するシステムにおいて記録する。
            </li>
            <li>
              乙は、新しい施術コースを提供するにあたり、当該コースに対応する研修を事前に受講するものとする。
            </li>
          </ol>

          {/* 第11条 施術カルテの記録義務 (新設) */}
          <h3 style={ARTICLE_HEADING}>
            第11条（施術カルテの記録義務）
            <span style={NEW_BADGE}>NEW</span>
          </h3>
          <ol style={OL_STYLE}>
            <li>
              乙は、施術業務の遂行にあたり、施術前のカウンセリング、施術内容、使用したオイル・機材、顧客の反応、次回提案等を、甲が管理するシステムに記録するものとする。
            </li>
            <li>
              当該カルテは、施術品質の維持・顧客満足度の向上・税務上の業務記録として保存される。
            </li>
            <li>
              カルテの記録は、施術業務の一部として委託料に含まれる。
            </li>
            <li>
              乙は、虚偽の記録、または記録の意図的な省略を行ってはならない。
            </li>
          </ol>

          {/* 第12条 衛生管理 (新設) */}
          <h3 style={ARTICLE_HEADING}>
            第12条（衛生管理）
            <span style={NEW_BADGE}>NEW</span>
          </h3>
          <ol style={OL_STYLE}>
            <li>
              乙は、施術業務にあたり、自身および施術用具の衛生管理を徹底するものとする。
            </li>
            <li>
              乙は、施術前後の手指消毒、施術用品の清浄化を遵守する。
            </li>
            <li>
              乙は、感染症の罹患・疑いがある場合、直ちに業務を中止し、甲に通知するものとする。
            </li>
          </ol>

          {/* 第13条 契約期間 */}
          <h3 style={ARTICLE_HEADING}>第13条（契約期間）</h3>
          <p>
            本契約の有効期間は、契約締結日から1ヶ月間とする。期間満了の2週間前までに甲乙いずれからも申し出がない限り、同一条件で1ヶ月ごとに自動更新されるものとする。
          </p>

          {/* 第14条 契約解除 */}
          <h3 style={ARTICLE_HEADING}>第14条（契約解除）</h3>
          <ol style={OL_STYLE}>
            <li>
              甲は、乙が本契約の条項に違反した場合、何ら催告を要せず直ちに本契約を解除できるものとする。
            </li>
            <li>
              乙は、解除日の14日前までに甲に書面または電子的方法により通知することにより、本契約を解除することができる。
            </li>
          </ol>

          {/* 第15条 損害賠償 */}
          <h3 style={ARTICLE_HEADING}>第15条（損害賠償）</h3>
          <p>
            甲または乙は、本契約の義務に違反し、相手方に損害を与えた場合、その損害を賠償する責任を負う。乙の不注意により顧客に怪我を負わせる等、甲に損害が生じた場合も同様とする。
          </p>

          {/* 第16条 合意管轄 */}
          <h3 style={ARTICLE_HEADING}>第16条（合意管轄）</h3>
          <p>
            本契約に関する紛争については、名古屋地方裁判所を第一審の専属的合意管轄裁判所とする。
          </p>

          {/* 第17条 協議事項 */}
          <h3 style={ARTICLE_HEADING}>第17条（協議事項）</h3>
          <p>
            本契約に定めのない事項、または本契約の条項の解釈に疑義が生じた場合は、甲乙誠実に協議の上、これを解決するものとする。
          </p>

          {/* 第18条 その他 */}
          <h3 style={ARTICLE_HEADING}>第18条（その他）</h3>
          <p>
            本契約は、乙が甲の管理するオンラインシステム（T-MANAGE）上で電子署名を行うことにより締結される。署名済み契約書は甲のシステム内に電磁的に保管され、甲乙双方がいつでも閲覧できるものとする。本書2通の作成および記名押印による交付は要しない。
          </p>

          <p
            style={{
              marginTop: 22,
              paddingTop: 14,
              borderTop: "1px solid #e5ded6",
              fontSize: 11,
              color: "#555555",
              textAlign: "center",
              letterSpacing: "0.05em",
              lineHeight: 1.9,
            }}
          >
            以上の内容に同意のうえ、
            <br />
            以下の各項目をご確認の上、署名してください。
          </p>
        </div>

        {/* 個別同意チェックボックス (仕様書 5節 contracts_v2_consents) */}
        <div
          style={{
            padding: "18px 18px",
            backgroundColor: "#ffffff",
            border: "1px solid #e5ded6",
            marginBottom: 16,
          }}
        >
          <p
            style={{
              margin: 0,
              fontFamily: FONT_DISPLAY,
              fontSize: 10,
              letterSpacing: "0.2em",
              color: "#c96b83",
              fontWeight: 500,
            }}
          >
            INDIVIDUAL CONSENTS
          </p>
          <p
            style={{
              margin: "3px 0 12px",
              fontSize: 11,
              color: "#555555",
              letterSpacing: "0.03em",
            }}
          >
            重要条項への個別同意 <span style={{ color: "#c96b83" }}>*</span>
          </p>

          <ConsentCheckbox
            checked={consentResearchTraining}
            onChange={setConsentResearchTraining}
            label="第10条 施術技術研修の受講義務に同意します"
            description="解剖学・リンパケア・オイルトリートメント等の研修を受講します。"
          />
          <ConsentCheckbox
            checked={consentChartRecord}
            onChange={setConsentChartRecord}
            label="第11条 施術カルテの記録義務に同意します"
            description="施術前カウンセリング・施術内容・顧客の反応等を記録します。"
          />
          <ConsentCheckbox
            checked={consentNoAlcohol}
            onChange={setConsentNoAlcohol}
            label="第5条 店内飲酒禁止に同意します"
            description="店舗内での酒類提供・顧客との飲酒を行いません。"
          />
          <ConsentCheckbox
            checked={consentNoOutsideContact}
            onChange={setConsentNoOutsideContact}
            label="第5条 店外接触・同伴・アフター禁止に同意します"
            description="顧客との店外での飲食・送迎・私的連絡を行いません。"
          />
        </div>

        {/* 入力フォーム */}
        <div
          style={{
            padding: "18px 18px",
            backgroundColor: "#ffffff",
            border: "1px solid #e5ded6",
            marginBottom: 16,
          }}
        >
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", marginBottom: 6 }}>
              <span
                style={{
                  fontFamily: FONT_DISPLAY,
                  fontSize: 10,
                  letterSpacing: "0.2em",
                  color: "#c96b83",
                  fontWeight: 500,
                }}
              >
                NAME
              </span>
            </label>
            <p
              style={{
                margin: "0 0 6px",
                fontSize: 11,
                color: "#555555",
                letterSpacing: "0.03em",
              }}
            >
              氏名 <span style={{ color: "#c96b83" }}>*</span>
            </p>
            <input
              type="text"
              value={signerName}
              onChange={(e) => setSignerName(e.target.value)}
              placeholder="山田 花子"
              style={{
                width: "100%",
                padding: "11px 14px",
                border: "1px solid #e5ded6",
                fontSize: 14,
                outline: "none",
                backgroundColor: "#faf6f1",
                fontFamily: FONT_SERIF,
                color: "#2b2b2b",
                boxSizing: "border-box",
                letterSpacing: "0.03em",
              }}
            />
          </div>
          <div>
            <label style={{ display: "block", marginBottom: 6 }}>
              <span
                style={{
                  fontFamily: FONT_DISPLAY,
                  fontSize: 10,
                  letterSpacing: "0.2em",
                  color: "#c96b83",
                  fontWeight: 500,
                }}
              >
                ADDRESS
              </span>
            </label>
            <p
              style={{
                margin: "0 0 6px",
                fontSize: 11,
                color: "#555555",
                letterSpacing: "0.03em",
              }}
            >
              住所
            </p>
            <input
              type="text"
              value={signerAddress}
              onChange={(e) => setSignerAddress(e.target.value)}
              placeholder="愛知県安城市…"
              style={{
                width: "100%",
                padding: "11px 14px",
                border: "1px solid #e5ded6",
                fontSize: 14,
                outline: "none",
                backgroundColor: "#faf6f1",
                fontFamily: FONT_SERIF,
                color: "#2b2b2b",
                boxSizing: "border-box",
                letterSpacing: "0.03em",
              }}
            />
          </div>
        </div>

        {/* 署名エリア */}
        <div
          style={{
            padding: "18px 18px",
            backgroundColor: "#ffffff",
            border: "1px solid #e5ded6",
            marginBottom: 16,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 10,
            }}
          >
            <div>
              <span
                style={{
                  fontFamily: FONT_DISPLAY,
                  fontSize: 10,
                  letterSpacing: "0.2em",
                  color: "#c96b83",
                  fontWeight: 500,
                }}
              >
                SIGNATURE
              </span>
              <p
                style={{
                  margin: "2px 0 0",
                  fontSize: 11,
                  color: "#555555",
                  letterSpacing: "0.03em",
                }}
              >
                ✍️ 署名（指でなぞってください）
              </p>
            </div>
            <button
              onClick={clearCanvas}
              style={{
                fontSize: 10,
                color: "#c96b83",
                backgroundColor: "transparent",
                border: "1px solid #c96b83",
                padding: "4px 10px",
                cursor: "pointer",
                fontFamily: FONT_SERIF,
                letterSpacing: "0.05em",
              }}
            >
              クリア
            </button>
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
              width: "100%",
              height: 150,
              border: signed ? "1px solid #e8849a" : "1px dashed #d0c8bf",
              backgroundColor: "#faf6f1",
              touchAction: "none",
              cursor: "crosshair",
              display: "block",
            }}
          />
          {!signed && (
            <p
              style={{
                fontSize: 10,
                color: "#b5b5b5",
                textAlign: "center",
                marginTop: 6,
                letterSpacing: "0.05em",
              }}
            >
              ↑ ここに指で署名
            </p>
          )}
        </div>

        {/* 署名日 */}
        <div
          style={{
            padding: "14px 18px",
            backgroundColor: "#ffffff",
            border: "1px solid #e5ded6",
            marginBottom: 20,
            fontSize: 12,
            color: "#555555",
            letterSpacing: "0.05em",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <p
              style={{
                margin: 0,
                fontFamily: FONT_DISPLAY,
                fontSize: 10,
                letterSpacing: "0.2em",
                color: "#8a8a8a",
                fontWeight: 500,
              }}
            >
              DATE
            </p>
            <p style={{ margin: "2px 0 0", fontSize: 11 }}>署名日</p>
          </div>
          <span
            style={{
              fontWeight: 500,
              color: "#2b2b2b",
              letterSpacing: "0.03em",
              fontSize: 13,
            }}
          >
            {new Date().toLocaleDateString("ja-JP", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </span>
        </div>

        {/* 送信ボタン */}
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          style={{
            width: "100%",
            padding: "14px 22px",
            border: "none",
            backgroundColor: !canSubmit ? "#d5d0ca" : "#c96b83",
            color: !canSubmit ? "#8a8a8a" : "#ffffff",
            fontSize: 13,
            fontFamily: FONT_SERIF,
            fontWeight: 500,
            letterSpacing: "0.2em",
            cursor: !canSubmit ? "not-allowed" : "pointer",
          }}
        >
          {submitting ? "送信中…" : "✍️ 署名して契約に同意する"}
        </button>

        {!signerName.trim() && (
          <p
            style={{
              margin: "10px 0 0",
              fontSize: 10,
              color: "#c96b83",
              textAlign: "center",
              letterSpacing: "0.03em",
            }}
          >
            ※ 氏名を入力してください
          </p>
        )}
        {signerName.trim() && !allConsentsChecked && (
          <p
            style={{
              margin: "10px 0 0",
              fontSize: 10,
              color: "#c96b83",
              textAlign: "center",
              letterSpacing: "0.03em",
            }}
          >
            ※ 4つの個別同意項目すべてにチェックしてください
          </p>
        )}
        {signerName.trim() && allConsentsChecked && !signed && (
          <p
            style={{
              margin: "10px 0 0",
              fontSize: 10,
              color: "#c96b83",
              textAlign: "center",
              letterSpacing: "0.03em",
            }}
          >
            ※ 署名エリアに署名してください
          </p>
        )}
      </div>
    </div>
  );
}

// 同意チェックボックス
function ConsentCheckbox({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description: string;
}) {
  return (
    <label
      style={{
        display: "flex",
        gap: 10,
        padding: "10px 12px",
        marginBottom: 8,
        border: checked ? "1px solid #e8849a" : "1px solid #e5ded6",
        backgroundColor: checked ? "#fdf6f7" : "#faf6f1",
        cursor: "pointer",
        transition: "all 0.15s",
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{
          marginTop: 3,
          width: 16,
          height: 16,
          accentColor: "#c96b83",
          cursor: "pointer",
          flexShrink: 0,
        }}
      />
      <div style={{ flex: 1 }}>
        <p
          style={{
            margin: 0,
            fontSize: 12,
            fontWeight: 500,
            color: "#2b2b2b",
            letterSpacing: "0.02em",
            lineHeight: 1.6,
          }}
        >
          {label}
        </p>
        <p
          style={{
            margin: "3px 0 0",
            fontSize: 10,
            color: "#8a8a8a",
            letterSpacing: "0.02em",
            lineHeight: 1.6,
          }}
        >
          {description}
        </p>
      </div>
    </label>
  );
}
