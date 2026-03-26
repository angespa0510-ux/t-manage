"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";

type Therapist = {
  id: number;
  created_at: string;
  name: string;
  phone: string;
  status: string;
};

export default function TherapistManagement() {
  const router = useRouter();
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  // Add
  const [showAdd, setShowAdd] = useState(false);
  const [addName, setAddName] = useState("");
  const [addPhone, setAddPhone] = useState("");
  const [addStatus, setAddStatus] = useState("active");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  // Edit
  const [editTarget, setEditTarget] = useState<Therapist | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editMsg, setEditMsg] = useState("");

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<Therapist | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchTherapists = useCallback(async () => {
    const { data } = await supabase.from("therapists").select("*").order("created_at", { ascending: false });
    if (data) setTherapists(data);
  }, []);

  useEffect(() => {
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) router.push("/");
    };
    check();
    fetchTherapists();
  }, [router, fetchTherapists]);

  const handleAdd = async () => {
    if (!addName.trim()) { setMsg("名前を入力してください"); return; }
    setSaving(true); setMsg("");
    const { error } = await supabase.from("therapists").insert({
      name: addName.trim(), phone: addPhone.trim(), status: addStatus,
    });
    setSaving(false);
    if (error) { setMsg("登録失敗: " + error.message); }
    else {
      setMsg("登録しました！");
      setAddName(""); setAddPhone(""); setAddStatus("active");
      fetchTherapists();
      setTimeout(() => { setShowAdd(false); setMsg(""); }, 800);
    }
  };

  const startEdit = (t: Therapist) => {
    setEditTarget(t);
    setEditName(t.name || "");
    setEditPhone(t.phone || "");
    setEditStatus(t.status || "active");
    setEditMsg("");
  };

  const handleUpdate = async () => {
    if (!editTarget || !editName.trim()) { setEditMsg("名前を入力してください"); return; }
    setEditSaving(true); setEditMsg("");
    const { error } = await supabase.from("therapists").update({
      name: editName.trim(), phone: editPhone.trim(), status: editStatus,
    }).eq("id", editTarget.id);
    setEditSaving(false);
    if (error) { setEditMsg("更新失敗: " + error.message); }
    else {
      setEditMsg("更新しました！");
      fetchTherapists();
      setTimeout(() => { setEditTarget(null); setEditMsg(""); }, 800);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    await supabase.from("therapists").delete().eq("id", deleteTarget.id);
    setDeleting(false);
    setDeleteTarget(null);
    fetchTherapists();
  };

  const filtered = therapists.filter((t) => {
    const q = searchQuery.toLowerCase();
    return t.name?.toLowerCase().includes(q) || t.phone?.includes(q);
  });

  const statusMap: Record<string, { bg: string; text: string; label: string }> = {
    active: { bg: "#e8f0ea", text: "#4a7c59", label: "稼働中" },
    inactive: { bg: "#f0ece4", text: "#888780", label: "休止中" },
    retired: { bg: "#fce8e8", text: "#c45555", label: "退職" },
  };

  const colors = ["#c3a782", "#7ab88f", "#85a8c4", "#c49885", "#a885c4", "#85c4b8", "#c4a685", "#8599c4"];

  return (
    <div className="h-screen flex flex-col bg-[#f8f6f3]">
      {/* Header */}
      <div className="h-[64px] bg-white/80 backdrop-blur-xl border-b border-[#e8e4df] flex items-center justify-between px-6 flex-shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push("/dashboard")} className="p-2 rounded-lg hover:bg-[#f8f6f3] transition-colors cursor-pointer">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9c9a92" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <div>
            <h1 className="text-[15px] font-medium text-[#2c2c2a]">セラピスト管理</h1>
            <p className="text-[11px] text-[#b4b2a9]">{therapists.length}名のセラピスト</p>
          </div>
        </div>
        <button onClick={() => { setShowAdd(true); setMsg(""); }} className="px-4 py-2 bg-gradient-to-r from-[#c3a782] to-[#b09672] text-white text-[11px] rounded-xl hover:shadow-[0_4px_16px_rgba(195,167,130,0.25)] transition-all cursor-pointer">+ 新規登録</button>
      </div>

      {/* Search */}
      <div className="bg-white border-b border-[#e8e4df] px-6 py-3">
        <div className="relative max-w-sm">
          <input type="text" placeholder="名前・電話番号で検索" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-[#f8f6f3] border border-transparent rounded-xl text-[12px] outline-none focus:border-[#c3a782]/30 focus:bg-white transition-all placeholder-[#d3d1c7]" />
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d3d1c7" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-6">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#e0dbd2" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            <p className="text-[14px] text-[#b4b2a9] mt-4">{therapists.length === 0 ? "セラピストが登録されていません" : "検索結果がありません"}</p>
            {therapists.length === 0 && (
              <button onClick={() => setShowAdd(true)} className="mt-4 px-5 py-2.5 bg-gradient-to-r from-[#c3a782] to-[#b09672] text-white text-[12px] rounded-xl cursor-pointer">+ セラピストを登録</button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 max-w-[1200px]">
            {filtered.map((t, i) => {
              const st = statusMap[t.status] || statusMap.active;
              return (
                <div key={t.id} className="bg-white rounded-2xl border border-[#f0ece4] p-5 hover:border-[#e0dbd2] hover:shadow-[0_4px_20px_rgba(0,0,0,0.03)] transition-all duration-300">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-[14px] text-white font-medium" style={{ backgroundColor: colors[i % colors.length] }}>
                        {t.name?.charAt(0)}
                      </div>
                      <div>
                        <p className="text-[14px] font-medium text-[#2c2c2a]">{t.name}</p>
                        <p className="text-[11px] text-[#b4b2a9]">{t.phone || "電話番号なし"}</p>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-lg text-[10px] font-medium" style={{ backgroundColor: st.bg, color: st.text }}>{st.label}</span>
                  </div>
                  <div className="flex items-center justify-between pt-3 border-t border-[#f8f6f3]">
                    <p className="text-[10px] text-[#d3d1c7]">登録: {new Date(t.created_at).toLocaleDateString("ja-JP")}</p>
                    <div className="flex gap-2">
                      <button onClick={() => startEdit(t)} className="px-3 py-1.5 text-[11px] text-[#3d6b9f] bg-[#e4eef7] rounded-lg hover:bg-[#d4e4f4] transition-colors cursor-pointer">編集</button>
                      <button onClick={() => setDeleteTarget(t)} className="px-3 py-1.5 text-[11px] text-[#c45555] bg-[#fce8e8] rounded-lg hover:bg-[#f8d4d4] transition-colors cursor-pointer">削除</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Summary */}
      <div className="border-t border-[#e8e4df] bg-white p-4 flex-shrink-0">
        <div className="flex items-center gap-6 text-[11px] text-[#888780]">
          <span>合計: <strong className="text-[#2c2c2a]">{therapists.length}</strong>名</span>
          <span>稼働中: <strong className="text-[#4a7c59]">{therapists.filter((t) => t.status === "active").length}</strong>名</span>
          <span>休止中: <strong className="text-[#888780]">{therapists.filter((t) => t.status === "inactive").length}</strong>名</span>
          <span>退職: <strong className="text-[#c45555]">{therapists.filter((t) => t.status === "retired").length}</strong>名</span>
        </div>
      </div>

      {/* Add Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowAdd(false)}>
          <div className="bg-white rounded-2xl border border-[#f0ece4] p-8 w-full max-w-md animate-[fadeIn_0.25s_ease-out]" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-[16px] font-medium text-[#2c2c2a] mb-1">セラピスト登録</h2>
            <p className="text-[11px] text-[#d3d1c7] mb-6">新しいセラピストを登録します</p>
            <div className="space-y-4">
              <div>
                <label className="block text-[11px] text-[#888780] mb-1.5">名前 <span className="text-[#c49885]">*</span></label>
                <input type="text" value={addName} onChange={(e) => setAddName(e.target.value)} placeholder="セラピスト名"
                  className="w-full px-4 py-3 bg-[#f8f6f3] border border-transparent rounded-xl text-[13px] outline-none focus:border-[#c3a782]/30 focus:bg-white transition-all placeholder-[#d3d1c7]" />
              </div>
              <div>
                <label className="block text-[11px] text-[#888780] mb-1.5">電話番号</label>
                <input type="tel" value={addPhone} onChange={(e) => setAddPhone(e.target.value)} placeholder="090-xxxx-xxxx"
                  className="w-full px-4 py-3 bg-[#f8f6f3] border border-transparent rounded-xl text-[13px] outline-none focus:border-[#c3a782]/30 focus:bg-white transition-all placeholder-[#d3d1c7]" />
              </div>
              <div>
                <label className="block text-[11px] text-[#888780] mb-1.5">ステータス</label>
                <div className="flex gap-2">
                  {Object.entries(statusMap).map(([key, val]) => (
                    <button key={key} onClick={() => setAddStatus(key)}
                      className={`px-4 py-2 rounded-xl text-[12px] transition-all cursor-pointer ${addStatus === key ? "ring-2 ring-offset-1" : "opacity-60 hover:opacity-80"}`}
                      style={{ backgroundColor: val.bg, color: val.text }}>{val.label}</button>
                  ))}
                </div>
              </div>
              {msg && <div className={`px-4 py-3 rounded-xl text-[12px] ${msg.includes("失敗") || msg.includes("入力") ? "bg-[#c49885]/10 text-[#c49885]" : "bg-[#7ab88f]/10 text-[#5a9e6f]"}`}>{msg}</div>}
              <div className="flex gap-3 pt-2">
                <button onClick={handleAdd} disabled={saving} className="px-7 py-3 bg-gradient-to-r from-[#c3a782] to-[#b09672] text-white text-[12px] rounded-xl hover:shadow-[0_4px_16px_rgba(195,167,130,0.25)] transition-all cursor-pointer disabled:opacity-60">{saving ? "登録中..." : "登録する"}</button>
                <button onClick={() => { setShowAdd(false); setMsg(""); }} className="px-7 py-3 border border-[#f0ece4] text-[#888780] text-[12px] rounded-xl hover:bg-[#f8f6f3] transition-all cursor-pointer">キャンセル</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editTarget && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setEditTarget(null)}>
          <div className="bg-white rounded-2xl border border-[#f0ece4] p-8 w-full max-w-md animate-[fadeIn_0.25s_ease-out]" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-[16px] font-medium text-[#2c2c2a] mb-1">セラピスト編集</h2>
            <p className="text-[11px] text-[#d3d1c7] mb-6">情報を修正してください</p>
            <div className="space-y-4">
              <div>
                <label className="block text-[11px] text-[#888780] mb-1.5">名前 <span className="text-[#c49885]">*</span></label>
                <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-4 py-3 bg-[#f8f6f3] border border-transparent rounded-xl text-[13px] outline-none focus:border-[#c3a782]/30 focus:bg-white transition-all" />
              </div>
              <div>
                <label className="block text-[11px] text-[#888780] mb-1.5">電話番号</label>
                <input type="tel" value={editPhone} onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full px-4 py-3 bg-[#f8f6f3] border border-transparent rounded-xl text-[13px] outline-none focus:border-[#c3a782]/30 focus:bg-white transition-all" />
              </div>
              <div>
                <label className="block text-[11px] text-[#888780] mb-1.5">ステータス</label>
                <div className="flex gap-2">
                  {Object.entries(statusMap).map(([key, val]) => (
                    <button key={key} onClick={() => setEditStatus(key)}
                      className={`px-4 py-2 rounded-xl text-[12px] transition-all cursor-pointer ${editStatus === key ? "ring-2 ring-offset-1" : "opacity-60 hover:opacity-80"}`}
                      style={{ backgroundColor: val.bg, color: val.text }}>{val.label}</button>
                  ))}
                </div>
              </div>
              {editMsg && <div className={`px-4 py-3 rounded-xl text-[12px] ${editMsg.includes("失敗") || editMsg.includes("入力") ? "bg-[#c49885]/10 text-[#c49885]" : "bg-[#7ab88f]/10 text-[#5a9e6f]"}`}>{editMsg}</div>}
              <div className="flex gap-3 pt-2">
                <button onClick={handleUpdate} disabled={editSaving} className="px-7 py-3 bg-gradient-to-r from-[#c3a782] to-[#b09672] text-white text-[12px] rounded-xl hover:shadow-[0_4px_16px_rgba(195,167,130,0.25)] transition-all cursor-pointer disabled:opacity-60">{editSaving ? "更新中..." : "更新する"}</button>
                <button onClick={() => setEditTarget(null)} className="px-7 py-3 border border-[#f0ece4] text-[#888780] text-[12px] rounded-xl hover:bg-[#f8f6f3] transition-all cursor-pointer">キャンセル</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setDeleteTarget(null)}>
          <div className="bg-white rounded-2xl border border-[#f0ece4] p-8 w-full max-w-sm text-center animate-[fadeIn_0.25s_ease-out]" onClick={(e) => e.stopPropagation()}>
            <div className="w-14 h-14 rounded-full bg-[#fce8e8] flex items-center justify-center mx-auto mb-5">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#c45555" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </div>
            <h3 className="text-[15px] font-medium text-[#2c2c2a] mb-2">セラピストを削除しますか？</h3>
            <p className="text-[12px] text-[#b4b2a9] mb-6">「{deleteTarget.name}」を削除すると元に戻せません</p>
            <div className="flex gap-3 justify-center">
              <button onClick={handleDelete} disabled={deleting} className="px-6 py-2.5 bg-[#c45555] text-white text-[12px] rounded-xl hover:bg-[#b04444] transition-colors cursor-pointer disabled:opacity-60">{deleting ? "削除中..." : "削除する"}</button>
              <button onClick={() => setDeleteTarget(null)} className="px-6 py-2.5 border border-[#f0ece4] text-[#888780] text-[12px] rounded-xl hover:bg-[#f8f6f3] transition-all cursor-pointer">キャンセル</button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
