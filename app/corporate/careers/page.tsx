"use client";
/* ═══════════════════════════════════════════════════════════════════
   採用ページ / careers
   /corporate/careers
   
   DX導入フローと統一感のある暗シネマ調デザイン
   Claude Design 版の良い部分を統合:
   - MISSION を最上位に
   - ABOUT セクション (会社紹介+facts)
   - PERSONA セクション (求める人物像)
   - OPEN POSITIONS を4雇用形態タブ化
   - 5ステップ選考フロー
   - FAQ セクション
   ═══════════════════════════════════════════════════════════════════ */

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  RECRUIT_MISSION,
  RECRUIT_COMPANY,
  WHY_US,
  PERSONA,
  ROLES,
  POSITIONS,
  WORK_STYLE,
  PROCESS,
  RECRUIT_FAQ,
  type Position,
} from "./data";

// ===== Accent =====
const ACCENT = { hex: "#4dd6e8", soft: "rgba(77,214,232,0.14)", dim: "#0f2a30" };
const LIME   = { hex: "#a8eb6e", soft: "rgba(168,235,110,0.14)", dim: "#1e2a10" };

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
            <span style={{ color: "var(--muted)", fontFamily: "var(--font-mono)", fontSize: 10, marginTop: 4, letterSpacing: 1 }}>corporate / recruit</span>
          </div>
        </Link>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "center", fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted)" }}>
        <Link href="/corporate" style={{ color: "inherit", textDecoration: "none" }}>corporate</Link>
        <span style={{ color: "var(--dim)" }}>/</span>
        <span style={{ color: "#e6edf3" }}>recruit</span>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
        <Link href="/corporate/services/dx-implementation-flow" style={{ display: "none" }} className="nav-dx-link">DX導入フロー →</Link>
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
//  Hero (Mission先頭)
// ============================================================
function Hero() {
  const m = RECRUIT_MISSION;
  return (
    <section style={{ padding: "80px 0 60px", borderBottom: "1px solid var(--border)" }}>
      {/* Kicker */}
      <div style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "6px 12px", border: "1px solid var(--border-2)", borderRadius: 999, background: "var(--surface)", marginBottom: 24 }}>
        <span style={{ width: 6, height: 6, borderRadius: 999, background: ACCENT.hex }} />
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: 1.5, color: "var(--muted)" }}>RECRUIT // 2026 OPEN POSITIONS</span>
      </div>
      {/* MISSION label */}
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: 3, color: ACCENT.hex, marginBottom: 20 }}>▸ {m.tagline}</div>
      {/* 引用風 main message */}
      <h1 style={{ fontSize: "clamp(36px, 6.5vw, 64px)", lineHeight: 1.15, letterSpacing: -2, margin: 0, fontWeight: 700 }}>
        {m.main.map((ln, i) => (
          <span key={i} style={{ display: "block", color: i === m.main.length - 1 ? ACCENT.hex : "var(--text)" }}>
            {ln}
          </span>
        ))}
      </h1>
      {/* body */}
      <div style={{ color: "var(--muted)", fontSize: 17, lineHeight: 1.85, marginTop: 28, maxWidth: 640 }}>
        {m.body.map((ln, i) => <div key={i}>{ln}</div>)}
      </div>
      <div style={{ marginTop: 24, fontSize: 14, color: "var(--text)", maxWidth: 640, lineHeight: 1.85 }}>
        <strong style={{ color: ACCENT.hex }}>非エンジニアも大歓迎。</strong> まずは30分の雑談から、お気軽にどうぞ。
      </div>
      {/* CTA */}
      <div style={{ marginTop: 36, display: "flex", gap: 12, flexWrap: "wrap" }}>
        <a href="#jobs" style={{
          display: "inline-flex", alignItems: "center", gap: 8, padding: "14px 28px", borderRadius: 999,
          background: ACCENT.hex, color: "#000", fontFamily: "var(--font-mono)", fontSize: 12, letterSpacing: 1.5, fontWeight: 800, textDecoration: "none",
        }}>▸ 募集職種を見る</a>
        <Link href="/corporate#contact" style={{
          display: "inline-flex", alignItems: "center", gap: 8, padding: "14px 28px", borderRadius: 999,
          background: "transparent", color: "var(--text)", border: "1px solid var(--border-2)",
          fontFamily: "var(--font-mono)", fontSize: 12, letterSpacing: 1.5, textDecoration: "none",
        }}>カジュアル面談 (30分)</Link>
      </div>
    </section>
  );
}

// ============================================================
//  About (会社紹介 + facts)
// ============================================================
function About() {
  const c = RECRUIT_COMPANY;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 40, alignItems: "stretch" }} className="about-grid">
      <div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: 2, color: ACCENT.hex, marginBottom: 12 }}>{c.code}</div>
        <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: -0.5 }}>{c.name}</div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted)", marginTop: 4, letterSpacing: 1 }}>{c.nameEn}</div>
        <p style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.85, marginTop: 22 }}>{c.intro}</p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 0, border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden", background: "var(--surface)" }}>
        {c.facts.map((f, i) => (
          <div key={f.label} style={{
            padding: "22px 20px",
            borderRight: i % 2 === 0 ? "1px solid var(--border)" : "none",
            borderBottom: i < 2 ? "1px solid var(--border)" : "none",
          }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: 1.5, color: "var(--muted)", textTransform: "uppercase" }}>{f.label}</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 8 }}>
              <span style={{ fontSize: 30, fontWeight: 700, letterSpacing: -1, color: f.highlight ? ACCENT.hex : "inherit" }}>{f.value}</span>
              <span style={{ fontSize: 12, color: "var(--muted)", fontFamily: "var(--font-mono)" }}>{f.unit}</span>
            </div>
          </div>
        ))}
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
//  Persona (求める人物像)
// ============================================================
function PersonaSection() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }} className="persona-grid">
      {PERSONA.map((p, i) => {
        const acc = i % 2 === 0 ? ACCENT : LIME;
        return (
          <div key={p.title} style={{ padding: 24, borderRadius: 12, border: "1px solid var(--border)", background: "var(--surface)" }}>
            <div style={{ fontSize: 32, color: acc.hex, marginBottom: 12, fontFamily: "var(--font-mono)", lineHeight: 1 }}>{p.icon}</div>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>{p.title}</div>
            <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.7 }}>{p.body}</div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
//  Roles (仕事の種類)
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
            <div style={{ fontSize: 12, color: "var(--text)", padding: "10px 12px", borderRadius: 8, background: "var(--bg-2)", border: `1px dashed ${acc.hex}40` }}>
              <span style={{ color: acc.hex, fontWeight: 700 }}>◉ </span>{r.note}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
//  Open Positions (雇用形態タブ)
// ============================================================
function PositionsSection() {
  const [activeId, setActiveId] = useState<string>(POSITIONS[0].id);
  const active = POSITIONS.find((p) => p.id === activeId) || POSITIONS[0];

  return (
    <div>
      {/* Tabs */}
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${POSITIONS.length}, 1fr)`, gap: 8, marginBottom: 16 }} className="position-tabs">
        {POSITIONS.map((j) => {
          const isActive = j.id === activeId;
          return (
            <button
              key={j.id}
              onClick={() => setActiveId(j.id)}
              style={{
                appearance: "none", cursor: "pointer", textAlign: "center",
                padding: "14px 12px", borderRadius: 12,
                border: `1px solid ${isActive ? ACCENT.hex : "var(--border)"}`,
                background: isActive ? `linear-gradient(180deg, ${ACCENT.soft}, var(--surface) 70%)` : "var(--surface)",
                color: isActive ? "var(--text)" : "var(--muted)",
                boxShadow: isActive ? `0 0 0 1px ${ACCENT.hex}, 0 16px 32px -20px ${ACCENT.soft}` : "none",
                transition: "all 300ms cubic-bezier(.2,.8,.2,1)",
                fontFamily: "inherit",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
              }}
            >
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: 1.5, color: isActive ? ACCENT.hex : "var(--dim)", fontWeight: 700 }}>{j.tag}</span>
              <span style={{ fontSize: 14, fontWeight: 700 }}>{j.type}</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)" }}>{j.typeEn}</span>
            </button>
          );
        })}
      </div>

      {/* Detail Panel */}
      <PositionDetail key={active.id} position={active} />
    </div>
  );
}

function PositionDetail({ position: p }: { position: Position }) {
  return (
    <div style={{
      border: "1px solid var(--border)", borderRadius: 16, padding: 36,
      background: "var(--surface)",
      animation: "fadeSlideUp 400ms cubic-bezier(.2,.8,.2,1) both",
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 20, flexWrap: "wrap", marginBottom: 20 }}>
        <div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: 1.5, color: ACCENT.hex, marginBottom: 8 }}>{p.code}</div>
          <h3 style={{ fontSize: "clamp(22px, 3vw, 28px)", fontWeight: 700, letterSpacing: -0.5, margin: 0, display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
            {p.title}
            <span style={{ padding: "3px 10px", fontSize: 11, borderRadius: 6, background: ACCENT.dim, color: ACCENT.hex, border: `1px solid ${ACCENT.hex}40`, fontFamily: "var(--font-mono)", fontWeight: 600, letterSpacing: 1 }}>
              {p.type}
            </span>
          </h3>
        </div>
        <Link href="/corporate#contact" style={{
          padding: "12px 24px", borderRadius: 999, background: ACCENT.hex, color: "#000",
          fontFamily: "var(--font-mono)", fontSize: 12, letterSpacing: 1.5, fontWeight: 800,
          textDecoration: "none", whiteSpace: "nowrap",
        }}>▸ この職種に応募</Link>
      </div>

      {/* Summary */}
      <p style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.85, maxWidth: 800, marginBottom: 28 }}>{p.summary}</p>

      {/* Meta Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 1, borderRadius: 12, overflow: "hidden", border: "1px solid var(--border)", background: "var(--border)", marginBottom: 24 }} className="meta-grid">
        {[
          { label: "報酬",     value: p.salary    },
          { label: "勤務地",   value: p.location  },
          { label: "働き方",   value: p.workStyle },
          { label: "契約期間", value: p.commit    },
        ].map((m) => (
          <div key={m.label} style={{ padding: "16px 18px", background: "var(--bg-2)" }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: 1.5, color: "var(--muted)", textTransform: "uppercase", marginBottom: 6 }}>{m.label}</div>
            <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.5 }}>{m.value}</div>
          </div>
        ))}
      </div>

      {/* Highlights */}
      <div style={{ marginBottom: 24, padding: "16px 20px", borderRadius: 10, border: `1px dashed ${LIME.hex}40`, background: `${LIME.soft.replace("0.14", "0.05")}` }}>
        {p.highlights.map((h, i) => (
          <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "4px 0", fontSize: 13, color: "var(--text)", lineHeight: 1.7 }}>
            <span style={{ color: LIME.hex, flexShrink: 0 }}>◉</span>
            <span>{h}</span>
          </div>
        ))}
      </div>

      {/* Body Grid: Duties / Musts / Wants */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }} className="body-grid">
        <JobBlock title="仕事内容" items={p.duties} accent={ACCENT.hex} tag="DUTIES" />
        <JobBlock title="必須要件" items={p.musts}  accent={LIME.hex}   tag="MUST HAVE" />
        <JobBlock title="歓迎要件" items={p.wants}  accent="var(--muted)" tag="NICE TO HAVE" />
      </div>
    </div>
  );
}

function JobBlock({ title, items, accent, tag }: { title: string; items: string[]; accent: string; tag: string }) {
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 18, background: "var(--bg-2)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: 1.5, color: accent, fontWeight: 700 }}>{tag}</span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--dim)" }}>{items.length}</span>
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>{title}</div>
      <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
        {items.map((it, i) => (
          <li key={i} style={{ display: "flex", gap: 8, fontSize: 12, lineHeight: 1.6, color: "var(--muted)" }}>
            <span style={{ color: accent, flexShrink: 0 }}>▪</span>
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ============================================================
//  Work Style
// ============================================================
function WorkStyleSection() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }} className="work-grid">
      {WORK_STYLE.map((w, i) => {
        const acc = i % 2 === 0 ? ACCENT : LIME;
        const num = String(i + 1).padStart(2, "0");
        return (
          <div key={w.label} style={{
            padding: "22px 20px", borderRadius: 12,
            border: "1px solid var(--border)", background: "var(--surface)",
            position: "relative", overflow: "hidden",
          }}>
            {/* Left accent bar */}
            <div style={{
              position: "absolute", left: 0, top: 0, bottom: 0, width: 2,
              background: acc.hex,
              opacity: 0.6,
            }} />
            {/* Mono tag */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <span style={{ width: 6, height: 6, borderRadius: 999, background: acc.hex }} />
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: 1.5, color: acc.hex, fontWeight: 600 }}>
                BENEFIT_{num}
              </span>
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6, letterSpacing: -0.2 }}>{w.label}</div>
            <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.7 }}>{w.desc}</div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
//  Process (5 steps timeline)
// ============================================================
function ProcessSection() {
  return (
    <div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {PROCESS.map((p, i) => (
          <div key={p.num} style={{ display: "flex", gap: 18, alignItems: "stretch" }} className="process-row">
            {/* Timeline node + line */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 48, flexShrink: 0 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 999,
                display: "grid", placeItems: "center",
                border: `2px solid ${ACCENT.hex}`,
                background: i === 0 ? ACCENT.hex : ACCENT.dim,
                color: i === 0 ? "#000" : ACCENT.hex,
                fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 13,
                boxShadow: i === 0 ? `0 0 0 6px ${ACCENT.soft}` : "none",
              }}>{p.num}</div>
              {i < PROCESS.length - 1 && (
                <div style={{ flex: 1, width: 2, background: "var(--border-2)", marginTop: 4, marginBottom: -4, minHeight: 24 }} />
              )}
            </div>
            {/* Card */}
            <div style={{ flex: 1, padding: "18px 22px", borderRadius: 12, border: "1px solid var(--border)", background: "var(--surface)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8, marginBottom: 6 }}>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{p.title}</div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)" }}>◷ {p.duration}</div>
              </div>
              <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.75 }}>{p.body}</div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 24, padding: "18px 22px", borderRadius: 12, border: `1px dashed ${LIME.hex}40`, background: `${LIME.soft.replace("0.14", "0.05")}`, fontSize: 13, color: "var(--text)", lineHeight: 1.8, textAlign: "center" }}>
        <span style={{ color: LIME.hex, fontWeight: 700 }}>◉ </span>
        <strong>STEP_02 (カジュアル面談) だけ</strong>でも大丈夫です。「話を聞きに来た」で終わっても全く問題ありません。
      </div>
    </div>
  );
}

// ============================================================
//  FAQ
// ============================================================
function FAQSection() {
  const [open, setOpen] = useState(0);
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 16, background: "var(--surface)", overflow: "hidden" }}>
      {RECRUIT_FAQ.map((f, i) => {
        const isOpen = open === i;
        return (
          <div key={i} style={{ borderTop: i === 0 ? "none" : "1px solid var(--border)" }}>
            <button
              onClick={() => setOpen(isOpen ? -1 : i)}
              style={{ width: "100%", appearance: "none", background: "transparent", color: "var(--text)", border: "none", cursor: "pointer", padding: "20px 24px", textAlign: "left", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, fontFamily: "inherit" }}
            >
              <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: ACCENT.hex, minWidth: 36 }}>Q.{String(i + 1).padStart(2, "0")}</span>
                <span style={{ fontSize: 15, fontWeight: 600, textAlign: "left" }}>{f.q}</span>
              </div>
              <span style={{ color: isOpen ? ACCENT.hex : "var(--muted)", fontSize: 16, fontFamily: "var(--font-mono)", transition: "transform 200ms", transform: isOpen ? "rotate(45deg)" : "none" }}>+</span>
            </button>
            <div style={{ maxHeight: isOpen ? 300 : 0, overflow: "hidden", transition: "max-height 400ms cubic-bezier(.2,.8,.2,1)" }}>
              <div style={{ padding: "0 24px 20px 76px", color: "var(--muted)", fontSize: 14, lineHeight: 1.8 }}>{f.a}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
//  CTA
// ============================================================
function CTASection() {
  return (
    <div style={{ position: "relative", border: "1px solid var(--border-2)", borderRadius: 20, padding: "56px 48px", background: `linear-gradient(135deg, ${ACCENT.soft}, transparent 60%), var(--surface)`, overflow: "hidden" }} id="contact">
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
  // 初期表示を #jobs に飛ぶとき用
  useEffect(() => {
    if (typeof window !== "undefined" && window.location.hash === "#jobs") {
      const el = document.getElementById("jobs");
      if (el) el.scrollIntoView({ behavior: "smooth" });
    }
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
        @keyframes fadeSlideUp { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
        html { scroll-behavior: smooth; }

        @media (max-width: 900px) {
          .about-grid { grid-template-columns: 1fr !important; }
          .why-grid, .roles-grid { grid-template-columns: 1fr !important; }
          .persona-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .work-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .position-tabs { grid-template-columns: repeat(2, 1fr) !important; }
          .meta-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .body-grid { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 500px) {
          .persona-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <div className="careers-page">
        <TopBar />

        <main style={{ maxWidth: 1240, margin: "0 auto", padding: "40px 32px 80px", width: "100%" }}>
          <Hero />

          <div style={{ marginTop: 100 }}>
            <SectionHead tag="ABOUT" title="私たちについて" />
            <About />
          </div>

          <div style={{ marginTop: 100 }}>
            <SectionHead
              tag="VALUES"
              title="大切にしていること"
              sub="日々の判断のよりどころとなる、私たちの4つの価値観。大企業にはない裁量と、地方ならではの顔の見える仕事が、私たちの強みです。"
            />
            <WhyUsSection />
          </div>

          <div style={{ marginTop: 100 }}>
            <SectionHead
              tag="WHO WE LOOK FOR"
              title="求める人物像"
              sub="スキルより大事にしている、4つの姿勢があります。どれも入社後に磨けるものです。"
              accent={LIME.hex}
            />
            <PersonaSection />
          </div>

          <div style={{ marginTop: 100 }}>
            <SectionHead
              tag="WORK VARIETY"
              title="仕事の種類"
              sub="エンジニア・デザイナー・DX推進・営業が中心ですが、それ以外の仕事もあります。「自分はどれ？」と迷ったら、まず話に来てください。"
            />
            <RolesSection />
          </div>

          <div style={{ marginTop: 100 }} id="jobs">
            <SectionHead
              tag="OPEN POSITIONS // 4 TYPES"
              title="募集雇用形態"
              sub="どの職種も、正社員・業務委託・パート・インターンの4形態から選べます。あなたの生活に合う働き方を選んでください。"
              accent={LIME.hex}
            />
            <PositionsSection />
          </div>

          <div style={{ marginTop: 100 }}>
            <SectionHead
              tag="WORK STYLE"
              title="働き方・制度"
              sub="時間と場所に縛られず、一人ひとりのライフステージに合わせた働き方ができます。"
            />
            <WorkStyleSection />
          </div>

          <div style={{ marginTop: 100 }}>
            <SectionHead
              tag="SELECTION PROCESS // 5 STEPS"
              title="選考フロー"
              sub="形式張った面接はしません。5ステップで、ゆっくりお互いを知っていきましょう。オファーまで平均3〜4週間です。"
              accent={LIME.hex}
            />
            <ProcessSection />
          </div>

          <div style={{ marginTop: 100 }}>
            <SectionHead tag="FAQ" title="よくあるご質問" />
            <FAQSection />
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
              <div>/ careers build r2</div>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
}
