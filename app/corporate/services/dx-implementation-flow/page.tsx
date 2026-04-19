"use client";
/* ═══════════════════════════════════════════════════════════════════
   DX導入フロー / dx_implementation_flow
   /corporate/services/dx-implementation-flow
   
   Claude Design 成果物を Next.js に移植
   TERA AI / TERA DX / TERA Cloud の3ラインを統合
   ═══════════════════════════════════════════════════════════════════ */

import { useState, useEffect, type Dispatch, type SetStateAction } from "react";
import Link from "next/link";
import {
  DX_STEPS,
  DX_TRENDS,
  DX_COST,
  DX_CASES,
  DX_FAQ,
  DX_PRODUCTS,
  type Step,
} from "./data";

// ===== Accent palette =====
const ACCENT_MAP = {
  cyan:    { hex: "#4dd6e8", soft: "rgba(77,214,232,0.14)",  dim: "#0f2a30" },
  lime:    { hex: "#a8eb6e", soft: "rgba(168,235,110,0.14)", dim: "#1e2a10" },
  magenta: { hex: "#e879d8", soft: "rgba(232,121,216,0.14)", dim: "#2a1128" },
  amber:   { hex: "#f4c261", soft: "rgba(244,194,97,0.14)",  dim: "#2a2010" },
};
type AccentKey = keyof typeof ACCENT_MAP;

// ============================================================
//  Segmented toggle (共通)
// ============================================================
function Segmented<T extends string>({
  value, onChange, options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { v: T; label: string }[];
}) {
  return (
    <div style={{ display: "inline-flex", padding: 3, border: "1px solid var(--border-2)", borderRadius: 999, background: "var(--surface)", gap: 2 }}>
      {options.map(o => (
        <button
          key={o.v}
          onClick={() => onChange(o.v)}
          style={{
            appearance: "none", background: value === o.v ? "var(--surface-2)" : "transparent",
            color: value === o.v ? "var(--text)" : "var(--muted)", border: "none",
            padding: "6px 14px", borderRadius: 999, cursor: "pointer",
            fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase",
            boxShadow: value === o.v ? "0 0 0 1px var(--border-2)" : "none",
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ============================================================
//  TopBar
// ============================================================
function TopBar({ layout, setLayout, accentKey }: {
  layout: "grid" | "timeline"; setLayout: (v: "grid" | "timeline") => void; accentKey: AccentKey;
}) {
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
            <div style={{ width: 10, height: 10, borderRadius: 999, background: ACCENT_MAP[accentKey].hex }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", lineHeight: 1 }}>
            <span style={{ fontWeight: 800, letterSpacing: 3, fontSize: 13 }}>TERA DX</span>
            <span style={{ color: "var(--muted)", fontFamily: "var(--font-mono)", fontSize: 10, marginTop: 4, letterSpacing: 1 }}>corporate / dx_playbook</span>
          </div>
        </Link>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "center", fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted)" }}>
        <Link href="/corporate" style={{ color: "inherit", textDecoration: "none" }}>corporate</Link>
        <span style={{ color: "var(--dim)" }}>/</span>
        <span>services</span>
        <span style={{ color: "var(--dim)" }}>/</span>
        <span style={{ color: "#e6edf3" }}>dx_implementation_flow</span>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <Segmented value={layout} onChange={setLayout} options={[{ v: "grid", label: "Card" }, { v: "timeline", label: "Timeline" }]} />
      </div>
    </div>
  );
}

// ============================================================
//  Hero
// ============================================================
function Hero({ accentKey }: { accentKey: AccentKey }) {
  const accent = ACCENT_MAP[accentKey];
  return (
    <section style={{ padding: "60px 0 40px", borderBottom: "1px solid var(--border)" }}>
      <div style={{
        display: "inline-flex", alignItems: "center", gap: 10, padding: "6px 12px",
        border: "1px solid var(--border-2)", borderRadius: 999, background: "var(--surface)", marginBottom: 28,
      }}>
        <span style={{ width: 6, height: 6, borderRadius: 999, background: accent.hex }} />
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: 1.5, color: "var(--muted)" }}>DX_IMPLEMENTATION // v2.5</span>
      </div>
      <h1 style={{ fontSize: "clamp(42px, 7vw, 72px)", lineHeight: 1.05, letterSpacing: -2, margin: 0, fontWeight: 700 }}>
        中小企業のための<br />
        <span style={{ color: accent.hex }}>DX導入フロー</span>
      </h1>
      <p style={{ color: "var(--muted)", fontSize: 18, lineHeight: 1.7, marginTop: 28, maxWidth: 720 }}>
        ヒアリングから運用まで、5つのフェーズで事業変革を伴走します。<br />
        テクノロジー導入ではなく、業務定着までを成果指標に据えた実装モデル。
      </p>
      <div style={{
        marginTop: 48, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 0,
        border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden", background: "var(--surface)",
      }}>
        <Stat label="平均導入期間" value="3" unit="ヶ月" />
        <Stat label="生産効率向上" value="20〜70" unit="%" highlight={accent.hex} />
        <Stat label="継続伴走期間" value="12" unit="ヶ月〜" />
        <Stat label="支援実績" value="30" unit="社+" />
      </div>

      {/* ===== Cinematic hero band ===== */}
      <div style={{ marginTop: 48, position: "relative", borderRadius: 16, overflow: "hidden", border: "1px solid var(--border)" }}>
        <div style={{ position: "relative", width: "100%", aspectRatio: "21 / 9", background: "#07090c" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/corporate/dx-flow/hero-band.jpg" alt="中小企業のオフィスの朝" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", filter: "saturate(0.85)" }} />
          {/* 暗部シアン寄せ＋上下グラデで dark テーマに馴染ませる */}
          <div style={{ position: "absolute", inset: 0, background: `linear-gradient(180deg, rgba(7,9,12,0.35) 0%, rgba(7,9,12,0) 30%, rgba(7,9,12,0) 70%, rgba(7,9,12,0.65) 100%), linear-gradient(90deg, rgba(77,214,232,0.08) 0%, transparent 50%)`, pointerEvents: "none" }} />
          {/* 左下にキャプション */}
          <div style={{ position: "absolute", left: 28, bottom: 24, fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: 2, color: "rgba(230,237,243,0.75)" }}>
            <span style={{ color: accent.hex }}>◉ </span>
            A QUIET MORNING BEFORE TRANSFORMATION
          </div>
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value, unit, highlight }: { label: string; value: string; unit: string; highlight?: string }) {
  return (
    <div style={{ padding: "20px 24px", borderRight: "1px solid var(--border)" }}>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: 1.5, color: "var(--muted)", textTransform: "uppercase" }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 8 }}>
        <span style={{ fontSize: 34, fontWeight: 700, letterSpacing: -1, color: highlight ?? "inherit" }}>{value}</span>
        <span style={{ fontSize: 13, color: "var(--muted)", fontFamily: "var(--font-mono)" }}>{unit}</span>
      </div>
    </div>
  );
}

// ============================================================
//  Philosophy block — 「人にしかできない仕事」という理念
// ============================================================
function PhilosophyBlock({ accentKey }: { accentKey: AccentKey }) {
  const accent = ACCENT_MAP[accentKey];
  return (
    <section style={{ marginTop: 80, padding: "56px 48px", borderRadius: 20, background: `linear-gradient(135deg, ${accent.soft}, transparent 70%), var(--surface)`, border: "1px solid var(--border)" }}>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: 2, color: accent.hex, marginBottom: 20 }}>▸ OUR PHILOSOPHY</div>
      <div style={{ display: "grid", gridTemplateColumns: "1.15fr 1fr", gap: 40, alignItems: "stretch" }} className="philosophy-grid">
        <div>
          <div style={{ fontSize: "clamp(28px, 4.5vw, 44px)", fontWeight: 700, letterSpacing: -1, lineHeight: 1.35 }}>
            人には、<span style={{ color: accent.hex }}>人にしかできない仕事</span>がある。<br />
            機械に任せられる作業は機械に戻し、<br />
            <span style={{ color: "var(--muted)" }}>時間を本当に価値のある仕事に返す。</span>
          </div>
          <div style={{ marginTop: 28, fontSize: 13, color: "var(--muted)", lineHeight: 1.8 }}>
            DXの目的は「IT化」ではありません。人為的ミスをゼロに近づけ、生産効率を
            <span style={{ color: accent.hex, fontWeight: 700 }}> 20〜最大70% </span>
            向上させることで、人の時間を「人にしかできない仕事」に戻すことです。
          </div>
        </div>
        {/* ポートレート画像：窓際で対話する2人 */}
        <div style={{ position: "relative", borderRadius: 14, overflow: "hidden", border: "1px solid var(--border)", minHeight: 280 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/corporate/dx-flow/philosophy.jpg" alt="対話する2人の社員" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", position: "absolute", inset: 0, filter: "saturate(0.85)" }} />
          {/* 暗部なじませオーバーレイ */}
          <div style={{ position: "absolute", inset: 0, background: `linear-gradient(180deg, transparent 0%, transparent 60%, rgba(7,9,12,0.7) 100%), linear-gradient(135deg, transparent 0%, rgba(77,214,232,0.06) 100%)`, pointerEvents: "none" }} />
          {/* キャプション */}
          <div style={{ position: "absolute", left: 20, bottom: 16, fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: 2, color: "rgba(230,237,243,0.8)" }}>
            ◉ DIALOGUE, JUDGMENT, IDEAS
          </div>
        </div>
      </div>
      <div style={{ marginTop: 40, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
        <div style={{ padding: 24, border: "1px solid var(--border)", borderRadius: 14, background: "var(--bg-2)" }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: 2, color: "var(--muted)", marginBottom: 10 }}>MACHINES ARE GOOD AT</div>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 10 }}>機械が得意なこと</div>
          <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.7 }}>
            繰り返しの転記・集計・分類・計算・スケジュール調整・書類作成・通知送信
          </div>
        </div>
        <div style={{ padding: 24, border: `1px solid ${accent.hex}`, borderRadius: 14, background: `linear-gradient(180deg, ${accent.soft}, var(--bg-2))` }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: 2, color: accent.hex, marginBottom: 10 }}>HUMANS SHINE AT</div>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 10 }}>人が輝く仕事</div>
          <div style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.7 }}>
            お客様との対話 / 現場の判断 / 改善のアイデア / 新しい価値の創造 / 仲間への気遣い
          </div>
        </div>
      </div>
    </section>
  );
}

// ============================================================
//  Card grid (5 steps)
// ============================================================
function CardGrid({ steps, activeIdx, setActiveIdx, accentKey }: {
  steps: Step[]; activeIdx: number; setActiveIdx: (i: number) => void; accentKey: AccentKey;
}) {
  return (
    <div style={{ marginTop: 56, display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12 }} className="card-grid">
      {steps.map((s, i) => (
        <StepCard key={s.id} step={s} index={i} total={steps.length} active={i === activeIdx} onActivate={() => setActiveIdx(i)} accentKey={accentKey} />
      ))}
    </div>
  );
}

function StepCard({ step, index, active, onActivate, total, accentKey }: {
  step: Step; index: number; total: number; active: boolean; onActivate: () => void; accentKey: AccentKey;
}) {
  const accent = ACCENT_MAP[accentKey];
  return (
    <button
      onClick={onActivate}
      style={{
        position: "relative", appearance: "none", textAlign: "left", color: "var(--text)",
        padding: "20px 18px 18px", borderRadius: 14,
        border: `1px solid ${active ? accent.hex : "var(--border)"}`,
        background: active ? `linear-gradient(180deg, ${accent.soft} 0%, var(--surface) 55%)` : "var(--surface)",
        boxShadow: active ? `0 0 0 1px ${accent.hex}, 0 20px 40px -20px ${accent.soft}` : "0 1px 0 rgba(255,255,255,0.03) inset",
        transform: active ? "translateY(-2px)" : "translateY(0)",
        cursor: "pointer", display: "flex", flexDirection: "column", gap: 14, minHeight: 300,
        transition: "transform 300ms cubic-bezier(.2,.8,.2,1), background 300ms, border-color 300ms, box-shadow 300ms",
        overflow: "hidden", fontFamily: "inherit",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: 1.5 }}>
        <span style={{ textTransform: "uppercase", color: active ? accent.hex : "var(--muted)" }}>{step.code}</span>
        <span style={{ color: "var(--dim)" }}>{String(index + 1).padStart(2, "0")}/{String(total).padStart(2, "0")}</span>
      </div>
      <div style={{ display: "flex", alignItems: "flex-start" }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 68, fontWeight: 700, lineHeight: 1, letterSpacing: -2, color: active ? accent.hex : "#2a323d", transition: "color 300ms" }}>
          {step.num}
        </span>
      </div>
      <div>
        <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.5 }}>{step.title}</div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)", marginTop: 4, letterSpacing: 1 }}>{step.en}</div>
      </div>
      <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.6, flex: 1 }}>{step.summary}</div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 12, borderTop: "1px solid var(--border)" }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)" }}>◷ {step.duration}</span>
        <span style={{ fontSize: 16, color: active ? accent.hex : "var(--muted)", transform: active ? "translateX(2px)" : "none", transition: "transform 200ms, color 200ms" }}>→</span>
      </div>
      {active && <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: accent.hex }} />}
    </button>
  );
}

// ============================================================
//  Timeline view
// ============================================================
function Timeline({ steps, activeIdx, setActiveIdx, accentKey }: {
  steps: Step[]; activeIdx: number; setActiveIdx: (i: number) => void; accentKey: AccentKey;
}) {
  const accent = ACCENT_MAP[accentKey];
  return (
    <div style={{ marginTop: 56, padding: "32px 8px 8px" }}>
      <div style={{ position: "relative", height: 2, background: "var(--border-2)", borderRadius: 2, margin: "0 24px 24px" }}>
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, borderRadius: 2, width: `${(activeIdx / (steps.length - 1)) * 100}%`, background: accent.hex, transition: "width 500ms cubic-bezier(.2,.8,.2,1)" }} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, position: "relative", marginTop: -36 }}>
        {steps.map((s, i) => {
          const active = i === activeIdx;
          const passed = i <= activeIdx;
          return (
            <button key={s.id} onClick={() => setActiveIdx(i)} style={{ appearance: "none", border: "none", background: "transparent", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: 8, color: "inherit", fontFamily: "inherit" }}>
              <div style={{
                width: 56, height: 56, borderRadius: 999, border: `2px solid ${passed ? accent.hex : "var(--border-2)"}`,
                display: "grid", placeItems: "center",
                fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 16,
                background: active ? accent.hex : passed ? accent.dim : "var(--surface)",
                color: active ? "#000" : passed ? accent.hex : "var(--muted)",
                boxShadow: active ? `0 0 0 6px ${accent.soft}` : "none", transition: "all 300ms",
              }}>
                {s.num}
              </div>
              <div style={{ textAlign: "center", transition: "color 300ms", color: active ? "var(--text)" : "var(--muted)" }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{s.title}</div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)", marginTop: 4 }}>{s.duration}</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
//  Detail panel
// ============================================================
function Detail({ step, index, total, accentKey, animKey }: {
  step: Step; index: number; total: number; accentKey: AccentKey; animKey: string;
}) {
  const accent = ACCENT_MAP[accentKey];
  return (
    <div key={animKey} className="detail-anim" style={{ marginTop: 40, border: "1px solid var(--border)", borderRadius: 16, padding: 36, background: "var(--surface)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 24, flexWrap: "wrap" }}>
        <div>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: 1.5, color: accent.hex }}>{step.code}</span>
          <h2 style={{ fontSize: "clamp(28px,4vw,40px)", margin: "8px 0 0", fontWeight: 700, letterSpacing: -1, display: "flex", alignItems: "baseline", gap: 14, flexWrap: "wrap" }}>
            {step.title}
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 16, color: "var(--muted)", fontWeight: 500, letterSpacing: 1 }}>/ {step.en}</span>
          </h2>
          {step.relatedProducts && step.relatedProducts.length > 0 && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
              {step.relatedProducts.map((p) => (
                <span key={p} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 6, background: accent.dim, border: `1px solid ${accent.hex}30`, fontSize: 11, fontFamily: "var(--font-mono)", color: accent.hex, letterSpacing: 0.5 }}>
                  <span style={{ width: 4, height: 4, borderRadius: 999, background: accent.hex }} />
                  {p}
                </span>
              ))}
            </div>
          )}
        </div>
        <div style={{ textAlign: "right", border: "1px solid var(--border-2)", padding: "12px 16px", borderRadius: 10, minWidth: 140 }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: 1.5, color: "var(--muted)", textTransform: "uppercase" }}>{step.metric.label}</div>
          <div style={{ fontSize: 32, fontWeight: 700, letterSpacing: -1, marginTop: 4, color: accent.hex }}>{step.metric.value}</div>
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{step.metric.note}</div>
        </div>
      </div>

      <p style={{ fontSize: 17, lineHeight: 1.7, color: "var(--text)", marginTop: 28, maxWidth: 720 }}>{step.summary}</p>

      <div style={{ marginTop: 32, display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 16 }} className="detail-grid">
        <div style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 20, background: "var(--bg-2)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: 2, color: "var(--muted)" }}>TASKS</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--dim)" }}>{step.tasks.length} items</span>
          </div>
          <div>
            {step.tasks.map((t, i) => (
              <div key={i} className="task-row" data-delay={i} style={{ display: "flex", gap: 12, padding: "12px 0", borderTop: i === 0 ? "none" : "1px solid var(--border)" }}>
                <span style={{ fontSize: 12, marginTop: 2, color: accent.hex }}>▪</span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{t.t}</div>
                  <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 4, lineHeight: 1.5 }}>{t.d}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 20, background: "var(--bg-2)" }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: 2, color: "var(--muted)", marginBottom: 16 }}>DELIVERABLES</div>
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
              {step.deliverables.map((d, i) => (
                <li key={i} style={{ display: "flex", gap: 10, fontSize: 13, alignItems: "baseline" }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: 1, minWidth: 40, color: accent.hex }}>D.{String(i + 1).padStart(2, "0")}</span>
                  <span>{d}</span>
                </li>
              ))}
            </ul>
          </div>
          <div style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 20, background: "var(--bg-2)" }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: 2, color: "var(--muted)", marginBottom: 16 }}>DURATION</div>
            <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.5 }}>{step.duration}</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 4, marginTop: 16 }}>
              {Array.from({ length: total }).map((_, i) => (
                <div key={i} style={{ height: 6, borderRadius: 2, background: i <= index ? accent.hex : "var(--border-2)", opacity: i === index ? 1 : i < index ? 0.5 : 1, transition: "all 400ms" }} />
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12, fontFamily: "var(--font-mono)", fontSize: 11 }}>
              <span style={{ color: "var(--muted)", letterSpacing: 1 }}>Phase</span>
              <span style={{ fontWeight: 700, color: accent.hex }}>{String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
//  Footer controls
// ============================================================
function FooterControls({ activeIdx, setActiveIdx, total, autoplay, setAutoplay, accentKey }: {
  activeIdx: number; setActiveIdx: Dispatch<SetStateAction<number>>; total: number;
  autoplay: boolean; setAutoplay: Dispatch<SetStateAction<boolean>>; accentKey: AccentKey;
}) {
  const accent = ACCENT_MAP[accentKey];
  const btn = { appearance: "none" as const, background: "var(--surface)", color: "var(--text)", border: "1px solid var(--border-2)", padding: "10px 20px", borderRadius: 999, fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: 2, cursor: "pointer" };
  return (
    <div style={{ marginTop: 32, display: "flex", alignItems: "center", justifyContent: "center", gap: 20, flexWrap: "wrap" }}>
      <button style={{ ...btn, opacity: activeIdx === 0 ? 0.4 : 1 }} disabled={activeIdx === 0} onClick={() => setActiveIdx((i: number) => Math.max(0, i - 1))}>← PREV</button>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        {Array.from({ length: total }).map((_, i) => (
          <button
            key={i}
            onClick={() => setActiveIdx(i)}
            style={{
              height: 8, borderRadius: 999, border: "none", cursor: "pointer",
              background: i === activeIdx ? accent.hex : "var(--border-2)",
              width: i === activeIdx ? 24 : 8, transition: "all 300ms",
            }}
          />
        ))}
      </div>
      <button style={btn} onClick={() => setActiveIdx((i: number) => Math.min(total - 1, i + 1))} disabled={activeIdx === total - 1}>NEXT →</button>
      <button
        onClick={() => setAutoplay((a: boolean) => !a)}
        style={{ appearance: "none", background: "transparent", border: `1px solid ${autoplay ? accent.hex : "var(--border-2)"}`, padding: "10px 16px", borderRadius: 999, cursor: "pointer", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: 2, marginLeft: 16, color: autoplay ? accent.hex : "var(--muted)" }}
      >
        {autoplay ? "■ PAUSE" : "▶ AUTOPLAY"}
      </button>
    </div>
  );
}

// ============================================================
//  Section Head
// ============================================================
function SectionHead({ tag, title, sub, accentKey }: { tag: string; title: string; sub?: string; accentKey: AccentKey }) {
  const accent = ACCENT_MAP[accentKey];
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 10, marginBottom: 14, padding: "4px 12px", border: "1px solid var(--border-2)", borderRadius: 999, background: "var(--surface)" }}>
        <span style={{ width: 6, height: 6, borderRadius: 999, background: accent.hex }} />
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: 2, color: "var(--muted)" }}>{tag}</span>
      </div>
      <h2 style={{ fontSize: "clamp(28px, 4vw, 40px)", fontWeight: 700, letterSpacing: -1, margin: 0 }}>{title}</h2>
      {sub && <p style={{ color: "var(--muted)", fontSize: 16, lineHeight: 1.7, marginTop: 12, maxWidth: 680 }}>{sub}</p>}
    </div>
  );
}

// ============================================================
//  NEW: Product Lineup section (TERA AI / DX / Cloud)
// ============================================================
function ProductLineup() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }} className="product-grid">
      {DX_PRODUCTS.map((p) => {
        const acc = ACCENT_MAP[p.accent];
        return (
          <Link key={p.line} href={p.href} style={{ textDecoration: "none", color: "inherit" }}>
            <div style={{
              position: "relative", height: "100%",
              border: "1px solid var(--border)", borderRadius: 16, padding: 28,
              background: "var(--surface)", overflow: "hidden",
              transition: "border-color 300ms, transform 300ms, box-shadow 300ms",
              display: "flex", flexDirection: "column",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLDivElement).style.borderColor = acc.hex;
              (e.currentTarget as HTMLDivElement).style.transform = "translateY(-3px)";
              (e.currentTarget as HTMLDivElement).style.boxShadow = `0 20px 40px -20px ${acc.soft}`;
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border)";
              (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
              (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
            }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <span style={{ width: 6, height: 6, borderRadius: 999, background: acc.hex, boxShadow: `0 0 10px ${acc.hex}` }} />
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: 2, color: acc.hex }}>{p.tagline}</span>
              </div>
              <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: -0.5, marginBottom: 14 }}>{p.line}</div>
              <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.7, marginBottom: 20, flex: 1 }}>{p.lead}</p>

              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
                {p.sub.map((s) => (
                  <div key={s.name} style={{ padding: "10px 12px", borderRadius: 10, background: "var(--bg-2)", border: "1px solid var(--border)" }}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{s.name}</div>
                    <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{s.desc}</div>
                  </div>
                ))}
              </div>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 14, borderTop: "1px solid var(--border)" }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: 1, color: "var(--muted)" }}>DETAILS</span>
                <span style={{ color: acc.hex, fontSize: 14 }}>→</span>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

// ============================================================
//  Trend Chart (SVG)
// ============================================================
function TrendChart({ accentKey }: { accentKey: AccentKey }) {
  const accent = ACCENT_MAP[accentKey];
  const W = 920, H = 340, PAD_L = 48, PAD_R = 32, PAD_T = 30, PAD_B = 44;
  const plotW = W - PAD_L - PAD_R, plotH = H - PAD_T - PAD_B;
  const n = DX_TRENDS.months.length - 1;
  const x = (i: number) => PAD_L + (i / n) * plotW;
  const yPct = (v: number) => PAD_T + plotH - (v / 100) * plotH;
  const buildPath = (arr: number[]) => arr.map((v, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(2)} ${yPct(v).toFixed(2)}`).join(" ");

  const workloadPath = buildPath(DX_TRENDS.workload);
  const errorPath = buildPath(DX_TRENDS.errorRate);
  const satPath = buildPath(DX_TRENDS.satisfaction);
  const areaPath = `${workloadPath} L ${x(n)} ${PAD_T + plotH} L ${PAD_L} ${PAD_T + plotH} Z`;
  const gridLines = [0, 25, 50, 75, 100];

  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 16, padding: 28, background: "var(--surface)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 20 }}>
        <div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: 2, color: "var(--muted)" }}>TREND // 12 MONTHS</div>
          <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: -0.5, marginTop: 6 }}>導入後12ヶ月の推移</div>
          <div style={{ color: "var(--muted)", fontSize: 14, marginTop: 6 }}>導入前を基準値100とした相対値(%)</div>
        </div>
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
          <Legend color={accent.hex} label="月次工数" filled />
          <Legend color="#f4a261" label="人為エラー率" dashed />
          <Legend color="#a8eb6e" label="現場満足度" />
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}>
        {DX_TRENDS.phases.map((p, i) => (
          <g key={i}>
            <rect x={x(p.from)} y={PAD_T} width={x(p.to) - x(p.from)} height={plotH} fill={i % 2 === 0 ? "rgba(255,255,255,0.015)" : "transparent"} />
            <line x1={x(p.to)} x2={x(p.to)} y1={PAD_T} y2={PAD_T + plotH} stroke="var(--border)" strokeDasharray="2 4" />
          </g>
        ))}
        {gridLines.map((g) => (
          <g key={g}>
            <line x1={PAD_L} x2={W - PAD_R} y1={yPct(g)} y2={yPct(g)} stroke="var(--border)" strokeDasharray="1 3" />
            <text x={PAD_L - 10} y={yPct(g) + 4} textAnchor="end" fontFamily="var(--font-mono)" fontSize="10" fill="var(--muted)">{g}</text>
          </g>
        ))}
        {DX_TRENDS.months.map((m, i) => (
          <text key={i} x={x(i)} y={H - PAD_B + 18} textAnchor="middle" fontFamily="var(--font-mono)" fontSize="10" fill="var(--muted)">{m}</text>
        ))}
        {DX_TRENDS.phases.map((p, i) => (
          <text key={i} x={(x(p.from) + x(p.to)) / 2} y={H - 6} textAnchor="middle" fontFamily="var(--font-mono)" fontSize="9" fill="var(--dim)">
            {p.label.split("\n").map((ln, j) => (
              <tspan key={j} x={(x(p.from) + x(p.to)) / 2} dy={j === 0 ? 0 : 11}>{ln}</tspan>
            ))}
          </text>
        ))}
        <defs>
          <linearGradient id="workloadGrad" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={accent.hex} stopOpacity="0.25" />
            <stop offset="100%" stopColor={accent.hex} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#workloadGrad)" />
        <path d={workloadPath} fill="none" stroke={accent.hex} strokeWidth="2.5" strokeLinejoin="round" />
        <path d={errorPath} fill="none" stroke="#f4a261" strokeWidth="2" strokeDasharray="5 4" strokeLinejoin="round" />
        <path d={satPath} fill="none" stroke="#a8eb6e" strokeWidth="2" strokeLinejoin="round" />
        <g>
          <circle cx={x(n)} cy={yPct(DX_TRENDS.workload[n])} r="4" fill={accent.hex} />
          <text x={x(n) - 8} y={yPct(DX_TRENDS.workload[n]) - 10} textAnchor="end" fontFamily="var(--font-mono)" fontSize="11" fill={accent.hex} fontWeight="700">-64% 工数</text>
          <circle cx={x(n)} cy={yPct(DX_TRENDS.errorRate[n])} r="3" fill="#f4a261" />
          <circle cx={x(n)} cy={yPct(DX_TRENDS.satisfaction[n])} r="3" fill="#a8eb6e" />
        </g>
      </svg>
    </div>
  );
}

function Legend({ color, label, filled, dashed }: { color: string; label: string; filled?: boolean; dashed?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)" }}>
      <svg width="22" height="10">
        {dashed ? <line x1="0" x2="22" y1="5" y2="5" stroke={color} strokeWidth="2" strokeDasharray="4 3" /> : <line x1="0" x2="22" y1="5" y2="5" stroke={color} strokeWidth="2.5" />}
        <circle cx="11" cy="5" r="3" fill={filled ? color : "var(--surface)"} stroke={color} strokeWidth="1.5" />
      </svg>
      <span style={{ color: "var(--text)" }}>{label}</span>
    </div>
  );
}

// ============================================================
//  Cost / ROI
// ============================================================
function CostSection({ accentKey }: { accentKey: AccentKey }) {
  const accent = ACCENT_MAP[accentKey];
  const { investment, roi } = DX_COST;
  const maxInv = Math.max(...investment.map((i) => i.value));
  const maxRoi = Math.max(...roi.map((r) => r.value));

  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 16, background: "var(--surface)", padding: 28, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }} className="cost-grid">
      <div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: 2, color: "var(--muted)" }}>INVESTMENT</div>
        <div style={{ fontSize: 22, fontWeight: 700, marginTop: 6 }}>費用の目安</div>
        <div style={{ marginTop: 22, display: "flex", flexDirection: "column", gap: 18 }}>
          {investment.map((it, i) => (
            <div key={i}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                <span style={{ fontSize: 14 }}>{it.label}</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted)" }}>{it.note}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ flex: 1, height: 8, borderRadius: 4, background: "var(--border)", overflow: "hidden" }}>
                  <div style={{ width: `${(it.value / maxInv) * 100}%`, height: "100%", background: `linear-gradient(90deg, ${accent.hex}, ${accent.soft})`, transition: "width 600ms" }} />
                </div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 18, fontWeight: 700, minWidth: 120, textAlign: "right" }}>
                  <span style={{ color: accent.hex }}>¥{it.value}</span>
                  <span style={{ fontSize: 12, color: "var(--muted)", marginLeft: 4 }}>{it.unit}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ borderLeft: "1px solid var(--border)", paddingLeft: 24 }} className="roi-col">
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: 2, color: "var(--muted)" }}>ROI // PROJECTION</div>
        <div style={{ fontSize: 22, fontWeight: 700, marginTop: 6 }}>累積ROIの推移</div>
        <div style={{ marginTop: 22, display: "flex", gap: 14, alignItems: "flex-end", height: 180 }}>
          {roi.map((r, i) => (
            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 20, fontWeight: 700, color: accent.hex }}>×{r.value}</div>
              <div style={{ width: "100%", height: `${(r.value / maxRoi) * 140}px`, background: `linear-gradient(180deg, ${accent.soft}, ${accent.hex})`, borderRadius: "6px 6px 0 0", transition: "height 600ms" }} />
              <div style={{ fontSize: 12, fontWeight: 600 }}>{r.label}</div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)", textAlign: "center" }}>{r.note}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 20, padding: 14, borderRadius: 10, background: "var(--bg-2)", border: "1px solid var(--border)", fontSize: 13, color: "var(--muted)", lineHeight: 1.6 }}>
          <span style={{ color: accent.hex, fontWeight: 700 }}>12ヶ月で投資回収</span>、その後は累積効果が加速。補助金活用で初期負担はさらに軽減可能。
        </div>
      </div>
    </div>
  );
}

// ============================================================
//  Case Studies
// ============================================================
const CASE_IMAGES = [
  { src: "/corporate/dx-flow/case-manufacturing.jpg", alt: "町工場の受発注業務" },
  { src: "/corporate/dx-flow/case-wholesale.jpg",     alt: "卸売業の倉庫オフィス" },
  { src: "/corporate/dx-flow/case-service.jpg",       alt: "サービス業の受付カウンター" },
];

function CaseSection() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }} className="case-grid">
      {DX_CASES.map((c, i) => {
        const acc = ACCENT_MAP[c.color];
        const img = CASE_IMAGES[i];
        return (
          <div key={i} style={{ position: "relative", border: "1px solid var(--border)", borderRadius: 14, background: "var(--surface)", overflow: "hidden", display: "flex", flexDirection: "column" }}>
            {/* Cinematic image */}
            {img && (
              <div style={{ position: "relative", width: "100%", aspectRatio: "4 / 3", overflow: "hidden" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.src} alt={img.alt} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", filter: "saturate(0.85)" }} />
                {/* 下部グラデでカードに馴染ませる */}
                <div style={{ position: "absolute", inset: 0, background: `linear-gradient(180deg, transparent 0%, transparent 50%, rgba(13,17,23,0.85) 100%), linear-gradient(135deg, ${acc.soft} 0%, transparent 60%)`, pointerEvents: "none" }} />
                {/* 左上 CASE番号バッジ */}
                <div style={{ position: "absolute", left: 14, top: 14, padding: "4px 10px", borderRadius: 6, background: "rgba(7,9,12,0.75)", backdropFilter: "blur(6px)", border: `1px solid ${acc.hex}50` }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: 2, color: acc.hex, fontWeight: 700 }}>CASE.{String(i + 1).padStart(2, "0")}</span>
                </div>
                {/* 右上 effect 数値 */}
                <div style={{ position: "absolute", right: 14, top: 14, fontFamily: "var(--font-mono)", fontSize: 26, fontWeight: 700, color: acc.hex, letterSpacing: -1, textShadow: "0 2px 12px rgba(7,9,12,0.9)" }}>{c.effect}</div>
              </div>
            )}
            <div style={{ padding: 24, display: "flex", flexDirection: "column", flex: 1 }}>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>{c.industry} / {c.size}</div>
              <div style={{ fontSize: 18, fontWeight: 700, marginTop: 10, letterSpacing: -0.3 }}>{c.title}</div>
              <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 10 }}>
                <div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--dim)", letterSpacing: 1 }}>BEFORE</div>
                  <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4, lineHeight: 1.5 }}>{c.before}</div>
                </div>
                <div style={{ height: 1, background: "var(--border)" }} />
                <div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: acc.hex, letterSpacing: 1 }}>AFTER</div>
                  <div style={{ fontSize: 13, marginTop: 4, lineHeight: 1.5 }}>{c.after}</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 14 }}>
                {c.products.map((p) => (
                  <span key={p} style={{ fontFamily: "var(--font-mono)", fontSize: 10, padding: "3px 8px", borderRadius: 6, background: "var(--bg-2)", border: "1px solid var(--border-2)", color: "var(--muted)" }}>{p}</span>
                ))}
              </div>
              <div style={{ marginTop: 14, padding: "10px 12px", background: acc.soft, borderRadius: 8, fontFamily: "var(--font-mono)", fontSize: 12, color: acc.hex, fontWeight: 600 }}>▸ {c.metric}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
//  FAQ
// ============================================================
function FAQSection({ accentKey }: { accentKey: AccentKey }) {
  const accent = ACCENT_MAP[accentKey];
  const [open, setOpen] = useState(0);
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 16, background: "var(--surface)", overflow: "hidden" }}>
      {DX_FAQ.map((f, i) => {
        const isOpen = open === i;
        return (
          <div key={i} style={{ borderTop: i === 0 ? "none" : "1px solid var(--border)" }}>
            <button
              onClick={() => setOpen(isOpen ? -1 : i)}
              style={{ width: "100%", appearance: "none", background: "transparent", color: "var(--text)", border: "none", cursor: "pointer", padding: "20px 24px", textAlign: "left", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, fontFamily: "inherit" }}
            >
              <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: accent.hex, minWidth: 30 }}>Q.{String(i + 1).padStart(2, "0")}</span>
                <span style={{ fontSize: 15, fontWeight: 600, textAlign: "left" }}>{f.q}</span>
              </div>
              <span style={{ color: isOpen ? accent.hex : "var(--muted)", fontSize: 16, fontFamily: "var(--font-mono)", transition: "transform 200ms", transform: isOpen ? "rotate(45deg)" : "none" }}>+</span>
            </button>
            <div style={{ maxHeight: isOpen ? 300 : 0, overflow: "hidden", transition: "max-height 400ms cubic-bezier(.2,.8,.2,1)" }}>
              <div style={{ padding: "0 24px 20px 70px", color: "var(--muted)", fontSize: 14, lineHeight: 1.7 }}>{f.a}</div>
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
function CTASection({ accentKey }: { accentKey: AccentKey }) {
  const accent = ACCENT_MAP[accentKey];
  return (
    <div style={{ position: "relative", border: "1px solid var(--border-2)", borderRadius: 20, padding: "56px 48px", background: `linear-gradient(135deg, ${accent.soft}, transparent 60%), var(--surface)`, overflow: "hidden" }}>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: 2, color: accent.hex }}>▸ GET_STARTED</div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 40, marginTop: 16, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 320 }}>
          <div style={{ fontSize: "clamp(28px, 4vw, 40px)", fontWeight: 700, letterSpacing: -1, lineHeight: 1.2 }}>
            まずは<span style={{ color: accent.hex }}>60分の無料相談</span>から<br />御社のDXを一緒に設計します
          </div>
          <div style={{ color: "var(--muted)", fontSize: 15, lineHeight: 1.7, marginTop: 18, maxWidth: 560 }}>
            課題整理から費用感、補助金活用まで、1回のミーティングでお伝えします。<br />オンライン / 訪問どちらも対応可能です。
          </div>
          {/* 敷居の低さを伝えるサブメッセージ */}
          <div style={{ marginTop: 22, padding: "14px 16px", borderRadius: 10, border: `1px dashed ${accent.hex}40`, background: `${accent.soft.replace("0.14", "0.06")}`, fontSize: 13, color: "var(--text)", lineHeight: 1.7, maxWidth: 560 }}>
            <span style={{ color: accent.hex, fontWeight: 700 }}>◉ </span>
            中小企業のDX導入を中心にしていますが、<strong>個人の方のアプリ開発・Webサイト制作・AI活用のご相談</strong>もお気軽に。「こんなこと、できる？」レベルの話でも歓迎です。
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Link href="/corporate#contact" style={{ appearance: "none", border: "none", cursor: "pointer", padding: "16px 28px", borderRadius: 999, background: accent.hex, color: "#000", fontFamily: "var(--font-mono)", fontSize: 12, letterSpacing: 2, fontWeight: 700, textAlign: "center", textDecoration: "none" }}>▸ 無料相談を予約する</Link>
          <Link href="/corporate/products/ai" style={{ appearance: "none", cursor: "pointer", padding: "16px 28px", borderRadius: 999, background: "transparent", color: "var(--text)", border: "1px solid var(--border-2)", fontFamily: "var(--font-mono)", fontSize: 12, letterSpacing: 2, textAlign: "center", textDecoration: "none" }}>プロダクトを見る →</Link>
        </div>
      </div>
    </div>
  );
}

// ============================================================
//  Main page
// ============================================================
export default function DXImplementationFlowPage() {
  const [layout, setLayout] = useState<"grid" | "timeline">("grid");
  const [accentKey] = useState<AccentKey>("cyan");
  const [activeIdx, setActiveIdx] = useState(0);
  const [autoplay, setAutoplay] = useState(false);
  const total = DX_STEPS.length;
  const step = DX_STEPS[activeIdx];

  // Autoplay
  useEffect(() => {
    if (!autoplay) return;
    const id = setInterval(() => setActiveIdx((i) => (i + 1) % total), 4500);
    return () => clearInterval(id);
  }, [autoplay, total]);

  // Keyboard nav
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") setActiveIdx((i) => Math.min(total - 1, i + 1));
      if (e.key === "ArrowLeft") setActiveIdx((i) => Math.max(0, i - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [total]);

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
        .dx-flow-page {
          min-height: 100vh;
          background:
            radial-gradient(1200px 600px at 80% -10%, rgba(77,214,232,0.06), transparent 60%),
            radial-gradient(1000px 500px at -10% 110%, rgba(168,235,110,0.04), transparent 60%),
            #07090c;
          overflow-x: hidden;
          position: relative;
        }
        .dx-flow-page::before {
          content: "";
          position: fixed; inset: 0; pointer-events: none; z-index: 0;
          background-image:
            linear-gradient(to right, rgba(255,255,255,0.015) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255,255,255,0.015) 1px, transparent 1px);
          background-size: 48px 48px;
          mask-image: radial-gradient(ellipse at center, black 40%, transparent 85%);
          -webkit-mask-image: radial-gradient(ellipse at center, black 40%, transparent 85%);
        }
        .dx-flow-page > * { position: relative; z-index: 1; }
        ::selection { background: #4dd6e8; color: #000; }

        @keyframes fadeSlideUp { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeRight { from { opacity: 0; transform: translateX(-8px); } to { opacity: 1; transform: translateX(0); } }
        .detail-anim { animation: fadeSlideUp 450ms cubic-bezier(.2,.8,.2,1) both; }
        .detail-anim .task-row { animation: fadeRight 400ms cubic-bezier(.2,.8,.2,1) both; animation-delay: calc(var(--i, 0) * 90ms + 150ms); }
        .task-row[data-delay="0"] { --i: 0; }
        .task-row[data-delay="1"] { --i: 1; }
        .task-row[data-delay="2"] { --i: 2; }
        .task-row[data-delay="3"] { --i: 3; }
        button:focus-visible { outline: 2px solid #4dd6e8; outline-offset: 2px; }

        /* Responsive */
        @media (max-width: 900px) {
          .card-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .detail-grid { grid-template-columns: 1fr !important; }
          .product-grid { grid-template-columns: 1fr !important; }
          .case-grid { grid-template-columns: 1fr !important; }
          .cost-grid { grid-template-columns: 1fr !important; }
          .philosophy-grid { grid-template-columns: 1fr !important; }
          .roi-col { border-left: none !important; padding-left: 0 !important; border-top: 1px solid var(--border); padding-top: 24px; }
        }
        @media (max-width: 640px) {
          .card-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <div className="dx-flow-page">
        <TopBar layout={layout} setLayout={setLayout} accentKey={accentKey} />

        <main style={{ maxWidth: 1240, margin: "0 auto", padding: "40px 32px 80px", width: "100%" }}>
          <Hero accentKey={accentKey} />

          <PhilosophyBlock accentKey={accentKey} />

          {/* ===== 5 Steps ===== */}
          <div style={{ marginTop: 80 }}>
            <SectionHead
              tag="IMPLEMENTATION // 5 PHASES"
              title="5つのフェーズで業務定着まで"
              sub="テクノロジーを導入して終わり、ではなく、現場で使い続けられる状態まで伴走します。どのフェーズもクリックして詳細をご確認ください。"
              accentKey={accentKey}
            />
          </div>

          {layout === "grid" ? (
            <CardGrid steps={DX_STEPS} activeIdx={activeIdx} setActiveIdx={setActiveIdx} accentKey={accentKey} />
          ) : (
            <Timeline steps={DX_STEPS} activeIdx={activeIdx} setActiveIdx={setActiveIdx} accentKey={accentKey} />
          )}

          <Detail step={step} index={activeIdx} total={total} accentKey={accentKey} animKey={`${layout}-${activeIdx}`} />

          <FooterControls activeIdx={activeIdx} setActiveIdx={setActiveIdx} total={total} autoplay={autoplay} setAutoplay={setAutoplay} accentKey={accentKey} />

          {/* ===== Product Lineup ===== */}
          <div style={{ marginTop: 120 }}>
            <SectionHead
              tag="OUR PRODUCTS"
              title="3つのプロダクトラインで伴走"
              sub="現場で10年以上DXを運用してきた知見を、そのままプロダクトに。御社の課題に必要な部分だけ選んで導入できます。"
              accentKey={accentKey}
            />
            <ProductLineup />
          </div>

          {/* ===== Trend chart ===== */}
          <div style={{ marginTop: 120 }}>
            <SectionHead
              tag="RESULTS // TREND"
              title="導入効果の推移"
              sub="Phase 04の実装完了からおよそ3ヶ月で工数が半減。エラー率は18%まで低下し、現場満足度は88%まで上昇します。"
              accentKey={accentKey}
            />
            <TrendChart accentKey={accentKey} />
          </div>

          {/* ===== Cost / ROI ===== */}
          <div style={{ marginTop: 100 }}>
            <SectionHead
              tag="COST // ROI"
              title="費用と投資回収"
              sub="中小企業で最も採用されるStandardプランをベースに、費用感と累積ROIの目安をご紹介します。"
              accentKey={accentKey}
            />
            <CostSection accentKey={accentKey} />
          </div>

          {/* ===== Cases ===== */}
          <div style={{ marginTop: 100 }}>
            <SectionHead
              tag="CASE STUDIES"
              title="実績から3つご紹介"
              sub="業種・規模の異なる中小企業における、実際の改善事例です。弊社プロダクトをどう組み合わせたかも併せてご覧ください。"
              accentKey={accentKey}
            />
            <CaseSection />
          </div>

          {/* ===== FAQ ===== */}
          <div style={{ marginTop: 100 }}>
            <SectionHead tag="FAQ" title="よくあるご質問" accentKey={accentKey} />
            <FAQSection accentKey={accentKey} />
          </div>

          {/* ===== CTA ===== */}
          <div style={{ marginTop: 100 }}>
            <CTASection accentKey={accentKey} />
          </div>

          <footer style={{ marginTop: 60, paddingTop: 32, borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "flex-end", fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted)", flexWrap: "wrap", gap: 20 }}>
            <div>
              <div style={{ color: "var(--text)", fontSize: 16, letterSpacing: 4, fontWeight: 700 }}>TERA DX</div>
              <div style={{ marginTop: 6, lineHeight: 1.6 }}>dx implementation partner<br />中小企業から個人様まで、お気軽に。</div>
            </div>
            <div style={{ textAlign: "right", lineHeight: 1.8 }}>
              <div>© {new Date().getFullYear()} 合同会社テラスライフ</div>
              <div>/ dx_playbook build r25</div>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
}
