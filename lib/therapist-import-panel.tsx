"use client";

import { useState, useRef } from "react";
import { supabase } from "../lib/supabase";
import * as XLSX from "xlsx";

type ThRow = {
  name: string; status: string; entry_date: string; phone: string; email: string;
  age: number; height_cm: number; bust: number; cup: string; waist: number; hip: number;
  interval_minutes: number; photo_url: string; notes: string;
};

type Result = { name: string; status: "created" | "updated" | "skipped" | "error"; error?: string };

type Props = { T: Record<string, string>; onClose: () => void; onComplete: () => void };

export default function TherapistImportPanel({ T, onClose, onComplete }: Props) {
  const [step, setStep] = useState<"guide" | "upload" | "preview" | "importing" | "done">("guide");
  const [thRows, setThRows] = useState<ThRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [dupMode, setDupMode] = useState<"skip" | "update">("update");
  const fileRef = useRef<HTMLInputElement>(null);

  const normPhone = (p: string) => (p || "").toString().replace(/[-\s　()（）+]/g, "");

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const data = ev.target?.result;
      const workbook = XLSX.read(data, { type: "array" });

      // セラピストシートを探す
      const thSheetName = workbook.SheetNames.find(n => n.includes("セラピスト")) || workbook.SheetNames[0];
      const sheet1 = workbook.Sheets[thSheetName];
      const raw1: string[][] = XLSX.utils.sheet_to_json(sheet1, { header: 1, defval: "" });

      const dataRows = raw1.slice(2).filter(r => r.some(c => c && String(c).trim()));
      const therapists: ThRow[] = dataRows.map(r => ({
        name: String(r[0] || "").trim(),
        status: normalizeStatus(String(r[1] || "")),
        entry_date: formatDate(String(r[2] || "")),
        phone: normPhone(String(r[3] || "")),
        email: String(r[4] || "").trim(),
        age: parseInt(String(r[5] || "0")) || 0,
        height_cm: parseInt(String(r[6] || "0")) || 0,
        bust: parseInt(String(r[7] || "0")) || 0,
        cup: String(r[8] || "").trim().toUpperCase(),
        waist: parseInt(String(r[9] || "0")) || 0,
        hip: parseInt(String(r[10] || "0")) || 0,
        interval_minutes: parseInt(String(r[11] || "10")) || 10,
        photo_url: String(r[12] || "").trim(),
        notes: String(r[13] || "").trim(),
      })).filter(r => r.name);

      setThRows(therapists);

            setStep("preview");
    };
    reader.readAsArrayBuffer(file);
  };

  const formatDate = (d: string): string => {
    if (!d) return "";
    if (/^\d{5}$/.test(d)) {
      const date = new Date((parseInt(d) - 25569) * 86400 * 1000);
      return date.toISOString().split("T")[0];
    }
    const m = d.match(/(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
    if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
    return "";
  };

  const normalizeStatus = (s: string): string => {
    const v = s.toLowerCase().trim();
    if (["inactive", "休止", "休止中"].includes(v)) return "inactive";
    if (["retired", "退職", "退店", "退職済み"].includes(v)) return "retired";
    return "active";
  };

  const runImport = async () => {
    setImporting(true);
    setStep("importing");
    const res: Result[] = [];
    const total = thRows.length;

    for (let i = 0; i < thRows.length; i++) {
      const row = thRows[i];
      setProgress(Math.round(((i + 1) / total) * 100));
      setProgressText(`${i + 1} / ${total} — ${row.name}`);

      try {
        // 重複チェック（名前 or 電話番号）
        let existing = null;
        if (row.phone) {
          const { data } = await supabase.from("therapists").select("id").eq("phone", row.phone).maybeSingle();
          existing = data;
        }
        if (!existing) {
          const { data } = await supabase.from("therapists").select("id").eq("name", row.name).maybeSingle();
          existing = data;
        }

        if (existing) {
          if (dupMode === "skip") {
            res.push({ name: row.name, status: "skipped" });
          } else {
            const updates: Record<string, string | number | null> = {};
            if (row.status) updates.status = row.status;
            if (row.entry_date) updates.entry_date = row.entry_date;
            if (row.phone) updates.phone = row.phone;
            if (row.email) updates.email = row.email;
            if (row.age) updates.age = row.age;
            if (row.height_cm) updates.height_cm = row.height_cm;
            if (row.bust) updates.bust = row.bust;
            if (row.cup) updates.cup = row.cup;
            if (row.waist) updates.waist = row.waist;
            if (row.hip) updates.hip = row.hip;
            if (row.interval_minutes) updates.interval_minutes = row.interval_minutes;
            if (row.photo_url) updates.photo_url = row.photo_url;
            if (row.notes) updates.notes = row.notes;
            if (Object.keys(updates).length > 0) {
              await supabase.from("therapists").update(updates).eq("id", existing.id);
            }
            res.push({ name: row.name, status: "updated" });
          }
        } else {
          await supabase.from("therapists").insert({
            name: row.name,
            status: row.status || "active",
            entry_date: row.entry_date || null,
            phone: row.phone || "",
            email: row.email || "",
            age: row.age || 0,
            height_cm: row.height_cm || 0,
            bust: row.bust || 0,
            cup: row.cup || "",
            waist: row.waist || 0,
            hip: row.hip || 0,
            interval_minutes: row.interval_minutes || 10,
            photo_url: row.photo_url || "",
            notes: row.notes || "",
            salary_type: "fixed",
            salary_amount: 0,
            transport_fee: 0,
          });
          res.push({ name: row.name, status: "created" });
        }
      } catch (err: unknown) {
        res.push({ name: row.name, status: "error", error: err instanceof Error ? err.message : "エラー" });
      }
    }

    setResults(res);

        setImporting(false);
    setStep("done");
    onComplete();
  };

  const created = results.filter(r => r.status === "created").length;
  const updated = results.filter(r => r.status === "updated").length;
  const skipped = results.filter(r => r.status === "skipped").length;
  const errors = results.filter(r => r.status === "error").length;

  const statusLabel = (s: string) => s === "active" ? "稼働中" : s === "inactive" ? "休止" : s === "retired" ? "退職" : s;
  const statusColor = (s: string) => s === "active" ? "#4a7c59" : s === "inactive" ? "#f59e0b" : "#c45555";

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-[fadeIn_0.25s]" style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }} onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 flex items-center justify-between sticky top-0 z-10" style={{ backgroundColor: T.card, borderBottom: `1px solid ${T.border}` }}>
          <h2 className="text-[16px] font-medium" style={{ color: "#e8849a" }}>📥 セラピスト インポート</h2>
          <button onClick={onClose} className="text-[14px] cursor-pointer p-2" style={{ color: T.textSub, background: "none", border: "none" }}>✕</button>
        </div>

        <div className="px-6 py-5">
          {/* ===== ガイド ===== */}
          {step === "guide" && (
            <div className="space-y-5">
              <div className="rounded-xl p-4" style={{ backgroundColor: "#e8849a10", border: "1px solid #e8849a30" }}>
                <p className="text-[13px] font-medium mb-2" style={{ color: "#e8849a" }}>📋 インポートの流れ</p>
                <div className="space-y-3 text-[12px]" style={{ color: T.textSub }}>
                  {["テンプレートExcelにセラピスト情報を入力", "ファイルをアップロード", "プレビューで確認してインポート実行"].map((t, i) => (
                    <div key={i} className="flex gap-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold text-white" style={{ backgroundColor: "#e8849a" }}>{i + 1}</span>
                      <p className="pt-0.5">{t}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl p-4" style={{ backgroundColor: T.cardAlt }}>
                <p className="text-[12px] font-medium mb-2">📄 テンプレートの構成</p>
                <div className="space-y-2 text-[11px]" style={{ color: T.textSub }}>
                  <div className="p-2.5 rounded-lg" style={{ backgroundColor: T.card }}>
                    <p className="font-medium" style={{ color: "#e8849a" }}>シート「セラピスト」</p>
                    <p className="mt-0.5">名前, ステータス, 入店日, 電話番号, メール, 年齢, 身長, バスト, カップ, ウエスト, ヒップ, インターバル, 写真URL, 備考</p>
                  </div>
                  <div className="p-2.5 rounded-lg" style={{ backgroundColor: T.card }}>
                    <p className="font-medium" style={{ color: T.text }}>シート「NG・セラピストメモ」（任意）</p>
                    <p className="mt-0.5">お客様名, セラピスト名, NG, NG理由, メモ, 評価</p>
                    <p className="mt-0.5" style={{ color: T.textMuted }}>※ 同じお客様×セラピストの組み合わせは二重登録されません</p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl p-4" style={{ backgroundColor: "#f59e0b10", border: "1px solid #f59e0b30" }}>
                <p className="text-[12px] font-medium mb-1" style={{ color: "#f59e0b" }}>⚠️ 注意事項</p>
                <div className="text-[11px] space-y-1" style={{ color: T.textSub }}>
                  <p>・データは<strong>3行目から</strong>入力（1行目ヘッダー、2行目説明）</p>
                  <p>・名前または電話番号が一致するセラピストは重複登録されません</p>
                  <p>・NG・メモのインポートは、顧客とセラピスト両方を先に登録してから「🚫 NGインポート」から行ってください</p>
                  <p>・ステータスは active / inactive / retired（日本語でも可）</p>
                </div>
              </div>

              <button onClick={() => setStep("upload")} className="w-full py-3.5 rounded-xl text-[14px] font-medium cursor-pointer text-white" style={{ background: "linear-gradient(135deg, #e8849a, #d4687e)" }}>次へ → ファイルをアップロード</button>
            </div>
          )}

          {/* ===== アップロード ===== */}
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
                  <button onClick={() => setDupMode("update")} className="flex-1 py-3 rounded-xl text-[12px] cursor-pointer" style={{ backgroundColor: dupMode === "update" ? "#e8849a18" : T.cardAlt, color: dupMode === "update" ? "#e8849a" : T.textMuted, border: `1px solid ${dupMode === "update" ? "#e8849a" : T.border}`, fontWeight: dupMode === "update" ? 600 : 400 }}>🔄 上書き更新</button>
                  <button onClick={() => setDupMode("skip")} className="flex-1 py-3 rounded-xl text-[12px] cursor-pointer" style={{ backgroundColor: dupMode === "skip" ? "#3b82f618" : T.cardAlt, color: dupMode === "skip" ? "#3b82f6" : T.textMuted, border: `1px solid ${dupMode === "skip" ? "#3b82f6" : T.border}`, fontWeight: dupMode === "skip" ? 600 : 400 }}>⏭️ スキップ</button>
                </div>
              </div>

              <button onClick={() => setStep("guide")} className="w-full py-2.5 rounded-xl text-[12px] cursor-pointer" style={{ color: T.textMuted, border: `1px solid ${T.border}` }}>← 戻る</button>
            </div>
          )}

          {/* ===== プレビュー ===== */}
          {step === "preview" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[14px] font-medium">📋 プレビュー</p>
                  <p className="text-[11px] mt-0.5" style={{ color: T.textMuted }}>ファイル: {fileName}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1.5 rounded-lg text-[11px] font-medium" style={{ backgroundColor: "#e8849a18", color: "#e8849a" }}>💆 セラピスト {thRows.length}件</span>
                  
                </div>
              </div>

              <div className="rounded-xl border overflow-hidden" style={{ borderColor: T.border }}>
                <div className="px-4 py-2.5" style={{ backgroundColor: T.cardAlt, borderBottom: `1px solid ${T.border}` }}>
                  <p className="text-[11px] font-medium">セラピスト情報（先頭10件）</p>
                </div>
                <div className="max-h-[250px] overflow-auto">
                  <table className="w-full text-[10px]">
                    <thead><tr style={{ backgroundColor: T.cardAlt }}>
                      {["名前", "ステータス", "入店日", "電話番号", "年齢", "スリーサイズ", "インターバル"].map(h => <th key={h} className="py-2 px-3 text-left font-medium" style={{ color: T.textMuted }}>{h}</th>)}
                    </tr></thead>
                    <tbody>
                      {thRows.slice(0, 10).map((r, i) => (
                        <tr key={i} style={{ borderBottom: `1px solid ${T.border}` }}>
                          <td className="py-2 px-3 font-medium">{r.name}</td>
                          <td className="py-2 px-3"><span className="px-1.5 py-0.5 rounded text-[8px]" style={{ backgroundColor: statusColor(r.status) + "18", color: statusColor(r.status) }}>{statusLabel(r.status)}</span></td>
                          <td className="py-2 px-3" style={{ color: T.textMuted }}>{r.entry_date || "—"}</td>
                          <td className="py-2 px-3" style={{ color: T.textMuted }}>{r.phone || "—"}</td>
                          <td className="py-2 px-3" style={{ color: T.textMuted }}>{r.age || "—"}</td>
                          <td className="py-2 px-3" style={{ color: T.textMuted }}>{r.bust && r.waist && r.hip ? `B${r.bust}(${r.cup}) W${r.waist} H${r.hip}` : "—"}</td>
                          <td className="py-2 px-3" style={{ color: T.textMuted }}>{r.interval_minutes}分</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {thRows.length > 10 && <p className="text-center py-2 text-[10px]" style={{ color: T.textFaint }}>... 他 {thRows.length - 10}件</p>}
                </div>
              </div>

              <div className="rounded-xl p-3" style={{ backgroundColor: "#f59e0b10", border: "1px solid #f59e0b30" }}>
                <p className="text-[11px]" style={{ color: "#f59e0b" }}>⚠️ 重複: 名前または電話番号が一致 → {dupMode === "update" ? "🔄 上書き更新" : "⏭️ スキップ"}</p>
              </div>

              <div className="flex gap-3">
                <button onClick={runImport} className="flex-1 py-3.5 rounded-xl text-[14px] font-medium cursor-pointer text-white" style={{ background: "linear-gradient(135deg, #e8849a, #d4687e)" }}>📥 インポート実行（{thRows.length}件）</button>
                <button onClick={() => { setStep("upload"); setThRows([]); }} className="px-6 py-3.5 rounded-xl text-[12px] cursor-pointer" style={{ color: T.textMuted, border: `1px solid ${T.border}` }}>← 戻る</button>
              </div>
            </div>
          )}

          {/* ===== インポート中 ===== */}
          {step === "importing" && (
            <div className="py-8 text-center space-y-4">
              <p className="text-[32px]">⏳</p>
              <p className="text-[16px] font-medium">インポート中...</p>
              <div className="w-full h-3 rounded-full overflow-hidden" style={{ backgroundColor: T.cardAlt }}>
                <div className="h-full rounded-full transition-all duration-300" style={{ width: `${progress}%`, background: "linear-gradient(135deg, #e8849a, #d4687e)" }} />
              </div>
              <p className="text-[12px]" style={{ color: T.textMuted }}>{progressText}</p>
            </div>
          )}

          {/* ===== 完了 ===== */}
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



              {errors > 0 && (
                <div className="rounded-xl border overflow-hidden max-h-[200px] overflow-y-auto" style={{ borderColor: T.border }}>
                  {results.filter(r => r.status === "error").map((r, i) => (
                    <div key={i} className="px-4 py-2 text-[10px]" style={{ borderBottom: `1px solid ${T.border}`, color: "#c45555" }}>❌ {r.name}: {r.error}</div>
                  ))}
                </div>
              )}

              <button onClick={onClose} className="w-full py-3.5 rounded-xl text-[14px] font-medium cursor-pointer text-white" style={{ background: "linear-gradient(135deg, #e8849a, #d4687e)" }}>閉じる</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
