"use client";

/**
 * ═══════════════════════════════════════════════════════════
 * アンケート回答画面
 *
 * URL: /mypage/survey/[reservationId]
 *
 * 5ステップ式で進行:
 *   Step 1: 総合満足度 (5段階星) ← 必須
 *   Step 2: 各項目評価 (3段階) ← 任意
 *   Step 3: 印象ポイント (複数選択) ← 任意
 *   Step 4: 自由記述 (3つの textarea) ← 任意
 *   Step 5: 確認 → 送信
 *
 * 設計: docs/14_REVIEW_SYSTEM.md
 * Phase 1B-2 では AI 言語化なしで直接送信する。
 * Phase 1C で AI 言語化補助を組み込む予定。
 * ═══════════════════════════════════════════════════════════
 */

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import {
  SURVEY_HIGHLIGHTS,
  type RatingChoice,
  type SurveyHighlight,
  type SurveySubmitRequest,
  type SurveySubmitResponse,
} from "@/lib/survey-types";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://cbewozzdyjqmhzkxsjqo.supabase.co",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
);

// ────────────────────────────────────────────────────────
// テーマ（マイページと統一）
// ────────────────────────────────────────────────────────

const C = {
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
const FONT_SERIF = "'Noto Serif JP', 'Yu Mincho', 'Hiragino Mincho ProN', serif";
const FONT_DISPLAY = "'Cormorant Garamond', 'Noto Serif JP', 'Yu Mincho', serif";

// ────────────────────────────────────────────────────────
// 型
// ────────────────────────────────────────────────────────

type Reservation = {
  id: number;
  date: string;
  start_time: string;
  end_time: string;
  course: string;
  therapist_id: number;
  customer_name: string;
  customer_status: string;
};

type Therapist = { id: number; name: string };

const TOTAL_STEPS = 5;

// ────────────────────────────────────────────────────────
// メイン
// ────────────────────────────────────────────────────────

export default function SurveyAnswerPage() {
  const router = useRouter();
  const params = useParams<{ reservationId: string }>();
  const reservationId = parseInt(params?.reservationId || "0", 10);

  // 認証 & 予約データ
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [therapist, setTherapist] = useState<Therapist | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

  // ─────────────────────────────────────
  // 初期化
  // ─────────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;

    const savedId = localStorage.getItem("customer_mypage_id");
    if (!savedId) {
      setError("ログインが必要です。マイページからお進みください。");
      setLoading(false);
      return;
    }

    const cid = parseInt(savedId, 10);
    setCustomerId(cid);

    if (!reservationId) {
      setError("予約情報が見つかりません");
      setLoading(false);
      return;
    }

    (async () => {
      // 予約取得
      const { data: res } = await supabase
        .from("reservations")
        .select("*")
        .eq("id", reservationId)
        .maybeSingle();

      if (!res) {
        setError("ご予約が見つかりません");
        setLoading(false);
        return;
      }
      setReservation(res);

      // 顧客名一致チェック（他人の予約は閲覧不可）
      const { data: cust } = await supabase
        .from("customers")
        .select("name")
        .eq("id", cid)
        .maybeSingle();

      if (!cust || cust.name !== res.customer_name) {
        setError("このご予約のアンケートにはアクセスできません");
        setLoading(false);
        return;
      }

      // 既回答チェック
      const { data: existing } = await supabase
        .from("customer_surveys")
        .select("id")
        .eq("reservation_id", reservationId)
        .maybeSingle();

      if (existing) {
        setError("このご予約のアンケートはご回答済みです");
        setLoading(false);
        return;
      }

      // セラピスト
      if (res.therapist_id) {
        const { data: th } = await supabase
          .from("therapists")
          .select("id, name")
          .eq("id", res.therapist_id)
          .maybeSingle();
        if (th) setTherapist(th);
      }

      setLoading(false);
    })();
  }, [reservationId]);

  // ─────────────────────────────────────
  // 進行・送信
  // ─────────────────────────────────────

  const canGoNextFromStep1 = ratingOverall >= 1 && ratingOverall <= 5;
  const progress = useMemo(() => Math.round((step / TOTAL_STEPS) * 100), [step]);

  const toggleHighlight = (h: SurveyHighlight) => {
    setHighlights((prev) =>
      prev.includes(h) ? prev.filter((x) => x !== h) : [...prev, h]
    );
  };

  const handleSubmit = async () => {
    if (!reservation || !customerId) return;
    setSubmitting(true);

    try {
      const payload: SurveySubmitRequest = {
        customerId,
        reservationId: reservation.id,
        therapistId: reservation.therapist_id,
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
        submittedFrom: "mypage",
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

  // ─────────────────────────────────────
  // レンダリング
  // ─────────────────────────────────────

  if (loading) {
    return (
      <div style={containerStyle}>
        <p style={{ textAlign: "center", color: C.textMuted }}>読み込み中…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <p style={{ color: C.accentDark, marginBottom: 16 }}>{error}</p>
          <Link href="/mypage" style={linkButton}>
            マイページに戻る
          </Link>
        </div>
      </div>
    );
  }

  // 送信完了画面
  if (result) {
    return <ResultView result={result} />;
  }

  return (
    <div style={containerStyle}>
      {/* ヘッダー */}
      <div style={{ marginBottom: 24 }}>
        <p style={{ fontFamily: FONT_DISPLAY, fontSize: 12, color: C.accent, letterSpacing: 2, marginBottom: 4 }}>
          CUSTOMER SURVEY
        </p>
        <h1 style={{ fontSize: 22, color: C.text, fontWeight: 500, margin: 0 }}>ご感想をお聞かせください</h1>
        <div style={{ width: 32, height: 1, backgroundColor: C.accent, margin: "12px 0" }} />
        <p style={{ fontSize: 12, color: C.textSub, lineHeight: 1.7 }}>
          所要 2〜3分。最後まで完了で <strong style={{ color: C.accentDark }}>1,000円OFFクーポン</strong> をプレゼント🎁
        </p>
      </div>

      {/* 予約情報 */}
      {reservation && (
        <div style={{ ...cardStyle, marginBottom: 16, backgroundColor: C.cardAlt }}>
          <p style={{ fontSize: 11, color: C.textMuted, marginBottom: 4 }}>ご来店</p>
          <p style={{ fontSize: 14, color: C.text }}>
            {reservation.date} {reservation.start_time}〜
            {therapist && (
              <span style={{ color: C.accentDark, marginLeft: 8 }}>担当: {therapist.name}</span>
            )}
          </p>
          <p style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>{reservation.course}</p>
        </div>
      )}

      {/* プログレス */}
      <div style={{ marginBottom: 24 }}>
        <p style={{ fontSize: 11, color: C.textMuted, marginBottom: 6 }}>
          ステップ {step} / {TOTAL_STEPS}
        </p>
        <div style={{ height: 4, backgroundColor: C.cardAlt, borderRadius: 2, overflow: "hidden" }}>
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
          <NavButtons
            onNext={() => setStep(2)}
            canNext={canGoNextFromStep1}
            isFirst
          />
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
            label={`💌 ${therapist?.name || "セラピスト"}さんへのメッセージ`}
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
                  「30代男性 Aさん」などの形式で掲載します。スタッフ確認後の公開となり、ご同意いただいた方には
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
// サブコンポーネント
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
// 完了画面（暫定 - Phase 2A で完成版に差し替え）
// ────────────────────────────────────────────────────────

function ResultView({ result }: { result: SurveySubmitResponse }) {
  const [copied, setCopied] = useState(false);

  const copyCode = async () => {
    if (!result.couponCode) return;
    await navigator.clipboard.writeText(result.couponCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={containerStyle}>
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
          <p style={{ fontSize: 11, color: C.accentDark, textAlign: "center", marginBottom: 8 }}>
            🎁 次回使える 1,000円OFFクーポン
          </p>
          <p
            style={{
              fontSize: 26,
              fontFamily: "monospace",
              textAlign: "center",
              color: C.text,
              letterSpacing: 4,
              margin: "8px 0",
              fontWeight: 600,
            }}
          >
            {result.couponCode}
          </p>
          <p style={{ fontSize: 10, color: C.textMuted, textAlign: "center", marginBottom: 12 }}>
            有効期限: {new Date(result.couponExpiresAt).toLocaleDateString("ja-JP")} まで・他の割引と併用可
          </p>
          <button
            onClick={copyCode}
            style={{
              width: "100%",
              padding: 12,
              fontSize: 12,
              backgroundColor: copied ? C.green : C.accent,
              color: "#fff",
              border: "none",
              cursor: "pointer",
              fontFamily: FONT_SERIF,
              transition: "background 0.2s",
            }}
          >
            {copied ? "✓ コピーしました" : "📋 コードをコピー"}
          </button>
        </div>
      )}

      {/* HP掲載のお礼 */}
      <div style={{ ...cardStyle, marginBottom: 16 }}>
        <p style={{ fontSize: 12, color: C.textSub, lineHeight: 1.7, textAlign: "center" }}>
          いただいたご感想は今後のサービス向上に役立てさせていただきます。<br />
          またのお越しをお待ちしております🌸
        </p>
      </div>

      <Link href="/mypage" style={{ ...linkButton, display: "block", textAlign: "center" }}>
        マイページに戻る
      </Link>
    </div>
  );
}

// ────────────────────────────────────────────────────────
// スタイル
// ────────────────────────────────────────────────────────

const containerStyle: React.CSSProperties = {
  minHeight: "100vh",
  backgroundColor: C.bg,
  fontFamily: FONT_SERIF,
  padding: "24px 16px 48px",
  maxWidth: 560,
  margin: "0 auto",
  color: C.text,
};

const cardStyle: React.CSSProperties = {
  backgroundColor: C.card,
  border: `1px solid ${C.border}`,
  padding: 20,
  marginBottom: 16,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: 10,
  fontSize: 13,
  border: `1px solid ${C.border}`,
  backgroundColor: "#fff",
  color: C.text,
  fontFamily: FONT_SERIF,
  outline: "none",
};

const primaryButton: React.CSSProperties = {
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

const secondaryButton: React.CSSProperties = {
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

const skipButton: React.CSSProperties = {
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

const disabledButton: React.CSSProperties = {
  ...primaryButton,
  backgroundColor: C.textFaint,
  cursor: "not-allowed",
};

const linkButton: React.CSSProperties = {
  display: "inline-block",
  padding: "12px 20px",
  fontSize: 12,
  backgroundColor: C.accent,
  color: "#fff",
  textDecoration: "none",
  fontFamily: FONT_SERIF,
  letterSpacing: 1,
};
