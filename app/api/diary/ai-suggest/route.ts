import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://cbewozzdyjqmhzkxsjqo.supabase.co";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";

/**
 * AI 日記サジェスト
 *
 * Body: {
 *   therapistId: number,
 *   authToken: string,
 *   hint?: string,        // 「今日は楽しかった」など、書き始めの断片やキーワード (任意)
 *   draftTitle?: string,  // すでに書きかけのタイトル (任意)
 *   draftBody?: string,   // すでに書きかけの本文 (任意)
 *   tags?: string[],      // 想定タグ (任意)
 *   tone?: "cheerful" | "elegant" | "sweet"  // 全体トーン (デフォルトcheerful)
 * }
 *
 * 返り値:
 *   {
 *     suggestions: [
 *       { tone: string, title: string, body: string, tags: string[] }
 *     ]
 *   }
 *
 * 動作:
 *   1. セラピスト認証
 *   2. 過去の自分の投稿を3-5件取得 (文体学習)
 *   3. Claude に3パターン提案させる
 *      - 元気系 / 上品系 / ちょっと甘め系
 */

const SYSTEM_PROMPT = `あなたはメンズリラクゼーションサロン「Ange Spa」のセラピスト向け写メ日記ライティングアシスタントです。

【役割】
セラピストが投稿する写メ日記の下書きを3パターン提案してください。

【セラピスト写メ日記の特徴】
- 親しみやすく、お客様にまた来たくなる感情を引き出す
- 自分の日常 + 仕事の楽しさを織り交ぜる
- 写真の内容と関連したキャッチーな出だし
- 100〜300文字程度が読みやすい
- 絵文字や顔文字を程よく使う
- 過度な性的表現・直接的なアダルト表現は避ける (アカウント停止リスクのため)
- お客様の本名・連絡先などは絶対に書かない

【3パターンのトーン】
- pattern1: 元気系 (cheerful) ✨ 明るく親しみやすく、絵文字多め
- pattern2: 上品系 (elegant) 🌸 落ち着いた大人の女性らしい文体
- pattern3: ちょっと甘え系 (sweet) 💗 お客様への感謝と少しの甘え (節度あり)

【返却フォーマット (JSONのみ、コードブロック・前置き不要)】
{
  "suggestions": [
    {
      "tone": "cheerful",
      "title": "タイトル(80文字以内)",
      "body": "本文(100〜300文字)",
      "tags": ["タグ1", "タグ2", "タグ3"]
    },
    {
      "tone": "elegant",
      "title": "...",
      "body": "...",
      "tags": [...]
    },
    {
      "tone": "sweet",
      "title": "...",
      "body": "...",
      "tags": [...]
    }
  ]
}

【ルール】
- title は短く、目を引く表現を心がける
- body は改行を1〜3回程度入れて読みやすく
- tags は記事内容に合うものを2〜4個 (例: 出勤, 感謝, 今日のコーデ, おでかけ など)
- セラピスト本人の過去の投稿スタイルがあれば、それを参考に統一感を出す`;

async function callClaude(userMessage: string, maxTokens = 3000): Promise<string> {
  if (!ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY が設定されていません");
  }

  const maxRetries = 3;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: maxTokens,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    if (res.status === 529 && attempt < maxRetries - 1) {
      await new Promise((r) => setTimeout(r, (attempt + 1) * 1000));
      continue;
    }

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error?.message || "AI呼び出しに失敗しました");
    }
    return data.content?.[0]?.text || "";
  }
  throw new Error("AI呼び出しが繰り返し失敗しました");
}

type Suggestion = {
  tone: string;
  title: string;
  body: string;
  tags: string[];
};

function parseAIResponse(text: string): Suggestion[] {
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start >= 0 && end > start) {
    cleaned = cleaned.slice(start, end + 1);
  }

  try {
    const parsed = JSON.parse(cleaned) as { suggestions?: Suggestion[] };
    if (!Array.isArray(parsed.suggestions)) return [];
    return parsed.suggestions
      .filter((s) => s && typeof s.title === "string" && typeof s.body === "string")
      .map((s) => ({
        tone: typeof s.tone === "string" ? s.tone : "neutral",
        title: s.title,
        body: s.body,
        tags: Array.isArray(s.tags) ? s.tags.filter((t) => typeof t === "string") : [],
      }));
  } catch (err) {
    console.error("AI suggestion parse failed:", text);
    return [];
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { therapistId, authToken, hint, draftTitle, draftBody, tags, tone } = body;

    if (!therapistId || !authToken) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    if (!ANTHROPIC_API_KEY) {
      return NextResponse.json({
        suggestions: [],
        warning: "AI APIキー未設定です",
      });
    }

    // セラピスト認証
    const { data: t } = await supabase
      .from("therapists")
      .select("id, name, login_password, status")
      .eq("id", therapistId)
      .maybeSingle();
    if (!t || t.login_password !== authToken || t.status !== "active") {
      return NextResponse.json({ error: "認証エラー" }, { status: 401 });
    }

    // 過去の自分の投稿を3件取得 (文体学習用)
    const { data: pastEntries } = await supabase
      .from("therapist_diary_entries")
      .select("title, body")
      .eq("therapist_id", therapistId)
      .eq("status", "published")
      .is("deleted_at", null)
      .order("published_at", { ascending: false })
      .limit(3);

    type PastEntry = { title: string; body: string };
    const past = (pastEntries || []) as PastEntry[];

    // プロンプト組み立て
    const parts: string[] = [];
    parts.push(`【セラピスト】${t.name}`);

    if (past.length > 0) {
      parts.push("\n【過去の投稿例 (文体参考)】");
      past.forEach((p, i) => {
        const bodyShort = p.body.length > 150 ? p.body.slice(0, 150) + "..." : p.body;
        parts.push(`\n${i + 1}. タイトル: ${p.title}\n本文: ${bodyShort}`);
      });
    }

    if (hint || draftTitle || draftBody || (tags && tags.length > 0)) {
      parts.push("\n【今回書きたい内容のヒント】");
      if (draftTitle) parts.push(`書きかけのタイトル: ${draftTitle}`);
      if (draftBody) parts.push(`書きかけの本文: ${draftBody}`);
      if (hint) parts.push(`キーワード/メモ: ${hint}`);
      if (tags && Array.isArray(tags) && tags.length > 0) {
        parts.push(`想定タグ: ${tags.join(", ")}`);
      }
    } else {
      parts.push("\n【今回書きたい内容のヒント】(指定なし、自由に提案してください)");
    }

    if (tone && ["cheerful", "elegant", "sweet"].includes(tone)) {
      parts.push(`\n【全体的に好まれるトーン】${tone}寄りで提案 (ただし3パターンとも提示)`);
    }

    parts.push("\n3パターンの下書きをJSONで提案してください。");

    const userMessage = parts.join("\n");
    const aiText = await callClaude(userMessage);
    const suggestions = parseAIResponse(aiText);

    if (suggestions.length === 0) {
      return NextResponse.json({
        suggestions: [],
        error: "AI提案の解析に失敗しました。もう一度お試しください。",
      });
    }

    return NextResponse.json({
      suggestions,
      pastEntryCount: past.length,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "AIサジェストに失敗しました";
    console.error("/api/diary/ai-suggest error:", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
