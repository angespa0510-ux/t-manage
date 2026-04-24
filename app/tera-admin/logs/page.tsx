"use client";

import { useTheme } from "../../../lib/theme";
import { TeraAdminShell } from "../TeraAdminNav";

const DUMMY_LOGS = [
  { time: "2026-04-24 14:00:32", instance: "RESEXY〜リゼクシー", action: "インスタンス作成", user: "社長（master）", level: "info" },
  { time: "2026-04-24 13:58:15", instance: "RESEXY〜リゼクシー", action: "ドメイン設定: resexy.t-manage.jp", user: "社長（master）", level: "info" },
  { time: "2026-04-24 13:55:00", instance: "RESEXY〜リゼクシー", action: "モジュール有効化: 12/13", user: "社長（master）", level: "info" },
  { time: "2026-04-24 11:47:22", instance: "-", action: "ドメイン登録完了: tera-manage.jp, t-manage.jp", user: "system", level: "success" },
  { time: "2026-04-24 00:50:10", instance: "-", action: "ドメイン登録受付", user: "社長（master）", level: "info" },
  { time: "2026-04-23 18:30:45", instance: "-", action: "設計書改訂7を commit: 2bce933", user: "社長（master）", level: "info" },
  { time: "2026-04-23 15:10:00", instance: "アンジュスパ", action: "通話AI設定トグル更新", user: "社長（master）", level: "info" },
  { time: "2026-04-23 12:30:22", instance: "アンジュスパ", action: "session61 Phase 9: PWAテーマ色更新", user: "社長（master）", level: "info" },
  { time: "2026-04-22 20:15:00", instance: "アンジュスパ", action: "セラピスト3名を追加", user: "事務スタッフ", level: "info" },
  { time: "2026-04-22 14:00:00", instance: "アンジュスパ", action: "モジュール有効化: ai_video", user: "社長（master）", level: "info" },
];

export default function LogsPage() {
  const { T } = useTheme();

  const levelColor = (level: string) => {
    switch (level) {
      case "success": return "#6b9b7e";
      case "warning": return "#b38419";
      case "error": return "#c96b83";
      default: return T.textSub;
    }
  };

  return (
    <TeraAdminShell>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: T.text, marginBottom: 4 }}>
          📜 アクティビティログ
        </h1>
        <p style={{ color: T.textSub, fontSize: 13 }}>
          全インスタンスの操作履歴（新しい順）
        </p>
      </div>

      <div
        style={{
          background: T.card,
          border: `1px solid ${T.border}`,
          borderRadius: 12,
          overflow: "hidden",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ background: T.cardAlt, borderBottom: `2px solid ${T.border}` }}>
              <Th T={T} width={180}>時刻</Th>
              <Th T={T} width={160}>インスタンス</Th>
              <Th T={T}>アクション</Th>
              <Th T={T} width={140}>ユーザー</Th>
              <Th T={T} width={80}>レベル</Th>
            </tr>
          </thead>
          <tbody>
            {DUMMY_LOGS.map((log, i) => (
              <tr key={i} style={{ borderBottom: `1px solid ${T.border}` }}>
                <Td T={T}>
                  <code style={{ fontSize: 11, color: T.textSub }}>{log.time}</code>
                </Td>
                <Td T={T}>
                  <span style={{ color: log.instance === "-" ? T.textMuted : T.text, fontWeight: log.instance === "-" ? 400 : 600 }}>
                    {log.instance}
                  </span>
                </Td>
                <Td T={T}>{log.action}</Td>
                <Td T={T}>
                  <span style={{ fontSize: 11, color: T.textSub }}>{log.user}</span>
                </Td>
                <Td T={T}>
                  <span
                    style={{
                      padding: "2px 8px",
                      borderRadius: 10,
                      fontSize: 10,
                      fontWeight: 700,
                      background: `${levelColor(log.level)}22`,
                      color: levelColor(log.level),
                    }}
                  >
                    {log.level.toUpperCase()}
                  </span>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div
        style={{
          marginTop: 20,
          padding: 14,
          background: T.card,
          border: `1px solid ${T.border}`,
          borderRadius: 10,
          fontSize: 12,
          color: T.textSub,
        }}
      >
        🔒 現在はダミーデータです。Phase 2（2026/8月〜）以降、instance_activity_logs テーブルから実データを取得します。
      </div>
    </TeraAdminShell>
  );
}

function Th({ T, children, width }: { T: any; children: React.ReactNode; width?: number }) {
  return (
    <th
      style={{
        padding: "12px 14px",
        textAlign: "left",
        fontSize: 10,
        fontWeight: 700,
        color: T.textSub,
        textTransform: "uppercase",
        letterSpacing: 0.5,
        width: width || "auto",
      }}
    >
      {children}
    </th>
  );
}

function Td({ T, children }: { T: any; children: React.ReactNode }) {
  return <td style={{ padding: "12px 14px", color: T.text }}>{children}</td>;
}
