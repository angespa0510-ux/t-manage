"use client";

import { useTheme } from "../../../lib/theme";
import { TeraAdminShell } from "../TeraAdminNav";

/**
 * ═══════════════════════════════════════════════════════════════
 *  URL 構成図 — TERA-MANAGE / T-MANAGE / 各テナントのドメイン構成を可視化
 * ═══════════════════════════════════════════════════════════════
 */

type Domain = {
  host: string;
  role: string;
  type: "corp" | "saas-admin" | "product-lp" | "tenant-custom" | "tenant-sub";
  status: "active" | "planned";
  paths: { path: string; label: string; group?: string }[];
};

const DOMAINS: Domain[] = [
  {
    host: "tera-manage.jp",
    role: "TERA-MANAGE 法人ブランドサイト",
    type: "corp",
    status: "active",
    paths: [
      { path: "/", label: "法人TOP", group: "公開" },
      { path: "/products/ai", label: "AIソリューション", group: "公開" },
      { path: "/products/dx", label: "DX支援", group: "公開" },
      { path: "/products/web", label: "Web制作", group: "公開" },
      { path: "/news", label: "お知らせ", group: "公開" },
      { path: "/careers", label: "採用", group: "公開" },
      { path: "/faq", label: "よくある質問", group: "公開" },
      { path: "/privacy", label: "プライバシーポリシー", group: "公開" },
      { path: "/legal", label: "特定商取引法", group: "公開" },
      { path: "/contact", label: "お問い合わせ", group: "公開" },
    ],
  },
  {
    host: "admin.tera-manage.jp",
    role: "SaaS 全体管理(運営者専用)",
    type: "saas-admin",
    status: "active",
    paths: [
      { path: "/", label: "ダッシュボード" },
      { path: "/instances", label: "店舗一覧" },
      { path: "/instances/new", label: "新規店舗発行" },
      { path: "/url-structure", label: "URL構成(このページ)" },
      { path: "/updates", label: "一斉配信" },
      { path: "/stats", label: "横断統計" },
      { path: "/logs", label: "アクティビティログ" },
    ],
  },
  {
    host: "t-manage.jp",
    role: "T-MANAGE 製品紹介LP",
    type: "product-lp",
    status: "active",
    paths: [
      { path: "/", label: "製品TOP" },
      { path: "/features", label: "機能紹介(予定)" },
      { path: "/pricing", label: "料金プラン(予定)" },
      { path: "/docs", label: "ドキュメント(予定)" },
      { path: "/contact", label: "導入相談(予定)" },
    ],
  },
  {
    host: "ange-spa.jp",
    role: "アンジュスパ屋号(独自ドメインありテナント・1号機)",
    type: "tenant-custom",
    status: "active",
    paths: [
      { path: "/", label: "公開HOME", group: "公開HP" },
      { path: "/schedule", label: "本日の出勤", group: "公開HP" },
      { path: "/therapist", label: "セラピスト一覧", group: "公開HP" },
      { path: "/diary", label: "写メ日記", group: "公開HP" },
      { path: "/system", label: "料金・システム", group: "公開HP" },
      { path: "/access", label: "アクセス", group: "公開HP" },
      { path: "/contact", label: "お問い合わせ", group: "公開HP" },
      { path: "/recruit", label: "求人", group: "公開HP" },

      { path: "/mypage", label: "お客様マイページ", group: "お客様" },
      { path: "/reservation/[token]", label: "予約確認", group: "お客様" },

      { path: "/cast", label: "セラピストログイン+マイページ(8タブ)", group: "セラピスト" },
      { path: "/cast/tax-guide", label: "副業バレ防止ガイド", group: "セラピスト" },
      { path: "/cast/spouse-guide", label: "配偶者控除ガイド", group: "セラピスト" },
      { path: "/cast/invoice-guide", label: "インボイスガイド", group: "セラピスト" },
      { path: "/cast/single-mother-guide", label: "シングルマザーガイド", group: "セラピスト" },
      { path: "/cast/customer", label: "顧客詳細", group: "セラピスト" },

      { path: "/admin", label: "スタッフログイン", group: "管理画面" },
      { path: "/admin/dashboard", label: "HOME・営業締め", group: "管理画面" },
      { path: "/admin/timechart", label: "タイムチャート", group: "管理画面" },
      { path: "/admin/expenses", label: "経費管理", group: "管理画面" },
      { path: "/admin/cash-dashboard", label: "資金管理(社長・経営責任者)", group: "管理画面" },
      { path: "/admin/tax-portal", label: "税理士ポータル", group: "管理画面" },
      { path: "/admin/tax-dashboard", label: "バックオフィス", group: "管理画面" },
      { path: "/admin/staff", label: "スタッフ設定", group: "管理画面" },
      { path: "/admin/therapists", label: "セラピスト登録", group: "管理画面" },
      { path: "/admin/courses", label: "コース登録", group: "管理画面" },
      { path: "/admin/manual", label: "マニュアル管理", group: "管理画面" },
      { path: "/admin/operations-manual", label: "操作マニュアル", group: "管理画面" },
      { path: "/admin/cti-monitor", label: "CTI監視", group: "管理画面" },
      { path: "/admin/...", label: "その他 約30の管理ページ", group: "管理画面" },

      { path: "/contract-sign/[token]", label: "業務委託契約書署名", group: "書類提出" },
      { path: "/license-upload/[token]", label: "身分証アップロード", group: "書類提出" },
      { path: "/invoice-upload/[token]", label: "インボイス登録証", group: "書類提出" },
      { path: "/mynumber-upload/[token]", label: "マイナンバー", group: "書類提出" },
    ],
  },
  {
    host: "{tenant}.t-manage.jp",
    role: "独自ドメインなしテナント用(将来:resexy 等)",
    type: "tenant-sub",
    status: "planned",
    paths: [
      { path: "/", label: "そのお店の公開HP", group: "公開HP" },
      { path: "/schedule, /therapist, /diary 他", label: "ange-spa.jp と同じパス構造", group: "公開HP" },
      { path: "/mypage", label: "お客様マイページ", group: "お客様" },
      { path: "/cast", label: "セラピスト", group: "セラピスト" },
      { path: "/admin", label: "管理画面", group: "管理画面" },
    ],
  },
];

const TYPE_COLORS: Record<Domain["type"], string> = {
  corp: "#7c3aed",
  "saas-admin": "#dc2626",
  "product-lp": "#0891b2",
  "tenant-custom": "#e8849a",
  "tenant-sub": "#c3a782",
};

const TYPE_LABELS: Record<Domain["type"], string> = {
  corp: "法人サイト",
  "saas-admin": "SaaS管理",
  "product-lp": "製品LP",
  "tenant-custom": "独自ドメインテナント",
  "tenant-sub": "サブドメインテナント",
};

export default function URLStructurePage() {
  const { T } = useTheme();

  return (
    <TeraAdminShell>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 24, fontWeight: 800, color: T.text, marginBottom: 8 }}>
          🌐 URL 構成
        </div>
        <div style={{ fontSize: 13, color: T.textSub, lineHeight: 1.7 }}>
          TERA-MANAGE が運営する全ドメインの構成と、各テナントの URL 構造を可視化したものです。
          独自ドメインありテナント(ange-spa.jp)と独自ドメインなしテナント(*.t-manage.jp)で
          パス構造は完全に同じになるよう設計されています。
        </div>
      </div>

      {/* 階層イメージ */}
      <div
        style={{
          backgroundColor: T.card,
          border: `1px solid ${T.border}`,
          borderRadius: 12,
          padding: 24,
          marginBottom: 24,
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 16 }}>
          階層関係
        </div>
        <pre
          style={{
            fontSize: 12,
            lineHeight: 1.8,
            color: T.text,
            backgroundColor: T.cardAlt,
            padding: 16,
            borderRadius: 8,
            overflow: "auto",
            fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace",
          }}
        >{`tera-manage.jp                    法人ブランド(運営本体)
├── /                              法人サイト(対外PR)
└── admin.tera-manage.jp           SaaS全体管理(運営者専用)
            │
            ▼ 提供
t-manage.jp                        製品名・営業窓口(LP)
            │
            ▼ 製品の実体は各屋号ドメインで稼働
┌───────────┴───────────────┐
▼                           ▼
ange-spa.jp                 {tenant}.t-manage.jp
(独自ドメインあり)           (独自ドメインなし)
├── /        公開HP         ├── /        公開HP
├── /mypage  お客様         ├── /mypage  お客様
├── /cast    セラピスト     ├── /cast    セラピスト
└── /admin   管理画面       └── /admin   管理画面`}</pre>
      </div>

      {/* ドメイン別詳細 */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {DOMAINS.map((domain) => {
          // path をグループ別に整理
          const groups: Record<string, typeof domain.paths> = {};
          domain.paths.forEach((p) => {
            const g = p.group || "default";
            if (!groups[g]) groups[g] = [];
            groups[g].push(p);
          });

          return (
            <div
              key={domain.host}
              style={{
                backgroundColor: T.card,
                border: `1px solid ${T.border}`,
                borderRadius: 12,
                padding: 20,
                opacity: domain.status === "planned" ? 0.7 : 1,
              }}
            >
              {/* ヘッダー */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  marginBottom: 16,
                  paddingBottom: 12,
                  borderBottom: `1px solid ${T.border}`,
                }}
              >
                <div
                  style={{
                    padding: "4px 10px",
                    backgroundColor: TYPE_COLORS[domain.type],
                    color: "#fff",
                    fontSize: 10,
                    fontWeight: 700,
                    borderRadius: 6,
                    letterSpacing: 1,
                  }}
                >
                  {TYPE_LABELS[domain.type]}
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, color: T.text, fontFamily: "ui-monospace, monospace" }}>
                  {domain.host}
                </div>
                <div style={{ fontSize: 12, color: T.textSub }}>{domain.role}</div>
                {domain.status === "planned" && (
                  <div
                    style={{
                      marginLeft: "auto",
                      padding: "2px 8px",
                      fontSize: 10,
                      color: "#f59e0b",
                      border: "1px solid #f59e0b",
                      borderRadius: 4,
                    }}
                  >
                    将来予定
                  </div>
                )}
              </div>

              {/* グループ別パス */}
              {Object.entries(groups).map(([groupName, paths]) => (
                <div key={groupName} style={{ marginBottom: 16 }}>
                  {groupName !== "default" && (
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: T.textSub,
                        marginBottom: 8,
                        letterSpacing: 1,
                      }}
                    >
                      ▌ {groupName}
                    </div>
                  )}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: 6 }}>
                    {paths.map((p, i) => (
                      <div
                        key={i}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          padding: "6px 10px",
                          backgroundColor: T.cardAlt,
                          borderRadius: 6,
                        }}
                      >
                        <div
                          style={{
                            fontSize: 12,
                            fontFamily: "ui-monospace, monospace",
                            color: T.accent,
                            minWidth: 0,
                            flexShrink: 0,
                          }}
                        >
                          {p.path}
                        </div>
                        <div style={{ fontSize: 11, color: T.textSub, marginLeft: "auto" }}>
                          {p.label}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {/* フッター注記 */}
      <div
        style={{
          marginTop: 24,
          padding: 16,
          backgroundColor: T.cardAlt,
          border: `1px solid ${T.border}`,
          borderRadius: 8,
          fontSize: 11,
          color: T.textSub,
          lineHeight: 1.7,
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 4 }}>📌 設計のポイント</div>
        <ul style={{ paddingLeft: 16, margin: 0 }}>
          <li>独自ドメインありテナントとなしテナントで <code style={{ color: T.accent }}>パス構造は完全に同じ</code></li>
          <li>middleware が <code style={{ color: T.accent }}>ホスト名 → テナント</code> を判定し、同一コードベースで全テナント運用</li>
          <li>独自ドメイン取得後は、サブドメインから 301 リダイレクトでスムーズに移行可能</li>
          <li>新規テナント発行は「店舗一覧」→「新規店舗発行」から実行</li>
        </ul>
      </div>
    </TeraAdminShell>
  );
}
