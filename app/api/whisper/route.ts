import { NextRequest, NextResponse } from "next/server";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";

/**
 * Whisper 認識精度向上のためのデフォルトプロンプト
 *
 * チョップ（アンジュスパ）特有の固有名詞・用語を事前に提示することで、
 * 音声からの文字起こし時に「アンジュスパ」「本指名」などを正しく認識させる。
 *
 * 設計方針:
 *  - 自然な会話例 + キーワード列挙のハイブリッド
 *  - 224トークン（≒150-200文字）以内に収める
 *  - コース名 / 時間 / 指名種別 / 予約用語 を網羅
 *
 * 注意:
 *  - プロンプトを強くしすぎるとハルシネーション（ない単語の当てはめ）が増える
 *  - 逆に弱いと固有名詞が誤認識される（「チョップ」→「チョコ」など）
 */
const DEFAULT_WHISPER_PROMPT =
  "ありがとうございます、チョップのアンジュスパです。" +
  "コースはアロマ、リフレ、リンパ、オイル、ボディ、タイ古式がございます。" +
  "60分、90分、120分、150分のご予約が多いです。" +
  "本指名、パネル指名、フリー、延長、オプション、指名料、キャンセル、" +
  "お客様、セラピスト、スタッフ、ご予約、お電話ありがとうございます。";

/**
 * POST /api/whisper
 *
 * 音声ファイルを受け取り、OpenAI Whisper API で文字起こしを行う
 *
 * リクエスト: multipart/form-data
 *   - audio: Blob（webm/wav/mp3等）
 *   - language: "ja"（省略可、デフォルト日本語）
 *   - prompt: 追加ヒント（省略可、DEFAULT_WHISPER_PROMPT に追記される）
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
    const customPrompt = (formData.get("prompt") as string) || "";

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

    // プロンプト組み立て: デフォルト + カスタム（あれば追加）
    // Whisper API は prompt フィールドに1回だけ文字列を受け取る
    const finalPrompt = customPrompt
      ? `${DEFAULT_WHISPER_PROMPT} ${customPrompt}`
      : DEFAULT_WHISPER_PROMPT;

    // OpenAI Whisper API へリクエスト
    const whisperFormData = new FormData();
    whisperFormData.append("file", audioFile);
    whisperFormData.append("model", "whisper-1");
    whisperFormData.append("language", language);
    whisperFormData.append("prompt", finalPrompt);

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
