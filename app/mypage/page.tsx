"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../../lib/supabase";
import TaxSupportWizard from "../../components/TaxSupportWizard";
import { useTheme } from "../../lib/theme";

/* ───────── 型定義 ───────── */
type Therapist = {
  id: number; name: string; login_email: string; login_password: string;
  has_invoice: boolean; has_withholding: boolean; transport_fee: number;
  real_name: string; notes: string; status: string;
};
type Shift = { id: number; therapist_id: number; date: string; start_time: string; end_time: string; store_id: number; status: string };
type ShiftRequest = { id: number; therapist_id: number; week_start: string; date: string; start_time: string; end_time: string; store_id: number; status: string; notes: string };
type Settlement = {
  id: number; therapist_id: number; date: string; total_sales: number; total_back: number;
  order_count: number; adjustment: number; adjustment_note: string; invoice_deduction: number;
  withholding_tax: number; welfare_fee: number; transport_fee: number; final_payment: number;
  total_card: number; total_paypay: number; total_cash: number; is_settled: boolean;
};
type Reservation = {
  id: number; customer_name: string; therapist_id: number; date: string; start_time: string;
  end_time: string; course: string; notes: string; total_price: number; status: string;
  nomination: string; nomination_fee: number; options_text: string; extension_name: string;
};
type CustomerNote = { id: number; therapist_id: number; customer_name: string; note: string; is_ng: boolean; ng_reason: string; rating: number; reservation_id?: number; updated_at?: string };
type Store = { id: number; name: string };

const fmt = (n: number) => "¥" + (n || 0).toLocaleString();
const TIMES: string[] = [];
for (let h = 9; h <= 27; h++) { for (let m = 0; m < 60; m += 30) { const dh = h >= 24 ? h - 24 : h; TIMES.push(`${String(dh).padStart(2, "0")}:${String(m).padStart(2, "0")}`); } }

function getWeekStart(date: Date): string {
  const d = new Date(date); const day = d.getDay(); d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  return d.toISOString().split("T")[0];
}
function getWeekDates(weekStart: string): string[] {
  const dates: string[] = []; const d = new Date(weekStart + "T00:00:00");
  for (let i = 0; i < 7; i++) { const dd = new Date(d); dd.setDate(dd.getDate() + i); dates.push(dd.toISOString().split("T")[0]); }
  return dates;
}
function formatDate(d: string): string {
  const dt = new Date(d + "T00:00:00"); const days = ["日", "月", "火", "水", "木", "金", "土"];
  return `${dt.getMonth() + 1}/${dt.getDate()}(${days[dt.getDay()]})`;
}

export default function TherapistMyPage() {
  const { dark, toggle, T } = useTheme();
  const [loggedIn, setLoggedIn] = useState(false);
  const [therapist, setTherapist] = useState<Therapist | null>(null);
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState(""); const [loginLoading, setLoginLoading] = useState(false);
  const [showReset, setShowReset] = useState(false); const [resetPhone, setResetPhone] = useState(""); const [resetMsg, setResetMsg] = useState(""); const [resetDone, setResetDone] = useState(false);
  const [tab, setTab] = useState<"home" | "shift" | "schedule" | "salary" | "customers" | "manual" | "tax">("home");
  const [shifts, setShifts] = useState<Shift[]>([]); const [shiftRequests, setShiftRequests] = useState<ShiftRequest[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]); const [reservations, setReservations] = useState<Reservation[]>([]);
  const [allReservations, setAllReservations] = useState<Reservation[]>([]); const [customerNotes, setCustomerNotes] = useState<CustomerNote[]>([]);
  const [todayOrders, setTodayOrders] = useState<Reservation[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [allRooms, setAllRooms] = useState<{id:number;name:string;store_id:number;building_id:number}[]>([]);
  const [buildings, setBuildings] = useState<{id:number;name:string}[]>([]);
  const [roomAssigns, setRoomAssigns] = useState<{therapist_id:number;room_id:number;date:string}[]>([]);
  const [coursesMaster, setCoursesMaster] = useState<{ id: number; name: string; therapist_back: number }[]>([]);
const [nomsMaster, setNomsMaster] = useState<{ id: number; name: string; back_amount: number }[]>([]);
const [extsMaster, setExtsMaster] = useState<{ id: number; name: string; therapist_back: number }[]>([]);
const [optsMaster, setOptsMaster] = useState<{ id: number; name: string; therapist_back: number }[]>([]);
  const [weekOffset, setWeekOffset] = useState(1);
  const [reqDrafts, setReqDrafts] = useState<Record<string, { enabled: boolean; start: string; end: string; store_id: number; notes: string }>>({});
  const [reqSaving, setReqSaving] = useState(false); const [reqMsg, setReqMsg] = useState(""); const [copiedShift, setCopiedShift] = useState(false);
  const [salaryMonth, setSalaryMonth] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; });
  const [noteSearch, setNoteSearch] = useState(""); const [showAddNote, setShowAddNote] = useState(false);
  const [noteForm, setNoteForm] = useState({ customer_name: "", note: "", is_ng: false, ng_reason: "", rating: 0, reservation_id: 0 })
  const [noteViewTarget, setNoteViewTarget] = useState<CustomerNote | null>(null);
  const [noteHistoryCustomer, setNoteHistoryCustomer] = useState("");
  const [calMonth, setCalMonth] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; });
　const [calShifts, setCalShifts] = useState<Shift[]>([]);
　const [calSettlements, setCalSettlements] = useState<Settlement[]>([]);
　const [calReservations, setCalReservations] = useState<Reservation[]>([]);
　const [calDetailDate, setCalDetailDate] = useState<string | null>(null);

  // ── マニュアル関連 ──
  type ManualCategory = { id: number; name: string; icon: string; color: string; description: string; sort_order: number };
  type ManualArticle = { id: number; title: string; category_id: number | null; content: string; cover_image: string; tags: string[]; is_published: boolean; is_pinned: boolean; view_count: number; sort_order: number; created_at: string; updated_at: string };
  type ManualQA = { id: number; article_id: number; question: string; answer: string; sort_order: number };
  type ManualUpdate = { id: number; article_id: number; summary: string; updated_by: string; created_at: string };
  const [manualCats, setManualCats] = useState<ManualCategory[]>([]);
  const [manualArticles, setManualArticles] = useState<ManualArticle[]>([]);
  const [manualReads, setManualReads] = useState<number[]>([]);
  const [manualUpdates, setManualUpdates] = useState<ManualUpdate[]>([]);
  const [manualSelCat, setManualSelCat] = useState<number | null>(null);
  const [manualSearch, setManualSearch] = useState("");
  const [manualFilterTag, setManualFilterTag] = useState("");
  const [manualViewArticle, setManualViewArticle] = useState<ManualArticle | null>(null);
  const [manualViewQAs, setManualViewQAs] = useState<ManualQA[]>([]);
  const [manualOpenQA, setManualOpenQA] = useState<number | null>(null);
  const [manualHistory, setManualHistory] = useState<ManualArticle[]>([]);
  const [aiChatOpen, setAiChatOpen] = useState(false);
  const [aiChatMessages, setAiChatMessages] = useState<{ role: "user" | "ai"; content: string; logId?: number; rating?: number }[]>([]);
  const [aiChatInput, setAiChatInput] = useState("");
  const [aiChatLoading, setAiChatLoading] = useState(false);
  const [aiListening, setAiListening] = useState(false);
  const [aiSessionCount, setAiSessionCount] = useState(0);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) { setLoginError("メールアドレスとパスワードを入力してください"); return; }
    setLoginLoading(true); setLoginError("");
    const { data } = await supabase.from("therapists").select("*").eq("login_email", email.trim()).eq("login_password", password.trim()).maybeSingle();
    setLoginLoading(false);
    if (data) { setTherapist(data); setLoggedIn(true); localStorage.setItem("therapist_session", JSON.stringify({ id: data.id, email: data.login_email })); }
    else { setLoginError("メールアドレスまたはパスワードが間違っています"); }
  };

  const handleResetPassword = async () => {
    setResetMsg(""); setLoginLoading(true);
    try {
      const res = await fetch("/api/password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: resetPhone, type: "therapist" }),
      });
      const data = await res.json();
      if (data.success) {
        setResetDone(true);
        setResetMsg(data.emailSent ? `✅ 新しいパスワードを ${data.maskedEmail} に送信しました` : "✅ パスワードを再発行しました。オーナーにお問い合わせください。");
      } else {
        setResetMsg(data.error || "エラーが発生しました");
      }
    } catch { setResetMsg("通信エラーが発生しました"); }
    setLoginLoading(false);
  };

  useEffect(() => {
    const session = localStorage.getItem("therapist_session");
    if (session) { const { id } = JSON.parse(session); supabase.from("therapists").select("*").eq("id", id).maybeSingle().then(({ data }) => { if (data) { setTherapist(data); setLoggedIn(true); } else localStorage.removeItem("therapist_session"); }); }
  }, []);

  const fetchData = useCallback(async () => {
    if (!therapist) return; const tid = therapist.id;
    const { data: st } = await supabase.from("stores").select("*"); if (st) setStores(st);
    const { data: rms } = await supabase.from("rooms").select("id,name,store_id,building_id"); if (rms) setAllRooms(rms);
    const { data: blds } = await supabase.from("buildings").select("id,name"); if (blds) setBuildings(blds);
    const todayStr2 = new Date().toISOString().split("T")[0];
    const { data: ras } = await supabase.from("room_assignments").select("therapist_id,room_id,date").eq("therapist_id", tid).gte("date", todayStr2); if (ras) setRoomAssigns(ras);
    const { data: crsM } = await supabase.from("courses").select("id,name,therapist_back"); if (crsM) setCoursesMaster(crsM);
    const { data: nm } = await supabase.from("nominations").select("id,name,back_amount"); if (nm) setNomsMaster(nm);
    const { data: em } = await supabase.from("extensions").select("id,name,therapist_back"); if (em) setExtsMaster(em);
    const { data: om } = await supabase.from("options").select("id,name,therapist_back"); if (om) setOptsMaster(om);
    const now = new Date(); const m1 = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const m2end = new Date(now.getFullYear(), now.getMonth() + 2, 0); const m2 = m2end.toISOString().split("T")[0];
    const { data: sh } = await supabase.from("shifts").select("*").eq("therapist_id", tid).gte("date", m1).lte("date", m2).eq("status", "confirmed").order("date"); if (sh) setShifts(sh);
    const { data: sr } = await supabase.from("shift_requests").select("*").eq("therapist_id", tid).order("date"); if (sr) setShiftRequests(sr);
    const [sy, sm] = salaryMonth.split("-").map(Number); const dim = new Date(sy, sm, 0).getDate();
    const { data: stl } = await supabase.from("therapist_daily_settlements").select("*").eq("therapist_id", tid).gte("date", `${salaryMonth}-01`).lte("date", `${salaryMonth}-${String(dim).padStart(2, "0")}`).eq("is_settled", true).order("date"); if (stl) setSettlements(stl);
    const d30 = new Date(); d30.setDate(d30.getDate() - 30);
    const { data: res } = await supabase.from("reservations").select("*").eq("therapist_id", tid).gte("date", d30.toISOString().split("T")[0]).eq("status", "completed").order("date", { ascending: false }); if (res) setReservations(res);
    const { data: allRes } = await supabase.from("reservations").select("*").eq("therapist_id", tid).eq("status", "completed").order("date", { ascending: false }); if (allRes) setAllReservations(allRes);
    // 本日の全オーダー（キャンセル以外）
    const todayStr = new Date().toISOString().split("T")[0];
    const { data: todayR } = await supabase.from("reservations").select("*").eq("therapist_id", tid).eq("date", todayStr).neq("status", "cancelled").order("start_time"); if (todayR) setTodayOrders(todayR);
    const { data: cn } = await supabase.from("therapist_customer_notes").select("*").eq("therapist_id", tid).order("customer_name"); if (cn) setCustomerNotes(cn);
    const [cy, cm] = calMonth.split("-").map(Number);
    const calDim = new Date(cy, cm, 0).getDate();
    const calStart = `${calMonth}-01`; const calEnd = `${calMonth}-${String(calDim).padStart(2, "0")}`;
    const { data: csh } = await supabase.from("shifts").select("*").eq("therapist_id", tid).gte("date", calStart).lte("date", calEnd).eq("status", "confirmed"); if (csh) setCalShifts(csh);
    const { data: cstl } = await supabase.from("therapist_daily_settlements").select("*").eq("therapist_id", tid).gte("date", calStart).lte("date", calEnd).eq("is_settled", true); if (cstl) setCalSettlements(cstl);
    const { data: cres } = await supabase.from("reservations").select("*").eq("therapist_id", tid).gte("date", calStart).lte("date", calEnd).neq("status", "cancelled"); if (cres) setCalReservations(cres);
    // マニュアルデータ
    const { data: mc } = await supabase.from("manual_categories").select("*").order("sort_order"); if (mc) setManualCats(mc);
    const { data: ma } = await supabase.from("manual_articles").select("*").eq("is_published", true).order("sort_order").order("created_at", { ascending: false }); if (ma) setManualArticles(ma);
    const { data: mr } = await supabase.from("manual_reads").select("article_id").eq("therapist_id", tid); if (mr) setManualReads(mr.map((r: any) => r.article_id));
    const { data: mu } = await supabase.from("manual_updates").select("*").order("created_at", { ascending: false }).limit(10); if (mu) setManualUpdates(mu);
  }, [therapist, salaryMonth, calMonth]);

  useEffect(() => { fetchData(); }, [fetchData]);
  // リアルタイム同期
  useEffect(() => {
    const ch = supabase.channel("mypage-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "shifts" }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "room_assignments" }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "reservations" }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchData]);

  const targetWeekStart = getWeekStart(new Date(Date.now() + weekOffset * 7 * 86400000));
  const weekDates = getWeekDates(targetWeekStart);

  useEffect(() => {
    const drafts: Record<string, { enabled: boolean; start: string; end: string; store_id: number; notes: string }> = {};
    for (const d of weekDates) { const existing = shiftRequests.find(r => r.date === d); drafts[d] = existing ? { enabled: true, start: existing.start_time, end: existing.end_time, store_id: existing.store_id || 0, notes: existing.notes || "" } : { enabled: false, start: "12:00", end: "03:00", store_id: stores[0]?.id || 0, notes: "" }; }
    setReqDrafts(drafts);
  }, [weekOffset, shiftRequests, targetWeekStart, stores]);

  const submitShiftRequests = async () => {
    if (!therapist) return; setReqSaving(true); setReqMsg("");
    for (const d of weekDates) { const draft = reqDrafts[d]; if (!draft) continue; if (draft.enabled) { await supabase.from("shift_requests").upsert({ therapist_id: therapist.id, week_start: targetWeekStart, date: d, start_time: draft.start, end_time: draft.end, store_id: draft.store_id, notes: draft.notes, status: "pending", updated_at: new Date().toISOString() }, { onConflict: "therapist_id,date" }); } else { await supabase.from("shift_requests").delete().eq("therapist_id", therapist.id).eq("date", d); } }
    setReqSaving(false); setReqMsg("✅ シフト希望を提出しました！"); fetchData(); setTimeout(() => setReqMsg(""), 2000);
  };

  const generateShiftCopyText = () => {
    if (!therapist) return ""; const enabledDays = weekDates.filter(d => reqDrafts[d]?.enabled);
    if (enabledDays.length === 0) return `【シフト希望】${therapist.name}\n${formatDate(weekDates[0])}〜${formatDate(weekDates[6])}\n\n出勤希望なし`;
    let text = `【シフト希望】${therapist.name}\n${formatDate(weekDates[0])}〜${formatDate(weekDates[6])}\n\n`;
    for (const d of enabledDays) { const draft = reqDrafts[d]; const store = stores.find(s => s.id === draft.store_id); const sn = store?.name?.replace(/ルーム$/, "") || ""; text += `${formatDate(d)} ${draft.start}〜${draft.end}${sn ? ` [${sn}]` : ""}${draft.notes ? ` ※${draft.notes}` : ""}\n`; }
    return text.trim();
  };
  const copyShiftToClipboard = () => { navigator.clipboard.writeText(generateShiftCopyText()); setCopiedShift(true); setTimeout(() => setCopiedShift(false), 2000); };

  const deleteCustomerNote = async (id: number) => {
    if (!confirm("このメモを削除しますか？")) return;
    await supabase.from("therapist_customer_notes").delete().eq("id", id);
    const returnDate = calDetailDate; setShowAddNote(false); setNoteViewTarget(null); await fetchData(); if (returnDate) setCalDetailDate(returnDate);
  };

  const saveCustomerNote = async () => {
    if (!therapist || !noteForm.customer_name.trim()) return;
    if (noteForm.reservation_id > 0) {
      // 接客単位メモ: reservation_idで検索
      const existing = customerNotes.find(n => n.reservation_id === noteForm.reservation_id);
      if (existing) {
        await supabase.from("therapist_customer_notes").update({ note: noteForm.note, rating: noteForm.rating, is_ng: noteForm.is_ng, ng_reason: noteForm.ng_reason, updated_at: new Date().toISOString() }).eq("id", existing.id);
      } else {
        await supabase.from("therapist_customer_notes").insert({ therapist_id: therapist.id, customer_name: noteForm.customer_name.trim(), note: noteForm.note, is_ng: noteForm.is_ng, ng_reason: noteForm.ng_reason, rating: noteForm.rating, reservation_id: noteForm.reservation_id });
      }
    } else {
      // 旧式: customer_nameでreservation_id無しのものを検索
      const existing = customerNotes.find(n => n.customer_name === noteForm.customer_name.trim() && !n.reservation_id);
      if (existing) {
        await supabase.from("therapist_customer_notes").update({ note: noteForm.note, is_ng: noteForm.is_ng, ng_reason: noteForm.ng_reason, rating: noteForm.rating, updated_at: new Date().toISOString() }).eq("id", existing.id);
      } else {
        await supabase.from("therapist_customer_notes").insert({ therapist_id: therapist.id, customer_name: noteForm.customer_name.trim(), note: noteForm.note, is_ng: noteForm.is_ng, ng_reason: noteForm.ng_reason, rating: noteForm.rating });
      }
    }
    const returnDate = calDetailDate; setShowAddNote(false); setNoteViewTarget(null); setNoteForm({ customer_name: "", note: "", is_ng: false, ng_reason: "", rating: 0, reservation_id: 0 }); await fetchData(); if (returnDate) setCalDetailDate(returnDate);
  };

  const logout = () => { localStorage.removeItem("therapist_session"); setLoggedIn(false); setTherapist(null); setTab("home"); };
  const chipStyle = (active: boolean, color: string) => ({ backgroundColor: active ? color + "20" : "transparent", color: active ? color : T.textMuted, borderColor: active ? color : T.border });

  // マニュアル記事を開く（fromLink=true のとき履歴に追加）
  const openManualArticle = async (article: ManualArticle, fromLink = false) => {
    if (fromLink && manualViewArticle) {
      setManualHistory(prev => [...prev, manualViewArticle]);
    } else if (!fromLink) {
      setManualHistory([]);
    }
    setManualViewArticle(article); setManualOpenQA(null);
    // ブラウザ履歴に追加（スワイプバック対応）
    window.history.pushState({ manualArticleId: article.id, fromLink }, "");
    // Q&A取得
    const { data: qa } = await supabase.from("manual_qa").select("*").eq("article_id", article.id).order("sort_order");
    if (qa) setManualViewQAs(qa);
    // 既読記録
    if (therapist && !manualReads.includes(article.id)) {
      await supabase.from("manual_reads").upsert({ article_id: article.id, therapist_id: therapist.id }, { onConflict: "article_id,therapist_id" });
      setManualReads(prev => [...prev, article.id]);
      // view_count++
      await supabase.from("manual_articles").update({ view_count: (article.view_count || 0) + 1 }).eq("id", article.id);
    }
  };

  // 1つ前の記事に戻る（ボタン用）
  const goBackManual = () => {
    // ブラウザ履歴を戻す → popstateで処理される
    window.history.back();
  };

  // ブラウザのスワイプバック・戻るボタン対応
  const manualHistoryRef = useRef(manualHistory);
  manualHistoryRef.current = manualHistory;
  const manualViewRef = useRef(manualViewArticle);
  manualViewRef.current = manualViewArticle;
  const manualArticlesRef = useRef(manualArticles);
  manualArticlesRef.current = manualArticles;
  const tabRef = useRef(tab);
  tabRef.current = tab;

  // タブ切替時にブラウザ履歴ガード追加
  useEffect(() => {
    if (tab === "manual") {
      window.history.pushState({ manualTab: true }, "");
    }
  }, [tab]);

  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      // マニュアル記事を表示中の場合
      if (manualViewRef.current) {
        const history = manualHistoryRef.current;
        if (history.length > 0) {
          // 前の記事に戻る
          const prev = history[history.length - 1];
          setManualHistory(h => h.slice(0, -1));
          setManualViewArticle(prev); setManualOpenQA(null);
          supabase.from("manual_qa").select("*").eq("article_id", prev.id).order("sort_order").then(({ data }) => { if (data) setManualViewQAs(data); });
        } else {
          // 記事一覧に戻る
          setManualViewArticle(null);
          // 一覧に戻った後のガード
          window.history.pushState({ manualTab: true }, "");
        }
        return;
      }
      // マニュアルタブ（一覧表示中）からスワイプバック → ホームタブへ
      if (tabRef.current === "manual" && !manualViewRef.current) {
        setTab("home");
        window.history.pushState({ homeTab: true }, "");
        return;
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 記事内リンク処理 ──
  const renderInlineLinks = (text: string): React.ReactNode => {
    // [link:記事タイトル] と [catlink:カテゴリ名] をパース
    const parts = text.split(/(\[link:[^\]]+\]|\[catlink:[^\]]+\])/g);
    if (parts.length === 1) return text;
    return parts.map((part, idx) => {
      const linkMatch = part.match(/^\[link:(.+)\]$/);
      if (linkMatch) {
        const title = linkMatch[1];
        const target = manualArticles.find(a => a.title === title || a.title.includes(title));
        if (target) {
          return <span key={idx} onClick={(e) => { e.stopPropagation(); openManualArticle(target, true); }}
            style={{ color: "#e8849a", fontWeight: 600, cursor: "pointer", borderBottom: "1px dashed #e8849a", paddingBottom: 1 }}>📖 {title}</span>;
        }
        return <span key={idx} style={{ color: "#e8849a" }}>📖 {title}</span>;
      }
      const catMatch = part.match(/^\[catlink:(.+)\]$/);
      if (catMatch) {
        const catName = catMatch[1];
        const target = manualCats.find(c => c.name === catName || c.name.includes(catName));
        if (target) {
          return <span key={idx} onClick={(e) => { e.stopPropagation(); setManualViewArticle(null); setManualHistory([]); setManualSelCat(target.id); }}
            style={{ color: "#e8849a", fontWeight: 600, cursor: "pointer", borderBottom: "1px dashed #e8849a", paddingBottom: 1 }}>{target.icon} {target.name}</span>;
        }
        return <span key={idx} style={{ color: "#e8849a" }}>{catName}</span>;
      }
      return <span key={idx}>{part}</span>;
    });
  };

  // テキスト行のインライン処理（太字+リンク）
  const renderInlineContent = (text: string): React.ReactNode => {
    // まず太字を処理、その結果をリンク処理
    if (text.match(/\*\*(.*?)\*\*/)) {
      const parts = text.split(/(\*\*.*?\*\*)/g);
      return parts.map((p, j) => {
        if (p.startsWith("**") && p.endsWith("**")) return <strong key={j} style={{ color: "#e8849a" }}>{renderInlineLinks(p.slice(2, -2))}</strong>;
        return <span key={j}>{renderInlineLinks(p)}</span>;
      });
    }
    return renderInlineLinks(text);
  };
  const getStoreName = (id: number) => stores.find(s => s.id === id)?.name || "";
  const getBuildingForDate = (date: string) => {
    const ra = roomAssigns.find(a => a.date === date);
    if (!ra) return "";
    const rm = allRooms.find(r => r.id === ra.room_id);
    if (!rm) return "";
    const bl = buildings.find(b => b.id === rm.building_id);
    return bl?.name || "";
  };
  const getRoomForDate = (date: string) => {
    const ra = roomAssigns.find(a => a.date === date);
    if (!ra) return "";
    const rm = allRooms.find(r => r.id === ra.room_id);
    return rm?.name || "";
  };
  const getStoreShort = (id: number) => stores.find(s => s.id === id)?.name?.replace(/ルーム$/, "") || "";

  if (!loggedIn) return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: "#fff0f3" }}>
      <div className="w-full max-w-[360px]">
        <div className="text-center mb-8"><div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: "linear-gradient(135deg, #e8849a, #d4687e)" }}><span className="text-white text-2xl font-bold">C</span></div><h1 className="text-xl font-medium" style={{ color: "#d4687e" }}>チョップ</h1><p className="text-xs mt-1" style={{ color: "#c4879a" }}>セラピスト マイページ</p></div>
        <div className="rounded-2xl p-6 space-y-4" style={{ backgroundColor: "#ffffff", border: "1px solid #f0c6d0", boxShadow: "0 8px 30px rgba(232,132,154,0.12)" }}>
          {showReset ? (<>
            <div className="text-center">
              <p className="text-[14px] font-medium mb-1" style={{ color: "#d4687e" }}>🔑 パスワード再発行</p>
              <p className="text-[11px]" style={{ color: "#c4879a" }}>ご登録の電話番号を入力してください</p>
            </div>
            {!resetDone ? (<>
              <div>
                <label className="block text-[10px] mb-1.5" style={{ color: "#c4879a" }}>電話番号</label>
                <input type="tel" value={resetPhone} onChange={e => setResetPhone(e.target.value)} placeholder="090-1234-5678" className="w-full px-4 py-3 rounded-xl text-[13px] outline-none" style={{ backgroundColor: "#fdf2f5", color: "#4a3540", border: "1px solid #f0c6d0" }} />
                <p className="text-[9px] mt-1" style={{ color: "#c4879a" }}>セラピスト登録時の電話番号を入力</p>
              </div>
              {resetMsg && <p className="text-[11px] text-center" style={{ color: "#e85d75" }}>{resetMsg}</p>}
              <button onClick={handleResetPassword} disabled={loginLoading || !resetPhone.trim()} className="w-full py-3 rounded-xl text-[13px] font-medium cursor-pointer text-white disabled:opacity-50" style={{ background: "linear-gradient(135deg, #e8849a, #d4687e)" }}>{loginLoading ? "送信中..." : "パスワードを再発行"}</button>
              <button onClick={() => { setShowReset(false); setResetMsg(""); setResetPhone(""); setResetDone(false); }} className="w-full py-2 rounded-xl text-[11px] cursor-pointer" style={{ color: "#c4879a", border: "1px solid #f0c6d0" }}>← ログインに戻る</button>
            </>) : (<>
              <div className="px-4 py-4 rounded-xl text-center" style={{ backgroundColor: "#f0fdf4", border: "1px solid #bbf7d0" }}>
                <p className="text-[12px] font-medium mb-1" style={{ color: "#16a34a" }}>{resetMsg}</p>
                <p className="text-[10px] mt-2" style={{ color: "#888" }}>メールに記載のパスワードでログインしてください</p>
              </div>
              <button onClick={() => { setShowReset(false); setResetMsg(""); setResetPhone(""); setResetDone(false); }} className="w-full py-3 rounded-xl text-[13px] font-medium cursor-pointer text-white" style={{ background: "linear-gradient(135deg, #e8849a, #d4687e)" }}>ログイン画面に戻る</button>
            </>)}
          </>) : (<>
            <div><label className="block text-[10px] mb-1.5" style={{ color: "#c4879a" }}>メールアドレス</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="example@email.com" className="w-full px-4 py-3 rounded-xl text-[13px] outline-none" style={{ backgroundColor: "#fdf2f5", color: "#4a3540", border: "1px solid #f0c6d0" }} onKeyDown={(e) => e.key === "Enter" && handleLogin()} /></div>
            <div><label className="block text-[10px] mb-1.5" style={{ color: "#c4879a" }}>パスワード</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="パスワード" className="w-full px-4 py-3 rounded-xl text-[13px] outline-none" style={{ backgroundColor: "#fdf2f5", color: "#4a3540", border: "1px solid #f0c6d0" }} onKeyDown={(e) => e.key === "Enter" && handleLogin()} /></div>
            {loginError && <p className="text-[11px] text-center" style={{ color: "#e85d75" }}>{loginError}</p>}
            <button onClick={handleLogin} disabled={loginLoading} className="w-full py-3 rounded-xl text-[13px] font-medium cursor-pointer text-white disabled:opacity-50" style={{ background: "linear-gradient(135deg, #e8849a, #d4687e)" }}>{loginLoading ? "ログイン中..." : "ログイン"}</button>
          </>)}
        </div>
        {!showReset && <p className="text-center mt-4"><button onClick={() => { setShowReset(true); setResetMsg(""); setResetPhone(""); setResetDone(false); }} className="text-[10px] cursor-pointer" style={{ color: "#d4687e", background: "none", border: "none", textDecoration: "underline" }}>パスワードを忘れた方はこちら</button></p>}
      </div>
    </div>
  );

  const today = new Date().toISOString().split("T")[0]; const todayShift = shifts.find(s => s.date === today);
  const upcomingShifts = shifts.filter(s => s.date >= today).slice(0, 7);
  const monthTotal = settlements.reduce((s, stl) => s + stl.final_payment, 0);
  const monthOrders = settlements.reduce((s, stl) => s + stl.order_count, 0); const monthDays = settlements.length;
  const [smY, smM] = salaryMonth.split("-").map(Number);
  const customerVisitsAll = allReservations.reduce((acc, r) => { if (!acc[r.customer_name]) acc[r.customer_name] = { count: 0, lastDate: r.date }; acc[r.customer_name].count++; if (r.date > acc[r.customer_name].lastDate) acc[r.customer_name].lastDate = r.date; return acc; }, {} as Record<string, { count: number; lastDate: string }>);
  const uniqueCustomers = Object.entries(customerVisitsAll).sort((a, b) => b[1].count - a[1].count);

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: T.bg, color: T.text }}>
      <div className="h-[56px] flex items-center justify-between px-4 flex-shrink-0 border-b" style={{ backgroundColor: T.card, borderColor: T.border }}>
        <div className="flex items-center gap-3"><div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] text-white font-medium" style={{ background: "linear-gradient(135deg, #e8849a, #d4687e)" }}>{therapist?.name?.charAt(0) || "?"}</div><div><p className="text-[13px] font-medium">{therapist?.name}</p><p className="text-[8px]" style={{ color: T.textMuted }}>マイページ</p></div></div>
        <div className="flex items-center gap-2"><button onClick={toggle} className="px-2 py-1 text-[9px] rounded-lg cursor-pointer border" style={{ borderColor: T.border, color: T.textSub }}>{dark ? "☀️" : "🌙"}</button><button onClick={logout} className="px-3 py-1.5 text-[10px] rounded-lg cursor-pointer" style={{ backgroundColor: "#fce4ec", color: "#d4687e" }}>ログアウト</button></div>
      </div>
      <div className="flex items-center gap-1 px-4 py-2 flex-shrink-0 border-b overflow-x-auto" style={{ backgroundColor: T.card, borderColor: T.border }}>
        {(() => {
          const manualUnread = manualArticles.filter(a => a.is_published && !manualReads.includes(a.id)).length;
          return [{ key: "home" as const, label: "🏠 ホーム" }, { key: "shift" as const, label: "📝 シフト希望" }, { key: "schedule" as const, label: "📅 出勤予定" }, { key: "salary" as const, label: "💰 給料明細" }, { key: "customers" as const, label: "👤 お客様" }, { key: "manual" as const, label: manualUnread > 0 ? `📖 マニュアル(${manualUnread})` : "📖 マニュアル" }, { key: "tax" as const, label: "📊 確定申告" }].map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className="px-3 py-1.5 text-[10px] rounded-lg cursor-pointer border whitespace-nowrap" style={chipStyle(tab === t.key, "#e8849a")}>{t.label}</button>
        ));
        })()}
      </div>
      <div className="flex-1 overflow-y-auto"><div className="max-w-[600px] mx-auto p-4">

        {tab === "home" && (<div className="space-y-4">
          {todayShift ? ((() => { const bldName = getBuildingForDate(today); const rmName = getRoomForDate(today); return (<div className="rounded-2xl p-5 border" style={{ backgroundColor: "#22c55e10", borderColor: "#22c55e33" }}><p className="text-[10px] mb-1" style={{ color: "#22c55e" }}>本日の出勤</p><p className="text-[18px] font-medium">{todayShift.start_time?.slice(0,5)} 〜 {todayShift.end_time?.slice(0,5)}</p><div className="flex flex-wrap gap-x-3 mt-1 text-[11px]" style={{ color: T.textMuted }}>{todayShift.store_id > 0 && <span>🏠 {getStoreName(todayShift.store_id)}</span>}{bldName && <span>🏢 {bldName}</span>}{rmName && <span>🚪 {rmName}</span>}</div></div>); })()) : (<div className="rounded-2xl p-5 border" style={{ backgroundColor: T.card, borderColor: T.border }}><p className="text-[12px]" style={{ color: T.textMuted }}>本日の出勤予定はありません</p></div>)}
          <div className="grid grid-cols-3 gap-3">{[{ l: "今月の報酬", v: fmt(monthTotal), c: "#e8849a" }, { l: "接客数", v: `${monthOrders}件`, c: T.text }, { l: "出勤日数", v: `${monthDays}日`, c: T.text }].map(s => (<div key={s.l} className="rounded-xl p-4 border text-center" style={{ backgroundColor: T.card, borderColor: T.border }}><p className="text-[9px] mb-1" style={{ color: T.textMuted }}>{s.l}</p><p className="text-[16px] font-light" style={{ color: s.c }}>{s.v}</p></div>))}</div>

          {/* マニュアル未読通知 */}
          {(() => {
            const unreadArticles = manualArticles.filter(a => a.is_published && !manualReads.includes(a.id));
            const recentUpdates = manualUpdates.slice(0, 2);
            if (unreadArticles.length === 0 && recentUpdates.length === 0) return null;
            return (<div className="rounded-2xl border p-4 cursor-pointer" style={{ backgroundColor: "#FBEAF020", borderColor: "#e8849a44" }} onClick={() => setTab("manual")}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[12px] font-medium" style={{ color: "#e8849a" }}>📖 マニュアル</p>
                {unreadArticles.length > 0 && <span className="manual-new-badge text-[9px] px-2 py-0.5 rounded-full text-white" style={{ background: "#e8849a" }}>{unreadArticles.length}件 未読</span>}
              </div>
              {recentUpdates.map(u => {
                const art = manualArticles.find(a => a.id === u.article_id);
                return <p key={u.id} className="text-[10px] truncate" style={{ color: T.textSub }}>✏️ {art?.title}: {u.summary}</p>;
              })}
              <p className="text-[9px] mt-1" style={{ color: "#e8849a" }}>タップして確認 →</p>
            </div>);
          })()}

          {/* 本日のオーダー */}
          <div className="rounded-2xl border p-4" style={{ backgroundColor: T.card, borderColor: T.border }}>
            <p className="text-[11px] font-medium mb-2" style={{ color: T.textSub }}>📋 本日のオーダー（{todayOrders.length}件）</p>
            {/* 説明テキスト */}
            <div className="rounded-lg p-3 mb-3" style={{ backgroundColor: T.cardAlt, border: `1px solid ${T.border}` }}>
              <p className="text-[10px] m-0" style={{ color: T.textMuted, lineHeight: 1.7 }}>
                🔔 お客様が<strong style={{ color: T.text }}>来店されたら「入室」ボタン</strong>を押してください。<br />
                🚪 お客様が<strong style={{ color: T.text }}>退室されたら「退室」ボタン</strong>を押してください。<br />
                <span style={{ color: T.textFaint }}>※ 間違えた場合は「取り消し」で元に戻せます。</span>
              </p>
            </div>
            {todayOrders.length === 0 ? (
              <p className="text-[11px] text-center py-4" style={{ color: T.textFaint }}>本日のオーダーはありません</p>
            ) : (
              <div className="space-y-3">
                {todayOrders.map(r => {
                  const custSt = (r as any).customer_status || "unsent";
                  const isServing = custSt === "serving";
                  const isCompleted = custSt === "completed" || (r as any).status === "completed";
                  const statusLabel = isCompleted ? "✅ 終了" : isServing ? "💆 接客中" : "⏳ 予約済";
                  const statusColor = isCompleted ? "#22c55e" : isServing ? "#e8849a" : T.textMuted;
                  return (
                    <div key={r.id} className="rounded-xl p-4 border" style={{ borderColor: isServing ? "#e8849a44" : isCompleted ? "#22c55e33" : T.border, backgroundColor: isServing ? "#e8849a08" : isCompleted ? "#22c55e08" : T.cardAlt }}>
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="text-[14px] font-medium">{r.start_time?.slice(0,5)} 〜 {r.end_time?.slice(0,5)}</p>
                          <p className="text-[11px] mt-0.5" style={{ color: T.textSub }}>👤 {r.customer_name}</p>
                          <div className="flex flex-wrap gap-x-3 mt-1 text-[10px]" style={{ color: T.textMuted }}>
                            <span>📋 {r.course}</span>
                            {(r as any).nomination && (r as any).nomination !== "フリー" && <span>⭐ {(r as any).nomination}</span>}
                            {(r as any).extension_name && <span>⏱ +{(r as any).extension_name}</span>}
                            {(r as any).options_text && <span>🎁 {(r as any).options_text}</span>}
                          </div>
                          {r.notes && <p className="text-[9px] mt-1" style={{ color: "#f59e0b" }}>📝 {r.notes.split("\n")[0]}</p>}
                        </div>
                        <span className="text-[10px] px-2.5 py-1 rounded-full font-medium" style={{ backgroundColor: statusColor + "18", color: statusColor }}>{statusLabel}</span>
                      </div>
                      {/* ボタンエリア */}
                      <div className="flex gap-2 mt-2">
                        {!isServing && !isCompleted && (
                          <button onClick={async () => {
                            await supabase.from("reservations").update({ customer_status: "serving", therapist_status: "serving" }).eq("id", r.id);
                            setTodayOrders(prev => prev.map(o => o.id === r.id ? { ...o, customer_status: "serving", therapist_status: "serving" } as any : o));
                          }} className="flex-1 py-2.5 rounded-xl text-[12px] font-medium cursor-pointer text-white" style={{ background: "linear-gradient(135deg, #e8849a, #d4708a)" }}>
                            🔔 入室（接客開始）
                          </button>
                        )}
                        {isServing && (<>
                          <button onClick={async () => {
                            await supabase.from("reservations").update({ customer_status: "completed", therapist_status: "completed", status: "completed" }).eq("id", r.id);
                            setTodayOrders(prev => prev.map(o => o.id === r.id ? { ...o, customer_status: "completed", therapist_status: "completed", status: "completed" } as any : o));
                            fetchData();
                          }} className="flex-1 py-2.5 rounded-xl text-[12px] font-medium cursor-pointer text-white" style={{ background: "linear-gradient(135deg, #22c55e, #16a34a)" }}>
                            🚪 退室（接客終了）
                          </button>
                          <button onClick={async () => {
                            await supabase.from("reservations").update({ customer_status: "detail_read", therapist_status: "detail_sent" }).eq("id", r.id);
                            setTodayOrders(prev => prev.map(o => o.id === r.id ? { ...o, customer_status: "detail_read", therapist_status: "detail_sent" } as any : o));
                          }} className="px-3 py-2.5 rounded-xl text-[10px] cursor-pointer" style={{ backgroundColor: T.cardAlt, color: T.textMuted, border: `1px solid ${T.border}` }}>
                            ↩ 取消
                          </button>
                        </>)}
                        {isCompleted && (
                          <button onClick={async () => {
                            await supabase.from("reservations").update({ customer_status: "serving", therapist_status: "serving", status: "unprocessed" }).eq("id", r.id);
                            setTodayOrders(prev => prev.map(o => o.id === r.id ? { ...o, customer_status: "serving", therapist_status: "serving", status: "unprocessed" } as any : o));
                            fetchData();
                          }} className="px-4 py-2 rounded-xl text-[10px] cursor-pointer" style={{ backgroundColor: T.cardAlt, color: T.textMuted, border: `1px solid ${T.border}` }}>
                            ↩ 退室を取り消す
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* カレンダー */}
          {(() => {
            const [cy, cm] = calMonth.split("-").map(Number);
            const calDim = new Date(cy, cm, 0).getDate();
            const firstDow = new Date(cy, cm - 1, 1).getDay();
            const cells: (string | null)[] = [];
            for (let i = 0; i < firstDow; i++) cells.push(null);
            for (let d = 1; d <= calDim; d++) cells.push(`${calMonth}-${String(d).padStart(2, "0")}`);
            while (cells.length % 7 !== 0) cells.push(null);
            const calTotal = calSettlements.reduce((s, stl) => s + stl.final_payment, 0);
            const calOrders = calReservations.length;
            const calDays = calSettlements.length;

            return (
              <div className="rounded-2xl border p-4" style={{ backgroundColor: T.card, borderColor: T.border }}>
                <div className="flex items-center justify-between mb-3">
                  <button onClick={() => { const d = new Date(cy, cm - 2, 1); setCalMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`); }}
                    className="px-2 py-1 text-[11px] cursor-pointer rounded border" style={{ borderColor: T.border, color: T.textSub }}>◀</button>
                  <div className="text-center">
                    <span className="text-[13px] font-medium">{cy}年{cm}月</span>
                    <div className="flex items-center gap-3 justify-center mt-0.5">
                      <span className="text-[9px]" style={{ color: "#e8849a" }}>{fmt(calTotal)}</span>
                      <span className="text-[9px]" style={{ color: T.textMuted }}>{calOrders}件</span>
                      <span className="text-[9px]" style={{ color: T.textMuted }}>{calDays}日出勤</span>
                    </div>
                  </div>
                  <button onClick={() => { const d = new Date(cy, cm, 1); setCalMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`); }}
                    className="px-2 py-1 text-[11px] cursor-pointer rounded border" style={{ borderColor: T.border, color: T.textSub }}>▶</button>
                </div>

                <div className="grid grid-cols-7 gap-0.5">
                  {["日", "月", "火", "水", "木", "金", "土"].map((d, i) => (
                    <div key={d} className="text-center text-[9px] py-1 font-medium" style={{ color: i === 0 ? "#c45555" : i === 6 ? "#3d6b9f" : T.textMuted }}>{d}</div>
                  ))}
                  {cells.map((date, i) => {
                    if (!date) return <div key={`e-${i}`} className="p-0.5" />;
                    const dt = new Date(date + "T00:00:00");
                    const dayNum = dt.getDate();
                    const dow = dt.getDay();
                    const isToday2 = date === today;
                    const shift = calShifts.find(s => s.date === date);
                    const settlement = calSettlements.find(s => s.date === date);
                    const dayRes = calReservations.filter(r => r.date === date);
                    const hasWork = !!shift;
                    const hasSettled = !!settlement;
                    const custCount = dayRes.length;
                    const uniqueCust = new Set(dayRes.map(r => r.customer_name)).size;

                    return (
                      <div key={date} onClick={() => setCalDetailDate(date)} className="rounded-lg p-1 text-center min-h-[58px] flex flex-col cursor-pointer hover:opacity-80"
                        style={{
                          backgroundColor: isToday2 ? "#e8849a15" : hasSettled ? "#22c55e08" : hasWork ? "#e091a808" : "transparent",
                          border: isToday2 ? "1.5px solid #e8849a" : hasWork ? `1px solid ${T.border}` : "1px solid transparent",
                        }}>
                        <span className="text-[11px] font-medium" style={{ color: dow === 0 ? "#c45555" : dow === 6 ? "#3d6b9f" : T.text }}>{dayNum}</span>
                        {hasWork && (
                          <span className="text-[7px] mt-0.5" style={{ color: "#e091a8" }}>
                            {shift.start_time?.slice(0,5)}〜
                          </span>
                        )}
                        {hasSettled && (
                          <span className="text-[7px] font-medium" style={{ color: "#e8849a" }}>
                            {fmt(settlement.final_payment)}
                          </span>
                        )}
                        {custCount > 0 && (
                          <span className="text-[7px]" style={{ color: "#22c55e" }}>
                            👤{uniqueCust}名{custCount > uniqueCust ? `(${custCount})` : ""}
                          </span>
                        )}
                        {hasWork && !hasSettled && date < today && (
                          <span className="text-[6px]" style={{ color: "#f59e0b" }}>未清算</span>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center gap-4 mt-3 pt-2 justify-center flex-wrap" style={{ borderTop: `1px solid ${T.border}` }}>
                  <span className="flex items-center gap-1 text-[8px]" style={{ color: T.textMuted }}><span className="w-2 h-2 rounded-sm" style={{ backgroundColor: "#e091a820", border: "1px solid #e091a8" }} /> 出勤予定</span>
                  <span className="flex items-center gap-1 text-[8px]" style={{ color: T.textMuted }}><span className="w-2 h-2 rounded-sm" style={{ backgroundColor: "#22c55e15" }} /> 清算済み</span>
                  <span className="flex items-center gap-1 text-[8px]" style={{ color: "#e8849a" }}><span className="w-2 h-2 rounded-sm" style={{ backgroundColor: "#e8849a20", border: "1.5px solid #e8849a" }} /> 今日</span>
                  <span className="flex items-center gap-1 text-[8px]" style={{ color: "#f59e0b" }}>⚠ 未清算</span>
                </div>
              </div>
            );
          })()}

          {upcomingShifts.length > 0 && (<div className="rounded-2xl border p-4" style={{ backgroundColor: T.card, borderColor: T.border }}><p className="text-[11px] font-medium mb-3">直近の出勤予定</p><div className="space-y-1.5">{upcomingShifts.map(s => (<div key={s.id} className="flex items-center justify-between py-1.5 px-2 rounded-lg" style={{ backgroundColor: T.cardAlt }}><span className="text-[11px]">{formatDate(s.date)}</span><div className="flex items-center gap-2">{s.store_id > 0 && <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "#f8bbd018", color: "#e091a8" }}>{getStoreShort(s.store_id)}</span>}<span className="text-[11px] font-medium">{s.start_time?.slice(0,5)} 〜 {s.end_time?.slice(0,5)}</span></div></div>))}</div></div>)}
        </div>)}

        {tab === "shift" && (<div className="space-y-4">
          <div className="flex items-center justify-between"><h2 className="text-[14px] font-medium">📝 シフト希望提出</h2><div className="flex items-center gap-2"><button onClick={() => setWeekOffset(Math.max(1, weekOffset - 1))} className="px-2 py-1 text-[11px] cursor-pointer rounded border" style={{ borderColor: T.border, color: T.textSub }}>◀</button><span className="text-[11px] font-medium min-w-[120px] text-center">{formatDate(weekDates[0])} 〜 {formatDate(weekDates[6])}</span><button onClick={() => setWeekOffset(weekOffset + 1)} className="px-2 py-1 text-[11px] cursor-pointer rounded border" style={{ borderColor: T.border, color: T.textSub }}>▶</button></div></div>
          {/* 説明テキスト */}
          <div className="rounded-xl p-3" style={{ backgroundColor: T.cardAlt, border: `1px solid ${T.border}` }}>
            <p className="text-[10px] m-0" style={{ color: T.textMuted, lineHeight: 1.8 }}>
              出勤希望の日にチェックを入れ、時間と店舗を選択してください。<br />
              希望シフトが決まったら<strong style={{ color: T.text }}>「シフト希望を提出」ボタン</strong>を押してお店に提出してください。<br />
              提出後、<strong style={{ color: "#e091a8" }}>LINEでお店にもご報告をお願いします</strong>。（📋 LINE用コピーで簡単に送れます）
            </p>
          </div>
          <div className="space-y-2">{weekDates.map(d => { const draft = reqDrafts[d]; if (!draft) return null; const dt = new Date(d + "T00:00:00"); const dow = ["日","月","火","水","木","金","土"][dt.getDay()]; const isSun = dt.getDay() === 0; const isSat = dt.getDay() === 6; const existing = shiftRequests.find(r => r.date === d);
            return (<div key={d} className="rounded-xl border p-3" style={{ backgroundColor: draft.enabled ? "#e8849a10" : T.card, borderColor: draft.enabled ? "#e8849a44" : T.border }}>
              <div className="flex items-center gap-2 mb-1"><button onClick={() => setReqDrafts({ ...reqDrafts, [d]: { ...draft, enabled: !draft.enabled } })} className="text-[14px] cursor-pointer flex-shrink-0" style={{ background: "none", border: "none" }}>{draft.enabled ? "✅" : "⬜"}</button><span className="text-[13px] font-medium min-w-[70px]" style={{ color: isSun ? "#c45555" : isSat ? "#3d6b9f" : T.text }}>{dt.getDate()}日 ({dow})</span>{existing && <span className="text-[8px] px-1.5 py-0.5 rounded ml-auto" style={{ backgroundColor: existing.status === "approved" ? "#22c55e18" : existing.status === "rejected" ? "#c4555518" : "#f59e0b18", color: existing.status === "approved" ? "#22c55e" : existing.status === "rejected" ? "#c45555" : "#f59e0b" }}>{existing.status === "approved" ? "承認済" : existing.status === "rejected" ? "却下" : "提出済"}</span>}</div>
              {draft.enabled && (<div className="flex items-center gap-1.5 ml-7 flex-wrap"><select value={draft.store_id} onChange={(e) => setReqDrafts({ ...reqDrafts, [d]: { ...draft, store_id: Number(e.target.value) } })} className="px-2 py-1.5 rounded-lg text-[10px] outline-none cursor-pointer border" style={{ backgroundColor: T.cardAlt, borderColor: "#e091a844", color: "#e091a8", fontWeight: 600 }}><option value={0}>店舗未選択</option>{stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select><select value={draft.start} onChange={(e) => setReqDrafts({ ...reqDrafts, [d]: { ...draft, start: e.target.value } })} className="px-2 py-1.5 rounded-lg text-[11px] outline-none cursor-pointer border" style={{ backgroundColor: T.cardAlt, borderColor: T.border, color: T.text }}>{TIMES.map(t => <option key={t} value={t}>{t}</option>)}</select><span className="text-[10px]" style={{ color: T.textMuted }}>〜</span><select value={draft.end} onChange={(e) => setReqDrafts({ ...reqDrafts, [d]: { ...draft, end: e.target.value } })} className="px-2 py-1.5 rounded-lg text-[11px] outline-none cursor-pointer border" style={{ backgroundColor: T.cardAlt, borderColor: T.border, color: T.text }}>{TIMES.map(t => <option key={t} value={t}>{t}</option>)}</select><input type="text" value={draft.notes} onChange={(e) => setReqDrafts({ ...reqDrafts, [d]: { ...draft, notes: e.target.value } })} placeholder="備考" className="flex-1 px-2 py-1.5 rounded-lg text-[10px] outline-none border min-w-[60px]" style={{ backgroundColor: T.cardAlt, borderColor: T.border, color: T.text }} /></div>)}
            </div>); })}</div>
          {reqMsg && <p className="text-[11px] text-center" style={{ color: "#22c55e" }}>{reqMsg}</p>}
          <div className="flex gap-2"><button onClick={submitShiftRequests} disabled={reqSaving} className="flex-1 py-3 rounded-xl text-[12px] font-medium cursor-pointer text-white disabled:opacity-50" style={{ background: "linear-gradient(135deg, #e8849a, #d4687e)" }}>{reqSaving ? "送信中..." : "シフト希望を提出"}</button><button onClick={copyShiftToClipboard} className="px-4 py-3 rounded-xl text-[11px] font-medium cursor-pointer border" style={{ borderColor: copiedShift ? "#22c55e" : "#e091a844", color: copiedShift ? "#22c55e" : "#e091a8", backgroundColor: copiedShift ? "#22c55e18" : "transparent" }}>{copiedShift ? "✅ コピー済" : "📋 LINE用コピー"}</button></div>
          {weekDates.some(d => reqDrafts[d]?.enabled) && (<div className="rounded-xl border p-3" style={{ backgroundColor: T.cardAlt, borderColor: T.border }}><p className="text-[9px] font-medium mb-1" style={{ color: T.textMuted }}>📋 コピー内容プレビュー</p><pre className="text-[10px] whitespace-pre-wrap" style={{ color: T.textSub }}>{generateShiftCopyText()}</pre></div>)}
        </div>)}

        {tab === "schedule" && (<div className="space-y-4">
          <h2 className="text-[14px] font-medium">📅 確定シフト</h2>
          {shifts.length === 0 ? <p className="text-[12px] text-center py-8" style={{ color: T.textFaint }}>確定シフトがありません</p> : (<div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: T.card, borderColor: T.border }}>{shifts.map(s => { const bld = getBuildingForDate(s.date); return (<div key={s.id} className="flex items-center justify-between px-4 py-3" style={{ borderBottom: `1px solid ${T.border}` }}><div className="flex items-center gap-3 flex-wrap"><span className="text-[12px] font-medium min-w-[80px]">{formatDate(s.date)}</span>{s.store_id > 0 && <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "#f8bbd018", color: "#e091a8" }}>{getStoreShort(s.store_id)}</span>}{bld && <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "#85a8c418", color: "#85a8c4" }}>🏢 {bld}</span>}<span className="text-[12px]">{s.start_time?.slice(0,5)} 〜 {s.end_time?.slice(0,5)}</span></div>{s.date === today && <span className="text-[9px] px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: "#e8849a" }}>今日</span>}</div>); })}</div>)}
          {shiftRequests.filter(r => r.status === "pending").length > 0 && (<div className="rounded-2xl border p-4" style={{ backgroundColor: "#f59e0b10", borderColor: "#f59e0b33" }}><p className="text-[11px] font-medium mb-2" style={{ color: "#f59e0b" }}>⏳ 承認待ちのシフト希望</p>{shiftRequests.filter(r => r.status === "pending").map(r => (<div key={r.id} className="flex items-center justify-between py-1 text-[11px]"><span>{formatDate(r.date)}</span><div className="flex items-center gap-2">{r.store_id > 0 && <span className="text-[9px]" style={{ color: "#e091a8" }}>{getStoreShort(r.store_id)}</span>}<span>{r.start_time} 〜 {r.end_time}</span></div></div>))}</div>)}
        </div>)}

        {tab === "salary" && (<div className="space-y-4">
          <div className="flex items-center justify-between"><h2 className="text-[14px] font-medium">💰 給料明細</h2><div className="flex items-center gap-2"><button onClick={() => { const d = new Date(smY, smM - 2, 1); setSalaryMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`); }} className="px-2 py-1 text-[11px] cursor-pointer rounded border" style={{ borderColor: T.border, color: T.textSub }}>◀</button><span className="text-[12px] font-medium">{smY}年{smM}月</span><button onClick={() => { const d = new Date(smY, smM, 1); setSalaryMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`); }} className="px-2 py-1 text-[11px] cursor-pointer rounded border" style={{ borderColor: T.border, color: T.textSub }}>▶</button></div></div>
          <div className="grid grid-cols-3 gap-3">{[{ l: "月合計", v: fmt(monthTotal), c: "#e8849a" }, { l: "接客数", v: `${monthOrders}件`, c: T.text }, { l: "出勤日数", v: `${monthDays}日`, c: T.text }].map(s => (<div key={s.l} className="rounded-xl p-4 border text-center" style={{ backgroundColor: T.card, borderColor: T.border }}><p className="text-[9px] mb-1" style={{ color: T.textMuted }}>{s.l}</p><p className="text-[18px] font-light" style={{ color: s.c }}>{s.v}</p></div>))}</div>
          {settlements.length === 0 ? <p className="text-[12px] text-center py-8" style={{ color: T.textFaint }}>清算データがありません</p> : (<div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: T.card, borderColor: T.border }}>{settlements.map(stl => (<div key={stl.id} className="px-4 py-3" style={{ borderBottom: `1px solid ${T.border}` }}><div className="flex items-center justify-between mb-1"><span className="text-[12px] font-medium">{formatDate(stl.date)}</span><span className="text-[14px] font-medium" style={{ color: "#e8849a" }}>{fmt(stl.final_payment)}</span></div><div className="flex items-center gap-3 text-[9px] flex-wrap" style={{ color: T.textMuted }}><span>{stl.order_count}件</span><span>売上{fmt(stl.total_sales)}</span><span>バック{fmt(stl.total_back)}</span>{stl.invoice_deduction > 0 && <span style={{ color: "#c45555" }}>INV-{fmt(stl.invoice_deduction)}</span>}{stl.withholding_tax > 0 && <span style={{ color: "#c45555" }}>源泉-{fmt(stl.withholding_tax)}</span>}{stl.welfare_fee > 0 && <span style={{ color: "#c45555" }}>厚生-{fmt(stl.welfare_fee)}</span>}{stl.transport_fee > 0 && <span style={{ color: "#22c55e" }}>交通+{fmt(stl.transport_fee)}</span>}</div></div>))}</div>)}
        </div>)}

        {tab === "customers" && (<div className="space-y-4">
          <div className="flex items-center justify-between"><h2 className="text-[14px] font-medium">👤 お客様メモ・NG</h2><button onClick={() => { setShowAddNote(true); setNoteForm({ customer_name: "", note: "", is_ng: false, ng_reason: "", rating: 0, reservation_id: 0 }); }} className="px-3 py-1.5 text-[10px] rounded-lg cursor-pointer text-white" style={{ backgroundColor: "#e8849a" }}>+ メモ追加</button></div>
          <div className="rounded-xl p-3" style={{ backgroundColor: "#85a8c410", border: "1px solid #85a8c430" }}>
            <p className="text-[11px] font-medium mb-1" style={{ color: "#85a8c4" }}>🛡️ NG登録について</p>
            <p className="text-[10px] leading-relaxed" style={{ color: T.textSub }}>NGに登録されたお客様がネット予約をする際は、あなたの出勤枠が<span style={{ color: "#c45555", fontWeight: 600 }}>「お休み」として表示</span>されるため、予約が入ることはありません。お電話でのご予約の場合も、受付スタッフが事前に確認しお断りいたしますのでご安心ください。</p>
          </div>
          <input type="text" value={noteSearch} onChange={(e) => setNoteSearch(e.target.value)} placeholder="お客様名で検索..." className="w-full px-4 py-2.5 rounded-xl text-[12px] outline-none border" style={{ backgroundColor: T.cardAlt, borderColor: T.border, color: T.text }} />
          {uniqueCustomers.length > 0 && (<div className="rounded-2xl border p-4" style={{ backgroundColor: T.card, borderColor: T.border }}><p className="text-[10px] font-medium mb-2" style={{ color: T.textMuted }}>接客したお客様（全{uniqueCustomers.length}名）</p><div className="flex flex-wrap gap-1.5">{uniqueCustomers.filter(([name]) => !noteSearch || name.includes(noteSearch)).map(([name, info]) => { const notes = customerNotes.filter(n => n.customer_name === name); const isNg = notes.some(n => n.is_ng); const hasNote = notes.length > 0; return (<button key={name} onClick={() => setNoteHistoryCustomer(name)} className="px-2.5 py-1.5 rounded-lg text-[10px] cursor-pointer border" style={{ backgroundColor: isNg ? "#c4555515" : hasNote ? "#e8849a15" : T.cardAlt, borderColor: isNg ? "#c4555544" : hasNote ? "#e8849a44" : T.border, color: isNg ? "#c45555" : T.text }}>{isNg && "🚫"}{name}({info.count}回){notes.length > 0 && (" 📝" + (notes.length > 1 ? notes.length : ""))}</button>); })}</div></div>)}
          <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: T.card, borderColor: T.border }}><div className="px-4 py-2.5 border-b" style={{ borderColor: T.border }}><p className="text-[11px] font-medium">登録済みメモ（{customerNotes.length}件）</p><p className="text-[8px]" style={{ color: T.textFaint }}>※ メモの削除はスタッフにお申し付けください</p></div>
            {customerNotes.filter(n => !noteSearch || n.customer_name.includes(noteSearch)).length === 0 ? <p className="text-[12px] text-center py-6" style={{ color: T.textFaint }}>メモがありません</p> : customerNotes.filter(n => !noteSearch || n.customer_name.includes(noteSearch)).map(n => { const res = n.reservation_id ? allReservations.find(r => r.id === n.reservation_id) : null; return (<div key={n.id} className="px-4 py-3 cursor-pointer" style={{ borderBottom: `1px solid ${T.border}` }} onClick={() => setNoteHistoryCustomer(n.customer_name)}><div className="flex items-center gap-2"><span className="text-[12px] font-medium">{n.customer_name}</span>{n.is_ng && <span className="text-[8px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "#c4555518", color: "#c45555" }}>🚫 NG</span>}{n.rating > 0 && <span className="text-[9px]" style={{ color: "#f59e0b" }}>{"★".repeat(n.rating)}</span>}{res && <span className="text-[9px]" style={{ color: T.textMuted }}>{formatDate(res.date)}</span>}</div>{n.note && <p className="text-[10px] mt-0.5 truncate" style={{ color: T.textSub }}>{n.note}</p>}</div>); })}
          </div>
        </div>)}

        {tab === "manual" && (<div className="space-y-4">
          {/* マニュアル詳細表示 */}
          {manualViewArticle ? (() => {
            const cat = manualCats.find(c => c.id === manualViewArticle.category_id);
            const latestUpd = manualUpdates.find(u => u.article_id === manualViewArticle.id);
            return (<div>
              <div className="flex gap-2 mb-3">
                <button onClick={goBackManual} className="px-3 py-1.5 text-[10px] rounded-lg cursor-pointer border" style={{ borderColor: T.border, color: T.textSub }}>
                  {manualHistory.length > 0 ? `← ${manualHistory[manualHistory.length - 1].title.slice(0, 12)}${manualHistory[manualHistory.length - 1].title.length > 12 ? '...' : ''} に戻る` : '← 一覧に戻る'}
                </button>
                {manualHistory.length > 0 && (
                  <button onClick={() => { setManualViewArticle(null); setManualHistory([]); }} className="px-3 py-1.5 text-[10px] rounded-lg cursor-pointer border" style={{ borderColor: T.border, color: T.textMuted }}>
                    📋 一覧へ
                  </button>
                )}
              </div>
              {manualViewArticle.cover_image && <div className="rounded-xl overflow-hidden mb-3" style={{ maxHeight: 200 }}><img src={manualViewArticle.cover_image} alt="" style={{ width: "100%", objectFit: "cover" }} /></div>}
              <h2 className="text-[18px] font-semibold mb-2">{manualViewArticle.title}</h2>
              <div className="flex items-center gap-2 flex-wrap mb-3">
                {cat && <span className="text-[10px] px-2 py-0.5 rounded-lg" style={{ background: cat.color, color: "#333" }}>{cat.icon} {cat.name}</span>}
                {manualViewArticle.tags.map(t => <span key={t} className="text-[10px] px-2 py-0.5 rounded-lg" style={{ background: dark ? "#3a3a42" : "#f0eee8", color: T.textSub }}>{t}</span>)}
              </div>
              {latestUpd && <div className="rounded-xl p-3 mb-3" style={{ background: "#FAEEDA", border: "1px solid #f59e0b33" }}><span className="text-[11px]" style={{ color: "#854F0B" }}>✏️ {new Date(latestUpd.created_at).toLocaleDateString("ja")} 更新: {latestUpd.summary}</span></div>}
              {/* 本文レンダリング */}
              <div className="rounded-2xl border p-4 mb-3" style={{ backgroundColor: T.card, borderColor: T.border }}>
                {manualViewArticle.content.split("\n").map((line, i) => {
                  if (line.startsWith("## ")) return <h3 key={i} className="text-[15px] font-semibold mt-3 mb-1" style={{ color: "#e8849a" }}>{renderInlineLinks(line.slice(3))}</h3>;
                  if (line.startsWith("### ")) return <h4 key={i} className="text-[13px] font-medium mt-2 mb-1" style={{ color: T.accent }}>{renderInlineLinks(line.slice(4))}</h4>;
                  if (line.startsWith("- ")) return <div key={i} className="flex gap-2 text-[13px] leading-relaxed ml-2"><span style={{ color: "#e8849a" }}>●</span><span>{renderInlineContent(line.slice(2))}</span></div>;
                  if (line.match(/^\d+\.\s/)) return <div key={i} className="flex gap-2 text-[13px] leading-relaxed ml-2"><span style={{ color: "#e8849a", fontWeight: 600, minWidth: 18 }}>{line.match(/^(\d+)\./)?.[1]}.</span><span>{renderInlineContent(line.replace(/^\d+\.\s/, ""))}</span></div>;
                  if (line.startsWith("> ")) return <div key={i} style={{ borderLeft: "3px solid #e8849a", paddingLeft: 12, margin: "6px 0", fontSize: 13, color: T.textSub, fontStyle: "italic" }}>{renderInlineContent(line.slice(2))}</div>;
                  if (line.trim() === "---") return <hr key={i} style={{ border: "none", borderTop: `1px solid ${T.border}`, margin: "12px 0" }} />;
                  if (line.startsWith("![")) { const m = line.match(/!\[.*?\]\((.*?)\)/); if (m) return <img key={i} src={m[1]} alt="" className="rounded-xl my-2" style={{ maxWidth: "100%" }} />; }
                  if (line.match(/^\[youtube:([\w-]+)\]$/)) { const vid = line.match(/^\[youtube:([\w-]+)\]$/)?.[1]; return <div key={i} style={{ position: "relative", paddingBottom: "56.25%", height: 0, margin: "8px 0", borderRadius: 12, overflow: "hidden" }}><iframe src={`https://www.youtube.com/embed/${vid}`} style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: "none" }} allowFullScreen /></div>; }
                  if (line.match(/^\[gdrive:([\w-]+)(:.*)?\]$/)) { const gm = line.match(/^\[gdrive:([\w-]+)(?::(.+))?\]$/); const fid = gm?.[1]; const gdesc = gm?.[2] || ""; return <div key={i} style={{ margin: "12px 0" }}><div style={{ position: "relative", paddingBottom: "56.25%", height: 0, borderRadius: 12, overflow: "hidden" }}><iframe src={`https://drive.google.com/file/d/${fid}/preview`} style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: "none" }} allow="autoplay" /></div>{gdesc && <p className="text-[11px] font-medium mt-1 text-center" style={{ color: "#e8849a" }}>🎬 {gdesc}</p>}</div>; }
                  if (line.match(/\*\*(.*?)\*\*/)) { return <p key={i} className="text-[13px] leading-relaxed">{renderInlineContent(line)}</p>; }
                  if (line.trim() === "") return <div key={i} className="h-2" />;
                  return <p key={i} className="text-[13px] leading-relaxed">{renderInlineContent(line)}</p>;
                })}
              </div>
              {/* Q&A */}
              {manualViewQAs.length > 0 && (<div className="rounded-2xl border p-4" style={{ backgroundColor: T.card, borderColor: T.border }}>
                <h3 className="text-[13px] font-semibold mb-3" style={{ color: "#e8849a" }}>❓ よくある質問（{manualViewQAs.length}件）</h3>
                {manualViewQAs.map((qa, i) => (
                  <div key={i} className="rounded-xl border mb-2" style={{ borderColor: T.border, overflow: "hidden" }}>
                    <button className="w-full text-left px-3 py-2.5 flex items-center gap-2 text-[12px] font-medium cursor-pointer" style={{ background: manualOpenQA === i ? (dark ? "#3a3a42" : "#fef9f0") : "transparent" }} onClick={() => setManualOpenQA(manualOpenQA === i ? null : i)}>
                      <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "#e8849a20", color: "#e8849a" }}>Q</span>
                      <span style={{ flex: 1, color: T.text }}>{qa.question}</span>
                      <span style={{ color: T.textMuted, fontSize: 10, transition: "transform 0.2s", transform: manualOpenQA === i ? "rotate(90deg)" : "none" }}>▶</span>
                    </button>
                    {manualOpenQA === i && <div className="px-3 pb-3 pt-1 text-[12px] leading-relaxed" style={{ color: T.textSub, borderTop: `1px solid ${T.border}` }}><span className="text-[10px] px-1.5 py-0.5 rounded mr-1" style={{ background: "#4a7c5920", color: "#4a7c59" }}>A</span>{qa.answer}</div>}
                  </div>
                ))}
              </div>)}
            </div>);
          })() : (<div>
            {/* 更新タイムライン */}
            {manualUpdates.length > 0 && (<div className="rounded-2xl border p-4" style={{ backgroundColor: T.card, borderColor: T.border }}>
              <h3 className="text-[13px] font-semibold mb-2">📝 最近の更新</h3>
              {manualUpdates.slice(0, 3).map(u => {
                const art = manualArticles.find(a => a.id === u.article_id);
                return (<div key={u.id} className="flex gap-2 py-1.5" style={{ borderBottom: `1px solid ${T.border}` }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#e8849a", marginTop: 5, flexShrink: 0 }} />
                  <div><span className="text-[12px] font-medium cursor-pointer" style={{ color: "#e8849a" }} onClick={() => { if (art) openManualArticle(art); }}>{art?.title || "?"}</span><span className="text-[10px] ml-1" style={{ color: T.textMuted }}>{u.summary}</span><div className="text-[9px]" style={{ color: T.textFaint }}>{new Date(u.created_at).toLocaleDateString("ja")}</div></div>
                </div>);
              })}
            </div>)}
            {/* 検索 */}
            <input type="text" value={manualSearch} onChange={e => setManualSearch(e.target.value)} placeholder="🔍 マニュアルを検索..." className="w-full px-4 py-2.5 rounded-xl text-[12px] outline-none border" style={{ backgroundColor: T.cardAlt, borderColor: T.border, color: T.text }} />
            {/* カテゴリフィルタ */}
            <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ WebkitOverflowScrolling: "touch" }}>
              <button onClick={() => setManualSelCat(null)} className="px-3 py-1.5 text-[10px] rounded-lg cursor-pointer whitespace-nowrap border" style={chipStyle(manualSelCat === null, "#e8849a")}>すべて</button>
              {manualCats.map(c => (<button key={c.id} onClick={() => setManualSelCat(c.id)} className="px-3 py-1.5 text-[10px] rounded-lg cursor-pointer whitespace-nowrap border" style={{ ...chipStyle(manualSelCat === c.id, "#e8849a"), ...(manualSelCat !== c.id ? { borderColor: c.color } : {}) }}>{c.icon} {c.name}</button>))}
            </div>
            {/* タグフィルタ */}
            {(() => { const allT = Array.from(new Set(manualArticles.flatMap(a => a.tags))).sort(); return allT.length > 0 ? (
              <div className="flex gap-1 flex-wrap">
                <span className="text-[9px] leading-[22px]" style={{ color: T.textMuted }}>🏷️</span>
                {manualFilterTag && <button onClick={() => setManualFilterTag("")} className="text-[9px] px-2 py-0.5 rounded-lg cursor-pointer border" style={{ borderColor: T.border, color: T.textSub }}>× クリア</button>}
                {allT.map(t => <button key={t} onClick={() => setManualFilterTag(manualFilterTag === t ? "" : t)} className="text-[9px] px-2 py-0.5 rounded-lg cursor-pointer" style={{ background: manualFilterTag === t ? "#e8849a" : (dark ? "#3a3a42" : "#f0eee8"), color: manualFilterTag === t ? "#fff" : T.textSub, border: "none", opacity: manualFilterTag && manualFilterTag !== t ? 0.4 : 1 }}>{t}</button>)}
              </div>
            ) : null; })()}
            {/* 記事一覧 */}
            {(() => {
              const filtered = manualArticles.filter(a => {
                if (manualSelCat !== null && a.category_id !== manualSelCat) return false;
                if (manualSearch) { const q = manualSearch.toLowerCase(); if (!a.title.toLowerCase().includes(q) && !a.tags.some(t => t.toLowerCase().includes(q))) return false; }
                if (manualFilterTag && !a.tags.includes(manualFilterTag)) return false;
                return true;
              });
              const pinned = filtered.filter(a => a.is_pinned);
              const unpinned = filtered.filter(a => !a.is_pinned);
              const renderCard = (a: ManualArticle) => {
                const cat = manualCats.find(c => c.id === a.category_id);
                const isRead = manualReads.includes(a.id);
                const latestUpd = manualUpdates.find(u => u.article_id === a.id);
                const isNew = (Date.now() - new Date(a.created_at).getTime()) < 7 * 86400000;
                const isUpdated = latestUpd && !isRead;
                return (<div key={a.id} className="rounded-2xl border p-3 cursor-pointer" style={{ backgroundColor: T.card, borderColor: isNew && !isRead ? "#e8849a55" : T.border, transition: "transform 0.15s" }} onClick={() => openManualArticle(a)}>
                  <div className="flex gap-3">
                    {a.cover_image ? <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0"><img src={a.cover_image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /></div> : <div className="w-16 h-16 rounded-xl flex-shrink-0 flex items-center justify-center text-[24px]" style={{ background: cat?.color || T.bg }}>{cat?.icon || "📄"}</div>}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="flex items-center gap-1.5 flex-wrap mb-1">
                        {a.is_pinned && <span className="text-[8px] px-1.5 py-0.5 rounded" style={{ background: "#FAEEDA", color: "#854F0B" }}>📌</span>}
                        {isNew && !isRead && <span className="manual-new-badge text-[8px] px-1.5 py-0.5 rounded" style={{ background: "#e8849a", color: "#fff" }}>🆕 NEW</span>}
                        {isUpdated && <span className="manual-updated-badge text-[8px] px-1.5 py-0.5 rounded" style={{ background: "#FAEEDA", color: "#854F0B" }}>✏️更新</span>}
                        {isRead && <span className="text-[8px]" style={{ color: "#4a7c59" }}>✅</span>}
                      </div>
                      <h4 className="text-[13px] font-semibold truncate" style={{ color: T.text }}>{a.title}</h4>
                      {a.tags.length > 0 && <div className="flex gap-1 flex-wrap mt-1">{a.tags.slice(0, 3).map(t => <span key={t} className="text-[8px] px-1.5 py-0.5 rounded" style={{ background: dark ? "#3a3a42" : "#f0eee8", color: T.textSub }}>{t}</span>)}</div>}
                    </div>
                  </div>
                </div>);
              };
              return (<div className="space-y-2">
                {pinned.map(renderCard)}
                {unpinned.map(renderCard)}
                {filtered.length === 0 && <div className="text-center py-8"><div className="text-[32px] mb-2">📖</div><p className="text-[12px]" style={{ color: T.textMuted }}>該当する記事がありません</p></div>}
              </div>);
            })()}
          </div>)}

          {/* 🤖 AIチャット */}
          {!manualViewArticle && (
            <div>
              {!aiChatOpen ? (
                <button onClick={() => setAiChatOpen(true)}
                  className="w-full py-3.5 rounded-2xl text-[13px] font-medium cursor-pointer border flex items-center justify-center gap-2"
                  style={{ background: "linear-gradient(135deg, #e8849a18, #d4687e08)", borderColor: "#e8849a44", color: "#e8849a" }}>
                  <span style={{ fontSize: 18 }}>🤖</span>
                  <span>マニュアルAIに質問する</span>
                </button>
              ) : (
                <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: T.card, borderColor: "#e8849a44", boxShadow: "0 2px 12px rgba(232,132,154,0.08)" }}>
                  {/* ヘッダー */}
                  <div className="flex items-center justify-between px-4 py-2.5 border-b" style={{ borderColor: T.border, background: "linear-gradient(135deg, #e8849a18, #d4687e08)" }}>
                    <div className="flex items-center gap-2">
                      <span style={{ fontSize: 16 }}>🤖</span>
                      <span className="text-[12px] font-semibold" style={{ color: "#e8849a" }}>マニュアルAI</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: "#4ade8033", color: "#22c55e" }}>● online</span>
                      {aiSessionCount > 0 && <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: aiSessionCount >= 4 ? "#ef444420" : "#f59e0b20", color: aiSessionCount >= 4 ? "#ef4444" : "#f59e0b" }}>{aiSessionCount >= 4 ? "質問上限" : `残り${4 - aiSessionCount}回`}</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      {aiChatMessages.length > 0 && (
                        <button onClick={() => { setAiChatMessages([]); setAiSessionCount(0); }} className="text-[9px] px-2 py-0.5 rounded cursor-pointer" style={{ color: T.textMuted, background: "none", border: `1px solid ${T.border}` }}>🗑️ クリア</button>
                      )}
                      <button onClick={() => setAiChatOpen(false)} className="text-[10px] px-2 py-0.5 rounded cursor-pointer" style={{ color: T.textMuted, background: "none", border: "none" }}>✕ 閉じる</button>
                    </div>
                  </div>
                  {/* メッセージエリア */}
                  <div style={{ maxHeight: 350, overflowY: "auto", padding: 12 }}>
                    {aiChatMessages.length === 0 && (
                      <div className="text-center py-6">
                        <div style={{ fontSize: 36, marginBottom: 8 }}>🤖</div>
                        <p className="text-[12px] font-medium" style={{ color: T.text }}>マニュアルAIアシスタント</p>
                        <p className="text-[10px] mt-1" style={{ color: T.textMuted }}>マニュアルの内容について何でも聞いてね！</p>
                        <div className="flex flex-wrap gap-1.5 justify-center mt-4">
                          {["掃除の手順を教えて", "精算方法は？", "シフトの出し方", "LAST勤務とは？", "お給料について"].map(q => (
                            <button key={q} onClick={() => { setAiChatInput(q); }}
                              className="text-[10px] px-3 py-1.5 rounded-full cursor-pointer border transition-all"
                              style={{ borderColor: "#e8849a33", color: "#e8849a", background: "transparent" }}>{q}</button>
                          ))}
                        </div>
                      </div>
                    )}
                    {aiChatMessages.map((m, i) => (
                      <div key={i} className={`flex mb-3 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                        {m.role === "ai" && <div className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center mr-2 mt-0.5" style={{ background: "#e8849a20", fontSize: 12 }}>🤖</div>}
                        <div style={{ maxWidth: "80%" }}>
                          <div className="rounded-2xl px-3.5 py-2.5 text-[12px] leading-[1.7]" style={{
                            background: m.role === "user" ? "linear-gradient(135deg, #e8849a, #d4687e)" : (dark ? "#2a2a32" : "#f8f6f3"),
                            color: m.role === "user" ? "#fff" : T.text,
                            borderBottomRightRadius: m.role === "user" ? 4 : 16,
                            borderBottomLeftRadius: m.role === "ai" ? 4 : 16,
                          }}>
                            {m.role === "ai" ? renderInlineContent(m.content) : m.content}
                          </div>
                          {m.role === "ai" && m.logId && (
                            <div className="flex gap-1.5 mt-1 ml-1">
                              <button onClick={async () => {
                                if (m.rating) return;
                                try {
                                  await fetch("/api/manual-ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "rate", logId: m.logId, rating: 1 }) });
                                  setAiChatMessages(prev => prev.map((msg, idx) => idx === i ? { ...msg, rating: 1 } : msg));
                                } catch {}
                              }} className="text-[11px] px-2 py-0.5 rounded-full cursor-pointer transition-all" style={{
                                background: m.rating === 1 ? "#4ade8030" : "transparent",
                                border: `1px solid ${m.rating === 1 ? "#4ade80" : T.border}`,
                                color: m.rating === 1 ? "#22c55e" : T.textMuted,
                                opacity: m.rating && m.rating !== 1 ? 0.3 : 1,
                              }}>👍</button>
                              <button onClick={async () => {
                                if (m.rating) return;
                                try {
                                  await fetch("/api/manual-ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "rate", logId: m.logId, rating: -1 }) });
                                  setAiChatMessages(prev => prev.map((msg, idx) => idx === i ? { ...msg, rating: -1 } : msg));
                                } catch {}
                              }} className="text-[11px] px-2 py-0.5 rounded-full cursor-pointer transition-all" style={{
                                background: m.rating === -1 ? "#ef444430" : "transparent",
                                border: `1px solid ${m.rating === -1 ? "#ef4444" : T.border}`,
                                color: m.rating === -1 ? "#ef4444" : T.textMuted,
                                opacity: m.rating && m.rating !== -1 ? 0.3 : 1,
                              }}>👎</button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    {aiChatLoading && (
                      <div className="flex justify-start mb-3">
                        <div className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center mr-2 mt-0.5" style={{ background: "#e8849a20", fontSize: 12 }}>🤖</div>
                        <div className="rounded-2xl px-3.5 py-2.5 text-[12px] flex items-center gap-2" style={{ background: dark ? "#2a2a32" : "#f8f6f3", color: T.textMuted, borderBottomLeftRadius: 4 }}>
                          <span className="inline-block" style={{ animation: "pulse 1.5s ease-in-out infinite" }}>💭</span>
                          考え中...
                          <style>{`@keyframes pulse { 0%,100% { opacity: 0.4; } 50% { opacity: 1; } }`}</style>
                        </div>
                      </div>
                    )}
                  </div>
                  {/* 入力エリア */}
                  <div className="flex gap-2 p-3 border-t items-center" style={{ borderColor: T.border, background: dark ? "#1a1a22" : "#faf9f7" }}>
                    <input type="text" value={aiChatInput} onChange={e => setAiChatInput(e.target.value)}
                      onKeyDown={async (e) => {
                        if (e.key === "Enter" && aiChatInput.trim() && !aiChatLoading) {
                          const q = aiChatInput.trim();
                          setAiChatInput("");
                          setAiChatMessages(prev => [...prev, { role: "user", content: q }]);
                          setAiChatLoading(true);
                          const newCount = aiSessionCount + 1;
                          setAiSessionCount(newCount);
                          if (newCount > 4) {
                            setAiChatMessages(prev => [...prev, { role: "ai", content: "😊 この質問はスタッフに直接お問い合わせください！\n\n何度も質問していただきありがとうございます。より正確にお答えするため、スタッフに聞いていただく方が早いかと思います📞\n\n🗑️「クリア」で会話をリセットすると、また質問できますよ！" }]);
                            setAiChatLoading(false);
                            return;
                          }
                          try {
                            const res = await fetch("/api/manual-ai", {
                              method: "POST", headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ action: "chat", question: q, chatHistory: aiChatMessages, therapistName: therapist?.name || "" }),
                            });
                            const data = await res.json();
                            setAiChatMessages(prev => [...prev, { role: "ai", content: data.answer || "応答エラー", logId: data.logId || undefined }]);
                          } catch { setAiChatMessages(prev => [...prev, { role: "ai", content: "⚠️ 通信エラーが発生しました" }]); }
                          setAiChatLoading(false);
                        }
                      }}
                      placeholder={aiListening ? "🎤 話してください..." : "質問を入力..."}
                      className="flex-1 px-3.5 py-2.5 rounded-xl text-[12px] outline-none"
                      style={{ backgroundColor: T.cardAlt, color: T.text, border: aiListening ? "1px solid #e8849a" : `1px solid ${T.border}` }} />
                    <button
                      onClick={() => {
                        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
                        if (!SpeechRecognition) { alert("お使いのブラウザは音声入力に対応していません"); return; }
                        if (aiListening) return;
                        const recognition = new SpeechRecognition();
                        recognition.lang = "ja-JP";
                        recognition.interimResults = false;
                        recognition.maxAlternatives = 1;
                        setAiListening(true);
                        recognition.onresult = (event: any) => {
                          const text = event.results[0][0].transcript;
                          setAiChatInput(prev => prev + text);
                          setAiListening(false);
                        };
                        recognition.onerror = () => setAiListening(false);
                        recognition.onend = () => setAiListening(false);
                        recognition.start();
                      }}
                      className="w-9 h-9 rounded-full flex items-center justify-center cursor-pointer flex-shrink-0"
                      style={{
                        background: aiListening ? "#e8849a" : "transparent",
                        border: aiListening ? "none" : `1px solid ${T.border}`,
                        color: aiListening ? "#fff" : "#e8849a",
                        fontSize: 16,
                        animation: aiListening ? "pulse 1s ease-in-out infinite" : "none",
                      }}
                      title="音声入力">
                      🎤
                    </button>
                    <button disabled={!aiChatInput.trim() || aiChatLoading}
                      onClick={async () => {
                        const q = aiChatInput.trim();
                        if (!q) return;
                        setAiChatInput("");
                        setAiChatMessages(prev => [...prev, { role: "user", content: q }]);
                        setAiChatLoading(true);
                        const newCount = aiSessionCount + 1;
                        setAiSessionCount(newCount);
                        if (newCount > 4) {
                          setAiChatMessages(prev => [...prev, { role: "ai", content: "😊 この質問はスタッフに直接お問い合わせください！\n\n何度も質問していただきありがとうございます。より正確にお答えするため、スタッフに聞いていただく方が早いかと思います📞\n\n🗑️「クリア」で会話をリセットすると、また質問できますよ！" }]);
                          setAiChatLoading(false);
                          return;
                        }
                        try {
                          const res = await fetch("/api/manual-ai", {
                            method: "POST", headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ action: "chat", question: q, chatHistory: aiChatMessages, therapistName: therapist?.name || "" }),
                          });
                          const data = await res.json();
                          setAiChatMessages(prev => [...prev, { role: "ai", content: data.answer || "応答エラー", logId: data.logId || undefined }]);
                        } catch { setAiChatMessages(prev => [...prev, { role: "ai", content: "⚠️ 通信エラーが発生しました" }]); }
                        setAiChatLoading(false);
                      }}
                      className="px-4 py-2.5 rounded-xl text-[11px] text-white cursor-pointer disabled:opacity-40 font-medium"
                      style={{ background: "linear-gradient(135deg, #e8849a, #d4687e)", border: "none", boxShadow: "0 2px 6px rgba(232,132,154,0.25)" }}>送信</button>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>)}

      </div></div>

{/* カレンダー日付詳細モーダル */}
      {calDetailDate && (() => {
        const dShift = calShifts.find(s => s.date === calDetailDate);
        const dSettlement = calSettlements.find(s => s.date === calDetailDate);
        const dRes = calReservations.filter(r => r.date === calDetailDate);
        const dNotes = dRes.map(r => customerNotes.find(n => n.customer_name === r.customer_name)).filter(Boolean);
        const dt = new Date(calDetailDate + "T00:00:00");
        const days = ["日", "月", "火", "水", "木", "金", "土"];
        const dateLabel = `${dt.getFullYear()}年${dt.getMonth() + 1}月${dt.getDate()}日（${days[dt.getDay()]}）`;

        return (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setCalDetailDate(null)}>
            <div className="rounded-2xl border p-5 w-full max-w-md max-h-[85vh] overflow-y-auto" style={{ backgroundColor: T.card, borderColor: T.border }} onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[15px] font-medium">📅 {dateLabel}</h3>
                <button onClick={() => setCalDetailDate(null)} className="text-[14px] cursor-pointer p-1" style={{ color: T.textSub, background: "none", border: "none" }}>✕</button>
              </div>

              {/* 出勤情報 */}
              {dShift ? (
                <div className="rounded-xl p-3 mb-3" style={{ backgroundColor: "#e091a810", border: "1px solid #e091a830" }}>
                  <p className="text-[10px] font-medium mb-1" style={{ color: "#e091a8" }}>⏰ 出勤</p>
                  <p className="text-[14px] font-medium">{dShift.start_time?.slice(0,5)} 〜 {dShift.end_time?.slice(0,5)}</p>
                  {dShift.store_id > 0 && <p className="text-[11px] mt-0.5" style={{ color: T.textMuted }}>{getStoreName(dShift.store_id)}</p>}
                </div>
              ) : (
                <div className="rounded-xl p-3 mb-3" style={{ backgroundColor: T.cardAlt }}>
                  <p className="text-[11px]" style={{ color: T.textFaint }}>出勤予定なし</p>
                </div>
              )}

              {/* 給料明細 */}
              {dSettlement ? (
                <div className="rounded-xl p-3 mb-3" style={{ backgroundColor: "#e8849a10", border: "1px solid #e8849a30" }}>
                  <p className="text-[10px] font-medium mb-2" style={{ color: "#e8849a" }}>💰 清算明細</p>
                  <div className="space-y-1 text-[11px]">
                    <div className="flex justify-between"><span>接客数</span><span className="font-medium">{dSettlement.order_count}件</span></div>
                    <div className="flex justify-between"><span>売上合計</span><span>{fmt(dSettlement.total_sales)}</span></div>
                    <div className="flex justify-between"><span>バック合計</span><span>{fmt(dSettlement.total_back)}</span></div>
                    {dSettlement.adjustment !== 0 && <div className="flex justify-between" style={{ color: dSettlement.adjustment > 0 ? "#22c55e" : "#c45555" }}><span>調整金{dSettlement.adjustment_note ? `（${dSettlement.adjustment_note}）` : ""}</span><span>{dSettlement.adjustment > 0 ? "+" : ""}{fmt(dSettlement.adjustment)}</span></div>}
                    {dSettlement.invoice_deduction > 0 && <div className="flex justify-between" style={{ color: "#c45555" }}><span>インボイス控除</span><span>-{fmt(dSettlement.invoice_deduction)}</span></div>}
                    {dSettlement.withholding_tax > 0 && <div className="flex justify-between" style={{ color: "#c45555" }}><span>源泉徴収</span><span>-{fmt(dSettlement.withholding_tax)}</span></div>}
                    {dSettlement.welfare_fee > 0 && <div className="flex justify-between" style={{ color: "#c45555" }}><span>備品・リネン代</span><span>-{fmt(dSettlement.welfare_fee)}</span></div>}
                    {dSettlement.transport_fee > 0 && <div className="flex justify-between" style={{ color: "#22c55e" }}><span>交通費</span><span>+{fmt(dSettlement.transport_fee)}</span></div>}
                    <div className="flex justify-between pt-1.5 font-bold text-[13px]" style={{ borderTop: `1px solid #e8849a30`, color: "#e8849a" }}><span>支給額</span><span>{fmt(dSettlement.final_payment)}</span></div>
                    <div className="flex items-center gap-3 pt-1 text-[9px]" style={{ color: T.textMuted }}>
                      <span>💴現金 {fmt(dSettlement.total_cash)}</span>
                      {dSettlement.total_card > 0 && <span>💳カード {fmt(dSettlement.total_card)}</span>}
                      {dSettlement.total_paypay > 0 && <span>📱PayPay {fmt(dSettlement.total_paypay)}</span>}
                    </div>
                  </div>
                </div>
              ) : dShift && calDetailDate < today ? (
                <div className="rounded-xl p-3 mb-3" style={{ backgroundColor: "#f59e0b10", border: "1px solid #f59e0b30" }}>
                  <p className="text-[11px] font-medium" style={{ color: "#f59e0b" }}>⚠ 未清算</p>
                </div>
              ) : null}

              {/* お客様情報 */}
              {dRes.length > 0 ? (
                <div className="rounded-xl border overflow-hidden mb-3" style={{ borderColor: T.border }}>
                  <div className="px-3 py-2" style={{ backgroundColor: T.cardAlt }}>
                    <p className="text-[10px] font-medium" style={{ color: "#22c55e" }}>👤 接客情報（{dRes.length}件）</p>
                  </div>
                  {dRes.map((r, i) => {
                    const note = customerNotes.find(n => n.reservation_id === r.id) || customerNotes.find(n => n.customer_name === r.customer_name && !n.reservation_id);
                    const isNg = customerNotes.some(n => n.customer_name === r.customer_name && n.is_ng);
                    return (
                      <div key={r.id} className="px-3 py-2.5" style={{ borderTop: i > 0 ? `1px solid ${T.border}` : "none" }}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[12px] font-medium">{r.customer_name}</span>
                            {isNg && <span className="text-[8px] px-1 py-0.5 rounded" style={{ backgroundColor: "#c4555518", color: "#c45555" }}>🚫NG</span>}
                            {note && note.rating > 0 && <span className="text-[9px]" style={{ color: "#f59e0b" }}>{"★".repeat(note.rating)}{"☆".repeat(5 - note.rating)}</span>}
                          </div>
                          <span className="text-[11px] font-medium" style={{ color: "#e8849a" }}>{fmt(r.total_price)}</span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] flex-wrap" style={{ color: T.textSub }}>
                          <span>🕐 {r.start_time?.slice(0,5)}〜{r.end_time?.slice(0,5)}</span>
                          <span>📋 {r.course}</span>
                        </div>
                        <div className="flex items-center gap-2 text-[9px] flex-wrap mt-0.5" style={{ color: T.textMuted }}>
                          {r.nomination && <span style={{ color: "#e8849a" }}>指名: {r.nomination}（{fmt(r.nomination_fee)}）</span>}
                          {r.options_text && <span style={{ color: "#e091a8" }}>OP: {r.options_text}</span>}
                          {r.extension_name && <span style={{ color: "#a855f7" }}>延長: {r.extension_name}</span>}
                          {(r as any).discount_name && <span style={{ color: "#c45555" }}>割引: {(r as any).discount_name}</span>}
                        </div>
                        <div className="flex items-center gap-2 text-[9px] flex-wrap mt-0.5" style={{ color: T.textMuted }}>
                          {(r as any).card_billing > 0 && <span style={{ color: "#e091a8" }}>💳{fmt((r as any).card_billing)}</span>}
                          {(r as any).paypay_amount > 0 && <span style={{ color: "#22c55e" }}>📱{fmt((r as any).paypay_amount)}</span>}
                          {(r as any).cash_amount > 0 && <span>💴{fmt((r as any).cash_amount)}</span>}
                        </div>
                        {(() => {
                          const courseBack = coursesMaster.find(c => c.name === r.course)?.therapist_back || 0;
                          const nomBack = r.nomination ? (nomsMaster.find(n => n.name === r.nomination)?.back_amount || 0) : 0;
                          const optNames = r.options_text ? r.options_text.split(",").filter(Boolean) : [];
                          const optBack = optNames.reduce((s, n) => s + (optsMaster.find(o => o.name === n)?.therapist_back || 0), 0);
                          const extBack = r.extension_name ? (extsMaster.find(e => e.name === r.extension_name)?.therapist_back || 0) : 0;
                          const totalBack = courseBack + nomBack + optBack + extBack;
                          return (
                          <div className="text-[9px] mt-1 px-2 py-1.5 rounded space-y-0.5" style={{ backgroundColor: "#7ab88f10", border: "1px solid #7ab88f20" }}>
                            <div className="flex items-center justify-between"><span style={{ color: "#7ab88f" }}>💵 バック詳細</span><span className="font-medium" style={{ color: "#7ab88f" }}>合計 {fmt(totalBack)}</span></div>
                            <div className="flex justify-between"><span>コースバック（{r.course}）</span><span style={{ color: "#7ab88f" }}>{fmt(courseBack)}</span></div>
                            {r.nomination && <div className="flex justify-between"><span>指名バック（{r.nomination}）</span><span style={{ color: "#e8849a" }}>+{fmt(nomBack)}</span></div>}
                            {optNames.length > 0 && optNames.map((n, oi) => { const ob = optsMaster.find(o => o.name === n)?.therapist_back || 0; return <div key={oi} className="flex justify-between"><span>OPバック（{n}）</span><span style={{ color: "#e091a8" }}>+{fmt(ob)}</span></div>; })}
                            {r.extension_name && <div className="flex justify-between"><span>延長バック（{r.extension_name}）</span><span style={{ color: "#a855f7" }}>+{fmt(extBack)}</span></div>}
                          </div>
                        ); })()}
                        {note && note.note && (
                          <div className="mt-1 px-2 py-1 rounded text-[9px]" style={{ backgroundColor: "#e8849a10", color: "#e8849a" }}>
                            📝 {note.note}
                          </div>
                        )}
                        {note?.is_ng && note.ng_reason && (
                          <div className="mt-0.5 px-2 py-1 rounded text-[9px]" style={{ backgroundColor: "#c4555510", color: "#c45555" }}>
                            🚫 NG理由: {note.ng_reason}
                          </div>
                        )}
                        <div className="flex gap-1 mt-1.5">
                          <button onClick={(e) => { e.stopPropagation(); if (note) { setNoteForm({ customer_name: note.customer_name, note: note.note, is_ng: note.is_ng, ng_reason: note.ng_reason, rating: note.rating || 0, reservation_id: note.reservation_id || r.id }); } else { setNoteForm({ customer_name: r.customer_name, note: "", is_ng: false, ng_reason: "", rating: 0, reservation_id: r.id }); } setCalDetailDate(null); setShowAddNote(true); }}
                            className="px-2 py-1 text-[9px] rounded cursor-pointer" style={{ backgroundColor: "#e8849a18", color: "#e8849a" }}>
                            {note ? "✏️ メモ編集" : "📝 メモ追加"}
                          </button>
                          {note && <button onClick={(e) => { e.stopPropagation(); deleteCustomerNote(note.id); }}
                            className="px-2 py-1 text-[9px] rounded cursor-pointer" style={{ backgroundColor: "#c4555518", color: "#c45555" }}>🗑 削除</button>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : dShift ? (
                <div className="rounded-xl p-3 mb-3" style={{ backgroundColor: T.cardAlt }}>
                  <p className="text-[11px]" style={{ color: T.textFaint }}>接客情報なし</p>
                </div>
              ) : null}

              <button onClick={() => setCalDetailDate(null)}
                className="w-full py-2.5 text-[11px] rounded-xl cursor-pointer border" style={{ borderColor: T.border, color: T.textSub }}>閉じる</button>
            </div>
          </div>
        );
      })()}

      {/* お客様接客履歴モーダル */}
      {/* ── 確定申告サポートタブ ── */}
      {tab === "tax" && therapist && (
        <TaxSupportWizard T={T} therapistId={therapist.id} />
      )}

      {/* お客様接客履歴モーダル（元の位置） */}
      {noteHistoryCustomer && (<div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setNoteHistoryCustomer("")}><div className="rounded-2xl border w-full max-w-sm max-h-[85vh] overflow-hidden flex flex-col" style={{ backgroundColor: T.card, borderColor: T.border }} onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: `1px solid ${T.border}` }}>
          <div>
            <h3 className="text-[14px] font-medium">{noteHistoryCustomer}</h3>
            <p className="text-[9px] mt-0.5" style={{ color: T.textFaint }}>接客を選んでメモを追加できます</p>
          </div>
          <button onClick={() => setNoteHistoryCustomer("")} className="text-[14px] cursor-pointer p-1" style={{ color: T.textSub }}>✕</button>
        </div>
        {/* NG管理エリア */}
        {(() => { const isNg = customerNotes.some(n => n.customer_name === noteHistoryCustomer && n.is_ng); return (
          <div className="px-5 py-2 flex items-center justify-between" style={{ borderBottom: `1px solid ${T.border}`, backgroundColor: isNg ? "#c4555508" : "transparent" }}>
            <div className="flex items-center gap-2">
              {isNg && <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "#c4555518", color: "#c45555" }}>🚫 NG登録済み</span>}
            </div>
            <button onClick={() => {
              const ngNote = customerNotes.find(n => n.customer_name === noteHistoryCustomer && !n.reservation_id);
              setNoteForm({ customer_name: noteHistoryCustomer, note: ngNote?.note || "", is_ng: ngNote?.is_ng || false, ng_reason: ngNote?.ng_reason || "", rating: ngNote?.rating || 0, reservation_id: 0 });
              setNoteHistoryCustomer(""); setShowAddNote(true);
            }} className="text-[9px] cursor-pointer px-2 py-1 rounded-lg" style={{ color: isNg ? "#c45555" : T.textMuted, backgroundColor: isNg ? "#c4555510" : T.cardAlt }}>
              {isNg ? "🚫 NG編集" : "⚙️ NG管理"}
            </button>
          </div>
        ); })()}
        {/* 接客履歴一覧 */}
        <div className="overflow-y-auto flex-1 px-5 py-3">
          {/* 旧形式メモ（reservation_idなし）表示 */}
          {(() => { const generalNotes = customerNotes.filter(n => n.customer_name === noteHistoryCustomer && !n.reservation_id && n.note); return generalNotes.length > 0 ? (
            <div className="mb-3">
              <p className="text-[10px] font-medium mb-2" style={{ color: "#e8849a" }}>📝 過去のメモ</p>
              {generalNotes.map(n => (
                <div key={n.id} className="rounded-lg px-3 py-2 mb-1.5" style={{ backgroundColor: "#e8849a08", border: "1px solid #e8849a20" }}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      {n.rating > 0 && <span className="text-[9px]" style={{ color: "#f59e0b" }}>{"★".repeat(n.rating)}{"☆".repeat(5 - n.rating)}</span>}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => { setNoteForm({ customer_name: n.customer_name, note: n.note, is_ng: n.is_ng, ng_reason: n.ng_reason, rating: n.rating || 0, reservation_id: 0 }); setNoteHistoryCustomer(""); setShowAddNote(true); }} className="text-[9px] cursor-pointer px-1.5 py-0.5 rounded" style={{ color: "#e8849a", backgroundColor: "#e8849a15" }}>✏️ 編集</button>
                      <button onClick={async () => { if (confirm("このメモを削除しますか？")) { await supabase.from("therapist_customer_notes").delete().eq("id", n.id); await fetchData(); } }} className="text-[9px] cursor-pointer px-1.5 py-0.5 rounded" style={{ color: "#c45555", backgroundColor: "#c4555510" }}>🗑</button>
                    </div>
                  </div>
                  <p className="text-[10px] whitespace-pre-wrap leading-relaxed" style={{ color: T.textSub }}>{n.note}</p>
                </div>
              ))}
            </div>
          ) : null; })()}
          <p className="text-[10px] font-medium mb-2" style={{ color: T.textMuted }}>接客履歴</p>
          {(() => {
            const hist = allReservations.filter(r => r.customer_name === noteHistoryCustomer);
            if (hist.length === 0) return <p className="text-[11px] text-center py-6" style={{ color: T.textFaint }}>接客履歴がありません</p>;
            return hist.map(r => {
              const dateStr = (() => { const dt = new Date(r.date + "T00:00:00"); const days = ["日","月","火","水","木","金","土"]; return `${dt.getMonth()+1}/${dt.getDate()}(${days[dt.getDay()]})`; })();
              const resNote = customerNotes.find(n => n.reservation_id === r.id);
              return (
                <div key={r.id} className="rounded-xl border p-3 mb-2" style={{ borderColor: resNote ? "#e8849a44" : T.border, backgroundColor: resNote ? "#e8849a08" : T.cardAlt }}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[12px] font-medium">{dateStr}</span>
                    <span className="text-[10px]" style={{ color: T.textMuted }}>{r.start_time?.slice(0,5)}〜{r.end_time?.slice(0,5)}</span>
                  </div>
                  <p className="text-[10px]" style={{ color: T.textSub }}>{r.course}{r.nomination ? ` ⭐${r.nomination}` : ""}</p>
                  {resNote ? (
                    <div className="mt-1.5">
                      <div className="rounded-lg px-2.5 py-2" style={{ backgroundColor: "#e8849a10", border: "1px solid #e8849a20" }}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px] font-medium" style={{ color: "#e8849a" }}>📝 メモ</span>
                            {resNote.rating > 0 && <span className="text-[9px]" style={{ color: "#f59e0b" }}>{"★".repeat(resNote.rating)}{"☆".repeat(5 - resNote.rating)}</span>}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button onClick={() => { setNoteForm({ customer_name: resNote.customer_name, note: resNote.note, is_ng: resNote.is_ng, ng_reason: resNote.ng_reason, rating: resNote.rating || 0, reservation_id: r.id }); setNoteHistoryCustomer(""); setShowAddNote(true); }} className="text-[9px] cursor-pointer px-1.5 py-0.5 rounded" style={{ color: "#e8849a", backgroundColor: "#e8849a15" }}>✏️ 編集</button>
                            <button onClick={async () => { if (confirm("このメモを削除しますか？")) { await supabase.from("therapist_customer_notes").delete().eq("id", resNote.id); await fetchData(); } }} className="text-[9px] cursor-pointer px-1.5 py-0.5 rounded" style={{ color: "#c45555", backgroundColor: "#c4555510" }}>🗑</button>
                          </div>
                        </div>
                        {resNote.note && <p className="text-[10px] whitespace-pre-wrap leading-relaxed" style={{ color: T.textSub }}>{resNote.note}</p>}
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => {
                      setNoteForm({ customer_name: noteHistoryCustomer, note: "", is_ng: false, ng_reason: "", rating: 0, reservation_id: r.id });
                      setNoteHistoryCustomer(""); setShowAddNote(true);
                    }} className="mt-1.5 w-full py-1.5 text-[10px] rounded-lg cursor-pointer font-medium" style={{ backgroundColor: "#e8849a15", color: "#e8849a", border: "1px solid #e8849a30" }}>
                      📝 メモを追加
                    </button>
                  )}
                </div>
              );
            });
          })()}
        </div>
        <div className="px-5 py-3" style={{ borderTop: `1px solid ${T.border}` }}>
          <button onClick={() => setNoteHistoryCustomer("")} className="w-full py-2 border text-[10px] rounded-xl cursor-pointer" style={{ borderColor: T.border, color: T.textSub }}>閉じる</button>
        </div>
      </div></div>)}

      {noteViewTarget && (<div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setNoteViewTarget(null)}><div className="rounded-2xl border p-5 w-full max-w-sm" style={{ backgroundColor: T.card, borderColor: T.border }} onClick={(e) => e.stopPropagation()}>
        <h3 className="text-[14px] font-medium mb-1">{noteViewTarget.customer_name}</h3>
        {noteViewTarget.is_ng && <p className="text-[10px] mb-2" style={{ color: "#c45555" }}>🚫 NG登録済み{noteViewTarget.ng_reason ? `（${noteViewTarget.ng_reason}）` : ""}</p>}{noteViewTarget.rating > 0 && <p className="text-[12px] mb-2" style={{ color: "#f59e0b" }}>{"★".repeat(noteViewTarget.rating)}{"☆".repeat(5 - noteViewTarget.rating)} <span className="text-[10px]">{noteViewTarget.rating}/5</span></p>}
        <div className="rounded-xl p-3 mb-3" style={{ backgroundColor: T.cardAlt }}><p className="text-[10px] font-medium mb-1" style={{ color: T.textMuted }}>メモ</p><p className="text-[12px] whitespace-pre-wrap">{noteViewTarget.note || "メモなし"}</p></div>
        {(() => { const hist = allReservations.filter(r => r.customer_name === noteViewTarget.customer_name).slice(0, 10); if (hist.length === 0) return null; return (<div className="rounded-xl p-3 mb-3" style={{ backgroundColor: T.cardAlt }}><p className="text-[10px] font-medium mb-1" style={{ color: T.textMuted }}>接客履歴（直近{hist.length}件）</p>{hist.map(r => (<div key={r.id} className="flex items-center justify-between py-1 text-[10px]" style={{ borderBottom: `1px solid ${T.border}` }}><span>{formatDate(r.date)} {r.start_time?.slice(0,5)}</span><span style={{ color: T.textSub }}>{r.course}</span></div>))}</div>); })()}
        <div className="flex gap-2"><button onClick={() => { setNoteForm({ customer_name: noteViewTarget.customer_name, note: noteViewTarget.note, is_ng: noteViewTarget.is_ng, ng_reason: noteViewTarget.ng_reason, rating: noteViewTarget.rating || 0, reservation_id: noteViewTarget.reservation_id || 0 }); setNoteViewTarget(null); setShowAddNote(true); }} className="px-4 py-2 text-[11px] rounded-xl cursor-pointer text-white" style={{ background: "linear-gradient(135deg, #e8849a, #d4687e)" }}>✏️ メモ編集</button><button onClick={() => setNoteViewTarget(null)} className="px-4 py-2 border text-[11px] rounded-xl cursor-pointer" style={{ borderColor: T.border, color: T.textSub }}>閉じる</button></div>
      </div></div>)}

      {showAddNote && (<div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowAddNote(false)}><div className="rounded-2xl border p-5 w-full max-w-sm" style={{ backgroundColor: T.card, borderColor: T.border }} onClick={(e) => e.stopPropagation()}>
        <h3 className="text-[14px] font-medium mb-4">📝 お客様メモ</h3>
        <div className="space-y-3">
          <div><label className="block text-[10px] mb-1" style={{ color: T.textSub }}>お客様名</label><input type="text" value={noteForm.customer_name} onChange={(e) => setNoteForm({ ...noteForm, customer_name: e.target.value })} readOnly={!!customerNotes.find(n => n.customer_name === noteForm.customer_name)} placeholder="お客様名" className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={{ backgroundColor: T.cardAlt, color: T.text, border: "1px solid transparent" }} /></div>
          <div><label className="block text-[10px] mb-1" style={{ color: T.textSub }}>メモ</label><textarea value={noteForm.note} onChange={(e) => setNoteForm({ ...noteForm, note: e.target.value })} placeholder="お客様についてのメモ" rows={4} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none resize-y" style={{ backgroundColor: T.cardAlt, color: T.text, border: "1px solid transparent" }} /></div>
          <div className="flex items-center gap-1.5">
                <button onClick={() => { const now = new Date(); const ds = `${now.getMonth()+1}/${now.getDate()} ${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`; setNoteForm({ ...noteForm, note: noteForm.note + (noteForm.note ? "\n" : "") + `[${ds}] ` }); }}
                  className="px-2.5 py-1.5 text-[10px] rounded-lg cursor-pointer border" style={{ borderColor: "#e091a844", color: "#e091a8" }}>📅 日時挿入</button>
              </div>
              <div>
                <label className="block text-[10px] mb-1" style={{ color: T.textSub }}>お客様評価</label>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map(s => (
                    <button key={s} onClick={() => setNoteForm({ ...noteForm, rating: noteForm.rating === s ? 0 : s })}
                      className="text-[20px] cursor-pointer" style={{ background: "none", border: "none", padding: 0, color: s <= noteForm.rating ? "#f59e0b" : T.textFaint }}>
                      {s <= noteForm.rating ? "★" : "☆"}
                    </button>
                  ))}
                  {noteForm.rating > 0 && <span className="text-[10px] ml-1" style={{ color: "#f59e0b" }}>{noteForm.rating}/5</span>}
                </div>
              </div>
          <div className="flex items-center gap-3"><button onClick={() => setNoteForm({ ...noteForm, is_ng: !noteForm.is_ng })} className="px-4 py-2 rounded-xl text-[11px] cursor-pointer border" style={chipStyle(noteForm.is_ng, "#c45555")}>{noteForm.is_ng ? "🚫 NG登録あり" : "NG登録なし"}</button></div>
          {noteForm.is_ng && (<div><label className="block text-[10px] mb-1" style={{ color: T.textSub }}>NG理由</label><input type="text" value={noteForm.ng_reason} onChange={(e) => setNoteForm({ ...noteForm, ng_reason: e.target.value })} placeholder="理由を入力" className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={{ backgroundColor: T.cardAlt, color: T.text, border: "1px solid transparent" }} /></div>)}
          <div className="flex gap-3 pt-2"><button onClick={saveCustomerNote} className="px-5 py-2.5 text-white text-[11px] rounded-xl cursor-pointer" style={{ background: "linear-gradient(135deg, #e8849a, #d4687e)" }}>保存</button><button onClick={() => setShowAddNote(false)} className="px-5 py-2.5 border text-[11px] rounded-xl cursor-pointer" style={{ borderColor: T.border, color: T.textSub }}>キャンセル</button></div>
        </div>
      </div></div>)}
    </div>
  );
}
