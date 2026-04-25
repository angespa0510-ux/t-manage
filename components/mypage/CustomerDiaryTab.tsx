"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";

/**
 * お客様マイページ用 写メ日記タブ
 *
 * 機能:
 *   - 全公開 + 会員限定 (会員のみ) の切替
 *   - お気に入りセラピストのみフィルタ
 *   - 日付グループ表示
 *   - 個別記事ページ /diary/[id] へリンク
 */

type DiaryEntry = {
  id: number;
  therapist: { id: number; name: string };
  title: string;
  bodyPreview: string;
  coverImageUrl: string | null;
  imageCount: number;
  visibility: "public" | "members_only";
  tags: { id: number; name: string; displayName: string; color: string | null }[];
  likeCount: number;
  commentCount: number;
  viewCount: number;
  publishedAt: string;
};

type CustomerColors = {
  bg: string;
  card: string;
  cardAlt?: string;
  cardSoft?: string;
  border: string;
  borderPink?: string;
  text: string;
  textSub: string;
  textMuted: string;
  textFaint?: string;
  accent: string;
  accentBg?: string;
  accentSoft?: string;
  accentDark: string;
};

type Props = {
  customerId: number;
  C: CustomerColors;
  FONT_SERIF: string;
  FONT_DISPLAY: string;
};

type ViewMode = "all" | "members_only" | "favorites";

export default function CustomerDiaryTab({ customerId, C, FONT_SERIF, FONT_DISPLAY }: Props) {
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("all");
  const [favoriteIds, setFavoriteIds] = useState<number[]>([]);

  // ════════════════════════════════════════════════════
  // データ取得
  // ════════════════════════════════════════════════════
  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("limit", "30");
      // 会員限定のみ表示モード
      if (viewMode === "members_only") {
        params.set("visibility", "members_only");
        params.set("memberAuth", String(customerId));
      } else if (viewMode === "favorites") {
        // お気に入りセラピストの全公開+会員限定
        if (favoriteIds.length === 0) {
          setEntries([]);
          setLoading(false);
          return;
        }
        params.set("visibility", "all");
        params.set("memberAuth", String(customerId));
        params.set("therapistIds", favoriteIds.join(","));
      } else {
        params.set("visibility", "public");
      }

      const res = await fetch(`/api/diary/list?${params.toString()}`);
      const data = await res.json();
      if (res.ok) {
        setEntries(data.entries || []);
      }
    } catch (e) {
      console.error("fetch diary:", e);
    } finally {
      setLoading(false);
    }
  }, [viewMode, customerId, favoriteIds]);

  // お気に入りセラピスト取得
  const fetchFavorites = useCallback(async () => {
    try {
      const res = await fetch(`/api/diary/favorite?customerId=${customerId}`);
      const data = await res.json();
      if (res.ok && data.therapistIds) {
        setFavoriteIds(data.therapistIds);
      }
    } catch (e) {
      console.error("fetch favorites:", e);
    }
  }, [customerId]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  useEffect(() => {
    fetchFavorites();
  }, [fetchFavorites]);

  // ════════════════════════════════════════════════════
  // 表示用フィルタ (APIで絞ってるのでそのまま)
  // ════════════════════════════════════════════════════
  const filtered = entries;

  // 日付グループ化
  const grouped = useMemo(() => {
    const groups: Record<string, DiaryEntry[]> = {};
    for (const e of filtered) {
      const d = new Date(e.publishedAt);
      const key = `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(e);
    }
    return groups;
  }, [filtered]);

  const fmtTime = (iso: string) => {
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  // ════════════════════════════════════════════════════
  // レンダリング
  // ════════════════════════════════════════════════════
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, fontFamily: FONT_SERIF }}>
      {/* 見出し */}
      <div style={{ textAlign: "center", marginBottom: 4, paddingTop: 8 }}>
        <p style={{ margin: 0, fontFamily: FONT_DISPLAY, fontSize: 11, letterSpacing: "0.25em", color: C.accent, textTransform: "uppercase" }}>
          Diary
        </p>
        <p style={{ margin: "6px 0 8px", fontSize: 14, color: C.text, letterSpacing: "0.08em", fontWeight: 500 }}>
          写メ日記
        </p>
        <div style={{ width: 30, height: 1, backgroundColor: C.accent, margin: "0 auto" }} />
      </div>

      {/* 切替タブ */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 0, border: `1px solid ${C.border}`, backgroundColor: C.card }}>
        {[
          { key: "all" as const, label: "すべて" },
          { key: "members_only" as const, label: "会員限定" },
          { key: "favorites" as const, label: "お気に入り" },
        ].map((t, i) => (
          <button
            key={t.key}
            onClick={() => setViewMode(t.key)}
            style={{
              padding: "10px 4px",
              fontSize: 11,
              cursor: "pointer",
              border: "none",
              borderLeft: i > 0 ? `1px solid ${C.border}` : "none",
              backgroundColor: viewMode === t.key ? C.accent : "transparent",
              color: viewMode === t.key ? "#fff" : C.textSub,
              fontFamily: FONT_SERIF,
              letterSpacing: "0.08em",
              fontWeight: viewMode === t.key ? 500 : 400,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* お気に入り未登録メッセージ */}
      {viewMode === "favorites" && favoriteIds.length === 0 && !loading && (
        <div style={{ padding: 24, textAlign: "center", backgroundColor: C.card, border: `1px solid ${C.border}` }}>
          <p style={{ fontSize: 12, color: C.textSub, lineHeight: 1.7, marginBottom: 12 }}>
            まだお気に入りセラピストがいません<br />
            セラピスト紹介ページからお気に入り登録しましょう
          </p>
          <Link
            href="/therapist"
            style={{
              display: "inline-block",
              padding: "8px 20px",
              fontSize: 11,
              backgroundColor: C.accent,
              color: "#fff",
              textDecoration: "none",
              fontFamily: FONT_SERIF,
              letterSpacing: "0.1em",
            }}
          >
            セラピストを見る
          </Link>
        </div>
      )}

      {/* タイムライン */}
      {loading ? (
        <p style={{ textAlign: "center", padding: 30, color: C.textMuted, fontSize: 11 }}>読み込み中...</p>
      ) : Object.keys(grouped).length === 0 ? (
        viewMode !== "favorites" && (
          <div style={{ padding: 30, textAlign: "center", backgroundColor: C.card, border: `1px solid ${C.border}` }}>
            <p style={{ fontSize: 12, color: C.textSub }}>
              {viewMode === "members_only" ? "会員限定の日記はまだありません" : "まだ日記がありません"}
            </p>
          </div>
        )
      ) : (
        (Object.entries(grouped) as [string, DiaryEntry[]][]).map(([dateLabel, dayEntries]) => (
          <div key={dateLabel} style={{ marginBottom: 8 }}>
            {/* 日付見出し */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <p
                style={{
                  fontFamily: FONT_DISPLAY,
                  fontSize: 11,
                  letterSpacing: "0.2em",
                  color: C.accentDark,
                  fontWeight: 500,
                }}
              >
                {dateLabel}
              </p>
              <div style={{ flex: 1, height: 1, backgroundColor: C.border }} />
            </div>

            {/* グリッド (2列) */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {dayEntries.map((entry) => (
                <Link
                  key={entry.id}
                  href={`/diary/${entry.id}`}
                  style={{
                    textDecoration: "none",
                    color: "inherit",
                    backgroundColor: C.card,
                    border: `1px solid ${C.border}`,
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  {/* カバー */}
                  <div
                    style={{
                      width: "100%",
                      aspectRatio: "1",
                      backgroundColor: C.cardSoft || C.cardAlt || C.card,
                      backgroundImage: entry.coverImageUrl ? `url(${entry.coverImageUrl})` : undefined,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                      position: "relative",
                    }}
                  >
                    {entry.imageCount > 1 && (
                      <span
                        style={{
                          position: "absolute",
                          top: 6,
                          right: 6,
                          padding: "2px 6px",
                          fontSize: 9,
                          backgroundColor: "rgba(0,0,0,0.6)",
                          color: "#fff",
                          fontFamily: FONT_DISPLAY,
                        }}
                      >
                        {entry.imageCount}
                      </span>
                    )}
                    {entry.visibility === "members_only" && (
                      <span
                        style={{
                          position: "absolute",
                          top: 6,
                          left: 6,
                          padding: "2px 6px",
                          fontSize: 9,
                          backgroundColor: C.accent,
                          color: "#fff",
                          fontFamily: FONT_SERIF,
                          letterSpacing: "0.05em",
                        }}
                      >
                        限定
                      </span>
                    )}
                  </div>

                  {/* テキスト */}
                  <div style={{ padding: "8px 10px 10px", flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
                    <p
                      style={{
                        fontFamily: FONT_DISPLAY,
                        fontSize: 9,
                        letterSpacing: "0.15em",
                        color: C.accent,
                        fontWeight: 500,
                      }}
                    >
                      {entry.therapist.name}
                    </p>
                    <p
                      style={{
                        fontFamily: FONT_SERIF,
                        fontSize: 12,
                        color: C.text,
                        fontWeight: 500,
                        lineHeight: 1.4,
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                    >
                      {entry.title}
                    </p>
                    <p
                      style={{
                        marginTop: "auto",
                        fontFamily: FONT_DISPLAY,
                        fontSize: 9,
                        color: C.textMuted,
                        letterSpacing: "0.1em",
                      }}
                    >
                      {fmtTime(entry.publishedAt)}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ))
      )}

      {/* もっと見る (タイムラインへ) */}
      {!loading && entries.length > 0 && (
        <div style={{ textAlign: "center", marginTop: 12 }}>
          <Link
            href="/diary"
            style={{
              display: "inline-block",
              padding: "10px 24px",
              fontSize: 11,
              backgroundColor: "transparent",
              color: C.accent,
              border: `1px solid ${C.accent}`,
              textDecoration: "none",
              fontFamily: FONT_SERIF,
              letterSpacing: "0.15em",
            }}
          >
            すべての日記を見る
          </Link>
        </div>
      )}
    </div>
  );
}
