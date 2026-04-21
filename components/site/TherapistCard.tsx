"use client";

import Link from "next/link";
import { SITE } from "../../lib/site-theme";

/**
 * TherapistCard — セラピスト表示用カード
 *
 * HOME / 一覧 / スケジュール等から使う共通カード。
 * 仕様 ■19/20 準拠（絵文字なし、明朝、細い罫線、影なし）
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
          transition: SITE.transition.base,
          overflow: "hidden",
        }}
      >
        {t.photo_url ? (
          // セラピスト写真は外部URL（Supabase Storage）のため next/image ではなく <img>
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={t.photo_url}
            alt={t.name}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
              transition: SITE.transition.base,
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

        {/* バッジ */}
        {(newBadge || pickup || statusLabel) && (
          <div
            style={{
              position: "absolute",
              bottom: 8,
              left: 8,
              display: "flex",
              gap: 4,
              flexWrap: "wrap",
            }}
          >
            {newBadge && (
              <span
                style={{
                  padding: "3px 10px",
                  backgroundColor: SITE.color.pink,
                  color: "#ffffff",
                  fontFamily: SITE.font.display,
                  fontSize: "10px",
                  letterSpacing: SITE.ls.wide,
                  fontWeight: 500,
                }}
              >
                NEW
              </span>
            )}
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
    </Link>
  );
}
