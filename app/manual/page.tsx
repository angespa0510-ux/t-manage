"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";
import { useTheme } from "../../lib/theme";
import { NavMenu } from "../../lib/nav-menu";
import { useStaffSession } from "../../lib/staff-session";

type Category = { id: number; name: string; icon: string; color: string; description: string; sort_order: number };
type Article = {
  id: number; title: string; category_id: number | null; content: string; cover_image: string;
  tags: string[]; is_published: boolean; is_pinned: boolean; view_count: number;
  sort_order: number; created_at: string; updated_at: string;
};
type QA = { id?: number; article_id?: number; question: string; answer: string; sort_order: number };
type Update = { id: number; article_id: number; summary: string; updated_by: string; created_at: string };

const TAG_COLORS = [
  { bg: "#FBEAF0", color: "#72243E" }, { bg: "#EEEDFE", color: "#3C3489" },
  { bg: "#E1F5EE", color: "#085041" }, { bg: "#FAEEDA", color: "#633806" },
  { bg: "#E6F1FB", color: "#0C447C" }, { bg: "#FAECE7", color: "#712B13" },
  { bg: "#F1EFE8", color: "#444441" }, { bg: "#EAF3DE", color: "#27500A" },
];

function tagColor(tag: string) {
  let h = 0; for (let i = 0; i < tag.length; i++) h = tag.charCodeAt(i) + ((h << 5) - h);
  return TAG_COLORS[Math.abs(h) % TAG_COLORS.length];
}

export default function ManualPage() {
  const router = useRouter();
  const { dark, toggle, T } = useTheme();
  const { activeStaff } = useStaffSession();
  // NavMenu manages its own state

  const [categories, setCategories] = useState<Category[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [updates, setUpdates] = useState<Update[]>([]);
  const [therapists, setTherapists] = useState<{ id: number; name: string; status: string }[]>([]);
  const [allReads, setAllReads] = useState<{ article_id: number; therapist_id: number; read_at: string }[]>([]);
  const [showReadsFor, setShowReadsFor] = useState<number | null>(null);
  const [selectedCat, setSelectedCat] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTag, setFilterTag] = useState("");

  // Editor state
  const [view, setView] = useState<"list" | "edit" | "categories" | "logs">("list");
  const [editArticle, setEditArticle] = useState<Article | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editCategoryId, setEditCategoryId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editCoverImage, setEditCoverImage] = useState("");
  const [editTags, setEditTags] = useState<string[]>([]);
  const [editTagInput, setEditTagInput] = useState("");
  const [editPublished, setEditPublished] = useState(false);
  const [editPinned, setEditPinned] = useState(false);
  const [editQAs, setEditQAs] = useState<QA[]>([]);
  const [editUpdateMemo, setEditUpdateMemo] = useState("");
  const [editResetReads, setEditResetReads] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState<"" | "cleanup" | "tags">("");
  const [msg, setMsg] = useState("");
  const [dragOverCover, setDragOverCover] = useState(false);
  const [dragOverEditor, setDragOverEditor] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [aiLogs, setAiLogs] = useState<{ id: number; question: string; answer: string; therapist_name: string; created_at: string; rating: number | null }[]>([]);
  const [aiLogFilter, setAiLogFilter] = useState<"all" | "bad" | "good" | "unrated">("all");
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  // Category editor
  const [editCat, setEditCat] = useState<Category | null>(null);
  const [catName, setCatName] = useState("");
  const [catIcon, setCatIcon] = useState("");
  const [catColor, setCatColor] = useState("");
  const [catDesc, setCatDesc] = useState("");

  const fetchData = useCallback(async () => {
    const { data: c } = await supabase.from("manual_categories").select("*").order("sort_order");
    if (c) setCategories(c);
    const { data: a } = await supabase.from("manual_articles").select("*").order("sort_order").order("created_at", { ascending: false });
    if (a) setArticles(a);
    const { data: u } = await supabase.from("manual_updates").select("*").order("created_at", { ascending: false }).limit(20);
    if (u) setUpdates(u);
    const { data: th } = await supabase.from("therapists").select("id,name,status").eq("status", "active").order("name");
    if (th) setTherapists(th);
    const { data: rd } = await supabase.from("manual_reads").select("article_id,therapist_id,read_at");
    if (rd) setAllReads(rd);
    const { data: logs } = await supabase.from("manual_ai_logs").select("*").order("created_at", { ascending: false }).limit(100);
    if (logs) setAiLogs(logs);
  }, []);

  useEffect(() => {
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) router.push("/");
    };
    check(); fetchData();
  }, [router, fetchData]);

  // ── Filtered articles ──
  const filteredArticles = articles.filter(a => {
    if (selectedCat !== null && a.category_id !== selectedCat) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!a.title.toLowerCase().includes(q) && !a.tags.some(t => t.toLowerCase().includes(q))) return false;
    }
    if (filterTag && !a.tags.includes(filterTag)) return false;
    return true;
  });

  const allTags = Array.from(new Set(articles.flatMap(a => a.tags))).sort();
  const getCatName = (id: number | null) => categories.find(c => c.id === id);

  // ── Image upload ──
  const uploadImage = async (file: File): Promise<string> => {
    const ext = file.name.split(".").pop() || "jpg";
    const name = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage.from("manual-images").upload(name, file, { contentType: file.type });
    if (error) { alert("画像アップロード失敗: " + error.message); return ""; }
    const { data } = supabase.storage.from("manual-images").getPublicUrl(name);
    return data.publicUrl;
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const url = await uploadImage(file);
    if (url) setEditCoverImage(url);
    setUploading(false);
  };

  const handleInlineImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const url = await uploadImage(file);
    if (url && editorRef.current) {
      const img = `\n![画像](${url})\n`;
      setEditContent(prev => prev + img);
    }
    setUploading(false);
  };

  // ── Drag & Drop helpers ──
  const preventDefaults = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); };
  const isImageFile = (file: File) => file.type.startsWith("image/");

  const handleCoverDrop = async (e: React.DragEvent) => {
    preventDefaults(e); setDragOverCover(false);
    const file = e.dataTransfer.files[0];
    if (!file || !isImageFile(file)) return;
    setUploading(true);
    const url = await uploadImage(file);
    if (url) setEditCoverImage(url);
    setUploading(false);
  };

  const handleEditorDrop = async (e: React.DragEvent) => {
    preventDefaults(e); setDragOverEditor(false);
    const files = Array.from(e.dataTransfer.files).filter(isImageFile);
    if (files.length === 0) return;
    setUploading(true);
    let inserted = "";
    for (const file of files) {
      const url = await uploadImage(file);
      if (url) inserted += `\n![画像](${url})\n`;
    }
    if (inserted) setEditContent(prev => prev + inserted);
    setUploading(false);
  };

  // ── Clipboard paste (Ctrl+V) ──
  const handleEditorPaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const imageItems = Array.from(items).filter(item => item.type.startsWith("image/"));
    if (imageItems.length === 0) return;
    e.preventDefault();
    setUploading(true);
    let inserted = "";
    for (const item of imageItems) {
      const file = item.getAsFile();
      if (!file) continue;
      const url = await uploadImage(file);
      if (url) inserted += `\n![画像](${url})\n`;
    }
    if (inserted) setEditContent(prev => prev + inserted);
    setUploading(false);
  };

  // ── 記事内リンク プレビュー表示 ──
  const renderAdminInlineLinks = (text: string): React.ReactNode => {
    const parts = text.split(/(\[link:[^\]]+\]|\[catlink:[^\]]+\])/g);
    if (parts.length === 1) return text;
    return parts.map((part, idx) => {
      const linkMatch = part.match(/^\[link:(.+)\]$/);
      if (linkMatch) return <span key={idx} style={{ color: "#e8849a", fontWeight: 600, borderBottom: "1px dashed #e8849a", paddingBottom: 1 }}>📖 {linkMatch[1]}</span>;
      const catMatch = part.match(/^\[catlink:(.+)\]$/);
      if (catMatch) {
        const cat = categories.find(c => c.name === catMatch[1] || c.name.includes(catMatch[1]));
        return <span key={idx} style={{ color: "#e8849a", fontWeight: 600, borderBottom: "1px dashed #e8849a", paddingBottom: 1 }}>{cat ? `${cat.icon} ${cat.name}` : catMatch[1]}</span>;
      }
      return <span key={idx}>{part}</span>;
    });
  };
  const renderAdminInline = (text: string): React.ReactNode => {
    if (text.match(/\*\*(.*?)\*\*/)) {
      const parts = text.split(/(\*\*.*?\*\*)/g);
      return parts.map((p, j) => p.startsWith("**") && p.endsWith("**") ? <strong key={j} style={{ color: "#e8849a" }}>{renderAdminInlineLinks(p.slice(2, -2))}</strong> : <span key={j}>{renderAdminInlineLinks(p)}</span>);
    }
    return renderAdminInlineLinks(text);
  };

  // ── Tag management ──
  const addTag = () => {
    const t = editTagInput.trim();
    if (t && !editTags.includes(t)) { setEditTags([...editTags, t]); setEditTagInput(""); }
  };

  // ── QA management ──
  const addQA = () => setEditQAs([...editQAs, { question: "", answer: "", sort_order: editQAs.length }]);
  const updateQA = (idx: number, field: "question" | "answer", val: string) => {
    const qa = [...editQAs]; qa[idx] = { ...qa[idx], [field]: val }; setEditQAs(qa);
  };
  const removeQA = (idx: number) => setEditQAs(editQAs.filter((_, i) => i !== idx));

  // ── Open editor ──
  const openNewArticle = () => {
    setEditArticle(null); setEditTitle(""); setEditCategoryId(selectedCat);
    setEditContent(""); setEditCoverImage(""); setEditTags([]); setEditTagInput("");
    setEditPublished(false); setEditPinned(false); setEditQAs([]); setEditUpdateMemo(""); setEditResetReads(false);
    setMsg(""); setView("edit");
  };

  const openEditArticle = async (a: Article) => {
    setEditArticle(a); setEditTitle(a.title); setEditCategoryId(a.category_id);
    setEditContent(a.content); setEditCoverImage(a.cover_image);
    setEditTags(a.tags || []); setEditTagInput("");
    setEditPublished(a.is_published); setEditPinned(a.is_pinned);
    setEditUpdateMemo(""); setMsg("");
    // Load QAs
    const { data: qa } = await supabase.from("manual_qa").select("*").eq("article_id", a.id).order("sort_order");
    setEditQAs(qa || []);
    setView("edit");
  };

  // ── Save article ──
  const saveArticle = async () => {
    if (!editTitle.trim()) { setMsg("タイトルを入力してください"); return; }
    setSaving(true); setMsg("");

    const payload = {
      title: editTitle.trim(), category_id: editCategoryId, content: editContent,
      cover_image: editCoverImage, tags: editTags, is_published: editPublished,
      is_pinned: editPinned, updated_at: new Date().toISOString(),
    };

    let articleId: number;

    if (editArticle) {
      // Update
      const { error } = await supabase.from("manual_articles").update(payload).eq("id", editArticle.id);
      if (error) { setMsg("保存失敗: " + error.message); setSaving(false); return; }
      articleId = editArticle.id;
      // Record update
      if (editUpdateMemo.trim()) {
        await supabase.from("manual_updates").insert({
          article_id: articleId, summary: editUpdateMemo.trim(),
          updated_by: activeStaff?.name || "スタッフ",
        });
      }
      // Reset reads if requested
      if (editResetReads) {
        await supabase.from("manual_reads").delete().eq("article_id", articleId);
      }
    } else {
      // Create
      const { data, error } = await supabase.from("manual_articles").insert(payload).select().single();
      if (error || !data) { setMsg("作成失敗: " + (error?.message || "")); setSaving(false); return; }
      articleId = data.id;
    }

    // Save QAs
    // Delete existing and re-insert
    await supabase.from("manual_qa").delete().eq("article_id", articleId);
    if (editQAs.length > 0) {
      const qaPayload = editQAs.filter(q => q.question.trim()).map((q, i) => ({
        article_id: articleId, question: q.question.trim(), answer: q.answer.trim(), sort_order: i,
      }));
      if (qaPayload.length > 0) await supabase.from("manual_qa").insert(qaPayload);
    }

    setSaving(false); setMsg("✅ 保存しました");
    await fetchData();
    setTimeout(() => setView("list"), 800);
  };

  // ── Delete article ──
  const deleteArticle = async (id: number) => {
    if (!confirm("この記事を削除しますか？")) return;
    await supabase.from("manual_articles").delete().eq("id", id);
    fetchData();
  };

  // ── 記事並び替え ──
  const moveArticle = async (articleId: number, direction: "up" | "down") => {
    const sameCatArticles = (selectedCat !== null
      ? articles.filter(a => a.category_id === selectedCat)
      : articles
    ).sort((a, b) => a.sort_order - b.sort_order);
    const idx = sameCatArticles.findIndex(a => a.id === articleId);
    if (idx < 0) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sameCatArticles.length) return;
    const current = sameCatArticles[idx];
    const target = sameCatArticles[swapIdx];
    await supabase.from("manual_articles").update({ sort_order: target.sort_order }).eq("id", current.id);
    await supabase.from("manual_articles").update({ sort_order: current.sort_order }).eq("id", target.id);
    fetchData();
  };

  // ── Category save ──
  const saveCat = async () => {
    if (!catName.trim()) return;
    if (editCat) {
      await supabase.from("manual_categories").update({
        name: catName, icon: catIcon, color: catColor, description: catDesc,
      }).eq("id", editCat.id);
    } else {
      await supabase.from("manual_categories").insert({
        name: catName, icon: catIcon, color: catColor, description: catDesc,
        sort_order: categories.length + 1,
      });
    }
    setEditCat(null); fetchData();
  };

  // ── Styles ──
  const S = {
    page: { minHeight: "100vh", background: T.bg, color: T.text } as React.CSSProperties,
    header: { height: 56, display: "flex", alignItems: "center", padding: "0 16px", borderBottom: `1px solid ${T.border}`, background: T.card, gap: 12 } as React.CSSProperties,
    headerTitle: { fontSize: 16, fontWeight: 600, flex: 1 } as React.CSSProperties,
    btn: { padding: "6px 14px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.card, color: T.text, fontSize: 13, cursor: "pointer" } as React.CSSProperties,
    btnAccent: { padding: "6px 14px", borderRadius: 8, border: "none", background: T.accent, color: "#fff", fontSize: 13, cursor: "pointer", fontWeight: 500 } as React.CSSProperties,
    content: { padding: 16, maxWidth: 960, margin: "0 auto" } as React.CSSProperties,
    card: { background: T.card, borderRadius: 12, border: `1px solid ${T.border}`, padding: 16, marginBottom: 12 } as React.CSSProperties,
    input: { width: "100%", padding: "8px 12px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.bg, color: T.text, fontSize: 14, outline: "none", boxSizing: "border-box" as const } as React.CSSProperties,
    textarea: { width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.bg, color: T.text, fontSize: 14, outline: "none", minHeight: 200, resize: "vertical" as const, fontFamily: "inherit", boxSizing: "border-box" as const } as React.CSSProperties,
    label: { fontSize: 12, color: T.textSub, marginBottom: 4, display: "block", fontWeight: 500 } as React.CSSProperties,
    tag: (t: string) => {
      const c = tagColor(t);
      return { display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, padding: "2px 10px", borderRadius: 12, background: dark ? `${c.color}30` : c.bg, color: dark ? c.bg : c.color, fontWeight: 500 } as React.CSSProperties;
    },
  };

  // ── Category tabs ──
  const renderCategoryTabs = () => (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
      <button
        style={{ ...S.btn, fontWeight: selectedCat === null ? 600 : 400, background: selectedCat === null ? T.accent : T.card, color: selectedCat === null ? "#fff" : T.text }}
        onClick={() => setSelectedCat(null)}
      >すべて ({articles.length})</button>
      {categories.map(c => {
        const cnt = articles.filter(a => a.category_id === c.id).length;
        return (
          <button key={c.id}
            style={{ ...S.btn, fontWeight: selectedCat === c.id ? 600 : 400, background: selectedCat === c.id ? c.color : T.card, color: selectedCat === c.id ? "#333" : T.text, borderColor: c.color }}
            onClick={() => setSelectedCat(c.id)}
          >{c.icon} {c.name} ({cnt})</button>
        );
      })}
    </div>
  );

  // ── Tag filter bar ──
  const renderTagFilter = () => allTags.length > 0 ? (
    <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 12 }}>
      <span style={{ fontSize: 11, color: T.textSub, lineHeight: "22px" }}>🏷️タグ:</span>
      {filterTag && <button style={{ ...S.tag("×"), cursor: "pointer", border: "none" }} onClick={() => setFilterTag("")}>× クリア</button>}
      {allTags.map(t => (
        <button key={t} style={{ ...S.tag(t), cursor: "pointer", border: "none", opacity: filterTag && filterTag !== t ? 0.4 : 1 }}
          onClick={() => setFilterTag(filterTag === t ? "" : t)}>{t}</button>
      ))}
    </div>
  ) : null;

  // ── Article card ──
  const renderArticleCard = (a: Article) => {
    const cat = getCatName(a.category_id);
    const latestUpdate = updates.find(u => u.article_id === a.id);
    return (<React.Fragment key={a.id}>
      <div style={{ ...S.card, display: "flex", gap: 12, alignItems: "flex-start", cursor: "pointer", transition: "box-shadow 0.2s" }}
        onClick={() => openEditArticle(a)}>
        {/* Cover image */}
        {a.cover_image ? (
          <div style={{ width: 80, height: 80, borderRadius: 8, overflow: "hidden", flexShrink: 0, background: T.bg }}>
            <img src={a.cover_image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
        ) : (
          <div style={{ width: 80, height: 80, borderRadius: 8, flexShrink: 0, background: cat?.color || T.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28 }}>
            {cat?.icon || "📄"}
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 4 }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: T.text }}>{a.title}</span>
            {a.is_pinned && <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 8, background: "#FAEEDA", color: "#633806" }}>📌ピン</span>}
            {!a.is_published && <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 8, background: T.bg, color: T.textSub }}>下書き</span>}
            {latestUpdate && (
              <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 8, background: "#FAEEDA", color: "#854F0B" }}>
                ✏️{new Date(latestUpdate.created_at).toLocaleDateString("ja")}更新
              </span>
            )}
          </div>
          {cat && <span style={{ fontSize: 11, color: T.textSub }}>{cat.icon} {cat.name}</span>}
          {/* Tags */}
          {a.tags.length > 0 && (
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 4 }}>
              {a.tags.map(t => <span key={t} style={S.tag(t)}>{t}</span>)}
            </div>
          )}
          {latestUpdate && <div style={{ fontSize: 11, color: T.textSub, marginTop: 4 }}>💬 {latestUpdate.summary}</div>}
          <div style={{ display: "flex", gap: 8, marginTop: 6, fontSize: 11, color: T.textMuted, alignItems: "center" }}>
            <span>👁 {a.view_count}</span>
            <span>{new Date(a.created_at).toLocaleDateString("ja")} 作成</span>
            {therapists.length > 0 && a.is_published && (() => {
              const readCount = allReads.filter(r => r.article_id === a.id).length;
              const total = therapists.length;
              const pct = total > 0 ? Math.round(readCount / total * 100) : 0;
              return (
                <span style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}
                  onClick={(e) => { e.stopPropagation(); setShowReadsFor(showReadsFor === a.id ? null : a.id); }}>
                  <span style={{ width: 40, height: 6, borderRadius: 3, background: T.border, overflow: "hidden", display: "inline-block" }}>
                    <span style={{ width: `${pct}%`, height: "100%", display: "block", borderRadius: 3, background: pct === 100 ? "#4a7c59" : "#e8849a" }} />
                  </span>
                  <span style={{ color: pct === 100 ? "#4a7c59" : T.textMuted }}>{readCount}/{total}人読了</span>
                </span>
              );
            })()}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, flexShrink: 0 }}>
          <button style={{ ...S.btn, padding: "4px 8px", fontSize: 11 }} title="上に移動"
            onClick={(e) => { e.stopPropagation(); moveArticle(a.id, "up"); }}>⬆</button>
          <button style={{ ...S.btn, padding: "4px 8px", fontSize: 11 }} title="下に移動"
            onClick={(e) => { e.stopPropagation(); moveArticle(a.id, "down"); }}>⬇</button>
          <button style={{ ...S.btn, padding: "4px 8px", fontSize: 11 }} title="複製"
            onClick={async (e) => {
              e.stopPropagation();
              const { data } = await supabase.from("manual_articles").insert({
                title: a.title + "（コピー）", category_id: a.category_id, content: a.content,
                cover_image: a.cover_image, tags: a.tags, is_published: false, is_pinned: false,
              }).select().single();
              if (data) { fetchData(); setMsg("📋 記事を複製しました"); }
            }}>📋</button>
          <button style={{ ...S.btn, padding: "4px 8px", fontSize: 11 }} title="削除"
            onClick={(e) => { e.stopPropagation(); deleteArticle(a.id); }}>🗑</button>
        </div>
      </div>
      {/* 閲覧状況パネル */}
      {showReadsFor === a.id && therapists.length > 0 && (
        <div style={{ ...S.card, marginTop: -8, borderTop: "none", borderTopLeftRadius: 0, borderTopRightRadius: 0, padding: "10px 16px" }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: T.text }}>📊 閲覧状況</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {therapists.map(th => {
              const read = allReads.find(r => r.article_id === a.id && r.therapist_id === th.id);
              return (
                <span key={th.id} style={{
                  fontSize: 11, padding: "3px 10px", borderRadius: 12,
                  background: read ? "#E1F5EE" : (dark ? "#3a3a42" : "#f8f6f3"),
                  color: read ? "#085041" : T.textMuted, fontWeight: read ? 500 : 400,
                }}>
                  {read ? "✅" : "⬜"} {th.name}
                  {read && <span style={{ fontSize: 9, marginLeft: 4, opacity: 0.7 }}>{new Date(read.read_at).toLocaleDateString("ja")}</span>}
                </span>
              );
            })}
          </div>
        </div>
      )}
    </React.Fragment>);
  };

  // ── Update timeline ──
  const renderTimeline = () => updates.length > 0 ? (
    <div style={{ ...S.card, marginBottom: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: T.text }}>📝 最近の更新</div>
      {updates.slice(0, 5).map(u => {
        const art = articles.find(a => a.id === u.article_id);
        return (
          <div key={u.id} style={{ display: "flex", gap: 10, padding: "6px 0", borderBottom: `1px solid ${T.border}` }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: T.accent, marginTop: 5, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: T.text }}>{art?.title || "削除された記事"}</div>
              <div style={{ fontSize: 12, color: T.textSub }}>{u.summary}</div>
              <div style={{ fontSize: 11, color: T.textMuted }}>{u.updated_by} · {new Date(u.created_at).toLocaleString("ja")}</div>
            </div>
          </div>
        );
      })}
    </div>
  ) : null;

  // ── Ranking ──
  const renderRanking = () => {
    const published = articles.filter(a => a.is_published && a.view_count > 0);
    if (published.length === 0) return null;
    const ranked = [...published].sort((a, b) => b.view_count - a.view_count).slice(0, 5);
    const medals = ["🥇", "🥈", "🥉", "4", "5"];
    // 読まれていない記事
    const unread = articles.filter(a => a.is_published).sort((a, b) => a.view_count - b.view_count).slice(0, 3).filter(a => a.view_count < 3);

    return (
      <div style={{ display: "grid", gridTemplateColumns: unread.length > 0 ? "1fr 1fr" : "1fr", gap: 12, marginBottom: 16 }}>
        <div style={S.card}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: T.text }}>🏆 よく読まれている記事</div>
          {ranked.map((a, i) => (
            <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", borderBottom: i < ranked.length - 1 ? `1px solid ${T.border}` : "none" }}>
              <span style={{ fontSize: i < 3 ? 16 : 12, width: 24, textAlign: "center", color: i >= 3 ? T.textMuted : undefined }}>{medals[i]}</span>
              <span style={{ flex: 1, fontSize: 12, fontWeight: 500, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{a.title}</span>
              <span style={{ fontSize: 11, color: T.textMuted }}>👁{a.view_count}</span>
            </div>
          ))}
        </div>
        {unread.length > 0 && (
          <div style={S.card}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: "#c45555" }}>⚠️ あまり読まれていない記事</div>
            {unread.map(a => {
              const readCount = allReads.filter(r => r.article_id === a.id).length;
              return (
                <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", borderBottom: `1px solid ${T.border}` }}>
                  <span style={{ flex: 1, fontSize: 12, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{a.title}</span>
                  <span style={{ fontSize: 11, color: "#c45555" }}>{readCount}/{therapists.length}人</span>
                </div>
              );
            })}
            <div style={{ fontSize: 10, color: T.textMuted, marginTop: 6 }}>📌 ピン留めや更新通知で閲覧を促しましょう</div>
          </div>
        )}
      </div>
    );
  };

  // ── EDITOR VIEW ──
  const renderEditor = () => (
    <div style={S.content}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <button style={S.btn} onClick={() => setView("list")}>← 戻る</button>
        <div style={{ fontSize: 16, fontWeight: 600 }}>{editArticle ? "📝 記事を編集" : "✨ 新しい記事"}</div>
        <button style={S.btnAccent} onClick={saveArticle} disabled={saving}>{saving ? "保存中..." : "💾 保存"}</button>
      </div>
      {msg && <div style={{ padding: 10, borderRadius: 8, background: msg.includes("✅") ? "#E1F5EE" : "#FBEAF0", color: msg.includes("✅") ? "#085041" : "#72243E", marginBottom: 12, fontSize: 13 }}>{msg}</div>}

      {/* Title */}
      <div style={S.card}>
        <label style={S.label}>タイトル</label>
        <input style={S.input} value={editTitle} onChange={e => setEditTitle(e.target.value)} placeholder="記事タイトルを入力..." />
      </div>

      {/* Category + Publish + Pin */}
      <div style={{ ...S.card, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ flex: 1, minWidth: 140 }}>
          <label style={S.label}>カテゴリ</label>
          <select style={{ ...S.input, cursor: "pointer" }} value={editCategoryId || ""} onChange={e => setEditCategoryId(e.target.value ? Number(e.target.value) : null)}>
            <option value="">未分類</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
          </select>
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer", marginTop: 16 }}>
          <input type="checkbox" checked={editPublished} onChange={e => setEditPublished(e.target.checked)} />
          公開
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer", marginTop: 16 }}>
          <input type="checkbox" checked={editPinned} onChange={e => setEditPinned(e.target.checked)} />
          📌 ピン留め
        </label>
      </div>

      {/* Cover image */}
      <div style={S.card}>
        <label style={S.label}>📸 カバー画像</label>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div
            onDragOver={e => { preventDefaults(e); setDragOverCover(true); }}
            onDragEnter={e => { preventDefaults(e); setDragOverCover(true); }}
            onDragLeave={e => { preventDefaults(e); setDragOverCover(false); }}
            onDrop={handleCoverDrop}
            style={{ position: "relative" }}
          >
            {editCoverImage ? (
              <div style={{ position: "relative" }}>
                <img src={editCoverImage} alt="" style={{ width: 120, height: 80, objectFit: "cover", borderRadius: 8, border: dragOverCover ? "2px solid #e8849a" : "2px solid transparent" }} />
                <button style={{ position: "absolute", top: -6, right: -6, width: 20, height: 20, borderRadius: "50%", background: "#c45555", color: "#fff", border: "none", cursor: "pointer", fontSize: 10 }}
                  onClick={() => setEditCoverImage("")}>×</button>
                {dragOverCover && (
                  <div style={{ position: "absolute", inset: 0, background: "rgba(232,132,154,0.5)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ fontSize: 11, color: "#fff", fontWeight: 600 }}>変更</span>
                  </div>
                )}
              </div>
            ) : (
              <div style={{
                width: 120, height: 80, borderRadius: 8,
                border: dragOverCover ? "2px solid #e8849a" : `2px dashed ${T.border}`,
                background: dragOverCover ? "rgba(232,132,154,0.08)" : "transparent",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 12, color: dragOverCover ? "#e8849a" : T.textMuted, cursor: "pointer",
                transition: "all 0.2s",
              }}
                onClick={() => coverInputRef.current?.click()}>
                {dragOverCover ? "📸 ドロップ!" : "+ 画像を追加"}
              </div>
            )}
          </div>
          <input ref={coverInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleCoverUpload} />
          {editCoverImage && <button style={{ ...S.btn, fontSize: 11 }} onClick={() => coverInputRef.current?.click()}>変更</button>}
          <span style={{ fontSize: 10, color: T.textMuted }}>D&D対応</span>
        </div>
      </div>

      {/* Content */}
      <div style={S.card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 4 }}>
          <label style={{ ...S.label, margin: 0 }}>📝 本文</label>
          <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
            <button style={{ ...S.btn, padding: "2px 8px", fontSize: 11, background: !showPreview ? T.accent : T.card, color: !showPreview ? "#fff" : T.text }}
              onClick={() => setShowPreview(false)}>編集</button>
            <button style={{ ...S.btn, padding: "2px 8px", fontSize: 11, background: showPreview ? T.accent : T.card, color: showPreview ? "#fff" : T.text }}
              onClick={() => setShowPreview(true)}>👁 プレビュー</button>
            <span style={{ borderLeft: `1px solid ${T.border}`, margin: "0 2px" }} />
            <button style={{ ...S.btn, padding: "2px 8px", fontSize: 11 }} title="太字"
              onClick={() => setEditContent(prev => prev + "\n**太字テキスト**")}>B</button>
            <button style={{ ...S.btn, padding: "2px 8px", fontSize: 11 }} title="見出し"
              onClick={() => setEditContent(prev => prev + "\n## 見出し")}>H</button>
            <button style={{ ...S.btn, padding: "2px 8px", fontSize: 11 }} title="リスト"
              onClick={() => setEditContent(prev => prev + "\n- リスト項目")}>・</button>
            <button style={{ ...S.btn, padding: "2px 8px", fontSize: 11 }} title="番号リスト"
              onClick={() => setEditContent(prev => prev + "\n1. 項目")}>1.</button>
            <button style={{ ...S.btn, padding: "2px 8px", fontSize: 11 }} title="引用"
              onClick={() => setEditContent(prev => prev + "\n> 引用テキスト")}>❝</button>
            <button style={{ ...S.btn, padding: "2px 8px", fontSize: 11 }} title="区切り線"
              onClick={() => setEditContent(prev => prev + "\n---\n")}>―</button>
            <button style={{ ...S.btn, padding: "2px 8px", fontSize: 11 }} title="画像挿入"
              onClick={() => fileInputRef.current?.click()}>🖼</button>
            <button style={{ ...S.btn, padding: "2px 8px", fontSize: 11 }} title="YouTube"
              onClick={() => {
                const url = prompt("YouTubeのURLを貼り付けてください\n例: https://www.youtube.com/watch?v=XXXXX");
                if (url) {
                  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]+)/);
                  if (m) setEditContent(prev => prev + `\n[youtube:${m[1]}]\n`);
                  else alert("YouTubeのURLが正しくありません");
                }
              }}>▶</button>
            <button style={{ ...S.btn, padding: "2px 8px", fontSize: 11 }} title="Google Drive動画"
              onClick={() => {
                const url = prompt("Google DriveのURLを貼り付けてください\n例: https://drive.google.com/file/d/XXXXX/view");
                if (url) {
                  const m = url.match(/\/d\/([\w-]+)/);
                  if (m) {
                    const desc = prompt("動画の説明を入力してください\n例: タオルの畳み方の手順") || "";
                    setEditContent(prev => prev + `\n[gdrive:${m[1]}:${desc}]\n`);
                  } else alert("Google DriveのURLが正しくありません");
                }
              }}>📁</button>
            <span style={{ borderLeft: `1px solid ${T.border}`, margin: "0 2px" }} />
            <button style={{ ...S.btn, padding: "2px 8px", fontSize: 11 }} title="記事リンク"
              onClick={() => {
                const list = articles.map((a, i) => `${i + 1}. ${a.title}`).join("\n");
                const pick = prompt(`リンクする記事の番号を選んでください:\n\n${list}`);
                if (pick) {
                  const idx = parseInt(pick) - 1;
                  if (idx >= 0 && idx < articles.length) {
                    setEditContent(prev => prev + `[link:${articles[idx].title}]`);
                  }
                }
              }}>🔗</button>
            <button style={{ ...S.btn, padding: "2px 8px", fontSize: 11 }} title="カテゴリリンク"
              onClick={() => {
                const list = categories.map((c, i) => `${i + 1}. ${c.icon} ${c.name}`).join("\n");
                const pick = prompt(`リンクするカテゴリの番号を選んでください:\n\n${list}`);
                if (pick) {
                  const idx = parseInt(pick) - 1;
                  if (idx >= 0 && idx < categories.length) {
                    setEditContent(prev => prev + `[catlink:${categories[idx].name}]`);
                  }
                }
              }}>📂🔗</button>
          </div>
        </div>
        {showPreview ? (
          <div style={{ ...S.textarea, minHeight: 200, padding: 16, lineHeight: 1.8, overflow: "auto" }}>
            {editContent ? editContent.split("\n").map((line, i) => {
              if (line.startsWith("## ")) return <h3 key={i} style={{ fontSize: 16, fontWeight: 600, marginTop: 12, marginBottom: 4, color: "#e8849a" }}>{renderAdminInlineLinks(line.slice(3))}</h3>;
              if (line.startsWith("### ")) return <h4 key={i} style={{ fontSize: 14, fontWeight: 500, marginTop: 8, marginBottom: 4, color: T.accent }}>{renderAdminInlineLinks(line.slice(4))}</h4>;
              if (line.startsWith("- ")) return <div key={i} style={{ display: "flex", gap: 8, fontSize: 13, marginLeft: 8 }}><span style={{ color: "#e8849a" }}>●</span><span>{renderAdminInline(line.slice(2))}</span></div>;
              if (line.match(/^\d+\.\s/)) return <div key={i} style={{ display: "flex", gap: 8, fontSize: 13, marginLeft: 8 }}><span style={{ color: "#e8849a", fontWeight: 600, minWidth: 18 }}>{line.match(/^(\d+)\./)?.[1]}.</span><span>{renderAdminInline(line.replace(/^\d+\.\s/, ""))}</span></div>;
              if (line.startsWith("> ")) return <div key={i} style={{ borderLeft: "3px solid #e8849a", paddingLeft: 12, margin: "6px 0", fontSize: 13, color: T.textSub, fontStyle: "italic" }}>{renderAdminInline(line.slice(2))}</div>;
              if (line.trim() === "---") return <hr key={i} style={{ border: "none", borderTop: `1px solid ${T.border}`, margin: "12px 0" }} />;
              if (line.startsWith("![")) { const m = line.match(/!\[.*?\]\((.*?)\)/); if (m) return <img key={i} src={m[1]} alt="" style={{ maxWidth: "100%", borderRadius: 8, margin: "8px 0" }} />; }
              if (line.match(/^\[youtube:([\w-]+)\]$/)) { const vid = line.match(/^\[youtube:([\w-]+)\]$/)?.[1]; return <div key={i} style={{ position: "relative", paddingBottom: "56.25%", height: 0, margin: "8px 0", borderRadius: 8, overflow: "hidden" }}><iframe src={`https://www.youtube.com/embed/${vid}`} style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: "none" }} allowFullScreen /></div>; }
              if (line.match(/^\[gdrive:([\w-]+)(:.*)?\]$/)) { const gm = line.match(/^\[gdrive:([\w-]+)(?::(.+))?\]$/); const fid = gm?.[1]; const gdesc = gm?.[2] || ""; return <div key={i} style={{ margin: "12px 0" }}><div style={{ position: "relative", paddingBottom: "56.25%", height: 0, borderRadius: 8, overflow: "hidden" }}><iframe src={`https://drive.google.com/file/d/${fid}/preview`} style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: "none" }} allow="autoplay" /></div>{gdesc && <p style={{ fontSize: 12, color: "#e8849a", marginTop: 6, textAlign: "center", fontWeight: 500 }}>🎬 {gdesc}</p>}</div>; }
              if (line.match(/\*\*(.*?)\*\*/)) { return <p key={i} style={{ fontSize: 13 }}>{renderAdminInline(line)}</p>; }
              if (line.trim() === "") return <div key={i} style={{ height: 8 }} />;
              return <p key={i} style={{ fontSize: 13 }}>{renderAdminInline(line)}</p>;
            }) : <span style={{ color: T.textMuted, fontSize: 13 }}>プレビューする本文がありません</span>}
          </div>
        ) : (
          <div style={{ position: "relative" }}
            onDragOver={e => { preventDefaults(e); setDragOverEditor(true); }}
            onDragEnter={e => { preventDefaults(e); setDragOverEditor(true); }}
            onDragLeave={e => { preventDefaults(e); setDragOverEditor(false); }}
            onDrop={handleEditorDrop}
          >
            <textarea ref={editorRef as any} style={{
              ...S.textarea,
              border: dragOverEditor ? "2px solid #e8849a" : S.textarea.border,
              background: dragOverEditor ? "rgba(232,132,154,0.05)" : S.textarea.background,
              transition: "border 0.2s, background 0.2s",
            }} value={editContent} onChange={e => setEditContent(e.target.value)}
              onPaste={handleEditorPaste}
              placeholder={"マークダウン形式で記述できます。\n\n## 見出し\n**太字** / - リスト / 1. 番号リスト\n> 引用 / --- 区切り線\n![画像](URL) / [youtube:動画ID]\n\n📸 画像をドラッグ&ドロップ or Ctrl+Vで貼り付けできます"} />
            {dragOverEditor && (
              <div style={{
                position: "absolute", inset: 0, borderRadius: 8,
                background: "rgba(232,132,154,0.12)", border: "2px dashed #e8849a",
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                pointerEvents: "none", zIndex: 10,
              }}>
                <span style={{ fontSize: 32 }}>📸</span>
                <span style={{ fontSize: 14, color: "#e8849a", fontWeight: 600, marginTop: 4 }}>画像をここにドロップ</span>
                <span style={{ fontSize: 11, color: "#c87a8a", marginTop: 2 }}>複数ファイルOK</span>
              </div>
            )}
          </div>
        )}
        <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleInlineImage} />
        <div style={{ fontSize: 11, color: T.textMuted, marginTop: 4 }}>{"💡 ## 見出し / **太字** / - リスト / 1. 番号 / > 引用 / --- 区切り / ![画像](URL) / [youtube:ID] 🎬 / [gdrive:ID] 📁"}</div>
        <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>{"📸 画像: ドラッグ&ドロップ / Ctrl+V貼り付け / 🖼ボタン に対応"}</div>
        <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>{"🔗 [link:記事タイトル] で記事リンク / [catlink:カテゴリ名] でカテゴリリンク"}</div>
        {uploading && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6, padding: "6px 12px", background: "rgba(232,132,154,0.1)", borderRadius: 8, fontSize: 12, color: "#e8849a" }}>
            <span style={{ display: "inline-block", width: 14, height: 14, border: "2px solid #e8849a", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
            画像をアップロード中...
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}
        <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
          <button style={{ ...S.btn, fontSize: 11, opacity: aiLoading ? 0.5 : 1 }} disabled={!!aiLoading || !editContent.trim()}
            onClick={async () => {
              setAiLoading("cleanup");
              try {
                const res = await fetch("/api/manual-ai", {
                  method: "POST", headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ action: "cleanup", content: editContent }),
                });
                const data = await res.json();
                if (data.cleaned) { setEditContent(data.cleaned); setMsg("🤖 AI整理が完了しました！プレビューで確認してください"); setShowPreview(true); }
                else setMsg("⚠️ " + (data.error || "AI整理に失敗しました"));
              } catch (e) { setMsg("⚠️ AI通信エラー"); }
              setAiLoading("");
            }}>
            {aiLoading === "cleanup" ? "🤖 整理中..." : "🤖 AI整理"}
          </button>
        </div>
      </div>

      {/* Tags */}
      <div style={S.card}>
        <label style={S.label}>🏷️ タグ</label>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 8 }}>
          {editTags.map(t => (
            <span key={t} style={{ ...S.tag(t), cursor: "pointer" }} onClick={() => setEditTags(editTags.filter(x => x !== t))}>
              {t} ×
            </span>
          ))}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <input style={{ ...S.input, flex: 1 }} value={editTagInput}
            onChange={e => setEditTagInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
            placeholder="タグを入力してEnter..." />
          <button style={S.btn} onClick={addTag}>追加</button>
          <button style={{ ...S.btn, fontSize: 11, opacity: aiLoading ? 0.5 : 1 }} disabled={!!aiLoading || !editContent.trim()}
            onClick={async () => {
              setAiLoading("tags");
              try {
                const res = await fetch("/api/manual-ai", {
                  method: "POST", headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ action: "tags", content: editTitle + "\n" + editContent }),
                });
                const data = await res.json();
                if (data.tags) {
                  const newTags = data.tags.filter((t: string) => !editTags.includes(t));
                  setEditTags([...editTags, ...newTags]);
                  setMsg(`🏷️ ${newTags.length}個のタグを提案しました`);
                } else setMsg("⚠️ " + (data.error || "タグ生成に失敗"));
              } catch (e) { setMsg("⚠️ AI通信エラー"); }
              setAiLoading("");
            }}>
            {aiLoading === "tags" ? "🏷️ 生成中..." : "🏷️ AI提案"}
          </button>
        </div>
        {allTags.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <span style={{ fontSize: 11, color: T.textMuted }}>既存タグ: </span>
            {allTags.filter(t => !editTags.includes(t)).map(t => (
              <button key={t} style={{ ...S.tag(t), cursor: "pointer", border: "none", marginRight: 4 }}
                onClick={() => setEditTags([...editTags, t])}>{t}</button>
            ))}
          </div>
        )}
      </div>

      {/* Q&A */}
      <div style={S.card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <label style={{ ...S.label, margin: 0 }}>❓ Q&A ({editQAs.length}件)</label>
          <button style={S.btn} onClick={addQA}>+ Q&A追加</button>
        </div>
        {editQAs.map((qa, i) => (
          <div key={i} style={{ padding: 12, borderRadius: 8, border: `1px solid ${T.border}`, marginBottom: 8, background: T.bg }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 500, color: T.accent }}>Q{i + 1}</span>
              <button style={{ fontSize: 11, color: "#c45555", background: "none", border: "none", cursor: "pointer" }}
                onClick={() => removeQA(i)}>削除</button>
            </div>
            <input style={{ ...S.input, marginBottom: 6 }} value={qa.question}
              onChange={e => updateQA(i, "question", e.target.value)} placeholder="質問を入力..." />
            <textarea style={{ ...S.textarea, minHeight: 60 }} value={qa.answer}
              onChange={e => updateQA(i, "answer", e.target.value)} placeholder="回答を入力..." />
          </div>
        ))}
      </div>

      {/* Update memo (edit mode only) */}
      {editArticle && (
        <div style={S.card}>
          <label style={S.label}>✏️ 更新メモ（セラピストに表示されます）</label>
          <input style={S.input} value={editUpdateMemo}
            onChange={e => setEditUpdateMemo(e.target.value)}
            placeholder="例：トイレ掃除の手順を追加しました" />
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, cursor: "pointer", color: editResetReads ? "#c45555" : T.textSub }}>
              <input type="checkbox" checked={editResetReads} onChange={e => setEditResetReads(e.target.checked)} />
              🔄 既読をリセット（全員に再度「更新」バッジを表示）
            </label>
          </div>
          <div style={{ fontSize: 11, color: T.textMuted, marginTop: 4 }}>更新メモを入力するとタイムラインに記録されます。大きな変更の場合は既読リセットを推奨。</div>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
        <button style={S.btn} onClick={() => setView("list")}>キャンセル</button>
        <button style={S.btnAccent} onClick={saveArticle} disabled={saving}>{saving ? "保存中..." : "💾 保存"}</button>
      </div>
    </div>
  );

  // ── CATEGORY MANAGER ──
  const renderCategoryManager = () => (
    <div style={S.content}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <button style={S.btn} onClick={() => setView("list")}>← 戻る</button>
        <div style={{ fontSize: 16, fontWeight: 600 }}>📂 カテゴリ管理</div>
        <button style={S.btnAccent} onClick={() => {
          setEditCat(null); setCatName(""); setCatIcon("📄"); setCatColor("#FBEAF0"); setCatDesc("");
        }}>+ 追加</button>
      </div>

      {/* Category edit form */}
      {(editCat !== null || catName !== undefined) && (
        <div style={{ ...S.card, marginBottom: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label style={S.label}>アイコン</label>
              <input style={S.input} value={catIcon} onChange={e => setCatIcon(e.target.value)} placeholder="🌸" />
            </div>
            <div>
              <label style={S.label}>カラー</label>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <input type="color" value={catColor} onChange={e => setCatColor(e.target.value)} style={{ width: 36, height: 36, border: "none", cursor: "pointer" }} />
                <input style={{ ...S.input, flex: 1 }} value={catColor} onChange={e => setCatColor(e.target.value)} />
              </div>
            </div>
          </div>
          <div style={{ marginTop: 8 }}>
            <label style={S.label}>名前</label>
            <input style={S.input} value={catName} onChange={e => setCatName(e.target.value)} placeholder="カテゴリ名" />
          </div>
          <div style={{ marginTop: 8 }}>
            <label style={S.label}>説明</label>
            <input style={S.input} value={catDesc} onChange={e => setCatDesc(e.target.value)} placeholder="カテゴリの説明" />
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 10 }}>
            <button style={S.btn} onClick={() => setEditCat(null)}>キャンセル</button>
            <button style={S.btnAccent} onClick={saveCat}>保存</button>
          </div>
        </div>
      )}

      {/* Category list */}
      {categories.map(c => (
        <div key={c.id} style={{ ...S.card, display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 10, background: c.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>{c.icon}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{c.name}</div>
            <div style={{ fontSize: 12, color: T.textSub }}>{c.description}</div>
          </div>
          <span style={{ fontSize: 12, color: T.textMuted }}>{articles.filter(a => a.category_id === c.id).length}件</span>
          <button style={{ ...S.btn, padding: "4px 8px", fontSize: 11 }} onClick={() => {
            setEditCat(c); setCatName(c.name); setCatIcon(c.icon); setCatColor(c.color); setCatDesc(c.description);
          }}>✏️</button>
        </div>
      ))}
    </div>
  );

  // ── MAIN LIST VIEW ──
  const renderList = () => {
    const publishedArticles = articles.filter(a => a.is_published);
    const totalReadPairs = therapists.length * publishedArticles.length;
    const actualReads = totalReadPairs > 0 ? allReads.length : 0;
    const overallPct = totalReadPairs > 0 ? Math.round(actualReads / totalReadPairs * 100) : 0;

    return (
    <div style={S.content}>
      {/* 既読率サマリー */}
      {therapists.length > 0 && publishedArticles.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10, marginBottom: 16 }}>
          <div style={{ background: T.card, borderRadius: 12, padding: "12px 16px", border: `1px solid ${T.border}`, textAlign: "center" }}>
            <div style={{ fontSize: 10, color: T.textMuted, marginBottom: 4 }}>公開記事</div>
            <div style={{ fontSize: 22, fontWeight: 500, color: T.accent }}>{publishedArticles.length}</div>
          </div>
          <div style={{ background: T.card, borderRadius: 12, padding: "12px 16px", border: `1px solid ${T.border}`, textAlign: "center" }}>
            <div style={{ fontSize: 10, color: T.textMuted, marginBottom: 4 }}>セラピスト</div>
            <div style={{ fontSize: 22, fontWeight: 500, color: T.text }}>{therapists.length}名</div>
          </div>
          <div style={{ background: T.card, borderRadius: 12, padding: "12px 16px", border: `1px solid ${T.border}`, textAlign: "center" }}>
            <div style={{ fontSize: 10, color: T.textMuted, marginBottom: 4 }}>全体既読率</div>
            <div style={{ fontSize: 22, fontWeight: 500, color: overallPct >= 80 ? "#4a7c59" : overallPct >= 50 ? "#f59e0b" : "#c45555" }}>{overallPct}%</div>
            <div style={{ width: "100%", height: 4, borderRadius: 2, background: T.border, marginTop: 4, overflow: "hidden" }}>
              <div style={{ width: `${overallPct}%`, height: "100%", borderRadius: 2, background: overallPct >= 80 ? "#4a7c59" : overallPct >= 50 ? "#f59e0b" : "#c45555", transition: "width 0.5s" }} />
            </div>
          </div>
          <div style={{ background: T.card, borderRadius: 12, padding: "12px 16px", border: `1px solid ${T.border}`, textAlign: "center" }}>
            <div style={{ fontSize: 10, color: T.textMuted, marginBottom: 4 }}>総閲覧数</div>
            <div style={{ fontSize: 22, fontWeight: 500, color: T.text }}>{articles.reduce((s, a) => s + a.view_count, 0)}</div>
          </div>
        </div>
      )}

      {/* Top actions */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <input style={{ ...S.input, flex: 1, minWidth: 150 }} value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)} placeholder="🔍 記事を検索..." />
        <button style={S.btn} onClick={() => setView("categories")}>📂 カテゴリ管理</button>
        <button style={S.btn} onClick={() => setView("logs")}>🤖 AI質問ログ{aiLogs.length > 0 ? `(${aiLogs.length})` : ""}{aiLogs.filter(l => l.rating === -1).length > 0 ? ` 👎${aiLogs.filter(l => l.rating === -1).length}` : ""}</button>
        <button style={S.btnAccent} onClick={openNewArticle}>✨ 新規記事</button>
      </div>

      {/* Category tabs */}
      {renderCategoryTabs()}

      {/* Tag filter */}
      {renderTagFilter()}

      {/* Update timeline */}
      {renderTimeline()}

      {/* Ranking */}
      {renderRanking()}

      {/* Articles */}
      <div style={{ fontSize: 13, color: T.textSub, marginBottom: 8 }}>
        {filteredArticles.length}件の記事
        {selectedCat !== null && ` (${getCatName(selectedCat)?.icon} ${getCatName(selectedCat)?.name})`}
      </div>

      {/* Pinned first */}
      {filteredArticles.filter(a => a.is_pinned).map(renderArticleCard)}
      {filteredArticles.filter(a => !a.is_pinned).map(renderArticleCard)}

      {filteredArticles.length === 0 && (
        <div style={{ textAlign: "center", padding: 40, color: T.textMuted }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>📖</div>
          <div style={{ fontSize: 14 }}>記事がありません</div>
          <button style={{ ...S.btnAccent, marginTop: 12 }} onClick={openNewArticle}>✨ 最初の記事を作成</button>
        </div>
      )}
    </div>
    );
  };

  return (
    <div style={S.page}>
      <div style={S.header}>
        <NavMenu T={T} />
        <span style={S.headerTitle}>📖 マニュアル管理</span>
        <button style={{ ...S.btn, padding: "4px 8px" }} onClick={toggle}>{dark ? "☀️" : "🌙"}</button>
      </div>
      {view === "list" && renderList()}
      {view === "edit" && renderEditor()}
      {view === "categories" && renderCategoryManager()}
      {view === "logs" && (
        <div style={S.content}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div style={{ fontSize: 16, fontWeight: 600 }}>🤖 AI質問ログ</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button style={S.btn} onClick={async () => {
                if (confirm("全ログを削除しますか？")) {
                  await supabase.from("manual_ai_logs").delete().neq("id", 0);
                  fetchData();
                }
              }}>🗑️ 全削除</button>
              <button style={S.btn} onClick={() => setView("list")}>← 戻る</button>
            </div>
          </div>
          {/* 統計 */}
          {aiLogs.length > 0 && (
            <div style={{ ...S.card, marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>📊 質問統計</div>
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 12 }}>
                <span>📝 総質問数: <strong>{aiLogs.length}</strong></span>
                <span>👤 質問者数: <strong>{new Set(aiLogs.map(l => l.therapist_name).filter(Boolean)).size}</strong>人</span>
                <span>📅 直近: {aiLogs[0] ? new Date(aiLogs[0].created_at).toLocaleDateString("ja") : "-"}</span>
              </div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: 12, marginTop: 8 }}>
                <span>👍 高評価: <strong style={{ color: "#22c55e" }}>{aiLogs.filter(l => l.rating === 1).length}</strong></span>
                <span>👎 低評価: <strong style={{ color: "#ef4444" }}>{aiLogs.filter(l => l.rating === -1).length}</strong></span>
                <span>⚪ 未評価: <strong>{aiLogs.filter(l => !l.rating).length}</strong></span>
              </div>
              {/* よく聞かれるキーワード */}
              {(() => {
                const words: Record<string, number> = {};
                aiLogs.forEach(l => {
                  const q = l.question.toLowerCase();
                  ["精算", "清掃", "シフト", "給料", "施術", "予約", "鍵", "釣銭", "タオル", "ベッド", "LAST", "NG", "遅刻", "外出", "音楽", "喫煙", "コース", "マイページ"].forEach(w => {
                    if (q.includes(w.toLowerCase())) words[w] = (words[w] || 0) + 1;
                  });
                });
                const sorted = Object.entries(words).sort((a, b) => b[1] - a[1]);
                if (sorted.length === 0) return null;
                return (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontSize: 11, color: T.textSub, marginBottom: 4 }}>🔥 よく聞かれるキーワード</div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {sorted.slice(0, 8).map(([w, c]) => (
                        <span key={w} style={{ fontSize: 11, padding: "2px 10px", borderRadius: 12, background: "#e8849a20", color: "#e8849a", fontWeight: 600 }}>{w} ({c})</span>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
          {/* フィルタータブ */}
          <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
            {([["all", "📋 すべて"], ["bad", "👎 低評価"], ["good", "👍 高評価"], ["unrated", "⚪ 未評価"]] as const).map(([key, label]) => (
              <button key={key} onClick={() => setAiLogFilter(key)} style={{
                ...S.btn,
                background: aiLogFilter === key ? (key === "bad" ? "#ef444420" : key === "good" ? "#22c55e20" : "#e8849a20") : undefined,
                borderColor: aiLogFilter === key ? (key === "bad" ? "#ef4444" : key === "good" ? "#22c55e" : "#e8849a") : undefined,
                color: aiLogFilter === key ? (key === "bad" ? "#ef4444" : key === "good" ? "#22c55e" : undefined) : undefined,
                fontWeight: aiLogFilter === key ? 600 : 400,
              }}>{label}</button>
            ))}
          </div>
          {/* ログ一覧 */}
          {(() => {
            const filtered = aiLogs.filter(l => {
              if (aiLogFilter === "bad") return l.rating === -1;
              if (aiLogFilter === "good") return l.rating === 1;
              if (aiLogFilter === "unrated") return !l.rating;
              return true;
            });
            if (filtered.length === 0) return (
              <div style={{ textAlign: "center", padding: 40, color: T.textMuted }}>
                <div style={{ fontSize: 40, marginBottom: 8 }}>{aiLogFilter === "bad" ? "👎" : aiLogFilter === "good" ? "👍" : "🤖"}</div>
                <div style={{ fontSize: 14 }}>{aiLogFilter === "all" && aiLogs.length === 0 ? "まだ質問ログがありません" : `${aiLogFilter === "bad" ? "低評価" : aiLogFilter === "good" ? "高評価" : aiLogFilter === "unrated" ? "未評価" : ""}のログはありません`}</div>
                {aiLogFilter === "all" && aiLogs.length === 0 && <div style={{ fontSize: 12, marginTop: 4 }}>セラピストがAIチャットで質問すると、ここに記録されます</div>}
              </div>
            );
            return (
              <div>
                {filtered.map(l => (
                  <div key={l.id} style={{ ...S.card, marginBottom: 8, padding: 12, borderLeft: l.rating === -1 ? "3px solid #ef4444" : l.rating === 1 ? "3px solid #22c55e" : undefined }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: "#e8849a" }}>👤 {l.therapist_name || "不明"}</span>
                        {l.rating === 1 && <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 8, background: "#22c55e20", color: "#22c55e", fontWeight: 600 }}>👍 良い</span>}
                        {l.rating === -1 && <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 8, background: "#ef444420", color: "#ef4444", fontWeight: 600 }}>👎 悪い</span>}
                      </div>
                      <span style={{ fontSize: 10, color: T.textMuted }}>{new Date(l.created_at).toLocaleString("ja")}</span>
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: T.text, marginBottom: 4 }}>Q: {l.question}</div>
                    <div style={{ fontSize: 11, color: T.textSub, lineHeight: 1.6, maxHeight: 80, overflow: "hidden" }}>A: {l.answer?.slice(0, 200)}{(l.answer?.length || 0) > 200 ? "..." : ""}</div>
                    {l.rating === -1 && (() => {
                      const matchedArticle = articles.find(a =>
                        l.answer?.includes(a.title) || l.question?.toLowerCase().split(/\s+/).some(w => w.length >= 2 && a.title.toLowerCase().includes(w))
                      );
                      return matchedArticle ? (
                        <button onClick={() => { setEditArticle(matchedArticle); setView("edit"); }} style={{ ...S.btn, marginTop: 8, fontSize: 10, color: "#e8849a", borderColor: "#e8849a44" }}>
                          ✏️ 「{matchedArticle.title}」を編集
                        </button>
                      ) : (
                        <button onClick={() => { setEditArticle(null); setView("edit"); }} style={{ ...S.btn, marginTop: 8, fontSize: 10, color: "#f59e0b", borderColor: "#f59e0b44" }}>
                          ➕ 新規記事を作成
                        </button>
                      );
                    })()}
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
