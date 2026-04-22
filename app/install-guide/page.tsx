"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

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

const COLOR = {
  text: "#2b2b2b",
  textSub: "#555555",
  textMuted: "#8a8a8a",
  textFaint: "#b5b5b5",
  border: "#e5ded6",
  accent: "#c96b83",
  accentSoft: "#f7e3e7",
  accentLight: "#e8849a",
  success: "#6b9b7e",
  warn: "#c96b83",
  cardAlt: "#faf6f1",
};

// ホーム画面追加ガイドページ
// iPhone/Android 自動判定して該当する手順を強調表示
export default function InstallGuidePage() {
  const [platform, setPlatform] = useState<"ios" | "android" | "other">("other");
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const ua = navigator.userAgent;
    type IosWindow = Window & { navigator: Navigator & { standalone?: boolean } };
    const standalone =
      (window as IosWindow).navigator.standalone === true ||
      window.matchMedia?.("(display-mode: standalone)").matches;
    const p: "ios" | "android" | "other" = /iPhone|iPad|iPod/.test(ua) ? "ios" : /Android/.test(ua) ? "android" : "other";
    setPlatform(p);
    setIsStandalone(standalone);
  }, []);

  return (
    <div style={{ minHeight: "100vh", ...MARBLE_BG, fontFamily: FONT_SERIF, color: COLOR.text }}>
      {/* ヘッダー */}
      <div style={{ position: "sticky", top: 0, zIndex: 10, borderBottom: `1px solid ${COLOR.border}`, backgroundColor: "rgba(255,255,255,0.85)", backdropFilter: "blur(8px)" }}>
        <div style={{ maxWidth: 640, margin: "0 auto", padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/" style={{ fontSize: 18, lineHeight: 1, cursor: "pointer", padding: 4, color: COLOR.textSub, textDecoration: "none" }}>←</Link>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontFamily: FONT_DISPLAY, fontSize: 10, letterSpacing: "0.25em", color: COLOR.accent, fontWeight: 500 }}>INSTALL GUIDE</p>
            <h1 style={{ margin: "2px 0 0", fontSize: 14, fontWeight: 500, color: COLOR.text, letterSpacing: "0.08em" }}>📱 ホーム画面に追加する</h1>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "24px 16px 40px", display: "flex", flexDirection: "column", gap: 18 }}>
        {/* 既にインストール済み */}
        {isStandalone && (
          <div style={{ padding: "16px 18px", backgroundColor: "rgba(107,155,126,0.08)", border: `1px solid ${COLOR.success}44` }}>
            <p style={{ margin: 0, fontFamily: FONT_DISPLAY, fontSize: 10, letterSpacing: "0.2em", color: COLOR.success, fontWeight: 500 }}>✅ INSTALLED</p>
            <p style={{ margin: "4px 0 4px", fontSize: 14, fontWeight: 500, color: COLOR.success, letterSpacing: "0.05em" }}>アプリとして起動中です！</p>
            <p style={{ margin: 0, fontSize: 11, color: COLOR.success, letterSpacing: "0.02em", lineHeight: 1.8 }}>
              ホーム画面から開いているので、プッシュ通知などすべての機能が使えます。
            </p>
          </div>
        )}

        {/* メリット紹介 */}
        <div style={{ padding: "20px 20px", backgroundColor: "#ffffff", border: `1px solid ${COLOR.border}` }}>
          <p style={{ margin: "0 0 4px", fontFamily: FONT_DISPLAY, fontSize: 10, letterSpacing: "0.2em", color: COLOR.accent, fontWeight: 500 }}>BENEFITS</p>
          <p style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 500, color: COLOR.text, letterSpacing: "0.05em" }}>ホーム画面に追加すると</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {[
              { icon: "⚡", text: "アプリのように素早く起動できる" },
              { icon: "🔔", text: "プッシュ通知でお知らせを受信" },
              { icon: "📅", text: "予約リマインダーが届く（今後対応）" },
              { icon: "🏠", text: "毎回ログインしなくてOK" },
            ].map((b, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "6px 0" }}>
                <span style={{ fontSize: 18 }}>{b.icon}</span>
                <p style={{ margin: 0, fontSize: 13, color: COLOR.text, letterSpacing: "0.03em" }}>{b.text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* iPhone 手順 */}
        <div style={{ padding: "20px 20px", backgroundColor: "#ffffff", border: platform === "ios" ? `1px solid ${COLOR.accent}` : `1px solid ${COLOR.border}`, position: "relative" }}>
          {platform === "ios" && <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, backgroundColor: COLOR.accent }} />}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div>
              <p style={{ margin: 0, fontFamily: FONT_DISPLAY, fontSize: 10, letterSpacing: "0.2em", color: COLOR.accent, fontWeight: 500 }}>iOS</p>
              <p style={{ margin: "2px 0 0", fontSize: 14, fontWeight: 500, color: COLOR.text, letterSpacing: "0.05em" }}>📱 iPhone の場合</p>
            </div>
            {platform === "ios" && (
              <span style={{ fontSize: 10, padding: "3px 10px", backgroundColor: "transparent", color: COLOR.accent, border: `1px solid ${COLOR.accent}`, letterSpacing: "0.05em", fontFamily: FONT_SERIF }}>
                あなたの端末
              </span>
            )}
          </div>

          <p style={{ margin: "0 0 18px", fontSize: 11, padding: "10px 14px", backgroundColor: COLOR.cardAlt, color: COLOR.textSub, border: `1px solid ${COLOR.border}`, letterSpacing: "0.02em", lineHeight: 1.8 }}>
            💡 <strong style={{ color: COLOR.warn }}>必ず Safari</strong> で開いてください。Chrome ではホーム画面に追加できません。
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <Step num={1} title="画面下部の共有ボタンをタップ">
              <p style={{ margin: 0 }}>Safari の下のバーの中央にある、四角から上向きの矢印が出ているアイコンです。</p>
              <div style={{ marginTop: 10, display: "flex", alignItems: "center", justifyContent: "center", gap: 16, padding: "14px 10px", backgroundColor: COLOR.cardAlt, border: `1px solid ${COLOR.border}` }}>
                <span style={{ fontSize: 22 }}>⬜️</span>
                <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke={COLOR.accent} strokeWidth={1.7}>
                  <path d="M12 16V4M8 8l4-4 4 4M4 12v8h16v-8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span style={{ fontSize: 10, color: COLOR.textMuted, letterSpacing: "0.05em" }}>共有ボタン</span>
              </div>
            </Step>

            <Step num={2} title="「ホーム画面に追加」を選ぶ">
              <p style={{ margin: 0 }}>共有メニューが開いたら、<strong>下にスクロール</strong>して「➕ ホーム画面に追加」を見つけてタップします。</p>
              <div style={{ marginTop: 10, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10, backgroundColor: COLOR.cardAlt, border: `1px solid ${COLOR.border}` }}>
                <span style={{ fontSize: 16 }}>➕</span>
                <span style={{ fontSize: 12, color: COLOR.text, letterSpacing: "0.03em" }}>ホーム画面に追加</span>
              </div>
            </Step>

            <Step num={3} title="右上の「追加」をタップ">
              <p style={{ margin: 0 }}>名前の確認画面が出るので、右上の<strong style={{ color: COLOR.accent }}>「追加」</strong>ボタンをタップ。</p>
            </Step>

            <Step num={4} title="ホーム画面のアイコンから開く" highlight>
              <p style={{ margin: 0 }}><strong style={{ color: COLOR.warn }}>ここが大切！</strong> Safari を閉じて、ホーム画面に現れた「T-MANAGE」のアイコンから開き直してください。</p>
              <p style={{ margin: "8px 0 0", fontSize: 11, color: COLOR.textMuted, letterSpacing: "0.02em" }}>
                ※ Safari から直接開くと通知などの機能が使えません
              </p>
            </Step>
          </div>
        </div>

        {/* Android 手順 */}
        <div style={{ padding: "20px 20px", backgroundColor: "#ffffff", border: platform === "android" ? `1px solid ${COLOR.accent}` : `1px solid ${COLOR.border}`, position: "relative" }}>
          {platform === "android" && <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, backgroundColor: COLOR.accent }} />}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div>
              <p style={{ margin: 0, fontFamily: FONT_DISPLAY, fontSize: 10, letterSpacing: "0.2em", color: COLOR.accent, fontWeight: 500 }}>ANDROID</p>
              <p style={{ margin: "2px 0 0", fontSize: 14, fontWeight: 500, color: COLOR.text, letterSpacing: "0.05em" }}>🤖 Android の場合</p>
            </div>
            {platform === "android" && (
              <span style={{ fontSize: 10, padding: "3px 10px", backgroundColor: "transparent", color: COLOR.accent, border: `1px solid ${COLOR.accent}`, letterSpacing: "0.05em", fontFamily: FONT_SERIF }}>
                あなたの端末
              </span>
            )}
          </div>

          <p style={{ margin: "0 0 18px", fontSize: 11, padding: "10px 14px", backgroundColor: COLOR.cardAlt, color: COLOR.textSub, border: `1px solid ${COLOR.border}`, letterSpacing: "0.02em", lineHeight: 1.8 }}>
            💡 <strong style={{ color: COLOR.warn }}>Google Chrome</strong> で開いてください。
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <Step num={1} title="画面右上の「⋮」メニューをタップ">
              <p style={{ margin: 0 }}>Chrome のアドレスバー右にある、縦に点が3つ並んだアイコンです。</p>
              <div style={{ marginTop: 10, display: "flex", alignItems: "center", justifyContent: "center", padding: "14px 0", backgroundColor: COLOR.cardAlt, border: `1px solid ${COLOR.border}` }}>
                <span style={{ fontSize: 22, color: COLOR.accent }}>⋮</span>
              </div>
            </Step>

            <Step num={2} title="「ホーム画面に追加」を選択">
              <p style={{ margin: 0 }}>メニューの中から「ホーム画面に追加」または「アプリをインストール」をタップ。</p>
            </Step>

            <Step num={3} title="「追加」または「インストール」を確認">
              <p style={{ margin: 0 }}>確認ダイアログが出るので、「追加」をタップ。</p>
            </Step>

            <Step num={4} title="ホーム画面のアイコンから開く" highlight>
              <p style={{ margin: 0 }}>ホーム画面に現れた「T-MANAGE」のアイコンから開き直してください。</p>
            </Step>
          </div>
        </div>

        {/* よくある質問 */}
        <div style={{ padding: "20px 20px", backgroundColor: "#ffffff", border: `1px solid ${COLOR.border}` }}>
          <p style={{ margin: "0 0 4px", fontFamily: FONT_DISPLAY, fontSize: 10, letterSpacing: "0.2em", color: COLOR.accent, fontWeight: 500 }}>FAQ</p>
          <p style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 500, color: COLOR.text, letterSpacing: "0.05em" }}>よくある質問</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <Faq q="ログイン情報は引き継がれますか？">
              はい、Safari / Chrome でログインした情報は、ホーム画面のアイコンからも引き継がれます。改めてログインする必要はありません。
            </Faq>
            <Faq q="本物のアプリと違うの？">
              技術的には「PWA（Progressive Web App）」という仕組みで、見た目と使い勝手は本物のアプリとほぼ同じです。容量は本物のアプリより軽量です。
            </Faq>
            <Faq q="削除したい時は？">
              ホーム画面のアイコンを長押しして「アプリを削除」を選ぶだけです。
            </Faq>
            <Faq q="プッシュ通知を止めたい時は？">
              マイページの「🔔 プッシュ通知」カードから「タップで無効化」を押せばいつでも止められます。
            </Faq>
            <Faq q="通知が来ません">
              iPhone の場合、「設定」→「通知」→「T-MANAGE」で通知が許可されているか確認してください。iOS は必ず 16.4 以上が必要です。
            </Faq>
          </div>
        </div>

        {/* フッター */}
        <div style={{ textAlign: "center", padding: "14px 0" }}>
          <div style={{ width: 20, height: 1, backgroundColor: COLOR.accentLight, margin: "0 auto 12px" }} />
          <Link href="/" style={{ fontSize: 12, cursor: "pointer", color: COLOR.textMuted, textDecoration: "none", letterSpacing: "0.1em" }}>
            ← トップに戻る
          </Link>
        </div>
      </div>
    </div>
  );
}

// ステップ表示コンポーネント
function Step({ num, title, children, highlight = false }: { num: number; title: string; children: React.ReactNode; highlight?: boolean }) {
  return (
    <div style={{ display: "flex", gap: 12 }}>
      <div
        style={{
          width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: FONT_DISPLAY, fontSize: 13, fontWeight: 500, flexShrink: 0,
          backgroundColor: highlight ? COLOR.accent : "transparent",
          color: highlight ? "#ffffff" : COLOR.accent,
          border: `1px solid ${COLOR.accent}`,
          letterSpacing: "0.05em",
        }}
      >
        {num}
      </div>
      <div style={{ flex: 1, paddingTop: 3 }}>
        <p style={{ margin: "0 0 6px", fontSize: 13, fontWeight: 500, color: COLOR.text, letterSpacing: "0.05em" }}>
          {title}
        </p>
        <div style={{ fontSize: 12, lineHeight: 1.9, color: COLOR.textSub, letterSpacing: "0.02em" }}>
          {children}
        </div>
      </div>
    </div>
  );
}

// FAQ アコーディオン
function Faq({ q, children }: { q: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ overflow: "hidden", backgroundColor: COLOR.cardAlt, border: `1px solid ${COLOR.border}` }}>
      <button
        onClick={() => setOpen(!open)}
        style={{ width: "100%", padding: "12px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", border: "none", backgroundColor: "transparent", fontFamily: FONT_SERIF, textAlign: "left" }}
      >
        <span style={{ fontSize: 12, fontWeight: 500, color: COLOR.text, letterSpacing: "0.03em" }}>
          <span style={{ fontFamily: FONT_DISPLAY, color: COLOR.accent, marginRight: 6, letterSpacing: "0.1em" }}>Q.</span> {q}
        </span>
        <span style={{ fontSize: 14, color: COLOR.accent, fontFamily: FONT_DISPLAY, transition: "transform 0.2s", transform: open ? "rotate(45deg)" : "none" }}>
          +
        </span>
      </button>
      {open && (
        <div style={{ padding: "4px 14px 14px", fontSize: 11, lineHeight: 1.9, color: COLOR.textSub, borderTop: `1px solid ${COLOR.border}`, letterSpacing: "0.02em" }}>
          <span style={{ fontFamily: FONT_DISPLAY, color: "#6b9b7e", marginRight: 6, letterSpacing: "0.1em" }}>A.</span>{children}
        </div>
      )}
    </div>
  );
}
