"use client";

import { useState, useRef } from "react";
import { supabase } from "../lib/supabase";
import * as XLSX from "xlsx";

type NgRow = { customer_name: string; therapist_name: string; is_ng: boolean; ng_reason: string; note: string; rating: number };
type Result = { name: string; status: string; error?: string };
type Props = { T: Record<string, string>; onClose: () => void; onComplete: () => void };

export default function NgImportPanel({ T, onClose, onComplete }: Props) {
  const [step, setStep] = useState<"guide" | "preview" | "importing" | "done">("guide");
  const [rows, setRows] = useState<NgRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const workbook = XLSX.read(ev.target?.result, { type: "array" });
      const sheetName = workbook.SheetNames.find(n => n.includes("NG") || n.includes("メモ")) || workbook.SheetNames[1] || workbook.SheetNames[0];
      const raw: string[][] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: "" });
      const dataRows = raw.slice(2).filter(r => r.some(c => c && String(c).trim()));
      const ngData: NgRow[] = dataRows.map(r => ({
        customer_name: String(r[0] || "").trim(),
        therapist_name: String(r[1] || "").trim(),
        is_ng: ["はい", "yes", "true", "1", "○"].includes(String(r[2] || "").toLowerCase().trim()),
        ng_reason: String(r[3] || "").trim(),
        note: String(r[4] || "").trim(),
        rating: parseInt(String(r[5] || "0")) || 0,
      })).filter(r => r.customer_name && r.therapist_name);
      setRows(ngData);

      // 存在チェック
      const { data: custs } = await supabase.from("customers").select("name");
      const { data: ths } = await supabase.from("therapists").select("name");
      const custNames = new Set((custs || []).map(c => c.name));
      const thNames = new Set((ths || []).map(t => t.name));
      const warns: string[] = [];
      const missingCusts = new Set<string>();
      const missingThs = new Set<string>();
      for (const ng of ngData) {
        if (!custNames.has(ng.customer_name)) missingCusts.add(ng.customer_name);
        if (!thNames.has(ng.therapist_name)) missingThs.add(ng.therapist_name);
      }
      if (missingCusts.size > 0) warns.push(`⚠️ 顧客が見つかりません（${missingCusts.size}名）: ${[...missingCusts].slice(0, 5).join(", ")}${missingCusts.size > 5 ? ` 他${missingCusts.size - 5}名` : ""}`);
      if (missingThs.size > 0) warns.push(`⚠️ セラピストが見つかりません（${missingThs.size}名）: ${[...missingThs].slice(0, 5).join(", ")}${missingThs.size > 5 ? ` 他${missingThs.size - 5}名` : ""}`);
      setWarnings(warns);
      setStep("preview");
    };
    reader.readAsArrayBuffer(file);
  };

  const runImport = async () => {
    setStep("importing");
    const { data: therapists } = await supabase.from("therapists").select("id,name");
    const thMap = new Map((therapists || []).map(t => [t.name, t.id]));
    const res: Result[] = [];

    for (let i = 0; i < rows.length; i++) {
      const ng = rows[i];
      setProgress(Math.round(((i + 1) / rows.length) * 100));
      setProgressText(`${i + 1}/${rows.length} — ${ng.customer_name} → ${ng.therapist_name}`);

      const tid = thMap.get(ng.therapist_name);
      if (!tid) { res.push({ name: `${ng.customer_name}→${ng.therapist_name}`, status: "error", error: `セラピスト「${ng.therapist_name}」が見つかりません` }); continue; }

      // 顧客存在チェック
      const { data: cust } = await supabase.from("customers").select("id").eq("name", ng.customer_name).maybeSingle();
      if (!cust) { res.push({ name: `${ng.customer_name}→${ng.therapist_name}`, status: "error", error: `顧客「${ng.customer_name}」が見つかりません` }); continue; }

      // 二重登録チェック
      const { data: existing } = await supabase.from("therapist_customer_notes").select("id").eq("customer_name", ng.customer_name).eq("therapist_id", tid).maybeSingle();

      if (existing) {
        const updates: Record<string, string | number | boolean> = {};
        if (ng.is_ng) updates.is_ng = true;
        if (ng.ng_reason) updates.ng_reason = ng.ng_reason;
        if (ng.note) updates.note = ng.note;
        if (ng.rating) updates.rating = ng.rating;
        if (Object.keys(updates).length > 0) await supabase.from("therapist_customer_notes").update(updates).eq("id", existing.id);
        res.push({ name: `${ng.customer_name}→${ng.therapist_name}`, status: "updated" });
      } else {
        await supabase.from("therapist_customer_notes").insert({
          customer_name: ng.customer_name, therapist_id: tid,
          is_ng: ng.is_ng, ng_reason: ng.ng_reason || "", note: ng.note || "", rating: ng.rating || 0,
        });
        res.push({ name: `${ng.customer_name}→${ng.therapist_name}`, status: "created" });
      }
    }

    setResults(res); setStep("done"); onComplete();
  };

  const created = results.filter(r => r.status === "created").length;
  const updated = results.filter(r => r.status === "updated").length;
  const errors = results.filter(r => r.status === "error").length;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-[fadeIn_0.25s]" style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }} onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 flex items-center justify-between sticky top-0 z-10" style={{ backgroundColor: T.card, borderBottom: `1px solid ${T.border}` }}>
          <h2 className="text-[16px] font-medium" style={{ color: "#c45555" }}>🚫 NG・メモ インポート</h2>
          <button onClick={onClose} className="text-[14px] cursor-pointer p-2" style={{ color: T.textSub, background: "none", border: "none" }}>✕</button>
        </div>
        <div className="px-6 py-5">

          {step === "guide" && (<div className="space-y-5">
            <div className="rounded-xl p-4" style={{ backgroundColor: "#c4555510", border: "1px solid #c4555530" }}>
              <p className="text-[13px] font-medium mb-2" style={{ color: "#c45555" }}>📋 NG・メモのインポート</p>
              <div className="text-[12px] space-y-1" style={{ color: T.textSub }}>
                <p>テンプレートExcelの「NG・セラピストメモ」シートを読み込みます。</p>
                <p>お客様名 × セラピスト名の組み合わせで二重登録を防止します。</p>
              </div>
            </div>
            <div className="rounded-xl p-3" style={{ backgroundColor: "#f59e0b10", border: "1px solid #f59e0b30" }}>
              <p className="text-[11px] font-medium mb-1" style={{ color: "#f59e0b" }}>⚠️ 事前にご確認ください</p>
              <div className="text-[11px] space-y-0.5" style={{ color: T.textSub }}>
                <p>・顧客データのインポートが完了していること</p>
                <p>・セラピストデータのインポートが完了していること</p>
                <p>・CSVのお客様名はT-MANAGEの顧客名（スタッフ管理用）と一致させること</p>
                <p>・CSVのセラピスト名はT-MANAGEのセラピスト名と一致させること</p>
              </div>
            </div>
            <div className="border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer" style={{ borderColor: T.border }} onClick={() => fileRef.current?.click()}>
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} className="hidden" />
              <p className="text-[28px] mb-2">📁</p>
              <p className="text-[13px] font-medium">ファイルを選択</p>
              <p className="text-[11px] mt-1" style={{ color: T.textMuted }}>「NG・セラピストメモ」シートを読み込みます</p>
            </div>
          </div>)}

          {step === "preview" && (<div className="space-y-4">
            <div className="flex items-center justify-between">
              <div><p className="text-[14px] font-medium">📋 プレビュー</p><p className="text-[11px]" style={{ color: T.textMuted }}>{fileName}</p></div>
              <span className="px-3 py-1.5 rounded-lg text-[11px] font-medium" style={{ backgroundColor: "#c4555518", color: "#c45555" }}>🚫 {rows.length}件</span>
            </div>

            {warnings.length > 0 && (<div className="rounded-xl p-3 space-y-1" style={{ backgroundColor: "#c4555510", border: "1px solid #c4555530" }}>
              {warnings.map((w, i) => <p key={i} className="text-[11px]" style={{ color: "#c45555" }}>{w}</p>)}
              <p className="text-[10px] mt-1" style={{ color: T.textMuted }}>※ 見つからない名前はエラーとしてスキップされます</p>
            </div>)}

            <div className="rounded-xl border overflow-hidden" style={{ borderColor: T.border }}>
              <div className="max-h-[300px] overflow-auto">
                <table className="w-full text-[10px]">
                  <thead><tr style={{ backgroundColor: T.cardAlt }}>{["お客様","セラピスト","NG","理由","メモ","評価"].map(h=><th key={h} className="py-2 px-3 text-left font-medium" style={{ color: T.textMuted }}>{h}</th>)}</tr></thead>
                  <tbody>{rows.slice(0, 15).map((r, i) => (
                    <tr key={i} style={{ borderBottom: `1px solid ${T.border}` }}>
                      <td className="py-2 px-3 font-medium">{r.customer_name}</td>
                      <td className="py-2 px-3" style={{ color: "#e8849a" }}>{r.therapist_name}</td>
                      <td className="py-2 px-3">{r.is_ng ? <span style={{ color: "#c45555" }}>🚫</span> : "—"}</td>
                      <td className="py-2 px-3 max-w-[100px] truncate" style={{ color: T.textMuted }}>{r.ng_reason || "—"}</td>
                      <td className="py-2 px-3 max-w-[100px] truncate" style={{ color: T.textMuted }}>{r.note || "—"}</td>
                      <td className="py-2 px-3">{r.rating > 0 ? "★".repeat(r.rating) : "—"}</td>
                    </tr>
                  ))}</tbody>
                </table>
                {rows.length > 15 && <p className="text-center py-2 text-[10px]" style={{ color: T.textFaint }}>...他{rows.length - 15}件</p>}
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={runImport} className="flex-1 py-3.5 rounded-xl text-[14px] font-medium cursor-pointer text-white" style={{ backgroundColor: "#c45555" }}>🚫 NGインポート実行（{rows.length}件）</button>
              <button onClick={() => { setStep("guide"); setRows([]); setWarnings([]); }} className="px-6 py-3.5 rounded-xl text-[12px] cursor-pointer" style={{ color: T.textMuted, border: `1px solid ${T.border}` }}>← 戻る</button>
            </div>
          </div>)}

          {step === "importing" && (<div className="py-8 text-center space-y-4">
            <p className="text-[32px]">⏳</p><p className="text-[16px] font-medium">NG・メモをインポート中...</p>
            <div className="w-full h-3 rounded-full overflow-hidden" style={{ backgroundColor: T.cardAlt }}><div className="h-full rounded-full transition-all duration-300" style={{ width: `${progress}%`, backgroundColor: "#c45555" }} /></div>
            <p className="text-[12px]" style={{ color: T.textMuted }}>{progressText}</p>
          </div>)}

          {step === "done" && (<div className="space-y-4">
            <div className="text-center py-4"><p className="text-[32px] mb-2">🎉</p><p className="text-[18px] font-medium">インポート完了！</p></div>
            <div className="flex items-center justify-center gap-4 flex-wrap">
              {created > 0 && <span className="px-4 py-2 rounded-xl text-[13px] font-medium" style={{ backgroundColor: "#4a7c5918", color: "#4a7c59" }}>🆕 新規{created}件</span>}
              {updated > 0 && <span className="px-4 py-2 rounded-xl text-[13px] font-medium" style={{ backgroundColor: "#3b82f618", color: "#3b82f6" }}>🔄 更新{updated}件</span>}
              {errors > 0 && <span className="px-4 py-2 rounded-xl text-[13px] font-medium" style={{ backgroundColor: "#c4555518", color: "#c45555" }}>❌ エラー{errors}件</span>}
            </div>
            {errors > 0 && (<div className="rounded-xl border overflow-hidden max-h-[200px] overflow-y-auto" style={{ borderColor: T.border }}>
              {results.filter(r => r.status === "error").map((r, i) => (<div key={i} className="px-4 py-2 text-[10px]" style={{ borderBottom: `1px solid ${T.border}`, color: "#c45555" }}>❌ {r.name}: {r.error}</div>))}
            </div>)}
            <button onClick={onClose} className="w-full py-3.5 rounded-xl text-[14px] font-medium cursor-pointer text-white" style={{ backgroundColor: "#c45555" }}>閉じる</button>
          </div>)}

        </div>
      </div>
    </div>
  );
}
