"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useTheme } from "../../../../lib/theme";
import { TeraAdminShell } from "../../TeraAdminNav";
import {
  getInstanceById,
  getStatusLabel,
  getPlanLabel,
  formatJPY,
  formatDateJP,
  daysUntilGoLive,
  MODULE_LABELS,
  TIER1_MODULES,
  TIER2_MODULES,
  CATEGORY_INFO,
  STATUS_INFO,
  getTaskStats,
  getAssigneeLabel,
  groupTasksByCategory,
  type ModuleKey,
  type PreparationTask,
  type PreparationTaskCategory,
} from "../../../../lib/tera-admin-mock";

export default function InstanceDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { T } = useTheme();
  const instance = getInstanceById(id);
  const hasPreparationTasks = instance?.status === "preparing" && (instance.preparation_tasks?.length ?? 0) > 0;
  const [activeTab, setActiveTab] = useState<"overview" | "preparation" | "modules" | "settings" | "logs">(
    hasPreparationTasks ? "preparation" : "overview"
  );

  if (!instance) {
    return (
      <TeraAdminShell>
        <div style={{ padding: 40, textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>❌</div>
          <div style={{ color: T.text, fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
            インスタンスが見つかりません
          </div>
          <Link href="/tera-admin" style={{ color: T.accent }}>
            ← ダッシュボードに戻る
          </Link>
        </div>
      </TeraAdminShell>
    );
  }

  const status = getStatusLabel(instance.status);
  const daysLeft = daysUntilGoLive(instance.go_live_date);
  const activeModules = (Object.keys(instance.modules) as ModuleKey[]).filter((k) => instance.modules[k]);

  return (
    <TeraAdminShell>
      {/* パンくずリスト */}
      <div style={{ fontSize: 12, color: T.textSub, marginBottom: 16 }}>
        <Link href="/tera-admin" style={{ color: T.textSub, textDecoration: "none" }}>
          ダッシュボード
        </Link>
        {" / "}
        <span style={{ color: T.text }}>{instance.name}</span>
      </div>

      {/* ヘッダー */}
      <div
        style={{
          background: T.card,
          border: `1px solid ${T.border}`,
          borderRadius: 14,
          overflow: "hidden",
          marginBottom: 24,
        }}
      >
        <div
          style={{
            height: 8,
            background: `linear-gradient(90deg, ${instance.theme_color_primary}, ${instance.theme_color_accent})`,
          }}
        />
        <div style={{ padding: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
            <div>
              <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 6 }}>
                <h1 style={{ fontSize: 26, fontWeight: 800, color: T.text, margin: 0 }}>
                  {instance.name}
                </h1>
                <div
                  style={{
                    padding: "4px 12px",
                    borderRadius: 20,
                    fontSize: 12,
                    fontWeight: 700,
                    background: `${status.color}22`,
                    color: status.color,
                  }}
                >
                  {status.label}
                </div>
              </div>
              <div style={{ fontSize: 13, color: T.textSub }}>
                {instance.corporation_name} / {instance.shop_type} / {getPlanLabel(instance.plan)}プラン
              </div>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button
                style={{
                  padding: "8px 14px",
                  borderRadius: 8,
                  background: T.accent,
                  color: "#fff",
                  border: "none",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
                onClick={() => alert("ログイン代行機能は Phase 7 で実装予定")}
              >
                🔑 ログイン代行
              </button>
              <button
                style={{
                  padding: "8px 14px",
                  borderRadius: 8,
                  background: T.cardAlt,
                  color: T.text,
                  border: `1px solid ${T.border}`,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
                onClick={() => alert("プレビュー機能は Phase 7 で実装予定")}
              >
                👁️ プレビュー
              </button>
            </div>
          </div>

          {/* URL */}
          <div
            style={{
              padding: "10px 14px",
              background: T.cardAlt,
              borderRadius: 8,
              fontSize: 13,
              fontFamily: "ui-monospace, monospace",
              color: T.text,
              marginBottom: 16,
            }}
          >
            🌐 <strong>https://{instance.subdomain}.t-manage.jp</strong>
            {instance.custom_domain && (
              <>
                <span style={{ color: T.textSub, margin: "0 8px" }}>|</span>
                <span>独自ドメイン: {instance.custom_domain}</span>
              </>
            )}
          </div>

          {/* 稼働日カウントダウン */}
          {instance.status === "preparing" && daysLeft !== null && daysLeft > 0 && (
            <div
              style={{
                padding: "14px 18px",
                background: "#b3841922",
                border: `1px solid #b3841944`,
                borderRadius: 10,
                display: "flex",
                alignItems: "center",
                gap: 14,
              }}
            >
              <div style={{ fontSize: 32 }}>🚀</div>
              <div>
                <div style={{ fontSize: 13, color: "#8b6818", marginBottom: 2 }}>稼働予定日</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: "#8b6818" }}>
                  {instance.go_live_date}（あと {daysLeft} 日）
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* タブ */}
      <div
        style={{
          display: "flex",
          gap: 4,
          borderBottom: `1px solid ${T.border}`,
          marginBottom: 20,
        }}
      >
        {[
          { key: "overview", label: "🏠 概要", show: true },
          { key: "preparation", label: `🚀 準備タスク${instance.preparation_tasks ? ` (${getTaskStats(instance.preparation_tasks).done}/${instance.preparation_tasks.length})` : ""}`, show: hasPreparationTasks },
          { key: "modules", label: "🧩 モジュール設定", show: true },
          { key: "settings", label: "⚙️ 独自設定", show: true },
          { key: "logs", label: "📜 アクティビティ", show: true },
        ].filter((tab) => tab.show).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            style={{
              padding: "10px 18px",
              background: activeTab === tab.key ? T.card : "transparent",
              border: "none",
              borderBottom: activeTab === tab.key ? `3px solid ${T.accent}` : "3px solid transparent",
              color: activeTab === tab.key ? T.text : T.textSub,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              borderRadius: "8px 8px 0 0",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* タブコンテンツ */}
      {activeTab === "overview" && <OverviewTab T={T} instance={instance} />}
      {activeTab === "preparation" && <PreparationTab T={T} instance={instance} />}
      {activeTab === "modules" && <ModulesTab T={T} instance={instance} />}
      {activeTab === "settings" && <SettingsTab T={T} instance={instance} />}
      {activeTab === "logs" && <LogsTab T={T} />}
    </TeraAdminShell>
  );
}

// ============================================
// 概要タブ
// ============================================

function OverviewTab({ T, instance }: { T: any; instance: any }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* 基本情報 */}
        <Panel T={T} title="基本情報">
          <InfoRow T={T} label="インスタンス名" value={instance.name} />
          <InfoRow T={T} label="法人名" value={instance.corporation_name} />
          <InfoRow T={T} label="業種" value={instance.shop_type} />
          <InfoRow T={T} label="サブドメイン" value={`${instance.subdomain}.t-manage.jp`} />
          <InfoRow T={T} label="独自ドメイン" value={instance.custom_domain || "設定なし"} />
          <InfoRow T={T} label="運用形態" value={instance.operation_type === "self" ? "自社運用" : "外部提供"} />
          <InfoRow T={T} label="契約種別" value={instance.contract_type === "free" ? "無償提供" : "有償"} />
          <InfoRow T={T} label="決算月" value={`${instance.fiscal_month}月`} />
          <InfoRow T={T} label="顧問税理士" value={instance.tax_accountant_name || "未設定"} />
          <InfoRow T={T} label="作成日" value={formatDateJP(instance.created_at)} />
          <InfoRow T={T} label="稼働予定日" value={instance.go_live_date || "未定"} />
        </Panel>

        {/* 統計 */}
        {instance.status === "active" && (
          <Panel T={T} title="利用統計（今月）">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
              <LargeStat T={T} label="セラピスト数" value={`${instance.stats.therapist_count}名`} />
              <LargeStat T={T} label="今月の予約数" value={`${instance.stats.monthly_reservations}件`} />
              <LargeStat T={T} label="今月の売上" value={formatJPY(instance.stats.monthly_revenue)} />
            </div>
          </Panel>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* アクションパネル */}
        <Panel T={T} title="管理アクション">
          <ActionButton T={T} icon="🔑" label="ログイン代行" onClick={() => alert("Phase 7")} />
          <ActionButton T={T} icon="👁️" label="プレビュー" onClick={() => alert("Phase 7")} />
          <ActionButton T={T} icon="📨" label="お知らせ送信" onClick={() => alert("Phase 7")} />
          <ActionButton T={T} icon="💾" label="データエクスポート" onClick={() => alert("Phase 7")} />
          <ActionButton T={T} icon="📄" label="契約書を表示" onClick={() => alert("電子契約モジュール連携予定")} />
          <ActionButton T={T} icon="⏸️" label="一時停止" color="#b38419" onClick={() => alert("Phase 7")} />
          <ActionButton T={T} icon="🗄️" label="アーカイブ" color="#c96b83" onClick={() => alert("Phase 7")} />
        </Panel>

        {/* テーマプレビュー */}
        <Panel T={T} title="テーマカラー">
          <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
            <div
              style={{
                width: 60,
                height: 60,
                borderRadius: 8,
                background: instance.theme_color_primary,
                border: `1px solid ${T.border}`,
              }}
            />
            <div>
              <div style={{ fontSize: 11, color: T.textSub }}>プライマリ</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>
                {instance.theme_color_primary}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <div
              style={{
                width: 60,
                height: 60,
                borderRadius: 8,
                background: instance.theme_color_accent,
                border: `1px solid ${T.border}`,
              }}
            />
            <div>
              <div style={{ fontSize: 11, color: T.textSub }}>アクセント</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>
                {instance.theme_color_accent}
              </div>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}

// ============================================
// モジュール設定タブ
// ============================================

function ModulesTab({ T, instance }: { T: any; instance: any }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <Panel T={T} title="Tier 1 コアモジュール（標準搭載・OFF不可）">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
          {TIER1_MODULES.map((m) => (
            <div
              key={m}
              style={{
                padding: "10px 14px",
                background: `${T.accent}11`,
                border: `1px solid ${T.accent}44`,
                borderRadius: 8,
                fontSize: 13,
                color: T.text,
                fontWeight: 600,
              }}
            >
              ✅ {m}
            </div>
          ))}
        </div>
      </Panel>

      <Panel T={T} title="Tier 2 基本パッケージ（標準搭載・OFF不可）">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
          {TIER2_MODULES.map((m) => (
            <div
              key={m}
              style={{
                padding: "10px 14px",
                background: T.cardAlt,
                border: `1px solid ${T.border}`,
                borderRadius: 8,
                fontSize: 13,
                color: T.text,
              }}
            >
              ✅ {m}
            </div>
          ))}
        </div>
      </Panel>

      <Panel T={T} title="Tier 3 オプションモジュール（ON/OFF自由）">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
          {(Object.keys(MODULE_LABELS) as ModuleKey[]).map((key) => {
            const enabled = instance.modules[key];
            const info = MODULE_LABELS[key];
            return (
              <div
                key={key}
                style={{
                  padding: 14,
                  background: enabled ? `${T.accent}11` : T.cardAlt,
                  border: `1px solid ${enabled ? T.accent + "44" : T.border}`,
                  borderRadius: 10,
                  display: "flex",
                  gap: 12,
                  alignItems: "flex-start",
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 4 }}>
                    {info.name}
                  </div>
                  <div style={{ fontSize: 11, color: T.textSub, lineHeight: 1.4 }}>
                    {info.description}
                  </div>
                  <code style={{ fontSize: 10, color: T.textMuted }}>{key}</code>
                </div>
                <Toggle enabled={enabled} T={T} />
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}

// ============================================
// 独自設定タブ
// ============================================

function SettingsTab({ T, instance }: { T: any; instance: any }) {
  const cash = instance.settings?.cash_management;
  const fees = instance.settings?.payment_fees;
  const labels = instance.settings?.labels;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
      {/* 資金管理設定 */}
      <Panel T={T} title="💰 資金管理">
        {cash ? (
          <>
            <InfoRow T={T} label="財布数" value={`${cash.wallets.length}個`} />
            <InfoRow T={T} label="財布一覧" value={cash.wallets.join(", ")} />
            <InfoRow T={T} label="予備金制度" value={cash.has_reserve_fund ? `あり（${cash.reserve_fund_name}）` : "なし"} />
            <InfoRow T={T} label="ルーム未回収" value={cash.has_room_uncollected ? "あり" : "なし"} />
            <InfoRow T={T} label="金庫未回収" value={cash.has_safe_uncollected ? "あり" : "なし"} />
            <InfoRow T={T} label="当日締め必須" value={cash.daily_close_required ? "はい" : "いいえ"} />
            <InfoRow T={T} label="翌日持ち越し" value={cash.carry_over_allowed ? "許可" : "禁止"} />
          </>
        ) : (
          <div style={{ color: T.textSub, fontSize: 13 }}>未設定</div>
        )}
      </Panel>

      {/* 決済手数料 */}
      <Panel T={T} title="💳 決済手数料">
        {fees ? (
          <>
            <InfoRow T={T} label="クレジットカード" value={`${fees.card}%`} />
            <InfoRow T={T} label="PayPay" value={`${fees.paypay}%`} />
            <InfoRow T={T} label="LINE Pay" value={`${fees.line_pay}%`} />
            <InfoRow T={T} label="現金" value={`${fees.cash}%`} />
          </>
        ) : (
          <div style={{ color: T.textSub, fontSize: 13 }}>未設定</div>
        )}
      </Panel>

      {/* ラベル設定 */}
      <Panel T={T} title="🏷️ カスタムラベル">
        {labels ? (
          <>
            <InfoRow T={T} label="福利厚生費の呼称" value={labels.welfare_fee} />
            <InfoRow T={T} label="予備金の呼称" value={labels.reserve_fund || "（予備金なし）"} />
          </>
        ) : (
          <div style={{ color: T.textSub, fontSize: 13 }}>未設定</div>
        )}
      </Panel>

      {/* JSON プレビュー */}
      <Panel T={T} title="🔧 settings JSON">
        <pre
          style={{
            background: T.cardAlt,
            padding: 14,
            borderRadius: 8,
            fontSize: 11,
            color: T.text,
            fontFamily: "ui-monospace, monospace",
            maxHeight: 300,
            overflow: "auto",
            border: `1px solid ${T.border}`,
            margin: 0,
          }}
        >
          {JSON.stringify(instance.settings, null, 2)}
        </pre>
      </Panel>
    </div>
  );
}

// ============================================
// アクティビティログタブ
// ============================================

function LogsTab({ T }: { T: any }) {
  const DUMMY_LOGS = [
    { time: "2026-04-24 14:00", action: "インスタンス作成", user: "社長", payload: "status=preparing" },
    { time: "2026-04-24 13:45", action: "ドメイン設定", user: "社長", payload: "subdomain=resexy" },
    { time: "2026-04-24 13:30", action: "モジュール設定", user: "社長", payload: "12 modules enabled" },
    { time: "2026-04-24 13:15", action: "法人情報登録", user: "社長", payload: "corporation_id=corp-002" },
  ];

  return (
    <Panel T={T} title="アクティビティログ">
      <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
        {DUMMY_LOGS.map((log, i) => (
          <div
            key={i}
            style={{
              padding: "12px 14px",
              borderBottom: i < DUMMY_LOGS.length - 1 ? `1px solid ${T.border}` : "none",
              display: "grid",
              gridTemplateColumns: "180px 1fr 100px 1fr",
              gap: 12,
              alignItems: "center",
              fontSize: 12,
            }}
          >
            <div style={{ color: T.textSub, fontFamily: "ui-monospace, monospace" }}>{log.time}</div>
            <div style={{ color: T.text, fontWeight: 600 }}>{log.action}</div>
            <div style={{ color: T.textSub }}>{log.user}</div>
            <div style={{ color: T.textMuted, fontSize: 11, fontFamily: "ui-monospace, monospace" }}>
              {log.payload}
            </div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 14, padding: 12, background: T.cardAlt, borderRadius: 6, fontSize: 11, color: T.textSub, textAlign: "center" }}>
        🔒 実データは Phase 5（2026/12月）以降。現在はダミー表示。
      </div>
    </Panel>
  );
}

// ============================================
// 共通コンポーネント
// ============================================

function Panel({ T, title, children }: { T: any; title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        background: T.card,
        border: `1px solid ${T.border}`,
        borderRadius: 12,
        padding: 18,
      }}
    >
      <h3 style={{ fontSize: 14, fontWeight: 700, color: T.text, marginTop: 0, marginBottom: 14 }}>
        {title}
      </h3>
      <div>{children}</div>
    </div>
  );
}

function InfoRow({ T, label, value }: { T: any; label: string; value: string }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "140px 1fr",
        gap: 12,
        padding: "8px 0",
        borderBottom: `1px solid ${T.border}`,
        fontSize: 13,
      }}
    >
      <div style={{ color: T.textSub }}>{label}</div>
      <div style={{ color: T.text, fontWeight: 500 }}>{value}</div>
    </div>
  );
}

function LargeStat({ T, label, value }: { T: any; label: string; value: string }) {
  return (
    <div
      style={{
        padding: 14,
        background: T.cardAlt,
        borderRadius: 8,
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 11, color: T.textSub, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: T.text }}>{value}</div>
    </div>
  );
}

function ActionButton({
  T,
  icon,
  label,
  color,
  onClick,
}: {
  T: any;
  icon: string;
  label: string;
  color?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        padding: "10px 14px",
        background: T.cardAlt,
        border: `1px solid ${T.border}`,
        borderRadius: 8,
        color: color || T.text,
        fontSize: 13,
        fontWeight: 600,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: 10,
        marginBottom: 6,
        textAlign: "left",
      }}
    >
      <span>{icon}</span>
      <span>{label}</span>
    </button>
  );
}

function Toggle({ enabled, T }: { enabled: boolean; T: any }) {
  return (
    <div
      style={{
        width: 40,
        height: 22,
        borderRadius: 11,
        background: enabled ? T.accent : T.border,
        position: "relative",
        cursor: "pointer",
        transition: "all 0.2s",
        flexShrink: 0,
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 2,
          left: enabled ? 20 : 2,
          width: 18,
          height: 18,
          borderRadius: "50%",
          background: "#fff",
          transition: "all 0.2s",
          boxShadow: "0 2px 4px rgba(0,0,0,0.15)",
        }}
      />
    </div>
  );
}

// ============================================
// 準備タスクタブ
// ============================================

function PreparationTab({ T, instance }: { T: any; instance: any }) {
  const tasks: PreparationTask[] = instance.preparation_tasks || [];
  const stats = getTaskStats(tasks);
  const grouped = groupTasksByCategory(tasks);
  const daysLeft = daysUntilGoLive(instance.go_live_date);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* 進捗サマリー */}
      <div
        style={{
          background: T.card,
          border: `1px solid ${T.border}`,
          borderRadius: 14,
          padding: 24,
          overflow: "hidden",
          position: "relative",
        }}
      >
        <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr 1fr 1fr", gap: 20, alignItems: "center" }}>
          {/* 全体進捗 */}
          <div>
            <div style={{ fontSize: 12, color: T.textSub, marginBottom: 6 }}>全体進捗</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 10 }}>
              <div style={{ fontSize: 36, fontWeight: 800, color: T.text }}>{stats.progressPct}%</div>
              <div style={{ fontSize: 14, color: T.textSub }}>
                ({stats.done} / {stats.total})
              </div>
            </div>
            {/* プログレスバー */}
            <div
              style={{
                height: 10,
                background: T.cardAlt,
                borderRadius: 5,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${stats.progressPct}%`,
                  height: "100%",
                  background: `linear-gradient(90deg, ${instance.theme_color_primary}, ${instance.theme_color_accent})`,
                  transition: "width 0.5s",
                }}
              />
            </div>
            {daysLeft !== null && daysLeft > 0 && (
              <div style={{ fontSize: 11, color: T.textSub, marginTop: 8 }}>
                稼働まで <strong style={{ color: "#8b6818" }}>あと {daysLeft} 日</strong>（{instance.go_live_date}）
              </div>
            )}
          </div>

          {/* ステータス別件数 */}
          <TaskCountCard T={T} label="完了" count={stats.done} icon="✅" color="#6b9b7e" />
          <TaskCountCard T={T} label="進行中" count={stats.in_progress} icon="🔄" color="#b38419" />
          <TaskCountCard T={T} label="未着手" count={stats.pending} icon="⏳" color="#888780" />
          <TaskCountCard T={T} label="ブロック" count={stats.blocked} icon="🚫" color="#c45555" />
        </div>
      </div>

      {/* カテゴリ別タスク一覧 */}
      {(Object.keys(grouped) as PreparationTaskCategory[]).map((category) => {
        const categoryTasks = grouped[category];
        if (categoryTasks.length === 0) return null;
        const info = CATEGORY_INFO[category];
        const categoryStats = getTaskStats(categoryTasks);

        return (
          <div
            key={category}
            style={{
              background: T.card,
              border: `1px solid ${T.border}`,
              borderRadius: 12,
              overflow: "hidden",
            }}
          >
            {/* カテゴリヘッダー */}
            <div
              style={{
                padding: "14px 20px",
                background: `${info.color}11`,
                borderBottom: `1px solid ${T.border}`,
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  background: `${info.color}33`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 20,
                }}
              >
                {info.icon}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: T.text }}>{info.label}</div>
                <div style={{ fontSize: 11, color: T.textSub, marginTop: 2 }}>
                  {categoryStats.done} / {categoryStats.total} 完了（{categoryStats.progressPct}%）
                </div>
              </div>
              <div
                style={{
                  padding: "4px 10px",
                  borderRadius: 12,
                  fontSize: 11,
                  fontWeight: 700,
                  background: `${info.color}22`,
                  color: info.color,
                }}
              >
                {categoryStats.progressPct}%
              </div>
            </div>

            {/* タスクリスト */}
            <div>
              {categoryTasks.map((task) => (
                <div key={task.id}>
                  <TaskRow T={T} task={task} />
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {/* 注記 */}
      <div
        style={{
          padding: 14,
          background: T.cardAlt,
          border: `1px solid ${T.border}`,
          borderRadius: 10,
          fontSize: 12,
          color: T.textSub,
          lineHeight: 1.7,
        }}
      >
        🔒 現在はダミーデータです。Phase 7（2027年以降）で instance_preparation_tasks テーブルを実装予定。
        タスクのチェック・コメント・担当者割り当て・期限設定などが可能になります。
      </div>
    </div>
  );
}

function TaskCountCard({
  T,
  label,
  count,
  icon,
  color,
}: {
  T: any;
  label: string;
  count: number;
  icon: string;
  color: string;
}) {
  return (
    <div
      style={{
        padding: 14,
        background: `${color}11`,
        borderRadius: 10,
        textAlign: "center",
        border: `1px solid ${color}33`,
      }}
    >
      <div style={{ fontSize: 20, marginBottom: 4 }}>{icon}</div>
      <div style={{ fontSize: 10, color: T.textSub, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: color }}>{count}</div>
    </div>
  );
}

function TaskRow({ T, task }: { T: any; task: PreparationTask }) {
  const statusInfo = STATUS_INFO[task.status];
  const assigneeLabel = getAssigneeLabel(task.assignee);

  return (
    <div
      style={{
        padding: "14px 20px",
        borderBottom: `1px solid ${T.border}`,
        display: "grid",
        gridTemplateColumns: "40px 1fr auto auto",
        gap: 14,
        alignItems: "center",
        opacity: task.status === "done" ? 0.7 : 1,
      }}
    >
      {/* ステータスアイコン */}
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: "50%",
          background: `${statusInfo.color}22`,
          border: `2px solid ${statusInfo.color}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 13,
        }}
      >
        {task.status === "done" && "✓"}
        {task.status === "in_progress" && "◐"}
        {task.status === "pending" && ""}
        {task.status === "blocked" && "✕"}
      </div>

      {/* タスク内容 */}
      <div>
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: T.text,
            textDecoration: task.status === "done" ? "line-through" : "none",
            marginBottom: 2,
          }}
        >
          {task.title}
        </div>
        {task.description && (
          <div style={{ fontSize: 11, color: T.textSub, marginBottom: 4 }}>
            {task.description}
          </div>
        )}
        {task.progress && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
            <div
              style={{
                flex: 1,
                maxWidth: 200,
                height: 6,
                background: T.cardAlt,
                borderRadius: 3,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${Math.round((task.progress.current / task.progress.total) * 100)}%`,
                  height: "100%",
                  background: statusInfo.color,
                }}
              />
            </div>
            <span style={{ fontSize: 10, color: T.textSub, fontWeight: 600 }}>
              {task.progress.current} / {task.progress.total}
            </span>
          </div>
        )}
      </div>

      {/* 担当・期限 */}
      <div style={{ textAlign: "right", minWidth: 120 }}>
        <div style={{ fontSize: 11, color: T.textSub, marginBottom: 2 }}>
          👤 {assigneeLabel}
        </div>
        {task.due_date && task.status !== "done" && (
          <div style={{ fontSize: 11, color: T.textMuted }}>
            📅 {task.due_date}
          </div>
        )}
        {task.completed_at && (
          <div style={{ fontSize: 11, color: "#6b9b7e" }}>
            ✓ {task.completed_at.split("T")[0]}
          </div>
        )}
      </div>

      {/* ステータスバッジ */}
      <div
        style={{
          padding: "4px 10px",
          borderRadius: 12,
          fontSize: 10,
          fontWeight: 700,
          background: `${statusInfo.color}22`,
          color: statusInfo.color,
          whiteSpace: "nowrap",
        }}
      >
        {statusInfo.label}
      </div>
    </div>
  );
}
