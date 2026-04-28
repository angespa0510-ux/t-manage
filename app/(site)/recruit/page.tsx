"use client";

import Link from "next/link";
import { SITE } from "../../../lib/site-theme";
import SectionHeading from "../../../components/site/SectionHeading";
import { PageHero } from "../../../components/site/SiteLayoutParts";

/**
 * /recruit — 求人（セラピスト募集）ページ
 *
 * 静的コンテンツ中心。応募は電話/LINE経由。
 * 構成:
 *  - PageHero
 *  - MESSAGE（代表メッセージ的な導入）
 *  - POINT（働くメリット4点）
 *  - CONDITIONS（募集要項）
 *  - VOICE（先輩の声、将来DBから）
 *  - FAQ
 *  - ENTRY（応募CTA）
 */

const POINTS = [
  {
    num: "01",
    title: "技術習得でしっかり稼げる",
    desc: "完全歩合制。施術スキルとリピート獲得力に応じて報酬が上がる仕組みです。日払い・週払いにも対応しております。",
  },
  {
    num: "02",
    title: "未経験から技術が身につく研修制度",
    desc: "解剖学の基礎・リンパケア・オイルトリートメント等の施術技術を、体系的なカリキュラムで一から指導いたします。施術カウンセリングのマナーも学べます。",
  },
  {
    num: "03",
    title: "自由な働き方",
    desc: "シフト自由制。週1日・短時間からOK。学校・家事・Wワークとの両立もしやすい環境です。",
  },
  {
    num: "04",
    title: "プライバシー保護",
    desc: "完全個室・顔出しNG可。身バレ防止対策を徹底しており、安心してお仕事いただけます。",
  },
];

const CONDITIONS: { k: string; v: string }[] = [
  { k: "募集職種", v: "セラピスト（女性のみ）" },
  { k: "応募資格", v: "18歳以上（高校生不可）・健康な方" },
  {
    k: "給与",
    v: "完全歩合制\n施術技術と実績に応じた報酬体系\n日払い・週払いOK\n※詳細は面接時にご説明いたします",
  },
  {
    k: "勤務時間",
    v: "12:00 〜 翌 03:00 の間で自由\n1日3時間〜、週1日〜OK",
  },
  { k: "休日休暇", v: "自由シフト制（希望休100%取得）" },
  {
    k: "待遇・福利厚生",
    v: "・施術技術研修制度あり\n・衣装・備品貸与\n・交通費支給\n・送迎あり\n・プライバシー保護徹底",
  },
  { k: "勤務地", v: "三河安城A店 / 三河安城B店 / 豊橋店" },
];

const FAQ = [
  {
    q: "未経験ですが大丈夫ですか？",
    a: "はい、在籍の8割が未経験スタートです。解剖学の基礎、リンパケア、オイルトリートメントなどの施術技術を体系的にお教えしますので、ご安心ください。施術前のカウンセリングや衛生管理についても丁寧にサポートいたします。",
  },
  {
    q: "身バレは大丈夫ですか？",
    a: "顔出しNGでのご出勤が可能です。写真・動画の掲載方法もご相談いただけますので、お気軽にご応募ください。",
  },
  {
    q: "どのくらい稼げますか？",
    a: "完全歩合制のため、施術スキルとリピート獲得力に応じて報酬が変動します。研修期間後の具体的な報酬モデルや、実績を伸ばすためのサポート体制については面接時に詳しくご説明いたします。",
  },
  {
    q: "学生やWワークでも働けますか？",
    a: "もちろん可能です。週1日・3時間からご希望に合わせてシフトを組めますので、学校や本業との両立もしやすい環境です。",
  },
  {
    q: "面接の流れを教えてください",
    a: "お電話またはLINEでお問い合わせ → 面接日時を調整 → 面接当日に必要書類をお持ちいただきお越しください。最短当日からご勤務も可能です。",
  },
];

export default function RecruitPage() {
  return (
    <>
      <PageHero
        label="RECRUIT"
        title="セラピスト募集"
        subtitle="一緒に働いてくれる仲間を募集しています。未経験の方も大歓迎、丁寧にサポートいたします。"
        bgVideo="/videos/recruit.mp4"
        bgVideoPoster="/videos/recruit-poster.jpg"
      />

      {/* ───── MESSAGE ───── */}
      <section style={{ padding: `${SITE.sp.section} ${SITE.sp.lg}` }}>
        <div style={{ maxWidth: SITE.layout.maxWidthText, margin: "0 auto" }}>
          <SectionHeading label="MESSAGE" title="はじめに" />
          <p
            style={{
              fontFamily: SITE.font.serif,
              fontSize: "15px",
              lineHeight: SITE.lh.loose,
              color: SITE.color.textSub,
              letterSpacing: SITE.ls.loose,
              textAlign: "center",
            }}
          >
            Ange Spa は女性が安心して<br />
            長く働ける環境づくりに力を入れております。<br />
            <br />
            「高収入を得たい」「人の役に立つ仕事がしたい」<br />
            「自由な時間で働きたい」<br />
            そんなあなたを、私たちは全力でサポートいたします。
          </p>
        </div>
      </section>

      {/* ───── POINT ───── */}
      <section
        style={{
          padding: `${SITE.sp.section} ${SITE.sp.lg}`,
          backgroundColor: SITE.color.bgSoft,
        }}
      >
        <div style={{ maxWidth: SITE.layout.maxWidth, margin: "0 auto" }}>
          <SectionHeading
            label="POINT"
            title="選ばれる4つの理由"
            subtitle="セラピストさんに選ばれ続ける理由をご紹介いたします。"
          />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr",
              gap: SITE.sp.md,
            }}
            className="site-point-grid"
          >
            {POINTS.map((p) => (
              <div
                key={p.num}
                style={{
                  padding: SITE.sp.xl,
                  backgroundColor: SITE.color.surface,
                  border: `1px solid ${SITE.color.border}`,
                }}
              >
                <p
                  style={{
                    fontFamily: SITE.font.display,
                    fontSize: "36px",
                    fontWeight: 500,
                    color: SITE.color.pink,
                    letterSpacing: SITE.ls.loose,
                    marginBottom: 12,
                    lineHeight: 1,
                  }}
                >
                  {p.num}
                </p>
                <div
                  style={{
                    width: 24,
                    height: 1,
                    backgroundColor: SITE.color.pink,
                    marginBottom: 16,
                  }}
                />
                <h3
                  style={{
                    fontFamily: SITE.font.serif,
                    fontSize: "17px",
                    fontWeight: 500,
                    color: SITE.color.text,
                    marginBottom: 12,
                    letterSpacing: SITE.ls.loose,
                  }}
                >
                  {p.title}
                </h3>
                <p
                  style={{
                    fontFamily: SITE.font.serif,
                    fontSize: "13px",
                    lineHeight: SITE.lh.body,
                    color: SITE.color.textSub,
                    letterSpacing: SITE.ls.normal,
                  }}
                >
                  {p.desc}
                </p>
              </div>
            ))}
          </div>
          <style>{`
            @media (min-width: 640px) {
              .site-point-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
            }
          `}</style>
        </div>
      </section>

      {/* ───── CONDITIONS ───── */}
      <section style={{ padding: `${SITE.sp.section} ${SITE.sp.lg}` }}>
        <div style={{ maxWidth: SITE.layout.maxWidthNarrow, margin: "0 auto" }}>
          <SectionHeading label="CONDITIONS" title="募集要項" />
          <dl
            style={{
              margin: 0,
              padding: 0,
              borderTop: `1px solid ${SITE.color.border}`,
            }}
          >
            {CONDITIONS.map((c) => (
              <div
                key={c.k}
                style={{
                  display: "grid",
                  gridTemplateColumns: "120px 1fr",
                  gap: SITE.sp.md,
                  padding: "16px 8px",
                  borderBottom: `1px solid ${SITE.color.border}`,
                }}
                className="site-conditions-row"
              >
                <dt
                  style={{
                    fontFamily: SITE.font.serif,
                    fontSize: "12px",
                    color: SITE.color.textMuted,
                    letterSpacing: SITE.ls.loose,
                    fontWeight: 500,
                  }}
                >
                  {c.k}
                </dt>
                <dd
                  style={{
                    margin: 0,
                    fontFamily: SITE.font.serif,
                    fontSize: "13px",
                    color: SITE.color.text,
                    lineHeight: SITE.lh.body,
                    letterSpacing: SITE.ls.normal,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {c.v}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ───── FAQ ───── */}
      <section
        style={{
          padding: `${SITE.sp.section} ${SITE.sp.lg}`,
          backgroundColor: SITE.color.bgSoft,
        }}
      >
        <div style={{ maxWidth: SITE.layout.maxWidthNarrow, margin: "0 auto" }}>
          <SectionHeading label="FAQ" title="よくある質問" />
          <div
            style={{
              borderTop: `1px solid ${SITE.color.border}`,
            }}
          >
            {FAQ.map((f) => (
              <details
                key={f.q}
                style={{
                  borderBottom: `1px solid ${SITE.color.border}`,
                  backgroundColor: SITE.color.surface,
                }}
              >
                <summary
                  style={{
                    padding: "20px 24px",
                    cursor: "pointer",
                    fontFamily: SITE.font.serif,
                    fontSize: "14px",
                    fontWeight: 500,
                    color: SITE.color.text,
                    listStyle: "none",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 16,
                    letterSpacing: SITE.ls.loose,
                  }}
                  className="site-faq-summary"
                >
                  <span>{f.q}</span>
                  <span
                    style={{
                      fontFamily: SITE.font.display,
                      fontSize: "18px",
                      color: SITE.color.pink,
                      flexShrink: 0,
                      fontWeight: 300,
                    }}
                    className="site-faq-mark"
                  >
                    ＋
                  </span>
                </summary>
                <div
                  style={{
                    padding: "0 24px 24px",
                    fontFamily: SITE.font.serif,
                    fontSize: "13px",
                    lineHeight: SITE.lh.body,
                    color: SITE.color.textSub,
                    letterSpacing: SITE.ls.normal,
                  }}
                >
                  {f.a}
                </div>
              </details>
            ))}
          </div>
          <style>{`
            details[open] .site-faq-mark::before { content: "−"; }
            details[open] .site-faq-mark { display: inline-flex; }
            details[open] .site-faq-mark { font-size: 22px !important; }
            details[open] .site-faq-mark { visibility: hidden; }
            details[open] summary::after {
              content: "−";
              font-family: ${SITE.font.display};
              font-size: 22px;
              color: ${SITE.color.pink};
              position: absolute;
              right: 24px;
              top: 18px;
            }
            details summary { position: relative; }
            details[open] summary .site-faq-mark { display: none; }
          `}</style>
        </div>
      </section>

      {/* ───── ENTRY ───── */}
      <section style={{ padding: `${SITE.sp.section} ${SITE.sp.lg}` }}>
        <div
          style={{
            maxWidth: SITE.layout.maxWidthText,
            margin: "0 auto",
            textAlign: "center",
          }}
        >
          <SectionHeading label="ENTRY" title="ご応募・お問い合わせ" />
          <p
            style={{
              fontFamily: SITE.font.serif,
              fontSize: "14px",
              lineHeight: SITE.lh.body,
              color: SITE.color.textSub,
              letterSpacing: SITE.ls.loose,
              marginBottom: SITE.sp.xl,
            }}
          >
            お電話またはLINEにて<br />
            お気軽にお問い合わせください。<br />
            見学のみでも歓迎しております。
          </p>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
              maxWidth: 360,
              margin: "0 auto",
            }}
          >
            <a
              href="tel:070-1675-5900"
              style={{
                display: "block",
                padding: "18px 24px",
                backgroundColor: SITE.color.pink,
                color: "#ffffff",
                fontFamily: '-apple-system, BlinkMacSystemFont, "Hiragino Sans", "Noto Sans JP", "Yu Gothic", sans-serif',
                fontSize: "15px",
                letterSpacing: SITE.ls.wide,
                textDecoration: "none",
                textAlign: "center",
              }}
              className="site-cta-primary"
            >
              電話 070-1675-5900
            </a>
            <a
              href="https://lin.ee/tJtwJL9"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "block",
                padding: "16px 24px",
                border: `1px solid ${SITE.color.pink}`,
                color: SITE.color.pink,
                fontFamily: SITE.font.serif,
                fontSize: "14px",
                letterSpacing: SITE.ls.loose,
                textDecoration: "none",
                textAlign: "center",
              }}
              className="site-cta-secondary"
            >
              LINEで応募・相談
            </a>
            <Link
              href="/contact"
              style={{
                display: "block",
                padding: "14px 24px",
                border: `1px solid ${SITE.color.border}`,
                color: SITE.color.textSub,
                fontFamily: SITE.font.serif,
                fontSize: "13px",
                letterSpacing: SITE.ls.loose,
                textDecoration: "none",
                textAlign: "center",
              }}
            >
              お問い合わせフォーム
            </Link>
          </div>
          <p
            style={{
              marginTop: SITE.sp.xl,
              fontFamily: SITE.font.serif,
              fontSize: "11px",
              color: SITE.color.textMuted,
              letterSpacing: SITE.ls.loose,
              lineHeight: SITE.lh.body,
            }}
          >
            電話受付 11:00 — 翌 03:00<br />
            LINEは24時間受付（返信は営業時間内）
          </p>
        </div>
      </section>
    </>
  );
}
