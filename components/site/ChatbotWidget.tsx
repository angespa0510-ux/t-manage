"use client";

import { useState, useEffect, useRef, useCallback, type ReactNode } from "react";
import Link from "next/link";
import { SITE } from "../../lib/site-theme";

/**
 * ═══════════════════════════════════════════════════════════
 * HP お客様チャットBOTウィジェット（フローティング）
 *
 * 画面右下に吊り下げ型ボタンを表示し、タップで会話パネルを開く。
 *
 * 仕様:
 *   - FAQ ボタンをまず提示（AI 利用を抑える）
 *   - 初期挨拶・フォールバックは DB の hp_chatbot_settings から取得
 *   - メッセージ送信 → /api/hp-chatbot POST
 *   - 回答に対して 👍/👎 評価 → /api/hp-chatbot-event
 *   - セッションは sessionStorage に保存、リロードで保持
 *
 * 方針:
 *   - ピンク基調（SITE.color.pink）で明朝フォント
 *   - 絵文字は最小限（トグルアイコンのみ）
 * ═══════════════════════════════════════════════════════════
 */

type ChatbotFaq = {
  id: number;
  category: string;
  question: string;
  answer: string;
  is_featured: boolean;
  display_order: number;
};

type ChatbotSettings = {
  greeting_message: string;
  fallback_message: string;
  member_cta_text: string;
  member_cta_url: string;
  show_member_cta: boolean;
  is_enabled: boolean;
};

type Message = {
  id: string;
  role: "bot" | "user";
  content: string;
  source?: "faq" | "cache" | "ai" | "system";
  faqId?: number;
  rated?: "up" | "down" | null;
  showFeedbackAsk?: boolean;
  showMemberCta?: boolean;
};

const SESSION_KEY = "hp_chatbot_session_id";
const MSGS_KEY = "hp_chatbot_messages";

function genSessionId() {
  return "sess_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
}

/**
 * BOT返信メッセージ内のURL・内部パス・電話番号を自動でリンク化する。
 *
 * 対応パターン:
 *   - https://example.com / http://...      → 新タブで開く外部リンク
 *   - /access, /system, /schedule など      → SPA遷移（同タブ）
 *   - 070-1234-5678, 0701234567 など        → tel: リンク（電話発信）
 *
 * 区切り判定:
 *   - 句読点(、。) 全角空白 半角空白 ) ] 】 」 で終わったらそこまでをURLとして扱う
 *
 * セキュリティ:
 *   - 外部リンクは noopener noreferrer
 */
function renderWithLinks(text: string): ReactNode[] {
  // URL / 内部パス / 電話番号 を順に検出
  // - https?://... : 区切り文字が出るまで
  // - /xxx/yyy    : 英数字 + ハイフン + アンダースコア + スラッシュ
  // - 電話番号    : 0始まりで桁数 9〜11、ハイフン任意
  const regex = /(https?:\/\/[^\s、。()（）\[\]【】「」]+|\/[a-zA-Z0-9_\-/]+(?:\?[^\s、。()（）\[\]【】「」]*)?|0\d{1,4}-?\d{1,4}-?\d{4})/g;

  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    // マッチ前のテキスト
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    const matched = match[0];
    const linkStyle = {
      color: SITE.color.pink,
      textDecoration: "underline",
      textUnderlineOffset: 2,
      wordBreak: "break-all" as const,
    };

    if (matched.startsWith("http")) {
      // 外部URL: 新タブ
      parts.push(
        <a
          key={key++}
          href={matched}
          target="_blank"
          rel="noopener noreferrer"
          style={linkStyle}
        >
          {matched}
        </a>
      );
    } else if (matched.startsWith("/")) {
      // 内部パス: Next.js Link で SPA 遷移
      parts.push(
        <Link key={key++} href={matched} style={linkStyle}>
          {matched}
        </Link>
      );
    } else {
      // 電話番号: tel: リンク
      const tel = matched.replace(/-/g, "");
      parts.push(
        <a key={key++} href={`tel:${tel}`} style={linkStyle}>
          {matched}
        </a>
      );
    }

    lastIndex = match.index + matched.length;
  }

  // 残りテキスト
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}

export default function ChatbotWidget() {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [faqs, setFaqs] = useState<ChatbotFaq[]>([]);
  const [settings, setSettings] = useState<ChatbotSettings | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [sessionId, setSessionId] = useState<string>("");
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // 初期化
  useEffect(() => {
    let sid = "";
    try {
      sid = sessionStorage.getItem(SESSION_KEY) || "";
    } catch {}
    if (!sid) {
      sid = genSessionId();
      try {
        sessionStorage.setItem(SESSION_KEY, sid);
      } catch {}
    }
    setSessionId(sid);

    // 既存メッセージ復元
    try {
      const saved = sessionStorage.getItem(MSGS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) setMessages(parsed);
      }
    } catch {}

    // FAQ と設定取得
    fetch("/api/hp-chatbot")
      .then((r) => r.json())
      .then((d) => {
        if (d.faqs) setFaqs(d.faqs);
        if (d.settings) setSettings(d.settings);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  // メッセージ変更時に sessionStorage 保存 & スクロール
  useEffect(() => {
    try {
      sessionStorage.setItem(MSGS_KEY, JSON.stringify(messages));
    } catch {}
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // 初回開封時に挨拶を出す
  useEffect(() => {
    if (open && messages.length === 0 && settings?.greeting_message) {
      setMessages([
        {
          id: "greet_" + Date.now(),
          role: "bot",
          content: settings.greeting_message,
          source: "system",
        },
      ]);
    }
  }, [open, settings, messages.length]);

  const pushUserMessage = useCallback((text: string) => {
    const m: Message = {
      id: "u_" + Date.now(),
      role: "user",
      content: text,
    };
    setMessages((prev) => [...prev, m]);
  }, []);

  const pushBotMessage = useCallback(
    (
      content: string,
      opts: Partial<Message> = {},
    ) => {
      const m: Message = {
        id: "b_" + Date.now() + Math.random().toString(36).slice(2, 5),
        role: "bot",
        content,
        ...opts,
      };
      setMessages((prev) => [...prev, m]);
    },
    [],
  );

  const sendQuestion = useCallback(
    async (question: string, faqIdHint?: number) => {
      if (!question.trim() || sending) return;
      setSending(true);
      pushUserMessage(question);
      try {
        const res = await fetch("/api/hp-chatbot", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question,
            session_id: sessionId,
            faq_id_hint: faqIdHint || null,
          }),
        });
        const data = await res.json();
        if (data.error) {
          pushBotMessage(
            settings?.fallback_message ||
              "申し訳ございません。ただいま応答できません。",
            { source: "system" },
          );
        } else {
          pushBotMessage(data.answer || "", {
            source: data.source,
            faqId: data.faq_id || undefined,
            showFeedbackAsk: data.source === "ai" || data.source === "cache",
            showMemberCta:
              !!settings?.show_member_cta &&
              (data.source === "ai" || data.source === "cache"),
          });
        }
      } catch {
        pushBotMessage(
          settings?.fallback_message ||
            "ただいま応答できません。お手数ですが少し時間をおいてお試しください。",
          { source: "system" },
        );
      }
      setSending(false);
    },
    [sending, sessionId, settings, pushBotMessage, pushUserMessage],
  );

  const rateMessage = useCallback(
    async (msg: Message, rating: "up" | "down") => {
      setMessages((prev) =>
        prev.map((m) => (m.id === msg.id ? { ...m, rated: rating } : m)),
      );
      try {
        await fetch("/api/hp-chatbot-event", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "rate_answer",
            session_id: sessionId,
            rating,
            source: msg.source,
            faq_id: msg.faqId || null,
            answer_preview: msg.content.slice(0, 200),
          }),
        });
      } catch {}
    },
    [sessionId],
  );

  const clickFaq = useCallback(
    (f: ChatbotFaq) => {
      fetch("/api/hp-chatbot-event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "faq_click",
          session_id: sessionId,
          faq_id: f.id,
        }),
      }).catch(() => {});
      sendQuestion(f.question, f.id);
    },
    [sendQuestion, sessionId],
  );

  const resetConversation = useCallback(() => {
    setMessages([]);
    try {
      sessionStorage.removeItem(MSGS_KEY);
    } catch {}
    if (settings?.greeting_message) {
      setMessages([
        {
          id: "greet_" + Date.now(),
          role: "bot",
          content: settings.greeting_message,
          source: "system",
        },
      ]);
    }
  }, [settings]);

  const featuredFaqs = faqs.filter((f) => f.is_featured).slice(0, 8);

  // 無効化されている場合は非表示
  if (!loaded || (settings && !settings.is_enabled)) {
    return null;
  }

  return (
    <>
      {/* フローティングボタン */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="チャットを開く"
          style={{
            position: "fixed",
            right: 20,
            bottom: 20,
            zIndex: 999,
            width: 60,
            height: 60,
            borderRadius: "50%",
            border: "none",
            backgroundColor: SITE.color.pinkDeep,
            color: "#ffffff",
            boxShadow: "0 4px 16px rgba(201, 107, 131, 0.35)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: SITE.font.serif,
            fontSize: 22,
            transition: "transform 0.15s",
          }}
        >
          {/* シンプルな吹き出しアイコン（SVG、絵文字ではない） */}
          <svg
            width="26"
            height="26"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </button>
      )}

      {/* 会話パネル */}
      {open && (
        <div
          style={{
            position: "fixed",
            right: 20,
            bottom: 20,
            zIndex: 999,
            width: "min(380px, calc(100vw - 40px))",
            height: "min(560px, calc(100vh - 100px))",
            backgroundColor: "#ffffff",
            border: `1px solid ${SITE.color.border}`,
            boxShadow: "0 8px 32px rgba(0,0,0,0.15)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* ヘッダー */}
          <div
            style={{
              padding: "14px 16px",
              backgroundColor: SITE.color.pinkDeep,
              color: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexShrink: 0,
            }}
          >
            <div>
              <div
                style={{
                  fontFamily: SITE.font.display,
                  fontSize: 14,
                  letterSpacing: SITE.ls.wide,
                  fontWeight: 500,
                }}
              >
                ANGE SPA
              </div>
              <div
                style={{
                  fontFamily: SITE.font.serif,
                  fontSize: 10,
                  letterSpacing: SITE.ls.loose,
                  opacity: 0.9,
                  marginTop: 2,
                }}
              >
                お問い合わせボット
              </div>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button
                onClick={resetConversation}
                title="会話をリセット"
                style={{
                  width: 28,
                  height: 28,
                  border: "1px solid rgba(255,255,255,0.5)",
                  background: "transparent",
                  color: "#ffffff",
                  cursor: "pointer",
                  fontSize: 14,
                  lineHeight: 1,
                }}
              >
                ↻
              </button>
              <button
                onClick={() => setOpen(false)}
                aria-label="閉じる"
                style={{
                  width: 28,
                  height: 28,
                  border: "1px solid rgba(255,255,255,0.5)",
                  background: "transparent",
                  color: "#ffffff",
                  cursor: "pointer",
                  fontSize: 16,
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>
          </div>

          {/* メッセージエリア */}
          <div
            ref={scrollRef}
            style={{
              flex: 1,
              overflowY: "auto",
              padding: 14,
              backgroundColor: SITE.color.bgSoft,
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            {messages.map((m) => (
              <div
                key={m.id}
                style={{
                  display: "flex",
                  justifyContent: m.role === "user" ? "flex-end" : "flex-start",
                }}
              >
                <div style={{ maxWidth: "85%" }}>
                  <div
                    style={{
                      padding: "10px 14px",
                      backgroundColor:
                        m.role === "user" ? SITE.color.pink : "#ffffff",
                      color: m.role === "user" ? "#ffffff" : SITE.color.text,
                      border:
                        m.role === "user"
                          ? "none"
                          : `1px solid ${SITE.color.border}`,
                      fontFamily: SITE.font.serif,
                      fontSize: 13,
                      lineHeight: 1.7,
                      letterSpacing: SITE.ls.normal,
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                    }}
                  >
                    {m.role === "bot" ? renderWithLinks(m.content) : m.content}
                  </div>

                  {/* 評価 + CTA */}
                  {m.role === "bot" && m.showFeedbackAsk && (
                    <div
                      style={{
                        marginTop: 6,
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        fontSize: 11,
                        color: SITE.color.textMuted,
                        fontFamily: SITE.font.serif,
                      }}
                    >
                      {m.rated ? (
                        <span>
                          {m.rated === "up" ? "ありがとうございます" : "フィードバックを受け付けました"}
                        </span>
                      ) : (
                        <>
                          <span>この回答は役に立ちましたか？</span>
                          <button
                            onClick={() => rateMessage(m, "up")}
                            style={{
                              border: `1px solid ${SITE.color.border}`,
                              background: "#ffffff",
                              padding: "2px 10px",
                              cursor: "pointer",
                              fontSize: 11,
                              fontFamily: SITE.font.serif,
                            }}
                          >
                            はい
                          </button>
                          <button
                            onClick={() => rateMessage(m, "down")}
                            style={{
                              border: `1px solid ${SITE.color.border}`,
                              background: "#ffffff",
                              padding: "2px 10px",
                              cursor: "pointer",
                              fontSize: 11,
                              fontFamily: SITE.font.serif,
                            }}
                          >
                            いいえ
                          </button>
                        </>
                      )}
                    </div>
                  )}

                  {/* 会員CTA */}
                  {m.role === "bot" && m.showMemberCta && settings?.member_cta_url && (
                    <Link
                      href={settings.member_cta_url}
                      style={{
                        display: "inline-block",
                        marginTop: 8,
                        padding: "6px 14px",
                        backgroundColor: SITE.color.pinkDeep,
                        color: "#ffffff",
                        fontSize: 11,
                        fontFamily: SITE.font.serif,
                        letterSpacing: SITE.ls.loose,
                        textDecoration: "none",
                      }}
                    >
                      {settings.member_cta_text || "会員登録はこちら"}
                    </Link>
                  )}
                </div>
              </div>
            ))}

            {sending && (
              <div style={{ display: "flex", justifyContent: "flex-start" }}>
                <div
                  style={{
                    padding: "10px 14px",
                    backgroundColor: "#ffffff",
                    border: `1px solid ${SITE.color.border}`,
                    fontFamily: SITE.font.serif,
                    fontSize: 12,
                    color: SITE.color.textMuted,
                  }}
                >
                  …回答を準備中
                </div>
              </div>
            )}

            {/* FAQ クイックボタン（最初と、会話が短い間だけ） */}
            {messages.length <= 2 && featuredFaqs.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <p
                  style={{
                    fontSize: 11,
                    color: SITE.color.textMuted,
                    fontFamily: SITE.font.serif,
                    marginBottom: 6,
                    letterSpacing: SITE.ls.loose,
                  }}
                >
                  よくあるご質問
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {featuredFaqs.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => clickFaq(f)}
                      disabled={sending}
                      style={{
                        padding: "8px 12px",
                        textAlign: "left",
                        backgroundColor: "#ffffff",
                        border: `1px solid ${SITE.color.borderPink}`,
                        color: SITE.color.text,
                        fontFamily: SITE.font.serif,
                        fontSize: 12,
                        lineHeight: 1.5,
                        cursor: sending ? "default" : "pointer",
                        opacity: sending ? 0.5 : 1,
                      }}
                    >
                      {f.question}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 入力エリア */}
          <div
            style={{
              borderTop: `1px solid ${SITE.color.border}`,
              padding: 10,
              backgroundColor: "#ffffff",
              flexShrink: 0,
              display: "flex",
              gap: 6,
            }}
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  if (input.trim()) {
                    sendQuestion(input.trim());
                    setInput("");
                  }
                }
              }}
              placeholder="ご質問を入力してください"
              disabled={sending}
              style={{
                flex: 1,
                padding: "8px 10px",
                border: `1px solid ${SITE.color.border}`,
                fontFamily: SITE.font.serif,
                fontSize: 13,
                outline: "none",
              }}
            />
            <button
              onClick={() => {
                if (input.trim()) {
                  sendQuestion(input.trim());
                  setInput("");
                }
              }}
              disabled={sending || !input.trim()}
              style={{
                padding: "0 14px",
                backgroundColor: SITE.color.pinkDeep,
                color: "#ffffff",
                border: "none",
                fontFamily: SITE.font.serif,
                fontSize: 12,
                letterSpacing: SITE.ls.loose,
                cursor: sending || !input.trim() ? "default" : "pointer",
                opacity: sending || !input.trim() ? 0.5 : 1,
              }}
            >
              送信
            </button>
          </div>
        </div>
      )}
    </>
  );
}
