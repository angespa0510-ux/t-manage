import { NextResponse } from "next/server";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";

/**
 * 日記投稿の AI チェック (事前提案)
 *
 * Body: { title: string, body: string, sendToEkichika?: boolean }
 *
 * 返り値:
 *   {
 *     ok: boolean,                    // 投稿OKか
 *     severity: "ok" | "warn" | "ng", // 問題の深刻度
 *     issues: [
 *       { type: string, location: string, original: string, reason: string, suggestion: string }
 *     ],
 *     advice: string,                 // 全体的なアドバイス (集客向上)
 *     improvedTitle?: string,          // 改善版タイトル (任意)
 *     improvedBody?: string,           // 改善版本文 (任意)
 *   }
 *
 * チェック観点:
 *   1. NGワード (公序良俗、アダルト直接表現、誇大広告)
 *   2. 個人情報漏洩 (お客様の名前/連絡先)
 *   3. 他店比較・誹謗中傷
 *   4. 駅ちかなどポータル規約違反になりそうな表現
 *   5. SEO的・集客的な改善余地 (ハッシュタグ提案、長すぎ/短すぎ)
 */

const SYSTEM_PROMPT = `あなたはメンズリラクゼーションサロン「Ange Spa」の写メ日記投稿アシスタントです。
セラピストが投稿しようとしている日記を、以下の観点でチェックし、JSON形式で返してください。

【チェック観点】
1. NGワード: 公序良俗、アダルト直接表現(サービス内容のうち性的な部分の明示)、過激な誘惑表現
2. 個人情報: お客様の本名、電話番号、住所、車のナンバー、勤務先などの漏洩
3. 他店比較・誹謗中傷: 他サロンや他のセラピストへのネガティブ言及
4. 駅ちか等メンズエステポータルの規約違反になりそうな表現:
   - 性的サービスの暗示・直接表現
   - 過度に挑発的な内容
5. 改善余地: 長すぎ/短すぎ、ハッシュタグ追加で集客向上、より魅力的な表現

【深刻度の基準】
- "ng": 明確な規約違反・個人情報漏洩。投稿してはいけない
- "warn": 注意すべき表現があるが、修正すれば投稿可能
- "ok": 問題なし、もしくは軽微な改善提案のみ

【返却フォーマット (必ずJSONのみ、コードブロックも前置きも不要)】
{
  "severity": "ok" | "warn" | "ng",
  "ok": true | false,
  "issues": [
    {
      "type": "NGワード" | "個人情報" | "誹謗中傷" | "ポータル規約" | "改善提案",
      "location": "タイトル" | "本文" | "全体",
      "original": "問題のある原文の該当部分(短く抜粋、最大30文字)",
      "reason": "なぜ問題かの簡潔な説明(50文字以内)",
      "suggestion": "具体的な修正案(80文字以内)"
    }
  ],
  "advice": "全体的なアドバイス(120文字以内、集客向上に役立つこと)",
  "improvedTitle": "改善版タイトル (issues に問題があるときのみ提示、最大80文字)",
  "improvedBody": "改善版本文 (issues に問題があるときのみ提示、最大2000文字)"
}

【重要なルール】
- issuesが空配列の場合は ok: true / severity: "ok" にする
- improvedTitle/improvedBody は問題があるとき以外は省略 (null) でOK
- アダルト直接表現の例: 「ご奉仕」「密着」「むらむら」「いやらしい」「えっち」「卑猥」「シックスナイン」など。これらが含まれていたら必ず "ng" にし、置換案を提示する
- セラピスト視点の楽しい・癒しを伝える表現はOK。「一緒に過ごせて嬉しかった」「リラックスして頂けるよう頑張った」など
- お客様情報は実名/詳細NG。「Tさん」「常連様」「お客様」などの匿名表現はOK`;

async function callClaude(userMessage: string, maxTokens = 2500): Promise<string> {
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
    const text = data.content?.[0]?.text || "";
    return text;
  }
  throw new Error("AI呼び出しが繰り返し失敗しました");
}

type CheckResult = {
  severity: "ok" | "warn" | "ng";
  ok: boolean;
  issues: Array<{
    type: string;
    location: string;
    original: string;
    reason: string;
    suggestion: string;
  }>;
  advice: string;
  improvedTitle?: string | null;
  improvedBody?: string | null;
};

function parseAIResponse(text: string): CheckResult {
  // JSON抽出 (コードブロックがついていても剥がす)
  let cleaned = text.trim();
  // ```json ... ``` を剥がす
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "");
  // 最初の { から最後の } までを抽出 (前置き対策)
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start >= 0 && end > start) {
    cleaned = cleaned.slice(start, end + 1);
  }

  try {
    const parsed = JSON.parse(cleaned) as CheckResult;
    // 安全な値に正規化
    if (!["ok", "warn", "ng"].includes(parsed.severity)) {
      parsed.severity = "warn";
    }
    if (typeof parsed.ok !== "boolean") {
      parsed.ok = parsed.severity !== "ng";
    }
    if (!Array.isArray(parsed.issues)) {
      parsed.issues = [];
    }
    if (typeof parsed.advice !== "string") {
      parsed.advice = "";
    }
    return parsed;
  } catch (err) {
    // パース失敗時は安全側に倒す
    console.error("AI response parse failed:", text);
    return {
      severity: "warn",
      ok: true,
      issues: [],
      advice: "AI応答の解析に失敗しました。手動で確認の上、投稿してください。",
    };
  }
}

export async function POST(req: Request) {
  try {
    const { title, body, sendToEkichika } = await req.json();

    if (!title || typeof title !== "string") {
      return NextResponse.json({ error: "title が必要です" }, { status: 400 });
    }
    if (!body || typeof body !== "string") {
      return NextResponse.json({ error: "body が必要です" }, { status: 400 });
    }

    if (!ANTHROPIC_API_KEY) {
      // AI無効時はチェック通過させる (邪魔しない)
      return NextResponse.json({
        severity: "ok",
        ok: true,
        issues: [],
        advice: "AIチェックは現在利用できません。",
      });
    }

    const userMessage = `以下の日記投稿をチェックしてください。

【タイトル】
${title}

【本文】
${body}

【投稿先】
HPの写メ日記${sendToEkichika ? " + 駅ちか等メンズエステポータル6社へ自動転送" : "のみ"}

JSONで返してください。`;

    const aiText = await callClaude(userMessage);
    const result = parseAIResponse(aiText);

    return NextResponse.json(result);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "AI チェックに失敗しました";
    console.error("/api/diary/ai-check error:", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
