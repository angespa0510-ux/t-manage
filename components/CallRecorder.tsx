"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useTheme } from "@/lib/theme";

type TranscriptChunk = {
  at: string; // ISO string
  text: string;
  elapsed_ms?: number;
};

type CallRecorderProps = {
  onTranscriptUpdate?: (chunks: TranscriptChunk[]) => void;
  onRecordingComplete?: (data: {
    chunks: TranscriptChunk[];
    fullText: string;
    durationSec: number;
    startedAt: Date;
    endedAt: Date;
  }) => void;
  chunkIntervalMs?: number; // 文字起こし送信間隔（デフォルト30秒）
};

/**
 * 通話録音コンポーネント
 *
 * 機能：
 * - マイクデバイス選択（PowerConf等）
 * - 録音開始/停止
 * - 音量レベル表示
 * - 録音時間表示
 * - 30秒チャンクごとにWhisper APIへ送信
 * - リアルタイム文字起こし表示
 */
export default function CallRecorder({
  onTranscriptUpdate,
  onRecordingComplete,
  chunkIntervalMs = 30000, // 30秒
}: CallRecorderProps) {
  const { T } = useTheme();

  // デバイス
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
  const [devicesLoaded, setDevicesLoaded] = useState(false);

  // 録音状態
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [volumeLevel, setVolumeLevel] = useState(0);
  const [error, setError] = useState("");

  // 文字起こし結果
  const [chunks, setChunks] = useState<TranscriptChunk[]>([]);
  const chunksRef = useRef<TranscriptChunk[]>([]);

  // refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const currentChunksRef = useRef<Blob[]>([]);
  const chunkIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef<Date | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // デバイス一覧取得
  const loadDevices = useCallback(async () => {
    try {
      // 一時的に権限取得（ラベル表示のため）
      const tempStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      tempStream.getTracks().forEach((t) => t.stop());

      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = allDevices.filter((d) => d.kind === "audioinput");
      setDevices(audioInputs);
      setDevicesLoaded(true);

      // PowerConfを自動選択
      const powerConf = audioInputs.find((d) =>
        d.label.toLowerCase().includes("powerconf")
      );
      if (powerConf) {
        setSelectedDeviceId(powerConf.deviceId);
      } else if (audioInputs.length > 0 && !selectedDeviceId) {
        setSelectedDeviceId(audioInputs[0].deviceId);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`マイクアクセスエラー: ${msg}`);
    }
  }, [selectedDeviceId]);

  useEffect(() => {
    loadDevices();
  }, [loadDevices]);

  // 音量レベル監視
  const monitorVolume = useCallback(() => {
    if (!analyserRef.current) return;
    const analyser = analyserRef.current;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    const updateVolume = () => {
      if (!analyserRef.current) return;
      analyser.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const avg = sum / dataArray.length;
      setVolumeLevel(Math.min(100, (avg / 128) * 100));
      animationFrameRef.current = requestAnimationFrame(updateVolume);
    };
    updateVolume();
  }, []);

  // チャンクを Whisper API に送信
  const sendChunkToWhisper = useCallback(async (blob: Blob): Promise<string> => {
    const formData = new FormData();
    formData.append("audio", blob, "chunk.webm");
    formData.append("language", "ja");

    const res = await fetch("/api/whisper", {
      method: "POST",
      body: formData,
    });
    if (!res.ok) {
      const errText = await res.text();
      console.error("[CallRecorder] whisper error:", errText);
      return "";
    }
    const data = await res.json();
    return data.text || "";
  }, []);

  // 一定時間ごとにチャンクを送信
  const flushChunk = useCallback(async () => {
    if (currentChunksRef.current.length === 0) return;
    const blobs = [...currentChunksRef.current];
    currentChunksRef.current = [];
    const blob = new Blob(blobs, { type: "audio/webm" });
    if (blob.size < 1000) return; // 小さすぎるチャンクは無視

    try {
      const text = await sendChunkToWhisper(blob);
      if (text.trim()) {
        const chunk: TranscriptChunk = {
          at: new Date().toISOString(),
          text: text.trim(),
        };
        chunksRef.current = [...chunksRef.current, chunk];
        setChunks((prev) => {
          const updated = [...prev, chunk];
          if (onTranscriptUpdate) onTranscriptUpdate(updated);
          return updated;
        });
      }
    } catch (e) {
      console.error("[CallRecorder] flushChunk error:", e);
    }
  }, [onTranscriptUpdate, sendChunkToWhisper]);

  // 録音開始
  const startRecording = useCallback(async () => {
    try {
      setError("");
      setChunks([]);
      chunksRef.current = [];
      currentChunksRef.current = [];

      const constraints: MediaStreamConstraints = {
        audio: selectedDeviceId
          ? {
              deviceId: { exact: selectedDeviceId },
              echoCancellation: true,
              noiseSuppression: true,
              sampleRate: 44100,
            }
          : { echoCancellation: true, noiseSuppression: true },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      // 音量監視セットアップ
      const AudioCtx = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        const audioContext = new AudioCtx();
        audioContextRef.current = audioContext;
        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        analyserRef.current = analyser;
        monitorVolume();
      }

      // MediaRecorder セットアップ
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";
      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          currentChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        // 最後のチャンクをflush
        await flushChunk();
      };

      // 1秒ごとにデータを取得
      recorder.start(1000);
      startedAtRef.current = new Date();
      setIsRecording(true);
      setElapsedSec(0);

      // 経過時間カウンタ
      elapsedIntervalRef.current = setInterval(() => {
        if (startedAtRef.current) {
          const sec = Math.floor((Date.now() - startedAtRef.current.getTime()) / 1000);
          setElapsedSec(sec);
        }
      }, 1000);

      // チャンク送信インターバル
      chunkIntervalRef.current = setInterval(() => {
        flushChunk();
      }, chunkIntervalMs);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`録音開始エラー: ${msg}`);
    }
  }, [selectedDeviceId, monitorVolume, flushChunk, chunkIntervalMs]);

  // 録音停止
  const stopRecording = useCallback(async () => {
    setIsProcessing(true);

    // インターバル停止
    if (chunkIntervalRef.current) {
      clearInterval(chunkIntervalRef.current);
      chunkIntervalRef.current = null;
    }
    if (elapsedIntervalRef.current) {
      clearInterval(elapsedIntervalRef.current);
      elapsedIntervalRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    // MediaRecorder 停止
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }

    // ストリーム停止
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    // AudioContext クローズ
    if (audioContextRef.current) {
      try {
        await audioContextRef.current.close();
      } catch {}
      audioContextRef.current = null;
    }
    analyserRef.current = null;

    const endedAt = new Date();
    const durationSec = startedAtRef.current
      ? Math.floor((endedAt.getTime() - startedAtRef.current.getTime()) / 1000)
      : 0;

    // 最後のflushを待つ
    await new Promise((r) => setTimeout(r, 1500));
    await flushChunk();

    setIsRecording(false);
    setVolumeLevel(0);
    setIsProcessing(false);

    // 完了コールバック
    if (onRecordingComplete && startedAtRef.current) {
      const latestChunks = chunksRef.current;
      onRecordingComplete({
        chunks: latestChunks,
        fullText: latestChunks.map((c) => c.text).join("\n"),
        durationSec,
        startedAt: startedAtRef.current,
        endedAt,
      });
    }
  }, [flushChunk, onRecordingComplete]);

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (chunkIntervalRef.current) clearInterval(chunkIntervalRef.current);
      if (elapsedIntervalRef.current) clearInterval(elapsedIntervalRef.current);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
      if (audioContextRef.current) {
        try {
          audioContextRef.current.close();
        } catch {}
      }
    };
  }, []);

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60).toString().padStart(2, "0");
    const s = (sec % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  return (
    <div
      className="rounded-2xl p-5 border"
      style={{ backgroundColor: T.card, borderColor: T.border }}
    >
      {/* タイトル */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[14px] font-medium" style={{ color: T.text }}>
          🎙 通話録音
        </h3>
        {isRecording && (
          <span
            className="text-[11px] px-2 py-1 rounded-full"
            style={{
              backgroundColor: "#ef4444",
              color: "white",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            ● REC {formatTime(elapsedSec)}
          </span>
        )}
      </div>

      {/* デバイス選択 */}
      {!isRecording && (
        <div className="mb-4">
          <label
            className="block text-[11px] mb-1"
            style={{ color: T.textSub }}
          >
            マイクデバイス
          </label>
          <select
            value={selectedDeviceId}
            onChange={(e) => setSelectedDeviceId(e.target.value)}
            className="w-full px-3 py-2 rounded-xl text-[12px] border"
            style={{
              backgroundColor: T.cardAlt,
              borderColor: T.border,
              color: T.text,
            }}
          >
            {!devicesLoaded && <option>読み込み中...</option>}
            {devicesLoaded && devices.length === 0 && (
              <option>デバイスなし</option>
            )}
            {devices.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || `デバイス ${d.deviceId.slice(0, 8)}`}
              </option>
            ))}
          </select>
          {devices.some((d) => d.label.toLowerCase().includes("powerconf")) && (
            <p className="text-[10px] mt-1" style={{ color: "#22c55e" }}>
              ✓ PowerConf を検出しました
            </p>
          )}
        </div>
      )}

      {/* 音量レベル */}
      {isRecording && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px]" style={{ color: T.textSub }}>
              音量レベル
            </span>
            <span
              className="text-[10px]"
              style={{
                color: T.textMuted,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {Math.round(volumeLevel)}%
            </span>
          </div>
          <div
            className="h-2 rounded-full overflow-hidden"
            style={{ backgroundColor: T.cardAlt }}
          >
            <div
              className="h-full transition-all"
              style={{
                width: `${volumeLevel}%`,
                backgroundColor:
                  volumeLevel > 70
                    ? "#ef4444"
                    : volumeLevel > 30
                    ? "#22c55e"
                    : "#c3a782",
                transition: "width 100ms linear",
              }}
            />
          </div>
        </div>
      )}

      {/* エラー表示 */}
      {error && (
        <div
          className="mb-4 p-3 rounded-xl text-[11px]"
          style={{
            backgroundColor: "rgba(239,68,68,0.1)",
            color: "#ef4444",
          }}
        >
          {error}
        </div>
      )}

      {/* ボタン */}
      <div className="flex gap-2">
        {!isRecording ? (
          <button
            onClick={startRecording}
            disabled={!selectedDeviceId || isProcessing}
            className="flex-1 px-4 py-3 rounded-xl text-[13px] font-medium cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              backgroundColor: T.accent,
              color: "white",
            }}
          >
            🎙 録音開始
          </button>
        ) : (
          <button
            onClick={stopRecording}
            disabled={isProcessing}
            className="flex-1 px-4 py-3 rounded-xl text-[13px] font-medium cursor-pointer transition-all disabled:opacity-50"
            style={{
              backgroundColor: "#ef4444",
              color: "white",
            }}
          >
            {isProcessing ? "処理中..." : "⏹ 録音停止"}
          </button>
        )}
      </div>

      {/* 処理中メッセージ */}
      {isProcessing && (
        <p
          className="text-[10px] mt-2 text-center"
          style={{ color: T.textMuted }}
        >
          最終処理中...お待ちください
        </p>
      )}

      {/* リアルタイム文字起こし表示 */}
      {chunks.length > 0 && (
        <div
          className="mt-4 p-3 rounded-xl border max-h-[300px] overflow-y-auto"
          style={{
            backgroundColor: T.cardAlt,
            borderColor: T.border,
          }}
        >
          <p
            className="text-[10px] mb-2"
            style={{ color: T.textSub }}
          >
            文字起こし（リアルタイム）
          </p>
          <div className="space-y-2">
            {chunks.map((c, i) => (
              <div key={i} className="text-[12px]" style={{ color: T.text }}>
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
                {c.text}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
