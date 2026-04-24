"use client";

import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";
import { useTheme } from "../../lib/theme";
import { NavMenu } from "../../lib/nav-menu";

type Tab = "cti" | "chrome" | "video" | "sokuho" | "hp" | "mail" | "chat-ai";

export default function SystemSetup() {
  const router = useRouter();
  const { dark, toggle, T } = useTheme();
  const [tab, setTab] = useState<Tab>("cti");

  // LINE URL設定
  const [lineUrlCustomer, setLineUrlCustomer] = useState("");
  const [lineUrlStaff, setLineUrlStaff] = useState("");
  const [lineSaving, setLineSaving] = useState(false);
  const [lineMsg, setLineMsg] = useState("");

  // 速報設定
  const [bskyId, setBskyId] = useState("");
  const [bskyPw, setBskyPw] = useState("");
  const [bskySaving, setBskySaving] = useState(false);
  const [bskyMsg, setBskyMsg] = useState("");
  const [estamaIdMikawa, setEstamaIdMikawa] = useState("");
  const [estamaPwMikawa, setEstamaPwMikawa] = useState("");
  const [estamaIdToyohashi, setEstamaIdToyohashi] = useState("");
  const [estamaPwToyohashi, setEstamaPwToyohashi] = useState("");
  const [estamaSaving, setEstamaSaving] = useState(false);
  const [estamaMsg, setEstamaMsg] = useState("");

  // HP連携設定
  const [hpLoginId, setHpLoginId] = useState("");
  const [hpLoginPass, setHpLoginPass] = useState("");
  const [hpSaving, setHpSaving] = useState(false);
  const [hpMsg, setHpMsg] = useState("");
  const [hpTesting, setHpTesting] = useState(false);
  const [hpTestResult, setHpTestResult] = useState("");

  // SMTP
  const [smtpHost, setSmtpHost] = useState("smtp.gmail.com");
  const [smtpPort, setSmtpPort] = useState("587");
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPass, setSmtpPass] = useState("");
  const [smtpFrom, setSmtpFrom] = useState("");
  const [mailStoreName, setMailStoreName] = useState("チョップ");
  const [smtpSaving, setSmtpSaving] = useState(false);
  const [smtpMsg, setSmtpMsg] = useState("");

  useEffect(() => {
    const check = async () => { const { data: { user } } = await supabase.auth.getUser(); if (!user) router.push("/"); };
    check();
    // LINE URL読み込み
    const loadSettings = async () => {
      const { data } = await supabase.from("store_settings").select("key,value").in("key", ["line_url_customer", "line_url_staff", "bsky_id", "bsky_pw", "estama_id_mikawa", "estama_pw_mikawa", "estama_id_toyohashi", "estama_pw_toyohashi", "hp_login_id", "hp_login_pass", "smtp_host", "smtp_port", "smtp_user", "smtp_pass", "smtp_from", "store_name"]);
      if (data) { for (const s of data) { if (s.key === "line_url_customer") setLineUrlCustomer(s.value); if (s.key === "line_url_staff") setLineUrlStaff(s.value); if (s.key === "bsky_id") setBskyId(s.value); if (s.key === "bsky_pw") setBskyPw(s.value); if (s.key === "estama_id_mikawa") setEstamaIdMikawa(s.value); if (s.key === "estama_pw_mikawa") setEstamaPwMikawa(s.value); if (s.key === "estama_id_toyohashi") setEstamaIdToyohashi(s.value); if (s.key === "estama_pw_toyohashi") setEstamaPwToyohashi(s.value); if (s.key === "hp_login_id") setHpLoginId(s.value); if (s.key === "hp_login_pass") setHpLoginPass(s.value); if (s.key === "smtp_host") setSmtpHost(s.value); if (s.key === "smtp_port") setSmtpPort(s.value); if (s.key === "smtp_user") setSmtpUser(s.value); if (s.key === "smtp_pass") setSmtpPass(s.value); if (s.key === "smtp_from") setSmtpFrom(s.value); if (s.key === "store_name") setMailStoreName(s.value); } }
    };
    loadSettings();
  }, [router]);

  const saveLineUrls = async () => {
    setLineSaving(true); setLineMsg("");
    for (const [key, value] of [["line_url_customer", lineUrlCustomer], ["line_url_staff", lineUrlStaff]]) {
      const { data: existing } = await supabase.from("store_settings").select("id").eq("key", key).maybeSingle();
      if (existing) { await supabase.from("store_settings").update({ value }).eq("key", key); }
      else { await supabase.from("store_settings").insert({ key, value }); }
    }
    setLineSaving(false); setLineMsg("保存しました！");
    setTimeout(() => setLineMsg(""), 3000);
  };

  const saveBskySettings = async () => {
    setBskySaving(true); setBskyMsg("");
    await supabase.from("store_settings").upsert({ key: "bsky_id", value: bskyId }, { onConflict: "key" });
    await supabase.from("store_settings").upsert({ key: "bsky_pw", value: bskyPw }, { onConflict: "key" });
    setBskySaving(false); setBskyMsg("保存しました！");
    setTimeout(() => setBskyMsg(""), 3000);
  };

  const saveEstamaSettings = async () => {
    setEstamaSaving(true); setEstamaMsg("");
    await supabase.from("store_settings").upsert({ key: "estama_id_mikawa", value: estamaIdMikawa }, { onConflict: "key" });
    await supabase.from("store_settings").upsert({ key: "estama_pw_mikawa", value: estamaPwMikawa }, { onConflict: "key" });
    await supabase.from("store_settings").upsert({ key: "estama_id_toyohashi", value: estamaIdToyohashi }, { onConflict: "key" });
    await supabase.from("store_settings").upsert({ key: "estama_pw_toyohashi", value: estamaPwToyohashi }, { onConflict: "key" });
    setEstamaSaving(false); setEstamaMsg("保存しました！");
    setTimeout(() => setEstamaMsg(""), 3000);
  };

  const saveHpSettings = async () => {
    setHpSaving(true); setHpMsg("");
    await supabase.from("store_settings").upsert({ key: "hp_login_id", value: hpLoginId }, { onConflict: "key" });
    await supabase.from("store_settings").upsert({ key: "hp_login_pass", value: hpLoginPass }, { onConflict: "key" });
    setHpSaving(false); setHpMsg("保存しました！");
    setTimeout(() => setHpMsg(""), 3000);
  };

  const saveSmtpSettings = async () => {
    setSmtpSaving(true); setSmtpMsg("");
    for (const [key, value] of [["smtp_host", smtpHost], ["smtp_port", smtpPort], ["smtp_user", smtpUser], ["smtp_pass", smtpPass], ["smtp_from", smtpFrom || smtpUser], ["store_name", mailStoreName]] as [string, string][]) {
      await supabase.from("store_settings").upsert({ key, value }, { onConflict: "key" });
    }
    setSmtpSaving(false); setSmtpMsg("✅ 保存しました！");
    setTimeout(() => setSmtpMsg(""), 3000);
  };

  const testHpLogin = async () => {
    setHpTesting(true); setHpTestResult("");
    try {
      const res = await fetch("/api/hp-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "login_test", loginId: hpLoginId, loginPass: hpLoginPass }),
      });
      const data = await res.json();
      if (data.success) {
        setHpTestResult("✅ ログイン成功！");
      } else {
        setHpTestResult(`❌ ${data.error || "ログイン失敗"}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "通信エラー";
      setHpTestResult(`❌ ${msg}`);
    }
    setHpTesting(false);
  };

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
            { key: "hp" as Tab, label: "🌐 HP連携", desc: "Panda Web Concierge" },
            { key: "video" as Tab, label: "🎥 AI動画生成", desc: "セットアップ" },
            { key: "sokuho" as Tab, label: "📢 リアルタイム速報", desc: "Bluesky / エステ魂" },
            { key: "mail" as Tab, label: "✉️ メール送信", desc: "パスワード再発行" },
            { key: "chat-ai" as Tab, label: "🧠 チャットAI分析", desc: "ターミナル実行手順" },
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

            {/* ⚠ 重要: お客様情報の表示ルール */}
            <div
              className="rounded-2xl p-6"
              style={{
                backgroundColor: T.card,
                border: "1.5px solid rgba(61,107,159,0.35)",
              }}
            >
              <div className="flex items-center gap-2 mb-3">
                <span style={{ fontSize: 20 }}>💡</span>
                <h3 className="text-[15px] font-medium" style={{ color: "#3d6b9f" }}>
                  大事なお知らせ: ポップアップに名前が出るかどうかの仕組み
                </h3>
              </div>
              <p className="text-[12px] mb-4 leading-relaxed" style={{ color: T.textSub }}>
                「スマホの連絡先に登録してあるお客様なら自動で名前が出る」と思われがちですが、実は違います。
                <br />
                <strong style={{ color: T.text }}>ポップアップに名前が出るかどうかは、T-MANAGE の「顧客一覧」に登録されているかだけで決まります。</strong>
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                {/* スマホ側 */}
                <div className="p-4 rounded-xl" style={{ backgroundColor: T.cardAlt, border: "1px dashed rgba(232,132,154,0.4)" }}>
                  <div className="flex items-center gap-2 mb-2">
                    <span style={{ fontSize: 18 }}>📱</span>
                    <strong className="text-[13px]" style={{ color: "#e8849a" }}>スマホの連絡先</strong>
                  </div>
                  <p className="text-[11px] mb-2" style={{ color: T.textSub }}>
                    プライベートなデータ
                  </p>
                  <ul className="text-[10px] space-y-1 pl-3" style={{ color: T.textMuted }}>
                    <li>• 家族・友人・取引先など</li>
                    <li>• <strong style={{ color: T.text }}>サロン業務とは無関係</strong></li>
                    <li>• 整理・削除しても T-MANAGE に影響なし</li>
                    <li>• 着信番号を T-MANAGE に渡すだけの役割</li>
                  </ul>
                </div>

                {/* T-MANAGE側 */}
                <div className="p-4 rounded-xl" style={{ backgroundColor: T.cardAlt, border: "1px dashed rgba(74,124,89,0.4)" }}>
                  <div className="flex items-center gap-2 mb-2">
                    <span style={{ fontSize: 18 }}>💻</span>
                    <strong className="text-[13px]" style={{ color: "#4a7c59" }}>T-MANAGE の顧客一覧</strong>
                  </div>
                  <p className="text-[11px] mb-2" style={{ color: T.textSub }}>
                    サロンのお客様データ
                  </p>
                  <ul className="text-[10px] space-y-1 pl-3" style={{ color: T.textMuted }}>
                    <li>• お店で管理しているお客様</li>
                    <li>• 名前・来店履歴・ランク・メモ</li>
                    <li>• <strong style={{ color: T.text }}>ここに登録があれば名前で表示</strong></li>
                    <li>• 登録がなければ「新規のお客様」</li>
                  </ul>
                </div>
              </div>

              <div className="p-4 rounded-xl" style={{ backgroundColor: T.cardAlt }}>
                <p className="text-[12px] mb-2" style={{ color: T.text, fontWeight: 600 }}>
                  📋 実際の表示パターン
                </p>
                <div className="space-y-2 text-[11px]" style={{ color: T.textSub }}>
                  <div className="flex items-start gap-2">
                    <span style={{ color: "#4a7c59", fontSize: 14, lineHeight: 1 }}>✅</span>
                    <div>
                      <strong style={{ color: T.text }}>T-MANAGE に登録済みのお客様から着信</strong>
                      <div style={{ color: "#4a7c59", marginTop: 2 }}>→ お名前・ランク・来店回数で表示 🎉</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <span style={{ color: "#f59e0b", fontSize: 14, lineHeight: 1 }}>⚠</span>
                    <div>
                      <strong style={{ color: T.text }}>未登録のお客様から着信</strong>
                      <div style={{ color: "#f59e0b", marginTop: 2 }}>→「新規のお客様」と表示(オーダー登録ボタンで即登録可能)</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 p-3 rounded-xl" style={{ backgroundColor: "rgba(195,167,130,0.08)", border: "1px solid rgba(195,167,130,0.3)" }}>
                <p className="text-[11px] leading-relaxed" style={{ color: T.textSub }}>
                  🎯 <strong style={{ color: T.text }}>運用のコツ:</strong>{" "}
                  新規のお客様から電話があった時、その場で<strong style={{ color: "#4a7c59" }}>「オーダー登録(新規顧客)」</strong>ボタンを押して T-MANAGE に登録すれば、次回以降の着信では自動でお名前が表示されるようになります。お客様情報を T-MANAGE にどれだけ貯めるかで、業務の快適さが決まります 💪
                </p>
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

            {/* ═══════════════════════════════════════════ */}
            {/* 🆕 iPhone CTI Bridge (Beta) セクション      */}
            {/* ═══════════════════════════════════════════ */}
            <div
              className="rounded-2xl p-6"
              style={{
                backgroundColor: T.card,
                border: "1.5px solid rgba(232,132,154,0.4)",
              }}
            >
              {/* ヘッダー */}
              <div className="flex items-center gap-3 mb-3">
                <span className="text-[22px]">📱</span>
                <div className="flex-1">
                  <h2 className="text-[16px] font-medium" style={{ color: T.text }}>
                    iPhone でも使いたい方へ
                  </h2>
                  <p className="text-[11px]" style={{ color: T.textMuted }}>
                    Windows PC経由で iPhone の着信も T-MANAGE に連携できます
                  </p>
                </div>
                <span
                  className="px-3 py-1 rounded-full text-[10px] font-medium"
                  style={{ backgroundColor: "#e8849a", color: "#fff" }}
                >
                  BETA
                </span>
              </div>

              {/* ベータ版の注意書き */}
              <div
                className="mb-5 p-4 rounded-xl"
                style={{ backgroundColor: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.3)" }}
              >
                <p className="text-[12px] mb-2" style={{ color: "#f59e0b", fontWeight: 600 }}>
                  ⚠ これはベータ版です。100%の検出は保証できません
                </p>
                <ul className="text-[11px] space-y-1 pl-4" style={{ color: T.textSub }}>
                  <li>• iPhoneとWindowsのPhone Link接続が切れている時は動作しません</li>
                  <li>• iPhone連絡先に登録済みの番号は「名前」で通知が来るため番号が取れません</li>
                  <li>• 集中モード/サイレント中・PCスリープ中は動作しません</li>
                  <li>• <strong style={{ color: T.text }}>業務クリティカルな用途には Twilio連携版(有料) をおすすめします</strong></li>
                </ul>
              </div>

              {/* 動作原理 */}
              <div className="mb-5 p-4 rounded-xl" style={{ backgroundColor: T.cardAlt }}>
                <h3 className="text-[13px] font-medium mb-3" style={{ color: T.text }}>🔄 動作の仕組み</h3>
                <div className="flex items-center gap-2 flex-wrap text-[11px]" style={{ color: T.textSub }}>
                  <span className="px-3 py-1.5 rounded-lg" style={{ backgroundColor: "#e8849a18", color: "#e8849a" }}>📱 iPhone着信</span>
                  <span style={{ color: T.textMuted }}>→</span>
                  <span className="px-3 py-1.5 rounded-lg" style={{ backgroundColor: "#3d6b9f18", color: "#3d6b9f" }}>🔗 Phone Link</span>
                  <span style={{ color: T.textMuted }}>→</span>
                  <span className="px-3 py-1.5 rounded-lg" style={{ backgroundColor: "#a855f718", color: "#a855f7" }}>🐍 Pythonブリッジ</span>
                  <span style={{ color: T.textMuted }}>→</span>
                  <span className="px-3 py-1.5 rounded-lg" style={{ backgroundColor: "#4a7c5918", color: "#4a7c59" }}>💻 T-MANAGE表示</span>
                </div>
              </div>

              {/* ⚠ 重要: データの住み分け */}
              <div
                className="mb-5 p-4 rounded-xl"
                style={{
                  backgroundColor: "rgba(61,107,159,0.08)",
                  border: "1px solid rgba(61,107,159,0.3)",
                }}
              >
                <h3 className="text-[13px] font-medium mb-3" style={{ color: "#3d6b9f" }}>
                  💡 重要: iPhone の連絡先と T-MANAGE の顧客情報は別物です
                </h3>
                <p className="text-[11px] mb-3 leading-relaxed" style={{ color: T.textSub }}>
                  よくある勘違いですが、ポップアップでお客様名が表示されるかどうかは、<strong style={{ color: T.text }}>iPhone の連絡先とは無関係</strong>です。T-MANAGE の顧客データベースとの照合で決まります。
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                  {/* iPhone側 */}
                  <div className="p-3 rounded-xl" style={{ backgroundColor: T.card, border: "1px dashed rgba(232,132,154,0.4)" }}>
                    <div className="flex items-center gap-2 mb-2">
                      <span style={{ fontSize: 16 }}>📱</span>
                      <strong className="text-[12px]" style={{ color: "#e8849a" }}>iPhone の連絡先</strong>
                    </div>
                    <p className="text-[10px] mb-2" style={{ color: T.textSub }}>
                      社長個人のプライベートデータ
                    </p>
                    <ul className="text-[10px] space-y-1 pl-3" style={{ color: T.textMuted }}>
                      <li>• 家族・友人・取引先など</li>
                      <li>• サロン業務とは <strong style={{ color: T.text }}>無関係</strong></li>
                      <li>• 整理・削除しても T-MANAGE に影響なし</li>
                    </ul>
                  </div>

                  {/* T-MANAGE側 */}
                  <div className="p-3 rounded-xl" style={{ backgroundColor: T.card, border: "1px dashed rgba(74,124,89,0.4)" }}>
                    <div className="flex items-center gap-2 mb-2">
                      <span style={{ fontSize: 16 }}>💻</span>
                      <strong className="text-[12px]" style={{ color: "#4a7c59" }}>T-MANAGE の顧客DB</strong>
                    </div>
                    <p className="text-[10px] mb-2" style={{ color: T.textSub }}>
                      サロンのお客様データ
                    </p>
                    <ul className="text-[10px] space-y-1 pl-3" style={{ color: T.textMuted }}>
                      <li>• 顧客一覧で管理しているお客様</li>
                      <li>• 名前・来店履歴・ランク・NG情報など</li>
                      <li>• <strong style={{ color: T.text }}>ここに登録がないと「新規」と表示</strong></li>
                    </ul>
                  </div>
                </div>

                <div className="p-3 rounded-xl" style={{ backgroundColor: T.cardAlt }}>
                  <p className="text-[11px] leading-relaxed" style={{ color: T.textSub }}>
                    <strong style={{ color: T.text }}>動作例:</strong>
                  </p>
                  <div className="mt-2 space-y-1 text-[10px]" style={{ color: T.textSub }}>
                    <div>
                      ✅ iPhone連絡先に未登録 + T-MANAGE顧客DBに登録あり
                      <br />
                      <span style={{ paddingLeft: 18, color: "#4a7c59" }}>→ お客様名でポップアップ表示 🎉</span>
                    </div>
                    <div className="mt-1">
                      ⚠ iPhone連絡先に未登録 + T-MANAGE顧客DBにも未登録
                      <br />
                      <span style={{ paddingLeft: 18, color: "#f59e0b" }}>→「新規のお客様」と表示(オーダー登録ボタンあり)</span>
                    </div>
                    <div className="mt-1">
                      ℹ iPhone連絡先に登録あり(どちらでも影響なし)
                      <br />
                      <span style={{ paddingLeft: 18, color: T.textMuted }}>→ 表示はT-MANAGE顧客DBの有無で決まる</span>
                    </div>
                  </div>
                </div>

                <p className="text-[11px] mt-3 leading-relaxed" style={{ color: T.textSub }}>
                  🎯 <strong style={{ color: T.text }}>つまり</strong>: お客様情報を充実させたいなら、<strong style={{ color: "#4a7c59" }}>T-MANAGE の顧客一覧に登録</strong>してください。新規のお客様から着信があった時は、その場で「オーダー登録(新規顧客)」ボタンから登録すれば、次回以降は名前で表示されます。
                </p>
              </div>

              {/* 事前準備 */}
              <div className="rounded-2xl p-5 mb-4" style={{ backgroundColor: T.cardAlt }}>
                <div className="flex items-center gap-3 mb-4">
                  <div style={stepNumStyle("#3d6b9f")}>0</div>
                  <div>
                    <h3 className="text-[14px] font-medium" style={{ color: T.text }}>事前準備: Phone Link で iPhone をペアリング</h3>
                    <p className="text-[11px]" style={{ color: T.textMuted }}>ここが成功しないと先に進めません (最重要)</p>
                  </div>
                </div>
                <div className="space-y-2 pl-11">
                  <div className="p-3 rounded-xl" style={{ backgroundColor: T.card }}>
                    <p className="text-[12px]" style={{ color: T.textSub }}>
                      <span style={{ color: "#3d6b9f", fontWeight: 600 }}>①</span> Windows スタートメニューで「<strong style={{ color: T.text }}>スマートフォン連携</strong>」を検索して起動
                    </p>
                  </div>
                  <div className="p-3 rounded-xl" style={{ backgroundColor: T.card }}>
                    <p className="text-[12px]" style={{ color: T.textSub }}>
                      <span style={{ color: "#3d6b9f", fontWeight: 600 }}>②</span> 「iPhone」を選択 → QRコードが表示される → iPhoneカメラで読み取り
                    </p>
                  </div>
                  <div className="p-3 rounded-xl" style={{ backgroundColor: T.card }}>
                    <p className="text-[12px]" style={{ color: T.textSub }}>
                      <span style={{ color: "#3d6b9f", fontWeight: 600 }}>③</span> iPhone側で「Bluetooth共有」「通知の表示」「システム通知の表示」を全て許可
                    </p>
                  </div>
                  <div className="p-3 rounded-xl" style={{ backgroundColor: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)" }}>
                    <p className="text-[12px]" style={{ color: T.textSub }}>
                      <span style={{ color: "#f59e0b", fontWeight: 600 }}>🧪 テスト</span>: 別の電話から自分のiPhoneに発信してもらう
                    </p>
                    <div className="mt-2 text-[11px] space-y-1" style={{ color: T.textSub, paddingLeft: 20 }}>
                      <div>✅ <strong style={{ color: "#4a7c59" }}>番号で表示</strong> → 完璧。このまま進む</div>
                      <div>⚠ <strong style={{ color: "#f59e0b" }}>名前で表示</strong> → 連絡先登録済み。一時削除 or 別番号でテスト</div>
                      <div>❌ <strong style={{ color: "#c45555" }}>何も出ない</strong> → Bridge起動しても無駄。再ペアリングが必要</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* STEP 1: フォルダ配置 */}
              <div className="rounded-2xl p-5 mb-4" style={{ backgroundColor: T.cardAlt }}>
                <div className="flex items-center gap-3 mb-4">
                  <div style={stepNumStyle("#3d6b9f")}>1</div>
                  <div>
                    <h3 className="text-[14px] font-medium" style={{ color: T.text }}>Bridge フォルダを配置</h3>
                    <p className="text-[11px]" style={{ color: T.textMuted }}>GitHub から最新コードを取得</p>
                  </div>
                </div>
                <div className="space-y-2 pl-11">
                  <div className="p-3 rounded-xl" style={{ backgroundColor: T.card }}>
                    <p className="text-[12px] mb-2" style={{ color: T.textSub }}>
                      <span style={{ color: "#3d6b9f", fontWeight: 600 }}>①</span> PowerShell を開いて最新版を取得:
                    </p>
                    <code className="text-[11px] block px-3 py-2 rounded-lg" style={{ backgroundColor: T.bg, color: "#c3a782" }}>
                      cd C:\Users\user\Desktop\t-manage<br />
                      git pull origin main
                    </code>
                  </div>
                  <div className="p-3 rounded-xl" style={{ backgroundColor: T.card }}>
                    <p className="text-[12px]" style={{ color: T.textSub }}>
                      <span style={{ color: "#3d6b9f", fontWeight: 600 }}>②</span> <code style={{ color: "#c3a782" }}>iphone-cti-bridge</code> フォルダが存在すればOK
                    </p>
                  </div>
                </div>
              </div>

              {/* STEP 2: Python */}
              <div className="rounded-2xl p-5 mb-4" style={{ backgroundColor: T.cardAlt }}>
                <div className="flex items-center gap-3 mb-4">
                  <div style={stepNumStyle("#a855f7")}>2</div>
                  <div>
                    <h3 className="text-[14px] font-medium" style={{ color: T.text }}>Python 3.10以降をインストール</h3>
                    <p className="text-[11px]" style={{ color: T.textMuted }}>既にインストール済みならスキップ</p>
                  </div>
                </div>
                <div className="space-y-2 pl-11">
                  <div className="p-3 rounded-xl" style={{ backgroundColor: T.card }}>
                    <p className="text-[12px] mb-2" style={{ color: T.textSub }}>
                      <span style={{ color: "#a855f7", fontWeight: 600 }}>①</span> 確認: PowerShell で
                    </p>
                    <code className="text-[11px] block px-3 py-2 rounded-lg mb-2" style={{ backgroundColor: T.bg, color: "#c3a782" }}>
                      python --version
                    </code>
                    <p className="text-[11px]" style={{ color: T.textMuted }}>
                      <strong style={{ color: "#4a7c59" }}>Python 3.10 以降</strong>が表示されればOK
                    </p>
                  </div>
                  <div className="p-3 rounded-xl" style={{ backgroundColor: T.card }}>
                    <p className="text-[12px]" style={{ color: T.textSub }}>
                      <span style={{ color: "#a855f7", fontWeight: 600 }}>②</span> 未インストールなら{" "}
                      <a href="https://www.python.org/downloads/" target="_blank" rel="noopener" style={{ color: "#c3a782", textDecoration: "underline" }}>
                        python.org
                      </a>{" "}
                      から最新版DL
                    </p>
                    <p className="text-[11px] mt-1" style={{ color: "#c45555" }}>
                      ⚠ インストール時「Add Python to PATH」に<strong>必ずチェック</strong>を入れる
                    </p>
                  </div>
                </div>
              </div>

              {/* STEP 3: .env設定 */}
              <div className="rounded-2xl p-5 mb-4" style={{ backgroundColor: T.cardAlt }}>
                <div className="flex items-center gap-3 mb-4">
                  <div style={stepNumStyle("#f59e0b")}>3</div>
                  <div>
                    <h3 className="text-[14px] font-medium" style={{ color: T.text }}>設定ファイル <code>.env</code> を作成</h3>
                    <p className="text-[11px]" style={{ color: T.textMuted }}>Supabaseの接続情報を書き込む</p>
                  </div>
                </div>
                <div className="space-y-2 pl-11">
                  <div className="p-3 rounded-xl" style={{ backgroundColor: T.card }}>
                    <p className="text-[12px] mb-2" style={{ color: T.textSub }}>
                      <span style={{ color: "#f59e0b", fontWeight: 600 }}>①</span> PowerShell で:
                    </p>
                    <code className="text-[11px] block px-3 py-2 rounded-lg" style={{ backgroundColor: T.bg, color: "#c3a782" }}>
                      cd C:\Users\user\Desktop\t-manage\iphone-cti-bridge<br />
                      copy .env.example .env<br />
                      notepad .env
                    </code>
                  </div>
                  <div className="p-3 rounded-xl" style={{ backgroundColor: T.card }}>
                    <p className="text-[12px] mb-2" style={{ color: T.textSub }}>
                      <span style={{ color: "#f59e0b", fontWeight: 600 }}>②</span> メモ帳で以下を確認・編集:
                    </p>
                    <code className="text-[11px] block px-3 py-2 rounded-lg whitespace-pre" style={{ backgroundColor: T.bg, color: "#c3a782", lineHeight: 1.6 }}>
{`SUPABASE_URL=https://cbewozzdyjqmhzkxsjqo.supabase.co
SUPABASE_ANON_KEY=（Supabase Anon Key）
STORE_ID=1`}
                    </code>
                    <p className="text-[11px] mt-1" style={{ color: T.textMuted }}>
                      アンジュスパは <code style={{ color: "#c3a782" }}>STORE_ID=1</code> のまま
                    </p>
                  </div>
                </div>
              </div>

              {/* STEP 4: 起動 */}
              <div className="rounded-2xl p-5 mb-4" style={{ backgroundColor: T.cardAlt }}>
                <div className="flex items-center gap-3 mb-4">
                  <div style={stepNumStyle("#4a7c59")}>4</div>
                  <div>
                    <h3 className="text-[14px] font-medium" style={{ color: T.text }}>Bridge を起動</h3>
                    <p className="text-[11px]" style={{ color: T.textMuted }}>初回のみ依存パッケージの自動インストール(2〜5分)</p>
                  </div>
                </div>
                <div className="space-y-2 pl-11">
                  <div className="p-3 rounded-xl" style={{ backgroundColor: T.card }}>
                    <p className="text-[12px]" style={{ color: T.textSub }}>
                      <span style={{ color: "#4a7c59", fontWeight: 600 }}>①</span> <code style={{ color: "#c3a782" }}>iphone-cti-bridge</code> フォルダを開いて <strong style={{ color: T.text }}>start-bridge.bat</strong> をダブルクリック
                    </p>
                  </div>
                  <div className="p-3 rounded-xl" style={{ backgroundColor: T.card }}>
                    <p className="text-[12px]" style={{ color: T.textSub }}>
                      <span style={{ color: "#4a7c59", fontWeight: 600 }}>②</span> Windows が「Python の通知アクセスを許可しますか?」とダイアログを出す → <strong style={{ color: T.text }}>はい</strong>
                    </p>
                  </div>
                  <div className="p-3 rounded-xl" style={{ backgroundColor: T.card }}>
                    <p className="text-[12px] mb-2" style={{ color: T.textSub }}>
                      <span style={{ color: "#4a7c59", fontWeight: 600 }}>③</span> 起動成功時の表示:
                    </p>
                    <code className="text-[10px] block px-3 py-2 rounded-lg whitespace-pre" style={{ backgroundColor: T.bg, color: "#4a7c59", lineHeight: 1.5 }}>
{`✅ 通知アクセス許可 OK
🎧 通知監視開始 (store_id=1, device=DESKTOP-XXX)
🚀 T-MANAGE iPhone CTI Bridge 起動`}
                    </code>
                    <p className="text-[11px] mt-2" style={{ color: T.textMuted }}>
                      ⚠ ウィンドウを<strong style={{ color: "#c45555" }}>開いたまま</strong>にしておく (閉じると停止)
                    </p>
                  </div>
                </div>
              </div>

              {/* STEP 5: テスト発信 */}
              <div className="rounded-2xl p-5 mb-4" style={{ backgroundColor: T.cardAlt }}>
                <div className="flex items-center gap-3 mb-4">
                  <div style={stepNumStyle("#c45555")}>5</div>
                  <div>
                    <h3 className="text-[14px] font-medium" style={{ color: T.text }}>動作テスト</h3>
                    <p className="text-[11px]" style={{ color: T.textMuted }}>実際に電話を受けて動作確認</p>
                  </div>
                </div>
                <div className="space-y-2 pl-11">
                  <div className="p-3 rounded-xl" style={{ backgroundColor: T.card }}>
                    <p className="text-[12px]" style={{ color: T.textSub }}>
                      <span style={{ color: "#c45555", fontWeight: 600 }}>①</span> <strong style={{ color: T.text }}>未登録番号</strong>から自分のiPhoneに発信してもらう
                    </p>
                  </div>
                  <div className="p-3 rounded-xl" style={{ backgroundColor: T.card }}>
                    <p className="text-[12px] mb-2" style={{ color: T.textSub }}>
                      <span style={{ color: "#c45555", fontWeight: 600 }}>②</span> Bridge コンソールに着信ログが流れる:
                    </p>
                    <code className="text-[10px] block px-3 py-2 rounded-lg" style={{ backgroundColor: T.bg, color: "#4a7c59" }}>
                      📞 着信検出: phone=08012345678<br />
                      ✅ 送信成功: 08012345678
                    </code>
                  </div>
                  <div className="p-3 rounded-xl" style={{ backgroundColor: T.card }}>
                    <p className="text-[12px]" style={{ color: T.textSub }}>
                      <span style={{ color: "#c45555", fontWeight: 600 }}>③</span> T-MANAGE のタブに切り替え → 画面右下に<strong style={{ color: T.text }}>📱 iPhone Beta バッジ付きポップアップ</strong>が出れば成功
                    </p>
                  </div>
                  <div className="p-3 rounded-xl" style={{ backgroundColor: "rgba(74,124,89,0.08)", border: "1px solid rgba(74,124,89,0.3)" }}>
                    <p className="text-[12px]" style={{ color: T.textSub }}>
                      <span style={{ color: "#4a7c59", fontWeight: 600 }}>🎯 ダッシュボードで統計確認</span>
                    </p>
                    <a
                      href="/cti-monitor"
                      className="inline-block mt-2 px-4 py-2 rounded-lg text-[11px] cursor-pointer"
                      style={{ backgroundColor: "#4a7c59", color: "#fff", fontWeight: 600, textDecoration: "none" }}
                    >
                      📞 CTI監視ページを開く
                    </a>
                  </div>
                </div>
              </div>

              {/* STEP 6: 自動起動 */}
              <div className="rounded-2xl p-5 mb-5" style={{ backgroundColor: T.cardAlt }}>
                <div className="flex items-center gap-3 mb-4">
                  <div style={stepNumStyle("#a855f7")}>6</div>
                  <div>
                    <h3 className="text-[14px] font-medium" style={{ color: T.text }}>PC起動時に自動実行 (推奨)</h3>
                    <p className="text-[11px]" style={{ color: T.textMuted }}>毎回手動で起動しなくて済む</p>
                  </div>
                </div>
                <div className="space-y-2 pl-11">
                  <div className="p-3 rounded-xl" style={{ backgroundColor: T.card }}>
                    <p className="text-[12px]" style={{ color: T.textSub }}>
                      <span style={{ color: "#a855f7", fontWeight: 600 }}>①</span> <strong style={{ color: T.text }}>register-startup.bat</strong> をダブルクリック
                    </p>
                  </div>
                  <div className="p-3 rounded-xl" style={{ backgroundColor: T.card }}>
                    <p className="text-[12px]" style={{ color: T.textSub }}>
                      <span style={{ color: "#a855f7", fontWeight: 600 }}>②</span> 次回 Windows 起動時から Bridge が自動実行されます
                    </p>
                  </div>
                </div>
              </div>

              {/* トラブルシューティング */}
              <div className="rounded-2xl p-5 mb-5" style={{ backgroundColor: T.cardAlt }}>
                <h3 className="text-[13px] font-medium mb-3" style={{ color: T.text }}>❓ iPhone Beta版 よくあるトラブル</h3>
                <div className="space-y-2">
                  {[
                    { q: "Bridgeは起動してるけど反応しない", a: "Phone LinkとiPhoneの接続が切れている可能性。Windowsの「スマートフォン連携」アプリを開いて接続状態を確認してください。" },
                    { q: "名前で表示されて番号が取れない", a: "iPhoneの連絡先にその番号が登録されているためです。業務用iPhoneなら連絡先を入れない運用を推奨します。" },
                    { q: "「winsdk」のインストールに失敗する", a: "Python 3.9以前を使っている可能性。Python 3.10以降に更新してください (python --version で確認)。" },
                    { q: "通知アクセス許可ダイアログが出ない", a: "Windows設定 → プライバシーとセキュリティ → 通知 → 「アプリや他の送信者からの通知を取得」をオンにしてください。" },
                    { q: "Supabase送信エラー HTTP 401", a: ".envのSUPABASE_ANON_KEYが間違っています。Supabase DashboardのAPI設定から正しい値をコピーしてください。" },
                    { q: "集中モード中はどうなる？", a: "Windowsの集中モードがオンの間は通知が届かないため、Bridgeも反応しません。営業時間中は集中モードをオフにしてください。" },
                  ].map((faq, i) => (
                    <details key={i} className="rounded-xl" style={{ backgroundColor: T.card }}>
                      <summary className="px-4 py-3 text-[12px] cursor-pointer" style={{ color: T.text }}>{faq.q}</summary>
                      <div className="px-4 pb-3 text-[11px] whitespace-pre-wrap" style={{ color: T.textSub }}>{faq.a}</div>
                    </details>
                  ))}
                </div>
              </div>

              {/* 有料版導線 */}
              <div
                className="rounded-2xl p-5"
                style={{
                  backgroundColor: "rgba(195,167,130,0.08)",
                  border: "1px solid rgba(195,167,130,0.3)",
                }}
              >
                <h3 className="text-[13px] font-medium mb-3" style={{ color: T.text }}>
                  🚀 100% の検出率が必要な方へ: Twilio 連携版 (有料)
                </h3>
                <p className="text-[12px] mb-3 leading-relaxed" style={{ color: T.textSub }}>
                  iPhone Beta版は無料ですが、Phone Link接続状態や連絡先登録の影響で検出漏れが発生します。
                  業務クリティカルな用途には、<strong style={{ color: T.text }}>Twilio連携版</strong>がおすすめです。
                </p>
                <div className="grid grid-cols-2 gap-3 text-[11px]" style={{ color: T.textSub }}>
                  <div className="p-3 rounded-xl" style={{ backgroundColor: T.card }}>
                    <div style={{ color: "#4a7c59", fontWeight: 600, marginBottom: 4 }}>☁ クラウド完結</div>
                    PC/スマホの状態に依存しない
                  </div>
                  <div className="p-3 rounded-xl" style={{ backgroundColor: T.card }}>
                    <div style={{ color: "#4a7c59", fontWeight: 600, marginBottom: 4 }}>🎯 100%検出</div>
                    Webhook方式で着信漏れゼロ
                  </div>
                  <div className="p-3 rounded-xl" style={{ backgroundColor: T.card }}>
                    <div style={{ color: "#4a7c59", fontWeight: 600, marginBottom: 4 }}>📞 業務専用番号</div>
                    050番号を取得して転送運用
                  </div>
                  <div className="p-3 rounded-xl" style={{ backgroundColor: T.card }}>
                    <div style={{ color: "#4a7c59", fontWeight: 600, marginBottom: 4 }}>🎙 通話録音</div>
                    履歴と音声をT-MANAGEに保存 (オプション)
                  </div>
                </div>
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
                  <span className="px-3 py-1.5 rounded-lg" style={{ backgroundColor: "#06C75518", color: "#06C755" }}>🚀 お客様LINE自動入力</span>
                  <span style={{ color: T.textMuted }}>or</span>
                  <span className="px-3 py-1.5 rounded-lg" style={{ backgroundColor: "#85a8c418", color: "#85a8c4" }}>🚀 セラピストLINE自動入力</span>
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
                    お客様LINE / セラピストLINE<br/>
                    設定URLで自動判別して入力
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

            {/* STEP 0: LINE URL設定 */}
            <div className="rounded-2xl p-6" style={cardStyle}>
              <h3 className="text-[14px] font-medium mb-3" style={{ color: T.text }}>🔗 LINE Business Chat URL設定</h3>
              <p className="text-[11px] mb-4" style={{ color: T.textSub }}>LINE Business Chatの管理画面URLを設定してください。自動入力ボタン押下時にこのURLが開きます。</p>
              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] mb-1" style={{ color: T.textSub }}>💬 お客様用LINE URL</label>
                  <input type="text" value={lineUrlCustomer} onChange={e => setLineUrlCustomer(e.target.value)} placeholder="https://chat.line.biz/U..." className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={{ backgroundColor: T.cardAlt, color: T.text, border: `1px solid ${T.border}` }} />
                </div>
                <div>
                  <label className="block text-[11px] mb-1" style={{ color: T.textSub }}>💼 セラピスト用LINE URL</label>
                  <input type="text" value={lineUrlStaff} onChange={e => setLineUrlStaff(e.target.value)} placeholder="https://chat.line.biz/U..." className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={{ backgroundColor: T.cardAlt, color: T.text, border: `1px solid ${T.border}` }} />
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={saveLineUrls} disabled={lineSaving} className="px-5 py-2.5 text-[12px] rounded-xl cursor-pointer text-white font-medium disabled:opacity-50" style={{ background: "linear-gradient(135deg, #c3a782, #b09672)" }}>{lineSaving ? "保存中..." : "💾 保存"}</button>
                  {lineMsg && <span className="text-[11px]" style={{ color: "#4a7c59" }}>✅ {lineMsg}</span>}
                </div>
                <p className="text-[9px]" style={{ color: T.textFaint }}>※ LINE Business Chat → 管理画面のURLをそのままコピーして貼り付けてください</p>
              </div>
            </div>

            {/* STEP 1: インストール */}
            <div className="rounded-2xl p-6" style={cardStyle}>
              <div className="flex items-center gap-3 mb-5">
                <div style={stepNumStyle("#3d6b9f")}>1</div>
                <div>
                  <h3 className="text-[14px] font-medium" style={{ color: T.text }}>拡張機能をChromeにインストール</h3>
                  <p className="text-[11px]" style={{ color: T.textMuted }}>GitHubからダウンロード → 開発者モードで読み込み</p>
                </div>
              </div>
              <div className="space-y-3 pl-11">
                <div className="p-3 rounded-xl" style={{ backgroundColor: T.cardAlt }}>
                  <p className="text-[12px] font-medium mb-2" style={{ color: T.text }}>📥 ファイルのダウンロード</p>
                  <div className="space-y-2 text-[12px]" style={{ color: T.textSub }}>
                    <p>
                      <span style={{ color: "#c3a782", fontWeight: 600 }}>①</span> T-MANAGEのGitHubリポジトリからダウンロード：
                    </p>
                    <a href="https://github.com/angespa0510-ux/t-manage/tree/main/chrome-extension" target="_blank" rel="noopener noreferrer"
                      className="block px-3 py-2 rounded-lg text-[11px]" style={{ backgroundColor: T.bg, color: "#c3a782", textDecoration: "underline" }}>
                      📂 chrome-extension フォルダを開く（GitHub）
                    </a>
                    <p className="text-[11px]" style={{ color: T.textMuted }}>
                      または、リポジトリ全体をZIPダウンロード → 解凍 → <code style={{ color: "#c3a782" }}>chrome-extension</code> フォルダを使用
                    </p>
                  </div>
                </div>
                <div className="p-3 rounded-xl" style={{ backgroundColor: T.cardAlt }}>
                  <p className="text-[12px] font-medium mb-2" style={{ color: T.text }}>⚙️ Chromeにインストール</p>
                  <div className="space-y-2 text-[12px]" style={{ color: T.textSub }}>
                    <p>
                      <span style={{ color: "#c3a782", fontWeight: 600 }}>②</span> Chromeのアドレスバーに入力：
                    </p>
                    <code className="text-[11px] block px-3 py-2 rounded-lg" style={{ backgroundColor: T.bg, color: "#c3a782" }}>
                      chrome://extensions
                    </code>
                    <p>
                      <span style={{ color: "#c3a782", fontWeight: 600 }}>③</span> 右上の「<span style={{ fontWeight: 600 }}>デベロッパーモード</span>」を <span style={{ color: "#4a7c59", fontWeight: 600 }}>ON</span> にする
                    </p>
                    <p>
                      <span style={{ color: "#c3a782", fontWeight: 600 }}>④</span> 「<span style={{ fontWeight: 600 }}>パッケージ化されていない拡張機能を読み込む</span>」をクリック
                    </p>
                    <p>
                      <span style={{ color: "#c3a782", fontWeight: 600 }}>⑤</span> ダウンロードした <code style={{ color: "#c3a782" }}>chrome-extension</code> フォルダを選択
                    </p>
                  </div>
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
                    <p><span style={{ color: "#c3a782", fontWeight: 600 }}>①</span> T-MANAGEの通知ポップアップを表示</p>
                    <p><span style={{ color: "#c3a782", fontWeight: 600 }}>②</span> 「🚀 お客様LINE自動入力」または「🚀 セラピストLINE自動入力」をクリック</p>
                    <p><span style={{ color: "#c3a782", fontWeight: 600 }}>③</span> 正しいLINEタブが自動で開き、名前を検索 → チャットを開く</p>
                    <p><span style={{ color: "#c3a782", fontWeight: 600 }}>④</span> メッセージが自動で入力される → 内容確認して送信！</p>
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

            {/* LINEアカウント自動判別 */}
            <div className="rounded-2xl p-6" style={cardStyle}>
              <div className="flex items-center gap-3 mb-5">
                <div style={stepNumStyle("#06C755")}>i</div>
                <div>
                  <h3 className="text-[14px] font-medium" style={{ color: T.text }}>LINEアカウント自動判別</h3>
                  <p className="text-[11px]" style={{ color: T.textMuted }}>URLで確実に識別</p>
                </div>
              </div>
              <div className="space-y-3 pl-11">
                <div className="p-3 rounded-xl" style={{ backgroundColor: T.cardAlt }}>
                  <p className="text-[12px]" style={{ color: T.textSub }}>
                    上記で設定した<span style={{ fontWeight: 600 }}>URLのアカウントID</span>（U...の部分）で、お客様用とセラピスト用を自動判別します。
                  </p>
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center gap-3 text-[11px]">
                      <span className="px-2 py-1 rounded-lg" style={{ backgroundColor: "#c3a78218", color: "#c3a782" }}>お客様用URL</span>
                      <span style={{ color: T.textMuted }}>→ お客様向けメッセージ用LINEタブを開く</span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px]">
                      <span className="px-2 py-1 rounded-lg" style={{ backgroundColor: "#85a8c418", color: "#85a8c4" }}>セラピスト用URL</span>
                      <span style={{ color: T.textMuted }}>→ セラピスト向けメッセージ用LINEタブを開く</span>
                    </div>
                  </div>
                  <p className="text-[10px] mt-3" style={{ color: T.textMuted }}>
                    ※ アカウント名に関係なくURLで判別するため、別店舗のLINEアカウントでもURLを設定するだけで使えます
                  </p>
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

            {/* ===== Edge SMS② 拡張機能 ===== */}
            <div className="rounded-2xl p-6" style={cardStyle}>
              <div className="flex items-center gap-3 mb-5">
                <div style={stepNumStyle("#8b5cf6")}>3</div>
                <div>
                  <h3 className="text-[14px] font-medium" style={{ color: T.text }}>📲 Edge SMS② 拡張機能（Googleメッセージ自動入力）</h3>
                  <p className="text-[11px]" style={{ color: T.textMuted }}>SMS②ボタンからGoogleメッセージへ自動入力</p>
                </div>
              </div>

              {/* 概要 */}
              <div className="pl-11 space-y-3">
                <div className="p-4 rounded-xl" style={{ backgroundColor: "#8b5cf608", border: "1px solid #8b5cf622" }}>
                  <p className="text-[12px]" style={{ color: T.textSub }}>
                    タイムチャートの「<span style={{ color: "#8b5cf6", fontWeight: 600 }}>📲 SMS②Edge</span>」ボタンを押すと、
                    Edgeが自動で起動 → Googleメッセージで電話番号検索 → メッセージ本文入力まで全自動で行います。
                    送信ボタンを押すだけ！
                  </p>
                  <div className="mt-3 flex items-center gap-2 text-[11px] flex-wrap" style={{ color: T.textMuted }}>
                    <span className="px-2 py-1 rounded-lg" style={{ backgroundColor: "#8b5cf618", color: "#8b5cf6" }}>📲 SMS②Edge</span>
                    <span>→</span>
                    <span className="px-2 py-1 rounded-lg" style={{ backgroundColor: "#f59e0b18", color: "#f59e0b" }}>🔍 電話番号検索</span>
                    <span>→</span>
                    <span className="px-2 py-1 rounded-lg" style={{ backgroundColor: "#22c55e18", color: "#22c55e" }}>📝 メッセージ入力</span>
                    <span>→</span>
                    <span className="px-2 py-1 rounded-lg" style={{ backgroundColor: "#3b82f618", color: "#3b82f6" }}>📩 送信ボタンを押すだけ</span>
                  </div>
                </div>

                {/* ダウンロード */}
                <div className="p-3 rounded-xl" style={{ backgroundColor: T.cardAlt }}>
                  <p className="text-[12px] font-medium mb-2" style={{ color: T.text }}>📥 ファイルのダウンロード</p>
                  <div className="space-y-2 text-[12px]" style={{ color: T.textSub }}>
                    <p>
                      <span style={{ color: "#c3a782", fontWeight: 600 }}>①</span> T-MANAGEのGitHubリポジトリからダウンロード：
                    </p>
                    <a href="https://github.com/angespa0510-ux/t-manage/tree/main/edge-extension-sms" target="_blank" rel="noopener noreferrer"
                      className="block px-3 py-2 rounded-lg text-[11px]" style={{ backgroundColor: T.bg, color: "#8b5cf6", textDecoration: "underline" }}>
                      📂 edge-extension-sms フォルダを開く（GitHub）
                    </a>
                    <p className="text-[11px]" style={{ color: T.textMuted }}>
                      または、リポジトリ全体をZIPダウンロード → 解凍 → <code style={{ color: "#c3a782" }}>edge-extension-sms</code> フォルダを使用
                    </p>
                  </div>
                </div>

                {/* インストール手順 */}
                <div className="p-3 rounded-xl" style={{ backgroundColor: T.cardAlt }}>
                  <p className="text-[12px] font-medium mb-2" style={{ color: T.text }}>⚙️ Edgeにインストール</p>
                  <div className="space-y-2 text-[12px]" style={{ color: T.textSub }}>
                    <p>
                      <span style={{ color: "#c3a782", fontWeight: 600 }}>①</span> Edgeのアドレスバーに入力：
                    </p>
                    <code className="text-[11px] block px-3 py-2 rounded-lg" style={{ backgroundColor: T.bg, color: "#c3a782" }}>
                      edge://extensions
                    </code>
                    <p>
                      <span style={{ color: "#c3a782", fontWeight: 600 }}>②</span> 左下の「<span style={{ fontWeight: 600 }}>開発者モード</span>」を <span style={{ color: "#4a7c59", fontWeight: 600 }}>ON</span> にする
                    </p>
                    <p>
                      <span style={{ color: "#c3a782", fontWeight: 600 }}>③</span> 「<span style={{ fontWeight: 600 }}>展開して読み込み</span>」をクリック
                    </p>
                    <p>
                      <span style={{ color: "#c3a782", fontWeight: 600 }}>④</span> ダウンロードした <code style={{ color: "#c3a782" }}>edge-extension-sms</code> フォルダを選択
                    </p>
                  </div>
                </div>

                {/* 確認 */}
                <div className="p-3 rounded-xl" style={{ backgroundColor: "#4a7c5908", border: "1px solid #4a7c5922" }}>
                  <p className="text-[12px]" style={{ color: "#4a7c59" }}>
                    ✅ 「T-MANAGE SMS② 自動入力」が拡張機能一覧に表示されればOK！
                  </p>
                </div>

                {/* 初回設定 */}
                <div className="p-3 rounded-xl" style={{ backgroundColor: T.cardAlt }}>
                  <p className="text-[12px] font-medium mb-2" style={{ color: T.text }}>🔧 初回のみ：ダイアログ省略設定</p>
                  <div className="space-y-1 text-[12px]" style={{ color: T.textSub }}>
                    <p>
                      初回のSMS②ボタン押下時に「Microsoft Edgeを開きますか？」ダイアログが表示されます。
                    </p>
                    <p>
                      ✅ 「<span style={{ fontWeight: 600, color: T.text }}>t-manage.vercel.app でのこのタイプのリンクは常に関連付けられたアプリで開く</span>」にチェック → 「Microsoft Edgeを開く」
                    </p>
                    <p className="text-[10px]" style={{ color: T.textMuted }}>
                      ※ 以降はダイアログなしで即Edge起動になります
                    </p>
                  </div>
                </div>

                {/* 使い方 */}
                <div className="p-3 rounded-xl" style={{ backgroundColor: T.cardAlt }}>
                  <p className="text-[12px] font-medium mb-2" style={{ color: T.text }}>📲 使い方</p>
                  <div className="space-y-2 text-[12px]" style={{ color: T.textSub }}>
                    <p><span style={{ color: "#c3a782", fontWeight: 600 }}>①</span> タイムチャートの通知ポップアップで「<span style={{ color: "#8b5cf6", fontWeight: 600 }}>📲 SMS②Edge</span>」をクリック</p>
                    <p><span style={{ color: "#c3a782", fontWeight: 600 }}>②</span> Edgeが起動 → Googleメッセージが自動で開く</p>
                    <p><span style={{ color: "#c3a782", fontWeight: 600 }}>③</span> 電話番号検索 → 宛先選択 → メッセージ入力 が全自動</p>
                    <p><span style={{ color: "#c3a782", fontWeight: 600 }}>④</span> 内容を確認して<span style={{ fontWeight: 600 }}>送信ボタンを押すだけ！</span></p>
                  </div>
                </div>

                {/* 更新方法 */}
                <div className="p-3 rounded-xl" style={{ backgroundColor: T.cardAlt }}>
                  <p className="text-[12px] font-medium mb-2" style={{ color: T.text }}>🔄 拡張機能の更新方法</p>
                  <div className="space-y-1 text-[12px]" style={{ color: T.textSub }}>
                    <p><span style={{ color: "#c3a782", fontWeight: 600 }}>①</span> GitHubから最新の <code style={{ color: "#c3a782" }}>edge-extension-sms</code> フォルダをダウンロード</p>
                    <p><span style={{ color: "#c3a782", fontWeight: 600 }}>②</span> 既存のフォルダを上書き</p>
                    <p><span style={{ color: "#c3a782", fontWeight: 600 }}>③</span> <code style={{ color: "#c3a782" }}>edge://extensions</code> → 拡張機能の 🔄 リロードボタンをクリック</p>
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
                  { q: "SMS②でGoogleメッセージが開かない", a: "Edge拡張が有効になっているか確認してください。edge://extensions で「T-MANAGE SMS② 自動入力」がONになっているか確認してください。" },
                  { q: "SMS②で検索はされるがメッセージが入力されない", a: "edge://extensions で拡張機能の🔄リロードボタンを押してから再度試してください。Googleメッセージの画面が変わった場合はフォルダの更新が必要です。" },
                  { q: "「Microsoft Edgeを開きますか？」が毎回出る", a: "ダイアログの「t-manage.vercel.app でのこのタイプのリンクは常に関連付けられたアプリで開く」にチェックを入れてから「Microsoft Edgeを開く」をクリックしてください。" },
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

        {/* ===== AI動画生成 タブ ===== */}
        {tab === "video" && (
          <div className="space-y-6">
            {/* 概要 */}
            <div className="rounded-2xl p-6" style={cardStyle}>
              <h2 className="text-[16px] font-medium mb-3" style={{ color: T.text }}>🎥 AI動画生成システム</h2>
              <p className="text-[13px] leading-relaxed" style={{ color: T.textSub }}>
                セラピストの写真をGeminiで動画に自動変換するシステムです。ローカルPCで動作します。
              </p>
              <div className="mt-4 p-4 rounded-xl" style={{ backgroundColor: T.cardAlt }}>
                <div className="flex items-center gap-3 text-[11px] flex-wrap" style={{ color: T.textSub }}>
                  <span className="px-2 py-1.5 rounded-lg" style={{ backgroundColor: "#c3a78218", color: "#c3a782" }}>📸 写真アップロード</span>
                  <span style={{ color: T.textMuted }}>→</span>
                  <span className="px-2 py-1.5 rounded-lg" style={{ backgroundColor: "#8b5cf618", color: "#8b5cf6" }}>🤖 Gemini自動生成</span>
                  <span style={{ color: T.textMuted }}>→</span>
                  <span className="px-2 py-1.5 rounded-lg" style={{ backgroundColor: "#22c55e18", color: "#22c55e" }}>📁 Googleドライブ保存</span>
                  <span style={{ color: T.textMuted }}>→</span>
                  <span className="px-2 py-1.5 rounded-lg" style={{ backgroundColor: "#3b82f618", color: "#3b82f6" }}>📧 メール通知</span>
                </div>
              </div>
            </div>

            {/* GitHubダウンロード */}
            <div className="rounded-2xl p-6" style={cardStyle}>
              <div className="flex items-center gap-3 mb-5">
                <div style={stepNumStyle("#8b5cf6")}>1</div>
                <div>
                  <h3 className="text-[14px] font-medium" style={{ color: T.text }}>GitHubからダウンロード</h3>
                  <p className="text-[11px]" style={{ color: T.textMuted }}>video-automation フォルダを取得</p>
                </div>
              </div>
              <div className="space-y-3 pl-11">
                <a href="https://github.com/angespa0510-ux/t-manage/tree/main/video-automation" target="_blank" rel="noopener noreferrer"
                  className="block p-3 rounded-xl text-[12px]" style={{ backgroundColor: T.cardAlt, color: "#8b5cf6", textDecoration: "underline" }}>
                  📂 video-automation フォルダを開く（GitHub）
                </a>
                <p className="text-[11px]" style={{ color: T.textMuted }}>
                  リポジトリ全体をZIPダウンロード → 解凍 → <code style={{ color: "#c3a782" }}>video-automation</code> フォルダを使用
                </p>
              </div>
            </div>

            {/* セットアップガイドへのリンク */}
            <div className="rounded-2xl p-6" style={cardStyle}>
              <div className="flex items-center gap-3 mb-5">
                <div style={stepNumStyle("#4a7c59")}>2</div>
                <div>
                  <h3 className="text-[14px] font-medium" style={{ color: T.text }}>セットアップ手順</h3>
                  <p className="text-[11px]" style={{ color: T.textMuted }}>AI動画生成ページに詳しいガイドがあります</p>
                </div>
              </div>
              <div className="space-y-3 pl-11">
                <a href="/video-generator"
                  className="block p-4 rounded-xl text-[13px] font-medium" style={{ backgroundColor: "#c3a78210", color: "#c3a782", border: "1px solid #c3a78233", textDecoration: "none" }}>
                  📖 AI動画生成ページの「ローカルPCセットアップガイド」を見る →
                </a>
                <p className="text-[11px]" style={{ color: T.textSub }}>
                  Node.js・ffmpegインストール → npm install → .env設定 → Geminiログイン → ウォッチャー起動 まで、ステップごとに解説しています。
                </p>
              </div>
            </div>

            {/* 更新方法 */}
            <div className="rounded-2xl p-6" style={cardStyle}>
              <div className="flex items-center gap-3 mb-5">
                <div style={stepNumStyle("#3d6b9f")}>3</div>
                <div>
                  <h3 className="text-[14px] font-medium" style={{ color: T.text }}>更新方法</h3>
                  <p className="text-[11px]" style={{ color: T.textMuted }}>最新版への更新</p>
                </div>
              </div>
              <div className="space-y-3 pl-11">
                <div className="p-3 rounded-xl" style={{ backgroundColor: T.cardAlt }}>
                  <p className="text-[12px] mb-2" style={{ color: T.textSub }}>git pull で最新版に更新：</p>
                  <code className="text-[11px] block px-3 py-2 rounded-lg whitespace-pre-wrap" style={{ backgroundColor: T.bg, color: "#c3a782" }}>{`cd video-automation\ngit pull`}</code>
                </div>
                <p className="text-[10px]" style={{ color: T.textMuted }}>
                  ※ .env ファイルは更新されません（店舗ごとの設定が保持されます）
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ===== リアルタイム速報 タブ ===== */}
        {tab === "sokuho" && (
          <div className="space-y-6">
            <div className="rounded-2xl p-6" style={cardStyle}>
              <h2 className="text-[16px] font-medium mb-3" style={{ color: T.text }}>📢 リアルタイム速報とは？</h2>
              <p className="text-[13px] leading-relaxed" style={{ color: T.textSub }}>
                タイムチャートの予約データから各セラピストの<span style={{ color: "#c3a782", fontWeight: 600 }}>次の案内可能時間を自動計算</span>し、
                Blueskyやエステ魂に速報として投稿する機能です。
              </p>
              <div className="mt-4 p-4 rounded-xl text-[12px] space-y-2" style={{ backgroundColor: T.cardAlt }}>
                <p style={{ color: T.text }}>🔄 <strong>自動計算</strong>: シフト・予約・インターバルから案内可能時間を算出</p>
                <p style={{ color: T.text }}>🏠 <strong>ルーム別</strong>: 三河安城・豊橋を切り替えて投稿</p>
                <p style={{ color: T.text }}>🦋 <strong>Bluesky</strong>: ワンクリックで投稿完了（URLリンク自動生成）</p>
                <p style={{ color: T.text }}>💅 <strong>エステ魂</strong>: ワンクリックで自動ログイン→フォーム入力→画像アップロード（投稿ボタンを押すだけ）</p>
                <p style={{ color: T.text }}>⠿ <strong>並び替え</strong>: ドラッグ＆ドロップでセラピストの掲載順を変更</p>
                <p style={{ color: T.text }}>🌈 <strong>絵文字切替</strong>: 🌈 / 🟧 をタップで切り替え</p>
              </div>
            </div>

            <div className="rounded-2xl p-6" style={cardStyle}>
              <div className="flex items-center gap-3 mb-5">
                <div style={stepNumStyle("#ff6b9d")}>1</div>
                <div>
                  <h3 className="text-[14px] font-medium" style={{ color: T.text }}>使い方</h3>
                  <p className="text-[11px]" style={{ color: T.textMuted }}>タイムチャートから起動</p>
                </div>
              </div>
              <div className="space-y-3 pl-11 text-[12px]" style={{ color: T.textSub }}>
                <p><span style={{ color: "#c3a782", fontWeight: 600 }}>①</span> タイムチャートの「<span style={{ color: "#ff6b9d", fontWeight: 600 }}>📢 速報</span>」ボタンをクリック</p>
                <p><span style={{ color: "#c3a782", fontWeight: 600 }}>②</span> ルーム（三河安城 / 豊橋）を選択</p>
                <p><span style={{ color: "#c3a782", fontWeight: 600 }}>③</span> セラピストの並び順・絵文字を調整（任意）</p>
                <p><span style={{ color: "#c3a782", fontWeight: 600 }}>④</span> 投稿ボタンをクリック:</p>
                <div className="ml-4 space-y-1.5 mt-1">
                  <p>🦋 <strong>Bluesky投稿</strong> → ワンクリックで投稿完了！</p>
                  <p>💅 <strong>エステ魂投稿</strong> → 自動でログイン→フォーム入力→画像アップロード→<span style={{ color: "#ec4899", fontWeight: 600 }}>投稿ボタンを押すだけ！</span></p>
                  <p>📋 <strong>テキストコピー</strong> → クリップボードにコピー（他のSNS等に貼り付け）</p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl p-6" style={cardStyle}>
              <div className="flex items-center gap-3 mb-5">
                <div style={stepNumStyle("#3b82f6")}>2</div>
                <div>
                  <h3 className="text-[14px] font-medium" style={{ color: T.text }}>Bluesky認証設定</h3>
                  <p className="text-[11px]" style={{ color: T.textMuted }}>Bluesky投稿に必要</p>
                </div>
              </div>
              <div className="space-y-4 pl-11">
                <div className="p-4 rounded-xl space-y-3" style={{ backgroundColor: T.cardAlt }}>
                  <div>
                    <label className="block text-[11px] mb-1" style={{ color: T.textMuted }}>Bluesky ID（ハンドル）</label>
                    <input type="text" value={bskyId} onChange={e => setBskyId(e.target.value)} placeholder="your-handle.bsky.social"
                      className="w-full px-3 py-2.5 rounded-xl text-[13px] outline-none" style={{ backgroundColor: T.bg, color: T.text, border: `1px solid ${T.border}` }} />
                  </div>
                  <div>
                    <label className="block text-[11px] mb-1" style={{ color: T.textMuted }}>パスワード（App Password推奨）</label>
                    <input type="password" value={bskyPw} onChange={e => setBskyPw(e.target.value)} placeholder="xxxx-xxxx-xxxx-xxxx"
                      className="w-full px-3 py-2.5 rounded-xl text-[13px] outline-none" style={{ backgroundColor: T.bg, color: T.text, border: `1px solid ${T.border}` }} />
                  </div>
                  <div className="flex items-center gap-3">
                    <button onClick={saveBskySettings} disabled={bskySaving}
                      className="px-5 py-2.5 rounded-xl text-[12px] font-medium cursor-pointer disabled:opacity-50"
                      style={{ backgroundColor: "#3b82f618", color: "#3b82f6", border: "1px solid #3b82f644" }}>
                      {bskySaving ? "保存中..." : "💾 保存"}
                    </button>
                    {bskyMsg && <span className="text-[11px]" style={{ color: "#22c55e" }}>✅ {bskyMsg}</span>}
                  </div>
                </div>
                <div className="text-[11px] space-y-1" style={{ color: T.textMuted }}>
                  <p>💡 App Passwordの作成: <a href="https://bsky.app/settings/app-passwords" target="_blank" rel="noopener noreferrer" style={{ color: "#3b82f6", textDecoration: "underline" }}>bsky.app/settings/app-passwords</a></p>
                  <p>⚠️ セキュリティのため、メインパスワードではなくApp Passwordを使用してください</p>
                </div>
              </div>
            </div>

            {/* エステ魂認証設定 */}
            <div className="rounded-2xl p-6" style={cardStyle}>
              <div className="flex items-center gap-3 mb-5">
                <div style={stepNumStyle("#ec4899")}>3</div>
                <div>
                  <h3 className="text-[14px] font-medium" style={{ color: T.text }}>エステ魂認証設定</h3>
                  <p className="text-[11px]" style={{ color: T.textMuted }}>ルームごとにアカウントを設定</p>
                </div>
              </div>
              <div className="space-y-4 pl-11">
                {/* 三河安城ルーム */}
                <div className="p-4 rounded-xl space-y-3" style={{ backgroundColor: T.cardAlt, border: `1px solid ${T.border}` }}>
                  <p className="text-[12px] font-medium" style={{ color: "#ff6b9d" }}>🏠 三河安城ルーム</p>
                  <div>
                    <label className="block text-[10px] mb-1" style={{ color: T.textMuted }}>エステ魂 ID（メールアドレス）</label>
                    <input type="text" value={estamaIdMikawa} onChange={e => setEstamaIdMikawa(e.target.value)} placeholder="info@example.com"
                      className="w-full px-3 py-2 rounded-xl text-[12px] outline-none" style={{ backgroundColor: T.bg, color: T.text, border: `1px solid ${T.border}` }} />
                  </div>
                  <div>
                    <label className="block text-[10px] mb-1" style={{ color: T.textMuted }}>パスワード</label>
                    <input type="password" value={estamaPwMikawa} onChange={e => setEstamaPwMikawa(e.target.value)} placeholder="••••••"
                      className="w-full px-3 py-2 rounded-xl text-[12px] outline-none" style={{ backgroundColor: T.bg, color: T.text, border: `1px solid ${T.border}` }} />
                  </div>
                </div>

                {/* 豊橋ルーム */}
                <div className="p-4 rounded-xl space-y-3" style={{ backgroundColor: T.cardAlt, border: `1px solid ${T.border}` }}>
                  <p className="text-[12px] font-medium" style={{ color: "#6b8bff" }}>🏠 豊橋ルーム</p>
                  <div>
                    <label className="block text-[10px] mb-1" style={{ color: T.textMuted }}>エステ魂 ID（メールアドレス）</label>
                    <input type="text" value={estamaIdToyohashi} onChange={e => setEstamaIdToyohashi(e.target.value)} placeholder="toyohashi@example.com"
                      className="w-full px-3 py-2 rounded-xl text-[12px] outline-none" style={{ backgroundColor: T.bg, color: T.text, border: `1px solid ${T.border}` }} />
                  </div>
                  <div>
                    <label className="block text-[10px] mb-1" style={{ color: T.textMuted }}>パスワード</label>
                    <input type="password" value={estamaPwToyohashi} onChange={e => setEstamaPwToyohashi(e.target.value)} placeholder="••••••"
                      className="w-full px-3 py-2 rounded-xl text-[12px] outline-none" style={{ backgroundColor: T.bg, color: T.text, border: `1px solid ${T.border}` }} />
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button onClick={saveEstamaSettings} disabled={estamaSaving}
                    className="px-5 py-2.5 rounded-xl text-[12px] font-medium cursor-pointer disabled:opacity-50"
                    style={{ backgroundColor: "#ec489918", color: "#ec4899", border: "1px solid #ec489944" }}>
                    {estamaSaving ? "保存中..." : "💾 保存"}
                  </button>
                  {estamaMsg && <span className="text-[11px]" style={{ color: "#22c55e" }}>✅ {estamaMsg}</span>}
                </div>
              </div>
            </div>

            {/* エステ魂拡張機能インストール */}
            <div className="rounded-2xl p-6" style={cardStyle}>
              <div className="flex items-center gap-3 mb-5">
                <div style={stepNumStyle("#a855f7")}>4</div>
                <div>
                  <h3 className="text-[14px] font-medium" style={{ color: T.text }}>エステ魂拡張機能（Chrome）</h3>
                  <p className="text-[11px]" style={{ color: T.textMuted }}>ワンクリック自動入力に必要</p>
                </div>
              </div>
              <div className="space-y-4 pl-11">
                <div className="p-4 rounded-xl space-y-3" style={{ backgroundColor: T.cardAlt }}>
                  <p className="text-[12px] font-medium mb-2" style={{ color: T.text }}>📥 ダウンロード</p>
                  <a href="https://github.com/angespa0510-ux/t-manage" target="_blank" rel="noopener noreferrer"
                    className="block text-center py-3 rounded-xl text-[13px] font-medium"
                    style={{ backgroundColor: "#a855f718", color: "#a855f7", border: "1px solid #a855f744", textDecoration: "none" }}>
                    📂 GitHubからZIPダウンロード → estama-extensionフォルダを使用
                  </a>
                  <p className="text-[10px]" style={{ color: T.textMuted }}>※ GitHubの「Code」→「Download ZIP」→ 解凍 → estama-extensionフォルダを取り出す</p>
                </div>

                <div className="p-4 rounded-xl space-y-3" style={{ backgroundColor: T.cardAlt }}>
                  <p className="text-[12px] font-medium mb-2" style={{ color: T.text }}>⚙️ Chromeにインストール</p>
                  <div className="space-y-2 text-[12px]" style={{ color: T.textSub }}>
                    <p><span style={{ color: "#c3a782", fontWeight: 600 }}>①</span> 上のリンクからGitHubを開き「Code」→「Download ZIP」→ 解凍</p>
                    <p><span style={{ color: "#c3a782", fontWeight: 600 }}>②</span> Chromeのアドレスバーに入力：</p>
                    <code className="block px-3 py-1.5 rounded-lg text-[11px]" style={{ backgroundColor: T.bg, color: "#c3a782" }}>chrome://extensions</code>
                    <p><span style={{ color: "#c3a782", fontWeight: 600 }}>③</span> 右上の「<span style={{ fontWeight: 600 }}>デベロッパーモード</span>」をONにする</p>
                    <p><span style={{ color: "#c3a782", fontWeight: 600 }}>④</span> 「パッケージ化されていない拡張機能を読み込む」をクリック</p>
                    <p><span style={{ color: "#c3a782", fontWeight: 600 }}>⑤</span> ダウンロードした<span style={{ fontWeight: 600 }}>estama-extension</span>フォルダを選択</p>
                  </div>
                </div>

                <div className="p-4 rounded-xl space-y-2" style={{ backgroundColor: T.cardAlt }}>
                  <p className="text-[12px] font-medium" style={{ color: T.text }}>🔄 投稿フロー（すべて自動）</p>
                  <div className="text-[11px] space-y-1" style={{ color: T.textMuted }}>
                    <p>📢 速報パネル「💅 エステ魂投稿」をクリック</p>
                    <p>→ ブリッジページ（拡張機能が自動通過）</p>
                    <p>→ 前のセッションを自動ログアウト → 正しいルームのアカウントで自動ログイン</p>
                    <p>→ blog_edit（カテゴリ・タイトル・本文・ボタン・投稿日時・<span style={{ fontWeight: 600 }}>画像3枚</span>すべて自動入力）</p>
                    <p>→ <span style={{ color: "#ec4899", fontWeight: 600 }}>投稿ボタンを押すだけ！</span></p>
                  </div>
                </div>

                <div className="text-[11px] space-y-1" style={{ color: T.textMuted }}>
                  <p>🔄 <strong>更新方法</strong>: GitHubから最新版をDL→フォルダ上書き→chrome://extensionsで「🔄」をクリック</p>
                  <p>💡 拡張機能なしでもブリッジページからタイトル/本文をコピーして手動投稿できます</p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl p-6" style={cardStyle}>
              <h3 className="text-[14px] font-medium mb-4" style={{ color: T.text }}>❓ よくある質問</h3>
              <div className="space-y-4">
                {[
                  { q: "速報パネルにセラピストが表示されない", a: "セラピストにシフトとルーム割り当てが設定されていることを確認してください。退勤済みかつ完売のセラピストは自動的に除外されます。" },
                  { q: "案内時間が実際と異なる", a: "セラピスト設定の「施術間インターバル」を確認してください。未設定の場合は15分がデフォルトです。" },
                  { q: "Bluesky投稿でエラーが出る", a: "App Passwordが正しいか確認してください。メインパスワードではなくApp Passwordの使用が必要です。" },
                  { q: "エステ魂のID/PWが未設定と表示される", a: "システム設定→速報タブのSTEP3でルームごとのID/PWを設定してください。三河安城と豊橋でアカウントが別です。" },
                  { q: "エステ魂でフォームが自動入力されない", a: "Chrome拡張機能がインストールされていることを確認してください。STEP4の手順に従ってestama-extensionをインストールしてください。" },
                  { q: "エステ魂の画像がアップロードされない", a: "セラピスト管理でセラピストの写真が登録されていることを確認してください。PNG/JPEGに対応しています。" },
                  { q: "三河安城→豊橋で同じアカウントになる", a: "拡張機能が毎回自動ログアウト→再ログインします。拡張機能を最新版に更新してください。" },
                ].map((faq, i) => (
                  <div key={i} className="p-3 rounded-xl" style={{ backgroundColor: T.cardAlt }}>
                    <p className="text-[12px] font-medium mb-1" style={{ color: T.text }}>Q. {faq.q}</p>
                    <p className="text-[11px]" style={{ color: T.textMuted }}>A. {faq.a}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ===== HP連携 タブ ===== */}
        {tab === "hp" && (
          <div className="space-y-6">
            <div className="rounded-2xl p-6" style={cardStyle}>
              <h2 className="text-[16px] font-medium mb-3" style={{ color: T.text }}>🌐 HP連携（Panda Web Concierge）とは？</h2>
              <p className="text-[13px] leading-relaxed" style={{ color: T.textSub }}>
                部屋割り管理で決定したセラピストのスケジュールを、<span style={{ color: "#7c3aed", fontWeight: 600 }}>HPの管理画面に自動で反映</span>する機能です。
                出勤時間・退勤時間・店舗の設定とお休み解除が自動で行われます。
              </p>
              <div className="mt-4 p-4 rounded-xl" style={{ backgroundColor: T.cardAlt }}>
                <div className="flex items-center gap-4 text-[12px]" style={{ color: T.textSub }}>
                  <span className="px-3 py-1.5 rounded-lg" style={{ backgroundColor: "#c3a78218", color: "#c3a782" }}>🏠 部屋割り確定</span>
                  <span style={{ color: T.textMuted }}>→</span>
                  <span className="px-3 py-1.5 rounded-lg" style={{ backgroundColor: "#7c3aed18", color: "#7c3aed" }}>🌐 HP出力ボタン</span>
                  <span style={{ color: T.textMuted }}>→</span>
                  <span className="px-3 py-1.5 rounded-lg" style={{ backgroundColor: "#22c55e18", color: "#22c55e" }}>✅ HP自動更新！</span>
                </div>
              </div>
            </div>

            {/* STEP1: HP認証設定 */}
            <div className="rounded-2xl p-6" style={cardStyle}>
              <div className="flex items-center gap-3 mb-5">
                <div style={stepNumStyle("#7c3aed")}>1</div>
                <div>
                  <h3 className="text-[14px] font-medium" style={{ color: T.text }}>HP管理画面 認証設定</h3>
                  <p className="text-[11px] mt-0.5" style={{ color: T.textMuted }}>Panda Web Concierge（ange-spa.com/pwc-admin）のログイン情報</p>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-[12px] font-medium mb-1.5 block" style={{ color: T.textSub }}>ログインID</label>
                  <input type="text" value={hpLoginId} onChange={e => setHpLoginId(e.target.value)} placeholder="HP管理画面のID" className="w-full px-4 py-3 rounded-xl text-[13px] outline-none border" style={{ backgroundColor: T.cardAlt, borderColor: T.border, color: T.text }} />
                </div>
                <div>
                  <label className="text-[12px] font-medium mb-1.5 block" style={{ color: T.textSub }}>パスワード</label>
                  <input type="password" value={hpLoginPass} onChange={e => setHpLoginPass(e.target.value)} placeholder="HP管理画面のパスワード" className="w-full px-4 py-3 rounded-xl text-[13px] outline-none border" style={{ backgroundColor: T.cardAlt, borderColor: T.border, color: T.text }} />
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={saveHpSettings} disabled={hpSaving} className="px-6 py-2.5 rounded-xl text-[13px] font-medium cursor-pointer text-white" style={{ backgroundColor: "#7c3aed" }}>
                    {hpSaving ? "保存中..." : "💾 保存"}
                  </button>
                  <button onClick={testHpLogin} disabled={hpTesting || !hpLoginId || !hpLoginPass} className="px-4 py-2.5 rounded-xl text-[13px] cursor-pointer" style={{ backgroundColor: "#7c3aed18", color: "#7c3aed", border: "1px solid #7c3aed44" }}>
                    {hpTesting ? "テスト中..." : "🔌 接続テスト"}
                  </button>
                  {hpMsg && <span className="text-[12px]" style={{ color: "#22c55e" }}>✅ {hpMsg}</span>}
                  {hpTestResult && <span className="text-[12px]" style={{ color: hpTestResult.startsWith("✅") ? "#22c55e" : "#c45555" }}>{hpTestResult}</span>}
                </div>
              </div>
            </div>

            {/* STEP2: 使い方 */}
            <div className="rounded-2xl p-6" style={cardStyle}>
              <div className="flex items-center gap-3 mb-5">
                <div style={stepNumStyle("#3b82f6")}>2</div>
                <div>
                  <h3 className="text-[14px] font-medium" style={{ color: T.text }}>使い方</h3>
                  <p className="text-[11px] mt-0.5" style={{ color: T.textMuted }}>部屋割り管理画面からHP出力</p>
                </div>
              </div>
              <div className="space-y-3 text-[12px]" style={{ color: T.textSub }}>
                <div className="p-3 rounded-xl" style={{ backgroundColor: T.cardAlt }}>
                  <p className="font-medium mb-1">① 部屋割り管理ページで「🌐 HP出力」ボタンをクリック</p>
                  <p className="text-[11px]" style={{ color: T.textMuted }}>ヘッダーの紫色のボタンです</p>
                </div>
                <div className="p-3 rounded-xl" style={{ backgroundColor: T.cardAlt }}>
                  <p className="font-medium mb-1">② 対象期間を選択</p>
                  <p className="text-[11px]" style={{ color: T.textMuted }}>今週/翌週/2週先のクイック選択、または日付ピッカーで自由選択</p>
                </div>
                <div className="p-3 rounded-xl" style={{ backgroundColor: T.cardAlt }}>
                  <p className="font-medium mb-1">③ セラピスト個別 or 一括でHP出力</p>
                  <p className="text-[11px]" style={{ color: T.textMuted }}>各セラピストの「🌐 HP出力」ボタンまたは「全員HP出力」で一括更新</p>
                </div>
              </div>
            </div>

            {/* STEP3: HP名前マッピング */}
            <div className="rounded-2xl p-6" style={cardStyle}>
              <div className="flex items-center gap-3 mb-5">
                <div style={stepNumStyle("#f59e0b")}>3</div>
                <div>
                  <h3 className="text-[14px] font-medium" style={{ color: T.text }}>HP名前マッピング</h3>
                  <p className="text-[11px] mt-0.5" style={{ color: T.textMuted }}>T-MANAGEとHP管理画面で名前が異なるセラピストの対応付け</p>
                </div>
              </div>
              <p className="text-[12px] leading-relaxed" style={{ color: T.textSub }}>
                T-MANAGE名とHP登録名が異なる場合、HP出力パネル内の「🔗 HP名前マッピング」から設定できます。
                例: T-MANAGE「静香」→ HP「しずか」
              </p>
            </div>

            {/* FAQ */}
            <div className="rounded-2xl p-6" style={cardStyle}>
              <h3 className="text-[14px] font-medium mb-4" style={{ color: T.text }}>❓ よくある質問</h3>
              <div className="space-y-4">
                {[
                  { q: "HP出力でエラーが出る", a: "STEP1の「接続テスト」でログインできるか確認してください。パスワードが変更されている可能性があります。" },
                  { q: "「HP未検出」と表示される", a: "T-MANAGEとHP管理画面で名前が異なる場合は、HP出力パネルの名前マッピングを設定してください。" },
                  { q: "お休みが解除されない", a: "HPのスケジュールページの構造が変更された可能性があります。管理者に問い合わせてください。" },
                  { q: "HPの出力先週が正しくない", a: "HPのスケジュールは水曜始まりです。対象日が正しい週に含まれているか確認してください。" },
                ].map((faq, i) => (
                  <div key={i} className="p-3 rounded-xl" style={{ backgroundColor: T.cardAlt }}>
                    <p className="text-[12px] font-medium mb-1" style={{ color: T.text }}>Q. {faq.q}</p>
                    <p className="text-[11px]" style={{ color: T.textMuted }}>A. {faq.a}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ═══════ メール送信設定 ═══════ */}
        {tab === "mail" && (
          <div className="space-y-6 animate-[fadeIn_0.3s]">
            <div className="rounded-2xl border p-6" style={cardStyle}>
              <h2 className="text-[16px] font-medium mb-1">✉️ メール送信設定</h2>
              <p className="text-[12px] mb-5" style={{ color: T.textMuted }}>パスワード再発行などのメール送信に使用するSMTP設定</p>

              <div className="rounded-xl p-4 mb-5" style={{ backgroundColor: "#3b82f610", border: "1px solid #3b82f630" }}>
                <p className="text-[11px] font-medium mb-1" style={{ color: "#3b82f6" }}>💡 Gmailを使う場合</p>
                <p className="text-[10px] leading-relaxed" style={{ color: T.textSub }}>
                  ① <a href="https://myaccount.google.com/security" target="_blank" rel="noopener noreferrer" style={{ color: "#3b82f6", textDecoration: "underline" }}>Googleアカウント セキュリティ</a> → 2段階認証を有効にする<br />
                  ② 2段階認証の設定内 →「アプリパスワード」で新しいパスワードを生成<br />
                  ③ 生成された16文字のパスワードを下の「パスワード」欄に入力<br />
                  ※ SMTPサーバーは <code>smtp.gmail.com</code>、ポートは <code>587</code> のままでOK
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>店舗名（メール送信者名）</label>
                  <input type="text" value={mailStoreName} onChange={e => setMailStoreName(e.target.value)} placeholder="チョップ" className="w-full px-4 py-3 rounded-xl text-[13px] outline-none border" style={{ backgroundColor: T.cardAlt, borderColor: T.border, color: T.text }} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>SMTPサーバー</label>
                    <input type="text" value={smtpHost} onChange={e => setSmtpHost(e.target.value)} placeholder="smtp.gmail.com" className="w-full px-4 py-3 rounded-xl text-[13px] outline-none border" style={{ backgroundColor: T.cardAlt, borderColor: T.border, color: T.text }} />
                  </div>
                  <div>
                    <label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>ポート</label>
                    <input type="text" value={smtpPort} onChange={e => setSmtpPort(e.target.value)} placeholder="587" className="w-full px-4 py-3 rounded-xl text-[13px] outline-none border" style={{ backgroundColor: T.cardAlt, borderColor: T.border, color: T.text }} />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>メールアドレス（ログインID）</label>
                  <input type="email" value={smtpUser} onChange={e => setSmtpUser(e.target.value)} placeholder="example@gmail.com" className="w-full px-4 py-3 rounded-xl text-[13px] outline-none border" style={{ backgroundColor: T.cardAlt, borderColor: T.border, color: T.text }} />
                </div>
                <div>
                  <label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>パスワード（Gmailの場合はアプリパスワード）</label>
                  <input type="password" value={smtpPass} onChange={e => setSmtpPass(e.target.value)} placeholder="アプリパスワード16文字" className="w-full px-4 py-3 rounded-xl text-[13px] outline-none border" style={{ backgroundColor: T.cardAlt, borderColor: T.border, color: T.text }} />
                </div>
                <div>
                  <label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>送信元メールアドレス（空欄の場合はログインIDと同じ）</label>
                  <input type="email" value={smtpFrom} onChange={e => setSmtpFrom(e.target.value)} placeholder="noreply@example.com" className="w-full px-4 py-3 rounded-xl text-[13px] outline-none border" style={{ backgroundColor: T.cardAlt, borderColor: T.border, color: T.text }} />
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button onClick={saveSmtpSettings} disabled={smtpSaving} className="px-6 py-3 rounded-xl text-[13px] font-medium cursor-pointer text-white disabled:opacity-60" style={{ background: "linear-gradient(135deg, #c3a782, #b09672)" }}>{smtpSaving ? "保存中..." : "💾 設定を保存"}</button>
                  {smtpMsg && <span className="text-[12px]" style={{ color: smtpMsg.includes("✅") ? "#4a7c59" : "#c45555" }}>{smtpMsg}</span>}
                </div>
              </div>
            </div>

            {/* 用途説明 */}
            <div className="rounded-2xl border p-6" style={cardStyle}>
              <h3 className="text-[14px] font-medium mb-3">📋 メール送信が使われる場面</h3>
              <div className="space-y-2">
                <div className="p-3 rounded-xl" style={{ backgroundColor: T.cardAlt }}>
                  <p className="text-[12px] font-medium mb-1">🔑 お客様パスワード再発行</p>
                  <p className="text-[10px]" style={{ color: T.textMuted }}>お客様マイページで「パスワードを忘れた方はこちら」→ 電話番号入力 → 登録メールアドレスに新パスワードを送信</p>
                </div>
                <div className="p-3 rounded-xl" style={{ backgroundColor: T.cardAlt }}>
                  <p className="text-[12px] font-medium mb-1">💆 セラピストパスワード再発行</p>
                  <p className="text-[10px]" style={{ color: T.textMuted }}>セラピストマイページで「パスワードを忘れた方はこちら」→ 電話番号入力 → 登録メールアドレスに新パスワードを送信</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===== チャットAI分析タブ ===== */}
        {tab === "chat-ai" && (
          <div className="space-y-6">
            {/* タイトル */}
            <div className="p-5 rounded-2xl" style={{ ...cardStyle, borderLeft: "3px solid #a855f7" }}>
              <h2 className="text-[16px] font-semibold mb-1" style={{ color: "#a855f7" }}>🧠 チャットAI分析 - ターミナル実行手順</h2>
              <p className="text-[12px]" style={{ color: T.textMuted, lineHeight: 1.7 }}>
                スタッフ↔セラピスト間のチャット履歴を Claude MAX プランで分析します。<br />
                API コストが<strong style={{ color: T.text }}>完全ゼロ</strong>で、毎週日曜深夜などにローカルで手動実行する運用です。
              </p>
            </div>

            {/* 3つの実行方法比較 */}
            <div className="p-5 rounded-2xl" style={cardStyle}>
              <h3 className="text-[14px] font-semibold mb-3">📊 実行方法 3パターンの比較</h3>
              <div className="space-y-2 text-[11px]" style={{ lineHeight: 1.7 }}>
                <div className="p-3 rounded-xl" style={{ backgroundColor: T.cardAlt }}>
                  <div className="font-medium mb-1">🅰️ Vercel Cron（自動）</div>
                  <div style={{ color: T.textMuted }}>
                    毎週日曜深夜3時に自動実行 / <strong style={{ color: "#c45555" }}>API 従量 $0.02〜0.10/回</strong> / Anthropic API Key 必要
                  </div>
                </div>
                <div className="p-3 rounded-xl" style={{ backgroundColor: T.cardAlt }}>
                  <div className="font-medium mb-1">🅱️ 管理画面から手動実行</div>
                  <div style={{ color: T.textMuted }}>
                    /chat-insights の「今すぐ分析」ボタン / <strong style={{ color: "#c45555" }}>API 従量</strong> / Anthropic API Key 必要
                  </div>
                </div>
                <div className="p-3 rounded-xl" style={{ backgroundColor: "#a855f718", border: "1px solid #a855f744" }}>
                  <div className="font-medium mb-1" style={{ color: "#a855f7" }}>🅲️ Claude MAX でターミナル実行 ← これ</div>
                  <div style={{ color: T.text }}>
                    MAX プラン定額内で実行 / <strong>API 費用 ゼロ</strong> / ローカルPC でコマンド実行
                  </div>
                </div>
              </div>
            </div>

            {/* 事前準備 */}
            <div className="p-5 rounded-2xl" style={cardStyle}>
              <h3 className="text-[14px] font-semibold mb-3">🔧 事前準備（初回のみ）</h3>
              <div className="space-y-3 text-[12px]" style={{ lineHeight: 1.8 }}>
                <div>
                  <p className="mb-1 font-medium">① Node.js のインストール</p>
                  <p className="text-[11px]" style={{ color: T.textMuted }}>
                    <a href="https://nodejs.org/" target="_blank" rel="noopener noreferrer" style={{ color: "#c3a782", textDecoration: "underline" }}>nodejs.org</a> から
                    LTS 版をダウンロードしてインストール（一度だけ）
                  </p>
                </div>
                <div>
                  <p className="mb-1 font-medium">② T-MANAGE リポジトリをクローン</p>
                  <pre className="p-2 rounded text-[10px] font-mono overflow-x-auto" style={{ backgroundColor: T.cardAlt, color: T.text }}>
{`git clone https://github.com/angespa0510-ux/t-manage.git
cd t-manage/scripts/chat-insights
npm install`}
                  </pre>
                </div>
                <div>
                  <p className="mb-1 font-medium">③ Supabase の接続情報を取得</p>
                  <p className="text-[11px]" style={{ color: T.textMuted }}>
                    Supabase Dashboard → プロジェクト → <strong>Settings</strong> → <strong>API</strong> から以下をコピー：
                  </p>
                  <ul className="text-[11px] mt-1 pl-4 space-y-1" style={{ color: T.textMuted }}>
                    <li>• <code style={{ backgroundColor: T.cardAlt, padding: "1px 4px", borderRadius: 3 }}>Project URL</code> （SUPABASE_URL）</li>
                    <li>• <code style={{ backgroundColor: T.cardAlt, padding: "1px 4px", borderRadius: 3 }}>service_role</code> キー（SUPABASE_SERVICE_KEY・非公開）</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* 毎週の実行手順 */}
            <div className="p-5 rounded-2xl" style={cardStyle}>
              <h3 className="text-[14px] font-semibold mb-3">📋 毎週の実行手順（4ステップ）</h3>

              {/* STEP 1 */}
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold" style={{ backgroundColor: "#a855f7", color: "#fff" }}>1</span>
                  <span className="text-[13px] font-medium">チャットログをエクスポート</span>
                </div>
                <p className="text-[11px] mb-2" style={{ color: T.textMuted }}>ターミナルを開いて：</p>
                <pre className="p-3 rounded text-[10px] font-mono overflow-x-auto" style={{ backgroundColor: T.cardAlt, color: T.text, lineHeight: 1.7 }}>
{`cd t-manage/scripts/chat-insights

# 環境変数をセット（Mac/Linux）
export SUPABASE_URL="https://cbewozzdyjqmhzkxsjqo.supabase.co"
export SUPABASE_SERVICE_KEY="eyJ..."   # service_role キー

# Windows PowerShell の場合
# $env:SUPABASE_URL="https://cbewozzdyjqmhzkxsjqo.supabase.co"
# $env:SUPABASE_SERVICE_KEY="eyJ..."

# 過去7日分をエクスポート
node export-chat-logs.mjs`}
                </pre>
                <p className="text-[11px] mt-2" style={{ color: T.textMuted }}>
                  ↓ <code style={{ backgroundColor: T.cardAlt, padding: "1px 4px", borderRadius: 3 }}>./out/</code> フォルダに 3 つのファイルが作られる
                </p>
                <ul className="text-[11px] mt-1 pl-4 space-y-1" style={{ color: T.textMuted }}>
                  <li>• <code style={{ backgroundColor: T.cardAlt, padding: "1px 4px", borderRadius: 3 }}>chat-log-xxx.txt</code>（ログ本体）</li>
                  <li>• <code style={{ backgroundColor: T.cardAlt, padding: "1px 4px", borderRadius: 3 }}>analysis-prompt.txt</code>（Claude に渡すプロンプト）</li>
                  <li>• <code style={{ backgroundColor: T.cardAlt, padding: "1px 4px", borderRadius: 3 }}>period.json</code>（期間情報）</li>
                </ul>
              </div>

              {/* STEP 2 */}
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold" style={{ backgroundColor: "#a855f7", color: "#fff" }}>2</span>
                  <span className="text-[13px] font-medium">Claude MAX にプロンプトを貼り付け</span>
                </div>
                <p className="text-[11px] mb-2" style={{ color: T.textMuted }}>
                  <code style={{ backgroundColor: T.cardAlt, padding: "1px 4px", borderRadius: 3 }}>out/analysis-prompt.txt</code> の中身を全選択コピーして、以下のどちらかに貼り付け：
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div className="p-3 rounded-xl text-[11px]" style={{ backgroundColor: T.cardAlt }}>
                    <div className="font-medium mb-1">💻 Claude Code（推奨）</div>
                    <div style={{ color: T.textMuted }}>ターミナルで <code>claude</code> コマンドを実行して貼り付け</div>
                  </div>
                  <div className="p-3 rounded-xl text-[11px]" style={{ backgroundColor: T.cardAlt }}>
                    <div className="font-medium mb-1">🌐 claude.ai（ブラウザ）</div>
                    <div style={{ color: T.textMuted }}>Claude MAX プランの Web UI に貼り付けて送信</div>
                  </div>
                </div>
              </div>

              {/* STEP 3 */}
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold" style={{ backgroundColor: "#a855f7", color: "#fff" }}>3</span>
                  <span className="text-[13px] font-medium">返ってきた JSON を保存</span>
                </div>
                <p className="text-[11px] mb-2" style={{ color: T.textMuted }}>
                  Claude が返した JSON ブロック（<code>{'{'} "insights": [...] {'}'}</code>）をコピーして、
                </p>
                <pre className="p-3 rounded text-[10px] font-mono" style={{ backgroundColor: T.cardAlt, color: T.text }}>
{`out/analysis-result.json  ← このファイルとして保存`}
                </pre>
                <p className="text-[11px] mt-2" style={{ color: "#f59e0b" }}>
                  💡 <code>```json</code> の装飾が混ざっていてもOK（CLI で自動除去されます）
                </p>
              </div>

              {/* STEP 4 */}
              <div className="mb-2">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold" style={{ backgroundColor: "#a855f7", color: "#fff" }}>4</span>
                  <span className="text-[13px] font-medium">Supabase に取り込み</span>
                </div>
                <pre className="p-3 rounded text-[10px] font-mono overflow-x-auto" style={{ backgroundColor: T.cardAlt, color: T.text }}>
{`node import-chat-insights.mjs`}
                </pre>
                <p className="text-[11px] mt-2" style={{ color: T.textMuted }}>
                  完了すると <code style={{ backgroundColor: T.cardAlt, padding: "1px 4px", borderRadius: 3 }}>chat_insights</code> テーブルに保存され、
                  <a href="/chat-insights" style={{ color: "#c3a782", textDecoration: "underline", marginLeft: 4 }}>/chat-insights ページ</a>で閲覧可能になります。
                </p>
              </div>
            </div>

            {/* よくある質問 */}
            <div className="p-5 rounded-2xl" style={cardStyle}>
              <h3 className="text-[14px] font-semibold mb-3">❓ よくある質問</h3>
              <div className="space-y-3 text-[12px]" style={{ lineHeight: 1.7 }}>
                <div className="p-3 rounded-xl" style={{ backgroundColor: T.cardAlt }}>
                  <p className="font-medium mb-1">Q. 期間を変えたい</p>
                  <p className="text-[11px]" style={{ color: T.textMuted }}>
                    <code>node export-chat-logs.mjs 14</code> のように日数を指定（過去14日分）
                  </p>
                </div>
                <div className="p-3 rounded-xl" style={{ backgroundColor: T.cardAlt }}>
                  <p className="font-medium mb-1">Q. 毎週手動実行するのは面倒</p>
                  <p className="text-[11px]" style={{ color: T.textMuted }}>
                    将来的には、月初に 1 回だけ「先月分」を分析する運用もおすすめ。
                    API 無料なので分析回数の制限なし。
                  </p>
                </div>
                <div className="p-3 rounded-xl" style={{ backgroundColor: T.cardAlt }}>
                  <p className="font-medium mb-1">Q. JSON パースエラーが出る</p>
                  <p className="text-[11px]" style={{ color: T.textMuted }}>
                    Claude の出力に説明文が混ざると失敗することがあります。
                    <strong>{'{ "insights": [...] }'}</strong> の JSON ブロックだけ抜き出して保存してください。
                  </p>
                </div>
                <div className="p-3 rounded-xl" style={{ backgroundColor: T.cardAlt }}>
                  <p className="font-medium mb-1">Q. <code>scope_id が null です</code> という警告</p>
                  <p className="text-[11px]" style={{ color: T.textMuted }}>
                    Claude が出したスタッフ名・セラピスト名が DB と一致しない場合。表示には影響ないが、
                    フィルタ精度のため名前を揃えると良い。
                  </p>
                </div>
              </div>
            </div>

            {/* リンク */}
            <div className="p-5 rounded-2xl" style={cardStyle}>
              <h3 className="text-[14px] font-semibold mb-3">🔗 関連リンク</h3>
              <div className="space-y-2 text-[12px]">
                <div>
                  <a href="/chat-insights" style={{ color: "#c3a782", textDecoration: "underline" }}>
                    📊 /chat-insights - 分析結果閲覧ページ
                  </a>
                </div>
                <div>
                  <a href="https://github.com/angespa0510-ux/t-manage/tree/main/scripts/chat-insights" target="_blank" rel="noopener noreferrer" style={{ color: "#c3a782", textDecoration: "underline" }}>
                    📁 GitHub - scripts/chat-insights (README.md あり)
                  </a>
                </div>
                <div>
                  <a href="https://supabase.com/dashboard/project/cbewozzdyjqmhzkxsjqo/settings/api" target="_blank" rel="noopener noreferrer" style={{ color: "#c3a782", textDecoration: "underline" }}>
                    🔑 Supabase - API 設定（service_role キー取得）
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
