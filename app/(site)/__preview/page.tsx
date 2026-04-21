import { SITE } from "../../../lib/site-theme";

/**
 * 一時プレビューページ（コミット #4〜#6 でヘッダー/フッターの
 * 見た目を確認するためだけのページ）。
 *
 * コミット #7 以降で削除予定。
 * URL: /__preview
 */

export default function PreviewPage() {
  return (
    <div
      style={{
        maxWidth: SITE.layout.maxWidthNarrow,
        margin: "0 auto",
        padding: `${SITE.sp.xxl} ${SITE.sp.md}`,
        minHeight: "70vh",
      }}
    >
      <h1
        style={{
          fontFamily: SITE.font.serif,
          fontSize: SITE.fs.h1,
          color: SITE.color.pink,
          marginBottom: SITE.sp.lg,
          letterSpacing: "0.05em",
        }}
      >
        プレビュー
      </h1>
      <p
        style={{
          color: SITE.color.textSub,
          lineHeight: 1.9,
          fontSize: SITE.fs.bodyLg,
        }}
      >
        このページは共通レイアウト（ヘッダー・フッター）の動作確認用です。
      </p>
      <p
        style={{
          color: SITE.color.textMuted,
          fontSize: SITE.fs.sm,
          marginTop: SITE.sp.lg,
          fontFamily: SITE.font.display,
          letterSpacing: "0.1em",
        }}
      >
        COMING SOON — PHASE 1 の各ページは順次実装されます。
      </p>

      {/* カラーパレット確認 */}
      <div
        style={{
          marginTop: SITE.sp.xxl,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: SITE.sp.md,
        }}
      >
        {[
          { name: "pink", color: SITE.color.pink },
          { name: "pinkDeep", color: SITE.color.pinkDeep },
          { name: "pinkSoft", color: SITE.color.pinkSoft },
          { name: "gold", color: SITE.color.gold },
          { name: "goldDeep", color: SITE.color.goldDeep },
          { name: "surface", color: SITE.color.surface },
          { name: "surfaceAlt", color: SITE.color.surfaceAlt },
          { name: "border", color: SITE.color.border },
        ].map((c) => (
          <div
            key={c.name}
            style={{
              padding: SITE.sp.md,
              borderRadius: SITE.radius.md,
              backgroundColor: c.color,
              border: `1px solid ${SITE.color.border}`,
              textAlign: "center",
              fontSize: SITE.fs.xs,
              fontFamily: SITE.font.display,
              color: "#fff",
              textShadow: "0 1px 2px rgba(0,0,0,0.5)",
              letterSpacing: "0.08em",
            }}
          >
            {c.name}
            <div style={{ fontSize: "9px", marginTop: "4px", opacity: 0.8 }}>
              {c.color}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
