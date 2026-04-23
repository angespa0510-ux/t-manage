"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { supabase } from "./supabase";
import { useTheme } from "./theme";

const normPhone = (p: string) => p.replace(/[-\s\u3000()（）\u2010-\u2015\uff0d]/g, "");

// iPhone Beta版で番号抽出に失敗した(phone="unknown" 等)かどうか
const isPhoneUnknown = (phone: string) =>
  !phone || phone === "unknown" || normPhone(phone).length < 10;

// iPhone Beta版で番号がなくても、通知本文(raw_text)の先頭=iPhone連絡先の表示名
// を取り出して表示する。bridge.py は "title | body" 形式で送ってくる。
const extractDisplayNameFromRaw = (raw: string | null | undefined): string => {
  if (!raw) return "";
  // "山田太郎 | 着信中..." → "山田太郎"
  const head = raw.split("|")[0].trim();
  // Phone Link / Intel Unison が付けるプレフィックスを剥がす
  const cleaned = head
    .replace(/^(着信(中)?[:：]?\s*)/i, "")
    .replace(/^(Incoming call from[:：]?\s*)/i, "")
    .replace(/^(電話[:：]?\s*)/i, "")
    .trim();
  return cleaned.slice(0, 30);  // 長すぎる場合に備えて上限
};

const RANKS: Record<string, { label: string; color: string; bg: string }> = {
  banned: { label: "出禁", color: "#c96b83", bg: "#c96b8318" },
  caution: { label: "要注意", color: "#b38419", bg: "#b3841918" },
  normal: { label: "普通", color: "#888780", bg: "#88878018" },
  good: { label: "善良", color: "#4a7c59", bg: "#4a7c5918" },
};

type CtiCall = {
  id: number;
  phone: string;
  created_at: string;
  handled: boolean;
  source?: string | null;       // 'android' | 'iphone_beta' | 'twilio' | 'manual'
  raw_text?: string | null;     // iphone_beta で番号抽出失敗時の通知全文
};
type Customer = {
  id: number; name: string; self_name: string; phone: string; phone2: string; phone3: string;
  rank: string; birthday: string; notes: string; login_email: string;
};
type Therapist = { id: number; name: string; phone: string };
type TherapistNote = {
  id: number; therapist_id: number; customer_name: string; note: string;
  is_ng: boolean; ng_reason: string; rating: number;
};
type Visit = { id: number; date: string; course: string; therapist_id: number; nomination: string; total_price: number };

type CtiPopupData = {
  call: CtiCall;
  customer: Customer | null;
  therapist: Therapist | null;
  totalVisits: number;
  lastVisitDate: string;
  recentVisits: Visit[];
  notes: TherapistNote[];
  therapistMap: Record<number, string>;
};

export function CtiPopupProvider({ children }: { children: React.ReactNode }) {
  const { T } = useTheme();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [popups, setPopups] = useState<CtiPopupData[]>([]);
  const [minimized, setMinimized] = useState<Record<number, boolean>>({});
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // CTIを表示しないパス（セラピスト/お客様/法人サイト/公開HP等）
  const ctiDisabled = (() => {
    if (!pathname) return true; // 判定不能なら安全側で無効

    // 公開HP（2026/04 Phase 1 で追加された HP × T-MANAGE 統合ページ群）
    // /therapist（単数・公開一覧） と /therapists（複数・管理画面）が
    // startsWith で衝突するため、完全一致 + "/" 付きプレフィックスで判定する。
    const publicSitePaths = [
      "/",            // HOME
      "/system",      // 料金・コース
      "/therapist",   // セラピスト一覧（/therapist/[id] 含む）
      "/schedule",    // 出勤スケジュール
      "/access",      // 店舗・アクセス
      "/recruit",     // 求人
      "/contact",     // お問い合わせ
      "/staff-login", // スタッフログイン
    ];
    for (const p of publicSitePaths) {
      if (pathname === p) return true;
      if (p !== "/" && pathname.startsWith(p + "/")) return true;
    }

    const noCtiPaths = [
      "/corporate",
      "/customer-mypage",
      "/mypage",
      "/confirm-email",
      "/confirm-staff-email",
      "/reservation-confirm",
      "/camera",
      "/install-guide",
      "/contract-sign",
      "/invoice-upload",
      "/license-upload",
      "/mynumber-upload",
    ];
    return noCtiPaths.some(p => pathname.startsWith(p));
  })();

  useEffect(() => { setMounted(true); }, []);

  // パス変更でCTI無効化ページに入ったら、既存ポップアップを即時クリア
  useEffect(() => {
    if (ctiDisabled && popups.length > 0) {
      setPopups([]);
      setMinimized({});
    }
    // popupsを依存に入れるとクリア後すぐ再発火するので除外
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctiDisabled]);

  // 着信音
  const playSound = useCallback(() => {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      gain.gain.value = 0.15;
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
      setTimeout(() => {
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.frequency.value = 1100;
        gain2.gain.value = 0.15;
        osc2.start();
        osc2.stop(ctx.currentTime + 0.3);
      }, 250);
    } catch {}
  }, []);

  // 顧客情報を取得
  const fetchCustomerInfo = useCallback(async (call: CtiCall) => {
    const phone = normPhone(call.phone);

    // セラピスト名マップ
    const { data: allTh } = await supabase.from("therapists").select("id, name, phone");
    const tMap: Record<number, string> = {};
    if (allTh) allTh.forEach(t => { tMap[t.id] = t.name; });

    // 顧客検索
    const { data: custs } = await supabase.from("customers").select("*")
      .or(`phone.eq.${phone},phone2.eq.${phone},phone3.eq.${phone}`);

    let customer: Customer | null = null;
    let totalVisits = 0;
    let lastVisitDate = "";
    let recentVisits: Visit[] = [];
    let notes: TherapistNote[] = [];

    if (custs && custs.length > 0) {
      const c = custs[0];
      customer = c;
      const custName = c.name;

      // 来店履歴
      const { data: visits, count } = await supabase.from("reservations")
        .select("id, date, course, therapist_id, nomination, total_price", { count: "exact" })
        .eq("customer_name", custName).eq("status", "completed")
        .order("date", { ascending: false }).limit(5);
      if (visits) { recentVisits = visits; totalVisits = count || visits.length; }
      if (visits && visits.length > 0) lastVisitDate = visits[0].date;

      // セラピストメモ（NG含む）
      const { data: cn } = await supabase.from("therapist_customer_notes").select("*")
        .eq("customer_name", custName);
      if (cn) notes = cn;
    }

    // セラピスト検索
    let therapist: Therapist | null = null;
    if (allTh) {
      const found = allTh.find(t => normPhone(t.phone || "") === phone);
      if (found) therapist = found;
    }

    return { call, customer, therapist, totalVisits, lastVisitDate, recentVisits, notes, therapistMap: tMap };
  }, []);

  // Supabase Realtime 購読
  const lastCallRef = useRef<{ phone: string; time: number }>({ phone: "", time: 0 });
  useEffect(() => {
    // CTI無効化ページではチャンネルを張らない
    if (ctiDisabled) return;

    const channel = supabase
      .channel("cti-calls-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "cti_calls" },
        async (payload) => {
          const call = payload.new as CtiCall;
          const phone = normPhone(call.phone);
          const now = Date.now();

          // 同じ番号が30秒以内に来たら無視
          if (phone === lastCallRef.current.phone && (now - lastCallRef.current.time) < 30000) return;
          lastCallRef.current = { phone, time: now };

          playSound();
          const data = await fetchCustomerInfo(call);
          setPopups(prev => [data, ...prev].slice(0, 5));

          setTimeout(() => {
            supabase.from("cti_calls").update({ handled: true }).eq("id", call.id).then();
          }, 30000);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [ctiDisabled, fetchCustomerInfo, playSound]);

  // ポップアップ閉じる
  const dismissPopup = (callId: number) => {
    setPopups(prev => prev.filter(p => p.call.id !== callId));
    supabase.from("cti_calls").update({ handled: true }).eq("id", callId).then();
  };

  // 最小化トグル
  const toggleMinimize = (callId: number) => {
    setMinimized(prev => ({ ...prev, [callId]: !prev[callId] }));
  };

  // 日付フォーマット
  const fmtDate = (d: string) => {
    if (!d) return "";
    const dt = new Date(d);
    return `${dt.getFullYear()}/${dt.getMonth() + 1}/${dt.getDate()}`;
  };
  const fmtTime = (d: string) => {
    const dt = new Date(d);
    return `${dt.getHours()}:${String(dt.getMinutes()).padStart(2, "0")}`;
  };

  // NG判定
  const hasNg = (notes: TherapistNote[]) => notes.some(n => n.is_ng);

  return (
    <>
      {children}
      {mounted && !ctiDisabled && createPortal(
        <div style={{ position: "fixed", bottom: 16, right: 16, zIndex: 10000, display: "flex", flexDirection: "column-reverse", gap: 12, maxHeight: "80vh", overflowY: "auto" }}>
          {popups.map((p, idx) => {
            const isMin = minimized[p.call.id];
            const rank = RANKS[p.customer?.rank || "normal"] || RANKS.normal;
            const isNg = hasNg(p.notes);
            const isBanned = p.customer?.rank === "banned";
            const isCaution = p.customer?.rank === "caution";

            // 最小化時
            if (isMin) return (
              <div key={p.call.id} onClick={() => toggleMinimize(p.call.id)}
                style={{ background: isBanned ? "#c96b83" : isCaution ? "#b38419" : "#c3a782", borderRadius: 12, padding: "10px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, boxShadow: "0 4px 24px rgba(0,0,0,0.25)", minWidth: 200 }}>
                <span style={{ fontSize: 16 }}>📞</span>
                <span style={{ color: "#fff", fontSize: 13, fontWeight: 600 }}>
                  {p.customer
                    ? p.customer.name
                    : p.therapist
                    ? `🏥 ${p.therapist.name}`
                    : isPhoneUnknown(p.call.phone)
                    ? extractDisplayNameFromRaw(p.call.raw_text) || "番号不明"
                    : p.call.phone}
                </span>
              </div>
            );

            // フル表示
            return (
              <div key={p.call.id} style={{
                background: T.card, border: `1.5px solid ${isBanned ? "#c96b83" : isCaution ? "#b38419" : T.border}`,
                borderRadius: 16, width: 380, boxShadow: "0 8px 40px rgba(0,0,0,0.2)",
                animation: "ctiSlideIn 0.4s ease-out"
              }}>
                {/* ヘッダー */}
                <div style={{
                  background: isBanned ? "#c96b8315" : isCaution ? "#b3841915" : "rgba(195,167,130,0.08)",
                  borderRadius: "16px 16px 0 0", padding: "12px 16px",
                  display: "flex", alignItems: "center", justifyContent: "space-between"
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 20 }}>📞</span>
                    <div>
                      <div style={{ fontSize: 10, color: T.textMuted, display: "flex", alignItems: "center", gap: 6 }}>
                        <span>着信 {fmtTime(p.call.created_at)}</span>
                        {p.call.source === "iphone_beta" && (
                          <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 4, background: "#e8849a22", color: "#e8849a", fontWeight: 600 }}>
                            📱 iPhone Beta
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 14, color: T.text, fontWeight: 600, letterSpacing: 1 }}>
                        {isPhoneUnknown(p.call.phone) ? (
                          extractDisplayNameFromRaw(p.call.raw_text) ? (
                            <>
                              {extractDisplayNameFromRaw(p.call.raw_text)}
                              <span style={{ fontSize: 10, color: T.textMuted, marginLeft: 6, fontWeight: 400 }}>
                                (番号非通知)
                              </span>
                            </>
                          ) : (
                            "番号不明"
                          )
                        ) : (
                          p.call.phone
                        )}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button onClick={() => toggleMinimize(p.call.id)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, color: T.textMuted, padding: 4 }}>—</button>
                    <button onClick={() => dismissPopup(p.call.id)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, color: T.textMuted, padding: 4 }}>✕</button>
                  </div>
                </div>

                {/* 本体 */}
                <div style={{ padding: 16 }}>
                  {/* === 顧客見つかった場合 === */}
                  {p.customer && (
                    <>
                      {/* 名前 + ランク */}
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                        <span style={{ fontSize: 22, fontWeight: 700, color: T.text }}>{p.customer.name}</span>
                        <span style={{ fontSize: 11, padding: "2px 10px", borderRadius: 20, background: rank.bg, color: rank.color, fontWeight: 600 }}>{rank.label}</span>
                        {p.customer.login_email && <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 20, background: "#3b82f615", color: "#3b82f6" }}>📱会員</span>}
                        {isNg && <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 20, background: "#c96b8315", color: "#c96b83", fontWeight: 600 }}>NG有</span>}
                      </div>

                      {/* 出禁・要注意アラート */}
                      {(isBanned || isCaution) && (
                        <div style={{ background: isBanned ? "#c96b8312" : "#b3841912", border: `1px solid ${isBanned ? "#c96b8330" : "#b3841930"}`, borderRadius: 10, padding: "8px 12px", marginBottom: 12 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: isBanned ? "#c96b83" : "#b38419" }}>
                            {isBanned ? "🚫 このお客様は出禁です" : "⚠️ 要注意のお客様です"}
                          </span>
                        </div>
                      )}

                      {/* 統計 */}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
                        <div style={{ background: T.cardAlt, borderRadius: 10, padding: "8px 10px", textAlign: "center" }}>
                          <div style={{ fontSize: 10, color: T.textMuted }}>来店回数</div>
                          <div style={{ fontSize: 18, fontWeight: 700, color: T.text }}>{p.totalVisits}</div>
                        </div>
                        <div style={{ background: T.cardAlt, borderRadius: 10, padding: "8px 10px", textAlign: "center" }}>
                          <div style={{ fontSize: 10, color: T.textMuted }}>最終来店</div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{p.lastVisitDate ? fmtDate(p.lastVisitDate) : "—"}</div>
                        </div>
                        <div style={{ background: T.cardAlt, borderRadius: 10, padding: "8px 10px", textAlign: "center" }}>
                          <div style={{ fontSize: 10, color: T.textMuted }}>ランク</div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: rank.color }}>{rank.label}</div>
                        </div>
                      </div>

                      {/* メモ（NG含む） */}
                      {p.notes.length > 0 && (
                        <div style={{ marginBottom: 12 }}>
                          <div style={{ fontSize: 10, color: T.textMuted, marginBottom: 4 }}>セラピストメモ</div>
                          {p.notes.slice(0, 3).map(n => (
                            <div key={n.id} style={{ background: n.is_ng ? "#c96b8308" : T.cardAlt, borderRadius: 8, padding: "6px 10px", marginBottom: 4, borderLeft: n.is_ng ? "3px solid #c96b83" : "3px solid transparent" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <span style={{ fontSize: 11, fontWeight: 600, color: T.text }}>{p.therapistMap[n.therapist_id] || "?"}</span>
                                <span style={{ fontSize: 10, color: T.textMuted }}>
                                  {n.rating > 0 && "★".repeat(n.rating)}
                                  {n.is_ng && <span style={{ color: "#c96b83", marginLeft: 4 }}>NG</span>}
                                </span>
                              </div>
                              {n.note && <div style={{ fontSize: 11, color: T.textSub, marginTop: 2 }}>{n.note.slice(0, 60)}{n.note.length > 60 ? "…" : ""}</div>}
                              {n.is_ng && n.ng_reason && <div style={{ fontSize: 10, color: "#c96b83", marginTop: 2 }}>理由: {n.ng_reason.slice(0, 40)}</div>}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* 直近来店 */}
                      {p.recentVisits.length > 0 && (
                        <div style={{ marginBottom: 12 }}>
                          <div style={{ fontSize: 10, color: T.textMuted, marginBottom: 4 }}>直近来店</div>
                          {p.recentVisits.slice(0, 3).map(v => (
                            <div key={v.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, padding: "3px 0", borderBottom: `1px solid ${T.border}` }}>
                              <span style={{ color: T.textSub }}>{fmtDate(v.date)}</span>
                              <span style={{ color: T.text }}>{v.course}</span>
                              <span style={{ color: T.textMuted }}>{p.therapistMap[v.therapist_id] || "?"}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* アクションボタン */}
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => { window.open(`/timechart?cti_customer=${encodeURIComponent(p.customer!.name)}`, "_blank"); dismissPopup(p.call.id); }} style={{
                          flex: 1, padding: "8px 0", borderRadius: 10, border: "none",
                          background: "#c96b83", color: "#fff", fontSize: 12, cursor: "pointer", fontWeight: 600
                        }}>📋 オーダー登録</button>
                        <button onClick={() => { window.open("/dashboard", "_blank"); }} style={{
                          flex: 1, padding: "8px 0", borderRadius: 10, border: `1px solid ${T.border}`,
                          background: T.cardAlt, color: T.text, fontSize: 12, cursor: "pointer"
                        }}>👥 顧客管理</button>
                      </div>
                    </>
                  )}

                  {/* === セラピストの場合 === */}
                  {!p.customer && p.therapist && (
                    <div style={{ textAlign: "center", padding: "12px 0" }}>
                      <div style={{ fontSize: 16, color: T.text, fontWeight: 600, marginBottom: 4 }}>🏥 {p.therapist.name}</div>
                      <div style={{ fontSize: 12, color: T.textSub }}>セラピストからの着信です</div>
                    </div>
                  )}

                  {/* === 該当なしの場合 === */}
                  {!p.customer && !p.therapist && (
                    <div style={{ textAlign: "center", padding: "12px 0" }}>
                      {isPhoneUnknown(p.call.phone) ? (
                        <>
                          <div style={{ fontSize: 15, color: T.text, fontWeight: 600, marginBottom: 4 }}>
                            👤 {extractDisplayNameFromRaw(p.call.raw_text) || "番号不明"}
                          </div>
                          <div style={{ fontSize: 11, color: "#f59e0b", marginBottom: 4, padding: "6px 10px", background: "#f59e0b12", borderRadius: 8 }}>
                            ⚠ 番号が取得できませんでした
                          </div>
                          <div style={{ fontSize: 10, color: T.textMuted, marginBottom: 12, lineHeight: 1.5 }}>
                            iPhone 連絡先に登録済み、または Phone Link の接続問題の可能性<br />
                            正確な検出には Twilio 連携版（有料）をご検討ください
                          </div>
                        </>
                      ) : (
                        <>
                          <div style={{ fontSize: 15, color: T.text, fontWeight: 600, marginBottom: 4 }}>👤 新規のお客様</div>
                          <div style={{ fontSize: 12, color: T.textSub, marginBottom: 12 }}>この電話番号は未登録です</div>
                          <button onClick={() => { window.open(`/timechart?cti_phone=${encodeURIComponent(p.call.phone)}`, "_blank"); dismissPopup(p.call.id); }} style={{
                            padding: "8px 20px", borderRadius: 10, border: "none",
                            background: "#c96b83", color: "#fff", fontSize: 12, cursor: "pointer", fontWeight: 600
                          }}>📋 オーダー登録（新規顧客）</button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          <style>{`@keyframes ctiSlideIn { from { opacity: 0; transform: translateY(30px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }`}</style>
        </div>,
        document.body
      )}
    </>
  );
}
