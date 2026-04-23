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
