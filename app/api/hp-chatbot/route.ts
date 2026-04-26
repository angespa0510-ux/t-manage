import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://cbewozzdyjqmhzkxsjqo.supabase.co";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";

/**
 * HP お客様チャットBOT エンドポイント
 *
 * 3段階処理:
 *   1. FAQ マッチ（キーワード + 完全一致）→ AI 使わない（コスト 0）
 *   2. キャッシュマッチ（正規化質問の完全・部分一致）→ AI 使わない
 *   3. AI フォールバック → 結果をキャッシュに保存
 *
 * さらに:
 *   - 予算超過時は AI を使わずキャッシュのみで応答
 *   - セッションごとの質問回数制限
 *   - 応答時間・ソースをログ化
 */

const MODEL = "claude-sonnet-4-6";
const PRICE_IN_PER_TOKEN_JPY = (3 / 1_000_000) * 150;
const PRICE_OUT_PER_TOKEN_JPY = (15 / 1_000_000) * 150;

const SYSTEM_PROMPT = `あなたは「Ange Spa（アンジュスパ）」というメンズエステ・リラクゼーションサロンの公式ホームページに設置されたお客様向けチャットサポートAIです。

【応答ルール】
- 質問への回答は簡潔に、150字〜300字程度
- 分からないことは無理に答えず「お電話で直接お問い合わせください」と案内
- 敬語（です・ます調）で丁寧に
- 絵文字は使わない
- 性的な質問、風俗的な内容には一切応じない（「当店は正規のリラクゼーションサロンです」と案内）
- 個別のセラピスト予約可否や出勤時間は「スケジュールページでご確認ください」とリンク案内のみ
- 料金・コース・予約・アクセスなど基本情報はできるだけ回答

【案内可能な情報】
- 当店は豊橋と三河安城の2店舗
- 24時間ネット予約受付・お電話可
- 支払い方法: 現金/カード/PayPay（カード・PayPay は10%手数料）
- 会員登録のメリット: 会員限定写真閲覧、ポイント付与、予約履歴

該当情報が不明な場合は「詳しくは店舗へお電話ください」と案内してください。`;

function normalize(q: string): string {
  return q
    .replace(/[？?！!。、,.　\s]+/g, " ")
    .trim()
    .toLowerCase()
    .slice(0, 300);
}

function estimateTokens(text: string): number {
  const jp = (text.match(/[\u3000-\u9fff]/g) || []).length;
  const other = text.length - jp;
  return Math.ceil(jp + other / 4);
}

async function getSettings() {
  const { data } = await supabase.from("hp_chatbot_settings").select("*").eq("id", 1).maybeSingle();
  return data;
}

/** Step 1: FAQ マッチ */
async function matchFaq(question: string): Promise<{ id: number; answer: string; score: number } | null> {
  const norm = normalize(question);
  const tokens = norm.split(" ").filter((t) => t.length >= 2);
  if (tokens.length === 0) return null;

  // キーワード・質問文でマッチ
  const { data: faqs } = await supabase
    .from("hp_chatbot_faqs")
    .select("id, question, answer, keywords")
    .eq("is_active", true);

  if (!faqs || faqs.length === 0) return null;

  let bestMatch: { id: number; answer: string; score: number } | null = null;

  for (const faq of faqs) {
    let score = 0;
    const faqNorm = normalize(faq.question);

    // 完全一致（質問文）
    if (faqNorm === norm) {
      return { id: faq.id, answer: faq.answer, score: 1000 };
    }

    // 質問文の部分一致
    for (const tok of tokens) {
      if (faqNorm.includes(tok)) score += 10;
    }

    // キーワードマッチ
    for (const kw of faq.keywords || []) {
      const kwNorm = normalize(kw);
      if (norm.includes(kwNorm)) score += 15;
      for (const tok of tokens) {
        if (tok.includes(kwNorm) || kwNorm.includes(tok)) score += 5;
      }
    }

    if (score > 0 && (!bestMatch || score > bestMatch.score)) {
      bestMatch = { id: faq.id, answer: faq.answer, score };
    }
  }

  // 閾値: 20点以上のマッチを有効とする
  if (bestMatch && bestMatch.score >= 20) return bestMatch;
  return null;
}

/** Step 2: キャッシュマッチ */
async function matchCache(question: string): Promise<string | null> {
  const norm = normalize(question);
  const tokens = norm.split(" ").filter((t) => t.length >= 2);

  // 完全一致
  const { data: exact } = await supabase
    .from("hp_chatbot_cache")
    .select("id, answer, hit_count")
    .eq("normalized_q", norm)
    .eq("is_approved", true)
    .limit(1);
  if (exact && exact.length > 0) {
    await supabase
      .from("hp_chatbot_cache")
      .update({ hit_count: (exact[0].hit_count || 0) + 1 })
      .eq("id", exact[0].id);
    return exact[0].answer;
  }

  if (tokens.length === 0) return null;

  // 部分一致
  for (const tok of tokens.slice(0, 3)) {
    const { data: partial } = await supabase
      .from("hp_chatbot_cache")
      .select("id, answer, hit_count, normalized_q")
      .ilike("normalized_q", `%${tok}%`)
      .eq("is_approved", true)
      .gte("hit_count", 1)
      .order("hit_count", { ascending: false })
      .limit(5);

    if (partial && partial.length > 0) {
      for (const c of partial) {
        const matchCount = tokens.filter((t) => c.normalized_q.includes(t)).length;
        // 全トークンが短ければ1つ、多ければ2つ以上一致
        const threshold = tokens.length === 1 ? 1 : 2;
        if (matchCount >= threshold) {
          await supabase
            .from("hp_chatbot_cache")
            .update({ hit_count: (c.hit_count || 0) + 1 })
            .eq("id", c.id);
          return c.answer;
        }
      }
    }
  }
  return null;
}

async function saveCache(question: string, answer: string, source: string, faqId?: number) {
  const norm = normalize(question);
  await supabase.from("hp_chatbot_cache").upsert(
    {
      normalized_q: norm,
      original_q: question.slice(0, 500),
      answer: answer.slice(0, 3000),
      source,
      source_faq_id: faqId || null,
      is_approved: source !== "ai", // AI 生成はデフォルト未承認にしても良いが、FAQ保証分は承認済み
      hit_count: 0,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "normalized_q" }
  );
}

async function callClaude(userContent: string) {
  if (!ANTHROPIC_API_KEY) {
    return { text: "", tokens_in: 0, tokens_out: 0, error: "ANTHROPIC_API_KEY not set" };
  }
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
        max_tokens: 600,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userContent }],
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      return { text: "", tokens_in: 0, tokens_out: 0, error: data?.error?.message || res.statusText };
    }
    const text: string = data?.content?.[0]?.text || "";
    const tokens_in: number = data?.usage?.input_tokens || estimateTokens(SYSTEM_PROMPT + userContent);
    const tokens_out: number = data?.usage?.output_tokens || estimateTokens(text);
    return { text, tokens_in, tokens_out, error: null };
  } catch (e: any) {
    return { text: "", tokens_in: 0, tokens_out: 0, error: e.message };
  }
}

async function updateAiUsage(cost: number) {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const { data: current } = await supabase.from("hp_chatbot_settings").select("*").eq("id", 1).maybeSingle();
  if (!current) return;
  if (current.ai_current_month !== currentMonth) {
    await supabase
      .from("hp_chatbot_settings")
      .update({
        ai_current_month: currentMonth,
        ai_current_month_usage_jpy: cost,
        ai_stopped_reason: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", 1);
  } else {
    const newUsage = Number(current.ai_current_month_usage_jpy || 0) + cost;
    const patch: any = {
      ai_current_month_usage_jpy: newUsage,
      updated_at: new Date().toISOString(),
    };
    if (current.ai_monthly_budget_jpy && newUsage >= Number(current.ai_monthly_budget_jpy)) {
      patch.ai_stopped_reason = "月次予算に到達しました";
    }
    await supabase.from("hp_chatbot_settings").update(patch).eq("id", 1);
  }
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  try {
    const body = await req.json();
    const question = (body.question || "").toString().trim();
    const sessionId = (body.session_id || "").toString() || `anon-${Date.now()}`;
    const referer = (body.referer || "").toString();
    const userAgent = (req.headers.get("user-agent") || "").slice(0, 200);

    if (!question || question.length < 2) {
      return NextResponse.json({ error: "質問が短すぎます" }, { status: 400 });
    }
    if (question.length > 500) {
      return NextResponse.json({ error: "質問が長すぎます（500文字以内）" }, { status: 400 });
    }

    const settings = await getSettings();
    if (!settings || !settings.is_enabled) {
      return NextResponse.json({ error: "現在チャットサポートは停止中です" }, { status: 503 });
    }

    // セッション内質問数制限
    if (settings.max_questions_per_session) {
      const { count } = await supabase
        .from("hp_chatbot_logs")
        .select("id", { count: "exact", head: true })
        .eq("session_id", sessionId);
      if ((count || 0) >= settings.max_questions_per_session) {
        return NextResponse.json(
          { error: "このセッションでの質問回数の上限に達しました。詳しくは店舗へお電話ください。" },
          { status: 429 }
        );
      }
    }

    let answer = "";
    let source = "fallback";
    let matchedFaqId: number | null = null;
    let usedCache = false;
    let usedAi = false;

    // Step 1: FAQ
    const faqMatch = await matchFaq(question);
    if (faqMatch) {
      answer = faqMatch.answer;
      source = "faq";
      matchedFaqId = faqMatch.id;

      // FAQ 命中時もキャッシュに残しておく（次回高速化）
      await saveCache(question, answer, "faq", faqMatch.id);
      await supabase.from("hp_chatbot_faqs").update({ view_count: 0 }).eq("id", faqMatch.id); // 下で RPC 的に increment できないのでログ集計で対応
      // view_count は後で increment_on_click API 経由で更新する方針
    }

    // Step 2: キャッシュ
    if (!answer) {
      const cached = await matchCache(question);
      if (cached) {
        answer = cached;
        source = "cache";
        usedCache = true;
      }
    }

    // Step 3: AI フォールバック
    if (!answer) {
      // 予算チェック
      const now = new Date();
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      const usage =
        settings.ai_current_month === currentMonth ? Number(settings.ai_current_month_usage_jpy || 0) : 0;
      const budget = Number(settings.ai_monthly_budget_jpy || 0);
      const canUseAi =
        settings.ai_enabled && (budget === 0 || usage < budget);

      if (canUseAi) {
        const result = await callClaude(question);
        if (!result.error && result.text) {
          answer = result.text;
          source = "ai";
          usedAi = true;
          const cost =
            result.tokens_in * PRICE_IN_PER_TOKEN_JPY + result.tokens_out * PRICE_OUT_PER_TOKEN_JPY;
          await updateAiUsage(cost);
          // キャッシュに保存（承認済みにして次回以降コスト 0）
          await saveCache(question, answer, "ai");
        }
      }
    }

    // それでも回答が得られない場合のフォールバック
    if (!answer) {
      answer =
        settings.fallback_message ||
        "お問い合わせ内容についてすぐにお答えできませんでした。お急ぎの場合は店舗まで直接お電話ください。";
    }

    const responseTime = Date.now() - startTime;

    // ログ保存
    const { data: logRec } = await supabase
      .from("hp_chatbot_logs")
      .insert({
        session_id: sessionId,
        question: question.slice(0, 500),
        answer: answer.slice(0, 3000),
        source,
        matched_faq_id: matchedFaqId,
        used_cache: usedCache,
        used_ai: usedAi,
        response_time_ms: responseTime,
        user_agent: userAgent,
        referer: referer.slice(0, 300),
      })
      .select("id")
      .single();

    return NextResponse.json({
      answer,
      source,
      matched_faq_id: matchedFaqId,
      used_cache: usedCache,
      used_ai: usedAi,
      response_time_ms: responseTime,
      log_id: logRec?.id,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "unknown error" }, { status: 500 });
  }
}

/** GET: FAQ 一覧取得（チャットBOT のボタン表示用） */
export async function GET() {
  const { data: faqs } = await supabase
    .from("hp_chatbot_faqs")
    .select("id, category, question, answer, is_featured, display_order")
    .eq("is_active", true)
    .order("category", { ascending: true })
    .order("display_order", { ascending: true });

  const { data: settings } = await supabase
    .from("hp_chatbot_settings")
    .select("is_enabled, greeting_message, fallback_message, show_member_cta, member_cta_text, member_cta_url")
    .eq("id", 1)
    .maybeSingle();

  return NextResponse.json({
    faqs: faqs || [],
    settings: settings || { is_enabled: true },
  });
}
