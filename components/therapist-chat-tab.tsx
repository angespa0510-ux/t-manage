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
    if (!input.trim() || !selected || sending) return;
    setSending(true);
    const content = input.trim();
    setInput("");
    const { data: inserted } = await supabase
      .from("chat_messages")
      .insert({
        conversation_id: selected,
        sender_type: "therapist",
        sender_id: therapistId,
        sender_name: therapistName,
        content,
        message_type: "text",
      })
      .select()
      .single();
    if (inserted) {
      await supabase
        .from("chat_conversations")
        .update({
          last_message_at: new Date().toISOString(),
          last_message_preview: content.slice(0, 80),
          updated_at: new Date().toISOString(),
        })
        .eq("id", selected);
    }
    setSending(false);
  }, [input, selected, sending, therapistId, therapistName]);

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
              disabled={aiBusy}
              style={aiBtn(C, FONT_SERIF, aiBusy)}
            >
              返信案
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

          <div style={{ display: "flex", gap: 6 }}>
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
              disabled={sending || !input.trim()}
              style={{
                padding: "0 18px",
                backgroundColor: C.accentDeep,
                color: "#ffffff",
                border: "none",
                fontFamily: FONT_SERIF,
                fontSize: 12,
                letterSpacing: "0.05em",
                cursor: sending || !input.trim() ? "default" : "pointer",
                opacity: sending || !input.trim() ? 0.5 : 1,
                alignSelf: "stretch",
              }}
            >
              送信
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
