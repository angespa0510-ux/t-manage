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
        className={className}
        style={{ padding: "12px 14px", backgroundColor: T.cardAlt, color: T.textMuted, border: `1px solid ${T.border}` }}
      >
        <p style={{ margin: "0 0 8px", fontSize: 11, letterSpacing: "0.02em", lineHeight: 1.7 }}>⚠️ このブラウザは通知に対応していません</p>
        <Link
          href="/install-guide"
          style={{ display: "block", textAlign: "center", padding: "8px 12px", fontSize: 11, fontWeight: 500, cursor: "pointer", backgroundColor: "#c96b83", color: "#ffffff", textDecoration: "none", letterSpacing: "0.08em" }}
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
        className={className}
        style={{ padding: "12px 14px", backgroundColor: "rgba(107,139,168,0.08)", color: T.text, border: `1px solid #6b8ba8` }}
      >
        <p style={{ margin: "0 0 10px", fontSize: 11, letterSpacing: "0.02em", lineHeight: 1.8 }}>
          📱 iPhoneで通知を受け取るには、<br />
          ① 下部の「共有」ボタンをタップ<br />
          ② 「ホーム画面に追加」を選択<br />
          ③ ホーム画面のアイコンから開き直してください
        </p>
        <Link
          href="/install-guide"
          style={{ display: "block", textAlign: "center", padding: "8px 12px", fontSize: 11, fontWeight: 500, cursor: "pointer", backgroundColor: "#6b8ba8", color: "#ffffff", textDecoration: "none", letterSpacing: "0.08em" }}
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
        className={className}
        style={{ padding: "12px 14px", fontSize: 11, backgroundColor: "rgba(201,107,131,0.08)", color: "#c96b83", border: `1px solid #c96b83`, letterSpacing: "0.02em", lineHeight: 1.8 }}
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
      className={className}
      style={{
        padding: "10px 16px", fontSize: 12, fontWeight: 500, cursor: loading ? "not-allowed" : "pointer", transition: "all 0.2s",
        backgroundColor: subscribed ? T.accent : T.card,
        color: subscribed ? "#ffffff" : T.text,
        border: `1px solid ${subscribed ? T.accent : T.border}`,
        opacity: loading ? 0.5 : 1,
        letterSpacing: "0.08em",
      }}
    >
      {loading
        ? "⏳ 処理中…"
        : subscribed
        ? "🔔 通知オン（タップで無効化）"
        : "🔕 通知をオンにする"}
    </button>
  );
}
