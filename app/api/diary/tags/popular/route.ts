import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://cbewozzdyjqmhzkxsjqo.supabase.co";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "20"), 100);
    const featuredOnly = url.searchParams.get("featuredOnly") === "1";

    let query = supabase
      .from("therapist_diary_tags")
      .select("id, name, display_name, category, color, use_count, is_featured")
      .eq("is_blocked", false);

    if (featuredOnly) {
      query = query.eq("is_featured", true);
    }

    query = query
      .order("is_featured", { ascending: false })
      .order("use_count", { ascending: false })
      .limit(limit);

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    type TagRow = {
      id: number;
      name: string;
      display_name: string;
      category: string | null;
      color: string | null;
      use_count: number;
      is_featured: boolean;
    };

    return NextResponse.json({
      tags: ((data || []) as TagRow[]).map((t) => ({
        id: t.id,
        name: t.name,
        displayName: t.display_name,
        category: t.category,
        color: t.color,
        useCount: t.use_count,
        isFeatured: t.is_featured,
      })),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "不明なエラー";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
