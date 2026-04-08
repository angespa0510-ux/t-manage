"use client";
import { useState, useEffect } from "react";
import { useTheme } from "../../lib/theme";
import { NavMenu } from "../../lib/nav-menu";
import { useRole } from "../../lib/use-role";
import { supabase } from "../../lib/supabase";

export default function WebBookingSettings() {
  const { T } = useTheme();
  const { role } = useRole();
  const [copied, setCopied] = useState("");
  const [origin, setOrigin] = useState("");
  const [storeName, setStoreName] = useState("チョップ");

  useEffect(() => {
    setOrigin(window.location.origin);
    supabase.from("store_settings").select("key,value").eq("key", "store_name").maybeSingle().then(({ data }) => {
      if (data?.value) setStoreName(data.value);
    });
  }, []);

  const publicUrl = `${origin}/public-schedule`;
  const mypageUrl = `${origin}/customer-mypage`;

  const copyUrl = (url: string, label: string) => {
    navigator.clipboard.writeText(url);
    setCopied(label);
    setTimeout(() => setCopied(""), 2000);
  };

  if (role === null) return <div style={{ minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center" }}><p style={{ color: T.textMuted }}>Loading...</p></div>;

  return (
    <div style={{ minHeight: "100vh", backgroundColor: T.bg, color: T.text }}>
      {/* Header */}
      <header className="flex items-center justify-between px-4 h-14 border-b" style={{ borderColor: T.border, backgroundColor: T.card }}>
        <div className="flex items-center gap-3">
          <NavMenu T={T} />
          <h1 className="text-[15px] font-medium">🌐 WEB予約公開ページ設定</h1>
        </div>
      </header>

      <main className="max-w-[800px] mx-auto p-4 space-y-6">

        {/* ═══ URL セクション ═══ */}
        <div className="rounded-xl border p-5" style={{ backgroundColor: T.card, borderColor: T.border }}>
          <h2 className="text-[15px] font-medium mb-4 flex items-center gap-2">🔗 公開ページURL</h2>

          <div className="space-y-4">
            {/* 公開スケジュールURL */}
            <div>
              <label className="block text-[12px] font-medium mb-2" style={{ color: T.textSub }}>📅 WEB予約ページ（お客様が予約する入口）</label>
              <div className="flex gap-2">
                <input type="text" readOnly value={publicUrl} className="flex-1 px-3 py-2.5 rounded-lg text-[13px] border outline-none" style={{ backgroundColor: T.cardAlt, borderColor: T.border, color: T.text }} />
                <button onClick={() => copyUrl(publicUrl, "schedule")} className="px-4 py-2.5 rounded-lg text-[12px] font-medium cursor-pointer border" style={{ borderColor: T.accent + "44", color: T.accent, backgroundColor: T.accent + "08" }}>
                  {copied === "schedule" ? "✅ コピー済み" : "📋 コピー"}
                </button>
              </div>
              <p className="text-[10px] mt-1.5" style={{ color: T.textMuted }}>ログイン不要でスケジュール閲覧可能 → 予約時にログイン/新規登録が必要</p>
            </div>

            {/* マイページURL */}
            <div>
              <label className="block text-[12px] font-medium mb-2" style={{ color: T.textSub }}>👤 お客様マイページ（ログイン・会員登録）</label>
              <div className="flex gap-2">
                <input type="text" readOnly value={mypageUrl} className="flex-1 px-3 py-2.5 rounded-lg text-[13px] border outline-none" style={{ backgroundColor: T.cardAlt, borderColor: T.border, color: T.text }} />
                <button onClick={() => copyUrl(mypageUrl, "mypage")} className="px-4 py-2.5 rounded-lg text-[12px] font-medium cursor-pointer border" style={{ borderColor: T.accent + "44", color: T.accent, backgroundColor: T.accent + "08" }}>
                  {copied === "mypage" ? "✅ コピー済み" : "📋 コピー"}
                </button>
              </div>
              <p className="text-[10px] mt-1.5" style={{ color: T.textMuted }}>お客様がマイページにログインして予約履歴・お気に入り等を確認できます</p>
            </div>

            {/* QRコード的なプレビューリンク */}
            <div className="flex gap-3">
              <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="flex-1 py-3 rounded-xl text-[13px] font-medium text-center no-underline" style={{ background: `linear-gradient(135deg, ${T.accent}, #a88d68)`, color: "#fff" }}>
                📱 公開ページを開く
              </a>
              <a href={mypageUrl} target="_blank" rel="noopener noreferrer" className="flex-1 py-3 rounded-xl text-[13px] font-medium text-center no-underline border" style={{ borderColor: T.accent + "44", color: T.accent }}>
                👤 マイページを開く
              </a>
            </div>
          </div>
        </div>

        {/* ═══ お客様の予約フロー図 ═══ */}
        <div className="rounded-xl border p-5" style={{ backgroundColor: T.card, borderColor: T.border }}>
          <h2 className="text-[15px] font-medium mb-4 flex items-center gap-2">📖 お客様の予約フロー（スタッフ向け説明）</h2>

          <div className="space-y-3">
            {[
              { step: "1", icon: "🌐", title: "HPの「WEB予約」をタップ", desc: "ange-spa.com のWEB予約ボタンから公開スケジュールページに移動します" },
              { step: "2", icon: "📅", title: "日付・セラピストを選ぶ", desc: "本日〜1週間の出勤セラピストが写真付きで一覧表示されます。ログイン不要で閲覧できます" },
              { step: "3", icon: "🕐", title: "空き時間を選ぶ", desc: "セラピストをタップすると空き時間（◯/✕）が15分刻みで表示されます。週間スケジュールも確認可能です" },
              { step: "4", icon: "📋", title: "コース・オプションを選ぶ", desc: "コース、延長、オプション、割引を選択し、合計金額を確認します" },
              { step: "5", icon: "🔑", title: "ログイン/新規登録", desc: "初めてのお客様は名前・メール・パスワードで新規登録。既存のお客様は電話番号で自動照合されます" },
              { step: "6", icon: "✅", title: "予約リクエスト送信", desc: "予約内容を確認して送信。ダッシュボードの「📱 WEB予約」に通知が届きます" },
              { step: "7", icon: "📬", title: "お店から確認連絡", desc: "スタッフがタイムチャートで予約を確認・確定し、お客様に確認メールを送信します" },
            ].map(item => (
              <div key={item.step} className="flex gap-3 items-start">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[14px] flex-shrink-0" style={{ background: `linear-gradient(135deg, ${T.accent}20, ${T.accent}08)`, border: `1px solid ${T.accent}25` }}>
                  <span>{item.icon}</span>
                </div>
                <div className="flex-1">
                  <p className="text-[13px] font-medium m-0">{item.title}</p>
                  <p className="text-[11px] m-0 mt-0.5" style={{ color: T.textMuted }}>{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ═══ HP会社への連携方法ガイド ═══ */}
        <div className="rounded-xl border p-5" style={{ backgroundColor: T.card, borderColor: T.border }}>
          <h2 className="text-[15px] font-medium mb-4 flex items-center gap-2">🏢 HP制作会社への依頼内容</h2>
          <p className="text-[12px] mb-4" style={{ color: T.textSub }}>以下の内容をHP制作会社（Panda Web Concierge）に伝えてください。</p>

          <div className="rounded-lg border p-4 mb-4" style={{ backgroundColor: T.cardAlt, borderColor: T.border }}>
            <p className="text-[13px] font-medium mb-3" style={{ color: T.accent }}>📧 HP制作会社への依頼テンプレート</p>
            <div className="text-[12px] leading-[1.8]" style={{ color: T.text }}>
              <p className="m-0">お世話になっております。</p>
              <p className="m-0">ange-spa.com に以下の変更をお願いいたします。</p>
              <p className="m-0 mt-3"><strong>① 「WEB予約」ボタンのリンク先変更</strong></p>
              <p className="m-0" style={{ color: T.textSub }}>現在: e-manage.info のURL</p>
              <p className="m-0" style={{ color: T.accent }}>変更後: {publicUrl || "(公開ページURL)"}</p>
              <p className="m-0 mt-3"><strong>② 「👤 マイページ」ボタンの追加</strong></p>
              <p className="m-0" style={{ color: T.accent }}>リンク先: {mypageUrl || "(マイページURL)"}</p>
              <p className="m-0" style={{ color: T.textSub }}>※ WEB予約ボタンの近くに配置をお願いします</p>
              <p className="m-0 mt-3">よろしくお願いいたします。</p>
            </div>
          </div>

          <button onClick={() => {
            const text = `お世話になっております。\nange-spa.com に以下の変更をお願いいたします。\n\n① 「WEB予約」ボタンのリンク先変更\n現在: e-manage.info のURL\n変更後: ${publicUrl}\n\n② 「👤 マイページ」ボタンの追加\nリンク先: ${mypageUrl}\n※ WEB予約ボタンの近くに配置をお願いします\n\nよろしくお願いいたします。`;
            navigator.clipboard.writeText(text);
            setCopied("template");
            setTimeout(() => setCopied(""), 2000);
          }} className="w-full py-3 rounded-xl text-[13px] font-medium cursor-pointer border" style={{ borderColor: T.accent + "44", color: T.accent, backgroundColor: T.accent + "08" }}>
            {copied === "template" ? "✅ コピー済み" : "📋 テンプレートをコピー"}
          </button>
        </div>

        {/* ═══ 注意事項 ═══ */}
        <div className="rounded-xl border p-5" style={{ backgroundColor: T.card, borderColor: T.border }}>
          <h2 className="text-[15px] font-medium mb-4 flex items-center gap-2">💡 注意事項</h2>
          <ul className="text-[12px] space-y-2 m-0 pl-4" style={{ color: T.textSub, lineHeight: 1.8 }}>
            <li>公開ページには<strong style={{ color: T.text }}>確定シフト</strong>のセラピストのみ表示されます。シフトが「仮」の場合は表示されません</li>
            <li>セラピストの写真は<strong style={{ color: T.text }}>セラピスト登録の写真URL</strong>から表示されます。未設定の場合は名前のイニシャルが表示されます</li>
            <li>WEB予約は<strong style={{ color: T.text }}>リクエスト制</strong>です。予約確定にはスタッフの確認が必要です</li>
            <li>お客様が予約すると、タイムチャートの「📱 WEB予約」ボタンに通知が表示されます</li>
            <li>新規登録時に電話番号を入力すると、既存の顧客データと自動で照合されます</li>
          </ul>
        </div>

      </main>
    </div>
  );
}
