"use client";

/**
 * ═══════════════════════════════════════════════════════════
 * EventsPanel — スタッフ設定ページの「イベント管理」タブ本体
 *
 * 用途:
 *   HP トップカルーセルおよびお客様マイページに表示するイベントの
 *   CRUD。期間・画像・公開範囲・CTA を管理。
 *
 * テーブル: events (sql/session56_events_and_auth_prep.sql)
 * デザイン: 管理画面既存 T (useTheme) カラーに準拠
 * ═══════════════════════════════════════════════════════════
 */

import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useTheme } from "../lib/theme";
import type { Event } from "../lib/events";
import { formatEventPeriod } from "../lib/events";

type ThemeColors = ReturnType<typeof useTheme>["T"];

const todayStr = () => new Date().toISOString().split("T")[0];

const emptyDraft: Omit<Event, "id" | "created_at" | "updated_at"> = {
  title: "",
  subtitle: "",
  description: "",
  badge_label: "",
  image_url: "",
  accent_color: "",
  start_date: null,
  end_date: null,
  is_published: true,
  show_on_hp: true,
  show_on_mypage: true,
  members_only: false,
  cta_label: "",
  cta_url: "",
  sort_order: 0,
  created_by_name: "",
};

export default function EventsPanel({ staffName }: { staffName?: string }) {
  const { T } = useTheme();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Event | null>(null);
  const [draft, setDraft] = useState<typeof emptyDraft>(emptyDraft);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("events")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("id", { ascending: false });
    if (!error && data) setEvents(data as Event[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const openNew = () => {
    setEditing(null);
    setDraft({ ...emptyDraft, created_by_name: staffName || "" });
    setShowForm(true);
  };

  const openEdit = (e: Event) => {
    setEditing(e);
    setDraft({
      title: e.title,
      subtitle: e.subtitle || "",
      description: e.description || "",
      badge_label: e.badge_label || "",
      image_url: e.image_url || "",
      accent_color: e.accent_color || "",
      start_date: e.start_date,
      end_date: e.end_date,
      is_published: e.is_published,
      show_on_hp: e.show_on_hp,
      show_on_mypage: e.show_on_mypage,
      members_only: e.members_only,
      cta_label: e.cta_label || "",
      cta_url: e.cta_url || "",
      sort_order: e.sort_order || 0,
      created_by_name: e.created_by_name || "",
    });
    setShowForm(true);
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditing(null);
    setDraft(emptyDraft);
  };

  const handleSave = async () => {
    if (!draft.title.trim()) {
      alert("タイトルは必須です");
      return;
    }
    if (draft.start_date && draft.end_date && draft.start_date > draft.end_date) {
      alert("終了日は開始日以降にしてください");
      return;
    }
    setSaving(true);
    const payload = {
      ...draft,
      title: draft.title.trim(),
      subtitle: draft.subtitle.trim(),
      description: draft.description.trim(),
      badge_label: draft.badge_label.trim(),
      image_url: draft.image_url.trim(),
      accent_color: draft.accent_color.trim(),
      cta_label: draft.cta_label.trim(),
      cta_url: draft.cta_url.trim(),
      sort_order: Number(draft.sort_order) || 0,
      created_by_name: draft.created_by_name || staffName || "",
    };
    if (editing) {
      const { error } = await supabase.from("events").update(payload).eq("id", editing.id);
      if (error) {
        alert("更新に失敗しました: " + error.message);
        setSaving(false);
        return;
      }
    } else {
      const { error } = await supabase.from("events").insert(payload);
      if (error) {
        alert("登録に失敗しました: " + error.message);
        setSaving(false);
        return;
      }
    }
    setSaving(false);
    cancelForm();
    fetchAll();
  };

  const handleDelete = async (e: Event) => {
    if (!confirm(`「${e.title}」を削除します。よろしいですか？`)) return;
    const { error } = await supabase.from("events").delete().eq("id", e.id);
    if (error) {
      alert("削除に失敗しました: " + error.message);
      return;
    }
    fetchAll();
  };

  const togglePublish = async (e: Event) => {
    const { error } = await supabase
      .from("events")
      .update({ is_published: !e.is_published })
      .eq("id", e.id);
    if (!error) fetchAll();
  };

  const handleDuplicate = async (e: Event) => {
    const { id, created_at, updated_at, ...rest } = e;
    void id; void created_at; void updated_at;
    const { error } = await supabase.from("events").insert({
      ...rest,
      title: e.title + "（コピー）",
      is_published: false,
      created_by_name: staffName || "",
    });
    if (!error) fetchAll();
  };

  // 画像アップロード（Supabase Storage: manual-images を流用）
  const handleImageUpload = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const fname = `events/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage.from("manual-images").upload(fname, file, {
        cacheControl: "3600",
        upsert: false,
      });
      if (error) {
        alert("画像アップロードに失敗しました: " + error.message);
        setUploading(false);
        return;
      }
      const { data } = supabase.storage.from("manual-images").getPublicUrl(fname);
      setDraft((d) => ({ ...d, image_url: data.publicUrl }));
    } finally {
      setUploading(false);
    }
  };

  const today = todayStr();
  const statusOf = (e: Event): { label: string; color: string } => {
    if (!e.is_published) return { label: "下書き", color: T.textMuted };
    if (e.end_date && e.end_date < today) return { label: "終了", color: "#9e9a91" };
    if (e.start_date && e.start_date > today) return { label: "開始前", color: "#f59e0b" };
    return { label: "公開中", color: "#22c55e" };
  };

  return (
    <div className="space-y-4">
      {/* ── ヘッダー ── */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <p className="text-[14px] font-medium" style={{ color: T.text }}>
            🎁 イベント管理
          </p>
          <p className="text-[10px] mt-0.5" style={{ color: T.textMuted }}>
            HP トップのカルーセル、お客様マイページに表示される期間限定イベントを管理します
          </p>
        </div>
        <button
          onClick={openNew}
          className="px-4 py-2.5 rounded-xl text-[12px] font-medium cursor-pointer text-white"
          style={{ background: "linear-gradient(135deg, #c3a782, #b09672)" }}
        >
          ＋ 新規イベント
        </button>
      </div>

      {/* ── 一覧 ── */}
      {loading ? (
        <div className="text-center py-8 text-[12px]" style={{ color: T.textMuted }}>
          読み込み中...
        </div>
      ) : events.length === 0 ? (
        <div
          className="rounded-xl border p-8 text-center"
          style={{ backgroundColor: T.card, borderColor: T.border }}
        >
          <p className="text-[12px]" style={{ color: T.textMuted }}>
            まだイベントが登録されていません。
          </p>
          <p className="text-[11px] mt-2" style={{ color: T.textFaint }}>
            「新規イベント」からタイトル・画像・期間を設定するだけで、HP にカルーセル表示されます。
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {events.map((e) => {
            const status = statusOf(e);
            const period = formatEventPeriod(e);
            return (
              <div
                key={e.id}
                className="rounded-xl border overflow-hidden"
                style={{ backgroundColor: T.card, borderColor: T.border }}
              >
                {/* サムネイル */}
                <div
                  className="relative w-full"
                  style={{
                    aspectRatio: "16 / 9",
                    backgroundColor: T.cardAlt,
                    backgroundImage: e.image_url ? `url(${e.image_url})` : undefined,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }}
                >
                  {!e.image_url && (
                    <div className="absolute inset-0 flex items-center justify-center text-[11px]" style={{ color: T.textFaint }}>
                      画像未設定
                    </div>
                  )}
                  {e.badge_label && (
                    <span
                      className="absolute top-2 left-2 px-2 py-0.5 text-[10px] font-medium text-white"
                      style={{ backgroundColor: e.accent_color || "#e8849a" }}
                    >
                      {e.badge_label}
                    </span>
                  )}
                  <span
                    className="absolute top-2 right-2 px-2 py-0.5 text-[10px] font-medium rounded-full"
                    style={{ backgroundColor: status.color + "22", color: status.color }}
                  >
                    {status.label}
                  </span>
                </div>

                {/* 情報 */}
                <div className="p-3 space-y-2">
                  <div>
                    <p className="text-[13px] font-medium truncate" style={{ color: T.text }}>
                      {e.title}
                    </p>
                    {e.subtitle && (
                      <p className="text-[10px] truncate" style={{ color: T.textSub }}>
                        {e.subtitle}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5 text-[9px]">
                    {period && (
                      <span className="px-1.5 py-0.5 rounded" style={{ backgroundColor: T.cardAlt, color: T.textMuted }}>
                        📅 {period}
                      </span>
                    )}
                    {e.show_on_hp && (
                      <span className="px-1.5 py-0.5 rounded" style={{ backgroundColor: "#e8849a18", color: "#c96b83" }}>
                        HP
                      </span>
                    )}
                    {e.show_on_mypage && (
                      <span className="px-1.5 py-0.5 rounded" style={{ backgroundColor: "#4a7c5918", color: "#4a7c59" }}>
                        マイページ
                      </span>
                    )}
                    {e.members_only && (
                      <span className="px-1.5 py-0.5 rounded" style={{ backgroundColor: "#f59e0b22", color: "#b97808" }}>
                        会員限定
                      </span>
                    )}
                  </div>

                  {/* アクション */}
                  <div className="flex gap-1.5 pt-1">
                    <button
                      onClick={() => openEdit(e)}
                      className="flex-1 px-2 py-1.5 rounded-lg text-[10px] cursor-pointer border"
                      style={{ borderColor: T.border, color: T.textSub }}
                    >
                      編集
                    </button>
                    <button
                      onClick={() => togglePublish(e)}
                      className="flex-1 px-2 py-1.5 rounded-lg text-[10px] cursor-pointer border"
                      style={{
                        borderColor: e.is_published ? "#f59e0b" : "#22c55e",
                        color: e.is_published ? "#b97808" : "#22c55e",
                        backgroundColor: e.is_published ? "#f59e0b11" : "#22c55e11",
                      }}
                    >
                      {e.is_published ? "非公開に" : "公開する"}
                    </button>
                    <button
                      onClick={() => handleDuplicate(e)}
                      className="px-2 py-1.5 rounded-lg text-[10px] cursor-pointer border"
                      style={{ borderColor: T.border, color: T.textMuted }}
                      title="複製"
                    >
                      📋
                    </button>
                    <button
                      onClick={() => handleDelete(e)}
                      className="px-2 py-1.5 rounded-lg text-[10px] cursor-pointer border"
                      style={{ borderColor: "#c4555555", color: "#c45555" }}
                      title="削除"
                    >
                      🗑
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── 編集モーダル ── */}
      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-end md:items-center justify-center"
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
          onClick={cancelForm}
        >
          <div
            className="rounded-t-2xl md:rounded-2xl border w-full md:max-w-2xl max-h-[92vh] overflow-y-auto"
            style={{ backgroundColor: T.card, borderColor: T.border }}
            onClick={(ev) => ev.stopPropagation()}
          >
            <EventForm
              T={T}
              draft={draft}
              setDraft={setDraft}
              editing={!!editing}
              saving={saving}
              uploading={uploading}
              onSave={handleSave}
              onCancel={cancelForm}
              onUpload={handleImageUpload}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// フォーム本体
// ─────────────────────────────────────────────────────────
function EventForm({
  T,
  draft,
  setDraft,
  editing,
  saving,
  uploading,
  onSave,
  onCancel,
  onUpload,
}: {
  T: ThemeColors;
  draft: typeof emptyDraft;
  setDraft: React.Dispatch<React.SetStateAction<typeof emptyDraft>>;
  editing: boolean;
  saving: boolean;
  uploading: boolean;
  onSave: () => void;
  onCancel: () => void;
  onUpload: (file: File) => void;
}) {
  const inputCls = "w-full px-3 py-2 rounded-lg text-[12px] outline-none border";
  const inputStyle = { backgroundColor: T.cardAlt, borderColor: T.border, color: T.text };

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-[14px] font-medium" style={{ color: T.text }}>
          {editing ? "イベントを編集" : "新規イベントを作成"}
        </h3>
        <button
          onClick={onCancel}
          className="text-[18px] cursor-pointer"
          style={{ color: T.textMuted }}
          aria-label="閉じる"
        >
          ×
        </button>
      </div>

      {/* 基本情報 */}
      <div>
        <Label T={T}>タイトル *</Label>
        <input
          type="text"
          value={draft.title}
          onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
          placeholder="夏の感謝祭キャンペーン"
          className={inputCls}
          style={inputStyle}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label T={T}>サブタイトル</Label>
          <input
            type="text"
            value={draft.subtitle}
            onChange={(e) => setDraft((d) => ({ ...d, subtitle: e.target.value }))}
            placeholder="30分延長サービス"
            className={inputCls}
            style={inputStyle}
          />
        </div>
        <div>
          <Label T={T}>バッジ</Label>
          <input
            type="text"
            value={draft.badge_label}
            onChange={(e) => setDraft((d) => ({ ...d, badge_label: e.target.value }))}
            placeholder="NEW / 限定 / 人気"
            className={inputCls}
            style={inputStyle}
          />
        </div>
      </div>

      <div>
        <Label T={T}>説明文</Label>
        <textarea
          value={draft.description}
          onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
          rows={3}
          placeholder="イベントの詳細をご記入ください"
          className={inputCls + " resize-none"}
          style={inputStyle}
        />
      </div>

      {/* 画像 */}
      <div>
        <Label T={T}>画像（推奨 16:10 / 横長）</Label>
        {draft.image_url ? (
          <div className="space-y-2">
            <div
              className="w-full rounded-lg border overflow-hidden"
              style={{ aspectRatio: "16 / 10", borderColor: T.border }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={draft.image_url} alt="" className="w-full h-full object-cover" />
            </div>
            <div className="flex gap-2">
              <label
                className="px-3 py-1.5 rounded-lg text-[11px] cursor-pointer border"
                style={{ borderColor: T.border, color: T.textSub }}
              >
                差し替え
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onUpload(f);
                  }}
                />
              </label>
              <button
                onClick={() => setDraft((d) => ({ ...d, image_url: "" }))}
                className="px-3 py-1.5 rounded-lg text-[11px] cursor-pointer border"
                style={{ borderColor: "#c4555555", color: "#c45555" }}
              >
                削除
              </button>
            </div>
          </div>
        ) : (
          <label
            className="block rounded-lg border-2 border-dashed p-6 text-center cursor-pointer"
            style={{ borderColor: T.border, color: T.textMuted }}
          >
            <p className="text-[12px]">
              {uploading ? "アップロード中..." : "クリックして画像を選択"}
            </p>
            <p className="text-[9px] mt-1" style={{ color: T.textFaint }}>
              JPEG / PNG / WebP、5MB まで推奨
            </p>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onUpload(f);
              }}
            />
          </label>
        )}
      </div>

      {/* 期間 */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label T={T}>開始日</Label>
          <input
            type="date"
            value={draft.start_date || ""}
            onChange={(e) => setDraft((d) => ({ ...d, start_date: e.target.value || null }))}
            className={inputCls}
            style={inputStyle}
          />
          <p className="text-[9px] mt-0.5" style={{ color: T.textFaint }}>
            空欄で即時公開
          </p>
        </div>
        <div>
          <Label T={T}>終了日</Label>
          <input
            type="date"
            value={draft.end_date || ""}
            onChange={(e) => setDraft((d) => ({ ...d, end_date: e.target.value || null }))}
            className={inputCls}
            style={inputStyle}
          />
          <p className="text-[9px] mt-0.5" style={{ color: T.textFaint }}>
            空欄で無期限
          </p>
        </div>
      </div>

      {/* CTA */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label T={T}>ボタン文言</Label>
          <input
            type="text"
            value={draft.cta_label}
            onChange={(e) => setDraft((d) => ({ ...d, cta_label: e.target.value }))}
            placeholder="詳細を見る / 今すぐ予約"
            className={inputCls}
            style={inputStyle}
          />
        </div>
        <div>
          <Label T={T}>遷移先</Label>
          <input
            type="text"
            value={draft.cta_url}
            onChange={(e) => setDraft((d) => ({ ...d, cta_url: e.target.value }))}
            placeholder="/schedule または https://..."
            className={inputCls}
            style={inputStyle}
          />
        </div>
      </div>

      {/* 色・並び順 */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label T={T}>アクセントカラー</Label>
          <div className="flex gap-2 items-center">
            <input
              type="color"
              value={draft.accent_color || "#e8849a"}
              onChange={(e) => setDraft((d) => ({ ...d, accent_color: e.target.value }))}
              className="w-10 h-9 rounded cursor-pointer border"
              style={{ borderColor: T.border }}
            />
            <input
              type="text"
              value={draft.accent_color}
              onChange={(e) => setDraft((d) => ({ ...d, accent_color: e.target.value }))}
              placeholder="#e8849a"
              className={inputCls + " flex-1"}
              style={inputStyle}
            />
          </div>
        </div>
        <div>
          <Label T={T}>並び順（昇順）</Label>
          <input
            type="number"
            value={draft.sort_order}
            onChange={(e) =>
              setDraft((d) => ({ ...d, sort_order: Number(e.target.value) || 0 }))
            }
            className={inputCls}
            style={inputStyle}
          />
        </div>
      </div>

      {/* 公開設定 */}
      <div
        className="rounded-lg border p-3 space-y-2"
        style={{ backgroundColor: T.cardAlt, borderColor: T.border }}
      >
        <p className="text-[11px] font-medium" style={{ color: T.textSub }}>
          公開設定
        </p>
        <CheckRow
          T={T}
          checked={draft.is_published}
          onChange={(v) => setDraft((d) => ({ ...d, is_published: v }))}
          label="公開する"
          hint="OFF にすると下書き扱いで一切表示されません"
        />
        <CheckRow
          T={T}
          checked={draft.show_on_hp}
          onChange={(v) => setDraft((d) => ({ ...d, show_on_hp: v }))}
          label="公式HPのカルーセルに表示"
        />
        <CheckRow
          T={T}
          checked={draft.show_on_mypage}
          onChange={(v) => setDraft((d) => ({ ...d, show_on_mypage: v }))}
          label="お客様マイページに表示"
        />
        <CheckRow
          T={T}
          checked={draft.members_only}
          onChange={(v) => setDraft((d) => ({ ...d, members_only: v }))}
          label="会員限定（ログイン中の方のみ表示）"
          hint="HP 上では未ログインの訪問者には表示されなくなります"
        />
      </div>

      {/* アクション */}
      <div className="flex gap-2 pt-2">
        <button
          onClick={onCancel}
          className="flex-1 py-2.5 rounded-xl text-[12px] cursor-pointer border"
          style={{ borderColor: T.border, color: T.textSub }}
        >
          キャンセル
        </button>
        <button
          onClick={onSave}
          disabled={saving}
          className="flex-[2] py-2.5 rounded-xl text-[12px] font-medium cursor-pointer text-white disabled:opacity-60"
          style={{ background: "linear-gradient(135deg, #c3a782, #b09672)" }}
        >
          {saving ? "保存中..." : editing ? "更新する" : "登録する"}
        </button>
      </div>
    </div>
  );
}

function Label({ T, children }: { T: ThemeColors; children: React.ReactNode }) {
  return (
    <label
      className="block text-[11px] mb-1"
      style={{ color: T.textSub, fontWeight: 500 }}
    >
      {children}
    </label>
  );
}

function CheckRow({
  T,
  checked,
  onChange,
  label,
  hint,
}: {
  T: ThemeColors;
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <label className="flex items-start gap-2 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 cursor-pointer"
      />
      <div>
        <span className="text-[12px]" style={{ color: T.text }}>
          {label}
        </span>
        {hint && (
          <p className="text-[9px] mt-0.5" style={{ color: T.textFaint }}>
            {hint}
          </p>
        )}
      </div>
    </label>
  );
}
