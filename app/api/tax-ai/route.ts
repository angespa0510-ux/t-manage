import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://cbewozzdyjqmhzkxsjqo.supabase.co";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNiZXdvenpkeWpxbWh6a3hzanFvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyNjU2MzYsImV4cCI6MjA4OTg0MTYzNn0.cddSSXx6OqOKNTc-WlaHTusK67sFgi8QwETnGaVGgIw";
const supabase = createClient(supabaseUrl, supabaseKey);
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";

/* キャッシュ用: 質問を正規化 */
function normalize(q: string): string {
  return q.replace(/[？?！!。、,.　\s]+/g, " ").trim().toLowerCase().slice(0, 200);
}

/* キャッシュ検索（キーワードマッチ） */
async function findCache(question: string): Promise<string | null> {
  const norm = normalize(question);
  const words = norm.split(" ").filter(w => w.length >= 2).slice(0, 5);
  if (words.length === 0) return null;

  // 完全一致チェック
  const { data: exact } = await supabase
    .from("ai_chat_cache")
    .select("answer, id, hit_count")
    .eq("normalized_q", norm)
    .eq("category", "tax")
    .limit(1);

  if (exact && exact.length > 0) {
    await supabase.from("ai_chat_cache").update({ hit_count: (exact[0].hit_count || 0) + 1 }).eq("id", exact[0].id);
    return exact[0].answer;
  }

  // キーワード部分一致（上位3ワードで検索）
  for (const word of words.slice(0, 3)) {
    const { data: partial } = await supabase
      .from("ai_chat_cache")
      .select("answer, id, hit_count, normalized_q")
      .eq("category", "tax")
      .ilike("normalized_q", `%${word}%`)
      .gte("hit_count", 1)
      .order("hit_count", { ascending: false })
      .limit(5);

    if (partial && partial.length > 0) {
      // 2ワード以上マッチするか確認
      for (const cached of partial) {
        const matchCount = words.filter(w => cached.normalized_q.includes(w)).length;
        if (matchCount >= 2 || (words.length === 1 && matchCount >= 1)) {
          await supabase.from("ai_chat_cache").update({ hit_count: (cached.hit_count || 0) + 1 }).eq("id", cached.id);
          return cached.answer;
        }
      }
    }
  }
  return null;
}

/* キャッシュ保存 */
async function saveCache(question: string, answer: string) {
  const norm = normalize(question);
  await supabase.from("ai_chat_cache").upsert({
    category: "tax",
    normalized_q: norm,
    question: question.slice(0, 500),
    answer: answer.slice(0, 5000),
    hit_count: 0,
  }, { onConflict: "category,normalized_q" });
}

/* Claude API呼び出し */
async function callClaude(question: string): Promise<string> {
  if (!ANTHROPIC_API_KEY) return "⚠️ AIキーが設定されていません";

  const systemPrompt = `あなたはメンズエステ・リラクゼーションサロンのセラピスト専門の税務アドバイザーAIです。
セラピスト（個人事業主・業務委託）の確定申告・税務に関する質問に、分かりやすく丁寧に回答してください。

【あなたの知識】
- 確定申告（青色申告・白色申告）の全般
- 開業届・青色申告承認申請書の書き方
- インボイス制度（適格請求書発行事業者）
- 源泉徴収（1日5,000円控除、10.21%）
- セラピスト特有の経費（美容費、衣装代、交通費、通信費、カフェ代、研修費等）
- 複式簿記・仕訳帳・総勘定元帳
- 副業バレ防止（住民税の普通徴収）
- 配偶者控除・扶養控除
- 学生の場合の注意点
- 国民健康保険料・年金
- ふるさと納税・iDeCo
- e-Taxでの電子申告
- 税金の納付方法（振替納税、クレジットカード、スマホアプリ等）

【回答のルール】
- 専門用語は使わず、簡単な言葉で説明する
- 具体的な金額例を出して説明する
- 箇条書きで読みやすくする
- 最後に「※これは一般的な情報です。個別の判断は税理士にご相談ください。」を付ける
- 回答は400文字以内を目安に簡潔にする
- 「マッサージ」という表現は避け「ボディケア」「施術」を使う`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 800, system: systemPrompt, messages: [{ role: "user", content: question }] }),
  });

  if (!res.ok) {
    if (res.status === 529) return "⚠️ 現在AIが混み合っています。少し時間をおいて再度お試しください。";
    return "⚠️ AIの応答でエラーが発生しました。";
  }
  const data = await res.json();
  return data.content?.[0]?.text || "応答を取得できませんでした";
}

export async function POST(req: NextRequest) {
  try {
    const { question } = await req.json();
    if (!question || question.trim().length < 2) {
      return NextResponse.json({ error: "質問を入力してください" }, { status: 400 });
    }

    // 1. キャッシュ検索
    const cached = await findCache(question);
    if (cached) {
      return NextResponse.json({ answer: cached, cached: true });
    }

    // 2. キャッシュにない → Claude API呼び出し
    const answer = await callClaude(question);

    // 3. 回答をキャッシュに保存
    await saveCache(question, answer);

    return NextResponse.json({ answer, cached: false });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
