"use client";
import { useState } from "react";
import { useStaffSession } from "../lib/staff-session";
import { useTheme } from "../lib/theme";

/**
 * PIN 変更モーダル
 * - needsPinChange = true のときに自動表示（初回ログイン・PIN 未変更時）
 * - 「あとで変更」ボタンで一時的にスキップ可能（次回ログインで再表示）
 * - 本番運用開始（6/1）までに全員の PIN を変更してもらうための強制フロー
 */
export default function PinChangeModal() {
  const { activeStaff, needsPinChange, changePin, dismissPinChangeTemporarily, logout } = useStaffSession();
  const { T } = useTheme();
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<"current" | "new" | "confirm">("current");

  if (!needsPinChange || !activeStaff) return null;

  const resetAll = () => {
    setCurrentPin("");
    setNewPin("");
    setConfirmPin("");
    setError("");
    setStep("current");
  };

  // どのフィールドを入力中か
  const activeValue = step === "current" ? currentPin : step === "new" ? newPin : confirmPin;
  const setActiveValue = (v: string) => {
    if (step === "current") setCurrentPin(v);
    else if (step === "new") setNewPin(v);
    else setConfirmPin(v);
  };

  const handleDigit = (n: number | "del") => {
    setError("");
    if (n === "del") {
      setActiveValue(activeValue.slice(0, -1));
      return;
    }
    const next = activeValue + String(n);
    if (next.length > 4) return;
    setActiveValue(next);
    if (next.length === 4) {
      // 4 桁入力完了 → 次のステップへ
      if (step === "current") setStep("new");
      else if (step === "new") setStep("confirm");
      else {
        // confirm 入力完了 → 自動 submit（次の tick で）
        setTimeout(() => {
          setError("");
          setSaving(true);
          changePin(currentPin, newPin).then(result => {
            setSaving(false);
            if (!result.ok) {
              setError(result.error || "PIN の変更に失敗しました");
              resetAll();
              return;
            }
          });
        }, 150);
      }
    }
  };

  // ステップ別のタイトル・説明
  const stepTitle = {
    current: "現在の PIN を入力",
    new: "新しい PIN を設定",
    confirm: "新しい PIN をもう一度",
  }[step];

  const stepColor = {
    current: "#85a8c4",
    new: "#c3a782",
    confirm: "#22c55e",
  }[step];

  return (
    <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div
        className="rounded-2xl w-full max-w-[360px] p-6 animate-[fadeIn_0.3s]"
        style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}
      >
        {/* ヘッダー */}
        <div className="text-center mb-4">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full mb-3" style={{ backgroundColor: "#c3a78222", border: "1px solid #c3a78244" }}>
            <span className="text-[24px]">🔐</span>
          </div>
          <h2 className="text-[15px] font-medium mb-1">PIN の変更が必要です</h2>
          <p className="text-[11px]" style={{ color: T.textMuted }}>
            {activeStaff.name} さん、セキュリティのため初回 PIN の変更をお願いします
          </p>
        </div>

        {/* 進捗インジケーター */}
        <div className="flex items-center justify-center gap-2 mb-4">
          {(["current", "new", "confirm"] as const).map((s, i) => {
            const done = (step === "new" && i === 0) || (step === "confirm" && i <= 1);
            const active = s === step;
            return (
              <div
                key={s}
                className="h-1.5 rounded-full transition-all"
                style={{
                  width: active ? 28 : 16,
                  backgroundColor: done ? "#22c55e" : active ? stepColor : T.border,
                }}
              />
            );
          })}
        </div>

        {/* 現ステップ */}
        <p className="text-[12px] text-center font-medium mb-3" style={{ color: stepColor }}>
          {stepTitle}
        </p>

        {/* PIN 表示 */}
        <div className="flex justify-center gap-2 mb-4">
          {[0, 1, 2, 3].map(i => (
            <div
              key={i}
              className="w-12 h-14 rounded-xl flex items-center justify-center text-[22px] font-bold transition-all"
              style={{
                backgroundColor: T.cardAlt,
                color: activeValue[i] ? T.text : T.textFaint,
                border: `2px solid ${activeValue.length === i ? stepColor : T.border}`,
              }}
            >
              {activeValue[i] ? "●" : ""}
            </div>
          ))}
        </div>

        {/* 数字キーパッド */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, null, 0, "del"].map((n, i) => {
            if (n === null) return <div key={i} />;
            return (
              <button
                key={i}
                onClick={() => handleDigit(n as number | "del")}
                disabled={saving}
                className="h-12 rounded-xl text-[16px] font-medium cursor-pointer disabled:opacity-50 transition-all active:scale-95"
                style={{
                  backgroundColor: T.cardAlt,
                  color: n === "del" ? "#c45555" : T.text,
                  border: `1px solid ${T.border}`,
                }}
              >
                {n === "del" ? "⌫" : n}
              </button>
            );
          })}
        </div>

        {/* エラー表示 */}
        {error && (
          <div className="px-3 py-2 rounded-lg mb-3 text-[11px] text-center" style={{ backgroundColor: "#c4555512", color: "#c45555", border: "1px solid #c4555533" }}>
            {error}
          </div>
        )}

        {/* ガイド */}
        <div className="rounded-lg px-3 py-2 mb-3 text-[10px] leading-relaxed" style={{ backgroundColor: T.cardAlt, color: T.textMuted }}>
          💡 <strong>推測されやすい PIN は使えません</strong>
          <br />
          例: 0000, 1234, 1111, 誕生年（1999・2000 など）
        </div>

        {/* フッターボタン */}
        <div className="flex gap-2">
          <button
            onClick={dismissPinChangeTemporarily}
            disabled={saving}
            className="flex-1 py-2 text-[11px] rounded-xl cursor-pointer border disabled:opacity-50"
            style={{ borderColor: T.border, color: T.textSub }}
          >
            あとで
          </button>
          <button
            onClick={logout}
            disabled={saving}
            className="flex-1 py-2 text-[11px] rounded-xl cursor-pointer disabled:opacity-50"
            style={{ backgroundColor: "#c4555512", color: "#c45555", border: "1px solid #c4555533" }}
          >
            ログアウト
          </button>
        </div>

        {/* 進行中のステップ用に戻るボタン */}
        {step !== "current" && (
          <button
            onClick={() => {
              setError("");
              if (step === "new") {
                setStep("current");
                setCurrentPin("");
              } else {
                setStep("new");
                setNewPin("");
                setConfirmPin("");
              }
            }}
            className="w-full mt-2 py-1.5 text-[10px] cursor-pointer"
            style={{ color: T.textMuted, background: "none", border: "none" }}
          >
            ← 前のステップに戻る
          </button>
        )}
      </div>
    </div>
  );
}
