import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "";

const MODEL_SONNET = "claude-sonnet-4-6";
const MODEL_OPUS = "claude-opus-4-7";

/**
 * 通話文字起こしテキストを Claude で分析し、
 * サマリー・意図・感情・抽出情報・警告を JSON で返す API
 *
 * POST /api/call-analyze
 * Body: {
 *   transcript: string,     // 必須：文字起こし全文
 *   call_id?: number,       // 省略可：指定されたら call_transcripts に結果を保存
 *   force_opus?: boolean,   // 省略可：true なら最初から Opus で分析
 * }
 *
 * Response: {
 *   summary: string,
 *   intent: "booking" | "inquiry" | "complaint" | "cancel" | "other",
 *   sentiment: "positive" | "neutral" | "negative",
 *   extracted: {
 *     customer_name?: string,
 *     phone_number?: string,
 *     date_time?: string,
 *     course?: string,
 *     notes?: string
 *   },
 *   warnings: string[],
 *   matched_customers: Customer[],   // 顧客DBからマッチした候補
 *   model_used: string,
 *   escalated: boolean,
 *   escalation_reason?: string,
 *   usage: { input_tokens, output_tokens }
 * }
 */

type AnalysisResult = {
  summary: string;
  intent: "booking" | "inquiry" | "complaint" | "cancel" | "other";
  sentiment: "positive" | "neutral" | "negative";
  extracted: {
    customer_name?: string;
    phone_number?: string;
    date_time?: string;
    course?: string;
    notes?: string;
  };
  warnings: string[];
  should_escalate: boolean;
  escalation_reason?: string;
};

type ClaudeResponse = {
  content: Array<{ type: string; text?: string }>;
  usage: { input_tokens: number; output_tokens: number };
};

/**
 * call_ai_settings テーブルの型（必要な範囲だけ抜粋）
 */
type CallAISettings = {
  enabled: boolean;
  default_model: string;
  escalation_model: string;
  escalate_on_claim: boolean;
  escalate_on_long_call: boolean;
  escalate_on_negative: boolean;
  escalate_on_vip: boolean;
  escalate_on_blacklist: boolean;
};

const DEFAULT_SETTINGS: CallAISettings = {
  enabled: true,
  default_model: MODEL_SONNET,
  escalation_model: MODEL_OPUS,
  escalate_on_claim: true,
  escalate_on_long_call: true,
  escalate_on_negative: true,
  escalate_on_vip: false,
  escalate_on_blacklist: true,
};

/**
 * 設定値に応じた System Prompt を動的に組み立てる
 */
function buildSystemPrompt(settings: CallAISettings): string {
  // エスカレーション条件をトグル設定から組み立てる
  // ただし VIP/blacklist/long_call はコード側で判定するので、ここには含めない
  const escalationConditions: string[] = [];
  if (settings.escalate_on_claim) {
    escalationConditions.push(
      "- クレーム内容が複雑・返金や訴訟に発展しうる"
    );
  }
  if (settings.escalate_on_negative) {
    escalationConditions.push(
      "- お客様の感情が強く negative（怒り・強い不満・焦り）"
    );
  }
  // デフォルトで残す条件
  escalationConditions.push(
    "- 予約内容に矛盾・不明瞭な点が多く重要",
    "- 短い通話で判断が困難"
  );

  return `あなたはメンズエステサロン「アンジュスパ」の通話分析アシスタントです。

電話応対の文字起こしを分析し、以下の項目を JSON 形式で返してください。

【出力フォーマット】
必ず以下の構造の JSON のみを返すこと。余計な説明やマークダウン記法は一切つけない。

{
  "summary": "通話内容の要約（100〜150文字、ですます調）",
  "intent": "booking | inquiry | complaint | cancel | other のいずれか",
  "sentiment": "positive | neutral | negative のいずれか",
  "extracted": {
    "customer_name": "お客様の氏名（聞き取れた場合）",
    "phone_number": "電話番号（聞き取れた場合、ハイフンなし11桁）",
    "date_time": "希望日時（例：12/25 18:00、来週土曜14時 など）",
    "course": "コース・時間（例：アロマ90分、リンパ60分）",
    "notes": "その他の重要情報（指名、オプション、要望など）"
  },
  "warnings": ["確認漏れや注意点を配列で。なければ空配列"],
  "should_escalate": true または false,
  "escalation_reason": "エスカレーションが必要な理由（不要なら空文字）"
}

【各フィールドの判定基準】

intent（通話意図）:
- booking: 予約の新規申込
- inquiry: 問い合わせ（料金・空き状況・場所など）
- complaint: クレーム・不満の訴え
- cancel: 予約キャンセル・変更
- other: 上記以外（営業電話、間違い電話など）

sentiment（感情）:
- positive: お客様が満足・友好的・丁寧
- neutral: 平常・事務的
- negative: 怒り・不満・焦り・困惑

extracted（抽出情報）:
- 聞き取れなかったフィールドは省略するか空文字にする
- 推測は入れない（事実ベースのみ）
- 電話番号は数字11桁（090/080/070で始まる）またはハイフン付きで

warnings（注意点）:
- 「電話番号の復唱なし」「予約日時があいまい」「住所確認なし」など
- スタッフが次に確認すべきことを挙げる

should_escalate（Opus再分析が必要か）:
以下のいずれかに該当する場合 true：
${escalationConditions.join("\n")}

【重要】
- JSON のみを返す。前後に説明文を書かない
- 文字起こしが空・極端に短い場合も、空の結果を JSON 形式で返す
- 日本語で記述する
- 「マッサージ」という言葉は避け「ボディケア」「施術」を使う`;
}

// Claude API 呼び出し（リトライ付き）
async function callClaude(
  model: string,
  transcript: string,
  systemPrompt: string,
  maxRetries = 2
): Promise<{ result: AnalysisResult; usage: { input_tokens: number; output_tokens: number } }> {
  let lastError: Error | null = null;

  for (let i = 0; i <= maxRetries; i++) {
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: 1500,
          system: systemPrompt,
          messages: [
            {
              role: "user",
              content: `以下の通話文字起こしを分析してください。\n\n---\n${transcript}\n---`,
            },
          ],
        }),
      });

      if (res.status === 529 && i < maxRetries) {
        await new Promise((r) => setTimeout(r, (i + 1) * 1500));
        continue;
      }

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Claude API error ${res.status}: ${errText}`);
      }

      const data = (await res.json()) as ClaudeResponse;
      const rawText = data.content?.[0]?.text || "";

      // JSON抽出（前後にテキストが混ざる場合の保険）
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("Claude response does not contain JSON");
      }

      const parsed = JSON.parse(jsonMatch[0]) as AnalysisResult;

      return {
        result: parsed,
        usage: data.usage || { input_tokens: 0, output_tokens: 0 },
      };
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      if (i < maxRetries) {
        await new Promise((r) => setTimeout(r, (i + 1) * 1000));
      }
    }
  }

  throw lastError || new Error("Claude API failed after retries");
}

// 電話番号を正規化（数字のみ）
function normalizePhone(raw: string): string {
  return (raw || "").replace(/[^\d]/g, "");
}

// 顧客DB から候補を検索
// 既存T-MANAGEパターンに合わせて supabase は any で受ける
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function searchCustomers(
  supabase: any,
  phoneNumber: string,
  customerName: string
): Promise<Array<Record<string, unknown>>> {
  const results: Array<Record<string, unknown>> = [];
  const seenIds = new Set<number>();

  // 1. 電話番号で検索（phone/phone2/phone3 のいずれかに部分一致）
  const normalizedPhone = normalizePhone(phoneNumber);
  if (normalizedPhone.length >= 7) {
    const { data } = await supabase
      .from("customers")
      .select("id, name, kana, phone, phone2, phone3, rank, last_visit_date, visit_count")
      .or(
        `phone.ilike.%${normalizedPhone}%,phone2.ilike.%${normalizedPhone}%,phone3.ilike.%${normalizedPhone}%`
      )
      .limit(5);
    const rows = (data || []) as Array<Record<string, unknown>>;
    for (const c of rows) {
      const id = Number(c.id);
      if (!isNaN(id) && !seenIds.has(id)) {
        seenIds.add(id);
        results.push({ ...c, match_reason: "phone" });
      }
    }
  }

  // 2. 氏名で検索
  if (customerName && customerName.length >= 2) {
    const { data } = await supabase
      .from("customers")
      .select("id, name, kana, phone, phone2, phone3, rank, last_visit_date, visit_count")
      .or(`name.ilike.%${customerName}%,kana.ilike.%${customerName}%`)
      .limit(5);
    const rows = (data || []) as Array<Record<string, unknown>>;
    for (const c of rows) {
      const id = Number(c.id);
      if (!isNaN(id) && !seenIds.has(id)) {
        seenIds.add(id);
        results.push({ ...c, match_reason: "name" });
      }
    }
  }

  return results.slice(0, 8); // 最大8件まで
}

export async function POST(req: NextRequest) {
  try {
    if (!ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY が設定されていません" },
        { status: 500 }
      );
    }

    const body = await req.json();
    const transcript: string = (body?.transcript || "").trim();
    const callId: number | null = body?.call_id ?? null;
    const forceOpus: boolean = !!body?.force_opus;

    if (!transcript || transcript.length < 5) {
      return NextResponse.json(
        { error: "transcript が空、または短すぎます（5文字以上必要）" },
        { status: 400 }
      );
    }

    // Supabase クライアント（顧客検索・DB保存・設定読み込み用）
    const supabase =
      SUPABASE_URL && SUPABASE_KEY
        ? createClient(SUPABASE_URL, SUPABASE_KEY, {
            auth: { persistSession: false },
          })
        : null;

    // call_ai_settings から設定を読み込み（失敗時はデフォルト）
    let settings: CallAISettings = { ...DEFAULT_SETTINGS };
    if (supabase) {
      try {
        const { data } = await supabase
          .from("call_ai_settings")
          .select("*")
          .order("id")
          .limit(1)
          .maybeSingle();
        if (data) {
          settings = {
            enabled: data.enabled ?? DEFAULT_SETTINGS.enabled,
            default_model: data.default_model || DEFAULT_SETTINGS.default_model,
            escalation_model:
              data.escalation_model || DEFAULT_SETTINGS.escalation_model,
            escalate_on_claim:
              data.escalate_on_claim ?? DEFAULT_SETTINGS.escalate_on_claim,
            escalate_on_long_call:
              data.escalate_on_long_call ?? DEFAULT_SETTINGS.escalate_on_long_call,
            escalate_on_negative:
              data.escalate_on_negative ?? DEFAULT_SETTINGS.escalate_on_negative,
            escalate_on_vip: data.escalate_on_vip ?? DEFAULT_SETTINGS.escalate_on_vip,
            escalate_on_blacklist:
              data.escalate_on_blacklist ?? DEFAULT_SETTINGS.escalate_on_blacklist,
          };
        }
      } catch (e) {
        console.error("[call-analyze] settings load failed:", e);
        // デフォルト設定で続行
      }
    }

    // 全体 OFF なら分析しない（手動の force_opus 分析も含めて拒否）
    if (!settings.enabled) {
      return NextResponse.json(
        {
          error:
            "通話AI機能が無効化されています。設定画面で有効化してください。",
          disabled: true,
        },
        { status: 403 }
      );
    }

    // モデル名を設定から取得（短縮形が混ざっていたら正式名にマップ）
    const normalizeModel = (m: string): string => {
      const map: Record<string, string> = {
        "sonnet-4-6": "claude-sonnet-4-6",
        "opus-4-7": "claude-opus-4-7",
        "sonnet-4-5": "claude-sonnet-4-5",
        "opus-4-6": "claude-opus-4-6",
      };
      return map[m] || m;
    };
    const defaultModel = normalizeModel(settings.default_model);
    const escalationModel = normalizeModel(settings.escalation_model);

    // 設定値に応じた System Prompt を生成
    const systemPrompt = buildSystemPrompt(settings);

    // 1回目: 標準モデル（force_opus=true なら最初からエスカレーション先モデル）
    const primaryModel = forceOpus ? escalationModel : defaultModel;
    const first = await callClaude(primaryModel, transcript, systemPrompt);

    let finalResult = first.result;
    let finalModel = primaryModel;
    let finalUsage = first.usage;
    let escalated = false;
    let escalationReason = first.result.escalation_reason || "";

    // 顧客ランク取得（VIP/blacklist判定用）
    let matchedCustomers: Array<Record<string, unknown>> = [];
    if (supabase) {
      try {
        matchedCustomers = await searchCustomers(
          supabase,
          first.result.extracted?.phone_number || "",
          first.result.extracted?.customer_name || ""
        );
      } catch (e) {
        console.error("[call-analyze] customer search failed:", e);
      }
    }

    // コード側エスカレーション判定（プロンプトでは判定できない条件）
    let codeEscalationTriggered = false;
    const codeEscalationReasons: string[] = [];

    // VIP 条件
    if (settings.escalate_on_vip) {
      const hasVip = matchedCustomers.some((c) => {
        const rank = String(c.rank || "").toLowerCase();
        return rank === "vip";
      });
      if (hasVip) {
        codeEscalationTriggered = true;
        codeEscalationReasons.push("VIP顧客");
      }
    }

    // ブラックリスト条件
    if (settings.escalate_on_blacklist) {
      const hasBlacklisted = matchedCustomers.some((c) => {
        const rank = String(c.rank || "").toLowerCase();
        return rank === "banned" || rank === "blacklist" || rank === "caution";
      });
      if (hasBlacklisted) {
        codeEscalationTriggered = true;
        codeEscalationReasons.push("要注意顧客");
      }
    }

    // 長時間通話条件（call_id がある場合のみ、DB から duration_sec を確認）
    if (settings.escalate_on_long_call && callId && supabase) {
      try {
        const { data: callRec } = await supabase
          .from("call_transcripts")
          .select("duration_sec")
          .eq("id", callId)
          .maybeSingle();
        if (callRec && typeof callRec.duration_sec === "number") {
          if (callRec.duration_sec >= 600) {
            // 10分以上
            codeEscalationTriggered = true;
            codeEscalationReasons.push(
              `長時間通話(${Math.round(callRec.duration_sec / 60)}分)`
            );
          }
        }
      } catch (e) {
        console.error("[call-analyze] duration check failed:", e);
      }
    }

    // エスカレーション実行（Sonnet判断 or コード側判定）
    const shouldEscalate =
      !forceOpus && (first.result.should_escalate || codeEscalationTriggered);

    if (shouldEscalate) {
      try {
        const second = await callClaude(escalationModel, transcript, systemPrompt);
        finalResult = second.result;
        finalModel = escalationModel;
        finalUsage = {
          input_tokens: first.usage.input_tokens + second.usage.input_tokens,
          output_tokens: first.usage.output_tokens + second.usage.output_tokens,
        };
        escalated = true;
        const reasonParts: string[] = [];
        if (first.result.should_escalate)
          reasonParts.push(first.result.escalation_reason || "Sonnet判断");
        if (codeEscalationReasons.length > 0)
          reasonParts.push(...codeEscalationReasons);
        escalationReason = reasonParts.join(" / ") || "自動エスカレーション";

        // Opus 結果で再度顧客検索（extracted が更新されている可能性）
        try {
          matchedCustomers = await searchCustomers(
            supabase,
            finalResult.extracted?.phone_number || "",
            finalResult.extracted?.customer_name || ""
          );
        } catch (e) {
          console.error("[call-analyze] re-search after escalation failed:", e);
        }
      } catch (e) {
        // Opus失敗時は Sonnet の結果を返す
        console.error("[call-analyze] Opus escalation failed:", e);
      }
    }

    // DB保存（call_id が渡されていれば call_transcripts を更新）
    if (callId && supabase) {
      try {
        await supabase
          .from("call_transcripts")
          .update({
            ai_summary: finalResult.summary,
            ai_intent: finalResult.intent,
            ai_sentiment: finalResult.sentiment,
            ai_extracted: finalResult.extracted,
            ai_warnings: finalResult.warnings,
            ai_model_used: finalModel,
            escalated_to_opus: escalated,
            escalation_reason: escalationReason,
            customer_name: finalResult.extracted?.customer_name || "",
            phone_number: finalResult.extracted?.phone_number || "",
            updated_at: new Date().toISOString(),
          })
          .eq("id", callId);
      } catch (e) {
        console.error("[call-analyze] db save failed:", e);
      }
    }

    return NextResponse.json({
      summary: finalResult.summary,
      intent: finalResult.intent,
      sentiment: finalResult.sentiment,
      extracted: finalResult.extracted,
      warnings: finalResult.warnings,
      matched_customers: matchedCustomers,
      model_used: finalModel,
      escalated,
      escalation_reason: escalationReason,
      usage: finalUsage,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[call-analyze] exception:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
