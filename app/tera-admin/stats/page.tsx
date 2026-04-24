"use client";

import { useTheme } from "../../../lib/theme";
import { TeraAdminShell } from "../TeraAdminNav";
import { DUMMY_INSTANCES, formatJPY } from "../../../lib/tera-admin-mock";

export default function StatsPage() {
  const { T } = useTheme();

  const activeInstances = DUMMY_INSTANCES.filter((i) => i.status === "active");
  const totalTherapists = DUMMY_INSTANCES.reduce((sum, i) => sum + i.stats.therapist_count, 0);
  const totalRevenue = DUMMY_INSTANCES.reduce((sum, i) => sum + i.stats.monthly_revenue, 0);
  const totalReservations = DUMMY_INSTANCES.reduce((sum, i) => sum + i.stats.monthly_reservations, 0);
  const maxRevenue = Math.max(...DUMMY_INSTANCES.map((i) => i.stats.monthly_revenue), 1);

  return (
    <TeraAdminShell>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: T.text, marginBottom: 4 }}>
          📊 横断統計
        </h1>
        <p style={{ color: T.textSub, fontSize: 13 }}>
          全インスタンスを横断した統計情報（RESEXY GROUP全体）
        </p>
      </div>

      {/* サマリーカード */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 16,
          marginBottom: 28,
        }}
      >
        <StatCard T={T} label="稼働中インスタンス" value={`${activeInstances.length}店舗`} color="#6b9b7e" />
        <StatCard T={T} label="総セラピスト数" value={`${totalTherapists}名`} color={T.accent} />
        <StatCard T={T} label="今月の合計売上" value={formatJPY(totalRevenue)} color="#c96b83" />
        <StatCard T={T} label="今月の合計予約数" value={`${totalReservations}件`} color="#b38419" />
      </div>

      {/* 売上ランキング */}
      <div
        style={{
          background: T.card,
          border: `1px solid ${T.border}`,
          borderRadius: 12,
          padding: 24,
          marginBottom: 20,
        }}
      >
        <h3 style={{ fontSize: 16, fontWeight: 700, color: T.text, marginTop: 0, marginBottom: 20 }}>
          💰 今月の売上（店舗別）
        </h3>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {DUMMY_INSTANCES
            .sort((a, b) => b.stats.monthly_revenue - a.stats.monthly_revenue)
            .map((i, index) => {
              const pct = (i.stats.monthly_revenue / maxRevenue) * 100;
              return (
                <div key={i.id}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: "50%",
                          background: index === 0 ? "#ffd700" : index === 1 ? "#c0c0c0" : index === 2 ? "#cd7f32" : T.cardAlt,
                          color: index < 3 ? "#000" : T.text,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 11,
                          fontWeight: 800,
                        }}
                      >
                        {index + 1}
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{i.name}</div>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>
                      {formatJPY(i.stats.monthly_revenue)}
                    </div>
                  </div>
                  <div
                    style={{
                      height: 12,
                      background: T.cardAlt,
                      borderRadius: 6,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${pct}%`,
                        height: "100%",
                        background: `linear-gradient(90deg, ${i.theme_color_primary}, ${i.theme_color_accent})`,
                        transition: "width 0.5s",
                      }}
                    />
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* セラピスト数・予約数 */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <div
          style={{
            background: T.card,
            border: `1px solid ${T.border}`,
            borderRadius: 12,
            padding: 20,
          }}
        >
          <h3 style={{ fontSize: 14, fontWeight: 700, color: T.text, marginTop: 0, marginBottom: 14 }}>
            👥 セラピスト数
          </h3>
          {DUMMY_INSTANCES.map((i) => (
            <div
              key={i.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "8px 0",
                borderBottom: `1px solid ${T.border}`,
              }}
            >
              <div style={{ fontSize: 13, color: T.text }}>{i.name}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>
                {i.stats.therapist_count}名
              </div>
            </div>
          ))}
        </div>

        <div
          style={{
            background: T.card,
            border: `1px solid ${T.border}`,
            borderRadius: 12,
            padding: 20,
          }}
        >
          <h3 style={{ fontSize: 14, fontWeight: 700, color: T.text, marginTop: 0, marginBottom: 14 }}>
            📅 今月の予約数
          </h3>
          {DUMMY_INSTANCES.map((i) => (
            <div
              key={i.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "8px 0",
                borderBottom: `1px solid ${T.border}`,
              }}
            >
              <div style={{ fontSize: 13, color: T.text }}>{i.name}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>
                {i.stats.monthly_reservations}件
              </div>
            </div>
          ))}
        </div>
      </div>

      <div
        style={{
          marginTop: 24,
          padding: 14,
          background: T.card,
          border: `1px solid ${T.border}`,
          borderRadius: 10,
          fontSize: 12,
          color: T.textSub,
        }}
      >
        🔒 現在はダミーデータです。Phase 2（2026/8月〜）以降、各インスタンスからの集計が有効化されます。
        将来的には法人単位集計（Phase F）も可能になります。
      </div>
    </TeraAdminShell>
  );
}

function StatCard({ T, label, value, color }: any) {
  return (
    <div
      style={{
        background: T.card,
        border: `1px solid ${T.border}`,
        borderLeft: `4px solid ${color}`,
        borderRadius: 12,
        padding: 18,
      }}
    >
      <div style={{ fontSize: 12, color: T.textSub, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: T.text }}>{value}</div>
    </div>
  );
}
