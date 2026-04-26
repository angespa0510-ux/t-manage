"use client";

import { useEffect, useState } from "react";

/**
 * ホーム画面追加ガイドのポップアップ
 *
 * 表示条件:
 * - Safari/Chrome ブラウザから開かれている（=スタンドアロン PWA ではない）
 * - localStorage に「今後表示しない」設定がない
 *
 * dismissKey は呼び出し側で指定可能 (例: customer / therapist / staff)
 * 非表示にすると 30 日後に再表示される
 */
type Props = {
  dismissKey: string;  // "customer" | "therapist" | "staff"
};

export default function InstallPrompt({ dismissKey }: Props) {
  const [show, setShow] = useState(false);
  const [platform, setPlatform] = useState<"ios" | "android" | "other">("other");

  useEffect(() => {
    if (typeof window === "undefined") return;

    // スタンドアロン PWA ならそもそも表示不要
    type IosWindow = Window & { navigator: Navigator & { standalone?: boolean } };
    const standalone =
      (window as IosWindow).navigator.standalone === true ||
      window.matchMedia?.("(display-mode: standalone)").matches;
    if (standalone) return;

    // プラットフォーム判定
    const ua = navigator.userAgent;
    let detectedPlatform: "ios" | "android" | "other" = "other";
    if (/iPhone|iPad|iPod/.test(ua)) detectedPlatform = "ios";
    else if (/Android/.test(ua)) detectedPlatform = "android";
    else {
      // PC は対象外（モバイルでのみ表示）
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPlatform(detectedPlatform);

    // 過去に「今後表示しない」を選んだか
    const key = `install-prompt-dismissed-${dismissKey}`;
    try {
      const dismissed = localStorage.getItem(key);
      if (dismissed) {
        const dismissedDate = new Date(dismissed);
        const daysSince = (Date.now() - dismissedDate.getTime()) / (1000 * 60 * 60 * 24);
        // 30日以内なら非表示
        if (daysSince < 30) return;
      }
    } catch {
      // localStorage アクセス失敗時は表示を試みる
    }

    // 少し遅らせて表示（画面読み込み直後だと邪魔なので）
    const timer = setTimeout(() => setShow(true), 2000);
    return () => clearTimeout(timer);
  }, [dismissKey]);

  const dismiss = (forever: boolean) => {
    if (forever) {
      try {
        localStorage.setItem(`install-prompt-dismissed-${dismissKey}`, new Date().toISOString());
      } catch {
        /* ignore */
      }
    }
    setShow(false);
  };

  if (!show) return null;

  const FONT_SERIF = "'Noto Serif JP', 'Yu Mincho', 'Hiragino Mincho ProN', serif";
  const FONT_DISPLAY = "'Cormorant Garamond', 'Noto Serif JP', 'Yu Mincho', serif";

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4"
      style={{ backgroundColor: "rgba(43,43,43,0.55)", animation: "fadeIn 0.3s", fontFamily: FONT_SERIF }}
      onClick={() => dismiss(false)}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="w-full max-w-[420px] animate-[slideUp_0.3s]"
        style={{ backgroundColor: "#ffffff", border: "1px solid #e5ded6", padding: "28px 24px", color: "#2b2b2b" }}
      >
        {/* ヘッダー */}
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div style={{ width: 1, height: 24, backgroundColor: "#e8849a", margin: "0 auto 12px" }} />
          <div style={{ fontSize: 36, marginBottom: 8 }}>📱</div>
          <p style={{ margin: 0, fontFamily: FONT_DISPLAY, fontSize: 10, letterSpacing: "0.3em", color: "#c96b83", fontWeight: 500 }}>INSTALL</p>
          <p style={{ margin: "6px 0 4px", fontSize: 15, fontWeight: 500, color: "#2b2b2b", letterSpacing: "0.1em" }}>
            Ange Spa をアプリとして使う
          </p>
          <div style={{ width: 24, height: 1, backgroundColor: "#e8849a", margin: "0 auto 8px" }} />
          <p style={{ margin: 0, fontSize: 11, color: "#8a8a8a", letterSpacing: "0.08em" }}>
            ホーム画面に追加すると便利です
          </p>
        </div>

        {/* メリット */}
        <div style={{ padding: "14px 16px", marginBottom: 14, backgroundColor: "#faf6f1", border: "1px solid #e5ded6" }}>
          <p style={{ margin: "0 0 8px", fontFamily: FONT_DISPLAY, fontSize: 10, letterSpacing: "0.2em", color: "#c96b83", fontWeight: 500 }}>BENEFITS</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {[
              { icon: "🔔", text: "プッシュ通知でお知らせを受信" },
              { icon: "⚡", text: "アプリのように素早く起動" },
              { icon: "🏠", text: "毎回ログインしなくてOK" },
            ].map((b, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 15 }}>{b.icon}</span>
                <p style={{ margin: 0, fontSize: 12, color: "#2b2b2b", letterSpacing: "0.03em" }}>{b.text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* プラットフォーム別の簡潔なガイド */}
        {platform === "ios" && (
          <div style={{ padding: "12px 14px", marginBottom: 14, backgroundColor: "transparent", border: "1px solid #e8849a" }}>
            <p style={{ margin: "0 0 8px", fontFamily: FONT_DISPLAY, fontSize: 10, letterSpacing: "0.2em", color: "#c96b83", fontWeight: 500 }}>iOS</p>
            <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 500, color: "#2b2b2b", letterSpacing: "0.03em" }}>📱 iPhone（Safari で）</p>
            <ol style={{ fontSize: 11, display: "flex", flexDirection: "column", gap: 3, paddingLeft: 18, margin: 0, color: "#555555", letterSpacing: "0.02em", lineHeight: 1.7 }}>
              <li>画面下部の共有ボタンをタップ</li>
              <li>「ホーム画面に追加」を選択</li>
              <li>「追加」をタップ</li>
              <li>ホーム画面のアイコンから開く</li>
            </ol>
          </div>
        )}

        {platform === "android" && (
          <div style={{ padding: "12px 14px", marginBottom: 14, backgroundColor: "transparent", border: "1px solid #e8849a" }}>
            <p style={{ margin: "0 0 8px", fontFamily: FONT_DISPLAY, fontSize: 10, letterSpacing: "0.2em", color: "#c96b83", fontWeight: 500 }}>ANDROID</p>
            <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 500, color: "#2b2b2b", letterSpacing: "0.03em" }}>🤖 Android（Chrome で）</p>
            <ol style={{ fontSize: 11, display: "flex", flexDirection: "column", gap: 3, paddingLeft: 18, margin: 0, color: "#555555", letterSpacing: "0.02em", lineHeight: 1.7 }}>
              <li>画面右上の「⋮」メニューをタップ</li>
              <li>「ホーム画面に追加」を選択</li>
              <li>「追加」をタップ</li>
              <li>ホーム画面のアイコンから開く</li>
            </ol>
          </div>
        )}

        {/* アクションボタン */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <a
            href="/install-guide"
            style={{ display: "block", width: "100%", padding: "12px 0", fontSize: 12, fontWeight: 500, letterSpacing: "0.2em", textAlign: "center", color: "#ffffff", cursor: "pointer", backgroundColor: "#c96b83", textDecoration: "none", fontFamily: FONT_SERIF }}
          >
            📖 詳しい手順を見る
          </a>
          <button
            onClick={() => dismiss(false)}
            style={{ width: "100%", padding: "10px 0", fontSize: 11, cursor: "pointer", color: "#8a8a8a", backgroundColor: "transparent", border: "1px solid #e5ded6", fontFamily: FONT_SERIF, letterSpacing: "0.1em" }}
          >
            あとで
          </button>
          <button
            onClick={() => dismiss(true)}
            style={{ width: "100%", padding: "6px 0", fontSize: 10, cursor: "pointer", color: "#b5b5b5", backgroundColor: "transparent", border: "none", fontFamily: FONT_SERIF, letterSpacing: "0.08em" }}
          >
            今後表示しない
          </button>
        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(40px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
