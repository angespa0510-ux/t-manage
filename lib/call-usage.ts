/**
 * 通話AI 使用量ログ（call_usage_logs）への記録ヘルパー
 *
 * - usage_date（日付）単位で1レコード、UNIQUE制約あり
 * - 既存レコードがあれば加算更新、なければ新規挿入
 * - レース条件は発生しうるが、1日の同時呼び出しが少ないため許容
 *
 * API 価格（2026年4月時点、概算）:
 *   - Whisper-1:       $0.006 / 分
 *   - Sonnet 4.6:      $3 / MTok (input),  $15 / MTok (output)
 *   - Opus 4.7:        $15 / MTok (input), $75 / MTok (output)
 *   - Sonnet 4.5:      $3 / MTok (input),  $15 / MTok (output)
 *   - Opus 4.6:        $15 / MTok (input), $75 / MTok (output)
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseLike = any;

export type UsageDelta = {
  whisper_seconds?: number;
  whisper_cost_usd?: number;
  sonnet_input_tokens?: number;
  sonnet_output_tokens?: number;
  sonnet_cost_usd?: number;
  opus_input_tokens?: number;
  opus_output_tokens?: number;
  opus_cost_usd?: number;
  call_count?: number;
  escalation_count?: number;
};

/**
 * Whisper API のコスト計算（USD）
 * $0.006 per minute = $0.0001 per second
 */
export function calculateWhisperCost(seconds: number): number {
  return (seconds / 60) * 0.006;
}

/**
 * Sonnet 4.6 / 4.5 のコスト計算（USD）
 * Input: $3/MTok, Output: $15/MTok
 */
export function calculateSonnetCost(
  inputTokens: number,
  outputTokens: number
): number {
  const inputCost = (inputTokens / 1_000_000) * 3;
  const outputCost = (outputTokens / 1_000_000) * 15;
  return inputCost + outputCost;
}

/**
 * Opus 4.7 / 4.6 のコスト計算（USD）
 * Input: $15/MTok, Output: $75/MTok
 */
export function calculateOpusCost(
  inputTokens: number,
  outputTokens: number
): number {
  const inputCost = (inputTokens / 1_000_000) * 15;
  const outputCost = (outputTokens / 1_000_000) * 75;
  return inputCost + outputCost;
}

/**
 * モデル名から Sonnet 系か Opus 系かを判定
 */
export function isOpusModel(model: string): boolean {
  return /opus/i.test(model);
}

/**
 * 今日の日付（YYYY-MM-DD）を UTC ベースで返す
 * Supabase は UTC で動いているので、Asia/Tokyo 変換は不要
 */
function getTodayDate(): string {
  const now = new Date();
  // 日本時間の日付に丸める（UTC+9）
  const jstOffset = 9 * 60;
  const localOffset = now.getTimezoneOffset();
  const jst = new Date(now.getTime() + (jstOffset + localOffset) * 60 * 1000);
  return jst.toISOString().split("T")[0];
}

/**
 * call_usage_logs に加算記録する
 * 既存の本日レコードがあれば UPDATE、なければ INSERT
 *
 * 失敗してもログだけ残して続行（API本体の成功を阻害しない）
 */
export async function recordUsage(
  supabase: SupabaseLike,
  delta: UsageDelta
): Promise<void> {
  if (!supabase) return;

  const today = getTodayDate();

  try {
    // 既存レコード取得
    const { data: existing, error: selectError } = await supabase
      .from("call_usage_logs")
      .select("*")
      .eq("usage_date", today)
      .maybeSingle();

    if (selectError) {
      console.error("[call-usage] select error:", selectError);
      return;
    }

    if (existing) {
      // 既存レコードに加算
      const { error: updateError } = await supabase
        .from("call_usage_logs")
        .update({
          whisper_seconds:
            (existing.whisper_seconds || 0) + (delta.whisper_seconds || 0),
          whisper_cost_usd:
            Number(existing.whisper_cost_usd || 0) +
            (delta.whisper_cost_usd || 0),
          sonnet_input_tokens:
            (existing.sonnet_input_tokens || 0) +
            (delta.sonnet_input_tokens || 0),
          sonnet_output_tokens:
            (existing.sonnet_output_tokens || 0) +
            (delta.sonnet_output_tokens || 0),
          sonnet_cost_usd:
            Number(existing.sonnet_cost_usd || 0) +
            (delta.sonnet_cost_usd || 0),
          opus_input_tokens:
            (existing.opus_input_tokens || 0) + (delta.opus_input_tokens || 0),
          opus_output_tokens:
            (existing.opus_output_tokens || 0) +
            (delta.opus_output_tokens || 0),
          opus_cost_usd:
            Number(existing.opus_cost_usd || 0) + (delta.opus_cost_usd || 0),
          call_count: (existing.call_count || 0) + (delta.call_count || 0),
          escalation_count:
            (existing.escalation_count || 0) + (delta.escalation_count || 0),
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);

      if (updateError) {
        console.error("[call-usage] update error:", updateError);
      }
    } else {
      // 新規レコード挿入
      const { error: insertError } = await supabase
        .from("call_usage_logs")
        .insert({
          usage_date: today,
          whisper_seconds: delta.whisper_seconds || 0,
          whisper_cost_usd: delta.whisper_cost_usd || 0,
          sonnet_input_tokens: delta.sonnet_input_tokens || 0,
          sonnet_output_tokens: delta.sonnet_output_tokens || 0,
          sonnet_cost_usd: delta.sonnet_cost_usd || 0,
          opus_input_tokens: delta.opus_input_tokens || 0,
          opus_output_tokens: delta.opus_output_tokens || 0,
          opus_cost_usd: delta.opus_cost_usd || 0,
          call_count: delta.call_count || 0,
          escalation_count: delta.escalation_count || 0,
        });

      if (insertError) {
        console.error("[call-usage] insert error:", insertError);
      }
    }
  } catch (e) {
    console.error("[call-usage] exception:", e);
    // 失敗してもAPIは続行
  }
}
