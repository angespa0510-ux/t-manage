"use client";

import { useState, useEffect, useCallback } from "react";
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
type ProfileImage = { url: string; selected: boolean };
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
  { id: "friendly",  emoji: "😊", label: "親しみやすさ", description: "挨拶・笑顔・手を振るなど" },
  { id: "relax",     emoji: "🌿", label: "リラックス感", description: "髪を触る・首を傾げるなど" },
  { id: "elegant",   emoji: "✨", label: "上品さ",       description: "姿勢を正す・手を添えるなど" },
  { id: "gorgeous",  emoji: "💃", label: "華やかさ",     description: "衣装が映える動きなど" },
  { id: "custom",    emoji: "🎨", label: "カスタム",     description: "自由入力" },
];

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

/* ═══════════════════════════════════════════════════ */
export default function VideoGenerator() {
  const router = useRouter();
  const { dark, toggle, T } = useTheme();
  const toast = useToast();

  // ─── タブ ───
  const [activeTab, setActiveTab] = useState<"generate" | "history" | "settings">("generate");

  // ─── 生成タブ ───
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [loadingHP, setLoadingHP] = useState(false);
  const [selectedTherapist, setSelectedTherapist] = useState<Therapist | null>(null);
  const [profileImages, setProfileImages] = useState<ProfileImage[]>([]);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [selectedMotion, setSelectedMotion] = useState<string>("friendly");
  const [customMotionText, setCustomMotionText] = useState("");
  const [generating, setGenerating] = useState(false);
  const [genStatus, setGenStatus] = useState("");
  const [searchName, setSearchName] = useState("");

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
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) router.push("/");
    };
    check();
    loadSettings();
  }, [router]);

  /* ─── HPスクレイピング ─── */
  const fetchTherapists = useCallback(async () => {
    setLoadingHP(true);
    try {
      const res = await fetch("/api/scrape-therapists");
      const data = await res.json();
      if (data.therapists) {
        setTherapists(data.therapists);
        toast.show(`${data.count}名のセラピストを取得しました`);
      }
    } catch {
      toast.show("HP取得に失敗しました", "error");
    } finally {
      setLoadingHP(false);
    }
  }, [toast]);

  /* ─── プロフィール画像取得 ─── */
  const fetchProfileImages = useCallback(async (sid: string) => {
    setLoadingProfile(true);
    setProfileImages([]);
    try {
      const res = await fetch("/api/scrape-therapists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sid }),
      });
      const data = await res.json();
      if (data.images) {
        setProfileImages(data.images.map((url: string, i: number) => ({ url, selected: i === 0 })));
      }
    } catch {
      toast.show("プロフィール画像の取得に失敗しました", "error");
    } finally {
      setLoadingProfile(false);
    }
  }, [toast]);

  /* ─── セラピスト選択 ─── */
  const selectTherapist = (th: Therapist) => {
    setSelectedTherapist(th);
    fetchProfileImages(th.sid);
  };

  /* ─── 画像選択トグル ─── */
  const toggleImageSelect = (idx: number) => {
    setProfileImages(prev => prev.map((img, i) =>
      i === idx ? { ...img, selected: !img.selected } : img
    ));
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
    await supabase
      .from("video_generation_logs")
      .update({ liked: !log.liked })
      .eq("id", log.id);
    fetchLogs();
  };

  /* ─── 動画生成開始 ─── */
  const startGeneration = async () => {
    if (!selectedTherapist) { toast.show("セラピストを選択してください", "error"); return; }
    const selectedImgs = profileImages.filter(img => img.selected);
    if (selectedImgs.length === 0) { toast.show("画像を選択してください", "error"); return; }

    const motionLabel = selectedMotion === "custom"
      ? customMotionText
      : settings.motionCategories.find(m => m.id === selectedMotion)?.label || selectedMotion;

    setGenerating(true);
    setGenStatus("⏳ 生成リクエストを送信中...");

    // Supabaseにリクエストレコードを作成（ローカルPlaywrightがポーリングして実行）
    const request = {
      therapist_name: selectedTherapist.name,
      therapist_sid: selectedTherapist.sid,
      therapist_age: selectedTherapist.age,
      therapist_height: selectedTherapist.height,
      therapist_cup: selectedTherapist.cup,
      image_url: selectedImgs[0].url,
      all_image_urls: selectedImgs.map(i => i.url),
      motion_category: motionLabel,
      prompt_used: "",
      result: "pending",
      retry_count: 0,
      liked: false,
      video_filename: "",
      gdrive_path: settings.gdriveFolder,
    };

    const { data, error } = await supabase
      .from("video_generation_logs")
      .insert(request)
      .select()
      .single();

    if (error) {
      toast.show("リクエスト作成に失敗: " + error.message, "error");
      setGenerating(false);
      setGenStatus("");
      return;
    }

    setGenStatus(`✅ リクエスト #${data.id} を作成しました。ローカルサービスで自動実行されます。`);
    toast.show("生成リクエストを作成しました");

    // ステータス監視（30秒間隔でポーリング）
    const pollInterval = setInterval(async () => {
      const { data: updated } = await supabase
        .from("video_generation_logs")
        .select("result, video_filename")
        .eq("id", data.id)
        .single();

      if (updated) {
        if (updated.result === "success") {
          setGenStatus(`🎉 生成完了！ファイル: ${updated.video_filename}`);
          toast.show("動画生成が完了しました！");
          clearInterval(pollInterval);
          setGenerating(false);
        } else if (updated.result === "safety_rejected" || updated.result === "failed" || updated.result === "timeout") {
          setGenStatus(`❌ 生成失敗: ${updated.result}`);
          toast.show("動画生成に失敗しました", "error");
          clearInterval(pollInterval);
          setGenerating(false);
        }
        // "pending" or "processing" → 引き続き待機
        if (updated.result === "processing") {
          setGenStatus("🔄 Geminiで生成中... しばらくお待ちください");
        }
      }
    }, 15000);

    // 10分でタイムアウト
    setTimeout(() => {
      clearInterval(pollInterval);
      if (generating) {
        setGenStatus("⏰ タイムアウト - ローカルサービスの状態を確認してください");
        setGenerating(false);
      }
    }, 600000);
  };

  /* ─── タブが切り替わった時に履歴をロード ─── */
  useEffect(() => {
    if (activeTab === "history") fetchLogs();
  }, [activeTab, fetchLogs]);

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
      motionCategories: prev.motionCategories.map((m, i) =>
        i === idx ? { ...m, [field]: value } : m
      ),
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

  /* ═══════════════════════════════════════ RENDER ═══════ */
  return (
    <div className="h-screen flex flex-col" style={{ backgroundColor: T.bg, color: T.text }}>
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
          { key: "generate", label: "🎬 動画生成", },
          { key: "history",  label: "📋 生成履歴", },
          { key: "settings", label: "⚙️ 設定",    },
        ] as const).map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              flex: 1, padding: "12px 0", fontSize: 12, fontWeight: activeTab === tab.key ? 600 : 400,
              color: activeTab === tab.key ? T.accent : T.textSub,
              borderBottom: activeTab === tab.key ? `2px solid ${T.accent}` : "2px solid transparent",
              background: "none", border: "none", borderBottomWidth: 2, borderBottomStyle: "solid",
              cursor: "pointer",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── コンテンツ ── */}
      <div className="flex-1 overflow-y-auto p-4" style={{ maxWidth: 800, margin: "0 auto", width: "100%" }}>

        {/* ════════════ 生成タブ ════════════ */}
        {activeTab === "generate" && (
          <div className="flex flex-col gap-4">

            {/* STEP 1: セラピスト選択 */}
            <div style={{ ...cardStyle, padding: 16 }}>
              <div style={sectionTitle}>
                <span>①</span> セラピストを選ぶ
              </div>

              <div className="flex gap-2 mb-3">
                <input
                  placeholder="名前で検索..."
                  value={searchName}
                  onChange={e => setSearchName(e.target.value)}
                  style={{ ...inputStyle, flex: 1 }}
                />
                <button onClick={fetchTherapists} disabled={loadingHP} style={btnPrimary}>
                  {loadingHP ? "取得中..." : "🔄 HPから取得"}
                </button>
              </div>

              {therapists.length === 0 && !loadingHP && (
                <p style={{ fontSize: 12, color: T.textSub, textAlign: "center", padding: 20 }}>
                  「HPから取得」ボタンでセラピスト一覧を読み込んでください
                </p>
              )}

              {therapists.length > 0 && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))", gap: 8, maxHeight: 300, overflowY: "auto" }}>
                  {filteredTherapists.map(th => (
                    <button
                      key={th.sid}
                      onClick={() => selectTherapist(th)}
                      style={{
                        padding: 8, borderRadius: 10, cursor: "pointer", textAlign: "center",
                        border: selectedTherapist?.sid === th.sid ? `2px solid ${T.accent}` : `1px solid ${T.border}`,
                        backgroundColor: selectedTherapist?.sid === th.sid ? T.accentBg : T.cardAlt,
                        transition: "all 0.15s",
                      }}
                    >
                      {th.imageUrl && (
                        <img src={th.imageUrl} alt={th.name}
                          style={{ width: "100%", aspectRatio: "3/4", objectFit: "cover", borderRadius: 8, marginBottom: 4 }}
                          onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                        />
                      )}
                      <p style={{ fontSize: 12, fontWeight: 600, color: T.text, margin: 0 }}>{th.name}</p>
                      <p style={{ fontSize: 9, color: T.textSub, margin: 0 }}>
                        {th.age && `${th.age}歳`} {th.height && `${th.height}cm`} {th.cup && `${th.cup}cup`}
                      </p>
                      <span style={{
                        fontSize: 9, color: th.status.includes("出勤中") ? "#7ab88f" : T.textMuted,
                        display: "inline-block", marginTop: 2,
                      }}>
                        {th.status.includes("出勤中") ? `● ${th.status}` : "○ お休み"}
                        {th.store && <span style={{ display: "block", fontSize: 8, color: T.textMuted }}>{th.store}</span>}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* STEP 2: 画像選択 */}
            {selectedTherapist && (
              <div style={{ ...cardStyle, padding: 16 }}>
                <div style={sectionTitle}>
                  <span>②</span> 使用する画像を選ぶ
                  <span style={{ fontSize: 11, color: T.textSub, fontWeight: 400, marginLeft: "auto" }}>
                    {selectedTherapist.name} のプロフィール画像
                  </span>
                </div>

                {loadingProfile ? (
                  <p style={{ fontSize: 12, color: T.textSub, textAlign: "center", padding: 20 }}>
                    画像を読み込み中...
                  </p>
                ) : profileImages.length === 0 ? (
                  <p style={{ fontSize: 12, color: T.textSub, textAlign: "center", padding: 20 }}>
                    画像が見つかりませんでした
                  </p>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 8 }}>
                    {profileImages.map((img, idx) => (
                      <button
                        key={idx}
                        onClick={() => toggleImageSelect(idx)}
                        style={{
                          position: "relative", padding: 0, borderRadius: 10, overflow: "hidden",
                          cursor: "pointer",
                          border: img.selected ? `3px solid ${T.accent}` : `1px solid ${T.border}`,
                          opacity: img.selected ? 1 : 0.6,
                          transition: "all 0.15s", background: "none",
                        }}
                      >
                        <img src={img.url} alt={`画像${idx + 1}`}
                          style={{ width: "100%", aspectRatio: "3/4", objectFit: "cover", display: "block" }}
                          onError={e => { (e.target as HTMLImageElement).src = ""; }}
                        />
                        {img.selected && (
                          <div style={{
                            position: "absolute", top: 6, right: 6, width: 24, height: 24,
                            borderRadius: "50%", backgroundColor: T.accent,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            color: "white", fontSize: 14, fontWeight: 700,
                          }}>✓</div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* STEP 3: 動きの印象選択 */}
            {selectedTherapist && (
              <div style={{ ...cardStyle, padding: 16 }}>
                <div style={sectionTitle}>
                  <span>③</span> 動きの印象を選ぶ
                </div>

                <div className="flex flex-col gap-2">
                  {settings.motionCategories.map(motion => (
                    <button
                      key={motion.id}
                      onClick={() => setSelectedMotion(motion.id)}
                      style={{
                        display: "flex", alignItems: "center", gap: 12, padding: "12px 16px",
                        borderRadius: 10, cursor: "pointer", textAlign: "left",
                        border: selectedMotion === motion.id ? `2px solid ${T.accent}` : `1px solid ${T.border}`,
                        backgroundColor: selectedMotion === motion.id ? T.accentBg : T.cardAlt,
                        transition: "all 0.15s",
                      }}
                    >
                      <span style={{ fontSize: 22 }}>{motion.emoji}</span>
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 600, color: T.text, margin: 0 }}>{motion.label}</p>
                        <p style={{ fontSize: 11, color: T.textSub, margin: 0 }}>{motion.description}</p>
                      </div>
                    </button>
                  ))}
                </div>

                {selectedMotion === "custom" && (
                  <textarea
                    value={customMotionText}
                    onChange={e => setCustomMotionText(e.target.value)}
                    placeholder="動きの指示を自由入力してください..."
                    style={{ ...inputStyle, marginTop: 8, minHeight: 60, resize: "vertical" }}
                  />
                )}
              </div>
            )}

            {/* 生成ボタン */}
            {selectedTherapist && (
              <div style={{ ...cardStyle, padding: 16, textAlign: "center" }}>
                <button
                  onClick={startGeneration}
                  disabled={generating}
                  style={{
                    ...btnPrimary,
                    padding: "14px 40px", fontSize: 15,
                    opacity: generating ? 0.6 : 1,
                    width: "100%",
                  }}
                >
                  {generating ? "⏳ 生成中..." : "🎬 動画を生成する"}
                </button>

                {genStatus && (
                  <p style={{ fontSize: 12, color: T.textSub, marginTop: 12, lineHeight: 1.6 }}>
                    {genStatus}
                  </p>
                )}

                {/* 選択サマリー */}
                <div style={{ marginTop: 12, padding: 12, backgroundColor: T.cardAlt, borderRadius: 8, textAlign: "left" }}>
                  <p style={{ fontSize: 10, color: T.textMuted, marginBottom: 4 }}>生成内容サマリー</p>
                  <p style={{ fontSize: 12, color: T.text, margin: 0 }}>
                    👤 {selectedTherapist.name}
                    {selectedTherapist.age && ` (${selectedTherapist.age}歳)`}
                    {selectedTherapist.height && ` ${selectedTherapist.height}cm`}
                    {selectedTherapist.cup && ` ${selectedTherapist.cup}cup`}
                  </p>
                  <p style={{ fontSize: 12, color: T.text, margin: 0 }}>
                    📸 {profileImages.filter(i => i.selected).length}枚の画像を使用
                  </p>
                  <p style={{ fontSize: 12, color: T.text, margin: 0 }}>
                    🎭 {selectedMotion === "custom"
                      ? `カスタム: ${customMotionText || "(未入力)"}`
                      : settings.motionCategories.find(m => m.id === selectedMotion)?.label}
                  </p>
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
              logs.map(log => (
                <div key={log.id} style={{ ...cardStyle, padding: 14 }}>
                  <div className="flex gap-3">
                    {/* サムネイル */}
                    <div style={{ width: 80, height: 80, borderRadius: 8, overflow: "hidden", flexShrink: 0, backgroundColor: T.cardAlt }}>
                      {log.image_url ? (
                        <img src={log.image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (
                        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28 }}>🎬</div>
                      )}
                    </div>

                    {/* 情報 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{log.therapist_name}</span>
                        <span style={{
                          fontSize: 10, padding: "2px 8px", borderRadius: 10,
                          backgroundColor: log.result === "success" ? "rgba(122,184,143,0.15)" :
                            log.result === "pending" ? "rgba(195,167,130,0.15)" :
                            log.result === "processing" ? "rgba(133,168,196,0.15)" :
                            "rgba(196,85,85,0.15)",
                          color: log.result === "success" ? "#7ab88f" :
                            log.result === "pending" ? "#c3a782" :
                            log.result === "processing" ? "#85a8c4" :
                            "#c45555",
                        }}>
                          {log.result === "success" ? "✅ 完了" :
                           log.result === "pending" ? "⏳ 待機中" :
                           log.result === "processing" ? "🔄 生成中" :
                           `❌ ${log.result}`}
                        </span>
                      </div>
                      <p style={{ fontSize: 11, color: T.textSub, margin: 0 }}>
                        🎭 {log.motion_category}
                      </p>
                      {log.video_filename && (
                        <p style={{ fontSize: 11, color: T.textSub, margin: 0 }}>
                          📁 {log.video_filename}
                        </p>
                      )}
                      <p style={{ fontSize: 10, color: T.textMuted, margin: "4px 0 0" }}>
                        {new Date(log.created_at).toLocaleString("ja-JP")}
                        {log.retry_count > 0 && ` (リトライ: ${log.retry_count}回)`}
                      </p>
                    </div>

                    {/* いいねボタン */}
                    <button
                      onClick={() => toggleLike(log)}
                      style={{
                        background: "none", border: "none", cursor: "pointer",
                        fontSize: 24, padding: 4, alignSelf: "center",
                        opacity: log.liked ? 1 : 0.3,
                        transition: "all 0.2s",
                      }}
                    >
                      {log.liked ? "👍" : "👍"}
                    </button>
                  </div>
                </div>
              ))
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
                <input
                  value={settings.notifyEmail}
                  onChange={e => { setSettings(s => ({ ...s, notifyEmail: e.target.value })); setSettingsDirty(true); }}
                  placeholder="example@gmail.com"
                  style={inputStyle}
                />
                <p style={{ fontSize: 10, color: T.textMuted, marginTop: 2 }}>生成完了/失敗時にメール通知を送信</p>
              </div>

              <div className="mb-3">
                <label style={labelStyle}>Googleドライブ保存先フォルダ名</label>
                <input
                  value={settings.gdriveFolder}
                  onChange={e => { setSettings(s => ({ ...s, gdriveFolder: e.target.value })); setSettingsDirty(true); }}
                  style={inputStyle}
                />
                <p style={{ fontSize: 10, color: T.textMuted, marginTop: 2 }}>デスクトップ保存後、このフォルダにも自動コピー</p>
              </div>

              <div className="flex gap-4">
                <div className="flex-1">
                  <label style={labelStyle}>最大リトライ回数</label>
                  <input
                    type="number" min={1} max={5}
                    value={settings.maxRetries}
                    onChange={e => { setSettings(s => ({ ...s, maxRetries: parseInt(e.target.value) || 3 })); setSettingsDirty(true); }}
                    style={inputStyle}
                  />
                </div>
                <div className="flex-1">
                  <label style={labelStyle}>ウォーターマーク除去 (px)</label>
                  <input
                    type="number" min={0} max={300}
                    value={settings.watermarkCropPx}
                    onChange={e => { setSettings(s => ({ ...s, watermarkCropPx: parseInt(e.target.value) || 100 })); setSettingsDirty(true); }}
                    style={inputStyle}
                  />
                </div>
              </div>
            </div>

            {/* Gemini設定 */}
            <div style={{ ...cardStyle, padding: 16 }}>
              <div style={sectionTitle}>🤖 Gemini設定</div>

              <div className="mb-3">
                <label style={labelStyle}>Gemini URL</label>
                <input
                  value={settings.geminiUrl}
                  onChange={e => { setSettings(s => ({ ...s, geminiUrl: e.target.value })); setSettingsDirty(true); }}
                  style={inputStyle}
                />
              </div>

              <div className="flex items-center gap-3 mb-3">
                <label style={{ ...labelStyle, marginBottom: 0, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={settings.autoSaveGdrive}
                    onChange={e => { setSettings(s => ({ ...s, autoSaveGdrive: e.target.checked })); setSettingsDirty(true); }}
                    style={{ accentColor: T.accent }}
                  />
                  <span style={{ fontSize: 12, color: T.text }}>Googleドライブに自動保存</span>
                </label>
              </div>

              <div className="flex items-center gap-3">
                <label style={{ ...labelStyle, marginBottom: 0, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={settings.playwrightHeadless}
                    onChange={e => { setSettings(s => ({ ...s, playwrightHeadless: e.target.checked })); setSettingsDirty(true); }}
                    style={{ accentColor: T.accent }}
                  />
                  <span style={{ fontSize: 12, color: T.text }}>ヘッドレスモード（ブラウザ非表示）</span>
                </label>
              </div>
            </div>

            {/* 印象カテゴリ管理 */}
            <div style={{ ...cardStyle, padding: 16 }}>
              <div style={sectionTitle}>
                🎭 印象カテゴリ管理
                <button onClick={addMotionCategory} style={{ ...btnSub, marginLeft: "auto", fontSize: 11, padding: "4px 12px" }}>
                  ＋ 追加
                </button>
              </div>

              <div className="flex flex-col gap-2">
                {settings.motionCategories.map((motion, idx) => (
                  <div key={motion.id} className="flex gap-2 items-start" style={{ padding: 8, backgroundColor: T.cardAlt, borderRadius: 8 }}>
                    <input
                      value={motion.emoji}
                      onChange={e => updateMotionCategory(idx, "emoji", e.target.value)}
                      style={{ ...inputStyle, width: 44, textAlign: "center", padding: "6px 4px" }}
                      maxLength={4}
                    />
                    <div className="flex-1">
                      <input
                        value={motion.label}
                        onChange={e => updateMotionCategory(idx, "label", e.target.value)}
                        placeholder="カテゴリ名"
                        style={{ ...inputStyle, marginBottom: 4, padding: "6px 10px" }}
                      />
                      <input
                        value={motion.description}
                        onChange={e => updateMotionCategory(idx, "description", e.target.value)}
                        placeholder="説明（動きの例）"
                        style={{ ...inputStyle, fontSize: 11, padding: "5px 10px" }}
                      />
                    </div>
                    <button
                      onClick={() => removeMotionCategory(idx)}
                      style={{ ...btnSub, padding: "6px 10px", fontSize: 12, color: "#c45555" }}
                    >✕</button>
                  </div>
                ))}
              </div>
            </div>

            {/* プロンプトテンプレート */}
            <div style={{ ...cardStyle, padding: 16 }}>
              <div style={sectionTitle}>📝 画像生成プロンプト</div>
              <textarea
                value={settings.imagePrompt}
                onChange={e => { setSettings(s => ({ ...s, imagePrompt: e.target.value })); setSettingsDirty(true); }}
                style={{ ...inputStyle, minHeight: 200, fontFamily: "monospace", fontSize: 11, lineHeight: 1.6, resize: "vertical" }}
              />
              <p style={{ fontSize: 10, color: T.textMuted, marginTop: 4 }}>
                変数: {"{age}"} {"{height}"} {"{cup}"} {"{motionCategory}"} {"{likedPromptExamples}"}
              </p>
              <button
                onClick={() => { setSettings(s => ({ ...s, imagePrompt: DEFAULT_IMAGE_PROMPT })); setSettingsDirty(true); }}
                style={{ ...btnSub, marginTop: 4, fontSize: 10 }}
              >🔄 デフォルトに戻す</button>
            </div>

            <div style={{ ...cardStyle, padding: 16 }}>
              <div style={sectionTitle}>🎥 動画生成プロンプト</div>
              <textarea
                value={settings.videoPrompt}
                onChange={e => { setSettings(s => ({ ...s, videoPrompt: e.target.value })); setSettingsDirty(true); }}
                style={{ ...inputStyle, minHeight: 120, fontFamily: "monospace", fontSize: 11, lineHeight: 1.6, resize: "vertical" }}
              />
              <button
                onClick={() => { setSettings(s => ({ ...s, videoPrompt: DEFAULT_VIDEO_PROMPT })); setSettingsDirty(true); }}
                style={{ ...btnSub, marginTop: 4, fontSize: 10 }}
              >🔄 デフォルトに戻す</button>
            </div>

            {/* 保存ボタン */}
            <div style={{ textAlign: "center", paddingBottom: 40 }}>
              <button
                onClick={saveSettings}
                style={{ ...btnPrimary, padding: "14px 60px", opacity: settingsDirty ? 1 : 0.5 }}
                disabled={!settingsDirty}
              >
                💾 設定を保存
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
