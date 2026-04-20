"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  enablePushNotifications,
  disablePushNotifications,
  isSubscribed,
  isPushSupported,
  getPermissionState,
  isStandalone,
  type UserType,
} from "../lib/push-client";
import { useTheme } from "../lib/theme";
import { useToast } from "../lib/toast";

type Props = {
  userType: UserType;
  userId: number;
  className?: string;
};

export default function PushToggle({ userType, userId, className = "" }: Props) {
  const { T } = useTheme();
  const { show } = useToast();

  const [supported, setSupported] = useState(true);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [standalone, setStandalone] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    const supp = isPushSupported();
    setSupported(supp);
    setPermission(getPermissionState());
    setStandalone(isStandalone());
    if (typeof navigator !== "undefined") {
      setIsIos(/iPad|iPhone|iPod/.test(navigator.userAgent));
    }
    if (supp) {
      isSubscribed().then(setSubscribed);
    }
  }, []);

  const handleToggle = async () => {
    setLoading(true);
    try {
      if (subscribed) {
        const res = await disablePushNotifications(userType, userId);
        if (res.success) {
          setSubscribed(false);
          show("通知をオフにしました", "success");
        } else {
          show(res.error || "通知の無効化に失敗しました", "error");
        }
      } else {
        const res = await enablePushNotifications(userType, userId);
        if (res.success) {
          setSubscribed(true);
          setPermission("granted");
          show("🔔 通知をオンにしました！", "success");
        } else {
          show(res.error || "通知の有効化に失敗しました", "error");
        }
      }
    } finally {
      setLoading(false);
    }
  };

  // ブラウザが対応していない
  if (!supported) {
    return (
      <div
        className={`rounded-xl p-3 ${className}`}
        style={{ backgroundColor: T.cardAlt, color: T.textMuted, border: `1px solid ${T.border}` }}
      >
        <p className="text-[11px] mb-2">⚠️ このブラウザは通知に対応していません</p>
        <Link
          href="/install-guide"
          className="block text-center rounded-lg px-3 py-2 text-[11px] font-medium cursor-pointer"
          style={{ backgroundColor: "#c3a782", color: "#ffffff", textDecoration: "none" }}
        >
          📱 ホーム画面に追加してアプリとして使う →
        </Link>
      </div>
    );
  }

  // iPhone で PWA として開かれていない
  if (isIos && !standalone) {
    return (
      <div
        className={`rounded-xl p-3 ${className}`}
        style={{ backgroundColor: "rgba(133,168,196,0.08)", color: T.text, border: `1px solid #85a8c4` }}
      >
        <p className="text-[11px] mb-2">
          📱 iPhoneで通知を受け取るには、<br />
          ① 下部の「共有」ボタンをタップ<br />
          ② 「ホーム画面に追加」を選択<br />
          ③ ホーム画面のアイコンから開き直してください
        </p>
        <Link
          href="/install-guide"
          className="block text-center rounded-lg px-3 py-2 text-[11px] font-medium cursor-pointer"
          style={{ backgroundColor: "#85a8c4", color: "#ffffff", textDecoration: "none" }}
        >
          📖 詳しい手順を見る →
        </Link>
      </div>
    );
  }

  // 通知がブロックされている
  if (permission === "denied") {
    return (
      <div
        className={`rounded-xl p-3 text-[11px] ${className}`}
        style={{ backgroundColor: "rgba(196,85,85,0.08)", color: "#c45555", border: `1px solid #c45555` }}
      >
        🔕 通知がブロックされています。<br />
        ブラウザ設定から「通知を許可」に変更してください
      </div>
    );
  }

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      className={`rounded-xl px-4 py-2.5 text-[12px] font-medium cursor-pointer transition-all ${className}`}
      style={{
        backgroundColor: subscribed ? T.accent : T.card,
        color: subscribed ? "#ffffff" : T.text,
        border: `1px solid ${subscribed ? T.accent : T.border}`,
        opacity: loading ? 0.5 : 1,
      }}
    >
      {loading
        ? "⏳ 処理中..."
        : subscribed
        ? "🔔 通知オン（タップで無効化）"
        : "🔕 通知をオンにする"}
    </button>
  );
}
