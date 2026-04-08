"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter, useSearchParams } from "next/navigation";
import { useTheme } from "../../lib/theme";
import { NavMenu } from "../../lib/nav-menu";

type SyncResult = { name: string; status: string; error?: string };

const SETTING_KEYS = [
  "google_client_id", "google_client_secret", "google_refresh_token", "google_access_token",
  "contact_sync_customers", "contact_sync_therapists", "contact_sync_staff",
  "contact_sync_name_overwrite", "contact_sync_auto",
];

const GROUP_NAMES = [
  "T-MANAGE 顧客", "T-MANAGE 要注意", "T-MANAGE 出禁",
  "T-MANAGE セラピスト", "T-MANAGE セラピスト休止", "T-MANAGE セラピスト退職",
  "T-MANAGE スタッフ",
];

function ContactSyncInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { dark, toggle, T } = useTheme();

  // 設定値
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [refreshToken, setRefreshToken] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [syncCustomers, setSyncCustomers] = useState(true);
  const [syncTherapists, setSyncTherapists] = useState(true);
  const [syncStaff, setSyncStaff] = useState(true);
  const [nameOverwrite, setNameOverwrite] = useState(false);
  const [autoSync, setAutoSync] = useState(false);

  // UI状態
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [connected, setConnected] = useState(false);
  const [accountName, setAccountName] = useState("");
  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState("");
  const [groups, setGroups] = useState<{ name: string; resourceName: string; memberCount: number }[]>([]);
  const [initingGroups, setInitingGroups] = useState(false);

  // 同期
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState("");
  const [syncResults, setSyncResults] = useState<SyncResult[]>([]);
  const [syncTab, setSyncTab] = useState<"customers" | "therapists" | "staff">("customers");

  // 設定読み込み
  const loadSettings = useCallback(async () => {
    const { data } = await supabase.from("store_settings").select("key,value").in("key", SETTING_KEYS);
    if (data) {
      for (const s of data) {
        if (s.key === "google_client_id") setClientId(s.value);
        if (s.key === "google_client_secret") setClientSecret(s.value);
        if (s.key === "google_refresh_token") setRefreshToken(s.value);
        if (s.key === "google_access_token") setAccessToken(s.value);
        if (s.key === "contact_sync_customers") setSyncCustomers(s.value === "true");
        if (s.key === "contact_sync_therapists") setSyncTherapists(s.value === "true");
        if (s.key === "contact_sync_staff") setSyncStaff(s.value === "true");
        if (s.key === "contact_sync_name_overwrite") setNameOverwrite(s.value === "true");
        if (s.key === "contact_sync_auto") setAutoSync(s.value === "true");
      }
    }
  }, []);

  useEffect(() => {
    const check = async () => { const { data: { user } } = await supabase.auth.getUser(); if (!user) router.push("/"); };
    check();
    loadSettings();
  }, [router, loadSettings]);

  // OAuthコールバック処理
  useEffect(() => {
    const code = searchParams.get("code");
    const error = searchParams.get("error");
    if (error) { setTestMsg(`❌ 認証エラー: ${error}`); return; }
    if (code && clientId && clientSecret) {
      const exchangeToken = async () => {
        const redirectUri = `${window.location.origin}/api/google-auth/callback`;
        const res = await fetch("/api/google-auth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "exchange", clientId, clientSecret, code, redirectUri }),
        });
        const data = await res.json();
        if (data.access_token) {
          setAccessToken(data.access_token);
          if (data.refresh_token) setRefreshToken(data.refresh_token);
          // DB保存
          await supabase.from("store_settings").upsert({ key: "google_access_token", value: data.access_token }, { onConflict: "key" });
          if (data.refresh_token) await supabase.from("store_settings").upsert({ key: "google_refresh_token", value: data.refresh_token }, { onConflict: "key" });
          setConnected(true);
          setTestMsg("✅ Google認証成功！");
          // URLからcodeパラメータを除去
          window.history.replaceState({}, "", "/contact-sync");
        } else {
          setTestMsg(`❌ トークン交換失敗: ${data.error}`);
        }
      };
      exchangeToken();
    }
  }, [searchParams, clientId, clientSecret]);

  // 設定保存
  const saveSettings = async () => {
    setSaving(true); setSaveMsg("");
    const pairs: [string, string][] = [
      ["google_client_id", clientId],
      ["google_client_secret", clientSecret],
      ["google_refresh_token", refreshToken],
      ["google_access_token", accessToken],
      ["contact_sync_customers", String(syncCustomers)],
      ["contact_sync_therapists", String(syncTherapists)],
      ["contact_sync_staff", String(syncStaff)],
      ["contact_sync_name_overwrite", String(nameOverwrite)],
      ["contact_sync_auto", String(autoSync)],
    ];
    for (const [key, value] of pairs) {
      await supabase.from("store_settings").upsert({ key, value }, { onConflict: "key" });
    }
    setSaving(false); setSaveMsg("✅ 保存しました");
    setTimeout(() => setSaveMsg(""), 3000);
  };

  // Google認証開始
  const startAuth = () => {
    if (!clientId) { setTestMsg("❌ クライアントIDを入力してください"); return; }
    const redirectUri = `${window.location.origin}/api/google-auth/callback`;
    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent("https://www.googleapis.com/auth/contacts")}&access_type=offline&prompt=consent`;
  };

  // 接続テスト
  const testConnection = async () => {
    setTesting(true); setTestMsg("");
    try {
      const res = await fetch("/api/google-contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "test_connection",
          settings: { google_access_token: accessToken, google_refresh_token: refreshToken, google_client_id: clientId, google_client_secret: clientSecret },
        }),
      });
      const data = await res.json();
      if (data.success) {
        setConnected(true);
        setAccountName(data.accountName);
        setTestMsg(`✅ 接続成功 — ${data.accountName}`);
        // 新しいトークンを保存
        if (data.newToken) {
          setAccessToken(data.newToken);
          await supabase.from("store_settings").upsert({ key: "google_access_token", value: data.newToken }, { onConflict: "key" });
        }
      } else {
        setTestMsg(`❌ ${data.error}`);
      }
    } catch (err: unknown) {
      setTestMsg(`❌ ${err instanceof Error ? err.message : "通信エラー"}`);
    }
    setTesting(false);
  };

  // グループ初期化
  const initGroups = async () => {
    setInitingGroups(true);
    try {
      const res = await fetch("/api/google-contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "init_groups",
          settings: { google_access_token: accessToken, google_refresh_token: refreshToken, google_client_id: clientId, google_client_secret: clientSecret },
        }),
      });
      const data = await res.json();
      if (data.groups) setGroups(data.groups);
    } catch { /* ignore */ }
    setInitingGroups(false);
  };

  // グループ一覧取得
  const fetchGroups = async () => {
    try {
      const res = await fetch("/api/google-contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "list_groups",
          settings: { google_access_token: accessToken, google_refresh_token: refreshToken, google_client_id: clientId, google_client_secret: clientSecret },
        }),
      });
      const data = await res.json();
      if (data.groups) setGroups(data.groups.filter((g: { name: string }) => g.name.startsWith("T-MANAGE")));
    } catch { /* ignore */ }
  };

  // 一括同期
  const runBulkSync = async (type: "customers" | "therapists" | "staff") => {
    setSyncing(true); setSyncResults([]); setSyncProgress("データ取得中...");

    const settingsObj = {
      google_access_token: accessToken, google_refresh_token: refreshToken,
      google_client_id: clientId, google_client_secret: clientSecret,
    };

    const contacts: { name: string; phone: string; groupName: string; memo: string }[] = [];

    if (type === "customers") {
      setSyncProgress("顧客データ取得中...");
      const { data: custs } = await supabase.from("customers").select("name,phone,rank");
      // NGメモ取得
      const { data: ngNotes } = await supabase.from("therapist_customer_notes").select("customer_name,therapist_id,is_ng").eq("is_ng", true);
      const { data: ths } = await supabase.from("therapists").select("id,name,status");
      const activeThIds = new Set((ths || []).filter(t => t.status === "active").map(t => t.id));

      for (const c of (custs || [])) {
        if (!c.phone) continue;
        const rank = c.rank || "normal";
        let groupName = "T-MANAGE 顧客";
        if (rank === "banned") groupName = "T-MANAGE 出禁";
        else if (rank === "caution") groupName = "T-MANAGE 要注意";

        // NGメモ生成
        const custNgs = (ngNotes || []).filter(n => n.customer_name === c.name && activeThIds.has(n.therapist_id));
        let memo = "";
        if (custNgs.length > 0) {
          const ngNames = custNgs.map(n => (ths || []).find(t => t.id === n.therapist_id)?.name || "不明");
          memo = `NG: ${ngNames.join(", ")}`;
        }

        contacts.push({ name: c.name, phone: c.phone, groupName, memo });
      }
    }

    if (type === "therapists") {
      setSyncProgress("セラピストデータ取得中...");
      const { data: ths } = await supabase.from("therapists").select("name,phone,status");
      for (const t of (ths || [])) {
        if (!t.phone) continue;
        let groupName = "T-MANAGE セラピスト";
        if (t.status === "inactive") groupName = "T-MANAGE セラピスト休止";
        if (t.status === "retired") groupName = "T-MANAGE セラピスト退職";
        contacts.push({ name: t.name, phone: t.phone, groupName, memo: "" });
      }
    }

    if (type === "staff") {
      setSyncProgress("スタッフデータ取得中...");
      const { data: stf } = await supabase.from("staff").select("name,phone,status");
      for (const s of (stf || [])) {
        if (!(s as { phone?: string }).phone) continue;
        contacts.push({ name: s.name, phone: (s as { phone?: string }).phone || "", groupName: "T-MANAGE スタッフ", memo: "" });
      }
    }

    if (contacts.length === 0) {
      setSyncProgress("");
      setSyncResults([{ name: "-", status: "skipped", error: "同期対象がありません（電話番号のない連絡先は除外）" }]);
      setSyncing(false);
      return;
    }

    setSyncProgress(`${contacts.length}件を同期中...`);

    try {
      const res = await fetch("/api/google-contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "bulk_sync", settings: settingsObj, contacts, overwriteName: nameOverwrite }),
      });
      const data = await res.json();
      if (data.results) setSyncResults(data.results);
      else setSyncResults([{ name: "-", status: "error", error: data.error }]);
    } catch (err: unknown) {
      setSyncResults([{ name: "-", status: "error", error: err instanceof Error ? err.message : "通信エラー" }]);
    }

    setSyncProgress("");
    setSyncing(false);
    fetchGroups();
  };

  const cardStyle = { background: T.card, border: `1px solid ${T.border}`, borderRadius: 16 };
  const inputStyle = { backgroundColor: T.cardAlt, color: T.text, border: "1px solid transparent" };
  const stepNumStyle = (color: string) => ({
    width: 32, height: 32, borderRadius: "50%", backgroundColor: color + "18",
    color, display: "flex" as const, alignItems: "center" as const, justifyContent: "center" as const,
    fontSize: 14, fontWeight: 700 as const, flexShrink: 0 as const,
  });

  const successCount = syncResults.filter(r => r.status === "created" || r.status === "updated").length;
  const errorCount = syncResults.filter(r => r.status === "error").length;
  const skipCount = syncResults.filter(r => r.status === "skipped").length;

  return (
    <div style={{ backgroundColor: T.bg, minHeight: "100vh", color: T.text }}>
      {/* Header */}
      <div className="h-[64px] backdrop-blur-xl border-b flex items-center justify-between px-6" style={{ backgroundColor: dark ? T.card + "cc" : "rgba(255,255,255,0.8)", borderColor: T.border }}>
        <div className="flex items-center gap-4">
          <NavMenu T={T} dark={dark} />
          <h1 className="text-[15px] font-medium">📱 電話番号バックアップ（Googleコンタクト連携）</h1>
        </div>
        <button onClick={toggle} className="px-3 py-1.5 text-[10px] rounded-lg cursor-pointer border" style={{ borderColor: T.border, color: T.textSub }}>{dark ? "☀️ ライト" : "🌙 ダーク"}</button>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">

        {/* 概要 */}
        <div className="rounded-2xl p-6" style={cardStyle}>
          <h2 className="text-[16px] font-medium mb-3">📱 Googleコンタクト自動バックアップとは？</h2>
          <p className="text-[13px] leading-relaxed" style={{ color: T.textSub }}>
            T-MANAGEに登録された顧客・セラピスト・スタッフの電話番号を、<span style={{ color: "#4285f4", fontWeight: 600 }}>Googleコンタクトに自動バックアップ</span>する機能です。
            ランクやNG情報に応じてグループ分けされ、端末の電話帳にも反映されます。
          </p>
          <div className="mt-4 p-4 rounded-xl space-y-2 text-[11px]" style={{ backgroundColor: T.cardAlt }}>
            <p style={{ color: T.textSub }}>📂 <strong>グループ分け:</strong></p>
            <div className="flex flex-wrap gap-1.5">
              {GROUP_NAMES.map(g => (
                <span key={g} className="px-2 py-1 rounded text-[10px]" style={{ backgroundColor: g.includes("出禁") ? "#c4555518" : g.includes("要注意") ? "#f59e0b18" : g.includes("休止") ? "#88878018" : g.includes("退職") ? "#c4555518" : "#4285f418", color: g.includes("出禁") ? "#c45555" : g.includes("要注意") ? "#f59e0b" : g.includes("休止") ? "#888780" : g.includes("退職") ? "#c45555" : "#4285f4" }}>{g}</span>
              ))}
            </div>
          </div>
        </div>

        {/* STEP1: Google Cloud設定 */}
        <div className="rounded-2xl p-6" style={cardStyle}>
          <div className="flex items-center gap-3 mb-5">
            <div style={stepNumStyle("#4285f4")}>1</div>
            <div>
              <h3 className="text-[14px] font-medium">Google Cloud Console 設定</h3>
              <p className="text-[11px] mt-0.5" style={{ color: T.textMuted }}>OAuth2クライアントIDを作成</p>
            </div>
          </div>
          <div className="space-y-3 text-[11px]" style={{ color: T.textSub }}>
            <div className="p-3 rounded-xl" style={{ backgroundColor: T.cardAlt }}>
              <p className="font-medium mb-1">① Google Cloud Console にアクセス</p>
              <p className="text-[10px]" style={{ color: T.textMuted }}>
                <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer" style={{ color: "#4285f4", textDecoration: "underline" }}>https://console.cloud.google.com/</a> → プロジェクト作成（またはT-MANAGE用プロジェクト選択）
              </p>
            </div>
            <div className="p-3 rounded-xl" style={{ backgroundColor: T.cardAlt }}>
              <p className="font-medium mb-1">② People API を有効化</p>
              <p className="text-[10px]" style={{ color: T.textMuted }}>「APIとサービス」→「ライブラリ」→「People API」を検索 →「有効にする」</p>
            </div>
            <div className="p-3 rounded-xl" style={{ backgroundColor: T.cardAlt }}>
              <p className="font-medium mb-1">③ OAuth同意画面を設定</p>
              <p className="text-[10px]" style={{ color: T.textMuted }}>「OAuth同意画面」→ ユーザータイプ「外部」→ アプリ名入力 → スコープ追加「../auth/contacts」→ テストユーザーにお店のGmailアドレスを追加</p>
            </div>
            <div className="p-3 rounded-xl" style={{ backgroundColor: T.cardAlt }}>
              <p className="font-medium mb-1">④ 認証情報を作成</p>
              <p className="text-[10px]" style={{ color: T.textMuted }}>「認証情報」→「+ 認証情報を作成」→「OAuth クライアント ID」→ 種類「ウェブアプリケーション」→ 承認済みリダイレクトURIに以下を追加:</p>
              <p className="text-[10px] mt-1 px-2 py-1 rounded font-mono" style={{ backgroundColor: T.bg, color: "#4285f4" }}>{typeof window !== "undefined" ? `${window.location.origin}/api/google-auth/callback` : "https://t-manage.vercel.app/api/google-auth/callback"}</p>
            </div>
          </div>
        </div>

        {/* STEP2: 認証情報入力 */}
        <div className="rounded-2xl p-6" style={cardStyle}>
          <div className="flex items-center gap-3 mb-5">
            <div style={stepNumStyle("#34a853")}>2</div>
            <div>
              <h3 className="text-[14px] font-medium">認証情報</h3>
              <p className="text-[11px] mt-0.5" style={{ color: T.textMuted }}>Google Cloud Consoleで取得したクライアントID/シークレットを入力</p>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <label className="text-[12px] font-medium mb-1.5 block" style={{ color: T.textSub }}>クライアントID</label>
              <input type="text" value={clientId} onChange={e => setClientId(e.target.value)} placeholder="xxxx.apps.googleusercontent.com" className="w-full px-4 py-3 rounded-xl text-[12px] outline-none border" style={{ ...inputStyle, fontFamily: "monospace" }} />
            </div>
            <div>
              <label className="text-[12px] font-medium mb-1.5 block" style={{ color: T.textSub }}>クライアントシークレット</label>
              <input type="password" value={clientSecret} onChange={e => setClientSecret(e.target.value)} placeholder="GOCSPX-xxxx" className="w-full px-4 py-3 rounded-xl text-[12px] outline-none border" style={inputStyle} />
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <button onClick={startAuth} disabled={!clientId || !clientSecret} className="px-5 py-2.5 rounded-xl text-[13px] font-medium cursor-pointer text-white disabled:opacity-50" style={{ backgroundColor: "#4285f4" }}>🔑 Googleアカウントで認証</button>
              {refreshToken && <button onClick={testConnection} disabled={testing} className="px-4 py-2.5 rounded-xl text-[13px] cursor-pointer" style={{ backgroundColor: "#34a85318", color: "#34a853", border: "1px solid #34a85344" }}>{testing ? "テスト中..." : "🔌 接続テスト"}</button>}
              {testMsg && <span className="text-[12px]" style={{ color: testMsg.startsWith("✅") ? "#34a853" : "#c45555" }}>{testMsg}</span>}
            </div>
            {connected && accountName && <p className="text-[12px]" style={{ color: "#34a853" }}>✅ 接続中: {accountName}</p>}
          </div>
        </div>

        {/* STEP3: 同期設定 */}
        <div className="rounded-2xl p-6" style={cardStyle}>
          <div className="flex items-center gap-3 mb-5">
            <div style={stepNumStyle("#fbbc04")}>3</div>
            <div>
              <h3 className="text-[14px] font-medium">同期設定</h3>
              <p className="text-[11px] mt-0.5" style={{ color: T.textMuted }}>同期対象と動作を細かく設定</p>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <label className="text-[12px] font-medium mb-2 block" style={{ color: T.textSub }}>同期対象</label>
              <div className="space-y-2">
                {[
                  { label: "👥 顧客（出禁・要注意・普通・善良）", checked: syncCustomers, onChange: setSyncCustomers, desc: "ランクに応じてグループ自動振り分け。NGメモも連絡先に追記" },
                  { label: "💆 セラピスト（稼働・休止・退職）", checked: syncTherapists, onChange: setSyncTherapists, desc: "ステータス変更でグループ自動移動。退職しても連絡先は残る" },
                  { label: "👤 スタッフ", checked: syncStaff, onChange: setSyncStaff, desc: "内勤スタッフの電話番号を同期" },
                ].map((item, i) => (
                  <button key={i} onClick={() => item.onChange(!item.checked)} className="w-full text-left px-4 py-3 rounded-xl cursor-pointer" style={{ backgroundColor: item.checked ? "#4285f412" : T.cardAlt, border: `1px solid ${item.checked ? "#4285f444" : T.border}` }}>
                    <div className="flex items-center gap-2">
                      <span className="text-[14px]">{item.checked ? "☑️" : "⬜"}</span>
                      <span className="text-[12px] font-medium" style={{ color: item.checked ? "#4285f4" : T.textMuted }}>{item.label}</span>
                    </div>
                    <p className="text-[10px] mt-1 ml-6" style={{ color: T.textMuted }}>{item.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-2 space-y-3">
              <label className="text-[12px] font-medium mb-2 block" style={{ color: T.textSub }}>動作設定</label>
              <button onClick={() => setNameOverwrite(!nameOverwrite)} className="w-full text-left px-4 py-3 rounded-xl cursor-pointer" style={{ backgroundColor: nameOverwrite ? "#fbbc0412" : T.cardAlt, border: `1px solid ${nameOverwrite ? "#fbbc0444" : T.border}` }}>
                <div className="flex items-center gap-2">
                  <span className="text-[14px]">{nameOverwrite ? "☑️" : "⬜"}</span>
                  <span className="text-[12px] font-medium" style={{ color: nameOverwrite ? "#fbbc04" : T.textMuted }}>名前の上書きを許可</span>
                </div>
                <p className="text-[10px] mt-1 ml-6" style={{ color: T.textMuted }}>ONにすると、Googleコンタクトの名前がT-MANAGEの名前で上書きされます。OFFだと電話番号の紐付けのみ行います。</p>
              </button>
              <button onClick={() => setAutoSync(!autoSync)} className="w-full text-left px-4 py-3 rounded-xl cursor-pointer" style={{ backgroundColor: autoSync ? "#34a85312" : T.cardAlt, border: `1px solid ${autoSync ? "#34a85344" : T.border}` }}>
                <div className="flex items-center gap-2">
                  <span className="text-[14px]">{autoSync ? "☑️" : "⬜"}</span>
                  <span className="text-[12px] font-medium" style={{ color: autoSync ? "#34a853" : T.textMuted }}>登録・変更時に自動同期</span>
                </div>
                <p className="text-[10px] mt-1 ml-6" style={{ color: T.textMuted }}>ONにすると、顧客/セラピスト/スタッフの登録・更新・ランク変更時に自動的にGoogleコンタクトに反映されます。</p>
              </button>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button onClick={saveSettings} disabled={saving} className="px-6 py-2.5 rounded-xl text-[13px] font-medium cursor-pointer text-white" style={{ backgroundColor: "#4285f4" }}>{saving ? "保存中..." : "💾 設定を保存"}</button>
              {saveMsg && <span className="text-[12px]" style={{ color: "#34a853" }}>{saveMsg}</span>}
            </div>
          </div>
        </div>

        {/* STEP4: グループ初期化 */}
        <div className="rounded-2xl p-6" style={cardStyle}>
          <div className="flex items-center gap-3 mb-5">
            <div style={stepNumStyle("#ea4335")}>4</div>
            <div>
              <h3 className="text-[14px] font-medium">グループ初期化</h3>
              <p className="text-[11px] mt-0.5" style={{ color: T.textMuted }}>Googleコンタクトにタグ/グループを自動作成</p>
            </div>
          </div>
          <div className="flex items-center gap-3 mb-4">
            <button onClick={initGroups} disabled={initingGroups || !refreshToken} className="px-5 py-2.5 rounded-xl text-[13px] font-medium cursor-pointer disabled:opacity-50" style={{ backgroundColor: "#ea433518", color: "#ea4335", border: "1px solid #ea433544" }}>{initingGroups ? "作成中..." : "📂 グループを自動作成"}</button>
            <button onClick={fetchGroups} disabled={!refreshToken} className="px-4 py-2.5 rounded-xl text-[13px] cursor-pointer disabled:opacity-50" style={{ backgroundColor: T.cardAlt, color: T.textSub, border: `1px solid ${T.border}` }}>🔄 一覧更新</button>
          </div>
          {groups.length > 0 && (
            <div className="space-y-1.5">
              {groups.map(g => (
                <div key={g.resourceName} className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ backgroundColor: T.cardAlt }}>
                  <span className="text-[12px]">{g.name}</span>
                  <span className="text-[10px]" style={{ color: T.textMuted }}>{g.memberCount || 0}件</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* STEP5: 一括同期 */}
        <div className="rounded-2xl p-6" style={cardStyle}>
          <div className="flex items-center gap-3 mb-5">
            <div style={stepNumStyle("#4285f4")}>5</div>
            <div>
              <h3 className="text-[14px] font-medium">一括同期</h3>
              <p className="text-[11px] mt-0.5" style={{ color: T.textMuted }}>T-MANAGEの全データをGoogleコンタクトに同期</p>
            </div>
          </div>
          <div className="flex gap-2 mb-4">
            {(["customers", "therapists", "staff"] as const).map(tab => (
              <button key={tab} onClick={() => setSyncTab(tab)} className="px-4 py-2 rounded-xl text-[11px] cursor-pointer" style={{ backgroundColor: syncTab === tab ? "#4285f418" : T.cardAlt, color: syncTab === tab ? "#4285f4" : T.textMuted, border: `1px solid ${syncTab === tab ? "#4285f4" : T.border}`, fontWeight: syncTab === tab ? 700 : 400 }}>
                {tab === "customers" ? "👥 顧客" : tab === "therapists" ? "💆 セラピスト" : "👤 スタッフ"}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3 mb-4">
            <button onClick={() => runBulkSync(syncTab)} disabled={syncing || !refreshToken} className="px-5 py-2.5 rounded-xl text-[13px] font-medium cursor-pointer text-white disabled:opacity-50" style={{ backgroundColor: "#4285f4" }}>
              {syncing ? "⏳ 同期中..." : `🔄 ${syncTab === "customers" ? "顧客" : syncTab === "therapists" ? "セラピスト" : "スタッフ"}を一括同期`}
            </button>
            {syncProgress && <span className="text-[11px]" style={{ color: "#4285f4" }}>{syncProgress}</span>}
          </div>

          {syncResults.length > 0 && (
            <div>
              <div className="flex items-center gap-3 mb-3 text-[11px]">
                {successCount > 0 && <span style={{ color: "#34a853" }}>✅ {successCount}件成功</span>}
                {skipCount > 0 && <span style={{ color: "#fbbc04" }}>⏭️ {skipCount}件スキップ</span>}
                {errorCount > 0 && <span style={{ color: "#ea4335" }}>❌ {errorCount}件エラー</span>}
              </div>
              <div className="max-h-[200px] overflow-y-auto rounded-xl border" style={{ borderColor: T.border }}>
                {syncResults.map((r, i) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-1.5 text-[10px]" style={{ borderBottom: `1px solid ${T.border}`, color: r.status === "error" ? "#ea4335" : r.status === "skipped" ? "#fbbc04" : "#34a853" }}>
                    <span>{r.status === "created" ? "🆕" : r.status === "updated" ? "🔄" : r.status === "skipped" ? "⏭️" : "❌"}</span>
                    <span className="flex-1" style={{ color: T.text }}>{r.name}</span>
                    <span>{r.status === "created" ? "新規作成" : r.status === "updated" ? "更新" : r.error || r.status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* NGルール説明 */}
        <div className="rounded-2xl p-6" style={cardStyle}>
          <h3 className="text-[14px] font-medium mb-3">🛡️ NG・ランク連動ルール</h3>
          <div className="space-y-3 text-[11px]" style={{ color: T.textSub }}>
            <div className="p-3 rounded-xl" style={{ backgroundColor: T.cardAlt }}>
              <p className="font-medium mb-1" style={{ color: "#c45555" }}>🚫 NG登録時</p>
              <p>連絡先のメモに「NG: セラピスト名」を自動追記。セラピストが休止・退職したらメモから自動削除。</p>
            </div>
            <div className="p-3 rounded-xl" style={{ backgroundColor: T.cardAlt }}>
              <p className="font-medium mb-1" style={{ color: "#f59e0b" }}>⚠️ 要注意（NG 3件）</p>
              <p>稼働中セラピスト3名以上がNGの場合、「T-MANAGE 要注意」グループに自動移動。</p>
            </div>
            <div className="p-3 rounded-xl" style={{ backgroundColor: T.cardAlt }}>
              <p className="font-medium mb-1" style={{ color: "#c45555" }}>⛔ 出禁（NG 5件以上）</p>
              <p>稼働中セラピスト5名以上がNGの場合、「T-MANAGE 出禁」グループに自動移動。</p>
            </div>
            <div className="p-3 rounded-xl" style={{ backgroundColor: T.cardAlt }}>
              <p className="font-medium mb-1">💆 セラピスト休止・退職</p>
              <p>ステータス変更で「T-MANAGE セラピスト休止」「T-MANAGE セラピスト退職」に自動移動。連絡先は削除されず残ります。</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ContactSync() {
  return <Suspense fallback={<div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}><p>読み込み中...</p></div>}><ContactSyncInner /></Suspense>;
}
