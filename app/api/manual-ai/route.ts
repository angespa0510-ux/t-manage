import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://cbewozzdyjqmhzkxsjqo.supabase.co";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNiZXdvenpkeWpxbWh6a3hzanFvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyNjU2MzYsImV4cCI6MjA4OTg0MTYzNn0.cddSSXx6OqOKNTc-WlaHTusK67sFgi8QwETnGaVGgIw";
const supabase = createClient(supabaseUrl, supabaseKey);

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";

async function callClaude(systemPrompt: string, userMessage: string, maxTokens = 1500): Promise<string> {
  if (!ANTHROPIC_API_KEY) {
    return "⚠️ AIキーが設定されていません。Vercelの環境変数にANTHROPIC_API_KEYを追加してください。";
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("Claude API error:", err);
    return `⚠️ AI応答エラー: ${res.status}`;
  }

  const data = await res.json();
  return data.content?.[0]?.text || "応答を取得できませんでした";
}

export async function POST(req: Request) {
  try {
    const { action, question, content, chatHistory, therapistName } = await req.json();

    // ── AIチャット（セラピスト向け） ──
    if (action === "chat") {
      if (!question?.trim()) {
        return NextResponse.json({ error: "質問を入力してください" }, { status: 400 });
      }

      // マニュアル記事を全取得してコンテキストに含める
      const { data: articles } = await supabase
        .from("manual_articles")
        .select("title, content, tags")
        .eq("is_published", true);

      const { data: qas } = await supabase
        .from("manual_qa")
        .select("question, answer, article_id");

      // マニュアルコンテキストを構築
      let manualContext = "【マニュアル記事一覧】\n\n";
      const articleTitles: string[] = [];
      (articles || []).forEach((a: any) => {
        articleTitles.push(a.title);
        manualContext += `## ${a.title}\n${a.content}\n\n`;
      });

      if (qas && qas.length > 0) {
        manualContext += "\n【Q&A集】\n";
        qas.forEach((q: any) => {
          manualContext += `Q: ${q.question}\nA: ${q.answer}\n\n`;
        });
      }

      // チャット履歴を含める
      let historyContext = "";
      if (chatHistory && chatHistory.length > 0) {
        historyContext = "\n【これまでの会話】\n";
        chatHistory.slice(-6).forEach((msg: any) => {
          historyContext += `${msg.role === "user" ? "セラピスト" : "AI"}: ${msg.content}\n`;
        });
      }

      const systemPrompt = `あなたはアンジュスパのマニュアルAIアシスタントです。
セラピストさんからの質問に、マニュアルの内容をもとに答えてください。
${therapistName ? `\n相手のセラピストの名前は「${therapistName}」さんです。回答の最初に「${therapistName}さん、」と名前で呼びかけてください。` : ""}

【ルール】
- 親しみやすく、やさしい口調で答えてください（女性セラピスト向け）
- マニュアルに書いてある内容を中心に回答してください
- マニュアルに載っていない内容の場合は「マニュアルにはこの情報がないので、スタッフに確認してくださいね！」と伝えてください
- 回答は簡潔に（300文字以内を目安）
- 絵文字を適度に使ってください
- マークダウン記法は使わないでください（##、**、- リスト等は使わない）
- 代わりに、普通の文章で読みやすく書いてください
- 番号付きの手順は「①②③」のように丸数字を使ってください
- 重要なポイントは「⚠️」や「💡」で強調してください

【記事リンク機能】
関連する記事がある場合は、回答の最後に以下の形式で記事リンクを付けてください：
[link:記事タイトル]
例: 詳しくは[link:精算の仕方]を見てね！
※記事タイトルは以下の一覧から正確に選んでください：
${articleTitles.join(" / ")}

${manualContext}${historyContext}`;

      const answer = await callClaude(systemPrompt, question.trim());
      return NextResponse.json({ answer });
    }

    // ── AI整理（スタッフ向け） ──
    if (action === "cleanup") {
      if (!content?.trim()) {
        return NextResponse.json({ error: "本文がありません" }, { status: 400 });
      }

      const systemPrompt = `あなたはマニュアル編集アシスタントです。
以下の文章を読みやすく整理してください。

【ルール】
- マークダウン形式で出力（## 見出し / **太字** / - リスト / 1. 番号リスト / > 引用 / --- 区切り線）
- 内容は変更せず、構成・表現・誤字のみ修正
- セラピスト女性が読みやすいよう、やさしい言葉遣いに
- 重要な注意事項は > 引用ブロックで強調
- 長い文章は見出しで区切る
- 整理後のテキストのみを出力（説明文は不要）`;

      const cleaned = await callClaude(systemPrompt, content.trim(), 3000);
      return NextResponse.json({ cleaned });
    }

    // ── タグ自動生成（スタッフ向け） ──
    if (action === "tags") {
      if (!content?.trim()) {
        return NextResponse.json({ error: "本文がありません" }, { status: 400 });
      }

      // 既存タグを取得
      const { data: articles } = await supabase
        .from("manual_articles")
        .select("tags");
      const existingTags = Array.from(new Set((articles || []).flatMap((a: any) => a.tags || [])));

      const systemPrompt = `あなたはマニュアルのタグ生成AIです。
記事の内容から適切なタグを3〜5個提案してください。

【既存タグ一覧】
${existingTags.join(", ")}

【ルール】
- 既存タグがあればそれを優先的に使う
- 新しいタグは短く（2〜4文字）
- カンマ区切りでタグのみを出力（説明不要）
- 例: 清掃, 基本, チェックリスト`;

      const tagsText = await callClaude(systemPrompt, content.trim(), 200);
      const tags = tagsText.split(/[,、，]/).map((t: string) => t.trim()).filter((t: string) => t.length > 0 && t.length < 20);
      return NextResponse.json({ tags });
    }

    return NextResponse.json({ error: "不明なアクション" }, { status: 400 });
  } catch (err: any) {
    console.error("Manual AI error:", err);
    return NextResponse.json({ error: "エラーが発生しました: " + err.message }, { status: 500 });
  }
}
