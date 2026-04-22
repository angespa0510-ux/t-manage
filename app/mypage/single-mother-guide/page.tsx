"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";
import GuidePageHero, { GuideSectionHeading, GUIDE_T as T, GUIDE_FONT_SERIF as FONT_SERIF, GUIDE_FONT_DISPLAY as FONT_DISPLAY, GUIDE_FONT_SANS as FONT_SANS } from "../../../components/mypage/GuidePageHero";
import {
  AICHI_CITIES,
  findCityByAddress,
  searchCities,
  type CityTaxInfo,
} from "../../../lib/aichi-cities";

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
const ORANGE = "#c48a4a";
const PURPLE = "#8b6cb7";
const TEAL = "#5a9b94";

/* ───────── シミュレーション型 ───────── */
type SimResult = {
  hitorioyaKojo: number;
  taxSaving: number;
  juminSaving: number;
  totalSaving: number;
  jidouFuyou: number;
  jichiTeat: number;
  ijiTeat: number;
  jidouTeate: number;
  monthlyTotal: number;
};

/* ───────── コンポーネント ───────── */
export default function SingleMotherGuidePage() {
  const [therapist, setTherapist] = useState<TherapistLite | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [openSection, setOpenSection] = useState<number | null>(0);

  /* シミュレーション */
  const [childCount, setChildCount] = useState("1");
  const [annualIncome, setAnnualIncome] = useState("");
  const [expenses, setExpenses] = useState("");
  const [childAges, setChildAges] = useState("small"); // small / elem / mid / high

  /* 市区町村 */
  const [cityManual, setCityManual] = useState<CityTaxInfo | null>(null);
  const [citySearchOpen, setCitySearchOpen] = useState(false);
  const [citySearchKw, setCitySearchKw] = useState("");

  /* チェックリスト */
  const [checked, setChecked] = useState<Record<string, boolean>>({});

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
    } catch { /* ignore */ }
  }, []);

  /* チェックリスト永続化 */
  useEffect(() => {
    const s = localStorage.getItem("single-mother-checklist");
    if (s) try { setChecked(JSON.parse(s)); } catch { /* */ }
    const sc = localStorage.getItem("single-mother-city");
    if (sc) { const c = AICHI_CITIES.find(x => x.city === sc); if (c) setCityManual(c); }
  }, []);

  const toggleCheck = (k: string) => {
    const next = { ...checked, [k]: !checked[k] };
    setChecked(next);
    localStorage.setItem("single-mother-checklist", JSON.stringify(next));
  };

  const selectCity = (c: CityTaxInfo | null) => {
    setCityManual(c);
    if (c) localStorage.setItem("single-mother-city", c.city);
  };

  const cityFromAddr = therapist?.address ? findCityByAddress(therapist.address) : null;
  const activeCity = cityManual || cityFromAddr;
  const cityResults = useMemo(() => citySearchKw.length >= 1 ? searchCities(citySearchKw) : [], [citySearchKw]);

  /* ── シミュレーション計算 ── */
  const sim: SimResult | null = useMemo(() => {
    const inc = parseInt(annualIncome) || 0;
    const exp = parseInt(expenses) || 0;
    const kids = parseInt(childCount) || 1;
    if (inc === 0) return null;

    const shotoku = Math.max(0, inc - exp);

    // ひとり親控除（2026年分〜所得税38万円、住民税33万円）
    const hitorioyaKojo = shotoku <= 10000000 ? 380000 : 0;
    const taxRate = shotoku <= 1950000 ? 0.05 : shotoku <= 3300000 ? 0.10 : shotoku <= 6950000 ? 0.20 : 0.23;
    const taxSaving = Math.round(hitorioyaKojo * taxRate);
    const juminSaving = shotoku <= 10000000 ? Math.round(330000 * 0.10) : 0;
    const totalSaving = taxSaving + juminSaving;

    // 児童扶養手当（全部支給の目安：所得190万未満、子1人の場合）
    // 2025年4月〜: 全部支給 月額45,500円→子1人48,050円
    let jidouFuyou = 0;
    if (shotoku < 2360000) {
      jidouFuyou = 48050; // 全部支給（1人目）
      if (kids >= 2) jidouFuyou += 11350;
      if (kids >= 3) jidouFuyou += (kids - 2) * 6800;
    } else if (shotoku < 3000000) {
      jidouFuyou = 11340; // 一部支給（最低額目安）
      if (kids >= 2) jidouFuyou += 5680;
      if (kids >= 3) jidouFuyou += (kids - 2) * 3410;
    }

    // 市ひとり親手当（名古屋市等: 1年目9,000/月 × 子の数、3年間）
    const jichiTeat = kids * 9000;

    // 愛知県遺児手当（1〜3年目: 4,350/月 × 子の数）
    const ijiTeat = kids * 4350;

    // 児童手当（3歳未満15,000/月、3歳〜高校10,000/月、第3子以降30,000/月）
    let jidouTeate = 0;
    for (let i = 0; i < kids; i++) {
      if (childAges === "small" && i < 2) jidouTeate += 15000;
      else if (i >= 2) jidouTeate += 30000;
      else jidouTeate += 10000;
    }

    const monthlyTotal = jidouFuyou + jichiTeat + ijiTeat + jidouTeate;

    return { hitorioyaKojo, taxSaving, juminSaving, totalSaving, jidouFuyou, jichiTeat, ijiTeat, jidouTeate, monthlyTotal };
  }, [annualIncome, expenses, childCount, childAges]);

  /* ── カードスタイル ── */
  const card = { backgroundColor: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: "16px" };
  const fmt = (n: number) => n.toLocaleString() + "円";

  /* ── FAQ ── */
  const faqs = [
    {
      q: "🏠 ひとり親控除って何？",
      a: `ひとり親控除は、婚姻していない（離婚・死別・未婚を問わない）ひとり親が受けられる所得控除です。

【2026年分からの拡充ポイント】
• 所得税の控除額：35万円 → 38万円にUP
• 住民税の控除額：30万円 → 33万円にUP
• 所得要件：500万円以下 → 1,000万円以下に緩和

【適用条件】
① 12月31日時点で婚姻していない（事実婚もNG）
② 生計を一にする子がいる（子の所得58万円以下）
③ 本人の合計所得が1,000万円以下

確定申告書の「ひとり親控除」欄に記入するだけでOK！
忘れると控除が適用されないので必ず申告しましょう。`
    },
    {
      q: "💰 児童扶養手当はいくらもらえるの？",
      a: `児童扶養手当は、ひとり親家庭の生活安定のために国が支給する手当です。

【2025年4月〜の支給額（月額）】
• 子ども1人：全部支給 48,050円 ／ 一部支給 11,340〜48,040円
• 子ども2人目加算：全部支給 +11,350円 ／ 一部支給 +5,680〜11,340円
• 子ども3人目以降加算：全部支給 +6,800円 ／ 一部支給 +3,410〜6,790円

【所得制限の目安（子1人の場合）】
• 全部支給：年間所得 約236万円未満
• 一部支給：年間所得 約300万円未満

※経費をしっかり計上して所得を下げれば、受給できる可能性UP！
※毎年8月の「現況届」を忘れると支給停止になるので注意！

申請先：お住まいの市区町村の窓口`
    },
    {
      q: "🏛️ 愛知県の独自手当はあるの？",
      a: `愛知県にはひとり親家庭向けの独自手当があります！

【① 愛知県遺児手当】
• 1〜3年目：月額 4,350円 × 子の数
• 4〜5年目：月額 2,175円 × 子の数
• 支給期間は最大5年間
※公的年金を受給している場合は対象外

【② 市のひとり親家庭手当（自治体により異なる）】
例：名古屋市の場合
• 1年目：月額 9,000円 × 子の数
• 2年目：月額 4,500円 × 子の数
• 3年目：月額 3,000円 × 子の数

これらは児童扶養手当と同時に受給できます！
申請先は住所地の市区町村の窓口です。`
    },
    {
      q: "🏥 医療費助成はあるの？",
      a: `ほとんどの愛知県内自治体で、ひとり親家庭等医療費助成制度があります。

【対象】
• ひとり親家庭の親と18歳以下の子ども
• 所得制限あり（児童扶養手当の基準に準ずる）

【助成内容】
• 保険診療の自己負担分が助成されます
• 入院・通院どちらも対象
• 薬代も対象

申請にはお住まいの市区町村で「母子家庭等医療費受給者証」の交付を受けてください。
通院時にこの受給者証と健康保険証を窓口に提示するだけでOKです。`
    },
    {
      q: "📚 子どもの教育費の支援は？",
      a: `教育段階ごとにさまざまな支援があります！

【保育料】
• 3〜5歳：幼児教育無償化により無料
• 0〜2歳：住民税非課税世帯は無料
• 年収360万未満の世帯は副食費（おやつ代等）も免除

【小中学校】
• 就学援助制度：学用品費・給食費・修学旅行費などを支援
• 対象：住民税非課税世帯、児童扶養手当受給世帯等
• 申請先：学校または教育委員会

【高校】
• 高等学校等就学支援金：授業料が実質無料
• 高校生等奨学給付金：教科書代等を支援

【大学・専門学校】
• 高等教育の修学支援新制度：授業料免除 + 給付型奨学金
• ひとり親家庭は多くが対象になりやすい

まずは市区町村の窓口か学校に相談しましょう！`
    },
    {
      q: "💳 国民年金の免除は受けられる？",
      a: `シングルマザーで収入が少ない場合、国民年金保険料の免除・猶予制度が使えます。

【免除の種類】
• 全額免除：前年所得 (35万円×家族数+31万円) 以下
• 3/4免除・半額免除・1/4免除：所得に応じて段階的

【具体例：子ども1人の場合】
• 全額免除の目安：前年所得 約101万円以下
• 月額16,980円(2025年度)の保険料が0円に！

【重要ポイント】
• 免除期間も年金の受給資格期間に算入されます
• 免除中でも将来の年金額は一定割合が反映されます
• 申請は市区町村の国民年金窓口で毎年7月に行います

※ 業務委託のセラピストは自分で国保・年金に加入が必要です。
社会保険料控除として確定申告でも使えます！`
    },
    {
      q: "🏠 住宅支援はあるの？",
      a: `自治体によって異なりますが、主な住宅支援を紹介します。

【公営住宅の優先入居】
• 多くの自治体でひとり親家庭の優先枠があります
• 所得に応じた家賃設定で民間より大幅に安い
• 申請は各自治体の住宅課へ

【母子父子寡婦福祉資金貸付（住宅資金）】
• 住宅の建設・購入・補修のための貸付
• 限度額：150万円（特別200万円）
• 利率：無利子〜年1.0%
• 申請は市区町村の福祉窓口

【民間賃貸住宅の家賃補助】
• 自治体によってはひとり親向け家賃補助制度あり
• お住まいの市町村に確認を！`
    },
    {
      q: "💼 セラピストとしての確定申告でのポイントは？",
      a: `シングルマザーのセラピストさんが確定申告で得する3つのポイント：

【① ひとり親控除を必ず申告】
• 確定申告書第一表の「ひとり親控除」欄に記入
• 控除額：所得税38万円 + 住民税33万円（2026年分〜）
• これだけで年間約5〜8万円の節税に！

【② 経費をしっかり計上】
• 交通費・衣装代・美容費・研修費・通信費など
• 経費を増やすほど「所得」が下がる
• 所得が下がると → 児童扶養手当の受給額UP！

【③ 青色申告で最大65万円控除】
• 開業届 + 青色申告承認申請を提出
• 複式簿記で帳簿をつければ65万円控除
• さらに所得が下がるので手当・保険料にも好影響

【確定申告の期間】
• 2026年2月16日〜3月16日（令和7年分）
• e-Taxなら1月から提出可能`
    },
    {
      q: "🎓 資格取得の支援制度はある？",
      a: `スキルアップ・資格取得を目指すひとり親を支援する制度があります！

【① 自立支援教育訓練給付金】
• 対象講座の受講料の60%を支給（上限20万〜80万円）
• 対象：児童扶養手当受給水準の所得のひとり親

【② 高等職業訓練促進給付金】
• 看護師・保育士・介護福祉士等の資格取得中に支給
• 月額：非課税世帯 100,000円 ／ 課税世帯 70,500円
• 修了時に修了支援給付金も別途支給

【③ マザーズハローワーク】
• 子育てしながら就職を目指すママ専用のハローワーク
• 託児サービス付きの窓口も
• 愛知県内にも複数の拠点あり

申請は市区町村の福祉窓口へ！`
    },
    {
      q: "📋 最初に何から手続きすればいいの？",
      a: `シングルマザーになったら、まず以下の順番で手続きしましょう：

【STEP 1】児童扶養手当の申請
→ 市区町村の窓口（最も重要！他の制度の基準にもなる）

【STEP 2】ひとり親家庭等医療費助成の申請
→ 同じく市区町村窓口（通院費が大幅に安くなる）

【STEP 3】愛知県遺児手当の申請
→ 市区町村窓口で同時申請可能

【STEP 4】国民年金の免除申請
→ 国民年金窓口（保険料の負担が軽くなる）

【STEP 5】保育料・就学援助の確認
→ 保育所・学校・教育委員会

【STEP 6】開業届＋青色申告の申請
→ 税務署（節税の基盤をつくる）

【STEP 7】確定申告でひとり親控除を申告
→ e-Taxまたは税務署

※ 一度に全部やる必要はありません。
まずはSTEP 1〜3を市役所でまとめて相談するのがおすすめ！`
    },
  ];

  /* ── セクション定義 ── */
  const sections = [
    { icon: "🌸", title: "ひとり親のための支援まとめ", id: "overview" },
    { icon: "💰", title: "受けられる手当シミュレーション", id: "sim" },
    { icon: "📋", title: "手続きチェックリスト", id: "checklist" },
    { icon: "❓", title: "よくある質問（FAQ）", id: "faq" },
    { icon: "🏛️", title: "お住まいの市区町村窓口", id: "city" },
  ];

  return (
    <div className="min-h-screen" style={{ backgroundColor: T.bg, color: T.text, fontFamily: FONT_SERIF }}>
      <GuidePageHero
        label="SINGLE MOTHER"
        title="🌸 シングルマザー 完全サポートガイド"
        subtitle="お一人で子育てをしながらお仕事されていること、本当にすごいことです。国や愛知県、お住まいの市町村には、知らないと損する支援制度がたくさんあります。このガイドで使える制度をチェックして、少しでもお力になれれば嬉しいです。"
        marble="soft"
      />

      <main style={{ maxWidth: 640, margin: "0 auto", padding: "32px 16px 80px", display: "flex", flexDirection: "column", gap: 16 }}>

        {/* ── セクション目次 ── */}
        <div style={card}>
          <p className="text-[11px] font-bold mb-2" style={{ color: T.text }}>📖 このガイドの内容</p>
          <div className="space-y-1">
            {sections.map((s, i) => (
              <button
                key={s.id}
                onClick={() => setOpenSection(i)}
                className="w-full text-left flex items-center gap-2 p-2 rounded-lg cursor-pointer"
                style={{
                  backgroundColor: openSection === i ? TEAL + "12" : "transparent",
                  border: `1px solid ${openSection === i ? TEAL + "44" : T.border}`,
                  color: openSection === i ? TEAL : T.textSub,
                  transition: "all 0.2s",
                }}
              >
                <span className="text-[14px]">{s.icon}</span>
                <span className="text-[10px] font-medium">{s.title}</span>
                <span className="ml-auto text-[10px]">{openSection === i ? "▼" : "▶"}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ═══════ Section 0: 支援まとめ ═══════ */}
        {openSection === 0 && (
          <section className="space-y-3">
            <h2 className="text-[14px] font-bold" style={{ color: TEAL }}>🌸 ひとり親が受けられる支援一覧</h2>

            {/* 手当カード群 */}
            {[
              {
                icon: "💴",
                title: "ひとり親控除（税金）",
                color: GREEN,
                items: [
                  "所得税から38万円控除（2026年分〜）",
                  "住民税から33万円控除（2027年度分〜）",
                  "年間約5〜8万円の節税効果",
                  "確定申告で申告するだけでOK",
                ],
                note: "所得1,000万円以下が対象（2026年〜緩和）",
              },
              {
                icon: "👶",
                title: "児童扶養手当（国）",
                color: PINK,
                items: [
                  "子1人：最大 月48,050円",
                  "子2人：最大 月59,400円",
                  "子3人：最大 月66,200円",
                  "所得に応じて一部支給もあり",
                ],
                note: "申請先：市区町村窓口。毎年8月に現況届が必要",
              },
              {
                icon: "🏛️",
                title: "愛知県遺児手当",
                color: AMBER,
                items: [
                  "1〜3年目：月4,350円 × 子の数",
                  "4〜5年目：月2,175円 × 子の数",
                  "児童扶養手当と同時受給OK",
                ],
                note: "支給期間は最大5年間。公的年金受給者は対象外",
              },
              {
                icon: "🏠",
                title: "市の独自手当（例：名古屋市）",
                color: BLUE,
                items: [
                  "1年目：月9,000円 × 子の数",
                  "2年目：月4,500円 × 子の数",
                  "3年目：月3,000円 × 子の数",
                ],
                note: "自治体により内容が異なります。安城市等も確認を",
              },
              {
                icon: "🏥",
                title: "医療費助成",
                color: RED,
                items: [
                  "親と子の医療費自己負担分を助成",
                  "入院・通院・薬代すべて対象",
                  "受給者証を窓口に出すだけ",
                ],
                note: "所得制限あり（児童扶養手当の基準に準ずる）",
              },
              {
                icon: "📚",
                title: "保育・教育費の支援",
                color: PURPLE,
                items: [
                  "3〜5歳の保育料：無料",
                  "0〜2歳（非課税世帯）：無料",
                  "就学援助：給食費・学用品費等を支援",
                  "高校授業料：実質無料",
                ],
                note: "大学の授業料免除・給付型奨学金制度もあり",
              },
              {
                icon: "💳",
                title: "国民年金の免除",
                color: ORANGE,
                items: [
                  "所得に応じて全額〜1/4免除",
                  "子1人：所得約101万円以下で全額免除",
                  "免除期間も年金の受給資格に算入",
                ],
                note: "毎年7月に市区町村の国民年金窓口で申請",
              },
              {
                icon: "🎓",
                title: "資格取得・就業支援",
                color: TEAL,
                items: [
                  "教育訓練給付金：受講料の60%支給",
                  "高等職業訓練促進給付金：月7〜10万円",
                  "マザーズハローワーク：託児付き就職支援",
                ],
                note: "看護師・保育士・介護福祉士等の資格取得を支援",
              },
            ].map((c) => (
              <div key={c.title} className="rounded-2xl" style={{ ...card, padding: 0, overflow: "hidden" }}>
                <div className="px-4 py-3" style={{ backgroundColor: c.color + "10", borderBottom: `1px solid ${c.color}22` }}>
                  <p className="text-[12px] font-bold" style={{ color: c.color }}>
                    {c.icon} {c.title}
                  </p>
                </div>
                <div className="px-4 py-3 space-y-1">
                  {c.items.map((item, i) => (
                    <p key={i} className="text-[10px] flex items-start gap-1.5" style={{ color: T.textSub }}>
                      <span style={{ color: c.color }}>✓</span> {item}
                    </p>
                  ))}
                  {c.note && (
                    <p className="text-[9px] mt-2 pt-2" style={{ color: T.textMuted, borderTop: `1px solid ${T.border}` }}>
                      💡 {c.note}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </section>
        )}

        {/* ═══════ Section 1: シミュレーション ═══════ */}
        {openSection === 1 && (
          <section className="space-y-3">
            <h2 className="text-[14px] font-bold" style={{ color: TEAL }}>💰 手当・控除シミュレーション</h2>
            <p className="text-[9px]" style={{ color: T.textMuted }}>
              おおよその手当額と節税額を確認できます（あくまで目安です）
            </p>

            <div style={card} className="space-y-4">
              {/* 子どもの人数 */}
              <div>
                <p className="text-[11px] font-medium mb-2">👶 お子さんの人数</p>
                <div className="flex gap-2">
                  {["1", "2", "3"].map(v => (
                    <button key={v} onClick={() => setChildCount(v)}
                      className="flex-1 py-2 text-[12px] rounded-xl cursor-pointer"
                      style={{
                        backgroundColor: childCount === v ? TEAL + "18" : "transparent",
                        color: childCount === v ? TEAL : T.textMuted,
                        border: `1px solid ${childCount === v ? TEAL : T.border}`,
                        fontWeight: childCount === v ? 600 : 400,
                      }}>
                      {v}人
                    </button>
                  ))}
                </div>
              </div>

              {/* 子の年齢帯 */}
              <div>
                <p className="text-[11px] font-medium mb-2">🎂 末子の年齢帯（児童手当の計算用）</p>
                <div className="flex flex-wrap gap-1.5">
                  {([["small", "3歳未満"], ["elem", "3歳〜小学"], ["mid", "中学生"], ["high", "高校生"]] as const).map(([v, label]) => (
                    <button key={v} onClick={() => setChildAges(v)}
                      className="px-3 py-1.5 text-[10px] rounded-xl cursor-pointer"
                      style={{
                        backgroundColor: childAges === v ? TEAL + "18" : "transparent",
                        color: childAges === v ? TEAL : T.textMuted,
                        border: `1px solid ${childAges === v ? TEAL : T.border}`,
                      }}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 年間収入 */}
              <div>
                <p className="text-[11px] font-medium mb-1">💰 セラピストの年間収入（万円）</p>
                <input
                  type="number"
                  value={annualIncome}
                  onChange={e => setAnnualIncome(e.target.value)}
                  placeholder="例：200"
                  className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none"
                  style={{ backgroundColor: T.cardAlt, color: T.text, border: `1px solid ${T.border}` }}
                />
                <p className="text-[8px] mt-1" style={{ color: T.textMuted }}>※万円単位で入力（例：年間200万円なら「200」）</p>
              </div>

              {/* 経費 */}
              <div>
                <p className="text-[11px] font-medium mb-1">🧾 年間経費（万円）</p>
                <input
                  type="number"
                  value={expenses}
                  onChange={e => setExpenses(e.target.value)}
                  placeholder="例：30"
                  className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none"
                  style={{ backgroundColor: T.cardAlt, color: T.text, border: `1px solid ${T.border}` }}
                />
              </div>
            </div>

            {/* 結果表示 */}
            {sim && (
              <div className="space-y-2">
                {/* 月額手当合計 */}
                <div className="rounded-2xl p-4" style={{ background: `linear-gradient(135deg, ${TEAL}15, ${GREEN}10)`, border: `1px solid ${TEAL}44` }}>
                  <p className="text-[10px] font-medium" style={{ color: TEAL }}>📌 毎月受け取れる手当の目安</p>
                  <p className="text-[24px] font-bold mt-1" style={{ color: TEAL }}>月額 {fmt(sim.monthlyTotal)}</p>
                  <p className="text-[9px] mt-1" style={{ color: T.textMuted }}>年間にすると約 {fmt(sim.monthlyTotal * 12)}</p>
                </div>

                {/* 内訳 */}
                <div style={card} className="space-y-2">
                  <p className="text-[11px] font-bold" style={{ color: T.text }}>📊 内訳</p>
                  {[
                    { label: "児童扶養手当", amount: sim.jidouFuyou, color: PINK },
                    { label: "市ひとり親手当(1年目)", amount: sim.jichiTeat, color: BLUE },
                    { label: "愛知県遺児手当(1〜3年目)", amount: sim.ijiTeat, color: AMBER },
                    { label: "児童手当", amount: sim.jidouTeate, color: GREEN },
                  ].map(r => (
                    <div key={r.label} className="flex items-center justify-between py-1.5 text-[10px]" style={{ borderBottom: `1px solid ${T.border}` }}>
                      <span style={{ color: T.textSub }}>{r.label}</span>
                      <span className="font-bold" style={{ color: r.amount > 0 ? r.color : T.textFaint }}>
                        {r.amount > 0 ? "月 " + fmt(r.amount) : "—"}
                      </span>
                    </div>
                  ))}
                </div>

                {/* 節税効果 */}
                <div style={card} className="space-y-2">
                  <p className="text-[11px] font-bold" style={{ color: T.text }}>💰 ひとり親控除による節税効果（年額）</p>
                  {sim.hitorioyaKojo > 0 ? (
                    <>
                      <div className="flex items-center justify-between text-[10px]" style={{ borderBottom: `1px solid ${T.border}`, paddingBottom: 6 }}>
                        <span style={{ color: T.textSub }}>所得税の節税</span>
                        <span className="font-bold" style={{ color: GREEN }}>年 {fmt(sim.taxSaving)}</span>
                      </div>
                      <div className="flex items-center justify-between text-[10px]" style={{ borderBottom: `1px solid ${T.border}`, paddingBottom: 6 }}>
                        <span style={{ color: T.textSub }}>住民税の節税</span>
                        <span className="font-bold" style={{ color: GREEN }}>年 {fmt(sim.juminSaving)}</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] pt-1">
                        <span className="font-bold">合計節税額</span>
                        <span className="font-bold text-[14px]" style={{ color: GREEN }}>年 {fmt(sim.totalSaving)}</span>
                      </div>
                    </>
                  ) : (
                    <p className="text-[10px]" style={{ color: T.textMuted }}>所得が1,000万円を超えるため、ひとり親控除は適用されません</p>
                  )}
                </div>

                <p className="text-[8px] text-center" style={{ color: T.textFaint }}>
                  ※ この計算は概算です。実際の支給額は所得や扶養人数で変動します。
                  <br />
                  詳しくは市区町村の窓口にご確認ください。
                </p>
              </div>
            )}
          </section>
        )}

        {/* ═══════ Section 2: チェックリスト ═══════ */}
        {openSection === 2 && (
          <section className="space-y-3">
            <h2 className="text-[14px] font-bold" style={{ color: TEAL }}>📋 手続きチェックリスト</h2>
            <p className="text-[9px]" style={{ color: T.textMuted }}>
              済んだ項目にチェックを入れていきましょう（進捗は保存されます）
            </p>

            {[
              { group: "🏛️ 市区町村の窓口（優先度：高）", items: [
                { key: "cl1", label: "児童扶養手当の申請" },
                { key: "cl2", label: "ひとり親家庭等医療費助成の申請" },
                { key: "cl3", label: "愛知県遺児手当の申請" },
                { key: "cl4", label: "市の独自手当の確認・申請" },
                { key: "cl5", label: "児童手当の受給確認" },
              ]},
              { group: "💰 税金・年金関連", items: [
                { key: "cl6", label: "国民年金免除の申請（7月）" },
                { key: "cl7", label: "国民健康保険の減額確認" },
                { key: "cl8", label: "開業届の提出（税務署）" },
                { key: "cl9", label: "青色申告承認申請（税務署）" },
                { key: "cl10", label: "確定申告でひとり親控除を申告" },
              ]},
              { group: "📚 子ども関連", items: [
                { key: "cl11", label: "保育料の確認・減免申請" },
                { key: "cl12", label: "就学援助の申請（小中学校）" },
                { key: "cl13", label: "高校就学支援金の確認" },
                { key: "cl14", label: "大学の修学支援制度の確認" },
              ]},
              { group: "🏠 生活支援", items: [
                { key: "cl15", label: "公営住宅の優先入居を確認" },
                { key: "cl16", label: "水道料金の減免確認" },
                { key: "cl17", label: "母子父子寡婦福祉資金の確認" },
                { key: "cl18", label: "マザーズハローワークの利用検討" },
              ]},
            ].map(group => (
              <div key={group.group} style={card} className="space-y-2">
                <p className="text-[11px] font-bold" style={{ color: T.text }}>{group.group}</p>
                {group.items.map(item => (
                  <button
                    key={item.key}
                    onClick={() => toggleCheck(item.key)}
                    className="w-full flex items-center gap-2 text-left py-1.5 cursor-pointer"
                    style={{ background: "none", border: "none", padding: "4px 0" }}
                  >
                    <span className="text-[16px] flex-shrink-0">{checked[item.key] ? "✅" : "⬜"}</span>
                    <span
                      className="text-[10px]"
                      style={{
                        color: checked[item.key] ? GREEN : T.textSub,
                        textDecoration: checked[item.key] ? "line-through" : "none",
                      }}
                    >
                      {item.label}
                    </span>
                  </button>
                ))}
              </div>
            ))}

            {/* 進捗 */}
            {(() => {
              const total = 18;
              const done = Object.values(checked).filter(Boolean).length;
              const pct = Math.round((done / total) * 100);
              return (
                <div className="rounded-2xl p-4" style={{ backgroundColor: pct === 100 ? GREEN + "12" : T.cardAlt }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold" style={{ color: pct === 100 ? GREEN : T.textSub }}>
                      {pct === 100 ? "🎉 すべて完了！すばらしい！" : `進捗: ${done}/${total} 完了`}
                    </span>
                    <span className="text-[10px] font-bold" style={{ color: TEAL }}>{pct}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full" style={{ backgroundColor: T.border }}>
                    <div className="h-2 rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: TEAL }} />
                  </div>
                </div>
              );
            })()}
          </section>
        )}

        {/* ═══════ Section 3: FAQ ═══════ */}
        {openSection === 3 && (
          <section className="space-y-2">
            <h2 className="text-[14px] font-bold" style={{ color: TEAL }}>❓ よくある質問</h2>
            {faqs.map((f, i) => (
              <div key={i} className="rounded-2xl overflow-hidden" style={{ ...card, padding: 0 }}>
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full text-left px-4 py-3 flex items-center justify-between cursor-pointer"
                  style={{ background: "none", border: "none", borderBottom: openFaq === i ? `1px solid ${T.border}` : "none" }}
                >
                  <span className="text-[11px] font-medium" style={{ color: openFaq === i ? TEAL : T.text }}>{f.q}</span>
                  <span className="text-[12px] ml-2" style={{ color: T.textMuted }}>{openFaq === i ? "▲" : "▼"}</span>
                </button>
                {openFaq === i && (
                  <div className="px-4 py-3">
                    <p className="text-[10px] whitespace-pre-line leading-relaxed" style={{ color: T.textSub }}>{f.a}</p>
                  </div>
                )}
              </div>
            ))}
          </section>
        )}

        {/* ═══════ Section 4: 市区町村窓口 ═══════ */}
        {openSection === 4 && (
          <section className="space-y-3">
            <h2 className="text-[14px] font-bold" style={{ color: TEAL }}>🏛️ お住まいの市区町村窓口</h2>
            <p className="text-[9px]" style={{ color: T.textMuted }}>
              手当や医療費助成の申請は、お住まいの市区町村の窓口です。
            </p>

            {/* 自動判定 */}
            {cityFromAddr && !cityManual && (
              <div className="rounded-xl p-3" style={{ backgroundColor: GREEN + "10", border: `1px solid ${GREEN}33` }}>
                <p className="text-[10px]" style={{ color: GREEN }}>
                  📍 ご登録の住所から <b>{cityFromAddr.city}</b> と判定しました
                </p>
              </div>
            )}

            {/* 手動選択 */}
            <div style={card}>
              <p className="text-[10px] font-medium mb-2">お住まいの市区町村を選択</p>
              <button
                onClick={() => setCitySearchOpen(!citySearchOpen)}
                className="w-full text-left px-3 py-2.5 rounded-xl text-[11px] cursor-pointer"
                style={{ backgroundColor: T.cardAlt, border: `1px solid ${T.border}`, color: activeCity ? T.text : T.textMuted }}
              >
                {activeCity ? `📍 ${activeCity.city}` : "タップして選択..."}
              </button>

              {citySearchOpen && (
                <div className="mt-2 space-y-2">
                  <input
                    type="text"
                    value={citySearchKw}
                    onChange={e => setCitySearchKw(e.target.value)}
                    placeholder="市区町村名で検索..."
                    className="w-full px-3 py-2 rounded-xl text-[11px] outline-none"
                    style={{ backgroundColor: T.cardAlt, color: T.text, border: `1px solid ${T.border}` }}
                  />
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {cityResults.map(c => (
                      <button
                        key={c.city}
                        onClick={() => { selectCity(c); setCitySearchOpen(false); setCitySearchKw(""); }}
                        className="w-full text-left px-3 py-2 rounded-lg text-[10px] cursor-pointer"
                        style={{ backgroundColor: T.cardAlt, color: T.textSub, border: "none" }}
                      >
                        📍 {c.city}
                      </button>
                    ))}
                    {citySearchKw && cityResults.length === 0 && (
                      <p className="text-[9px] text-center py-2" style={{ color: T.textFaint }}>該当なし</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* 窓口情報 */}
            {activeCity && (
              <div style={card} className="space-y-3">
                <p className="text-[12px] font-bold" style={{ color: TEAL }}>📍 {activeCity.city} の窓口情報</p>

                <div className="rounded-xl p-3" style={{ backgroundColor: T.cardAlt }}>
                  <p className="text-[9px] font-medium mb-1" style={{ color: T.textMuted }}>市民税課（住民税の相談）</p>
                  <p className="text-[11px] font-bold">{activeCity.taxOffice}</p>
                  <a href={`tel:${activeCity.phone}`} className="text-[11px] mt-1 inline-block" style={{ color: TEAL }}>
                    📞 {activeCity.phone}
                  </a>
                </div>

                <div className="rounded-xl p-3" style={{ backgroundColor: PINK + "08" }}>
                  <p className="text-[9px] font-medium mb-1" style={{ color: PINK }}>💡 相談のときに聞くべきこと</p>
                  <div className="space-y-1">
                    {[
                      "児童扶養手当の申請方法と必要書類",
                      "ひとり親家庭等医療費助成の申請",
                      "愛知県遺児手当の申請",
                      "市独自のひとり親向け手当があるか",
                      "住民税の非課税世帯に該当するか",
                      "国民年金の免除申請について",
                      "公営住宅の優先入居について",
                    ].map((item, i) => (
                      <p key={i} className="text-[9px] flex gap-1" style={{ color: T.textSub }}>
                        <span style={{ color: PINK }}>□</span> {item}
                      </p>
                    ))}
                  </div>
                </div>

                <p className="text-[9px]" style={{ color: T.textMuted }}>
                  💡 児童扶養手当・遺児手当・医療費助成は同時に申請できることが多いです。
                  市役所に行く際はまとめて相談するのがおすすめです。
                </p>
              </div>
            )}

            {/* 愛知県の相談窓口 */}
            <div style={card}>
              <p className="text-[11px] font-bold mb-2" style={{ color: T.text }}>🌐 愛知県の相談窓口</p>
              <div className="space-y-2">
                {[
                  { name: "愛知県 ひとり親家庭相談", tel: "052-961-2111", note: "県の総合相談窓口" },
                  { name: "こども家庭庁「あなたの支え」", tel: "", note: "ひとり親家庭の暮らし応援サイト", url: "https://www.cfa.go.jp/policies/hitori-oya" },
                  { name: "ジョイナス.ナゴヤ", tel: "052-228-7421", note: "ひとり親の就業自立支援（名古屋市）" },
                ].map((w, i) => (
                  <div key={i} className="rounded-xl p-3" style={{ backgroundColor: T.cardAlt }}>
                    <p className="text-[10px] font-bold">{w.name}</p>
                    <p className="text-[9px]" style={{ color: T.textMuted }}>{w.note}</p>
                    {w.tel && (
                      <a href={`tel:${w.tel}`} className="text-[10px] mt-1 inline-block" style={{ color: TEAL }}>
                        📞 {w.tel}
                      </a>
                    )}
                    {w.url && (
                      <a href={w.url} target="_blank" rel="noopener noreferrer" className="text-[10px] mt-1 inline-block ml-2" style={{ color: BLUE }}>
                        🔗 サイトを見る
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ── 他のガイドへのリンク ── */}
        <div style={card}>
          <p className="text-[11px] font-bold mb-2" style={{ color: T.text }}>📚 関連ガイドもご覧ください</p>
          <div className="space-y-1.5">
            {[
              { href: "/mypage/tax-guide", icon: "🔒", label: "副業がバレない 完全ガイド", color: PINK },
              { href: "/mypage/spouse-guide", icon: "💑", label: "配偶者控除・扶養 完全ガイド", color: PURPLE },
              { href: "/mypage/invoice-guide", icon: "💎", label: "インボイス登録ガイド", color: "#c3a782" },
            ].map(g => (
              <a
                key={g.href}
                href={g.href}
                className="flex items-center gap-2 p-2 rounded-lg cursor-pointer"
                style={{ backgroundColor: g.color + "10", border: `1px solid ${g.color}33`, textDecoration: "none" }}
              >
                <span style={{ fontSize: 16 }}>{g.icon}</span>
                <span className="text-[10px] font-bold" style={{ color: g.color }}>{g.label}</span>
                <span className="ml-auto text-[10px]" style={{ color: g.color }}>→</span>
              </a>
            ))}
          </div>
        </div>

        {/* ── フッター ── */}
        <div className="text-center space-y-3 pt-2">
          <p className="text-[10px] leading-relaxed" style={{ color: T.textSub }}>
            🌸 一人じゃないよ。使える制度はしっかり使って、
            <br />
            お子さんとの毎日を少しでもラクにしていきましょう。
            <br />
            不安なことがあれば、店長や市役所の窓口に相談してくださいね。
          </p>
          <Link
            href="/mypage"
            className="inline-block text-[11px] px-4 py-2 rounded-full cursor-pointer"
            style={{ backgroundColor: TEAL, color: "#fff", fontWeight: 600 }}
          >
            マイページに戻る
          </Link>
        </div>

        <p className="text-[9px] text-center" style={{ color: T.textFaint }}>
          ※ 本ガイドは2026年（令和8年）4月時点の一般的な情報です。
          <br />
          手当額や所得制限は年度によって変更される場合があります。
          <br />
          個別の申請内容は市区町村窓口へご確認ください。
          <br />
          最終更新: 2026年4月
        </p>
      </main>
    </div>
  );
}
