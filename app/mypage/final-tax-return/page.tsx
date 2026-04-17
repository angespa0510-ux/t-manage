"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";
import { useTheme } from "../../../lib/theme";

/* ───────── 型定義 ───────── */
type Therapist = {
  id: number;
  name: string;
  real_name: string | null;
  has_invoice: boolean;
  has_withholding: boolean;
  invoice_number: string | null;
};

type Settlement = {
  id: number;
  therapist_id: number;
  date: string;
  total_back: number;          // 報酬総額（バック）
  adjustment: number;          // 調整額
  invoice_deduction: number;   // インボイス控除
  withholding_tax: number;     // 源泉徴収税額
  welfare_fee: number;         // 福利厚生費
  transport_fee: number;       // 交通費
  final_payment: number;       // 実受取額
  order_count: number;         // 予約件数
  is_settled: boolean;
};

const fmt = (n: number) => "¥" + (n || 0).toLocaleString();

/* ───────── アクセント色 ───────── */
const PINK = "#e8849a";
const GREEN = "#4a7c59";
const AMBER = "#d97706";
const BLUE = "#4a7ca0";

export default function FinalTaxReturnPage() {
  const { dark, toggle, T } = useTheme();

  const [therapist, setTherapist] = useState<Therapist | null>(null);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(() => {
    // 1月〜4月は前年をデフォルト表示（確定申告シーズン対応）
    const now = new Date();
    const month = now.getMonth() + 1;
    return month <= 4 ? now.getFullYear() - 1 : now.getFullYear();
  });

  /* セラピスト情報取得 */
  useEffect(() => {
    const session = localStorage.getItem("therapist_session");
    if (!session) {
      setLoading(false);
      return;
    }
    try {
      const { id } = JSON.parse(session);
      supabase
        .from("therapists")
        .select("id,name,real_name,has_invoice,has_withholding,invoice_number")
        .eq("id", id)
        .maybeSingle()
        .then(({ data }: { data: Therapist | null }) => {
          if (data) setTherapist(data);
        });
    } catch {
      /* ignore */
    }
  }, []);

  /* 年間精算データ取得 */
  useEffect(() => {
    if (!therapist) return;
    setLoading(true);
    const startDate = `${selectedYear}-01-01`;
    const endDate = `${selectedYear}-12-31`;
    supabase
      .from("therapist_daily_settlements")
      .select("*")
      .eq("therapist_id", therapist.id)
      .gte("date", startDate)
      .lte("date", endDate)
      .order("date", { ascending: true })
      .then(({ data }: { data: Settlement[] | null }) => {
        if (data) setSettlements(data);
        setLoading(false);
      });
  }, [therapist, selectedYear]);

  /* 集計計算 */
  const totalGross = settlements.reduce((s: number, r: Settlement) => s + (r.total_back || 0) + (r.adjustment || 0), 0);
  const totalInvoiceDed = settlements.reduce((s: number, r: Settlement) => s + (r.invoice_deduction || 0), 0);
  const totalWithholding = settlements.reduce((s: number, r: Settlement) => s + (r.withholding_tax || 0), 0);
  const totalWelfare = settlements.reduce((s: number, r: Settlement) => s + (r.welfare_fee || 0), 0);
  const totalTransport = settlements.reduce((s: number, r: Settlement) => s + (r.transport_fee || 0), 0);
  const totalFinal = settlements.reduce((s: number, r: Settlement) => s + (r.final_payment || 0), 0);
  const totalDays = settlements.length;
  const totalOrders = settlements.reduce((s: number, r: Settlement) => s + (r.order_count || 0), 0);

  /* 月別集計 */
  const monthly = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    const key = `${selectedYear}-${String(m).padStart(2, "0")}`;
    const ms = settlements.filter((s: Settlement) => s.date.startsWith(key));
    return {
      month: m,
      gross: ms.reduce((s: number, r: Settlement) => s + (r.total_back || 0) + (r.adjustment || 0), 0),
      withholding: ms.reduce((s: number, r: Settlement) => s + (r.withholding_tax || 0), 0),
      invoiceDed: ms.reduce((s: number, r: Settlement) => s + (r.invoice_deduction || 0), 0),
      final: ms.reduce((s: number, r: Settlement) => s + (r.final_payment || 0), 0),
      days: ms.length,
    };
  });

  /* 確定申告必要性判定 */
  // 48万円の基礎控除、103万円の給与所得控除との関係で簡易判定
  const isFilingRequired = totalGross > 480000;  // 基礎控除超
  const isFilingOptional = totalGross > 0 && totalGross <= 480000;

  if (!therapist && !loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: T.bg }}>
        <div className="text-center max-w-sm">
          <p className="text-[20px] mb-3">📋</p>
          <p className="text-[14px] mb-4" style={{ color: T.text }}>ログインが必要です</p>
          <Link href="/mypage" className="inline-block px-4 py-2 rounded-lg text-[12px]" style={{ backgroundColor: PINK, color: "white" }}>マイページへ</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: T.bg, color: T.text }}>
      {/* ヘッダー */}
      <div className="sticky top-0 z-10 px-4 py-3 flex items-center justify-between" style={{ backgroundColor: T.card, borderBottom: `1px solid ${T.border}` }}>
        <Link href="/mypage" className="text-[13px]" style={{ color: T.textSub, textDecoration: "none" }}>← マイページ</Link>
        <p className="text-[14px] font-medium">📋 確定申告まとめ</p>
        <button onClick={toggle} className="text-[11px] px-2 py-1 rounded cursor-pointer" style={{ backgroundColor: T.cardAlt, color: T.textSub, border: "none" }}>{dark ? "☀︎" : "🌙"}</button>
      </div>

      <div className="p-4 space-y-4 max-w-2xl mx-auto pb-20">
        {/* 年度選択 */}
        <div className="rounded-xl p-4" style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}>
          <p className="text-[11px] mb-2" style={{ color: T.textSub }}>対象年度</p>
          <div className="flex gap-2">
            {[selectedYear - 1, selectedYear, selectedYear + 1].filter(y => y <= new Date().getFullYear()).map(y => (
              <button key={y} onClick={() => setSelectedYear(y)} className="flex-1 px-3 py-2 rounded-lg text-[12px] cursor-pointer" style={{ backgroundColor: y === selectedYear ? PINK : T.cardAlt, color: y === selectedYear ? "white" : T.textSub, border: `1px solid ${y === selectedYear ? PINK : T.border}` }}>
                令和{y - 2018}年（{y}年）
                {y < new Date().getFullYear() && <span className="block text-[9px] mt-0.5" style={{ opacity: 0.8 }}>確定申告対象</span>}
                {y === new Date().getFullYear() && <span className="block text-[9px] mt-0.5" style={{ opacity: 0.8 }}>現在進行中</span>}
              </button>
            ))}
          </div>
        </div>

        {loading && (
          <div className="rounded-xl p-10 text-center" style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}>
            <p className="text-[12px]" style={{ color: T.textSub }}>読込中...</p>
          </div>
        )}

        {!loading && therapist && (
          <>
            {/* ウェルカムメッセージ */}
            <div className="rounded-xl p-4" style={{ backgroundColor: `${PINK}10`, border: `1px solid ${PINK}33` }}>
              <p className="text-[12px] leading-relaxed" style={{ color: T.text }}>
                {therapist.name}さん、こんにちは 🌸<br/>
                <span style={{ color: T.textSub }}>このページは、あなたが確定申告をするときに必要な情報をまとめた画面です。分からないことは気軽に店長までご相談ください。</span>
              </p>
            </div>

            {/* 年間サマリー・大きなカード */}
            <div className="rounded-xl p-5" style={{ backgroundColor: T.card, border: `2px solid ${PINK}` }}>
              <p className="text-[11px] mb-1" style={{ color: T.textSub }}>{selectedYear}年の年間収入</p>
              <p className="text-[28px] font-medium mb-1" style={{ color: PINK, fontVariantNumeric: "tabular-nums" }}>{fmt(totalGross)}</p>
              <p className="text-[10px]" style={{ color: T.textFaint }}>
                出勤{totalDays}日 / 予約{totalOrders}件 (チョップからの支払額合計)
              </p>

              <div className="mt-4 pt-4 space-y-2" style={{ borderTop: `1px solid ${T.border}` }}>
                {therapist.has_withholding && (
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-[11px]" style={{ color: T.textSub }}>源泉徴収税額</p>
                      <p className="text-[9px]" style={{ color: T.textFaint }}>所得税法204条1項6号</p>
                    </div>
                    <p className="text-[13px] font-medium" style={{ color: AMBER, fontVariantNumeric: "tabular-nums" }}>-{fmt(totalWithholding)}</p>
                  </div>
                )}
                {totalInvoiceDed > 0 && (
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-[11px]" style={{ color: T.textSub }}>インボイス控除</p>
                      <p className="text-[9px]" style={{ color: T.textFaint }}>{therapist.has_invoice ? "インボイス登録済" : "未登録（2割特例対象外）"}</p>
                    </div>
                    <p className="text-[13px] font-medium" style={{ color: AMBER, fontVariantNumeric: "tabular-nums" }}>-{fmt(totalInvoiceDed)}</p>
                  </div>
                )}
                {totalWelfare > 0 && (
                  <div className="flex justify-between items-center">
                    <p className="text-[11px]" style={{ color: T.textSub }}>福利厚生費</p>
                    <p className="text-[12px]" style={{ color: T.textSub, fontVariantNumeric: "tabular-nums" }}>-{fmt(totalWelfare)}</p>
                  </div>
                )}
                {totalTransport > 0 && (
                  <div className="flex justify-between items-center">
                    <p className="text-[11px]" style={{ color: T.textSub }}>交通費</p>
                    <p className="text-[12px]" style={{ color: GREEN, fontVariantNumeric: "tabular-nums" }}>+{fmt(totalTransport)}</p>
                  </div>
                )}
              </div>

              <div className="mt-4 pt-4 flex justify-between items-end" style={{ borderTop: `1px solid ${T.border}` }}>
                <p className="text-[12px]" style={{ color: T.textSub }}>実際に受け取った金額</p>
                <p className="text-[20px] font-medium" style={{ color: GREEN, fontVariantNumeric: "tabular-nums" }}>{fmt(totalFinal)}</p>
              </div>
            </div>

            {/* 確定申告必要性判定 */}
            {totalGross > 0 && (
              <div className="rounded-xl p-4" style={{ backgroundColor: isFilingRequired ? `${AMBER}10` : `${GREEN}10`, border: `1px solid ${isFilingRequired ? AMBER : GREEN}33` }}>
                <p className="text-[12px] font-medium mb-2" style={{ color: isFilingRequired ? AMBER : GREEN }}>
                  {isFilingRequired ? "⚠️ 確定申告が必要と思われます" : "✅ 確定申告は任意です"}
                </p>
                <p className="text-[11px] leading-relaxed" style={{ color: T.textSub }}>
                  {isFilingRequired ? (
                    <>
                      年間収入が<strong>48万円（基礎控除額）を超えている</strong>ため、通常は確定申告が必要です。<br/>
                      {totalWithholding > 0 && (
                        <><br/>チョップから源泉徴収された<strong>{fmt(totalWithholding)}</strong>は、確定申告をすることで<strong>一部または全額が還付される可能性</strong>があります。経費を計上して所得を減らせば、さらに還付額が増えることがあります。</>
                      )}
                    </>
                  ) : (
                    <>
                      年間収入が48万円以下のため、確定申告は義務ではありません。ただし、<strong>源泉徴収されている場合</strong>（{fmt(totalWithholding)}）は、確定申告をすれば<strong>全額還付される可能性が高い</strong>です。
                    </>
                  )}
                </p>
                <p className="text-[10px] mt-2" style={{ color: T.textFaint }}>
                  ※ 他の収入（パート・アルバイト等）がある場合、判定が変わります。不安な方は税理士に相談してください。
                </p>
              </div>
            )}

            {/* 月別内訳 */}
            <div className="rounded-xl overflow-hidden" style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}>
              <div className="px-4 py-2.5" style={{ backgroundColor: T.cardAlt, borderBottom: `1px solid ${T.border}` }}>
                <p className="text-[12px] font-medium">📅 月別内訳</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full" style={{ fontSize: 11 }}>
                  <thead>
                    <tr style={{ color: T.textSub, fontSize: 10, backgroundColor: T.cardAlt }}>
                      <th style={{ padding: "6px 8px", textAlign: "left" }}>月</th>
                      <th style={{ padding: "6px 8px", textAlign: "right" }}>出勤</th>
                      <th style={{ padding: "6px 8px", textAlign: "right" }}>報酬</th>
                      {therapist.has_withholding && <th style={{ padding: "6px 8px", textAlign: "right" }}>源泉</th>}
                      <th style={{ padding: "6px 8px", textAlign: "right" }}>実受取</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthly.filter(m => m.days > 0).map((m) => (
                      <tr key={m.month} style={{ borderTop: `1px solid ${T.border}` }}>
                        <td style={{ padding: "6px 8px", color: T.textSub }}>{m.month}月</td>
                        <td style={{ padding: "6px 8px", textAlign: "right", color: T.textSub, fontVariantNumeric: "tabular-nums" }}>{m.days}日</td>
                        <td style={{ padding: "6px 8px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmt(m.gross)}</td>
                        {therapist.has_withholding && <td style={{ padding: "6px 8px", textAlign: "right", color: AMBER, fontVariantNumeric: "tabular-nums" }}>{m.withholding > 0 ? `-${fmt(m.withholding)}` : "—"}</td>}
                        <td style={{ padding: "6px 8px", textAlign: "right", color: GREEN, fontVariantNumeric: "tabular-nums" }}>{fmt(m.final)}</td>
                      </tr>
                    ))}
                    {monthly.filter(m => m.days > 0).length === 0 && (
                      <tr><td colSpan={therapist.has_withholding ? 5 : 4} style={{ padding: "24px", textAlign: "center", color: T.textFaint, fontSize: 11 }}>この年度のデータがありません</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              <p className="text-[9px] px-4 py-2" style={{ color: T.textFaint, borderTop: `1px solid ${T.border}` }}>
                💡 もっと詳しい日別データが必要な場合、マイページの「給料」タブから確認できます。
              </p>
            </div>

            {/* 支払調書ダウンロード案内 */}
            <div className="rounded-xl p-4" style={{ backgroundColor: `${BLUE}10`, border: `1px solid ${BLUE}33` }}>
              <p className="text-[12px] font-medium mb-2" style={{ color: BLUE }}>📄 支払調書のダウンロード</p>
              <p className="text-[11px] leading-relaxed" style={{ color: T.textSub }}>
                確定申告には、チョップが発行する<strong>「支払調書」</strong>が役立ちます（必須ではありませんが、収入と源泉徴収税額を証明できる書類です）。
                <br/><br/>
                マイページの<strong>「各種証明書」</strong>タブから、年間の支払調書PDFをダウンロードできます。
              </p>
              <Link href="/mypage" className="inline-block mt-3 px-4 py-2 rounded-lg text-[11px] cursor-pointer" style={{ backgroundColor: BLUE, color: "white", textDecoration: "none" }}>
                マイページへ戻る →
              </Link>
            </div>

            {/* 確定申告の準備ガイド */}
            <div className="rounded-xl p-4" style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}>
              <p className="text-[12px] font-medium mb-3" style={{ color: T.text }}>📘 確定申告の準備ガイド</p>

              <details className="mb-2" style={{ borderBottom: `1px solid ${T.border}`, paddingBottom: 10 }}>
                <summary className="text-[11px] cursor-pointer py-2" style={{ color: T.text }}>🗓 確定申告の期間はいつ？</summary>
                <p className="text-[11px] leading-relaxed pl-2 pt-2" style={{ color: T.textSub }}>
                  毎年<strong>2月16日〜3月15日</strong>の約1ヶ月間です（土日に重なる場合は翌平日）。<br/>
                  この期間中に、前年1〜12月分の収入を申告します。<br/>
                  例: {selectedYear}年分 → <strong>{selectedYear + 1}年2月16日〜3月15日</strong>に申告
                </p>
              </details>

              <details className="mb-2" style={{ borderBottom: `1px solid ${T.border}`, paddingBottom: 10 }}>
                <summary className="text-[11px] cursor-pointer py-2" style={{ color: T.text }}>📝 白色申告 vs 青色申告 どっちがいい？</summary>
                <div className="text-[11px] leading-relaxed pl-2 pt-2" style={{ color: T.textSub }}>
                  <p className="mb-2"><strong>白色申告</strong>: 手続きが簡単。開業届と青色申告の申請が不要。<strong>初めての方におすすめ</strong>。</p>
                  <p className="mb-2"><strong>青色申告</strong>: 事前に申請が必要。帳簿付けが厳密だが、<strong>最大65万円の特別控除</strong>が受けられる。慣れたら検討。</p>
                  <p style={{ color: T.textFaint, fontSize: 10 }}>収入が多い人（年300万円以上）は青色申告の恩恵が大きいです。</p>
                </div>
              </details>

              <details className="mb-2" style={{ borderBottom: `1px solid ${T.border}`, paddingBottom: 10 }}>
                <summary className="text-[11px] cursor-pointer py-2" style={{ color: T.text }}>💰 経費として計上できるもの</summary>
                <div className="text-[11px] leading-relaxed pl-2 pt-2" style={{ color: T.textSub }}>
                  <p className="mb-2">仕事に関わる支出は経費になります。領収書・レシートを保管しておきましょう。</p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>通勤・移動の交通費（電車・ガソリン代）</li>
                    <li>仕事用の衣装・制服</li>
                    <li>美容関連（ネイル・ヘアケア用品）</li>
                    <li>スキルアップ講習・研修費</li>
                    <li>仕事で使う消耗品（タオル・オイルなど）</li>
                    <li>スマートフォン代（仕事使用分）</li>
                    <li>書籍・参考資料</li>
                  </ul>
                  <p className="mt-2" style={{ color: T.textFaint, fontSize: 10 }}>
                    ※ 経費に計上すると所得が減り、<strong>税金が下がります</strong>。源泉徴収された分の還付額も増えやすくなります。
                  </p>
                </div>
              </details>

              <details className="mb-2" style={{ borderBottom: `1px solid ${T.border}`, paddingBottom: 10 }}>
                <summary className="text-[11px] cursor-pointer py-2" style={{ color: T.text }}>💻 確定申告のやり方</summary>
                <div className="text-[11px] leading-relaxed pl-2 pt-2" style={{ color: T.textSub }}>
                  <p className="mb-2"><strong>方法1: e-Tax（スマホ・PC）</strong></p>
                  <p className="mb-2 pl-2">マイナンバーカードがあれば、スマホで完結します。国税庁の「確定申告書等作成コーナー」が便利。</p>
                  <p className="mb-2"><strong>方法2: 税務署で紙提出</strong></p>
                  <p className="mb-2 pl-2">書類を手書きまたは印刷して税務署へ持参・郵送。</p>
                  <p className="mb-2"><strong>方法3: 税理士に依頼</strong></p>
                  <p className="pl-2">料金は<strong>白色3〜5万円 / 青色5〜8万円</strong>が相場。チョップの顧問税理士（江坂先生）に相談も可能です。</p>
                </div>
              </details>

              <details style={{ paddingBottom: 10 }}>
                <summary className="text-[11px] cursor-pointer py-2" style={{ color: T.text }}>❓ 源泉徴収ってなに？返ってくるの？</summary>
                <p className="text-[11px] leading-relaxed pl-2 pt-2" style={{ color: T.textSub }}>
                  セラピストへの報酬（204条1項6号）は、チョップが<strong>事前に税金を預かって</strong>税務署に納める仕組みです。<br/><br/>
                  <strong>計算方法</strong>: （月の報酬 - 5,000円）× 10.21%<br/><br/>
                  確定申告で正しい税額が計算されると、<strong>預かりすぎた分が還付</strong>されます。経費を計上すれば還付額が増える可能性が高いです。
                </p>
              </details>
            </div>

            {/* 関連ガイドへのリンク */}
            <div className="rounded-xl p-4" style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}>
              <p className="text-[12px] font-medium mb-3">🔗 もっと詳しく知りたい方へ</p>
              <div className="space-y-2">
                <Link href="/mypage/tax-guide" className="block p-3 rounded-lg" style={{ backgroundColor: T.cardAlt, textDecoration: "none", color: T.text }}>
                  <p className="text-[12px] font-medium">🏢 副業バレ防止ガイド</p>
                  <p className="text-[10px] mt-1" style={{ color: T.textSub }}>本業にバレない住民税の切り替え方法</p>
                </Link>
                <Link href="/mypage/spouse-guide" className="block p-3 rounded-lg" style={{ backgroundColor: T.cardAlt, textDecoration: "none", color: T.text }}>
                  <p className="text-[12px] font-medium">👫 配偶者控除・扶養ガイド</p>
                  <p className="text-[10px] mt-1" style={{ color: T.textSub }}>103万・130万・150万の壁と2026年最新制度</p>
                </Link>
                <Link href="/mypage/invoice-guide" className="block p-3 rounded-lg" style={{ backgroundColor: T.cardAlt, textDecoration: "none", color: T.text }}>
                  <p className="text-[12px] font-medium">🧾 インボイスガイド</p>
                  <p className="text-[10px] mt-1" style={{ color: T.textSub }}>手取りシミュレーターで2割特例の効果を確認</p>
                </Link>
                <Link href="/mypage/single-mother-guide" className="block p-3 rounded-lg" style={{ backgroundColor: T.cardAlt, textDecoration: "none", color: T.text }}>
                  <p className="text-[12px] font-medium">👶 シングルマザー向けガイド</p>
                  <p className="text-[10px] mt-1" style={{ color: T.textSub }}>ひとり親控除・児童扶養手当との関係</p>
                </Link>
              </div>
            </div>

            {/* サポート案内 */}
            <div className="rounded-xl p-4 text-center" style={{ backgroundColor: `${PINK}10`, border: `1px solid ${PINK}33` }}>
              <p className="text-[11px] leading-relaxed" style={{ color: T.textSub }}>
                確定申告は<strong>一人で頑張る必要はありません</strong>💛<br/>
                分からないことは店長まで遠慮なくご相談ください。必要なら顧問税理士をご紹介することもできます。
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
