"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";
import { useTheme } from "../../lib/theme";
import { NavMenu } from "../../lib/nav-menu";
import { useConfirm } from "../../components/useConfirm";

type Notification = {
  id: number; title: string; body: string; type: string;
  image_url: string | null; target_customer_id: number | null;
  created_at: string;
  show_on_hp?: boolean;
};
type Customer = { id: number; name: string; phone: string; rank: string };

export default function NotificationPost() {
  const router = useRouter();
  const { dark, toggle, T } = useTheme();
  const { confirm, ConfirmModalNode } = useConfirm();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [type, setType] = useState("info");
  const [targetMode, setTargetMode] = useState<"all" | "rank" | "individual">("all");
  const [targetRank, setTargetRank] = useState("normal");
  const [targetCustomerId, setTargetCustomerId] = useState(0);
  const [custSearch, setCustSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  // 🔔 プッシュ通知も同時送信するか
  const [sendPush, setSendPush] = useState(true);
  const [pushResult, setPushResult] = useState("");
  // 🌐 HP(トップページ)の「最新のお知らせ」セクションにも表示するか
  //    （target_customer_id が NULL = 全員向け のときのみ有効）
  const [showOnHp, setShowOnHp] = useState(false);

  const fetchData = useCallback(async () => {
    const { data: n } = await supabase.from("customer_notifications").select("*").order("created_at", { ascending: false }).limit(50);
    if (n) setNotifications(n);
    const { data: c } = await supabase.from("customers").select("id,name,phone,rank").order("name");
    if (c) setCustomers(c);
  }, []);

  useEffect(() => {
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) router.push("/");
    };
    check(); fetchData();
  }, [router, fetchData]);

  const handlePost = async () => {
    if (!title.trim() || !body.trim()) { setMsg("タイトルと本文を入力してください"); return; }
    setSaving(true); setMsg(""); setPushResult("");

    // お知らせの送信先ID (プッシュ通知用)
    let pushUserIds: number[] = [];
    let pushBroadcast = false;

    if (targetMode === "all") {
      const { error } = await supabase.from("customer_notifications").insert({
        title: title.trim(), body: body.trim(), type,
        target_customer_id: null, image_url: null,
        show_on_hp: showOnHp,
      });
      if (error) { setMsg("投稿失敗: " + error.message); setSaving(false); return; }
      pushBroadcast = true;
    } else if (targetMode === "rank") {
      const filtered = customers.filter(c => targetRank === "all_ranks" || c.rank === targetRank);
      for (const c of filtered) {
        await supabase.from("customer_notifications").insert({
          title: title.trim(), body: body.trim(), type,
          target_customer_id: c.id, image_url: null,
          show_on_hp: false,
        });
      }
      pushUserIds = filtered.map(c => c.id);
    } else if (targetMode === "individual") {
      if (!targetCustomerId) { setMsg("お客様を選択してください"); setSaving(false); return; }
      const { error } = await supabase.from("customer_notifications").insert({
        title: title.trim(), body: body.trim(), type,
        target_customer_id: targetCustomerId, image_url: null,
        show_on_hp: false,
      });
      if (error) { setMsg("投稿失敗: " + error.message); setSaving(false); return; }
      pushUserIds = [targetCustomerId];
    }

    // 🔔 プッシュ通知送信 (有効かつ対象者がいる場合)
    if (sendPush) {
      try {
        const pushBody: Record<string, unknown> = {
          userType: "customer",
          title: title.trim(),
          body: body.trim(),
          url: "/customer-mypage",
          tag: `notif-${Date.now()}`,
        };
        if (pushBroadcast) {
          pushBody.broadcast = true;
        } else if (pushUserIds.length === 1) {
          pushBody.userId = pushUserIds[0];
        } else if (pushUserIds.length > 1) {
          pushBody.userIds = pushUserIds;
        }
        const res = await fetch("/api/push/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(pushBody),
        });
        const data = await res.json();
        if (res.ok) {
          setPushResult(`🔔 プッシュ通知: ${data.sent || 0}件送信 / 失敗${data.failed || 0}件`);
        } else {
          setPushResult(`⚠️ プッシュ通知エラー: ${data.error || "unknown"}`);
        }
      } catch (e: unknown) {
        const err = e as { message?: string };
        setPushResult(`⚠️ プッシュ通知送信失敗: ${err.message || ""}`);
      }
    }

    setSaving(false);
    setMsg("お知らせを投稿しました！");
    setTitle(""); setBody(""); setTargetCustomerId(0); setCustSearch("");
    setShowOnHp(false);
    fetchData();
    setTimeout(() => { setMsg(""); setPushResult(""); }, 5000);
  };

  const deleteNotification = async (id: number) => {
    const ok = await confirm({ title: "このお知らせを削除しますか？", variant: "danger", confirmLabel: "削除する" });
    if (!ok) return;
    await supabase.from("customer_notifications").delete().eq("id", id);
    fetchData();
  };

  const typeLabel = (t: string) => t === "info" ? "📢 お知らせ" : t === "new_therapist" ? "🌟 新人紹介" : t === "campaign" ? "🎉 キャンペーン" : t;
  const typeColor = (t: string) => t === "info" ? "#85a8c4" : t === "new_therapist" ? "#c3a782" : "#7ab88f";

  const filteredCusts = custSearch ? customers.filter(c => c.name.includes(custSearch) || (c.phone && c.phone.includes(custSearch))) : customers.slice(0, 20);

  const inputStyle = { backgroundColor: T.cardAlt, color: T.text, border: `1px solid ${T.border}` };

  return (
    <div className="h-screen flex flex-col" style={{ backgroundColor: T.bg, color: T.text }}>
      {ConfirmModalNode}
      {/* Header */}
      <div className="h-[56px] flex items-center justify-between px-4 flex-shrink-0 border-b" style={{ backgroundColor: T.card, borderColor: T.border }}>
        <div className="flex items-center gap-3">
          <NavMenu T={T} dark={dark} />
          <button onClick={() => router.push("/dashboard")} className="p-2 rounded-lg cursor-pointer" style={{ color: T.textSub }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <h1 className="text-[14px] font-medium">🔔 会員お知らせ投稿</h1>
        </div>
        <button onClick={toggle} className="px-2.5 py-1.5 text-[10px] rounded-lg cursor-pointer border" style={{ borderColor: T.border, color: T.textSub }}>
          {dark ? "☀️ ライト" : "🌙 ダーク"}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-[700px] mx-auto space-y-6 animate-[fadeIn_0.3s]">

          {/* 投稿フォーム */}
          <div className="rounded-2xl border p-5" style={{ backgroundColor: T.card, borderColor: T.border }}>
            <p className="text-[13px] font-medium mb-4">📝 新しいお知らせを投稿</p>

            <div className="space-y-4">
              {/* 種別 */}
              <div>
                <label className="block text-[10px] mb-1.5" style={{ color: T.textSub }}>種別</label>
                <div className="flex gap-2">
                  {([["info", "📢 お知らせ"], ["new_therapist", "🌟 新人紹介"], ["campaign", "🎉 キャンペーン"]] as const).map(([val, label]) => (
                    <button key={val} onClick={() => setType(val)} className="px-3 py-2 rounded-xl text-[11px] cursor-pointer"
                      style={{ backgroundColor: type === val ? typeColor(val) + "18" : T.cardAlt, color: type === val ? typeColor(val) : T.textMuted, border: `1px solid ${type === val ? typeColor(val) + "44" : T.border}`, fontWeight: type === val ? 600 : 400 }}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 配信対象 */}
              <div>
                <label className="block text-[10px] mb-1.5" style={{ color: T.textSub }}>配信対象</label>
                <div className="flex gap-2 mb-2">
                  {([["all", "📣 全員"], ["rank", "📈 ランク別"], ["individual", "👤 個別"]] as [typeof targetMode, string][]).map(([val, label]) => (
                    <button key={val} onClick={() => setTargetMode(val)} className="px-3 py-2 rounded-xl text-[11px] cursor-pointer"
                      style={{ backgroundColor: targetMode === val ? "#c3a78218" : T.cardAlt, color: targetMode === val ? "#c3a782" : T.textMuted, border: `1px solid ${targetMode === val ? "#c3a78244" : T.border}`, fontWeight: targetMode === val ? 600 : 400 }}>
                      {label}
                    </button>
                  ))}
                </div>

                {targetMode === "rank" && (
                  <select value={targetRank} onChange={e => setTargetRank(e.target.value)} className="px-3 py-2.5 rounded-xl text-[12px] outline-none cursor-pointer" style={inputStyle}>
                    <option value="all_ranks">全ランク（1件ずつ個別送信）</option>
                    <option value="normal">👤 一般</option>
                    <option value="silver">🥈 シルバー</option>
                    <option value="gold">🥇 ゴールド</option>
                    <option value="platinum">💎 プラチナ</option>
                  </select>
                )}

                {targetMode === "individual" && (
                  <div>
                    <input type="text" value={custSearch} onChange={e => setCustSearch(e.target.value)} placeholder="🔍 名前・電話番号で検索"
                      className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none mb-2" style={inputStyle} />
                    <div className="max-h-[150px] overflow-y-auto rounded-xl border" style={{ borderColor: T.border }}>
                      {filteredCusts.map(c => (
                        <button key={c.id} onClick={() => { setTargetCustomerId(c.id); setCustSearch(c.name); }}
                          className="w-full px-3 py-2 text-left text-[12px] cursor-pointer flex items-center justify-between"
                          style={{ backgroundColor: targetCustomerId === c.id ? "#c3a78212" : "transparent", borderBottom: `1px solid ${T.border}` }}>
                          <span>{c.name}</span>
                          <span className="text-[10px]" style={{ color: T.textMuted }}>{c.phone || ""}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* タイトル */}
              <div>
                <label className="block text-[10px] mb-1.5" style={{ color: T.textSub }}>タイトル <span style={{ color: "#c45555" }}>*</span></label>
                <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="例: 年末年始営業のお知らせ"
                  className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} />
              </div>

              {/* 本文 */}
              <div>
                <label className="block text-[10px] mb-1.5" style={{ color: T.textSub }}>本文 <span style={{ color: "#c45555" }}>*</span></label>
                <textarea value={body} onChange={e => setBody(e.target.value)} placeholder="お知らせの内容を入力してください" rows={4}
                  className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none resize-y" style={inputStyle} />
              </div>

              {/* プレビュー */}
              {(title || body) && (
                <div className="rounded-xl p-4" style={{ backgroundColor: T.cardAlt, border: `1px dashed ${T.border}` }}>
                  <p className="text-[9px] mb-2" style={{ color: T.textFaint }}>プレビュー</p>
                  <div className="flex items-start gap-3">
                    <span className="text-[14px]">{type === "info" ? "📢" : type === "new_therapist" ? "🌟" : "🎉"}</span>
                    <div>
                      <p className="text-[12px] font-medium">{title || "タイトル"}</p>
                      <p className="text-[11px] mt-1" style={{ color: T.textSub }}>{body || "本文"}</p>
                      <p className="text-[9px] mt-1" style={{ color: T.textFaint }}>配信先: {targetMode === "all" ? "全員" : targetMode === "rank" ? `${targetRank === "all_ranks" ? "全ランク" : targetRank}会員` : custSearch || "未選択"}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* 🔔 プッシュ通知オプション */}
              <div className="rounded-xl p-3 flex items-start gap-3 cursor-pointer select-none" style={{ backgroundColor: sendPush ? "rgba(195,167,130,0.08)" : T.cardAlt, border: `1px solid ${sendPush ? "#c3a782" : T.border}` }} onClick={() => setSendPush(!sendPush)}>
                <div className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 mt-0.5" style={{ backgroundColor: sendPush ? "#c3a782" : T.card, border: `1px solid ${sendPush ? "#c3a782" : T.textMuted}` }}>
                  {sendPush && <span className="text-white text-[12px] leading-none">✓</span>}
                </div>
                <div className="flex-1">
                  <p className="text-[12px] font-medium">🔔 プッシュ通知としても送信する</p>
                  <p className="text-[10px] mt-0.5" style={{ color: T.textMuted }}>通知をONにしているお客様のスマホに即時配信されます（未登録のお客様にはマイページ内のみ表示）</p>
                </div>
              </div>

              {/* 🌐 HP公開オプション（全員向けのときのみ有効） */}
              <div
                className={`rounded-xl p-3 flex items-start gap-3 select-none ${targetMode === "all" ? "cursor-pointer" : "cursor-not-allowed opacity-60"}`}
                style={{
                  backgroundColor: targetMode === "all" && showOnHp ? "rgba(232,132,154,0.08)" : T.cardAlt,
                  border: `1px solid ${targetMode === "all" && showOnHp ? "#e8849a" : T.border}`,
                }}
                onClick={() => { if (targetMode === "all") setShowOnHp(!showOnHp); }}
              >
                <div
                  className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{
                    backgroundColor: targetMode === "all" && showOnHp ? "#e8849a" : T.card,
                    border: `1px solid ${targetMode === "all" && showOnHp ? "#e8849a" : T.textMuted}`,
                  }}
                >
                  {targetMode === "all" && showOnHp && <span className="text-white text-[12px] leading-none">✓</span>}
                </div>
                <div className="flex-1">
                  <p className="text-[12px] font-medium">🌐 公式HPトップの「最新のお知らせ」にも公開する</p>
                  {targetMode === "all" ? (
                    <p className="text-[10px] mt-0.5" style={{ color: T.textMuted }}>
                      HP (ange-spa.com) のトップページに表示されます。未ログインの訪問者にも見えるため、営業時間変更・お祝い告知・大型キャンペーンなど広く知らせたい内容向けです。
                    </p>
                  ) : (
                    <p className="text-[10px] mt-0.5" style={{ color: T.textMuted }}>
                      全員向け（対象 : 全お客様）のときのみ指定できます。特定会員・ランク向けの通知は HP には掲載できません。
                    </p>
                  )}
                </div>
              </div>

              {msg && <div className="px-4 py-3 rounded-xl text-[12px]" style={{ backgroundColor: msg.includes("失敗") || msg.includes("入力") || msg.includes("選択") ? "#c4555518" : "#7ab88f18", color: msg.includes("失敗") || msg.includes("入力") || msg.includes("選択") ? "#c45555" : "#4a7c59" }}>{msg}</div>}
              {pushResult && <div className="px-4 py-3 rounded-xl text-[12px]" style={{ backgroundColor: pushResult.includes("エラー") || pushResult.includes("失敗") ? "#c4555518" : "#85a8c418", color: pushResult.includes("エラー") || pushResult.includes("失敗") ? "#c45555" : "#4a7ca0" }}>{pushResult}</div>}

              <button onClick={handlePost} disabled={saving} className="px-6 py-3 text-white text-[12px] rounded-xl cursor-pointer disabled:opacity-60 font-medium"
                style={{ background: "linear-gradient(135deg, #c3a782, #b09672)" }}>
                {saving ? "投稿中..." : sendPush ? "📤 お知らせ投稿 + 🔔 プッシュ通知" : "📤 お知らせを投稿する"}
              </button>
            </div>
          </div>

          {/* 投稿済み一覧 */}
          <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: T.card, borderColor: T.border }}>
            <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: `1px solid ${T.border}` }}>
              <p className="text-[12px] font-medium">📋 投稿済みお知らせ（直近50件）</p>
              <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: T.cardAlt, color: T.textMuted }}>{notifications.length}件</span>
            </div>
            {notifications.length === 0 ? (
              <p className="text-center py-8 text-[12px]" style={{ color: T.textFaint }}>お知らせがありません</p>
            ) : (
              <div className="divide-y" style={{ borderColor: T.border }}>
                {notifications.map(n => (
                  <div key={n.id} className="px-5 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[9px] px-2 py-0.5 rounded-full" style={{ backgroundColor: typeColor(n.type) + "18", color: typeColor(n.type) }}>{typeLabel(n.type)}</span>
                          {n.target_customer_id ? (
                            <span className="text-[9px]" style={{ color: T.textFaint }}>👤 {customers.find(c => c.id === n.target_customer_id)?.name || `ID:${n.target_customer_id}`}</span>
                          ) : (
                            <span className="text-[9px]" style={{ color: T.textFaint }}>📣 全員</span>
                          )}
                          {n.show_on_hp && (
                            <span className="text-[9px] px-2 py-0.5 rounded-full" style={{ backgroundColor: "#e8849a22", color: "#c96b83" }}>🌐 HP公開</span>
                          )}
                        </div>
                        <p className="text-[12px] font-medium truncate">{n.title}</p>
                        <p className="text-[10px] mt-0.5 line-clamp-2 whitespace-pre-wrap" style={{ color: T.textSub }}>{n.body}</p>
                        <p className="text-[9px] mt-1" style={{ color: T.textFaint }}>{new Date(n.created_at).toLocaleString("ja-JP")}</p>
                      </div>
                      <button onClick={() => deleteNotification(n.id)} className="px-2 py-1 text-[10px] rounded cursor-pointer flex-shrink-0"
                        style={{ color: "#c45555", backgroundColor: "#c4555518" }}>削除</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>

      <style jsx global>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .line-clamp-2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
      `}</style>
    </div>
  );
}
