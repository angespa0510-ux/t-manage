"use client";
import { useState, useEffect } from "react";
import { useTheme } from "../../lib/theme";
import { NavMenu } from "../../lib/nav-menu";
import { supabase } from "../../lib/supabase";

export default function WebBookingSettings() {
  const { T } = useTheme();
  const [copied, setCopied] = useState("");
  const [origin, setOrigin] = useState("");
  const [storeName, setStoreName] = useState("チョップ");
  const [cancelPhone, setCancelPhone] = useState("070-1675-5900");
  const [phoneSaving, setPhoneSaving] = useState(false);
  const [phoneMsg, setPhoneMsg] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
    supabase.from("store_settings").select("key,value").in("key", ["store_name", "cancel_phone"]).then(({ data }) => {
      if (data) {
        for (const s of data) {
          if (s.key === "store_name") setStoreName(s.value);
          if (s.key === "cancel_phone") setCancelPhone(s.value);
        }
      }
    });
  }, []);

  const savePhone = async () => {
    setPhoneSaving(true); setPhoneMsg("");
    await supabase.from("store_settings").upsert({ key: "cancel_phone", value: cancelPhone.trim() }, { onConflict: "key" });
    setPhoneSaving(false); setPhoneMsg("✅ 保存しました");
    setTimeout(() => setPhoneMsg(""), 2000);
  };

  const publicUrl = `${origin}/public-schedule`;
  const mypageUrl = `${origin}/customer-mypage`;

  const copyUrl = (url: string, label: string) => {
    navigator.clipboard.writeText(url);
    setCopied(label);
    setTimeout(() => setCopied(""), 2000);
  };

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

        {/* ═══ NG表示の仕組み ═══ */}
        <div className="rounded-xl border p-5" style={{ backgroundColor: T.card, borderColor: T.border }}>
          <h2 className="text-[15px] font-medium mb-4 flex items-center gap-2">🚫 NGセラピストの表示について</h2>
          <p className="text-[12px] mb-4" style={{ color: T.textSub }}>お客様のログイン状態によって、NGセラピストの表示が異なります。</p>

          <div className="space-y-4">
            {/* ログイン前 */}
            <div className="rounded-lg border p-4" style={{ backgroundColor: T.cardAlt, borderColor: T.border }}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: "#3b82f618", color: "#3b82f6", border: "1px solid #3b82f630" }}>ログイン前</span>
                <span className="text-[13px] font-medium">全セラピストが表示されます</span>
              </div>
              <p className="text-[11px] m-0" style={{ color: T.textMuted, lineHeight: 1.8 }}>
                ログインしていない状態では、NGかどうかの判定ができないため、全ての出勤セラピストが一覧に表示されます。<br />
                ただし、予約を完了するにはログインが必要です。ログイン後にNGセラピストと判定された場合は、確認画面で<strong style={{ color: "#c45555" }}>「⚠️ このセラピストはご予約いただけません」</strong>と表示され、予約送信ボタンが無効化されます。
              </p>
            </div>

            {/* ログイン後 */}
            <div className="rounded-lg border p-4" style={{ backgroundColor: T.cardAlt, borderColor: T.border }}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: "#4a7c5918", color: "#4a7c59", border: "1px solid #4a7c5930" }}>ログイン後</span>
                <span className="text-[13px] font-medium">NGセラピストは一覧から自動で非表示</span>
              </div>
              <p className="text-[11px] m-0" style={{ color: T.textMuted, lineHeight: 1.8 }}>
                お客様がログイン済みの場合、そのお客様をNGに設定しているセラピストは<strong style={{ color: T.text }}>セラピスト一覧に表示されません</strong>。<br />
                お客様側には「NGで非表示にされている」とは伝わらず、単にそのセラピストが出勤していないように見えます。<br />
                NGデータは<strong style={{ color: T.text }}>ダッシュボードの顧客一覧 → NGタブ</strong>で管理されています。
              </p>
            </div>

            {/* 図解 */}
            <div className="rounded-lg border p-4" style={{ backgroundColor: T.cardAlt, borderColor: T.border }}>
              <p className="text-[12px] font-medium mb-2" style={{ color: T.accent }}>📊 フロー図</p>
              <div className="text-[11px]" style={{ color: T.textSub, lineHeight: 2 }}>
                <p className="m-0">お客様（未ログイン）→ 全セラピスト表示 → セラピスト選択 → コース選択</p>
                <p className="m-0">→ <strong style={{ color: T.accent }}>ログイン/新規登録</strong> → NG判定実行</p>
                <p className="m-0">→ NGの場合: <strong style={{ color: "#c45555" }}>⚠️ 警告表示 + 予約ボタン無効</strong></p>
                <p className="m-0">→ NGでない場合: ✅ 予約確認 → 送信</p>
                <p className="m-0 mt-2">お客様（ログイン済み）→ <strong style={{ color: "#4a7c59" }}>NGセラピストは最初から非表示</strong> → 問題なく予約</p>
              </div>
            </div>
          </div>
        </div>

        {/* ═══ 予約時間のルール ═══ */}
        <div className="rounded-xl border p-5" style={{ backgroundColor: T.card, borderColor: T.border }}>
          <h2 className="text-[15px] font-medium mb-4 flex items-center gap-2">⏰ 予約時間のルール</h2>

          <div className="space-y-4">
            <div className="rounded-lg border p-4" style={{ backgroundColor: T.cardAlt, borderColor: T.border }}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: "#a855f718", color: "#a855f7", border: "1px solid #a855f730" }}>30分ルール</span>
                <span className="text-[13px] font-medium">現在時刻から最速30分後の枠から予約可能</span>
              </div>
              <p className="text-[11px] m-0" style={{ color: T.textMuted, lineHeight: 1.8 }}>
                スタッフの準備時間を確保するため、お客様は<strong style={{ color: T.text }}>現在時刻から30分以内の時間帯には予約できません</strong>。<br />
                例: 現在14:20の場合 → 14:00〜14:30の枠は「✕」表示 → <strong style={{ color: T.text }}>14:45の枠から予約可能</strong>（15分刻み）
              </p>
            </div>

            <div className="rounded-lg border p-4" style={{ backgroundColor: T.cardAlt, borderColor: T.border }}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: "#c4555518", color: "#c45555", border: "1px solid #c4555530" }}>過去の時間帯</span>
                <span className="text-[13px] font-medium">現在時刻より前の枠は全て「✕」表示</span>
              </div>
              <p className="text-[11px] m-0" style={{ color: T.textMuted, lineHeight: 1.8 }}>
                本日の出勤スケジュールで、すでに過ぎた時間帯は自動的に「✕」と表示されます。<br />
                過去の日付を選択した場合も、全ての枠が「✕」になり予約はできません。
              </p>
            </div>

            <div className="rounded-lg border p-4" style={{ backgroundColor: T.cardAlt, borderColor: T.border }}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: "#c3a78218", color: "#c3a782", border: "1px solid #c3a78230" }}>インターバル</span>
                <span className="text-[13px] font-medium">施術間の休憩時間も空き枠計算に反映</span>
              </div>
              <p className="text-[11px] m-0" style={{ color: T.textMuted, lineHeight: 1.8 }}>
                セラピストごとに設定された<strong style={{ color: T.text }}>インターバル（施術間の休憩時間）</strong>も空き枠の計算に含まれます。<br />
                例: 予約が15:00〜16:00、インターバル15分の場合 → 16:00〜16:15も「✕」表示
              </p>
            </div>

            <div className="rounded-lg border p-4" style={{ backgroundColor: T.cardAlt, borderColor: T.border }}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: "#e8a83818", color: "#e8a838", border: "1px solid #e8a83830" }}>終了時刻超過</span>
                <span className="text-[13px] font-medium">出勤終了を超えるコースも予約可能（注意書き付き）</span>
              </div>
              <p className="text-[11px] m-0" style={{ color: T.textMuted, lineHeight: 1.8 }}>
                選択した開始時間＋コース時間がセラピストの出勤終了時刻を超える場合でも、<strong style={{ color: T.text }}>予約リクエスト自体は可能</strong>です。<br />
                ただしお客様には以下の注意書きが表示されます：
              </p>
              <div className="rounded-lg mt-2 p-3" style={{ backgroundColor: "rgba(232,168,56,0.06)", border: "1px solid rgba(232,168,56,0.2)" }}>
                <p className="text-[11px] m-0" style={{ color: "#e8a838", fontWeight: 600 }}>⚠ 終了時刻を超えるご予約です</p>
                <p className="text-[10px] m-0 mt-1" style={{ color: T.textMuted }}>コース内容の調整、またはご予約キャンセルをお願いする場合がございます。予めご了承ください。</p>
              </div>
              <p className="text-[11px] m-0 mt-2" style={{ color: T.textMuted, lineHeight: 1.8 }}>
                <strong style={{ color: T.text }}>具体例①:</strong> 出勤20:00まで → 19:00開始 → 60分コースはOK / 90分コースは ⚠ 注意書き表示<br />
                <strong style={{ color: T.text }}>具体例②:</strong> 出勤翌3:00まで → 2:00開始 → 60分コースはOK / 90分コースは ⚠ 注意書き表示<br />
                <strong style={{ color: T.text }}>コース選択画面:</strong> 各コースに終了時刻を表示し、超過する場合はオレンジ色の ⚠ マークを表示<br />
                <strong style={{ color: T.text }}>確認画面:</strong> 送信ボタンの上に注意書きを再表示
              </p>
            </div>
          </div>
        </div>

        {/* ═══ 電話番号設定 ═══ */}
        <div className="rounded-xl border p-5" style={{ backgroundColor: T.card, borderColor: T.border }}>
          <h2 className="text-[15px] font-medium mb-4 flex items-center gap-2">📞 キャンセル用電話番号の設定</h2>
          <p className="text-[12px] mb-4" style={{ color: T.textSub }}>お客様マイページのキャンセル案内に表示される電話番号です。タップで発信できるリンクになります。</p>

          <div className="flex gap-2 mb-3">
            <input type="tel" value={cancelPhone} onChange={e => setCancelPhone(e.target.value)} placeholder="070-1675-5900" className="flex-1 px-3 py-2.5 rounded-lg text-[14px] border outline-none" style={{ backgroundColor: T.cardAlt, borderColor: T.border, color: T.text }} />
            <button onClick={savePhone} disabled={phoneSaving} className="px-5 py-2.5 rounded-lg text-[12px] font-medium cursor-pointer text-white" style={{ background: `linear-gradient(135deg, ${T.accent}, #a88d68)`, opacity: phoneSaving ? 0.6 : 1 }}>
              {phoneSaving ? "保存中..." : "💾 保存"}
            </button>
          </div>
          {phoneMsg && <p className="text-[12px] mb-2" style={{ color: "#4a7c59" }}>{phoneMsg}</p>}
          <p className="text-[10px]" style={{ color: T.textMuted }}>※ この番号はお客様マイページの「キャンセル・変更について」モーダルに表示されます</p>
        </div>

        {/* ═══ キャンセルポリシーの仕組み ═══ */}
        <div className="rounded-xl border p-5" style={{ backgroundColor: T.card, borderColor: T.border }}>
          <h2 className="text-[15px] font-medium mb-4 flex items-center gap-2">🚫 キャンセル・変更の仕組み</h2>
          <p className="text-[12px] mb-4" style={{ color: T.textSub }}>お客様マイページでの予約キャンセルは、予約のステータスによって動作が異なります。</p>

          <div className="space-y-4">
            {/* リクエスト中 */}
            <div className="rounded-lg border p-4" style={{ backgroundColor: T.cardAlt, borderColor: T.border }}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: "#f59e0b18", color: "#b45309", border: "1px solid #f59e0b30" }}>リクエスト中</span>
                <span className="text-[13px] font-medium">お客様自身でキャンセル可能</span>
              </div>
              <p className="text-[11px] m-0" style={{ color: T.textMuted, lineHeight: 1.8 }}>
                WEB予約リクエスト後、<strong style={{ color: T.text }}>まだスタッフが概要リンクを送信していない状態</strong>では、お客様がマイページから直接キャンセルできます。<br />
                「✕ この予約をキャンセル」ボタンをタップ → 確認モーダル → キャンセル確定
              </p>
            </div>

            {/* 確定済み */}
            <div className="rounded-lg border p-4" style={{ backgroundColor: T.cardAlt, borderColor: T.border }}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: "#3d6b9f18", color: "#3d6b9f", border: "1px solid #3d6b9f30" }}>概要送信済み〜</span>
                <span className="text-[13px] font-medium">お電話での連絡を案内</span>
              </div>
              <p className="text-[11px] m-0" style={{ color: T.textMuted, lineHeight: 1.8 }}>
                スタッフが概要リンクを送信し、<strong style={{ color: T.text }}>お客様がリンクを開いた後</strong>は予約確定扱いとなります。<br />
                「📞 キャンセル・変更について」ボタンをタップすると以下のモーダルが表示されます：
              </p>
              <div className="rounded-lg mt-2 p-3" style={{ backgroundColor: "#88878008", border: `1px solid ${T.border}` }}>
                <p className="text-[12px] font-medium m-0">📞 キャンセル・変更について</p>
                <p className="text-[11px] m-0 mt-1" style={{ color: T.textSub }}>ご予約は確定しておりますので、<br /><strong style={{ color: T.text }}>キャンセル・変更はお電話にてお願いいたします。</strong></p>
                <p className="text-[11px] m-0 mt-2" style={{ color: T.accent }}>📞 {cancelPhone || "070-1675-5900"}（タップで発信）</p>
                <p className="text-[10px] m-0 mt-1" style={{ color: "#c45555" }}>⚠ 当日のキャンセルにつきましては、100％キャンセル料を頂戴いたします。</p>
              </div>
            </div>

            {/* ポリシー表示 */}
            <div className="rounded-lg border p-4" style={{ backgroundColor: T.cardAlt, borderColor: T.border }}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: "#c4555518", color: "#c45555", border: "1px solid #c4555530" }}>常時表示</span>
                <span className="text-[13px] font-medium">キャンセルポリシーを予約カード下に表示</span>
              </div>
              <p className="text-[11px] m-0" style={{ color: T.textMuted, lineHeight: 1.8 }}>
                お客様マイページのホーム画面「次回のご予約」カードの下に、常にキャンセルポリシーが表示されます：
              </p>
              <div className="rounded-lg mt-2 p-3" style={{ backgroundColor: "#c4555506", border: "1px solid #c4555515" }}>
                <p className="text-[10px] font-medium mb-1" style={{ color: "#c45555" }}>📌 キャンセル・変更について</p>
                <p className="text-[9px] m-0" style={{ color: T.textMuted, lineHeight: 1.7 }}>ご予約のキャンセル・変更は、必ずお電話にてスタッフまでお申しつけください。<br />当日のキャンセルにつきましては、<strong style={{ color: "#c45555" }}>100％キャンセル料</strong>を頂戴いたします。</p>
              </div>
            </div>
          </div>
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
