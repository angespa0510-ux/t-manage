"use client";

import Link from "next/link";
import { useState } from "react";
import { useTheme } from "../../../lib/theme";
import { TeraAdminShell } from "../TeraAdminNav";
import {
  DUMMY_INSTANCES,
  getStatusLabel,
  getPlanLabel,
  formatJPY,
  type TmanageInstance,
} from "../../../lib/tera-admin-mock";

export default function InstancesList() {
  const { T } = useTheme();
  const [filter, setFilter] = useState<"all" | "active" | "preparing" | "suspended">("all");
  const [search, setSearch] = useState("");

  const filtered = DUMMY_INSTANCES.filter((i) => {
    if (filter !== "all" && i.status !== filter) return false;
    if (search && !i.name.toLowerCase().includes(search.toLowerCase()) && !i.subdomain.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <TeraAdminShell>
      <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: T.text, marginBottom: 4 }}>
            🏢 店舗一覧
          </h1>
          <p style={{ color: T.textSub, fontSize: 13 }}>
            全 {DUMMY_INSTANCES.length} 件のインスタンス
          </p>
        </div>
        <Link
          href="/tera-admin/instances/new"
          style={{
            padding: "10px 18px",
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

      {/* フィルター */}
      <div
        style={{
          display: "flex",
          gap: 10,
          marginBottom: 20,
          flexWrap: "wrap",
        }}
      >
        <input
          type="text"
          placeholder="🔍 店舗名・サブドメインで検索..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            padding: "10px 14px",
            background: T.card,
            border: `1px solid ${T.border}`,
            borderRadius: 8,
            color: T.text,
            fontSize: 13,
            flex: 1,
            minWidth: 200,
          }}
        />

        <div style={{ display: "flex", gap: 4 }}>
          {[
            { key: "all", label: "すべて" },
            { key: "active", label: "稼働中" },
            { key: "preparing", label: "準備中" },
            { key: "suspended", label: "一時停止" },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key as any)}
              style={{
                padding: "10px 16px",
                background: filter === f.key ? T.accent : T.card,
                border: `1px solid ${filter === f.key ? T.accent : T.border}`,
                borderRadius: 8,
                color: filter === f.key ? "#fff" : T.text,
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* テーブル */}
      <div
        style={{
          background: T.card,
          border: `1px solid ${T.border}`,
          borderRadius: 12,
          overflow: "hidden",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: T.cardAlt, borderBottom: `2px solid ${T.border}` }}>
              <Th T={T}>店舗名</Th>
              <Th T={T}>サブドメイン</Th>
              <Th T={T}>法人</Th>
              <Th T={T}>ステータス</Th>
              <Th T={T}>プラン</Th>
              <Th T={T}>セラピスト</Th>
              <Th T={T}>月商</Th>
              <Th T={T}>稼働日</Th>
              <Th T={T}>アクション</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ padding: 40, textAlign: "center", color: T.textSub }}>
                  該当する店舗がありません
                </td>
              </tr>
            ) : (
              filtered.map((i) => {
                const status = getStatusLabel(i.status);
                return (
                  <tr
                    key={i.id}
                    style={{ borderBottom: `1px solid ${T.border}` }}
                  >
                    <Td T={T}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div
                          style={{
                            width: 8,
                            height: 28,
                            background: i.theme_color_primary,
                            borderRadius: 4,
                          }}
                        />
                        <div>
                          <div style={{ fontWeight: 700, color: T.text }}>{i.name}</div>
                          <div style={{ fontSize: 11, color: T.textSub }}>{i.shop_type}</div>
                        </div>
                      </div>
                    </Td>
                    <Td T={T}>
                      <code style={{ fontSize: 11, color: T.textSub }}>{i.subdomain}.t-manage.jp</code>
                    </Td>
                    <Td T={T}>
                      <span style={{ fontSize: 12 }}>{i.corporation_name}</span>
                    </Td>
                    <Td T={T}>
                      <span
                        style={{
                          padding: "3px 10px",
                          borderRadius: 12,
                          fontSize: 11,
                          fontWeight: 700,
                          background: `${status.color}22`,
                          color: status.color,
                        }}
                      >
                        {status.label}
                      </span>
                    </Td>
                    <Td T={T}>{getPlanLabel(i.plan)}</Td>
                    <Td T={T}>{i.stats.therapist_count}名</Td>
                    <Td T={T}>{formatJPY(i.stats.monthly_revenue)}</Td>
                    <Td T={T}>
                      <span style={{ fontSize: 11, color: T.textSub }}>{i.go_live_date || "-"}</span>
                    </Td>
                    <Td T={T}>
                      <div style={{ display: "flex", gap: 6 }}>
                        <Link
                          href={`/tera-admin/instances/${i.id}`}
                          style={{
                            padding: "4px 10px",
                            borderRadius: 6,
                            background: T.accent,
                            color: "#fff",
                            textDecoration: "none",
                            fontSize: 11,
                            fontWeight: 600,
                          }}
                        >
                          詳細
                        </Link>
                      </div>
                    </Td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </TeraAdminShell>
  );
}

function Th({ T, children }: { T: any; children: React.ReactNode }) {
  return (
    <th
      style={{
        padding: "12px 14px",
        textAlign: "left",
        fontSize: 11,
        fontWeight: 700,
        color: T.textSub,
        textTransform: "uppercase",
        letterSpacing: 0.5,
      }}
    >
      {children}
    </th>
  );
}

function Td({ T, children }: { T: any; children: React.ReactNode }) {
  return <td style={{ padding: "12px 14px", color: T.text }}>{children}</td>;
}
