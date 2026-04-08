"use client";

import { useState, useRef } from "react";
import { supabase } from "../lib/supabase";
import * as XLSX from "xlsx";

type ImportRow = { name: string; self_name: string; phone: string; phone2: string; phone3: string; email: string; birthday: string; rank: string; notes: string };
type Result = { name: string; status: "created" | "updated" | "skipped" | "error"; error?: string };
type Props = { T: Record<string, string>; onClose: () => void; onComplete: () => void };

export default function CustomerImportPanel({ T, onClose, onComplete }: Props) {
  const [step, setStep] = useState<"guide" | "upload" | "preview" | "importing" | "done">("guide");
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [dupMode, setDupMode] = useState<"skip" | "update">("update");
  const fileRef = useRef<HTMLInputElement>(null);
  const normPhone = (p: string) => (p || "").toString().replace(/[-\s　()（）+]/g, "");
  const formatDate = (d: string): string => { if (!d) return ""; if (/^\d{5}$/.test(d)) { const dt = new Date((parseInt(d) - 25569) * 86400 * 1000); return dt.toISOString().split("T")[0]; } const m = d.match(/(\d{4})[/-](\d{1,2})[/-](\d{1,2})/); if (m) return `${m[1]}-${m[2].padStart(2,"0")}-${m[3].padStart(2,"0")}`; return ""; };
  const normalizeRank = (r: string): string => { const v = r.toLowerCase().trim(); if (["banned","出禁"].includes(v)) return "banned"; if (["caution","要注意"].includes(v)) return "caution"; if (["good","善良"].includes(v)) return "good"; return "normal"; };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const workbook = XLSX.read(ev.target?.result, { type: "array" });
      const sheetName = workbook.SheetNames.find(n => n.includes("顧客")) || workbook.SheetNames[0];
      const raw: string[][] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: "" });
      const customers: ImportRow[] = raw.slice(2).filter(r => r.some(c => c && String(c).trim())).map(r => ({
        name: String(r[0]||"").trim(), self_name: String(r[1]||"").trim(), phone: normPhone(String(r[2]||"")), phone2: normPhone(String(r[3]||"")), phone3: normPhone(String(r[4]||"")),
        email: String(r[5]||"").trim(), birthday: formatDate(String(r[6]||"")), rank: normalizeRank(String(r[7]||"")), notes: String(r[8]||"").trim(),
      })).filter(r => r.name);
      setRows(customers); setStep("preview");
    };
    reader.readAsArrayBuffer(file);
  };

  const runImport = async () => {
    setStep("importing"); const res: Result[] = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]; setProgress(Math.round(((i+1)/rows.length)*100)); setProgressText(`${i+1}/${rows.length} — ${row.name}`);
      try {
        let existing = null;
        if (row.phone) { const { data } = await supabase.from("customers").select("id").or(`phone.eq.${row.phone},phone2.eq.${row.phone},phone3.eq.${row.phone}`).maybeSingle(); existing = data; }
        if (!existing) { const { data } = await supabase.from("customers").select("id").eq("name", row.name).maybeSingle(); existing = data; }
        if (existing) {
          if (dupMode === "skip") { res.push({ name: row.name, status: "skipped" }); } else {
            const u: Record<string, string|null> = {};
            if (row.self_name) u.self_name = row.self_name; if (row.phone) u.phone = row.phone; if (row.phone2) u.phone2 = row.phone2; if (row.phone3) u.phone3 = row.phone3;
            if (row.email) u.email = row.email; if (row.birthday) u.birthday = row.birthday; if (row.rank && row.rank !== "normal") u.rank = row.rank; if (row.notes) u.notes = row.notes;
            if (Object.keys(u).length > 0) await supabase.from("customers").update(u).eq("id", existing.id);
            res.push({ name: row.name, status: "updated" });
          }
        } else {
          const ins: Record<string, string|null> = { name: row.name, rank: row.rank || "normal" };
          if (row.self_name) ins.self_name = row.self_name; if (row.phone) ins.phone = row.phone; if (row.phone2) ins.phone2 = row.phone2; if (row.phone3) ins.phone3 = row.phone3;
          if (row.email) ins.email = row.email; if (row.birthday) ins.birthday = row.birthday; if (row.notes) ins.notes = row.notes;
          await supabase.from("customers").insert(ins); res.push({ name: row.name, status: "created" });
        }
      } catch (err: unknown) { res.push({ name: row.name, status: "error", error: err instanceof Error ? err.message : "エラー" }); }
    }
    setResults(res); setStep("done"); onComplete();
  };

  const created = results.filter(r => r.status === "created").length; const updated = results.filter(r => r.status === "updated").length;
  const skipped = results.filter(r => r.status === "skipped").length; const errors = results.filter(r => r.status === "error").length;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-[fadeIn_0.25s]" style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }} onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 flex items-center justify-between sticky top-0 z-10" style={{ backgroundColor: T.card, borderBottom: `1px solid ${T.border}` }}>
          <h2 className="text-[16px] font-medium">📥 顧客データ インポート</h2>
          <button onClick={onClose} className="text-[14px] cursor-pointer p-2" style={{ color: T.textSub, background: "none", border: "none" }}>✕</button>
        </div>
        <div className="px-6 py-5">
          {step === "guide" && (<div className="space-y-5">
            <div className="rounded-xl p-4" style={{ backgroundColor: "#3b82f610", border: "1px solid #3b82f630" }}>
              <p className="text-[13px] font-medium mb-2" style={{ color: "#3b82f6" }}>📋 インポートの流れ</p>
              <div className="space-y-2 text-[12px]" style={{ color: T.textSub }}>
                {["テンプレートExcelに顧客情報を入力", "ファイルをアップロード", "プレビューで確認してインポート実行"].map((t, i) => (<div key={i} className="flex gap-3"><span className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold text-white" style={{ backgroundColor: "#3b82f6" }}>{i+1}</span><p className="pt-0.5">{t}</p></div>))}
              </div>
            </div>
            <div className="rounded-xl p-3" style={{ backgroundColor: "#f59e0b10", border: "1px solid #f59e0b30" }}>
              <p className="text-[11px]" style={{ color: "#f59e0b" }}>⚠️ NG・メモのインポートは、顧客とセラピストの両方を先に登録してから、別途「🚫 NGインポート」から行ってください。</p>
            </div>
            <button onClick={() => setStep("upload")} className="w-full py-3.5 rounded-xl text-[14px] font-medium cursor-pointer text-white" style={{ background: "linear-gradient(135deg, #c3a782, #b09672)" }}>次へ → ファイルをアップロード</button>
          </div>)}

          {step === "upload" && (<div className="space-y-5">
            <div className="border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer" style={{ borderColor: T.border }} onClick={() => fileRef.current?.click()}>
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} className="hidden" />
              <p className="text-[32px] mb-3">📁</p><p className="text-[14px] font-medium mb-1">ファイルをクリックして選択</p>
              <p className="text-[12px]" style={{ color: T.textMuted }}>Excel(.xlsx) — 「顧客情報」シートを読み込みます</p>
            </div>
            <div><p className="text-[12px] font-medium mb-2" style={{ color: T.textSub }}>重複データの扱い</p>
              <div className="flex gap-3">
                <button onClick={() => setDupMode("update")} className="flex-1 py-3 rounded-xl text-[12px] cursor-pointer" style={{ backgroundColor: dupMode === "update" ? "#c3a78218" : T.cardAlt, color: dupMode === "update" ? "#c3a782" : T.textMuted, border: `1px solid ${dupMode === "update" ? "#c3a782" : T.border}`, fontWeight: dupMode === "update" ? 600 : 400 }}>🔄 上書き更新</button>
                <button onClick={() => setDupMode("skip")} className="flex-1 py-3 rounded-xl text-[12px] cursor-pointer" style={{ backgroundColor: dupMode === "skip" ? "#3b82f618" : T.cardAlt, color: dupMode === "skip" ? "#3b82f6" : T.textMuted, border: `1px solid ${dupMode === "skip" ? "#3b82f6" : T.border}`, fontWeight: dupMode === "skip" ? 600 : 400 }}>⏭️ スキップ</button>
              </div>
            </div>
            <button onClick={() => setStep("guide")} className="w-full py-2.5 rounded-xl text-[12px] cursor-pointer" style={{ color: T.textMuted, border: `1px solid ${T.border}` }}>← 戻る</button>
          </div>)}

          {step === "preview" && (<div className="space-y-4">
            <div className="flex items-center justify-between"><div><p className="text-[14px] font-medium">📋 プレビュー</p><p className="text-[11px]" style={{ color: T.textMuted }}>{fileName}</p></div><span className="px-3 py-1.5 rounded-lg text-[11px] font-medium" style={{ backgroundColor: "#4a7c5918", color: "#4a7c59" }}>👥 {rows.length}件</span></div>
            <div className="rounded-xl border overflow-hidden" style={{ borderColor: T.border }}><div className="max-h-[300px] overflow-auto">
              <table className="w-full text-[10px]"><thead><tr style={{ backgroundColor: T.cardAlt }}>{["名前","お客様名","電話番号","ランク","備考"].map(h=><th key={h} className="py-2 px-3 text-left font-medium" style={{ color: T.textMuted }}>{h}</th>)}</tr></thead>
              <tbody>{rows.slice(0,15).map((r,i)=>(<tr key={i} style={{ borderBottom: `1px solid ${T.border}` }}><td className="py-2 px-3 font-medium">{r.name}</td><td className="py-2 px-3" style={{ color: T.textSub }}>{r.self_name||"—"}</td><td className="py-2 px-3" style={{ color: T.textMuted }}>{r.phone||"—"}</td><td className="py-2 px-3"><span className="px-1.5 py-0.5 rounded text-[8px]" style={{ backgroundColor: r.rank==="banned"?"#c4555518":r.rank==="caution"?"#f59e0b18":r.rank==="good"?"#4a7c5918":T.cardAlt, color: r.rank==="banned"?"#c45555":r.rank==="caution"?"#f59e0b":r.rank==="good"?"#4a7c59":T.textMuted }}>{r.rank==="banned"?"出禁":r.rank==="caution"?"要注意":r.rank==="good"?"善良":"普通"}</span></td><td className="py-2 px-3 max-w-[150px] truncate" style={{ color: T.textMuted }}>{r.notes?.split("\n")[0]||"—"}</td></tr>))}</tbody></table>
              {rows.length>15&&<p className="text-center py-2 text-[10px]" style={{ color: T.textFaint }}>...他{rows.length-15}件</p>}
            </div></div>
            <div className="flex gap-3">
              <button onClick={runImport} className="flex-1 py-3.5 rounded-xl text-[14px] font-medium cursor-pointer text-white" style={{ background: "linear-gradient(135deg, #c3a782, #b09672)" }}>📥 インポート実行（{rows.length}件）</button>
              <button onClick={() => { setStep("upload"); setRows([]); }} className="px-6 py-3.5 rounded-xl text-[12px] cursor-pointer" style={{ color: T.textMuted, border: `1px solid ${T.border}` }}>← 戻る</button>
            </div>
          </div>)}

          {step === "importing" && (<div className="py-8 text-center space-y-4"><p className="text-[32px]">⏳</p><p className="text-[16px] font-medium">インポート中...</p>
            <div className="w-full h-3 rounded-full overflow-hidden" style={{ backgroundColor: T.cardAlt }}><div className="h-full rounded-full transition-all duration-300" style={{ width: `${progress}%`, background: "linear-gradient(135deg, #c3a782, #b09672)" }} /></div>
            <p className="text-[12px]" style={{ color: T.textMuted }}>{progressText}</p></div>)}

          {step === "done" && (<div className="space-y-4">
            <div className="text-center py-4"><p className="text-[32px] mb-2">🎉</p><p className="text-[18px] font-medium">インポート完了！</p></div>
            <div className="flex items-center justify-center gap-4 flex-wrap">
              {created>0&&<span className="px-4 py-2 rounded-xl text-[13px] font-medium" style={{ backgroundColor: "#4a7c5918", color: "#4a7c59" }}>🆕 新規{created}件</span>}
              {updated>0&&<span className="px-4 py-2 rounded-xl text-[13px] font-medium" style={{ backgroundColor: "#3b82f618", color: "#3b82f6" }}>🔄 更新{updated}件</span>}
              {skipped>0&&<span className="px-4 py-2 rounded-xl text-[13px] font-medium" style={{ backgroundColor: "#f59e0b18", color: "#f59e0b" }}>⏭️ スキップ{skipped}件</span>}
              {errors>0&&<span className="px-4 py-2 rounded-xl text-[13px] font-medium" style={{ backgroundColor: "#c4555518", color: "#c45555" }}>❌ エラー{errors}件</span>}
            </div>
            <button onClick={onClose} className="w-full py-3.5 rounded-xl text-[14px] font-medium cursor-pointer text-white" style={{ background: "linear-gradient(135deg, #c3a782, #b09672)" }}>閉じる</button>
          </div>)}
        </div>
      </div>
    </div>
  );
}
