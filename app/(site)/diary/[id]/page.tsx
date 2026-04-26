"use client";

import { useState, useEffect, useCallback, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SITE, MARBLE } from "../../../../lib/site-theme";
import { useCustomerAuth } from "../../../../lib/customer-auth-context";
import DiaryComments from "../../../../components/site/DiaryComments";
import GiftModal from "../../../../components/gift-modal";

/**
 * Ange Spa 写メ日記 個別ページ
 *
 * 機能:
 *   - 画像スライダー (タップ/スワイプで進む)
 *   - 本文・タグ・統計表示
 *   - 会員限定の場合、非会員には誘導画面
 *   - 同じセラピストの最新記事へのリンク
 */

type Entry = {
  id: number;
  title: string;
  body: string;
  coverImageUrl: string | null;
  visibility: "public" | "members_only";
  viewCount: number;
  likeCount: number;
  commentCount: number;
  publishedAt: string;
};

type Therapist = { id: number; name: string };

type ImageItem = {
  id: number;
  imageUrl: string;
  thumbnailUrl: string | null;
  sortOrder: number;
  width: number | null;
  height: number | null;
  caption: string | null;
};

type Tag = { id: number; name: string; displayName: string; color: string | null };

type DetailRes = {
  entry?: Entry;
  therapist?: Therapist;
  images?: ImageItem[];
  tags?: Tag[];
  error?: string;
  requiresMembership?: boolean;
  previewTitle?: string;
  previewCoverUrl?: string;
};

type RelatedEntry = {
  id: number;
  title: string;
  coverImageUrl: string | null;
  publishedAt: string;
};

export default function DiaryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { customer } = useCustomerAuth();

  const [data, setData] = useState<DetailRes | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const [related, setRelated] = useState<RelatedEntry[]>([]);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [giftModalOpen, setGiftModalOpen] = useState(false);
  const [giftSentMsg, setGiftSentMsg] = useState<string | null>(null);
  const [likeLoading, setLikeLoading] = useState(false);
  const [likeAnimating, setLikeAnimating] = useState(false);
  const [favorited, setFavorited] = useState(false);
  const [notifyEnabled, setNotifyEnabled] = useState(true);
  const [favLoading, setFavLoading] = useState(false);

  // ════════════════════════════════════════════════════
  // データ取得
  // ════════════════════════════════════════════════════
  const fetchDetail = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (customer) params.set("memberAuth", String(customer.id));

      const res = await fetch(`/api/diary/${id}?${params.toString()}`);
      const json = await res.json();
      if (res.ok) {
        setData(json);
        setActiveImageIdx(0);
        if (json.entry) {
          setLikeCount(json.entry.likeCount || 0);
        }
      } else if (res.status === 401 && json.requiresMembership) {
        // 会員限定: 誘導画面を出す
        setData(json);
      } else {
        setError(json.error || "投稿が見つかりません");
      }
    } catch {
      setError("通信エラー");
    } finally {
      setLoading(false);
    }
  }, [id, customer]);

  // いいね状態取得
  const fetchLikeStatus = useCallback(async () => {
    if (!customer) {
      setLiked(false);
      return;
    }
    try {
      const res = await fetch(`/api/diary/like?entryId=${id}&customerId=${customer.id}`);
      const json = await res.json();
      if (res.ok) {
        setLiked(json.liked);
        setLikeCount(json.likeCount);
      }
    } catch (e) {
      console.error(e);
    }
  }, [id, customer]);

  // いいねトグル
  const toggleLike = async () => {
    if (!customer) {
      // 非会員: ログインへ誘導
      window.location.href = "/login";
      return;
    }
    if (likeLoading) return;
    setLikeLoading(true);
    setLikeAnimating(true);
    setTimeout(() => setLikeAnimating(false), 400);

    // 楽観的更新
    const prevLiked = liked;
    const prevCount = likeCount;
    setLiked(!prevLiked);
    setLikeCount(prevCount + (prevLiked ? -1 : 1));

    try {
      const res = await fetch("/api/diary/like", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryId: id, customerId: customer.id }),
      });
      const json = await res.json();
      if (res.ok) {
        setLiked(json.liked);
        setLikeCount(json.likeCount);
      } else {
        // 失敗時は戻す
        setLiked(prevLiked);
        setLikeCount(prevCount);
      }
    } catch {
      setLiked(prevLiked);
      setLikeCount(prevCount);
    } finally {
      setLikeLoading(false);
    }
  };

  // お気に入り状態取得
  const fetchFavoriteStatus = useCallback(async (therapistId: number) => {
    if (!customer) {
      setFavorited(false);
      return;
    }
    try {
      const res = await fetch(`/api/diary/favorite?customerId=${customer.id}`);
      const json = await res.json();
      if (res.ok && json.therapistIds) {
        const found = json.therapistIds.includes(therapistId);
        setFavorited(found);
        if (found && json.items) {
          const item = json.items.find((i: { therapist: { id: number }; notifyOnPost: boolean }) => i.therapist.id === therapistId);
          if (item) setNotifyEnabled(item.notifyOnPost);
        }
      }
    } catch (e) {
      console.error(e);
    }
  }, [customer]);

  // お気に入りトグル
  const toggleFavorite = async (therapistId: number) => {
    if (!customer) {
      window.location.href = "/login";
      return;
    }
    if (favLoading) return;
    setFavLoading(true);
    const prev = favorited;
    setFavorited(!prev);
    try {
      const res = await fetch("/api/diary/favorite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId: customer.id, therapistId, notifyOnPost: true }),
      });
      const json = await res.json();
      if (res.ok) {
        setFavorited(json.favorited);
        if (json.favorited) setNotifyEnabled(true);
      } else {
        setFavorited(prev);
      }
    } catch {
      setFavorited(prev);
    } finally {
      setFavLoading(false);
    }
  };

  // 通知ON/OFFトグル
  const toggleNotify = async (therapistId: number) => {
    if (!customer || !favorited) return;
    const newValue = !notifyEnabled;
    setNotifyEnabled(newValue);
    try {
      await fetch("/api/diary/favorite", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId: customer.id, therapistId, notifyOnPost: newValue }),
      });
    } catch {
      setNotifyEnabled(!newValue);
    }
  };

  const fetchRelated = useCallback(async (therapistId: number, currentId: number) => {
    try {
      const res = await fetch(`/api/diary/list?therapistId=${therapistId}&limit=8&visibility=public`);
      const j = await res.json();
      if (res.ok && j.entries) {
        const filtered = j.entries.filter((e: { id: number }) => e.id !== currentId).slice(0, 4);
        setRelated(filtered);
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  useEffect(() => {
    if (data?.therapist?.id && data?.entry?.id) {
      fetchRelated(data.therapist.id, data.entry.id);
    }
  }, [data, fetchRelated]);

  useEffect(() => {
    if (data?.entry?.id) {
      fetchLikeStatus();
    }
  }, [data, fetchLikeStatus]);

  useEffect(() => {
    if (data?.therapist?.id) {
      fetchFavoriteStatus(data.therapist.id);
    }
  }, [data, fetchFavoriteStatus]);

  // ════════════════════════════════════════════════════
  // ヘルパー
  // ════════════════════════════════════════════════════
  const fmtDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  // ════════════════════════════════════════════════════
  // ローディング
  // ════════════════════════════════════════════════════
  if (loading) {
    return (
      <div style={{ ...MARBLE.pink, minHeight: "100vh", padding: 80, textAlign: "center" }}>
        <p style={{ fontFamily: SITE.font.serif, color: SITE.color.textMuted, fontSize: SITE.fs.sm }}>
          読み込み中...
        </p>
      </div>
    );
  }

  // ════════════════════════════════════════════════════
  // エラー
  // ════════════════════════════════════════════════════
  if (error) {
    return (
      <div style={{ ...MARBLE.pink, minHeight: "100vh", padding: 80, textAlign: "center" }}>
        <p style={{ fontFamily: SITE.font.serif, color: SITE.color.textSub, fontSize: SITE.fs.body, marginBottom: 24 }}>
          {error}
        </p>
        <Link
          href="/diary"
          style={{
            display: "inline-block",
            padding: "10px 24px",
            fontSize: SITE.fs.sm,
            backgroundColor: "transparent",
            color: SITE.color.text,
            border: `1px solid ${SITE.color.text}`,
            textDecoration: "none",
            fontFamily: SITE.font.serif,
            letterSpacing: SITE.ls.loose,
          }}
        >
          一覧に戻る
        </Link>
      </div>
    );
  }

  // ════════════════════════════════════════════════════
  // 会員限定: 非会員向け誘導
  // ════════════════════════════════════════════════════
  if (data?.requiresMembership) {
    return (
      <div style={{ ...MARBLE.pink, minHeight: "100vh", padding: "60px 20px" }}>
        <div
          style={{
            maxWidth: 480,
            margin: "0 auto",
            backgroundColor: SITE.color.surface,
            border: `1px solid ${SITE.color.borderPink}`,
            padding: 0,
            overflow: "hidden",
          }}
        >
          {/* ぼかしカバー画像 */}
          {data.previewCoverUrl && (
            <div
              style={{
                width: "100%",
                aspectRatio: "1",
                backgroundImage: `url(${data.previewCoverUrl})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                filter: "blur(20px)",
                position: "relative",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  backgroundColor: "rgba(255,255,255,0.4)",
                }}
              />
            </div>
          )}
          <div style={{ padding: 28, textAlign: "center" }}>
            <p
              style={{
                fontFamily: SITE.font.display,
                fontSize: SITE.fs.tiny,
                letterSpacing: SITE.ls.wider,
                color: SITE.color.pinkDeep,
                marginBottom: 12,
                fontWeight: 500,
              }}
            >
              MEMBERS ONLY
            </p>
            <p
              style={{
                fontFamily: SITE.font.serif,
                fontSize: SITE.fs.h3,
                color: SITE.color.text,
                marginBottom: 12,
                fontWeight: 500,
                letterSpacing: SITE.ls.loose,
                lineHeight: SITE.lh.heading,
              }}
            >
              {data.previewTitle || "会員限定の日記"}
            </p>
            <p
              style={{
                fontFamily: SITE.font.serif,
                fontSize: SITE.fs.sm,
                color: SITE.color.textSub,
                marginBottom: 24,
                lineHeight: SITE.lh.body,
              }}
            >
              この日記は会員様限定の特別な投稿です。<br />
              無料の会員登録で、続きをご覧いただけます。
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
                marginBottom: 12,
              }}
            >
              会員登録 / ログイン
            </Link>
            <br />
            <Link
              href="/diary"
              style={{
                fontSize: SITE.fs.xs,
                color: SITE.color.textMuted,
                textDecoration: "none",
                fontFamily: SITE.font.serif,
                letterSpacing: SITE.ls.normal,
              }}
            >
              ← 一覧に戻る
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════
  // 通常表示
  // ════════════════════════════════════════════════════
  if (!data?.entry || !data?.therapist) {
    return null;
  }

  const { entry, therapist, images = [], tags = [] } = data;
  const hasMultipleImages = images.length > 1;

  return (
    <div style={{ ...MARBLE.pink, minHeight: "100vh", paddingBottom: 60 }}>
      {/* 戻るリンク */}
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "20px 16px 0" }}>
        <button
          onClick={() => router.back()}
          style={{
            padding: "6px 14px",
            fontSize: SITE.fs.xs,
            cursor: "pointer",
            backgroundColor: "transparent",
            color: SITE.color.textSub,
            border: `1px solid ${SITE.color.border}`,
            fontFamily: SITE.font.serif,
            letterSpacing: SITE.ls.normal,
          }}
        >
          ← 一覧に戻る
        </button>
      </div>

      {/* メイン画像 */}
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "20px 16px 0" }}>
        <div
          style={{
            backgroundColor: SITE.color.surface,
            border: `1px solid ${SITE.color.border}`,
          }}
        >
          {/* メインビュー */}
          {images[activeImageIdx] && (
            <div
              style={{
                width: "100%",
                position: "relative",
                backgroundColor: SITE.color.surfaceAlt,
              }}
            >
              <img
                src={images[activeImageIdx].imageUrl}
                alt={entry.title}
                style={{
                  width: "100%",
                  height: "auto",
                  display: "block",
                }}
              />

              {/* スライダーナビ */}
              {hasMultipleImages && (
                <>
                  <button
                    onClick={() => setActiveImageIdx((i) => Math.max(0, i - 1))}
                    disabled={activeImageIdx === 0}
                    style={{
                      position: "absolute",
                      top: "50%",
                      left: 12,
                      transform: "translateY(-50%)",
                      width: 38,
                      height: 38,
                      cursor: activeImageIdx === 0 ? "not-allowed" : "pointer",
                      backgroundColor: "rgba(255,255,255,0.85)",
                      border: "none",
                      fontSize: 18,
                      color: SITE.color.text,
                      fontFamily: SITE.font.display,
                      opacity: activeImageIdx === 0 ? 0.3 : 1,
                    }}
                  >
                    ‹
                  </button>
                  <button
                    onClick={() => setActiveImageIdx((i) => Math.min(images.length - 1, i + 1))}
                    disabled={activeImageIdx === images.length - 1}
                    style={{
                      position: "absolute",
                      top: "50%",
                      right: 12,
                      transform: "translateY(-50%)",
                      width: 38,
                      height: 38,
                      cursor: activeImageIdx === images.length - 1 ? "not-allowed" : "pointer",
                      backgroundColor: "rgba(255,255,255,0.85)",
                      border: "none",
                      fontSize: 18,
                      color: SITE.color.text,
                      fontFamily: SITE.font.display,
                      opacity: activeImageIdx === images.length - 1 ? 0.3 : 1,
                    }}
                  >
                    ›
                  </button>

                  {/* 枚数表示 */}
                  <span
                    style={{
                      position: "absolute",
                      bottom: 12,
                      right: 12,
                      padding: "4px 10px",
                      backgroundColor: "rgba(0,0,0,0.6)",
                      color: "#fff",
                      fontSize: SITE.fs.xs,
                      fontFamily: SITE.font.display,
                      letterSpacing: SITE.ls.normal,
                    }}
                  >
                    {activeImageIdx + 1} / {images.length}
                  </span>
                </>
              )}
            </div>
          )}

          {/* サムネイル */}
          {hasMultipleImages && (
            <div
              style={{
                display: "flex",
                gap: 6,
                padding: 10,
                overflowX: "auto",
                borderTop: `1px solid ${SITE.color.border}`,
              }}
            >
              {images.map((img, i) => (
                <button
                  key={img.id}
                  onClick={() => setActiveImageIdx(i)}
                  style={{
                    flexShrink: 0,
                    width: 60,
                    height: 60,
                    backgroundImage: `url(${img.thumbnailUrl || img.imageUrl})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    border: `2px solid ${activeImageIdx === i ? SITE.color.pink : "transparent"}`,
                    cursor: "pointer",
                    backgroundColor: SITE.color.surfaceAlt,
                  }}
                  aria-label={`画像 ${i + 1}`}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 本文 */}
      <article
        style={{
          maxWidth: 720,
          margin: "0 auto",
          padding: "30px 20px 0",
        }}
      >
        {/* 会員限定バッジ */}
        {entry.visibility === "members_only" && (
          <div style={{ marginBottom: 16 }}>
            <span
              style={{
                display: "inline-block",
                padding: "4px 12px",
                fontSize: SITE.fs.tiny,
                backgroundColor: SITE.color.pinkDeep,
                color: "#fff",
                fontFamily: SITE.font.serif,
                letterSpacing: SITE.ls.wider,
              }}
            >
              MEMBERS ONLY
            </span>
          </div>
        )}

        {/* タイトル */}
        <h1
          style={{
            fontFamily: SITE.font.serif,
            fontSize: SITE.fs.h2,
            color: SITE.color.text,
            fontWeight: 500,
            lineHeight: SITE.lh.heading,
            letterSpacing: SITE.ls.loose,
            marginBottom: 20,
          }}
        >
          {entry.title}
        </h1>

        {/* セラピスト・日付 */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 28,
            paddingBottom: 20,
            borderBottom: `1px solid ${SITE.color.border}`,
          }}
        >
          <Link
            href={`/therapist/${therapist.id}`}
            style={{
              fontFamily: SITE.font.display,
              fontSize: SITE.fs.body,
              color: SITE.color.pinkDeep,
              fontWeight: 500,
              letterSpacing: SITE.ls.wide,
              textDecoration: "none",
            }}
          >
            {therapist.name}
          </Link>
          <span
            style={{
              fontFamily: SITE.font.serif,
              fontSize: SITE.fs.xs,
              color: SITE.color.textMuted,
            }}
          >
            {fmtDate(entry.publishedAt)}
          </span>
        </div>

        {/* 本文 */}
        <div
          style={{
            fontFamily: SITE.font.serif,
            fontSize: SITE.fs.bodyLg,
            color: SITE.color.text,
            lineHeight: SITE.lh.body,
            letterSpacing: SITE.ls.normal,
            whiteSpace: "pre-wrap",
            marginBottom: 32,
          }}
        >
          {entry.body}
        </div>

        {/* タグ */}
        {tags.length > 0 && (
          <div style={{ marginBottom: 32, paddingTop: 20, borderTop: `1px solid ${SITE.color.border}` }}>
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
              {tags.map((tag) => (
                <Link
                  key={tag.id}
                  href={`/diary?tag=${encodeURIComponent(tag.name)}`}
                  style={{
                    padding: "4px 12px",
                    fontSize: SITE.fs.xs,
                    backgroundColor: "transparent",
                    color: SITE.color.pinkDeep,
                    border: `1px solid ${SITE.color.borderPink}`,
                    fontFamily: SITE.font.serif,
                    letterSpacing: SITE.ls.normal,
                    textDecoration: "none",
                  }}
                >
                  {tag.displayName}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* いいねボタン + 統計 */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 16,
            paddingTop: 24,
            borderTop: `1px solid ${SITE.color.border}`,
          }}
        >
          {/* いいねボタン */}
          <button
            onClick={toggleLike}
            disabled={likeLoading}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "12px 28px",
              fontSize: SITE.fs.body,
              cursor: likeLoading ? "wait" : "pointer",
              backgroundColor: liked ? SITE.color.pinkSoft : "transparent",
              color: liked ? SITE.color.pinkDeep : SITE.color.textSub,
              border: `1px solid ${liked ? SITE.color.pinkDeep : SITE.color.border}`,
              fontFamily: SITE.font.serif,
              letterSpacing: SITE.ls.loose,
              transition: "all 0.2s ease",
              transform: likeAnimating ? "scale(1.08)" : "scale(1)",
              fontWeight: 500,
            }}
          >
            <span style={{ fontSize: 18 }}>{liked ? "♥" : "♡"}</span>
            <span>{liked ? "いいね済み" : customer ? "いいね" : "ログインして いいね"}</span>
            {likeCount > 0 && (
              <span style={{ fontSize: SITE.fs.xs, color: liked ? SITE.color.pinkDeep : SITE.color.textMuted, fontFamily: SITE.font.display, letterSpacing: SITE.ls.normal, fontVariantNumeric: "tabular-nums" }}>
                {likeCount.toLocaleString()}
              </span>
            )}
          </button>

          {/* 投げ銭ボタン */}
          <button
            onClick={() => {
              if (!customer) {
                router.push("/mypage");
                return;
              }
              setGiftModalOpen(true);
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "12px 28px",
              fontSize: SITE.fs.body,
              cursor: "pointer",
              background: "linear-gradient(135deg, #fff5e6 0%, #ffe5cc 100%)",
              color: "#cc6600",
              border: `1px solid #ffb866`,
              fontFamily: SITE.font.serif,
              letterSpacing: SITE.ls.loose,
              fontWeight: 500,
            }}
          >
            <span style={{ fontSize: 18 }}>🎁</span>
            <span>{customer ? "投げ銭" : "ログインして 投げ銭"}</span>
          </button>

          {/* 統計 */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: 20,
              fontSize: SITE.fs.xs,
              color: SITE.color.textMuted,
              fontFamily: SITE.font.display,
              letterSpacing: SITE.ls.wide,
            }}
          >
            <span>{entry.viewCount.toLocaleString()} VIEWS</span>
            {entry.commentCount > 0 && <span>{entry.commentCount.toLocaleString()} COMMENTS</span>}
          </div>
        </div>

        {/* セラピストプロフィールへの導線 + お気に入り */}
        <div style={{ marginTop: 36, display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
          {/* お気に入りボタン */}
          <button
            onClick={() => toggleFavorite(therapist.id)}
            disabled={favLoading}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 24px",
              fontSize: SITE.fs.sm,
              cursor: favLoading ? "wait" : "pointer",
              backgroundColor: favorited ? SITE.color.pinkSoft : "transparent",
              color: favorited ? SITE.color.pinkDeep : SITE.color.textSub,
              border: `1px solid ${favorited ? SITE.color.pinkDeep : SITE.color.border}`,
              fontFamily: SITE.font.serif,
              letterSpacing: SITE.ls.loose,
              fontWeight: 500,
              transition: "all 0.2s ease",
            }}
          >
            <span style={{ fontSize: 14 }}>{favorited ? "★" : "☆"}</span>
            <span>
              {favorited
                ? `${therapist.name}をお気に入り済み`
                : customer
                ? `${therapist.name}をお気に入り登録`
                : "ログインしてお気に入り登録"}
            </span>
          </button>

          {/* 通知ON/OFFトグル (お気に入り登録済みのときのみ) */}
          {favorited && (
            <button
              onClick={() => toggleNotify(therapist.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 14px",
                fontSize: SITE.fs.xs,
                cursor: "pointer",
                backgroundColor: "transparent",
                color: notifyEnabled ? SITE.color.pinkDeep : SITE.color.textMuted,
                border: "none",
                fontFamily: SITE.font.serif,
                letterSpacing: SITE.ls.loose,
              }}
            >
              <span style={{ fontSize: 13 }}>{notifyEnabled ? "🔔" : "🔕"}</span>
              <span style={{ fontSize: SITE.fs.xs }}>
                新しい日記を{notifyEnabled ? "通知する" : "通知しない"} (タップで切替)
              </span>
            </button>
          )}

          <Link
            href={`/therapist/${therapist.id}`}
            style={{
              display: "inline-block",
              padding: "12px 32px",
              fontSize: SITE.fs.sm,
              backgroundColor: SITE.color.pink,
              color: "#fff",
              textDecoration: "none",
              fontFamily: SITE.font.serif,
              letterSpacing: SITE.ls.loose,
            }}
          >
            {therapist.name} のプロフィールを見る
          </Link>
        </div>
      </article>

      {/* コメントセクション */}
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "0 20px" }}>
        <DiaryComments entryId={entry.id} therapistName={therapist.name} />
      </div>

      {/* 関連記事 (同じセラピスト) */}
      {related.length > 0 && (
        <section style={{ maxWidth: 800, margin: "60px auto 0", padding: "0 20px" }}>
          <p
            style={{
              fontFamily: SITE.font.display,
              fontSize: SITE.fs.tiny,
              letterSpacing: SITE.ls.wider,
              color: SITE.color.pinkDeep,
              marginBottom: 8,
              fontWeight: 500,
              textAlign: "center",
            }}
          >
            MORE FROM
          </p>
          <p
            style={{
              fontFamily: SITE.font.serif,
              fontSize: SITE.fs.lead,
              color: SITE.color.text,
              fontWeight: 500,
              letterSpacing: SITE.ls.loose,
              textAlign: "center",
              marginBottom: 20,
            }}
          >
            {therapist.name} のその他の日記
          </p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
              gap: 10,
            }}
          >
            {related.map((r) => (
              <Link
                key={r.id}
                href={`/diary/${r.id}`}
                style={{
                  textDecoration: "none",
                  color: "inherit",
                  backgroundColor: SITE.color.surface,
                  border: `1px solid ${SITE.color.border}`,
                }}
              >
                {r.coverImageUrl && (
                  <div
                    style={{
                      width: "100%",
                      aspectRatio: "1",
                      backgroundImage: `url(${r.coverImageUrl})`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                      backgroundColor: SITE.color.surfaceAlt,
                    }}
                  />
                )}
                <div style={{ padding: "10px 12px" }}>
                  <p
                    style={{
                      fontFamily: SITE.font.serif,
                      fontSize: SITE.fs.xs,
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
                    {r.title}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* 投げ銭成功トースト */}
      {giftSentMsg && (
        <div style={{ position: "fixed", top: 80, left: "50%", transform: "translateX(-50%)", zIndex: 10001, padding: "12px 24px", backgroundColor: "#6b9b7e", color: "#fff", fontSize: 13, fontFamily: SITE.font.serif, boxShadow: "0 4px 12px rgba(0,0,0,0.2)" }}>
          {giftSentMsg}
        </div>
      )}

      {/* 投げ銭モーダル */}
      {entry && therapist && (
        <GiftModal
          open={giftModalOpen}
          onClose={() => setGiftModalOpen(false)}
          customerId={customer?.id || null}
          sourceType="diary"
          sourceId={entry.id}
          recipientName={therapist.name}
          onSent={(g) => {
            setGiftSentMsg(`✨ ${g.emoji} ${g.pointAmount}pt を送りました!`);
            setTimeout(() => setGiftSentMsg(null), 3000);
          }}
        />
      )}
    </div>
  );
}
