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
const DEFAULT_IMAGE_PROMPT = `【核心指示】添付画像を注意深く観察してください。
人物の衣装、装飾、髪型、ポーズ、背景を把握し、
特に顔周りの処理（スタンプ、マスク、非表示部分など）を正確に認識してください。

【モデル情報】年齢: {age}歳 / 身長: {height}cm / {cup}カップ

【ポーズ生成】上記の体型情報と画像から、
「{motionCategory}」を感じる自然な動きを加えた
フォトリアルな新しいポーズ画像を生成してください。

{likedPromptExamples}

【一貫性の維持】
顔: 顔周りの処理は元画像と完全に同じ状態を厳格に再現（スタンプ・マスクはそのまま維持）。
衣装: 衣装・装飾・背景は完全に同一を維持。歪みや変形は厳禁。
肌: 滑らかでフォトリアルな描写。
体型: 体型に合った自然な可動域と動きの幅を考慮。

【品質】フォトリアル、高精細テクスチャ、シネマティック照明、4K解像度。

【創造性】テンプレート的な定型ポーズは避け、この人物だけの個性ある動きにしてください。
動きは現在のポーズから自然に到達できる範囲で。

【安全確認】安全・コンテンツガイドラインに準拠する場合のみ生成してください。`;

const DEFAULT_VIDEO_PROMPT = `【核心指示】元の画像のポーズから生成された画像のポーズへ、
フォトリアルで極めて滑らかなシネマティックスローモーション動画を生成してください。

【動きとタイミング】動きは極めて遅く、段階的かつ滑らかに。
急な変化やぎこちない動きは厳禁。動きの始まりと終わりにシネマティックな
イーズイン・イーズアウトを入れ、余韻と優雅さを演出。
テンポは急がず、ハイエンドな印象に。

【一貫性の維持】
顔: 元画像の顔の特徴・表情・髪型を動画全体で厳格に維持。
顔の加工（スタンプ・マスク等）はそのまま保持。
衣装: 衣服やアクセサリーの細部・質感・柄を一切変えない。
背景: 元のシーンと同一の静止した背景を維持。

【品質】4K解像度、フォトリアル、シネマティック照明、高精細テクスチャ。

【安全確認】安全・コンテンツガイドラインに準拠する場合のみ生成してください。`;

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

// ── 英語プロンプトテンプレート（Gemini送信用） ──
const DEFAULT_IMAGE_PROMPT_EN = `[Core Instruction] Carefully observe the attached image. Analyze the person's outfit, accessories, hairstyle, pose, and background. Pay special attention to any facial processing (stamps, masks, hidden areas) and recognize them accurately.

[Model Info] Age: {age} / Height: {height}cm / {cup} cup

[Pose Generation] Based on the body type info above and the image, generate a new photorealistic pose image that conveys a natural "{motionCategory}" movement.

{likedPromptExamples}

[Consistency & Conservation] Facial Details: Reproduce the exact same facial processing as the original (strictly maintain stamps/masks as-is). Clothing & Props: Preserve outfit, accessories, and background completely identical without distortion. Skin: Smooth, flawless rendering. Body: Consider natural range of motion appropriate for this body type.

[Quality & Style] Photorealistic, Highly detailed textures, Cinematic lighting, 4K resolution.

[Creativity] Avoid generic template poses — create a unique, personalized movement for this specific person. Movement should be naturally reachable from the current pose.

[Safety Check] Please generate this image only if the subject and scene are fully permissible under safety and content guidelines.`;

const DEFAULT_VIDEO_PROMPT_EN = `[Core Instruction] Create a photorealistic, exceptionally smooth, cinematic slow-motion video showing a natural transition from the original uploaded image's pose to the generated image's pose.

[Motion & Timing] The movement must be extremely slow, gradual, and fluid, with no sudden or jerky shifts. Integrate graceful, cinematic ease-in and ease-out at the beginning and end of the motion to create a sense of lingering presence and elegance. The pacing must feel unhurried and high-end.

[Consistency & Conservation] Facial Details: Strictly maintain the exact facial features, expression, and hair style from the original image throughout the entire video. Any facial processing (stamps, masks, hidden areas) must remain exactly as-is. Clothing & Props: Preserve every detail, texture, and pattern of the attire and any accessories without alteration. Do not allow the details to distort or hallucinate. Background: Keep the background static and identical to the original scene.

[Quality & Style] 4K resolution, High-definition rendering, Photorealistic, Cinematic lighting, Highly detailed textures, 3D consistency.

[Safety Check] Please generate this video only if the subject and scene are fully permissible under safety and content guidelines.`;

/* ═══════════════════════════════════════════════════ */
export default function VideoGenerator() {
  const router = useRouter();
  const { dark, toggle, T } = useTheme();
  const toast = useToast();

  // ─── タブ ───
  const [activeTab, setActiveTab] = useState<"generate" | "history" | "settings">("generate");

  // ─── 生成モード ───
  const [genMode, setGenMode] = useState<"hp" | "upload">("hp");

  // ─── セラピスト一覧（HP） ───
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [loadingHP, setLoadingHP] = useState(false);
  const [searchName, setSearchName] = useState("");

  // ─── セラピスト画像展開 ───
  const [expandedSid, setExpandedSid] = useState<string | null>(null);
  const [profileImagesMap, setProfileImagesMap] = useState<Record<string, string[]>>({});
  const [loadingProfile, setLoadingProfile] = useState<string | null>(null);

  // ─── 選択済みエントリ（HP + アップロード共通） ───
  type SelectedEntry = { sid: string; name: string; age: string; height: string; cup: string; imageUrl: string; isUpload?: boolean };
  const [selectedEntries, setSelectedEntries] = useState<SelectedEntry[]>([]);

  // ─── アップロードモード ───
  const [uploadPreview, setUploadPreview] = useState<string>("");
  const [uploadName, setUploadName] = useState("");
  const [uploadNameSearch, setUploadNameSearch] = useState("");

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
    imagePromptEn: DEFAULT_IMAGE_PROMPT_EN,
    videoPromptEn: DEFAULT_VIDEO_PROMPT_EN,
    motionCategories: DEFAULT_MOTIONS,
    notifyEmail: "",
    gdriveFolder: "AI動画生成",
    maxRetries: 3,
    watermarkCropPx: 100,
    geminiUrl: "https://gemini.google.com/app",
    playwrightHeadless: false,
    autoSaveGdrive: true,
    randomAutoEnabled: false,
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

  /* ─── セラピストクリック → 画像展開 ─── */
  const handleTherapistClick = async (th: Therapist) => {
    if (expandedSid === th.sid) { setExpandedSid(null); return; }
    setExpandedSid(th.sid);

    // 既にプロフィール画像を取得済みならスキップ
    if (profileImagesMap[th.sid]) return;

    setLoadingProfile(th.sid);
    try {
      const res = await fetch("/api/scrape-therapists", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sid: th.sid }),
      });
      const data = await res.json();
      if (data.images) {
        setProfileImagesMap(prev => ({ ...prev, [th.sid]: data.images.slice(0, 5) }));
      }
    } catch { /* ignore */ }
    setLoadingProfile(null);
  };

  /* ─── 画像を選択してエントリ追加 ─── */
  const selectImage = (th: Therapist, imageUrl: string) => {
    if (selectedEntries.length >= 10) { toast.show("最大10件まで選択できます", "error"); return; }
    // 同じセラピスト+同じ画像の重複チェック
    if (selectedEntries.some(e => e.sid === th.sid && e.imageUrl === imageUrl)) {
      toast.show("既に選択されています", "info"); return;
    }
    setSelectedEntries(prev => [...prev, {
      sid: th.sid, name: th.name, age: th.age, height: th.height, cup: th.cup, imageUrl,
    }]);
    setExpandedSid(null);
    toast.show(`${th.name} を追加しました`);
  };

  /* ─── エントリ削除 ─── */
  const removeEntry = (idx: number) => {
    setSelectedEntries(prev => prev.filter((_, i) => i !== idx));
  };

  /* ─── アップロード処理 ─── */
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setUploadPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const addUploadEntry = () => {
    if (!uploadPreview) { toast.show("画像を選択してください", "error"); return; }
    const name = uploadName.trim();
    if (!name) { toast.show("セラピスト名を入力してください", "error"); return; }
    if (selectedEntries.length >= 10) { toast.show("最大10件まで選択できます", "error"); return; }

    // セラピスト一覧からマッチするか探す
    const matched = therapists.find(t => t.name === name);

    setSelectedEntries(prev => [...prev, {
      sid: matched?.sid || `upload_${Date.now()}`,
      name,
      age: matched?.age || "",
      height: matched?.height || "",
      cup: matched?.cup || "",
      imageUrl: uploadPreview,
      isUpload: true,
    }]);
    setUploadPreview("");
    setUploadName("");
    toast.show(`${name} を追加しました`);
  };

  /* ─── キューに追加 ─── */
  const addToQueue = async () => {
    if (selectedEntries.length === 0) { toast.show("セラピストを選択してください", "error"); return; }

    const motionLabel = selectedMotion === "custom"
      ? customMotionText || "カスタム"
      : (settings.motionCategories.find(m => m.id === selectedMotion)?.label || selectedMotion);

    const requests = selectedEntries.map(e => ({
      therapist_name: e.name,
      therapist_sid: e.sid,
      therapist_age: e.age,
      therapist_height: e.height,
      therapist_cup: e.cup,
      image_url: e.imageUrl,
      all_image_urls: [e.imageUrl],
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

    toast.show(`${selectedEntries.length}件をキューに追加しました`);
    setSelectedEntries([]);
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
        else if (k === "image_prompt_en") s.imagePromptEn = row.value;
        else if (k === "video_prompt_en") s.videoPromptEn = row.value;
        else if (k === "notify_email") s.notifyEmail = row.value;
        else if (k === "gdrive_folder") s.gdriveFolder = row.value;
        else if (k === "max_retries") s.maxRetries = parseInt(row.value) || 3;
        else if (k === "watermark_crop_px") s.watermarkCropPx = parseInt(row.value) || 100;
        else if (k === "gemini_url") s.geminiUrl = row.value;
        else if (k === "headless") s.playwrightHeadless = row.value === "true";
        else if (k === "auto_save_gdrive") s.autoSaveGdrive = row.value !== "false";
        else if (k === "random_auto") s.randomAutoEnabled = row.value === "true";
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
      { key: "vg_image_prompt_en", value: settings.imagePromptEn },
      { key: "vg_video_prompt_en", value: settings.videoPromptEn },
      { key: "vg_notify_email", value: settings.notifyEmail },
      { key: "vg_gdrive_folder", value: settings.gdriveFolder },
      { key: "vg_max_retries", value: String(settings.maxRetries) },
      { key: "vg_watermark_crop_px", value: String(settings.watermarkCropPx) },
      { key: "vg_gemini_url", value: settings.geminiUrl },
      { key: "vg_headless", value: String(settings.playwrightHeadless) },
      { key: "vg_auto_save_gdrive", value: String(settings.autoSaveGdrive) },
      { key: "vg_random_auto", value: String(settings.randomAutoEnabled) },
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
            <div style={{ ...cardStyle, padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
              <div className="flex items-center gap-3">
                <span style={{ fontSize: 12, color: T.textSub }}>本日の制作</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: todayCount >= DAILY_LIMIT ? "#c45555" : "#7ab88f" }}>
                  {todayCount} / {DAILY_LIMIT}
                </span>
                {todayCount >= DAILY_LIMIT && (
                  <span style={{ fontSize: 10, color: "#c45555", backgroundColor: "rgba(196,85,85,0.1)", padding: "2px 8px", borderRadius: 6 }}>
                    翌日に持ち越し
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span style={{ fontSize: 11, color: T.textSub }}>待機: {queue.filter(q => q.result === "queued").length}</span>
                <span style={{ fontSize: 11, color: "#a78bc4" }}>制作中: {queue.filter(q => q.result === "processing").length}</span>
              </div>
            </div>

            {/* ── モード切替 ── */}
            <div className="flex gap-2">
              {([{ key: "hp", label: "📋 HPから選択" }, { key: "upload", label: "📤 画像アップロード" }] as const).map(m => (
                <button key={m.key} onClick={() => setGenMode(m.key)}
                  style={{
                    flex: 1, padding: "10px 0", fontSize: 12, fontWeight: genMode === m.key ? 600 : 400,
                    borderRadius: 10, cursor: "pointer",
                    border: genMode === m.key ? `2px solid ${T.accent}` : `1px solid ${T.border}`,
                    backgroundColor: genMode === m.key ? T.accentBg : T.cardAlt,
                    color: genMode === m.key ? T.accent : T.textSub,
                  }}
                >{m.label}</button>
              ))}
            </div>

            {/* ═══ HPから選択モード ═══ */}
            {genMode === "hp" && (
              <div style={{ ...cardStyle, padding: 16 }}>
                <div style={{ ...sectionTitle, marginBottom: 12 }}>
                  <span>①</span> セラピストを選んで画像を選択
                  <span style={{ fontSize: 11, fontWeight: 400, color: T.textSub, marginLeft: "auto" }}>(最大10件)</span>
                </div>

                <div className="flex gap-2 mb-3">
                  <input placeholder="名前で検索..." value={searchName} onChange={e => setSearchName(e.target.value)}
                    style={{ ...inputStyle, flex: 1 }} />
                  <button onClick={fetchTherapists} disabled={loadingHP} style={btnSub}>
                    {loadingHP ? "取得中..." : "🔄 再取得"}
                  </button>
                </div>

                {loadingHP && therapists.length === 0 ? (
                  <p style={{ fontSize: 12, color: T.textSub, textAlign: "center", padding: 20 }}>HPからセラピストを取得中...</p>
                ) : (
                  <div style={{ maxHeight: 420, overflowY: "auto", padding: 2 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))", gap: 6 }}>
                      {filteredTherapists.map(th => {
                        const isExpanded = expandedSid === th.sid;
                        const hasSelected = selectedEntries.some(e => e.sid === th.sid);
                        return (
                          <button key={th.sid} onClick={() => handleTherapistClick(th)}
                            style={{
                              padding: 6, borderRadius: 10, cursor: "pointer", textAlign: "center",
                              border: isExpanded ? `2px solid ${T.accent}` : hasSelected ? `2px solid #7ab88f` : `1px solid ${T.border}`,
                              backgroundColor: isExpanded ? T.accentBg : T.cardAlt,
                              transition: "all 0.15s", position: "relative",
                            }}
                          >
                            {hasSelected && (
                              <div style={{
                                position: "absolute", top: 4, right: 4, width: 18, height: 18, borderRadius: "50%",
                                backgroundColor: "#7ab88f", color: "white", fontSize: 10, fontWeight: 700,
                                display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1,
                              }}>✓</div>
                            )}
                            {th.imageUrl && (
                              <img src={th.imageUrl} alt={th.name}
                                style={{ width: "100%", aspectRatio: "3/4", objectFit: "cover", borderRadius: 6, marginBottom: 3 }}
                                onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                            )}
                            <p style={{ fontSize: 11, fontWeight: 600, color: T.text, margin: 0, lineHeight: 1.2 }}>{th.name}</p>
                            <p style={{ fontSize: 8, color: T.textSub, margin: 0, lineHeight: 1.3 }}>
                              {[th.age && `${th.age}歳`, th.height && `${th.height}cm`, th.cup && `${th.cup}cup`].filter(Boolean).join(" ")}
                            </p>
                          </button>
                        );
                      })}
                    </div>

                    {/* ── 展開パネル（プロフィール画像） ── */}
                    {expandedSid && (() => {
                      const th = therapists.find(t => t.sid === expandedSid);
                      if (!th) return null;
                      const images = profileImagesMap[expandedSid] || [];
                      return (
                        <div style={{
                          marginTop: 8, padding: 14, borderRadius: 10,
                          backgroundColor: T.accentBg, border: `2px solid ${T.accent}`,
                        }}>
                          <div className="flex items-center gap-2 mb-2">
                            <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{th.name}</span>
                            <span style={{ fontSize: 11, color: T.textSub }}>— 画像をクリックして選択</span>
                            <button onClick={() => setExpandedSid(null)}
                              style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: T.textSub, fontSize: 16 }}>✕</button>
                          </div>
                          {loadingProfile === expandedSid ? (
                            <p style={{ fontSize: 12, color: T.textSub, textAlign: "center", padding: 16 }}>画像を読み込み中...</p>
                          ) : images.length === 0 ? (
                            <div>
                              <p style={{ fontSize: 11, color: T.textSub, marginBottom: 8 }}>プロフィール画像が見つかりませんでした。一覧画像を使用：</p>
                              <button onClick={() => selectImage(th, th.imageUrl)}
                                style={{ padding: 0, border: `2px solid ${T.border}`, borderRadius: 8, cursor: "pointer", overflow: "hidden", background: "none" }}>
                                <img src={th.imageUrl} alt="" style={{ width: 100, height: 130, objectFit: "cover" }} />
                              </button>
                            </div>
                          ) : (
                            <div className="flex gap-2" style={{ overflowX: "auto", paddingBottom: 4 }}>
                              {images.map((imgUrl, i) => (
                                <button key={i} onClick={() => selectImage(th, imgUrl)}
                                  style={{
                                    padding: 0, border: `2px solid ${T.border}`, borderRadius: 8,
                                    cursor: "pointer", overflow: "hidden", flexShrink: 0, background: "none",
                                    transition: "all 0.15s",
                                  }}
                                  onMouseOver={e => (e.currentTarget.style.borderColor = T.accent)}
                                  onMouseOut={e => (e.currentTarget.style.borderColor = T.border)}
                                >
                                  <img src={imgUrl} alt={`${th.name} ${i + 1}`}
                                    style={{ width: 100, height: 130, objectFit: "cover", display: "block" }}
                                    onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            )}

            {/* ═══ アップロードモード ═══ */}
            {genMode === "upload" && (
              <div style={{ ...cardStyle, padding: 16 }}>
                <div style={{ ...sectionTitle, marginBottom: 12 }}>
                  <span>①</span> 画像をアップロード → セラピスト名を入力
                </div>

                <div className="flex gap-4" style={{ flexWrap: "wrap" }}>
                  {/* 画像プレビュー */}
                  <div style={{ width: 140 }}>
                    {uploadPreview ? (
                      <div style={{ position: "relative" }}>
                        <img src={uploadPreview} alt="プレビュー"
                          style={{ width: "100%", aspectRatio: "3/4", objectFit: "cover", borderRadius: 10, border: `2px solid ${T.accent}` }} />
                        <button onClick={() => setUploadPreview("")}
                          style={{
                            position: "absolute", top: 4, right: 4, width: 22, height: 22, borderRadius: "50%",
                            backgroundColor: "rgba(0,0,0,0.6)", color: "white", border: "none",
                            cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center",
                          }}>✕</button>
                      </div>
                    ) : (
                      <label style={{
                        width: "100%", aspectRatio: "3/4", borderRadius: 10, display: "flex",
                        flexDirection: "column", alignItems: "center", justifyContent: "center",
                        border: `2px dashed ${T.border}`, cursor: "pointer", gap: 4,
                        backgroundColor: T.cardAlt,
                      }}>
                        <span style={{ fontSize: 28 }}>📷</span>
                        <span style={{ fontSize: 10, color: T.textSub }}>画像を選択</span>
                        <input type="file" accept="image/*" onChange={handleFileUpload}
                          style={{ display: "none" }} />
                      </label>
                    )}
                  </div>

                  {/* セラピスト名入力 */}
                  <div className="flex-1" style={{ minWidth: 200 }}>
                    <label style={labelStyle}>セラピスト名</label>
                    <input value={uploadName} onChange={e => { setUploadName(e.target.value); setUploadNameSearch(e.target.value); }}
                      placeholder="名前を入力..." style={{ ...inputStyle, marginBottom: 8 }} />

                    {/* セラピスト候補（入力に応じて表示） */}
                    {uploadNameSearch && therapists.length > 0 && (
                      <div style={{ maxHeight: 120, overflowY: "auto", borderRadius: 8, border: `1px solid ${T.border}` }}>
                        {therapists
                          .filter(t => t.name.includes(uploadNameSearch))
                          .slice(0, 5)
                          .map(t => (
                            <button key={t.sid} onClick={() => { setUploadName(t.name); setUploadNameSearch(""); }}
                              style={{
                                width: "100%", padding: "6px 10px", fontSize: 12, cursor: "pointer",
                                textAlign: "left", border: "none", borderBottom: `1px solid ${T.border}`,
                                backgroundColor: T.cardAlt, color: T.text,
                              }}>
                              {t.name} <span style={{ fontSize: 10, color: T.textSub }}>{t.age}歳 {t.height}cm</span>
                            </button>
                          ))}
                      </div>
                    )}

                    <button onClick={addUploadEntry} disabled={!uploadPreview || !uploadName.trim()}
                      style={{ ...btnPrimary, marginTop: 8, opacity: (!uploadPreview || !uploadName.trim()) ? 0.4 : 1 }}>
                      ＋ 選択リストに追加
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ═══ 選択リスト ═══ */}
            {selectedEntries.length > 0 && (
              <div style={{ ...cardStyle, padding: 16 }}>
                <div style={{ ...sectionTitle, marginBottom: 8 }}>
                  📋 選択リスト ({selectedEntries.length}/10)
                  <button onClick={() => setSelectedEntries([])}
                    style={{ ...btnSub, marginLeft: "auto", fontSize: 10, padding: "4px 10px", color: "#c45555" }}>全て削除</button>
                </div>
                <div className="flex gap-2" style={{ overflowX: "auto", paddingBottom: 4 }}>
                  {selectedEntries.map((entry, idx) => (
                    <div key={idx} style={{
                      flexShrink: 0, width: 80, textAlign: "center", position: "relative",
                      padding: 4, borderRadius: 8, backgroundColor: T.cardAlt, border: `1px solid ${T.border}`,
                    }}>
                      <button onClick={() => removeEntry(idx)}
                        style={{
                          position: "absolute", top: 2, right: 2, width: 18, height: 18, borderRadius: "50%",
                          backgroundColor: "rgba(196,85,85,0.8)", color: "white", border: "none",
                          cursor: "pointer", fontSize: 10, zIndex: 1,
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}>✕</button>
                      <img src={entry.imageUrl} alt={entry.name}
                        style={{ width: "100%", aspectRatio: "3/4", objectFit: "cover", borderRadius: 6, marginBottom: 2 }}
                        onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                      <p style={{ fontSize: 10, fontWeight: 600, color: T.text, margin: 0, lineHeight: 1.2 }}>{entry.name}</p>
                      {entry.isUpload && <span style={{ fontSize: 8, color: T.accent }}>📤アップ</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── STEP 2: 動きの印象選択 ── */}
            <div style={{ ...cardStyle, padding: 16 }}>
              <div style={sectionTitle}><span>②</span> 動きの印象を選ぶ</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 6 }}>
                {settings.motionCategories.map(motion => (
                  <button key={motion.id} onClick={() => setSelectedMotion(motion.id)}
                    style={{
                      display: "flex", alignItems: "center", gap: 8, padding: "10px 12px",
                      borderRadius: 10, cursor: "pointer", textAlign: "left",
                      border: selectedMotion === motion.id ? `2px solid ${T.accent}` : `1px solid ${T.border}`,
                      backgroundColor: selectedMotion === motion.id ? T.accentBg : T.cardAlt,
                      transition: "all 0.15s",
                    }}>
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
                  style={{ ...inputStyle, marginTop: 8, minHeight: 60, resize: "vertical" }} />
              )}
            </div>

            {/* ── キューに追加ボタン ── */}
            <button onClick={addToQueue} disabled={selectedEntries.length === 0}
              style={{
                ...btnPrimary, padding: "14px 0", fontSize: 15, width: "100%", borderRadius: 12,
                opacity: selectedEntries.length === 0 ? 0.4 : 1,
              }}>
              🎬 {selectedEntries.length > 0 ? `${selectedEntries.length}件をキューに追加` : "セラピストを選択してください"}
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
                        }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: T.textMuted, width: 20, textAlign: "center" }}>{idx + 1}</span>
                        <div style={{ width: 40, height: 40, borderRadius: 6, overflow: "hidden", flexShrink: 0, backgroundColor: T.cardAlt }}>
                          {item.image_url && !item.image_url.startsWith("data:") ? (
                            <img src={item.image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          ) : (
                            <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>👤</div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p style={{ fontSize: 12, fontWeight: 600, color: T.text, margin: 0 }}>{item.therapist_name}</p>
                          <p style={{ fontSize: 10, color: T.textSub, margin: 0 }}>🎭 {item.motion_category}</p>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                          <span className={sc.spin ? "vg-spin" : ""} style={{ fontSize: sc.spin ? 18 : 14 }}>{sc.icon}</span>
                          <span style={{ fontSize: 11, fontWeight: 600, color: sc.color }}>{sc.label}</span>
                        </div>
                        {(item.result === "queued" || item.result === "pending") && (
                          <button onClick={() => cancelQueueItem(item.id)}
                            style={{
                              background: "none", border: "1px solid rgba(196,85,85,0.3)",
                              borderRadius: 6, padding: "4px 8px", fontSize: 10, cursor: "pointer",
                              color: "#c45555", flexShrink: 0,
                            }}>取消</button>
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
                      <button onClick={async () => {
                        if (!confirm(`「${log.therapist_name}」の履歴を削除しますか？`)) return;
                        await supabase.from("video_generation_logs").delete().eq("id", log.id);
                        fetchLogs();
                        toast.show("削除しました");
                      }}
                        style={{
                          background: "none", border: "none", cursor: "pointer",
                          fontSize: 16, padding: 4, alignSelf: "center",
                          color: T.textMuted, opacity: 0.4, transition: "all 0.2s",
                        }}
                        onMouseOver={e => (e.currentTarget.style.opacity = "1")}
                        onMouseOut={e => (e.currentTarget.style.opacity = "0.4")}
                      >🗑️</button>
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

            {/* ランダム自動生成 */}
            <div style={{ ...cardStyle, padding: 16 }}>
              <div style={sectionTitle}>🎲 ランダム自動生成</div>
              <p style={{ fontSize: 11, color: T.textSub, marginBottom: 12, lineHeight: 1.6 }}>
                ONにすると、毎日自動で2件のランダム動画を生成します。
                セラピスト・画像・印象カテゴリを自動で選び、キューに追加されます。
              </p>
              <label style={{ ...labelStyle, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, marginBottom: 0 }}>
                <input type="checkbox" checked={settings.randomAutoEnabled}
                  onChange={e => { setSettings(s => ({ ...s, randomAutoEnabled: e.target.checked })); setSettingsDirty(true); }}
                  style={{ accentColor: T.accent, width: 18, height: 18 }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: settings.randomAutoEnabled ? "#7ab88f" : T.text }}>
                  {settings.randomAutoEnabled ? "✅ ランダム自動生成 ON" : "ランダム自動生成 OFF"}
                </span>
              </label>
              {settings.randomAutoEnabled && (
                <div style={{ marginTop: 10, padding: 10, backgroundColor: T.cardAlt, borderRadius: 8, fontSize: 11, color: T.textSub, lineHeight: 1.6 }}>
                  📌 ウォッチャー（npm run watch）が起動中の場合、毎日の制作枠（2件/日）が空いていれば自動でキューに追加されます。
                  手動キューと合わせて1日最大2件です。
                </div>
              )}
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
              <div style={{ background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.3)", borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 12, lineHeight: 1.6 }}>
                🌐 <strong>英語プロンプトでGeminiに送信</strong><br />
                品質向上のため、Geminiには英語プロンプトが送信されます。日本語は参考用です。
              </div>

              {/* ── 画像生成プロンプト ── */}
              <div style={sectionTitle}>📸 画像生成プロンプト</div>

              <p style={{ fontSize: 11, fontWeight: 600, color: "#7ab88f", margin: "8px 0 4px" }}>🌐 English（Geminiに送信される）</p>
              <textarea value={settings.imagePromptEn}
                onChange={e => { setSettings(s => ({ ...s, imagePromptEn: e.target.value })); setSettingsDirty(true); }}
                style={{ ...inputStyle, minHeight: 220, fontFamily: "monospace", fontSize: 11, lineHeight: 1.6, resize: "vertical", borderColor: "rgba(122,184,143,0.4)" }} />
              <p style={{ fontSize: 10, color: T.textMuted, marginTop: 4 }}>
                Variables: {"{age}"} {"{height}"} {"{cup}"} {"{motionCategory}"} {"{likedPromptExamples}"}
              </p>
              <button onClick={() => { setSettings(s => ({ ...s, imagePromptEn: DEFAULT_IMAGE_PROMPT_EN })); setSettingsDirty(true); }}
                style={{ ...btnSub, marginTop: 4, fontSize: 10 }}>🔄 英語デフォルトに戻す</button>

              <details style={{ marginTop: 12 }}>
                <summary style={{ fontSize: 11, color: T.textSub, cursor: "pointer" }}>🇯🇵 日本語（参考用）</summary>
                <textarea value={settings.imagePrompt}
                  onChange={e => { setSettings(s => ({ ...s, imagePrompt: e.target.value })); setSettingsDirty(true); }}
                  style={{ ...inputStyle, minHeight: 180, fontFamily: "monospace", fontSize: 11, lineHeight: 1.6, resize: "vertical", marginTop: 8, opacity: 0.7 }} />
                <button onClick={() => { setSettings(s => ({ ...s, imagePrompt: DEFAULT_IMAGE_PROMPT })); setSettingsDirty(true); }}
                  style={{ ...btnSub, marginTop: 4, fontSize: 10 }}>🔄 日本語デフォルトに戻す</button>
              </details>
            </div>

            {/* ── 動画生成プロンプト ── */}
            <div style={{ ...cardStyle, padding: 16 }}>
              <div style={sectionTitle}>🎥 動画生成プロンプト</div>

              <p style={{ fontSize: 11, fontWeight: 600, color: "#7ab88f", margin: "8px 0 4px" }}>🌐 English（Geminiに送信される）</p>
              <textarea value={settings.videoPromptEn}
                onChange={e => { setSettings(s => ({ ...s, videoPromptEn: e.target.value })); setSettingsDirty(true); }}
                style={{ ...inputStyle, minHeight: 140, fontFamily: "monospace", fontSize: 11, lineHeight: 1.6, resize: "vertical", borderColor: "rgba(122,184,143,0.4)" }} />
              <button onClick={() => { setSettings(s => ({ ...s, videoPromptEn: DEFAULT_VIDEO_PROMPT_EN })); setSettingsDirty(true); }}
                style={{ ...btnSub, marginTop: 4, fontSize: 10 }}>🔄 英語デフォルトに戻す</button>

              <details style={{ marginTop: 12 }}>
                <summary style={{ fontSize: 11, color: T.textSub, cursor: "pointer" }}>🇯🇵 日本語（参考用）</summary>
                <textarea value={settings.videoPrompt}
                  onChange={e => { setSettings(s => ({ ...s, videoPrompt: e.target.value })); setSettingsDirty(true); }}
                  style={{ ...inputStyle, minHeight: 100, fontFamily: "monospace", fontSize: 11, lineHeight: 1.6, resize: "vertical", marginTop: 8, opacity: 0.7 }} />
                <button onClick={() => { setSettings(s => ({ ...s, videoPrompt: DEFAULT_VIDEO_PROMPT })); setSettingsDirty(true); }}
                  style={{ ...btnSub, marginTop: 4, fontSize: 10 }}>🔄 日本語デフォルトに戻す</button>
              </details>
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
      desc: "デスクトップにショートカットを作っておけば、ダブルクリックだけで監視を開始できます。",
      cmd: "start-watcher.bat",
      cmdNote: "🚀 かんたん起動（以下のどちらかの方法）",
      batSetup: true,
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

          {/* かんたん起動ボックス */}
          <div style={{
            padding: 14, borderRadius: 10,
            background: "linear-gradient(135deg, rgba(195,167,130,0.12), rgba(122,184,143,0.12))",
            border: "1px solid rgba(195,167,130,0.3)",
          }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: T.text, margin: "0 0 8px" }}>
              ⚡ セットアップ済みの方はここだけ！
            </p>
            <p style={{ fontSize: 12, color: T.textSub, margin: "0 0 4px", lineHeight: 1.6 }}>
              デスクトップの <strong>start-watcher</strong> ショートカットをダブルクリック → 監視開始
            </p>
            <p style={{ fontSize: 11, color: T.textMuted, margin: 0 }}>
              黒い画面が出て「🔍 新しいリクエストを確認中...」と表示されれば準備完了です。
            </p>
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

                  {!!(step as { batSetup?: boolean }).batSetup && (
                    <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                      <div style={{ padding: 12, backgroundColor: "rgba(122,184,143,0.08)", borderRadius: 8, border: "1px solid rgba(122,184,143,0.2)" }}>
                        <p style={{ fontSize: 12, fontWeight: 600, color: "#7ab88f", margin: "0 0 6px" }}>
                          方法① ダブルクリック起動（おすすめ）
                        </p>
                        <div style={{ fontSize: 11, color: T.textSub, lineHeight: 1.8 }}>
                          <p style={{ margin: "0 0 4px" }}>1. エクスプローラーで以下のファイルを開く：</p>
                          <div style={{ ...codeBlock, fontSize: 10, padding: "6px 10px", marginBottom: 6 }}>
                            C:\Users\user\Desktop\t-manage\video-automation\start-watcher.bat
                          </div>
                          <p style={{ margin: "0 0 4px" }}>2. 右クリック →「ショートカットの作成」→ デスクトップに移動</p>
                          <p style={{ margin: 0 }}>3. 次回からはデスクトップのショートカットをダブルクリックするだけ！</p>
                        </div>
                      </div>
                      <div style={{ padding: 12, backgroundColor: T.cardAlt, borderRadius: 8, border: `1px solid ${T.border}` }}>
                        <p style={{ fontSize: 12, fontWeight: 600, color: T.textSub, margin: "0 0 6px" }}>
                          方法② コマンドで起動
                        </p>
                        <div style={{ fontSize: 11, color: T.textSub, lineHeight: 1.8 }}>
                          <div style={{ ...codeBlock, fontSize: 10, padding: "6px 10px" }}>
                            <button onClick={() => copyCmd("cd C:\\Users\\user\\Desktop\\t-manage\\video-automation\nnpm run watch", 99)} style={copyBtn}>
                              {copiedStep === 99 ? "✅ コピー済" : "📋 コピー"}
                            </button>
                            cd C:\Users\user\Desktop\t-manage\video-automation{"\n"}npm run watch
                          </div>
                          <p style={{ margin: "6px 0 0", fontSize: 10, color: T.textMuted }}>停止するには Ctrl + C</p>
                        </div>
                      </div>
                    </div>
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
