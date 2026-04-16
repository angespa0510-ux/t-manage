"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";
import { useTheme } from "../../../lib/theme";
import {
  AICHI_CITIES,
  findCityByAddress,
  searchCities,
  type CityTaxInfo,
} from "../../../lib/aichi-cities";

/* ───────── 型 ───────── */
type TherapistLite = { id: number; name: string; address?: string | null };

/* ───────── アクセント色 ───────── */
const PINK = "#e8849a";
const PINK_DARK = "#d4687e";
const PINK_BG = "#fce4ec";
const GREEN = "#4a7c59";
const AMBER = "#d97706";
const RED = "#c45555";

/* ───────── コンポーネント ───────── */
export default function TaxGuidePage() {
  const { dark, toggle, T } = useTheme();

  const [therapist, setTherapist] = useState<TherapistLite | null>(null);
  const [cityManual, setCityManual] = useState<CityTaxInfo | null>(null); // 手動選択
  const [citySearchOpen, setCitySearchOpen] = useState(false);
  const [citySearchKw, setCitySearchKw] = useState("");
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [checkedSteps, setCheckedSteps] = useState<Record<string, boolean>>({});

  /* セラピスト情報の取得（ログインしていれば） */
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

  /* チェックリスト状態の永続化 */
  useEffect(() => {
    const saved = localStorage.getItem("tax-guide-checklist");
    if (saved) {
      try {
        setCheckedSteps(JSON.parse(saved));
      } catch {
        /* ignore */
      }
    }
    const savedCity = localStorage.getItem("tax-guide-city");
    if (savedCity) {
      const c = AICHI_CITIES.find((x) => x.city === savedCity);
      if (c) setCityManual(c);
    }
  }, []);

  const toggleStep = (key: string) => {
    const next = { ...checkedSteps, [key]: !checkedSteps[key] };
    setCheckedSteps(next);
    localStorage.setItem("tax-guide-checklist", JSON.stringify(next));
  };

  const selectCity = (c: CityTaxInfo | null) => {
    setCityManual(c);
    if (c) localStorage.setItem("tax-guide-city", c.city);
    else localStorage.removeItem("tax-guide-city");
    setCitySearchOpen(false);
    setCitySearchKw("");
  };

  /* 住所から自動判定 or 手動選択 */
  const autoCity = useMemo(() => findCityByAddress(therapist?.address), [therapist]);
  const activeCity = cityManual || autoCity;

  const filteredCities = useMemo(() => searchCities(citySearchKw), [citySearchKw]);

  /* ───────── レンダリング ───────── */
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
              ? "linear-gradient(135deg, #3a2a30, #2a2028)"
              : "linear-gradient(135deg, #fce4ec, #fff5f7)",
            borderColor: PINK + "44",
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <span style={{ fontSize: 24 }}>🔒</span>
            <h1 className="text-[18px] font-bold" style={{ color: PINK_DARK }}>
              副業がバレない 完全ガイド
            </h1>
          </div>
          <p className="text-[12px] leading-relaxed" style={{ color: T.textSub }}>
            本業がある方にとって最大の関心事、「副業バレ」。
            <br />
            このページの手順どおりにやれば、<strong style={{ color: PINK_DARK }}>会社にバレる心配はありません。</strong>
          </p>
          {therapist && (
            <p className="text-[10px] mt-3" style={{ color: T.textMuted }}>
              👤 {therapist.name} さん{activeCity && `（${activeCity.city}）`}
            </p>
          )}
        </section>

        {/* ─── 3つの結論 ─── */}
        <section
          className="rounded-2xl p-4 border"
          style={{ backgroundColor: T.card, borderColor: T.border }}
        >
          <h2 className="text-[14px] font-semibold mb-3">📌 まず結論（3つだけ覚えればOK）</h2>
          <div className="space-y-2">
            {[
              {
                icon: "①",
                title: "確定申告書 第二表で「自分で納付」にチェック",
                desc: "住民税の徴収方法を「普通徴収」にする。ここが一番大事！",
              },
              {
                icon: "②",
                title: "申告は3月15日まで（できれば2月中）",
                desc: "遅れると会社にバレる危険あり。早めが鉄則。",
              },
              {
                icon: "③",
                title: "副業の収入は「業務委託報酬」として申告",
                desc: "チョップでのお仕事は事業所得または雑所得。給与ではない。",
              },
            ].map((p, i) => (
              <div
                key={i}
                className="rounded-xl p-3 flex gap-3"
                style={{ backgroundColor: T.cardAlt }}
              >
                <div
                  className="rounded-full flex items-center justify-center flex-shrink-0"
                  style={{
                    width: 32,
                    height: 32,
                    backgroundColor: PINK,
                    color: "#fff",
                    fontWeight: 700,
                    fontSize: 14,
                  }}
                >
                  {p.icon}
                </div>
                <div>
                  <p className="text-[12.5px] font-semibold mb-0.5">{p.title}</p>
                  <p className="text-[11px] leading-relaxed" style={{ color: T.textSub }}>
                    {p.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ─── なぜバレるのか ─── */}
        <section
          className="rounded-2xl p-4 border"
          style={{ backgroundColor: T.card, borderColor: T.border }}
        >
          <h2 className="text-[14px] font-semibold mb-3">❓ そもそも、なぜバレるの？</h2>
          <p className="text-[12px] leading-relaxed mb-3" style={{ color: T.textSub }}>
            答えは<strong>「住民税」</strong>です。
            <br />
            会社はあなたの給料から住民税を天引き（＝特別徴収）していますが、
            この住民税は<strong>本業＋副業のすべての所得を合算</strong>して計算されます。
          </p>

          <div
            className="rounded-xl p-3 mb-3"
            style={{ backgroundColor: RED + "10", border: `1px solid ${RED}33` }}
          >
            <p className="text-[11.5px] font-semibold mb-2" style={{ color: RED }}>
              🚨 何もしないと、こうなります
            </p>
            <div className="text-[11px] space-y-1.5" style={{ color: T.textSub }}>
              <p>1. 副業で収入アップ → 住民税も増加</p>
              <p>2. 市区町村が「全額を会社から天引きして」と通知</p>
              <p>3. 会社の経理「あれ？給料の割に住民税が高い…」</p>
              <p>
                4. <strong style={{ color: RED }}>「副業してる？」と疑われる 💥</strong>
              </p>
            </div>
          </div>

          <div
            className="rounded-xl p-3"
            style={{ backgroundColor: GREEN + "12", border: `1px solid ${GREEN}33` }}
          >
            <p className="text-[11.5px] font-semibold mb-2" style={{ color: GREEN }}>
              ✅ 普通徴収にすると、こうなる
            </p>
            <div className="text-[11px] space-y-1.5" style={{ color: T.textSub }}>
              <p>1. 本業分の住民税 → 会社の給料から天引き（今まで通り）</p>
              <p>2. 副業分の住民税 → 自宅に納付書が届く（年4回）</p>
              <p>3. 会社に通知されるのは本業分だけ</p>
              <p>
                4. <strong style={{ color: GREEN }}>会社にはバレない 🎉</strong>
              </p>
            </div>
          </div>
        </section>

        {/* ─── タイムライン ─── */}
        <section
          className="rounded-2xl p-4 border"
          style={{ backgroundColor: T.card, borderColor: T.border }}
        >
          <h2 className="text-[14px] font-semibold mb-3">📅 いつやるの？タイムライン</h2>
          <div className="space-y-2">
            {[
              {
                date: "1月〜12月",
                title: "副業で収入発生",
                desc: "この期間の報酬を記録しておく（T-MANAGEの給料画面で確認可能）",
                level: "info",
              },
              {
                date: "2/16〜3/15",
                title: "⭐ 確定申告（ここが勝負！）",
                desc: "「自分で納付」にチェック。できれば2月中に提出するのが最も安全。",
                level: "star",
              },
              {
                date: "3月〜4月",
                title: "市区町村がデータを受け取る",
                desc: "何もしなくてOK。自動で処理が進む。",
                level: "info",
              },
              {
                date: "5〜6月",
                title: "住民税が決定・通知",
                desc: "本業分は会社へ、副業分は自宅へ納付書が届く✅",
                level: "success",
              },
              {
                date: "6月〜翌1月",
                title: "副業分の住民税を納付（年4回）",
                desc: "コンビニ・銀行・スマホ決済などで自分で支払う",
                level: "info",
              },
            ].map((e, i) => {
              const color =
                e.level === "star" ? PINK_DARK : e.level === "success" ? GREEN : T.textSub;
              const bg =
                e.level === "star"
                  ? PINK + "15"
                  : e.level === "success"
                  ? GREEN + "12"
                  : T.cardAlt;
              return (
                <div
                  key={i}
                  className="rounded-xl p-3 flex gap-3"
                  style={{
                    backgroundColor: bg,
                    border: e.level === "star" ? `1.5px solid ${PINK}` : "none",
                  }}
                >
                  <div className="flex-shrink-0" style={{ width: 70 }}>
                    <p
                      className="text-[10px] font-semibold"
                      style={{ color, lineHeight: 1.2 }}
                    >
                      {e.date}
                    </p>
                  </div>
                  <div style={{ flex: 1 }}>
                    <p className="text-[12px] font-semibold" style={{ color: T.text }}>
                      {e.title}
                    </p>
                    <p className="text-[10.5px] leading-relaxed mt-0.5" style={{ color: T.textSub }}>
                      {e.desc}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          <div
            className="rounded-xl p-3 mt-3"
            style={{ backgroundColor: AMBER + "12", border: `1px solid ${AMBER}33` }}
          >
            <p className="text-[11px] leading-relaxed" style={{ color: T.textSub }}>
              <strong style={{ color: AMBER }}>⚠️ 3月15日を過ぎると危険！</strong>
              <br />
              期限後申告になると、市区町村が「全部特別徴収で処理」を先に進めてしまうことがあり、会社に副業分も含めた金額で通知が行く可能性があります。必ず期限内に。
            </p>
          </div>
        </section>

        {/* ─── どこでやる？方法別手順 ─── */}
        <section
          className="rounded-2xl p-4 border"
          style={{ backgroundColor: T.card, borderColor: T.border }}
        >
          <h2 className="text-[14px] font-semibold mb-3">🛠 どこで・どうやるの？</h2>

          {/* 方法1 */}
          <div
            className="rounded-xl p-3 mb-2"
            style={{ backgroundColor: T.cardAlt, border: `1px solid ${PINK}33` }}
          >
            <div className="flex items-center gap-2 mb-2">
              <span
                className="text-[10px] px-2 py-0.5 rounded-full text-white"
                style={{ backgroundColor: PINK }}
              >
                おすすめ
              </span>
              <p className="text-[13px] font-semibold">① 国税庁「確定申告書等作成コーナー」</p>
            </div>
            <p className="text-[11px] mb-2" style={{ color: T.textSub }}>
              PCまたはスマホから無料で作成できます。画面の指示に従って入力するだけ。
            </p>
            <ol className="text-[11px] space-y-1 pl-4" style={{ color: T.textSub, listStyle: "decimal" }}>
              <li>国税庁サイトにアクセス</li>
              <li>「作成開始」→ 年度を選択</li>
              <li>収入入力の画面で「事業所得 or 雑所得」を選んで入力</li>
              <li>
                <strong style={{ color: PINK_DARK }}>
                  「住民税等入力」画面で「自分で納付」を選択 ← ここが最重要！
                </strong>
              </li>
              <li>最終確認画面で「自分で納付」になっているか必ずチェック</li>
              <li>印刷して郵送 or e-Taxで送信</li>
            </ol>
            <a
              href="https://www.keisan.nta.go.jp/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-2 text-[11px] px-3 py-1.5 rounded-lg"
              style={{ backgroundColor: PINK, color: "#fff", fontWeight: 600 }}
            >
              🌐 国税庁サイトを開く →
            </a>
          </div>

          {/* 方法2 */}
          <div
            className="rounded-xl p-3 mb-2"
            style={{ backgroundColor: T.cardAlt }}
          >
            <p className="text-[13px] font-semibold mb-1">② スマホでe-Tax（マイナンバーカード）</p>
            <p className="text-[11px]" style={{ color: T.textSub }}>
              マイナポータル連携で、スマホだけで完結。途中で出てくる
              <strong>「住民税・事業税に関する事項」</strong>の画面で<strong style={{ color: PINK_DARK }}>「自分で納付」</strong>
              を選択。
            </p>
          </div>

          {/* 方法3 */}
          <div
            className="rounded-xl p-3 mb-2"
            style={{ backgroundColor: T.cardAlt }}
          >
            <p className="text-[13px] font-semibold mb-1">③ 紙で書いて提出</p>
            <p className="text-[11px]" style={{ color: T.textSub }}>
              確定申告書 第二表の下の方にある
              <br />
              <strong>「住民税・事業税に関する事項」</strong>欄 →
              <br />
              「給与、公的年金等以外の所得に係る住民税の徴収方法」→
              <br />
              <strong style={{ color: PINK_DARK }}>「自分で納付」に ○（丸）</strong>をつける。
            </p>
          </div>

          {/* 方法4 */}
          <div
            className="rounded-xl p-3"
            style={{ backgroundColor: T.cardAlt }}
          >
            <p className="text-[13px] font-semibold mb-1">④ 税理士に依頼</p>
            <p className="text-[11px]" style={{ color: T.textSub }}>
              依頼時に必ず一言：
              <br />
              <strong style={{ color: PINK_DARK }}>
                「副業分の住民税は普通徴収（自分で納付）にしてください」
              </strong>
              <br />
              と伝える。言わないと知らずに特別徴収で出されるケースあり。
            </p>
          </div>
        </section>

        {/* ─── 確定申告書のイメージ ─── */}
        <section
          className="rounded-2xl p-4 border"
          style={{ backgroundColor: T.card, borderColor: T.border }}
        >
          <h2 className="text-[14px] font-semibold mb-3">📄 確定申告書のどこ？</h2>
          <p className="text-[11.5px] mb-3" style={{ color: T.textSub }}>
            第二表の下の方に、この欄があります👇
          </p>
          <div
            className="rounded-xl p-3 border font-mono"
            style={{
              backgroundColor: T.cardAlt,
              borderColor: T.border,
              fontSize: 10,
              lineHeight: 1.6,
            }}
          >
            <div style={{ color: T.textMuted }}>──── 住民税・事業税に関する事項 ────</div>
            <div style={{ marginTop: 8 }}>
              給与、公的年金等以外の所得に係る
              <br />
              住民税の徴収方法
            </div>
            <div
              style={{
                marginTop: 8,
                padding: 8,
                border: `1px dashed ${T.border}`,
                borderRadius: 6,
              }}
            >
              <div>
                <span style={{ color: T.textMuted }}>□</span> 特別徴収
              </div>
              <div style={{ marginTop: 4, color: PINK_DARK, fontWeight: 700 }}>
                ● 自分で納付　←ココ！
              </div>
            </div>
          </div>
        </section>

        {/* ─── お住まいの市区町村 ─── */}
        <section
          className="rounded-2xl p-4 border"
          style={{ backgroundColor: T.card, borderColor: T.border }}
        >
          <h2 className="text-[14px] font-semibold mb-1">
            📍 お住まいの市区町村の問い合わせ先
          </h2>
          <p className="text-[10.5px] mb-3" style={{ color: T.textMuted }}>
            事前に市役所へ電話確認しておくと、より確実です。
          </p>

          {activeCity ? (
            <div
              className="rounded-xl p-4 mb-3"
              style={{
                backgroundColor: PINK + "10",
                border: `1.5px solid ${PINK}44`,
              }}
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="text-[10px]" style={{ color: T.textMuted }}>
                    {cityManual ? "選択中" : "登録住所から自動判定"}
                  </p>
                  <p className="text-[15px] font-bold" style={{ color: PINK_DARK }}>
                    {activeCity.prefecture} {activeCity.city}
                  </p>
                </div>
                {!cityManual && autoCity && (
                  <span
                    className="text-[9px] px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: GREEN + "22", color: GREEN }}
                  >
                    自動判定
                  </span>
                )}
              </div>
              <p className="text-[11.5px] mb-1" style={{ color: T.text }}>
                <strong>{activeCity.taxOffice}</strong>
              </p>
              <a
                href={`tel:${activeCity.phone}`}
                className="inline-flex items-center gap-1.5 text-[13px] font-bold mt-1"
                style={{ color: PINK_DARK }}
              >
                📞 {activeCity.phone}
              </a>
              {activeCity.websiteUrl && (
                <div style={{ marginTop: 6 }}>
                  <a
                    href={activeCity.websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10.5px]"
                    style={{ color: T.textSub, textDecoration: "underline" }}
                  >
                    🌐 {activeCity.city}の市民税ページを開く
                  </a>
                </div>
              )}
              {activeCity.note && (
                <div
                  className="mt-3 p-2 rounded-lg text-[10.5px] leading-relaxed"
                  style={{ backgroundColor: T.card, color: T.textSub }}
                >
                  💡 {activeCity.note}
                </div>
              )}
            </div>
          ) : (
            <div
              className="rounded-xl p-3 mb-3"
              style={{ backgroundColor: T.cardAlt, border: `1px dashed ${T.border}` }}
            >
              <p className="text-[11px]" style={{ color: T.textSub }}>
                {therapist?.address
                  ? "登録住所から愛知県内の市区町村を判定できませんでした。"
                  : "住所が未登録です。下から市区町村を選択してください。"}
              </p>
            </div>
          )}

          {/* 市区町村を選ぶ */}
          <button
            onClick={() => setCitySearchOpen((v) => !v)}
            className="w-full py-2.5 rounded-xl text-[11.5px] cursor-pointer border"
            style={{
              backgroundColor: T.cardAlt,
              borderColor: T.border,
              color: T.textSub,
              fontWeight: 500,
            }}
          >
            {citySearchOpen ? "▲ 閉じる" : "🔍 市区町村を選び直す"}
          </button>

          {citySearchOpen && (
            <div
              className="mt-2 rounded-xl p-3 border"
              style={{ backgroundColor: T.cardAlt, borderColor: T.border }}
            >
              <input
                type="text"
                value={citySearchKw}
                onChange={(e) => setCitySearchKw(e.target.value)}
                placeholder="市区町村名を入力（例：安城）"
                className="w-full px-3 py-2 rounded-lg text-[12px] outline-none border mb-2"
                style={{ backgroundColor: T.card, borderColor: T.border, color: T.text }}
              />
              <div
                className="space-y-1 overflow-auto"
                style={{ maxHeight: 280 }}
              >
                {filteredCities.map((c) => (
                  <button
                    key={c.city}
                    onClick={() => selectCity(c)}
                    className="w-full text-left px-3 py-2 rounded-lg text-[11.5px] cursor-pointer"
                    style={{
                      backgroundColor:
                        activeCity?.city === c.city ? PINK + "18" : T.card,
                      color: T.text,
                      border: `1px solid ${
                        activeCity?.city === c.city ? PINK : T.border
                      }`,
                    }}
                  >
                    {c.city}
                    <span
                      className="ml-2 text-[10px]"
                      style={{ color: T.textMuted }}
                    >
                      {c.phone}
                    </span>
                  </button>
                ))}
                {filteredCities.length === 0 && (
                  <p
                    className="text-[11px] text-center py-4"
                    style={{ color: T.textMuted }}
                  >
                    該当する市区町村が見つかりません
                  </p>
                )}
              </div>
              {cityManual && (
                <button
                  onClick={() => selectCity(null)}
                  className="w-full mt-2 py-2 rounded-lg text-[10.5px] cursor-pointer"
                  style={{ backgroundColor: T.card, color: T.textMuted, border: `1px solid ${T.border}` }}
                >
                  × 選択を解除（自動判定に戻す）
                </button>
              )}
            </div>
          )}

          <p
            className="text-[10px] mt-3 leading-relaxed"
            style={{ color: T.textMuted }}
          >
            ※ 愛知県外の方は、お住まいの市区町村の「市民税課」または「税務課」へお問い合わせください。
            <br />
            ※ 電話番号は代表番号を記載しているものもあり、市民税課につないでもらってください。
          </p>
        </section>

        {/* ─── よくあるミス ─── */}
        <section
          className="rounded-2xl p-4 border"
          style={{ backgroundColor: T.card, borderColor: T.border }}
        >
          <h2 className="text-[14px] font-semibold mb-3">⚠️ よくあるミス</h2>
          <div className="space-y-2">
            {[
              {
                title: "チェック忘れ（一番多い！）",
                desc: "画面を進めるうちに忘れがち。最終確認画面で必ずもう一度見る。",
              },
              {
                title: "訂正申告でチェックが外れる",
                desc: "間違いを直すとき、普通徴収の設定がリセットされることがある。訂正時も必ず再チェック。",
              },
              {
                title: "期限後に提出",
                desc: "3月15日を過ぎると市区町村の処理が進んでしまう。絶対に期限内に。",
              },
              {
                title: "副業がアルバイト（給与所得）の場合",
                desc: "給与所得は普通徴収にできない。チョップは業務委託なのでOK✅",
              },
              {
                title: "SNSで本名や顔が分かる投稿",
                desc: "税金以外のルートで身バレすることも。SNS運用は慎重に。",
              },
            ].map((m, i) => (
              <div
                key={i}
                className="rounded-xl p-3"
                style={{ backgroundColor: AMBER + "0d", border: `1px solid ${AMBER}22` }}
              >
                <p className="text-[12px] font-semibold mb-0.5" style={{ color: AMBER }}>
                  ❌ {m.title}
                </p>
                <p className="text-[11px] leading-relaxed" style={{ color: T.textSub }}>
                  {m.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ─── チェックリスト ─── */}
        <section
          className="rounded-2xl p-4 border"
          style={{ backgroundColor: T.card, borderColor: T.border }}
        >
          <h2 className="text-[14px] font-semibold mb-1">✅ 実行チェックリスト</h2>
          <p className="text-[10.5px] mb-3" style={{ color: T.textMuted }}>
            タップで記録されます（この端末に保存）
          </p>
          <div className="space-y-1.5">
            {[
              { key: "income", label: "年間の副業収入を確認した（給料画面でチェック）" },
              { key: "expense", label: "経費を記録している（交通費・消耗品など）" },
              { key: "call", label: "必要なら市区町村に事前に電話で確認した" },
              { key: "prepare", label: "確定申告書等作成コーナーまたはe-Taxで準備した" },
              { key: "check", label: "⭐「自分で納付」にチェックを入れた（最重要）" },
              { key: "review", label: "最終確認画面でもう一度チェックを確認した" },
              { key: "submit", label: "3月15日までに提出した（できれば2月中）" },
              { key: "notice", label: "5〜6月に自宅に納付書が届くのを待つ" },
            ].map((c) => (
              <button
                key={c.key}
                onClick={() => toggleStep(c.key)}
                className="w-full flex items-start gap-2 text-left px-3 py-2 rounded-lg cursor-pointer"
                style={{
                  backgroundColor: checkedSteps[c.key] ? GREEN + "10" : T.cardAlt,
                  border: `1px solid ${
                    checkedSteps[c.key] ? GREEN + "44" : T.border
                  }`,
                }}
              >
                <span
                  className="flex-shrink-0"
                  style={{
                    fontSize: 16,
                    lineHeight: 1.2,
                    color: checkedSteps[c.key] ? GREEN : T.textMuted,
                  }}
                >
                  {checkedSteps[c.key] ? "☑" : "☐"}
                </span>
                <span
                  className="text-[11.5px] leading-relaxed"
                  style={{
                    color: checkedSteps[c.key] ? T.text : T.textSub,
                    textDecoration: checkedSteps[c.key] ? "line-through" : "none",
                    opacity: checkedSteps[c.key] ? 0.7 : 1,
                  }}
                >
                  {c.label}
                </span>
              </button>
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
                q: "副業の収入が年20万円以下でも申告が必要？",
                a: "所得税の確定申告は不要ですが、住民税の申告は必要です。お住まいの市区町村へ「市民税・県民税申告書」を提出してください。このときも「自分で納付」にチェックを忘れずに。",
              },
              {
                q: "安城市は特別徴収を徹底してるって聞いたけど大丈夫？",
                a: "それは本業の給与分の話。副業の事業所得・雑所得は、確定申告で「自分で納付」を選択すれば普通徴収にできます（公式回答済み）。",
              },
              {
                q: "豊橋市・その他の市でも普通徴収にできる？",
                a: "愛知県内の市区町村は、基本的に副業分を普通徴収にできます。心配なら事前に市役所の市民税課に電話で確認すると確実です。",
              },
              {
                q: "住民税の納付書が家に届くと家族にバレない？",
                a: "家族に気づかれたくない場合、市区町村の税務署で「送付先変更依頼書」を出せば、お店や別の住所に届けてもらえます。（窓口・郵送・オンライン対応）",
              },
              {
                q: "マイナンバーで副業はバレる？",
                a: "マイナンバーは各機関ごとに独立管理されており、税務署が会社にあなたの副業情報を伝えることはありません。バレるのは基本的に住民税ルートだけ。",
              },
              {
                q: "ふるさと納税をしていて大丈夫？",
                a: "OK。ただし副業の確定申告をする場合、ワンストップ特例は使えないので、ふるさと納税分も確定申告書に記入する必要があります。",
              },
              {
                q: "チェック忘れた！今からでも間に合う？",
                a: "期限内（3/15まで）なら訂正申告で修正可能。期限後の場合は市役所に即電話して相談を。早ければ修正してくれる可能性があります。",
              },
              {
                q: "経費って何が認められる？",
                a: "お仕事に関係する交通費、消耗品、衣装代、研修費、勉強代、通信費の一部などが経費になります。領収書は必ず保管を。",
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
                    background: openFaq === i ? (dark ? "#3a3a42" : "#fef9f0") : "transparent",
                  }}
                >
                  <span
                    className="text-[9px] px-1.5 py-0.5 rounded flex-shrink-0"
                    style={{ background: PINK + "22", color: PINK_DARK }}
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

        {/* ─── フッター ─── */}
        <section
          className="rounded-2xl p-4 border text-center"
          style={{
            backgroundColor: PINK_BG + "aa",
            borderColor: PINK + "33",
          }}
        >
          <p className="text-[11px] mb-2" style={{ color: PINK_DARK, fontWeight: 600 }}>
            💐 大切なあなたへ
          </p>
          <p className="text-[11px] leading-relaxed" style={{ color: T.textSub }}>
            確定申告は毎年のことなので、1回やれば次からはもっとラクにできます。
            <br />
            不安なことがあれば、店長・先輩・税理士さんに気軽に相談してくださいね。
          </p>
          <Link
            href="/mypage"
            className="inline-block mt-3 text-[11px] px-4 py-2 rounded-full cursor-pointer"
            style={{ backgroundColor: PINK, color: "#fff", fontWeight: 600 }}
          >
            マイページに戻る
          </Link>
        </section>

        <p
          className="text-[9px] text-center"
          style={{ color: T.textFaint }}
        >
          ※ 本ガイドは一般的な情報です。具体的な申告は税理士または市区町村へご確認ください。
          <br />
          最終更新: 2026年4月
        </p>
      </main>
    </div>
  );
}
