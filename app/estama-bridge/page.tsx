"use client";

import { useState, useEffect } from "react";

export default function EstamaBridge() {
  const [postData, setPostData] = useState<{
    room: string; title: string; content: string; estamaId: string; estamaPw: string; imageUrls?: string[];
  } | null>(null);
  const [status, setStatus] = useState("読み込み中...");
  const [copied, setCopied] = useState<"title" | "content" | null>(null);

  useEffect(() => {
    // localStorageからデータ読み込み
    try {
      const raw = localStorage.getItem("estama_post_data");
      if (raw) {
        const data = JSON.parse(raw);
        setPostData(data);
        setStatus("⏳ 拡張機能を確認中...");
        // 拡張機能がなくても3秒後に手動モードに切り替え
        setTimeout(() => {
          setStatus("拡張機能が検出されませんでした。手動で投稿してください。");
        }, 3000);
      } else {
        setStatus("投稿データがありません。速報パネルからやり直してください。");
      }
    } catch (e) {
      setStatus("データの読み込みに失敗しました。");
    }
  }, []);

  if (!postData) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0f0f0f", color: "#999", fontFamily: "system-ui" }}>
        <div style={{ textAlign: "center" }}>
          <p style={{ fontSize: 48, marginBottom: 16 }}>💅</p>
          <p style={{ fontSize: 16 }}>{status}</p>
        </div>
      </div>
    );
  }

  const roomName = postData.room === "toyohashi" ? "豊橋ルーム" : "三河安城ルーム";

  return (
    <div style={{ minHeight: "100vh", background: "#0f0f0f", color: "#e0e0e0", fontFamily: "system-ui", padding: 24 }}>
      {/* 拡張機能用データ要素（非表示） */}
      <div
        id="estama-bridge-data"
        data-room={postData.room}
        data-title={postData.title}
        data-content={postData.content}
        data-estama-id={postData.estamaId}
        data-estama-pw={postData.estamaPw}
        data-image-urls={JSON.stringify(postData.imageUrls || [])}
        style={{ display: "none" }}
      />

      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <p style={{ fontSize: 48, marginBottom: 8 }}>💅</p>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "#ec4899" }}>エステ魂投稿ブリッジ</h1>
          <p id="estama-bridge-status" style={{ fontSize: 13, color: "#888", marginTop: 8 }}>{status}</p>
        </div>

        {/* 投稿プレビュー */}
        <div style={{ background: "#1a1a1a", borderRadius: 16, padding: 20, marginBottom: 24, border: "1px solid #333" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <span style={{ fontSize: 12, background: "#ec489920", color: "#ec4899", padding: "4px 12px", borderRadius: 8 }}>{roomName}</span>
          </div>

          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>タイトル</p>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: "#e0e0e0", flex: 1 }}>{postData.title}</p>
              <button
                onClick={() => { navigator.clipboard.writeText(postData.title); setCopied("title"); setTimeout(() => setCopied(null), 2000); }}
                style={{ background: copied === "title" ? "#22c55e20" : "#333", color: copied === "title" ? "#22c55e" : "#aaa", border: "none", padding: "6px 12px", borderRadius: 8, fontSize: 11, cursor: "pointer", whiteSpace: "nowrap" }}
              >
                {copied === "title" ? "✅ コピー済" : "📋 コピー"}
              </button>
            </div>
          </div>

          <div>
            <p style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>本文</p>
            <div style={{ display: "flex", gap: 8 }}>
              <pre style={{ fontSize: 12, color: "#ccc", whiteSpace: "pre-wrap", lineHeight: 1.6, flex: 1, margin: 0, background: "#111", padding: 12, borderRadius: 8, maxHeight: 300, overflow: "auto" }}>
                {postData.content}
              </pre>
              <button
                onClick={() => { navigator.clipboard.writeText(postData.content); setCopied("content"); setTimeout(() => setCopied(null), 2000); }}
                style={{ background: copied === "content" ? "#22c55e20" : "#333", color: copied === "content" ? "#22c55e" : "#aaa", border: "none", padding: "6px 12px", borderRadius: 8, fontSize: 11, cursor: "pointer", whiteSpace: "nowrap", alignSelf: "flex-start" }}
              >
                {copied === "content" ? "✅ コピー済" : "📋 コピー"}
              </button>
            </div>
          </div>
        </div>

        {/* 手動投稿ガイド */}
        <div style={{ background: "#1a1a1a", borderRadius: 16, padding: 20, border: "1px solid #333" }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: "#ec4899", marginBottom: 12 }}>📝 手動投稿の手順</p>
          <div style={{ fontSize: 12, color: "#aaa", lineHeight: 2 }}>
            <p>① 上のタイトルと本文をそれぞれコピー</p>
            <p>② 下のボタンからエステ魂の投稿ページを開く</p>
            <p>③ カテゴリ「ご案内状況」を選択</p>
            <p>④ タイトル・本文をペースト</p>
            <p>⑤ 設置ボタン「公式HP」、投稿日時「すぐ公開」を選択</p>
            <p>⑥ 投稿ボタンをクリック</p>
          </div>
          <a
            href="https://estama.jp/admin/blog_edit/"
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: "block", textAlign: "center", background: "linear-gradient(135deg, #ec4899, #a855f7)", color: "white", padding: "14px 24px", borderRadius: 12, fontSize: 14, fontWeight: 600, textDecoration: "none", marginTop: 16 }}
          >
            💅 エステ魂を開く
          </a>
        </div>

        <p style={{ textAlign: "center", fontSize: 11, color: "#555", marginTop: 24 }}>
          💡 拡張機能をインストールすると自動で入力されます（システム設定 → リアルタイム速報）
        </p>
      </div>
    </div>
  );
}
