"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { useStaffSession } from "../../lib/staff-session";
import { useTheme } from "../../lib/theme";
import CallRecorder from "../../components/CallRecorder";

type TranscriptChunk = {
  at: string;
  text: string;
};

type ExtractedInfo = {
  customer_name?: string;
  phone_number?: string;
  date_time?: string;
  course?: string;
  notes?: string;
};

type MatchedCustomer = {
  id: number;
  name: string;
  kana?: string;
  phone?: string;
  phone2?: string;
  phone3?: string;
  rank?: string;
  last_visit_date?: string;
  visit_count?: number;
  match_reason: "phone" | "name";
};

type AnalysisResult = {
  summary: string;
  intent: string;
  sentiment: string;
  extracted: ExtractedInfo;
  warnings: string[];
  matched_customers: MatchedCustomer[];
  model_used: string;
  escalated: boolean;
  escalation_reason?: string;
  usage?: { input_tokens: number; output_tokens: number };
};

type CallTranscript = {
  id: number;
  staff_name: string;
  customer_name: string;
  phone_number: string;
  started_at: string;
  ended_at: string | null;
  duration_sec: number;
  transcript_full: string;
  transcript_chunks: TranscriptChunk[] | null;
  ai_summary: string;
  ai_intent?: string;
  ai_sentiment?: string;
  ai_extracted?: ExtractedInfo | null;
  ai_warnings?: string[] | null;
  ai_model_used?: string;
  escalated_to_opus?: boolean;
  note: string;
  recording_reason: string;
  created_at: string;
};

export default function CallTestPage() {
  const router = useRouter();
  const { activeStaff, canAccessCallAssistant } = useStaffSession();
  const { T } = useTheme();

  const [transcripts, setTranscripts] = useState<CallTranscript[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResults, setAnalysisResults] = useState<
    Record<number, AnalysisResult>
  >({});

  // アクセス権チェック
  useEffect(() => {
    if (activeStaff === null) {
      // まだロード中
      return;
    }
    if (!canAccessCallAssistant) {
      router.push("/dashboard");
    }
  }, [activeStaff, canAccessCallAssistant, router]);

  // 通話履歴取得
  const loadTranscripts = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("call_transcripts")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(50);
    if (!error && data) {
      setTranscripts(data as CallTranscript[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (canAccessCallAssistant) {
      loadTranscripts();
    }
  }, [canAccessCallAssistant, loadTranscripts]);

  // 録音完了ハンドラ
  const handleRecordingComplete = useCallback(
    async (data: {
      chunks: TranscriptChunk[];
      fullText: string;
      durationSec: number;
      startedAt: Date;
      endedAt: Date;
    }) => {
      if (!activeStaff) return;
      setSaving(true);
      try {
        const { error } = await supabase.from("call_transcripts").insert({
          staff_id: activeStaff.id,
          staff_name: activeStaff.name,
          started_at: data.startedAt.toISOString(),
          ended_at: data.endedAt.toISOString(),
          duration_sec: data.durationSec,
          transcript_full: data.fullText,
          transcript_chunks: data.chunks,
          recording_reason: "manual",
          ai_model_used: "sonnet-4-6",
        });
        if (error) {
          console.error("[call-test] save error:", error);
          alert("保存に失敗しました: " + error.message);
        } else {
          await loadTranscripts();
        }
      } catch (e) {
        console.error("[call-test] exception:", e);
      } finally {
        setSaving(false);
      }
    },
    [activeStaff, loadTranscripts]
  );

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}分${s.toString().padStart(2, "0")}秒`;
  };

  // AI分析実行
  const handleAnalyze = useCallback(
    async (callId: number, forceOpus: boolean = false) => {
      const target = transcripts.find((t) => t.id === callId);
      if (!target || !target.transcript_full) {
        alert("文字起こしが空のため分析できません");
        return;
      }
      setAnalyzing(true);
      try {
        const res = await fetch("/api/call-analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            transcript: target.transcript_full,
            call_id: callId,
            force_opus: forceOpus,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          alert("分析に失敗しました: " + (data?.error || res.status));
          return;
        }
        setAnalysisResults((prev) => ({ ...prev, [callId]: data }));
        // DB側も更新されたので履歴を再読み込み
        await loadTranscripts();
      } catch (e) {
        console.error("[call-test] analyze error:", e);
        alert("分析リクエストでエラーが発生しました");
      } finally {
        setAnalyzing(false);
      }
    },
    [transcripts, loadTranscripts]
  );

  // 予約下書きから /timechart にクエリパラメータで遷移
  const handleCreateDraft = useCallback(
    (callId: number, customerId?: number) => {
      const result = analysisResults[callId];
      if (!result) return;
      const params = new URLSearchParams();
      if (customerId) params.set("customer_id", String(customerId));
      if (result.extracted.customer_name)
        params.set("customer_name", result.extracted.customer_name);
      if (result.extracted.phone_number)
        params.set("phone", result.extracted.phone_number);
      if (result.extracted.date_time)
        params.set("date_time", result.extracted.date_time);
      if (result.extracted.course)
        params.set("course", result.extracted.course);
      if (result.extracted.notes) params.set("notes", result.extracted.notes);
      params.set("from", "call_ai");
      params.set("call_id", String(callId));
      router.push(`/timechart?${params.toString()}`);
    },
    [analysisResults, router]
  );

  const formatDateTime = (iso: string) => {
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${d
      .getMinutes()
      .toString()
      .padStart(2, "0")}`;
  };

  // アクセス権チェック中
  if (activeStaff === null) {
    return (
      <div className="p-8" style={{ color: T.textSub }}>
        読み込み中...
      </div>
    );
  }

  if (!canAccessCallAssistant) {
    return null; // リダイレクト中
  }

  const selectedTranscript = selectedId
    ? transcripts.find((t) => t.id === selectedId)
    : null;

  return (
    <div className="min-h-screen" style={{ backgroundColor: T.bg }}>
      <div className="max-w-[1200px] mx-auto p-4 md:p-6">
        {/* ヘッダー */}
        <div className="mb-6">
          <h1
            className="text-[20px] md:text-[24px] font-medium mb-1"
            style={{ color: T.text }}
          >
            🎙 通話AI アシスタント
          </h1>
          <p className="text-[12px]" style={{ color: T.textSub }}>
            Phase 1 テスト版 — 録音・文字起こしのみ
          </p>
        </div>

        {/* 情報バナー */}
        <div
          className="mb-6 p-4 rounded-2xl border"
          style={{
            backgroundColor: "rgba(195,167,130,0.08)",
            borderColor: T.border,
          }}
        >
          <p className="text-[12px] mb-2" style={{ color: T.text }}>
            <strong>📋 Phase 1 スコープ</strong>
          </p>
          <ul className="text-[11px] space-y-1" style={{ color: T.textSub }}>
            <li>• PowerConf 等のマイクで通話を録音</li>
            <li>• 30秒ごとに OpenAI Whisper で文字起こし</li>
            <li>• 通話履歴を 90 日間保存（音声は保存しません）</li>
            <li>• AI 分析・予約自動入力は Phase 2 以降で実装予定</li>
          </ul>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* 左: 録音UI */}
          <div>
            <CallRecorder
              onRecordingComplete={handleRecordingComplete}
              chunkIntervalMs={30000}
            />
            {saving && (
              <div
                className="mt-3 p-3 rounded-xl text-[11px] text-center"
                style={{
                  backgroundColor: T.cardAlt,
                  color: T.textSub,
                }}
              >
                通話データを保存中...
              </div>
            )}
          </div>

          {/* 右: 通話履歴一覧 */}
          <div
            className="rounded-2xl p-4 border"
            style={{ backgroundColor: T.card, borderColor: T.border }}
          >
            <h3
              className="text-[14px] font-medium mb-3"
              style={{ color: T.text }}
            >
              📋 通話履歴
              <span
                className="text-[10px] ml-2 font-normal"
                style={{ color: T.textMuted }}
              >
                （最新 50 件）
              </span>
            </h3>

            {loading && (
              <p className="text-[11px]" style={{ color: T.textSub }}>
                読み込み中...
              </p>
            )}

            {!loading && transcripts.length === 0 && (
              <p
                className="text-[11px] text-center py-8"
                style={{ color: T.textMuted }}
              >
                まだ通話履歴がありません
              </p>
            )}

            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {transcripts.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setSelectedId(t.id === selectedId ? null : t.id)}
                  className="w-full text-left p-3 rounded-xl border transition-all cursor-pointer hover:opacity-80"
                  style={{
                    backgroundColor: selectedId === t.id ? T.accentBg : T.cardAlt,
                    borderColor:
                      selectedId === t.id ? T.accent : T.border,
                  }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className="text-[11px] font-medium"
                      style={{ color: T.text }}
                    >
                      {formatDateTime(t.started_at)}
                    </span>
                    <span
                      className="text-[10px]"
                      style={{
                        color: T.textMuted,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {formatDuration(t.duration_sec)}
                    </span>
                  </div>
                  <p
                    className="text-[10px] mb-1"
                    style={{ color: T.textSub }}
                  >
                    対応: {t.staff_name || "不明"}
                  </p>
                  {t.transcript_full && (
                    <p
                      className="text-[11px] line-clamp-2"
                      style={{ color: T.textMuted }}
                    >
                      {t.transcript_full.slice(0, 80)}
                      {t.transcript_full.length > 80 ? "..." : ""}
                    </p>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 選択した通話の詳細 */}
        {selectedTranscript && (
          <div
            className="mt-6 rounded-2xl p-5 border"
            style={{ backgroundColor: T.card, borderColor: T.border }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3
                className="text-[14px] font-medium"
                style={{ color: T.text }}
              >
                📄 通話詳細
              </h3>
              <button
                onClick={() => setSelectedId(null)}
                className="text-[11px] px-3 py-1 rounded-xl cursor-pointer"
                style={{ color: T.textSub, backgroundColor: T.cardAlt }}
              >
                閉じる
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4 text-[12px]">
              <div>
                <p className="text-[10px]" style={{ color: T.textSub }}>
                  日時
                </p>
                <p style={{ color: T.text }}>
                  {new Date(selectedTranscript.started_at).toLocaleString(
                    "ja-JP"
                  )}
                </p>
              </div>
              <div>
                <p className="text-[10px]" style={{ color: T.textSub }}>
                  通話時間
                </p>
                <p style={{ color: T.text }}>
                  {formatDuration(selectedTranscript.duration_sec)}
                </p>
              </div>
              <div>
                <p className="text-[10px]" style={{ color: T.textSub }}>
                  対応スタッフ
                </p>
                <p style={{ color: T.text }}>
                  {selectedTranscript.staff_name || "不明"}
                </p>
              </div>
              <div>
                <p className="text-[10px]" style={{ color: T.textSub }}>
                  録音理由
                </p>
                <p style={{ color: T.text }}>
                  {selectedTranscript.recording_reason === "manual"
                    ? "手動録音"
                    : selectedTranscript.recording_reason}
                </p>
              </div>
            </div>

            <div className="mb-4">
              <p className="text-[11px] mb-2" style={{ color: T.textSub }}>
                📝 文字起こし全文
              </p>
              <div
                className="p-3 rounded-xl text-[12px] whitespace-pre-wrap"
                style={{
                  backgroundColor: T.cardAlt,
                  color: T.text,
                  lineHeight: 1.7,
                }}
              >
                {selectedTranscript.transcript_full || "（文字起こしなし）"}
              </div>
            </div>

            {/* === AI分析セクション === */}
            {(() => {
              const analysis =
                analysisResults[selectedTranscript.id] ||
                (selectedTranscript.ai_summary
                  ? {
                      summary: selectedTranscript.ai_summary,
                      intent: selectedTranscript.ai_intent || "",
                      sentiment: selectedTranscript.ai_sentiment || "",
                      extracted: selectedTranscript.ai_extracted || {},
                      warnings: selectedTranscript.ai_warnings || [],
                      matched_customers: [],
                      model_used: selectedTranscript.ai_model_used || "",
                      escalated: selectedTranscript.escalated_to_opus || false,
                    }
                  : null);

              const intentLabel: Record<string, string> = {
                booking: "📅 予約",
                inquiry: "❓ 問合せ",
                complaint: "⚠️ クレーム",
                cancel: "🔄 キャンセル",
                other: "📞 その他",
              };

              const sentimentLabel: Record<string, { label: string; color: string }> = {
                positive: { label: "😊 ポジティブ", color: "#22c55e" },
                neutral: { label: "😐 ニュートラル", color: T.textSub },
                negative: { label: "😠 ネガティブ", color: "#c45555" },
              };

              if (!analysis) {
                // 未分析 → 分析ボタン
                return (
                  <div className="mb-4">
                    <button
                      onClick={() => handleAnalyze(selectedTranscript.id)}
                      disabled={analyzing || !selectedTranscript.transcript_full}
                      className="w-full px-4 py-3 rounded-xl text-[13px] font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{
                        backgroundColor: T.accent,
                        color: "#ffffff",
                      }}
                    >
                      {analyzing ? "🤖 分析中..." : "🤖 AIで分析する"}
                    </button>
                    <p
                      className="text-[10px] text-center mt-2"
                      style={{ color: T.textMuted }}
                    >
                      Claude Sonnet 4.6 で通話内容を分析します
                    </p>
                  </div>
                );
              }

              return (
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[11px]" style={{ color: T.textSub }}>
                      🤖 AI分析結果
                      <span
                        className="text-[10px] ml-2"
                        style={{ color: T.textMuted }}
                      >
                        ({analysis.model_used || "sonnet-4-6"}
                        {analysis.escalated ? " → opus" : ""})
                      </span>
                    </p>
                    <button
                      onClick={() => handleAnalyze(selectedTranscript.id, true)}
                      disabled={analyzing}
                      className="text-[10px] px-2 py-1 rounded-lg cursor-pointer disabled:opacity-50"
                      style={{
                        backgroundColor: T.cardAlt,
                        color: T.textSub,
                      }}
                      title="Opus 4.7 で再分析"
                    >
                      🔄 Opusで再分析
                    </button>
                  </div>

                  {/* サマリー */}
                  {analysis.summary && (
                    <div
                      className="p-3 rounded-xl mb-3 text-[12px]"
                      style={{
                        backgroundColor: "rgba(195,167,130,0.08)",
                        color: T.text,
                        lineHeight: 1.7,
                      }}
                    >
                      {analysis.summary}
                    </div>
                  )}

                  {/* 意図・感情 */}
                  <div className="flex gap-2 mb-3 flex-wrap">
                    {analysis.intent && (
                      <span
                        className="text-[11px] px-3 py-1 rounded-full"
                        style={{
                          backgroundColor: T.cardAlt,
                          color: T.text,
                        }}
                      >
                        {intentLabel[analysis.intent] || analysis.intent}
                      </span>
                    )}
                    {analysis.sentiment && sentimentLabel[analysis.sentiment] && (
                      <span
                        className="text-[11px] px-3 py-1 rounded-full"
                        style={{
                          backgroundColor: T.cardAlt,
                          color: sentimentLabel[analysis.sentiment].color,
                        }}
                      >
                        {sentimentLabel[analysis.sentiment].label}
                      </span>
                    )}
                  </div>

                  {/* 抽出情報 */}
                  {analysis.extracted && Object.keys(analysis.extracted).length > 0 && (
                    <div
                      className="p-3 rounded-xl mb-3"
                      style={{ backgroundColor: T.cardAlt }}
                    >
                      <p
                        className="text-[10px] mb-2"
                        style={{ color: T.textSub }}
                      >
                        ✨ 抽出情報
                      </p>
                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                        {analysis.extracted.customer_name && (
                          <div>
                            <span style={{ color: T.textMuted }}>氏名: </span>
                            <span style={{ color: T.text }}>
                              {analysis.extracted.customer_name}
                            </span>
                          </div>
                        )}
                        {analysis.extracted.phone_number && (
                          <div>
                            <span style={{ color: T.textMuted }}>電話: </span>
                            <span style={{ color: T.text }}>
                              {analysis.extracted.phone_number}
                            </span>
                          </div>
                        )}
                        {analysis.extracted.date_time && (
                          <div>
                            <span style={{ color: T.textMuted }}>日時: </span>
                            <span style={{ color: T.text }}>
                              {analysis.extracted.date_time}
                            </span>
                          </div>
                        )}
                        {analysis.extracted.course && (
                          <div>
                            <span style={{ color: T.textMuted }}>コース: </span>
                            <span style={{ color: T.text }}>
                              {analysis.extracted.course}
                            </span>
                          </div>
                        )}
                        {analysis.extracted.notes && (
                          <div className="col-span-2">
                            <span style={{ color: T.textMuted }}>備考: </span>
                            <span style={{ color: T.text }}>
                              {analysis.extracted.notes}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* 警告 */}
                  {analysis.warnings && analysis.warnings.length > 0 && (
                    <div
                      className="p-3 rounded-xl mb-3"
                      style={{
                        backgroundColor: "rgba(245,158,11,0.08)",
                        border: `1px solid rgba(245,158,11,0.3)`,
                      }}
                    >
                      <p
                        className="text-[10px] mb-1"
                        style={{ color: "#f59e0b" }}
                      >
                        ⚠️ 確認すべき点
                      </p>
                      <ul className="text-[11px] space-y-1" style={{ color: T.text }}>
                        {analysis.warnings.map((w, i) => (
                          <li key={i}>・{w}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* 顧客候補 */}
                  {analysis.matched_customers &&
                    analysis.matched_customers.length > 0 && (
                      <div className="mb-3">
                        <p
                          className="text-[10px] mb-2"
                          style={{ color: T.textSub }}
                        >
                          👤 マッチした顧客候補（{analysis.matched_customers.length}件）
                        </p>
                        <div className="space-y-2">
                          {analysis.matched_customers.map((c) => (
                            <div
                              key={c.id}
                              className="p-3 rounded-xl border flex items-center justify-between"
                              style={{
                                backgroundColor: T.cardAlt,
                                borderColor: T.border,
                              }}
                            >
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span
                                    className="text-[12px] font-medium"
                                    style={{ color: T.text }}
                                  >
                                    {c.name}
                                  </span>
                                  <span
                                    className="text-[9px] px-2 py-0.5 rounded-full"
                                    style={{
                                      backgroundColor:
                                        c.match_reason === "phone"
                                          ? "rgba(34,197,94,0.15)"
                                          : "rgba(74,124,160,0.15)",
                                      color:
                                        c.match_reason === "phone"
                                          ? "#22c55e"
                                          : "#4a7ca0",
                                    }}
                                  >
                                    {c.match_reason === "phone"
                                      ? "📞 電話一致"
                                      : "👤 氏名一致"}
                                  </span>
                                </div>
                                <p
                                  className="text-[10px]"
                                  style={{ color: T.textSub }}
                                >
                                  {c.phone || c.phone2 || c.phone3 || "電話なし"}
                                  {c.visit_count
                                    ? ` ・ ${c.visit_count}回来店`
                                    : ""}
                                </p>
                              </div>
                              <button
                                onClick={() =>
                                  handleCreateDraft(selectedTranscript.id, c.id)
                                }
                                className="text-[10px] px-3 py-1.5 rounded-lg cursor-pointer ml-2"
                                style={{
                                  backgroundColor: T.accent,
                                  color: "#ffffff",
                                }}
                              >
                                予約下書き
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  {/* 予約下書き（新規顧客の場合） */}
                  {analysis.intent === "booking" && (
                    <button
                      onClick={() => handleCreateDraft(selectedTranscript.id)}
                      className="w-full px-4 py-2.5 rounded-xl text-[12px] font-medium cursor-pointer mt-2"
                      style={{
                        backgroundColor: T.accent,
                        color: "#ffffff",
                      }}
                    >
                      ✨ 新規顧客として予約下書きを作成
                    </button>
                  )}
                </div>
              );
            })()}

            {selectedTranscript.transcript_chunks &&
              selectedTranscript.transcript_chunks.length > 0 && (
                <div>
                  <p className="text-[11px] mb-2" style={{ color: T.textSub }}>
                    ⏱ チャンク別（30秒ごと）
                  </p>
                  <div
                    className="p-3 rounded-xl space-y-2 text-[11px]"
                    style={{ backgroundColor: T.cardAlt }}
                  >
                    {selectedTranscript.transcript_chunks.map((c, i) => (
                      <div key={i}>
                        <span
                          className="text-[10px] mr-2"
                          style={{ color: T.textMuted }}
                        >
                          {new Date(c.at).toLocaleTimeString("ja-JP", {
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          })}
                        </span>
                        <span style={{ color: T.text }}>{c.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
          </div>
        )}
      </div>
    </div>
  );
}
