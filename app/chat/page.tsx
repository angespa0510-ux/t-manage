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
  attachment_type: string | null;
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
  // 添付ファイル（画像・動画）
  const [pendingAttachment, setPendingAttachment] = useState<File | null>(null);
  const [pendingPreviewUrl, setPendingPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
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
      // 相手の既読状態を Realtime 反映（既読マーク更新用）
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "chat_participants" }, (payload: any) => {
        const updated = payload.new as Participant;
        // 現在会話の participants を更新
        if (updated.conversation_id === currentConvId) {
          setParticipants((prev) =>
            prev.map((p) =>
              p.conversation_id === updated.conversation_id &&
              p.participant_type === updated.participant_type &&
              p.participant_id === updated.participant_id
                ? { ...p, last_read_message_id: updated.last_read_message_id }
                : p,
            ),
          );
        }
        // 会話一覧の allParticipants も更新
        setAllParticipants((prev) =>
          prev.map((p) =>
            p.conversation_id === updated.conversation_id &&
            p.participant_type === updated.participant_type &&
            p.participant_id === updated.participant_id
              ? { ...p, last_read_message_id: updated.last_read_message_id }
              : p,
          ),
        );
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
    // 添付もテキストも空なら何もしない
    if (!content && !pendingAttachment) return;

    setLoading(true);

    // 添付ファイルをアップロード
    let attachmentUrl: string | null = null;
    let attachmentType: string | null = null;
    if (pendingAttachment) {
      setUploading(true);
      const ext = pendingAttachment.name.split(".").pop() || "bin";
      const timestamp = Date.now();
      const rand = Math.random().toString(36).slice(2, 8);
      const path = `conv-${currentConvId}/${timestamp}-${rand}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("chat-attachments")
        .upload(path, pendingAttachment, {
          cacheControl: "3600",
          upsert: false,
          contentType: pendingAttachment.type,
        });
      if (upErr) {
        toast.show("添付ファイルのアップロード失敗: " + upErr.message, "error");
        setUploading(false);
        setLoading(false);
        return;
      }
      const { data: urlData } = supabase.storage.from("chat-attachments").getPublicUrl(path);
      attachmentUrl = urlData.publicUrl;
      attachmentType = pendingAttachment.type;
      // chat_attachments テーブルに記録（15日後削除用）
      await supabase.from("chat_attachments").insert({
        conversation_id: currentConvId,
        storage_path: path,
        file_url: attachmentUrl,
        file_type: attachmentType,
        file_size: pendingAttachment.size,
        uploaded_by_type: "staff",
        uploaded_by_id: activeStaff.id,
        expires_at: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
      });
      setUploading(false);
    }

    const { error } = await supabase.from("chat_messages").insert({
      conversation_id: currentConvId,
      sender_type: "staff",
      sender_id: activeStaff.id,
      sender_name: activeStaff.name,
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
    });
    if (error) {
      toast.show("送信に失敗しました: " + error.message, "error");
    } else {
      // 会話の last_message_at を更新
      const preview = content
        ? content.slice(0, 80)
        : attachmentType?.startsWith("image/")
        ? "📷 画像を送信"
        : attachmentType?.startsWith("video/")
        ? "🎬 動画を送信"
        : "📎 ファイルを送信";
      await supabase
        .from("chat_conversations")
        .update({
          last_message_at: new Date().toISOString(),
          last_message_preview: preview,
        })
        .eq("id", currentConvId);
      setNewMessage("");
      // 添付クリア
      if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl);
      setPendingAttachment(null);
      setPendingPreviewUrl(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      loadConversations();
    }
    setLoading(false);
  };

  // ─── ファイル選択時の処理 ───
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // 容量チェック
    const MAX_SIZE = 30 * 1024 * 1024; // 30MB
    if (file.size > MAX_SIZE) {
      toast.show(`ファイルサイズが大きすぎます（上限 30MB、現在 ${(file.size / 1024 / 1024).toFixed(1)}MB）`, "error");
      e.target.value = "";
      return;
    }
    // 種類チェック
    if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
      toast.show("画像または動画ファイルを選択してください", "error");
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
  // 会話一覧の検索 & フィルタ
  const [listSearch, setListSearch] = useState("");
  const [listFilter, setListFilter] = useState<"all" | "active" | "inactive" | "retired" | "unread" | "staff">("all");

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

  /**
   * 既読マーク判定
   * - 自分が送ったメッセージに対して、他の参加者がどこまで読んだかを確認
   * - 戻り値: null=表示しない / "" or "既読" or "既読 N/M"
   *
   * 仕様:
   *   DM → 相手が既読なら "既読" / まだなら ""
   *   グループ → 全員既読なら "既読" / 一部なら "既読 N/M" / 誰も既読でないなら ""
   */
  const getReadStatus = (msg: Message): string | null => {
    if (!activeStaff || !currentConv) return null;
    // 自分が送ったメッセージのみ既読表示対象
    if (!(msg.sender_type === "staff" && msg.sender_id === activeStaff.id)) return null;

    // 現在会話の参加者（自分以外）
    const others = participants.filter(
      (p) => !(p.participant_type === "staff" && p.participant_id === activeStaff.id),
    );
    if (others.length === 0) return null;

    // このメッセージID以上まで読んでいる人の数
    const readCount = others.filter(
      (p) => (p.last_read_message_id || 0) >= msg.id,
    ).length;

    if (currentConv.type === "dm") {
      // DM: 相手が読んだら "既読"、まだなら空
      return readCount > 0 ? "既読" : "";
    }
    // グループ or broadcast
    if (readCount === 0) return "";
    if (readCount >= others.length) return "既読";
    return `既読 ${readCount}/${others.length}`;
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

          {/* 🔍 検索バー */}
          <div style={{ padding: "10px 12px 6px", position: "relative", borderBottom: `1px solid ${T.border}` }}>
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: T.textMuted, pointerEvents: "none" }}>🔍</span>
              <input
                type="text"
                value={listSearch}
                onChange={(e) => setListSearch(e.target.value)}
                placeholder="名前・メッセージで検索..."
                style={{
                  width: "100%",
                  padding: "7px 10px 7px 28px",
                  borderRadius: 6,
                  border: `1px solid ${T.border}`,
                  backgroundColor: T.bg,
                  color: T.text,
                  fontSize: 11,
                  outline: "none",
                }}
              />
              {listSearch && (
                <button
                  onClick={() => setListSearch("")}
                  style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", border: "none", background: "transparent", color: T.textMuted, cursor: "pointer", fontSize: 12, padding: 4 }}
                >
                  ×
                </button>
              )}
            </div>

            {/* 🏷 フィルタタブ */}
            {(() => {
              // 各会話の参加者からフィルタ用の集計
              const convMeta = conversations.map((c) => {
                const parts = allParticipants.filter((p) => p.conversation_id === c.id);
                const otherTherapists = parts.filter(
                  (p) => p.participant_type === "therapist",
                );
                const hasTherapist = otherTherapists.length > 0;
                const therapistStatuses = otherTherapists
                  .map((p) => therapists.find((t) => t.id === p.participant_id)?.status)
                  .filter(Boolean) as string[];
                return {
                  convId: c.id,
                  hasTherapist,
                  therapistStatuses,
                  type: c.type,
                  unread: unreadByConv[c.id] || 0,
                };
              });

              const counts = {
                all: conversations.length,
                active: convMeta.filter((m) => m.therapistStatuses.includes("active")).length,
                inactive: convMeta.filter((m) => m.therapistStatuses.includes("inactive")).length,
                retired: convMeta.filter((m) => m.therapistStatuses.includes("retired")).length,
                staff: convMeta.filter((m) => !m.hasTherapist && m.type !== "broadcast").length,
                unread: convMeta.filter((m) => m.unread > 0).length,
              };
              const tabs: { key: typeof listFilter; label: string; color: string }[] = [
                { key: "all",      label: "全て",   color: T.accent },
                { key: "unread",   label: "未読",   color: "#e8849a" },
                { key: "active",   label: "稼働中", color: "#4a7c59" },
                { key: "inactive", label: "休止中", color: "#888780" },
                { key: "retired",  label: "退店",   color: "#c45555" },
                { key: "staff",    label: "スタッフ", color: "#85a8c4" },
              ];
              return (
                <div style={{ display: "flex", gap: 4, marginTop: 8, flexWrap: "wrap" }}>
                  {tabs.map((tab) => {
                    const isActive = listFilter === tab.key;
                    return (
                      <button
                        key={tab.key}
                        onClick={() => setListFilter(tab.key)}
                        style={{
                          padding: "3px 8px",
                          border: `1px solid ${isActive ? tab.color : T.border}`,
                          backgroundColor: isActive ? `${tab.color}18` : T.card,
                          color: isActive ? tab.color : T.textSub,
                          fontSize: 10,
                          fontWeight: isActive ? 600 : 400,
                          borderRadius: 999,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <span>{tab.label}</span>
                        <span style={{ fontSize: 9, opacity: 0.75 }}>{counts[tab.key]}</span>
                      </button>
                    );
                  })}
                </div>
              );
            })()}
          </div>

          <div style={{ flex: 1, overflowY: "auto" }}>
            {(() => {
              // フィルタ適用
              const filteredConvs = conversations.filter((conv) => {
                // フィルタタブ
                const parts = allParticipants.filter((p) => p.conversation_id === conv.id);
                const therapistParts = parts.filter((p) => p.participant_type === "therapist");
                const therapistStatuses = therapistParts
                  .map((p) => therapists.find((t) => t.id === p.participant_id)?.status)
                  .filter(Boolean) as string[];
                const unread = unreadByConv[conv.id] || 0;

                if (listFilter === "unread" && unread === 0) return false;
                if (listFilter === "active" && !therapistStatuses.includes("active")) return false;
                if (listFilter === "inactive" && !therapistStatuses.includes("inactive")) return false;
                if (listFilter === "retired" && !therapistStatuses.includes("retired")) return false;
                if (listFilter === "staff" && (therapistParts.length > 0 || conv.type === "broadcast")) return false;

                // 検索
                if (listSearch) {
                  const q = listSearch.toLowerCase();
                  const title = getConvDisplayName(conv).toLowerCase();
                  const preview = (conv.last_message_preview || "").toLowerCase();
                  if (!title.includes(q) && !preview.includes(q)) return false;
                }
                return true;
              });

              if (conversations.length === 0) {
                return (
                  <div style={{ padding: 24, color: T.textSub, fontSize: 12, textAlign: "center" }}>
                    会話がありません。<br />
                    「+ 新規」から作成してください。
                  </div>
                );
              }

              if (filteredConvs.length === 0) {
                return (
                  <div style={{ padding: 24, color: T.textMuted, fontSize: 11, textAlign: "center", lineHeight: 1.8 }}>
                    {listSearch ? <>「{listSearch}」に一致する会話がありません</> : <>該当する会話がありません</>}
                  </div>
                );
              }

              return filteredConvs.map((conv) => {
                const unread = unreadByConv[conv.id] || 0;
                const active = conv.id === currentConvId;
                // 相手のセラピストステータス取得
                const parts = allParticipants.filter((p) => p.conversation_id === conv.id);
                const therapistPart = parts.find(
                  (p) => p.participant_type === "therapist",
                );
                const therapistStatus = therapistPart
                  ? therapists.find((t) => t.id === therapistPart.participant_id)?.status
                  : null;
                const statusBadge = therapistStatus ? ({
                  active:   { label: "稼働", color: "#4a7c59" },
                  inactive: { label: "休止", color: "#888780" },
                  retired:  { label: "退店", color: "#c45555" },
                } as Record<string, { label: string; color: string }>)[therapistStatus] : null;

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
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                      <div style={{ fontSize: 13, fontWeight: unread > 0 ? 600 : 500, display: "flex", alignItems: "center", gap: 6, minWidth: 0, flex: 1 }}>
                        <span>{conv.type === "dm" ? "💬" : conv.type === "group" ? "👥" : "📢"}</span>
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {getConvDisplayName(conv)}
                        </span>
                        {statusBadge && (
                          <span
                            style={{
                              flexShrink: 0,
                              padding: "1px 6px",
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
                      <div style={{ fontSize: 10, color: T.textSub, flexShrink: 0 }}>{formatTime(conv.last_message_at)}</div>
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: T.textSub,
                        marginTop: 4,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        paddingRight: unread > 0 ? 28 : 0,
                      }}
                    >
                      {conv.last_message_preview || "（まだメッセージがありません）"}
                    </div>
                    {unread > 0 && (
                      <div
                        style={{
                          position: "absolute",
                          bottom: 12,
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
                          boxShadow: "0 1px 3px rgba(232,132,154,0.4)",
                        }}
                      >
                        {unread > 99 ? "99+" : unread}
                      </div>
                    )}
                  </div>
                );
              });
            })()}
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
                  const isSystem = msg.sender_type === "system";
                  // 送信者タイプ別のラベル情報
                  const senderBadge = (() => {
                    if (isAi) return { label: "AI", color: "#a855f7", bg: "#a855f718" };
                    if (msg.sender_type === "therapist") return { label: "セラ", color: "#e8849a", bg: "#e8849a18" };
                    if (msg.sender_type === "staff") return { label: "スタッフ", color: "#85a8c4", bg: "#85a8c418" };
                    return null;
                  })();
                  // システムメッセージは中央寄せの特殊表示
                  if (isSystem) {
                    return (
                      <div key={msg.id} style={{ display: "flex", justifyContent: "center", margin: "10px 0" }}>
                        <div style={{ fontSize: 11, color: T.textMuted, fontStyle: "italic", backgroundColor: T.cardAlt, padding: "4px 10px", borderRadius: 10 }}>
                          {msg.content}
                        </div>
                      </div>
                    );
                  }
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
                        {/* 送信者バッジ（自分含めて全員に表示）*/}
                        <div
                          style={{
                            fontSize: 10,
                            color: T.textSub,
                            marginBottom: 3,
                            padding: "0 8px",
                            display: "flex",
                            alignItems: "center",
                            gap: 5,
                            justifyContent: isMine ? "flex-end" : "flex-start",
                          }}
                        >
                          {senderBadge && (
                            <span
                              style={{
                                fontSize: 9,
                                fontWeight: 600,
                                color: senderBadge.color,
                                backgroundColor: senderBadge.bg,
                                padding: "1px 6px",
                                borderRadius: 999,
                                letterSpacing: "0.05em",
                              }}
                            >
                              {senderBadge.label}
                            </span>
                          )}
                          <span style={{ fontWeight: isMine ? 500 : 400 }}>
                            {msg.sender_name || (msg.sender_type === "staff" ? "スタッフ" : msg.sender_type === "therapist" ? "セラピスト" : "")}
                            {isMine && " (自分)"}
                          </span>
                        </div>
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
                          {/* 添付ファイル表示（画像・動画）*/}
                          {msg.attachment_url && msg.attachment_type && (
                            <div style={{ marginTop: msg.content ? 8 : 0 }}>
                              {msg.attachment_type.startsWith("image/") ? (
                                <a href={msg.attachment_url} target="_blank" rel="noopener noreferrer">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={msg.attachment_url}
                                    alt="attachment"
                                    style={{ maxWidth: "100%", maxHeight: 300, borderRadius: 8, display: "block", cursor: "zoom-in" }}
                                  />
                                </a>
                              ) : msg.attachment_type.startsWith("video/") ? (
                                <video
                                  src={msg.attachment_url}
                                  controls
                                  preload="metadata"
                                  style={{ maxWidth: "100%", maxHeight: 300, borderRadius: 8, display: "block" }}
                                />
                              ) : (
                                <a
                                  href={msg.attachment_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{ color: isMine ? "#fff" : T.accent, textDecoration: "underline", fontSize: 12 }}
                                >
                                  📎 添付ファイル
                                </a>
                              )}
                            </div>
                          )}
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
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            justifyContent: isMine ? "flex-end" : "flex-start",
                          }}
                        >
                          {isMine && (() => {
                            const read = getReadStatus(msg);
                            if (read === null || read === "") return null;
                            return (
                              <span style={{ color: "#85a8c4", fontWeight: 500, fontSize: 9 }}>
                                ✓ {read}
                              </span>
                            );
                          })()}
                          <span>{formatTime(msg.created_at)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* ═══ 定型返信サジェスト（AI不使用）═══ */}
              {(() => {
                // セラピストからの最新メッセージ（自分以外・system以外）
                const lastIncoming = [...messages]
                  .reverse()
                  .find(
                    (m) =>
                      m.sender_type !== "system" &&
                      !(m.sender_type === "staff" && m.sender_id === activeStaff?.id),
                  );
                if (!lastIncoming) return null;
                const suggestions = getStaffQuickReplies(lastIncoming.content);
                if (suggestions.length === 0) return null;
                return (
                  <div
                    style={{
                      padding: "8px 12px",
                      backgroundColor: "#f0ebe0",
                      borderTop: `1px solid ${T.border}`,
                      borderBottom: `1px solid ${T.border}`,
                      display: "flex",
                      flexDirection: "column",
                      gap: 6,
                    }}
                  >
                    <p style={{ fontSize: 10, color: T.textSub, margin: 0, letterSpacing: "0.05em" }}>
                      💡 よくある返信（タップで入力欄にセット）
                    </p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {suggestions.map((s, i) => (
                        <button
                          key={i}
                          onClick={() => setNewMessage(s.text)}
                          style={{
                            padding: "5px 10px",
                            border: `1px solid ${T.border}`,
                            backgroundColor: "#ffffff",
                            color: T.text,
                            fontSize: 11,
                            lineHeight: 1.3,
                            cursor: "pointer",
                            borderRadius: 6,
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

              {/* 添付プレビュー */}
              {pendingAttachment && (
                <div
                  style={{
                    padding: "10px 12px",
                    backgroundColor: T.cardAlt,
                    borderTop: `1px solid ${T.border}`,
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  {pendingAttachment.type.startsWith("image/") && pendingPreviewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={pendingPreviewUrl}
                      alt="preview"
                      style={{ width: 60, height: 60, objectFit: "cover", borderRadius: 8, border: `1px solid ${T.border}` }}
                    />
                  ) : pendingAttachment.type.startsWith("video/") && pendingPreviewUrl ? (
                    <video
                      src={pendingPreviewUrl}
                      style={{ width: 60, height: 60, objectFit: "cover", borderRadius: 8, border: `1px solid ${T.border}`, backgroundColor: "#000" }}
                    />
                  ) : null}
                  <div style={{ flex: 1, fontSize: 12 }}>
                    <div style={{ fontWeight: 500, color: T.text }}>
                      {pendingAttachment.type.startsWith("image/") ? "📷 " : "🎬 "}
                      {pendingAttachment.name}
                    </div>
                    <div style={{ fontSize: 10, color: T.textSub, marginTop: 2 }}>
                      {(pendingAttachment.size / 1024 / 1024).toFixed(2)} MB
                      <span style={{ marginLeft: 8, color: T.textMuted }}>・15日後に自動削除</span>
                    </div>
                  </div>
                  <button
                    onClick={clearAttachment}
                    disabled={uploading}
                    style={{
                      padding: "4px 10px",
                      border: `1px solid ${T.border}`,
                      backgroundColor: T.card,
                      color: T.textSub,
                      fontSize: 11,
                      borderRadius: 6,
                      cursor: uploading ? "not-allowed" : "pointer",
                    }}
                  >
                    ✕ 取消
                  </button>
                </div>
              )}

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
                {/* 📎 ファイル添付ボタン */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*"
                  onChange={handleFileSelect}
                  style={{ display: "none" }}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={loading || uploading}
                  title="画像・動画を添付（30MBまで・15日で自動削除）"
                  style={{
                    padding: "10px 12px",
                    border: `1px solid ${T.border}`,
                    backgroundColor: T.card,
                    color: T.textSub,
                    borderRadius: 10,
                    fontSize: 16,
                    cursor: loading || uploading ? "not-allowed" : "pointer",
                    opacity: loading || uploading ? 0.5 : 1,
                    flexShrink: 0,
                  }}
                >
                  📎
                </button>

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
                  disabled={loading || uploading || (!newMessage.trim() && !pendingAttachment)}
                  style={{
                    padding: "12px 20px",
                    backgroundColor: "#c3a782",
                    color: "#fff",
                    borderRadius: 10,
                    border: "none",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: loading || uploading || (!newMessage.trim() && !pendingAttachment) ? "not-allowed" : "pointer",
                    opacity: loading || uploading || (!newMessage.trim() && !pendingAttachment) ? 0.5 : 1,
                  }}
                >
                  {uploading ? "送信中..." : "送信"}
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

/**
 * スタッフ→セラピスト向けの定型返信サジェスト（AI不使用・キーワードマッチ）
 *
 * セラピストから届いた最新メッセージのパターンを検出し、返信候補を返す。
 * スタッフがタップすると入力欄にセットされる（即送信ではなく確認してから送信）。
 *
 * カテゴリ:
 *   - 体調不良・休み希望      → お大事に / 代わり手配 / 電話で話す
 *   - 遅刻連絡               → 気をつけて / 何時頃？ / 無理せず
 *   - 出勤できます            → ありがとう / シフト調整 / 時間確定?
 *   - 予約キャンセル連絡       → 残念お疲れ / 他枠調整 / 了解
 *   - 指名ありがとう          → お疲れ様 / 素晴らしい / ナイス
 *   - 質問・確認              → 調べて折り返す / 了解 / すぐ答える
 *   - 出勤希望                → シフト確認 / OKです / 相談したい
 *   - ありがとう・お疲れ       → こちらこそ / いつもありがとう
 *   - トラブル・困った         → 落ち着いて / すぐ対応 / 詳しく教えて
 */
function getStaffQuickReplies(text: string): { emoji: string; label: string; text: string }[] {
  if (!text) return [];

  // 1) 体調不良・休み希望
  if (/(体調|具合|熱|風邪|だるい|気持ち悪|吐き|お腹|頭痛|休みたい|休ませ|早退|帰らせ)/.test(text)) {
    return [
      { emoji: "🙏", label: "お大事に", text: "無理せずゆっくり休んでください。お大事に。" },
      { emoji: "🔄", label: "代わり手配します", text: "了解しました、代わりのシフトこちらで調整します。" },
      { emoji: "📞", label: "電話で話しましょう", text: "詳しくお話ししたいので、少しお電話できますか？" },
    ];
  }

  // 2) 遅刻・遅れる連絡
  if (/(遅れ|遅刻|間に合わ|まにあわ|遅く|ちょっと遅|少し遅)/.test(text)) {
    return [
      { emoji: "👌", label: "了解、気をつけて", text: "了解しました、気をつけて来てください。" },
      { emoji: "⏰", label: "何時頃になりそう？", text: "承知しました。何時頃になりそうですか？" },
      { emoji: "😊", label: "無理せず", text: "大丈夫です、無理せず安全第一で。" },
    ];
  }

  // 3) 出勤できる・空きあります
  if (
    /(出勤でき|出れ|入れま|出せ|働け|空いて|空きあ|入れる|空きが)/.test(text) &&
    !/(でき(ない|ません)|ない|厳しい|難し)/.test(text)
  ) {
    return [
      { emoji: "🙏", label: "助かります", text: "ありがとうございます、助かります！" },
      { emoji: "📝", label: "シフト確認します", text: "ありがとうございます、確認してシフト調整します。" },
      { emoji: "❓", label: "時間確定する？", text: "ありがとうございます。時間帯はどうしましょうか？" },
    ];
  }

  // 4) 出勤できない・難しい
  if (
    /((出れ|出勤|入れ|働け).*(ない|ません|厳しい|難し))|都合悪|用事|予定が|NGです|出られ(ない|ません)/.test(text)
  ) {
    return [
      { emoji: "👌", label: "了解です", text: "了解しました、また次回よろしくお願いします。" },
      { emoji: "🤔", label: "他日なら可能？", text: "承知しました。他の日で入れる日はありますか？" },
    ];
  }

  // 5) 予約キャンセル・ドタキャン報告
  if (/(キャンセル|来なかった|来店なし|ドタキャン|連絡なし)/.test(text)) {
    return [
      { emoji: "😔", label: "残念お疲れ", text: "残念でしたね、お疲れ様でした。" },
      { emoji: "🔄", label: "他の枠調整します", text: "了解、こちらで他の予約が入るよう調整してみます。" },
      { emoji: "👍", label: "了解しました", text: "了解しました、報告ありがとうございます。" },
    ];
  }

  // 6) 指名入った・予約入った
  if (/(指名|本指名|ネット指名|ご予約|予約).*(入り|入った|きた|来た|ありました|確定)/.test(text)) {
    return [
      { emoji: "🙌", label: "ありがとう", text: "ありがとうございます、よろしくお願いします！" },
      { emoji: "🎉", label: "ナイスです", text: "ナイスです！頑張ってください。" },
    ];
  }

  // 7) 指名のお礼・施術終了報告
  if (/(ありがとうござい|お疲れ様|おつかれ|終わり|終了|完了)/.test(text)) {
    return [
      { emoji: "🙌", label: "お疲れ様", text: "お疲れ様でした！ゆっくり休んでください。" },
      { emoji: "💐", label: "こちらこそ", text: "こちらこそ、いつもありがとうございます。" },
    ];
  }

  // 8) 質問・確認依頼
  if (/(聞きたい|質問|確認したい|教えて|わからな|分からな|どう|どなた|どんな|何|なに).*[?？]?/.test(text)) {
    return [
      { emoji: "📝", label: "確認して返信", text: "確認して折り返し返信しますね。少々お待ちください。" },
      { emoji: "📞", label: "電話で説明", text: "少しお電話で説明したいのですが、今大丈夫ですか？" },
      { emoji: "👍", label: "了解、調べます", text: "了解しました、調べてから改めてご連絡します。" },
    ];
  }

  // 9) トラブル・お客様問題
  if (/(お客様|客|クレーム|トラブル|怖|怪しい|変な|マナー|困った|困っ)/.test(text)) {
    return [
      { emoji: "🆘", label: "すぐ対応します", text: "詳しく教えてください、すぐ対応します。" },
      { emoji: "😌", label: "落ち着いて", text: "大丈夫、落ち着いて話してください。一緒に考えましょう。" },
      { emoji: "📞", label: "電話ください", text: "状況を詳しく聞きたいので、お電話いただけますか？" },
    ];
  }

  // 10) シフト変更・希望
  if (/(シフト|希望|変更|追加|出勤日|出勤時間|時間変え)/.test(text)) {
    return [
      { emoji: "📝", label: "確認します", text: "承知しました、シフト確認して調整します。" },
      { emoji: "✅", label: "OKです", text: "大丈夫です、調整しておきます。" },
      { emoji: "💬", label: "相談したい", text: "少し相談したいので、他の日程も含めて聞いてもいいですか？" },
    ];
  }

  // 11) 業務依頼・お願いへの了解
  if (/(お願い|頼みます|やって|見て|確認して|伝えて)/.test(text)) {
    return [
      { emoji: "✅", label: "了解です", text: "了解しました、対応します。" },
      { emoji: "⏳", label: "少し時間ください", text: "承知しました、少しお時間いただきます。" },
    ];
  }

  // 12) 汎用（何も該当しない短文向け）
  if (text.length <= 40) {
    return [
      { emoji: "👍", label: "了解", text: "了解しました、ありがとうございます。" },
      { emoji: "🙏", label: "お疲れ様", text: "お疲れ様です。ありがとうございます。" },
    ];
  }

  return [];
}
