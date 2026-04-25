"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { SITE, MARBLE } from "../../../lib/site-theme";
import { useCustomerAuth } from "../../../lib/customer-auth-context";
import StoryRing from "../../../components/site/StoryRing";

/**
 * Ange Spa 写メ日記 タイムライン
 *
 * 方針 (■19・■20 準拠):
 *  - ホワイト基調、明朝統一、絵文字非使用
 *  - 全公開投稿のみ表示
 *  - 会員ログイン時のみ「会員限定」タブを表示
 *  - 非会員には会員登録の誘導バナーを表示
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

type PopularTag = {
  id: number;
  name: string;
  displayName: string;
  color: string | null;
  isFeatured: boolean;
  useCount: number;
};

type ViewMode = "public" | "members_only";

export default function DiaryTimelinePage() {
  const { customer } = useCustomerAuth();
  const isLoggedIn = !!customer;

  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [tags, setTags] = useState<PopularTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("public");
  const [activeTag, setActiveTag] = useState<string>("");
  const [searchQ, setSearchQ] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);

  const LIMIT = 20;

  // ════════════════════════════════════════════════════
  // データ取得
  // ════════════════════════════════════════════════════
  const fetchEntries = useCallback(
    async (resetOffset: boolean) => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("visibility", viewMode);
        params.set("limit", String(LIMIT));
        params.set("offset", resetOffset ? "0" : String(offset));
        if (activeTag) params.set("tag", activeTag);
        if (searchQ.trim()) params.set("q", searchQ.trim());
        if (viewMode === "members_only" && customer) {
          // 会員認証 (簡易: customer.id を渡す)
          params.set("memberAuth", String(customer.id));
        }

        const res = await fetch(`/api/diary/list?${params.toString()}`);
        const data = await res.json();
        if (res.ok) {
          if (resetOffset) {
            setEntries(data.entries || []);
            setOffset(LIMIT);
          } else {
            setEntries((prev) => [...prev, ...(data.entries || [])]);
            setOffset((prev) => prev + LIMIT);
          }
          setHasMore(data.hasMore || false);
        }
      } catch (e) {
        console.error("fetch entries:", e);
      } finally {
        setLoading(false);
      }
    },
    [viewMode, activeTag, searchQ, offset, customer]
  );

  const fetchTags = useCallback(async () => {
    try {
      const res = await fetch("/api/diary/tags/popular?limit=20");
      const data = await res.json();
      if (res.ok && data.tags) setTags(data.tags);
    } catch (e) {
      console.error("fetch tags:", e);
    }
  }, []);

  useEffect(() => {
    fetchTags();
  }, [fetchTags]);

  useEffect(() => {
    fetchEntries(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, activeTag, searchQ]);

  const submitSearch = () => {
    setSearchQ(searchInput.trim());
  };

  // ════════════════════════════════════════════════════
  // 日付グループ化
  // ════════════════════════════════════════════════════
  const groupedByDate = useMemo(() => {
    const groups: Record<string, DiaryEntry[]> = {};
    for (const e of entries) {
      const d = new Date(e.publishedAt);
      const key = `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(e);
    }
    return groups;
  }, [entries]);

  // ════════════════════════════════════════════════════
  // ヘルパー
  // ════════════════════════════════════════════════════
  const fmtTime = (iso: string) => {
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  // ════════════════════════════════════════════════════
  // レンダリング
  // ════════════════════════════════════════════════════
  return (
    <div style={{ ...MARBLE.pink, minHeight: "100vh", paddingBottom: 80 }}>
      {/* ヒーロー */}
      <div style={{ padding: "60px 20px 40px", textAlign: "center" }}>
        <p
          style={{
            fontFamily: SITE.font.display,
            fontSize: SITE.fs.sm,
            letterSpacing: SITE.ls.wider,
            color: SITE.color.pink,
            marginBottom: 12,
            fontWeight: 500,
          }}
        >
          DIARY
        </p>
        <h1
          style={{
            fontFamily: SITE.font.serif,
            fontSize: SITE.fs.h1,
            color: SITE.color.text,
            fontWeight: 500,
            letterSpacing: SITE.ls.loose,
            marginBottom: 16,
            lineHeight: SITE.lh.heading,
          }}
        >
          写メ日記
        </h1>
        <div
          style={{
            width: 50,
            height: 1,
            backgroundColor: SITE.color.pink,
            margin: "0 auto 16px",
          }}
        />
        <p
          style={{
            fontFamily: SITE.font.serif,
            fontSize: SITE.fs.body,
            color: SITE.color.textSub,
            lineHeight: SITE.lh.body,
            maxWidth: 480,
            margin: "0 auto",
          }}
        >
          セラピストたちの日常を、ありのままお届け
        </p>
      </div>

      {/* コンテンツコンテナ */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 16px" }}>
        {/* ストーリーリング (24時間限定、公開中の投稿があるときだけ表示) */}
        <StoryRing />

        {/* ライブ配信導線 */}
        <div style={{ marginBottom: 20, textAlign: "center" }}>
          <a
            href="/diary/live"
            style={{
              display: "inline-block",
              padding: "10px 24px",
              fontSize: 12,
              color: "#fff",
              background: "linear-gradient(135deg, #dc3250 0%, #e8849a 100%)",
              textDecoration: "none",
              fontFamily: "'Noto Serif JP', serif",
              letterSpacing: "0.1em",
              fontWeight: 500,
              boxShadow: "0 2px 8px rgba(220, 50, 80, 0.25)",
            }}
          >
            🔴 LIVE 配信中のセラピストを見る →
          </a>
        </div>

        {/* 公開/会員限定タブ */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            marginBottom: 24,
            borderBottom: `1px solid ${SITE.color.border}`,
          }}
        >
          <button
            onClick={() => setViewMode("public")}
            style={{
              padding: "14px 28px",
              fontSize: SITE.fs.body,
              cursor: "pointer",
              backgroundColor: "transparent",
              border: "none",
              borderBottom: viewMode === "public" ? `2px solid ${SITE.color.pinkDeep}` : "2px solid transparent",
              color: viewMode === "public" ? SITE.color.pinkDeep : SITE.color.textSub,
              fontWeight: viewMode === "public" ? 500 : 400,
              fontFamily: SITE.font.serif,
              letterSpacing: SITE.ls.loose,
              marginBottom: -1,
            }}
          >
            すべての日記
          </button>
          {isLoggedIn && (
            <button
              onClick={() => setViewMode("members_only")}
              style={{
                padding: "14px 28px",
                fontSize: SITE.fs.body,
                cursor: "pointer",
                backgroundColor: "transparent",
                border: "none",
                borderBottom: viewMode === "members_only" ? `2px solid ${SITE.color.pinkDeep}` : "2px solid transparent",
                color: viewMode === "members_only" ? SITE.color.pinkDeep : SITE.color.textSub,
                fontWeight: viewMode === "members_only" ? 500 : 400,
                fontFamily: SITE.font.serif,
                letterSpacing: SITE.ls.loose,
                marginBottom: -1,
              }}
            >
              会員限定
            </button>
          )}
        </div>

        {/* 非会員向け誘導バナー */}
        {!isLoggedIn && viewMode === "public" && (
          <div
            style={{
              padding: 24,
              backgroundColor: SITE.color.surface,
              border: `1px solid ${SITE.color.borderPink}`,
              marginBottom: 24,
              textAlign: "center",
            }}
          >
            <p
              style={{
                fontFamily: SITE.font.display,
                fontSize: SITE.fs.tiny,
                letterSpacing: SITE.ls.wider,
                color: SITE.color.pinkDeep,
                marginBottom: 8,
                fontWeight: 500,
              }}
            >
              MEMBERS ONLY
            </p>
            <p
              style={{
                fontFamily: SITE.font.serif,
                fontSize: SITE.fs.lead,
                color: SITE.color.text,
                marginBottom: 8,
                lineHeight: SITE.lh.heading,
                letterSpacing: SITE.ls.normal,
              }}
            >
              会員様だけが見られる、特別な日記
            </p>
            <p
              style={{
                fontFamily: SITE.font.serif,
                fontSize: SITE.fs.sm,
                color: SITE.color.textSub,
                marginBottom: 16,
                lineHeight: SITE.lh.body,
              }}
            >
              無料の会員登録で、限定コンテンツがご覧いただけます
            </p>
            <Link
              href="/login"
              style={{
                display: "inline-block",
                padding: "12px 36px",
                fontSize: SITE.fs.sm,
                backgroundColor: SITE.color.pink,
                color: "#fff",
                textDecoration: "none",
                fontFamily: SITE.font.serif,
                letterSpacing: SITE.ls.loose,
              }}
            >
              会員登録はこちら
            </Link>
          </div>
        )}

        {/* タグフィルタ */}
        {tags.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <p
              style={{
                fontFamily: SITE.font.display,
                fontSize: SITE.fs.tiny,
                letterSpacing: SITE.ls.wider,
                color: SITE.color.textMuted,
                marginBottom: 10,
                fontWeight: 500,
              }}
            >
              TAGS
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              <button
                onClick={() => setActiveTag("")}
                style={{
                  padding: "5px 12px",
                  fontSize: SITE.fs.xs,
                  cursor: "pointer",
                  backgroundColor: !activeTag ? SITE.color.pink : "transparent",
                  color: !activeTag ? "#fff" : SITE.color.textSub,
                  border: `1px solid ${!activeTag ? SITE.color.pink : SITE.color.border}`,
                  fontFamily: SITE.font.serif,
                  letterSpacing: SITE.ls.normal,
                }}
              >
                すべて
              </button>
              {tags.map((tag) => (
                <button
                  key={tag.id}
                  onClick={() => setActiveTag(activeTag === tag.name ? "" : tag.name)}
                  style={{
                    padding: "5px 12px",
                    fontSize: SITE.fs.xs,
                    cursor: "pointer",
                    backgroundColor: activeTag === tag.name ? SITE.color.pink : "transparent",
                    color: activeTag === tag.name ? "#fff" : SITE.color.textSub,
                    border: `1px solid ${activeTag === tag.name ? SITE.color.pink : SITE.color.border}`,
                    fontFamily: SITE.font.serif,
                    letterSpacing: SITE.ls.normal,
                  }}
                >
                  {tag.displayName}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 検索 */}
        <div style={{ marginBottom: 30, display: "flex", gap: 8 }}>
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitSearch();
            }}
            placeholder="キーワードで検索"
            style={{
              flex: 1,
              padding: "10px 14px",
              fontSize: SITE.fs.sm,
              backgroundColor: SITE.color.surface,
              border: `1px solid ${SITE.color.border}`,
              color: SITE.color.text,
              fontFamily: SITE.font.serif,
              outline: "none",
              letterSpacing: SITE.ls.normal,
            }}
          />
          <button
            onClick={submitSearch}
            style={{
              padding: "10px 24px",
              fontSize: SITE.fs.sm,
              cursor: "pointer",
              backgroundColor: SITE.color.text,
              color: "#fff",
              border: "none",
              fontFamily: SITE.font.serif,
              letterSpacing: SITE.ls.loose,
            }}
          >
            検索
          </button>
        </div>

        {/* タイムライン */}
        {loading && entries.length === 0 ? (
          <p
            style={{
              textAlign: "center",
              padding: 60,
              fontFamily: SITE.font.serif,
              color: SITE.color.textMuted,
              fontSize: SITE.fs.sm,
            }}
          >
            読み込み中...
          </p>
        ) : entries.length === 0 ? (
          <div
            style={{
              padding: 60,
              textAlign: "center",
              backgroundColor: SITE.color.surface,
              border: `1px solid ${SITE.color.border}`,
            }}
          >
            <p
              style={{
                fontFamily: SITE.font.serif,
                fontSize: SITE.fs.lead,
                color: SITE.color.textSub,
                lineHeight: SITE.lh.body,
                letterSpacing: SITE.ls.loose,
              }}
            >
              {viewMode === "members_only" ? "会員限定の日記はまだありません" : "まだ日記が投稿されていません"}
            </p>
          </div>
        ) : (
          <>
            {(Object.entries(groupedByDate) as [string, DiaryEntry[]][]).map(([dateLabel, dayEntries]) => (
              <div key={dateLabel} style={{ marginBottom: 36 }}>
                {/* 日付見出し */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    marginBottom: 16,
                  }}
                >
                  <p
                    style={{
                      fontFamily: SITE.font.display,
                      fontSize: SITE.fs.sm,
                      letterSpacing: SITE.ls.wider,
                      color: SITE.color.pinkDeep,
                      fontWeight: 500,
                    }}
                  >
                    {dateLabel}
                  </p>
                  <div
                    style={{
                      flex: 1,
                      height: 1,
                      backgroundColor: SITE.color.border,
                    }}
                  />
                </div>

                {/* グリッド */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                    gap: 14,
                  }}
                >
                  {dayEntries.map((entry) => (
                    <Link
                      key={entry.id}
                      href={`/diary/${entry.id}`}
                      style={{
                        textDecoration: "none",
                        color: "inherit",
                        backgroundColor: SITE.color.surface,
                        border: `1px solid ${SITE.color.border}`,
                        display: "flex",
                        flexDirection: "column",
                        transition: "transform 0.2s ease, box-shadow 0.2s ease",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = "translateY(-2px)";
                        e.currentTarget.style.boxShadow = "0 6px 20px rgba(0,0,0,0.06)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = "translateY(0)";
                        e.currentTarget.style.boxShadow = "none";
                      }}
                    >
                      {/* カバー画像 */}
                      <div
                        style={{
                          width: "100%",
                          aspectRatio: "1",
                          backgroundColor: SITE.color.surfaceAlt,
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
                              top: 8,
                              right: 8,
                              padding: "2px 8px",
                              fontSize: 10,
                              backgroundColor: "rgba(0,0,0,0.6)",
                              color: "#fff",
                              fontFamily: SITE.font.display,
                              letterSpacing: SITE.ls.normal,
                            }}
                          >
                            {entry.imageCount}枚
                          </span>
                        )}
                        {entry.visibility === "members_only" && (
                          <span
                            style={{
                              position: "absolute",
                              top: 8,
                              left: 8,
                              padding: "2px 8px",
                              fontSize: 10,
                              backgroundColor: SITE.color.pinkDeep,
                              color: "#fff",
                              fontFamily: SITE.font.serif,
                              letterSpacing: SITE.ls.normal,
                            }}
                          >
                            会員限定
                          </span>
                        )}
                      </div>

                      {/* 本体 */}
                      <div
                        style={{
                          padding: "12px 14px 14px",
                          display: "flex",
                          flexDirection: "column",
                          gap: 6,
                          flex: 1,
                        }}
                      >
                        <p
                          style={{
                            fontFamily: SITE.font.display,
                            fontSize: SITE.fs.tiny,
                            letterSpacing: SITE.ls.wider,
                            color: SITE.color.pinkDeep,
                            fontWeight: 500,
                          }}
                        >
                          {entry.therapist.name}
                        </p>
                        <p
                          style={{
                            fontFamily: SITE.font.serif,
                            fontSize: SITE.fs.body,
                            color: SITE.color.text,
                            fontWeight: 500,
                            lineHeight: 1.5,
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                            letterSpacing: SITE.ls.normal,
                          }}
                        >
                          {entry.title}
                        </p>
                        <p
                          style={{
                            fontFamily: SITE.font.serif,
                            fontSize: SITE.fs.xs,
                            color: SITE.color.textSub,
                            lineHeight: 1.6,
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                            letterSpacing: SITE.ls.normal,
                          }}
                        >
                          {entry.bodyPreview}
                        </p>

                        {/* タグ */}
                        {entry.tags.length > 0 && (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
                            {entry.tags.slice(0, 3).map((tag) => (
                              <span
                                key={tag.id}
                                style={{
                                  fontSize: 10,
                                  color: SITE.color.pinkDeep,
                                  fontFamily: SITE.font.serif,
                                }}
                              >
                                {tag.displayName}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* メタ */}
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginTop: "auto",
                            paddingTop: 6,
                            fontSize: 10,
                            color: SITE.color.textMuted,
                            fontFamily: SITE.font.display,
                            letterSpacing: SITE.ls.normal,
                          }}
                        >
                          <span>{fmtTime(entry.publishedAt)}</span>
                          <span style={{ display: "flex", gap: 10, alignItems: "center" }}>
                            {entry.likeCount > 0 && (
                              <span style={{ display: "flex", alignItems: "center", gap: 3, color: SITE.color.pinkDeep }}>
                                <span style={{ fontSize: 11 }}>♥</span>
                                <span>{entry.likeCount.toLocaleString()}</span>
                              </span>
                            )}
                            <span>{entry.viewCount.toLocaleString()} views</span>
                          </span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ))}

            {/* もっと読む */}
            {hasMore && (
              <div style={{ textAlign: "center", marginTop: 30 }}>
                <button
                  onClick={() => fetchEntries(false)}
                  disabled={loading}
                  style={{
                    padding: "12px 36px",
                    fontSize: SITE.fs.sm,
                    cursor: loading ? "not-allowed" : "pointer",
                    backgroundColor: "transparent",
                    color: SITE.color.text,
                    border: `1px solid ${SITE.color.text}`,
                    fontFamily: SITE.font.serif,
                    letterSpacing: SITE.ls.loose,
                    opacity: loading ? 0.5 : 1,
                  }}
                >
                  {loading ? "読み込み中..." : "もっと読む"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
