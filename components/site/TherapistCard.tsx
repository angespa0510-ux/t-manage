"use client";

import Link from "next/link";
import { SITE } from "../../lib/site-theme";

/**
 * TherapistCard — セラピスト表示用カード
 *
 * HOME / 一覧 / スケジュール等から使う共通カード。
 * 仕様 ■19/20 準拠（絵文字なし、明朝、細い罫線、影なし）
 *
 * インタラクション:
 *  - NEWバッジはハート型(SVG)で、ふわふわ上下アニメ
 *  - カードにマウスオーバーで、カード浮上 + 画像ズーム + 「VIEW PROFILE」オーバーレイ
 */
export type TherapistCardData = {
  id: number;
  name: string;
  age?: number;
  height_cm?: number;
  cup?: string;
  photo_url?: string;
  catchphrase?: string;
  tags?: string[];
  is_pickup?: boolean;
  is_newcomer?: boolean;
};

export default function TherapistCard({
  therapist,
  timeLabel,
  statusLabel,
  storeName,
  pickup,
  newBadge,
  href,
}: {
  therapist: TherapistCardData;
  timeLabel?: string;
  statusLabel?: string;
  storeName?: string;
  pickup?: boolean;
  newBadge?: boolean;
  href?: string;
}) {
  const t = therapist;
  const linkHref = href || `/therapist/${t.id}`;
  return (
    <Link
      href={linkHref}
      className="site-therapist-card"
      style={{
        display: "flex",
        flexDirection: "column",
        backgroundColor: SITE.color.surface,
        textDecoration: "none",
        color: SITE.color.text,
        position: "relative",
      }}
    >
      {/* キャッチコピー帯 */}
      {t.catchphrase && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            zIndex: 2,
            padding: "6px 10px",
            fontFamily: SITE.font.serif,
            fontSize: "10px",
            letterSpacing: SITE.ls.loose,
            backgroundColor: SITE.color.pink,
            color: "#ffffff",
            textAlign: "center",
            lineHeight: 1.4,
            fontWeight: 400,
          }}
        >
          {t.catchphrase}
        </div>
      )}

      {/* 写真 */}
      <div
        className="site-therapist-img-wrap"
        style={{
          width: "100%",
          aspectRatio: "3 / 4",
          position: "relative",
          backgroundColor: SITE.color.surfaceAlt,
          overflow: "hidden",
        }}
      >
        {t.photo_url ? (
          // セラピスト写真は外部URL（Supabase Storage）のため next/image ではなく <img>
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={t.photo_url}
            alt={t.name}
            className="site-therapist-photo"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
              transition: "transform 0.5s ease",
            }}
            loading="lazy"
          />
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: SITE.color.textFaint,
              fontFamily: SITE.font.display,
              fontSize: "11px",
              letterSpacing: SITE.ls.wide,
            }}
          >
            NO IMAGE
          </div>
        )}

        {/* ホバー時の「VIEW PROFILE」オーバーレイ */}
        <div
          className="site-card-overlay"
          style={{
            position: "absolute",
            inset: 0,
            backgroundColor: "rgba(232, 132, 154, 0.78)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: 0,
            transition: "opacity 0.35s ease",
            pointerEvents: "none",
            zIndex: 2,
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              color: "#ffffff",
              fontFamily: SITE.font.display,
              letterSpacing: SITE.ls.wide,
            }}
          >
            <span style={{ fontSize: "13px", fontWeight: 500 }}>VIEW PROFILE</span>
            <span
              style={{
                marginTop: 8,
                width: 28,
                height: 1,
                backgroundColor: "#ffffff",
              }}
            />
            <span
              style={{
                marginTop: 8,
                fontFamily: SITE.font.serif,
                fontSize: "10px",
                letterSpacing: SITE.ls.loose,
              }}
            >
              プロフィールを見る
            </span>
          </div>
        </div>

        {/* NEW バッジ（ハート型、ふわふわ浮遊） */}
        {newBadge && (
          <div
            className="site-new-badge"
            style={{
              position: "absolute",
              top: t.catchphrase ? 32 : 8,
              left: 8,
              width: 56,
              height: 54,
              zIndex: 3,
              pointerEvents: "none",
            }}
            aria-label="新人セラピスト"
          >
            {/* ハート形のSVG背景 */}
            <svg
              viewBox="0 0 56 54"
              xmlns="http://www.w3.org/2000/svg"
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                filter: "drop-shadow(0 3px 6px rgba(232, 132, 154, 0.35))",
              }}
            >
              <path
                fill={SITE.color.pink}
                d="M28 49 C28 49 4 34 4 18 C4 10 10 4 17 4 C21 4 25 6 28 10 C31 6 35 4 39 4 C46 4 52 10 52 18 C52 34 28 49 28 49 Z"
              />
            </svg>
            {/* 中央のテキスト */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                color: "#ffffff",
                fontFamily: SITE.font.display,
                paddingTop: 4,
                lineHeight: 1.05,
              }}
            >
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: 600,
                  letterSpacing: "0.08em",
                }}
              >
                NEW
              </span>
              <span
                style={{
                  fontSize: "7px",
                  fontWeight: 500,
                  letterSpacing: "0.06em",
                  marginTop: 1,
                }}
              >
                THERAPIST
              </span>
            </div>
          </div>
        )}

        {/* その他のバッジ (PICK UP / statusLabel) */}
        {(pickup || statusLabel) && (
          <div
            style={{
              position: "absolute",
              bottom: 8,
              left: 8,
              display: "flex",
              gap: 4,
              flexWrap: "wrap",
              zIndex: 3,
            }}
          >
            {pickup && (
              <span
                style={{
                  padding: "3px 10px",
                  backgroundColor: "rgba(43,43,43,0.85)",
                  color: "#ffffff",
                  fontFamily: SITE.font.display,
                  fontSize: "10px",
                  letterSpacing: SITE.ls.wide,
                  fontWeight: 500,
                }}
              >
                PICK UP
              </span>
            )}
            {statusLabel && (
              <span
                style={{
                  padding: "3px 10px",
                  backgroundColor: "rgba(255,255,255,0.92)",
                  color: SITE.color.text,
                  fontFamily: SITE.font.serif,
                  fontSize: "10px",
                  letterSpacing: SITE.ls.loose,
                  fontWeight: 500,
                  border: `1px solid ${SITE.color.border}`,
                }}
              >
                {statusLabel}
              </span>
            )}
          </div>
        )}
      </div>

      {/* 情報 */}
      <div style={{ padding: "14px 4px 20px" }}>
        <div
          style={{
            fontFamily: SITE.font.serif,
            fontSize: "15px",
            fontWeight: 500,
            color: SITE.color.text,
            marginBottom: 6,
            letterSpacing: SITE.ls.loose,
          }}
        >
          {t.name}
        </div>
        <div
          style={{
            fontFamily: SITE.font.display,
            fontSize: "11px",
            color: SITE.color.textMuted,
            letterSpacing: SITE.ls.loose,
            marginBottom: timeLabel || storeName ? 8 : 0,
          }}
        >
          {[
            t.age ? `${t.age}歳` : null,
            t.height_cm ? `${t.height_cm}cm` : null,
            t.cup ? `${t.cup}cup` : null,
          ]
            .filter(Boolean)
            .join(" ／ ")}
        </div>
        {timeLabel && (
          <div
            style={{
              fontFamily: SITE.font.display,
              fontSize: "12px",
              color: SITE.color.pink,
              letterSpacing: SITE.ls.loose,
              fontWeight: 500,
            }}
          >
            {timeLabel}
          </div>
        )}
        {storeName && (
          <div
            style={{
              fontSize: "10px",
              color: SITE.color.textMuted,
              marginTop: 4,
              letterSpacing: SITE.ls.loose,
            }}
          >
            {storeName}
          </div>
        )}
      </div>

      {/* ホバー&アニメーション用CSS（グローバル） */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes siteNewBadgeFloat {
          0%, 100% { transform: translateY(0) rotate(-8deg); }
          50% { transform: translateY(-5px) rotate(-8deg); }
        }
        @keyframes siteNewBadgeHeartbeat {
          0%, 28%, 100% { transform: translateY(0) rotate(-8deg) scale(1); }
          14% { transform: translateY(0) rotate(-8deg) scale(1.08); }
          42% { transform: translateY(0) rotate(-8deg) scale(1.04); }
        }
        .site-new-badge {
          animation: siteNewBadgeFloat 2.8s ease-in-out infinite;
          transform-origin: center center;
        }
        .site-therapist-card {
          transition: transform 0.35s ease, box-shadow 0.35s ease;
        }
        .site-therapist-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 14px 32px rgba(43, 43, 43, 0.08);
        }
        .site-therapist-card:hover .site-therapist-photo {
          transform: scale(1.06);
        }
        .site-therapist-card:hover .site-card-overlay {
          opacity: 1;
        }
        .site-therapist-card:hover .site-new-badge {
          animation: siteNewBadgeHeartbeat 1.2s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .site-new-badge,
          .site-therapist-card:hover .site-new-badge {
            animation: none !important;
          }
          .site-therapist-card,
          .site-therapist-photo,
          .site-card-overlay {
            transition: none !important;
          }
        }
      `,
        }}
      />
    </Link>
  );
}
