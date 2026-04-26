"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { useStaffSession } from "../../lib/staff-session";
import { useTheme } from "../../lib/theme";
import { NavMenu } from "../../lib/nav-menu";
import { useToast } from "../../lib/toast";

type Faq = {
  id: number;
  category: string;
  question: string;
  answer: string;
  keywords: string[];
  display_order: number;
  is_active: boolean;
  is_featured: boolean;
  view_count: number;
  helpful_count: number;
  unhelpful_count: number;
};

type CacheItem = {
  id: number;
  normalized_q: string;
  original_q: string;
  answer: string;
  source: string;
  hit_count: number;
  is_approved: boolean;
  created_at: string;
};

type LogItem = {
  id: number;
  session_id: string;
  question: string;
  answer: string;
  source: string;
  used_cache: boolean;
  used_ai: boolean;
  response_time_ms: number;
  rating: number | null;
  created_at: string;
};

type Settings = {
  id: number;
  is_enabled: boolean;
  greeting_message: string;
  fallback_message: string;
  ai_enabled: boolean;
  ai_monthly_budget_jpy: number;
  ai_current_month_usage_jpy: number;
  ai_current_month: string;
  ai_stopped_reason: string | null;
  show_member_cta: boolean;
  member_cta_text: string;
  max_questions_per_session: number;
};

const CATEGORIES = ["コース・料金", "予約方法", "アクセス", "セラピスト", "支払い", "会員", "その他"];

export default function HpChatbotAdminPage() {
  const router = useRouter();
  const { dark, T } = useTheme();
  const toast = useToast();
  const { activeStaff, isRestored, isManager } = useStaffSession();

  const [tab, setTab] = useState<"faq" | "cache" | "logs" | "settings">("faq");
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [cacheItems, setCacheItems] = useState<CacheItem[]>([]);
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [editingFaq, setEditingFaq] = useState<Partial<Faq> | null>(null);
  const [filter, setFilter] = useState<"all" | "ai_only" | "low_rating">("all");

  useEffect(() => {
    if (!isRestored) return;
    if (!activeStaff) {
      router.push("/dashboard");
      return;
    }
    if (!isManager) {
      toast.show("アクセス権がありません", "error");
      router.push("/dashboard");
    }
  }, [isRestored, activeStaff, isManager, router, toast]);

  const loadFaqs = useCallback(async () => {
    const { data } = await supabase
      .from("hp_chatbot_faqs")
      .select("*")
      .order("category")
      .order("display_order");
    setFaqs(data || []);
  }, []);

  const loadCache = useCallback(async () => {
    const { data } = await supabase
      .from("hp_chatbot_cache")
      .select("*")
      .order("hit_count", { ascending: false })
      .limit(100);
    setCacheItems(data || []);
  }, []);

  const loadLogs = useCallback(async () => {
    let q = supabase.from("hp_chatbot_logs").select("*").order("created_at", { ascending: false }).limit(100);
    if (filter === "ai_only") q = q.eq("used_ai", true);
    if (filter === "low_rating") q = q.eq("rating", -1);
    const { data } = await q;
    setLogs(data || []);
  }, [filter]);

  const loadSettings = useCallback(async () => {
    const { data } = await supabase.from("hp_chatbot_settings").select("*").eq("id", 1).maybeSingle();
    setSettings(data);
  }, []);

  useEffect(() => {
    if (!activeStaff || !isManager) return;
    loadFaqs();
    loadSettings();
  }, [activeStaff, isManager, loadFaqs, loadSettings]);

  useEffect(() => {
    if (tab === "cache") loadCache();
    if (tab === "logs") loadLogs();
  }, [tab, loadCache, loadLogs]);

  const saveFaq = async () => {
    if (!editingFaq) return;
    const payload = {
      category: editingFaq.category || "その他",
      question: editingFaq.question?.trim() || "",
      answer: editingFaq.answer?.trim() || "",
      keywords: editingFaq.keywords || [],
      display_order: Number(editingFaq.display_order || 0),
      is_active: editingFaq.is_active !== false,
      is_featured: Boolean(editingFaq.is_featured),
      updated_at: new Date().toISOString(),
    };
    if (!payload.question || !payload.answer) {
      toast.show("質問と回答は必須です", "error");
      return;
    }
    if (editingFaq.id) {
      await supabase.from("hp_chatbot_faqs").update(payload).eq("id", editingFaq.id);
      toast.show("FAQを更新しました", "success");
    } else {
      await supabase.from("hp_chatbot_faqs").insert(payload);
      toast.show("FAQを追加しました", "success");
    }
    setEditingFaq(null);
    loadFaqs();
  };

  const deleteFaq = async (id: number) => {
    if (!confirm("このFAQを削除しますか?")) return;
    await supabase.from("hp_chatbot_faqs").delete().eq("id", id);
    toast.show("削除しました", "success");
    loadFaqs();
  };

  const toggleCacheApproved = async (item: CacheItem) => {
    await supabase
      .from("hp_chatbot_cache")
      .update({ is_approved: !item.is_approved, updated_at: new Date().toISOString() })
      .eq("id", item.id);
    loadCache();
  };

  const deleteCacheItem = async (id: number) => {
    if (!confirm("このキャッシュを削除しますか?")) return;
    await supabase.from("hp_chatbot_cache").delete().eq("id", id);
    loadCache();
  };

  const promoteCacheToFaq = async (item: CacheItem) => {
    if (!confirm("このキャッシュ回答をFAQに登録しますか?")) return;
    await supabase.from("hp_chatbot_faqs").insert({
      category: "その他",
      question: item.original_q,
      answer: item.answer,
      keywords: item.normalized_q.split(" ").filter((t) => t.length >= 2).slice(0, 5),
      is_active: true,
      is_featured: false,
    });
    toast.show("FAQに登録しました", "success");
    loadFaqs();
  };

  const saveSettings = async () => {
    if (!settings) return;
    await supabase
      .from("hp_chatbot_settings")
      .update({
        is_enabled: settings.is_enabled,
        greeting_message: settings.greeting_message,
        fallback_message: settings.fallback_message,
        ai_enabled: settings.ai_enabled,
        ai_monthly_budget_jpy: Number(settings.ai_monthly_budget_jpy || 0),
        show_member_cta: settings.show_member_cta,
        member_cta_text: settings.member_cta_text,
        max_questions_per_session: Number(settings.max_questions_per_session || 20),
        updated_at: new Date().toISOString(),
      })
      .eq("id", 1);
    toast.show("設定を保存しました", "success");
    loadSettings();
  };

  if (!activeStaff || !isManager) return <div style={{ padding: 40 }}>読み込み中...</div>;

  const aiUsage = settings?.ai_current_month_usage_jpy || 0;
  const aiBudget = settings?.ai_monthly_budget_jpy || 0;
  const aiPct = aiBudget > 0 ? Math.min(100, (aiUsage / aiBudget) * 100) : 0;

  return (
    <div style={{ display: "flex", minHeight: "100vh", backgroundColor: T.bg, color: T.text }}>
      <NavMenu T={T as Record<string, string>} dark={dark} />
      <main style={{ flex: 1, marginLeft: 80, padding: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 500, margin: 0, marginBottom: 8 }}>🤖 HPチャットBOT管理</h1>
        <p style={{ fontSize: 12, color: T.textSub, margin: 0, marginBottom: 20 }}>
          公式HP (ange-spa.com) に設置されたお客様チャットBOTの FAQ・キャッシュ・ログ・設定を管理します
        </p>

        {/* タブ */}
        <div style={{ display: "flex", gap: 4, borderBottom: `1px solid ${T.border}`, marginBottom: 20 }}>
          {(
            [
              { key: "faq", label: `📋 FAQ (${faqs.length})` },
              { key: "cache", label: "⚡ キャッシュ" },
              { key: "logs", label: "📊 ログ" },
              { key: "settings", label: "⚙️ 設定" },
            ] as const
          ).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                padding: "10px 18px",
                border: "none",
                borderBottom: tab === t.key ? `3px solid #c3a782` : "3px solid transparent",
                backgroundColor: "transparent",
                color: tab === t.key ? "#c3a782" : T.text,
                fontSize: 13,
                fontWeight: tab === t.key ? 600 : 400,
                cursor: "pointer",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "faq" && (
          <div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
              <button
                onClick={() =>
                  setEditingFaq({
                    category: "その他",
                    question: "",
                    answer: "",
                    keywords: [],
                    is_active: true,
                    is_featured: false,
                    display_order: faqs.length,
                  })
                }
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
                + 新規FAQ
              </button>
            </div>

            {CATEGORIES.map((cat) => {
              const catFaqs = faqs.filter((f) => f.category === cat);
              if (catFaqs.length === 0) return null;
              return (
                <div key={cat} style={{ marginBottom: 20 }}>
                  <h3 style={{ fontSize: 13, fontWeight: 600, color: T.textSub, margin: 0, marginBottom: 8 }}>
                    {cat} ({catFaqs.length}件)
                  </h3>
                  {catFaqs.map((faq) => (
                    <div
                      key={faq.id}
                      style={{
                        padding: 14,
                        marginBottom: 8,
                        borderRadius: 10,
                        border: `1px solid ${T.border}`,
                        backgroundColor: T.card,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 12 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                            {faq.is_featured && <span style={{ fontSize: 11 }}>⭐</span>}
                            {!faq.is_active && (
                              <span style={{ fontSize: 10, color: "#c45555", padding: "1px 6px", borderRadius: 4, border: "1px solid #c45555" }}>
                                非公開
                              </span>
                            )}
                            <div style={{ fontSize: 13, fontWeight: 600 }}>{faq.question}</div>
                          </div>
                          <div style={{ fontSize: 11, color: T.textSub, whiteSpace: "pre-wrap", marginBottom: 6 }}>
                            {faq.answer.length > 200 ? faq.answer.slice(0, 200) + "..." : faq.answer}
                          </div>
                          <div style={{ fontSize: 10, color: T.textSub, display: "flex", gap: 12 }}>
                            <span>👁 {faq.view_count}</span>
                            <span>👍 {faq.helpful_count}</span>
                            <span>👎 {faq.unhelpful_count}</span>
                            {(faq.keywords || []).length > 0 && (
                              <span>🔑 {faq.keywords.join(", ")}</span>
                            )}
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button
                            onClick={() => setEditingFaq(faq)}
                            style={btnSmStyle(T)}
                          >
                            編集
                          </button>
                          <button
                            onClick={() => deleteFaq(faq.id)}
                            style={{ ...btnSmStyle(T), color: "#c45555", borderColor: "#c45555" }}
                          >
                            削除
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}

        {tab === "cache" && (
          <div>
            <p style={{ fontSize: 11, color: T.textSub, marginBottom: 12 }}>
              過去の AI 回答がキャッシュされています。「承認済み」のキャッシュは次回以降 AI を使わずに即応答されます。
              品質の悪い回答は「却下」にするか、「削除」してください。
            </p>
            {cacheItems.map((item) => (
              <div
                key={item.id}
                style={{
                  padding: 12,
                  marginBottom: 8,
                  borderRadius: 8,
                  border: `1px solid ${T.border}`,
                  backgroundColor: item.is_approved ? T.card : "rgba(196,85,85,0.05)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Q. {item.original_q}</div>
                    <div style={{ fontSize: 11, color: T.textSub, whiteSpace: "pre-wrap", marginBottom: 6 }}>
                      A. {item.answer.slice(0, 200)}
                      {item.answer.length > 200 ? "..." : ""}
                    </div>
                    <div style={{ fontSize: 10, color: T.textSub, display: "flex", gap: 10 }}>
                      <span>ソース: {item.source}</span>
                      <span>ヒット: {item.hit_count}</span>
                      <span>{new Date(item.created_at).toLocaleDateString("ja-JP")}</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <button
                      onClick={() => toggleCacheApproved(item)}
                      style={{
                        ...btnSmStyle(T),
                        backgroundColor: item.is_approved ? "#22c55e" : T.card,
                        color: item.is_approved ? "#fff" : T.text,
                        borderColor: item.is_approved ? "#22c55e" : T.border,
                      }}
                    >
                      {item.is_approved ? "✅承認" : "却下中"}
                    </button>
                    <button onClick={() => promoteCacheToFaq(item)} style={btnSmStyle(T)}>
                      FAQ化
                    </button>
                    <button
                      onClick={() => deleteCacheItem(item.id)}
                      style={{ ...btnSmStyle(T), color: "#c45555", borderColor: "#c45555" }}
                    >
                      削除
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "logs" && (
          <div>
            <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
              {(
                [
                  { key: "all", label: "すべて" },
                  { key: "ai_only", label: "AI使用のみ" },
                  { key: "low_rating", label: "低評価" },
                ] as const
              ).map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  style={{
                    ...btnSmStyle(T),
                    backgroundColor: filter === f.key ? "#c3a782" : T.card,
                    color: filter === f.key ? "#fff" : T.text,
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
            {logs.map((log) => (
              <div
                key={log.id}
                style={{
                  padding: 10,
                  marginBottom: 6,
                  borderRadius: 8,
                  border: `1px solid ${T.border}`,
                  backgroundColor: T.card,
                  fontSize: 11,
                }}
              >
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                  <span
                    style={{
                      padding: "1px 6px",
                      borderRadius: 4,
                      fontSize: 9,
                      backgroundColor:
                        log.source === "faq" ? "#22c55e" : log.source === "cache" ? "#4a7ca0" : log.source === "ai" ? "#c3a782" : "#888",
                      color: "#fff",
                    }}
                  >
                    {log.source}
                  </span>
                  {log.rating === 1 && <span style={{ fontSize: 11 }}>👍</span>}
                  {log.rating === -1 && <span style={{ fontSize: 11 }}>👎</span>}
                  <span style={{ color: T.textSub, fontSize: 10 }}>
                    {new Date(log.created_at).toLocaleString("ja-JP")} · {log.response_time_ms}ms
                  </span>
                </div>
                <div style={{ fontWeight: 600, marginBottom: 3 }}>Q. {log.question}</div>
                <div style={{ color: T.textSub, whiteSpace: "pre-wrap" }}>A. {(log.answer || "").slice(0, 200)}</div>
              </div>
            ))}
          </div>
        )}

        {tab === "settings" && settings && (
          <div style={{ maxWidth: 700 }}>
            {/* AI 予算状況 */}
            <div
              style={{
                padding: 16,
                marginBottom: 20,
                borderRadius: 12,
                backgroundColor: T.card,
                border: `1px solid ${T.border}`,
              }}
            >
              <div style={{ fontSize: 12, color: T.textSub, marginBottom: 6 }}>今月のAI使用量</div>
              <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>
                ¥{Math.round(aiUsage).toLocaleString()} / ¥{Math.round(aiBudget).toLocaleString()}
              </div>
              <div
                style={{
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: T.cardAlt,
                  overflow: "hidden",
                  marginBottom: 8,
                }}
              >
                <div
                  style={{
                    width: `${aiPct}%`,
                    height: "100%",
                    backgroundColor: aiPct > 80 ? "#c45555" : aiPct > 50 ? "#f59e0b" : "#22c55e",
                    transition: "width 0.3s",
                  }}
                />
              </div>
              {settings.ai_stopped_reason && (
                <div style={{ fontSize: 11, color: "#c45555" }}>⚠️ {settings.ai_stopped_reason}</div>
              )}
            </div>

            <Field label="チャットBOTを有効化">
              <Toggle
                value={settings.is_enabled}
                onChange={(v) => setSettings({ ...settings, is_enabled: v })}
              />
            </Field>
            <Field label="挨拶メッセージ">
              <textarea
                value={settings.greeting_message}
                onChange={(e) => setSettings({ ...settings, greeting_message: e.target.value })}
                rows={3}
                style={inputStyle(T)}
              />
              <p style={{ margin: "6px 0 0", fontSize: 11, color: T.textSub, lineHeight: 1.6 }}>
                💡 URL・<code style={{ fontSize: 11 }}>/access</code> など内部パス・電話番号は自動でリンクになります
              </p>
            </Field>
            <Field label="フォールバックメッセージ (AI応答できない時)">
              <textarea
                value={settings.fallback_message}
                onChange={(e) => setSettings({ ...settings, fallback_message: e.target.value })}
                rows={2}
                style={inputStyle(T)}
              />
              <p style={{ margin: "6px 0 0", fontSize: 11, color: T.textSub, lineHeight: 1.6 }}>
                💡 「お電話で承ります <code style={{ fontSize: 11 }}>070-1675-5900</code>」のように番号を書くと自動でタップ発信できます
              </p>
            </Field>
            <Field label="AIフォールバック有効">
              <Toggle
                value={settings.ai_enabled}
                onChange={(v) => setSettings({ ...settings, ai_enabled: v })}
              />
            </Field>
            <Field label="AI月次予算 (円)">
              <input
                type="number"
                value={settings.ai_monthly_budget_jpy}
                onChange={(e) => setSettings({ ...settings, ai_monthly_budget_jpy: Number(e.target.value) })}
                style={inputStyle(T)}
              />
            </Field>
            <Field label="1セッション質問回数上限">
              <input
                type="number"
                value={settings.max_questions_per_session}
                onChange={(e) => setSettings({ ...settings, max_questions_per_session: Number(e.target.value) })}
                style={inputStyle(T)}
              />
            </Field>
            <Field label="会員登録誘導を表示">
              <Toggle
                value={settings.show_member_cta}
                onChange={(v) => setSettings({ ...settings, show_member_cta: v })}
              />
            </Field>
            <Field label="会員登録誘導メッセージ">
              <input
                value={settings.member_cta_text}
                onChange={(e) => setSettings({ ...settings, member_cta_text: e.target.value })}
                style={inputStyle(T)}
              />
            </Field>

            <button
              onClick={saveSettings}
              style={{
                marginTop: 12,
                padding: "10px 24px",
                backgroundColor: "#c3a782",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              💾 設定を保存
            </button>
          </div>
        )}
      </main>

      {/* FAQ編集モーダル */}
      {editingFaq && (
        <div
          onClick={() => setEditingFaq(null)}
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 600,
              maxHeight: "90vh",
              overflow: "auto",
              backgroundColor: T.card,
              borderRadius: 16,
              padding: 24,
            }}
          >
            <h3 style={{ margin: 0, marginBottom: 16 }}>{editingFaq.id ? "FAQ編集" : "新規FAQ"}</h3>
            <Field label="カテゴリ">
              <select
                value={editingFaq.category || "その他"}
                onChange={(e) => setEditingFaq({ ...editingFaq, category: e.target.value })}
                style={inputStyle(T)}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="質問">
              <input
                value={editingFaq.question || ""}
                onChange={(e) => setEditingFaq({ ...editingFaq, question: e.target.value })}
                placeholder="ボタンに表示する質問文"
                style={inputStyle(T)}
              />
            </Field>
            <Field label="回答">
              <textarea
                value={editingFaq.answer || ""}
                onChange={(e) => setEditingFaq({ ...editingFaq, answer: e.target.value })}
                rows={6}
                placeholder="例: アクセス情報は /access からご確認いただけます。お電話の場合は 070-1675-5900 までどうぞ。"
                style={inputStyle(T)}
              />
              <p style={{ margin: "6px 0 0", fontSize: 11, color: T.textSub, lineHeight: 1.6 }}>
                💡 <strong>以下の記法を使うと自動でクリック可能なリンクになります</strong><br />
                ・<code style={{ fontSize: 11 }}>[アクセスページ](/access)</code> → ラベル付きリンク（<strong>推奨</strong>）<br />
                ・<code style={{ fontSize: 11 }}>https://example.com</code> → 新タブで開く<br />
                ・<code style={{ fontSize: 11 }}>/access</code> や <code style={{ fontSize: 11 }}>/schedule</code> → ページ遷移<br />
                ・<code style={{ fontSize: 11 }}>070-1675-5900</code> → タップで電話発信
              </p>
            </Field>
            <Field label="キーワード (カンマ区切り)">
              <input
                value={(editingFaq.keywords || []).join(", ")}
                onChange={(e) =>
                  setEditingFaq({
                    ...editingFaq,
                    keywords: e.target.value
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  })
                }
                placeholder="料金, 値段, 価格"
                style={inputStyle(T)}
              />
            </Field>
            <Field label="表示順">
              <input
                type="number"
                value={editingFaq.display_order || 0}
                onChange={(e) => setEditingFaq({ ...editingFaq, display_order: Number(e.target.value) })}
                style={inputStyle(T)}
              />
            </Field>
            <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                <input
                  type="checkbox"
                  checked={editingFaq.is_active !== false}
                  onChange={(e) => setEditingFaq({ ...editingFaq, is_active: e.target.checked })}
                />
                公開
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                <input
                  type="checkbox"
                  checked={Boolean(editingFaq.is_featured)}
                  onChange={(e) => setEditingFaq({ ...editingFaq, is_featured: e.target.checked })}
                />
                ⭐ 初期表示
              </label>
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setEditingFaq(null)} style={btnSmStyle(T)}>
                キャンセル
              </button>
              <button
                onClick={saveFaq}
                style={{ ...btnSmStyle(T), backgroundColor: "#c3a782", color: "#fff", borderColor: "#c3a782" }}
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ fontSize: 11, color: "#888", display: "block", marginBottom: 4 }}>{label}</label>
      {children}
    </div>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      style={{
        padding: "6px 14px",
        borderRadius: 20,
        border: "none",
        backgroundColor: value ? "#22c55e" : "#888",
        color: "#fff",
        fontSize: 11,
        cursor: "pointer",
      }}
    >
      {value ? "✅ 有効" : "⛔ 無効"}
    </button>
  );
}

function inputStyle(T: Record<string, string>): React.CSSProperties {
  return {
    width: "100%",
    padding: 10,
    borderRadius: 8,
    border: `1px solid ${T.border}`,
    backgroundColor: T.bg,
    color: T.text,
    fontSize: 12,
    fontFamily: "inherit",
  };
}

function btnSmStyle(T: Record<string, string>): React.CSSProperties {
  return {
    padding: "5px 10px",
    borderRadius: 6,
    border: `1px solid ${T.border}`,
    backgroundColor: T.card,
    color: T.text,
    fontSize: 10,
    cursor: "pointer",
  };
}
