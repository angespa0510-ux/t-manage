"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPlatform(p);
    setIsStandalone(standalone);
  }, []);

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#f8f6f3" }}>
      {/* ヘッダー */}
      <div className="sticky top-0 z-10 border-b backdrop-blur-xl" style={{ backgroundColor: "#ffffffee", borderColor: "#e8e4df" }}>
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link href="/" className="text-[20px] leading-none cursor-pointer p-1">←</Link>
          <h1 className="text-[16px] font-medium" style={{ color: "#2c2c2a" }}>
            📱 ホーム画面に追加する
          </h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-5 space-y-6">
        {/* 既にインストール済み */}
        {isStandalone && (
          <div className="rounded-2xl p-5" style={{ backgroundColor: "#4a7c5918", border: "1px solid #4a7c5944" }}>
            <p className="text-[14px] font-medium mb-1" style={{ color: "#4a7c59" }}>
              ✅ アプリとして起動中です！
            </p>
            <p className="text-[12px]" style={{ color: "#4a7c59" }}>
              ホーム画面から開いているので、プッシュ通知などすべての機能が使えます。
            </p>
          </div>
        )}

        {/* メリット紹介 */}
        <div className="rounded-2xl p-5" style={{ backgroundColor: "#ffffff", border: "1px solid #e8e4df" }}>
          <p className="text-[14px] font-medium mb-3" style={{ color: "#2c2c2a" }}>
            ホーム画面に追加すると
          </p>
          <div className="space-y-2">
            {[
              { icon: "⚡", text: "アプリのように素早く起動できる" },
              { icon: "🔔", text: "プッシュ通知でお知らせを受信" },
              { icon: "📅", text: "予約リマインダーが届く（今後対応）" },
              { icon: "🏠", text: "毎回ログインしなくてOK" },
            ].map((b, i) => (
              <div key={i} className="flex items-center gap-3 py-1.5">
                <span className="text-[20px]">{b.icon}</span>
                <p className="text-[13px]" style={{ color: "#2c2c2a" }}>{b.text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* iPhone 手順 */}
        <div className="rounded-2xl p-5" style={{ backgroundColor: "#ffffff", border: platform === "ios" ? "2px solid #c3a782" : "1px solid #e8e4df" }}>
          <div className="flex items-center justify-between mb-4">
            <p className="text-[14px] font-medium" style={{ color: "#2c2c2a" }}>
              📱 iPhone の場合
            </p>
            {platform === "ios" && (
              <span className="text-[10px] px-2 py-1 rounded-full" style={{ backgroundColor: "#c3a78218", color: "#c3a782" }}>
                あなたの端末
              </span>
            )}
          </div>

          <p className="text-[11px] mb-4 px-3 py-2 rounded-lg" style={{ backgroundColor: "#f8f6f3", color: "#888780" }}>
            💡 <strong style={{ color: "#c45555" }}>必ず Safari</strong> で開いてください。Chrome ではホーム画面に追加できません。
          </p>

          <div className="space-y-4">
            <Step num={1} title="画面下部の共有ボタンをタップ">
              <p>Safari の下のバーの中央にある、四角から上向きの矢印が出ているアイコンです。</p>
              <div className="mt-2 flex items-center justify-center gap-4 py-3 rounded-lg" style={{ backgroundColor: "#f8f6f3" }}>
                <span className="text-[24px]">⬜️</span>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#c3a782" strokeWidth="2">
                  <path d="M12 16V4M8 8l4-4 4 4M4 12v8h16v-8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="text-[10px]" style={{ color: "#888780" }}>共有ボタン</span>
              </div>
            </Step>

            <Step num={2} title="「ホーム画面に追加」を選ぶ">
              <p>共有メニューが開いたら、<strong>下にスクロール</strong>して「➕ ホーム画面に追加」を見つけてタップします。</p>
              <div className="mt-2 py-2 px-3 rounded-lg flex items-center gap-2" style={{ backgroundColor: "#f8f6f3" }}>
                <span className="text-[18px]">➕</span>
                <span className="text-[12px]" style={{ color: "#2c2c2a" }}>ホーム画面に追加</span>
              </div>
            </Step>

            <Step num={3} title="右上の「追加」をタップ">
              <p>名前の確認画面が出るので、右上の<strong style={{ color: "#c3a782" }}>「追加」</strong>ボタンをタップ。</p>
            </Step>

            <Step num={4} title="ホーム画面のアイコンから開く" highlight>
              <p><strong style={{ color: "#c45555" }}>ここが大切！</strong> Safari を閉じて、ホーム画面に現れた「T-MANAGE」のアイコンから開き直してください。</p>
              <p className="mt-2 text-[11px]" style={{ color: "#888780" }}>
                ※ Safari から直接開くと通知などの機能が使えません
              </p>
            </Step>
          </div>
        </div>

        {/* Android 手順 */}
        <div className="rounded-2xl p-5" style={{ backgroundColor: "#ffffff", border: platform === "android" ? "2px solid #c3a782" : "1px solid #e8e4df" }}>
          <div className="flex items-center justify-between mb-4">
            <p className="text-[14px] font-medium" style={{ color: "#2c2c2a" }}>
              🤖 Android の場合
            </p>
            {platform === "android" && (
              <span className="text-[10px] px-2 py-1 rounded-full" style={{ backgroundColor: "#c3a78218", color: "#c3a782" }}>
                あなたの端末
              </span>
            )}
          </div>

          <p className="text-[11px] mb-4 px-3 py-2 rounded-lg" style={{ backgroundColor: "#f8f6f3", color: "#888780" }}>
            💡 <strong style={{ color: "#c45555" }}>Google Chrome</strong> で開いてください。
          </p>

          <div className="space-y-4">
            <Step num={1} title="画面右上の「⋮」メニューをタップ">
              <p>Chrome のアドレスバー右にある、縦に点が3つ並んだアイコンです。</p>
              <div className="mt-2 flex items-center justify-center py-3 rounded-lg" style={{ backgroundColor: "#f8f6f3" }}>
                <span className="text-[24px]" style={{ color: "#c3a782" }}>⋮</span>
              </div>
            </Step>

            <Step num={2} title="「ホーム画面に追加」を選択">
              <p>メニューの中から「ホーム画面に追加」または「アプリをインストール」をタップ。</p>
            </Step>

            <Step num={3} title="「追加」または「インストール」を確認">
              <p>確認ダイアログが出るので、「追加」をタップ。</p>
            </Step>

            <Step num={4} title="ホーム画面から開く" highlight>
              <p>ホーム画面に追加された T-MANAGE のアイコンから開いてください。</p>
            </Step>
          </div>
        </div>

        {/* FAQ */}
        <div className="rounded-2xl p-5" style={{ backgroundColor: "#ffffff", border: "1px solid #e8e4df" }}>
          <p className="text-[14px] font-medium mb-4" style={{ color: "#2c2c2a" }}>
            よくある質問
          </p>
          <div className="space-y-4">
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
        <div className="text-center py-4">
          <Link href="/" className="text-[12px] cursor-pointer" style={{ color: "#888780" }}>
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
    <div className="flex gap-3">
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-medium flex-shrink-0"
        style={{
          backgroundColor: highlight ? "#c3a782" : "#c3a78218",
          color: highlight ? "#ffffff" : "#c3a782",
        }}
      >
        {num}
      </div>
      <div className="flex-1 pt-1">
        <p className="text-[13px] font-medium mb-1.5" style={{ color: "#2c2c2a" }}>
          {title}
        </p>
        <div className="text-[12px] leading-relaxed" style={{ color: "#555" }}>
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
    <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "#f8f6f3" }}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-4 py-3 flex items-center justify-between cursor-pointer"
      >
        <span className="text-[12px] font-medium text-left" style={{ color: "#2c2c2a" }}>
          Q. {q}
        </span>
        <span className="text-[12px]" style={{ color: "#c3a782" }}>
          {open ? "−" : "+"}
        </span>
      </button>
      {open && (
        <div className="px-4 pb-3 text-[11px] leading-relaxed" style={{ color: "#555" }}>
          A. {children}
        </div>
      )}
    </div>
  );
}
