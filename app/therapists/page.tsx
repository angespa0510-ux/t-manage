"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";
import { useTheme } from "../../lib/theme";
import { NavMenu } from "../../lib/nav-menu";

type Therapist = {
  id: number; created_at: string; name: string; phone: string; status: string;
  salary_type: string; salary_amount: number; age: number; interval_minutes: number; transport_fee: number;
  height_cm: number; bust: number; waist: number; hip: number; cup: string;
  photo_url: string; photo_width: number; photo_height: number;
};

export default function TherapistManagement() {
  const router = useRouter();
  const { dark, toggle, T } = useTheme();
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  // Add
  const [showAdd, setShowAdd] = useState(false);
  const [addName, setAddName] = useState(""); const [addPhone, setAddPhone] = useState(""); const [addStatus, setAddStatus] = useState("active");
  const [addSalaryType, setAddSalaryType] = useState("fixed"); const [addSalaryAmount, setAddSalaryAmount] = useState("");
  const [addAge, setAddAge] = useState(""); const [addInterval, setAddInterval] = useState("10"); const [addTransport, setAddTransport] = useState("0");
  const [addHeight, setAddHeight] = useState(""); const [addBust, setAddBust] = useState(""); const [addWaist, setAddWaist] = useState(""); const [addHip, setAddHip] = useState(""); const [addCup, setAddCup] = useState("");
  const [addPhotoW, setAddPhotoW] = useState("400"); const [addPhotoH, setAddPhotoH] = useState("600");
  const [addPhotoFile, setAddPhotoFile] = useState<File | null>(null); const [addPhotoPreview, setAddPhotoPreview] = useState("");
  const [saving, setSaving] = useState(false); const [msg, setMsg] = useState("");
  const addFileRef = useRef<HTMLInputElement>(null);

  // Edit
  const [editTarget, setEditTarget] = useState<Therapist | null>(null);
  const [editName, setEditName] = useState(""); const [editPhone, setEditPhone] = useState(""); const [editStatus, setEditStatus] = useState("");
  const [editSalaryType, setEditSalaryType] = useState("fixed"); const [editSalaryAmount, setEditSalaryAmount] = useState("");
  const [editAge, setEditAge] = useState(""); const [editInterval, setEditInterval] = useState("10"); const [editTransport, setEditTransport] = useState("0");
  const [editHeight, setEditHeight] = useState(""); const [editBust, setEditBust] = useState(""); const [editWaist, setEditWaist] = useState(""); const [editHip, setEditHip] = useState(""); const [editCup, setEditCup] = useState("");
  const [editPhotoW, setEditPhotoW] = useState("400"); const [editPhotoH, setEditPhotoH] = useState("600");
  const [editPhotoFile, setEditPhotoFile] = useState<File | null>(null); const [editPhotoPreview, setEditPhotoPreview] = useState("");
  const [editSaving, setEditSaving] = useState(false); const [editMsg, setEditMsg] = useState("");
  const editFileRef = useRef<HTMLInputElement>(null);

  // Detail
  const [detailTarget, setDetailTarget] = useState<Therapist | null>(null);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<Therapist | null>(null); const [deleting, setDeleting] = useState(false);

  const fetchTherapists = useCallback(async () => {
    const { data } = await supabase.from("therapists").select("*").order("created_at", { ascending: false });
    if (data) setTherapists(data);
  }, []);

  useEffect(() => { const check = async () => { const { data: { user } } = await supabase.auth.getUser(); if (!user) router.push("/"); }; check(); fetchTherapists(); }, [router, fetchTherapists]);

  const uploadPhoto = async (file: File, therapistId: number): Promise<string> => {
    const ext = file.name.split(".").pop(); const fileName = `${therapistId}_${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("therapist-photos").upload(fileName, file, { upsert: true });
    if (error) { console.error("Upload error:", error); return ""; }
    const { data } = supabase.storage.from("therapist-photos").getPublicUrl(fileName);
    return data.publicUrl;
  };

  const handleAdd = async () => {
    if (!addName.trim()) { setMsg("名前を入力してください"); return; }
    setSaving(true); setMsg("");
    const { data, error } = await supabase.from("therapists").insert({
      name: addName.trim(), phone: addPhone.trim(), status: addStatus,
      salary_type: addSalaryType, salary_amount: parseInt(addSalaryAmount) || 0,
      age: parseInt(addAge) || 0, interval_minutes: parseInt(addInterval) || 10, transport_fee: parseInt(addTransport) || 0,
      height_cm: parseInt(addHeight) || 0, bust: parseInt(addBust) || 0, waist: parseInt(addWaist) || 0, hip: parseInt(addHip) || 0, cup: addCup,
      photo_width: parseInt(addPhotoW) || 400, photo_height: parseInt(addPhotoH) || 600,
    }).select().single();
    if (error) { setSaving(false); setMsg("登録失敗: " + error.message); return; }
    if (addPhotoFile && data) {
      const url = await uploadPhoto(addPhotoFile, data.id);
      if (url) await supabase.from("therapists").update({ photo_url: url }).eq("id", data.id);
    }
    setSaving(false); setMsg("登録しました！");
    setAddName(""); setAddPhone(""); setAddStatus("active"); setAddSalaryType("fixed"); setAddSalaryAmount(""); setAddAge(""); setAddInterval("10"); setAddTransport("0");
    setAddHeight(""); setAddBust(""); setAddWaist(""); setAddHip(""); setAddCup(""); setAddPhotoFile(null); setAddPhotoPreview(""); setAddPhotoW("400"); setAddPhotoH("600");
    fetchTherapists(); setTimeout(() => { setShowAdd(false); setMsg(""); }, 800);
  };

  const startEdit = (t: Therapist) => {
    setEditTarget(t); setEditName(t.name || ""); setEditPhone(t.phone || ""); setEditStatus(t.status || "active");
    setEditSalaryType(t.salary_type || "fixed"); setEditSalaryAmount(String(t.salary_amount || 0)); setEditTransport(String(t.transport_fee || 0));
    setEditAge(String(t.age || "")); setEditInterval(String(t.interval_minutes || 10));
    setEditHeight(String(t.height_cm || "")); setEditBust(String(t.bust || "")); setEditWaist(String(t.waist || "")); setEditHip(String(t.hip || "")); setEditCup(t.cup || "");
    setEditPhotoW(String(t.photo_width || 400)); setEditPhotoH(String(t.photo_height || 600));
    setEditPhotoFile(null); setEditPhotoPreview(t.photo_url || ""); setEditMsg("");
  };

  const handleUpdate = async () => {
    if (!editTarget || !editName.trim()) { setEditMsg("名前を入力してください"); return; }
    setEditSaving(true); setEditMsg("");
    let photoUrl = editTarget.photo_url || "";
    if (editPhotoFile) { const url = await uploadPhoto(editPhotoFile, editTarget.id); if (url) photoUrl = url; }
    const { error } = await supabase.from("therapists").update({
      name: editName.trim(), phone: editPhone.trim(), status: editStatus,
      salary_type: editSalaryType, salary_amount: parseInt(editSalaryAmount) || 0,
      age: parseInt(editAge) || 0, interval_minutes: parseInt(editInterval) || 10, transport_fee: parseInt(editTransport) || 0,
      height_cm: parseInt(editHeight) || 0, bust: parseInt(editBust) || 0, waist: parseInt(editWaist) || 0, hip: parseInt(editHip) || 0, cup: editCup,
      photo_url: photoUrl, photo_width: parseInt(editPhotoW) || 400, photo_height: parseInt(editPhotoH) || 600,
    }).eq("id", editTarget.id);
    setEditSaving(false);
    if (error) { setEditMsg("更新失敗: " + error.message); }
    else { setEditMsg("更新しました！"); fetchTherapists(); setTimeout(() => { setEditTarget(null); setEditMsg(""); }, 800); }
  };

  const handleDelete = async () => { if (!deleteTarget) return; setDeleting(true); await supabase.from("therapists").delete().eq("id", deleteTarget.id); setDeleting(false); setDeleteTarget(null); fetchTherapists(); };

  const handleFileChange = (file: File | null, isEdit: boolean) => {
    if (!file) return;
    if (isEdit) { setEditPhotoFile(file); setEditPhotoPreview(URL.createObjectURL(file)); }
    else { setAddPhotoFile(file); setAddPhotoPreview(URL.createObjectURL(file)); }
  };

  const filtered = therapists.filter((t) => {
    const q = searchQuery.toLowerCase();
    const matchSearch = t.name?.toLowerCase().includes(q) || t.phone?.includes(q);
    const matchStatus = filterStatus === "all" || t.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const statusMap: Record<string, { bg: string; text: string; label: string }> = {
    active: { bg: "#4a7c5918", text: "#4a7c59", label: "稼働中" },
    inactive: { bg: "#88878018", text: "#888780", label: "休止中" },
    retired: { bg: "#c4555518", text: "#c45555", label: "退職" },
  };
  const colors = ["#c3a782", "#7ab88f", "#85a8c4", "#c49885", "#a885c4", "#85c4b8", "#c4a685", "#8599c4"];
  const inputStyle = { backgroundColor: T.cardAlt, color: T.text, border: "1px solid transparent" };
  const CUPS = ["", "A", "B", "C", "D", "E", "F", "G", "H", "I"];
  const INTERVALS = ["5", "10", "15", "20", "25", "30"];

  const getSalaryLabel = (t: Therapist) => {
    if (!t.salary_amount) return "";
    return t.salary_type === "percent" ? `${t.salary_amount}%UP` : `${t.salary_amount.toLocaleString()}円UP`;
  };

  const PhotoField = ({ preview, fileRef, onFileChange, width, height, onWidthChange, onHeightChange }: { preview: string; fileRef: React.RefObject<HTMLInputElement | null>; onFileChange: (f: File | null) => void; width: string; height: string; onWidthChange: (v: string) => void; onHeightChange: (v: string) => void }) => (
    <div>
      <label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>写真</label>
      <div className="flex gap-3 items-start">
        <div onClick={() => fileRef.current?.click()} className="rounded-xl border-2 border-dashed flex items-center justify-center cursor-pointer overflow-hidden" style={{ width: 80, height: 100, borderColor: preview ? "transparent" : T.border, backgroundColor: T.cardAlt }}>
          {preview ? <img src={preview} alt="" style={{ width: 80, height: 100, objectFit: "cover" }} /> : <span className="text-[20px]" style={{ color: T.textFaint }}>+</span>}
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFileChange(e.target.files?.[0] || null)} />
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <label className="text-[9px]" style={{ color: T.textMuted }}>幅</label>
            <input type="text" inputMode="numeric" value={width} onChange={(e) => onWidthChange(e.target.value.replace(/[^0-9]/g, ""))} className="w-16 px-2 py-1 rounded text-[11px] outline-none" style={inputStyle} />
            <span className="text-[9px]" style={{ color: T.textFaint }}>px</span>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[9px]" style={{ color: T.textMuted }}>高</label>
            <input type="text" inputMode="numeric" value={height} onChange={(e) => onHeightChange(e.target.value.replace(/[^0-9]/g, ""))} className="w-16 px-2 py-1 rounded text-[11px] outline-none" style={inputStyle} />
            <span className="text-[9px]" style={{ color: T.textFaint }}>px</span>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="h-screen flex flex-col" style={{ backgroundColor: T.bg, color: T.text }}>
      {/* Header */}
      <div className="h-[64px] backdrop-blur-xl border-b flex items-center justify-between px-6 flex-shrink-0" style={{ backgroundColor: dark ? T.card + "cc" : "rgba(255,255,255,0.8)", borderColor: T.border }}>
        <div className="flex items-center gap-4">
          <NavMenu T={T} dark={dark} />
          <div><h1 className="text-[15px] font-medium">セラピスト管理</h1><p className="text-[11px]" style={{ color: T.textMuted }}>{therapists.length}名のセラピスト</p></div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={toggle} className="px-3 py-1.5 text-[10px] rounded-lg cursor-pointer border" style={{ borderColor: T.border, color: T.textSub }}>{dark ? "☀️ ライト" : "🌙 ダーク"}</button>
          <button onClick={() => { setShowAdd(true); setMsg(""); }} className="px-4 py-2 bg-gradient-to-r from-[#c3a782] to-[#b09672] text-white text-[11px] rounded-xl cursor-pointer">+ 新規登録</button>
        </div>
      </div>

      {/* Search + Filter */}
      <div className="border-b px-6 py-3 flex items-center gap-4 flex-wrap" style={{ backgroundColor: T.card, borderColor: T.border }}>
        <div className="relative max-w-sm flex-1">
          <input type="text" placeholder="名前・電話番号で検索" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} />
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.textFaint} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        </div>
        <div className="flex gap-1.5">
          <button onClick={() => setFilterStatus("all")} className="px-2.5 py-1.5 rounded-lg text-[10px] cursor-pointer border" style={{ borderColor: filterStatus === "all" ? T.accent : T.border, backgroundColor: filterStatus === "all" ? T.accent + "18" : "transparent", color: filterStatus === "all" ? T.accent : T.textMuted, fontWeight: filterStatus === "all" ? 600 : 400 }}>全て {therapists.length}</button>
          {Object.entries(statusMap).map(([key, val]) => (
            <button key={key} onClick={() => setFilterStatus(filterStatus === key ? "all" : key)} className="px-2.5 py-1.5 rounded-lg text-[10px] cursor-pointer border"
              style={{ borderColor: filterStatus === key ? val.text : T.border, backgroundColor: filterStatus === key ? val.bg : "transparent", color: filterStatus === key ? val.text : T.textMuted, fontWeight: filterStatus === key ? 600 : 400 }}>
              {val.label} {therapists.filter((t) => t.status === key).length}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-6">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full">
            <p className="text-[14px]" style={{ color: T.textMuted }}>{therapists.length === 0 ? "セラピストが登録されていません" : "検索結果がありません"}</p>
            {therapists.length === 0 && <button onClick={() => setShowAdd(true)} className="mt-4 px-5 py-2.5 bg-gradient-to-r from-[#c3a782] to-[#b09672] text-white text-[12px] rounded-xl cursor-pointer">+ セラピストを登録</button>}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 max-w-[1200px]">
            {filtered.map((t, i) => {
              const st = statusMap[t.status] || statusMap.active;
              return (
                <div key={t.id} className="rounded-2xl border p-4 transition-all duration-300 cursor-pointer" style={{ backgroundColor: T.card, borderColor: T.border }} onClick={() => setDetailTarget(t)}>
                  <div className="flex items-start gap-3 mb-3">
                    {t.photo_url ? (
                      <img src={t.photo_url} alt={t.name} className="w-12 h-12 rounded-full object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-12 h-12 rounded-full flex items-center justify-center text-[16px] text-white font-medium flex-shrink-0" style={{ backgroundColor: colors[i % colors.length] }}>{t.name?.charAt(0)}</div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2"><p className="text-[14px] font-medium truncate">{t.name}</p><span className="px-2 py-0.5 rounded-md text-[9px] font-medium flex-shrink-0" style={{ backgroundColor: st.bg, color: st.text }}>{st.label}</span></div>
                      <p className="text-[11px]" style={{ color: T.textMuted }}>{t.phone || "電話番号なし"}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] mb-3" style={{ color: T.textSub }}>
                    {t.age > 0 && <span>{t.age}歳</span>}
                    {getSalaryLabel(t) && <span style={{ color: "#c3a782" }}>{getSalaryLabel(t)}</span>}
                    {t.interval_minutes > 0 && <span>インターバル{t.interval_minutes}分</span>}
                    {t.height_cm > 0 && <span>{t.height_cm}cm</span>}
                    {(t.bust > 0 || t.waist > 0 || t.hip > 0) && <span>B{t.bust} W{t.waist} H{t.hip}</span>}
                    {t.cup && <span>{t.cup}カップ</span>}
                  </div>
                  <div className="flex items-center justify-between pt-3" style={{ borderTop: `1px solid ${T.cardAlt}` }}>
                    <p className="text-[10px]" style={{ color: T.textFaint }}>登録: {new Date(t.created_at).toLocaleDateString("ja-JP")}</p>
                    <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => startEdit(t)} className="px-3 py-1.5 text-[11px] rounded-lg cursor-pointer" style={{ color: "#3d6b9f", backgroundColor: "#3d6b9f18" }}>編集</button>
                      <button onClick={() => setDeleteTarget(t)} className="px-3 py-1.5 text-[11px] rounded-lg cursor-pointer" style={{ color: "#c45555", backgroundColor: "#c4555518" }}>削除</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Summary */}
      <div className="border-t p-4 flex-shrink-0" style={{ backgroundColor: T.card, borderColor: T.border }}>
        <div className="flex items-center gap-6 text-[11px]" style={{ color: T.textSub }}>
          <span>合計: <strong style={{ color: T.text }}>{therapists.length}</strong>名</span>
          <span>稼働中: <strong style={{ color: "#4a7c59" }}>{therapists.filter((t) => t.status === "active").length}</strong>名</span>
          <span>休止中: <strong style={{ color: T.textSub }}>{therapists.filter((t) => t.status === "inactive").length}</strong>名</span>
          <span>退職: <strong style={{ color: "#c45555" }}>{therapists.filter((t) => t.status === "retired").length}</strong>名</span>
        </div>
      </div>

      {/* Detail Modal */}
      {detailTarget && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setDetailTarget(null)}>
          <div className="rounded-2xl border w-full max-w-md max-h-[90vh] overflow-y-auto animate-[fadeIn_0.25s]" style={{ backgroundColor: T.card, borderColor: T.border }} onClick={(e) => e.stopPropagation()}>
            {detailTarget.photo_url && (
              <div className="flex justify-center pt-6">
                <img src={detailTarget.photo_url} alt={detailTarget.name} className="rounded-xl object-cover" style={{ width: detailTarget.photo_width || 400, height: detailTarget.photo_height || 600, maxWidth: "100%", maxHeight: 400 }} />
              </div>
            )}
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                {!detailTarget.photo_url && <div className="w-16 h-16 rounded-full flex items-center justify-center text-[22px] text-white font-medium" style={{ backgroundColor: colors[therapists.indexOf(detailTarget) % colors.length] }}>{detailTarget.name?.charAt(0)}</div>}
                <div>
                  <div className="flex items-center gap-2"><h2 className="text-[20px] font-medium">{detailTarget.name}</h2><span className="px-2 py-0.5 rounded-md text-[10px] font-medium" style={{ backgroundColor: (statusMap[detailTarget.status] || statusMap.active).bg, color: (statusMap[detailTarget.status] || statusMap.active).text }}>{(statusMap[detailTarget.status] || statusMap.active).label}</span></div>
                  <p className="text-[12px]" style={{ color: T.textSub }}>{detailTarget.phone || "電話番号なし"}</p>
                </div>
              </div>
              <div className="space-y-3">
                {getSalaryLabel(detailTarget) && <div className="flex justify-between text-[12px]"><span style={{ color: T.textMuted }}>給料ランク</span><span className="font-medium" style={{ color: "#c3a782" }}>{getSalaryLabel(detailTarget)}</span></div>}
                {detailTarget.age > 0 && <div className="flex justify-between text-[12px]"><span style={{ color: T.textMuted }}>年齢</span><span>{detailTarget.age}歳</span></div>}
                {detailTarget.interval_minutes > 0 && <div className="flex justify-between text-[12px]"><span style={{ color: T.textMuted }}>インターバル</span><span>{detailTarget.interval_minutes}分</span></div>}
                {detailTarget.transport_fee > 0 && <div className="flex justify-between text-[12px]"><span style={{ color: T.textMuted }}>交通費</span><span>¥{detailTarget.transport_fee.toLocaleString()}</span></div>}
                {detailTarget.height_cm > 0 && <div className="flex justify-between text-[12px]"><span style={{ color: T.textMuted }}>身長</span><span>{detailTarget.height_cm}cm</span></div>}
                {(detailTarget.bust > 0 || detailTarget.waist > 0 || detailTarget.hip > 0) && <div className="flex justify-between text-[12px]"><span style={{ color: T.textMuted }}>スリーサイズ</span><span>B{detailTarget.bust} W{detailTarget.waist} H{detailTarget.hip}</span></div>}
                {detailTarget.cup && <div className="flex justify-between text-[12px]"><span style={{ color: T.textMuted }}>カップ</span><span>{detailTarget.cup}カップ</span></div>}
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={() => { setDetailTarget(null); startEdit(detailTarget); }} className="px-5 py-2.5 bg-gradient-to-r from-[#c3a782] to-[#b09672] text-white text-[12px] rounded-xl cursor-pointer">編集する</button>
                <button onClick={() => setDetailTarget(null)} className="px-5 py-2.5 border text-[12px] rounded-xl cursor-pointer" style={{ borderColor: T.border, color: T.textSub }}>閉じる</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowAdd(false)}>
          <div className="rounded-2xl border p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto animate-[fadeIn_0.25s]" style={{ backgroundColor: T.card, borderColor: T.border }} onClick={(e) => e.stopPropagation()}>
            <h2 className="text-[16px] font-medium mb-1">セラピスト登録</h2>
            <p className="text-[11px] mb-5" style={{ color: T.textFaint }}>新しいセラピストを登録します</p>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>名前 <span style={{ color: "#c49885" }}>*</span></label><input type="text" value={addName} onChange={(e) => setAddName(e.target.value)} placeholder="セラピスト名" className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} /></div>
                <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>電話番号</label><input type="tel" value={addPhone} onChange={(e) => setAddPhone(e.target.value)} placeholder="090-xxxx-xxxx" className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} /></div>
              </div>
              <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>ステータス</label><div className="flex gap-2">{Object.entries(statusMap).map(([key, val]) => (<button key={key} onClick={() => setAddStatus(key)} className={`px-3 py-1.5 rounded-xl text-[11px] cursor-pointer ${addStatus === key ? "ring-2 ring-offset-1" : "opacity-50"}`} style={{ backgroundColor: val.bg, color: val.text }}>{val.label}</button>))}</div></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>給料タイプ</label><select value={addSalaryType} onChange={(e) => setAddSalaryType(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none cursor-pointer" style={inputStyle}><option value="fixed">〇〇円UP</option><option value="percent">〇〇%UP</option></select></div>
                <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>金額/率</label><input type="text" inputMode="numeric" value={addSalaryAmount} onChange={(e) => setAddSalaryAmount(e.target.value.replace(/[^0-9]/g, ""))} placeholder={addSalaryType === "fixed" ? "500" : "5"} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} /></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>年齢</label><input type="text" inputMode="numeric" value={addAge} onChange={(e) => setAddAge(e.target.value.replace(/[^0-9]/g, ""))} placeholder="25" className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} /></div>
                <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>インターバル</label><select value={addInterval} onChange={(e) => setAddInterval(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none cursor-pointer" style={inputStyle}>{INTERVALS.map((m) => <option key={m} value={m}>{m}分</option>)}</select></div>
                <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>交通費</label><select value={addTransport} onChange={(e) => setAddTransport(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none cursor-pointer" style={inputStyle}><option value="0">なし</option><option value="500">¥500</option><option value="1000">¥1,000</option><option value="1500">¥1,500</option><option value="2000">¥2,000</option><option value="2500">¥2,500</option><option value="3000">¥3,000</option></select></div>
                <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>身長</label><input type="text" inputMode="numeric" value={addHeight} onChange={(e) => setAddHeight(e.target.value.replace(/[^0-9]/g, ""))} placeholder="160" className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} /></div>
              </div>
              <div className="grid grid-cols-4 gap-3">
                <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>バスト</label><input type="text" inputMode="numeric" value={addBust} onChange={(e) => setAddBust(e.target.value.replace(/[^0-9]/g, ""))} placeholder="84" className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} /></div>
                <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>ウエスト</label><input type="text" inputMode="numeric" value={addWaist} onChange={(e) => setAddWaist(e.target.value.replace(/[^0-9]/g, ""))} placeholder="58" className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} /></div>
                <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>ヒップ</label><input type="text" inputMode="numeric" value={addHip} onChange={(e) => setAddHip(e.target.value.replace(/[^0-9]/g, ""))} placeholder="86" className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} /></div>
                <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>カップ</label><select value={addCup} onChange={(e) => setAddCup(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none cursor-pointer" style={inputStyle}>{CUPS.map((c) => <option key={c} value={c}>{c || "—"}</option>)}</select></div>
              </div>
              <PhotoField preview={addPhotoPreview} fileRef={addFileRef} onFileChange={(f) => handleFileChange(f, false)} width={addPhotoW} height={addPhotoH} onWidthChange={setAddPhotoW} onHeightChange={setAddPhotoH} />
              {msg && <div className="px-4 py-3 rounded-xl text-[12px]" style={{ backgroundColor: msg.includes("失敗") || msg.includes("入力") ? "#c4988518" : "#7ab88f18", color: msg.includes("失敗") || msg.includes("入力") ? "#c49885" : "#5a9e6f" }}>{msg}</div>}
              <div className="flex gap-3 pt-2">
                <button onClick={handleAdd} disabled={saving} className="px-7 py-3 bg-gradient-to-r from-[#c3a782] to-[#b09672] text-white text-[12px] rounded-xl cursor-pointer disabled:opacity-60">{saving ? "登録中..." : "登録する"}</button>
                <button onClick={() => { setShowAdd(false); setMsg(""); }} className="px-7 py-3 border text-[12px] rounded-xl cursor-pointer" style={{ borderColor: T.border, color: T.textSub }}>キャンセル</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editTarget && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setEditTarget(null)}>
          <div className="rounded-2xl border p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto animate-[fadeIn_0.25s]" style={{ backgroundColor: T.card, borderColor: T.border }} onClick={(e) => e.stopPropagation()}>
            <h2 className="text-[16px] font-medium mb-1">セラピスト編集</h2>
            <p className="text-[11px] mb-5" style={{ color: T.textFaint }}>情報を修正してください</p>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>名前 <span style={{ color: "#c49885" }}>*</span></label><input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} /></div>
                <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>電話番号</label><input type="tel" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} /></div>
              </div>
              <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>ステータス</label><div className="flex gap-2">{Object.entries(statusMap).map(([key, val]) => (<button key={key} onClick={() => setEditStatus(key)} className={`px-3 py-1.5 rounded-xl text-[11px] cursor-pointer ${editStatus === key ? "ring-2 ring-offset-1" : "opacity-50"}`} style={{ backgroundColor: val.bg, color: val.text }}>{val.label}</button>))}</div></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>給料タイプ</label><select value={editSalaryType} onChange={(e) => setEditSalaryType(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none cursor-pointer" style={inputStyle}><option value="fixed">〇〇円UP</option><option value="percent">〇〇%UP</option></select></div>
                <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>金額/率</label><input type="text" inputMode="numeric" value={editSalaryAmount} onChange={(e) => setEditSalaryAmount(e.target.value.replace(/[^0-9]/g, ""))} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} /></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>年齢</label><input type="text" inputMode="numeric" value={editAge} onChange={(e) => setEditAge(e.target.value.replace(/[^0-9]/g, ""))} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} /></div>
                <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>インターバル</label><select value={editInterval} onChange={(e) => setEditInterval(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none cursor-pointer" style={inputStyle}>{INTERVALS.map((m) => <option key={m} value={m}>{m}分</option>)}</select></div>
                <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>交通費</label><select value={editTransport} onChange={(e) => setEditTransport(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none cursor-pointer" style={inputStyle}><option value="0">なし</option><option value="500">¥500</option><option value="1000">¥1,000</option><option value="1500">¥1,500</option><option value="2000">¥2,000</option><option value="2500">¥2,500</option><option value="3000">¥3,000</option></select></div>
                <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>身長</label><input type="text" inputMode="numeric" value={editHeight} onChange={(e) => setEditHeight(e.target.value.replace(/[^0-9]/g, ""))} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} /></div>
              </div>
              <div className="grid grid-cols-4 gap-3">
                <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>バスト</label><input type="text" inputMode="numeric" value={editBust} onChange={(e) => setEditBust(e.target.value.replace(/[^0-9]/g, ""))} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} /></div>
                <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>ウエスト</label><input type="text" inputMode="numeric" value={editWaist} onChange={(e) => setEditWaist(e.target.value.replace(/[^0-9]/g, ""))} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} /></div>
                <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>ヒップ</label><input type="text" inputMode="numeric" value={editHip} onChange={(e) => setEditHip(e.target.value.replace(/[^0-9]/g, ""))} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none" style={inputStyle} /></div>
                <div><label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>カップ</label><select value={editCup} onChange={(e) => setEditCup(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none cursor-pointer" style={inputStyle}>{CUPS.map((c) => <option key={c} value={c}>{c || "—"}</option>)}</select></div>
              </div>
              <PhotoField preview={editPhotoPreview} fileRef={editFileRef} onFileChange={(f) => handleFileChange(f, true)} width={editPhotoW} height={editPhotoH} onWidthChange={setEditPhotoW} onHeightChange={setEditPhotoH} />
              {editMsg && <div className="px-4 py-3 rounded-xl text-[12px]" style={{ backgroundColor: editMsg.includes("失敗") || editMsg.includes("入力") ? "#c4988518" : "#7ab88f18", color: editMsg.includes("失敗") || editMsg.includes("入力") ? "#c49885" : "#5a9e6f" }}>{editMsg}</div>}
              <div className="flex gap-3 pt-2">
                <button onClick={handleUpdate} disabled={editSaving} className="px-7 py-3 bg-gradient-to-r from-[#c3a782] to-[#b09672] text-white text-[12px] rounded-xl cursor-pointer disabled:opacity-60">{editSaving ? "更新中..." : "更新する"}</button>
                <button onClick={() => setEditTarget(null)} className="px-7 py-3 border text-[12px] rounded-xl cursor-pointer" style={{ borderColor: T.border, color: T.textSub }}>キャンセル</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setDeleteTarget(null)}>
          <div className="rounded-2xl border p-8 w-full max-w-sm text-center animate-[fadeIn_0.25s]" style={{ backgroundColor: T.card, borderColor: T.border }} onClick={(e) => e.stopPropagation()}>
            <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-5" style={{ backgroundColor: "#c4555518" }}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#c45555" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></div>
            <h3 className="text-[15px] font-medium mb-2">セラピストを削除しますか？</h3>
            <p className="text-[12px] mb-6" style={{ color: T.textMuted }}>「{deleteTarget.name}」を削除すると元に戻せません</p>
            <div className="flex gap-3 justify-center">
              <button onClick={handleDelete} disabled={deleting} className="px-6 py-2.5 bg-[#c45555] text-white text-[12px] rounded-xl cursor-pointer disabled:opacity-60">{deleting ? "削除中..." : "削除する"}</button>
              <button onClick={() => setDeleteTarget(null)} className="px-6 py-2.5 border text-[12px] rounded-xl cursor-pointer" style={{ borderColor: T.border, color: T.textSub }}>キャンセル</button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  );
}
