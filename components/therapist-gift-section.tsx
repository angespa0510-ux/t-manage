"use client";

import { useState, useEffect, useCallback } from "react";

type ColorTheme = {
  bg: string;
  card: string;
  cardAlt: string;
  border: string;
  text: string;
  textSub: string;
  textMuted: string;
  accent: string;
  accentBg: string;
  accentDeep: string;
};

type Props = {
  therapistId: number;
  authToken: string;
  C: ColorTheme;
  FONT_SERIF: string;
  FONT_DISPLAY: string;
  FONT_SANS: string;
};

type Balance = {
  totalReceived: number;
  totalCount: number;
  currentBalance: number;
  thisMonth: number;
  thisYear: number;
  lastReceivedAt: string | null;
  firstReceivedAt: string | null;
};

type Gift = {
  id: number;
  sender: { id: number; displayName: string };
  sourceType: string;
  sourceId: number | null;
  gift: { kind: string; label: string | null; emoji: string | null; pointAmount: number };
  message: string | null;
  createdAt: string;
};

/**
 * セラピストマイページ用 投げ銭受領セクション
 *
 * - 残高/累計/今月/今年 の4数字を大きく表示
 * - 受領履歴 (直近20件)
 */
export default function TherapistGiftSection({ therapistId, authToken, C, FONT_SERIF, FONT_DISPLAY }: Props) {
  const [balance, setBalance] = useState<Balance | null>(null);
  const [gifts, setGifts] = useState<Gift[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAllGifts, setShowAllGifts] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/gift/list?therapistId=${therapistId}&authToken=${encodeURIComponent(authToken)}&limit=50`
      );
      const data = await res.json();
      if (res.ok) {
        setBalance(data.balance);
        setGifts(data.gifts || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [therapistId, authToken]);

  useEffect(() => {
    fetchData();
    // 30秒ごと自動更新
    const t = setInterval(fetchData, 30000);
    return () => clearInterval(t);
  }, [fetchData]);

  const fmt = (n: number) => n.toLocaleString();
  const fmtDateTime = (iso: string | null) => {
    if (!iso) return "—";
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };
  const sourceLabel = (t: string) => t === "live" ? "🔴 ライブ" : t === "diary" ? "📓 日記" : "📡 ストーリー";

  if (loading) {
    return <p style={{ textAlign: "center", padding: 20, color: C.textMuted, fontSize: 11 }}>読み込み中...</p>;
  }

  const visibleGifts = showAllGifts ? gifts : gifts.slice(0, 5);
  const hasMore = gifts.length > 5;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, fontFamily: FONT_SERIF }}>
      {/* セクション見出し */}
      <div style={{ textAlign: "center", marginBottom: 4 }}>
        <p style={{ fontFamily: FONT_DISPLAY, fontSize: 11, letterSpacing: "0.25em", color: C.accent, marginBottom: 6, fontWeight: 500 }}>
          GIFTS
        </p>
        <p style={{ fontFamily: FONT_SERIF, fontSize: 13, letterSpacing: "0.08em", color: C.text, fontWeight: 500, marginBottom: 8 }}>
          🎁 いただいた投げ銭
        </p>
        <div style={{ width: 24, height: 1, backgroundColor: C.accent, margin: "0 auto" }} />
      </div>

      {!balance || balance.totalCount === 0 ? (
        <div style={{ padding: 24, textAlign: "center", backgroundColor: C.card, border: `1px dashed ${C.border}` }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🎁</div>
          <p style={{ fontSize: 12, color: C.textSub, marginBottom: 4 }}>まだ投げ銭はありません</p>
          <p style={{ fontSize: 10, color: C.textMuted, lineHeight: 1.6 }}>
            お客様からいただいた投げ銭ポイントが<br />こちらに表示されます
          </p>
        </div>
      ) : (
        <>
          {/* メインカード: 累計ポイント */}
          <div style={{ padding: 18, background: `linear-gradient(135deg, ${C.accentBg} 0%, #fff5e8 100%)`, border: `1px solid ${C.accent}`, textAlign: "center" }}>
            <p style={{ fontSize: 9, letterSpacing: "0.2em", color: C.accentDeep, marginBottom: 4, fontFamily: FONT_DISPLAY }}>
              CURRENT BALANCE
            </p>
            <p style={{ fontSize: 32, fontWeight: 500, color: C.accentDeep, fontVariantNumeric: "tabular-nums", lineHeight: 1.2 }}>
              {fmt(balance.currentBalance)}
              <span style={{ fontSize: 14, marginLeft: 4, fontWeight: 400 }}>pt</span>
            </p>
            <p style={{ fontSize: 10, color: C.textSub, marginTop: 4 }}>
              {balance.totalCount}回受領 · 累計 {fmt(balance.totalReceived)}pt
            </p>
          </div>

          {/* 期間別 */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div style={{ padding: 12, backgroundColor: C.card, border: `1px solid ${C.border}`, textAlign: "center" }}>
              <p style={{ fontSize: 9, color: C.textMuted, marginBottom: 4, fontFamily: FONT_DISPLAY, letterSpacing: "0.1em" }}>THIS MONTH</p>
              <p style={{ fontSize: 18, fontWeight: 500, color: C.text, fontVariantNumeric: "tabular-nums" }}>
                {fmt(balance.thisMonth)}<span style={{ fontSize: 10, color: C.textSub, marginLeft: 2 }}>pt</span>
              </p>
            </div>
            <div style={{ padding: 12, backgroundColor: C.card, border: `1px solid ${C.border}`, textAlign: "center" }}>
              <p style={{ fontSize: 9, color: C.textMuted, marginBottom: 4, fontFamily: FONT_DISPLAY, letterSpacing: "0.1em" }}>THIS YEAR</p>
              <p style={{ fontSize: 18, fontWeight: 500, color: C.text, fontVariantNumeric: "tabular-nums" }}>
                {fmt(balance.thisYear)}<span style={{ fontSize: 10, color: C.textSub, marginLeft: 2 }}>pt</span>
              </p>
            </div>
          </div>

          {/* 受領履歴 */}
          <div>
            <p style={{ fontSize: 10, color: C.textSub, marginBottom: 8, fontFamily: FONT_DISPLAY, letterSpacing: "0.1em" }}>
              📜 受領履歴 (直近{visibleGifts.length}件)
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {visibleGifts.map((g) => (
                <div
                  key={g.id}
                  style={{
                    padding: 10,
                    backgroundColor: C.card,
                    border: `1px solid ${C.border}`,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 22 }}>{g.gift.emoji}</span>
                      <div>
                        <p style={{ fontSize: 11, color: C.text, fontWeight: 500 }}>
                          {g.gift.label}
                          <span style={{ marginLeft: 8, color: C.accentDeep, fontVariantNumeric: "tabular-nums" }}>
                            +{g.gift.pointAmount}pt
                          </span>
                        </p>
                        <p style={{ fontSize: 9, color: C.textSub, marginTop: 1 }}>
                          {g.sender.displayName} · {sourceLabel(g.sourceType)}
                        </p>
                      </div>
                    </div>
                    <span style={{ fontSize: 9, color: C.textMuted, fontFamily: FONT_DISPLAY, fontVariantNumeric: "tabular-nums" }}>
                      {fmtDateTime(g.createdAt)}
                    </span>
                  </div>
                  {g.message && (
                    <p style={{ fontSize: 10, color: C.textSub, marginTop: 6, padding: "4px 8px", backgroundColor: C.cardAlt, lineHeight: 1.5, borderLeft: `2px solid ${C.accent}` }}>
                      “{g.message}”
                    </p>
                  )}
                </div>
              ))}
            </div>
            {hasMore && !showAllGifts && (
              <button
                onClick={() => setShowAllGifts(true)}
                style={{
                  width: "100%",
                  marginTop: 6,
                  padding: 8,
                  fontSize: 11,
                  cursor: "pointer",
                  backgroundColor: "transparent",
                  color: C.accent,
                  border: `1px solid ${C.border}`,
                  fontFamily: FONT_SERIF,
                }}
              >
                すべて見る ({gifts.length}件) →
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
