"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";
import { SITE } from "../../lib/site-theme";

/**
 * ═══════════════════════════════════════════════════════════
 * NewsSection — HP トップの「最新のお知らせ」セクション
 *
 * 仕様:
 *  - customer_notifications で show_on_hp=true かつ
 *    target_customer_id IS NULL（全員宛）のものを最大 3 件表示
 *  - 会員限定通知（target_customer_id が入っている）は表示しない
 *  - 件数 0 のときは何も描画しない
 *
 * デザイン（■19・■20 準拠）:
 *  - 明朝体、絵文字非使用
 *  - ベージュの marble 背景
 * ═══════════════════════════════════════════════════════════
 */

type HpNotification = {
  id: number;
  title: string;
  body: string;
  type: string;
  image_url: string | null;
  created_at: string;
};

const typeLabel = (t: string): string => {
  if (t === "campaign") return "CAMPAIGN";
  if (t === "new_therapist") return "NEW FACE";
  if (t === "news") return "NEWS";
  if (t === "info") return "INFO";
  return "NEWS";
};

export default function NewsSection() {
  const [items, setItems] = useState<HpNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("customer_notifications")
        .select("id,title,body,type,image_url,created_at")
        .is("target_customer_id", null)
        .eq("show_on_hp", true)
        .order("created_at", { ascending: false })
        .limit(3);
      setItems((data as HpNotification[]) || []);
      setLoading(false);
    })();
  }, []);

  if (loading) return null;
  if (items.length === 0) return null;

  return (
    <section
      style={{
        background: SITE.color.bg,
        padding: `${SITE.sp.sectionSm} ${SITE.sp.lg}`,
        borderBottom: `1px solid ${SITE.color.borderSoft}`,
      }}
    >
      <div style={{ maxWidth: SITE.layout.maxWidth, margin: "0 auto" }}>
        {/* ── ヘッダー ── */}
        <div style={{ textAlign: "center", marginBottom: SITE.sp.xl }}>
          <p
            style={{
              fontFamily: SITE.font.display,
              fontSize: "11px",
              letterSpacing: SITE.ls.wide,
              color: SITE.color.pink,
              marginBottom: 12,
            }}
          >
            NEWS
          </p>
          <h2
            style={{
              fontFamily: SITE.font.serif,
              fontSize: SITE.fs.h3,
              letterSpacing: SITE.ls.loose,
              color: SITE.color.text,
              fontWeight: 500,
              margin: 0,
            }}
          >
            最新のお知らせ
          </h2>
        </div>

        {/* ── リスト ── */}
        <div style={{ borderTop: `1px solid ${SITE.color.border}` }}>
          {items.map((n) => {
            const dt = new Date(n.created_at);
            const dateStr = `${dt.getFullYear()}.${String(dt.getMonth() + 1).padStart(2, "0")}.${String(dt.getDate()).padStart(2, "0")}`;
            return (
              <article
                key={n.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "100px 92px 1fr",
                  alignItems: "baseline",
                  gap: 16,
                  padding: "20px 8px",
                  borderBottom: `1px solid ${SITE.color.border}`,
                }}
              >
                <span
                  style={{
                    fontFamily: SITE.font.display,
                    fontSize: "13px",
                    letterSpacing: SITE.ls.wide,
                    color: SITE.color.textMuted,
                  }}
                >
                  {dateStr}
                </span>
                <span
                  style={{
                    fontFamily: SITE.font.display,
                    fontSize: "10px",
                    letterSpacing: SITE.ls.wide,
                    color: SITE.color.pink,
                    border: `1px solid ${SITE.color.borderPink}`,
                    padding: "3px 10px",
                    textAlign: "center",
                    width: "fit-content",
                  }}
                >
                  {typeLabel(n.type)}
                </span>
                <div>
                  <h3
                    style={{
                      fontFamily: SITE.font.serif,
                      fontSize: "14px",
                      fontWeight: 500,
                      letterSpacing: SITE.ls.loose,
                      color: SITE.color.text,
                      margin: 0,
                      marginBottom: 6,
                    }}
                  >
                    {n.title}
                  </h3>
                  {n.body && (
                    <p
                      style={{
                        fontFamily: SITE.font.serif,
                        fontSize: "12px",
                        lineHeight: 1.9,
                        color: SITE.color.textSub,
                        letterSpacing: SITE.ls.normal,
                        margin: 0,
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {n.body}
                    </p>
                  )}
                </div>
              </article>
            );
          })}
        </div>

        {/* 会員ページへの導線 */}
        <div style={{ textAlign: "center", marginTop: SITE.sp.xl }}>
          <Link
            href="/mypage"
            style={{
              display: "inline-block",
              padding: "10px 24px",
              border: `1px solid ${SITE.color.border}`,
              color: SITE.color.textSub,
              fontFamily: SITE.font.serif,
              fontSize: "12px",
              letterSpacing: SITE.ls.loose,
              textDecoration: "none",
              transition: SITE.transition.fast,
            }}
            className="news-more-link"
          >
            会員ページでさらに見る
          </Link>
        </div>

        <style>{`
          .news-more-link:hover {
            color: ${SITE.color.pink} !important;
            border-color: ${SITE.color.pink} !important;
          }
          @media (max-width: 640px) {
            article {
              grid-template-columns: auto 1fr !important;
            }
            article > span:first-child {
              grid-column: 1 / -1 !important;
              margin-bottom: -8px;
            }
          }
        `}</style>
      </div>
    </section>
  );
}
