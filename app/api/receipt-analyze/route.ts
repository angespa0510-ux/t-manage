import { NextRequest, NextResponse } from "next/server";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";

const DEFAULT_PROMPT = `このレシート/領収書の画像を分析してください。以下の情報をJSON形式のみで返してください（説明文不要）：

{
  "date": "YYYY-MM-DD形式の日付（読み取れない場合は空文字）",
  "store": "店舗名（読み取れない場合は空文字）",
  "amount": 数値（税込み合計金額、読み取れない場合は0）,
  "items": "主な購入品目（カンマ区切り、読み取れない場合は空文字）",
  "category": "以下から最も適切なものを1つ選択: 美容費,衣装・備品,交通費,通信費,カフェ・食事,研修・勉強,医療・健康,消耗品,その他",
  "account_item": "以下から最も適切な勘定科目を1つ選択: 消耗品費,旅費交通費,通信費,接待交際費,研修費,福利厚生費,雑費"
}`;

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, mediaType, customPrompt } = await req.json();
    if (!imageBase64) return NextResponse.json({ error: "画像がありません" }, { status: 400 });
    if (!ANTHROPIC_API_KEY) return NextResponse.json({ error: "API Key未設定" }, { status: 500 });

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 500,
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType || "image/jpeg", data: imageBase64 } },
            { type: "text", text: customPrompt || DEFAULT_PROMPT },
          ],
        }],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json({ error: `Claude API error: ${errText}` }, { status: 500 });
    }

    const data = await res.json();
    const text = data.content?.[0]?.text || "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return NextResponse.json({ error: "解析結果を取得できませんでした", raw: text }, { status: 500 });

    const parsed = JSON.parse(jsonMatch[0]);
    return NextResponse.json({ ok: true, result: parsed });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
