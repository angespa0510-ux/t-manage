"use client";

import Link from "next/link";
import { useTheme } from "../../lib/theme";
import { TeraAdminShell } from "./TeraAdminNav";
import {
  DUMMY_INSTANCES,
  getStatusLabel,
  getPlanLabel,
  formatJPY,
  formatDateJP,
  daysUntilGoLive,
  getTaskStats,
  MODULE_LABELS,
  type ModuleKey,
} from "../../lib/tera-admin-mock";

export default function TeraAdminDashboard() {
  const { T } = useTheme();

  const activeCount = DUMMY_INSTANCES.filter((i) => i.status === "active").length;
  const preparingCount = DUMMY_INSTANCES.filter((i) => i.status === "preparing").length;
  const totalTherapists = DUMMY_INSTANCES.reduce((sum, i) => sum + i.stats.therapist_count, 0);
  const totalRevenue = DUMMY_INSTANCES.reduce((sum, i) => sum + i.stats.monthly_revenue, 0);

  return (
    <TeraAdminShell>
      {/* ページヘッダー */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: T.text, marginBottom: 6 }}>
          TERA-MANAGE マスターダッシュボード
        </h1>
        <p style={{ color: T.textSub, fontSize: 14 }}>
          全 T-MANAGE インスタンスを横断的に管理する画面です
        </p>
      </div>

      {/* KPIカード */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 16,
          marginBottom: 32,
        }}
      >
        <StatCard T={T} label="稼働中の店舗" value={`${activeCount}店舗`} color="#6b9b7e" />
        <StatCard T={T} label="準備中の店舗" value={`${preparingCount}店舗`} color="#b38419" />
        <StatCard T={T} label="総セラピスト数" value={`${totalTherapists}名`} color={T.accent} />
        <StatCard T={T} label="今月の合計売上" value={formatJPY(totalRevenue)} color="#c96b83" />
      </div>

      {/* 店舗一覧セクション */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <h2 style={{ fontSize: 20, fontWeight: 700, color: T.text }}>T-MANAGE インスタンス一覧</h2>
        <Link
          href="/tera-admin/instances/new"
          style={{
            padding: "8px 16px",
            borderRadius: 8,
            background: T.accent,
            color: "#fff",
            textDecoration: "none",
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          ➕ 新規店舗を発行
        </Link>
      </div>

      {/* 店舗カードグリッド */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))",
          gap: 20,
        }}
      >
        {DUMMY_INSTANCES.map((inst) => {
          const status = getStatusLabel(inst.status);
          const daysLeft = daysUntilGoLive(inst.go_live_date);
          const activeModules = (Object.keys(inst.modules) as ModuleKey[]).filter((k) => inst.modules[k]);

          return (
            <Link
              key={inst.id}
              href={`/tera-admin/instances/${inst.id}`}
              style={{
                textDecoration: "none",
                color: "inherit",
                display: "block",
                background: T.card,
                border: `1px solid ${T.border}`,
                borderRadius: 14,
                overflow: "hidden",
                transition: "all 0.2s",
                boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
              }}
            >
              {/* ヘッダー（テーマカラーのバー） */}
              <div
                style={{
                  height: 6,
                  background: `linear-gradient(90deg, ${inst.theme_color_primary || T.accent}, ${inst.theme_color_accent || T.accent})`,
                }}
              />

              {/* コンテンツ */}
              <div style={{ padding: 20 }}>
                {/* 店舗名とステータス */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: T.text }}>{inst.name}</div>
                    <div style={{ fontSize: 12, color: T.textSub, marginTop: 2 }}>
                      {inst.name_en && <span style={{ marginRight: 8 }}>{inst.name_en}</span>}
                      <span>{inst.corporation_name}</span>
                    </div>
                  </div>
                  <div
                    style={{
                      padding: "4px 10px",
                      borderRadius: 20,
                      fontSize: 11,
                      fontWeight: 700,
                      background: `${status.color}22`,
                      color: status.color,
                    }}
                  >
                    {status.label}
                  </div>
                </div>

                {/* URL */}
                <div
                  style={{
                    padding: "8px 12px",
                    background: T.cardAlt,
                    borderRadius: 6,
                    fontSize: 12,
                    fontFamily: "ui-monospace, monospace",
                    color: T.textSub,
                    marginBottom: 14,
                  }}
                >
                  🌐 {inst.subdomain}.t-manage.jp
                </div>

                {/* 稼働日カウントダウン */}
                {inst.status === "preparing" && daysLeft !== null && daysLeft > 0 && (
                  <div
                    style={{
                      padding: "8px 12px",
                      background: "#b3841922",
                      border: `1px solid #b3841944`,
                      borderRadius: 6,
                      fontSize: 12,
                      color: "#8b6818",
                      marginBottom: 14,
                    }}
                  >
                    🚀 稼働まで <strong>あと {daysLeft} 日</strong>({inst.go_live_date})
                  </div>
                )}

                {/* 準備進捗バー */}
                {inst.status === "preparing" && inst.preparation_tasks && inst.preparation_tasks.length > 0 && (() => {
                  const s = getTaskStats(inst.preparation_tasks);
                  return (
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 11 }}>
                        <span style={{ color: T.textSub, fontWeight: 600 }}>📋 準備タスク</span>
                        <span style={{ color: T.text, fontWeight: 700 }}>
                          {s.done} / {s.total} 完了（{s.progressPct}%）
                        </span>
                      </div>
                      <div
                        style={{
                          height: 8,
                          background: T.cardAlt,
                          borderRadius: 4,
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            width: `${s.progressPct}%`,
                            height: "100%",
                            background: `linear-gradient(90deg, ${inst.theme_color_primary}, ${inst.theme_color_accent})`,
                            transition: "width 0.5s",
                          }}
                        />
                      </div>
                    </div>
                  );
                })()}

                {/* 統計情報 */}
                {inst.status === "active" && (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 14 }}>
                    <MiniStat T={T} label="セラピスト" value={`${inst.stats.therapist_count}名`} />
                    <MiniStat T={T} label="今月予約" value={`${inst.stats.monthly_reservations}件`} />
                    <MiniStat T={T} label="今月売上" value={formatJPY(inst.stats.monthly_revenue)} />
                  </div>
                )}

                {/* プラン・契約種別 */}
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
                  <Badge T={T} label={`プラン: ${getPlanLabel(inst.plan)}`} />
                  {inst.contract_type === "free" && <Badge T={T} label="無償提供" color="#6b9b7e" />}
                  {inst.contract_type === "paid" && <Badge T={T} label="自社運用" color={T.accent} />}
                  <Badge T={T} label={`モジュール ${activeModules.length}/13`} />
                </div>

                {/* アクションボタン */}
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    style={{
                      flex: 1,
                      padding: "8px 12px",
                      borderRadius: 6,
                      background: T.cardAlt,
                      border: `1px solid ${T.border}`,
                      color: T.text,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    詳細を見る →
                  </button>
                  <button
                    style={{
                      padding: "8px 12px",
                      borderRadius: 6,
                      background: T.accent,
                      border: "none",
                      color: "#fff",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                    onClick={(e) => {
                      e.preventDefault();
                      alert(`${inst.name} としてログイン代行（Phase 7 で実装）`);
                    }}
                  >
                    🔑 ログイン代行
                  </button>
                </div>
              </div>
            </Link>
          );
        })}

        {/* 「新規店舗を追加」カード */}
        <Link
          href="/tera-admin/instances/new"
          style={{
            textDecoration: "none",
            color: "inherit",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: 280,
            background: T.cardAlt,
            border: `2px dashed ${T.border}`,
            borderRadius: 14,
            transition: "all 0.2s",
            padding: 20,
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 12 }}>➕</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: T.text, marginBottom: 4 }}>
            新規店舗を追加
          </div>
          <div style={{ fontSize: 12, color: T.textSub, textAlign: "center" }}>
            発行ウィザードで
            <br />
            新しい T-MANAGE インスタンスを作成
          </div>
        </Link>
      </div>

      {/* Phase 情報 */}
      <div
        style={{
          marginTop: 40,
          padding: 20,
          background: T.card,
          border: `1px solid ${T.border}`,
          borderRadius: 12,
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 10 }}>
          📌 開発ステータス
        </div>
        <div style={{ fontSize: 13, color: T.textSub, lineHeight: 1.8 }}>
          この画面は <strong>UI先行モック</strong>です。実データとの接続は Phase 2（2026/8月〜）で実装されます。
          <br />
          現在は <strong>Phase 0</strong>：ドメイン取得完了・契約書面締結完了 → 6/1本番稼働準備中
        </div>
      </div>
    </TeraAdminShell>
  );
}

// ============================================
// サブコンポーネント
// ============================================

function StatCard({ T, label, value, color }: { T: any; label: string; value: string; color: string }) {
  return (
    <div
      style={{
        background: T.card,
        border: `1px solid ${T.border}`,
        borderRadius: 12,
        padding: 18,
        borderLeft: `4px solid ${color}`,
      }}
    >
      <div style={{ fontSize: 12, color: T.textSub, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: T.text }}>{value}</div>
    </div>
  );
}

function MiniStat({ T, label, value }: { T: any; label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: T.textSub, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{value}</div>
    </div>
  );
}

function Badge({ T, label, color }: { T: any; label: string; color?: string }) {
  return (
    <span
      style={{
        fontSize: 10,
        padding: "3px 8px",
        borderRadius: 12,
        background: color ? `${color}22` : T.cardAlt,
        color: color || T.textSub,
        fontWeight: 600,
      }}
    >
      {label}
    </span>
  );
}
