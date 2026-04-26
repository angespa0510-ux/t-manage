"use client";

import Link from "next/link";

const FONT_DISPLAY = "'Cormorant Garamond', 'Noto Serif JP', serif";
const FONT_SERIF = "'Noto Serif JP', 'Yu Mincho', serif";

export default function TManageLP() {
  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#0a0a0e", color: "#e8e6e2", fontFamily: FONT_SERIF }}>
      {/* ヘッダー */}
      <header style={{ padding: "24px 40px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 24, letterSpacing: 4, color: "#c3a782" }}>
            T-MANAGE
          </div>
          <div style={{ fontSize: 12, color: "#9a9890", letterSpacing: 2 }}>
            by TERA-MANAGE
          </div>
        </div>
      </header>

      {/* ヒーロー */}
      <section style={{ padding: "120px 40px 80px", textAlign: "center" }}>
        <div style={{ maxWidth: 800, margin: "0 auto" }}>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 14, letterSpacing: 6, color: "#c3a782", marginBottom: 24 }}>
            SALON MANAGEMENT SYSTEM
          </div>
          <h1 style={{ fontSize: 48, fontWeight: 300, lineHeight: 1.4, marginBottom: 32, letterSpacing: 4 }}>
            サロン業務を、<br />ひとつに。
          </h1>
          <p style={{ fontSize: 16, lineHeight: 2, color: "#b4b2a9", maxWidth: 600, margin: "0 auto" }}>
            予約管理・タイムチャート・資金管理・税務・セラピスト管理。
            <br />
            すべての業務を、ひとつのシステムで。
          </p>
        </div>
      </section>

      {/* 機能 */}
      <section style={{ padding: "80px 40px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 12, letterSpacing: 6, color: "#c3a782", textAlign: "center", marginBottom: 12 }}>
            FEATURES
          </div>
          <h2 style={{ fontSize: 28, fontWeight: 300, textAlign: "center", marginBottom: 60, letterSpacing: 3 }}>
            主な機能
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24 }}>
            {[
              { t: "予約管理", d: "タイムチャートで一目瞭然" },
              { t: "資金管理", d: "5財布をリアルタイムで把握" },
              { t: "税理士ポータル", d: "8シートで決算もラクに" },
              { t: "セラピスト管理", d: "源泉・インボイスも自動" },
              { t: "公開HP連携", d: "出勤情報を自動同期" },
              { t: "AI動画生成", d: "キャストの紹介動画を自動作成" },
            ].map((f) => (
              <div key={f.t} style={{ padding: 32, border: "1px solid rgba(255,255,255,0.08)", backgroundColor: "rgba(255,255,255,0.02)" }}>
                <div style={{ fontFamily: FONT_DISPLAY, fontSize: 11, letterSpacing: 4, color: "#c3a782", marginBottom: 12 }}>
                  {f.t}
                </div>
                <div style={{ fontSize: 14, color: "#b4b2a9", lineHeight: 1.8 }}>
                  {f.d}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: "100px 40px", borderTop: "1px solid rgba(255,255,255,0.05)", textAlign: "center" }}>
        <h2 style={{ fontSize: 24, fontWeight: 300, marginBottom: 24, letterSpacing: 3 }}>
          導入のご相談
        </h2>
        <p style={{ fontSize: 14, color: "#9a9890", marginBottom: 40 }}>
          お気軽にお問い合わせください
        </p>
        <Link
          href="https://tera-manage.jp/contact"
          style={{
            display: "inline-block",
            padding: "16px 40px",
            border: "1px solid #c3a782",
            color: "#c3a782",
            fontSize: 12,
            letterSpacing: 4,
            textDecoration: "none",
          }}
        >
          CONTACT
        </Link>
      </section>

      {/* フッター */}
      <footer style={{ padding: "40px 40px", borderTop: "1px solid rgba(255,255,255,0.05)", textAlign: "center", fontSize: 11, color: "#6a6860" }}>
        <div style={{ marginBottom: 8 }}>T-MANAGE は TERA-MANAGE が提供するサロン管理 SaaS です</div>
        <div>© {new Date().getFullYear()} TERA-MANAGE</div>
      </footer>
    </div>
  );
}
