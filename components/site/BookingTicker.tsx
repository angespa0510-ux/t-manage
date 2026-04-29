"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

/**
 * ═══════════════════════════════════════════════════════════
 * BookingTicker — 公開HP の「ライブ予約状況」流れるテロップ
 *
 * - 直近 24 時間の予約を /api/booking-ticker から取得
 * - reservations テーブルの INSERT / UPDATE を Realtime 監視し、
 *   予約発生・接客開始のタイミングで自動更新
 * - 5 分ごとの保険更新で取りこぼし防止
 * - 件数 0 の場合は何も描画しない
 *
 * デザイン:
 *   - 公開HP の世界観（marble pink / 明朝体 / Cormorant Garamond）
 *   - スタイルは globals.css の .booking-ticker__* に集約
 * ═══════════════════════════════════════════════════════════
 */

type TickerItem = {
  id: number;
  time: string;
  customerInitial: string;
  course: string;
  therapistName: string;
  isNomination: boolean;
  variant: "reserved" | "serving";
};

export default function BookingTicker() {
  const [items, setItems] = useState<TickerItem[]>([]);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/booking-ticker", { cache: "no-store" });
      if (!res.ok) return;
      const json = (await res.json()) as { items?: TickerItem[] };
      setItems(json.items ?? []);
    } catch {
      /* noop */
    }
  }, []);

  // 初期ロード
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Realtime: 予約 INSERT / status 変化
  useEffect(() => {
    const channel = supabase
      .channel("public:reservations:ticker")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "reservations" },
        () => refresh()
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "reservations" },
        (payload: { old?: Record<string, unknown>; new?: Record<string, unknown> }) => {
          const o = payload.old ?? {};
          const n = payload.new ?? {};
          if (
            o.customer_status !== n.customer_status ||
            o.therapist_status !== n.therapist_status ||
            o.status !== n.status
          ) {
            refresh();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refresh]);

  // 5 分ごとの保険更新
  useEffect(() => {
    const t = setInterval(refresh, 5 * 60 * 1000);
    return () => clearInterval(t);
  }, [refresh]);

  if (items.length === 0) return null;

  // ループ用に 2 周分並べる
  const looped = [...items, ...items];

  return (
    <div className="booking-ticker">
      <div className="booking-ticker__label">
        <span className="booking-ticker__pulse" aria-hidden />
        <span>Live</span>
      </div>
      <div className="booking-ticker__viewport">
        <div className="booking-ticker__track">
          {looped.map((item, i) => (
            <span key={`${item.id}-${i}`} className="booking-ticker__item">
              <span className="booking-ticker__time">{item.time}</span>
              <span className="booking-ticker__customer">
                {item.customerInitial} 様
              </span>
              {item.course && (
                <span className="booking-ticker__course">{item.course}</span>
              )}
              {item.isNomination && (
                <span className="booking-ticker__therapist">
                  {item.therapistName} さんへのご指名
                </span>
              )}
              <span className="booking-ticker__message">
                {item.variant === "serving"
                  ? "ただいま接客中です"
                  : item.isNomination
                    ? "予約が入りました"
                    : `${item.therapistName} さんに予約が入りました`}
              </span>
              <span className="booking-ticker__divider" aria-hidden>
                ✦
              </span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
