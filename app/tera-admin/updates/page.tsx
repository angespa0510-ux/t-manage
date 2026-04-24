"use client";

import { useState } from "react";
import { useTheme } from "../../../lib/theme";
import { TeraAdminShell } from "../TeraAdminNav";
import { DUMMY_INSTANCES } from "../../../lib/tera-admin-mock";

export default function UpdatesPage() {
  const { T } = useTheme();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [targetInstances, setTargetInstances] = useState<string[]>([]);
  const [priority, setPriority] = useState<"normal" | "important" | "urgent">("normal");

  const toggleInstance = (id: string) => {
    setTargetInstances((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const selectAll = () => setTargetInstances(DUMMY_INSTANCES.map((i) => i.id));
  const clearAll = () => setTargetInstances([]);

  return (
    <TeraAdminShell>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: T.text, marginBottom: 4 }}>
          📢 一斉アップデート配信
        </h1>
        <p style={{ color: T.textSub, fontSize: 13 }}>
          複数の店舗にシステムアップデート通知やお知らせを一斉配信できます
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20 }}>
        {/* 左: 配信内容 */}
        <div
          style={{
            background: T.card,
            border: `1px solid ${T.border}`,
            borderRadius: 12,
            padding: 24,
          }}
        >
          <h3 style={{ fontSize: 16, fontWeight: 700, color: T.text, marginTop: 0, marginBottom: 16 }}>
            📝 配信内容
          </h3>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: T.text, marginBottom: 6 }}>
              重要度
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              {[
                { key: "normal", label: "📋 通常", color: T.textSub },
                { key: "important", label: "⚠️ 重要", color: "#b38419" },
                { key: "urgent", label: "🚨 緊急", color: "#c96b83" },
              ].map((p) => (
                <button
                  key={p.key}
                  onClick={() => setPriority(p.key as any)}
                  style={{
                    flex: 1,
                    padding: 10,
                    background: priority === p.key ? `${p.color}22` : T.cardAlt,
                    border: `2px solid ${priority === p.key ? p.color : T.border}`,
                    borderRadius: 8,
                    color: priority === p.key ? p.color : T.text,
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: T.text, marginBottom: 6 }}>
              タイトル
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例: システムメンテナンスのお知らせ"
              style={{
                width: "100%",
                padding: 10,
                background: T.cardAlt,
                border: `1px solid ${T.border}`,
                borderRadius: 6,
                color: T.text,
                fontSize: 13,
                boxSizing: "border-box",
              }}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: T.text, marginBottom: 6 }}>
              本文
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="配信したい内容を入力してください。Markdown対応。"
              rows={10}
              style={{
                width: "100%",
                padding: 10,
                background: T.cardAlt,
                border: `1px solid ${T.border}`,
                borderRadius: 6,
                color: T.text,
                fontSize: 13,
                fontFamily: "ui-sans-serif, sans-serif",
                boxSizing: "border-box",
                resize: "vertical",
              }}
            />
          </div>

          <div
            style={{
              padding: 12,
              background: T.cardAlt,
              borderRadius: 8,
              fontSize: 11,
              color: T.textSub,
            }}
          >
            💡 配信先の店舗の管理者メールアドレスに通知が送信されます。配信履歴は「アクティビティログ」で確認できます。
          </div>
        </div>

        {/* 右: 配信先選択 */}
        <div
          style={{
            background: T.card,
            border: `1px solid ${T.border}`,
            borderRadius: 12,
            padding: 20,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: T.text, margin: 0 }}>
              🎯 配信先
            </h3>
            <div style={{ fontSize: 11, color: T.textSub }}>
              {targetInstances.length} / {DUMMY_INSTANCES.length} 選択中
            </div>
          </div>

          <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
            <button
              onClick={selectAll}
              style={{
                flex: 1,
                padding: 8,
                background: T.cardAlt,
                border: `1px solid ${T.border}`,
                borderRadius: 6,
                color: T.text,
                fontSize: 11,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              全選択
            </button>
            <button
              onClick={clearAll}
              style={{
                flex: 1,
                padding: 8,
                background: T.cardAlt,
                border: `1px solid ${T.border}`,
                borderRadius: 6,
                color: T.text,
                fontSize: 11,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              クリア
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 20 }}>
            {DUMMY_INSTANCES.map((inst) => {
              const checked = targetInstances.includes(inst.id);
              return (
                <label
                  key={inst.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: 10,
                    background: checked ? `${T.accent}11` : T.cardAlt,
                    border: `1px solid ${checked ? T.accent : T.border}`,
                    borderRadius: 8,
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleInstance(inst.id)}
                    style={{ width: 16, height: 16 }}
                  />
                  <div
                    style={{
                      width: 6,
                      height: 24,
                      background: inst.theme_color_primary,
                      borderRadius: 3,
                    }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: T.text }}>
                      {inst.name}
                    </div>
                    <div style={{ fontSize: 10, color: T.textSub }}>
                      {inst.subdomain}.t-manage.jp
                    </div>
                  </div>
                </label>
              );
            })}
          </div>

          <button
            onClick={() =>
              alert(
                `📢 配信内容:\n\nタイトル: ${title}\n重要度: ${priority}\n配信先: ${targetInstances.length}店舗\n\n(Phase 7 で実装)`
              )
            }
            disabled={!title || !body || targetInstances.length === 0}
            style={{
              width: "100%",
              padding: "12px 18px",
              background: !title || !body || targetInstances.length === 0 ? T.border : T.accent,
              color: "#fff",
              border: "none",
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 700,
              cursor: !title || !body || targetInstances.length === 0 ? "not-allowed" : "pointer",
              opacity: !title || !body || targetInstances.length === 0 ? 0.5 : 1,
            }}
          >
            📢 配信する
          </button>
        </div>
      </div>

      <div
        style={{
          marginTop: 20,
          padding: 16,
          background: T.card,
          border: `1px solid ${T.border}`,
          borderRadius: 10,
          fontSize: 12,
          color: T.textSub,
          lineHeight: 1.7,
        }}
      >
        <strong style={{ color: T.text }}>📬 配信時の挙動（Phase 7 実装予定）</strong>
        <ul style={{ margin: "8px 0 0 20px", padding: 0 }}>
          <li>各店舗の管理者メールアドレスに自動送信</li>
          <li>T-MANAGE管理画面にお知らせバナーを自動表示</li>
          <li>緊急時はSMS通知も追加可能</li>
          <li>配信履歴は instance_activity_logs に記録</li>
        </ul>
      </div>
    </TeraAdminShell>
  );
}
