"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";
import GuidePageHero, { GuideSectionHeading, GUIDE_T as T, GUIDE_FONT_SERIF as FONT_SERIF, GUIDE_FONT_DISPLAY as FONT_DISPLAY, GUIDE_FONT_SANS as FONT_SANS } from "../../../components/mypage/GuidePageHero";

/* ───────── 型 ───────── */
type TherapistLite = { id: number; name: string; address?: string | null };

/* ───────── アクセント色（HP準拠） ───────── */
const PINK = T.accent;
const PINK_DARK = T.accentDeep;
const PINK_BG = T.accentBg;
const GREEN = "#6b9b7e";
const BLUE = "#6b8ba8";
const AMBER = "#b38419";
const RED = "#c96b83";
const PURPLE = "#8b6cb7";

type HubanType = "shakai" | "kokuho" | "unknown" | null;

export default function SpouseGuidePage() {
  const [therapist, setTherapist] = useState<TherapistLite | null>(null);
  const [hubanType, setHubanType] = useState<HubanType>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [annualIncome, setAnnualIncome] = useState<string>("");
  const [expenses, setExpenses] = useState<string>("");

  /* セラピスト情報 */
  useEffect(() => {
    const session = localStorage.getItem("therapist_session");
    if (!session) return;
    try {
      const { id } = JSON.parse(session);
      supabase
        .from("therapists")
        .select("id,name,address")
        .eq("id", id)
        .maybeSingle()
        .then(({ data }) => {
          if (data) setTherapist(data as TherapistLite);
        });
    } catch {
      /* ignore */
    }
  }, []);

  /* 設定の永続化 */
  useEffect(() => {
    const savedType = localStorage.getItem("spouse-guide-huban") as HubanType;
    if (savedType) setHubanType(savedType);
    const savedIncome = localStorage.getItem("spouse-guide-income");
    if (savedIncome) setAnnualIncome(savedIncome);
    const savedExp = localStorage.getItem("spouse-guide-expenses");
    if (savedExp) setExpenses(savedExp);
  }, []);

  const updateHubanType = (t: HubanType) => {
    setHubanType(t);
    if (t) localStorage.setItem("spouse-guide-huban", t);
  };
  const updateIncome = (v: string) => {
    setAnnualIncome(v);
    localStorage.setItem("spouse-guide-income", v);
  };
  const updateExpenses = (v: string) => {
    setExpenses(v);
    localStorage.setItem("spouse-guide-expenses", v);
  };

  /* シミュレーション計算 */
  const income = parseFloat(annualIncome) || 0; // 万円
  const exp = parseFloat(expenses) || 0; // 万円
  const profit = Math.max(0, income - exp); // 事業所得（利益）万円

  /* 判定ロジック（2026年基準） */
  const incomeIn10k = profit; // 万円単位の所得

  // 旦那さんの控除状態
  let spouseControlStatus: {
    label: string;
    amount: string;
    color: string;
    detail: string;
  };
  if (incomeIn10k <= 62) {
    spouseControlStatus = {
      label: "配偶者控除 満額（38万円）",
      amount: "MAX節税",
      color: GREEN,
      detail: "旦那さんの税金が最もお得になる範囲です 🎉",
    };
  } else if (incomeIn10k <= 100) {
    spouseControlStatus = {
      label: "配偶者特別控除 満額（38万円）",
      amount: "税金は同じ",
      color: GREEN,
      detail: "控除額は満額のまま。税金的には62万円以下と同じ扱い ✨",
    };
  } else if (incomeIn10k <= 133) {
    spouseControlStatus = {
      label: "配偶者特別控除 段階的",
      amount: "控除減少",
      color: AMBER,
      detail: "控除額が徐々に減っていきます",
    };
  } else {
    spouseControlStatus = {
      label: "配偶者（特別）控除 なし",
      amount: "対象外",
      color: RED,
      detail: "旦那さんはあなたの分の控除を受けられません",
    };
  }

  // 社会保険の壁判定（売上ベース・厳しめ想定）
  let shakaiStatus: { label: string; color: string; detail: string } | null = null;
  if (hubanType === "shakai") {
    if (income <= 130) {
      shakaiStatus = {
        label: "扶養内の可能性高",
        color: GREEN,
        detail: "ただし旦那さんの健保組合の判定ルールを必ず確認！",
      };
    } else {
      shakaiStatus = {
        label: "⚠️ 扶養から外れる可能性",
        color: RED,
        detail: "国民健康保険＋国民年金で年間30万円前後の負担増",
      };
    }
  }

  return (
    <div style={{ minHeight: "100vh", backgroundColor: T.bg, color: T.text, fontFamily: FONT_SERIF }}>
      <GuidePageHero
        label="SPOUSE GUIDE"
        title="💑 配偶者控除・扶養 完全ガイド"
        subtitle={
          therapist
            ? `${therapist.name} さん／ 旦那さんの扶養に入りながらお仕事する方向け。2026年（令和8年）最新制度に対応。「いくらまで働いていいの？」を解決します。`
            : "旦那さんの扶養に入りながらお仕事する方向け。2026年（令和8年）最新制度に対応。「いくらまで働いていいの？」を解決します。"
        }
        marble="warm"
      />

      <main style={{ maxWidth: 720, margin: "0 auto", padding: "32px 16px 80px", display: "flex", flexDirection: "column", gap: 20 }}>

        {/* ─── 2026年の重要変更 ─── */}
        <section
          className="rounded-2xl p-4 border"
          style={{
            backgroundColor: BLUE + "10",
            borderColor: BLUE + "44",
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <span style={{ fontSize: 18 }}>🆕</span>
            <h2 className="text-[13px] font-bold" style={{ color: BLUE }}>
              2026年の大きな変更点
            </h2>
          </div>
          <div className="space-y-1.5 text-[11px] leading-relaxed" style={{ color: T.textSub }}>
            <p>
              ✅ 所得税の非課税ラインが<strong>178万円</strong>に引き上げ
            </p>
            <p>
              ✅ 配偶者控除の上限が<strong>123万円→136万円</strong>に拡大
            </p>
            <p>
              ✅ 配偶者特別控除 満額（38万円）の上限が<strong>150万円→160万円</strong>に
            </p>
            <p>
              ✅ 基礎控除が従来48万円→<strong>最大104万円</strong>に
            </p>
            <p>
              ✅ 2026年4月〜 社会保険130万円判定が<strong>労働契約ベース</strong>に緩和
            </p>
            <p>
              ⚠️ ただし社会保険の<strong>130万円の壁</strong>自体は引き続き存在
            </p>
          </div>
        </section>

        {/* ─── 結論サマリ ─── */}
        <section
          className="rounded-2xl p-4 border"
          style={{ backgroundColor: T.card, borderColor: T.border }}
        >
          <h2 className="text-[14px] font-semibold mb-3">📌 結論（業務委託の場合）</h2>
          <div className="space-y-2">
            {[
              {
                num: "税金",
                title: "事業所得 62万円以下なら旦那さんの節税MAX",
                desc: "売上 − 経費 = 62万円以下 なら、旦那さんが配偶者控除 満額38万円を受けられる。",
                color: GREEN,
              },
              {
                num: "税金",
                title: "事業所得 133万円以下までは段階的に控除あり",
                desc: "100万円までは満額、そこから段階的に減少していく。",
                color: AMBER,
              },
              {
                num: "社保",
                title: "売上130万円が「大きな壁」",
                desc: "旦那さんが会社員（社保加入）の場合、売上（経費を引く前）で判定されることが多い。要確認。",
                color: RED,
              },
              {
                num: "社保",
                title: "旦那さんが自営業（国保）なら130万円の壁なし",
                desc: "そもそも扶養の概念がないので、稼いだ分だけ少しずつ保険料が上がるだけ。",
                color: BLUE,
              },
            ].map((p, i) => (
              <div
                key={i}
                className="rounded-xl p-3 flex gap-3"
                style={{ backgroundColor: T.cardAlt }}
              >
                <div
                  className="rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{
                    width: 42,
                    height: 42,
                    backgroundColor: p.color + "22",
                    color: p.color,
                    fontWeight: 700,
                    fontSize: 10,
                  }}
                >
                  {p.num}
                </div>
                <div style={{ flex: 1 }}>
                  <p
                    className="text-[12.5px] font-semibold mb-0.5"
                    style={{ color: p.color }}
                  >
                    {p.title}
                  </p>
                  <p className="text-[10.5px] leading-relaxed" style={{ color: T.textSub }}>
                    {p.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ─── 旦那さんの保険タイプを選ぶ ─── */}
        <section
          className="rounded-2xl p-4 border"
          style={{ backgroundColor: T.card, borderColor: T.border }}
        >
          <h2 className="text-[14px] font-semibold mb-1">
            🩺 まず確認：旦那さんの保険の種類
          </h2>
          <p className="text-[10.5px] mb-3" style={{ color: T.textMuted }}>
            保険証を見ると分かります。これで対策がガラッと変わります。
          </p>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <button
              onClick={() => updateHubanType("shakai")}
              className="rounded-xl p-3 cursor-pointer text-left"
              style={{
                backgroundColor: hubanType === "shakai" ? BLUE + "18" : T.cardAlt,
                border: `1.5px solid ${
                  hubanType === "shakai" ? BLUE : T.border
                }`,
              }}
            >
              <p className="text-[12px] font-semibold mb-1" style={{ color: BLUE }}>
                💼 社会保険
              </p>
              <p className="text-[9.5px] leading-relaxed" style={{ color: T.textSub }}>
                保険証に「〇〇健康保険組合」または「全国健康保険協会（協会けんぽ）」
              </p>
            </button>
            <button
              onClick={() => updateHubanType("kokuho")}
              className="rounded-xl p-3 cursor-pointer text-left"
              style={{
                backgroundColor: hubanType === "kokuho" ? GREEN + "18" : T.cardAlt,
                border: `1.5px solid ${
                  hubanType === "kokuho" ? GREEN : T.border
                }`,
              }}
            >
              <p
                className="text-[12px] font-semibold mb-1"
                style={{ color: GREEN }}
              >
                🏠 国民健康保険
              </p>
              <p className="text-[9.5px] leading-relaxed" style={{ color: T.textSub }}>
                保険証に「国民健康保険」と書かれている（自営業・フリーランスの旦那さんなど）
              </p>
            </button>
          </div>
          <button
            onClick={() => updateHubanType("unknown")}
            className="w-full rounded-xl p-2 cursor-pointer text-[10.5px]"
            style={{
              backgroundColor: hubanType === "unknown" ? T.cardAlt : "transparent",
              border: `1px dashed ${T.border}`,
              color: T.textMuted,
            }}
          >
            🤔 よく分からない・まだ確認していない
          </button>

          {hubanType === "shakai" && (
            <div
              className="mt-3 rounded-xl p-3"
              style={{ backgroundColor: BLUE + "0d", border: `1px solid ${BLUE}33` }}
            >
              <p className="text-[11px] font-semibold mb-1" style={{ color: BLUE }}>
                💡 社会保険の場合の重要ポイント
              </p>
              <p className="text-[10.5px] leading-relaxed" style={{ color: T.textSub }}>
                <strong>年1回の「検認（けんにん）」</strong>
                があります。あなたの課税証明書を提出し、収入基準を超えていると扶養から外されます。保険証の名称で
                <a
                  href={`https://www.google.com/search?q=${encodeURIComponent(
                    "扶養認定 自営業 収入 協会けんぽ"
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: BLUE, textDecoration: "underline", marginLeft: 4 }}
                >
                  ネット検索
                </a>
                して、「自営業者の収入定義」をチェックしてみてください。
              </p>
            </div>
          )}

          {hubanType === "kokuho" && (
            <div
              className="mt-3 rounded-xl p-3"
              style={{ backgroundColor: GREEN + "0d", border: `1px solid ${GREEN}33` }}
            >
              <p className="text-[11px] font-semibold mb-1" style={{ color: GREEN }}>
                ✨ 国民健康保険なら気楽
              </p>
              <p className="text-[10.5px] leading-relaxed" style={{ color: T.textSub }}>
                国保には<strong>「扶養」の概念がありません</strong>
                。130万円の壁を気にする必要なし！ただし世帯全員の所得で保険料が決まるので、稼いだ分だけ翌年の保険料は上がります。
                <br />
                ➜ 対策は「<strong>青色申告65万円控除</strong>＋<strong>経費の徹底計上</strong>」で所得を抑えるのが効果的。
              </p>
            </div>
          )}
        </section>

        {/* ─── シミュレーター ─── */}
        <section
          className="rounded-2xl p-4 border"
          style={{ backgroundColor: T.card, borderColor: T.border }}
        >
          <h2 className="text-[14px] font-semibold mb-1">🧮 あなたの状況をシミュレート</h2>
          <p className="text-[10.5px] mb-3" style={{ color: T.textMuted }}>
            入力するとリアルタイムで判定されます（この端末に保存）
          </p>
          <div className="space-y-2.5 mb-3">
            <div>
              <label
                className="text-[10px] block mb-1"
                style={{ color: T.textSub }}
              >
                年間の売上（報酬の合計）
              </label>
              <div className="relative">
                <input
                  type="number"
                  inputMode="decimal"
                  value={annualIncome}
                  onChange={(e) => updateIncome(e.target.value)}
                  placeholder="例：120"
                  className="w-full px-3 py-2.5 pr-10 rounded-xl text-[13px] outline-none border"
                  style={{
                    backgroundColor: T.cardAlt,
                    borderColor: T.border,
                    color: T.text,
                  }}
                />
                <span
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px]"
                  style={{ color: T.textMuted }}
                >
                  万円
                </span>
              </div>
            </div>
            <div>
              <label
                className="text-[10px] block mb-1"
                style={{ color: T.textSub }}
              >
                年間の経費（衣装・交通費・消耗品など）
              </label>
              <div className="relative">
                <input
                  type="number"
                  inputMode="decimal"
                  value={expenses}
                  onChange={(e) => updateExpenses(e.target.value)}
                  placeholder="例：20"
                  className="w-full px-3 py-2.5 pr-10 rounded-xl text-[13px] outline-none border"
                  style={{
                    backgroundColor: T.cardAlt,
                    borderColor: T.border,
                    color: T.text,
                  }}
                />
                <span
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px]"
                  style={{ color: T.textMuted }}
                >
                  万円
                </span>
              </div>
            </div>
          </div>

          {(income > 0 || exp > 0) && (
            <>
              <div
                className="rounded-xl p-3 mb-2"
                style={{
                  backgroundColor: PURPLE + "10",
                  border: `1px solid ${PURPLE}33`,
                }}
              >
                <div className="flex items-center justify-between">
                  <p className="text-[11px]" style={{ color: T.textSub }}>
                    事業所得（利益）
                  </p>
                  <p
                    className="text-[18px] font-bold"
                    style={{ color: PURPLE }}
                  >
                    {profit.toFixed(0)} 万円
                  </p>
                </div>
                <p className="text-[9.5px] mt-1" style={{ color: T.textMuted }}>
                  売上 {income.toFixed(0)}万 − 経費 {exp.toFixed(0)}万
                </p>
              </div>

              {/* 税金判定 */}
              <div
                className="rounded-xl p-3 mb-2"
                style={{
                  backgroundColor: spouseControlStatus.color + "10",
                  border: `1px solid ${spouseControlStatus.color}33`,
                }}
              >
                <p className="text-[10px] mb-1" style={{ color: T.textMuted }}>
                  🏛️ 税金（配偶者控除）判定
                </p>
                <p
                  className="text-[13px] font-bold"
                  style={{ color: spouseControlStatus.color }}
                >
                  {spouseControlStatus.label}
                </p>
                <p className="text-[10.5px] mt-1" style={{ color: T.textSub }}>
                  {spouseControlStatus.detail}
                </p>
              </div>

              {/* 社保判定 */}
              {shakaiStatus && (
                <div
                  className="rounded-xl p-3"
                  style={{
                    backgroundColor: shakaiStatus.color + "10",
                    border: `1px solid ${shakaiStatus.color}33`,
                  }}
                >
                  <p className="text-[10px] mb-1" style={{ color: T.textMuted }}>
                    🩺 社会保険判定（売上基準での目安）
                  </p>
                  <p
                    className="text-[13px] font-bold"
                    style={{ color: shakaiStatus.color }}
                  >
                    {shakaiStatus.label}
                  </p>
                  <p className="text-[10.5px] mt-1" style={{ color: T.textSub }}>
                    {shakaiStatus.detail}
                  </p>
                </div>
              )}

              {hubanType === "kokuho" && (
                <div
                  className="rounded-xl p-3"
                  style={{
                    backgroundColor: GREEN + "10",
                    border: `1px solid ${GREEN}33`,
                  }}
                >
                  <p className="text-[10px] mb-1" style={{ color: T.textMuted }}>
                    🩺 社会保険判定
                  </p>
                  <p className="text-[13px] font-bold" style={{ color: GREEN }}>
                    ✨ 130万円の壁なし
                  </p>
                  <p className="text-[10.5px] mt-1" style={{ color: T.textSub }}>
                    旦那さんが国保なので扶養という制度がありません。稼いだ分だけ翌年の保険料が緩やかに上がるイメージ。
                  </p>
                </div>
              )}
            </>
          )}
        </section>

        {/* ─── 4つの壁の全体図 ─── */}
        <section
          className="rounded-2xl p-4 border"
          style={{ backgroundColor: T.card, borderColor: T.border }}
        >
          <h2 className="text-[14px] font-semibold mb-3">
            📊 2026年版「壁」の全体図（業務委託の場合）
          </h2>
          <div className="space-y-2">
            {[
              {
                amount: "62万円",
                label: "配偶者控除 満額ライン",
                desc: "事業所得がここ以下なら旦那さんの節税MAX（38万円控除）",
                color: GREEN,
                icon: "✨",
                category: "税金",
              },
              {
                amount: "100万円",
                label: "配偶者特別控除 満額ライン",
                desc: "ここまでは控除額38万円のまま維持される（2026年〜）",
                color: GREEN,
                icon: "🎁",
                category: "税金",
              },
              {
                amount: "売上130万円",
                label: "⚠️ 社会保険の壁",
                desc: "旦那さんの健保によっては扶養から外れる。事業所得でなく「売上」で見られる組合が多い",
                color: RED,
                icon: "🚨",
                category: "社保",
              },
              {
                amount: "133万円",
                label: "配偶者特別控除 終了",
                desc: "ここを超えると旦那さんの控除がゼロに",
                color: AMBER,
                icon: "📉",
                category: "税金",
              },
              {
                amount: "利益104万円",
                label: "あなた自身の所得税発生ライン",
                desc: "基礎控除104万円（令和8・9年特例）を超えるとあなたにも所得税が",
                color: BLUE,
                icon: "💰",
                category: "税金",
              },
            ].map((w, i) => (
              <div
                key={i}
                className="rounded-xl p-3 flex gap-3 items-center"
                style={{
                  backgroundColor: w.color + "0d",
                  border: `1px solid ${w.color}33`,
                }}
              >
                <div
                  className="flex-shrink-0 text-center"
                  style={{ minWidth: 88 }}
                >
                  <p style={{ fontSize: 18 }}>{w.icon}</p>
                  <p
                    className="text-[11.5px] font-bold"
                    style={{ color: w.color, lineHeight: 1.2 }}
                  >
                    {w.amount}
                  </p>
                  <p
                    className="text-[8.5px] px-1.5 py-0.5 rounded-full inline-block mt-0.5"
                    style={{ backgroundColor: w.color + "22", color: w.color }}
                  >
                    {w.category}
                  </p>
                </div>
                <div style={{ flex: 1 }}>
                  <p
                    className="text-[11.5px] font-semibold"
                    style={{ color: w.color }}
                  >
                    {w.label}
                  </p>
                  <p
                    className="text-[10px] mt-0.5 leading-relaxed"
                    style={{ color: T.textSub }}
                  >
                    {w.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ─── 経費にできるもの ─── */}
        <section
          className="rounded-2xl p-4 border"
          style={{ backgroundColor: T.card, borderColor: T.border }}
        >
          <h2 className="text-[14px] font-semibold mb-1">🧾 セラピストが経費にできるもの</h2>
          <p className="text-[10.5px] mb-3" style={{ color: T.textMuted }}>
            これをちゃんと管理すれば、利益を抑えて扶養内にできます
          </p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { icon: "👗", label: "衣装・下着", desc: "仕事用ワンピース、ストッキング等" },
              { icon: "💄", label: "美容代", desc: "ヘアセット、ネイル（仕事に直結するもの）" },
              { icon: "🛢️", label: "オイル・備品", desc: "マッサージオイル、タオル、シーツ等" },
              { icon: "🧴", label: "洗濯・消耗品", desc: "洗剤、除菌グッズ、消臭剤、ボディソープ" },
              { icon: "🚗", label: "交通費", desc: "お店までの往復、駐車場代" },
              { icon: "📱", label: "通信費", desc: "仕事で使うスマホ代の割合分" },
              { icon: "📚", label: "講習費", desc: "技術向上のための受講料" },
              { icon: "📸", label: "宣伝・広告", desc: "プロフィール写真、名刺印刷" },
            ].map((e, i) => (
              <div
                key={i}
                className="rounded-xl p-2.5"
                style={{ backgroundColor: T.cardAlt }}
              >
                <p style={{ fontSize: 18, lineHeight: 1 }}>{e.icon}</p>
                <p className="text-[11px] font-semibold mt-1" style={{ color: T.text }}>
                  {e.label}
                </p>
                <p className="text-[9.5px] mt-0.5" style={{ color: T.textMuted }}>
                  {e.desc}
                </p>
              </div>
            ))}
          </div>
          <div
            className="mt-3 rounded-xl p-3"
            style={{ backgroundColor: AMBER + "0d", border: `1px solid ${AMBER}33` }}
          >
            <p className="text-[10.5px] leading-relaxed" style={{ color: T.textSub }}>
              💡 <strong style={{ color: AMBER }}>領収書は必ず保管！</strong>
              <br />
              レシートに日付・店名が印字されていればOK。7年間の保管義務があります。スマホで撮影＋クラウド保存がおすすめ。
            </p>
          </div>
        </section>

        {/* ─── 青色申告の威力 ─── */}
        <section
          className="rounded-2xl p-4 border"
          style={{
            backgroundColor: PINK + "08",
            borderColor: PINK + "33",
          }}
        >
          <h2 className="text-[14px] font-semibold mb-2" style={{ color: PINK_DARK }}>
            🌟 節税の最強武器「青色申告」
          </h2>
          <p className="text-[11px] leading-relaxed mb-3" style={{ color: T.textSub }}>
            <strong>最大65万円の控除</strong>
            が追加で受けられます。基礎控除とは別枠なので、合計で<strong style={{ color: PINK_DARK }}>169万円分</strong>の控除が！
          </p>

          <div
            className="rounded-xl p-3 mb-3"
            style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}
          >
            <p className="text-[11px] font-semibold mb-2" style={{ color: T.text }}>
              📝 青色申告にするには（今年〜来年向け）
            </p>
            <ol
              className="text-[10.5px] space-y-1 pl-4"
              style={{ color: T.textSub, listStyle: "decimal" }}
            >
              <li>
                <strong>開業届</strong>を税務署へ提出（e-Taxで可能）
              </li>
              <li>
                <strong>青色申告承認申請書</strong>を一緒に提出
              </li>
              <li>
                <strong>
                  申告する年の3月15日まで
                </strong>
                に提出すれば、その年から青色OK
              </li>
              <li>
                会計ソフト（freee/マネーフォワード/弥生）で記帳
              </li>
              <li>e-Taxで確定申告 → 65万円控除達成 🎉</li>
            </ol>
          </div>

          <div
            className="rounded-xl p-3"
            style={{ backgroundColor: GREEN + "0d", border: `1px solid ${GREEN}33` }}
          >
            <p className="text-[11px] font-semibold mb-1" style={{ color: GREEN }}>
              💰 具体例：売上150万・経費20万の場合
            </p>
            <div className="text-[10.5px] space-y-1" style={{ color: T.textSub }}>
              <p>事業所得：150万 − 20万 = <strong>130万円</strong></p>
              <p>青色申告控除：<strong>−65万円</strong></p>
              <p>➜ 見かけ上の所得：<strong style={{ color: GREEN }}>65万円</strong></p>
              <p
                className="mt-1 pt-1"
                style={{ borderTop: `1px dashed ${T.border}` }}
              >
                → 配偶者特別控除の満額範囲内に収まる！
              </p>
            </div>
          </div>
        </section>

        {/* ─── 旦那さんにバレないための注意 ─── */}
        <section
          className="rounded-2xl p-4 border"
          style={{ backgroundColor: T.card, borderColor: T.border }}
        >
          <h2 className="text-[14px] font-semibold mb-1">
            🔒 旦那さんに「職種」をバレないために
          </h2>
          <p className="text-[10.5px] mb-3" style={{ color: T.textMuted }}>
            課税証明書は配偶者にも請求できる書類です
          </p>

          <div
            className="rounded-xl p-3 mb-2"
            style={{ backgroundColor: GREEN + "10", border: `1px solid ${GREEN}33` }}
          >
            <p className="text-[11px] font-semibold mb-1" style={{ color: GREEN }}>
              ✅ 課税証明書に載らない情報
            </p>
            <div className="text-[10.5px] space-y-0.5" style={{ color: T.textSub }}>
              <p>・お店の名前（「チョップ」と書かれない）</p>
              <p>・職種（「メンズエステ」とは書かれない）</p>
              <p>・取引先の情報</p>
              <p>・誰から報酬を受け取ったか</p>
            </div>
          </div>

          <div
            className="rounded-xl p-3"
            style={{ backgroundColor: AMBER + "10", border: `1px solid ${AMBER}33` }}
          >
            <p className="text-[11px] font-semibold mb-1" style={{ color: AMBER }}>
              ⚠️ 課税証明書に載る情報
            </p>
            <div className="text-[10.5px] space-y-0.5" style={{ color: T.textSub }}>
              <p>・所得の種類（「事業所得」または「雑所得」）</p>
              <p>・所得の金額（売上 − 経費の数字）</p>
            </div>
            <p
              className="text-[10px] mt-2 pt-2 leading-relaxed"
              style={{ color: T.textSub, borderTop: `1px dashed ${T.border}` }}
            >
              💬 もし聞かれたら「ネット販売・ハンドメイド」「Webライター」「ポイ活・モニター」など、事業所得／雑所得として成立する業種で説明する方が多いです。
            </p>
          </div>
        </section>

        {/* ─── やることチェックリスト ─── */}
        <section
          className="rounded-2xl p-4 border"
          style={{ backgroundColor: T.card, borderColor: T.border }}
        >
          <h2 className="text-[14px] font-semibold mb-3">
            ✅ 今すぐ確認・実行することリスト
          </h2>
          <div className="space-y-2">
            {[
              {
                step: "1",
                title: "旦那さんの保険証を見る",
                desc: "「組合健保 / 協会けんぽ / 国保」のどれか確認",
              },
              {
                step: "2",
                title: "組合名で「扶養認定 自営業」を検索",
                desc: "売上基準か所得基準か調べる（社保の場合）",
              },
              {
                step: "3",
                title: "領収書の保管を始める",
                desc: "スマホで撮影＋クラウド保存が楽",
              },
              {
                step: "4",
                title: "今年の売上見込みを把握する",
                desc: "T-MANAGEの給料画面で月別の合計が見られる",
              },
              {
                step: "5",
                title: "開業届＋青色申告承認申請書を提出",
                desc: "e-Taxで完結可能。3月15日までに出せば当年から65万円控除",
              },
              {
                step: "6",
                title: "確定申告は e-Tax で",
                desc: "紙提出より書類が自宅に届きにくく、控除も有利",
              },
              {
                step: "7",
                title: "住民税は「自分で納付」にチェック",
                desc: "同じく副業バレ対策として重要",
              },
            ].map((c, i) => (
              <div
                key={i}
                className="rounded-xl p-3 flex gap-3"
                style={{ backgroundColor: T.cardAlt }}
              >
                <div
                  className="rounded-full flex items-center justify-center flex-shrink-0"
                  style={{
                    width: 28,
                    height: 28,
                    backgroundColor: PURPLE,
                    color: "#fff",
                    fontWeight: 700,
                    fontSize: 12,
                  }}
                >
                  {c.step}
                </div>
                <div style={{ flex: 1 }}>
                  <p
                    className="text-[12px] font-semibold"
                    style={{ color: T.text }}
                  >
                    {c.title}
                  </p>
                  <p
                    className="text-[10.5px] leading-relaxed mt-0.5"
                    style={{ color: T.textSub }}
                  >
                    {c.desc}
                  </p>
                </div>
              </div>
            ))}
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
                q: "108万円（売上）でも経費20万・青色65万なら扶養内になる？",
                a: "はい！売上108万−経費20万−青色65万=23万円となり、配偶者控除の満額範囲（62万円以下）に収まります。ただし社保の130万円の壁は売上ベースで見られるので、旦那さんの健保組合の判定方法を確認してください。",
              },
              {
                q: "開業届を出すと旦那さんにバレる？",
                a: "e-Tax（電子申請）で出せば自宅に書類は届きません。また開業届の情報は基本的に税務署内にとどまり、旦那さんへ通知されることはありません。",
              },
              {
                q: "インボイス登録は必要？本名バレしない？",
                a: "チョップではインボイス登録を推奨しています。未登録だとバック額の10%が控除されますが、登録すればこの控除がなくなり手取りが増えます。本名公開が気になる場合は『屋号』で登録できます。詳しくは[page:/mypage/invoice-guide:インボイス登録ガイド]をご覧ください。",
              },
              {
                q: "健保組合の検認（けんにん）を回避できる？",
                a: "制度上、完全な回避は不可能です。ただし「経費をしっかり計上」「青色申告65万円控除」で書類上の所得を小さく見せることは合法的に可能です。所得の『金額』は出ますが『業種・お店名』は課税証明書に載りません。",
              },
              {
                q: "確定申告せず放置したらバレる？",
                a: "危険です。マイナンバー連携で数年後に遡って発覚し、延滞税・加算税＋遡及の社会保険料（数十万円）を請求される事例があります。必ず申告を。",
              },
              {
                q: "住民税の納付書が自宅に届いて、旦那さんに見られないか不安",
                a: "『住民税を自分で納付（普通徴収）』にチェックすれば届きますが、金額を小さくするには経費と青色申告が効果的。家族への送付先変更を市役所に相談することも可能です。（詳しくは[副業バレない完全ガイド]を参照）",
              },
              {
                q: "事業所得と雑所得の違いは？",
                a: "継続的・反復的に行う仕事は『事業所得』、たまたま得た収入は『雑所得』。セラピストで継続的に収入を得ているなら『事業所得』として申告するのが通常で、青色申告65万円控除も使えます。",
              },
              {
                q: "2026年に178万円の壁になったけど、業務委託は関係ある？",
                a: "178万円の壁は『給与所得者（アルバイト・パート）』の所得税非課税ラインです。業務委託（事業所得）の場合は、基礎控除95万円〜104万円がボーダー。ただし青色申告65万円控除と併用できるので、実質的に使える控除枠は広くなっています。",
              },
              {
                q: "旦那さんが自営業（国保）だけど、それでも確定申告する意味ある？",
                a: "大いにあります！国保では世帯合算で保険料が決まるので、あなたの所得を『青色申告＋経費計上』で抑えれば、翌年の国民健康保険料がかなり下がります。また配偶者控除は所得税の制度なので旦那さんが自営業でも関係なく受けられます。",
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
                    background: openFaq === i ? ("#fef9f0") : "transparent",
                  }}
                >
                  <span
                    className="text-[9px] px-1.5 py-0.5 rounded flex-shrink-0"
                    style={{ background: PURPLE + "22", color: PURPLE }}
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

        {/* ─── 関連リンク ─── */}
        <section
          className="rounded-2xl p-4 border"
          style={{ backgroundColor: T.cardAlt, borderColor: T.border }}
        >
          <h2 className="text-[13px] font-semibold mb-3">🔗 関連ガイド</h2>
          <div className="space-y-2">
            <Link
              href="/cast/tax-guide"
              className="flex items-center gap-3 p-3 rounded-xl cursor-pointer"
              style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}
            >
              <span style={{ fontSize: 20 }}>🔒</span>
              <div style={{ flex: 1 }}>
                <p className="text-[12px] font-semibold" style={{ color: PINK_DARK }}>
                  副業がバレない 完全ガイド
                </p>
                <p className="text-[10px]" style={{ color: T.textSub }}>
                  住民税の普通徴収手続き、e-Taxでの申告方法など
                </p>
              </div>
              <span style={{ color: T.textMuted, fontSize: 14 }}>→</span>
            </Link>
            <Link
              href="/cast/invoice-guide"
              className="flex items-center gap-3 p-3 rounded-xl cursor-pointer"
              style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}
            >
              <span style={{ fontSize: 20 }}>💎</span>
              <div style={{ flex: 1 }}>
                <p className="text-[12px] font-semibold" style={{ color: "#c3a782" }}>
                  インボイス登録ガイド
                </p>
                <p className="text-[10px]" style={{ color: T.textSub }}>
                  手取りシミュレーター付き。2割特例で今が登録のチャンス
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
            backgroundColor: PURPLE + "15",
            borderColor: PURPLE + "33",
          }}
        >
          <p
            className="text-[11px] mb-2"
            style={{ color: PURPLE, fontWeight: 600 }}
          >
            💐 がんばっているあなたへ
          </p>
          <p
            className="text-[11px] leading-relaxed"
            style={{ color: T.textSub }}
          >
            制度は複雑でも、一つずつ確認していけば必ず道筋が見えます。
            <br />
            不安なことがあれば、店長や税理士さん、市役所の税務課にも相談してくださいね。
          </p>
          <Link
            href="/cast"
            className="inline-block mt-3 text-[11px] px-4 py-2 rounded-full cursor-pointer"
            style={{
              backgroundColor: PURPLE,
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
          個別の申告内容は税理士または市区町村へご確認ください。
          <br />
          最終更新: 2026年4月
        </p>
      </main>
    </div>
  );
}
