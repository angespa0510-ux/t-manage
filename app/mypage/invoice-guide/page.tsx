"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";
import { useTheme } from "../../../lib/theme";

/* ───────── 型 ───────── */
type TherapistLite = {
  id: number;
  name: string;
  has_invoice?: boolean;
};

/* ───────── アクセント色 ───────── */
const PINK = "#e8849a";
const PINK_DARK = "#d4687e";
const GREEN = "#4a7c59";
const BLUE = "#5a84a8";
const AMBER = "#d97706";
const RED = "#c45555";
const GOLD = "#c3a782";

export default function InvoiceGuidePage() {
  const { dark, toggle, T } = useTheme();
  const [therapist, setTherapist] = useState<TherapistLite | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [monthlyBack, setMonthlyBack] = useState<string>("");
  const [annualSales, setAnnualSales] = useState<number>(0);

  /* セラピスト情報取得 */
  useEffect(() => {
    const session = localStorage.getItem("therapist_session");
    if (!session) return;
    try {
      const { id } = JSON.parse(session);
      supabase
        .from("therapists")
        .select("id,name,has_invoice")
        .eq("id", id)
        .maybeSingle()
        .then(({ data }) => {
          if (data) setTherapist(data as TherapistLite);
        });

      // 過去12ヶ月のバック合計を自動取得して参考値に
      const oneYearAgo = new Date();
      oneYearAgo.setMonth(oneYearAgo.getMonth() - 12);
      const d = oneYearAgo.toISOString().slice(0, 10);
      supabase
        .from("therapist_daily_settlements")
        .select("total_back")
        .eq("therapist_id", id)
        .gte("date", d)
        .eq("is_settled", true)
        .then(({ data }) => {
          if (data && data.length > 0) {
            const sum = data.reduce(
              (s: number, r: { total_back?: number }) =>
                s + (r.total_back || 0),
              0
            );
            setAnnualSales(sum);
          }
        });
    } catch {
      /* ignore */
    }
  }, []);

  /* 永続化 */
  useEffect(() => {
    const saved = localStorage.getItem("invoice-guide-monthly");
    if (saved) setMonthlyBack(saved);
  }, []);

  const updateMonthly = (v: string) => {
    setMonthlyBack(v);
    localStorage.setItem("invoice-guide-monthly", v);
  };

  /* ───────── 計算ロジック ─────────
     現状のチョップ計算式（timechart/page.tsx L1509）：
       invoice未登録 → バック × 10% を控除
       invoice登録  → 控除なし

     2割特例（〜2026年9月）：
       納税額 = 売上 × 10/110 × 20% ≒ 売上 × 1.818%
     3割特例（2027-2028）：
       納税額 = 売上 × 10/110 × 30% ≒ 売上 × 2.727%
     簡易課税・第5種（2029〜、みなし仕入率50%）：
       納税額 = 売上 × 10/110 × 50% ≒ 売上 × 4.545%
  */
  const monthly = parseFloat(monthlyBack) || 0; // 万円
  const annual = monthly * 12; // 万円

  // 現状（未登録）の年間控除額（バックの10%）
  const currentDeduction = annual * 0.1;

  // 登録した場合の消費税納税額（売上×消費税率10%から特例適用後）
  // バック金額に消費税10%が含まれると仮定
  const tax2wari = annual * (10 / 110) * 0.2; // 2割特例
  const tax3wari = annual * (10 / 110) * 0.3; // 3割特例
  const taxKanni5 = annual * (10 / 110) * 0.5; // 簡易課税 第5種

  // 実質的な手取り差（年間）
  const benefit2wari = currentDeduction - tax2wari;
  const benefit3wari = currentDeduction - tax3wari;
  const benefitKanni5 = currentDeduction - taxKanni5;

  const formatJpy = (manEn: number): string => {
    const yen = manEn * 10000;
    if (yen >= 10000) return `${(yen / 10000).toFixed(1)}万円`;
    if (yen >= 1000) return `${(yen / 1000).toFixed(1)}千円`;
    return `${Math.round(yen)}円`;
  };

  /* 年間売上の参考表示 */
  const refManYen = useMemo(
    () => (annualSales > 0 ? Math.round(annualSales / 10000) : 0),
    [annualSales]
  );

  return (
    <div style={{ minHeight: "100vh", backgroundColor: T.bg, color: T.text }}>
      {/* ヘッダー */}
      <header
        className="sticky top-0 z-10 px-4 py-3 border-b flex items-center justify-between"
        style={{ backgroundColor: T.card, borderColor: T.border }}
      >
        <Link
          href="/mypage"
          className="text-[12px] flex items-center gap-1 cursor-pointer"
          style={{ color: T.textSub }}
        >
          <span style={{ fontSize: 14 }}>◀</span> マイページに戻る
        </Link>
        <div className="flex items-center gap-2">
          <button
            onClick={toggle}
            className="px-2 py-1 text-[9px] rounded-lg cursor-pointer border"
            style={{ borderColor: T.border, color: T.textSub }}
          >
            {dark ? "☀️" : "🌙"}
          </button>
        </div>
      </header>

      <main className="max-w-[720px] mx-auto p-4 space-y-5 pb-20">
        {/* ─── ヒーロー ─── */}
        <section
          className="rounded-2xl p-5 border"
          style={{
            background: dark
              ? "linear-gradient(135deg, #3a3328, #2a2520)"
              : "linear-gradient(135deg, #faf4e8, #fff9f0)",
            borderColor: GOLD + "66",
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <span style={{ fontSize: 24 }}>💎</span>
            <h1 className="text-[18px] font-bold" style={{ color: GOLD }}>
              インボイス登録ガイド
            </h1>
          </div>
          <p
            className="text-[12px] leading-relaxed font-medium"
            style={{ color: PINK_DARK }}
          >
            チョップは、セラピストさんのインボイス登録を応援しています 🌸
          </p>
          <p
            className="text-[11px] leading-relaxed mt-2"
            style={{ color: T.textSub }}
          >
            登録すると<strong>毎月の手取りが増える</strong>だけでなく、プロとしての信用度もUP。
            2026年の「2割特例」は登録するなら<strong>今が最もお得なタイミング</strong>です。
          </p>
          {therapist && (
            <div
              className="mt-3 rounded-lg p-2 flex items-center gap-2"
              style={{
                backgroundColor: therapist.has_invoice
                  ? GREEN + "18"
                  : AMBER + "18",
                border: `1px solid ${
                  therapist.has_invoice ? GREEN + "44" : AMBER + "44"
                }`,
              }}
            >
              <span style={{ fontSize: 16 }}>
                {therapist.has_invoice ? "✅" : "⚠️"}
              </span>
              <p
                className="text-[11px] font-medium"
                style={{
                  color: therapist.has_invoice ? GREEN : AMBER,
                }}
              >
                {therapist.has_invoice
                  ? `${therapist.name} さんはインボイス登録済みです！`
                  : `${therapist.name} さんはまだインボイス未登録です`}
              </p>
            </div>
          )}
        </section>

        {/* ─── チョップが推奨する3つの理由 ─── */}
        <section
          className="rounded-2xl p-4 border"
          style={{ backgroundColor: T.card, borderColor: T.border }}
        >
          <h2 className="text-[14px] font-semibold mb-3">
            🌟 チョップが登録を推奨する3つの理由
          </h2>
          <div className="space-y-2">
            {[
              {
                num: "①",
                emoji: "💰",
                title: "毎月の手取りが増える",
                desc: "現在チョップでは、インボイス未登録のセラピストさんからバック額の10%を『インボイス控除』として差し引いています。登録すれば、この控除がなくなります。",
                color: GREEN,
              },
              {
                num: "②",
                emoji: "🎖️",
                title: "プロとしての信用度UP",
                desc: "インボイス番号を持っていることで、他のお店・取引先からも信頼されやすく、指名・移籍・将来の独立にも有利になります。",
                color: BLUE,
              },
              {
                num: "③",
                emoji: "🎁",
                title: "2割特例で消費税の負担が少ない",
                desc: "2026年9月末までは、売上の約1.8%を納めるだけでOK。控除10%が消える方がずっとお得なので、実質的に手取りが増えます。",
                color: GOLD,
              },
            ].map((r, i) => (
              <div
                key={i}
                className="rounded-xl p-3"
                style={{
                  backgroundColor: r.color + "0d",
                  border: `1px solid ${r.color}33`,
                }}
              >
                <div className="flex gap-3">
                  <div
                    className="flex-shrink-0 rounded-full flex items-center justify-center"
                    style={{
                      width: 36,
                      height: 36,
                      backgroundColor: r.color,
                      color: "#fff",
                      fontWeight: 700,
                    }}
                  >
                    {r.num}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p
                      className="text-[12.5px] font-bold"
                      style={{ color: r.color }}
                    >
                      {r.emoji} {r.title}
                    </p>
                    <p
                      className="text-[11px] leading-relaxed mt-1"
                      style={{ color: T.textSub }}
                    >
                      {r.desc}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ─── 手取りシミュレーター ─── */}
        <section
          className="rounded-2xl p-4 border"
          style={{
            backgroundColor: PINK + "08",
            borderColor: PINK + "44",
          }}
        >
          <h2
            className="text-[14px] font-semibold mb-1"
            style={{ color: PINK_DARK }}
          >
            🧮 あなたの手取り差シミュレーター
          </h2>
          <p className="text-[10.5px] mb-3" style={{ color: T.textMuted }}>
            月のバック（取り分）を入力すると、登録/未登録の差が計算されます
          </p>

          <div>
            <label
              className="text-[10px] block mb-1"
              style={{ color: T.textSub }}
            >
              あなたの月のバック合計（取り分）
            </label>
            <div className="relative">
              <input
                type="number"
                inputMode="decimal"
                value={monthlyBack}
                onChange={(e) => updateMonthly(e.target.value)}
                placeholder="例：30"
                className="w-full px-3 py-2.5 pr-10 rounded-xl text-[13px] outline-none border"
                style={{
                  backgroundColor: T.card,
                  borderColor: T.border,
                  color: T.text,
                }}
              />
              <span
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px]"
                style={{ color: T.textMuted }}
              >
                万円/月
              </span>
            </div>
            {refManYen > 0 && !monthlyBack && (
              <button
                onClick={() => updateMonthly(String(Math.round(refManYen / 12)))}
                className="text-[10px] mt-2 px-2 py-1 rounded cursor-pointer"
                style={{
                  color: PINK_DARK,
                  border: `1px dashed ${PINK}44`,
                }}
              >
                💡 あなたの過去12ヶ月の実績から自動入力（月平均 約
                {Math.round(refManYen / 12)}万円）
              </button>
            )}
          </div>

          {monthly > 0 && (
            <div className="mt-4 space-y-3">
              {/* 現在の状態 */}
              <div
                className="rounded-xl p-3"
                style={{
                  backgroundColor: RED + "0d",
                  border: `1px solid ${RED}33`,
                }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className="text-[9px] px-2 py-0.5 rounded-full font-bold"
                    style={{ backgroundColor: RED + "22", color: RED }}
                  >
                    現在（未登録）
                  </span>
                </div>
                <div className="text-[11px] space-y-1" style={{ color: T.textSub }}>
                  <div className="flex justify-between">
                    <span>年間バック合計</span>
                    <span style={{ color: T.text }}>
                      {formatJpy(annual)}
                    </span>
                  </div>
                  <div
                    className="flex justify-between"
                    style={{ color: RED }}
                  >
                    <span>─ インボイス控除（-10%）</span>
                    <span className="font-bold">
                      −{formatJpy(currentDeduction)}
                    </span>
                  </div>
                  <div
                    className="flex justify-between pt-1 mt-1 font-bold"
                    style={{ borderTop: `1px solid ${T.border}` }}
                  >
                    <span style={{ color: T.text }}>手取り</span>
                    <span style={{ color: T.text }}>
                      {formatJpy(annual - currentDeduction)}
                    </span>
                  </div>
                </div>
              </div>

              {/* 登録後 2割特例 */}
              <div
                className="rounded-xl p-3"
                style={{
                  backgroundColor: GREEN + "0d",
                  border: `1.5px solid ${GREEN}66`,
                }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className="text-[9px] px-2 py-0.5 rounded-full font-bold"
                    style={{ backgroundColor: GREEN + "22", color: GREEN }}
                  >
                    登録後（〜2026年9月・2割特例）
                  </span>
                </div>
                <div
                  className="text-[11px] space-y-1"
                  style={{ color: T.textSub }}
                >
                  <div className="flex justify-between">
                    <span>年間バック合計</span>
                    <span style={{ color: T.text }}>{formatJpy(annual)}</span>
                  </div>
                  <div className="flex justify-between" style={{ color: GREEN }}>
                    <span>✅ インボイス控除なし</span>
                    <span className="font-bold">±0円</span>
                  </div>
                  <div
                    className="flex justify-between"
                    style={{ color: AMBER }}
                  >
                    <span>─ 消費税（2割特例）</span>
                    <span>−{formatJpy(tax2wari)}</span>
                  </div>
                  <div
                    className="flex justify-between pt-1 mt-1 font-bold"
                    style={{ borderTop: `1px solid ${T.border}` }}
                  >
                    <span style={{ color: T.text }}>手取り</span>
                    <span style={{ color: GREEN, fontSize: 13 }}>
                      {formatJpy(annual - tax2wari)}
                    </span>
                  </div>
                </div>
                <div
                  className="mt-2 pt-2 flex items-center justify-between"
                  style={{ borderTop: `2px dashed ${GREEN}44` }}
                >
                  <span className="text-[11px] font-bold" style={{ color: GREEN }}>
                    💰 年間の手取り増
                  </span>
                  <span
                    className="text-[15px] font-bold"
                    style={{ color: GREEN }}
                  >
                    +{formatJpy(benefit2wari)}
                  </span>
                </div>
              </div>

              {/* 2027-2028年 3割特例 */}
              <details
                className="rounded-xl"
                style={{
                  backgroundColor: T.cardAlt,
                  border: `1px solid ${T.border}`,
                }}
              >
                <summary
                  className="p-3 text-[11px] cursor-pointer"
                  style={{ color: T.textSub }}
                >
                  📅 2027年以降はどうなる？（3割特例・簡易課税）
                </summary>
                <div className="px-3 pb-3 text-[11px] space-y-2">
                  <div
                    className="rounded-lg p-2"
                    style={{ backgroundColor: T.card }}
                  >
                    <p
                      className="font-bold mb-1"
                      style={{ color: BLUE, fontSize: 11 }}
                    >
                      2027〜2028年：3割特例
                    </p>
                    <div className="flex justify-between">
                      <span>消費税納税</span>
                      <span style={{ color: AMBER }}>
                        −{formatJpy(tax3wari)}/年
                      </span>
                    </div>
                    <div
                      className="flex justify-between font-bold mt-1 pt-1"
                      style={{ borderTop: `1px solid ${T.border}` }}
                    >
                      <span>それでも手取り増</span>
                      <span style={{ color: GREEN }}>
                        +{formatJpy(benefit3wari)}/年
                      </span>
                    </div>
                  </div>
                  <div
                    className="rounded-lg p-2"
                    style={{ backgroundColor: T.card }}
                  >
                    <p
                      className="font-bold mb-1"
                      style={{ color: GOLD, fontSize: 11 }}
                    >
                      2029年〜：簡易課税（第5種・みなし仕入率50%）
                    </p>
                    <div className="flex justify-between">
                      <span>消費税納税</span>
                      <span style={{ color: AMBER }}>
                        −{formatJpy(taxKanni5)}/年
                      </span>
                    </div>
                    <div
                      className="flex justify-between font-bold mt-1 pt-1"
                      style={{ borderTop: `1px solid ${T.border}` }}
                    >
                      <span>
                        {benefitKanni5 >= 0 ? "それでも手取り増" : "手取り減"}
                      </span>
                      <span
                        style={{
                          color: benefitKanni5 >= 0 ? GREEN : RED,
                        }}
                      >
                        {benefitKanni5 >= 0 ? "+" : ""}
                        {formatJpy(benefitKanni5)}/年
                      </span>
                    </div>
                  </div>
                  <p
                    className="text-[10px]"
                    style={{ color: T.textMuted }}
                  >
                    ※ 2029年以降も多くのセラピストさんは現在の10%控除より有利です
                  </p>
                </div>
              </details>
            </div>
          )}
        </section>

        {/* ─── 制度スケジュール ─── */}
        <section
          className="rounded-2xl p-4 border"
          style={{ backgroundColor: T.card, borderColor: T.border }}
        >
          <h2 className="text-[14px] font-semibold mb-3">📅 消費税の負担スケジュール</h2>
          <div className="space-y-2">
            {[
              {
                period: "2026年9月まで",
                title: "2割特例（イチオシ！）",
                rate: "売上の約1.8%",
                desc: "最もお得な期間。登録するなら今すぐが正解。",
                color: GREEN,
                icon: "🌟",
              },
              {
                period: "2027〜2028年",
                title: "3割特例",
                rate: "売上の約2.7%",
                desc: "個人事業主限定の新制度。激変緩和のソフトランディング。",
                color: BLUE,
                icon: "🎯",
              },
              {
                period: "2029年〜",
                title: "簡易課税（第5種）",
                rate: "売上の約4.5%",
                desc: "みなし仕入率50%。事前届出が必要（2028年末まで）。",
                color: GOLD,
                icon: "📊",
              },
            ].map((s, i) => (
              <div
                key={i}
                className="rounded-xl p-3 flex items-center gap-3"
                style={{
                  backgroundColor: s.color + "0d",
                  border: `1px solid ${s.color}33`,
                }}
              >
                <div
                  className="flex-shrink-0 text-center"
                  style={{ width: 80 }}
                >
                  <p style={{ fontSize: 20 }}>{s.icon}</p>
                  <p
                    className="text-[9.5px] font-bold mt-0.5"
                    style={{ color: s.color, lineHeight: 1.2 }}
                  >
                    {s.period}
                  </p>
                </div>
                <div style={{ flex: 1 }}>
                  <p
                    className="text-[12px] font-bold"
                    style={{ color: s.color }}
                  >
                    {s.title}
                  </p>
                  <p
                    className="text-[11px] font-semibold"
                    style={{ color: T.text }}
                  >
                    {s.rate}
                  </p>
                  <p
                    className="text-[10px] mt-0.5 leading-relaxed"
                    style={{ color: T.textSub }}
                  >
                    {s.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <p
            className="text-[10px] mt-3 leading-relaxed"
            style={{ color: T.textMuted }}
          >
            ※ 2割特例・3割特例は「基準期間（2年前）の課税売上高が1,000万円以下」の方が対象
          </p>
        </section>

        {/* ─── 屋号で本名を隠す ─── */}
        <section
          className="rounded-2xl p-4 border"
          style={{ backgroundColor: T.card, borderColor: T.border }}
        >
          <h2 className="text-[14px] font-semibold mb-1">
            🎭 「本名公開」の不安は"屋号登録"で解決
          </h2>
          <p className="text-[10.5px] mb-3" style={{ color: T.textMuted }}>
            よくある心配ですが、対策があります
          </p>

          <div
            className="rounded-xl p-3 mb-2"
            style={{
              backgroundColor: AMBER + "0d",
              border: `1px solid ${AMBER}33`,
            }}
          >
            <p
              className="text-[11px] font-semibold mb-1"
              style={{ color: AMBER }}
            >
              ⚠️ デフォルトでは本名が公開されます
            </p>
            <p className="text-[10.5px] leading-relaxed" style={{ color: T.textSub }}>
              国税庁の公表サイトで検索すれば、登録番号から本名が確認できる仕組みです。
            </p>
          </div>

          <div
            className="rounded-xl p-3"
            style={{
              backgroundColor: GREEN + "0d",
              border: `1px solid ${GREEN}33`,
            }}
          >
            <p
              className="text-[11px] font-semibold mb-2"
              style={{ color: GREEN }}
            >
              ✅ 解決策：「屋号」での登録も可能
            </p>
            <div
              className="text-[10.5px] space-y-1 leading-relaxed"
              style={{ color: T.textSub }}
            >
              <p>
                登録申請時に<strong>「主たる屋号」</strong>を記載すれば、公表サイトでも屋号が表示されます。
              </p>
              <p>例：</p>
              <ul className="pl-4 space-y-0.5" style={{ listStyle: "disc" }}>
                <li>「〇〇ボディケア」</li>
                <li>「△△セラピー」</li>
                <li>「Smile Body Works」</li>
                <li>「癒し処 □□」</li>
              </ul>
              <p className="mt-2 text-[10px]" style={{ color: T.textMuted }}>
                ※ 本名も完全に非表示にはできず、屋号と併記する場合が多いですが、検索性が大幅に下がります。
              </p>
            </div>
          </div>
        </section>

        {/* ─── 登録方法 ─── */}
        <section
          className="rounded-2xl p-4 border"
          style={{ backgroundColor: T.card, borderColor: T.border }}
        >
          <h2 className="text-[14px] font-semibold mb-3">
            🚀 登録の手順（e-Taxなら自宅に書類が届かない）
          </h2>
          <div className="space-y-2">
            {[
              {
                step: "1",
                title: "マイナンバーカードを用意",
                desc: "なければ市役所で発行（約1ヶ月）。e-Taxには必須です。",
              },
              {
                step: "2",
                title: "開業届を提出（まだの場合）",
                desc: "e-Taxで開業届＋青色申告承認申請書を同時提出。屋号もここで決める。",
              },
              {
                step: "3",
                title: "適格請求書発行事業者の登録申請",
                desc: "国税庁サイトからオンライン申請（e-Tax）。屋号欄を忘れず記入！",
              },
              {
                step: "4",
                title: "通知書を電子データで受け取る",
                desc: "申請時に「電子通知希望」にチェック → 紙の書類は届かない",
              },
              {
                step: "5",
                title: "1〜2週間後に登録番号が発行",
                desc: "T番号（T + 13桁）が付与される",
              },
              {
                step: "6",
                title: "チョップへ登録番号を連絡",
                desc: "店長または事務担当へ。次月の清算からインボイス控除がなくなる！",
              },
            ].map((s) => (
              <div
                key={s.step}
                className="rounded-xl p-3 flex gap-3"
                style={{ backgroundColor: T.cardAlt }}
              >
                <div
                  className="rounded-full flex items-center justify-center flex-shrink-0"
                  style={{
                    width: 28,
                    height: 28,
                    backgroundColor: GOLD,
                    color: "#fff",
                    fontWeight: 700,
                    fontSize: 12,
                  }}
                >
                  {s.step}
                </div>
                <div style={{ flex: 1 }}>
                  <p
                    className="text-[12px] font-semibold"
                    style={{ color: T.text }}
                  >
                    {s.title}
                  </p>
                  <p
                    className="text-[10.5px] leading-relaxed mt-0.5"
                    style={{ color: T.textSub }}
                  >
                    {s.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <a
            href="https://www.invoice-kohyo.nta.go.jp/regist/"
            target="_blank"
            rel="noopener noreferrer"
            className="block mt-3 text-center py-2.5 rounded-xl text-[12px] font-bold"
            style={{
              background: `linear-gradient(135deg, ${GOLD}, #b09672)`,
              color: "#fff",
            }}
          >
            🌐 国税庁 登録申請サイトを開く →
          </a>
        </section>

        {/* ─── デメリットも正直に ─── */}
        <section
          className="rounded-2xl p-4 border"
          style={{ backgroundColor: T.card, borderColor: T.border }}
        >
          <h2 className="text-[14px] font-semibold mb-3">
            ⚖️ 正直に伝えたいデメリット
          </h2>
          <div className="space-y-2">
            {[
              {
                title: "消費税の納税義務が発生する",
                desc: "ただし2割特例で負担は小さい。インボイス控除10%より圧倒的に有利。",
              },
              {
                title: "確定申告の手間が少し増える",
                desc: "消費税の申告が1枚追加。会計ソフト（freee等）を使えば自動計算されます。",
              },
              {
                title: "登録から2年間は免税事業者に戻れない",
                desc: "仕事を続けながらインボイスだけやめる場合の話。お仕事自体を辞める（廃業する）時は、2年経ってなくても自動的に効力を失います。",
              },
              {
                title: "本名または屋号が公表される",
                desc: "屋号登録で検索されにくくできるが、完全非公開は不可。",
              },
            ].map((d, i) => (
              <div
                key={i}
                className="rounded-xl p-3"
                style={{
                  backgroundColor: T.cardAlt,
                  border: `1px solid ${T.border}`,
                }}
              >
                <p
                  className="text-[12px] font-semibold mb-0.5"
                  style={{ color: T.text }}
                >
                  ⚠️ {d.title}
                </p>
                <p
                  className="text-[10.5px] leading-relaxed"
                  style={{ color: T.textSub }}
                >
                  {d.desc}
                </p>
              </div>
            ))}
          </div>
          <div
            className="mt-3 rounded-xl p-3 text-center"
            style={{
              backgroundColor: PINK + "10",
              border: `1px solid ${PINK}33`,
            }}
          >
            <p
              className="text-[11px] font-bold leading-relaxed"
              style={{ color: PINK_DARK }}
            >
              でも2026年9月までの2割特例期間中なら、
              <br />
              デメリットより<strong>メリットの方が圧倒的に大きい</strong>と言えます ✨
            </p>
          </div>
        </section>

        {/* ─── FAQ ─── */}
        <section
          className="rounded-2xl p-4 border"
          style={{ backgroundColor: T.card, borderColor: T.border }}
        >
          <h2 className="text-[14px] font-semibold mb-3">💬 よくある質問</h2>
          <div className="space-y-1.5">
            {[
              {
                q: "インボイス登録は必須ですか？",
                a: "法律上は任意です。ただしチョップでは、未登録の場合バック額の10%を『インボイス控除』として差し引いています（お店が仕入税額控除を取れないため）。登録すればこの控除がなくなるので、実質的に登録した方がお得です。",
              },
              {
                q: "旦那さん・家族にバレませんか？",
                a: "本名または屋号が国税庁サイトで公表されますが、普通の人は国税庁サイトで人名検索をしません。気になる場合は『屋号』で登録すれば、本名での検索性が大幅に下がります。",
              },
              {
                q: "登録すると確定申告が大変になりますか？",
                a: "確定申告書に消費税の申告書が1枚追加されるだけです。2割特例なら『売上×1.8%』を計算するだけ。freee・マネーフォワード・弥生などの会計ソフトなら自動計算されます。",
              },
              {
                q: "2026年9月を過ぎても登録する価値はありますか？",
                a: "あります。2027〜2028年は3割特例（売上の2.7%）、2029年〜は簡易課税（売上の4.5%）。それでも10%控除より有利なので、登録した方がお得です。",
              },
              {
                q: "扶養に入っていても登録できますか？",
                a: "登録は可能です。ただし、課税売上高が1,000万円を超えると扶養から外れる基準に関係するので、配偶者控除・扶養の範囲内かは別途チェックが必要です。[page:/mypage/spouse-guide:配偶者控除ガイド]をご参照ください。",
              },
              {
                q: "登録番号はいつ取れますか？",
                a: "e-Taxでの申請なら通常1〜2週間で登録完了のお知らせが届きます（電子通知）。繁忙期（2〜3月）は長めにかかる場合があります。",
              },
              {
                q: "登録番号はどこに連絡すればいい？",
                a: "店長または事務担当へ直接お伝えください。T-MANAGE側でセラピストさんの情報を更新し、翌月の清算から自動でインボイス控除が外れます。",
              },
              {
                q: "将来的に引退する予定ですが、登録しても大丈夫？",
                a: "大丈夫です。「2年縛り」とは『事業を続けながらインボイスだけやめる』場合のルール。お仕事を完全に辞める（廃業する）時は、2年経っていなくても登録は自動的に効力を失います。つまり『2年間無駄に税金を払い続ける』ことはありません。",
              },
              {
                q: "お仕事を辞める時の手続きは？",
                a: "3ステップで完了です。①e-Taxで『廃業届』を提出、②e-Taxで『インボイス登録の取消届』を提出、③辞めた年の分を翌年3月に確定申告。すべてスマホ・e-Taxで完結するので書類が自宅に届くこともありません。",
              },
              {
                q: "廃業届を出さないとどうなる？",
                a: "税務署から「確定申告の催促」が自宅に届く可能性があります。また、新しく別の扶養に入る際に健保組合から『廃業届の控え』を求められることが多いので、辞めた時は必ず提出しましょう。",
              },
              {
                q: "青色申告と組み合わせるとさらにお得？",
                a: "はい！青色申告65万円控除は所得税、インボイス2割特例は消費税なので、別枠で両方使えます。開業届と青色申告承認申請書は同時に提出できます。",
              },
            ].map((f, i) => (
              <div
                key={i}
                className="rounded-xl border overflow-hidden"
                style={{ borderColor: T.border }}
              >
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full text-left px-3 py-2.5 flex items-center gap-2 text-[11.5px] font-medium cursor-pointer"
                  style={{
                    background:
                      openFaq === i ? (dark ? "#3a3a42" : "#fef9f0") : "transparent",
                  }}
                >
                  <span
                    className="text-[9px] px-1.5 py-0.5 rounded flex-shrink-0"
                    style={{ background: GOLD + "22", color: GOLD }}
                  >
                    Q
                  </span>
                  <span style={{ flex: 1, color: T.text }}>{f.q}</span>
                  <span
                    style={{
                      color: T.textMuted,
                      fontSize: 10,
                      transition: "transform 0.2s",
                      transform: openFaq === i ? "rotate(90deg)" : "none",
                    }}
                  >
                    ▶
                  </span>
                </button>
                {openFaq === i && (
                  <div
                    className="px-3 pb-3 pt-1 text-[11px] leading-relaxed flex gap-2"
                    style={{
                      color: T.textSub,
                      borderTop: `1px solid ${T.border}`,
                    }}
                  >
                    <span
                      className="text-[9px] px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5"
                      style={{ background: GREEN + "22", color: GREEN }}
                    >
                      A
                    </span>
                    <span>{f.a}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* ─── チョップで確定申告完結 ─── */}
        <section
          className="rounded-2xl p-4 border"
          style={{
            background: dark
              ? "linear-gradient(135deg, #2a3828, #202a1e)"
              : "linear-gradient(135deg, #e8f5e9, #f0faf1)",
            borderColor: GREEN + "66",
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <span style={{ fontSize: 22 }}>🎉</span>
            <h2 className="text-[15px] font-bold" style={{ color: GREEN }}>
              確定申告、freeeを契約しなくてもチョップで完結！
            </h2>
          </div>

          <div
            className="rounded-xl p-3 mb-3"
            style={{
              backgroundColor: GREEN + "15",
              border: `2px solid ${GREEN}44`,
            }}
          >
            <p className="text-[12px] font-bold mb-1" style={{ color: GREEN }}>
              ⭐ 最大のメリット：報酬が自動で記帳される
            </p>
            <p className="text-[11px] leading-relaxed" style={{ color: T.textSub }}>
              freeeやマネーフォワードでは、<strong style={{ color: RED }}>報酬が入るたびに自分で手入力</strong>しなければなりません。
              忙しい日が続くとどんどん溜まり、確定申告の時期に地獄を見ることに…
            </p>
            <p className="text-[11.5px] leading-relaxed mt-2 font-semibold" style={{ color: GREEN }}>
              チョップなら、お店で清算した瞬間に自動で帳簿に記録されます 🎉
              <br />
              面倒な手入力は一切不要！
            </p>
          </div>

          <p
            className="text-[11px] leading-relaxed mb-3"
            style={{ color: T.textSub }}
          >
            このマイページ内に
            <strong style={{ color: GREEN }}>
              確定申告まで完結できる機能
            </strong>
            が既に搭載されています。
          </p>

          <div
            className="rounded-xl p-3 mb-3"
            style={{
              backgroundColor: T.card,
              border: `1px solid ${T.border}`,
            }}
          >
            <p
              className="text-[11.5px] font-semibold mb-2"
              style={{ color: T.text }}
            >
              📊 マイページの「確定申告サポート」タブでできること
            </p>
            <div className="space-y-1.5 text-[10.5px]" style={{ color: T.textSub }}>
              {[
                { icon: "⭐", label: "報酬が自動で記帳（清算データ連動、手入力ゼロ！）" },
                { icon: "📸", label: "レシート撮影 → AI自動読取で経費も楽々入力" },
                { icon: "📒", label: "仕訳帳が自動生成（複式簿記対応）" },
                { icon: "📊", label: "決算書・損益計算書をワンタップ作成" },
                { icon: "📄", label: "確定申告書データをPDF出力（そのまま書き写せる）" },
                { icon: "💰", label: "所得税・消費税・住民税・ふるさと納税上限を自動計算" },
                { icon: "📋", label: "申告ウィザード（副業/配偶者/青色/インボイスの状況を整理）" },
                { icon: "📥", label: "freee / マネーフォワード / 収支内訳書のCSV出力も可" },
              ].map((f, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span style={{ fontSize: 12 }}>{f.icon}</span>
                  <span>{f.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div
            className="rounded-xl p-3 mb-3"
            style={{
              backgroundColor: GREEN + "10",
              border: `1px dashed ${GREEN}44`,
            }}
          >
            <p className="text-[10.5px] leading-relaxed" style={{ color: T.textSub }}>
              💡 <strong style={{ color: GREEN }}>freee / マネーフォワードとの比較</strong>
              <br />
              <span style={{ color: RED }}>✗ freee等：</span>報酬を<strong>毎回手入力</strong> ＋ 年間 <strong>12,000〜35,000円</strong>
              <br />
              <span style={{ color: GREEN }}>✓ チョップ：</span>報酬は<strong>自動記帳</strong>、経費もAI読取 ＋ <strong style={{ color: GREEN }}>完全無料</strong> ✨
            </p>
          </div>

          <Link
            href="/mypage?tab=tax"
            className="block text-center py-3 rounded-xl text-[12px] font-bold"
            style={{
              background: `linear-gradient(135deg, ${GREEN}, #3a6b4a)`,
              color: "#fff",
            }}
          >
            📊 確定申告サポートを開く →
          </Link>
          <p
            className="text-[9.5px] mt-2 text-center leading-relaxed"
            style={{ color: T.textMuted }}
          >
            ※ マイページ下部のタブ「📊 税務」からもアクセスできます
          </p>
        </section>

        {/* ─── 関連リンク ─── */}
        <section
          className="rounded-2xl p-4 border"
          style={{ backgroundColor: T.cardAlt, borderColor: T.border }}
        >
          <h2 className="text-[13px] font-semibold mb-3">🔗 関連ガイド</h2>
          <div className="space-y-2">
            <Link
              href="/mypage/tax-guide"
              className="flex items-center gap-3 p-3 rounded-xl cursor-pointer"
              style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}
            >
              <span style={{ fontSize: 20 }}>🔒</span>
              <div style={{ flex: 1 }}>
                <p
                  className="text-[12px] font-semibold"
                  style={{ color: PINK_DARK }}
                >
                  副業がバレない 完全ガイド
                </p>
                <p className="text-[10px]" style={{ color: T.textSub }}>
                  住民税の普通徴収・確定申告の実務
                </p>
              </div>
              <span style={{ color: T.textMuted, fontSize: 14 }}>→</span>
            </Link>
            <Link
              href="/mypage/spouse-guide"
              className="flex items-center gap-3 p-3 rounded-xl cursor-pointer"
              style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}
            >
              <span style={{ fontSize: 20 }}>💑</span>
              <div style={{ flex: 1 }}>
                <p
                  className="text-[12px] font-semibold"
                  style={{ color: "#8b6cb7" }}
                >
                  配偶者控除・扶養 完全ガイド
                </p>
                <p className="text-[10px]" style={{ color: T.textSub }}>
                  旦那さんの扶養内で働く方のための解説
                </p>
              </div>
              <span style={{ color: T.textMuted, fontSize: 14 }}>→</span>
            </Link>
          </div>
        </section>

        {/* ─── フッター ─── */}
        <section
          className="rounded-2xl p-4 border text-center"
          style={{
            background: dark
              ? "linear-gradient(135deg, #3a3328, #2a2520)"
              : "linear-gradient(135deg, #faf4e8, #fff9f0)",
            borderColor: GOLD + "44",
          }}
        >
          <p
            className="text-[11px] mb-2"
            style={{ color: GOLD, fontWeight: 700 }}
          >
            🌸 あなたの頑張りをチョップは応援しています
          </p>
          <p
            className="text-[11px] leading-relaxed"
            style={{ color: T.textSub }}
          >
            手続きで分からないことがあれば、店長または事務担当まで気軽にご相談ください。
            <br />
            税理士さんのご紹介も可能です。
          </p>
          <Link
            href="/mypage"
            className="inline-block mt-3 text-[11px] px-4 py-2 rounded-full cursor-pointer"
            style={{
              background: `linear-gradient(135deg, ${GOLD}, #b09672)`,
              color: "#fff",
              fontWeight: 600,
            }}
          >
            マイページに戻る
          </Link>
        </section>

        <p
          className="text-[9px] text-center"
          style={{ color: T.textFaint }}
        >
          ※ 本ガイドは2026年（令和8年）4月時点の一般的な情報です。
          <br />
          個別判断は税理士または税務署へご確認ください。
          <br />
          最終更新: 2026年4月
        </p>
      </main>
    </div>
  );
}
