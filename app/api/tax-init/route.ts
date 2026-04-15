import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://cbewozzdyjqmhzkxsjqo.supabase.co";
// サーバーサイドではservice_roleキーを優先
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export async function POST() {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

    // テーブル存在チェック
    const { error: checkErr } = await supabase
      .from("therapist_expenses")
      .select("id")
      .limit(1);

    if (!checkErr) {
      return NextResponse.json({ ok: true, message: "テーブルは既に存在します" });
    }

    // テーブルが存在しない場合 → RPC経由で作成を試行
    const sql = `
      CREATE TABLE IF NOT EXISTS therapist_expenses (
        id SERIAL PRIMARY KEY,
        therapist_id INTEGER NOT NULL,
        date DATE NOT NULL,
        category TEXT NOT NULL DEFAULT '',
        subcategory TEXT NOT NULL DEFAULT '',
        account_item TEXT NOT NULL DEFAULT '',
        description TEXT NOT NULL DEFAULT '',
        amount INTEGER NOT NULL DEFAULT 0,
        receipt_url TEXT DEFAULT '',
        receipt_thumb_url TEXT DEFAULT '',
        memo TEXT DEFAULT '',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_therapist_expenses_tid ON therapist_expenses(therapist_id);
      CREATE INDEX IF NOT EXISTS idx_therapist_expenses_date ON therapist_expenses(date);
      ALTER TABLE therapist_expenses ENABLE ROW LEVEL SECURITY;
      CREATE POLICY IF NOT EXISTS "allow_all_therapist_expenses" ON therapist_expenses FOR ALL USING (true) WITH CHECK (true);
    `;

    // RPC経由でSQL実行を試行
    const { error: rpcErr } = await supabase.rpc("exec_sql", { sql_text: sql });

    if (rpcErr) {
      // RPC関数がない場合はSQLを返す（手動実行用）
      return NextResponse.json({
        ok: false,
        message: "テーブル自動作成に失敗。Supabase SQL Editorで下記SQLを実行してください。",
        sql: `
CREATE TABLE IF NOT EXISTS therapist_expenses (
  id SERIAL PRIMARY KEY,
  therapist_id INTEGER NOT NULL,
  date DATE NOT NULL,
  category TEXT NOT NULL DEFAULT '',
  subcategory TEXT NOT NULL DEFAULT '',
  account_item TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  amount INTEGER NOT NULL DEFAULT 0,
  receipt_url TEXT DEFAULT '',
  receipt_thumb_url TEXT DEFAULT '',
  memo TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE therapist_expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_therapist_expenses" ON therapist_expenses FOR ALL USING (true) WITH CHECK (true);
        `.trim(),
      });
    }

    return NextResponse.json({ ok: true, message: "テーブルを作成しました" });
  } catch (e: unknown) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
