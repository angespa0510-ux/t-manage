"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { useStaffSession } from "../../lib/staff-session";
import { useTheme } from "../../lib/theme";
import { NavMenu } from "../../lib/nav-menu";
import { useToast } from "../../lib/toast";

type Therapist = {
  id: number;
  name: string;
  main_photo_url: string | null;
  is_public: boolean;
};

type Photo = {
  id: number;
  therapist_id: number;
  photo_url: string;
  thumbnail_url: string | null;
  visibility: "public" | "member_only";
  caption: string;
  display_order: number;
  is_main: boolean;
  is_active: boolean;
  view_count_public: number;
  view_count_member: number;
  member_cta_shown_count: number;
  created_at: string;
};

export default function HpPhotosAdminPage() {
  const router = useRouter();
  const { dark, T } = useTheme();
  const toast = useToast();
  const { activeStaff, isManager } = useStaffSession();

  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [selectedTh, setSelectedTh] = useState<Therapist | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [stats, setStats] = useState({
    totalPhotos: 0,
    publicCount: 0,
    memberCount: 0,
    totalCtaShown: 0,
  });

  useEffect(() => {
    if (activeStaff === undefined) return;
    if (!activeStaff) {
      router.push("/");
      return;
    }
    if (!isManager) {
      toast.show("アクセス権がありません", "error");
      router.push("/dashboard");
    }
  }, [activeStaff, isManager, router, toast]);

  const loadTherapists = useCallback(async () => {
    const { data } = await supabase
      .from("therapists")
      .select("id, name, main_photo_url, is_public")
      .is("deleted_at", null)
      .order("is_public", { ascending: false })
      .order("name");
    setTherapists(data || []);
  }, []);

  const loadPhotos = useCallback(async (thId: number) => {
    const { data } = await supabase
      .from("hp_photos")
      .select("*")
      .eq("therapist_id", thId)
      .order("display_order")
      .order("created_at");
    setPhotos(data || []);
  }, []);

  const loadStats = useCallback(async () => {
    const { data: photos } = await supabase
      .from("hp_photos")
      .select("visibility, member_cta_shown_count")
      .eq("is_active", true);
    if (!photos) return;
    setStats({
      totalPhotos: photos.length,
      publicCount: photos.filter((p: any) => p.visibility === "public").length,
      memberCount: photos.filter((p: any) => p.visibility === "member_only").length,
      totalCtaShown: photos.reduce((sum: number, p: any) => sum + (p.member_cta_shown_count || 0), 0),
    });
  }, []);

  useEffect(() => {
    if (!activeStaff || !isManager) return;
    loadTherapists();
    loadStats();
  }, [activeStaff, isManager, loadTherapists, loadStats]);

  useEffect(() => {
    if (selectedTh) loadPhotos(selectedTh.id);
  }, [selectedTh, loadPhotos]);

  const uploadFile = async (file: File) => {
    if (!selectedTh) return null;
    const ext = file.name.split(".").pop() || "jpg";
    const fileName = `therapist-${selectedTh.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { data, error } = await supabase.storage.from("hp-photos").upload(fileName, file, {
      cacheControl: "3600",
      upsert: false,
    });
    if (error) {
      toast.show("アップロード失敗: " + error.message, "error");
      return null;
    }
    const { data: pub } = supabase.storage.from("hp-photos").getPublicUrl(data.path);
    return pub.publicUrl;
  };

  const handleUpload = async (files: FileList) => {
    if (!selectedTh) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) continue;
        const url = await uploadFile(file);
        if (!url) continue;
        await supabase.from("hp_photos").insert({
          therapist_id: selectedTh.id,
          photo_url: url,
          visibility: "public",
          caption: "",
          display_order: photos.length,
          is_main: photos.length === 0,
          is_active: true,
        });
      }
      toast.show("アップロード完了", "success");
      loadPhotos(selectedTh.id);
      loadStats();
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const toggleVisibility = async (photo: Photo) => {
    const next = photo.visibility === "public" ? "member_only" : "public";
    await supabase.from("hp_photos").update({ visibility: next, updated_at: new Date().toISOString() }).eq("id", photo.id);
    if (selectedTh) loadPhotos(selectedTh.id);
    loadStats();
  };

  const setAsMain = async (photo: Photo) => {
    if (!selectedTh) return;
    await supabase.from("hp_photos").update({ is_main: false }).eq("therapist_id", selectedTh.id);
    await supabase.from("hp_photos").update({ is_main: true }).eq("id", photo.id);
    // therapists.main_photo_url にも反映
    await supabase.from("therapists").update({ main_photo_url: photo.photo_url }).eq("id", selectedTh.id);
    toast.show("メイン写真を変更しました", "success");
    loadPhotos(selectedTh.id);
    loadTherapists();
  };

  const deletePhoto = async (photo: Photo) => {
    if (!confirm("この写真を削除しますか? (ストレージからも削除されます)")) return;
    // Storage からも削除を試みる
    const match = photo.photo_url.match(/hp-photos\/(.+)$/);
    if (match) {
      await supabase.storage.from("hp-photos").remove([match[1]]);
    }
    await supabase.from("hp_photos").delete().eq("id", photo.id);
    if (selectedTh) loadPhotos(selectedTh.id);
    loadStats();
  };

  const updateCaption = async (photoId: number, caption: string) => {
    await supabase.from("hp_photos").update({ caption }).eq("id", photoId);
    if (selectedTh) loadPhotos(selectedTh.id);
  };

  const moveOrder = async (photo: Photo, dir: -1 | 1) => {
    const sorted = [...photos].sort((a, b) => a.display_order - b.display_order);
    const idx = sorted.findIndex((p) => p.id === photo.id);
    const target = sorted[idx + dir];
    if (!target) return;
    await supabase.from("hp_photos").update({ display_order: target.display_order }).eq("id", photo.id);
    await supabase.from("hp_photos").update({ display_order: photo.display_order }).eq("id", target.id);
    if (selectedTh) loadPhotos(selectedTh.id);
  };

  if (!activeStaff || !isManager) return <div style={{ padding: 40 }}>読み込み中...</div>;

  return (
    <div style={{ display: "flex", minHeight: "100vh", backgroundColor: T.bg, color: T.text }}>
      <NavMenu T={T as Record<string, string>} dark={dark} />
      <main style={{ flex: 1, marginLeft: 80, padding: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 500, margin: 0, marginBottom: 8 }}>📸 HP写真管理</h1>
        <p style={{ fontSize: 12, color: T.textSub, margin: 0, marginBottom: 20 }}>
          公式HPに掲載するセラピストの写真を管理。「公開」は全員閲覧可能、「会員限定」は会員登録済みのお客様のみ閲覧可能。
        </p>

        {/* 統計 */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 24 }}>
          <StatCard label="総写真数" value={stats.totalPhotos.toLocaleString()} T={T} color="#c3a782" />
          <StatCard label="🌐 公開" value={stats.publicCount.toLocaleString()} T={T} color="#22c55e" />
          <StatCard label="🔒 会員限定" value={stats.memberCount.toLocaleString()} T={T} color="#d4687e" />
          <StatCard label="CTA表示回数" value={stats.totalCtaShown.toLocaleString()} T={T} color="#4a7ca0" />
        </div>

        <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
          {/* 左: セラピスト一覧 */}
          <div
            style={{
              width: 280,
              maxHeight: "75vh",
              overflowY: "auto",
              backgroundColor: T.card,
              borderRadius: 12,
              border: `1px solid ${T.border}`,
            }}
          >
            <div style={{ padding: 12, borderBottom: `1px solid ${T.border}`, fontSize: 12, fontWeight: 600 }}>
              セラピスト ({therapists.length}名)
            </div>
            {therapists.map((t) => (
              <div
                key={t.id}
                onClick={() => setSelectedTh(t)}
                style={{
                  padding: 10,
                  borderBottom: `1px solid ${T.border}`,
                  cursor: "pointer",
                  backgroundColor: selectedTh?.id === t.id ? T.cardAlt : "transparent",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                {t.main_photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={t.main_photo_url}
                    alt={t.name}
                    style={{ width: 36, height: 36, borderRadius: 18, objectFit: "cover" }}
                  />
                ) : (
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      backgroundColor: T.cardAlt,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 16,
                    }}
                  >
                    💆
                  </div>
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 500 }}>{t.name}</div>
                  <div style={{ fontSize: 9, color: T.textSub }}>
                    {t.is_public ? "🌐 HP公開中" : "⛔ HP非公開"}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* 右: 写真エリア */}
          <div style={{ flex: 1 }}>
            {!selectedTh ? (
              <div
                style={{
                  backgroundColor: T.card,
                  borderRadius: 12,
                  padding: 40,
                  textAlign: "center",
                  color: T.textSub,
                  fontSize: 13,
                  border: `1px solid ${T.border}`,
                }}
              >
                左からセラピストを選択してください
              </div>
            ) : (
              <div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 16,
                  }}
                >
                  <h2 style={{ margin: 0, fontSize: 16 }}>
                    {selectedTh.name} の写真 ({photos.length}枚)
                  </h2>
                  <div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(e) => e.target.files && handleUpload(e.target.files)}
                      style={{ display: "none" }}
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      style={{
                        padding: "8px 18px",
                        backgroundColor: "#c3a782",
                        color: "#fff",
                        border: "none",
                        borderRadius: 8,
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: uploading ? "not-allowed" : "pointer",
                        opacity: uploading ? 0.6 : 1,
                      }}
                    >
                      {uploading ? "アップロード中..." : "+ 写真を追加"}
                    </button>
                  </div>
                </div>

                {photos.length === 0 ? (
                  <div
                    style={{
                      backgroundColor: T.card,
                      borderRadius: 12,
                      padding: 40,
                      textAlign: "center",
                      color: T.textSub,
                      fontSize: 12,
                      border: `1px dashed ${T.border}`,
                    }}
                  >
                    写真がまだ登録されていません
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
                    {photos
                      .sort((a, b) => a.display_order - b.display_order)
                      .map((photo, idx) => (
                        <div
                          key={photo.id}
                          style={{
                            backgroundColor: T.card,
                            borderRadius: 12,
                            overflow: "hidden",
                            border: `2px solid ${photo.is_main ? "#c3a782" : T.border}`,
                            position: "relative",
                          }}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={photo.photo_url}
                            alt=""
                            style={{ width: "100%", aspectRatio: "3/4", objectFit: "cover", display: "block" }}
                          />

                          {/* バッジ */}
                          <div style={{ position: "absolute", top: 8, left: 8, display: "flex", gap: 4, flexDirection: "column" }}>
                            {photo.is_main && (
                              <span
                                style={{
                                  padding: "2px 8px",
                                  fontSize: 10,
                                  backgroundColor: "#c3a782",
                                  color: "#fff",
                                  borderRadius: 4,
                                }}
                              >
                                ⭐ メイン
                              </span>
                            )}
                            <span
                              style={{
                                padding: "2px 8px",
                                fontSize: 10,
                                backgroundColor:
                                  photo.visibility === "public" ? "rgba(34,197,94,0.9)" : "rgba(212,104,126,0.9)",
                                color: "#fff",
                                borderRadius: 4,
                              }}
                            >
                              {photo.visibility === "public" ? "🌐 公開" : "🔒 会員限定"}
                            </span>
                          </div>

                          <div style={{ padding: 10 }}>
                            <input
                              value={photo.caption || ""}
                              onChange={(e) => {
                                setPhotos((prev) =>
                                  prev.map((p) => (p.id === photo.id ? { ...p, caption: e.target.value } : p))
                                );
                              }}
                              onBlur={(e) => updateCaption(photo.id, e.target.value)}
                              placeholder="キャプション"
                              style={{
                                width: "100%",
                                padding: "4px 8px",
                                fontSize: 11,
                                borderRadius: 4,
                                border: `1px solid ${T.border}`,
                                backgroundColor: T.bg,
                                color: T.text,
                                marginBottom: 6,
                              }}
                            />
                            <div style={{ fontSize: 9, color: T.textSub, marginBottom: 6 }}>
                              👁 {photo.view_count_public}公 / {photo.view_count_member}会
                              {photo.member_cta_shown_count > 0 && ` · CTA ${photo.member_cta_shown_count}`}
                            </div>
                            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                              <button
                                onClick={() => toggleVisibility(photo)}
                                style={{
                                  padding: "3px 8px",
                                  fontSize: 10,
                                  borderRadius: 4,
                                  border: `1px solid ${T.border}`,
                                  backgroundColor: T.card,
                                  color: T.text,
                                  cursor: "pointer",
                                }}
                              >
                                {photo.visibility === "public" ? "→会員限定" : "→公開"}
                              </button>
                              {!photo.is_main && (
                                <button
                                  onClick={() => setAsMain(photo)}
                                  style={{
                                    padding: "3px 8px",
                                    fontSize: 10,
                                    borderRadius: 4,
                                    border: `1px solid ${T.border}`,
                                    backgroundColor: T.card,
                                    color: T.text,
                                    cursor: "pointer",
                                  }}
                                >
                                  メインに
                                </button>
                              )}
                              {idx > 0 && (
                                <button
                                  onClick={() => moveOrder(photo, -1)}
                                  style={{
                                    padding: "3px 8px",
                                    fontSize: 10,
                                    borderRadius: 4,
                                    border: `1px solid ${T.border}`,
                                    backgroundColor: T.card,
                                    color: T.text,
                                    cursor: "pointer",
                                  }}
                                >
                                  ↑
                                </button>
                              )}
                              {idx < photos.length - 1 && (
                                <button
                                  onClick={() => moveOrder(photo, 1)}
                                  style={{
                                    padding: "3px 8px",
                                    fontSize: 10,
                                    borderRadius: 4,
                                    border: `1px solid ${T.border}`,
                                    backgroundColor: T.card,
                                    color: T.text,
                                    cursor: "pointer",
                                  }}
                                >
                                  ↓
                                </button>
                              )}
                              <button
                                onClick={() => deletePhoto(photo)}
                                style={{
                                  padding: "3px 8px",
                                  fontSize: 10,
                                  borderRadius: 4,
                                  border: `1px solid #c45555`,
                                  backgroundColor: T.card,
                                  color: "#c45555",
                                  cursor: "pointer",
                                }}
                              >
                                削除
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                )}

                {/* ご注意 */}
                <div
                  style={{
                    marginTop: 20,
                    padding: 12,
                    backgroundColor: T.cardAlt,
                    borderRadius: 8,
                    fontSize: 11,
                    color: T.textSub,
                    lineHeight: 1.6,
                  }}
                >
                  ⚠️ <strong>Supabase Storage の設定が必要です：</strong><br />
                  ダッシュボードで Storage &gt; "hp-photos" バケットを作成してください (public、50MB上限推奨)。<br />
                  「🔒 会員限定」に設定した写真は HP 上で非会員には表示されず、会員登録CTAに差し替えられます。
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function StatCard({ label, value, T, color }: { label: string; value: string; T: Record<string, string>; color: string }) {
  return (
    <div
      style={{
        padding: 14,
        backgroundColor: T.card,
        borderRadius: 10,
        border: `1px solid ${T.border}`,
      }}
    >
      <div style={{ fontSize: 10, color: T.textSub, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 600, color, fontVariantNumeric: "tabular-nums" }}>{value}</div>
    </div>
  );
}
