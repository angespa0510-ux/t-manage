"use client";

import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";
import { useTheme } from "../../lib/theme";
import { NavMenu } from "../../lib/nav-menu";

type Tab = "cti" | "chrome";

export default function SystemSetup() {
  const router = useRouter();
  const { dark, toggle, T } = useTheme();
  const [tab, setTab] = useState<Tab>("cti");

  useEffect(() => { const check = async () => { const { data: { user } } = await supabase.auth.getUser(); if (!user) router.push("/"); }; check(); }, [router]);

  const cardStyle = { background: T.card, border: `1px solid ${T.border}`, borderRadius: 16 };
  const stepNumStyle = (color: string) => ({
    width: 32, height: 32, borderRadius: "50%", backgroundColor: color + "18",
    color, display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 14, fontWeight: 700, flexShrink: 0,
  } as const);

  return (
    <div style={{ backgroundColor: T.bg, minHeight: "100vh" }}>
      {/* Header */}
      <div className="h-[64px] backdrop-blur-xl border-b flex items-center justify-between px-6" style={{ backgroundColor: dark ? T.card + "cc" : "rgba(255,255,255,0.8)", borderColor: T.border }}>
        <div className="flex items-center gap-4">
          <NavMenu T={T} dark={dark} />
          <h1 className="text-[15px] font-medium">🛠️ システム設定</h1>
        </div>
        <button onClick={toggle} className="px-3 py-1.5 text-[10px] rounded-lg cursor-pointer border" style={{ borderColor: T.border, color: T.textSub }}>{dark ? "☀️ ライト" : "🌙 ダーク"}</button>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8">
        {/* タブ */}
        <div className="flex gap-3 mb-8">
          {([
            { key: "cti" as Tab, label: "📞 CTI 着信表示", desc: "スマホ着信→PC表示" },
            { key: "chrome" as Tab, label: "🚀 Chrome拡張", desc: "通知の自動入力" },
          ]).map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className="flex-1 py-4 rounded-2xl cursor-pointer text-center"
              style={{
                ...cardStyle,
                borderColor: tab === t.key ? "#c3a782" : T.border,
                backgroundColor: tab === t.key ? "#c3a78210" : T.card,
              }}>
              <div className="text-[14px] font-medium" style={{ color: tab === t.key ? "#c3a782" : T.text }}>{t.label}</div>
              <div className="text-[11px] mt-1" style={{ color: T.textMuted }}>{t.desc}</div>
            </button>
          ))}
        </div>

        {/* ===== CTI タブ ===== */}
        {tab === "cti" && (
          <div className="space-y-6">
            {/* 概要 */}
            <div className="rounded-2xl p-6" style={cardStyle}>
              <h2 className="text-[16px] font-medium mb-3" style={{ color: T.text }}>📞 CTI（着信表示）とは？</h2>
              <p className="text-[13px] leading-relaxed" style={{ color: T.textSub }}>
                お店のスマホに電話がかかってきた時に、<span style={{ color: "#c3a782", fontWeight: 600 }}>PCのT-MANAGEに自動でお客様情報がポップアップ</span>する仕組みです。
                お客様の名前・ランク・来店回数・メモなどが瞬時に確認でき、スムーズな電話対応が可能になります。
              </p>
              <div className="mt-4 p-4 rounded-xl" style={{ backgroundColor: T.cardAlt }}>
                <div className="flex items-center gap-4 text-[12px]" style={{ color: T.textSub }}>
                  <span className="px-3 py-1.5 rounded-lg" style={{ backgroundColor: "#f59e0b18", color: "#f59e0b" }}>📱 スマホに着信</span>
                  <span style={{ color: T.textMuted }}>→</span>
                  <span className="px-3 py-1.5 rounded-lg" style={{ backgroundColor: "#3d6b9f18", color: "#3d6b9f" }}>📡 自動送信</span>
                  <span style={{ color: T.textMuted }}>→</span>
                  <span className="px-3 py-1.5 rounded-lg" style={{ backgroundColor: "#4a7c5918", color: "#4a7c59" }}>💻 PCにポップアップ！</span>
                </div>
              </div>
            </div>

            {/* 必要なもの */}
            <div className="rounded-2xl p-6" style={cardStyle}>
              <h3 className="text-[14px] font-medium mb-4" style={{ color: T.text }}>🧰 必要なもの</h3>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { icon: "💻", name: "PC（Windows）", desc: "Android Studioをインストール（管理者のみ）", required: true },
                  { icon: "📱", name: "Androidスマホ", desc: "お店で着信を受けるスマホ", required: true },
                  { icon: "🌐", name: "スマホのブラウザ", desc: "このページからアプリをダウンロード", required: true },
                  { icon: "🖥️", name: "PCのブラウザ", desc: "T-MANAGEを開いた状態で着信待ち", required: true },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-xl" style={{ backgroundColor: T.cardAlt }}>
                    <span className="text-[20px]">{item.icon}</span>
                    <div>
                      <div className="text-[12px] font-medium" style={{ color: T.text }}>{item.name}</div>
                      <div className="text-[10px] mt-0.5" style={{ color: T.textMuted }}>{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* STEP 1: Android Studio */}
            <div className="rounded-2xl p-6" style={cardStyle}>
              <div className="flex items-center gap-3 mb-5">
                <div style={stepNumStyle("#3d6b9f")}>1</div>
                <div>
                  <h3 className="text-[14px] font-medium" style={{ color: T.text }}>Android Studio をインストール</h3>
                  <p className="text-[11px]" style={{ color: T.textMuted }}>PC上でアプリをビルドするためのツール（無料）</p>
                </div>
              </div>
              <div className="space-y-3 pl-11">
                <div className="p-3 rounded-xl" style={{ backgroundColor: T.cardAlt }}>
                  <p className="text-[12px]" style={{ color: T.textSub }}>
                    <span style={{ color: "#c3a782", fontWeight: 600 }}>①</span> 以下のURLにアクセス
                  </p>
                  <a href="https://developer.android.com/studio" target="_blank" rel="noopener noreferrer"
                    className="text-[12px] mt-1 inline-block px-3 py-1.5 rounded-lg" style={{ backgroundColor: "#3d6b9f18", color: "#3d6b9f" }}>
                    https://developer.android.com/studio ↗
                  </a>
                </div>
                <div className="p-3 rounded-xl" style={{ backgroundColor: T.cardAlt }}>
                  <p className="text-[12px]" style={{ color: T.textSub }}>
                    <span style={{ color: "#c3a782", fontWeight: 600 }}>②</span> 「Download Android Studio」をクリックしてダウンロード（約1.2GB）
                  </p>
                </div>
                <div className="p-3 rounded-xl" style={{ backgroundColor: T.cardAlt }}>
                  <p className="text-[12px]" style={{ color: T.textSub }}>
                    <span style={{ color: "#c3a782", fontWeight: 600 }}>③</span> ダウンロードした <code style={{ backgroundColor: T.bg, padding: "1px 6px", borderRadius: 4, fontSize: 11 }}>.exe</code> をダブルクリック → 全て「Next」でインストール
                  </p>
                </div>
                <div className="p-3 rounded-xl" style={{ backgroundColor: T.cardAlt }}>
                  <p className="text-[12px]" style={{ color: T.textSub }}>
                    <span style={{ color: "#c3a782", fontWeight: 600 }}>④</span> 初回起動 → Setup Wizardで「Standard」を選択 → SDKが自動ダウンロード（5〜10分）
                  </p>
                </div>
              </div>
            </div>

            {/* STEP 2: プロジェクトを開く */}
            <div className="rounded-2xl p-6" style={cardStyle}>
              <div className="flex items-center gap-3 mb-5">
                <div style={stepNumStyle("#a855f7")}>2</div>
                <div>
                  <h3 className="text-[14px] font-medium" style={{ color: T.text }}>CTIアプリのプロジェクトを開く</h3>
                  <p className="text-[11px]" style={{ color: T.textMuted }}>GitHubから取得したコードを読み込む</p>
                </div>
              </div>
              <div className="space-y-3 pl-11">
                <div className="p-3 rounded-xl" style={{ backgroundColor: T.cardAlt }}>
                  <p className="text-[12px]" style={{ color: T.textSub }}>
                    <span style={{ color: "#c3a782", fontWeight: 600 }}>①</span> Android Studio のトップ画面で「<span style={{ fontWeight: 600 }}>Open</span>」をクリック
                  </p>
                </div>
                <div className="p-3 rounded-xl" style={{ backgroundColor: T.cardAlt }}>
                  <p className="text-[12px]" style={{ color: T.textSub }}>
                    <span style={{ color: "#c3a782", fontWeight: 600 }}>②</span> フォルダを選択：
                  </p>
                  <code className="text-[11px] mt-1 block px-3 py-2 rounded-lg" style={{ backgroundColor: T.bg, color: "#c3a782" }}>
                    C:\Users\user\Desktop\t-manage\android-cti
                  </code>
                </div>
                <div className="p-3 rounded-xl" style={{ backgroundColor: T.cardAlt }}>
                  <p className="text-[12px]" style={{ color: T.textSub }}>
                    <span style={{ color: "#c3a782", fontWeight: 600 }}>③</span> 「Trust Project」→ Gradle Syncが自動で始まる（初回3〜5分待つ）
                  </p>
                </div>
              </div>
            </div>

            {/* STEP 3: APKビルド＆配置（管理者のみ） */}
            <div className="rounded-2xl p-6" style={cardStyle}>
              <div className="flex items-center gap-3 mb-5">
                <div style={stepNumStyle("#f59e0b")}>3</div>
                <div>
                  <h3 className="text-[14px] font-medium" style={{ color: T.text }}>APKファイルを作成＆配置（管理者が1回だけ）</h3>
                  <p className="text-[11px]" style={{ color: T.textMuted }}>ビルドしたアプリをT-MANAGEに配置する</p>
                </div>
              </div>
              <div className="space-y-3 pl-11">
                <div className="p-3 rounded-xl" style={{ backgroundColor: T.cardAlt }}>
                  <p className="text-[12px]" style={{ color: T.textSub }}>
                    <span style={{ color: "#c3a782", fontWeight: 600 }}>①</span> Android Studio の上部メニューから <span style={{ fontWeight: 600 }}>Build</span> → <span style={{ fontWeight: 600 }}>Build Bundle(s) / APK(s)</span> → <span style={{ fontWeight: 600 }}>Build APK(s)</span>
                  </p>
                </div>
                <div className="p-3 rounded-xl" style={{ backgroundColor: T.cardAlt }}>
                  <p className="text-[12px]" style={{ color: T.textSub }}>
                    <span style={{ color: "#c3a782", fontWeight: 600 }}>②</span> ビルドが完了したら「locate」をクリックしてAPKファイルを開く
                  </p>
                  <code className="text-[11px] mt-1 block px-3 py-2 rounded-lg" style={{ backgroundColor: T.bg, color: "#c3a782" }}>
                    android-cti\app\build\outputs\apk\debug\app-debug.apk
                  </code>
                </div>
                <div className="p-3 rounded-xl" style={{ backgroundColor: T.cardAlt }}>
                  <p className="text-[12px]" style={{ color: T.textSub }}>
                    <span style={{ color: "#c3a782", fontWeight: 600 }}>③</span> このファイルを以下の場所にコピー（ファイル名を変更）：
                  </p>
                  <code className="text-[11px] mt-1 block px-3 py-2 rounded-lg" style={{ backgroundColor: T.bg, color: "#c3a782" }}>
                    t-manage\public\downloads\cti-notifier.apk
                  </code>
                </div>
                <div className="p-3 rounded-xl" style={{ backgroundColor: T.cardAlt }}>
                  <p className="text-[12px]" style={{ color: T.textSub }}>
                    <span style={{ color: "#c3a782", fontWeight: 600 }}>④</span> git push して Vercel にデプロイ
                  </p>
                  <code className="text-[11px] mt-1 block px-3 py-2 rounded-lg" style={{ backgroundColor: T.bg, color: T.textMuted }}>
                    git add -A && git commit -m &quot;add CTI apk&quot; && git push origin main
                  </code>
                </div>
                <div className="p-4 rounded-xl" style={{ backgroundColor: "#4a7c5908", border: "1px solid #4a7c5922" }}>
                  <p className="text-[12px]" style={{ color: "#4a7c59" }}>
                    ✅ これで下のダウンロードボタンが使えるようになります！<br/>
                    <span className="text-[11px]" style={{ color: T.textMuted }}>※ この作業は管理者が1回だけ行えばOK。スタッフはSTEP 4からスタート。</span>
                  </p>
                </div>
              </div>
            </div>

            {/* STEP 4: スマホでダウンロード＆インストール */}
            <div className="rounded-2xl p-6" style={{ ...cardStyle, borderColor: "#4a7c5944" }}>
              <div className="flex items-center gap-3 mb-5">
                <div style={stepNumStyle("#4a7c59")}>4</div>
                <div>
                  <h3 className="text-[14px] font-medium" style={{ color: T.text }}>スマホにインストール（スタッフ向け）</h3>
                  <p className="text-[11px]" style={{ color: "#4a7c59" }}>このページをスマホで開いてダウンロードするだけ！</p>
                </div>
              </div>
              <div className="space-y-3 pl-11">
                <div className="p-3 rounded-xl" style={{ backgroundColor: T.cardAlt }}>
                  <p className="text-[12px]" style={{ color: T.textSub }}>
                    <span style={{ color: "#c3a782", fontWeight: 600 }}>①</span> スマホのブラウザ（Chrome）で<span style={{ fontWeight: 600 }}>このページ</span>を開く
                  </p>
                  <code className="text-[11px] mt-1 block px-3 py-2 rounded-lg" style={{ backgroundColor: T.bg, color: "#c3a782" }}>
                    https://t-manage.vercel.app/system-setup
                  </code>
                </div>
                <div className="p-3 rounded-xl" style={{ backgroundColor: T.cardAlt }}>
                  <p className="text-[12px]" style={{ color: T.textSub }}>
                    <span style={{ color: "#c3a782", fontWeight: 600 }}>②</span> 下のボタンをタップしてダウンロード
                  </p>
                </div>

                {/* ダウンロードボタン */}
                <a href="/downloads/cti-notifier.apk" download="CTI-Notifier.apk"
                  className="block w-full py-4 rounded-2xl text-center text-[15px] font-medium no-underline"
                  style={{ background: "linear-gradient(135deg, #4a7c59, #3d6b4e)", color: "#fff", boxShadow: "0 4px 16px rgba(74,124,89,0.3)" }}>
                  📥 CTI Notifier をダウンロード
                </a>

                <div className="p-3 rounded-xl" style={{ backgroundColor: T.cardAlt }}>
                  <p className="text-[12px]" style={{ color: T.textSub }}>
                    <span style={{ color: "#c3a782", fontWeight: 600 }}>③</span> ダウンロード完了 → 「<span style={{ fontWeight: 600 }}>開く</span>」をタップ
                  </p>
                </div>
                <div className="p-3 rounded-xl" style={{ backgroundColor: T.cardAlt }}>
                  <p className="text-[12px]" style={{ color: T.textSub }}>
                    <span style={{ color: "#c3a782", fontWeight: 600 }}>④</span> 「この提供元のアプリを許可しますか？」→ <span style={{ color: "#4a7c59", fontWeight: 600 }}>許可</span> → <span style={{ color: "#4a7c59", fontWeight: 600 }}>インストール</span>
                  </p>
                  <p className="text-[11px] mt-1" style={{ color: T.textMuted }}>※ 初回のみ「不明なアプリ」の許可が必要です</p>
                </div>
                <div className="p-3 rounded-xl" style={{ backgroundColor: T.cardAlt }}>
                  <p className="text-[12px]" style={{ color: T.textSub }}>
                    <span style={{ color: "#c3a782", fontWeight: 600 }}>⑤</span> アプリを起動 → 権限を<span style={{ color: "#4a7c59", fontWeight: 600 }}>全て許可</span>
                  </p>
                  <div className="mt-2 space-y-1 text-[11px]" style={{ color: T.textMuted }}>
                    <p>✅ 電話の発信と管理</p>
                    <p>✅ 通話履歴の読み取り</p>
                    <p>✅ 通知の表示</p>
                  </div>
                </div>
              </div>
            </div>

            {/* STEP 5: 使い方 */}
            <div className="rounded-2xl p-6" style={cardStyle}>
              <div className="flex items-center gap-3 mb-5">
                <div style={stepNumStyle("#c3a782")}>5</div>
                <div>
                  <h3 className="text-[14px] font-medium" style={{ color: T.text }}>使い方</h3>
                  <p className="text-[11px]" style={{ color: T.textMuted }}>毎日の運用はこれだけ</p>
                </div>
              </div>
              <div className="space-y-3 pl-11">
                <div className="p-4 rounded-xl" style={{ backgroundColor: "#4a7c5908", border: "1px solid #4a7c5922" }}>
                  <p className="text-[13px] font-medium" style={{ color: "#4a7c59" }}>スマホ側</p>
                  <p className="text-[12px] mt-2" style={{ color: T.textSub }}>
                    アプリを開いて「<span style={{ fontWeight: 600 }}>サービス開始</span>」をタップするだけ！<br/>
                    通知バーに「📞 CTI監視中」が出ていればOK。
                  </p>
                </div>
                <div className="p-4 rounded-xl" style={{ backgroundColor: "#3d6b9f08", border: "1px solid #3d6b9f22" }}>
                  <p className="text-[13px] font-medium" style={{ color: "#3d6b9f" }}>PC側</p>
                  <p className="text-[12px] mt-2" style={{ color: T.textSub }}>
                    T-MANAGEをブラウザで開いておくだけ！<br/>
                    着信があると<span style={{ fontWeight: 600 }}>画面右下に顧客情報がポップアップ</span>します。
                  </p>
                </div>
              </div>
            </div>

            {/* STEP 6: バッテリー最適化 */}
            <div className="rounded-2xl p-6" style={cardStyle}>
              <div className="flex items-center gap-3 mb-5">
                <div style={stepNumStyle("#c45555")}>!</div>
                <div>
                  <h3 className="text-[14px] font-medium" style={{ color: T.text }}>重要：バッテリー最適化を無効にする</h3>
                  <p className="text-[11px]" style={{ color: "#c45555" }}>これをしないとアプリが停止することがあります</p>
                </div>
              </div>
              <div className="space-y-3 pl-11">
                <div className="p-3 rounded-xl" style={{ backgroundColor: T.cardAlt }}>
                  <p className="text-[12px]" style={{ color: T.textSub }}>
                    スマホの <span style={{ fontWeight: 600 }}>設定</span> → <span style={{ fontWeight: 600 }}>アプリ</span> → <span style={{ fontWeight: 600 }}>CTI Notifier</span> → <span style={{ fontWeight: 600 }}>バッテリー</span> → 「<span style={{ color: "#c45555", fontWeight: 600 }}>制限なし</span>」に設定
                  </p>
                </div>
              </div>
            </div>

            {/* トラブルシューティング */}
            <div className="rounded-2xl p-6" style={cardStyle}>
              <h3 className="text-[14px] font-medium mb-4" style={{ color: T.text }}>❓ よくある質問</h3>
              <div className="space-y-3">
                {[
                  { q: "APKファイルがインストールできない", a: "スマホの「設定」→「アプリ」→「特別なアプリアクセス」→「不明なアプリのインストール」で、Chromeからのインストールを許可してください。" },
                  { q: "ダウンロードボタンが反応しない", a: "管理者がAPKファイルをまだ配置していない可能性があります。管理者にSTEP 3の実施を依頼してください。" },
                  { q: "着信してもPCに表示されない", a: "① スマホでCTIアプリが「監視中」になっているか確認\n② PCでT-MANAGEがブラウザで開かれているか確認\n③ 別のスマホから電話をかけてテストしてみてください" },
                  { q: "スマホを再起動したら動かなくなった", a: "CTIアプリを開いて「サービス開始」を再度タップしてください。" },
                  { q: "知らない番号の時はどうなる？", a: "「新規のお客様」と表示され、そのまま顧客登録ができるボタンが出ます。" },
                  { q: "ケーブルで直接インストールもできる？", a: "はい。スマホの「開発者向けオプション」→「USBデバッグ」をONにして、USBケーブルで接続すれば、Android Studioから直接インストールもできます。" },
                ].map((faq, i) => (
                  <details key={i} className="rounded-xl" style={{ backgroundColor: T.cardAlt }}>
                    <summary className="px-4 py-3 text-[12px] cursor-pointer" style={{ color: T.text }}>{faq.q}</summary>
                    <div className="px-4 pb-3 text-[11px] whitespace-pre-wrap" style={{ color: T.textSub }}>{faq.a}</div>
                  </details>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ===== Chrome拡張 タブ ===== */}
        {tab === "chrome" && (
          <div className="space-y-6">
            {/* 概要 */}
            <div className="rounded-2xl p-6" style={cardStyle}>
              <h2 className="text-[16px] font-medium mb-3" style={{ color: T.text }}>🚀 Chrome拡張「T-MANAGE通知アシスタント」とは？</h2>
              <p className="text-[13px] leading-relaxed" style={{ color: T.textSub }}>
                T-MANAGEの予約通知ポップアップに「<span style={{ color: "#c3a782", fontWeight: 600 }}>自動入力</span>」ボタンを追加する拡張機能です。
                LINEやSMSへの通知メッセージを、ワンクリックで自動入力できます。
              </p>
              <div className="mt-4 p-4 rounded-xl" style={{ backgroundColor: T.cardAlt }}>
                <div className="flex items-center gap-4 text-[12px]" style={{ color: T.textSub }}>
                  <span className="px-3 py-1.5 rounded-lg" style={{ backgroundColor: "#c3a78218", color: "#c3a782" }}>📩 通知コピー</span>
                  <span style={{ color: T.textMuted }}>→</span>
                  <span className="px-3 py-1.5 rounded-lg" style={{ backgroundColor: "#06C75518", color: "#06C755" }}>💬 LINE自動入力</span>
                  <span style={{ color: T.textMuted }}>or</span>
                  <span className="px-3 py-1.5 rounded-lg" style={{ backgroundColor: "#3d6b9f18", color: "#3d6b9f" }}>📱 SMS自動入力</span>
                </div>
              </div>
            </div>

            {/* 対応サービス */}
            <div className="rounded-2xl p-6" style={cardStyle}>
              <h3 className="text-[14px] font-medium mb-4" style={{ color: T.text }}>📋 対応している送信先</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 rounded-xl" style={{ backgroundColor: "#06C75508", border: "1px solid #06C75522" }}>
                  <div className="text-[14px] mb-1">💬 LINE Business Chat</div>
                  <p className="text-[11px]" style={{ color: T.textSub }}>
                    お客様LINE / スタッフLINE<br/>
                    アカウントを自動判別して入力
                  </p>
                  <p className="text-[10px] mt-2" style={{ color: T.textMuted }}>chat.line.biz</p>
                </div>
                <div className="p-4 rounded-xl" style={{ backgroundColor: "#3d6b9f08", border: "1px solid #3d6b9f22" }}>
                  <div className="text-[14px] mb-1">📱 Google Messages（SMS）</div>
                  <p className="text-[11px]" style={{ color: T.textSub }}>
                    電話番号で自動検索<br/>
                    メッセージ欄に自動入力
                  </p>
                  <p className="text-[10px] mt-2" style={{ color: T.textMuted }}>messages.google.com</p>
                </div>
              </div>
            </div>

            {/* STEP 1: インストール */}
            <div className="rounded-2xl p-6" style={cardStyle}>
              <div className="flex items-center gap-3 mb-5">
                <div style={stepNumStyle("#3d6b9f")}>1</div>
                <div>
                  <h3 className="text-[14px] font-medium" style={{ color: T.text }}>拡張機能をChromeにインストール</h3>
                  <p className="text-[11px]" style={{ color: T.textMuted }}>開発者モードで読み込み</p>
                </div>
              </div>
              <div className="space-y-3 pl-11">
                <div className="p-3 rounded-xl" style={{ backgroundColor: T.cardAlt }}>
                  <p className="text-[12px]" style={{ color: T.textSub }}>
                    <span style={{ color: "#c3a782", fontWeight: 600 }}>①</span> Chromeのアドレスバーに入力：
                  </p>
                  <code className="text-[11px] mt-1 block px-3 py-2 rounded-lg" style={{ backgroundColor: T.bg, color: "#c3a782" }}>
                    chrome://extensions
                  </code>
                </div>
                <div className="p-3 rounded-xl" style={{ backgroundColor: T.cardAlt }}>
                  <p className="text-[12px]" style={{ color: T.textSub }}>
                    <span style={{ color: "#c3a782", fontWeight: 600 }}>②</span> 右上の「<span style={{ fontWeight: 600 }}>デベロッパーモード</span>」を <span style={{ color: "#4a7c59", fontWeight: 600 }}>ON</span> にする
                  </p>
                </div>
                <div className="p-3 rounded-xl" style={{ backgroundColor: T.cardAlt }}>
                  <p className="text-[12px]" style={{ color: T.textSub }}>
                    <span style={{ color: "#c3a782", fontWeight: 600 }}>③</span> 「<span style={{ fontWeight: 600 }}>パッケージ化されていない拡張機能を読み込む</span>」をクリック
                  </p>
                </div>
                <div className="p-3 rounded-xl" style={{ backgroundColor: T.cardAlt }}>
                  <p className="text-[12px]" style={{ color: T.textSub }}>
                    <span style={{ color: "#c3a782", fontWeight: 600 }}>④</span> フォルダを選択：
                  </p>
                  <code className="text-[11px] mt-1 block px-3 py-2 rounded-lg" style={{ backgroundColor: T.bg, color: "#c3a782" }}>
                    C:\Users\user\Desktop\t-manage\chrome-extension
                  </code>
                </div>
                <div className="p-4 rounded-xl" style={{ backgroundColor: "#4a7c5908", border: "1px solid #4a7c5922" }}>
                  <p className="text-[12px]" style={{ color: "#4a7c59" }}>
                    ✅ 「T-MANAGE 通知アシスタント」が拡張機能一覧に表示されればOK！
                  </p>
                </div>
              </div>
            </div>

            {/* STEP 2: 使い方 */}
            <div className="rounded-2xl p-6" style={cardStyle}>
              <div className="flex items-center gap-3 mb-5">
                <div style={stepNumStyle("#4a7c59")}>2</div>
                <div>
                  <h3 className="text-[14px] font-medium" style={{ color: T.text }}>使い方</h3>
                  <p className="text-[11px]" style={{ color: T.textMuted }}>通知ポップアップから自動入力</p>
                </div>
              </div>
              <div className="space-y-3 pl-11">
                <div className="p-4 rounded-xl" style={{ backgroundColor: T.cardAlt }}>
                  <p className="text-[13px] font-medium mb-2" style={{ color: T.text }}>LINE送信の場合</p>
                  <div className="space-y-2 text-[12px]" style={{ color: T.textSub }}>
                    <p><span style={{ color: "#c3a782", fontWeight: 600 }}>①</span> T-MANAGEの通知ポップアップで「💬 LINE用テキストをコピー」</p>
                    <p><span style={{ color: "#c3a782", fontWeight: 600 }}>②</span> LINE Business Chat のタブを開く</p>
                    <p><span style={{ color: "#c3a782", fontWeight: 600 }}>③</span> 通知に表示される「🚀 自動入力」ボタンをクリック</p>
                    <p><span style={{ color: "#c3a782", fontWeight: 600 }}>④</span> メッセージが自動で入力される → 送信！</p>
                  </div>
                </div>
                <div className="p-4 rounded-xl" style={{ backgroundColor: T.cardAlt }}>
                  <p className="text-[13px] font-medium mb-2" style={{ color: T.text }}>SMS送信の場合</p>
                  <div className="space-y-2 text-[12px]" style={{ color: T.textSub }}>
                    <p><span style={{ color: "#c3a782", fontWeight: 600 }}>①</span> T-MANAGEの通知ポップアップで「📱 SMS用コピー」</p>
                    <p><span style={{ color: "#c3a782", fontWeight: 600 }}>②</span> Google Messages のタブを開く</p>
                    <p><span style={{ color: "#c3a782", fontWeight: 600 }}>③</span> 電話番号で自動検索 → メッセージが入力される</p>
                  </div>
                </div>
              </div>
            </div>

            {/* LINE業務アカウント情報 */}
            <div className="rounded-2xl p-6" style={cardStyle}>
              <div className="flex items-center gap-3 mb-5">
                <div style={stepNumStyle("#06C755")}>i</div>
                <div>
                  <h3 className="text-[14px] font-medium" style={{ color: T.text }}>LINE業務アカウント情報</h3>
                  <p className="text-[11px]" style={{ color: T.textMuted }}>自動判別の仕組み</p>
                </div>
              </div>
              <div className="space-y-3 pl-11">
                <div className="p-3 rounded-xl" style={{ backgroundColor: T.cardAlt }}>
                  <p className="text-[12px]" style={{ color: T.textSub }}>
                    拡張機能はLINEのアカウント名に「<span style={{ fontWeight: 600 }}>業務</span>」が含まれるかどうかで自動判別します。
                  </p>
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center gap-3 text-[11px]">
                      <span className="px-2 py-1 rounded-lg" style={{ backgroundColor: "#85a8c418", color: "#85a8c4" }}>「業務」を含む</span>
                      <span style={{ color: T.textMuted }}>→ スタッフ向けメッセージ用</span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px]">
                      <span className="px-2 py-1 rounded-lg" style={{ backgroundColor: "#c3a78218", color: "#c3a782" }}>「業務」を含まない</span>
                      <span style={{ color: T.textMuted }}>→ お客様向けメッセージ用</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* SMS情報 */}
            <div className="rounded-2xl p-6" style={cardStyle}>
              <div className="flex items-center gap-3 mb-5">
                <div style={stepNumStyle("#3d6b9f")}>i</div>
                <div>
                  <h3 className="text-[14px] font-medium" style={{ color: T.text }}>SMS送信アカウント</h3>
                  <p className="text-[11px]" style={{ color: T.textMuted }}>2つのブラウザで使い分け</p>
                </div>
              </div>
              <div className="space-y-3 pl-11">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl" style={{ backgroundColor: T.cardAlt }}>
                    <p className="text-[12px] font-medium" style={{ color: T.text }}>Chrome</p>
                    <p className="text-[10px] mt-1" style={{ color: T.textMuted }}>messages.google.com</p>
                    <p className="text-[10px]" style={{ color: T.textMuted }}>ange.spa0510@gmail.com</p>
                  </div>
                  <div className="p-3 rounded-xl" style={{ backgroundColor: T.cardAlt }}>
                    <p className="text-[12px] font-medium" style={{ color: T.text }}>Edge</p>
                    <p className="text-[10px] mt-1" style={{ color: T.textMuted }}>URLハッシュ経由</p>
                    <p className="text-[10px]" style={{ color: T.textMuted }}>ange.spa.toyohasi@gmail.com</p>
                  </div>
                </div>
              </div>
            </div>

            {/* トラブルシューティング */}
            <div className="rounded-2xl p-6" style={cardStyle}>
              <h3 className="text-[14px] font-medium mb-4" style={{ color: T.text }}>❓ よくある質問</h3>
              <div className="space-y-3">
                {[
                  { q: "自動入力ボタンが表示されない", a: "Chrome拡張が有効になっているか確認してください。chrome://extensions で「T-MANAGE 通知アシスタント」がONになっているか確認してください。" },
                  { q: "LINEに自動入力されない", a: "LINE Business Chat（chat.line.biz）がChromeのタブで開かれていることを確認してください。スマホアプリのLINEではなく、PC版のブラウザLINEが必要です。" },
                  { q: "Chromeを更新したら拡張が消えた", a: "デベロッパーモードで読み込んだ拡張はChromeの更新で無効になることがあります。chrome://extensions から再度読み込んでください。" },
                  { q: "Edge でも使える？", a: "SMS送信はEdge、LINE送信はChromeと使い分けています。拡張機能自体はChrome用です。" },
                ].map((faq, i) => (
                  <details key={i} className="rounded-xl" style={{ backgroundColor: T.cardAlt }}>
                    <summary className="px-4 py-3 text-[12px] cursor-pointer" style={{ color: T.text }}>{faq.q}</summary>
                    <div className="px-4 pb-3 text-[11px] whitespace-pre-wrap" style={{ color: T.textSub }}>{faq.a}</div>
                  </details>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
