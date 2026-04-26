import { NextResponse } from "next/server";

/**
 * ═══════════════════════════════════════════════════════════
 * アンケート AI 言語化補助 API
 *
 * POST /api/survey/ai-compose
 *
 * 設計書の絶対原則:
 *   1. AIは「書かない」、「言語化を助ける」だけ
 *   2. お客様の入力にないことは絶対に追加しない
 *   3. お客様自身の言葉を尊重する
 *
 * リクエスト:
 *   {
 *     ratingOverall: number,        // 1-5
 *     highlights?: string[],        // 印象に残ったポイント
 *     goodPoints?: string,          // 良かった点（自由記述）
 *     improvementPoints?: string,   // 改善希望（自由記述）
 *     therapistMessage?: string,    // セラピストへのメッセージ
 *     therapistName?: string,       // セラピスト名（プロンプトに使用）
 *   }
 *
 * 返却:
 *   { composedText: string }
 *
 * モデル: claude-sonnet-4-6
 * 設計: docs/14_REVIEW_SYSTEM.md
 * ═══════════════════════════════════════════════════════════
 */

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";

const SYSTEM_PROMPT = `あなたはメンズリラクゼーションサロン「Ange Spa」のお客様アンケート整理アシスタントです。

【あなたの役割】
お客様がアンケートに入力した内容を、自然な口コミ文章として「整理」する。
新しい情報を加えたり、感想を作ったりは絶対にしない。あくまでお客様の言葉を活かす。

【絶対原則】
1. お客様が書いた内容にないことは絶対に書かない（賞賛も誇張もしない）
2. お客様自身の言葉やニュアンスを尊重する
3. 個人情報（お客様自身やセラピストの本名・電話番号・住所など）は含めない
4. 政治・宗教・他社批判・身バレに繋がる具体的な情報は含めない

【出力フォーマット】
- 100〜300文字程度の自然な日本語
- 「ですます」調
- 絵文字は使っても1〜2個まで
- 改行は適度に（2〜3段落程度）
- 過剰な賛美や誇張は避け、真摯で誠実なトーン
- セラピスト名は「担当の方」「○○さん」と最小限の言及にとどめる

【出力のルール】
- 文章のみを返す。前置きや「以下が整理した文章です」のような説明は不要
- マークダウンのコードブロックや引用符は使わない
- 改行はそのまま含めて良い

【お客様が何も書いていない項目について】
- ratingが低くても、お客様が書いていない不満は捏造しない
- highlightsしか入力がない場合は、それを基にした短い文章で十分
- 入力が極端に少ない場合は、無理に長文化しない（50〜100文字でも可）`;

export async function POST(req: Request) {
  try {
    if (!ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: "AI機能が利用できません（API key 未設定）" },
        { status: 500 }
      );
    }

    const body = await req.json();
    const {
      ratingOverall,
      highlights,
      goodPoints,
      improvementPoints,
      therapistMessage,
      therapistName,
    } = body;

    // 入力が少なすぎる場合はAIを呼ばない
    const hasContent =
      (highlights && highlights.length > 0) ||
      (goodPoints && goodPoints.trim().length > 0) ||
      (improvementPoints && improvementPoints.trim().length > 0) ||
      (therapistMessage && therapistMessage.trim().length > 0);

    if (!hasContent) {
      return NextResponse.json(
        { error: "ご感想を1つ以上ご入力ください" },
        { status: 400 }
      );
    }

    // ─────────────────────────────────────
    // ユーザーメッセージ組み立て
    // ─────────────────────────────────────
    const lines: string[] = [];
    lines.push("以下はアンケートにいただいたお客様のご回答です。これを元に自然な口コミ文章として整理してください。");
    lines.push("");
    lines.push(`【総合満足度】 ${"★".repeat(ratingOverall || 0)}（${ratingOverall || 0}/5）`);
    if (therapistName) {
      lines.push(`【担当セラピスト】 ${therapistName}（文章中では「担当の方」「${therapistName}さん」と最小限言及）`);
    }
    if (highlights && highlights.length > 0) {
      lines.push(`【印象に残ったポイント】 ${highlights.join("、")}`);
    }
    if (goodPoints && goodPoints.trim().length > 0) {
      lines.push(`【良かった点（お客様の言葉）】`);
      lines.push(goodPoints.trim());
    }
    if (improvementPoints && improvementPoints.trim().length > 0) {
      lines.push(`【改善ご要望（お客様の言葉）】`);
      lines.push(improvementPoints.trim());
    }
    if (therapistMessage && therapistMessage.trim().length > 0) {
      lines.push(`【担当へのメッセージ（お客様の言葉）】`);
      lines.push(therapistMessage.trim());
    }
    lines.push("");
    lines.push("上記を元に、お客様の言葉やニュアンスを活かして、自然な口コミ文章を生成してください。");
    lines.push("お客様が書いていないことは絶対に追加しないでください。");

    const userMessage = lines.join("\n");

    // ─────────────────────────────────────
    // Claude API 呼び出し
    // ─────────────────────────────────────
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 800,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error("[survey/ai-compose] Anthropic API error:", response.status, errBody);
      return NextResponse.json(
        { error: "AI生成に失敗しました。もう一度お試しください。" },
        { status: 502 }
      );
    }

    const data = await response.json();
    const composedText: string =
      data.content?.[0]?.type === "text" ? data.content[0].text : "";

    if (!composedText) {
      return NextResponse.json(
        { error: "AI生成結果が空でした。もう一度お試しください。" },
        { status: 502 }
      );
    }

    return NextResponse.json({ composedText: composedText.trim() });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "エラーが発生しました";
    console.error("[survey/ai-compose] error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
