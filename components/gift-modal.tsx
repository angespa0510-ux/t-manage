"use client";

import { useState, useEffect } from "react";
import { GIFT_CATALOG, type GiftKind } from "../lib/gift-catalog";
import { SITE } from "../lib/site-theme";

const FONT_SERIF = "'Noto Serif JP', 'Yu Mincho', 'Hiragino Mincho ProN', serif";
const FONT_DISPLAY = "'Cormorant Garamond', 'Noto Serif JP', 'Yu Mincho', serif";

type Props = {
  open: boolean;
  onClose: () => void;
  customerId: number | null;
  sourceType: "live" | "diary" | "story";
  sourceId: number;
  recipientName?: string;
  /** 送信成功時のコールバック (ライブ画面でアニメ起動など) */
  onSent?: (sentGift: { kind: GiftKind; emoji: string; pointAmount: number; message: string | null }) => void;
};

/**
 * 投げ銭モーダル
 *
 * - 8アイテムから選択 (gift-catalog.ts)
 * - メッセージ入力 (任意、30字)
 * - 残高チェック → 送信
 * - ログイン必須
 */
export default function GiftModal({ open, onClose, customerId, sourceType, sourceId, recipientName, onSent }: Props) {
  const [selectedKind, setSelectedKind] = useState<GiftKind | null>(null);
  const [message, setMessage] = useState("");
  const [balance, setBalance] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // モーダル開いた時に残高再取得
  useEffect(() => {
    if (!open || !customerId) return;
    setSelectedKind(null);
    setMessage("");
    setErrorMsg(null);
    setSuccessMsg(null);
    fetchBalance();
  }, [open, customerId]);

  const fetchBalance = async () => {
    if (!customerId) return;
    try {
      // customer_points を直接取得して合計
      const res = await fetch(`/api/customer/balance?customerId=${customerId}`);
      if (res.ok) {
        const data = await res.json();
        if (typeof data.pointBalance === "number") {
          setBalance(data.pointBalance);
        }
      }
    } catch {
      // 失敗してもエラー表示しない (送信時にどのみち判定)
    }
  };

  const handleSubmit = async () => {
    if (!customerId || !selectedKind) return;
    setSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/gift/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId,
          sourceType,
          sourceId,
          giftKind: selectedKind,
          message: message.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (typeof data.currentBalance === "number") {
          setBalance(data.currentBalance);
        }
        setErrorMsg(
          data.detail
            ? `${data.error || "送信に失敗しました"}\n${data.detail}${data.hint ? "\n💡 " + data.hint : ""}`
            : data.error || "送信に失敗しました"
        );
      } else {
        setBalance(data.newBalance);
        setSuccessMsg(`✨ ${data.gift.emoji} ${data.gift.label} を送りました!`);
        if (onSent) {
          onSent({
            kind: data.gift.kind,
            emoji: data.gift.emoji,
            pointAmount: data.gift.pointAmount,
            message: data.message || null,
          });
        }
        // 1.5秒後にクローズ
        setTimeout(() => {
          onClose();
        }, 1500);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "通信エラー";
      setErrorMsg(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  const selected = selectedKind ? GIFT_CATALOG.find((g) => g.kind === selectedKind) : null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.65)",
        zIndex: 10000,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 540,
          maxHeight: "85vh",
          overflowY: "auto",
          backgroundColor: "#fff",
          color: "#2b2b2b",
          padding: "16px 14px 24px",
          fontFamily: FONT_SERIF,
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
        }}
      >
        {/* ヘッダ */}
        <div style={{ textAlign: "center", marginBottom: 10 }}>
          <p style={{ fontFamily: FONT_DISPLAY, fontSize: 11, letterSpacing: "0.25em", color: SITE.color.pink, marginBottom: 4, fontWeight: 500 }}>
            GIFT
          </p>
          <p style={{ fontSize: 14, color: SITE.color.text, fontWeight: 500 }}>
            🎁 {recipientName ? `${recipientName}さんに` : ""}投げ銭を送る
          </p>
          {balance !== null && (
            <p style={{ fontSize: 11, color: SITE.color.textSub, marginTop: 6 }}>
              残高: <strong style={{ color: SITE.color.pink, fontVariantNumeric: "tabular-nums" }}>{balance.toLocaleString()}pt</strong>
            </p>
          )}
        </div>

        {/* 成功メッセージ */}
        {successMsg && (
          <div style={{ padding: 12, backgroundColor: "#f0f7f1", border: `1px solid #6b9b7e`, fontSize: 12, color: "#3d6149", textAlign: "center", marginBottom: 12 }}>
            {successMsg}
          </div>
        )}

        {/* エラー */}
        {errorMsg && (
          <div style={{ padding: 10, backgroundColor: "#fef2f2", border: `1px solid #c45555`, fontSize: 11, color: "#7a2929", marginBottom: 12, textAlign: "left", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
            {errorMsg}
          </div>
        )}

        {!successMsg && (
          <>
            {/* ギフト一覧 (4列) */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 14 }}>
              {GIFT_CATALOG.map((g) => {
                const isSelected = selectedKind === g.kind;
                const cantAfford = balance !== null && balance < g.pointAmount;
                return (
                  <button
                    key={g.kind}
                    onClick={() => !cantAfford && setSelectedKind(g.kind)}
                    disabled={cantAfford}
                    style={{
                      padding: "12px 4px 10px",
                      cursor: cantAfford ? "not-allowed" : "pointer",
                      backgroundColor: isSelected ? `${g.color}33` : "#faf6f1",
                      color: SITE.color.text,
                      border: `1.5px solid ${isSelected ? g.color : SITE.color.border}`,
                      fontFamily: FONT_SERIF,
                      transition: "all 0.15s",
                      opacity: cantAfford ? 0.4 : 1,
                      position: "relative",
                    }}
                  >
                    <div style={{ fontSize: 28, marginBottom: 4 }}>{g.emoji}</div>
                    <p style={{ fontSize: 10, color: SITE.color.text, marginBottom: 2 }}>{g.label}</p>
                    <p style={{ fontSize: 11, color: g.color, fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>
                      {g.pointAmount}pt
                    </p>
                    {cantAfford && (
                      <p style={{ fontSize: 8, color: "#c45555", marginTop: 2 }}>残高不足</p>
                    )}
                  </button>
                );
              })}
            </div>

            {/* 選択時の詳細 + メッセージ入力 */}
            {selected && (
              <div style={{ padding: 12, backgroundColor: `${selected.color}15`, border: `1px solid ${selected.color}66`, marginBottom: 12 }}>
                <p style={{ fontSize: 12, color: SITE.color.text, textAlign: "center", marginBottom: 8 }}>
                  <span style={{ fontSize: 24, marginRight: 6 }}>{selected.emoji}</span>
                  <strong>{selected.label}</strong>
                  <span style={{ marginLeft: 8, color: selected.color, fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>
                    {selected.pointAmount}pt
                  </span>
                </p>
                <p style={{ fontSize: 10, color: SITE.color.textSub, textAlign: "center", marginBottom: 10 }}>
                  {selected.description}
                </p>
                <div>
                  <p style={{ fontSize: 9, color: SITE.color.textSub, marginBottom: 4, fontFamily: FONT_DISPLAY, letterSpacing: "0.1em" }}>
                    MESSAGE · 一言メッセージ (任意、30字)
                  </p>
                  <input
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="応援メッセージを添える..."
                    maxLength={30}
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      fontSize: 12,
                      border: `1px solid ${SITE.color.border}`,
                      backgroundColor: "#fff",
                      color: SITE.color.text,
                      fontFamily: FONT_SERIF,
                      outline: "none",
                    }}
                  />
                  <p style={{ fontSize: 9, color: SITE.color.textMuted, marginTop: 2, textAlign: "right" }}>
                    {message.length}/30
                  </p>
                </div>
              </div>
            )}

            {/* 送信ボタン */}
            <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 8 }}>
              <button
                onClick={onClose}
                style={{ padding: "12px 18px", fontSize: 12, cursor: "pointer", backgroundColor: "transparent", border: `1px solid ${SITE.color.border}`, color: SITE.color.textSub, fontFamily: FONT_SERIF }}
              >
                キャンセル
              </button>
              <button
                onClick={handleSubmit}
                disabled={!selected || submitting}
                style={{
                  padding: "12px 18px",
                  fontSize: 13,
                  cursor: !selected || submitting ? "not-allowed" : "pointer",
                  backgroundColor: SITE.color.pink,
                  color: "#fff",
                  border: "none",
                  fontFamily: FONT_SERIF,
                  letterSpacing: "0.1em",
                  fontWeight: 500,
                  opacity: !selected || submitting ? 0.4 : 1,
                }}
              >
                {submitting ? "送信中..." : selected ? `${selected.emoji} ${selected.label}を送る (${selected.pointAmount}pt)` : "ギフトを選んでください"}
              </button>
            </div>

            {customerId === null && (
              <p style={{ fontSize: 10, color: "#c45555", marginTop: 10, textAlign: "center" }}>
                投げ銭には会員ログインが必要です
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
