"use client";

/**
 * ═══════════════════════════════════════════════════════════
 * アンケートフォーム共通コンポーネント
 *
 * 用途:
 *   - お客様マイページ (/mypage/survey/[reservationId])
 *   - HPの非会員エントリポイント (/survey)
 *
 * Props 設計:
 *   呼び出し側で「予約特定」「認証」を済ませた状態で渡す。
 *   SurveyForm は「この予約のアンケートを書く」だけに集中する。
 *
 * 設計: docs/14_REVIEW_SYSTEM.md
 * ═══════════════════════════════════════════════════════════
 */

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  SURVEY_HIGHLIGHTS,
  type RatingChoice,
  type SurveyHighlight,
  type SurveySubmitRequest,
  type SurveySubmitResponse,
} from "@/lib/survey-types";

// ────────────────────────────────────────────────────────
// テーマ（マイページ・HPと統一）
// ────────────────────────────────────────────────────────

export const C = {
  bg: "#ffffff",
  card: "#ffffff",
  cardAlt: "#faf6f1",
  border: "#e5ded6",
  borderPink: "#ead3da",
  accent: "#e8849a",
  accentDark: "#c96b83",
  accentBg: "#f7e3e7",
  text: "#2b2b2b",
  textSub: "#555555",
  textMuted: "#8a8a8a",
  textFaint: "#b5b5b5",
  green: "#6b9b7e",
};
export const FONT_SERIF = "'Noto Serif JP', 'Yu Mincho', 'Hiragino Mincho ProN', serif";
export const FONT_DISPLAY = "'Cormorant Garamond', 'Noto Serif JP', 'Yu Mincho', serif";

const TOTAL_STEPS = 5;

// ────────────────────────────────────────────────────────
// Props
// ────────────────────────────────────────────────────────

export type SurveyFormReservation = {
  id: number;
  date: string;
  startTime: string;
  course: string;
  therapistId: number;
  therapistName: string;
};

export type SurveyFormProps = {
  reservation: SurveyFormReservation;
  customerId: number | null;
  token?: string; // 非登録者用トークン認証時
  /** 戻るボタンのリンク先（マイページ "/mypage" or HP "/" ） */
  backLinkHref: string;
  backLinkLabel: string;
  /** 完了画面で表示する追加メッセージ（HP登録誘導など） */
  resultExtraMessage?: React.ReactNode;
};

// ────────────────────────────────────────────────────────
// メイン
// ────────────────────────────────────────────────────────

export function SurveyForm(props: SurveyFormProps) {
  const { reservation, customerId, token, backLinkHref, backLinkLabel, resultExtraMessage } = props;

  // ステップ
  const [step, setStep] = useState(1);

  // 入力
  const [ratingOverall, setRatingOverall] = useState(0);
  const [ratingTherapist, setRatingTherapist] = useState<RatingChoice | "">("");
  const [ratingService, setRatingService] = useState<RatingChoice | "">("");
  const [ratingAtmosphere, setRatingAtmosphere] = useState<RatingChoice | "">("");
  const [ratingCleanliness, setRatingCleanliness] = useState<RatingChoice | "">("");
  const [ratingCourse, setRatingCourse] = useState<RatingChoice | "">("");
  const [highlights, setHighlights] = useState<SurveyHighlight[]>([]);
  const [highlightsCustom, setHighlightsCustom] = useState("");
  const [goodPoints, setGoodPoints] = useState("");
  const [improvementPoints, setImprovementPoints] = useState("");
  const [therapistMessage, setTherapistMessage] = useState("");
  const [hpPublishConsent, setHpPublishConsent] = useState(false);

  // 送信
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<SurveySubmitResponse | null>(null);

  const canGoNextFromStep1 = ratingOverall >= 1 && ratingOverall <= 5;
  const progress = useMemo(() => Math.round((step / TOTAL_STEPS) * 100), [step]);

  const toggleHighlight = (h: SurveyHighlight) => {
    setHighlights((prev) =>
      prev.includes(h) ? prev.filter((x) => x !== h) : [...prev, h]
    );
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const payload: SurveySubmitRequest = {
        token,
        customerId: customerId || undefined,
        reservationId: reservation.id,
        therapistId: reservation.therapistId,
        ratingOverall,
        ratingTherapist: ratingTherapist || undefined,
        ratingService: ratingService || undefined,
        ratingAtmosphere: ratingAtmosphere || undefined,
        ratingCleanliness: ratingCleanliness || undefined,
        ratingCourse: ratingCourse || undefined,
        highlights,
        highlightsCustom: highlightsCustom.trim() || undefined,
        goodPoints: goodPoints.trim() || undefined,
        improvementPoints: improvementPoints.trim() || undefined,
        therapistMessage: therapistMessage.trim() || undefined,
        hpPublishConsent,
        submittedFrom: token ? "qr" : "mypage",
      };

      const res = await fetch("/api/survey/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "送信に失敗しました");
        setSubmitting(false);
        return;
      }
      setResult(data as SurveySubmitResponse);
    } catch (e) {
      alert("通信エラーが発生しました");
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  // 完了画面
  if (result) {
    return <ResultView result={result} backLinkHref={backLinkHref} backLinkLabel={backLinkLabel} extra={resultExtraMessage} />;
  }

  return (
    <div>
      {/* 予約情報 */}
      <div style={{ ...cardStyle, marginBottom: 16, backgroundColor: C.cardAlt }}>
        <p style={{ fontSize: 11, color: C.textMuted, marginBottom: 4 }}>ご来店</p>
        <p style={{ fontSize: 14, color: C.text }}>
          {reservation.date} {reservation.startTime}〜
          {reservation.therapistName && (
            <span style={{ color: C.accentDark, marginLeft: 8 }}>担当: {reservation.therapistName}</span>
          )}
        </p>
        <p style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>{reservation.course}</p>
      </div>

      {/* プログレス */}
      <div style={{ marginBottom: 24 }}>
        <p style={{ fontSize: 11, color: C.textMuted, marginBottom: 6 }}>
          ステップ {step} / {TOTAL_STEPS}
        </p>
        <div style={{ height: 4, backgroundColor: C.cardAlt, overflow: "hidden" }}>
          <div
            style={{
              width: `${progress}%`,
              height: "100%",
              backgroundColor: C.accent,
              transition: "width 0.3s ease",
            }}
          />
        </div>
      </div>

      {/* Step 1: 総合満足度 */}
      {step === 1 && (
        <StepCard title="総合満足度" subtitle="本日のご利用、いかがでしたか？" required>
          <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 16 }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                onClick={() => setRatingOverall(n)}
                style={{
                  width: 48,
                  height: 48,
                  fontSize: 28,
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  color: ratingOverall >= n ? C.accent : C.textFaint,
                  transition: "color 0.2s",
                }}
                aria-label={`${n}つ星`}
              >
                ★
              </button>
            ))}
          </div>
          <p style={{ textAlign: "center", fontSize: 12, color: C.textSub, minHeight: 18 }}>
            {ratingOverall === 0
              ? "星を選択してください"
              : ratingOverall === 1
              ? "とても不満"
              : ratingOverall === 2
              ? "不満"
              : ratingOverall === 3
              ? "普通"
              : ratingOverall === 4
              ? "満足"
              : "とても満足"}
          </p>
          <NavButtons onNext={() => setStep(2)} canNext={canGoNextFromStep1} isFirst />
        </StepCard>
      )}

      {/* Step 2: 各項目評価 */}
      {step === 2 && (
        <StepCard title="各項目の評価" subtitle="気になる項目だけお答えください（スキップ可）">
          <ChoiceField label="セラピストの技術" value={ratingTherapist} onChange={setRatingTherapist} />
          <ChoiceField label="サービス全体" value={ratingService} onChange={setRatingService} />
          <ChoiceField label="お部屋の雰囲気" value={ratingAtmosphere} onChange={setRatingAtmosphere} />
          <ChoiceField label="清潔感" value={ratingCleanliness} onChange={setRatingCleanliness} />
          <ChoiceField label="コース内容" value={ratingCourse} onChange={setRatingCourse} />
          <NavButtons onPrev={() => setStep(1)} onNext={() => setStep(3)} canNext canSkip onSkip={() => setStep(3)} />
        </StepCard>
      )}

      {/* Step 3: 印象ポイント */}
      {step === 3 && (
        <StepCard title="印象に残ったポイント" subtitle="あてはまるものをチェックしてください（複数可）">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
            {SURVEY_HIGHLIGHTS.map((h) => {
              const active = highlights.includes(h);
              return (
                <button
                  key={h}
                  onClick={() => toggleHighlight(h)}
                  style={{
                    padding: "8px 14px",
                    fontSize: 12,
                    minHeight: 36,
                    border: `1px solid ${active ? C.accent : C.border}`,
                    backgroundColor: active ? C.accentBg : "#fff",
                    color: active ? C.accentDark : C.text,
                    cursor: "pointer",
                    fontFamily: FONT_SERIF,
                    transition: "all 0.15s",
                  }}
                >
                  {active ? "✓ " : ""}
                  {h}
                </button>
              );
            })}
          </div>
          <label style={{ display: "block", fontSize: 11, color: C.textMuted, marginBottom: 4 }}>
            その他（自由記述）
          </label>
          <input
            type="text"
            value={highlightsCustom}
            onChange={(e) => setHighlightsCustom(e.target.value)}
            placeholder="ここに記入してください"
            style={inputStyle}
          />
          <NavButtons onPrev={() => setStep(2)} onNext={() => setStep(4)} canNext canSkip onSkip={() => setStep(4)} />
        </StepCard>
      )}

      {/* Step 4: 自由記述 */}
      {step === 4 && (
        <StepCard title="ご感想・改善ご要望" subtitle="自由にお書きください（スキップ可）">
          <TextField
            label="🌸 良かった点・印象的だったこと"
            value={goodPoints}
            onChange={setGoodPoints}
            placeholder="例：アロマの香りが心地よく、リラックスできました"
          />
          <TextField
            label="✨ 改善してほしい点"
            value={improvementPoints}
            onChange={setImprovementPoints}
            placeholder="例：受付の待ち時間がもう少し短いと…"
          />
          <TextField
            label={`💌 ${reservation.therapistName || "セラピスト"}さんへのメッセージ`}
            value={therapistMessage}
            onChange={setTherapistMessage}
            placeholder="ご担当へのお礼の言葉などあればぜひ"
          />
          <NavButtons onPrev={() => setStep(3)} onNext={() => setStep(5)} canNext canSkip onSkip={() => setStep(5)} />
        </StepCard>
      )}

      {/* Step 5: 確認 */}
      {step === 5 && (
        <StepCard title="ご回答内容のご確認" subtitle="この内容で送信します">
          <ConfirmRow label="総合満足度" value={"★".repeat(ratingOverall)} />
          {[
            { l: "セラピストの技術", v: ratingTherapist },
            { l: "サービス全体", v: ratingService },
            { l: "雰囲気", v: ratingAtmosphere },
            { l: "清潔感", v: ratingCleanliness },
            { l: "コース内容", v: ratingCourse },
          ].map((r) => {
            if (!r.v) return null;
            const label = r.v === "good" ? "👍 よかった" : r.v === "normal" ? "😊 ふつう" : "🌱 改善希望";
            return (
              <div key={r.l}>
                <ConfirmRow label={r.l} value={label} />
              </div>
            );
          })}
          {highlights.length > 0 && <ConfirmRow label="印象に残ったポイント" value={highlights.join("、")} />}

          {/* HP掲載同意 */}
          <div
            style={{
              marginTop: 20,
              padding: 14,
              backgroundColor: C.cardAlt,
              border: `1px solid ${C.borderPink}`,
            }}
          >
            <label style={{ display: "flex", gap: 10, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={hpPublishConsent}
                onChange={(e) => setHpPublishConsent(e.target.checked)}
                style={{ marginTop: 3, accentColor: C.accent }}
              />
              <div>
                <p style={{ fontSize: 12, color: C.text, lineHeight: 1.7, marginBottom: 4 }}>
                  ご感想を Ange Spa の<strong style={{ color: C.accentDark }}>HP に匿名掲載</strong>することに同意します
                </p>
                <p style={{ fontSize: 10, color: C.textMuted, lineHeight: 1.6 }}>
                  「30代男性 Aさん」などの形式で掲載します。スタッフ確認後の公開となり、ご同意いただきマイページご登録の方には
                  <strong style={{ color: C.accentDark }}> 500pt </strong>を進呈します。
                </p>
              </div>
            </label>
          </div>

          <div style={{ marginTop: 24, display: "flex", gap: 8 }}>
            <button onClick={() => setStep(4)} style={secondaryButton} disabled={submitting}>
              戻る
            </button>
            <button onClick={handleSubmit} style={primaryButton} disabled={submitting}>
              {submitting ? "送信中…" : "送信する"}
            </button>
          </div>
        </StepCard>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────
// 結果画面
// ────────────────────────────────────────────────────────

function ResultView({
  result,
  backLinkHref,
  backLinkLabel,
  extra,
}: {
  result: SurveySubmitResponse;
  backLinkHref: string;
  backLinkLabel: string;
  extra?: React.ReactNode;
}) {
  return (
    <div>
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <p style={{ fontFamily: FONT_DISPLAY, fontSize: 12, color: C.accent, letterSpacing: 2, marginBottom: 4 }}>
          THANK YOU
        </p>
        <h1 style={{ fontSize: 22, color: C.text, fontWeight: 500, margin: 0 }}>
          ご回答ありがとうございました
        </h1>
        <div style={{ width: 32, height: 1, backgroundColor: C.accent, margin: "12px auto" }} />
      </div>

      {/* クーポン */}
      {result.couponCode && (
        <div style={{ ...cardStyle, marginBottom: 16, backgroundColor: C.accentBg, borderColor: C.borderPink }}>
          <p style={{ fontSize: 13, color: C.accentDark, textAlign: "center", marginBottom: 8, fontWeight: 500 }}>
            🎁 次回ご来店時に <strong>1,000円OFF</strong> を自動適用
          </p>
          <p style={{ fontSize: 11, color: C.textSub, textAlign: "center", marginBottom: 12, lineHeight: 1.7 }}>
            お電話番号でお客様を特定しますので、<br />
            ご予約・ご来店時に何もお伝えいただく必要はございません ✨
          </p>
          <div
            style={{
              padding: "10px 12px",
              backgroundColor: "#fff",
              border: `1px dashed ${C.borderPink}`,
              fontSize: 11,
              color: C.textSub,
              textAlign: "center",
              lineHeight: 1.7,
              marginBottom: 8,
            }}
          >
            <p style={{ margin: 0, marginBottom: 4, color: C.accentDark, fontWeight: 500 }}>
              ⚠️ ご利用条件
            </p>
            <p style={{ margin: 0, fontSize: 10 }}>
              <strong style={{ color: C.text }}>90分以上のコース</strong>でのご利用に限ります<br />
              1回のご予約につき1枚のみご利用可能・他の割引と併用可
            </p>
          </div>
          <div
            style={{
              padding: "8px 12px",
              backgroundColor: "#fff",
              border: `1px solid ${C.border}`,
              fontSize: 10,
              color: C.textMuted,
              textAlign: "center",
              lineHeight: 1.6,
            }}
          >
            有効期限{" "}
            <strong style={{ color: C.text }}>
              {new Date(result.couponExpiresAt).toLocaleDateString("ja-JP")}
            </strong>{" "}
            まで
          </div>
        </div>
      )}

      {extra && <div style={{ marginBottom: 16 }}>{extra}</div>}

      <div style={{ ...cardStyle, marginBottom: 16 }}>
        <p style={{ fontSize: 12, color: C.textSub, lineHeight: 1.7, textAlign: "center" }}>
          いただいたご感想は今後のサービス向上に役立てさせていただきます。<br />
          またのお越しをお待ちしております🌸
        </p>
      </div>

      <Link href={backLinkHref} style={{ ...linkButton, display: "block", textAlign: "center" }}>
        {backLinkLabel}
      </Link>
    </div>
  );
}

// ────────────────────────────────────────────────────────
// 内部ヘルパー
// ────────────────────────────────────────────────────────

function StepCard({
  title,
  subtitle,
  required,
  children,
}: {
  title: string;
  subtitle: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div style={cardStyle}>
      <h2 style={{ fontSize: 16, color: C.text, fontWeight: 500, margin: 0, marginBottom: 4 }}>
        {title}
        {required && <span style={{ color: C.accent, marginLeft: 6, fontSize: 11 }}>必須</span>}
      </h2>
      <p style={{ fontSize: 11, color: C.textMuted, marginBottom: 20 }}>{subtitle}</p>
      {children}
    </div>
  );
}

function ChoiceField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: RatingChoice | "";
  onChange: (v: RatingChoice | "") => void;
}) {
  const choices: { v: RatingChoice; label: string; emoji: string }[] = [
    { v: "good", label: "よかった", emoji: "👍" },
    { v: "normal", label: "ふつう", emoji: "😊" },
    { v: "bad", label: "改善希望", emoji: "🌱" },
  ];
  return (
    <div style={{ marginBottom: 14 }}>
      <p style={{ fontSize: 12, color: C.text, marginBottom: 6 }}>{label}</p>
      <div style={{ display: "flex", gap: 6 }}>
        {choices.map((c) => {
          const active = value === c.v;
          return (
            <button
              key={c.v}
              onClick={() => onChange(active ? "" : c.v)}
              style={{
                flex: 1,
                padding: "10px 4px",
                fontSize: 11,
                minHeight: 44,
                border: `1px solid ${active ? C.accent : C.border}`,
                backgroundColor: active ? C.accentBg : "#fff",
                color: active ? C.accentDark : C.textSub,
                cursor: "pointer",
                fontFamily: FONT_SERIF,
              }}
            >
              <span style={{ fontSize: 16, display: "block", marginBottom: 2 }}>{c.emoji}</span>
              {c.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", fontSize: 12, color: C.text, marginBottom: 6 }}>{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        style={{ ...inputStyle, resize: "vertical", fontFamily: FONT_SERIF }}
      />
    </div>
  );
}

function ConfirmRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
      <span style={{ fontSize: 11, color: C.textMuted }}>{label}</span>
      <span style={{ fontSize: 12, color: C.text, textAlign: "right", maxWidth: "60%" }}>{value}</span>
    </div>
  );
}

function NavButtons({
  onPrev,
  onNext,
  canNext,
  canSkip,
  onSkip,
  isFirst,
}: {
  onPrev?: () => void;
  onNext: () => void;
  canNext: boolean;
  canSkip?: boolean;
  onSkip?: () => void;
  isFirst?: boolean;
}) {
  return (
    <div style={{ marginTop: 20, display: "flex", gap: 8 }}>
      {!isFirst && onPrev && (
        <button onClick={onPrev} style={secondaryButton}>
          戻る
        </button>
      )}
      {canSkip && onSkip && (
        <button onClick={onSkip} style={skipButton}>
          スキップ
        </button>
      )}
      <button onClick={onNext} disabled={!canNext} style={canNext ? primaryButton : disabledButton}>
        次へ
      </button>
    </div>
  );
}

// ────────────────────────────────────────────────────────
// スタイル
// ────────────────────────────────────────────────────────

export const containerStyle: React.CSSProperties = {
  minHeight: "100vh",
  backgroundColor: C.bg,
  fontFamily: FONT_SERIF,
  padding: "24px 16px 48px",
  maxWidth: 560,
  margin: "0 auto",
  color: C.text,
};

export const cardStyle: React.CSSProperties = {
  backgroundColor: C.card,
  border: `1px solid ${C.border}`,
  padding: 20,
  marginBottom: 16,
};

export const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: 10,
  fontSize: 13,
  border: `1px solid ${C.border}`,
  backgroundColor: "#fff",
  color: C.text,
  fontFamily: FONT_SERIF,
  outline: "none",
};

export const primaryButton: React.CSSProperties = {
  flex: 1,
  padding: "14px",
  fontSize: 13,
  backgroundColor: C.accent,
  color: "#fff",
  border: "none",
  cursor: "pointer",
  fontFamily: FONT_SERIF,
  letterSpacing: 1,
  minHeight: 44,
};

export const secondaryButton: React.CSSProperties = {
  flex: 1,
  padding: "14px",
  fontSize: 13,
  backgroundColor: "#fff",
  color: C.textSub,
  border: `1px solid ${C.border}`,
  cursor: "pointer",
  fontFamily: FONT_SERIF,
  minHeight: 44,
};

export const skipButton: React.CSSProperties = {
  flex: 1,
  padding: "14px",
  fontSize: 12,
  backgroundColor: "transparent",
  color: C.textMuted,
  border: "none",
  cursor: "pointer",
  fontFamily: FONT_SERIF,
  minHeight: 44,
};

export const disabledButton: React.CSSProperties = {
  ...primaryButton,
  backgroundColor: C.textFaint,
  cursor: "not-allowed",
};

export const linkButton: React.CSSProperties = {
  display: "inline-block",
  padding: "12px 20px",
  fontSize: 12,
  backgroundColor: C.accent,
  color: "#fff",
  textDecoration: "none",
  fontFamily: FONT_SERIF,
  letterSpacing: 1,
};
