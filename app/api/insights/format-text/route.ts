/**
 * POST /api/insights/format-text
 *
 * クライアントから渡されたsummaryを、Claude.ai貼付け用テキストに整形して返す。
 * （クライアント側で直接 lib/insights/format-for-claude を import すると重いため、APIで処理）
 */

import { NextResponse } from "next/server";
import { formatForClaudeMax } from "../../../../lib/insights/format-for-claude";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const text = formatForClaudeMax({
      date: body.date,
      ga4: body.ga4?.data ?? null,
      clarity: body.clarity?.data ?? null,
      tmanage: body.tmanage?.data ?? null,
    });
    return NextResponse.json({ text });
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error }, { status: 500 });
  }
}
