"use client";
import { useState, useEffect, ReactNode } from "react";
import { useTheme } from "../lib/theme";

export type ConfirmVariant = "danger" | "warning" | "info";

export type ConfirmModalProps = {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  message?: string | ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmVariant;
  /**
   * 重大な操作向け: ユーザーにこの文字を入力させ、一致したときだけ確認ボタンが押せる。
   * 例: セラピスト名を入力させてから削除実行
   */
  typeToConfirm?: string;
  /** ヘッダーに表示する絵文字（指定なければ variant から自動選択） */
  icon?: string;
};

/**
 * 共通の確認モーダル
 *
 * - variant="danger"（赤）: 削除・取消・不可逆操作
 * - variant="warning"（黄）: 注意が必要な変更
 * - variant="info"（青）: 通常の確認
 *
 * 重大な操作（セラピスト/スタッフの削除など）は typeToConfirm を使い、
 * 対象の名前などを入力させてから実行させる（誤操作防止）。
 *
 * 直接使うよりも useConfirm フックで Promise ベースに扱う方が楽。
 */
export default function ConfirmModal({
  open,
  onCancel,
  onConfirm,
  title,
  message,
  confirmLabel = "削除する",
  cancelLabel = "キャンセル",
  variant = "danger",
  typeToConfirm,
  icon,
}: ConfirmModalProps) {
  const { T } = useTheme();
  const [typedText, setTypedText] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setTypedText("");
      setBusy(false);
    }
  }, [open]);

  if (!open) return null;

  const variantStyles: Record<ConfirmVariant, { main: string; bg: string; border: string; defaultIcon: string }> = {
    danger: { main: "#c96b83", bg: "rgba(201,107,131,0.08)", border: "#c96b8344", defaultIcon: "⚠️" },
    warning: { main: "#b38419", bg: "rgba(179,132,25,0.08)", border: "#b3841944", defaultIcon: "⚠️" },
    info: { main: "#6b8ba8", bg: "rgba(107,139,168,0.08)", border: "#6b8ba844", defaultIcon: "ℹ️" },
  };
  const c = variantStyles[variant];
  const iconToShow = icon ?? c.defaultIcon;

  const canConfirm = !typeToConfirm || typedText.trim() === typeToConfirm;

  const handleConfirm = async () => {
    if (!canConfirm || busy) return;
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={() => { if (!busy) onCancel(); }}
    >
      <div
        className="rounded-2xl w-full max-w-[400px] p-6 animate-[fadeIn_0.2s]"
        style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 mb-4">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-[18px]"
            style={{ backgroundColor: c.bg, border: `1px solid ${c.border}` }}
          >
            {iconToShow}
          </div>
          <div className="flex-1 pt-0.5">
            <h3 className="text-[14px] font-medium mb-1" style={{ color: T.text }}>{title}</h3>
            {message && (
              <div className="text-[11px] leading-relaxed" style={{ color: T.textSub }}>
                {message}
              </div>
            )}
          </div>
        </div>

        {typeToConfirm && (
          <div className="mb-4">
            <p className="text-[10px] mb-1.5" style={{ color: T.textMuted }}>
              確認のため <strong style={{ color: c.main }}>「{typeToConfirm}」</strong> と入力してください
            </p>
            <input
              type="text"
              value={typedText}
              onChange={(e) => setTypedText(e.target.value)}
              autoFocus
              disabled={busy}
              className="w-full px-3 py-2 rounded-lg text-[12px] outline-none transition-colors"
              style={{
                backgroundColor: T.cardAlt,
                border: `1px solid ${canConfirm && typedText ? c.main : T.border}`,
                color: T.text,
              }}
              placeholder={typeToConfirm}
              onKeyDown={(e) => {
                if (e.key === "Enter" && canConfirm && !busy) handleConfirm();
                if (e.key === "Escape" && !busy) onCancel();
              }}
            />
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={onCancel}
            disabled={busy}
            className="flex-1 py-2.5 text-[12px] rounded-xl cursor-pointer border disabled:opacity-50"
            style={{ borderColor: T.border, color: T.textSub, backgroundColor: T.card }}
          >
            {cancelLabel}
          </button>
          <button
            onClick={handleConfirm}
            disabled={!canConfirm || busy}
            className="flex-1 py-2.5 text-[12px] rounded-xl cursor-pointer font-medium disabled:opacity-40 transition-all"
            style={{
              backgroundColor: canConfirm ? c.main : T.cardAlt,
              color: canConfirm ? "#fff" : T.textMuted,
              border: `1px solid ${canConfirm ? c.main : T.border}`,
            }}
          >
            {busy ? "処理中..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
