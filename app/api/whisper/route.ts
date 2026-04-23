import { NextRequest, NextResponse } from "next/server";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";

/**
 * POST /api/whisper
 * 
 * 音声ファイルを受け取り、OpenAI Whisper API で文字起こしを行う
 * 
 * リクエスト: multipart/form-data
 *   - audio: Blob（webm/wav/mp3等）
 *   - language: "ja"（省略可、デフォルト日本語）
 *   - prompt: 認識精度向上のためのヒント（省略可）
 * 
 * レスポンス:
 *   { text: "文字起こし結果", duration: 秒数 }
 */
export async function POST(req: NextRequest) {
  try {
    if (!OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY が設定されていません" },
        { status: 500 }
      );
    }

    const formData = await req.formData();
    const audioFile = formData.get("audio") as File | null;
    const language = (formData.get("language") as string) || "ja";
    const prompt = (formData.get("prompt") as string) || "";

    if (!audioFile) {
      return NextResponse.json(
        { error: "audio ファイルがありません" },
        { status: 400 }
      );
    }

    // ファイルサイズチェック（25MB上限 = OpenAI API制限）
    const MAX_SIZE = 25 * 1024 * 1024;
    if (audioFile.size > MAX_SIZE) {
      return NextResponse.json(
        { error: `ファイルサイズが上限(25MB)を超えています: ${Math.round(audioFile.size / 1024 / 1024)}MB` },
        { status: 400 }
      );
    }

    // OpenAI Whisper API へリクエスト
    const whisperFormData = new FormData();
    whisperFormData.append("file", audioFile);
    whisperFormData.append("model", "whisper-1");
    whisperFormData.append("language", language);
    if (prompt) {
      whisperFormData.append("prompt", prompt);
    }
    // 日本語の固有名詞認識を強化するプロンプト
    whisperFormData.append(
      "prompt",
      "チョップ、アンジュスパ、予約、セラピスト、アロマ、リフレクソロジー、コース、指名、お客様"
    );

    const startTime = Date.now();
    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: whisperFormData,
    });

    const elapsedMs = Date.now() - startTime;

    if (!res.ok) {
      const errorText = await res.text();
      console.error("[whisper] API error:", res.status, errorText);
      return NextResponse.json(
        { error: `Whisper API エラー: ${res.status}`, detail: errorText },
        { status: res.status }
      );
    }

    const data = await res.json();

    return NextResponse.json({
      text: data.text || "",
      language: data.language || language,
      duration: data.duration || null,
      elapsed_ms: elapsedMs,
      file_size_kb: Math.round(audioFile.size / 1024),
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[whisper] exception:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
