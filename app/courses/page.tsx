"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";

type Course = {
  id: number; created_at: string; name: string; duration: number;
  price: number; therapist_back: number;
};

export default function CourseManagement() {
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);

  const [showAdd, setShowAdd] = useState(false);
  const [addName, setAddName] = useState("");
  const [addDuration, setAddDuration] = useState("90");
  const [addPrice, setAddPrice] = useState("");
  const [addBack, setAddBack] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const [editTarget, setEditTarget] = useState<Course | null>(null);
  const [editName, setEditName] = useState("");
  const [editDuration, setEditDuration] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editBack, setEditBack] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editMsg, setEditMsg] = useState("");

  const [deleteTarget, setDeleteTarget] = useState<Course | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchCourses = useCallback(async () => {
    const { data } = await supabase.from("courses").select("*").order("duration", { ascending: true });
    if (data) setCourses(data);
  }, []);

  useEffect(() => {
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) router.push("/");
    };
    check();
    fetchCourses();
  }, [router, fetchCourses]);

  const handleAdd = async () => {
    if (!addName.trim() || !addPrice) { setMsg("コース名と料金を入力してください"); return; }
    setSaving(true); setMsg("");
    const { error } = await supabase.from("courses").insert({
      name: addName.trim(), duration: parseInt(addDuration) || 0,
      price: parseInt(addPrice) || 0, therapist_back: parseInt(addBack) || 0,
    });
    setSaving(false);
    if (error) { setMsg("登録失敗: " + error.message); }
    else {
      setMsg("登録しました！");
      setAddName(""); setAddPrice(""); setAddBack(""); setAddDuration("90");
      fetchCourses();
      setTimeout(() => { setShowAdd(false); setMsg(""); }, 600);
    }
  };

  const startEdit = (c: Course) => {
    setEditTarget(c);
    setEditName(c.name || "");
    setEditDuration(String(c.duration || 0));
    setEditPrice(String(c.price || 0));
    setEditBack(String(c.therapist_back || 0));
    setEditMsg("");
  };

  const handleUpdate = async () => {
    if (!editTarget || !editName.trim()) { setEditMsg("コース名を入力してください"); return; }
    setEditSaving(true); setEditMsg("");
    const { error } = await supabase.from("courses").update({
      name: editName.trim(), duration: parseInt(editDuration) || 0,
      price: parseInt(editPrice) || 0, therapist_back: parseInt(editBack) || 0,
    }).eq("id", editTarget.id);
    setEditSaving(false);
    if (error) { setEditMsg("更新失敗: " + error.message); }
    else {
      setEditMsg("更新しました！");
      fetchCourses();
      setTimeout(() => { setEditTarget(null); setEditMsg(""); }, 600);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    await supabase.from("courses").delete().eq("id", deleteTarget.id);
    setDeleting(false);
    setDeleteTarget(null);
    fetchCourses();
  };

  const fmt = (n: number) => "¥" + (n || 0).toLocaleString();

  return (
    <div className="h-screen flex flex-col bg-[#f8f6f3]">
      <div className="h-[64px] bg-white/80 backdrop-blur-xl border-b border-[#e8e4df] flex items-center justify-between px-6 flex-shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push("/dashboard")} className="p-2 rounded-lg hover:bg-[#f8f6f3] transition-colors cursor-pointer">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9c9a92" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <div>
            <h1 className="text-[15px] font-medium text-[#2c2c2a]">コース管理</h1>
            <p className="text-[11px] text-[#b4b2a9]">{courses.length}件のコース</p>
          </div>
        </div>
        <button onClick={() => { setShowAdd(true); setMsg(""); setAddName(""); setAddPrice(""); setAddBack(""); setAddDuration("90"); }}
          className="px-4 py-2 bg-gradient-to-r from-[#c3a782] to-[#b09672] text-white text-[11px] rounded-xl hover:shadow-[0_4px_16px_rgba(195,167,130,0.25)] transition-all cursor-pointer">+ コース追加</button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {courses.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#e0dbd2" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
            <p className="text-[14px] text-[#b4b2a9] mt-4">コースが登録されていません</p>
            <button onClick={() => setShowAdd(true)} className="mt-4 px-5 py-2.5 bg-gradient-to-r from-[#c3a782] to-[#b09672] text-white text-[12px] rounded-xl cursor-pointer">+ コースを追加</button>
          </div>
        ) : (
          <div className="max-w-[900px] mx-auto space-y-3">
            {courses.map((c) => {
              const profit = (c.price || 0) - (c.therapist_back || 0);
              return (
                <div key={c.id} className="bg-white rounded-2xl border border-[#f0ece4] p-5 hover:border-[#e0dbd2] hover:shadow-[0_4px_20px_rgba(0,0,0,0.03)] transition-all duration-300">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-[#f8f6f3] flex items-center justify-center">
                        <span className="text-[14px] font-medium text-[#c3a782]">{c.duration}<span className="text-[10px] text-[#b4b2a9]">分</span></span>
                      </div>
                      <div>
                        <p className="text-[15px] font-medium text-[#2c2c2a]">{c.name}</p>
                        <div className="flex items-center gap-4 mt-1">
                          <span className="text-[12px] text-[#888780]">料金: <span className="text-[#2c2c2a] font-medium">{fmt(c.price)}</span></span>
                          <span className="text-[12px] text-[#888780]">バック: <span className="text-[#7ab88f] font-medium">{fmt(c.therapist_back)}</span></span>
                          <span className="text-[12px] text-[#888780]">利益: <span className="text-[#2c2c2a] font-medium">{fmt(profit)}</span></span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => startEdit(c)} className="px-3 py-1.5 text-[11px] text-[#3d6b9f] bg-[#e4eef7] rounded-lg hover:bg-[#d4e4f4] transition-colors cursor-pointer">編集</button>
                      <button onClick={() => setDeleteTarget(c)} className="px-3 py-1.5 text-[11px] text-[#c45555] bg-[#fce8e8] rounded-lg hover:bg-[#f8d4d4] transition-colors cursor-pointer">削除</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowAdd(false)}>
          <div className="bg-white rounded-2xl border border-[#f0ece4] p-8 w-full max-w-md animate-[fadeIn_0.25s_ease-out]" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-[16px] font-medium text-[#2c2c2a] mb-1">コース追加</h2>
            <p className="text-[11px] text-[#d3d1c7] mb-6">新しいコースを登録します</p>
            <div className="space-y-4">
              <div>
                <label className="block text-[11px] text-[#888780] mb-1.5">コース名 <span className="text-[#c49885]">*</span></label>
                <input type="text" value={addName} onChange={(e) => setAddName(e.target.value)} placeholder="90分コース"
                  className="w-full px-4 py-3 bg-[#f8f6f3] border border-transparent rounded-xl text-[13px] outline-none focus:border-[#c3a782]/30 focus:bg-white transition-all placeholder-[#d3d1c7]" />
              </div>
              <div>
                <label className="block text-[11px] text-[#888780] mb-1.5">時間（分）</label>
                <select value={addDuration} onChange={(e) => setAddDuration(e.target.value)}
                  className="w-full px-4 py-3 bg-[#f8f6f3] border border-transparent rounded-xl text-[13px] outline-none focus:border-[#c3a782]/30 focus:bg-white transition-all cursor-pointer">
                  {[60, 70, 80, 90, 100, 110, 120, 150, 180].map((m) => (
                    <option key={m} value={m}>{m}分</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] text-[#888780] mb-1.5">料金 <span className="text-[#c49885]">*</span></label>
                <input type="text" inputMode="numeric" value={addPrice} onChange={(e) => setAddPrice(e.target.value.replace(/[^0-9]/g, ""))} placeholder="15000"
                  className="w-full px-4 py-3 bg-[#f8f6f3] border border-transparent rounded-xl text-[13px] outline-none focus:border-[#c3a782]/30 focus:bg-white transition-all placeholder-[#d3d1c7]" />
              </div>
              <div>
                <label className="block text-[11px] text-[#888780] mb-1.5">セラピストバック</label>
                <input type="text" inputMode="numeric" value={addBack} onChange={(e) => setAddBack(e.target.value.replace(/[^0-9]/g, ""))} placeholder="5000"
                  className="w-full px-4 py-3 bg-[#f8f6f3] border border-transparent rounded-xl text-[13px] outline-none focus:border-[#c3a782]/30 focus:bg-white transition-all placeholder-[#d3d1c7]" />
              </div>
              {/* Preview */}
              {addPrice && (
                <div className="bg-[#f8f6f3] rounded-xl p-4">
                  <p className="text-[10px] text-[#b4b2a9] mb-2">料金プレビュー</p>
                  <div className="flex items-center gap-6 text-[12px]">
                    <span className="text-[#888780]">料金: <span className="text-[#2c2c2a] font-medium">{fmt(parseInt(addPrice) || 0)}</span></span>
                    {addBack && <span className="text-[#888780]">バック: <span className="text-[#7ab88f] font-medium">{fmt(parseInt(addBack) || 0)}</span></span>}
                    {addBack && <span className="text-[#888780]">利益: <span className="text-[#2c2c2a] font-medium">{fmt((parseInt(addPrice) || 0) - (parseInt(addBack) || 0))}</span></span>}
                  </div>
                </div>
              )}
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
            <h2 className="text-[16px] font-medium text-[#2c2c2a] mb-1">コース編集</h2>
            <p className="text-[11px] text-[#d3d1c7] mb-6">コース情報を修正します</p>
            <div className="space-y-4">
              <div>
                <label className="block text-[11px] text-[#888780] mb-1.5">コース名 <span className="text-[#c49885]">*</span></label>
                <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-4 py-3 bg-[#f8f6f3] border border-transparent rounded-xl text-[13px] outline-none focus:border-[#c3a782]/30 focus:bg-white transition-all" />
              </div>
              <div>
                <label className="block text-[11px] text-[#888780] mb-1.5">時間（分）</label>
                <select value={editDuration} onChange={(e) => setEditDuration(e.target.value)}
                  className="w-full px-4 py-3 bg-[#f8f6f3] border border-transparent rounded-xl text-[13px] outline-none focus:border-[#c3a782]/30 focus:bg-white transition-all cursor-pointer">
                  {[60, 70, 80, 90, 100, 110, 120, 150, 180].map((m) => (
                    <option key={m} value={m}>{m}分</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] text-[#888780] mb-1.5">料金 <span className="text-[#c49885]">*</span></label>
                <input type="text" inputMode="numeric" value={editPrice} onChange={(e) => setEditPrice(e.target.value.replace(/[^0-9]/g, ""))}
                  className="w-full px-4 py-3 bg-[#f8f6f3] border border-transparent rounded-xl text-[13px] outline-none focus:border-[#c3a782]/30 focus:bg-white transition-all" />
              </div>
              <div>
                <label className="block text-[11px] text-[#888780] mb-1.5">セラピストバック</label>
                <input type="text" inputMode="numeric" value={editBack} onChange={(e) => setEditBack(e.target.value.replace(/[^0-9]/g, ""))}
                  className="w-full px-4 py-3 bg-[#f8f6f3] border border-transparent rounded-xl text-[13px] outline-none focus:border-[#c3a782]/30 focus:bg-white transition-all" />
              </div>
              {editPrice && (
                <div className="bg-[#f8f6f3] rounded-xl p-4">
                  <p className="text-[10px] text-[#b4b2a9] mb-2">料金プレビュー</p>
                  <div className="flex items-center gap-6 text-[12px]">
                    <span className="text-[#888780]">料金: <span className="text-[#2c2c2a] font-medium">{fmt(parseInt(editPrice) || 0)}</span></span>
                    {editBack && <span className="text-[#888780]">バック: <span className="text-[#7ab88f] font-medium">{fmt(parseInt(editBack) || 0)}</span></span>}
                    {editBack && <span className="text-[#888780]">利益: <span className="text-[#2c2c2a] font-medium">{fmt((parseInt(editPrice) || 0) - (parseInt(editBack) || 0))}</span></span>}
                  </div>
                </div>
              )}
              {editMsg && <div className={`px-4 py-3 rounded-xl text-[12px] ${editMsg.includes("失敗") ? "bg-[#c49885]/10 text-[#c49885]" : "bg-[#7ab88f]/10 text-[#5a9e6f]"}`}>{editMsg}</div>}
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
            <h3 className="text-[15px] font-medium text-[#2c2c2a] mb-2">コースを削除しますか？</h3>
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
