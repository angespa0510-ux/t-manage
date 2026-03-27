"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";
import { useTheme } from "../../lib/theme";

type Course = {
  id: number; created_at: string; name: string; duration: number;
  price: number; therapist_back: number;
};

export default function CourseManagement() {
  const router = useRouter();
  const { dark, toggle, T } = useTheme();
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
    const check = async () => { const { data: { user } } = await supabase.auth.getUser(); if (!user) router.push("/"); };
    check(); fetchCourses();
  }, [router, fetchCourses]);

  const handleAdd = async () => {
    if (!addName.trim() || !addPrice) { setMsg("コース名と料金を入力してください"); return; }
    setSaving(true); setMsg("");
    const { error } = await supabase.from("courses").insert({ name: addName.trim(), duration: parseInt(addDuration) || 0, price: parseInt(addPrice) || 0, therapist_back: parseInt(addBack) || 0 });
    setSaving(false);
    if (error) { setMsg("登録失敗: " + error.message); }
    else { setMsg("登録しました！"); setAddName(""); setAddPrice(""); setAddBack(""); setAddDuration("90"); fetchCourses(); setTimeout(() => { setShowAdd(false); setMsg(""); }, 600); }
  };

  const startEdit = (c: Course) => { setEditTarget(c); setEditName(c.name || ""); setEditDuration(String(c.duration || 0)); setEditPrice(String(c.price || 0)); setEditBack(String(c.therapist_back || 0)); setEditMsg(""); };
  const handleUpdate = async () => {
    if (!editTarget || !editName.trim()) { setEditMsg("コース名を入力してください"); return; }
    setEditSaving(true); setEditMsg("");
    const { error } = await supabase.from("courses").update({ name: editName.trim(), duration: parseInt(editDuration) || 0, price: parseInt(editPrice) || 0, therapist_back: parseInt(editBack) || 0 }).eq("id", editTarget.id);
    setEditSaving(false);
    if (error) { setEditMsg("更新失敗: " + error.message); }
    else { setEditMsg("更新しました！"); fetchCourses(); setTimeout(() => { setEditTarget(null); setEditMsg(""); }, 600); }
  };
  const handleDelete = async () => { if (!deleteTarget) return; setDeleting(true); await supabase.from("courses").delete().eq("id", deleteTarget.id); setDeleting(false); setDeleteTarget(null); fetchCourses(); };

  const fmt = (n: number) => "¥" + (n || 0).toLocaleString();

  const inputStyle = { backgroundColor: T.cardAlt, color: T.text, border: "1px solid transparent" };

  return (
    <div className="h-screen flex flex-col" style={{ backgroundColor: T.bg, color: T.text }}>
      <div className="h-[64px] backdrop-blur-xl border-b flex items-center justify-between px-6 flex-shrink-0" style={{ backgroundColor: dark ? T.card + "cc" : "rgba(255,255,255,0.8)", borderColor: T.border }}>
        <div className="flex items-center gap-4">
          <button onClick={() => router.push("/dashboard")} className="p-2 rounded-lg transition-colors cursor-pointer" style={{ color: T.textSub }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <div>
            <h1 className="text-[15px] font-medium">コース管理</h1>
            <p className="text-[11px]" style={{ color: T.textMuted }}>{courses.length}件のコース</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={toggle} className="px-3 py-1.5 text-[10px] rounded-lg cursor-pointer border" style={{ borderColor: T.border, color: T.textSub }}>{dark ? "☀️ ライト" : "🌙 ダーク"}</button>
          <button onClick={() => { setShowAdd(true); setMsg(""); setAddName(""); setAddPrice(""); setAddBack(""); setAddDuration("90"); }}
            className="px-4 py-2 bg-gradient-to-r from-[#c3a782] to-[#b09672] text-white text-[11px] rounded-xl cursor-pointer">+ コース追加</button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {courses.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={T.textFaint} strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
            <p className="text-[14px] mt-4" style={{ color: T.textMuted }}>コースが登録されていません</p>
            <button onClick={() => setShowAdd(true)} className="mt-4 px-5 py-2.5 bg-gradient-to-r from-[#c3a782] to-[#b09672] text-white text-[12px] rounded-xl cursor-pointer">+ コースを追加</button>
          </div>
        ) : (
          <div className="max-w-[900px] mx-auto space-y-3">
            {courses.map((c) => {
              const profit = (c.price || 0) - (c.therapist_back || 0);
              return (
                <div key={c.id} className="rounded-2xl border p-5 transition-all duration-300" style={{ backgroundColor: T.card, borderColor: T.border }}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: T.cardAlt }}>
                        <span className="text-[14px] font-medium" style={{ color: T.accent }}>{c.duration}<span className="text-[10px]" style={{ color: T.textMuted }}>分</span></span>
                      </div>
                      <div>
                        <p className="text-[15px] font-medium">{c.name}</p>
                        <div className="flex items-center gap-4 mt-1">
                          <span className="text-[12px]" style={{ color: T.textSub }}>料金: <span className="font-medium" style={{ color: T.text }}>{fmt(c.price)}</span></span>
                          <span className="text-[12px]" style={{ color: T.textSub }}>バック: <span className="font-medium" style={{ color: "#7ab88f" }}>{fmt(c.therapist_back)}</span></span>
                          <span className="text-[12px]" style={{ color: T.textSub }}>利益: <span className="font-medium" style={{ color: T.text }}>{fmt(profit)}</span></span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => startEdit(c)} className="px-3 py-1.5 text-[11px] rounded-lg cursor-pointer" style={{ color: "#3d6b9f", backgroundColor: "#3d6b9f18" }}>編集</button>
                      <button onClick={() => setDeleteTarget(c)} className="px-3 py-1.5 text-[11px] rounded-lg cursor-pointer" style={{ color: "#c45555", backgroundColor: "#c4555518" }}>削除</button>
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
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowAdd(false)}>
          <div className="rounded-2xl border p-8 w-full max-w-md animate-[fadeIn_0.25s]" style={{ backgroundColor: T.card, borderColor: T.border }} onClick={(e) => e.stopPropagation()}>
            <h2 className="text-[16px] font-medium mb-1">コース追加</h2>
            <p className="text-[11px] mb-6" style={{ color: T.textFaint }}>新しいコースを登録します</p>
            <div className="space-y-4">
              <div>
                <label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>コース名 <span style={{ color: "#c49885" }}>*</span></label>
                <input type="text" value={addName} onChange={(e) => setAddName(e.target.value)} placeholder="90分コース" className="w-full px-4 py-3 rounded-xl text-[13px] outline-none transition-all" style={inputStyle} />
              </div>
              <div>
                <label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>時間（分）</label>
                <select value={addDuration} onChange={(e) => setAddDuration(e.target.value)} className="w-full px-4 py-3 rounded-xl text-[13px] outline-none transition-all cursor-pointer" style={inputStyle}>
                  {[60, 70, 80, 90, 100, 110, 120, 150, 180].map((m) => (<option key={m} value={m}>{m}分</option>))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>料金 <span style={{ color: "#c49885" }}>*</span></label>
                <input type="text" inputMode="numeric" value={addPrice} onChange={(e) => setAddPrice(e.target.value.replace(/[^0-9]/g, ""))} placeholder="15000" className="w-full px-4 py-3 rounded-xl text-[13px] outline-none transition-all" style={inputStyle} />
              </div>
              <div>
                <label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>セラピストバック</label>
                <input type="text" inputMode="numeric" value={addBack} onChange={(e) => setAddBack(e.target.value.replace(/[^0-9]/g, ""))} placeholder="5000" className="w-full px-4 py-3 rounded-xl text-[13px] outline-none transition-all" style={inputStyle} />
              </div>
              {addPrice && (
                <div className="rounded-xl p-4" style={{ backgroundColor: T.cardAlt }}>
                  <p className="text-[10px] mb-2" style={{ color: T.textMuted }}>料金プレビュー</p>
                  <div className="flex items-center gap-6 text-[12px]">
                    <span style={{ color: T.textSub }}>料金: <span className="font-medium" style={{ color: T.text }}>{fmt(parseInt(addPrice) || 0)}</span></span>
                    {addBack && <span style={{ color: T.textSub }}>バック: <span className="font-medium" style={{ color: "#7ab88f" }}>{fmt(parseInt(addBack) || 0)}</span></span>}
                    {addBack && <span style={{ color: T.textSub }}>利益: <span className="font-medium" style={{ color: T.text }}>{fmt((parseInt(addPrice) || 0) - (parseInt(addBack) || 0))}</span></span>}
                  </div>
                </div>
              )}
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
          <div className="rounded-2xl border p-8 w-full max-w-md animate-[fadeIn_0.25s]" style={{ backgroundColor: T.card, borderColor: T.border }} onClick={(e) => e.stopPropagation()}>
            <h2 className="text-[16px] font-medium mb-1">コース編集</h2>
            <p className="text-[11px] mb-6" style={{ color: T.textFaint }}>コース情報を修正します</p>
            <div className="space-y-4">
              <div>
                <label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>コース名 <span style={{ color: "#c49885" }}>*</span></label>
                <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full px-4 py-3 rounded-xl text-[13px] outline-none transition-all" style={inputStyle} />
              </div>
              <div>
                <label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>時間（分）</label>
                <select value={editDuration} onChange={(e) => setEditDuration(e.target.value)} className="w-full px-4 py-3 rounded-xl text-[13px] outline-none transition-all cursor-pointer" style={inputStyle}>
                  {[60, 70, 80, 90, 100, 110, 120, 150, 180].map((m) => (<option key={m} value={m}>{m}分</option>))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>料金 <span style={{ color: "#c49885" }}>*</span></label>
                <input type="text" inputMode="numeric" value={editPrice} onChange={(e) => setEditPrice(e.target.value.replace(/[^0-9]/g, ""))} className="w-full px-4 py-3 rounded-xl text-[13px] outline-none transition-all" style={inputStyle} />
              </div>
              <div>
                <label className="block text-[11px] mb-1.5" style={{ color: T.textSub }}>セラピストバック</label>
                <input type="text" inputMode="numeric" value={editBack} onChange={(e) => setEditBack(e.target.value.replace(/[^0-9]/g, ""))} className="w-full px-4 py-3 rounded-xl text-[13px] outline-none transition-all" style={inputStyle} />
              </div>
              {editPrice && (
                <div className="rounded-xl p-4" style={{ backgroundColor: T.cardAlt }}>
                  <p className="text-[10px] mb-2" style={{ color: T.textMuted }}>料金プレビュー</p>
                  <div className="flex items-center gap-6 text-[12px]">
                    <span style={{ color: T.textSub }}>料金: <span className="font-medium" style={{ color: T.text }}>{fmt(parseInt(editPrice) || 0)}</span></span>
                    {editBack && <span style={{ color: T.textSub }}>バック: <span className="font-medium" style={{ color: "#7ab88f" }}>{fmt(parseInt(editBack) || 0)}</span></span>}
                    {editBack && <span style={{ color: T.textSub }}>利益: <span className="font-medium" style={{ color: T.text }}>{fmt((parseInt(editPrice) || 0) - (parseInt(editBack) || 0))}</span></span>}
                  </div>
                </div>
              )}
              {editMsg && <div className="px-4 py-3 rounded-xl text-[12px]" style={{ backgroundColor: editMsg.includes("失敗") ? "#c4988518" : "#7ab88f18", color: editMsg.includes("失敗") ? "#c49885" : "#5a9e6f" }}>{editMsg}</div>}
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
            <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-5" style={{ backgroundColor: "#c4555518" }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#c45555" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </div>
            <h3 className="text-[15px] font-medium mb-2">コースを削除しますか？</h3>
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
