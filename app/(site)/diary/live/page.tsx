"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { SITE, MARBLE } from "../../../../lib/site-theme";
import { useCustomerAuth } from "../../../../lib/customer-auth-context";

const FONT_SERIF = "'Noto Serif JP', 'Yu Mincho', 'Hiragino Mincho ProN', serif";
const FONT_DISPLAY = "'Cormorant Garamond', 'Noto Serif JP', 'Yu Mincho', serif";

type LiveStream = {
  id: number;
  therapist: { id: number; name: string; photoUrl: string | null };
  roomName: string;
  title: string;
  description: string | null;
  thumbnailUrl: string | null;
  status: string;
  visibility: string;
  viewerCount: number;
  startedAt: string | null;
};

/**
 * 配信中ライブ一覧 (HP /diary/live)
 *
 * - status='live' か 'preparing' のものを表示
 * - 会員ログイン状態を確認 → members_only も含めるかどうか
 * - 各カードは /diary/live/[streamId] へのリンク
 * - 5秒ごと自動更新
 */
export default function LiveListPage() {
  const [streams, setStreams] = useState<LiveStream[]>([]);
  const [loading, setLoading] = useState(true);
  const { customer: authCustomer } = useCustomerAuth();
  const memberId: number | null = authCustomer?.id ?? null;

  const fetchList = useCallback(async () => {
    try {
      const url = memberId ? `/api/diary/live/list?customerId=${memberId}` : `/api/diary/live/list`;
      const res = await fetch(url);
      const data = await res.json();
      if (res.ok) {
        setStreams(data.streams || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [memberId]);

  useEffect(() => {
    fetchList();
    const t = setInterval(fetchList, 5000);
    return () => clearInterval(t);
  }, [fetchList]);

  const livingStreams = streams.filter((s) => s.status === "live");

  return (
    <main style={{ minHeight: "100vh", ...MARBLE.pink, color: SITE.color.text, fontFamily: FONT_SERIF }}>
      <div style={{ maxWidth: 920, margin: "0 auto", padding: "32px 16px 48px" }}>
        {/* ヘッダ */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <p style={{ fontFamily: FONT_DISPLAY, fontSize: 12, letterSpacing: "0.3em", color: SITE.color.pink, marginBottom: 8 }}>LIVE STREAMING</p>
          <h1 style={{ fontFamily: FONT_DISPLAY, fontSize: 28, color: SITE.color.text, fontWeight: 400, marginBottom: 8 }}>
            🔴 配信中のライブ
          </h1>
          <div style={{ width: 36, height: 1, backgroundColor: SITE.color.pink, margin: "16px auto 0" }} />
        </div>

        {/* 戻るリンク */}
        <div style={{ marginBottom: 20 }}>
          <Link href="/diary" style={{ fontSize: 11, color: SITE.color.textSub, textDecoration: "none", letterSpacing: "0.05em" }}>
            ← 写メ日記一覧へ戻る
          </Link>
        </div>

        {/* 一覧 */}
        {loading ? (
          <p style={{ textAlign: "center", padding: 60, color: SITE.color.textMuted, fontSize: 12 }}>読み込み中...</p>
        ) : livingStreams.length === 0 ? (
          <div style={{ textAlign: "center", padding: 60, backgroundColor: "rgba(255,255,255,0.7)", border: `1px solid ${SITE.color.border}` }}>
            <p style={{ fontSize: 14, color: SITE.color.text, marginBottom: 8 }}>現在配信中のライブはありません</p>
            <p style={{ fontSize: 11, color: SITE.color.textMuted, lineHeight: 1.7 }}>
              セラピストたちが配信を始めると<br />こちらに表示されます
            </p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
            {livingStreams.map((s) => (
              <Link
                key={s.id}
                href={`/diary/live/${s.id}`}
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <article style={{ backgroundColor: "rgba(255,255,255,0.95)", border: `1px solid ${SITE.color.border}`, overflow: "hidden", transition: "transform 0.2s", cursor: "pointer" }}>
                  {/* サムネ */}
                  <div style={{ position: "relative", aspectRatio: "9 / 16", backgroundColor: "#000", overflow: "hidden" }}>
                    {s.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={s.thumbnailUrl} alt={s.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : s.therapist.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={s.therapist.photoUrl} alt={s.therapist.name} style={{ width: "100%", height: "100%", objectFit: "cover", filter: "brightness(0.6)" }} />
                    ) : (
                      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 48, color: "#fff" }}>
                        🎬
                      </div>
                    )}
                    {/* LIVEバッジ */}
                    <div style={{ position: "absolute", top: 10, left: 10, padding: "4px 10px", backgroundColor: "#dc3250", color: "#fff", fontSize: 10, fontWeight: 500, letterSpacing: "0.1em", fontFamily: FONT_SERIF, animation: "pulse 1.5s infinite" }}>
                      🔴 LIVE
                    </div>
                    {/* 視聴者数 */}
                    <div style={{ position: "absolute", top: 10, right: 10, padding: "4px 10px", backgroundColor: "rgba(0,0,0,0.7)", color: "#fff", fontSize: 11, fontFamily: FONT_SERIF }}>
                      👥 {s.viewerCount}
                    </div>
                    {/* 会員限定マーク */}
                    {s.visibility === "members_only" && (
                      <div style={{ position: "absolute", bottom: 10, right: 10, padding: "4px 10px", backgroundColor: "rgba(232, 132, 154, 0.9)", color: "#fff", fontSize: 10, fontFamily: FONT_SERIF, letterSpacing: "0.05em" }}>
                        💗 会員限定
                      </div>
                    )}
                  </div>

                  {/* 情報 */}
                  <div style={{ padding: 12 }}>
                    <p style={{ fontSize: 13, color: SITE.color.text, fontWeight: 500, marginBottom: 4, lineHeight: 1.5 }}>
                      {s.title}
                    </p>
                    <p style={{ fontSize: 11, color: SITE.color.textSub, marginBottom: 8, fontFamily: FONT_DISPLAY, letterSpacing: "0.1em" }}>
                      {s.therapist.name}
                    </p>
                    {s.description && (
                      <p style={{ fontSize: 10, color: SITE.color.textMuted, lineHeight: 1.6, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                        {s.description}
                      </p>
                    )}
                  </div>
                </article>
              </Link>
            ))}
          </div>
        )}

        <style>{`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.7; }
          }
        `}</style>
      </div>
    </main>
  );
}
