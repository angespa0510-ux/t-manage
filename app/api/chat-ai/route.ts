import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://cbewozzdyjqmhzkxsjqo.supabase.co";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";

/**
 * チャット AI 支援エンドポイント
 *
 * 対応機能 (feature):
 *   - polite     : 丁寧語変換（崩れた文を丁寧に書き直す）
 *   - translate  : 翻訳（外国人セラピスト対応、日⇔英/中/韓/越）
 *   - draft      : 返信ドラフト生成（状況説明から返信文を提案）
 *   - summarize  : 長文要約（複数メッセージをまとめる）
 *   - ng_check   : NG 表現チェック（LINE 凍結対策・業界NG表現検出）
 *
 * 予算管理:
 *   chat_ai_settings.monthly_budget_jpy を上限に、超過したら 429 を返す。
 *   使用量はリクエストごとに usage_jpy を加算。
 */

type Feature = "polite" | "translate" | "draft" | "summarize" | "ng_check";

const MODEL = "claude-sonnet-4-6";
// Claude Sonnet 4.6 料金目安（入力 $3/1M, 出力 $15/1M, 150円/USD 換算）
const PRICE_IN_PER_TOKEN_JPY = (3 / 1_000_000) * 150;
const PRICE_OUT_PER_TOKEN_JPY = (15 / 1_000_000) * 150;

const SYSTEM_PROMPTS: Record<Feature, string> = {
  polite: `あなたは日本語のビジネスチャットの丁寧化アシスタントです。
入力された文章を、敬意のある自然な丁寧語に書き直してください。
意味は変えず、相手への気遣いが感じられる表現にしてください。
余計な説明や前置きは一切入れず、書き直した本文だけを返してください。`,

  translate: `あなたはメンズエステ・リラクゼーションサロンのチャット翻訳AIです。
以下の日本語メッセージを指定された言語に翻訳してください。
職場のチャット文脈（スタッフ↔セラピスト）として自然な口語表現を使ってください。
余計な説明や前置きを入れず、翻訳後の本文だけを返してください。`,

  draft: `あなたはメンズエステ・リラクゼーションサロンの店舗スタッフのアシスタントです。
入力された「状況」や「返信の意図」をもとに、セラピストへの返信メッセージ案を作成してください。
- 丁寧で親しみやすいトーン
- LINE のビジネス文ではなく、社内チャットらしい自然な口語
- 長すぎず、150文字以内を目安
- 絵文字は1個まで
余計な説明や前置きを入れず、返信本文だけを返してください。`,

  summarize: `あなたはチャット履歴の要約AIです。
複数のチャットメッセージを読み、要点を3〜5行に圧縮して箇条書きで返してください。
- 誰が何を言ったかを短く
- 決定事項・未決事項が分かるように
- 絵文字や装飾は不要
箇条書きの「・」記号のみ使用してください。`,

  ng_check: `あなたはメンズエステ業界のコンプライアンスチェックAIです。
入力されたメッセージに、以下のリスクがあるか判定してください：
1. LINE のアカウント凍結につながる表現（性的・違法示唆）
2. 業界NGワード
3. お客様や同僚への不適切表現

以下の JSON 形式で返してください（前置き不要）：
{"risk":"none|low|medium|high","reasons":["理由1","理由2"],"suggestion":"書き換え案または空文字"}`,
};

function estimateTokens(text: string): number {
  // 日本語は1文字≒1トークン、英数字は4文字≒1トークンとして簡易推定
  const jp = (text.match(/[\u3000-\u9fff]/g) || []).length;
  const other = text.length - jp;
  return Math.ceil(jp + other / 4);
}

async function getSettings() {
  const { data } = await supabase.from("chat_ai_settings").select("*").eq("id", 1).maybeSingle();
  return data;
}

async function updateUsage(cost: number) {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const { data: current } = await supabase.from("chat_ai_settings").select("*").eq("id", 1).maybeSingle();
  if (!current) return;

  // 月が変わっていたらリセット
  if (current.current_month !== currentMonth) {
    await supabase
      .from("chat_ai_settings")
      .update({
        current_month: currentMonth,
        current_month_usage_jpy: cost,
        updated_at: new Date().toISOString(),
      })
      .eq("id", 1);
  } else {
    await supabase
      .from("chat_ai_settings")
      .update({
        current_month_usage_jpy: Number(current.current_month_usage_jpy || 0) + cost,
        updated_at: new Date().toISOString(),
      })
      .eq("id", 1);
  }
}

async function callClaude(systemPrompt: string, userContent: string, maxTokens = 1000) {
  if (!ANTHROPIC_API_KEY) {
    return { text: "", tokens_in: 0, tokens_out: 0, error: "ANTHROPIC_API_KEY not set" };
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: maxTokens,
          system: systemPrompt,
          messages: [{ role: "user", content: userContent }],
        }),
      });

      if (res.status === 529 && attempt < 2) {
        await new Promise((r) => setTimeout(r, (attempt + 1) * 1000));
        continue;
      }

      const data = await res.json();
      if (!res.ok) {
        return { text: "", tokens_in: 0, tokens_out: 0, error: data?.error?.message || res.statusText };
      }

      const text: string = data?.content?.[0]?.text || "";
      const tokens_in: number = data?.usage?.input_tokens || estimateTokens(systemPrompt + userContent);
      const tokens_out: number = data?.usage?.output_tokens || estimateTokens(text);

      return { text, tokens_in, tokens_out, error: null };
    } catch (e: any) {
      if (attempt === 2) {
        return { text: "", tokens_in: 0, tokens_out: 0, error: e.message };
      }
    }
  }
  return { text: "", tokens_in: 0, tokens_out: 0, error: "retry exhausted" };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const feature = body.feature as Feature;
    const input = (body.input || "").toString();
    const context = (body.context || "").toString();
    const targetLanguage = (body.target_language || "en").toString();
    const requesterType = (body.requester_type || "staff").toString();
    const requesterId = Number(body.requester_id || 0);
    const conversationId = body.conversation_id ? Number(body.conversation_id) : null;

    if (!SYSTEM_PROMPTS[feature]) {
      return NextResponse.json({ error: "invalid feature" }, { status: 400 });
    }
    if (!input || input.length < 2) {
      return NextResponse.json({ error: "input too short" }, { status: 400 });
    }
    if (input.length > 5000) {
      return NextResponse.json({ error: "input too long (max 5000)" }, { status: 400 });
    }

    // 設定確認（予算チェック）
    const settings = await getSettings();
    if (!settings || !settings.is_enabled) {
      return NextResponse.json({ error: "AI機能が無効化されています" }, { status: 403 });
    }
    if (!(settings.enabled_features || []).includes(feature)) {
      return NextResponse.json({ error: `機能 ${feature} は無効化されています` }, { status: 403 });
    }

    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const usageThisMonth =
      settings.current_month === currentMonth ? Number(settings.current_month_usage_jpy || 0) : 0;
    const budget = Number(settings.monthly_budget_jpy || 0);
    if (budget > 0 && usageThisMonth >= budget) {
      return NextResponse.json(
        { error: "今月のAI予算上限に達しました。来月1日にリセットされます。" },
        { status: 429 }
      );
    }

    // 1日あたり上限チェック
    if (settings.per_user_daily_limit && requesterId > 0) {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const { count } = await supabase
        .from("chat_ai_logs")
        .select("id", { count: "exact", head: true })
        .eq("requester_type", requesterType)
        .eq("requester_id", requesterId)
        .gte("created_at", todayStart.toISOString());
      if ((count || 0) >= settings.per_user_daily_limit) {
        return NextResponse.json({ error: "本日のAI利用回数の上限に達しました" }, { status: 429 });
      }
    }

    // プロンプト組み立て
    let systemPrompt = SYSTEM_PROMPTS[feature];
    let userContent = input;

    if (feature === "translate") {
      const langMap: Record<string, string> = {
        en: "英語",
        zh: "中国語（簡体字）",
        ko: "韓国語",
        vi: "ベトナム語",
        ja: "日本語",
      };
      systemPrompt += `\n\n【翻訳先言語】 ${langMap[targetLanguage] || targetLanguage}`;
    }
    if (feature === "draft" && context) {
      userContent = `【状況・意図】\n${context}\n\n【作りたい返信の方向性】\n${input}`;
    }

    // Claude 呼び出し
    const maxTokens = feature === "summarize" ? 800 : feature === "translate" ? 1500 : 500;
    const result = await callClaude(systemPrompt, userContent, maxTokens);

    const costJpy = result.tokens_in * PRICE_IN_PER_TOKEN_JPY + result.tokens_out * PRICE_OUT_PER_TOKEN_JPY;

    // ログ保存
    await supabase.from("chat_ai_logs").insert({
      conversation_id: conversationId,
      requester_type: requesterType,
      requester_id: requesterId,
      feature,
      input: input.slice(0, 2000),
      output: (result.text || "").slice(0, 2000),
      target_language: feature === "translate" ? targetLanguage : null,
      model: MODEL,
      tokens_in: result.tokens_in,
      tokens_out: result.tokens_out,
      cost_jpy: costJpy,
      error: result.error,
    });

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    // 使用量更新
    await updateUsage(costJpy);

    return NextResponse.json({
      output: result.text,
      feature,
      tokens_in: result.tokens_in,
      tokens_out: result.tokens_out,
      cost_jpy: costJpy,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "unknown error" }, { status: 500 });
  }
}
