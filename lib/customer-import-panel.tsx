"use client";

import { useState, useRef } from "react";
import { supabase } from "../lib/supabase";
import * as XLSX from "xlsx";

type ImportRow = {
  name: string; self_name: string; phone: string; phone2: string; phone3: string;
  email: string; birthday: string; rank: string; notes: string;
};

type NgMemoRow = {
  customer_name: string; therapist_name: string; is_ng: boolean; ng_reason: string; note: string; rating: number;
};

type ImportResult = { name: string; status: "created" | "updated" | "skipped" | "error"; error?: string };

type Props = { T: Record<string, string>; onClose: () => void; onComplete: () => void };

export default function CustomerImportPanel({ T, onClose, onComplete }: Props) {
  const [step, setStep] = useState<"guide" | "upload" | "preview" | "importing" | "done">("guide");
  const [custRows, setCustRows] = useState<ImportRow[]>([]);
  const [ngRows, setNgRows] = useState<NgMemoRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [hasNgSheet, setHasNgSheet] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState("");
  const [results, setResults] = useState<ImportResult[]>([]);
  const [ngResults, setNgResults] = useState<{ name: string; status: string }[]>([]);
  const [dupMode, setDupMode] = useState<"skip" | "update">("update");
  const fileRef = useRef<HTMLInputElement>(null);

  const inputStyle = { backgroundColor: T.cardAlt, color: T.text, border: "1px solid transparent" };

  const normPhone = (p: string) => (p || "").toString().replace(/[-\s　()（）+]/g, "");

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const data = ev.target?.result;
      const workbook = XLSX.read(data, { type: "array" });

      // Sheet 1: 顧客情報
      const sheet1 = workbook.Sheets[workbook.SheetNames[0]];
      const raw1: string[][] = XLSX.utils.sheet_to_json(sheet1, { header: 1, defval: "" });

      // Skip header rows (1: header, 2: description)
      const dataRows = raw1.slice(2).filter(r => r.some(c => c && String(c).trim()));
      const customers: ImportRow[] = dataRows.map(r => ({
        name: String(r[0] || "").trim(),
        self_name: String(r[1] || "").trim(),
        phone: normPhone(String(r[2] || "")),
        phone2: normPhone(String(r[3] || "")),
        phone3: normPhone(String(r[4] || "")),
        email: String(r[5] || "").trim(),
        birthday: formatDate(String(r[6] || "")),
        rank: normalizeRank(String(r[7] || "")),
        notes: String(r[8] || "").trim(),
      })).filter(r => r.name);

      setCustRows(customers);

      // Sheet 2: NG・メモ
      if (workbook.SheetNames.length >= 2) {
        const sheet2 = workbook.Sheets[workbook.SheetNames[1]];
        const raw2: string[][] = XLSX.utils.sheet_to_json(sheet2, { header: 1, defval: "" });
        const ngData = raw2.slice(2).filter(r => r.some(c => c && String(c).trim()));
        const ngMemos: NgMemoRow[] = ngData.map(r => ({
          customer_name: String(r[0] || "").trim(),
          therapist_name: String(r[1] || "").trim(),
          is_ng: ["はい", "yes", "true", "1", "○"].includes(String(r[2] || "").toLowerCase().trim()),
          ng_reason: String(r[3] || "").trim(),
          note: String(r[4] || "").trim(),
          rating: parseInt(String(r[5] || "0")) || 0,
        })).filter(r => r.customer_name && r.therapist_name);

        setNgRows(ngMemos);
        setHasNgSheet(ngMemos.length > 0);
      }

      setStep("preview");
    };
    reader.readAsArrayBuffer(file);
  };

  const formatDate = (d: string): string => {
    if (!d) return "";
    // Handle Excel serial date
    if (/^\d{5}$/.test(d)) {
      const date = new Date((parseInt(d) - 25569) * 86400 * 1000);
      return date.toISOString().split("T")[0];
    }
    // Handle various formats
    const m = d.match(/(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
    if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
    return "";
  };

  const normalizeRank = (r: string): string => {
    const v = r.toLowerCase().trim();
    if (["banned", "出禁", "ban"].includes(v)) return "banned";
    if (["caution", "要注意", "注意"].includes(v)) return "caution";
    if (["good", "善良", "良"].includes(v)) return "good";
    return "normal";
  };

  const runImport = async () => {
    setImporting(true);
    setStep("importing");
    const res: ImportResult[] = [];
    const total = custRows.length;

    for (let i = 0; i < custRows.length; i++) {
      const row = custRows[i];
      setProgress(Math.round(((i + 1) / total) * 100));
      setProgressText(`${i + 1} / ${total} — ${row.name}`);

      try {
        // Check duplicate by phone or name
        let existing = null;
        if (row.phone) {
          const { data } = await supabase.from("customers").select("id").or(`phone.eq.${row.phone},phone2.eq.${row.phone},phone3.eq.${row.phone}`).maybeSingle();
          existing = data;
        }
        if (!existing) {
          const { data } = await supabase.from("customers").select("id").eq("name", row.name).maybeSingle();
          existing = data;
        }

        if (existing) {
          if (dupMode === "skip") {
            res.push({ name: row.name, status: "skipped" });
          } else {
            const updates: Record<string, string | null> = {};
            if (row.self_name) updates.self_name = row.self_name;
            if (row.phone) updates.phone = row.phone;
            if (row.phone2) updates.phone2 = row.phone2;
            if (row.phone3) updates.phone3 = row.phone3;
            if (row.email) updates.email = row.email;
            if (row.birthday) updates.birthday = row.birthday;
            if (row.rank && row.rank !== "normal") updates.rank = row.rank;
            if (row.notes) updates.notes = row.notes;
            if (Object.keys(updates).length > 0) {
              await supabase.from("customers").update(updates).eq("id", existing.id);
            }
            res.push({ name: row.name, status: "updated" });
          }
        } else {
          const insert: Record<string, string | null> = {
            name: row.name,
            rank: row.rank || "normal",
          };
          if (row.self_name) insert.self_name = row.self_name;
          if (row.phone) insert.phone = row.phone;
          if (row.phone2) insert.phone2 = row.phone2;
          if (row.phone3) insert.phone3 = row.phone3;
          if (row.email) insert.email = row.email;
          if (row.birthday) insert.birthday = row.birthday;
          if (row.notes) insert.notes = row.notes;
          await supabase.from("customers").insert(insert);
          res.push({ name: row.name, status: "created" });
        }
      } catch (err: unknown) {
        res.push({ name: row.name, status: "error", error: err instanceof Error ? err.message : "エラー" });
      }
    }

    setResults(res);

    // NG・メモのインポート
    if (ngRows.length > 0) {
      setProgressText("NG・メモをインポート中...");
      const { data: therapists } = await supabase.from("therapists").select("id,name");
      const thMap = new Map((therapists || []).map(t => [t.name, t.id]));

      const ngRes: { name: string; status: string }[] = [];
      for (const ng of ngRows) {
        const tid = thMap.get(ng.therapist_name);
        if (!tid) {
          ngRes.push({ name: `${ng.customer_name}→${ng.therapist_name}`, status: `セラピスト「${ng.therapist_name}」が見つかりません` });
          continue;
        }

        const { data: existing } = await supabase.from("therapist_customer_notes").select("id").eq("customer_name", ng.customer_name).eq("therapist_id", tid).maybeSingle();

        if (existing) {
          await supabase.from("therapist_customer_notes").update({
            is_ng: ng.is_ng,
            ng_reason: ng.ng_reason || "",
            note: ng.note || "",
            rating: ng.rating || 0,
          }).eq("id", existing.id);
          ngRes.push({ name: `${ng.customer_name}→${ng.therapist_name}`, status: "更新" });
        } else {
          await supabase.from("therapist_customer_notes").insert({
            customer_name: ng.customer_name,
            therapist_id: tid,
            is_ng: ng.is_ng,
            ng_reason: ng.ng_reason || "",
            note: ng.note || "",
            rating: ng.rating || 0,
          });
          ngRes.push({ name: `${ng.customer_name}→${ng.therapist_name}`, status: "登録" });
        }
      }
      setNgResults(ngRes);
    }

    setImporting(false);
    setStep("done");
    onComplete();
  };

  const created = results.filter(r => r.status === "created").length;
  const updated = results.filter(r => r.status === "updated").length;
  const skipped = results.filter(r => r.status === "skipped").length;
  const errors = results.filter(r => r.status === "error").length;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-[fadeIn_0.25s]" style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="px-6 py-4 flex items-center justify-between sticky top-0 z-10" style={{ backgroundColor: T.card, borderBottom: `1px solid ${T.border}` }}>
          <h2 className="text-[16px] font-medium">📥 顧客データ インポート</h2>
          <button onClick={onClose} className="text-[14px] cursor-pointer p-2" style={{ color: T.textSub, background: "none", border: "none" }}>✕</button>
        </div>

        <div className="px-6 py-5">
          {/* ===== STEP: ガイド ===== */}
          {step === "guide" && (
            <div className="space-y-5">
              <div className="rounded-xl p-4" style={{ backgroundColor: "#3b82f610", border: "1px solid #3b82f630" }}>
                <p className="text-[13px] font-medium mb-2" style={{ color: "#3b82f6" }}>📋 インポートの流れ</p>
                <div className="space-y-3 text-[12px]" style={{ color: T.textSub }}>
                  <div className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold text-white" style={{ backgroundColor: "#3b82f6" }}>1</span>
                    <div><p className="font-medium" style={{ color: T.text }}>テンプレートを準備</p><p className="text-[11px] mt-0.5">下のテンプレートをダウンロードして、以前のシステムからデータを転記します</p></div>
                  </div>
                  <div className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold text-white" style={{ backgroundColor: "#3b82f6" }}>2</span>
                    <div><p className="font-medium" style={{ color: T.text }}>ファイルをアップロード</p><p className="text-[11px] mt-0.5">Excel(.xlsx)またはCSV(.csv)ファイルをアップロード</p></div>
                  </div>
                  <div className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold text-white" style={{ backgroundColor: "#3b82f6" }}>3</span>
                    <div><p className="font-medium" style={{ color: T.text }}>プレビューで確認</p><p className="text-[11px] mt-0.5">取り込まれるデータを確認し、問題なければインポート実行</p></div>
                  </div>
                </div>
              </div>

              <div className="rounded-xl p-4" style={{ backgroundColor: T.cardAlt }}>
                <p className="text-[12px] font-medium mb-2">📄 テンプレートの構成</p>
                <div className="space-y-2 text-[11px]" style={{ color: T.textSub }}>
                  <div className="p-2.5 rounded-lg" style={{ backgroundColor: T.card }}>
                    <p className="font-medium" style={{ color: T.text }}>シート①「顧客情報」</p>
                    <p className="mt-0.5">名前（スタッフ管理用）, 名前（お客様用）, 電話番号×3, メール, 誕生日, ランク, 備考</p>
                    <p className="mt-0.5" style={{ color: T.textMuted }}>※ 備考欄の1行目はタイムチャートに表示。3行目以降に利用履歴を記載可能</p>
                  </div>
                  <div className="p-2.5 rounded-lg" style={{ backgroundColor: T.card }}>
                    <p className="font-medium" style={{ color: T.text }}>シート②「NG・セラピストメモ」（任意）</p>
                    <p className="mt-0.5">お客様名, セラピスト名, NG, NG理由, メモ, 評価</p>
                    <p className="mt-0.5" style={{ color: T.textMuted }}>※ お客様名はシート①のスタッフ管理用名と一致させてください</p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl p-4" style={{ backgroundColor: "#f59e0b10", border: "1px solid #f59e0b30" }}>
                <p className="text-[12px] font-medium mb-1" style={{ color: "#f59e0b" }}>⚠️ 注意事項</p>
                <div className="text-[11px] space-y-1" style={{ color: T.textSub }}>
                  <p>・1行目はヘッダー、2行目は説明行です。データは<strong>3行目から</strong>入力してください</p>
                  <p>・電話番号が一致する顧客は重複登録されません（更新 or スキップ選択可）</p>
                  <p>・ランクは normal / caution / banned / good のいずれか（空欄=normal）</p>
                  <p>・1万件以上のデータも処理可能ですが、数分かかる場合があります</p>
                </div>
              </div>

              <button onClick={() => setStep("upload")} className="w-full py-3.5 rounded-xl text-[14px] font-medium cursor-pointer text-white" style={{ background: "linear-gradient(135deg, #c3a782, #b09672)" }}>次へ → ファイルをアップロード</button>
            </div>
          )}

          {/* ===== STEP: アップロード ===== */}
          {step === "upload" && (
            <div className="space-y-5">
              <div className="border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer" style={{ borderColor: T.border }} onClick={() => fileRef.current?.click()}>
                <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} className="hidden" />
                <p className="text-[32px] mb-3">📁</p>
                <p className="text-[14px] font-medium mb-1">ファイルをクリックして選択</p>
                <p className="text-[12px]" style={{ color: T.textMuted }}>Excel(.xlsx) または CSV(.csv)</p>
              </div>

              <div>
                <p className="text-[12px] font-medium mb-2" style={{ color: T.textSub }}>重複データの扱い</p>
                <div className="flex gap-3">
                  <button onClick={() => setDupMode("update")} className="flex-1 py-3 rounded-xl text-[12px] cursor-pointer" style={{ backgroundColor: dupMode === "update" ? "#c3a78218" : T.cardAlt, color: dupMode === "update" ? "#c3a782" : T.textMuted, border: `1px solid ${dupMode === "update" ? "#c3a782" : T.border}`, fontWeight: dupMode === "update" ? 600 : 400 }}>🔄 上書き更新</button>
                  <button onClick={() => setDupMode("skip")} className="flex-1 py-3 rounded-xl text-[12px] cursor-pointer" style={{ backgroundColor: dupMode === "skip" ? "#3b82f618" : T.cardAlt, color: dupMode === "skip" ? "#3b82f6" : T.textMuted, border: `1px solid ${dupMode === "skip" ? "#3b82f6" : T.border}`, fontWeight: dupMode === "skip" ? 600 : 400 }}>⏭️ スキップ</button>
                </div>
                <p className="text-[10px] mt-1.5" style={{ color: T.textMuted }}>※ 電話番号または名前が一致する場合に適用</p>
              </div>

              <button onClick={() => setStep("guide")} className="w-full py-2.5 rounded-xl text-[12px] cursor-pointer" style={{ color: T.textMuted, border: `1px solid ${T.border}` }}>← 戻る</button>
            </div>
          )}

          {/* ===== STEP: プレビュー ===== */}
          {step === "preview" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[14px] font-medium">📋 プレビュー</p>
                  <p className="text-[11px] mt-0.5" style={{ color: T.textMuted }}>ファイル: {fileName}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1.5 rounded-lg text-[11px] font-medium" style={{ backgroundColor: "#4a7c5918", color: "#4a7c59" }}>👥 顧客 {custRows.length}件</span>
                  {hasNgSheet && <span className="px-3 py-1.5 rounded-lg text-[11px] font-medium" style={{ backgroundColor: "#c4555518", color: "#c45555" }}>🚫 NG・メモ {ngRows.length}件</span>}
                </div>
              </div>

              {/* 顧客プレビュー */}
              <div className="rounded-xl border overflow-hidden" style={{ borderColor: T.border }}>
                <div className="px-4 py-2.5" style={{ backgroundColor: T.cardAlt, borderBottom: `1px solid ${T.border}` }}>
                  <p className="text-[11px] font-medium">顧客情報（先頭10件）</p>
                </div>
                <div className="max-h-[250px] overflow-auto">
                  <table className="w-full text-[10px]">
                    <thead><tr style={{ backgroundColor: T.cardAlt }}>
                      {["名前", "お客様名", "電話番号1", "ランク", "備考"].map(h => <th key={h} className="py-2 px-3 text-left font-medium" style={{ color: T.textMuted }}>{h}</th>)}
                    </tr></thead>
                    <tbody>
                      {custRows.slice(0, 10).map((r, i) => (
                        <tr key={i} style={{ borderBottom: `1px solid ${T.border}` }}>
                          <td className="py-2 px-3 font-medium">{r.name}</td>
                          <td className="py-2 px-3" style={{ color: T.textSub }}>{r.self_name || "—"}</td>
                          <td className="py-2 px-3" style={{ color: T.textMuted }}>{r.phone || "—"}</td>
                          <td className="py-2 px-3"><span className="px-1.5 py-0.5 rounded text-[8px]" style={{ backgroundColor: r.rank === "banned" ? "#c4555518" : r.rank === "caution" ? "#f59e0b18" : r.rank === "good" ? "#4a7c5918" : T.cardAlt, color: r.rank === "banned" ? "#c45555" : r.rank === "caution" ? "#f59e0b" : r.rank === "good" ? "#4a7c59" : T.textMuted }}>{r.rank === "banned" ? "出禁" : r.rank === "caution" ? "要注意" : r.rank === "good" ? "善良" : "普通"}</span></td>
                          <td className="py-2 px-3 max-w-[150px] truncate" style={{ color: T.textMuted }}>{r.notes?.split("\n")[0] || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {custRows.length > 10 && <p className="text-center py-2 text-[10px]" style={{ color: T.textFaint }}>... 他 {custRows.length - 10}件</p>}
                </div>
              </div>

              {/* NGプレビュー */}
              {hasNgSheet && (
                <div className="rounded-xl border overflow-hidden" style={{ borderColor: T.border }}>
                  <div className="px-4 py-2.5" style={{ backgroundColor: T.cardAlt, borderBottom: `1px solid ${T.border}` }}>
                    <p className="text-[11px] font-medium">NG・セラピストメモ（先頭10件）</p>
                  </div>
                  <div className="max-h-[200px] overflow-auto">
                    <table className="w-full text-[10px]">
                      <thead><tr style={{ backgroundColor: T.cardAlt }}>
                        {["お客様", "セラピスト", "NG", "理由/メモ"].map(h => <th key={h} className="py-2 px-3 text-left font-medium" style={{ color: T.textMuted }}>{h}</th>)}
                      </tr></thead>
                      <tbody>
                        {ngRows.slice(0, 10).map((r, i) => (
                          <tr key={i} style={{ borderBottom: `1px solid ${T.border}` }}>
                            <td className="py-2 px-3 font-medium">{r.customer_name}</td>
                            <td className="py-2 px-3" style={{ color: "#e8849a" }}>{r.therapist_name}</td>
                            <td className="py-2 px-3">{r.is_ng ? <span style={{ color: "#c45555" }}>🚫 NG</span> : "—"}</td>
                            <td className="py-2 px-3 max-w-[150px] truncate" style={{ color: T.textMuted }}>{r.ng_reason || r.note || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {ngRows.length > 10 && <p className="text-center py-2 text-[10px]" style={{ color: T.textFaint }}>... 他 {ngRows.length - 10}件</p>}
                  </div>
                </div>
              )}

              <div className="rounded-xl p-3" style={{ backgroundColor: "#f59e0b10", border: "1px solid #f59e0b30" }}>
                <p className="text-[11px]" style={{ color: "#f59e0b" }}>⚠️ 重複: 電話番号または名前が一致 → {dupMode === "update" ? "🔄 上書き更新" : "⏭️ スキップ"}</p>
              </div>

              <div className="flex gap-3">
                <button onClick={runImport} className="flex-1 py-3.5 rounded-xl text-[14px] font-medium cursor-pointer text-white" style={{ background: "linear-gradient(135deg, #c3a782, #b09672)" }}>📥 インポート実行（{custRows.length}件{hasNgSheet ? ` + NG ${ngRows.length}件` : ""}）</button>
                <button onClick={() => { setStep("upload"); setCustRows([]); setNgRows([]); }} className="px-6 py-3.5 rounded-xl text-[12px] cursor-pointer" style={{ color: T.textMuted, border: `1px solid ${T.border}` }}>← 戻る</button>
              </div>
            </div>
          )}

          {/* ===== STEP: インポート中 ===== */}
          {step === "importing" && (
            <div className="py-8 text-center space-y-4">
              <p className="text-[32px]">⏳</p>
              <p className="text-[16px] font-medium">インポート中...</p>
              <div className="w-full h-3 rounded-full overflow-hidden" style={{ backgroundColor: T.cardAlt }}>
                <div className="h-full rounded-full transition-all duration-300" style={{ width: `${progress}%`, background: "linear-gradient(135deg, #c3a782, #b09672)" }} />
              </div>
              <p className="text-[12px]" style={{ color: T.textMuted }}>{progressText}</p>
              <p className="text-[11px]" style={{ color: T.textFaint }}>大量データの場合は数分かかります。画面を閉じないでください。</p>
            </div>
          )}

          {/* ===== STEP: 完了 ===== */}
          {step === "done" && (
            <div className="space-y-4">
              <div className="text-center py-4">
                <p className="text-[32px] mb-2">🎉</p>
                <p className="text-[18px] font-medium">インポート完了！</p>
              </div>

              <div className="flex items-center justify-center gap-4">
                {created > 0 && <span className="px-4 py-2 rounded-xl text-[13px] font-medium" style={{ backgroundColor: "#4a7c5918", color: "#4a7c59" }}>🆕 新規 {created}件</span>}
                {updated > 0 && <span className="px-4 py-2 rounded-xl text-[13px] font-medium" style={{ backgroundColor: "#3b82f618", color: "#3b82f6" }}>🔄 更新 {updated}件</span>}
                {skipped > 0 && <span className="px-4 py-2 rounded-xl text-[13px] font-medium" style={{ backgroundColor: "#f59e0b18", color: "#f59e0b" }}>⏭️ スキップ {skipped}件</span>}
                {errors > 0 && <span className="px-4 py-2 rounded-xl text-[13px] font-medium" style={{ backgroundColor: "#c4555518", color: "#c45555" }}>❌ エラー {errors}件</span>}
              </div>

              {ngResults.length > 0 && (
                <div className="rounded-xl p-3" style={{ backgroundColor: T.cardAlt }}>
                  <p className="text-[11px] font-medium mb-1">🚫 NG・メモ結果</p>
                  <p className="text-[10px]" style={{ color: T.textMuted }}>{ngResults.filter(r => r.status === "登録").length}件登録 / {ngResults.filter(r => r.status === "更新").length}件更新 / {ngResults.filter(r => r.status.includes("見つかりません")).length}件エラー</p>
                </div>
              )}

              {errors > 0 && (
                <div className="rounded-xl border overflow-hidden max-h-[200px] overflow-y-auto" style={{ borderColor: T.border }}>
                  {results.filter(r => r.status === "error").map((r, i) => (
                    <div key={i} className="px-4 py-2 text-[10px]" style={{ borderBottom: `1px solid ${T.border}`, color: "#c45555" }}>❌ {r.name}: {r.error}</div>
                  ))}
                </div>
              )}

              <button onClick={onClose} className="w-full py-3.5 rounded-xl text-[14px] font-medium cursor-pointer text-white" style={{ background: "linear-gradient(135deg, #c3a782, #b09672)" }}>閉じる</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
