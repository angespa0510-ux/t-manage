import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://cbewozzdyjqmhzkxsjqo.supabase.co";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * 駅ちか設定一覧取得
 * - 全セラピストと駅ちか設定の LEFT JOIN を返す
 * - status='active' のセラピストのみ
 */
export async function GET() {
  try {
    const { data: therapists, error: tErr } = await supabase
      .from("therapists")
      .select("id, name, status, deleted_at")
      .neq("status", "retired")
      .is("deleted_at", null)
      .order("name", { ascending: true });

    if (tErr) {
      return NextResponse.json({ error: tErr.message }, { status: 500 });
    }

    const { data: settings, error: sErr } = await supabase
      .from("ekichika_post_settings")
      .select("*");

    if (sErr) {
      return NextResponse.json({ error: sErr.message }, { status: 500 });
    }

    type Setting = {
      id: number;
      therapist_id: number;
      ekichika_email: string;
      is_active: boolean;
      last_sent_at: string | null;
      total_sent_count: number;
      total_failed_count: number;
      note: string | null;
      created_at: string;
      updated_at: string;
    };

    const settingsMap = new Map<number, Setting>();
    if (settings) {
      for (const s of settings as Setting[]) settingsMap.set(s.therapist_id, s);
    }

    type Therapist = { id: number; name: string; status: string; deleted_at: string | null };

    const result = ((therapists || []) as Therapist[]).map((t) => {
      const s = settingsMap.get(t.id);
      return {
        therapist: {
          id: t.id,
          name: t.name,
          status: t.status,
        },
        setting: s
          ? {
              id: s.id,
              ekichikaEmail: s.ekichika_email,
              isActive: s.is_active,
              lastSentAt: s.last_sent_at,
              totalSentCount: s.total_sent_count,
              totalFailedCount: s.total_failed_count,
              note: s.note,
              updatedAt: s.updated_at,
            }
          : null,
      };
    });

    return NextResponse.json({
      items: result,
      summary: {
        totalTherapists: result.length,
        configured: result.filter((r) => r.setting).length,
        unconfigured: result.filter((r) => !r.setting).length,
        active: result.filter((r) => r.setting?.isActive).length,
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "不明なエラー";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
