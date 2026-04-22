import Link from "next/link";

const FONT_SERIF = "'Noto Serif JP', 'Yu Mincho', 'Hiragino Mincho ProN', serif";
const FONT_DISPLAY = "'Cormorant Garamond', 'Noto Serif JP', 'Yu Mincho', serif";

const MARBLE_BG = {
  background: `
    radial-gradient(at 20% 15%, rgba(232,132,154,0.10) 0, transparent 50%),
    radial-gradient(at 85% 20%, rgba(196,162,138,0.08) 0, transparent 50%),
    radial-gradient(at 40% 85%, rgba(247,227,231,0.6) 0, transparent 50%),
    linear-gradient(180deg, #fbf7f3 0%, #f8f2ec 100%)
  `,
};

/**
 * 404 Not Found ページ
 * HP世界観の大理石pink + 明朝で、トップへの導線を提供。
 */
export default function NotFound() {
  return (
    <div
      style={{
        minHeight: "100vh",
        ...MARBLE_BG,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        fontFamily: FONT_SERIF,
        color: "#2b2b2b",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 440,
          padding: "44px 32px",
          backgroundColor: "#ffffff",
          border: "1px solid #e5ded6",
          textAlign: "center",
        }}
      >
        {/* 装飾細線 */}
        <div style={{ width: 1, height: 32, backgroundColor: "#e8849a", margin: "0 auto 20px" }} />

        {/* 404 大きな英字 */}
        <p
          style={{
            margin: 0,
            fontFamily: FONT_DISPLAY,
            fontSize: 58,
            letterSpacing: "0.15em",
            color: "#c96b83",
            fontWeight: 400,
            lineHeight: 1,
          }}
        >
          404
        </p>

        <div style={{ width: 36, height: 1, backgroundColor: "#e8849a", margin: "16px auto" }} />

        {/* 英文ラベル */}
        <p
          style={{
            margin: 0,
            fontFamily: FONT_DISPLAY,
            fontSize: 11,
            letterSpacing: "0.3em",
            color: "#c96b83",
            fontWeight: 500,
          }}
        >
          PAGE NOT FOUND
        </p>

        {/* 和文タイトル */}
        <h1
          style={{
            margin: "10px 0 8px",
            fontFamily: FONT_SERIF,
            fontSize: 18,
            fontWeight: 500,
            letterSpacing: "0.1em",
            color: "#2b2b2b",
          }}
        >
          ページが見つかりません
        </h1>

        {/* 本文 */}
        <p
          style={{
            margin: "14px 0 24px",
            fontSize: 12,
            color: "#555555",
            letterSpacing: "0.05em",
            lineHeight: 2,
          }}
        >
          お探しのページは、移動または削除された可能性があります。<br />
          URL を再度ご確認ください。
        </p>

        {/* アクション */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Link
            href="/"
            style={{
              display: "block",
              padding: "12px 22px",
              backgroundColor: "#c96b83",
              color: "#ffffff",
              fontSize: 12,
              fontWeight: 500,
              letterSpacing: "0.2em",
              textDecoration: "none",
              fontFamily: FONT_SERIF,
            }}
          >
            HP トップへ
          </Link>
          <Link
            href="/mypage"
            style={{
              display: "block",
              padding: "10px 22px",
              color: "#c96b83",
              fontSize: 11,
              fontWeight: 500,
              letterSpacing: "0.15em",
              textDecoration: "none",
              border: "1px solid #c96b83",
              fontFamily: FONT_SERIF,
            }}
          >
            マイページへ
          </Link>
        </div>

        {/* フッター */}
        <div style={{ marginTop: 28, paddingTop: 18, borderTop: "1px solid #e5ded6" }}>
          <p
            style={{
              margin: 0,
              fontFamily: FONT_DISPLAY,
              fontSize: 10,
              letterSpacing: "0.3em",
              color: "#8a8a8a",
              fontWeight: 500,
            }}
          >
            ANGE SPA
          </p>
        </div>
      </div>
    </div>
  );
}
