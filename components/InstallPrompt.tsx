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

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.5)", animation: "fadeIn 0.3s" }}
      onClick={() => dismiss(false)}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="w-full max-w-[440px] rounded-3xl p-6 animate-[slideUp_0.3s]"
        style={{ backgroundColor: "#ffffff", boxShadow: "0 -8px 32px rgba(0,0,0,0.2)" }}
      >
        {/* ヘッダー */}
        <div className="text-center mb-5">
          <div className="text-[40px] mb-2">📱</div>
          <p className="text-[16px] font-medium" style={{ color: "#2c2c2a" }}>
            T-MANAGE をアプリとして使う
          </p>
          <p className="text-[11px] mt-1" style={{ color: "#888780" }}>
            ホーム画面に追加すると便利です
          </p>
        </div>

        {/* メリット */}
        <div className="rounded-2xl p-4 mb-4" style={{ backgroundColor: "#f8f6f3" }}>
          <div className="space-y-2">
            {[
              { icon: "🔔", text: "プッシュ通知でお知らせを受信" },
              { icon: "⚡", text: "アプリのように素早く起動" },
              { icon: "🏠", text: "毎回ログインしなくてOK" },
            ].map((b, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-[16px]">{b.icon}</span>
                <p className="text-[12px]" style={{ color: "#2c2c2a" }}>{b.text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* プラットフォーム別の簡潔なガイド */}
        {platform === "ios" && (
          <div className="rounded-xl p-3 mb-4" style={{ backgroundColor: "#c3a78210", border: "1px solid #c3a78244" }}>
            <p className="text-[11px] mb-2 font-medium" style={{ color: "#c3a782" }}>
              📱 iPhone での手順（Safari で）
            </p>
            <ol className="text-[11px] space-y-1 pl-4 list-decimal" style={{ color: "#555" }}>
              <li>画面下部の共有ボタンをタップ</li>
              <li>「ホーム画面に追加」を選択</li>
              <li>「追加」をタップ</li>
              <li>ホーム画面のアイコンから開く</li>
            </ol>
          </div>
        )}

        {platform === "android" && (
          <div className="rounded-xl p-3 mb-4" style={{ backgroundColor: "#c3a78210", border: "1px solid #c3a78244" }}>
            <p className="text-[11px] mb-2 font-medium" style={{ color: "#c3a782" }}>
              🤖 Android での手順（Chrome で）
            </p>
            <ol className="text-[11px] space-y-1 pl-4 list-decimal" style={{ color: "#555" }}>
              <li>画面右上の「⋮」メニューをタップ</li>
              <li>「ホーム画面に追加」を選択</li>
              <li>「追加」をタップ</li>
              <li>ホーム画面のアイコンから開く</li>
            </ol>
          </div>
        )}

        {/* アクションボタン */}
        <div className="space-y-2">
          <a
            href="/install-guide"
            className="block w-full py-3 rounded-xl text-[12px] font-medium text-center text-white cursor-pointer"
            style={{ background: "linear-gradient(135deg, #c3a782, #b09672)" }}
          >
            📖 詳しい手順を見る
          </a>
          <button
            onClick={() => dismiss(false)}
            className="w-full py-2.5 rounded-xl text-[11px] cursor-pointer"
            style={{ color: "#888780", backgroundColor: "transparent", border: "1px solid #e8e4df" }}
          >
            あとで
          </button>
          <button
            onClick={() => dismiss(true)}
            className="w-full py-1 text-[10px] cursor-pointer"
            style={{ color: "#b4b2a9", background: "transparent", border: "none" }}
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
      `}</style>
    </div>
  );
}
