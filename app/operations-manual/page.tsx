"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../../lib/supabase";
import { useTheme } from "../../lib/theme";
import { useBackNav } from "../../lib/use-back-nav";

type Category = { id: number; name: string; icon: string; sort_order: number };
type Article = { id: number; category_id: number; title: string; content: string; sort_order: number; created_at: string; updated_at: string };

export default function OperationsManual() {
  const { dark, T } = useTheme();
  const [categories, setCategories] = useState<Category[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [selectedCat, setSelectedCat] = useState<number | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [view, setView] = useState<"list" | "read" | "edit">("list");
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editCatId, setEditCatId] = useState<number>(0);
  const [editArticle, setEditArticle] = useState<Article | null>(null);
  const [search, setSearch] = useState("");
  const [msg, setMsg] = useState("");
  const [uploading, setUploading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // マウス戻るボタン対応: view → 前のページ
  useBackNav(view, setView);

  // ── 画像アップロード ──
  const uploadImage = async (file: File): Promise<string> => {
    const ext = file.name.split(".").pop() || "jpg";
    const name = `ops_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage.from("manual-images").upload(name, file, { contentType: file.type });
    if (error) { alert("画像アップロード失敗: " + error.message); return ""; }
    const { data } = supabase.storage.from("manual-images").getPublicUrl(name);
    return data.publicUrl;
  };

  const insertImageAtCursor = async (file: File) => {
    setUploading(true);
    const url = await uploadImage(file);
    if (url) {
      const img = `\n![スクリーンショット](${url})\n`;
      const ta = textareaRef.current;
      if (ta) {
        const pos = ta.selectionStart;
        setEditContent(prev => prev.slice(0, pos) + img + prev.slice(pos));
      } else {
        setEditContent(prev => prev + img);
      }
    }
    setUploading(false);
  };

  const fetchData = useCallback(async () => {
    const { data: cats } = await supabase.from("ops_manual_categories").select("*").order("sort_order");
    const { data: arts } = await supabase.from("ops_manual_articles").select("*").order("sort_order");
    if (cats) setCategories(cats);
    if (arts) setArticles(arts);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filteredArticles = articles.filter(a => {
    if (selectedCat && a.category_id !== selectedCat) return false;
    if (search) {
      const s = search.toLowerCase();
      return a.title.toLowerCase().includes(s) || a.content.toLowerCase().includes(s);
    }
    return true;
  });

  const getCat = (catId: number) => categories.find(c => c.id === catId);

  const saveArticle = async () => {
    if (!editTitle.trim()) return;
    const payload = { title: editTitle.trim(), content: editContent, category_id: editCatId || categories[0]?.id, updated_at: new Date().toISOString() };
    if (editArticle) {
      await supabase.from("ops_manual_articles").update(payload).eq("id", editArticle.id);
      setMsg("✅ 記事を更新しました");
    } else {
      await supabase.from("ops_manual_articles").insert({ ...payload, sort_order: articles.length });
      setMsg("✅ 記事を作成しました");
    }
    fetchData();
    setTimeout(() => { setView("list"); setMsg(""); }, 600);
  };

  const deleteArticle = async (id: number) => {
    if (!confirm("この記事を削除しますか？")) return;
    await supabase.from("ops_manual_articles").delete().eq("id", id);
    fetchData();
    setView("list");
  };

  const openEdit = (a?: Article) => {
    if (a) {
      setEditArticle(a);
      setEditTitle(a.title);
      setEditContent(a.content);
      setEditCatId(a.category_id);
    } else {
      setEditArticle(null);
      setEditTitle("");
      setEditContent("");
      setEditCatId(selectedCat || categories[0]?.id || 0);
    }
    setView("edit");
  };

  const openRead = (a: Article) => {
    setSelectedArticle(a);
    setView("read");
  };

  // ── インラインリンク処理 ──
  const renderInline = (text: string, lineKey: number) => {
    // [link:記事タイトル] と [テキスト](URL) を処理
    const parts: React.ReactNode[] = [];
    let remaining = text;
    let partIdx = 0;

    while (remaining.length > 0) {
      // [link:記事タイトル] パターン
      const linkMatch = remaining.match(/\[link:([^\]]+)\]/);
      // [テキスト](URL) パターン
      const urlMatch = remaining.match(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/);

      const linkPos = linkMatch ? remaining.indexOf(linkMatch[0]) : Infinity;
      const urlPos = urlMatch ? remaining.indexOf(urlMatch[0]) : Infinity;

      if (linkPos === Infinity && urlPos === Infinity) {
        parts.push(<span key={`${lineKey}-${partIdx}`}>{remaining}</span>);
        break;
      }

      if (linkPos <= urlPos && linkMatch) {
        // 記事内リンク
        if (linkPos > 0) parts.push(<span key={`${lineKey}-${partIdx++}`}>{remaining.slice(0, linkPos)}</span>);
        const title = linkMatch[1];
        const target = articles.find(a => a.title === title);
        parts.push(
          <span key={`${lineKey}-${partIdx++}`}
            onClick={(e) => { e.stopPropagation(); if (target) openRead(target); }}
            style={{ color: T.accent, textDecoration: "underline", cursor: target ? "pointer" : "default", fontWeight: 500, opacity: target ? 1 : 0.5 }}>
            📄 {title}
          </span>
        );
        remaining = remaining.slice(linkPos + linkMatch[0].length);
      } else if (urlMatch) {
        // 外部リンク
        if (urlPos > 0) parts.push(<span key={`${lineKey}-${partIdx++}`}>{remaining.slice(0, urlPos)}</span>);
        parts.push(
          <a key={`${lineKey}-${partIdx++}`} href={urlMatch[2]} target="_blank" rel="noopener noreferrer"
            style={{ color: "#3b82f6", textDecoration: "underline", cursor: "pointer" }}>
            🔗 {urlMatch[1]}
          </a>
        );
        remaining = remaining.slice(urlPos + urlMatch[0].length);
      }
    }
    return parts;
  };

  // ── マークダウン簡易レンダリング ──
  const renderContent = (text: string) => {
    return text.split("\n").map((line, i) => {
      if (line.startsWith("## ")) return <h2 key={i} style={{ fontSize: 17, fontWeight: 700, color: T.text, margin: "20px 0 10px", borderBottom: `2px solid ${T.accent}`, paddingBottom: 6 }}>{line.replace("## ", "")}</h2>;
      if (line.startsWith("### ")) return <h3 key={i} style={{ fontSize: 14, fontWeight: 600, color: T.text, margin: "16px 0 6px" }}>{line.replace("### ", "")}</h3>;
      if (/^!\[.*\]\(.*\)/.test(line)) {
        const match = line.match(/^!\[([^\]]*)\]\(([^)]+)\)/);
        if (match) return <div key={i} style={{ margin: "12px 0" }}><img src={match[2]} alt={match[1]} style={{ maxWidth: "100%", borderRadius: 8, border: `1px solid ${T.border}`, boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }} /></div>;
      }
      if (line.startsWith("・")) return <p key={i} style={{ fontSize: 13, color: T.text, margin: "3px 0", paddingLeft: 12, lineHeight: 1.8 }}>{renderInline(line, i)}</p>;
      if (/^[①②③④⑤⑥⑦⑧⑨⑩]/.test(line)) return <p key={i} style={{ fontSize: 13, color: T.text, margin: "4px 0", paddingLeft: 8, lineHeight: 1.8, fontWeight: 500 }}>{renderInline(line, i)}</p>;
      if (line.trim() === "") return <div key={i} style={{ height: 8 }} />;
      return <p key={i} style={{ fontSize: 13, color: T.textSub, lineHeight: 1.8, margin: "2px 0" }}>{renderInline(line, i)}</p>;
    });
  };

  const S = {
    sidebar: { width: 240, flexShrink: 0, borderRight: `1px solid ${T.border}`, padding: "16px 0", overflowY: "auto" as const, height: "calc(100vh - 56px)" },
    main: { flex: 1, padding: 24, overflowY: "auto" as const, height: "calc(100vh - 56px)" },
    catBtn: (active: boolean) => ({
      display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "10px 16px", border: "none",
      background: active ? (dark ? "#2a2a35" : "#f0ece6") : "transparent",
      color: active ? T.accent : T.textSub, fontSize: 13, cursor: "pointer", fontWeight: active ? 600 : 400,
      borderLeft: active ? `3px solid ${T.accent}` : "3px solid transparent", transition: "all 0.15s",
    } as React.CSSProperties),
    card: { padding: "16px 20px", borderRadius: 12, border: `1px solid ${T.border}`, backgroundColor: T.card, marginBottom: 8, cursor: "pointer", transition: "box-shadow 0.2s" } as React.CSSProperties,
    btn: { padding: "6px 14px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.card, color: T.text, fontSize: 12, cursor: "pointer" } as React.CSSProperties,
    btnAccent: { padding: "8px 18px", borderRadius: 8, border: "none", background: T.accent, color: "#fff", fontSize: 13, cursor: "pointer", fontWeight: 500 } as React.CSSProperties,
    input: { width: "100%", padding: "10px 14px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.cardAlt, color: T.text, fontSize: 13, outline: "none" } as React.CSSProperties,
    textarea: { width: "100%", padding: "12px 14px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.cardAlt, color: T.text, fontSize: 13, outline: "none", fontFamily: "monospace", lineHeight: 1.7, resize: "vertical" as const } as React.CSSProperties,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", backgroundColor: T.bg }}>
      {/* ヘッダー */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px", borderBottom: `1px solid ${T.border}`, backgroundColor: T.card }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <a href="/timechart" style={{ fontSize: 18, color: T.textSub, textDecoration: "none" }}>←</a>
          <span style={{ fontSize: 16, fontWeight: 700, color: T.text }}>📖 T-MANAGE 操作マニュアル</span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {view !== "list" && <button style={S.btn} onClick={() => { setView("list"); setSelectedArticle(null); }}>← 一覧に戻る</button>}
          {view === "list" && <button style={S.btnAccent} onClick={() => openEdit()}>✨ 新規記事</button>}
        </div>
      </div>

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* サイドバー */}
        <div style={S.sidebar}>
          <button style={S.catBtn(selectedCat === null)} onClick={() => { setSelectedCat(null); setView("list"); setSelectedArticle(null); }}>
            📋 すべて ({articles.length})
          </button>
          {categories.map(cat => {
            const count = articles.filter(a => a.category_id === cat.id).length;
            return (
              <button key={cat.id} style={S.catBtn(selectedCat === cat.id)} onClick={() => { setSelectedCat(cat.id); setView("list"); setSelectedArticle(null); }}>
                {cat.icon} {cat.name} ({count})
              </button>
            );
          })}
        </div>

        {/* メインコンテンツ */}
        <div style={S.main}>
          {msg && <div style={{ padding: "8px 16px", borderRadius: 8, background: "#4a7c5920", color: "#4a7c59", fontSize: 13, marginBottom: 12, fontWeight: 500 }}>{msg}</div>}

          {/* ── 記事一覧 ── */}
          {view === "list" && (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                <input
                  value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="🔍 記事を検索..."
                  style={{ ...S.input, maxWidth: 320 }}
                />
                <span style={{ fontSize: 13, color: T.textSub }}>{filteredArticles.length}件の記事</span>
              </div>

              {filteredArticles.length === 0 ? (
                <div style={{ textAlign: "center", padding: 60, color: T.textMuted }}>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>📖</div>
                  <div style={{ fontSize: 15, fontWeight: 500 }}>記事がありません</div>
                  <div style={{ fontSize: 12, marginTop: 4 }}>「✨ 新規記事」から操作手順を追加しましょう</div>
                </div>
              ) : (
                <div>
                  {(selectedCat ? categories.filter(c => c.id === selectedCat) : categories).map(cat => {
                    const catArticles = filteredArticles.filter(a => a.category_id === cat.id).sort((a, b) => a.sort_order - b.sort_order);
                    if (catArticles.length === 0) return null;
                    return (
                      <div key={cat.id} style={{ marginBottom: 24 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontSize: 18 }}>{cat.icon}</span> {cat.name}
                        </div>
                        {catArticles.map((a, idx) => (
                          <div key={a.id} style={S.card} onClick={() => openRead(a)}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                <span style={{ fontSize: 12, fontWeight: 700, color: T.accent, width: 24, height: 24, borderRadius: "50%", background: dark ? "#2a2a35" : "#f0ece6", display: "flex", alignItems: "center", justifyContent: "center" }}>{idx + 1}</span>
                                <span style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{a.title}</span>
                              </div>
                              <div style={{ display: "flex", gap: 6 }}>
                                <button style={{ ...S.btn, fontSize: 11, padding: "4px 10px" }} onClick={(e) => { e.stopPropagation(); openEdit(a); }}>✏️ 編集</button>
                                <button style={{ ...S.btn, fontSize: 11, padding: "4px 10px", color: "#c45555", borderColor: "#c4555544" }} onClick={(e) => { e.stopPropagation(); deleteArticle(a.id); }}>🗑</button>
                              </div>
                            </div>
                            <p style={{ fontSize: 12, color: T.textSub, marginTop: 6, lineHeight: 1.5 }}>
                              {a.content.replace(/##?\s/g, "").replace(/\n/g, " ").slice(0, 100)}...
                            </p>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── 記事閲覧 ── */}
          {view === "read" && selectedArticle && (
            <div style={{ maxWidth: 720 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                {(() => { const cat = getCat(selectedArticle.category_id); return cat ? <span style={{ fontSize: 12, padding: "2px 10px", borderRadius: 8, background: dark ? "#2a2a35" : "#f0ece6", color: T.accent, fontWeight: 500 }}>{cat.icon} {cat.name}</span> : null; })()}
              </div>
              <h1 style={{ fontSize: 22, fontWeight: 700, color: T.text, marginBottom: 16 }}>{selectedArticle.title}</h1>
              <div style={{ padding: "20px 24px", borderRadius: 12, border: `1px solid ${T.border}`, backgroundColor: T.card }}>
                {renderContent(selectedArticle.content)}
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                <button style={S.btnAccent} onClick={() => openEdit(selectedArticle)}>✏️ この記事を編集</button>
                {(() => {
                  const catArts = articles.filter(a => a.category_id === selectedArticle.category_id).sort((a, b) => a.sort_order - b.sort_order);
                  const idx = catArts.findIndex(a => a.id === selectedArticle.id);
                  const next = catArts[idx + 1];
                  return next ? <button style={S.btn} onClick={() => openRead(next)}>次へ: {next.title} →</button> : null;
                })()}
              </div>
            </div>
          )}

          {/* ── 記事編集 ── */}
          {view === "edit" && (
            <div style={{ maxWidth: 720 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: T.text, marginBottom: 16 }}>{editArticle ? "📝 記事を編集" : "✨ 新しい記事"}</h2>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, color: T.textSub, marginBottom: 4, display: "block" }}>カテゴリ</label>
                <select value={editCatId} onChange={e => setEditCatId(Number(e.target.value))} style={S.input}>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                </select>
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, color: T.textSub, marginBottom: 4, display: "block" }}>タイトル</label>
                <input value={editTitle} onChange={e => setEditTitle(e.target.value)} placeholder="例: 予約の新規登録" style={S.input} />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, color: T.textSub, marginBottom: 4, display: "block" }}>
                  内容（マークダウン: ## 大見出し / ### 小見出し / ①②③ 手順 / ・箇条書き / ![説明](URL) 画像）
                </label>
                <div style={{ display: "flex", gap: 6, marginBottom: 6, flexWrap: "wrap" }}>
                  <input type="file" ref={fileInputRef} accept="image/*" style={{ display: "none" }} onChange={async (e) => { const f = e.target.files?.[0]; if (f) await insertImageAtCursor(f); e.target.value = ""; }} />
                  <button style={{ ...S.btn, fontSize: 11, padding: "4px 12px" }} onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                    {uploading ? "⏳ アップロード中..." : "📷 画像"}
                  </button>
                  <button style={{ ...S.btn, fontSize: 11, padding: "4px 12px" }} onClick={() => {
                    const title = prompt("リンク先の記事タイトルを入力してください：", "");
                    if (title) {
                      const tag = `[link:${title}]`;
                      const ta = textareaRef.current;
                      if (ta) { const pos = ta.selectionStart; setEditContent(prev => prev.slice(0, pos) + tag + prev.slice(pos)); }
                      else setEditContent(prev => prev + tag);
                    }
                  }}>📄 記事リンク</button>
                  <button style={{ ...S.btn, fontSize: 11, padding: "4px 12px" }} onClick={() => {
                    const text = prompt("リンクテキスト：", "");
                    const url = prompt("URL：", "https://");
                    if (text && url) {
                      const tag = `[${text}](${url})`;
                      const ta = textareaRef.current;
                      if (ta) { const pos = ta.selectionStart; setEditContent(prev => prev.slice(0, pos) + tag + prev.slice(pos)); }
                      else setEditContent(prev => prev + tag);
                    }
                  }}>🔗 外部リンク</button>
                  <span style={{ fontSize: 10, color: T.textMuted, alignSelf: "center" }}>Ctrl+Vで画像貼り付けOK</span>
                </div>
                <textarea
                  ref={textareaRef}
                  value={editContent}
                  onChange={e => setEditContent(e.target.value)}
                  onPaste={async (e) => {
                    const items = e.clipboardData?.items;
                    if (!items) return;
                    for (const item of Array.from(items)) {
                      if (item.type.startsWith("image/")) {
                        e.preventDefault();
                        const file = item.getAsFile();
                        if (file) await insertImageAtCursor(file);
                        return;
                      }
                    }
                  }}
                  onDrop={async (e) => {
                    e.preventDefault();
                    const files = e.dataTransfer?.files;
                    if (!files) return;
                    for (const file of Array.from(files)) {
                      if (file.type.startsWith("image/")) {
                        await insertImageAtCursor(file);
                      }
                    }
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  style={{ ...S.textarea, minHeight: 400 }}
                />
              </div>
              {editContent && (
                <details style={{ marginBottom: 16 }}>
                  <summary style={{ fontSize: 12, color: T.textSub, cursor: "pointer", marginBottom: 8 }}>👁 プレビュー</summary>
                  <div style={{ padding: "16px 20px", borderRadius: 12, border: `1px solid ${T.border}`, backgroundColor: T.card }}>
                    {renderContent(editContent)}
                  </div>
                </details>
              )}
              <div style={{ display: "flex", gap: 8 }}>
                <button style={S.btnAccent} onClick={saveArticle}>💾 保存</button>
                <button style={S.btn} onClick={() => setView("list")}>キャンセル</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
