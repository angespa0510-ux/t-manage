"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { SITE } from "../../lib/site-theme";
import { useCustomerAuth } from "../../lib/customer-auth-context";
import GiftModal from "../gift-modal";

/**
 * HP写メ日記ページ用 ストーリーリング + 全画面ビューア
 *
 * Instagram風:
 *   - 横並びアバター (リング = 未読、グレー = 既読)
 *   - タップで全画面表示
 *   - 5秒で次へ自動進行
 *   - タップで前後 / スワイプで前後
 *   - メンバー限定はぼかし表示 (非ログイン時)
 */

type StoryItem = {
  id: number;
  mediaType: "image" | "video";
  mediaUrl: string | null;
  thumbnailUrl: string | null;
  caption: string | null;
  visibility: string;
  publishedAt: string;
  expiresAt: string;
  isRead: boolean;
};

type StoryGroup = {
  therapist: { id: number; name: string };
  stories: StoryItem[];
  hasUnread: boolean;
  latestThumbnail: string | null;
  coverUrl: string | null;
};

const STORY_DURATION_MS = 5000;

export default function StoryRing() {
  const { customer } = useCustomerAuth();
  const [groups, setGroups] = useState<StoryGroup[]>([]);
  const [loading, setLoading] = useState(true);

  // ビューア状態
  const [viewerOpen, setViewerOpen] = useState(false);
  const [giftModalOpen, setGiftModalOpen] = useState(false);
  const [giftSentMsg, setGiftSentMsg] = useState<string | null>(null);
  const [activeGroupIdx, setActiveGroupIdx] = useState(0);
  const [activeStoryIdx, setActiveStoryIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);

  const progressTimer = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const elapsedRef = useRef<number>(0);

  // ════════════════════════════════════════════════════
  // データ取得
  // ════════════════════════════════════════════════════
  const fetchStories = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (customer) {
        params.set("memberAuth", String(customer.id));
        params.set("viewerId", String(customer.id));
      }
      const res = await fetch(`/api/diary/story/active?${params.toString()}`);
      const data = await res.json();
      if (res.ok && data.groups) {
        setGroups(data.groups);
      }
    } catch (e) {
      console.error("fetch stories:", e);
    } finally {
      setLoading(false);
    }
  }, [customer]);

  useEffect(() => {
    fetchStories();
    // 1分おきに更新 (新規ストーリー検知用、軽量)
    const t = setInterval(fetchStories, 60 * 1000);
    return () => clearInterval(t);
  }, [fetchStories]);

  // ════════════════════════════════════════════════════
  // ビューア制御
  // ════════════════════════════════════════════════════
  const currentGroup = groups[activeGroupIdx];
  const currentStory = currentGroup?.stories[activeStoryIdx];

  const recordView = useCallback(async (storyId: number) => {
    try {
      await fetch("/api/diary/story/view", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storyId,
          customerId: customer?.id,
        }),
      });
    } catch (e) {
      console.error("view record:", e);
    }
  }, [customer]);

  const advance = useCallback(() => {
    if (!currentGroup) return;
    if (activeStoryIdx < currentGroup.stories.length - 1) {
      setActiveStoryIdx((i) => i + 1);
      setProgress(0);
      elapsedRef.current = 0;
      startTimeRef.current = Date.now();
    } else if (activeGroupIdx < groups.length - 1) {
      setActiveGroupIdx((i) => i + 1);
      setActiveStoryIdx(0);
      setProgress(0);
      elapsedRef.current = 0;
      startTimeRef.current = Date.now();
    } else {
      // 全部見終わった
      closeViewer();
    }
  }, [currentGroup, activeStoryIdx, activeGroupIdx, groups.length]);

  const goBack = useCallback(() => {
    if (activeStoryIdx > 0) {
      setActiveStoryIdx((i) => i - 1);
      setProgress(0);
      elapsedRef.current = 0;
      startTimeRef.current = Date.now();
    } else if (activeGroupIdx > 0) {
      setActiveGroupIdx((i) => i - 1);
      const prevGroup = groups[activeGroupIdx - 1];
      setActiveStoryIdx(prevGroup.stories.length - 1);
      setProgress(0);
      elapsedRef.current = 0;
      startTimeRef.current = Date.now();
    }
  }, [activeStoryIdx, activeGroupIdx, groups]);

  // タイマー: progress を更新 + 5秒で次
  useEffect(() => {
    if (!viewerOpen || !currentStory || paused) {
      if (progressTimer.current) {
        clearInterval(progressTimer.current);
        progressTimer.current = null;
      }
      return;
    }

    // 動画は自動進行しない (動画長さに任せる) → 簡易: 動画も5秒で進める
    startTimeRef.current = Date.now() - elapsedRef.current;

    progressTimer.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      elapsedRef.current = elapsed;
      const pct = Math.min(100, (elapsed / STORY_DURATION_MS) * 100);
      setProgress(pct);
      if (elapsed >= STORY_DURATION_MS) {
        if (progressTimer.current) clearInterval(progressTimer.current);
        advance();
      }
    }, 50);

    return () => {
      if (progressTimer.current) clearInterval(progressTimer.current);
    };
  }, [viewerOpen, currentStory, paused, advance]);

  // ストーリーが切り替わったら閲覧記録
  useEffect(() => {
    if (viewerOpen && currentStory) {
      recordView(currentStory.id);
      // 既読マーク
      setGroups((prev) =>
        prev.map((g, gi) =>
          gi !== activeGroupIdx
            ? g
            : {
                ...g,
                stories: g.stories.map((s, si) =>
                  si !== activeStoryIdx ? s : { ...s, isRead: true }
                ),
              }
        )
      );
    }
  }, [viewerOpen, currentStory, recordView, activeGroupIdx, activeStoryIdx]);

  const openViewer = (groupIdx: number) => {
    setActiveGroupIdx(groupIdx);
    setActiveStoryIdx(0);
    setProgress(0);
    elapsedRef.current = 0;
    startTimeRef.current = Date.now();
    setViewerOpen(true);
    setPaused(false);
  };

  const closeViewer = () => {
    setViewerOpen(false);
    setProgress(0);
    elapsedRef.current = 0;
    if (progressTimer.current) {
      clearInterval(progressTimer.current);
      progressTimer.current = null;
    }
  };

  // タップエリア (左1/3で戻る、右2/3で進む)
  const handleViewerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (x < rect.width / 3) {
      goBack();
    } else {
      advance();
    }
  };

  // ESC キーで閉じる
  useEffect(() => {
    if (!viewerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeViewer();
      else if (e.key === "ArrowLeft") goBack();
      else if (e.key === "ArrowRight") advance();
      else if (e.key === " ") setPaused((p) => !p);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [viewerOpen, goBack, advance]);

  // ════════════════════════════════════════════════════
  // レンダリング: リング
  // ════════════════════════════════════════════════════
  if (loading || groups.length === 0) {
    // ローディング/空の場合は何も表示しない (スペースを取らない)
    return null;
  }

  return (
    <>
      <div style={{ marginBottom: 30 }}>
        <p
          style={{
            fontFamily: SITE.font.display,
            fontSize: SITE.fs.tiny,
            letterSpacing: SITE.ls.wider,
            color: SITE.color.pinkDeep,
            marginBottom: 12,
            fontWeight: 500,
            textAlign: "center",
          }}
        >
          STORIES · 24時間限定
        </p>
        <div
          style={{
            display: "flex",
            gap: 14,
            overflowX: "auto",
            padding: "4px 4px 12px",
            scrollbarWidth: "thin",
          }}
        >
          {groups.map((group, idx) => (
            <button
              key={group.therapist.id}
              onClick={() => openViewer(idx)}
              style={{
                flexShrink: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 6,
                cursor: "pointer",
                background: "none",
                border: "none",
                padding: 0,
                width: 72,
              }}
            >
              {/* リング */}
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: "50%",
                  padding: 2,
                  background: group.hasUnread
                    ? `linear-gradient(135deg, ${SITE.color.pink} 0%, ${SITE.color.pinkDeep} 100%)`
                    : SITE.color.borderSoft,
                }}
              >
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    borderRadius: "50%",
                    backgroundColor: SITE.color.surface,
                    padding: 2,
                  }}
                >
                  <div
                    style={{
                      width: "100%",
                      height: "100%",
                      borderRadius: "50%",
                      backgroundColor: SITE.color.surfaceAlt,
                      backgroundImage: group.coverUrl ? `url(${group.coverUrl})` : undefined,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    }}
                  />
                </div>
              </div>
              {/* セラピスト名 */}
              <p
                style={{
                  fontFamily: SITE.font.serif,
                  fontSize: 11,
                  color: group.hasUnread ? SITE.color.text : SITE.color.textMuted,
                  fontWeight: group.hasUnread ? 500 : 400,
                  letterSpacing: SITE.ls.normal,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  width: "100%",
                  textAlign: "center",
                }}
              >
                {group.therapist.name}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* ビューアモーダル */}
      {viewerOpen && currentGroup && currentStory && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "#000",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {/* プログレスバー (各ストーリー分) */}
          <div
            style={{
              position: "absolute",
              top: 12,
              left: 12,
              right: 12,
              display: "flex",
              gap: 4,
              zIndex: 10,
            }}
          >
            {currentGroup.stories.map((_, i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  height: 2,
                  backgroundColor: "rgba(255,255,255,0.3)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    backgroundColor: "#fff",
                    width: i < activeStoryIdx ? "100%" : i === activeStoryIdx ? `${progress}%` : "0%",
                    transition: i === activeStoryIdx ? "width 0.05s linear" : "none",
                  }}
                />
              </div>
            ))}
          </div>

          {/* ヘッダ */}
          <div
            style={{
              position: "absolute",
              top: 28,
              left: 12,
              right: 12,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              zIndex: 10,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <p
                style={{
                  color: "#fff",
                  fontFamily: SITE.font.display,
                  fontSize: 14,
                  fontWeight: 500,
                  letterSpacing: SITE.ls.wide,
                }}
              >
                {currentGroup.therapist.name}
              </p>
              {currentStory.visibility === "members_only" && (
                <span
                  style={{
                    padding: "2px 8px",
                    fontSize: 9,
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
            <button
              onClick={closeViewer}
              style={{
                width: 36,
                height: 36,
                fontSize: 22,
                cursor: "pointer",
                color: "#fff",
                backgroundColor: "transparent",
                border: "none",
                fontFamily: SITE.font.display,
              }}
              aria-label="閉じる"
            >
              ×
            </button>
          </div>

          {/* メイン画像/動画 */}
          <div
            style={{
              width: "100%",
              height: "100%",
              maxWidth: 480,
              position: "relative",
              cursor: "pointer",
            }}
            onClick={handleViewerClick}
            onMouseDown={() => setPaused(true)}
            onMouseUp={() => setPaused(false)}
            onTouchStart={() => setPaused(true)}
            onTouchEnd={() => setPaused(false)}
          >
            {currentStory.mediaType === "image" && currentStory.mediaUrl && (
              <img
                src={currentStory.mediaUrl}
                alt=""
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                  display: "block",
                }}
                draggable={false}
              />
            )}
            {currentStory.mediaType === "video" && currentStory.mediaUrl && (
              <video
                src={currentStory.mediaUrl}
                autoPlay
                playsInline
                muted={false}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                  display: "block",
                }}
                onEnded={advance}
              />
            )}
          </div>

          {/* キャプション */}
          {currentStory.caption && (
            <div
              style={{
                position: "absolute",
                bottom: 80,
                left: 16,
                right: 80,
                padding: "10px 14px",
                backgroundColor: "rgba(0,0,0,0.5)",
                color: "#fff",
                fontFamily: SITE.font.serif,
                fontSize: 13,
                lineHeight: 1.6,
                letterSpacing: SITE.ls.normal,
                zIndex: 5,
              }}
            >
              {currentStory.caption}
            </div>
          )}

          {/* 投げ銭ボタン (右下) */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (!customer) return;
              setPaused(true);
              setGiftModalOpen(true);
            }}
            style={{
              position: "absolute",
              right: 16,
              bottom: 32,
              zIndex: 10,
              width: 56,
              height: 56,
              borderRadius: "50%",
              border: "none",
              background: "linear-gradient(135deg, #ffd668 0%, #ff9844 100%)",
              color: "#fff",
              fontSize: 24,
              cursor: customer ? "pointer" : "not-allowed",
              boxShadow: "0 4px 12px rgba(255, 152, 68, 0.5)",
              opacity: customer ? 1 : 0.4,
            }}
            title={customer ? "投げ銭を送る" : "ログインが必要です"}
          >
            🎁
          </button>

          {/* 投げ銭成功トースト */}
          {giftSentMsg && (
            <div style={{ position: "absolute", top: 80, left: 16, right: 16, zIndex: 11, padding: "10px 14px", backgroundColor: "rgba(107, 155, 126, 0.95)", color: "#fff", fontSize: 12, fontFamily: SITE.font.serif, textAlign: "center" }}>
              {giftSentMsg}
            </div>
          )}
        </div>
      )}

      {/* 投げ銭モーダル */}
      {currentStory && currentGroup && (
        <GiftModal
          open={giftModalOpen}
          onClose={() => { setGiftModalOpen(false); setPaused(false); }}
          customerId={customer?.id || null}
          sourceType="story"
          sourceId={currentStory.id}
          recipientName={currentGroup.therapist.name}
          onSent={(g) => {
            setGiftSentMsg(`✨ ${g.emoji} ${g.pointAmount}pt を送りました!`);
            setTimeout(() => setGiftSentMsg(null), 3000);
          }}
        />
      )}
    </>
  );
}
