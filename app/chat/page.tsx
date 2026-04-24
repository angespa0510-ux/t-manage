"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { useStaffSession } from "../../lib/staff-session";
import { useTheme } from "../../lib/theme";
import { NavMenu } from "../../lib/nav-menu";
import { useToast } from "../../lib/toast";

type Conversation = {
  id: number;
  type: "dm" | "group" | "broadcast";
  name: string;
  last_message_at: string;
  last_message_preview: string;
  is_archived: boolean;
};

type Participant = {
  id: number;
  conversation_id: number;
  participant_type: "staff" | "therapist";
  participant_id: number;
  display_name: string;
  role: string;
  last_read_message_id: number;
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
  ai_feature_used: string | null;
  is_edited: boolean;
  is_deleted: boolean;
  created_at: string;
};

type Therapist = { id: number; name: string; status: string };
type Staff = { id: number; name: string; role: string };

type AiFeature = "polite" | "translate" | "draft" | "summarize" | "ng_check";

export default function ChatPage() {
  const router = useRouter();
  const { dark, toggle, T } = useTheme();
  const toast = useToast();
  const { activeStaff, isRestored } = useStaffSession();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConvId, setCurrentConvId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  // 全会話分の participants（会話一覧のタイトル解決用、当該会話 ID のものを loadConversations で取得）
  const [allParticipants, setAllParticipants] = useState<Participant[]>([]);
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [unreadByConv, setUnreadByConv] = useState<Record<number, number>>({});

  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [showNewConv, setShowNewConv] = useState(false);
  const [aiFeature, setAiFeature] = useState<AiFeature | null>(null);
  const [aiLanguage, setAiLanguage] = useState("en");
  const [aiWorking, setAiWorking] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ─── 未ログインはログインページ (/dashboard) へ ───
  // isRestored が true になるまで待つ（localStorage からのセッション復元を完了させる）
  useEffect(() => {
    if (!isRestored) return;
    if (!activeStaff) router.push("/dashboard");
  }, [isRestored, activeStaff, router]);

  // ─── 初期ロード ───
  const loadConversations = useCallback(async () => {
    if (!activeStaff) return;

    // 自分が参加している会話一覧
    const { data: parts } = await supabase
      .from("chat_participants")
      .select("conversation_id, last_read_message_id")
      .eq("participant_type", "staff")
      .eq("participant_id", activeStaff.id)
      .is("left_at", null);

    const convIds = (parts || []).map((p: any) => p.conversation_id);
    if (convIds.length === 0) {
      setConversations([]);
      return;
    }

    const { data: convs } = await supabase
      .from("chat_conversations")
      .select("*")
      .in("id", convIds)
      .eq("is_archived", false)
      .order("last_message_at", { ascending: false });

    setConversations(convs || []);

    // 全会話の participants を一括取得（会話タイトルの解決用）
    const { data: allParts } = await supabase
      .from("chat_participants")
      .select("*")
      .in("conversation_id", convIds)
      .is("left_at", null);
    setAllParticipants(allParts || []);

    // 未読カウント
    const unreadMap: Record<number, number> = {};
    for (const p of parts || []) {
      const { count } = await supabase
        .from("chat_messages")
        .select("id", { count: "exact", head: true })
        .eq("conversation_id", p.conversation_id)
        .gt("id", p.last_read_message_id || 0)
        .or(`sender_type.neq.staff,sender_id.neq.${activeStaff.id}`);
      unreadMap[p.conversation_id] = count || 0;
    }
    setUnreadByConv(unreadMap);
  }, [activeStaff]);

  const loadMessages = useCallback(
    async (convId: number) => {
      const { data: msgs } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("conversation_id", convId)
        .eq("is_deleted", false)
        .order("created_at", { ascending: true })
        .limit(300);
      setMessages(msgs || []);

      const { data: parts } = await supabase
        .from("chat_participants")
        .select("*")
        .eq("conversation_id", convId)
        .is("left_at", null);
      setParticipants(parts || []);

      // 既読更新
      if (activeStaff && msgs && msgs.length > 0) {
        const maxId = Math.max(...msgs.map((m: Message) => m.id));
        await supabase
          .from("chat_participants")
          .update({ last_read_message_id: maxId, last_read_at: new Date().toISOString() })
          .eq("conversation_id", convId)
          .eq("participant_type", "staff")
          .eq("participant_id", activeStaff.id);
        setUnreadByConv((u) => ({ ...u, [convId]: 0 }));
      }

      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
    },
    [activeStaff]
  );

  const loadMasters = useCallback(async () => {
    // 全ステータスのセラピストを取得（active/inactive/retired 全て）
    // 削除済み (deleted_at) のみ除外
    const { data: ths } = await supabase
      .from("therapists")
      .select("id, name, status")
      .is("deleted_at", null)
      .order("name");
    setTherapists(ths || []);

    const { data: sts } = await supabase
      .from("staff")
      .select("id, name, role")
      .eq("status", "active")
      .order("name");
    setStaffList(sts || []);
  }, []);

  useEffect(() => {
    if (!activeStaff) return;
    loadConversations();
    loadMasters();
  }, [activeStaff, loadConversations, loadMasters]);

  useEffect(() => {
    if (currentConvId !== null) loadMessages(currentConvId);
  }, [currentConvId, loadMessages]);

  // ─── Realtime ───
  useEffect(() => {
    if (!activeStaff) return;
    const channel = supabase
      .channel("chat-messages-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, (payload: any) => {
        const msg = payload.new as Message;
        if (msg.conversation_id === currentConvId) {
          setMessages((prev) => [...prev, msg]);
          setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
          // 自分の会話が開いていたら既読化
          if (activeStaff && (msg.sender_type !== "staff" || msg.sender_id !== activeStaff.id)) {
            supabase
              .from("chat_participants")
              .update({ last_read_message_id: msg.id, last_read_at: new Date().toISOString() })
              .eq("conversation_id", currentConvId)
              .eq("participant_type", "staff")
              .eq("participant_id", activeStaff.id)
              .then(() => {});
          }
        } else {
          // 他会話の新着 → 未読加算 & 一覧並び替え
          setUnreadByConv((u) => ({ ...u, [msg.conversation_id]: (u[msg.conversation_id] || 0) + 1 }));
          loadConversations();
        }
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeStaff, currentConvId, loadConversations]);

  // ─── メッセージ送信 ───
  const sendMessage = async (override?: string) => {
    if (!activeStaff || !currentConvId) return;
    const content = (override ?? newMessage).trim();
    if (!content) return;

    setLoading(true);
    const { error } = await supabase.from("chat_messages").insert({
      conversation_id: currentConvId,
      sender_type: "staff",
      sender_id: activeStaff.id,
      sender_name: activeStaff.name,
      content,
      message_type: "text",
    });
    if (error) {
      toast.show("送信に失敗しました: " + error.message, "error");
    } else {
      // 会話の last_message_at を更新
      await supabase
        .from("chat_conversations")
        .update({
          last_message_at: new Date().toISOString(),
          last_message_preview: content.slice(0, 80),
        })
        .eq("id", currentConvId);
      setNewMessage("");
      loadConversations();
    }
    setLoading(false);
  };

  // ─── AI 機能実行 ───
  const runAi = async (feature: AiFeature) => {
    if (!activeStaff) return;
    const input = newMessage.trim();
    if (!input) {
      toast.show("メッセージを入力してからAI機能を使ってください", "error");
      return;
    }
    setAiWorking(true);
    setAiFeature(feature);
    try {
      const res = await fetch("/api/chat-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feature,
          input,
          target_language: aiLanguage,
          requester_type: "staff",
          requester_id: activeStaff.id,
          conversation_id: currentConvId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.show(data.error || "AI処理に失敗しました", "error");
        return;
      }
      if (feature === "ng_check") {
        try {
          const parsed = JSON.parse(data.output);
          const riskMap: Record<string, string> = { none: "問題なし", low: "軽度注意", medium: "要注意", high: "高リスク" };
          let msg = `🛡 NGチェック: ${riskMap[parsed.risk] || parsed.risk}\n`;
          if (parsed.reasons?.length) msg += "理由: " + parsed.reasons.join(" / ") + "\n";
          if (parsed.suggestion) msg += `提案: ${parsed.suggestion}`;
          toast.show(msg, parsed.risk === "none" || parsed.risk === "low" ? "success" : "error");
          if (parsed.suggestion && (parsed.risk === "medium" || parsed.risk === "high")) {
            if (window.confirm("AIの提案した安全な文に差し替えますか？\n\n" + parsed.suggestion)) {
              setNewMessage(parsed.suggestion);
            }
          }
        } catch {
          toast.show("NGチェック結果の解析に失敗しました", "error");
        }
      } else {
        // 通常は結果で置き換え
        setNewMessage(data.output);
        toast.show(
          `AI ${feature === "polite" ? "丁寧化" : feature === "translate" ? "翻訳" : feature === "draft" ? "返信案" : "要約"} 完了 (約 ¥${(data.cost_jpy || 0).toFixed(2)})`,
          "success"
        );
      }
    } catch (e: any) {
      toast.show("AI処理エラー: " + e.message, "error");
    } finally {
      setAiWorking(false);
      setAiFeature(null);
    }
  };

  // ─── 新規会話作成 ───
  const [newConvType, setNewConvType] = useState<"dm_therapist" | "dm_staff" | "group" | "broadcast">("dm_therapist");
  const [newConvTargets, setNewConvTargets] = useState<{ type: "staff" | "therapist"; id: number; name: string }[]>(
    []
  );
  const [newConvName, setNewConvName] = useState("");
  // 検索 & ステータスフィルタ（セラピスト選択時）
  const [newConvSearch, setNewConvSearch] = useState("");
  const [newConvStatusFilter, setNewConvStatusFilter] = useState<"active" | "inactive" | "retired" | "all">("active");

  const createConversation = async () => {
    if (!activeStaff) return;
    let targets = newConvTargets;

    if (newConvType === "broadcast") {
      // 全セラピストへ
      targets = therapists.map((t) => ({ type: "therapist" as const, id: t.id, name: t.name }));
    }
    if (targets.length === 0) {
      toast.show("相手を選択してください", "error");
      return;
    }

    const convType: "dm" | "group" | "broadcast" =
      newConvType === "broadcast" ? "broadcast" : newConvType === "group" ? "group" : "dm";

    const name =
      convType === "broadcast"
        ? newConvName || "全セラピスト一斉連絡"
        : convType === "group"
          ? newConvName || "グループ"
          : "";

    const { data: conv, error } = await supabase
      .from("chat_conversations")
      .insert({
        type: convType,
        name,
        created_by_type: "staff",
        created_by_id: activeStaff.id,
        last_message_at: new Date().toISOString(),
      })
      .select("*")
      .single();

    if (error || !conv) {
      toast.show("会話作成失敗: " + (error?.message || ""), "error");
      return;
    }

    const parts = [
      {
        conversation_id: conv.id,
        participant_type: "staff" as const,
        participant_id: activeStaff.id,
        display_name: activeStaff.name,
        role: "owner",
      },
      ...targets.map((t) => ({
        conversation_id: conv.id,
        participant_type: t.type,
        participant_id: t.id,
        display_name: t.name,
        role: "member",
      })),
    ];
    await supabase.from("chat_participants").insert(parts);

    setShowNewConv(false);
    setNewConvTargets([]);
    setNewConvName("");
    loadConversations();
    setCurrentConvId(conv.id);
    toast.show("会話を作成しました", "success");
  };

  // ─── 表示系ヘルパー ───
  const formatTime = (iso: string) => {
    const d = new Date(iso);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) {
      return `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
    }
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };

  const getConvDisplayName = (conv: Conversation) => {
    if (conv.name) return conv.name;
    if (conv.type === "broadcast") return "📢 一斉配信";
    // allParticipants から自分以外を抽出して表示
    const parts = allParticipants.filter((p) => p.conversation_id === conv.id);
    const others = parts.filter(
      (p) => !(p.participant_type === "staff" && p.participant_id === activeStaff?.id),
    );
    if (others.length === 0) return "(相手なし)";
    const names = others.map((p) => {
      if (p.display_name) return p.display_name;
      if (p.participant_type === "therapist") {
        return therapists.find((t) => t.id === p.participant_id)?.name || "セラピスト";
      } else {
        return staffList.find((s) => s.id === p.participant_id)?.name || "スタッフ";
      }
    });
    if (conv.type === "dm") return names[0];
    // グループ: 3人まで列挙、残りは "他◯名"
    if (names.length <= 3) return names.join(", ");
    return `${names.slice(0, 3).join(", ")} 他${names.length - 3}名`;
  };

  if (!activeStaff) return <div style={{ padding: 40 }}>読み込み中...</div>;

  const currentConv = conversations.find((c) => c.id === currentConvId);

  return (
    <div style={{ display: "flex", minHeight: "100vh", backgroundColor: T.bg, color: T.text }}>
      <NavMenu T={T as Record<string, string>} dark={dark} />
      <main style={{ flex: 1, marginLeft: 80, display: "flex", height: "100vh", overflow: "hidden" }}>
        {/* 左: 会話一覧 */}
        <div
          style={{
            width: 320,
            borderRight: `1px solid ${T.border}`,
            backgroundColor: T.card,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              padding: 16,
              borderBottom: `1px solid ${T.border}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>💬 チャット</h2>
            <button
              onClick={() => setShowNewConv(true)}
              style={{
                padding: "6px 12px",
                borderRadius: 8,
                border: "none",
                backgroundColor: "#c3a782",
                color: "#fff",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              + 新規
            </button>
          </div>
          <div style={{ flex: 1, overflowY: "auto" }}>
            {conversations.length === 0 && (
              <div style={{ padding: 24, color: T.textSub, fontSize: 12, textAlign: "center" }}>
                会話がありません。<br />
                「+ 新規」から作成してください。
              </div>
            )}
            {conversations.map((conv) => {
              const unread = unreadByConv[conv.id] || 0;
              const active = conv.id === currentConvId;
              return (
                <div
                  key={conv.id}
                  onClick={() => setCurrentConvId(conv.id)}
                  style={{
                    padding: 14,
                    borderBottom: `1px solid ${T.border}`,
                    cursor: "pointer",
                    backgroundColor: active ? T.cardAlt : "transparent",
                    position: "relative",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <div style={{ fontSize: 13, fontWeight: unread > 0 ? 600 : 500 }}>
                      {conv.type === "dm" ? "💬" : conv.type === "group" ? "👥" : "📢"}{" "}
                      {getConvDisplayName(conv)}
                    </div>
                    <div style={{ fontSize: 10, color: T.textSub }}>{formatTime(conv.last_message_at)}</div>
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: T.textSub,
                      marginTop: 4,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {conv.last_message_preview || "（まだメッセージがありません）"}
                  </div>
                  {unread > 0 && (
                    <div
                      style={{
                        position: "absolute",
                        top: 14,
                        right: 14,
                        backgroundColor: "#e8849a",
                        color: "#fff",
                        borderRadius: 10,
                        minWidth: 18,
                        height: 18,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 10,
                        padding: "0 6px",
                      }}
                    >
                      {unread > 99 ? "99+" : unread}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* 右: メッセージエリア */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          {!currentConv ? (
            <div
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: T.textSub,
                fontSize: 13,
              }}
            >
              会話を選択してください
            </div>
          ) : (
            <>
              {/* ヘッダ */}
              <div
                style={{
                  padding: 14,
                  borderBottom: `1px solid ${T.border}`,
                  backgroundColor: T.card,
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 600 }}>
                  {currentConv.type === "dm" ? "💬" : currentConv.type === "group" ? "👥" : "📢"}{" "}
                  {getConvDisplayName(currentConv)}
                </div>
                <div style={{ fontSize: 11, color: T.textSub }}>
                  {participants.length}人（{participants.filter((p) => p.participant_type === "therapist").length}セラ /{" "}
                  {participants.filter((p) => p.participant_type === "staff").length}スタ）
                </div>
              </div>

              {/* メッセージリスト */}
              <div
                style={{
                  flex: 1,
                  overflowY: "auto",
                  padding: 16,
                  backgroundColor: T.bg,
                }}
              >
                {messages.map((msg) => {
                  const isMine = msg.sender_type === "staff" && msg.sender_id === activeStaff.id;
                  const isAi = msg.sender_type === "ai";
                  return (
                    <div
                      key={msg.id}
                      style={{
                        display: "flex",
                        justifyContent: isMine ? "flex-end" : "flex-start",
                        marginBottom: 10,
                      }}
                    >
                      <div style={{ maxWidth: "70%" }}>
                        {!isMine && (
                          <div style={{ fontSize: 10, color: T.textSub, marginBottom: 2, marginLeft: 8 }}>
                            {msg.sender_name}
                            {msg.sender_type === "therapist" && " (セラ)"}
                            {isAi && " 🤖 AI"}
                          </div>
                        )}
                        <div
                          style={{
                            padding: "8px 12px",
                            borderRadius: 16,
                            backgroundColor: isMine ? "#c3a782" : isAi ? "#f0ebe0" : T.card,
                            color: isMine ? "#fff" : T.text,
                            fontSize: 13,
                            lineHeight: 1.5,
                            whiteSpace: "pre-wrap",
                            wordBreak: "break-word",
                            border: `1px solid ${isMine ? "#c3a782" : T.border}`,
                          }}
                        >
                          {msg.content}
                          {msg.ai_feature_used && (
                            <div style={{ fontSize: 9, opacity: 0.7, marginTop: 4 }}>
                              (AI: {msg.ai_feature_used})
                            </div>
                          )}
                        </div>
                        <div
                          style={{
                            fontSize: 9,
                            color: T.textSub,
                            marginTop: 2,
                            textAlign: isMine ? "right" : "left",
                            padding: "0 8px",
                          }}
                        >
                          {formatTime(msg.created_at)}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* AI ボタンバー */}
              <div
                style={{
                  display: "flex",
                  gap: 6,
                  padding: "8px 12px",
                  backgroundColor: T.cardAlt,
                  borderTop: `1px solid ${T.border}`,
                  flexWrap: "wrap",
                  alignItems: "center",
                }}
              >
                <div style={{ fontSize: 10, color: T.textSub, marginRight: 4 }}>🤖 AI支援:</div>
                <button
                  onClick={() => runAi("polite")}
                  disabled={aiWorking}
                  style={aiBtnStyle(aiFeature === "polite")}
                >
                  ✨ 丁寧化
                </button>
                <button
                  onClick={() => runAi("draft")}
                  disabled={aiWorking}
                  style={aiBtnStyle(aiFeature === "draft")}
                >
                  📝 返信案
                </button>
                <button
                  onClick={() => runAi("summarize")}
                  disabled={aiWorking}
                  style={aiBtnStyle(aiFeature === "summarize")}
                >
                  📋 要約
                </button>
                <button
                  onClick={() => runAi("ng_check")}
                  disabled={aiWorking}
                  style={aiBtnStyle(aiFeature === "ng_check")}
                >
                  🛡 NGチェック
                </button>
                <div style={{ display: "flex", alignItems: "center", gap: 4, marginLeft: 8 }}>
                  <select
                    value={aiLanguage}
                    onChange={(e) => setAiLanguage(e.target.value)}
                    style={{
                      fontSize: 10,
                      padding: "4px 6px",
                      borderRadius: 6,
                      border: `1px solid ${T.border}`,
                      backgroundColor: T.card,
                      color: T.text,
                    }}
                  >
                    <option value="en">英語</option>
                    <option value="zh">中国語</option>
                    <option value="ko">韓国語</option>
                    <option value="vi">ベトナム語</option>
                    <option value="ja">日本語</option>
                  </select>
                  <button
                    onClick={() => runAi("translate")}
                    disabled={aiWorking}
                    style={aiBtnStyle(aiFeature === "translate")}
                  >
                    🌐 翻訳
                  </button>
                </div>
                {aiWorking && <div style={{ fontSize: 10, color: T.textSub, marginLeft: 8 }}>AI処理中...</div>}
              </div>

              {/* 入力エリア */}
              <div
                style={{
                  padding: 12,
                  backgroundColor: T.card,
                  borderTop: `1px solid ${T.border}`,
                  display: "flex",
                  gap: 8,
                  alignItems: "flex-end",
                }}
              >
                <textarea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  placeholder="メッセージを入力 (Enterで送信 / Shift+Enterで改行)"
                  rows={2}
                  style={{
                    flex: 1,
                    padding: 10,
                    borderRadius: 10,
                    border: `1px solid ${T.border}`,
                    backgroundColor: T.bg,
                    color: T.text,
                    fontSize: 13,
                    resize: "vertical",
                    fontFamily: "inherit",
                  }}
                />
                <button
                  onClick={() => sendMessage()}
                  disabled={loading || !newMessage.trim()}
                  style={{
                    padding: "12px 20px",
                    backgroundColor: "#c3a782",
                    color: "#fff",
                    borderRadius: 10,
                    border: "none",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: loading || !newMessage.trim() ? "not-allowed" : "pointer",
                    opacity: loading || !newMessage.trim() ? 0.5 : 1,
                  }}
                >
                  送信
                </button>
              </div>
            </>
          )}
        </div>
      </main>

      {/* 新規会話モーダル */}
      {showNewConv && (
        <div
          onClick={() => setShowNewConv(false)}
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 520,
              maxHeight: "90vh",
              overflow: "auto",
              backgroundColor: T.card,
              borderRadius: 16,
              padding: 24,
            }}
          >
            <h3 style={{ margin: 0, marginBottom: 16, fontSize: 16 }}>💬 新規チャット作成</h3>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, color: T.textSub }}>種類</label>
              <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                {(
                  [
                    { key: "dm_therapist", label: "💬 DM(セラピスト)" },
                    { key: "dm_staff", label: "💬 DM(スタッフ)" },
                    { key: "group", label: "👥 グループ" },
                    { key: "broadcast", label: "📢 全セラピスト一斉" },
                  ] as const
                ).map((t) => (
                  <button
                    key={t.key}
                    onClick={() => {
                      setNewConvType(t.key);
                      setNewConvTargets([]);
                    }}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 8,
                      border: `1px solid ${newConvType === t.key ? "#c3a782" : T.border}`,
                      backgroundColor: newConvType === t.key ? "#c3a782" : T.card,
                      color: newConvType === t.key ? "#fff" : T.text,
                      fontSize: 11,
                      cursor: "pointer",
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {(newConvType === "group" || newConvType === "broadcast") && (
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 11, color: T.textSub }}>グループ名</label>
                <input
                  value={newConvName}
                  onChange={(e) => setNewConvName(e.target.value)}
                  placeholder={newConvType === "broadcast" ? "全セラピスト一斉連絡" : "グループ名"}
                  style={{
                    width: "100%",
                    padding: 10,
                    borderRadius: 8,
                    border: `1px solid ${T.border}`,
                    backgroundColor: T.bg,
                    color: T.text,
                    fontSize: 12,
                    marginTop: 6,
                  }}
                />
              </div>
            )}

            {newConvType !== "broadcast" && (
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 11, color: T.textSub }}>
                  相手を選択{" "}
                  {newConvType === "group" && <span style={{ color: "#c3a782" }}>(複数選択可)</span>}
                </label>

                {/* 🔍 検索バー */}
                <div style={{ marginTop: 8, marginBottom: 6, position: "relative" }}>
                  <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: T.textMuted, pointerEvents: "none" }}>🔍</span>
                  <input
                    type="text"
                    value={newConvSearch}
                    onChange={(e) => setNewConvSearch(e.target.value)}
                    placeholder={(newConvType === "dm_therapist" || newConvType === "group") ? "セラピスト名で検索..." : "スタッフ名で検索..."}
                    style={{
                      width: "100%",
                      padding: "8px 10px 8px 30px",
                      borderRadius: 8,
                      border: `1px solid ${T.border}`,
                      backgroundColor: T.bg,
                      color: T.text,
                      fontSize: 12,
                      outline: "none",
                    }}
                  />
                  {newConvSearch && (
                    <button
                      onClick={() => setNewConvSearch("")}
                      style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", border: "none", background: "transparent", color: T.textMuted, cursor: "pointer", fontSize: 14, padding: 4 }}
                    >
                      ×
                    </button>
                  )}
                </div>

                {/* 🏷 ステータスタブ（セラピスト選択時のみ） */}
                {(newConvType === "dm_therapist" || newConvType === "group") && (() => {
                  const counts = {
                    active: therapists.filter((t) => t.status === "active").length,
                    inactive: therapists.filter((t) => t.status === "inactive").length,
                    retired: therapists.filter((t) => t.status === "retired").length,
                    all: therapists.length,
                  };
                  const tabs: { key: "active" | "inactive" | "retired" | "all"; label: string; color: string }[] = [
                    { key: "active",   label: "稼働中", color: "#4a7c59" },
                    { key: "inactive", label: "休止中", color: "#888780" },
                    { key: "retired",  label: "退店",   color: "#c45555" },
                    { key: "all",      label: "全て",   color: T.accent },
                  ];
                  return (
                    <div style={{ display: "flex", gap: 4, marginBottom: 6, flexWrap: "wrap" }}>
                      {tabs.map((tab) => {
                        const active = newConvStatusFilter === tab.key;
                        return (
                          <button
                            key={tab.key}
                            onClick={() => setNewConvStatusFilter(tab.key)}
                            style={{
                              padding: "4px 10px",
                              border: `1px solid ${active ? tab.color : T.border}`,
                              backgroundColor: active ? `${tab.color}18` : T.card,
                              color: active ? tab.color : T.textSub,
                              fontSize: 11,
                              fontWeight: active ? 600 : 400,
                              borderRadius: 999,
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 5,
                            }}
                          >
                            <span>{tab.label}</span>
                            <span style={{ fontSize: 10, opacity: 0.75 }}>{counts[tab.key]}</span>
                          </button>
                        );
                      })}
                    </div>
                  );
                })()}

                <div
                  style={{
                    maxHeight: 280,
                    overflowY: "auto",
                    border: `1px solid ${T.border}`,
                    borderRadius: 8,
                    backgroundColor: T.bg,
                  }}
                >
                  {(newConvType === "dm_therapist" || newConvType === "group"
                    ? therapists
                        .filter((t) => newConvStatusFilter === "all" || t.status === newConvStatusFilter)
                        .filter((t) => !newConvSearch || t.name.toLowerCase().includes(newConvSearch.toLowerCase()))
                        .map((t) => ({ type: "therapist" as const, id: t.id, name: t.name, status: t.status }))
                    : []
                  ).map((item) => {
                    const selected = newConvTargets.some(
                      (t) => t.type === item.type && t.id === item.id
                    );
                    const statusBadge = {
                      active:   { label: "稼働", color: "#4a7c59" },
                      inactive: { label: "休止", color: "#888780" },
                      retired:  { label: "退店", color: "#c45555" },
                    }[item.status] || { label: "", color: T.textMuted };
                    return (
                      <div
                        key={`th-${item.id}`}
                        onClick={() => {
                          if (newConvType === "dm_therapist") {
                            setNewConvTargets([{ type: item.type, id: item.id, name: item.name }]);
                          } else {
                            setNewConvTargets((prev) =>
                              selected
                                ? prev.filter((t) => !(t.type === item.type && t.id === item.id))
                                : [...prev, { type: item.type, id: item.id, name: item.name }]
                            );
                          }
                        }}
                        style={{
                          padding: "8px 12px",
                          borderBottom: `1px solid ${T.border}`,
                          cursor: "pointer",
                          backgroundColor: selected ? "#f0ebe0" : "transparent",
                          fontSize: 12,
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <span style={{ fontSize: 14 }}>{selected ? "✅" : "💆"}</span>
                        <span style={{ flex: 1 }}>{item.name}</span>
                        {statusBadge.label && (
                          <span
                            style={{
                              padding: "1px 7px",
                              fontSize: 9,
                              fontWeight: 600,
                              color: statusBadge.color,
                              backgroundColor: `${statusBadge.color}18`,
                              borderRadius: 999,
                              letterSpacing: "0.05em",
                            }}
                          >
                            {statusBadge.label}
                          </span>
                        )}
                      </div>
                    );
                  })}
                  {(newConvType === "dm_staff" || newConvType === "group"
                    ? staffList
                        .filter((s) => s.id !== activeStaff.id)
                        .filter((s) => !newConvSearch || s.name.toLowerCase().includes(newConvSearch.toLowerCase()))
                        .map((s) => ({ type: "staff" as const, id: s.id, name: s.name }))
                    : []
                  ).map((item) => {
                    const selected = newConvTargets.some(
                      (t) => t.type === item.type && t.id === item.id
                    );
                    return (
                      <div
                        key={`st-${item.id}`}
                        onClick={() => {
                          if (newConvType === "dm_staff") {
                            setNewConvTargets([item]);
                          } else {
                            setNewConvTargets((prev) =>
                              selected
                                ? prev.filter((t) => !(t.type === item.type && t.id === item.id))
                                : [...prev, item]
                            );
                          }
                        }}
                        style={{
                          padding: "8px 12px",
                          borderBottom: `1px solid ${T.border}`,
                          cursor: "pointer",
                          backgroundColor: selected ? "#f0ebe0" : "transparent",
                          fontSize: 12,
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <span style={{ fontSize: 14 }}>{selected ? "✅" : "👤"}</span>
                        {item.name}
                      </div>
                    );
                  })}

                  {/* 🔎 検索結果ゼロ時 */}
                  {(() => {
                    const thCount = (newConvType === "dm_therapist" || newConvType === "group")
                      ? therapists
                          .filter((t) => newConvStatusFilter === "all" || t.status === newConvStatusFilter)
                          .filter((t) => !newConvSearch || t.name.toLowerCase().includes(newConvSearch.toLowerCase()))
                          .length
                      : 0;
                    const stCount = (newConvType === "dm_staff" || newConvType === "group")
                      ? staffList
                          .filter((s) => s.id !== activeStaff.id)
                          .filter((s) => !newConvSearch || s.name.toLowerCase().includes(newConvSearch.toLowerCase()))
                          .length
                      : 0;
                    if (thCount + stCount === 0) {
                      return (
                        <div style={{ padding: "20px 12px", textAlign: "center", fontSize: 11, color: T.textMuted, lineHeight: 1.8 }}>
                          {newConvSearch ? (
                            <>「{newConvSearch}」に一致する相手が見つかりません</>
                          ) : (
                            <>該当する相手がいません</>
                          )}
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>
              </div>
            )}

            {newConvType === "broadcast" && (
              <div
                style={{
                  padding: 12,
                  backgroundColor: T.cardAlt,
                  borderRadius: 8,
                  fontSize: 11,
                  color: T.textSub,
                  marginBottom: 14,
                }}
              >
                全 {therapists.length} 名のセラピストに一斉配信されます。
              </div>
            )}

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowNewConv(false)}
                style={{
                  padding: "8px 16px",
                  borderRadius: 8,
                  border: `1px solid ${T.border}`,
                  backgroundColor: T.card,
                  color: T.text,
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                キャンセル
              </button>
              <button
                onClick={createConversation}
                style={{
                  padding: "8px 16px",
                  borderRadius: 8,
                  border: "none",
                  backgroundColor: "#c3a782",
                  color: "#fff",
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                作成
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  function aiBtnStyle(active: boolean): React.CSSProperties {
    return {
      padding: "4px 10px",
      borderRadius: 6,
      border: `1px solid ${active ? "#c3a782" : T.border}`,
      backgroundColor: active ? "#c3a782" : T.card,
      color: active ? "#fff" : T.text,
      fontSize: 10,
      cursor: aiWorking ? "not-allowed" : "pointer",
      opacity: aiWorking ? 0.6 : 1,
    };
  }
}
