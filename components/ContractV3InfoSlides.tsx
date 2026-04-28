"use client";

/**
 * ContractV3InfoSlides — 業務委託契約書 v3.0 改訂説明スライド
 *
 * セラピスト向け (/cast/contract-v3-info) と
 * 管理者向け (/admin/contract-v3-info) で共通利用される。
 *
 * 仕様:
 *   - 全10スライド構成 (表紙/背景/概要/4つの変更点/立場確認/再署名手順/問い合わせ)
 *   - HP世界観準拠: マーブルピンク背景・Noto Serif・装飾細線
 *   - スマホ・PC両対応 (キーボード矢印キー・スワイプ・ボタン)
 *   - 進捗バー・「N / 10」表示・目次ジャンプ
 *   - 印刷ボタン (ブラウザ印刷ダイアログ)
 *   - audience prop で文言を微調整 (cast=セラピスト向け / admin=管理者向け)
 *
 * 関連:
 *   - lib/contract-v3.tsx (実際の契約書本文)
 *   - docs/22_CONTRACT_REDESIGN.md (改訂仕様書)
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { SITE } from "../lib/site-theme";

const FONT_SERIF =
  "'Noto Serif JP', 'Yu Mincho', 'Hiragino Mincho ProN', serif";
const FONT_DISPLAY =
  "'Cormorant Garamond', 'Noto Serif JP', 'Yu Mincho', serif";

const PINK = SITE.color.pink;
const PINK_DEEP = SITE.color.pinkDeep;
const PINK_SOFT = SITE.color.pinkSoft;
const TEXT = SITE.color.text;
const TEXT_SUB = SITE.color.textSub;
const TEXT_MUTED = SITE.color.textMuted;
const BORDER = SITE.color.border;

// マーブル背景 (HP世界観統一)
const MARBLE_BG = {
  background: `
    radial-gradient(at 20% 15%, rgba(232,132,154,0.10) 0, transparent 50%),
    radial-gradient(at 85% 20%, rgba(196,162,138,0.08) 0, transparent 50%),
    radial-gradient(at 40% 85%, rgba(247,227,231,0.6) 0, transparent 50%),
    linear-gradient(180deg, #fbf7f3 0%, #f8f2ec 100%)
  `,
};

// ─── スライド用共通スタイル ───────────────────────────────
const slideContainerStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: 720,
  minHeight: 480,
  margin: "0 auto",
  padding: "40px 32px",
  backgroundColor: "#ffffff",
  border: `1px solid ${BORDER}`,
  borderRadius: 0, // HP世界観: 角丸なし
  position: "relative",
  fontFamily: FONT_SERIF,
  color: TEXT,
};

const englishLabelStyle: React.CSSProperties = {
  fontFamily: FONT_DISPLAY,
  fontSize: 12,
  letterSpacing: "0.25em",
  color: PINK_DEEP,
  fontWeight: 500,
  marginBottom: 6,
};

const slideTitleStyle: React.CSSProperties = {
  fontSize: 22,
  fontWeight: 500,
  color: TEXT,
  margin: "0 0 16px",
  letterSpacing: "0.04em",
  lineHeight: 1.4,
};

const dividerStyle: React.CSSProperties = {
  width: 32,
  height: 1,
  backgroundColor: PINK,
  margin: "8px 0 20px",
};

const bodyTextStyle: React.CSSProperties = {
  fontSize: 14,
  color: TEXT_SUB,
  lineHeight: 1.9,
  letterSpacing: "0.02em",
  margin: "8px 0",
};

const articleBoxStyle: React.CSSProperties = {
  backgroundColor: "#fbf7f3",
  border: `1px solid ${BORDER}`,
  padding: "16px 18px",
  margin: "16px 0",
};

const newBadgeStyle: React.CSSProperties = {
  display: "inline-block",
  fontFamily: FONT_DISPLAY,
  fontSize: 9,
  letterSpacing: "0.18em",
  padding: "2px 7px",
  marginLeft: 8,
  backgroundColor: PINK,
  color: "#ffffff",
  fontWeight: 600,
  verticalAlign: "middle",
};

// ─── スライド定義 ─────────────────────────────────────────
type SlideContent = {
  num: string;
  englishLabel: string;
  title: string;
  // audience に応じて出し分けたい場合は (audience) => JSX を渡す
  body: (audience: "cast" | "admin") => React.ReactNode;
};

const SLIDES: SlideContent[] = [
  // ─── 1. 表紙 ───
  {
    num: "01",
    englishLabel: "ANNOUNCEMENT",
    title: "業務委託契約書 v3.0 改訂のご案内",
    body: (audience) => (
      <div style={{ textAlign: "center", padding: "20px 0" }}>
        <p style={{ ...bodyTextStyle, fontSize: 15 }}>
          このたび、Ange Spa（合同会社テラスライフ）の
          <br />
          業務委託契約書を改訂いたしました。
        </p>
        <div style={{ ...dividerStyle, margin: "24px auto" }} />
        <p style={{ ...bodyTextStyle, fontSize: 13, color: TEXT_MUTED }}>
          {audience === "cast"
            ? "本資料では、改訂の背景と主な変更点を、できる限りわかりやすくご案内いたします。ご不明な点はお気軽にスタッフまでお問い合わせください。"
            : "本資料はセラピスト向け説明資料として、管理者・スタッフが内容を把握するために設置されています。"}
        </p>
        <p
          style={{
            fontFamily: FONT_DISPLAY,
            fontSize: 11,
            letterSpacing: "0.2em",
            color: TEXT_MUTED,
            marginTop: 32,
          }}
        >
          Ange Spa / 合同会社テラスライフ
        </p>
      </div>
    ),
  },

  // ─── 2. 改訂の背景 ───
  {
    num: "02",
    englishLabel: "BACKGROUND",
    title: "改訂の背景",
    body: () => (
      <>
        <p style={bodyTextStyle}>
          Ange Spa は「リラクゼーション施術業」として運営しております。
          税務上もこの位置づけを明確にし、
          <br />
          施術業としての実態を契約書に整合させる必要がありました。
        </p>
        <div style={articleBoxStyle}>
          <p style={{ ...bodyTextStyle, margin: 0, fontWeight: 500, color: TEXT }}>
            改訂の目的
          </p>
          <ul style={{ ...bodyTextStyle, margin: "8px 0 0", paddingLeft: 18 }}>
            <li>「施術業」としての契約書文言の整備</li>
            <li>税務上の実態証跡の強化（カルテ・研修記録）</li>
            <li>業務委託性の補強（裁量・自己責任の明記）</li>
            <li>禁止事項の明確化（飲酒・店外接触等）</li>
          </ul>
        </div>
        <p style={{ ...bodyTextStyle, fontSize: 12, color: TEXT_MUTED }}>
          ※ 本改訂は税理士・弁護士の監修のもと、施術業としての健全な運営継続を目的としております。
        </p>
      </>
    ),
  },

  // ─── 3. 主な変更点(概要) ───
  {
    num: "03",
    englishLabel: "OVERVIEW",
    title: "主な変更点",
    body: () => (
      <>
        <p style={bodyTextStyle}>
          今回の改訂による主な変更点は、以下の4点です。
        </p>
        <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
          {[
            {
              num: "第10条",
              title: "施術技術研修の受講義務",
              note: "新設",
            },
            {
              num: "第11条",
              title: "施術カルテの記録義務",
              note: "新設",
            },
            {
              num: "第5条",
              title: "酒類提供・同伴・アフター・店外接触の全面禁止",
              note: "明文化",
            },
            {
              num: "第3条",
              title: "源泉徴収なしの根拠と確定申告責任",
              note: "明記",
            },
          ].map((item, i) => (
            <div
              key={i}
              style={{
                ...articleBoxStyle,
                margin: 0,
                display: "flex",
                alignItems: "center",
                gap: 14,
              }}
            >
              <span
                style={{
                  fontFamily: FONT_DISPLAY,
                  fontSize: 11,
                  letterSpacing: "0.18em",
                  color: PINK_DEEP,
                  minWidth: 60,
                  fontWeight: 500,
                }}
              >
                {item.num}
              </span>
              <span style={{ flex: 1, fontSize: 14, color: TEXT, fontWeight: 500 }}>
                {item.title}
              </span>
              <span
                style={{
                  ...newBadgeStyle,
                  marginLeft: 0,
                  backgroundColor: PINK_SOFT,
                  color: PINK_DEEP,
                }}
              >
                {item.note}
              </span>
            </div>
          ))}
        </div>
      </>
    ),
  },

  // ─── 4. 第10条 研修受講義務 ───
  {
    num: "04",
    englishLabel: "ARTICLE 10",
    title: (
      <span>
        第10条 施術技術研修の受講義務
      </span>
    ) as unknown as string,
    body: () => (
      <>
        <p style={bodyTextStyle}>
          施術業としての専門性を担保するため、
          会社が用意する研修プログラムをご受講いただく義務を新設しました。
        </p>
        <div style={articleBoxStyle}>
          <p style={{ ...bodyTextStyle, margin: 0, fontWeight: 500, color: TEXT }}>
            研修内容（一例）
          </p>
          <ul style={{ ...bodyTextStyle, margin: "8px 0 0", paddingLeft: 18 }}>
            <li>解剖学の基礎</li>
            <li>リンパケア・オイルトリートメントの技術</li>
            <li>新コース導入時の事前研修</li>
          </ul>
        </div>
        <p style={{ ...bodyTextStyle, fontSize: 13, color: TEXT_SUB }}>
          研修の受講記録は T-MANAGE システム上で管理されます。
          記録は税務上の業務実態を裏付ける重要な資料となります。
        </p>
      </>
    ),
  },

  // ─── 5. 第11条 カルテ記録義務 ───
  {
    num: "05",
    englishLabel: "ARTICLE 11",
    title: "第11条 施術カルテの記録義務",
    body: () => (
      <>
        <p style={bodyTextStyle}>
          各施術後に、施術内容を T-MANAGE システム上のカルテに記録いただきます。
          カルテは施術品質の維持・顧客満足度の向上、
          そして税務上の業務記録としての役割を持ちます。
        </p>
        <div style={articleBoxStyle}>
          <p style={{ ...bodyTextStyle, margin: 0, fontWeight: 500, color: TEXT }}>
            記録項目（一例）
          </p>
          <ul style={{ ...bodyTextStyle, margin: "8px 0 0", paddingLeft: 18 }}>
            <li>施術前のカウンセリング内容</li>
            <li>実施した施術内容・使用したオイル</li>
            <li>顧客の反応・気付き</li>
            <li>次回提案</li>
          </ul>
        </div>
        <p style={{ ...bodyTextStyle, fontSize: 13, color: TEXT_SUB }}>
          カルテの記録は施術業務の一部として委託料に含まれます。
          別途のお支払いは発生いたしません。
        </p>
      </>
    ),
  },

  // ─── 6. 第5条 禁止事項の明文化 ───
  {
    num: "06",
    englishLabel: "ARTICLE 5",
    title: "第5条 禁止事項（明文化）",
    body: () => (
      <>
        <p style={bodyTextStyle}>
          施術業としての健全な運営のため、以下の行為を禁止事項として
          明確に契約書に記載いたしました。
        </p>
        <div style={articleBoxStyle}>
          <ul
            style={{
              ...bodyTextStyle,
              margin: 0,
              paddingLeft: 18,
              fontSize: 13,
            }}
          >
            <li>店舗内での酒類の提供・顧客との飲酒</li>
            <li>顧客との店外での飲食・同伴・送迎・アフター</li>
            <li>業務時間外における顧客との私的な連絡（電話・SNS等）</li>
          </ul>
        </div>
        <p style={{ ...bodyTextStyle, fontSize: 13, color: TEXT_SUB }}>
          これらは、Ange Spa が施術業として税務・法務上適切に運営される上で
          必須の項目です。皆さまのご理解とご協力をお願いいたします。
        </p>
      </>
    ),
  },

  // ─── 7. 第3条 税務責任の明記 ───
  {
    num: "07",
    englishLabel: "ARTICLE 3",
    title: "第3条 委託料の支払いおよび税務",
    body: () => (
      <>
        <p style={bodyTextStyle}>
          業務委託契約に基づくお支払いについて、税務上の取り扱いを
          契約書に明確に記載いたしました。
        </p>
        <div style={articleBoxStyle}>
          <p style={{ ...bodyTextStyle, margin: 0, fontSize: 13 }}>
            <strong style={{ color: TEXT }}>1. 源泉徴収について</strong>
            <br />
            業務委託に基づく報酬は、所得税法上、源泉徴収の対象となる業務に
            該当しないため、Ange Spa からの源泉徴収は行いません。
          </p>
          <p style={{ ...bodyTextStyle, margin: "12px 0 0", fontSize: 13 }}>
            <strong style={{ color: TEXT }}>2. 確定申告について</strong>
            <br />
            受託者ご自身の責任において、毎年の確定申告を行っていただきます。
          </p>
        </div>
        <p style={{ ...bodyTextStyle, fontSize: 12, color: TEXT_MUTED }}>
          ※ 確定申告に関するご相談は、マイページ「税務ガイド」をご参照ください。
          ご不明な点はスタッフまでお声がけください。
        </p>
      </>
    ),
  },

  // ─── 8. 立場・条件は変わりません ───
  {
    num: "08",
    englishLabel: "YOUR POSITION",
    title: "報酬・条件は変わりません",
    body: () => (
      <>
        <p style={bodyTextStyle}>
          今回の契約書改訂により、皆さまの<strong style={{ color: TEXT }}>報酬・バック率・働き方</strong>に
          変更が生じることはございません。
        </p>
        <div
          style={{
            ...articleBoxStyle,
            backgroundColor: PINK_SOFT,
            borderColor: PINK,
          }}
        >
          <p style={{ ...bodyTextStyle, margin: 0, fontWeight: 500, color: PINK_DEEP, fontSize: 14 }}>
            ご安心ください
          </p>
          <ul style={{ ...bodyTextStyle, margin: "8px 0 0", paddingLeft: 18, fontSize: 13 }}>
            <li>これまでと同じ報酬・バック率を継続いたします</li>
            <li>シフト・出勤頻度の決定はこれまで通り受託者の裁量です</li>
            <li>新たな金銭的負担をお願いするものではございません</li>
          </ul>
        </div>
        <p style={{ ...bodyTextStyle, fontSize: 13, color: TEXT_SUB }}>
          本改訂は、Ange Spa が「施術業」として健全に運営を継続し、
          皆さまが安心してご活躍いただける環境を維持するためのものです。
        </p>
      </>
    ),
  },

  // ─── 9. 再署名のお願い ───
  {
    num: "09",
    englishLabel: "RE-SIGNING",
    title: "再署名のお願い",
    body: (audience) => (
      <>
        <p style={bodyTextStyle}>
          {audience === "cast"
            ? "改訂後の契約書 (v3.0) について、皆さまに改めて電子署名をお願いいたします。"
            : "全セラピスト（v1.0/v2.0 署名済者を含む）に対し、v3.0 への再署名をお願いする方針です。"}
        </p>
        <div style={articleBoxStyle}>
          <p style={{ ...bodyTextStyle, margin: 0, fontWeight: 500, color: TEXT }}>
            手順
          </p>
          <ol style={{ ...bodyTextStyle, margin: "8px 0 0", paddingLeft: 22, fontSize: 13 }}>
            <li>スタッフより新しい契約書 URL がご案内されます</li>
            <li>URL を開き、改訂後の契約書をご確認ください</li>
            <li>個別の重要条項4点に同意のチェックを入れてください</li>
            <li>氏名・住所をご入力の上、電子署名いただきます</li>
          </ol>
        </div>
        <p style={{ ...bodyTextStyle, fontSize: 13, color: TEXT_SUB }}>
          ご署名いただきました情報は T-MANAGE システム内に厳重に保管されます。
          書類の郵送や対面での押印は不要です。
        </p>
        <p style={{ ...bodyTextStyle, fontSize: 12, color: TEXT_MUTED }}>
          {audience === "cast"
            ? "本資料を読み終えてから、お渡しした URL を開いてください。"
            : "v1/v2 の旧契約書も法的には有効ですが、税務上の整合性確保のため v3.0 への移行を順次進めます。"}
        </p>
      </>
    ),
  },

  // ─── 10. お問い合わせ ───
  {
    num: "10",
    englishLabel: "CONTACT",
    title: "お問い合わせ",
    body: (audience) => (
      <>
        <p style={bodyTextStyle}>
          {audience === "cast"
            ? "本資料の内容や契約書改訂についてご不明な点がございましたら、お気軽にお問い合わせください。"
            : "セラピストから問い合わせを受けた場合、内容に応じて以下の手順でご対応ください。"}
        </p>
        <div style={articleBoxStyle}>
          {audience === "cast" ? (
            <>
              <p style={{ ...bodyTextStyle, margin: 0, fontWeight: 500, color: TEXT }}>
                お問い合わせ方法
              </p>
              <ul
                style={{
                  ...bodyTextStyle,
                  margin: "8px 0 0",
                  paddingLeft: 18,
                  fontSize: 13,
                }}
              >
                <li>店舗スタッフへ直接お声がけください</li>
                <li>マイページの「メッセージ」機能からもご連絡いただけます</li>
                <li>緊急のご質問は LINE 公式アカウントにてご対応いたします</li>
              </ul>
            </>
          ) : (
            <>
              <p style={{ ...bodyTextStyle, margin: 0, fontWeight: 500, color: TEXT }}>
                対応指針
              </p>
              <ul
                style={{
                  ...bodyTextStyle,
                  margin: "8px 0 0",
                  paddingLeft: 18,
                  fontSize: 13,
                }}
              >
                <li>条文の解釈に関する質問は、本資料・契約書本文を提示</li>
                <li>判断に迷うものは経営層に確認の上、回答</li>
                <li>不安・不満を感じている様子があれば、丁寧にヒアリング</li>
                <li>再署名拒否の場合は v1/v2 の有効性は維持される旨を説明</li>
              </ul>
            </>
          )}
        </div>
        <div
          style={{
            marginTop: 28,
            padding: "16px 0",
            borderTop: `1px solid ${BORDER}`,
            textAlign: "center",
          }}
        >
          <p
            style={{
              fontFamily: FONT_DISPLAY,
              fontSize: 11,
              letterSpacing: "0.25em",
              color: PINK_DEEP,
              margin: 0,
            }}
          >
            THANK YOU
          </p>
          <p
            style={{
              fontSize: 12,
              color: TEXT_MUTED,
              margin: "8px 0 0",
              letterSpacing: "0.05em",
            }}
          >
            ご一読いただき、ありがとうございました。
          </p>
        </div>
      </>
    ),
  },
];

// ─── 本体コンポーネント ─────────────────────────────────
export default function ContractV3InfoSlides({
  audience = "cast",
}: {
  audience?: "cast" | "admin";
}) {
  const [current, setCurrent] = useState(0);
  const [showToc, setShowToc] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number | null>(null);

  const total = SLIDES.length;
  const slide = SLIDES[current];

  const goPrev = useCallback(() => {
    setCurrent((c) => Math.max(0, c - 1));
  }, []);

  const goNext = useCallback(() => {
    setCurrent((c) => Math.min(total - 1, c + 1));
  }, [total]);

  // キーボード操作
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight" || e.key === " ") goNext();
      if (e.key === "Escape") setShowToc(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goPrev, goNext]);

  // スワイプ操作
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 50) {
      if (dx > 0) goPrev();
      else goNext();
    }
    touchStartX.current = null;
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        ...MARBLE_BG,
        padding: "32px 16px 64px",
        fontFamily: FONT_SERIF,
      }}
    >
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        {/* ───── ヘッダー ───── */}
        <div
          style={{
            marginBottom: 16,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 8,
          }}
          className="contract-v3-header"
        >
          <div>
            <p
              style={{
                fontFamily: FONT_DISPLAY,
                fontSize: 10,
                letterSpacing: "0.25em",
                color: PINK_DEEP,
                margin: 0,
              }}
            >
              CONTRACT v3.0 — INFORMATION
            </p>
            <p
              style={{
                fontSize: 12,
                color: TEXT_MUTED,
                margin: "2px 0 0",
                letterSpacing: "0.04em",
              }}
            >
              {audience === "cast"
                ? "業務委託契約書 改訂のご案内"
                : "業務委託契約書 v3.0 改訂説明資料（管理者向け）"}
            </p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => setShowToc((v) => !v)}
              style={navBtnStyle}
              className="no-print"
            >
              ☰ 目次
            </button>
            <button
              onClick={() => window.print()}
              style={navBtnStyle}
              className="no-print"
            >
              🖨 印刷
            </button>
          </div>
        </div>

        {/* ───── 進捗バー ───── */}
        <div
          style={{
            height: 2,
            backgroundColor: BORDER,
            marginBottom: 12,
            position: "relative",
          }}
          className="no-print"
        >
          <div
            style={{
              height: "100%",
              width: `${((current + 1) / total) * 100}%`,
              backgroundColor: PINK,
              transition: "width 0.3s ease",
            }}
          />
        </div>

        {/* ───── 目次オーバーレイ ───── */}
        {showToc && (
          <div
            onClick={() => setShowToc(false)}
            style={{
              position: "fixed",
              inset: 0,
              backgroundColor: "rgba(0,0,0,0.4)",
              zIndex: 50,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 24,
            }}
            className="no-print"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                width: "100%",
                maxWidth: 480,
                backgroundColor: "#ffffff",
                border: `1px solid ${BORDER}`,
                padding: "24px 24px",
                fontFamily: FONT_SERIF,
              }}
            >
              <p
                style={{
                  fontFamily: FONT_DISPLAY,
                  fontSize: 11,
                  letterSpacing: "0.25em",
                  color: PINK_DEEP,
                  margin: 0,
                }}
              >
                TABLE OF CONTENTS
              </p>
              <h3
                style={{
                  margin: "4px 0 16px",
                  fontSize: 16,
                  fontWeight: 500,
                  color: TEXT,
                  letterSpacing: "0.04em",
                }}
              >
                目次
              </h3>
              <div style={{ ...dividerStyle, margin: "0 0 16px" }} />
              <ol style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {SLIDES.map((s, i) => (
                  <li key={i}>
                    <button
                      onClick={() => {
                        setCurrent(i);
                        setShowToc(false);
                      }}
                      style={{
                        display: "flex",
                        width: "100%",
                        padding: "10px 0",
                        backgroundColor: "transparent",
                        border: "none",
                        borderBottom: `1px solid ${BORDER}`,
                        cursor: "pointer",
                        textAlign: "left",
                        fontFamily: FONT_SERIF,
                        color: i === current ? PINK_DEEP : TEXT_SUB,
                        fontSize: 13,
                        letterSpacing: "0.02em",
                        alignItems: "center",
                        gap: 12,
                      }}
                    >
                      <span
                        style={{
                          fontFamily: FONT_DISPLAY,
                          fontSize: 11,
                          letterSpacing: "0.18em",
                          color: i === current ? PINK : TEXT_MUTED,
                          minWidth: 24,
                          fontWeight: 500,
                        }}
                      >
                        {s.num}
                      </span>
                      <span style={{ flex: 1 }}>
                        {typeof s.title === "string" ? s.title : "—"}
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
              <button
                onClick={() => setShowToc(false)}
                style={{
                  ...navBtnStyle,
                  marginTop: 16,
                  width: "100%",
                  textAlign: "center",
                  display: "block",
                }}
              >
                閉じる (ESC)
              </button>
            </div>
          </div>
        )}

        {/* ───── スライド本体 ───── */}
        <div
          ref={containerRef}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          style={slideContainerStyle}
        >
          {/* スライド番号 */}
          <p
            style={{
              fontFamily: FONT_DISPLAY,
              fontSize: 11,
              letterSpacing: "0.25em",
              color: TEXT_MUTED,
              margin: 0,
              position: "absolute",
              top: 24,
              right: 32,
            }}
          >
            {slide.num} / {String(total).padStart(2, "0")}
          </p>

          {/* 英文ラベル */}
          <p style={englishLabelStyle}>{slide.englishLabel}</p>

          {/* タイトル */}
          <h2 style={slideTitleStyle}>{slide.title}</h2>

          {/* 装飾細線 */}
          <div style={dividerStyle} />

          {/* 本文 */}
          <div>{slide.body(audience)}</div>
        </div>

        {/* ───── ページネーション ───── */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: 24,
            gap: 12,
          }}
          className="no-print"
        >
          <button
            onClick={goPrev}
            disabled={current === 0}
            style={{
              ...pagerBtnStyle,
              opacity: current === 0 ? 0.3 : 1,
              cursor: current === 0 ? "not-allowed" : "pointer",
            }}
          >
            ← 前へ
          </button>
          <p
            style={{
              fontFamily: FONT_DISPLAY,
              fontSize: 13,
              letterSpacing: "0.18em",
              color: TEXT_SUB,
              margin: 0,
              fontWeight: 500,
            }}
          >
            {current + 1} / {total}
          </p>
          <button
            onClick={goNext}
            disabled={current === total - 1}
            style={{
              ...pagerBtnStyle,
              opacity: current === total - 1 ? 0.3 : 1,
              cursor: current === total - 1 ? "not-allowed" : "pointer",
            }}
          >
            次へ →
          </button>
        </div>

        <p
          style={{
            textAlign: "center",
            fontSize: 10,
            color: TEXT_MUTED,
            marginTop: 16,
            letterSpacing: "0.05em",
          }}
          className="no-print"
        >
          矢印キー (← →) / スワイプ / 目次 で移動できます
        </p>
      </div>

      {/* 印刷時のスタイル */}
      <style jsx global>{`
        @media print {
          .no-print { display: none !important; }
          body { background: #ffffff !important; }
        }
      `}</style>
    </div>
  );
}

// ─── ボタンスタイル ───────────────────────────────────────
const navBtnStyle: React.CSSProperties = {
  padding: "6px 14px",
  fontSize: 11,
  fontFamily: FONT_SERIF,
  letterSpacing: "0.05em",
  color: TEXT_SUB,
  backgroundColor: "rgba(255,255,255,0.85)",
  border: `1px solid ${BORDER}`,
  cursor: "pointer",
  WebkitBackdropFilter: "blur(4px)",
  backdropFilter: "blur(4px)",
};

const pagerBtnStyle: React.CSSProperties = {
  padding: "10px 20px",
  fontSize: 12,
  fontFamily: FONT_SERIF,
  letterSpacing: "0.05em",
  color: PINK_DEEP,
  backgroundColor: "rgba(255,255,255,0.85)",
  border: `1px solid ${PINK}`,
  cursor: "pointer",
  WebkitBackdropFilter: "blur(4px)",
  backdropFilter: "blur(4px)",
};
