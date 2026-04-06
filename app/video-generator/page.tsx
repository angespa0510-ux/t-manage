"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";
import { useTheme } from "../../lib/theme";
import { NavMenu } from "../../lib/nav-menu";
import { useToast } from "../../lib/toast";

/* ─── 型定義 ─── */
type Therapist = {
  sid: string; name: string; age: string; height: string; cup: string;
  imageUrl: string; profileUrl: string; status: string; store: string;
};
type VideoLog = {
  id: number; created_at: string; therapist_name: string; therapist_sid: string;
  therapist_age: string; therapist_height: string; therapist_cup: string;
  image_url: string; motion_category: string; prompt_used: string;
  result: string; retry_count: number; liked: boolean;
  video_filename: string; gdrive_path: string;
};
type MotionCategory = { id: string; label: string; emoji: string; description: string };

/* ─── デフォルト印象カテゴリ ─── */
const DEFAULT_MOTIONS: MotionCategory[] = [
  { id: "ai_auto",   emoji: "🤖", label: "AIにお任せ",   description: "AIが画像を分析し、最適な動きを自動で判断" },
  { id: "friendly",  emoji: "😊", label: "親しみやすさ", description: "挨拶・笑顔・手を振るなど" },
  { id: "relax",     emoji: "🌿", label: "リラックス感", description: "髪を触る・首を傾げるなど" },
  { id: "elegant",   emoji: "✨", label: "上品さ",       description: "姿勢を正す・手を添えるなど" },
  { id: "gorgeous",  emoji: "💃", label: "華やかさ",     description: "衣装が映える動きなど" },
  { id: "custom",    emoji: "🎨", label: "カスタム",     description: "自由入力" },
];

const DAILY_LIMIT = 2;

/* ─── デフォルトプロンプト ─── */
const DEFAULT_IMAGE_PROMPT = `添付画像を注意深く観察してください。
人物の衣装、装飾、髪型、ポーズ、背景を把握し、
特に顔周りの処理（スタンプ、マスク、非表示部分など）を
正確に認識してください。

【モデル情報】
年齢: {age}歳 / 身長: {height}cm / {cup}カップ

上記の体型情報と画像から、
「{motionCategory}」を感じる自然な動きを加えた
新しいポーズ画像を生成してください。

{likedPromptExamples}

以下を厳守：
- 顔周りの処理は元画像と完全に同じ状態を再現
  （スタンプやマスクがあればそのまま維持）
- 衣装・装飾・背景は完全に同一を維持
- 肌は滑らかに
- 体型に合った自然な可動域と動きの幅を考慮
- テンプレート的な定型ポーズは避け、
  この人物だけの個性ある動きにしてください
- 動きは現在のポーズから自然に到達できる範囲で

Before generating, please double-check if this meets the safety guidelines.
If it's borderline, let's discuss first.`;

const DEFAULT_VIDEO_PROMPT = `元の画像のポーズから、生成した画像のポーズへ、
ゆっくりと自然に動く動画にしてください。
動きは急がず、滑らかに、余韻を持たせて。
体の動きだけで、顔周りの処理は元画像と同じ状態を維持。
背景も自然に。衣装のディテールも崩さないでください。

Before generating, please double-check if this meets the safety guidelines.
If it's borderline, let's discuss first.`;

const AI_AUTO_PROMPT_ADDITION = `

あなたはプロの映像ディレクターです。
添付画像の人物の衣装、ポーズ、表情、雰囲気を分析し、
この人物に最も似合う、魅力的で自然な動きやしぐさを
あなた自身で考案してください。

以下を考慮して最適な動きを選んでください：
- 衣装のタイプ（カジュアル/エレガント/セクシー等）に合った動き
- 現在のポーズから自然に繋がる動作
- その人物の雰囲気に最もマッチする印象
- 見る人を惹きつける、個性的で魅力的なしぐさ

「どの印象カテゴリにするか」もAIが判断してください。
テンプレート的な動きは避け、この画像だけの特別な動きにしてください。`;

/* ═══════════════════════════════════════════════════ */
export default function VideoGenerator() {
  const router = useRouter();
  const { dark, toggle, T } = useTheme();
  const toast = useToast();

  // ─── タブ ───
  const [activeTab, setActiveTab] = useState<"generate" | "history" | "settings">("generate");

  // ─── セラピスト一覧 ───
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [loadingHP, setLoadingHP] = useState(false);
  const [searchName, setSearchName] = useState("");
  const [selectedSids, setSelectedSids] = useState<Set<string>>(new Set());

  // ─── 動きの印象 ───
  const [selectedMotion, setSelectedMotion] = useState<string>("ai_auto");
  const [customMotionText, setCustomMotionText] = useState("");

  // ─── キュー ───
  const [queue, setQueue] = useState<VideoLog[]>([]);
  const [todayCount, setTodayCount] = useState(0);
  const queuePollRef = useRef<NodeJS.Timeout | null>(null);

  // ─── 履歴タブ ───
  const [logs, setLogs] = useState<VideoLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // ─── 設定タブ ───
  const [settings, setSettings] = useState({
    imagePrompt: DEFAULT_IMAGE_PROMPT,
    videoPrompt: DEFAULT_VIDEO_PROMPT,
    motionCategories: DEFAULT_MOTIONS,
    notifyEmail: "",
    gdriveFolder: "AI動画生成",
    maxRetries: 3,
    watermarkCropPx: 100,
    geminiUrl: "https://gemini.google.com/app",
    playwrightHeadless: false,
    autoSaveGdrive: true,
  });
  const [settingsDirty, setSettingsDirty] = useState(false);

  /* ─── 初期読み込み ─── */
  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/"); return; }
      loadSettings();
      fetchTherapists();
      fetchQueue();
    };
    init();
    return () => { if (queuePollRef.current) clearInterval(queuePollRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ─── キューのポーリング ─── */
  useEffect(() => {
    if (queuePollRef.current) clearInterval(queuePollRef.current);
    queuePollRef.current = setInterval(fetchQueue, 15000);
    return () => { if (queuePollRef.current) clearInterval(queuePollRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ─── HPスクレイピング ─── */
  const fetchTherapists = useCallback(async () => {
    setLoadingHP(true);
    try {
      const res = await fetch("/api/scrape-therapists");
      const data = await res.json();
      if (data.therapists) {
        setTherapists(data.therapists);
        if (data.count > 0) toast.show(`${data.count}名のセラピストを取得しました`);
      }
    } catch {
      toast.show("HP取得に失敗しました", "error");
    } finally {
      setLoadingHP(false);
    }
  }, [toast]);

  /* ─── キュー取得 ─── */
  const fetchQueue = useCallback(async () => {
    // 今日の日付（JST）
    const now = new Date();
    const jstOffset = 9 * 60;
    const jst = new Date(now.getTime() + (jstOffset + now.getTimezoneOffset()) * 60000);
    // 深夜0-5時は前日扱い
    if (jst.getHours() < 6) jst.setDate(jst.getDate() - 1);
    const todayStr = jst.toISOString().slice(0, 10);

    // アクティブなキュー（queued / pending / processing）
    const { data: active } = await supabase
      .from("video_generation_logs")
      .select("*")
      .in("result", ["queued", "pending", "processing"])
      .order("created_at", { ascending: true });

    // 今日の完了数
    const { data: done } = await supabase
      .from("video_generation_logs")
      .select("id")
      .in("result", ["success", "processing"])
      .gte("created_at", `${todayStr}T00:00:00+09:00`)
      .lt("created_at", `${todayStr}T23:59:59+09:00`);

    if (active) setQueue(active);
    setTodayCount(done?.length || 0);
  }, []);

  /* ─── セラピスト選択トグル ─── */
  const toggleTherapist = (sid: string) => {
    setSelectedSids(prev => {
      const next = new Set(prev);
      if (next.has(sid)) {
        next.delete(sid);
      } else {
        if (next.size >= 10) {
          toast.show("最大10名まで選択できます", "error");
          return prev;
        }
        next.add(sid);
      }
      return next;
    });
  };

  /* ─── キューに追加 ─── */
  const addToQueue = async () => {
    if (selectedSids.size === 0) { toast.show("セラピストを選択してください", "error"); return; }

    const motionLabel = selectedMotion === "custom"
      ? customMotionText || "カスタム"
      : (settings.motionCategories.find(m => m.id === selectedMotion)?.label || selectedMotion);

    const selected = therapists.filter(th => selectedSids.has(th.sid));
    const requests = selected.map(th => ({
      therapist_name: th.name,
      therapist_sid: th.sid,
      therapist_age: th.age,
      therapist_height: th.height,
      therapist_cup: th.cup,
      image_url: th.imageUrl,
      all_image_urls: [th.imageUrl],
      motion_category: motionLabel,
      prompt_used: "",
      result: "queued",
      retry_count: 0,
      liked: false,
      video_filename: "",
      gdrive_path: settings.gdriveFolder,
    }));

    const { error } = await supabase.from("video_generation_logs").insert(requests);

    if (error) {
      toast.show("キュー追加に失敗: " + error.message, "error");
      return;
    }

    toast.show(`${selected.length}名をキューに追加しました`);
    setSelectedSids(new Set());
    fetchQueue();
  };

  /* ─── キューからキャンセル ─── */
  const cancelQueueItem = async (id: number) => {
    await supabase
      .from("video_generation_logs")
      .update({ result: "cancelled" })
      .eq("id", id);
    toast.show("キャンセルしました");
    fetchQueue();
  };

  /* ─── 設定読み込み ─── */
  const loadSettings = async () => {
    const { data } = await supabase
      .from("store_settings")
      .select("key, value")
      .like("key", "vg_%");
    if (data) {
      const s = { ...settings };
      data.forEach((row: { key: string; value: string }) => {
        const k = row.key.replace("vg_", "");
        if (k === "image_prompt") s.imagePrompt = row.value;
        else if (k === "video_prompt") s.videoPrompt = row.value;
        else if (k === "notify_email") s.notifyEmail = row.value;
        else if (k === "gdrive_folder") s.gdriveFolder = row.value;
        else if (k === "max_retries") s.maxRetries = parseInt(row.value) || 3;
        else if (k === "watermark_crop_px") s.watermarkCropPx = parseInt(row.value) || 100;
        else if (k === "gemini_url") s.geminiUrl = row.value;
        else if (k === "headless") s.playwrightHeadless = row.value === "true";
        else if (k === "auto_save_gdrive") s.autoSaveGdrive = row.value !== "false";
        else if (k === "motion_categories") {
          try { s.motionCategories = JSON.parse(row.value); } catch { /* keep default */ }
        }
      });
      setSettings(s);
    }
  };

  /* ─── 設定保存 ─── */
  const saveSettings = async () => {
    const pairs: { key: string; value: string }[] = [
      { key: "vg_image_prompt", value: settings.imagePrompt },
      { key: "vg_video_prompt", value: settings.videoPrompt },
      { key: "vg_notify_email", value: settings.notifyEmail },
      { key: "vg_gdrive_folder", value: settings.gdriveFolder },
      { key: "vg_max_retries", value: String(settings.maxRetries) },
      { key: "vg_watermark_crop_px", value: String(settings.watermarkCropPx) },
      { key: "vg_gemini_url", value: settings.geminiUrl },
      { key: "vg_headless", value: String(settings.playwrightHeadless) },
      { key: "vg_auto_save_gdrive", value: String(settings.autoSaveGdrive) },
      { key: "vg_motion_categories", value: JSON.stringify(settings.motionCategories) },
    ];
    for (const p of pairs) {
      await supabase.from("store_settings").upsert(p, { onConflict: "key" });
    }
    setSettingsDirty(false);
    toast.show("設定を保存しました");
  };

  /* ─── 履歴取得 ─── */
  const fetchLogs = useCallback(async () => {
    setLoadingLogs(true);
    const { data } = await supabase
      .from("video_generation_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (data) setLogs(data);
    setLoadingLogs(false);
  }, []);

  /* ─── いいね切替 ─── */
  const toggleLike = async (log: VideoLog) => {
    await supabase.from("video_generation_logs").update({ liked: !log.liked }).eq("id", log.id);
    fetchLogs();
  };

  /* ─── タブ切替時 ─── */
  useEffect(() => {
    if (activeTab === "history") fetchLogs();
    if (activeTab === "generate") fetchQueue();
  }, [activeTab, fetchLogs, fetchQueue]);

  /* ─── 印象カテゴリ管理 ─── */
  const addMotionCategory = () => {
    const id = `custom_${Date.now()}`;
    setSettings(prev => ({
      ...prev,
      motionCategories: [...prev.motionCategories, { id, emoji: "🎯", label: "", description: "" }],
    }));
    setSettingsDirty(true);
  };
  const updateMotionCategory = (idx: number, field: keyof MotionCategory, value: string) => {
    setSettings(prev => ({
      ...prev,
      motionCategories: prev.motionCategories.map((m, i) => i === idx ? { ...m, [field]: value } : m),
    }));
    setSettingsDirty(true);
  };
  const removeMotionCategory = (idx: number) => {
    if (settings.motionCategories.length <= 1) return;
    setSettings(prev => ({
      ...prev,
      motionCategories: prev.motionCategories.filter((_, i) => i !== idx),
    }));
    setSettingsDirty(true);
  };

  /* ─── フィルタ済みセラピスト ─── */
  const filteredTherapists = searchName
    ? therapists.filter(th => th.name.includes(searchName))
    : therapists;

  /* ─── スタイル ─── */
  const cardStyle = { backgroundColor: T.card, border: `1px solid ${T.border}`, borderRadius: 12 };
  const inputStyle: React.CSSProperties = {
    backgroundColor: T.cardAlt, color: T.text, border: `1px solid ${T.border}`,
    borderRadius: 8, padding: "8px 12px", width: "100%", fontSize: 13, outline: "none",
  };
  const btnPrimary: React.CSSProperties = {
    background: "linear-gradient(135deg, #c3a782, #a8895e)", color: "white",
    border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 13,
    fontWeight: 600, cursor: "pointer",
  };
  const btnSub: React.CSSProperties = {
    backgroundColor: T.cardAlt, color: T.text, border: `1px solid ${T.border}`,
    borderRadius: 8, padding: "8px 16px", fontSize: 12, cursor: "pointer",
  };
  const sectionTitle: React.CSSProperties = {
    fontSize: 13, fontWeight: 600, color: T.accent, marginBottom: 8,
    display: "flex", alignItems: "center", gap: 6,
  };
  const labelStyle: React.CSSProperties = { fontSize: 11, color: T.textSub, marginBottom: 4, display: "block" };

  /* ─── キューステータス表示 ─── */
  const statusConfig: Record<string, { icon: string; label: string; color: string; bg: string; spin?: boolean }> = {
    queued:     { icon: "⏳", label: "待機中",   color: "#c3a782", bg: "rgba(195,167,130,0.12)" },
    pending:    { icon: "📋", label: "準備中",   color: "#85a8c4", bg: "rgba(133,168,196,0.12)" },
    processing: { icon: "⚙️", label: "制作中",   color: "#a78bc4", bg: "rgba(167,139,196,0.12)", spin: true },
    success:    { icon: "✅", label: "完了",     color: "#7ab88f", bg: "rgba(122,184,143,0.12)" },
    failed:     { icon: "❌", label: "失敗",     color: "#c45555", bg: "rgba(196,85,85,0.12)" },
    cancelled:  { icon: "🚫", label: "キャンセル", color: "#888", bg: "rgba(136,136,136,0.08)" },
    safety_rejected: { icon: "🛡️", label: "安全性拒否", color: "#c45555", bg: "rgba(196,85,85,0.12)" },
    timeout:    { icon: "⏰", label: "タイムアウト", color: "#c45555", bg: "rgba(196,85,85,0.12)" },
  };

  /* ═══════════════════════════════════════ RENDER ═══════ */
  return (
    <div className="h-screen flex flex-col" style={{ backgroundColor: T.bg, color: T.text }}>

      {/* CSS for spinning gear */}
      <style>{`
        @keyframes vg-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .vg-spin { display: inline-block; animation: vg-spin 2s linear infinite; }
      `}</style>

      {/* ── Header ── */}
      <div className="h-[56px] flex items-center justify-between px-4 flex-shrink-0 border-b"
        style={{ backgroundColor: T.card, borderColor: T.border }}>
        <div className="flex items-center gap-3">
          <NavMenu T={T} dark={dark} />
          <button onClick={() => router.push("/dashboard")} className="p-2 rounded-lg cursor-pointer" style={{ color: T.textSub }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <h1 className="text-[14px] font-medium">🎬 AI動画生成</h1>
        </div>
        <button onClick={toggle} className="px-2.5 py-1.5 text-[10px] rounded-lg cursor-pointer border" style={{ borderColor: T.border, color: T.textSub }}>
          {dark ? "☀️ ライト" : "🌙 ダーク"}
        </button>
      </div>

      {/* ── タブ ── */}
      <div className="flex border-b flex-shrink-0" style={{ borderColor: T.border, backgroundColor: T.card }}>
        {([
          { key: "generate", label: "🎬 動画生成" },
          { key: "history",  label: "📋 生成履歴" },
          { key: "settings", label: "⚙️ 設定" },
        ] as const).map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            style={{
              flex: 1, padding: "12px 0", fontSize: 12, fontWeight: activeTab === tab.key ? 600 : 400,
              color: activeTab === tab.key ? T.accent : T.textSub,
              borderBottom: `2px solid ${activeTab === tab.key ? T.accent : "transparent"}`,
              background: "none", border: "none", borderBottomWidth: 2, borderBottomStyle: "solid",
              cursor: "pointer",
            }}
          >{tab.label}</button>
        ))}
      </div>

      {/* ── コンテンツ ── */}
      <div className="flex-1 overflow-y-auto p-4" style={{ maxWidth: 900, margin: "0 auto", width: "100%" }}>

        {/* ════════════ 生成タブ ════════════ */}
        {activeTab === "generate" && (
          <div className="flex flex-col gap-4">

            {/* ── キュー状況バー ── */}
            <div style={{ ...cardStyle, padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div className="flex items-center gap-3">
                <span style={{ fontSize: 12, color: T.textSub }}>本日の制作</span>
                <span style={{
                  fontSize: 14, fontWeight: 700,
                  color: todayCount >= DAILY_LIMIT ? "#c45555" : "#7ab88f",
                }}>
                  {todayCount} / {DAILY_LIMIT}
                </span>
                {todayCount >= DAILY_LIMIT && (
                  <span style={{ fontSize: 10, color: "#c45555", backgroundColor: "rgba(196,85,85,0.1)", padding: "2px 8px", borderRadius: 6 }}>
                    本日上限 → 翌日に持ち越し
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span style={{ fontSize: 11, color: T.textSub }}>待機中: {queue.filter(q => q.result === "queued").length}</span>
                <span style={{ fontSize: 11, color: "#a78bc4" }}>
                  制作中: {queue.filter(q => q.result === "processing").length}
                </span>
              </div>
            </div>

            {/* ── STEP 1: セラピスト選択 ── */}
            <div style={{ ...cardStyle, padding: 16 }}>
              <div style={{ ...sectionTitle, marginBottom: 12 }}>
                <span>①</span> セラピストを選ぶ
                <span style={{ fontSize: 11, fontWeight: 400, color: T.textSub, marginLeft: "auto" }}>
                  {selectedSids.size > 0 && `${selectedSids.size}名選択中`} (最大10名)
                </span>
              </div>

              <div className="flex gap-2 mb-3">
                <input
                  placeholder="名前で検索..."
                  value={searchName}
                  onChange={e => setSearchName(e.target.value)}
                  style={{ ...inputStyle, flex: 1 }}
                />
                <button onClick={fetchTherapists} disabled={loadingHP} style={btnSub}>
                  {loadingHP ? "取得中..." : "🔄 再取得"}
                </button>
                {selectedSids.size > 0 && (
                  <button onClick={() => setSelectedSids(new Set())} style={{ ...btnSub, color: "#c45555" }}>
                    選択解除
                  </button>
                )}
              </div>

              {loadingHP && therapists.length === 0 ? (
                <p style={{ fontSize: 12, color: T.textSub, textAlign: "center", padding: 20 }}>
                  HPからセラピストを取得中...
                </p>
              ) : therapists.length === 0 ? (
                <p style={{ fontSize: 12, color: T.textSub, textAlign: "center", padding: 20 }}>
                  セラピストが見つかりませんでした
                </p>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))", gap: 6, maxHeight: 360, overflowY: "auto", padding: 2 }}>
                  {filteredTherapists.map(th => {
                    const isSelected = selectedSids.has(th.sid);
                    return (
                      <button key={th.sid} onClick={() => toggleTherapist(th.sid)}
                        style={{
                          padding: 6, borderRadius: 10, cursor: "pointer", textAlign: "center",
                          border: isSelected ? `2px solid ${T.accent}` : `1px solid ${T.border}`,
                          backgroundColor: isSelected ? T.accentBg : T.cardAlt,
                          transition: "all 0.15s", position: "relative",
                        }}
                      >
                        {/* 選択番号バッジ */}
                        {isSelected && (
                          <div style={{
                            position: "absolute", top: 4, left: 4, width: 20, height: 20, borderRadius: "50%",
                            backgroundColor: T.accent, color: "white", fontSize: 10, fontWeight: 700,
                            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1,
                          }}>
                            {[...selectedSids].indexOf(th.sid) + 1}
                          </div>
                        )}
                        {th.imageUrl && (
                          <img src={th.imageUrl} alt={th.name}
                            style={{ width: "100%", aspectRatio: "3/4", objectFit: "cover", borderRadius: 6, marginBottom: 3 }}
                            onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                          />
                        )}
                        <p style={{ fontSize: 11, fontWeight: 600, color: T.text, margin: 0, lineHeight: 1.2 }}>{th.name}</p>
                        <p style={{ fontSize: 8, color: T.textSub, margin: 0, lineHeight: 1.3 }}>
                          {[th.age && `${th.age}歳`, th.height && `${th.height}cm`, th.cup && `${th.cup}cup`].filter(Boolean).join(" ")}
                        </p>
                        <span style={{
                          fontSize: 8, color: th.status.includes("出勤中") ? "#7ab88f" : T.textMuted,
                        }}>
                          {th.status.includes("出勤中") ? "●出勤中" : "○お休み"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── STEP 2: 動きの印象選択 ── */}
            <div style={{ ...cardStyle, padding: 16 }}>
              <div style={sectionTitle}>
                <span>②</span> 動きの印象を選ぶ
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 6 }}>
                {settings.motionCategories.map(motion => (
                  <button key={motion.id} onClick={() => setSelectedMotion(motion.id)}
                    style={{
                      display: "flex", alignItems: "center", gap: 8, padding: "10px 12px",
                      borderRadius: 10, cursor: "pointer", textAlign: "left",
                      border: selectedMotion === motion.id ? `2px solid ${T.accent}` : `1px solid ${T.border}`,
                      backgroundColor: selectedMotion === motion.id ? T.accentBg : T.cardAlt,
                      transition: "all 0.15s",
                    }}
                  >
                    <span style={{ fontSize: 20 }}>{motion.emoji}</span>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontSize: 12, fontWeight: 600, color: T.text, margin: 0 }}>{motion.label}</p>
                      <p style={{ fontSize: 9, color: T.textSub, margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{motion.description}</p>
                    </div>
                  </button>
                ))}
              </div>
              {selectedMotion === "custom" && (
                <textarea value={customMotionText} onChange={e => setCustomMotionText(e.target.value)}
                  placeholder="動きの指示を自由入力してください..."
                  style={{ ...inputStyle, marginTop: 8, minHeight: 60, resize: "vertical" }}
                />
              )}
            </div>

            {/* ── キューに追加ボタン ── */}
            <button onClick={addToQueue} disabled={selectedSids.size === 0}
              style={{
                ...btnPrimary, padding: "14px 0", fontSize: 15, width: "100%", borderRadius: 12,
                opacity: selectedSids.size === 0 ? 0.4 : 1,
              }}
            >
              🎬 {selectedSids.size > 0 ? `${selectedSids.size}名をキューに追加` : "セラピストを選択してください"}
            </button>

            {/* ── 制作キュー ── */}
            {queue.length > 0 && (
              <div style={{ ...cardStyle, padding: 16 }}>
                <div style={{ ...sectionTitle, marginBottom: 12 }}>
                  📋 制作キュー
                  <button onClick={fetchQueue} style={{ ...btnSub, marginLeft: "auto", fontSize: 10, padding: "4px 10px" }}>🔄</button>
                </div>

                <div className="flex flex-col gap-2">
                  {queue.map((item, idx) => {
                    const sc = statusConfig[item.result] || statusConfig.queued;
                    return (
                      <div key={item.id}
                        style={{
                          display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
                          borderRadius: 10, backgroundColor: sc.bg, border: `1px solid ${T.border}`,
                        }}
                      >
                        {/* 順番 */}
                        <span style={{ fontSize: 12, fontWeight: 700, color: T.textMuted, width: 20, textAlign: "center" }}>
                          {idx + 1}
                        </span>

                        {/* サムネ */}
                        <div style={{ width: 40, height: 40, borderRadius: 6, overflow: "hidden", flexShrink: 0, backgroundColor: T.cardAlt }}>
                          {item.image_url ? (
                            <img src={item.image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          ) : (
                            <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>👤</div>
                          )}
                        </div>

                        {/* 情報 */}
                        <div className="flex-1 min-w-0">
                          <p style={{ fontSize: 12, fontWeight: 600, color: T.text, margin: 0 }}>{item.therapist_name}</p>
                          <p style={{ fontSize: 10, color: T.textSub, margin: 0 }}>🎭 {item.motion_category}</p>
                        </div>

                        {/* ステータス */}
                        <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                          <span className={sc.spin ? "vg-spin" : ""} style={{ fontSize: sc.spin ? 18 : 14 }}>{sc.icon}</span>
                          <span style={{ fontSize: 11, fontWeight: 600, color: sc.color }}>{sc.label}</span>
                        </div>

                        {/* キャンセルボタン */}
                        {(item.result === "queued" || item.result === "pending") && (
                          <button onClick={() => cancelQueueItem(item.id)}
                            style={{
                              background: "none", border: `1px solid rgba(196,85,85,0.3)`,
                              borderRadius: 6, padding: "4px 8px", fontSize: 10, cursor: "pointer",
                              color: "#c45555", flexShrink: 0,
                            }}
                          >取消</button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ════════════ 履歴タブ ════════════ */}
        {activeTab === "history" && (
          <div className="flex flex-col gap-3">
            <div className="flex justify-between items-center mb-2">
              <p style={{ fontSize: 13, fontWeight: 600, color: T.text }}>生成履歴</p>
              <button onClick={fetchLogs} style={btnSub}>🔄 更新</button>
            </div>

            {loadingLogs ? (
              <p style={{ textAlign: "center", color: T.textSub, fontSize: 12, padding: 40 }}>読み込み中...</p>
            ) : logs.length === 0 ? (
              <div style={{ ...cardStyle, padding: 40, textAlign: "center" }}>
                <p style={{ fontSize: 36, marginBottom: 8 }}>🎬</p>
                <p style={{ fontSize: 13, color: T.textSub }}>まだ生成履歴がありません</p>
              </div>
            ) : (
              logs.map(log => {
                const sc = statusConfig[log.result] || statusConfig.queued;
                return (
                  <div key={log.id} style={{ ...cardStyle, padding: 14 }}>
                    <div className="flex gap-3">
                      <div style={{ width: 70, height: 70, borderRadius: 8, overflow: "hidden", flexShrink: 0, backgroundColor: T.cardAlt }}>
                        {log.image_url ? (
                          <img src={log.image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        ) : (
                          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28 }}>🎬</div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{log.therapist_name}</span>
                          <span style={{
                            fontSize: 10, padding: "2px 8px", borderRadius: 10,
                            backgroundColor: sc.bg, color: sc.color,
                          }}>
                            <span className={sc.spin ? "vg-spin" : ""} style={{ marginRight: 3 }}>{sc.icon}</span>
                            {sc.label}
                          </span>
                        </div>
                        <p style={{ fontSize: 11, color: T.textSub, margin: 0 }}>🎭 {log.motion_category}</p>
                        {log.video_filename && (
                          <p style={{ fontSize: 11, color: T.textSub, margin: 0 }}>📁 {log.video_filename}</p>
                        )}
                        <p style={{ fontSize: 10, color: T.textMuted, margin: "4px 0 0" }}>
                          {new Date(log.created_at).toLocaleString("ja-JP")}
                          {log.retry_count > 0 && ` (リトライ: ${log.retry_count}回)`}
                        </p>
                      </div>
                      <button onClick={() => toggleLike(log)}
                        style={{
                          background: "none", border: "none", cursor: "pointer",
                          fontSize: 24, padding: 4, alignSelf: "center",
                          opacity: log.liked ? 1 : 0.3, transition: "all 0.2s",
                        }}
                      >{log.liked ? "👍" : "👍"}</button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ════════════ 設定タブ ════════════ */}
        {activeTab === "settings" && (
          <div className="flex flex-col gap-4">
            {/* 基本設定 */}
            <div style={{ ...cardStyle, padding: 16 }}>
              <div style={sectionTitle}>📧 通知・保存設定</div>
              <div className="mb-3">
                <label style={labelStyle}>通知メールアドレス</label>
                <input value={settings.notifyEmail}
                  onChange={e => { setSettings(s => ({ ...s, notifyEmail: e.target.value })); setSettingsDirty(true); }}
                  placeholder="example@gmail.com" style={inputStyle} />
              </div>
              <div className="mb-3">
                <label style={labelStyle}>Googleドライブ保存先フォルダ名</label>
                <input value={settings.gdriveFolder}
                  onChange={e => { setSettings(s => ({ ...s, gdriveFolder: e.target.value })); setSettingsDirty(true); }}
                  style={inputStyle} />
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label style={labelStyle}>最大リトライ回数</label>
                  <input type="number" min={1} max={5} value={settings.maxRetries}
                    onChange={e => { setSettings(s => ({ ...s, maxRetries: parseInt(e.target.value) || 3 })); setSettingsDirty(true); }}
                    style={inputStyle} />
                </div>
                <div className="flex-1">
                  <label style={labelStyle}>ウォーターマーク除去 (px)</label>
                  <input type="number" min={0} max={300} value={settings.watermarkCropPx}
                    onChange={e => { setSettings(s => ({ ...s, watermarkCropPx: parseInt(e.target.value) || 100 })); setSettingsDirty(true); }}
                    style={inputStyle} />
                </div>
              </div>
            </div>

            {/* Gemini設定 */}
            <div style={{ ...cardStyle, padding: 16 }}>
              <div style={sectionTitle}>🤖 Gemini設定</div>
              <div className="mb-3">
                <label style={labelStyle}>Gemini URL</label>
                <input value={settings.geminiUrl}
                  onChange={e => { setSettings(s => ({ ...s, geminiUrl: e.target.value })); setSettingsDirty(true); }}
                  style={inputStyle} />
              </div>
              <label style={{ ...labelStyle, marginBottom: 8, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
                <input type="checkbox" checked={settings.autoSaveGdrive}
                  onChange={e => { setSettings(s => ({ ...s, autoSaveGdrive: e.target.checked })); setSettingsDirty(true); }}
                  style={{ accentColor: T.accent }} />
                <span style={{ fontSize: 12, color: T.text }}>Googleドライブに自動保存</span>
              </label>
              <label style={{ ...labelStyle, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
                <input type="checkbox" checked={settings.playwrightHeadless}
                  onChange={e => { setSettings(s => ({ ...s, playwrightHeadless: e.target.checked })); setSettingsDirty(true); }}
                  style={{ accentColor: T.accent }} />
                <span style={{ fontSize: 12, color: T.text }}>ヘッドレスモード（ブラウザ非表示）</span>
              </label>
            </div>

            {/* 印象カテゴリ管理 */}
            <div style={{ ...cardStyle, padding: 16 }}>
              <div style={sectionTitle}>
                🎭 印象カテゴリ管理
                <button onClick={addMotionCategory} style={{ ...btnSub, marginLeft: "auto", fontSize: 11, padding: "4px 12px" }}>＋ 追加</button>
              </div>
              <div className="flex flex-col gap-2">
                {settings.motionCategories.map((motion, idx) => (
                  <div key={motion.id} className="flex gap-2 items-start" style={{ padding: 8, backgroundColor: T.cardAlt, borderRadius: 8 }}>
                    <input value={motion.emoji} onChange={e => updateMotionCategory(idx, "emoji", e.target.value)}
                      style={{ ...inputStyle, width: 44, textAlign: "center", padding: "6px 4px" }} maxLength={4} />
                    <div className="flex-1">
                      <input value={motion.label} onChange={e => updateMotionCategory(idx, "label", e.target.value)}
                        placeholder="カテゴリ名" style={{ ...inputStyle, marginBottom: 4, padding: "6px 10px" }} />
                      <input value={motion.description} onChange={e => updateMotionCategory(idx, "description", e.target.value)}
                        placeholder="説明" style={{ ...inputStyle, fontSize: 11, padding: "5px 10px" }} />
                    </div>
                    <button onClick={() => removeMotionCategory(idx)}
                      style={{ ...btnSub, padding: "6px 10px", fontSize: 12, color: "#c45555" }}>✕</button>
                  </div>
                ))}
              </div>
            </div>

            {/* プロンプトテンプレート */}
            <div style={{ ...cardStyle, padding: 16 }}>
              <div style={sectionTitle}>📝 画像生成プロンプト</div>
              <textarea value={settings.imagePrompt}
                onChange={e => { setSettings(s => ({ ...s, imagePrompt: e.target.value })); setSettingsDirty(true); }}
                style={{ ...inputStyle, minHeight: 200, fontFamily: "monospace", fontSize: 11, lineHeight: 1.6, resize: "vertical" }} />
              <p style={{ fontSize: 10, color: T.textMuted, marginTop: 4 }}>
                変数: {"{age}"} {"{height}"} {"{cup}"} {"{motionCategory}"} {"{likedPromptExamples}"}
              </p>
              <button onClick={() => { setSettings(s => ({ ...s, imagePrompt: DEFAULT_IMAGE_PROMPT })); setSettingsDirty(true); }}
                style={{ ...btnSub, marginTop: 4, fontSize: 10 }}>🔄 デフォルトに戻す</button>
            </div>

            <div style={{ ...cardStyle, padding: 16 }}>
              <div style={sectionTitle}>🎥 動画生成プロンプト</div>
              <textarea value={settings.videoPrompt}
                onChange={e => { setSettings(s => ({ ...s, videoPrompt: e.target.value })); setSettingsDirty(true); }}
                style={{ ...inputStyle, minHeight: 120, fontFamily: "monospace", fontSize: 11, lineHeight: 1.6, resize: "vertical" }} />
              <button onClick={() => { setSettings(s => ({ ...s, videoPrompt: DEFAULT_VIDEO_PROMPT })); setSettingsDirty(true); }}
                style={{ ...btnSub, marginTop: 4, fontSize: 10 }}>🔄 デフォルトに戻す</button>
            </div>

            {/* ── ローカルPCセットアップガイド ── */}
            <SetupGuide T={T} cardStyle={cardStyle} sectionTitle={sectionTitle} />

            <div style={{ textAlign: "center", paddingBottom: 40 }}>
              <button onClick={saveSettings} disabled={!settingsDirty}
                style={{ ...btnPrimary, padding: "14px 60px", opacity: settingsDirty ? 1 : 0.5 }}>
                💾 設定を保存
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════ */
/* SetupGuide コンポーネント                          */
/* ═══════════════════════════════════════════════════ */
function SetupGuide({ T, cardStyle, sectionTitle }: {
  T: Record<string, string>;
  cardStyle: React.CSSProperties;
  sectionTitle: React.CSSProperties;
}) {
  const [open, setOpen] = useState(false);
  const [copiedStep, setCopiedStep] = useState<number | null>(null);

  const copyCmd = (text: string, step: number) => {
    navigator.clipboard.writeText(text);
    setCopiedStep(step);
    setTimeout(() => setCopiedStep(null), 2000);
  };

  const codeBlock: React.CSSProperties = {
    backgroundColor: "#1a1a2e", color: "#e0e0e0", padding: "10px 14px",
    borderRadius: 8, fontSize: 11, fontFamily: "monospace", lineHeight: 1.7,
    overflowX: "auto", position: "relative", whiteSpace: "pre-wrap", wordBreak: "break-all",
  };
  const copyBtn: React.CSSProperties = {
    position: "absolute", top: 6, right: 6, fontSize: 10, padding: "3px 8px",
    borderRadius: 4, cursor: "pointer", border: "1px solid rgba(255,255,255,0.15)",
    backgroundColor: "rgba(255,255,255,0.08)", color: "#ccc",
  };
  const stepNum: React.CSSProperties = {
    width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
    background: "linear-gradient(135deg, #c3a782, #a8895e)", color: "white",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 13, fontWeight: 700,
  };
  const stepCard: React.CSSProperties = {
    padding: 14, backgroundColor: T.cardAlt, borderRadius: 10,
    border: `1px solid ${T.border}`,
  };

  const STEPS = [
    {
      title: "Node.js をインストール",
      desc: "まだ入っていない場合のみ。v18以上が必要です。",
      link: "https://nodejs.org/",
      linkLabel: "nodejs.org からダウンロード",
      cmd: "node -v",
      cmdNote: "確認コマンド（v18以上が表示されればOK）",
    },
    {
      title: "ffmpeg をインストール",
      desc: "ウォーターマーク除去に使います。",
      link: "https://www.gyan.dev/ffmpeg/builds/",
      linkLabel: "ffmpeg をダウンロード（essentials推奨）",
      cmd: "ffmpeg -version",
      cmdNote: "解凍後、中の bin フォルダを環境変数PATHに追加してから確認",
    },
    {
      title: "リポジトリを取得（初回のみ）",
      desc: "デスクトップで作業する場合の例：",
      cmd: "cd C:\\Users\\user\\Desktop\\t-manage\ngit pull origin main",
      cmdNote: "既にクローン済みなら pull だけでOK",
    },
    {
      title: "video-automation フォルダに移動してセットアップ",
      desc: "依存パッケージとPlaywrightブラウザをインストールします。",
      cmd: "cd video-automation\nnpm install\nnpx playwright install chromium",
      cmdNote: "初回は数分かかります",
    },
    {
      title: ".env ファイルを作成",
      desc: ".env.example をコピーして .env を作り、各値を設定します。",
      cmd: 'copy .env.example .env\nnotepad .env',
      cmdNote: "メモ帳が開くので以下を編集：",
      envItems: [
        { key: "SUPABASE_ANON_KEY", hint: "Supabase → Settings → API → anon key" },
        { key: "CHROME_PROFILE_PATH", hint: "例: C:\\Users\\user\\AppData\\Local\\Google\\Chrome\\User Data" },
        { key: "DESKTOP_PATH", hint: "例: C:\\Users\\user\\Desktop" },
        { key: "GDRIVE_PATH", hint: "例: G:\\マイドライブ\\AI動画生成" },
        { key: "GMAIL_USER", hint: "例: ange.spa0510@gmail.com" },
        { key: "GMAIL_APP_PASS", hint: "Googleアカウント → セキュリティ → アプリパスワード" },
        { key: "NOTIFY_EMAIL", hint: "通知先メールアドレス" },
      ],
    },
    {
      title: "Gemini にログイン確認",
      desc: "Chromeで https://gemini.google.com/app を開き、ログイン済みの状態にしてください。Playwrightはこのプロファイルを使ってGeminiを操作します。",
      important: "⚠️ ウォッチャー起動前にChromeは閉じてください（プロファイルのロック防止）",
    },
    {
      title: "ウォッチャーを起動！",
      desc: "これで自動監視が始まります。T-MANAGEのWeb画面でキューに追加すると、自動で処理が開始されます。",
      cmd: "npm run watch",
      cmdNote: "停止するには Ctrl + C",
    },
  ];

  return (
    <div style={{ ...cardStyle, padding: 16, overflow: "hidden" }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          ...sectionTitle, cursor: "pointer", width: "100%",
          background: "none", border: "none", textAlign: "left", padding: 0,
          marginBottom: open ? 16 : 0,
        }}
      >
        🖥️ ローカルPCセットアップガイド
        <span style={{
          marginLeft: "auto", fontSize: 18, color: T.textSub,
          transform: open ? "rotate(180deg)" : "rotate(0deg)",
          transition: "transform 0.2s", display: "inline-block",
        }}>▾</span>
      </button>

      {open && (
        <div className="flex flex-col gap-3">
          {/* 概要 */}
          <div style={{ padding: 12, backgroundColor: T.accentBg, borderRadius: 8, border: `1px solid ${T.border}` }}>
            <p style={{ fontSize: 12, color: T.text, margin: 0, lineHeight: 1.7 }}>
              動画生成はローカルPCの<strong>Playwright</strong>がGeminiのWebUIを自動操作して行います。
              T-MANAGEの画面でキューに追加 → ローカルのウォッチャーが検出 → 自動で動画生成 → Googleドライブに保存、という流れです。
            </p>
            <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
              <span style={{ fontSize: 10, padding: "3px 8px", borderRadius: 6, backgroundColor: "rgba(122,184,143,0.15)", color: "#7ab88f" }}>API料金ゼロ</span>
              <span style={{ fontSize: 10, padding: "3px 8px", borderRadius: 6, backgroundColor: "rgba(133,168,196,0.15)", color: "#85a8c4" }}>GeminiのWebUIを使用</span>
              <span style={{ fontSize: 10, padding: "3px 8px", borderRadius: 6, backgroundColor: "rgba(195,167,130,0.15)", color: "#c3a782" }}>1日2回まで</span>
            </div>
          </div>

          {/* ステップ */}
          {STEPS.map((step, idx) => (
            <div key={idx} style={stepCard}>
              <div className="flex items-start gap-3">
                <div style={stepNum}>{idx + 1}</div>
                <div className="flex-1 min-w-0">
                  <p style={{ fontSize: 13, fontWeight: 600, color: T.text, margin: "0 0 4px" }}>{step.title}</p>
                  <p style={{ fontSize: 11, color: T.textSub, margin: "0 0 8px", lineHeight: 1.5 }}>{step.desc}</p>

                  {step.link && (
                    <a href={step.link} target="_blank" rel="noopener noreferrer"
                      style={{ fontSize: 11, color: T.accent, textDecoration: "underline", display: "inline-block", marginBottom: 8 }}>
                      🔗 {step.linkLabel}
                    </a>
                  )}

                  {step.cmd && (
                    <div style={{ position: "relative" }}>
                      {step.cmdNote && (
                        <p style={{ fontSize: 10, color: T.textMuted, margin: "0 0 4px" }}>{step.cmdNote}</p>
                      )}
                      <div style={codeBlock}>
                        <button onClick={() => copyCmd(step.cmd!, idx)} style={copyBtn}>
                          {copiedStep === idx ? "✅ コピー済" : "📋 コピー"}
                        </button>
                        {step.cmd}
                      </div>
                    </div>
                  )}

                  {step.envItems && (
                    <div style={{ marginTop: 8 }} className="flex flex-col gap-1">
                      {step.envItems.map(env => (
                        <div key={env.key} style={{ padding: "6px 10px", backgroundColor: "#1a1a2e", borderRadius: 6 }}>
                          <span style={{ fontSize: 11, color: "#c3a782", fontFamily: "monospace", fontWeight: 600 }}>{env.key}</span>
                          <span style={{ fontSize: 10, color: "#999", marginLeft: 8 }}>{env.hint}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {step.important && (
                    <p style={{
                      fontSize: 11, color: "#c45555", margin: "8px 0 0",
                      padding: "6px 10px", backgroundColor: "rgba(196,85,85,0.08)",
                      borderRadius: 6, lineHeight: 1.5,
                    }}>{step.important}</p>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* アーキテクチャ図 */}
          <div style={{ ...stepCard, textAlign: "center" }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: T.text, margin: "0 0 12px" }}>🔄 動作フロー</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "center" }}>
              {[
                { icon: "👆", text: "スタッフがT-MANAGEでセラピスト選択 → キューに追加" },
                { icon: "⬇️", text: "" },
                { icon: "📡", text: "Supabaseにリクエスト保存（result: queued）" },
                { icon: "⬇️", text: "" },
                { icon: "🖥️", text: "ローカルPC watcher.js がポーリングで検出" },
                { icon: "⬇️", text: "" },
                { icon: "🤖", text: "Playwright → Gemini で画像生成 → VEO動画生成" },
                { icon: "⬇️", text: "" },
                { icon: "✂️", text: "ffmpeg ウォーターマーク除去 → リネーム" },
                { icon: "⬇️", text: "" },
                { icon: "📁", text: "デスクトップ + Googleドライブに保存" },
                { icon: "⬇️", text: "" },
                { icon: "📧", text: "完了メール通知 → Supabase result: success に更新" },
                { icon: "⬇️", text: "" },
                { icon: "✅", text: "T-MANAGEの画面に「完了」が反映" },
              ].map((row, i) => (
                row.text === "" ? (
                  <span key={i} style={{ fontSize: 10, color: T.textMuted }}>⬇️</span>
                ) : (
                  <div key={i} style={{
                    padding: "6px 16px", borderRadius: 8, fontSize: 11, color: T.text,
                    backgroundColor: T.cardAlt, border: `1px solid ${T.border}`,
                    maxWidth: 400, width: "100%",
                  }}>
                    <span style={{ marginRight: 6 }}>{row.icon}</span>{row.text}
                  </div>
                )
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
