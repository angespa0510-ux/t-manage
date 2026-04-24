"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "../lib/supabase";

/**
 * ═══════════════════════════════════════════════════════════
 * セラピストマイページ用チャットタブ
 *
 * スタッフとのメッセージやり取り。スタッフ側の管理画面
 * (app/chat) と同じテーブルを共有する。
 *
 * カラム命名は SQL (session62_chat_system.sql) と app/chat/page.tsx に
 * 準拠：participant_type / sender_type / content / is_deleted / is_archived
 *
 * 方針:
 *   - セラピストは「自分がparticipantsに含まれている会話」のみ表示
 *   - 新規会話の作成は不可（スタッフ側から開始）
 *   - メッセージ送信・既読管理・Realtime購読は可能
 *   - AI支援（translate/polite/draft など）は /api/chat-ai を利用
 * ═══════════════════════════════════════════════════════════
 */

type Conversation = {
  id: number;
  type: "dm" | "group" | "broadcast";
  name: string;
  last_message_at: string;
  last_message_preview: string;
  is_archived: boolean;
  updated_at: string;
};

type Participant = {
  id: number;
  conversation_id: number;
  participant_type: "staff" | "therapist";
  participant_id: number;
  display_name: string;
  last_read_message_id: number;
  last_read_at: string | null;
};

type Message = {
  id: number;
  conversation_id: number;
  sender_type: "staff" | "therapist" | "ai" | "system";
  sender_id: number | null;
  sender_name: string;
  content: string;
  message_type: string;
  attachment_url: string | null;
  attachment_type: string | null;
  created_at: string;
  is_deleted: boolean;
};

type Staff = { id: number; name: string };

type MyPageTheme = {
  bg: string;
  card: string;
  cardAlt: string;
  border: string;
  accent: string;
  accentBg: string;
  accentDeep: string;
  text: string;
  textSub: string;
  textMuted: string;
  textFaint: string;
};

type Props = {
  therapistId: number;
  therapistName: string;
  C: MyPageTheme;
  FONT_SERIF: string;
};

const fmtDateTime = (iso: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  if (sameDay) return `${hh}:${mm}`;
  return `${d.getMonth() + 1}/${d.getDate()} ${hh}:${mm}`;
};

export default function TherapistChatTab({
  therapistId,
  therapistName,
  C,
  FONT_SERIF,
}: Props) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [participantsAll, setParticipantsAll] = useState<Participant[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [translateLang, setTranslateLang] = useState("ja");
  const scrollRef = useRef<HTMLDivElement | null>(null);
  // 添付ファイル
  const [pendingAttachment, setPendingAttachment] = useState<File | null>(null);
  const [pendingPreviewUrl, setPendingPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // 会話一覧取得
  const loadConversations = useCallback(async () => {
    // 自分がparticipantsにいる会話ID
    const pResp = await supabase
      .from("chat_participants")
      .select("*")
      .eq("participant_type", "therapist")
      .eq("participant_id", therapistId);
    const myPart: Participant[] = pResp.data || [];
    const convIds = myPart.map((p) => p.conversation_id);
    if (convIds.length === 0) {
      setConversations([]);
      setParticipantsAll([]);
      return;
    }
    const [cResp, pAllResp, sResp] = await Promise.all([
      supabase
        .from("chat_conversations")
        .select("*")
        .in("id", convIds)
        .eq("is_archived", false)
        .order("last_message_at", { ascending: false, nullsFirst: false }),
      supabase.from("chat_participants").select("*").in("conversation_id", convIds),
      supabase.from("staff").select("id,name"),
    ]);
    setConversations(cResp.data || []);
    setParticipantsAll(pAllResp.data || []);
    setStaffList(sResp.data || []);
  }, [therapistId]);

  useEffect(() => {
    loadConversations();
    const ch = supabase
      .channel(`therapist_chat_conv_${therapistId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_conversations" },
        () => loadConversations(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [therapistId, loadConversations]);

  // メッセージ取得 + Realtime
  useEffect(() => {
    if (!selected) {
      setMessages([]);
      return;
    }
    (async () => {
      const mResp = await supabase
        .from("chat_messages")
        .select("*")
        .eq("conversation_id", selected)
        .eq("is_deleted", false)
        .order("created_at", { ascending: true })
        .limit(500);
      const msgArr: Message[] = mResp.data || [];
      setMessages(msgArr);
      const last = msgArr.length > 0 ? msgArr[msgArr.length - 1] : null;
      if (last) {
        await supabase
          .from("chat_participants")
          .update({
            last_read_message_id: last.id,
            last_read_at: new Date().toISOString(),
          })
          .eq("conversation_id", selected)
          .eq("participant_type", "therapist")
          .eq("participant_id", therapistId);
      }
    })();

    const ch = supabase
      .channel(`therapist_chat_msgs_${selected}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `conversation_id=eq.${selected}`,
        },
        (payload: { new: Message }) => {
          const m = payload.new as Message;
          setMessages((prev) =>
            prev.find((x) => x.id === m.id) ? prev : [...prev, m],
          );
          supabase
            .from("chat_participants")
            .update({
              last_read_message_id: m.id,
              last_read_at: new Date().toISOString(),
            })
            .eq("conversation_id", selected)
            .eq("participant_type", "therapist")
            .eq("participant_id", therapistId);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [selected, therapistId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const send = useCallback(async () => {
    if ((!input.trim() && !pendingAttachment) || !selected || sending) return;
    setSending(true);
    const content = input.trim();

    // 添付アップロード
    let attachmentUrl: string | null = null;
    let attachmentType: string | null = null;
    if (pendingAttachment) {
      setUploading(true);
      const ext = pendingAttachment.name.split(".").pop() || "bin";
      const timestamp = Date.now();
      const rand = Math.random().toString(36).slice(2, 8);
      const path = `conv-${selected}/${timestamp}-${rand}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("chat-attachments")
        .upload(path, pendingAttachment, {
          cacheControl: "3600",
          upsert: false,
          contentType: pendingAttachment.type,
        });
      if (upErr) {
        alert("添付のアップロードに失敗しました: " + upErr.message);
        setUploading(false);
        setSending(false);
        return;
      }
      const { data: urlData } = supabase.storage.from("chat-attachments").getPublicUrl(path);
      attachmentUrl = urlData.publicUrl;
      attachmentType = pendingAttachment.type;
      // 15日後削除のため記録
      await supabase.from("chat_attachments").insert({
        conversation_id: selected,
        storage_path: path,
        file_url: attachmentUrl,
        file_type: attachmentType,
        file_size: pendingAttachment.size,
        uploaded_by_type: "therapist",
        uploaded_by_id: therapistId,
        expires_at: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
      });
      setUploading(false);
    }

    setInput("");
    const { data: inserted } = await supabase
      .from("chat_messages")
      .insert({
        conversation_id: selected,
        sender_type: "therapist",
        sender_id: therapistId,
        sender_name: therapistName,
        content,
        message_type: attachmentUrl
          ? attachmentType?.startsWith("image/")
            ? "image"
            : attachmentType?.startsWith("video/")
            ? "video"
            : "file"
          : "text",
        attachment_url: attachmentUrl,
        attachment_type: attachmentType,
      })
      .select()
      .single();
    if (inserted) {
      const preview = content
        ? content.slice(0, 80)
        : attachmentType?.startsWith("image/")
        ? "📷 画像を送信"
        : attachmentType?.startsWith("video/")
        ? "🎬 動画を送信"
        : "📎 ファイル";
      await supabase
        .from("chat_conversations")
        .update({
          last_message_at: new Date().toISOString(),
          last_message_preview: preview,
          updated_at: new Date().toISOString(),
        })
        .eq("id", selected);
    }
    // 添付クリア
    if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl);
    setPendingAttachment(null);
    setPendingPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setSending(false);
  }, [input, selected, sending, therapistId, therapistName, pendingAttachment, pendingPreviewUrl]);

  // ファイル選択
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const MAX_SIZE = 30 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      alert(`ファイルサイズが大きすぎます（上限 30MB、現在 ${(file.size / 1024 / 1024).toFixed(1)}MB）`);
      e.target.value = "";
      return;
    }
    if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
      alert("画像または動画を選んでください");
      e.target.value = "";
      return;
    }
    if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl);
    setPendingAttachment(file);
    setPendingPreviewUrl(URL.createObjectURL(file));
  };

  const clearAttachment = () => {
    if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl);
    setPendingAttachment(null);
    setPendingPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const callAI = useCallback(
    async (
      feature: "polite" | "translate" | "draft" | "summarize" | "ng_check",
    ) => {
      if (aiBusy) return;
      setAiBusy(true);
      try {
        const res = await fetch("/api/chat-ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            feature,
            input:
              input ||
              (feature === "summarize"
                ? messages
                    .slice(-20)
                    .map((m) => `${m.sender_name || ""}: ${m.content}`)
                    .join("\n")
                : ""),
            // draft 時は直近10件を会話コンテキストとして渡す
            context:
              feature === "draft"
                ? messages
                    .slice(-10)
                    .map(
                      (m) =>
                        `${m.sender_type === "therapist" && m.sender_id === therapistId ? "自分" : m.sender_name || (m.sender_type === "staff" ? "スタッフ" : "相手")}: ${m.content}`,
                    )
                    .join("\n")
                : "",
            target_language: translateLang,
            requester_type: "therapist",
            requester_id: therapistId,
            conversation_id: selected,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          alert(data.error || "AI処理に失敗しました");
          return;
        }
        if (feature === "summarize") {
          alert(`【会話要約】\n\n${data.output}`);
        } else if (feature === "ng_check") {
          try {
            const parsed = JSON.parse(data.output);
            const riskMap: Record<string, string> = {
              none: "問題なし",
              low: "軽度注意",
              medium: "要注意",
              high: "高リスク",
            };
            let msg = `🛡 NGチェック: ${riskMap[parsed.risk] || parsed.risk}\n`;
            if (parsed.reasons?.length)
              msg += "理由: " + parsed.reasons.join(" / ") + "\n";
            if (parsed.suggestion) msg += `提案: ${parsed.suggestion}`;
            alert(msg);
          } catch {
            alert(`NGチェック結果\n\n${data.output}`);
          }
        } else {
          setInput(data.output || "");
        }
      } catch {
        alert("AI呼び出しに失敗しました");
      }
      setAiBusy(false);
    },
    [aiBusy, input, messages, translateLang, therapistId, selected],
  );

  // 会話ごとの相手名
  const conversationMeta = (conv: Conversation) => {
    const parts = participantsAll.filter((p) => p.conversation_id === conv.id);
    const others = parts.filter(
      (p) =>
        !(p.participant_type === "therapist" && p.participant_id === therapistId),
    );
    const title =
      conv.name ||
      (conv.type === "dm" && others.length === 1
        ? others[0].participant_type === "staff"
          ? staffList.find((s) => s.id === others[0].participant_id)?.name ||
            "スタッフ"
          : "セラピスト"
        : conv.type === "broadcast"
        ? "一斉通知"
        : "グループ");
    const myPart = parts.find(
      (p) =>
        p.participant_type === "therapist" && p.participant_id === therapistId,
    );
    return { title, myPart };
  };

  const selectedConv = conversations.find((c) => c.id === selected);
  const selectedMeta = selectedConv ? conversationMeta(selectedConv) : null;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 14,
        fontFamily: FONT_SERIF,
      }}
    >
      {conversations.length === 0 ? (
        <div
          style={{
            padding: 28,
            textAlign: "center",
            color: C.textMuted,
            backgroundColor: C.cardAlt,
            border: `1px solid ${C.border}`,
            fontSize: 13,
            lineHeight: 1.9,
          }}
        >
          メッセージはまだありません。
          <br />
          スタッフからの連絡はここに届きます。
        </div>
      ) : !selected ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {conversations.map((c) => {
            const meta = conversationMeta(c);
            return (
              <button
                key={c.id}
                onClick={() => setSelected(c.id)}
                style={{
                  padding: "12px 14px",
                  backgroundColor: C.card,
                  border: `1px solid ${C.border}`,
                  borderBottom: "none",
                  textAlign: "left",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  gap: 3,
                  fontFamily: FONT_SERIF,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: C.text,
                      letterSpacing: "0.02em",
                    }}
                  >
                    {meta.title}
                    {c.type === "broadcast" && (
                      <span
                        style={{
                          marginLeft: 6,
                          padding: "1px 6px",
                          fontSize: 9,
                          color: C.accentDeep,
                          border: `1px solid ${C.border}`,
                        }}
                      >
                        一斉
                      </span>
                    )}
                  </span>
                  <span style={{ fontSize: 10, color: C.textMuted }}>
                    {c.last_message_at ? fmtDateTime(c.last_message_at) : ""}
                  </span>
                </div>
                {c.last_message_preview && (
                  <div
                    style={{
                      fontSize: 11,
                      color: C.textSub,
                      lineHeight: 1.5,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {c.last_message_preview}
                  </div>
                )}
              </button>
            );
          })}
          <div style={{ borderBottom: `1px solid ${C.border}` }} />
        </div>
      ) : (
        <>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 12px",
              backgroundColor: C.accentBg,
              border: `1px solid ${C.border}`,
            }}
          >
            <button
              onClick={() => setSelected(null)}
              style={{
                padding: "4px 10px",
                border: `1px solid ${C.border}`,
                background: "#ffffff",
                cursor: "pointer",
                fontSize: 11,
                fontFamily: FONT_SERIF,
                color: C.accentDeep,
              }}
            >
              ← 一覧
            </button>
            <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>
              {selectedMeta?.title}
            </span>
          </div>

          <div
            ref={scrollRef}
            style={{
              height: 380,
              overflowY: "auto",
              padding: 12,
              backgroundColor: C.cardAlt,
              border: `1px solid ${C.border}`,
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            {messages.map((m) => {
              const isMine =
                m.sender_type === "therapist" && m.sender_id === therapistId;
              const isAi = m.sender_type === "ai";
              const isSystem = m.sender_type === "system";
              return (
                <div
                  key={m.id}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: isMine ? "flex-end" : "flex-start",
                  }}
                >
                  {!isMine && m.sender_name && !isSystem && (
                    <div
                      style={{
                        fontSize: 10,
                        color: C.textMuted,
                        marginBottom: 2,
                        paddingLeft: 4,
                      }}
                    >
                      {m.sender_name}
                      {isAi && " (AI)"}
                    </div>
                  )}
                  <div style={{ display: "flex", alignItems: "flex-end", gap: 6 }}>
                    {isMine && (
                      <span style={{ fontSize: 9, color: C.textFaint }}>
                        {fmtDateTime(m.created_at)}
                      </span>
                    )}
                    <div
                      style={{
                        maxWidth: "78%",
                        padding: "8px 12px",
                        backgroundColor: isMine
                          ? C.accent
                          : isSystem
                          ? C.cardAlt
                          : "#ffffff",
                        color: isMine ? "#ffffff" : C.text,
                        border: isMine ? "none" : `1px solid ${C.border}`,
                        borderRadius: isMine
                          ? "14px 14px 2px 14px"
                          : "14px 14px 14px 2px",
                        fontSize: isSystem ? 11 : 13,
                        lineHeight: 1.6,
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                        fontStyle: isSystem ? "italic" : "normal",
                      }}
                    >
                      {m.content}
                      {/* 添付ファイル */}
                      {m.attachment_url && m.attachment_type && (
                        <div style={{ marginTop: m.content ? 8 : 0 }}>
                          {m.attachment_type.startsWith("image/") ? (
                            <a href={m.attachment_url} target="_blank" rel="noopener noreferrer">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={m.attachment_url}
                                alt="attachment"
                                style={{ maxWidth: "100%", maxHeight: 240, borderRadius: 8, display: "block", cursor: "zoom-in" }}
                              />
                            </a>
                          ) : m.attachment_type.startsWith("video/") ? (
                            <video
                              src={m.attachment_url}
                              controls
                              preload="metadata"
                              style={{ maxWidth: "100%", maxHeight: 240, borderRadius: 8, display: "block" }}
                            />
                          ) : (
                            <a href={m.attachment_url} target="_blank" rel="noopener noreferrer" style={{ color: isMine ? "#fff" : C.accentDeep, textDecoration: "underline", fontSize: 12 }}>
                              📎 添付ファイル
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                    {!isMine && (
                      <span style={{ fontSize: 9, color: C.textFaint }}>
                        {fmtDateTime(m.created_at)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* ═══ 定型返信サジェスト（AI不使用・キーワードマッチ）═══ */}
          {(() => {
            // 相手からの最新メッセージを取得（自分以外 & system 以外）
            const lastIncoming = [...messages]
              .reverse()
              .find(
                (m) =>
                  m.sender_type !== "system" &&
                  !(m.sender_type === "therapist" && m.sender_id === therapistId),
              );
            if (!lastIncoming) return null;
            const suggestions = getQuickReplies(lastIncoming.content);
            if (suggestions.length === 0) return null;
            return (
              <div
                style={{
                  padding: "8px 10px",
                  backgroundColor: C.accentBg,
                  border: `1px solid ${C.border}`,
                  borderLeftWidth: 3,
                  borderLeftColor: C.accentDeep,
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                }}
              >
                <p
                  style={{
                    fontSize: 10,
                    color: C.textMuted,
                    letterSpacing: "0.08em",
                    fontFamily: FONT_SERIF,
                  }}
                >
                  💡 よくある返信（タップで入力欄にセット）
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {suggestions.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => setInput(s.text)}
                      disabled={sending}
                      style={{
                        padding: "6px 12px",
                        border: `1px solid ${C.border}`,
                        backgroundColor: "#ffffff",
                        color: C.text,
                        fontFamily: FONT_SERIF,
                        fontSize: 12,
                        lineHeight: 1.3,
                        cursor: sending ? "default" : "pointer",
                        opacity: sending ? 0.5 : 1,
                        whiteSpace: "nowrap",
                      }}
                    >
                      <span style={{ marginRight: 4 }}>{s.emoji}</span>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })()}

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 6,
              padding: 8,
              backgroundColor: C.card,
              border: `1px solid ${C.border}`,
            }}
          >
            <button
              onClick={() => callAI("polite")}
              disabled={aiBusy || !input.trim()}
              style={aiBtn(C, FONT_SERIF, aiBusy || !input.trim())}
            >
              丁寧化
            </button>
            <button
              onClick={() => callAI("draft")}
              disabled={aiBusy || messages.length === 0}
              style={{
                padding: "4px 12px",
                border: `1px solid ${C.accentDeep}`,
                backgroundColor:
                  aiBusy || messages.length === 0 ? C.cardAlt : C.accentDeep,
                color:
                  aiBusy || messages.length === 0 ? C.textFaint : "#ffffff",
                fontFamily: FONT_SERIF,
                fontSize: 11,
                letterSpacing: "0.03em",
                cursor:
                  aiBusy || messages.length === 0 ? "default" : "pointer",
                fontWeight: 600,
              }}
            >
              🤖 AI返信案
            </button>
            <button
              onClick={() => callAI("summarize")}
              disabled={aiBusy || messages.length === 0}
              style={aiBtn(C, FONT_SERIF, aiBusy || messages.length === 0)}
            >
              要約
            </button>
            <button
              onClick={() => callAI("ng_check")}
              disabled={aiBusy || !input.trim()}
              style={aiBtn(C, FONT_SERIF, aiBusy || !input.trim())}
            >
              NGチェック
            </button>
            <div
              style={{
                display: "flex",
                gap: 4,
                alignItems: "center",
                padding: "2px 6px",
                border: `1px solid ${C.border}`,
              }}
            >
              <select
                value={translateLang}
                onChange={(e) => setTranslateLang(e.target.value)}
                style={{
                  border: "none",
                  background: "transparent",
                  fontSize: 11,
                  fontFamily: FONT_SERIF,
                  color: C.text,
                  outline: "none",
                }}
              >
                <option value="ja">日本語</option>
                <option value="en">English</option>
                <option value="zh">中文</option>
                <option value="ko">한국어</option>
                <option value="vi">Tiếng Việt</option>
              </select>
              <button
                onClick={() => callAI("translate")}
                disabled={aiBusy || !input.trim()}
                style={{
                  ...aiBtn(C, FONT_SERIF, aiBusy || !input.trim()),
                  border: "none",
                  padding: "3px 8px",
                }}
              >
                翻訳
              </button>
            </div>
            {aiBusy && (
              <span
                style={{ fontSize: 10, color: C.textMuted, alignSelf: "center" }}
              >
                …処理中
              </span>
            )}
          </div>

          {/* 添付プレビュー */}
          {pendingAttachment && (
            <div
              style={{
                padding: "8px 10px",
                backgroundColor: C.cardAlt,
                border: `1px solid ${C.border}`,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              {pendingAttachment.type.startsWith("image/") && pendingPreviewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={pendingPreviewUrl} alt="preview" style={{ width: 50, height: 50, objectFit: "cover", borderRadius: 6, border: `1px solid ${C.border}` }} />
              ) : pendingAttachment.type.startsWith("video/") && pendingPreviewUrl ? (
                <video src={pendingPreviewUrl} style={{ width: 50, height: 50, objectFit: "cover", borderRadius: 6, border: `1px solid ${C.border}`, backgroundColor: "#000" }} />
              ) : null}
              <div style={{ flex: 1, fontSize: 11 }}>
                <div style={{ fontWeight: 500, color: C.text }}>
                  {pendingAttachment.type.startsWith("image/") ? "📷 " : "🎬 "}
                  {pendingAttachment.name}
                </div>
                <div style={{ fontSize: 9, color: C.textMuted, marginTop: 1 }}>
                  {(pendingAttachment.size / 1024 / 1024).toFixed(2)} MB ・ 15日後に自動削除
                </div>
              </div>
              <button
                onClick={clearAttachment}
                disabled={uploading}
                style={{
                  padding: "3px 8px",
                  border: `1px solid ${C.border}`,
                  backgroundColor: "#ffffff",
                  color: C.textSub,
                  fontSize: 10,
                  cursor: uploading ? "not-allowed" : "pointer",
                  fontFamily: FONT_SERIF,
                }}
              >
                ✕
              </button>
            </div>
          )}

          <div style={{ display: "flex", gap: 6 }}>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              onChange={handleFileSelect}
              style={{ display: "none" }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={sending || uploading}
              title="画像・動画を添付"
              style={{
                padding: "8px 10px",
                border: `1px solid ${C.border}`,
                backgroundColor: "#ffffff",
                color: C.textSub,
                fontSize: 15,
                cursor: sending || uploading ? "not-allowed" : "pointer",
                opacity: sending || uploading ? 0.5 : 1,
                alignSelf: "stretch",
              }}
            >
              📎
            </button>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="メッセージを入力… (⌘/Ctrl+Enterで送信)"
              rows={3}
              style={{
                flex: 1,
                padding: "8px 10px",
                border: `1px solid ${C.border}`,
                fontFamily: FONT_SERIF,
                fontSize: 13,
                resize: "vertical",
                outline: "none",
                backgroundColor: "#ffffff",
                color: C.text,
              }}
            />
            <button
              onClick={send}
              disabled={sending || uploading || (!input.trim() && !pendingAttachment)}
              style={{
                padding: "0 18px",
                backgroundColor: C.accentDeep,
                color: "#ffffff",
                border: "none",
                fontFamily: FONT_SERIF,
                fontSize: 12,
                letterSpacing: "0.05em",
                cursor: sending || uploading || (!input.trim() && !pendingAttachment) ? "default" : "pointer",
                opacity: sending || uploading || (!input.trim() && !pendingAttachment) ? 0.5 : 1,
                alignSelf: "stretch",
              }}
            >
              {uploading ? "送信中..." : "送信"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function aiBtn(C: MyPageTheme, font: string, disabled: boolean) {
  return {
    padding: "4px 10px",
    border: `1px solid ${C.border}`,
    backgroundColor: disabled ? C.cardAlt : "#ffffff",
    color: disabled ? C.textFaint : C.accentDeep,
    fontFamily: font,
    fontSize: 11,
    letterSpacing: "0.03em",
    cursor: disabled ? "default" : "pointer",
  };
}

/**
 * 定型返信サジェストを取得（AI不使用・キーワードマッチ）
 *
 * 相手の最新メッセージの内容からパターンを検出し、
 * 候補の返信を返す。セラピストがタップすると入力欄にセットされる。
 * （即送信ではなく、内容を確認してから送信する設計）
 *
 * カテゴリ:
 *   - 出勤可否の質問      → OK / NG / 相談
 *   - 時間帯の確認        → OK / 厳しい / 調整して返信
 *   - 予約依頼・指名      → 了解 / 厳しい / 確認中
 *   - 感謝・労い          → こちらこそ / お疲れ様
 *   - 確認依頼            → 確認済 / 少し時間ほしい
 *   - 連絡事項・了解質問  → 了解です / 了解、ありがとう
 */
function getQuickReplies(text: string): { emoji: string; label: string; text: string }[] {
  if (!text) return [];
  const t = text.replace(/\s+/g, "").toLowerCase();

  // 1) 出勤可否の質問
  if (
    /(出勤|出れる|来れる|来られ|入れる|働け).*[?？]?/.test(text) ||
    /(シフト|勤務).*(可能|入れ|出せ|できる)/.test(text)
  ) {
    return [
      { emoji: "✅", label: "出勤できます", text: "はい、出勤できます。よろしくお願いします。" },
      { emoji: "❌", label: "今回は厳しい", text: "申し訳ありません、その日は難しいです。" },
      { emoji: "🤔", label: "時間を相談したい", text: "時間について少し相談させてください。何時からなら大丈夫そうですか？" },
    ];
  }

  // 2) 時間帯・予約時刻の確認
  if (
    /(\d{1,2}時|\d{1,2}:\d{2}|入り).*(大丈夫|いけ|可能|空い|入れ|どう)/.test(text) ||
    /(予約|お客).*(入り|入る|取れ|OK|おk)/i.test(text)
  ) {
    return [
      { emoji: "✅", label: "大丈夫です", text: "はい、大丈夫です。お願いします。" },
      { emoji: "⏰", label: "その時間は厳しい", text: "すみません、その時間は厳しいです。" },
      { emoji: "💭", label: "少し調整して返信", text: "少し調整して折り返し返信します。少々お待ちください。" },
    ];
  }

  // 3) 指名・ご予約の依頼
  if (/(指名|ご予約|予約).*(入り|入りました|入った|ありました)/.test(text)) {
    return [
      { emoji: "🙏", label: "ありがとうございます", text: "ありがとうございます、よろしくお願いします。" },
      { emoji: "📝", label: "確認します", text: "確認しますので少々お待ちください。" },
    ];
  }

  // 4) 感謝・労い
  if (/(ありがとう|お疲れ|おつかれ|助かった|頑張っ)/.test(text)) {
    return [
      { emoji: "🙏", label: "こちらこそ", text: "こちらこそありがとうございました。" },
      { emoji: "😊", label: "お疲れ様でした", text: "お疲れ様でした。" },
    ];
  }

  // 5) 確認・対応のお願い
  if (/(確認|見て|チェック|お願い).*(して|しといて|ください|できる)/.test(text)) {
    return [
      { emoji: "✅", label: "確認しました", text: "確認しました、ありがとうございます。" },
      { emoji: "⏳", label: "少し時間ください", text: "少しお時間ください、確認して折り返します。" },
    ];
  }

  // 6) 了解確認（「大丈夫?」「いい?」系）
  if (/(大丈夫[?？]|いい[?？]|よろしく|OK[?？]|問題ない)/i.test(text)) {
    return [
      { emoji: "👌", label: "了解です", text: "了解です、問題ありません。" },
      { emoji: "🙏", label: "ありがとうございます", text: "ありがとうございます、よろしくお願いします。" },
    ];
  }

  // 7) 遅刻・欠勤の連絡への返信（相手がスタッフから「体調大丈夫?」等）
  if (/(体調|大丈夫|無理しないで|気をつけ|お大事)/.test(text)) {
    return [
      { emoji: "🙇", label: "ありがとうございます", text: "お気遣いありがとうございます。" },
      { emoji: "💪", label: "問題ないです", text: "大丈夫です、ご心配おかけしました。" },
    ];
  }

  // 8) 汎用（何も該当しない時の最低限の定型）
  if (text.length <= 50) {
    return [
      { emoji: "👍", label: "了解です", text: "了解です、よろしくお願いします。" },
      { emoji: "🙏", label: "ありがとう", text: "ありがとうございます。" },
    ];
  }

  return [];
}
