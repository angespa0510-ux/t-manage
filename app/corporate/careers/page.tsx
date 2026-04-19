"use client";
/* ═══════════════════════════════════════════════════════════════════
   採用ページ / careers
   /corporate/careers
   
   DX導入フローと統一感のある暗シネマ調デザイン
   「カジュアル歓迎」「非エンジニアOK」を前面に
   ═══════════════════════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";

type Job = {
  id: number;
  title: string;
  job_type: string;
  summary: string;
  description: string;
  requirements: string;
  salary_range: string;
  location: string;
};

// ===== Accent =====
const ACCENT = { hex: "#4dd6e8", soft: "rgba(77,214,232,0.14)", dim: "#0f2a30" };
const LIME = { hex: "#a8eb6e", soft: "rgba(168,235,110,0.14)", dim: "#1e2a10" };

// ===== Data =====
const WHY_US = [
  {
    code: "01",
    title: "現場志向",
    en: "On-site First",
    desc: "エンジニアリングのための開発ではなく、お客様の業務課題を解決する開発。自分たちで運営するリラクゼーションサロン「チョップ」の現場で毎日使われているものを、そのままプロダクトにしています。",
    accent: "cyan" as const,
  },
  {
    code: "02",
    title: "少数精鋭・個の尊重",
    en: "Small & Autonomous",
    desc: "大企業のような「誰でもできる仕事」ではなく、一人ひとりが裁量を持って自分の色を出せる仕事。フルリモート中心で、時間と場所の拘束は最小限です。",
    accent: "lime" as const,
  },
  {
    code: "03",
    title: "最前線の技術",
    en: "Latest Tech",
    desc: "Claude API・Next.js 16・Supabase など「今の技術」を積極的に採用。書籍・セミナー代補助、AI利用料補助あり。使いたい道具は一緒に揃えていきましょう。",
    accent: "cyan" as const,
  },
  {
    code: "04",
    title: "地方から全国へ",
    en: "Local to Nation",
    desc: "愛知・安城ベースでも、全国の中小企業にサービスを提供。地方にいながらも、最先端のDXに関われます。「地方だから何もない」ではなく「地方だからこそやれる」の発想です。",
    accent: "lime" as const,
  },
];

const ROLES = [
  {
    code: "ROLE_01",
    num: "01",
    title: "エンジニア",
    en: "Engineer",
    summary: "フロント、バック、AI基盤まで。TypeScript + Next.js + Supabase + Claude API を使って、お客様の業務に溶け込むプロダクトを設計・実装します。",
    skills: ["TypeScript", "Next.js", "Supabase", "Tailwind", "Claude API", "Python"],
    note: "未経験の言語・FWも、採用後に一緒に習得できます。",
    accent: "cyan" as const,
  },
  {
    code: "ROLE_02",
    num: "02",
    title: "デザイナー",
    en: "Designer",
    summary: "プロダクトUIから、コーポレートサイト、提案資料、営業資料、映像まで。「現場で働く人が気持ちよく使える」を軸に、機能性と美しさを両立させます。",
    skills: ["UI Design", "Figma", "動画編集", "イラスト", "コピーライティング"],
    note: "Webだけ / グラフィックだけでもOKです。",
    accent: "cyan" as const,
  },
  {
    code: "ROLE_03",
    num: "03",
    title: "DX推進・営業",
    en: "DX Consultant",
    summary: "中小企業の社長・現場責任者と向き合い、課題を整理し、プロダクト導入を設計。テクノロジーの翻訳者として、経営と現場の橋渡し役です。",
    skills: ["ヒアリング", "要件整理", "プロジェクト設計", "業務理解"],
    note: "異業種からのキャリアチェンジ歓迎。業務経験のある方は即戦力として。",
    accent: "lime" as const,
  },
  {
    code: "ROLE_04",
    num: "04",
    title: "それ以外の枠",
    en: "Other",
    summary: "プロダクトの業務運用、カスタマーサポート、採用、総務、経理、マーケティング、SNS運用 — エンジニア以外の仕事もたくさんあります。「やってみたい」があれば、まずはお話しましょう。",
    skills: ["CS", "バックオフィス", "マーケティング", "採用", "経理"],
    note: "未経験OK。主婦・学生・シニアも歓迎します。",
    accent: "lime" as const,
  },
];

const WORK_STYLE = [
  { icon: "🏠", label: "フルリモート中心", desc: "週1出社 or 完全リモートを応相談" },
  { icon: "🕒", label: "時短・時差出勤OK", desc: "子育て・介護・Wワーク最優先" },
  { icon: "💼", label: "副業・複業OK", desc: "他の仕事と並行、むしろ歓迎" },
  { icon: "📚", label: "学習費補助", desc: "書籍・セミナー・資格取得を会社負担" },
  { icon: "🤖", label: "AI利用料補助", desc: "Claude Pro・Cursor 等の支援" },
  { icon: "👕", label: "服装自由", desc: "スーツ不要、Tシャツ可" },
  { icon: "🎂", label: "年齢・経歴不問", desc: "実力と人柄で判断します" },
  { icon: "🍼", label: "家庭優先OK", desc: "子の発熱・学校行事は気兼ねなく" },
];

const FLOW = [
  { step: "01", title: "カジュアル面談", duration: "30〜60分 / オンライン", desc: "まずは雑談から。会社のこと・仕事のこと、なんでも聞いてください。" },
  { step: "02", title: "実務的な対話", duration: "60〜90分", desc: "具体的な仕事内容、スキル、希望をすり合わせ。ポートフォリオや成果物があればぜひ。" },
  { step: "03", title: "条件調整", duration: "1〜2週間", desc: "雇用形態（正社員 / 業務委託 / パート）、勤務条件、報酬を一緒に決めます。" },
  { step: "04", title: "入社 / 業務開始", duration: "応相談", desc: "最短で翌月から。先方のご都合に合わせて柔軟に対応します。" },
];

// ============================================================
//  TopBar
// ============================================================
function TopBar() {
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "1fr auto 1fr",
      alignItems: "center", gap: 24, padding: "18px 32px",
      borderBottom: "1px solid var(--border)",
      background: "rgba(7,9,12,0.7)", backdropFilter: "blur(10px)",
      position: "sticky", top: 0, zIndex: 20,
    }}>
      <div style={{ display: "flex", alignItems: "center" }}>
        <Link href="/corporate" style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none", color: "inherit" }}>
          <div style={{ width: 28, height: 28, border: "1px solid var(--border-2)", borderRadius: 6, display: "grid", placeItems: "center", background: "var(--surface)" }}>
            <div style={{ width: 10, height: 10, borderRadius: 999, background: ACCENT.hex }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", lineHeight: 1 }}>
            <span style={{ fontWeight: 800, letterSpacing: 3, fontSize: 13 }}>TERA DX</span>
            <span style={{ color: "var(--muted)", fontFamily: "var(--font-mono)", fontSize: 10, marginTop: 4, letterSpacing: 1 }}>corporate / careers</span>
          </div>
        </Link>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "center", fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted)" }}>
        <Link href="/corporate" style={{ color: "inherit", textDecoration: "none" }}>corporate</Link>
        <span style={{ color: "var(--dim)" }}>/</span>
        <span style={{ color: "#e6edf3" }}>careers</span>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <Link href="/corporate#contact" style={{
          display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 16px", borderRadius: 999,
          background: `linear-gradient(135deg, ${ACCENT.hex}, #2dc5db)`, color: "#000",
          textDecoration: "none", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: 1.5, fontWeight: 800,
        }}>
          ▸ カジュアル面談
        </Link>
      </div>
    </div>
  );
}

// ============================================================
//  Hero
// ============================================================
function Hero() {
  return (
    <section style={{ padding: "60px 0 40px", borderBottom: "1px solid var(--border)" }}>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "6px 12px", border: "1px solid var(--border-2)", borderRadius: 999, background: "var(--surface)", marginBottom: 28 }}>
        <span style={{ width: 6, height: 6, borderRadius: 999, background: ACCENT.hex }} />
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: 1.5, color: "var(--muted)" }}>CAREERS // JOIN US</span>
      </div>
      <h1 style={{ fontSize: "clamp(38px, 7vw, 68px)", lineHeight: 1.1, letterSpacing: -2, margin: 0, fontWeight: 700 }}>
        地方から、<br />
        <span style={{ color: ACCENT.hex }}>中小企業のDX</span>を。
      </h1>
      <p style={{ color: "var(--muted)", fontSize: 18, lineHeight: 1.8, marginTop: 28, maxWidth: 720 }}>
        「現場で役立つテクノロジー」を一緒に作る仲間を探しています。<br />
        エンジニアも、デザイナーも、営業も、<strong style={{ color: "var(--text)" }}>非エンジニアも大歓迎</strong>。<br />
        まずは30分の雑談から、お気軽にどうぞ。
      </p>

      {/* Stats */}
      <div style={{
        marginTop: 48, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 0,
        border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden", background: "var(--surface)",
      }} className="stats-grid">
        <Stat label="自社プロダクト" value="9" unit="製品" highlight />
        <Stat label="DX支援実績" value="30" unit="社+" />
        <Stat label="リモート率" value="100" unit="%" />
        <Stat label="副業OK" value="◉" unit="" highlight />
      </div>

      {/* Cinematic image band */}
      <div style={{ marginTop: 48, position: "relative", borderRadius: 16, overflow: "hidden", border: "1px solid var(--border)" }}>
        <div style={{ position: "relative", width: "100%", aspectRatio: "21 / 9", background: "#07090c" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/corporate/dx-flow/hero-band.jpg" alt="朝のオフィス" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", filter: "saturate(0.8)" }} />
          <div style={{ position: "absolute", inset: 0, background: `linear-gradient(180deg, rgba(7,9,12,0.4) 0%, rgba(7,9,12,0) 30%, rgba(7,9,12,0) 60%, rgba(7,9,12,0.8) 100%), linear-gradient(90deg, rgba(77,214,232,0.1) 0%, transparent 50%)`, pointerEvents: "none" }} />
          <div style={{ position: "absolute", left: 28, bottom: 24, fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: 2, color: "rgba(230,237,243,0.85)" }}>
            <span style={{ color: ACCENT.hex }}>◉ </span>
            WHERE WE BUILD IT — 愛知県安城市
          </div>
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value, unit, highlight }: { label: string; value: string; unit: string; highlight?: boolean }) {
  return (
    <div style={{ padding: "20px 24px", borderRight: "1px solid var(--border)" }}>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: 1.5, color: "var(--muted)", textTransform: "uppercase" }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 8 }}>
        <span style={{ fontSize: 34, fontWeight: 700, letterSpacing: -1, color: highlight ? ACCENT.hex : "inherit" }}>{value}</span>
        <span style={{ fontSize: 13, color: "var(--muted)", fontFamily: "var(--font-mono)" }}>{unit}</span>
      </div>
    </div>
  );
}

// ============================================================
//  Section Head
// ============================================================
function SectionHead({ tag, title, sub, accent = ACCENT.hex }: { tag: string; title: string; sub?: string; accent?: string }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 10, marginBottom: 14, padding: "4px 12px", border: "1px solid var(--border-2)", borderRadius: 999, background: "var(--surface)" }}>
        <span style={{ width: 6, height: 6, borderRadius: 999, background: accent }} />
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: 2, color: "var(--muted)" }}>{tag}</span>
      </div>
      <h2 style={{ fontSize: "clamp(28px, 4vw, 40px)", fontWeight: 700, letterSpacing: -1, margin: 0 }}>{title}</h2>
      {sub && <p style={{ color: "var(--muted)", fontSize: 16, lineHeight: 1.7, marginTop: 12, maxWidth: 680 }}>{sub}</p>}
    </div>
  );
}

// ============================================================
//  Why Us
// ============================================================
function WhyUsSection() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }} className="why-grid">
      {WHY_US.map((v) => {
        const acc = v.accent === "cyan" ? ACCENT : LIME;
        return (
          <div key={v.code} style={{ padding: 28, borderRadius: 14, border: "1px solid var(--border)", background: "var(--surface)", position: "relative", overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginBottom: 14 }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 48, fontWeight: 700, color: acc.hex, letterSpacing: -2, lineHeight: 1 }}>{v.code}</span>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{v.title}</div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{v.en}</div>
              </div>
            </div>
            <p style={{ fontSize: 14, lineHeight: 1.8, color: "var(--muted)" }}>{v.desc}</p>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
//  Roles
// ============================================================
function RolesSection() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }} className="roles-grid">
      {ROLES.map((r) => {
        const acc = r.accent === "cyan" ? ACCENT : LIME;
        return (
          <div key={r.code} style={{
            padding: 28, borderRadius: 14, border: "1px solid var(--border)",
            background: `linear-gradient(180deg, ${acc.soft} 0%, var(--surface) 40%)`,
            position: "relative", overflow: "hidden",
            transition: "transform 300ms, border-color 300ms, box-shadow 300ms",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = acc.hex; e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = `0 20px 40px -20px ${acc.soft}`; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
              <div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: 1.5, color: acc.hex, marginBottom: 6 }}>{r.code}</div>
                <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.3 }}>{r.title}</div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{r.en}</div>
              </div>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 62, fontWeight: 700, color: "#2a323d", letterSpacing: -2, lineHeight: 1 }}>{r.num}</span>
            </div>
            <p style={{ fontSize: 13, lineHeight: 1.75, color: "var(--muted)", marginBottom: 18 }}>{r.summary}</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
              {r.skills.map((s) => (
                <span key={s} style={{ fontFamily: "var(--font-mono)", fontSize: 10, padding: "3px 8px", borderRadius: 6, background: acc.dim, color: acc.hex, border: `1px solid ${acc.hex}30` }}>{s}</span>
              ))}
            </div>
            <div style={{ fontSize: 12, color: "var(--text)", padding: "10px 12px", borderRadius: 8, background: "var(--bg-2)", border: "1px dashed " + acc.hex + "40" }}>
              <span style={{ color: acc.hex, fontWeight: 700 }}>◉ </span>{r.note}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
//  Open Positions (Supabase)
// ============================================================
function OpenPositions({ jobs, loading }: { jobs: Job[]; loading: boolean }) {
  const [openId, setOpenId] = useState<number | null>(null);
  const typeLabel = (t: string) => t === "full_time" ? "正社員" : t === "part_time" ? "パート" : t === "contract" ? "業務委託" : t === "intern" ? "インターン" : "その他";
  const typeColor = (t: string) => t === "full_time" ? ACCENT.hex : t === "part_time" ? LIME.hex : t === "contract" ? "#f4c261" : "#e879d8";

  return (
    <div>
      {loading ? (
        <div style={{ padding: "60px 0", textAlign: "center", color: "var(--muted)", fontFamily: "var(--font-mono)", fontSize: 12 }}>Loading positions...</div>
      ) : jobs.length === 0 ? (
        <div style={{ padding: "40px 28px", borderRadius: 14, border: "1px dashed var(--border-2)", background: "var(--surface)", textAlign: "center" }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: 2, color: ACCENT.hex, marginBottom: 10 }}>◉ NO FORMAL OPENINGS</div>
          <p style={{ fontSize: 14, color: "var(--text)", marginBottom: 8, lineHeight: 1.7 }}>
            現在、<strong>正式募集中のポジションはありません</strong>。
          </p>
          <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.8 }}>
            とはいえ、「こんな仕事ならできるかも」「話を聞いてみたい」という方は、<br />
            ぜひカジュアル面談でご連絡ください。新しいポジションをご一緒に作れるかもしれません。
          </p>
          <Link href="/corporate#contact" style={{
            display: "inline-block", marginTop: 20, padding: "12px 28px", borderRadius: 999,
            background: ACCENT.hex, color: "#000", fontFamily: "var(--font-mono)", fontSize: 12, letterSpacing: 1.5, fontWeight: 800, textDecoration: "none",
          }}>▸ カジュアル面談を予約する</Link>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {jobs.map((j) => {
            const isOpen = openId === j.id;
            const tc = typeColor(j.job_type);
            return (
              <div key={j.id} style={{ borderRadius: 14, border: "1px solid var(--border)", background: "var(--surface)", overflow: "hidden", transition: "border-color 300ms" }}>
                <button onClick={() => setOpenId(isOpen ? null : j.id)} style={{ width: "100%", padding: "22px 28px", background: "none", border: "none", cursor: "pointer", textAlign: "left", color: "var(--text)", fontFamily: "inherit" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 4, background: `${tc}18`, color: tc, border: `1px solid ${tc}40`, letterSpacing: 1 }}>{typeLabel(j.job_type)}</span>
                    {j.salary_range && <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "#f4c261" }}>◉ {j.salary_range}</span>}
                    {j.location && <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)" }}>◉ {j.location}</span>}
                    <span style={{ marginLeft: "auto", fontSize: 14, color: "var(--muted)", transform: isOpen ? "rotate(180deg)" : "none", transition: "transform 250ms" }}>⌄</span>
                  </div>
                  <h3 style={{ fontSize: 18, fontWeight: 700, color: "var(--text)", lineHeight: 1.4 }}>{j.title}</h3>
                  {j.summary && <p style={{ fontSize: 13, lineHeight: 1.75, color: "var(--muted)", marginTop: 8 }}>{j.summary}</p>}
                </button>
                {isOpen && (
                  <div style={{ padding: "0 28px 24px 28px" }}>
                    <div style={{ borderTop: "1px solid var(--border)", paddingTop: 20, display: "flex", flexDirection: "column", gap: 18 }}>
                      {j.description && (
                        <div>
                          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, color: ACCENT.hex, letterSpacing: 1.5, marginBottom: 8 }}>WORK DESCRIPTION</div>
                          <p style={{ fontSize: 13, lineHeight: 1.85, color: "var(--text)", whiteSpace: "pre-wrap" }}>{j.description}</p>
                        </div>
                      )}
                      {j.requirements && (
                        <div>
                          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, color: LIME.hex, letterSpacing: 1.5, marginBottom: 8 }}>REQUIREMENTS</div>
                          <p style={{ fontSize: 13, lineHeight: 1.85, color: "var(--text)", whiteSpace: "pre-wrap" }}>{j.requirements}</p>
                        </div>
                      )}
                      <Link href="/corporate#contact" style={{ alignSelf: "flex-start", padding: "12px 28px", borderRadius: 999, background: ACCENT.hex, color: "#000", fontFamily: "var(--font-mono)", fontSize: 12, letterSpacing: 1.5, fontWeight: 800, textDecoration: "none" }}>▸ この枠で応募する</Link>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================
//  Work Style
// ============================================================
function WorkStyleSection() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }} className="work-grid">
      {WORK_STYLE.map((w) => (
        <div key={w.label} style={{ padding: 20, borderRadius: 12, border: "1px solid var(--border)", background: "var(--surface)" }}>
          <div style={{ fontSize: 26, marginBottom: 10 }}>{w.icon}</div>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{w.label}</div>
          <div style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.6 }}>{w.desc}</div>
        </div>
      ))}
    </div>
  );
}

// ============================================================
//  Selection Flow
// ============================================================
function FlowSection() {
  return (
    <div style={{ position: "relative" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, position: "relative" }} className="flow-grid">
        {FLOW.map((f, i) => (
          <div key={f.step} style={{ position: "relative", padding: 22, borderRadius: 12, border: "1px solid var(--border)", background: "var(--surface)" }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: 1.5, color: ACCENT.hex, marginBottom: 8 }}>STEP_{f.step}</div>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{f.title}</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)", marginBottom: 10 }}>{f.duration}</div>
            <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.6 }}>{f.desc}</div>
            {i < FLOW.length - 1 && (
              <div className="flow-arrow" style={{ position: "absolute", right: -12, top: "50%", transform: "translateY(-50%)", fontSize: 16, color: "var(--border-2)", zIndex: 2 }}>→</div>
            )}
          </div>
        ))}
      </div>
      <div style={{ marginTop: 24, padding: "18px 22px", borderRadius: 12, border: `1px dashed ${LIME.hex}40`, background: `${LIME.soft.replace("0.14", "0.05")}`, fontSize: 13, color: "var(--text)", lineHeight: 1.8, textAlign: "center" }}>
        <span style={{ color: LIME.hex, fontWeight: 700 }}>◉ </span>
        <strong>STEP_01 だけ</strong>でも大丈夫です。「話を聞きに来た」で終わっても全く問題ありません。
      </div>
    </div>
  );
}

// ============================================================
//  CTA
// ============================================================
function CTASection() {
  return (
    <div style={{ position: "relative", border: "1px solid var(--border-2)", borderRadius: 20, padding: "56px 48px", background: `linear-gradient(135deg, ${ACCENT.soft}, transparent 60%), var(--surface)`, overflow: "hidden" }}>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: 2, color: ACCENT.hex }}>▸ GET_IN_TOUCH</div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 40, marginTop: 16, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 320 }}>
          <div style={{ fontSize: "clamp(28px, 4vw, 40px)", fontWeight: 700, letterSpacing: -1, lineHeight: 1.2 }}>
            まずは<span style={{ color: ACCENT.hex }}>30分の雑談</span>から。<br />話を聞きにくるだけでOKです。
          </div>
          <div style={{ color: "var(--muted)", fontSize: 15, lineHeight: 1.7, marginTop: 18, maxWidth: 560 }}>
            「なんとなく興味がある」「業界のことだけでも聞きたい」「まだ転職するか迷ってる」<br />
            そんな段階で全く大丈夫です。オンライン / 対面どちらでもOK。
          </div>
          <div style={{ marginTop: 22, padding: "14px 16px", borderRadius: 10, border: `1px dashed ${LIME.hex}40`, background: `${LIME.soft.replace("0.14", "0.05")}`, fontSize: 13, color: "var(--text)", lineHeight: 1.7, maxWidth: 560 }}>
            <span style={{ color: LIME.hex, fontWeight: 700 }}>◉ </span>
            エンジニアじゃなくても大丈夫。<strong>主婦・学生・シニア・異業種からの転職</strong>も歓迎です。
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Link href="/corporate#contact" style={{ appearance: "none", border: "none", cursor: "pointer", padding: "16px 28px", borderRadius: 999, background: ACCENT.hex, color: "#000", fontFamily: "var(--font-mono)", fontSize: 12, letterSpacing: 2, fontWeight: 800, textAlign: "center", textDecoration: "none" }}>▸ カジュアル面談を予約</Link>
          <Link href="/corporate/services/dx-implementation-flow" style={{ appearance: "none", cursor: "pointer", padding: "16px 28px", borderRadius: 999, background: "transparent", color: "var(--text)", border: "1px solid var(--border-2)", fontFamily: "var(--font-mono)", fontSize: 12, letterSpacing: 2, textAlign: "center", textDecoration: "none" }}>仕事の中身を見る →</Link>
        </div>
      </div>
    </div>
  );
}

// ============================================================
//  Main page
// ============================================================
export default function CareersPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.from("corporate_jobs").select("*").eq("is_open", true).order("sort_order");
        if (data) setJobs(data as Job[]);
      } catch (e) { console.log("jobs fetch error:", e); }
      setLoading(false);
    })();
  }, []);

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", fontFamily: "var(--font-sans)", color: "var(--text)", background: "var(--bg)" }}>
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
      <style>{`
        :root {
          --bg: #07090c;
          --bg-2: #0a0d12;
          --surface: #0d1117;
          --surface-2: #12171f;
          --border: #1a2029;
          --border-2: #222b37;
          --text: #e6edf3;
          --muted: #7d8590;
          --dim: #4a525c;
          --font-sans: "Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Hiragino Sans", "Yu Gothic UI", system-ui, sans-serif;
          --font-mono: "JetBrains Mono", ui-monospace, Menlo, monospace;
        }
        .careers-page {
          min-height: 100vh;
          background:
            radial-gradient(1200px 600px at 80% -10%, rgba(77,214,232,0.06), transparent 60%),
            radial-gradient(1000px 500px at -10% 110%, rgba(168,235,110,0.04), transparent 60%),
            #07090c;
          overflow-x: hidden;
          position: relative;
        }
        .careers-page::before {
          content: "";
          position: fixed; inset: 0; pointer-events: none; z-index: 0;
          background-image:
            linear-gradient(to right, rgba(255,255,255,0.015) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255,255,255,0.015) 1px, transparent 1px);
          background-size: 48px 48px;
          mask-image: radial-gradient(ellipse at center, black 40%, transparent 85%);
          -webkit-mask-image: radial-gradient(ellipse at center, black 40%, transparent 85%);
        }
        .careers-page > * { position: relative; z-index: 1; }
        ::selection { background: #4dd6e8; color: #000; }
        button:focus-visible { outline: 2px solid #4dd6e8; outline-offset: 2px; }

        @media (max-width: 900px) {
          .stats-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .why-grid, .roles-grid { grid-template-columns: 1fr !important; }
          .work-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .flow-grid { grid-template-columns: 1fr !important; gap: 14px !important; }
          .flow-arrow { display: none !important; }
        }
      `}</style>

      <div className="careers-page">
        <TopBar />

        <main style={{ maxWidth: 1240, margin: "0 auto", padding: "40px 32px 80px", width: "100%" }}>
          <Hero />

          <div style={{ marginTop: 100 }}>
            <SectionHead
              tag="WHY US"
              title="なぜ、ここで働くのか"
              sub="大企業にはない裁量と、地方ならではの顔の見える仕事。自分たちが作ったものを、自分たちの現場で使う。その距離感が、私たちの強みです。"
            />
            <WhyUsSection />
          </div>

          <div style={{ marginTop: 100 }}>
            <SectionHead
              tag="OPEN ROLES"
              title="募集している枠"
              sub="エンジニア・デザイナー・DX推進・営業が中心ですが、それ以外の仕事もあります。「自分はどれ？」と迷ったら、まず話に来てください。"
              accent={LIME.hex}
            />
            <RolesSection />
          </div>

          <div style={{ marginTop: 100 }}>
            <SectionHead
              tag="OPEN POSITIONS"
              title="現在の募集ポジション"
              sub="正式に募集中の枠は下記です。該当しなくても、カジュアル面談でお話できる枠を作れる場合があります。"
            />
            <OpenPositions jobs={jobs} loading={loading} />
          </div>

          <div style={{ marginTop: 100 }}>
            <SectionHead
              tag="WORK STYLE"
              title="働き方・制度"
              sub="時間と場所に縛られず、一人ひとりのライフステージに合わせた働き方ができます。"
              accent={LIME.hex}
            />
            <WorkStyleSection />
          </div>

          <div style={{ marginTop: 100 }}>
            <SectionHead
              tag="SELECTION PROCESS"
              title="選考の流れ"
              sub="形式張った面接はしません。4ステップで、ゆっくりお互いを知っていきましょう。"
            />
            <FlowSection />
          </div>

          <div style={{ marginTop: 100 }}>
            <CTASection />
          </div>

          <footer style={{ marginTop: 60, paddingTop: 32, borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "flex-end", fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted)", flexWrap: "wrap", gap: 20 }}>
            <div>
              <div style={{ color: "var(--text)", fontSize: 16, letterSpacing: 4, fontWeight: 700 }}>TERA DX</div>
              <div style={{ marginTop: 6, lineHeight: 1.6 }}>careers — join us from anywhere.<br />中小企業から個人様まで、お気軽に。</div>
            </div>
            <div style={{ textAlign: "right", lineHeight: 1.8 }}>
              <div>© {new Date().getFullYear()} 合同会社テラスライフ</div>
              <div>/ careers build r1</div>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
}
